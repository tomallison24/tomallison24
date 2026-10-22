// aOS 2's Home (aOS/home-tab.js), in preview: every app inside aOS. At iPhone size, Vintage and Sea
// glass, light and dark:
//   - off, aOS is as it was (the Apps tab); aOS/#preview=aos2 turns Home on: first in the dock,
//     with Ipsy, Favorites and every app in groups
//   - a row opens the app inside aOS: full screen, "‹ aOS" over it, the app's content starting
//     clear of it (welcome.js takes aOS's insets as the app's safe-area spacing), no "add me" steps
//   - "‹ aOS" and a swipe in from the left edge go back; holding it lists the other open apps
//   - Favorites, mixed: a pin first, then the most used, then the starting four
//   - Ipsy in aOS runs an app's own tool inside that app (Notes' lists), opening it out of sight
// and the route behind it (functions/aOS/api/ipsy.js): signed-in family only, every Ipsy app's tools
// but Fitness's, each named with its app, Claude Sonnet 5.5.
//   node aOS/scripts/home-test.mjs [repo root]
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
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };

// ---- the route ----
{
  const route = await import(path.join(R, 'functions/aOS/api/ipsy.js'));
  const names = route.IPSY_CLIENT_TOOLS.map(t => t.name);
  check(names.length > 40 && new Set(names).size === names.length && names.every(n => /^(calendar|notes|meals|orders|travel|news)__[a-z_]+$/.test(n)), `every Ipsy app's tools but Fitness's, each named with its app (${names.length})`);
  check(names.includes('travel__search_gmail') && names.includes('orders__search_gmail') && !names.some(n => /^fitness__/.test(n)), 'the same tool in two apps stays two tools; none from Fitness');
  check(/Fitness/.test(route.IPSY_SYSTEM) && /never put health details in a web search/.test(route.IPSY_SYSTEM), 'Ipsy is told why Fitness stays out, and to keep health out of web searches');
  const head = route.ipsyRequestHead({});
  check(head.model === 'claude-sonnet-5-5' && head.tools.some(t => t.name === 'web_search'), 'Claude Sonnet 5.5, with web search');
  const m = new Map(); const db = { get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, String(v)); } };
  const post = (h = {}) => new Request(BASE + '/aOS/api/ipsy', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: '{"messages":[{"role":"user","content":"hi"}]}' });
  check((await route.onRequest({ request: post(), env: { ACCOUNTS: db } })).status === 404, 'without its header, nothing');
  check((await route.onRequest({ request: post({ 'X-Aos': '1' }), env: { ACCOUNTS: db } })).status === 503, 'family accounts off: no Ipsy');
  await db.put('owner', 'O1');
  check((await route.onRequest({ request: post({ 'X-Aos': '1' }), env: { ACCOUNTS: db, ANTHROPIC_API_KEY: 'k' } })).status === 401, 'signed out: asks to sign in');
}

// ---- moving into aOS 2: the family account's side (functions/aOS/api, handoff) ----
{
  const { onRequest } = await import(path.join(R, 'functions/aOS/api/[[route]].js'));
  const { issue, putJSON } = await import(path.join(R, 'server/auth.js'));
  const m = new Map();
  const db = { get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, String(v)); }, delete: async k => { m.delete(k); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
  await db.put('owner', 'O1'); await putJSON(db, 'user:O1', { id: 'O1', name: 'Tom', role: 'owner', creds: [], created: Date.now() - 864e5 });
  const tok = await issue(db, 'O1');
  const call = async (route, body) => { const r = await onRequest({ request: new Request(BASE + '/aOS/api/' + route, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), params: { route: route.split('/') }, env: { ACCOUNTS: db } }); return { status: r.status, j: await r.json() }; };
  check(!(await call('state')).j.carry, 'before aOS 2 is opened, apps aren\'t asked to hand anything over');
  await call('handoff/want', {});
  check((await call('state')).j.carry === true, 'aOS 2 opened: GET state tells the apps to hand over (carry)');
  check((await call('handoff', { app: 'clock', data: { 'allison-clock-v1': '{"alarms":[1]}' } })).j.ok, 'Clock hands over what it keeps on the phone');
  check((await call('handoff', { app: 'nope', data: {} })).status === 400 && (await call('handoff', { app: 'clock', data: { a: 1 } })).status === 400, 'only a known app, and only strings');
  const t1 = await call('handoff/take', { app: 'clock' });
  check(t1.j.data && t1.j.data['allison-clock-v1'] === '{"alarms":[1]}', 'aOS takes it');
  check((await call('handoff/take', { app: 'clock' })).j.data === null && !m.has('handoff:O1:clock'), 'once: then it\'s deleted');
  check((await call('handoff', { app: 'clock', data: { k: 'v' } })).j.taken === true, 'taken: the Home Screen copy is told to stop sending');
  check((await call('handoff/take', { app: 'weather' })).j.data === null && !m.has('handoff:taken:O1:weather'), 'nothing waiting yet: aOS can ask again');
}

// ---- the page ----
const APPS = ['mail', 'calendar', 'clock', 'news', 'weather', 'notes', 'podcasts', 'travel', 'places', 'fitness', 'drinks', 'meals', 'orders', 'house'];
const b = await chromium.launch();
for (const [look, scheme] of [['vintage', 'light'], ['glass', 'dark']]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block', colorScheme: scheme });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.fulfill({ status: 503, body: '' }));
  await ctx.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
  await ctx.addInitScript(([apps, look]) => { if (window.top !== window) return;
    const s = { aos: '999' }; for (const a of apps) s[a] = '999';
    localStorage.setItem('aos.seen', JSON.stringify(s)); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.look', look); }, [APPS, look]);
  const pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  const tag = `(${look}, ${scheme})`;
  const state = () => pg.evaluate(() => ({ inApp: document.body.classList.contains('in-app'), shown: [...document.querySelectorAll('.frame')].filter(f => !f.hidden).map(f => f.dataset.id), hash: location.hash }));

  await pg.goto(BASE + '/aOS/'); await pg.waitForTimeout(700);
  check(await pg.evaluate(() => !!document.querySelector('[data-tab="apps"]') && document.getElementById('home').hidden && !window.aosHomeTab), `off: aOS as it was, with its Apps tab ${tag}`);
  if (look === 'vintage') {   // the owner turns it on from Account (a link would open in Safari, with its own storage)
    await pg.route('**/aOS/api/state', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ storage: true, setup: true, plan: null, user: { id: 'O1', name: 'Tom', role: 'owner', apps: {} } }) }));
    await pg.evaluate(() => localStorage.setItem('aos.session', JSON.stringify({ token: 't', user: { id: 'O1', name: 'Tom', role: 'owner' }, at: Date.now() })));
    await pg.reload(); await pg.waitForTimeout(700);
    await pg.locator('#today [data-acct]').click(); await pg.waitForSelector('#aPreview', { timeout: 8000 }).catch(() => {});
    check(/Try aOS 2/.test(await pg.textContent('#aPreview').catch(() => '')), `the owner's Account page offers the aOS 2 preview ${tag}`);
    await pg.locator('#aPreview').click(); await pg.waitForTimeout(1200);
    check(await pg.evaluate(() => [...document.querySelectorAll('[data-tab]')].map(b => b.dataset.tab).join(',')) === 'home,today,search', `Try aOS 2 turns it on in the app itself ${tag}`);
    await pg.unroute('**/aOS/api/state');
    await pg.evaluate(() => { localStorage.removeItem('aos.session'); localStorage.removeItem('aos.preview'); });
  }
  await pg.goto(BASE + '/aOS/#preview=aos2'); await pg.reload(); await pg.waitForTimeout(900);
  const dock = await pg.evaluate(() => [...document.querySelectorAll('[data-tab]')].map(b => b.dataset.tab).join(','));
  check(dock === 'home,today,search' && await pg.isVisible('#home'), `on: Home first in the dock, and showing ${tag}`);
  check(await pg.locator('#ipsySlot .ipsy-btn').count() === 1 && /Calendar, Notes, Meals, Orders, Travel and News/.test(await pg.textContent('#ipsySub')), `Ipsy at the top, across six apps ${tag}`);
  check(await pg.locator('#favs .fav').count() === 4 && await pg.locator('#spaces .hrow').count() === 14, `four favorites and every app ${tag}`);

  await pg.locator('.hrow[data-open="notes"]').click(); await pg.waitForTimeout(2200);
  let s = await state();
  check(s.inApp && s.shown.join() === 'notes' && s.hash === '#app=notes', `a row opens the app inside aOS ${tag}`);
  const nf = pg.frames().find(f => f.url().includes('/notes/'));
  const top = await nf.evaluate(() => { const h = document.querySelector('h1'); return h ? Math.round(h.getBoundingClientRect().top) : -1; });
  check(top >= 50, `the app's content starts clear of "‹ aOS" (its title at ${top}px) ${tag}`);
  check(await nf.evaluate(() => !document.getElementById('aos-welcome')), `no "add me" steps inside aOS ${tag}`);
  const pill = await pg.locator('#appback').boundingBox();
  check(pill && pill.y < 50 && pill.x < 30, `"‹ aOS" floats in the top left corner ${tag}`);

  await pg.locator('#appback').click(); await pg.waitForTimeout(600);
  s = await state();
  check(!s.inApp && s.hash === '' && await pg.locator('#opennowList [data-open="notes"]').count() === 1, `"‹ aOS" goes back, and Notes is under Open now ${tag}`);
  await pg.locator('.hrow[data-open="weather"]').click(); await pg.waitForTimeout(1200);
  await pg.mouse.move(5, 420); await pg.mouse.down(); await pg.mouse.move(280, 420, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(600);
  check(!(await state()).inApp, `a swipe in from the left edge goes back ${tag}`);
  await pg.locator('#opennowList [data-open="notes"]').click(); await pg.waitForTimeout(700);
  const bb = await pg.locator('#appback').boundingBox();
  await pg.mouse.move(bb.x + 10, bb.y + 10); await pg.mouse.down(); await pg.waitForTimeout(600); await pg.mouse.up(); await pg.waitForTimeout(200);
  check(/Weather/.test(await pg.textContent('#appmenu')) && await pg.isVisible('#appmenu'), `holding "‹ aOS" lists the other open apps ${tag}`);
  await pg.locator('#appmenu [data-to="weather"]').click(); await pg.waitForTimeout(500);
  check((await state()).shown.join() === 'weather', `and goes straight to one ${tag}`);
  await pg.locator('#appback').click(); await pg.waitForTimeout(500);

  await pg.locator('#favEdit').click();
  await pg.locator('.hrow[data-open="house"] [data-pin]').click();
  await pg.locator('#favEdit').click();
  const favs = await pg.evaluate(() => aosHomeTab.favorites().map(f => f.id + ':' + f.why));
  check(favs[0] === 'house:pin' && favs.some(f => /:used$/.test(f)) && favs.length === 4, `Favorites, mixed: the pin, then the most used, then the starters (${favs.join(' ')}) ${tag}`);

  const r = await pg.evaluate(async () => { const m = AllisonOS.ipsy.mounted; const res = await m.tools['notes__get_lists']({}, { confirm: async () => true }); return { app: m.app, lists: JSON.parse(typeof res.content === 'string' ? res.content : JSON.stringify(res.content)).lists }; });
  check(r.app === 'aos' && Array.isArray(r.lists) && r.lists.length > 0, `Ipsy in aOS runs Notes' own tool inside Notes ${tag}`);
  check(await pg.evaluate(async () => { const res = await AllisonOS.ipsy.mounted.tools['fitness__days']({}, {}); return !!res.error; }), `and has no Fitness tool ${tag}`);

  // moving in: what Clock kept on the phone is in place before Clock first opens inside aOS
  if (look === 'vintage') {
    let took = 0;
    await pg.evaluate(() => localStorage.setItem('aos.session', JSON.stringify({ token: 't', user: { id: 'O1', name: 'Tom', role: 'owner' }, at: Date.now() })));
    await pg.route('**/aOS/api/handoff/take', r => { took++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { 'wx.places': '[{"name":"Lisbon"}]' } }) }); });
    await pg.locator('.hrow[data-open="weather"]').count();
    await pg.evaluate(() => { localStorage.removeItem('wx.places'); });
    await pg.evaluate(() => aosHomeTab.show('places')); await pg.waitForTimeout(1500);
    check(took === 1 && await pg.evaluate(() => localStorage.getItem('wx.places')) === '[{"name":"Lisbon"}]' && await pg.evaluate(() => localStorage.getItem('aos.carry.in.places')) === 'done',
      `before an app first opens inside aOS, aOS takes what it kept on the phone, once ${tag}`);
    await pg.evaluate(() => aosHomeTab.show(null)); await pg.waitForTimeout(500);
    // back from Google: Mail, opened at the top of aOS's window with aos.away set, goes back into aOS
    await pg.evaluate(() => localStorage.setItem('aos.away', 'mail|' + Date.now()));
    await pg.goto(BASE + '/mail/'); await pg.waitForURL(/\/aOS\/#app=mail|\/aOS\/$/, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(1500);
    check(/\/aOS\//.test(pg.url()) && await pg.evaluate(() => document.body.classList.contains('in-app') && !!document.querySelector('.frame[data-id="mail"]:not([hidden])')), `back from Google's sign-in, Mail goes back into aOS, open ${tag}`);
    await pg.evaluate(() => localStorage.setItem('aos.away', 'mail|' + (Date.now() - 3600e3)));
    await pg.goto(BASE + '/mail/'); await pg.waitForTimeout(1500);
    check(/\/mail\//.test(pg.url()), `a sign-in given up on long ago doesn't pull Mail into aOS ${tag}`);
  }

  check(!errs.length, `no script errors ${tag}` + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}
await b.close();
server.close();
console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
