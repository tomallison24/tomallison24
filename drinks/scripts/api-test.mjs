// Checks functions/drinks/api/[[route]].js in plain Node, on an in-memory
// stand-in for Workers KV with real sessions from server/auth.js: the header
// guard, accounts off, signing in, merging two phones (newer wins, graves),
// that a sync with nothing new writes nothing (KV writes are scarce on the
// free plan), that nobody can read anyone else's log, the summary for
// Calendar, bad input, and that removing someone from the family keeps it but locks them out.
//   node drinks/scripts/api-test.mjs
import assert from 'assert/strict';
import fs from 'fs';
import vm from 'vm';
import { onRequest, apply, clean } from '../../functions/drinks/api/[[route]].js';
import { onRequest as accounts } from '../../functions/aOS/api/[[route]].js';
import { issue, putJSON } from '../../server/auth.js';

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
const call = async (path, { body, token, header = true, e = env, method } = {}) => {
  const h = {}; if (header) h['X-Drinks'] = '1'; if (token) h.Authorization = 'Bearer ' + token;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const request = new Request('https://site.example/drinks/api/' + path, { method: method || (body === undefined ? 'GET' : 'POST'), headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const res = await onRequest({ request, params: { route: path.split('?')[0].split('/') }, env: e });
  return { status: res.status, body: await res.json(), headers: res.headers };
};
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

// 'updated' times are recent (graves older than 400 days are dropped).
const T = Date.now() - 864e5;
const E = (id, date, updated, extra) => Object.assign({ id, date, time: '19:00', name: 'Beer', cat: 'beer', vol: 12, unit: 'oz', abv: 5, qty: 1, note: '', updated: T + updated }, extra);

await test('refuses requests without the app header', async () => {
  assert.equal((await call('sync', { body: {}, header: false })).status, 404);
});
await test('accounts off (no storage, or no owner yet): says so, so Drinks keeps the log on the phone', async () => {
  const r1 = await call('sync', { body: {}, e: {} });
  assert.equal(r1.status, 503); assert.equal(r1.body.error, 'accounts-off');
  const r2 = await call('sync', { body: {} });
  assert.equal(r2.status, 503); assert.equal(r2.body.error, 'accounts-off');
});

// The family: an owner and one member.
await db.put('owner', 'OWNER1');
await putJSON(db, 'user:OWNER1', { id: 'OWNER1', name: 'Tom', role: 'owner', creds: [] });
await putJSON(db, 'user:KID1', { id: 'KID1', name: 'Sam', role: 'member', creds: ['c1'] });
const tom = await issue(db, 'OWNER1'), sam = await issue(db, 'KID1');

await test('signed out, or a forged session: asks to sign in', async () => {
  assert.equal((await call('sync', { body: {} })).body.error, 'signin');
  assert.equal((await call('sync', { body: {}, token: tom.slice(0, -2) + 'xx' })).status, 401);
});

let at1;
await test('first sync stores the log and sends it all back; the same again writes and sends nothing', async () => {
  const log = { since: 0, entries: [E('a1', '2026-10-01', 10), E('a2', '2026-10-02', 11, { cat: 'wine', vol: 5, abv: 13 })], days: [{ id: '2026-10-03', status: 'af', updated: T + 12 }],
    prefs: [{ id: 'goals', week: 10, day: 3, af: 3, updated: T + 13 }], graves: {} };
  const w0 = db.writes();
  const r = await call('sync', { body: log, token: tom });
  assert.equal(r.status, 200); assert.equal(r.body.full, true); assert.equal(r.body.entries.length, 2); assert.equal(r.body.days.length, 1); assert.equal(r.body.prefs[0].week, 10);
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.equal(db.writes(), w0 + 1); assert.ok(r.body.at > 0);
  at1 = r.body.at;
  const again = await call('sync', { body: Object.assign({}, log, { since: at1 }), token: tom });
  assert.deepEqual(again.body, { ok: true, at: at1 }, 'nothing new either way: just the time');
  assert.equal(db.writes(), w0 + 1, 'nothing changed, so no KV write');
  const delta = await call('sync', { body: { since: at1, entries: [E('a3', '2026-10-03', 14)] }, token: tom });
  assert.equal(delta.body.full, undefined, 'only this phone changed it: no need to send it all back');
  assert.ok(delta.body.at > at1); at1 = delta.body.at;
  assert.equal(db.writes(), w0 + 2);
});

await test('a second phone: newer copies win, a delete there removes it here, and the first phone gets it all', async () => {
  const phone2 = { since: 0, entries: [E('a1', '2026-10-01', 20, { qty: 2 }), E('b1', '2026-10-04', 21)], graves: { 'entries:a2': T + 22 } };
  const r = await call('sync', { body: phone2, token: tom });
  assert.equal(r.body.full, true);
  assert.deepEqual(r.body.entries.map(x => x.id + ':' + x.qty).sort(), ['a1:2', 'a3:1', 'b1:1']);
  assert.equal(r.body.graves['entries:a2'], T + 22);
  // The first phone, still holding the old a1 and a2, can't bring a2 back or undo the change, and hears about both.
  const r2 = await call('sync', { body: { since: at1, entries: [E('a1', '2026-10-01', 10), E('a2', '2026-10-02', 11)] }, token: tom });
  assert.equal(r2.body.full, true, 'the other phone changed it since');
  assert.deepEqual(r2.body.entries.map(x => x.id + ':' + x.qty).sort(), ['a1:2', 'a3:1', 'b1:1']);
  // But an edit made after the delete brings it back.
  const r3 = await call('sync', { body: { since: r2.body.at, entries: [E('a2', '2026-10-02', 30)] }, token: tom });
  assert.ok(r3.body.at > r2.body.at);
  const all = await call('sync', { body: { since: 0 }, token: tom });
  assert.ok(all.body.entries.some(x => x.id === 'a2'));
});

await test('each person has their own log; nobody can read anyone else’s', async () => {
  const r = await call('sync', { body: { since: 0 }, token: sam });
  assert.deepEqual(r.body.entries, []);
  await call('sync', { body: { since: 0, entries: [E('s1', '2026-10-05', 5)] }, token: sam });
  const t = await call('sync', { body: { since: 0 }, token: tom });
  assert.ok(!t.body.entries.some(x => x.id === 's1'));
  assert.ok(db.m.has('drinks:KID1') && db.m.has('drinks:OWNER1'));
});

await test('only Drinks’ own fields are kept, checked and trimmed', async () => {
  const c = clean({ entries: [
      E('ok', '2026-10-01', 1, { note: 'x'.repeat(500), extra: 'dropped', cat: 'jungle juice', unit: 'pints', time: '7pm' }),
      E('../bad', '2026-10-01', 1), E('vol0', '2026-10-01', 1, { vol: 0 }), E('abv', '2026-10-01', 1, { abv: 150 }), E('date', 'Friday', 1)],
    days: [{ id: '2026-10-01', status: 'sober' }, { id: '2026-10-02', status: 'unknown' }], prefs: [{ id: 'theme', x: 1 }],
    graves: { 'entries:ok2': 5, 'users:x': 5, 'entries:../x': 5 }, owner: 'me' });
  assert.deepEqual(c.entries.map(x => x.id), ['ok']);
  const x = c.entries[0];
  assert.equal(x.note.length, 200); assert.equal(x.extra, undefined); assert.equal(x.cat, 'other'); assert.equal(x.unit, 'oz'); assert.equal(x.time, '');
  assert.deepEqual(c.days, []);
  assert.deepEqual(c.prefs, []); assert.deepEqual(c.graves, { 'entries:ok2': 5 });
  assert.equal((await call('sync', { body: '{not json', token: tom })).status, 400);
  assert.equal((await call('sync', { body: 'x'.repeat(2 * 1024 * 1024 + 1), token: tom })).status, 413);
});

await test('graves older than 400 days are dropped', async () => {
  const now = Date.parse('2026-10-09T00:00:00Z');
  const m = apply({ graves: { 'entries:old': now - 401 * 864e5 } }, clean({ graves: { 'entries:new': now - 5 * 864e5 } }), now);
  assert.deepEqual(Object.keys(m.log.graves), ['entries:new']); assert.equal(m.changed, true);
});

await test('summary for Calendar: each day’s standard drinks, as calc.js works them out, or its mark', async () => {
  await call('sync', { body: { since: 0, entries: [E('w1', '2026-10-06', 50, { cat: 'wine', vol: 5, abv: 13, qty: 2 }), E('m1', '2026-10-07', 51, { vol: 355, unit: 'ml', abv: 12 })],
    days: [{ id: '2026-10-08', status: 'af', updated: T + 52 }, { id: '2026-10-07', status: 'af', updated: T + 53 }] }, token: tom });
  const r = await call('summary?from=2026-10-06&to=2026-10-08', { token: tom });
  assert.equal(r.status, 200);
  assert.equal(r.body.days['2026-10-06'].sd, Math.round(C.std({ vol: 5, unit: 'oz', abv: 13, qty: 2 }) * 100) / 100);
  assert.equal(r.body.days['2026-10-06'].n, 2);
  assert.equal(r.body.days['2026-10-07'].sd, 2.4, 'a drink beats an alcohol-free mark');
  assert.deepEqual(r.body.days['2026-10-08'], { status: 'af' });
  assert.equal(r.body.days['2026-10-01'], undefined, 'outside the range');
  for (const q of ['from=2026-10-06', 'from=2026-10-08&to=2026-10-06', 'from=2025-01-01&to=2026-10-06', 'from=x&to=y'])
    assert.equal((await call('summary?' + q, { token: tom })).status, 400, q);
  assert.equal((await call('summary?from=2026-10-06&to=2026-10-08')).status, 401);
});

await test('unknown routes and methods', async () => {
  assert.equal((await call('everyone', { token: tom })).status, 404);
  assert.equal((await call('sync', { token: tom })).status, 404, 'GET sync');
});

await test('removing someone from the family signs them out but keeps their Drinks log, for an invite back', async () => {
  await putJSON(db, 'cred:c1', { user: 'KID1' });
  const log = db.m.get('drinks:KID1'); assert.ok(log);
  const request = new Request('https://site.example/aOS/api/remove', { method: 'POST', headers: { Authorization: 'Bearer ' + tom, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'KID1' }) });
  const res = await accounts({ request, params: { route: ['remove'] }, env });
  assert.equal(res.status, 200);
  assert.equal(db.m.get('drinks:KID1'), log, 'their log is untouched'); assert.ok(db.m.has('drinks:OWNER1'));
  assert.ok(!db.m.has('cred:c1'), 'their passkey is forgotten');
  assert.equal((await call('sync', { body: {}, token: sam })).status, 401, 'and they are signed out');
  assert.equal((await call('summary', { token: sam })).status, 401, 'nor can they read it');
});

await test('aOS accepts Drinks reporting itself as installed', async () => {
  const request = new Request('https://site.example/aOS/api/installed', { method: 'POST', headers: { Authorization: 'Bearer ' + tom, 'Content-Type': 'application/json' }, body: JSON.stringify({ app: 'drinks' }) });
  assert.equal((await accounts({ request, params: { route: ['installed'] }, env })).status, 200);
});

console.log(n + ' tests passed');
