// Checks the family accounts' safety rules in functions/aOS/api/[[route]].js and
// server/auth.js, in plain Node on an in-memory stand-in for Workers KV, with real
// sessions and real (software) passkeys: the owner code comes only from the
// OWNER_CODE secret, the lock on Calendar and Travel's routes is closed until the
// owner exists, removing someone keeps everything of theirs and an invite back
// returns it, "installed" never rewrites the user record (so it can't bring a removed
// person back), a sign-up can't take over a passkey that's already someone's, and
// Calendar's layers are each person's own; signing in writes nothing until a real
// passkey signs, once per challenge; and "Sign out other devices" ends the others.
//   node aOS/scripts/accounts-api-test.mjs
import assert from 'assert/strict';
import { onRequest } from '../../functions/aOS/api/[[route]].js';
import { issue, putJSON, getJSON, b64u, lock } from '../../server/auth.js';

function fakeKV() {
  const m = new Map(); let stale = null;
  return {
    m, setStale(k, v) { stale = { k, v }; },
    get: async k => { if (stale && stale.k === k) { const v = stale.v; stale = null; return v; } return m.has(k) ? m.get(k) : null; },
    put: async (k, v) => { m.set(k, String(v)); },
    delete: async k => { m.delete(k); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }),
  };
}
const CODE = 'GLASS-HARBOR-71-TIDE-POOL';
let db = fakeKV(), env = { ACCOUNTS: db, OWNER_CODE: CODE };
const call = async (path, body, token, e = env) => {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const request = new Request('https://site.example/aOS/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await onRequest({ request, params: { route: path.split('/') }, env: e });
  return { status: res.status, body: await res.json() };
};
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

// A software passkey: what a phone sends for a new passkey ("none" attestation).
const KEYS = new Map();   // credName -> the software passkey's key pair, for signing in later
async function makePasskey(begin, credName) {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  if (!KEYS.has(credName)) KEYS.set(credName, kp);   // a refused take-over attempt mustn't replace the real one
  const spki = b64u(await crypto.subtle.exportKey('spki', kp.publicKey));
  const credId = new TextEncoder().encode(credName);
  const rpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('site.example')));
  const ad = new Uint8Array(55 + credId.length); ad.set(rpHash); ad[32] = 0x45; ad[53] = 0; ad[54] = credId.length; ad.set(credId, 55);
  const cd = new TextEncoder().encode(JSON.stringify({ type: 'webauthn.create', challenge: begin.challenge, origin: 'https://site.example' }));
  return { id: begin.id, credId: b64u(credId), clientDataJSON: b64u(cd), authenticatorData: b64u(ad), spki, alg: -7 };
}
// What a phone sends to sign in with a passkey: authenticatorData + the signature (DER, as phones send it).
const der = raw => { const int = b => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; b = b.slice(i); return b[0] & 0x80 ? [0, ...b] : [...b]; };
  const r = int(raw.slice(0, 32)), q = int(raw.slice(32)); return new Uint8Array([0x30, r.length + q.length + 4, 2, r.length, ...r, 2, q.length, ...q]); };
async function signIn(begin, credName) {
  const rpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('site.example')));
  const ad = new Uint8Array(37); ad.set(rpHash); ad[32] = 0x05;
  const cd = new TextEncoder().encode(JSON.stringify({ type: 'webauthn.get', challenge: begin.challenge, origin: 'https://site.example' }));
  const signed = new Uint8Array(ad.length + 32); signed.set(ad); signed.set(new Uint8Array(await crypto.subtle.digest('SHA-256', cd)), ad.length);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, KEYS.get(credName).privateKey, signed));
  return { id: begin.id, credId: b64u(new TextEncoder().encode(credName)), clientDataJSON: b64u(cd), authenticatorData: b64u(ad), signature: b64u(der(sig)) };
}
const join = async (beginBody, credName) => {
  const b = await call('signup/begin', beginBody); if (b.status !== 200) return b;
  return call('signup/finish', await makePasskey(b.body, credName));
};
const lockReq = async (token, e = env) => {
  const h = {}; if (token) h.Authorization = 'Bearer ' + token;
  const res = await lock({ request: new Request('https://site.example/calendar/api/events', { headers: h }), env: e, next: async () => new Response('through') });
  return res.status === 200 ? 'through' : (await res.json()).error;
};

await test('the lock is closed until accounts are on and the owner exists, then open only to signed-in family', async () => {
  assert.equal(await lockReq(null, {}), 'accounts-off');
  assert.equal(await lockReq(null), 'setup');
});

await test('the owner code is the OWNER_CODE secret: unset or short, nothing works; set, only it does', async () => {
  assert.equal((await call('signup/begin', { name: 'Tom', code: CODE }, null, { ACCOUNTS: db })).body.error, 'code');
  assert.equal((await call('signup/begin', { name: 'Tom', code: 'short' }, null, { ACCOUNTS: db, OWNER_CODE: 'short' })).body.error, 'code');
  assert.equal((await call('signup/begin', { name: 'Tom', code: 'WRONG-CODE-WRONG-CODE' })).body.error, 'code');
  const r = await join({ name: 'Tom', code: 'glass harbor 71 tide pool' }, 'TOMKEY');   // case and spaces don't count
  assert.equal(r.status, 200); assert.equal(r.body.user.role, 'owner');
});

const owner = await db.get('owner'), tom = await issue(db, owner);
await test('with the owner signed up, the lock lets family through and no one else', async () => {
  assert.equal(await lockReq(null), 'signin');
  assert.equal(await lockReq('nonsense.token'), 'signin');
  assert.equal(await lockReq(tom), 'through');
});

let samId, sam;
await test('an invite makes a member', async () => {
  const inv = (await call('invite', { name: 'Sam' }, tom)).body.token;
  const r = await join({ invite: inv }, 'SAMKEY');
  assert.equal(r.status, 200); samId = r.body.user.id; sam = r.body.token;
  await putJSON(db, 'drinks:' + samId, { entries: [{ id: 'd1', name: 'Beer' }] });
  assert.equal((await call('installed', { app: 'news' }, sam)).status, 200);
});

await test('"installed" is kept apart (apps:<id>) and never rewrites the user record', async () => {
  const before = db.m.get('user:' + samId);
  await call('installed', { app: 'weather' }, sam);
  assert.equal(db.m.get('user:' + samId), before);
  assert.deepEqual(Object.keys(JSON.parse(db.m.get('apps:' + samId))).sort(), ['news', 'weather']);
  assert.deepEqual(Object.keys((await call('state', undefined, sam)).body.user.apps).sort(), ['news', 'weather']);
});

await test('"Removed it?" in aOS shows Get at once; the next report from the Home Screen shows Installed again', async () => {
  const at = JSON.parse(db.m.get('apps:' + samId)).weather;
  await call('installed', { app: 'weather' }, sam);
  assert.equal(JSON.parse(db.m.get('apps:' + samId)).weather, at, 'a report within 12 hours writes nothing');
  assert.equal((await call('installed', { app: 'weather', removed: true }, sam)).status, 200);
  assert.deepEqual(Object.keys((await call('state', undefined, sam)).body.user.apps), ['news'], 'weather shows Get');
  await call('installed', { app: 'weather' }, sam);
  assert.ok(JSON.parse(db.m.get('apps:' + samId)).weather > 0, 'opened again: written at once');
  assert.deepEqual(Object.keys((await call('state', undefined, sam)).body.user.apps).sort(), ['news', 'weather']);
  assert.equal((await call('installed', { app: 'nope', removed: true }, sam)).status, 400);
});

await test('removing someone signs them out and forgets their passkey, but deletes nothing of theirs', async () => {
  const drinks = db.m.get('drinks:' + samId), apps = db.m.get('apps:' + samId);
  assert.equal((await call('remove', { id: samId }, tom)).status, 200);
  assert.equal(db.m.get('drinks:' + samId), drinks); assert.equal(db.m.get('apps:' + samId), apps);
  assert.ok(JSON.parse(db.m.get('user:' + samId)).removed);
  assert.ok(!db.m.has('cred:' + b64u(new TextEncoder().encode('SAMKEY'))));
  assert.equal((await call('members', undefined, sam)).status, 401);
  assert.equal(await lockReq(sam), 'signin');
  assert.equal((await call('state', undefined, sam)).body.user, null);
  const fam = (await call('family', undefined, tom)).body.family;
  assert.ok(fam.find(u => u.id === samId).removed, 'the owner sees them as removed');
  assert.ok(!(await call('members', undefined, tom)).body.members.some(m => m.name === 'Sam'), 'not on the family card');
});

await test('a stale read can no longer write a removed person back', async () => {
  const live = db.m.get('user:' + samId);
  db.setStale('user:' + samId, JSON.stringify({ id: samId, name: 'Sam', role: 'member', creds: [] }));   // another location still has the old copy
  await call('installed', { app: 'mail' }, sam);
  assert.equal(db.m.get('user:' + samId), live, 'the record is untouched');
  assert.equal(await lockReq(sam), 'signin');
});

await test('Invite back: only for someone removed; it brings them back with their own id and data', async () => {
  assert.equal((await call('invite', { id: owner }, tom)).status, 404);
  assert.equal((await call('invite', { id: 'nobody' }, tom)).status, 404);
  assert.equal((await call('invite', { id: samId }, sam)).status, 401);
  const inv = (await call('invite', { id: samId }, tom)).body.token;
  const r = await join({ invite: inv, name: 'Someone Else' }, 'SAMKEY2');
  assert.equal(r.status, 200); assert.equal(r.body.user.id, samId); assert.equal(r.body.user.name, 'Sam');
  const u = await getJSON(db, 'user:' + samId);
  assert.equal(u.removed, undefined); assert.deepEqual(u.creds, [b64u(new TextEncoder().encode('SAMKEY2'))]);
  assert.ok(db.m.get('drinks:' + samId).includes('Beer'), 'their Drinks log is theirs again');
  assert.equal(await lockReq(r.body.token), 'through');
});

await test('a sign-up can\'t take over a passkey that is already someone\'s', async () => {
  const inv = (await call('invite', { name: 'Eve' }, tom)).body.token;
  const r = await join({ invite: inv }, 'TOMKEY');   // the owner's passkey id
  assert.equal(r.status, 409); assert.equal(r.body.error, 'passkey-exists');
  assert.equal((await getJSON(db, 'cred:' + b64u(new TextEncoder().encode('TOMKEY')))).user, owner);
});

await test('Calendar layers: each person reads only their own, writes happen only on change, and the input is checked', async () => {
  const sent = { todos: [{ id: 't1', title: 'Dentist', date: '2026-10-20' }] };
  assert.equal((await call('layer', { app: 'notes', data: sent })).status, 401);
  assert.equal((await call('layer', { app: 'drinks', data: sent }, tom)).status, 400);
  assert.equal((await call('layer', { app: 'notes', data: [1, 2] }, tom)).status, 400);
  assert.equal((await call('layer', { app: 'notes', data: { big: 'x'.repeat(200 * 1024) } }, tom)).status, 413);
  assert.equal((await call('layer', { app: 'notes', data: sent }, tom)).body.ok, true);
  const at = JSON.parse(db.m.get('layer:notes:' + owner)).at;
  await new Promise(r => setTimeout(r, 5));
  assert.equal((await call('layer', { app: 'notes', data: sent }, tom)).body.same, true, 'unchanged: no write');
  assert.equal(JSON.parse(db.m.get('layer:notes:' + owner)).at, at);
  const mine = (await call('layer', undefined, tom)).body.layers;
  assert.deepEqual(mine.notes.data, sent);
  const theirs = (await call('layer', undefined, await issue(db, samId))).body.layers;
  assert.equal(theirs.notes, undefined, 'Sam can\'t see Tom\'s');
  assert.equal((await call('layer', undefined)).status, 401);
});

await test('asking to sign in writes nothing to KV, so no one can use up the writes', async () => {
  const before = db.m.size;
  for (let i = 0; i < 50; i++) assert.equal((await call('signin/begin', {})).status, 200);
  assert.equal(db.m.size, before);
});

await test('signing in: a real passkey works once per challenge; replays, forgeries and expired challenges don\'t', async () => {
  const b = (await call('signin/begin', {})).body;
  const proof = await signIn(b, 'TOMKEY');
  const r = await call('signin/finish', proof);
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.user.id, owner);
  assert.equal(await lockReq(r.body.token), 'through');
  assert.equal((await call('signin/finish', proof)).body.error, 'expired', 'the same proof again is refused');
  const forged = b.id.split('.')[0] + '.' + b64u(new Uint8Array(32));
  assert.equal((await call('signin/finish', { ...proof, id: forged })).body.error, 'expired', 'a challenge we didn\'t sign');
  const old = (await call('signin/begin', {})).body;
  const { sealChallenge } = await import('../../server/auth.js');
  const stale = await sealChallenge(db, 'signin', old.challenge, 300, Date.now() - 301e3);
  assert.equal((await call('signin/finish', { ...(await signIn(old, 'TOMKEY')), id: stale })).body.error, 'expired', 'over 5 minutes old');
  assert.equal(await lockReq(b.id), 'signin', 'a challenge is no session');
});

await test('Sign out other devices: every other session ends, this one gets a fresh token, the user record is untouched', async () => {
  const phone = (await call('signin/finish', await signIn((await call('signin/begin', {})).body, 'TOMKEY'))).body.token;
  const laptop = (await call('signin/finish', await signIn((await call('signin/begin', {})).body, 'TOMKEY'))).body.token;
  const rec = db.m.get('user:' + owner);
  const r = await call('signout-others', {}, laptop);
  assert.equal(r.status, 200);
  assert.equal(await lockReq(phone), 'signin', 'the other phone is signed out');
  assert.equal(await lockReq(laptop), 'signin', 'the old token on this device too');
  assert.equal(await lockReq(r.body.token), 'through', 'its fresh token works');
  assert.equal(db.m.get('user:' + owner), rec, 'kept apart from the user record');
  const again = (await call('signin/finish', await signIn((await call('signin/begin', {})).body, 'TOMKEY'))).body.token;
  assert.equal(await lockReq(again), 'through', 'signing in again afterwards works');
  assert.equal((await call('signout-others', {})).status, 401);
});

await test('unexpected errors say only "verify", not the inner message', async () => {
  const b = (await call('signin/begin', {})).body;
  const r = await call('signin/finish', { ...(await signIn(b, 'TOMKEY')), signature: 'AAAA' });
  assert.equal(r.body.detail, undefined);
});

console.log(`${n} of ${n} passed`);
