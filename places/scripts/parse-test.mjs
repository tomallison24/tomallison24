// Tests places/parse.js: map links pasted from Apple Maps and Google Maps,
// Photon search results, OpenStreetMap tags and opening hours.
//   node places/scripts/parse-test.mjs
import '../parse.js';
const { mapLink, fromPhoton, fromTags, kindOf, hoursText, distance } = globalThis.PlacesParse;

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? '  — ' + extra : '')); };
const j = v => JSON.stringify(v);

// ---- map links ----
let l = mapLink('https://maps.apple.com/?address=1401%20Larimer%20St,%20Denver,%20CO%2080202,%20United%20States&auid=123&ll=39.7478,-104.9997&lsp=9902&q=Rioja&t=m');
ok('Apple Maps (classic): name, address and position', l.name === 'Rioja' && l.lat === 39.7478 && l.lon === -104.9997 && l.address.startsWith('1401 Larimer St, Denver'), j(l));
l = mapLink('Check this out https://maps.apple.com/place?address=100+W+14th+Ave+Pkwy%2C+Denver%2C+CO+80204&coordinate=39.737%2C-104.989&name=Denver+Art+Museum&place-id=I123');
ok('Apple Maps (newer /place link, inside a message): name and coordinate', l.name === 'Denver Art Museum' && l.lat === 39.737 && l.lon === -104.989, j(l));
ok('Apple Maps short link: reported as short', mapLink('https://maps.apple/p/AbCdEf123').short === true);
ok('Apple Maps place-id only: reported as short', mapLink('https://maps.apple.com/place?place-id=I7149BA7A').short === true);
l = mapLink('https://www.google.com/maps/place/Snooze,+an+A.M.+Eatery/@39.7509,-104.9993,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d39.7511!4d-104.9989');
ok('Google Maps place link: name, and the place’s own position (not the map centre)', l.name === 'Snooze, an A.M. Eatery' && l.lat === 39.7511 && l.lon === -104.9989, j(l));
l = mapLink('https://www.google.com/maps/search/?api=1&query=Union%20Station%20Denver');
ok('Google Maps search link: the query as the name', l.name === 'Union Station Denver' && l.lat == null, j(l));
ok('Google Maps short link: reported as short', mapLink('https://maps.app.goo.gl/xyz123').short === true);
ok('Not a map link: nothing', mapLink('https://example.com/?ll=1,2') === null && mapLink('no link here') === null);

// ---- Photon results ----
const f = { geometry: { type: 'Point', coordinates: [-104.9997, 39.7478] }, properties: { osm_type: 'N', osm_id: 123456, osm_key: 'amenity', osm_value: 'restaurant', type: 'house', name: 'Rioja', housenumber: '1431', street: 'Larimer Street', city: 'Denver', state: 'Colorado', countrycode: 'US', country: 'United States' } };
let p = fromPhoton(f);
ok('Photon: a restaurant with its address, type, emoji and OSM id', p.name === 'Rioja' && p.category === 'Restaurant' && p.emoji === '🍽️' && p.address === '1431 Larimer Street, Denver, Colorado' && p.lat === 39.7478 && p.osm.type === 'node' && p.osm.id === 123456 && p.isPlace, j(p));
p = fromPhoton({ geometry: { coordinates: [-104.98, 39.74] }, properties: { osm_type: 'W', osm_id: 9, osm_key: 'building', osm_value: 'house', type: 'house', housenumber: '12', street: 'Elm St', city: 'Denver', state: 'Colorado', countrycode: 'US' } });
ok('Photon: a plain address is not a named place', !p.isPlace && p.name === '12 Elm St' && p.osm.type === 'way', j(p));
p = fromPhoton({ geometry: { coordinates: [-0.12, 51.5] }, properties: { osm_type: 'R', osm_id: 5, osm_key: 'tourism', osm_value: 'museum', name: 'British Museum', city: 'London', countrycode: 'GB', country: 'United Kingdom', state: 'England' } });
ok('Photon: outside the US, no state in the address', p.address === 'London' && p.category === 'Museum', j(p));

// ---- tags, kinds, hours ----
const t = fromTags({ opening_hours: 'Mo-Fr 11:00-22:00; Sa,Su 10:00-23:00', 'contact:phone': '+1 303-820-2282', website: 'riojadenver.com', cuisine: 'mediterranean;spanish' });
ok('Tags: hours, phone from contact:phone, website made a link, cuisine tidied', t.phone === '+1 303-820-2282' && t.website === 'https://riojadenver.com' && t.cuisine === 'Mediterranean, Spanish' && t.hours.startsWith('Mo-Fr'), j(t));
ok('Kinds: a cafe, a shop, an unknown value', kindOf('amenity', 'cafe').label === 'Café' && kindOf('shop', 'bicycle').label === 'Bicycle shop' && kindOf('amenity', 'escape_game').label === 'Escape game', j([kindOf('shop', 'bicycle'), kindOf('amenity', 'escape_game')]));
ok('Hours: friendlier days and times', hoursText('Mo-Fr 11:00-22:00; Sa,Su 10:00-23:00') === 'Mon–Fri 11 AM–10 PM\nSat,Sun 10 AM–11 PM', j(hoursText('Mo-Fr 11:00-22:00; Sa,Su 10:00-23:00')));
ok('Hours: 24/7, half hours, midnight, closed days', hoursText('24/7') === 'Open 24 hours' && hoursText('Tu-Sa 17:30-24:00; Su,Mo off') === 'Tue–Sat 5:30 PM–12 AM\nSun,Mon closed', hoursText('Tu-Sa 17:30-24:00; Su,Mo off'));
const d = distance({ lat: 39.7392, lon: -104.9903 }, { lat: 39.7478, lon: -104.9997 });
ok('Distance: downtown Denver to Larimer Square is about 1.25 km', d > 1150 && d < 1350, Math.round(d) + ' m');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
