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
const weekStart = () => { const d = day(0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return ymd(d); };

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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, timezoneId: TZ, locale: 'en-GB' });
  await ctx.route('**/drinks/api/**', api);
  // The walkthroughs (home/welcome.js) as already seen, as on a phone that has been using the apps.
  extra = Object.assign({ 'aos.seen': JSON.stringify({ drinks: '1', calendar: '1' }) }, extra);
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

await test('the week: seven days from Monday, today marked, the week’s one number', async () => {
  const days = await page.$$eval('.drow', els => els.map(e => e.dataset.day));
  assert.equal(days.length, 7); assert.equal(days[0], weekStart());
  assert.equal(await page.$eval('.drow.today', e => e.dataset.day), TODAY);
  assert.match(await page.textContent('.navrow .lbl'), /^This week · /);
  assert.match(await page.textContent('.sum'), /^0of 14 standard drinks0 of 3 alcohol-free days$/);
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

await test('a day with nothing logged: alcohol-free or don’t remember, in one tap; the streak counts', async () => {
  for (const d of [YESTERDAY, TWO_AGO]) {
    await page.evaluate(d => window.__drinks.openDay(d), d);
    await page.click('[data-mark="af"]');
    assert.equal(await page.getAttribute('[data-mark="af"]', 'aria-pressed'), 'true');
  }
  await page.click('[data-mark="unknown"]');
  assert.equal(await page.getAttribute('[data-mark="af"]', 'aria-pressed'), 'false', 'one or the other');
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

await test('Analysis: four numbers against the window before, the streak, by drink', async () => {
  await page.click('#viewBtn');
  await page.click('[data-view="analysis"]');
  const kl = await page.$$eval('.kpi .kl', e => e.map(x => x.textContent));
  assert.deepEqual(kl, ['Standard drinks', 'Days you drank', 'Alcohol-free days', 'A day, on average']);
  assert.equal(await page.textContent('.kpi .kv'), '4.3');
  assert.match(await page.textContent('main'), /Alcohol-free in a row.*Your best: 2 days/);
  assert.match(await page.textContent('main'), /By drink/);
  await page.waitForTimeout(1000);
  await shot(page, '05-analysis');
  await page.click('[data-period="month"]');
  assert.match(await page.textContent('.anote'), / against /);
  await page.click('#viewBtn'); await page.click('[data-view="week"]');
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
  assert.match(await page.textContent('#dayLbl'), /26 February/);
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

await test('no errors and no Content Security Policy violations', async () => {
  assert.deepEqual(await page.evaluate(() => window.__csp || []), []);
  assert.deepEqual(errors, []);
});

await ctx.close();
await browser.close();
server.close();
console.log(n + ' tests passed');
