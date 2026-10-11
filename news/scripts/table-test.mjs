// Checks News's Table view (Sport > Table): a league's standings from ESPN, read
// live and refreshed on the scores timer, with stand-ins for ESPN (no network):
// the soccer shape (one table, a rank, points, ESPN's zone colours), the US shape
// (conferences, wins and losses), a league with no table, ESPN not answering (the
// last table seen is kept), teams in play marked, the teams you follow tinted, and
// a result moving the table on the next refresh.
// The stand-ins follow ESPN's standings feed as its public answers are known to look
// (children[].standings.entries[].team and stats[]); ESPN's feed is undocumented, so
// this is a check of the app's reading, not a promise about ESPN.
//   node news/scripts/table-test.mjs [repo root]
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

// ---- stand-ins for ESPN ----
const stat = (name, abbreviation, value, displayValue) => ({ name, abbreviation, value, displayValue: displayValue ?? String(value) });
const team = (displayName, shortDisplayName) => ({ id: displayName, displayName, shortDisplayName, logos: [{ href: 'https://a.espncdn.com/x.png' }] });
const soccerEntry = (t, rank, gp, w, d, l, gd, pts, note) => ({ team: t, ...(note ? { note } : {}),
  stats: [stat('rank', 'R', rank), stat('gamesPlayed', 'GP', gp), stat('wins', 'W', w), stat('ties', 'D', d), stat('losses', 'L', l),
    stat('pointsFor', 'F', 0), stat('pointDifferential', 'GD', gd, (gd > 0 ? '+' : '') + gd), stat('points', 'P', pts)] });
const CL = { color: '#81D6AC', description: 'Champions League', rank: 1 }, REL = { color: '#E8575A', description: 'Relegation', rank: 4 };
const soccer = pts => ({ name: 'English Premier League', children: [{ name: 'English Premier League', standings: { seasonDisplayName: '2026-27', entries: [
  // out of order on purpose: the table is by rank
  soccerEntry(team('Arsenal', 'Arsenal'), 2, 8, 6, 1, 1, 9, 19, CL),
  soccerEntry(team('Liverpool', 'Liverpool'), 1, 8, 6, 2, 0, 12, pts, CL),
  soccerEntry(team('Manchester United', 'Man United'), 3, 8, 3, 3, 2, 1, 12),
  soccerEntry(team('Wolverhampton Wanderers', 'Wolves'), 4, 8, 0, 1, 7, -14, 1, REL),
] } }] });
const us = { name: 'NBA', children: ['Eastern Conference', 'Western Conference'].map((c, i) => ({ name: c, standings: { entries: [
  { team: team('Boston Celtics' + i, 'Celtics' + i), stats: [stat('wins', 'W', 10), stat('losses', 'L', 2), stat('winPercent', 'PCT', 0.833, '.833'), stat('gamesBehind', 'GB', 0, '-'), stat('streak', 'STRK', 3, 'W3')] },
  { team: team('Miami Heat' + i, 'Heat' + i), stats: [stat('wins', 'W', 8), stat('losses', 'L', 4), stat('winPercent', 'PCT', 0.667, '.667'), stat('gamesBehind', 'GB', 2, '2'), stat('streak', 'STRK', -1, 'L1')] },
] } })) };
const board = live => ({ events: [{ id: '1', date: '2026-10-11T15:30:00Z', status: { type: { state: live ? 'in' : 'post', shortDetail: live ? "63'" : 'FT' } }, competitions: [{ competitors: [
  { homeAway: 'home', team: { displayName: 'Liverpool', shortDisplayName: 'Liverpool' }, score: '1' }, { homeAway: 'away', team: { displayName: 'Arsenal', shortDisplayName: 'Arsenal' }, score: '1' }] }] }] });

const calls = [];
const LATENCY = +process.env.LATENCY || 0;
let answers = {};      // 'eng.1' -> { standings, live } or 'fail'
async function open(extra = {}, init = {}) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.hostname === 'site.api.espn.com') {
      if (LATENCY) await new Promise(r => setTimeout(r, LATENCY));   // a slow network, as on CI
      const m = /sports\/([^/]+\/[^/]+)\/(standings|scoreboard)/.exec(u.pathname);
      const id = m && m[1].split('/')[1].replace(/^(\d+)$/, 'rugby.$1');
      const a = answers[id === 'nba' ? 'nba' : id] ;
      calls.push(u.pathname);
      const cors = { 'access-control-allow-origin': '*' };
      if (!m || !a || a === 'fail') return route.fulfill({ status: 503, headers: cors, body: '{}' });
      const body = m[2] === 'standings' ? a.standings : board(a.live);
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
    }
    if (u.origin !== BASE) return route.abort('internetdisconnected');
    if (u.pathname.includes('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    return route.continue();
  });
  await ctx.addInitScript(([init]) => {
    localStorage.setItem('aos.seen', JSON.stringify({ news: '999' }));
    localStorage.setItem('news.topic', '"sport"'); localStorage.setItem('news.sport.mode', '"table"');
    for (const [k, v] of Object.entries(init)) localStorage.setItem(k, JSON.stringify(v));
  }, [init]);
  const page = await ctx.newPage();
  await page.clock.install();                // the refresh timer is played forward, not waited for
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  return { ctx, page, errors };
}
const rows = page => page.$$eval('.trow:not(.thead)', rs => rs.map(r => ({ rank: r.querySelector('.tr-rank').textContent, team: r.querySelector('.gname').textContent, cells: [...r.querySelectorAll('.tc')].map(c => c.textContent), me: r.classList.contains('me'), playing: !!r.querySelector('.live-dot'), zone: r.hasAttribute('data-zone') })));

answers = { 'eng.1': { standings: soccer(20), live: true }, nba: { standings: us, live: false }, 'rugby.267979': { standings: {}, live: false } };
{
  const { ctx, page, errors } = await open();
  await page.goto(BASE + '/news/index.html');
  await page.waitForSelector('.trow:not(.thead) .tr-team');

  await test('Sport has a Table view beside News and Scores, and it opens on the Premier League', async () => {
    assert.deepEqual(await page.$$eval('.modes .seg', s => s.map(x => x.textContent.replace(/\d+$/, ''))), ['News', 'Scores', 'Table']);
    assert.equal(await page.$eval('.modes [data-mode="table"]', e => e.getAttribute('aria-selected')), 'true');
    assert.match(await page.textContent('[data-menu-btn="table"]'), /Premier League/);
  });
  await test('the table is by rank, with ESPN\'s own column labels, points last', async () => {
    assert.deepEqual(await page.$$eval('.trow.thead .tc', c => c.map(x => x.textContent)), ['GP', 'W', 'D', 'L', 'GD', 'P']);
    const r = await rows(page);
    assert.deepEqual(r.map(x => x.team), ['Liverpool', 'Arsenal', 'Man United', 'Wolves']);
    assert.deepEqual(r[0].cells, ['8', '6', '2', '0', '+12', '20']);
    assert.deepEqual(r.map(x => x.rank), ['1', '2', '3', '4']);
  });
  await test('ESPN\'s zones show as a bar and a key', async () => {
    const r = await rows(page);
    assert.deepEqual(r.map(x => x.zone), [true, true, false, true]);
    assert.deepEqual(await page.$$eval('.tkey span', s => s.map(x => x.textContent)), ['Champions League', 'Relegation']);
  });
  await test('teams in play have a live dot', async () => {
    assert.deepEqual((await rows(page)).map(x => x.playing), [true, true, false, false]);
  });
  await test('another league from the pill: US conferences, with wins, losses and their own labels', async () => {
    await page.click('[data-menu-btn="table"]');
    await page.click('[data-league="nba"]');
    await page.waitForFunction(() => document.querySelectorAll('.tgname').length === 2);
    assert.deepEqual(await page.$$eval('.tgname', g => g.map(x => x.textContent)), ['Eastern Conference', 'Western Conference']);
    assert.deepEqual(await page.$$eval('.trow.thead', h => h.map(r => [...r.querySelectorAll('.tc')].map(x => x.textContent).join(' '))), ['W L PCT GB', 'W L PCT GB']);
    const r = await rows(page);
    assert.deepEqual(r[0].cells, ['10', '2', '.833', '-']);
    assert.equal(await page.evaluate(() => localStorage.getItem('news.table.league')), '"nba"');
  });
  await test('a league ESPN has no table for says so, and the pill stays', async () => {
    await page.click('[data-menu-btn="table"]');
    await page.click('[data-league="rugby.267979"]');
    await page.waitForSelector('.notice');
    assert.match(await page.textContent('.notice'), /No table for Premiership Rugby/);
    assert.ok(await page.locator('[data-menu-btn="table"]').count());
  });
  await test('a result moves the table on the next refresh (the scores timer)', async () => {
    const asked = calls.length;
    await page.click('[data-menu-btn="table"]');
    await page.click('[data-league="eng.1"]');
    // The saved table shows at once; wait for the fresh answer (standings and scoreboard), and
    // for the app to have set its timer, before playing the minute forward.
    for (let i = 0; calls.length < asked + 2 && i < 100; i++) await new Promise(r => setTimeout(r, 50));
    await page.waitForTimeout(300);
    answers['eng.1'] = { standings: soccer(23), live: false };
    const before = calls.filter(c => c.includes('/standings')).length;
    await page.clock.fastForward(61000);          // a game is in play: a minute
    await page.waitForFunction(() => document.querySelector('.trow:not(.thead) .tc.last').textContent === '23', null, { timeout: 8000 });
    assert.ok(calls.filter(c => c.includes('/standings')).length > before);
    assert.deepEqual((await rows(page)).map(x => x.playing), [false, false, false, false], 'the dot goes when the game ends');
  });
  await test('ESPN not answering: the last table seen stays, marked as a saved copy', async () => {
    answers['eng.1'] = 'fail';
    await page.clock.fastForward(310000);
    await page.waitForFunction(() => /saved copy/.test(document.querySelector('.status').textContent), null, { timeout: 8000 });
    assert.equal((await rows(page)).length, 4);
  });
  await test('no errors', () => assert.deepEqual(errors, []));
  await ctx.close();
}
{
  answers = { 'eng.1': { standings: soccer(20), live: false }, nba: { standings: us, live: false } };
  const { ctx, page } = await open({}, { 'news.sport.picks': ['team:football:liverpool'] });
  await page.goto(BASE + '/news/index.html');
  await page.waitForSelector('.trow:not(.thead) .tr-team');
  await test('the team you follow is tinted, and only leagues your filters allow are in the pill', async () => {
    assert.deepEqual((await rows(page)).map(x => x.me), [true, false, false, false]);
    assert.equal(await page.locator('[data-league="nba"]').count(), 0);
  });
  await ctx.close();
}
{
  answers = { 'eng.1': 'fail' };
  const { ctx, page } = await open();
  await page.goto(BASE + '/news/index.html');
  await test('ESPN not answering and nothing seen before: says so, and Try again works', async () => {
    await page.waitForSelector('[data-action="retry-table"]');
    answers = { 'eng.1': { standings: soccer(20), live: false } };
    await page.click('[data-action="retry-table"]');
    await page.waitForSelector('.trow:not(.thead) .tr-team');
  });
  await ctx.close();
}
{
  answers = { 'eng.1': { standings: soccer(20), live: false } };
  const { ctx, page } = await open();
  await page.goto(BASE + '/news/index.html');
  await page.waitForSelector('.trow:not(.thead) .tr-team');
  await test('the Table view is kept: reopened, it opens on the table at once, from the saved copy', async () => {
    answers = { 'eng.1': 'fail' };
    await page.reload();
    await page.waitForSelector('.trow:not(.thead) .tr-team');
    assert.equal((await rows(page)).length, 4);
  });
  await ctx.close();
}
await browser.close();
server.close();
console.log(passed + ' tests passed');
