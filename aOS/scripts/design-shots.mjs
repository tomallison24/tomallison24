// The pictures in the aOS design charter (DESIGN.md), drawn from the apps themselves into docs/design/.
// Each is cropped to the part that shows its rule, at iPhone size (390 points wide); a rule about the
// looks shows Vintage, Standard, Layers and Tron side by side. A "Don't" is drawn from a small snippet
// of the old pattern here, never from an app, so it stays the same after every app is fixed.
//
// Run it again whenever an app or a shared part (home/settings.js, home/design.js, home/welcome.js)
// changes how it looks, and commit what it draws:
//   node aOS/scripts/design-shots.mjs [repo root] [--only name,name]
// Needs Playwright with Chromium (npm i -g playwright). Optional: ImageMagick's convert, which makes
// each picture smaller (256 colours); without it they're written as Chromium draws them.
//
// The pictures hold still: the clock is fixed (Wednesday, October 14, 2026, at 2 PM in Denver: Layers'
// afternoon sky), the Vintage sky is held at day, Reduce Motion is on, and every app has seen its
// walkthrough. The apps are offline (their server routes answer 503), so nothing here is anyone's data.
import { createRequire } from 'module';
import { execSync, execFileSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const oi = args.indexOf('--only'); const ONLY = oi >= 0 ? args.splice(oi, 2)[1].split(',') : null;
const ROOT = path.resolve(args[0] || new URL('../..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'docs/design');
fs.mkdirSync(OUT, { recursive: true });
const W = fs.readFileSync(path.join(ROOT, 'home/welcome.js'), 'utf8');
const APPS = Function('return ' + /const APPS = (\[[^\]]*\])/.exec(W)[1])();

// ---- a static server for the repo ----
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;
const browser = await chromium.launch();

const NOW = new Date('2026-10-14T14:00:00-06:00');   // a Wednesday afternoon in Denver
const TZ = 'America/Denver';
const LOOKS = [['vintage', 'Vintage'], ['glass', 'Standard'], ['layers', 'Layers'], ['grid', 'Tron']];
const MAGICK = (() => { try { execFileSync('convert', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const made = [];

// ---- a phone, open on an app ----
// look: the app's design (Tron is dark only); seed: localStorage to start with; h: the screen's height
async function phone(app, { look = 'vintage', scheme = 'light', seed = {}, h = 844, dpr = 2 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true,
    colorScheme: look === 'grid' ? 'dark' : scheme, reducedMotion: 'reduce', locale: 'en-US', timezoneId: TZ, serviceWorkers: 'block' });
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin !== BASE) return route.abort('internetdisconnected');
    if (u.pathname.includes('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
    return route.continue();
  });
  const all = { 'aos.seen': JSON.stringify(Object.fromEntries(['aos', ...APPS].map(a => [a, '999']))), 'aos.sky': 'day', ['design.' + app]: look, 'aos.signin.asked': '1', ...seed };
  await ctx.addInitScript(all => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(all)) localStorage.setItem(k, v);
  }, all);
  const p = await ctx.newPage();
  await p.clock.setFixedTime(NOW);
  await p.goto(BASE + '/' + app + '/');
  await p.waitForTimeout(1200);
  return p;
}
const done = async p => p.context().close();

// a picture of part of the page: an element (and pad points around it), or a rectangle of the screen
async function crop(p, what, { pad = 0, top = 0, bottom = 0 } = {}) {
  if (typeof what === 'string') {
    const el = p.locator(what).first();
    await el.scrollIntoViewIfNeeded();
    const b = await el.boundingBox();
    const vw = p.viewportSize();
    const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad - top);
    return p.screenshot({ clip: { x, y, width: Math.min(vw.width - x, b.width + pad * 2), height: Math.min(vw.height - y, b.height + pad * 2 + top + bottom) } });
  }
  return p.screenshot({ clip: what });
}

// Settings, opened as a person would
async function settings(p) {
  await p.locator('button[aria-label^="Settings"]:visible').first().click();
  await p.waitForTimeout(600);
}
// the Settings sheet's body, given rows made with the shared component in the page (AllisonOS.settings)
async function rows(p, make, arg = null) {
  await p.evaluate(`document.getElementById('stBody').innerHTML = (${make.toString()})(window.AllisonOS.settings, ${JSON.stringify(arg)})`);
  await p.waitForTimeout(100);
}
// the top of the open sheet, down to the end of its first section
async function sheetTop(p, extra = 14) {
  const r = await p.evaluate(() => { const s = document.querySelector('#setSheet .sheet').getBoundingClientRect(), e = document.querySelector('#stBody .st-sec').getBoundingClientRect(); return { y: s.top, h: e.bottom - s.top }; });
  return p.screenshot({ clip: { x: 0, y: Math.max(0, r.y - 4), width: 390, height: r.h + extra + 4 } });
}

// ---- writing a picture ----
function save(name, buf) {
  if (ONLY && !ONLY.includes(name)) return;
  const f = path.join(OUT, name + '.png');
  fs.writeFileSync(f, buf);
  if (MAGICK) { try { execFileSync('convert', [f, '-strip', '-colors', '256', '-define', 'png:compression-level=9', 'PNG8:' + f]); } catch {} }
  made.push([name, fs.statSync(f).size]);
}
const want = (...names) => !ONLY || names.some(n => ONLY.includes(n));

// Pictures side by side (or in a grid), each with its label under it, on a clear ground so they sit on
// the charter's page in light and dark. Two or fewer across: at 2×; more: at 1×, so a row stays near
// 1,600 pixels wide.
async function compose(items, { cols = items.length, width = 390, gap = 16, label = true } = {}) {
  const dpr = cols > 2 ? 1 : 2;
  const pg = await browser.newPage({ viewport: { width: cols * (width + gap) + gap, height: 400 }, deviceScaleFactor: dpr });
  const imgs = items.map(i => ({ src: 'data:image/png;base64,' + i.buf.toString('base64'), label: i.label || '', dont: !!i.dont }));
  await pg.setContent(`<!doctype html><style>
    body{margin:0;font:600 13px/1.3 -apple-system,system-ui,Helvetica,Arial,sans-serif;color:#7A8086}
    .g{display:grid;grid-template-columns:repeat(${cols},${width}px);gap:${gap}px;padding:${gap}px;width:max-content;align-items:start}
    figure{margin:0}img{display:block;width:${width}px;height:auto;border-radius:14px;box-shadow:0 0 0 1px rgba(128,128,128,.28)}
    figcaption{margin-top:7px;text-align:center;letter-spacing:.02em}
    .dont img{box-shadow:0 0 0 2px #C0392B}.dont figcaption{color:#C0392B}
  </style><div class="g">${imgs.map(i => `<figure class="${i.dont ? 'dont' : ''}"><img src="${i.src}">${label && i.label ? `<figcaption>${i.label}</figcaption>` : ''}</figure>`).join('')}</div>`);
  await pg.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
  const buf = await pg.locator('.g').screenshot({ omitBackground: true });
  await pg.close();
  return buf;
}

// A "Don't": the old pattern, from a snippet of HTML (drawn here, not from an app). css: the snippet's own.
async function snippet(html, { css = '', width = 390, scheme = 'light' } = {}) {
  const pg = await browser.newPage({ viewport: { width, height: 400 }, deviceScaleFactor: 2, colorScheme: scheme });
  await pg.setContent(`<!doctype html><style>
    *{box-sizing:border-box}body{margin:0;font:16px/1.3 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;color:#111114;-webkit-font-smoothing:antialiased}
    #s{width:${width}px;padding:16px;background:linear-gradient(160deg,#E4ECE9,#E3E6EE 60%,#EEE5E2)}
    .grp{border-radius:20px;background:rgba(255,255,255,.72);box-shadow:inset 0 0 0 1px rgba(16,24,26,.08);overflow:hidden}
    .row{display:flex;align-items:center;gap:12px;min-height:52px;padding:11px 14px 11px 16px;font-weight:600}
    .row+.row{border-top:1px solid rgba(16,24,26,.08)}.grow{flex:1;min-width:0}
    .sub{display:block;margin-top:2px;font-size:13px;font-weight:400;color:rgba(16,24,26,.62);line-height:1.35}
    .lbl{margin:0 8px 8px;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(16,24,26,.62)}
    ${css}</style><div id="s">${html}</div>`);
  const buf = await pg.locator('#s').screenshot();
  await pg.close();
  return buf;
}

// Notes drawn over the page (the anatomy, the tap targets): a dashed outline round each element and a
// numbered badge at its corner; legend() then sets the picture beside the list of what each number says.
async function annotate(p, notes) {
  const sizes = await p.evaluate(notes => {
    const layer = document.createElement('div');
    layer.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;font:800 11px/18px -apple-system,system-ui,Helvetica,Arial,sans-serif';
    const out = [];
    for (const n of notes) {
      const el = document.querySelectorAll(n.sel)[n.i || 0];
      if (!el) continue;
      const r = el.getBoundingClientRect(), k = out.length + 1;
      const box = document.createElement('div');
      box.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border:1.5px dashed #D6336C;border-radius:${n.radius || 4}px`;
      const tag = document.createElement('span');
      tag.textContent = k;
      tag.style.cssText = `position:absolute;${n.at === 'right' ? 'right:-9px' : 'left:-9px'};top:-9px;width:18px;height:18px;border-radius:50%;background:#D6336C;color:#fff;text-align:center;box-shadow:0 0 0 2px #fff`;
      box.appendChild(tag); layer.appendChild(box);
      out.push([n.k, Math.round(r.width), Math.round(r.height)]);
    }
    document.body.appendChild(layer);
    return out;
  }, notes.map((n, k) => ({ ...n, text: null, k })));
  return sizes.map(([k, w, h]) => typeof notes[k].text === 'function' ? notes[k].text(w, h) : notes[k].text);
}
async function legend(buf, lines, { width = 390 } = {}) {
  const pg = await browser.newPage({ viewport: { width: width + 340, height: 400 }, deviceScaleFactor: 2 });
  await pg.setContent(`<!doctype html><style>body{margin:0;font:600 14px/1.35 -apple-system,system-ui,Helvetica,Arial,sans-serif;color:#7A8086}
    .g{display:flex;gap:20px;align-items:flex-start;padding:16px;width:max-content}img{display:block;width:${width}px;border-radius:14px;box-shadow:0 0 0 1px rgba(128,128,128,.28)}
    ol{list-style:none;margin:8px 0 0;padding:0;width:280px}li{display:flex;gap:10px;margin:0 0 12px}
    li b{flex:none;width:20px;height:20px;border-radius:50%;background:#D6336C;color:#fff;font:800 12px/20px system-ui,sans-serif;text-align:center}</style>
    <div class="g"><img src="data:image/png;base64,${buf.toString('base64')}"><ol>${lines.map((l, i) => `<li><b>${i + 1}</b><span>${l}</span></li>`).join('')}</ol></div>`);
  await pg.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
  const out = await pg.locator('.g').screenshot({ omitBackground: true });
  await pg.close();
  return out;
}

// ---- made-up data, so the screens aren't empty: a few workouts this week (nobody's real log) ----
const FITNESS = { 'allison-fitness-v1': JSON.stringify({ v: 2, exercises: [], logs: [
  { id: 'd1', date: '2026-10-12', group: 'chest', exercise: 'Barbell Bench Press', weight: 135, reps: 8, sets: 3, updated: 1 },
  { id: 'd2', date: '2026-10-12', group: 'back', exercise: 'Lat Pulldown', weight: 110, reps: 10, sets: 3, updated: 2 },
  { id: 'd3', date: '2026-10-13', group: 'legs', exercise: 'Goblet Squat', weight: 50, reps: 12, sets: 3, updated: 3 },
  { id: 'd4', date: '2026-10-14', group: 'shoulders', exercise: 'Overhead Barbell Press', weight: 75, reps: 8, sets: 3, updated: 4 },
] }) };
const IPSY = { 'aos.helper': JSON.stringify({ who: 'owl', name: 'Ipsy' }), 'ipsy.travel.ok': '1' };

// =====================================================================================================
// 1. The four looks
if (want('looks')) {
  const items = [];
  for (const [look, name] of LOOKS) { const p = await phone('fitness', { look, seed: FITNESS }); items.push({ buf: await crop(p, { x: 0, y: 0, width: 390, height: 600 }), label: name }); await done(p); }
  save('looks', await compose(items));
}
if (want('light-dark')) {
  const items = [];
  for (const [look, name] of LOOKS.slice(0, 2)) for (const scheme of ['light', 'dark']) {
    const p = await phone('fitness', { look, scheme, seed: FITNESS }); items.push({ buf: await crop(p, { x: 0, y: 0, width: 390, height: 430 }), label: name + ', ' + (scheme === 'light' ? 'Light' : 'Dark') }); await done(p);
  }
  save('light-dark', await compose(items));
}
// the tokens each look gives the shared parts (home/settings.js's --st-*), read from a real page
if (want('tokens')) {
  const cols = [];
  for (const [look, name] of LOOKS) for (const scheme of look === 'grid' ? ['dark'] : ['light', 'dark']) {
    const p = await phone('travel', { look, scheme });
    const v = await p.evaluate(() => { const c = getComputedStyle(document.documentElement), g = n => c.getPropertyValue(n).trim();
      return { Ground: getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)' ? getComputedStyle(document.body).backgroundColor : g('--bg'), Card: g('--st-card'), Text: g('--st-text'), Muted: g('--st-muted'), Accent: g('--st-accent'), 'Switch on': g('--st-on'), Danger: g('--st-danger') }; });
    for (const k in v) v[k] = v[k].replace(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)\s*(?:,\s*([\d.]+))?\)$/, (m, r, g, b, a) => '#' + [r, g, b].map(x => (+x).toString(16).padStart(2, '0')).join('').toUpperCase() + (a != null && a !== '1' ? ' ' + Math.round(a * 100) + '%' : ''));
    cols.push({ name: name + (look === 'grid' ? '' : scheme === 'light' ? ' light' : ' dark'), v });
    await done(p);
  }
  const keys = Object.keys(cols[0].v);
  const toCss = v => { const m = /^#(\w{6})(?: (\d+)%)?$/.exec(v); return m ? '#' + m[1] + (m[2] ? Math.round(m[2] * 2.55).toString(16).padStart(2, '0') : '') : v; };
  const pg = await browser.newPage({ viewport: { width: 1000, height: 400 }, deviceScaleFactor: 2 });
  await pg.setContent(`<!doctype html><style>body{margin:0;font:12px/1.25 -apple-system,system-ui,sans-serif;color:#7A8086}
    table{border-collapse:separate;border-spacing:8px 6px;padding:8px}th{font-weight:700;text-align:left;font-size:12px;padding:0 2px 4px}
    td.k{font-weight:700;padding-right:6px;white-space:nowrap}td.s{width:112px}
    .gr{padding:5px;border-radius:12px;box-shadow:inset 0 0 0 1px rgba(128,128,128,.35)}.sw{height:26px;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(128,128,128,.25)}.hx{margin-top:3px;font:10.5px ui-monospace,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:112px}</style>
    <table><tr><th></th>${cols.map(c => `<th>${c.name}</th>`).join('')}</tr>${keys.map(k => `<tr><td class="k">${k}</td>${cols.map(c => `<td class="s"><div class="gr" style="background:${toCss(c.v.Ground)}"><div class="sw" style="background:${toCss(c.v[k])}"></div></div><div class="hx">${c.v[k]}</div></td>`).join('')}</tr>`).join('')}</table>`);
  save('tokens', await pg.locator('table').screenshot({ omitBackground: true }));
  await pg.close();
}

// 2. Type, spacing and corners: the parts of a Settings sheet, measured
if (want('anatomy')) {
  const p = await phone('travel', { look: 'glass' });
  await settings(p);
  await rows(p, S => S.section('Design', S.info({ title: 'Vintage', sub: 'Mid-century: cream and walnut, mustard, teal and orange.' }))
    + S.section('Trips', [S.toggle({ title: 'Family calendar', sub: 'Shares bookings with the Family calendar, both ways.', on: true }), S.info({ title: 'Live flight status', sub: 'Working: 3 lookups this month, of 50.' })], { hint: 'One line under a section, at most.' }));
  const lines = await annotate(p, [
    { sel: '#stLbl', text: 'Sheet title: 17, semibold' },
    { sel: '#setSheet .okbtn', text: 'The way out: the ✓, 44 × 44, in the accent (Vintage, Layers, Tron) or the pastel (Standard)', at: 'right', radius: 22 },
    { sel: '#stBody .st-lbl', i: 1, text: 'Section label: 12, semibold, capitals, .12em apart, muted' },
    { sel: '#stBody .st-group', i: 1, text: 'Group: corners 20, a hairline edge, no shadow; 22 between sections', at: 'right', radius: 20 },
    { sel: '#stBody .st-title', i: 1, text: 'Row name: 16, semibold' },
    { sel: '#stBody .st-sub', i: 1, text: 'The line under it: 13, regular, muted; one sentence' },
    { sel: '#stBody .st-row', i: 2, text: (w, h) => 'Row: at least 52 tall (this one ' + h + '), 16 in from the left' },
    { sel: '#stBody .st-hint', text: 'Under a section: 12.5, muted; one line at most' },
  ]);
  save('anatomy', await legend(await crop(p, '#setSheet .sheet'), lines));
  await done(p);
}

// 3. Sheets: the title, the ✓ in the corner, the floating way out
if (want('sheet-head')) {
  const items = [];
  for (const [look, name] of LOOKS) { const p = await phone('travel', { look }); await settings(p); items.push({ buf: await crop(p, '#setSheet .sheethead', { pad: 2 }), label: name }); await done(p); }
  save('sheet-head', await compose(items, { cols: 2 }));
}
if (want('float')) {
  const items = [];
  for (const [look, name] of LOOKS.slice(0, 2)) { const p = await phone('travel', { look }); await settings(p); await p.evaluate(() => window.AllisonOS && AllisonOS.floatBack && AllisonOS.floatBack()); await p.waitForTimeout(300); items.push({ buf: await crop(p, { x: 0, y: 844 - 300, width: 390, height: 300 }), label: name }); await done(p); }
  save('float', await compose(items));
}
if (want('dont-sheet')) {
  save('dont-sheet', await compose([{ dont: true, label: 'Don’t: named for something else, a word to close, no ✓', buf: await snippet(`
    <div class="sh"><div class="hd"><button class="x">Close</button><b>Parent corner</b><button class="sv">Save</button></div>
    <div class="grp"><div class="row"><span class="grow">Play timer on screen</span><span class="tw"><i>On</i><i class="o">Off</i></span></div></div></div>`, { css: `
    .sh{border-radius:28px 28px 0 0;background:#F8FAF9;padding:10px 14px 18px;box-shadow:0 -8px 24px rgba(0,0,0,.12)}
    .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.hd b{font-size:17px}
    .hd button{border:0;background:none;font:inherit;font-size:16px;color:#007AFF;padding:8px 4px}.hd .sv{font-weight:600}
    .tw{display:flex;gap:4px}.tw i{font-style:normal;font-size:14px;padding:6px 12px;border-radius:999px;background:#007AFF;color:#fff}.tw i.o{background:rgba(118,118,128,.14);color:#111}` }) }], { label: true }));
}

// 4. Settings: the standard, in Travel (the example to copy), whole
if (want('settings')) {
  const items = [];
  for (const [look, name] of LOOKS.slice(0, 2)) { const p = await phone('travel', { look, h: 1900 }); await settings(p); items.push({ buf: await crop(p, '#setSheet .sheet'), label: name }); await done(p); }
  save('settings', await compose(items));
}
if (want('design-section')) {
  const items = [];
  for (const [look, name] of LOOKS) { const p = await phone('travel', { look }); await settings(p); items.push({ buf: await crop(p, '#stBody .st-sec', { pad: 8 }), label: name }); await done(p); }
  save('design-section', await compose(items));
}
if (want('dont-settings')) {
  save('dont-settings', await compose([{ dont: true, label: 'Don’t: the app’s own markup, words and order', buf: await snippet(`
    <div class="lbl">Gmail</div><div class="grp">
      <div class="row"><span class="grow">Gmail sync<span class="sub">On.</span></span><span class="old"></span></div>
      <button class="row lnk">Look for new orders now</button>
      <button class="row lnk">Sign out of Gmail</button></div>
    <div class="lbl" style="margin-top:18px">Look</div><div class="grp"><div class="row"><span class="grow">Vintage</span>✓</div></div>`, { css: `
    .old{width:58px;height:30px;border-radius:999px;background:#34C759;position:relative}.old::after{content:"";position:absolute;top:3px;left:21px;width:34px;height:24px;border-radius:999px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.28)}
    button.row{width:100%;border:0;background:none;font:inherit;font-weight:600;text-align:left}.lnk{color:#007AFF}` }) }]));
}

// 5. The controls, each from the shared component (home/settings.js) in a real app's sheet
const CONTROL = async (name, make, looks = LOOKS, opts = {}) => {
  if (!want(name)) return;
  const items = [];
  for (const [look, lname] of looks) {
    const p = await phone('travel', { look });
    await settings(p); await rows(p, make, opts.arg);
    if (opts.after) await p.evaluate(opts.after);
    items.push({ buf: await crop(p, opts.sel || '#stBody .st-sec', { pad: 8 }), label: lname });
    await done(p);
  }
  save(name, await compose(items, { cols: opts.cols || items.length }));
};
await CONTROL('switch', S => S.section('Trips', [
  S.toggle({ title: 'Family calendar', sub: 'Shares bookings with the Family calendar, both ways.', on: true }),
  S.toggle({ title: 'Ipsy can search Gmail', sub: 'Lets Ipsy search and read your email in chats.', on: false }),
]));
await CONTROL('choice', S => S.section('Family rules', [
  S.choice({ id: 'x1', title: 'Protein', sub: 'A person, every meal.', value: 'm', options: [['l', 'Light'], ['m', 'Medium'], ['h', 'High']] }),
  S.select({ id: 'x2', title: 'Weeknight dinners', value: '30', options: [['20', '20 minutes'], ['30', '30 minutes'], ['45', '45 minutes'], ['60', 'An hour']] }),
  S.nav({ title: 'What Travel read', value: '12 emails' }),
]), LOOKS.slice(0, 2));
await CONTROL('action', S => S.section('Your data', [
  S.action({ icon: 'upload', title: 'Back up everything', sub: 'One file with every booking.' }),
  S.action({ icon: 'download', title: 'Import a backup', sub: 'Adds what isn’t here already.' }),
  S.action({ icon: 'list', title: 'Export as a spreadsheet', sub: 'Every booking, a row each.' }),
]), LOOKS.slice(0, 2));
if (want('danger')) {
  const items = [];
  for (const armed of [false, true]) {
    const p = await phone('travel', { look: 'glass' });
    await settings(p);
    await rows(p, S => S.section('Your data', [S.action({ icon: 'upload', title: 'Back up everything', sub: 'One file with every booking.' }), S.danger({ id: 'xDel', title: 'Delete all data', sub: 'Every booking on this phone. Back up first.' })]));
    if (armed) await p.evaluate(() => AllisonOS.settings.armed(document.getElementById('xDel')));
    items.push({ buf: await crop(p, '#stBody .st-sec', { pad: 8 }), label: armed ? 'The first tap: it asks again' : 'Delete all data' });
    await done(p);
  }
  save('danger', await compose(items));
}
if (want('dont-confirm')) {
  save('dont-confirm', await compose([{ dont: true, label: 'Don’t: confirm(), alert() or prompt()', buf: await snippet(`
    <div class="pg"><div class="al"><b>localhost says</b><p>Sign out and erase what aOS keeps on this phone?</p><div class="bt"><span>Cancel</span><span class="ok">OK</span></div></div></div>`, { css: `
    #s{padding:0}.pg{height:300px;display:grid;place-items:center;background:rgba(0,0,0,.35)}
    .al{width:270px;border-radius:14px;background:rgba(242,242,247,.96);text-align:center;overflow:hidden}.al b{display:block;padding:18px 16px 2px;font-size:17px}
    .al p{margin:4px 16px 16px;font-size:13px;line-height:1.35}.bt{display:flex;border-top:1px solid rgba(60,60,67,.3)}.bt span{flex:1;padding:11px;color:#007AFF;font-size:17px}
    .bt span+span{border-left:1px solid rgba(60,60,67,.3)}.bt .ok{font-weight:600}` }) }]));
}
await CONTROL('info', S => S.section('Connected accounts', [
  S.info({ title: 'Gmail', sub: 'me@example.com, read-only.' }),
  S.action({ icon: 'refresh', title: 'Check now', sub: 'Last checked 5 minutes ago.' }),
], { hint: 'Using Mail’s sign-in from this browser.' }), LOOKS.slice(0, 2));
if (want('dont-switch')) {
  save('dont-switch', await compose([{ dont: true, label: 'Don’t: a switch of your own, On and Off buttons, a check mark', buf: await snippet(`
    <div class="grp">
      <div class="row"><span class="grow">Family calendar</span><span class="old on"></span></div>
      <div class="row"><span class="grow">Notifications</span><span class="tw"><i>On</i><i class="o">Off</i></span></div>
      <div class="row"><span class="grow">Show past trips</span><span class="ck">✓</span></div></div>`, { css: `
    .old{width:58px;height:30px;border-radius:999px;background:#34C759;position:relative}.old::after{content:"";position:absolute;top:3px;left:21px;width:34px;height:24px;border-radius:999px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.28)}
    .tw{display:flex;gap:4px}.tw i{font-style:normal;font-size:14px;padding:6px 12px;border-radius:999px;background:#3B7366;color:#fff}.tw i.o{background:rgba(118,118,128,.14);color:#111}
    .ck{color:#3B7366;font-size:20px}` }) }]));
}
// colour never alone: the switch in grey, on and off, larger
if (want('switch-marks')) {
  const p = await phone('travel', { look: 'glass', dpr: 3 });
  await settings(p);
  await rows(p, S => S.section('', [S.toggle({ title: 'On', on: true }), S.toggle({ title: 'Off', on: false })]));
  await p.evaluate(() => { document.querySelector('#stBody').style.filter = 'grayscale(1)'; });
  const items = [];
  for (const i of [0, 1]) items.push({ buf: await crop(p, `#stBody .st-sw >> nth=${i}`, { pad: 10 }), label: i ? 'Off: an o in the track' : 'On: a | in the track' });
  await done(p);
  save('switch-marks', await compose(items, { width: 150 }));
}

// 6. Copy: the same words for the same job
await CONTROL('words', S => S.section('Your data', [
  S.action({ icon: 'refresh', title: 'Check now', sub: 'Last checked 5 minutes ago.' }),
  S.action({ icon: 'upload', title: 'Back up everything', sub: 'One file with every booking.' }),
  S.action({ icon: 'download', title: 'Import a backup', sub: 'Adds what isn’t here already.' }),
  S.action({ icon: 'face', title: 'Sign in with Face ID', sub: 'Your family account, for the Sheet and Ipsy.' }),
  S.danger({ icon: 'out', title: 'Disconnect Gmail' }),
]), LOOKS.slice(1, 2));
if (want('dont-copy')) {
  save('dont-copy', await compose([{ dont: true, label: 'Don’t: On., two sentences, a new name for a job, AOS', buf: await snippet(`
    <div class="grp">
      <div class="row"><span class="grow">Ipsy<span class="sub">On.</span></span></div>
      <div class="row"><span class="grow">Look for new bookings now<span class="sub">Travel reads your email. It looks for confirmations from airlines and hotels and adds them.</span></span></div>
      <div class="row"><span class="grow">Sign out of Gmail</span></div>
      <div class="row"><span class="grow" style="text-transform:uppercase;letter-spacing:.08em;font-size:13px">Open aOS</span></div></div>`) }]));
}

// 7. Ipsy: in the corner, its own section in Settings, Undo for every change
if (want('ipsy-corner')) {
  const items = [];
  for (const [look, name] of LOOKS) { const p = await phone('travel', { look, seed: IPSY }); items.push({ buf: await crop(p, { x: 0, y: 844 - 170, width: 390, height: 170 }), label: name }); await done(p); }
  save('ipsy-corner', await compose(items));
}
if (want('ipsy-undo')) {
  const items = [];
  for (const [look, name] of LOOKS.slice(0, 2)) {
    const p = await phone('travel', { look, seed: IPSY });
    await p.locator('.ipsy-btn').first().click(); await p.waitForTimeout(500);
    await p.evaluate(() => {
      const log = document.getElementById('ipsyLog');
      log.innerHTML = '<div class="ipsy-msg ipsy-me">Move the Denver flight to the trip with the hotel</div>'
        + '<div class="ipsy-msg ipsy-it">Done: the flight to Denver is in “Denver, Oct 22–25” now, with the hotel.</div>'
        + '<div class="ipsy-change"><span>Moved “Flight to Denver” to Denver, Oct 22–25</span><button class="ipsy-undo" type="button">Undo</button></div>';
    });
    items.push({ buf: await crop(p, '.ipsy-bubble', { pad: 6 }), label: name });
    await done(p);
  }
  save('ipsy-undo', await compose(items));
}
if (want('ipsy-settings')) {
  const items = [];
  for (const [look, name] of LOOKS.slice(0, 2)) {
    const p = await phone('travel', { look }); await settings(p);
    await rows(p, S => S.section('AI helper', [
      S.claude('travel'),
      S.toggle({ title: 'Ipsy fills in what’s missing', sub: 'Completes new bookings from their emails, on this phone.', on: true }),
      S.toggle({ title: 'Ipsy can search Gmail', sub: 'Lets Ipsy search and read your email in chats.', on: true }),
    ], { hint: 'A booking marked Private stays out of everything Ipsy reads.' }));
    items.push({ buf: await crop(p, '#stBody .st-sec', { pad: 8 }), label: name }); await done(p);
  }
  save('ipsy-settings', await compose(items));
}

// 8. Empty states, toasts
if (want('empty')) {
  const items = [];
  for (const [look, name] of LOOKS.slice(0, 2)) { const p = await phone('travel', { look }); items.push({ buf: await crop(p, { x: 0, y: 0, width: 390, height: 370 }), label: name }); await done(p); }
  save('empty', await compose(items));
}
if (want('toast')) {
  const items = [];
  for (const [look, name] of LOOKS.slice(0, 2)) {
    const p = await phone('fitness', { look, seed: FITNESS });
    await p.evaluate(() => { document.getElementById('toastMsg').textContent = 'Deleted Goblet Squat.'; document.getElementById('toastAct').hidden = false; document.getElementById('toast').hidden = false; });
    await p.waitForTimeout(300);
    items.push({ buf: await crop(p, '#toast', { pad: 18 }), label: name }); await done(p);
  }
  save('toast', await compose(items));
}

// 9. Accessibility: the tap targets in a sheet
if (want('targets')) {
  const p = await phone('travel', { look: 'glass' });
  await settings(p);
  await rows(p, S => S.section('Trips', [S.toggle({ title: 'Family calendar', sub: 'Shares bookings with the Family calendar, both ways.', on: true }), S.action({ icon: 'refresh', title: 'Check now', sub: 'Last checked 5 minutes ago.' })]));
  const lines = await annotate(p, [
    { sel: '#setSheet .okbtn', text: (w, h) => 'Done: ' + w + ' × ' + h, at: 'right', radius: 22 },
    { sel: '#stBody .st-row', i: 0, text: (w, h) => 'A switch: the whole row is the target, ' + w + ' × ' + h + ', not just the 48 × 22 switch' },
    { sel: '#stBody .st-row', i: 1, text: (w, h) => 'An action: the whole row, ' + w + ' × ' + h },
  ]);
  save('targets', await legend(await sheetTop(p, 30), lines));
  await done(p);
}

// 10. Icons: each app's in the four looks (icon-*.png, drawn from icon.svg by make-icons and make-looks)
if (want('icons')) {
  const apps = APPS.filter(a => fs.existsSync(path.join(ROOT, a, 'icon-glass-180.png'))).slice(0, 8);
  const file = { vintage: 'icon-180.png', glass: 'icon-glass-180.png', layers: 'icon-layers-180.png', grid: 'icon-grid-180.png' };
  const pg = await browser.newPage({ viewport: { width: 900, height: 400 }, deviceScaleFactor: 2 });
  await pg.setContent(`<!doctype html><style>body{margin:0;font:600 12px/1.2 -apple-system,system-ui,sans-serif;color:#7A8086}
    table{border-spacing:12px 10px;padding:4px}th{text-align:left;font-weight:700;padding-right:6px}img{display:block;width:58px;height:58px;border-radius:13px}</style>
    <table>${LOOKS.map(([l, n]) => `<tr><th>${n}</th>${apps.map(a => `<td><img src="${BASE}/${a}/${file[l]}"></td>`).join('')}</tr>`).join('')}</table>`);
  await pg.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
  save('icons', await pg.locator('table').screenshot({ omitBackground: true }));
  await pg.close();
}

await browser.close(); server.close();
const total = made.reduce((s, [, n]) => s + n, 0);
console.log(made.map(([n, s]) => `docs/design/${n}.png`.padEnd(34) + (s / 1024).toFixed(0).padStart(5) + ' KB').join('\n'));
console.log(`${made.length} pictures, ${(total / 1024 / 1024).toFixed(2)} MB${MAGICK ? '' : ' (no ImageMagick: not made smaller)'}`);
