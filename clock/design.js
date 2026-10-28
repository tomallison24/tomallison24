// Clock's design: Vintage (mid-century modern, the default), Standard (Sea glass), Layers or Tron, picked in
// Settings > Design and kept with the rest of Clock (localStorage, set.design, under the key in the
// page's aos-store meta). Loaded in <head> after the styles, so the page is drawn once, in the
// right design, as aOS's look.js does for aOS:
//   - Vintage is the <style id="vintage"> block; Standard is that block switched off, the Sea
//     glass styles above it showing as they are;
//   - Layers and Tron keep the Vintage block on and switch on their own after it
//     (<style id="layers">, <style id="grid">: aOS/scripts/make-looks.mjs); 'neon' (Night Drive, which Layers
//     replaced) opens Layers; data-tod on <html> is the time of day, for Layers' sky, as in home/design.js;
//   - data-look="vintage" | "glass" | "layers" | "grid" on <html>: home/sky.js draws the day and
//     night sky only in Vintage, as it does for aOS;
//   - what iOS reads when the app is added to the Home Screen follows it too: the icon, the status
//     bar style, the bar colours.
// app.js changes it with window.clockDesign.set(look); aOS's Appearance writes set.design for every app's look, followed
// here at once (the storage event).
'use strict';
(() => {
  const root = document.documentElement;
  const KEY = (document.querySelector('meta[name="aos-store"]') || {}).content || 'allison-clock-v1';
  const SET = {
    vintage: { ground: ['#F4ECDD', '#241E1A'], icon: ['icon-180.png?v=1', 'icon-512.png?v=1'], bar: 'default' },
    glass: { ground: ['#EEF2F0', '#0D1213'], icon: ['icon-glass-180.png?v=1', 'icon-glass-512.png?v=1'], bar: 'black-translucent' },
    layers: { ground: null, icon: ['icon-layers-180.png?v=1', 'icon-layers-512.png?v=1'], bar: 'default' },   // ground: the sky's top, SKY_TOP
    grid: { ground: ['#050608', '#050608'], icon: ['icon-grid-180.png?v=2', 'icon-grid-512.png?v=2'], bar: 'default' },
  };
  const tod = (h = new Date().getHours()) => h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';
  const SKY_TOP = { morning: ['#F4DCCB', '#42302A'], afternoon: ['#B9DCD2', '#1F3B35'], evening: ['#EDCDC9', '#3F2B2E'], night: ['#D2D7EE', '#0F1426'] };
  const ok = v => v === 'neon' ? 'layers' : Object.prototype.hasOwnProperty.call(SET, v) ? v : 'vintage';
  let stored = null;
  try { stored = ((JSON.parse(localStorage.getItem(KEY)) || {}).set || {}).design; } catch {}
  function apply(look) {
    look = ok(look);
    const s = SET[look];
    root.setAttribute('data-look', look);
    root.setAttribute('data-tod', tod());
    if (look === 'grid') root.setAttribute('data-theme', 'dark'); else if (root.getAttribute('data-theme') === 'dark' && root.dataset.tron) root.removeAttribute('data-theme');   // Tron is dark only, as in the car (welcome.js keeps it so, and puts your own back after)
    if (look === 'grid') root.dataset.tron = '1'; else delete root.dataset.tron;
    const v = document.getElementById('vintage'); if (v) v.media = look === 'glass' ? 'not all' : 'all';
    for (const id of ['layers', 'grid']) { const b = document.getElementById(id); if (b) b.media = look === id ? 'all' : 'not all'; }
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.content = (s.ground || SKY_TOP[root.dataset.tod])[/dark/.test(m.dataset.media || m.media) ? 1 : 0];   // welcome.js keeps the original media there
    const bar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]'); if (bar) bar.content = s.bar;
    const touch = document.querySelector('link[rel="apple-touch-icon"]'); if (touch) touch.href = s.icon[0];
    const tab = document.querySelector('link[rel="icon"]'); if (tab) tab.href = s.icon[1];
    return look;
  }
  let look = apply(stored);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && root.dataset.tod !== tod()) apply(look); });
  window.clockDesign = {
    get: () => look,
    flat: () => look !== 'glass',
    set(next) { look = apply(next); window.dispatchEvent(new Event('clock:design')); return look; },
  };
  addEventListener('storage', e => {
    if (e.key !== KEY) return;
    let d; try { d = ok(((JSON.parse(e.newValue) || {}).set || {}).design); } catch { return; }
    if (d !== look) window.clockDesign.set(d);
  });
})();
