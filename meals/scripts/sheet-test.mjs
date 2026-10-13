// Runs meals/google-sheet-sync.gs in Node against an in-memory Sheet (the Drinks test's fake-sheet.mjs):
// the secret check, a first copy, Plans that only ever grow (a plan the app has dropped stays), a changed
// plan replacing its own rows, the shopping list and settings being a picture of the latest copy, deals
// kept for the last eight weeks, and text the AI wrote kept as text.
//   node meals/scripts/sheet-test.mjs
import assert from 'assert/strict';
import path from 'path';
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';

const GS = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'google-sheet-sync.gs');
const SECRET = 'test-secret-phrase';
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const T = Date.parse('2026-10-05T18:30:00Z');
const meal = (title, extra) => Object.assign({ title, cuisine: 'American', method: 'sheet pan', minutes: 40, why: 'quick', uses: ['chicken thighs'],
  ingredients: [{ item: 'chicken thighs', qty: '2 lb', pantry: false }, { item: 'olive oil', qty: '2 tbsp', pantry: true }], steps: ['Heat the oven.', 'Roast.'] }, extra);
const plan = (id, at, extra) => Object.assign({ id, acceptedAt: at, acceptedBy: 'Tom', start: '2026-10-07', dates: ['2026-10-07', '2026-10-08'], meat: 'chicken', shop: 'harristeeter', shopName: 'Harris Teeter', people: 4, tip: 'Cook rice once.',
  meals: [meal('Honey-garlic chicken'), meal('Chicken tacos', { cuisine: 'Mexican', method: 'skillet' })] }, extra);
const sync = (s, body) => s.post(Object.assign({ secret: SECRET, action: 'sync' }, body));
const mk = () => fakeSheet(GS, SECRET);
const deal = (week, store, items, extra) => Object.assign({ week, store, validFrom: week, validTo: '2026-10-13', items: items || [{ name: 'Chicken thighs', price: '$1.99/lb', regular: '$3.49/lb', member: true, note: 'VIC' }] }, extra);
const shopping = { buy: [{ section: 'Meat', item: 'Chicken thighs', amount: '4 lb', nights: 'nights 1, 2', sale: '$1.99/lb' }], pantry: [{ item: 'Olive oil', amount: '4 tbsp', nights: 'nights 1, 2' }] };

test('answers a GET with its name, and refuses a wrong or unset secret', () => {
  const s = mk();
  assert.deepEqual(s.get(), { ok: true, app: 'allison-meals-sync', v: 1 });
  assert.equal(s.post({ secret: 'nope', action: 'sync' }).error, 'wrong-secret');
  assert.equal(s.post('not json').error, 'bad-request');
  assert.equal(fakeSheet(GS, 'CHANGE-ME').post({ secret: 'CHANGE-ME', action: 'sync' }).error, 'secret-not-set');
});

test('a first copy builds Plans (a row per night), Shopping list, Deals and Settings, readable', () => {
  const s = mk();
  const r = sync(s, { plans: [plan('p1', T)], deals: [deal('2026-10-07', 'Harris Teeter')], shopping, settings: { stores: ['Harris Teeter', 'Aldi'], cards: ['VIC'], avoid: ['tree nuts', 'coconut'], model: 'claude-haiku-5-5' } });
  assert.deepEqual([r.ok, r.plans, r.deals], [true, 1, 1]);
  const plans = s.tab('Plans');
  assert.equal(plans[0][4], 'Dinner'); assert.equal(plans.length, 3);
  assert.deepEqual(plans[1].slice(0, 5), ['2026-10-05', 'Chicken · Harris Teeter', 1, '2026-10-07', 'Honey-garlic chicken']);
  assert.equal(plans[1][13], '2 lb chicken thighs; 2 tbsp olive oil (pantry)');
  assert.equal(plans[1][14], '1. Heat the oven.\n2. Roast.');
  assert.equal(plans[1][15], 'Cook rice once.'); assert.equal(plans[2][15], '');
  assert.equal(plans[1][16], 'p1');
  assert.deepEqual(s.tab('Deals')[1], ['2026-10-07', 'Harris Teeter', 'Chicken thighs', '$1.99/lb', '$3.49/lb', 'Yes', 'VIC', '2026-10-07', '2026-10-13']);
  assert.deepEqual(s.tab('Shopping list').slice(1).map(r => r[1]), ['Chicken thighs', 'Olive oil']);
  assert.equal(s.tab('Shopping list')[2][5], 'Yes');
  assert.deepEqual(s.tab('Settings').slice(1), [['Stores', 'Harris Teeter, Aldi'], ['Member cards', 'VIC'], ['Never in a plan', 'tree nuts, coconut'], ['Model', 'claude-haiku-5-5']]);
});

test('Plans only grows: a plan the app has dropped stays, newest first, and a changed plan replaces its own rows', () => {
  const s = mk();
  sync(s, { plans: [plan('p1', T), plan('p2', T + 7 * 86400e3, { meals: [meal('Pork chops')] })] });
  assert.equal(s.tab('Plans').length, 4);
  sync(s, { plans: [plan('p3', T + 14 * 86400e3, { meals: [meal('Salmon bowls')] })] });     // p1 and p2 are no longer in the app's list
  const titles = s.tab('Plans').slice(1).map(r => r[4]);
  assert.deepEqual(titles, ['Salmon bowls', 'Pork chops', 'Honey-garlic chicken', 'Chicken tacos'], 'newest plan first, none lost');
  sync(s, { plans: [plan('p1', T, { meals: [meal('Honey-garlic chicken'), meal('Chicken tacos'), meal('Chicken curry')] })] });
  assert.equal(s.tab('Plans').filter(r => r[16] === 'p1').length, 3);
  assert.equal(s.tab('Plans').filter(r => r[16] === 'p1').length + 2, s.tab('Plans').length - 1);
});

test('a repeat copy changes nothing in the data tabs; Shopping list and Settings follow the latest copy', () => {
  const s = mk();
  const body = { plans: [plan('p1', T)], deals: [deal('2026-10-07', 'Aldi')], shopping, settings: { stores: ['Aldi'], cards: [], avoid: [] } };
  sync(s, body);
  const hidden = JSON.stringify([s.tab('_plans'), s.tab('_deals')]);
  sync(s, Object.assign({}, body, { shopping: { buy: [{ section: 'Produce', item: 'Broccoli', amount: '2 heads', nights: 'night 1', sale: '' }], pantry: [] }, settings: { stores: ['Aldi', 'Target'], cards: [], avoid: [] } }));
  assert.equal(JSON.stringify([s.tab('_plans'), s.tab('_deals')]), hidden);
  assert.deepEqual(s.tab('Shopping list').slice(1).map(r => r[1]), ['Broccoli']);
  assert.equal(s.tab('Settings')[1][1], 'Aldi, Target');
});

test('deals: a store\'s week is replaced when it is found again, and only the last eight weeks are kept', () => {
  const s = mk();
  sync(s, { deals: [deal('2026-10-07', 'Aldi', [{ name: 'Eggs', price: '$1' }])] });
  sync(s, { deals: [deal('2026-10-07', 'Aldi', [{ name: 'Eggs', price: '$0.99' }, { name: 'Milk', price: '$2' }])] });
  assert.deepEqual(s.tab('Deals').slice(1).map(r => [r[2], r[3]]), [['Eggs', '$0.99'], ['Milk', '$2']]);
  for (let i = 1; i <= 9; i++) sync(s, { deals: [deal('2026-10-' + String(7 + i).padStart(2, '0'), 'Aldi', [{ name: 'Item ' + i, price: '$' + i }])] });
  const weeks = [...new Set(s.tab('Deals').slice(1).map(r => r[0]))];
  assert.equal(weeks.length, 8); assert.equal(weeks[0], '2026-10-16'); assert.equal(weeks.includes('2026-10-07'), false);
});

test('text the AI or a store wrote is kept as text; damaged plans and deals are skipped', () => {
  const s = mk();
  const r = sync(s, { plans: [plan('p1', T, { meals: [meal('=HYPERLINK("https://evil.example","x")')] }), null, { id: 5 }, { id: 'p9' }], deals: [null, { store: 'Aldi' }, deal('2026-10-07', 'Aldi', [{ name: '+cmd|calc', price: '@SUM(1)' }])] });
  assert.equal(r.ok, true); assert.equal(r.plans, 1); assert.equal(r.deals, 1);
  assert.ok(s.sheets.get('Plans').raw.includes("'=HYPERLINK(\"https://evil.example\",\"x\")"));
  assert.ok(s.sheets.get('Deals').raw.includes("'+cmd|calc") && s.sheets.get('Deals').raw.includes("'@SUM(1)"));
  assert.equal(s.sheets.get('_plans').hidden, true);
});

console.log(n + ' tests passed');
