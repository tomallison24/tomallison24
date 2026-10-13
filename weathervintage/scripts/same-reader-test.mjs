// Weather Vintage is a copy of Weather's page and script, but both must read the forecast the same way:
// the National Weather Service (and Open-Meteo) forecast, current reading, rain-stops line and alerts
// found by one have to be the same numbers in the other (and in Home's weather pill, which loads Weather's
// copy). So the forecast reader is checked to be the very same file, byte for byte. When data.js changes in
// weather/, copy it to weathervintage/:  cp weather/data.js weathervintage/data.js
//
//   node weathervintage/scripts/same-reader-test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../..', import.meta.url).pathname;
const a = fs.readFileSync(root + 'weather/data.js', 'utf8'), b = fs.readFileSync(root + 'weathervintage/data.js', 'utf8');
assert.equal(b, a, 'weathervintage/data.js differs from weather/data.js: copy it over (cp weather/data.js weathervintage/data.js)');
console.log('ok - weathervintage/data.js is weather/data.js');
