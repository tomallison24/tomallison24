// Drives the Podcasts app in headless Chromium at iPhone size, against stubbed
// feeds: it opens with a seeded library (shows, a saved episode, history), the
// tabs and lists draw, and the family's Google Sheet works end to end: the real
// google-sheet-sync.gs, run in Node on an in-memory Sheet, answers the app's
// requests to **/sheet/api/podcasts (aOS's route, stood in for here), with who's
// asking taken from the session the page sends (aos.session). It checks that
// Settings has no Sheet controls (aOS links the Sheet: no status, Sync now, link
// or phrase); that signed out the app works and sends nothing, with no nagging
// toast; the request ({action, v, window, today, shows, saved, hist,
// prog, graves}: no phrase, no episode lists, Up Next or settings); two phones
// of one person kept the same (an unfollow, a follow, where you got to) while
// someone else's phone gets none of it; that the progress ticks of a playing
// episode don't sync; the 90 days of History and older on asking; and the
// owner's phone handing its old link and phrase to aOS, then forgetting them; no
// Sheet in aOS yet says nothing, and a real error shows one toast a session.
// Also that nothing trips the page's Content Security Policy.
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

// ---- the family's Sheet: the real script on an in-memory Sheet, reached through aOS ----
// (functions/sheet/api, stood in for here: each phone's session says who's asking)
const SHEET_URL = 'https://script.google.com/macros/s/TEST/exec', SHEET_SECRET = 'test-secret-phrase';
const GS = path.join(ROOT, 'podcasts', 'google-sheet-sync.gs');
const PEOPLE = { 'tok-tom': { id: 'tom', name: 'Tom', role: 'owner' }, 'tok-ella': { id: 'ella', name: 'Ella', role: 'member' } };
const session = tok => JSON.stringify({ token: tok, user: PEOPLE[tok], at: 1 });
const asAos = who => ({ key: SHEET_SECRET, who: who.id, name: who.name, ...(who.role === 'owner' ? { owner: '1' } : {}) });
const browser = await chromium.launch();
const errors = [];
// sheet: the fake Sheet the page's syncs reach (none: aOS says it isn't set up); posts: what each sync sent,
// with who sent it; claims: links and phrases handed over to aOS
async function newPage(scheme, extra = {}, sheet = null) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, locale: 'en-US' });
  const posts = [], claims = [];
  await ctx.route('**/' + FOLDER + '/api/**', route => route.fulfill({ status: 404, contentType: 'text/html', body: '<html></html>' }));
  await ctx.route('https://script.google.com/**', route => route.abort());   // no phone talks to Google itself any more
  await ctx.route('**/sheet/api/**', route => {
    const req = route.request(), who = PEOPLE[(req.headers().authorization || '').replace('Bearer ', '')];
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (!/\/sheet\/api\/podcasts(\/claim)?$/.test(new URL(req.url()).pathname) || req.headers()['x-sheet'] !== '1') return json({ error: 'app' }, 404);
    if (!who) return json({ error: 'signin' }, 401);
    if (req.url().endsWith('/claim')) { claims.push({ who: who.id, ...JSON.parse(req.postData()) }); return json({ configured: true }); }
    if (req.method() === 'GET') return json({ configured: !!sheet });
    if (!sheet) return json({ ok: false, error: 'no-sheet' }, 409);
    posts.push({ who: who.id, body: JSON.parse(req.postData()) });
    return json(sheet.post(req.postData(), asAos(who)));
  });
  await ctx.route(/^https:\/\/feeds\.example\.com\//, route => {
    const n = route.request().url().match(/\/(\w+)\.xml/)[1];
    route.fulfill({ status: 200, contentType: 'application/rss+xml', headers: { 'access-control-allow-origin': '*' }, body: rss(n === 'alpha' ? 'Alpha Show' : 'Beta Show', n) });
  });
  await ctx.route(/^https:\/\/media\.example\.com\//, route => route.fulfill({ status: 200, contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: WAV }));
  // Apple's directory, which the page asks itself when the route isn't there: answered here, empty, so no test reaches Apple
  await ctx.route(/^https:\/\/(itunes\.apple\.com|rss\.applemarketingtools\.com)\//, route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ results: [], feed: { results: [] } }) }));
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
  return { ctx, page, posts, claims };
}
const shot = (page, name) => SHOTS ? page.screenshot({ path: path.join(SHOTS, name + '.png') }) : null;
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const synced = (p, timeout = 8000) => p.waitForFunction(() => window.__podcasts && window.__podcasts.syncState() === 'ok', null, { timeout });
const openSettings = async page => { await page.click('#setBtn'); await page.waitForSelector('#setSheet:not([hidden])'); await page.waitForTimeout(500); };
// The family's Google Sheet has no controls in the app any more (aOS links it): none of them, anywhere.
const SHEET_UI = ['#setSheetBtn', '#sheetSub', '#syncSheet', '#syLbl', '#syStatus', '#syNow', '#syUrl', '#sySecret', '#syForm', '#syShare', '#syOff', '#syConnect'];
const noSheetUi = async page => {
  for (const gone of SHEET_UI) assert.equal(await page.$(gone), null, gone + ': no Sheet controls in the app');
  const set = await page.textContent('#setSheet');
  assert.doesNotMatch(set, /Backup Log|Sync now|Sign in to sync/, 'Settings has no Sheet row');
  assert.match(set, /Backup\s*Export shows/, 'Backup (Import / Export) stays');
};
const syncedAt = page => page.evaluate(k => [+localStorage.getItem(k + '-sync-at') || 0, localStorage.getItem(k + '-synced')], KEY);
const lib = page => page.evaluate(() => { const S = window.__podcasts.S; return { follows: S.follows.map(f => f.id), saved: S.saved.map(e => e.k), hist: S.hist.map(e => e.k), prog: S.prog, graves: S.graves }; });
const EMPTY = JSON.stringify({ follows: [], prog: {}, saved: [], queue: [], hist: [], now: null, set: { back: 15, fwd: 30, speed: 1, auto: true, cc: 'us' }, lastRefresh: NOW, lastClean: NOW });

await test('opens on Library, its one page (Listen Now and the tab bar are gone): Shows, New, Saved, History and Settings, no script errors', async () => {
  const P = await newPage('light', { [KEY + '-tab']: 'home', [KEY]: seed().replace('"lastRefresh":' + NOW, '"lastRefresh":0') });   // a phone that last had Listen Now open; lastRefresh 0: the feeds load
  const p = P.page;
  await p.goto(BASE + '/' + FOLDER + '/'); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(900);
  assert.equal(await p.$('#homeView'), null, 'no Listen Now');
  assert.equal(await p.$('.tabs'), null, 'no tab bar');
  assert.equal(await p.evaluate(() => !document.getElementById('libView').hidden), true, 'Library is open');
  assert.match(await p.textContent('#libView .title'), /Library/);
  assert.deepEqual(await p.$$eval('#libChips .chip', e => e.map(x => x.dataset.act)), ['lib:shows', 'lib:new', 'lib:saved', 'lib:hist']);
  assert.equal(await p.$$eval('#libBody .stile', e => e.length), 2, 'two followed shows');
  assert.equal(await p.evaluate(() => document.getElementById('tagbar').hidden), true, 'no tag pill before any show has a tag');
  assert.equal(await p.$('#libBody .tagchips'), null, 'and no tag chips in the page');
  await shot(p, '02-library-light');
  await p.click('#libChips [data-act="lib:new"]'); await p.waitForSelector('#libBody .rgroup .ep');
  assert.deepEqual(await p.$$eval('#libBody .chips .chip', e => e.map(x => x.dataset.act)), ['new:all', 'new:unplayed'], 'New: All / Unplayed');
  assert.ok(await p.$$eval('#libBody .ep', e => e.length) >= 4, 'the newest episodes of both shows');
  await shot(p, '01-new-light');
  // Search: the round button opens it, and its ✕ (or the button again) goes back to Library
  await p.click('#searchTab'); await p.waitForTimeout(600);
  assert.equal(await p.evaluate(() => !document.getElementById('searchView').hidden), true);
  assert.match(await p.textContent('#searchBody'), /No chart right now/, 'Top shows from the stand-in for Apple (the page asks Apple itself with no route), not the real one');
  await p.click('#searchBack'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => !document.getElementById('libView').hidden), true, 'back to Library');
  await p.click('#searchTab'); await p.waitForTimeout(300); await p.click('#searchTab'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => !document.getElementById('libView').hidden), true, 'the button again closes Search');
  await p.click('#libChips [data-act="lib:saved"]'); await p.waitForTimeout(300);
  assert.equal(await p.$$eval('#libBody .ep', e => e.length), 1, 'one saved episode');
  await p.click('#libChips [data-act="lib:hist"]'); await p.waitForTimeout(300);
  assert.equal(await p.$$eval('#libBody .ep', e => e.length), 2, 'two in history');
  await shot(p, '03-history-light');
  await p.click('#libChips [data-act="lib:shows"]');
  await openSettings(p);
  await noSheetUi(p);
  await shot(p, '04-settings-light');
  assert.deepEqual(await p.evaluate(() => window.__csp || []), []);
  await P.ctx.close();
});

await test('the family’s Google Sheet: no Sheet controls in Settings (aOS links it); signed out nothing is sent, quietly; signed in, your library goes to the Sheet as yours', async () => {
  const sheet = fakeSheet(GS, SHEET_SECRET);
  const P = await newPage('light', {}, sheet), p = P.page;
  await p.goto(BASE + '/' + FOLDER + '/'); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(900);
  await openSettings(p);
  await noSheetUi(p);
  assert.doesNotMatch(await p.textContent('#setSheet'), /secret|phrase you|web app link|setup link|disconnect/i);
  await shot(p, '05-sheet-signed-out-light');
  assert.equal(P.posts.length, 0, 'signed out, nothing is sent');
  assert.equal(await p.evaluate(() => window.__podcasts.syncState()), 'signin');
  assert.ok(await p.evaluate(() => document.getElementById('toast').hidden || !/Sign in|Sheet/.test(document.getElementById('toastMsg').textContent)), 'signed out: no toast about the Sheet');
  // the app works signed out: saving an episode is kept on this phone, with no sync
  await p.evaluate(() => { const S = window.__podcasts.S; S.saved = []; window.__podcasts.save(); });
  assert.deepEqual((await lib(p)).saved, []);
  assert.ok(Object.keys((await lib(p)).graves).includes('saved:beta|beta-3'), 'the unsave is remembered for when you sign in');
  await p.click('#setSheet .sheethead [data-close]');
  // signed in (as on a phone whose app has a family session)
  await p.evaluate(s => localStorage.setItem('aos.session', s), session('tok-tom'));
  await p.reload(); await p.waitForFunction(() => window.__podcasts); await synced(p);
  const sent = P.posts[0];
  assert.equal(sent.who, 'tom');
  assert.deepEqual(Object.keys(sent.body).sort(), ['action', 'graves', 'hist', 'prog', 'saved', 'shows', 'today', 'v', 'window']);
  assert.equal(sent.body.action, 'sync'); assert.equal(sent.body.v, 2); assert.equal(sent.body.window, 90);
  assert.match(sent.body.today, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(sent.body.shows.map(f => Object.keys(f).sort()), [['art', 'at', 'author', 'feed', 'genre', 'id', 'title', 'updated'], ['art', 'at', 'author', 'feed', 'genre', 'id', 'title', 'updated']], 'a show: no episode list, no error, no "latest"');
  assert.deepEqual(sent.body.shows.map(f => f.title).sort(), ['Alpha Show', 'Beta Show']);
  assert.deepEqual(sent.body.saved, [], 'unsaved while signed out');
  assert.ok(sent.body.graves['saved:beta|beta-3'] > 0, 'and its grave sent');
  assert.deepEqual(sent.body.hist.map(h => h.id).sort(), ['alpha|alpha-2', 'beta|beta-1']);
  assert.ok(sent.body.hist.every(h => h.pl > 0 && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && h.updated > 0 && h.u.startsWith('https://media.example.com/')), 'each play with when, its day and its audio');
  assert.deepEqual(Object.keys(sent.body.prog).length, 2);
  assert.deepEqual(sent.body.prog.map(x => [x.id, x.t, x.p]).sort(), [['alpha|alpha-2', 300, false], ['beta|beta-1', 0, true]], 'where you got to, and what\'s played');
  const text = JSON.stringify(sent.body);
  assert.ok(!/"(secret|device|follows|queue|eps|set|now|h|latest|err)":/.test(text), 'no phrase, phone id, episode lists, Up Next or settings');
  // the Sheet has them, as Tom's
  assert.deepEqual(sheet.tab('Shows').slice(1).map(r => [r[0], r[1]]), [['Tom', 'Alpha Show'], ['Tom', 'Beta Show']]);
  assert.equal(sheet.tab('Saved').length, 1, 'nothing saved');
  assert.deepEqual(sheet.tab('History').slice(1).map(r => [r[0], r[3], r[6]]).sort(), [['Tom', 'Alpha Show episode 2', '5:00 of 32:00'], ['Tom', 'Beta Show episode 1', 'Finished']]);
  // it synced by itself, and keeps when
  const [at, once] = await syncedAt(p);
  assert.ok(Date.now() - at < 60e3, 'synced just now'); assert.equal(once, '1', 'synced with the family Sheet once');
  await openSettings(p);
  await noSheetUi(p);
  await shot(p, '06-sheet-synced-light');
  const before = P.posts.length;
  await p.evaluate(() => window.__podcasts.sync()); await synced(p);
  assert.equal(P.posts.length, before + 1, 'a sync syncs');
  assert.ok((await syncedAt(p))[0] >= at);
  assert.deepEqual(await p.evaluate(() => window.__csp || []), []);
  await P.ctx.close();
});

await test('the family’s Google Sheet: your phones are kept the same (an unfollow, a follow, where you got to); someone else’s phone gets none of it', async () => {
  const sheet = fakeSheet(GS, SHEET_SECRET);
  const A = await newPage('light', { 'aos.session': session('tok-tom') }, sheet), a = A.page;
  await a.goto(BASE + '/' + FOLDER + '/'); await a.waitForFunction(() => window.__podcasts); await synced(a);
  await a.evaluate(() => window.__podcasts.setSyncDelay(300));
  // unfollow Beta on phone A
  await a.waitForSelector('#libBody .stile');
  await a.click('#libBody .stile[data-show="beta"]'); await a.waitForSelector('#showView:not([hidden])');
  const n0 = A.posts.length;
  await a.click('#showMore'); await a.click('#actRows .rowbtn.danger');
  await a.waitForFunction(n => window.__podcasts.syncState() === 'ok', n0); await a.waitForTimeout(1200);
  assert.ok(A.posts.length > n0, 'a sync a moment after the change');
  assert.ok(A.posts.at(-1).body.graves['shows:beta'] > 0, 'the unfollow went as a grave');
  assert.deepEqual(sheet.tab('Shows').slice(1).map(r => r[1]), ['Alpha Show'], 'and the Sheet follows only Alpha');
  await a.click('#showBack');
  // phone B: Tom's other phone, nothing on it yet
  const B = await newPage('light', { 'aos.session': session('tok-tom'), [KEY]: EMPTY }, sheet), b = B.page;
  await b.goto(BASE + '/' + FOLDER + '/'); await b.waitForFunction(() => window.__podcasts); await synced(b);
  await b.waitForFunction(() => window.__podcasts.S.follows.length === 1);
  let got = await lib(b);
  assert.deepEqual(got.follows, ['alpha'], 'what he follows');
  assert.deepEqual(got.saved, ['beta|beta-3'], 'his saved episode');
  assert.deepEqual(got.hist, ['alpha|alpha-2', 'beta|beta-1'], 'his History, newest first');
  assert.equal(got.prog['alpha|alpha-2'].t, 300, 'where he got to'); assert.equal(got.prog['beta|beta-1'].p, true, 'and what he played');
  await b.waitForSelector('#libBody .stile[data-show="alpha"]');
  await b.waitForFunction(() => /Alpha Show/.test(document.querySelector('#libBody .stile[data-show="alpha"]').textContent));
  await b.click('#libChips [data-act="lib:new"]'); await b.waitForSelector('#libBody .playpill[data-play="alpha|alpha-2"]');
  assert.match(await b.textContent('#libBody .playpill[data-play="alpha|alpha-2"]'), /left/, 'New on phone B: the episode he was part way through on phone A, with what’s left');
  await b.click('#libChips [data-act="lib:shows"]');
  // phone B follows a show (a shared link opens it) and saves nothing; phone A gets it
  await b.evaluate(() => window.__podcasts.setSyncDelay(300));
  await b.goto(BASE + '/' + FOLDER + '/?feed=' + encodeURIComponent(feedUrl('beta'))); await b.waitForFunction(() => window.__podcasts);
  await b.waitForSelector('#showView:not([hidden]) [data-act="follow-show"]'); await b.waitForTimeout(400);
  await b.evaluate(() => window.__podcasts.setSyncDelay(300));
  await b.click('[data-act="follow-show"]');
  await b.waitForFunction(() => window.__podcasts.S.follows.length === 2);
  await b.waitForTimeout(1500);
  assert.equal(sheet.tab('Shows').length, 3, 'the Sheet has it');
  await a.evaluate(() => window.__podcasts.sync()); await a.waitForTimeout(300); await synced(a);
  got = await lib(a);
  assert.equal(got.follows.length, 2, 'phone A follows it too');
  assert.ok((await a.evaluate(() => window.__podcasts.S.follows.map(f => f.title))).includes('Beta Show'));
  await B.ctx.close();
  // Ella's phone, signed in as her: none of Tom's
  const E = await newPage('light', { 'aos.session': session('tok-ella'), [KEY]: EMPTY }, sheet), e = E.page;
  await e.goto(BASE + '/' + FOLDER + '/'); await e.waitForFunction(() => window.__podcasts); await synced(e);
  got = await lib(e);
  assert.deepEqual([got.follows, got.saved, got.hist, Object.keys(got.prog)], [[], [], [], []], 'Ella\'s phone gets none of Tom\'s');
  assert.equal(E.posts.at(-1).who, 'ella');
  assert.deepEqual(await e.evaluate(() => window.__csp || []), []);
  await E.ctx.close(); await A.ctx.close();
});

await test('the family’s Google Sheet: the progress ticks of a playing episode don’t sync; pausing does', async () => {
  const sheet = fakeSheet(GS, SHEET_SECRET);
  const P = await newPage('light', { 'aos.session': session('tok-tom') }, sheet), p = P.page;
  await p.goto(BASE + '/' + FOLDER + '/'); await p.waitForFunction(() => window.__podcasts); await synced(p);
  await p.evaluate(() => window.__podcasts.setSyncDelay(300));
  await p.click('#libChips [data-act="lib:hist"]'); await p.click('#libBody .playpill[data-play="alpha|alpha-2"]'); await p.waitForFunction(() => !document.getElementById('audio').paused);
  await p.waitForTimeout(1200);   // playing it moves it to the top of History: that syncs
  const playing = P.posts.length;
  assert.ok(P.posts.at(-1).body.hist.some(h => h.id === 'alpha|alpha-2' && Date.now() - h.pl < 60e3), 'played just now');
  await p.evaluate(() => { const S = window.__podcasts.S, k = Object.keys(S.prog).find(k => !S.prog[k].p); S.prog[k] = Object.assign({}, S.prog[k], { at: Date.now(), t: S.prog[k].t + 10 }); window.__podcasts.save(); });
  await p.waitForTimeout(1000);
  assert.equal(P.posts.length, playing, 'a progress tick of the playing episode sends nothing');
  await p.click('#miniPlay'); await p.waitForFunction(() => document.getElementById('audio').paused);
  await p.waitForTimeout(1200);
  assert.ok(P.posts.length > playing, 'pausing syncs where you got to');
  assert.ok(P.posts.at(-1).body.prog.some(x => x.id === 'alpha|alpha-2' && Date.now() - x.at < 60e3));
  await P.ctx.close();
});

await test('the family’s Google Sheet: the phone keeps 90 days of History; older plays come back from the Sheet on asking', async () => {
  const sheet = fakeSheet(GS, SHEET_SECRET), TOM = PEOPLE['tok-tom'];
  const day = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const played = (sid, i, st, ago) => Object.assign(ep(sid, i, st), { id: sid + '|' + sid + '-' + i, pl: NOW - ago * DAY, date: day(NOW - ago * DAY), updated: NOW - ago * DAY });
  // on the Sheet already: a play 10 days ago, one 200 days ago, and one 500 days ago (from his other phone)
  sheet.post({ action: 'sync', shows: [], saved: [], hist: [played('alpha', 1, 'Alpha Show', 10), played('alpha', 3, 'Alpha Show', 200), played('beta', 2, 'Beta Show', 500)],
    prog: [{ id: 'alpha|alpha-3', t: 0, d: 1980, p: true, at: NOW - 200 * DAY, date: day(NOW - 200 * DAY), updated: NOW - 200 * DAY }], graves: {} }, asAos(TOM));
  // this phone: one play 120 days ago still on it, and a played mark 300 days ago
  const s = JSON.parse(seed());
  s.hist = [Object.assign(ep('beta', 3, 'Beta Show'), { pl: NOW - 120 * DAY })];
  s.prog = { 'beta|beta-3': { p: true, t: 0, d: 1980, at: NOW - 300 * DAY } };
  const P = await newPage('light', { 'aos.session': session('tok-tom'), [KEY]: JSON.stringify(s) }, sheet), p = P.page;
  await p.goto(BASE + '/' + FOLDER + '/'); await p.waitForFunction(() => window.__podcasts); await synced(p);
  assert.ok(P.posts[0].body.hist.some(h => h.id === 'beta|beta-3'), 'the first sync sends everything the phone has');
  await p.waitForFunction(() => window.__podcasts.S.hist.length === 1);
  let got = await lib(p);
  assert.deepEqual(got.hist, ['alpha|alpha-1'], 'the last 90 days: the 120-day-old play went from this phone');
  assert.ok(!Object.keys(got.graves).some(k => k.startsWith('hist:')), 'with no grave');
  assert.equal(got.prog['beta|beta-3'].p, true, 'what\'s played stays on the phone however old');
  assert.ok(sheet.tab('History').slice(1).some(r => r[3] === 'Beta Show episode 3'), 'the Sheet keeps it');
  assert.equal(P.posts[0].body.window, 90);
  // a second sync sends only the last 90 days of History
  await p.evaluate(() => window.__podcasts.sync()); await synced(p);
  assert.deepEqual(P.posts.at(-1).body.hist.map(h => h.id), ['alpha|alpha-1']);
  // Library > History > Show older: a year at a time from the Sheet
  await p.click('#libChips [data-act="lib:hist"]'); await p.waitForTimeout(300);
  assert.equal(await p.$$eval('#libBody .ep', e => e.length), 1);
  await p.click('[data-act="hist-older"]');
  await p.waitForFunction(() => document.querySelectorAll('#libBody .ep').length === 3);
  got = await lib(p);
  assert.deepEqual(got.hist, ['alpha|alpha-1', 'beta|beta-3', 'alpha|alpha-3'], 'the year before the 90 days, newest first');
  assert.equal(got.prog['alpha|alpha-3'].p, true, 'with what was played');
  await shot(p, '08-history-older-light');
  await p.click('[data-act="hist-older"]');
  await p.waitForFunction(() => document.querySelectorAll('#libBody .ep').length === 4);
  assert.deepEqual((await lib(p)).hist.at(-1), 'beta|beta-2', 'and the year before that');
  await p.click('[data-act="hist-older"]');
  await p.waitForFunction(() => document.getElementById('toastMsg').textContent === 'Nothing older in the family’s Google Sheet.' && !document.querySelector('[data-act="hist-older"]'));
  // what came back is kept until the next tidy-up, and doesn't make the phone sync again and again
  const n0 = P.posts.length;
  await p.evaluate(() => window.__podcasts.sync()); await p.waitForTimeout(2500);
  assert.ok(P.posts.length - n0 <= 1, 'one sync, not a loop: ' + (P.posts.length - n0));
  assert.equal((await lib(p)).hist.length, 4);
  assert.ok(P.posts.slice(n0).every(x => x.body.hist.length === 1), 'older plays are not sent back');
  assert.deepEqual(await p.evaluate(() => window.__csp || []), []);
  await P.ctx.close();
});

await test('the owner’s phone hands the Sheet link and phrase it kept over to aOS, then forgets them; an old setup link is only taken off the address', async () => {
  const sheet = fakeSheet(GS, SHEET_SECRET);
  const P = await newPage('light', { 'aos.session': session('tok-tom'), [KEY + '-sheet']: JSON.stringify({ url: SHEET_URL, secret: SHEET_SECRET }), [KEY + '-device']: 'p00000000000000aa', [KEY + '-sheet-at']: String(NOW) }, sheet), p = P.page;
  // the IndexedDB copy the one-way backup kept too
  await p.goto(BASE + '/' + FOLDER + '/sw.js');
  await p.evaluate(([url, secret]) => new Promise(res => { const o = indexedDB.open('allison-podcasts-sheet', 1); o.onupgradeneeded = () => o.result.createObjectStore('kv'); o.onsuccess = () => { const t = o.result.transaction('kv', 'readwrite'); t.objectStore('kv').put({ url, secret }, 'sheet'); t.objectStore('kv').put('p00000000000000aa', 'device'); t.oncomplete = () => { o.result.close(); res(); }; }; }), [SHEET_URL, SHEET_SECRET]);
  const link = '#sync=' + Buffer.from(JSON.stringify({ u: SHEET_URL, s: SHEET_SECRET })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await p.goto(BASE + '/' + FOLDER + '/' + link); await p.waitForFunction(() => window.__podcasts);
  assert.equal(await p.evaluate(() => location.hash), '', 'the phrase is out of the address bar');
  await p.waitForFunction(k => !localStorage.getItem(k + '-sheet'), KEY, { timeout: 8000 });
  assert.deepEqual(P.claims.at(-1), { who: 'tom', url: SHEET_URL, secret: SHEET_SECRET }, 'handed to aOS');
  const idbLeft = () => p.evaluate(() => new Promise(res => { const r = indexedDB.open('allison-podcasts-sheet', 1); r.onsuccess = () => { const t = r.result.transaction('kv'), a = t.objectStore('kv').getAll(); t.oncomplete = () => { r.result.close(); res(a.result.length); }; }; }));
  for (let i = 0; i < 40 && await idbLeft(); i++) await p.waitForTimeout(100);
  assert.equal(await idbLeft(), 0, 'and the IndexedDB copy, with the old phone id');
  assert.deepEqual(await p.evaluate(k => [localStorage.getItem(k + '-device'), localStorage.getItem(k + '-sheet-at')], KEY), [null, null], 'the one-way backup\'s phone id and time are gone');
  await synced(p);
  assert.ok(P.posts.every(x => !JSON.stringify(x.body).includes(SHEET_SECRET)), 'and never sent');
  assert.equal(await p.$('#syncSheet'), null, 'no setup sheet');
  await P.ctx.close();
  // Ella's phone with a link and phrase of its own: aOS has one, so it's forgotten (never claimed: she isn't the owner)
  const E = await newPage('light', { 'aos.session': session('tok-ella'), [KEY]: EMPTY, [KEY + '-sheet']: JSON.stringify({ url: SHEET_URL, secret: SHEET_SECRET }) }, sheet), e = E.page;
  await e.goto(BASE + '/' + FOLDER + '/'); await e.waitForFunction(() => window.__podcasts);
  await e.waitForFunction(k => !localStorage.getItem(k + '-sheet'), KEY, { timeout: 8000 });
  assert.deepEqual(E.claims, []);
  await E.ctx.close();
  // and with no Sheet in aOS yet, it says nothing (the owner sets it up in aOS), and the app keeps working
  const N = await newPage('light', { 'aos.session': session('tok-ella') }, null), np = N.page;
  await np.goto(BASE + '/' + FOLDER + '/'); await np.waitForFunction(() => window.__podcasts);
  await np.waitForFunction(() => window.__podcasts.syncState() === 'error');
  await np.evaluate(() => window.__podcasts.sync()); await np.waitForTimeout(300);
  assert.ok(await np.evaluate(() => document.getElementById('toast').hidden || !/Sheet/.test(document.getElementById('toastMsg').textContent)), 'no Sheet yet: no toast');
  assert.equal(await np.$$eval('#libBody .stile', e => e.length > 0), true, 'the app works');
  await N.ctx.close();
  // a real error: one toast a session, however many syncs go wrong
  const W = await newPage('light', { 'aos.session': session('tok-tom') }, { post: () => ({ ok: false, app: 'allison-podcasts-sync', aos: true, error: 'wrong-secret' }) }), wp = W.page;
  await wp.goto(BASE + '/' + FOLDER + '/'); await wp.waitForFunction(() => window.__podcasts);
  await wp.waitForFunction(() => document.getElementById('toastMsg').textContent === 'aOS’s phrase for the Podcasts Sheet doesn’t match its script any more. The owner updates it in aOS: Account → Google Sheets.');
  await wp.evaluate(() => { document.getElementById('toast').hidden = true; document.getElementById('toastMsg').textContent = ''; });
  for (let i = 0; i < 2; i++) await wp.evaluate(() => window.__podcasts.sync());
  await wp.waitForTimeout(300);
  assert.equal(await wp.evaluate(() => window.__podcasts.syncState()), 'error');
  assert.ok(W.posts.length >= 3, 'it kept trying');
  assert.ok(await wp.evaluate(() => document.getElementById('toast').hidden && !document.getElementById('toastMsg').textContent), 'no second toast');
  await W.ctx.close();
});

await test('signed out, the refresh on open and the Top shows chart ask nobody to sign in (the feeds are read quietly, the app keeps what it has); a tap on Refresh does', async () => {
  const P = await newPage('light', { [KEY]: seed().replace('"lastRefresh":' + NOW, '"lastRefresh":0') }), p = P.page;   // lastRefresh 0: the feeds are checked on open
  const calls = [];
  // the family's route, locked (functions/podcasts/api/_middleware.js): a 401 with no session
  await p.route('**/' + FOLDER + '/api/**', route => {
    const req = route.request(), who = PEOPLE[(req.headers().authorization || '').replace('Bearer ', '')];
    calls.push(new URL(req.url()).pathname + (who ? ' as ' + who.id : ' signed out'));
    if (!who) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'signin' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) });
  });
  await p.goto(BASE + '/' + FOLDER + '/'); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(2500);
  assert.ok(calls.some(c => c.startsWith('/' + FOLDER + '/api/feed')), 'the feeds were asked for on open: ' + JSON.stringify(calls));
  assert.equal(await p.$('#aos-signin'), null, 'no sign-in sheet for the refresh on open');
  assert.deepEqual(await p.evaluate(() => window.__podcasts.S.follows.map(f => f.id)), ['alpha', 'beta'], 'the library it has stays');
  await p.click('#searchTab'); await p.waitForTimeout(1200);   // the Top shows chart loads by itself
  assert.ok(calls.some(c => c.startsWith('/' + FOLDER + '/api/top')), 'the chart was asked for: ' + JSON.stringify(calls));
  assert.equal(await p.$('#aos-signin'), null, 'no sign-in sheet for the chart');
  assert.deepEqual(await p.evaluate(() => window.__csp || []), []);
  // a tap: Refresh (in Library now) asks for Face ID
  await p.click('#searchBack'); await p.waitForTimeout(300);
  await p.click('#refreshBtn');
  await p.waitForSelector('#aos-signin', { timeout: 5000 });
  assert.match(await p.textContent('#aos-signin'), /Continue with Face ID/, 'a tap raises the sign-in sheet');
  await p.click('#aos-signin .s-not'); await p.waitForTimeout(2500);
  assert.equal(await p.$('#aos-signin'), null, 'Not now closes it');
  await P.ctx.close();
});

await test('Vintage, the default design: the Retro look, light and dark: Futura, flat cream or walnut, mustard, orange, teal, atomic shapes, the player', async () => {
  for (const scheme of ['light', 'dark']) {
    const R = await newPage(scheme, { [KEY]: seed().replace('"lastRefresh":' + NOW, '"lastRefresh":0') }), rp = R.page;   // lastRefresh 0: the stubbed feeds load, so the lists have episodes
    await rp.route(/^https:\/\/media\.example\.com\//, route => route.fulfill({ status: 200, contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: WAV }));
    const reqs = [];
    rp.on('request', r => { const u = new URL(r.url()); if (u.pathname.includes('/api/') && !u.pathname.startsWith('/aOS/api/')) reqs.push(u.pathname); });   // aOS's own state call (welcome.js) is not the app's
    await rp.goto(BASE + '/' + FOLDER + '/'); await rp.waitForFunction(() => window.__podcasts); await rp.click('#libChips [data-act="lib:new"]'); await rp.waitForSelector('#libBody .rgroup'); await rp.waitForTimeout(600);
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
    const [bg, shadow, backdrop, radius] = await q('#libBody .rgroup', ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
    assert.equal(bg, cream, 'the list is a flat card'); assert.equal(shadow, 'none'); assert.ok(backdrop === 'none' || backdrop === '', backdrop); assert.equal(radius, '20px');
    assert.equal((await q('#libChips .slthumb', ['backgroundColor']))[0], MUSTARD, 'a mustard thumb under the chosen chip');
    assert.equal((await q('#libBody .chips .slthumb', ['backgroundColor']))[0], MUSTARD, 'a mustard thumb under All / Unplayed');
    assert.equal((await q('.fab', ['backgroundColor']))[0], cream, 'the Search button is a flat cream circle');
    assert.equal((await q('.playpill', ['backgroundColor']))[0], 'rgba(0, 0, 0, 0)', 'the play buttons are outlined, not filled');
    await shot(rp, '20-retro-new-' + scheme);
    // the player: play an episode (the stubbed media is 20 seconds of silence)
    await rp.click('#libBody .playpill[data-play="alpha|alpha-2"]'); await rp.waitForFunction(() => !document.getElementById('audio').paused);
    assert.equal((await q('#miniPlay', ['backgroundColor']))[0], orange, 'the mini player’s button is solid orange');
    assert.equal((await q('.mbar', ['backgroundColor']))[0], cream);
    await rp.click('#miniOpen'); await rp.waitForSelector('#np:not([hidden])'); await rp.waitForTimeout(900);
    const [nbg, nradius, nfilter] = await q('#np .sheet', ['backgroundColor', 'borderRadius', 'backdropFilter']);
    assert.equal(nbg, ground, 'Now Playing is on the ground colour'); assert.equal(nradius, '28px'); assert.ok(nfilter === 'none' || nfilter === '');
    assert.equal((await q('#npPlay', ['backgroundColor']))[0], orange, 'the big play button is solid orange');
    assert.equal((await q('#np .sheet', ['backgroundColor'], '::before'))[0], MUSTARD, 'a mustard sun in the corner');
    assert.equal((await q('#scrub', ['backgroundColor']))[0], 'rgba(0, 0, 0, 0)');
    // (a range's thumb and track can't be read with getComputedStyle: read the last rule written for each)
    const rule = sel => rp.evaluate(sel => { let last = ''; for (const sh of document.styleSheets) if (!sh.disabled && sh.media.mediaText !== 'not all') for (const r of sh.cssRules) if (r.selectorText === sel) last = r.cssText; return last; }, sel);
    assert.match(await rule('.scrub::-webkit-slider-thumb'), /var\(--mc-mustard\)/, 'the scrubber’s knob is mustard');
    assert.match(await rule('.scrub::-webkit-slider-runnable-track'), /var\(--mc-teal\)/, 'the played part of the track is teal');
    assert.equal((await q('#npBg', ['display']))[0], 'none', 'no blurred artwork glow');
    await shot(rp, '21-retro-nowplaying-' + scheme);
    await rp.click('#npSpeed'); await rp.waitForSelector('#actSheet:not([hidden])'); await rp.waitForTimeout(500);
    assert.equal((await q('#actSheet .sheet', ['backgroundColor']))[0], cream, 'the choices sheet is a flat panel');
    await rp.click('#actSheet .sheethead [data-close]'); await rp.click('#np .sheethead [data-close]'); await rp.waitForTimeout(400);
    // Settings: a mustard thumb, an orange Done
    await rp.click('#setBtn'); await rp.waitForSelector('#setSheet:not([hidden])'); await rp.waitForTimeout(600);
    assert.equal((await q('#setSheet .okbtn', ['backgroundColor']))[0], orange, 'Done is solid orange');
    assert.equal((await q('#setBack .slthumb', ['backgroundColor']))[0], MUSTARD, 'a mustard thumb under the chosen option');
    assert.equal((await q('#setSheet .sheet', ['backgroundColor']))[0], cream, 'Settings is a flat panel');
    assert.equal(await rp.getAttribute('#setDesign [data-design="vintage"]', 'aria-checked'), 'true', 'Settings > Design shows Vintage');
    await shot(rp, '22-retro-settings-' + scheme);
    assert.deepEqual(await rp.evaluate(() => window.__csp || []), []);
    await R.ctx.close();
  }
});

await test('Standard (Sea glass): the Vintage styles off, no sky, the Sea glass ground, icon, status bar and bar colour', async () => {
  for (const scheme of ['light', 'dark']) {
    const G = await newPage(scheme, { 'design.podcasts': 'glass', [KEY]: seed().replace('"lastRefresh":' + NOW, '"lastRefresh":0') }), gp = G.page;
    await gp.goto(BASE + '/' + FOLDER + '/'); await gp.waitForFunction(() => window.__podcasts); await gp.click('#libChips [data-act="lib:new"]'); await gp.waitForSelector('#libBody .rgroup'); await gp.waitForTimeout(600);
    const q = (sel, props) => gp.$eval(sel, (e, props) => { const c = getComputedStyle(e); return props.map(p => c[p]); }, props);
    assert.ok(await gp.evaluate(() => document.documentElement.dataset.look === 'glass' && document.getElementById('vintage').media === 'not all' && !document.documentElement.hasAttribute('data-sky')), 'data-look glass, the Vintage block off, no sky');
    assert.equal((await q('body', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(238, 242, 240)' : 'rgb(13, 18, 19)', scheme + ': the Sea glass ground');
    assert.doesNotMatch((await q('body', ['fontFamily']))[0], /Futura/);
    assert.notEqual((await q('#libBody .rgroup', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', 'not a cream card');
    assert.notEqual((await q('#libChips .slthumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'not a mustard thumb');
    assert.notEqual((await q('.ambient i:nth-child(1)', ['filter']))[0], 'none', 'the blurred aurora, not the atomic shapes');
    assert.match(await gp.getAttribute('link[rel="apple-touch-icon"]', 'href'), /^icon-glass-180\.png/, 'the Sea glass icon');
    assert.equal(await gp.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'black-translucent');
    assert.equal(await gp.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content'), scheme === 'light' ? '#EEF2F0' : '#0D1213');
    await shot(gp, '30-glass-home-' + scheme);
    await gp.click('#libBody .playpill[data-play="alpha|alpha-2"]'); await gp.waitForFunction(() => !document.getElementById('audio').paused);
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
  // Library's chip thumb covers the chosen chip exactly (Futura and the system font are different widths)
  const fits = () => p.evaluate(() => { const t = document.querySelector('#libChips .slthumb'), c = document.querySelector('#libChips .chip[aria-pressed="true"]'); return Math.abs(t.offsetWidth - c.offsetWidth) < 1 && Math.abs(parseFloat(getComputedStyle(t).width) - c.offsetWidth) < 1; });
  await p.goto(BASE + '/' + FOLDER + '/'); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(600);
  assert.equal(await look(), 'vintage');
  await openSettings(p);
  assert.deepEqual(await p.$$eval('#setSheet .sheetbody > *', els => els.slice(0, 3).map(e => e.id || e.className)), ['label', 'setDesign', 'label'], 'Design comes first: its label and the rows, then the next setting');
  assert.equal(await p.textContent('#setSheet .sheetbody > .label'), 'Design');
  assert.equal(await p.$('#setSheet .hint'), null, 'no explanations in Settings');
  assert.equal(await p.getAttribute('#setDesign [data-design="vintage"]', 'aria-checked'), 'true');
  await p.click('#setDesign [data-design="glass"]'); await p.waitForTimeout(300);
  assert.equal(await look(), 'glass', 'Standard at once');
  assert.equal(await p.getAttribute('#setDesign [data-design="glass"]', 'aria-checked'), 'true');
  assert.equal(await p.isVisible('#setSheet'), true, 'Settings stays open');
  assert.equal(await p.evaluate(() => localStorage.getItem('design.podcasts')), 'glass');
  await p.click('#setSheet .sheethead [data-close]'); await p.waitForTimeout(500);
  assert.ok(await fits(), 'the chip thumb fits the chosen chip in the system font');
  await p.reload(); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(600);
  assert.equal(await look(), 'glass', 'Standard is kept');
  await openSettings(p);
  // a re-render of the options leaves the rows working
  await p.click('#setBack [data-v="30"]'); await p.waitForTimeout(200);
  await p.click('#setDesign [data-design="vintage"]'); await p.waitForTimeout(300);
  assert.equal(await look(), 'vintage', 'Vintage at once');
  await p.click('#setSheet .sheethead [data-close]'); await p.waitForTimeout(500);
  assert.ok(await fits(), 'the chip thumb fits the chosen chip in Futura');
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
  await make('allison-podcastsv-sheet', 'kv', [['sheet', { url: 'https://script.google.com/macros/s/OLD/exec', secret: 'old-phrase' }]]);
  if (withNew) await make('allison-podcasts', 'shows', [['alpha', show('An episode from Podcasts')]]);
}, [NOW, feedUrl('alpha'), withNew]);
const dbRows = (p, name, store) => p.evaluate(([name, store]) => new Promise(res => { const r = indexedDB.open(name); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains(store)) return res(null); const t = db.transaction(store), a = t.objectStore(store).getAll(); t.oncomplete = () => { db.close(); res(a.result); }; }; }), [name, store]);

await test('the old Podcasts Vintage address: its data (localStorage and both databases) moved to Podcasts’ names once, what it had seen carried over, feeds through Podcasts’ route', async () => {
  const P = await newPage('light', { 'aos.seen': JSON.stringify({ podcastsvintage: '1.3' }), [KEY]: null, [OLD_KEY]: seed(), [OLD_KEY + '-tab']: 'lib' }), p = P.page;
  await p.goto(BASE + '/podcastsvintage/sw.js'); await seedOldDbs(p, false);
  const reqs = [];
  p.on('request', r => { const u = new URL(r.url()); if (u.pathname.includes('/api/') && !u.pathname.startsWith('/aOS/api/')) reqs.push(u.pathname); });
  await p.goto(BASE + '/podcastsvintage/'); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(900);
  const got = await p.evaluate(([KEY, OLD_KEY]) => ({ lib: !document.getElementById('libView').hidden, tiles: document.querySelectorAll('#libBody .stile').length, seen: JSON.parse(localStorage.getItem('aos.seen') || '{}'), old: !!localStorage.getItem(OLD_KEY), now: JSON.parse(localStorage.getItem(KEY)), look: document.documentElement.dataset.look }), [KEY, OLD_KEY]);
  assert.equal(got.lib, true, 'it opens on the tab it was on (Library)'); assert.equal(got.tiles, 2, 'its two shows');
  assert.equal(got.now.follows.length, 2);
  assert.equal(got.seen.podcasts, '1.3', 'what it had seen carries over (no walkthrough again)');
  assert.equal(got.old, true, 'nothing old is deleted'); assert.equal(got.look, 'vintage');
  assert.deepEqual((await dbRows(p, 'allison-podcasts', 'shows')).map(s => s.eps[0].t), ['An episode from Podcasts Vintage'], 'the episode database moved');
  assert.deepEqual(await dbRows(p, 'allison-podcasts-sheet', 'kv'), [{ url: 'https://script.google.com/macros/s/OLD/exec', secret: 'old-phrase' }], 'its copy of the old Sheet link and phrase moved, to hand over to aOS once signed in');
  // (1.3's seen brings what's new since 1.3 on top: seen now, so the taps below reach the app)
  await p.evaluate(() => localStorage.setItem('aos.seen', JSON.stringify({ podcasts: '999', podcastsvintage: '1.3' })));
  await p.reload(); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(600);
  await p.click('#libBody .stile[data-show="alpha"]'); await p.waitForSelector('#showView:not([hidden])'); await p.waitForTimeout(400);
  assert.match(await p.textContent('#showBody'), /An episode from Podcasts Vintage/, 'its stored episodes show in the app');
  await p.click('#showBack'); await p.waitForTimeout(300);
  await p.click('#refreshBtn'); await p.waitForTimeout(1500);
  assert.ok(reqs.length > 0 && reqs.every(x => x.startsWith('/podcasts/api/')), 'feed requests go to /podcasts/api/ from the old address too: ' + JSON.stringify(reqs));
  // once only: a later change to the old keys is not copied again
  const tabBefore = await p.evaluate(k => localStorage.getItem(k + '-tab'), KEY);
  await p.evaluate(k => localStorage.setItem(k + '-tab', 'search'), OLD_KEY);
  await p.reload(); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(500);
  assert.notEqual(tabBefore, 'search');
  assert.equal(await p.evaluate(k => localStorage.getItem(k + '-tab'), KEY), tabBefore, 'moved once only');
  assert.deepEqual(await p.evaluate(() => window.__csp || []), []);
  await P.ctx.close();
});

await test('a phone with both: Podcasts’ own data and database are kept, the old app’s not copied over them', async () => {
  const P = await newPage('light', { 'aos.seen': JSON.stringify({ podcasts: '999', podcastsvintage: '999' }), [KEY + '-tab']: 'home', [OLD_KEY]: seed().replace('Alpha Show', 'Old Show'), [OLD_KEY + '-tab']: 'lib' }), p = P.page;
  await p.goto(BASE + '/podcastsvintage/sw.js'); await seedOldDbs(p, true);
  await p.goto(BASE + '/podcastsvintage/'); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(900);
  assert.equal(await p.evaluate(k => localStorage.getItem(k + '-tab'), KEY), 'home', 'Podcasts’ own tab kept, not the old app’s');
  assert.equal(await p.evaluate(() => !document.getElementById('libView').hidden), true, 'and it opens on Library, its one page');
  assert.equal(await p.evaluate(k => JSON.parse(localStorage.getItem(k)).follows[0].title, KEY), 'Alpha Show', 'Podcasts’ own shows');
  assert.deepEqual((await dbRows(p, 'allison-podcasts', 'shows')).map(s => s.eps[0].t), ['An episode from Podcasts'], 'Podcasts’ own database');
  await P.ctx.close();
});

await test('tags: Ipsy tags the shows (POST tags, signed in), Library filters by them, you change them on the show’s page, and they sync', async () => {
  const sheet = fakeSheet(GS, SHEET_SECRET), asked = [];
  const P = await newPage('light', { 'aos.session': session('tok-tom') }, sheet), p = P.page;
  // the family's route: feeds as text, and the tags
  await p.route('**/' + FOLDER + '/api/**', route => {
    const req = route.request(), u = new URL(req.url());
    if (u.pathname.endsWith('/tags')) {
      const body = JSON.parse(req.postData());
      asked.push({ who: PEOPLE[(req.headers().authorization || '').replace('Bearer ', '')], header: req.headers()['x-podcasts'], body });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tags: { alpha: ['News', 'Talk'], beta: ['Comedy'] } }) });
    }
    if (u.pathname.endsWith('/feed')) { const n = u.searchParams.get('url').match(/\/(\w+)\.xml/)[1]; return route.fulfill({ status: 200, contentType: 'text/plain', body: rss(n === 'alpha' ? 'Alpha Show' : 'Beta Show', n) }); }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) });
  });
  await p.goto(BASE + '/' + FOLDER + '/'); await p.waitForFunction(() => window.__podcasts);
  await p.waitForSelector('#tagbar:not([hidden])', { timeout: 10000 });
  assert.equal(asked.length, 1, 'one call for both shows');
  assert.equal(asked[0].who.id, 'tom', 'signed in'); assert.equal(asked[0].header, '1');
  assert.deepEqual(asked[0].body.shows.map(x => [x.id, x.title, x.genre]).sort(), [['alpha', 'Alpha Show', 'News'], ['beta', 'Beta Show', 'Comedy']]);
  assert.match(asked[0].body.shows.find(x => x.id === 'alpha').desc, /About Alpha Show/, 'with the start of its description');
  assert.match(await p.textContent('#toastMsg'), /tagged 2 shows/);
  // the tags are in the pill at the bottom, as Home's view picker; its menu opens upwards
  assert.equal(await p.$('#libBody .tagchips'), null, 'not a row of chips in the page');
  assert.equal(await p.textContent('#tagName'), 'All shows');
  const bar = await p.$eval('#tagbar', e => { const r = e.getBoundingClientRect(); return { mid: r.left + r.width / 2, bottom: innerHeight - r.bottom }; });
  assert.ok(Math.abs(bar.mid - 195) < 2 && bar.bottom < 40, 'centred over the home indicator: ' + JSON.stringify(bar));
  await p.click('#tagBtn'); await p.waitForSelector('#tagMenu:not([hidden])');
  assert.equal(await p.getAttribute('#tagBtn', 'aria-expanded'), 'true');
  assert.deepEqual(await p.$$eval('#tagMenu [data-tag]', e => e.map(x => [x.dataset.tag, x.querySelector('.n').textContent])), [['', '2'], ['Talk', '1'], ['News', '1'], ['Comedy', '1']], 'All shows, then the tags in use, in the list’s order, with how many');
  const menu = await p.$eval('#tagMenu', e => e.getBoundingClientRect().bottom), btnTop = await p.$eval('#tagBtn', e => e.getBoundingClientRect().top);
  assert.ok(menu <= btnTop, 'the menu opens upwards');
  await shot(p, '05-tags-light');
  await p.click('#tagMenu [data-tag="Comedy"]'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.getElementById('tagMenu').hidden), true, 'picking closes the menu');
  assert.equal(await p.textContent('#tagName'), 'Comedy');
  assert.deepEqual(await p.$$eval('#libBody .stile', e => e.map(x => x.dataset.show)), ['beta'], 'Comedy: Beta Show only');
  await p.click('#libChips [data-act="lib:new"]'); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => document.getElementById('tagbar').hidden), true, 'only on Shows');
  await p.click('#libChips [data-act="lib:shows"]'); await p.waitForTimeout(200);
  await p.click('#tagBtn'); await p.click('#tagMenu [data-tag=""]'); await p.waitForTimeout(300);
  assert.equal(await p.$$eval('#libBody .stile', e => e.length), 2);
  // you change Alpha's tags on its page: they're yours, and never picked again
  await p.click('#libBody .stile[data-show="alpha"]'); await p.waitForSelector('#showView:not([hidden]) .tagline');
  assert.match(await p.textContent('#showBody .tagline'), /Talk · News/);
  await p.click('#showBody .tagline'); await p.waitForSelector('#actSheet:not([hidden])');
  await p.click('#actRows .rowbtn:has-text("Talk")'); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => !document.getElementById('actSheet').hidden), true, 'the sheet stays open while you pick');
  await p.click('#actRows .rowbtn:has-text("Education")'); await p.waitForTimeout(200);
  assert.deepEqual(await p.$$eval('#actRows .rowbtn', e => e.filter(x => x.querySelector('.tick')).map(x => x.textContent.trim())), ['News', 'Education']);
  await p.evaluate(() => document.querySelector('#actSheet .scrim').click());
  await p.waitForTimeout(300);
  const alpha = await p.evaluate(() => window.__podcasts.S.follows.find(f => f.id === 'alpha'));
  assert.deepEqual([alpha.tags, alpha.tagBy], [['News', 'Education'], 'you']);
  // the Sheet has them
  await p.evaluate(() => window.__podcasts.sync()); await synced(p);
  const row = (sheet.tab('_shows') || []).find(r => /alpha/.test(r[0]));
  assert.ok(row && /"tags":\["News","Education"\]/.test(row.join('')) && /"tagBy":"you"/.test(row.join('')), 'tags synced to the family’s Sheet');
  assert.equal(asked.length, 1, 'not asked again');
  // Settings > AI: off, nothing asks Claude, and the show's sheet has no Let Ipsy Pick; on again, Ipsy tags the rest
  await p.click('#showBack'); await p.waitForTimeout(300);
  await openSettings(p);
  assert.equal(await p.getAttribute('#setAi', 'role'), 'switch');
  assert.equal(await p.getAttribute('#setAi', 'aria-checked'), 'true', 'on to start');
  assert.ok(await p.$('#setAi > .switch'), 'the switch, as in Notes and Orders');
  await p.$eval('#setAi', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
  await shot(p, '07-settings-ai-light');
  await p.click('#setAi'); await p.waitForTimeout(200);
  assert.equal(await p.getAttribute('#setAi', 'aria-checked'), 'false');
  assert.equal(await p.evaluate(() => window.__podcasts.S.set.ai), false);
  await p.click('#setSheet .sheethead [data-close]'); await p.waitForTimeout(400);
  await p.evaluate(() => { const f = window.__podcasts.S.follows.find(f => f.id === 'beta'); delete f.tags; delete f.tagBy; window.__podcasts.save(); });
  await p.reload(); await p.waitForFunction(() => window.__podcasts); await p.waitForTimeout(3500);
  assert.equal(asked.length, 1, 'AI off: Beta Show, with no tags now, isn’t sent');
  await p.click('#libBody .stile[data-show="beta"]'); await p.waitForSelector('#showView:not([hidden]) .tagline');
  await p.click('#showBody .tagline'); await p.waitForSelector('#actSheet:not([hidden])');
  assert.equal(await p.$('#actRows .rowbtn:has-text("Let Ipsy Pick")'), null, 'AI off: no Let Ipsy Pick');
  await p.evaluate(() => document.querySelector('#actSheet .scrim').click()); await p.waitForTimeout(300);
  await p.click('#showBack'); await p.waitForTimeout(300);
  await openSettings(p); await p.click('#setAi'); await p.waitForTimeout(200);
  assert.equal(await p.getAttribute('#setAi', 'aria-checked'), 'true');
  await p.waitForFunction(n => window.__podcasts.S.follows.find(f => f.id === 'beta').tags, null, { timeout: 8000 });
  assert.equal(asked.length, 2, 'on again: Ipsy tags it');
  assert.deepEqual(asked[1].body.shows.map(x => x.id), ['beta'], 'only the show with no tags');
  assert.deepEqual(await p.evaluate(() => window.__csp || []), []);
  await P.ctx.close();
});

await test('no errors and no Content Security Policy violations', async () => {
  assert.deepEqual(errors, []);
});

await browser.close();
server.close();
console.log(n + ' tests passed');
