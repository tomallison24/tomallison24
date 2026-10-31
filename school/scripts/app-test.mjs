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
  assert.equal(await page.getAttribute('#itemBody a:has-text("Open in Mail")', 'href'), '../mail/?thread=d1', 'the email in Mail');
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
  await page.click('#moreBtn');
  await page.click('#cCare');
  assert.ok(await page.$('#cCareTo'), 'Care ends, once care is on');
  await page.click('#moreSheet .okbtn');
  const top2 = await texts(page, '#main .rgroup.focus .row');
  assert.ok(top2.some(t => /Chess Club until 3:50 pm, then after-school care until 6:00 pm\. Pickup by 6:00 pm\./.test(t)), top2.join(' | '));
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

await test('Remind me in Notes: a reminder the day before it’s due, in the family’s Notes, once', async () => {
  const { ctx, page } = await newPage('light', seeded({ 'aos.session': JSON.stringify({ token: 'made-up-session', user: { id: 'u1', name: 'Pat' } }) }));
  const sent = [];
  let todos = [];
  await ctx.route('**/sheet/api/notes', async route => {
    const b = JSON.parse(route.request().postData() || '{}'); sent.push(b);
    todos = todos.concat(b.todos || []);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ app: 'allison-notes-sync', aos: true, todos, lists: [] }) });
  });
  await open(page);
  await page.click('#main [data-open]:has-text("Kindergarten Book Buddies")');
  await page.click('#itemBody [data-remind]');
  await page.waitForFunction(() => (window.__toasts || []).some(t => /Notes/.test(t)));
  const t = sent.flatMap(b => b.todos || []);
  assert.equal(t.length, 1);
  assert.equal(t[0].title, 'Kindergarten Book Buddies');
  assert.equal(t[0].date, '2026-11-05', 'the day before it’s due');
  assert.match(t[0].notes, /From School, Sam Ortiz\nDue Fri, Nov 6/);
  assert.ok((await page.evaluate(() => window.__toasts)).includes('Reminder set in Notes for Thu, Nov 5.'));
  await page.click('#itemBody [data-remind]');
  await page.waitForFunction(() => (window.__toasts || []).includes('It’s in Notes already.'));
  await ctx.close();
});

await test('Remind me, signed out: says how, and sends nothing', async () => {
  const { ctx, page } = await newPage('light', seeded());
  let calls = 0;
  await ctx.route('**/sheet/api/**', route => { calls++; return route.fulfill({ status: 401, body: '{}' }); });
  await open(page);
  await page.click('#main [data-open]:has-text("Kindergarten Book Buddies")');
  await page.click('#itemBody [data-remind]');
  await page.waitForFunction(() => (window.__toasts || []).some(t => /Sign in/.test(t)));
  assert.equal(calls, 0);
  await ctx.close();
});

await test('the weather at drop-off and pickup on the top card; off in Settings', async () => {
  const { ctx, page } = await newPage('light', seeded({ 'allison-school-v1-loc': JSON.stringify({ lat: 40.0, lon: -75.0 }) }));
  let asked = '';
  await ctx.route('https://api.open-meteo.com/**', route => { asked = route.request().url(); return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ hourly: { time: ['2026-10-29T07:00', '2026-10-29T15:00'], temperature_2m: [10, 20], precipitation_probability: [5, 60], weather_code: [0, 61] } }) }); });
  await open(page);
  await page.waitForFunction(() => /Drop-off/.test(document.querySelector('#main .rgroup.focus').textContent));
  assert.match(asked, /latitude=40\.000&longitude=-75\.000&hourly=temperature_2m,precipitation_probability,weather_code/);
  const top = await texts(page, '#main .rgroup.focus .row');
  assert.ok(top.includes('Drop-off 50°, clear · Pickup 68°, rain, 60%.'), top.join(' | '));
  await page.click('#moreBtn');
  await page.click('#cWx');
  await page.click('#moreSheet .okbtn');
  assert.ok(!(await texts(page, '#main .rgroup.focus .row')).some(t => /Drop-off/.test(t)), 'off');
  await ctx.close();
});

await test('Ipsy in aOS: School’s tools read the school day, what needs you and the posts, and mark done with Undo', async () => {
  const { ctx, page } = await newPage('light', seeded());
  await open(page);
  const r = await page.evaluate(async () => {
    const T = window.AllisonOS.ipsyTools, out = {};
    out.app = T.app;
    out.day = (await T.tools.get_school_day({})).content;
    out.needs = (await T.tools.get_needs({})).content.needs.map(x => x.title);
    out.coming = (await T.tools.get_coming_up({ from: '2026-11-20', to: '2026-11-30' })).content.dates.map(d => d.date + ' ' + d.title);
    out.find = (await T.tools.find_posts({ query: 'basketball' })).content.posts.map(p => p.title + ' / ' + p.whose);
    out.read = (await T.tools.read_post({ id: 'd1:2' })).content;
    out.report = (await T.tools.read_post({ id: 'rep1' })).content;
    const ch = await T.tools.mark_done({ id: 's1' });
    out.change = ch.change.text;
    out.afterDone = (await T.tools.get_needs({})).content.needs.map(x => x.id);
    ch.change.undo();
    out.afterUndo = (await T.tools.get_needs({})).content.needs.map(x => x.id);
    out.label = T.label('find_posts', { query: 'pink' });
    return out;
  });
  assert.equal(r.app, 'school');
  assert.equal(r.day.date, '2026-10-29');
  assert.equal(r.day.school, 'yes');
  assert.ok(r.day.on_that_day.some(e => e.title === 'Wear Pink on THURSDAY'));
  assert.match(r.day.pickup, /Pickup 3:15 pm/);
  assert.ok(r.needs.includes('Kindergarten Book Buddies'));
  assert.ok(r.coming.some(c => /^2026-11-23 Fall Break/.test(c)) || r.coming.some(c => /2026-11-23 No school: Fall Break/.test(c)), r.coming.join(' | '));
  assert.deepEqual(r.find, ['4th and 5th grade Basketball / another grade']);
  assert.match(r.read.text, /final "Wear Pink"/);
  assert.ok(!JSON.stringify(r.read).includes('parentsquare.com'), 'no sign-in links go to Claude');
  assert.ok(!('text' in r.report), 'a report card’s words stay out');
  assert.equal(r.change, 'Marked done: Week 13 Newsletter_Important Updates (READ)');
  assert.ok(!r.afterDone.includes('s1') && r.afterUndo.includes('s1'));
  assert.equal(r.label, 'Looking through school posts for “pink”');
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
