// Checks functions/sheet/api/[[route]].js, the way every app's Google Sheet is
// reached now (aOS/SHEETS.md), in plain Node: an in-memory Workers KV, and
// Fitness's real google-sheet-sync.gs on an in-memory Sheet (fake-sheet.mjs)
// standing in for Google. Signed-in family only; only the owner gives aOS a
// Sheet's link and phrase, which are checked with the script first and never
// handed back to anyone (the link to the owner only); a phone's sync is passed
// on with who's asking, so each person gets only their own rows; the owner's
// phone can move the phrase it had over to aOS once, and never over one aOS
// already has; a script from before aOS is told apart from a wrong phrase.
//   node aOS/scripts/sheet-api-test.mjs
import assert from 'assert/strict';
import { onRequest } from '../../functions/sheet/api/[[route]].js';
import { issue, putJSON } from '../../server/auth.js';
import { fakeSheet } from '../../fitness/scripts/fake-sheet.mjs';

function fakeKV() {
  const m = new Map();
  return { m, get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, String(v)); }, delete: async k => { m.delete(k); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
}
const PHRASE = 'made-up-phrase-for-tests';
const db = fakeKV(), env = { ACCOUNTS: db };
await db.put('owner', 'tom');
await putJSON(db, 'user:tom', { id: 'tom', name: 'Tom Allison', role: 'owner', creds: [] });
await putJSON(db, 'user:ella', { id: 'ella', name: 'Ella', role: 'member', creds: [] });
const TOM = await issue(db, 'tom'), ELLA = await issue(db, 'ella');

// Google: the Fitness script, at its link; an old (VERSION 2) script at another.
const sheet = fakeSheet(undefined, PHRASE);
const LINK = 'https://script.google.com/macros/s/TESTFITNESS/exec', OLD = 'https://script.google.com/macros/s/OLDSCRIPT/exec';
const seen = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url), params = Object.fromEntries(u.searchParams);
  seen.push({ path: u.origin + u.pathname, params, body: opts.body });
  if (u.origin + u.pathname === OLD) return new Response(JSON.stringify({ ok: false, app: 'allison-fitness-sync', error: 'wrong-secret' }), { status: 200 });
  if (u.origin + u.pathname !== LINK) return new Response('<html>not found</html>', { status: 404 });
  return new Response(JSON.stringify(sheet.post(opts.body, params)), { status: 200 });
};

const call = async (path, body, token, headers = { 'X-Sheet': '1' }) => {
  const h = { ...headers }; if (token) h.Authorization = 'Bearer ' + token;
  const request = new Request('https://site.example/sheet/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  const res = await onRequest({ request, params: { route: path.split('/') }, env });
  return { status: res.status, body: await res.json() };
};
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const T = Date.now(), log = (id, extra) => Object.assign({ id, date: '2026-10-05', group: 'core', exercise: 'Plank', weight: 0, reps: 45, sets: 3, timed: true, updated: T }, extra);

await test('signed-in family only, with the X-Sheet header, and only for the apps that have a Sheet', async () => {
  assert.equal((await call('fitness')).status, 401);
  assert.equal((await call('fitness', undefined, TOM, {})).status, 400);
  assert.equal((await call('weather', undefined, TOM)).status, 404);
});

await test('until the owner sets it up, a sync says so (and the owner sees the usual link to set up)', async () => {
  const r = await call('fitness', { action: 'sync' }, ELLA);
  assert.deepEqual([r.status, r.body.error], [409, 'no-sheet']);
  assert.deepEqual((await call('fitness', undefined, ELLA)).body, { configured: false });
  const o = (await call('fitness', undefined, TOM)).body;
  assert.equal(o.configured, false); assert.match(o.url, /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/);
});

await test('only the owner gives aOS a Sheet; it is checked with the script first', async () => {
  assert.equal((await call('fitness/config', { url: LINK, secret: PHRASE }, ELLA)).status, 403);
  assert.equal((await call('fitness/config', { url: 'https://evil.example/x', secret: PHRASE }, TOM)).body.error, 'url');
  assert.equal((await call('fitness/config', { url: LINK, secret: 'wrong' }, TOM)).body.error, 'wrong-secret');
  assert.equal((await call('fitness/config', { url: OLD, secret: PHRASE }, TOM)).body.error, 'old-script', 'a script from before aOS: paste the new one');
  const r = await call('fitness/config', { url: LINK, secret: PHRASE }, TOM);
  assert.deepEqual(r.body, { configured: true, url: LINK });
  assert.ok(!JSON.stringify((await call('fitness', undefined, TOM)).body).includes(PHRASE), 'the phrase never comes back');
  assert.deepEqual((await call('fitness', undefined, ELLA)).body, { configured: true }, 'and a member never sees the link');
});

await test('a sync is passed on with who is asking: each person gets their own rows', async () => {
  await call('fitness', { action: 'sync', logs: [log('t1')], graves: {} }, TOM);
  await call('fitness', { action: 'sync', logs: [log('e1')], graves: {} }, ELLA);
  assert.deepEqual((await call('fitness', { action: 'sync', graves: {} }, ELLA)).body.logs.map(x => x.id), ['e1']);
  assert.deepEqual((await call('fitness', { action: 'sync', graves: {} }, TOM)).body.logs.map(x => x.id), ['t1']);
  const last = seen[seen.length - 1];
  assert.deepEqual([last.params.key, last.params.who, last.params.name, last.params.owner], [PHRASE, 'tom', 'Tom', '1']);
  const ella = seen.filter(x => x.params.who === 'ella').pop();
  assert.equal(ella.params.owner, undefined);
  // what the phone said about itself doesn't count: who comes from its session
  assert.deepEqual((await call('fitness', { action: 'sync', graves: {}, who: 'tom', by: 'tom' }, ELLA)).body.logs.map(x => x.id), ['e1']);
});

await test('the owner\'s phone hands over the phrase it had, once; never over one aOS already has', async () => {
  await call('fitness/config', { clear: true }, TOM);
  assert.equal((await call('fitness/claim', { url: LINK, secret: PHRASE }, ELLA)).status, 403);
  assert.deepEqual((await call('fitness/claim', { url: LINK, secret: PHRASE }, TOM)).body, { configured: true, url: LINK });
  const before = db.m.get('config:sheet:fitness');
  assert.deepEqual((await call('fitness/claim', { url: OLD, secret: 'other' }, TOM)).body, { configured: true, kept: true });
  assert.equal(db.m.get('config:sheet:fitness'), before);
});

await test('Places is on Notes\' Sheet', async () => {
  await putJSON(db, 'config:sheet:notes', { url: LINK, secret: PHRASE, at: 1 });
  assert.equal((await call('places', undefined, ELLA)).body.configured, true);
  await call('places', { action: 'ping' }, ELLA);
  assert.equal(seen[seen.length - 1].params.app, 'notes');
});

console.log('\n' + n + ' tests passed');
