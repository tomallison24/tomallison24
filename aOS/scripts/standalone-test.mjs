// Every app on its own: users may want only some of the core apps, so each app
// must work with nothing from any other - its own empty storage, no other app's
// data, no outside services - signed out and signed in (the real accounts and
// Drinks API code on an in-memory KV). Fails on any script error, and on any
// request to another app's folder other than the shared pieces every app may use:
// the accounts API (/aOS/api/), Drinks' summary for signed-in Fitness/Calendar
// (/drinks/api/), Weather's forecast code for Home (/weather/data.js), and the app
// icons aOS shows.
//   node aOS/scripts/standalone-test.mjs [repo root]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const R = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(R, p);
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;
const { onRequest } = await import(path.join(R, 'functions/aOS/api/[[route]].js'));
const { onRequest: drinksApi } = await import(path.join(R, 'functions/drinks/api/[[route]].js'));
const { issue, putJSON } = await import(path.join(R, 'server/auth.js'));
const m = new Map();
const db = { get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, String(v)); }, delete: async k => { m.delete(k); },
  list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
await db.put('owner', 'O1'); await putJSON(db, 'user:O1', { id: 'O1', name: 'Tom', role: 'owner', creds: [], created: Date.now() - 864e5 });
const tok = await issue(db, 'O1');
const APPS = ['mail', 'calendar', 'news', 'weather', 'notes', 'podcasts', 'travel', 'places', 'fitness', 'drinks', 'meals', 'house', 'aOS'];
const b = await chromium.launch();
const SHARED = p => /^\/aOS\/api\//.test(p) || /^\/drinks\/api\//.test(p) || p === '/weather/data.js' || /^\/[a-z]+\/icon-(180|512)\.png$/.test(p);
const out = [];
for (const app of APPS) for (const signed of [false, true]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: 'block', geolocation: { latitude: 39.74, longitude: -104.99 }, permissions: ['geolocation'] });
  const reqs = [], errs = [];
  await ctx.route('**/aOS/api/**', async route => { const rq = route.request(), u = new URL(rq.url());
    const res = await onRequest({ request: new Request(u.href, { method: rq.method(), headers: rq.headers(), body: rq.method() === 'POST' ? rq.postData() : undefined }), params: { route: u.pathname.split('/aOS/api/')[1].split('/') }, env: { ACCOUNTS: db } });
    route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() }); });
  await ctx.route('**/drinks/api/**', async route => { const rq = route.request(), u = new URL(rq.url());
    const res = await drinksApi({ request: new Request(u.href, { method: rq.method(), headers: rq.headers(), body: rq.method() === 'POST' ? rq.postData() : undefined }), params: { route: u.pathname.split('/drinks/api/')[1].split('?')[0].split('/') }, env: { ACCOUNTS: db } });
    route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() }); });
  await ctx.route(/^https?:\/\/(?!localhost)/, route => route.fulfill({ status: 503, body: '' }));   // no outside services: the app alone
  await ctx.addInitScript(([app, t]) => {
    localStorage.setItem('aos.seen', JSON.stringify({ [app.toLowerCase()]: '999' })); localStorage.setItem('aos.signin.asked', '1');
    if (t) localStorage.setItem('aos.session', JSON.stringify({ token: t, user: { id: 'O1', name: 'Tom', role: 'owner' }, at: Date.now() }));
  }, [app, signed ? tok : null]);
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', msg => { if (msg.type() === 'error' && !/Failed to load resource|net::ERR/.test(msg.text())) errs.push('console: ' + msg.text().slice(0, 140)); });
  pg.on('response', r => { const u = new URL(r.url()); if (u.hostname === 'localhost') { const first = u.pathname.split('/')[1]; if (first !== app && first !== 'home' && !(app === 'aOS' && first === 'aOS')) reqs.push(r.status() + ' ' + u.pathname); } });
  await pg.goto(BASE + '/' + app + '/'); await pg.waitForTimeout(2500);
  out.push({ app, signed, errs, reqs: [...new Set(reqs)] });
  await ctx.close();
}
await b.close();
server.close();
let bad = 0;
for (const r of out) {
  const odd = r.reqs.filter(x => !SHARED(x.split(' ')[1]));
  const okRun = !r.errs.length && !odd.length;
  if (!okRun) bad++;
  console.log((okRun ? 'ok - ' : 'not ok - ') + r.app + (r.signed ? ', signed in' : ', signed out') + (r.errs.length ? '  errors: ' + r.errs.join(' | ') : '') + (odd.length ? '  needs another app: ' + odd.join(', ') : ''));
}
console.log(`${out.length - bad} of ${out.length} passed`);
if (bad) process.exit(1);
