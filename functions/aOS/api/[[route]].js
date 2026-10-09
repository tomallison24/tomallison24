// /aOS/api/* - AllisonOS family accounts (passkeys). The rules and the storage
// are in server/auth.js; the apps' side is home/account.js.
//
//   GET  state            accounts on? owner set up? and, signed in, who you are
//   POST signup/begin     { name, code } (the owner, once) or { name, invite }
//   POST signup/finish    the new passkey      -> { token, user }
//   POST signin/begin                          -> a challenge
//   POST signin/finish    the passkey's proof  -> { token, user }
//   GET  home             (family) the family's Home Assistant address, for the Home app
//   POST installed        (family) { app }    -> this app was opened from your Home Screen (aOS shows Installed)
//   GET  members          (family) everyone's first name and role, for aOS's family card
//   GET  family           (owner) everyone with an account
//   POST invite           (owner) { name }     -> { token } for #invite=<token>, one use, 24 hours
//   POST remove           (owner) { id }       -> signs them out everywhere
//   POST home             (owner) { address }  -> sets it (https, origin only); blank clears it

import { reply, kv, getJSON, putJSON, rand, b64u, party, verifyRegistration, verifyAssertion, issue, sessionUser, ownerCodeOk } from '../../../server/auth.js';

const NAME = /^[\p{L}\p{N} .'’-]{1,40}$/u;
const MAX_BODY = 16 * 1024;
const pub = u => u && { id: u.id, name: u.name, role: u.role };
// the apps aOS offers (home/welcome.js APPS), for "installed"
const APPS = ['mail', 'calendar', 'news', 'weather', 'notes', 'podcasts', 'travel', 'places', 'fitness', 'house'];

async function body(request) {
  const t = await request.text();
  if (t.length > MAX_BODY) throw Object.assign(new Error('too-big'), { status: 413 });
  try { return JSON.parse(t || '{}'); } catch { throw Object.assign(new Error('bad-json'), { status: 400 }); }
}

// Everyone with an account, the owner first, then in the order they joined.
async function everyone(db) {
  const out = [];
  let cursor;
  do {
    const page = await db.list({ prefix: 'user:', cursor });
    for (const k of page.keys) { const u = await getJSON(db, k.name); if (u) out.push({ ...pub(u), created: u.created }); }
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
    return reply({ storage: true, setup: !!(await db.get('owner')), user: u && { ...pub(u), apps: u.apps || {} } });
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
        if (!(await ownerCodeOk(b.code))) return reply({ error: 'code' }, 403);
        role = 'owner';
      } else {
        invite = await getJSON(db, 'invite:' + String(b.invite || ''));
        if (!invite) return reply({ error: 'invite' }, 403);
        name = name || invite.name;
      }
      if (!NAME.test(name)) return reply({ error: 'name' }, 400);
      const id = rand(16), challenge = rand(32), user = rand(16);
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
      const user = { id: ch.user, name: ch.name, role: ch.role, creds: [cred.credId], created: Date.now(), by: ch.by };
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
      if (!user) return reply({ error: 'unknown' }, 403);   // a passkey for someone no longer in the family, or not ours
      await verifyAssertion(b, cred, ch.challenge, P);
      return reply({ token: await issue(db, user.id), user: pub(user) });
    }

    // ---- for the family ----
    if (!me) return reply({ error: 'signin' }, 401);

    // Home fills this in for a new person, so they only need their own token.
    if (route === 'home' && method === 'GET') return reply({ address: (await db.get('config:home')) || null });

    // The family, for aOS's family card: names and roles only (the owner's list has the ids).
    if (route === 'members' && method === 'GET') return reply({ members: (await everyone(db)).map(u => ({ name: u.name, role: u.role })) });

    // An app opened from your Home Screen says so (at most twice a day, from home/welcome.js).
    if (route === 'installed' && method === 'POST') {
      const app = String((await body(request)).app || '');
      if (!APPS.includes(app)) return reply({ error: 'app' }, 400);
      me.apps = Object.assign({}, me.apps, { [app]: Date.now() });
      await putJSON(db, 'user:' + me.id, me);
      return reply({ ok: true });
    }

    // ---- the owner's tools ----
    if (me.role !== 'owner') return reply({ error: 'owner-only' }, 403);

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
      for (const c of u.creds || []) await db.delete('cred:' + c);
      await db.delete('user:' + id);
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

    return reply({ error: 'not-found' }, 404);
  } catch (e) {
    return reply({ error: e.status ? e.message : 'verify', detail: e.status ? undefined : e.message }, e.status || 400);
  }
}
