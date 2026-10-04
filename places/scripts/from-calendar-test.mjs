// Runs places/scripts/from-calendar.mjs end to end with iCloud, Photon and the
// Notes Sheet replaced by stand-ins (the iCloud replies are shaped like those
// in calendar/scripts/api-test.mjs): a past dinner and a coming show become
// places, Fearless Foxes training and a dentist visit don't, a second run
// changes nothing and asks Photon nothing, and the log names no event or place.
//   node places/scripts/from-calendar-test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? '  — ' + extra : '')); };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'places-cal-'));
const LOG = path.join(dir, 'log.json');
const day = n => { const d = new Date(Date.now() + n * 864e5); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
const vevent = (uid, summary, start, extra) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Apple Inc.//iOS 26//EN\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nSUMMARY:${summary}\r\nDTSTART;TZID=America/Denver:${start}T190000\r\n${extra.join('\r\n')}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const files = {
  'dinner.ics': vevent('dinner-1', 'Anniversary dinner', day(-20), ['LOCATION:Rioja\\n1431 Larimer St\\, Denver', 'X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-TITLE=Rioja:geo:39.7478,-104.9997']),
  'show.ics': vevent('show-1', 'Hamilton', day(30), ['LOCATION:Buell Theatre\\n1350 Curtis St\\, Denver', 'X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-TITLE=Buell Theatre:geo:39.7449,-104.9978']),
  'foxes.ics': vevent('foxes-1', 'Fearless Foxes training', day(-6), ['RRULE:FREQ=WEEKLY', 'LOCATION:Sloan’s Lake Park\\nDenver']),
  'dentist.ics': vevent('dent-1', 'Dentist appointment', day(3), ['LOCATION:Smile Dental\\n100 Main St\\, Denver']),
};
const stub = `
import fs from 'node:fs';
const LOG = ${JSON.stringify(LOG)}, FILES = ${JSON.stringify(files)};
const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : { photon: [], sheet: [], places: [] };
const save = () => fs.writeFileSync(LOG, JSON.stringify(log));
const HOME = 'https://p50-caldav.icloud.com/123456/calendars/', FAMILY = HOME + 'ABCD-1234/';
const ms = (...p) => '<?xml version="1.0"?><multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/">' + p.join('') + '</multistatus>';
const x = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const F = (lon, lat, key, value, name) => ({ geometry: { coordinates: [lon, lat] }, properties: { osm_type: 'N', osm_id: Math.round(lat * 1e4), osm_key: key, osm_value: value, name, city: 'Denver', state: 'Colorado', countrycode: 'US' } });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  if (u.hostname === 'caldav.icloud.com') return new Response('', { status: 301, headers: { Location: 'https://p50-caldav.icloud.com' + u.pathname } });
  if (u.hostname === 'p50-caldav.icloud.com') {
    if (init.method === 'PROPFIND' && u.pathname === '/') return new Response(ms('<response><href>/</href><propstat><prop><current-user-principal><href>/123456/principal/</href></current-user-principal></prop><status>HTTP/1.1 200 OK</status></propstat></response>'), { status: 207 });
    if (init.method === 'PROPFIND' && u.pathname === '/123456/principal/') return new Response(ms('<response><href>/123456/principal/</href><propstat><prop><C:calendar-home-set><href>' + HOME + '</href></C:calendar-home-set></prop><status>HTTP/1.1 200 OK</status></propstat></response>'), { status: 207 });
    if (init.method === 'PROPFIND' && u.href === HOME) return new Response(ms('<response><href>/123456/calendars/ABCD-1234/</href><propstat><prop><displayname>Family</displayname><resourcetype><collection/><C:calendar/></resourcetype><C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set><A:calendar-color>#FF2968FF</A:calendar-color></prop><status>HTTP/1.1 200 OK</status></propstat></response>'), { status: 207 });
    if (init.method === 'REPORT' && u.href === FAMILY) return new Response(ms(...Object.entries(FILES).map(([n, ics]) => '<response><href>/123456/calendars/ABCD-1234/' + n + '</href><propstat><prop><getetag>"1"</getetag><C:calendar-data>' + x(ics) + '</C:calendar-data></prop><status>HTTP/1.1 200 OK</status></propstat></response>')), { status: 207 });
    return new Response('', { status: 404 });
  }
  if (u.hostname === 'photon.komoot.io') {
    const q = u.searchParams.get('q'); log.photon.push(q); save();
    const feats = /rioja/i.test(q) ? [F(-104.9998, 39.7477, 'amenity', 'restaurant', 'Rioja')] : /buell/i.test(q) ? [F(-104.9979, 39.7448, 'amenity', 'theatre', 'Buell Theatre')] : /smile/i.test(q) ? [F(-104.98, 39.74, 'amenity', 'dentist', 'Smile Dental')] : [F(-105.04, 39.75, 'leisure', 'park', 'Sloan’s Lake Park')];
    return new Response(JSON.stringify({ features: feats }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (u.href.startsWith('https://script.google.com/')) {
    const b = JSON.parse(init.body); log.sheet.push({ action: b.action, secret: b.secret, n: b.places.length });
    const byId = new Map(log.places.map(p => [p.id, p])); for (const p of b.places) byId.set(p.id, p); log.places = [...byId.values()]; save();
    return new Response(JSON.stringify({ ok: true, places: log.places, graves: {} }), { headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error('unexpected ' + url);
};
globalThis.setTimeout = ((st) => (fn, ms, ...a) => st(fn, Math.min(ms || 0, 5), ...a))(globalThis.setTimeout);   // no waiting between lookups here
`;
const stubFile = path.join(dir, 'stub.mjs');
fs.writeFileSync(stubFile, stub);
const run = () => execFileSync(process.execPath, ['--import', stubFile, path.resolve('places/scripts/from-calendar.mjs')], {
  cwd: dir, encoding: 'utf8',
  env: { ...process.env, ICLOUD_APPLE_ID: 'me@icloud.com', ICLOUD_APP_PASSWORD: 'abcd-efgh-ijkl-mnop', NOTES_SHEET_URL: 'https://script.google.com/macros/s/X/exec', NOTES_SHEET_SECRET: 'maple-otter' },
});
const out1 = run();
let log = JSON.parse(fs.readFileSync(LOG, 'utf8'));
const byName = n => log.places.find(p => p.name === n);
ok('a past dinner at a restaurant: Been, with the event’s date as the visit', byName('Rioja')?.status === 'been' && byName('Rioja')?.visits.length === 1 && byName('Rioja')?.notes === '📅 Anniversary dinner');
ok('a coming show at a theatre: Want to go, Planned for its date', byName('Buell Theatre')?.status === 'want' && /^\d{4}-\d{2}-\d{2}$/.test(byName('Buell Theatre')?.planned || ''));
ok('Fearless Foxes training and the dentist are not places, and the training isn’t even looked up', log.places.length === 2 && !log.photon.some(q => /sloan/i.test(q)) && !log.photon.some(q => /smile/i.test(q)), JSON.stringify(log.photon));
ok('the Sheet is read with the Notes secret, then sent the two new places', log.sheet.length === 2 && log.sheet.every(s => s.action === 'places' && s.secret === 'maple-otter') && log.sheet[1].n === 2, JSON.stringify(log.sheet));
ok('the log shows counts, never event titles or places', !/Rioja|Buell|Hamilton|Anniversary|Foxes|Dentist/i.test(out1), out1.trim().split('\n').join(' | '));
const photonBefore = log.photon.length;
const out2 = run();
log = JSON.parse(fs.readFileSync(LOG, 'utf8'));
ok('a second run asks Photon nothing and changes nothing', log.photon.length === photonBefore && log.sheet.length === 3 && /0 added, 0 updated/.test(out2), out2.trim().split('\n').pop());
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
