// /aOS/api/* - AllisonOS family accounts (passkeys). The rules and the storage
// are in server/auth.js; the apps' side is home/account.js.
//
//   GET  state            accounts on? owner set up? the family's plan? and, signed in, who you are
//   POST signup/begin     { name, code } (the owner, once) or { name, invite }
//   POST signup/finish    the new passkey      -> { token, user }
//   POST signin/begin                          -> a challenge (signed, not stored: no KV write)
//   POST signin/finish    the passkey's proof  -> { token, user }
//   GET  home             (family) the family's Home Assistant address, for the Home app
//   POST installed        (family) { app }    -> this app was opened from your Home Screen (aOS shows Installed)
//                         { app, removed: true } -> you took it off your Home Screen (aOS shows Get)
//   POST signout-others   (family)             -> every other session of yours ends; a new token for this one
//                         { erase: true }      -> and each of those apps erases aOS's data from its phone the
//                                                 next time it opens online (GET state says erase: true)
//   POST layer            (family) { app, data } -> what that app shows in your Calendar (Notes, Travel, Fitness, Mail;
//                                                  'travelv' and 'notesv' are the Vintage designs of Travel and Notes: GET layer
//                                                  shows each as part of its app)
//   GET  layer            (family)             -> your own layers, for Calendar
//   POST handoff/want     (family)             -> you use aOS 2: GET state says carry: true to your apps for 14 days
//   POST handoff          (family) { app, data } -> what that app keeps only on this phone, waiting for aOS 2 (14 days);
//                                                  { taken: true } once aOS has taken it: no more to send
//   POST handoff/take     (family) { app }       -> { data } (or null), once: then it's deleted
//   POST move             (family) { data }      -> everything aOS keeps on this phone, for a new aOS icon (2 days)
//   POST move/take        (family)               -> { data } (or null), once: then it's deleted
//   GET  prefs            (family)               -> { prefs: { <item>: { v, at } } } your settings that follow you
//                                                  from device to device (aOS/prefs-sync.js; PREF_ITEM says which)
//   POST prefs            (family) { set: { <item>: { v, at } } } -> { prefs } each item kept when it's newer
//                                                  than the one here (v: the setting as text, null: taken away)
//   GET  push             (family) { key, devices } - the push key for this phone to subscribe with, and how many of yours are on
//   POST push/subscribe   (family) { subscription } -> this phone gets your notifications
//   POST push/unsubscribe (family) { endpoint }     -> it doesn't
//   GET  push/audience    (owner) who has notifications on, and on how many phones
//   POST push/send        (owner) { to: <id>, title, body, url? } -> one person's phones (aOS sends person by person)
//   POST announce/begin|send|done  (the release workflow only, with its key) tells the family "aOS updated to 1.x", once per version (server/push.js)
//   GET  members          (family) everyone's first name and role, for aOS's family card
//   GET  family           (owner) everyone with an account
//   POST invite           (owner) { name }     -> { token } for #invite=<token>, one use, 24 hours
//   POST remove           (owner) { id }       -> takes them out of the family completely: signed out everywhere,
//                                                 their account and everything kept for them deleted (forget)
//   POST erase            (owner) { id }       -> signs someone else out everywhere and erases aOS from their
//                                                 phones as they next open (they lost their only phone)
//   POST home             (owner) { address }  -> sets it (https, origin only); blank clears it
//   POST plan             (owner) { id } switches plan (the trial only once), { cancel: true }
//                         stops it at the end of its month, { resume: true } keeps a cancelled one

import { vapidKeys, cleanSub, devices, addDevice, dropDevices, message, sendTo, announce, audienceIds } from '../../../server/push.js';
import { reply, kv, getJSON, putJSON, rand, b64u, party, verifyRegistration, verifyAssertion, issue, sessionUser, eraseAsked, ownerCodeOk, sealChallenge, openChallenge, signOuts, signOutOthers } from '../../../server/auth.js';

const NAME = /^[\p{L}\p{N} .'’-]{1,40}$/u;
const MAX_BODY = 256 * 1024;   // a layer or a handoff can be this big; everything else is tiny
const HANDOFF_MAX = 240 * 1024, HANDOFF_DAYS = 14;   // one app's data moving into aOS 2, and how long it waits
const MOVE_MAX = 5 * 1024 * 1024, MOVE_DAYS = 2;       // all of aOS's, moving to a new aOS icon
// Settings that follow you between your devices (aOS/prefs-sync.js): Weather's places and units, Clock's
// world clocks, alarms, Bedtime, settings and recent timers, Calendar's settings, each app's design, aOS's
// look, light or dark, Favorites and your helper (Ipsy, and its name); and which Google account Mail uses, and that Gmail is connected (so
// Mail signs in to it by itself on a new device). Never a sign-in, a token or what a device keeps for itself.
export const PREF_ITEM = /^(wx\.(places|units)|allison-clock-v1#(cities|alarms|sleep|set|tsound|recents)|allison-calendar-v1-settings|mail\.hint|mail\.token\.ever|design\.[a-z]{2,16}|aos\.look|aos\.lang|aos\.home\.picks|aos\.helper|home\.settings#theme)$/;
const PREF_MAX = 64 * 1024, PREFS_MAX = 192 * 1024;
const pub = u => u && { id: u.id, name: u.name, role: u.role };
// the apps aOS offers (home/welcome.js APPS), for "installed"
const APPS = ['mail', 'calendar', 'clock', 'news', 'weather', 'notes', 'podcasts', 'travel', 'places', 'fitness', 'drinks', 'meals', 'orders', 'house', 'sparkle'];
// Calendar's layers from the other apps. On an iPhone each Home Screen app keeps its
// own storage, so Calendar can't read theirs: each app keeps a copy of just what
// Calendar shows in your own account (layer:<app>:<you>), only you can read it, and
// it's written only when it changed (KV writes are scarce on the free plan).
const LAYERS = ['notes', 'travel', 'fitness', 'mail'];
// Travel's Vintage design keeps its bookings under its own name, so the two Travel apps never overwrite each
// other; Calendar only knows Travel, so GET layer shows the two together (travelBookings).
const LAYER_APPS = [...LAYERS, 'travelv', 'notesv'];
const bookingKey = b => b && (b.id || [b.type, b.conf, b.depIso || b.dep, b.checkIn, b.pickup].join('|'));
function mergeTravel(a, b) {
  if (!b) return a;
  if (!a) return b;
  const seen = new Set(), bookings = [];
  for (const x of [...((a.data && a.data.bookings) || []), ...((b.data && b.data.bookings) || [])]) {
    const k = bookingKey(x); if (!k || seen.has(k)) continue;
    seen.add(k); bookings.push(x);
  }
  const newer = b.at > a.at ? b : a;
  return { at: newer.at, data: Object.assign({}, newer.data, { bookings }) };
}
// Notes' Vintage design the same way ('notesv'): its lists, reminders and notes join Notes', one of each id, the
// newer copy winning (the two apps can share a Google Sheet, so the same item can be in both).
const NOTE_KINDS = ['lists', 'todos', 'notes'];
const stamp = x => Number(x && (x.updated || x.at || x.created)) || 0;
function mergeNotes(a, b) {
  if (!b) return a;
  if (!a) return b;
  const data = Object.assign({}, b.at > a.at ? b.data : a.data);
  for (const k of NOTE_KINDS) {
    const by = new Map();
    for (const x of [...((a.data && a.data[k]) || []), ...((b.data && b.data[k]) || [])]) {
      if (!x || typeof x.id !== 'string') continue;
      const cur = by.get(x.id);
      if (!cur || stamp(x) > stamp(cur)) by.set(x.id, x);
    }
    data[k] = Array.from(by.values());
  }
  return { at: Math.max(a.at, b.at), data };
}
const LAYER_MAX = 192 * 1024;

// The family's subscription, just for fun (aOS -> Subscription): nothing is charged.
// Kept as config:plan { id, since, ends? }; with none yet, Pro+ since the owner joined.
// A paid plan renews each month on the day it started; cancelled, it ends on the
// next of those days. A trial ends 7 days after it started, and the family gets one
// (config:trial, when it started). Once a plan has ended, every app but aOS is
// switched off (home/welcome.js) until the owner picks a plan. Switched off is all:
// nothing anyone has saved is deleted, so it's all there when a plan starts again.
const PLANS = ['proplus', 'pro', 'trial'];
const TRIAL_MS = 7 * 864e5;
// The same day of the month, k months on (the 31st becomes the month's last day).
const addMonths = (t, k) => {
  const d = new Date(t), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + k);
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  return d.getTime();
};
export const nextRenewal = (since, now = Date.now()) => { let k = 1; while (addMonths(since, k) <= now) k++; return addMonths(since, k); };
export async function planView(db, now = Date.now()) {
  const owner = await db.get('owner'); if (!owner) return null;
  let p = await getJSON(db, 'config:plan');
  if (!p || !PLANS.includes(p.id)) { const o = await getJSON(db, 'user:' + owner); p = { id: 'proplus', since: (o && o.created) || now }; }
  const trialUsed = p.id === 'trial' || !!(await db.get('config:trial'));
  if (p.id === 'trial') return { id: p.id, since: p.since, ends: p.since + TRIAL_MS, cancelled: false, renews: null, trialUsed };
  return { id: p.id, since: p.since, ends: p.ends || null, cancelled: !!p.ends, renews: p.ends ? null : nextRenewal(p.since, now), trialUsed };
}

async function body(request, max = MAX_BODY) {
  const t = await request.text();
  if (t.length > max) throw Object.assign(new Error('too-big'), { status: 413 });
  try { return JSON.parse(t || '{}'); } catch { throw Object.assign(new Error('bad-json'), { status: 400 }); }
}

// Everyone with an account, the owner first, then in the order they joined (with anyone
// removed before removing deleted everything, marked, so the owner can remove them for good).
// Someone removed from the family, completely: their passkeys, their account (so every session of theirs
// ends with it) and everything kept for them here - apps, settings, Calendar layers, what was moving to a
// new phone or into aOS, notifications, their step sensor (freed to be linked again, functions/fitness/api)
// and Health. There's no bringing it back: inviting them again makes a new account. Today's AI counts
// (<app>:ai:<id>:<day> and the like) go by themselves in two days.
async function forget(db, u) {
  const id = u.id, keys = ['apps', 'sv', 'wipe', 'prefs', 'move', 'push', 'health', 'vitals', 'vitals-sent', 'drinks', 'handoff:want'].map(k => k + ':' + id);
  for (const a of LAYER_APPS) keys.push('layer:' + a + ':' + id);
  for (const pre of ['handoff:' + id + ':', 'handoff:taken2:' + id + ':']) {
    let cursor;
    do { const page = await db.list({ prefix: pre, cursor }); keys.push(...page.keys.map(k => k.name)); cursor = page.list_complete ? null : page.cursor; } while (cursor);
  }
  const steps = await db.get('steps:' + id);
  if (steps) keys.push('steps:by:' + steps, 'steps:' + id);
  for (const c of u.creds || []) keys.push('cred:' + c);
  await db.delete('user:' + id);   // first: whatever else fails, they're out
  for (const k of keys) await db.delete(k);
}

async function everyone(db) {
  const out = [];
  let cursor;
  do {
    const page = await db.list({ prefix: 'user:', cursor });
    for (const k of page.keys) { const u = await getJSON(db, k.name); if (u) out.push({ ...pub(u), created: u.created, removed: u.removed || null }); }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out.sort((a, b) => (a.role === 'owner' ? -1 : 0) - (b.role === 'owner' ? -1 : 0) || a.created - b.created);
}

export async function onRequest({ request, params, env }) {
  const route = [].concat(params.route || []).join('/');
  const method = request.method.toUpperCase();
  const db = kv(env);
  if (route === 'state' && method === 'GET') {
    if (!db) return reply({ storage: false, setup: false });
    const u = await sessionUser(db, request);   // your own record also says which apps you've opened from the Home Screen, and when
    const plan = await planView(db);
    // (0: you said it's gone from your Home Screen; kept as 0 so an older u.apps can't show it again)
    const apps = u ? Object.fromEntries(Object.entries({ ...(u.apps || {}), ...((await getJSON(db, 'apps:' + u.id)) || {}) }).filter(([, t]) => t > 0)) : null;
    // A session from before "Sign out and erase": the app erases aOS's data from this phone.
    const erase = !u && request.headers.has('Authorization') && await eraseAsked(db, request);
    // you use aOS 2: your apps opened from their own icons hand over what they keep only on the phone (handoff)
    const carry = !!u && !!(await db.get('handoff:want:' + u.id));
    return reply({ storage: true, setup: !!plan, plan, user: u && { ...pub(u), apps }, ...(erase ? { erase: true } : {}), ...(carry ? { carry: true } : {}) });
  }
  if (!db) return reply({ error: 'storage' }, 503);
  if (method !== 'POST' && method !== 'GET') return reply({ error: 'method' }, 405);
  try {
    const me = await sessionUser(db, request);
    const P = party(request);

    // The release tells the family a new version is out (server/push.js): its own key, no session.
    if (route.startsWith('announce/') && method === 'POST') {
      const r = await announce(db, env, request, route.slice(9), await body(request));
      return reply(r.body, r.status);
    }

    if (route === 'signup/begin' && method === 'POST') {
      const b = await body(request);
      const owner = await db.get('owner');
      let role = 'member', name = String(b.name || '').trim(), invite = null;
      if (!owner) {
        if (!(await ownerCodeOk(b.code, env))) return reply({ error: 'code' }, 403);
        role = 'owner';
      } else {
        invite = await getJSON(db, 'invite:' + String(b.invite || ''));
        if (!invite) return reply({ error: 'invite' }, 403);
        name = name || invite.name;
      }
      if (!NAME.test(name)) return reply({ error: 'name' }, 400);
      const id = rand(16), challenge = rand(32), user = rand(16);   // always someone new: a removed person's account is gone
      await putJSON(db, 'chal:' + id, { kind: 'signup', challenge, user, name, role, invite: invite ? String(b.invite) : null, by: invite ? invite.by : null }, 300);
      return reply({ id, challenge, rp: { id: P.rpId, name: 'AllisonOS' }, user: { id: user, name } });
    }

    if (route === 'signup/finish' && method === 'POST') {
      const b = await body(request);
      const ch = await getJSON(db, 'chal:' + String(b.id || ''));
      if (!ch || ch.kind !== 'signup') return reply({ error: 'expired' }, 400);
      await db.delete('chal:' + b.id);
      const cred = await verifyRegistration(b, ch.challenge, P);
      if (ch.role === 'owner' && await db.get('owner')) return reply({ error: 'owner-exists' }, 409);
      if (ch.invite && !(await db.get('invite:' + ch.invite))) return reply({ error: 'invite' }, 403);   // used meanwhile
      if (await db.get('cred:' + cred.credId)) return reply({ error: 'passkey-exists' }, 409);   // never repoint someone's passkey
      if (await db.get('user:' + ch.user)) return reply({ error: 'expired' }, 400);   // never over someone's account
      const user = { id: ch.user, name: ch.name, role: ch.role, creds: [cred.credId], created: Date.now(), by: ch.by };
      await putJSON(db, 'cred:' + cred.credId, { user: user.id, spki: cred.spki, alg: cred.alg, created: Date.now() });
      await putJSON(db, 'user:' + user.id, user);
      if (ch.invite) await db.delete('invite:' + ch.invite);
      if (ch.role === 'owner') await db.put('owner', user.id);
      return reply({ token: await issue(db, user.id, Date.now(), await signOuts(db, user.id)), user: pub(user) });
    }

    // Anyone can ask to sign in, so handing out a challenge writes nothing (KV writes are
    // scarce: a stored one would let anyone use them all up). It's signed instead, good for
    // 5 minutes, and used once: only a real passkey's sign-in writes (used:<challenge>).
    if (route === 'signin/begin' && method === 'POST') {
      const challenge = rand(32);
      return reply({ id: await sealChallenge(db, 'signin', challenge, 300), challenge, rpId: P.rpId });
    }

    if (route === 'signin/finish' && method === 'POST') {
      const b = await body(request);
      const challenge = await openChallenge(db, 'signin', b.id);
      if (!challenge) return reply({ error: 'expired' }, 400);
      const cred = await getJSON(db, 'cred:' + String(b.credId || ''));
      const user = cred && await getJSON(db, 'user:' + cred.user);
      if (!user || user.removed) return reply({ error: 'unknown' }, 403);   // a passkey for someone no longer in the family, or not ours
      await verifyAssertion(b, cred, challenge, P);
      if (await db.get('used:' + challenge)) return reply({ error: 'expired' }, 400);   // each challenge signs in once
      await db.put('used:' + challenge, '1', { expirationTtl: 300 });
      return reply({ token: await issue(db, user.id, Date.now(), await signOuts(db, user.id)), user: pub(user) });
    }

    // ---- for the family ----
    if (!me) return reply({ error: 'signin' }, 401);

    // Home fills this in for a new person, so they only need their own token.
    if (route === 'home' && method === 'GET') return reply({ address: (await db.get('config:home')) || null });

    // The family, for aOS's family card: names and roles only (the owner's list has the ids).
    if (route === 'members' && method === 'GET') return reply({ members: (await everyone(db)).filter(u => !u.removed).map(u => ({ name: u.name, role: u.role })) });

    // An app opened from your Home Screen says so (home/welcome.js); written at most twice a
    // day, but at once after it was said to be gone: by you in aOS (iOS never tells a page it
    // was removed), or by the app itself opened in Android Chrome, which can tell (androidCheck). Kept apart from the user record (apps:<id>), so it can
    // never write a removed person back.
    if (route === 'installed' && method === 'POST') {
      const b = await body(request), app = String(b.app || '');
      if (!APPS.includes(app)) return reply({ error: 'app' }, 400);
      const apps = (await getJSON(db, 'apps:' + me.id)) || {};
      if (b.removed === true) { if (!apps[app]) return reply({ ok: true }); apps[app] = 0; }   // never installed, or already gone: no write
      else { if (apps[app] > 0 && Date.now() - apps[app] < 12 * 3600e3) return reply({ ok: true }); apps[app] = Date.now(); }
      await putJSON(db, 'apps:' + me.id, apps);
      return reply({ ok: true });
    }

    // Moving into aOS 2 (home/welcome.js, "Moving into aOS"): inside aOS every app keeps its data in
    // aOS's own storage, not its Home Screen copy's. So an app opened from its own Home Screen icon
    // hands what it keeps only on the phone (alarms, saved cities, settings, Home's Home Assistant
    // sign-in) to you here, and the same app opened inside aOS takes it, once: taken, it's deleted,
    // and a mark that it was taken stops the Home Screen copy sending it again. Never taken, it's
    // gone after HANDOFF_DAYS. Only you can send or take your own.
    // aOS 2 opened, signed in: from now on (for HANDOFF_DAYS after the last time), GET state tells your
    // apps to hand over what they keep on the phone. Written at most once a week.
    // Moving to a new aOS icon (renaming aOS, or a new phone): a Home Screen icon's storage goes
    // with it when it's removed, so the old icon leaves everything here first, and the new one,
    // signed in, takes it, once. Only you can leave or take your own; never taken, it's gone
    // after MOVE_DAYS.
    if (route === 'move' && method === 'POST') {
      const b = await body(request, MOVE_MAX);
      if (!b.data || typeof b.data !== 'object' || Array.isArray(b.data)) return reply({ error: 'data' }, 400);
      await db.put('move:' + me.id, JSON.stringify(b.data), { expirationTtl: MOVE_DAYS * 86400 });
      return reply({ ok: true });
    }
    if (route === 'move/take' && method === 'POST') {
      const key = 'move:' + me.id, json = await db.get(key);
      if (!json) return reply({ data: null });
      await db.delete(key);
      return reply({ data: JSON.parse(json) });
    }
    if (route === 'prefs' && method === 'GET') return reply({ prefs: (await getJSON(db, 'prefs:' + me.id)) || {} });
    if (route === 'prefs' && method === 'POST') {
      const b = await body(request), set = b.set && typeof b.set === 'object' && !Array.isArray(b.set) ? b.set : null;
      if (!set) return reply({ error: 'data' }, 400);
      const prefs = (await getJSON(db, 'prefs:' + me.id)) || {}, now = Date.now();
      let changed = false;
      for (const [id, p] of Object.entries(set)) {
        if (!PREF_ITEM.test(id) || !p || typeof p !== 'object') continue;
        const v = p.v === null ? null : typeof p.v === 'string' && p.v.length <= PREF_MAX ? p.v : undefined;
        const at = Math.min(Math.round(+p.at) || 0, now);
        if (v === undefined || at <= 0 || (prefs[id] && prefs[id].at >= at)) continue;   // the newer one stays
        prefs[id] = { v, at }; changed = true;
      }
      if (changed) {
        if (JSON.stringify(prefs).length > PREFS_MAX) return reply({ error: 'too-big' }, 413);
        await putJSON(db, 'prefs:' + me.id, prefs);   // written only when something changed (KV writes are scarce)
      }
      return reply({ prefs });
    }
    if (route === 'handoff/want' && method === 'POST') {
      const key = 'handoff:want:' + me.id, at = +(await db.get(key)) || 0;
      if (Date.now() - at > 7 * 86400e3) await db.put(key, String(Date.now()), { expirationTtl: HANDOFF_DAYS * 86400 });
      return reply({ ok: true });
    }
    if (route === 'handoff' && method === 'POST') {
      const b = await body(request), app = String(b.app || '');
      if (!APPS.includes(app)) return reply({ error: 'app' }, 400);
      if (await db.get('handoff:taken2:' + me.id + ':' + app)) return reply({ ok: true, taken: true });
      if (!b.data || typeof b.data !== 'object' || Array.isArray(b.data) || !Object.values(b.data).every(v => typeof v === 'string')) return reply({ error: 'data' }, 400);
      const json = JSON.stringify(b.data);
      if (json.length > HANDOFF_MAX) return reply({ error: 'too-big' }, 413);
      const key = 'handoff:' + me.id + ':' + app;
      if ((await db.get(key)) === json) return reply({ ok: true, same: true });   // nothing new: no write
      await db.put(key, json, { expirationTtl: HANDOFF_DAYS * 86400 });
      return reply({ ok: true });
    }
    if (route === 'handoff/take' && method === 'POST') {
      const b = await body(request), app = String(b.app || '');
      if (!APPS.includes(app)) return reply({ error: 'app' }, 400);
      const key = 'handoff:' + me.id + ':' + app, json = await db.get(key);
      if (!json) return reply({ data: null });   // nothing yet: aOS asks again next time
      await db.put('handoff:taken2:' + me.id + ':' + app, String(Date.now()), { expirationTtl: 400 * 86400 });
      await db.delete(key);
      return reply({ data: JSON.parse(json) });
    }

    if (route === 'layer' && method === 'POST') {
      const b = await body(request);
      if (!LAYER_APPS.includes(b.app)) return reply({ error: 'app' }, 400);
      if (!b.data || typeof b.data !== 'object' || Array.isArray(b.data)) return reply({ error: 'data' }, 400);
      const json = JSON.stringify(b.data);
      if (json.length > LAYER_MAX) return reply({ error: 'too-big' }, 413);
      const key = 'layer:' + b.app + ':' + me.id, was = await getJSON(db, key);
      if (was && JSON.stringify(was.data) === json) return reply({ ok: true, same: true });   // nothing new: no write
      await putJSON(db, key, { at: Date.now(), data: b.data });
      return reply({ ok: true });
    }
    if (route === 'layer' && method === 'GET') {
      const out = {};
      for (const a of LAYERS) { const x = await getJSON(db, 'layer:' + a + ':' + me.id); if (x) out[a] = x; }
      const tv = await getJSON(db, 'layer:travelv:' + me.id);
      if (tv) out.travel = mergeTravel(out.travel, tv);
      const nv = await getJSON(db, 'layer:notesv:' + me.id);
      if (nv) out.notes = mergeNotes(out.notes, nv);
      return reply({ layers: out });
    }

    // Lost a phone? Every other session of yours ends; this device gets a fresh one. With
    // erase, each of those apps also erases aOS's data from its phone when it next opens.
    if (route === 'signout-others' && method === 'POST') {
      const sv = await signOutOthers(db, me.id, (await body(request)).erase === true);
      return reply({ token: await issue(db, me.id, Date.now(), sv), user: pub(me) });
    }

    // ---- notifications (server/push.js) ----
    if (route === 'push' && method === 'GET') {
      const k = await vapidKeys(db, env);
      return reply({ key: k && k.publicKey, devices: (await devices(db, me.id)).length });
    }
    if (route === 'push/subscribe' && method === 'POST') {
      const sub = cleanSub((await body(request)).subscription);
      if (!sub) return reply({ error: 'subscription' }, 400);
      return reply({ ok: true, devices: await addDevice(db, me.id, sub) });
    }
    if (route === 'push/unsubscribe' && method === 'POST') {
      const e = String((await body(request)).endpoint || '');
      return reply({ ok: true, devices: await dropDevices(db, me.id, [e]) });
    }

    // ---- the owner's tools ----
    if (me.role !== 'owner') return reply({ error: 'owner-only' }, 403);

    // Who has notifications on (only people still in the family), and on how many phones.
    if (route === 'push/audience' && method === 'GET') return reply({ people: await audienceIds(db) });

    // One person at a time, so a request only ever encrypts for a handful of phones.
    if (route === 'push/send' && method === 'POST') {
      const b = await body(request), msg = message(b), id = String(b.to || '');
      if (!msg) return reply({ error: 'message' }, 400);
      const u = await getJSON(db, 'user:' + id);
      if (!u || u.removed) return reply({ error: 'unknown' }, 404);
      return reply({ ok: true, ...(await sendTo(db, env, id, msg)) });
    }

    if (route === 'family' && method === 'GET') return reply({ family: await everyone(db) });

    if (route === 'invite' && method === 'POST') {
      const name = String((await body(request)).name || '').trim();
      if (!NAME.test(name)) return reply({ error: 'name' }, 400);
      const token = rand(18);
      await putJSON(db, 'invite:' + token, { name, by: me.id, at: Date.now() }, 86400);
      return reply({ token, name, hours: 24 });
    }

    if (route === 'remove' && method === 'POST') {
      const id = String((await body(request)).id || '');
      const u = await getJSON(db, 'user:' + id);
      if (!u) return reply({ error: 'unknown' }, 404);
      if (u.role === 'owner') return reply({ error: 'owner' }, 400);
      await forget(db, u);
      return reply({ ok: true });
    }

    // Someone lost their only phone: sign them out everywhere and erase aOS from it as it
    // next opens. Their account stays: they sign in again with Face ID on a new phone.
    if (route === 'erase' && method === 'POST') {
      const id = String((await body(request)).id || '');
      const u = await getJSON(db, 'user:' + id);
      if (!u || u.removed) return reply({ error: 'unknown' }, 404);
      if (id === me.id) return reply({ error: 'self' }, 400);   // your own: signout-others with erase, from this phone
      await signOutOthers(db, id, true);
      return reply({ ok: true });
    }

    if (route === 'home' && method === 'POST') {
      const a = String((await body(request)).address || '').trim();
      if (!a) { await db.delete('config:home'); return reply({ address: null }); }
      let u; try { u = new URL(a); } catch { return reply({ error: 'address' }, 400); }
      if (u.protocol !== 'https:' || u.username || u.password) return reply({ error: 'address' }, 400);
      await db.put('config:home', u.origin);
      return reply({ address: u.origin });
    }

    if (route === 'plan' && method === 'POST') {
      const b = await body(request), now = Date.now(), cur = await planView(db, now);
      if (b.id !== undefined) {
        if (!PLANS.includes(b.id)) return reply({ error: 'plan' }, 400);
        if (b.id === 'trial') {
          if (cur.trialUsed) return reply({ error: 'trial-used' }, 400);   // one trial per family
          await db.put('config:trial', String(now));
        }
        await putJSON(db, 'config:plan', { id: b.id, since: now });
      } else if (b.cancel) {
        if (cur.id === 'trial') return reply({ error: 'trial' }, 400);   // a trial ends on its own
        if (!cur.ends) await putJSON(db, 'config:plan', { id: cur.id, since: cur.since, ends: nextRenewal(cur.since, now) });
      } else if (b.resume) {
        if (cur.id === 'trial' || !cur.ends) return reply({ plan: cur });
        if (cur.ends <= now) return reply({ error: 'ended' }, 400);   // over: pick a plan again
        await putJSON(db, 'config:plan', { id: cur.id, since: cur.since });
      } else return reply({ error: 'plan' }, 400);
      return reply({ plan: await planView(db, now) });
    }

    return reply({ error: 'not-found' }, 404);
  } catch (e) {
    if (!e.status) console.error('aOS api', route, e && e.message);   // in Cloudflare's logs, not the reply
    return reply({ error: e.status ? e.message : 'verify' }, e.status || 400);
  }
}
