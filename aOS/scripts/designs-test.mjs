// Designs in the aOS store, as a person uses them at iPhone size: an app that comes in
// more than one design (home/welcome.js DESIGNS: Mail, Orders and Home) is one row with a
// "2 designs" tag, not a row per design; its page has a Design menu; the design picked
// decides which app Get adds and which one says Installed; Get on a design that isn't
// added yet asks which design first. Apps with one design are left alone.
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
async function open(apps = {}, scheme = 'light') {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const user = { id: 'u1', name: 'Sarah', role: 'member', apps };
  await ctx.addInitScript(() => { try { localStorage.setItem('aos.seen', JSON.stringify({ aos: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.session', JSON.stringify({ t: 'x' })); sessionStorage.setItem('aos.later.aos', '1'); } catch {} });
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort();
    if (!u.pathname.startsWith('/aOS/api/')) return r.continue();
    const route = u.pathname.slice('/aOS/api/'.length), J = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (route === 'state') return J({ storage: true, setup: true, user, plan: null });
    if (route === 'members') return J({ members: [user] });
    return J({});
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/aOS/'); await p.waitForSelector('[data-tab="apps"]'); await p.click('[data-tab="apps"]'); await p.waitForSelector('#list .row');
  return { ctx, p, errs };
}
const text = (p, sel) => p.locator(sel).first().innerText().catch(() => '');
const attr = (p, sel, a) => p.locator(sel).first().getAttribute(a).catch(() => null);

// 1. one row per app: the designs of Mail, Orders and Home have no rows of their own, only a tag
{
  const { ctx, p, errs } = await open(); const pr = [...errs];
  for (const id of ['mailvintage', 'housevintage', 'ordersvintage', 'drinksvintage', 'fitnessvintage', 'newsvintage', 'weathervintage', 'travelvintage', 'calendarvintage']) if (await p.locator(`#list .row[data-app="${id}"]`).count()) pr.push(`${id} has a row of its own`);
  for (const id of ['mail', 'orders', 'house']) {
    if (await p.locator(`#list .row[data-app="${id}"]`).count() !== 1) pr.push(`${id} has no row`);
    if (!/2 designs/.test(await text(p, `#list .row[data-app="${id}"] .dtag`))) pr.push(`${id}'s row does not say 2 designs`);
  }
  if (await p.locator('#list .row[data-app="notes"] .dtag').count()) pr.push('Notes says it has designs');
  // searching for a design finds the app that has it, once
  await p.click('[data-tab="search"]'); await p.fill('#q', 'vintage');
  const found = await p.locator('#found .row').evaluateAll(rs => rs.map(r => r.dataset.app));
  if (found.join() !== 'mail,orders,house') pr.push('searching "vintage" found ' + found.join() + ', not mail,orders,house');
  report('Mail, Orders and Home are one row each, with a "2 designs" tag; their designs have no rows', pr); await ctx.close();
}

// 2. the Design menu on the app's page: Standard first; picking Vintage changes the icon and what Get adds
{
  const { ctx, p, errs } = await open(); const pr = [...errs];
  await p.click('#list .row[data-app="mail"]'); await p.waitForSelector('.dbtn');
  if (!/Standard/.test(await text(p, '.dbtn'))) pr.push('the menu does not start on Standard');
  if (await p.locator('.dmenu').isVisible()) pr.push('the menu is open before it is tapped');
  if (!/\/mail\/\?via=aos/.test(await attr(p, '.apphead [data-get]', 'href') || '')) pr.push('Get does not add Mail');
  await p.click('.dbtn');
  if (await p.getAttribute('.dbtn', 'aria-expanded') !== 'true') pr.push('aria-expanded does not say open');
  const opts = await p.locator('.dopt').evaluateAll(os => os.map(o => o.textContent));
  if (opts.length !== 2 || !/Standard/.test(opts[0]) || !/Vintage/.test(opts[1])) pr.push('the menu lists: ' + JSON.stringify(opts));
  if (!/Not added/.test(opts[1] || '')) pr.push('Vintage does not say it is not added');
  await p.click('.dopt[data-did="vintage"]');
  if (await p.locator('.dmenu').isVisible()) pr.push('the menu stays open after a pick');
  if (!/Vintage/.test(await text(p, '.dbtn'))) pr.push('the menu does not say Vintage after the pick');
  if (!/mailvintage\/icon-512/.test(await attr(p, '.apphead img', 'src') || '')) pr.push('the page keeps Mail\'s icon');
  if (await attr(p, '.apphead [data-get]', 'data-get') !== 'mailvintage') pr.push('Get still adds ' + await attr(p, '.apphead [data-get]', 'data-get'));
  if (await p.locator('.apphead h1').innerText() !== 'Mail') pr.push('the name changed');
  // the list agrees, and the choice is kept on this phone
  await p.click('.page .back'); await p.waitForTimeout(500);
  if (await attr(p, '#list .row[data-app="mail"] [data-get]', 'data-get') !== 'mailvintage') pr.push('Mail\'s row still points at the standard design');
  await p.reload(); await p.waitForSelector('[data-tab="apps"]'); await p.click('[data-tab="apps"]');
  if (await attr(p, '#list .row[data-app="mail"] [data-get]', 'data-get') !== 'mailvintage') pr.push('the pick was not kept');
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) pr.push('the page scrolls sideways');
  report('the Design menu: Standard first, Vintage changes the icon and what Get adds, and it is kept', pr); await ctx.close();
}

// 3. Get on a design not added yet asks which design, then opens that app's own address (no new tab until then)
{
  const { ctx, p, errs } = await open(); const pr = [...errs];
  let popups = 0; ctx.on('page', () => popups++);
  await p.click('#list .row[data-app="house"] [data-get]');
  await p.waitForSelector('.dsheet', { timeout: 5000 }).catch(() => pr.push('Get did not ask for a design'));
  await p.waitForTimeout(300);
  if (popups) pr.push('Get opened the app before a design was picked');
  if (!/Home/.test(await text(p, '.dsheet h1'))) pr.push('the sheet is not about Home: ' + await text(p, '.dsheet h1'));
  if (await attr(p, '[data-go]', 'data-go') !== 'house') pr.push('the sheet does not start on Standard');
  await p.click('.dsheet .dopt[data-did="vintage"]');
  if (await attr(p, '[data-go]', 'data-go') !== 'housevintage' || !/\/housevintage\/\?via=aos/.test(await attr(p, '[data-go]', 'href') || '')) pr.push('the button does not go to Home Vintage');
  if (!/Home Vintage/.test(await text(p, '[data-go]'))) pr.push('the button does not name Home Vintage: ' + await text(p, '[data-go]'));
  if (await attr(p, '[data-go]', 'target') !== '_blank') pr.push('the button does not open in a new tab');
  await p.click('.dsheet .dopt[data-did="standard"]');
  if (await attr(p, '[data-go]', 'data-go') !== 'house') pr.push('going back to Standard did not change the button');
  report('Get on an app with designs asks which design, then goes to that app', pr); await ctx.close();
}

// 4. an installed design: the row and the page say Installed, the menu says which, and Get does not ask
{
  const { ctx, p, errs } = await open({ mailvintage: Date.now() }); const pr = [...errs];
  await p.waitForFunction(() => /Installed/.test(document.querySelector('#list .row[data-app="mail"] [data-get]').textContent), null, { timeout: 5000 }).catch(() => pr.push('Mail\'s row does not say Installed when Mail Vintage is'));
  await p.click('#list .row[data-app="mail"]'); await p.waitForSelector('.dbtn');
  if (!/Vintage/.test(await text(p, '.dbtn'))) pr.push('the page does not start on the installed design');
  await p.click('.dbtn');
  const opts = await p.locator('.dopt').evaluateAll(os => os.map(o => o.textContent));
  if (!/Not added/.test(opts[0] || '') || !/Installed/.test(opts[1] || '')) pr.push('the menu does not say which is installed: ' + JSON.stringify(opts));
  await p.click('.dopt[data-did="vintage"]');
  const pop = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
  await p.click('.apphead [data-get]');
  if (await p.locator('.dsheet').count()) pr.push('Get asked for a design for one that is already added');
  const np = await pop; if (!np) pr.push('Get did not open the app'); else await np.close();
  report('an installed design says Installed, and Get on it does not ask', pr); await ctx.close();
}

// 5. an app with one design is unchanged: no menu, Get goes straight to the app
{
  const { ctx, p, errs } = await open(); const pr = [...errs];
  const pop = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
  await p.click('#list .row[data-app="notes"] [data-get]');
  if (await p.locator('.dsheet').count()) pr.push('Notes asked for a design');
  const np = await pop; if (!np) pr.push('Get did not open Notes'); else { if (!/\/notes\//.test(np.url())) pr.push('Get opened ' + np.url()); await np.close(); }
  await p.click('#list .row[data-app="notes"]'); await p.waitForSelector('.apphead');
  if (await p.locator('.dsel').count()) pr.push('Notes has a Design menu');
  report('an app with one design has no menu and Get goes straight to it', pr); await ctx.close();
}

// 6. dark mode: the menu and the sheet are readable and fit the screen
{
  const { ctx, p, errs } = await open({}, 'dark'); const pr = [...errs];
  await p.click('#list .row[data-app="mail"]'); await p.waitForSelector('.dbtn'); await p.click('.dbtn');
  const box = await p.locator('.dmenu').boundingBox();
  if (!box || box.x < 0 || box.x + box.width > 390) pr.push('the menu does not fit the screen: ' + JSON.stringify(box));
  const bg = await p.locator('.dmenu').evaluate(e => getComputedStyle(e).backgroundColor);
  if (/250, ?251, ?250/.test(bg)) pr.push('the menu is light in dark mode: ' + bg);
  report('dark mode: the menu fits and is dark', pr); await ctx.close();
}

await b.close(); server.close();
process.exit(failed ? 1 : 0);
