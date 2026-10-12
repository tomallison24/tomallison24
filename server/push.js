// AllisonOS notifications: the server side of Web Push for aOS, behind
// functions/aOS/api (routes push, push/subscribe, push/unsubscribe,
// push/audience, push/send). The owner writes a notification, aOS sends it to
// each family member's phones one person at a time (so one request never has
// much to encrypt), and the phone's service worker (aOS/sw.js) shows it.
//
// Kept in the same Workers KV namespace as the accounts (server/auth.js):
//   push:<id>        { subs: [{ endpoint, p256dh, auth, at }] } - that person's phones
//                    (up to MAX_DEVICES; the newest win). Only they can change it;
//                    it stays when they are removed, but a removed person is never sent to.
//   config:vapid     { publicKey, privateKey } - the server's own push key, made on first
//                    use. VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (Pages secrets) win if set.
// The encryption and signing are mail/push/webpush.js (RFC 8291 and 8292), also used
// by Notes' reminders. Apple's push service only ever carries ciphertext.

import { send, makeKeys, b64u as wp } from '../mail/push/webpush.js';
import { getJSON, putJSON } from './auth.js';

export const PUSH_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)\//i;
export const MAX_DEVICES = 5;
const SUBJECT = 'https://tomallison24-news.pages.dev/aOS/';

// The server's key pair, made once. Two first requests at once could each make one;
// the re-read means they end up agreeing on whichever landed last.
export async function vapidKeys(db, env, { create = true } = {}) {
  if (env && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || SUBJECT };
  let k = await getJSON(db, 'config:vapid');
  if (!k && create) { await putJSON(db, 'config:vapid', await makeKeys()); k = await getJSON(db, 'config:vapid'); }
  return k && k.publicKey && k.privateKey ? { ...k, subject: (env && env.VAPID_SUBJECT) || SUBJECT } : null;
}

// What a phone's PushSubscription.toJSON() gives, checked before it is kept: a push
// service we know, and keys of the right shape (a P-256 point and a 16-byte secret).
export function cleanSub(s) {
  if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 600 || !PUSH_HOSTS.test(s.endpoint)) return null;
  const k = s.keys || {};
  try {
    const p = wp.dec(k.p256dh), a = wp.dec(k.auth);
    if (p.length !== 65 || p[0] !== 4 || a.length !== 16) return null;
  } catch { return null; }
  return { endpoint: s.endpoint, p256dh: k.p256dh, auth: k.auth };
}

export const devices = async (db, id) => ((await getJSON(db, 'push:' + id)) || {}).subs || [];

// Adds (or refreshes) one phone; writes nothing if it is already exactly so. A phone
// is one person's: when someone else signs in on it, it moves to them.
export async function addDevice(db, id, sub) {
  const subs = await devices(db, id), at = subs.find(x => x.endpoint === sub.endpoint);
  if (at && at.p256dh === sub.p256dh && at.auth === sub.auth) return subs.length;
  // a phone belongs to one person: someone else signing in on it takes it over
  let cursor;
  do {
    const page = await db.list({ prefix: 'push:', cursor });
    for (const k of page.keys) if (k.name !== 'push:' + id) await dropDevices(db, k.name.slice(5), [sub.endpoint]);
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  const next = [...subs.filter(x => x.endpoint !== sub.endpoint), { ...sub, at: Date.now() }].slice(-MAX_DEVICES);
  await putJSON(db, 'push:' + id, { subs: next });
  return next.length;
}

export async function dropDevices(db, id, endpoints) {
  const subs = await devices(db, id), keep = subs.filter(x => !endpoints.includes(x.endpoint));
  if (keep.length === subs.length) return subs.length;
  if (keep.length) await putJSON(db, 'push:' + id, { subs: keep }); else await db.delete('push:' + id);
  return keep.length;
}

// What the notification says, trimmed: the phone shows a title and a few lines.
// The page it opens must be on this site (a path), never another address.
export function message(b) {
  const title = String((b && b.title) || '').trim().slice(0, 60), body = String((b && b.body) || '').trim().slice(0, 240);
  if (!title) return null;
  let url = './';
  if (b.url) { try { const u = new URL(String(b.url), 'https://site.invalid/aOS/'); if (u.origin === 'https://site.invalid') url = u.pathname.replace(/^\/aOS\//, './') + u.search + u.hash; } catch {} }
  return { title, body, url, tag: b.tag ? String(b.tag).slice(0, 40) : undefined };
}

// Sends to one person's phones. Phones that have let go (404/410) are forgotten.
// { sent, failed, gone }
export async function sendTo(db, env, id, msg, { fetchImpl } = {}) {
  const subs = await devices(db, id), out = { sent: 0, failed: 0, gone: 0 };
  if (!subs.length) return out;
  const vapid = await vapidKeys(db, env, { create: false });
  if (!vapid) return { ...out, failed: subs.length };
  const dead = [];
  await Promise.all(subs.map(async s => {
    let status = 0;
    try { status = await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, msg, vapid, { ttl: 86400, fetchImpl: fetchImpl || fetch }); } catch { status = 0; }
    if (status === 404 || status === 410) { out.gone++; dead.push(s.endpoint); }
    else if (status >= 200 && status < 300) out.sent++;
    else out.failed++;
  }));
  if (dead.length) await dropDevices(db, id, dead);
  return out;
}

// ---- "aOS updated to 1.x", sent by the release itself ----
// The release workflow (.github/workflows/news.yml, aOS/scripts/announce.mjs) walks these
// steps after publishing, with a key only it and the Pages project have (ANNOUNCE_KEY,
// derived by announce.mjs from the Cloudflare token, so there is nothing to set up):
//   announce/begin { version }       -> { already } for a version already announced,
//                                      { first } the very first time (it only notes the version,
//                                      so turning this on doesn't announce what everyone has),
//                                      else { people: [id, ...] } with notifications on
//   announce/send  { version, to }   -> one person's phones, like push/send
//   announce/done  { version }       -> remembered (config:announced), so a version is told once,
//                                      however many merges release it again
// One person per request, like the owner's composer, so a request never has much to encrypt.
// The same notification replaces itself on a phone (tag), if a half-finished run is repeated.
const VERSION = /^[0-9]+(\.[0-9]+)*$/;
export const announcement = version => ({ title: `aOS updated to ${version}`, body: 'Click for update details.', url: './#whats-new', tag: 'aos-update' });

async function keyOk(request, env) {
  const want = String((env && env.ANNOUNCE_KEY) || ''), got = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
  if (want.length < 32 || !got) return false;
  const h = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([h(want), h(got)]);
  return a.every((x, i) => x === b[i]);
}

// everyone still in the family who has notifications on: [id, ...]
export async function audienceIds(db) {
  const out = [];
  let cursor;
  do {
    const page = await db.list({ prefix: 'push:', cursor });
    for (const k of page.keys) {
      const id = k.name.slice(5), u = await getJSON(db, 'user:' + id);
      if (u && !u.removed && (await devices(db, id)).length) out.push({ id, name: u.name, devices: (await devices(db, id)).length });
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}

// -> { status, body }
export async function announce(db, env, request, step, b, { fetchImpl } = {}) {
  if (!env || !env.ANNOUNCE_KEY) return { status: 404, body: { error: 'not-found' } };
  if (!(await keyOk(request, env))) return { status: 403, body: { error: 'key' } };
  const version = String((b && b.version) || '');
  if (!VERSION.test(version)) return { status: 400, body: { error: 'version' } };
  const was = await db.get('config:announced');
  if (step === 'begin') {
    if (was === version) return { status: 200, body: { already: true } };
    if (was === null) { await db.put('config:announced', version); return { status: 200, body: { first: true } }; }
    return { status: 200, body: { people: await audienceIds(db) } };
  }
  if (step === 'send') {
    if (was === version) return { status: 200, body: { ok: true, sent: 0, failed: 0, gone: 0, already: true } };
    const id = String((b && b.to) || ''), u = await getJSON(db, 'user:' + id);
    if (!u || u.removed) return { status: 404, body: { error: 'unknown' } };
    return { status: 200, body: { ok: true, ...(await sendTo(db, env, id, announcement(version), { fetchImpl })) } };
  }
  if (step === 'done') { await db.put('config:announced', version); return { status: 200, body: { ok: true } }; }
  return { status: 404, body: { error: 'not-found' } };
}
