// Clock's design: Vintage (mid-century modern, the default) or Standard (Sea glass), picked in
// Settings > Design and kept with the rest of Clock (localStorage, set.design, under the key in the
// page's aos-store meta). Loaded in <head> after the styles, so the page is drawn once, in the
// right design, as aOS's look.js does for aOS:
//   - Vintage is the <style id="vintage"> block; Standard is that block switched off, the Sea
//     glass styles above it showing as they are;
//   - data-look="vintage" | "glass" on <html>: home/sky.js draws the day and night sky only in
//     Vintage, as it does for aOS;
//   - what iOS reads when the app is added to the Home Screen follows it too: the icon, the status
//     bar style, the bar colours.
// app.js changes it with window.clockDesign.set('vintage' | 'glass').
'use strict';
(() => {
  const root = document.documentElement;
  const KEY = (document.querySelector('meta[name="aos-store"]') || {}).content || 'allison-clock-v1';
  const SET = {
    vintage: { ground: ['#F4ECDD', '#241E1A'], icon: ['icon-180.png?v=1', 'icon-512.png?v=1'], bar: 'default' },
    glass: { ground: ['#EEF2F0', '#0D1213'], icon: ['icon-glass-180.png?v=1', 'icon-glass-512.png?v=1'], bar: 'black-translucent' },
  };
  const ok = v => v === 'glass' || v === 'vintage' ? v : 'vintage';
  let stored = null;
  try { stored = ((JSON.parse(localStorage.getItem(KEY)) || {}).set || {}).design; } catch {}
  function apply(look) {
    look = ok(look);
    const s = SET[look];
    root.setAttribute('data-look', look);
    const v = document.getElementById('vintage'); if (v) v.media = look === 'glass' ? 'not all' : 'all';
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.content = s.ground[/dark/.test(m.media) ? 1 : 0];
    const bar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]'); if (bar) bar.content = s.bar;
    const touch = document.querySelector('link[rel="apple-touch-icon"]'); if (touch) touch.href = s.icon[0];
    const tab = document.querySelector('link[rel="icon"]'); if (tab) tab.href = s.icon[1];
    return look;
  }
  let look = apply(stored);
  window.clockDesign = {
    get: () => look,
    set(next) { look = apply(next); window.dispatchEvent(new Event('clock:design')); return look; },
  };
})();
