// Opens Home in its preview (no Home Assistant: the sample readings) at iPhone
// size, light and dark, and checks the basics a change could break: every view
// in the drop-down opens with something in it, the lamps' brightness presets
// (the night moon at 1%, the sun at 100%) work, Away (Home Assistant's house-wide
// Eco flag: the pulsing pill and the two Nest cards' Eco look) comes and goes,
// and nothing errors or trips the
// Content-Security-Policy. Nothing outside the site is reached.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node house/scripts/app-test.mjs [repo root]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';   // optional: a folder for screenshots
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
async function test(name, fn) {
  try { await fn(); passed++; console.log('ok - ' + name); }
  catch (e) { console.log('not ok - ' + name + '\n  ' + String(e.message || e).split('\n')[0]); await browser.close(); server.close(); process.exit(1); }
}

for (const scheme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin !== BASE) return route.abort('internetdisconnected');
    if (u.pathname.includes('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
    return route.continue();
  });
  // The walkthrough and any update screen as seen, as on a phone in use.
  await ctx.addInitScript(() => { localStorage.setItem('aos.seen', JSON.stringify({ house: '999' })); localStorage.setItem('aos.signin.asked', '1'); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('script error: ' + e.message));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI); }));
  await page.goto(BASE + '/house/');
  await page.waitForSelector('#viewBtn');
  await page.waitForTimeout(1500);

  await test(`${scheme}: opens on Favorites, with the lamps' presets`, async () => {
    assert.equal((await page.textContent('#vbName')).trim(), 'Favorites');
    assert.ok(await page.locator('#g-fav .lp-chips').count() > 0, 'no lamp presets on Favorites');
  });

  await test(`${scheme}: the 1% chip is the night moon and the 100% chip the sun`, async () => {
    const night = page.locator('#g-fav .chip2.night').first(), full = page.locator('#g-fav .chip2.full').first();
    assert.equal(await night.getAttribute('aria-label'), 'Night, 1%');
    assert.equal(await full.getAttribute('aria-label'), 'Full brightness, 100%');
    assert.equal(await night.locator('svg').count(), 1, 'the night chip has no moon');
    await night.click();
    await page.waitForFunction(() => document.querySelector('#g-fav .chip2.night')?.getAttribute('aria-pressed') === 'true');
    await full.click();
    await page.waitForFunction(() => document.querySelector('#g-fav .chip2.full')?.getAttribute('aria-pressed') === 'true');
    assert.equal(await page.locator('#g-fav .chip2.night').first().getAttribute('aria-pressed'), 'false', 'the moon stays lit at 100%');
  });

  await test(`${scheme}: away from the house: a pulsing pill at the top of Favorites, and the two Nest cards go Eco; back home, all of it clears`, async () => {
    const set = on => page.evaluate(on => { patchEnt('input_boolean.thermostat_eco', on ? 'on' : 'off'); render(); }, on);
    const card = id => page.locator(`#g-fav [data-th="${id}"]`);
    // Home Assistant's flag is off: nothing says away.
    assert.ok(await page.locator('#g-fav .awaypill').isHidden(), 'the pill shows with nobody away');
    assert.equal(await page.locator('#g-fav .alert.eco').count(), 0);
    const skyHome = await card('lr').locator('.dg-sky').evaluate(e => e.style.background);
    // The last person leaves: Home Assistant turns the flag on.
    await set(true);
    const pill = page.locator('#g-fav .awaypill');
    assert.ok(await pill.isVisible(), 'no pill while away');
    assert.equal(await page.$eval('#g-fav', b => b.firstElementChild.classList.contains('awaypill')), true, 'the pill is first in the view, above the energy strip');
    assert.match(await pill.textContent(), /Away from the house/);
    assert.match(await pill.textContent(), /Thermostats in Eco · since /);
    assert.equal(await pill.getAttribute('role'), 'status');
    assert.notEqual(await pill.evaluate(e => getComputedStyle(e).animationName), 'none', 'the pill pulses');
    assert.notEqual(await pill.locator('.away-dot').evaluate(e => getComputedStyle(e, '::after').animationName), 'none', 'and its dot sends out a ring');
    // Both Nest cards: the leaf chip, Eco labels, the Eco sky - and their steppers still work.
    for (const id of ['lr', 'of']) {
      const c = card(id);
      assert.match(await c.locator('.alert.eco').textContent(), /Away · Eco/, id + ': the leaf chip');
      assert.ok(await c.locator('.tb-tg small', { hasText: /eco/i }).count() > 0, id + ': Eco labels on the targets');
      assert.ok(await c.locator('.tb-chev').count() > 0, id + ': the steppers stay, they are ordinary setpoints');
      assert.notEqual(await c.locator('.dg-sky').evaluate(e => e.style.background), skyHome, id + ': the Eco sky');
    }
    assert.ok((await card('lr').locator('.tb-tg small').allTextContents()).join(' ').match(/eco low.*eco high/i), 'two targets: Eco low and Eco high');
    // The Office is heating in the sample, and still reads as Eco: its words say heating, its sky is the moss.
    assert.match(await card('of').locator('.tb-sub').textContent(), /Heating/);
    assert.match(await card('of').locator('.dg-sky').evaluate(e => e.style.background), /rgb\(22, 29, 25\)/, 'the Office card has the Eco sky while it heats');
    // The Windmill has its own Eco: untouched.
    await page.evaluate(() => goView('climate'));
    assert.equal(await page.locator('[data-th="wm"] .alert.eco').count(), 0, 'the Windmill is left alone');
    // The popup says why.
    await page.evaluate(() => openThermo('lr'));
    assert.match(await page.textContent('#thermoWrap .away-note'), /Away from the house.*back on the schedule/);
    await page.evaluate(() => { document.querySelector('#thermoWrap [data-close]')?.click(); });
    await page.evaluate(() => goView('fav'));
    // The menu says it too.
    await page.click('#viewBtn');
    assert.match(await page.textContent('#viewMenu [data-view="fav"] small'), /^Away/);
    await page.click('#viewBtn');
    // Reduce Motion: the same pill, still.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await pill.evaluate(e => getComputedStyle(e).animationName), 'none', 'the pill is still under Reduce Motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `home-away-${scheme}.png`) }); }
    // Someone is home: Home Assistant turns the flag off.
    await set(false);
    assert.ok(await pill.isHidden(), 'the pill stays after someone is home');
    assert.equal(await page.locator('.alert.eco').count(), 0, 'a leaf chip stays');
    assert.equal(await card('lr').locator('.dg-sky').evaluate(e => e.style.background), skyHome, 'the sky is back to the room\'s');
  });

  await test(`${scheme}: every view in the drop-down opens, with something in it`, async () => {
    await page.click('#viewBtn');
    const ids = await page.$$eval('#viewMenu [data-view]', els => els.map(e => e.dataset.view));
    assert.ok(['fav', 'climate', 'lights', 'media', 'security', 'around'].every(id => ids.includes(id)), 'views in the menu: ' + ids.join());
    await page.click('#viewBtn');
    for (const id of ids) {
      await page.click('#viewBtn');
      await page.click(`#viewMenu [data-view="${id}"]`);
      await page.waitForFunction(id => { const b = document.getElementById('g-' + id); return b && !b.hidden; }, id);
      const shown = await page.$eval('#g-' + id, b => b.children.length && b.getBoundingClientRect().height > 50);
      assert.ok(shown, `the ${id} view is empty`);
    }
  });

  await test(`${scheme}: no script errors, nothing blocked by the page's policy`, async () => {
    const csp = await page.evaluate(() => window.__csp || []);
    assert.deepEqual([...errors, ...csp.map(c => 'blocked: ' + c)], []);
  });
  await ctx.close();
}
await browser.close();
server.close();
console.log(passed + ' tests passed');
