// An app removed from an Android tablet: aOS stops saying Installed. Android Chrome can tell
// a page whether its own app is installed (navigator.getInstalledRelatedApps, from the
// manifest's related_applications), so an app opened in a Chrome tab - where aOS's Installed
// button takes you once the app is gone - tells the family account either way (home/welcome.js
// androidCheck). Runs the real accounts API on an in-memory KV, with Chrome's call stood in for
// (headless Chromium has no installed apps, so what a real tablet answers is not tested here).
//   node aOS/scripts/android-installed-test.mjs [repo root]
import { createRequire } from 'module'; import { execSync } from 'child_process'; import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/'); const { chromium } = require('playwright');
const R = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(R, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, r)); const BASE = 'http://localhost:' + server.address().port;
const { onRequest } = await import(path.join(R, 'functions/aOS/api/[[route]].js'));
const { issue, putJSON } = await import(path.join(R, 'server/auth.js'));
const m = new Map();
const db = { get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, String(v)); }, delete: async k => { m.delete(k); },
  list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
await db.put('owner', 'O1'); await putJSON(db, 'user:O1', { id: 'O1', name: 'Tom', role: 'owner', creds: [], created: Date.now() - 864e5 });
const tok = await issue(db, 'O1');
const setApps = o => db.put('apps:O1', JSON.stringify(o));
const getApps = async () => JSON.parse((await db.get('apps:O1')) || '{}');
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const b = await chromium.launch();
let failed = 0;
const report = (name, problems) => { if (problems.length) { failed++; console.log('not ok - ' + name + '\n  ' + problems.join('\n  ')); } else console.log('ok - ' + name); };

// a Chrome tab on the app's own page; `answer` is what Chrome says (null: it has no such call)
async function tab(app, { ua = ANDROID, answer = [], signed = true, store } = {}) {
  const ctx = await b.newContext({ viewport: { width: 800, height: 1100 }, userAgent: ua, serviceWorkers: 'block' });
  let calls = 0, posts = [];
  await ctx.exposeFunction('__asked', () => { calls++; });
  await ctx.addInitScript(([app, t, answer, signed, store]) => {
    try { localStorage.setItem('aos.seen', JSON.stringify({ [app]: '999' })); localStorage.setItem('aos.signin.asked', '1'); sessionStorage.setItem('aos.later.' + app, '1'); } catch {}
    if (signed) localStorage.setItem('aos.session', JSON.stringify({ token: t, user: { id: 'O1', name: 'Tom', role: 'owner' }, at: Date.now() }));
    for (const [k, v] of Object.entries(store || {})) localStorage.setItem(k, v);
    if (answer) navigator.getInstalledRelatedApps = async () => { window.__asked(); return answer; };
    else Object.defineProperty(navigator, 'getInstalledRelatedApps', { value: undefined });   // a browser without the call
  }, [app, tok, answer, signed, store]);
  await ctx.route('**/aOS/api/**', async route => { const rq = route.request(), u = new URL(rq.url());
    if (rq.method() === 'POST' && u.pathname.endsWith('/installed')) posts.push(rq.postData());
    const res = await onRequest({ request: new Request(u.href, { method: rq.method(), headers: rq.headers(), body: rq.method() === 'POST' ? rq.postData() : undefined }), params: { route: u.pathname.split('/aOS/api/')[1].split('/') }, env: { ACCOUNTS: db } });
    route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/' + app + '/?via=aos'); await p.waitForTimeout(1500);
  return { ctx, p, errs, calls: () => calls, posts };
}

// 1. removed from the tablet: Chrome finds nothing, the account says gone, and aOS shows Get
{
  await setApps({ house: Date.now() - 864e5, mail: Date.now() - 864e5 });
  const t = await tab('house', { answer: [] }); const pr = [...t.errs];
  if (t.calls() !== 1) pr.push('Chrome was asked ' + t.calls() + ' times, not once');
  const a = await getApps();
  if (a.house !== 0) pr.push('house is ' + a.house + ', not 0 (gone)');
  if (!(a.mail > 0)) pr.push('mail, which was not asked about, changed to ' + a.mail);
  await t.ctx.close();
  // and aOS, opened after, shows Get for it and Installed for Mail
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: ANDROID, serviceWorkers: 'block' });
  await ctx.addInitScript(t => { localStorage.setItem('aos.seen', JSON.stringify({ aos: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.session', JSON.stringify({ token: t, user: { id: 'O1', name: 'Tom', role: 'owner' }, at: Date.now() })); sessionStorage.setItem('aos.later.aos', '1'); }, tok);
  await ctx.route('**/aOS/api/**', async route => { const rq = route.request(), u = new URL(rq.url());
    const res = await onRequest({ request: new Request(u.href, { method: rq.method(), headers: rq.headers(), body: rq.method() === 'POST' ? rq.postData() : undefined }), params: { route: u.pathname.split('/aOS/api/')[1].split('/') }, env: { ACCOUNTS: db } });
    route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() }); });
  const p = await ctx.newPage(); await p.goto(BASE + '/aOS/'); await p.waitForSelector('[data-tab="apps"]'); await p.click('[data-tab="apps"]'); await p.waitForSelector('#list .row'); await p.waitForTimeout(800);
  const label = id => p.locator(`#list .row[data-app="${id}"] [data-get]`).first().innerText().catch(() => '(no button)');
  if (!/Get/.test(await label('house'))) pr.push('aOS still says Home is ' + await label('house'));
  if (!/Installed/.test(await label('mail'))) pr.push('aOS says Mail is ' + await label('mail'));
  await ctx.close();
  report('an app removed from an Android tablet: opened in Chrome it says so, and aOS shows Get', pr);
}

// 2. still installed, opened in a Chrome tab: the account says installed (even if it had said gone)
{
  await setApps({ house: 0 });
  const t = await tab('house', { answer: [{ platform: 'webapp', id: 'x' }] }); const pr = [...t.errs];
  if (!((await getApps()).house > 0)) pr.push('house is not marked installed');
  await t.ctx.close(); report('an installed app opened in a Chrome tab is marked installed', pr);
}

// 3. never installed: nothing is written
{
  await setApps({});
  const t = await tab('mail', { answer: [] }); const pr = [...t.errs];
  if ('mail' in (await getApps())) pr.push('mail was written: ' + JSON.stringify(await getApps()));
  await t.ctx.close(); report('an app that was never installed writes nothing', pr);
}

// 4. asked at most every 20 minutes
{
  await setApps({ house: Date.now() });
  const t = await tab('house', { answer: [], store: { 'aos.ir.house': String(Date.now() - 60e3) } }); const pr = [...t.errs];
  if (t.calls()) pr.push('Chrome was asked again a minute later');
  if (t.posts.length) pr.push('it told the account again');
  await t.ctx.close(); report('Chrome is asked at most every 20 minutes', pr);
}

// 5. quiet when it can't tell: signed out, a Chrome without the call, an iPad
{
  await setApps({ house: Date.now() - 864e5 });
  const pr = [];
  for (const [what, o] of [['signed out', { signed: false, answer: [] }], ['no getInstalledRelatedApps', { answer: null }], ['an iPad', { ua: IPAD, answer: [] }]]) {
    const t = await tab('house', o); pr.push(...t.errs.map(e => what + ': ' + e));
    if (t.posts.length) pr.push(what + ': told the account ' + t.posts.join());
    if (what === 'an iPad' && t.calls()) pr.push('an iPad asked Chrome');
    await t.ctx.close();
  }
  if (!((await getApps()).house > 0)) pr.push('house was changed: ' + (await getApps()).house);
  report('signed out, no call, or an iPad: it stays quiet and changes nothing', pr);
}

await b.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed'); process.exit(failed ? 1 : 0);
