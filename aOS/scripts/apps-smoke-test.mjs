// Opens every AllisonOS app in headless Chromium at iPhone size, light and
// dark, and fails on a script error or anything its Content-Security-Policy
// blocks. Nothing outside the site is reached: other hosts and the server
// routes answer as if offline, so this checks the page itself, not the
// services behind it. Run after changing an app's page, its scripts or its
// policy (the new-aos-app skill says when).
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
for (const id of ids) {
  for (const scheme of ['light', 'dark']) {
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
    if (problems.length) { failed++; console.log('not ok - ' + id + ' (' + scheme + ')\n  ' + problems.join('\n  ')); }
    else console.log('ok - ' + id + ' (' + scheme + ')');
    await ctx.close();
  }
}
await browser.close();
server.close();
console.log(ids.length * 2 - failed + ' of ' + ids.length * 2 + ' passed');
process.exit(failed ? 1 : 0);
