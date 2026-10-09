// Mail push: a small Cloudflare Worker that tells your iPhone about new mail.
//
// Every minute it asks Gmail what arrived in the inbox since last time (the
// history API - a couple of quota units), reads just the sender and subject of
// anything new, and sends a Web Push notification to the phone(s) that
// subscribed from the Mail app. The notification is encrypted for the phone,
// so Apple's push service only ever carries ciphertext.
//
// It can read message *headers* only: its Google token has the gmail.metadata
// scope (senders, subjects, labels - never message bodies), and it keeps no
// mail: just the subscription, where it got to in the history, and a token.
//
// Setup: mail/README.md, "Notifications". Deployed by .github/workflows/push.yml.
//
// Environment (wrangler.toml [vars] and secrets):
//   PUSH                  KV namespace binding
//   ALLOWED_EMAIL         the one Gmail address allowed to subscribe
//   ALLOWED_ORIGIN        where the app is served, e.g. https://tomallison24-news.pages.dev
//   MARKETING_LABEL       default "Marketing" - never notified
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN   (metadata scope)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT            (see make-vapid-keys.mjs)

import { send, b64u } from './webpush.js';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const MODES = new Set(['all', 'primary', 'tags']);
const SKIP = new Set(['SPAM', 'TRASH', 'SENT', 'DRAFT', 'CHAT']);
// Push services the phone may hand us; anything else is refused, so the Worker
// can't be pointed at arbitrary addresses.
const PUSH_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)\//i;

export default {
  fetch: (req, env) => handle(req, env, fetch),
  scheduled: (event, env, ctx) => ctx.waitUntil(check(env, fetch).then(r => console.log(JSON.stringify(r)), e => console.error(e.message))),
};

// ---------------------------------------------------------------------------
// The app's requests: /key, /subscribe, /unsubscribe, /test
// ---------------------------------------------------------------------------
function corsFor(env, req) {
  const origin = req.headers.get('Origin') || '';
  const ok = String(env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean).includes(origin);
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' } : {};
}
const json = (o, status, headers) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...headers } });

// Who is asking: the app sends the Google token it already holds, and Gmail
// says whose it is. Only ALLOWED_EMAIL may subscribe or test.
async function whoIs(req, fetchImpl) {
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!t) return null;
  const r = await fetchImpl(API + '/profile', { headers: { Authorization: 'Bearer ' + t } });
  if (!r.ok) return null;
  return String((await r.json()).emailAddress || '').toLowerCase() || null;
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
async function pushTo(s, msg, env, fetchImpl, opts = {}) {
  if (!(await validKeys(s.subscription?.keys || {}))) return 410;      // can never be delivered: forget it
  try { return await send(s.subscription, msg, vapidOf(env), { fetchImpl, ...opts }); }
  catch { return 0; }                                                   // the push service unreachable: try next time
}

async function idOf(endpoint) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)));
  return [...h.slice(0, 12)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function handle(req, env, fetchImpl = fetch) {
  const url = new URL(req.url), h = corsFor(env, req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method === 'GET' && url.pathname === '/key') return json({ key: env.VAPID_PUBLIC_KEY }, 200, h);
  if (req.method !== 'POST' || !['/subscribe', '/unsubscribe', '/test'].includes(url.pathname)) return json({ error: 'not found' }, 404, h);

  const me = await whoIs(req, fetchImpl);
  if (!me || me !== String(env.ALLOWED_EMAIL || '').toLowerCase()) return json({ error: 'not allowed' }, 403, h);
  const body = await req.json().catch(() => ({}));
  const subs = (await env.PUSH.get('subs', 'json')) || {};

  if (url.pathname === '/subscribe') {
    const s = body.subscription;
    if (!s || !PUSH_HOSTS.test(s.endpoint || '') || !s.keys?.p256dh || !s.keys?.auth || !(await validKeys(s.keys))) return json({ error: 'bad subscription' }, 400, h);
    subs[await idOf(s.endpoint)] = {
      subscription: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
      mode: MODES.has(body.mode) ? body.mode : 'all',
      tags: Array.isArray(body.tags) ? body.tags.filter(x => typeof x === 'string').slice(0, 50) : [],
      at: Date.now(),
    };
    await env.PUSH.put('subs', JSON.stringify(subs));
    return json({ ok: true }, 200, h);
  }
  if (url.pathname === '/unsubscribe') {
    const id = body.endpoint ? await idOf(body.endpoint) : null;
    if (id && subs[id]) { delete subs[id]; await env.PUSH.put('subs', JSON.stringify(subs)); }
    return json({ ok: true }, 200, h);
  }
  // /test: a notification to every subscribed phone, now
  let sent = 0, gone = false;
  for (const [id, s] of Object.entries(subs)) {
    const st = await pushTo(s, { title: 'Mail', body: 'Notifications are working.', tag: 'test' }, env, fetchImpl, { urgency: 'high' });
    if (st === 404 || st === 410) { delete subs[id]; gone = true; } else if (st && st < 300) sent++;
  }
  if (gone) await env.PUSH.put('subs', JSON.stringify(subs));
  return json({ ok: true, sent }, 200, h);
}

const vapidOf = env => ({ publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || 'mailto:' + env.ALLOWED_EMAIL });

// ---------------------------------------------------------------------------
// Every minute: anything new in the inbox?
// ---------------------------------------------------------------------------
class GmailError extends Error {}

async function token(env, fetchImpl) {
  const c = await env.PUSH.get('token', 'json');
  if (c && c.exp > Date.now() + 60000) return c.t;
  const r = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Google token: ' + (b.error_description || b.error || r.status));
  await env.PUSH.put('token', JSON.stringify({ t: b.access_token, exp: Date.now() + (b.expires_in || 3600) * 1000 }));
  return b.access_token;
}

function gmail(t, fetchImpl) {
  return async (path, params = {}) => {
    const u = new URL(API + path);
    for (const [k, v] of Object.entries(params)) {
      if (v == null) continue;
      for (const one of Array.isArray(v) ? v : [v]) u.searchParams.append(k, one);
    }
    const r = await fetchImpl(u, { headers: { Authorization: 'Bearer ' + t } });
    if (!r.ok) { const e = new GmailError(path + ' → ' + r.status); e.status = r.status; throw e; }
    return r.json();
  };
}

const header = (m, name) => (m.payload?.headers || []).find(x => x.name.toLowerCase() === name)?.value || '';
function sender(from) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from || '');
  return (m ? m[1].trim() || m[2] : String(from || '').trim()) || 'New mail';
}

// Whether a message is one this phone asked to hear about.
export function wanted(m, sub, marketingId) {
  const l = m.labelIds || [];
  if (!l.includes('INBOX') || !l.includes('UNREAD')) return false;       // already archived, or read elsewhere
  if (l.some(x => SKIP.has(x)) || (marketingId && l.includes(marketingId))) return false;
  if (sub.mode === 'primary') return l.includes('CATEGORY_PERSONAL');
  if (sub.mode === 'tags') return l.some(x => sub.tags.includes(x));
  return !l.includes('CATEGORY_PROMOTIONS');
}

export async function check(env, fetchImpl = fetch) {
  const subs = (await env.PUSH.get('subs', 'json')) || {};
  if (!Object.keys(subs).length) return { skipped: 'nobody subscribed' };
  const g = gmail(await token(env, fetchImpl), fetchImpl);

  const start = await env.PUSH.get('history');
  if (!start) {                                                 // first run: start from now
    await env.PUSH.put('history', String((await g('/profile')).historyId));
    return { started: true };
  }
  const added = new Map();
  let latest = start, page;
  try {
    do {
      const r = await g('/history', { startHistoryId: start, historyTypes: 'messageAdded', labelId: 'INBOX', pageToken: page, maxResults: 100 });
      for (const h of r.history || []) for (const a of h.messagesAdded || []) added.set(a.message.id, a.message);
      latest = r.historyId || latest;
      page = r.nextPageToken;
    } while (page);
  } catch (e) {
    if (e.status !== 404) throw e;                              // too old to resume: start again from now
    await env.PUSH.put('history', String((await g('/profile')).historyId));
    return { reset: true };
  }
  // Nothing new: leave the stored position alone (saves KV writes).
  const fresh = [...added.values()].filter(m => !(m.labelIds || []).some(x => SKIP.has(x)));
  if (!fresh.length) {
    if (added.size) await env.PUSH.put('history', String(latest));
    return { new: 0 };
  }

  const labels = (await g('/labels')).labels || [];
  const mkt = labels.find(l => l.name.toLowerCase() === String(env.MARKETING_LABEL || 'Marketing').toLowerCase())?.id || null;
  const msgs = [];
  for (const a of fresh.slice(-10)) {                           // the newest ten at most
    try { msgs.push(await g('/messages/' + a.id, { format: 'metadata', metadataHeaders: ['From', 'Subject'] })); }
    catch (e) { if (e.status !== 404) throw e; }                // deleted meanwhile
  }
  const badge = (await g('/labels/INBOX')).threadsUnread ?? null;

  let sent = 0, gone = false;
  for (const [id, s] of Object.entries(subs)) {
    const mine = msgs.filter(m => wanted(m, s, mkt));
    if (!mine.length) continue;
    const one = mine.length === 1 ? mine[0] : null;
    const msg = one
      ? { title: sender(header(one, 'from')), body: header(one, 'subject') || '(no subject)', tag: one.threadId, thread: one.threadId, badge }
      : { title: mine.length + ' new emails', body: [...new Set(mine.map(m => sender(header(m, 'from'))))].slice(0, 4).join(', '), tag: 'mail', badge };
    const st = await pushTo(s, msg, env, fetchImpl);
    if (st === 404 || st === 410) { delete subs[id]; gone = true; }   // the phone unsubscribed
    else if (st && st < 300) sent++;
  }
  if (gone) await env.PUSH.put('subs', JSON.stringify(subs));
  await env.PUSH.put('history', String(latest));
  return { new: msgs.length, sent };
}
