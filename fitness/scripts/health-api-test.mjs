// Checks Fitness's Health on the server (GET /fitness/api/health in
// functions/fitness/api/[[route]].js) in plain Node, on an in-memory Workers KV
// and a stand-in Home Assistant: finding a phone's Apple Health sensors by its
// device (an admin's token) or by guessing their names (any token); each
// person reading only their own phone's; the sums for each kind of sensor
// (a running total reset at midnight, a reading, a night's sleep, dated the
// morning it ends), unavailable readings skipped; the sensors kept in KV for a
// day; Steps reading Health Steps once it's found; and Health Steps never
// offered or linked as a phone. Dates are relative to today, so it works on any day.
//   node fitness/scripts/health-api-test.mjs
import assert from 'assert/strict';
import { onRequest, rollup, matchHealth } from '../../functions/fitness/api/[[route]].js';
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
await putJSON(db, 'user:max', { id: 'max', name: 'Max', role: 'member', creds: [] });
await db.put('config:home', 'https://ha.example');
const TOM = await issue(db, 'tom'), ELLA = await issue(db, 'ella'), MAX = await issue(db, 'max');

// The family's calendar (America/New_York), as the server keeps it.
const NY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });
const nyDay = t => NY.format(new Date(t));
const addDay = (s, n) => new Date(Date.parse(s + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const midnight = d => [4, 5].map(h => Date.parse(d + 'T0' + h + ':00:00Z')).find(t => nyDay(t) === d && nyDay(t - 1) !== d);
const TODAY = nyDay(Date.now()), YESTERDAY = addDay(TODAY, -1);
const at = (d, h, m = 0) => new Date(midnight(d) + (h * 60 + m) * 60e3).toISOString();
const FROM = new Date(midnight(YESTERDAY)).toISOString();   // days=2: yesterday's midnight

// Tom's iPhone: a device with the Health sensors on it (an admin's token lists them). His Heart
// Rate has been renamed (its id no longer ends in heart_rate), found by its name; In Bed reports hours.
const TOM_DEV = { dev: 'Tom FS iPhone', list: [
  { e: 'sensor.tom_fs_iphone_steps', n: 'Tom FS iPhone Steps', u: 'steps' },
  { e: 'sensor.tom_fs_iphone_health_steps', n: 'Tom FS iPhone Health Steps', u: 'steps' },
  { e: 'sensor.tom_fs_iphone_active_energy', n: 'Tom FS iPhone Active Energy', u: 'kcal' },
  { e: 'sensor.tom_fs_iphone_resting_heart_rate', n: 'Tom FS iPhone Resting Heart Rate', u: 'bpm' },
  { e: 'sensor.tom_pulse', n: 'Tom FS iPhone Heart Rate', u: 'bpm' },
  { e: 'sensor.tom_fs_iphone_sleep_duration', n: 'Tom FS iPhone Sleep Duration', u: 'min' },
  { e: 'sensor.tom_fs_iphone_in_bed', n: 'Tom FS iPhone In Bed', u: 'h' },
  { e: 'sensor.tom_fs_iphone_blood_oxygen', n: 'Tom FS iPhone Blood Oxygen', u: '%' },
  { e: 'sensor.tom_fs_iphone_distance', n: 'Tom FS iPhone Distance', u: 'mi' },
  { e: 'sensor.tom_fs_iphone_battery_level', n: 'Tom FS iPhone Battery Level', u: '%' },
] };
const HIST = {
  // steps: the reading standing at midnight (yesterday's, before the reset) is left out
  'sensor.tom_fs_iphone_health_steps': [[FROM, '9999'], [at(YESTERDAY, 8), '3000'], [at(YESTERDAY, 23, 40), '11200'], [at(TODAY, 0, 20), '15'], [at(TODAY, 0, 50), 'unavailable'], [at(TODAY, 1), '4200']],
  'sensor.tom_fs_iphone_steps': [[at(TODAY, 1), '3900']],
  'sensor.tom_fs_iphone_active_energy': [[at(YESTERDAY, 12), '310.6'], [at(YESTERDAY, 22), '645.2'], [at(TODAY, 1), '20']],
  'sensor.tom_pulse': [[FROM, '50'], [at(YESTERDAY, 9), '60'], [at(YESTERDAY, 10), '80'], [at(TODAY, 0, 30), 'unknown'], [at(TODAY, 1), '66']],
  'sensor.tom_fs_iphone_resting_heart_rate': [[at(YESTERDAY, 7), '55'], [at(YESTERDAY, 20), '52']],
  // a night: in the morning (yesterday's night), back to 0 at 18:00, part of last night at 23:00 and early this morning
  'sensor.tom_fs_iphone_sleep_duration': [[FROM, '380'], [at(YESTERDAY, 7), '400'], [at(YESTERDAY, 18, 5), '0'], [at(YESTERDAY, 23), '30'], [at(TODAY, 1, 30), '95']],
  'sensor.tom_fs_iphone_in_bed': [[at(TODAY, 1, 30), '2']],
  'sensor.tom_fs_iphone_blood_oxygen': [[at(YESTERDAY, 3), 'unavailable'], [at(TODAY, 1), 'unavailable']],
  // Ella's phone, found by guessing (her token can't list a device's sensors)
  'sensor.ellas_iphone_steps': [[at(TODAY, 1), '700']],
  'sensor.ellas_iphone_health_steps': [[at(TODAY, 1), '777']],
  'sensor.ellas_iphone_heart_rate_variability': [[at(YESTERDAY, 6), '48'], [at(YESTERDAY, 9), '41']],
  'sensor.ellas_iphone_vo2_max': [[at(YESTERDAY, 9), '38.46']],
};
const STATES = Object.keys(HIST).filter(e => e.startsWith('sensor.ellas_')).concat(Object.keys(HIST).filter(e => e.startsWith('sensor.tom_'))).concat(['sensor.ellas_iphone_heart_rate_zone']);   // not Heart Rate: a name that only starts like it
let admin = true;
const seen = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url), auth = (opts.headers || {}).Authorization;
  seen.push({ path: u.pathname, ids: u.searchParams.get('filter_entity_id'), template: opts.body && JSON.parse(opts.body).template, from: decodeURIComponent(u.pathname.split('/').pop()) });
  assert.equal(u.origin, 'https://ha.example');
  if (auth !== 'Bearer ' + HA_TOKEN) return new Response('', { status: 401 });
  if (u.pathname === '/api/template') {
    if (!admin) return new Response('', { status: 401 });   // Home Assistant's require_admin
    const t = JSON.parse(opts.body).template;
    if (t.includes('device_entities')) return new Response(JSON.stringify(t.includes("device_id('sensor.tom_fs_iphone_steps')") ? TOM_DEV : { dev: '', list: [] }), { status: 200 });
    return new Response(JSON.stringify([{ entity: 'sensor.tom_fs_iphone_steps', name: 'Tom FS iPhone Steps' }, { entity: 'sensor.tom_fs_iphone_health_steps', name: 'Tom FS iPhone Health Steps' }, { entity: 'sensor.ellas_iphone_steps', name: 'Ella’s iPhone Steps' }]), { status: 200 });
  }
  if (u.pathname === '/api/states') return new Response(JSON.stringify(STATES.map(e => ({ entity_id: e, state: '1', attributes: {} }))), { status: 200 });
  if (u.pathname.startsWith('/api/states/')) return new Response('{}', { status: HIST[u.pathname.slice(12)] ? 200 : 404 });
  if (u.pathname.startsWith('/api/history/period/')) {
    assert.ok(u.searchParams.has('end_time') && u.searchParams.has('minimal_response') && u.searchParams.has('no_attributes'));
    assert.equal(u.searchParams.get('significant_changes_only'), '0');
    const ids = u.searchParams.get('filter_entity_id').split(',');
    return new Response(JSON.stringify(ids.filter(e => HIST[e]).map(e => HIST[e].map(([t, s], i) => i ? { state: s, last_changed: t } : { entity_id: e, state: s, last_changed: t }))), { status: 200 });
  }
  return new Response('', { status: 404 });
};

const call = async (path, body, token) => {
  const h = { 'Content-Type': 'application/json', 'X-Fitness': '1' }; if (token) h.Authorization = 'Bearer ' + token;
  const request = new Request('https://site.example/fitness/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await onRequest({ request, params: { route: path.split('?')[0].split('/') }, env });
  return { status: res.status, body: await res.json() };
};
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

await test('signed in, linked, and only with the X-Fitness header', async () => {
  assert.equal((await call('health')).status, 401);
  const r = await call('health', undefined, MAX);
  assert.deepEqual([r.status, r.body.error], [404, 'not-linked']);
});

await test('Health Steps is never offered or linked as a phone', async () => {
  const r = await call('phones', undefined, TOM);
  assert.deepEqual(r.body.phones.map(p => p.entity), ['sensor.tom_fs_iphone_steps', 'sensor.ellas_iphone_steps']);
  assert.equal((await call('link', { entity: 'sensor.tom_fs_iphone_health_steps' }, TOM)).body.error, 'entity');
  assert.equal((await call('link', { entity: 'sensor.tom_fs_iphone_steps' }, TOM)).status, 200);
  assert.equal((await call('link', { entity: 'sensor.ellas_iphone_steps' }, ELLA)).status, 200);
});

await test('found by the phone\'s device, matched by name; summed into days', async () => {
  seen.length = 0;
  const r = await call('health?days=2', undefined, TOM);
  assert.equal(r.status, 200);
  const sorted = o => Object.entries(o).sort((a, b) => a[0].localeCompare(b[0]));
  assert.deepEqual(sorted(r.body.entities), sorted({ steps: 'sensor.tom_fs_iphone_health_steps', active_kcal: 'sensor.tom_fs_iphone_active_energy', hr: 'sensor.tom_pulse',
    hr_rest: 'sensor.tom_fs_iphone_resting_heart_rate', sleep: 'sensor.tom_fs_iphone_sleep_duration', in_bed: 'sensor.tom_fs_iphone_in_bed', spo2: 'sensor.tom_fs_iphone_blood_oxygen' }));
  assert.equal(r.body.entities.hr, 'sensor.tom_pulse', 'a renamed sensor, found by its name');
  assert.equal(r.body.entities.hr_rest, 'sensor.tom_fs_iphone_resting_heart_rate', 'Resting Heart Rate isn\'t taken for Heart Rate');
  assert.equal(r.body.entities.dist_mi, undefined, 'Core Motion\'s Distance isn\'t Walking + Running Distance');
  assert.equal(r.body.units.in_bed, 'min', 'hours, turned into minutes');
  assert.deepEqual(r.body.days[YESTERDAY], { steps: 11200, active_kcal: 645, hr: 70, hr_rest: 52, sleep: 400 });
  assert.deepEqual(r.body.days[TODAY], { steps: 4200, active_kcal: 20, hr: 66, sleep: 95, in_bed: 120 });
  assert.equal(Object.keys(r.body.days).length, 2, 'nothing from before the days asked for (the readings standing at midnight are left out)');
  // one history request, for just his sensors, from yesterday's midnight on the family's calendar
  const hist = seen.filter(x => x.path.startsWith('/api/history/'));
  assert.equal(hist.length, 1);
  assert.equal(hist[0].from, FROM);
  assert.ok(hist[0].ids.split(',').every(e => e.startsWith('sensor.tom_')));
  assert.ok(!JSON.stringify(r.body).includes(HA_TOKEN));
});

await test('the sensors are kept for a day: the next call only reads the history', async () => {
  seen.length = 0;
  const r = await call('health', undefined, TOM);
  assert.equal(r.status, 200);
  assert.deepEqual(seen.map(x => x.path.split('/').slice(0, 3).join('/')), ['/api/history'], 'no template, no states');
  assert.deepEqual(Object.keys(r.body.days).sort(), [YESTERDAY, TODAY], 'unless asked: today and yesterday');
  assert.equal((await call('health?days=1', undefined, TOM)).body.days[YESTERDAY], undefined, 'days=1: today only');
});

await test('Steps reads Health Steps (with the Apple Watch\'s) once it has been found', async () => {
  seen.length = 0;
  const r = await call('steps?days=2', undefined, TOM);
  assert.equal(r.body.entity, 'sensor.tom_fs_iphone_health_steps');
  assert.equal(seen.find(x => x.path.startsWith('/api/history/')).ids, 'sensor.tom_fs_iphone_health_steps');
  assert.equal(r.body.points[r.body.points.length - 1][1], 4200);
});

await test('a token that can\'t list a device\'s sensors: they are guessed from the phone\'s name, and kept if Home Assistant has them', async () => {
  admin = false; seen.length = 0;
  const r = await call('health?days=2', undefined, ELLA);
  assert.deepEqual(r.body.entities, { steps: 'sensor.ellas_iphone_health_steps', hrv: 'sensor.ellas_iphone_heart_rate_variability', vo2: 'sensor.ellas_iphone_vo2_max' });
  assert.deepEqual(r.body.days[YESTERDAY], { hrv: 41, vo2: 38.5 });
  assert.deepEqual(r.body.days[TODAY], { steps: 777 });
  assert.ok(seen.some(x => x.path === '/api/states'));
  admin = true;
});

await test('each person only ever reads their own phone', async () => {
  seen.length = 0;
  const e = await call('health?days=10', undefined, ELLA);
  assert.ok(Object.values(e.body.entities).every(x => x.startsWith('sensor.ellas_')));
  assert.ok(seen.filter(x => x.ids).every(x => x.ids.split(',').every(id => id.startsWith('sensor.ellas_'))), 'her requests name none of Tom\'s sensors');
  assert.ok(!JSON.stringify(e.body).includes('tom'));
  assert.equal(JSON.parse(await db.get('health:ella')).entity, 'sensor.ellas_iphone_steps');
  assert.ok(JSON.parse(await db.get('health:tom')).map.steps.startsWith('sensor.tom_'));
});

await test('unlinking forgets the sensors found; a new phone is looked through again', async () => {
  assert.equal((await call('unlink', {}, ELLA)).status, 200);
  assert.equal(await db.get('health:ella'), null);
  assert.equal((await call('health', undefined, ELLA)).body.error, 'not-linked');
  // Tom's cache is of his linked phone: linking another drops it on the next read
  await db.put('health:tom', JSON.stringify({ entity: 'sensor.old_phone_steps', at: Date.now(), map: { steps: 'sensor.old_phone_health_steps' }, units: {}, scale: {} }));
  seen.length = 0;
  const r = await call('health', undefined, TOM);
  assert.equal(r.body.entities.steps, 'sensor.tom_fs_iphone_health_steps');
  assert.ok(seen.some(x => x.template), 'looked through again');
});

await test('no Health sensors on yet: nothing, no history asked for, and it looks again within the hour', async () => {
  HIST['sensor.max_iphone_steps'] = [[at(TODAY, 1), '10']];
  STATES.push('sensor.max_iphone_steps');
  assert.equal((await call('link', { entity: 'sensor.max_iphone_steps' }, MAX)).status, 200);
  seen.length = 0;
  const r = await call('health', undefined, MAX);
  assert.deepEqual(r.body, { entities: {}, units: {}, days: {} });
  assert.ok(!seen.some(x => x.path.startsWith('/api/history/')));
  const c = JSON.parse(await db.get('health:max'));
  c.at -= 61 * 60e3; await db.put('health:max', JSON.stringify(c));
  seen.length = 0; await call('health', undefined, MAX);
  assert.ok(seen.some(x => x.template || x.path === '/api/states'), 'an hour on, looked for again');
});

await test('rollup: a total reset at midnight, a reading, heart rate\'s average, a night dated its morning; unavailable skipped', () => {
  // fixed days in October (EDT, UTC-4)
  const t = s => ({ last_changed: s });
  const from = Date.parse('2026-10-19T04:00:00Z');
  const h = [
    [{ entity_id: 'sensor.p_flights_climbed', state: '7', last_changed: '2026-10-19T04:00:00Z' }, { state: '3', ...t('2026-10-19T14:00:00Z') }, { state: '12', ...t('2026-10-20T03:59:00Z') }, { state: '0', ...t('2026-10-20T04:01:00Z') }, { state: '2', ...t('2026-10-20T13:00:00Z') }],
    [{ entity_id: 'sensor.p_heart_rate', state: '61', last_changed: '2026-10-19T12:00:00Z' }, { state: '71', ...t('2026-10-19T13:00:00Z') }, { state: 'unavailable', ...t('2026-10-19T14:00:00Z') }, { state: '', ...t('2026-10-19T15:00:00Z') }],
    [{ entity_id: 'sensor.p_respiratory_rate', state: '14.24', last_changed: '2026-10-19T12:00:00Z' }, { state: '15.06', ...t('2026-10-19T20:00:00Z') }],
    [{ entity_id: 'sensor.p_deep_sleep', state: '50', last_changed: '2026-10-19T11:00:00Z' }, { state: '0', ...t('2026-10-19T22:30:00Z') }, { state: '20', ...t('2026-10-20T03:00:00Z') }, { state: '72', ...t('2026-10-20T10:30:00Z') }, { state: '0', ...t('2026-10-20T22:10:00Z') }],
    [{ entity_id: 'sensor.p_vo2_max', state: 'unknown', last_changed: '2026-10-19T12:00:00Z' }],
    [{ entity_id: 'sensor.someone_elses', state: '5', last_changed: '2026-10-19T12:00:00Z' }],
  ];
  const ent = { flights: 'sensor.p_flights_climbed', hr: 'sensor.p_heart_rate', resp: 'sensor.p_respiratory_rate', deep: 'sensor.p_deep_sleep', vo2: 'sensor.p_vo2_max' };
  assert.deepEqual(rollup(h, ent, from), {
    '2026-10-19': { flights: 12, hr: 66, resp: 15.1, deep: 50 },
    '2026-10-20': { flights: 2, deep: 72 },
  });
  // 23:00 on the 19th (03:00Z on the 20th) is part of the night that ends on the morning of the 20th
  assert.deepEqual(rollup([h[3].slice(0, 3)], ent, from), { '2026-10-19': { deep: 50 }, '2026-10-20': { deep: 20 } });
  // scale: a sleep sensor in hours
  assert.deepEqual(rollup([[{ entity_id: 'sensor.p_deep_sleep', state: '1.5', last_changed: '2026-10-19T11:00:00Z' }]], ent, from, { deep: 60 }), { '2026-10-19': { deep: 90 } });
  assert.deepEqual(rollup('nonsense', ent, from), {});
});

await test('matching by name: the phone\'s name first; without it, the end of the name', () => {
  const m = matchHealth('', [{ e: 'sensor.a_b', n: 'Phone Walking Heart Rate Average' }, { e: 'sensor.c_d', n: 'Phone Heart Rate' }, { e: 'sensor.bad id', n: 'Phone VO2 Max' }], 'zzz_');
  assert.deepEqual(m.map, { hr_walk: 'sensor.a_b', hr: 'sensor.c_d' });
});

console.log('\n' + n + ' tests passed');
