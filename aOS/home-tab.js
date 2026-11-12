// aOS 2's Home: the home of every app. Not a launcher: each app opens inside aOS, over Home, and
// stays where you left it while you go back and forth (aOS1 sent you off to each app's own Home
// Screen icon; those still work, and Get on an app's page still adds one).
//
//   - The Ipsy bar at the top: type and it finds the app (Return opens the one it most likely is),
//     and what's in the apps (aOS/home-find.js, read from this phone, nothing sent anywhere); or
//     ask Ipsy, across the apps that have it (below, "Ipsy in aOS"). Today by your account.
//   - Favorites: Weather and Calendar as widgets (today's weather, what's next), with four apps:
//     the ones you pin (Edit, up to four), then the apps you open most (the last 14 days, kept on
//     this phone: aos.home.used), then a starting four.
//   - Every app, in one card four across: A to Z, or the order you put them in (hold an app a moment, then drag it;
//     aos.home.order, which follows you between devices; A to Z puts them back). Mail's shows its unread count.
//   - No dock, and nothing floats over Home; on Today (or Search), Home floats at the bottom.
//   - Or Thumb arc (Account > Appearance > Home layout, aos.home.layout): Home, Mail, Weather and
//     Calendar on an inner ring and four favorites on an outer one, in the bottom corner your thumb
//     rests on (the left one for the left hand), with what's next and every other app above them, so
//     every app is on the first screen. Tried first in labs/layouts/.
//   - In Layers (aOS/look.js), Classic is Layers' own grid: what's next and the weather on the sky, then every app
//     on one screen, four across, as pebbles in the app's own colour, lighter at the top left, with its drawing in
//     white. The top row is the four you use most (the ones you keep there first: Edit, then tap an app, kept as your pins,
//     aos.home.picks), then every other app A to Z. Tried first as a test page (Calm aOS, Layers).
// Up to MAX_OPEN apps stay open inside aOS, where you left them; the one used longest ago is put
// away to open another.
//
// An app inside aOS: it slides in from the right and fills the screen, its own background running
// up under the status bar, with "‹ aOS" floating over its top left corner. Tap that, or swipe in
// from the left edge, to slide back to Home; hold it for the other open apps. aOS tells each app
// how much its own controls cover (window.aosHome.insets(), read by ../home/welcome.js in the app),
// so the app's content starts clear of them. Every app is on this same site, so inside aOS they all
// share one phone storage: one Face ID sign-in, one Light or dark.
//
// Tried first as a test page (labs/home/, "Swipe"), where the other ways of getting around were
// tried too, then in preview on the owner's phone; aOS2 made it aOS's own.
'use strict';
(() => {
  window.aosHome = window.aosHome || {};   // before any app opens: welcome.js in it looks for this
  const W = AllisonOS.welcome, D = W.data, $ = id => document.getElementById(id), body = document.body;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // Home takes the Apps tab's place and opens first. The dock gives way to a Home button off Home
  // (paintQuick, below); Today moves up by your account, on Home, and the Ipsy bar does Search's job.
  const HOME_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 11l8-7 8 7v8.5a1.5 1.5 0 0 1-1.5 1.5H14v-6h-4v6H5.5A1.5 1.5 0 0 1 4 19.5z"/></svg>';
  const HOME = 'Home';
  const appsTab = document.querySelector('[data-tab="apps"]');
  appsTab.dataset.tab = 'home';
  appsTab.innerHTML = HOME_SVG + HOME;
  appsTab.parentNode.insertBefore(appsTab, appsTab.parentNode.querySelector('[data-tab]'));
  const bar = document.querySelector('nav.bar'), quick = document.createElement('div');
  quick.className = 'quick'; quick.setAttribute('aria-label', 'Back to Home');
  bar.classList.add('quickbar'); bar.append(quick);
  const head = $('home').querySelector('.head'), acct = head.querySelector('[data-acct]'), acts = document.createElement('div');
  acts.className = 'hacts';
  acts.innerHTML = `<button type="button" class="hbtn" data-tab="today" aria-label="Today">${document.querySelector('.tabs [data-tab="today"] svg').outerHTML}</button>`;
  head.append(acts); acts.append(acct);
  let tab = 'home', briefOpen = false;   // briefOpen: the brief on Home (paintBrief, below)
  let hold = null, quiet = 0;   // an app held in Every app, to move it; until when a click is its drop's, not a tap (below)
  const arranging = () => !!(hold && hold.on);
  const showTab = window.aosTabs.show;
  window.aosTabs.show = t => { if (t !== tab) foldBrief(); showTab(t); tab = t; paintQuick(); if (t === 'home') fitArc(); };
  acts.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) window.aosTabs.show(b.dataset.tab); });
  showTab('home');   // (the apps along the bottom are drawn with Home, below)

  // the apps on Home (aOS itself isn't one of them)
  const ALL = ['calendar', 'meals', 'notes', 'house', 'orders', 'weather', 'news', 'mail', 'clock', 'podcasts', 'travel', 'places',
    'fitness', 'drinks', 'money', 'improve', 'sparkle', 'school'].filter(id => D.APPS.includes(id));
  const known = id => ALL.includes(id);
  const name = id => D.NAMES[id] || id;
  const az = ids => ids.slice().sort((a, b) => name(a).localeCompare(name(b), 'en', { sensitivity: 'base' }));
  // Every app's order: A to Z, or the order you put them in (aos.home.order); an app that's new since goes at the end, A to Z
  const ORDER = 'aos.home.order';
  const readOrder = () => { const o = get(ORDER, []); return Array.isArray(o) ? [...new Set(o.filter(known))] : []; };
  let order = readOrder();
  const everyOrder = () => [...order, ...az(ALL.filter(id => !order.includes(id)))];
  const tag = id => (D.TOURS[id] && D.TOURS[id].tag) || '';
  // each app's icon in its own design (design.<app>, ../home/design.js: nothing kept means Vintage),
  // the design it opens in here
  // in Layers, its pebble (icon-pebble.svg, made by make-looks.mjs), as on Layers' grid
  const icon = id => { let d = null; try { d = localStorage.getItem(id === 'clock' ? 'allison-clock-v1' : 'design.' + id); if (id === 'clock') d = ((JSON.parse(d) || {}).set || {}).design; } catch {} if (d === 'neon') d = 'layers';
    if (d === 'layers' && window.aosGlyphs && aosGlyphs[id]) return `../${id}/icon-pebble.svg`;
    return `../${id}/icon${/^(glass|layers|grid)$/.test(d || '') ? '-' + d : ''}-180.png`; };   // neon: Night Drive's, which Layers replaced

  const MAX_OPEN = 4, MAX_PINS = 4, OPEN = 'aos.home.open', PINS = 'aos.home.picks', USED = 'aos.home.used';
  // Weather and Calendar are widgets at the top of Favorites, so they're never among its four apps
  const WIDGETS = ['weather', 'calendar'];
  // Thumb arc: these four on its inner ring, so they're never among the outer ring's four either
  const RING = ['house', 'mail', 'weather', 'calendar'];
  const LAYOUT = 'aos.home.layout', LAYOUTS = ['classic', 'arc', 'arc-left'];
  const readLayout = () => { try { const v = localStorage.getItem(LAYOUT); return LAYOUTS.includes(v) ? v : 'classic'; } catch { return 'classic'; } };
  let layout = readLayout();
  const arc = () => layout !== 'classic';
  // Layers' grid: Classic, in Layers
  const gridOn = () => !arc() && !!window.aosLook && aosLook.get() === 'layers';
  const homeMode = () => arc() ? 'arc' : gridOn() ? 'grid' : '';
  const pinnable = id => known(id) && !(arc() ? RING : WIDGETS).includes(id);
  const STARTERS = ['meals', 'notes', 'mail', 'travel'];

  // ---- how much each app is used: the days it was opened, on this phone ----
  const dayNo = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);
  function noteUse(id) {
    const u = get(USED, {}), d = dayNo();
    u[id] = [...(u[id] || []).filter(x => d - x < 14), d].slice(-60);
    put(USED, u);
  }
  function mostUsed() {
    const u = get(USED, {}), d = dayNo();
    return Object.entries(u).filter(([id]) => pinnable(id))
      .map(([id, a]) => [id, a.filter(x => d - x < 14).length, Math.max(...a)])
      .filter(x => x[1]).sort((a, b) => b[1] - a[1] || b[2] - a[2]).map(x => x[0]);
  }
  // Favorites, mixed: pinned first, then the most used, then the starting four
  // (pins are kept whichever the layout: each uses the ones it can, so Mail pinned in Classic is back there after Thumb arc)
  const readPins = () => get(PINS, []).filter(known).slice(0, MAX_PINS + RING.length);
  let pins = readPins();
  function favorites() {
    const out = pins.filter(pinnable).slice(0, MAX_PINS).map(id => ({ id, why: 'pin' }));
    for (const id of mostUsed()) if (out.length < 4 && !out.some(f => f.id === id)) out.push({ id, why: 'used' });
    for (const id of [...STARTERS, ...ALL]) if (out.length < 4 && pinnable(id) && !out.some(f => f.id === id)) out.push({ id, why: 'start' });
    return out;
  }

  // ---- Home ----
  let open = get(OPEN, []).filter(known).slice(0, MAX_OPEN);   // in the order they were opened
  let used = open.slice();                                      // the same, the one used longest ago first
  let current = null;                                           // the app showing, or null: aOS
  const frames = {};                                            // id -> its .frame, while it's open
  // Updates under way in the apps (AllisonOS.updating in ../home/welcome.js: Orders, Travel and Money reading Gmail,
  // Ipsy checking what they read, Mail's sorting). While one runs, its app isn't put away to open another, nor started
  // again for settings from another device, a look or data moved in: that waits until it's done (whenFree). An app
  // says so again every minute; one silent for three minutes (a frame that stopped without a word) counts as done.
  const busy = {};                                              // id -> Map(task -> when it last said so)
  const STALE = 3 * 6e4, afterBusy = {}, restartLater = new Set();
  function isBusy(id) {
    const m = busy[id]; if (!m) return false;
    for (const [t, at] of m) if (Date.now() - at > STALE) m.delete(t);
    return m.size > 0;
  }
  function freed(id) {
    if (isBusy(id)) return;
    const fns = afterBusy[id] || []; delete afterBusy[id];
    fns.forEach(fn => { try { fn(); } catch {} });
    if (prefsHeld.delete(id)) syncPrefs();                             // its settings, held back while it was busy
  }
  const whenFree = (id, fn) => { if (isBusy(id)) (afterBusy[id] = afterBusy[id] || []).push(fn); else fn(); };
  window.aosHome.updating = (id, task, on) => {
    if (!known(id)) return;
    const m = busy[id] || (busy[id] = new Map());
    if (on) m.set(String(task), Date.now()); else { m.delete(String(task)); freed(id); }
    if (!m.size) delete busy[id];
  };
  setInterval(() => { for (const id of new Set([...Object.keys(afterBusy), ...prefsHeld])) freed(id); }, 30e3);   // the stale ones
  // An app opened again from scratch (out of sight: it closes first, so it saves what it has); the one on screen
  // when you leave it
  function restart(id) {
    const box = frames[id]; if (!box) return;
    if (id === current) { restartLater.add(id); return; }
    const f = box.firstChild; f.moving = true;
    f.addEventListener('load', () => { f.moving = false; if (frames[id] === box) point(f, `../${id}/`); }, { once: true });
    point(f, 'about:blank');
  }
  const editing = () => body.classList.contains('editing');
  const STAR = on => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  // Mail's unread count, on its icon on Home rather than on aOS's Home Screen icon: Mail inside aOS
  // hands it over (window.aosHome.unread) and keeps it in the "unread" cache, which Mail's sw.js
  // also writes when a push brings a new count
  const unread = {};
  window.aosHome.unread = (id, n) => { const was = unread[id] || 0; unread[id] = n > 0 ? n : 0; if (unread[id] !== was) paintHome(); };
  const readUnread = () => { try { caches.open('unread').then(c => c.match('/unread/mail')).then(r => r ? r.text() : '0').then(n => window.aosHome.unread('mail', +n || 0)).catch(() => {}); } catch {} };
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') readUnread(); });
  // the widgets keep up: on opening aOS, back on the phone, and every minute while Home is showing.
  // The forecast is fetched again when Weather's last one is over 10 minutes old (aOS/home-find.js).
  const onHome = () => !current && tab === 'home' && document.visibilityState === 'visible';
  const freshen = () => { if (window.aosFind && aosFind.refreshWeather) aosFind.refreshWeather().then(got => { if (got) paintHome(); }, () => {}); };
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') foldBrief(); if (onHome()) { paintHome(); freshen(); } syncPrefs(); });
  setInterval(() => { if (onHome() && !editing()) { paintHome(); freshen(); } }, 60e3);
  // Settings that follow you between your devices (aOS/prefs-sync.js): on opening aOS, coming back to it
  // or leaving it, and back on Home from an app (where most of them change). What came from another
  // device: aOS's own look, light or dark and Favorites at once; an app open out of sight starts again
  // with its settings; the app on screen gets them once you leave it.
  // An app in the middle of an update (reading Gmail, say) gets its settings once it's done, as the one on screen does.
  const prefsHeld = new Set();
  const waits = id => { if (id === current) return true; if (isBusy(id)) { prefsHeld.add(id); return true; } return false; };
  const syncPrefs = () => { if (window.aosPrefs && AllisonOS.account) aosPrefs.sync({ apps: D.APPS, account: AllisonOS.account, wait: waits, ready: prefsReady, applied: prefsCame }).catch(() => {}); };
  // an app open out of sight closes first (it may save what it has as it goes), then opens again with them
  const prefsReady = apps => Promise.all(apps.filter(id => frames[id] && id !== current && !isBusy(id)).map(id => new Promise(ok => {
    const f = frames[id].firstChild; f.moving = true;
    f.addEventListener('load', ok, { once: true }); setTimeout(ok, 3000); point(f, 'about:blank');
  })));
  function prefsCame(apps) {
    for (const id of apps) {
      if (id === 'aos') {
        try { const l = localStorage.getItem('aos.look'); if (window.aosLook && /^(vintage|glass|layers|grid)$/.test(l || '') && aosLook.get() !== l) aosLook.set(l); } catch {}
        if (W.theme) W.theme.set(W.theme.read());
        pins = readPins();
        order = readOrder();
        setLayout(readLayout(), false);
      } else if (frames[id]) { const f = frames[id].firstChild; if (f.moving) { f.moving = false; point(f, `../${id}/`); } }
    }
    paintHome(true);   // an app's design changes its icon
  }
  addEventListener('aos:account', e => { if (e.detail) syncPrefs(); });
  // a look picked in Appearance is every app's: an app open out of sight closes first (so it can't save its old design
  // over the new one), every app's design is written (aOS/look.js), then they open again in it
  // (one in the middle of an update opens again in it once it's done)
  const everyLook = look => {
    const later = D.APPS.filter(id => frames[id] && id !== current && isBusy(id));
    const done = () => { aosLook.set(look, { apps: D.APPS }); prefsCame(D.APPS); syncPrefs(); later.forEach(id => whenFree(id, () => restart(id))); };
    if (!D.APPS.some(id => frames[id] && id !== current)) return done();   // none open: at once
    return prefsReady(D.APPS).then(done);
  };
  // Home is drawn again often (back on the phone, every minute, a new unread count, a new forecast).
  // Only what changed is replaced, and never under a finger: iOS drops a tap whose button is swapped
  // out between touching and lifting (the Weather widget, tapped as aOS came back, didn't open).
  let down = false, upAt = 0, later = null;
  addEventListener('pointerdown', () => { down = true; }, true);
  for (const t of ['pointerup', 'pointercancel']) addEventListener(t, () => { down = false; upAt = Date.now(); }, true);
  const tpl = document.createElement('template');
  function setHTML(el, html) {
    if (el._html === html) return;
    tpl.innerHTML = html;
    const now = [...el.children], next = [...tpl.content.children];
    if (now.length === next.length) next.forEach((n, i) => { if (!now[i].isEqualNode(n)) now[i].replaceWith(n); });
    else el.replaceChildren(...next);
    el._html = html;
  }
  // off Home (Today, Search), Home floats at the bottom; on Home, nothing does
  function paintQuick() {
    quick.hidden = tab === 'home';
    if (!quick.firstChild) { quick.innerHTML = `<button type="button" class="qhome" aria-label="${HOME}">${HOME_SVG}</button>`; quick.firstChild.onclick = () => window.aosTabs.show('home'); }
  }
  // an app's icon, with its count on it: Mail's unread, and what the brief counts (aOS/home-find.js badges):
  // deliveries due today and pickups waiting on Orders, reminders due today or late on Notes
  let due = {};
  const count = id => unread[id] || due[id] || 0;
  const COUNTED = { mail: n => n + ' unread', orders: n => n + ' due today or waiting', notes: n => n + (n === 1 ? ' reminder' : ' reminders') + ' due' };
  const ic = id => { const n = count(id);
    return `<span class="ic"><img src="${icon(id)}" alt="" draggable="false">${n ? `<em class="unread" aria-hidden="true">${n > 99 ? '99+' : n}</em>` : ''}</span>`; };
  const label = id => { const n = count(id); return esc(name(id)) + (n ? ', ' + (COUNTED[id] ? COUNTED[id](n) : n + ' new') : ''); };
  // the Weather widget's sky, as it is outside (aosFind.weather().kind, Weather's own words): the sun glowing, stars
  // twinkling, clouds drifting, rain or snow falling, a flash of lightning, the wind. Each drop has its place and pace
  // worked out from its number, so the widget drawn again is the same and isn't replaced (setHTML).
  const SKY = { sunny: 'sun', 'clear-night': 'stars', partlycloudy: 'sun clouds', cloudy: 'clouds', fog: 'clouds fog', rainy: 'clouds rain', pouring: 'clouds rain heavy',
    'lightning-rainy': 'clouds rain flash', lightning: 'clouds flash', snowy: 'clouds snow', 'snowy-rainy': 'clouds rain snow', hail: 'clouds snow', windy: 'wind', 'windy-variant': 'wind clouds' };
  function sky(kind) {
    const has = (SKY[kind] || '').split(' ').filter(Boolean); if (!has.length) return '';
    const bits = (cls, n, f) => Array.from({ length: n }, (_, i) => `<i class="${cls}" style="${f(i)}"></i>`).join('');
    const at = (i, k) => ((i * k) % 97) / 97;   // 0..1, spread out
    return `<span class="wsky ${has.join(' ')}" aria-hidden="true">`
      + (has.includes('stars') ? bits('st', 9, i => `left:${8 + at(i, 37) * 84}%;top:${6 + at(i, 59) * 60}%;--d:${(-at(i, 23) * 3).toFixed(2)}s`) : '')
      + (has.includes('clouds') ? bits('cl', 2, i => `top:${14 + i * 26}%;--d:${-i * 9}s;--t:${26 + i * 8}s`) : '')
      + (has.includes('rain') ? bits('rn', has.includes('heavy') ? 22 : 14, i => `left:${at(i, 41) * 100}%;--d:${(-at(i, 67) * 1.2).toFixed(2)}s;--t:${(0.7 + at(i, 29) * 0.5).toFixed(2)}s`) : '')
      + (has.includes('snow') ? bits('sn', 12, i => `left:${at(i, 43) * 100}%;--d:${(-at(i, 71) * 6).toFixed(2)}s;--t:${(4 + at(i, 31) * 3).toFixed(2)}s`) : '')
      + (has.includes('wind') ? bits('wd', 3, i => `top:${30 + i * 18}%;--d:${-i * 1.1}s`) : '')
      + '</span>';
  }
  function paintHome(now = false) {   // now: a change you just made (a pin, back on Home), drawn at once
    if (!now && (down || Date.now() - upAt < 450)) { clearTimeout(later); later = setTimeout(paintHome, 500); return; }   // a finger on the screen: once it's lifted
    $('hdate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
    paintQuick();
    const F = window.aosFind || {}, wx = F.weather ? F.weather() : null, next = F.next ? F.next() : null;
    try { due = F.badges ? F.badges() : {}; } catch { due = {}; }
    paintBrief(F.brief ? F.brief() : null);
    if (arc()) return paintArc(wx, next);
    if (gridOn()) return paintGrid(wx, next);
    const tiles = favorites().map(f => `<button type="button" class="fav${f.why === 'pin' ? ' pinned' : ''}" data-open="${f.id}" data-fav="${f.id}" aria-label="${label(f.id)}">${ic(f.id)}<i class="pin" aria-hidden="true">${STAR(f.why === 'pin')}</i><b>${esc(name(f.id))}</b></button>`).join('');
    setHTML($('favs'), (known('weather') ? `<button type="button" class="wid wx" data-open="weather" data-kind="${wx ? esc(wx.kind || '') : ''}" style="--c:${appHue('weather')}" aria-label="Weather${wx ? `: ${esc(wx.temp)}, ${esc(wx.text)}` : ''}">
        ${sky(wx && wx.kind)}<span class="wh"><img src="${icon('weather')}" alt="">${wx && wx.place ? esc(wx.place) : 'Weather'}</span>
        <span class="big">${wx ? esc(wx.temp) : '–'}</span><small>${wx ? esc(wx.text) : 'Open for the forecast'}</small>${wx && wx.hilo ? `<small>${esc(wx.hilo)}</small>` : ''}</button>` : '')
      + tiles
      + (known('calendar') ? `<button type="button" class="wid cal" data-open="calendar" style="--c:${appHue('calendar')}" aria-label="Calendar${next ? `: next, ${esc(next.title)}, ${esc(next.when)}` : ''}">
        <img src="${icon('calendar')}" alt=""><span>${next
          ? `<em>Next · ${esc(next.when)}</em><b translate="no">${esc(next.title)}</b><small>${next.then ? 'Then ' + esc(next.then) : next.where ? `<span translate="no">${esc(next.where)}</span>` : 'Nothing after it today'}</small>`
          : `<em>Calendar</em><b>Nothing else today</b><small>Open for the week ahead</small>`}</span></button>` : ''));
    if (arranging()) return;   // an app held and moving: drawn again once it's put down
    $('azBtn').hidden = !order.length;
    setHTML($('spaces'), everyOrder().map(id =>
      `<div class="happ" role="button" tabindex="0" data-open="${id}" data-every="${id}" aria-label="${label(id)}">${ic(id)}${pinnable(id) ? `<button type="button" class="hpin${pins.includes(id) ? ' on' : ''}" data-pin="${id}" aria-label="${pins.includes(id) ? 'Unpin' : 'Pin'} ${esc(name(id))}">${STAR(pins.includes(id))}</button>` : ''}<b>${esc(name(id))}</b></div>`).join(''));
  }
  // ---- the brief (aOS/home-find.js brief): worked out on the phone each time Home is drawn, in every layout; a line
  // opens its app. It's folded to one row (its apps' icons and how many things); a tap on that row opens or folds it.
  // It's folded again whenever you come back to Home: opening aOS, back from an app or from Today, back on the phone.
  // (The next trip's card under it, from brief().trip, is gone: the owner asked for it off Home.) ----
  function foldBrief() {
    if (!briefOpen) return;
    briefOpen = false;
    const c = document.querySelector('#hbrief .brief'); if (!c) return;
    c.classList.remove('open'); c.querySelector('[data-brief]').setAttribute('aria-expanded', 'false');
  }
  try { localStorage.removeItem('aos.brief.open'); } catch {}   // it used to be kept open
  const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  function paintBrief(b) {
    const lines = b ? b.lines.filter(l => known(l.app)) : [];
    const hour = new Date().getHours(), part = hour < 12 ? 'This morning' : hour < 17 ? 'This afternoon' : 'This evening';
    const apps = [...new Set(lines.map(l => l.app))].slice(0, 4), many = lines.length === 1 ? '1 thing' : lines.length + ' things';
    setHTML($('hbrief'), (lines.length ? `<div class="wid brief${briefOpen ? ' open' : ''}" style="--c:${appHue('calendar')}">
        <button type="button" class="bhead" data-brief aria-expanded="${briefOpen}" aria-controls="blines" aria-label="${part}: ${many}"><em>${part}</em><span class="bsum" aria-hidden="true">${apps.map(a => `<img src="${icon(a)}" alt="">`).join('')}<b>${many}</b>${CHEV}</span></button>
        <div class="blines" id="blines"><div class="bin">${lines.map((l, i) =>
        `<button type="button" class="bl" data-open="${l.app}" style="--i:${i}" aria-label="${esc(name(l.app))}: ${esc(l.text)}"><img src="${icon(l.app)}" alt=""><span translate="no">${esc(l.text)}</span></button>`).join('')}</div></div></div>` : ''));
  }
  $('hbrief').addEventListener('click', e => {
    const head = e.target.closest('[data-brief]');
    if (head) { briefOpen = !briefOpen; head.parentNode.classList.toggle('open', briefOpen); head.setAttribute('aria-expanded', briefOpen); } });

  // ---- Layers' grid ----
  // Every app as a pebble in its own colour with its drawing in white (pebble, below). The top row is yours: the apps
  // you keep there (Edit, then tap one: your pins), then the ones you use most (the days you opened each in the last
  // two weeks), then Mail, Calendar, Weather and Home; under it every other app, A to Z by its name.
  // (aos.home.grid, the order you once put them in by hand, isn't read any more.)
  const GLYPH = {
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    weather: '<path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 11.1 3.5 3.5 0 0 0 7 18z"/>',
    house: '<path d="M4 11l8-7 8 7v8.5a1.5 1.5 0 0 1-1.5 1.5H14v-6h-4v6H5.5A1.5 1.5 0 0 1 4 19.5z"/>',
    meals: '<path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M9.5 8.5c0-1.5 1-2 1-3.5M13.5 8.5c0-1.5 1-2 1-3.5"/>',
    notes: '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M9 11h6M9 15h6"/>',
    orders: '<path d="M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5L12 11.5l8.5-4M12 11.5v9"/>',
    news: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M7 9h10M7 12.5h10M7 16h6"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    podcasts: '<rect x="9" y="3.5" width="6" height="10" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3"/>',
    travel: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5v-2A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2M3.5 13h17"/>',
    places: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    fitness: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    drinks: '<path d="M5 4.5h14L12 12zM12 12v7.5M8 19.5h8"/>',
    money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    sparkle: '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/>',
  };
  const glyph = id => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[id] || GLYPH.sparkle}</svg>`;
  // Each app as a pebble: its own colour, lighter at the top left, with its drawing in white at 60% of it (aOS/glyphs.js,
  // made by make-looks.mjs from the app's icon.svg); an app without one keeps its line drawing on the round button.
  const pebble = id => { const g = (window.aosGlyphs || {})[id], P = window.aosPebble; if (!g || !P) return glyph(id);
    return `<svg class="peb" viewBox="0 0 512 512" aria-hidden="true"><defs><linearGradient id="pg-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g.top}"/><stop offset="1" stop-color="${g.end}"/></linearGradient>`
      + `<radialGradient id="pw-${id}" cx=".2" cy=".12" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`
      + `<path d="${P}" fill="url(#pg-${id})"/><path d="${P}" fill="url(#pw-${id})"/><path class="edge" d="${P}"/></svg>`
      + `<svg class="gl" viewBox="${g.vb}" aria-hidden="true">${g.defs ? `<defs>${g.defs}</defs>` : ''}${g.body}</svg>`; };
  const gridPins = () => pins.filter(known).slice(0, 4);
  function usedMost() {   // as mostUsed, but any app: the grid has room for Weather and Calendar too
    const u = get(USED, {}), d = dayNo();
    return Object.entries(u).filter(([id]) => known(id)).map(([id, a]) => [id, a.filter(x => d - x < 14).length, Math.max(...a)])
      .filter(x => x[1]).sort((a, b) => b[1] - a[1] || b[2] - a[2]).map(x => x[0]);
  }
  function gridOrder() {
    const top = [...new Set([...gridPins(), ...usedMost(), 'mail', 'calendar', 'weather', 'house'].filter(known))].slice(0, 4);
    const rest = ALL.filter(id => !top.includes(id)).sort((a, b) => name(a).localeCompare(name(b), 'en', { sensitivity: 'base' }));
    return [...top, ...rest];
  }
  function paintGrid(wx, next) {
    const order = gridOrder(), ed = editing();
    $('gridEdit').textContent = ed ? 'Done' : 'Edit'; $('gridHint').hidden = !ed;
    $('gridHead').textContent = ed ? 'Tap to keep on top' : 'Your apps';
    setHTML($('hgsky'), (known('weather') ? `<button type="button" data-open="weather" aria-label="Weather${wx ? `: ${esc(wx.temp)}, ${esc(wx.text)}` : ''}"><b>${wx ? esc(wx.temp) : '–'}</b><span>${wx ? esc(wx.text) : 'Weather'}</span></button>` : '')
      + (known('calendar') ? `<button type="button" data-open="calendar" aria-label="Calendar${next ? `: next, ${esc(next.title)}, ${esc(next.when)}` : ''}">${next
        ? `<b>${esc(next.when)}</b><span translate="no">${esc(next.title)}</span>` : '<b>Today</b><span>Nothing else on</span>'}</button>` : ''));
    setHTML($('hgrid'), order.map((id, i) => (i === 4 ? '<i class="grule" aria-hidden="true"></i>' : '')
      + `<button type="button" class="gapp${ed && gridPins().includes(id) ? ' sel' : ''}" data-open="${id}" data-gapp="${id}" style="--tint:var(--ink-${id}, var(--sp-every));--pale:var(--pale-${id}, var(--orb-on))" aria-label="${label(id)}${ed ? ': keep on the top row' : ''}"${ed ? ` aria-pressed="${gridPins().includes(id)}"` : ''}>`
      + `<span class="orb${window.aosGlyphs && aosGlyphs[id] ? ' pebble' : ''}">${pebble(id)}</span>${count(id) && !ed ? `<em aria-hidden="true">${count(id) > 99 ? '99+' : count(id)}</em>` : ''}<b>${esc(name(id))}</b></button>`).join(''));
  }
  // In Edit, a tap keeps an app on the top row (one of your pins) or lets it go back to its place, A to Z
  function gridTap(id) {
    if (pins.includes(id)) pins = pins.filter(x => x !== id);
    else if (gridPins().length >= 4) return toast('Four at most: let one go first');
    else pins = [...pins, id];
    put(PINS, pins); syncPrefs(); paintHome(true);
  }
  $('gridEdit').onclick = () => { body.classList.toggle('editing'); paintHome(true); };

  // ---- Thumb arc ----
  // Drawn at an iPhone's 390 x 844 and scaled to the screen (--arck): the ring's centre in the corner, a
  // little above the home indicator; the inner ring the fixed four, the outer one the four favorites,
  // from the bottom up. The rings themselves are behind the apps above them (#harcbg).
  const SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';
  const ARC = { w: 390, h: 400, cx: 346, cy: 350, inner: 160, outer: 258, r1: 210, r2: 310, at: [5, 29, 53, 77] };
  function paintArc(wx, next) {
    const favs = favorites(), rest = everyOrder().filter(id => !RING.includes(id) && !favs.some(f => f.id === id));
    // the time of what's next, for its badge: 4:30 (not 4:30 PM), Now while it's on, none for tomorrow or all day
    const soon = w => /^\d/.test(w || '') ? w.replace(/\s?[AP]M$/i, '') : /^Now\b/.test(w || '') ? 'Now' : '';
    setHTML($('hglance'), (known('weather') ? `<button type="button" data-open="weather" aria-label="Weather${wx ? `: ${esc(wx.temp)}, ${esc(wx.text)}` : ''}"><img src="${icon('weather')}" alt=""><span>${wx ? `<b>${esc(wx.temp)}</b> <i>${esc(wx.text)}</i>` : 'Open for the forecast'}</span></button>` : '')
      + (known('calendar') ? `<button type="button" data-open="calendar" aria-label="Calendar${next ? `: next, ${esc(next.title)}, ${esc(next.when)}` : ''}"><img src="${icon('calendar')}" alt="">${next ? `<span><i>${esc(next.when)}</i> <b translate="no">${esc(next.title)}</b></span>` : '<span>Nothing else today</span>'}</button>` : ''));
    setHTML($('hrest'), rest.map(id => `<div class="happ" role="button" tabindex="0" data-open="${id}" aria-label="${label(id)}">${ic(id)}<button type="button" class="hpin${pins.includes(id) ? ' on' : ''}" data-pin="${id}" aria-label="${pins.includes(id) ? 'Unpin' : 'Pin'} ${esc(name(id))}">${STAR(pins.includes(id))}</button><b>${esc(name(id))}</b></div>`).join(''));
    const flip = x => layout === 'arc-left' ? ARC.w - x : x;
    const at = (r, i) => { const a = ARC.at[i] * Math.PI / 180; return `left:${Math.round(flip(ARC.cx - r * Math.cos(a)))}px;top:${Math.round(ARC.cy - r * Math.sin(a))}px`; };
    const ring = (c, r) => `<i class="ring ${c}" style="left:${flip(ARC.cx) - r}px;top:${ARC.cy - r}px;width:${2 * r}px;height:${2 * r}px"></i>`;
    // what's live on each of the fixed four: the temperature, the time of what's next, Mail's unread count (on its icon)
    const live = { weather: wx && wx.temp, calendar: next && soon(next.when) };
    const inner = RING.filter(known).map((id, i) => `<button type="button" class="fav in" data-open="${id}" aria-label="${label(id)}" style="${at(ARC.inner, i)}">${ic(id)}${live[id] ? `<em class="live" aria-hidden="true">${esc(live[id])}</em>` : ''}</button>`).join('');
    const outer = favs.map((f, i) => `<button type="button" class="fav${f.why === 'pin' ? ' pinned' : ''}" data-open="${f.id}" data-fav="${f.id}" aria-label="${label(f.id)}" style="${at(ARC.outer, i)}">${ic(f.id)}<i class="pin" aria-hidden="true">${STAR(f.why === 'pin')}</i><b>${esc(name(f.id))}</b></button>`).join('');
    setHTML($('harcbg'), ring('r2', ARC.r2) + ring('r1', ARC.r1));
    setHTML($('harc'), outer + inner + `<button type="button" class="orb" data-find aria-label="Find an app, or ask Ipsy" style="left:${flip(ARC.cx)}px;top:${ARC.cy}px">${SEARCH}</button>`);
    fitArc();
  }
  // scaled to the room under every other app (a smaller phone, a bigger text size), never bigger than drawn
  // and never so small its icons are hard to tap; the arc's foot stays put as it scales. Short of room, what's
  // next gives way first: the ring still has the temperature and the time on its icons.
  const REACH = ARC.h - (ARC.cy - ARC.outer * Math.sin(ARC.at[3] * Math.PI / 180) - 36);   // how far up it reaches, at full size
  function fitArc() {
    const rest = $('hrest'), d = document.documentElement; if (!arc() || !rest.getClientRects().length) return;
    const room = () => { const top = rest.getBoundingClientRect().bottom + $('scroller').scrollTop + 10, foot = $('harc').getBoundingClientRect().bottom; return Math.min(1, innerWidth / ARC.w, (foot - top) / REACH); };
    $('hglance').hidden = false;
    let k = room(); if (k < .8) { $('hglance').hidden = true; k = room(); }
    d.style.setProperty('--arck', Math.max(.7, k).toFixed(3));
  }
  function setLayout(v, keep = true) {
    layout = LAYOUTS.includes(v) ? v : 'classic';
    if (keep) try { localStorage.setItem(LAYOUT, layout); } catch {}
    const d = document.documentElement;
    if (homeMode()) d.dataset.home = homeMode(); else delete d.dataset.home;
    if (layout === 'arc-left') d.dataset.hand = 'left'; else delete d.dataset.hand;
    if (editing()) { body.classList.remove('editing'); $('favEdit').textContent = $('arcEdit').textContent = 'Edit'; $('favHint').hidden = $('arcHint').hidden = true; }
    paintHome(true);
    if (keep) syncPrefs();
  }
  addEventListener('aos:look', () => setLayout(layout, false));   // into Layers or out of it: its grid, or Classic's Favorites
  addEventListener('resize', fitArc); addEventListener('load', fitArc);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitArc);
  // the orb: the Ipsy bar, from down where your thumb is
  $('harc').addEventListener('click', e => { if (!e.target.closest('[data-find]')) return; $('scroller').scrollTop = 0; q.focus(); });
  const appHue = id => (window.aosAppHue && aosAppHue(id)) || '129,147,188';
  function togglePin(id) {
    if (pins.includes(id)) pins = pins.filter(x => x !== id);
    else if (pins.filter(pinnable).length >= MAX_PINS) return toast('Four at most: unpin one first');
    else pins = [...pins, id];
    put(PINS, pins); paintHome(true); syncPrefs();
  }
  $('favEdit').onclick = () => { const on = body.classList.toggle('editing'); $('favEdit').textContent = $('arcEdit').textContent = on ? 'Done' : 'Edit'; $('favHint').hidden = $('arcHint').hidden = !on; };
  $('arcEdit').onclick = () => $('favEdit').click();
  $('home').addEventListener('click', e => {
    const p = e.target.closest('[data-pin]'); if (p) { e.stopPropagation(); return togglePin(p.dataset.pin); }
    if (e.target.closest('[data-app]')) return;   // ⓘ: the app's page (aOS/app.js)
    const f = e.target.closest('[data-fav]'); if (f && editing()) return togglePin(f.dataset.fav);
    const g = e.target.closest('[data-gapp]'); if (g && editing()) { e.stopPropagation(); return gridTap(g.dataset.gapp); }   // stopped here: the grid is drawn again, so the tap's button is gone by the time aOS's own handler sees it
  });
  // ---- Every app: hold an app a moment, then drag it to where you want it ----
  // It lifts under your finger and the others make room as it passes; let go and it's put down there. The order is
  // kept (aos.home.order) and follows you to your other devices; A to Z (beside Every app) puts them back.
  // Held still and let go, nothing opens. Moving before it lifts is a scroll, as ever.
  const every = $('spaces'), scroller = $('scroller');
  const HOLD_MS = 380, SLOP = 9;
  every.addEventListener('pointerdown', e => {
    const el = e.target.closest('.happ');
    if (!el || e.target.closest('[data-pin]') || e.button > 0 || hold) return;
    hold = { el, id: el.dataset.every, pid: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, on: false };
    hold.t = setTimeout(lift, HOLD_MS);
  });
  function lift() {
    if (!hold) return;
    const items = [...every.children], top0 = scroller.scrollTop;
    // where each place in the grid is (its middle, in the page as it scrolls), and how far from its middle the finger took it
    hold.slots = items.map(it => { const r = it.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 + top0 }; });
    const r = hold.el.getBoundingClientRect();
    hold.ox = hold.x0 - (r.left + r.width / 2); hold.oy = hold.y0 - (r.top + r.height / 2);
    hold.on = true; hold.at = items.indexOf(hold.el); hold.from = hold.at;
    every.classList.add('arranging'); hold.el.classList.add('lift');
    try { navigator.vibrate && navigator.vibrate(8); } catch {}
    follow();
  }
  // the held app under the finger
  function follow() {
    const s = hold.slots[hold.at], dy = scroller.scrollTop;
    hold.el.style.transform = `translate(${hold.x - hold.ox - s.x}px, ${hold.y - hold.oy - (s.y - dy)}px)`;
  }
  // the place nearest the finger: the held app moves there, the others slide to make room
  function moveTo() {
    const dy = scroller.scrollTop, fx = hold.x - hold.ox, fy = hold.y - hold.oy + dy;
    let to = hold.at, best = Infinity;
    hold.slots.forEach((s, i) => { const d = (s.x - fx) ** 2 + (s.y - fy) ** 2; if (d < best) { best = d; to = i; } });
    if (to !== hold.at) {
      const items = [...every.children], first = new Map(items.map(it => [it, it.getBoundingClientRect()]));
      every.insertBefore(hold.el, items.filter(x => x !== hold.el)[to] || null);
      hold.at = to;
      for (const it of items) {
        if (it === hold.el) continue;
        const a = first.get(it), b = it.getBoundingClientRect();
        if (Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1) continue;
        it.classList.remove('settle'); it.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px)`;
        void it.offsetWidth; it.classList.add('settle'); it.style.transform = '';
      }
    }
    follow();
  }
  // near the top or bottom of the screen, Home scrolls along with you
  function edgeScroll() {
    if (!arranging()) return;
    const h = innerHeight, v = hold.y < 110 ? -Math.ceil((110 - hold.y) / 10) : hold.y > h - 110 ? Math.ceil((hold.y - (h - 110)) / 10) : 0;
    if (v) { const was = scroller.scrollTop; scroller.scrollTop += v; if (scroller.scrollTop !== was) moveTo(); }
    requestAnimationFrame(edgeScroll);
  }
  addEventListener('pointermove', e => {
    if (!hold || e.pointerId !== hold.pid) return;
    hold.x = e.clientX; hold.y = e.clientY;
    if (!hold.on) { if (Math.hypot(hold.x - hold.x0, hold.y - hold.y0) > SLOP) letGo(false); return; }
    if (!hold.scrolling) { hold.scrolling = true; requestAnimationFrame(edgeScroll); }
    moveTo();
  });
  // once it's lifted, the finger moves the app, not the page (iOS asks the touch itself)
  addEventListener('touchmove', e => { if (arranging()) e.preventDefault(); }, { passive: false });
  every.addEventListener('contextmenu', e => { if (hold) e.preventDefault(); });
  addEventListener('pointerup', e => { if (hold && e.pointerId === hold.pid) letGo(true); });
  addEventListener('pointercancel', e => { if (hold && e.pointerId === hold.pid) letGo(true); });
  function letGo(keep) {
    const h = hold; hold = null; clearTimeout(h.t);
    if (!h.on) return;
    quiet = Date.now() + 500;   // the click that follows a hold isn't a tap
    const el = h.el;
    el.classList.remove('lift'); el.classList.add('settle'); el.style.transform = '';
    every.classList.remove('arranging');
    setTimeout(() => { for (const it of every.children) { it.classList.remove('settle'); it.style.transform = ''; } }, 300);
    if (keep && h.at !== h.from) {
      const now = [...every.children].map(it => it.dataset.every);
      order = az(ALL).join() === now.join() ? [] : now;   // back as A to Z: nothing to keep
      put(ORDER, order); syncPrefs();
      every._html = null;
      $('azBtn').hidden = !order.length;
    }
  }
  addEventListener('click', e => { if (Date.now() < quiet) { e.preventDefault(); e.stopPropagation(); } }, true);
  $('azBtn').onclick = () => { order = []; put(ORDER, order); syncPrefs(); paintHome(true); toast('Every app, A to Z'); };

  // ---- pull to refresh: at the top of Home, pull down and let go ----
  // The forecast is fetched again (when the last one is over a minute old), Mail's count read again, your settings
  // from your other devices brought in, and Home drawn again: the brief, the widgets, the counts on the icons.
  // Pulled less than far enough, it just springs back.
  const PULL = 72, pullEl = document.createElement('div');
  pullEl.id = 'hpull'; pullEl.setAttribute('aria-hidden', 'true');
  pullEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.2a8 8 0 0 0-14.6-4.4L4 8.4"/><path d="M4 3.8v4.6h4.6"/><path d="M4 12.8a8 8 0 0 0 14.6 4.4l1.4-1.6"/><path d="M20 20.2v-4.6h-4.6"/></svg>';
  body.append(pullEl);
  let pull = null, refreshing = false;
  const homeEl = $('home');
  const pulled = d => d < PULL ? d * .55 : PULL * .55 + (d - PULL) * .18;   // it gets harder the further it goes
  function drawPull(d) {
    const y = pulled(d);
    homeEl.style.transform = y ? `translateY(${y}px)` : '';
    pullEl.style.opacity = Math.min(1, d / PULL).toFixed(2);
    pullEl.style.transform = `translateY(${(y * .5).toFixed(1)}px) rotate(${Math.round(d * 3)}deg)`;
    pullEl.classList.toggle('ready', d >= PULL);
  }
  function springBack() {
    for (const el of [homeEl, pullEl]) el.classList.add('pullback');
    homeEl.style.transform = ''; pullEl.style.opacity = '0'; pullEl.style.transform = '';
    pullEl.classList.remove('ready', 'spin');
    setTimeout(() => { for (const el of [homeEl, pullEl]) el.classList.remove('pullback'); }, 350);
  }
  async function refreshHome() {
    refreshing = true;
    for (const el of [homeEl, pullEl]) el.classList.add('pullback');
    homeEl.style.transform = `translateY(${Math.round(PULL * .55)}px)`; pullEl.style.transform = `translateY(${Math.round(PULL * .27)}px)`;
    pullEl.classList.add('spin');
    const F = window.aosFind || {};
    const got = await Promise.all([F.refreshWeather ? F.refreshWeather({ force: true }).catch(() => false) : false, new Promise(r => setTimeout(r, 700))]).then(r => r[0]);
    readUnread(); syncPrefs(); paintHome(true);
    if (!got && !navigator.onLine) toast('Offline: this is what\'s on the phone');
    springBack(); refreshing = false;
  }
  scroller.addEventListener('touchstart', e => {
    pull = null;
    if (current || tab !== 'home' || refreshing || e.touches.length !== 1 || scroller.scrollTop > 0 || editing() || $('hq').value) return;
    pull = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, d: 0, on: false };
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (!pull || arranging()) return;
    const t = e.touches[0], dx = t.clientX - pull.x0, dy = t.clientY - pull.y0;
    if (!pull.on) {
      if (dy > 8 && dy > Math.abs(dx) && scroller.scrollTop <= 0) { pull.on = true; pull.y0 = t.clientY; }
      else { if (dy < -4 || Math.abs(dx) > 10) pull = null; return; }
    }
    e.preventDefault();
    pull.d = Math.max(0, t.clientY - pull.y0); drawPull(pull.d);
  }, { passive: false });
  const endPull = () => { const p = pull; pull = null; if (!p || !p.on) return; if (p.d >= PULL) refreshHome(); else springBack(); };
  addEventListener('touchend', endPull); addEventListener('touchcancel', endPull);

  // the icons that aren't buttons themselves (their pin is): Return or Space opens the app
  $('home').addEventListener('keydown', e => { const o = e.target.closest('.happ'); if (o && e.target === o && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(o.dataset.open); } });
  // anywhere in aOS (Home, an app's page): data-open opens that app inside aOS
  document.addEventListener('click', e => {
    const o = e.target.closest('[data-open]');
    if (!o || e.target.closest('[data-pin], [data-app]') || (editing() && o.closest('#favs, #harc, #hgrid'))) return;
    e.preventDefault();
    if (o.closest('#hfound')) { const at = o.dataset.at; clearFind(); show(o.dataset.open, at); } else show(o.dataset.open);
  });

  // ---- the apps, each in a frame of its own ----
  function load(id, at = '') {
    if (!open.includes(id)) {
      if (open.length >= MAX_OPEN) drop(used.find(x => x !== id && x !== current && !working.has(x) && !isBusy(x)));   // put away the one used longest ago (not one in the middle of an update: then one more stays open)
      open.push(id);
    }
    const box = document.createElement('div'), f = document.createElement('iframe');
    box.className = 'frame'; box.dataset.id = id; box.hidden = true;
    f.title = name(id);
    f.allow = 'geolocation; screen-wake-lock; fullscreen; publickey-credentials-get';
    let started = false;
    f.addEventListener('load', () => {
      // back on the blank page it started on (the phone's back swipe, a step inside the frame): the app again
      if (started && !f.moving && blank(f)) return point(f, `../${id}/`);
      pushInsets(); if (current === id) tint();
    });
    box.append(f); frames[id] = box; $('stage').append(box);
    put(OPEN, open);
    // what it kept on the phone comes first (a few seconds at most); later than that, it opens again with it
    const go = () => { if (started || frames[id] !== box) return; started = true; point(f, `../${id}/` + at); };
    const moving = carryIn(id).then(data => { if (data) movedIn(id, started ? f : null, data); }, () => {});
    Promise.race([moving, new Promise(r => setTimeout(r, 4000))]).then(go, go);
    return box;
  }

  // A frame is pointed at a page by replacing what it shows, never by its src: Safari can count a frame's
  // src change as a step in the window's history, and the phone's back swipe then went back inside the
  // app, to the blank page its frame started on.
  const point = (f, url) => { try { f.contentWindow.location.replace(url); } catch { f.src = url; } };
  const blank = f => { try { return f.contentWindow.location.href === 'about:blank'; } catch { return false; } };

  // ---- moving into aOS 2 (../home/welcome.js, "moving into aOS 2") ----
  // An app opened from its own Home Screen icon, signed in, hands what it keeps only on the phone to
  // the family account (handoff). aOS takes it (handoff/take, once: then it's deleted there) before
  // the app opens here, and again whenever you come back to an app that hasn't had it yet, so it
  // doesn't matter which you open first. What came from the icon wins: that's where the app has been
  // used. Anything aOS already had for it that differs is kept aside (aos.carry2.was.<app>). An app
  // that was already open here opens again with it.
  // (aos.carry2: the first aOS 2 kept what it had and dropped what came, so everyone moves again.)
  const ACC = AllisonOS.account, CARRIED = 'aos.carry2.in.', WAS = 'aos.carry2.was.', asked = {};
  const authed = path => { const t = ACC && ACC.token(); return t ? (b = {}) => fetch('api/' + path, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(b) }) : null; };
  async function carryIn(id) {
    const take = authed('handoff/take'); if (!take) return false;
    try { if (localStorage.getItem(CARRIED + id) === 'done') return false; } catch { return false; }
    if (Date.now() - (asked[id] || 0) < 20e3) return false;   // asked just now
    asked[id] = Date.now();
    try {
      const r = await take({ app: id }); if (!r.ok) return false;
      const j = await r.json(); if (!j.data || typeof j.data !== 'object') return false;
      const was = {};
      for (const [k, v] of Object.entries(j.data)) { const old = localStorage.getItem(k); if (typeof v === 'string' && old != null && old !== v) was[k] = old; }
      try { if (Object.keys(was).length) localStorage.setItem(WAS + id, JSON.stringify(was)); } catch {}
      putIn(j.data);
      localStorage.setItem(CARRIED + id, 'done');
      return j.data;
    } catch { return false; }
  }
  const putIn = data => { for (const [k, v] of Object.entries(data)) if (typeof v === 'string') try { localStorage.setItem(k, v); } catch {} };
  // already running here: it may save what it has as it closes, so it closes first, then it's put back
  function movedIn(id, f, data) {
    if (f && isBusy(id)) return whenFree(id, () => movedIn(id, frames[id] && frames[id].firstChild, data));   // in the middle of an update: once it's done
    if (f) {
      f.moving = true;
      f.addEventListener('load', () => { f.moving = false; putIn(data); if (frames[id] && frames[id].firstChild === f) point(f, `../${id}/`); }, { once: true });
      point(f, 'about:blank');
    }
    toast(`${name(id)}'s data moved in`);
  }
  const recheck = id => { if (frames[id]) carryIn(id).then(data => { if (data && frames[id]) movedIn(id, frames[id].firstChild, data); }, () => {}); };
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && current) recheck(current); });
  (async () => {   // still told to the account, for apps that haven't updated yet
    const want = authed('handoff/want'); if (!want) return;
    const WANT = 'aos.carry.want', day = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem(WANT) === day) return; if ((await want()).ok) localStorage.setItem(WANT, day); } catch {}
  })();
  function drop(id) {
    if (!id) return;
    if (frames[id]) { frames[id].remove(); delete frames[id]; }
    delete busy[id]; delete afterBusy[id]; restartLater.delete(id); prefsHeld.delete(id);
    open = open.filter(x => x !== id); used = used.filter(x => x !== id);
    if (current === id) current = null;
    put(OPEN, open);
  }
  const reveal = id => { for (const [k, f] of Object.entries(frames)) f.hidden = k !== id; };
  let hideT = null;
  // at: where in the app to open it (what the Ipsy bar found in it, aOS/home-find.js), as '#…' or '?…'
  // the swipe in from the left edge (below): where it stands, and settle() to end it. A finished swipe
  // (released: pointerup, touchend) past a third of the screen goes back; any other end snaps the window
  // back where it was. Either way nothing of the drag is left behind: no inline transform, no body.dragging.
  const edge = $('appedge'), win = $('appwin');
  let ex = null, px = null, dx = 0;
  function settle(released = false) {
    if (ex == null) return;
    const far = released && dx > innerWidth * 0.3;
    ex = null; px = null;
    body.classList.remove('dragging');
    void body.offsetWidth;   // let it animate from where the finger left it
    win.style.transform = ''; $('appshade').style.opacity = '';
    if (far) show(null);
  }
  function show(id, at = '') {
    settle();
    closeMenu();
    id = known(id) ? id : null;
    at = /^[#?][\w=&%.:-]*$/.test(at || '') ? at : '';
    const prev = current, wasOpen = !!(id && frames[id]);
    if (id && !frames[id]) load(id, at);
    else { if (id && id !== prev) recheck(id); if (id && at) point(frames[id].firstChild, `../${id}/` + at); }
    current = id;
    if (current) foldBrief();   // folded for when you come back
    if (current) { used = used.filter(x => x !== current); used.push(current); if (current !== prev) noteUse(current); }
    clearTimeout(hideT);
    if (!current && prev) hideT = setTimeout(() => { if (!current) reveal(null); }, 400);   // it slides out first
    else reveal(current);
    // back to an app that was open out of sight: it hears so ('aos:shown', ../home/welcome.js), to carry on an update
    // cut off there (a Gmail sign-in that ran out can only be renewed on screen)
    if (wasOpen && current !== prev) { try { const w = frames[current].firstChild.contentWindow; w.dispatchEvent(new w.CustomEvent('aos:shown')); } catch {} }
    if (prev && prev !== current && restartLater.delete(prev)) whenFree(prev, () => restart(prev));   // a look that came while it was on screen
    body.classList.toggle('in-app', !!current);
    $('appwin').setAttribute('aria-hidden', String(!current));
    if (!current) { paintHome(true); if (prev) syncPrefs(); }   // an app's design may have changed its icon; and its settings follow you
    remember();
    tint();
    if (current) watch(current);
  }
  // The app window, looked at once it should be on screen (after its slide in): if it isn't there (off to the
  // side, not in-app, its frame hidden), it's put right at once, and what was found is kept for the owner
  // (aos.glitch, the last five; aosHomeTab.glitches()) and shown for a moment. The owner saw the window
  // missing after the phone's own back swipe, aOS Home dimmed under the shade with nothing over it, and
  // the cause isn't certain yet: this keeps aOS usable and says what it saw.
  let watchT = null;
  function watch(id) {
    clearTimeout(watchT);
    watchT = setTimeout(() => {
      if (current !== id) return;
      const box = frames[id], f = box && box.firstChild, r = win.getBoundingClientRect(), bad = [];
      let where = '?'; try { where = f.contentWindow.location.pathname; } catch {}
      if (!body.classList.contains('in-app')) bad.push('not in-app');
      if (r.left > 2 || r.right < innerWidth - 2) bad.push(`window at ${Math.round(r.left)}..${Math.round(r.right)} of ${innerWidth}`);
      if (!box) bad.push('no frame'); else if (box.hidden) bad.push('frame hidden');
      // in place: the window and its frame are given a fresh layer anyway (will-change on, then off), in case the
      // browser kept an old picture of them after the phone's own back gesture (seen on an iPhone: the window in
      // place by every measure, aOS Home still showing under the shade)
      if (!bad.length) { for (const el of [win, box]) { el.style.willChange = 'transform'; void el.offsetWidth; el.style.willChange = ''; } return; }
      const seen = { at: new Date().toISOString(), app: id, bad, inline: win.style.cssText, shade: $('appshade').style.cssText, cls: body.className, where, drag: ex != null, leaving: !!leaving,
        tint: getComputedStyle(win).backgroundColor, hist: history.length, state: JSON.stringify(history.state), look: document.documentElement.dataset.look || '' };
      try { localStorage.setItem('aos.glitch', JSON.stringify([seen, ...get('aos.glitch', [])].slice(0, 5))); } catch {}
      settle();
      body.classList.remove('dragging'); win.style.transform = ''; win.style.transition = ''; $('appshade').style.opacity = '';
      body.classList.add('in-app'); $('appwin').setAttribute('aria-hidden', 'false');
      if (box) reveal(id);
      toast(`aOS put the app window back (${bad.join('; ')})`, 6000);
    }, 700);
  }

  // The phone's own back (an iPhone's swipe in from the left edge, which iOS takes for itself
  // whenever there's a page behind, as there is after a sign-in at Google) goes to Home: an open app
  // is a step of its own in the window's history, over Home's. "‹ aOS" takes that step back too,
  // unless the app has added steps of its own since (Mail's message page), when it's just replaced.
  let pushedAt = 0, leaving = 0;   // leaving: when remember() last called history.back(), its popstate still to come
  const appStep = () => !!(history.state && history.state.aosApp);
  function remember() {
    const url = location.pathname + location.search + (current ? '#app=' + current : '');
    const { aosApp, ...rest } = history.state || {};
    try {
      if (current && !appStep()) { history.pushState({ ...rest, aosApp: current }, '', url); pushedAt = history.length; }
      else if (!current && appStep() && history.length === pushedAt) { leaving = Date.now(); history.back(); }
      else history.replaceState(current ? { ...rest, aosApp: current } : rest, '', url);
    } catch {}
  }
  addEventListener('popstate', () => {
    // the popstate of remember()'s own history.back(): an app opened meanwhile is pushed again. Only a fresh one:
    // a back with nothing behind brings none, and the next popstate (the phone's own back) must not be taken for it
    const own = leaving && Date.now() - leaving < 1500; leaving = 0;
    if (own) { if (current) remember(); return; }
    const id = appStep() ? history.state.aosApp : null;
    // the phone's own back (an iPhone's edge swipe) has animated the page away already: the window goes without
    // its slide, or the app flashed back over Home at the end of the gesture and slid out a second time
    if (id !== current) { body.classList.add('snap'); show(known(id) ? id : null); requestAnimationFrame(() => requestAnimationFrame(() => body.classList.remove('snap'))); }
  });

  // how much of the window aOS's own controls cover: the status bar and "‹ aOS" on top, the home
  // indicator below. Each app takes it as its safe-area spacing (../home/welcome.js).
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  body.append(probe);
  function insets() {
    const cs = getComputedStyle(probe);
    return { top: (parseFloat(cs.paddingTop) || 0) + 50, bottom: parseFloat(cs.paddingBottom) || 0 };
  }
  window.aosHome.insets = insets;
  function pushInsets() {
    const v = insets();
    for (const box of Object.values(frames)) try { box.firstChild.contentWindow.AllisonOS.inset(v.top, v.bottom); } catch {}
  }
  addEventListener('resize', pushInsets);

  // behind the app while it loads, its own background; the status bar, the colour at the top of what's
  // showing: the app's (its top fades into it), else aOS's own ground. Every theme-color meta gets that one
  // colour, whichever of them iOS goes by: with Appearance set to Light or Dark, the page is not in the
  // phone's own mode, and a meta per mode would put the other mode's colour over it
  const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
  const see = el => { const b = el && getComputedStyle(el).backgroundColor; return b && b !== 'transparent' && !/,\s*0\)$/.test(b) ? b : ''; };
  const hex = c => { const n = (/rgba?\(([^)]*)\)/.exec(c || '') || [])[1]; return n ? '#' + n.split(',').slice(0, 3).map(x => Math.round(+x).toString(16).padStart(2, '0')).join('').toUpperCase() : c; };
  let capWas = '';   // #barcap's colour, as iOS last read it
  function tint() {
    let c = '', bar = '';
    const f = current && frames[current] && frames[current].firstChild;
    if (f) try {
      const d = f.contentDocument, w = f.contentWindow;
      c = (w.AllisonOS && w.AllisonOS.topColor && w.AllisonOS.topColor()) || see(d.body) || see(d.documentElement);   // the app's own say (its top fades into it), else its page
      const m = [...d.querySelectorAll('meta[name="theme-color"]')].find(m => !m.media || w.matchMedia(m.media).matches);
      bar = c || (m && m.content);
    } catch {}
    if (!f && window.aosLook && aosLook.flat()) bar = see(document.body) || see(document.documentElement);   // Sea glass draws under the bar: its metas stay as they are (Layers: the page's colour, its sky's top)
    $('appwin').style.setProperty('--tint', c || 'var(--bg)');
    // the status bar, when it's solid (an iPhone's, aOS's: ../home/sky.js): iOS colours it from the fixed
    // element at the top of the screen, and keeps that colour once nothing's there. #barcap is always
    // there, in the colour of what's showing: the app's own background (its top fades into it, in
    // ../home/welcome.js), else aOS's. iOS reads the bar's colour again only when a fixed element comes or
    // goes (WebKit: didAddOrRemoveViewportConstrainedObjects), so once #barcap's colour changes it is taken
    // off and put back: without that the bar kept the colour it had at launch (another look's, the day sky's)
    // (in Layers aOS's own is its sky's top: the page's colour, aOS/scripts/looks.mjs, as its bar metas are)
    document.documentElement.style.setProperty('--barcap', (f && c) || (window.aosLook && aosLook.get() === 'layers' && see(document.documentElement)) || 'var(--bg)');
    const cap = $('barcap'), now = cap && getComputedStyle(cap).backgroundColor;
    if (cap && now !== capWas) { capWas = now; cap.style.display = 'none'; void cap.offsetHeight; cap.style.display = ''; }
    for (const m of metas) {
      if (!m.dataset.home) m.dataset.home = m.content;
      const want = hex(bar) || m.dataset.home;
      if (m.content !== want) m.content = want;
    }
  }
  setInterval(() => { if (current && document.visibilityState === 'visible') tint(); }, 1500);   // an app switched to light or dark
  addEventListener('aos:look', () => { for (const m of metas) delete m.dataset.home; tint(); });   // aOS's own look changed its colours
  // light or dark changed (Appearance, or the phone's own), or the Vintage sky moved on: once the page has its new colours
  const retint = () => requestAnimationFrame(tint);
  addEventListener('aos:theme', retint); addEventListener('aos:sky', retint);
  { const dk = matchMedia('(prefers-color-scheme: dark)'); dk.addEventListener ? dk.addEventListener('change', retint) : dk.addListener(retint); }
  retint(); addEventListener('load', retint);   // and as aOS opens

  // ---- "‹ aOS": tap to go back, hold for the other open apps; or swipe in from the left edge ----
  let holdT = null, held = false;
  const back = $('appback');
  back.addEventListener('pointerdown', () => { held = false; clearTimeout(holdT); holdT = setTimeout(() => { held = true; openMenu(); }, 450); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => back.addEventListener(t, () => clearTimeout(holdT)));
  back.addEventListener('click', () => { if (held) { held = false; return; } show(null); });
  back.addEventListener('contextmenu', e => e.preventDefault());
  function openMenu() {
    if (navigator.vibrate) navigator.vibrate(10);
    const others = [...used].reverse().filter(id => id !== current);
    $('appmenu').innerHTML = others.map(id => `<button type="button" data-to="${id}"><img src="${icon(id)}" alt="">${esc(name(id))}</button>`).join('')
      + '<button type="button" class="home" data-to=""><span>‹</span>aOS Home</button>';
    $('appmenu').hidden = false;
  }
  function closeMenu() { $('appmenu').hidden = true; }
  $('appmenu').addEventListener('click', e => { const b = e.target.closest('[data-to]'); if (b) show(b.dataset.to || null); });
  document.addEventListener('pointerdown', e => { if (!$('appmenu').hidden && !e.target.closest('#appmenu, #appback')) closeMenu(); });

  // The swipe in from the left edge (#appedge, an 18px strip): the app window follows the finger, and past
  // a third of the screen it goes back. The drag ends on pointerup or pointercancel; but a swipe that starts
  // on the strip is one an iPhone can take for itself (its own back gesture, which goes to Home through
  // popstate), and then the end never comes: the window stayed where the finger left it (translateX
  // inline, off the screen when the swipe had gone all the way) with body.dragging on, so every app opened
  // after that sat off the screen, aOS Home showing under it, until aOS was closed. So the drag is settled
  // by whatever comes next too: show() (an app opening, Home), popstate, a finger down anywhere else, the
  // pointer's capture lost, the page hidden or the window losing focus, and touchend/touchcancel as a
  // fallback for a pointerup that never arrives.
  edge.addEventListener('pointerdown', e => {
    if (!current) return;
    settle();
    ex = e.clientX; px = e.pointerId; dx = 0; closeMenu();
    try { edge.setPointerCapture(e.pointerId); } catch {}
    body.classList.add('dragging');
  });
  edge.addEventListener('pointermove', e => {
    if (ex == null || e.pointerId !== px) return;
    dx = Math.max(0, e.clientX - ex);
    win.style.transform = `translateX(${dx}px)`;
    $('appshade').style.opacity = String(Math.max(0, 1 - dx / innerWidth));
  });
  const endEdge = e => { if (ex != null && (!e || e.pointerId == null || e.pointerId === px)) settle(true); };
  edge.addEventListener('pointerup', endEdge);
  edge.addEventListener('pointercancel', () => settle());
  edge.addEventListener('lostpointercapture', () => settle());
  addEventListener('pointerup', endEdge, true);
  addEventListener('pointercancel', () => settle(), true);
  addEventListener('touchend', () => settle(true), true);
  addEventListener('touchcancel', () => settle(), true);
  document.addEventListener('pointerdown', e => { if (ex != null && e.pointerId !== px) settle(); }, true);
  addEventListener('popstate', () => settle(), true);
  addEventListener('blur', () => settle());
  addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') settle(); });

  // ---- the Ipsy bar: find an app, or what's in one, or ask Ipsy ----
  // An app matches on its name first (the start of it best), then on what it does and its group.
  // What's in the apps comes from aOS/home-find.js, read from this phone. Return opens the top hit;
  // with no app to open, it asks Ipsy.
  const q = $('hq');
  // the groups Home once had, still words that find their apps ("kids", "family")
  const GROUPS = { family: 'calendar meals notes house orders', 'every day': 'weather news mail clock podcasts', 'out and about': 'travel places', you: 'fitness drinks money improve', kids: 'sparkle school' };
  const group = id => (Object.entries(GROUPS).find(([, ids]) => ids.split(' ').includes(id)) || [''])[0];
  const words = id => [name(id), tag(id), group(id)].join(' ').toLowerCase();
  function findApps(t) {
    t = t.trim().toLowerCase(); if (!t) return [];
    const rank = id => { const n = name(id).toLowerCase();
      return n.startsWith(t) ? 0 : n.split(/\s+/).some(w => w.startsWith(t)) ? 1 : n.includes(t) ? 2 : words(id).split(/[^a-z0-9]+/).some(w => w.startsWith(t)) ? 3 : 9; };
    return ALL.map(id => [id, rank(id)]).filter(x => x[1] < 9).sort((a, b) => a[1] - b[1] || ALL.indexOf(a[0]) - ALL.indexOf(b[0])).map(x => x[0]);
  }
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  let found = [];
  function paintFind() {
    const t = q.value.trim();
    $('askIpsy').classList.toggle('typing', !!t);
    $('hqx').hidden = !t; $('hfound').hidden = !t; $('hmain').hidden = !!t;
    if (!t) { found = []; $('hfound').innerHTML = ''; return; }
    found = findApps(t);
    let inside = [];
    try { inside = t.length >= 2 && window.aosFind && aosFind.search ? aosFind.search(t, { known }).slice(0, 8) : []; } catch {}
    const [top, ...rest] = found;
    $('hfound').innerHTML = (top ? `<h3>Top hit</h3><div class="htop" role="button" tabindex="0" data-open="${top}" aria-label="Open ${label(top)}">${ic(top)}<span><b>${esc(name(top))}</b><i>${esc(tag(top))}</i></span><span class="hgo" aria-hidden="true">Open</span><button type="button" class="hinfo" data-app="${top}" aria-label="About ${esc(name(top))}">i</button></div>` : '')
      + (rest.length ? `<h3>Apps</h3><div class="hgroup">${rest.map(id => `<div class="hrow" role="button" tabindex="0" data-open="${id}" aria-label="${label(id)}"><img src="${icon(id)}" alt=""><span><b>${esc(name(id))}</b><i>${esc(tag(id))}</i></span><button type="button" class="hinfo" data-app="${id}" aria-label="About ${esc(name(id))}">i</button></div>`).join('')}</div>` : '')
      + (inside.length ? `<h3>In your apps</h3><div class="hgroup">${inside.map(r => `<div class="hrow hit" role="button" tabindex="0" data-open="${r.app}"${r.at ? ` data-at="${esc(r.at)}"` : ''}><img src="${icon(r.app)}" alt=""><span><b translate="no">${esc(r.title)}</b><i>${esc([name(r.app), r.sub].filter(Boolean).join(' · '))}</i></span></div>`).join('')}</div>` : '')
      + (!top && !inside.length ? `<p class="hnone">Nothing on this phone matches “${esc(t)}”.</p>` : '')
      + (ipsy ? `<button type="button" class="hask" id="hask"><span>Ask Ipsy: “${esc(t)}”</span>${ARROW}</button>` : '');
  }
  function clearFind() { q.value = ''; paintFind(); q.blur(); }
  q.addEventListener('input', paintFind);
  q.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); clearFind(); }
    else if (e.key === 'Enter') { e.preventDefault(); const t = q.value.trim(); if (!t) return; if (found[0]) { const id = found[0]; clearFind(); show(id); } else if (ipsy) askIpsy(t); }
  });
  $('hqx').addEventListener('click', () => { q.value = ''; paintFind(); q.focus(); });
  $('hfound').addEventListener('click', e => { if (e.target.closest('#hask')) askIpsy(q.value.trim()); });
  $('hfound').addEventListener('keydown', e => { const o = e.target.closest('[data-open]'); if (o && e.target === o && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); o.click(); } });
  function askIpsy(t) { if (!ipsy || !t) return; clearFind(); ipsy.prompt(t); }

  // Now and then your helper crosses the bar, in its own way (home/ipsy.js cross: Mia's zoomies, the fox's
  // pounce, the owl's loop, the hedgehog's roll, Nova zipping by as a ball of dots), out to the far end
  // and back. Only on Home with the bar empty and untouched, the chat shut and no
  // finger down; never with Reduce Motion. The first soon after aOS opens, then a minute or two apart. Any
  // tap (the helper itself, the bar) sends it straight home.
  const slot = $('ipsySlot'), rollBar = $('askIpsy');
  let rolling = null, rollT = null;
  const rollIn = ms => { clearTimeout(rollT); rollT = setTimeout(roll, ms); };
  function roll() {
    const I = AllisonOS.ipsy;
    if (rolling || !I || !I.cross || !slot.querySelector('.ipsy-char') || !onHome() || down || editing() || q.value || document.activeElement === q || document.querySelector('.ipsy-wrap:not([hidden])')
      || matchMedia('(prefers-reduced-motion: reduce)').matches) { rollIn(20e3); return false; }
    rollIn(60e3 + Math.random() * 90e3);
    const d = rollBar.clientWidth - slot.offsetWidth - 2 * slot.offsetLeft;
    if (d < 80) return false;
    const anims = I.cross(slot, d);
    if (!anims) return false;
    rollBar.classList.add('rolling');
    rolling = anims;
    rolling[0].finished.catch(() => {}).then(() => { rolling = null; rollBar.classList.remove('rolling'); });
    return true;
  }
  const rollHome = () => { if (rolling) rolling.forEach(a => a.finish()); };
  addEventListener('pointerdown', rollHome, true);
  slot.addEventListener('click', rollHome, true);   // the chat opens from Ipsy at home, not mid-roll
  q.addEventListener('focus', rollHome);
  rollIn(8e3 + Math.random() * 6e3);

  let toastT = null;
  function toast(t, ms = 1800) { const el = $('htoast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), ms); }

  // ---- Ipsy in aOS: one helper across the apps that have Ipsy (functions/aOS/api/ipsy.js) ----
  // Claude names a tool with its app in front ("travel__search_gmail"). aOS opens that app out of
  // sight if it isn't open (../home/ipsy.js keeps the tools an app mounted, AllisonOS.ipsy.mounted;
  // Weather, Home and School have no chat of their own, only tools for this one: AllisonOS.ipsyTools, from their
  // ipsy-tools.js) and runs the tool there, with the app's own data, rules and sign-ins. Not Fitness or
  // Money (see the route).
  const IPSY_APPS = ['calendar', 'notes', 'meals', 'orders', 'travel', 'news', 'weather', 'house', 'school'].filter(known);
  const SEP = '__';
  const working = new Set();   // apps Ipsy is using right now: not put away to open another
  // Claude turned off for an app on this phone (AllisonOS.claude, ../home/account.js): Ipsy here doesn't use it either
  const claudeOn = id => !AllisonOS.claude || AllisonOS.claude.on(id);
  const mountedOf = id => { try { const A = frames[id].firstChild.contentWindow.AllisonOS, m = (A.ipsy && A.ipsy.mounted) || A.ipsyTools; return m && m.app === id ? m : null; } catch { return null; } };
  async function ipsyOf(id) {
    if (!frames[id]) { load(id); used = used.filter(x => x !== id); used.unshift(id); }   // opened out of sight: first in line to be put away
    for (let t = 0; t < 100; t++) {   // up to 20 seconds for the app to start
      const m = mountedOf(id); if (m) return m;
      await new Promise(r => setTimeout(r, 200));
    }
    return null;
  }
  const runIn = key => async (input, ctx) => {
    const i = key.indexOf(SEP), id = key.slice(0, i), tool = key.slice(i + SEP.length);
    if (!IPSY_APPS.includes(id)) return { error: true, content: 'There is no such app for Ipsy in aOS.' };
    if (!claudeOn(id)) return { error: true, content: `The person has turned Claude off for ${name(id)} on this phone (Settings, AI helper in that app, or aOS, Account, AI helper), so Ipsy can't read or change anything in ${name(id)}. Don't try again; you can tell them it can be turned back on there.` };
    working.add(id);
    try {
      const m = await ipsyOf(id);
      if (!m) return { error: true, content: `${name(id)} didn't start inside aOS. Ask the person to open ${name(id)} from aOS Home once, then try again.` };
      const fn = m.tools[tool];
      if (typeof fn !== 'function') return { error: true, content: `${name(id)} has no tool called ${tool}.` };
      return await fn(input, ctx);
    } finally { working.delete(id); }
  };
  // search_apps: one look across the apps' own words on this phone (aOS/home-find.js, as the Ipsy bar's "In your
  // apps"), so a question that names something needn't open each app to find which has it. What is marked
  // Private is left out, as each app's own Ipsy leaves it out, and so is an app Claude is turned off for. Places and Podcasts are searched too (they have no
  // tools of their own yet); Fitness and Money aren't searched at all (home-find.js doesn't read them).
  async function searchApps(input) {
    const q = String((input && input.query) || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80);
    if (q.length < 2) throw new Error('Give a word or two to search for.');
    const found = window.aosFind ? window.aosFind.search(q, { known: id => known(id) && claudeOn(id), per: 8, max: 30, forIpsy: true }) : [];
    return { content: { query: q, found: found.length, results: found.map(r => ({ app: r.app, app_name: name(r.app), title: r.title, details: r.sub, ...(r.at ? { opens: r.at } : {}) })),
      note: 'Titles and a line each, as the apps list them; use the app\'s own tools for the details. Anything marked Private is never searched.' } };
  }
  let ipsy = null;   // the Ipsy bar (above) asks it, once it's mounted
  if (AllisonOS.ipsy && IPSY_APPS.length) {
    ipsy = AllisonOS.ipsy.mount({
      app: 'aos', name: 'aOS', endpoint: 'api/ipsy', headers: { 'X-Aos': '1' }, slot: $('ipsySlot'),
      intro: '', subtitle: '', placeholder: 'Ask Ipsy',
      suggestions: ['This week’s calendar', 'Orders on the way', 'Catch me up on the news'],
      consent: 'Your question, and what Ipsy reads in your apps, go to Claude, by Anthropic. Every change shows with Undo.',
      context: () => current ? `On screen: ${name(current)}, open inside aOS. Open in aOS: ${open.map(name).join(', ')}.` : `On screen: aOS Home.${open.length ? ' Open in aOS: ' + open.map(name).join(', ') + '.' : ''}`,
      tools: new Proxy({}, { get: (t, key) => key === 'search_apps' ? searchApps : typeof key === 'string' && key.includes(SEP) ? runIn(key) : undefined }),
      label: (n, input) => {
        if (n === 'search_apps') return 'Searching your apps';
        const i = n.indexOf(SEP), id = n.slice(0, i), m = mountedOf(id);
        let l = ''; try { l = m && m.label ? m.label(n.slice(i + SEP.length), input || {}) : ''; } catch {}
        return l ? `${name(id)}: ${l}` : `Looking in ${name(id)}`;
      },
    });
  }

  // Ipsy changed an app's setting (../home/ipsy.js): open out of sight, it closes first (so it can't save its old one
  // over it), the setting is written, and it opens again with it; 'aos' reads aOS's own again (Favorites)
  const around = (apps, write) => prefsReady(apps).then(() => { write(); prefsCame(apps); });
  // Ipsy's open_setting: the app, then its Settings, once it has started
  const openSettings = (id, sel) => {
    if (!known(id)) return;
    show(id);
    let n = 0; const tap = () => { try { const b = frames[id].firstChild.contentDocument.querySelector(sel); if (b && frames[id].firstChild.contentWindow.AllisonOS) return b.click(); } catch {} if (n++ < 120) setTimeout(tap, 250); };   // up to 30 seconds for the app to start
    setTimeout(tap, 300);
  };
  window.aosHomeTab = { glitches: () => get('aos.glitch', []), layout: v => v === undefined ? layout : setLayout(v), everyLook, around, openSettings, show, open: () => open.slice(), favorites, findApps, insets, roll, carried: () => { for (const k in asked) delete asked[k]; } };   // for the tests (aOS/scripts/home-test.mjs)

  setLayout(layout, false); readUnread(); freshen(); syncPrefs();
  const start = (/[#&]app=([a-z]+)/.exec(location.hash) || [])[1];
  if (known(start)) {
    // opened straight into an app (back from Google, or a link): Home goes in under it first
    if (!appStep()) try { history.replaceState(history.state, '', location.pathname + location.search); } catch {}
    show(start);
  }
})();
