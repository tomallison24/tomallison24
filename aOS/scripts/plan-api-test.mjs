// Checks the family's plan in functions/aOS/api/[[route]].js (aOS -> Subscription,
// just for fun) in plain Node, on an in-memory stand-in for Workers KV with real
// sessions from server/auth.js: Pro+ since the owner joined until changed, only the
// owner changes it, a cancelled plan ends on its next monthly date, keeping it,
// a trial's 7 days, and the dates months land on.
//   node aOS/scripts/plan-api-test.mjs
import assert from 'assert/strict';
import { onRequest, nextRenewal, planView } from '../../functions/aOS/api/[[route]].js';
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
const db = fakeKV();
const env = { ACCOUNTS: db };
const call = async (path, { body, token, e = env } = {}) => {
  const h = {}; if (token) h.Authorization = 'Bearer ' + token;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const request = new Request('https://site.example/aOS/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await onRequest({ request, params: { route: path.split('/') }, env: e });
  return { status: res.status, body: await res.json() };
};
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const DAY = 864e5, U = s => Date.parse(s + 'T12:00:00Z');

await test('months: the same day each month, the 31st on the last day of shorter months', async () => {
  assert.equal(nextRenewal(U('2026-10-09'), U('2026-10-20')), U('2026-11-09'));
  assert.equal(nextRenewal(U('2026-10-09'), U('2026-11-09')), U('2026-12-09'));   // on the day: the next one
  assert.equal(nextRenewal(U('2026-01-31'), U('2026-02-01')), U('2026-02-28'));
  assert.equal(nextRenewal(U('2026-01-31'), U('2026-03-01')), U('2026-03-31'));   // back to the 31st, no drift
  assert.equal(nextRenewal(U('2026-12-15'), U('2027-01-02')), U('2027-01-15'));
});

await test('no accounts, or no owner yet: no plan, so no app is switched off', async () => {
  assert.equal((await call('state', { e: {} })).body.plan, undefined);
  const r = await call('state'); assert.equal(r.body.setup, false); assert.equal(r.body.plan, null);
});

const joined = Date.now() - 20 * DAY;
await db.put('owner', 'OWNER1');
await putJSON(db, 'user:OWNER1', { id: 'OWNER1', name: 'Tom', role: 'owner', creds: [], created: joined });
await putJSON(db, 'user:KID1', { id: 'KID1', name: 'Sam', role: 'member', creds: [] });
const tom = await issue(db, 'OWNER1'), sam = await issue(db, 'KID1');

await test('until it is changed: Pro+ since the owner joined, renewing monthly, for anyone (signed in or not)', async () => {
  const p = (await call('state')).body.plan;
  assert.equal(p.id, 'proplus'); assert.equal(p.since, joined); assert.equal(p.ends, null); assert.equal(p.cancelled, false);
  assert.equal(p.renews, nextRenewal(joined));
  assert.ok(p.renews > Date.now());
});

await test('only the owner changes it', async () => {
  assert.equal((await call('plan', { body: { id: 'pro' } })).status, 401);
  assert.equal((await call('plan', { body: { id: 'pro' }, token: sam })).status, 403);
  assert.equal((await call('plan', { body: { id: 'gold' }, token: tom })).status, 400);
  assert.equal((await call('plan', { body: {}, token: tom })).status, 400);
});

await test('cancelling a paid plan: it keeps going until its next monthly date, then ends', async () => {
  const r = await call('plan', { body: { cancel: true }, token: tom });
  assert.equal(r.status, 200);
  assert.equal(r.body.plan.id, 'proplus'); assert.equal(r.body.plan.cancelled, true);
  assert.equal(r.body.plan.ends, nextRenewal(joined)); assert.equal(r.body.plan.renews, null);
  const again = await call('plan', { body: { cancel: true }, token: tom });   // twice: the same end
  assert.equal(again.body.plan.ends, r.body.plan.ends);
  assert.equal((await call('state')).body.plan.ends, r.body.plan.ends);
});

await test('keeping a cancelled plan before it ends: renews again', async () => {
  const r = await call('plan', { body: { resume: true }, token: tom });
  assert.equal(r.body.plan.cancelled, false); assert.equal(r.body.plan.ends, null); assert.equal(r.body.plan.since, joined);
});

await test('a cancelled plan past its end stays ended: keeping it is refused, picking a plan starts afresh', async () => {
  await putJSON(db, 'config:plan', { id: 'pro', since: joined - 40 * DAY, ends: Date.now() - DAY });
  const p = (await call('state')).body.plan; assert.ok(p.ends < Date.now());
  assert.equal((await call('plan', { body: { resume: true }, token: tom })).body.error, 'ended');
  const r = await call('plan', { body: { id: 'pro' }, token: tom });
  assert.equal(r.body.plan.ends, null); assert.ok(Date.now() - r.body.plan.since < 5000);
});

await test('a trial: ends 7 days after it starts, and is not cancelled (it ends on its own)', async () => {
  const r = await call('plan', { body: { id: 'trial' }, token: tom });
  assert.equal(r.body.plan.ends, r.body.plan.since + 7 * DAY); assert.equal(r.body.plan.renews, null);
  assert.equal((await call('plan', { body: { cancel: true }, token: tom })).body.error, 'trial');
  await putJSON(db, 'config:plan', { id: 'trial', since: Date.now() - 8 * DAY });
  assert.ok((await planView(db)).ends < Date.now());
});

await test('switching plans clears a cancellation', async () => {
  await call('plan', { body: { id: 'proplus' }, token: tom });
  await call('plan', { body: { cancel: true }, token: tom });
  const r = await call('plan', { body: { id: 'pro' }, token: tom });
  assert.equal(r.body.plan.id, 'pro'); assert.equal(r.body.plan.cancelled, false); assert.equal(r.body.plan.ends, null);
});

console.log(`${n} of ${n} passed`);
