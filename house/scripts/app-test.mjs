// Opens Home in its preview (no Home Assistant: the sample readings) at iPhone
// size, light and dark, and checks the basics a change could break: every view
// in the drop-down opens with something in it, the lamps' brightness presets
// (the night moon at 1%, the sun at 100%) work, Away (Home Assistant's house-wide
// Eco flag: the pulsing pill and the two Nest cards' Eco look) comes and goes,
// and nothing errors or trips the
// Content-Security-Policy. Nothing outside the site is reached.
// All of it in both designs (../home/design.js): Vintage, the default, drawn in the Retro look over
// the Vintage sky (held at day, aos.sky), and Standard (Sea glass, design.house = 'glass'). Then
// Settings > Design switches between them at once and keeps the choice, and the old Home Vintage
// address (served from house/, as the deploy does) moves that app's data on the phone over once.
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
  p = p.replace(/^\/housevintage\//, '/house/');   // the old Home Vintage address: the deploy copies house/ there (news.yml)
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

// A phone: the walkthrough and any update screen as seen (as on a phone in use), the sky held at day,
// and the design if one is given; or the storage in `seed` instead of the seen list.
async function phone(scheme, { design = null, seed = null, at = '/house/' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin !== BASE) return route.abort('internetdisconnected');
    if (u.pathname.includes('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
    return route.continue();
  });
  await ctx.addInitScript(([design, seed]) => {
    if (sessionStorage.getItem('seeded')) return;   // once: a reload keeps what the page did
    if (seed) for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    else localStorage.setItem('aos.seen', JSON.stringify({ house: '999' }));
    localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.sky', 'day');
    if (design) localStorage.setItem('design.house', design);
    sessionStorage.setItem('seeded', '1');
  }, [design, seed]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('script error: ' + e.message));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI); }));
  await page.goto(BASE + at);
  await page.waitForSelector('#viewBtn');
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}
const css = (page, sel, props, pseudo) => page.$eval(sel, (e, [props, pseudo]) => { const c = getComputedStyle(e, pseudo || null); return props.map(p => c[p]); }, [props, pseudo]);
const look = page => page.evaluate(() => document.documentElement.dataset.look);
// The colour a script draws: the Office thermostat (heating, in the sample) gives its Heat target its colour
const heatTint = page => page.$eval('#g-fav [data-th="of"] .tb-tg', e => e.style.getPropertyValue('--c').trim());
const HEAT = { vintage: '216,87,42', glass: '255,166,92' };   // burnt orange, or Sea glass's warm peach (T_HC, app.js)

for (const [design, scheme] of [['vintage', 'dark'], ['vintage', 'light'], ['glass', 'dark'], ['glass', 'light']]) {
  const D = design === 'vintage' ? '' : 'Standard ';
  const { ctx, page, errors } = await phone(scheme, { design: design === 'glass' ? 'glass' : null });
  const label = `${D}${scheme}`;

  if (design === 'vintage') await test(`${label}: Vintage by default, in the Retro look: Futura, flat cream or walnut cards over the sky's ground, a mustard sun, a walnut view picker, the Retro colours in the script's drawing`, async () => {
    assert.equal(await look(page), 'vintage');
    assert.equal(await page.evaluate(() => document.getElementById('vintage').media), 'all');
    assert.match((await css(page, 'body', ['fontFamily']))[0], /Futura/);
    const ground = scheme === 'light' ? 'rgb(241, 223, 187)' : 'rgb(74, 57, 30)', card = scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)';
    assert.equal(await page.evaluate(() => document.documentElement.dataset.sky), 'day', 'the Vintage sky');
    assert.equal((await css(page, 'html', ['backgroundColor']))[0], ground, 'the page is the sky\'s ground');
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--bg')), '', 'no background colour painted over the sky');
    const [bg, radius, backdrop] = await css(page, '#g-fav .dg[data-th="of"]', ['backgroundColor', 'borderRadius', 'backdropFilter']);
    assert.ok(bg === card && radius === '22px' && (backdrop === 'none' || backdrop === ''), 'a flat card: ' + [bg, radius, backdrop].join(' | '));
    assert.ok(await page.$eval('#g-fav .dg[data-th="of"] .dg-fx', e => getComputedStyle(e).display === 'none'), 'no card sky');
    assert.equal((await css(page, '.ambient i', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'the mustard sun behind the title');
    assert.equal((await css(page, '.vbar', ['backgroundColor'], '::before'))[0], 'rgb(74, 52, 38)', 'the walnut view picker');
    assert.equal(await heatTint(page), HEAT.vintage, 'the Heat target is burnt orange');
    assert.equal(await page.$eval('.bgfx', e => getComputedStyle(e).display), 'none', 'nothing moving behind the page');
    assert.equal(await page.$eval('.bgfx canvas', c => c.hidden), true, 'and the background is not drawn');
    assert.equal(await page.getAttribute(`meta[name="theme-color"][media*="${scheme}"]`, 'content'), scheme === 'light' ? '#F1DFBB' : '#4A391E', 'the bar is the sky\'s ground');
    assert.equal(await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'default');
    assert.match(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'), /^icon-180\.png/);
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `home-vintage-${scheme}.png`) }); }
  });
  else await test(`${label}: Sea glass: the Vintage block off, no sky, the background picked (Bubbles over Temperature), the Sea glass colours in the script's drawing, icon and bars`, async () => {
    assert.equal(await look(page), 'glass');
    assert.equal(await page.evaluate(() => document.getElementById('vintage').media), 'not all');
    assert.ok(!(await page.evaluate(() => document.documentElement.hasAttribute('data-sky'))), 'no sky');
    assert.doesNotMatch((await css(page, 'body', ['fontFamily']))[0], /Futura/);
    const painted = await page.evaluate(() => document.documentElement.style.getPropertyValue('--bg'));
    assert.match(painted, /^#[0-9A-F]{6}$/, 'bg.js paints the page');
    const [r, g, b] = [1, 3, 5].map(i => parseInt(painted.slice(i, i + 2), 16));
    assert.equal((await css(page, 'html', ['backgroundColor']))[0], `rgb(${r}, ${g}, ${b})`, 'the page is that colour');
    assert.equal(await page.getAttribute(`meta[name="theme-color"][media*="${scheme}"]`, 'content'), painted, 'and so is the bar');
    assert.ok(await page.$eval('.ambient', e => getComputedStyle(e).display === 'none'), 'no Vintage sun');
    assert.notEqual(await page.$eval('.bgfx', e => getComputedStyle(e).display), 'none', 'the background shows');
    assert.equal(await page.$eval('.bgfx', e => e.dataset.bg), 'bubbles');
    assert.equal(await page.$eval('.bgfx canvas', c => c.hidden), false, 'Bubbles are drawn');
    assert.equal(await heatTint(page), HEAT.glass, 'the Heat target is Sea glass\'s');
    assert.equal(await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'black-translucent');
    assert.match(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'), /^icon-glass-180\.png/);
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `home-glass-${scheme}.png`) }); }
  });

  await test(`${label}: opens on Favorites, with the lamps' presets`, async () => {
    assert.equal((await page.textContent('#vbName')).trim(), 'Favorites');
    assert.ok(await page.locator('#g-fav .lp-chips').count() > 0, 'no lamp presets on Favorites');
  });

  await test(`${label}: speakers playing music are in Running Now, each one (grouped ones too), with no big card of their own`, async () => {
    const chips = await page.$$eval('#g-fav .runchip', bs => bs.map(b => b.querySelector('b').textContent + ':' + b.querySelector('span').textContent));
    assert.ok(chips.includes('Kitchen:Playing') && chips.includes('Office:Playing'), 'Kitchen and Office, grouped and playing: ' + chips.join(', '));
    assert.ok(!chips.some(c => /^(Lounge|Arc Sub):/.test(c)), 'not one paused, nor the Arc playing the TV: ' + chips.join(', '));
    assert.equal(await page.locator('#g-fav .mcard').count(), 0, 'no speaker card on Favorites');
    assert.match(await page.textContent('#g-fav .run-h span'), new RegExp('^' + chips.length + '$'));
  });

  await test(`${label}: the 1% chip is the night moon and the 100% chip the sun`, async () => {
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

  await test(`${label}: thermostat cards: the room's temperature leads the header as INSIDE; the outside one has its own icon and word at the foot`, async () => {
    for (const [id, inside] of [['lr', 70], ['of', 67]]) {
      const c = page.locator(`#g-fav [data-th="${id}"]`);
      const inn = c.locator('.tb-in'), out = c.locator('.tb-out');
      assert.equal((await inn.textContent()).replace(/\s+/g, ''), inside + '°Inside', id + ': the room, labelled');
      assert.equal(await inn.getAttribute('aria-label'), 'Inside, ' + inside + ' degrees');
      assert.equal(await inn.locator('small svg').count(), 1, id + ': a house beside INSIDE');
      assert.match((await out.textContent()).replace(/\s+/g, ' ').trim(), /^52° outside$/, id + ': the outside temperature, labelled');
      assert.equal(await out.locator('svg').count(), 1, id + ': its own icon');
      assert.equal(await out.getAttribute('aria-label'), 'Outside, 52 degrees');
      const [fi, fo, ft] = await Promise.all([inn.locator('b'), out.locator('b'), c.locator('.tb-tg b').first()].map(l => l.evaluate(e => parseFloat(getComputedStyle(e).fontSize))));
      assert.ok(fi > fo * 2, id + `: inside (${fi}px) is the bigger reading, outside is ${fo}px`);
      assert.ok(await c.locator('.tb-in').evaluate(e => e.getBoundingClientRect().bottom <= e.closest('.dg').querySelector('.tb-tgs').getBoundingClientRect().top), id + ': inside is above the targets, outside below');
      assert.ok(await c.locator('.tb-in').evaluate(e => e.getBoundingClientRect().top < e.closest('.dg').querySelector('.tb-out').getBoundingClientRect().top));
      assert.equal(await c.locator('.dg-name em').count(), 0, id + ': no small grey inside note beside the name');
    }
    // It follows the room: the reading changes, so does the card.
    await page.evaluate(() => { patchEnt('climate.living_room_living_room', null, { current_temperature: 72 }); render(); });
    assert.equal((await page.locator('#g-fav [data-th="lr"] .tb-in b').textContent()).trim(), '72°');
    await page.evaluate(() => { patchEnt('climate.living_room_living_room', null, { current_temperature: 70 }); render(); });
  });

  await test(`${label}: away from the house: a pulsing pill at the top of Favorites, and the two Nest cards go Eco; back home, all of it clears`, async () => {
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
    assert.match(await page.textContent('#thermoWrap .away-note'), /^\s*Away from the house: in Eco until someone arrives\.\s*$/);
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
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `home-away-${design}-${scheme}.png`) }); }
    // Someone is home: Home Assistant turns the flag off.
    await set(false);
    assert.ok(await pill.isHidden(), 'the pill stays after someone is home');
    assert.equal(await page.locator('.alert.eco').count(), 0, 'a leaf chip stays');
    assert.equal(await card('lr').locator('.dg-sky').evaluate(e => e.style.background), skyHome, 'the sky is back to the room\'s');
  });

  await test(`${label}: every view in the drop-down opens, with something in it`, async () => {
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

  await test(`${label}: the gear opens Settings, titled Settings with a Done tick, and the sub-views get a Close cross`, async () => {
    await page.click('#gear');
    await page.waitForFunction(() => document.getElementById('sheetWrap').classList.contains('open'));
    assert.equal((await page.textContent('#sheetTitle')).trim(), 'Settings');
    assert.equal(await page.getAttribute('#sheetClose', 'aria-label'), 'Done');
    assert.ok(await page.$('#sheetClose.okbtn'), 'the Done tick is the main button');
    assert.ok(await page.$('#sheetWrap .label'), 'labelled sections');
    assert.equal((await page.textContent('#sheetWrap .sheet-body .label')).trim(), 'Design', 'Design is the first section');
    assert.ok(await page.isVisible('#designBox [data-design="vintage"]') && await page.isVisible('#designBox [data-design="glass"]'), 'its two rows');
    assert.equal(await page.getAttribute(`#designBox [data-design="${design}"]`, 'aria-checked'), 'true', 'the design in use is ticked');
    assert.equal(await page.locator('#designBlock .help').count(), 0, 'no note under Design');
    assert.equal(await page.isVisible('#custBlock'), design === 'glass', 'Customization (the background) is Standard\'s only');
    await page.click('#sheetClose'); await page.waitForTimeout(500);
    assert.ok(!(await page.evaluate(() => document.getElementById('sheetWrap').classList.contains('open'))), 'Done closes it');
  });

  await test(`${label}: no script errors, nothing blocked by the page's policy`, async () => {
    const csp = await page.evaluate(() => window.__csp || []);
    assert.deepEqual([...errors, ...csp.map(c => 'blocked: ' + c)], []);
  });
  await ctx.close();
}

{ // Settings > Design: Vintage, then Standard and back, at once (the script's colours and the background too), kept across a reload
  const { ctx, page, errors } = await phone('light');
  await test('Design: Settings shows Vintage picked; Standard at once, with the sheet still open', async () => {
    await page.click('#gear'); await page.waitForTimeout(500);
    assert.equal(await page.getAttribute('#designBox [data-design="vintage"]', 'aria-checked'), 'true');
    assert.equal(await page.getAttribute('#designBox [data-design="glass"]', 'aria-checked'), 'false');
    await page.click('#designBox [data-design="glass"]'); await page.waitForTimeout(300);
    assert.equal(await look(page), 'glass');
    assert.equal(await page.getAttribute('#designBox [data-design="glass"]', 'aria-checked'), 'true');
    assert.ok(await page.evaluate(() => document.getElementById('sheetWrap').classList.contains('open')), 'Settings stays open');
    assert.ok(await page.isVisible('#custBlock'), 'Customization appears');
    assert.equal(await heatTint(page), HEAT.glass, 'the cards are drawn again in Sea glass');
    assert.match(await page.evaluate(() => document.documentElement.style.getPropertyValue('--bg')), /^#/, 'the background colour is painted');
    assert.equal(await page.$eval('.bgfx canvas', c => c.hidden), false, 'and the movement drawn');
    assert.ok(!(await page.evaluate(() => document.documentElement.hasAttribute('data-sky'))), 'no sky');
  });
  await test('Design: Standard is kept across a reload', async () => {
    await page.reload(); await page.waitForSelector('#viewBtn'); await page.waitForTimeout(800);
    assert.equal(await look(page), 'glass');
    assert.equal(await page.evaluate(() => localStorage.getItem('design.house')), 'glass');
  });
  await test('Design: back to Vintage at once (the sky, the Retro colours, nothing painted over it), kept', async () => {
    await page.click('#gear'); await page.waitForTimeout(500);
    await page.click('#designBox [data-design="vintage"]'); await page.waitForTimeout(300);
    assert.equal(await look(page), 'vintage');
    assert.equal(await heatTint(page), HEAT.vintage);
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--bg')), '');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.sky), 'day');
    assert.equal(await page.$eval('.bgfx canvas', c => c.hidden), true);
    assert.ok(!(await page.isVisible('#custBlock')), 'Customization hides');
    await page.reload(); await page.waitForSelector('#viewBtn'); await page.waitForTimeout(800);
    assert.equal(await look(page), 'vintage');
    assert.equal(await page.evaluate(() => localStorage.getItem('design.house')), 'vintage');
  });
  await test('Design: no script errors', async () => { assert.deepEqual(errors, []); });
  await ctx.close();
}

{ // the old Home Vintage app, on a phone that added it: its address opens Home, with its data moved over once
  const seed = { 'aos.seen': JSON.stringify({ housevintage: '1.3' }), 'housev.bg': '"ripples"', 'housev.tone': '"slate"', 'housev.toneV': '2' };
  const { ctx, page, errors } = await phone('light', { seed, at: '/housevintage/' });
  await test('old address: Home Vintage\'s data is now Home\'s (its background, Slate and Ripples, is the one kept for Standard)', async () => {
    const got = await page.evaluate(() => ({ bg: localStorage.getItem('house.bg'), tone: localStorage.getItem('house.tone'), drawn: document.querySelector('.bgfx').dataset.bg, label: document.getElementById('custBgV').textContent }));
    assert.deepEqual(got, { bg: '"ripples"', tone: '"slate"', drawn: 'ripples', label: 'Slate · Ripples' });
  });
  await test('old address: what it had seen carries over, nothing old is deleted, and it is in Vintage', async () => {
    const got = await page.evaluate(() => ({ seen: JSON.parse(localStorage.getItem('aos.seen') || '{}'), old: localStorage.getItem('housev.bg'), look: document.documentElement.dataset.look }));
    assert.equal(got.seen.house, '1.3');
    assert.equal(got.old, '"ripples"');
    assert.equal(got.look, 'vintage');
  });
  await test('old address: moved once only', async () => {
    await page.evaluate(() => localStorage.setItem('housev.bg', '"aurora"'));
    await page.reload(); await page.waitForSelector('#viewBtn'); await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => localStorage.getItem('house.bg')), '"ripples"');
  });
  await test('old address: no script errors', async () => { assert.deepEqual(errors, []); });
  await ctx.close();
}
{ // a share link (#join=) on a phone with nothing saved: the address sealed inside it is shown first, and nothing is sent until Join is tapped again
  const { ctx, page, errors } = await phone('light');
  const CODE = 'ABCDEFGHJK';
  const blob = await page.evaluate(code => SHARE.seal({ v: 1, u: 'https://ha.example', t: 'share-token', x: Date.now() + 5 * 60000 }, code), CODE);
  let sockets = 0;
  await page.routeWebSocket(/ha\.example/, () => { sockets++; });   // a stand-in: counts the connections, answers nothing
  await page.evaluate(b => { location.hash = '#join=' + b; }, blob);   // then opened again with it: a hash alone is no new page
  await page.reload();
  await page.waitForSelector('#vJoin:not([hidden])');
  await test('join link: the Join sheet opens, the link is out of the address bar, nothing is saved or sent yet', async () => {
    assert.equal(await page.evaluate(() => location.hash), '');
    assert.equal(await page.textContent('#jnFrom'), 'Enter the code they told you.');
    assert.equal(await page.evaluate(() => localStorage.getItem('house.ha')), null);
    assert.equal(sockets, 0);
  });
  await test('join link: the first Join shows the address it would connect to, and still sends nothing', async () => {
    await page.fill('#jnCode', CODE.slice(0, 5) + ' ' + CODE.slice(5));
    await page.click('#jnGo');
    await page.waitForFunction(() => /ha\.example/.test(document.getElementById('jnStatus').textContent));
    assert.equal(await page.textContent('#jnStatus'), 'This link joins https://ha.example. Tap Join again if that is your Home Assistant.');
    assert.equal(await page.$eval('#jnStatus', e => e.className), 'status', 'a notice, not an error');
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => localStorage.getItem('house.ha')), null);
    assert.equal(sockets, 0);
    assert.equal(await page.$eval('#jnGo', e => e.disabled), false);
  });
  await test('join link: a changed code starts over', async () => {
    await page.fill('#jnCode', CODE.slice(0, 9) + '2');
    assert.equal(await page.textContent('#jnStatus'), '');
    await page.click('#jnGo');
    await page.waitForFunction(() => document.getElementById('jnStatus').textContent !== '');
    assert.equal(await page.textContent('#jnStatus'), "That code doesn't match this link.");
    await page.fill('#jnCode', CODE);
    await page.click('#jnGo');
    await page.waitForFunction(() => /ha\.example/.test(document.getElementById('jnStatus').textContent));
    assert.equal(sockets, 0, 'the address is shown again first');
  });
  await test('join link: the second Join connects to it with the shared token', async () => {
    await page.click('#jnGo');
    await page.waitForFunction(() => localStorage.getItem('house.ha'));
    assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('house.ha'))), { url: 'https://ha.example', token: 'share-token', swap: 'This device' });
    await page.waitForTimeout(800);
    assert.equal(sockets, 1);
    assert.equal(await page.$eval('#jnGo', e => e.disabled), true);
  });
  await test('join link: no script errors', async () => { assert.deepEqual(errors, []); });
  await ctx.close();
}
{ // Favorites: no camera cards; the Yard camera's pause under the automations, as its Security card's
  const { ctx, page, errors } = await phone('dark');
  await test('Favorites: no camera cards, the Yard camera\'s pause under the automations', async () => {
    assert.equal(await page.locator('#g-fav .camcard').count(), 0);
    assert.match(await page.textContent('#g-fav [data-r="yard"]'), /Yard camera\s*Pause motion/);
    assert.deepEqual(await page.$$eval('#g-fav [data-r="yard"] .chip2', b => b.map(x => x.textContent)), ['30m', '1h', '2h', '4h']);
  });
  await test('Favorites: a pause chip pauses the Yard camera, shown here and on its Security card', async () => {
    await page.click('#g-fav [data-r="yard"] .chip2[data-v="60"]');
    await page.waitForFunction(() => /Paused · 60m/.test(document.querySelector('#g-fav [data-r="yard"]').textContent));
    assert.equal(await page.getAttribute('#g-fav [data-r="yard"] .chip2[data-v="60"]', 'aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => val('switch.yard_camera_motion_detection')), 'off');
    assert.equal(await page.getAttribute('[data-dv="cams:yard"] .campause .chip2[data-v="60"]', 'aria-pressed'), 'true');
    assert.deepEqual(errors, []);
  });
  await ctx.close();
}
{ // a phone with both: Home's own data is kept, the old app's is not copied over it
  const seed = { 'aos.seen': JSON.stringify({ house: '999', housevintage: '999' }), 'house.bg': '"aurora"', 'housev.bg': '"ripples"' };
  const { ctx, page } = await phone('light', { seed });
  await test('both: Home\'s own data is kept', async () => {
    assert.equal(await page.evaluate(() => localStorage.getItem('house.bg')), '"aurora"');
    assert.equal(await page.$eval('.bgfx', e => e.dataset.bg), 'aurora');
  });
  await ctx.close();
}
await browser.close();
server.close();
console.log(passed + ' tests passed');
