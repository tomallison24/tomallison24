// Runs meals/google-sheet-sync.gs (VERSION 3, the family's Sheet through aOS) in Node against an
// in-memory Sheet (the Drinks test's fake-sheet.mjs): who gets in (only aOS, with the phrase and who's
// asking), the family's rows each marked with whose (by) and the Planned by / Who columns, rows from
// before aOS becoming the owner's, the plans read back (the last 90 days, older ones by range), the newest
// copy winning, a plan taken back (Undo) staying gone, Plans that otherwise only grow, the shopping list
// and settings being a picture of the latest copy, deals kept for the last eight weeks, and text the AI
// wrote kept as text.
//   node meals/scripts/sheet-test.mjs
import assert from 'assert/strict';
import path from 'path';
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';

const GS = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'google-sheet-sync.gs');
const SECRET = 'test-secret-phrase';
// what aOS adds to every request (functions/sheet/api): the phrase, and who's asking
const TOM = { key: SECRET, who: 'tom', name: 'Tom', owner: '1' }, ELLA = { key: SECRET, who: 'ella', name: 'Ella' };
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const T = Date.now() - 864e5;   // stamps near now: graves older than 400 days are dropped
const TODAY = '2026-10-20';
const meal = (title, extra) => Object.assign({ day: 1, title, cuisine: 'American', method: 'sheet pan', minutes: 40, why: 'quick', uses: ['chicken thighs'],
  ingredients: [{ item: 'chicken thighs', qty: '2 lb', pantry: false }, { item: 'olive oil', qty: '2 tbsp', pantry: true }], steps: ['Heat the oven.', 'Roast.'] }, extra);
const plan = (id, at, extra) => Object.assign({ id, acceptedAt: at, acceptedBy: 'Tom Allison', start: '2026-10-07', dates: ['2026-10-07', '2026-10-08'], meat: 'chicken', shop: 'harristeeter', shopName: 'Harris Teeter', people: 4, tip: 'Cook rice once.',
  meals: [meal('Honey-garlic chicken'), meal('Chicken tacos', { day: 2, cuisine: 'Mexican', method: 'skillet' })] }, extra);
const mk = () => fakeSheet(GS, SECRET, TOM);
const sync = (s, body, who) => s.post(Object.assign({ action: 'sync' }, body), who);
const deal = (week, store, items, extra) => Object.assign({ week, store, at: T, validFrom: week, validTo: '2026-10-13', items: items || [{ name: 'Chicken thighs', price: '$1.99/lb', regular: '$3.49/lb', member: true, note: 'VIC' }] }, extra);
const shopping = { buy: [{ section: 'Meat', item: 'Chicken thighs', amount: '4 lb', nights: 'nights 1, 2', sale: '$1.99/lb' }], pantry: [{ item: 'Olive oil', amount: '4 tbsp', nights: 'nights 1, 2' }] };
const hidden = (s, tab) => s.tab(tab).slice(1).map(r => JSON.parse(r.slice(2).join('')));
const col = (s, tab, name) => { const t = s.tab(tab), i = t[0].indexOf(name); return t.slice(1).map(r => r[i]); };

test('answers a GET with its name; only aOS, with the phrase and who\'s asking, gets in', () => {
  const s = mk();
  assert.deepEqual(s.get(), { ok: true, app: 'allison-meals-sync', v: 3, aos: true });
  assert.deepEqual(s.post({ action: 'sync' }, { key: 'nope', who: 'tom' }), { ok: false, app: 'allison-meals-sync', aos: true, error: 'wrong-secret' });
  assert.equal(s.post({ secret: SECRET, action: 'sync' }, {}).error, 'wrong-secret', 'a phone with the phrase in its request, as before aOS, gets nothing');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET }).error, 'who');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET, who: 'a b' }).error, 'who');
  assert.equal(s.post('not json').error, 'bad-request');
  assert.equal(fakeSheet(GS, 'CHANGE-ME').post({ action: 'sync' }, { key: 'CHANGE-ME', who: 'tom' }).error, 'secret-not-set');
  assert.deepEqual(s.post({ action: 'ping' }), { ok: true, app: 'allison-meals-sync', v: 3, aos: true });
  assert.equal(s.tab('_plans'), null, 'a ping writes nothing');
  // curly quotes and stray spaces in the phrase don't count against you
  assert.equal(fakeSheet(GS, "tom's-code").post({ action: 'sync' }, { key: ' tom’s-code ', who: 'tom' }).ok, true);
});

test('a first copy builds Plans (a row a night, Planned by first), Shopping list, Deals (with Who) and Settings', () => {
  const s = mk();
  const r = sync(s, { plans: [plan('p1', T)], deals: [deal('2026-10-07', 'Harris Teeter')], shopping, settings: { stores: ['Harris Teeter', 'Aldi'], cards: ['VIC'], avoid: ['tree nuts', 'coconut'], model: 'claude-haiku-5-5' } });
  assert.equal(r.ok, true); assert.equal(r.aos, true); assert.equal(r.by, 'tom');
  assert.deepEqual(r.counts, { plans: 1, deals: 1 });
  assert.deepEqual(r.planIds, ['p1']);
  assert.deepEqual(r.plans.map(p => p.id), ['p1'], 'the plans come back (no window asked: all of them)');
  assert.equal(r.deals, undefined, 'deals are not read back: they are the family server\'s');
  const plans = s.tab('Plans');
  assert.deepEqual(plans[0].slice(0, 6), ['Planned by', 'Accepted', 'Plan', 'Night', 'Date', 'Dinner']);
  assert.equal(plans.length, 3);
  const day = new Date(T).toISOString().slice(0, 10);
  assert.deepEqual(plans[1].slice(0, 6), ['Tom', day, 'Chicken · Harris Teeter', 1, '2026-10-07', 'Honey-garlic chicken']);
  assert.equal(plans[1][13], '2 lb chicken thighs; 2 tbsp olive oil (pantry)');
  assert.equal(plans[1][14], '1. Heat the oven.\n2. Roast.');
  assert.equal(plans[1][15], 'Cook rice once.'); assert.equal(plans[2][15], '');
  assert.equal(plans[1][16], 'p1');
  assert.deepEqual(s.tab('Deals')[0], ['Who', 'Week', 'Store', 'Item', 'Price', 'Usually', 'Member price', 'Note', 'Runs from', 'Runs to']);
  assert.deepEqual(s.tab('Deals')[1], ['Tom', '2026-10-07', 'Harris Teeter', 'Chicken thighs', '$1.99/lb', '$3.49/lb', 'Yes', 'VIC', '2026-10-07', '2026-10-13']);
  assert.deepEqual(s.tab('Shopping list').slice(1).map(r => r[1]), ['Chicken thighs', 'Olive oil']);
  assert.equal(s.tab('Shopping list')[2][5], 'Yes');
  assert.deepEqual(s.tab('Settings').slice(1), [['Stores', 'Harris Teeter, Aldi'], ['Member cards', 'VIC'], ['Never in a plan', 'tree nuts, coconut'], ['Model', 'claude-haiku-5-5']]);
  // kept whole enough for the app to show it again
  const kept = hidden(s, '_plans')[0];
  assert.deepEqual([kept.by, kept.planner, kept.shop, kept.shopName, kept.meals[1].day, kept.updated], ['tom', 'Tom Allison', 'harristeeter', 'Harris Teeter', 2, T]);
  assert.deepEqual(s.tab('_people').slice(1), [['(owner)', 'tom'], ['tom', 'Tom']]);
  assert.ok(['_plans', '_deals', '_deleted', '_people'].every(t => s.sheets.get(t).hidden));
  assert.equal(s.tab('Sheet1'), null, 'the empty first tab is tidied away');
});

test('the family\'s rows: each is whose sent it first (by), everyone sees them all, and a copy from another keeps its by', () => {
  const s = mk();
  sync(s, { plans: [plan('p1', T)] }, TOM);
  const r = sync(s, { plans: [plan('p1', T), plan('p2', T + 1000, { acceptedBy: 'Ella', meals: [meal('Pork chops')] })], deals: [deal('2026-10-07', 'Aldi')] }, ELLA);
  assert.deepEqual(r.plans.map(p => p.id).sort(), ['p1', 'p2'], 'Ella gets the family\'s plans, Tom\'s too');
  const by = Object.fromEntries(hidden(s, '_plans').map(p => [p.id, p.by]));
  assert.deepEqual(by, { p1: 'tom', p2: 'ella' });
  assert.equal(hidden(s, '_deals')[0].by, 'ella');
  // Ella's phone sends a newer copy of Tom's plan (a dinner swapped): it changes, and stays Tom's
  sync(s, { plans: [plan('p1', T, { updated: T + 5000, meals: [meal('Honey-garlic chicken'), meal('Chicken curry')] })] }, ELLA);
  const p1 = hidden(s, '_plans').find(p => p.id === 'p1');
  assert.equal(p1.meals[1].title, 'Chicken curry'); assert.equal(p1.by, 'tom');
  assert.equal(sync(s, {}, TOM).plans.length, 2, 'and Tom sees both');
  assert.deepEqual(col(s, 'Deals', 'Who'), ['Ella'], 'Who: the person whose row it is, by name');
  assert.deepEqual(s.tab('_people').slice(1), [['(owner)', 'tom'], ['tom', 'Tom'], ['ella', 'Ella']]);
});

test('Planned by: who accepted it (first name, from the family server), else whose row it is', () => {
  const s = mk();
  sync(s, { plans: [plan('p1', T, { acceptedBy: 'Ella Allison' }), plan('p2', T + 1, { acceptedBy: '', meals: [meal('Pork chops')] })] }, ELLA);
  const who = Object.fromEntries(s.tab('Plans').slice(1).map(r => [r[16], r[0]]));
  assert.deepEqual(who, { p1: 'Ella', p2: 'Ella' });
  sync(s, { plans: [plan('p3', T + 2, { acceptedBy: undefined, meals: [meal('Salmon bowls')] })] }, TOM);
  assert.equal(s.tab('Plans').find(r => r[16] === 'p3')[0], 'Tom');
});

test('rows from before aOS (VERSION 1) become the owner\'s at their first sync, and keep who planned them', () => {
  const s = mk();
  sync(s, { plans: [plan('pNew', T, { meals: [meal('Salmon bowls')] })], deals: [deal('2026-10-14', 'Aldi')] }, ELLA);   // the tabs exist; no owner yet
  // what VERSION 1 wrote: by was the planner's name, shop the store's name, no updated
  const v1plan = { id: 'pOld', at: T - 9e8, start: '2026-08-01', by: 'Mum Allison', meat: 'pork', shop: 'Publix', people: 4, tip: '', dates: ['2026-08-01'],
    meals: [{ title: 'Pork ragù', cuisine: 'Italian', method: 'braise', minutes: 90, why: '', uses: [], ingredients: [{ item: 'pork shoulder', qty: '3 lb', pantry: false }], steps: ['Braise.'] }] };
  const v1deal = { id: '2026-07-29|Publix', at: T - 9e8, store: 'Publix', week: '2026-07-29', from: '', to: '', items: [{ name: 'Pork shoulder', price: '$1.49/lb', regular: '', member: false, note: '' }] };
  s.sheets.get('_plans').cells.push(['pOld', v1plan.at, JSON.stringify(v1plan)]);
  s.sheets.get('_deals').cells.push([v1deal.id, v1deal.at, JSON.stringify(v1deal)]);
  let r = sync(s, {}, ELLA);
  assert.ok(r.plans.some(p => p.id === 'pOld'), 'the family sees them before the owner has synced');
  r = sync(s, {}, TOM);
  const old = hidden(s, '_plans').find(p => p.id === 'pOld');
  assert.deepEqual([old.by, old.planner, old.shop, old.shopName], ['tom', 'Mum Allison', '', 'Publix'], 'the owner\'s now, still planned by Mum');
  assert.equal(hidden(s, '_plans').find(p => p.id === 'pNew').by, 'ella', 'a row that already says whose stays so');
  assert.equal(hidden(s, '_deals').find(d => d.id === v1deal.id).by, 'tom');
  assert.equal(s.tab('Plans').find(r => r[16] === 'pOld')[0], 'Mum');
  assert.equal(s.tab('Plans').find(r => r[16] === 'pOld')[9], 'Publix');
  assert.equal(s.tab('Deals').find(r => r[2] === 'Publix')[0], 'Tom');
  assert.ok(r.plans.find(p => p.id === 'pOld').meals[0].steps.length === 1, 'and it reads back whole');
});

test('reading back: the last 90 days of plans with each copy, older ones by range (no graves, nothing merged)', () => {
  const s = mk();
  const old = plan('pOld', T - 1, { start: '2026-03-02', dates: ['2026-03-02', '2026-03-03'] });
  const edge = plan('pEdge', T, { start: '2026-07-23', dates: ['2026-07-23'] });   // the 90th day back, counted from today
  const recent = plan('pNew', T + 1, { start: '2026-10-12', dates: ['2026-10-12'] });
  sync(s, { plans: [old, edge, recent] });
  const r = sync(s, { window: 90, today: TODAY });
  assert.deepEqual(r.plans.map(p => p.id).sort(), ['pEdge', 'pNew']);
  assert.deepEqual(r.planIds.sort(), ['pEdge', 'pNew', 'pOld'], 'but it says which plans it holds, all of them');
  const back = s.post({ action: 'range', from: '2025-10-23', to: '2026-07-22', plans: [plan('pSneak', T)] });
  assert.deepEqual(back.plans.map(p => p.id), ['pOld']);
  assert.equal(back.graves, undefined); assert.equal(back.planIds, undefined);
  assert.equal(sync(s, {}).planIds.includes('pSneak'), false, 'a range asks; it changes nothing');
  assert.deepEqual(s.post({ action: 'range', from: '2000-01-01', to: '2026-03-01' }).plans, []);
  assert.deepEqual(s.post({ action: 'range', from: 'x', to: '2026-03-01' }, ELLA).plans.map(p => p.id).sort(), ['pEdge', 'pNew', 'pOld'], 'a range that isn\'t one: everything, as a sync without a window');
});

test('the newest copy wins; the same copy again changes nothing', () => {
  const s = mk();
  sync(s, { plans: [plan('p1', T, { updated: T + 2000 })] });
  sync(s, { plans: [plan('p1', T, { updated: T + 1000, tip: 'stale' })] }, ELLA);
  assert.equal(hidden(s, '_plans')[0].tip, 'Cook rice once.', 'an older copy (a phone that read it earlier) does not win');
  const before = JSON.stringify(s.tab('_plans'));
  sync(s, { plans: [plan('p1', T, { updated: T + 9000 })] });
  assert.equal(JSON.stringify(s.tab('_plans')), before, 'read again, the same: nothing rewritten');
  sync(s, { plans: [plan('p1', T, { updated: T + 9500, tip: 'Cook rice twice.' })] }, ELLA);
  assert.equal(hidden(s, '_plans')[0].tip, 'Cook rice twice.');
  sync(s, { deals: [deal('2026-10-07', 'Aldi', [{ name: 'Eggs', price: '$1' }], { at: T + 100 })] });
  sync(s, { deals: [deal('2026-10-07', 'Aldi', [{ name: 'Eggs', price: '$2' }], { at: T })] });
  assert.deepEqual(col(s, 'Deals', 'Price'), ['$1'], 'deals: the week found last wins, not the copy sent last');
});

test('a plan taken back (Undo of Accept) leaves Plans, and a phone that still has it doesn\'t bring it back', () => {
  const s = mk();
  sync(s, { plans: [plan('p1', T), plan('p2', T + 1000, { meals: [meal('Pork chops')] })] });
  let r = sync(s, { plans: [plan('p1', T, { updated: T + 3000 })], graves: { 'plans:p2': T + 5000 } }, ELLA);
  assert.equal(r.graves['plans:p2'], T + 5000, 'every phone hears of it (the family\'s)');
  assert.deepEqual(r.planIds, ['p1']);
  assert.ok(!s.tab('Plans').some(r => r[16] === 'p2'));
  assert.deepEqual(s.tab('_deleted')[1], ['plans:p2', T + 5000, 'tom'], 'kept with whose it was');
  r = sync(s, { plans: [plan('p2', T + 1000, { updated: T + 4000, meals: [meal('Pork chops')] })] });
  assert.ok(!r.planIds.includes('p2') && !s.tab('Plans').some(r => r[16] === 'p2'), 'a copy read before it was taken back stays gone');
  assert.equal(sync(s, { graves: { 'nothing:x': T, 'plans:p9': 'soon' } }).ok, true, 'a grave that isn\'t one is ignored');
});

test('Plans only grows: a plan the family server has dropped stays, newest first, and a changed plan replaces its own rows', () => {
  const s = mk();
  sync(s, { plans: [plan('p1', T), plan('p2', T + 7 * 86400e3, { meals: [meal('Pork chops')] })] });
  assert.equal(s.tab('Plans').length, 4);
  sync(s, { plans: [plan('p3', T + 14 * 86400e3, { meals: [meal('Salmon bowls')] })] });     // p1 and p2 are no longer in the app's list
  const titles = s.tab('Plans').slice(1).map(r => r[5]);
  assert.deepEqual(titles, ['Salmon bowls', 'Pork chops', 'Honey-garlic chicken', 'Chicken tacos'], 'newest plan first, none lost');
  sync(s, { plans: [plan('p1', T, { updated: T + 1, meals: [meal('Honey-garlic chicken'), meal('Chicken tacos'), meal('Chicken curry')] })] });
  assert.equal(s.tab('Plans').filter(r => r[16] === 'p1').length, 3);
  assert.equal(s.tab('Plans').length, 1 + 3 + 1 + 1);
});

test('a repeat copy changes nothing in the data tabs; Shopping list and Settings follow the latest copy', () => {
  const s = mk();
  const body = { plans: [plan('p1', T)], deals: [deal('2026-10-07', 'Aldi')], shopping, settings: { stores: ['Aldi'], cards: [], avoid: [] } };
  sync(s, body);
  const kept = JSON.stringify([s.tab('_plans'), s.tab('_deals'), s.tab('_people')]);
  sync(s, Object.assign({}, body, { shopping: { buy: [{ section: 'Produce', item: 'Broccoli', amount: '2 heads', nights: 'night 1', sale: '' }], pantry: [] }, settings: { stores: ['Aldi', 'Target'], cards: [], avoid: [] } }));
  assert.equal(JSON.stringify([s.tab('_plans'), s.tab('_deals'), s.tab('_people')]), kept);
  assert.deepEqual(s.tab('Shopping list').slice(1).map(r => r[1]), ['Broccoli']);
  assert.equal(s.tab('Settings')[1][1], 'Aldi, Target');
});

test('deals: a store\'s week is replaced when it is found again, and only the last eight weeks are kept', () => {
  const s = mk();
  sync(s, { deals: [deal('2026-10-07', 'Aldi', [{ name: 'Eggs', price: '$1' }])] });
  sync(s, { deals: [deal('2026-10-07', 'Aldi', [{ name: 'Eggs', price: '$0.99' }, { name: 'Milk', price: '$2' }], { at: T + 1 })] });
  assert.deepEqual(s.tab('Deals').slice(1).map(r => [r[3], r[4]]), [['Eggs', '$0.99'], ['Milk', '$2']]);
  for (let i = 1; i <= 9; i++) sync(s, { deals: [deal('2026-10-' + String(7 + i).padStart(2, '0'), 'Aldi', [{ name: 'Item ' + i, price: '$' + i }])] });
  const weeks = [...new Set(s.tab('Deals').slice(1).map(r => r[1]))];
  assert.equal(weeks.length, 8); assert.equal(weeks[0], '2026-10-16'); assert.equal(weeks.includes('2026-10-07'), false);
});

test('text the AI or a store wrote is kept as text; damaged plans and deals are skipped', () => {
  const s = mk();
  const r = sync(s, { plans: [plan('p1', T, { meals: [meal('=HYPERLINK("https://evil.example","x")')] }), null, { id: 5 }, { id: 'p9' }], deals: [null, { store: 'Aldi' }, deal('2026-10-07', 'Aldi', [{ name: '+cmd|calc', price: '@SUM(1)' }])] });
  assert.equal(r.ok, true); assert.deepEqual(r.counts, { plans: 1, deals: 1 });
  assert.ok(s.sheets.get('Plans').raw.includes("'=HYPERLINK(\"https://evil.example\",\"x\")"));
  assert.ok(s.sheets.get('Deals').raw.includes("'+cmd|calc") && s.sheets.get('Deals').raw.includes("'@SUM(1)"));
  assert.equal(s.sheets.get('_plans').hidden, true);
});

console.log(n + ' tests passed');
