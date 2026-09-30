// Drives Notes in headless Chromium against a stubbed Google Sheet and a
// stubbed notification server (notes/push): the bell and its sheet, turning
// notifications on (what the phone sends the server), choosing lists, the
// per-reminder Alert choice, the ping after a sync, a test notification,
// opening the app from a notification, and turning them off. The browser's
// push service is stubbed too: headless Chromium can't reach Apple's.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node notes/scripts/push-app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? '  — ' + extra : '')); };

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
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

const SHEET = 'https://script.google.com/macros/s/AKfycbTEST/exec';
const PUSH = 'https://notes-push.test.workers.dev';
const KEY = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
const today = new Date(); const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const tomorrow = ymd(new Date(today.getTime() + 864e5));
const seed = {
  notes: [{ id: 'n1', title: 'Book the dentist', body: 'Call Dr Lee', tags: [], color: 'none', pinned: false, reminder: new Date(Date.now() + 3600e3).toISOString(), created: 1, updated: 1, archived: false, deletedAt: null }],
  lists: [{ id: 'l1', updated: 1, name: 'Personal', color: '#3B82F6' }, { id: 'l3', updated: 1, name: 'Groceries', color: '#10B981' }],
  todos: [
    { id: 't1', list: 'l1', title: 'Pick up Sofia', notes: '', date: tomorrow, time: '17:30', prio: 0, flagged: false, done: false, doneAt: null, tags: [], created: 1, updated: 1 },
    { id: 't2', list: 'l3', title: 'Milk', notes: '', date: tomorrow, time: null, prio: 0, flagged: false, done: false, doneAt: null, tags: [], created: 2, updated: 1 },
  ],
};

const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? undefined : undefined });
const ctx = await browser.newContext({ timezoneId: 'America/New_York', locale: 'en-US', viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
const calls = [];
let sheetItems = null;
await ctx.route(SHEET, async route => {
  const b = JSON.parse(route.request().postData() || '{}');
  if (b.todos) sheetItems = { notes: b.notes, todos: b.todos, lists: b.lists };
  calls.push({ to: 'sheet', action: b.action });
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, app: 'allison-notes-sync', v: 1, ...(sheetItems || seed), graves: {} }) });
});
await ctx.route(PUSH + '/**', async route => {
  const r = route.request(), p = new URL(r.url()).pathname;
  const cors = { 'Access-Control-Allow-Origin': BASE, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  if (p === '/key') return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ app: 'notes-push', key: KEY }) });
  calls.push({ to: 'push', path: p, body: JSON.parse(r.postData() || '{}') });
  return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
});
// The browser's side of push: permission granted, and a subscription as an
// iPhone would make one (headless Chromium has no push service to ask).
await ctx.addInitScript(() => {
  let sub = null;
  const make = key => ({
    endpoint: 'https://web.push.apple.com/QGuQyavXutnMH8', options: { applicationServerKey: key.buffer },
    toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'BPcMbnWQL5GOYX_5LY9EV8zNrxyvj0a3F5fVJUR2oILcDXEe1B8QwNrJ3Y3yK7CQ4FTRxVn0ZqEY7aR-nMEZs3Y', auth: 'x5NYbD0rPs_ceL2Ey1GnAQ' } }; },
    unsubscribe: async () => { sub = null; localStorage.removeItem('test-sub'); return true; },
  });
  // Kept across page loads, as the browser keeps a real one.
  const kept = localStorage.getItem('test-sub');
  if (kept) sub = make(Uint8Array.from(JSON.parse(kept)));
  PushManager.prototype.getSubscription = async function () { return sub; };
  PushManager.prototype.subscribe = async function (o) { const k = new Uint8Array(o.applicationServerKey); localStorage.setItem('test-sub', JSON.stringify([...k])); sub = make(k); return sub; };
  Notification.requestPermission = async () => 'granted';
  Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true });
});

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(BASE + '/notes/');
await page.evaluate(({ seed, SHEET }) => {
  localStorage.setItem('allison-notes-v1', JSON.stringify(seed));
  localStorage.setItem('allison-notes-v1-sync', JSON.stringify({ url: SHEET, secret: 'maple-otter' }));
  localStorage.setItem('allison-notes-v1-tab', 'rem');
}, { seed, SHEET });
await page.reload();
await page.waitForTimeout(1500);
const upcoming = async () => { await page.click('#seg [data-view="upcoming"]'); await page.waitForTimeout(300); };
await upcoming();

// ---- the bell ----
ok('bell in the Reminders header, no dot while off', await page.isVisible('#remBellBtn') && await page.isHidden('#remBellDot'));
ok('reminder rows show the clock while notifications are off', await page.locator('.todo').first().locator('.tchip.bare svg circle').count() === 1);
await page.click('#remBellBtn');
ok('the sheet explains, and asks for the server address', (await page.textContent('#puStatus')).includes('even with Notes closed') && await page.isVisible('#puServer'));
await page.click('#puOn');
ok('no address: says what to enter, sends nothing', (await page.textContent('#puStatus')).includes('workers.dev') && !calls.some(c => c.to === 'push'));
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '1-off.png') });
await page.fill('#puServer', PUSH + '/');
await page.click('#puOn');
await page.waitForTimeout(800);
const sub1 = calls.find(c => c.path === '/subscribe');
ok('turning on: subscribes with the Sheet link, secret, time zone and choices', sub1 && sub1.body.sheet.url === SHEET && sub1.body.sheet.secret === 'maple-otter'
  && sub1.body.prefs.tz === 'America/New_York' && sub1.body.prefs.morning === '09:00' && sub1.body.prefs.nudges === true && sub1.body.subscription.endpoint.startsWith('https://web.push.apple.com/'), JSON.stringify(sub1 && sub1.body.prefs));
ok('the sheet now shows the lists, nudges and the morning time', await page.isVisible('#puOnBox') && await page.locator('#puLists [data-pl]').count() === 2 && await page.isVisible('#remBellDot'));
await page.click('#puLists [data-pl="l3"]');
await page.waitForTimeout(1100);
const sub2 = calls.filter(c => c.path === '/subscribe').at(-1);
ok('switching off Groceries is sent to the server', sub2 !== sub1 && JSON.stringify(sub2.body.prefs.skip) === '["l3"]');
await page.fill('#puMorning', '07:30'); await page.dispatchEvent('#puMorning', 'change');
await page.waitForTimeout(1100);
ok('the morning time is sent too', calls.filter(c => c.path === '/subscribe').at(-1).body.prefs.morning === '07:30');
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '2-on.png') });
await page.click('#puTest');
await page.waitForTimeout(400);
ok('Send a test asks the server for this phone only', calls.at(-1).path === '/test' && calls.at(-1).body.endpoint.startsWith('https://web.push.apple.com/'));
await page.click('#pushSheet .okbtn[data-close]');
await page.waitForTimeout(400);

// ---- the rows and the Alert choice ----
const bells = await page.evaluate(() => [...document.querySelectorAll('.todo')].map(r => r.querySelector('.tbody .t').textContent + ':' + (r.querySelector('.tchip.bare svg path[d^="M6 10.8"]') ? 'bell' : 'clock')));
ok('rows: a bell where this phone will be alerted (not Groceries)', bells.includes('Pick up Sofia:bell') && bells.includes('Milk:clock'), bells.join(', '));
await page.click('[data-todo="t1"]');
await page.waitForTimeout(400);
const opts = await page.locator('#tdAlert [data-a]').allTextContents();
ok('a reminder with a time: alert choices from At time to 1 week before, and None', opts[0] === 'At time' && opts.includes('15 min before') && opts.at(-1) === 'None', opts.join(' / '));
ok('"At time" is chosen by default', await page.getAttribute('#tdAlert [data-a="0"]', 'aria-checked') === 'true');
await page.click('#tdAlert [data-a="15"]');
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '3-alert.png') });
const before = calls.filter(c => c.path === '/refresh').length;
await page.click('#tdDone');
await page.waitForTimeout(3500);
const t1 = await page.evaluate(() => JSON.parse(localStorage.getItem('allison-notes-v1')).todos.find(t => t.id === 't1'));
ok('the choice is saved on the reminder', t1.alert === 15);
ok('it reached the Sheet', sheetItems && sheetItems.todos.find(t => t.id === 't1').alert === 15);
ok('after the sync, the server is pinged to read the Sheet again', calls.filter(c => c.path === '/refresh').length === before + 1);
await page.click('[data-todo="t1"]');
await page.fill('#tdTime', ''); await page.dispatchEvent('#tdTime', 'change');
const dayOpts = await page.locator('#tdAlert [data-a]').allTextContents();
ok('without a time: On the day / days before / None, and the hint names 7:30', dayOpts[0] === 'On the day' && dayOpts.at(-1) === 'None' && (await page.textContent('#tdAlertHint')).includes('7:30'), dayOpts.join(' / ') + ' | ' + await page.textContent('#tdAlertHint'));
await page.click('#tdDone');
await page.waitForTimeout(300);
await page.click('[data-todo="t2"]');
ok('a Groceries reminder says this phone won\'t alert for it', (await page.textContent('#tdAlertHint')).includes('doesn’t get alerts for Groceries'));
await page.click('#tdDone');

// ---- opening from a notification ----
await page.goto(BASE + '/notes/?open=' + encodeURIComponent('todo:t2'));
await page.waitForTimeout(1000);
ok('?open=todo:… opens that reminder, and the address is tidied', await page.isVisible('#todoSheet') && await page.inputValue('#tdTitle') === 'Milk' && !page.url().includes('open='));
await page.click('#tdDone');
await page.evaluate(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready);
await page.evaluate(() => { const ev = new MessageEvent('message', { data: { open: 'note:n1' } }); navigator.serviceWorker.dispatchEvent(ev); });
await page.waitForTimeout(600);
ok('a tap while the app is open (message from the service worker) opens the note', await page.isVisible('#editor') && await page.inputValue('#edTitle') === 'Book the dentist');
await page.click('#edBack');
await page.waitForTimeout(300);
await page.goto(BASE + '/notes/?open=' + encodeURIComponent('todo:nope'));
await page.waitForTimeout(1500);
ok('a reminder that isn\'t there: syncs, then says so', calls.filter(c => c.to === 'sheet').length > 1 && (await page.textContent('#toastMsg')).includes('isn’t here any more'));

// ---- the service worker's push and click handlers ----
const sw = fs.readFileSync(path.join(ROOT, 'notes/sw.js'), 'utf8');
ok('the service worker shows every push and opens ?open= on a tap', /addEventListener\('push'/.test(sw) && /showNotification/.test(sw) && /\?open=/.test(sw));

// ---- off ----
await page.click('.tab[data-tab="rem"]');
await page.click('#remBellBtn');
await page.click('#puOffBtn');
await page.waitForTimeout(500);
ok('turning off: unsubscribes at the server, the dot goes', calls.at(-1).path === '/unsubscribe' && await page.isHidden('#remBellDot'));

ok('no errors on the page', errors.length === 0, errors.join(' | '));
await browser.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
