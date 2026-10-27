// aOS 2's Home (aOS/home-tab.js): every app inside aOS. At iPhone size, Vintage and Sea glass, light
// and dark:
//   - Home first, in place of Apps: the Ipsy bar, Favorites with the Weather and Calendar widgets,
//     and every app as an icon in groups, so one tap opens any app
//   - the widgets: Weather's forecast fetched again when aOS opens or comes back and it's over 10
//     minutes old; drawn again, nothing that didn't change is replaced, and nothing under a finger
//   - the Ipsy bar finds the app as you type (Return opens it) and what's in the apps, never a
//     hidden order or a note in the Trash; a note found opens Notes at it
//   - an icon opens the app inside aOS: full screen, "‹ aOS" over it, the app's content starting
//     clear of it (welcome.js takes aOS's insets as the app's safe-area spacing), no "add me" steps
//   - "‹ aOS" and a swipe in from the left edge go back; holding it lists the other open apps
//   - Favorites, mixed: a pin first, then the most used, then the starting four
//   - Thumb arc (Home layout): the fixed four and four favorites on two rings in the corner, every app on the
//     first screen (a small phone too), the orb going to the Ipsy bar, Edit, the left hand, and Classic again
//   - no dock, nothing floats over Home (Home floats at the bottom on Today); Mail's unread count on
//     its icon; Today beside the account; Home scrolls in its own box, the page never moves
//   - Ipsy in aOS runs an app's own tool inside that app (Notes' lists), opening it out of sight
//   - settings that follow you between devices (aOS/prefs-sync.js): a new iPad opens with the iPhone's,
//     its empty ones replace nothing; never a location, a sign-in or Clock's running timers
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
  check(names.length > 40 && new Set(names).size === names.length && names.every(n => /^(calendar|notes|meals|orders|travel|news|weather|house)__[a-z_]+$/.test(n)), `every Ipsy app's tools but Fitness's and Money's, and Weather's and Home's, each named with its app (${names.length})`);
  check(names.includes('travel__search_gmail') && names.includes('orders__search_gmail') && !names.some(n => /^fitness__/.test(n)), 'the same tool in two apps stays two tools; none from Fitness');
  check(/Fitness/.test(route.IPSY_SYSTEM) && /never put health details in a web search/.test(route.IPSY_SYSTEM), 'Ipsy is told why Fitness stays out, and to keep health out of web searches');
  check(names.includes('weather__get_forecast') && names.includes('house__control') && !names.some(n => /^money__/.test(n)) && /Money \(the family's spending\)/.test(route.IPSY_SYSTEM), 'Weather\'s and Home\'s tools, none from Money, and Ipsy is told why Money stays out');
  check(/Never the alarm, cameras, the doorbell or locks/.test(route.IPSY_SYSTEM), 'Ipsy is told it never changes the alarm, cameras or locks');
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
const APPS = ['mail', 'calendar', 'clock', 'news', 'weather', 'notes', 'podcasts', 'travel', 'places', 'fitness', 'drinks', 'meals', 'orders', 'money', 'house', 'sparkle'];
const b = await chromium.launch();
for (const [look, scheme] of [['vintage', 'light'], ['glass', 'dark']]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block', colorScheme: scheme });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.fulfill({ status: 503, body: '' }));
  await ctx.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
  await ctx.addInitScript(([apps, look]) => { if (window.top !== window) return;
    const s = { aos: '999' }; for (const a of apps) s[a] = '999';
    localStorage.setItem('aos.helper', '{"who":"mia","name":"Ipsy"}'); localStorage.setItem('aos.seen', JSON.stringify(s)); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.look', look); }, [APPS, look]);
  const pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  const tag = `(${look}, ${scheme})`;
  const state = () => pg.evaluate(() => ({ inApp: document.body.classList.contains('in-app'), shown: [...document.querySelectorAll('.frame')].filter(f => !f.hidden).map(f => f.dataset.id), hash: location.hash }));

  await pg.goto(BASE + '/aOS/'); await pg.waitForTimeout(900);
  check(await pg.isVisible('#home') && await pg.locator('.bar .tabs').isHidden() && await pg.locator('#opennow').count() === 0, `Home opens first, with no dock and no Open now ${tag}`);
  check(await pg.locator('.quick').isHidden() && await pg.locator('#home .hbtn').count() === 1, `nothing floats over Home; only Today by the account ${tag}`);
  await pg.evaluate(() => { document.getElementById('scroller').scrollTop = 600; }); await pg.waitForTimeout(100);
  check(await pg.evaluate(() => document.getElementById('scroller').scrollTop > 0 && scrollY === 0), `Home scrolls in its own box: the page itself stays put ${tag}`);
  // every app one tap away: all of them as icons, the first three groups on the first screen
  const apps = await pg.evaluate(() => [...document.querySelectorAll('#spaces .happ')].map(a => a.dataset.open));
  check(apps.length === APPS.length && new Set(apps).size === APPS.length, `every app, once each, as an icon (${apps.length}) ${tag}`);
  await pg.evaluate(() => { document.getElementById('scroller').scrollTop = 0; });
  const below = await pg.evaluate(() => Math.round(document.querySelector('#spaces .hcat:nth-child(2)').getBoundingClientRect().top));
  check(below < 844, `Every app starts on the first screen (${below}px) ${tag}`);
  // Favorites: Weather and Calendar as widgets, four other apps beside them
  const favIds = await pg.evaluate(() => [...document.querySelectorAll('#favs .fav')].map(f => f.dataset.open));
  check(favIds.length === 4 && !favIds.some(id => id === 'weather' || id === 'calendar') && await pg.locator('#favs .wid.wx[data-open="weather"]').count() === 1 && await pg.locator('#favs .wid.cal[data-open="calendar"]').count() === 1,
    `Favorites: the Weather and Calendar widgets and four other apps (${favIds.join()}) ${tag}`);
  await pg.evaluate(() => window.aosHome.unread('mail', 7));
  check(await pg.textContent('#spaces [data-open="mail"] .unread') === '7', `Mail's unread count on its icon ${tag}`);
  await pg.evaluate(() => window.aosHome.unread('mail', 0));
  check(await pg.locator('#home .unread').count() === 0, `none once it's all read ${tag}`);
  await pg.locator('#home .hbtn[data-tab="today"]').click(); await pg.waitForTimeout(400);
  check(await pg.isVisible('#today') && await pg.locator('.quick .qhome').isVisible(), `Today, from beside the account; Home floats at the bottom there ${tag}`);
  await pg.locator('.quick .qhome').click(); await pg.waitForTimeout(400);
  check(await pg.isVisible('#home') && await pg.locator('.quick').isHidden(), `and takes you back ${tag}`);
  // the Ipsy bar: type and the app is found; Return opens it
  check(await pg.locator('#ipsySlot .ipsy-btn').count() === 1, `Ipsy at the top, in the bar ${tag}`);
  await pg.locator('#hq').fill('wea'); await pg.waitForTimeout(150);
  check(await pg.locator('#hmain').isHidden() && await pg.getAttribute('#hfound .htop', 'data-open') === 'weather' && /Ask Ipsy/.test(await pg.textContent('#hask')), `typing finds the app, Weather first, with Ask Ipsy under it ${tag}`);
  check(JSON.stringify(await pg.evaluate(() => ['ca', 'po', 'trip', 'h'].map(t => aosHomeTab.findApps(t)[0]))) === '["calendar","podcasts","travel","house"]', `the start of a name first, then what an app does ${tag}`);
  await pg.locator('#hq').press('Enter'); await pg.waitForTimeout(1200);
  check((await state()).shown.join() === 'weather' && await pg.inputValue('#hq') === '', `Return opens the top hit, and the bar is empty again ${tag}`);
  await pg.evaluate(() => aosHomeTab.show(null)); await pg.waitForTimeout(500);
  check(await pg.isVisible('#hmain'), `back on Home, Favorites and every app again ${tag}`);
  await pg.locator('#hq').fill('zzqx'); await pg.waitForTimeout(150);
  check(await pg.locator('#hfound .htop').count() === 0 && /Nothing on this phone/.test(await pg.textContent('#hfound')), `nothing found says so, and offers Ipsy ${tag}`);
  await pg.locator('#hq').press('Escape'); await pg.waitForTimeout(100);
  check(await pg.inputValue('#hq') === '' && await pg.isVisible('#hmain'), `Escape clears it ${tag}`);
  // now and then your helper crosses the bar and back, in its own way; a tap sends it home at once; never with Reduce Motion
  check(await pg.evaluate(() => aosHomeTab.roll()) === true, `Ipsy crosses the bar ${tag}`);
  await pg.waitForTimeout(1000);
  const rollMid = () => pg.evaluate(() => ({ x: Math.round(new DOMMatrix(getComputedStyle(document.getElementById('ipsySlot')).transform).m41), turn: getComputedStyle(document.querySelector('#ipsySlot .h-pose')).transform !== 'none' || document.querySelector('#ipsySlot .ipsy-host').dataset.mood === 'cross', rolling: document.getElementById('askIpsy').classList.contains('rolling'), words: getComputedStyle(document.getElementById('hq')).opacity }));
  const mid = await rollMid();
  check(mid.x > 80 && mid.turn && mid.rolling && mid.words === '0', `it's out along the bar, in its move, the words out of its way (${JSON.stringify(mid)}) ${tag}`);
  await pg.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await pg.waitForTimeout(50);
  const home = await rollMid();
  check(home.x === 0 && !home.rolling, `a tap sends it home (${JSON.stringify(home)}) ${tag}`);
  await pg.emulateMedia({ reducedMotion: 'reduce' });
  check(await pg.evaluate(() => aosHomeTab.roll()) === false, `never with Reduce Motion ${tag}`);
  await pg.emulateMedia({ reducedMotion: 'no-preference' });
  await pg.locator('#hq').fill('w');
  check(await pg.evaluate(() => aosHomeTab.roll()) === false, `nor while you type ${tag}`);
  await pg.locator('#hq').press('Escape'); await pg.waitForTimeout(100);
  await pg.locator('#ipsySlot .ipsy-btn').click(); await pg.waitForTimeout(700);
  const bub = await pg.locator('.ipsy-bubble').boundingBox(), ask = await pg.locator('#askIpsy').boundingBox();
  check(bub && bub.y >= ask.y + ask.height && bub.y + bub.height <= 844 && !/helper/.test(await pg.textContent('.ipsy-head')), `Ipsy's chat opens below the Ipsy bar, on screen, without the extra words ${tag}`);
  // typing: the keyboard takes the bottom 336px and iOS scrolls the page 120px to the box (the visual viewport)
  await pg.evaluate(() => { const v = visualViewport; Object.defineProperty(v, 'height', { get: () => 844 - 336 - 120, configurable: true }); Object.defineProperty(v, 'offsetTop', { get: () => 120, configurable: true }); v.dispatchEvent(new Event('resize')); });
  await pg.waitForTimeout(500);
  const kb = await pg.evaluate(() => { const r = e => e.getBoundingClientRect(); const sp = r(document.querySelector('.ipsy-speaker')), bb = r(document.querySelector('.ipsy-bubble')), inp = r(document.querySelector('.ipsy-in'));
    return { ipsy: Math.round(sp.top), top: Math.round(bb.top), bottom: Math.round(bb.bottom), input: Math.round(inp.bottom) }; });
  check(kb.ipsy >= 120 && kb.ipsy < 160 && kb.top > kb.ipsy && kb.bottom <= 508 && kb.input <= 508,
    `typing, Ipsy and the chat stay in what's still in sight, above the keyboard (${JSON.stringify(kb)}) ${tag}`);
  await pg.evaluate(() => { delete visualViewport.height; delete visualViewport.offsetTop; visualViewport.dispatchEvent(new Event('resize')); });
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
    check(homeBar === await pg.evaluate(() => (b => /,\s*0\)$|transparent/.test(b) ? getComputedStyle(document.documentElement).backgroundColor : b)(getComputedStyle(document.body).backgroundColor)) && inApp.bar === inApp.top && inApp.bar !== homeBar && inApp.fade,
      `under a solid status bar, the bar is the app's own colour while it's open, and its top fades into it (${homeBar} > ${inApp.bar}) ${tag}`);
    await pg.evaluate(() => aosHomeTab.show(null)); await pg.waitForTimeout(600);
    check(await bar() === homeBar, `and aOS's again on the way back ${tag}`);
    await pg.evaluate(() => localStorage.removeItem('design.weather'));
    await pg.evaluate(() => localStorage.removeItem('aos.bar')); await pg.reload(); await pg.waitForTimeout(900);
  }

  await pg.locator('.happ[data-open="notes"]').click(); await pg.waitForTimeout(2200);
  let s = await state();
  check(s.inApp && s.shown.join() === 'notes' && s.hash === '#app=notes', `an icon opens the app inside aOS ${tag}`);
  const nf = pg.frames().find(f => f.url().includes('/notes/'));
  const top = await nf.evaluate(() => { const h = document.querySelector('h1'); return h ? Math.round(h.getBoundingClientRect().top) : -1; });
  check(top >= 50, `the app's content starts clear of "‹ aOS" (its title at ${top}px) ${tag}`);
  check(await nf.evaluate(() => !document.getElementById('aos-welcome')), `no "add me" steps inside aOS ${tag}`);
  const pill = await pg.locator('#appback').boundingBox();
  check(pill && pill.y < 50 && pill.x < 30, `"‹ aOS" floats in the top left corner ${tag}`);

  await pg.locator('#appback').click(); await pg.waitForTimeout(600);
  s = await state();
  check(!s.inApp && s.hash === '' && await pg.isVisible('#home'), `"‹ aOS" goes back ${tag}`);
  await pg.evaluate(() => { window.__same = 1; aosHomeTab.show('notes'); }); await pg.waitForTimeout(500);
  await pg.goBack(); await pg.waitForTimeout(500);
  s = await state();
  check(!s.inApp && s.hash === '' && await pg.evaluate(() => window.__same === 1), `the phone's own back (an iPhone's edge swipe) goes to Home, staying in aOS ${tag}`);
  await pg.locator('.happ[data-open="weather"]').click(); await pg.waitForTimeout(1200);
  await pg.mouse.move(5, 420); await pg.mouse.down(); await pg.mouse.move(280, 420, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(600);
  check(!(await state()).inApp, `a swipe in from the left edge goes back ${tag}`);
  await pg.locator('.happ[data-open="notes"]').click(); await pg.waitForTimeout(700);
  const bb = await pg.locator('#appback').boundingBox();
  await pg.mouse.move(bb.x + 10, bb.y + 10); await pg.mouse.down(); await pg.waitForTimeout(600); await pg.mouse.up(); await pg.waitForTimeout(200);
  check(/Weather/.test(await pg.textContent('#appmenu')) && await pg.isVisible('#appmenu'), `holding "‹ aOS" lists the other open apps ${tag}`);
  await pg.locator('#appmenu [data-to="weather"]').click(); await pg.waitForTimeout(500);
  check((await state()).shown.join() === 'weather', `and goes straight to one ${tag}`);
  await pg.locator('#appback').click(); await pg.waitForTimeout(500);

  await pg.locator('#favEdit').click();
  await pg.locator('.happ[data-open="house"] [data-pin]').click();
  await pg.locator('#favEdit').click();
  const favs = await pg.evaluate(() => aosHomeTab.favorites().map(f => f.id + ':' + f.why));
  check(favs[0] === 'house:pin' && favs.some(f => /:used$/.test(f)) && favs.length === 4, `Favorites, mixed: the pin, then the most used, then the starters (${favs.join(' ')}) ${tag}`);
  check(await pg.locator('.happ[data-open="weather"] [data-pin], .happ[data-open="calendar"] [data-pin]').count() === 0, `Weather and Calendar, widgets already, have no pin ${tag}`);

  const r = await pg.evaluate(async () => { const m = AllisonOS.ipsy.mounted; const res = await m.tools['notes__get_lists']({}, { confirm: async () => true }); return { app: m.app, lists: JSON.parse(typeof res.content === 'string' ? res.content : JSON.stringify(res.content)).lists }; });
  check(r.app === 'aos' && Array.isArray(r.lists) && r.lists.length > 0, `Ipsy in aOS runs Notes' own tool inside Notes ${tag}`);
  check(await pg.evaluate(async () => { const res = await AllisonOS.ipsy.mounted.tools['fitness__days']({}, {}); return !!res.error; }), `and has no Fitness tool ${tag}`);
  const wx = await pg.evaluate(async () => { const res = await AllisonOS.ipsy.mounted.tools['weather__get_places']({}, {}); return res && res.content && Array.isArray(res.content.places); });
  check(wx, `and Weather's, inside Weather, which has no chat of its own ${tag}`);

  // moving in: what an app kept on its own icon's storage moves into aOS, whichever opens first
  if (look === 'vintage') {
    let took = 0, give = null, wait = 0;
    await pg.evaluate(() => localStorage.setItem('aos.session', JSON.stringify({ token: 't', user: { id: 'O1', name: 'Tom', role: 'owner' }, at: Date.now() })));
    await ctx.addInitScript(() => { if (window.top !== window) window.__saw = localStorage.getItem('mail.test'); });
    await pg.route('**/aOS/api/handoff/take', async r => { took++; const d = give; give = null; if (wait) await new Promise(ok => setTimeout(ok, wait)); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: d }) }); });
    // aOS first: nothing waiting yet, and News opens here with its own copy
    await pg.evaluate(() => localStorage.setItem('news.test', 'aos'));
    await pg.evaluate(() => aosHomeTab.show('news')); await pg.waitForTimeout(1500);
    check(took === 1 && await pg.evaluate(() => document.querySelector('.frame[data-id="news"] iframe').contentWindow.location.href !== 'about:blank' && localStorage.getItem('aos.carry2.in.news') !== 'done'),
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
    const early = await pg.evaluate(() => document.querySelector('.frame[data-id="mail"] iframe').contentWindow.location.href !== 'about:blank');
    await pg.waitForTimeout(2500); wait = 0;
    const mf = pg.frames().find(f => f.url().includes('/mail/'));
    check(!early && mf && await mf.evaluate(() => window.__saw) === 'icon', `Mail starts only once what it kept is in place, and starts with it ${tag}`);
    // Safari can count a frame's first page as a step of its own: the phone's back swipe then took Mail's
    // frame back to the blank page it started on. Opening an app adds no step, and a frame back on that
    // blank page opens the app again.
    const len = await pg.evaluate(() => history.length);
    await pg.evaluate(() => { aosHomeTab.show(null); aosHomeTab.show('mail'); }); await pg.waitForTimeout(300);
    await pg.evaluate(() => document.querySelector('.frame[data-id="mail"] iframe').contentWindow.location.replace('about:blank')); await pg.waitForTimeout(2000);
    check(await pg.evaluate(() => /\/mail\/$/.test(document.querySelector('.frame[data-id="mail"] iframe').contentWindow.location.href)) && await pg.evaluate(() => history.length) <= len + 1,
      `a frame back on its blank page opens its app again ${tag}`);
    await pg.evaluate(() => aosHomeTab.show(null)); await pg.waitForTimeout(500);
    // back from Google: Mail, opened at the top of aOS's window with aos.away set, goes back into aOS
    await pg.evaluate(() => localStorage.setItem('aos.away', 'mail|' + Date.now()));
    await pg.goto(BASE + '/mail/'); await pg.waitForURL(/\/aOS\/#app=mail|\/aOS\/$/, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(1500);
    check(/\/aOS\//.test(pg.url()) && await pg.evaluate(() => document.body.classList.contains('in-app') && !!document.querySelector('.frame[data-id="mail"]:not([hidden])')), `back from Google's sign-in, Mail goes back into aOS, open ${tag}`);
    await pg.evaluate(() => { window.__same = 1; }); await pg.goBack(); await pg.waitForTimeout(800);
    check(/\/aOS\/$/.test(pg.url()) && await pg.evaluate(() => window.__same === 1 && !document.body.classList.contains('in-app')), `and the phone's back from there goes to aOS Home, not to the page before ${tag}`);
    await pg.evaluate(() => localStorage.setItem('aos.away', 'mail|' + (Date.now() - 3600e3)));
    await pg.goto(BASE + '/mail/'); await pg.waitForTimeout(1500);
    check(/\/mail\//.test(pg.url()), `a sign-in given up on long ago doesn't pull Mail into aOS ${tag}`);
  }

  // the widgets and "In your apps" (aOS/home-find.js), from what the apps keep on this phone
  if (look === 'glass') {
    await pg.evaluate(() => {
      const now = Date.now(), z = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      const ev = (uid, from, t) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART:${z(from)}\r\nDTEND:${z(from + 3600e3)}\r\nSUMMARY:${t}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
      localStorage.setItem('allison-calendar-v1-items', JSON.stringify({ win: { from: now - 90 * 864e5, to: now + 400 * 864e5 }, at: now,
        items: [{ name: 'a.ics', ics: ev('a', now + 3600e3, 'Soccer practice') }, { name: 'b.ics', ics: ev('b', now - 86400e3 * 3, 'Old dentist visit') }] }));
      localStorage.setItem('wx.here', JSON.stringify({ lat: 39.74, lon: -104.99, name: 'Denver' }));
      localStorage.setItem('wx.cache', JSON.stringify({ '39.740,-104.990': { tz: 'America/Denver', place: 'Denver', fetchedAt: now, cur: { tF: 64, c: 'partlycloudy' }, hourly: [], daily: [{ t: Math.floor(now / 1000), hF: 70, lF: 52, c: 'sunny' }] } }));
      localStorage.setItem('allison-notes-v1', JSON.stringify({ notes: [{ id: 'n1', title: 'Soccer snacks', body: 'oranges', updated: now }, { id: 'n2', title: 'Soccer secret', body: '', deletedAt: now }], lists: [], todos: [] }));
      localStorage.setItem('allison-orders-v1', JSON.stringify({ orders: [{ id: 'o1', store: 'Amazon', items: [{ name: 'Soccer ball' }], status: 'shipped' }, { id: 'o2', store: 'Etsy', items: [{ name: 'Soccer jersey gift' }], status: 'ordered', hide: true }] }));
      localStorage.setItem('allison-orders-v1-log', JSON.stringify([{ store: 'Etsy', items: ['Soccer jersey gift'] }]));
      aosHomeTab.show(null);
    });
    await pg.waitForTimeout(300);
    check(await pg.textContent('#favs .wx .big') === '64°' && /Partly cloudy/.test(await pg.textContent('#favs .wx')) && /H 70° L 52°/.test(await pg.textContent('#favs .wx')), `the Weather widget: Weather's own last forecast ${tag}`);
    check(await pg.textContent('#favs .cal b') === 'Soccer practice' && /Next/.test(await pg.textContent('#favs .cal em')), `the Calendar widget: what's next ${tag}`);
    // drawn again (back on the phone, a new unread count), what didn't change stays the same element,
    // and nothing is swapped out under a finger: iOS drops a tap whose button is replaced mid-tap
    await pg.evaluate(() => { document.querySelector('#favs .wx').__same = 1; document.querySelector('#spaces .happ').__same = 1; document.dispatchEvent(new Event('visibilitychange', { bubbles: true })); });
    check(await pg.evaluate(() => document.querySelector('#favs .wx').__same === 1 && document.querySelector('#spaces .happ').__same === 1), `drawn again, the widgets and icons that didn't change stay as they are ${tag}`);
    const held = await pg.evaluate(async () => { const w = document.querySelector('#spaces [data-open="mail"]'); w.__same = 1;
      w.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); aosHome.unread('mail', 4);
      const during = document.querySelector('#spaces [data-open="mail"]') === w;
      w.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); await new Promise(r => setTimeout(r, 1100));
      const after = document.querySelector('#spaces [data-open="mail"] .unread'); aosHome.unread('mail', 0); return during && !!after && after.textContent === '4'; });
    check(held, `a new count waits for the finger to lift, then shows ${tag}`);
    // aOS opening, or back on the phone: a forecast over 10 minutes old is fetched again, with Weather's own
    // code, and kept in Weather's cache for Weather too
    await pg.evaluate(() => { const c = JSON.parse(localStorage.getItem('wx.cache')); c['39.740,-104.990'].fetchedAt = Date.now() - 3 * 3600e3; localStorage.setItem('wx.cache', JSON.stringify(c));
      window.__asked = 0; WXD.fetchBase = async () => { window.__asked++; return { tz: 'America/Denver', place: 'Denver', cur: { tF: 41, c: 'rainy' }, hourly: [], daily: [{ t: Math.floor(Date.now() / 1000), hF: 50, lF: 38, c: 'rainy' }] }; };
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true })); });
    await pg.waitForTimeout(900);
    check(await pg.textContent('#favs .wx .big') === '41°' && /Rain/.test(await pg.textContent('#favs .wx')) && await pg.evaluate(() => Date.now() - JSON.parse(localStorage.getItem('wx.cache'))['39.740,-104.990'].fetchedAt < 60e3),
      `an old forecast is fetched again as aOS comes back, and kept for Weather ${tag}`);
    await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))); await pg.waitForTimeout(300);
    check(await pg.evaluate(() => window.__asked) === 1, `a fresh one isn't fetched again ${tag}`);
    await pg.locator('#favs .wx').tap(); await pg.waitForTimeout(1200);
    check((await state()).shown.join() === 'weather', `a tap on the Weather widget opens Weather ${tag}`);
    await pg.evaluate(() => aosHomeTab.show(null)); await pg.waitForTimeout(500);
    await pg.locator('#hq').fill('socc'); await pg.waitForTimeout(200);
    const hits = await pg.evaluate(() => [...document.querySelectorAll('#hfound .hit')].map(h => h.dataset.open + ':' + h.querySelector('b').textContent));
    check(hits.includes('calendar:Soccer practice') && hits.includes('notes:Soccer snacks') && hits.includes('orders:Soccer ball') && hits.includes('calendar:Old dentist visit') === false,
      `In your apps: an event, a note, an order (${hits.join(', ')}) ${tag}`);
    check(!hits.some(h => /secret|jersey/.test(h)), `but never a note in the Trash or a hidden order, nor anything from Orders' log ${tag}`);
    const asked = [];
    pg.on('request', r => { if (r.isNavigationRequest()) asked.push(r.url()); });
    await pg.locator('#hfound .hit[data-open="notes"]').click(); await pg.waitForTimeout(1500);
    check((await state()).shown.join() === 'notes' && asked.some(u => /\/notes\/\?open=note:n1$/.test(u)) && await pg.inputValue('#hq') === '', `a note found opens Notes at that note ${tag}`);
    await pg.evaluate(() => aosHomeTab.show(null)); await pg.waitForTimeout(500);
  }

  check(!errs.length, `no script errors ${tag}` + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}
// ---- Thumb arc (Account > Appearance > Home layout): the fixed four and four favorites in the corner your thumb rests on ----
for (const [w, h, look] of [[390, 844, 'vintage'], [375, 667, 'glass']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.fulfill({ status: 503, body: '' }));
  await ctx.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
  await ctx.addInitScript(([apps, look]) => { if (window.top !== window || sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    const s = { aos: '999' }; for (const a of apps) s[a] = '999';
    localStorage.setItem('aos.seen', JSON.stringify(s)); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.look', look); localStorage.setItem('aos.tron.intro', 'off');
    localStorage.setItem('aos.home.picks', '["mail","drinks"]'); }, [APPS, look]);
  const pg = await ctx.newPage(), errs = [], tag = `(${w}x${h}, ${look})`;
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(BASE + '/aOS/'); await pg.waitForTimeout(900);
  check(await pg.evaluate(() => aosHomeTab.layout()) === 'classic' && await pg.isVisible('#favs') && await pg.locator('#harc').isHidden(), `Classic until you pick Thumb arc ${tag}`);
  // picked in Account > Appearance
  await pg.locator('.tab:not([hidden]) [data-acct]').click(); await pg.click('[aria-controls="fLook"]'); await pg.click('[data-hl="arc"]');
  check(await pg.evaluate(() => localStorage.getItem('aos.home.layout') === 'arc' && document.documentElement.dataset.home === 'arc'), `Account > Appearance > Home layout: Thumb arc ${tag}`);
  await pg.evaluate(() => document.querySelector('.page.on .close, .page .close').click()); await pg.waitForTimeout(600);
  const arc = await pg.evaluate(() => ({ inner: [...document.querySelectorAll('#harc .fav.in')].map(a => a.dataset.open), outer: [...document.querySelectorAll('#harc .fav[data-fav]')].map(a => a.dataset.open),
    rest: [...document.querySelectorAll('#hrest .happ')].map(a => a.dataset.open), classic: getComputedStyle(document.getElementById('favs')).display }));
  const all = [...arc.inner, ...arc.outer, ...arc.rest];
  check(arc.inner.join() === 'house,mail,weather,calendar', `the inner ring: Home, Mail, Weather and Calendar (${arc.inner}) ${tag}`);
  check(arc.outer.length === 4 && arc.outer[0] === 'drinks' && !arc.outer.some(id => arc.inner.includes(id)), `the outer ring: a pin first, then the most used, none of the four (${arc.outer}) ${tag}`);
  check(all.length === APPS.length && new Set(all).size === APPS.length && arc.classic === 'none', `every app once, the rest above the rings; Classic's Favorites give way (${all.length}) ${tag}`);
  // every app on the first screen, and no ring icon over another app
  const fit = await pg.evaluate(() => {
    const box = el => el.getBoundingClientRect(), on = r => r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
    const ring = [...document.querySelectorAll('#harc .fav, #harc .orb')].map(e => box(e.querySelector('.ic') || e)), rest = [...document.querySelectorAll('#hrest .happ')].map(box);
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    return { on: [...document.querySelectorAll('#harc [data-open], #hrest [data-open]')].every(e => on(box(e))), over: ring.some(a => rest.some(b => hit(a, b))), k: getComputedStyle(document.documentElement).getPropertyValue('--arck') };
  });
  check(fit.on && !fit.over, `every app on the first screen, no ring icon over another (scaled ${fit.k}) ${tag}`);
  await pg.evaluate(() => window.aosHome.unread('mail', 4)); await pg.waitForTimeout(100);
  check(await pg.textContent('#harc [data-open="mail"] .unread') === '4', `Mail's unread count on its icon on the ring ${tag}`);
  await pg.locator('#harc [data-open="mail"]').click(); await pg.waitForTimeout(900);
  check(await pg.evaluate(() => document.body.classList.contains('in-app') && [...document.querySelectorAll('.frame')].some(f => !f.hidden && f.dataset.id === 'mail')), `one tap on the ring opens Mail inside aOS ${tag}`);
  await pg.evaluate(() => aosHomeTab.show(null)); await pg.waitForTimeout(500);
  await pg.locator('#harc .orb').click(); await pg.waitForTimeout(150);
  check(await pg.evaluate(() => document.activeElement === document.getElementById('hq')), `the orb in the corner goes to the Ipsy bar ${tag}`);
  await pg.locator('#hq').fill('pod'); await pg.waitForTimeout(150);
  check(await pg.locator('#harc').isHidden(), `typing: the rings give way to what's found ${tag}`);
  await pg.locator('#hq').press('Escape'); await pg.waitForTimeout(100);
  // Edit: a star puts an app on the outer ring
  const extra = arc.rest[0];
  await pg.click('#arcEdit'); await pg.locator(`#hrest [data-pin="${extra}"]`).click(); await pg.click('#arcEdit'); await pg.waitForTimeout(100);
  check((await pg.evaluate(() => [...document.querySelectorAll('#harc .fav[data-fav]')].map(a => a.dataset.open))).slice(0, 2).join() === `drinks,${extra}` && !(await pg.locator(`#hrest [data-open="${extra}"]`).count()), `Edit: a star puts ${extra} on the outer ring ${tag}`);
  // left-handed: the other corner; and Classic again, with Mail back among its pins
  await pg.evaluate(() => aosHomeTab.layout('arc-left')); await pg.waitForTimeout(100);
  const orb = await pg.locator('#harc .orb').boundingBox(), meals = await pg.locator('#harc .fav[data-fav]').first().boundingBox();
  check(orb.x + orb.width / 2 < w / 2 && meals.x > orb.x, `Left-handed arc: the rings in the bottom left corner ${tag}`);
  await pg.evaluate(() => aosHomeTab.layout('classic')); await pg.waitForTimeout(100);
  check(await pg.isVisible('#favs') && await pg.locator('#harc').isHidden() && (await pg.evaluate(() => [...document.querySelectorAll('#favs .fav')].map(f => f.dataset.open))).slice(0, 2).join() === 'mail,drinks', `Classic again: Mail, pinned there, is back in Favorites ${tag}`);
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
  await old.pg.locator('.tab:not([hidden]) [data-acct]').click(); await old.pg.click('[aria-controls="fMove"]'); await old.pg.waitForSelector('#mGo', { timeout: 8000 });
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

// ---- settings that follow you between your devices (aOS/prefs-sync.js), on the real accounts API ----
{
  const { onRequest } = await import(path.join(R, 'functions/aOS/api/[[route]].js'));
  const { issue, putJSON } = await import(path.join(R, 'server/auth.js'));
  const m = new Map();
  const db = { get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, String(v)); }, delete: async k => { m.delete(k); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
  await db.put('owner', 'O1'); await putJSON(db, 'user:O1', { id: 'O1', name: 'Tom', role: 'owner', creds: [], created: Date.now() - 864e5 });
  const device = async seed => {
    const tok = await issue(db, 'O1');
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.fulfill({ status: 503, body: '' }));
    await ctx.route('**/api/**', async r => {
      const u = new URL(r.request().url());
      if (!/^\/aOS\/api\/(prefs|state)$/.test(u.pathname)) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
      const rq = r.request(), res = await onRequest({ request: new Request(u.href, { method: rq.method(), headers: rq.headers(), body: rq.method() === 'POST' ? rq.postData() : undefined }), params: { route: u.pathname.split('/aOS/api/')[1].split('/') }, env: { ACCOUNTS: db } });
      r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
    });
    await ctx.addInitScript(([apps, tok, seed]) => { if (window.top !== window || sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      const s = { aos: '999' }; for (const a of apps) s[a] = '999';
      localStorage.setItem('aos.seen', JSON.stringify(s)); localStorage.setItem('aos.signin.asked', '1');
      localStorage.setItem('aos.session', JSON.stringify({ token: tok, user: { id: 'O1', name: 'Tom', role: 'owner' }, at: Date.now() }));
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, [APPS, tok, seed]);
    const pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(BASE + '/aOS/'); await pg.waitForTimeout(1200);
    return { ctx, pg, errs };
  };
  const synced = () => JSON.parse(m.get('prefs:O1') || '{}');
  const back = pg => pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
  const ls = (pg, k) => pg.evaluate(k => localStorage.getItem(k), k);
  const DENVER = JSON.stringify([{ lat: 39.74, lon: -104.99, name: 'Denver', sub: 'CO' }]);
  // the iPad, new, opens aOS first: only what each app starts with (no places, Clock's own settings), so nothing goes up
  const ipad = await device({ 'wx.places': '[]', 'wx.units': 'us', 'home.settings': '{"theme":"auto"}',
    'allison-clock-v1': JSON.stringify({ timers: [], tab: 'world', cities: [], alarms: [], set: { h24: false, secs: false, analog: false, design: 'vintage', home: null }, tsound: 'twinbell', sleep: { set: false } }) });
  check(Object.keys(synced()).length === 0, `a new device with nothing set up sends nothing up (${Object.keys(synced()).join()})`);
  // the iPhone: set up already
  const phone = await device({ 'wx.places': DENVER, 'wx.here': '{"lat":35.7,"lon":-78.8,"name":"Apex"}', 'design.weather': 'glass', 'home.settings': '{"theme":"dark"}', 'aos.home.picks': '["house"]',
    'allison-clock-v1': JSON.stringify({ tab: 'timers', cities: [{ id: 'c1', name: 'London', where: 'UK', tz: 'Europe/London' }], alarms: [{ id: 'a1', h: 7, m: 0, days: [1, 2, 3, 4, 5], label: 'Up', on: true, next: Date.now() + 3600e3 }],
      timers: [{ id: 't1', dur: 600, state: 'run', end: Date.now() + 600e3 }], set: { h24: true } }),
    'mail.token': '{"t":"ya29.secret","exp":' + (Date.now() + 3e6) + '}', 'mail.hint': 'tom@gmail.com', 'mail.token.ever': '1', 'allison-calendar-v1-settings': '{"weekStart":1,"weekStartPicked":true,"clock":"24"}' });
  const p = synced();
  check(p['wx.places'] && JSON.parse(p['wx.places'].v)[0].name === 'Denver' && p['design.weather'].v === 'glass' && JSON.parse(p['home.settings#theme'].v) === 'dark' && p['allison-clock-v1#cities'],
    'opening aOS, its settings go to your account: Weather\'s places, designs, light or dark, Clock\'s clocks');
  check(p['mail.hint'].v === 'tom@gmail.com' && p['mail.token.ever'].v === '1' && JSON.parse(p['allison-calendar-v1-settings'].v).weekStart === 1, 'and which Google account Mail uses, that Gmail is connected, Calendar\'s settings');
  check(!p['wx.here'] && !p['mail.token'] && !p['aos.session'] && !Object.keys(p).some(k => /timers|tab$/.test(k)) && !/next/.test(p['allison-clock-v1#alarms'].v),
    'never where you are now, a sign-in, Clock\'s running timers or an alarm\'s next ring');
  // back to aOS on the iPad: the iPhone's settings come (its empty ones wiped nothing)
  await back(ipad.pg); await ipad.pg.waitForTimeout(1000);
  const got = await ipad.pg.evaluate(() => ({ places: localStorage.getItem('wx.places'), design: localStorage.getItem('design.weather'), clock: JSON.parse(localStorage.getItem('allison-clock-v1')),
    theme: document.documentElement.dataset.theme, picks: aosHomeTab.favorites()[0] }));
  check(JSON.parse(got.places)[0].name === 'Denver' && got.design === 'glass' && got.theme === 'dark' && got.picks.id === 'house' && got.picks.why === 'pin',
    `a new iPad, signed in, opens with them: Weather's places, the designs, dark, the Favorites pinned (${JSON.stringify(got).slice(0, 160)})`);
  check(got.clock.cities[0].name === 'London' && got.clock.alarms[0].label === 'Up' && !('next' in got.clock.alarms[0]) && got.clock.set.h24 === true && got.clock.tab === 'world' && got.clock.timers.length === 0,
    'Clock\'s world clocks, alarms and settings come too; its own timers and tab stay as they were');
  check(JSON.parse(synced()['wx.places'].v)[0].name === 'Denver', 'and the iPad\'s empty places didn\'t replace the iPhone\'s');
  check(await ls(ipad.pg, 'mail.hint') === 'tom@gmail.com' && await ls(ipad.pg, 'mail.token.ever') === '1' && !(await ls(ipad.pg, 'mail.token')) && JSON.parse(await ls(ipad.pg, 'allison-calendar-v1-settings')).clock === '24',
    'Mail\'s Google account and Calendar\'s settings come too, never the Gmail sign-in itself');
  // a city added on the iPad reaches the iPhone the next time it comes back to aOS
  await ipad.pg.evaluate(() => { const p = JSON.parse(localStorage.getItem('wx.places')); p.push({ lat: 42.36, lon: -71.06, name: 'Boston', sub: 'MA' }); localStorage.setItem('wx.places', JSON.stringify(p)); });
  await back(ipad.pg); await ipad.pg.waitForTimeout(600);
  check(JSON.parse(synced()['wx.places'].v).length === 2, 'a place added on the iPad goes up as it leaves aOS');
  await back(phone.pg); await phone.pg.waitForTimeout(800);
  check(JSON.parse(await ls(phone.pg, 'wx.places')).map(x => x.name).join() === 'Denver,Boston' && (await ls(phone.pg, 'wx.here')).includes('Apex'), 'and comes to the iPhone, which keeps its own location');
  // light on the iPhone: the iPad goes light too, at once
  await phone.pg.evaluate(() => AllisonOS.welcome.theme.set('light')); await back(phone.pg); await phone.pg.waitForTimeout(600);
  await back(ipad.pg); await ipad.pg.waitForTimeout(800);
  check(await ipad.pg.evaluate(() => document.documentElement.dataset.theme) === 'light', 'light chosen on the iPhone: the iPad is light too');
  // a value the server holds that can't be written (a field's value that isn't JSON): left as it was, and not marked as seen, so what replaces it still comes
  const bump = v => { const all = synced(); all['home.settings#theme'] = { v, at: all['home.settings#theme'].at + 1 }; m.set('prefs:O1', JSON.stringify(all)); return all['home.settings#theme'].at; };
  const badAt = bump('{bad'); await back(ipad.pg); await ipad.pg.waitForTimeout(800);
  const seenAt = await ipad.pg.evaluate(() => (JSON.parse(localStorage.getItem('aos.prefs.seen') || '{}')['home.settings#theme'] || {}).at);
  check(await ipad.pg.evaluate(() => document.documentElement.dataset.theme) === 'light' && seenAt !== badAt, `a setting that can't be written (not JSON) is left as it was and not marked as seen (seen at ${seenAt}, the bad one at ${badAt})`);
  bump('"dark"'); await back(ipad.pg); await ipad.pg.waitForTimeout(800);
  check(await ipad.pg.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'and the good value that replaces it comes down');
  // an app open out of sight on the iPad starts again with what came (Weather, on its new design)
  await ipad.pg.evaluate(() => { aosHomeTab.show('weather'); }); await ipad.pg.waitForTimeout(1500);
  await ipad.pg.evaluate(() => aosHomeTab.show(null)); await ipad.pg.waitForTimeout(500);
  const w0 = await ipad.pg.evaluate(() => { const w = document.querySelector('.frame[data-id="weather"] iframe').contentWindow; w.__old = 1; return true; });
  await phone.pg.evaluate(() => localStorage.setItem('design.weather', 'vintage')); await back(phone.pg); await phone.pg.waitForTimeout(600);
  await back(ipad.pg); await ipad.pg.waitForTimeout(2500);
  check(w0 && await ls(ipad.pg, 'design.weather') === 'vintage' && await ipad.pg.evaluate(() => { const w = document.querySelector('.frame[data-id="weather"] iframe').contentWindow; return !w.__old && /\/weather\/$/.test(w.location.href); }),
    'Weather, open out of sight, starts again with the design chosen on the iPhone');
  // Mail on the iPad: it signs in to that Google account by itself (Google, quietly, for tom@gmail.com)
  const toGoogle = [];
  ipad.pg.on('request', r => { if (/accounts\.google\.com\/o\/oauth2/.test(r.url())) toGoogle.push(r.url()); });
  await ipad.pg.evaluate(() => aosHomeTab.show('mail')); await ipad.pg.waitForTimeout(3000);
  const g = toGoogle[0] ? new URL(toGoogle[0]).searchParams : null;
  check(g && g.get('login_hint') === 'tom@gmail.com' && g.get('prompt') === 'none', `Mail on the iPad signs in to the iPhone's Google account by itself (${toGoogle[0] ? 'prompt=' + g.get('prompt') + ', hint=' + g.get('login_hint') : 'no sign-in'})`);
  check(!phone.errs.length && !ipad.errs.length, 'no script errors (both devices)' + ([...phone.errs, ...ipad.errs].length ? ': ' + [...phone.errs, ...ipad.errs].join(' | ') : ''));
  await phone.ctx.close(); await ipad.ctx.close();
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

// ---- Run through setup (Account): look, light or dark, your helper and its name, a step at a time ----
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.fulfill({ status: 503, body: '' }));
  await ctx.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
  await ctx.addInitScript(apps => { if (window.top !== window) return; const s = { aos: '999' }; for (const a of apps) s[a] = '999';
    localStorage.setItem('aos.seen', JSON.stringify(s)); localStorage.setItem('aos.signin.asked', '1'); }, APPS);
  const pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(BASE + '/aOS/'); await pg.waitForSelector('#ipsySlot .ipsy-char', { timeout: 15000 });
  check(await pg.evaluate(() => AllisonOS.ipsy.helper()) === null, 'no helper yet: none picked');
  await pg.evaluate(() => aosAccount.open()); await pg.waitForSelector('[data-setup]');
  await pg.click('[data-setup]'); await pg.waitForSelector('#setupBox .dlist');
  check(/Step 1 of 3/.test(await pg.textContent('#setupBox')) && await pg.locator('#setupBox [data-sback]').count() === 0 && await pg.locator('#setupBox [data-lang]').count() === 0, 'Run through setup starts with the look, step 1 of 3 (no language)');
  await pg.click('#setupBox [data-look="glass"]'); await pg.waitForTimeout(600);
  check(await pg.evaluate(() => localStorage.getItem('aos.look')) === 'glass', 'the look is saved as it is picked');
  await pg.click('#setupBox [data-snext]');
  await pg.click('#setupBox [data-t="dark"]');
  check(JSON.parse(await pg.evaluate(() => localStorage.getItem('home.settings'))).theme === 'dark', 'light or dark, saved');
  await pg.click('#setupBox [data-snext]');
  check(await pg.locator('#setupBox .ipsy-whobtn').count() === 7 && await pg.locator('#setupBox .ipsy-whobtn[aria-checked="true"]').count() === 0, 'then every helper, none picked yet');
  await pg.click('#setupBox .ipsy-whobtn[data-who="otter"]'); await pg.fill('#setupBox .ipsy-name', 'Biscuit');
  await pg.click('#setupBox [data-snext]');
  check(/You’re all set/.test(await pg.textContent('#setupBox')) && /Biscuit · Otter/.test(await pg.textContent('#setupBox')), 'all set, with what was picked');
  check(await pg.textContent('#helperSub') === 'Biscuit · Otter' && await pg.locator('#helperPick .ipsy-whobtn[data-who="otter"][aria-checked="true"]').count() === 1, 'Account\'s Your helper, under it, follows');
  const h = await pg.evaluate(() => ({ h: AllisonOS.ipsy.helper(), who: document.querySelector('#ipsySlot .ipsy-char').dataset.who, label: document.querySelector('#ipsySlot .ipsy-btn').getAttribute('aria-label') }));
  check(h.h && h.h.who === 'otter' && h.h.name === 'Biscuit' && h.who === 'otter' && h.label === 'Ask Biscuit', `the helper is yours at once, on Home too (${JSON.stringify(h)})`);
  await pg.click('#setupBox [data-snext]'); await pg.waitForTimeout(500);
  check(await pg.locator('#setupBox').count() === 0, 'Done closes it');
  check(!errs.length, 'Run through setup: no script errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}

await b.close();
server.close();
console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
