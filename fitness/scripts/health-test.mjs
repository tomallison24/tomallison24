// Drives Fitness's Health page in headless Chromium at iPhone size, with a
// stand-in for ../fitness/api/health (functions/fitness/api): your own Apple
// Health readings, a day at a time, in Activity, Heart, Sleep and Vitals cards,
// with only the readings there are; moving between days; Health Steps becoming
// the day's steps (a number typed in still wins); the Health tiles in Analysis;
// the days kept and synced to the family's Google Sheet (the real
// google-sheet-sync.gs on fake-sheet.mjs: its Health tab, with Who); private
// when signed out; what to do when nothing has come in yet; and no sideways
// scrolling at 320 px, in both designs, light and dark. Dates are relative to
// today, so it works on any day.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node fitness/scripts/health-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fakeSheet } from './fake-sheet.mjs';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
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

const TZ = 'America/New_York';
process.env.TZ = TZ;
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const TODAY = ymd(day(0)), YESTERDAY = ymd(day(-1)), D3 = ymd(day(-3)), D9 = ymd(day(-9));
const SECRET = 'test-secret-phrase';
const SESSION = { token: 'made.up', user: { id: 'u1', name: 'Test', role: 'owner' }, at: 1 };

// What the server sends: today and the 7 days before, each with what Apple Health had. No blood
// oxygen (unavailable on this phone), so no row for it; three days ago, nothing at all.
const DAYS = {};
for (let i = 0; i <= 8; i++) {
  if (i === 3) continue;
  DAYS[ymd(day(-i))] = { steps: 8000 + i * 100, active_kcal: 500 + i * 10, rest_kcal: 1700, dist_mi: 3.42, hr: 64, hr_rest: 50 + i, hrv: 40 + i, sleep: 385 + i, deep: 60, rem: 92, core: 210, vo2: 41.2 };
}
const ENTITIES = Object.fromEntries(Object.keys(DAYS[TODAY]).map(k => [k, 'sensor.test_iphone_' + k]));

const browser = await chromium.launch();
const errors = [];
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); };

async function phone({ seed = null, session = SESSION, health = { entities: ENTITIES, units: {}, days: DAYS }, sheet = null, design = 'glass', viewport = { width: 390, height: 844 }, scheme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: TZ, locale: 'en-US', colorScheme: scheme });
  const calls = [];
  await ctx.route('**/aOS/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().endsWith('/state') ? { storage: true, setup: true } : { ok: true }) }));
  await ctx.route('**/drinks/api/**', r => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/calendar/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/fitness/api/**', r => {
    const u = r.request().url(), h = r.request().headers();
    calls.push({ url: u, auth: h.authorization, x: h['x-fitness'] });
    const json = (b, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.includes('/health')) return health ? json(health) : json({ error: 'not-linked' }, 404);
    if (u.includes('/steps')) return health ? json({ entity: 'sensor.test_iphone_health_steps', points: [] }) : json({ error: 'not-linked' }, 404);
    return json({ linked: null, list: true, phones: [], links: [] });
  });
  await ctx.route('**/sheet/api/**', r => {
    const json = (b, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (!sheet) return json({ ok: false, error: 'no-sheet' }, 409);
    if (r.request().method() === 'GET') return json({ configured: true });
    return json(sheet.post(r.request().postData(), { key: SECRET, who: 'u1', name: 'Test', owner: '1' }));
  });
  await ctx.addInitScript(({ seed, session, design }) => {
    if (location.protocol !== 'http:' || window.name.includes('seeded')) return;
    window.name += ' seeded';
    localStorage.setItem('aos.seen', JSON.stringify({ fitness: '999', aos: '999' }));
    localStorage.setItem('aos.sky', 'day');
    localStorage.setItem('design.fitness', design);
    localStorage.setItem('allison-fitness-v1-view', 'health');
    if (session) localStorage.setItem('aos.session', JSON.stringify(session));
    if (seed) localStorage.setItem('allison-fitness-v1', JSON.stringify(seed));
  }, { seed, session, design });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  return { ctx, page, calls };
}
const open = async page => { await page.goto(BASE + '/fitness/'); await page.waitForFunction(() => window.__fitness); await page.waitForTimeout(300); };
const data = page => page.evaluate(() => JSON.parse(JSON.stringify(__fitness.data)));
const text = page => page.textContent('#main');
const loaded = page => page.waitForFunction(d => __fitness.data.health.some(x => x.date === d), TODAY, { timeout: 8000 });

await test('signed out: Health asks you to sign in, shows nothing of yours and asks Home Assistant for nothing', async () => {
  const seed = { v: 2, logs: [], exercises: [], meds: [], doses: [], steps: [], health: [{ id: TODAY, date: TODAY, m: { sleep: 385, hr_rest: 52 }, updated: 1 }] };
  const { ctx, page, calls } = await phone({ seed, session: null });
  await open(page); await page.waitForTimeout(1500);
  assert.equal(await page.textContent('#viewName'), 'Health');
  assert.ok(await page.isVisible('#hSignin'));
  assert.match(await text(page), /Sign in to see your Health/);
  assert.ok(!/6 h 25 m|52/.test(await text(page)), 'none of your readings');
  assert.ok(!calls.some(c => c.url.includes('/fitness/api/')), 'no requests without a session');
  await page.click('#viewBtn');
  assert.match(await page.textContent('#viewMenu'), /Health\s*Activity, heart, sleep and vitals from Apple Health/);
  await ctx.close();
});

await test('your readings in Activity, Heart, Sleep and Vitals cards; empty ones hidden; a day at a time', async () => {
  const seed = { v: 2, logs: [], exercises: [], meds: [], doses: [], steps: [{ id: YESTERDAY, date: YESTERDAY, n: 12345, src: 'you', updated: 1 }] };
  const { ctx, page, calls } = await phone({ seed, design: 'vintage' });
  await open(page); await loaded(page);
  const h = calls.find(c => c.url.includes('/fitness/api/health'));
  assert.equal(h.auth, 'Bearer made.up'); assert.equal(h.x, '1');
  assert.match(h.url, /days=10/, 'the last 10 days, the first time');
  await page.waitForSelector('.hcard');
  assert.deepEqual(await page.$$eval('#main .hlist > .sechead', els => els.map(e => e.textContent.trim())), ['Activity', 'Heart', 'Sleep', 'Vitals']);
  assert.deepEqual(await page.$$eval('.hcard[data-cat="sleep"] .hrow', els => els.map(e => e.dataset.k)), ['sleep', 'core', 'deep', 'rem'], 'in health.js\'s order; In Bed and Awake hidden (no readings)');
  assert.equal(await page.$('.hrow[data-k="spo2"]'), null, 'blood oxygen: unavailable, so not shown');
  assert.equal(await page.$('.hrow[data-k="temp"]'), null);
  assert.match(await page.textContent('.hrow[data-k="sleep"] .hv'), /^6 h 25 m$/);
  assert.match(await page.textContent('.hrow[data-k="steps"] .hv'), /^8,000\s*steps$/);
  assert.match(await page.textContent('.hrow[data-k="dist_mi"] .hv'), /^3\.42\s*mi$/);
  assert.match(await page.textContent('.hrow[data-k="vo2"] .hv'), /41\.2/);
  // the 7 days before, as a line and an average
  assert.ok(await page.$('.hrow[data-k="hr_rest"] .spark polyline'));
  assert.match(await page.textContent('.hrow[data-k="hr_rest"] .ht small'), /7-day avg 54 · ↓8%/);
  assert.equal(await page.$('#main .hint'), null, 'nothing under the stats');
  assert.match(await page.getAttribute('.hrow[data-k="hr_rest"]', 'aria-label'), /Resting heart rate: 50 bpm, 7-day average 54 bpm/);
  assert.match(await text(page), /Today ·/);
  assert.ok(await page.isDisabled('[data-hday="1"]'), 'no days ahead');
  await shot(page, 'health-today-vintage');
  // a day back: yesterday's
  await page.click('[data-hday="-1"]');
  assert.match(await text(page), /Yesterday ·/);
  assert.match(await page.textContent('.hrow[data-k="steps"] .hv'), /8,100/);
  assert.match(await page.textContent('.hrow[data-k="sleep"] .hv'), /6 h 26 m/);
  // three days ago: nothing came in
  await page.click('[data-hday="-1"]'); await page.click('[data-hday="-1"]');
  assert.equal(await page.evaluate(() => __fitness.st.healthDay), D3);
  assert.match(await text(page), /Nothing from Apple Health on this day/);
  assert.equal(await page.$('.hcard'), null);
  await page.click('#todayBtn');
  assert.match(await text(page), /Today ·/);
  // Health Steps: the day's steps, as your iPhone's; a number you typed in still wins
  const d = await data(page);
  assert.deepEqual([d.steps.find(x => x.date === TODAY).n, d.steps.find(x => x.date === TODAY).src], [8000, 'ha']);
  assert.deepEqual([d.steps.find(x => x.date === YESTERDAY).n, d.steps.find(x => x.date === YESTERDAY).src], [12345, 'you']);
  // kept a row a day, with health.js's keys
  const row = d.health.find(x => x.date === TODAY);
  assert.deepEqual([row.id, row.m.sleep, row.m.hr_rest, row.m.spo2], [TODAY, 385, 50, undefined]);
  assert.ok(row.updated > 1);
  assert.equal(d.health.length, 8);
  // the view picker says how you slept
  await page.click('#viewBtn');
  assert.match(await page.textContent('[data-view="health"]'), /Slept 6 h 25 m · resting 50 bpm/);
  await page.click('[data-view="analysis"]');
  // Analysis: a few Health tiles over the window, against the one before
  await page.waitForSelector('#anHealth');
  const tiles = await page.$$eval('#anHealth .kpi .kl', els => els.map(e => e.textContent));
  assert.deepEqual(tiles, ['Asleep a night', 'Resting HR (bpm)', 'HRV (ms)', 'Active energy (kcal)']);
  assert.match(await page.textContent('#anHealth'), /6 h 2\d m/);
  await shot(page, 'health-analysis');
  // a later fetch: only the days since (2 at least), and the newer value wins
  const before = calls.filter(c => c.url.includes('/fitness/api/health')).length;
  await page.evaluate(() => __fitness.loadHealth(true));
  const later = calls.filter(c => c.url.includes('/fitness/api/health'));
  assert.ok(later.length > before && /days=2/.test(later[later.length - 1].url));
  await page.evaluate(d => __fitness.takeHealth({ [d]: { sleep: 401, nonsense: 5, hr: 'unavailable' } }), TODAY);
  assert.deepEqual(await page.evaluate(d => { const x = __fitness.data.health.find(y => y.date === d); return [x.m.sleep, x.m.nonsense, x.m.hr]; }, TODAY), [401, undefined, 64]);
  assert.equal((await page.evaluate(([a, b]) => __fitness.healthDays(a, b), [D9, TODAY])).length, 8);
  await ctx.close();
});

await test('nothing yet: one short line on what to do (link your iPhone, or turn on its Health sensors)', async () => {
  const { ctx, page } = await phone({ health: null });
  await open(page); await page.waitForTimeout(1600);
  assert.equal(await page.textContent('#hEmpty'), 'Your Apple Health, hereLink your iPhone to start.Link your iPhone');
  assert.equal(await page.$('#main .hint'), null, 'no explanation under it');
  await page.click('[data-hset]');
  await page.waitForSelector('#setSheet:not([hidden])');
  await ctx.close();
  // linked, with no Health sensors on yet
  const p2 = await phone({ health: { entities: {}, units: {}, days: {} } });
  await open(p2.page); await p2.page.waitForTimeout(1600);
  assert.match(await text(p2.page), /Turn on Health sensors in the Home Assistant app\./);
  await p2.ctx.close();
});

await test('the family Sheet keeps each day\'s Health, in its Health tab with Who', async () => {
  const sheet = fakeSheet(undefined, SECRET);
  const { ctx, page } = await phone({ sheet });
  await open(page); await loaded(page);
  let tab = null;
  for (let i = 0; i < 40 && !(tab && tab.length > 1); i++) { await page.waitForTimeout(200); tab = sheet.tab('Health'); }
  assert.ok(tab && tab.length === 9, 'a row a day');
  assert.deepEqual(tab[0].slice(0, 4), ['Who', 'Date', 'Day', 'Steps']);
  const today = tab.find(r => r[1] === TODAY);
  assert.equal(today[0], 'Test');
  assert.equal(today[tab[0].indexOf('Asleep (min)')], 385);
  assert.equal(await page.evaluate(() => localStorage.getItem('allison-fitness-v1-sheet-keeps-health')), '1');
  // what comes back from the Sheet: yours, by the day
  const back = sheet.post({ action: 'sync', graves: {} }, { key: SECRET, who: 'u1', owner: '1' });
  assert.equal(back.health.length, 8);
  assert.ok(back.health.every(x => x.id === x.date && x.m));
  await ctx.close();
});

await test('no sideways scrolling at 320 px, in both designs, light and dark', async () => {
  for (const [design, scheme] of [['vintage', 'light'], ['glass', 'dark'], ['glass', 'light'], ['vintage', 'dark']]) {
    const { ctx, page } = await phone({ design, scheme, viewport: { width: 320, height: 640 } });
    await open(page); await loaded(page); await page.waitForSelector('.hcard');
    const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth, wide: [...document.querySelectorAll('#main *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 0.5).map(e => e.className || e.tagName).slice(0, 5) }));
    assert.ok(w.doc <= w.win, design + '/' + scheme + ': ' + JSON.stringify(w));
    assert.deepEqual(w.wide, [], design + '/' + scheme);
    await shot(page, 'health-320-' + design + '-' + scheme);
    await ctx.close();
  }
});

assert.deepEqual(errors, [], 'no script errors');
await browser.close(); server.close();
console.log('\n' + n + ' tests passed');
