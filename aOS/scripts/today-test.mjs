// aOS's Today tab, at iPhone size, on chosen days around the newest release in home/welcome.js
// (RELEASES), so it holds whatever that release is and whatever today's date:
//   - while the release is fresh (under 30 days old), an app it brought (its `added`) leads, big,
//     with What's new beside it; with no app brought, What's new leads; every app brought is there.
//     A release that introduces Ipsy (intro: 'ipsy') leads with Meet Ipsy instead, the stem cell
//     drawn on the card and telling what it can do, with What's new beside it
//   - after that, no "New in aOS" card, and the mix of apps changes from one day to the next
//   - the same day gives the same mix; no app twice; What's new never squeezed into the wide card
//   - in both looks, and a postcard opens its page
// The accounts server is stood in for.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node aOS/scripts/today-test.mjs [repo root]
import { createRequire } from 'module'; import { execSync } from 'child_process'; import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/'); const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const W = fs.readFileSync(path.join(ROOT, 'home/welcome.js'), 'utf8');
const RELEASES = Function('return ' + W.slice(W.indexOf('const RELEASES = [') + 17, W.indexOf('\n  ];', W.indexOf('const RELEASES = [')) + 4))();
const rel = RELEASES.find(r => !r.silent), added = rel.added || [], intro = rel.intro === 'ipsy';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, r)); const BASE = 'http://localhost:' + server.address().port;
const b = await chromium.launch();
let failed = 0;
const report = (name, problems) => { if (problems.length) { failed++; console.log('not ok - ' + name + '\n  ' + problems.join('\n  ')); } else console.log('ok - ' + name); };

// noon, local time, this many days after the release's date
const after = n => { const d = new Date(rel.date + 'T12:00:00'); d.setDate(d.getDate() + n); return d; };
async function open(when, look = 'vintage') {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mobile/15E148 Safari/604.1' });
  await ctx.addInitScript(look => { try { localStorage.setItem('aos.sky', 'day'); localStorage.setItem('aos.look', look); localStorage.setItem('aos.seen', JSON.stringify({ aos: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.session', JSON.stringify({ t: 'x' })); sessionStorage.setItem('aos.later.aos', '1'); } catch {} }, look);
  const user = { id: 'u1', name: 'Sarah', role: 'member', apps: {} };
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort();
    if (!u.pathname.startsWith('/aOS/api/')) return r.continue();
    const route = u.pathname.slice('/aOS/api/'.length), J = o => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (route === 'state') return J({ storage: true, setup: true, user, plan: null });
    if (route === 'members') return J({ members: [user] });
    return J({});
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: when });
  await p.goto(BASE + '/aOS/'); await p.click('[data-tab="today"]'); await p.waitForSelector('#stories .story');   // aOS2 opens on Home
  return { ctx, p, errs };
}
// each postcard: its chip, its app (from Get), its shape, and whether it is What's new
const cards = p => p.locator('#stories .story').evaluateAll(es => es.map(e => ({ k: e.querySelector('.chip').textContent, app: (e.querySelector('[data-get]') || {}).dataset?.get || '', wide: e.classList.contains('wide'), news: e.classList.contains('plain') })));
const common = (c, pr) => {
  if (c.length !== 7) pr.push(c.length + ' postcards, not 7');
  const apps = c.map(x => x.app).filter(Boolean);
  if (new Set(apps).size !== apps.length) pr.push('an app shows twice: ' + apps.join());
  if (c.some(x => x.news && x.wide)) pr.push('What\'s new is in the wide card');
  if (c.filter(x => x.news).length > 1) pr.push('What\'s new shows twice');
};
const base = id => id.replace(/vintage$/, '');

// 1. a fresh release: what it brought leads, What's new beside it
{
  const pr = [];
  const days = [];
  for (const n of [1, 2]) {
    const { ctx, p, errs } = await open(after(n)); pr.push(...errs);
    const c = await cards(p); common(c, pr); days.push(c);
    if (intro) {
      if (c[0].k !== 'Meet Ipsy' || c[0].wide) pr.push(`day ${n}: the first card is ${c[0].k}, not Meet Ipsy, big`);
      if (!c[1].news) pr.push(`day ${n}: What's new is not beside Meet Ipsy: ${c[1].k}`);
      if (!await p.locator('#stories .story.ipsy .ipsy-stage .ipsy-cell .i-body').count()) pr.push(`day ${n}: Ipsy isn't drawn on its card`);
      const said = await p.locator('#stories .story.ipsy .ipsy-say').textContent();
      await p.clock.runFor(3000);
      const form = await p.locator('#stories .story.ipsy .ipsy-cell').getAttribute('data-form');
      if (said === await p.locator('#stories .story.ipsy .ipsy-say').textContent() || form === 'stem') pr.push(`day ${n}: Ipsy doesn't move on to its next line and shape (${said}, ${form})`);
    } else if (added.length) {
      if (c[0].k !== 'New in aOS' || !added.includes(base(c[0].app))) pr.push(`day ${n}: the first card is ${c[0].k} ${c[0].app}, not an app ${rel.v} brought (${added.join()})`);
      if (!c[1].news) pr.push(`day ${n}: What's new is not beside it: ${c[1].k}`);
      const shown = c.filter(x => x.k === 'New in aOS').map(x => base(x.app));
      for (const id of added) if (!shown.includes(id)) pr.push(`day ${n}: ${id} is not shown as New in aOS`);
    } else if (!c[0].news) pr.push(`day ${n}: What's new does not lead: ${c[0].k}`);
    // the same day, the same mix
    await p.reload(); await p.click('[data-tab="today"]'); await p.waitForSelector('#stories .story');
    if (JSON.stringify(await cards(p)) !== JSON.stringify(c)) pr.push(`day ${n}: a reload changed the mix`);
    await ctx.close();
  }
  if (added.length > 1 && days[0][0].app === days[1][0].app) pr.push('with ' + added.length + ' apps brought, the same one leads two days running');
  report(`aOS${rel.v}, fresh: ${intro ? 'Meet Ipsy leads, Ipsy telling what it can do' : added.length ? added.join(' and ') + ' lead' : 'What\'s new leads'}, What's new up top, the same mix all day`, pr);
}

// 2. a month on: no "New in aOS", and the apps change from day to day
{
  const pr = [], sets = new Set();
  for (const n of [40, 41, 42]) {
    const { ctx, p, errs } = await open(after(n)); pr.push(...errs);
    const c = await cards(p); common(c, pr);
    if (c.some(x => x.k === 'New in aOS')) pr.push(`day ${n}: still a New in aOS card`);
    if (!c.some(x => x.k === 'App of the day')) pr.push(`day ${n}: no App of the day`);
    sets.add(c.map(x => x.app || x.k).join());
    await ctx.close();
  }
  if (sets.size < 2) pr.push('three days running show the same postcards: ' + [...sets][0]);
  report('a month after the release: no New in aOS, and a different mix each day', pr);
}

// 3. Sea glass too, and a postcard opens its page with its app
{
  const { ctx, p, errs } = await open(after(1), 'glass'); const pr = [...errs];
  common(await cards(p), pr);
  await p.click('#stories .story:not(.plain)'); await p.waitForSelector('.page.on .approw');
  if (intro && await p.locator('.page.on .ipsy-forms .ipsy-mini .ipsy-cell').count() !== 6) pr.push('Meet Ipsy\'s page doesn\'t show its six cells');
  if (!await p.locator('.page.on .approw [data-get]').count()) pr.push('the postcard\'s page has no Get');
  report('Sea glass: Today\'s postcards, and one opens its page', pr); await ctx.close();
}

await b.close(); server.close();
if (failed) { console.log(failed + ' failed'); process.exit(1); }
