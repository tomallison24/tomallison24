// Mail kept signed in through aOS's server (server/gmail.js, home/account.js AllisonOS.gmail), in headless Chromium at
// iPhone size with a stand-in Gmail and a stand-in aOS server:
//   - set up and kept: Mail opens with an hour-long key from the server (Mail's own kind, modify), no sign-in, and
//     Settings says until when;
//   - none kept yet (or 30 days on): Connect Gmail goes to Google's sign-in with a code, through the server, for modify;
//   - back from it (#gmail=kept&acct=...): the address is tidied, the account kept, and Mail reads Gmail at once;
//   - an hour run out mid-session (a 401): a new key from the server, and the request goes again, once;
//   - Disconnect Gmail forgets Mail's sign-in on the server (modify only: Travel's read-only one stays);
//   - not set up: Mail renews on the phone, as before (Google's quiet sign-in, a token).
// Needs Playwright with Chromium (npm i -g playwright):
//   node mail/scripts/kept-test.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream');
  r.end(fs.readFileSync(f));
});
await new Promise(res => server.listen(0, '127.0.0.1', res));
const BASE = 'http://localhost:' + server.address().port;

const MODIFY = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic';
const browser = await chromium.launch();
let failed = 0;
const ok = (label, cond, extra) => { if (!cond) failed++; console.log((cond ? 'ok - ' : 'not ok - ') + label + (cond || !extra ? '' : '  ' + extra)); };

// answer(path, body) is aOS's server; gmailOk(token) says which keys the stand-in Gmail takes.
async function phone({ answer = () => ({ status: 404, json: {} }), gmailOk = t => /^kept-/.test(t), seed = {}, at = '/mail/', kept = true, me = 'me@example.com' } = {}) {
  const asked = [], urls = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/aOS/api/**', route => {
    const u = new URL(route.request().url()), body = JSON.parse(route.request().postData() || '{}');
    if (u.pathname === '/aOS/api/state') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(kept ? { gmail: true } : {}) });
    asked.push({ path: u.pathname, body, auth: route.request().headers().authorization || '' });
    const a = answer(u.pathname, body);
    return route.fulfill({ status: a.status || 200, contentType: 'application/json', body: JSON.stringify(a.json || {}) });
  });
  await ctx.route(/^https?:\/\/(?!localhost)/, route => {
    const req = route.request(), u = new URL(req.url());
    if (u.host !== 'gmail.googleapis.com') return route.abort();
    const t = (req.headers().authorization || '').replace(/^Bearer /, '');
    const json = o => route.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
    if (!gmailOk(t)) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"code":401}}' });
    const p = u.pathname.replace('/gmail/v1/users/me', '');
    if (p === '/profile') return json({ emailAddress: me });
    if (p === '/labels') return json({ labels: [{ id: 'INBOX', name: 'INBOX', type: 'system' }] });
    if (p === '/settings/filters') return json({ filter: [] });
    return json({});
  });
  await ctx.addInitScript(s => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, Object.assign({ 'aos.seen': JSON.stringify({ mail: '999' }), 'mail.token.ever': '1', 'mail.hint': 'me@example.com', 'mail.swept': String(Date.now()), 'mail.daysMonthly': '1',
    'mail.lastAuth': String(Date.now() - 3 * 3600e3), 'aos.signin.asked': '1', 'aos.sky': 'day' },
    kept ? { 'aos.gmail.on': '1', 'aos.session': JSON.stringify({ token: 'made-up-session', user: { id: 'u1', name: 'Tom' } }) } : {}, seed));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('request', r => urls.push({ url: r.url(), auth: r.headers().authorization || '' }));
  page.on('framenavigated', f => { if (f === page.mainFrame()) urls.push({ url: f.url(), auth: '' }); });
  await page.goto(BASE + at).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, errs, asked, urls };
}
const tokenFrom = (token, extra = {}) => (p => (p.endsWith('/gmail/token') ? { json: Object.assign({ token, exp: Date.now() + 3500e3, scope: MODIFY, email: 'me@example.com', until: Date.now() + 20 * 864e5 }, extra) } : { status: 404, json: {} }));
const read = (urls, t) => urls.some(u => u.url.startsWith('https://gmail.googleapis.com/') && u.auth === 'Bearer ' + t);
const toGoogle = urls => urls.find(u => u.url.startsWith('https://accounts.google.com/'));

{
  const { ctx, page, errs, asked, urls } = await phone({ answer: tokenFrom('kept-1') });
  const t = asked.find(a => a.path === '/aOS/api/gmail/token');
  ok('kept: Mail asks aOS\'s server for an hour-long key, Mail\'s kind, its account, signed in to the family',
    t && t.body.kind === 'modify' && t.body.email === 'me@example.com' && t.auth === 'Bearer made-up-session', JSON.stringify(asked));
  ok('and reads Gmail with it, no sign-in', read(urls, 'kept-1') && !toGoogle(urls), JSON.stringify(urls.map(u => u.url).filter(u => !u.startsWith(BASE))));
  ok('no Connect Gmail screen', await page.locator('[data-act="signin"]').count() === 0);
  await page.click('#gear'); await page.waitForTimeout(700);
  const sub = await page.textContent('#stGmailWho .st-sub').catch(() => '');
  ok('Settings says until when', /^Signed in as me@example\.com until [A-Z][a-z]{2} \d{1,2}\.$/.test(sub.trim()), sub);
  ok('Filter permission granted (the server\'s key has Mail\'s filters scope)', /Granted/.test(await page.textContent('#stBody')));
  ok('no page errors', !errs.length, errs.join(' | '));
  await ctx.close();
}

{
  const { ctx, page, asked, urls } = await phone({ answer: p => (p.endsWith('/gmail/token') ? { status: 409, json: { error: 'expired' } }
    : p.endsWith('/gmail/start') ? { json: { url: 'https://accounts.google.com/o/oauth2/v2/auth?response_type=code&access_type=offline&state=made-up' } } : { status: 404, json: {} }) });
  ok('none kept: Connect Gmail is shown, and Mail hasn\'t gone to Google by itself', await page.locator('[data-act="signin"]').count() === 1 && !toGoogle(urls));
  await page.click('[data-act="signin"]'); await page.waitForTimeout(1200);
  const start = asked.find(a => a.path === '/aOS/api/gmail/start');
  ok('Connect Gmail asks the server to start a sign-in for Mail\'s kind, this account, back to Mail',
    start && start.body.kind === 'modify' && start.body.hint === 'me@example.com' && /^\/mail\//.test(start.body.back), JSON.stringify(asked));
  const g = toGoogle(urls);
  ok('and goes to Google\'s sign-in with a code', g && new URL(g.url).searchParams.get('response_type') === 'code', g && g.url);
  await ctx.close();
}

{
  const { ctx, page, asked, urls } = await phone({ answer: tokenFrom('kept-2', { email: 'new@example.com' }), at: '/mail/#gmail=kept&acct=new%40example.com', me: 'new@example.com' });
  ok('back from it: the address is tidied', await page.evaluate(() => location.hash) === '');
  ok('the account it signed in to is kept, and asked for', await page.evaluate(() => localStorage.getItem('mail.hint')) === 'new@example.com'
    && asked.some(a => a.path === '/aOS/api/gmail/token' && a.body.email === 'new@example.com'), JSON.stringify(asked));
  ok('and Mail reads Gmail at once', read(urls, 'kept-2'));
  await ctx.close();
}

{
  const { ctx, page } = await phone({ answer: () => ({ status: 404, json: {} }), at: '/mail/#gmail=error' });
  ok('a sign-in that didn\'t finish says so', /didn’t finish/.test(await page.textContent('body')));
  await ctx.close();
}

{
  let n = 0;
  const { ctx, page, asked, urls } = await phone({
    seed: { 'mail.token': JSON.stringify({ t: 'old-hour', exp: Date.now() + 600e3, scope: MODIFY }) },
    answer: p => (p.endsWith('/gmail/token') ? { json: { token: 'kept-' + (++n), exp: Date.now() + 3500e3, scope: MODIFY, email: 'me@example.com', until: Date.now() + 20 * 864e5 } } : { status: 404, json: {} }),
  });
  ok('an hour run out mid-session (Gmail says 401): one new key from the server, and Gmail is asked again with it',
    read(urls, 'old-hour') && read(urls, 'kept-1') && asked.filter(a => a.path === '/aOS/api/gmail/token').length === 1, JSON.stringify(asked));
  ok('Mail stays open', await page.locator('[data-act="signin"]').count() === 0);
  await ctx.close();
}

{
  const { ctx, page, asked } = await phone({ answer: p => (p.endsWith('/gmail/token') ? tokenFrom('kept-1')(p) : { json: { ok: true } }) });
  await page.click('#gear'); await page.waitForTimeout(700);
  await page.click('#stBody [data-act="signout"]'); await page.waitForTimeout(300);
  await page.click('#stBody [data-act="signout"]'); await page.waitForTimeout(900);
  const d = asked.find(a => a.path === '/aOS/api/gmail/disconnect');
  ok('Disconnect Gmail forgets Mail\'s sign-in on the server, Mail\'s kind only', d && d.body.kind === 'modify' && d.body.email === 'me@example.com', JSON.stringify(asked));
  ok('and Mail is signed out on the phone', await page.evaluate(() => !localStorage.getItem('mail.token') && !localStorage.getItem('mail.token.until')));
  await ctx.close();
}

{
  const { ctx, asked, urls } = await phone({ kept: false });
  const g = toGoogle(urls);
  ok('not set up: Mail renews on the phone as before (Google\'s quiet sign-in, a token), not through the server',
    g && new URL(g.url).searchParams.get('response_type') === 'token' && new URL(g.url).searchParams.get('prompt') === 'none' && !asked.some(a => /gmail\//.test(a.path)), g && g.url);
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
