// /aOS/api/* - AllisonOS family accounts (passkeys). The rules and the storage
// are in server/auth.js; the apps' side is home/account.js.
//
//   GET  state            accounts on? owner set up? the family's plan? and, signed in, who you are
//   POST signup/begin     { name, code } (the owner, once) or { name, invite }
//   POST signup/finish    the new passkey      -> { token, user }
//   POST signin/begin                          -> a challenge
//   POST signin/finish    the passkey's proof  -> { token, user }
//   GET  home             (family) the family's Home Assistant address, for the Home app
//   POST installed        (family) { app }    -> this app was opened from your Home Screen (aOS shows Installed)
//   POST layer            (family) { app, data } -> what that app shows in your Calendar (Notes, Travel, Fitness, Mail)
//   GET  layer            (family)             -> your own layers, for Calendar
//   GET  members          (family) everyone's first name and role, for aOS's family card
//   GET  family           (owner) everyone with an account
//   POST invite           (owner) { name }     -> { token } for #invite=<token>, one use, 24 hours;
//                         { id } of someone removed -> an invite that brings them back as they were
//   POST remove           (owner) { id }       -> signs them out everywhere; their data is kept
//   POST home             (owner) { address }  -> sets it (https, origin only); blank clears it
//   POST plan             (owner) { id } switches plan (the trial only once), { cancel: true }
//                         stops it at the end of its month, { resume: true } keeps a cancelled one

import { reply, kv, getJSON, putJSON, rand, b64u, party, verifyRegistration, verifyAssertion, issue, sessionUser, ownerCodeOk } from '../../../server/auth.js';

const NAME = /^[\p{L}\p{N} .'’-]{1,40}$/u;
const MAX_BODY = 256 * 1024;   // a layer can be this big; everything else is tiny
const pub = u => u && { id: u.id, name: u.name, role: u.role };
// the apps aOS offers (home/welcome.js APPS), for "installed"
const APPS = ['mail', 'calendar', 'news', 'weather', 'notes', 'podcasts', 'travel', 'places', 'fitness', 'drinks', 'house'];
// Calendar's layers from the other apps. On an iPhone each Home Screen app keeps its
// own storage, so Calendar can't read theirs: each app keeps a copy of just what
// Calendar shows in your own account (layer:<app>:<you>), only you can read it, and
// it's written only when it changed (KV writes are scarce on the free plan).
const LAYERS = ['notes', 'travel', 'fitness', 'mail'];
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

async function body(request) {
  const t = await request.text();
  if (t.length > MAX_BODY) throw Object.assign(new Error('too-big'), { status: 413 });
  try { return JSON.parse(t || '{}'); } catch { throw Object.assign(new Error('bad-json'), { status: 400 }); }
}

// Everyone with an account, the owner first, then in the order they joined
// (with removed people, marked, for the owner's list).
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
    const apps = u ? { ...(u.apps || {}), ...((await getJSON(db, 'apps:' + u.id)) || {}) } : null;
    return reply({ storage: true, setup: !!plan, plan, user: u && { ...pub(u), apps } });
  }
  if (!db) return reply({ error: 'storage' }, 503);
  if (method !== 'POST' && method !== 'GET') return reply({ error: 'method' }, 405);
  try {
    const me = await sessionUser(db, request);
    const P = party(request);

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
      // an invite back keeps the person's own id, so everything they had is theirs again
      const back = invite && invite.user ? await getJSON(db, 'user:' + invite.user) : null;
      if (invite && invite.user && !(back && back.removed)) return reply({ error: 'invite' }, 403);
      if (back) name = back.name;
      const id = rand(16), challenge = rand(32), user = back ? back.id : rand(16);
      await putJSON(db, 'chal:' + id, { kind: 'signup', challenge, user, name, role, back: !!back, invite: invite ? String(b.invite) : null, by: invite ? invite.by : null }, 300);
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
      const was = ch.back ? await getJSON(db, 'user:' + ch.user) : null;
      if (ch.back && !(was && was.removed)) return reply({ error: 'invite' }, 403);
      const user = was ? { ...was, creds: [cred.credId], removed: undefined, back: Date.now() }
        : { id: ch.user, name: ch.name, role: ch.role, creds: [cred.credId], created: Date.now(), by: ch.by };
      await putJSON(db, 'cred:' + cred.credId, { user: user.id, spki: cred.spki, alg: cred.alg, created: Date.now() });
      await putJSON(db, 'user:' + user.id, user);
      if (ch.invite) await db.delete('invite:' + ch.invite);
      if (ch.role === 'owner') await db.put('owner', user.id);
      return reply({ token: await issue(db, user.id), user: pub(user) });
    }

    if (route === 'signin/begin' && method === 'POST') {
      const id = rand(16), challenge = rand(32);
      await putJSON(db, 'chal:' + id, { kind: 'signin', challenge }, 300);
      return reply({ id, challenge, rpId: P.rpId });
    }

    if (route === 'signin/finish' && method === 'POST') {
      const b = await body(request);
      const ch = await getJSON(db, 'chal:' + String(b.id || ''));
      if (!ch || ch.kind !== 'signin') return reply({ error: 'expired' }, 400);
      await db.delete('chal:' + b.id);
      const cred = await getJSON(db, 'cred:' + String(b.credId || ''));
      const user = cred && await getJSON(db, 'user:' + cred.user);
      if (!user || user.removed) return reply({ error: 'unknown' }, 403);   // a passkey for someone no longer in the family, or not ours
      await verifyAssertion(b, cred, ch.challenge, P);
      return reply({ token: await issue(db, user.id), user: pub(user) });
    }

    // ---- for the family ----
    if (!me) return reply({ error: 'signin' }, 401);

    // Home fills this in for a new person, so they only need their own token.
    if (route === 'home' && method === 'GET') return reply({ address: (await db.get('config:home')) || null });

    // The family, for aOS's family card: names and roles only (the owner's list has the ids).
    if (route === 'members' && method === 'GET') return reply({ members: (await everyone(db)).filter(u => !u.removed).map(u => ({ name: u.name, role: u.role })) });

    // An app opened from your Home Screen says so (at most twice a day, from home/welcome.js).
    // Kept apart from the user record (apps:<id>), so it can never write a removed person back.
    if (route === 'installed' && method === 'POST') {
      const app = String((await body(request)).app || '');
      if (!APPS.includes(app)) return reply({ error: 'app' }, 400);
      const apps = (await getJSON(db, 'apps:' + me.id)) || {};
      apps[app] = Date.now();
      await putJSON(db, 'apps:' + me.id, apps);
      return reply({ ok: true });
    }

    if (route === 'layer' && method === 'POST') {
      const b = await body(request);
      if (!LAYERS.includes(b.app)) return reply({ error: 'app' }, 400);
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
      return reply({ layers: out });
    }

    // ---- the owner's tools ----
    if (me.role !== 'owner') return reply({ error: 'owner-only' }, 403);

    if (route === 'family' && method === 'GET') return reply({ family: await everyone(db) });

    if (route === 'invite' && method === 'POST') {
      const b = await body(request);
      const back = b.id ? await getJSON(db, 'user:' + String(b.id)) : null;   // inviting a removed person back
      if (b.id && !(back && back.removed)) return reply({ error: 'unknown' }, 404);
      const name = back ? back.name : String(b.name || '').trim();
      if (!NAME.test(name)) return reply({ error: 'name' }, 400);
      const token = rand(18);
      await putJSON(db, 'invite:' + token, { name, by: me.id, at: Date.now(), ...(back ? { user: back.id } : {}) }, 86400);
      return reply({ token, name, hours: 24 });
    }

    if (route === 'remove' && method === 'POST') {
      const id = String((await body(request)).id || '');
      const u = await getJSON(db, 'user:' + id);
      if (!u) return reply({ error: 'unknown' }, 404);
      if (u.role === 'owner') return reply({ error: 'owner' }, 400);
      // Signed out everywhere and their passkeys forgotten, but nothing of theirs is
      // deleted (their record, Drinks log, apps): an invite back brings it all back.
      for (const c of u.creds || []) await db.delete('cred:' + c);
      await putJSON(db, 'user:' + id, { ...u, creds: [], removed: Date.now() });
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
    return reply({ error: e.status ? e.message : 'verify', detail: e.status ? undefined : e.message }, e.status || 400);
  }
}
