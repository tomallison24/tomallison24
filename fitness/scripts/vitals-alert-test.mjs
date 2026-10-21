// Checks Fitness's vitals alert on the server (functions/fitness/api: POST vitals, alerts/begin and
// alerts/check) and the schedule's side (fitness/scripts/vitals-check.mjs) in plain Node, on an
// in-memory Workers KV, a stand-in Home Assistant and a stand-in push sender: even one vital off
// alerts (by the healthy range, or by the usual the phone sent); all usual doesn't; once a day at
// most and never twice for one day; turned off, no aOS notifications, removed or not linked: never;
// readings over 36 hours old never; nothing about the readings in the notification; the schedule's
// key (derived from ANNOUNCE_KEY) required; and health.js judging the same with the usual sent as
// with the days it came from. Times are relative to now, so it works on any day and at a month end.
//   node fitness/scripts/vitals-alert-test.mjs
import assert from 'assert/strict';
import { onRequest, offDay, alertsKey, cleanVitals, VITALS_ALERT } from '../../functions/fitness/api/[[route]].js';
import { issue, putJSON, getJSON } from '../../server/auth.js';
import { announceKey } from '../../aOS/scripts/announce.mjs';
import { vitalsKey, checkVitals } from './vitals-check.mjs';
const H = globalThis.FitnessHealth;

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
const HA_TOKEN = 'made-up-home-assistant-token', CF_TOKEN = 'made-up-cloudflare-token';
const db = fakeKV(), env = { ACCOUNTS: db, HA_TOKEN, ANNOUNCE_KEY: announceKey(CF_TOKEN) };
const KEY = vitalsKey(CF_TOKEN);
await db.put('owner', 'tom');
await db.put('config:home', 'https://ha.example');
// tom: one vital off; amy: all usual (until her temperature isn't); ella: alerts off; max: no aOS
// notifications; zoe: removed; ben: only an old reading; kai: not linked
const PEOPLE = { tom: 'owner', amy: 'member', ella: 'member', max: 'member', zoe: 'member', ben: 'member', kai: 'member' };
for (const [id, role] of Object.entries(PEOPLE)) {
  await putJSON(db, 'user:' + id, { id, name: id, role, creds: [], ...(id === 'zoe' ? { removed: true } : {}) });
  if (id !== 'max') await putJSON(db, 'push:' + id, { subs: [{ endpoint: 'https://web.push.apple.com/' + id, p256dh: 'x', auth: 'y', at: 1 }] });
  if (id === 'kai') continue;
  await db.put('steps:' + id, 'sensor.' + id + '_iphone_steps');
  await db.put('steps:by:sensor.' + id + '_iphone_steps', id);
}
const AMY = await issue(db, 'amy'), TOM = await issue(db, 'tom');

// The family's calendar (America/New_York), as the server keeps it.
const NY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });
const nyDay = t => NY.format(new Date(t));
const NOW = Date.now(), FRESH_T = NOW - 2 * 3600e3, OLD_T = NOW - 40 * 3600e3;
const DAY = nyDay(FRESH_T);   // the day the fresh readings fall on (today, or yesterday just after midnight)
const iso = t => new Date(t).toISOString();

// Home Assistant: each person's vitals (found by guessing their names: this token isn't an admin's)
const HIST = {};
const set = (id, slug, pts) => { HIST['sensor.' + id + '_iphone_' + slug] = pts.map(([t, s]) => [iso(t), String(s)]); };
set('tom', 'blood_oxygen', [[FRESH_T - 3600e3, 97], [FRESH_T, 93]]);   // 93%: Check (90-94)
set('tom', 'respiratory_rate', [[FRESH_T, 15]]);
set('tom', 'blood_pressure_systolic', [[FRESH_T, 115]]);
set('tom', 'blood_pressure_diastolic', [[FRESH_T, 75]]);
set('tom', 'resting_heart_rate', [[FRESH_T, 120]]);   // not a vital: never alerts here
set('amy', 'blood_oxygen', [[FRESH_T, 98]]);
set('amy', 'respiratory_rate', [[FRESH_T, 14]]);
set('amy', 'body_temperature', [[FRESH_T, 98.1]]);
set('ella', 'blood_oxygen', [[FRESH_T, 85]]);
set('zoe', 'blood_oxygen', [[FRESH_T, 85]]);
set('ben', 'blood_oxygen', [[OLD_T, 85]]);   // 40 hours ago: too old
for (const id of Object.keys(PEOPLE)) set(id, 'steps', [[FRESH_T, 100]]);
const seen = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  assert.equal(u.origin, 'https://ha.example');
  assert.equal((opts.headers || {}).Authorization, 'Bearer ' + HA_TOKEN);
  seen.push(u.pathname);
  if (u.pathname === '/api/template') return new Response('', { status: 401 });   // not an admin's token
  if (u.pathname === '/api/states') return new Response(JSON.stringify(Object.keys(HIST).map(e => ({ entity_id: e, state: '1' }))), { status: 200 });
  if (u.pathname.startsWith('/api/history/period/')) {
    const ids = u.searchParams.get('filter_entity_id').split(',');
    return new Response(JSON.stringify(ids.filter(e => HIST[e]).map(e => HIST[e].map(([t, s], i) => i ? { state: s, last_changed: t } : { entity_id: e, state: s, last_changed: t }))), { status: 200 });
  }
  return new Response('', { status: 404 });
};

// aOS's push, stood in for: what each person was sent
const pushed = [];
const push = async (_db, _env, id, msg) => { pushed.push({ id, msg }); return { sent: 1, failed: 0, gone: 0 }; };
const alerts = async (step, body, key = KEY, now = NOW) => {
  const h = { 'Content-Type': 'application/json' }; if (key) h.Authorization = 'Bearer ' + key;
  const request = new Request('https://site.example/fitness/api/alerts/' + step, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  const res = await onRequest({ request, params: { route: ['alerts', step] }, env }, undefined, { push, now });
  return { status: res.status, body: await res.json() };
};
const call = async (path, body, token) => {
  const h = { 'Content-Type': 'application/json', 'X-Fitness': '1' }; if (token) h.Authorization = 'Bearer ' + token;
  const request = new Request('https://site.example/fitness/api/' + path, { method: 'POST', headers: h, body: JSON.stringify(body) });
  const res = await onRequest({ request, params: { route: path.split('/') }, env });
  return { status: res.status, body: await res.json() };
};
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

await test('the schedule\'s key is required (derived from ANNOUNCE_KEY); without ANNOUNCE_KEY, nothing answers', async () => {
  assert.equal(KEY, await alertsKey(env.ANNOUNCE_KEY), 'the script and the server derive the same key');
  assert.equal((await alerts('begin', {}, null)).status, 403);
  assert.equal((await alerts('begin', {}, 'nope')).status, 403);
  assert.equal((await alerts('check', { to: 'tom' }, env.ANNOUNCE_KEY)).status, 403, 'the announce key itself isn\'t this key');
  assert.equal((await alerts('check', { to: 'tom' }, TOM)).status, 403, 'nor is a family session');
  const saved = env.ANNOUNCE_KEY; delete env.ANNOUNCE_KEY;
  try { assert.equal((await alerts('begin', {})).status, 404); } finally { env.ANNOUNCE_KEY = saved; }
  assert.equal(pushed.length, 0);
});

await test('POST vitals: signed in only; the switch and each vital\'s usual, cleaned', async () => {
  assert.equal((await call('vitals', { on: true, usual: {} })).status, 401);
  assert.equal((await call('vitals', { on: 'yes' }, AMY)).status, 400);
  const r = await call('vitals', { on: false, day: '2026-01-31', usual: { spo2: { lo: 96, hi: 99, mean: 97.5, far: 4 }, temp: { lo: 'x' }, hr_rest: { lo: 1, hi: 2, mean: 1.5, far: 9 } }, extra: 'dropped' }, AMY);
  assert.equal(r.status, 200);
  const kept = await getJSON(db, 'vitals:amy');
  assert.equal(kept.on, false); assert.equal(kept.day, '2026-01-31');
  assert.deepEqual(kept.usual.spo2, { lo: 96, hi: 99, mean: 97.5, far: 4 });
  assert.equal(kept.usual.temp, null, 'not numbers: no usual');
  assert.equal(kept.usual.hr_rest, undefined, 'only vitals');
  assert.equal(kept.extra, undefined);
  assert.deepEqual(Object.keys(kept.usual).sort(), H.METRICS.filter(m => m.cat === 'vitals').map(m => m.key).sort());
  await call('vitals', { on: true, day: DAY, usual: {} }, AMY);   // back on, no usual yet
});

await test('begin: only people linked, in the family, with aOS notifications on and the alert on', async () => {
  await putJSON(db, 'vitals:ella', { on: false, usual: {} });
  const r = await alerts('begin');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.people.sort(), ['amy', 'ben', 'tom']);
});

await test('one vital off (blood oxygen 93%) alerts, with nothing about it on the lock screen', async () => {
  const r = await alerts('check', { to: 'tom' });
  assert.deepEqual(r.body, { alerted: true, sent: 1, failed: 0, gone: 0 });
  assert.equal(pushed.length, 1);
  const { id, msg } = pushed[0];
  assert.equal(id, 'tom');
  assert.deepEqual(msg, { title: 'Fitness', body: 'A vital is off your usual. Open Fitness.', url: '/fitness/?view=health&day=' + DAY, tag: VITALS_ALERT.tag });
  assert.ok(!/93|oxygen|spo2/i.test(JSON.stringify(msg)), 'no number or name');
  assert.ok(!/93|oxygen|spo2/i.test(JSON.stringify(r.body)), 'nor in the answer to the schedule');
  assert.deepEqual(await getJSON(db, 'vitals-sent:tom'), { on: nyDay(NOW), day: DAY });
});

await test('once a day: a second check today sends nothing, and begin leaves them out', async () => {
  assert.deepEqual((await alerts('check', { to: 'tom' })).body, { skipped: 'already' });
  assert.ok(!(await alerts('begin')).body.people.includes('tom'));
  // a new day, but the readings are still the day already alerted about: not again
  await putJSON(db, 'vitals-sent:tom', { on: '2000-01-01', day: DAY });
  assert.deepEqual((await alerts('check', { to: 'tom' })).body, { alerted: false });
  assert.equal(pushed.length, 1);
});

await test('all usual: no alert; a reading off only against the usual the phone sent: an alert', async () => {
  assert.deepEqual((await alerts('check', { to: 'amy' })).body, { alerted: false });
  HIST['sensor.amy_iphone_body_temperature'] = [[iso(FRESH_T), '99.9']];
  assert.deepEqual((await alerts('check', { to: 'amy' })).body, { alerted: false }, 'no usual yet: temperature isn\'t judged');
  // her phone sends her usual (28 days of 98.0 ± a little), as Fitness does after a Health fetch
  const days = Array.from({ length: 28 }, (_, i) => ({ date: H.shift(DAY, -(i + 1)), m: { temp: 98 + (i % 2 ? 0.1 : -0.1) } }));
  assert.equal((await call('vitals', { on: true, day: DAY, usual: H.usualRanges(days, DAY) }, AMY)).status, 200);
  assert.deepEqual((await alerts('check', { to: 'amy' })).body, { alerted: true, sent: 1, failed: 0, gone: 0 });
  assert.equal(pushed.at(-1).id, 'amy');
});

await test('turned off, no aOS notifications, removed, not linked: never', async () => {
  for (const [id, why] of [['ella', 'off'], ['max', 'no-phones'], ['zoe', 'unknown'], ['kai', 'not-linked'], ['nobody', 'unknown']])
    assert.deepEqual((await alerts('check', { to: id })).body, { skipped: why }, id);
  assert.equal(pushed.length, 2);
});

await test('a reading over 36 hours old never alerts', async () => {
  assert.deepEqual((await alerts('check', { to: 'ben' })).body, { alerted: false });
  assert.equal(pushed.length, 2);
});

await test('offDay: today first, then yesterday; not a day already alerted; blood pressure counts once', () => {
  const ents = { spo2: 'sensor.p_blood_oxygen', bp_sys: 'sensor.p_bp_sys', bp_dia: 'sensor.p_bp_dia' };
  const today = nyDay(NOW), from = NOW - 30 * 3600e3;
  const list = (e, pts) => pts.map(([t, s], i) => i ? { state: String(s), last_changed: iso(t) } : { entity_id: e, state: String(s), last_changed: iso(t) });
  const hist = [list(ents.spo2, [[NOW - 60e3, 98]]), list(ents.bp_sys, [[NOW - 60e3, 125]]), list(ents.bp_dia, [[NOW - 60e3, 85]])];
  assert.equal(offDay(hist, ents, from, { today, now: NOW, usual: {} }), today);
  assert.equal(offDay(hist, ents, from, { today, now: NOW, usual: {}, after: today }), null);
  const all = H.statuses(today, [{ date: today, m: { spo2: 98, bp_sys: 125, bp_dia: 85 } }], { day: today });
  assert.deepEqual(H.vitalsOff(all), { n: 2, rated: 2, off: 1 }, 'the tile\'s count: blood pressure once');
  const fine = [list(ents.spo2, [[NOW - 60e3, 98]])];
  assert.equal(offDay(fine, ents, from, { today, now: NOW, usual: {} }), null);
  // yesterday's last hour (on the family's calendar) had one off, today's are fine: yesterday's, once
  let ty = NOW; while (nyDay(ty) === today) ty -= 3600e3;
  const yday = nyDay(ty), both = [list(ents.spo2, [[ty, 92], [NOW - 60e3, 98]])];
  assert.equal(offDay(both, ents, NOW - 48 * 3600e3, { today, now: NOW, usual: {} }), yday);
  assert.equal(offDay(both, ents, NOW - 48 * 3600e3, { today, now: NOW, usual: {}, after: yday }), null);
  assert.equal(offDay(both, ents, NOW - 48 * 3600e3, { today, now: ty + 37 * 3600e3, usual: {} }), null, 'over 36 hours later: too old');
});

await test('health.js judges the same with the usual sent as with the days it came from', () => {
  const day = '2028-03-02', hist = [];
  for (let i = 1; i <= 28; i++) hist.push({ date: H.shift(day, -i), m: { spo2: 97 + (i % 3) * 0.5, resp: 14 + (i % 2), temp: 98 + (i % 2 ? 0.2 : -0.2), bp_sys: 112 + (i % 4), bp_dia: 72 + (i % 3), glucose: 95 + (i % 5), vo2: 40 + (i % 2) } });
  const usual = H.usualRanges(hist, day);
  for (const m of [{ spo2: 96, resp: 22, temp: 99.4, bp_sys: 118, bp_dia: 70, glucose: 140, vo2: 33 }, { spo2: 97.5, resp: 15, temp: 98, bp_sys: 113, bp_dia: 73, glucose: 97, vo2: 40.5 }, { spo2: 89, temp: 101, glucose: 60 }]) {
    const full = hist.concat([{ date: day, m }]);
    assert.deepEqual(H.statuses(day, [{ date: day, m }], { day, usual }), H.statuses(day, full, { day }));
  }
  assert.equal(cleanVitals({ on: true, usual }).usual.temp.mean, usual.temp.mean);
});

await test('vitals-check.mjs: begin, then each person on their own; only counts in the log', async () => {
  await putJSON(db, 'vitals-sent:tom', { on: '2000-01-01', day: '2000-01-01' });
  HIST['sensor.tom_iphone_blood_oxygen'] = [[iso(FRESH_T), '91']];
  const fetchImpl = async (url, opts) => {
    const u = new URL(url), request = new Request(url, opts);
    const res = await onRequest({ request, params: { route: u.pathname.replace('/fitness/api/', '').split('/') }, env }, undefined, { push, now: NOW });
    return res;
  };
  const said = await checkVitals('https://site.example', KEY, { fetchImpl });
  assert.equal(said, 'Checked 2 people: 1 alerted');
  assert.ok(!/91|tom/i.test(said));
  assert.equal(pushed.at(-1).id, 'tom');
  await assert.rejects(checkVitals('https://site.example', 'wrong', { fetchImpl }), /begin: 403 key/);
});

console.log(`\n${n} checks passed`);
