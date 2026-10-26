// Tests Meals' sums (meals/logic.js) with the grocery sections Notes uses
// (home/aisles.js), in plain Node.
//   node meals/scripts/logic-test.mjs
import assert from 'assert/strict';
import '../../home/aisles.js';
import '../logic.js';
const L = globalThis.MealsLogic;
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

const items = [{ name: 'Broccoli crowns' }, { name: 'Wild sockeye salmon fillets' }, { name: 'Organic boneless skinless chicken thighs' }, { name: 'Organic strawberries' }, { name: 'Greek yogurt' }];
const meals = [
  { day: 1, ingredients: [{ item: 'boneless chicken thighs', qty: '2 lb' }, { item: 'broccoli', qty: '1 lb' }, { item: 'olive oil', qty: '2 tbsp', pantry: true }, { item: 'garlic', qty: '4 cloves' }] },
  { day: 2, ingredients: [{ item: 'chicken thighs', qty: '1.5 lb' }, { item: 'corn tortillas', qty: '12' }, { item: 'garlic', qty: '2 cloves' }, { item: 'chicken broth', qty: '2 cups' }] },
  { day: 3, ingredients: [{ item: 'Chicken thighs', qty: '2 lb' }, { item: 'olive oil', qty: '1 tbsp', pantry: true }, { item: 'salt', qty: '', pantry: true }] },
];

test('items sort into Notes\' grocery sections, in store order', () => {
  const g = L.sections(items, x => x.name);
  assert.deepEqual(g.map(s => s.name), ['Produce', 'Meat', 'Seafood', 'Dairy & Eggs']);
  assert.deepEqual(g[0].items.map(x => x.name), ['Broccoli crowns', 'Organic strawberries']);
});
test('the shopping list: each ingredient once, every meal\'s amount and day, staples apart', () => {
  const s = L.shopping(meals);
  const thighs = s.buy.find(x => /thigh/.test(x.key));
  assert.deepEqual(thighs.amounts, ['2 lb', '1.5 lb', '2 lb']);
  assert.deepEqual(thighs.nights, [1, 2, 3]);
  assert.equal(thighs.deal, undefined, 'no sale prices');
  assert.deepEqual(s.buy.find(x => x.key === 'garlic').amounts, ['4 cloves', '2 cloves']);
  assert.deepEqual(s.pantry.map(x => x.key).sort(), ['olive oil', 'salt']);
  assert.ok(!s.buy.some(x => x.key === 'olive oil'));
  assert.equal(L.dealFor, undefined);
});
test('two meals on one day: the day once', () => {
  const s = L.shopping([{ day: 1, slot: 'breakfast', ingredients: [{ item: 'eggs', qty: '6' }] }, { day: 1, slot: 'dinner', ingredients: [{ item: 'eggs', qty: '2' }] }]);
  assert.deepEqual(s.buy[0].nights, [1]); assert.deepEqual(s.buy[0].amounts, ['6', '2']);
});
test('an ingredient is a staple only if every meal calls it one', () => {
  const s = L.shopping([{ day: 1, ingredients: [{ item: 'butter', qty: '2 tbsp', pantry: true }] }, { day: 2, ingredients: [{ item: 'butter', qty: '1 stick' }] }]);
  assert.equal(s.buy.length, 1); assert.equal(s.pantry.length, 0);
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
  const t = L.listText(L.sections(L.shopping(meals).buy, x => x.item));
  assert.match(t, /^Produce\n- broccoli \(1 lb\)\n- garlic \(6 cloves\)/);
  assert.match(t, /Meat\n- boneless chicken thighs \(5\.5 lb\)/);
});
test('Calendar\'s Meals layer: every meal on its day (leftovers too), a slot each, dinner unless said; nothing without a plan', () => {
  const plan = { id: 'p1', start: '2026-10-05', dates: ['2026-10-05', '2026-10-06', '2026-10-07'], meals: [
    { day: 1, slot: 'dinner', title: 'Beef pho' }, { day: 2, slot: 'lunch', leftover: 1, title: 'Beef pho' }, { day: 2, title: 'Steak fajitas' },
    { day: 3, slot: 'breakfast', title: 'Shakshuka' }, { day: 3, slot: 'dinner', title: '' }] };
  assert.deepEqual(L.calendarItems(plan), [
    { id: 'p1:0', date: '2026-10-05', slot: 'dinner', title: 'Beef pho' },
    { id: 'p1:1', date: '2026-10-06', slot: 'lunch', title: 'Beef pho' },
    { id: 'p1:2', date: '2026-10-06', slot: 'dinner', title: 'Steak fajitas' },
    { id: 'p1:3', date: '2026-10-07', slot: 'breakfast', title: 'Shakshuka' }]);
  // a plan from before dates: counted from its start; a day past the dates it has: left out
  assert.deepEqual(L.calendarItems({ id: 'p2', start: '2026-01-30', meals: [{ title: 'A' }, { day: 3, title: 'C' }] }).map(x => x.date), ['2026-01-30', '2026-02-01']);
  assert.deepEqual(L.calendarItems({ id: 'p3', dates: ['2026-10-05'], meals: [{ day: 1, title: 'A' }, { day: 2, title: 'B' }] }).map(x => x.id), ['p3:0']);
  assert.deepEqual(L.calendarItems(null), []); assert.deepEqual(L.calendarItems({ id: 'p4', meals: [{ title: 'A' }] }), []);
});
console.log(`\n${n} passed`);
