// fitness/health.js's judgments, in plain Node: your usual (typical), each reading's status
// (good / watch / bad / none) against the healthy ranges and your usual, a category's status (the
// worst of its readings), the ranges a chart shades, trends, and Fitness's own Sleep score.
// Made-up data only. Dates are fixed strings (health.js counts days in UTC), so it works any day.
//   node fitness/scripts/health-status-test.mjs
import assert from 'assert/strict';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('../health.js');
const H = globalThis.FitnessHealth;

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

// Days back from a fixed day, across a month end (Feb into March, in a leap year).
const DAY = '2028-03-02';
const back = k => H.shift(DAY, -k);
// history: { key: [value k days back, ...] } -> data.health rows; k = 1 is the day before DAY.
function hist(series, extra = {}) {
  const rows = new Map();
  for (const [key, vals] of Object.entries(series)) vals.forEach((v, i) => {
    const d = back(i + 1); if (v == null) return;
    if (!rows.has(d)) rows.set(d, { id: d, date: d, m: {} });
    rows.get(d).m[key] = v;
  });
  if (Object.keys(extra).length) rows.set(DAY, { id: DAY, date: DAY, m: extra });
  return [...rows.values()];
}
const steady = (v, k = 28, wobble = 1) => Array.from({ length: k }, (_, i) => v + (i % 2 ? wobble : -wobble));

test('shift counts days across a month end and a leap day', () => {
  assert.equal(H.shift('2028-03-01', -1), '2028-02-29');
  assert.equal(H.shift('2027-03-01', -1), '2027-02-28');
  assert.equal(H.shift('2026-12-31', 1), '2027-01-01');
  assert.equal(back(28), '2028-02-03');
});

test('typical: the 28 days before (not the day itself), 7 days at least, mean ± 1.5 SD floored at NEAR', () => {
  assert.equal(H.typical('hr_rest', hist({ hr_rest: steady(55, 6) }), DAY), null, '6 days: too few');
  const t = H.typical('hrv', hist({ hrv: steady(50, 28, 10) }), DAY);
  assert.equal(t.n, 28);
  assert.ok(Math.abs(t.mean - 50) < 1e-9);
  const sd = Math.sqrt(28 * 100 / 27);
  assert.ok(Math.abs(t.hi - (50 + 1.5 * sd)) < 1e-9 && Math.abs(t.lo - (50 - 1.5 * sd)) < 1e-9);
  assert.ok(Math.abs(t.far - Math.max(3 * sd, H.FAR.hrv)) < 1e-9);
  // a steady reading: the range is at least NEAR either side, and far at least FAR
  const s = H.typical('hr_rest', hist({ hr_rest: steady(55, 10, 0) }), DAY);
  assert.deepEqual([s.lo, s.hi, s.far], [55 - H.NEAR.hr_rest, 55 + H.NEAR.hr_rest, H.FAR.hr_rest]);
  // only the window: a reading 29+ days back and the day judged don't count
  const rows = hist({ hrv: [...steady(50, 7, 0), ...Array(21).fill(null), 500] }, { hrv: 900 });
  assert.equal(H.typical('hrv', rows, DAY).n, 7);
  assert.equal(H.typical('hrv', rows, DAY).mean, 50);
  // plain numbers, already picked
  assert.equal(H.typical('hrv', [40, 42, 44, 46, 48, 50, 52]).mean, 46);
  assert.equal(H.typical('hrv', []), null);
});

test('sleep: 7 h+ good, under it check, red only far under your usual', () => {
  assert.equal(H.status('sleep', 420, []), 'good');
  assert.equal(H.status('sleep', 600, []), 'good');
  assert.equal(H.status('sleep', 400, []), 'watch');
  assert.equal(H.status('sleep', 200, []), 'watch', 'no usual yet: never red');
  const h = hist({ sleep: steady(450, 28, 10) });
  assert.equal(H.status('sleep', 380, h, { day: DAY }), 'watch', 'under 7 h, not far from usual');
  assert.equal(H.status('sleep', 300, h, { day: DAY }), 'bad', '2.5 h under a steady 7.5 h');
  assert.equal(H.status('sleep', null, h, { day: DAY }), 'none');
  assert.equal(H.status('deep', 60, h, { day: DAY }), 'none', 'the stages are shown, not judged');
});

test('activity: steps against your goal, exercise 150 min over 7 days; never red', () => {
  assert.equal(H.status('steps', 8000, [], { stepGoal: 8000 }), 'good');
  assert.equal(H.status('steps', 7999, [], { stepGoal: 8000 }), 'watch');
  assert.equal(H.status('steps', 9999, []), 'watch', 'default goal 10,000');
  assert.equal(H.status('steps', 0, [], { stepGoal: 8000 }), 'watch', 'not red');
  const ex = hist({ exercise_min: [20, 20, 20, 20, 20, 20, 500] });   // the 7th day back is outside the week
  assert.equal(H.status('exercise_min', 30, ex, { day: DAY }), 'good', '30 + 6 × 20 = 150');
  assert.equal(H.status('exercise_min', 29, ex, { day: DAY }), 'watch');
  assert.equal(H.status('exercise_min', 0, [], { day: DAY }), 'watch');
  for (const k of ['active_kcal', 'rest_kcal', 'dist_mi', 'flights']) assert.equal(H.status(k, 1, [], { day: DAY }), 'none', k);
});

test('resting heart rate: over 100 red; under 60 fine when usual; above your usual check, far above red', () => {
  assert.equal(H.status('hr_rest', 101, []), 'bad');
  assert.equal(H.status('hr_rest', 70, []), 'good');
  assert.equal(H.status('hr_rest', 48, []), 'good', 'no usual yet');
  const low = hist({ hr_rest: steady(50, 28, 1) });
  assert.equal(H.status('hr_rest', 49, low, { day: DAY }), 'good', 'an athlete\'s usual 50');
  assert.equal(H.status('hr_rest', 45, low, { day: DAY }), 'watch', 'under 60 and under the usual');
  assert.equal(H.status('hr_rest', 55, low, { day: DAY }), 'watch', 'above the usual');
  assert.equal(H.status('hr_rest', 62, low, { day: DAY }), 'bad', 'far above the usual (FAR 10)');
  const mid = hist({ hr_rest: steady(70, 28, 1) });
  assert.equal(H.status('hr_rest', 64, mid, { day: DAY }), 'good', 'lower than usual, over 60: fine');
});

test('blood pressure, the AHA\'s categories, each number on its own', () => {
  const s = v => H.status('bp_sys', v, []), d = v => H.status('bp_dia', v, []);
  assert.deepEqual([s(110), s(119), s(120), s(129), s(130), s(139), s(140), s(185)], ['good', 'good', 'watch', 'watch', 'watch', 'watch', 'bad', 'bad']);
  assert.deepEqual([d(70), d(79), d(80), d(89), d(90), d(125)], ['good', 'good', 'watch', 'watch', 'bad', 'bad']);
  // elevated: 125/75 -> watch and good: the pair is watch
  const rows = [{ date: DAY, m: { bp_sys: 125, bp_dia: 75 } }];
  assert.equal(H.catStatus('vitals', DAY, rows), 'watch');
  // far over your usual is red even inside a category
  const h = hist({ bp_sys: steady(100, 20, 1) });
  assert.equal(H.status('bp_sys', 104, h, { day: DAY }), 'good', 'within the usual');
  assert.equal(H.status('bp_sys', 118, h, { day: DAY }), 'watch', '18 over: over the usual, not far (FAR 20)');
  assert.equal(H.status('bp_sys', 121, h, { day: DAY }), 'bad', '21 over a steady 100');
  assert.equal(H.status('bp_sys', 85, h, { day: DAY }), 'good', 'lower than usual: not flagged');
});

test('blood oxygen 95-100 good, 90-94 check, under 90 red; breathing 12-20 good, else check', () => {
  assert.deepEqual([98, 95, 94, 90, 89].map(v => H.status('spo2', v, [])), ['good', 'good', 'watch', 'watch', 'bad']);
  assert.deepEqual([12, 16, 20, 11.5, 22].map(v => H.status('resp', v, [])), ['good', 'good', 'good', 'watch', 'watch']);
  const h = hist({ resp: steady(14, 28, 0.2) });
  assert.equal(H.status('resp', 19.5, h, { day: DAY }), 'bad', 'in 12-20 but far over a steady 14');
});

test('personal baseline only: HRV, walking HR, VO2 max, temperatures, glucose', () => {
  for (const k of ['hrv', 'hr_walk', 'vo2', 'temp', 'temp_basal', 'glucose', 'hr']) assert.equal(H.status(k, 50, []), 'none', k + ': no usual yet');
  const hrv = hist({ hrv: steady(50, 28, 3) });
  assert.equal(H.status('hrv', 52, hrv, { day: DAY }), 'good');
  assert.equal(H.status('hrv', 40, hrv, { day: DAY }), 'watch', 'under the usual');
  assert.equal(H.status('hrv', 25, hrv, { day: DAY }), 'bad', 'far under');
  assert.equal(H.status('hrv', 90, hrv, { day: DAY }), 'good', 'higher HRV is not flagged');
  const walk = hist({ hr_walk: steady(100, 28, 2) });
  assert.equal(H.status('hr_walk', 108, walk, { day: DAY }), 'watch');
  assert.equal(H.status('hr_walk', 125, walk, { day: DAY }), 'bad');
  assert.equal(H.status('hr_walk', 80, walk, { day: DAY }), 'good', 'lower is fine');
  const temp = hist({ temp: steady(97.8, 28, 0.1) });
  assert.equal(H.status('temp', 97.9, temp, { day: DAY }), 'good');
  assert.equal(H.status('temp', 98.5, temp, { day: DAY }), 'watch');
  assert.equal(H.status('temp', 99.5, temp, { day: DAY }), 'bad', 'far either way');
  assert.equal(H.status('temp', 96.1, temp, { day: DAY }), 'bad');
  const vo2 = hist({ vo2: steady(42, 10, 0.3) });
  assert.equal(H.status('vo2', 39.5, vo2, { day: DAY }), 'watch');
  assert.equal(H.status('vo2', 46, vo2, { day: DAY }), 'good');
});

test('statuses and catStatus: a day\'s readings, a category the worst of them, none without any', () => {
  const rows = hist({ hr_rest: steady(55, 28, 1) }, { steps: 12000, exercise_min: 40, hr_rest: 102, spo2: 93, sleep: 450, deep: 60 });
  assert.deepEqual(H.statuses(DAY, rows, { stepGoal: 10000 }), { steps: 'good', exercise_min: 'watch', hr_rest: 'bad', sleep: 'good', deep: 'none', spo2: 'watch' });
  assert.equal(H.catStatus('activity', DAY, rows, { stepGoal: 10000 }), 'watch', '40 min this week');
  assert.equal(H.catStatus('heart', DAY, rows), 'bad');
  assert.equal(H.catStatus('sleep', DAY, rows), 'good');
  assert.equal(H.catStatus('vitals', DAY, rows), 'watch');
  assert.equal(H.catStatus('vitals', back(1), rows), 'none', 'nothing that day');
  assert.equal(H.catStatus('sleep', DAY, [{ date: DAY, m: { deep: 60 } }]), 'none', 'only stages: nothing judged');
  assert.equal(H.worse('watch', 'bad'), 'bad'); assert.equal(H.worse('none', 'good'), 'good');
});

test('band: the healthy range a chart shades, and goals as a line', () => {
  assert.deepEqual(H.band('sleep'), { lo: 420, hi: 540 });
  assert.deepEqual(H.band('spo2'), { lo: 95, hi: 100 });
  assert.deepEqual(H.band('steps', { stepGoal: 8000 }), { lo: 8000, hi: null });
  assert.deepEqual(H.band('active_kcal', {}), { lo: 500, hi: null }, 'Move goal 500 by default');
  assert.deepEqual(H.band('active_kcal', { moveGoal: 650 }), { lo: 650, hi: null });
  assert.deepEqual(H.band('exercise_min'), { lo: 30, hi: null });
  assert.equal(H.band('hrv'), null, 'your usual instead');
});

test('trend: the last 7 days against your 90-day average, else 28-day; only a real change', () => {
  // 90 days at 60, the last 7 at 56: down 4 vs a 90-day average a little under 60
  const vals = Array.from({ length: 90 }, (_, i) => i < 6 ? 56 : 60);   // k = 1..90 back; DAY itself below
  const rows = hist({ hr_rest: vals }, { hr_rest: 56 });
  const t = H.trend('hr_rest', rows, DAY);
  assert.equal(t.over, 90);
  assert.equal(t.recent, 56);
  assert.ok(t.diff < -3 && t.diff > -4, String(t.diff));
  // a small wobble: nothing to say
  assert.equal(H.trend('hr_rest', hist({ hr_rest: Array.from({ length: 90 }, (_, i) => i < 6 ? 59 : 60) }, { hr_rest: 59 }), DAY), null);
  // only 20 days: the 28-day average
  const short = H.trend('steps', hist({ steps: Array.from({ length: 20 }, (_, i) => i < 6 ? 4000 : 9000) }, { steps: 4000 }), DAY);
  assert.equal(short.over, 28); assert.ok(short.diff < 0);
  // too few recent days, or too little history
  assert.equal(H.trend('steps', hist({ steps: [null, null, null, null, null, null, 9000, 9000] }), DAY), null);
  assert.equal(H.trend('steps', hist({ steps: steady(9000, 10) }, { steps: 1 }), DAY), null);
});

test('sleepScore: duration, deep, REM and efficiency, re-weighted without stages; levels', () => {
  assert.equal(H.sleepScore(null), null);
  assert.equal(H.sleepScore({}), null, 'no sleep: no score');
  assert.equal(H.sleepScore({ in_bed: 480 }), null);
  // a full night: 8 h asleep, deep 15%, REM 22%, in bed 8 h 30 m (94%)
  const full = H.sleepScore({ sleep: 480, deep: 72, rem: 106, core: 302, in_bed: 510, awake: 30 });
  assert.equal(full.score, 100); assert.equal(full.level, 'Very high');
  assert.deepEqual(Object.keys(full.parts), ['duration', 'deep', 'rem', 'efficiency']);
  assert.deepEqual([full.parts.duration.of, full.parts.deep.of, full.parts.rem.of, full.parts.efficiency.of], [50, 15, 20, 15]);
  // duration: a line from 0 at 4 h to full at 7 h, a little less over 9 h
  const dur = mins => H.sleepScore({ sleep: mins }).parts.duration;
  assert.equal(dur(240).pts, 0); assert.equal(dur(330).pts, 50); assert.equal(dur(420).pts, 100); assert.equal(dur(540).pts, 100);
  assert.equal(dur(600).pts, 90); assert.equal(dur(900).pts, 80, 'never under 80% for a long night');
  assert.equal(dur(180).pts, 0);
  // duration alone: it is the whole score
  assert.equal(H.sleepScore({ sleep: 330 }).score, 50);
  assert.equal(H.sleepScore({ sleep: 330 }).parts.deep, null);
  // no stages: duration and efficiency share the 100 (77 and 23)
  const ns = H.sleepScore({ sleep: 420, in_bed: 600 });   // 70% in bed asleep
  assert.equal(ns.parts.deep, null); assert.equal(ns.parts.rem, null);
  assert.deepEqual([ns.parts.duration.of, ns.parts.efficiency.of], [77, 23]);
  assert.equal(ns.parts.duration.pts, 77);
  assert.equal(ns.parts.efficiency.pts, Math.round((0.7 - 0.5) / 0.35 * 1500 / 65));
  assert.ok(Math.abs(ns.parts.efficiency.v - 0.7) < 1e-9);
  assert.equal(ns.score, ns.parts.duration.pts + ns.parts.efficiency.pts);
  // deep and REM partial outside their ranges
  const low = H.sleepScore({ sleep: 480, deep: 24, rem: 48, core: 408, in_bed: 490 });   // deep 5%, REM 10%
  assert.equal(low.parts.deep.pts, Math.round(0.05 / 0.13 * 15));
  assert.equal(low.parts.rem.pts, 10);
  const hi = H.sleepScore({ sleep: 400, deep: 132, rem: 140, core: 128, in_bed: 410 });   // deep 33%, REM 35%
  assert.equal(hi.parts.deep.pts, Math.round(0.5 * 15)); assert.equal(hi.parts.rem.pts, 10);
  // asleep from the stages when Sleep Duration is missing; efficiency from awake without in bed
  const st = H.sleepScore({ deep: 60, rem: 100, core: 300, awake: 40 });
  assert.equal(st.parts.duration.v, 460); assert.ok(Math.abs(st.parts.efficiency.v - 460 / 500) < 1e-9);
  // levels
  assert.deepEqual([0, 40, 41, 60, 61, 80, 81, 95, 96, 100].map(H.sleepLevel), ['Very low', 'Very low', 'Low', 'Low', 'OK', 'OK', 'High', 'High', 'Very high', 'Very high']);
});

test('hmShort and the old formatters still hold', () => {
  assert.equal(H.hmShort(440), '7h 20m'); assert.equal(H.hmShort(420), '7h'); assert.equal(H.hmShort(45), '45m');
  assert.equal(H.fmt('sleep', 385), '6 h 25 m');
  assert.equal(H.fmt('steps', 8412), '8,412 steps');
});

console.log('\n' + n + ' tests passed');
