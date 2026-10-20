// Runs fitness/google-sheet-sync.gs in Node against an in-memory Sheet
// (fake-sheet.mjs): the secret check, a first sync, the readable Workouts
// tab, newest change winning, a deletion reaching the other phone, Undo
// bringing one back, formula-looking text kept as text, and Meds and Steps
// (their hidden tabs and the readable Meds, Med list and Steps tabs).
//   node fitness/scripts/sheet-test.mjs
import assert from 'assert/strict';
import { fakeSheet } from './fake-sheet.mjs';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const SECRET = 'test-secret-phrase';
// what aOS adds to every request (functions/sheet/api): the phrase, and who's asking
const TOM = { key: SECRET, who: 'tom', name: 'Tom', owner: '1' }, ELLA = { key: SECRET, who: 'ella', name: 'Ella' };
const T = Date.now();   // stamps near now: graves older than 400 days are dropped
const log = (id, extra) => Object.assign({ id, date: '2026-10-05', group: 'shoulders', exercise: 'Overhead Barbell Press', weight: 95, reps: 8, sets: 3, updated: T + 1000 }, extra);

test('answers a GET with its name; only aOS, with the phrase and who\'s asking, gets in', () => {
  const s = fakeSheet(undefined, SECRET, TOM);
  assert.deepEqual(s.get(), { ok: true, app: 'allison-fitness-sync', v: 3, aos: true });
  assert.equal(s.post({ action: 'sync' }, { key: 'nope', who: 'tom' }).error, 'wrong-secret');
  assert.equal(s.post({ secret: SECRET, action: 'sync' }, {}).error, 'wrong-secret', 'a phone with the phrase in its request, as before aOS, gets nothing');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET }).error, 'who');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET, who: 'a b' }).error, 'who');
  assert.equal(s.post('not json').error, 'bad-request');
  assert.equal(fakeSheet(undefined, 'CHANGE-ME').post({ action: 'sync' }, { key: 'CHANGE-ME', who: 'tom' }).error, 'secret-not-set');
  assert.deepEqual(s.post({ action: 'ping' }), { ok: true, app: 'allison-fitness-sync', v: 3, aos: true });
  // curly quotes and stray spaces in the phrase don't count against you
  assert.equal(fakeSheet(undefined, "tom's-code").post({ action: 'sync', logs: [] }, { key: ' tom’s-code ', who: 'tom' }).ok, true);
});

test('a first sync stores the log and builds the Workouts tab, newest first', () => {
  const s = fakeSheet(undefined, SECRET, TOM);
  const r = s.post({ secret: SECRET, action: 'sync', logs: [log('a'), log('b', { date: '2026-10-06', group: 'core', exercise: 'Plank', weight: 0, reps: 45, timed: true })], exercises: [{ id: 'x1', group: 'lowerback', name: 'Reverse Hyper', updated: 5 }], graves: {} });
  assert.equal(r.ok, true);
  assert.equal(r.logs.length, 2);
  assert.equal(r.exercises[0].name, 'Reverse Hyper');
  const w = s.tab('Workouts');
  assert.deepEqual(w[0], ['Who', 'Date', 'Day', 'Muscle group', 'Exercise', 'Sets', 'Reps', 'Seconds', 'Weight (lb)', 'Volume (lb)', 'Minutes', 'Distance', 'Unit']);
  assert.deepEqual(w[1], ['Tom', '2026-10-06', 'Tue', 'Core', 'Plank', 3, '', 45, 'Bodyweight', '', '', '', '']);
  assert.deepEqual(w[2], ['Tom', '2026-10-05', 'Mon', 'Shoulders', 'Overhead Barbell Press', 3, 8, '', 95, 2280, '', '', '']);
});

test('cardio: minutes and a distance in place of sets, reps and weight', () => {
  const s = fakeSheet(undefined, SECRET, TOM);
  s.post({ secret: SECRET, action: 'sync', logs: [
    log('c1', { group: 'cardio', exercise: 'Rowing Machine', weight: 0, reps: 0, sets: 0, cardio: true, mins: 20, dist: 4000, unit: 'm' }),
    log('c2', { group: 'cardio', exercise: 'Treadmill', weight: 0, reps: 0, sets: 0, cardio: true, mins: 30, dist: 0, unit: 'mi' }),
  ], graves: {} });
  const w = s.tab('Workouts');
  assert.ok(w.some(r => JSON.stringify(r) === JSON.stringify(['Tom', '2026-10-05', 'Mon', 'Cardio', 'Rowing Machine', '', '', '', '', '', 20, 4000, 'm'])));
  assert.ok(w.some(r => JSON.stringify(r) === JSON.stringify(['Tom', '2026-10-05', 'Mon', 'Cardio', 'Treadmill', '', '', '', '', '', 30, '', ''])), 'no distance logged: left blank');
  assert.ok(s.sheets.get('_logs').hidden && s.sheets.get('_deleted').hidden);
  assert.equal(s.tab('Sheet1'), null, 'the empty first tab is tidied away');
});

test('the newest change wins, from either phone', () => {
  const s = fakeSheet(undefined, SECRET, TOM);
  s.post({ secret: SECRET, action: 'sync', logs: [log('a', { reps: 8, updated: T + 2000 })], graves: {} });
  let r = s.post({ secret: SECRET, action: 'sync', logs: [log('a', { reps: 6, updated: T + 1500 })], graves: {} });
  assert.equal(r.logs[0].reps, 8, 'an older copy does not win');
  r = s.post({ secret: SECRET, action: 'sync', logs: [log('a', { reps: 10, updated: T + 3000 })], graves: {} });
  assert.equal(r.logs[0].reps, 10);
});

test('a deletion reaches the other phone; Undo brings it back', () => {
  const s = fakeSheet(undefined, SECRET, TOM);
  s.post({ secret: SECRET, action: 'sync', logs: [log('a'), log('b')], graves: {} });
  // Phone 1 deletes b.
  let r = s.post({ secret: SECRET, action: 'sync', logs: [log('a')], graves: { 'logs:b': T + 2000 } });
  assert.deepEqual(r.logs.map(x => x.id), ['a']);
  assert.equal(r.graves['logs:b'], T + 2000);
  // Phone 2 still has b, unchanged since before the deletion: it stays gone.
  r = s.post({ secret: SECRET, action: 'sync', logs: [log('a'), log('b')], graves: {} });
  assert.deepEqual(r.logs.map(x => x.id), ['a']);
  // Undo on phone 1: b again, stamped after the deletion.
  r = s.post({ secret: SECRET, action: 'sync', logs: [log('a'), log('b', { updated: T + 3000 })], graves: {} });
  assert.deepEqual(r.logs.map(x => x.id).sort(), ['a', 'b']);
  assert.equal(r.graves['logs:b'], undefined);
});

test('text that looks like a formula stays text, and a long item survives the 45,000-character cell limit', () => {
  const s = fakeSheet(undefined, SECRET, TOM);
  const long = 'x'.repeat(100000);
  s.post({ secret: SECRET, action: 'sync', logs: [log('a', { exercise: '=IMPORTXML("http://x")' }), log('b', { note: long })], graves: {} });
  const w = s.tab('Workouts');
  assert.ok(s.sheets.get('Workouts').raw.includes('\'=IMPORTXML("http://x")'), 'written with a leading \' so the Sheet keeps it as text');
  assert.ok(w.some(r => r[4] === '=IMPORTXML("http://x")'), 'read back as the plain text');
  const r = s.post({ secret: SECRET, action: 'sync', logs: [], graves: {} });
  assert.equal(r.logs.find(x => x.id === 'b').note.length, 100000);
});

test('Meds and Steps: kept and sent back, with readable Meds, Med list and Steps tabs', () => {
  const s = fakeSheet(undefined, SECRET, TOM);
  assert.equal(s.tab('Meds'), null, 'no Meds tab until there is something in it');
  const meds = [{ id: 'm1', name: 'Vitamin D', dose: '1000 IU', kind: 'supp', slots: ['am'], days: [], since: '2026-10-01', updated: T + 1 },
    { id: 'm2', name: 'Ibuprofen', dose: '200 mg', kind: 'med', prn: true, slots: [], days: [], since: '2026-10-01', updated: T + 1 },
    { id: 'm3', name: 'Iron', dose: '', kind: 'supp', slots: ['pm', 'am'], days: [1, 3, 5], paused: true, since: '2026-10-02', updated: T + 1 }];
  const doses = [{ id: 'd1', med: 'm1', name: 'Vitamin D', date: '2026-10-05', slot: 'am', at: Date.parse('2026-10-05T14:05:00Z'), updated: T + 2 },
    { id: 'd2', med: 'm2', name: 'Ibuprofen', date: '2026-10-06', slot: 'prn', at: 0, updated: T + 2 }];
  const steps = [{ id: '2026-10-05', date: '2026-10-05', n: 8412, src: 'ha', updated: T + 3 }, { id: '2026-10-06', date: '2026-10-06', n: 12000, src: 'you', updated: T + 3 }];
  const r = s.post({ secret: SECRET, action: 'sync', logs: [], exercises: [], meds, doses, steps, graves: {} });
  assert.equal(r.v, 3);
  assert.equal(r.meds.length, 3); assert.equal(r.doses.length, 2); assert.equal(r.steps.length, 2);
  assert.deepEqual(s.tab('Meds'), [['Who', 'Date', 'Day', 'Time', 'Name', 'Dose', 'Type', 'When'],
    ['Tom', '2026-10-06', 'Tue', '', 'Ibuprofen', '200 mg', 'Medication', 'As needed'],
    ['Tom', '2026-10-05', 'Mon', '8:05 AM', 'Vitamin D', '1000 IU', 'Supplement', 'Morning']]);
  assert.deepEqual(s.tab('Med list').slice(1), [['Tom', 'Ibuprofen', '200 mg', 'Medication', 'As needed', 'Every day', 'Taking', '2026-10-01'],
    ['Tom', 'Iron', '', 'Supplement', 'Evening, Morning', 'Mon, Wed, Fri', 'Paused', '2026-10-02'],
    ['Tom', 'Vitamin D', '1000 IU', 'Supplement', 'Morning', 'Every day', 'Taking', '2026-10-01']]);
  assert.deepEqual(s.tab('Steps'), [['Who', 'Date', 'Day', 'Steps', 'From'], ['Tom', '2026-10-06', 'Tue', 12000, 'Typed in'], ['Tom', '2026-10-05', 'Mon', 8412, 'iPhone']]);
  assert.ok(s.sheets.get('_doses').hidden && s.sheets.get('_steps').hidden && s.sheets.get('_meds').hidden);
  // A phone that keeps only its last 90 days sends less: nothing is deleted without a grave.
  const r2 = s.post({ secret: SECRET, action: 'sync', logs: [], meds, doses: [doses[1]], steps: [], graves: {} });
  assert.equal(r2.doses.length, 2); assert.equal(r2.steps.length, 2);
  // A ticked dose taken back (a grave) goes from the Sheet too.
  const r3 = s.post({ secret: SECRET, action: 'sync', logs: [], doses: [], graves: { 'doses:d2': T + 10 } });
  assert.deepEqual(r3.doses.map(x => x.id), ['d1']);
});

test('one Sheet for the family: each person gets only their own rows, and can\'t change anyone else\'s', () => {
  const s = fakeSheet(undefined, SECRET);
  s.post({ action: 'sync', logs: [log('t1')], meds: [{ id: 'm1', name: 'Metformin', updated: T + 1 }], graves: {} }, TOM);
  const e = s.post({ action: 'sync', logs: [log('e1', { exercise: 'Hip Thrust', group: 'glutes' })], meds: [{ id: 'm2', name: 'Iron', updated: T + 1 }], graves: {} }, ELLA);
  assert.deepEqual(e.logs.map(x => x.id), ['e1'], 'Ella gets only hers');
  assert.deepEqual(e.meds.map(x => x.name), ['Iron'], 'and none of Tom\'s meds');
  const t = s.post({ action: 'sync', graves: {} }, TOM);
  assert.deepEqual(t.logs.map(x => x.id), ['t1']); assert.deepEqual(t.meds.map(x => x.name), ['Metformin']);
  // Ella's phone sending Tom's id (by mistake or not) changes nothing of his, and can't delete it
  s.post({ action: 'sync', logs: [log('t1', { reps: 1, updated: T + 9999 })], graves: { 'meds:m1': T + 9999 } }, ELLA);
  const t2 = s.post({ action: 'sync', graves: {} }, TOM);
  assert.equal(t2.logs[0].reps, 8); assert.equal(t2.meds.length, 1);
  assert.deepEqual(Object.keys(s.post({ action: 'sync', graves: {} }, ELLA).graves), [], 'nor sees his deletions');
  // each row says whose it is
  const w = s.tab('Workouts');
  assert.deepEqual(w.slice(1).map(r => r[0]).sort(), ['Ella', 'Tom']);
  assert.deepEqual(s.tab('Med list').slice(1).map(r => r[0] + ':' + r[1]), ['Ella:Iron', 'Tom:Metformin']);
});

test('rows from before aOS are the owner\'s, and written down as theirs the first time the owner syncs', () => {
  const s = fakeSheet(undefined, SECRET);
  // an old Sheet: rows with no by (as a VERSION 2 script kept them)
  s.post({ action: 'sync', logs: [log('old1')], graves: {} }, { key: SECRET, who: 'nobody' });
  s.sheets.get('_logs').cells = s.sheets.get('_logs').cells.map((r, i) => i ? [r[0], r[1], JSON.stringify(Object.assign(JSON.parse(r[2]), { by: undefined }))] : r);
  s.sheets.get('_people').cells = [['id', 'name']];
  assert.deepEqual(s.post({ action: 'sync', graves: {} }, ELLA).logs, [], 'not Ella\'s');
  assert.deepEqual(s.post({ action: 'sync', graves: {} }, TOM).logs.map(x => x.id), ['old1'], 'the owner\'s');
  assert.ok(s.tab('_logs').slice(1).every(r => JSON.parse(r[2]).by === 'tom'), 'written down as Tom\'s');
  assert.deepEqual(s.post({ action: 'sync', graves: {} }, ELLA).logs, []);
});

test('the phone keeps 90 days: dated rows older than that stay here, and come back when asked for', () => {
  const s = fakeSheet(undefined, SECRET);
  s.post({ action: 'sync', logs: [log('new', { date: '2026-10-01' }), log('old', { date: '2026-05-01' })], steps: [{ id: '2026-04-30', date: '2026-04-30', n: 9000, src: 'you', updated: T }],
    exercises: [{ id: 'x1', group: 'core', name: 'Dead Bug', updated: T }], meds: [{ id: 'm1', name: 'Iron', since: '2026-01-01', updated: T }], graves: {} }, TOM);
  const r = s.post({ action: 'sync', window: 90, today: '2026-10-20', graves: {} }, TOM);
  assert.deepEqual(r.logs.map(x => x.id), ['new']);
  assert.deepEqual(r.steps, []);
  assert.equal(r.exercises.length, 1, 'undated: always all of them'); assert.equal(r.meds.length, 1);
  const old = s.post({ action: 'range', from: '2026-04-01', to: '2026-05-31' }, TOM);
  assert.deepEqual(old.logs.map(x => x.id), ['old']); assert.equal(old.steps.length, 1);
  assert.equal(old.exercises, undefined, 'a range is only dated rows'); assert.equal(old.graves, undefined);
  assert.deepEqual(s.post({ action: 'range', from: '2026-04-01', to: '2026-05-31' }, ELLA).logs, [], 'and only yours');
});

console.log('\n' + n + ' tests passed');
