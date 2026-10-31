// The Vintage sky (home/sky.js), as a person sees it at iPhone size (390 x 844): aOS and every app in
// its Vintage design wear Weather Vintage's backgrounds - by day (the sun is up) a ground washed with mustard, the sun
// and rays that turn very slowly; by night a ground washed with deep teal, the moon and twinkling stars -
// each over cream (Light) or walnut (Dark), so four skies. Day and night are the real sun's: sunrise and
// sunset for the phone's place (the equation Weather Vintage uses), else its time zone's. Checks, in every one:
//   - the four skies: the ground, the disc and its colours are Weather Vintage's, text and muted text still
//     read on them (4.5:1, faint and accent included), the rays (day) and stars (night) are there and move
//     and hold still with reduced motion, nothing grows sideways, and no text sits straight on the disc;
//   - Light or Dark from the phone, or from the choice in the app (home.settings.theme) when it disagrees;
//   - the sun: the changeover is at sunrise and sunset (an hour either side), moves on by itself while the
//     app is open, works from a place the app was already allowed to know (never asking), from the time zone
//     when there is none, and can be held still (aos.sky: what the other tests do, so they work at any hour);
//   - aOS in its Sea glass look has no sky, nor any app in its Standard (Sea glass) design (home/design.js);
//     Home's Customization tones are Standard's.
// Weather isn't here: in Vintage it draws its own sky from the forecast (weather/scripts/app-test.mjs).
// The text-off-the-disc check holds on the widest fallback font too (the phone has Futura; CI's Linux and Android do not):
// SKY_FONT="DejaVu Sans" node aOS/scripts/sky-test.mjs tries one. CI runs it in three shards side by side:
// node aOS/scripts/sky-test.mjs . 1/3 checks every third app's skies, from the second, and the last shard
// the sun, the time zones and Standard too.
// Works on any day: the clock is pinned (September 30, the longest month name, which makes the widest headers).
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node aOS/scripts/sky-test.mjs [repo root] [one app, or a shard: i/n]
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

const APPS = ['aOS', 'mail', 'house', 'orders', 'drinks', 'fitness', 'news', 'travel', 'calendar', 'notes', 'podcasts', 'places', 'meals', 'clock', 'sparkle', 'money', 'school'];   // every app in its Vintage design (the default)
// the four skies: sky and tone -> the page colour, the disc, the hex the theme-color meta carries
const SKY = {
  'day light': { ground: 'rgb(241, 223, 187)', disc: 'rgb(227, 167, 47)', meta: '#F1DFBB' },
  'day dark': { ground: 'rgb(74, 57, 30)', disc: 'rgb(227, 167, 47)', meta: '#4A391E' },
  'night light': { ground: 'rgb(210, 216, 203)', disc: 'rgb(251, 245, 233)', meta: '#D2D8CB' },
  'night dark': { ground: 'rgb(34, 59, 55)', disc: 'rgb(233, 221, 196)', meta: '#223B37' },
};
// a place the app already knows (Raleigh, made up as a point on the map), and the clock: noon and half past eleven at night there
const PLACE = { lat: 35.8, lon: -78.6 };
const NOON = '2026-09-30T16:00:00Z', NIGHT = '2026-10-01T03:30:00Z';
const local = hhmm => { const [h, m] = hhmm.split(':').map(Number); return new Date(Date.UTC(2026, 8, 30, h + 4, m)).toISOString(); };   // New York time (EDT, UTC-4) on September 30

// colours (rgb(...) as the page reports them) and contrast
const rgb = c => (/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(c) || []).slice(1, 4).map(Number);
const lum = ([r, g, bl]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl); };
const contrast = (a, c) => { const x = lum(rgb(a)), y = lum(rgb(c)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// a phone on one app. at: the moment (ISO); scheme: the phone's appearance; theme: the Light / Dark choice in the app;
// reduce: reduced motion; place: false = the app has never been told where it is; pin: aos.sky; zone: the time zone;
// geo: a position the phone would give, with permission already granted; install: let the clock run (for a changeover)
async function open(app, { at = NOON, scheme = 'light', theme = null, reduce = false, look = null, seed = {}, place = true, pin = null, zone = 'America/New_York', geo = null, install = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme, timezoneId: zone, locale: 'en-US',
    reducedMotion: reduce ? 'reduce' : 'no-preference', ...(geo ? { geolocation: geo, permissions: ['geolocation'] } : {}) });
  if (install) await ctx.clock.install({ time: new Date(at) }); else await ctx.clock.setFixedTime(new Date(at));
  await ctx.addInitScript(({ theme, look, seed, place, pin, at, PLACE }) => {
    try {
      const s = {}; for (const a of ['aos', 'mail', 'house', 'orders', 'drinks', 'fitness', 'news', 'travel', 'calendar', 'notes', 'podcasts', 'places', 'meals', 'clock', 'sparkle', 'money', 'school']) s[a] = '999';
      localStorage.setItem('aos.seen', JSON.stringify(s)); localStorage.setItem('aos.signin.asked', '1');
      if (place) localStorage.setItem('aos.sky.loc', JSON.stringify({ ...PLACE, t: Date.parse(at) }));
      if (pin) localStorage.setItem('aos.sky', pin);
      if (theme) localStorage.setItem('home.settings', JSON.stringify({ theme }));
      if (look) localStorage.setItem('aos.look', look);
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    } catch {}
  }, { theme, look, seed, place, pin, at, PLACE });
  await ctx.route('**/*', r => { const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort(); if (u.pathname.includes('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); return r.continue(); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/' + app + '/');
  if (process.env.SKY_FONT) await p.addStyleTag({ content: `*{font-family:"${process.env.SKY_FONT}",sans-serif !important}` });   // try another fallback font (the phone has Futura; another machine or Android doesn't)
  await p.waitForTimeout(900);
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
    sky: r.getAttribute('data-sky') || '', tone: r.getAttribute('data-sky-tone') || '', ground: probe('backgroundColor', 'var(--bg)'), disc: disc ? getComputedStyle(disc).backgroundColor : null, host: !!host,
    rays: rays ? { content: rays.content, anim: rays.animationName, dur: rays.animationDuration } : null,
    stars: stars.length, starAnim: stars[0] ? getComputedStyle(stars[0]).animationName : null, starOpacity: stars[0] ? getComputedStyle(stars[0]).opacity : null,
    metas: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content),
    tokens, over: r.scrollWidth - r.clientWidth, bad, saved: (() => { try { return localStorage.getItem('aos.sky.loc'); } catch { return null; } })(),
  };
});

// the sky a page should show: 'day light', 'night dark'...
const sky = (s, want, tag) => { const w = SKY[want], o = [], [m, t] = want.split(' ');
  if (s.sky !== m || s.tone !== t) o.push(tag + ': the sky is "' + s.sky + ' ' + s.tone + '", not ' + want);
  if (s.ground !== w.ground) o.push(tag + ': the ground is ' + s.ground + ', not Weather Vintage\'s ' + w.ground + ' (' + want + ')');
  if (s.disc !== w.disc) o.push(tag + ': the disc is ' + s.disc + ', not ' + w.disc + ' (' + (m === 'day' ? 'the mustard sun' : 'the moon') + ')');
  if (m === 'day') {
    if (!s.rays || s.rays.content === 'none' || s.rays.anim !== 'aos-sky-spin') o.push(tag + ': the sun has no slowly turning rays (' + JSON.stringify(s.rays) + ')');
    else if (parseFloat(s.rays.dur) < 30) o.push(tag + ': the rays turn too fast to be subtle (' + s.rays.dur + ')');
    if (s.stars) o.push(tag + ': ' + s.stars + ' stars are showing by day');
  } else {
    if (s.stars < 10) o.push(tag + ': only ' + s.stars + ' stars at night');
    else if (s.starAnim !== 'aos-sky-twinkle') o.push(tag + ': the stars don\'t twinkle (' + s.starAnim + ')');
    if (s.rays && s.rays.content !== 'none' && s.rays.content !== 'normal') o.push(tag + ': the moon has sun rays');
  }
  if (s.metas.length && !s.metas.includes(w.meta)) o.push(tag + ': the theme-color metas are ' + s.metas + ', not ' + w.meta);
  return o; };
const reads = (s, tag) => { const o = [];
  for (const t of ['text', 'muted', 'faint', 'accent-text']) { const c = contrast(s.tokens[t], s.ground); if (c < 4.5) o.push(tag + ': --' + t + ' ' + s.tokens[t] + ' on the ground ' + s.ground + ' is ' + c.toFixed(2) + ':1, under 4.5'); }
  if (s.over > 2) o.push(tag + ': the page is ' + s.over + 'px wider than the screen');
  for (const t of s.bad) o.push(tag + ': text straight on the disc, light on light or hard to read: ' + t);
  return o; };

const [SHARD, SHARDS] = /^\d+\/\d+$/.test(process.argv[3] || '') ? process.argv[3].split('/').map(Number) : [0, 1];
const ONE = SHARDS === 1 ? process.argv[3] : null, REST = !ONE && SHARD === SHARDS - 1;   // REST: this one checks the sun and Standard too
for (const app of APPS.filter((a, k) => ONE ? a === ONE : k % SHARDS === SHARD)) {
  const pr = [];
  // the four skies: Light or Dark, by day or night
  for (const [scheme, at, want] of [['light', NOON, 'day light'], ['dark', NOON, 'day dark'], ['light', NIGHT, 'night light'], ['dark', NIGHT, 'night dark']]) {
    const tag = app + ' ' + want, o = await open(app, { scheme, at }); const s = await look(o.p);
    if (!s.host) pr.push(tag + ': no .ambient, .aurora or .atoms box for the sky'); else pr.push(...sky(s, want, tag), ...reads(s, tag));
    pr.push(...o.errs.map(e => tag + ': script error ' + e)); await o.ctx.close();
  }
  // the choice in the app wins over the phone, both ways
  let o = await open(app, { scheme: 'light', theme: 'dark', at: NIGHT }); pr.push(...sky(await look(o.p), 'night dark', app + ' phone Light, app Dark')); await o.ctx.close();
  o = await open(app, { scheme: 'dark', theme: 'light', at: NOON }); pr.push(...sky(await look(o.p), 'day light', app + ' phone Dark, app Light')); await o.ctx.close();
  // reduced motion: the rays and stars hold still
  o = await open(app, { at: NOON, reduce: true }); let s = await look(o.p);
  if (s.rays && s.rays.anim !== 'none') pr.push(app + ' reduced motion: the rays still turn (' + s.rays.anim + ')'); await o.ctx.close();
  o = await open(app, { at: NIGHT, scheme: 'dark', reduce: true }); s = await look(o.p);
  if (s.starAnim !== 'none') pr.push(app + ' reduced motion: the stars still twinkle (' + s.starAnim + ')');
  if (!(parseFloat(s.starOpacity) > 0.3)) pr.push(app + ' reduced motion: the stars are not visible (opacity ' + s.starOpacity + ')'); await o.ctx.close();
  report(app + ': the four skies (day and night, Light and Dark), Weather Vintage\'s colours, rays and stars that move, reduced motion', pr);
}

if (REST) {
  { // the sun: the changeover is at sunrise and sunset for the place, and moves on by itself
    const pr = [];
    for (const [t, want] of [['06:15', 'night'], ['07:45', 'day'], ['18:15', 'day'], ['19:45', 'night'], ['02:00', 'night']]) {
      const o = await open('notes', { at: local(t) }); const s = await look(o.p);
      if (s.sky !== want) pr.push('at ' + t + ' (sunrise about 7:10, sunset about 6:55 pm in Raleigh on September 30) the sky is ' + s.sky + ', not ' + want);
      await o.ctx.close();
    }
    // the same place, later in the year: the winter sun is down at 5:15 pm but up at 4:15 pm (Raleigh, December 21: sunset 5:03 pm)
    for (const [iso, want] of [['2026-12-21T21:15:00Z', 'day'], ['2026-12-21T22:15:00Z', 'night']]) {
      const o = await open('notes', { at: iso }); const s = await look(o.p);
      if (s.sky !== want) pr.push('on December 21 at ' + new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }) + ' the sky is ' + s.sky + ', not ' + want);
      await o.ctx.close();
    }
    // open across sunrise: it turns to day by itself, and the theme-color metas go with it
    const o = await open('notes', { at: local('06:30'), scheme: 'light', install: true });
    let s = await look(o.p); if (s.sky !== 'night') pr.push('before sunrise the sky is ' + s.sky);
    await o.p.clock.runFor(90 * 60000); s = await look(o.p);
    if (s.sky !== 'day' || s.ground !== SKY['day light'].ground) pr.push('90 minutes later (after sunrise) with the app still open the sky is ' + s.sky + ' on ' + s.ground + ', not day');
    if (!s.metas.includes(SKY['day light'].meta)) pr.push('the theme-color metas did not follow the sunrise: ' + s.metas);
    await o.p.clock.runFor(13 * 3600000); s = await look(o.p);
    if (s.sky !== 'night') pr.push('13 hours later (after sunset) with the app still open the sky is ' + s.sky + ', not night');
    await o.ctx.close();
    report('the sun: night and day change at sunrise and sunset for the place, by the clock, with the app open', pr);
  }
  { // where: the time zone's guess, then a place the phone gives when it was already allowed (never asked)
    const pr = [];
    for (const [zone, at, want] of [['America/New_York', NOON, 'day'], ['America/New_York', NIGHT, 'night'], ['America/Los_Angeles', '2026-09-30T19:00:00Z', 'day'], ['America/Los_Angeles', '2026-10-01T09:00:00Z', 'night'], ['Europe/London', '2026-09-30T12:00:00Z', 'day'], ['Europe/London', '2026-10-01T01:00:00Z', 'night']]) {
      const o = await open('notes', { at, zone, place: false }); const s = await look(o.p);
      if (s.sky !== want) pr.push('with no place, in ' + zone + ' at ' + at + ' the sky is ' + s.sky + ', not ' + want);
      if (s.saved) pr.push('with no permission a place was kept anyway: ' + s.saved);
      await o.ctx.close();
    }
    // allowed already: the phone's position is kept, to a tenth of a degree, and it decides. 7:30 pm in New York
    // (23:30 UTC) is after sunset there, but 4:30 pm in Seattle, where the phone is: day
    const o = await open('notes', { at: '2026-09-30T23:30:00Z', place: false, geo: { latitude: 47.6062, longitude: -122.3321 } });
    await o.p.waitForTimeout(600); const s = await look(o.p);
    let kept = null; try { kept = JSON.parse(s.saved); } catch {}
    if (!kept || kept.lat !== 47.6 || kept.lon !== -122.3) pr.push('the position the phone gave is not kept, rounded to a tenth of a degree: ' + s.saved);
    if (s.sky !== 'day') pr.push('with the phone in Seattle at 4:30 pm there the sky is ' + s.sky + ', not day');
    await o.ctx.close();
    const n = await open('notes', { at: '2026-09-30T23:30:00Z', place: false }); const sn = await look(n.p);
    if (sn.sky !== 'night') pr.push('the same moment with no place known (the New York time zone\'s guess) is ' + sn.sky + ', not night');
    await n.ctx.close();
    report('where: the time zone when there is no place, the phone\'s position (kept to a tenth of a degree) only if it was already allowed', pr);
  }
  { // held still
    const pr = [];
    let o = await open('notes', { at: NOON, pin: 'night' }); pr.push(...sky(await look(o.p), 'night light', 'pinned to night at noon')); await o.ctx.close();
    o = await open('notes', { at: NIGHT, pin: 'day', scheme: 'dark' }); pr.push(...sky(await look(o.p), 'day dark', 'pinned to day at night')); await o.ctx.close();
    report('aos.sky holds the sky still, for tests', pr);
  }
  { // aOS in Sea glass has none of it, and it comes back with Vintage
    const pr = [];
    for (const scheme of ['light', 'dark']) {
      const o = await open('aOS', { scheme, look: 'glass', at: NOON }); const s = await look(o.p);
      if (s.sky) pr.push('Sea glass ' + scheme + ': data-sky is "' + s.sky + '"');
      if (Object.values(SKY).some(k => k.ground === s.ground)) pr.push('Sea glass ' + scheme + ': the ground is the sky\'s ' + s.ground);
      if (s.stars) pr.push('Sea glass ' + scheme + ': ' + s.stars + ' stars showing');
      if (s.metas.some(m => Object.values(SKY).some(k => k.meta === m))) pr.push('Sea glass ' + scheme + ': the theme-color metas are the sky\'s: ' + s.metas);
      if (scheme === 'dark') {
        await o.p.evaluate(() => window.aosLook.set('vintage')); await o.p.waitForTimeout(200);
        pr.push(...sky(await look(o.p), 'day dark', 'back to Vintage'));
      }
      await o.ctx.close();
    }
    report('aOS: Sea glass has no sky, and Vintage brings it back', pr);
  }
  { // Home in Vintage: the page is the sky's ground; a tone picked in Customization is Standard's
    const pr = [];
    let o = await open('house', { scheme: 'dark', at: NIGHT }); let s = await look(o.p);
    if (s.ground !== SKY['night dark'].ground) pr.push('the Vintage tone is ' + s.ground + ' at night in Dark, not the sky\'s ' + SKY['night dark'].ground);
    await o.ctx.close();
    o = await open('house', { scheme: 'light', at: NOON }); s = await look(o.p);
    if (s.ground !== SKY['day light'].ground) pr.push('the Vintage tone is ' + s.ground + ' by day in Light, not the sky\'s ' + SKY['day light'].ground);
    await o.ctx.close();
    // a tone picked in Customization is for Standard: in Vintage the page is still the sky's
    o = await open('house', { scheme: 'light', at: NOON, seed: { 'house.toneV': '2', 'house.tone': '"slate"' } }); s = await look(o.p);
    if (s.ground !== SKY['day light'].ground) pr.push('a tone picked for Standard (Slate) shows in Vintage: ' + s.ground);
    if (s.sky !== 'day' || s.disc !== SKY['day light'].disc) pr.push('the sky is ' + s.sky + ' with a ' + s.disc + ' disc');
    await o.ctx.close();
    report('Home in Vintage: the page is the sky\'s ground, whatever tone Standard has', pr);
  }
}

if (SHARDS === 1 || REST) { // every app in its Standard (Sea glass) design: no sky (home/design.js sets data-look="glass"), and Vintage brings it back
  const pr = [];
  for (const app of APPS.filter(a => a !== 'aOS' && a !== 'clock')) {
    const o = await open(app, { seed: { ['design.' + app]: 'glass' } });
    const st = await o.p.evaluate(() => ({ look: document.documentElement.dataset.look, sky: document.documentElement.getAttribute('data-sky') }));
    if (st.look !== 'glass' || st.sky) pr.push(app + ' in Standard: look ' + st.look + ', sky ' + st.sky);
    await o.p.evaluate(() => aosDesign.set('vintage')); await o.p.waitForTimeout(150);
    if (await o.p.evaluate(() => document.documentElement.getAttribute('data-sky')) !== 'day') pr.push(app + ': Vintage did not bring the sky back');
    pr.push(...o.errs.map(e => app + ': ' + e));
    await o.ctx.close();
  }
  report('every app in Standard (Sea glass) has no sky, and Vintage brings it back at once', pr);
}

await b.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed'); process.exit(failed ? 1 : 0);
