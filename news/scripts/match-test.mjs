// Checks News's match page: tapping a football game in Sport > Scores opens its own page
// (the score and clock, Events | Stats | Line-ups, the ground, a link to ESPN's) instead
// of leaving for ESPN. The answers are real ones from ESPN (October 2026, trimmed: the
// Premier League scoreboard and the match details of one finished game, Crystal Palace 3
// Nottingham Forest 1, and one in play, Liverpool v Manchester City, in
// scripts/fixtures/), served by a stand-in ESPN with no network. ESPN's feed is
// undocumented, so this checks the app's reading of it, not a promise about ESPN.
//   node news/scripts/match-test.mjs [repo root]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
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
let passed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log('ok - ' + name); } catch (e) { console.log('not ok - ' + name + '\n  ' + String(e.message || e).split('\n')[0]); await browser.close(); server.close(); process.exit(1); } };

const fx = n => JSON.parse(fs.readFileSync(path.join(ROOT, 'news/scripts/fixtures', n), 'utf8'));
const board = fx('espn-eng1-scoreboard.json'), finalGame = fx('espn-eng1-summary-final.json'), liveGame = fx('espn-eng1-summary-live.json');
// A basketball game, to show the other sports are left alone (made up).
const nba = { events: [{ id: '999', date: '2026-10-11T23:00:00Z', status: { type: { state: 'pre', shortDetail: '7:00 PM' } }, links: [{ rel: ['summary'], href: 'https://www.espn.com/nba/game/_/gameId/999' }],
  competitions: [{ competitors: [{ homeAway: 'home', team: { displayName: 'Boston Celtics', shortDisplayName: 'Celtics' } }, { homeAway: 'away', team: { displayName: 'Miami Heat', shortDisplayName: 'Heat' } }] }] }] };

let summaries = {}, fail = false;
const calls = [];
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
await ctx.route('**/*', route => {
  const u = new URL(route.request().url());
  if (/^site(\.web)?\.api\.espn\.com$/.test(u.hostname)) {
    calls.push(u.hostname + u.pathname + u.search);
    const cors = { 'access-control-allow-origin': '*' };
    const ok = body => route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    let m;
    if (/\/soccer\/eng\.1\/scoreboard/.test(u.pathname)) return ok(board);
    if (/\/basketball\/nba\/scoreboard/.test(u.pathname)) return ok(nba);
    if ((m = /\/soccer\/eng\.1\/summary/.exec(u.pathname)) && !fail) { const s = summaries[u.searchParams.get('event')]; if (s) return ok(s); }
    return route.fulfill({ status: 503, headers: cors, body: '{}' });
  }
  if (u.origin !== BASE) return route.abort('internetdisconnected');
  if (u.pathname.includes('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  return route.continue();
});
await ctx.addInitScript(() => {
  localStorage.setItem('aos.seen', JSON.stringify({ news: '999' }));
  localStorage.setItem('news.topic', '"sport"'); localStorage.setItem('news.sport.mode', '"scores"');
  localStorage.setItem('news.scores.league', '"all"');
});
const page = await ctx.newPage();
await page.clock.install();
const errors = []; page.on('pageerror', e => errors.push(e.message));
summaries = { 401879266: finalGame, 401879264: liveGame };
await page.goto(BASE + '/news/index.html');
await page.waitForSelector('[data-match]');
const sheet = '#match-sheet';
const opened = () => page.waitForSelector('#match-body .mh');

await test('football games open their own page, not ESPN; other sports still go to ESPN', async () => {
  assert.equal(await page.locator('[data-match]').count(), 3, 'the three Premier League games');
  assert.equal(await page.locator('a.game[href*="espn.com/soccer"]').count(), 0);
  assert.equal(await page.locator('a.game[href*="espn.com/nba"]').count(), 1, 'the basketball game still links to ESPN');
});
await test('a finished game: the score, full time, and the league as the title', async () => {
  await page.click('[data-match="401879266"]');
  await opened();
  assert.equal((await page.textContent('#match-title')).trim(), 'Premier League');
  assert.deepEqual(await page.$$eval('.mn', n => n.map(x => x.textContent)), ['C Palace', 'Nottm Forest']);
  assert.equal((await page.textContent('.msc')).trim(), '3 – 1');
  assert.equal((await page.textContent('.mst')).trim(), 'FT');
});
await test('Events: the goals with scorer and assist, cards and substitutions, with half time and full time between', async () => {
  const rows = await page.$$eval('.mrow', r => r.map(x => ({ kind: x.className.split(' ')[1], clock: x.querySelector('.mc').textContent, who: x.querySelector('.mb b').textContent, off: (x.querySelector('.mb .off') || {}).textContent || '' })));
  assert.equal(rows.filter(r => r.kind === 'goal').length, 4);
  assert.equal(rows.filter(r => r.kind === 'yellow').length, 4);
  assert.equal(rows.filter(r => r.kind === 'sub').length, 8);
  assert.deepEqual(rows[0], { kind: 'goal', clock: "3'", who: 'Dan Ndoye', off: '' });
  assert.ok(rows.some(r => r.who === 'Daichi Kamada' && r.off === 'assist Quinten Timber'));
  assert.ok(rows.some(r => r.kind === 'sub' && r.who === 'Ibrahim Sangaré' && r.off === 'for Xaver Schlager'));
  assert.deepEqual(await page.$$eval('.mphase', p => p.map(x => x.childNodes[0].textContent)), ['Kick-off', 'Half time', 'Second half', 'Full time']);
  assert.equal(await page.locator('.mrow', { hasText: 'Delay' }).count(), 0, 'delays are left out');
});
await test('Stats: the two sides side by side, with possession and pass accuracy', async () => {
  await page.click('[data-mtab="stats"]');
  const stats = await page.$$eval('.mstat', s => s.map(x => ({ label: x.querySelector('.mvals span').textContent, home: x.querySelector('.mvals b').textContent, away: x.querySelector('.mvals b:last-child').textContent, bar: x.querySelector('.mbar i').style.width })));
  const by = Object.fromEntries(stats.map(s => [s.label, s]));
  assert.deepEqual(stats.map(s => s.label), ['Possession', 'Shots', 'Shots on target', 'Corners', 'Fouls', 'Offsides', 'Yellow cards', 'Red cards', 'Saves', 'Passes', 'Pass accuracy']);
  assert.deepEqual([by.Possession.home, by.Possession.away, by.Possession.bar], ['43%', '57%', '43%']);
  assert.deepEqual([by.Shots.home, by['Shots on target'].home, by.Corners.home, by.Fouls.home], ['13', '7', '5', '11']);
  assert.equal(by['Pass accuracy'].home, '75%', '288 of 385');
});
await test('Line-ups: the formation, the eleven in shape order with positions, and who came on', async () => {
  await page.click('[data-mtab="lineups"]');
  const teams = await page.$$eval('.mlu', t => t.map(x => ({ head: x.querySelector('h4').textContent, names: [...x.querySelectorAll('.mp .nm')].map(n => n.textContent), came: [...x.querySelectorAll('.mp.on .nm')].map(n => n.textContent) })));
  assert.equal(teams.length, 2);
  assert.match(teams[0].head, /Crystal Palace\s*3-4-2-1/);
  assert.equal(teams[0].names[0], 'Walter Benítez');
  assert.ok(teams[0].names.includes('Eddie Nketiah') && teams[0].came.includes('Eddie Nketiah') && teams[0].came.includes('Ismaïla Sarr'));
  assert.equal(await page.locator('.mlu').first().locator('.mp:not(.on)').count() >= 11, true);
});
await test('the ground, and ESPN\'s own page one tap away', async () => {
  assert.match(await page.textContent('.minfo'), /Selhurst Park, London/);
  assert.doesNotMatch(await page.textContent('.minfo'), /watching|On /, 'no attendance when ESPN gives none, no TV once it is over');
  assert.match(await page.getAttribute('.ai-open', 'href'), /^https:\/\/www\.espn\.com\/soccer\/match\/_\/gameId\/401879266/);
  assert.equal(await page.textContent('.ai-open'), 'Open on ESPN');
});
await test('Escape closes it', async () => {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('match-sheet').hidden, null, { timeout: 5000 });
});

await test('a game in play: the clock with a live dot, the latest event first', async () => {
  await page.click('[data-match="401879264"]');
  await opened();
  assert.deepEqual(await page.$$eval('.mn', n => n.map(x => x.textContent)), ['Liverpool', 'Man City']);
  assert.equal((await page.textContent('.msc')).trim(), '0 – 2');
  assert.equal((await page.textContent('.mst')).trim(), "78'");
  assert.equal(await page.locator('.mst.live .live-dot').count(), 1);
  assert.equal(await page.locator('.mrow.red').count(), 1, "Liverpool's red card");
  const first = await page.$eval('.mrow', r => r.querySelector('.mc').textContent);
  assert.equal(first, "75'", 'newest first');
  assert.match(await page.textContent('.minfo'), /On NBC/, 'where to watch, while it is on');
});
await test('it refreshes while the game is on: a goal moves the score and tops the list', async () => {
  const live = JSON.parse(JSON.stringify(liveGame));
  const comp = live.header.competitions[0];
  comp.competitors.find(c => c.homeAway === 'away').score = '3';
  comp.status.type.shortDetail = "84'";
  live.keyEvents.push({ id: 'new', type: { text: 'Goal', type: 'goal' }, text: 'Goal! Liverpool 0, Manchester City 3.', clock: { displayValue: "83'" }, scoringPlay: true, team: live.keyEvents.find(e => e.type.text === 'Goal').team, participants: [{ athlete: { displayName: 'Erling Haaland' } }] });
  summaries[401879264] = live;
  const n = calls.filter(c => c.includes('/summary')).length;
  await page.clock.fastForward(46000);
  await page.waitForFunction(() => document.querySelector('.msc').textContent.trim() === '0 – 3', null, { timeout: 8000 });
  assert.ok(calls.filter(c => c.includes('/summary')).length > n);
  assert.equal(await page.$eval('.mrow .mb b', b => b.textContent), 'Erling Haaland');
  assert.equal((await page.textContent('.mst')).trim(), "84'");
});
await test('ESPN not answering: the last update stays, with a note', async () => {
  fail = true;
  await page.clock.fastForward(46000);
  await page.waitForSelector('.ai-note');
  assert.match(await page.textContent('#match-body'), /last update/);
  assert.equal((await page.textContent('.msc')).trim(), '0 – 3');
  fail = false;
  await page.keyboard.press('Escape');
});
await test('a game ESPN has no details for says so, and Try again works', async () => {
  summaries = {};
  await page.click('[data-match="401879266"]');
  await page.waitForSelector('[data-action="retry-match"]');
  assert.match(await page.textContent('#match-body'), /Match details unavailable/);
  assert.equal((await page.textContent('.msc')).trim(), '3 – 1', 'the score from the game row stays');
  summaries = { 401879266: finalGame };
  await page.click('[data-action="retry-match"]');
  await page.waitForSelector('.mrow');
  await page.keyboard.press('Escape');
});
await test('the first requests go to site.web.api.espn.com, which ESPN answers for any page', async () => {
  assert.ok(calls.find(c => c.includes('/summary')).startsWith('site.web.api.espn.com'));
  // and when it fails, the other host is tried before giving up
  const i = calls.findIndex(c => c.includes('/summary') && c.includes('event=401879266'));
  assert.ok(calls.some(c => c.startsWith('site.api.espn.com') && c.includes('/summary')), 'site.api.espn.com is the second try');
});
await test('no script errors', () => assert.deepEqual(errors, []));
await browser.close();
server.close();
console.log(passed + ' tests passed');
