// Notes push: a small Cloudflare Worker that alerts your iPhones when a
// reminder is due, or when a note's nudge comes round.
//
// A web app can't wake itself up on a timer, so this does it: every minute it
// looks at what is due and sends a Web Push notification to each phone that
// turned notifications on in Notes. Each notification is encrypted for that
// phone (RFC 8291, the same code as Mail's), so Apple's push service only ever
// carries ciphertext.
//
// Where the reminders come from: the Google Sheet the phones already sync
// with (notes/google-sheet-sync.gs). A phone pings /refresh after it syncs a
// change, and every 15 minutes the Worker reads the Sheet again anyway. It
// keeps only what it needs to alert: each open reminder's title, list, date,
// time and alert, and each nudge's title and time. Never note bodies.
//
// Who may subscribe: a phone that knows the Sheet's web app link and secret
// (the same two things it syncs with). The first phone's pair is kept; later
// phones must bring the same pair, so nobody can point this server at a Sheet
// of their own. If the secret is changed in the script, the old pair stops
// working and the next phone to subscribe with the new one takes over.
//
// Setup: notes/README.md, "Notifications". Deployed by
// .github/workflows/notes-push.yml. It makes its own push keys (VAPID) the
// first time it runs and keeps them in its KV store, so there are no secrets
// to set.
//
// Environment (wrangler.toml):
//   PUSH             KV namespace binding
//   ALLOWED_ORIGIN   where Notes is served, comma-separated
//   VAPID_SUBJECT    a contact for Apple's push service (an https: or mailto: address)

import { send, b64u, makeKeys } from '../../mail/push/webpush.js';

// Push services the phone may hand us; anything else is refused, so the Worker
// can't be pointed at arbitrary addresses.
const PUSH_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)\//i;
const SHEET_URL = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
const MIN = 60e3, DAY = 864e5;
const LATE = 10 * MIN;         // an alert up to 10 minutes late still goes out (a missed minute, a slow Sheet)
const PULL_EVERY = 15;         // minutes between Sheet reads when nobody pinged
const MAX_AT_ONCE = 3;         // more than this due together for one phone: one notification listing them

export default {
  fetch: (req, env) => handle(req, env, fetch),
  scheduled: (event, env, ctx) => ctx.waitUntil(tick(env, fetch, event.scheduledTime).then(r => console.log(JSON.stringify(r)), e => console.error(e.message))),
};

// ---------------------------------------------------------------------------
// Time: reminders are wall-clock dates and times ("2026-10-02", "17:30") on
// the phone, so each phone tells the Worker its time zone.
// ---------------------------------------------------------------------------
export const okZone = z => { try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return typeof z === 'string' && !!z; } catch { return false; } };

// How many minutes the zone is ahead of UTC at instant t.
function offsetMin(tz, t) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(t))) p[x.type] = x.value;
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(t / 1000) * 1000) / MIN);
}
// A wall-clock date and time in a zone, as an instant.
export function localTime(date, time, tz) {
  const [y, m, d] = date.split('-').map(Number), [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetMin(tz, guess) * MIN;
  return guess - offsetMin(tz, first) * MIN;               // second pass: right across a clock change
}
const addDays = (date, n) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const localDate = (t, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));

// When a reminder should alert this phone, or null. `alert` is minutes before
// it is due: missing means at the time, -1 means never. A reminder with a date
// but no time is due at the phone's morning time (9:00 unless changed), and
// its alert counts whole days back from there.
export function fireAt(t, sub) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date || '')) return null;
  const a = t.alert == null ? 0 : Number(t.alert);
  if (!(a >= 0)) return null;
  if (/^\d{2}:\d{2}$/.test(t.time || '')) return localTime(t.date, t.time, sub.tz) - a * MIN;
  return localTime(addDays(t.date, -Math.round(a / 1440)), sub.morning || '09:00', sub.tz);
}

// ---------------------------------------------------------------------------
// The Sheet
// ---------------------------------------------------------------------------
class SheetError extends Error {}

async function pull(sheet, fetchImpl, now = Date.now()) {
  let r, res;
  try {
    r = await fetchImpl(sheet.url, {
      method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: sheet.secret, action: 'due', v: 1 }),
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(25000) : undefined,
    });
  } catch { throw new SheetError('network'); }
  try { res = await r.json(); } catch { throw new SheetError('not-json'); }
  if (!res || !res.ok) throw new SheetError((res && typeof res.error === 'string' && res.error) || 'not-json');
  return slim(res, now);   // the clock tick() was given, not the real one (so a test can set it)
}

// Just what alerting needs. Done and deleted reminders, archived and deleted
// notes, and anything too old to alert any more are left out.
export function slim(res, now = Date.now()) {
  const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
  const oldest = new Date(now - 2 * DAY).toISOString().slice(0, 10);
  const lists = {};
  for (const l of res.lists || []) if (l && typeof l.id === 'string' && !l.deletedAt) lists[l.id] = str(l.name, 60) || 'Reminders';
  const todos = (res.todos || [])
    .filter(t => t && typeof t.id === 'string' && !t.done && !t.deletedAt && /^\d{4}-\d{2}-\d{2}$/.test(t.date || '') && t.date >= oldest)
    .map(t => ({ id: t.id, title: str(t.title, 120) || 'Reminder', list: String(t.list || ''), date: t.date,
      time: /^\d{2}:\d{2}$/.test(t.time || '') ? t.time : null, alert: t.alert == null || !isFinite(t.alert) ? null : Number(t.alert) }))
    .sort((a, b) => a.id < b.id ? -1 : 1);
  const nudges = (res.notes || [])
    .filter(n => n && typeof n.id === 'string' && n.reminder && !n.deletedAt && !n.archived && !n.private)
    .map(n => ({ id: n.id, title: str(n.title, 120) || str(String(n.body || '').split('\n').find(l => l.trim()), 120) || 'Note', at: Date.parse(n.reminder) }))
    .filter(n => n.at > now - DAY)
    .sort((a, b) => a.id < b.id ? -1 : 1);
  return { lists, todos, nudges };
}

// Saves what was read, if it changed (KV writes are the scarce thing).
async function keepItems(env, items) {
  const j = JSON.stringify(items);
  if ((await env.PUSH.get('items')) === j) return false;
  await env.PUSH.put('items', j);
  return true;
}

async function refresh(env, fetchImpl, now = Date.now()) {
  const sheet = await env.PUSH.get('sheet', 'json');
  if (!sheet) throw new SheetError('no-sheet');
  const items = await pull(sheet, fetchImpl, now);
  const changed = await keepItems(env, items);
  return { items, changed };
}

// Two strings compared without giving away how much of them matched.
async function same(a, b) {
  const h = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))));
  const [x, y] = await Promise.all([h(a), h(b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

// Whether a phone may subscribe with this Sheet link and secret (null if so).
async function authorise(env, sheet, fetchImpl) {
  if (!sheet || !SHEET_URL.test(sheet.url || '') || typeof sheet.secret !== 'string' || !sheet.secret) return 'no-sheet';
  const cur = await env.PUSH.get('sheet', 'json');
  if (cur && cur.url === sheet.url && await same(cur.secret, sheet.secret)) return null;
  let items;
  try { items = await pull(sheet, fetchImpl); }                // the Sheet itself must accept it
  catch (e) { return e.message === 'wrong-secret' ? 'wrong-secret' : 'sheet-' + e.message; }
  if (cur) {
    // A different Sheet replaces the one on file only when that one says its secret
    // has changed (wrong-secret). Any other trouble with it - offline, Google having a
    // bad moment, an odd answer - refuses, so no one can slip their own Sheet in then.
    // (To move to a new Sheet: change the old script's secret first.)
    try { await pull(cur, fetchImpl); return 'other-sheet'; }
    catch (e) { if (e.message !== 'wrong-secret') return 'other-sheet'; }
  }
  await env.PUSH.put('sheet', JSON.stringify({ url: sheet.url, secret: sheet.secret }));
  await keepItems(env, items);
  return null;
}

// ---------------------------------------------------------------------------
// Push keys: made on first use and kept in KV.
// ---------------------------------------------------------------------------
async function vapid(env) {
  let k = await env.PUSH.get('vapid', 'json');
  if (!k) {
    k = await makeKeys();
    await env.PUSH.put('vapid', JSON.stringify(k));
    k = (await env.PUSH.get('vapid', 'json')) || k;
  }
  return { ...k, subject: env.VAPID_SUBJECT || 'https://tomallison24-news.pages.dev/notes/' };
}

// A phone's keys must be a real P-256 point and a 16-byte secret, or nothing
// could ever be encrypted for it.
async function validKeys(k) {
  try {
    if (typeof k.p256dh !== 'string' || typeof k.auth !== 'string') return false;
    if (b64u.dec(k.auth).length !== 16) return false;
    await crypto.subtle.importKey('raw', b64u.dec(k.p256dh), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    return true;
  } catch { return false; }
}

// One phone's push; a broken subscription is reported as gone, not thrown.
async function pushTo(s, msg, keys, fetchImpl, opts = {}) {
  if (!(await validKeys(s.subscription?.keys || {}))) return 410;
  try { return await send(s.subscription, msg, keys, { fetchImpl, ttl: 3600, urgency: 'high', ...opts }); }
  catch { return 0; }                                           // the push service unreachable: try next minute
}

async function idOf(endpoint) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)));
  return [...h.slice(0, 12)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// The app's requests: /key, /subscribe, /unsubscribe, /refresh, /test
// ---------------------------------------------------------------------------
function corsFor(env, req) {
  const origin = req.headers.get('Origin') || '';
  const ok = String(env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean).includes(origin);
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' } : {};
}
const json = (o, status, headers) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function prefsOf(p = {}, old = {}) {
  const tz = okZone(p.tz) ? p.tz : okZone(old.tz) ? old.tz : 'UTC';
  return {
    tz,
    lang: typeof p.lang === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(p.lang) ? p.lang : old.lang || 'en-US',
    morning: /^([01]\d|2[0-3]):[0-5]\d$/.test(p.morning || '') ? p.morning : old.morning || '09:00',
    skip: Array.isArray(p.skip) ? p.skip.filter(x => typeof x === 'string').slice(0, 100) : old.skip || [],
    nudges: typeof p.nudges === 'boolean' ? p.nudges : old.nudges !== false,
  };
}

export async function handle(req, env, fetchImpl = fetch) {
  const url = new URL(req.url), h = corsFor(env, req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method === 'GET' && url.pathname === '/key') return json({ app: 'notes-push', key: (await vapid(env)).publicKey }, 200, h);
  if (req.method !== 'POST' || !['/subscribe', '/unsubscribe', '/refresh', '/test'].includes(url.pathname)) return json({ error: 'not found' }, 404, h);

  const body = await req.json().catch(() => ({}));
  const subs = (await env.PUSH.get('subs', 'json')) || {};

  if (url.pathname === '/subscribe') {
    const s = body.subscription;
    if (!s || !PUSH_HOSTS.test(s.endpoint || '') || !s.keys?.p256dh || !s.keys?.auth || !(await validKeys(s.keys))) return json({ error: 'bad-subscription' }, 400, h);
    const no = await authorise(env, body.sheet, fetchImpl);
    if (no) return json({ error: no }, 403, h);
    const id = await idOf(s.endpoint);
    subs[id] = { subscription: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, ...prefsOf(body.prefs, subs[id]), at: Date.now() };
    await env.PUSH.put('subs', JSON.stringify(subs));
    return json({ ok: true }, 200, h);
  }

  const id = typeof body.endpoint === 'string' ? await idOf(body.endpoint) : null;
  if (url.pathname === '/unsubscribe') {
    if (id && subs[id]) { delete subs[id]; await env.PUSH.put('subs', JSON.stringify(subs)); }
    return json({ ok: true }, 200, h);
  }
  // Only a subscribed phone may ask for the rest.
  if (!id || !subs[id]) return json({ error: 'not-subscribed' }, 403, h);

  if (url.pathname === '/refresh') {
    try { const r = await refresh(env, fetchImpl); return json({ ok: true, changed: r.changed }, 200, h); }
    catch (e) { return json({ error: 'sheet-' + e.message }, 502, h); }
  }
  // /test: a notification to this phone, now
  const st = await pushTo(subs[id], { title: 'Notes', body: 'Notifications are working.', tag: 'test' }, await vapid(env), fetchImpl);
  if (st === 404 || st === 410) { delete subs[id]; await env.PUSH.put('subs', JSON.stringify(subs)); return json({ error: 'not-subscribed' }, 410, h); }
  return st && st < 300 ? json({ ok: true }, 200, h) : json({ error: 'push-' + st }, 502, h);
}

// ---------------------------------------------------------------------------
// Every minute: anything due?
// ---------------------------------------------------------------------------

// What should alert this phone now: due in the last LATE minutes and not sent yet.
export function dueFor(items, sub, subId, now, sent) {
  const out = [], skip = new Set(sub.skip || []);
  for (const t of items.todos || []) {
    if (skip.has(t.list)) continue;
    const at = fireAt(t, sub);
    if (at == null || at > now || now - at > LATE) continue;
    const key = subId + ':t:' + t.id + ':' + at;
    if (!sent[key]) out.push({ key, kind: 'todo', item: t, at });
  }
  if (sub.nudges !== false) for (const n of items.nudges || []) {
    if (n.at > now || now - n.at > LATE) continue;
    const key = subId + ':n:' + n.id + ':' + n.at;
    if (!sent[key]) out.push({ key, kind: 'note', item: n, at: n.at });
  }
  return out.sort((a, b) => a.at - b.at);
}

// "5:30 PM", "Tomorrow, 5:30 PM", "In 15 min, 5:30 PM", "Today", "Fri, Oct 2".
export function when(t, sub, now) {
  const lang = sub.lang || 'en-US', tz = sub.tz;
  const today = localDate(now, tz);
  let day;
  if (t.date === today) day = '';
  else if (t.date === addDays(today, 1)) day = 'Tomorrow';
  else {
    const [y, m, d] = t.date.split('-').map(Number);
    day = new Intl.DateTimeFormat(lang, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  }
  if (!t.time) return day || 'Today';
  const due = localTime(t.date, t.time, tz);
  const time = new Intl.DateTimeFormat(lang, { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(due));
  const mins = Math.round((due - now) / MIN);
  if (mins > 0 && mins < 60) return 'In ' + mins + ' min, ' + time;
  return (day ? day + ', ' : '') + time;
}

function message(d, items, sub, now) {
  if (d.kind === 'note') return { title: d.item.title, body: 'Nudge from Notes', tag: 'note:' + d.item.id, open: 'note:' + d.item.id };
  const t = d.item;
  return { title: t.title, body: (items.lists[t.list] || 'Reminders') + ' · ' + when(t, sub, now), tag: 'todo:' + t.id, open: 'todo:' + t.id };
}

export async function tick(env, fetchImpl = fetch, now = Date.now()) {
  const subs = (await env.PUSH.get('subs', 'json')) || {};
  if (!Object.keys(subs).length) return { skipped: 'nobody subscribed' };

  let items = await env.PUSH.get('items', 'json'), pulled = null;
  if (!items || Math.floor(now / MIN) % PULL_EVERY === 0) {
    try { items = (await refresh(env, fetchImpl, now)).items; pulled = true; }
    catch (e) { pulled = e.message; if (!items) return { error: 'sheet-' + e.message }; }
  }

  const sent = (await env.PUSH.get('sent', 'json')) || {};
  let dirty = false, gone = false, count = 0;
  for (const k of Object.keys(sent)) if (sent[k] < now - 3 * DAY) { delete sent[k]; dirty = true; }
  const keys = await vapid(env);

  for (const [id, s] of Object.entries(subs)) {
    const due = dueFor(items, s, id, now, sent);
    if (!due.length) continue;
    const batches = due.length > MAX_AT_ONCE
      ? [{ keys: due.map(d => d.key), msg: { title: due.length + ' reminders', body: due.map(d => d.item.title).join(', ').slice(0, 180), tag: 'notes-due', open: 'rem' } }]
      : due.map(d => ({ keys: [d.key], msg: message(d, items, s, now) }));
    for (const b of batches) {
      const st = await pushTo(s, b.msg, keys, fetchImpl);
      if (st === 404 || st === 410) { delete subs[id]; gone = true; break; }   // the phone turned them off
      if (st && st < 300) { for (const k of b.keys) sent[k] = now; dirty = true; count++; }
    }
  }
  if (gone) await env.PUSH.put('subs', JSON.stringify(subs));
  if (dirty) await env.PUSH.put('sent', JSON.stringify(sent));
  return { sent: count, pulled };
}
