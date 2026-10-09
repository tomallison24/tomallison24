// Plays every app's first-open walkthrough as a new install on an iPhone (opened
// from the Home Screen, its server routes offline) and steps through its live tour
// (home/welcome.js SPOTS): the spotlight must find at least two of the app's stops,
// end on Light or dark, take its demo rows out again and mark the walkthrough seen,
// with no script errors. Weather needs a forecast for its stops, so offline it must
// fall back to its cards instead. Run after changing an app's screen: a control
// that moves or is renamed can leave its tour with nothing to show.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node aOS/scripts/tours-test.mjs [repo root]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const W = fs.readFileSync(path.join(ROOT, 'home/welcome.js'), 'utf8');
const APPS = Function('return ' + /const APPS = (\[[^\]]*\])/.exec(W)[1])();
const DARK_ONLY = Function('return ' + /const DARK_ONLY = (\[[^\]]*\])/.exec(W)[1])();
const CARDS_OFFLINE = ['weather'];   // its stops are on the forecast, which needs the network

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
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const browser = await chromium.launch();
let failed = 0;
for (const id of APPS) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA });
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin !== BASE) return route.abort('internetdisconnected');
    if (u.pathname.includes('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
    return route.continue();
  });
  await ctx.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));   // opened from the Home Screen
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push('script error: ' + e.message));
  await page.goto(BASE + '/' + id + '/');
  const mode = await Promise.race([
    page.waitForSelector('#aos-welcome .s-card.on', { timeout: 25000 }).then(() => 'tour'),
    page.waitForSelector('#aos-welcome .c-panel.on', { timeout: 25000 }).then(() => 'cards'),
  ]).catch(() => 'nothing');
  const want = CARDS_OFFLINE.includes(id) ? 'cards' : 'tour';
  if (mode !== want) problems.push(`played ${mode}, not its ${want}`);
  const stops = [];
  if (mode === 'tour') {
    for (let n = 0; n < 12; n++) {
      // the next stop's card, or the tour has closed (its layer fades out, then goes)
      const on = await page.waitForSelector('#aos-welcome:not(.out) .s-card.on', { timeout: 6000 }).then(() => true).catch(() => false);
      if (!on) break;
      await page.waitForTimeout(700);
      stops.push(await page.evaluate(() => document.querySelector('#aos-welcome .s-card h3').textContent));
      await page.click('#aos-welcome .s-next', { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
      await page.waitForFunction(() => { const c = document.querySelector('#aos-welcome .s-card'); return !c || !c.classList.contains('on') || document.getElementById('aos-welcome').classList.contains('out'); }, null, { timeout: 3000 }).catch(() => {});
    }
    await page.waitForTimeout(1200);
    const theme = !DARK_ONLY.includes(id);
    if (stops.length - (theme ? 1 : 0) < 2) problems.push(`only ${stops.length} stops: ${stops.join(', ')}`);
    if (theme && stops[stops.length - 1] !== 'Light or dark') problems.push('did not end on Light or dark');
    const after = await page.evaluate(id => ({ open: !!document.getElementById('aos-welcome'), demos: document.querySelectorAll('[data-aos-demo]').length, seen: (JSON.parse(localStorage.getItem('aos.seen') || '{}'))[id] }), id);
    if (after.open) problems.push('the tour did not close');
    if (after.demos) problems.push(after.demos + ' demo rows left in the app');
    if (!after.seen) problems.push('not marked as seen');
  }
  if (problems.length) { failed++; console.log('not ok - ' + id + '\n  ' + problems.join('\n  ')); }
  else console.log('ok - ' + id + ' (' + (mode === 'tour' ? stops.join(' › ') : 'cards, offline') + ')');
  await ctx.close();
}
await browser.close();
server.close();
console.log(APPS.length - failed + ' of ' + APPS.length + ' passed');
process.exit(failed ? 1 : 0);
