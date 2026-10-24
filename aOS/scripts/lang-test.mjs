// aOS in Russian (home/lang.js), as a person uses it at iPhone size:
//   - English by default: nothing swapped, dates in English;
//   - Account > Appearance > Language > Русский: kept, aOS is drawn again in Russian (lang="ru"), and an app
//     open in another page follows at once; English brings it back;
//   - lost in a language you can't read: Ipsy switches it back (typing "English", or asking Claude, which uses
//     the set_language tool every Ipsy has);
//   - the engine: whole texts and patterns, attributes, text drawn later, translate="no" left alone,
//     Russian plurals, dates and times in Russian;
//   - every app opens with no English left on its page (aOS/scripts/lang-scan.mjs, the names in KEEP aside).
// The accounts server is stood in for.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node aOS/scripts/lang-test.mjs [repo root]
import { createRequire } from 'module'; import { execSync } from 'child_process'; import http from 'http'; import fs from 'fs'; import path from 'path';
import { scan } from './lang-scan.mjs';
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
  await ctx.addInitScript(s => { try { localStorage.setItem('aos.sky', 'day'); localStorage.setItem('aos.seen', JSON.stringify({ aos: '999', meals: '999', notes: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.session', JSON.stringify({ t: 'x' }));
    for (const k in s) if (!sessionStorage.getItem('seeded.' + k)) { localStorage.setItem(k, s[k]); sessionStorage.setItem('seeded.' + k, '1'); } } catch {} }, seed);
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort();
    if (!u.pathname.includes('/api/')) return r.continue();
    const route = u.pathname.slice(u.pathname.indexOf('/api/') + 5), J = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (route === 'state') return J({ storage: true, setup: true, user, plan: null });
    if (route === 'members') return J({ members: [user] });
    if (route === 'ipsy') {   // Claude, stood in for: asked to, it switches the language with the tool every Ipsy has
      const b = JSON.parse(r.request().postData() || '{}'), last = (b.messages || []).slice(-1)[0] || {};
      const done = Array.isArray(last.content) && last.content.some(c => c.type === 'tool_result');
      return J(done ? { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Switched aOS to English.' }] }
        : { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu1', name: 'set_language', input: { lang: 'en' } }] });
    }
    return J({}, 401);
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  return { ctx, p, errs };
}
const openAos = async p => { await p.goto(BASE + '/aOS/'); await p.evaluate(() => aosTabs.show('today')); await p.waitForSelector('#stories .story'); };

// 1. English by default
{
  const { ctx, p, errs } = await phone(); const pr = [...errs];
  await openAos(p);
  const st = await p.evaluate(() => ({ lang: document.documentElement.lang, get: aosLang.get(), day: new Date(2026, 9, 24).toLocaleDateString([], { weekday: 'long' }) }));
  if (st.lang !== 'en-US' || st.get !== 'en') pr.push('not English to begin with: ' + JSON.stringify(st));
  if (st.day !== 'Saturday') pr.push('dates are not in English: ' + st.day);
  report('English by default: nothing swapped, dates in English', pr); await ctx.close();
}

// 2. Русский in Appearance: kept, aOS drawn again in Russian, an open app follows; English brings it back
{
  const { ctx, p, errs } = await phone(); const pr = [...errs];
  await openAos(p);
  const app = await ctx.newPage(); await app.goto(BASE + '/meals/'); await app.waitForTimeout(400);
  await p.click('#today [data-acct]'); await p.click('[aria-controls="fLook"]'); await p.waitForSelector('#lang [data-lang="ru"]');
  if (await p.locator('#lang').getAttribute('translate') !== 'no') pr.push('the language buttons are not kept in their own languages');
  await Promise.all([p.waitForEvent('load'), p.click('#lang [data-lang="ru"]')]);
  await p.waitForTimeout(400);
  if (await p.evaluate(() => document.documentElement.lang + '/' + localStorage.getItem('aos.lang')) !== 'ru/ru') pr.push('Russian was not applied and kept');
  await app.waitForTimeout(600);
  if (await app.evaluate(() => document.documentElement.lang) !== 'ru') pr.push('an app open in another page did not follow');
  await p.evaluate(() => aosTabs.show('today')); await p.waitForSelector('#stories .story');
  await p.click('#today [data-acct]'); await p.click('[aria-controls="fLook"]'); await p.waitForSelector('#lang [data-lang="en"]');
  if (await p.locator('#lang [data-lang="en"]').textContent() !== 'English') pr.push('English is not named in English in Russian');
  await Promise.all([p.waitForEvent('load'), p.click('#lang [data-lang="en"]')]);
  await p.waitForTimeout(300);
  if (await p.evaluate(() => document.documentElement.lang) !== 'en-US') pr.push('English did not come back');
  report('Language > Русский: kept, aOS drawn again in Russian, an open app follows; English brings it back', pr); await ctx.close();
}

// 2b. Ipsy puts the language back: typing "English" (at once, nothing asked), or asking (Claude's set_language tool)
{
  const pr = [];
  for (const [how, words] of [['typed', 'English'], ['asked', 'I cannot read this, help']]) {
    const { ctx, p, errs } = await phone({ 'aos.lang': 'ru' }); pr.push(...errs.map(e => how + ': ' + e));
    await p.goto(BASE + '/meals/'); await p.waitForTimeout(500);
    await p.click('.ipsy-btn'); await p.waitForSelector('.ipsy-bubble');
    if (await p.locator('#ipsyOk').count()) await p.click('#ipsyOk');
    await p.fill('#ipsyIn', words);
    await Promise.all([p.waitForEvent('load', { timeout: 15000 }).catch(() => pr.push(how + ': the page was not drawn again')), p.click('.ipsy-send')]);
    await p.waitForTimeout(300);
    if (await p.evaluate(() => document.documentElement.lang + '/' + localStorage.getItem('aos.lang')) !== 'en-US/en') pr.push(how + ': Ipsy did not put English back');
    await ctx.close();
  }
  report('Ipsy puts English back: typing "English", or asking (the set_language tool)', pr);
}

// 3. the engine
{
  const { ctx, p, errs } = await phone({ 'aos.lang': 'ru' }); const pr = [...errs];
  await p.goto(BASE + '/meals/'); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    aosLang.add({ 'Zebra crossing': 'Пешеходный переход', 'Find a zebra': 'Найти зебру' }, [[/^(\d+) zebras?$/, m => m[1] + ' ' + aosLang.plural(m[1], 'зебра', 'зебры', 'зебр')]]);
    const box = document.createElement('div');
    box.innerHTML = '<p id="t1">  Zebra crossing </p><p id="t2">21 zebras</p><p id="t3">3 zebras</p><input id="t4" placeholder="Find a zebra"><p id="t5" translate="no">Zebra crossing</p><p id="t6"><b>Zebra crossing</b></p>';
    document.body.append(box);
    await new Promise(res => setTimeout(res, 50));
    const later = document.createElement('p'); later.textContent = 'Zebra crossing'; box.append(later);
    const flip = document.getElementById('t3'); flip.firstChild.data = '5 zebras';
    await new Promise(res => setTimeout(res, 50));
    const out = { t1: document.getElementById('t1').textContent, t2: t2 = document.getElementById('t2').textContent, t3: flip.textContent, t4: document.getElementById('t4').placeholder,
      t5: document.getElementById('t5').textContent, t6: document.getElementById('t6').textContent, later: later.textContent,
      time: new Date(2026, 9, 24, 21, 41).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), date: new Date(2026, 9, 24).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
      fmt: new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(2026, 9, 24)), num: (1234.5).toLocaleString() };
    box.remove(); later.remove();
    return out;
    var t2;
  });
  const want = { t1: '  Пешеходный переход ', t2: '21 зебра', t3: '5 зебр', t4: 'Найти зебру', t5: 'Zebra crossing', t6: 'Пешеходный переход', later: 'Пешеходный переход', time: '21:41', date: '24 октября', fmt: 'суббота' };
  for (const k in want) if (r[k] !== want[k]) pr.push(`${k}: ${JSON.stringify(r[k])}, not ${JSON.stringify(want[k])}`);
  if (!/^1\s234,5$/.test(r.num)) pr.push('numbers are not in Russian: ' + r.num);
  report('the engine: whole texts, patterns and plurals, placeholders, text drawn later, translate="no" kept, dates and numbers in Russian', pr); await ctx.close();
}

// 4. every app opens with no English left (names that stay in Latin letters aside)
{
  const out = await scan(['aos', 'calendar', 'clock', 'drinks', 'fitness', 'house', 'mail', 'meals', 'news', 'notes', 'orders', 'places', 'podcasts', 'travel', 'weather'], { root: ROOT });
  const pr = Object.entries(out).filter(([, l]) => l.length).map(([id, l]) => `${id}: ${l.length} still in English: ${l.slice(0, 6).join(' | ')}${l.length > 6 ? ' ...' : ''}`);
  report('every app opens in Russian with no English left on the page', pr);
}

await b.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed'); process.exit(failed ? 1 : 0);
