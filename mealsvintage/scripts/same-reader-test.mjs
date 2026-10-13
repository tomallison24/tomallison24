// Meals Vintage is a copy of Meals' page and script, but both must do the sums the
// same way: the same ingredient across nights once with its total, the sale that
// matches an ingredient, the grocery sections, the week label and the list text have
// to come out the same in both (and they share one family plan on the server). So the
// sums are checked to be the very same file, byte for byte. When logic.js changes in
// meals/, copy it to mealsvintage/:  cp meals/logic.js mealsvintage/logic.js
//
//   node mealsvintage/scripts/same-reader-test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../..', import.meta.url).pathname;
const a = fs.readFileSync(root + 'meals/logic.js', 'utf8'), b = fs.readFileSync(root + 'mealsvintage/logic.js', 'utf8');
assert.equal(b, a, 'mealsvintage/logic.js differs from meals/logic.js: copy it over (cp meals/logic.js mealsvintage/logic.js)');
console.log('ok - mealsvintage/logic.js is meals/logic.js');
