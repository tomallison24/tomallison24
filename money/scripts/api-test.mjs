// Checks functions/money/api/[[route]].js in plain Node, on an in-memory stand-in for Workers KV
// with real sessions from server/auth.js: the header guard, accounts off, signing in, the first
// phone to send becoming the reader, nobody else seeing anything until the reader shares it, the
// months (each sent month replacing what was there, an emptied month deleted), settings (newer
// wins), who may push, share and forget, bad input, and removing the reader or a person it was
// shared with from the family (functions/aOS/api).
//   node money/scripts/api-test.mjs
import assert from 'assert/strict';
import { onRequest, cleanTx, cleanSettings } from '../../functions/money/api/[[route]].js';
import { onRequest as accounts } from '../../functions/aOS/api/[[route]].js';
import { issue, putJSON } from '../../server/auth.js';

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
const call = async (path, { body, token, header = true, e = env } = {}) => {
  const h = {}; if (header) h['X-Money'] = '1'; if (token) h.Authorization = 'Bearer ' + token;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const request = new Request('https://site.example/money/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const res = await onRequest({ request, params: { route: path.split('?')[0].split('/') }, env: e });
  return { status: res.status, body: await res.json() };
};
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const tx = (id, date, amt, extra) => Object.assign({ id, at: Date.parse(date + 'T12:00:00Z'), date, amt, dir: 'out', merchant: 'Big Box', account: 'Rocket Credit Card', last4: '9876', cat: 'Shopping', emoji: '🛍', mid: '', src: 'alert', min: 1 }, extra);

await test('refuses requests without the app header', async () => {
  assert.equal((await call('state', { header: false })).status, 404);
});
await test('accounts off: says so', async () => {
  assert.equal((await call('state', { e: {} })).body.error, 'accounts-off');
  assert.equal((await call('state')).body.error, 'accounts-off');
});

await db.put('owner', 'OWNER1');
await putJSON(db, 'user:OWNER1', { id: 'OWNER1', name: 'Pat Example', role: 'owner', creds: [] });
await putJSON(db, 'user:SPOUSE1', { id: 'SPOUSE1', name: 'Alex Example', role: 'member', creds: [] });
await putJSON(db, 'user:KID1', { id: 'KID1', name: 'Sam', role: 'member', creds: [] });
const pat = await issue(db, 'OWNER1'), alex = await issue(db, 'SPOUSE1'), sam = await issue(db, 'KID1');

await test('signed out: asks to sign in', async () => {
  assert.equal((await call('state')).status, 401);
});
await test('no reader yet: open, and nobody can see anything', async () => {
  assert.deepEqual((await call('state', { token: alex })).body, { reader: false, can: false, open: true });
  assert.equal((await call('months?from=2026-10&to=2026-10', { token: pat })).status, 403);
  assert.equal((await call('people', { token: pat })).status, 403);
});
await test('the first phone to send becomes the reader; its months, alerts and hints are kept', async () => {
  const w0 = db.writes();
  const r = await call('push', { token: pat, body: { months: { '2026-10': [tx('a', '2026-10-06', 52.1), tx('b', '2026-10-07', 9.99, { merchant: 'Diner', foo: 'dropped' }), tx('c', '2026-09-30', 5)], '2026-09': [tx('d', '2026-09-03', 300)] },
    alerts: [{ id: 'al1', at: 1, date: '2026-10-05', inst: 'Rocket Bank', what: 'Access Expired' }, { bad: 1 }], hints: [{ name: 'Stream Box', freq: 'Monthly' }], readAt: 123 } });
  assert.equal(r.status, 200); assert.ok(r.body.months['2026-10'] && r.body.months['2026-09']);
  assert.equal(db.writes() - w0, 4, 'the share, two months and the meta');
  const s = await call('state', { token: pat });
  assert.equal(s.body.reader, true); assert.equal(s.body.can, true); assert.equal(s.body.readerName, 'Pat'); assert.deepEqual(s.body.with, []);
  assert.deepEqual(s.body.meta.alerts, [{ id: 'al1', at: 1, date: '2026-10-05', inst: 'Rocket Bank', what: 'Access Expired' }]);
  assert.deepEqual(s.body.meta.hints, [{ name: 'Stream Box', freq: 'Monthly' }]); assert.equal(s.body.meta.readAt, 123);
  const m = await call('months?from=2026-09&to=2026-11', { token: pat });
  assert.deepEqual(Object.keys(m.body.months).sort(), ['2026-09', '2026-10']);
  assert.deepEqual(m.body.months['2026-10'].map(x => x.id), ['a', 'b'], 'a transaction sent under the wrong month is dropped');
  assert.equal(m.body.months['2026-10'][1].foo, undefined, 'only its own fields');
});
await test('nobody else sees it until the reader shares it, and only who it’s shared with', async () => {
  const s = await call('state', { token: alex });
  assert.deepEqual(s.body, { reader: false, can: false, readerName: 'Pat' });
  assert.equal((await call('months?from=2026-10&to=2026-10', { token: alex })).status, 403);
  assert.equal((await call('push', { token: alex, body: { months: {} } })).status, 403, 'only the reader sends');
  const p = await call('people', { token: pat });
  assert.deepEqual(p.body.people.map(x => [x.id, x.name]).sort(), [['KID1', 'Sam'], ['SPOUSE1', 'Alex']]);
  assert.equal((await call('share', { token: alex, body: { with: ['SPOUSE1'] } })).status, 403);
  const r = await call('share', { token: pat, body: { with: ['SPOUSE1', 'NOBODY', 'OWNER1'] } });
  assert.deepEqual(r.body.with, ['SPOUSE1'], 'someone not in the family, and the reader, are left out');
  const a = await call('state', { token: alex });
  assert.equal(a.body.can, true); assert.equal(a.body.with, undefined, 'only the reader sees who it’s shared with');
  assert.deepEqual(Object.keys((await call('months?from=2026-10&to=2026-10', { token: alex })).body.months), ['2026-10']);
  assert.equal((await call('state', { token: sam })).body.can, false);
  assert.equal((await call('share', { token: pat, body: { with: 'SPOUSE1' } })).status, 400);
});
await test('a month sent again replaces it; an emptied month is deleted', async () => {
  await call('push', { token: pat, body: { months: { '2026-10': [tx('a', '2026-10-06', 52.1)], '2026-09': [] } } });
  const m = await call('months?from=2026-09&to=2026-10', { token: alex });
  assert.deepEqual(Object.keys(m.body.months), ['2026-10']); assert.equal(m.body.months['2026-10'].length, 1);
  assert.equal(db.m.has('money:tx:2026-09'), false);
  const s = await call('state', { token: pat });
  assert.equal(s.body.meta.hints.length, 1, 'alerts and hints left out of a push stay as they were');
});
await test('settings: anyone who sees it may change them; an older change doesn’t win', async () => {
  const r = await call('settings', { token: alex, body: { settings: { cards: { 'rocket credit card': { base: 3, online: 99, cap: -5 } }, online: ['Amazon', ''], dismissed: ['al1'], at: 1000 } } });
  assert.equal(r.body.ok, true);
  assert.deepEqual(r.body.settings, { cards: { 'rocket credit card': { base: 3, online: 30, grocery: 0, cap: 0 } }, online: ['Amazon'], dismissed: ['al1'], at: 1000 });
  const old = await call('settings', { token: pat, body: { settings: { cards: {}, at: 999 } } });
  assert.equal(old.body.ok, false); assert.equal(old.body.settings.at, 1000);
  assert.equal((await call('settings', { token: sam, body: { settings: { at: 2000 } } })).status, 403);
  assert.equal((await call('state', { token: pat })).body.meta.settings.dismissed[0], 'al1');
});
await test('bad input', async () => {
  assert.equal((await call('months?from=2026-10&to=2026-09', { token: pat })).status, 400);
  assert.equal((await call('months?from=2020-01&to=2026-10', { token: pat })).status, 400, 'too many months');
  assert.equal((await call('push', { token: pat, body: { months: { 'oct': [] } } })).status, 400);
  assert.equal((await call('push', { token: pat, body: '{nope' })).status, 400);
  const seven = {}; for (let i = 1; i <= 7; i++) seven['2026-0' + i] = [];
  assert.equal((await call('push', { token: pat, body: { months: seven } })).status, 400);
  assert.equal(cleanTx({ id: 'x', date: '2026-10-01', amt: -1, at: 1, dir: 'out', merchant: 'A' }), null);
  assert.equal(cleanTx({ id: 'x', date: '2026-10-01', amt: 1, at: 1, dir: 'sideways', merchant: 'A' }), null);
  assert.equal(cleanSettings(null), null);
});
await test('removing someone it was shared with takes them off the list; removing the reader deletes it all', async () => {
  const removeAs = async (token, id) => {
    const request = new Request('https://site.example/aOS/api/remove', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Origin: 'https://site.example' }, body: JSON.stringify({ id }) });
    return accounts({ request, params: { route: ['remove'] }, env });
  };
  await removeAs(pat, 'SPOUSE1');
  assert.deepEqual(JSON.parse(db.m.get('money:share')).with, []);
  // the reader leaves (here the owner removes a member who became the reader: make Sam the reader first)
  await putJSON(db, 'money:share', { by: 'KID1', with: [], at: 1 });
  await removeAs(pat, 'KID1');
  assert.deepEqual([...db.m.keys()].filter(k => k.startsWith('money:')), []);
});
await test('forget: the reader deletes everything; nobody else can', async () => {
  const pat2 = await issue(db, 'OWNER1');
  await call('push', { token: pat2, body: { months: { '2026-10': [tx('a', '2026-10-06', 1)] } } });
  assert.ok(db.m.has('money:tx:2026-10'));
  await putJSON(db, 'user:SPOUSE2', { id: 'SPOUSE2', name: 'Jo', role: 'member', creds: [] });
  const jo = await issue(db, 'SPOUSE2');
  assert.equal((await call('forget', { token: jo, body: {} })).status, 403);
  assert.equal((await call('forget', { token: pat2, body: {} })).body.ok, true);
  assert.deepEqual([...db.m.keys()].filter(k => k.startsWith('money:')), []);
});
console.log(n + ' api tests passed');
