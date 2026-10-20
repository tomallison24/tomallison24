// Meds' sums (fitness/meds.js) and Analysis's steps (fitness/analysis.js), in
// Node: what's due on a day (times of day, weekdays, as needed, paused, not
// before it was added), how often each was taken over 7 and 30 days (today
// only once it's done), streaks (a day off doesn't break one; one that runs
// back past the 30 days the phone keeps says so), and the steps windows.
// Dates are fixed strings, so it works on any day it runs.
//   node fitness/scripts/meds-test.mjs
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
vm.runInThisContext(fs.readFileSync(path.join(dir, 'meds.js'), 'utf8'));
vm.runInThisContext(fs.readFileSync(path.join(dir, 'analysis.js'), 'utf8'));
const { dueOn, adherence, streak, add } = globalThis.FitnessMeds;
const { steps } = globalThis.FitnessAnalysis;

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const TODAY = '2026-10-21';   // a Wednesday
const vitD = { id: 'd', name: 'Vitamin D', slots: ['am'], since: '2026-09-01' };
const metf = { id: 'm', name: 'Metformin', slots: ['pm', 'am'], since: '2026-09-01' };
const mwf = { id: 'w', name: 'Iron', slots: [], days: [1, 3, 5], since: '2026-09-01' };
const prn = { id: 'p', name: 'Ibuprofen', prn: true, since: '2026-09-01' };
const paused = { id: 'z', name: 'Zinc', slots: ['am'], paused: true, since: '2026-09-01' };
const dose = (med, date, slot) => ({ id: med + date + slot, med, date, slot });
const days = (from, to) => { const out = []; for (let d = from; d <= to; d = add(d, 1)) out.push(d); return out; };

test('due on a day: by time of day, weekdays only where set; never as needed or paused', () => {
  const due = dueOn([vitD, metf, mwf, prn, paused], TODAY);
  assert.deepEqual(due.map(x => x.med.id + ':' + x.slot), ['d:am', 'm:am', 'm:pm', 'w:day']);
  assert.deepEqual(dueOn([mwf], '2026-10-20').length, 0, 'Iron is Mon, Wed, Fri: not a Tuesday');
  assert.deepEqual(dueOn([{ ...vitD, since: '2026-10-22' }], TODAY).length, 0, 'nothing before the day it was added');
});

test('taken: doses taken out of due, over 7 and 30 days; today only once it is done', () => {
  const doses = days('2026-09-21', '2026-10-20').map(d => dose('d', d, 'am')).filter(x => x.date !== '2026-10-18');
  const a7 = adherence(vitD, doses, TODAY, 7);
  assert.deepEqual([a7.due, a7.taken], [6, 5], 'today has nothing yet, so it isn\'t counted');
  assert.equal(adherence(vitD, doses.concat(dose('d', TODAY, 'am')), TODAY, 7).due, 7, 'today counts once taken');
  const a30 = adherence(vitD, doses, TODAY, 30);
  assert.deepEqual([a30.due, a30.taken], [29, 28]);
  // Twice a day: each time counts.
  const m = adherence(metf, [dose('m', TODAY, 'am'), dose('m', '2026-10-20', 'am'), dose('m', '2026-10-20', 'pm'), dose('m', '2026-10-19', 'am')], TODAY, 3);
  assert.deepEqual([m.due, m.taken], [4, 3], 'today has only the morning, so it waits; then 2 of 2 and 1 of 2');
  assert.equal(adherence(paused, [], TODAY, 7).share, null, 'paused: nothing due');
  assert.equal(adherence(prn, [], TODAY, 7).share, null, 'as needed: never missed');
});

test('taken: days before the first one kept on the phone are not counted as missed', () => {
  const doses = days('2026-09-22', '2026-10-20').map(d => dose('d', d, 'am'));
  assert.equal(adherence(vitD, doses, TODAY, 60, '2026-09-22').share, 1);
  assert.ok(adherence(vitD, doses, TODAY, 60).share < 1, 'without the floor, the older days read as missed');
});

test('streaks: everything taken, day after day; a day off doesn\'t break it', () => {
  const doses = days('2026-10-10', '2026-10-20').map(d => dose('d', d, 'am'));
  assert.deepEqual(streak(vitD, doses, TODAY), { days: 11, more: false }, 'up to yesterday while today is still to do');
  assert.equal(streak(vitD, doses.concat(dose('d', TODAY, 'am')), TODAY).days, 12, 'today, once done');
  // Mon, Wed, Fri: the Tuesday and the weekend in between don't break it.
  const iron = ['2026-10-12', '2026-10-14', '2026-10-16', '2026-10-19'].map(d => dose('w', d, 'day'));
  assert.equal(streak(mwf, iron, TODAY).days, 4);
  assert.equal(streak(vitD, [], TODAY).days, 0);
  assert.deepEqual(streak(vitD, days('2026-09-22', '2026-10-21').map(d => dose('d', d, 'am')), TODAY, '2026-09-22'), { days: 30, more: true }, 'runs back past what the phone keeps');
});

test('steps: the average a day and days at the goal, this window and the one before', () => {
  const list = [['2026-10-21', 4000], ['2026-10-20', 12000], ['2026-10-15', 10000], ['2026-10-14', 3000], ['2026-10-01', 9000]].map(([date, k]) => ({ id: date, date, n: k }));
  const w = steps(list, TODAY, 7, 10000);
  assert.deepEqual(w.now, { avg: 8667, days: 3, met: 2 });
  assert.deepEqual(w.before, { avg: 3000, days: 1, met: 0 });
  assert.equal(w.any, true);
  assert.equal(steps([], TODAY, 7, 10000).any, false);
  // A month back reaches past the 30 days the phone keeps: the window before is left out, not read as none.
  const m = steps(list, TODAY, 28, 10000, add(TODAY, -29));
  assert.equal(m.before, null);
  assert.equal(m.now.days, 5);
});

console.log('\n' + n + ' tests passed');
