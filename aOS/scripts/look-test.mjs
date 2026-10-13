// aOS's Look picker, as a person uses it at iPhone size: aOS opens in Vintage; under the account
// (Appearance > Look) Sea glass puts the original look back at once, and it is kept - a reload
// opens in Sea glass with the right look from the first paint; Vintage brings the new one back.
// Before aOS is added to the Home Screen (iPhone, in Safari) its install steps start with the look:
// the pick sets the icon, the status bar and the address that are added, and the installed app
// (empty storage of its own) opens in the look the address or the cookie carries.
// The accounts server is stood in for (the server rules are accounts-api-test.mjs).
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node aOS/scripts/look-test.mjs [repo root]
import { createRequire } from 'module'; import { execSync } from 'child_process'; import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/'); const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, r)); const BASE = 'http://localhost:' + server.address().port;
const b = await chromium.launch();
let failed = 0;
const report = (name, problems) => { if (problems.length) { failed++; console.log('not ok - ' + name + '\n  ' + problems.join('\n  ')); } else console.log('ok - ' + name); };

async function open(scheme = 'light', seed = {}, o = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mobile/15E148 Safari/604.1' });
  const user = { id: 'u1', name: 'Sarah', role: 'member', apps: {} };
  await ctx.addInitScript(s => { try { localStorage.setItem('aos.seen', JSON.stringify({ aos: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.session', JSON.stringify({ t: 'x' })); if (!s.__install) sessionStorage.setItem('aos.later.aos', '1');
    for (const k in s) if (!sessionStorage.getItem('seeded.' + k)) { localStorage.setItem(k, s[k]); sessionStorage.setItem('seeded.' + k, '1'); } } catch {} }, seed);
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort();
    if (!u.pathname.startsWith('/aOS/api/')) return r.continue();
    const route = u.pathname.slice('/aOS/api/'.length), J = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (route === 'state') return J({ storage: true, setup: true, user, plan: null });
    if (route === 'members') return J({ members: [user] });
    return J({});
  });
  if (o.cookie) await ctx.addCookies([{ name: 'aos_look', value: o.cookie, url: BASE + '/aOS/' }]);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/aOS/' + (o.query || '')); await p.waitForSelector('#stories .story');
  return { ctx, p, errs };
}
const css = (p, sel, prop) => p.locator(sel).first().evaluate((e, k) => getComputedStyle(e)[k], prop);
const tint = p => p.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content).join());
const WALNUT = 'rgb(74, 52, 38)';
const openLook = async p => { await p.click('#today [data-acct]'); await p.waitForSelector('#looks .dopt'); };
const selected = p => p.locator('#looks .dopt[aria-selected="true"]').evaluateAll(es => es.map(e => e.dataset.look).join());

// 1. aOS opens in Vintage, and the Look picker offers both, Vintage picked
{
  const { ctx, p, errs } = await open(); const pr = [...errs];
  if (await p.evaluate(() => document.documentElement.dataset.look) !== 'vintage') pr.push('not Vintage to begin with');
  if (await css(p, '.tabs', 'backgroundColor') !== WALNUT) pr.push('the tab pill is not walnut: ' + await css(p, '.tabs', 'backgroundColor'));
  if (!/#F4ECDD/i.test(await tint(p))) pr.push('the status bar tint is not cream: ' + await tint(p));
  await openLook(p);
  const names = await p.locator('#looks .dopt b').allInnerTexts();
  if (names.join() !== 'Vintage,Sea glass') pr.push('the picker offers ' + names.join());
  if (await selected(p) !== 'vintage') pr.push('Vintage is not the one picked: ' + await selected(p));
  report('aOS opens in Vintage; Appearance > Look offers Vintage and Sea glass, Vintage picked', pr); await ctx.close();
}

// 2. Sea glass at once, kept over a reload, with no flash of Vintage; Vintage again
{
  const { ctx, p, errs } = await open(); const pr = [...errs];
  await openLook(p); await p.click('#looks [data-look="glass"]');
  if (await p.evaluate(() => document.documentElement.dataset.look) !== 'glass') pr.push('Sea glass did not apply');
  if (await selected(p) !== 'glass') pr.push('the picker does not show Sea glass picked');
  if (await css(p, '.tabs', 'backgroundColor') === WALNUT) pr.push('the tab pill is still walnut in Sea glass');
  if (!/#EEF2F0/i.test(await tint(p))) pr.push('the status bar tint is not mist in Sea glass: ' + await tint(p));
  if (await p.evaluate(() => localStorage.getItem('aos.look')) !== 'glass') pr.push('the choice is not kept');
  // a reload: the look is in place before the page runs (look.js is in the head), and the family icon is the glass one
  await p.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { window.__look = document.documentElement.dataset.look + '/' + document.getElementById('vintage').media; }));
  await p.reload(); await p.waitForSelector('#stories .story');
  const early = await p.evaluate(() => window.__look);
  if (early !== 'glass/not all') pr.push('on a reload the look at DOMContentLoaded was ' + early);
  if (await css(p, '.tabs', 'backgroundColor') === WALNUT) pr.push('after a reload the tab pill is walnut');
  if (!await p.locator('#famhero #fam-g').count()) pr.push('the family icon is not the glass one');
  await openLook(p); await p.click('#looks [data-look="vintage"]');
  if (await css(p, '.tabs', 'backgroundColor') !== WALNUT) pr.push('Vintage did not come back');
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
  const o = await open('dark', { 'aos.look': 'neon' });
  if (await o.p.evaluate(() => document.documentElement.dataset.look) !== 'vintage') pr.push('an unknown look did not fall back to Vintage');
  if (!/#241E1A/i.test(await tint(o.p))) pr.push('the dark Vintage tint is not walnut: ' + await tint(o.p));
  await o.ctx.close();
  report('Sea glass in dark mode; an unknown stored look falls back to Vintage', pr);
}

// 4. the install steps: Choose your look first; Sea glass changes the icon, the status bar and the address; then how to add it
{
  const { ctx, p, errs } = await open('light', { __install: '1' }); const pr = [...errs];
  await p.waitForSelector('#aos-welcome .c-look', { timeout: 15000 });
  const h2 = async () => (await p.locator('#aos-welcome h2').first().innerText().catch(() => '')).trim();
  if (await h2() !== 'Choose your look') pr.push('the first step was ' + await h2());
  const names = await p.locator('#aos-welcome .c-look b').allInnerTexts();
  if (names.join() !== 'Vintage,Sea glass') pr.push('the install step offers ' + names.join());
  const touch = () => p.evaluate(() => document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href'));
  const bar = () => p.evaluate(() => document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content);
  if (await touch() !== 'icon-180.png?v=3' || await bar() !== 'default') pr.push('Vintage: icon ' + await touch() + ', status bar ' + await bar());
  await p.click('#aos-welcome .c-look[data-look="glass"]');
  if (await touch() !== 'icon-glass-180.png?v=1') pr.push('Sea glass: the Home Screen icon is ' + await touch());
  if (await bar() !== 'black-translucent') pr.push('Sea glass: the status bar style is ' + await bar());
  if (!/[?&]look=glass/.test(await p.evaluate(() => location.search))) pr.push('the address does not carry look=glass: ' + await p.evaluate(() => location.search));
  if (await p.evaluate(() => document.cookie) !== 'aos_look=glass') pr.push('the cookie is ' + await p.evaluate(() => document.cookie));
  await p.click('#aos-welcome .c-btns .w-btn'); await p.waitForTimeout(900);
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
  const j = await open('light', {}, { query: '?look=neon' });
  if (await j.p.evaluate(() => document.documentElement.dataset.look) !== 'vintage') pr.push('an unknown ?look= did not fall back to Vintage');
  await j.ctx.close();
  report('the installed app takes the look from the address or the cookie on its first launch; a look already chosen wins', pr);
}

await b.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed'); process.exit(failed ? 1 : 0);
