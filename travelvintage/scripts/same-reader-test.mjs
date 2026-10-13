// Travel Vintage is a copy of Travel's page and script, but both must read
// emails the same way: a booking found by one has to look the same in the other
// (and both can share one Google Sheet). So the email reader is checked to be
// the very same file, byte for byte. When parse.js changes in travel/, copy it
// to travelvintage/:  cp travel/parse.js travelvintage/parse.js
//
//   node travelvintage/scripts/same-reader-test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../..', import.meta.url).pathname;
const a = fs.readFileSync(root + 'travel/parse.js', 'utf8'), b = fs.readFileSync(root + 'travelvintage/parse.js', 'utf8');
assert.equal(b, a, 'travelvintage/parse.js differs from travel/parse.js: copy it over (cp travel/parse.js travelvintage/parse.js)');
console.log('ok - travelvintage/parse.js is travel/parse.js');
