// Orders Vintage is a copy of Orders' page and script, but both must read
// emails the same way: an order found by one has to look the same in the other
// (and both can share one Google Sheet). So the email reader is checked to be
// the very same file, byte for byte. When parse.js changes in orders/, copy it
// to ordersvintage/:  cp orders/parse.js ordersvintage/parse.js
//
//   node ordersvintage/scripts/same-reader-test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../..', import.meta.url).pathname;
const a = fs.readFileSync(root + 'orders/parse.js', 'utf8'), b = fs.readFileSync(root + 'ordersvintage/parse.js', 'utf8');
assert.equal(b, a, 'ordersvintage/parse.js differs from orders/parse.js: copy it over (cp orders/parse.js ordersvintage/parse.js)');
console.log('ok - ordersvintage/parse.js is orders/parse.js');
