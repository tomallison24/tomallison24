// Your helper's name on the page (home/names.js), and aOS in English only, as a person uses it at iPhone size:
//   - English: no Language in Appearance, no Russian left anywhere; a phone that had Russian picked
//     (aos.lang = 'ru', from before) opens in English;
//   - your helper's name where the words say Ipsy ("Or just tell Mia…"), a new name at once, with none what
//     it is ("the fox"; Mia is Mia), in Tron Ares; the release log and translate="no" as they were.
//
//   node aOS/scripts/names-test.mjs [repo root]
import { createRequire } from 'module'; import { execSync } from 'child_process'; import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/'); const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, r)); const BASE = 'http://localhost:' + server.address().port;
const b = await chromium.launch();
let failed = 0;
const report = (name, problems) => { if (problems.length) { failed++; console.log('not ok - ' + name + '\n  ' + problems.join('\n  ')); } else console.log('ok - ' + name); };

async function phone(seed = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const user = { id: 'u1', name: 'Sarah', role: 'member', apps: {} };
  await ctx.addInitScript(s => { try { localStorage.setItem('aos.sky', 'day'); localStorage.setItem('aos.helper', '{"who":"mia","name":"Ipsy"}'); localStorage.setItem('aos.seen', JSON.stringify({ aos: '999', meals: '999', notes: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.tron.intro', 'off'); localStorage.setItem('aos.session', JSON.stringify({ t: 'x' }));
    for (const k in s) if (!sessionStorage.getItem('seeded.' + k)) { localStorage.setItem(k, s[k]); sessionStorage.setItem('seeded.' + k, '1'); } } catch {} }, seed);
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort();
    if (!u.pathname.includes('/api/')) return r.continue();
    const route = u.pathname.slice(u.pathname.indexOf('/api/') + 5), J = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (route === 'state') return J({ storage: true, setup: true, user, plan: null });
    if (route === 'members') return J({ members: [user] });
    return J({}, 401);
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  return { ctx, p, errs };
}
const CYR = /[Ѐ-ӿ]/;

// 1. English only: a phone that had Russian picked opens in English, with no Language to pick
{
  const { ctx, p, errs } = await phone({ 'aos.lang': 'ru' }); const pr = [...errs];
  await p.goto(BASE + '/aOS/'); await p.evaluate(() => aosTabs.show('today')); await p.waitForSelector('#stories .story');
  const st = await p.evaluate(() => ({ lang: document.documentElement.lang, api: typeof window.aosLang, ru: /[Ѐ-ӿ]/.test(document.body.innerText) }));
  if (st.lang !== 'en-US' || st.api !== 'undefined' || st.ru) pr.push('aOS is not English only: ' + JSON.stringify(st));
  await p.click('#today [data-acct]'); await p.click('[aria-controls="fLook"]'); await p.waitForTimeout(300);
  if (await p.locator('#lang, [data-lang]').count()) pr.push('Appearance still offers a language');
  if (CYR.test(await p.locator('#fLook').innerText())) pr.push('Appearance still has Russian in it');
  await p.goto(BASE + '/notes/'); await p.waitForTimeout(800);
  if (await p.evaluate(() => document.documentElement.lang) !== 'en-US' || CYR.test(await p.evaluate(() => document.body.innerText))) pr.push('an app opened in Russian');
  report('English only: a phone that had Russian picked opens aOS and its apps in English, with no Language to pick', pr); await ctx.close();
}

// 2. your helper's name where the words say Ipsy; a new name at once; the release log and translate="no" as they were; Ares in Tron
{
  const { ctx, p, errs } = await phone({ 'aos.helper': '{"who":"fox","name":"Mia"}' }); const pr = [...errs];
  await p.goto(BASE + '/meals/'); await p.waitForSelector('#askIn'); await p.waitForTimeout(300);
  const look = () => p.evaluate(() => {
    const kept = document.createElement('div');
    kept.innerHTML = '<ul data-ipsy="as-is"><li id="k1">Ipsy is yours now</li></ul><p id="k2" translate="no">Ipsy, plan dinner</p><p id="k3">Ipsy is reading…</p>';
    document.body.append(kept);
    return new Promise(res => setTimeout(() => {
      const r = { text: document.body.innerText, k1: $q('#k1').textContent, k2: $q('#k2').textContent, k3: $q('#k3').textContent };
      kept.remove(); res(r);
    }, 50));
    function $q(s) { return document.querySelector(s); }
  });
  let r = await look();
  if (!r.text.includes('Or just tell Mia…')) pr.push('no "Or just tell Mia…" on the page');
  const left = (r.text.match(/[^\n]*Ipsy[^\n]*/g) || []).filter(l => !/Ipsy is yours now|Ipsy, plan dinner/.test(l));
  if (left.length) pr.push('still says Ipsy: ' + left.slice(0, 4).join(' | '));
  if (r.k1 !== 'Ipsy is yours now') pr.push('the release log took the name: ' + r.k1);
  if (r.k2 !== 'Ipsy, plan dinner') pr.push('translate="no" took the name: ' + r.k2);
  await p.evaluate(() => AllisonOS.ipsy.setHelper('fox', 'Biscuit'));
  r = await look();
  if (!r.text.includes('Or just tell Biscuit…')) pr.push('renamed: no "Or just tell Biscuit…" on the page');
  if (/\bMia\b/.test(r.text)) pr.push('the old name is still on the page');
  await p.evaluate(() => AllisonOS.ipsy.setHelper('fox', ''));
  r = await look();
  if (!r.text.includes('Or just tell the fox…')) pr.push('with no name, it does not go by what it is');
  if (r.k3 !== 'The fox is reading…') pr.push('with no name, to begin a line: ' + r.k3);
  await p.evaluate(() => AllisonOS.ipsy.setHelper('mia', ''));
  r = await look();
  if (!r.text.includes('Or just tell Mia…')) pr.push('Mia with no name is not Mia');
  await p.evaluate(() => document.documentElement.setAttribute('data-look', 'grid')); await p.waitForTimeout(100);
  r = await look();
  if (!r.text.includes('Or just tell Ares…')) pr.push('in Tron, the helper is not Ares');
  report('your helper\'s name where the words say Ipsy, a new name at once, Ares in Tron, the release log and translate="no" as they were', pr); await ctx.close();
}

await b.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed'); process.exit(failed ? 1 : 0);
