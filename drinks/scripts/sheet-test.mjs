// Runs drinks/google-sheet-sync.gs in Node against an in-memory Sheet (fake-sheet.mjs): the secret check,
// a first sync, the readable Log tab (the ABV Tracker's columns, newest first, alcohol-free days as rows),
// newest change winning, a deletion reaching the other phone, and the Log tab going both ways: a row
// changed in the Sheet, a row typed in, Qty 0 removing a drink, a row that can't be read left alone with
// a note, and a deleted row coming back.
//   node drinks/scripts/sheet-test.mjs
import assert from 'assert/strict';
import { fakeSheet } from './fake-sheet.mjs';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const SECRET = 'test-secret-phrase';
const T = Date.now();   // stamps near now: graves older than 400 days are dropped
const drink = (id, extra) => Object.assign({ id, date: '2026-10-05', time: '18:30', name: 'IPA', cat: 'beer', vol: 16, unit: 'oz', abv: 6.8, qty: 1, note: '', updated: T - 10000 }, extra);
const sync = (s, body) => s.post(Object.assign({ secret: SECRET, action: 'sync', entries: [], days: [], prefs: [], graves: {} }, body));
const HEAD = ['Timestamp', 'Date', 'Time', 'Name', 'Category', 'Volume', 'Unit', 'ABV', 'Qty', 'StandardDrinks', 'GramsAlcohol', 'Note', 'EntryID', 'Check'];
const logRows = s => s.tab('Log').slice(1);
const rowOf = (s, id) => logRows(s).find(r => r[12] === id);
const rowIndex = (s, id) => s.tab('Log').findIndex(r => r[12] === id) + 1;   // 1-based, as a Sheet counts

test('answers a GET with its name, and refuses a wrong or unset secret', () => {
  const s = fakeSheet();
  assert.deepEqual(s.get(), { ok: true, app: 'allison-drinks-sync', v: 1 });
  assert.equal(s.post({ secret: 'nope', action: 'sync' }).error, 'wrong-secret');
  assert.equal(s.post('not json').error, 'bad-request');
  assert.equal(fakeSheet(undefined, 'CHANGE-ME').post({ secret: 'CHANGE-ME', action: 'sync' }).error, 'secret-not-set');
  assert.equal(fakeSheet(undefined, "tom's-code").post({ secret: ' tom’s-code ', action: 'sync', entries: [] }).ok, true);   // curly quotes and spaces don't count
});

test('a first sync builds the Log tab: the ABV Tracker columns, newest first, standard drinks worked out, alcohol-free days as rows', () => {
  const s = fakeSheet();
  const r = sync(s, { entries: [drink('a'), drink('b', { date: '2026-10-06', time: '', name: 'Pinot', cat: 'wine', vol: 5, abv: 13, note: 'with dinner' }), drink('c', { date: '2026-10-04', name: 'Beer', vol: 12, abv: 5 })],
    days: [{ id: '2026-10-03', status: 'af', updated: T + 500 }], prefs: [{ id: 'goals', week: 10, day: 3, af: 4, updated: T }] });
  assert.equal(r.ok, true);
  assert.equal(r.entries.length, 3); assert.equal(r.days.length, 1); assert.equal(r.prefs[0].week, 10);
  const log = s.tab('Log');
  assert.deepEqual(log[0], HEAD);
  assert.deepEqual(log.slice(1).map(x => x[1]), ['2026-10-06', '2026-10-05', '2026-10-04', '2026-10-03'], 'newest first');
  assert.deepEqual(log[1].slice(1, 13), ['2026-10-06', '', 'Pinot', 'Wine', 5, 'oz', 13, 1, 1.08, 15.2, 'with dinner', 'b']);
  const beer = rowOf(s, 'c');
  assert.equal(beer[9], 1, '12 oz of 5% beer is one standard drink'); assert.equal(beer[10], 14, 'and 14 g of alcohol');
  assert.match(beer[0], /^\d{4}-\d{2}-\d{2}T/, 'the timestamp is when it last changed');
  const af = logRows(s).find(r => r[4] === 'alcohol-free');
  assert.deepEqual(af.slice(1, 4), ['2026-10-03', '', 'Alcohol-free day']); assert.equal(af[12], 'af-2026-10-03'); assert.equal(af[8], '', 'no quantity: Qty 0 is what removes it');
  for (const t of ['_entries', '_days', '_prefs', '_deleted', '_rows']) assert.ok(s.sheets.get(t).hidden, t + ' is hidden');
  assert.equal(s.tab('Sheet1'), null, 'the empty first tab is tidied away');
});

test('the newest change wins, from either phone', () => {
  const s = fakeSheet();
  sync(s, { entries: [drink('a', { qty: 1, updated: T + 2000 })] });
  let r = sync(s, { entries: [drink('a', { qty: 2, updated: T + 1500 })] });
  assert.equal(r.entries[0].qty, 1, 'an older copy does not win');
  r = sync(s, { entries: [drink('a', { qty: 3, updated: T + 3000 })] });
  assert.equal(r.entries[0].qty, 3);
  assert.equal(rowOf(s, 'a')[8], 3, 'and the Log tab says so');
});

test('a deletion reaches the other phone; Undo brings it back', () => {
  const s = fakeSheet();
  sync(s, { entries: [drink('a'), drink('b')] });
  let r = sync(s, { entries: [drink('a')], graves: { 'entries:b': T + 2000 } });
  assert.deepEqual(r.entries.map(x => x.id), ['a']);
  assert.equal(r.graves['entries:b'], T + 2000);
  assert.equal(rowOf(s, 'b'), undefined, 'gone from the Log tab');
  r = sync(s, { entries: [drink('a'), drink('b')] });    // the other phone still has b, unchanged since before: it stays gone
  assert.deepEqual(r.entries.map(x => x.id), ['a']);
  r = sync(s, { entries: [drink('a'), drink('b', { updated: T + 3000 })] });   // Undo
  assert.deepEqual(r.entries.map(x => x.id).sort(), ['a', 'b']);
  assert.equal(r.graves['entries:b'], undefined);
});

test('a change typed into a row of the Log tab comes back to the app (Timestamp, StandardDrinks and GramsAlcohol follow)', () => {
  const s = fakeSheet();
  sync(s, { entries: [drink('a'), drink('b', { name: 'Wine', cat: 'wine', vol: 5, abv: 13 })] });
  const i = rowIndex(s, 'a');
  s.type(i, 'ABV', 7.5); s.type(i, 'Note', 'a big one');
  const r = sync(s, {});    // any sync, from any phone, picks the change up
  const a = r.entries.find(x => x.id === 'a');
  assert.equal(a.abv, 7.5); assert.equal(a.note, 'a big one'); assert.equal(a.name, 'IPA');
  assert.ok(a.updated > T - 10000, 'stamped when it was typed, so it beats the app\'s older copy');
  assert.equal(r.entries.find(x => x.id === 'b').abv, 13, 'the other row is untouched');
  const row = rowOf(s, 'a');
  assert.equal(row[7], 7.5); assert.equal(row[9], 2, '16 oz at 7.5%'); assert.equal(row[10], 28);
  // and the phone's own newer change to that drink wins over an older typed one
  s.type(rowIndex(s, 'a'), 'Qty', 2);
  const typedAt = Date.parse(rowOf(s, 'a')[0]);
  const r2 = sync(s, { entries: [drink('a', { abv: 7.5, qty: 1, note: 'a big one', updated: typedAt + 60000, name: 'IPA (the app)' })] });
  assert.equal(r2.entries.find(x => x.id === 'a').name, 'IPA (the app)');
  assert.equal(r2.entries.find(x => x.id === 'a').qty, 1, 'newer in the app than the typed Qty');
});

test('a Sheet row older than the app\'s copy does not win', () => {
  const s = fakeSheet();
  sync(s, { entries: [drink('a', { updated: T + 5000 })] });
  const i = rowIndex(s, 'a');
  s.type(i, 'ABV', 9);
  s.tab('Log')[i - 1][0] = new Date(T + 100).toISOString();     // typed long ago, but only now noticed
  const r = sync(s, {});
  assert.equal(r.entries[0].abv, 6.8);
  assert.equal(rowOf(s, 'a')[7], 6.8, 'the row is put right');
});

test('a row typed in becomes a drink: the Timestamp, EntryID and sums fill themselves in, and Qty left empty is 1', () => {
  const s = fakeSheet();
  sync(s, { entries: [drink('a')] });
  const log = s.tab('Log'), i = log.length + 1;
  s.type(i, 'Date', '2026-10-07'); s.type(i, 'Name', 'Old Fashioned'); s.type(i, 'Category', 'Cocktail');
  s.type(i, 'Volume', 2); s.type(i, 'Unit', 'oz'); s.type(i, 'ABV', 40);
  assert.ok(log[i - 1][12], 'an EntryID was made'); assert.match(log[i - 1][0], /^\d{4}-/); assert.equal(log[i - 1][9], 1.33, '2 oz of 40%');
  const r = sync(s, {});
  const x = r.entries.find(e => e.name === 'Old Fashioned');
  assert.ok(x, 'it is in what the app hears'); assert.deepEqual([x.date, x.cat, x.vol, x.unit, x.abv, x.qty, x.time], ['2026-10-07', 'cocktail', 2, 'oz', 40, 1, '']);
  assert.equal(x.id, log[i - 1][12] || x.id);
  assert.equal(logRows(s).filter(r => r[3] === 'Old Fashioned').length, 1, 'once in the Log tab');
  assert.equal(logRows(s)[0][3], 'Old Fashioned', 'and, being newest, first');
});

test('US dates and 12-hour times typed by hand are understood', () => {
  const s = fakeSheet();
  sync(s, { entries: [drink('a')] });
  const i = s.tab('Log').length + 1;
  s.type(i, 'Date', '10/9/2026'); s.type(i, 'Time', '6:45 PM'); s.type(i, 'Name', 'Wine'); s.type(i, 'Category', 'wine'); s.type(i, 'Volume', '5'); s.type(i, 'ABV', '13');
  const x = sync(s, {}).entries.find(e => e.name === 'Wine');
  assert.deepEqual([x.date, x.time, x.vol, x.abv], ['2026-10-09', '18:45', 5, 13]);
});

test('Qty 0 removes a drink, or an alcohol-free day, in the app too', () => {
  const s = fakeSheet();
  sync(s, { entries: [drink('a'), drink('b')], days: [{ id: '2026-10-03', status: 'af', updated: T }] });
  s.type(rowIndex(s, 'b'), 'Qty', 0);
  s.type(rowIndex(s, 'af-2026-10-03'), 'Qty', 0);
  const r = sync(s, {});
  assert.deepEqual(r.entries.map(x => x.id), ['a']);
  assert.equal(r.days.length, 0);
  assert.ok(r.graves['entries:b'] > 0 && r.graves['days:2026-10-03'] > 0, 'recorded, so the phones delete them');
  assert.equal(rowOf(s, 'b'), undefined, 'gone from the Log tab');
  // a phone that still has it, from before, does not bring it back
  assert.deepEqual(sync(s, { entries: [drink('b')] }).entries.map(x => x.id), ['a']);
});

test('an alcohol-free row typed in becomes an alcohol-free day', () => {
  const s = fakeSheet();
  sync(s, { entries: [drink('a')] });
  const i = s.tab('Log').length + 1;
  s.type(i, 'Date', '2026-10-08'); s.type(i, 'Category', 'alcohol-free');
  const r = sync(s, {});
  assert.deepEqual(r.days.map(d => [d.id, d.status]), [['2026-10-08', 'af']]);
});

test('a row that can\'t be read stays where it is with a note, is not sent to the app, and comes in once fixed', () => {
  const s = fakeSheet();
  sync(s, { entries: [drink('a')] });
  const i = s.tab('Log').length + 1;
  s.type(i, 'Name', 'Mystery'); s.type(i, 'Volume', 12); s.type(i, 'ABV', 5);    // no date
  let r = sync(s, { entries: [drink('a', { updated: T + 2000, note: 'x' })] });
  assert.ok(!r.entries.some(e => e.name === 'Mystery'));
  let row = logRows(s).find(x => x[3] === 'Mystery');
  assert.ok(row, 'still there'); assert.match(row[13], /date/i, 'with a note about what is wrong'); assert.equal(logRows(s).filter(x => x[3] === 'Mystery').length, 1);
  s.type(rowIndex(s, row[12]), 'Date', '2026-10-09');
  r = sync(s, {});
  assert.ok(r.entries.some(e => e.name === 'Mystery' && e.date === '2026-10-09'));
  assert.equal(logRows(s).find(x => x[3] === 'Mystery')[13], '', 'the note is gone');
});

test('deleting a row from the Log tab does not remove the drink: the app puts it back', () => {
  const s = fakeSheet();
  sync(s, { entries: [drink('a'), drink('b')] });
  const sh = s.sheets.get('Log'), i = rowIndex(s, 'b');
  sh.cells.splice(i - 1, 1);
  const r = sync(s, {});
  assert.deepEqual(r.entries.map(x => x.id).sort(), ['a', 'b']);
  assert.ok(rowOf(s, 'b'), 'the row is back');
});

test('the ABV Tracker\'s own rows (unknown days, the connection test) are left out, and its alcohol-free days come in', () => {
  const s = fakeSheet();
  sync(s, { entries: [drink('a')] });
  const log = s.sheets.get('Log');
  log.cells.push(['2026-09-01T10:00:00Z', '2026-09-01', '', 'Unknown day', 'unknown day', '', '', '', '', '', '', '', 'u1', '']);
  log.cells.push(['2026-09-01T10:00:00Z', '2026-09-02', '', '__connection test__', 'other', 1, 'oz', 0, 1, '', '', '', 'test', '']);
  log.cells.push(['2026-09-04T10:00:00Z', '2026-09-04', '', 'Alcohol-free day', 'alcohol-free', '', '', '', '', 0, 0, '', 'abv9', '']);
  log.cells.push(['2026-09-05T20:00:00Z', '2026-09-05', '20:00', 'Beer', 'beer', 12, 'oz', 5, 1, 1, 14, '', 'abv10', '']);
  const r = sync(s, {});
  assert.deepEqual(r.days.map(d => d.id), ['2026-09-04']);
  assert.ok(r.entries.some(e => e.id === 'abv10' && e.date === '2026-09-05'));
  assert.ok(!r.entries.some(e => e.id === 'u1' || e.id === 'test'));
});

test('text that looks like a formula stays text, and a long note survives the 45,000-character cell limit', () => {
  const s = fakeSheet();
  const long = 'x'.repeat(100000);
  sync(s, { entries: [drink('a', { name: '=IMPORTXML("http://x")' }), drink('b', { note: long })] });
  assert.ok(s.sheets.get('Log').raw.includes('\'=IMPORTXML("http://x")'), 'written with a leading \' so the Sheet keeps it as text');
  assert.ok(logRows(s).some(r => r[3] === '=IMPORTXML("http://x")'));
  const r = sync(s, {});
  assert.equal(r.entries.find(x => x.id === 'b').note.length, 100000, 'the long note is kept whole in the hidden tab');
  assert.equal(rowOf(s, 'b')[11].length, 200, 'and the Log row, like the app, shows 200 characters at most');
});

console.log('\n' + n + ' tests passed');
