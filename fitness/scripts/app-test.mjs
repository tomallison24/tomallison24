// Drives the Fitness app in headless Chromium at iPhone size: the week, a
// day's sheet, adding an exercise through the muscle group, exercise and
// weight / reps / sets pickers, last time's numbers filling in, an exercise
// typed in under "Other…", editing and deleting (with Undo), moving between
// weeks, Calendar's week start and ?date= link, Calendar showing the
// workouts as a layer, dark mode, and that nothing trips the page's Content
// Security Policy. Screenshots go to the folder given as the second argument.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node fitness/scripts/app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

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

// ---- dates around today, in the test's own zone (the browser gets the same one) ----
const TZ = 'America/Denver';
process.env.TZ = TZ;
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const TODAY = ymd(day(0));
const weekStart = sunday => { const d = day(0); d.setDate(d.getDate() - (sunday ? d.getDay() : (d.getDay() + 6) % 7)); return ymd(d); };
const LAST_WEEK = ymd(day(-7));
// A shoulder day a week ago, so "last time" has something to fill in.
const SEED = { v: 1, custom: {}, logs: [
  { id: 'old1', date: LAST_WEEK, group: 'shoulders', exercise: 'Overhead press', weight: 95, reps: 8, sets: 3, updated: 1 },
  { id: 'old2', date: LAST_WEEK, group: 'core', exercise: 'Crunches', weight: 0, reps: 20, sets: 3, updated: 2 },
] };

const browser = await chromium.launch();
const violations = [], errors = [];
async function newPage(scheme, seed = SEED, extra = null) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, timezoneId: TZ, locale: 'en-US' });
  // Calendar reaches for iCloud and the weather; nothing is there in a test.
  await ctx.route('**/calendar/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"no-config"}' }));
  await ctx.route('**/api.open-meteo.com/**', route => route.fulfill({ status: 503, body: '' }));
  await ctx.addInitScript(({ seed, extra }) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('allison-fitness-v1', JSON.stringify(seed));
    if (extra) for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, { seed, extra });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource|404|503/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { window.__csp = (window.__csp || []).concat(e.violatedDirective + ' ' + e.blockedURI); }));
  return { ctx, page };
}
const shot = (page, name) => SHOTS ? page.screenshot({ path: path.join(SHOTS, name + '.png') }) : null;
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('allison-fitness-v1')));
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

const { ctx, page } = await newPage('light');
await page.goto(BASE + '/fitness/');
await page.waitForFunction(() => window.__fitness);
await page.waitForTimeout(500);

await test('the week shows seven days from Monday, today marked', async () => {
  const days = await page.$$eval('.drow', els => els.map(e => e.dataset.day));
  assert.equal(days.length, 7);
  assert.equal(days[0], weekStart(false));
  assert.equal(await page.$eval('.drow.today', e => e.dataset.day), TODAY);
  assert.equal((await page.textContent('#titleSub')).trim(), 'This week');
  assert.ok(await page.isHidden('#todayBtn'), 'no "this week" button on this week');
  await shot(page, '01-week');
});

await test('last week shows the shoulder day, with its groups and totals', async () => {
  await page.click('[data-act="prev"]');
  const row = page.locator('.drow[data-day="' + LAST_WEEK + '"]');
  assert.match(await row.textContent(), /Shoulders.*Core.*2 exercises · 6 sets/);
  assert.equal(await page.$$eval('.stat b', els => els.map(e => e.textContent).join(',')), '1,2,6');
  assert.ok(await page.isVisible('#todayBtn'));
  await page.click('#todayBtn');
  assert.equal(await page.$eval('.drow', e => e.dataset.day), weekStart(false));
});

await test('a day: muscle group, then exercise, then weight, reps and sets; last time fills in', async () => {
  await page.click('.drow.today');
  await page.waitForSelector('#daySheet:not([hidden])');
  assert.match(await page.textContent('#dayLbl'), /^Today/);
  assert.match(await page.textContent('#fxList'), /Nothing logged today/);
  assert.equal(await page.$$eval('#fxEx', e => e.length), 0, 'no exercise list before a group');
  assert.ok(await page.isDisabled('#fxAdd'));
  await page.click('.opt[data-group="shoulders"]');
  const names = await page.$$eval('#fxEx option', os => os.map(o => o.textContent));
  assert.ok(names.includes('Overhead press') && names.includes('Lateral raise') && names.at(-1) === 'Other…');
  assert.equal(await page.$$eval('#fxW', e => e.length), 0, 'no weight before an exercise');
  await page.selectOption('#fxEx', 'Overhead press');
  assert.equal(await page.inputValue('#fxW'), '95');
  assert.equal(await page.inputValue('#fxR'), '8');
  assert.equal(await page.inputValue('#fxS'), '3');
  assert.match(await page.textContent('#dayBody'), /Last time, .*3 × 8 · 95 lb/);
  await page.selectOption('#fxW', '100');
  await page.selectOption('#fxR', '6');
  await page.selectOption('#fxS', '4');
  await shot(page, '02-day-form');
  await page.click('#fxAdd');
  const d = await stored(page);
  const x = d.logs.find(l => l.date === TODAY);
  assert.deepEqual({ group: x.group, exercise: x.exercise, weight: x.weight, reps: x.reps, sets: x.sets }, { group: 'shoulders', exercise: 'Overhead press', weight: 100, reps: 6, sets: 4 });
  assert.match(await page.textContent('#fxList'), /Overhead press\s*Shoulders · 4 × 6 · 100 lb/);
  assert.equal(await page.getAttribute('.opt[data-group="shoulders"]', 'aria-checked'), 'true', 'group kept for the next one');
  assert.match(await page.textContent('.drow.today'), /Shoulders.*1 exercise · 4 sets/);
});

await test('a bodyweight exercise starts at Bodyweight; one typed in under Other is kept', async () => {
  await page.click('.opt[data-group="back"]');
  await page.selectOption('#fxEx', 'Pull-ups');
  assert.equal(await page.inputValue('#fxW'), '0');
  assert.equal(await page.$eval('#fxW', s => s.selectedOptions[0].textContent), 'Bodyweight');
  await page.click('#fxAdd');
  await page.click('.opt[data-group="lowerback"]');
  await page.selectOption('#fxEx', '__other__');
  assert.equal(await page.$$eval('#fxW', e => e.length), 0, 'no weight before the name');
  assert.ok(await page.isDisabled('#fxAdd'));
  await page.fill('#fxOther', 'Reverse hyper');
  await page.waitForSelector('#fxW');
  assert.equal(await page.$eval('#fxOther', e => e === document.activeElement), true, 'typing carries on');
  await page.selectOption('#fxW', '45');
  await page.click('#fxAdd');
  const d = await stored(page);
  assert.deepEqual(d.custom, { lowerback: ['Reverse hyper'] });
  assert.equal(d.logs.filter(l => l.date === TODAY).length, 3);
  const names = await page.$$eval('#fxEx option', os => os.map(o => o.textContent));
  assert.ok(names.includes('Reverse hyper'), 'in the list next time');
  await shot(page, '03-day-list');
});

await test('editing an exercise, then deleting one and undoing it', async () => {
  await page.click('.ebody[aria-label="Edit Pull-ups"]');
  assert.equal(await page.inputValue('#fxEx'), 'Pull-ups');
  assert.equal(await page.textContent('#fxAdd'), 'Save changes');
  await page.selectOption('#fxR', '12');
  await page.click('#fxAdd');
  let d = await stored(page);
  assert.equal(d.logs.find(l => l.exercise === 'Pull-ups').reps, 12);
  assert.equal(d.logs.filter(l => l.date === TODAY).length, 3);
  await page.click('[aria-label="Delete Pull-ups"]');
  d = await stored(page);
  assert.equal(d.logs.filter(l => l.date === TODAY).length, 2);
  assert.match(await page.textContent('#toastMsg'), /Deleted Pull-ups/);
  await page.click('#toastAct');
  d = await stored(page);
  assert.equal(d.logs.filter(l => l.date === TODAY).length, 3);
  assert.equal(d.logs.filter(l => l.date === TODAY)[1].exercise, 'Pull-ups', 'back where it was');
});

await test('the sheet closes; the + button opens today', async () => {
  await page.click('#daySheet .sheethead [data-close]');
  assert.ok(await page.isHidden('#daySheet'));
  assert.match(await page.textContent('.drow.today'), /Shoulders.*Back.*Lower back.*3 exercises · 10 sets/);
  await shot(page, '04-week-after');
  await page.click('#fab');
  await page.waitForSelector('#daySheet:not([hidden])');
  assert.match(await page.textContent('#dayLbl'), /^Today/);
  await page.keyboard.press('Escape');
  assert.ok(await page.isHidden('#daySheet'));
});

await test('Calendar shows the workouts as a layer, and links back to the day', async () => {
  await page.goto(BASE + '/calendar/?date=' + TODAY + '&view=day');
  await page.waitForFunction(() => window.__calendar);
  await page.waitForTimeout(400);
  const items = await page.evaluate(d => window.__calendar.eventsOn(d).filter(x => x.kind === 'fitness').map(x => ({ title: x.title, sub: x.sub, link: x.link, notes: x.notes })), TODAY);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Workout · Shoulders, Back, Lower back');
  assert.equal(items[0].sub, '3 exercises · 10 sets');
  assert.equal(items[0].link, '../fitness/?date=' + TODAY);
  assert.match(items[0].notes, /Overhead press: 4 × 6 · 100 lb/);
  const past = await page.evaluate(d => window.__calendar.eventsOn(d).filter(x => x.kind === 'fitness').length, LAST_WEEK);
  assert.equal(past, 1);
  await page.click('#setBtn');
  assert.match(await page.textContent('#stBody'), /Fitness/);
  await page.click('[data-layer="fitness"]');
  assert.equal(await page.evaluate(d => window.__calendar.eventsOn(d).filter(x => x.kind === 'fitness').length, TODAY), 0, 'the layer switches off');
  await page.click('[data-layer="fitness"]');
  await page.click('#setSheet .sheethead [data-close]');
  await page.goto(BASE + '/fitness/?date=' + LAST_WEEK);
  await page.waitForSelector('#daySheet:not([hidden])');
  assert.match(await page.textContent('#fxList'), /Overhead press/);
  const lw = day(-7); lw.setDate(lw.getDate() - (lw.getDay() + 6) % 7);
  assert.equal(await page.$eval('.drow', e => e.dataset.day), ymd(lw), 'opens on that day’s week');
});

await test('the week starts on Sunday when Calendar is set to', async () => {
  const sun = await newPage('light', SEED, { 'allison-calendar-v1-settings': JSON.stringify({ weekStart: 0 }) });
  await sun.page.goto(BASE + '/fitness/');
  await sun.page.waitForFunction(() => window.__fitness);
  assert.equal(await sun.page.$eval('.drow', e => e.dataset.day), weekStart(true));
  assert.match(await sun.page.$eval('.drow .dn small', e => e.textContent), /Sun/);
  violations.push(...(await sun.page.evaluate(() => window.__csp || [])));
  await sun.ctx.close();
});

await test('a sideways swipe on the week moves a week', async () => {
  await page.goto(BASE + '/fitness/');
  await page.waitForFunction(() => window.__fitness);
  const first = await page.$eval('.drow', e => e.dataset.day);
  await page.evaluate(() => {
    const el = document.querySelector('.week'), t = (x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(300, 300)], changedTouches: [t(300, 300)] }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(120, 310)] }));
  });
  const next = await page.$eval('.drow', e => e.dataset.day);
  const d = new Date(first + 'T12:00:00'); d.setDate(d.getDate() + 7);
  assert.equal(next, ymd(d));
});

await test('dark mode renders', async () => {
  const dark = await newPage('dark', (await stored(page)));
  await dark.page.goto(BASE + '/fitness/');
  await dark.page.waitForFunction(() => window.__fitness);
  await dark.page.waitForTimeout(500);
  await shot(dark.page, '05-week-dark');
  await dark.page.click('.drow.today');
  await dark.page.click('.opt[data-group="legs"]');
  await dark.page.selectOption('#fxEx', 'Back squat');
  await dark.page.waitForTimeout(500);
  await shot(dark.page, '06-day-dark');
  violations.push(...(await dark.page.evaluate(() => window.__csp || [])));
  await dark.ctx.close();
});

await test('nothing tripped the Content Security Policy and no script errors', async () => {
  violations.push(...(await page.evaluate(() => window.__csp || [])));
  assert.deepEqual(violations, []);
  assert.deepEqual(errors, []);
});

await ctx.close();
await browser.close();
server.close();
console.log('\n' + n + ' tests passed');
