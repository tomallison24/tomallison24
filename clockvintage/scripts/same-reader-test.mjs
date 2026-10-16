// Clock Vintage is a copy of Clock's page, but both must work the same way: when an alarm
// rings, what a ring does, the sounds, what is kept. So the scripts are checked to be the
// very same files, byte for byte, and the page's markup (everything in <body>) the same but
// for the app's name; only the style sheet (the Vintage block) and the head's colours and
// storage key differ. When app.js or logic.js changes in clock/, copy it over:
//   cp clock/app.js clock/logic.js clockvintage/
//
//   node clockvintage/scripts/same-reader-test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../..', import.meta.url).pathname;
const read = f => fs.readFileSync(root + f, 'utf8');
for (const f of ['app.js', 'logic.js']) {
  assert.equal(read('clockvintage/' + f), read('clock/' + f), `clockvintage/${f} differs from clock/${f}: copy it over (cp clock/${f} clockvintage/${f})`);
  console.log(`ok - clockvintage/${f} is clock/${f}`);
}
const body = f => read(f).split('<body>')[1].replace('data-app="clockvintage"', 'data-app="clock"');
assert.equal(body('clockvintage/index.html'), body('clock/index.html'), 'the two pages\' markup differs: Clock Vintage should be Clock\'s page with its own style sheet');
console.log('ok - the two pages have the same markup');
const key = f => (/<meta name="aos-store" content="([^"]+)">/.exec(read(f)) || [])[1];
assert.equal(key('clock/index.html'), 'allison-clock-v1');
assert.equal(key('clockvintage/index.html'), 'allison-clockv-v1');
console.log('ok - each keeps its own storage');
