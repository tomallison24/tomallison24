// Drives the Money app in headless Chromium at iPhone size, with made-up data only:
// - the reader's phone reads Monarch's emails from a stand-in Gmail (an alert, a summary
//   repeating it and adding one, a "can't sync" email, a newsletter that isn't one), folds them
//   in with what it had, and sends them to aOS through the real functions/money/api route (on an
//   in-memory Workers KV with real sessions);
// - This month: the number, the usual, where you could save, the categories and a category's list;
//   the "can't sync" card and Fixed it (with Undo); the months before;
// - Transactions: a day at a time, search across months, a transaction's sheet;
// - Cards and rewards: spending and cash back per card, the rewards chart and its table, the better
//   card; changing a card's rate in Settings changes what it earned;
// - Recurring: what repeats and a year of it;
// - the spouse's phone: nothing until the reader shares it (Settings > Who sees Money), then the
//   same months, and no Gmail;
// - signed out with no data: the empty page asks to connect Gmail;
// - dark mode, the designs (Vintage, the default, and Standard, from Settings > Design), and nothing
//   tripping the page's Content Security Policy or throwing.
// Screenshots go to the folder given as the second argument.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node money/scripts/app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { onRequest } from '../../functions/money/api/[[route]].js';
import { issue, putJSON } from '../../server/auth.js';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

// ---- a static server for the repo ----
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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

// ---- dates around today, in the test's own zone (the browser gets the same one) ----
const TZ = 'America/New_York';
process.env.TZ = TZ;
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const NOW = new Date();
const ym = n => { const d = new Date(NOW.getFullYear(), NOW.getMonth() + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
// day d of the month n months from now (never after today in this month)
const on = (n, d) => { const x = new Date(NOW.getFullYear(), NOW.getMonth() + n, d, 12); if (x > NOW) x.setTime(new Date(NOW.getFullYear(), NOW.getMonth(), Math.max(1, NOW.getDate() - 1), 12).getTime()); return x; };

// ---- made-up transactions: three months before this one, and this one so far ----
let k = 0;
const ROCKET = 'Rocket Credit Card', CUSTOM = 'Customized Cash Rewards Visa Signature';
const T = (d, amt, merchant, extra = {}) => Object.assign({ id: 'seed' + (++k), at: d.getTime(), date: ymd(d), amt, dir: 'out', merchant, account: ROCKET, last4: '9876', cat: 'Shopping', emoji: '🛍', mid: '', src: 'alert', min: 1 }, extra);
const SEED = [];
for (const n of [-3, -2, -1, 0]) {
  for (const d of [2, 9, 16, 23]) if (n < 0 || d < NOW.getDate()) SEED.push(T(on(n, d), 391.5, 'Little Learners', { cat: 'Child Care', emoji: '👶' }));
  SEED.push(T(on(n, 3), 1000, 'Mortgage Co', { account: 'Shared Checking', last4: '0001', cat: 'Mortgage', emoji: '🏠' }));
  SEED.push(T(on(n, 5), n === 0 ? 640 : 180, 'Amazon'));
  SEED.push(T(on(n, 6), 120, 'Costco', { account: CUSTOM, last4: '1111' }));
  SEED.push(T(on(n, 7), 24.5, 'Corner Diner', { account: CUSTOM, last4: '1111', cat: 'Restaurants', emoji: '🍽' }));
}
SEED.sort((a, b) => b.at - a.at);

// ---- the stand-in Gmail: made-up emails in Monarch's templates ----
const alertHtml = (sentence) => `<html><head><title>x</title><style>p{}</style></head><body><p>Hi Pat,</p><p>\r\n ${sentence}\r\n</p><a href="https://app.monarch.com/links/transactions/998877665544332211?notification=1">View Transaction</a><p>You've asked to be notified about expenses over $1.</p></body></html>`;
const b64 = s => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
const RECENT = Date.now() - 2 * 3600e3;
const MAIL = {
  m1: { subject: '💲 New expense from Book Nook in Monarch', html: alertHtml('We noticed an expense of $42.00 from Book Nook, which was spent from Rocket Credit Card **9876 (...9876) and has been categorized as 📚 Books.'), at: RECENT },
  m2: { subject: '✨ You have 2 new updates in Monarch', at: RECENT + 60e3, html: '<html><body><p class="activity-body"><a>A new expense of $42.00 from Book Nook has been categorized as 📚 Books.</a></p><p class="activity-body"><a>A new expense of $15.75 from Corner Diner has been categorized as 🍽 Restaurants.</a></p></body></html>' },
  m3: { subject: '🛠️ Access Expired', at: RECENT, text: 'Hi Pat,\n\nRocket Bank only grants Monarch access for a limited time. To continue syncing, reauthorize the connection.' },
  m4: { subject: 'What’s new at Monarch', at: RECENT, html: '<p>Our new reports are here!</p>' },
};
const gmailCalls = [];
async function gmail(route) {
  const u = new URL(route.request().url());
  gmailCalls.push(u.pathname + u.search);
  if (route.request().headers().authorization !== 'Bearer fake-token') return route.fulfill({ status: 401, body: '{}' });
  if (u.pathname.endsWith('/profile')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ emailAddress: 'pat@example.com' }) });
  if (u.pathname.endsWith('/messages')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: Object.keys(MAIL).map(id => ({ id })) }) });
  const id = u.pathname.split('/').pop(), m = MAIL[id];
  if (!m) return route.fulfill({ status: 404, body: '{}' });
  const parts = []; if (m.text) parts.push({ mimeType: 'text/plain', body: { data: b64(m.text) } }); if (m.html) parts.push({ mimeType: 'text/html', body: { data: b64(m.html) } });
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id, internalDate: String(m.at), payload: { mimeType: 'multipart/alternative', headers: [{ name: 'Subject', value: m.subject }], parts } }) });
}

// ---- the family account server: the real route, on Workers KV in memory ----
const kv = new Map();
const KV = { get: async x => kv.has(x) ? kv.get(x) : null, put: async (x, v) => { kv.set(x, String(v)); }, delete: async x => { kv.delete(x); },
  list: async ({ prefix }) => ({ keys: [...kv.keys()].filter(x => x.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
await KV.put('owner', 'OWNER1');
await putJSON(KV, 'user:OWNER1', { id: 'OWNER1', name: 'Pat Example', role: 'owner', creds: [] });
await putJSON(KV, 'user:SPOUSE1', { id: 'SPOUSE1', name: 'Alex Example', role: 'member', creds: [] });
const session = async (id, name, role) => JSON.stringify({ token: await issue(KV, id), user: { id, name, role }, at: Date.now() });
const PAT = await session('OWNER1', 'Pat Example', 'owner'), ALEX = await session('SPOUSE1', 'Alex Example', 'member');
async function api(route) {
  const req = route.request(), u = new URL(req.url());
  const request = new Request('https://site.example' + u.pathname + u.search, { method: req.method(), headers: req.headers(), body: req.method() === 'POST' ? req.postData() : undefined });
  const res = await onRequest({ request, params: { route: u.pathname.replace(/^\/money\/api\//, '').split('/') }, env: { ACCOUNTS: KV } });
  return route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
}

// ---- the browser ----
const browser = await chromium.launch();
let shot = 0;
const snap = async (p, name) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, pad(++shot) + '-' + name + '.png'), fullPage: true }); };
async function phone({ sess, data, token, look = 'vintage', scheme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: TZ, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.addInitScript(([sess, data, token, look]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('aos.seen', JSON.stringify({ money: '999' }));
    localStorage.setItem('aos.sky', 'day');
    localStorage.setItem('design.money', look);
    if (sess) localStorage.setItem('aos.session', sess);
    if (data) localStorage.setItem('allison-money-v1', data);
    if (token) { localStorage.setItem('money.token', JSON.stringify({ t: 'fake-token', exp: Date.now() + 3600e3, scope: 'https://www.googleapis.com/auth/gmail.readonly' })); localStorage.setItem('money.token.ever', '1'); }
  }, [sess || null, data || null, token || false, look]);
  await ctx.route(/^https:\/\/gmail\.googleapis\.com\//, gmail);
  await ctx.route('**/money/api/**', api);
  await ctx.route('**/aOS/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
  await ctx.route(/^https?:\/\/(?!localhost)(?!gmail\.googleapis\.com)/, r => r.fulfill({ status: 503, body: '' }));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|503/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.exposeFunction('__cspViolation', d => errs.push('csp: ' + d));
  await p.addInitScript(() => document.addEventListener('securitypolicyviolation', e => window.__cspViolation(e.violatedDirective + ' ' + e.blockedURI)));
  await p.goto(BASE + '/money/');
  return { ctx, p, errs };
}
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const view = async (p, name) => { await p.click('#vBtn'); await p.click('#vMenu [data-v="' + name + '"]'); await p.waitForTimeout(150); };
const mainText = p => p.locator('#main').innerText();

// The reader's phone: signed in, Gmail connected, three months already read, and the made-up Rocket card's
// 3% set in Settings (the rates Money starts with are Robinhood's and Customized Cash's).
const A = await phone({ sess: PAT, token: true, data: JSON.stringify({ tx: SEED, alerts: [], hints: [{ name: 'Stream Box', freq: 'Monthly' }], settings: { cards: { 'rocket credit card': { base: 3, online: 0, grocery: 0, cap: 0 } }, dismissed: [], at: 1 }, setDirty: true, mAt: {}, dirty: [ym(-3), ym(-2), ym(-1), ym(0)], seen: [], lastScan: Date.now() - 2 * 3600e3, readAt: 0 }) });
const { p } = A;

await test('reads Monarch’s emails: the alert, the summary’s new one (not its repeat), the can’t-sync email; the newsletter is nothing', async () => {
  await p.waitForFunction(() => window.__money && window.__money.D.alerts.length === 1 && !window.__money.st.reading, null, { timeout: 15000 });
  const D = await p.evaluate(() => window.__money.D);
  const book = D.tx.filter(x => x.merchant === 'Book Nook');
  assert.equal(book.length, 1, 'the summary’s copy of the alert is dropped');
  assert.equal(book[0].account, ROCKET); assert.equal(book[0].mid, '998877665544332211'); assert.equal(book[0].cat, 'Books');
  assert.ok(D.tx.some(x => x.merchant === 'Corner Diner' && x.amt === 15.75 && x.src === 'summary'));
  assert.deepEqual(D.alerts.map(a => [a.inst, a.what]), [['Rocket Bank', 'Access Expired']]);
  assert.deepEqual(D.seen.sort(), ['m1', 'm2', 'm3', 'm4']);
  assert.ok(gmailCalls.some(c => /q=after%3A\d+\+%7Bfrom%3Amonarch\.com/.test(c)), 'asks for what came since the last read, from Monarch: ' + gmailCalls[0]);
});
await test('sends what it read to aOS, a month at a time, and becomes the reader', async () => {
  await p.waitForFunction(() => window.__money.D.dirty.length === 0, null, { timeout: 15000 });
  assert.equal(JSON.parse(kv.get('money:share')).by, 'OWNER1');
  const month = JSON.parse(kv.get('money:tx:' + ym(0)));
  assert.ok(month.items.some(x => x.merchant === 'Book Nook'));
  assert.ok(kv.has('money:tx:' + ym(-3)));
  assert.equal(JSON.parse(kv.get('money:meta')).alerts[0].inst, 'Rocket Bank');
});
await test('This month: the number, the usual, where to save, the categories', async () => {
  await p.waitForSelector('#main .sum');
  const t = await mainText(p);
  assert.match(t, /spent/); assert.match(t, /Usual:/);
  assert.match(t, /Where you could save/i);
  assert.match(t, /Online shopping on\s+Rocket Credit Card \(3%\)/, 'the better card for Amazon');
  assert.match(t, /By category/i); assert.match(t, /Child Care/); assert.match(t, /Mortgage/);
  await snap(p, 'month');
});
await test('the can’t-sync card: Rocket Bank, Fix in Monarch, and Fixed it with Undo', async () => {
  const card = p.locator('#main .alert');
  assert.equal(await card.count(), 1);
  assert.match(await card.innerText(), /Rocket Bank\s+isn’t syncing with Monarch/);
  assert.equal(await card.locator('a.chip').getAttribute('href'), 'https://app.monarch.com/settings/institutions');
  await card.locator('[data-fixed]').click();
  assert.equal(await p.locator('#main .alert').count(), 0);
  await p.click('#toastAct');
  assert.equal(await p.locator('#main .alert').count(), 1, 'Undo brings it back');
  await p.locator('#main .alert [data-fixed]').click();
  await p.waitForFunction(() => !window.__money.D.setDirty, null, { timeout: 10000 });
  assert.deepEqual(JSON.parse(kv.get('money:meta')).settings.dismissed.length, 1, 'shared with whoever sees Money');
});
await test('a category’s transactions, and one transaction', async () => {
  await p.click('#main [data-cat="Child Care"]');
  await p.waitForSelector('#txSheet:not([hidden])');
  assert.match(await p.locator('#txBody').innerText(), /Little Learners/);
  await p.locator('#txBody [data-tx]').first().click();
  const t = await p.locator('#txBody').innerText();
  assert.match(t, /\$391\.50/); assert.match(t, /Rocket Credit Card ···9876/); assert.match(t, /\$11\.75 \(3%\)/, 'cash back at 3%');
  assert.match(t, /Back/);
  await snap(p, 'transaction');
  await p.click('#txBody [data-back]');
  assert.match(await p.locator('#txBody').innerText(), /transactions/);
  await p.click('#txSheet .okbtn');
});
await test('the month before', async () => {
  await p.click('#main [data-act="prev"]');
  assert.match(await p.locator('#main .navrow .lbl').innerText(), new RegExp(new Date(NOW.getFullYear(), NOW.getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'long' })));
  assert.equal(await p.locator('#main .alert').count(), 0);
  await p.click('#main [data-act="next"]');
});
await test('Transactions: by day; search finds any month’s', async () => {
  await view(p, 'activity');
  assert.ok(await p.locator('#main .daylbl').count() > 0);
  await p.fill('#q', 'mortgage');
  await p.waitForTimeout(100);
  assert.equal(await p.locator('#main [data-tx]').count(), 4, 'one a month, across the months');
  assert.match(await mainText(p), /4 transactions/);
  await p.fill('#q', 'zzz');
  assert.match(await mainText(p), /Nothing found/);
  await p.fill('#q', '');
  await snap(p, 'activity');
});
await test('Cards and rewards: per card, the chart and its table, the better card', async () => {
  await view(p, 'cards');
  const t = await mainText(p);
  assert.match(t, /back\s+in/);
  assert.match(t, /Rocket Credit Card/); assert.match(t, /3% on everything/);
  assert.match(t, /6% online, 2% groceries, 1% else/);
  assert.match(t, /Shared Checking/); assert.match(t, /Bank account/);
  assert.ok(await p.locator('#main svg.chart rect[data-k]').count() >= 4, 'stacked columns');
  assert.match(t, /Use the better card/i);
  await p.click('#main details.tview summary');
  assert.match(await p.locator('#main details.tview').innerText(), /Total/);
  await snap(p, 'cards');
});
await test('a card’s rate in Settings changes what it earned', async () => {
  const before = await p.evaluate(() => window.__money.D.tx.length);
  await p.click('#setBtn');
  await p.waitForSelector('#setSheet:not([hidden])');
  const s = await p.locator('#setBody').innerText();
  assert.match(s, /You read Monarch’s emails for the family/); assert.match(s, /Gmail connected/); assert.match(s, /Card rewards/i);
  await snap(p, 'settings');
  const base = p.locator('#setBody input[data-rule="base"][data-key="rocket credit card"]');
  assert.equal(await base.inputValue(), '3');
  await base.fill('2'); await base.dispatchEvent('change');
  await p.click('#setSheet [data-close].iconbtn');
  assert.match(await mainText(p), /2% on everything/);
  assert.equal(await p.evaluate(() => window.__money.D.tx.length), before);
});
await test('Recurring: what repeats, a year of it, and what Monarch named', async () => {
  await view(p, 'repeats');
  const t = await mainText(p);
  assert.match(t, /a year/); assert.match(t, /Little Learners/); assert.match(t, /Weekly/); assert.match(t, /Mortgage Co/); assert.match(t, /Monthly/);
  assert.match(t, /Monarch found these too/i); assert.match(t, /Stream Box/);
  await snap(p, 'repeats');
});
assert.deepEqual(A.errs, []);

// The spouse's phone: signed in, no Gmail.
await test('the spouse sees nothing until it’s shared, then the same months, and no Gmail', async () => {
  const B = await phone({ sess: ALEX, look: 'glass', scheme: 'dark' });
  await B.p.waitForFunction(() => window.__money && window.__money.st.server, null, { timeout: 10000 });
  assert.match(await mainText(B.p), /Pat’s phone reads Monarch’s emails/);
  assert.match(await mainText(B.p), /Ask Pat to share Money with you/);
  // Pat shares it: Settings > Who sees Money
  await view(p, 'month');
  await p.click('#setBtn');
  await p.waitForSelector('#setBody [data-person="SPOUSE1"]');
  await p.click('#setBody [data-person="SPOUSE1"]');
  await p.waitForFunction(() => (window.__money.st.server.with || []).includes('SPOUSE1'), null, { timeout: 10000 });
  await p.click('#setSheet [data-close].iconbtn');
  // Alex opens Money again
  await B.p.reload();
  await B.p.waitForSelector('#main .sum', { timeout: 10000 });
  const D = await B.p.evaluate(() => window.__money.D);
  assert.equal(D.tx.length, await p.evaluate(() => window.__money.D.tx.length));
  assert.equal(await B.p.locator('#readBtn').isHidden(), true, 'no Gmail reading on this phone');
  await B.p.click('#setBtn');
  const s = await B.p.locator('#setBody').innerText();
  assert.match(s, /Pat’s phone reads Monarch’s emails/); assert.doesNotMatch(s, /Connect Gmail/); assert.doesNotMatch(s, /Who sees Money/i);
  assert.match(s, /Card rewards/i, 'the rates are shared: anyone who sees Money may set them');
  await B.p.click('#setSheet [data-close].iconbtn');
  await snap(B.p, 'spouse-glass-dark');
  assert.equal(await B.p.evaluate(() => document.documentElement.dataset.look), 'glass');
  assert.deepEqual(B.errs, []);
  await B.ctx.close();
});

await test('signed out with nothing yet: asks to connect Gmail', async () => {
  const C = await phone({});
  const t = await mainText(C.p);
  assert.match(t, /See where your money goes/);
  assert.equal(await C.p.locator('#main [data-act="connect"]').count(), 1);
  await C.p.click('#setBtn');
  assert.match(await C.p.locator('#setBody').innerText(), /On this phone only/);
  // Settings > Design: Standard, at once
  await C.p.locator('#setBody [data-design="glass"]').click();
  assert.equal(await C.p.evaluate(() => document.documentElement.dataset.look), 'glass');
  assert.equal(await C.p.evaluate(() => localStorage.getItem('design.money')), 'glass');
  await snap(C.p, 'empty');
  assert.deepEqual(C.errs, []);
  await C.ctx.close();
});

await test('Vintage in dark mode draws with no errors', async () => {
  const E = await phone({ data: JSON.stringify({ tx: SEED }), scheme: 'dark' });
  await E.p.waitForSelector('#main .sum');
  for (const v of ['activity', 'cards', 'repeats', 'month']) await view(E.p, v);
  await snap(E.p, 'vintage-dark');
  assert.deepEqual(E.errs, []);
  await E.ctx.close();
});

await A.ctx.close();
await browser.close();
server.close();
console.log(n + ' Money app tests passed');
