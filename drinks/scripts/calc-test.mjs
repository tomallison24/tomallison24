// Drinks' maths (drinks/calc.js), in Node: standard drinks, what each day
// was, the Analysis windows, alcohol-free streaks, and
// bringing in an ABV Tracker backup or its Sheet's Log tab.
//   node drinks/scripts/calc-test.mjs
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const src = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'calc.js'), 'utf8');
vm.runInThisContext(src);   // it sets globalThis.DrinksCalc, as window.DrinksCalc in the page
const C = globalThis.DrinksCalc;

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-3, (msg || '') + ' ' + a + ' ≠ ' + b);
let id = 0;
const E = (date, vol, unit, abv, qty = 1, cat = 'beer') => ({ id: 'e' + id++, date, time: '19:00', name: 'x', cat, vol, unit, abv, qty, updated: id });
const AF = date => ({ id: date, status: 'af', updated: 1 });
const TODAY = '2026-10-09';   // a Friday

test('standard drinks: the US 14 g one', () => {
  near(C.std(E(TODAY, 12, 'oz', 5)), 1, '12 oz beer at 5%');
  near(C.grams(E(TODAY, 12, 'oz', 5)), 14.0, 'grams');
  near(C.std(E(TODAY, 1.5, 'oz', 40)), 1.0, 'a shot');
  near(C.std(E(TODAY, 5, 'oz', 13)), 1.0834, '5 oz wine at 13% (the tracker said 1.083)');
  near(C.std(E(TODAY, 355, 'ml', 12)), 2.4007, '355 ml at 12% (the tracker said 2.401)');
  near(C.std(E(TODAY, 12, 'oz', 6, 3)), 3.6, 'three 6% beers (the tracker said 3.6)');
  assert.equal(C.std(E(TODAY, 12, 'oz', 0)), 0);
});

test('a day is drinks, alcohol-free or not logged; drinks win over a mark', () => {
  const map = C.byDay([E('2026-10-01', 12, 'oz', 5), E('2026-10-01', 5, 'oz', 13, 1, 'wine')]);
  const mk = C.marks([AF('2026-10-01'), AF('2026-10-02'), { id: '2026-10-03', status: 'unknown' }, { id: 'bad', status: 'af' }]);
  assert.equal(C.statusOf('2026-10-01', map, mk), 'drinks');
  assert.equal(C.statusOf('2026-10-02', map, mk), 'af');
  assert.equal(C.statusOf('2026-10-03', map, mk), 'none', 'only alcohol-free is a mark');
  assert.equal(C.statusOf('2026-10-04', map, mk), 'none');
  near(map.get('2026-10-01').sd, 2.0834); assert.equal(map.get('2026-10-01').n, 2);
  assert.deepEqual(Object.keys(map.get('2026-10-01').cats).sort(), ['beer', 'wine']);
});

test('broken entries are left out', () => {
  const bad = [{ id: 'a', date: 'yesterday', vol: 12, unit: 'oz', abv: 5, qty: 1 }, { id: 'b', date: TODAY, vol: 0, unit: 'oz', abv: 5, qty: 1 },
    { id: 'c', date: TODAY, vol: 12, unit: 'oz', abv: 500, qty: 1 }, null, { date: TODAY, vol: 12, unit: 'oz', abv: 5, qty: 1 }];
  assert.equal(C.byDay(bad).size, 0);
});

test('the windows: 7 days and the 7 before, 28 and the 28 before', () => {
  assert.deepEqual(C.compare([], [], TODAY, 7).range, { from: '2026-10-03', to: TODAY, beforeTo: '2026-10-02', beforeFrom: '2026-09-26' });
  assert.deepEqual(C.compare([], [], TODAY, 28).range, { from: '2026-09-12', to: TODAY, beforeTo: '2026-09-11', beforeFrom: '2026-08-15' });
  const a = C.compare([], [], TODAY, 7);
  assert.equal(a.hasNow, false); assert.equal(a.hasBefore, false); assert.equal(a.now.avg, null);
});

test('window totals: drinks, days, heaviest, and averages over recorded days only', () => {
  const entries = [E('2026-10-09', 12, 'oz', 5, 2), E('2026-10-07', 1.5, 'oz', 40, 3, 'spirits'), E('2026-10-01', 12, 'oz', 5)];
  const days = [AF('2026-10-08'), AF('2026-10-06')];
  const a = C.compare(entries, days, TODAY, 7);
  near(a.now.sd, 5); assert.equal(a.now.drinks, 5); assert.equal(a.now.drinkingDays, 2);
  assert.equal(a.now.afDays, 2); assert.equal(a.now.notRecorded, 3); assert.equal(a.now.recorded, 4);
  near(a.now.avg, 1.25, 'average leaves out the days not logged');
  assert.equal(a.now.heaviest.date, '2026-10-07'); near(a.now.heaviest.sd, 3);
  near(a.now.cats.spirits, 3); near(a.now.cats.beer, 2);
  near(a.before.sd, 1); assert.equal(a.before.drinkingDays, 1); assert.equal(a.hasBefore, true);
});

test('days after today are not counted as unrecorded', () => {
  const s = C.stats([], [], '2026-10-05', '2026-10-11', TODAY);
  assert.equal(s.notRecorded, 5);
});

test('days over the daily limit', () => {
  const entries = [E('2026-10-09', 12, 'oz', 5, 5), E('2026-10-08', 12, 'oz', 5, 4), E('2026-10-07', 12, 'oz', 5, 1)];
  assert.equal(C.overDays(entries, '2026-10-05', '2026-10-11', 4), 1, 'exactly 4 is not over');
});

test('streaks: today unmarked doesn’t break it; drinks or a day not logged do', () => {
  const days = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'].map(AF);
  assert.deepEqual(C.streaks([], days, TODAY), { current: 5, best: 5 }, 'today not marked yet');
  assert.deepEqual(C.streaks([], days.concat(AF(TODAY)), TODAY), { current: 6, best: 6 });
  assert.deepEqual(C.streaks([E(TODAY, 12, 'oz', 5)], days, TODAY), { current: 0, best: 5 }, 'a drink today ends it');
  assert.deepEqual(C.streaks([], days.slice(1), TODAY), { current: 4, best: 4 });
  assert.deepEqual(C.streaks([], days.filter(d => d.id !== '2026-10-06'), TODAY), { current: 2, best: 2 }, 'a day not logged ends it');
  const gap = [AF('2026-09-20'), AF('2026-09-21'), AF('2026-09-22'), AF('2026-10-07'), AF('2026-10-08')];
  assert.deepEqual(C.streaks([], gap, TODAY), { current: 2, best: 3 });
  assert.deepEqual(C.streaks([E('2026-09-21', 12, 'oz', 5)], gap, TODAY), { current: 2, best: 2 }, 'a mark under a drink doesn’t count');
});

test('CSV: quotes, commas and newlines inside cells', () => {
  assert.deepEqual(C.parseCSV('a,b,c\r\n"1,5","say ""hi""","two\nlines"\n\n'), [['a', 'b', 'c'], ['1,5', 'say "hi"', 'two\nlines']]);
});

const LOG = `Timestamp,Date,Time,Name,Category,Volume,Unit,ABV,Qty,StandardDrinks,GramsAlcohol,Note,EntryID
2025-03-02T01:00:00.000Z,2025-03-01,0:00,__connection test__,Other,0,oz,0,0,0,0,test row from ABV Tracker,test
2025-03-02T01:10:00.000Z,2025-02-26,19:00,Wine large 8oz 14%,Wine,8,oz,14,1,1.867,26.13,backfilled,k7q2wine0001
2025-03-02T01:20:00.000Z,2025-02-27,0:00,Alcohol-free day,Alcohol-Free,0,,0,0,0,0,no alcohol consumed,dry-2025-02-27
2025-03-02T01:30:00.000Z,2025-02-24,0:00,Unknown day,Unknown,0,,0,0,0,0,not recorded,unk-2025-02-24
2025-03-06T02:00:00.000Z,2025-03-05,21:15,Other 355ml 12%,Other,355,ml,12,1,2.401,33.61,"with friends, at the lake",k7q2mlx00002
2025-03-06T02:05:00.000Z,3/5/2025,21:15,Shot 1.5oz 40%,Spirits,1.5,oz,40,2,2,28,,k7q2shot0003
2025-03-07T02:05:00.000Z,2025-03-05,0:00,Alcohol-free day,Alcohol-Free,0,,0,0,0,0,no alcohol consumed,dry-2025-03-05
2025-03-06T02:00:00.000Z,2025-03-05,21:15,Other 355ml 12%,Other,355,ml,12,1,2.401,33.61,"with friends, at the lake",k7q2mlx00002
`;
test('the Sheet’s Log tab: drinks, marked days, the test row skipped, no doubles', () => {
  const r = C.fromAbvTracker(LOG);
  assert.equal(r.entries.length, 3, 'the repeated row is one drink');
  assert.equal(r.skipped, 1, 'the connection test');
  const wine = r.entries.find(x => x.id === 'abv-k7q2wine0001');
  assert.deepEqual(wine, { id: 'abv-k7q2wine0001', date: '2025-02-26', time: '19:00', name: 'Wine large', cat: 'wine', vol: 8, unit: 'oz', abv: 14, qty: 1, note: '' });
  near(C.std(wine), 1.8668, 'the tracker said 1.867');
  const shot = r.entries.find(x => x.id === 'abv-k7q2shot0003');
  assert.equal(shot.name, 'Shot'); assert.equal(r.entries.find(x => x.unit === 'ml').name, 'Other');
  assert.equal(shot.date, '2025-03-05', 'a US-style date'); assert.equal(shot.qty, 2); assert.equal(shot.cat, 'spirits');
  assert.equal(r.entries.find(x => x.unit === 'ml').note, 'with friends, at the lake');
  assert.deepEqual(r.days.sort((a, b) => a.id.localeCompare(b.id)), [{ id: '2025-02-27', status: 'af' }],
    '8/28 had drinks, so its alcohol-free mark is dropped');
});

test('a CSV that isn’t the Log tab is refused', () => {
  assert.throws(() => C.fromAbvTracker('Total standard drinks,75\nThis week,2.8'), /not-a-log/);
});

test('the ABV Tracker’s JSON backup: drinks, alcohol-free days, goals; unknown days bring nothing; never its sync secret', () => {
  const backup = JSON.stringify({ entries: [
      { id: 'k7q2beer0004', ts: '2025-02-20T23:00:00.000Z', date: '2025-02-20', time: '19:00', name: 'Beer 12oz 5%', cat: 'Beer', vol: 12, unit: 'oz', abv: 5, qty: 1, g: 14, sd: 1, note: '' },
      { id: 'x2', date: '2025-02-20', time: '20:00', name: 'Gin & tonic', cat: 'Cocktail', vol: 2, unit: 'oz', abv: 40, qty: 1, note: 'at home <b>' }],
    dry: ['2025-02-19', '2025-02-20'], unknown: ['2025-02-17'], planned: [], favs: [], bugs: [{}],
    cfg: { week: 10, day: 3, af: 4, url: 'https://script.google.com/x/exec', key: 'SECRET' } });
  const r = C.fromAbvTracker(backup);
  assert.equal(r.entries.length, 2);
  assert.equal(r.entries[1].cat, 'cocktail'); assert.equal(r.entries[0].name, 'Beer'); assert.equal(r.entries[1].note, 'at home <b>', 'kept as text; the page escapes it');
  assert.deepEqual(r.days.map(d => d.id + ':' + d.status).sort(), ['2025-02-19:af']);
  assert.deepEqual(r.goals, { week: 10, day: 3, af: 4 });
  assert.ok(!JSON.stringify(r).includes('SECRET') && !JSON.stringify(r).includes('script.google'));
  assert.throws(() => C.fromAbvTracker('{"hello":1}'), /not-a-backup/);
});

test('the presets and kinds fill in sensible numbers', () => {
  for (const p of C.PRESETS) { assert.ok(C.CAT[p.cat], p.name); assert.ok(C.SIZES[p.unit].includes(p.vol), p.name + ' size'); assert.ok(C.ABVS.includes(p.abv), p.name + ' ABV'); }
  for (const c of C.CATS) { assert.ok(C.SIZES[c.unit].includes(c.vol), c.id); assert.ok(C.ABVS.includes(c.abv), c.id); }
});

console.log(n + ' tests passed');
