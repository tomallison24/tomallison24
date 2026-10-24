// Designs in the aOS store, as a person uses them at iPhone size. Every app carries both its
// designs itself, Vintage (the default) and Standard (Sea glass), picked in its own Settings
// (home/design.js), so aOS shows one row per app with no Design menu and no "2 designs" tag;
// Get always adds the app itself; each app's icon follows aOS's own look (icon-512.png in
// Vintage, icon-glass-512.png in Sea glass); and searching "vintage" finds every app. The
// old Vintage apps (mailvintage and the rest) are not offered. An app's own Settings > Design
// is checked by its own test (meals/scripts/app-test.mjs and the rest).
// The accounts server is stood in for (the server rules are accounts-api-test.mjs).
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node aOS/scripts/designs-test.mjs [repo root]
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

// a phone on the store; `apps` are the Home Screen apps the account says are installed
async function open(apps = {}, scheme = 'light', look = 'glass') {   // the Sea glass look unless asked: Standard is then the design that comes first
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const user = { id: 'u1', name: 'Sarah', role: 'member', apps };
  await ctx.addInitScript(look => { try { localStorage.setItem('aos.look', look); localStorage.setItem('aos.seen', JSON.stringify({ aos: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.session', JSON.stringify({ t: 'x' })); sessionStorage.setItem('aos.later.aos', '1'); } catch {} }, look);
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort();
    if (!u.pathname.startsWith('/aOS/api/')) return r.continue();
    const route = u.pathname.slice('/aOS/api/'.length), J = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (route === 'state') return J({ storage: true, setup: true, user, plan: null });
    if (route === 'members') return J({ members: [user] });
    return J({});
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/aOS/'); await p.waitForSelector('[data-tab="search"]'); await p.click('[data-tab="search"]'); await p.waitForSelector('#found .row');   // aOS2: Search lists every app (Apps is Home now)
  return { ctx, p, errs };
}
const text = (p, sel) => p.locator(sel).first().innerText().catch(() => '');
const attr = (p, sel, a) => p.locator(sel).first().getAttribute(a).catch(() => null);

const APPS = ['mail', 'calendar', 'clock', 'news', 'weather', 'notes', 'podcasts', 'travel', 'places', 'fitness', 'drinks', 'meals', 'orders', 'house', 'sparkle'];
const OLD = APPS.filter(a => a !== 'clock').map(a => a + 'vintage');

// 1. one row per app, no old Vintage rows, no Design tag; searching "vintage" finds every app
{
  const { ctx, p, errs } = await open(); const pr = [...errs];
  for (const id of OLD) if (await p.locator(`#list .row[data-app="${id}"]`).count()) pr.push(`${id} has a row of its own`);
  for (const id of APPS) if (await p.locator(`#list .row[data-app="${id}"]`).count() !== 1) pr.push(`${id} has no row`);
  if (await p.locator('#list .row .dtag').count()) pr.push('a row still has a designs tag: ' + await text(p, '#list .row .dtag'));
  await p.evaluate(() => aosTabs.show('search')); await p.fill('#q', 'vintage');
  const found = await p.locator('#found .row').evaluateAll(rs => rs.map(r => r.dataset.app));
  if ([...found].sort().join() !== [...APPS].sort().join()) pr.push('searching "vintage" found ' + found.join() + ', not every app');
  report('One row per app, no Vintage rows or Design tags; searching "vintage" finds every app', pr); await ctx.close();
}

// 2. an app's page: no Design menu, Get adds the app itself, in both looks
for (const look of ['vintage', 'glass']) {
  const { ctx, p, errs } = await open({}, 'light', look); const pr = [...errs];
  const gets = await p.locator('#list .row [data-get]').evaluateAll(bs => bs.map(b => b.dataset.get + '=' + new URL(b.href).pathname));
  for (const id of APPS) if (!gets.includes(id + '=/' + id + '/')) pr.push(id + ' does not link to /' + id + '/: ' + gets.filter(x => x.startsWith(id)).join(' '));
  const story = await p.locator('#stories [data-get]').evaluateAll(bs => bs.map(b => b.dataset.get));
  if (story.some(id => /vintage$/.test(id))) pr.push('a Today story links to an old Vintage app: ' + story.join());
  await p.click('#found .row[data-app="weather"]'); await p.waitForSelector('.apphead [data-get]');
  if (await p.locator('.dbtn').count()) pr.push('the app page still has a Design menu');
  if (await attr(p, '.apphead [data-get]', 'data-get') !== 'weather') pr.push('Get on Weather adds ' + await attr(p, '.apphead [data-get]', 'data-get'));
  await p.click('.apphead [data-get]'); await p.waitForTimeout(500);
  if (await p.locator('.dsheet').count()) pr.push('Get asked for a design');
  report(look + ' look: Get adds the app itself, with no Design menu or question', pr); await ctx.close();
}

// 3. the icons follow aOS's look: the Vintage icon in Vintage, the Sea glass one in Sea glass, and switching swaps them
{
  const { ctx, p, errs } = await open({}, 'light', 'vintage'); const pr = [...errs];
  const icons = () => p.locator('#list .row').evaluateAll(rs => Object.fromEntries(rs.map(r => [r.dataset.app, new URL(r.querySelector('img').src).pathname])));
  let ic = await icons();
  for (const id of APPS) if (ic[id] !== `/${id}/icon-512.png`) pr.push(`Vintage: ${id} shows ${ic[id]}`);
  await p.evaluate(() => aosLook.set('glass')); await p.waitForTimeout(500);
  ic = await icons();
  for (const id of APPS) if (ic[id] !== `/${id}/icon-glass-512.png`) pr.push(`Sea glass: ${id} shows ${ic[id]}`);
  const missing = [];
  for (const id of APPS) for (const f of ['icon-512.png', 'icon-glass-512.png']) if (!fs.existsSync(path.join(ROOT, id, f))) missing.push(id + '/' + f);
  if (missing.length) pr.push('missing: ' + missing.join(' '));
  report('each app\'s icon follows aOS\'s look (Vintage or Sea glass)', pr); await ctx.close();
}

// 4. Installed: an app on the Home Screen says Installed in either look
{
  const { ctx, p, errs } = await open({ weather: Date.now() }, 'light', 'vintage'); const pr = [...errs];
  await p.waitForFunction(() => /Installed/.test(document.querySelector('#list .row[data-app="weather"] [data-get]').textContent), null, { timeout: 5000 }).catch(() => pr.push('Weather\'s row does not say Installed'));
  report('an installed app says Installed', pr); await ctx.close();
}

await b.close(); server.close();
process.exit(failed ? 1 : 0);
