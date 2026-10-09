// Checks that every AllisonOS app is wired into aOS completely, and follows
// the ground rules every app shares. Run it after adding or changing an app
// (the new-aos-app skill, .claude/skills/new-aos-app, says when), and
// .github/workflows/apps-check.yml runs it on every push and pull request.
//
//   node aOS/scripts/check-apps.mjs
//
// The list of apps is home/welcome.js's APPS; an app folder that is in none of
// the lists is reported too. Errors fail the check; warnings are printed only.
//
// Wired in (errors):
//   home/welcome.js     APPS, NAMES, TOURS (3 to 6 cards, each a known line
//                       icon, a title and words)
//   aOS/index.html      HUE, CAT, NEEDS (and SHARED only for family apps)
//   functions/aOS/api   APPS, the same apps in the same order as welcome.js
//   news.yml            the folder in the push paths and in the copy to _site
//   the folder          index.html, sw.js, manifest.webmanifest, icon-180.png,
//                       icon-512.png, README.md
//   index.html          loads ../home/welcome.js with data-app="<id>" data-auto
//   sw.js               every SHELL file exists; no ../home/back.js (retired)
//   manifest            name, short_name, start_url and scope "./", standalone,
//                       a 180 and a 512 icon
// Ground rules (errors):
//   - Home Screen ready: viewport-fit=cover, apple-mobile-web-app-capable,
//     black-translucent status bar, apple-touch-icon, theme-color
//   - light and dark (prefers-color-scheme, either way round), unless the app
//     is DARK_ONLY
//   - prefers-reduced-motion honoured
//   - the system font: no web fonts or stylesheets from other sites
//   - the faint cards every app shares (--tile), except aOS's own store
//   - "aOS" is written with a lowercase a: never "AOS" in the page's text
// Worth doing (warnings):
//   - a Content-Security-Policy meta
//   - :root[data-theme="dark"] rules, so the app's own CSS follows a chosen
//     Light or Dark without relying on welcome.js rewriting the media queries
//   - its sw.js CACHE named after the app ('<id>-vN')
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const read = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return null; } };
const exists = f => fs.existsSync(path.join(ROOT, f));
const errors = [], warnings = [];
const err = (app, msg) => errors.push((app ? app + ': ' : '') + msg);
const warn = (app, msg) => warnings.push((app ? app + ': ' : '') + msg);

// A JS literal (array or object) that starts at `from` in `src`, read by matching brackets.
function literal(src, from) {
  const open = src[from], close = open === '[' ? ']' : '}';
  let depth = 0, q = null;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return src.slice(from, i + 1);
  }
  throw new Error('unbalanced literal');
}
function constant(src, name, file) {
  const m = new RegExp('const ' + name + ' = ([\\[{])').exec(src);
  if (!m) { err('', file + ' has no ' + name); return null; }
  try { return Function('"use strict"; return (' + literal(src, m.index + m[0].length - 1) + ');')(); }
  catch (e) { err('', file + ': could not read ' + name + ' (' + e.message + ')'); return null; }
}

// ---- the lists ----
const W = read('home/welcome.js') || '';
const APPS = constant(W, 'APPS', 'home/welcome.js') || [];
const NAMES = constant(W, 'NAMES', 'home/welcome.js') || {};
const TOURS = constant(W, 'TOURS', 'home/welcome.js') || {};
const DARK_ONLY = constant(W, 'DARK_ONLY', 'home/welcome.js') || [];
const LINEsrc = (/const LINE = \{/.exec(W) || {}).index;
const LINE = LINEsrc === undefined ? new Set() : new Set([...literal(W, LINEsrc + 'const LINE = '.length).matchAll(/^\s{4}(\w+):/gm)].map(m => m[1]));
const S = read('aOS/index.html') || '';
const HUE = constant(S, 'HUE', 'aOS/index.html') || {};
const CAT = constant(S, 'CAT', 'aOS/index.html') || {};
const NEEDS = constant(S, 'NEEDS', 'aOS/index.html') || {};
const API = read('functions/aOS/api/[[route]].js') || '';
const API_APPS = constant(API, 'APPS', 'functions/aOS/api/[[route]].js') || [];
const NEWS = read('.github/workflows/news.yml') || '';
const copy = (/cp -r ([^&]+?) _site\//.exec(NEWS) || [])[1] || '';
const copied = new Set(copy.trim().split(/\s+/));

if (JSON.stringify(API_APPS) !== JSON.stringify(APPS))
  err('', 'functions/aOS/api APPS ' + JSON.stringify(API_APPS) + ' should be home/welcome.js APPS ' + JSON.stringify(APPS) + ' (same apps, same order), or "Installed" breaks');

// An app folder: has index.html and a manifest, and isn't a shared or test folder.
const NOT_APPS = new Set(['home', 'labs', 'aOS', 'aos', 'functions', 'server', 'node_modules', '.github', '.claude']);
const folders = fs.readdirSync(ROOT, { withFileTypes: true }).filter(d => d.isDirectory() && !NOT_APPS.has(d.name) && !d.name.startsWith('.'))
  .map(d => d.name).filter(n => exists(n + '/index.html') && exists(n + '/manifest.webmanifest'));
for (const f of folders) if (!APPS.includes(f)) err(f, 'an app folder that home/welcome.js APPS doesn’t list, so aOS doesn’t offer it');

const ids = ['aos', ...APPS];
const dirOf = id => id === 'aos' ? 'aOS' : id;

for (const id of ids) {
  const dir = dirOf(id), store = id !== 'aos';
  // ---- wired in ----
  if (store) {
    if (!NAMES[id]) err(id, 'no name in home/welcome.js NAMES');
    const t = TOURS[id];
    if (!t) err(id, 'no walkthrough in home/welcome.js TOURS');
    else {
      if (!t.tag) err(id, 'its walkthrough has no tag (the line under its name in aOS)');
      if (!Array.isArray(t.cards) || t.cards.length < 3 || t.cards.length > 6) err(id, 'its walkthrough should have 3 to 6 cards');
      for (const c of t.cards || []) {
        if (!c.t || !c.d) err(id, 'a walkthrough card needs a title and words');
        if (!LINE.has(c.i)) err(id, 'walkthrough card "' + c.t + '" uses icon "' + c.i + '", which isn’t in home/welcome.js LINE');
      }
    }
    if (!HUE[id]) err(id, 'no colour in aOS/index.html HUE');
    if (!CAT[id]) err(id, 'no category in aOS/index.html CAT');
    if (!NEEDS[id]) err(id, 'nothing in aOS/index.html NEEDS (what it needs from a new person)');
  }
  if (!new RegExp("^\\s+- '" + dir + "/\\*\\*'", 'm').test(NEWS)) err(id, ".github/workflows/news.yml push paths lack '" + dir + "/**'");
  if (!copied.has(dir)) err(id, '.github/workflows/news.yml doesn’t copy ' + dir + ' into _site, so it is never published');
  for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png', 'README.md'])
    if (!exists(dir + '/' + f)) err(id, 'no ' + dir + '/' + f);

  const html = read(dir + '/index.html');
  if (!html) continue;
  const wl = /<script\s+src="\.\.\/home\/welcome\.js"([^>]*)>/.exec(html);
  if (!wl) err(id, 'index.html doesn’t load ../home/welcome.js');
  else {
    if (!new RegExp('data-app="' + id + '"').test(wl[1])) err(id, 'welcome.js should be loaded with data-app="' + id + '"');
    if (!/data-auto/.test(wl[1])) err(id, 'welcome.js should be loaded with data-auto');
  }
  if (/back\.js/.test(html)) err(id, 'index.html loads ../home/back.js, which is gone');

  const sw = read(dir + '/sw.js') || '';
  if (/back\.js/.test(sw)) err(id, 'sw.js lists ../home/back.js, which is gone: its install fails');
  const shell = (/const SHELL = (\[[^\]]*\])/.exec(sw) || [])[1];
  if (shell) {
    let list = []; try { list = Function('return ' + shell)(); } catch { err(id, 'sw.js SHELL couldn’t be read'); }
    for (const f of list) {
      const p = f.split('?')[0]; if (p === './' || p === '') continue;
      if (!exists(path.join(dir, p))) err(id, 'sw.js SHELL lists ' + f + ', which doesn’t exist: the offline shell won’t install');
    }
  } else if (sw) err(id, 'sw.js has no SHELL list');
  const cache = (/const CACHE = '([^']+)'/.exec(sw) || [])[1];
  if (sw && !(cache && cache.startsWith(id + '-'))) warn(id, "sw.js CACHE should be '" + id + "-vN'");

  let mf = null; try { mf = JSON.parse(read(dir + '/manifest.webmanifest')); } catch { err(id, 'manifest.webmanifest isn’t valid JSON'); }
  if (mf) {
    for (const k of ['name', 'short_name']) if (!mf[k]) err(id, 'manifest has no ' + k);
    if (mf.start_url !== './' || mf.scope !== './') err(id, 'manifest start_url and scope should be "./"');
    if (mf.display !== 'standalone') err(id, 'manifest display should be standalone');
    const sizes = (mf.icons || []).map(i => i.sizes);
    if (!sizes.includes('180x180') || !sizes.includes('512x512')) err(id, 'manifest needs a 180x180 and a 512x512 icon');
  }

  // ---- ground rules ----
  const rule = (ok, msg) => { if (!ok) err(id, msg); };
  rule(/viewport-fit=cover/.test(html), 'the viewport meta needs viewport-fit=cover (it draws under the notch and home indicator)');
  rule(/name="apple-mobile-web-app-capable"/.test(html), 'no apple-mobile-web-app-capable meta');
  rule(/black-translucent/.test(html), 'the status bar style should be black-translucent');
  rule(/rel="apple-touch-icon"/.test(html), 'no apple-touch-icon link');
  rule(/name="theme-color"/.test(html), 'no theme-color meta');
  rule(DARK_ONLY.includes(id) || /prefers-color-scheme:\s*(dark|light)/.test(html), 'no light and dark: every app follows the phone (prefers-color-scheme), or is listed in DARK_ONLY');
  rule(/prefers-reduced-motion/.test(html), 'doesn’t honour prefers-reduced-motion');
  rule(!/fonts\.(googleapis|gstatic)\.com|<link[^>]+rel="stylesheet"[^>]+href="https?:/i.test(html), 'loads a web font or stylesheet from another site: AllisonOS uses the system font, and nothing from elsewhere');
  if (store) rule(/--tile:/.test(html), 'doesn’t use the faint cards every app shares (--tile / --tile-edge)');
  // Visible text only: strip scripts, styles and tags, then look for an uppercase AOS.
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');
  rule(!/\bAOS\b/.test(text), 'writes "AOS": it is always "aOS", with a lowercase a');
  if (!/http-equiv="Content-Security-Policy"/.test(html)) warn(id, 'no Content-Security-Policy meta');
  if (!DARK_ONLY.includes(id) && !/data-theme="dark"\]/.test(html)) warn(id, 'no :root[data-theme="dark"] rules: a chosen Dark relies on welcome.js rewriting the media queries');
}

for (const w of warnings) console.log('warning - ' + w);
for (const e of errors) console.log('error   - ' + e);
console.log(ids.length + ' apps checked: ' + errors.length + ' error' + (errors.length === 1 ? '' : 's') + ', ' + warnings.length + ' warning' + (warnings.length === 1 ? '' : 's'));
process.exit(errors.length ? 1 : 0);
