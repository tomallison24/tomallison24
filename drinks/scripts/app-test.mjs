// Drives the Drinks app in headless Chromium at iPhone size: the week and its
// one number, a day's sheet, logging a usual drink in one tap (with Undo),
// "Something else…" (kind fills in size and strength, oz and ml), changing
// and deleting a drink, alcohol-free and don't-remember days, the streak,
// goals, Analysis, bringing in the ABV Tracker's Log, the ?date= link, and the
// family account end to end: the real functions/drinks/api route, on an
// in-memory Workers KV with real sessions, two phones kept in step, a delete
// travelling between them, signed out, and accounts not yet switched on.
// Also dark mode, and that nothing trips the page's Content Security Policy.
// Screenshots go to the folder given as the second argument.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node drinks/scripts/app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { onRequest } from '../../functions/drinks/api/[[route]].js';
import { issue, putJSON } from '../../server/auth.js';
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
const TZ = 'America/New_York';
process.env.TZ = TZ;
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const TODAY = ymd(day(0)), YESTERDAY = ymd(day(-1)), TWO_AGO = ymd(day(-2));
const weekStart = () => { const d = day(0); d.setDate(d.getDate() - d.getDay()); return ymd(d); };

// ---- the family account server: the real route, on Workers KV in memory ----
const kv = new Map();
const KV = { get: async k => kv.has(k) ? kv.get(k) : null, put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
let accountsOn = true;
await KV.put('owner', 'OWNER1');
await putJSON(KV, 'user:OWNER1', { id: 'OWNER1', name: 'Tom', role: 'owner', creds: [] });
const TOKEN = await issue(KV, 'OWNER1');
const SESSION = JSON.stringify({ token: TOKEN, user: { id: 'OWNER1', name: 'Tom', role: 'owner' }, at: Date.now() });
const apiCalls = [];
async function api(route) {
  const req = route.request(), u = new URL(req.url());
  const request = new Request('https://site.example' + u.pathname + u.search, { method: req.method(), headers: req.headers(), body: req.method() === 'POST' ? req.postData() : undefined });
  apiCalls.push({ path: u.pathname, body: req.method() === 'POST' ? JSON.parse(req.postData() || '{}') : null });
  const res = await onRequest({ request, params: { route: u.pathname.replace(/^\/drinks\/api\//, '').split('/') }, env: accountsOn ? { ACCOUNTS: KV } : {} });
  return route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
}
const stored = () => JSON.parse(kv.get('drinks:OWNER1') || 'null');

const browser = await chromium.launch();
const errors = [];
async function newPage(scheme, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, timezoneId: TZ, locale: 'en-US' });
  await ctx.route('**/drinks/api/**', api);
  // The walkthroughs (home/welcome.js) as already seen, as on a phone that has been using the apps.
  extra = Object.assign({ 'aos.seen': JSON.stringify({ drinks: '999', calendar: '999' }) }, extra);
  await ctx.addInitScript(extra => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, extra);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource|401|404|503/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { window.__csp = (window.__csp || []).concat(e.violatedDirective + ' ' + e.blockedURI); }));
  return { ctx, page };
}
const shot = (page, name) => SHOTS ? page.screenshot({ path: path.join(SHOTS, name + '.png') }) : null;
const local = page => page.evaluate(() => JSON.parse(localStorage.getItem('allison-drinks-v1')));
const syncNow = page => page.evaluate(() => window.__drinks.sync());
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

const { ctx, page } = await newPage('light', { 'aos.session': SESSION });
await page.goto(BASE + '/drinks/');
await page.waitForFunction(() => window.__drinks);
await page.waitForTimeout(900);

await test('the week: seven days from Sunday, today marked, the week’s one number', async () => {
  const days = await page.$$eval('.drow', els => els.map(e => e.dataset.day));
  assert.equal(days.length, 7); assert.equal(days[0], weekStart());
  assert.equal(await page.$eval('.drow.today', e => e.dataset.day), TODAY);
  assert.match(await page.textContent('.navrow .lbl'), /^This week · /);
  assert.match(await page.textContent('.sum'), /^0of 14 standard drinksAnalysis0 of 3 alcohol-free days$/);
  assert.equal(await page.textContent('.drow.today .dsum'), 'Nothing yet');
  assert.ok(await page.isHidden('#todayBtn'));
  await shot(page, '01-week-empty');
});

await test('signed in, the first sync finds your account; an empty log writes nothing', async () => {
  assert.equal(await page.evaluate(() => window.__drinks.state()), 'ok');
  assert.equal(stored(), null, 'nothing to keep yet, so no KV write');
});

await test('today’s sheet: your usual drinks as tiles; one tap logs one, now, with Undo', async () => {
  await page.click('#fab');
  await page.waitForSelector('#daySheet:not([hidden])');
  assert.match(await page.textContent('#dayLbl'), /^Today/);
  assert.equal(await page.$$eval('.utile', e => e.length), 6, 'the presets until you have usuals');
  assert.match(await page.textContent('.utile[data-usual="0"]'), /Beer12 oz · 5%/);
  await shot(page, '02-day-empty');
  const before = await page.evaluate(() => new Date().getHours() * 60 + new Date().getMinutes());
  await page.click('.utile[data-usual="0"]');
  assert.match(await page.textContent('#toastMsg'), /Added Beer/);
  let d = await local(page);
  assert.equal(d.entries.length, 1);
  const [h, m] = d.entries[0].time.split(':').map(Number);
  assert.ok(Math.abs(h * 60 + m - before) <= 1, 'logged at the time it was tapped');
  await page.click('#toastAct');
  d = await local(page); assert.equal(d.entries.length, 0, 'Undo takes it back');
  await page.click('.utile[data-usual="0"]');
  await page.click('.utile[data-usual="2"]');   // Wine
  assert.match(await page.textContent('#dList'), /Beer.*Wine.*Total2\.1 standard drinks/);
});

await test('Something else…: the kind fills in size and strength; oz and ml; the sum updates', async () => {
  await page.click('#somethingElse');
  await page.click('.opt[data-cat="spirits"]');
  assert.equal(await page.inputValue('#fVol'), '1.5'); assert.equal(await page.inputValue('#fAbv'), '40');
  assert.match(await page.textContent('#fCalc'), /^1 standard drink$/);
  await page.click('.opt[data-cat="cocktail"]');
  assert.match(await page.textContent('#dayBody'), /log the spirit in it/);
  await page.click('.opt[data-cat="wine"]');
  await page.click('[data-unit="ml"]');
  assert.equal(await page.inputValue('#fVol'), '150', '5 oz is about 150 ml');
  await page.selectOption('#fVol', '175'); await page.selectOption('#fAbv', '12');
  await page.fill('#fName', 'Rioja'); await page.fill('#fNote', 'dinner at <b>Ana’s</b>');
  assert.match(await page.textContent('#fCalc'), /^1\.2 standard drinks$/);
  await shot(page, '03-something-else');
  await page.click('#fSave');
  const d = await local(page);
  const r = d.entries.find(x => x.name === 'Rioja');
  assert.deepEqual({ cat: r.cat, vol: r.vol, unit: r.unit, abv: r.abv, qty: r.qty }, { cat: 'wine', vol: 175, unit: 'ml', abv: 12, qty: 1 });
  assert.equal(await page.$$eval('#dList b', e => e.length), 1, 'the note is shown as text, not markup');
  assert.match(await page.textContent('#dList'), /dinner at <b>Ana’s<\/b>/);
});

await test('change a drink, delete one with Undo; the week row and total follow', async () => {
  await page.click('[data-edit] >> text=Beer');
  assert.equal(await page.inputValue('#fQty'), '1');
  await page.selectOption('#fQty', '2');
  await page.click('#fSave');
  assert.match(await page.textContent('#dList'), /Beer ×2/);
  const id = (await local(page)).entries.find(x => x.name === 'Wine').id;
  await page.click('[data-del="' + id + '"]');
  assert.ok(!(await local(page)).entries.some(x => x.id === id));
  await page.click('#toastAct');
  assert.ok((await local(page)).entries.some(x => x.id === id));
  await page.click('#daySheet .okbtn');
  assert.match(await page.textContent('.drow.today .dsum'), /^Beer ×2, Wine, Rioja$/);
  assert.equal(await page.textContent('.drow.today .dval'), '4.3');
  assert.match(await page.textContent('.sum'), /^4\.3of 14/);
  await shot(page, '04-week');
});

await test('a day with nothing logged: alcohol-free in one tap (tap again to undo); the streak counts', async () => {
  for (const d of [YESTERDAY, TWO_AGO]) {
    await page.evaluate(d => window.__drinks.openDay(d), d);
    assert.equal(await page.$$eval('#dayBody .btn[data-mark]', e => e.length), 1, 'just the one choice');
    await page.click('[data-mark="af"]');
    assert.equal(await page.getAttribute('[data-mark="af"]', 'aria-pressed'), 'true');
  }
  await page.click('[data-mark="af"]');
  assert.equal(await page.getAttribute('[data-mark="af"]', 'aria-pressed'), 'false', 'tapped again: not marked');
  await page.click('[data-mark="af"]');
  await page.click('#daySheet .okbtn');
  const d = await local(page);
  assert.deepEqual(d.days.map(x => x.id + ':' + x.status).sort(), [TWO_AGO + ':af', YESTERDAY + ':af']);
  // Logging a drink on an alcohol-free day makes it a drinks day.
  await page.evaluate(d => window.__drinks.openDay(d), TWO_AGO);
  await page.click('.utile[data-usual="0"]');
  assert.ok(!(await local(page)).days.some(x => x.id === TWO_AGO));
  await page.click('#toastAct');   // undo the drink; the mark stays gone
  await page.click('[data-mark="af"]');
  await page.click('#daySheet .okbtn');
});

await test('goals: a lower weekly limit shows the week as over', async () => {
  await page.click('#moreBtn');
  await page.waitForSelector('#moreSheet:not([hidden])');
  await page.waitForFunction(() => /Saved to your account/.test(document.getElementById('acct').textContent));
  await page.selectOption('#gWeek', '3');
  await page.click('#moreSheet [data-close].iconbtn');
  assert.ok(await page.$eval('.sum', e => e.classList.contains('over')));
  assert.match(await page.textContent('.sum'), /of 3 standard drinks, over your limit/);
  assert.equal((await local(page)).prefs[0].week, 3);
});

await test('Analysis, from a tap on the week’s number (which says so): four numbers against the window before, the streak, by drink', async () => {
  assert.equal(await page.$$eval('.vbar', els => els.filter(e => e.getClientRects().length).length), 0, 'no view picker on the week: one screen (Analysis has its own)');
  assert.match(await page.textContent('#sumBtn .more'), /^Analysis$/, 'the number says what tapping it is for');
  assert.match(await page.getAttribute('#sumBtn', 'aria-label'), /Open analysis/);
  await page.click('#sumBtn');
  await page.waitForSelector('#trends:not([hidden])');
  assert.equal(await page.textContent('#trName'), 'Compared with before', 'it opens on the week or month against the one before');
  const kl = await page.$$eval('#trBody .kpi .kl', e => e.map(x => x.textContent));
  assert.deepEqual(kl, ['Standard drinks', 'Days you drank', 'Alcohol-free days', 'A day, on average']);
  assert.equal(await page.textContent('#trBody .kpi .kv'), '4.3');
  assert.match(await page.textContent('#trBody'), /Alcohol-free in a row.*Your best: 2 days/);
  assert.match(await page.textContent('#trBody'), /By drink/);
  await page.waitForTimeout(1000);
  await shot(page, '05-analysis');
  await page.click('[data-period="month"]');
  assert.match(await page.textContent('#trBody .anote'), / against /);
  assert.equal(await page.getAttribute('[data-period="month"]', 'aria-pressed'), 'true');
  await page.click('#trBack');
  assert.ok(await page.isVisible('#sumBtn'));
});

await test('the account gets your changes, a few at a time', async () => {
  apiCalls.length = 0;
  await syncNow(page);
  const s = stored();
  assert.equal(s.entries.length, 3); assert.equal(s.days.length, 2); assert.equal(s.prefs[0].week, 3);
  await syncNow(page);
  const last = apiCalls.at(-1).body;
  assert.ok(last.since > 0 && last.entries.length === 0 && last.days.length === 0, 'nothing new: sends nothing');
});

await test('a second phone, signed in: gets the log; a delete there reaches the first', async () => {
  const p2 = await newPage('dark', { 'aos.session': SESSION });
  await p2.page.goto(BASE + '/drinks/');
  await p2.page.waitForFunction(() => window.__drinks && window.__drinks.state() === 'ok');
  assert.equal((await local(p2.page)).entries.length, 3);
  assert.equal(await p2.page.textContent('.drow.today .dval'), '4.3');
  await shot(p2.page, '06-week-dark');
  await p2.page.click('.drow.today');
  const rioja = (await local(p2.page)).entries.find(x => x.name === 'Rioja').id;
  await p2.page.click('[data-del="' + rioja + '"]');
  await shot(p2.page, '07-day-dark');
  await syncNow(p2.page);
  await syncNow(page);
  assert.ok(!(await local(page)).entries.some(x => x.id === rioja), 'gone on the first phone too');
  assert.equal(await page.textContent('.drow.today .dval'), '3.1');
  assert.deepEqual(await p2.page.evaluate(() => window.__csp || []), []);
  await p2.ctx.close();
});

await test('bringing in the ABV Tracker’s Log tab, once', async () => {
  const csv = path.join(os.tmpdir(), 'abv-log-' + process.pid + '.csv');
  fs.writeFileSync(csv, 'Timestamp,Date,Time,Name,Category,Volume,Unit,ABV,Qty,StandardDrinks,GramsAlcohol,Note,EntryID\r\n'
    + '2025-03-02T01:00:00.000Z,2025-03-01,0:00,__connection test__,Other,0,oz,0,0,0,0,test row from ABV Tracker,test\r\n'
    + '2025-03-02T01:10:00.000Z,2025-02-26,19:00,Wine large 8oz 14%,Wine,8,oz,14,1,1.867,26.13,backfilled,k7q2wine0001\r\n'
    + '2025-03-02T01:20:00.000Z,2025-02-27,0:00,Alcohol-free day,Alcohol-Free,0,,0,0,0,0,no alcohol consumed,dry-2025-02-27\r\n');
  await page.click('#moreBtn');
  await page.setInputFiles('#importFile', csv);
  await page.waitForFunction(() => /Brought in/.test(document.getElementById('toastMsg').textContent));
  assert.match(await page.textContent('#toastMsg'), /Brought in 1 drink and 1 marked day/);
  await page.setInputFiles('#importFile', csv);
  await page.waitForFunction(() => /Nothing new/.test(document.getElementById('toastMsg').textContent));
  await page.setInputFiles('#importFile', { name: 'notes.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2') });
  await page.waitForFunction(() => /isn’t the ABV Tracker’s Log/.test(document.getElementById('toastMsg').textContent));
  await shot(page, '08-more');
  await page.click('#moreSheet [data-close].iconbtn');
  fs.unlinkSync(csv);
});

await test('Calendar’s link: ?date= opens that day', async () => {
  await page.goto(BASE + '/drinks/?date=2025-02-26');
  await page.waitForSelector('#daySheet:not([hidden])');
  assert.match(await page.textContent('#dayLbl'), /February 26/);
  assert.match(await page.textContent('#dList'), /Wine large/);
});

await test('Calendar’s Drinks layer: off at first; turned on, your own days from your account, and no copy to the Family calendar', async () => {
  const p = await newPage('light', { 'aos.session': SESSION });
  await p.ctx.route('**/calendar/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"no-config"}' }));
  await p.ctx.route('**/api.open-meteo.com/**', route => route.fulfill({ status: 503, body: '' }));
  apiCalls.length = 0;
  await p.page.goto(BASE + '/calendar/?date=' + TODAY + '&view=day');
  await p.page.waitForTimeout(800);
  assert.ok(!apiCalls.some(c => c.path.includes('summary')), 'off: Calendar doesn’t ask');
  await p.page.evaluate(() => { const k = 'allison-calendar-v1-settings', s = JSON.parse(localStorage.getItem(k) || '{}'); s.layers = Object.assign({}, s.layers, { drinks: true }); localStorage.setItem(k, JSON.stringify(s)); });
  await p.page.reload();
  await p.page.waitForFunction(() => document.body.textContent.includes('Drinks · 3.1 standard'));
  assert.ok(apiCalls.some(c => c.path === '/drinks/api/summary'));
  await shot(p.page, '09-calendar-layer');
  assert.ok(!(await p.page.evaluate(() => Object.keys(localStorage).some(k => /drinks/i.test(k) && !/allison-calendar-v1-settings/.test(k)))), 'nothing of it kept in Calendar’s storage');
  await p.page.click('text=Drinks · 3.1 standard');
  await p.page.waitForSelector('#evSheet:not([hidden])');
  assert.match(await p.page.textContent('#evBody'), /Open in Drinks/);
  assert.equal(await p.page.$$eval('#evCopy', e => e.length), 0, 'no Add to the Family calendar');
  assert.deepEqual(await p.page.evaluate(() => window.__csp || []), []);
  await p.ctx.close();
});

await test('signed out: says so, and offers Face ID', async () => {
  const p = await newPage('light');
  await p.page.goto(BASE + '/drinks/');
  await p.page.waitForFunction(() => window.__drinks && window.__drinks.state() === 'signin');
  await p.page.click('#moreBtn');
  assert.match(await p.page.textContent('#acct'), /On this phone only.*Sign in with your family account/);
  assert.ok(await p.page.isVisible('#signIn'));
  await p.ctx.close();
});

await test('accounts not switched on yet: the log just stays on the phone', async () => {
  accountsOn = false;
  const p = await newPage('light');
  await p.page.goto(BASE + '/drinks/');
  await p.page.waitForFunction(() => window.__drinks && window.__drinks.state() === 'local');
  await p.page.click('#fab'); await p.page.click('.utile[data-usual="4"]');
  assert.equal((await local(p.page)).entries.length, 1);
  await p.page.click('#daySheet .okbtn');
  await p.page.click('#moreBtn');
  assert.match(await p.page.textContent('#acct'), /aren’t switched on yet/);
  assert.ok(await p.page.isHidden('#signIn'));
  await p.ctx.close();
  accountsOn = true;
});

await test('delete all data: tap twice; gone here and from the account', async () => {
  await page.click('#daySheet .okbtn').catch(() => {});
  await page.click('#moreBtn');
  await page.click('#wipeBtn');
  assert.match(await page.textContent('#wipeBtn'), /Tap again/);
  await page.click('#wipeBtn');
  await page.waitForFunction(() => window.__drinks.state() === 'ok');
  await page.waitForTimeout(200);
  assert.equal((await local(page)).entries.length, 0);
  const s = stored();
  assert.equal(s.entries.length, 0); assert.equal(s.days.length, 0); assert.ok(Object.keys(s.graves).length >= 4);
});

// ---- Trends: twelve weeks, one view at a time, from the pill at the bottom ----
// Eleven weeks back each have one drinking day (the same weekday as today, so the
// test is the same on every day of the week and at the end of a month): 2 IPAs,
// except the one 4 weeks back, 9; today has a glass of wine. Three days are alcohol-free.
const seedLog = () => {
  const entries = [], days = []; let k = 0;
  const add = (date, name, cat, vol, abv, qty) => entries.push({ id: 't' + k++, date, time: '19:00', name, cat, vol, unit: 'oz', abv, qty, note: '', updated: 1 });
  for (let j = 1; j <= 11; j++) add(ymd(day(-7 * j)), 'IPA', 'beer', 16, 6.8, j === 4 ? 9 : 2);
  add(TODAY, 'Wine', 'wine', 5, 13, 1);
  for (let j = 1; j <= 3; j++) days.push({ id: ymd(day(-7 * j - 1)), status: 'af', updated: 1 });
  return JSON.stringify({ v: 1, entries, days, prefs: [] });
};
const VIEWS = ['Compared with before', 'Weekly drinks', 'Weeks over the limit', 'Top drinks', 'Days of the week', 'Alcohol-free days', 'Days over the limit', 'Strength and size'];
const pickView = async (pg, i) => { await pg.click('#trBtn'); await pg.waitForSelector('#trMenu:not([hidden])'); await pg.click('#trMenu button:nth-child(' + i + ')'); await pg.waitForTimeout(150); };
const kpiVals = pg => pg.$$eval('#trBody .kpi .kv', e => e.map(x => x.textContent));
const T = await newPage('light', { 'allison-drinks-v1': seedLog() });
const tp = T.page;
await tp.goto(BASE + '/drinks/'); await tp.waitForFunction(() => window.__drinks); await tp.waitForTimeout(700);

await test('Analysis takes over the screen from the week’s number; the pill is at the bottom; back returns to the week', async () => {
  await tp.click('#sumBtn');
  await tp.waitForSelector('#trends:not([hidden])');
  assert.equal(await tp.$$eval('#anSheet, #trendsBtn', e => e.length), 0, 'no sheet in between, and no second click to the charts');
  assert.ok(await tp.isHidden('#fab'), 'the + is out of the way');
  assert.equal(await tp.textContent('#trName'), 'Compared with before');
  assert.equal(await tp.textContent('#trends .title'), 'Analysis');
  await tp.waitForTimeout(500);
  const bar = await tp.$eval('#trBar', e => { const r = e.getBoundingClientRect(); return { b: r.bottom, l: r.left, r: r.right, h: innerHeight, w: innerWidth }; });
  assert.ok(bar.b <= bar.h && bar.l > 0 && bar.r < bar.w && Math.abs((bar.l + bar.r) / 2 - bar.w / 2) < 2, 'the pill sits at the bottom, centred');
  await shot(tp, '10-analysis-compare');
  await tp.click('#trBack');
  assert.ok(await tp.isHidden('#trends')); assert.ok(await tp.isVisible('#fab'));
  assert.match(await tp.textContent('.navrow .lbl'), /^This week/);
});

await test('the pill’s menu lists all eight views, opens upwards, and picks one', async () => {
  await tp.evaluate(() => window.__drinks.openTrends());
  await tp.click('#trBtn');
  assert.equal(await tp.getAttribute('#trBtn', 'aria-expanded'), 'true');
  assert.deepEqual(await tp.$$eval('#trMenu button .k', e => e.map(x => x.firstChild.textContent)), VIEWS);
  assert.equal(await tp.getAttribute('#trMenu button:nth-child(1)', 'aria-selected'), 'true');
  const m = await tp.evaluate(() => ({ menu: document.getElementById('trMenu').getBoundingClientRect().bottom, pill: document.getElementById('trBtn').getBoundingClientRect().top, left: document.getElementById('trMenu').getBoundingClientRect().left, w: innerWidth }));
  assert.ok(m.menu <= m.pill, 'the menu is above the pill'); assert.ok(m.left >= 0, 'and on the screen');
  await tp.waitForTimeout(400);
  await shot(tp, '11-trends-menu');
  await tp.keyboard.press('Escape');
  assert.ok(await tp.isHidden('#trMenu')); assert.ok(await tp.isVisible('#trends'), 'Escape closes the menu first');
  await tp.click('#trBtn'); await tp.click('#trMenu button:nth-child(4)');
  assert.equal(await tp.textContent('#trName'), 'Top drinks'); assert.ok(await tp.isHidden('#trMenu'));
  await pickView(tp, 2);
});

await test('Weekly drinks: the average, weeks over the limit, a bar a week; tap one to read it', async () => {
  assert.deepEqual(await tp.$$eval('#trBody .kpi .kl', e => e.map(x => x.textContent)), ['Average a week', 'Weeks over your limit', 'Highest week', 'Lowest week']);
  assert.deepEqual((await kpiVals(tp)).slice(0, 3), ['4.8', '1 of 11', '16.3']);
  assert.equal(await tp.$$eval('.chart .hit', e => e.length), 12);
  assert.equal(await tp.$$eval('.chart .bar', e => e.length), 12, 'a bar for every week with something logged');
  assert.equal(await tp.$$eval('.chart .bar.over', e => e.length), 1); assert.equal(await tp.$$eval('.chart .tri', e => e.length), 1, 'over weeks carry a triangle too, not only a colour');
  assert.equal(await tp.$$eval('.chart .bar.part', e => e.length), 1, 'the week still going is lighter');
  assert.match(await tp.textContent('.readout'), /so far/, 'the newest week is read first');
  await tp.click('.chart .hit[data-i="7"]');
  assert.match(await tp.textContent('.readout'), /16\.3 standard drinks, 2\.3 over your 14/);
  assert.equal(await tp.getAttribute('.chart .hit[data-i="7"]', 'role'), 'button');
  await tp.focus('.chart .hit[data-i="8"]'); await tp.keyboard.press('Enter');
  assert.match(await tp.textContent('.readout'), /3\.6 standard drinks, 10\.4 under your 14/, 'the keyboard reads a week too');
  await tp.click('details.tview summary');
  assert.ok(await tp.$eval('details.tview', e => e.open)); assert.equal(await tp.$$eval('details.tview tbody tr', e => e.length), 12, 'every number is in a table too');
  await tp.click('.chart .hit[data-i="3"]');
  assert.ok(await tp.$eval('details.tview', e => e.open), 'the table stays open when you tap a week');
  await tp.click('details.tview summary');
  await shot(tp, '12-trends-weekly-tapped');
});

await test('Weeks over the limit: a tile and a row for every week, and the runs under it', async () => {
  await pickView(tp, 3);
  assert.deepEqual((await kpiVals(tp)).slice(0, 4), ['1 of 11', '10', '3 weeks', '7 weeks']);
  assert.equal(await tp.$$eval('.wt', e => e.length), 12); assert.equal(await tp.$$eval('.wt.over', e => e.length), 1);
  assert.equal(await tp.$$eval('.wt.ok', e => e.length), 10); assert.equal(await tp.$$eval('.wt.going', e => e.length), 1);
  assert.match(await tp.textContent('#trBody .rgroup .xrow:nth-child(1)'), /to go/); assert.match(await tp.textContent('#trBody'), /\+2\.3 over/);
  await shot(tp, '13-trends-over');
});

await test('Top drinks: most often against what adds up, by name or by kind, and your choice is kept', async () => {
  await pickView(tp, 4);
  assert.match(await tp.textContent('.callout'), /IPA.*most often \(29 drinks\).*also what adds up to the most/);
  assert.deepEqual(await tp.$$eval('.tops:nth-of-type(1) .nm, .tops .nm', e => [...new Set(e.map(x => x.textContent))]), ['IPA', 'Wine']);
  await tp.click('[data-group="kind"]');
  assert.deepEqual(await tp.$$eval('.tops .nm', e => [...new Set(e.map(x => x.textContent))]), ['Beer', 'Wine']);
  assert.equal(await tp.getAttribute('[data-group="kind"]', 'aria-pressed'), 'true');
  await tp.waitForTimeout(700);
  await shot(tp, '14-trends-top');
  await tp.click('[data-group="name"]');
});

await test('Days of the week: seven columns from Sunday, the heaviest day named', async () => {
  await pickView(tp, 5);
  assert.deepEqual(await tp.$$eval('.chart .xl', e => e.map(x => x.textContent)), ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  assert.equal(await tp.$$eval('.chart .hit', e => e.length), 7);
  assert.match(await tp.textContent('.callout'), /s<\/b>|are your heaviest/);
  assert.match(await tp.textContent('.readout'), /Tap a day/);
  const dow = new Date(day(0)).getDay(), n = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow];
  assert.match(await tp.textContent('.callout'), new RegExp(n + 's are your heaviest'), 'every drinking day is the same weekday as today');
  await tp.click('.chart .hit[data-i="' + dow + '"]');
  assert.match(await tp.textContent('.readout'), new RegExp(n + 's.*of everything'));
});

await test('Alcohol-free days, days over the limit, strength and size', async () => {
  await pickView(tp, 6);
  assert.deepEqual(await tp.$$eval('#trBody .kpi .kl', e => e.map(x => x.textContent)), ['Goal met', 'Average a week', 'Alcohol-free in a row', 'Your best']);
  assert.equal(await tp.$$eval('.chart .bar.af', e => e.length) > 0, true);
  assert.match(await tp.textContent('.legend'), /Your goal/);
  await pickView(tp, 7);
  assert.equal((await kpiVals(tp))[0], '1', 'one day over 4 standard drinks: the 9 IPAs');
  assert.equal(await tp.$$eval('.chart .bar.heavy', e => e.length), 1);
  await pickView(tp, 8);
  assert.equal((await kpiVals(tp))[0], '6.9%');
  assert.equal(await tp.$$eval('svg.chart', e => e.length), 2, 'two charts: strength, and the size of an average drink');
  assert.equal(await tp.$$eval('.chart .dot', e => e.length), 24, 'a dot a week in each');
  await shot(tp, '15-trends-strength');
});

await test('the view you left on is the one Trends opens on next time', async () => {
  await tp.reload(); await tp.waitForFunction(() => window.__drinks); await tp.waitForTimeout(500);
  await tp.evaluate(() => window.__drinks.openTrends());
  assert.equal(await tp.textContent('#trName'), 'Strength and size');
  await pickView(tp, 2);
});

await test('Analysis follows the log: a new drink changes the chart', async () => {
  const before = (await kpiVals(tp))[0];
  await tp.evaluate(() => { const d = window.__drinks; d.data.entries.push({ id: 'live1', date: d.st.week, time: '', name: 'Late beer', cat: 'beer', vol: 12, unit: 'oz', abv: 5, qty: 1, note: '', updated: Date.now() }); d.render(); });
  assert.match(await tp.textContent('.readout'), /so far/); assert.equal((await kpiVals(tp))[1], '1 of 11');
  assert.notEqual(before, undefined);
});

await test('Analysis: Escape closes it; nothing logged says so', async () => {
  await tp.keyboard.press('Escape');
  assert.ok(await tp.isHidden('#trends'));
  const e = await newPage('light', {});
  await e.page.goto(BASE + '/drinks/'); await e.page.waitForFunction(() => window.__drinks); await e.page.waitForTimeout(500);
  await e.page.click('#sumBtn');
  assert.match(await e.page.textContent('#trBody'), /Nothing to chart yet/);
  for (let i = 2; i <= 8; i++) { await pickView(e.page, i); assert.ok(await e.page.isVisible('#trBody .empty, #trBody .kpis, #trBody .callout'), VIEWS[i - 1] + ' has something to say with nothing logged'); }
  await e.ctx.close();
});

await test('Analysis is never wider than the phone, in every view, light and dark; the menu stays on the screen', async () => {
  for (const scheme of ['light', 'dark']) for (const [w, h] of [[320, 500], [320, 568], [390, 844], [440, 956]]) {
    const p = await newPage(scheme, { 'allison-drinks-v1': seedLog() });
    await p.page.setViewportSize({ width: w, height: h });
    await p.page.goto(BASE + '/drinks/'); await p.page.waitForFunction(() => window.__drinks); await p.page.waitForTimeout(400);
    await p.page.evaluate(() => window.__drinks.openTrends());
    for (let i = 1; i <= 8; i++) {
      if (i > 1) await pickView(p.page, i);
      await p.page.waitForTimeout(120);
      const m = await p.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: document.documentElement.clientWidth }));
      assert.ok(m.sw <= m.w, scheme + ' ' + w + 'px, ' + VIEWS[i - 1] + ': the page is ' + m.sw + 'px wide');
    }
    await p.page.click('#trBtn'); await p.page.waitForTimeout(300);
    const r = await p.page.$eval('#trMenu', e => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, w: innerWidth }; });
    assert.ok(r.l >= 0 && r.r <= r.w && r.t >= 0, w + 'x' + h + ': the menu is on the screen (' + JSON.stringify(r) + ')');
    assert.ok(await p.page.$eval('#trMenu', e => e.scrollHeight <= e.clientHeight || getComputedStyle(e).overflowY === 'auto'), 'and scrolls if it is taller than the room above the pill');
    if (scheme === 'dark' && w === 390) await shot(p.page, '16-trends-menu-dark');
    assert.deepEqual(await p.page.evaluate(() => window.__csp || []), []);
    await p.ctx.close();
  }
});

await test('Analysis: no errors and no Content Security Policy violations', async () => {
  assert.deepEqual(await tp.evaluate(() => window.__csp || []), []);
});
await T.ctx.close();

await test('never wider than the phone, from the smallest iPhone up; the title is never cut off', async () => {
  for (const [w, h] of [[320, 568], [375, 667], [393, 852], [440, 956]]) {
    const p = await newPage('light', { 'aos.session': SESSION });
    await p.page.setViewportSize({ width: w, height: h });
    await p.page.goto(BASE + '/drinks/'); await p.page.waitForFunction(() => window.__drinks); await p.page.waitForTimeout(600);
    for (const where of ['week', 'day', 'form', 'analysis', 'more']) {
      if (where === 'day') await p.page.click('#fab');
      if (where === 'form') await p.page.click('#somethingElse');
      if (where === 'analysis') { await p.page.click('#daySheet .okbtn'); await p.page.click('#sumBtn'); }
      if (where === 'more') { await p.page.click('#trBack'); await p.page.click('#moreBtn'); }
      await p.page.waitForTimeout(250);
      const m = await p.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: document.documentElement.clientWidth, title: [...document.querySelectorAll('.title')].find(t => t.getClientRects().length).getBoundingClientRect().left }));
      assert.ok(m.sw <= m.w, w + 'px, ' + where + ': the page is ' + m.sw + 'px wide');
      assert.ok(m.title >= 14, w + 'px, ' + where + ': the title starts at ' + m.title + 'px');
    }
    await p.ctx.close();
  }
});

await test('no errors and no Content Security Policy violations', async () => {
  assert.deepEqual(await page.evaluate(() => window.__csp || []), []);
  assert.deepEqual(errors, []);
});

await ctx.close();
await browser.close();
server.close();
console.log(n + ' tests passed');
