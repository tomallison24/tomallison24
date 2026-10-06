// Runs fitness/google-sheet-sync.gs in Node against an in-memory Sheet
// (fake-sheet.mjs): the secret check, a first sync, the readable Workouts
// tab, newest change winning, a deletion reaching the other phone, Undo
// bringing one back, and formula-looking text kept as text.
//   node fitness/scripts/sheet-test.mjs
import assert from 'assert/strict';
import { fakeSheet } from './fake-sheet.mjs';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const SECRET = 'test-secret-phrase';
const T = Date.now();   // stamps near now: graves older than 400 days are dropped
const log = (id, extra) => Object.assign({ id, date: '2026-10-05', group: 'shoulders', exercise: 'Overhead Barbell Press', weight: 95, reps: 8, sets: 3, updated: T + 1000 }, extra);

test('answers a GET with its name, and refuses a wrong or unset secret', () => {
  const s = fakeSheet();
  assert.deepEqual(s.get(), { ok: true, app: 'allison-fitness-sync', v: 1 });
  assert.equal(s.post({ secret: 'nope', action: 'sync' }).error, 'wrong-secret');
  assert.equal(s.post('not json').error, 'bad-request');
  assert.equal(fakeSheet(undefined, 'CHANGE-ME').post({ secret: 'CHANGE-ME', action: 'sync' }).error, 'secret-not-set');
  // A phone's curly quotes and stray spaces don't count against you.
  assert.equal(fakeSheet(undefined, "tom's-code").post({ secret: ' tom’s-code ', action: 'sync', logs: [] }).ok, true);
});

test('a first sync stores the log and builds the Workouts tab, newest first', () => {
  const s = fakeSheet();
  const r = s.post({ secret: SECRET, action: 'sync', logs: [log('a'), log('b', { date: '2026-10-06', group: 'core', exercise: 'Plank', weight: 0, reps: 45, timed: true })], exercises: [{ id: 'x1', group: 'lowerback', name: 'Reverse Hyper', updated: 5 }], graves: {} });
  assert.equal(r.ok, true);
  assert.equal(r.logs.length, 2);
  assert.equal(r.exercises[0].name, 'Reverse Hyper');
  const w = s.tab('Workouts');
  assert.deepEqual(w[0], ['Date', 'Day', 'Muscle group', 'Exercise', 'Sets', 'Reps', 'Seconds', 'Weight (lb)', 'Volume (lb)']);
  assert.deepEqual(w[1], ['2026-10-06', 'Tue', 'Core', 'Plank', 3, '', 45, 'Bodyweight', '']);
  assert.deepEqual(w[2], ['2026-10-05', 'Mon', 'Shoulders', 'Overhead Barbell Press', 3, 8, '', 95, 2280]);
  assert.ok(s.sheets.get('_logs').hidden && s.sheets.get('_deleted').hidden);
  assert.equal(s.tab('Sheet1'), null, 'the empty first tab is tidied away');
});

test('the newest change wins, from either phone', () => {
  const s = fakeSheet();
  s.post({ secret: SECRET, action: 'sync', logs: [log('a', { reps: 8, updated: T + 2000 })], graves: {} });
  let r = s.post({ secret: SECRET, action: 'sync', logs: [log('a', { reps: 6, updated: T + 1500 })], graves: {} });
  assert.equal(r.logs[0].reps, 8, 'an older copy does not win');
  r = s.post({ secret: SECRET, action: 'sync', logs: [log('a', { reps: 10, updated: T + 3000 })], graves: {} });
  assert.equal(r.logs[0].reps, 10);
});

test('a deletion reaches the other phone; Undo brings it back', () => {
  const s = fakeSheet();
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
  const s = fakeSheet();
  const long = 'x'.repeat(100000);
  s.post({ secret: SECRET, action: 'sync', logs: [log('a', { exercise: '=IMPORTXML("http://x")' }), log('b', { note: long })], graves: {} });
  const w = s.tab('Workouts');
  assert.ok(s.sheets.get('Workouts').raw.includes('\'=IMPORTXML("http://x")'), 'written with a leading \' so the Sheet keeps it as text');
  assert.ok(w.some(r => r[3] === '=IMPORTXML("http://x")'), 'read back as the plain text');
  const r = s.post({ secret: SECRET, action: 'sync', logs: [], graves: {} });
  assert.equal(r.logs.find(x => x.id === 'b').note.length, 100000);
});

console.log('\n' + n + ' tests passed');
