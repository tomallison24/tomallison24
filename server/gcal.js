// Your own Google Calendar in Calendar (not a route: functions/calendar/api uses it). Each person can connect the
// primary calendar of their own Google account, read-only. It's theirs alone unless they switch on Share with the
// family; then everyone signed in to the family sees it too, in its own layer, with less in it:
//
//   - the person who connected it: every event in full (title, place, notes, a link to it in Google Calendar);
//   - the family, once shared: the title, place and time; never notes or links, and an event marked Private (or
//     Confidential) in Google shows only as "Busy".
//
// The sign-in is aOS's (server/gmail.js, kind 'calendar', calendar.readonly): Google's long-lived key stays here,
// sealed, and is never sent to a phone, not even the owner's; the events are read here and only the events go out.
// Like Gmail kept signed in, it ends after DAYS (30) and the person connects again; and it's off until the owner has
// set GOOGLE_CLIENT_SECRET (aOS/RELEASING.md, "Gmail stays signed in") and the Google Calendar API is on in that
// Google Cloud project (calendar/README.md, "Your own Google calendar").
//
// Kept in the accounts' KV:
//   gc:<user>     { email, at, sealed, share }   the person's sign-in (server/gmail.js keeps it)
//   gct:<user>    { sealed, exp }                 its hour-long key, sealed, until it runs out
//   gcshare       [<user>, ...]                   who has shared (a hint: gc:<user>.share is what counts)
import { getJSON, putJSON } from './auth.js';
import { on, seal, unseal, renew, revoke, DAYS, CALENDAR_API } from './gmail.js';

export { on };
const PAGE = 2500, PAGES = 4, SHARED_MAX = 12;
const DAY = 864e5;
const until = x => x.at + DAYS * DAY;
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);
// Google's notes can be HTML: plain text here
const plain = s => clip(String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n'), 2000);

async function shareList(db) { const l = await getJSON(db, 'gcshare'); return Array.isArray(l) ? l : []; }
async function setShareList(db, l) { if (l.length) await putJSON(db, 'gcshare', [...new Set(l)].slice(0, 50)); else await db.delete('gcshare'); }

// GET google -> { on, mine: { email, share, until } | null, shared: ['Anna', ...] } (who shares theirs with you)
export async function view(db, env, me) {
  const x = await getJSON(db, 'gc:' + me.id);
  const shared = [];
  for (const id of await shareList(db)) {
    if (id === me.id) continue;
    const [u, g] = await Promise.all([getJSON(db, 'user:' + id), getJSON(db, 'gc:' + id)]);
    if (u && !u.removed && g && g.share && Date.now() < until(g)) shared.push(clip(u.name, 40));
  }
  return { on: on(env), mine: x ? { email: x.email, share: !!x.share, until: until(x) } : null, shared };
}

// POST google/share { share } -> { ok, share }: your calendar shown to the family, or not
export async function share(db, me, want) {
  const x = await getJSON(db, 'gc:' + me.id);
  if (!x) return { error: 'none' };
  x.share = !!want;
  await putJSON(db, 'gc:' + me.id, x);
  const l = (await shareList(db)).filter(id => id !== me.id);
  await setShareList(db, x.share ? [...l, me.id] : l);
  return { ok: true, share: x.share };
}

// POST google/disconnect -> revoked at Google, deleted here, and no longer shared
export async function disconnect(db, env, me, f = fetch) {
  const x = await getJSON(db, 'gc:' + me.id);
  if (x) await revoke(env, x, f);
  await db.delete('gc:' + me.id); await db.delete('gct:' + me.id);
  await setShareList(db, (await shareList(db)).filter(id => id !== me.id));
  return { ok: true };
}

// An hour-long key for someone's calendar: kept sealed until it runs out, so a phone opening Calendar doesn't ask
// Google for a new one each time. { token } or { error: 'none' | 'expired' | 'revoked' | 'google' }
async function access(db, env, id, now, f) {
  const x = await getJSON(db, 'gc:' + id);
  if (!x) return { error: 'none' };
  if (now > until(x)) { await revoke(env, x, f); await db.delete('gc:' + id); await db.delete('gct:' + id); return { error: 'expired' }; }
  const c = await getJSON(db, 'gct:' + id);
  if (c && c.exp > now + 60e3) { try { return { token: await unseal(env, c.sealed), x }; } catch {} }
  const r = await renew(env, x.sealed, now, f);
  if (r.error === 'revoked') { await db.delete('gc:' + id); await db.delete('gct:' + id); }
  if (r.error) return { error: r.error };
  const secs = Math.floor((r.exp - now) / 1000);
  if (secs >= 60) await putJSON(db, 'gct:' + id, { sealed: await seal(env, r.token), exp: r.exp }, secs);
  return { token: r.token, x };
}

// One event, as the phone draws it. full: the person's own; otherwise what the family sees.
export function shape(e, full) {
  if (!e || e.status === 'cancelled' || e.eventType === 'workingLocation' || !e.start) return null;
  const allDay = !!e.start.date;
  const start = allDay ? e.start.date : e.start.dateTime, end = (allDay ? e.end && e.end.date : e.end && e.end.dateTime) || start;
  if (typeof start !== 'string' || !start) return null;
  const priv = e.visibility === 'private' || e.visibility === 'confidential';
  const out = { id: clip(e.id, 200), allDay, start: clip(start, 40), end: clip(end, 40), busy: e.transparency !== 'transparent' };
  if (full) {
    Object.assign(out, { title: clip(e.summary, 300) || '(No title)', location: clip(e.location, 300), notes: plain(e.description), private: priv });
    if (typeof e.htmlLink === 'string' && /^https:\/\/www\.google\.com\/calendar\//.test(e.htmlLink)) out.link = e.htmlLink.slice(0, 500);
  } else if (priv) out.title = 'Busy';
  else Object.assign(out, { title: clip(e.summary, 300) || '(No title)', location: clip(e.location, 300) });
  return out;
}

// Every event touching [from, to) in someone's primary calendar, repeats laid out (singleEvents).
async function list(token, from, to, full, f) {
  const out = [];
  let page = '';
  for (let i = 0; i < PAGES; i++) {
    const u = new URL(CALENDAR_API + '/calendars/primary/events');
    u.search = new URLSearchParams({ timeMin: from, timeMax: to, singleEvents: 'true', orderBy: 'startTime', maxResults: String(PAGE), ...(page ? { pageToken: page } : {}) });
    const r = await f(u.toString(), { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 401) return { error: 'revoked' };
    if (!r.ok) return { error: r.status === 403 || r.status === 404 ? 'api-off' : 'google' };
    const j = await r.json().catch(() => ({}));
    for (const e of j.items || []) { const s = shape(e, full); if (s) out.push(s); }
    if (!j.nextPageToken) break;
    page = j.nextPageToken;
  }
  return { events: out };
}

// GET google/events?start=…Z&end=…Z (the times as YYYYMMDDTHHMMSSZ, as the iCloud events)
//   -> { on, mine: { email, share, until, events } | { error } | null, shared: [{ who, events } | { who, error }] }
// Yours in full; each family member's that is shared with the family, as the family sees it.
export async function events(db, env, me, from, to, now = Date.now(), f = fetch) {
  if (!on(env)) return { on: false, mine: null, shared: [] };
  const mine = await (async () => {
    const a = await access(db, env, me.id, now, f);
    if (a.error === 'none') return null;
    if (a.error) return { error: a.error };
    const r = await list(a.token, from, to, true, f);
    if (r.error === 'revoked') await db.delete('gct:' + me.id);
    return r.error ? { email: a.x.email, error: r.error } : { email: a.x.email, share: !!a.x.share, until: until(a.x), events: r.events };
  })();
  const shared = [];
  for (const id of (await shareList(db)).slice(0, SHARED_MAX)) {
    if (id === me.id) continue;
    const [u, g] = await Promise.all([getJSON(db, 'user:' + id), getJSON(db, 'gc:' + id)]);
    if (!u || u.removed || !g || !g.share) continue;
    const who = clip(u.name, 40);
    const a = await access(db, env, id, now, f);
    if (a.error) { if (a.error !== 'none') shared.push({ who, error: a.error }); continue; }
    const r = await list(a.token, from, to, false, f);
    if (r.error === 'revoked') await db.delete('gct:' + id);
    shared.push(r.error ? { who, error: r.error } : { who, events: r.events });
  }
  return { on: true, mine, shared };
}
