// aOS's look: Vintage (mid-century modern, the default), Sea glass, Layers (a still sky by the time of
// day, frosted glass over it) or Tron (light cycles). Picked in the install steps before aOS is added to the Home Screen
// (home/welcome.js), or later under the account (Appearance > Look), where it is every app's look
// too: set(look, { apps }) writes each app's design (design.<id>, Clock's set.design; home/design.js).
// Loaded in <head> after the styles, so the page is drawn once, in the right look. Vintage is the
// <style id="vintage"> block: Sea glass is that block switched off, the styles above it showing as
// they always did; Layers and Tron keep it on and switch on their own block after it
// (<style id="layers">, <style id="grid">, generated from it by aOS/scripts/make-looks.mjs).
// Layers replaced Night Drive ('neon'): a phone that had it opens in Layers, and every app's choice is moved over
// once (below). data-tod on <html> is the time of day, for Layers' sky, as home/design.js sets it in each app.
//
// Where the choice is kept, and how it reaches the Home Screen app (which has storage of its
// own, apart from Safari's): localStorage aos.look; and, for the install, ?look= on the
// address added to the Home Screen and an aos_look cookie. The first launch from the Home
// Screen takes whichever it finds, if nothing is stored yet, and keeps it.
//
// What iOS reads when the app is added follows the look too: the icon, the status bar style.
'use strict';
(() => {
  const KEY = 'aos.look', root = document.documentElement;
  // per look: [light, dark] status bar tints, the Home Screen icon (180, 512), the status bar style
  const SET = {
    vintage: { ground: ['#F4ECDD', '#241E1A'], icon: ['icon-180.png?v=3', 'icon-512.png?v=3'], bar: 'default' },
    glass: { ground: ['#EEF2F0', '#0D1213'], icon: ['icon-glass-180.png?v=1', 'icon-glass-512.png?v=1'], bar: 'black-translucent' },
    layers: { ground: null, icon: ['icon-layers-180.png?v=1', 'icon-layers-512.png?v=1'], bar: 'default' },   // ground: the sky's top, SKY_TOP
    grid: { ground: ['#050608', '#050608'], icon: ['icon-grid-180.png?v=2', 'icon-grid-512.png?v=2'], bar: 'default' },
  };
  // Layers' sky: the time of day, and the colour at the top of each sky (aOS/scripts/looks.mjs, SKIES), for the bars
  const tod = (h = new Date().getHours()) => h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';
  const SKY_TOP = { morning: ['#F4DCCB', '#42302A'], afternoon: ['#B9DCD2', '#1F3B35'], evening: ['#EDCDC9', '#3F2B2E'], night: ['#D2D7EE', '#0F1426'] };
  const ok = v => v === 'neon' ? 'layers' : typeof v === 'string' && Object.prototype.hasOwnProperty.call(SET, v) ? v : null;   // own keys only: 'constructor' or '__proto__' on the address is not a look
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const fromCookie = () => ok((/(?:^|; )aos_look=(\w+)/.exec(document.cookie) || [])[1]);
  const fromUrl = () => ok(new URLSearchParams(location.search).get('look'));
  const stored = () => { try { return ok(localStorage.getItem(KEY)); } catch { return null; } };
  const keep = look => { try { localStorage.setItem(KEY, look); } catch {} };
  const apply = look => {
    const s = SET[look];
    root.setAttribute('data-look', look);
    root.setAttribute('data-tod', tod());
    if (look === 'grid') root.setAttribute('data-theme', 'dark'); else if (root.getAttribute('data-theme') === 'dark' && root.dataset.tron) root.removeAttribute('data-theme');   // Tron is dark only, as in the car (welcome.js keeps it so, and puts your own back after)
    if (look === 'grid') root.dataset.tron = '1'; else delete root.dataset.tron;
    const mc = document.getElementById('vintage'); if (mc) mc.media = look === 'glass' ? 'not all' : 'all';
    for (const id of ['layers', 'grid']) { const b = document.getElementById(id); if (b) b.media = look === id ? 'all' : 'not all'; }
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.content = (s.ground || SKY_TOP[root.dataset.tod])[/dark/.test(m.dataset.media || m.media) ? 1 : 0];   // welcome.js keeps the original media there
    const bar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]'); if (bar) bar.content = s.bar;
    const touch = document.querySelector('link[rel="apple-touch-icon"]'); if (touch) touch.href = s.icon[0];
    const tab = document.querySelector('link[rel="icon"]'); if (tab) tab.href = s.icon[1];
  };
  // Night Drive is gone: every app that had it (design.<id>, Clock's set.design) takes Layers, once, here where they share storage
  try {
    if (localStorage.getItem(KEY) === 'neon') localStorage.setItem(KEY, 'layers');
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^design\./.test(k) && localStorage.getItem(k) === 'neon') localStorage.setItem(k, 'layers'); }
    const ck = 'allison-clock-v1', c = JSON.parse(localStorage.getItem(ck) || 'null');
    if (c && c.set && c.set.design === 'neon') { c.set.design = 'layers'; localStorage.setItem(ck, JSON.stringify(c)); }
  } catch {}
  // stored first; else what the install carried over (address, then cookie), kept from now on
  let look = stored();
  if (!look) { look = fromUrl() || fromCookie(); if (look) keep(look); }
  look = look || 'vintage';
  window.aosLook = {
    get: () => root.getAttribute('data-look') || look,
    flat: () => window.aosLook.get() !== 'glass',
    set(next, { apps } = {}) {
      next = ok(next) || 'vintage';
      keep(next);
      if (apps) for (const id of apps) {   // every app takes it too (Clock keeps its design with its other settings)
        try {
          if (id === 'clock') { const k = 'allison-clock-v1', o = JSON.parse(localStorage.getItem(k)) || {}; o.set = Object.assign({}, o.set, { design: next }); localStorage.setItem(k, JSON.stringify(o)); }
          else localStorage.setItem('design.' + id, next);
        } catch {}
      }
      try { document.cookie = 'aos_look=' + next + '; path=/aOS/; max-age=31536000; SameSite=Lax'; } catch {}
      if (!standalone()) {   // the address added to the Home Screen carries it
        try { const q = new URLSearchParams(location.search); q.set('look', next); history.replaceState(history.state, '', location.pathname + '?' + q + location.hash); } catch {}
      }
      apply(next); window.dispatchEvent(new Event('aos:look'));
    },
  };
  apply(look);
  // back to aOS after a while: Layers' sky catches up with the time of day (only then, so it never changes as you look)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && root.dataset.tod !== tod()) apply(window.aosLook.get()); });
  // changed on another page (Ipsy in an app open inside aOS): aOS follows at once
  addEventListener('storage', e => { if (e.key === KEY && ok(e.newValue) && ok(e.newValue) !== window.aosLook.get()) { apply(ok(e.newValue)); window.dispatchEvent(new Event('aos:look')); } });
})();
