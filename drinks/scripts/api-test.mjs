// Checks functions/drinks/api/[[route]].js in plain Node, on an in-memory
// stand-in for Workers KV with real sessions from server/auth.js, and Drinks'
// real google-sheet-sync.gs on an in-memory Sheet (fake-sheet.mjs) standing in
// for Google: the header guard, accounts off, signing in, the summary Fitness
// and Calendar read, now from the family's Sheet (each person their own days,
// asked for with aOS's phrase and who's asking, never anyone else's), no Sheet
// set up yet (no days), the Sheet unreachable or on its old script, bad input,
// that the old account sync is gone (and writes nothing), and that removing
// someone from the family keeps what they had but locks them out.
//   node drinks/scripts/api-test.mjs
import assert from 'assert/strict';
import fs from 'fs';
import vm from 'vm';
import { onRequest, clean } from '../../functions/drinks/api/[[route]].js';
import { onRequest as accounts } from '../../functions/aOS/api/[[route]].js';
import { issue, putJSON } from '../../server/auth.js';
// a forged session: a signature character changed well before the end (the last ones carry spare bits, so a change
// there can decode to the same signature)
const forge = t => t.slice(0, -6) + (t.at(-6) === 'A' ? 'B' : 'A') + t.slice(-5);
import { fakeSheet } from './fake-sheet.mjs';

vm.runInThisContext(fs.readFileSync(new URL('../calc.js', import.meta.url), 'utf8'));
const C = globalThis.DrinksCalc;

// ---- Workers KV, in memory, counting writes ----
function fakeKV() {
  const m = new Map(); let writes = 0;
  return {
    m, writes: () => writes,
    get: async k => m.has(k) ? m.get(k) : null,
    put: async (k, v) => { writes++; m.set(k, String(v)); },
    delete: async k => { m.delete(k); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }),
  };
}
const db = fakeKV();
const env = { ACCOUNTS: db };

// ---- Google: the Drinks script at its link, an old (VERSION 1) one at another, and one that's down ----
const PHRASE = 'made-up-phrase-for-tests';
const sheet = fakeSheet(undefined, PHRASE);
const LINK = 'https://script.google.com/macros/s/TESTDRINKS/exec', OLD = 'https://script.google.com/macros/s/OLDDRINKS/exec', DOWN = 'https://script.google.com/macros/s/DOWN/exec';
const seen = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url), params = Object.fromEntries(u.searchParams), at = u.origin + u.pathname;
  seen.push({ at, params, body: opts.body ? JSON.parse(opts.body) : null });
  if (at === OLD) return new Response(JSON.stringify({ ok: false, app: 'allison-drinks-sync', error: 'wrong-secret' }), { status: 200 });   // VERSION 1 wanted the phrase in the body
  if (at === DOWN) throw new TypeError('fetch failed');
  if (at !== LINK) return new Response('<html>not found</html>', { status: 404 });
  return new Response(JSON.stringify(sheet.post(opts.body, params)), { status: 200 });
};

const call = async (path, { body, token, header = true, e = env, method } = {}) => {
  const h = {}; if (header) h['X-Drinks'] = '1'; if (token) h.Authorization = 'Bearer ' + token;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const request = new Request('https://site.example/drinks/api/' + path, { method: method || (body === undefined ? 'GET' : 'POST'), headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const res = await onRequest({ request, params: { route: path.split('?')[0].split('/') }, env: e });
  return { status: res.status, body: await res.json(), headers: res.headers };
};
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

const T = Date.now() - 864e5;
const E = (id, date, extra) => Object.assign({ id, date, time: '19:00', name: 'Beer', cat: 'beer', vol: 12, unit: 'oz', abv: 5, qty: 1, note: '', updated: T }, extra);
// what aOS sends a sync with (functions/sheet/api), to put each person's drinks in the Sheet
const TOMQ = { key: PHRASE, who: 'OWNER1', name: 'Tom', owner: '1' }, SAMQ = { key: PHRASE, who: 'KID1', name: 'Sam' };
const syncAs = (q, body) => sheet.post(Object.assign({ action: 'sync', entries: [], days: [], prefs: [], graves: {} }, body), q);

await test('refuses requests without the app header', async () => {
  assert.equal((await call('summary?from=2026-10-01&to=2026-10-02', { header: false })).status, 404);
});
await test('accounts off (no storage, or no owner yet): says so', async () => {
  const r1 = await call('summary?from=2026-10-01&to=2026-10-02', { e: {} });
  assert.equal(r1.status, 503); assert.equal(r1.body.error, 'accounts-off');
  const r2 = await call('summary?from=2026-10-01&to=2026-10-02');
  assert.equal(r2.status, 503); assert.equal(r2.body.error, 'accounts-off');
});

// The family: an owner and one member.
await db.put('owner', 'OWNER1');
await putJSON(db, 'user:OWNER1', { id: 'OWNER1', name: 'Tom Allison', role: 'owner', creds: [] });
await putJSON(db, 'user:KID1', { id: 'KID1', name: 'Sam', role: 'member', creds: ['c1'] });
const tom = await issue(db, 'OWNER1'), sam = await issue(db, 'KID1');

await test('signed out, or a forged session: asks to sign in', async () => {
  assert.equal((await call('summary?from=2026-10-01&to=2026-10-02')).body.error, 'signin');
  assert.equal((await call('summary?from=2026-10-01&to=2026-10-02', { token: forge(tom) })).status, 401);
});

await test('no Sheet set up yet: no days, as if nothing were logged, and Google isn’t asked', async () => {
  const r = await call('summary?from=2026-10-01&to=2026-10-08', { token: tom });
  assert.equal(r.status, 200); assert.deepEqual(r.body, { days: {} });
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.equal(seen.length, 0);
});

await putJSON(db, 'config:sheet:drinks', { url: LINK, secret: PHRASE, at: 1 });

await test('the summary, from the family’s Sheet: each day’s standard drinks, as calc.js works them out, or its mark', async () => {
  syncAs(TOMQ, { entries: [E('w1', '2026-10-06', { cat: 'wine', vol: 5, abv: 13, qty: 2 }), E('m1', '2026-10-07', { vol: 355, unit: 'ml', abv: 12 })],
    days: [{ id: '2026-10-08', status: 'af', updated: T }, { id: '2026-10-07', status: 'af', updated: T }] });
  seen.length = 0;
  const r = await call('summary?from=2026-10-06&to=2026-10-08', { token: tom });
  assert.equal(r.status, 200);
  assert.equal(r.body.days['2026-10-06'].sd, Math.round(C.std({ vol: 5, unit: 'oz', abv: 13, qty: 2 }) * 100) / 100);
  assert.equal(r.body.days['2026-10-06'].n, 2);
  assert.equal(r.body.days['2026-10-07'].sd, 2.4, 'a drink beats an alcohol-free mark');
  assert.deepEqual(r.body.days['2026-10-08'], { status: 'af' });
  assert.equal(r.body.days['2026-10-01'], undefined, 'outside the range');
  assert.deepEqual(Object.keys(r.body), ['days'], 'the shape Fitness and Calendar read');
  // asked as aOS asks: the phrase and who's asking on the link, never in the body
  assert.equal(seen.length, 1);
  assert.equal(seen[0].at, LINK);
  assert.deepEqual(seen[0].params, { key: PHRASE, who: 'OWNER1', name: 'Tom', owner: '1', app: 'drinks' });
  assert.deepEqual(seen[0].body, { action: 'summary', from: '2026-10-06', to: '2026-10-08' });
});

await test('each person gets their own days; nobody can ask for anyone else’s', async () => {
  syncAs(SAMQ, { entries: [E('s1', '2026-10-06', { qty: 3 })] });
  seen.length = 0;
  const s = await call('summary?from=2026-10-01&to=2026-10-08', { token: sam });
  assert.deepEqual(s.body.days, { '2026-10-06': { sd: Math.round(C.std({ vol: 12, unit: 'oz', abv: 5, qty: 3 }) * 100) / 100, n: 3 } }, 'Sam’s alone');
  assert.deepEqual(seen[0].params, { key: PHRASE, who: 'KID1', name: 'Sam', app: 'drinks' }, 'no owner=1 for a member');
  const t = await call('summary?from=2026-10-01&to=2026-10-08&who=KID1', { token: tom });
  assert.equal(t.body.days['2026-10-06'].n, 2, 'Tom’s, whatever the address asks for');
  assert.equal(seen.at(-1).params.who, 'OWNER1');
});

await test('bad ranges', async () => {
  for (const q of ['from=2026-10-06', 'from=2026-10-08&to=2026-10-06', 'from=2025-01-01&to=2026-10-06', 'from=x&to=y'])
    assert.equal((await call('summary?' + q, { token: tom })).status, 400, q);
  assert.equal((await call('summary?from=2025-10-06&to=2026-10-06', { token: tom })).status, 200, 'a year (Calendar asks for 365 days)');
});

await test('the Sheet unreachable, or on its old script, or a wrong phrase: an error to try again later, not an empty week', async () => {
  for (const [url, secret, err] of [[DOWN, PHRASE, 'sheet-unreachable'], [OLD, PHRASE, 'old-script'], [LINK, 'not-the-phrase', 'wrong-secret'], ['https://script.google.com/macros/s/NOPE/exec', PHRASE, 'sheet-404']]) {
    await putJSON(db, 'config:sheet:drinks', { url, secret, at: 1 });
    const r = await call('summary?from=2026-10-06&to=2026-10-08', { token: tom });
    assert.deepEqual([r.status, r.body.error], [502, err], url);
  }
  await putJSON(db, 'config:sheet:drinks', { url: LINK, secret: PHRASE, at: 1 });
});

await test('only days, in the shape the apps read, are passed on', async () => {
  assert.deepEqual(clean({ '2026-10-01': { sd: 1.23456, n: '2', extra: 1 }, '2026-10-02': { status: 'af', x: 1 }, 'Friday': { sd: 1 }, '2026-10-03': { status: 'sober' }, '2026-10-04': null, '2026-10-05': { sd: 'NaN' } }),
    { '2026-10-01': { sd: 1.23, n: 2 }, '2026-10-02': { status: 'af' } });
  assert.deepEqual(clean(null), {});
});

await test('the old account sync is gone, and nothing writes Drinks’ log to the account any more', async () => {
  const w = db.writes();
  assert.equal((await call('sync', { body: { since: 0, entries: [E('x1', '2026-10-01')] }, token: tom })).status, 404);
  assert.equal(db.writes(), w);
  assert.ok(![...db.m.keys()].some(k => k.startsWith('drinks:')));
  assert.equal((await call('everyone', { token: tom })).status, 404);
  assert.equal((await call('summary?from=2026-10-06&to=2026-10-08', { token: tom, method: 'POST', body: {} })).status, 404, 'POST summary');
});

await test('removing someone from the family signs them out and deletes the log they had in the account from before', async () => {
  await putJSON(db, 'cred:c1', { user: 'KID1' });
  await putJSON(db, 'drinks:KID1', { v: 1, at: 1, entries: [], days: [], prefs: [], graves: {} });   // from before the Sheet
  const request = new Request('https://site.example/aOS/api/remove', { method: 'POST', headers: { Authorization: 'Bearer ' + tom, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'KID1' }) });
  const res = await accounts({ request, params: { route: ['remove'] }, env });
  assert.equal(res.status, 200);
  assert.ok(!db.m.has('drinks:KID1'), 'their old log is deleted too');
  assert.ok(!db.m.has('cred:c1'), 'their passkey is forgotten');
  assert.equal((await call('summary?from=2026-10-06&to=2026-10-08', { token: sam })).status, 401, 'and they can’t read their days');
});

await test('aOS accepts Drinks reporting itself as installed', async () => {
  const request = new Request('https://site.example/aOS/api/installed', { method: 'POST', headers: { Authorization: 'Bearer ' + tom, 'Content-Type': 'application/json' }, body: JSON.stringify({ app: 'drinks' }) });
  assert.equal((await accounts({ request, params: { route: ['installed'] }, env })).status, 200);
});

console.log(n + ' tests passed');
