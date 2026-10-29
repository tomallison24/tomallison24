// aOS's Look picker, as a person uses it at iPhone size: aOS opens in Vintage; under the account
// (Appearance > Look) Sea glass puts the original look back at once, and it is kept - a reload
// opens in Sea glass with the right look from the first paint; Vintage brings the new one back.
// Before aOS is added to the Home Screen (iPhone, in Safari) its install steps start with the look:
// the pick sets the icon, the status bar and the address that are added, and the installed app
// (empty storage of its own) opens in the look the address or the cookie carries. Layers and Tron:
// picked in Appearance, each is aOS's look and every app's (each app's design.<id>, Clock's set.design),
// with its own block, ground (Layers: its sky's top, by the time of day), icons and (Tron) fonts; Night Drive, which
// Layers replaced, opens in Layers. Tron, as in the car: dark only, its light trail behind everything,
// the helper as the Tron rider, and aOS opening with its intro and its sound (nothing to tap), once a launch, Skip and
// Off in Account.
// The accounts server is stood in for (the server rules are accounts-api-test.mjs).
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node aOS/scripts/look-test.mjs [repo root]
import { createRequire } from 'module'; import { execSync } from 'child_process'; import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/'); const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const { SKIES } = await import(new URL('./looks.mjs', import.meta.url));
const SKY_TOP = Object.fromEntries(Object.keys(SKIES.light).map(t => [t, [SKIES.light[t][3], SKIES.dark[t][3]]]));   // Layers' bar colours, by the time of day
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, r)); const BASE = 'http://localhost:' + server.address().port;
const b = await chromium.launch();
let failed = 0;
const report = (name, problems) => { if (problems.length) { failed++; console.log('not ok - ' + name + '\n  ' + problems.join('\n  ')); } else console.log('ok - ' + name); };

async function open(scheme = 'light', seed = {}, o = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: o.still ? 'reduce' : 'no-preference',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mobile/15E148 Safari/604.1' });
  const user = { id: 'u1', name: 'Sarah', role: 'member', apps: {} };
  await ctx.addInitScript(s => { try { localStorage.setItem('aos.sky', 'day'); if (!s.__fresh) localStorage.setItem('aos.seen', JSON.stringify({ aos: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.session', JSON.stringify({ t: 'x' })); if (!s.__install) sessionStorage.setItem('aos.later.aos', '1');
    for (const k in s) if (!k.startsWith('__') && !sessionStorage.getItem('seeded.' + k)) { localStorage.setItem(k, s[k]); sessionStorage.setItem('seeded.' + k, '1'); } } catch {}
    if (s.__home) Object.defineProperty(navigator, 'standalone', { get: () => true }); }, seed);   // __home: opened from the Home Screen
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort();
    if (!u.pathname.startsWith('/aOS/api/')) return r.continue();
    const route = u.pathname.slice('/aOS/api/'.length), J = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (route === 'state') return J({ storage: true, setup: true, user, plan: null });
    if (route === 'members') return J({ members: [user] });
    return J({});
  });
  if (o.watch) await ctx.addInitScript(() => {   // Tron's intro, as it comes and goes (aOS/tron-intro.js)
    window.__tron = {};
    new MutationObserver(() => { const e = document.getElementById('tronIntro'); if (!e) return; const t = window.__tron; t.shown = true;
      t.name = (e.querySelector('.ti-name') || {}).textContent; t.hi = (e.querySelector('.ti-hi') || {}).textContent; if (e.classList.contains('ask')) t.ask = true; if (e.querySelector('.ti-sound')) t.soundButton = true; })
      .observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  if (o.cookie) await ctx.addCookies([{ name: 'aos_look', value: o.cookie, url: BASE + '/aOS/' }]);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/aOS/' + (o.query || '')); await p.evaluate(() => aosTabs.show('today')); await p.waitForSelector('#stories .story');   // aOS2 opens on Home (in Safari, under its install steps)
  return { ctx, p, errs };
}
const css = (p, sel, prop) => p.locator(sel).first().evaluate((e, k) => getComputedStyle(e)[k], prop);
const tint = p => p.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content).join());
const WALNUT = 'rgb(74, 52, 38)';
const openLook = async p => { await p.click('#today [data-acct]'); await p.click('[aria-controls="fLook"]'); await p.waitForSelector('#looks .dopt'); };   // Account, its Appearance fold
const selected = p => p.locator('#looks .dopt[aria-selected="true"]').evaluateAll(es => es.map(e => e.dataset.look).join());

// 1. aOS opens in Vintage, and the Look picker offers both, Vintage picked
{
  const { ctx, p, errs } = await open(); const pr = [...errs];
  if (await p.evaluate(() => document.documentElement.dataset.look) !== 'vintage') pr.push('not Vintage to begin with');
  if (await css(p, '.quick', 'backgroundColor') !== WALNUT) pr.push('the Home button along the bottom is not on walnut: ' + await css(p, '.quick', 'backgroundColor'));
  if (!/#F1DFBB/i.test(await tint(p))) pr.push('the status bar tint is not the day sky\'s cream and mustard (home/sky.js): ' + await tint(p));
  await openLook(p);
  const names = await p.locator('#looks .dopt b').allTextContents();
  if (names.join() !== 'Vintage,Sea glass,Layers,Tron Special Edition') pr.push('the picker offers ' + names.join());
  if (await selected(p) !== 'vintage') pr.push('Vintage is not the one picked: ' + await selected(p));
  if (await p.locator('#looks [data-look="grid"] .se').evaluate(e => getComputedStyle(e).animationName) !== 'aosSeShine') pr.push('Tron\'s Special Edition badge does not animate');
  report('aOS opens in Vintage; Appearance > Look offers Vintage, Sea glass, Layers and Tron Special Edition (its badge animated), Vintage picked', pr); await ctx.close();
}

// 2. Sea glass at once, kept over a reload, with no flash of Vintage; Vintage again
{
  const { ctx, p, errs } = await open(); const pr = [...errs];
  await openLook(p); await p.click('#looks [data-look="glass"]');
  if (await p.evaluate(() => document.documentElement.dataset.look) !== 'glass') pr.push('Sea glass did not apply');
  if (await selected(p) !== 'glass') pr.push('the picker does not show Sea glass picked');
  if (await css(p, '.quick', 'backgroundColor') === WALNUT) pr.push('the Home button along the bottom is still on walnut in Sea glass');
  if (!/#EEF2F0/i.test(await tint(p))) pr.push('the status bar tint is not mist in Sea glass: ' + await tint(p));
  if (await p.evaluate(() => localStorage.getItem('aos.look')) !== 'glass') pr.push('the choice is not kept');
  // a reload: the look is in place before the page runs (look.js is in the head), and the family icon is the glass one
  await p.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { window.__look = document.documentElement.dataset.look + '/' + document.getElementById('vintage').media; }));
  await p.reload(); await p.evaluate(() => aosTabs.show('today')); await p.waitForSelector('#stories .story');
  const early = await p.evaluate(() => window.__look);
  if (early !== 'glass/not all') pr.push('on a reload the look at DOMContentLoaded was ' + early);
  if (await css(p, '.quick', 'backgroundColor') === WALNUT) pr.push('after a reload the Home button along the bottom is on walnut');
  if (!await p.locator('#famhero #fam-g').count()) pr.push('the family icon is not the glass one');
  await openLook(p); await p.click('#looks [data-look="vintage"]');
  if (await css(p, '.quick', 'backgroundColor') !== WALNUT) pr.push('Vintage did not come back');
  if (await p.locator('#famhero #fam-g').count()) pr.push('the family icon is still the glass one in Vintage');
  if (await p.evaluate(() => localStorage.getItem('aos.look')) !== 'vintage') pr.push('Vintage is not kept');
  report('Sea glass applies at once and is kept over a reload with no flash; Vintage brings the new look back', pr); await ctx.close();
}

// 3. Sea glass in dark mode, and a bad stored value falls back to Vintage
{
  const { ctx, p, errs } = await open('dark', { 'aos.look': 'glass' }); const pr = [...errs];
  if (await p.evaluate(() => document.documentElement.dataset.look) !== 'glass') pr.push('the stored Sea glass was not used');
  if (!/#0D1213/i.test(await tint(p))) pr.push('the dark status bar tint is not the Sea glass ground: ' + await tint(p));
  await ctx.close();
  const o = await open('dark', { 'aos.look': 'disco' });
  if (await o.p.evaluate(() => document.documentElement.dataset.look) !== 'vintage') pr.push('an unknown look did not fall back to Vintage');
  if (!/#4A391E/i.test(await tint(o.p))) pr.push('the dark Vintage tint is not the day sky\'s walnut and mustard (home/sky.js): ' + await tint(o.p));
  await o.ctx.close();
  report('Sea glass in dark mode; an unknown stored look falls back to Vintage', pr);
}

// 4. the install steps: Choose your look first; Sea glass changes the icon, the status bar and the address; then how to add it
{
  const { ctx, p, errs } = await open('light', { __install: '1' }); const pr = [...errs];
  await p.waitForSelector('#aos-welcome .c-panel.on .c-look', { timeout: 15000 });   // .on: the buttons are wired up (the cards are drawn a moment before)
  const h2 = async () => (await p.locator('#aos-welcome h2').first().innerText().catch(() => '')).trim();
  if (await h2() !== 'Choose your look') pr.push('the first step was ' + await h2());
  const names = await p.locator('#aos-welcome .c-look b').allTextContents();
  if (names.join() !== 'Vintage,Sea glass,Layers,Tron Special Edition') pr.push('the install step offers ' + names.join());
  const touch = () => p.evaluate(() => document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href'));
  const bar = () => p.evaluate(() => document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content);
  if (await touch() !== 'icon-180.png?v=3' || await bar() !== 'default') pr.push('Vintage: icon ' + await touch() + ', status bar ' + await bar());
  await p.click('#aos-welcome .c-look[data-look="glass"]');
  if (await touch() !== 'icon-glass-180.png?v=1') pr.push('Sea glass: the Home Screen icon is ' + await touch());
  if (await bar() !== 'black-translucent') pr.push('Sea glass: the status bar style is ' + await bar());
  if (!/[?&]look=glass/.test(await p.evaluate(() => location.search))) pr.push('the address does not carry look=glass: ' + await p.evaluate(() => location.search));
  if (await p.evaluate(() => document.cookie) !== 'aos_look=glass') pr.push('the cookie is ' + await p.evaluate(() => document.cookie));
  await p.click('#aos-welcome .c-btns .w-btn');
  await p.waitForFunction(() => (document.querySelector('#aos-welcome h2') || {}).textContent !== 'Choose your look', null, { timeout: 5000 }).catch(() => {});
  if (await h2() !== 'Add aOS to your Home Screen') pr.push('then showed ' + await h2());
  if (!await p.locator('#aos-welcome .c-sd').count()) pr.push('no Safari steps after the look');
  report('install steps: Choose your look first; Sea glass sets the icon, status bar, address and cookie; then the Safari steps', pr); await ctx.close();
}

// 5. the Home Screen app starts with empty storage: the address, or the cookie, carries the look in; storage wins afterwards
{
  const pr = [];
  const a = await open('light', {}, { query: '?look=glass' }); pr.push(...a.errs);
  if (await a.p.evaluate(() => document.documentElement.dataset.look) !== 'glass') pr.push('?look=glass was not used on a first launch');
  if (await a.p.evaluate(() => localStorage.getItem('aos.look')) !== 'glass') pr.push('the first launch did not keep it');
  await a.ctx.close();
  const c = await open('light', {}, { cookie: 'glass' }); pr.push(...c.errs);
  if (await c.p.evaluate(() => document.documentElement.dataset.look) !== 'glass') pr.push('the cookie was not used on a first launch');
  await c.ctx.close();
  const s = await open('light', { 'aos.look': 'vintage' }, { query: '?look=glass', cookie: 'glass' }); pr.push(...s.errs);
  if (await s.p.evaluate(() => document.documentElement.dataset.look) !== 'vintage') pr.push('the address or cookie overrode a look already chosen here');
  await s.ctx.close();
  const j = await open('light', {}, { query: '?look=disco' });
  if (await j.p.evaluate(() => document.documentElement.dataset.look) !== 'vintage') pr.push('an unknown ?look= did not fall back to Vintage');
  await j.ctx.close();
  report('the installed app takes the look from the address or the cookie on its first launch; a look already chosen wins', pr);
}

// 6. Layers and Tron: aOS's look and every app's, at once; their own block, ground, icons and fonts
{
  const { ctx, p, errs } = await open(); const pr = [...errs];
  const state = () => p.evaluate(() => ({ look: document.documentElement.dataset.look, tod: document.documentElement.dataset.tod, media: ['vintage', 'layers', 'grid'].map(id => document.getElementById(id).media).join(),
    designs: ['mail', 'weather', 'notes', 'house'].map(id => localStorage.getItem('design.' + id)).join(), clock: ((JSON.parse(localStorage.getItem('allison-clock-v1')) || {}).set || {}).design,
    icon: (document.querySelector('link[rel="apple-touch-icon"]') || {}).href || '', tint: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content).join() }));
  await openLook(p); await p.click('#looks [data-look="layers"]'); await p.waitForTimeout(200);
  let st = await state();
  if (st.look !== 'layers') pr.push('Layers did not apply: ' + st.look);
  if (st.media !== 'all,all,not all') pr.push('Layers should keep Vintage on and its own block on: ' + st.media);
  if (st.designs !== 'layers,layers,layers,layers' || st.clock !== 'layers') pr.push('not every app took Layers: ' + st.designs + ' / clock ' + st.clock);
  if (!/icon-layers-180\.png/.test(st.icon)) pr.push('the Home Screen icon is not Layers\': ' + st.icon);
  if (!st.tint.split(',').every(c => SKY_TOP[st.tod] && SKY_TOP[st.tod].includes(c.toUpperCase()))) pr.push(`the status bar tint ${st.tint} is not the top of Layers' ${st.tod} sky`);
  if (await selected(p) !== 'layers') pr.push('the picker does not show Layers picked');
  if (!/Layers/.test(await p.locator('#lookSub').innerText())) pr.push('the Appearance line does not say Layers');
  if (await p.evaluate(() => document.documentElement.hasAttribute('data-sky'))) pr.push('the Vintage sky is still drawn in Layers');
  if (await p.evaluate(() => !/gradient/.test(getComputedStyle(document.documentElement).backgroundImage))) pr.push('Layers\' sky is not behind the page');
  if (await p.locator('#stories .story img').first().getAttribute('src').then(s => !/icon-layers-512/.test(s || ''))) pr.push('the apps\' icons are not Layers\'');
  await p.reload(); await p.evaluate(() => aosTabs.show('today')); await p.waitForSelector('#stories .story');
  if (await p.evaluate(() => document.documentElement.dataset.look) !== 'layers') pr.push('Layers is not kept over a reload');
  // a phone that had Night Drive (gone): aOS opens in Layers, and every app's choice is moved over
  await p.evaluate(() => { localStorage.setItem('aos.look', 'neon'); localStorage.setItem('design.mail', 'neon'); localStorage.setItem('allison-clock-v1', JSON.stringify({ set: { design: 'neon' } })); });
  await p.reload(); await p.waitForTimeout(300);
  const was = await p.evaluate(() => [document.documentElement.dataset.look, localStorage.getItem('aos.look'), localStorage.getItem('design.mail'), JSON.parse(localStorage.getItem('allison-clock-v1')).set.design].join());
  if (was !== 'layers,layers,layers,layers') pr.push('a phone that had Night Drive did not move to Layers: ' + was);
  await p.evaluate(() => aosTabs.show('today')); await p.waitForSelector('#stories .story');
  await openLook(p); await p.click('#looks [data-look="grid"]'); await p.waitForTimeout(200);
  st = await state();
  if (st.look !== 'grid' || await p.evaluate(() => document.getElementById('grid').media) !== 'all') pr.push('Tron did not apply: ' + st.look);
  if (!/^grid,grid,grid,grid$/.test(st.designs) || st.clock !== 'grid') pr.push('not every app took Tron: ' + st.designs + ' / clock ' + st.clock);
  if (!/icon-grid-180\.png/.test(st.icon)) pr.push('the Home Screen icon is not Tron\'s: ' + st.icon);
  const gfont = await p.evaluate(async () => { await Promise.all(['700 16px "Orbitron"', '16px "Exo 2"'].map(f => document.fonts.load(f, 'Home'))); return document.fonts.check('700 16px "Orbitron"', 'Home') && document.fonts.check('16px "Exo 2"', 'Home'); });
  if (!gfont) pr.push('Tron\'s fonts (Orbitron, Exo 2) did not load from ../home/fonts');
  report('Layers and Tron: picked in Appearance, aOS and every app take it, with its own block, tint, icons and fonts; Night Drive moves to Layers', pr); await ctx.close();
}

// 7. under an iPhone's solid status bar, an app's shapes fade in from its ground in every flat look (../home/sky.js),
// the fade a solid square band (not one of the shapes: no shape's opacity or roundness), and the tint is that ground
for (const scheme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme });
  const pr = [];
  for (const look of ['vintage', 'layers', 'grid']) {
    await ctx.addInitScript(l => { localStorage.setItem('aos.bar', 'solid'); localStorage.setItem('aos.seen', JSON.stringify({ calendar: '999' })); localStorage.setItem('design.calendar', l); }, look);
    const p = await ctx.newPage(); p.on('pageerror', e => pr.push(look + ': ' + e.message));
    await p.route('**/api/**', r => r.fulfill({ status: 401, body: '{}' }));
    await p.goto(BASE + '/calendar/'); await p.waitForTimeout(900);
    const c = await p.evaluate(() => { const e = document.querySelector('.ambient .aos-sky-cap'); if (!e) return null; const cs = getComputedStyle(e), r = e.getBoundingClientRect();
      return { display: cs.display, opacity: cs.opacity, radius: cs.borderRadius, top: Math.round(r.top), covers: r.left <= 0 && r.right >= innerWidth, first: (/^linear-gradient\((rgba?\([^)]*\))/.exec(cs.backgroundImage) || [])[1],
        ground: (b => /,\s*0\)$|transparent/.test(b) ? getComputedStyle(document.documentElement).backgroundColor : b)(getComputedStyle(document.body).backgroundColor), tint: [...document.querySelectorAll('meta[name="theme-color"]')].find(m => !m.media || matchMedia(m.media).matches).content }; });
    const hex = s => '#' + (s.match(/\d+/g) || []).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
    if (look === 'layers') {   // no fade: the sky runs on up under the bar, which takes the sky's top (the page's colour)
      if (c && c.display !== 'none') pr.push('layers: a fade under the status bar, over the sky');
      const t = await p.evaluate(() => [[...document.querySelectorAll('meta[name="theme-color"]')].find(m => !m.media || matchMedia(m.media).matches).content, getComputedStyle(document.documentElement).backgroundColor]);
      if (t[0].toUpperCase() !== hex(t[1])) pr.push(`layers: the status bar tint ${t[0]} is not the page's colour ${hex(t[1])}`);
    } else if (!c || c.display !== 'block') pr.push(look + ': no fade under the status bar');
    else {
      if (c.opacity !== '1' || c.radius !== '0px') pr.push(`${look}: the fade is styled as a shape (opacity ${c.opacity}, corners ${c.radius})`);
      if (c.top !== 0 || !c.covers) pr.push(`${look}: the fade does not cover the top of the page (top ${c.top})`);
      if (c.first !== c.ground) pr.push(`${look}: the fade starts at ${c.first}, not the page's ground ${c.ground}`);
      if (look !== 'vintage' && c.tint.toUpperCase() !== hex(c.ground)) pr.push(`${look}: the status bar tint ${c.tint} is not the page's ground ${hex(c.ground)}`);
    }
    await p.close();
  }
  report(`under a solid status bar (${scheme}), an app's shapes fade in from its own ground in Vintage and Tron, Layers' sky runs on up under it, and the tint matches`, pr); await ctx.close();
}

// 8. aOS's bar is the colour of the page, whichever mode's meta iOS goes by: Appearance set to Dark on a phone in
// light mode, at night, in Vintage and then Layers; then Light again. Under a solid bar (an iPhone's), iOS 26
// goes by #barcap: over 10px tall, so iOS takes its colour as it is, and taken off and put back on each change
// of colour, so iOS reads it again (without both, the bar kept its first colour: another look's)
{
  const { ctx, p, errs } = await open('light', { 'aos.sky': 'night', 'aos.bar': 'solid', 'home.settings': JSON.stringify({ theme: 'dark' }) }); const pr = [...errs];
  await p.evaluate(() => { window.capOff = 0; new MutationObserver(ms => { for (const m of ms) if (/display:\s*none/.test(m.oldValue || '')) capOff++; }).observe(document.getElementById('barcap'), { attributes: true, attributeOldValue: true, attributeFilter: ['style'] }); });
  const bar = async () => { await p.waitForTimeout(300); return p.evaluate(() => { const hex = c => '#' + c.match(/\d+/g).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase(), cap = document.getElementById('barcap');
    const off = capOff; capOff = 0;
    return { ground: hex((b => /,\s*0\)$|transparent/.test(b) ? getComputedStyle(document.documentElement).backgroundColor : b)(getComputedStyle(document.body).backgroundColor)), metas: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content.toUpperCase()),
      cap: hex(getComputedStyle(cap).backgroundColor), capH: cap.getBoundingClientRect().height, capTop: cap.getBoundingClientRect().top, off }; }); };
  const check = async (what, changed = true) => { const s = await bar();
    if (s.metas.some(m => m !== s.ground)) pr.push(`${what}: the bar's metas ${s.metas.join(', ')} are not the page's ${s.ground}`);
    if (s.cap !== s.ground) pr.push(`${what}: #barcap is ${s.cap}, not the page's ${s.ground}`);
    if (s.capTop !== 0 || s.capH <= 10) pr.push(`${what}: #barcap is ${s.capH}px tall at ${s.capTop}px: iOS samples a strip 10px or less once and keeps that colour`);
    if (changed && !s.off) pr.push(`${what}: #barcap changed colour but was not taken off and put back, so iOS keeps the old colour`); };
  await check('Vintage, Dark on a light phone', false);
  await openLook(p); await p.click('#looks [data-look="layers"]');
  await check('Layers, Dark on a light phone');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('home.settings')); s.theme = 'light'; localStorage.setItem('home.settings', JSON.stringify(s)); document.documentElement.setAttribute('data-theme', 'light'); dispatchEvent(new CustomEvent('aos:theme', { detail: 'light' })); });
  await check('Layers, Light');
  report('aOS\'s bar takes the colour the page shows, with Appearance set to Light or Dark, in Vintage and Layers, and iOS reads it again on each change', pr); await ctx.close();
}

// 8. erased (a lost phone, home/welcome.js eraseHere): the aos_look cookie goes with the storage, so the next install starts clean
{
  const { ctx, p, errs } = await open('light', {}, { cookie: 'glass' }); const pr = [...errs];
  if (await p.evaluate(() => document.cookie) !== 'aos_look=glass') pr.push('the cookie was not there to begin with: ' + await p.evaluate(() => document.cookie));
  await p.evaluate(() => { AllisonOS.erase(); }).catch(() => {}); await p.waitForLoadState('load').catch(() => {}); await p.waitForTimeout(1500);
  if (await p.evaluate(() => document.cookie) !== '') pr.push('after the erase the cookie is still there: ' + await p.evaluate(() => document.cookie));
  if (await p.evaluate(() => localStorage.getItem('aos.look')) !== null) pr.push('aos.look is still stored');
  report('erased from a lost phone: the aos_look cookie goes with the storage', pr); await ctx.close();
}

// 9. Tron, as in the car: dark only (a phone in light mode with Appearance set to Light: aOS and an app are dark, and Light is
// back with another look); the trail behind everything; aOS opens with its intro once a launch, its sound with nothing to
// tap, Skip ending it, Off in Account stopping it; the helper is the Tron rider, called Ares (your own name back after)
{
  const seed = { 'aos.look': 'grid', 'design.notes': 'grid', 'home.settings': JSON.stringify({ theme: 'light' }), 'aos.helper': '{"who":"fox","name":"Biscuit"}' };
  const { ctx, p, errs } = await open('light', seed, { watch: true }); const pr = [...errs];
  // the intro was there from the first paint, its sound with nothing to tap (no "Tap for sound")
  const seen = await p.evaluate(() => window.__tron || {});
  if (!seen.shown || seen.name !== 'aOS' || seen.hi !== 'Greetings, programs.') pr.push('aOS did not open with the Tron intro: ' + JSON.stringify(seen));
  if (seen.ask || seen.soundButton) pr.push('the intro asks for a tap for its sound');
  await p.waitForFunction(() => !document.getElementById('tronIntro'), null, { timeout: 6000 }).catch(() => pr.push('the intro did not end by itself'));
  let st = await p.evaluate(() => ({ theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.documentElement).backgroundColor, body: getComputedStyle(document.body).backgroundColor,
    before: getComputedStyle(document.documentElement, '::before').zIndex, after: getComputedStyle(document.documentElement, '::after').content, who: (document.querySelector('#ipsySlot .ipsy-char') || {}).dataset?.who }));
  if (st.theme !== 'dark' || !/^rgb\((\d), (\d), (\d)\)$/.test(st.bg)) pr.push('Tron is not dark on a phone in light mode with Light picked: ' + JSON.stringify(st));
  if (st.before !== '-1' || st.after === 'none' || !/, 0\)$|transparent/.test(st.body)) pr.push('the light trail is not behind everything: ' + JSON.stringify(st));
  if (st.who !== 'rider') pr.push('the helper is not the Tron rider in Tron: ' + st.who);
  const ph = await p.evaluate(() => document.getElementById('hq').placeholder);
  if (!/ask Ares$/.test(ph)) pr.push('in Tron the helper is not called Ares: ' + ph);
  // once a launch: a reload doesn't play it again
  await p.reload(); await p.waitForTimeout(300);
  if (await p.evaluate(() => !!document.getElementById('tronIntro'))) pr.push('the intro played again on a reload');
  // played again from Account: the phone won't start the sound by itself, so it asks; a tap plays it; Skip ends it
  await p.evaluate(() => aosTabs.show('today')); await p.waitForSelector('#stories .story');
  await openLook(p);
  if (!(await p.isVisible('#tronIntroPick [data-ti="sound"][aria-pressed="true"]'))) pr.push('Account has no Tron intro setting, Sound picked');
  if (!(await p.isVisible('.tronnote'))) pr.push('Account does not say Tron is always dark');
  await p.click('[data-tiplay]');   // a tap: its sound plays at once
  await p.waitForSelector('#tronIntro[data-sound="playing"]', { timeout: 3000 }).catch(() => pr.push('played from Account, the intro\'s sound did not play'));
  // (a sound played holds the intro on about two seconds more: time for Skip)
  if (await p.evaluate(() => !!document.querySelector('#tronIntro:not(.out)'))) {
    await p.click('#tronIntro:not(.out) .ti-skip', { timeout: 3000 });
    await p.waitForFunction(() => !document.getElementById('tronIntro'), null, { timeout: 2000 }).catch(() => pr.push('Skip did not end the intro'));
  } else pr.push('the intro did not hold on while its sound played');
  // Off: a new launch opens straight to aOS
  await p.click('[data-ti="off"]');
  const p2 = await ctx.newPage(); await p2.goto(BASE + '/aOS/'); await p2.waitForTimeout(400);
  if (await p2.evaluate(() => !!document.getElementById('tronIntro'))) pr.push('the intro played with Off picked');
  // an app in Tron: dark, its trail showing (its #app wrapper clear)
  const p3 = await ctx.newPage(); await p3.route('**/api/**', r => r.fulfill({ status: 401, body: '{}' })); await p3.goto(BASE + '/notes/'); await p3.waitForTimeout(600);
  const n = await p3.evaluate(() => ({ theme: document.documentElement.dataset.theme, app: getComputedStyle(document.getElementById('app')).backgroundColor, intro: !!document.getElementById('tronIntro') }));
  if (n.theme !== 'dark' || !/, 0\)$|transparent/.test(n.app) || n.intro) pr.push('Notes in Tron: ' + JSON.stringify(n));
  // another look: your Light comes back, and your helper
  await p.click('#looks [data-look="vintage"]'); await p.waitForTimeout(300);
  st = await p.evaluate(() => ({ theme: document.documentElement.dataset.theme, who: (document.querySelector('#ipsySlot .ipsy-char') || {}).dataset?.who }));
  if (st.theme !== 'light' || st.who !== 'fox') pr.push('back in Vintage, Light and the fox did not come back: ' + JSON.stringify(st));
  await p.waitForTimeout(100);
  const ph2 = await p.evaluate(() => document.getElementById('hq').placeholder);
  if (!/ask Biscuit$/.test(ph2)) pr.push('back in Vintage, the helper is not Biscuit again: ' + ph2);
  report('Tron, as in the car: dark only, the trail behind everything, the rider, and aOS\'s intro with its sound (once a launch, Skip, Off)', pr); await ctx.close();
}

// 10. a Tron phone's first open from the Home Screen: the intro, and only then the welcome (none of its opening plays unseen
// under the intro), through to aOS with the first open noted; the Light or dark card is left out (Tron is dark only). And
// whatever the sound does, the intro ends: a phone that throws on Web Audio, or one that lets the context start on a later
// tap (then no sound, and no error, after the intro has gone)
{
  const { ctx, p, errs } = await open('dark', { 'aos.look': 'grid', __fresh: 1, __home: 1 }, { watch: true }); const pr = [...errs];
  const first = await p.evaluate(() => ({ intro: !!document.getElementById('tronIntro'), welcome: !!document.getElementById('aos-welcome') }));
  if (!first.intro) pr.push('a fresh Tron phone did not open with the intro');
  if (first.welcome) pr.push('the welcome started under the intro');
  await p.waitForFunction(() => !document.getElementById('tronIntro'), null, { timeout: 6000 }).catch(() => pr.push('the intro did not end by itself'));
  await p.waitForSelector('#aos-welcome.in', { timeout: 3000 }).catch(() => pr.push('the welcome did not follow the intro'));
  await p.waitForSelector('#aos-welcome .c-panel.on', { timeout: 25000 }).catch(() => pr.push('the welcome never reached its cards'));
  const heads = [];
  for (let i = 0; i < 9 && await p.locator('#aos-welcome').count(); i++) {   // Continue through the cards to the end
    heads.push(await p.locator('#aos-welcome h2').textContent().catch(() => ''));
    await p.click('#aos-welcome .c-btns .w-btn', { timeout: 3000 }).catch(() => pr.push('the welcome\'s button could not be tapped on "' + heads[heads.length - 1] + '"'));
    await p.waitForTimeout(700);
  }
  await p.waitForFunction(() => !document.getElementById('aos-welcome'), null, { timeout: 3000 }).catch(() => pr.push('the welcome did not end: ' + heads.join(' > ')));
  if (heads.includes('Light or dark')) pr.push('the welcome offers Light or dark in Tron, which is dark only');
  if (!(await p.evaluate(() => (JSON.parse(localStorage.getItem('aos.seen') || '{}')).aos))) pr.push('the first open was not noted (aos.seen)');
  pr.push(...errs.filter(e => !pr.includes(e)));
  await ctx.close();
  // the sound throwing, or starting late
  for (const [how, patch] of [['throws', 'Object.defineProperty(AudioContext.prototype, "resume", { value() { throw new Error("no audio"); } })'],
    ['starts after the intro', 'Object.defineProperty(AudioContext.prototype, "resume", { value() { return new Promise(r => setTimeout(r, 4500)); } })']]) {
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mobile/15E148 Safari/604.1' });
    await c2.addInitScript(({ patch }) => { try { localStorage.setItem('aos.look', 'grid'); localStorage.setItem('aos.seen', JSON.stringify({ aos: '999' })); localStorage.setItem('aos.signin.asked', '1'); } catch {} new Function(patch)(); }, { patch });
    await c2.route('**/*', r => { const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort(); return u.pathname.startsWith('/aOS/api/') ? r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }) : r.continue(); });
    const p2 = await c2.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(e.message));
    await p2.goto(BASE + '/aOS/'); await p2.waitForTimeout(200);
    if (!(await p2.evaluate(() => !!document.getElementById('tronIntro')))) pr.push('Web Audio ' + how + ': no intro');
    await p2.waitForFunction(() => !document.getElementById('tronIntro'), null, { timeout: 6000 }).catch(() => pr.push('Web Audio ' + how + ': the intro did not end'));
    await p2.waitForTimeout(5000);   // the late start comes now: the intro is gone, so nothing plays and nothing errors
    if (e2.length) pr.push('Web Audio ' + how + ': ' + e2.join('; '));
    await c2.close();
  }
  // an iPhone that froze on the intro: before any tap, opening aOS doesn't start Web Audio, the intro isn't in the top
  // layer, and with the page's clocks stopped (no setTimeout) it still fades away by itself
  {
    const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mobile/15E148 Safari/604.1' });
    await c3.addInitScript(() => { try { localStorage.setItem('aos.look', 'grid'); localStorage.setItem('aos.seen', JSON.stringify({ aos: '999' })); localStorage.setItem('aos.signin.asked', '1'); } catch {}
      window.__ac = 0; const A = window.AudioContext; window.AudioContext = function (...a) { window.__ac++; return new A(...a); }; });
    await c3.route('**/*', r => { const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort(); return u.pathname.startsWith('/aOS/api/') ? r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }) : r.continue(); });
    const p3 = await c3.newPage(); await p3.goto(BASE + '/aOS/'); await p3.waitForTimeout(200);
    const s = await p3.evaluate(() => { const e = document.getElementById('tronIntro'); return { intro: !!e, ac: window.__ac, top: !!(e && e.matches(':popover-open')) }; });
    if (!s.intro) pr.push('frozen clocks: no intro');
    if (s.ac) pr.push('opening aOS started Web Audio before any tap');
    if (s.top) pr.push('the intro went into the top layer as aOS opened');
    await c3.close();
    const c4 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await c4.addInitScript(() => { try { localStorage.setItem('aos.look', 'grid'); localStorage.setItem('aos.seen', JSON.stringify({ aos: '999' })); localStorage.setItem('aos.signin.asked', '1'); } catch {} window.setTimeout = () => 0; });
    await c4.route('**/*', r => { const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort(); return u.pathname.startsWith('/aOS/api/') ? r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }) : r.continue(); });
    const p4 = await c4.newPage(); await p4.goto(BASE + '/aOS/'); await p4.waitForTimeout(8000);
    const gone = await p4.evaluate(() => { const e = document.getElementById('tronIntro'); return !e || getComputedStyle(e).visibility === 'hidden'; });
    if (!gone) pr.push('with the page\'s clocks stopped, the intro stayed over aOS');
    await c4.close();
  }
  report('a Tron phone\'s first open: the intro, then the welcome to its end (no Light or dark); the intro ends whatever Web Audio does', pr);
}

// In Tron, aOS Home's screen trail now and then sends a shot round a section or widget (aOS/tron-shots.js): drawn on its own
// canvas that never takes a tap, one at a time, and gone again a moment later; never in Vintage, nor with motion reduced
{
  const pr = [];
  const shoot = p => p.evaluate(async () => {
    aosTabs.show('home'); await new Promise(r => setTimeout(r, 300));
    const fired = aosTronShots.fire(), again = aosTronShots.fire();
    await new Promise(r => setTimeout(r, 120));
    const cv = document.getElementById('tronshots'); let lit = 0;
    if (cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 3] > 100) lit++; }
    const taps = cv ? getComputedStyle(cv).pointerEvents : null;
    await new Promise(r => setTimeout(r, 2500));
    return { fired, again, lit, taps, still: aosTronShots.running() };
  });
  const tron = await open('dark', { 'aos.look': 'grid', 'aos.tron.intro': 'off' }); pr.push(...tron.errs);
  const t = await shoot(tron.p);
  if (!t.fired) pr.push('no shot in Tron');
  if (t.again) pr.push('a second shot while one was on screen');
  if (!t.lit) pr.push('the shot drew nothing');
  if (t.taps !== 'none') pr.push('the shots\' canvas takes taps: ' + t.taps);
  if (t.still) pr.push('the shot was still on screen after 2.6 seconds');
  await tron.ctx.close();
  const vin = await open('dark', { 'aos.look': 'vintage' }); pr.push(...vin.errs);
  if ((await shoot(vin.p)).fired) pr.push('a shot in Vintage');
  await vin.ctx.close();
  const calm = await open('dark', { 'aos.look': 'grid', 'aos.tron.intro': 'off' }, { still: true }); pr.push(...calm.errs);
  if ((await shoot(calm.p)).fired) pr.push('a shot with motion reduced');
  await calm.ctx.close();
  report('Tron: the screen trail sends one shot at a time round a section or widget on Home, and not in Vintage or with motion reduced', pr);
}

// In Tron, with an app open in aOS, aOS's trail comes over it, so it still runs round the whole screen (the top too,
// round the ‹ aOS bar), and the app draws none of its own; on aOS's own screens it's behind everything, its bottom edge
// at the bottom of the screen
{
  const pr = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark', serviceWorkers: 'block' });
  await ctx.route('**/*', r => { const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort(); if (u.pathname.includes('/api/')) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }); return r.continue(); });
  await ctx.addInitScript(() => { localStorage.setItem('aos.seen', JSON.stringify({ aos: '999', weather: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.session', JSON.stringify({ t: 'x' })); sessionStorage.setItem('aos.later.aos', '1');
    localStorage.setItem('aos.look', 'grid'); localStorage.setItem('aos.tron.intro', 'off'); localStorage.setItem('design.weather', 'grid'); });
  const p = await ctx.newPage(); p.on('pageerror', e => pr.push('script error: ' + e.message));
  await p.goto(BASE + '/aOS/'); await p.waitForSelector('#home [data-open="weather"]');
  const z = () => p.evaluate(() => getComputedStyle(document.documentElement, '::after').zIndex);
  if (await z() !== '-1') pr.push('on aOS\'s screens the trail is not behind everything: z-index ' + await z());
  // its bottom edge along the screen's very bottom, under the tab bars (not the home bar's inset, which ran through them)
  const foot = await p.evaluate(() => getComputedStyle(document.documentElement, '::after').bottom);
  if (foot !== '4px') pr.push('the trail\'s bottom edge is not at the bottom of the screen: ' + foot);
  await p.click('#home [data-open="weather"]');
  // 'complete', not just parsed: the app's welcome.js (deferred) is what hides its own trail inside aOS
  const app = () => p.evaluate(() => { const f = document.querySelector('#stage .frame[data-id="weather"] iframe'), d = f && f.contentDocument;
    return d && d.readyState === 'complete' && d.documentElement.dataset.look === 'grid' ? f.contentWindow.getComputedStyle(d.documentElement, '::after').display : null; });
  await p.waitForFunction(() => { const f = document.querySelector('#stage .frame[data-id="weather"] iframe'), d = f && f.contentDocument; return d && d.readyState === 'complete' && d.documentElement.dataset.look === 'grid'; }, null, { timeout: 10000 }).catch(() => pr.push('Weather did not open in Tron inside aOS'));
  if (await z() !== '42') pr.push('with an app open, aOS\'s trail is not over it: z-index ' + await z());
  const own = await app();
  if (own !== 'none') pr.push('the app draws its own trail inside aOS too: ' + own);
  report('Tron: with an app open, aOS\'s trail runs round the whole screen over it, and the app draws none of its own', pr); await ctx.close();
}

// 11. Vintage's intro, Sunrise (aOS/vintage-intro.js): aOS opens with the sky coming up and "aOS" with a greeting by the
// clock (morning, afternoon from noon, evening after sunset), then the sun goes up into the disc at the top of aOS; once a
// launch; Sound, Silent or Off and Play in Account (in Vintage only); and none for a browser test that didn't ask for it
{
  const pr = [];
  const launch = async (seed, o = {}) => {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: o.scheme || 'light', reducedMotion: o.still ? 'reduce' : 'no-preference' });
    await c.addInitScript(s => { try { localStorage.setItem('aos.seen', JSON.stringify({ aos: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.session', JSON.stringify({ t: 'x' })); sessionStorage.setItem('aos.later.aos', '1');
      for (const k in s) if (!localStorage.getItem('seeded.' + k)) { localStorage.setItem(k, s[k]); localStorage.setItem('seeded.' + k, '1'); } } catch {}   // once a context: a new tab keeps what was picked
      window.__vi = {}; new MutationObserver(() => { const e = document.getElementById('vintageIntro'); if (!e) return; const v = window.__vi; v.shown = true;
        v.name = (e.querySelector('.vi-name') || {}).textContent; v.hi = (e.querySelector('.vi-hi') || {}).textContent; if (e.classList.contains('home')) v.home = getComputedStyle(e.querySelector('.vi-sun')).transform; if (e.classList.contains('lost')) v.lost = true; })
        .observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); }, seed);
    await c.route('**/*', r => { const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort(); return u.pathname.startsWith('/aOS/api/') ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"storage":true,"setup":true,"user":{"id":"u1","name":"Sarah","role":"member","apps":{}}}' }) : r.continue(); });
    const p = await c.newPage(); p.on('pageerror', e => pr.push('script error: ' + e.message)); await p.goto(BASE + '/aOS/');
    return { c, p };
  };
  // a browser test that didn't pick it: no intro (Vintage is the look aOS opens in, so it would cover every other test)
  { const { c, p } = await launch({ 'aos.sky': 'day' }); await p.waitForTimeout(400);
    if ((await p.evaluate(() => window.__vi)).shown) pr.push('the intro played for a browser test that did not ask for it'); await c.close(); }
  // Sound picked, by day: the intro, its greeting, and the sun going up into aOS's disc as it ends
  const { c, p } = await launch({ 'aos.sky': 'day', 'aos.vintage.intro': 'sound' });
  await p.waitForTimeout(200);
  let v = await p.evaluate(() => ({ ...window.__vi, want: aosVintageIntro.greeting() }));
  if (!v.shown || v.name !== 'aOS' || v.hi !== v.want) pr.push('aOS did not open with the Sunrise intro: ' + JSON.stringify(v));
  await p.waitForFunction(() => !document.getElementById('vintageIntro'), null, { timeout: 6000 }).catch(() => pr.push('the intro did not end by itself'));
  v = await p.evaluate(() => window.__vi);
  if (!v.home || v.home === 'none' || v.lost) pr.push('the sun did not go up into aOS\'s disc: ' + JSON.stringify(v));
  // the greeting, by the clock and the sky
  const g = await p.evaluate(() => { const r = document.documentElement, at = h => aosVintageIntro.greeting(new Date(2026, 9, 27, h, 30)), out = { day: [at(7), at(12), at(18)] };
    r.setAttribute('data-sky', 'night'); out.night = [at(5), at(12), at(21)]; r.setAttribute('data-sky', 'day'); return out; });
  if (g.day.join() !== 'Good morning,Good afternoon,Good afternoon' || g.night.join() !== 'Good morning,Good evening,Good evening') pr.push('the greeting: ' + JSON.stringify(g));
  // once a launch
  await p.reload(); await p.waitForTimeout(300);
  if ((await p.evaluate(() => window.__vi)).shown) pr.push('the intro played again on a reload');
  // Account, in Vintage: Sound picked, Play plays it (with its sound), Skip ends it, Off stops it on the next launch
  await p.evaluate(() => aosTabs.show('today')); await p.waitForSelector('#stories .story');
  await openLook(p);
  if (!(await p.isVisible('#vintageIntroPick [data-vi="sound"][aria-pressed="true"]'))) pr.push('Account has no Sunrise intro setting, Sound picked');
  if (await p.isVisible('#tronIntroPick')) pr.push('Account shows the Tron intro setting in Vintage');
  await p.click('[data-viplay]');
  await p.waitForSelector('#vintageIntro[data-sound="playing"]', { timeout: 3000 }).catch(() => pr.push('played from Account, the intro\'s sound did not play'));
  await p.click('#vintageIntro:not(.out) .vi-skip', { timeout: 3000 }).catch(() => pr.push('no Skip on the intro'));
  await p.waitForFunction(() => !document.getElementById('vintageIntro'), null, { timeout: 2000 }).catch(() => pr.push('Skip did not end the intro'));
  await p.click('[data-vi="off"]');
  if (await p.evaluate(() => localStorage.getItem('aos.vintage.intro')) !== 'off') pr.push('Off was not kept');
  const p2 = await c.newPage(); await p2.goto(BASE + '/aOS/'); await p2.waitForTimeout(400);
  if (await p2.evaluate(() => !!document.getElementById('vintageIntro'))) pr.push('the intro played with Off picked');
  await c.close();
  // at night, in Dark: the moon (the sky's disc colour) and stars, no rays
  { const { c, p } = await launch({ 'aos.sky': 'night', 'aos.vintage.intro': 'silent' }, { scheme: 'dark' }); await p.waitForTimeout(1500);
    const n = await p.evaluate(() => { const e = document.getElementById('vintageIntro'); if (!e) return null; const cs = s => getComputedStyle(e.querySelector(s));
      return { moon: cs('.vi-sun').backgroundColor, rays: cs('.vi-rays').display, stars: cs('.vi-stars').display, sound: e.dataset.sound || '' }; });
    if (!n || n.moon !== 'rgb(233, 221, 196)' || n.rays !== 'none' || n.stars !== 'block') pr.push('the night intro in Dark: ' + JSON.stringify(n));
    if (n && n.sound) pr.push('Silent played its sound');
    await c.close(); }
  // Sea glass or Tron: not this intro
  { const { c, p } = await launch({ 'aos.look': 'glass', 'aos.vintage.intro': 'sound' }); await p.waitForTimeout(400);
    if ((await p.evaluate(() => window.__vi)).shown) pr.push('the Sunrise intro played in Sea glass'); await c.close(); }
  // Reduce Motion: a short fade, and still gone in time
  { const { c, p } = await launch({ 'aos.sky': 'day', 'aos.vintage.intro': 'silent' }, { still: true }); await p.waitForTimeout(200);
    if (!(await p.evaluate(() => window.__vi)).shown) pr.push('no intro with Reduce Motion');
    await p.waitForFunction(() => !document.getElementById('vintageIntro'), null, { timeout: 4000 }).catch(() => pr.push('with Reduce Motion, the intro did not end within 4 seconds'));
    await c.close(); }
  report('Vintage\'s Sunrise intro: the sky, "aOS" and a greeting by the clock, the sun into aOS\'s disc; once a launch, Account\'s Sound, Silent, Off and Play', pr);
}

// 12. Sea glass's intro, Tide (aOS/glass-intro.js): aOS opens with the waves coming in and "aOS" with a greeting by the
// clock, then "aOS" glides up onto the small "aOS" at the top of the page; once a launch; Sound, Silent or Off and Play in
// Account (in Sea glass only); and none for a browser test that didn't ask for it, or in another look
{
  const pr = [];
  const launch = async (seed, o = {}) => {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: o.scheme || 'light', reducedMotion: o.still ? 'reduce' : 'no-preference' });
    await c.addInitScript(s => { try { localStorage.setItem('aos.seen', JSON.stringify({ aos: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.session', JSON.stringify({ t: 'x' })); sessionStorage.setItem('aos.later.aos', '1');
      for (const k in s) if (!localStorage.getItem('seeded.' + k)) { localStorage.setItem(k, s[k]); localStorage.setItem('seeded.' + k, '1'); } } catch {}
      window.__gi = {}; new MutationObserver(() => { const e = document.getElementById('glassIntro'); if (!e) return; const v = window.__gi; v.shown = true;
        v.name = (e.querySelector('.gi-name') || {}).textContent; v.hi = (e.querySelector('.gi-hi') || {}).textContent; if (e.classList.contains('lost')) v.lost = true;
        if (e.classList.contains('home') && !v.home) setTimeout(() => { const n = e.querySelector('.gi-name').getBoundingClientRect(), m = document.querySelector('.tab:not([hidden]) .head .mark'), r = document.createRange(); r.selectNodeContents(m); const d = r.getBoundingClientRect();
          v.home = { dx: Math.round(n.left - d.left), dy: Math.round((n.top + n.height / 2) - (d.top + d.height / 2)), w: Math.round(n.width - d.width) }; }, 700); })
        .observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); }, seed);
    await c.route('**/*', r => { const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort(); return u.pathname.startsWith('/aOS/api/') ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"storage":true,"setup":true,"user":{"id":"u1","name":"Sarah","role":"member","apps":{}}}' }) : r.continue(); });
    const p = await c.newPage(); p.on('pageerror', e => pr.push('script error: ' + e.message)); await p.goto(BASE + '/aOS/');
    return { c, p };
  };
  // a browser test in Sea glass that didn't pick it: no intro (many open aOS in Sea glass)
  { const { c, p } = await launch({ 'aos.look': 'glass' }); await p.waitForTimeout(400);
    if ((await p.evaluate(() => window.__gi)).shown) pr.push('the intro played for a browser test that did not ask for it'); await c.close(); }
  // Sound picked: the intro, its greeting, and "aOS" onto the page's own as it ends
  const { c, p } = await launch({ 'aos.look': 'glass', 'aos.glass.intro': 'sound' });
  await p.waitForTimeout(200);
  let v = await p.evaluate(() => ({ ...window.__gi, want: aosGlassIntro.greeting() }));
  if (!v.shown || v.name !== 'aOS' || v.hi !== v.want) pr.push('aOS did not open with the Tide intro: ' + JSON.stringify(v));
  await p.waitForFunction(() => !document.getElementById('glassIntro'), null, { timeout: 6000 }).catch(() => pr.push('the intro did not end by itself'));
  v = await p.evaluate(() => window.__gi);
  if (!v.home || v.lost || Math.abs(v.home.dx) > 2 || Math.abs(v.home.dy) > 2 || Math.abs(v.home.w) > 2) pr.push('"aOS" did not land on the page\'s own: ' + JSON.stringify(v));
  const g = await p.evaluate(() => [7, 12, 17, 18, 23].map(h => aosGlassIntro.greeting(new Date(2026, 9, 27, h, 30))));
  if (g.join() !== 'Good morning,Good afternoon,Good afternoon,Good evening,Good evening') pr.push('the greeting: ' + g);
  // once a launch
  await p.reload(); await p.waitForTimeout(300);
  if ((await p.evaluate(() => window.__gi)).shown) pr.push('the intro played again on a reload');
  // Account, in Sea glass: Sound picked, Play plays it (with its sound), Skip ends it, Off stops it on the next launch
  await p.evaluate(() => aosTabs.show('today')); await p.waitForSelector('#stories .story');
  await openLook(p);
  if (!(await p.isVisible('#glassIntroPick [data-gi="sound"][aria-pressed="true"]'))) pr.push('Account has no Tide intro setting, Sound picked');
  if (await p.isVisible('#vintageIntroPick') || await p.isVisible('#tronIntroPick')) pr.push('Account shows another look\'s intro setting in Sea glass');
  await p.click('[data-giplay]');
  await p.waitForSelector('#glassIntro[data-sound="playing"]', { timeout: 3000 }).catch(() => pr.push('played from Account, the intro\'s sound did not play'));
  await p.click('#glassIntro:not(.out) .gi-skip', { timeout: 3000 }).catch(() => pr.push('no Skip on the intro'));
  await p.waitForFunction(() => !document.getElementById('glassIntro'), null, { timeout: 2000 }).catch(() => pr.push('Skip did not end the intro'));
  await p.click('[data-gi="off"]');
  if (await p.evaluate(() => localStorage.getItem('aos.glass.intro')) !== 'off') pr.push('Off was not kept');
  const p2 = await c.newPage(); await p2.goto(BASE + '/aOS/'); await p2.waitForTimeout(400);
  if (await p2.evaluate(() => !!document.getElementById('glassIntro'))) pr.push('the intro played with Off picked');
  await c.close();
  // in Dark, Silent: the dark water, and no sound
  { const { c, p } = await launch({ 'aos.look': 'glass', 'aos.glass.intro': 'silent' }, { scheme: 'dark' }); await p.waitForTimeout(1500);
    const n = await p.evaluate(() => { const e = document.getElementById('glassIntro'); return e && { wave: getComputedStyle(e.querySelector('.gi-wave svg')).fill, sound: e.dataset.sound || '' }; });
    if (!n || !/^rgba\(78, 95, 134/.test(n.wave)) pr.push('the intro in Dark: ' + JSON.stringify(n));
    if (n && n.sound) pr.push('Silent played its sound');
    await c.close(); }
  // Vintage: not this intro
  { const { c, p } = await launch({ 'aos.look': 'vintage', 'aos.glass.intro': 'sound' }); await p.waitForTimeout(400);
    if ((await p.evaluate(() => window.__gi)).shown) pr.push('the Tide intro played in Vintage'); await c.close(); }
  // Reduce Motion: a short fade, and still gone in time
  { const { c, p } = await launch({ 'aos.look': 'glass', 'aos.glass.intro': 'silent' }, { still: true }); await p.waitForTimeout(200);
    if (!(await p.evaluate(() => window.__gi)).shown) pr.push('no intro with Reduce Motion');
    await p.waitForFunction(() => !document.getElementById('glassIntro'), null, { timeout: 4000 }).catch(() => pr.push('with Reduce Motion, the intro did not end within 4 seconds'));
    await c.close(); }
  report('Sea glass\'s Tide intro: the waves, "aOS" and a greeting by the clock, "aOS" onto the page\'s own; once a launch, Account\'s Sound, Silent, Off and Play', pr);
}

// 13. Layers' intro, Skylight (aOS/layers-intro.js): aOS opens with the time of day's sky, a swarm of dots building a
// house and "aOS" with a greeting by the clock, then "aOS" glides up onto the small "aOS" at the top of the page; once a launch;
// Sound, Silent or Off and Play in Account (in Layers only); and none for a browser test that didn't ask for it, or in another look
{
  const pr = [];
  const launch = async (seed, o = {}) => {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: o.scheme || 'light', reducedMotion: o.still ? 'reduce' : 'no-preference' });
    await c.addInitScript(s => { try { localStorage.setItem('aos.seen', JSON.stringify({ aos: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.session', JSON.stringify({ t: 'x' })); sessionStorage.setItem('aos.later.aos', '1');
      for (const k in s) if (!localStorage.getItem('seeded.' + k)) { localStorage.setItem(k, s[k]); localStorage.setItem('seeded.' + k, '1'); } } catch {}
      window.__li = {}; new MutationObserver(() => { const e = document.getElementById('layersIntro'); if (!e) return; const v = window.__li; v.shown = true;
        v.name = (e.querySelector('.li-name') || {}).textContent; v.hi = (e.querySelector('.li-hi') || {}).textContent; if (e.classList.contains('lost')) v.lost = true;
        if (e.classList.contains('home') && !v.home) setTimeout(() => { const n = e.querySelector('.li-name').getBoundingClientRect(), m = document.querySelector('.tab:not([hidden]) .head .mark'), r = document.createRange(); r.selectNodeContents(m); const d = r.getBoundingClientRect();
          v.home = { dx: Math.round(n.left - d.left), dy: Math.round((n.top + n.height / 2) - (d.top + d.height / 2)), w: Math.round(n.width - d.width) }; }, 700); })
        .observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); }, seed);
    await c.route('**/*', r => { const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort(); return u.pathname.startsWith('/aOS/api/') ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"storage":true,"setup":true,"user":{"id":"u1","name":"Sarah","role":"member","apps":{}}}' }) : r.continue(); });
    const p = await c.newPage(); p.on('pageerror', e => pr.push('script error: ' + e.message)); await p.goto(BASE + '/aOS/');
    return { c, p };
  };
  // a browser test in Layers that didn't pick it: no intro (many open aOS in Layers)
  { const { c, p } = await launch({ 'aos.look': 'layers' }); await p.waitForTimeout(400);
    if ((await p.evaluate(() => window.__li)).shown) pr.push('the intro played for a browser test that did not ask for it'); await c.close(); }
  // Sound picked: the intro, its greeting, and "aOS" onto the page's own as it ends
  const { c, p } = await launch({ 'aos.look': 'layers', 'aos.layers.intro': 'sound' });
  await p.waitForTimeout(200);
  let v = await p.evaluate(() => ({ ...window.__li, want: aosLayersIntro.greeting() }));
  if (!v.shown || v.name !== 'aOS' || v.hi !== v.want) pr.push('aOS did not open with the Skylight intro: ' + JSON.stringify(v));
  await p.waitForFunction(() => !document.getElementById('layersIntro'), null, { timeout: 6000 }).catch(() => pr.push('the intro did not end by itself'));
  v = await p.evaluate(() => window.__li);
  if (!v.home || v.lost || Math.abs(v.home.dx) > 2 || Math.abs(v.home.dy) > 2 || Math.abs(v.home.w) > 2) pr.push('"aOS" did not land on the page\'s own: ' + JSON.stringify(v));
  const g = await p.evaluate(() => [7, 12, 17, 18, 23].map(h => aosLayersIntro.greeting(new Date(2026, 9, 27, h, 30))));
  if (g.join() !== 'Good morning,Good afternoon,Good afternoon,Good evening,Good evening') pr.push('the greeting: ' + g);
  // once a launch
  await p.reload(); await p.waitForTimeout(300);
  if ((await p.evaluate(() => window.__li)).shown) pr.push('the intro played again on a reload');
  // Account, in Layers: Sound picked, Play plays it (with its sound), Skip ends it, Off stops it on the next launch
  await p.evaluate(() => aosTabs.show('today')); await p.waitForSelector('#stories .story');
  await openLook(p);
  if (!(await p.isVisible('#layersIntroPick [data-li="sound"][aria-pressed="true"]'))) pr.push('Account has no Skylight intro setting, Sound picked');
  if (await p.isVisible('#vintageIntroPick') || await p.isVisible('#tronIntroPick') || await p.isVisible('#glassIntroPick')) pr.push('Account shows another look\'s intro setting in Layers');
  await p.click('[data-liplay]');
  await p.waitForSelector('#layersIntro[data-sound="playing"]', { timeout: 3000 }).catch(() => pr.push('played from Account, the intro\'s sound did not play'));
  await p.click('#layersIntro:not(.out) .li-skip', { timeout: 3000 }).catch(() => pr.push('no Skip on the intro'));
  await p.waitForFunction(() => !document.getElementById('layersIntro'), null, { timeout: 2000 }).catch(() => pr.push('Skip did not end the intro'));
  await p.click('[data-li="off"]');
  if (await p.evaluate(() => localStorage.getItem('aos.layers.intro')) !== 'off') pr.push('Off was not kept');
  const p2 = await c.newPage(); await p2.goto(BASE + '/aOS/'); await p2.waitForTimeout(400);
  if (await p2.evaluate(() => !!document.getElementById('layersIntro'))) pr.push('the intro played with Off picked');
  await c.close();
  // the swarm: hundreds of dots in the apps' colours, which by 2.8 seconds have built the house (its ground across the
  // lower part of the screen, the roof's peak above the walls) with the family inside; in Dark, light dots and people
  // on the dark sky; Silent, no sound
  const swarm = p => p.evaluate(() => {
    const e = document.getElementById('layersIntro'), cv = e && e.querySelector('.li-swarm'); if (!cv) return null;
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0, light = 0, top = cv.height, bottom = 0;
    for (let i = 3; i < d.length; i += 4 * 3) if (d[i] > 200) { n++; if ((d[i - 3] + d[i - 2] + d[i - 1]) / 3 > 150) light++; const y = Math.floor((i >> 2) / cv.width); top = Math.min(top, y); bottom = Math.max(bottom, y); }
    return { n, light: n ? light / n : 0, top: top / cv.height, bottom: bottom / cv.height, sound: e.dataset.sound || '' };
  });
  for (const scheme of ['light', 'dark']) {
    const { c, p } = await launch({ 'aos.look': 'layers', 'aos.layers.intro': 'silent' }, { scheme }); await p.waitForTimeout(2800);
    const n = await swarm(p);
    if (!n || n.n < 2000) pr.push(`${scheme}: the house of dots is not drawn: ` + JSON.stringify(n));
    else {
      if (n.top < 0.3 || n.top > 0.5 || n.bottom < 0.7 || n.bottom > 0.85) pr.push(`${scheme}: the house is not where it should be (its peak to its ground, as parts of the screen): ` + JSON.stringify(n));
      if (scheme === 'dark' ? n.light < 0.6 : n.light > 0.4) pr.push(`${scheme}: the dots and the family are not in the ${scheme} colours: ` + JSON.stringify(n));
      if (n.sound) pr.push('Silent played its sound');
    }
    await c.close();
  }
  // Sea glass: not this intro
  { const { c, p } = await launch({ 'aos.look': 'glass', 'aos.layers.intro': 'sound' }); await p.waitForTimeout(400);
    if ((await p.evaluate(() => window.__li)).shown) pr.push('the Skylight intro played in Sea glass'); await c.close(); }
  // Reduce Motion: a short fade, and still gone in time
  { const { c, p } = await launch({ 'aos.look': 'layers', 'aos.layers.intro': 'silent' }, { still: true }); await p.waitForTimeout(200);
    if (!(await p.evaluate(() => window.__li)).shown) pr.push('no intro with Reduce Motion');
    await p.waitForFunction(() => !document.getElementById('layersIntro'), null, { timeout: 4000 }).catch(() => pr.push('with Reduce Motion, the intro did not end within 4 seconds'));
    await c.close(); }
  report('Layers\' Skylight intro: the sky, the house of dots, "aOS" and a greeting by the clock, "aOS" onto the page\'s own; once a launch, Account\'s Sound, Silent, Off and Play', pr);
}


await b.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed'); process.exit(failed ? 1 : 0);
