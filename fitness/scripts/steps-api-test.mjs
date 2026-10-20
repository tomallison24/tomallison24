// Checks functions/fitness/api/[[route]].js in plain Node, on an in-memory
// stand-in for Workers KV and a stand-in Home Assistant: only signed-in family
// get in (and only with the X-Fitness header); the Home Assistant token stays
// on the server; each person links their own phone's step sensor, and a phone
// linked to someone can't be linked by anyone else; you only ever read the
// phone linked to you; the owner can unlink anyone; a token that can't list
// sensors lets you type yours; removing someone from the family frees their
// phone; and each day's count comes back as the count just before its reset.
//   node fitness/scripts/steps-api-test.mjs
import assert from 'assert/strict';
import { onRequest, peaks } from '../../functions/fitness/api/[[route]].js';
import { onRequest as accounts } from '../../functions/aOS/api/[[route]].js';
import { issue, putJSON } from '../../server/auth.js';

function fakeKV() {
  const m = new Map();
  return {
    m,
    get: async k => m.has(k) ? m.get(k) : null,
    put: async (k, v) => { m.set(k, String(v)); },
    delete: async k => { m.delete(k); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }),
  };
}
const HA_TOKEN = 'made-up-home-assistant-token';
const db = fakeKV(), env = { ACCOUNTS: db, HA_TOKEN };
await db.put('owner', 'tom');
await putJSON(db, 'user:tom', { id: 'tom', name: 'Tom', role: 'owner', creds: [] });
await putJSON(db, 'user:ella', { id: 'ella', name: 'Ella', role: 'member', creds: [] });
await db.put('config:home', 'https://ha.example');
const TOM = await issue(db, 'tom'), ELLA = await issue(db, 'ella');

// Home Assistant: two phones with step sensors, and their history.
const HIST = {
  'sensor.tom_iphone_steps': [['2026-10-19T06:00:00Z', '0'], ['2026-10-19T12:00:00Z', '4000'], ['2026-10-19T23:30:00Z', '9100'], ['2026-10-20T00:10:00Z', '12'], ['2026-10-20T09:00:00Z', 'unavailable'], ['2026-10-20T10:00:00Z', '3050']],
  'sensor.ellas_iphone_steps': [['2026-10-20T10:00:00Z', '777']],
};
let canList = true;
const seen = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url), auth = (opts.headers || {}).Authorization;
  seen.push({ url: String(url), auth });
  assert.equal(u.origin, 'https://ha.example');
  if (auth !== 'Bearer ' + HA_TOKEN) return new Response('', { status: 401 });
  if (u.pathname === '/api/template') {
    if (!canList) return new Response('{"message":"Unauthorized"}', { status: 403 });
    return new Response(JSON.stringify([{ entity: 'sensor.tom_iphone_steps', name: 'Tom iPhone Steps' }, { entity: 'sensor.ellas_iphone_steps', name: 'Ella’s iPhone Steps' }, { entity: 'sensor.bad name', name: 'x' }]), { status: 200 });
  }
  if (u.pathname.startsWith('/api/states/')) return new Response(HIST[u.pathname.slice(12)] ? '{}' : '{"message":"Entity not found."}', { status: HIST[u.pathname.slice(12)] ? 200 : 404 });
  if (u.pathname.startsWith('/api/history/period/')) {
    const e = u.searchParams.get('filter_entity_id');
    assert.ok(u.searchParams.has('end_time') && u.searchParams.has('minimal_response'));
    return new Response(JSON.stringify([HIST[e].map(([t, s], i) => i ? { state: s, last_changed: t } : { entity_id: e, state: s, last_changed: t, attributes: {} })]), { status: 200 });
  }
  return new Response('', { status: 404 });
};

const call = async (path, body, token, headers = { 'X-Fitness': '1' }, e = env) => {
  const h = { 'Content-Type': 'application/json', ...headers }; if (token) h.Authorization = 'Bearer ' + token;
  const request = new Request('https://site.example/fitness/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await onRequest({ request, params: { route: path.split('?')[0].split('/') }, env: e });
  return { status: res.status, body: await res.json() };
};
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

await test('signed-in family only, and only with the X-Fitness header', async () => {
  assert.equal((await call('phones')).status, 401);
  assert.equal((await call('phones', undefined, TOM, {})).status, 400);
  assert.equal((await call('phones', undefined, 'not.a-token')).status, 401);
});

await test('lists the phones no one has linked yet; the token never leaves the server', async () => {
  const r = await call('phones', undefined, TOM);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.phones, [{ entity: 'sensor.tom_iphone_steps', name: 'Tom iPhone' }, { entity: 'sensor.ellas_iphone_steps', name: 'Ella’s iPhone' }]);
  assert.equal(r.body.linked, null);
  assert.ok(!JSON.stringify(r.body).includes(HA_TOKEN));
  assert.deepEqual(r.body.links, [], 'the owner sees who has linked what');
  assert.equal((await call('phones', undefined, ELLA)).body.links, undefined, 'a member doesn\'t');
});

await test('not linked: no steps', async () => {
  const r = await call('steps', undefined, TOM);
  assert.deepEqual([r.status, r.body.error], [404, 'not-linked']);
});

await test('link your own phone; then no one else can link it, and it leaves their list', async () => {
  assert.deepEqual((await call('link', { entity: 'sensor.tom_iphone_steps' }, TOM)).body, { linked: { entity: 'sensor.tom_iphone_steps' } });
  const taken = await call('link', { entity: 'sensor.tom_iphone_steps' }, ELLA);
  assert.deepEqual([taken.status, taken.body.error], [409, 'taken']);
  const list = await call('phones', undefined, ELLA);
  assert.deepEqual(list.body.phones.map(p => p.entity), ['sensor.ellas_iphone_steps']);
  assert.equal((await call('phones', undefined, TOM)).body.linked.name, 'Tom iPhone');
  assert.equal((await call('link', { entity: 'sensor.ellas_iphone_steps' }, ELLA)).status, 200);
});

await test('only names that are step sensors, and that exist', async () => {
  for (const entity of ['light.kitchen', 'sensor.tom_iphone_battery_level', 'sensor.x_steps/../../api/config', '']) assert.equal((await call('link', { entity }, ELLA)).body.error, 'entity', entity);
  assert.deepEqual((await call('link', { entity: 'sensor.nobody_steps' }, ELLA)).body.error, 'no-sensor');
});

await test('each person reads only their own phone: the count before each reset, and the latest', async () => {
  const t = await call('steps?days=10', undefined, TOM);
  assert.equal(t.body.entity, 'sensor.tom_iphone_steps');
  assert.deepEqual(t.body.points, [[Date.parse('2026-10-19T23:30:00Z'), 9100], [Date.parse('2026-10-20T10:00:00Z'), 3050]]);
  const e = await call('steps', undefined, ELLA);
  assert.deepEqual(e.body.points, [[Date.parse('2026-10-20T10:00:00Z'), 777]]);
  assert.ok(seen.filter(x => x.url.includes('/api/history/')).every(x => x.auth === 'Bearer ' + HA_TOKEN));
});

await test('peaks: unavailable and blank readings are skipped; an empty history is no points', () => {
  assert.deepEqual(peaks([]), []);
  assert.deepEqual(peaks([[{ state: 'unknown', last_changed: '2026-10-20T01:00:00Z' }, { state: '', last_changed: '2026-10-20T02:00:00Z' }]]), []);
  assert.deepEqual(peaks([[{ state: '5', last_changed: '2026-10-20T01:00:00Z' }, { state: '9', last_changed: '2026-10-20T02:00:00Z' }, { state: '8', last_changed: '2026-10-20T03:00:00Z' }]]), [[Date.parse('2026-10-20T02:00:00Z'), 9], [Date.parse('2026-10-20T03:00:00Z'), 8]]);
});

await test('unlinking: your own, or (the owner) anyone\'s; a member can\'t unlink someone else', async () => {
  assert.equal((await call('unlink', { id: 'tom' }, ELLA)).status, 403);
  assert.equal((await call('unlink', { id: 'ella' }, TOM)).status, 200);
  assert.equal((await call('steps', undefined, ELLA)).body.error, 'not-linked');
  assert.equal((await call('link', { entity: 'sensor.ellas_iphone_steps' }, ELLA)).status, 200);
  assert.deepEqual((await call('phones', undefined, TOM)).body.links.map(l => l.name + ':' + l.entity).sort(), ['Ella:sensor.ellas_iphone_steps', 'Tom:sensor.tom_iphone_steps']);
});

await test('a token that can\'t list sensors (not an admin\'s): type yours instead', async () => {
  canList = false;
  const r = await call('phones', undefined, ELLA);
  assert.equal(r.body.list, false);
  assert.equal(r.body.linked.entity, 'sensor.ellas_iphone_steps');
  canList = true;
});

await test('without the token or the address it says so; a wrong token is not "unreachable"', async () => {
  assert.equal((await call('steps', undefined, TOM, undefined, { ACCOUNTS: db })).body.error, 'ha-off');
  assert.equal((await call('steps', undefined, TOM, undefined, { ACCOUNTS: db, HA_TOKEN: 'wrong' })).body.error, 'ha-token');
});

await test('removing someone from the family frees their phone', async () => {
  const request = new Request('https://site.example/aOS/api/remove', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOM }, body: JSON.stringify({ id: 'ella' }) });
  assert.equal((await accounts({ request, params: { route: ['remove'] }, env })).status, 200);
  assert.equal(await db.get('steps:ella'), null);
  assert.equal(await db.get('steps:by:sensor.ellas_iphone_steps'), null);
  assert.equal(await db.get('steps:tom'), 'sensor.tom_iphone_steps');
});

console.log('\n' + n + ' tests passed');
