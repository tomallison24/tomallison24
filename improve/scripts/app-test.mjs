// Drives the Improve app in headless Chromium at iPhone size: the empty list, adding an item in one
// tap (with Undo), the Kind and App pickers remembered between adds and across a reload, Open and
// Done, an item's sheet (what it says, its kind and app, Done, Delete that asks again, Undo), Settings
// (Design first, Standard and back, Your data, the family account), Vintage and Standard in light and
// dark, and the family's Google Sheet end to end: the real google-sheet-sync.gs on an in-memory Sheet
// (drinks/scripts/fake-sheet.mjs), reached through aOS (functions/sheet/api, stood in for here: each
// phone's session says who's asking). Two phones kept in step, everyone seeing every item, someone
// else's item read-only on a member's phone, the owner marking it done, a delete reaching the other
// phone, the readable Improve tab with its Who column, and a Sheet not set up yet (no toast). Nothing
// trips the page's Content Security Policy, and no phone talks to Google itself.
// Screenshots go to the folder given as the second argument.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node improve/scripts/app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

// ---- a static server for the repo ----
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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

// ---- today, in the test's own zone (the browser gets the same one) ----
const TZ = 'America/New_York';
process.env.TZ = TZ;
const SHORT = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ });   // "Nov 2"

// ---- the family's Google Sheet: the real Apps Script, on an in-memory Sheet, reached through aOS
// (functions/sheet/api, stood in for here): each phone's session says who's asking ----
const SECRET = 'test-secret-phrase';
const sheet = fakeSheet(path.join(ROOT, 'improve/google-sheet-sync.gs'), SECRET);
const PEOPLE = { 'tok-tom': { id: 'OWNER1', name: 'Tom', role: 'owner' }, 'tok-ella': { id: 'ELLA1', name: 'Ella', role: 'member' } };
const session = tok => JSON.stringify({ token: tok, user: PEOPLE[tok], at: Date.now() });
const asked = who => ({ key: SECRET, who: who.id, name: who.name, ...(who.role === 'owner' ? { owner: '1' } : {}) });
let sheetOn = true;
const sheetCalls = [], google = [];
async function sheetApi(route) {
  const req = route.request(), u = new URL(req.url()), who = PEOPLE[(req.headers().authorization || '').replace('Bearer ', '')];
  const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
  if (req.headers()['x-sheet'] !== '1') return json({ error: 'header' }, 400);
  if (!u.pathname.endsWith('/sheet/api/improve')) return json({ error: 'app' }, 404);
  if (!who) return json({ error: 'signin' }, 401);
  if (req.method() === 'GET') return json({ configured: sheetOn });
  if (!sheetOn) return json({ ok: false, error: 'no-sheet' }, 409);
  sheetCalls.push({ who: who.id, body: JSON.parse(req.postData()) });
  return json(sheet.post(req.postData(), asked(who)));
}
const until = async (fn, what, ms = 8000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('timed out: ' + what); await new Promise(r => setTimeout(r, 100)); } };

const browser = await chromium.launch();
const errors = [];
async function newPage(scheme, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, timezoneId: TZ, locale: 'en-US', serviceWorkers: 'block' });
  await ctx.route('**/sheet/api/**', sheetApi);
  await ctx.route('**/aOS/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
  await ctx.route(/^https:\/\/script\.google(usercontent)?\.com\//, route => { google.push(route.request().url()); return route.abort(); });   // no phone talks to Google itself
  // The walkthroughs (home/welcome.js) as already seen, as on a phone that has been using the app;
  // the sky held at day (home/sky.js), so the Vintage colours don't depend on the hour.
  extra = Object.assign({ 'aos.seen': JSON.stringify({ improve: '999' }), 'aos.signin.asked': '1', 'aos.sky': 'day' }, extra);
  await ctx.addInitScript(extra => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, extra);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource|401|404|409|503/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { window.__csp = (window.__csp || []).concat(e.violatedDirective + ' ' + e.blockedURI); }));
  await page.goto(BASE + '/improve/');
  await page.waitForFunction(() => window.__improve);
  await page.waitForTimeout(400);
  return { ctx, page };
}
let n = 0;
async function test(name, fn) { await fn(); n++; console.log('ok -', name); }
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const rows = p => p.$$eval('#items .irow', els => els.map(e => ({ text: e.querySelector('.itext').textContent, pills: [...e.querySelectorAll('.pill')].map(x => x.textContent), when: (e.querySelector('.when') || {}).textContent || '' })));
const chips = p => p.$$eval('#showChips .chip', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim() + (e.getAttribute('aria-pressed') === 'true' ? '*' : '')));
async function add(p, text, kind, app) {
  await p.fill('#addText', text);
  if (kind) await p.selectOption('#addKind', kind);
  if (app) await p.selectOption('#addApp', app);
  await p.click('#addBtn');
  await p.waitForTimeout(150);
}
const toastText = p => p.evaluate(() => document.getElementById('toast').hidden ? '' : document.getElementById('toastMsg').textContent);

// ---------------------------------------------------------------------------------------------------
await test('a new phone, signed out: nothing open, Open and Done, and the pickers at Improvement and General', async () => {
  const { ctx, page } = await newPage('light');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.look), 'vintage', 'opens in Vintage');
  assert.match(await page.textContent('#items .empty'), /Nothing open/);
  assert.deepEqual(await chips(page), ['Open 0*', 'Done 0']);
  assert.equal(await page.$eval('#addKind', s => s.value), 'improvement');
  assert.equal(await page.$eval('#addApp', s => s.value), 'general');
  const apps = await page.$$eval('#addApp option', o => o.map(x => x.textContent));
  assert.deepEqual(apps.slice(0, 2), ['General', 'aOS'], 'General and aOS first');
  for (const a of ['Drinks', 'Home', 'Improve', 'Mail', 'Sparkle Kingdom', 'Weather']) assert.ok(apps.includes(a), 'lists ' + a);
  assert.ok(await page.$eval('#showChips .slthumb', t => t.offsetWidth > 40), 'the sliding thumb is under Open');
  assert.equal(await page.getAttribute('#moreBtn', 'aria-label'), 'Settings');
  await shot(page, '01-empty-vintage');
  assert.deepEqual(await page.evaluate(() => window.__csp || []), []);
  await ctx.close();
});

await test('adding takes one tap after typing; Undo takes it back; the kind and app are kept for the next one and across a reload', async () => {
  const { ctx, page } = await newPage('light');
  await page.click('#addBtn');
  assert.equal((await rows(page)).length, 0, 'nothing to add: nothing added');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'addText', 'the box is ready to type in');
  await add(page, 'Drinks: the week jumps when a sheet closes', 'bug', 'drinks');
  let r = await rows(page);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], { text: 'Drinks: the week jumps when a sheet closes', pills: ['Bug', 'Drinks'], when: SHORT });
  assert.equal(await page.$eval('#addText', t => t.value), '', 'the box is cleared');
  assert.equal(await toastText(page), 'Added.');
  await page.click('#toastAct');
  assert.equal((await rows(page)).length, 0, 'Undo');
  assert.equal(await page.$eval('#addText', t => t.value), 'Drinks: the week jumps when a sheet closes', 'and the words are back in the box');
  await page.click('#addBtn'); await page.waitForTimeout(150);
  assert.equal(await page.$eval('#addKind', s => s.value), 'bug', 'the kind stays');
  assert.equal(await page.$eval('#addApp', s => s.value), 'drinks', 'the app stays');
  await add(page, 'Show the week\'s total bigger');   // the same kind and app, one tap
  await add(page, 'A shortcut to add from the Home Screen', 'idea', 'general');
  r = await rows(page);
  assert.deepEqual(r.map(x => x.text), ['A shortcut to add from the Home Screen', 'Show the week\'s total bigger', 'Drinks: the week jumps when a sheet closes'], 'newest first');
  assert.deepEqual(r[1].pills, ['Bug', 'Drinks']);
  assert.deepEqual(r[0].pills, ['Idea', 'General']);
  assert.deepEqual(await chips(page), ['Open 3*', 'Done 0']);
  await shot(page, '02-three-vintage');
  await page.reload(); await page.waitForFunction(() => window.__improve); await page.waitForTimeout(300);
  assert.equal((await rows(page)).length, 3, 'kept on the phone');
  assert.equal(await page.$eval('#addKind', s => s.value), 'idea');
  assert.equal(await page.$eval('#addApp', s => s.value), 'general');
  // ⌘ Return adds, from a keyboard
  await page.fill('#addText', 'From a keyboard'); await page.press('#addText', 'Control+Enter'); await page.waitForTimeout(150);
  assert.equal((await rows(page))[0].text, 'From a keyboard');
  assert.deepEqual(await page.evaluate(() => window.__csp || []), []);
  await ctx.close();
});

await test('an item\'s sheet: what it says, its kind and app, Done (and Open again), Delete that asks again, and Undo', async () => {
  const { ctx, page } = await newPage('light');
  await add(page, 'Weather radar is slow', 'improvement', 'weather');
  await add(page, 'Notes: a list colour picker', 'idea', 'notes');
  await page.click('#items .irow:has-text("Weather radar is slow")');
  await page.waitForSelector('#itemSheet:not([hidden])');
  assert.equal(await page.textContent('#itemLbl'), 'Edit');
  assert.equal(await page.getAttribute('#itemSheet .sheet', 'role'), 'dialog');
  assert.equal(await page.getAttribute('#itemSheet .okbtn', 'aria-label'), 'Done');
  assert.equal(await page.$eval('#edText', t => t.value), 'Weather radar is slow');
  assert.equal(await page.getAttribute('#edKind [data-value="improvement"]', 'aria-checked'), 'true');
  assert.equal(await page.$eval('#edApp', s => s.value), 'weather');
  await shot(page, '03-item-sheet');
  await page.fill('#edText', 'Weather: the radar takes 5 seconds to open');
  await page.click('#edKind [data-value="bug"]');
  await page.selectOption('#edApp', 'aos');
  await page.click('#itemSheet .okbtn'); await page.waitForTimeout(350);
  assert.ok(await page.isHidden('#itemSheet'));
  let r = await rows(page);
  assert.deepEqual(r.find(x => /radar/.test(x.text)), { text: 'Weather: the radar takes 5 seconds to open', pills: ['Bug', 'aOS'], when: SHORT });
  // Done: it moves to Done, with Undo
  await page.click('#items .irow:has-text("radar")'); await page.waitForSelector('#itemSheet:not([hidden])');
  await page.click('#edDone');
  assert.equal(await page.getAttribute('#edDone', 'aria-checked'), 'true');
  assert.equal(await toastText(page), 'Marked done.');
  await page.click('#itemSheet .okbtn'); await page.waitForTimeout(300);
  assert.deepEqual(await chips(page), ['Open 1*', 'Done 1']);
  assert.deepEqual((await rows(page)).map(x => x.text), ['Notes: a list colour picker']);
  await page.click('#showChips [data-show="done"]'); await page.waitForTimeout(800);
  assert.deepEqual(await chips(page), ['Open 1', 'Done 1*']);
  r = await rows(page);
  assert.equal(r[0].when, 'Done ' + SHORT);
  assert.equal(await page.$eval('#showChips', b => { const t = b.querySelector('.slthumb').getBoundingClientRect(), c = b.querySelector('[aria-pressed="true"]').getBoundingClientRect(); return Math.abs(t.left - c.left) < 2 && Math.abs(t.width - c.width) < 2; }), true, 'the thumb slid to Done');
  await shot(page, '04-done');
  // Open again
  await page.click('#items .irow'); await page.waitForSelector('#itemSheet:not([hidden])');
  await page.click('#edDone');
  assert.equal(await toastText(page), 'Open again.');
  await page.click('#itemSheet .okbtn'); await page.waitForTimeout(300);
  assert.deepEqual(await chips(page), ['Open 2', 'Done 0*']);
  assert.match(await page.textContent('#items .empty'), /Nothing done yet/);
  await page.click('#showChips [data-show="open"]'); await page.waitForTimeout(200);
  // Delete asks again, then Undo brings it back
  await page.click('#items .irow:has-text("colour picker")'); await page.waitForSelector('#itemSheet:not([hidden])');
  await page.click('#edDel');
  assert.equal(await page.textContent('#edDel .st-title'), 'Tap again to delete it');
  assert.equal((await rows(page)).length, 2, 'not yet');
  await page.click('#edDel'); await page.waitForTimeout(300);
  assert.ok(await page.isHidden('#itemSheet'), 'the sheet closes');
  assert.deepEqual((await rows(page)).map(x => x.text), ['Weather: the radar takes 5 seconds to open']);
  assert.equal(await toastText(page), 'Deleted.');
  assert.ok(await page.evaluate(() => Object.keys(window.__improve.graves()).length === 1), 'a grave, for the Sheet');
  await page.click('#toastAct'); await page.waitForTimeout(150);
  assert.equal((await rows(page)).length, 2, 'Undo');
  assert.deepEqual(await page.evaluate(() => window.__csp || []), []);
  await ctx.close();
});

await test('Settings: Design first, then Your data and the family account; Standard and back, at once, kept across a reload', async () => {
  const { ctx, page } = await newPage('light');
  const look = () => page.evaluate(() => document.documentElement.dataset.look);
  await page.click('#moreBtn'); await page.waitForSelector('#moreSheet:not([hidden])'); await page.waitForTimeout(300);
  assert.equal(await page.textContent('#moreLbl'), 'Settings');
  assert.deepEqual(await page.$$eval('#moreBody .st-lbl', l => l.map(x => x.textContent.trim())), ['Design', 'Your data', 'Family account']);
  assert.equal(await page.textContent('#exportBtn .st-title'), 'Export as a spreadsheet');
  assert.equal(await page.textContent('#signIn .st-title'), 'Sign in with Face ID');
  assert.match(await page.textContent('#acctState'), /On this phone only/);
  assert.equal(await page.getAttribute('#moreBody [data-design="vintage"]', 'aria-checked'), 'true');
  await shot(page, '05-settings');
  await page.click('#moreBody [data-design="glass"]'); await page.waitForTimeout(250);
  assert.equal(await look(), 'glass', 'at once');
  assert.ok(await page.isVisible('#moreSheet'), 'Settings stays open');
  await page.reload(); await page.waitForFunction(() => window.__improve); await page.waitForTimeout(300);
  assert.equal(await look(), 'glass', 'kept');
  assert.equal(await page.evaluate(() => localStorage.getItem('design.improve')), 'glass');
  await page.click('#moreBtn'); await page.waitForSelector('#moreSheet:not([hidden])'); await page.waitForTimeout(200);
  await page.click('#moreBody [data-design="vintage"]'); await page.waitForTimeout(250);
  assert.equal(await look(), 'vintage');
  await page.click('#moreSheet .okbtn'); await page.waitForTimeout(300);
  assert.ok(await page.isHidden('#moreSheet'));
  assert.deepEqual(await page.evaluate(() => window.__csp || []), []);
  await ctx.close();
});

await test('both designs, light and dark: Vintage\'s cream and Futura, Standard\'s Sea glass; the icon follows', async () => {
  const items = JSON.stringify({ v: 1, items: [
    { id: 'i1', text: 'Calendar: the week starts on the wrong day', kind: 'bug', app: 'calendar', status: 'open', added: '2026-10-30', at: Date.now() - 3e8, doneOn: '', updated: 1 },
    { id: 'i2', text: 'A quick way to share a list', kind: 'idea', app: 'notes', status: 'open', added: '2026-11-01', at: Date.now() - 1e8, doneOn: '', updated: 1 },
    { id: 'i3', text: 'Bigger text in Clock', kind: 'improvement', app: 'clock', status: 'open', added: '2026-11-02', at: Date.now(), doneOn: '', updated: 1 },
  ] });
  for (const scheme of ['light', 'dark']) {
    for (const design of ['vintage', 'glass']) {
      const { ctx, page } = await newPage(scheme, { 'allison-improve-v1': items, 'design.improve': design });
      const css = (sel, p) => page.$eval(sel, (e, p) => getComputedStyle(e)[p], p);
      assert.equal(await page.evaluate(() => document.documentElement.dataset.look), design);
      if (design === 'vintage') {
        assert.equal(await css('body', 'backgroundColor'), scheme === 'light' ? 'rgb(241, 223, 187)' : 'rgb(74, 57, 30)', 'the day sky\'s ground (home/sky.js, held at day)');
        assert.match(await css('body', 'fontFamily'), /Futura/);
        assert.equal(await css('.rgroup', 'backgroundColor'), scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', 'cream cards');
        assert.match(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'), /^icon-180\.png/);
      } else {
        assert.equal(await css('body', 'backgroundColor'), scheme === 'light' ? 'rgb(238, 242, 240)' : 'rgb(13, 18, 19)', 'the Sea glass ground');
        assert.doesNotMatch(await css('body', 'fontFamily'), /Futura/);
        assert.match(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'), /^icon-glass-180\.png/);
      }
      assert.equal((await rows(page)).length, 3);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'nothing wider than the phone');
      await shot(page, '06-' + design + '-' + scheme);
      assert.deepEqual(await page.evaluate(() => window.__csp || []), []);
      await ctx.close();
    }
  }
});

await test('the family\'s Sheet: two phones in step, everyone sees every item, someone else\'s read-only, the owner marks it done, a delete travels', async () => {
  const tom = await newPage('light', { 'aos.session': session('tok-tom') });
  const tp = tom.page;
  await until(() => tp.evaluate(() => window.__improve.state() === 'ok'), 'Tom\'s first sync');
  await add(tp, 'Home: the thermostat card is too tall', 'improvement', 'house');
  await add(tp, 'Mail: archive is slow', 'bug', 'mail');
  await until(() => (sheet.tab('_items') || []).length === 3, 'Tom\'s two items in the Sheet');
  assert.ok(sheetCalls.every(c => !('secret' in c.body)), 'no phrase from a phone');
  assert.ok(sheetCalls.some(c => c.body.action === 'sync' && c.body.window === 90 && /^\d{4}-\d{2}-\d{2}$/.test(c.body.today)), 'the protocol\'s shape');
  // Ella's phone: Tom's items, with whose they are; she adds one of her own
  const ella = await newPage('dark', { 'aos.session': session('tok-ella') });
  const ep = ella.page;
  await until(async () => (await rows(ep)).length === 2, 'Ella gets Tom\'s items');
  assert.deepEqual((await rows(ep)).map(x => x.when), [SHORT + ' · Tom', SHORT + ' · Tom'], 'whose they are');
  await add(ep, 'Sparkle: the unicorn game is too hard', 'bug', 'sparkle');
  await until(() => (sheet.tab('_items') || []).length === 4, 'Ella\'s item in the Sheet');
  // Tom's phone comes back to the front: Ella's item, marked as hers
  await tp.evaluate(() => window.__improve.sync()); await tp.waitForTimeout(300);
  let r = await rows(tp);
  assert.equal(r[0].text, 'Sparkle: the unicorn game is too hard');
  assert.equal(r[0].when, SHORT + ' · Ella');
  // Ella opens Tom's item: she can read it, not change it
  await ep.click('#items .irow:has-text("archive is slow")'); await ep.waitForSelector('#itemSheet:not([hidden])');
  assert.equal(await ep.$eval('#edText', t => t.readOnly), true);
  assert.equal(await ep.$('#edDel'), null, 'no Delete');
  assert.equal(await ep.$('#edDone'), null, 'no Done');
  assert.match(await ep.textContent('#itemBody'), /Only Tom or the family’s owner can change it\./);
  await shot(ep, '07-someone-elses');
  await ep.click('#itemSheet .okbtn'); await ep.waitForTimeout(300);
  // and her own she can
  await ep.click('#items .irow:has-text("unicorn")'); await ep.waitForSelector('#itemSheet:not([hidden])');
  assert.ok(await ep.$('#edDel'));
  await ep.click('#itemSheet .okbtn'); await ep.waitForTimeout(300);
  // Tom, the owner, marks Ella's done: the Sheet says so, and Ella's phone hears of it; it stays hers
  await tp.click('#items .irow:has-text("unicorn")'); await tp.waitForSelector('#itemSheet:not([hidden])');
  assert.ok(await tp.$('#edDone'), 'the owner can');
  await tp.click('#edDone'); await tp.click('#itemSheet .okbtn');
  await until(() => (sheet.tab('Improve') || []).some(row => row[5] === 'Sparkle: the unicorn game is too hard' && row[4] === 'Done'), 'done in the Sheet');
  const tab = sheet.tab('Improve');
  assert.deepEqual(tab[0], ['Who', 'Added', 'Kind', 'App', 'Status', 'Text', 'Done on']);
  assert.deepEqual(tab.slice(1).map(x => x[0] + ':' + x[2] + ':' + x[3] + ':' + x[4]), ['Tom:Bug:Mail:Open', 'Tom:Improvement:Home:Open', 'Ella:Bug:Sparkle Kingdom:Done'], 'open first, newest first; the Who column');
  await ep.evaluate(() => window.__improve.sync()); await ep.waitForTimeout(300);
  assert.equal((await rows(ep)).length, 2, 'Ella\'s phone: two open');
  assert.deepEqual(await chips(ep), ['Open 2*', 'Done 1']);
  // Tom deletes his mail item: it goes from Ella's phone too
  await tp.click('#items .irow:has-text("archive is slow")'); await tp.waitForSelector('#itemSheet:not([hidden])');
  await tp.click('#edDel'); await tp.click('#edDel');
  await until(() => (sheet.tab('_items') || []).length === 3, 'deleted in the Sheet');
  await ep.evaluate(() => window.__improve.sync()); await ep.waitForTimeout(300);
  assert.deepEqual((await rows(ep)).map(x => x.text), ['Home: the thermostat card is too tall']);
  // Settings says the list is in the family's Sheet
  await ep.click('#moreBtn'); await ep.waitForSelector('#moreSheet:not([hidden])'); await ep.waitForTimeout(300);
  assert.match(await ep.textContent('#acctState'), /In the family’s Google Sheet/);
  assert.match(await ep.textContent('#acct'), /Signed in as Ella/);
  assert.deepEqual(google, [], 'no phone talked to Google itself');
  assert.deepEqual(await tp.evaluate(() => window.__csp || []), []);
  assert.deepEqual(await ep.evaluate(() => window.__csp || []), []);
  await tom.ctx.close(); await ella.ctx.close();
});

await test('a Sheet the owner hasn\'t set up yet: the list works on the phone, with no toast', async () => {
  sheetOn = false;
  const { ctx, page } = await newPage('light', { 'aos.session': session('tok-ella') });
  await until(() => page.evaluate(() => window.__improve.state() === 'error'), 'the sync tried');
  assert.equal(await toastText(page), '', 'no toast: the owner sets it up in aOS');
  await add(page, 'Works offline too', 'idea', 'general');
  assert.equal((await rows(page))[0].text, 'Works offline too');
  await page.click('#moreBtn'); await page.waitForSelector('#moreSheet:not([hidden])'); await page.waitForTimeout(300);
  assert.match(await page.textContent('#acctState'), /isn’t set up yet/);
  await ctx.close();
  sheetOn = true;
});

await browser.close();
server.close();
assert.deepEqual(errors, [], 'no script errors');
console.log('\n' + n + ' tests passed');
