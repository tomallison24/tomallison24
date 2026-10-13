// Places Vintage is a copy of Places' page and script, but both must read map
// links, search results and OpenStreetMap tags the same way: a place found by
// one has to look the same in the other (and both share one Google Sheet). So the
// reader is checked to be the very same file, byte for byte, and so is the map
// library (Leaflet) both draw with. When parse.js changes in places/, copy it to
// placesvintage/:  cp places/parse.js placesvintage/parse.js
//
//   node placesvintage/scripts/same-reader-test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../..', import.meta.url).pathname;
for (const f of ['parse.js', 'vendor/leaflet.js', 'vendor/leaflet.css', 'vendor/LEAFLET-LICENSE']) {
  const a = fs.readFileSync(root + 'places/' + f, 'utf8'), b = fs.readFileSync(root + 'placesvintage/' + f, 'utf8');
  assert.equal(b, a, 'placesvintage/' + f + ' differs from places/' + f + ': copy it over (cp places/' + f + ' placesvintage/' + f + ')');
  console.log('ok - placesvintage/' + f + ' is places/' + f);
}
