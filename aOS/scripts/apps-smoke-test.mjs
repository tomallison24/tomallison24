// Opens every AllisonOS app in headless Chromium at iPhone size, light and
// dark, and fails on a script error or anything its Content-Security-Policy
// blocks. Nothing outside the site is reached: other hosts and the server
// routes answer as if offline, so this checks the page itself, not the
// services behind it. Run after changing an app's page, its scripts or its
// policy (the new-aos-app skill says when). Also: no app pans sideways (home/welcome.js,
// "Never sideways"), so a stray swipe can't carry its controls off the screen, and a double tap doesn't
// zoom it in (a zoomed page drifts side to side). Also in Night Drive and Tron, whose generated styles draw
// things of their own (Tron's grid floor was three phones wide, and the phone widened Home's page to fit it).
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node aOS/scripts/apps-smoke-test.mjs [repo root]
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
const ids = ['aos', ...APPS], dir = id => id === 'aos' ? 'aOS' : id;

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
let failed = 0;
// light and dark in the default design (Vintage), then Night Drive and Tron (dark only)
const RUNS = [['light', null], ['dark', null], ['light', 'neon'], ['dark', 'grid']];
const label = (scheme, look) => scheme + (look ? ', ' + { neon: 'Night Drive', grid: 'Tron' }[look] : '');
for (const id of ids) {
  for (const [scheme, look] of RUNS) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
    // Offline for everything but the site's own files: other hosts fail, server routes say they aren't set up.
    await ctx.route('**/*', route => {
      const u = new URL(route.request().url());
      if (u.origin !== BASE) return route.abort('internetdisconnected');
      if (u.pathname.includes('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
      return route.continue();
    });
    // The walkthroughs as seen, as on a phone in use.
    await ctx.addInitScript(ids => localStorage.setItem('aos.seen', JSON.stringify(Object.fromEntries(ids.map(i => [i, '999'])))), ids);
    // the design, as aOS's Appearance writes it (aOS/look.js): aOS's aos.look, design.<id>, Clock's set.design
    if (look) await ctx.addInitScript(([id, look]) => {
      if (id === 'aos') localStorage.setItem('aos.look', look);
      else if (id === 'clock') localStorage.setItem('allison-clock-v1', JSON.stringify({ set: { design: look } }));
      else localStorage.setItem('design.' + id, look);
    }, [id, look]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('script error: ' + e.message));
    await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI); }));
    await page.goto(BASE + '/' + dir(id) + '/');
    await page.waitForTimeout(1800);
    const csp = await page.evaluate(() => window.__csp || []);
    const policy = await page.evaluate(() => !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'));
    const text = (await page.evaluate(() => document.body.innerText)).trim().length;
    const problems = [...errors, ...csp.map(c => 'blocked by its policy: ' + c)];
    if (!policy) problems.push('no Content-Security-Policy meta');
    if (!text) problems.push('the page drew nothing');
    // never sideways: the page and its body cut off what's wider than the screen, and a sideways scroll goes nowhere
    // and the page is as wide as the phone (a phone widens it to fit something wider: then it all slides)
    const side = await page.evaluate(() => { scrollTo(300, scrollY); const x = scrollX; scrollTo(0, scrollY);
      const ox = el => getComputedStyle(el).overflowX, ob = el => getComputedStyle(el).overscrollBehaviorX;
      return { x, width: innerWidth, look: document.documentElement.getAttribute('data-look'), html: ox(document.documentElement), body: ox(document.body), bounce: ob(document.documentElement), tap: getComputedStyle(document.documentElement).touchAction }; });
    if (look && side.look !== look) problems.push('it didn\'t open in ' + label(scheme, look) + ': data-look ' + side.look);
    if (side.x || side.width !== 390 || !/^(clip|hidden)$/.test(side.html) || !/^(clip|hidden)$/.test(side.body) || side.bounce !== 'none' || side.tap !== 'manipulation') problems.push('it pans sideways, or zooms on a double tap: ' + JSON.stringify(side));
    if (problems.length) { failed++; console.log('not ok - ' + id + ' (' + label(scheme, look) + ')\n  ' + problems.join('\n  ')); }
    else console.log('ok - ' + id + ' (' + label(scheme, look) + ')');
    await ctx.close();
  }
}
await browser.close();
server.close();
console.log(ids.length * RUNS.length - failed + ' of ' + ids.length * RUNS.length + ' passed');
process.exit(failed ? 1 : 0);
