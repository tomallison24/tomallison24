// Drives the Fitness app in headless Chromium at iPhone size: the week, a
// day's sheet, adding an exercise through the muscle group, exercise and
// weight / reps / sets pickers, last time's numbers filling in, the lists'
// sections and Recent, searching every exercise from one bar, a hold timed in seconds, an exercise typed in under
// "Other…", cardio by time and distance, editing and deleting (with Undo), moving between weeks,
// Calendar's week start and ?date= link, Calendar showing the workouts as a
// layer, the Analysis view (the drop-down under the title, Week and Month,
// stronger / weaker / new, muscle groups missed, your drinks from Drinks), Google Sheet sync end to end (the real google-sheet-sync.gs,
// running on fake-sheet.mjs) including a second phone set up from the
// setup link, dark mode, and that nothing trips the page's Content
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
import { fakeSheet } from './fake-sheet.mjs';
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
const SEED = { v: 2, exercises: [], logs: [
  { id: 'old1', date: LAST_WEEK, group: 'shoulders', exercise: 'Overhead Barbell Press', weight: 95, reps: 8, sets: 3, updated: 1 },
  { id: 'old2', date: LAST_WEEK, group: 'core', exercise: 'Sit-Up', weight: 0, reps: 20, sets: 3, updated: 2 },
] };
// The Google Sheet: the real Apps Script, on an in-memory Sheet.
const SHEET_URL = 'https://script.google.com/macros/s/TEST/exec', SECRET = 'test-secret-phrase';
const sheet = fakeSheet(undefined, SECRET);
const sheetCalls = [];

const browser = await chromium.launch();
const violations = [], errors = [];
async function newPage(scheme, seed = SEED, extra = null) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, timezoneId: TZ, locale: 'en-US' });
  // Calendar reaches for iCloud and the weather; nothing is there in a test.
  await ctx.route('**/calendar/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"no-config"}' }));
  await ctx.route('**/api.open-meteo.com/**', route => route.fulfill({ status: 503, body: '' }));
  await ctx.route('https://script.google.com/**', route => {
    const req = route.request(), cors = { 'Access-Control-Allow-Origin': '*' };
    if (req.method() === 'GET') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(sheet.get()) });
    sheetCalls.push(JSON.parse(req.postData()));
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(sheet.post(req.postData())) });
  });
  await ctx.addInitScript(({ seed, extra }) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('allison-fitness-v1', JSON.stringify(seed));
    // The walkthrough (home/welcome.js) as already seen, as on a phone that has been using the app.
    localStorage.setItem('aos.seen', JSON.stringify({ fitness: '1', calendar: '1' }));
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
  assert.match(await page.textContent('.navrow .lbl'), /^This week · /);
  assert.equal(await page.textContent('#viewName'), 'Week');
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
  assert.ok(names.includes('Overhead Barbell Press') && names.includes('Lateral Raise') && names.at(-1) === 'Other…');
  assert.equal(await page.$$eval('#fxW', e => e.length), 0, 'no weight before an exercise');
  await page.selectOption('#fxEx', 'Overhead Barbell Press');
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
  assert.deepEqual({ group: x.group, exercise: x.exercise, weight: x.weight, reps: x.reps, sets: x.sets }, { group: 'shoulders', exercise: 'Overhead Barbell Press', weight: 100, reps: 6, sets: 4 });
  assert.match(await page.textContent('#fxList'), /Overhead Barbell Press\s*Shoulders · 4 × 6 · 100 lb/);
  assert.equal(await page.getAttribute('.opt[data-group="shoulders"]', 'aria-checked'), 'true', 'group kept for the next one');
  assert.match(await page.textContent('.drow.today'), /Shoulders.*1 exercise · 4 sets/);
});

await test('a bodyweight exercise starts at Bodyweight; one typed in under Other is kept', async () => {
  await page.click('.opt[data-group="back"]');
  await page.selectOption('#fxEx', 'Pull-Up');
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
  assert.deepEqual(d.exercises.map(x => [x.group, x.name]), [['lowerback', 'Reverse hyper']]);
  assert.equal(d.logs.filter(l => l.date === TODAY).length, 3);
  const yours = await page.$$eval('#fxEx optgroup[label="Yours"] option', os => os.map(o => o.textContent));
  assert.ok(yours.includes('Reverse hyper'), 'in the list next time, under Yours');
  await shot(page, '03-day-list');
});

await test('editing an exercise, then deleting one and undoing it', async () => {
  await page.click('.ebody[aria-label="Edit Pull-Up"]');
  assert.equal(await page.inputValue('#fxEx'), 'Pull-Up');
  assert.equal(await page.textContent('#fxAdd'), 'Save changes');
  await page.selectOption('#fxR', '12');
  await page.click('#fxAdd');
  let d = await stored(page);
  assert.equal(d.logs.find(l => l.exercise === 'Pull-Up').reps, 12);
  assert.equal(d.logs.filter(l => l.date === TODAY).length, 3);
  await page.click('[aria-label="Delete Pull-Up"]');
  d = await stored(page);
  assert.equal(d.logs.filter(l => l.date === TODAY).length, 2);
  assert.match(await page.textContent('#toastMsg'), /Deleted Pull-Up/);
  assert.ok(Object.keys(await page.evaluate(() => JSON.parse(localStorage.getItem('allison-fitness-v1-graves')))).some(k => k.startsWith('logs:')), 'a grave for the Sheet');
  await page.click('#toastAct');
  d = await stored(page);
  assert.equal(d.logs.filter(l => l.date === TODAY).length, 3);
  assert.equal(d.logs.filter(l => l.date === TODAY)[1].exercise, 'Pull-Up', 'back where it was');
});

await test('the lists: the sheet’s exercises in short sections, what you did lately first', async () => {
  await page.click('.opt[data-group="arms"]');
  assert.deepEqual(await page.$$eval('#fxEx optgroup', gs => gs.map(g => g.label)), ['Biceps', 'Triceps']);
  await page.click('.opt[data-group="legs"]');
  const legs = await page.$$eval('#fxEx option', os => os.map(o => o.textContent));
  assert.ok(legs.includes('Leg Curl') && !legs.includes('Lying Leg Curl') && !legs.includes('Seated Leg Curl'), 'one leg curl, as the gym has one machine');
  await page.click('.opt[data-group="core"]');
  const core = await page.$$eval('#fxEx option', os => os.map(o => o.textContent));
  assert.ok(!core.includes('Ab Wheel Rollout') && core.includes('Ab Crunch Machine'), 'no ab wheel at the gym; its ab machine instead');
  await page.click('.opt[data-group="shoulders"]');
  const groups = await page.$$eval('#fxEx optgroup', gs => gs.map(g => [g.label, [...g.children].map(o => o.textContent)]));
  assert.deepEqual(groups[0], ['Recent', ['Overhead Barbell Press']]);
  assert.deepEqual(groups.slice(1).map(g => g[0]), ['Presses', 'Raises', 'Rear delts and traps']);
  const total = await page.evaluate(() => new Set(window.__fitness.GROUPS.filter(g => g.id !== 'cardio').flatMap(g => g.ex)).size);
  assert.ok(total >= 70 && total <= 80, total + ' strength exercises');
  assert.equal(await page.evaluate(() => window.__fitness.GROUPS.find(g => g.id === 'cardio').ex.length), 12, 'and the gym’s 12 cardio machines, track and pool');
});

await test('a hold is timed in seconds', async () => {
  await page.click('.opt[data-group="core"]');
  await page.selectOption('#fxEx', 'Plank');
  assert.equal(await page.textContent('label[for="fxR"]'), 'Time');
  assert.equal(await page.$eval('#fxR', s => s.selectedOptions[0].textContent), '30 s');
  assert.equal(await page.$eval('#fxW', s => s.selectedOptions[0].textContent), 'Bodyweight');
  await page.selectOption('#fxR', '45');
  await page.click('#fxAdd');
  assert.match(await page.textContent('#fxList'), /Plank\s*Core · 3 × 45 s · Bodyweight/);
  const x = (await stored(page)).logs.find(l => l.exercise === 'Plank');
  assert.equal(x.timed, true); assert.equal(x.reps, 45);
  await page.selectOption('#fxEx', 'Cable Crunch');
  assert.equal(await page.textContent('label[for="fxR"]'), 'Reps', 'back to reps for the next one');
  await page.click('.opt[data-group="shoulders"]');
});

await test('the sheet closes; the + button opens today', async () => {
  await page.click('#daySheet .sheethead [data-close]');
  assert.ok(await page.isHidden('#daySheet'));
  assert.match(await page.textContent('.drow.today'), /Shoulders.*Back.*Lower back.*Core.*4 exercises · 13 sets/);
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
  assert.equal(items[0].title, 'Workout · Shoulders, Back, Lower back, Core');
  assert.equal(items[0].sub, '4 exercises · 13 sets');
  assert.equal(items[0].link, '../fitness/?date=' + TODAY);
  assert.match(items[0].notes, /Overhead Barbell Press: 4 × 6 · 100 lb/);
  assert.match(items[0].notes, /Plank: 3 × 45 s · Bodyweight/);
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
  assert.match(await page.textContent('#fxList'), /Overhead Barbell Press/);
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

await test('Google Sheet: a wrong code is refused; the right one connects and sends the log', async () => {
  await page.goto(BASE + '/fitness/');
  await page.waitForFunction(() => window.__fitness);
  await page.click('#syncBtn');
  await page.waitForSelector('#syncSheet:not([hidden])');
  await page.fill('#syUrl', 'https://example.com/not-a-script');
  await page.fill('#sySecret', SECRET);
  await page.click('#syConnect');
  assert.match(await page.textContent('#syStatus'), /starts with https:\/\/script\.google\.com/);
  await page.fill('#syUrl', SHEET_URL);
  await page.fill('#sySecret', 'wrong code');
  await page.click('#syConnect');
  await page.waitForFunction(() => /doesn’t match/.test(document.getElementById('syStatus').textContent));
  assert.ok(await page.isVisible('#syForm'), 'still asking');
  await page.fill('#sySecret', SECRET);
  await page.click('#syConnect');
  await page.waitForSelector('#syOn:not([hidden])');
  assert.match(await page.textContent('#syStatus'), /Connected/);
  const mine = (await stored(page)).logs.length;
  const rows = sheet.tab('Workouts');
  assert.equal(rows.length, mine + 1, 'every exercise in the Workouts tab');
  assert.ok(rows.some(r => r[3] === 'Plank' && r[6] === 45), 'the plank in seconds');
  await shot(page, '07-sheet-connected');
  await page.click('#syncSheet .sheethead [data-close]');
});

await test('Google Sheet: a deletion syncs; a second phone set up from the link gets the log', async () => {
  await page.click('.drow.today');
  await page.click('[aria-label="Delete Reverse hyper"]');
  await page.waitForFunction(() => window.__fitness && true);
  const deleted = (await page.evaluate(() => Object.keys(window.__fitness.graves())))[0];
  await page.waitForTimeout(2600);   // the sync after a change waits 2 s
  assert.ok(sheetCalls.at(-1).graves[deleted], 'the grave was sent');
  assert.ok(!sheet.tab('Workouts').some(r => r[3] === 'Reverse hyper'), 'gone from the Sheet');
  await page.keyboard.press('Escape');
  const phone2 = await newPage('light', { v: 2, logs: [], exercises: [] });
  const link = BASE + '/fitness/#sync=' + Buffer.from(JSON.stringify({ u: SHEET_URL, s: SECRET })).toString('base64url');
  await phone2.page.goto(link);
  await phone2.page.waitForSelector('#syncSheet:not([hidden])');
  assert.match(await phone2.page.textContent('#syStatus'), /setup link/);
  assert.equal(await phone2.page.inputValue('#syUrl'), SHEET_URL);
  assert.ok(!(await phone2.page.evaluate(() => location.hash)), 'the code is taken out of the address');
  await phone2.page.click('#syConnect');
  await phone2.page.waitForSelector('#syOn:not([hidden])');
  await phone2.page.click('#syncSheet .sheethead [data-close]');
  assert.match(await phone2.page.textContent('.drow.today'), /Shoulders.*Back.*Core.*3 exercises · 10 sets/);
  assert.deepEqual((await stored(phone2.page)).exercises.map(x => x.name), ['Reverse hyper'], 'your typed-in exercises come across too');
  violations.push(...(await phone2.page.evaluate(() => window.__csp || [])));
  await phone2.ctx.close();
});

await test('Analysis: from the glass pill at the bottom; stronger, weaker, new and missed', async () => {
  const D = n => ymd(day(n));
  const seed = { v: 2, exercises: [], logs: [
    { id: 'a1', date: D(-10), group: 'chest', exercise: 'Barbell Bench Press', weight: 100, reps: 8, sets: 3, updated: 1 },
    { id: 'a2', date: D(-10), group: 'legs', exercise: 'Barbell Back Squat', weight: 155, reps: 5, sets: 4, updated: 2 },
    { id: 'a3', date: D(-10), group: 'back', exercise: 'Pull-Up', weight: 0, reps: 8, sets: 3, updated: 3 },
    { id: 'a4', date: D(-40), group: 'shoulders', exercise: 'Lateral Raise', weight: 20, reps: 12, sets: 3, updated: 4 },
    { id: 'a5', date: D(-2), group: 'chest', exercise: 'Barbell Bench Press', weight: 110, reps: 6, sets: 3, updated: 5 },
    { id: 'a6', date: D(-2), group: 'back', exercise: 'Pull-Up', weight: 0, reps: 10, sets: 3, updated: 6 },
    { id: 'a7', date: D(-3), group: 'shoulders', exercise: 'Lateral Raise', weight: 15, reps: 12, sets: 3, updated: 7 },
    { id: 'a8', date: D(-3), group: 'arms', exercise: 'Dumbbell Curl', weight: 30, reps: 10, sets: 3, updated: 8 },
  ] };
  const an = await newPage('light', seed);
  const p = an.page;
  await p.goto(BASE + '/fitness/');
  await p.waitForFunction(() => window.__fitness);
  // The pill sits at the bottom, centred, clear of the + button.
  const pill = await p.$eval('#vbar', e => { const r = e.getBoundingClientRect(), f = document.getElementById('fab').getBoundingClientRect(); return { pos: getComputedStyle(e).position, bottom: innerHeight - r.bottom, mid: r.left + r.width / 2, w: innerWidth, overlap: r.right > f.left }; });
  assert.equal(pill.pos, 'fixed');
  assert.ok(pill.bottom >= 10 && pill.bottom <= 24, 'near the bottom: ' + pill.bottom);
  assert.ok(Math.abs(pill.mid - pill.w / 2) < 1, 'centred');
  assert.ok(!pill.overlap, 'clear of the + button');
  assert.ok(await p.$('#vbIcon svg'), 'the view’s icon');
  await p.click('#viewBtn');
  assert.equal(await p.getAttribute('#viewBtn', 'aria-expanded'), 'true');
  const opens = await p.evaluate(() => document.getElementById('viewMenu').getBoundingClientRect().bottom <= document.getElementById('vbar').getBoundingClientRect().top);
  assert.ok(opens, 'the menu opens upwards, above the pill');
  assert.deepEqual(await p.$$eval('#viewMenu [data-view]', bs => bs.map(b => [b.dataset.view, b.getAttribute('aria-selected')])), [['week', 'true'], ['analysis', 'false']]);
  assert.match(await p.textContent('#viewMenu [data-view="analysis"] small'), /Improving 2 · needs work 2/);
  await shot(p, '08-view-menu');
  await p.click('#viewMenu [data-view="analysis"]');
  assert.ok(await p.isHidden('#viewMenu'));
  assert.equal(await p.textContent('#viewName'), 'Analysis');
  assert.ok(await p.isHidden('#todayBtn'));
  // Totals: 2 days and 12 sets in the last 7, against 1 day and 10 sets before.
  const kpis = await p.$$eval('.kpi', ks => ks.map(k => k.textContent));
  assert.match(kpis[0], /Days trained2↑ \+1$/);
  assert.match(kpis[1], /Sets12↑ \+2$/);
  assert.match(kpis[2], /Volume \(lb\)3,420↓ −2\.1K$/);
  assert.match(await p.getAttribute('.kpi:nth-child(3)', 'aria-label'), /down 2,080, 38% on the 7 before/);
  const up = await p.$$eval('#anUp .xrow:not(.quiet)', rs => rs.map(r => r.textContent));
  assert.equal(up.length, 2);
  assert.match(up[0], /Pull-Up10 reps · was 8 reps25%/);
  assert.match(up[1], /Barbell Bench Press110 lb × 6 · was 100 lb × 84%/);
  assert.match(await p.textContent('#anUp .quiet'), /New\s*Dumbbell Curl/);
  const work = await p.$$eval('#anWork .xrow', rs => rs.map(r => r.textContent));
  assert.match(work[0], /Lateral Raise15 lb × 12 · was 20 lb × 12 on .+25%/);
  assert.match(work[1], /LegsNot trained in the last 7 days \(4 sets in the 7 before\)/);
  assert.equal(await p.$eval('.gbar[data-g="legs"] .gv', e => e.textContent), '0 −4');
  assert.ok(await p.$('.seg > .slthumb'), 'the Week / Month switch has its sliding thumb');
  await shot(p, '09-analysis-week');
  // Month: the four weeks before hold the old lateral raise, so the bench is new.
  await p.click('[data-period="month"]');
  assert.match(await p.textContent('#anUp .quiet'), /New\s*(.*Barbell Bench Press)/);
  assert.match(await p.textContent('#anWork'), /Lateral Raise.*was 20 lb × 12/);
  assert.ok(!/ on /.test(await p.textContent('#anWork .xrow')), 'compared within the window before, so no date');
  // The view and the reading are remembered.
  await p.reload(); await p.waitForFunction(() => window.__fitness);
  assert.equal(await p.textContent('#viewName'), 'Analysis');
  assert.equal(await p.getAttribute('[data-period="month"]', 'aria-pressed'), 'true');
  await p.click('#viewBtn'); await p.click('#viewMenu [data-view="week"]');
  assert.equal(await p.$$eval('.drow', e => e.length), 7);
  await p.click('.drow.today');
  assert.ok(await p.evaluate(() => document.documentElement.classList.contains('locked')), 'a popup is open');
  // It fades out over a quarter of a second: wait for the end, not a guess at it.
  await p.waitForFunction(() => getComputedStyle(document.getElementById('vbar')).opacity === '0', null, { timeout: 3000 });
  assert.equal(await p.$eval('#vbar', e => getComputedStyle(e).pointerEvents), 'none', 'the pill hides under a popup');
  await p.keyboard.press('Escape');
  violations.push(...(await p.evaluate(() => window.__csp || [])));
  await an.ctx.close();
  const dk = await newPage('dark', seed, { 'allison-fitness-v1-view': 'analysis' });
  await dk.page.goto(BASE + '/fitness/'); await dk.page.waitForFunction(() => window.__fitness); await dk.page.waitForTimeout(500);
  await shot(dk.page, '10-analysis-dark');
  if (SHOTS) await dk.page.screenshot({ path: path.join(SHOTS, '11-analysis-dark-full.png'), fullPage: true });
  violations.push(...(await dk.page.evaluate(() => window.__csp || [])));
  await dk.ctx.close();
});

await test('Analysis: your drinks from Drinks beside your training, signed in; nothing without a session', async () => {
  const D = n => ymd(day(n));
  const seed = { v: 2, exercises: [], logs: [
    { id: 'd1', date: D(-2), group: 'chest', exercise: 'Barbell Bench Press', weight: 110, reps: 6, sets: 3, updated: 1 },
    { id: 'd2', date: D(-9), group: 'chest', exercise: 'Barbell Bench Press', weight: 100, reps: 8, sets: 3, updated: 2 },
  ] };
  const calls = [];
  const summary = route => {
    const req = route.request(), u = new URL(req.url());
    calls.push({ x: req.headers()['x-drinks'], auth: req.headers()['authorization'], from: u.searchParams.get('from'), to: u.searchParams.get('to') });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ days: { [D(-1)]: { sd: 2.5, n: 2 }, [D(-3)]: { status: 'af' }, [D(-4)]: { status: 'af' }, [D(-9)]: { sd: 4, n: 3 } } }) });
  };
  const session = JSON.stringify({ token: 'tok.sig', user: { id: 'u1', name: 'Tom', role: 'owner' }, at: Date.now() });
  const dr = await newPage('light', seed, { 'allison-fitness-v1-view': 'analysis', 'aos.session': session });
  await dr.ctx.route('**/drinks/api/**', summary);
  await dr.page.goto(BASE + '/fitness/');
  await dr.page.waitForSelector('#anDrinks');
  assert.deepEqual(calls[0], { x: '1', auth: 'Bearer tok.sig', from: D(-13), to: D(0) }, 'both windows, signed in, with the app header');
  const rows = await dr.page.$$eval('#anDrinks .xrow', rs => rs.map(r => r.textContent));
  assert.deepEqual(rows, ['Standard drinks4 in the 7 before2.5', 'Alcohol-free days0 in the 7 before2', 'Open Drinks']);
  assert.equal(await dr.page.getAttribute('#anDrinks a', 'href'), '../drinks/');
  await dr.page.waitForTimeout(1000);
  if (SHOTS) await dr.page.screenshot({ path: path.join(SHOTS, '15-analysis-drinks.png'), fullPage: true });
  violations.push(...(await dr.page.evaluate(() => window.__csp || [])));
  await dr.ctx.close();
  // Signed out: Fitness doesn't ask, and shows nothing of it.
  calls.length = 0;
  const so = await newPage('light', seed, { 'allison-fitness-v1-view': 'analysis' });
  await so.ctx.route('**/drinks/api/**', summary);
  await so.page.goto(BASE + '/fitness/'); await so.page.waitForFunction(() => window.__fitness); await so.page.waitForTimeout(500);
  assert.equal(calls.length, 0); assert.equal(await so.page.$$eval('#anDrinks', e => e.length), 0);
  assert.ok(await so.page.isHidden('#aos-signin') || !(await so.page.$('#aos-signin')), 'no sign-in sheet');
  await so.ctx.close();
});

await test('Search: every exercise from one bar; picking one fills in the group, the exercise and last time', async () => {
  const seed = { v: 2, exercises: [{ id: 'm1', group: 'core', name: 'Pallof Press', updated: 1 }], logs: [
    { id: 's1', date: ymd(day(-3)), group: 'legs', exercise: 'Leg Curl', weight: 70, reps: 12, sets: 3, updated: 1 },
  ] };
  const se = await newPage('light', seed);
  const p = se.page;
  await p.goto(BASE + '/fitness/');
  await p.waitForFunction(() => window.__fitness);
  await p.click('.drow.today');
  assert.ok(await p.isVisible('#fxSearch'));
  // Across groups: curls in Arms and in Legs; the one you've done first.
  await p.fill('#fxSearch', 'curl');
  const hits = await p.$$eval('#fxResults [data-pick]', bs => bs.map(b => b.dataset.pick + '|' + b.dataset.pg));
  assert.equal(hits[0], 'Leg Curl|legs', 'done before, so first');
  assert.ok(hits.includes('Dumbbell Curl|arms') && hits.includes('Hammer Curl|arms'));
  assert.match(await p.textContent('#fxResults [data-pick="Leg Curl"]'), /Legs · last 3 × 12 · 70 lb/);
  assert.equal(await p.$$eval('.opt[data-group]', e => e.length), 0, 'the groups make way for the results');
  assert.equal(await p.$eval('#fxSearch', e => e === document.activeElement), true, 'typing carries on');
  await shot(p, '12a-search-results');
  // Short forms and any word order.
  await p.fill('#fxSearch', 'db curl');
  assert.equal(await p.$eval('#fxResults [data-pick]', b => b.dataset.pick), 'Dumbbell Curl');
  await p.fill('#fxSearch', 'press shoulder');
  const sh = await p.$$eval('#fxResults [data-pick]', bs => bs.map(b => b.dataset.pick));
  assert.ok(sh.includes('Seated Dumbbell Shoulder Press') && sh.includes('Shoulder Press Machine') && sh.includes('Overhead Barbell Press'), 'the group’s name counts too: ' + sh);
  // Your own exercises are found as well.
  await p.fill('#fxSearch', 'pallof');
  assert.equal(await p.$eval('#fxResults [data-pick]', b => b.dataset.pg), 'core');
  // Picking one: group chosen, exercise chosen, last time's numbers in.
  await p.fill('#fxSearch', 'leg cu');
  await p.click('#fxResults [data-pick="Leg Curl"]');
  assert.equal(await p.inputValue('#fxSearch'), '', 'the search clears');
  assert.equal(await p.getAttribute('.opt[data-group="legs"]', 'aria-checked'), 'true');
  assert.equal(await p.inputValue('#fxEx'), 'Leg Curl');
  assert.equal(await p.inputValue('#fxW'), '70');
  assert.equal(await p.inputValue('#fxR'), '12');
  await p.click('#fxAdd');
  assert.match(await p.textContent('#fxList'), /Leg Curl\s*Legs · 3 × 12 · 70 lb/);
  // Enter takes the first result.
  await p.fill('#fxSearch', 'plank');
  await p.press('#fxSearch', 'Enter');
  assert.equal(await p.inputValue('#fxEx'), 'Plank');
  assert.equal(await p.textContent('label[for="fxR"]'), 'Time', 'a hold, so timed');
  await shot(p, '12-search');
  // Nothing found: add it as your own, then pick its group.
  await p.fill('#fxSearch', 'Landmine Press');
  assert.match(await p.textContent('#fxResults'), /No exercise matches “Landmine Press”/);
  await p.click('[data-addnew]');
  assert.match(await p.textContent('#fxPick .hint'), /Now pick the muscle group for Landmine Press/);
  assert.equal(await p.$$eval('#fxEx', e => e.length), 0);
  await p.click('.opt[data-group="shoulders"]');
  assert.equal(await p.inputValue('#fxOther'), 'Landmine Press');
  await p.selectOption('#fxW', '45');
  await p.click('#fxAdd');
  const d = await stored(p);
  assert.ok(d.logs.some(x => x.exercise === 'Landmine Press' && x.group === 'shoulders' && x.weight === 45));
  assert.ok(d.exercises.some(x => x.name === 'Landmine Press' && x.group === 'shoulders'), 'kept, so search finds it next time');
  await p.fill('#fxSearch', 'landmine');
  assert.equal(await p.$eval('#fxResults [data-pick]', b => b.dataset.pick), 'Landmine Press');
  await p.fill('#fxSearch', 'landmine press');
  assert.equal(await p.$$eval('[data-addnew]', e => e.length), 0, 'no "Add" for a name that already exists');
  violations.push(...(await p.evaluate(() => window.__csp || [])));
  await se.ctx.close();
});

await test('Cardio: the gym’s machines, logged by time and distance, in the week, Analysis and Calendar', async () => {
  const seed = { v: 2, exercises: [], logs: [
    { id: 'k1', date: ymd(day(-8)), group: 'cardio', exercise: 'Treadmill', weight: 0, reps: 0, sets: 0, cardio: true, mins: 30, dist: 2.5, unit: 'mi', updated: 1 },
  ] };
  const ca = await newPage('light', seed);
  const p = ca.page;
  await p.goto(BASE + '/fitness/');
  await p.waitForFunction(() => window.__fitness);
  await p.click('.drow.today');
  // Search by what you'd call it: "run" finds the treadmill and the track.
  await p.fill('#fxSearch', 'run');
  const runs = await p.$$eval('#fxResults [data-pick]', bs => bs.map(b => b.dataset.pick));
  assert.deepEqual(runs.slice(0, 2), ['Treadmill', 'Indoor Track']);
  await p.fill('#fxSearch', 'rower');
  assert.equal(await p.$eval('#fxResults [data-pick]', b => b.dataset.pick), 'Rowing Machine');
  await p.fill('#fxSearch', 'tread');
  await p.click('#fxResults [data-pick="Treadmill"]');
  assert.equal(await p.getAttribute('.opt[data-group="cardio"]', 'aria-checked'), 'true');
  assert.equal(await p.$$eval('#fxW, #fxR, #fxS', e => e.length), 0, 'no weight, reps or sets');
  assert.equal(await p.inputValue('#fxM'), '30', 'last time’s minutes');
  assert.equal(await p.inputValue('#fxD'), '2.5', 'and distance');
  assert.equal(await p.$eval('#fxD', s => s.selectedOptions[0].textContent), '2.5 mi');
  await p.selectOption('#fxD', '3');
  await p.click('#fxAdd');
  assert.match(await p.textContent('#fxList'), /Treadmill\s*Cardio · 30 min · 3 mi/);
  // The rower in metres, and distance can be left out.
  await p.click('.opt[data-group="cardio"]');
  const secs = await p.$$eval('#fxEx optgroup', gs => gs.map(g => g.label));
  assert.ok(['Machines', 'Bikes', 'Track and pool'].every(l => secs.includes(l)), secs.join());
  await p.selectOption('#fxEx', 'Rowing Machine');
  assert.equal(await p.inputValue('#fxM'), '20', 'a first time starts at 20 minutes');
  assert.equal(await p.inputValue('#fxD'), '', 'no distance unless you choose one');
  assert.ok((await p.$$eval('#fxD option', os => os.map(o => o.textContent))).includes('2,000 m'));
  await p.selectOption('#fxM', '15');
  await p.click('#fxAdd');
  assert.match(await p.textContent('#fxList'), /Rowing Machine\s*Cardio · 15 min(?! ·)/);
  const d = await stored(p);
  const row = d.logs.find(x => x.exercise === 'Rowing Machine');
  assert.deepEqual({ cardio: row.cardio, mins: row.mins, dist: row.dist, unit: row.unit, sets: row.sets }, { cardio: true, mins: 15, dist: 0, unit: 'm', sets: 0 });
  // Editing one brings its minutes and distance back.
  await p.click('.ebody[aria-label="Edit Treadmill"]');
  assert.equal(await p.inputValue('#fxM'), '30'); assert.equal(await p.inputValue('#fxD'), '3');
  await p.click('#fxCancel');
  await shot(p, '13-cardio');
  await p.keyboard.press('Escape');
  assert.match(await p.textContent('.drow.today'), /Cardio.*45 min cardio/);
  // Analysis: minutes on their own tile, and the faster treadmill.
  await p.evaluate(() => window.__fitness.setView('analysis'));
  // Week: today's 45 minutes against last week's 30.
  const kp = await p.$$eval('.kpi', ks => ks.map(k => k.textContent));
  assert.match(kp[3], /Cardio \(min\)45↑ \+15$/);
  assert.match(await p.textContent('#anUp'), /Treadmill30 min · 3 mi · was 30 min · 2\.5 mi/);
  assert.ok(!(await p.$('.gbar[data-g="cardio"]')), 'not a muscle group bar');
  await p.waitForTimeout(900);   // past the cards' entrance
  await shot(p, '14-cardio-analysis');
  // Calendar shows it too.
  await p.goto(BASE + '/calendar/?date=' + TODAY + '&view=day');
  await p.waitForFunction(() => window.__calendar); await p.waitForTimeout(300);
  const it = await p.evaluate(d => window.__calendar.eventsOn(d).find(x => x.kind === 'fitness'), TODAY);
  assert.equal(it.title, 'Workout · Cardio');
  assert.equal(it.sub, '45 min cardio');
  assert.match(it.notes, /Treadmill: 30 min · 3 mi\nRowing Machine: 15 min$/);
  violations.push(...(await p.evaluate(() => window.__csp || [])));
  await ca.ctx.close();
});

await test('Analysis with nothing logged says so', async () => {
  const e = await newPage('light', { v: 2, logs: [], exercises: [] }, { 'allison-fitness-v1-view': 'analysis' });
  await e.page.goto(BASE + '/fitness/'); await e.page.waitForFunction(() => window.__fitness);
  assert.match(await e.page.textContent('#main'), /Nothing to compare yet/);
  await e.ctx.close();
});

await test('dark mode renders', async () => {
  const dark = await newPage('dark', (await stored(page)));
  await dark.page.goto(BASE + '/fitness/');
  await dark.page.waitForFunction(() => window.__fitness);
  await dark.page.waitForTimeout(500);
  await shot(dark.page, '05-week-dark');
  await dark.page.click('.drow.today');
  await dark.page.click('.opt[data-group="legs"]');
  await dark.page.selectOption('#fxEx', 'Barbell Back Squat');
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
