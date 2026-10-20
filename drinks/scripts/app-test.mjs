// Drives the Drinks app in headless Chromium at iPhone size: the week and its
// one number, a day's sheet, logging a usual drink in one tap (with Undo),
// "Something else…" (kind fills in size and strength, oz and ml), changing
// and deleting a drink, alcohol-free and don't-remember days, the streak,
// goals, Analysis, bringing in the ABV Tracker's Log, the ?date= link, and the
// family's Google Sheet end to end: the real google-sheet-sync.gs on an
// in-memory Sheet (fake-sheet.mjs), reached through aOS (functions/sheet/api,
// stood in for here, each phone's session saying who's asking): two phones kept
// in step, a delete travelling between them, another person's phone getting
// none of it, the 90 days kept on the phone and older weeks fetched when you
// look back, the Log tab both ways, the old link and phrase handed to aOS,
// signed out, the Sheet not set up yet; and Calendar's Drinks layer through the
// real functions/drinks/api route (on an in-memory Workers KV with real
// sessions), which asks the same Sheet. No phone talks to Google itself.
// Also dark mode, and that nothing trips the page's Content Security Policy.
// Both designs (../home/design.js): Vintage, the default, drawn in the Retro look
// (the sky held at day, aos.sky), and Standard (Sea glass); More > Design switches
// between them at once and keeps the choice; and the old Drinks Vintage address
// (served from drinks/, as the deploy does) moves that app's data on the phone over
// to Drinks' names, and syncs with Drinks' Sheet.
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
  p = p.replace(/^\/drinksvintage\//, '/drinks/');   // the old Drinks Vintage address: the deploy copies drinks/ there (news.yml)
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
await KV.put('owner', 'OWNER1');
await putJSON(KV, 'user:OWNER1', { id: 'OWNER1', name: 'Tom', role: 'owner', creds: [] });
const TOKEN = await issue(KV, 'OWNER1');
const SESSION = JSON.stringify({ token: TOKEN, user: { id: 'OWNER1', name: 'Tom', role: 'owner' }, at: Date.now() });
const apiCalls = [];
async function api(route) {
  const req = route.request(), u = new URL(req.url());
  const request = new Request('https://site.example' + u.pathname + u.search, { method: req.method(), headers: req.headers(), body: req.method() === 'POST' ? req.postData() : undefined });
  apiCalls.push({ path: u.pathname, body: req.method() === 'POST' ? JSON.parse(req.postData() || '{}') : null });
  const res = await onRequest({ request, params: { route: u.pathname.replace(/^\/drinks\/api\//, '').split('/') }, env: { ACCOUNTS: KV } });
  return route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
}

// ---- the family's Google Sheet: the real Apps Script, on an in-memory Sheet, reached through aOS
// (functions/sheet/api, stood in for here): each phone's session says who's asking ----
const SHEET_URL = 'https://script.google.com/macros/s/TEST/exec', SECRET = 'test-secret-phrase';
const sheet = fakeSheet(undefined, SECRET);
const sheetCalls = [], claims = [], google = [];
let sheetOn = true, slowNoSheet = false;
await putJSON(KV, 'user:KID1', { id: 'KID1', name: 'Sam', role: 'member', creds: [] });
const SAM_TOKEN = await issue(KV, 'KID1');
const SAM_SESSION = JSON.stringify({ token: SAM_TOKEN, user: { id: 'KID1', name: 'Sam', role: 'member' }, at: Date.now() });
const PEOPLE = { [TOKEN]: { id: 'OWNER1', name: 'Tom', role: 'owner' }, [SAM_TOKEN]: { id: 'KID1', name: 'Sam', role: 'member' } };
const asked = who => ({ key: SECRET, who: who.id, name: who.name, ...(who.role === 'owner' ? { owner: '1' } : {}) });
const TOMQ = asked(PEOPLE[TOKEN]), SAMQ = asked(PEOPLE[SAM_TOKEN]);
async function sheetApi(route) {
  if (!sheetOn && slowNoSheet) await new Promise(r => setTimeout(r, 4000));   // a sync still on its way
  const req = route.request(), u = new URL(req.url()), who = PEOPLE[(req.headers().authorization || '').replace('Bearer ', '')];
  const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
  if (req.headers()['x-sheet'] !== '1') return json({ error: 'header' }, 400);
  if (!who) return json({ error: 'signin' }, 401);
  if (u.pathname.endsWith('/claim')) { claims.push({ who: who.id, ...JSON.parse(req.postData()) }); return json({ configured: true }); }
  if (req.method() === 'GET') return json({ configured: sheetOn });
  if (!sheetOn) return json({ ok: false, error: 'no-sheet' }, 409);
  sheetCalls.push({ path: u.pathname, who: who.id, body: JSON.parse(req.postData()) });
  return json(sheet.post(req.postData(), asked(who)));
}
// functions/drinks/api asks the same Sheet for Calendar's layer: aOS has its link and phrase, and Google is the fake Sheet
await putJSON(KV, 'config:sheet:drinks', { url: SHEET_URL, secret: SECRET, at: 1 });
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.origin + u.pathname !== SHEET_URL) return realFetch(url, opts);
  return new Response(JSON.stringify(sheet.post(opts.body, Object.fromEntries(u.searchParams))), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
// everything of someone's the Sheet has
const mine = (q = TOMQ) => sheet.post({ action: 'range', from: '1900-01-01', to: '2999-12-31' }, q);
const until = async (fn, what, ms = 8000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('timed out: ' + what); await new Promise(r => setTimeout(r, 100)); } };

const browser = await chromium.launch();
const errors = [];
async function newPage(scheme, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, timezoneId: TZ, locale: 'en-US' });
  await ctx.route('**/drinks/api/**', api);
  await ctx.route('**/sheet/api/**', sheetApi);
  await ctx.route(/^https:\/\/script\.google(usercontent)?\.com\//, route => { google.push(route.request().url()); return route.abort(); });   // no phone talks to Google itself
  // The walkthroughs (home/welcome.js) as already seen, as on a phone that has been using the apps.
  // The sky held at day (home/sky.js), so the Vintage colours don't depend on the hour.
  extra = Object.assign({ 'aos.seen': JSON.stringify({ drinks: '999', calendar: '999' }), 'aos.sky': 'day' }, extra);
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

await test('signed in, the first sync goes to the family’s Sheet through aOS: no link or phrase on the phone, and it keeps 90 days', async () => {
  await page.waitForFunction(() => window.__drinks.state() === 'ok');
  assert.ok(sheetCalls.length >= 1);
  const c = sheetCalls.at(-1);
  assert.deepEqual([c.path, c.who, c.body.action, c.body.window, c.body.today], ['/sheet/api/drinks', 'OWNER1', 'sync', 90, TODAY]);
  assert.ok(sheetCalls.every(x => !('secret' in x.body)), 'the phone sends no phrase');
  assert.ok(await page.evaluate(() => window.__drinks.synced()));
  assert.deepEqual(google, [], 'and never talks to Google itself');
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
  await page.waitForFunction(() => /In the family’s Google Sheet/.test(document.getElementById('acct').textContent));
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

await test('the Sheet gets your changes, each row as yours', async () => {
  await syncNow(page);
  const m = mine();
  assert.equal(m.entries.length, 3); assert.equal(m.days.length, 2);
  assert.equal(sheet.post({ action: 'sync' }, TOMQ).prefs[0].week, 3, 'and your goals');
  const rows = sheet.tab('Log').slice(1);
  assert.equal(rows.length, 5); assert.ok(rows.every(r => r[0] === 'Tom'), 'each row says whose it is');
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
  // someone else's phone gets none of it, and what they log is theirs alone
  const sp = await newPage('light', { 'aos.session': SAM_SESSION });
  await sp.page.goto(BASE + '/drinks/');
  await sp.page.waitForFunction(() => window.__drinks && window.__drinks.state() === 'ok');
  assert.deepEqual((await local(sp.page)).entries, [], 'Sam’s phone gets none of Tom’s');
  await sp.page.click('#fab'); await sp.page.click('.utile[data-usual="5"]'); await sp.page.click('#daySheet .okbtn');
  await syncNow(sp.page);
  assert.equal(mine(SAMQ).entries.length, 1); assert.equal(mine().entries.length, 2, 'Tom’s are still his two');
  await syncNow(page);
  assert.equal((await local(page)).entries.length, 2, 'and Tom’s phone doesn’t get Sam’s');
  await sp.ctx.close();
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
  // older than 90 days: once it's in the Sheet, it goes from the phone, with no grave
  await syncNow(page);
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('allison-drinks-v1')).entries.some(x => x.date === '2025-02-26'));
  assert.ok(mine().entries.some(x => x.date === '2025-02-26' && x.name === 'Wine large'), 'the Sheet has it');
  assert.ok(mine().days.some(x => x.id === '2025-02-27'));
  assert.ok(!Object.keys(await page.evaluate(() => window.__drinks.graves())).some(k => /k7q2wine0001|2025-02-27/.test(k)), 'no grave: the Sheet keeps it');
});

await test('Calendar’s link: ?date= opens that day, from the Sheet when it’s older than the 90 days here', async () => {
  await page.goto(BASE + '/drinks/?date=2025-02-26');
  await page.waitForSelector('#daySheet:not([hidden])');
  assert.match(await page.textContent('#dayLbl'), /February 26/);
  await page.waitForFunction(() => /Wine large/.test((document.getElementById('dList') || {}).textContent || ''));
  assert.ok((await page.evaluate(() => window.__drinks.older())).includes('2025-02-26'), 'fetched for the looking');
});

await test('Calendar’s Drinks layer: off at first; turned on, your own days from the family’s Sheet (functions/drinks/api), and no copy to the Family calendar', async () => {
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

await test('signed out: works on the phone, says so, and offers Face ID; nothing goes to the Sheet', async () => {
  const p = await newPage('light');
  const before = sheetCalls.length;
  await p.page.goto(BASE + '/drinks/');
  await p.page.waitForFunction(() => window.__drinks && window.__drinks.state() === 'signin');
  await p.page.click('#fab'); await p.page.click('.utile[data-usual="4"]'); await p.page.click('#daySheet .okbtn');
  assert.equal((await local(p.page)).entries.length, 1);
  await p.page.click('#moreBtn');
  assert.match(await p.page.textContent('#acct'), /On this phone only.*Sign in with your family account/);
  assert.ok(await p.page.isVisible('#signIn'));
  assert.match(await p.page.textContent('#sheetBtn'), /The family’s Google Sheet\s*Sign in to sync/);
  await p.page.click('#sheetBtn'); await p.page.waitForSelector('#syncSheet:not([hidden])');
  assert.match(await p.page.textContent('#syStatus'), /Sign in to sync with the family’s Google Sheet/);
  assert.equal(await p.page.textContent('#syNow .t'), 'Sign in and sync');
  assert.equal(await p.page.$('#syUrl'), null, 'no link or phrase to type on a phone');
  await p.page.waitForTimeout(2800);
  assert.equal(sheetCalls.length, before, 'nothing sent');
  await p.ctx.close();
});

await test('the owner hasn’t set the Sheet up yet: says so, and the log stays on the phone', async () => {
  sheetOn = false;
  const p = await newPage('light', { 'aos.session': SAM_SESSION, 'allison-drinks-v1-who': 'KID1' });
  await p.page.goto(BASE + '/drinks/');
  await p.page.waitForFunction(() => window.__drinks && window.__drinks.state() === 'error');
  await p.page.click('#fab'); await p.page.click('.utile[data-usual="4"]');
  assert.ok((await local(p.page)).entries.length >= 1);
  slowNoSheet = true;   // More opened while the next sync is still on its way: the last outcome, and why
  await p.page.click('#daySheet .okbtn');
  await p.page.waitForFunction(() => window.__drinks.state() === 'syncing', null, { timeout: 8000 });
  await p.page.click('#moreBtn');
  assert.match(await p.page.textContent('#acct'), /Couldn’t sync just now.*isn’t set up yet.*Account → Google Sheets/);
  slowNoSheet = false;
  assert.ok(await p.page.isHidden('#signIn'));
  await p.ctx.close();
  sheetOn = true;
});

await test('delete all data: tap twice; gone here and from the Sheet, the older days too (yours only)', async () => {
  await page.click('#daySheet .okbtn').catch(() => {});
  assert.ok(mine().entries.length >= 3, 'Tom has drinks in the Sheet, older ones too');
  await page.click('#moreBtn');
  assert.match(await page.textContent('#wipeBtn'), /From this phone and the family’s Google Sheet/);
  await page.click('#wipeBtn');
  assert.match(await page.textContent('#wipeBtn'), /Tap again/);
  await page.click('#wipeBtn');
  await until(() => mine().entries.length === 0 && mine().days.length === 0, 'Tom’s drinks gone from the Sheet');
  assert.equal((await local(page)).entries.length, 0);
  assert.ok(Object.keys(await page.evaluate(() => window.__drinks.graves())).some(k => k === 'entries:abv-k7q2wine0001'), 'the one only the Sheet had, too');
  assert.equal(mine(SAMQ).entries.length, 1, 'Sam’s are untouched');
  await page.click('#moreSheet [data-close].iconbtn');
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


// ---- the family's Google Sheet, more closely ----
const sheetDrink = (id, extra) => Object.assign({ id, date: TODAY, time: '19:00', name: 'IPA', cat: 'beer', vol: 16, unit: 'oz', abv: 6.8, qty: 1, note: '', updated: Date.now() }, extra);   // now: the Sheet, shared by every test here, has Tom's graves from Delete all data
const COL = Object.fromEntries(['Who', 'Timestamp', 'Date', 'Time', 'Name', 'Category', 'Volume', 'Unit', 'ABV', 'Qty', 'StandardDrinks', 'GramsAlcohol', 'Note', 'EntryID', 'Check'].map((h, i) => [h, i]));
const logRow = id => sheet.tab('Log').slice(1).find(r => r[COL.EntryID] === id);
const logIndex = id => sheet.tab('Log').findIndex(r => r[COL.EntryID] === id) + 1;

await test('the family’s Google Sheet: More has its row and its sheet (status and Sync now; no link, phrase or setup link); a row changed or added in the Log tab comes back', async () => {
  const S = await newPage('light', { 'aos.session': SESSION, 'allison-drinks-v1': JSON.stringify({ v: 1, entries: [sheetDrink('s1'), sheetDrink('s2', { name: 'Wine', cat: 'wine', vol: 5, abv: 13 })], days: [{ id: YESTERDAY, status: 'af', updated: Date.now() }], prefs: [] }) });
  const sp = S.page;
  await sp.goto(BASE + '/drinks/'); await sp.waitForFunction(() => window.__drinks && window.__drinks.state() === 'ok');
  assert.ok(logRow('s1') && logRow('s2') && logRow('af-' + YESTERDAY), 'the drinks and the alcohol-free day are in the Log tab');
  assert.deepEqual([logRow('s1')[COL.Who], logRow('s1')[COL.ABV]], ['Tom', 6.8]);
  await sp.click('#moreBtn');
  assert.match(await sp.textContent('#sheetBtn'), /The family’s Google Sheet\s*Last synced/);
  await sp.click('#sheetBtn'); await sp.waitForSelector('#syncSheet:not([hidden])');
  assert.match(await sp.textContent('#syStatus'), /In the family’s Google Sheet\. Last synced/);
  assert.equal(await sp.textContent('#syNow .t'), 'Sync now');
  for (const gone of ['#syForm', '#syUrl', '#sySecret', '#syShare', '#syOff']) assert.equal(await sp.$(gone), null, gone + ' is gone');
  await shot(sp, '10-sheet');
  await sp.click('#syNow');
  await sp.waitForFunction(() => /Synced/.test(document.getElementById('toastMsg').textContent));
  await sp.click('#syncSheet .iconbtn[data-close]'); await sp.waitForTimeout(150);
  // a row changed in the Sheet comes back here
  sheet.type(logIndex('s1'), 'ABV', 7.5); sheet.type(logIndex('s1'), 'Note', 'a big one');
  await syncNow(sp);
  assert.equal((await local(sp)).entries.find(x => x.id === 's1').abv, 7.5);
  assert.equal((await local(sp)).entries.find(x => x.id === 's1').note, 'a big one');
  // a row typed into the Sheet, Who left empty: the owner's
  const i = sheet.tab('Log').length + 1;
  sheet.type(i, 'Date', TODAY); sheet.type(i, 'Name', 'Old Fashioned'); sheet.type(i, 'Category', 'Cocktail'); sheet.type(i, 'Volume', 2); sheet.type(i, 'Unit', 'oz'); sheet.type(i, 'ABV', 40);
  await syncNow(sp);
  const typed = (await local(sp)).entries.find(x => x.name === 'Old Fashioned');
  assert.ok(typed && typed.cat === 'cocktail' && typed.qty === 1, 'a typed row is a drink here');
  // Qty 0 removes one
  sheet.type(logIndex('s2'), 'Qty', 0);
  await syncNow(sp);
  assert.ok(!(await local(sp)).entries.some(x => x.id === 's2'), 'removed here');
  assert.ok((await local(sp)).entries.some(x => x.id === 's1'));
  // a drink logged here reaches the Sheet by itself a moment later
  await sp.click('#moreSheet .iconbtn[data-close]'); await sp.waitForSelector('#moreSheet', { state: 'hidden' });
  await sp.click('#fab'); await sp.waitForSelector('#daySheet:not([hidden])');
  const known = new Set(sheet.tab('Log').slice(1).map(r => r[COL.EntryID]));
  await sp.click('.utile[data-usual="0"]');
  await until(() => sheet.tab('Log').slice(1).some(r => !known.has(r[COL.EntryID])), 'the new drink in the Sheet');
  const fresh = sheet.tab('Log').slice(1).filter(r => !known.has(r[COL.EntryID]));
  assert.equal(fresh.length, 1, 'the drink logged here shows up in the Sheet by itself'); assert.equal(fresh[0][COL.Who], 'Tom');
  await sp.click('#daySheet .okbtn');
  assert.deepEqual(await sp.evaluate(() => window.__csp || []), []);
  await S.ctx.close();
});

await test('the 90 days: older drinks and days go from the phone once in the Sheet (no grave), come back when you look back at their week, and go again at the next tidy-up', async () => {
  const OLD = ymd(day(-120)), OLD_AF = ymd(day(-121)), RECENT = ymd(day(-10));
  const N = await newPage('light', { 'aos.session': SESSION, 'allison-drinks-v1': JSON.stringify({ v: 1, entries: [sheetDrink('old120', { date: OLD }), sheetDrink('new10', { date: RECENT })], days: [{ id: OLD_AF, status: 'af', updated: Date.now() }], prefs: [] }) });
  const np = N.page;
  await np.goto(BASE + '/drinks/');
  await np.waitForFunction(() => !JSON.parse(localStorage.getItem('allison-drinks-v1')).entries.some(x => x.id === 'old120'));
  const l = await local(np);
  assert.ok(l.entries.some(x => x.id === 'new10')); assert.ok(!l.days.some(x => x.id === OLD_AF));
  assert.deepEqual(Object.keys(await np.evaluate(() => window.__drinks.graves())).filter(k => k.includes('old120') || k.includes(OLD_AF)), [], 'no graves');
  assert.ok(mine().entries.some(x => x.id === 'old120') && mine().days.some(x => x.id === OLD_AF), 'the Sheet keeps them');
  const window90 = sheetCalls.filter(c => c.body.action === 'sync').at(-1).body;
  assert.equal(window90.window, 90);
  // back to that week, an arrow at a time
  for (let k = 0; k < 30 && (await np.$eval('.drow', e => e.dataset.day)) > OLD; k++) await np.click('[data-act="prev"]');
  await np.waitForFunction(d => !!document.querySelector('.drow[data-day="' + d + '"] .dval'), OLD);
  assert.match(await np.textContent('.drow[data-day="' + OLD + '"]'), /IPA/);
  assert.ok(sheetCalls.some(c => c.body.action === 'range' && c.body.from <= OLD && c.body.to >= OLD), 'asked the Sheet for that week');
  if (OLD_AF >= (await np.$eval('.drow', e => e.dataset.day))) assert.match(await np.textContent('.drow[data-day="' + OLD_AF + '"]'), /Alcohol-free/);
  // they stay while Drinks is open, even across a sync, and go at the next tidy-up after it's opened again
  await syncNow(np);
  assert.ok((await local(np)).entries.some(x => x.id === 'old120'));
  await np.reload(); await np.waitForFunction(() => window.__drinks);
  await np.waitForFunction(() => !JSON.parse(localStorage.getItem('allison-drinks-v1')).entries.some(x => x.id === 'old120'));
  assert.ok(mine().entries.some(x => x.id === 'old120'), 'still in the Sheet');
  await N.ctx.close();
});

await test('the owner’s phone hands the Sheet link and phrase it kept over to aOS, then forgets them; a member’s phone just forgets its own', async () => {
  const o = await newPage('light', { 'aos.session': SESSION, 'allison-drinks-v1-sheet': JSON.stringify({ url: SHEET_URL, secret: SECRET }) });
  await o.page.goto(BASE + '/drinks/#sync=eyJ1IjoieCJ9'); await o.page.waitForFunction(() => window.__drinks);
  assert.equal(await o.page.evaluate(() => location.hash), '', 'an old setup link is only taken off the address');
  await o.page.waitForFunction(() => !localStorage.getItem('allison-drinks-v1-sheet'));
  assert.deepEqual(claims.at(-1), { who: 'OWNER1', url: SHEET_URL, secret: SECRET });
  const idb = await o.page.evaluate(() => new Promise(res => { const r = indexedDB.open('allison-drinks', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('sheet'); q.onsuccess = () => res(q.result === undefined ? null : q.result); }; }));
  assert.equal(idb, null, 'and its IndexedDB copy');
  await o.ctx.close();
  const n0 = claims.length;
  const m = await newPage('light', { 'aos.session': SAM_SESSION, 'allison-drinks-v1-who': 'KID1', 'allison-drinks-v1-sheet': JSON.stringify({ url: 'https://script.google.com/macros/s/SAMS/exec', secret: 'sams-own' }) });
  await m.page.goto(BASE + '/drinks/'); await m.page.waitForFunction(() => window.__drinks);
  await m.page.waitForFunction(() => !localStorage.getItem('allison-drinks-v1-sheet'));
  assert.equal(claims.length, n0, 'a member hands nothing over');
  await m.ctx.close();
});

await test('someone else signing in on this phone: the last person’s log goes from here (it’s in the Sheet), and theirs comes in', async () => {
  const X = await newPage('light', { 'aos.session': SAM_SESSION, 'allison-drinks-v1': JSON.stringify({ v: 1, entries: [sheetDrink('tom-left-here')], days: [], prefs: [] }),
    'allison-drinks-v1-sync': JSON.stringify({ at: 1, pushed: 1, user: 'OWNER1', when: 1 }) });   // as the family account's sync left it
  await X.page.goto(BASE + '/drinks/'); await X.page.waitForFunction(() => window.__drinks && window.__drinks.state() === 'ok');
  const ids = (await local(X.page)).entries.map(x => x.id);
  assert.ok(!ids.includes('tom-left-here'), 'Tom’s is gone from here');
  assert.equal(ids.length, mine(SAMQ).entries.length, 'Sam’s own came in');
  assert.ok(!mine(SAMQ).entries.some(x => x.id === 'tom-left-here') && !mine().entries.some(x => x.id === 'tom-left-here'), 'and it wasn’t sent as Sam’s');
  assert.equal(await X.page.evaluate(() => localStorage.getItem('allison-drinks-v1-who')), 'KID1');
  assert.equal(await X.page.evaluate(() => localStorage.getItem('allison-drinks-v1-sync')), null, 'the old account marker is gone');
  await X.ctx.close();
});

// ---- the two designs (../home/design.js) ----
const ORANGE = scheme => scheme === 'light' ? 'rgb(201, 80, 42)' : 'rgb(216, 87, 42)';
await test('Vintage, the default: drawn in the Retro look, light and dark: Futura, flat cream or walnut, mustard, teal, orange, atomic shapes', async () => {
  for (const scheme of ['light', 'dark']) {
    const R = await newPage(scheme, { 'allison-drinks-v1': seedLog() });
    const rp = R.page;
    await rp.goto(BASE + '/drinks/'); await rp.waitForFunction(() => window.__drinks); await rp.waitForTimeout(1000);
    const q = (sel, props, pseudo) => rp.$eval(sel, (e, [props, pseudo]) => { const c = getComputedStyle(e, pseudo || null); return props.map(p => c[p]); }, [props, pseudo]);
    const cream = scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', ground = scheme === 'light' ? 'rgb(241, 223, 187)' : 'rgb(74, 57, 30)';
    const teal = scheme === 'light' ? 'rgb(31, 111, 107)' : 'rgb(79, 179, 171)';
    assert.equal(await rp.evaluate(() => document.documentElement.dataset.look), 'vintage');
    assert.equal(await rp.evaluate(() => document.getElementById('vintage').media), 'all');
    assert.match((await q('body', ['fontFamily']))[0], /Futura/, scheme + ': Futura');
    assert.equal((await q('body', ['backgroundColor']))[0], ground, scheme + ': the ground');
    const [bg, shadow, backdrop, radius] = await q('.rgroup.week', ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
    assert.equal(bg, cream); assert.equal(shadow, 'none'); assert.ok(backdrop === 'none' || backdrop === '', backdrop); assert.equal(radius, '20px');
    assert.equal((await q('.sum', ['backgroundColor']))[0], cream, 'the week’s number is a flat card too');
    assert.equal((await q('.ambient i:nth-child(1)', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard sun');
    assert.equal((await q('.ambient i:nth-child(2)', ['backgroundColor']))[0], teal, 'a teal dot');
    assert.equal((await q('.ambient i:nth-child(3)', ['backgroundColor']))[0], 'rgb(216, 87, 42)', 'a burnt-orange pill');
    assert.equal((await q('#fab', ['backgroundColor']))[0], ORANGE(scheme), 'the + button is solid orange');
    assert.equal((await q('.title', ['fontSize']))[0], '44px');
    assert.equal((await q('.title', ['backgroundImage'], '::after'))[0].startsWith('url('), true, 'the three little bars under the title');
    assert.equal((await q('.drow.today .dn b', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'today is a mustard disc');
    assert.equal((await q('.track i', ['backgroundColor']))[0], teal, 'the week’s bar is teal');
    assert.equal(await rp.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content'), scheme === 'light' ? '#F1DFBB' : '#4A391E', 'the bar colour is the sky’s ground (home/sky.js)');
    assert.equal(await rp.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'default', 'the status bar is not translucent on the cream');
    assert.match(await rp.getAttribute('link[rel="apple-touch-icon"]', 'href'), /^icon-180\.png/, 'the Vintage icon');
    await rp.click('#fab'); await rp.waitForSelector('#daySheet:not([hidden])'); await rp.waitForTimeout(600);
    const [sbg, sradius, sfilter] = await q('#daySheet .sheet', ['backgroundColor', 'borderRadius', 'backdropFilter']);
    assert.equal(sbg, cream, 'the sheet is a flat panel'); assert.equal(sradius, '28px'); assert.ok(sfilter === 'none' || sfilter === '');
    assert.equal((await q('#daySheet .okbtn', ['backgroundColor']))[0], ORANGE(scheme), 'Done is solid orange');
    await rp.click('#somethingElse');
    assert.equal((await q('#fSave', ['backgroundColor']))[0], ORANGE(scheme), 'Add is solid orange');
    assert.equal((await q('#fCancel', ['backgroundColor']))[0], 'rgba(0, 0, 0, 0)', 'Cancel is outlined, not filled');
    assert.equal((await q('.frow .unit button[aria-pressed="true"]', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'oz / ml has a mustard thumb');
    await shot(rp, '20-retro-form-' + scheme);
    await rp.click('#daySheet .okbtn'); await rp.waitForTimeout(400);
    await rp.click('#sumBtn'); await rp.waitForSelector('#trends:not([hidden])'); await rp.waitForTimeout(900);
    const [pillBg] = await rp.evaluate(() => [getComputedStyle(document.getElementById('trBar'), '::before').backgroundColor]);
    assert.equal(pillBg, 'rgb(74, 52, 38)', 'the view pill is walnut');
    assert.equal((await q('#trBody .seg .slthumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard thumb on Week / Month');
    assert.equal((await q('#trBody .kpis', ['backgroundColor']))[0], cream);
    await pickView(rp, 2);
    assert.equal((await q('.chart .bar', ['fill']))[0], teal, 'teal columns');
    assert.equal((await q('.chart .bar.over', ['fill']))[0], 'rgb(216, 87, 42)', 'orange over the limit');
    await shot(rp, '21-retro-weekly-' + scheme);
    await pickView(rp, 6);
    assert.equal((await q('.chart .bar.af', ['fill']))[0], scheme === 'light' ? 'rgb(126, 140, 52)' : 'rgb(163, 176, 74)', 'olive alcohol-free columns');
    assert.deepEqual(await rp.evaluate(() => window.__csp || []), []);
    await R.ctx.close();
  }
});

await test('Standard: Sea glass, the Vintage styles off, no sky; the icon, status bar and bar colour follow', async () => {
  for (const scheme of ['light', 'dark']) {
    const G = await newPage(scheme, { 'allison-drinks-v1': seedLog(), 'design.drinks': 'glass' });
    const gp = G.page;
    await gp.goto(BASE + '/drinks/'); await gp.waitForFunction(() => window.__drinks); await gp.waitForTimeout(700);
    const q = (sel, props) => gp.$eval(sel, (e, props) => { const c = getComputedStyle(e); return props.map(p => c[p]); }, props);
    assert.ok(await gp.evaluate(() => document.documentElement.dataset.look === 'glass' && document.getElementById('vintage').media === 'not all' && !document.documentElement.hasAttribute('data-sky')), scheme + ': glass, the Vintage block off, no sky');
    assert.equal((await q('body', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(238, 242, 240)' : 'rgb(13, 18, 19)', scheme + ': the Sea glass ground');
    assert.doesNotMatch((await q('body', ['fontFamily']))[0], /Futura/, 'the system font');
    assert.notEqual((await q('.rgroup.week', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', 'no cream card');
    assert.notEqual((await q('#fab', ['backgroundColor']))[0], ORANGE(scheme), 'no orange +');
    assert.match(await gp.getAttribute('link[rel="apple-touch-icon"]', 'href'), /^icon-glass-180\.png/, 'the Sea glass icon');
    assert.equal(await gp.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'black-translucent');
    assert.equal(await gp.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content'), scheme === 'light' ? '#EEF2F0' : '#0D1213');
    await shot(gp, '22-glass-week-' + scheme);
    assert.deepEqual(await gp.evaluate(() => window.__csp || []), []);
    await G.ctx.close();
  }
});

await test('More > Design: the first section; Standard and back, at once, kept across a reload; the Week / Month thumb follows the new font', async () => {
  const P = await newPage('light', { 'allison-drinks-v1': seedLog() });
  const pp = P.page, look = () => pp.evaluate(() => document.documentElement.dataset.look);
  await pp.goto(BASE + '/drinks/'); await pp.waitForFunction(() => window.__drinks); await pp.waitForTimeout(500);
  assert.equal(await look(), 'vintage');
  await pp.click('#moreBtn'); await pp.waitForSelector('#moreSheet:not([hidden])'); await pp.waitForTimeout(300);
  assert.equal(await pp.$eval('#moreBody', b => b.firstElementChild.textContent), 'Design', 'Design is the first section');
  assert.equal(await pp.getAttribute('#moreBody [data-design="vintage"]', 'aria-checked'), 'true');
  assert.equal(await pp.getAttribute('#moreBody [data-design="glass"]', 'aria-checked'), 'false');
  await shot(pp, '23-more-design-vintage');
  await pp.click('#moreBody [data-design="glass"]'); await pp.waitForTimeout(200);
  assert.equal(await look(), 'glass', 'at once');
  assert.equal(await pp.getAttribute('#moreBody [data-design="glass"]', 'aria-checked'), 'true');
  assert.ok(await pp.isVisible('#moreSheet'), 'More stays open');
  // More is drawn again on every sync; the rows still answer and say which is picked
  await pp.evaluate(() => window.__drinks.sync()); await pp.waitForTimeout(300);
  assert.equal(await pp.getAttribute('#moreBody [data-design="glass"]', 'aria-checked'), 'true');
  await pp.reload(); await pp.waitForFunction(() => window.__drinks); await pp.waitForTimeout(500);
  assert.equal(await look(), 'glass', 'kept');
  assert.equal(await pp.evaluate(() => localStorage.getItem('design.drinks')), 'glass');
  // the Week / Month thumb sits under the pressed button in either font
  await pp.click('#sumBtn'); await pp.waitForSelector('#trends:not([hidden])'); await pp.waitForTimeout(700);
  const thumbFits = () => pp.evaluate(() => { const s = document.querySelector('#trBody .seg'), t = s.querySelector('.slthumb').getBoundingClientRect(), b = s.querySelector('[aria-pressed="true"]').getBoundingClientRect(); return Math.abs(t.left - b.left) < 2 && Math.abs(t.width - b.width) < 2; });
  assert.ok(await thumbFits(), 'the thumb fits in Standard');
  await pp.evaluate(() => window.aosDesign.set('vintage')); await pp.waitForTimeout(400);
  assert.ok(await thumbFits(), 'and again in Vintage, at once');
  await pp.click('#trBack');
  await pp.click('#moreBtn'); await pp.waitForSelector('#moreSheet:not([hidden])'); await pp.waitForTimeout(300);
  await pp.click('#moreBody [data-design="glass"]'); await pp.waitForTimeout(200);
  await shot(pp, '24-more-design-glass');
  await pp.click('#moreBody [data-design="vintage"]'); await pp.waitForTimeout(200);
  await pp.reload(); await pp.waitForFunction(() => window.__drinks); await pp.waitForTimeout(500);
  assert.equal(await look(), 'vintage', 'back to Vintage, kept');
  assert.equal(await pp.evaluate(() => localStorage.getItem('design.drinks')), 'vintage');
  assert.deepEqual(await pp.evaluate(() => window.__csp || []), []);
  await P.ctx.close();
});

await test('the old Drinks Vintage address, on a phone that added it: it opens Drinks, with its log, its Sheet link and what it had seen moved over once', async () => {
  const old = seedLog();
  const O = await newPage('light', { 'aos.seen': JSON.stringify({ drinksvintage: '1.3' }), 'allison-drinksv-v1': old, 'allison-drinksv-v1-trview': 'weekly', 'allison-drinksv-v1-period': 'month' });
  const op = O.page;
  // The old app's IndexedDB copy of its Sheet link and phrase (its localStorage copy lost), made at the old address
  // before the app opens there (a plain file, so nothing of the app runs)
  await op.goto(BASE + '/drinksvintage/icon.svg');
  await op.evaluate(([u, s]) => new Promise((res, rej) => { const r = indexedDB.open('allison-drinksv', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put({ url: u, secret: s }, 'sheet'); t.oncomplete = () => { r.result.close(); res(); }; t.onerror = () => rej(t.error); }; r.onerror = () => rej(r.error); }), [SHEET_URL, SECRET]);
  await op.goto(BASE + '/drinksvintage/'); await op.waitForFunction(() => window.__drinks); await op.waitForTimeout(1200);
  const got = await op.evaluate(() => ({ log: localStorage.getItem('allison-drinks-v1'), view: localStorage.getItem('allison-drinks-v1-trview'), seen: JSON.parse(localStorage.getItem('aos.seen') || '{}'), old: localStorage.getItem('allison-drinksv-v1'), look: document.documentElement.dataset.look, n: window.__drinks.data.entries.length, today: document.querySelector('.drow.today .dsum').textContent }));
  assert.equal(JSON.parse(got.log).entries.length, JSON.parse(old).entries.length, 'the log is now Drinks’');
  assert.equal(got.n, JSON.parse(old).entries.length, 'and the app shows it');
  assert.match(got.today, /Wine/, 'today’s Wine is on the week');
  assert.equal(got.view, 'weekly', 'the Analysis view too');
  assert.equal(got.seen.drinks, '1.3', 'what it had seen carries over (no walkthrough again)');
  assert.equal(got.old, old, 'nothing old is deleted');
  assert.equal(got.look, 'vintage');
  const idb = await op.evaluate(() => new Promise(res => { const r = indexedDB.open('allison-drinks', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('sheet'); q.onsuccess = () => res(q.result); }; }));
  assert.deepEqual(idb, { url: SHEET_URL, secret: SECRET }, 'the Sheet link and phrase, moved to Drinks’ IndexedDB copy, until a signed-in Drinks hands them to aOS');
  // once only: a later change to the old keys is not copied again
  await op.evaluate(() => localStorage.setItem('allison-drinksv-v1-trview', 'top'));
  await op.reload(); await op.waitForFunction(() => window.__drinks); await op.waitForTimeout(500);
  assert.equal(await op.evaluate(() => localStorage.getItem('allison-drinks-v1-trview')), 'weekly', 'moved once only');
  assert.deepEqual(await op.evaluate(() => window.__csp || []), []);
  await O.ctx.close();
});

await test('a phone with both: Drinks’ own log is kept, the old app’s is not copied over it', async () => {
  const mine = JSON.stringify({ v: 1, entries: [sheetDrink('mine1')], days: [], prefs: [] });
  const B = await newPage('light', { 'aos.seen': JSON.stringify({ drinks: '999', drinksvintage: '999' }), 'allison-drinks-v1': mine, 'allison-drinksv-v1': seedLog() });
  await B.page.goto(BASE + '/drinksvintage/'); await B.page.waitForFunction(() => window.__drinks); await B.page.waitForTimeout(500);
  assert.deepEqual(await B.page.evaluate(() => window.__drinks.data.entries.map(x => x.id)), ['mine1']);
  await B.ctx.close();
});

await test('from the old address, signed in: every key is Drinks’ own, the sync goes to Drinks’ Sheet, and Drinks has the same log', async () => {
  const P = await newPage('light', { 'aos.session': SESSION, 'aos.seen': JSON.stringify({ drinks: '999' }) });
  apiCalls.length = 0; const s0 = sheetCalls.length;
  await P.page.goto(BASE + '/drinksvintage/'); await P.page.waitForFunction(() => window.__drinks && window.__drinks.state() === 'ok');
  await P.page.click('#fab'); await P.page.click('.utile[data-usual="1"]'); await P.page.click('#daySheet .okbtn');
  await syncNow(P.page);
  const keys = await P.page.evaluate(() => Object.keys(localStorage));
  assert.ok(keys.includes('allison-drinks-v1'), keys.join());
  assert.deepEqual(keys.filter(k => !/^(allison-drinks-|aos\.|design\.drinks)/.test(k)), [], 'nothing outside Drinks’ own names (and the aOS keys)');
  const calls = sheetCalls.slice(s0);
  assert.ok(calls.length && calls.every(c => c.path === '/sheet/api/drinks'), 'the Sheet is Drinks’: ' + calls.map(c => c.path).join());
  assert.deepEqual(apiCalls, [], 'and nothing goes to the family account’s old route');
  const D = await newPage('light', { 'aos.session': SESSION });
  await D.page.goto(BASE + '/drinks/'); await D.page.waitForFunction(() => window.__drinks && window.__drinks.state() === 'ok');
  assert.deepEqual((await local(D.page)).entries.map(x => x.id).sort(), (await local(P.page)).entries.map(x => x.id).sort(), 'Drinks has the same log, from the Sheet');
  assert.ok((await local(D.page)).entries.length >= 1);
  await D.ctx.close(); await P.ctx.close();
});

await test('no errors and no Content Security Policy violations; no phone talked to Google', async () => {
  assert.deepEqual(await page.evaluate(() => window.__csp || []), []);
  assert.deepEqual(errors, []);
  assert.deepEqual(google, []);
});

await ctx.close();
await browser.close();
server.close();
console.log(n + ' tests passed');
