// Gmail kept signed in (server/gmail.js, functions/aOS/api gmail/*), in plain Node on an in-memory stand-in for
// Workers KV, with a stand-in for Google: off until the client secret is set; the sign-in is Google's with a code
// (offline, consent), coming back to this site only; the refresh token is kept sealed (never in the KV as it is) and
// never sent to a phone; a phone gets an hour-long key, for its own person only, signed in to the family; 30 days
// after signing in it's revoked at Google and deleted; Google refusing it (a new password) deletes it; Disconnect
// revokes and deletes it; leaving the family deletes it.
//   node aOS/scripts/gmail-api-test.mjs
import assert from 'assert/strict';
import { onRequest } from '../../functions/aOS/api/[[route]].js';
import { issue, putJSON, getJSON } from '../../server/auth.js';
import { DAYS } from '../../server/gmail.js';

function fakeKV() {
  const m = new Map();
  return {
    m,
    get: async k => (m.has(k) ? m.get(k) : null),
    put: async (k, v) => { m.set(k, String(v)); },
    delete: async k => { m.delete(k); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }),
  };
}
const SITE = 'https://site.example';
const db = fakeKV();
const ON = { ACCOUNTS: db, GOOGLE_CLIENT_SECRET: 'made-up-secret' }, OFF = { ACCOUNTS: db };

// Google, made up: a code becomes RT-<n> and an hour-long key; a refresh token gives a new key unless revoked
const google = { revoked: new Set(), calls: [], refused: new Set(), n: 0 };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url), form = new URLSearchParams(opts.body || '');
  google.calls.push({ url: u, form: Object.fromEntries(form) });
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
  if (u === 'https://oauth2.googleapis.com/token') {
    assert.equal(form.get('client_secret'), 'made-up-secret');
    if (form.get('grant_type') === 'authorization_code') return form.get('code') === 'good' ? json({ access_token: 'AT-first', refresh_token: 'RT-' + (++google.n), expires_in: 3599, scope: 'https://www.googleapis.com/auth/gmail.readonly' }) : json({ error: 'invalid_grant' }, 400);
    const rt = form.get('refresh_token');
    if (google.revoked.has(rt) || google.refused.has(rt)) return json({ error: 'invalid_grant' }, 400);
    return json({ access_token: 'AT-for-' + rt.slice(3), expires_in: 3599, scope: 'https://www.googleapis.com/auth/gmail.readonly' });
  }
  if (u === 'https://oauth2.googleapis.com/revoke') { google.revoked.add(form.get('token')); return new Response('', { status: 200 }); }
  if (u === 'https://gmail.googleapis.com/gmail/v1/users/me/profile') return json({ emailAddress: opts.headers.Authorization === 'Bearer AT-first' ? 'pat@example.com' : 'x@example.com' });
  return realFetch(url, opts);
};

// the phone's cookies: gmail/start sets aos_gm (the sign-in is this phone's), gmail/back clears it
let jar = '';
const call = async (path, body, token, env = ON, query = '', cookie) => {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const c = cookie === undefined ? jar : cookie; if (c) h.Cookie = c;
  const request = new Request(SITE + '/aOS/api/' + path + query, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await onRequest({ request, params: { route: path.split('/') }, env });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
  const sc = res.headers.get('Set-Cookie') || '';
  if (sc) { const m = /aos_gm=([^;]*)/.exec(sc); jar = m && m[1] ? 'aos_gm=' + m[1] : ''; }
  return { status: res.status, body: json, location: res.headers.get('Location'), cookie: sc };
};
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

// two people in the family
await db.put('owner', 'u1');
await putJSON(db, 'user:u1', { id: 'u1', name: 'Pat', role: 'owner', created: 1 });
await putJSON(db, 'user:u2', { id: 'u2', name: 'Sam', role: 'member', created: 2 });
const pat = await issue(db, 'u1'), sam = await issue(db, 'u2');

await test('off until the client secret is set: state doesn\'t say gmail, and its routes answer off', async () => {
  assert.equal((await call('state', undefined, pat, OFF)).body.gmail, undefined);
  assert.equal((await call('gmail/start', {}, pat, OFF)).status, 404);
  assert.equal((await call('state', undefined, pat)).body.gmail, true);
});

await test('only the family: no session, no sign-in and no key', async () => {
  assert.equal((await call('gmail/start', {})).status, 401);
  assert.equal((await call('gmail/token', {})).status, 401);
});

let state = '';
await test('the sign-in is Google\'s, with a code: offline, read-only, consent, and back to this site', async () => {
  const r = await call('gmail/start', { kind: 'read', hint: 'pat@example.com', back: '/travel/?via=aos' }, pat);
  const u = new URL(r.body.url), q = u.searchParams;
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(q.get('response_type'), 'code');
  assert.equal(q.get('access_type'), 'offline');
  assert.equal(q.get('prompt'), 'consent');
  assert.equal(q.get('scope'), 'https://www.googleapis.com/auth/gmail.readonly');
  assert.equal(q.get('redirect_uri'), SITE + '/aOS/api/gmail/back');
  assert.equal(q.get('login_hint'), 'pat@example.com');
  assert.equal(q.get('include_granted_scopes'), null, 'only this kind\'s permission, not what was granted before');
  state = q.get('state'); assert.ok(state.length >= 20);
});

await test('back from Google: the refresh token is kept sealed, and the person goes back to the page they came from', async () => {
  const r = await call('gmail/back', undefined, null, ON, '?state=' + state + '&code=good');
  assert.equal(r.status, 302);
  assert.equal(r.location, SITE + '/travel/?via=aos#gmail=kept&acct=pat%40example.com');
  const kept = await getJSON(db, 'gm:u1');
  assert.equal(kept.length, 1); assert.equal(kept[0].email, 'pat@example.com');
  assert.ok(![...db.m.values()].some(v => v.includes('RT-1')), 'the refresh token is nowhere in the KV as it is');
  assert.equal(await db.get('gmst:' + state), null, 'the sign-in\'s state is used once');
  const again = await call('gmail/back', undefined, null, ON, '?state=' + state + '&code=good');
  assert.equal(again.location, SITE + '/aOS/#gmail=error', 'used twice: an error, nothing kept');
});

await test('the sign-in is the phone\'s that started it: finished elsewhere (a link sent to someone), nothing is kept', async () => {
  const r = await call('gmail/start', { back: '/travel/' }, pat);
  assert.match(r.cookie, /^aos_gm=[A-Za-z0-9_-]{20,}; Path=\/aOS\/api\/gmail; HttpOnly; Secure; SameSite=Lax; Max-Age=600$/);
  const s = new URL(r.body.url).searchParams.get('state');
  for (const other of ['', 'aos_gm=someone-elses-phone']) {
    const before = JSON.stringify(await getJSON(db, 'gm:u1'));
    const s2 = other ? new URL((await call('gmail/start', { back: '/travel/' }, pat)).body.url).searchParams.get('state') : s;
    const back = await call('gmail/back', undefined, null, ON, '?state=' + s2 + '&code=good', other);
    assert.equal(back.location, SITE + '/travel/#gmail=error', 'refused: ' + (other || 'no cookie'));
    assert.equal(JSON.stringify(await getJSON(db, 'gm:u1')), before, 'nothing kept');
  }
});

await test('back from Google goes only to a page of this site', async () => {
  for (const bad of ['//evil.example/x', 'https://evil.example/', '/\\evil']) {
    const s = new URL((await call('gmail/start', { back: bad }, pat)).body.url).searchParams.get('state');
    const r = await call('gmail/back', undefined, null, ON, '?state=' + s + '&error=access_denied');
    assert.equal(r.location, SITE + '/aOS/#gmail=error', bad);
  }
});

await test('a phone gets an hour-long key, never the refresh token; and only its own person\'s', async () => {
  const r = await call('gmail/token', { kind: 'read', email: 'pat@example.com' }, pat);
  assert.equal(r.status, 200);
  assert.equal(r.body.token, 'AT-for-1'); assert.equal(r.body.email, 'pat@example.com');
  assert.ok(r.body.exp > Date.now() + 50 * 60e3 && r.body.exp < Date.now() + 61 * 60e3);
  assert.ok(!JSON.stringify(r.body).includes('RT-1'), 'no refresh token in the answer');
  assert.ok(r.body.until > Date.now() + (DAYS - 1) * 864e5);
  const view = await call('gmail', undefined, pat);
  assert.deepEqual(view.body.accounts.map(a => a.email), ['pat@example.com']);
  assert.ok(!JSON.stringify(view.body).includes('sealed'));
  const other = await call('gmail/token', { kind: 'read', email: 'pat@example.com' }, sam);
  assert.equal(other.status, 409); assert.equal(other.body.error, 'none', 'someone else in the family gets nothing');
  const modify = await call('gmail/token', { kind: 'modify' }, pat);
  assert.equal(modify.body.error, 'none', 'a read-only sign-in never gives Mail\'s wider key');
});

await test(DAYS + ' days after signing in: revoked at Google and deleted, so the person signs in again', async () => {
  const kept = await getJSON(db, 'gm:u1'); kept[0].at = Date.now() - (DAYS + 1) * 864e5; await putJSON(db, 'gm:u1', kept);
  const r = await call('gmail/token', { kind: 'read' }, pat);
  assert.equal(r.body.error, 'expired');
  assert.ok(google.revoked.has('RT-1'), 'revoked at Google');
  assert.deepEqual(await getJSON(db, 'gm:u1'), []);
});

await test('Google refusing it (a new password, removed in Google\'s settings) deletes it', async () => {
  const s = new URL((await call('gmail/start', { back: '/school/' }, pat)).body.url).searchParams.get('state');
  await call('gmail/back', undefined, null, ON, '?state=' + s + '&code=good');
  google.refused.add('RT-2');
  assert.equal((await call('gmail/token', {}, pat)).body.error, 'revoked');
  assert.deepEqual(await getJSON(db, 'gm:u1'), []);
});

await test('Mail\'s sign-in is its own: gmail.modify with its filters scope, and its Disconnect leaves the read-only one', async () => {
  const r = new URL((await call('gmail/start', { kind: 'read', back: '/travel/' }, pat)).body.url).searchParams.get('state');
  await call('gmail/back', undefined, null, ON, '?state=' + r + '&code=good');                                  // RT-3, read-only
  const s = new URL((await call('gmail/start', { kind: 'modify', back: '/mail/' }, pat)).body.url);
  assert.equal(s.searchParams.get('scope'), 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic');
  await call('gmail/back', undefined, null, ON, '?state=' + s.searchParams.get('state') + '&code=good');      // RT-4, Mail's, now first
  assert.deepEqual((await getJSON(db, 'gm:u1')).map(x => x.kind), ['modify', 'read']);
  assert.equal((await call('gmail/token', { kind: 'read' }, pat)).body.token, 'AT-for-3', 'a reader gets the read-only one, though Mail\'s is first');
  assert.equal((await call('gmail/token', { kind: 'modify' }, pat)).body.token, 'AT-for-4');
  await call('gmail/disconnect', { email: 'pat@example.com', kind: 'modify' }, pat);
  assert.deepEqual((await getJSON(db, 'gm:u1')).map(x => x.kind), ['read'], 'only Mail\'s is gone');
  assert.ok(google.revoked.has('RT-4'), 'Mail\'s revoked at Google');
  assert.ok(!google.revoked.has('RT-3'), 'the read-only one isn\'t');
  await call('gmail/disconnect', {}, pat);
});

await test('Disconnect revokes it at Google and deletes it', async () => {
  const s = new URL((await call('gmail/start', { back: '/orders/' }, pat)).body.url).searchParams.get('state');
  await call('gmail/back', undefined, null, ON, '?state=' + s + '&code=good');
  assert.equal((await call('gmail/token', {}, pat)).body.token, 'AT-for-5');
  await call('gmail/disconnect', { email: 'pat@example.com' }, pat);
  assert.ok(google.revoked.has('RT-5'));
  assert.equal(await db.get('gm:u1'), null);
});

await test('leaving the family deletes it', async () => {
  const s = new URL((await call('gmail/start', { back: '/money/' }, sam)).body.url).searchParams.get('state');
  await call('gmail/back', undefined, null, ON, '?state=' + s + '&code=good');
  assert.ok(await db.get('gm:u2'));
  const r = await call('remove', { id: 'u2' }, pat);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(await db.get('gm:u2'), null);
});

console.log(n + ' gmail tests passed');
