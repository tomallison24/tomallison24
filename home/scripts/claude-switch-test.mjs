// Claude, app by app, on this phone (home/account.js AllisonOS.claude, home/settings.js S.claude, aOS Account > Claude):
//   - turned off for an app, a call to any of its Claude routes is answered on the phone ({ error: 'ai-off' }, 503) and
//     never reaches the server; its other routes, and another app's Claude routes, still go;
//   - Ipsy in that app says Claude is turned off and sends nothing; turned on again, it asks as before;
//   - an app's Settings > Ipsy starts with Use Claude in <app>, which turns it (and tells the page, aos:claude);
//   - aOS Account > Claude lists every app with a switch, says which are off, and keeps the choice on this phone only;
//   - Orders, opened with Claude off, shows its row off and doesn't offer to check orders by itself.
//   node home/scripts/claude-switch-test.mjs [repo root]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const PAGE = `<!doctype html><meta charset="utf-8"><title>Claude</title><body>
<script src="/home/account.js"></script><script src="/home/settings.js"></script><script src="/home/redact.js"></script><script src="/home/ipsy.js"></script>
<div id="sheet"></div>
<script>
  window.chat = AllisonOS.ipsy.mount({ app: 'notes', name: 'Notes', endpoint: '/notes/api/ipsy', consent: 'Test.', tools: {} });
  document.getElementById('sheet').innerHTML = AllisonOS.settings.section('Ipsy', AllisonOS.settings.claude('notes'));
  window.told = []; addEventListener('aos:claude', e => told.push(e.detail));
</script>`;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let p = decodeURIComponent(u.pathname);
  if (p === '/claude.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;
const browser = await chromium.launch();
let failed = 0;
const report = (name, problems) => { if (problems.length) { failed++; console.log('not ok - ' + name + '\n  ' + problems.join('\n  ')); } else console.log('ok - ' + name); };

// A phone: what reached the server's routes (apart from aOS's accounts API), and Claude stood in for
async function phone(seed = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(s => { try {
    localStorage.setItem('aos.helper', '{"who":"mia","name":"Ipsy"}'); localStorage.setItem('ipsy.notes.ok', '1');
    localStorage.setItem('aos.seen', JSON.stringify({ aos: '999', orders: '999' })); localStorage.setItem('aos.signin.asked', '1');
    localStorage.setItem('aos.session', JSON.stringify({ token: 't', user: { id: 'u1', name: 'Sarah', role: 'member' }, at: Date.now() })); sessionStorage.setItem('aos.later.aos', '1');
    for (const k in s) if (!sessionStorage.getItem('seeded.' + k)) { localStorage.setItem(k, s[k]); sessionStorage.setItem('seeded.' + k, '1'); }
  } catch {} }, seed);
  const hits = [];
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort();
    if (u.pathname.startsWith('/aOS/api/') && u.pathname !== '/aOS/api/ipsy') {
      const route = u.pathname.slice('/aOS/api/'.length), user = { id: 'u1', name: 'Sarah', role: 'member', apps: {} };
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(route === 'state' ? { storage: true, setup: true, user, plan: null } : route === 'members' ? { members: [user] } : {}) });
    }
    if (!/\/api\//.test(u.pathname)) return r.continue();
    hits.push(u.pathname);
    if (/\/api\/ipsy$/.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'm1', type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Here you go.' }] }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  return { ctx, p, errs, hits };
}
const post = (p, url) => p.evaluate(async u => { const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); return { status: r.status, body: await r.json().catch(() => null) }; }, url);

// 1. the guard: off for Notes and Orders, their Claude routes are answered on the phone; the rest go
{
  const { ctx, p, errs, hits } = await phone({ 'aos.claude.notes': 'off', 'aos.claude.orders': 'off' }); const pr = [];
  await p.goto(BASE + '/claude.html');
  for (const u of ['/notes/api/ipsy', '/orders/api/read', '/orders/api/ipsy', '../orders/api/read/']) {
    const r = await post(p, u);
    if (r.status !== 503 || !r.body || r.body.error !== 'ai-off') pr.push(`${u}: ${JSON.stringify(r)}`);
  }
  const r2 = await p.evaluate(async () => (await fetch(new Request('/orders/api/ipsy', { method: 'POST', body: '{}' }))).status);
  if (r2 !== 503) pr.push('a Request object to an off route went out: ' + r2);
  for (const u of ['/travel/api/extract', '/money/api/check', '/orders/api/other', '/notes/api/sync']) await post(p, u);
  const went = hits.join(' ');
  if (/notes\/api\/ipsy|orders\/api\/(read|ipsy)/.test(went)) pr.push('an off route reached the server: ' + went);
  for (const u of ['/travel/api/extract', '/money/api/check', '/orders/api/other', '/notes/api/sync']) if (!hits.includes(u)) pr.push(u + ' did not go to the server');
  if (await p.evaluate(() => [AllisonOS.claude.on('notes'), AllisonOS.claude.on('travel'), AllisonOS.claude.apps.length].join()) !== 'false,true,10') pr.push('AllisonOS.claude.on / apps');
  pr.push(...errs);
  report('turned off for an app, its Claude routes are answered on the phone and never reach the server; everything else goes', pr); await ctx.close();
}

// 2. Ipsy in that app: says so and sends nothing; Settings > Ipsy turns it back on, and it asks
{
  const { ctx, p, errs, hits } = await phone({ 'aos.claude.notes': 'off' }); const pr = [];
  await p.goto(BASE + '/claude.html');
  const row = p.locator('#sheet .st-switch[data-claude="notes"]');
  if ((await row.textContent()).replace(/\s+/g, ' ').trim() !== 'Use Claude in NotesTurned off, nothing in Notes goes to Claude from this phone.') pr.push('the row says: ' + await row.textContent());
  if (await row.getAttribute('aria-checked') !== 'false') pr.push('the row is not off');
  await p.evaluate(() => chat.prompt('What’s on my list?'));
  await p.waitForFunction(() => /Claude is turned off for Notes on this phone\. Settings, Ipsy turns it back on\./.test(document.querySelector('.ipsy-log').textContent), null, { timeout: 5000 })
    .catch(async () => pr.push('Ipsy did not say Claude is off: ' + await p.evaluate(() => document.querySelector('.ipsy-log').textContent)));
  if (hits.length) pr.push('something went to the server: ' + hits.join(' '));
  await row.dispatchEvent('click');   // (Ipsy's chat is open over the page)
  if (await row.getAttribute('aria-checked') !== 'true') pr.push('the row did not turn on');
  const s = await p.evaluate(() => ({ kept: localStorage.getItem('aos.claude.notes'), told: JSON.stringify(told) }));
  if (s.kept !== null || s.told !== '[{"app":"notes","on":true}]') pr.push('turned on: ' + JSON.stringify(s));
  await p.evaluate(() => chat.prompt('And now?'));
  await p.waitForFunction(() => /Here you go\./.test(document.querySelector('.ipsy-log').textContent), null, { timeout: 8000 }).catch(() => pr.push('turned on again, Ipsy did not answer'));
  if (!hits.includes('/notes/api/ipsy')) pr.push('turned on again, nothing went to Claude');
  await row.dispatchEvent('click');   // (Ipsy's chat is open over the page)
  if (await p.evaluate(() => localStorage.getItem('aos.claude.notes')) !== 'off') pr.push('turned off again, not kept');
  pr.push(...errs);
  report('Ipsy in an app Claude is off for says so and sends nothing; Settings > Ipsy, Use Claude in Notes, turns it back on', pr); await ctx.close();
}

// 3. aOS Account > Claude: every app, which are off, kept on this phone only
{
  const { ctx, p, errs } = await phone({ 'aos.claude.money': 'off' }); const pr = [];
  await p.goto(BASE + '/aOS/'); await p.evaluate(() => aosTabs.show('today')); await p.waitForSelector('#stories .story');
  await p.click('#today [data-acct]'); await p.click('[aria-controls="fClaude"]'); await p.waitForSelector('#fClaude .st-switch');
  const rows = await p.locator('#fClaude .st-switch').evaluateAll(es => es.map(e => e.dataset.claude + ':' + e.getAttribute('aria-checked')));
  if (rows.join() !== 'aos:true,calendar:true,fitness:true,meals:true,money:false,news:true,notes:true,orders:true,podcasts:true,travel:true') pr.push('the list: ' + rows);
  if (await p.locator('#claudeSub').textContent() !== 'Not used by Money') pr.push('the line under Claude: ' + await p.locator('#claudeSub').textContent());
  await p.click('#fClaude [data-claude="orders"]');
  await p.waitForFunction(() => document.getElementById('claudeSub').textContent === 'Not used by Money and Orders', null, { timeout: 2000 }).catch(async () => pr.push('after Orders: ' + await p.locator('#claudeSub').textContent()));
  await p.click('#fClaude [data-claude="money"]');
  await p.waitForFunction(() => document.getElementById('claudeSub').textContent === 'Not used by Orders', null, { timeout: 2000 }).catch(async () => pr.push('after Money: ' + await p.locator('#claudeSub').textContent()));
  const kept = await p.evaluate(() => ({ orders: localStorage.getItem('aos.claude.orders'), money: localStorage.getItem('aos.claude.money') }));
  if (kept.orders !== 'off' || kept.money !== null) pr.push('kept: ' + JSON.stringify(kept));
  const r = await post(p, '../orders/api/read');
  if (r.status !== 503) pr.push('aOS still lets Orders reach Claude: ' + JSON.stringify(r));
  const sync = fs.readFileSync(path.join(ROOT, 'functions/aOS/api/[[route]].js'), 'utf8').match(/export const PREF_ITEM = (\/.*\/);/);
  if (!sync || new RegExp(sync[1].slice(1, -1)).test('aos.claude.orders')) pr.push('aos.claude.* would follow you to your other devices (PREF_ITEM)');
  pr.push(...errs);
  report('aOS Account > Claude: every app with a switch, the line says which are off, kept on this phone only', pr); await ctx.close();
}

// 4. Orders, opened with Claude off: Settings > Ipsy starts with its row, off
{
  const { ctx, p, errs } = await phone({ 'aos.claude.orders': 'off' }); const pr = [];
  await p.goto(BASE + '/orders/'); await p.waitForFunction(() => window.AllisonOS && AllisonOS.settings && document.getElementById('setBtn'));
  await p.click('#setBtn'); await p.waitForSelector('#stBody .st-switch');
  const first = await p.locator('#stIpsy .st-switch').first().evaluate(e => e.dataset.claude + ':' + e.getAttribute('aria-checked')).catch(() => 'none');
  if (first !== 'orders:false') pr.push('Settings > Ipsy starts with: ' + first);
  pr.push(...errs.filter(e => !/Failed to fetch|NetworkError/.test(e)));
  report('Orders, Claude off: Settings > Ipsy starts with Use Claude in Orders, off', pr); await ctx.close();
}

await browser.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed'); process.exit(failed ? 1 : 0);
