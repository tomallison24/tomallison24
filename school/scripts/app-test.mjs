// Drives School in headless Chromium at iPhone size, its clock held at a Wednesday evening (Oct 28,
// 2026, 7 pm): the empty page and Connect Gmail; the six sections from made-up ParentSquare emails
// (fixtures.mjs, read by the real sort.js); Mark done with Undo; a post's sheet with its links; moving
// a post; Everything else's search; the rest of the year; Settings in the standard order, and a club
// changing the pickup line; ?item= from Calendar; Calendar's School layer; both designs; dark mode;
// and nothing tripping the page's Content Security Policy. No phone talks to Google here.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node school/scripts/app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import assert from 'assert/strict';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const TZ = 'America/New_York';
process.env.TZ = TZ;
const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

// the posts, read here by the real sort.js from the made-up emails
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'school/sort.js'), 'utf8'));
const F = await import(path.join(ROOT, 'school/scripts/fixtures.mjs'));
const ITEMS = F.ALL.flatMap(m => globalThis.SchoolSort.readEmail(m));
const NOW = new Date('2026-10-28T19:00:00-04:00');

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

const browser = await chromium.launch();
const errors = [], google = [];
async function newPage(scheme, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, timezoneId: TZ, locale: 'en-US' });
  await ctx.route(/^https:\/\/([a-z0-9-]+\.)*(google|googleapis|parentsquare)\.com\//, route => { google.push(route.request().url()); return route.abort(); });
  await ctx.route('**/aOS/api/**', route => route.fulfill({ status: 404, body: '{}' }));
  // walkthroughs as already seen, the sky held at day
  extra = Object.assign({ 'aos.seen': JSON.stringify({ school: '999' }), 'aos.sky': 'day', 'aos.signin.asked': '1' }, extra);
  await ctx.addInitScript(extra => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, extra);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource|401|404|503/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { window.__csp = (window.__csp || []).concat(e.violatedDirective + ' ' + e.blockedURI); }));
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    window.__toasts = [];
    const m = document.getElementById('toastMsg');
    if (m) new MutationObserver(rs => rs.forEach(() => window.__toasts.push(m.textContent))).observe(m, { childList: true });
  }));
  return { ctx, page };
}
const seeded = (more = {}) => Object.assign({ 'allison-school-v1-items': JSON.stringify(ITEMS), 'allison-school-v1-scan': String(NOW.getTime() - 5 * 6e4) }, more);
const shot = (page, name) => SHOTS ? page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }) : null;
let n = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); n++; console.log('ok -', name); }
  catch (e) { failed++; console.log('not ok -', name); console.log(e && e.stack || e); }
}
const texts = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
const open = async (page, url = '/school/') => { await page.goto(BASE + url); await page.waitForFunction(() => window.__school); await page.waitForTimeout(400); };

await test('no posts yet: says so, and offers Connect Gmail', async () => {
  const { ctx, page } = await newPage('light');
  await open(page);
  assert.match(await page.textContent('#main .empty'), /No school news yet/);
  assert.equal((await page.textContent('#main .btn')).trim(), 'Connect Gmail');
  await shot(page, 'empty');
  await ctx.close();
});

await test('the six sections, on a Wednesday evening', async () => {
  const { ctx, page } = await newPage('light', seeded({ 'allison-school-v1-prefs': JSON.stringify({ name: 'Ava', lane: 'Lane 1' }) }));
  await open(page);
  const heads = await texts(page, '#main .sechead');
  assert.deepEqual(heads, ['Tomorrow · Thu, Oct 29', 'Needs you', 'Coming up', 'From the class', 'Everything else', 'Links']);
  const top = await texts(page, '#main .rgroup.focus .row');
  assert.ok(top.some(t => /Wear Pink on THURSDAY/.test(t)), top.join(' | '));
  assert.ok(top.some(t => /Character Dress Up/.test(t)));
  assert.ok(top.some(t => /Pickup 3:15 pm–3:40 pm, Lane 1\./.test(t)), 'pickup');
  assert.ok(!top.some(t => /Basketball/.test(t)), 'not another grade’s');
  assert.match(await page.textContent('#sub'), /Ava · Kindergarten · Lena Rivera/, 'the child, from Settings and the emails');
  const needs = await texts(page, '#main .rgroup:nth-of-type(2) .row');
  assert.ok(needs.some(t => /Week 13 Newsletter/.test(t)), needs.join(' | '));
  assert.ok(needs.some(t => /Kindergarten Book Buddies.*Due Fri, Nov 6/.test(t)));
  assert.ok(!needs.some(t => /November Movie Night/.test(t)), 'answered already');
  const coming = await texts(page, '#main .rgroup:nth-of-type(3) .row');
  assert.ok(coming.some(t => /^Fri.*Oct 30.*No school/.test(t)), coming.join(' | '));
  assert.ok(coming.some(t => /STEAM Identity Day Events/.test(t)));
  assert.ok(coming.some(t => /See the rest of the year/.test(t)));
  const cls = await texts(page, '#main .rgroup:nth-of-type(4) .row');
  assert.ok(cls.some(t => /Week 14 Newsletter/.test(t) && /New/.test(t)), cls.join(' | '));
  const links = await texts(page, '#main .rgroup:nth-of-type(6) .row');
  assert.ok(links.some(t => /T1 Report Card/.test(t)), links.join(' | '));
  assert.ok(links.some(t => /Payments/.test(t)));
  await shot(page, 'sections');
  await ctx.close();
});

await test('Mark done takes an ask away, and Undo brings it back', async () => {
  const { ctx, page } = await newPage('light', seeded());
  await open(page);
  const sel = '#main .rgroup:nth-of-type(2) .row';
  const before = (await texts(page, sel)).length;
  await page.click('#main [data-done]:near(:text("Week 13 Newsletter"))');
  await page.waitForTimeout(150);
  assert.equal((await texts(page, sel)).length, before - 1);
  assert.ok((await page.evaluate(() => window.__toasts)).includes('Marked done.'));
  await page.click('#toastAct');
  await page.waitForTimeout(150);
  assert.equal((await texts(page, sel)).length, before);
  await ctx.close();
});

await test('a post: what it says, its dates, ParentSquare and Gmail; moving it', async () => {
  const { ctx, page } = await newPage('light', seeded());
  await open(page);
  await page.click('#main [data-open]:has-text("Character Dress Up")');
  await page.waitForSelector('#itemSheet:not([hidden])');
  const body = await page.textContent('#itemBody');
  assert.match(body, /Kindergarten students can dress up/);
  assert.match(body, /Lena Rivera · Homeroom_Rivera/);
  assert.match(body, /Thu, Oct 29/);
  assert.match(await page.getAttribute('#itemBody a:has-text("Open in ParentSquare")', 'href'), /^https:\/\/www\.parentsquare\.com\/feeds\/1004/);
  assert.match(await page.getAttribute('#itemBody a:has-text("Open in Gmail")', 'href'), /^https:\/\/mail\.google\.com\/mail\/u\/0\/#all\/d1/);
  assert.equal(await page.getAttribute('#itemSheet [role="dialog"]', 'aria-modal'), 'true');
  await page.click('#itemBody [data-move]');
  await page.waitForTimeout(100);
  assert.ok((await page.evaluate(() => window.__toasts)).includes('Moved to Everything else.'));
  await page.click('#itemSheet .okbtn');
  assert.ok(!(await texts(page, '#main .rgroup:nth-of-type(4) .row')).some(t => /Character Dress Up/.test(t)), 'gone from From the class');
  await ctx.close();
});

await test('Everything else: other grades are there, and search finds them', async () => {
  const { ctx, page } = await newPage('light', seeded());
  await open(page);
  await page.click('[data-act="list:rest"]');
  await page.waitForSelector('#listSheet:not([hidden])');
  assert.equal(await page.textContent('#listLbl'), 'Everything else');
  await page.fill('#listQ', 'basketball');
  await page.waitForTimeout(100);
  const rows = await texts(page, '#listBody .row');
  assert.deepEqual(rows.map(r => /4th and 5th grade Basketball/.test(r)), [true]);
  await page.click('#listSheet .okbtn');
  await page.click('[data-act="list:year"]');
  const year = await texts(page, '#listBody .row');
  assert.ok(year.some(t => /Fall Break/.test(t)) && year.some(t => /Winter Break/.test(t)), year.join(' | '));
  await ctx.close();
});

await test('Settings: the standard sections, and a club changes that day’s pickup', async () => {
  const { ctx, page } = await newPage('light', seeded());
  await open(page);
  await page.click('#moreBtn');
  await page.waitForSelector('#moreSheet:not([hidden])');
  assert.equal(await page.textContent('#moreLbl'), 'Settings');
  assert.deepEqual(await texts(page, '#moreBody .st-lbl'), ['Design', 'Your child', 'After school', 'Connected accounts', 'Your data', 'Family account']);
  assert.match(await page.textContent('#moreBody'), /From the emails: Homeroom_Rivera/);
  await page.fill('#club4', 'Chess Club');
  await page.dispatchEvent('#club4', 'change');
  await page.click('#moreSheet .okbtn');
  const top = await texts(page, '#main .rgroup.focus .row');
  assert.ok(top.some(t => /Chess Club until 3:50 pm\. Pickup at 3:50 pm\./.test(t)), top.join(' | '));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('allison-school-v1-prefs')).club4), 'Chess Club');
  await ctx.close();
});

await test('?item= opens that post (from Calendar’s School layer)', async () => {
  const { ctx, page } = await newPage('light', seeded());
  await open(page, '/school/?item=d1:3');
  await page.waitForSelector('#itemSheet:not([hidden])');
  assert.match(await page.textContent('#itemBody'), /Character Dress Up/);
  await ctx.close();
});

await test('Calendar’s School layer goes to your family account, signed in, with no links', async () => {
  const { ctx, page } = await newPage('light', seeded({ 'aos.session': JSON.stringify({ token: 'made-up-session', user: { id: 'u1', name: 'Pat' } }) }));
  const sent = [];
  await ctx.route('**/aOS/api/layer', async route => { if (route.request().method() === 'POST') sent.push(JSON.parse(route.request().postData() || '{}')); await route.fulfill({ status: 200, body: '{"ok":true}' }); });
  await open(page);
  await page.evaluate(() => window.__school.render());
  await page.waitForTimeout(5500);   // shared 1.5 s after load, sent 3 s after the last change (home/welcome.js)
  const got = sent.find(b => b.app === 'school');
  assert.ok(got, 'sent');
  assert.ok(got.data.items.some(x => x.kind === 'off' && x.date === '2026-10-30'));
  assert.ok(!JSON.stringify(got).includes('parentsquare.com'));
  await ctx.close();
});

await test('both designs, light and dark: Vintage by default, Standard (Sea glass) when picked', async () => {
  for (const scheme of ['light', 'dark']) {
    const V = await newPage(scheme, seeded());
    await open(V.page);
    assert.equal(await V.page.evaluate(() => document.documentElement.dataset.look), 'vintage');
    assert.equal(await V.page.evaluate(() => document.getElementById('vintage').media), 'all');
    assert.match(await V.page.$eval('body', e => getComputedStyle(e).fontFamily), /Futura/);
    assert.equal(await V.page.$eval('.rgroup.focus', e => getComputedStyle(e).borderRadius), '20px');
    await shot(V.page, 'vintage-' + scheme);
    await V.ctx.close();
    const G = await newPage(scheme, seeded({ 'design.school': 'glass' }));
    await open(G.page);
    assert.equal(await G.page.evaluate(() => document.documentElement.dataset.look), 'glass');
    assert.equal(await G.page.evaluate(() => document.getElementById('vintage').media), 'not all');
    assert.equal(await G.page.$eval('.rgroup.focus', e => getComputedStyle(e).borderRadius), '22px');
    await shot(G.page, 'glass-' + scheme);
    await G.ctx.close();
  }
});

await test('no script errors, nothing the policy blocks, and nothing sent to Google', async () => {
  const { ctx, page } = await newPage('light', seeded());
  await open(page);
  await page.click('#main [data-open]:has-text("Week 14 Newsletter")');
  await page.waitForTimeout(300);
  const csp = await page.evaluate(() => window.__csp || []);
  assert.deepEqual(csp.filter(c => !/posts\.parentsquare\.com/.test(c)), []);
  assert.deepEqual(errors, []);
  assert.deepEqual(google.filter(u => !/posts\.parentsquare\.com/.test(u)), [], 'no Gmail call without a sign-in');
  await ctx.close();
});

await browser.close();
server.close();
console.log(n + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
