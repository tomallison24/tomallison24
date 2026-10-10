// An invite, opened on a phone's browser, makes the account and then shows how to add
// aOS: on iPhone (Safari's steps) and on Android (Chrome's Install, or its menu). The
// accounts server is stood in for, and the passkey is Chromium's virtual authenticator,
// so this checks the pages, not the server (accounts-api-test.mjs does that).
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node aOS/scripts/join-test.mjs [repo root]
import { createRequire } from 'module'; import { execSync } from 'child_process'; import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/'); const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, r)); const BASE = 'http://localhost:' + server.address().port;
const b64u = buf => Buffer.from(buf).toString('base64url');
const UA = { android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' };
const b = await chromium.launch();
let failed = 0;
for (const dev of ['android', 'iphone']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA[dev] });
  let signed = false; const user = { id: 'u1', name: 'Sarah', role: 'member', apps: {} };
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort();
    if (!u.pathname.startsWith('/aOS/api/')) return r.continue();
    const route = u.pathname.slice('/aOS/api/'.length), J = o => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (route === 'state') return J({ storage: true, setup: true, user: signed ? user : null, plan: null });
    if (route === 'signup/begin') return J({ id: 'c1', challenge: b64u(Buffer.alloc(32, 7)), rp: { id: 'localhost', name: 'AllisonOS' }, user: { id: b64u('u1'), name: 'Sarah' } });
    if (route === 'signup/finish') { signed = true; return J({ token: 't1', user }); }
    if (route === 'members') return J({ members: [user] });
    return J({});
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const cdp = await ctx.newCDPSession(p); await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true } });
  await p.goto(BASE + '/aOS/#invite=AbCdEf123456_-XyZ');
  await p.waitForSelector('#aName', { timeout: 15000 });
  const atLoad = await p.evaluate(() => document.getElementById('aos-welcome') ? (document.querySelector('#aos-welcome h2') || {}).textContent || 'overlay' : null);
  await p.fill('#aName', 'Sarah'); await p.locator('#aGo').scrollIntoViewIfNeeded(); await p.click('#aGo').catch(e => errs.push('click: ' + e.message.split('\n')[0]));   // a person scrolls to it too
  await p.waitForTimeout(3500);
  const after = await p.evaluate(() => ({ h2: (document.querySelector('#aos-welcome h2') || {}).textContent || null, inst: (document.querySelector('#aos-welcome .c-inst') || {}).textContent || null, sd: !!document.querySelector('#aos-welcome .c-sd'), err: (document.getElementById('aErr') || {}).textContent || '' }));
  const problems = [...errs];
  if (atLoad) problems.push('something covered the invite at first: ' + atLoad);
  if (!signed) problems.push('the account was not made' + (after.err ? ': ' + after.err : ''));
  if (after.h2 !== 'Add aOS to your Home Screen') problems.push('then showed ' + (after.h2 || 'nothing') + ', not how to add aOS');
  if (dev === 'iphone' && !after.sd) problems.push("no Safari steps");
  if (dev === 'android' && !after.inst) problems.push("no Install or menu steps");
  if (problems.length) { failed++; console.log('not ok - ' + dev + '\n  ' + problems.join('\n  ')); } else console.log('ok - ' + dev + ': invite, account, then how to add aOS');
  await ctx.close();
}
await b.close(); server.close();
process.exit(failed ? 1 : 0);
