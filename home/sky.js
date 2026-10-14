// The Vintage sky: the day and night backgrounds of Weather Vintage, for every Vintage app.
// Shared by all of them (like slide.js), so the apps can't drift apart.
//
//   Day    (Light)  a cream ground washed with mustard; the sun, with rays that turn very slowly.
//   Night  (Dark)   a walnut ground washed with deep teal; the moon, and stars that twinkle.
//
// The same colours as Weather Vintage (index.html, "the colour groups": sun and night), which
// draws its own sky from the forecast; every other Vintage app follows the Light or Dark choice
// (the phone's, or the one in aOS), so the sky changes when the phone's appearance does.
//
// What this does, so an app only has to load it (in <head>, so the first paint is right):
//   - puts data-sky="day" or "night" on <html> (off while aOS is in its Sea glass look);
//   - re-colours the page: --bg (and the other ground tokens), a faint text colour that still
//     reads on it, and the disc's colour (--sky-disc, which the app's own atomic shapes use);
//   - gives the app's first atomic shape (the disc in .ambient, .aurora or .atoms) the sun's
//     rays by day, and adds twinkling stars to that same box by night;
//   - sets the theme-color metas to the ground.
// Nothing here draws the shapes themselves: the apps keep their own sizes and places for the
// disc, the teal dot and the orange pill, tuned to each app's header.
// Motion: the rays and stars hold still with prefers-reduced-motion.
'use strict';
(() => {
  if (window.aosSky) return;
  const root = document.documentElement;
  // Weather Vintage's grounds: mustard 19.5% into cream, teal 36% into walnut
  const GROUND = { day: '#F1DFBB', night: '#223B37' };

  const CSS = `
:root:root[data-sky] { --bg: var(--sky-ground); --page: var(--sky-ground); --mc-ground: var(--sky-ground); --faint: var(--sky-faint); }
:root:root[data-sky="day"] { --sky-ground: ${GROUND.day}; --sky-disc: #E3A72F; --sky-faint: #6E5C52; }
:root:root[data-sky="night"] { --sky-ground: ${GROUND.night}; --sky-disc: #E9DDC4; --sky-star: #F4ECDD; --sky-faint: #B3A68F; }
html[data-sky] :is(.ambient, .aurora, .atoms) { overflow-x: clip; }
html[data-sky="day"] :is(.ambient, .aurora, .atoms) > :nth-child(1)::before {
  content: ''; position: absolute; inset: -70%; border-radius: 50%; pointer-events: none;
  background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--sky-disc) 38%, transparent) 0deg 6deg, transparent 6deg 18deg);
  -webkit-mask-image: radial-gradient(circle, transparent 20%, #000 22%, transparent 68%);
  mask-image: radial-gradient(circle, transparent 20%, #000 22%, transparent 68%);
  animation: aos-sky-spin 80s linear infinite; }
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

  const dark = matchMedia('(prefers-color-scheme: dark)');
  // Light or dark as chosen in the app (home.settings.theme, applied as data-theme by welcome.js),
  // else the phone's own. Read from storage too: this runs before the deferred welcome.js sets data-theme.
  const light = () => {
    let t = root.getAttribute('data-theme');
    if (t !== 'light' && t !== 'dark') try { t = (JSON.parse(localStorage.getItem('home.settings')) || {}).theme; } catch { t = null; }
    if (t === 'light' || t === 'dark') return t === 'light';
    return !dark.matches;
  };
  // Day or night: the appearance. (One place to change if it should follow the sun instead.)
  // Off ('') in aOS's Sea glass look, which has no sky.
  const mode = () => root.getAttribute('data-look') === 'glass' ? '' : light() ? 'day' : 'night';

  let now = null;
  function apply() {
    const m = mode();
    if (m === now) return;
    now = m;
    if (m) {
      root.setAttribute('data-sky', m);
      // the bar around the page (Safari's, or the browser's): the ground, as the other metas say
      for (const el of document.querySelectorAll('meta[name="theme-color"]')) {
        el.content = GROUND[/dark/.test(el.dataset.media || el.getAttribute('media') || '') ? 'night' : 'day'];
      }
    } else root.removeAttribute('data-sky');
    window.dispatchEvent(new CustomEvent('aos:sky', { detail: m }));
  }
  window.aosSky = { mode: () => now || '', ground: () => GROUND[now] || null };
  apply();
  // welcome.js sets data-theme a moment later; aOS's look.js sets data-look; the phone can switch too
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-look'] });
  (dark.addEventListener ? dark.addEventListener('change', apply) : dark.addListener(apply));

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
})();
