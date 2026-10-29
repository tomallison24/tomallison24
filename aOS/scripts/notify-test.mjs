// Notifications in aOS's Account page, as a person uses them at iPhone size: a member
// turns them on (the permission, the phone's subscription, the server told), sends
// and turns them off; on an iPhone not yet on the Home Screen it says
// how to; the owner has a composer that sends one person at a time. The accounts server
// and the phone's push service are stood in for (the server rules are push-api-test.mjs).
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node aOS/scripts/notify-test.mjs [repo root]
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
const KEY = Buffer.alloc(65, 4).toString('base64url');

// a phone whose push service is ours: no network, but the same calls aOS makes
const PHONE = `(() => {
  window.__subs = 0;
  let sub = null;
  const make = () => ({ endpoint: 'https://web.push.apple.com/fake', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'p', auth: 'a' } }; }, unsubscribe: async () => { sub = null; return true; } });
  const fake = { getSubscription: async () => sub, subscribe: async o => { window.__subs++; window.__appKey = o.applicationServerKey.length; sub = make(); return sub; } };
  Object.defineProperty(ServiceWorkerRegistration.prototype, 'pushManager', { get() { return fake; } });
  let perm = 'default';
  Object.defineProperty(Notification, 'permission', { get() { return perm; } });
  Notification.requestPermission = async () => (perm = 'granted');
})();`;

async function open(role, { standalone = true, push = true, acct = true, hash = '' } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const calls = [];
  const user = { id: role === 'owner' ? 'u0' : 'u1', name: role === 'owner' ? 'Tom' : 'Sarah', role, apps: {} };
  const people = [{ id: 'u1', name: 'Sarah', devices: 2 }, { id: 'u2', name: 'Mia Allison', devices: 1 }];
  await ctx.addInitScript(() => { try { localStorage.setItem('aos.seen', JSON.stringify({ aos: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.session', JSON.stringify({ token: 't', user: { id: 'u1', name: 'x', role: 'member' }, at: Date.now() })); } catch {} });
  if (push) await ctx.addInitScript(PHONE); else await ctx.addInitScript('delete window.PushManager;');
  if (standalone) await ctx.addInitScript("Object.defineProperty(navigator, 'standalone', { get: () => true });");
  else await ctx.addInitScript("try { sessionStorage.setItem('aos.later.aos', '1'); } catch {}");   // 'Not now' on how to add aOS
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort();
    if (!u.pathname.startsWith('/aOS/api/')) return r.continue();
    const route = u.pathname.slice('/aOS/api/'.length), J = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    let body = null; try { body = JSON.parse(r.request().postData() || 'null'); } catch {}
    if (route !== 'state' && route !== 'members') calls.push({ route, body });
    if (route === 'state') return J({ storage: true, setup: true, user, plan: null });
    if (route === 'members') return J({ members: [user] });
    if (route === 'push') return J({ key: KEY, devices: 0 });
    if (route === 'push/subscribe') return J({ ok: true, devices: 1 });
    if (route === 'push/unsubscribe') return J({ ok: true, devices: 0 });
    if (route === 'push/audience') return J({ people });
    if (route === 'push/send') return J({ ok: true, sent: body.to === 'u1' ? 2 : 1, failed: 0, gone: 0 });
    if (route === 'family') return J({ family: [] });
    return J({});
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/aOS/' + hash);
  await p.waitForSelector('.tab:not([hidden]) [data-acct]');   // aOS2 opens on Home
  if (acct) {   // Account, then its Notifications fold (every section there is folded until tapped)
    await p.click('.tab:not([hidden]) [data-acct]'); await p.waitForSelector('[aria-controls="fNotify"]', { timeout: 15000 });
    await p.click('[aria-controls="fNotify"]'); await p.waitForSelector('#nBox p, #nBox .swrow', { timeout: 15000 });
  }
  return { ctx, p, calls, errs };
}
const text = (p, sel) => p.locator(sel).first().innerText().catch(() => '');

// 1. a member turns them on, tests, turns off
{
  const { ctx, p, calls, errs } = await open('member'); const pr = [...errs];
  if (await p.getAttribute('#nSw', 'aria-checked').catch(() => null) !== 'false') pr.push('no switch, off');
  if (await p.locator('#nTitle').count()) pr.push('a member sees the composer');
  await p.click('#nSw'); await p.waitForSelector('#nSw[aria-checked="true"]:not([disabled])', { timeout: 8000 }).catch(async () => pr.push('did not turn on: ' + (await text(p, '#nMsg'))));
  const subbed = calls.find(c => c.route === 'push/subscribe');
  if (!subbed || subbed.body.subscription.endpoint !== 'https://web.push.apple.com/fake') pr.push('the server was not told about the phone');
  if (await p.evaluate(() => window.__appKey) !== 65) pr.push('subscribed without the server\'s key');
  if (await p.locator('#nTest').count()) pr.push('a test button: that\'s a developer tool, not part of the app');
  if (/test/i.test(await text(p, '#nBox'))) pr.push('the notifications section mentions a test');
  if (await p.locator('#nSw[aria-checked="true"]').count()) { await p.click('#nSw'); await p.waitForSelector('#nSw[aria-checked="false"]:not([disabled])', { timeout: 5000 }).catch(() => pr.push('did not turn off')); }
  if (!calls.some(c => c.route === 'push/unsubscribe')) pr.push('the server was not told it was off');
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) pr.push('the page scrolls sideways');
  report('a member turns notifications on and off (and there is no test button)', pr); await ctx.close();
}

// 2. iPhone, not on the Home Screen
{
  const { ctx, p, errs } = await open('member', { standalone: false, push: false }); const pr = [...errs];
  const t = await text(p, '#nBox');
  if (!/Home Screen/.test(t)) pr.push('does not say to add aOS to the Home Screen: ' + t);
  if (await p.locator('#nSw').count()) pr.push('offers a switch that cannot work');
  report('on an iPhone not yet on the Home Screen it says how', pr); await ctx.close();
}

// 3. the owner's composer
{
  const { ctx, p, calls, errs } = await open('owner'); const pr = [...errs];
  await p.waitForSelector('#tToggle');
  if (!(await p.locator('#nGo').isHidden())) pr.push('the owner tools are open before Owner tools is tapped');
  await p.click('#tToggle');
  await p.waitForSelector('#nGo'); await p.waitForFunction(() => /Goes to/.test(document.getElementById('nWho').textContent), null, { timeout: 5000 }).catch(() => pr.push('no audience: ' + '?'));
  const who = await text(p, '#nWho');
  if (!/Sarah, Mia \(3 phones\)/.test(who)) pr.push('audience says: ' + who);
  await p.click('#nGo'); if (!/title/i.test(await text(p, '#nErr'))) pr.push('sent without a title');
  await p.click('#nFill');
  // Announce the update: "aOS updated to 1.x", "Click for update details.", and a tap opens the Updates screen
  const ver = await p.evaluate(() => AllisonOS.welcome.data.RELEASES.find(r => !r.silent).v);
  if (await p.inputValue('#nTitle') !== 'aOS updated to ' + ver || await p.inputValue('#nBody') !== 'Click for update details.') pr.push('Announce the update filled "' + await p.inputValue('#nTitle') + '" / "' + await p.inputValue('#nBody') + '"');
  await p.click('#nGo'); await p.waitForFunction(() => /Sent to 3 phones/.test(document.getElementById('nErr').textContent), null, { timeout: 8000 }).catch(() => pr.push('the announcement did not send'));
  const ann = calls.filter(c => c.route === 'push/send');
  if (ann.length !== 2 || ann.some(c => c.body.url !== './#whats-new')) pr.push('the announcement does not open the Updates screen: ' + ann.map(c => c.body.url));
  calls.length = 0;
  await p.fill('#nTitle', 'Hello family'); await p.fill('#nBody', 'Notifications are on.');
  await p.click('#nGo');
  await p.waitForFunction(() => /Sent to 3 phones/.test(document.getElementById('nErr').textContent), null, { timeout: 8000 }).catch(async () => pr.push('result says: ' + (await text(p, '#nErr'))));
  const sends = calls.filter(c => c.route === 'push/send');
  if (sends.map(s => s.body.to).join() !== 'u1,u2') pr.push('sent to ' + sends.map(s => s.body.to).join() + ', not each person in turn');
  if (sends.some(s => s.body.url !== './')) pr.push('a message of your own opens the Updates screen');
  if (sends.some(s => s.body.title !== 'Hello family' || s.body.body !== 'Notifications are on.')) pr.push('the message changed on the way');
  report('the owner writes a notification and it goes out person by person', pr); await ctx.close();
}

// 4. the Updates screen is told simply, and a tap on a notification takes you there
{
  const { ctx, p, errs } = await open('member', { acct: false }); const pr = [...errs];
  await p.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { aosGo: '#whats-new' } })));
  await p.waitForSelector('#rels', { timeout: 5000 }).catch(() => pr.push('a tap on a notification (while aOS is open) did not open the Updates screen'));
  const r = await p.evaluate(() => { const top = AllisonOS.welcome.data.RELEASES.filter(x => !x.silent)[0]; return { items: document.querySelectorAll('#rels .rel:first-child li').length, want: top.highlights.length, apps: document.querySelectorAll('#rels h5').length, words: Math.max(...[...document.querySelectorAll('#rels li')].map(l => l.textContent.split(/\s+/).length)) }; });
  const rels = await p.locator('#rels .rel').count();
  if (rels !== 1) pr.push('the Updates screen shows ' + rels + ' versions: only the latest belongs there');
  if (r.items !== r.want) pr.push('the newest release shows ' + r.items + ' lines, not its ' + r.want + ' highlights');
  if (r.apps) pr.push('the Updates screen has per-app details');
  if (r.words > 20) pr.push('a line is ' + r.words + ' words: updates should be simple');
  // an app's own page tells it the same way: the highlights, not the details
  await p.evaluate(() => document.querySelector('.page .close').click()); await p.waitForTimeout(500);
  await p.fill('#hq', 'news'); await p.click('#hfound .hinfo[data-app="news"]');   // found in the Ipsy bar, its i
  await p.waitForSelector('.wn li', { timeout: 5000 });
  const wn = await p.evaluate(() => { const r = AllisonOS.welcome.data.RELEASES.find(x => !x.silent && x.apps && x.apps.news); const e = AllisonOS.welcome.data.entry(r.apps.news); return { shown: document.querySelectorAll('.wn li').length, want: (e.highlights.length ? e.highlights : e.notes).slice(0, 5).length, notes: e.notes.length }; });
  if (await p.locator('[data-hist]').count()) pr.push('an app page offers Version History: only the latest version is told');
  if (wn.shown !== wn.want) pr.push('News\'s page shows ' + wn.shown + ' lines, not its ' + wn.want + ' highlights (it has ' + wn.notes + ' notes)');
  report('the Updates screen is high level, and a notification tap opens it', pr); await ctx.close();
}
{
  const { ctx, p, errs } = await open('member', { acct: false, hash: '#whats-new' }); const pr = [...errs];
  await p.waitForSelector('#rels', { timeout: 5000 }).catch(() => pr.push('opening aOS from a notification (#whats-new) did not show the Updates screen'));
  report('opening aOS from a notification shows the Updates screen', pr); await ctx.close();
}

await b.close(); server.close();
process.exit(failed ? 1 : 0);
