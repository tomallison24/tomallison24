// aOS 2's Home (aOS/home-tab.js): every app inside aOS. At iPhone size, Vintage and Sea glass, light
// and dark:
//   - Home first in the dock, in place of Apps, with Ipsy, Favorites and every app in groups
//   - a row opens the app inside aOS: full screen, "‹ aOS" over it, the app's content starting
//     clear of it (welcome.js takes aOS's insets as the app's safe-area spacing), no "add me" steps
//   - "‹ aOS" and a swipe in from the left edge go back; holding it lists the other open apps
//   - Favorites, mixed: a pin first, then the most used, then the starting four
//   - no dock: the three most used apps float at the bottom; Today and Search beside the account
//   - Ipsy in aOS runs an app's own tool inside that app (Notes' lists), opening it out of sight
//   - moving in: an app opened from its own icon hands its data over (or asks to sign in, to);
//     aOS takes it whichever opens first, and it wins over aOS's own copy
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
  m.set('handoff:taken:O1:notes', '1');   // taken by the first aOS 2, which dropped it
  check(!(await call('handoff', { app: 'notes', data: { k: 'v' } })).j.taken && m.has('handoff:O1:notes'), 'taken by the first aOS 2 (which kept its own copy): it moves again');
  check((await call('handoff/take', { app: 'weather' })).j.data === null && !m.has('handoff:taken2:O1:weather'), 'nothing waiting yet: aOS can ask again');
  // moving to a new aOS icon: everything, left by the old icon, taken once by the new one
  check((await call('move/take', {})).j.data === null, 'a new icon with nothing left for it: nothing to take');
  const big = 'x'.repeat(600 * 1024);
  check((await call('move', { data: { ls: { a: '1', big } } })).j.ok && m.has('move:O1'), 'the old icon leaves everything, more than one app\'s worth too');
  const mv = await call('move/take', {});
  check(mv.j.data && mv.j.data.ls.a === '1' && mv.j.data.ls.big.length === big.length && !m.has('move:O1'), 'the new icon takes it, and then it\'s deleted');
  check((await call('move', { data: { ls: { a: 'x'.repeat(5.2 * 1024 * 1024) } } })).status === 413, 'but not without end');
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

  await pg.goto(BASE + '/aOS/'); await pg.waitForTimeout(900);
  check(await pg.isVisible('#home') && await pg.locator('.bar .tabs').isHidden() && await pg.locator('#opennow').count() === 0, `Home opens first, with no dock and no Open now ${tag}`);
  const quick = () => pg.evaluate(() => [...document.querySelectorAll('.quick [data-open]')].map(b => b.dataset.open).join());
  check(await quick() === 'calendar,meals,notes' && await pg.locator('.quick .qhome').isHidden(), `three apps float at the bottom: the starting ones, before any are used ${tag}`);
  await pg.locator('#home .hbtn[data-tab="today"]').click(); await pg.waitForTimeout(400);
  check(await pg.isVisible('#today') && await pg.locator('.quick .qhome').isVisible(), `Today, from beside the account; Home joins the apps at the bottom there ${tag}`);
  await pg.locator('.quick .qhome').click(); await pg.waitForTimeout(400);
  await pg.locator('#home .hbtn[data-tab="search"]').click(); await pg.waitForTimeout(400);
  check(await pg.isVisible('#search'), `and Search ${tag}`);
  await pg.locator('.quick .qhome').click(); await pg.waitForTimeout(400);
  check(await pg.locator('#ipsySlot .ipsy-btn').count() === 1 && /Calendar, Notes, Meals, Orders, Travel and News/.test(await pg.textContent('#ipsySub')), `Ipsy at the top, across six apps ${tag}`);
  check(await pg.locator('#favs .fav').count() === 4 && await pg.locator('#spaces .hrow').count() === 14, `four favorites and every app ${tag}`);
  await pg.locator('#askIpsy b').click(); await pg.waitForTimeout(700);
  const bub = await pg.locator('.ipsy-bubble').boundingBox(), ask = await pg.locator('#askIpsy').boundingBox();
  check(bub && bub.y >= ask.y + ask.height && bub.y + bub.height <= 844 && !/helper/.test(await pg.textContent('.ipsy-head')), `Ipsy's chat opens below Ask Ipsy, on screen, without the extra words ${tag}`);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
  if (look === 'vintage') {   // under an iPhone's solid status bar, the sky fades in from the ground at the top
    await pg.evaluate(() => { localStorage.setItem('aos.bar', 'solid'); }); await pg.reload(); await pg.waitForTimeout(900);
    const capTop = await pg.evaluate(() => { const c = document.querySelector('#home .atoms .aos-sky-cap, .atoms .aos-sky-cap'); return c && getComputedStyle(c).display !== 'none' ? Math.round(c.getBoundingClientRect().top) : null; });
    check(capTop === 0, `under a solid status bar, the sky fades in at the top of the page (${capTop}) ${tag}`);
    // the bar takes its colour from #barcap: the app's own while it's open (its top fades into it), aOS's again after
    const bar = () => pg.evaluate(() => getComputedStyle(document.getElementById('barcap')).backgroundColor);
    const homeBar = await bar();
    await pg.evaluate(() => { localStorage.setItem('design.weather', 'glass'); aosHomeTab.show('weather'); }); await pg.waitForTimeout(2200);
    const inApp = await pg.evaluate(() => { const f = document.querySelector('.frame[data-id="weather"] iframe'), d = f.contentDocument, fade = d.getElementById('aos-topfade');
      return { bar: getComputedStyle(document.getElementById('barcap')).backgroundColor, top: f.contentWindow.AllisonOS.topColor(), fade: !!fade && !fade.hidden && getComputedStyle(fade).backgroundImage.includes(f.contentWindow.AllisonOS.topColor()) }; });
    check(homeBar === await pg.evaluate(() => getComputedStyle(document.body).backgroundColor) && inApp.bar === inApp.top && inApp.bar !== homeBar && inApp.fade,
      `under a solid status bar, the bar is the app's own colour while it's open, and its top fades into it (${homeBar} > ${inApp.bar}) ${tag}`);
    await pg.evaluate(() => aosHomeTab.show(null)); await pg.waitForTimeout(600);
    check(await bar() === homeBar, `and aOS's again on the way back ${tag}`);
    await pg.evaluate(() => localStorage.removeItem('design.weather'));
    await pg.evaluate(() => localStorage.removeItem('aos.bar')); await pg.reload(); await pg.waitForTimeout(900);
  }

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
  check(!s.inApp && s.hash === '' && await pg.isVisible('#home'), `"‹ aOS" goes back ${tag}`);
  await pg.locator('.hrow[data-open="weather"]').click(); await pg.waitForTimeout(1200);
  await pg.mouse.move(5, 420); await pg.mouse.down(); await pg.mouse.move(280, 420, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(600);
  check(!(await state()).inApp, `a swipe in from the left edge goes back ${tag}`);
  await pg.locator('.quick [data-open="notes"]').click(); await pg.waitForTimeout(700);
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
  const q = (await quick()).split(',');
  check(q.length === 3 && q.includes('notes') && q.includes('weather'), `the apps at the bottom are the ones you use most (${q.join(' ')}) ${tag}`);

  const r = await pg.evaluate(async () => { const m = AllisonOS.ipsy.mounted; const res = await m.tools['notes__get_lists']({}, { confirm: async () => true }); return { app: m.app, lists: JSON.parse(typeof res.content === 'string' ? res.content : JSON.stringify(res.content)).lists }; });
  check(r.app === 'aos' && Array.isArray(r.lists) && r.lists.length > 0, `Ipsy in aOS runs Notes' own tool inside Notes ${tag}`);
  check(await pg.evaluate(async () => { const res = await AllisonOS.ipsy.mounted.tools['fitness__days']({}, {}); return !!res.error; }), `and has no Fitness tool ${tag}`);

  // moving in: what an app kept on its own icon's storage moves into aOS, whichever opens first
  if (look === 'vintage') {
    let took = 0, give = null, wait = 0;
    await pg.evaluate(() => localStorage.setItem('aos.session', JSON.stringify({ token: 't', user: { id: 'O1', name: 'Tom', role: 'owner' }, at: Date.now() })));
    await ctx.addInitScript(() => { if (window.top !== window) window.__saw = localStorage.getItem('mail.test'); });
    await pg.route('**/aOS/api/handoff/take', async r => { took++; const d = give; give = null; if (wait) await new Promise(ok => setTimeout(ok, wait)); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: d }) }); });
    // aOS first: nothing waiting yet, and News opens here with its own copy
    await pg.evaluate(() => localStorage.setItem('news.test', 'aos'));
    await pg.evaluate(() => aosHomeTab.show('news')); await pg.waitForTimeout(1500);
    check(took === 1 && await pg.evaluate(() => !!document.querySelector('.frame[data-id="news"] iframe').getAttribute('src') && localStorage.getItem('aos.carry2.in.news') !== 'done'),
      `aOS asks first, nothing's waiting: News opens anyway, and aOS will ask again ${tag}`);
    await pg.evaluate(() => { aosHomeTab.show(null); const w = document.querySelector('.frame[data-id="news"] iframe').contentWindow; w.__old = 1; w.addEventListener('pagehide', () => w.localStorage.setItem('news.test', 'stale')); });   // an app that saves as it closes
    // then News is opened from its own icon (it hands over), and you come back to News in aOS
    give = { 'news.test': 'icon' }; await pg.evaluate(() => aosHomeTab.carried());
    await pg.evaluate(() => aosHomeTab.show('news')); await pg.waitForTimeout(2500);
    check(took === 2 && await pg.evaluate(() => localStorage.getItem('news.test') === 'icon' && JSON.parse(localStorage.getItem('aos.carry2.was.news') || '{}')['news.test'] === 'aos' && localStorage.getItem('aos.carry2.in.news') === 'done'),
      `back in News: what came from its icon wins over aOS's copy, which is kept aside ${tag}`);
    check(await pg.evaluate(() => !document.querySelector('.frame[data-id="news"] iframe').contentWindow.__old && /News.s data moved in/.test(document.getElementById('htoast').textContent)),
      `and News opens again with it, saying so ${tag}`);
    await pg.evaluate(() => aosHomeTab.show(null)); await pg.waitForTimeout(400);
    // an app not open yet waits for what's coming (a few seconds at most) before it starts
    give = { 'mail.test': 'icon' }; wait = 1500;
    await pg.evaluate(() => aosHomeTab.show('mail')); await pg.waitForTimeout(600);
    const early = await pg.evaluate(() => document.querySelector('.frame[data-id="mail"] iframe').getAttribute('src'));
    await pg.waitForTimeout(2500); wait = 0;
    const mf = pg.frames().find(f => f.url().includes('/mail/'));
    check(!early && mf && await mf.evaluate(() => window.__saw) === 'icon', `Mail starts only once what it kept is in place, and starts with it ${tag}`);
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
// ---- moving to another aOS icon (aOS/app.js, "moving to another aOS icon") ----
{
  let left = null;
  const icon = async (fresh, tab = false) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.fulfill({ status: 503, body: '' }));
    await ctx.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
    const user = { id: 'O1', name: 'Tom', role: 'member', apps: {} };
    await ctx.route('**/aOS/api/state', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ storage: true, setup: true, user, plan: null }) }));
    await ctx.route('**/aOS/api/move', r => { left = JSON.parse(r.request().postData()).data; r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
    let took = 0;
    // (it keeps handing it over, as a stale read of the account could just after: the icon takes it once)
    await ctx.route('**/aOS/api/move/take', r => { took++; const d = fresh ? left : null; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: d }) }); });
    await ctx.addInitScript(([apps, fresh, tab]) => { if (!tab) Object.defineProperty(navigator, 'standalone', { get: () => true }); if (window.top !== window || sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      const s = { aos: '999' }; for (const a of apps) s[a] = '999';
      localStorage.setItem('aos.seen', JSON.stringify(s)); localStorage.setItem('aos.signin.asked', '1');
      localStorage.setItem('aos.session', JSON.stringify({ token: fresh ? 'new' : 'old', user: { id: 'O1', name: 'Tom', role: 'member' }, at: Date.now() }));
      if (fresh) localStorage.setItem('allison-clock-v1', '{"alarms":[]}');   // the other icon had its own (older) copy
    if (!fresh) { localStorage.setItem('allison-clock-v1', '{"alarms":[{"at":"07:00"}]}'); localStorage.setItem('mail.token', 'secret');
        const r = indexedDB.open('allison-notes', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put({ url: 'https://sheet' }, 'sheet'); }; } }, [APPS, fresh, tab]);
    const pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(BASE + '/aOS/'); await pg.waitForTimeout(1200);
    return { ctx, pg, errs, took: () => took };
  };
  const old = await icon(false);
  check(old.took() === 1, 'an aOS icon on the Home Screen asks whether something was left for it as it opens');
  await old.pg.locator('.tab:not([hidden]) [data-acct]').click(); await old.pg.waitForSelector('#mGo', { timeout: 8000 });
  await old.pg.click('#mGo'); await old.pg.waitForFunction(() => /Remove App/.test(document.getElementById('mErr').textContent), null, { timeout: 8000 }).catch(() => {});
  const notes = left && (left.idb || []).find(d => d.name === 'allison-notes');
  check(left && left.ls['allison-clock-v1'] && !('mail.token' in left.ls) && !('aos.session' in left.ls) && notes && notes.stores[0].rows[0][1].url === 'https://sheet',
    'Get ready to move leaves every app\'s data and databases, but not the sign-ins');
  await old.pg.reload(); await old.pg.waitForTimeout(1200);
  check(old.took() === 1, 'the icon that left it doesn\'t take its own back');
  check(!old.errs.length, 'no script errors (the old icon)' + (old.errs.length ? ': ' + old.errs.join(' | ') : ''));
  await old.ctx.close();
  const tab = await icon(true, true);
  check(tab.took() === 0, 'aOS in Safari, signed in, where the new icon is added from: it doesn\'t take what was left');
  await tab.ctx.close();
  const neu = await icon(true); await neu.pg.waitForTimeout(1500);
  const got = await neu.pg.evaluate(() => new Promise(ok => { const r = indexedDB.open('allison-notes'); r.onsuccess = () => { try { const q = r.result.transaction('kv').objectStore('kv').get('sheet'); q.onsuccess = () => ok({ clock: localStorage.getItem('allison-clock-v1'), sheet: q.result && q.result.url, toast: document.getElementById('htoast').textContent }); } catch { ok({}); } }; r.onerror = () => ok({}); }));
  check(neu.took() >= 1 && /07:00/.test(got.clock || '') && got.sheet === 'https://sheet' && /moved in/.test(got.toast || ''), `the other icon, signed in, takes it all (it wins over what that icon had) and opens again with it (${JSON.stringify(got).slice(0, 120)})`);
  check(!neu.errs.length, 'no script errors (the new icon)' + (neu.errs.length ? ': ' + neu.errs.join(' | ') : ''));
  await neu.ctx.close();
}

// ---- moving in, from an app's own Home Screen icon (../home/welcome.js, "moving into aOS 2") ----
for (const signedIn of [false, true]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.fulfill({ status: 503, body: '' }));
  await ctx.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
  await ctx.route('**/aOS/api/state', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"storage":true,"setup":true}' }));
  await ctx.route('**/aOS/api/installed', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  const sent = [];
  await ctx.route('**/aOS/api/handoff', r => { sent.push(JSON.parse(r.request().postData() || '{}')); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await ctx.addInitScript(([apps, signedIn]) => {
    Object.defineProperty(navigator, 'standalone', { get: () => true });
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    const s = { aos: '999' }; for (const a of apps) s[a] = '999';
    localStorage.setItem('aos.seen', JSON.stringify(s)); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('news.test', 'icon');
    if (signedIn) localStorage.setItem('aos.session', JSON.stringify({ token: 't', user: { id: 'O1', name: 'Tom', role: 'owner' }, at: Date.now() }));
  }, [APPS, signedIn]);
  const pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(BASE + '/news/'); await pg.waitForSelector('#aos-moved', { timeout: 8000 }).catch(() => {});
  const note = await pg.evaluate(() => { const el = document.getElementById('aos-moved'); return el ? { text: el.innerText, faceId: !!el.querySelector('.m-go') } : null; });
  if (!signedIn) check(note && note.faceId && /Sign in, and what News keeps on this phone moves into aOS/.test(note.text) && !sent.length, 'from its own icon, not signed in: "lives in aOS now" offers to move its data with Face ID');
  else check(note && !note.faceId && /on its way/.test(note.text) && sent.length === 1 && sent[0].app === 'news' && sent[0].data['news.test'] === 'icon',
    `signed in: it hands what it keeps on the phone to the family account, once, and says so (${sent.length} sent)`);
  check(!errs.length, `no script errors (from its icon, ${signedIn ? 'signed in' : 'signed out'})` + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}

await b.close();
server.close();
console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
