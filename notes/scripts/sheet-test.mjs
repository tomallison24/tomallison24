// Run the real shared Notes/Places Apps Script against an in-memory Sheet.
//   node notes/scripts/sheet-test.mjs
import assert from 'node:assert/strict';
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';

const GS = new URL('../google-sheet-sync.gs', import.meta.url).pathname;
const SECRET = 'test-secret-phrase';
const now = Date.now();
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok - ' + name); };
const mk = () => fakeSheet(GS, SECRET);
const sync = (s, body = {}) => s.post({ secret: SECRET, action: 'sync', notes: [], todos: [], lists: [], graves: {}, ...body });
const places = (s, body = {}) => s.post({ secret: SECRET, action: 'places', places: [], graves: {}, ...body });
const note = { id: 'n1', title: 'Dinner', body: 'Plan dinner', tags: ['home'], created: now, updated: now };
const place = { id: 'p1', name: 'Test Cafe', status: 'want', notes: 'Try brunch', tags: ['brunch'], updated: now };

test('rejects invalid secrets before opening or changing the Sheet', () => {
  const s = mk();
  assert.equal(s.post({ secret: 'incorrect', action: 'sync' }).error, 'wrong-secret');
  assert.equal(fakeSheet(GS, 'CHANGE-ME').post({ secret: 'CHANGE-ME' }).error, 'secret-not-set');
  assert.equal(s.sheets.size, 1);
});

test('Notes and Places can both connect to an empty Sheet', () => {
  const s = mk();
  assert.deepEqual(sync(s).notes, []);
  assert.deepEqual(places(s).places, []);
  assert.equal(s.sheets.size, 1);
});

test('the first Notes save succeeds even when there are no places', () => {
  const s = mk();
  assert.deepEqual(sync(s, { notes: [note] }).notes, [note]);
  assert.deepEqual(sync(s).notes, [note]);
  assert.deepEqual(places(s).places, []);
  assert.equal(s.tab('#home')[1][0], note.title);
});

test('places survive a Notes save and reload; Notes survives a Places save', () => {
  const s = mk();
  assert.deepEqual(places(s, { places: [place] }).places, [place]);
  sync(s, { notes: [note] });
  assert.deepEqual(places(s).places, [place]);
  assert.equal(s.tab('📍 Want to go')[1][0], place.name);
  const visited = { ...place, status: 'been', visited: '2026-10-01', updated: now + 1 };
  assert.deepEqual(places(s, { places: [visited] }).places, [visited]);
  assert.deepEqual(sync(s).notes, [note]);
  assert.equal(s.tab('📍 Been')[1][0], place.name);
});

test('newest Places edits win and deletion marks reach the other phone', () => {
  const s = mk();
  places(s, { places: [place] });
  const newer = { ...place, name: 'Updated Cafe', updated: now + 1 };
  places(s, { places: [newer] });
  assert.deepEqual(places(s, { places: [place] }).places, [newer]);
  const deleted = places(s, { graves: { 'places:p1': now + 2 } });
  assert.deepEqual(deleted.places, []);
  assert.equal(deleted.graves['places:p1'], now + 2);
  assert.deepEqual(places(s, { places: [place] }).places, []);
});

test('the Places endpoint cannot delete Notes through cross-kind deletion marks', () => {
  const s = mk();
  sync(s, { notes: [note] });
  places(s, { graves: { 'notes:n1': now + 1 } });
  assert.deepEqual(sync(s).notes, [note]);
});

console.log(passed + ' tests passed');
