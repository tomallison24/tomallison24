// Drives the Weather Vintage app in headless Chromium at iPhone size, light and dark, against made-up weather
// (scripts/fake-weather.mjs stands in for the National Weather Service, Open-Meteo, BigDataCloud and the map
// tiles, so no network is used): it opens to where you are, the hourly, feels like, humidity, wind and radar
// views, the hour and day sheets, the Places sheet (search, add a city, units, page dots), the alerts, the
// radar's forecast frames through Weather's own helper (../weather/api/hrrr), and that nothing trips the
// page's Content Security Policy; that its storage is its own (wxv.*) and never reads or writes Weather's
// (wx.*); and that it is drawn in the Retro look: Futura, flat cream (walnut) cards, a mustard thumb, an
// orange main button, a flat disc and atomic shapes for the sky instead of a gradient, with text that reads
// on every colour it lands on.
// Screenshots go to the folder given as the second argument (default: none).
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node weathervintage/scripts/app-test.mjs [repo root] [screenshot dir]
// It works at any time of day, on any day: TEST_NOW=<an ISO time> pretends it is another moment.
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
const SHOTS = process.argv[3] || '';
// TEST_NOW=2026-10-31T03:30:00Z sets the page's clock (and the made-up forecast's) to another moment, to see it by night or on another day
const NOW = process.env.TEST_NOW ? Date.parse(process.env.TEST_NOW) : 0;

// ---- a static server for the repo ----
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
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
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n  ', e.message.split('\n').slice(0, 6).join('\n   ')); } };
const text = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
const texts = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));

// ---- colours: Chromium gives rgb(...) or color(srgb ...) (for a colour mixed in CSS), both read here ----
const parse = c => {
  let m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/.exec(c);
  if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
  m = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/.exec(c);
  if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] == null ? 1 : +m[4]];
  throw new Error('cannot read the colour ' + c);
};
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => { const x = lum(parse(a)), y = lum(parse(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgb = (r, g, b) => `rgb(${r}, ${g}, ${b})`;

const DISC = scheme => ({ sun: rgb(227, 167, 47), night: scheme === 'light' ? rgb(251, 245, 233) : rgb(233, 221, 196), cloud: rgb(143, 207, 199), rain: rgb(111, 189, 180), storm: rgb(232, 128, 90), snow: rgb(168, 211, 202), fog: rgb(185, 196, 106), wind: rgb(163, 176, 74), alert: rgb(238, 138, 104) });
const SKY_GROUPS = ['sun', 'night', 'cloud', 'rain', 'storm', 'snow', 'fog', 'wind', 'alert'];
const newPage = async (scheme, { weather = {}, geo = true, seed, route } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, serviceWorkers: 'block',
    geolocation: geo ? { latitude: PLACE.lat, longitude: PLACE.lon } : undefined, permissions: geo ? ['geolocation'] : [] });
  await ctx.addInitScript(() => localStorage.setItem('aos.seen', JSON.stringify({ weathervintage: '999' })));   // no aOS walkthrough over the page
  if (seed) await ctx.addInitScript(seed);
  const calls = await installWeather(ctx, Object.assign({ now: NOW }, weather));
  if (route) await route(ctx);
  const page = await ctx.newPage();
  if (NOW) { await page.clock.install({ time: new Date(NOW) }); await page.clock.resume(); }   // TEST_NOW: see the top
  const problems = [], requests = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404/.test(m.text())) problems.push(m.text()); });   // welcome.js asks ../aOS/api/state, which this static server doesn't have
  page.on('pageerror', e => problems.push(String(e)));
  page.on('request', r => requests.push({ url: r.url(), headers: r.headers() }));
  return { ctx, page, problems, requests, calls };
};
const ready = page => page.waitForSelector('#hxTray .hx-col', { timeout: 10000 });

for (const scheme of ['light', 'dark']) {
  const { ctx, page, problems, requests, calls } = await newPage(scheme);
  await page.goto(BASE + '/weathervintage/');
  await ready(page);
  const q = (sel, props, pseudo) => page.$eval(sel, (e, [props, pseudo]) => { const c = getComputedStyle(e, pseudo || null); return props.map(p => c[p]); }, [props, pseudo]);

  await step(scheme + ': opens to where you are, with the hourly row and the 7 days', async () => {
    assert.equal(await text(page, '#hero .w3-place'), 'Raleigh');
    assert.match(await text(page, '#hero .w3-temp'), /^-?\d+°$/);
    assert.equal(await text(page, '#hours .hx-title'), 'Hourly');
    assert.ok((await texts(page, '#hero .w3-chip')).length >= 2, 'humidity, wind and the rain chip');
    assert.ok((await page.$$('#hxTray .hx-col')).length >= 24, 'a day of hours');
    const days = await page.$$('#days .dc'); assert.ok(days.length >= 6 && days.length <= 7, 'the week: ' + days.length);
    assert.equal(await text(page, '#days .w3-dhead'), '7-day forecast');
    assert.match(await text(page, '#foot'), /NWS/);
    assert.equal(calls.points > 0 && calls.forecast > 0 && calls.hourly > 0, true, 'the NWS forecast was asked for');
    assert.equal(await page.$('#dots .dot'), null, 'one place: no page dots');
  });

  await step(scheme + ': drawn in the Retro look: Futura, flat cream or walnut, mustard, orange, a flat sky', async () => {
    const cream = scheme === 'light' ? rgb(251, 245, 233) : rgb(50, 42, 37);
    assert.match((await q('body', ['fontFamily']))[0], /Futura/);
    const group = await page.evaluate(() => document.documentElement.dataset.c);
    assert.ok(SKY_GROUPS.includes(group), 'the sky has a colour group: ' + group);
    assert.equal((await q('body', ['backgroundColor']))[0], 'rgba(0, 0, 0, 0)', 'the ground is <html>\'s, so it fills the bounce too');
    assert.notEqual((await q('html', ['backgroundColor']))[0], 'rgba(0, 0, 0, 0)');
    for (const sel of ['#hours', '#days']) {
      const [bg, shadow, backdrop, radius] = await q(sel, ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
      assert.equal(bg, cream, sel); assert.equal(shadow, 'none'); assert.ok(backdrop === 'none' || backdrop === '', backdrop); assert.equal(radius, '20px');
    }
    assert.equal((await q('#hero .w3-chip', ['backgroundColor', 'borderRadius']))[0], cream, 'flat chips');
    assert.equal((await q('#vsw .slthumb', ['backgroundColor']))[0], rgb(227, 167, 47), 'a mustard thumb');
    // the sky: a flat disc in the weather's colour (never a gradient), with a teal dot and an orange pill
    const [bgc, bgi, radius, w] = await q('.w3-sky', ['backgroundColor', 'backgroundImage', 'borderRadius', 'width']);
    assert.equal(bgi, 'none'); assert.equal(radius, '50%'); assert.equal(w, '236px');
    assert.equal(bgc, DISC(scheme)[group], 'the disc for ' + group);
    assert.equal((await q('#sky', ['backgroundColor'], '::before'))[0], rgb(216, 87, 42), 'a burnt-orange pill');
    assert.equal((await q('#sky', ['backgroundColor'], '::after'))[0], scheme === 'light' ? rgb(31, 111, 107) : rgb(79, 179, 171), 'a teal dot');
    assert.equal((await q('#hero .w3-temp', ['fontWeight']))[0], '500');
    const [content, image] = await q('#hero .w3-temp', ['content', 'backgroundImage'], '::before');
    assert.ok(content !== 'none' && /svg/.test(image), 'the three little bars under the place name');
    assert.equal((await q('#days .dc-bar', ['boxShadow']))[0], 'none', 'no glow');
    assert.equal(await page.$eval('.hx-col .hx-ico svg', e => e.style.filter), '', 'no glow on the icons');
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), null);
  });

  await step(scheme + ': the words read on every colour they land on', async () => {
    const color = (sel, i = 0) => page.$$eval(sel, (els, i) => getComputedStyle(els[i]).color, i);
    const ground = (await q('html', ['backgroundColor']))[0], disc = (await q('.w3-sky', ['backgroundColor']))[0];
    const card = (await q('#hours', ['backgroundColor']))[0];
    const need = (a, b, min, what) => { const c = contrast(a, b); assert.ok(c >= min, `${what}: ${c.toFixed(2)} is under ${min}`); };
    need(await color('#hero .w3-place'), ground, 4.5, 'the place name on the ground');
    need(await color('#hero .w3-temp'), ground, 4.5, 'the temperature on the ground');
    need(await color('#hero .w3-side'), disc, 4.5, 'the condition on the disc');
    need(await color('#foot button'), ground, 4.5, 'the footer on the ground');
    need(await color('.hx-time'), card, 4.5, 'the hours on their card');
    need(await color('.dc-n'), card, 4.5, 'the days on their card');
    need(await color('.hx-temp'), card, 4.5, 'the temperatures on their card');
    need(await color('#hero .w3-chip'), (await q('#hero .w3-chip', ['backgroundColor']))[0], 4.5, 'a chip');
    // the disc sits behind the whole right-hand column of the hero, so that column is always on it
    const fits = await page.evaluate(() => {
      const d = document.querySelector('.w3-sky').getBoundingClientRect(), s = document.querySelector('.w3-side').getBoundingClientRect();
      const cx = d.x + d.width / 2, cy = d.y + d.height / 2, r = d.width / 2;
      return [[s.left, s.top], [s.right, s.top], [s.left, s.bottom], [s.right, s.bottom]].every(([x, y]) => Math.hypot(x - cx, y - cy) <= r);
    });
    assert.ok(fits, 'the condition column is inside the disc');
  });
  await step(scheme + ': every kind of weather: ink reads on its disc, and the text and footer read on its ground', async () => {
    const got = await page.evaluate(groups => groups.map(g => {
      const d = document.createElement('div'); d.dataset.c = g; d.style.background = 'var(--ground)'; d.style.color = 'var(--text)';
      const m = document.createElement('div'); m.style.color = 'var(--muted)';
      const p = document.createElement('div'); p.style.background = 'var(--disc)'; p.style.color = 'var(--wv-disc-ink)';
      d.append(m, p); document.body.append(d);
      const r = { g, ground: getComputedStyle(d).backgroundColor, text: getComputedStyle(d).color, muted: getComputedStyle(m).color, disc: getComputedStyle(p).backgroundColor, ink: getComputedStyle(p).color };
      d.remove(); return r;
    }), SKY_GROUPS);
    for (const r of got) {
      assert.ok(contrast(r.ink, r.disc) >= 4.5, `${r.g}: ink on its disc ${contrast(r.ink, r.disc).toFixed(2)}`);
      assert.ok(contrast(r.text, r.ground) >= 4.5, `${r.g}: text on its ground ${contrast(r.text, r.ground).toFixed(2)}`);
      assert.ok(contrast(r.muted, r.ground) >= 4.5, `${r.g}: muted text on its ground ${contrast(r.muted, r.ground).toFixed(2)}`);
      assert.ok(contrast(r.disc, r.ground) >= 1.15, `${r.g}: the disc shows against its ground ${contrast(r.disc, r.ground).toFixed(2)}`);
      assert.equal(r.disc, DISC(scheme)[r.g]);
    }
  });
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'main-' + scheme + '.png') });

  await step(scheme + ': the five views of the timeline', async () => {
    await page.click('#vsw [data-view="feels"]');
    assert.equal(await text(page, '#hours .hx-title'), 'Feels like');
    assert.equal(await page.getAttribute('#vsw [data-view="feels"]', 'aria-pressed'), 'true');
    await page.click('#vsw [data-view="humidity"]');
    assert.equal(await text(page, '#hours .hx-title'), 'Humidity');
    assert.ok((await texts(page, '#hxTray .hx-lbl')).some(t => /^(Dry|Comfy|Humid|Muggy)$/.test(t)));
    assert.equal((await q('#hxTray .hx-bar', ['backgroundColor']))[0], scheme === 'light' ? rgb(31, 111, 107) : rgb(79, 179, 171), 'flat teal bars');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'humidity-' + scheme + '.png') });
    await page.click('#vsw [data-view="wind"]');
    assert.match(await text(page, '#hours .hx-title'), /^Wind\s*mph$/);
    assert.ok((await texts(page, '#hxTray .hx-lbl')).some(t => /^(N|NE|E|SE|S|SW|W|NW)$/.test(t)));
    await page.click('#vsw [data-view="now"]');
    assert.equal(await text(page, '#hours .hx-title'), 'Hourly');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('wxv.view'))), 'now');
  });

  await step(scheme + ': tap an hour: a sheet with its weather, stepping through the hours', async () => {
    await page.locator('#hxTray .hx-col[data-hour]').nth(2).click();   // the third hour (a sunrise or sunset column between them has no hour to tap, so :nth-child would miss at some times of day)
    await page.waitForSelector('#hourWrap.open .hd-hero');
    const t0 = await text(page, '#hourTitle');
    assert.match(await text(page, '#hourBody .hd-temp'), /^-?\d+°$/);
    assert.ok((await page.$$('#hourBody .hd-tile')).length >= 4, 'feels like, humidity, wind, rain');
    const [bg, shadow] = await q('#hourBody .hd-hero', ['backgroundColor', 'boxShadow']);
    assert.equal(shadow, 'none'); assert.ok(Object.values(DISC(scheme)).includes(bg), 'a flat disc colour, as the sky has: ' + bg);
    assert.equal(await page.$eval('#hourBody .hd-hero', e => getComputedStyle(e).backgroundImage), 'none');
    assert.equal((await q('#hourWrap .sheet', ['backgroundColor']))[0], scheme === 'light' ? rgb(251, 245, 233) : rgb(50, 42, 37));
    assert.equal((await q('#hourWrap .sheet', ['borderRadius']))[0], '28px');
    assert.ok(contrast((await q('#hourBody .hd-hero', ['color']))[0], bg) >= 4.5, 'the hour on its colour');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'hour-' + scheme + '.png') });
    await page.click('#hourWrap [data-hstep="1"]');
    assert.notEqual(await text(page, '#hourTitle'), t0);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('hourWrap').classList.contains('open'));
  });

  await step(scheme + ': tap a day: the day drawn hour by hour, with its written forecast', async () => {
    await page.click('#days .dc[data-day="1"]');
    await page.waitForSelector('#dayWrap.open .dd-chart');
    assert.ok((await page.$$('#dayBody .dd-chart path')).length >= 2, 'the temperature line and its area');
    assert.match(await text(page, '#dayBody .dd-key'), /Temperature/);
    assert.match(await text(page, '#dayBody .hd-tile.full:last-child'), /Forecast.*National Weather Service/);
    assert.equal((await q('#dayBody .dd-chart .dd-pt', ['fill']))[0], scheme === 'light' ? rgb(43, 37, 34) : rgb(244, 236, 221), 'the high and low are marked in ink');
    assert.equal(await page.$eval('#dayBody .dd-chart path[stroke^="url"]', e => getComputedStyle(e).strokeWidth), '3.5px');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'day-' + scheme + '.png') });
    const t0 = await text(page, '#dayTitle');
    await page.click('#dayWrap [data-dstep="1"]');
    assert.notEqual(await text(page, '#dayTitle'), t0);
    await page.click('#dayWrap .hnav [data-close]');
    await page.waitForFunction(() => !document.getElementById('dayWrap').classList.contains('open'));
  });

  await step(scheme + ': radar: the map keeps its tiles, the controls are Retro', async () => {
    await page.click('#vsw [data-view="radar"]');
    await page.waitForSelector('#rd .rd-bar');
    assert.equal(await text(page, '#hours .hx-title'), 'Radar');
    await page.waitForFunction(() => document.querySelectorAll('#rd .rd-t').length > 0);
    assert.ok(calls.baseTiles > 0 && calls.radarTiles > 0, 'the map and radar tiles were asked for');
    const cream = scheme === 'light' ? rgb(251, 245, 233) : rgb(50, 42, 37);
    assert.equal((await q('#rd', ['backgroundColor']))[0], rgb(16, 19, 26), 'the map stays dark');
    assert.equal((await q('#rd .rd-bar', ['backgroundColor']))[0], cream);
    assert.equal((await q('#rd .rd-zoom button', ['backgroundColor']))[0], cream);
    assert.equal((await q('#rd .rd-dot', ['backgroundColor']))[0], rgb(216, 87, 42), 'the place is an orange dot');
    assert.equal((await q('#rd .rd-bar', ['backdropFilter']))[0], 'none');
    assert.ok(contrast((await q('#rd .rd-time', ['color']))[0], cream) >= 4.5);
    await page.click('#rd .rd-play');
    assert.equal(await text(page, '#rd .rd-play'), '❚❚');
    await page.click('#rd .rd-play');
    assert.equal(await text(page, '#rd .rd-play'), '▶');
    await page.click('#rd [data-rz="1"]'); await page.click('#rd [data-rz="-1"]');
    assert.ok(await page.$('#rd .rd-bar'), 'zooming redraws the map');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'radar-' + scheme + '.png'), fullPage: true });
    await page.click('#vsw [data-view="now"]');
  });

  await step(scheme + ': Places: search, add a city, units, page dots; and its own storage', async () => {
    await page.click('#hero .w3-place');
    await page.waitForSelector('#sheetWrap.open #placesList .prow');
    assert.equal((await texts(page, '#placesList .prow b'))[0], 'My Location');
    assert.equal((await q('#units .slthumb', ['backgroundColor']))[0], rgb(227, 167, 47), 'a mustard thumb under the units');
    await page.fill('#q', 'Colum');
    await page.waitForSelector('#results button[data-pick]');
    assert.equal((await texts(page, '#results button')).length, 2);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'places-' + scheme + '.png') });
    await page.click('#results button[data-pick="0"]');
    await page.waitForSelector('#dots .dot', { timeout: 8000 });
    assert.equal((await page.$$('#dots .dot')).length, 2, 'My Location and the new city');
    assert.equal(await text(page, '#hero .w3-place'), 'Columville', 'the new city is on screen');
    const places = await page.evaluate(() => JSON.parse(localStorage.getItem('wxv.places')));
    assert.equal(places.length, 1); assert.equal(places[0].name, 'Columville');
    assert.equal((await q('#dots .dot.on i', ['backgroundColor']))[0], rgb(216, 87, 42), 'the current dot is an orange pill');
    await page.click('#hero .w3-place');
    await page.click('#units [data-u="metric"]');
    await page.waitForFunction(() => +document.querySelector('#hero .w3-temp').textContent.replace('°', '') < 40);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('wxv.units'))), 'metric');
    await page.keyboard.press('Escape');
    // storage: Weather Vintage's keys are wxv.*; the only wx.* key is the NWS grid cache (data.js, the same file as Weather's)
    const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => /^wxv?\./.test(k)));
    assert.deepEqual(keys.filter(k => k.startsWith('wx.')), ['wx.pts']);
    assert.ok(['wxv.places', 'wxv.here', 'wxv.cache', 'wxv.units', 'wxv.view'].every(k => keys.includes(k)), keys.join());
  });

  await step(scheme + ': it opens to where you are again, with its settings kept', async () => {
    await page.reload();
    await ready(page);
    assert.equal(await text(page, '#hero .w3-place'), 'Raleigh');
    assert.ok(+(await text(page, '#hero .w3-temp')).replace('°', '') < 40, 'still metric');
    assert.equal((await page.$$('#dots .dot')).length, 2);
  });

  await step(scheme + ': no script errors, nothing blocked by the Content Security Policy', async () => {
    assert.deepEqual(problems, []);
    assert.ok(requests.every(r => !/\/weathervintage\/api\//.test(r.url)), 'it never calls an api of its own: it has none');
  });
  await ctx.close();
}

for (const scheme of ['light', 'dark']) {
  // alerts, and an alert above the hero: the disc moves down with the hero
  const { ctx, page, problems } = await newPage(scheme, { weather: { cond: 'ovc', alerts: true } });
  await page.goto(BASE + '/weathervintage/');
  await ready(page);
  await step(scheme + ': alerts: most severe first, in Retro colours, and the sky stays behind the hero', async () => {
    assert.deepEqual(await texts(page, '#alerts .alert b'), ['Flood Watch', 'Wind Advisory']);
    assert.equal(await page.getAttribute('#alerts .alert > button', 'aria-expanded'), 'false');
    await page.click('#alerts .alert > button');
    assert.match(await text(page, '#alerts .alert.open .body'), /Heavy rain may cause flooding/);
    assert.equal(await page.$eval('#alerts .alert .dot', e => getComputedStyle(e).color), scheme === 'light' ? rgb(184, 69, 43) : rgb(232, 104, 74), 'severe is burnt orange');
    assert.equal(await page.$eval('#alerts .alert', e => getComputedStyle(e).backgroundColor), scheme === 'light' ? rgb(251, 245, 233) : rgb(50, 42, 37));
    const fits = await page.evaluate(() => {
      const d = document.querySelector('.w3-sky').getBoundingClientRect(), s = document.querySelector('.w3-side').getBoundingClientRect();
      const cx = d.x + d.width / 2, cy = d.y + d.height / 2, r = d.width / 2;
      return { top: s.top, ok: [[s.left, s.top], [s.right, s.top], [s.left, s.bottom], [s.right, s.bottom]].every(([x, y]) => Math.hypot(x - cx, y - cy) <= r) };
    });
    assert.ok(fits.top > 150 && fits.ok, 'the hero is below the alerts, and the disc is behind it: ' + JSON.stringify(fits));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'alerts-' + scheme + '.png') });
  });
  assert.deepEqual(problems, []);
  await ctx.close();
}

for (const scheme of ['light', 'dark']) {
  // no location and no saved place: the welcome message, with its buttons
  const { ctx, page, problems } = await newPage(scheme, { geo: false });
  await page.goto(BASE + '/weathervintage/');
  await page.waitForSelector('.msg .pill.primary');
  await step(scheme + ': the welcome: a cream card, a solid orange button and an outlined teal one', async () => {
    assert.equal(await text(page, '.msg b'), 'Weather');
    const cs = sel => page.$eval(sel, e => { const c = getComputedStyle(e); return { bg: c.backgroundColor, color: c.color, shadow: c.boxShadow, radius: c.borderRadius }; });
    const main = await cs('.pill.primary'), other = await cs('.pill:not(.primary)'), msg = await cs('.msg');
    assert.equal(main.bg, rgb(194, 76, 40), 'burnt orange, a shade deeper than the shapes so cream words read on it'); assert.equal(main.shadow, 'none');
    assert.ok(contrast(main.color, main.bg) >= 4.5, 'the main button reads');
    assert.equal(other.bg, 'rgba(0, 0, 0, 0)'); assert.match(other.shadow, /inset/);
    assert.equal(msg.bg, scheme === 'light' ? rgb(251, 245, 233) : rgb(50, 42, 37)); assert.equal(msg.radius, '20px');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.c), undefined, 'no sky on the welcome');
    assert.equal(await page.$eval('html', e => getComputedStyle(e).backgroundColor), scheme === 'light' ? rgb(244, 236, 221) : rgb(36, 30, 26), 'the cream (walnut) ground');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'welcome-' + scheme + '.png') });
  });
  assert.deepEqual(problems, []);
  await ctx.close();
}

{
  // the radar's forecast frames come through Weather's own helper (IEM won't let another site read the model run's time)
  const hrrr = [];
  const { ctx, page, problems, requests, calls } = await newPage('light', { weather: { directHrrr: false },
    route: ctx => ctx.route('**/weather/api/hrrr', route => { hrrr.push(route.request().headers()); return route.fulfill({ json: { model_init_utc: new Date(Math.floor((NOW || Date.now()) / 3600e3) * 3600e3).toISOString().slice(0, 16).replace(/[-T:]/g, '') } }); }) });
  await page.goto(BASE + '/weathervintage/');
  await ready(page);
  await step('radar: the forecast frames come from Weather\'s helper, /weather/api/hrrr', async () => {
    await page.click('#vsw [data-view="radar"]');
    await page.waitForFunction(() => document.querySelectorAll('#rd .rd-fr.ahead').length > 0, null, { timeout: 8000 });
    assert.equal(hrrr.length, 1, 'one request to the helper');
    assert.equal(hrrr[0]['x-weather'], '1', 'with the header it asks for');
    assert.ok(requests.some(r => new URL(r.url).pathname === '/weather/api/hrrr'));
    assert.ok(requests.every(r => !/\/weathervintage\/api\//.test(r.url)), 'nothing asked of an api folder of its own');
    assert.ok(+(await page.$eval('#rdScrub', e => e.max)) > 4, 'the scrubber spans Now and the hours ahead');
    await page.waitForFunction(() => document.querySelector('#rd .rd-fr.ahead .rd-t'));
    assert.ok(calls.forecastTiles > 0, 'forecast tiles were asked for');
    assert.equal(await page.$('#rd .rd-note'), null, 'no "forecast isn\'t available" note');
  });
  assert.deepEqual(problems, []);
  await ctx.close();
}

{
  // Weather's own storage is never read: its saved city and units don't show up here
  const { ctx, page, problems } = await newPage('light', { seed: () => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('wx.places', JSON.stringify([{ lat: 41.88, lon: -87.63, name: 'Chicago', sub: 'Illinois, United States' }]));
    localStorage.setItem('wx.units', JSON.stringify('metric'));
    localStorage.setItem('wx.here', JSON.stringify({ lat: 48.85, lon: 2.35, name: 'Paris' }));
  } });
  await page.goto(BASE + '/weathervintage/');
  await ready(page);
  await step('storage: Weather\'s saved cities, units and last place are not read, or changed', async () => {
    assert.equal(await text(page, '#hero .w3-place'), 'Raleigh');
    assert.ok(+(await text(page, '#hero .w3-temp')).replace('°', '') > 40, 'degrees F: Weather\'s metric setting is not used');
    assert.equal(await page.$('#dots .dot'), null, 'Weather\'s Chicago is not a place here');
    await page.click('#hero .w3-place');
    assert.deepEqual(await texts(page, '#placesList .prow b'), ['My Location']);
    await page.keyboard.press('Escape');
    const base = await page.evaluate(() => ({ places: localStorage.getItem('wx.places'), units: localStorage.getItem('wx.units'), here: localStorage.getItem('wx.here') }));
    assert.equal(JSON.parse(base.places)[0].name, 'Chicago'); assert.equal(JSON.parse(base.units), 'metric'); assert.equal(JSON.parse(base.here).name, 'Paris');
  });
  assert.deepEqual(problems, []);
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
