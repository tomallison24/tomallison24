// Fitness Vintage is a copy of Fitness' page and script, but both must compare a workout the same
// way: Analysis in one has to give the numbers it gives in the other (and both can share one Google
// Sheet). So the Analysis logic is checked to be the very same file, byte for byte. When
// analysis.js changes in fitness/, copy it to fitnessvintage/:  cp fitness/analysis.js fitnessvintage/analysis.js
//
//   node fitnessvintage/scripts/same-reader-test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../..', import.meta.url).pathname;
const a = fs.readFileSync(root + 'fitness/analysis.js', 'utf8'), b = fs.readFileSync(root + 'fitnessvintage/analysis.js', 'utf8');
assert.equal(b, a, 'fitnessvintage/analysis.js differs from fitness/analysis.js: copy it over (cp fitness/analysis.js fitnessvintage/analysis.js)');
console.log('ok - fitnessvintage/analysis.js is fitness/analysis.js');
