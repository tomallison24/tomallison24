// Drives Places in headless Chromium against stand-ins for Photon (search),
// Overpass (opening hours etc.), CARTO's map tiles and the Notes Google Sheet:
// adding by search, by a pasted Apple Maps link and from where you are; the
// place sheet (status, stars, price, dates, notes and #tags, OpenStreetMap
// details); moving a place to Been; the lists, sorting and filters; the map
// and its pins; Apple Maps directions; delete with undo; and the Sheet sync,
// including an old script that doesn't know Places yet.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node places/scripts/app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
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
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;
const SHEET = 'https://script.google.com/macros/s/AKfycbTEST/exec';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAAAASUVORK5CYII=', 'base64');

const feat = (lon, lat, props) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props });
const RIOJA = feat(-104.9997, 39.7478, { osm_type: 'N', osm_id: 111, osm_key: 'amenity', osm_value: 'restaurant', type: 'house', name: 'Rioja', housenumber: '1431', street: 'Larimer Street', city: 'Denver', state: 'Colorado', countrycode: 'US' });
const DAM = feat(-104.9892, 39.7372, { osm_type: 'W', osm_id: 222, osm_key: 'tourism', osm_value: 'museum', type: 'house', name: 'Denver Art Museum', street: 'West 14th Avenue Parkway', housenumber: '100', city: 'Denver', state: 'Colorado', countrycode: 'US' });
const CAFE = feat(-104.9903, 39.7393, { osm_type: 'N', osm_id: 333, osm_key: 'amenity', osm_value: 'cafe', type: 'house', name: 'Corner Café', city: 'Denver', state: 'Colorado', countrycode: 'US' });
const HOUSE = feat(-104.98, 39.74, { osm_type: 'W', osm_id: 9, osm_key: 'building', osm_value: 'house', type: 'house', housenumber: '12', street: 'Elm St', city: 'Denver', state: 'Colorado', countrycode: 'US' });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 39.7392, longitude: -104.9903 }, permissions: ['geolocation'], timezoneId: 'America/Denver', locale: 'en-US' });
const calls = { photon: [], overpass: 0, sheet: [], apple: [] };
let sheetMode = 'old', sheetPlaces = [];
await ctx.route(/^https?:\/\/(?!localhost)/, async route => {
  const u = route.request().url(), cors = { 'Access-Control-Allow-Origin': '*' };
  if (u.startsWith('https://photon.komoot.io/api/')) {
    const q = new URL(u).searchParams.get('q').toLowerCase(); calls.photon.push(q);
    const fs2 = q.includes('rioja') ? [RIOJA, HOUSE] : q.includes('art museum') ? [DAM] : [];
    return route.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify({ type: 'FeatureCollection', features: fs2 }) });
  }
  if (u.startsWith('https://photon.komoot.io/reverse')) return route.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify({ features: [CAFE] }) });
  if (u.startsWith('https://overpass-api.de/')) {
    calls.overpass++;
    const body = decodeURIComponent((route.request().postData() || '').replace(/^data=/, ''));
    const tags = body.includes('node(111)') ? { amenity: 'restaurant', opening_hours: 'Mo-Fr 11:00-22:00; Sa,Su 10:00-23:00', phone: '+1 303-820-2282', website: 'riojadenver.com', cuisine: 'mediterranean' } : { tourism: 'museum' };
    return route.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify({ elements: [{ type: 'node', id: 1, tags }] }) });
  }
  if (u.includes('basemaps.cartocdn.com')) return route.fulfill({ contentType: 'image/png', body: PNG });
  if (u.startsWith(SHEET)) {
    const b = JSON.parse(route.request().postData() || '{}'); calls.sheet.push(b);
    if (b.secret !== 'maple-otter') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'wrong-secret' }) });
    if (sheetMode === 'old') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, notes: [], todos: [], lists: [], graves: {} }) });
    const byId = new Map(sheetPlaces.map(p => [p.id, p]));
    for (const p of b.places || []) if (!byId.has(p.id) || p.updated > byId.get(p.id).updated) byId.set(p.id, p);
    sheetPlaces = [...byId.values()].filter(p => !(b.graves || {})['places:' + p.id]);
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, places: sheetPlaces, graves: b.graves || {} }) });
  }
  if (u.startsWith('https://maps.apple.com/')) { calls.apple.push(u); return route.fulfill({ status: 204, body: '' }); }
  return route.fulfill({ status: 404, body: '' });
});
await ctx.addInitScript(() => {
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

ok('starts empty, with a hint how to add', (await page.textContent('#list')).includes('Tap + to add'));

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
await page.click('#plSave');
await page.waitForTimeout(400);
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
ok('changing Went on replaces that visit rather than adding one', (await page.textContent('#plDateHint')).startsWith('The day you went'));
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

// ---- map ----
await page.click('#viewBtn'); await page.waitForTimeout(800);
const nPins = await page.$$eval('.pin.want', p => p.length);
ok('the map shows a pin for each Want to go place', await page.isVisible('#map') && nPins === 2, nPins + ' pins');
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '4-map.png') });
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

// ---- sync ----
await page.evaluate(sheet => localStorage.setItem('allison-notes-v1-sync', JSON.stringify({ url: sheet, secret: 'maple-otter' })), SHEET);
await page.click('#syncBtn'); await page.waitForTimeout(200);
ok('the Notes Sheet is offered in one tap where Notes shares storage', await page.isVisible('#syNotes'));
await page.click('#syNotes'); await page.waitForTimeout(500);
ok('an old Notes script: says it needs updating, and stays unconnected', (await page.textContent('#syStatus')).includes('needs updating') && await page.isVisible('#syForm'), await page.textContent('#syStatus'));
sheetMode = 'new';
sheetPlaces = [{ id: 'pwife1', name: 'Sushi Den', status: 'want', lat: 39.69, lon: -104.98, category: 'Restaurant', emoji: '🍽️', tags: [], created: 1, updated: Date.now() }];
await page.click('#syNotes'); await page.waitForTimeout(600);
const last = calls.sheet.at(-1);
ok('connected: sends its places with action "places" and the Notes secret', last.action === 'places' && last.secret === 'maple-otter' && last.places.length === 3, JSON.stringify({ action: last.action, n: last.places.length }));
ok('and loads the other phone’s place', (await rows()).some(x => x.startsWith('Sushi Den')) && (await page.textContent('#syStatus')).includes('Connected'));
await page.click('#syncSheet [data-close].iconbtn');
await page.click('#list .row:has-text("Corner Café")'); await page.waitForTimeout(300);
await page.click('#plDelete'); await page.waitForTimeout(2200);
ok('a delete reaches the Sheet as a deleted mark', !sheetPlaces.some(p => p.name === 'Corner Café') && Object.keys(calls.sheet.at(-1).graves).some(k => k.startsWith('places:')));

ok('no errors on the page', errors.length === 0, errors.join(' | '));
await browser.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
