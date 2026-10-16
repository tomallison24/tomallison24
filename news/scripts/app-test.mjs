// Drives the News app's Sport > Scores view in headless Chromium at iPhone
// size, on made-up ESPN data (scripts/scores-fixture.mjs): Scores and Coming
// up each show the Premier League behind a league pill (and every league, or
// another, when picked), the choice is remembered, a team filter shows every
// league it plays in, and the one "My teams" pill holds the one-tap teams,
// the filter sheet and Reset. Also light and dark, and that nothing trips the
// page's Content Security Policy. Screenshots go to the folder given as the
// second argument.
// Both designs (../home/design.js): Vintage, the default, drawn in the Retro look (Futura, flat cream
// or walnut cards, a mustard thumb, an orange button, the atomic shapes behind the title; the sky held
// at day, aos.sky), and Standard (Sea glass); Settings > Design switches between them at once and keeps
// the choice; and the old News Vintage address (served from news/, as the deploy does) moves that app's
// data on the phone over to News' names, and reads the headlines, scores, sport lists and summaries
// from /news/.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node news/scripts/app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { espnFor, snapshot, newsJson } from './scores-fixture.mjs';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  p = p.replace(/^\/newsvintage\//, '/news/');   // the old News Vintage address: the deploy copies news/ there (news.yml)
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;

const browser = await chromium.launch();
const errors = [], requested = [];
// store: JSON values, merged over the usual seed; raw: the whole seed instead, as strings (a phone
// as it was); design: 'glass' for Standard; at: the address opened.
async function newPage(scheme, store = {}, { raw = null, design = null, at = '/news/' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, timezoneId: 'America/New_York', locale: 'en-US', serviceWorkers: 'block' });
  await ctx.route('**/site.api.espn.com/**', r => { const m = new URL(r.request().url()).pathname.match(/sports\/(.+)\/scoreboard/); return r.fulfill({ json: espnFor(m[1]) }); });
  await ctx.route('**/data/scores.json*', r => r.fulfill({ json: snapshot() }));
  await ctx.route('**/data/news.json*', r => r.fulfill({ json: newsJson() }));
  await ctx.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"off"}' }));
  const seed = raw || Object.fromEntries(Object.entries(Object.assign({ 'aos.seen': { news: '999' }, 'news.topic': 'sport', 'news.sport.mode': 'scores' }, store)).map(([k, v]) => [k, JSON.stringify(v)]));
  await ctx.addInitScript(([seed, design]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    localStorage.setItem('aos.sky', 'day');   // the sky held at day, so the colours don't depend on the hour
    if (design) localStorage.setItem('design.news', design);
  }, [seed, design]);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { window.__csp = (window.__csp || []).concat(e.violatedDirective + ' ' + e.blockedURI); }));
  page.on('request', r => { const u = new URL(r.url()); if (u.origin === BASE) requested.push(u.pathname); });
  await page.goto(BASE + at);
  await page.waitForSelector('.sect');
  return { ctx, page };
}
const shot = async (page, name) => SHOTS ? (await page.waitForTimeout(400), page.screenshot({ path: path.join(SHOTS, name + '.png') })) : null;
const q = (page, sel, props, pseudo) => page.$eval(sel, (e, [props, pseudo]) => { const c = getComputedStyle(e, pseudo || null); return props.map(p => c[p]); }, [props, pseudo]);
const visible = (page, sel) => page.$eval(sel, e => getComputedStyle(e).display !== 'none');
// The Retro look (Vintage, mid-century modern): Futura, a cream (walnut) ground, flat cream cards, a
// mustard thumb, solid orange buttons and the atomic shapes behind the title; the Vintage icon; a
// status bar that isn't translucent.
async function retroLook(page, scheme) {
  const light = scheme === 'light';
  const cream = light ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', ground = light ? 'rgb(241, 223, 187)' : 'rgb(74, 57, 30)';
  assert.equal(await page.evaluate(() => document.documentElement.dataset.look), 'vintage');
  assert.match((await q(page, 'body', ['fontFamily']))[0], /Futura/);
  assert.equal((await q(page, 'html', ['backgroundColor']))[0], ground, 'the ground');
  const [bg, shadow, backdrop, radius] = await q(page, '.card.scores', ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
  assert.equal(bg, cream, 'a flat cream (walnut) card'); assert.equal(shadow, 'none'); assert.ok(backdrop === 'none' || backdrop === '', backdrop); assert.equal(radius, '20px');
  assert.equal((await q(page, '.ambient i:nth-child(1)', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard sun');
  assert.equal((await q(page, '.ambient i:nth-child(2)', ['backgroundColor']))[0], light ? 'rgb(31, 111, 107)' : 'rgb(79, 179, 171)', 'a teal dot');
  assert.equal((await q(page, '.ambient i:nth-child(3)', ['backgroundColor']))[0], 'rgb(216, 87, 42)', 'a burnt-orange pill');
  assert.equal((await q(page, '.backdrop', ['display']))[0], 'none', 'no drifting glass colour fields');
  assert.equal((await q(page, '.modes .slthumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard thumb');
  assert.equal((await q(page, '.modes .seg[aria-selected="true"]', ['color']))[0], 'rgb(43, 37, 34)', 'dark ink on the mustard thumb');
  assert.equal((await q(page, '#sheet-show', ['backgroundColor']))[0], light ? 'rgb(201, 80, 42)' : 'rgb(216, 87, 42)', 'the sheet button is solid orange');
  assert.equal((await q(page, '.vbar', ['backgroundColor'], '::before'))[0], cream, 'the topic picker is flat cream');
  assert.equal((await q(page, '.vbar .vb-ic', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard disc round the topic icon');
  assert.equal((await q(page, '.masthead h1', ['fontSize']))[0], '44px');
  assert.equal((await q(page, '.chip.pill', ['backdropFilter']))[0], 'none');
  assert.ok(await visible(page, '.logo.vintage-logo') && !(await visible(page, '.logo.glass-logo')), 'the Vintage icon by the title');
  assert.doesNotMatch(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'), /glass/, 'the Vintage Home Screen icon');
  assert.equal(await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'default');
}
// Standard (Sea glass): the Vintage block switched off, no sky, the glass look, icon and status bar.
async function glassLook(page, scheme) {
  const light = scheme === 'light';
  assert.ok(await page.evaluate(() => document.documentElement.dataset.look === 'glass' && document.getElementById('vintage').media === 'not all' && !document.documentElement.hasAttribute('data-sky')), 'data-look glass, the Vintage styles off, no sky');
  assert.equal((await q(page, 'html', ['backgroundColor']))[0], light ? 'rgb(238, 242, 240)' : 'rgb(13, 18, 19)', 'the Sea glass ground');
  assert.doesNotMatch((await q(page, 'body', ['fontFamily']))[0], /Futura/);
  assert.equal((await q(page, '.ambient', ['display']))[0], 'none', 'no atomic shapes');
  assert.equal((await q(page, '.backdrop', ['display']))[0], 'block', 'the drifting colour fields');
  assert.notEqual((await q(page, '.chip.pill', ['backdropFilter']))[0], 'none', 'frosted glass chips');
  assert.notEqual((await q(page, '.modes .slthumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'no mustard thumb');
  assert.equal((await q(page, '.masthead h1', ['fontSize']))[0], '34px');
  assert.ok(await visible(page, '.logo.glass-logo') && !(await visible(page, '.logo.vintage-logo')), 'the Sea glass icon by the title');
  assert.match(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'), /icon-glass-180\.png/, 'the Sea glass Home Screen icon');
  assert.equal(await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'black-translucent');
  assert.equal(await page.getAttribute(`meta[name="theme-color"][media*="${scheme}"]`, 'content'), light ? '#EEF2F0' : '#0D1213');
}
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const block = (page, title) => page.locator('.sect', { has: page.locator('h3', { hasText: new RegExp('^' + title + '$') }) });
const pillText = async (page, title) => (await block(page, title).locator('.chip.pill .lbl').innerText()).trim();
const teams = page => page.locator('.game .gname').allInnerTexts();
const visibleMenu = page => page.locator('.pmenu:not([hidden])');

let { ctx, page } = await newPage('light');

await test('the Scores view opens on the Premier League, one card, and a Coming up block of its own', async () => {
  assert.equal(await pillText(page, 'Scores'), 'Premier League');
  assert.equal(await pillText(page, 'Coming up'), 'Premier League');
  assert.equal(await page.locator('#feed .sect').count(), 2);
  assert.equal(await block(page, 'Scores').locator('.game').count(), 3);
  assert.deepEqual((await teams(block(page, 'Scores'))).slice(0, 2), ['Liverpool', 'Arsenal']);
  assert.equal(await page.locator('.lg-name').count(), 0, 'no league headings while one league is shown');
  assert.ok(!(await block(page, 'Scores').innerText()).includes('Champions League'), 'only the Premier League');
  assert.equal(await block(page, 'Coming up').locator('.game').count(), 5, 'five fixtures, then Show more');
  assert.equal((await block(page, 'Coming up').locator('.more').innerText()).trim(), 'Show 2 more');
  await shot(page, 'scores-default');
});

await test('Vintage by default, drawn in the Retro look: Futura, flat cream cards, mustard, orange, atomic shapes (light)', async () => {
  await retroLook(page, 'light');
  await shot(page, 'scores-retro-light');
});

await test('the whole page is short: no more than a couple of screens', async () => {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  assert.ok(h < 1800, 'page height ' + h);
});

await test('the Scores pill lists only leagues with games, with counts, and picks one', async () => {
  await block(page, 'Scores').locator('.chip.pill').click();
  const menu = visibleMenu(page);
  assert.equal(await menu.count(), 1);
  const rows = (await menu.locator('button').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
  // Pinned: the Premier League and Premiership Rugby come first, under All leagues, ahead of the leagues in play.
  assert.deepEqual(rows.slice(0, 3), ['All leagues 8', 'Premier League 3', 'Premiership Rugby 1']);
  assert.equal(await menu.locator('hr').count(), 1, 'a line between the pinned leagues and the rest');
  assert.deepEqual(rows.slice(3).sort(), ['Champions League 2', 'Championship 1', 'NFL 1']);
  assert.deepEqual(rows.sort(), ['All leagues 8', 'Champions League 2', 'Championship 1', 'NFL 1', 'Premier League 3', 'Premiership Rugby 1'].sort());
  assert.equal(await menu.locator('[aria-selected="true"]').count(), 1);
  assert.match(await menu.locator('[aria-selected="true"]').innerText(), /Premier League/);
  await shot(page, 'scores-menu');
  await menu.locator('button', { hasText: 'Champions League' }).click();
  assert.equal(await visibleMenu(page).count(), 0, 'the menu closes on a pick');
  assert.equal(await pillText(page, 'Scores'), 'Champions League');
  assert.deepEqual(await teams(block(page, 'Scores')), ['Real Madrid', 'Inter', 'Liverpool', 'Inter']);
  assert.equal(await pillText(page, 'Coming up'), 'Premier League', 'Coming up has its own pill');
});

await test('Coming up has its own pill, and Show more reveals the rest of one league', async () => {
  await block(page, 'Coming up').locator('.more').click();
  assert.equal(await block(page, 'Coming up').locator('.game').count(), 7);
  assert.equal(await block(page, 'Coming up').locator('.more').count(), 0);
  await block(page, 'Coming up').locator('.chip.pill').click();
  await visibleMenu(page).locator('button', { hasText: 'Premiership Rugby' }).click();
  assert.equal(await pillText(page, 'Coming up'), 'Premiership Rugby');
  assert.deepEqual(await teams(block(page, 'Coming up')), ['Leicester', 'Northampton', 'Northampton', 'Leicester']);
});

await test('All leagues: a heading and a few games per league, live leagues first', async () => {
  await block(page, 'Scores').locator('.chip.pill').click();
  await visibleMenu(page).locator('button', { hasText: 'All leagues' }).click();
  const heads = await block(page, 'Scores').locator('.lg-name').allInnerTexts();
  assert.equal(heads.length, 5);
  assert.match(heads[0], /premier league|champions league|nfl/i);   // the leagues with a game in play first
  assert.ok(heads.some(h => /nfl/i.test(h)) && heads.some(h => /champions/i.test(h)) && heads.some(h => /rugby/i.test(h)));
  await shot(page, 'scores-all');
});

await test('the choices are remembered on this device', async () => {
  assert.equal(await page.evaluate(() => localStorage.getItem('news.scores.league')), '"all"');
  assert.equal(await page.evaluate(() => localStorage.getItem('news.scores.next')), '"rugby.267979"');
  await page.reload();
  await page.waitForSelector('.sect');
  assert.equal(await pillText(page, 'Scores'), 'All leagues');
  assert.equal(await pillText(page, 'Coming up'), 'Premiership Rugby');
});

await test('a tap outside, or Escape, closes a pill menu', async () => {
  await block(page, 'Scores').locator('.chip.pill').click();
  assert.equal(await visibleMenu(page).count(), 1);
  await page.locator('.masthead .brand').click();
  assert.equal(await visibleMenu(page).count(), 0);
  await block(page, 'Scores').locator('.chip.pill').click();
  await page.keyboard.press('Escape');
  assert.equal(await visibleMenu(page).count(), 0);
});

await test('the filter bar is one line: News | Scores and one My teams pill', async () => {
  const top = await page.locator('.fb-top').boundingBox();
  assert.ok(top.height < 50, 'one line, ' + top.height + 'px');
  assert.equal(await page.locator('.chip.team, .teams').count(), 0, 'no row of team chips');
  assert.equal((await page.locator('.fb-top .chip.pill .lbl').innerText()).trim(), 'My teams');
  const modes = await page.locator('.modes').boundingBox(), pill = await page.locator('.fb-top .chip.pill').boundingBox();
  assert.ok(modes.x + modes.width <= pill.x, 'the switch and the pill sit side by side');
  assert.ok(pill.width >= 44 && pill.height >= 30);
});

await test('a one-tap team shows every league it plays in, and the pill names it', async () => {
  await page.locator('.fb-top .chip.pill').click();
  const rows = (await visibleMenu(page).locator('button').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
  assert.deepEqual(rows, ['All sport', 'Liverpool', 'England ⚽', 'England 🏉', 'Northampton', 'Choose sports and teams…']);
  await shot(page, 'team-menu');
  await visibleMenu(page).locator('button', { hasText: 'Liverpool' }).click();
  assert.equal(await visibleMenu(page).count(), 0);
  assert.equal((await page.locator('.fb-top .chip.pill .lbl').innerText()).trim(), 'Liverpool');
  await page.evaluate(() => localStorage.removeItem('news.scores.league'));
  await page.reload(); await page.waitForSelector('.sect');
  // The remembered Premier League is not what a team filter wants: Liverpool's Champions League game shows too.
  const gl = (await teams(block(page, 'Scores')));
  assert.ok(gl.filter(t => t === 'Liverpool').length >= 2, 'Liverpool in the Premier League and the Champions League: ' + gl);
  assert.ok(await page.locator('.lg-name').count() >= 2);
  assert.ok(!gl.includes('Chelsea') && !gl.includes('Chiefs'), 'only Liverpool\'s games');
  await shot(page, 'team-liverpool');
  // Tapping it again goes back.
  await page.locator('.fb-top .chip.pill').click();
  await visibleMenu(page).locator('button', { hasText: 'All sport' }).click();
  assert.equal((await page.locator('.fb-top .chip.pill .lbl').innerText()).trim(), 'My teams');
});

await test('Choose sports and teams… opens the filter sheet; picks show as a count, with Reset in the menu', async () => {
  await page.locator('.fb-top .chip.pill').click();
  await visibleMenu(page).locator('button', { hasText: 'Choose sports and teams' }).click();
  await page.waitForSelector('#sheet:not([hidden]).open');
  assert.equal(await visibleMenu(page).count(), 0);
  await page.locator('#sheet-seg [data-seg="teams"]').click();
  await page.locator('#sheet-body .opt', { hasText: 'Arsenal' }).first().click();
  await page.locator('#sheet-show').click();
  await page.waitForSelector('#sheet', { state: 'hidden' });
  assert.equal((await page.locator('.fb-top .chip.pill .lbl').innerText()).trim(), 'Filters');
  assert.equal((await page.locator('.fb-top .chip.pill .n').innerText()).trim(), '1');
  assert.ok((await teams(block(page, 'Scores'))).includes('Arsenal'));
  assert.ok(!(await teams(block(page, 'Scores'))).includes('Chelsea'), 'only Arsenal\'s games');
  await page.locator('.fb-top .chip.pill').click();
  const rows = (await visibleMenu(page).locator('button').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
  assert.equal(rows[0], 'My filters 1');
  assert.equal(rows[rows.length - 1], 'Reset filters');
  await visibleMenu(page).locator('button', { hasText: 'Reset filters' }).click();
  assert.equal((await page.locator('.fb-top .chip.pill .lbl').innerText()).trim(), 'My teams');
});

await test('News | Scores still switches, and the pill is there on the news list too', async () => {
  await page.locator('.modes [data-mode="news"]').click();
  assert.equal(await page.locator('#feed .sect').count(), 0);
  assert.ok(await page.locator('.fb-top .chip.pill').isVisible());
  assert.ok((await page.locator('#feed').innerText()).includes('Liverpool edge a thriller'));
  await page.locator('.modes [data-mode="scores"]').click();
  await page.waitForSelector('.sect');
});

await test('the pills are real buttons that take a 44px tap, and the menu rows are 44px tall', async () => {
  for (const sel of ['.fb-top .chip.pill', '.sect-head .chip.pill']) {
    const r = await page.locator(sel).first().boundingBox();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    for (const y of [cy - 21, cy + 21]) {
      const hit = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.chip.pill'), [cx, y]);
      assert.ok(hit, sel + ' takes a tap 21px above and below its centre');
    }
  }
  await page.locator('.sect-head .chip.pill').first().click();
  const rows = await visibleMenu(page).locator('button').evaluateAll(bs => bs.map(b => b.offsetHeight));
  assert.ok(rows.length > 2 && rows.every(h => h >= 44), 'menu rows ' + rows);
  await page.keyboard.press('Escape');
});

await test('only one league has games: the pill is just a label', async () => {
  const p2 = await newPage('light', { 'news.sport.picks': ['team:rugby-union:northampton-saints'] });
  assert.equal(await block(p2.page, 'Scores').locator('.chip.pill').count(), 0);
  assert.equal(await block(p2.page, 'Coming up').locator('.chip.pill').count(), 0);
  assert.match(await block(p2.page, 'Scores').locator('.one').innerText(), /Premiership Rugby/);
  await p2.ctx.close();
});

await test('dark mode', async () => {
  const d = await newPage('dark');
  await retroLook(d.page, 'dark');
  await shot(d.page, 'scores-retro-dark');
  await d.page.locator('.sect-head .chip.pill').first().click();
  await shot(d.page, 'scores-menu-dark');
  const bg = await d.page.evaluate(() => getComputedStyle(document.querySelector('.pmenu:not([hidden])')).backgroundColor);
  const [r, g, b] = bg.match(/[\d.]+/g).map(Number);
  assert.ok(Math.max(r, g, b) < 80, 'a dark menu in dark mode: ' + bg);
  await d.ctx.close();
});

await test('Standard (Sea glass), light and dark: the glass look, no sky, the glass icon and status bar', async () => {
  for (const scheme of ['light', 'dark']) {
    const g = await newPage(scheme, {}, { design: 'glass' });
    await glassLook(g.page, scheme);
    await shot(g.page, 'scores-glass-' + scheme);
    assert.deepEqual(await g.page.evaluate(() => window.__csp || []), []);
    await g.ctx.close();
  }
});

await test('Settings > Design: Vintage, then Standard and back, at once, kept across a reload', async () => {
  const s = await newPage('light');
  const look = () => s.page.evaluate(() => document.documentElement.dataset.look);
  const checked = d => s.page.getAttribute(`#set-body [data-design="${d}"]`, 'aria-checked');
  assert.equal(await look(), 'vintage');
  await s.page.click('#setBtn');
  await s.page.waitForSelector('#set-sheet.open:not([hidden])');
  assert.equal((await s.page.locator('#set-body .sect h3').first().innerText()).trim().toLowerCase(), 'design', 'Design is the first section');
  assert.match(await s.page.locator('#set-body .sheet-note').innerText(), /Just on this phone, and at once\./);
  assert.equal(await checked('vintage'), 'true'); assert.equal(await checked('glass'), 'false');
  await shot(s.page, 'settings-vintage');
  await s.page.click('#set-body [data-design="glass"]');
  assert.equal(await look(), 'glass', 'Standard at once');
  assert.equal(await checked('glass'), 'true');
  assert.ok(await s.page.isVisible('#set-sheet'), 'the sheet stays open');
  assert.equal(await s.page.evaluate(() => localStorage.getItem('design.news')), 'glass');
  await shot(s.page, 'settings-glass');
  await s.page.keyboard.press('Escape');
  await s.page.waitForSelector('#set-sheet', { state: 'hidden' });
  await s.page.reload(); await s.page.waitForSelector('.sect');
  await glassLook(s.page, 'light');
  await s.page.click('#setBtn');
  await s.page.waitForSelector('#set-sheet.open:not([hidden])');
  await s.page.click('#set-body [data-design="vintage"]');
  assert.equal(await look(), 'vintage');
  await s.page.click('#set-sheet .close-btn');
  await s.page.waitForSelector('#set-sheet', { state: 'hidden' });
  await s.page.reload(); await s.page.waitForSelector('.sect');
  await retroLook(s.page, 'light');
  // the thumb under News | Scores sits under the chosen one in either font
  const [th, on] = await Promise.all([s.page.locator('.modes .slthumb').boundingBox(), s.page.locator('.modes .seg[aria-selected="true"]').boundingBox()]);
  assert.ok(Math.abs(th.x - on.x) < 3 && Math.abs(th.width - on.width) < 3, 'the thumb under the chosen switch');
  await s.ctx.close();
});

await test('the old News Vintage address: its data moved to News\' names once, News\' files and route', async () => {
  const before = requested.length;
  const raw = { 'aos.seen': JSON.stringify({ newsvintage: '999' }), 'newsv.topic': '"sport"', 'newsv.sport.mode': '"scores"', 'newsv.scores.league': '"all"', 'newsv.scores.next': '"rugby.267979"' };
  const o = await newPage('light', {}, { raw, at: '/newsvintage/' });
  assert.equal(await pillText(o.page, 'Scores'), 'All leagues', 'its league choice, now News\'');
  assert.equal(await pillText(o.page, 'Coming up'), 'Premiership Rugby');
  const got = await o.page.evaluate(() => ({ league: localStorage.getItem('news.scores.league'), topic: localStorage.getItem('news.topic'), seen: JSON.parse(localStorage.getItem('aos.seen') || '{}'), old: localStorage.getItem('newsv.scores.league'), look: document.documentElement.dataset.look }));
  assert.equal(got.league, '"all"'); assert.equal(got.topic, '"sport"');
  assert.equal(got.seen.news, '999', 'what it had seen carries over: no walkthrough again');
  assert.equal(got.old, '"all"', 'nothing old is deleted');
  assert.equal(got.look, 'vintage');
  // the headlines, scores and sport lists are News' own, and the summaries go to News' route
  await o.page.locator('.modes [data-mode="news"]').click();
  await o.page.locator('#feed .sum-btn').first().click();
  await o.page.waitForSelector('#ai-sheet.open:not([hidden])');
  await o.page.waitForTimeout(300);
  const mine = requested.slice(before);
  for (const f of ['/news/data/news.json', '/news/data/scores.json', '/news/sport-catalog.json', '/news/leagues.json', '/news/api/summarize'])
    assert.ok(mine.includes(f), f + ' asked for: ' + mine.filter(p => !/\.(js|svg|png)$/.test(p)));
  assert.deepEqual(mine.filter(p => /^\/newsvintage\/(data|api)\/|^\/newsvintage\/(sport-catalog|leagues)\.json/.test(p)), [], 'nothing from /newsvintage/ but the page');
  await o.page.keyboard.press('Escape');
  // once only: a later change to the old keys is not copied again
  await o.page.evaluate(() => localStorage.setItem('newsv.scores.league', '"eng.1"'));
  await o.page.reload(); await o.page.waitForSelector('#feed');
  assert.equal(await o.page.evaluate(() => localStorage.getItem('news.scores.league')), '"all"', 'moved once only');
  assert.deepEqual(await o.page.evaluate(() => window.__csp || []), []);
  await o.ctx.close();
});

await test('a phone with both: News\' own data is kept, the old app\'s is not copied over it', async () => {
  const raw = { 'aos.seen': JSON.stringify({ news: '999', newsvintage: '999' }), 'news.topic': '"sport"', 'news.sport.mode': '"scores"', 'news.scores.league': '"uefa.champions"', 'newsv.scores.league': '"all"' };
  const b = await newPage('light', {}, { raw, at: '/newsvintage/' });
  assert.equal(await b.page.evaluate(() => localStorage.getItem('news.scores.league')), '"uefa.champions"');
  assert.equal(await pillText(b.page, 'Scores'), 'Champions League');
  await b.ctx.close();
});

await test('nothing trips the Content Security Policy, and no script errors', async () => {
  assert.deepEqual(await page.evaluate(() => window.__csp || []), []);
  assert.deepEqual(errors, []);
});

await browser.close();
server.close();
console.log(`${n} News tests passed`);
