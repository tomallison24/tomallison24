// Weather's tools for Ipsy in aOS (weather/ipsy-tools.js, offered as AllisonOS.ipsyTools): the
// person's places, the forecast for one of them or for any city (in their units, the place's own
// times), and showing a place and its radar. They only read: a city looked up isn't saved.
// The weather services are scripts/fake-weather.mjs's stand-ins (no network).
//   node weather/scripts/ipsy-test.mjs [repo root]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { installWeather, PLACE } from './fake-weather.mjs';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
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
const browser = await chromium.launch();
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('ok - ' + name); }
  catch (e) { console.log('not ok - ' + name + '\n  ' + String(e.message || e).split('\n')[0]); await browser.close(); server.close(); process.exit(1); }
}

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', geolocation: { latitude: PLACE.lat, longitude: PLACE.lon }, permissions: ['geolocation'], timezoneId: 'America/New_York' });
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('aos.seen', JSON.stringify({ weather: '999' })); localStorage.setItem('aos.sky', 'day');
  localStorage.setItem('wx.places', JSON.stringify([{ lat: 42.36, lon: -71.06, name: 'Boston', sub: 'Massachusetts, United States' }]));
});
await installWeather(ctx);
const page = await ctx.newPage();
const problems = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404/.test(m.text())) problems.push(m.text()); });
page.on('pageerror', e => problems.push(String(e)));
await page.goto(BASE + '/weather/');
await page.waitForSelector('#hxTray .hx-col', { timeout: 10000 });
const run = (name, input) => page.evaluate(async ([name, input]) => {
  try { return (await AllisonOS.ipsyTools.tools[name](input, {})).content; } catch (e) { return { error: e.message }; }
}, [name, input]);

await test('the offer: app weather, its three tools', async () => {
  assert.deepEqual(await page.evaluate(() => [AllisonOS.ipsyTools.app, Object.keys(AllisonOS.ipsyTools.tools).sort()]), ['weather', ['get_forecast', 'get_places', 'show_place']]);
});
await test('get_places: where they are and the cities they saved, with their units', async () => {
  const r = await run('get_places', {});
  assert.match(r.units, /^US/);
  assert.deepEqual(r.places.map(p => [p.id, p.name, p.kind]), [['here', PLACE.city, 'where you are'], ['p0', 'Boston', 'saved']]);
  assert.equal(typeof r.places[0].now, 'number');
});
await test('get_forecast: now, the hours and days asked for, in °F, the place\'s own times', async () => {
  const r = await run('get_forecast', { place: 'here', hours: 6, days: 3 });
  assert.equal(r.source, 'NWS'); assert.equal(r.units.temperature, '°F'); assert.equal(r.precipitation_means, 'chance of rain or snow');
  assert.equal(typeof r.now.temperature, 'number');
  assert.equal(r.hourly.length, 6); assert.match(r.hourly[0].time, /^\d{4}-\d\d-\d\dT\d\d:\d\d$/); assert.match(r.hourly[0].precipitation, /%$/);
  assert.equal(r.daily.length, 3); assert.match(r.daily[0].date, /^\d{4}-\d\d-\d\d$/); assert.ok(r.daily[0].high >= r.daily[0].low);
  assert.ok(Array.isArray(r.alerts));
});
await test('in metric, the same forecast in °C', async () => {
  const f = await run('get_forecast', { place: 'here', hours: 1, days: 0 });
  await page.evaluate(() => { S.units = 'metric'; });
  const c = await run('get_forecast', { place: 'here', hours: 1, days: 0 });
  await page.evaluate(() => { S.units = 'us'; });
  assert.equal(c.units.temperature, '°C');
  assert.ok(Math.abs(c.now.temperature - (f.now.temperature - 32) * 5 / 9) <= 1, f.now.temperature + '°F is ' + c.now.temperature + '°C');
});
await test('a saved city by name is theirs; any other city is looked up, and not saved', async () => {
  const b = await run('get_forecast', { place: 'Boston', days: 1 });
  assert.equal(b.id, 'p0'); assert.match(b.place, /^Boston, Massachusetts/);
  const o = await run('get_forecast', { place: 'Columbus', hours: 2, days: 1 });
  assert.equal(o.id, undefined); assert.match(o.place, /^Columbusville, Ohio/); assert.equal(o.hourly.length, 2);
  const kept = await page.evaluate(() => ({ places: JSON.parse(localStorage.getItem('wx.places')).length, cached: Object.keys(JSON.parse(localStorage.getItem('wx.cache'))) }));
  assert.equal(kept.places, 1); assert.ok(!kept.cached.includes('39.960,-82.990'), 'a city looked up isn\'t kept');
});
await test('show_place: one of their places, and its radar, on screen; any other city can\'t be shown', async () => {
  const r = await run('show_place', { place: 'p0', view: 'radar' });
  assert.equal(r.shown, 'Boston');
  assert.deepEqual(await page.evaluate(() => [currentId(), S.view]), ['p0', 'radar']);
  assert.match((await run('show_place', { place: 'Columbus' })).error, /isn't one of their places/);
  assert.match((await run('show_place', { place: 'here', view: 'pollen' })).error, /view is one of/);
});
await test('no script errors', async () => assert.deepEqual(problems, []));

await ctx.close();
await browser.close();
server.close();
console.log(passed + ' tests passed');
