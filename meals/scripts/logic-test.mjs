// Tests Meals' sums (meals/logic.js) with the grocery sections Notes uses
// (home/aisles.js), in plain Node.
//   node meals/scripts/logic-test.mjs
import assert from 'assert/strict';
import '../../home/aisles.js';
import '../logic.js';
const L = globalThis.MealsLogic;
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

const deals = { items: [
  { name: 'Organic boneless skinless chicken thighs', price: '$3.99/lb', prime: true },
  { name: 'Broccoli crowns', price: '$1.99/lb' },
  { name: 'Wild sockeye salmon fillets', price: '$9.99/lb' },
  { name: 'Organic strawberries', price: '$3.99' },
  { name: 'Greek yogurt', price: '$4.49' },
] };
const meals = [
  { day: 1, ingredients: [{ item: 'boneless chicken thighs', qty: '2 lb' }, { item: 'broccoli', qty: '1 lb' }, { item: 'olive oil', qty: '2 tbsp', pantry: true }, { item: 'garlic', qty: '4 cloves' }] },
  { day: 2, ingredients: [{ item: 'chicken thighs', qty: '1.5 lb' }, { item: 'corn tortillas', qty: '12' }, { item: 'garlic', qty: '2 cloves' }, { item: 'chicken broth', qty: '2 cups' }] },
  { day: 3, ingredients: [{ item: 'Chicken thighs', qty: '2 lb' }, { item: 'olive oil', qty: '1 tbsp', pantry: true }, { item: 'salt', qty: '', pantry: true }] },
];

test('deals sort into Notes\' grocery sections, in store order', () => {
  const g = L.sections(deals.items, x => x.name);
  assert.deepEqual(g.map(s => s.name), ['Produce', 'Meat', 'Seafood', 'Dairy & Eggs']);
  assert.deepEqual(g[0].items.map(x => x.name), ['Broccoli crowns', 'Organic strawberries']);
});
test('a sale matches an ingredient by every word naming it, not by a shared word', () => {
  assert.equal(L.dealFor('2 lb chicken thighs', deals).price, '$3.99/lb');
  assert.equal(L.dealFor('salmon fillet', deals).price, '$9.99/lb');
  assert.equal(L.dealFor('chicken broth', deals), null);
  assert.equal(L.dealFor('broccoli', deals).name, 'Broccoli crowns');
  assert.equal(L.dealFor('anything', null), null);
});
test('the shopping list: each ingredient once, every night\'s amount, staples apart, sales marked', () => {
  const s = L.shopping(meals, deals);
  const thighs = s.buy.find(x => /thigh/.test(x.key));
  assert.deepEqual(thighs.amounts, ['2 lb', '1.5 lb', '2 lb']);
  assert.deepEqual(thighs.nights, [1, 2, 3]);
  assert.equal(thighs.deal.price, '$3.99/lb');
  assert.deepEqual(s.buy.find(x => x.key === 'garlic').amounts, ['4 cloves', '2 cloves']);
  assert.deepEqual(s.pantry.map(x => x.key).sort(), ['olive oil', 'salt']);
  assert.ok(!s.buy.some(x => x.key === 'olive oil'));
  assert.equal(s.buy.find(x => x.key === 'chicken broth').deal, null);
});
test('an ingredient is a staple only if every night calls it one', () => {
  const s = L.shopping([{ day: 1, ingredients: [{ item: 'butter', qty: '2 tbsp', pantry: true }] }, { day: 2, ingredients: [{ item: 'butter', qty: '1 stick' }] }], null);
  assert.equal(s.buy.length, 1); assert.equal(s.pantry.length, 0);
});
test('the week, Wednesday to Tuesday, the US way', () => {
  assert.equal(L.weekLabel('2026-10-07'), 'Wed, Oct 7 – Tue, Oct 13');
  assert.equal(L.weekLabel('2026-10-07', '2026-10-07', '2026-10-13'), 'Wed, Oct 7 – Tue, Oct 13');
  assert.equal(L.weekLabel(''), '');
});
test('amounts in the same unit add up; mixed units are listed', () => {
  assert.equal(L.total(['1.5 lb', '1.5 lb', '1.5 lb', '1.5 lb']), '6 lb');
  assert.equal(L.total(['1/2 cup', '1/2 cup']), '1 cup');
  assert.equal(L.total(['1 lb', '2 cups']), '1 lb + 2 cups');
  assert.equal(L.total(['12']), '12');
  assert.equal(L.total(['2', '3']), '5');
  assert.equal(L.total(['a pinch', 'a pinch']), 'a pinch + a pinch');
});
test('the list as text, to paste into Notes', () => {
  const t = L.listText(L.sections(L.shopping(meals, deals).buy, x => x.item));
  assert.match(t, /^Produce\n- broccoli \(1 lb\)\n- garlic \(6 cloves\)/);
  assert.match(t, /Meat\n- boneless chicken thighs \(5\.5 lb\)/);
});
console.log(`\n${n} passed`);
