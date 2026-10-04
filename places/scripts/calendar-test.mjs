// Tests places/calendar.mjs: which Family-calendar events become places, and
// what they change. Events are .ics text read with the Calendar app's own
// parser; Photon's answers are stand-ins.
//   node places/scripts/calendar-test.mjs
import fs from 'node:fs';
import { readEvent, worthLooking, searchFor, pickVenue, plan, isOuting } from '../calendar.mjs';
const src = fs.readFileSync(new URL('../../calendar/ical.js', import.meta.url), 'utf8');
await import('data:text/javascript,' + encodeURIComponent(src));
const I = globalThis.AllisonICal;

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? '  — ' + extra : '')); };
const TZ = 'America/Denver';
const ics = lines => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Apple Inc.//iOS 26//EN\r\nBEGIN:VEVENT\r\n' + lines.join('\r\n') + '\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
const ev = lines => { const v = I.parseAll(ics(lines))[0]; return readEvent(I, v, I.children(v, 'VEVENT')[0], TZ); };

// ---- reading events, as iPhone Calendar writes them ----
const dinner = ev(['UID:dinner-1', 'SUMMARY:Anniversary dinner', 'DTSTART;TZID=America/Denver:20260912T190000', 'DTEND;TZID=America/Denver:20260912T210000',
  'LOCATION:Rioja\\n1431 Larimer St\\, Denver\\, CO 80202\\, United States',
  'X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-APPLE-RADIUS=70;X-TITLE="Rioja\\n1431 Larimer St, Denver, CO 80202":geo:39.747800,-104.999700']);
ok('reads the title, the date as written, and Apple’s place name and position', dinner.title === 'Anniversary dinner' && dinner.date === '2026-09-12' && dinner.where.name === 'Rioja' && dinner.where.lat === 39.7478 && dinner.where.lon === -104.9997, JSON.stringify(dinner.where));
ok('a one-off dinner with a location is worth looking up', worthLooking(dinner) && searchFor(dinner).q === 'Rioja');
const foxes = ev(['UID:foxes', 'SUMMARY:Fearless Foxes training', 'DTSTART;TZID=America/Denver:20261001T170000', 'RRULE:FREQ=WEEKLY;BYDAY=TH', 'LOCATION:Sloan’s Lake Park\\nDenver']);
ok('Fearless Foxes training (repeating) is skipped', !worthLooking(foxes));
const foxesOnce = ev(['UID:foxes2', 'SUMMARY:Fearless Foxes training', 'DTSTART;TZID=America/Denver:20261003T090000', 'LOCATION:Sloan’s Lake Park']);
ok('…and so is a one-off training, by its title', !worthLooking(foxesOnce));
ok('lessons, appointments and pickups are skipped by title', ['Piano lesson', 'Dentist appointment', 'School pickup', 'Soccer practice', 'Haircut'].every(t => !worthLooking({ title: t, recurring: false, where: { text: 'Somewhere', lat: null } })));
ok('an event without a location is skipped', !worthLooking(ev(['UID:x', 'SUMMARY:Date night', 'DTSTART;TZID=America/Denver:20261010T190000'])));
const allDay = ev(['UID:zoo', 'SUMMARY:Zoo day', 'DTSTART;VALUE=DATE:20260815', 'LOCATION:Denver Zoo\\n2300 Steele St\\, Denver']);
ok('an all-day event keeps its own date; the first line of the location is the name', allDay.date === '2026-08-15' && allDay.where.name === 'Denver Zoo' && worthLooking(allDay), JSON.stringify(allDay.where));

// ---- is the location an outing? ----
const F = (lon, lat, key, value, name) => ({ geometry: { coordinates: [lon, lat] }, properties: { osm_type: 'N', osm_id: Math.round(lat * 1e4), osm_key: key, osm_value: value, name, city: 'Denver', state: 'Colorado', countrycode: 'US' } });
ok('restaurants, bars, museums, theatres, zoos, breweries count', ['amenity:restaurant', 'amenity:bar', 'tourism:museum', 'amenity:theatre', 'tourism:zoo', 'craft:brewery', 'leisure:stadium'].every(s => isOuting(...s.split(':'))));
ok('parks, pitches, schools, churches, gyms, houses and offices don’t', ['leisure:park', 'leisure:pitch', 'amenity:school', 'amenity:place_of_worship', 'leisure:fitness_centre', 'building:house', 'office:company'].every(s => !isOuting(...s.split(':'))));
let v = pickVenue(dinner, [F(-104.9998, 39.7477, 'amenity', 'restaurant', 'Rioja')]);
ok('the restaurant at Apple’s position is the venue', v && v.name === 'Rioja' && v.category === 'Restaurant');
ok('a namesake 2 km away is not', pickVenue(dinner, [F(-104.97, 39.76, 'amenity', 'restaurant', 'Rioja')]) === null);
ok('a park is not, even if it’s the only answer', pickVenue(foxesOnce, [F(-105.04, 39.75, 'leisure', 'park', 'Sloan’s Lake Park')]) === null);

// ---- what it changes ----
const today = '2026-10-04', now = 1790000000000, idFor = uid => 'pc-' + uid;
const rioja = { event: dinner, venue: v };
let ch = plan([rioja], [], today, now, idFor);
ok('a past dinner is added to Been, with that date as a visit', ch.length === 1 && ch[0].status === 'been' && ch[0].visited === '2026-09-12' && ch[0].visits.join() === '2026-09-12' && ch[0].notes === '📅 Anniversary dinner' && ch[0].cal.uid === 'dinner-1');
ok('running again changes nothing', plan([rioja], ch, today, now + 1, idFor).length === 0);
const mine = [{ id: 'p1', name: 'Rioja', lat: 39.7478, lon: -104.9997, osm: v.osm, status: 'want', planned: null, visits: [], updated: 5 }];
ch = plan([rioja], mine, today, now, idFor);
ok('a place you already have is updated, not added again: it moves to Been with the date', ch.length === 1 && ch[0].id === 'p1' && ch[0].status === 'been' && ch[0].visited === '2026-09-12');
const again = { event: Object.assign({}, dinner, { uid: 'dinner-2', date: '2026-09-30' }), venue: v };
ch = plan([again], [Object.assign({}, mine[0], { status: 'been', visited: '2026-09-12', visits: ['2026-09-12'] })], today, now, idFor);
ok('a second visit is added to its visits, the latest first', ch[0].visits.join() === '2026-09-30,2026-09-12' && ch[0].visited === '2026-09-30');
const show = { event: { uid: 'show-1', title: 'Hamilton', date: '2026-11-20', where: { name: 'Buell Theatre', lat: 39.74, lon: -104.99 } }, venue: { name: 'Buell Theatre', lat: 39.74, lon: -104.99, osm: { type: 'node', id: 9 }, category: 'Theatre', emoji: '🎭' } };
ch = plan([show], [], today, now, idFor);
ok('a coming event is added to Want to go, Planned for that date', ch[0].status === 'want' && ch[0].planned === '2026-11-20' && !ch[0].visited);
const later = plan([], ch, '2026-11-21', now + 9, idFor);
ok('once its day has passed, it moves to Been by itself', later.length === 1 && later[0].status === 'been' && later[0].visited === '2026-11-20' && !later[0].planned);
const touched = [Object.assign({}, ch[0], { updated: now + 5 })];
ok('…unless you changed it in the meantime', plan([], touched, '2026-11-21', now + 9, idFor).length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
