// Calendar Vintage is a copy of Calendar's page and script, but both must read and write
// calendar files the same way: an event made or edited by one has to come out of the other
// unchanged (they share one iCloud Family calendar). So the iCalendar reader and writer is
// checked to be the very same file, byte for byte. When ical.js changes in calendar/, copy it
// to calendarvintage/:  cp calendar/ical.js calendarvintage/ical.js
//
//   node calendarvintage/scripts/same-reader-test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../..', import.meta.url).pathname;
const a = fs.readFileSync(root + 'calendar/ical.js', 'utf8'), b = fs.readFileSync(root + 'calendarvintage/ical.js', 'utf8');
assert.equal(b, a, 'calendarvintage/ical.js differs from calendar/ical.js: copy it over (cp calendar/ical.js calendarvintage/ical.js)');
console.log('ok - calendarvintage/ical.js is calendar/ical.js');
