// Drives Junction in headless Chromium at iPhone size (390 x 844): the start card over a working junction,
// a new game, the stats along the top, the junction's panel, Settings (Design first, the game's own, Your
// data with a danger row that asks again), Upgrades as a sheet (buying with Undo, a junction that asks first),
// a tap on a phase turning Auto off and the lights staying put, each junction's own Auto switch, the save and Continue, Vintage and Standard in light
// and dark, and a long run of the game with every upgrade bought: no car stays stuck, no two crossing paths
// are in a junction's box at once, coins come in and traffic grows. Nothing trips the page's Content Security
// Policy. Screenshots go to the folder given as the second argument.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node junction/scripts/app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

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
const errors = [];
let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log('ok - ' + name); }
  catch (e) { failed++; console.log('not ok - ' + name + '\n  ' + String(e && e.stack || e).split('\n').slice(0, 4).join('\n  ')); }
}

// a phone: no walkthrough or update screen (aos.seen 999), the sky held still, a design and a theme
async function phone({ scheme = 'light', design = null, seed = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme, locale: 'en-US', timezoneId: 'America/New_York' });
  await ctx.addInitScript(({ design, seed }) => {
    try {
      localStorage.setItem('aos.seen', JSON.stringify({ junction: '999', aos: '999' }));
      localStorage.setItem('aos.signin.asked', '1');
      localStorage.setItem('aos.sky', 'day');
      if (design) localStorage.setItem('design.junction', design);
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    } catch {}
  }, { design, seed });
  await ctx.route('**/*', r => { const u = new URL(r.request().url()); return u.origin === BASE ? r.continue() : r.abort(); });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && /Content Security Policy|Refused/.test(m.text())) errors.push(m.text()); });
  await p.goto(BASE + '/junction/');
  await p.waitForFunction(() => window.__junction);
  return { ctx, p };
}
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, name + '.png') }); };

await check('the start card sits over a working junction; New game starts at 10:00 on day 1 with 80 coins and lights at A', async () => {
  const { ctx, p } = await phone();
  assert.ok(await p.isVisible('#startCard'));
  assert.ok(await p.isVisible('#bNew'));
  assert.ok(!(await p.isVisible('#bContinue')), 'no saved game, no Continue');
  const cars = await p.evaluate(() => window.__junction.state().cars.length);
  assert.ok(cars > 0, 'traffic behind the card');
  await shot(p, 'start');
  await p.click('#bNew');
  assert.ok(await p.isHidden('#startCard'));
  const g = await p.evaluate(() => { const G = window.__junction.state(); return { coins: G.coins, clock: G.clock, day: G.day, demo: G.demo }; });
  assert.equal(g.demo, false); assert.equal(g.day, 1); assert.ok(g.clock >= 10 && g.clock < 10.2, 'starts at 10:00'); assert.ok(g.coins >= 80);
  assert.match(await p.textContent('#jName'), /Junction A/);
  assert.match(await p.textContent('#jCtrl'), /Timed lights/);
  assert.equal(await p.evaluate(() => { const u = window.__junction.site('A').up; return !!u.lights && !u.filters; }), true, 'lights, no turn arrows');
  assert.equal(await p.getAttribute('#jAutoSw', 'aria-checked'), 'true', 'Auto on');
  await ctx.close();
});

await check('Settings: Design first, then Game, then Your data; a new game asks again', async () => {
  const { ctx, p } = await phone();
  await p.click('#bNew');
  await p.click('#moreBtn');
  assert.ok(await p.isVisible('#moreSheet'));
  const labels = await p.$$eval('#moreBody .st-lbl', l => l.map(x => x.textContent.trim()));
  assert.deepEqual(labels.slice(0, 3), ['Design', 'Game', 'Your data']);
  assert.ok(await p.evaluate(() => window.__junction.state() && document.documentElement.dataset.look !== undefined));
  // the game pauses while a sheet is open
  const t0 = await p.evaluate(() => window.__junction.state().T); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => window.__junction.state().T), t0, 'paused under Settings');
  await p.click('#stSpeed [data-value="2"]');
  assert.equal(await p.getAttribute('#stSpeed [data-value="2"]', 'aria-checked'), 'true');
  assert.equal(await p.locator('#stHold').count(), 0, 'no override timer any more');
  await p.evaluate(() => { window.__junction.state().coins = 999; });
  await p.click('#stReset');
  assert.match(await p.textContent('#stReset'), /Tap again/);
  await p.click('#stReset');
  assert.ok(await p.isHidden('#moreSheet'));
  assert.equal(await p.evaluate(() => Math.round(window.__junction.state().coins)), 80, 'a new game');
  await shot(p, 'settings');
  await ctx.close();
});

await check('Upgrades: buy turn lanes with Undo, then a junction that asks first', async () => {
  const { ctx, p } = await phone();
  await p.click('#bNew');
  await p.evaluate(() => { window.__junction.state().coins = 2000; });
  await p.click('#jShop');
  assert.ok(await p.isVisible('#shopSheet'));
  assert.equal(await p.locator('#up-lights').count(), 0, 'lights come with every junction, not in the shop');
  await p.click('#up-lanesEW');
  assert.equal(await p.evaluate(() => !!window.__junction.site('A').up.lanesEW), true);
  assert.equal(await p.evaluate(() => Math.round(window.__junction.state().coins)), 1780);
  assert.ok(await p.isVisible('#toastAct'), 'Undo in the toast');
  await p.click('#toastAct');
  assert.equal(await p.evaluate(() => !!window.__junction.site('A').up.lanesEW), false, 'Undo takes it back');
  assert.equal(await p.evaluate(() => Math.round(window.__junction.state().coins)), 2000);
  await p.click('#site-B');
  assert.ok(await p.isVisible('.st-ask'), 'a junction asks first');
  await p.click('.st-ask .st-yes');
  assert.equal(await p.evaluate(() => window.__junction.site('B').active), true);
  assert.equal(await p.evaluate(() => !!window.__junction.site('B').up.lights), true, 'opens with lights');
  await shot(p, 'upgrades');
  await p.click('#shopSheet [aria-label="Done"]');
  assert.ok(await p.isHidden('#shopSheet'));
  await ctx.close();
});

await check('the lights: a tap turns Auto off and they stay as set; each junction has its own Auto switch', async () => {
  const { ctx, p } = await phone();
  await p.click('#bNew');
  assert.ok(await p.isVisible('#jPhases'));
  assert.ok(!(await p.isVisible('#ph1')), 'no turn phases before turn arrows');
  await p.click('#ph2');
  assert.equal(await p.getAttribute('#jAutoSw', 'aria-checked'), 'false', 'a tap turned Auto off');
  const held = await p.evaluate(() => { const J = window.__junction; for (let i = 0; i < 30 * 90; i++) J.step(1 / 30); const s = J.site('A'), c = s.ctrl; return { phase: c.phase, stage: c.stage, auto: s.auto }; });
  assert.deepEqual(held, { phase: 2, stage: 'G', auto: false }, 'E–W ahead held for 90 seconds, no auto-return');
  await p.click('#jAutoSw');
  assert.equal(await p.getAttribute('#jAutoSw', 'aria-checked'), 'true');
  const moved = await p.evaluate(() => { const J = window.__junction; for (let i = 0; i < 30 * 8; i++) J.step(1 / 30); return J.site('A').ctrl.phase; });
  assert.notEqual(moved, 2, 'back on auto, the lights cycle again');
  // B has a switch of its own
  await p.evaluate(() => { const J = window.__junction; J.state().coins = 1000; J.buySite('B'); J.selectSite('B'); });
  assert.equal(await p.getAttribute('#jAutoSw', 'aria-checked'), 'true', 'B on auto');
  await p.click('#jAutoSw');
  assert.deepEqual(await p.evaluate(() => [window.__junction.site('A').auto, window.__junction.site('B').auto]), [true, false]);
  await ctx.close();
});

await check('the save: Continue brings back the coins, the clock and the junctions', async () => {
  const { ctx, p } = await phone();
  await p.click('#bNew');
  await p.evaluate(() => { const J = window.__junction; J.state().coins = 3000; J.buy('A', 'lanesEW'); J.buySite('B'); J.site('B').auto = false; for (let i = 0; i < 30 * 6; i++) J.step(1 / 30); });
  const p2 = await ctx.newPage(); p2.on('pageerror', e => errors.push(e.message));
  await p2.goto(BASE + '/junction/'); await p2.waitForFunction(() => window.__junction);
  assert.ok(await p2.isVisible('#bContinue'));
  assert.match(await p2.textContent('#saveLine'), /2 junctions/);
  await p2.click('#bContinue');
  const g = await p2.evaluate(() => { const J = window.__junction; return { b: J.site('B').active, lanes: !!J.site('A').up.lanesEW, coins: J.state().coins, autoB: J.site('B').auto, autoA: J.site('A').auto }; });
  assert.equal(g.b, true); assert.equal(g.lanes, true); assert.ok(g.coins > 2000);
  assert.deepEqual([g.autoA, g.autoB], [true, false], 'each junction\'s Auto is kept');
  await ctx.close();
});

await check('a long game with every upgrade: no car stays stuck, no crossing paths in a box at once, coins come in', async () => {
  const { ctx, p } = await phone();
  await p.click('#bNew');
  const r = await p.evaluate(() => {
    const J = window.__junction, G = J.state();
    G.coins = 1e6;
    for (const id of ['B', 'C', 'D', 'E']) J.buySite(id);
    for (const s of G.sites.filter(x => x.active)) for (const u of ['lights', 'filters', 'smart', 'rtor', 'lanesNS', 'lanesEW']) J.buy(s.id, u);
    for (const c of ['radio', 'speed', 'wave', 'charge']) J.buyCity(c);
    G.coins = 0; G.clock = 6.5;
    const still = {}; let worst = 0, crossing = 0;
    for (let t = 0; t < 30 * 60 * 4; t++) {
      J.step(1 / 30);
      for (const c of G.cars) { still[c.id] = c.v < 1 ? (still[c.id] || 0) + 1 / 30 : 0; if (c.committed) worst = Math.max(worst, still[c.id]); }
      if (t % 15 === 0) for (const s of G.sites) {
        const box = []; for (const lk in s.lanes) for (const c of s.lanes[lk]) if (c.committed && c.d > c.mv.dStop + 2 && c.d - c.len < c.mv.dBoxEnd - 2) box.push(c);
        for (let i = 0; i < box.length; i++) for (let k = i + 1; k < box.length; k++) if (J.CONF[box[i].key][box[k].key]) crossing++;
      }
    }
    return { coins: G.coins, cleared: G.cleared, worst, crossing, level: G.level, open: G.sites.filter(s => s.active).length };
  });
  assert.equal(r.open, 5, 'five junctions');
  assert.equal(r.crossing, 0, 'crossing paths in a box at once');
  assert.ok(r.worst < 40, 'a car in a box stood still for ' + r.worst.toFixed(1) + 's');
  assert.ok(r.cleared > 150 && r.coins > 300, 'coins came in: ' + JSON.stringify(r));
  await shot(p, 'five');
  await ctx.close();
});

await check('Vintage and Standard, light and dark: the frame takes the look, the toast and sheets read', async () => {
  for (const design of ['vintage', 'glass']) for (const scheme of ['light', 'dark']) {
    const { ctx, p } = await phone({ design, scheme });
    await p.click('#bNew');
    const look = await p.evaluate(() => document.documentElement.dataset.look);
    assert.equal(look, design);
    const bg = await p.evaluate(() => getComputedStyle(document.querySelector('.jpanel')).backgroundColor + '|' + getComputedStyle(document.querySelector('.jpanel')).backgroundImage);
    assert.ok(bg !== 'rgba(0, 0, 0, 0)|none', 'the panel has a ground');
    await shot(p, design + '-' + scheme);
    await p.click('#moreBtn'); await shot(p, design + '-' + scheme + '-settings');
    await ctx.close();
  }
});

await check('a car going ahead never stops at a green light just because the queue in front is still bunched up', async () => {
  // The 4th car in a line moving off on a green used to stop at the line: the road beyond looked full for a moment,
  // counted from behind the last car in. Now it goes while the road ahead is moving and has room.
  const { ctx, p } = await phone();
  await p.click('#bNew');
  const stops = await p.evaluate(() => {
    const J = window.__junction, G = J.state(), seen = new Set(); let n = 0;
    for (let k = 0; k < 24000; k++) {        // about 13 minutes of the game
      J.step(1 / 30);
      for (const s of G.sites) for (const lk in s.lanes) for (const car of s.lanes[lk]) {
        if (car.committed) continue;
        const sg = J.signal(s, car.ap), green = sg.main === 'G' || (sg.arrow === 'G' && car.turn !== 'S');
        if (green && car.turn === 'S' && car.v < 1 && car.mv.dStop - 3 - car.d < 8 && !J.roomAhead(car)) {
          const nx = car.next, lane = nx && nx.site.lanes[nx.lk];
          // the road ahead moving and not full (a road filling up toward a red light rightly makes it wait)
          const used = lane.reduce((u, o) => u + o.len + 6, nx.site.res[nx.lk] + car.len + 6);
          const room = !nx.site.active || used <= (lane.length ? lane[lane.length - 1].mv.dStop - 10 : Infinity);
          if (lane && lane.every(o => o.v >= 25) && room && !seen.has(car)) { seen.add(car); n++; }
        }
        break;
      }
    }
    return n;
  });
  assert.equal(stops, 0, stops + ' cars stopped at a green light with the road ahead moving and room on it');
  await ctx.close();
});

await check('no script errors and nothing the page\'s policy blocked', async () => {
  assert.deepEqual(errors, []);
});

await browser.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
