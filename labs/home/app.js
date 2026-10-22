// labs/home/index.html: the lab's home screen (its own file: the site's CSP header allows no inline scripts).
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const $ = s => document.querySelector(s);
  const body = document.body;
  const D = (window.AllisonOS && AllisonOS.welcome && AllisonOS.welcome.data) || {};
  const NAMES = D.NAMES || {}, TOURS = D.TOURS || {};
  const SPACES = [
    ['Family', ['calendar', 'meals', 'notes', 'house', 'orders']],
    ['Every day', ['weather', 'news', 'mail', 'clock', 'podcasts']],
    ['Out and about', ['travel', 'places']],
    ['You', ['fitness', 'drinks']],
  ];
  const ALL = SPACES.flatMap(s => s[1]);
  const MODES = { back: 'Apps slide in. Tap ‹ aOS or swipe in from the left edge to go back; hold ‹ aOS for your other open apps.',
    cards: 'Tap aOS at the top of an app to see every open app as a card. Tap one to go to it, × to put it away.',
    float: 'Apps get the whole screen, with a round aOS button floating over them. Tap it for Home and your open apps; drag it out of the way.',
    bar: 'The first try: a bar along the bottom with aOS and your open apps. Swipe it to switch; hold an app to put it away.' };
  const MAX_OPEN = 4, MAX_FAVS = 4, FAVS = 'lab.home.favs', OPEN = 'lab.home.open', MODE = 'lab.home.mode';
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const known = id => ALL.includes(id);
  const name = id => NAMES[id] || id;
  const tag = id => (TOURS[id] && TOURS[id].tag) || '';
  // each app's icon in the design picked for it (design.<app>: nothing kept means Vintage)
  const icon = id => { let g = false; try { g = localStorage.getItem('design.' + id) === 'glass'; } catch {} return `../../${id}/icon${g ? '-glass' : ''}-180.png`; };

  let mode = get(MODE, 'back'); if (!MODES[mode]) mode = 'back';
  let favs = get(FAVS, ['calendar', 'meals', 'notes', 'weather']).filter(known).slice(0, MAX_FAVS);
  let open = get(OPEN, []).filter(known).slice(0, MAX_OPEN);   // in the order they were opened
  let used = open.slice();                                      // the same, the one used longest ago first
  let current = null;                                           // null: home
  const frames = {};                                            // id -> its .frame, while it's loaded

  // ---- home ----
  function paintHome() {
    const now = new Date(), h = now.getHours();
    $('#date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    $('#hi').textContent = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    document.querySelectorAll('.modes [data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    $('#modeNote').textContent = MODES[mode];
    $('#recentSec').hidden = mode === 'bar' || !open.length;
    $('#recent').innerHTML = [...used].reverse().map(id => `<button type="button" data-id="${id}"><img src="${icon(id)}" alt="">${name(id)}</button>`).join('')
      + (mode === 'cards' ? '<button type="button" class="all" data-cards>See all</button>' : '');
    const tiles = favs.map(id => `<button type="button" class="fav" data-id="${id}"><img src="${icon(id)}" alt=""><span><b>${name(id)}</b><br><small>${tag(id)}</small></span></button>`);
    while (tiles.length < MAX_FAVS) tiles.push('<div class="fav empty">Tap Edit to add one</div>');
    $('#favs').innerHTML = tiles.join('');
    $('#spaces').innerHTML = SPACES.map(([title, ids]) => `<h2>${title}</h2><div class="group">${ids.map(id =>
      `<button type="button" class="row" data-id="${id}"><img src="${icon(id)}" alt=""><span><b>${name(id)}</b><small>${tag(id)}</small></span><i class="go${favs.includes(id) ? ' pinned' : ''}"></i></button>`).join('')}</div>`).join('');
  }
  const editing = () => body.classList.contains('editing');
  $('#edit').onclick = () => {
    const on = body.classList.toggle('editing');
    $('#edit').textContent = on ? 'Done' : 'Edit';
    $('#favHint').hidden = !on;
  };
  $('#home').addEventListener('click', e => {
    const m = e.target.closest('[data-mode]'); if (m) return setMode(m.dataset.mode);
    if (e.target.closest('[data-cards]')) return enterOverview();
    const b = e.target.closest('[data-id]'); if (!b) return;
    const id = b.dataset.id;
    if (!editing() || b.closest('#recent')) return show(id);
    if (favs.includes(id)) favs = favs.filter(x => x !== id);
    else if (favs.length >= MAX_FAVS) return toast('Four at most: take one off first');
    else favs.push(id);
    put(FAVS, favs); paintHome();
  });
  function setMode(m) {
    mode = m; put(MODE, m);
    for (const x of Object.keys(MODES)) body.classList.toggle('mode-' + x, x === m);
    paintHome(); paintBar(); pushInsets();
  }

  // how much of the window aOS's own controls cover: the status bar and "‹ aOS" (or Cards' aOS)
  // on top, the home indicator (and the bottom bar) below. Every app inside takes it as its
  // safe-area spacing (welcome.js), so its content clears them and its background runs under them.
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  body.append(probe);
  function insets() {
    const cs = getComputedStyle(probe), top = parseFloat(cs.paddingTop) || 0, bottom = parseFloat(cs.paddingBottom) || 0;
    return { top: top + (mode === 'back' || mode === 'cards' ? 44 : 0), bottom: bottom + (mode === 'bar' ? 58 : 0) };
  }
  window.aosHome.insets = insets;
  function pushInsets() {
    const v = insets();
    for (const box of Object.values(frames)) try { box.firstChild.contentWindow.AllisonOS.inset(v.top, v.bottom); } catch {}
  }

  // ---- the apps ----
  function load(id) {
    if (!open.includes(id)) {
      if (open.length >= MAX_OPEN) drop(used.find(x => x !== id && x !== current));   // put away the one used longest ago
      open.push(id);
    }
    const box = document.createElement('div'), f = document.createElement('iframe');
    box.className = 'frame'; box.dataset.id = id;
    f.src = `../../${id}/`;
    f.title = name(id);
    f.allow = 'geolocation; screen-wake-lock; fullscreen; publickey-credentials-get';
    f.addEventListener('load', () => { pushInsets(); if (current === id) tint(); });
    box.addEventListener('click', () => { if (body.classList.contains('overview')) show(id); });
    box.append(f); frames[id] = box; $('#stage').append(box);
  }
  function drop(id) {
    if (!id) return;
    if (frames[id]) { frames[id].remove(); delete frames[id]; }
    open = open.filter(x => x !== id); used = used.filter(x => x !== id);
    if (current === id) current = null;
    put(OPEN, open);
  }
  const reveal = id => { for (const [k, f] of Object.entries(frames)) f.hidden = k !== id; };
  let hideT = null;
  function show(id) {
    closeMenu();
    id = id || null;
    const prev = current, fromCards = body.classList.contains('overview');
    if (id && !frames[id]) load(id);
    current = id;
    if (current) { used = used.filter(x => x !== current); used.push(current); }
    clearTimeout(hideT);
    if (fromCards) {
      body.classList.remove('overview');
      // every card back to the whole screen: the one picked grows, the others go once it has
      for (const [k, f] of Object.entries(frames)) { f.style.zIndex = k === current ? 2 : 1; f.style.transform = ''; f.style.borderRadius = ''; }
      if (!current) reveal(null);
      else hideT = setTimeout(() => reveal(current), 400);
    } else if (mode === 'back' && !current && prev) hideT = setTimeout(() => { if (!current) reveal(null); }, 400);   // it slides out first
    else reveal(current);
    body.classList.toggle('in-app', !!current);
    if (current && mode === 'float') wake();
    if (!current) paintHome();   // an app's look may have changed its icon
    try { history.replaceState(null, '', location.pathname + location.search + (current ? '#' + current : '')); } catch {}
    put(OPEN, open); tint(); paintBar();
  }
  // the bar on top, the strip by the home indicator and the status bar take the app's own colour
  // behind the app while it loads, its own background; the status bar, its own bar colour
  // (its theme-color), as on the Home Screen, and aOS's again on Home
  const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
  function tint() {
    let c = '', bar = '';
    const f = current && frames[current] && frames[current].firstChild;
    if (f) try {
      const d = f.contentDocument, w = f.contentWindow, see = el => { const b = el && getComputedStyle(el).backgroundColor; return b && b !== 'transparent' && !/,\s*0\)$/.test(b) ? b : ''; };
      c = see(d.body) || see(d.documentElement);
      const m = [...d.querySelectorAll('meta[name="theme-color"]')].find(m => !m.media || w.matchMedia(m.media).matches);
      bar = (m && m.content) || c;
    } catch {}
    $('#app').style.setProperty('--tint', c || 'var(--bg)');
    for (const m of metas) {
      if (!m.dataset.home) m.dataset.home = m.content;
      const want = bar || m.dataset.home;
      if (m.content !== want) m.content = want;
    }
  }
  setInterval(() => { if (current && document.visibilityState === 'visible') tint(); }, 1500);   // an app switched to light or dark

  // ---- back: "‹ aOS", hold it for the other open apps, or swipe in from the left edge ----
  let holdT = null, held = false;
  const back = $('#back');
  back.addEventListener('pointerdown', () => { held = false; clearTimeout(holdT); holdT = setTimeout(() => { held = true; openMenu(); }, 450); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => back.addEventListener(t, () => clearTimeout(holdT)));
  back.addEventListener('click', () => { if (held) { held = false; return; } show(null); });
  back.addEventListener('contextmenu', e => e.preventDefault());
  // under "‹ aOS", or beside the floating button (at): above or below it, on its side
  function openMenu(at) {
    if (navigator.vibrate) navigator.vibrate(10);
    const m = $('#menu'), others = [...used].reverse().filter(id => id !== current);
    m.innerHTML = others.map(id => `<button type="button" data-id="${id}"><img src="${icon(id)}" alt="">${name(id)}</button>`).join('')
      + '<button type="button" class="home" data-home><span>‹</span>aOS home</button>';
    m.style.left = m.style.top = '';
    m.hidden = false;
    if (at) {
      const r = at.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
      m.style.left = (r.left < innerWidth / 2 ? r.left : r.right - w) + 'px';
      m.style.top = Math.max(10, r.bottom + 8 + h < innerHeight - 10 ? r.bottom + 8 : r.top - 8 - h) + 'px';
    }
  }
  function closeMenu() { $('#menu').hidden = true; }
  $('#menu').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; show(b.dataset.id || null); });
  document.addEventListener('pointerdown', e => { if (!$('#menu').hidden && !e.target.closest('#menu, #back, #fab')) closeMenu(); });

  // ---- floating: the round aOS button; drag it, and it settles on the nearest side ----
  const fab = $('#fab'), FAB = 'lab.home.fab';
  let fp = get(FAB, { right: true, y: 0.62 }), fx0 = null, fy0 = null, flx = 0, fly = 0, fmoved = false, idleT = null;
  function place() {
    const s = 56, top = 54, bottom = innerHeight - s - 40;   // clear of the status bar and the home indicator
    fab.style.left = (fp.right ? innerWidth - s - 10 : 10) + 'px';
    fab.style.top = Math.min(bottom, Math.max(top, fp.y * innerHeight)) + 'px';
  }
  function wake() { fab.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => fab.classList.add('idle'), 3000); }
  fab.addEventListener('pointerdown', e => { fx0 = flx = e.clientX; fy0 = fly = e.clientY; fmoved = false; wake(); try { fab.setPointerCapture(e.pointerId); } catch {} });
  fab.addEventListener('pointermove', e => {
    if (fx0 == null) return;
    flx = e.clientX; fly = e.clientY;
    if (!fmoved && Math.hypot(flx - fx0, fly - fy0) < 8) return;
    if (!fmoved) { fmoved = true; closeMenu(); fab.classList.add('moving'); }
    fab.style.left = (flx - 28) + 'px'; fab.style.top = (fly - 28) + 'px';
  });
  const fabUp = () => {
    if (fx0 == null) return;
    fx0 = null;
    if (!fmoved) return;
    fab.classList.remove('moving');
    fp = { right: flx > innerWidth / 2, y: (fly - 28) / innerHeight }; put(FAB, fp); place(); wake();
  };
  fab.addEventListener('pointerup', fabUp);
  fab.addEventListener('pointercancel', fabUp);
  fab.addEventListener('click', () => { if (fmoved) { fmoved = false; return; } if ($('#menu').hidden) openMenu(fab); else closeMenu(); wake(); });
  fab.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('resize', place);
  place();

  const edge = $('#edge');
  let ex = null, dx = 0;
  edge.addEventListener('pointerdown', e => {
    if (mode !== 'back' || !current) return;
    ex = e.clientX; dx = 0; closeMenu();
    try { edge.setPointerCapture(e.pointerId); } catch {}
    body.classList.add('dragging');
  });
  edge.addEventListener('pointermove', e => {
    if (ex == null) return;
    dx = Math.max(0, e.clientX - ex);
    $('#app').style.transform = `translateX(${dx}px)`;
    $('#home').style.transform = `translateX(${-0.28 * innerWidth + dx * 0.28}px)`;
  });
  const endEdge = () => {
    if (ex == null) return;
    ex = null;
    body.classList.remove('dragging');
    void body.offsetWidth;   // let it animate from where the finger left it
    $('#app').style.transform = ''; $('#home').style.transform = '';
    if (dx > innerWidth * 0.3) show(null);
  };
  edge.addEventListener('pointerup', endEdge);
  edge.addEventListener('pointercancel', endEdge);

  // ---- cards: every open app, live, shrunk to a card ----
  $('#cardsBtn').onclick = () => enterOverview();
  function enterOverview() {
    closeMenu(); clearTimeout(hideT);
    body.classList.add('overview');
    paintOverview();
  }
  function paintOverview() {
    const st = $('#stage').getBoundingClientRect(), n = open.length, rows = Math.max(1, Math.ceil(n / 2));
    const pad = 16, gap = 14, labelH = 30;
    let bw = (innerWidth - pad * 2 - gap) / 2, s = bw / st.width, bh = st.height * s;
    const avail = $('#ovFoot').getBoundingClientRect().top - $('#ovHead').getBoundingClientRect().bottom - 32;
    const need = rows * (labelH + bh) + (rows - 1) * gap;
    if (need > avail) { const k = (avail - rows * labelH - (rows - 1) * gap) / (rows * bh); bw *= k; bh *= k; s *= k; }
    $('#ovCount').textContent = n ? `${n} of ${MAX_OPEN}` : '';
    $('#ovGrid').style.gridTemplateColumns = `repeat(2, ${bw}px)`;
    $('#ovGrid').innerHTML = n ? [...used].reverse().map(id => `<div class="slot"><div class="lab"><img src="${icon(id)}" alt=""><b>${name(id)}</b>`
      + `<button type="button" class="x" data-x="${id}" aria-label="Put ${name(id)} away">×</button></div>`
      + `<button type="button" class="box" data-id="${id}" style="height:${bh}px" aria-label="${name(id)}">${frames[id] ? '' : `<img src="${icon(id)}" alt="">`}</button></div>`).join('')
      : '<p class="empty">No apps open. Open one from aOS home.</p>';
    for (const [id, f] of Object.entries(frames)) {
      const r = $(`#ovGrid .box[data-id="${id}"]`).getBoundingClientRect();
      f.hidden = false; f.style.zIndex = '';
      f.style.transform = `translate(${r.left - st.left}px, ${r.top - st.top}px) scale(${s})`;
      f.style.borderRadius = `${14 / s}px`;
    }
    $('#ovDone').textContent = current ? `Back to ${name(current)}` : 'Done';
  }
  $('#ovGrid').addEventListener('click', e => {
    const x = e.target.closest('[data-x]');
    if (x) { drop(x.dataset.x); paintOverview(); paintBar(); return; }
    const b = e.target.closest('[data-id]'); if (b) show(b.dataset.id);
  });
  $('#ovHome').onclick = () => show(null);
  $('#ovDone').onclick = () => show(current);
  addEventListener('resize', () => { if (body.classList.contains('overview')) paintOverview(); });

  // ---- bar: the first try ----
  function paintBar() {
    $('#apps').innerHTML = open.map(id => `<button type="button" data-id="${id}" class="${id === current ? 'on' : ''}" aria-label="${name(id)}"><img src="${icon(id)}" alt=""></button>`).join('');
    $('#toHome').classList.toggle('on', !current);
    $('#count').textContent = open.length;
  }
  function putAway(id) {
    const b = $(`#apps [data-id="${id}"]`);
    const done = () => { const was = current === id; drop(id); if (was) show(null); else paintBar(); toast(`${name(id)} put away`); };
    if (b) { b.classList.add('going'); setTimeout(done, 200); } else done();
  }
  $('#toHome').onclick = () => show(null);
  let barHold = null, barHeld = false, x0 = null, swiped = false;
  const bar = $('#bar');
  bar.addEventListener('pointerdown', e => {
    x0 = e.clientX; swiped = false; barHeld = false;
    const b = e.target.closest('#apps [data-id]');
    clearTimeout(barHold);
    if (b) barHold = setTimeout(() => { barHeld = true; if (navigator.vibrate) navigator.vibrate(10); putAway(b.dataset.id); }, 550);
  });
  bar.addEventListener('pointermove', e => { if (x0 != null && Math.abs(e.clientX - x0) > 12) clearTimeout(barHold); });
  bar.addEventListener('pointerup', e => {
    clearTimeout(barHold);
    if (x0 == null) return;
    const d = e.clientX - x0; x0 = null;
    if (barHeld || Math.abs(d) < 50) return;
    swiped = true;   // a swipe: the next one along (home, then each open app in turn)
    const list = [null, ...open], i = list.indexOf(current);
    const next = list[Math.max(0, Math.min(list.length - 1, i + (d < 0 ? 1 : -1)))];
    if (next !== current) show(next);
  });
  bar.addEventListener('pointercancel', () => { clearTimeout(barHold); x0 = null; });
  $('#apps').addEventListener('click', e => {
    const b = e.target.closest('[data-id]');
    if (!b || barHeld || swiped) { barHeld = swiped = false; return; }
    show(b.dataset.id);
  });
  bar.addEventListener('contextmenu', e => e.preventDefault());

  let toastT = null;
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1800); }

  const start = location.hash.slice(1);
  setMode(mode);
  show(known(start) ? start : null);
});
