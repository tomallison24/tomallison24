// The aOS design charter (DESIGN.md), the rules a script can check, app by app. Each check below is named
// in DESIGN.md beside its rule ("CI: <name>"); the rest of the charter is reviewed by hand.
//
//   shared        Settings is home/settings.js: loaded before the app's own script, in sw.js SHELL, and the
//                 open sheet is made of its sections (.st-sec)
//   title         a button labelled "Settings" opens a sheet named "Settings"
//   done          the sheet's way out is the ✓ labelled Done, in the head's right corner
//   design-first  the first section is Design, with the shared picker (aosDesign.picker())
//   order         the sections in the standard order: Design · the app's own · Connected accounts · Ipsy ·
//                 Notifications · Your data · Family account
//   on-off        no "On." or "Off." in the words
//   one-sentence  a row's line under its name is one sentence, ending with a full stop
//   switch-css    no private copy of the switch's CSS (the shared one is home/settings.js's .st-sw)
//   no-dialogs    no confirm(), alert() or prompt() in the app's code (Ipsy's own confirm, a card in the
//                 chat, is fine)
//   names         every button on the main screen and in Settings has a name VoiceOver can read
//   aos-case      "aOS" is never uppercased (by the words or by CSS)
//   motion        the page honours Reduce Motion (a prefers-reduced-motion rule)
//
// aOS itself (aOS/) has no Settings sheet (its Account tab is the hub's own), so the Settings checks are
// "n/a" there. Home's device controls keep the Signal dashboard's switches (CLAUDE.md), so switch-css is
// "n/a" for house.
//
// It prints a table (✓ pass, ✗ fail, – n/a) and every failure's reason, and exits 1 on any failure.
//   node aOS/scripts/design-check.mjs [repo root] [--json out.json] [--only app,app]
// Needs Playwright with Chromium (npm i -g playwright), as the browser tests do.
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const JSON_OUT = flag('--json'), ONLY = flag('--only');
const ROOT = path.resolve(args[0] || new URL('../..', import.meta.url).pathname);
const W = fs.readFileSync(path.join(ROOT, 'home/welcome.js'), 'utf8');
const APPS = ['aos', ...Function('return ' + /const APPS = (\[[^\]]*\])/.exec(W)[1])()].filter(a => !ONLY || ONLY.split(',').includes(a));
const NAMES = Function('return ' + /const NAMES = (\{[^}]*\})/.exec(W)[1])();
const dir = id => (id === 'aos' ? 'aOS' : id);

export const CHECKS = [
  ['shared', 'Settings is home/settings.js'],
  ['title', 'A sheet named Settings'],
  ['done', '✓ Done in the corner'],
  ['design-first', 'Design first'],
  ['order', 'Sections in order'],
  ['on-off', 'Never On./Off.'],
  ['one-sentence', 'One sentence a row'],
  ['switch-css', 'No private switch'],
  ['no-dialogs', 'No confirm/alert/prompt'],
  ['names', 'Buttons have names'],
  ['aos-case', 'aOS lowercase a'],
  ['motion', 'Reduce Motion'],
];
const SETTINGS_CHECKS = ['shared', 'title', 'done', 'design-first', 'order', 'on-off', 'one-sentence'];
const NA = { aos: SETTINGS_CHECKS, house: ['switch-css'] };

// ---------------------------------------------------------------------------------------------------
// The static checks: the app's files as they are
// ---------------------------------------------------------------------------------------------------
const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
function appFiles(id) {
  const out = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!/^(scripts|node_modules|icons)$/.test(e.name)) walk(path.join(d, e.name)); }
    else if (/\.js$/.test(e.name) && e.name !== 'sw.js') out.push(path.join(d, e.name));
  } };
  walk(path.join(ROOT, dir(id)));
  return out;
}

// JavaScript with its comments, strings and regular expressions blanked out (kept the same length, so a
// position still gives the right line), to look for calls in the code itself.
function codeOnly(src) {
  let out = '', i = 0, last = '';   // last: the last significant character, to tell a regex from a division
  const n = src.length, blank = s => s.replace(/[^\n]/g, ' ');
  const regexOK = () => !last || /[(,=:[!&|?{};+\-*%<>~^]/.test(last) || /\b(return|typeof|case|do|else|in|of|void|yield|await)$/.test(out.trimEnd());
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { const j = src.indexOf('\n', i); const e = j < 0 ? n : j; out += blank(src.slice(i, e)); i = e; continue; }
    if (c === '/' && d === '*') { const j = src.indexOf('*/', i + 2); const e = j < 0 ? n : j + 2; out += blank(src.slice(i, e)); i = e; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; else if (c === '`' && src[j] === '$' && src[j + 1] === '{') { let depth = 1; j += 2; while (j < n && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; } continue; } j++; }
      out += c + blank(src.slice(i + 1, j)) + (j < n ? c : ''); i = j + 1; last = c; continue;
    }
    if (c === '/' && regexOK()) {
      let j = i + 1, cls = false;
      while (j < n && src[j] !== '\n') { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; else if (src[j] === '/' && !cls) break; j++; }
      if (src[j] === '/') { out += '/' + blank(src.slice(i + 1, j)) + '/'; i = j + 1; last = '/'; continue; }
    }
    out += c; if (!/\s/.test(c)) last = c; i++;
  }
  return out;
}
const lineOf = (s, at) => s.slice(0, at).split('\n').length;

function noDialogs(id) {
  const bad = [];
  for (const f of appFiles(id)) {
    const code = codeOnly(read(f)), rel = path.relative(ROOT, f);
    for (const m of code.matchAll(/(^|[^.\w$])(?:(window|self|globalThis)\s*\.\s*)?(confirm|alert|prompt)\s*\(/g)) {
      const name = m[3], at = m.index + m[1].length;
      // a bare call to a name the file binds itself (Ipsy's tools get confirm as { confirm }) is not the browser's
      const bound = new RegExp('function\\s+' + name + '\\b|\\b(?:const|let|var)\\s+' + name + '\\b|[({,]\\s*' + name + '\\s*[,})=]').test(code);
      if (m[2] || !bound) bad.push(`${rel}:${lineOf(code, at)} ${m[2] ? m[2] + '.' : ''}${name}()`);
    }
  }
  return bad;
}

// A private switch: CSS that slides a knob when [aria-checked="true"] (or :checked), outside home/settings.js.
function switchCss(id) {
  const html = read(path.join(ROOT, dir(id), 'index.html'));
  const css = ([...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')
    + appFiles(id).map(f => read(f)).join('\n').split(/`/).filter((_, i) => i % 2).join('\n'))   // CSS a script writes, in template strings
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const bad = new Set();
  for (const m of css.matchAll(/([^{}]*?(?:\[aria-checked=["']?true["']?\]|:checked)[^{}]*?::?(?:after|before))\s*\{([^}]*)\}/g)) {
    if (/translate(X|3d)?\(|\bleft\s*:|\binset-inline-start\s*:/.test(m[2])) bad.add(m[1].trim().replace(/\s+/g, ' ').slice(0, 80));
  }
  return [...bad];
}

function sharedStatic(id) {
  const html = read(path.join(ROOT, dir(id), 'index.html')), sw = read(path.join(ROOT, dir(id), 'sw.js'));
  const bad = [];
  const at = html.search(/<script\s+src="\.\.\/home\/settings\.js"/), app = html.search(/<script\s+src="(\.\/)?app\.js"/);
  if (at < 0) bad.push('index.html doesn\'t load ../home/settings.js');
  else if (app >= 0 && at > app) bad.push('../home/settings.js loads after app.js');
  if (!/['"][^'"]*home\/settings\.js['"]/.test(sw)) bad.push('sw.js SHELL doesn\'t list ../home/settings.js');
  return bad;
}

const motion = id => /prefers-reduced-motion/.test(read(path.join(ROOT, dir(id), 'index.html'))) ? [] : ['no prefers-reduced-motion rule in index.html'];

// ---------------------------------------------------------------------------------------------------
// The checks in a browser: the main screen, then Settings opened as a person would
// ---------------------------------------------------------------------------------------------------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => server.listen(0, () => r(server)));
}

// Reaching Settings, where the button labelled Settings isn't on the first screen:
//   seed      what the phone keeps first (Mail's Settings is there once you're signed in to Gmail)
//   before    what a person does first (Podcasts' Settings is on the Library tab)
//   other     how to open it where it isn't behind a button labelled Settings yet (the title check still
//             fails for these: the button should say Settings). Sparkle's is behind the grown-up check:
//             hold Grown-ups, then answer the sum.
const GMAIL = JSON.stringify({ t: 'CHECK', exp: Date.now() + 3600e3, scope: 'https://www.googleapis.com/auth/gmail.modify' });
const OPEN = {
  mail: { seed: { 'mail.token': GMAIL, 'mail.token.ever': '1', 'mail.hint': 'me@example.com', 'mail.swept': String(Date.now()), 'aos.signin.asked': '1' } },
  podcasts: { before: p => p.click('[data-tab="lib"]') },
  meals: { other: '#setBtn' },
  house: { other: '#gear' },
  weather: { other: '[data-action="location"]' },
  sparkle: {
    async other(p) {
      const g = p.locator('#grownBtn');
      if (!(await g.count())) return false;
      await g.dispatchEvent('pointerdown');
      if (!(await p.waitForSelector('#gAns', { timeout: 6000 }).then(() => true, () => false))) return false;
      const m = /(\d+)\s*[×x]\s*(\d+)/.exec(await p.locator('.sheet').last().innerText());
      if (m) { await p.fill('#gAns', String(+m[1] * +m[2])); await p.click('#gOk'); }
      return true;
    },
  },
};

// Everything below runs in the page.
function pageMain() {
  const vis = el => { if (!el.getClientRects().length) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0; };
  const nameOf = el => {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) return lb.split(/\s+/).map(i => (document.getElementById(i) || {}).textContent || '').join(' ').trim();
    return (el.getAttribute('aria-label') || el.innerText || el.textContent || el.getAttribute('title') || [...el.querySelectorAll('img[alt],svg title')].map(x => x.alt || x.textContent).join(' ') || '').trim();
  };
  const unnamed = root => [...root.querySelectorAll('button, [role="button"], [role="switch"], [role="tab"], a[href]')]
    .filter(el => vis(el) && !el.closest('[aria-hidden="true"]') && !nameOf(el))
    .map(el => el.outerHTML.replace(/\s+/g, ' ').slice(0, 90));
  const upper = (document.body.innerText.match(/(^|[^\w])AOS([^\w]|$)/g) || []).length;
  return { unnamed: unnamed(document.body), upper };
}
function pageSheet() {
  const vis = el => { if (!el.getClientRects().length) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none'; };
  const onScreen = el => { const r = el.getBoundingClientRect(); return vis(el) && r.width > 0 && r.bottom > 40 && r.top < innerHeight - 40; };
  const dlgs = [...document.querySelectorAll('[role="dialog"]')].filter(onScreen).filter(d => !d.closest('#aos-welcome, #aos-signin, .ipsy-bubble'));
  const dlg = dlgs[dlgs.length - 1];
  if (!dlg) return null;
  const nameOf = el => {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) return lb.split(/\s+/).map(i => (document.getElementById(i) || {}).textContent || '').join(' ').trim();
    return (el.getAttribute('aria-label') || el.innerText || el.textContent || el.getAttribute('title') || '').trim();
  };
  const box = dlg.getBoundingClientRect();
  const head = [...dlg.querySelectorAll('button')].filter(b => vis(b) && b.getBoundingClientRect().top < box.top + 140);
  const done = head.filter(b => /^done$/i.test(nameOf(b))).map(b => { const r = b.getBoundingClientRect(); return { right: box.right - r.right, top: r.top - box.top, w: r.width, h: r.height, tick: !!b.querySelector('svg') && !b.innerText.trim() }; });
  const secs = [...dlg.querySelectorAll('.st-sec')].filter(vis);
  const labels = secs.map(s => { const l = s.querySelector(':scope > .st-lbl'); return l ? l.textContent.trim() : ''; });
  const subs = [...dlg.querySelectorAll('.st-sub')].filter(vis).map(s => s.textContent.trim()).filter(Boolean);
  const loose = [...dlg.querySelectorAll('button, [role="switch"], select, input:not([type="file"]):not([type="hidden"])')]
    .filter(el => vis(el) && !el.closest('.st-sec') && !head.includes(el)).length;
  const unnamed = [...dlg.querySelectorAll('button, [role="button"], [role="switch"], [role="radio"], select, input:not([type="hidden"]):not([type="file"])')]
    .filter(el => vis(el) && !el.closest('[aria-hidden="true"]') && !nameOf(el) && !(el.labels && el.labels.length && el.labels[0].innerText.trim()))
    .map(el => el.outerHTML.replace(/\s+/g, ' ').slice(0, 90));
  const switches = [...dlg.querySelectorAll('[role="switch"]')].filter(vis).filter(s => !s.querySelector('.st-sw')).length;
  const text = dlg.innerText;
  return { name: nameOf(dlg), done, labels, subs, loose, unnamed, switches, picker: !!dlg.querySelector('.st-sec .aos-design'), text, upper: (text.match(/(^|[^\w])AOS([^\w]|$)/g) || []).length };
}

const ORDER = ['Design', '', 'Connected accounts', 'Ipsy', 'Notifications', 'Your data', 'Family account'];
const rank = l => { const i = ORDER.findIndex(x => x && x.toLowerCase() === l.toLowerCase()); return i < 0 ? 1 : i; };
// sentences: a full stop, question or exclamation mark, then a space and the next sentence
const sentences = s => s.split(/(?<=[.!?])\s+(?=[A-Z0-9“"‘(])/).filter(Boolean).length;

async function browserChecks(browser, base, id) {
  const r = {};
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: 'light', locale: 'en-US', serviceWorkers: 'block' });
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.hostname === 'gmail.googleapis.com') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (u.origin !== base) return route.abort('internetdisconnected');
    if (u.pathname.includes('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
    return route.continue();
  });
  await ctx.addInitScript(([ids, seed]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('aos.seen', JSON.stringify(Object.fromEntries(ids.map(i => [i, '999']))));
    localStorage.setItem('aos.sky', 'day');   // the Vintage sky held still
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, [['aos', ...APPS], (OPEN[id] || {}).seed || {}]);
  const p = await ctx.newPage();
  try {
    await p.goto(base + '/' + dir(id) + '/');
    await p.waitForTimeout(1500);
    const main = await p.evaluate(pageMain);
    r.names = main.unnamed.map(h => 'no name: ' + h);
    r['aos-case'] = main.upper ? [`"AOS" on the main screen (${main.upper}×)`] : [];
    if (NA[id] && NA[id].includes('title')) return r;

    // Settings, opened as a person would: the button labelled Settings
    const o = OPEN[id] || {};
    if (o.before) { await o.before(p); await p.waitForTimeout(400); }
    const btn = p.locator('button[aria-label^="Settings"]:visible, [role="button"][aria-label^="Settings"]:visible').first();
    let how = '';
    if (await btn.count()) { await btn.click(); how = 'button'; }
    else if (typeof o.other === 'function') { if (await o.other(p)) how = 'other'; }
    else if (o.other && await p.locator(o.other).first().count()) { await p.locator(o.other).first().click(); how = 'other'; }
    await p.waitForTimeout(900);
    const s = how ? await p.evaluate(pageSheet) : null;
    const none = ['Settings didn\'t open'];
    if (!s) { for (const k of SETTINGS_CHECKS) r[k] = how ? none : ['no button labelled Settings']; return r; }
    r.title = [];
    if (how !== 'button') r.title.push('its button isn\'t labelled Settings');
    if (s.name !== 'Settings') r.title.push(`the sheet is named "${s.name}"`);
    const d = s.done[0];
    r.done = !d ? ['no Done in the sheet\'s head'] : [...(d.right > 40 ? ['Done isn\'t in the right corner'] : []), ...(!d.tick ? ['Done is a word, not the ✓'] : []), ...(d.w < 44 || d.h < 44 ? [`Done is ${Math.round(d.w)}×${Math.round(d.h)}, under 44`] : [])];
    r.shared = (r.shared || []).concat(!s.labels.length ? ['the sheet has no shared sections (.st-sec)'] : s.loose ? [`${s.loose} control${s.loose === 1 ? '' : 's'} outside the shared sections`] : [], s.switches ? [`${s.switches} switch${s.switches === 1 ? '' : 'es'} not the shared one`] : []);
    r['design-first'] = !s.labels.length ? ['no shared sections'] : s.labels[0] !== 'Design' ? [`first section is "${s.labels[0] || '(no label)'}"`] : !s.picker ? ['Design has no shared picker'] : [];
    const ranks = s.labels.map(rank), bad = [];
    for (let i = 1; i < ranks.length; i++) if (ranks[i] < ranks[i - 1]) bad.push(`"${s.labels[i]}" after "${s.labels[i - 1]}"`);
    r.order = !s.labels.length ? ['no shared sections'] : bad;
    const onoff = (s.text.match(/(^|[^\w])(On|Off)\.(\s|$)/g) || []).map(x => x.trim());
    r['on-off'] = onoff.length ? [`says ${[...new Set(onoff)].join(' and ')}`] : [];
    r['one-sentence'] = !s.labels.length ? ['no shared rows'] : s.subs.filter(t => sentences(t) > 1 || !/[.…?!]["”’)]?$/.test(t)).map(t => (sentences(t) > 1 ? 'more than one sentence: ' : 'no full stop: ') + JSON.stringify(t.slice(0, 70)));
    r.names = r.names.concat(s.unnamed.map(h => 'no name in Settings: ' + h));
    if (s.upper) r['aos-case'].push(`"AOS" in Settings (${s.upper}×)`);
    return r;
  } catch (e) {
    for (const [k] of CHECKS) if (!r[k] && !['switch-css', 'no-dialogs', 'motion'].includes(k)) r[k] = ['the check broke: ' + e.message.split('\n')[0]];
    return r;
  } finally { await ctx.close(); }
}

// ---------------------------------------------------------------------------------------------------
export async function run({ log = true } = {}) {
  const require = createRequire(execSync('npm root -g').toString().trim() + '/');
  const { chromium } = require('playwright');
  const server = await serve(), base = 'http://localhost:' + server.address().port;
  const browser = await chromium.launch();
  const results = {};
  for (const id of APPS) {
    const r = await browserChecks(browser, base, id);
    r.shared = sharedStatic(id).concat(r.shared || []);
    r['switch-css'] = switchCss(id).map(s => 'private switch: ' + s);
    r['no-dialogs'] = noDialogs(id);
    r.motion = motion(id);
    for (const k of NA[id] || []) r[k] = null;   // n/a
    results[id] = r;
    if (log) process.stderr.write('.');
  }
  await browser.close(); server.close();
  if (log) process.stderr.write('\n');
  return results;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const results = await run();
  const cols = CHECKS.map(([k]) => k), w = Math.max(...APPS.map(a => (NAMES[a] || a).length)) + 2;
  const cell = v => (v === null || v === undefined ? '–' : v.length ? '✗' : '✓');
  const head = ''.padEnd(w) + cols.map((k, i) => String(i + 1).padStart(2).padEnd(4)).join('');
  console.log('\naOS design check (DESIGN.md)\n');
  console.log(head);
  let fails = 0;
  for (const id of APPS) {
    const r = results[id];
    console.log((NAMES[id] || id).padEnd(w) + cols.map(k => ' ' + cell(r[k]) + '  ').join(''));
    fails += cols.filter(k => r[k] && r[k].length).length;
  }
  console.log('\n' + CHECKS.map(([k, t], i) => String(i + 1).padStart(2) + ' ' + k.padEnd(13) + t + ' (' + APPS.filter(a => results[a][k] === null || (results[a][k] && !results[a][k].length)).length + '/' + APPS.length + ')').join('\n'));
  const out = [];
  for (const id of APPS) for (const [k] of CHECKS) { const v = results[id][k]; if (v && v.length) out.push(`not ok - ${NAMES[id] || id}: ${k}\n    ${v.slice(0, 6).join('\n    ')}${v.length > 6 ? `\n    …and ${v.length - 6} more` : ''}`); }
  if (out.length) console.log('\n' + out.join('\n'));
  console.log(`\n${APPS.length} apps, ${CHECKS.length} checks: ${fails} failing`);
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ checks: CHECKS, apps: APPS.map(a => ({ id: a, name: NAMES[a] || a })), results }, null, 1));
  process.exit(fails ? 1 : 0);
}
