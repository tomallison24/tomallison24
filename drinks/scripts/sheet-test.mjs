// Runs drinks/google-sheet-sync.gs in Node against an in-memory Sheet (fake-sheet.mjs), as aOS reaches
// it (functions/sheet/api: the phrase and who's asking on the link): who gets in, a first sync, the
// readable Log tab (Who first, then the ABV Tracker's columns, newest first, alcohol-free days as rows),
// newest change winning, a deletion reaching the other phone; one Sheet for the family: each person gets
// only their own (their own alcohol-free days and goals too, on the same dates), nobody can change or
// delete another's, rows from before aOS become the owner's, the last 90 days and older days on asking,
// the summary Fitness and Calendar read; and the Log tab going both ways: a row changed in the Sheet, a
// row typed in (its Who saying whose), Qty 0 removing a drink, a row that can't be read left alone with
// a note, and a deleted row coming back.
//   node drinks/scripts/sheet-test.mjs
import assert from 'assert/strict';
import { fakeSheet } from './fake-sheet.mjs';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const SECRET = 'test-secret-phrase';
// what aOS adds to every request (functions/sheet/api): the phrase, and who's asking
const TOM = { key: SECRET, who: 'tom', name: 'Tom', owner: '1' }, ELLA = { key: SECRET, who: 'ella', name: 'Ella' };
const T = Date.now();   // stamps near now: graves older than 400 days are dropped
const sheet = () => fakeSheet(undefined, SECRET, TOM);
const drink = (id, extra) => Object.assign({ id, date: '2026-10-05', time: '18:30', name: 'IPA', cat: 'beer', vol: 16, unit: 'oz', abv: 6.8, qty: 1, note: '', updated: T - 10000 }, extra);
const sync = (s, body, as) => s.post(Object.assign({ action: 'sync', entries: [], days: [], prefs: [], graves: {} }, body), as);
const HEAD = ['Who', 'Timestamp', 'Date', 'Time', 'Name', 'Category', 'Volume', 'Unit', 'ABV', 'Qty', 'StandardDrinks', 'GramsAlcohol', 'Note', 'EntryID', 'Check'];
const C = Object.fromEntries(HEAD.map((h, i) => [h, i]));
const logRows = s => s.tab('Log').slice(1);
const rowOf = (s, id) => logRows(s).find(r => r[C.EntryID] === id);
const rowIndex = (s, id) => s.tab('Log').findIndex(r => r[C.EntryID] === id) + 1;   // 1-based, as a Sheet counts
const ymd = t => new Date(t).toISOString().slice(0, 10);
const TODAY = ymd(T), ago = d => ymd(Date.parse(TODAY + 'T12:00:00Z') - d * 864e5);

test('answers a GET with its name; only aOS, with the phrase and who\'s asking, gets in', () => {
  const s = sheet();
  assert.deepEqual(s.get(), { ok: true, app: 'allison-drinks-sync', v: 2, aos: true });
  assert.equal(s.post({ action: 'sync' }, { key: 'nope', who: 'tom' }).error, 'wrong-secret');
  const old = s.post({ secret: SECRET, action: 'sync' }, {});
  assert.deepEqual([old.ok, old.error, old.aos], [false, 'wrong-secret', true], 'a phone with the phrase in its request, as before aOS, gets nothing');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET }).error, 'who');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET, who: 'a b' }).error, 'who');
  assert.equal(s.post('not json').error, 'bad-request');
  assert.equal(fakeSheet(undefined, 'CHANGE-ME').post({ action: 'sync' }, { key: 'CHANGE-ME', who: 'tom' }).error, 'secret-not-set');
  assert.deepEqual(s.post({ action: 'ping' }), { ok: true, app: 'allison-drinks-sync', v: 2, aos: true });
  assert.equal(s.tab('Log'), null, 'a ping writes nothing');
  assert.equal(fakeSheet(undefined, "tom's-code").post({ action: 'sync', entries: [] }, { key: ' tom’s-code ', who: 'tom' }).ok, true, 'curly quotes and spaces don\'t count');
});

test('a first sync builds the Log tab: Who, then the ABV Tracker columns, newest first, standard drinks worked out, alcohol-free days as rows', () => {
  const s = sheet();
  const r = sync(s, { entries: [drink('a'), drink('b', { date: '2026-10-06', time: '', name: 'Pinot', cat: 'wine', vol: 5, abv: 13, note: 'with dinner' }), drink('c', { date: '2026-10-04', name: 'Beer', vol: 12, abv: 5 })],
    days: [{ id: '2026-10-03', status: 'af', updated: T + 500 }], prefs: [{ id: 'goals', week: 10, day: 3, af: 4, updated: T }] });
  assert.equal(r.ok, true); assert.equal(r.aos, true); assert.equal(r.by, 'tom');
  assert.equal(r.entries.length, 3); assert.equal(r.days.length, 1); assert.equal(r.prefs[0].week, 10);
  assert.ok(r.entries.every(x => x.by === 'tom'), 'each kept as Tom\'s');
  const log = s.tab('Log');
  assert.deepEqual(log[0], HEAD);
  assert.deepEqual(log.slice(1).map(x => x[C.Date]), ['2026-10-06', '2026-10-05', '2026-10-04', '2026-10-03'], 'newest first');
  assert.deepEqual(log[1].slice(0, 14).filter((v, i) => i !== C.Timestamp), ['Tom', '2026-10-06', '', 'Pinot', 'Wine', 5, 'oz', 13, 1, 1.08, 15.2, 'with dinner', 'b']);
  const beer = rowOf(s, 'c');
  assert.equal(beer[C.StandardDrinks], 1, '12 oz of 5% beer is one standard drink'); assert.equal(beer[C.GramsAlcohol], 14, 'and 14 g of alcohol');
  assert.match(beer[C.Timestamp], /^\d{4}-\d{2}-\d{2}T/, 'the timestamp is when it last changed');
  const af = logRows(s).find(r => r[C.Category] === 'alcohol-free');
  assert.deepEqual([af[C.Who], af[C.Date], af[C.Time], af[C.Name]], ['Tom', '2026-10-03', '', 'Alcohol-free day']); assert.equal(af[C.EntryID], 'af-2026-10-03'); assert.equal(af[C.Qty], '', 'no quantity: Qty 0 is what removes it');
  for (const t of ['_entries', '_days', '_prefs', '_deleted', '_rows', '_people']) assert.ok(s.sheets.get(t).hidden, t + ' is hidden');
  assert.deepEqual(s.tab('_people'), [['id', 'name'], ['(owner)', 'tom'], ['tom', 'Tom']]);
  assert.equal(s.tab('Sheet1'), null, 'the empty first tab is tidied away');
});

test('the newest change wins, from either phone', () => {
  const s = sheet();
  sync(s, { entries: [drink('a', { qty: 1, updated: T + 2000 })] });
  let r = sync(s, { entries: [drink('a', { qty: 2, updated: T + 1500 })] });
  assert.equal(r.entries[0].qty, 1, 'an older copy does not win');
  r = sync(s, { entries: [drink('a', { qty: 3, updated: T + 3000 })] });
  assert.equal(r.entries[0].qty, 3);
  assert.equal(rowOf(s, 'a')[C.Qty], 3, 'and the Log tab says so');
});

test('a deletion reaches the other phone; Undo brings it back', () => {
  const s = sheet();
  sync(s, { entries: [drink('a'), drink('b')], days: [{ id: '2026-10-03', status: 'af', updated: T }] });
  let r = sync(s, { entries: [drink('a')], graves: { 'entries:b': T + 2000, 'days:2026-10-03': T + 2000 } });
  assert.deepEqual(r.entries.map(x => x.id), ['a']); assert.deepEqual(r.days, []);
  assert.equal(r.graves['entries:b'], T + 2000); assert.equal(r.graves['days:2026-10-03'], T + 2000, 'graves come back by the ids the phone knows');
  assert.equal(rowOf(s, 'b'), undefined, 'gone from the Log tab');
  r = sync(s, { entries: [drink('a'), drink('b')] });    // the other phone still has b, unchanged since before: it stays gone
  assert.deepEqual(r.entries.map(x => x.id), ['a']);
  r = sync(s, { entries: [drink('a'), drink('b', { updated: T + 3000 })] });   // Undo
  assert.deepEqual(r.entries.map(x => x.id).sort(), ['a', 'b']);
  assert.equal(r.graves['entries:b'], undefined);
});

// ---- one Sheet for the family ----

test('each person gets only their own: drinks, alcohol-free days and goals, even on the same dates and with the same ids', () => {
  const s = sheet();
  sync(s, { entries: [drink('t1')], days: [{ id: '2026-10-03', status: 'af', updated: T }], prefs: [{ id: 'goals', week: 10, day: 3, af: 4, updated: T }] });
  const e = sync(s, { entries: [drink('e1', { name: 'Cider', cat: 'cider' })], days: [{ id: '2026-10-03', status: 'af', updated: T + 1 }], prefs: [{ id: 'goals', week: 7, day: 2, af: 5, updated: T + 1 }] }, ELLA);
  assert.deepEqual(e.entries.map(x => x.id), ['e1'], 'Ella gets hers, not Tom\'s');
  assert.deepEqual(e.days.map(d => d.id), ['2026-10-03']); assert.equal(e.days[0].by, 'ella');
  assert.deepEqual(e.prefs.map(p => p.week), [7]);
  const t = sync(s, {});
  assert.deepEqual(t.entries.map(x => x.id), ['t1']); assert.deepEqual(t.prefs.map(p => p.week), [10], 'Tom\'s goals are still his');
  assert.equal(t.days.length, 1); assert.equal(t.days[0].by, 'tom');
  assert.deepEqual(t.graves, {}); assert.deepEqual(e.graves, {});
  // the Log tab has both, each with whose it is; Ella's alcohol-free day says it's hers
  assert.deepEqual(logRows(s).map(r => [r[C.Who], r[C.EntryID]]).sort(), [['Ella', 'af-2026-10-03-ella'], ['Ella', 'e1'], ['Tom', 'af-2026-10-03'], ['Tom', 't1']]);
  // Ella removing her alcohol-free day leaves Tom's
  const e2 = sync(s, { graves: { 'days:2026-10-03': T + 50 } }, ELLA);
  assert.deepEqual(e2.days, []); assert.equal(e2.graves['days:2026-10-03'], T + 50);
  const t2 = sync(s, {});
  assert.equal(t2.days.length, 1, 'Tom\'s day is still there'); assert.deepEqual(t2.graves, {}, 'and he hears of no grave');
});

test('nobody can change or delete another\'s drink, whatever their phone sends', () => {
  const s = sheet();
  sync(s, { entries: [drink('t1', { qty: 1, updated: T })] });
  const e = sync(s, { entries: [drink('t1', { qty: 9, updated: T + 99999 })], graves: { 'entries:t1': T + 99999 } }, ELLA);
  assert.deepEqual(e.entries, [], 'Ella sees nothing of it'); assert.deepEqual(e.graves, {});
  const t = sync(s, {});
  assert.equal(t.entries.length, 1); assert.equal(t.entries[0].qty, 1, 'unchanged'); assert.equal(t.entries[0].by, 'tom');
  assert.equal(rowOf(s, 't1')[C.Qty], 1);
});

test('rows from before aOS (no by) become the owner\'s: hidden until the owner comes, then written down as theirs', () => {
  // a Sheet from VERSION 1: its hidden tabs, as that script wrote them (no by, no _people)
  const v1 = fakeSheet(undefined, SECRET, ELLA), mk = (name, rows) => v1.put(name, rows);
  mk('_entries', [['id', 'updated', 'data'], ['old1', T - 5000, JSON.stringify(drink('old1', { updated: T - 5000 }))]]);
  mk('_days', [['id', 'updated', 'data'], ['2026-10-01', T - 5000, JSON.stringify({ id: '2026-10-01', status: 'af', updated: T - 5000 })]]);
  mk('_prefs', [['id', 'updated', 'data'], ['goals', T - 5000, JSON.stringify({ id: 'goals', week: 12, day: 4, af: 2, updated: T - 5000 })]]);
  mk('_deleted', [['item', 'deleted'], ['entries:gone1', T - 4000], ['days:2026-09-30', T - 4000]]);
  // Ella syncs first: none of it is hers
  const e = sync(v1, { days: [{ id: '2026-10-01', status: 'af', updated: T - 1 }] });
  assert.deepEqual(e.entries, []); assert.deepEqual(e.prefs, []); assert.deepEqual(e.graves, {}, 'nor the old graves');
  assert.deepEqual(e.days.map(d => [d.id, d.by]), [['2026-10-01', 'ella']], 'her own day on the same date is hers alone');
  // the owner comes: the old rows are his, and say so
  const t = sync(v1, {}, TOM);
  assert.deepEqual(t.entries.map(x => [x.id, x.by]), [['old1', 'tom']]);
  assert.deepEqual(t.days.map(d => [d.id, d.by, d.updated]), [['2026-10-01', 'tom', T - 5000]], 'his old day, not Ella\'s');
  assert.equal(t.prefs[0].week, 12);
  assert.deepEqual(Object.keys(t.graves).sort(), ['days:2026-09-30', 'entries:gone1']);
  assert.ok(JSON.parse(v1.tab('_entries')[1].slice(2).join('')).by === 'tom', 'written down as his');
  assert.deepEqual(v1.tab('_people').slice(0, 2), [['id', 'name'], ['(owner)', 'tom']]);
  assert.deepEqual(sync(v1, {}).days.map(d => d.by), ['ella'], 'and Ella still has just hers');
});

test('the last 90 days of anything dated, everything undated; older days when asked for (range)', () => {
  const s = sheet();
  sync(s, { entries: [drink('now', { date: TODAY }), drink('d89', { date: ago(89) }), drink('d90', { date: ago(90) }), drink('d200', { date: ago(200) })],
    days: [{ id: ago(10), status: 'af', updated: T }, { id: ago(120), status: 'af', updated: T }], prefs: [{ id: 'goals', week: 10, day: 3, af: 4, updated: T }] });
  sync(s, { entries: [drink('ella-old', { date: ago(120) })] }, ELLA);
  const r = s.post({ action: 'sync', window: 90, today: TODAY, entries: [], days: [], prefs: [], graves: {} });
  assert.deepEqual(r.entries.map(x => x.id).sort(), ['d89', 'now'], '90 days, today included');
  assert.deepEqual(r.days.map(d => d.id), [ago(10)]);
  assert.equal(r.prefs.length, 1, 'goals have no date: always');
  const old = s.post({ action: 'range', from: ago(150), to: ago(90) });
  assert.deepEqual(old.entries.map(x => x.id), ['d90']);
  assert.deepEqual(old.days.map(d => d.id), [ago(120)]);
  assert.equal(old.prefs, undefined, 'a range is dated kinds only'); assert.equal(old.graves, undefined, 'and no graves');
  assert.deepEqual(s.post({ action: 'range', from: ago(150), to: ago(90) }, ELLA).entries.map(x => x.id), ['ella-old'], 'a range is your own too');
  assert.equal(s.post({ action: 'range', from: 'x', to: ago(1) }).entries.length, 4, 'a range that isn\'t one is everything as before');
});

test('the summary Fitness and Calendar read: your own days, standard drinks (a drink beats an alcohol-free mark) or alcohol-free', () => {
  const s = sheet();
  sync(s, { entries: [drink('w1', { date: '2026-10-06', cat: 'wine', vol: 5, abv: 13, qty: 2 }), drink('m1', { date: '2026-10-07', vol: 355, unit: 'ml', abv: 12 }), drink('x', { date: '2026-09-01' })],
    days: [{ id: '2026-10-08', status: 'af', updated: T }, { id: '2026-10-07', status: 'af', updated: T }] });
  sync(s, { entries: [drink('e1', { date: '2026-10-08' })], days: [{ id: '2026-10-06', status: 'af', updated: T }] }, ELLA);
  const r = s.post({ action: 'summary', from: '2026-10-06', to: '2026-10-08' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.days, { '2026-10-06': { sd: 2.17, n: 2 }, '2026-10-07': { sd: 2.4, n: 1 }, '2026-10-08': { status: 'af' } });
  assert.equal(r.entries, undefined, 'just the days');
  assert.deepEqual(s.post({ action: 'summary', from: '2026-10-06', to: '2026-10-08' }, ELLA).days, { '2026-10-06': { status: 'af' }, '2026-10-08': { sd: 1.81, n: 1 } }, 'Ella\'s are hers');
  assert.deepEqual(s.post({ action: 'summary', from: '2026-10-08', to: '2026-10-06' }).days, {}, 'backwards: nothing');
  assert.deepEqual(s.post({ action: 'summary', from: '2025-01-01', to: '2026-10-08' }).days, {}, 'over 400 days: nothing');
});

// ---- the Log tab, both ways ----

test('a change typed into a row of the Log tab comes back to the app (Timestamp, StandardDrinks and GramsAlcohol follow)', () => {
  const s = sheet();
  sync(s, { entries: [drink('a'), drink('b', { name: 'Wine', cat: 'wine', vol: 5, abv: 13 })] });
  const i = rowIndex(s, 'a');
  s.type(i, 'ABV', 7.5); s.type(i, 'Note', 'a big one');
  const r = sync(s, {});    // any sync, from any phone, picks the change up
  const a = r.entries.find(x => x.id === 'a');
  assert.equal(a.abv, 7.5); assert.equal(a.note, 'a big one'); assert.equal(a.name, 'IPA'); assert.equal(a.by, 'tom', 'still Tom\'s');
  assert.ok(a.updated > T - 10000, 'stamped when it was typed, so it beats the app\'s older copy');
  assert.equal(r.entries.find(x => x.id === 'b').abv, 13, 'the other row is untouched');
  const row = rowOf(s, 'a');
  assert.equal(row[C.ABV], 7.5); assert.equal(row[C.StandardDrinks], 2, '16 oz at 7.5%'); assert.equal(row[C.GramsAlcohol], 28);
  // and the phone's own newer change to that drink wins over an older typed one
  s.type(rowIndex(s, 'a'), 'Qty', 2);
  const typedAt = Date.parse(rowOf(s, 'a')[C.Timestamp]);
  const r2 = sync(s, { entries: [drink('a', { abv: 7.5, qty: 1, note: 'a big one', updated: typedAt + 60000, name: 'IPA (the app)' })] });
  assert.equal(r2.entries.find(x => x.id === 'a').name, 'IPA (the app)');
  assert.equal(r2.entries.find(x => x.id === 'a').qty, 1, 'newer in the app than the typed Qty');
});

test('a change typed into someone else\'s row stays theirs, whatever its Who says', () => {
  const s = sheet();
  sync(s, { entries: [drink('e1')] }, ELLA);
  const i = rowIndex(s, 'e1');
  assert.equal(rowOf(s, 'e1')[C.Who], 'Ella');
  s.type(i, 'Qty', 3); s.type(i, 'Who', 'Tom');
  const e = sync(s, {}, ELLA);
  assert.deepEqual(e.entries.map(x => [x.id, x.qty, x.by]), [['e1', 3, 'ella']]);
  assert.deepEqual(sync(s, {}).entries, [], 'Tom doesn\'t get it');
  assert.equal(rowOf(s, 'e1')[C.Who], 'Ella', 'the row is put right');
});

test('a Sheet row older than the app\'s copy does not win', () => {
  const s = sheet();
  sync(s, { entries: [drink('a', { updated: T + 5000 })] });
  const i = rowIndex(s, 'a');
  s.type(i, 'ABV', 9);
  s.tab('Log')[i - 1][C.Timestamp] = new Date(T + 100).toISOString();     // typed long ago, but only now noticed
  const r = sync(s, {});
  assert.equal(r.entries[0].abv, 6.8);
  assert.equal(rowOf(s, 'a')[C.ABV], 6.8, 'the row is put right');
});

test('a row typed in becomes a drink: the Timestamp, EntryID and sums fill themselves in, Qty left empty is 1, and Who empty is the owner\'s', () => {
  const s = sheet();
  sync(s, { entries: [drink('a')] });
  sync(s, {}, ELLA);
  const log = s.tab('Log'), i = log.length + 1;
  s.type(i, 'Date', '2026-10-07'); s.type(i, 'Name', 'Old Fashioned'); s.type(i, 'Category', 'Cocktail');
  s.type(i, 'Volume', 2); s.type(i, 'Unit', 'oz'); s.type(i, 'ABV', 40);
  assert.ok(log[i - 1][C.EntryID], 'an EntryID was made'); assert.match(log[i - 1][C.Timestamp], /^\d{4}-/); assert.equal(log[i - 1][C.StandardDrinks], 1.33, '2 oz of 40%');
  const r = sync(s, {});
  const x = r.entries.find(e => e.name === 'Old Fashioned');
  assert.ok(x, 'it is in what the owner hears'); assert.deepEqual([x.date, x.cat, x.vol, x.unit, x.abv, x.qty, x.time, x.by], ['2026-10-07', 'cocktail', 2, 'oz', 40, 1, '', 'tom']);
  assert.equal(x.id, log[i - 1][C.EntryID] || x.id);
  assert.equal(logRows(s).filter(r => r[C.Name] === 'Old Fashioned').length, 1, 'once in the Log tab');
  assert.equal(logRows(s)[0][C.Name], 'Old Fashioned', 'and, being newest, first');
  assert.equal(logRows(s)[0][C.Who], 'Tom');
  assert.ok(!sync(s, {}, ELLA).entries.some(e => e.name === 'Old Fashioned'), 'Ella doesn\'t get it');
});

test('a row typed in with a Who is that person\'s (their first name, any case); a Who the Sheet doesn\'t know is left with a note', () => {
  const s = sheet();
  sync(s, { entries: [drink('a')] });
  sync(s, {}, ELLA);
  let i = s.tab('Log').length + 1;
  s.type(i, 'Who', 'ella'); s.type(i, 'Date', '2026-10-07'); s.type(i, 'Name', 'Spritz'); s.type(i, 'Category', 'Cocktail'); s.type(i, 'Volume', 5); s.type(i, 'ABV', 11);
  i++;
  s.type(i, 'Who', 'Ella'); s.type(i, 'Date', '2026-10-08'); s.type(i, 'Category', 'alcohol-free');
  i++;
  s.type(i, 'Who', 'Grandpa'); s.type(i, 'Date', '2026-10-07'); s.type(i, 'Name', 'Port'); s.type(i, 'Category', 'Wine'); s.type(i, 'Volume', 3); s.type(i, 'ABV', 20);
  sync(s, {});
  const e = sync(s, {}, ELLA);
  assert.deepEqual(e.entries.map(x => [x.name, x.by]), [['Spritz', 'ella']]);
  assert.deepEqual(e.days.map(d => [d.id, d.by]), [['2026-10-08', 'ella']]);
  assert.ok(!sync(s, {}).entries.some(x => x.name === 'Spritz' || x.name === 'Port'), 'not Tom\'s, and the unknown Who is no one\'s yet');
  const port = logRows(s).find(r => r[C.Name] === 'Port');
  assert.ok(port, 'still there'); assert.match(port[C.Check], /^Who: the first name of someone in the family/);
  assert.equal(port[C.Who], 'Grandpa', 'as typed');
  assert.equal(logRows(s).find(r => r[C.Name] === 'Spritz')[C.Who], 'Ella', 'written back with her name as the Sheet has it');
  assert.equal(rowOf(s, 'af-2026-10-08-ella')[C.Who], 'Ella');
  // fixed: it comes in
  s.type(rowIndex(s, port[C.EntryID]), 'Who', 'Tom');
  assert.ok(sync(s, {}).entries.some(x => x.name === 'Port'));
});

test('US dates and 12-hour times typed by hand are understood', () => {
  const s = sheet();
  sync(s, { entries: [drink('a')] });
  const i = s.tab('Log').length + 1;
  s.type(i, 'Date', '10/9/2026'); s.type(i, 'Time', '6:45 PM'); s.type(i, 'Name', 'Wine'); s.type(i, 'Category', 'wine'); s.type(i, 'Volume', '5'); s.type(i, 'ABV', '13');
  const x = sync(s, {}).entries.find(e => e.name === 'Wine');
  assert.deepEqual([x.date, x.time, x.vol, x.abv], ['2026-10-09', '18:45', 5, 13]);
});

test('Qty 0 removes a drink, or an alcohol-free day, in the app too', () => {
  const s = sheet();
  sync(s, { entries: [drink('a'), drink('b')], days: [{ id: '2026-10-03', status: 'af', updated: T }] });
  sync(s, { days: [{ id: '2026-10-03', status: 'af', updated: T }] }, ELLA);
  s.type(rowIndex(s, 'b'), 'Qty', 0);
  s.type(rowIndex(s, 'af-2026-10-03'), 'Qty', 0);
  const r = sync(s, {});
  assert.deepEqual(r.entries.map(x => x.id), ['a']);
  assert.equal(r.days.length, 0);
  assert.ok(r.graves['entries:b'] > 0 && r.graves['days:2026-10-03'] > 0, 'recorded, so the phones delete them');
  assert.equal(rowOf(s, 'b'), undefined, 'gone from the Log tab');
  assert.equal(sync(s, {}, ELLA).days.length, 1, 'Ella\'s day on that date stays');
  // a phone that still has it, from before, does not bring it back
  assert.deepEqual(sync(s, { entries: [drink('b')] }).entries.map(x => x.id), ['a']);
});

test('an alcohol-free row typed in becomes an alcohol-free day', () => {
  const s = sheet();
  sync(s, { entries: [drink('a')] });
  const i = s.tab('Log').length + 1;
  s.type(i, 'Date', '2026-10-08'); s.type(i, 'Category', 'alcohol-free');
  const r = sync(s, {});
  assert.deepEqual(r.days.map(d => [d.id, d.status, d.by]), [['2026-10-08', 'af', 'tom']]);
});

test('a row that can\'t be read stays where it is with a note, is not sent to the app, and comes in once fixed', () => {
  const s = sheet();
  sync(s, { entries: [drink('a')] });
  const i = s.tab('Log').length + 1;
  s.type(i, 'Name', 'Mystery'); s.type(i, 'Volume', 12); s.type(i, 'ABV', 5);    // no date
  let r = sync(s, { entries: [drink('a', { updated: T + 2000, note: 'x' })] });
  assert.ok(!r.entries.some(e => e.name === 'Mystery'));
  let row = logRows(s).find(x => x[C.Name] === 'Mystery');
  assert.ok(row, 'still there'); assert.match(row[C.Check], /date/i, 'with a note about what is wrong'); assert.equal(logRows(s).filter(x => x[C.Name] === 'Mystery').length, 1);
  s.type(rowIndex(s, row[C.EntryID]), 'Date', '2026-10-09');
  r = sync(s, {});
  assert.ok(r.entries.some(e => e.name === 'Mystery' && e.date === '2026-10-09'));
  assert.equal(logRows(s).find(x => x[C.Name] === 'Mystery')[C.Check], '', 'the note is gone');
});

test('deleting a row from the Log tab does not remove the drink or the day: the app puts it back', () => {
  const s = sheet();
  sync(s, { entries: [drink('a'), drink('b')] });
  sync(s, { days: [{ id: '2026-10-03', status: 'af', updated: T }] }, ELLA);
  const sh = s.sheets.get('Log');
  sh.cells.splice(rowIndex(s, 'b') - 1, 1);
  sh.cells.splice(rowIndex(s, 'af-2026-10-03-ella') - 1, 1);
  const r = sync(s, {});
  assert.deepEqual(r.entries.map(x => x.id).sort(), ['a', 'b']);
  assert.ok(rowOf(s, 'b'), 'the row is back'); assert.ok(rowOf(s, 'af-2026-10-03-ella'), 'and Ella\'s day');
});

test('a Log tab from before the Who column: read by its headers, its rows the owner\'s, and rebuilt with Who', () => {
  const s = sheet();
  sync(s, { entries: [drink('a')] });
  const OLD = ['Timestamp', 'Date', 'Time', 'Name', 'Category', 'Volume', 'Unit', 'ABV', 'Qty', 'StandardDrinks', 'GramsAlcohol', 'Note', 'EntryID', 'Check'];
  const sh = s.sheets.get('Log');
  sh.cells = [OLD, [new Date(T - 10000).toISOString(), '2026-10-05', '18:30', 'IPA', 'Beer', 16, 'oz', 6.8, 1, 1.71, 24, '', 'a', ''],
    [new Date(T + 1000).toISOString(), '2026-10-09', '', 'Lager', 'Beer', 12, 'oz', 4.5, 2, '', '', '', 'shnew1', ''],
    ['', '2026-10-10', '', 'Bad', 'Beer', '', 'oz', 5, 1, '', '', '', 'shbad', '']];
  const r = sync(s, {});
  assert.ok(r.entries.some(x => x.id === 'shnew1' && x.by === 'tom' && x.qty === 2));
  assert.deepEqual(s.tab('Log')[0], HEAD, 'rebuilt with Who first');
  const bad = rowOf(s, 'shbad');
  assert.deepEqual([bad[C.Who], bad[C.Date], bad[C.Name], bad[C.EntryID]], ['', '2026-10-10', 'Bad', 'shbad'], 'a row being fixed is kept in the new columns');
  assert.match(bad[C.Check], /size/);
});

test('the ABV Tracker\'s own rows (unknown days, the connection test) are left out, and its alcohol-free days come in', () => {
  const s = sheet();
  sync(s, { entries: [drink('a')] });
  const log = s.sheets.get('Log');
  log.cells.push(['', '2026-09-01T10:00:00Z', '2026-09-01', '', 'Unknown day', 'unknown day', '', '', '', '', '', '', '', 'u1', '']);
  log.cells.push(['', '2026-09-01T10:00:00Z', '2026-09-02', '', '__connection test__', 'other', 1, 'oz', 0, 1, '', '', '', 'test', '']);
  log.cells.push(['', '2026-09-04T10:00:00Z', '2026-09-04', '', 'Alcohol-free day', 'alcohol-free', '', '', '', '', 0, 0, '', 'abv9', '']);
  log.cells.push(['', '2026-09-05T20:00:00Z', '2026-09-05', '20:00', 'Beer', 'beer', 12, 'oz', 5, 1, 1, 14, '', 'abv10', '']);
  const r = sync(s, {});
  assert.deepEqual(r.days.map(d => d.id), ['2026-09-04']);
  assert.ok(r.entries.some(e => e.id === 'abv10' && e.date === '2026-09-05'));
  assert.ok(!r.entries.some(e => e.id === 'u1' || e.id === 'test'));
});

test('text that looks like a formula stays text, and a long note survives the 45,000-character cell limit', () => {
  const s = sheet();
  const long = 'x'.repeat(100000);
  sync(s, { entries: [drink('a', { name: '=IMPORTXML("http://x")' }), drink('b', { note: long })] });
  assert.ok(s.sheets.get('Log').raw.includes('\'=IMPORTXML("http://x")'), 'written with a leading \' so the Sheet keeps it as text');
  assert.ok(logRows(s).some(r => r[C.Name] === '=IMPORTXML("http://x")'));
  const r = sync(s, {});
  assert.equal(r.entries.find(x => x.id === 'b').note.length, 100000, 'the long note is kept whole in the hidden tab');
  assert.equal(rowOf(s, 'b')[C.Note].length, 200, 'and the Log row, like the app, shows 200 characters at most');
});

console.log('\n' + n + ' tests passed');
