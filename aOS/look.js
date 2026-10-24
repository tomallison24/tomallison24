// aOS's look: Vintage (mid-century modern, the default), Sea glass, Night Drive (neon) or Folk
// (Gzhel and Khokhloma). Picked in the install steps before aOS is added to the Home Screen
// (home/welcome.js), or later under the account (Appearance > Look), where it is every app's look
// too: set(look, { apps }) writes each app's design (design.<id>, Clock's set.design; home/design.js).
// Loaded in <head> after the styles, so the page is drawn once, in the right look. Vintage is the
// <style id="vintage"> block: Sea glass is that block switched off, the styles above it showing as
// they always did; Night Drive and Folk keep it on and switch on their own block after it
// (<style id="neon">, <style id="folk">, generated from it by aOS/scripts/make-looks.mjs).
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
    neon: { ground: ['#F5F2FD', '#140A22'], icon: ['icon-neon-180.png?v=1', 'icon-neon-512.png?v=1'], bar: 'default' },
    folk: { ground: ['#F4F7FD', '#0F0B07'], icon: ['icon-folk-180.png?v=1', 'icon-folk-512.png?v=1'], bar: 'default' },
  };
  const ok = v => v in SET ? v : null;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const fromCookie = () => ok((/(?:^|; )aos_look=(\w+)/.exec(document.cookie) || [])[1]);
  const fromUrl = () => ok(new URLSearchParams(location.search).get('look'));
  const stored = () => { try { return ok(localStorage.getItem(KEY)); } catch { return null; } };
  const keep = look => { try { localStorage.setItem(KEY, look); } catch {} };
  const apply = look => {
    const s = SET[look];
    root.setAttribute('data-look', look);
    const mc = document.getElementById('vintage'); if (mc) mc.media = look === 'glass' ? 'not all' : 'all';
    for (const id of ['neon', 'folk']) { const b = document.getElementById(id); if (b) b.media = look === id ? 'all' : 'not all'; }
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.content = s.ground[/dark/.test(m.media) ? 1 : 0];
    const bar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]'); if (bar) bar.content = s.bar;
    const touch = document.querySelector('link[rel="apple-touch-icon"]'); if (touch) touch.href = s.icon[0];
    const tab = document.querySelector('link[rel="icon"]'); if (tab) tab.href = s.icon[1];
  };
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
  // changed on another page (Ipsy in an app open inside aOS): aOS follows at once
  addEventListener('storage', e => { if (e.key === KEY && ok(e.newValue) && ok(e.newValue) !== window.aosLook.get()) { apply(ok(e.newValue)); window.dispatchEvent(new Event('aos:look')); } });
})();
