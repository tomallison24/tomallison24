// Every app's design: Vintage (mid-century modern, the default), Standard (Sea glass), Night Drive
// (neon) or Tron (light cycles), picked in the app's own Settings > Design, as in Clock, or
// for every app at once in aOS (Account > Appearance: aOS/look.js writes each app's design.<id>). Shared by every app (like sky.js), so they can't
// drift apart. Loaded in <head> after the styles, before ../home/sky.js, so the page is drawn once,
// in the right design:
//   <script src="../home/design.js" data-app="<id>"></script>
//
//   - Vintage is the page's <style id="vintage"> block; Standard is that block switched off, the
//     Sea glass styles above it showing as they are; Night Drive and Tron keep the Vintage block on
//     (its shapes) and switch on their own block after it, <style id="neon"> or <style id="grid">,
//     which repaints it (generated from it by aOS/scripts/make-looks.mjs);
//   - data-look="vintage" | "glass" | "neon" | "grid" on <html>: sky.js draws the day and night sky
//     only in Vintage, and an app's own CSS or script can tell them apart by it (every look but
//     glass is flat: aosDesign.flat());
//   - what iOS reads when the app is added to the Home Screen follows it too: the icon
//     (icon-<n>.png is Vintage, icon-glass-<n>.png Sea glass, icon-neon-<n>.png, icon-grid-<n>.png),
//     the status bar style, the bar colours (each theme-color meta's own content is Sea glass;
//     data-vintage on it, else cream or walnut; the new looks' own grounds).
// The choice is kept on this phone: localStorage design.<id> = 'vintage' | 'glass' | 'neon' | 'grid'
// (nothing kept means Vintage). A change made elsewhere (aOS's Appearance, another frame) is followed
// at once (the storage event).
//
// The Vintage designs used to be apps of their own (mealsvintage/ and the rest), each with its own
// storage. Their addresses now open this same app (the deploy copies each app there: news.yml), so
// a phone that added one keeps it. The first time this runs there, it moves that app's data to this
// app's names, if this app has none yet on this phone (otherwise both were in use here, in Safari,
// and this app's own are kept):
//   data-was="mealsvintage"                            the old app's id: what it has seen (aos.seen)
//   data-keys="allison-mealsv-=allison-meals-"         localStorage key prefixes, old=new, comma-separated
//   data-dbs="allison-mealsv=allison-meals"            IndexedDB databases, old=new (copied store by store)
// Nothing old is deleted. aosDesign.moved resolves once the databases are copied (at once when none).
//
// window.aosDesign: get() 'vintage' | 'glass' | 'neon' | 'grid'; flat(); set(look); picker() the Settings > Design rows (html,
// the same in every app, as in Clock: put it in the app's own group box, e.g. its .rgroup); bind(box)
// wires the [data-design] buttons in box, now and after box is re-rendered (aria-checked, and a tap
// sets that design); 'aos:design' fires on window on a change.
'use strict';
(() => {
  if (window.aosDesign) return;
  const me = document.currentScript || document.querySelector('script[src$="home/design.js"]');
  const data = (me && me.dataset) || {};
  const APP = data.app || '';
  const KEY = 'design.' + APP;
  const root = document.documentElement;
  const GROUND = { vintage: ['#F4ECDD', '#241E1A'], neon: ['#F5F2FD', '#140A22'], grid: ['#050608', '#050608'] };
  const LOOKS = ['vintage', 'glass', 'neon', 'grid'];
  const ok = v => LOOKS.includes(v) ? v : 'vintage';
  const pairs = s => String(s || '').split(',').map(p => p.split('=').map(x => x.trim())).filter(p => p.length === 2 && p[0] && p[1]);

  // ---- The old Vintage app's data, moved once ----
  let moved = Promise.resolve(false);
  (function move() {
    if (!data.was) return;
    const keys = pairs(data.keys), dbs = pairs(data.dbs);
    let ls; try { ls = window.localStorage; ls.length; } catch { return; }
    const DONE = KEY + '.moved';
    try { if (ls.getItem(DONE)) return; } catch { return; }
    const all = []; for (let i = 0; i < ls.length; i++) all.push(ls.key(i));
    const old = all.filter(k => keys.some(([o]) => k.startsWith(o)));
    let seen = null; try { seen = JSON.parse(ls.getItem('aos.seen')); } catch {}
    if (!seen || typeof seen !== 'object') seen = null;
    const wasHere = old.length || (seen && data.was in seen);
    // Has this app been used here already? What each app has seen (welcome.js, aos.seen) says it best: shared
    // scripts can write under this app's names in the old app too (Weather's data.js writes wx.pts in both).
    // Only with nothing seen at all is it this app's keys.
    const mine = seen && Object.keys(seen).length ? APP in seen : all.some(k => keys.some(([, n]) => k.startsWith(n)));
    try {
      if (wasHere && !mine) {
        for (const k of old) {
          const [o, n] = keys.find(([o]) => k.startsWith(o));
          ls.setItem(n + k.slice(o.length), ls.getItem(k));
        }
        if (seen && seen[data.was] && !seen[APP]) { seen[APP] = seen[data.was]; ls.setItem('aos.seen', JSON.stringify(seen)); }
        if (dbs.length) moved = Promise.all(dbs.map(([o, n]) => copyDB(o, n).catch(() => false))).then(() => true);
        else moved = Promise.resolve(true);
      }
      ls.setItem(DONE, '1');
    } catch {}
  })();

  // Copies every store of database `from` into `to`, if `to` doesn't exist yet (it is made at
  // `from`'s version, with the same stores, so the app opens it with no upgrade).
  async function copyDB(from, to) {
    if (!window.indexedDB || !indexedDB.databases) return false;
    const list = await indexedDB.databases();
    const src = list.find(d => d.name === from);
    if (!src || list.some(d => d.name === to)) return false;
    const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const a = await req(indexedDB.open(from));
    const stores = [...a.objectStoreNames];
    const rows = {};
    for (const s of stores) {
      const st = a.transaction(s, 'readonly').objectStore(s);
      const [ks, vs] = await Promise.all([req(st.getAllKeys()), req(st.getAll())]);
      rows[s] = { ks, vs, inline: st.keyPath != null, keyPath: st.keyPath, auto: st.autoIncrement };
    }
    const version = a.version; a.close();
    const open = indexedDB.open(to, version);
    open.onupgradeneeded = () => { for (const s of stores) if (!open.result.objectStoreNames.contains(s)) open.result.createObjectStore(s, rows[s].inline ? { keyPath: rows[s].keyPath, autoIncrement: rows[s].auto } : { autoIncrement: rows[s].auto }); };
    const b = await req(open);
    if (stores.length) await new Promise((res, rej) => {
      const t = b.transaction(stores, 'readwrite');
      for (const s of stores) { const st = t.objectStore(s); rows[s].vs.forEach((v, i) => rows[s].inline ? st.put(v) : st.put(v, rows[s].ks[i])); }
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
    b.close();
    return true;
  }

  // ---- The design ----
  let stored = null; try { stored = localStorage.getItem(KEY); } catch {}
  function apply(look) {
    look = ok(look);
    root.setAttribute('data-look', look);
    if (look === 'grid') root.setAttribute('data-theme', 'dark'); else if (root.getAttribute('data-theme') === 'dark' && root.dataset.tron) root.removeAttribute('data-theme');   // Tron is dark only, as in the car (welcome.js keeps it so, and puts your own back after)
    if (look === 'grid') root.dataset.tron = '1'; else delete root.dataset.tron;
    const v = document.getElementById('vintage'); if (v) v.media = look === 'glass' ? 'not all' : 'all';
    for (const id of ['neon', 'grid']) { const b = document.getElementById(id); if (b) b.media = look === id ? 'all' : 'not all'; }
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
      if (!m.dataset.glass) m.dataset.glass = m.content;
      const dark = /dark/.test(m.dataset.media || m.getAttribute('media') || '');   // welcome.js keeps the original media there
      m.content = look === 'glass' ? m.dataset.glass : look === 'vintage' && m.dataset.vintage || GROUND[look][dark ? 1 : 0];
    }
    const bar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (bar) { if (!bar.dataset.glass) bar.dataset.glass = bar.content; bar.content = look === 'glass' ? bar.dataset.glass : 'default'; }   // black-translucent's white clock would vanish on the cream
    for (const l of document.querySelectorAll('link[rel="apple-touch-icon"], link[rel="icon"]')) {
      const h = l.getAttribute('href') || '';
      l.setAttribute('href', h.replace(/icon(?:-(?:glass|neon|grid))?-(\d+)\.png/, look === 'vintage' ? 'icon-$1.png' : `icon-${look}-$1.png`));
    }
    return look;
  }
  let look = apply(stored);

  // ---- Settings > Design: the same two rows in every app (as in Clock), in the app's own tokens ----
  const css = document.createElement('style');
  css.id = 'aos-design';
  css.textContent = `
.aos-design{display:block}
.aos-design [data-design]{display:flex;align-items:center;gap:12px;width:100%;min-height:62px;margin:0;padding:10px 14px;border:0;border-top:1px solid var(--hair-2,rgba(128,128,128,.18));background:none;font:inherit;text-align:left;color:var(--text);cursor:pointer;-webkit-tap-highlight-color:transparent}
.aos-design [data-design]:first-child{border-top:0}
.aos-design [data-design]:active{background:var(--fill,rgba(128,128,128,.08))}
.aos-design [data-design]:focus-visible{outline:2px solid var(--accent-text,currentColor);outline-offset:-2px}
.aos-design .sw{flex:none;width:30px;height:30px;border-radius:50%;box-shadow:inset 0 0 0 1px var(--hair,rgba(128,128,128,.25))}
.aos-design .sw.vintage{background:conic-gradient(#E3A72F 0 25%,#1F6F6B 0 50%,#D8572A 0 75%,#4A3426 0)}
.aos-design .sw.glass{background:linear-gradient(135deg,#6FA597,#8193BC 40%,#BE918F 70%,#BC9C68)}
.aos-design .sw.neon{background:repeating-linear-gradient(to bottom,transparent 0 3px,#120B1F 3px 5px) 0 100%/100% 45% no-repeat,linear-gradient(#FFC75A,#FF8A4C 45%,#FF3D9A)}
.aos-design .sw.grid{background:radial-gradient(circle,#FF2A2A 0 12%,#08090B 13% 38%,#FF2A2A 39% 49%,#08090B 50% 70%,#E9EDF1 71% 76%,#08090B 77%)}
.aos-design .sw.grid{position:relative}
.aos-design .sw.grid::after{content:'';position:absolute;inset:-4px;border-radius:50%;pointer-events:none;background:conic-gradient(transparent 0 70%,rgba(255,42,42,.25) 80%,#FF2A2A 92%,#fff 95%,transparent 96%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2.5px));mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2.5px));filter:drop-shadow(0 0 3px #FF2A2A);animation:aosSeSpin 1.8s linear infinite}
.aos-design .se{display:inline-block;margin-left:7px;padding:2px 7px 1px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;line-height:1.5;vertical-align:2px;white-space:nowrap;color:#fff;background:linear-gradient(100deg,#9E0A14 0%,#FF2A2A 38%,#FF8F8F 50%,#FF2A2A 62%,#9E0A14 100%) 0 0/260% 100%;box-shadow:0 0 8px rgba(255,42,42,.6);text-shadow:0 1px 2px rgba(90,0,0,.55);animation:aosSeShine 2.6s linear infinite}
@keyframes aosSeShine{from{background-position:100% 0}to{background-position:-160% 0}}@keyframes aosSeSpin{to{transform:rotate(1turn)}}@keyframes aosSeRide{to{left:110%}}@keyframes aosSePulse{from{filter:drop-shadow(0 0 2px #FF2A2A)}to{filter:drop-shadow(0 0 9px #FF2A2A)}}
@media (prefers-reduced-motion:reduce){.aos-design .se,.aos-design .sw.grid::after{animation:none}}
.aos-design .grow{flex:1;min-width:0}
.aos-design b{display:block;font-size:16px;font-weight:600;color:var(--text)}
.aos-design small{display:block;margin-top:2px;font-size:13px;line-height:1.35;color:var(--muted)}
.aos-design .tick{flex:none;width:22px;height:22px;opacity:0;color:var(--accent-text,currentColor)}
.aos-design .tick path{fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.aos-design [aria-checked="true"] .tick{opacity:1}`;
  (document.head || root).appendChild(css);
  // Tron is a special edition: its name carries a badge with a light running through it, and a light trail circles its swatch
  const SE = 'Tron <span class="se">Special Edition</span>';
  const TICK = '<svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>';
  const ROWS = [
    ['vintage', 'Vintage', 'Mid-century: cream and walnut, mustard, teal and orange'],
    ['glass', 'Standard', 'Sea glass: frosted glass in the AllisonOS colors'],
    ['neon', 'Night Drive', '80s neon: a striped sunset, magenta and cyan on midnight'],
    ['grid', 'Tron Special Edition', 'Light cycles: red light on a black grid, as in Tron: Ares'],
  ];
  const picker = () => '<div class="aos-design" role="radiogroup" aria-label="Design">' + ROWS.map(([id, name, note]) =>
    `<button type="button" role="radio" data-design="${id}" aria-checked="${id === look}"><span class="sw ${id}" aria-hidden="true"></span><span class="grow"><b>${id === 'grid' ? SE : name}</b><small>${note}</small></span>${TICK}</button>`).join('') + '</div>';

  const boxes = new Set();
  const paint = () => { for (const box of boxes) for (const b of box.querySelectorAll('[data-design]')) b.setAttribute('aria-checked', String(b.dataset.design === look)); };
  // aOS's Appearance (or this app open in another frame) changed it: follow at once
  window.addEventListener('storage', e => {
    if (e.key !== KEY || e.newValue == null || ok(e.newValue) === look) return;
    look = apply(e.newValue); paint();
    window.dispatchEvent(new CustomEvent('aos:design', { detail: look }));
  });
  window.aosDesign = {
    app: APP,
    moved,
    get: () => look,
    flat: () => look !== 'glass',
    looks: ROWS.map(([id, name, note]) => ({ id, name, note })),
    picker,
    set(next) {
      next = ok(next);
      try { localStorage.setItem(KEY, next); } catch {}
      if (next === look) return look;
      look = apply(next); paint();
      window.dispatchEvent(new CustomEvent('aos:design', { detail: look }));
      return look;
    },
    bind(box) {
      if (!box || boxes.has(box)) return;
      boxes.add(box); paint();
      box.addEventListener('click', e => { const b = e.target.closest('[data-design]'); if (b && box.contains(b)) window.aosDesign.set(b.dataset.design); });
    },
  };
})();
