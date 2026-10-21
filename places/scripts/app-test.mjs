// Drives Places in headless Chromium against stand-ins for Photon (search),
// Overpass (opening hours etc.), CARTO's map tiles and the Notes Google Sheet:
// adding by search, by a pasted Apple Maps link and from where you are; the
// place sheet (status, stars, price, dates, notes and #tags, OpenStreetMap
// details); moving a place to Been; the lists, sorting and filters; the map
// and its pins; Apple Maps directions; delete with undo; and the family's Google
// Sheet (Notes'), through aOS: the real notes/google-sheet-sync.gs on an
// in-memory Sheet answering **/sheet/api/places, with who's asking from the
// phone's session: signed out it asks to sign in; signed in, every place is the
// family's, with a Who column; the owner's phone hands the Sheet link and phrase
// it kept (Places', Notes' or the old Notes Vintage app's) to aOS, then Places
// forgets its own.
// Both designs (../home/design.js): Vintage, the default, drawn in the Retro look in
// light and dark (the sky held at day, aos.sky: Futura, the cream or walnut ground,
// flat cards and sheets, a mustard thumb, orange buttons, the shapes behind the
// title, teal and mustard pins, Retro dots for the businesses), and Standard (Sea
// glass: the Vintage block off, no sky, the aurora, Places' own pin and dot
// colours); Settings > Design switches between them at once (the dots recoloured
// too) and keeps the choice; and the old Places Vintage address (served from
// places/, as the deploy does) moves that app's data on the phone over to Places'
// names, once.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node places/scripts/app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? '  — ' + extra : '')); };

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  p = p.replace(/^\/placesvintage\//, '/places/');   // the old Places Vintage address: the deploy copies places/ there (news.yml)
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;
const SHEET = 'https://script.google.com/macros/s/AKfycbTEST/exec', SECRET = 'maple-otter';   // the link and phrase phones kept before aOS did
// The family's Google Sheet (Notes'): the real Apps Script on an in-memory Sheet, reached through aOS
// (functions/sheet/api, stood in for here): each phone's session says who's asking.
const sheet = fakeSheet(new URL('../../notes/google-sheet-sync.gs', import.meta.url).pathname, SECRET);
const PEOPLE = { 'tok-tom': { id: 'tom', name: 'Tom', role: 'owner' }, 'tok-ella': { id: 'ella', name: 'Ella', role: 'member' } };
const session = tok => JSON.stringify({ token: tok, user: PEOPLE[tok], at: 1 });
const claims = [];
const sheetRoute = c => c.route('**/sheet/api/**', route => {
  const req = route.request(), tok = (req.headers().authorization || '').replace('Bearer ', ''), who = PEOPLE[tok];
  const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
  if (!who) return json({ error: 'signin' }, 401);
  if (!/\/sheet\/api\/places(\/|$)/.test(req.url())) return json({ error: 'app' }, 404);
  if (req.url().endsWith('/claim')) { claims.push({ who: who.id, ...JSON.parse(req.postData()) }); return json({ configured: true }); }
  if (req.method() === 'GET') return json({ configured: true });
  calls.sheet.push({ who: who.id, ...JSON.parse(req.postData()) });
  return json(sheet.post(req.postData(), { key: SECRET, who: who.id, name: who.name, ...(who.role === 'owner' ? { owner: '1' } : {}) }));
});
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAAAASUVORK5CYII=', 'base64');

const feat = (lon, lat, props) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props });
const RIOJA = feat(-104.9997, 39.7478, { osm_type: 'N', osm_id: 111, osm_key: 'amenity', osm_value: 'restaurant', type: 'house', name: 'Rioja', housenumber: '1431', street: 'Larimer Street', city: 'Denver', state: 'Colorado', countrycode: 'US' });
const DAM = feat(-104.9892, 39.7372, { osm_type: 'W', osm_id: 222, osm_key: 'tourism', osm_value: 'museum', type: 'house', name: 'Denver Art Museum', street: 'West 14th Avenue Parkway', housenumber: '100', city: 'Denver', state: 'Colorado', countrycode: 'US' });
const CAFE = feat(-104.9903, 39.7393, { osm_type: 'N', osm_id: 333, osm_key: 'amenity', osm_value: 'cafe', type: 'house', name: 'Corner Café', city: 'Denver', state: 'Colorado', countrycode: 'US' });
const PIZZA = feat(-104.9850, 39.7420, { osm_type: 'N', osm_id: 444, osm_key: 'amenity', osm_value: 'restaurant', type: 'house', name: 'Pizzeria Locale', city: 'Denver', state: 'Colorado', countrycode: 'US' });
const HOUSE = feat(-104.98, 39.74, { osm_type: 'W', osm_id: 9, osm_key: 'building', osm_value: 'house', type: 'house', housenumber: '12', street: 'Elm St', city: 'Denver', state: 'Colorado', countrycode: 'US' });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 39.7392, longitude: -104.9903 }, permissions: ['geolocation'], timezoneId: 'America/Denver', locale: 'en-US' });
const calls = { photon: [], overpass: 0, sheet: [], apple: [], biz: [] };

const stub = async route => {
  const u = route.request().url(), cors = { 'Access-Control-Allow-Origin': '*' };
  if (u.startsWith('https://photon.komoot.io/api/')) {
    const q = new URL(u).searchParams.get('q').toLowerCase(); calls.photon.push(q);
    const fs2 = q.includes('rioja') ? [RIOJA, HOUSE] : q.includes('art museum') ? [DAM] : q.includes('pizza') ? [PIZZA] : [];
    return route.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify({ type: 'FeatureCollection', features: fs2 }) });
  }
  if (u.startsWith('https://photon.komoot.io/reverse')) return route.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify({ features: [CAFE] }) });
  if (u.startsWith('https://overpass-api.de/')) {
    calls.overpass++;
    const body = decodeURIComponent((route.request().postData() || '').replace(/^data=/, ''));
    if (body.includes('nwr[')) {                     // the businesses in the map view
      calls.biz.push(body);
      const els = [];
      if (body.includes('restaurant')) els.push({ type: 'node', id: 501, lat: 39.7412, lon: -104.9921, tags: { name: 'Little Bird Kitchen', amenity: 'restaurant', cuisine: 'american', opening_hours: 'Mo-Su 08:00-21:00' } });
      if (body.includes('museum')) els.push({ type: 'way', id: 502, center: { lat: 39.7366, lon: -104.9897 }, tags: { name: 'History Colorado', tourism: 'museum' } });
      if (body.includes('"shop"~"^(.+)$"')) els.push({ type: 'node', id: 503, lat: 39.7390, lon: -104.9880, tags: { name: 'Tattered Cover', shop: 'books' } });
      return route.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify({ elements: els }) });
    }
    const tags = body.includes('node(111)') ? { amenity: 'restaurant', opening_hours: 'Mo-Fr 11:00-22:00; Sa,Su 10:00-23:00', phone: '+1 303-820-2282', website: 'riojadenver.com', cuisine: 'mediterranean' } : { tourism: 'museum' };
    return route.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify({ elements: [{ type: 'node', id: 1, tags }] }) });
  }
  if (u.includes('basemaps.cartocdn.com')) return route.fulfill({ contentType: 'image/png', body: PNG });
  if (u.startsWith('https://script.google.com/')) { calls.google = (calls.google || 0) + 1; return route.abort(); }   // no phone talks to Google itself any more
  if (u.startsWith('https://maps.apple.com/')) { calls.apple.push(u); return route.fulfill({ status: 204, body: '' }); }
  return route.fulfill({ status: 404, body: '' });
};
await ctx.route(/^https?:\/\/(?!localhost)/, stub);
await sheetRoute(ctx);
await ctx.addInitScript(() => {
  localStorage.setItem('aos.seen', JSON.stringify({ notes: '999', places: '999', calendar: '999' }));   // the walkthrough as seen, as on a phone in use
  localStorage.setItem('aos.sky', 'day');   // the Vintage sky held still, so the test works at any hour
  window.__clip = '';
  Object.defineProperty(navigator, 'clipboard', { value: { readText: async () => window.__clip, writeText: async () => {} }, configurable: true });
});

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(BASE + '/places/');
await page.waitForTimeout(600);
const rows = () => page.$$eval('#list .row', rs => rs.map(r => r.querySelector('b').textContent + ' | ' + r.querySelector('.r').textContent));
const toastText = () => page.textContent('#toastMsg');
const toList = async () => { if (await page.isVisible('#map')) { await page.click('#viewBtn'); await page.waitForTimeout(300); } };

ok('opens on the map', await page.isVisible('#map') && (await page.getAttribute('#viewBtn', 'aria-label')) === 'Show the list');
await toList();
ok('starts empty, with a short line how to add', (await page.textContent('#list')).includes('Tap + to add one.'));

// ---- add by search ----
await page.click('#fab');
await page.fill('#find', 'rioja');
await page.waitForTimeout(800);
const res = await page.$$eval('#results .result', rs => rs.map(r => r.textContent));
ok('search shows OpenStreetMap results with type, address and distance', res.length === 2 && res[0].includes('Rioja') && res[0].includes('Restaurant') && res[0].includes('1431 Larimer Street') && /mi/.test(res[0]) === false, res.join(' / '));
ok('search sent your position so nearby places come first', calls.photon.length > 0);
await page.click('#results [data-i="0"]');
await page.waitForTimeout(600);
ok('a new place opens with its type and address', await page.isVisible('#placeSheet') && (await page.textContent('#plLbl')) === 'New place' && (await page.textContent('#plMeta')).includes('Restaurant'), await page.textContent('#plMeta'));
const info = await page.textContent('#plInfo');
ok('OpenStreetMap details: friendlier hours, phone, website, cuisine', info.includes('Mon–Fri 11 AM–10 PM') && info.includes('+1 303-820-2282') && info.includes('riojadenver.com') && info.includes('Mediterranean'), info);
ok('Want to go has no stars yet', await page.isHidden('#plRateField'));
await page.click('#plPrice [data-p="3"]');
const soon = new Date(Date.now() + 5 * 864e5), soonStr = soon.getFullYear() + '-' + String(soon.getMonth() + 1).padStart(2, '0') + '-' + String(soon.getDate()).padStart(2, '0');
await page.fill('#plDate', soonStr); await page.dispatchEvent('#plDate', 'change');
await page.fill('#plNotes', 'Anniversary dinner #date-night');
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '2-place.png') });
await page.fill('#filter', 'riojx'); await page.dispatchEvent('#filter', 'input');   // a search left in the box
await page.click('#plSave');
await page.waitForTimeout(500);
ok('after adding, back to the main screen: the map, search cleared, sheets closed', await page.isVisible('#map') && (await page.inputValue('#filter')) === '' && await page.isHidden('#placeSheet') && await page.isHidden('#addSheet') && (await toastText()).includes('Added to Want to go'));
await toList();
let r = await rows();
ok('saved under Want to go, Coming up, with its date and price', r.length === 1 && r[0].startsWith('Rioja') && r[0].includes('$$$') && (await page.textContent('#list h2')).includes('Coming up'), r.join(' / '));
ok('its #tag becomes a filter chip', await page.isVisible('#chips [data-tag="date-night"]'));

// ---- duplicate ----
await page.click('#fab'); await page.fill('#find', 'rioja'); await page.waitForTimeout(800);
await page.click('#results [data-i="0"]'); await page.waitForTimeout(300);
ok('adding the same place again opens the one you have', (await toastText()).includes('Already in Want to go') && (await page.inputValue('#plName')) === 'Rioja');
await page.click('#placeSheet [data-close].iconbtn');

// ---- paste an Apple Maps link ----
await page.evaluate(() => { window.__clip = 'https://maps.apple.com/place?address=100+W+14th+Ave+Pkwy%2C+Denver%2C+CO+80204&coordinate=39.7371%2C-104.9893&name=Denver+Art+Museum&place-id=I1'; });
await page.click('#fab'); await page.click('#addPaste'); await page.waitForTimeout(600);
ok('a pasted Apple Maps link opens as a new place, matched to OpenStreetMap (Museum)', (await page.inputValue('#plName')) === 'Denver Art Museum' && (await page.textContent('#plMeta')).includes('Museum'), await page.textContent('#plMeta'));
await page.click('#plSave'); await page.waitForTimeout(300);
await page.evaluate(() => { window.__clip = 'https://maps.apple/p/AbC123'; });
await page.click('#fab'); await page.click('#addPaste'); await page.waitForTimeout(300);
ok('a short Apple Maps link: says to search by name instead', (await toastText()).includes('short link'));
await page.click('#addSheet [data-close].iconbtn');

// ---- add where I am ----
await page.click('#fab'); await page.click('#addHere'); await page.waitForTimeout(700);
ok('Add where I am: the nearest named place is filled in', (await page.inputValue('#plName')) === 'Corner Café' && (await page.textContent('#plMeta')).includes('Café'));
await page.click('#plSave'); await page.waitForTimeout(300);
await toList();

// ---- move to Been, rate ----
await page.click('#list .row:has-text("Rioja")'); await page.waitForTimeout(300);
await page.click('#plStatus [data-st="been"]');
const today = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
ok('tapping Been shows the stars and fills in today as Went on', await page.isVisible('#plRateField') && (await page.inputValue('#plDate')) === today && (await page.textContent('#plDateLbl')) === 'Went on');
await page.click('#plRate [data-r="4"]');
await page.click('#plSave'); await page.waitForTimeout(300);
ok('it moves to Been', (await toastText()).includes('Moved to Been') && (await page.textContent('#nBeen')) === '1' && (await page.textContent('#nWant')) === '2');
await page.click('#seg [data-tab="been"]'); await page.waitForTimeout(300);
r = await rows();
ok('Been shows its stars, price and the day you went', r.length === 1 && r[0].includes('★★★★') && r[0].includes('$$$') && r[0].includes('Today'), r.join(' / '));
// ---- visits ----
await page.click('#list .row:has-text("Rioja")'); await page.waitForTimeout(300);
await page.fill('#plDate', '2026-09-12'); await page.dispatchEvent('#plDate', 'change');
ok('changing Went on replaces that visit rather than adding one', await page.isHidden('#plDateHint'));
await page.click('#plAgain');
ok('Went again today keeps the earlier visit', (await page.inputValue('#plDate')) === today && (await page.textContent('#plDateHint')).includes('Been 2 times') && (await page.textContent('#plDateHint')).includes('Sep 12'), await page.textContent('#plDateHint'));
await page.click('#plSave'); await page.waitForTimeout(300);
r = await rows();
ok('the list shows how many times you’ve been', r[0].includes('2×'), r.join(' / '));
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '1-been.png') });
await page.click('#seg [data-tab="want"]'); await page.waitForTimeout(200);

// ---- sort and filter ----
await page.click('#chips [data-sort="near"]'); await page.waitForTimeout(500);
r = await rows();
ok('Nearest: the café you’re at first ("here"), then distances', r[0].startsWith('Corner Café') && (await page.textContent('#list')).includes('here') && (await page.textContent('#list')).includes('mi'), r.join(' / '));
await page.fill('#filter', 'museum'); await page.waitForTimeout(200);
ok('search your places by type or name', (await rows()).length === 1 && (await rows())[0].startsWith('Denver Art Museum'));
await page.fill('#filter', ''); await page.dispatchEvent('#filter', 'input');
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '3-want.png') });

// ---- searching for businesses from the top search box ----
await page.fill('#filter', 'pizza'); await page.waitForTimeout(900);
let lt = await page.textContent('#list');
ok('the search box finds businesses after your own places', lt.includes('None of your places match') && lt.includes('Businesses') && lt.includes('Pizzeria Locale'), lt.slice(0, 160));
await page.click('#list [data-found="0"]'); await page.waitForTimeout(400);
ok('tapping one opens it as a new place', (await page.textContent('#plLbl')) === 'New place' && (await page.inputValue('#plName')) === 'Pizzeria Locale');
await page.click('#placeSheet [data-close].iconbtn');
await page.fill('#filter', ''); await page.dispatchEvent('#filter', 'input'); await page.waitForTimeout(600);

// ---- map ----
await page.click('#viewBtn'); await page.waitForTimeout(800);
const nPins = await page.$$eval('.pin.want', p => p.length);
ok('the map shows a pin for each Want to go place', await page.isVisible('#map') && nPins === 2, nPins + ' pins');
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '4-map.png') });
// ---- searching on the map ----
await page.fill('#filter', 'pizza'); await page.waitForTimeout(900);
ok('on the map the search box stays, and results drop down under it', await page.isVisible('#filter') && await page.isVisible('#mapResults') && (await page.textContent('#mapResults')).includes('Pizzeria Locale'));
await page.click('#mapResults [data-found="0"]'); await page.waitForTimeout(1600);
ok('tapping a result flies there and opens its card', await page.isHidden('#mapResults') && (await page.textContent('.bizcard')).includes('Pizzeria Locale'));
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '7-mapsearch.png') });
await page.evaluate(() => document.querySelector('.leaflet-popup-close-button, .leaflet-container') && null);
await page.keyboard.press('Escape');
await page.fill('#filter', ''); await page.dispatchEvent('#filter', 'input'); await page.waitForTimeout(500);
await page.click('#fitBtn'); await page.waitForTimeout(800);

// ---- businesses on the map ----
await page.waitForTimeout(1200);
const dots = await page.$$eval('path.osm-dot', d => d.map(x => x.getAttribute('class')));
ok('zoomed in, nearby businesses show as dots: food and things to do, not shops (plus the pizzeria you searched for)', dots.length === 3 && dots.filter(c => c.includes('osm-food')).length === 2 && dots.some(c => c.includes('osm-fun')) && !dots.some(c => c.includes('osm-shops')), dots.join(' / '));
ok('the map view has the business chips instead of sorting', await page.isVisible('#chips [data-layer="food"]') && !(await page.isVisible('#chips [data-sort="near"]')));
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '5-businesses.png') });
await page.click('path.osm-k-node-501'); await page.waitForTimeout(400);
const card = await page.textContent('.bizcard');
ok('tapping a dot shows its card: name, type, cuisine, hours', card.includes('Little Bird Kitchen') && card.includes('Restaurant') && card.includes('American') && card.includes('8 AM–9 PM'), card);
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '6-card.png') });
await page.click('.bizcard [data-bizadd="want"]'); await page.waitForTimeout(400);
ok('Want to go from the card opens it as a new place, details filled in', (await page.inputValue('#plName')) === 'Little Bird Kitchen' && (await page.textContent('#plMeta')).includes('Restaurant') && (await page.textContent('#plInfo')).includes('8 AM–9 PM'));
await page.click('#plSave'); await page.waitForTimeout(500);
ok('once saved, its dot gives way to a pin', (await page.$$('path.osm-k-node-501')).length === 0 && (await page.$$eval('.pin.want', p => p.length)) === 3);
await page.click('#chips [data-layer="shops"]'); await page.waitForTimeout(800);
ok('switching on Shops loads and shows them too', (await page.$$('path.osm-shops')).length === 1 && calls.biz.at(-1).includes('"shop"~"^(.+)$"'));
await page.focus('#map'); for (let i = 0; i < 3; i++) { await page.keyboard.press('-'); await page.waitForTimeout(350); }
await page.waitForTimeout(1000);
ok('zoomed out, the dots go and a note says to zoom in', (await page.$$('path.osm-dot')).length === 0 && (await page.textContent('#mapHint')).includes('Zoom in'));
await page.click('#fitBtn'); await page.waitForTimeout(600);
await page.click('.pin.want >> nth=0'); await page.waitForTimeout(400);
ok('tapping a pin opens the place', await page.isVisible('#placeSheet'));
await page.click('#plDirections'); await page.waitForTimeout(300);
ok('Directions opens Apple Maps with directions to the place', calls.apple.some(u => /daddr=39\.\d+%2C-104\.\d+/.test(u) && u.includes('dirflg=d')), calls.apple.join(' '));
await page.click('#plOpen'); await page.waitForTimeout(300);
ok('Open in Apple Maps shows the place by name', calls.apple.some(u => /[?&]ll=39\.\d+,-104\.\d+&q=/.test(u)), calls.apple.join(' '));
await page.click('#placeSheet [data-close].iconbtn');
await page.click('#viewBtn'); await page.waitForTimeout(300);

// ---- delete, undo ----
await page.click('#list .row:has-text("Corner Café")'); await page.waitForTimeout(300);
await page.click('#plDelete'); await page.waitForTimeout(200);
ok('delete removes it', !(await rows()).some(x => x.startsWith('Corner Café')));
await page.click('#toastAct'); await page.waitForTimeout(200);
ok('Undo brings it back', (await rows()).some(x => x.startsWith('Corner Café')));

// ---- the family's Google Sheet (Notes'), through aOS ----
ok('no Google Sheet button or sheet: aOS links the Sheet, Places syncs by itself', (await page.$('#syncBtn, #syncSheet, #syStatus, #syNow')) === null);
ok('signed out: the places stay on the phone, and the title doesn’t say Synced', (await rows()).some(x => x.startsWith('Corner Café')) && !/Synced/.test(await page.textContent('#sub')), await page.textContent('#sub'));
ok('no link or phrase to type, no setup link, no Disconnect', (await page.$('#syUrl, #sySecret, #syConnect, #syPaste, #syNotes, #syOff')) === null);
ok('signed out: nothing goes to the Sheet', calls.sheet.length === 0 && !calls.google);
// Ella added a place from her phone; Tom signs in, on a phone where Notes kept the Sheet link and phrase (Safari: shared storage)
const mkPlace = (id, name, x) => Object.assign({ id, name, status: 'want', lat: 39.69, lon: -104.98, category: 'Restaurant', emoji: '🍽️', tags: [], notes: '', created: 1, updated: Date.now() }, x);
sheet.post({ action: 'places', places: [mkPlace('pwife1', 'Sushi Den')], graves: {} }, { key: SECRET, who: 'ella', name: 'Ella' });
await page.evaluate(([s, sheet]) => { localStorage.setItem('aos.session', s); localStorage.setItem('allison-notes-v1-sync', JSON.stringify({ url: sheet, secret: 'maple-otter' })); }, [session('tok-tom'), SHEET]);
await page.reload();
await page.waitForFunction(() => !!localStorage.getItem('allison-places-v1-synced'), null, { timeout: 8000 }).catch(() => {});   // a sync worked
await toList();
const last = calls.sheet.at(-1);
ok('signed in: sends its places with action "places", and no phrase', last && last.action === 'places' && last.who === 'tom' && last.places.length === 4 && !('secret' in last), JSON.stringify(last && { action: last.action, n: last.places.length }));
ok('and loads the family’s places (Ella’s too)', (await rows()).some(x => x.startsWith('Sushi Den')) && / · Synced$/.test(await page.textContent('#sub')), await page.textContent('#sub'));
ok('the owner’s phone hands the Notes Sheet link and phrase it found over to aOS', claims.some(c => c.who === 'tom' && c.url === SHEET && c.secret === SECRET));
const want = sheet.tab('📍 Want to go');
ok('in the Sheet, each place says who added it', want[0][0] === 'Who' && want.slice(1).some(r => r[0] === 'Ella' && r[1] === 'Sushi Den') && want.slice(1).some(r => r[0] === 'Tom' && r[1] === 'Corner Café'), JSON.stringify(want.map(r => r.slice(0, 2))));
await page.click('#list .row:has-text("Corner Café")'); await page.waitForTimeout(300);
await page.click('#plDelete'); await page.waitForTimeout(2200);
ok('a delete reaches the Sheet as a deleted mark', !sheet.post({ action: 'places', places: [], graves: {} }, { key: SECRET, who: 'ella', name: 'Ella' }).places.some(p => p.name === 'Corner Café') && Object.keys(calls.sheet.at(-1).graves).some(k => k.startsWith('places:')));
ok('no phone asked Google itself', !calls.google);

ok('no errors on the page', errors.length === 0, errors.join(' | '));

// ---- what this phone kept from before aOS: Places' own link, or Notes' (or the old Notes Vintage app's, until that is next opened) ----
for (const [label, key, tok] of [['Notes Vintage', 'allison-notesv-v1-sync', 'tok-tom'], ['Notes', 'allison-notes-v1-sync', 'tok-tom'], ['Places', 'allison-places-v1-sync', 'tok-tom'], ['Places, on Ella’s phone', 'allison-places-v1-sync', 'tok-ella']]) {
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Denver', locale: 'en-US' });
  await c2.route(/^https?:\/\/(?!localhost)/, stub);
  await sheetRoute(c2);
  await c2.addInitScript(([key, sheet, s]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    (localStorage.setItem('aos.sky', 'day'), localStorage.setItem('aos.seen', JSON.stringify({ places: '999' })));
    localStorage.setItem(key, JSON.stringify({ url: sheet, secret: 'maple-otter' }));
    localStorage.setItem('aos.session', s);
  }, [key, SHEET + '?' + key, session(tok)]);
  const p2 = await c2.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(e.message));
  const n = claims.length;
  await p2.goto(BASE + '/places/');
  await p2.waitForFunction(() => !!localStorage.getItem('allison-places-v1-synced'), null, { timeout: 8000 }).catch(() => {});
  if (tok === 'tok-tom') ok('the owner’s phone hands the link it kept (' + label + ') to aOS', claims.length === n + 1 && claims.at(-1).url === SHEET + '?' + key && claims.at(-1).who === 'tom', JSON.stringify(claims.at(-1)));
  else ok('a family member’s phone claims nothing (aOS has it already)', claims.length === n);
  if (key === 'allison-places-v1-sync') ok('then Places forgets its own copy (' + label + ')', !(await p2.evaluate(() => localStorage.getItem('allison-places-v1-sync'))));
  ok('and the family’s places load (' + label + ')', (await p2.textContent('#list')).includes('Sushi Den'));
  ok('no errors on the page (' + label + ')', e2.length === 0, e2.join(' | '));
  await c2.close();
}

// ---- a sync that goes wrong, with no status sheet: no toast for a Sheet not set up yet; a real error, one toast a visit ----
{
  let fails = 'no-sheet', n = 0;
  const c3 = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Denver', locale: 'en-US' });
  await c3.route(/^https?:\/\/(?!localhost)/, stub);
  await c3.route('**/sheet/api/**', route => {
    if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":true}' });
    n++;
    return fails === 'no-sheet' ? route.fulfill({ status: 409, contentType: 'application/json', body: '{"ok":false,"error":"no-sheet"}' })
      : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fails ? { ok: false, app: 'allison-notes-sync', aos: true, error: fails } : { ok: true, app: 'allison-notes-sync', v: 2, aos: true, places: [], graves: {} }) });
  });
  await c3.addInitScript(s => { localStorage.setItem('aos.sky', 'day'); localStorage.setItem('aos.seen', JSON.stringify({ places: '999' })); localStorage.setItem('aos.session', s); }, session('tok-ella'));
  const p3 = await c3.newPage(); const e3 = []; p3.on('pageerror', e => e3.push(e.message));
  const toastShown = () => p3.evaluate(() => !document.getElementById('toast').hidden);
  const again = async () => { const m = n; await p3.evaluate(() => dispatchEvent(new Event('online'))); for (let i = 0; i < 40 && n === m; i++) await p3.waitForTimeout(100); await p3.waitForTimeout(400); };
  await p3.goto(BASE + '/places/');
  for (let i = 0; i < 60 && !n; i++) await p3.waitForTimeout(100);
  await p3.waitForTimeout(400);
  ok('quiet sync: a Sheet that isn’t set up yet shows no toast (the owner sets it up in aOS)', n > 0 && !(await toastShown()));
  await again();
  ok('nor at the next sync, and the title says Not synced', !(await toastShown()) && / · Not synced$|^Not synced$/.test(await p3.textContent('#sub')), await p3.textContent('#sub'));
  fails = 'busy'; await again();
  ok('a real error: one toast, in its words', await toastShown() && (await p3.textContent('#toastMsg')) === 'The Sheet was busy. Trying again shortly.', await p3.textContent('#toastMsg'));
  await p3.evaluate(() => { document.getElementById('toast').hidden = true; });
  fails = null; await again(); fails = 'busy'; await again();
  ok('once a visit, even after a sync that worked', !(await toastShown()));
  ok('no errors on the page (sync errors)', e3.length === 0, e3.join(' | '));
  await c3.close();
}

// ---- Vintage, the default design: drawn in the Retro look, light and dark ----
const q = (pg, sel, props, pseudo) => pg.$eval(sel, (e, [props, pseudo]) => { const c = getComputedStyle(e, pseudo || null); return props.map(p => c[p]); }, [props, pseudo]);
const soonStr2 = soonStr;
for (const scheme of ['light', 'dark']) {
  const cream = scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', ground = scheme === 'light' ? 'rgb(241, 223, 187)' : 'rgb(74, 57, 30)';
  const teal = scheme === 'light' ? 'rgb(31, 111, 107)' : 'rgb(79, 179, 171)', orangeBtn = scheme === 'light' ? 'rgb(201, 80, 42)' : 'rgb(216, 87, 42)';
  const MUSTARD = 'rgb(227, 167, 47)', ORANGE = 'rgb(216, 87, 42)';
  const rc = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, geolocation: { latitude: 39.7392, longitude: -104.9903 }, permissions: ['geolocation'], timezoneId: 'America/Denver', locale: 'en-US' });
  await rc.route(/^https?:\/\/(?!localhost)/, stub);
  await rc.addInitScript(([planned, today]) => {
    (localStorage.setItem('aos.sky', 'day'), localStorage.setItem('aos.seen', JSON.stringify({ places: '999' })));
    const mk = (id, name, status, lat, lon, extra) => Object.assign({ id, name, status, lat, lon, category: 'Restaurant', city: 'Denver', emoji: '🍽️', tags: [], notes: '', created: 1, updated: 1 }, extra);
    localStorage.setItem('allison-places-v1', JSON.stringify([
      mk('r1', 'Rioja', 'want', 39.7432, -104.9950, { planned, price: 3, notes: 'Dinner #date-night', tags: ['date-night'] }),
      mk('r2', 'Corner Café', 'want', 39.7393, -104.9903, { emoji: '☕', category: 'Café' }),
      mk('r3', 'Denver Art Museum', 'want', 39.7372, -104.9892, { emoji: '🏛️', category: 'Museum' }),
      mk('r4', 'Sushi Den', 'been', 39.7385, -104.9910, { rating: 4, price: 3, visited: today, visits: [today] }),
    ]));
    localStorage.setItem('allison-places-v1-here', JSON.stringify({ lat: 39.7392, lon: -104.9903 }));
  }, [soonStr2, today]);
  const rp = await rc.newPage(); const re = []; rp.on('pageerror', e => re.push(e.message));
  rp.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) re.push(m.text()); });
  await rp.goto(BASE + '/places/'); await rp.waitForTimeout(1500);
  const lbl = s => scheme + ': ' + s;
  ok(lbl('Vintage by default: data-look vintage, the Vintage styles on, the sky (held at day)'), await rp.evaluate(() => document.documentElement.dataset.look === 'vintage' && document.getElementById('vintage').media === 'all' && document.documentElement.dataset.sky === 'day' && !localStorage.getItem('design.places')));
  ok(lbl('Vintage: the Vintage icon, the theme colour is the sky\'s ground, the status bar is not translucent'), /(^|\/)icon-180\.png/.test(await rp.getAttribute('link[rel="apple-touch-icon"]', 'href'))
    && (await rp.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content')) === (scheme === 'light' ? '#F1DFBB' : '#4A391E')
    && (await rp.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content')) === 'default');
  ok(lbl('Vintage: the shapes are in the header, the Sea glass aurora is off'), await rp.evaluate(() => getComputedStyle(document.querySelector('.top > .ambient')).display === 'block' && getComputedStyle(document.querySelector('body > .ambient')).display === 'none'));
  // the map, which Places opens on
  ok(lbl('Retro: Futura, and the ' + (scheme === 'light' ? 'cream' : 'walnut') + ' ground'), /Futura/.test((await q(rp, 'body', ['fontFamily']))[0]) && (await q(rp, 'body', ['backgroundColor']))[0] === ground);
  ok(lbl('Retro: a mustard sun, a teal dot and an orange pill behind the title'), (await q(rp, '.ambient i:nth-child(1)', ['backgroundColor']))[0] === (MUSTARD) && (await q(rp, '.ambient i:nth-child(2)', ['backgroundColor']))[0] === teal && (await q(rp, '.ambient i:nth-child(3)', ['backgroundColor']))[0] === ORANGE);
  ok(lbl('Retro: on the map the header is clear and the shapes (in it, behind the controls) sit over the map'), (await q(rp, '.top', ['backgroundColor']))[0] === 'rgba(0, 0, 0, 0)' && await rp.evaluate(() => { const a = document.querySelector('.ambient'); return !!a.closest('.top') && +getComputedStyle(a.closest('.top')).zIndex > +getComputedStyle(document.getElementById('map')).zIndex; }));
  ok(lbl('Retro: a 44px title with the three little bars under it'), (await q(rp, '.title', ['fontSize']))[0] === '44px' && (await q(rp, '.title', ['backgroundImage'], '::after'))[0].startsWith('url('));
  ok(lbl('Retro: the add button is solid orange'), (await q(rp, '#fab', ['backgroundColor']))[0] === orangeBtn);
  ok(lbl('Retro: the tab switch is flat, with a mustard thumb'), (await q(rp, '#seg .slthumb', ['backgroundColor']))[0] === MUSTARD && (await q(rp, '#seg', ['backgroundColor', 'backdropFilter'])).join('|').startsWith(cream + '|') && ['none', ''].includes((await q(rp, '#seg', ['backdropFilter']))[0]));
  ok(lbl('Retro: Food & drink and Things to do are on (mustard), Shops is off (cream)'), (await q(rp, '#chips [data-layer="food"]', ['backgroundColor']))[0] === MUSTARD && (await q(rp, '#chips [data-layer="shops"]', ['backgroundColor']))[0] === cream);
  ok(lbl('Retro: pins for Want to go are teal'), (await q(rp, '.pin.want', ['backgroundColor']))[0] === teal);
  await rp.click('#fitBtn'); await rp.waitForTimeout(2500);
  const dotFill = async c => (await rp.$$eval('path.' + c, d => d.map(x => getComputedStyle(x).fill)))[0];
  ok(lbl('Retro: business dots: orange for food, olive for things to do'), (await dotFill('osm-food')) === ORANGE && (await dotFill('osm-fun')) === (scheme === 'light' ? 'rgb(126, 140, 52)' : 'rgb(163, 176, 74)'), (await dotFill('osm-food')) + ' / ' + (await dotFill('osm-fun')));
  await rp.click('path.osm-k-node-501'); await rp.waitForTimeout(400);
  const [cb, cr, cf] = await q(rp, '.bizpop .leaflet-popup-content-wrapper', ['backgroundColor', 'borderRadius', 'backdropFilter']);
  ok(lbl('Retro: the business card is a flat panel, with an orange Want to go and outlined teal Been'), cb === cream && cr === '20px' && ['none', ''].includes(cf) && (await q(rp, '.bizacts [data-bizadd="want"]', ['backgroundColor']))[0] === orangeBtn && (await q(rp, '.bizacts [data-bizadd="been"]', ['backgroundColor']))[0] === 'rgba(0, 0, 0, 0)');
  if (SHOTS) await rp.screenshot({ path: path.join(SHOTS, '20-retro-map-' + scheme + '.png') });
  await rp.keyboard.press('Escape');
  await rp.click('#seg [data-tab="been"]'); await rp.waitForTimeout(500);
  ok(lbl('Retro: pins for Been are mustard'), (await q(rp, '.pin.been', ['backgroundColor']))[0] === MUSTARD);
  await rp.click('#seg [data-tab="want"]');
  // the list
  await rp.click('#viewBtn'); await rp.waitForTimeout(500);
  const [gb, gs, gf, gr] = await q(rp, '#list .group', ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
  ok(lbl('Retro: the lists are flat cards, 20px round, no blur or shadow'), gb === cream && gs === 'none' && ['none', ''].includes(gf) && gr === '20px', [gb, gs, gf, gr].join(' '));
  ok(lbl('Retro: in the list the header is solid ground, so the list slides under it, never through the title'), (await q(rp, '.top', ['backgroundColor']))[0] === ground && (await q(rp, '.top', ['position']))[0] === 'sticky');
  ok(lbl('Retro: the chosen sort is a mustard pill, the others cream'), (await q(rp, '#chips [data-sort="soon"]', ['backgroundColor']))[0] === MUSTARD && (await q(rp, '#chips [data-sort="near"]', ['backgroundColor']))[0] === cream);
  ok(lbl('Retro: the search box is a flat cream pill'), (await q(rp, '#filterWrap', ['backgroundColor']))[0] === cream && ['none', ''].includes((await q(rp, '#filterWrap', ['backdropFilter']))[0]));
  ok(lbl('Retro: no sideways scroll'), await rp.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (SHOTS) await rp.screenshot({ path: path.join(SHOTS, '21-retro-list-' + scheme + '.png') });
  // a place's sheet
  await rp.click('#list .row:has-text("Rioja")'); await rp.waitForTimeout(700);
  const [sb, sr, sf] = await q(rp, '#placeSheet .sheet', ['backgroundColor', 'borderRadius', 'backdropFilter']);
  ok(lbl('Retro: the sheet is a flat panel with round corners'), sb === cream && sr === '28px' && ['none', ''].includes(sf), [sb, sr, sf].join(' '));
  ok(lbl('Retro: Save is solid orange'), (await q(rp, '#plSave', ['backgroundColor']))[0] === orangeBtn);
  ok(lbl('Retro: Want to go / Been and the price have a mustard thumb'), (await q(rp, '#plStatus .slthumb', ['backgroundColor']))[0] === MUSTARD && (await q(rp, '#plPrice .slthumb', ['backgroundColor']))[0] === MUSTARD);
  ok(lbl('Retro: Delete place is outlined, not filled'), (await q(rp, '#plDelete', ['backgroundColor']))[0] === 'rgba(0, 0, 0, 0)');
  await rp.click('#plStatus [data-st="been"]'); await rp.click('#plRate [data-r="4"]'); await rp.waitForTimeout(300);
  ok(lbl('Retro: the chosen stars are mustard'), (await q(rp, '#plRate button.on', ['color']))[0] === (scheme === 'light' ? 'rgb(184, 120, 15)' : MUSTARD));
  if (SHOTS) await rp.screenshot({ path: path.join(SHOTS, '22-retro-place-' + scheme + '.png') });
  await rp.click('#placeSheet [data-close].iconbtn'); await rp.waitForTimeout(300);
  // Settings and the toast (no Google Sheet button or sheet: aOS links the Sheet)
  ok(lbl('Retro: no Google Sheet button or sheet'), (await rp.$('#syncBtn, #syncSheet')) === null);
  await rp.click('#setBtn'); await rp.waitForTimeout(500);
  ok(lbl('Retro: the Settings sheet is a flat panel too'), (await q(rp, '#setSheet .sheet', ['backgroundColor']))[0] === cream && ['none', ''].includes((await q(rp, '#setSheet .sheet', ['backdropFilter']))[0]));
  await rp.click('#setSheet [data-close].iconbtn'); await rp.waitForTimeout(300);
  await rp.click('#list .row:has-text("Corner")'); await rp.waitForTimeout(300); await rp.click('#plDelete'); await rp.waitForTimeout(300);
  ok(lbl('Retro: the toast is a flat panel'), (await q(rp, '#toast', ['backgroundColor']))[0] === (scheme === 'light' ? 'rgb(240, 229, 208)' : 'rgb(61, 51, 44)') && ['none', ''].includes((await q(rp, '#toast', ['backdropFilter']))[0]));
  ok(lbl('no errors on the page'), re.length === 0, re.join(' | '));
  await rc.close();
}

// ---- Standard (Sea glass), and Settings > Design ----
const seedPlaces = ([planned, today, design, extra]) => {
  if (sessionStorage.getItem('seeded')) return;   // once per page, so a reload keeps what the page changed
  sessionStorage.setItem('seeded', '1');
  if (extra) { for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v); }
  else {
    localStorage.setItem('aos.seen', JSON.stringify({ places: '999' }));
    const mk = (id, name, status, lat, lon, x) => Object.assign({ id, name, status, lat, lon, category: 'Restaurant', city: 'Denver', emoji: '🍽️', tags: [], notes: '', created: 1, updated: 1 }, x);
    localStorage.setItem('allison-places-v1', JSON.stringify([
      mk('r1', 'Rioja', 'want', 39.7432, -104.9950, { planned, price: 3 }), mk('r2', 'Corner Café', 'want', 39.7393, -104.9903, { emoji: '☕', category: 'Café' }),
      mk('r3', 'Denver Art Museum', 'want', 39.7372, -104.9892, { emoji: '🏛️', category: 'Museum' }), mk('r4', 'Sushi Den', 'been', 39.7385, -104.9910, { rating: 4, visited: today, visits: [today] }),
    ]));
    localStorage.setItem('allison-places-v1-here', JSON.stringify({ lat: 39.7392, lon: -104.9903 }));
  }
  localStorage.setItem('aos.sky', 'day');
  if (design) localStorage.setItem('design.places', design);
};
async function phone(scheme, { design = null, extra = null, at = '/places/' } = {}) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, geolocation: { latitude: 39.7392, longitude: -104.9903 }, permissions: ['geolocation'], timezoneId: 'America/Denver', locale: 'en-US' });
  await c.route(/^https?:\/\/(?!localhost)/, stub);
  await c.addInitScript(seedPlaces, [soonStr, today, design, extra]);
  const pg = await c.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await pg.goto(BASE + at); await pg.waitForTimeout(1200);
  return { c, pg, errs };
}
const look = pg => pg.evaluate(() => document.documentElement.dataset.look);
const fill = (pg, cls) => pg.$$eval('path.' + cls, d => d.map(x => getComputedStyle(x).fill)[0]);
for (const scheme of ['light', 'dark']) {
  const { c, pg, errs } = await phone(scheme, { design: 'glass' });
  const lbl = s => scheme + ' Standard: ' + s;
  ok(lbl('data-look is glass, the Vintage styles are off, no sky'), await pg.evaluate(() => document.documentElement.dataset.look === 'glass' && document.getElementById('vintage').media === 'not all' && !document.documentElement.hasAttribute('data-sky')));
  ok(lbl('the Sea glass ground and the system font'), (await q(pg, 'body', ['backgroundColor']))[0] === (scheme === 'light' ? 'rgb(238, 242, 240)' : 'rgb(13, 18, 19)') && !/Futura/.test((await q(pg, 'body', ['fontFamily']))[0]));
  ok(lbl('the Sea glass icon, a translucent status bar, the Sea glass bar colour'), /icon-glass-180\.png/.test(await pg.getAttribute('link[rel="apple-touch-icon"]', 'href'))
    && (await pg.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content')) === 'black-translucent'
    && (await pg.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content')) === (scheme === 'light' ? '#EEF2F0' : '#0D1213'));
  ok(lbl('the aurora behind everything, no atomic shapes in the header'), await pg.evaluate(() => getComputedStyle(document.querySelector('body > .ambient')).display === 'block' && getComputedStyle(document.querySelector('body > .ambient')).position === 'fixed' && getComputedStyle(document.querySelector('.top > .ambient')).display === 'none'));
  ok(lbl('a 34px title, no bars under it; glass buttons'), (await q(pg, '.title', ['fontSize']))[0] === '34px' && ['none', ''].includes((await q(pg, '.title', ['content'], '::after'))[0]) && !['none', ''].includes((await q(pg, '#viewBtn', ['backdropFilter']))[0]));
  ok(lbl('pins for Want to go are blue'), (await q(pg, '.pin.want', ['backgroundColor']))[0] === 'rgb(10, 132, 255)');
  await pg.click('#fitBtn'); await pg.waitForTimeout(2500);
  ok(lbl('business dots in Places\' own colours: coral for food, violet for things to do'), (await fill(pg, 'osm-food')) === 'rgb(255, 107, 87)' && (await fill(pg, 'osm-fun')) === 'rgb(142, 108, 255)', (await fill(pg, 'osm-food')) + ' / ' + (await fill(pg, 'osm-fun')));
  ok(lbl('the map is clear of the header'), await pg.evaluate(() => { const t = document.querySelector('.top').getBoundingClientRect().bottom; return [...document.querySelectorAll('.pin')].every(p => p.getBoundingClientRect().top >= t - 30); }));
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, '30-glass-map-' + scheme + '.png') });
  await pg.click('#viewBtn'); await pg.waitForTimeout(500);
  ok(lbl('in the list the header is clear glass over the aurora, not solid ground'), (await q(pg, '.top', ['backgroundColor']))[0] === 'rgba(0, 0, 0, 0)' && (await q(pg, '#list .group', ['borderRadius']))[0] === '24px');
  ok(lbl('no sideways scroll'), await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, '31-glass-list-' + scheme + '.png') });
  ok(lbl('no errors on the page'), errs.length === 0, errs.join(' | '));
  await c.close();
}
{ // Settings > Design: Vintage, then Standard and back, at once (what the script drew too), kept across a reload
  const { c, pg, errs } = await phone('light');
  await pg.click('#fitBtn'); await pg.waitForTimeout(2500);
  ok('Design: Vintage by default, with the Vintage icon and Retro dots', await look(pg) === 'vintage' && !/glass/.test(await pg.getAttribute('link[rel="apple-touch-icon"]', 'href')) && (await fill(pg, 'osm-food')) === 'rgb(216, 87, 42)');
  await pg.click('#setBtn'); await pg.waitForTimeout(400);
  ok('Design: the gear opens Settings, Design first, Vintage picked', await pg.isVisible('#setSheet') && (await pg.textContent('#setBody .label')) === 'Design'
    && (await pg.getAttribute('#setBody [data-design="vintage"]', 'aria-checked')) === 'true' && (await pg.getAttribute('#setBody [data-design="glass"]', 'aria-checked')) === 'false');
  const w0 = await pg.$eval('#seg .slthumb', e => e.getBoundingClientRect().width);
  await pg.click('#setBody [data-design="glass"]'); await pg.waitForTimeout(300);
  ok('Design: Standard at once, Settings still open', await look(pg) === 'glass' && (await pg.getAttribute('#setBody [data-design="glass"]', 'aria-checked')) === 'true' && await pg.isVisible('#setSheet')
    && (await pg.evaluate(() => document.getElementById('vintage').media)) === 'not all' && (await pg.evaluate(() => localStorage.getItem('design.places'))) === 'glass');
  ok('Design: the business dots take Places\' own colours at once', (await fill(pg, 'osm-food')) === 'rgb(255, 107, 87)' && (await fill(pg, 'osm-fun')) === 'rgb(142, 108, 255)', (await fill(pg, 'osm-food')) + ' / ' + (await fill(pg, 'osm-fun')));
  const tab = await pg.$eval('#seg [aria-pressed="true"]', e => e.getBoundingClientRect().width), w1 = await pg.$eval('#seg .slthumb', e => e.getBoundingClientRect().width);
  ok('Design: the tab thumb is measured again for the new font', Math.abs(w1 - tab) < 2, w0 + ' -> ' + w1 + ' (tab ' + tab + ')');
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, '32-settings-glass.png') });
  await pg.reload(); await pg.waitForTimeout(1200);
  ok('Design: Standard is kept', await look(pg) === 'glass' && (await pg.evaluate(() => localStorage.getItem('design.places'))) === 'glass');
  await pg.click('#setBtn'); await pg.waitForTimeout(400);
  ok('Design: Settings shows Standard picked', (await pg.getAttribute('#setBody [data-design="glass"]', 'aria-checked')) === 'true');
  await pg.click('#setBody [data-design="vintage"]'); await pg.waitForTimeout(300);
  ok('Design: back to Vintage at once', await look(pg) === 'vintage' && (await pg.evaluate(() => document.getElementById('vintage').media)) === 'all');
  await pg.click('#setSheet [data-close].iconbtn'); await pg.waitForTimeout(200);
  await pg.reload(); await pg.waitForTimeout(1200);
  ok('Design: Vintage is kept', await look(pg) === 'vintage' && (await pg.evaluate(() => localStorage.getItem('design.places'))) === 'vintage');
  ok('Design: no errors on the page', errs.length === 0, errs.join(' | '));
  await c.close();
}
{ // the old Places Vintage app, on a phone that added it: its address opens Places, with its data moved over once
  const old = [{ id: 'v1', name: 'Snooze', status: 'want', lat: 39.75, lon: -104.99, category: 'Restaurant', emoji: '🍳', tags: [], notes: '', created: 1, updated: 1 }];
  const extra = { 'aos.seen': JSON.stringify({ placesvintage: '1.3' }), 'allison-placesv-v1': JSON.stringify(old), 'allison-placesv-v1-sort': JSON.stringify({ want: 'new', been: 'top' }), 'allison-placesv-v1-sync': JSON.stringify({ url: SHEET, secret: 'maple-otter' }) };
  const { c, pg, errs } = await phone('light', { extra, at: '/placesvintage/' });
  const got = await pg.evaluate(() => ({ list: document.getElementById('list').textContent, want: document.getElementById('nWant').textContent, sort: localStorage.getItem('allison-places-v1-sort'), sync: JSON.parse(localStorage.getItem('allison-places-v1-sync') || 'null'),
    seen: JSON.parse(localStorage.getItem('aos.seen') || '{}'), oldKept: !!localStorage.getItem('allison-placesv-v1') && !!localStorage.getItem('allison-placesv-v1-sync'), look: document.documentElement.dataset.look }));
  ok('old address: Places Vintage\'s places are now Places\' and show in the app', got.list.includes('Snooze') && got.want === '1' && JSON.parse(got.sort || '{}').want === 'new', JSON.stringify(got));
  ok('old address: its Sheet link came too (to be handed to aOS once signed in)', got.sync && got.sync.secret === 'maple-otter');
  ok('old address: what it had seen carries over (no walkthrough again), and nothing old is deleted', got.seen.places === '1.3' && got.oldKept);
  ok('old address: in Vintage', got.look === 'vintage');
  await pg.evaluate(o => localStorage.setItem('allison-placesv-v1', JSON.stringify([...o, { ...o[0], id: 'v2', name: 'Later one' }])), old);
  await pg.reload(); await pg.waitForTimeout(1200);
  ok('old address: moved once only', !(await pg.textContent('#list')).includes('Later one') && (await pg.textContent('#list')).includes('Snooze'));
  ok('old address: no errors on the page', errs.length === 0, errs.join(' | '));
  await c.close();
}
{ // a phone with both (Safari): Places' own data is kept, the old app's is not copied over it
  const extra = { 'aos.seen': JSON.stringify({ places: '999', placesvintage: '999' }), 'allison-places-v1': JSON.stringify([{ id: 'm1', name: 'Mine', status: 'want', created: 1, updated: 1 }]), 'allison-placesv-v1': JSON.stringify([{ id: 'v1', name: 'Theirs', status: 'want', created: 1, updated: 1 }]) };
  const { c, pg } = await phone('light', { extra, at: '/placesvintage/' });
  const t = await pg.textContent('#list');
  ok('both: Places\' own places are kept, the old app\'s not copied over them', t.includes('Mine') && !t.includes('Theirs') && JSON.parse(await pg.evaluate(() => localStorage.getItem('allison-places-v1'))).length === 1);
  await c.close();
}
await browser.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
