// The Vintage sky (home/sky.js), as a person sees it at iPhone size (390 x 844): aOS and every Vintage
// design wear Weather Vintage's backgrounds - by day (Light) a cream ground washed with mustard, the sun
// and rays that turn very slowly; by night (Dark) a walnut ground washed with teal, the moon and
// twinkling stars. Checks, in every one of them:
//   - Light is the day sky and Dark the night sky, from the phone, or from the Light / Dark choice in the
//     app (home.settings.theme) when it disagrees with the phone;
//   - the ground, the disc and its colours are Weather Vintage's, and text and muted text still read on it
//     (4.5:1), including the faint text;
//   - the rays (day) and the stars (night) are there and move, and hold still with reduced motion;
//   - nothing grows sideways, and no text sits straight on the disc (light-on-light at night);
//   - aOS in its Sea glass look has no sky; Home Vintage's other tones stay as picked.
// Weather Vintage isn't here: it draws its own sky from the forecast (weathervintage/scripts/app-test.mjs).
// Works on any day: the date is pinned to the longest month name, which makes the widest headers.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node aOS/scripts/sky-test.mjs [repo root] [one app]
import { createRequire } from 'module'; import { execSync } from 'child_process'; import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/'); const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, r)); const BASE = 'http://localhost:' + server.address().port;
const b = await chromium.launch();
let failed = 0;
const report = (name, problems) => { if (problems.length) { failed++; console.log('not ok - ' + name + '\n  ' + problems.join('\n  ')); } else console.log('ok - ' + name); };

const APPS = ['aOS', 'mailvintage', 'housevintage', 'ordersvintage', 'drinksvintage', 'fitnessvintage', 'newsvintage', 'travelvintage', 'calendarvintage', 'notesvintage', 'podcastsvintage', 'placesvintage', 'mealsvintage'];
const DAY = { ground: 'rgb(241, 223, 187)', disc: 'rgb(227, 167, 47)' }, NIGHT = { ground: 'rgb(34, 59, 55)', disc: 'rgb(233, 221, 196)' };

// colours (rgb(...) as the page reports them) and contrast
const rgb = c => (/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(c) || []).slice(1, 4).map(Number);
const lum = ([r, g, bl]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl); };
const contrast = (a, c) => { const x = lum(rgb(a)), y = lum(rgb(c)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// a phone on one app. scheme: the phone's appearance; theme: the Light / Dark choice in the app (or none); reduce: reduced motion
async function open(app, { scheme = 'light', theme = null, reduce = false, look = null, seed = {} } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(({ theme, look, seed }) => {
    try {
      const s = {}; for (const a of ['aos', 'mailvintage', 'housevintage', 'ordersvintage', 'drinksvintage', 'fitnessvintage', 'newsvintage', 'travelvintage', 'calendarvintage', 'notesvintage', 'podcastsvintage', 'placesvintage', 'mealsvintage']) s[a] = '999';
      localStorage.setItem('aos.seen', JSON.stringify(s)); localStorage.setItem('aos.signin.asked', '1');
      if (theme) localStorage.setItem('home.settings', JSON.stringify({ theme }));
      if (look) localStorage.setItem('aos.look', look);
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      // the longest month name, the longest day name: the widest headers an app draws
      const T = new Date(2026, 8, 30, 12).getTime(), R = Date;
      globalThis.Date = class extends R { constructor(...a) { a.length ? super(...a) : super(T); } static now() { return T; } };
    } catch {}
  }, { theme, look, seed });
  await ctx.route('**/*', r => { const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort(); if (u.pathname.includes('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); return r.continue(); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/' + app + '/'); await p.waitForTimeout(900);
  return { ctx, p, errs };
}

// what the page shows now
const look = p => p.evaluate(() => {
  const r = document.documentElement, host = document.querySelector('.ambient, .aurora, .atoms'), disc = host && host.children[0];
  const probe = (prop, v) => { const e = document.createElement('i'); e.style[prop] = v; document.body.appendChild(e); const c = getComputedStyle(e)[prop]; e.remove(); return c; };
  const stars = host ? [...host.querySelectorAll('.aos-star')].filter(s => getComputedStyle(s).display !== 'none') : [];
  const rays = disc ? getComputedStyle(disc, '::before') : null;
  const tokens = {}; for (const t of ['text', 'muted', 'faint', 'accent-text']) tokens[t] = probe('color', `var(--${t})`);
  // text straight on the disc: the text's box meets the disc's circle, with no opaque card, button or field between
  const bad = [];
  if (disc) {
    const d = disc.getBoundingClientRect(), cx = d.left + d.width / 2, cy = d.top + d.height / 2, rad = d.width / 2;
    const opaque = el => { for (let e = el; e && e !== r; e = e.parentElement) {
      if (host.contains(e)) return false; if (e.contains(host)) continue;
      const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(e).backgroundColor); if (m) { const a = m[1].split(/[ ,\/]+/).filter(Boolean); if (a.length < 4 || +a[3] >= 0.85) return true; }
      if (getComputedStyle(e).backgroundImage !== 'none') return true; } return false; };
    for (const el of document.querySelectorAll('body *')) {
      if (host.contains(el)) continue;
      const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
      if (!own) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      const rg = document.createRange(); rg.selectNodeContents(el);
      for (const q of [...rg.getClientRects()].filter(x => x.width > 0 && x.height > 0 && x.top < 400)) {
        const nx = Math.max(q.left, Math.min(cx, q.right)), ny = Math.max(q.top, Math.min(cy, q.bottom));
        if (Math.hypot(nx - cx, ny - cy) < rad - 2 && !opaque(el)) { bad.push('"' + own.slice(0, 30) + '" at ' + Math.round(q.left) + ',' + Math.round(q.top)); break; }
      }
    }
  }
  return {
    sky: r.getAttribute('data-sky') || '', ground: probe('backgroundColor', 'var(--bg)'), disc: disc ? getComputedStyle(disc).backgroundColor : null, host: !!host,
    rays: rays ? { content: rays.content, anim: rays.animationName, dur: rays.animationDuration } : null,
    stars: stars.length, starAnim: stars[0] ? getComputedStyle(stars[0]).animationName : null, starOpacity: stars[0] ? getComputedStyle(stars[0]).opacity : null,
    metas: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content),
    tokens, over: r.scrollWidth - r.clientWidth, bad,
  };
});

const day = (s, tag) => { const o = [];
  if (s.sky !== 'day') o.push(tag + ': data-sky is "' + s.sky + '", not day');
  if (s.ground !== DAY.ground) o.push(tag + ': the ground is ' + s.ground + ', not Weather Vintage\'s mustard-washed cream ' + DAY.ground);
  if (s.disc !== DAY.disc) o.push(tag + ': the disc is ' + s.disc + ', not the mustard sun ' + DAY.disc);
  if (!s.rays || s.rays.content === 'none' || s.rays.anim !== 'aos-sky-spin') o.push(tag + ': the sun has no slowly turning rays (' + JSON.stringify(s.rays) + ')');
  else if (parseFloat(s.rays.dur) < 30) o.push(tag + ': the rays turn too fast to be subtle (' + s.rays.dur + ')');
  if (s.stars) o.push(tag + ': ' + s.stars + ' stars are showing by day');
  return o; };
const night = (s, tag) => { const o = [];
  if (s.sky !== 'night') o.push(tag + ': data-sky is "' + s.sky + '", not night');
  if (s.ground !== NIGHT.ground) o.push(tag + ': the ground is ' + s.ground + ', not Weather Vintage\'s teal-washed walnut ' + NIGHT.ground);
  if (s.disc !== NIGHT.disc) o.push(tag + ': the disc is ' + s.disc + ', not the cream moon ' + NIGHT.disc);
  if (s.stars < 10) o.push(tag + ': only ' + s.stars + ' stars at night');
  else if (s.starAnim !== 'aos-sky-twinkle') o.push(tag + ': the stars don\'t twinkle (' + s.starAnim + ')');
  if (s.rays && s.rays.content !== 'none' && s.rays.content !== 'normal') o.push(tag + ': the moon has sun rays');
  return o; };
const reads = (s, tag) => { const o = [];
  for (const [t, min] of [['text', 4.5], ['muted', 4.5], ['faint', 4.5], ['accent-text', 4.5]]) { const c = contrast(s.tokens[t], s.ground); if (c < min) o.push(tag + ': --' + t + ' ' + s.tokens[t] + ' on the ground ' + s.ground + ' is ' + c.toFixed(2) + ':1, under ' + min); }
  if (s.over > 2) o.push(tag + ': the page is ' + s.over + 'px wider than the screen');
  for (const t of s.bad) o.push(tag + ': text straight on the disc, light on light or hard to read: ' + t);
  return o; };

for (const app of APPS.filter(a => !process.argv[3] || a === process.argv[3])) {
  const tag = app, pr = [];
  // Light: day. Dark: night.
  let o = await open(app, { scheme: 'light' }); let s = await look(o.p);
  if (!s.host) pr.push(tag + ': no .ambient, .aurora or .atoms box for the sky'); else { pr.push(...day(s, tag + ' light'), ...reads(s, tag + ' light')); }
  if (s.metas.length && !s.metas.includes('#F1DFBB')) pr.push(tag + ' light: the theme-color metas are ' + s.metas + ', not the day ground');
  pr.push(...o.errs.map(e => tag + ' light: script error ' + e)); await o.ctx.close();
  o = await open(app, { scheme: 'dark' }); s = await look(o.p);
  pr.push(...night(s, tag + ' dark'), ...reads(s, tag + ' dark'));
  if (s.metas.length && !s.metas.includes('#223B37')) pr.push(tag + ' dark: the theme-color metas are ' + s.metas + ', not the night ground');
  pr.push(...o.errs.map(e => tag + ' dark: script error ' + e)); await o.ctx.close();
  // the choice in the app wins over the phone, both ways
  o = await open(app, { scheme: 'light', theme: 'dark' }); s = await look(o.p); pr.push(...night(s, tag + ' phone Light, app Dark')); await o.ctx.close();
  o = await open(app, { scheme: 'dark', theme: 'light' }); s = await look(o.p); pr.push(...day(s, tag + ' phone Dark, app Light')); await o.ctx.close();
  // reduced motion: the rays and stars hold still
  o = await open(app, { scheme: 'light', reduce: true }); s = await look(o.p);
  if (s.rays && s.rays.anim !== 'none') pr.push(tag + ' reduced motion: the rays still turn (' + s.rays.anim + ')'); await o.ctx.close();
  o = await open(app, { scheme: 'dark', reduce: true }); s = await look(o.p);
  if (s.starAnim !== 'none') pr.push(tag + ' reduced motion: the stars still twinkle (' + s.starAnim + ')');
  if (!(parseFloat(s.starOpacity) > 0.3)) pr.push(tag + ' reduced motion: the stars are not visible (opacity ' + s.starOpacity + ')'); await o.ctx.close();
  report(app + ': day by Light, night by Dark, Weather Vintage\'s colours, rays and stars that move, reduced motion', pr);
}

{ // aOS in Sea glass has none of it, and it comes back with Vintage
  const pr = [];
  for (const scheme of ['light', 'dark']) {
    const o = await open('aOS', { scheme, look: 'glass' }); const s = await look(o.p);
    if (s.sky) pr.push('Sea glass ' + scheme + ': data-sky is "' + s.sky + '"');
    if (s.ground === DAY.ground || s.ground === NIGHT.ground) pr.push('Sea glass ' + scheme + ': the ground is the sky\'s ' + s.ground);
    if (s.stars) pr.push('Sea glass ' + scheme + ': ' + s.stars + ' stars showing');
    if (s.metas.some(m => m === '#F1DFBB' || m === '#223B37')) pr.push('Sea glass ' + scheme + ': the theme-color metas are the sky\'s: ' + s.metas);
    if (scheme === 'dark') {
      await o.p.evaluate(() => window.aosLook.set('vintage')); await o.p.waitForTimeout(200);
      const v = await look(o.p); pr.push(...night(v, 'back to Vintage'));
    }
    await o.ctx.close();
  }
  report('aOS: Sea glass has no sky, and Vintage brings it back', pr);
}

{ // Home Vintage: the Vintage tone is the sky's ground; a tone picked in Customization stays as picked
  const pr = [];
  let o = await open('housevintage', { scheme: 'dark' }); let s = await look(o.p);
  if (s.ground !== NIGHT.ground) pr.push('the Vintage tone is ' + s.ground + ' at night, not the sky\'s ' + NIGHT.ground);
  await o.ctx.close();
  o = await open('housevintage', { scheme: 'light', seed: { 'housev.toneV': '2', 'housev.tone': '"slate"' } }); s = await look(o.p);
  if (s.ground === DAY.ground) pr.push('a picked tone (Slate) was painted over with the sky\'s ground');
  if (s.sky !== 'day' || s.disc !== DAY.disc) pr.push('with another tone the sky is still drawn over it, but it is ' + s.sky + ' with a ' + s.disc + ' disc');
  await o.ctx.close();
  report('Home Vintage: its Vintage tone is the sky\'s ground; other tones stay as picked', pr);
}

await b.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed'); process.exit(failed ? 1 : 0);
