// Drives the Podcasts app in headless Chromium at iPhone size, against stubbed
// feeds: it opens with a seeded library (shows, a saved episode, history), the
// tabs and lists draw, and the optional Google Sheet backup works end to end:
// the real google-sheet-sync.gs, run in Node on an in-memory Sheet, answers the
// app's requests. It checks the request is exactly {secret, action, v, device,
// follows, saved, hist} with the shapes the script reads (and nothing else: no
// episode lists, progress, queue or settings), the error text, an unfollow
// reading "No", that the progress ticks of a playing episode don't send
// anything, the setup link, the IndexedDB copy of the link and phone id, and
// Disconnect. Also that nothing trips the page's Content Security Policy.
// Both designs (../home/design.js): Vintage, the default, drawn in the Retro look, light and dark
// (Futura, flat cream or walnut cards, a mustard thumb, an orange primary button, the shapes behind
// the title, the player and its scrubber; the sky held at day, aos.sky), and Standard (Sea glass);
// Settings > Design switches between them at once and keeps the choice; and the old Podcasts Vintage
// address (served from podcasts/, as the deploy does) moves that app's data on the phone, its
// localStorage and both its databases, over to Podcasts' names, with its feed requests going to
// Podcasts' route (../podcasts/api/).
// Screenshots go to the folder given as the second argument.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node podcasts/scripts/app-test.mjs [repo root] [screenshot dir]
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
const FOLDER = path.basename(path.resolve(new URL('..', import.meta.url).pathname));   // podcasts
const APP_ID = FOLDER;

// ---- a static server for the repo ----
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  p = p.replace(/^\/podcastsvintage\//, '/podcasts/');   // the old Podcasts Vintage address: the deploy copies podcasts/ there (news.yml)
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;

// ---- made-up shows and episodes ----
const NOW = Date.now(), DAY = 86400e3;
const KEY = 'allison-podcasts-v1', OLD_KEY = 'allison-podcastsv-v1';   // Podcasts', and the old Podcasts Vintage app's
const feedUrl = n => 'https://feeds.example.com/' + n + '.xml';
const rss = (title, n) => '<?xml version="1.0"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>' + title + '</title><itunes:author>An Author</itunes:author><description>About ' + title + '</description>'
  + [1, 2, 3].map(i => '<item><title>' + title + ' episode ' + i + '</title><guid>' + n + '-' + i + '</guid><pubDate>' + new Date(NOW - i * 2 * DAY).toUTCString() + '</pubDate><itunes:duration>' + (1800 + i * 60) + '</itunes:duration><enclosure url="https://media.example.com/' + n + '-' + i + '.mp3" type="audio/mpeg" length="1000"/><description>Notes for ' + i + '. Jump to 12:34.</description></item>').join('')
  + '</channel></rss>';
const ep = (sid, i, st, extra) => Object.assign({ k: sid + '|' + sid + '-' + i, sid, t: st + ' episode ' + i, d: NOW - i * 2 * DAY, u: 'https://media.example.com/' + sid + '-' + i + '.mp3', v: false, dur: 1800 + i * 60, img: '', st, sa: '', feed: feedUrl(sid), link: 'https://example.com/ep/' + sid + '-' + i, s: '', sn: 0, en: 0, x: '' }, extra);
const seed = () => JSON.stringify({
  follows: [
    { id: 'alpha', feed: feedUrl('alpha'), title: 'Alpha Show', author: 'An Author', art: '', genre: 'News', at: NOW - 9 * DAY, latest: NOW - 2 * DAY },
    { id: 'beta', feed: feedUrl('beta'), title: 'Beta Show', author: 'An Author', art: '', genre: 'Comedy', at: NOW - 5 * DAY, latest: NOW - 2 * DAY }
  ],
  prog: { 'alpha|alpha-2': { t: 300, d: 1920, at: NOW - 3600e3 }, 'beta|beta-1': { p: true, t: 0, d: 1860, at: NOW - 7200e3 } },
  saved: [ep('beta', 3, 'Beta Show')],
  queue: [],
  hist: [ep('alpha', 2, 'Alpha Show'), ep('beta', 1, 'Beta Show')],
  now: null, set: { back: 15, fwd: 30, speed: 1, auto: true, cc: 'us' }, lastRefresh: NOW, lastClean: NOW
});

// 20 seconds of silence (8 kHz, 8-bit), so an episode can really play
const WAV = (() => { const n = 8000 * 20, b = Buffer.alloc(44 + n, 128); b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); return b; })();

// ---- the Sheet: the real script on an in-memory Sheet ----
const SHEET_URL = 'https://script.google.com/macros/s/TEST/exec', SHEET_SECRET = 'test-secret-phrase';
const GS = path.join(ROOT, 'podcasts', 'google-sheet-sync.gs');
const browser = await chromium.launch();
const errors = [];
async function newPage(scheme, extra = {}, sheet = null) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, locale: 'en-US' });
  const posts = [];
  await ctx.route('**/' + FOLDER + '/api/**', route => route.fulfill({ status: 404, contentType: 'text/html', body: '<html></html>' }));
  await ctx.route(/^https:\/\/feeds\.example\.com\//, route => {
    const n = route.request().url().match(/\/(\w+)\.xml/)[1];
    route.fulfill({ status: 200, contentType: 'application/rss+xml', headers: { 'access-control-allow-origin': '*' }, body: rss(n === 'alpha' ? 'Alpha Show' : 'Beta Show', n) });
  });
  await ctx.route(/^https:\/\/media\.example\.com\//, route => route.fulfill({ status: 200, contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: WAV }));
  if (sheet) await ctx.route(/^https:\/\/script\.google(usercontent)?\.com\//, route => {
    const req = route.request(), cors = { 'access-control-allow-origin': '*' };
    if (req.method() === 'POST') { posts.push({ ct: req.headers()['content-type'], body: JSON.parse(req.postData()) }); return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(sheet.post(req.postData())) }); }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(sheet.get()) });
  });
  // the sky held at day, so the colours don't depend on the hour; a key given as null is left out
  extra = Object.assign({ 'aos.seen': JSON.stringify({ [APP_ID]: '999' }), 'aos.sky': 'day', [KEY]: seed() }, extra);
  await ctx.addInitScript(extra => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(extra)) if (v != null) localStorage.setItem(k, v);
  }, extra);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource|404/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { window.__csp = (window.__csp || []).concat(e.violatedDirective + ' ' + e.blockedURI); }));
  return { ctx, page, posts };
}
const shot = (page, name) => SHOTS ? page.screenshot({ path: path.join(SHOTS, name + '.png') }) : null;
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const connected = p => p.waitForFunction(() => window.__podcasts.sheetState() === 'ok' && !document.getElementById('syOn').hidden && !document.getElementById('syConnect').disabled);
const openSettings = async page => { await page.click('[data-tab="lib"]'); await page.click('#setBtn'); await page.waitForSelector('#setSheet:not([hidden])'); await page.waitForTimeout(500); };

await test('opens with the seeded library: Home, Library (shows, Saved, History) and Settings, no script errors', async () => {
  const P = await newPage('light');
  const p = P.page;
  await p.goto(BASE + '/' + FOLDER + '/'); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(900);
  assert.match(await p.textContent('#homeView .title'), /Listen Now/);
  await shot(p, '01-home-light');
  await p.click('[data-tab="lib"]'); await p.waitForTimeout(400);
  assert.equal(await p.$$eval('#libBody .stile', e => e.length), 2, 'two followed shows');
  await shot(p, '02-library-light');
  await p.click('#libChips [data-act="lib:saved"]'); await p.waitForTimeout(300);
  assert.equal(await p.$$eval('#libBody .ep', e => e.length), 1, 'one saved episode');
  await p.click('#libChips [data-act="lib:hist"]'); await p.waitForTimeout(300);
  assert.equal(await p.$$eval('#libBody .ep', e => e.length), 2, 'two in history');
  await shot(p, '03-history-light');
  await p.click('#libChips [data-act="lib:shows"]');
  await openSettings(p);
  assert.match(await p.textContent('#setSheetBtn'), /Google Sheet backup\s*Not connected/);
  await shot(p, '04-settings-light');
  assert.deepEqual(await p.evaluate(() => window.__csp || []), []);
  await P.ctx.close();
});

await test('Google Sheet backup: the form, its errors, and connecting sends exactly the three lists and this phone', async () => {
  const sheet = fakeSheet(GS, SHEET_SECRET);
  const P = await newPage('light', {}, sheet), p = P.page;
  await p.goto(BASE + '/' + FOLDER + '/'); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(500);
  await openSettings(p);
  await p.click('#setSheetBtn'); await p.waitForSelector('#syncSheet:not([hidden])'); await p.waitForTimeout(400);
  assert.equal(await p.isVisible('#syForm'), true); assert.equal(await p.isHidden('#syOn'), true);
  assert.match(await p.inputValue('#syUrl'), /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/, 'the owner’s Sheet link is filled in');
  assert.equal(await p.inputValue('#sySecret'), '');
  await shot(p, '05-sheet-form-light');
  await p.fill('#syUrl', 'https://example.com/x'); await p.fill('#sySecret', 'abc'); await p.click('#syConnect');
  assert.match(await p.textContent('#syStatus'), /starts with https:\/\/script\.google\.com/);
  assert.equal(P.posts.length, 0, 'nothing is sent to a link that is not Apps Script');
  await p.fill('#syUrl', SHEET_URL); await p.fill('#sySecret', 'wrong'); await p.click('#syConnect');
  await p.waitForFunction(() => /secret code doesn.t match/.test(document.getElementById('syStatus').textContent));
  assert.equal(await p.evaluate(() => window.__podcasts.sheetCfg()), null, 'a wrong secret is not kept');
  await p.fill('#sySecret', SHEET_SECRET); await p.click('#syConnect');
  await connected(p);
  const sent = P.posts[P.posts.length - 1];
  assert.equal(sent.ct, 'text/plain;charset=utf-8');
  assert.deepEqual(Object.keys(sent.body).sort(), ['action', 'device', 'follows', 'hist', 'saved', 'secret', 'v']);
  assert.equal(sent.body.action, 'sync'); assert.equal(sent.body.v, 1); assert.equal(sent.body.secret, SHEET_SECRET);
  assert.match(sent.body.device, /^p[0-9a-f]{16}$/);
  assert.deepEqual(sent.body.follows.map(f => Object.keys(f).sort()), [['at', 'author', 'feed', 'genre', 'id', 'title'], ['at', 'author', 'feed', 'genre', 'id', 'title']]);
  assert.deepEqual(sent.body.follows.map(f => f.title), ['Alpha Show', 'Beta Show']);
  assert.equal(sent.body.follows[0].feed, feedUrl('alpha'));
  assert.deepEqual(Object.keys(sent.body.saved[0]).sort(), ['d', 'dur', 'k', 'link', 'show', 't', 'u']);
  assert.deepEqual(sent.body.saved[0], { k: 'beta|beta-3', show: 'Beta Show', t: 'Beta Show episode 3', d: sent.body.saved[0].d, dur: 1980, u: 'https://media.example.com/beta-3.mp3', link: 'https://example.com/ep/beta-3' });
  assert.deepEqual(Object.keys(sent.body.hist[0]).sort(), ['d', 'dur', 'k', 'link', 'played', 'show', 't', 'u']);
  assert.equal(sent.body.hist.length, 2);
  const h0 = sent.body.hist.find(h => h.k === 'alpha|alpha-2'), h1 = sent.body.hist.find(h => h.k === 'beta|beta-1');
  assert.ok(h0.played > 0, 'played is when the progress was last saved'); assert.equal(h1.played > 0, true);
  assert.equal(h0.show, 'Alpha Show');
  const text = JSON.stringify(sent.body);
  assert.ok(!/"(queue|prog|eps|set|now|h|img|sa|st|feedUrl)"/.test(text.replace(/"feed":/g, '')), 'no episode lists, progress, queue or settings are sent');
  // the Sheet got them, readable
  assert.deepEqual(sheet.tab('Shows').slice(1).map(r => [r[0], r[3]]), [['Alpha Show', 'Yes'], ['Beta Show', 'Yes']]);
  assert.equal(sheet.tab('Saved').length, 2); assert.equal(sheet.tab('History').length, 3);
  assert.match(await p.textContent('#syStatus'), /Connected\. Last backed up .*2 shows, 1 saved, 2 in history/);
  await shot(p, '06-sheet-connected-light');
  await p.click('#syncSheet .sheethead [data-close]'); await p.waitForTimeout(200);
  assert.match(await p.textContent('#setSheetBtn'), /Connected\. Last backed up/);
  assert.deepEqual(await p.evaluate(k => JSON.parse(localStorage.getItem(k + '-sheet')), KEY), { url: SHEET_URL, secret: SHEET_SECRET }, 'the link and code are kept on the phone');
  assert.deepEqual(await p.evaluate(() => window.__csp || []), [], 'the Content Security Policy lets Apps Script through');
  await P.ctx.close();
});

await test('Google Sheet backup: an unfollow reads No, a follow arrives, and the progress ticks of a playing episode send nothing', async () => {
  const sheet = fakeSheet(GS, SHEET_SECRET);
  const P = await newPage('light', { [KEY + '-sheet']: JSON.stringify({ url: SHEET_URL, secret: SHEET_SECRET }) }, sheet), p = P.page;
  await p.goto(BASE + '/' + FOLDER + '/'); await p.waitForFunction(() => window.__podcasts);
  await p.evaluate(() => window.__podcasts.setSheetDelay(300));
  await p.waitForFunction(() => window.__podcasts.sheetState() === 'ok', null, { timeout: 8000 });   // backs up by itself when the app opens
  assert.equal(P.posts.length >= 1, true);
  // a playing episode moves its "played" time on every few seconds; that alone is not a change, and pausing is
  await p.click('.upcard .playpill'); await p.waitForFunction(() => !document.getElementById('audio').paused);
  await p.waitForTimeout(900);
  const playing = P.posts.length;
  await p.evaluate(() => { const S = window.__podcasts.S, k = Object.keys(S.prog).find(k => !S.prog[k].p); S.prog[k].at = Date.now(); S.prog[k].t += 10; window.__podcasts.save(); });
  await p.waitForTimeout(1000);
  assert.equal(P.posts.length, playing, 'a progress tick of the playing episode sends nothing');
  await p.click('#miniPlay'); await p.waitForFunction(() => document.getElementById('audio').paused);
  await p.waitForTimeout(1200);
  assert.ok(P.posts.length > playing, 'pausing sends the new played time');
  const before = P.posts.length;
  // unfollow Beta in the app
  await p.click('[data-tab="lib"]'); await p.waitForSelector('#libBody .stile');
  await p.click('#libBody .stile[data-show="beta"]'); await p.waitForSelector('#showView:not([hidden])');
  await p.click('#showMore'); await p.click('#actRows .rowbtn.danger'); await p.waitForTimeout(1500);
  assert.equal(P.posts.length, before + 1, 'one more backup, a moment after the change');
  const last = P.posts[P.posts.length - 1].body;
  assert.equal(last.follows.length, 1); assert.equal(last.follows[0].title, 'Alpha Show');
  assert.deepEqual(sheet.tab('Shows').slice(1).map(r => [r[0], r[3]]), [['Alpha Show', 'Yes'], ['Beta Show', 'No']], 'the unfollowed show stays listed, as No');
  // saving an episode sends it
  await p.click('#showBack'); await p.waitForTimeout(300);
  await p.evaluate(() => { const S = window.__podcasts.S; S.hist = []; window.__podcasts.save(); });
  await p.waitForTimeout(1200);
  assert.equal(sheet.tab('History').length, 3, 'clearing the app’s history does not clear the Sheet’s');
  await P.ctx.close();
});

await test('Google Sheet backup: this phone’s id is kept, and the link, code and id come back from the IndexedDB copy if localStorage is emptied', async () => {
  const sheet = fakeSheet(GS, SHEET_SECRET);
  const P = await newPage('light', {}, sheet), p = P.page;
  await p.goto(BASE + '/' + FOLDER + '/'); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(500);
  await openSettings(p); await p.click('#setSheetBtn'); await p.waitForSelector('#syncSheet:not([hidden])');
  await p.fill('#syUrl', SHEET_URL); await p.fill('#sySecret', SHEET_SECRET); await p.click('#syConnect'); await connected(p);
  const device = await p.evaluate(() => window.__podcasts.device());
  const idb = await p.evaluate(() => new Promise(res => { const r = indexedDB.open('allison-podcasts-sheet', 1); r.onsuccess = () => { const db = r.result, tx = db.transaction('kv'), a = tx.objectStore('kv').get('sheet'), b = tx.objectStore('kv').get('device'); tx.oncomplete = () => res({ sheet: a.result, device: b.result }); }; }));
  assert.deepEqual(idb.sheet, { url: SHEET_URL, secret: SHEET_SECRET }); assert.equal(idb.device, device);
  await p.reload(); await p.waitForFunction(() => window.__podcasts);
  assert.equal(await p.evaluate(() => window.__podcasts.device()), device, 'the same phone after a reload');
  // localStorage emptied (but the database is not)
  await p.evaluate(k => { localStorage.removeItem(k + '-sheet'); localStorage.removeItem(k + '-sheet-at'); localStorage.removeItem(k + '-device'); }, KEY);
  const before = P.posts.length;
  await p.reload(); await p.waitForFunction(() => window.__podcasts);
  await p.waitForFunction(() => window.__podcasts.sheetCfg() && window.__podcasts.sheetState() === 'ok', null, { timeout: 8000 });
  assert.equal(await p.evaluate(() => window.__podcasts.device()), device, 'the phone id came back too, so the Sheet doesn’t see a new phone');
  assert.equal(P.posts[P.posts.length - 1].body.device, device); assert.ok(P.posts.length > before);
  await P.ctx.close();
});

await test('Google Sheet backup: a setup link fills in the form (and leaves the address bar), errors read plainly, Disconnect forgets it', async () => {
  const sheet = fakeSheet(GS, SHEET_SECRET);
  const P = await newPage('light', {}, sheet), p = P.page;
  const link = '#sync=' + Buffer.from(JSON.stringify({ u: SHEET_URL, s: SHEET_SECRET })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await p.goto(BASE + '/' + FOLDER + '/' + link); await p.waitForFunction(() => window.__podcasts);
  await p.waitForSelector('#syncSheet:not([hidden])');
  assert.equal(await p.inputValue('#syUrl'), SHEET_URL); assert.equal(await p.inputValue('#sySecret'), SHEET_SECRET);
  assert.equal(await p.evaluate(() => location.hash), '', 'the secret is out of the address bar');
  await p.click('#syConnect'); await connected(p);
  // Copy setup link
  await p.evaluate(() => { navigator.clipboard.writeText = async t => { window.__copied = t; }; });
  await p.click('#syShare'); await p.waitForTimeout(200);
  assert.match(await p.evaluate(() => window.__copied), new RegExp('/' + FOLDER + '/#sync='));
  // a script that is not Podcasts', and a network failure
  await p.click('#syOff'); await p.click('#syOff');
  assert.equal(await p.evaluate(() => window.__podcasts.sheetCfg()), null);
  assert.equal(await p.evaluate(k => localStorage.getItem(k + '-sheet'), KEY), null);
  await p.waitForTimeout(300);
  await p.evaluate(() => window.__podcasts.save());   // disconnected: nothing is scheduled
  await p.waitForTimeout(500);
  const count = P.posts.length;
  await p.waitForTimeout(500);
  assert.equal(P.posts.length, count);
  await P.ctx.route(/^https:\/\/script\.google\.com\/macros\/s\/DOWN\//, r => r.abort());
  await p.fill('#syUrl', 'https://script.google.com/macros/s/DOWN/exec'); await p.fill('#sySecret', 'x'); await p.click('#syConnect');
  await p.waitForFunction(() => /Couldn.t reach the Sheet/.test(document.getElementById('syStatus').textContent));
  await shot(p, '07-sheet-error-light');
  assert.deepEqual(await p.evaluate(() => window.__csp || []), []);
  await P.ctx.close();
});

await test('Vintage, the default design: the Retro look, light and dark: Futura, flat cream or walnut, mustard, orange, teal, atomic shapes, the player', async () => {
  for (const scheme of ['light', 'dark']) {
    const R = await newPage(scheme, { [KEY]: seed().replace('"lastRefresh":' + NOW, '"lastRefresh":0') }), rp = R.page;   // lastRefresh 0: the stubbed feeds load, so the lists have episodes
    await rp.route(/^https:\/\/media\.example\.com\//, route => route.fulfill({ status: 200, contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: WAV }));
    const reqs = [];
    rp.on('request', r => { const u = new URL(r.url()); if (u.pathname.includes('/api/') && !u.pathname.startsWith('/aOS/api/')) reqs.push(u.pathname); });   // aOS's own state call (welcome.js) is not the app's
    await rp.goto(BASE + '/' + FOLDER + '/'); await rp.waitForFunction(() => window.__podcasts); await rp.waitForSelector('#homeBody .rgroup'); await rp.waitForTimeout(600);
    assert.ok(reqs.length > 0 && reqs.every(x => x.startsWith('/podcasts/api/')), 'feed requests go to /podcasts/api/: ' + JSON.stringify(reqs));
    const q = (sel, props, pseudo) => rp.$eval(sel, (e, [props, pseudo]) => { const c = getComputedStyle(e, pseudo || null); return props.map(p => c[p]); }, [props, pseudo]);
    const cream = scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', ground = scheme === 'light' ? 'rgb(241, 223, 187)' : 'rgb(74, 57, 30)';
    const teal = scheme === 'light' ? 'rgb(31, 111, 107)' : 'rgb(79, 179, 171)', orange = scheme === 'light' ? 'rgb(201, 80, 42)' : 'rgb(216, 87, 42)', MUSTARD = 'rgb(227, 167, 47)';
    assert.equal(await rp.evaluate(() => document.documentElement.dataset.look), 'vintage', 'Vintage with nothing chosen');
    assert.equal(await rp.evaluate(() => document.getElementById('vintage').media), 'all');
    assert.match((await q('body', ['fontFamily']))[0], /Futura/, scheme + ': Futura');
    assert.equal(await rp.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'default', 'the status bar is not translucent (its white clock would vanish on the cream)');
    assert.equal(await rp.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content'), scheme === 'light' ? '#F1DFBB' : '#4A391E', 'the bar colour is the sky’s ground (home/sky.js)');
    assert.match(await rp.getAttribute('link[rel="apple-touch-icon"]', 'href'), /^icon-180\.png/, 'the Vintage icon');
    assert.equal((await q('body', ['backgroundColor']))[0], ground, scheme + ': the ground');
    assert.equal((await q('.ambient i:nth-child(1)', ['backgroundColor']))[0], MUSTARD, 'a mustard sun');
    assert.equal((await q('.ambient i:nth-child(2)', ['backgroundColor']))[0], teal, 'a teal dot');
    assert.equal((await q('.ambient i:nth-child(3)', ['backgroundColor']))[0], 'rgb(216, 87, 42)', 'a burnt-orange pill');
    assert.equal((await q('.title', ['fontSize']))[0], '44px');
    assert.equal((await q('.title', ['backgroundImage'], '::after'))[0].startsWith('url('), true, 'the three little bars under the title');
    const [bg, shadow, backdrop, radius] = await q('#homeBody .rgroup', ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
    assert.equal(bg, cream, 'the list is a flat card'); assert.equal(shadow, 'none'); assert.ok(backdrop === 'none' || backdrop === '', backdrop); assert.equal(radius, '20px');
    assert.equal((await q('.tabs .slthumb', ['backgroundColor']))[0], MUSTARD, 'a mustard thumb under the chosen tab');
    assert.equal((await q('#homeBody .chips .slthumb', ['backgroundColor']))[0], MUSTARD, 'a mustard thumb under All / Unplayed');
    assert.equal((await q('.tabs', ['backgroundColor']))[0], cream, 'the dock is a flat cream pill');
    assert.equal((await q('.playpill', ['backgroundColor']))[0], 'rgba(0, 0, 0, 0)', 'the play buttons are outlined, not filled');
    await shot(rp, '20-retro-home-' + scheme);
    // the player: play an episode (the stubbed media is 20 seconds of silence)
    await rp.click('.upcard .playpill'); await rp.waitForFunction(() => !document.getElementById('audio').paused);
    assert.equal((await q('#miniPlay', ['backgroundColor']))[0], orange, 'the mini player’s button is solid orange');
    assert.equal((await q('.mbar', ['backgroundColor']))[0], cream);
    await rp.click('#miniOpen'); await rp.waitForSelector('#np:not([hidden])'); await rp.waitForTimeout(900);
    const [nbg, nradius, nfilter] = await q('#np .sheet', ['backgroundColor', 'borderRadius', 'backdropFilter']);
    assert.equal(nbg, ground, 'Now Playing is on the ground colour'); assert.equal(nradius, '28px'); assert.ok(nfilter === 'none' || nfilter === '');
    assert.equal((await q('#npPlay', ['backgroundColor']))[0], orange, 'the big play button is solid orange');
    assert.equal((await q('#np .sheet', ['backgroundColor'], '::before'))[0], MUSTARD, 'a mustard sun in the corner');
    assert.equal((await q('#scrub', ['backgroundColor']))[0], 'rgba(0, 0, 0, 0)');
    // (a range's thumb and track can't be read with getComputedStyle: read the last rule written for each)
    const rule = sel => rp.evaluate(sel => { let last = ''; for (const sh of document.styleSheets) for (const r of sh.cssRules) if (r.selectorText === sel) last = r.cssText; return last; }, sel);
    assert.match(await rule('.scrub::-webkit-slider-thumb'), /var\(--mc-mustard\)/, 'the scrubber’s knob is mustard');
    assert.match(await rule('.scrub::-webkit-slider-runnable-track'), /var\(--mc-teal\)/, 'the played part of the track is teal');
    assert.equal((await q('#npBg', ['display']))[0], 'none', 'no blurred artwork glow');
    await shot(rp, '21-retro-nowplaying-' + scheme);
    await rp.click('#npSpeed'); await rp.waitForSelector('#actSheet:not([hidden])'); await rp.waitForTimeout(500);
    assert.equal((await q('#actSheet .sheet', ['backgroundColor']))[0], cream, 'the choices sheet is a flat panel');
    await rp.click('#actSheet .sheethead [data-close]'); await rp.click('#np .sheethead [data-close]'); await rp.waitForTimeout(400);
    // Settings: a mustard thumb, an orange Done and Connect button, an outlined Disconnect
    await rp.click('[data-tab="lib"]'); await rp.click('#setBtn'); await rp.waitForSelector('#setSheet:not([hidden])'); await rp.waitForTimeout(600);
    assert.equal((await q('#setSheet .okbtn', ['backgroundColor']))[0], orange, 'Done is solid orange');
    assert.equal((await q('#setBack .slthumb', ['backgroundColor']))[0], MUSTARD, 'a mustard thumb under the chosen option');
    await rp.click('#setSheetBtn'); await rp.waitForSelector('#syncSheet:not([hidden])'); await rp.waitForTimeout(500);
    assert.equal((await q('#syConnect', ['backgroundColor']))[0], orange, 'Connect is solid orange');
    await rp.click('#syncSheet .sheethead [data-close]'); await rp.waitForTimeout(400);
    assert.equal(await rp.getAttribute('#setDesign [data-design="vintage"]', 'aria-checked'), 'true', 'Settings > Design shows Vintage');
    await shot(rp, '22-retro-settings-' + scheme);
    assert.deepEqual(await rp.evaluate(() => window.__csp || []), []);
    await R.ctx.close();
  }
});

await test('Standard (Sea glass): the Vintage styles off, no sky, the Sea glass ground, icon, status bar and bar colour', async () => {
  for (const scheme of ['light', 'dark']) {
    const G = await newPage(scheme, { 'design.podcasts': 'glass', [KEY]: seed().replace('"lastRefresh":' + NOW, '"lastRefresh":0') }), gp = G.page;
    await gp.goto(BASE + '/' + FOLDER + '/'); await gp.waitForFunction(() => window.__podcasts); await gp.waitForSelector('#homeBody .rgroup'); await gp.waitForTimeout(600);
    const q = (sel, props) => gp.$eval(sel, (e, props) => { const c = getComputedStyle(e); return props.map(p => c[p]); }, props);
    assert.ok(await gp.evaluate(() => document.documentElement.dataset.look === 'glass' && document.getElementById('vintage').media === 'not all' && !document.documentElement.hasAttribute('data-sky')), 'data-look glass, the Vintage block off, no sky');
    assert.equal((await q('body', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(238, 242, 240)' : 'rgb(13, 18, 19)', scheme + ': the Sea glass ground');
    assert.doesNotMatch((await q('body', ['fontFamily']))[0], /Futura/);
    assert.notEqual((await q('#homeBody .rgroup', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', 'not a cream card');
    assert.notEqual((await q('.tabs .slthumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'not a mustard thumb');
    assert.notEqual((await q('.ambient i:nth-child(1)', ['filter']))[0], 'none', 'the blurred aurora, not the atomic shapes');
    assert.match(await gp.getAttribute('link[rel="apple-touch-icon"]', 'href'), /^icon-glass-180\.png/, 'the Sea glass icon');
    assert.equal(await gp.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'black-translucent');
    assert.equal(await gp.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content'), scheme === 'light' ? '#EEF2F0' : '#0D1213');
    await shot(gp, '30-glass-home-' + scheme);
    await gp.click('.upcard .playpill'); await gp.waitForFunction(() => !document.getElementById('audio').paused);
    await gp.click('#miniOpen'); await gp.waitForSelector('#np:not([hidden])'); await gp.waitForTimeout(900);
    assert.notEqual((await q('#npBg', ['display']))[0], 'none', 'the blurred artwork glow behind Now Playing');
    await shot(gp, '31-glass-nowplaying-' + scheme);
    await gp.click('#np .sheethead [data-close]'); await gp.waitForTimeout(400);
    await openSettings(gp);
    assert.equal(await gp.getAttribute('#setDesign [data-design="glass"]', 'aria-checked'), 'true', 'Settings > Design shows Standard');
    await shot(gp, '32-glass-settings-' + scheme);
    assert.deepEqual(await gp.evaluate(() => window.__csp || []), []);
    await G.ctx.close();
  }
});

await test('Settings > Design: the first section; Standard and back at once (the thumbs re-measured), kept across a reload', async () => {
  const P = await newPage('light'), p = P.page;
  const look = () => p.evaluate(() => document.documentElement.dataset.look);
  // the tab thumb covers the chosen tab exactly (Futura and the system font are different widths)
  const fits = () => p.evaluate(() => { const t = document.querySelector('.tabs .slthumb'), c = document.querySelector('.tab[aria-selected="true"]'); return Math.abs(t.offsetWidth - c.offsetWidth) < 1 && Math.abs(parseFloat(getComputedStyle(t).width) - c.offsetWidth) < 1; });
  await p.goto(BASE + '/' + FOLDER + '/'); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(600);
  assert.equal(await look(), 'vintage');
  await openSettings(p);
  assert.deepEqual(await p.$$eval('#setSheet .sheetbody > *', els => els.slice(0, 3).map(e => e.id || e.className)), ['label', 'setDesign', 'hint'], 'Design comes first: its label, the rows, the hint');
  assert.equal(await p.textContent('#setSheet .sheetbody > .label'), 'Design');
  assert.equal(await p.textContent('#setDesign + .hint'), 'Just on this phone, and at once.');
  assert.equal(await p.getAttribute('#setDesign [data-design="vintage"]', 'aria-checked'), 'true');
  await p.click('#setDesign [data-design="glass"]'); await p.waitForTimeout(300);
  assert.equal(await look(), 'glass', 'Standard at once');
  assert.equal(await p.getAttribute('#setDesign [data-design="glass"]', 'aria-checked'), 'true');
  assert.equal(await p.isVisible('#setSheet'), true, 'Settings stays open');
  assert.equal(await p.evaluate(() => localStorage.getItem('design.podcasts')), 'glass');
  await p.click('#setSheet .sheethead [data-close]'); await p.waitForTimeout(500);
  assert.ok(await fits(), 'the tab thumb fits the chosen tab in the system font');
  await p.reload(); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(600);
  assert.equal(await look(), 'glass', 'Standard is kept');
  await openSettings(p);
  // a re-render of the options leaves the rows working
  await p.click('#setBack [data-v="30"]'); await p.waitForTimeout(200);
  await p.click('#setDesign [data-design="vintage"]'); await p.waitForTimeout(300);
  assert.equal(await look(), 'vintage', 'Vintage at once');
  await p.click('#setSheet .sheethead [data-close]'); await p.waitForTimeout(500);
  assert.ok(await fits(), 'the tab thumb fits the chosen tab in Futura');
  await p.reload(); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(600);
  assert.equal(await look(), 'vintage', 'Vintage is kept');
  assert.equal(await p.evaluate(() => localStorage.getItem('design.podcasts')), 'vintage');
  assert.equal(await p.evaluate(k => JSON.parse(localStorage.getItem(k)).set.back, KEY), 30, 'the other settings work as before');
  await P.ctx.close();
});

// The old Podcasts Vintage app's databases, made on a page of the same site before the app first opens there
const seedOldDbs = (p, withNew) => p.evaluate(async ([NOW, feed, withNew]) => {
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const make = async (name, store, rows) => {
    const o = indexedDB.open(name, 1); o.onupgradeneeded = () => o.result.createObjectStore(store);
    const db = await req(o);
    await new Promise(res => { const t = db.transaction(store, 'readwrite'); for (const [k, v] of rows) t.objectStore(store).put(v, k); t.oncomplete = res; });
    db.close();
  };
  const show = title => ({ id: 'alpha', feed, title: 'Alpha Show', author: 'An Author', art: '', itArt: '', desc: '', link: '', genre: 'News', at: NOW,
    eps: [{ k: 'alpha|kept-1', sid: 'alpha', g: 'kept-1', u: 'https://media.example.com/alpha-9.mp3', v: false, t: title, d: NOW - 3600e3, dur: 1800, img: '', link: '', sn: 0, en: 0, x: '', h: '', s: '' }] });
  await make('allison-podcastsv', 'shows', [['alpha', show('An episode from Podcasts Vintage')]]);
  await make('allison-podcastsv-sheet', 'kv', [['device', 'p00000000000000aa']]);
  if (withNew) await make('allison-podcasts', 'shows', [['alpha', show('An episode from Podcasts')]]);
}, [NOW, feedUrl('alpha'), withNew]);
const dbRows = (p, name, store) => p.evaluate(([name, store]) => new Promise(res => { const r = indexedDB.open(name); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains(store)) return res(null); const t = db.transaction(store), a = t.objectStore(store).getAll(); t.oncomplete = () => { db.close(); res(a.result); }; }; }), [name, store]);

await test('the old Podcasts Vintage address: its data (localStorage and both databases) moved to Podcasts’ names once, what it had seen carried over, feeds through Podcasts’ route', async () => {
  const P = await newPage('light', { 'aos.seen': JSON.stringify({ podcastsvintage: '1.3' }), [KEY]: null, [OLD_KEY]: seed(), [OLD_KEY + '-tab']: 'lib', [OLD_KEY + '-device']: 'p00000000000000aa' }), p = P.page;
  await p.goto(BASE + '/podcastsvintage/sw.js'); await seedOldDbs(p, false);
  const reqs = [];
  p.on('request', r => { const u = new URL(r.url()); if (u.pathname.includes('/api/') && !u.pathname.startsWith('/aOS/api/')) reqs.push(u.pathname); });
  await p.goto(BASE + '/podcastsvintage/'); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(900);
  const got = await p.evaluate(([KEY, OLD_KEY]) => ({ lib: !document.getElementById('libView').hidden, tiles: document.querySelectorAll('#libBody .stile').length, seen: JSON.parse(localStorage.getItem('aos.seen') || '{}'), old: !!localStorage.getItem(OLD_KEY), now: JSON.parse(localStorage.getItem(KEY)), device: window.__podcasts.device(), look: document.documentElement.dataset.look }), [KEY, OLD_KEY]);
  assert.equal(got.lib, true, 'it opens on the tab it was on (Library)'); assert.equal(got.tiles, 2, 'its two shows');
  assert.equal(got.now.follows.length, 2); assert.equal(got.device, 'p00000000000000aa', 'the same phone to the Sheet');
  assert.equal(got.seen.podcasts, '1.3', 'what it had seen carries over (no walkthrough again)');
  assert.equal(got.old, true, 'nothing old is deleted'); assert.equal(got.look, 'vintage');
  assert.deepEqual((await dbRows(p, 'allison-podcasts', 'shows')).map(s => s.eps[0].t), ['An episode from Podcasts Vintage'], 'the episode database moved');
  assert.deepEqual(await dbRows(p, 'allison-podcasts-sheet', 'kv'), ['p00000000000000aa'], 'the Sheet backup copy moved');
  // (1.3's seen brings what's new since 1.3 on top: seen now, so the taps below reach the app)
  await p.evaluate(() => localStorage.setItem('aos.seen', JSON.stringify({ podcasts: '999', podcastsvintage: '1.3' })));
  await p.reload(); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(600);
  await p.click('#libBody .stile[data-show="alpha"]'); await p.waitForSelector('#showView:not([hidden])'); await p.waitForTimeout(400);
  assert.match(await p.textContent('#showBody'), /An episode from Podcasts Vintage/, 'its stored episodes show in the app');
  await p.click('#showBack'); await p.click('[data-tab="home"]'); await p.waitForTimeout(300);
  await p.click('#refreshBtn'); await p.waitForTimeout(1500);
  assert.ok(reqs.length > 0 && reqs.every(x => x.startsWith('/podcasts/api/')), 'feed requests go to /podcasts/api/ from the old address too: ' + JSON.stringify(reqs));
  // once only: a later change to the old keys is not copied again
  await p.evaluate(k => localStorage.setItem(k + '-tab', 'search'), OLD_KEY);
  await p.reload(); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(500);
  assert.equal(await p.evaluate(k => localStorage.getItem(k + '-tab'), KEY), 'home', 'moved once only');
  assert.deepEqual(await p.evaluate(() => window.__csp || []), []);
  await P.ctx.close();
});

await test('a phone with both: Podcasts’ own data and database are kept, the old app’s not copied over them', async () => {
  const P = await newPage('light', { 'aos.seen': JSON.stringify({ podcasts: '999', podcastsvintage: '999' }), [KEY + '-tab']: 'home', [OLD_KEY]: seed().replace('Alpha Show', 'Old Show'), [OLD_KEY + '-tab']: 'lib' }), p = P.page;
  await p.goto(BASE + '/podcastsvintage/sw.js'); await seedOldDbs(p, true);
  await p.goto(BASE + '/podcastsvintage/'); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(900);
  assert.equal(await p.evaluate(() => !document.getElementById('homeView').hidden), true, 'Podcasts’ own tab');
  assert.equal(await p.evaluate(k => JSON.parse(localStorage.getItem(k)).follows[0].title, KEY), 'Alpha Show', 'Podcasts’ own shows');
  assert.deepEqual((await dbRows(p, 'allison-podcasts', 'shows')).map(s => s.eps[0].t), ['An episode from Podcasts'], 'Podcasts’ own database');
  await P.ctx.close();
});

await test('no errors and no Content Security Policy violations', async () => {
  assert.deepEqual(errors, []);
});

await browser.close();
server.close();
console.log(n + ' tests passed');
