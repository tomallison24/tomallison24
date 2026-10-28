// The Vintage sky: the day and night backgrounds of Weather Vintage, for every Vintage app.
// Shared by all of them (like slide.js), so the apps can't drift apart.
//
//   Day    while the sun is up: a ground washed with mustard; the sun, with rays that turn very slowly.
//   Night  after sunset:        a ground washed with deep teal; the moon, and stars that twinkle.
//
// The same colours as Weather Vintage (index.html, "the colour groups": sun and night), which draws
// its own sky from the forecast. Here the sun is the real one: sunrise and sunset come from the same
// equation as Weather Vintage's (app.js sunEvents), for where the phone is - the place it already
// let the app know (location permission already given: asked for silently, never prompted), else
// worked out from the phone's time zone (good to within about an hour). The ground is cream or
// walnut under the wash, following Light or Dark (the phone's, or the choice in aOS), so there are
// four skies: day and night, each in Light and in Dark.
//
// What this does, so an app only has to load it (in <head>, so the first paint is right):
//   - puts data-sky="day"|"night" and data-sky-tone="light"|"dark" on <html> (off while aOS is in
//     its Sea glass look), and moves on at sunrise and sunset;
//   - re-colours the page: --bg (and the other ground tokens), a faint text colour (and, for a
//     light night, the teal) that still reads on it, and the disc's colour (--sky-disc, which the
//     app's own atomic shapes use);
//   - gives the app's first atomic shape (the disc in .ambient, .aurora or .atoms) the sun's
//     rays by day, and adds twinkling stars to that same box by night;
//   - sets the theme-color metas to the ground;
//   - under an iPhone's solid status bar, fades the shapes in from the ground at the top of the
//     page (below, "The status bar").
// Nothing here draws the shapes themselves: the apps keep their own sizes and places for the
// disc, the teal dot and the orange pill, tuned to each app's header.
// Motion: the rays and stars hold still with prefers-reduced-motion.
// localStorage 'aos.sky' = 'day' or 'night' holds the sky still (the tests do, so they work at any hour).
// window.aosSky: mode() 'day' | 'night', tone() 'light' | 'dark', ground() the page colour;
// 'aos:sky' fires on window when any of them changes.
'use strict';
(() => {
  if (window.aosSky) return;
  const root = document.documentElement;
  // Weather Vintage's grounds: mustard (day) or teal (night) washed into cream (Light) or walnut (Dark)
  const GROUND = { day: { light: '#F1DFBB', dark: '#4A391E' }, night: { light: '#D2D8CB', dark: '#223B37' } };

  const CSS = `
:root:root[data-sky] { --bg: var(--sky-ground); --page: var(--sky-ground); --mc-ground: var(--sky-ground); --faint: var(--sky-faint); }
:root:root[data-sky="day"] { --sky-disc: #E3A72F; }
:root:root[data-sky="day"][data-sky-tone="light"] { --sky-ground: ${GROUND.day.light}; --sky-faint: #6E5C52; }
:root:root[data-sky="day"][data-sky-tone="dark"] { --sky-ground: ${GROUND.day.dark}; --sky-faint: #B8AB94; }
:root:root[data-sky="night"][data-sky-tone="light"] { --sky-ground: ${GROUND.night.light}; --sky-disc: #FBF5E9; --sky-star: #1F6F6B; --sky-faint: #6A584E; --accent: #1A6561; --accent-text: #1A6561; }
:root:root[data-sky="night"][data-sky-tone="dark"] { --sky-ground: ${GROUND.night.dark}; --sky-disc: #E9DDC4; --sky-star: #F4ECDD; --sky-faint: #B3A68F; }
html[data-sky] :is(.ambient, .aurora, .atoms) { overflow-x: clip; }
html[data-sky="day"] :is(.ambient, .aurora, .atoms) > :nth-child(1)::before {
  content: ''; position: absolute; inset: -70%; border-radius: 50%; pointer-events: none;
  background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--sky-disc) 38%, transparent) 0deg 6deg, transparent 6deg 18deg);
  -webkit-mask-image: radial-gradient(circle, transparent 20%, #000 22%, transparent 68%);
  mask-image: radial-gradient(circle, transparent 20%, #000 22%, transparent 68%);
  animation: aos-sky-spin 80s linear infinite; }
.aos-sky-cap { position: absolute; left: -50%; right: -50%; height: 44px; z-index: 9; display: none; pointer-events: none; background: linear-gradient(var(--sky-ground, var(--aos-cap)), transparent);
  opacity: 1 !important; border-radius: 0 !important; transform: none !important; animation: none !important; filter: none !important; margin: 0 !important; }   /* not one of the shapes (an app's .ambient > * rules) */
html[data-bar="solid"]:is([data-sky], [data-look="grid"]) .aos-sky-cap { display: block; }   /* not Layers: its sky runs up into the bar as it is */
.aos-star { position: absolute; display: none; border-radius: 50%; background: var(--sky-star, #F4ECDD); pointer-events: none; animation: aos-sky-twinkle ease-in-out infinite alternate; }
html[data-sky="night"] .aos-star { display: block; }
@keyframes aos-sky-spin { to { transform: rotate(360deg); } }
@keyframes aos-sky-twinkle { from { opacity: .15; transform: scale(.7); } to { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) {
  html[data-sky="day"] :is(.ambient, .aurora, .atoms) > :nth-child(1)::before { animation: none; }
  .aos-star { animation: none; opacity: .7; }
}`;
  const style = document.createElement('style');
  style.id = 'aos-sky';
  style.textContent = CSS;
  (document.head || root).appendChild(style);

  // ---- Light or Dark ----
  const dark = matchMedia('(prefers-color-scheme: dark)');
  // As chosen in the app (home.settings.theme, applied as data-theme by welcome.js), else the phone's own.
  // Read from storage too: this runs before the deferred welcome.js sets data-theme.
  const light = () => {
    let t = root.getAttribute('data-theme');
    if (t !== 'light' && t !== 'dark') try { t = (JSON.parse(localStorage.getItem('home.settings')) || {}).theme; } catch { t = null; }
    if (t === 'light' || t === 'dark') return t === 'light';
    return !dark.matches;
  };

  // ---- Sun: the sunrise equation, as Weather Vintage's (app.js sunEvents) ----
  // Accurate to about a minute for a known place. Returns each day's { rise, set } in unix seconds
  // from the day before fromMs to `days` after it; a polar day has polar: true, a polar night nothing.
  function sunEvents(lat, lon, fromMs, days) {
    const rad = Math.PI / 180, out = [];
    const jd0 = fromMs / 86400000 + 2440587.5;
    const n0 = Math.floor(jd0 - 2451545.0 + 0.0008);
    for (let n = n0 - 1; n <= n0 + days; n++) {
      const js = n - lon / 360;
      const M = (357.5291 + 0.98560028 * js) % 360;
      const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
      const L = (M + C + 180 + 102.9372) % 360;
      const jt = 2451545.0 + js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
      const dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
      const cosw = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec));
      const toS = j => Math.round((j - 2440587.5) * 86400);
      if (cosw < -1) out.push({ rise: toS(jt - 0.5), set: toS(jt + 0.5) });   // midnight sun: day all day
      else if (cosw <= 1) { const w = Math.acos(cosw) / rad / 360; out.push({ rise: toS(jt - w), set: toS(jt + w) }); }
    }
    return out;
  }

  // ---- Where ----
  // The place, rounded to a tenth of a degree (about 7 miles: plenty for a sunrise), is kept on this phone
  // only (aos.sky.loc), and never sent anywhere. Taken from the phone only if the app already has permission
  // (so nothing is ever asked), at most every few days; until then, the time zone's.
  const KEY = 'aos.sky.loc', STALE = 3 * 86400000;
  const kept = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && isFinite(v.lat) && isFinite(v.lon) ? v : null; } catch { return null; } };
  const LAT = { 'America/New_York': 40, 'America/Detroit': 42, 'America/Chicago': 38, 'America/Denver': 40, 'America/Phoenix': 33, 'America/Los_Angeles': 37, 'America/Anchorage': 61, 'Pacific/Honolulu': 21 };
  function guess() {   // longitude from the standard-time offset, latitude from the zone (mid-latitude when unknown)
    let zone = ''; try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
    const y = new Date().getFullYear(), std = Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset());
    return { lat: LAT[zone] || 38, lon: Math.max(-180, Math.min(180, -std / 4)) };
  }
  let place = kept() || guess();
  function refine() {
    const k = kept();
    if (k && Date.now() - (k.t || 0) < STALE) return;
    if (!navigator.permissions || !navigator.geolocation) return;
    navigator.permissions.query({ name: 'geolocation' }).then(p => {
      if (p.state !== 'granted') return;
      navigator.geolocation.getCurrentPosition(pos => {
        const v = { lat: Math.round(pos.coords.latitude * 10) / 10, lon: Math.round(pos.coords.longitude * 10) / 10, t: Date.now() };
        try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
        place = v; apply();
      }, () => {}, { maximumAge: 7 * 86400000, timeout: 8000 });
    }).catch(() => {});
  }

  // Day now, and when that next changes (ms from now), for the place
  function sun() {
    let pin = null; try { pin = localStorage.getItem('aos.sky'); } catch {}
    if (pin === 'day' || pin === 'night') return { day: pin === 'day', wait: 6 * 3600000 };   // held still: for tests, or to look at the other one
    const now = Date.now(), s = now / 1000;
    const ev = sunEvents(place.lat, place.lon, now, 2);
    const day = ev.some(e => s >= e.rise && s < e.set);
    const next = ev.flatMap(e => [e.rise, e.set]).filter(t => t > s).sort((a, b) => a - b)[0];
    return { day, wait: next ? Math.max(1000, (next - s) * 1000 + 1000) : 6 * 3600000 };
  }

  // Off ('') in every look but Vintage: Sea glass has no sky, Layers paints its own still one, and Tron draws its own shapes
  // (their blocks, aOS/scripts/looks.mjs).
  let now = '', tone = '', timer = 0;
  function apply() {
    clearTimeout(timer);
    let m = '', t = '';
    if (root.getAttribute('data-look') === 'vintage') {
      const s = sun(); m = s.day ? 'day' : 'night'; t = light() ? 'light' : 'dark';
      timer = setTimeout(apply, Math.min(s.wait, 30 * 60000));   // at the next sunrise or sunset (rechecked at least every half hour)
    }
    if (m === now && t === tone) return;
    now = m; tone = t;
    if (m) {
      root.setAttribute('data-sky', m); root.setAttribute('data-sky-tone', t);
      // the bar around the page (Safari's, or the browser's): the ground, as the other metas say
      for (const el of document.querySelectorAll('meta[name="theme-color"]')) {
        el.content = GROUND[m][/dark/.test(el.dataset.media || el.getAttribute('media') || '') ? 'dark' : 'light'];
      }
    } else { root.removeAttribute('data-sky'); root.removeAttribute('data-sky-tone'); }
    window.dispatchEvent(new CustomEvent('aos:sky', { detail: m }));
  }
  window.aosSky = { mode: () => now, tone: () => tone, ground: () => (now && GROUND[now][tone]) || null };
  apply();
  // welcome.js sets data-theme a moment later; aOS's look.js sets data-look; the phone can switch too;
  // and an app left open comes back after sunset
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-look'] });
  (dark.addEventListener ? dark.addEventListener('change', apply) : dark.addListener(apply));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(); });
  refine();

  // Stars for the night, in the same box as the app's atomic shapes: seeded, so they are the
  // same every time (like Weather's), spread over the top of the page where the shapes are.
  function stars() {
    const host = document.querySelector('.ambient, .aurora, .atoms');
    if (!host || host.querySelector('.aos-star')) return;
    const h = Math.min(host.clientHeight || 270, 270), n = Math.max(10, Math.round(h / 270 * 26));
    let seed = 11;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < n; i++) {
      const s = document.createElement('s'), z = 1 + rnd() * 1.6;
      s.className = 'aos-star';
      s.style.cssText = `left:${(rnd() * 100).toFixed(1)}%;top:${(rnd() * h).toFixed(0)}px;width:${z.toFixed(1)}px;height:${z.toFixed(1)}px;animation-duration:${(2 + rnd() * 3).toFixed(2)}s;animation-delay:-${(rnd() * 4).toFixed(2)}s`;
      host.appendChild(s);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stars); else stars();

  // ---- The status bar ----
  // An app added to an iPhone's Home Screen with the opaque status bar (aOS: "default", which iOS reads
  // once, when the app is added) has a solid strip above the page, in the page's own ground colour
  // (iOS 26: the body's background, or a full-width fixed element's at the top, such as aOS's frame
  // around an app). The shapes and the sun's rays would stop flat under it, a band across the top of
  // every page; here they fade in from the ground instead: the sky's in Vintage, the page's own in Tron
  // (its shapes run to the top too; Layers' sky simply carries on up into the bar). Inside aOS, an app goes by aOS's bar.
  // localStorage aos.bar = 'solid' shows it anywhere (the tests).
  function solidBar() {
    try { if (localStorage.getItem('aos.bar') === 'solid') return true; } catch {}
    try {
      const w = window.top, d = w.document;
      if (!(w.navigator.standalone === true || w.matchMedia('(display-mode: standalone)').matches)) return false;
      const p = d.createElement('div');
      p.style.cssText = 'position:fixed;top:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top)';
      d.documentElement.appendChild(p); const top = parseFloat(w.getComputedStyle(p).paddingTop) || 0; p.remove();
      return top === 0;
    } catch { return false; }
  }
  function cap() {
    if (!solidBar()) return root.removeAttribute('data-bar');
    root.setAttribute('data-bar', 'solid');
    const see = el => { const b = el && getComputedStyle(el).backgroundColor; return b && b !== 'transparent' && !/,\s*0\)$/.test(b) ? b : ''; };
    root.style.setProperty('--aos-cap', see(document.body) || see(root) || 'transparent');   // the other flat looks' ground (Vintage's is the sky's)
    for (const host of document.querySelectorAll('.ambient, .aurora, .atoms')) {
      let c = host.querySelector(':scope > .aos-sky-cap');
      if (!c) { c = document.createElement('i'); c.className = 'aos-sky-cap'; host.appendChild(c); }
      const box = host.closest('#scroller');   // aOS's tabs scroll in a box of their own (aOS/index.html)
      c.style.top = -(host.getBoundingClientRect().top + (box ? box.scrollTop : scrollY) + host.clientTop) + 'px';   // at the top of the page, wherever the box starts (from inside the host's border)
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cap); else cap();
  addEventListener('load', cap); addEventListener('resize', cap);
  new MutationObserver(() => requestAnimationFrame(cap)).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-look'] });   // the ground changes with light or dark, and the look
  (dark.addEventListener ? dark.addEventListener('change', cap) : dark.addListener(cap));
})();
