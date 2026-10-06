// The Analysis maths (fitness/analysis.js), in Node: the windows, the
// totals, stronger / weaker / steady by estimated one-rep max, a first
// time, comparing with the last time when the window before is empty,
// bodyweight and timed moves, and muscle groups missed or cut back.
//   node fitness/scripts/analysis-test.mjs
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const src = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'analysis.js'), 'utf8');
vm.runInThisContext(src);   // it sets globalThis.FitnessAnalysis, as window.FitnessAnalysis in the page
const { analyze, score } = globalThis.FitnessAnalysis;

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const GROUPS = ['chest', 'back', 'lowerback', 'shoulders', 'arms', 'core', 'legs', 'glutes'];
let id = 0;
const L = (date, group, exercise, weight, reps, sets, extra) => Object.assign({ id: 'l' + id++, date, group, exercise, weight, reps, sets, updated: id }, extra);
const TODAY = '2026-10-06';

test('the windows: 7 days and the 7 before; 28 and the 28 before', () => {
  assert.deepEqual(analyze([], TODAY, 7, GROUPS).range, { from: '2026-09-30', to: '2026-10-06', beforeTo: '2026-09-29', beforeFrom: '2026-09-23' });
  assert.deepEqual(analyze([], TODAY, 28, GROUPS).range, { from: '2026-09-09', to: '2026-10-06', beforeTo: '2026-09-08', beforeFrom: '2026-08-12' });
  const a = analyze([], TODAY, 7, GROUPS);
  assert.equal(a.hasNow, false); assert.equal(a.hasBefore, false);
});

test('totals: days trained, sets, and volume from weighted exercises only', () => {
  const a = analyze([
    L('2026-10-05', 'chest', 'Bench', 100, 8, 3), L('2026-10-05', 'core', 'Plank', 0, 45, 3, { timed: true }),
    L('2026-10-03', 'back', 'Pull-Up', 0, 10, 3),
    L('2026-09-25', 'chest', 'Bench', 95, 8, 3),
    L('2026-09-01', 'chest', 'Bench', 60, 8, 3),   // outside both windows
  ], TODAY, 7, GROUPS);
  const t = Object.fromEntries(a.totals.map(x => [x.id, [x.now, x.before]]));
  assert.deepEqual(t, { workouts: [2, 1], sets: [9, 3], volume: [2400, 2280], cardio: [0, 0] });
});

test('stronger, weaker and steady, by estimated one-rep max', () => {
  const a = analyze([
    L('2026-10-05', 'chest', 'Bench', 105, 6, 3), L('2026-09-26', 'chest', 'Bench', 95, 8, 3),   // 126 vs 120.3: up
    L('2026-10-04', 'legs', 'Squat', 135, 5, 3), L('2026-09-27', 'legs', 'Squat', 155, 5, 3),    // down
    L('2026-10-04', 'arms', 'Curl', 30, 10, 3), L('2026-09-27', 'arms', 'Curl', 30, 10, 3),      // same
    L('2026-10-04', 'arms', 'Hammer Curl', 25, 10, 3),                                            // first time
  ], TODAY, 7, GROUPS);
  assert.deepEqual(a.up.map(x => x.name), ['Bench']);
  assert.ok(Math.abs(a.up[0].change - (score({ weight: 105, reps: 6 }) / score({ weight: 95, reps: 8 }) - 1)) < 1e-9);
  assert.equal(a.up[0].was.weight, 95); assert.equal(a.up[0].now.weight, 105); assert.equal(a.up[0].when, 'before');
  assert.deepEqual(a.down.map(x => x.name), ['Squat']);
  assert.deepEqual(a.same.map(x => x.name), ['Curl']);
  assert.deepEqual(a.fresh.map(x => x.name), ['Hammer Curl']);
});

test('the best entry in each window counts, and names match whatever their case', () => {
  const a = analyze([
    L('2026-10-01', 'chest', 'Bench', 95, 8, 3), L('2026-10-05', 'chest', 'bench', 110, 5, 3),
    L('2026-09-24', 'chest', 'Bench', 100, 8, 3), L('2026-09-28', 'chest', 'Bench', 80, 8, 3),
  ], TODAY, 7, GROUPS);
  assert.equal(a.up.length, 1);
  assert.equal(a.up[0].now.weight, 110); assert.equal(a.up[0].was.weight, 100);
});

test('not done in the window before: compared with the last time it was done', () => {
  const a = analyze([L('2026-10-05', 'shoulders', 'Press', 100, 6, 3), L('2026-08-20', 'shoulders', 'Press', 90, 6, 3), L('2026-08-01', 'shoulders', 'Press', 120, 6, 3)], TODAY, 7, GROUPS);
  assert.equal(a.up[0].was.date, '2026-08-20');
  assert.equal(a.up[0].when, 'earlier');
});

test('bodyweight by reps, holds by seconds, and different kinds not compared', () => {
  const a = analyze([
    L('2026-10-05', 'back', 'Pull-Up', 0, 12, 3), L('2026-09-28', 'back', 'Pull-Up', 0, 10, 3),
    L('2026-10-05', 'core', 'Plank', 0, 45, 3, { timed: true }), L('2026-09-28', 'core', 'Plank', 0, 60, 3, { timed: true }),
    L('2026-10-05', 'chest', 'Dip', 25, 8, 3), L('2026-09-28', 'chest', 'Dip', 0, 15, 3),
  ], TODAY, 7, GROUPS);
  assert.deepEqual(a.up.map(x => x.name), ['Pull-Up']);
  assert.ok(Math.abs(a.up[0].change - 0.2) < 1e-9);
  assert.deepEqual(a.down.map(x => x.name), ['Plank']);
  assert.deepEqual(a.fresh.map(x => x.name), ['Dip'], 'a weighted dip is not measured against bodyweight ones');
});

test('muscle groups: missed, and cut back to under 70%', () => {
  const a = analyze([
    L('2026-10-05', 'chest', 'Bench', 100, 8, 2), L('2026-09-28', 'chest', 'Bench', 100, 8, 6),   // 2 of 6: cut back
    L('2026-09-28', 'legs', 'Squat', 135, 5, 4),                                                   // not now: missed
    L('2026-10-05', 'back', 'Row', 100, 8, 4), L('2026-09-28', 'back', 'Row', 100, 8, 5),         // 4 of 5: fine
    L('2026-10-05', 'arms', 'Curl', 30, 8, 1), L('2026-09-28', 'arms', 'Curl', 30, 8, 2),         // from under 3: not flagged
  ], TODAY, 7, GROUPS);
  assert.deepEqual(a.missed.map(g => g.id), ['legs']);
  assert.deepEqual(a.dropped.map(g => g.id), ['chest']);
  assert.deepEqual(a.groups.map(g => g.id), GROUPS, 'every group, in order');
  assert.deepEqual(a.groups.find(g => g.id === 'back'), { id: 'back', now: 4, before: 5 });
});

test('cardio: minutes totalled; faster over a distance is better; minutes when no distance; none now needs work', () => {
  const C = (date, exercise, mins, dist, unit) => L(date, 'cardio', exercise, 0, 0, 0, { cardio: true, mins, dist, unit });
  const a = analyze([
    C('2026-10-05', 'Treadmill', 30, 3, 'mi'), C('2026-09-28', 'Treadmill', 30, 2.5, 'mi'),    // 0.1 vs 0.083 mi/min: faster
    C('2026-10-04', 'Spin Bike', 20, 0, 'mi'), C('2026-09-27', 'Spin Bike', 30, 0, 'mi'),       // fewer minutes
    C('2026-10-03', 'Rowing Machine', 20, 4000, 'm'), C('2026-09-27', 'Rowing Machine', 25, 0, 'm'),   // distance now, none before: not compared
    L('2026-10-05', 'chest', 'Bench', 100, 8, 3),
  ], TODAY, 7, GROUPS);
  assert.deepEqual(a.up.map(x => x.name), ['Treadmill']);
  assert.ok(Math.abs(a.up[0].change - 0.2) < 1e-9, 'a fifth faster');
  assert.deepEqual(a.down.map(x => x.name), ['Spin Bike']);
  assert.deepEqual(a.fresh.map(x => x.name).sort(), ['Bench', 'Rowing Machine']);
  const t = Object.fromEntries(a.totals.map(x => [x.id, [x.now, x.before]]));
  assert.deepEqual(t.cardio, [70, 85]);
  assert.deepEqual(t.sets, [3, 0], 'cardio adds no sets');
  assert.equal(a.cardioMissed, null);
  assert.ok(!a.groups.some(g => g.id === 'cardio'), 'not among the muscle groups');
  const b = analyze([C('2026-09-28', 'Treadmill', 30, 3, 'mi'), L('2026-10-05', 'chest', 'Bench', 100, 8, 3)], TODAY, 7, GROUPS);
  assert.deepEqual(b.cardioMissed, { before: 30 });
});

test('Month: four whole weeks against the four before', () => {
  const a = analyze([L('2026-09-10', 'chest', 'Bench', 100, 8, 3), L('2026-09-08', 'chest', 'Bench', 90, 8, 3), L('2026-08-11', 'chest', 'Bench', 200, 8, 3)], TODAY, 28, GROUPS);
  assert.equal(a.up.length, 1);
  assert.equal(a.up[0].was.date, '2026-09-08');
  assert.equal(a.totals.find(t => t.id === 'workouts').before, 1, 'Aug 11 is outside both windows');
});

console.log('\n' + n + ' tests passed');
