// Drinks Vintage is a copy of Drinks' page and script, but both must do the
// sums the same way: a standard drink, a day's status, the Analysis weeks and
// the ABV Tracker import have to come out the same in both (and they share one
// private log in your account). So the sums are checked to be the very same
// file, byte for byte. When calc.js changes in drinks/, copy it to
// drinksvintage/:  cp drinks/calc.js drinksvintage/calc.js
//
//   node drinksvintage/scripts/same-reader-test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../..', import.meta.url).pathname;
const a = fs.readFileSync(root + 'drinks/calc.js', 'utf8'), b = fs.readFileSync(root + 'drinksvintage/calc.js', 'utf8');
assert.equal(b, a, 'drinksvintage/calc.js differs from drinks/calc.js: copy it over (cp drinks/calc.js drinksvintage/calc.js)');
console.log('ok - drinksvintage/calc.js is drinks/calc.js');
