// An update an app has under way (reading Gmail, say) isn't cut off by moving between apps in aOS
// (aOS/home-tab.js aosHome.updating, ../home/welcome.js AllisonOS.updating):
//   - an app in the middle of one isn't put away to open a fifth app (the next one used longest ago is);
//     done, it's put away as before; and a page that goes (started again) says it's done as it goes
//   - settings from another device for it wait until it's done, then it opens again with them
//   - an app shown again after another hears 'aos:shown', so it can carry on what was cut off
// and Orders (/orders/), when a read of Gmail is cut off: what it read is kept as it goes (every 25 emails),
// and the next read goes on from there, reading none of it again.
//   node aOS/scripts/updating-test.mjs [repo root]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const R = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(R, p);
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;
const browser = await chromium.launch();
let failed = 0;
const report = (name, problems) => { if (problems.length) { failed++; console.log('not ok - ' + name + '\n  ' + problems.join('\n  ')); } else console.log('ok - ' + name); };

// ---- aOS: apps in the middle of an update ----
{
  const pr = [];
  const APPS = ['clock', 'drinks', 'notes', 'places', 'podcasts'];
  let PREFS = {};   // what the server has from "another device"
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(apps => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('aos.seen', JSON.stringify(Object.fromEntries(['aos', ...apps].map(a => [a, '999']))));
    localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.sky', 'day'); localStorage.setItem('aos.session', JSON.stringify({ token: 't', user: { id: 'O1', name: 'Tom', role: 'owner' }, at: Date.now() }));
    sessionStorage.setItem('aos.later.aos', '1');
    localStorage.setItem('design.notes', 'vintage');
    localStorage.setItem('aos.prefs.seen', JSON.stringify({ 'design.notes': { h: 'vintage', at: 1 } }));
  }, APPS);
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url()), J = o => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.origin !== BASE) return r.abort();
    if (u.pathname === '/aOS/api/state') return J({ storage: true, setup: true, user: { id: 'O1', name: 'Tom', role: 'owner', apps: {} }, plan: null });
    if (u.pathname === '/aOS/api/prefs') return J({ prefs: PREFS });
    if (u.pathname.startsWith('/aOS/api/')) return J({});
    if (u.pathname.includes('/api/')) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
    return r.continue();
  });
  const p = await ctx.newPage(); p.on('pageerror', e => pr.push('script error: ' + e.message));
  await p.goto(BASE + '/aOS/'); await p.waitForSelector('.happ[data-open="clock"]');
  // an app's own frame (Playwright's: aOS's page policy allows no eval of its own)
  const fr = id => p.frames().find(f => { try { return new URL(f.url()).pathname === `/${id}/`; } catch { return false; } });
  const openApp = async id => {
    await p.evaluate(id => document.querySelector(`.happ[data-open="${id}"]`).click(), id);
    await p.waitForFunction(id => { const f = document.querySelector(`#stage .frame[data-id="${id}"] iframe`), w = f && f.contentWindow;
      return w && w.location.pathname === `/${id}/` && w.document.readyState === 'complete' && w.AllisonOS && w.AllisonOS.updating; }, id, { timeout: 15000 });
  };
  const home = async () => { await p.evaluate(() => document.getElementById('appback').click()); await p.waitForTimeout(500); };
  const inApp = (id, fn) => { const f = fr(id); if (f) return f.evaluate(fn); pr.push(id + ' was put away'); return null; };
  const openNow = () => p.evaluate(() => [...document.querySelectorAll('#stage .frame')].map(f => f.dataset.id).sort().join());

  // in the middle of an update: not put away for a fifth app; the next one used longest ago is. (The same job started
  // again while it runs, and done at once, leaves it on: the first isn't done.)
  await openApp('clock'); await inApp('clock', () => { AllisonOS.updating('gmail', true); AllisonOS.updating('gmail', true); AllisonOS.updating('gmail', false); }); await home();
  for (const id of ['drinks', 'notes', 'places']) { await openApp(id); await home(); }
  await openApp('podcasts'); await home();
  let now = await openNow();
  if (!now.includes('clock') || now.includes('drinks')) pr.push('opening a fifth app put away the one updating, or not the next one: ' + now);
  // done: put away as before
  await inApp('clock', () => AllisonOS.updating('gmail', false));
  await openApp('drinks'); await home();
  now = await openNow();
  if (now.includes('clock')) pr.push('done, the app was still kept open: ' + now);
  // a page that goes (started again) says it's done as it goes
  await inApp('notes', () => AllisonOS.updating('gmail', true));
  await inApp('notes', () => { location.reload(); });
  await p.waitForTimeout(300);
  await p.waitForFunction(() => { const w = document.querySelector('#stage .frame[data-id="notes"] iframe').contentWindow; return w.document.readyState === 'complete' && w.AllisonOS && w.AllisonOS.updating; }, null, { timeout: 15000 });
  await openApp('clock'); await home();
  now = await openNow();
  if (now.includes('notes')) pr.push('a page started again still counted as updating: ' + now);

  // settings from another device wait until the update is done, then the app opens again with them
  await openApp('notes');
  await inApp('notes', () => { window.__mark = 1; AllisonOS.updating('gmail', true); });
  PREFS = { 'design.notes': { v: 'glass', at: 2 } };
  await home(); await p.waitForTimeout(1500);   // back on Home: the settings sync
  const held = { design: await p.evaluate(() => localStorage.getItem('design.notes')), same: await inApp('notes', () => window.__mark === 1) };
  if (held.design !== 'vintage' || !held.same) pr.push('settings came down over an app in the middle of an update: ' + JSON.stringify(held));
  await inApp('notes', () => AllisonOS.updating('gmail', false));
  await p.waitForFunction(() => { const w = document.querySelector('#stage .frame[data-id="notes"] iframe').contentWindow;
    return localStorage.getItem('design.notes') === 'glass' && w.location.pathname === '/notes/' && w.__mark === undefined && w.document.readyState === 'complete'; }, null, { timeout: 10000 })
    .catch(async () => pr.push('done, the app did not open again with its settings: ' + await p.evaluate(() => localStorage.getItem('design.notes'))));

  // shown again after another app: it hears so (not when it first opens)
  await p.waitForFunction(() => { const w = document.querySelector('#stage .frame[data-id="notes"] iframe').contentWindow; return w.document.readyState === 'complete' && !!w.AllisonOS; });
  await inApp('notes', () => { window.__shown = 0; addEventListener('aos:shown', () => window.__shown++); });
  await openApp('notes'); await home(); await openApp('clock'); await home(); await openApp('notes');
  const shown = await inApp('notes', () => window.__shown);
  if (shown !== 2) pr.push("an app shown again didn't hear aos:shown each time: " + shown);
  await ctx.close();
  report('aOS: an app in the middle of an update is neither put away nor started again for settings until it\'s done, and hears when it\'s shown again', pr);
}

// ---- Orders: a read of Gmail cut off keeps what it read, and the next one goes on from there ----
{
  const pr = [];
  const N = 60, ids = Array.from({ length: N }, (_, i) => 'm' + String(i + 1).padStart(3, '0'));
  const b64 = s => Buffer.from(s).toString('base64url');
  const message = id => ({ id, threadId: id, internalDate: String(Date.now() - ids.indexOf(id) * 6e4), payload: { mimeType: 'text/plain', headers: [{ name: 'Subject', value: 'Hello ' + id }, { name: 'From', value: 'News <news@example.com>' }], body: { data: b64('Nothing to order here, ' + id) } } });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem('seeded') || localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem('aos.seen', JSON.stringify({ orders: '999' })); localStorage.setItem('aos.sky', 'day');
    localStorage.setItem('orders.token', JSON.stringify({ t: 'fake-token', exp: Date.now() + 3600e3, scope: 'https://www.googleapis.com/auth/gmail.readonly' }));
    localStorage.setItem('orders.token.ever', '1');
    localStorage.setItem('allison-orders-v1-ipsy-auto', '0');
  });
  let cut = true; const fetched = [];
  await ctx.route('https://gmail.googleapis.com/**', route => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/profile')) return route.fulfill({ json: { emailAddress: 'tom@example.com' } });
    if (u.pathname.endsWith('/messages')) return route.fulfill({ json: { messages: ids.map(id => ({ id, threadId: id })) } });
    const id = u.pathname.split('/').pop();
    if (cut && ids.indexOf(id) >= 30) return;   // the rest never comes: Orders is closed partway
    fetched.push(id);
    return route.fulfill({ json: message(id) });
  });
  await ctx.route(u => new URL(u).origin === BASE && new URL(u).pathname.includes('/api/'), r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
  const seenNow = pg => pg.evaluate(() => JSON.parse(localStorage.getItem('allison-orders-v1-seen') || '[]'));
  let p = await ctx.newPage(); p.on('pageerror', e => pr.push('script error: ' + e.message));
  await p.goto(BASE + '/orders/');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('allison-orders-v1-seen') || '[]').length >= 25, null, { timeout: 20000 })
    .catch(() => pr.push('nothing read was kept while the read went on'));
  const kept = await seenNow(p), flag = await p.evaluate(() => localStorage.getItem('allison-orders-v1-scan-cut'));
  if (flag !== '1') pr.push('a read under way is not marked as such: ' + flag);
  await p.close();   // cut off
  cut = false; fetched.length = 0;
  p = await ctx.newPage(); p.on('pageerror', e => pr.push('script error: ' + e.message));
  await p.goto(BASE + '/orders/');
  await p.waitForFunction(n => JSON.parse(localStorage.getItem('allison-orders-v1-seen') || '[]').length >= n && !localStorage.getItem('allison-orders-v1-scan-cut'), N, { timeout: 20000 })
    .catch(async () => pr.push('the next read did not finish: ' + (await seenNow(p)).length + ' read'));
  const again = fetched.filter(id => kept.includes(id));
  if (again.length) pr.push('the next read read again what was kept: ' + again.join());
  if (fetched.length + kept.length < N) pr.push(`the next read didn't read the rest: ${fetched.length} + ${kept.length} of ${N}`);
  await ctx.close();
  report('Orders: a read of Gmail cut off keeps what it read as it goes, and the next one reads only the rest', pr);
}

await browser.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed'); process.exit(failed ? 1 : 0);
