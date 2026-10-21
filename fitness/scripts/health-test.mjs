// Drives Fitness's Health page in headless Chromium at iPhone size, with a
// stand-in for ../fitness/api/health (functions/fitness/api): your own Apple
// Health readings, a day at a time: a tile each for Activity (with the Move and
// Exercise rings), Heart, Sleep (our Sleep score) and Vitals, each with its status
// dot and word; a tile's sheet (7, 30 or 90 days, the charts, tapping a bar or the
// arrow keys to pick a day, sleep stages and the score's parts, trends, closing);
// the Move goal in Settings; moving between days; Health Steps becoming
// the day's steps (a number typed in still wins); the Health tiles in Analysis;
// the days kept and synced to the family's Google Sheet (the real
// google-sheet-sync.gs on fake-sheet.mjs: its Health tab, with Who); private
// when signed out; what to do when nothing has come in yet; the vitals alert (your
// usual sent to the server, the switch in Settings, the alert's ?view=health&day=
// link); and no sideways
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

// What the server sends: today and the 8 days before, each with what Apple Health had. No blood
// oxygen (unavailable on this phone), so no row for it; three days ago, nothing at all; yesterday,
// a blood pressure reading (135/85: stage 1).
const DAYS = {};
for (let i = 0; i <= 8; i++) {
  if (i === 3) continue;
  DAYS[ymd(day(-i))] = { steps: 8000 + i * 100, active_kcal: 500 + i * 10, rest_kcal: 1700, dist_mi: 3.42, exercise_min: 20, hr: 64, hr_rest: 52 + (i % 2), hrv: 45 + (i % 2),
    sleep: 385 + i, in_bed: 400 + i, deep: 60, rem: 92, core: 210, vo2: 41.2, resp: 15, ...(i === 1 ? { bp_sys: 135, bp_dia: 85 } : {}) };
}
const short = d => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
const fmtDay = d => d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === day(0).getFullYear() ? undefined : 'numeric' });
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
    calls.push({ url: u, auth: h.authorization, x: h['x-fitness'], method: r.request().method(), body: r.request().postData() });
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

await test('a tile each for Activity, Heart, Sleep and Vitals, with a status dot and one headline; a day at a time', async () => {
  const seed = { v: 2, logs: [], exercises: [], meds: [], doses: [], steps: [{ id: YESTERDAY, date: YESTERDAY, n: 12345, src: 'you', updated: 1 }] };
  const { ctx, page, calls } = await phone({ seed, design: 'vintage' });
  await open(page); await loaded(page);
  const h = calls.find(c => c.url.includes('/fitness/api/health'));
  assert.equal(h.auth, 'Bearer made.up'); assert.equal(h.x, '1');
  assert.match(h.url, /days=10/, 'the last 10 days, the first time');
  await page.waitForSelector('.htile');
  assert.deepEqual(await page.$$eval('#main .hgrid > .htile', els => els.map(e => e.dataset.hcat)), ['activity', 'heart', 'sleep', 'vitals']);
  assert.equal(await page.$('.hrow, .hcard, .spark'), null, 'no list of readings or sparklines on the page itself');
  const tile = async c => page.evaluate(c => { const t = document.querySelector('.htile[data-hcat="' + c + '"]'); return { s: t.dataset.s, word: t.querySelector('.hstat').textContent, big: t.querySelector('.hbig').textContent, sub: (t.querySelector('.hsub') || {}).textContent || '', label: t.getAttribute('aria-label') }; }, c);
  // Activity: 8,000 steps under the 10,000 goal, 20 min exercise (120 over the week): today isn't over, so "So far", not Check
  const act = await tile('activity');
  assert.deepEqual([act.s, act.word, act.big], ['none', 'So far', '8,000steps']);
  assert.match(act.label, /^Activity, So far\. 8,000 steps, Move 500 of 500 kcal, Exercise 20 of 30 min$/);
  // the rings: Move full (500 of 500), Exercise two thirds
  assert.deepEqual(await page.$$eval('.htile[data-hcat="activity"] .hrings .arc', els => els.map(e => [e.classList[1], e.getAttribute('stroke-dasharray')])), [['mv', '100.0 100'], ['ex', '66.7 100']]);
  // Heart: resting heart rate, within your usual
  const heart = await tile('heart');
  assert.deepEqual([heart.s, heart.word, heart.big, heart.sub], ['good', 'Good', '52bpm', 'Resting']);
  // Sleep: our Sleep score and the time asleep; 6 h 25 m is under 7 h: Check
  const sleep = await tile('sleep');
  assert.deepEqual([sleep.s, sleep.word, sleep.big, sleep.sub], ['watch', 'Check', '90· 6h 25m', 'Sleep score']);
  assert.match(sleep.label, /Sleep score 90, High, 6 h 25 m asleep/);
  assert.ok(!/Apple/.test(sleep.label + sleep.sub), 'never says Apple worked it out');
  // Vitals: VO2 max and breathing within range
  const vit = await tile('vitals');
  assert.deepEqual([vit.s, vit.word, vit.big], ['good', 'Good', 'All usual']);
  assert.equal(await page.$('#main .hint, #main p:not(.sechead)'), null, 'no explanations');
  assert.match(await text(page), /Today ·/);
  assert.ok(await page.isDisabled('[data-hday="1"]'), 'no days ahead');
  await shot(page, 'health-today-vintage');
  // a day back: blood pressure 135/85 (stage 1) counts once
  await page.click('[data-hday="-1"]');
  assert.match(await text(page), /Yesterday ·/);
  const v1 = await tile('vitals');
  assert.deepEqual([v1.s, v1.word, v1.big], ['watch', 'Check', '1 off']);
  assert.match((await tile('activity')).big, /8,100/);
  assert.match((await tile('sleep')).big, /6h 26m/);
  // three days ago: nothing came in
  await page.click('[data-hday="-1"]'); await page.click('[data-hday="-1"]');
  assert.equal(await page.evaluate(() => __fitness.st.healthDay), D3);
  assert.match(await text(page), /Nothing from Apple Health on this day/);
  assert.equal(await page.$('.htile'), null);
  await page.click('#todayBtn');
  assert.match(await text(page), /Today ·/);
  // Health Steps: the day's steps, as your iPhone's; a number you typed in still wins
  const d = await data(page);
  assert.deepEqual([d.steps.find(x => x.date === TODAY).n, d.steps.find(x => x.date === TODAY).src], [8000, 'ha']);
  assert.deepEqual([d.steps.find(x => x.date === YESTERDAY).n, d.steps.find(x => x.date === YESTERDAY).src], [12345, 'you']);
  // kept a row a day, with health.js's keys
  const row = d.health.find(x => x.date === TODAY);
  assert.deepEqual([row.id, row.m.sleep, row.m.hr_rest, row.m.spo2], [TODAY, 385, 52, undefined]);
  assert.ok(row.updated > 1);
  assert.equal(d.health.length, 8);
  // the view picker says how you slept
  await page.click('#viewBtn');
  assert.match(await page.textContent('[data-view="health"]'), /Slept 6 h 25 m · resting 52 bpm/);
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

await test('a tile opens its sheet: 7, 30 or 90 days, each reading charted with its range, tap a bar to pick a day; closes', async () => {
  const { ctx, page } = await phone({ design: 'glass' });
  await open(page); await loaded(page); await page.waitForSelector('.htile');
  // Heart
  await page.click('.htile[data-hcat="heart"]');
  await page.waitForSelector('#hSheet:not([hidden])');
  assert.equal(await page.textContent('#hLbl'), 'Heart');
  assert.deepEqual(await page.$$eval('#hBody [data-hrange]', bs => bs.map(b => [b.textContent, b.getAttribute('aria-pressed')])), [['7 days', 'true'], ['30 days', 'false'], ['90 days', 'false']]);
  assert.deepEqual(await page.$$eval('#hBody .hm', els => els.map(e => e.dataset.k)), ['hr_rest', 'hr', 'hrv'], 'resting heart rate first; only the readings there are');
  assert.equal(await page.textContent('#hBody .hwhen'), 'Today');
  assert.match(await page.textContent('.hm[data-k="hr_rest"] .hmh'), /Resting heart rate\s*Good\s*52bpm/);
  assert.equal(await page.$$eval('.hm[data-k="hr_rest"] .hchart .dot', els => els.length), 6, 'a dot a day with a reading (none three days ago)');
  assert.equal(await page.$$eval('.hm[data-k="hr_rest"] .hchart .band', els => els.length), 1, 'your usual, shaded');
  assert.match(await page.getAttribute('.hm[data-k="hr_rest"] .hchart', 'aria-label'), /^Resting heart rate, the last 7 days, your usual \d+ to \d+ bpm\. Arrow keys pick a day\.$/);
  assert.deepEqual(await page.$$eval('.hm[data-k="hr_rest"] .hax span', els => els.map(e => e.textContent)), [short(day(-6)), short(day(0))]);
  assert.equal(await page.textContent('#hBody .hfoot'), 'Ranges: CDC, AHA, FDA. Not medical advice.');
  assert.equal(await page.$('#hBody .htr'), null, 'no trends when there are none');
  // 30 and 90 days: the dates widen, the choice is kept
  await page.click('[data-hrange="30"]');
  assert.equal(await page.getAttribute('[data-hrange="30"]', 'aria-pressed'), 'true');
  assert.deepEqual(await page.$$eval('.hm[data-k="hr_rest"] .hax span', els => els.map(e => e.textContent)), [short(day(-29)), short(day(0))]);
  await page.click('[data-hrange="90"]');
  assert.equal(await page.textContent('.hm[data-k="hr_rest"] .hax span'), short(day(-89)));
  assert.equal(await page.evaluate(() => localStorage.getItem('allison-fitness-v1-health-range')), '90');
  await page.click('[data-hrange="7"]');
  // close (the button), and with Escape
  await page.click('#hSheet .sheethead [data-close]');
  assert.ok(await page.isHidden('#hSheet'));
  assert.equal(await page.evaluate(() => __fitness.st.hcat), null);
  // Activity: tap a bar to pick that day
  await page.click('.htile[data-hcat="activity"]');
  await page.waitForSelector('#hSheet:not([hidden])');
  assert.deepEqual((await page.$$eval('#hBody .hm', els => els.map(e => e.dataset.k))).slice(0, 3), ['steps', 'active_kcal', 'exercise_min'], 'the rings\' readings first');
  assert.equal(await page.$$eval('.hm[data-k="steps"] .bar', els => els.length), 6);
  assert.equal(await page.$$eval('.hm[data-k="steps"] .goal', els => els.length), 1, 'the step goal, a line');
  assert.match(await page.textContent('.hm[data-k="steps"] .hmh'), /^Steps\s*8,000steps$/, 'today, short of the goal: no dot yet');
  const svg = page.locator('.hm[data-k="steps"] .hchart svg'), box = await svg.boundingBox();
  await svg.click({ position: { x: box.width * 0.5 / 7, y: box.height / 2 } });
  assert.equal(await page.evaluate(() => __fitness.st.hsel), ymd(day(-6)));
  assert.equal(await page.textContent('#hBody .hwhen'), fmtDay(day(-6)));
  assert.match(await page.textContent('.hm[data-k="steps"] .hmv'), /^8,600steps$/);
  assert.match(await page.textContent('.hm[data-k="steps"] .hmh'), /Steps\s*Check\s*8,600steps/, 'a day that\'s over, short of the goal: Check');
  assert.equal(await page.$$eval('.hm[data-k="steps"] .bar.on', els => els.length), 1);
  // every chart shows the day picked
  assert.match(await page.textContent('.hm[data-k="active_kcal"] .hmv'), /^560kcal$/);
  // the arrow keys move it
  await page.focus('.hm[data-k="steps"] .hchart');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => __fitness.st.hsel), ymd(day(-5)));
  assert.equal(await page.evaluate(() => document.activeElement.closest('.hchart') && document.activeElement.dataset.k), 'steps', 'focus stays on the chart');
  // three days ago had nothing: a dash
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  assert.equal(await page.textContent('.hm[data-k="steps"] .hmv'), '—');
  await page.keyboard.press('Escape');
  assert.ok(await page.isHidden('#hSheet'));
  // Sleep: stages stacked under a 7 h line, and the Sleep score's parts
  await page.click('.htile[data-hcat="sleep"]');
  await page.waitForSelector('#hSheet:not([hidden])');
  assert.equal(await page.textContent('#hLbl'), 'Sleep');
  assert.match(await page.textContent('.hm[data-k="sleep"] .hmh'), /Asleep\s*Check\s*6 h 25 m/);
  assert.equal(await page.$$eval('.hm[data-k="sleep"] .stg', els => els.length), 18, 'deep, core and REM for 6 nights');
  assert.equal(await page.$$eval('.hm[data-k="sleep"] .goal', els => els.length), 1);
  assert.deepEqual(await page.$$eval('.hm[data-k="sleep"] .hleg span', els => els.map(e => e.textContent)), ['Deep 1h', 'Core 3h 30m', 'REM 1h 32m', 'Awake']);
  assert.equal(await page.textContent('.hscore .hsh b'), '90');
  assert.match(await page.textContent('.hscore .hsh'), /Sleep score\s*High/);
  assert.deepEqual(await page.$$eval('.hscore .hsr', els => els.map(e => [e.dataset.part, e.querySelector('.hsv').textContent, e.querySelector('.hsp').textContent])),
    [['duration', '6h 25m', '40/50'], ['deep', '16%', '15/15'], ['rem', '24%', '20/20'], ['efficiency', '96%', '15/15']]);
  assert.deepEqual(await page.$$eval('#hBody .hm', els => els.map(e => e.dataset.k)), ['sleep', 'in_bed']);
  await shot(page, 'health-sleep-sheet-glass');
  await page.click('#hSheet .sheethead [data-close]');
  // Settings: a Move goal beside the step goal; the Move ring follows it
  await page.click('#setBtn'); await page.waitForSelector('#setSheet:not([hidden])');
  assert.equal(await page.$eval('#stMove', s => s.value), '500');
  assert.equal(await page.$eval('label[for="stMove"]', l => l.textContent), 'Move goal');
  await page.selectOption('#stMove', '1000');
  assert.equal(await page.evaluate(() => localStorage.getItem('allison-fitness-v1-move-goal')), '1000');
  await page.selectOption('#stGoal', '8000');
  await page.click('#setSheet .sheethead [data-close]');
  assert.equal(await page.getAttribute('.htile[data-hcat="activity"] .arc.mv', 'stroke-dasharray'), '50.0 100');
  assert.match(await page.getAttribute('.htile[data-hcat="activity"]', 'aria-label'), /8,000 steps, Move 500 of 1000 kcal/);
  assert.equal(await page.textContent('.htile[data-hcat="activity"] .hstat'), 'Good', 'steps at the 8,000 goal; the 120 min of exercise this week is not judged till the day is over');
  await ctx.close();
});

await test('trends: where your last 7 days differ from your usual average; and Off in red when far off', async () => {
  // 40 days of a resting heart rate around 60, the last 7 at 55; blood oxygen 88 today
  const health = [];
  for (let i = 0; i < 40; i++) { const d = ymd(day(-i)); health.push({ id: d, date: d, m: { hr_rest: i < 7 ? 55 : 60 + (i % 2), spo2: i ? 97 : 88 }, updated: 1 }); }
  const seed = { v: 2, logs: [], exercises: [], meds: [], doses: [], steps: [], health };
  const { ctx, page } = await phone({ seed, health: null });
  await open(page); await page.waitForSelector('.htile');
  assert.deepEqual(await page.$eval('.htile[data-hcat="vitals"]', t => [t.dataset.s, t.querySelector('.hstat').textContent, t.querySelector('.hbig').textContent]), ['bad', 'Off', '1 off']);
  assert.equal(await page.$eval('.htile[data-hcat="sleep"] .hstat', e => e.textContent), 'No data');
  assert.equal(await page.$eval('.htile[data-hcat="sleep"] .hbig', e => e.textContent), '—');
  await page.click('.htile[data-hcat="heart"]');
  await page.waitForSelector('#hSheet:not([hidden])');
  assert.match(await page.textContent('#hBody .htr[data-k="hr_rest"]'), /^↓Resting heart rate down 5 bpmvs your 90-day average$/);
  await page.click('#hSheet .sheethead [data-close]');
  await page.click('.htile[data-hcat="vitals"]');
  assert.match(await page.textContent('.hm[data-k="spo2"] .hmh'), /Blood oxygen\s*Off\s*88%/);
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
    await open(page); await loaded(page); await page.waitForSelector('.htile');
    const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth, wide: [...document.querySelectorAll('#main *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 0.5).map(e => e.className.baseVal != null ? e.className.baseVal : e.className || e.tagName).slice(0, 5) }));
    assert.ok(w.doc <= w.win, design + '/' + scheme + ': ' + JSON.stringify(w));
    assert.deepEqual(w.wide, [], design + '/' + scheme);
    await shot(page, 'health-320-' + design + '-' + scheme);
    // and each sheet: nothing wider than it
    for (const c of ['sleep', 'activity']) {
      await page.click('.htile[data-hcat="' + c + '"]'); await page.waitForSelector('#hSheet:not([hidden])'); await page.waitForTimeout(500);
      const s = await page.evaluate(() => { const r = document.querySelector('#hBody').getBoundingClientRect(); return [...document.querySelectorAll('#hBody *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.right > r.right + 0.5 || b.left < r.left - 0.5); }).map(e => e.className.baseVal != null ? e.className.baseVal : e.className || e.tagName).slice(0, 5); });
      assert.deepEqual(s, [], design + '/' + scheme + ' ' + c + ' sheet');
      if (c === 'sleep') await shot(page, 'health-320-sleep-' + design + '-' + scheme);
      await page.keyboard.press('Escape');
    }
    await ctx.close();
  }
});

await test('vitals alerts: your usual for each vital sent after a Health fetch (once while unchanged); the switch in Settings; the alert\'s link opens Health on its day', async () => {
  const { ctx, page, calls } = await phone();
  const posts = () => calls.filter(c => c.url.endsWith('/fitness/api/vitals')).map(c => ({ ...c, json: JSON.parse(c.body) }));
  await open(page); await loaded(page);
  await page.waitForFunction(() => localStorage.getItem('allison-fitness-v1-vitals-sent'), null, { timeout: 8000 });
  let p = posts();
  assert.equal(p.length, 1);
  assert.equal(p[0].method, 'POST'); assert.equal(p[0].x, '1'); assert.equal(p[0].auth, 'Bearer made.up');
  assert.equal(p[0].json.on, true, 'on unless turned off');
  assert.equal(p[0].json.day, TODAY);
  const want = await page.evaluate(d => FitnessHealth.usualRanges(__fitness.data.health, d), TODAY);
  assert.deepEqual(p[0].json.usual, want, 'health.js\'s usual, from the days the phone keeps');
  assert.deepEqual(Object.keys(p[0].json.usual).sort(), ['bp_dia', 'bp_sys', 'glucose', 'resp', 'spo2', 'temp', 'temp_basal', 'vo2']);
  assert.ok(p[0].json.usual.resp && p[0].json.usual.vo2, 'a usual where there are 7 days of readings');
  assert.equal(p[0].json.usual.spo2, null, 'none without them');
  assert.ok(Object.keys(p[0].json).every(k => ['on', 'day', 'usual'].includes(k)), 'nothing else: no readings');
  // opened again, nothing changed: not sent again
  await page.evaluate(() => __fitness.loadHealth(true)); await page.waitForTimeout(800);
  assert.equal(posts().length, 1);
  // Settings > Health > Vitals alerts: on, one sentence; off reaches the server
  await page.click('#setBtn'); await page.waitForSelector('#setSheet:not([hidden])');
  const sw = await page.$eval('#stVitals', b => [b.getAttribute('role'), b.getAttribute('aria-checked'), b.querySelector('.grow').firstChild.textContent, b.querySelector('.sub').textContent, b.closest('.field').querySelector('.label').textContent]);
  assert.deepEqual(sw, ['switch', 'true', 'Vitals alerts', 'Alerts you when a vital is off your usual.', 'Health']);
  assert.ok(await page.evaluate(() => { const v = document.getElementById('stVitals'), i = document.getElementById('stIpsy'); return !!(v && i && (v.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING)); }), 'just before Ipsy');
  await page.click('#stVitals');
  await page.waitForFunction(() => document.getElementById('stVitals').getAttribute('aria-checked') === 'false');
  for (let i = 0; i < 40 && posts().length < 2; i++) await page.waitForTimeout(100);
  p = posts();
  assert.equal(p.length, 2);
  assert.equal(p[1].json.on, false);
  assert.equal(await page.evaluate(() => localStorage.getItem('allison-fitness-v1-vitals-alerts')), '0');
  await page.click('#stVitals');
  for (let i = 0; i < 40 && posts().length < 3; i++) await page.waitForTimeout(100);
  assert.equal(posts()[2].json.on, true, 'and back on');
  await page.keyboard.press('Escape');
  // the alert opens ../fitness/?view=health&day=<day>: Health on that day, from any view
  await page.evaluate(() => localStorage.setItem('allison-fitness-v1-view', 'week'));
  await page.goto(BASE + '/fitness/?view=health&day=' + YESTERDAY); await page.waitForFunction(() => window.__fitness); await page.waitForSelector('.htile');
  assert.equal(await page.textContent('#viewName'), 'Health');
  assert.equal(await page.evaluate(() => __fitness.st.healthDay), YESTERDAY);
  assert.match(await page.textContent('#main .navrow .lbl'), /^Yesterday · /);
  assert.equal(await page.$eval('.htile[data-hcat="vitals"] .hbig', e => e.textContent), '1 off', 'the day the alert was about, with what was off');
  // a day still to come, or not a day: Health on today
  await page.goto(BASE + '/fitness/?view=health&day=2999-01-01'); await page.waitForFunction(() => window.__fitness);
  assert.equal(await page.evaluate(() => __fitness.st.healthDay), TODAY);
  await ctx.close();
});

assert.deepEqual(errors, [], 'no script errors');
await browser.close(); server.close();
console.log('\n' + n + ' tests passed');
