// How fast Home connects to Home Assistant when the first try stalls. Home
// Assistant is a stand-in (Playwright's WebSocket routing, no network): it can
// answer at once, never answer, answer slowly, refuse the token or hang up.
// Getting connected is a race (housevintage/app.js, RACE_AT): a socket that is not
// answered in 4 s is not given up on, another opens beside it, and the first
// answered wins. Before, each try got 12 s and then started again from
// nothing, so a slow handshake (over 12 s) never connected, and three stalled tries
// in a row took 44 s.
//   node housevintage/scripts/connect-test.mjs [repo root]
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

// behave: (attempt number, socket) -> what the stand-in does with that socket
//   { silent: true }   never says a word            { after: ms }   says auth_required after ms
//   { badToken: true } turns the token down          { dropAfterLive: ms }  hangs up that long after going live
async function scenario(name, behave, check) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin !== BASE) return route.abort('internetdisconnected');
    if (u.pathname.includes('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
    return route.continue();
  });
  await ctx.addInitScript(() => {
    localStorage.setItem('aos.seen', JSON.stringify({ housevintage: '999' })); localStorage.setItem('aos.signin.asked', '1');
    localStorage.setItem('housev.ha', JSON.stringify({ url: 'https://ha.example', token: 'tok' }));
  });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const t0 = Date.now(), seen = { opened: 0, closed: 0, liveAt: [] };
  await page.routeWebSocket('wss://ha.example/api/websocket', ws => {
    const n = ++seen.opened, b = behave(n);
    let done = false;
    ws.onClose(() => { if (done) return; done = true; seen.closed++; try { ws.close(); } catch {} });   // with a handler, closing the page's socket is ours to finish
    if (b.silent) return;
    setTimeout(() => { try { ws.send(JSON.stringify({ type: 'auth_required', ha_version: '2026.10.0' })); } catch {} }, b.after || 0);
    ws.onMessage(m => {
      const d = JSON.parse(m);
      if (d.type === 'auth') {
        if (b.badToken) return ws.send(JSON.stringify({ type: 'auth_invalid', message: 'Invalid access token' }));
        ws.send(JSON.stringify({ type: 'auth_ok', ha_version: '2026.10.0' }));
        if (b.dropAfterLive) setTimeout(() => { try { ws.close(); } catch {} }, b.dropAfterLive);
      }
      if (d.type === 'subscribe_entities') ws.send(JSON.stringify({ id: d.id, type: 'event', event: { a: { 'sensor.x': { s: 'on', a: {}, lc: 1, lu: 1 } } } }));
      if (d.type === 'ping') ws.send(JSON.stringify({ id: d.id, type: 'pong' }));
    });
  });
  await page.goto(BASE + '/housevintage/');
  const secs = () => (Date.now() - t0) / 1000;
  const status = () => page.evaluate(() => ({ s: document.getElementById('chip').dataset.s, say: (document.querySelector('.hastatus') || {}).textContent || '' }));
  const live = (limit = 40) => page.waitForFunction(() => document.getElementById('chip').dataset.s === 'live', null, { timeout: limit * 1000 }).then(() => secs());
  try { await check({ page, seen, secs, live, status, sleep: ms => page.waitForTimeout(ms) }); passed++; console.log('ok - ' + name); }
  catch (e) { console.log('not ok - ' + name + '\n  ' + String(e.message || e).split('\n')[0]); await browser.close(); server.close(); process.exit(1); }
  assert.deepEqual(errors, [], 'script errors');
  await ctx.close();
}

await scenario('Home Assistant answers at once: live within a few seconds, one socket', () => ({}), async ({ live, seen, sleep }) => {
  assert.ok(await live() < 4);
  await sleep(500);
  assert.equal(seen.opened, 1);
});
await scenario('the first socket never answers: a second joins at 4 s and wins; the first is closed', n => ({ silent: n === 1 }), async ({ live, seen, sleep }) => {
  const t = await live();
  assert.ok(t > 3.5 && t < 8, 'live at ' + t);
  await sleep(500);
  assert.equal(seen.opened, 2); assert.equal(seen.closed, 1, 'the stalled socket is closed');
});
await scenario('the first two never answer: the third, at 9 s, gets through', n => ({ silent: n <= 2 }), async ({ live, seen, sleep }) => {
  const t = await live();
  assert.ok(t > 8.5 && t < 13, 'live at ' + t);
  await sleep(500);
  assert.equal(seen.opened, 3); assert.equal(seen.closed, 2);
});
await scenario('a slow answer (15 s) is waited for, not restarted every 12 s', () => ({ after: 15000 }), async ({ live, seen, secs }) => {
  const t = await live();
  assert.ok(t > 14 && t < 19, 'live at ' + t);
  assert.ok(seen.opened <= 3, 'sockets opened: ' + seen.opened);
});
await scenario('nothing answers: after 25 s it says so, and tries again', () => ({ silent: true }), async ({ page, seen, secs, status, sleep }) => {
  await page.waitForFunction(() => document.getElementById('chip').dataset.s === 'error', null, { timeout: 35000 });
  const t = secs();
  assert.ok(t > 24 && t < 30, 'said so at ' + t);
  assert.match((await status()).say, /did not answer at ha\.example within 25 seconds/);
  assert.equal(seen.opened, 3, 'one round is three sockets');
  await sleep(3500);
  assert.ok(seen.opened >= 4, 'a new round starts after a second');
  assert.ok(seen.closed >= 3, 'the first round\'s sockets are closed');
});
await scenario('the token is turned down: it says so and does not try again', () => ({ badToken: true }), async ({ page, seen, status, sleep }) => {
  await page.waitForFunction(() => document.getElementById('chip').dataset.s === 'error', null, { timeout: 10000 });
  assert.match((await status()).say, /turned the token down/);
  const n = seen.opened;
  await sleep(4000);
  assert.equal(seen.opened, n, 'no more sockets after a refused token');
});
await scenario('a live connection that drops reconnects within a few seconds', n => ({ dropAfterLive: n === 1 ? 1500 : 0 }), async ({ page, live, seen, sleep }) => {
  await live();
  await page.waitForFunction(() => document.getElementById('chip').dataset.s !== 'live', null, { timeout: 8000 });
  const t = Date.now();
  await live(15);
  assert.ok(Date.now() - t < 6000, 'back after ' + (Date.now() - t) + ' ms');
  assert.equal(seen.opened, 2);
});

await browser.close();
server.close();
console.log(passed + ' tests passed');
