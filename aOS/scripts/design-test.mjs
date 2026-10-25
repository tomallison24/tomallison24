// home/design.js, shared by every app (Clock has its own clock/design.js), at iPhone size:
//   - every app loads it in <head> with its own data-app, and the old Vintage app's id, keys and
//     databases (data-was, data-keys, data-dbs), with a <style id="vintage"> to switch;
//   - every app opens in Vintage, and in Standard, Night Drive or Folk when design.<app> says so, with
//     the matching blocks (Night Drive and Folk keep Vintage on under their own), icon, status bar and
//     bar colour, and no script errors any way; a change aOS makes (design.<app> written while the app
//     is open) is followed at once, and Settings > Design offers all four;
//   - at an old Vintage address (the deploy copies the app there, news.yml), the old app's data is
//     moved over once: localStorage by prefix, what it had seen, and its IndexedDB databases, store by
//     store; never when the app already has data of its own on the phone.
// Each app's own test covers its Settings > Design and its own data (meals/scripts/app-test.mjs and the rest).
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node aOS/scripts/design-test.mjs [repo root]
import { createRequire } from 'module'; import { execSync } from 'child_process'; import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/'); const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  p = p.replace(/^\/([a-z]+)vintage\//, '/$1/');   // an old Vintage app's address: a copy of the app (news.yml)
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r)); const BASE = 'http://localhost:' + server.address().port;
const b = await chromium.launch();
let failed = 0;
const report = (name, problems) => { if (problems.length) { failed++; console.log('not ok - ' + name + '\n  ' + problems.join('\n  ')); } else console.log('ok - ' + name); };

const W = fs.readFileSync(path.join(ROOT, 'home/welcome.js'), 'utf8');
const APPS = Function('return ' + /const APPS = (\[[^\]]*\])/.exec(W)[1])().filter(a => a !== 'clock');
const tag = id => /<script\s+src="\.\.\/home\/design\.js"([^>]*)>/.exec(fs.readFileSync(path.join(ROOT, id, 'index.html'), 'utf8'));
const attrs = s => Object.fromEntries([...s.matchAll(/data-(\w+)="([^"]*)"/g)].map(m => [m[1], m[2]]));

async function phone(scheme, seed) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.route('**/*', r => { const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort(); if (u.pathname.includes('/api/')) return r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); return r.continue(); });
  await ctx.addInitScript(seed => { if (sessionStorage.getItem('seeded')) return; for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); }, seed);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  return { ctx, p, errs };
}

// 1. every app is wired to it
// (an app made after the Vintage apps were folded in, BORN, has no old Vintage app to move data from)
const BORN = ['sparkle', 'money'];
{
  const pr = [];
  for (const id of APPS) {
    const t = tag(id); if (!t) { pr.push(id + ' does not load ../home/design.js'); continue; }
    const a = attrs(t[1]);
    if (a.app !== id) pr.push(id + ': data-app is ' + a.app);
    if (BORN.includes(id)) { if (a.was || a.keys) pr.push(id + ' never had a Vintage app of its own, so nothing to move: no data-was or data-keys'); }
    else {
      if (a.was !== id + 'vintage') pr.push(id + ': data-was is ' + a.was + ', not ' + id + 'vintage');
      if (!a.keys || !a.keys.split(',').every(x => /^[^=,\s]+=[^=,\s]+$/.test(x.trim()))) pr.push(id + ': data-keys should be old=new prefixes: ' + a.keys);
    }
    if (a.dbs && !a.dbs.split(',').every(x => /^[^=,\s]+=[^=,\s]+$/.test(x.trim()))) pr.push(id + ': data-dbs should be old=new names: ' + a.dbs);
    if (!/<style id="vintage">/.test(fs.readFileSync(path.join(ROOT, id, 'index.html'), 'utf8'))) pr.push(id + ' has no <style id="vintage">');
  }
  report('every app loads ../home/design.js with its old Vintage app\'s id, keys and databases', pr);
}

// 2. every app in each design, light and dark: the right look, icon, status bar and bar colour, no script errors
const NAME = { vintage: 'Vintage', glass: 'Standard', neon: 'Night Drive', folk: 'Folk', grid: 'Grid' };
for (const [design, scheme] of [['vintage', 'light'], ['glass', 'dark'], ['neon', 'dark'], ['folk', 'light'], ['grid', 'dark']]) {
  const pr = [];
  for (const id of APPS) {
    const seed = { 'aos.seen': JSON.stringify({ [id]: '999' }), 'aos.signin.asked': '1', 'aos.sky': 'day' };
    if (design !== 'vintage') seed['design.' + id] = design;
    const { ctx, p, errs } = await phone(scheme, seed);
    await p.goto(BASE + '/' + id + '/'); await p.waitForTimeout(700);
    const st = await p.evaluate(() => ({ look: document.documentElement.dataset.look, media: (document.getElementById('vintage') || {}).media, own: ['neon', 'folk', 'grid'].map(k => (document.getElementById(k) || {}).media).join(),
      icon: (document.querySelector('link[rel="apple-touch-icon"]') || {}).href || '', bar: (document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') || {}).content }));
    const glass = design === 'glass';
    if (st.look !== design) pr.push(`${id}: data-look ${st.look}`);
    if (st.media !== (glass ? 'not all' : 'all')) pr.push(`${id}: the Vintage styles are "${st.media}"`);
    if (st.own !== ['neon', 'folk', 'grid'].map(k => k === design ? 'all' : 'not all').join()) pr.push(`${id}: the Night Drive, Folk and Grid blocks are "${st.own}"`);
    if (!new RegExp(`/icon-${design === 'vintage' ? '' : design + '-'}180\\.png`).test(st.icon)) pr.push(`${id}: icon ${st.icon}`);
    const own = (/name="apple-mobile-web-app-status-bar-style" content="([^"]+)"/.exec(fs.readFileSync(path.join(ROOT, id, 'index.html'), 'utf8')) || [])[1];   // Standard keeps the page's own (Mail's is default)
    if (st.bar !== (glass ? own : 'default')) pr.push(`${id}: status bar ${st.bar}`);
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) pr.push(`${id}: the page scrolls sideways`);
    pr.push(...errs.map(e => id + ': ' + e));
    await ctx.close();
  }
  report(`every app in ${NAME[design]} (${scheme}): look, icon, status bar, no script errors`, pr);
}

// 2b. aOS picks a look for every app (aOS/look.js writes design.<app>): an app open in another frame follows at once;
// and its Settings > Design rows offer all five
{
  const pr = [];
  const { ctx, p, errs } = await phone('light', { 'aos.seen': JSON.stringify({ meals: '999' }), 'aos.signin.asked': '1', 'aos.sky': 'day' });
  await p.goto(BASE + '/meals/'); await p.waitForTimeout(500);
  const other = await ctx.newPage(); await other.goto(BASE + '/meals/'); await other.waitForTimeout(300);
  await other.evaluate(() => localStorage.setItem('design.meals', 'neon'));   // what aOS's Appearance does
  await p.waitForTimeout(300);
  if (await p.evaluate(() => document.documentElement.dataset.look + '/' + document.getElementById('neon').media) !== 'neon/all') pr.push('an open app did not follow a look written elsewhere: ' + await p.evaluate(() => document.documentElement.dataset.look));
  const rows = await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = aosDesign.picker(); return [...d.querySelectorAll('[data-design]')].map(b => b.dataset.design).join(); });
  if (rows !== 'vintage,glass,neon,folk,grid') pr.push('Settings > Design offers ' + rows);
  pr.push(...errs);
  report('a look aOS writes is followed at once by an open app; Settings > Design offers all five', pr); await ctx.close();
}

// 3. the move at an old address: localStorage by prefix, what it had seen, IndexedDB store by store; once only
{
  const pr = [];
  const { ctx, p, errs } = await phone('light', {});
  // the old Meals Vintage's data, as a phone that added it has it (written from the same origin first)
  await p.goto(BASE + '/home/');
  await p.evaluate(() => new Promise((res, rej) => {
    localStorage.clear(); sessionStorage.setItem('seeded', '1');
    localStorage.setItem('aos.seen', JSON.stringify({ mealsvintage: '1.3' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.sky', 'day');
    localStorage.setItem('allison-mealsv-v1-tab', '"deals"'); localStorage.setItem('allison-mealsv-v1-store', '"cary"');
    const r = indexedDB.open('allison-mealsv', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put({ url: 'https://example.com/x', secret: 's' }, 'sheet'); t.objectStore('kv').put(7, 'n'); t.oncomplete = () => { r.result.close(); res(); }; t.onerror = () => rej(t.error); };
  }));
  await p.goto(BASE + '/mealsvintage/'); await p.waitForTimeout(400);
  const moved = await p.evaluate(() => window.aosDesign.moved);
  const got = await p.evaluate(() => new Promise(res => {
    const out = { tab: localStorage.getItem('allison-meals-v1-tab'), store: localStorage.getItem('allison-meals-v1-store'), seen: JSON.parse(localStorage.getItem('aos.seen')), oldKept: localStorage.getItem('allison-mealsv-v1-tab') };
    const r = indexedDB.open('allison-meals', 1);
    r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').getAll(); q.onsuccess = () => { out.db = q.result; res(out); }; q.onerror = () => res(out); };
    r.onerror = () => res(out);
  }));
  if (!moved) pr.push('aosDesign.moved did not resolve true');
  if (got.tab !== '"deals"' || got.store !== '"cary"') pr.push('localStorage not moved: ' + JSON.stringify(got));
  if (!got.seen || got.seen.meals !== '1.3') pr.push('what it had seen did not carry over: ' + JSON.stringify(got.seen));
  if (!got.oldKept) pr.push('the old keys were deleted');
  if (!Array.isArray(got.db) || got.db.length !== 2 || !got.db.some(v => v && v.secret === 's')) pr.push('the database was not copied: ' + JSON.stringify(got.db));
  // once only
  await p.evaluate(() => localStorage.setItem('allison-mealsv-v1-tab', '"list"'));
  await p.reload(); await p.waitForTimeout(400);
  if (await p.evaluate(() => localStorage.getItem('allison-meals-v1-tab')) !== '"deals"') pr.push('moved again on a second open');
  pr.push(...errs);
  report('an old Vintage address: its data moved over once (localStorage, seen, IndexedDB), nothing deleted', pr); await ctx.close();
}
{
  const pr = [];
  const { ctx, p, errs } = await phone('light', { 'aos.seen': JSON.stringify({ meals: '999', mealsvintage: '1.3' }), 'aos.signin.asked': '1', 'allison-meals-v1-tab': '"list"', 'allison-mealsv-v1-tab': '"deals"', 'allison-mealsv-v1-store': '"cary"' });
  await p.goto(BASE + '/mealsvintage/'); await p.waitForTimeout(500);
  const got = await p.evaluate(() => ({ tab: localStorage.getItem('allison-meals-v1-tab'), store: localStorage.getItem('allison-meals-v1-store') }));
  if (got.tab !== '"list"' || got.store !== null) pr.push('the app\'s own data was mixed with the old app\'s: ' + JSON.stringify(got));
  pr.push(...errs);
  report('a phone with data of both: the app\'s own is kept, nothing of the old app\'s is copied', pr); await ctx.close();
}

await b.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed'); process.exit(failed ? 1 : 0);
