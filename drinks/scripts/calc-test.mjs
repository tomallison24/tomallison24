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

test('cocktails by name: each is its recipe’s own alcohol, as a whole drink in oz', () => {
  assert.ok(C.COCKTAILS.length >= 25);
  assert.equal(new Set(C.COCKTAILS.map(c => c.name)).size, C.COCKTAILS.length, 'no name twice');
  for (const c of C.COCKTAILS) {
    assert.equal(c.cat, 'cocktail', c.name); assert.equal(c.unit, 'oz', c.name);
    assert.ok(c.base && c.vol > 1 && c.vol < 10 && c.abv > 0 && c.abv < 45, c.name);
    assert.ok(C.okEntry(Object.assign({ id: 'x', date: TODAY, qty: 1 }, c)), c.name + ' is a drink the log keeps');
  }
  const sd = name => C.std(Object.assign({ qty: 1 }, C.COCKTAILS.find(c => c.name === name)));
  // IBA: 50 ml tequila and 20 ml triple sec at 40% → 28 ml of alcohol → 22.1 g → 1.58
  assert.ok(Math.abs(sd('Margarita') - 28 * 0.789 / 14) < 0.01, 'Margarita');
  // 30 ml each of gin 40%, Campari 24%, sweet vermouth 16% → 24 ml → 1.35
  assert.ok(Math.abs(sd('Negroni') - 24 * 0.789 / 14) < 0.01, 'Negroni');
  // five 15 ml spirits at 40% → 30 ml → 1.69
  assert.ok(Math.abs(sd('Long Island Iced Tea') - 30 * 0.789 / 14) < 0.01, 'Long Island');
  // a single in a highball is one standard drink
  assert.ok(Math.abs(sd('Gin & tonic') - 1) < 0.02, 'G&T');
});

// ---- Trends: the 12-week page ----
test('Trends: a week at a time, with its limits, strength and a 4-week average of finished weeks', () => {
  const beer = (date, qty = 1) => E(date, 12, 'oz', 5, qty);
  const es = [beer('2026-09-24', 4), beer('2026-09-26'), beer('2026-10-05'),
    E('2026-10-09', 5, 'oz', 13, 1, 'wine'), E('2026-10-09', 16, 'oz', 6.8)];
  const days = [AF('2026-09-21'), AF('2026-09-22'), AF('2026-10-06')];
  const g = { week: 4.5, day: 2, af: 2 };
  const ws = C.weeks(es, days, '2026-10-04', 3, TODAY, g);      // weeks of Sun 9/20, Sun 9/27, Sun 10/4 (today is Fri 10/9)
  assert.deepEqual(ws.map(w => w.start), ['2026-09-20', '2026-09-27', '2026-10-04']);
  assert.deepEqual(ws.map(w => w.end), ['2026-09-26', '2026-10-03', '2026-10-10']);
  assert.deepEqual(ws.map(w => w.partial), [false, false, true], 'only the week still going');
  near(ws[0].sd, 5); assert.ok(ws[0].over, '5 is over 4.5'); assert.equal(ws[2].over, false, 'the week still going has 3.9 so far'); assert.equal(ws[0].overDays, 1, '4 on one day is over 2 a day');
  assert.equal(ws[0].afDays, 2); assert.equal(ws[0].drinkingDays, 2); assert.equal(ws[0].drinks, 5);
  near(ws[0].abv, 5, 'all 5% beer'); near(ws[0].perDrink, 1, 'a 12 oz 5% beer is one');
  assert.equal(ws[1].hasData, false, 'nothing logged');
  assert.equal(ws[1].abv, null); assert.equal(ws[1].perDrink, null);
  assert.equal(ws[2].hasData, true); assert.equal(ws[2].notRecorded, 3, 'Sun, Wed, Thu are not logged; later days are not counted yet');
  const ethanol = 12 * C.OZ_ML * 0.05 + 5 * C.OZ_ML * 0.13 + 16 * C.OZ_ML * 0.068, volume = (12 + 5 + 16) * C.OZ_ML;
  near(ws[2].abv, ethanol / volume * 100, 'strength is by volume: alcohol over drink');
  near(ws[2].perDrink, ws[2].sd / 3);
  near(ws[0].avg4, 5, 'a week with data, alone in its window'); assert.equal(ws[1].avg4, null); assert.equal(ws[2].avg4, null, 'no average for the week still going');
  const r = C.weekGoals(ws, g);
  assert.deepEqual(r, { over: 1, under: 0, counted: 1, noData: 1, runUnder: 0, bestRun: 0, afMet: 1, afCounted: 1 });
});

test('Trends: weeks under the limit in a row; the week still going does not break or add to it', () => {
  const es = ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'].map(d => E(d, 12, 'oz', 5));
  const ws = C.weeks(es, [], '2026-10-04', 4, TODAY, { week: 14, day: 4, af: 3 });
  const r = C.weekGoals(ws, { week: 14, day: 4, af: 3 });
  assert.equal(r.runUnder, 3); assert.equal(r.bestRun, 3); assert.equal(r.under, 3); assert.equal(r.over, 0); assert.equal(r.counted, 3);
  assert.equal(r.afCounted, 3, 'finished weeks count against the alcohol-free goal; the one still going only once it is met');
  assert.equal(r.afMet, 0);
  // an empty week still going (a Sunday morning) does not end the run either
  const sunday = C.weeks(es.slice(0, 3), [], '2026-10-04', 4, TODAY, { week: 14 });
  assert.equal(C.weekGoals(sunday, { week: 14 }).runUnder, 3);
  // a week is still going on its last day (a Saturday), until that day is over
  assert.equal(C.weeks(es, [], '2026-10-04', 1, '2026-10-10', {})[0].partial, true);
  assert.equal(C.weeks(es, [], '2026-10-04', 1, '2026-10-11', {})[0].partial, false);
  // a week over the limit that is still going breaks it
  const bad = es.slice(0, 3).concat(E('2026-10-05', 12, 'oz', 5, 20));
  assert.equal(C.weekGoals(C.weeks(bad, [], '2026-10-04', 4, TODAY, { week: 14 }), { week: 14 }).runUnder, 0);
  // no limit set: nothing is over
  assert.equal(C.weeks(bad, [], '2026-10-04', 4, TODAY, { week: 0 }).some(w => w.over), false);
});

test('Trends: top drinks by the name you gave them, or by kind', () => {
  const es = [Object.assign(E('2026-10-01', 16, 'oz', 6.8), { name: 'IPA' }), Object.assign(E('2026-10-02', 16, 'oz', 6.8, 2), { name: 'ipa ' }),
    Object.assign(E('2026-10-02', 5, 'oz', 13, 2, 'wine'), { name: 'Wine' }), Object.assign(E('2026-10-03', 12, 'oz', 5), { name: '' }),
    Object.assign(E('2026-01-01', 12, 'oz', 5), { name: 'Old' })];
  const by = (b) => Object.fromEntries(C.topDrinks(es, '2026-09-01', TODAY, b).map(x => [x.key, x]));
  const names = by('name');
  assert.deepEqual(Object.keys(names).sort(), ['beer', 'ipa', 'wine'], 'a name with no words is its kind; before the window is left out; case and spaces do not split a name');
  assert.equal(names.ipa.qty, 3); near(names.ipa.sd, 3 * 1.8134); assert.equal(names.ipa.cat, 'beer'); assert.equal(names.wine.qty, 2);
  const kinds = by('kind');
  assert.deepEqual(Object.keys(kinds).sort(), ['beer', 'wine']); assert.equal(kinds.beer.label, 'Beer'); assert.equal(kinds.beer.qty, 4);
});

test('Trends: each day of the week, over the days you recorded', () => {
  const es = [E('2026-10-05', 12, 'oz', 5, 2), E('2026-10-09', 12, 'oz', 5)];     // Mon 2, Fri 1
  const w = C.weekdays(es, [AF('2026-10-06')], '2026-10-04', '2026-10-31', TODAY);   // Sun 10/4 to today; the month's later days aren't counted
  assert.equal(w.length, 7); assert.deepEqual(w.map(x => x.dow), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(w[0].avg, null, 'Sunday was not logged'); near(w[1].avg, 2); near(w[2].avg, 0); near(w[5].avg, 1);
  assert.equal(w[2].recorded, 1); assert.equal(w[1].drinkingDays, 1);
  near(w[1].share, 2 / 3); near(w[5].share, 1 / 3); assert.equal(w[6].recorded, 0, 'Saturday has not come yet');
});

console.log(n + ' tests passed');
