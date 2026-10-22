// aOS 2's Home: the home of every app. Not a launcher: each app opens inside aOS, over Home, and
// stays where you left it while you go back and forth (aOS1 sent you off to each app's own Home
// Screen icon; those still work, and Get on an app's page still adds one).
//
//   - Ipsy at the top, across the apps that have it (below, "Ipsy in aOS").
//   - Open now: the apps open inside aOS, the latest first (up to MAX_OPEN; the one used longest
//     ago is put away to open another).
//   - Favorites, mixed: the ones you pin (Edit, up to four), then the apps you open most (the last
//     14 days, kept on this phone: aos.home.used), then a starting four.
//   - Every app, in a few groups. A row opens the app; its ⓘ opens its page (Get, What's New).
//
// An app inside aOS: it slides in from the right and fills the screen, its own background running
// up under the status bar, with "‹ aOS" floating over its top left corner. Tap that, or swipe in
// from the left edge, to slide back to Home; hold it for the other open apps. aOS tells each app
// how much its own controls cover (window.aosHome.insets(), read by ../home/welcome.js in the app),
// so the app's content starts clear of them. Every app is on this same site, so inside aOS they all
// share one phone storage: one Face ID sign-in, one Light or dark.
//
// Tried first as a test page (labs/home/, "Swipe"), where the other ways of getting around were
// tried too.
'use strict';
(() => {
  window.aosHome = window.aosHome || {};   // before any app opens: welcome.js in it looks for this
  const W = AllisonOS.welcome, D = W.data, $ = id => document.getElementById(id), body = document.body;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // In preview until aOS 2 is released: on for this phone with aOS/#preview=aos2 (#preview=off: off
  // again). Off, aOS is as it was, the Apps tab and all.
  const PREVIEW = 'aos.preview';
  { const m = /[#&]preview=(aos2|off)/.exec(location.hash); if (m) { put(PREVIEW, m[1] === 'aos2'); try { history.replaceState(null, '', location.pathname); } catch {} } }
  if (!get(PREVIEW, false)) return;
  // Home takes the Apps tab's place, first in the dock, and opens first
  const appsTab = document.querySelector('[data-tab="apps"]');
  appsTab.dataset.tab = 'home';
  appsTab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 11l8-7 8 7v8.5a1.5 1.5 0 0 1-1.5 1.5H14v-6h-4v6H5.5A1.5 1.5 0 0 1 4 19.5z"/></svg>Home';
  appsTab.parentNode.insertBefore(appsTab, appsTab.parentNode.querySelector('[data-tab]'));
  window.aosTabs.show('home');

  const SPACES = [
    ['Family', ['calendar', 'meals', 'notes', 'house', 'orders']],
    ['Every day', ['weather', 'news', 'mail', 'clock', 'podcasts']],
    ['Out and about', ['travel', 'places']],
    ['You', ['fitness', 'drinks']],
  ].map(([t, ids]) => [t, ids.filter(id => D.APPS.includes(id))]);
  const ALL = SPACES.flatMap(s => s[1]);
  const known = id => ALL.includes(id);
  const name = id => D.NAMES[id] || id;
  const tag = id => (D.TOURS[id] && D.TOURS[id].tag) || '';
  // each app's icon in its own design (design.<app>, ../home/design.js: nothing kept means Vintage),
  // the design it opens in here
  const icon = id => { let g = false; try { g = localStorage.getItem('design.' + id) === 'glass'; } catch {} return `../${id}/icon${g ? '-glass' : ''}-180.png`; };

  const MAX_OPEN = 4, MAX_PINS = 4, OPEN = 'aos.home.open', PINS = 'aos.home.picks', USED = 'aos.home.used';
  const STARTERS = ['calendar', 'meals', 'notes', 'weather'];

  // ---- how much each app is used: the days it was opened, on this phone ----
  const dayNo = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);
  function noteUse(id) {
    const u = get(USED, {}), d = dayNo();
    u[id] = [...(u[id] || []).filter(x => d - x < 14), d].slice(-60);
    put(USED, u);
  }
  function mostUsed() {
    const u = get(USED, {}), d = dayNo();
    return Object.entries(u).filter(([id]) => known(id))
      .map(([id, a]) => [id, a.filter(x => d - x < 14).length, Math.max(...a)])
      .filter(x => x[1]).sort((a, b) => b[1] - a[1] || b[2] - a[2]).map(x => x[0]);
  }
  // Favorites, mixed: pinned first, then the most used, then the starting four
  let pins = get(PINS, []).filter(known).slice(0, MAX_PINS);
  function favorites() {
    const out = pins.map(id => ({ id, why: 'pin' }));
    for (const id of mostUsed()) if (out.length < 4 && !out.some(f => f.id === id)) out.push({ id, why: 'used' });
    for (const id of STARTERS) if (out.length < 4 && known(id) && !out.some(f => f.id === id)) out.push({ id, why: 'start' });
    return out;
  }

  // ---- Home ----
  let open = get(OPEN, []).filter(known).slice(0, MAX_OPEN);   // in the order they were opened
  let used = open.slice();                                      // the same, the one used longest ago first
  let current = null;                                           // the app showing, or null: aOS
  const frames = {};                                            // id -> its .frame, while it's open
  const editing = () => body.classList.contains('editing');
  const STAR = on => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  function paintHome() {
    $('hdate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
    const recent = [...used].reverse();
    $('opennow').hidden = !recent.length;
    $('opennowList').innerHTML = recent.map(id => `<button type="button" class="onow" data-open="${id}"><img src="${icon(id)}" alt=""><span>${esc(name(id))}</span></button>`).join('');
    const WHY = { pin: 'Pinned', used: 'You use it a lot', start: tag };
    $('favs').innerHTML = favorites().map(f => `<button type="button" class="fav${f.why === 'pin' ? ' pinned' : ''}" data-open="${f.id}" data-fav="${f.id}" style="--c:${appHue(f.id)}">
        <img src="${icon(f.id)}" alt=""><b>${esc(name(f.id))}</b><small>${esc(typeof WHY[f.why] === 'function' ? WHY[f.why](f.id) : WHY[f.why])}</small><i class="pin">${STAR(f.why === 'pin')}</i></button>`).join('');
    $('spaces').innerHTML = SPACES.map(([title, ids]) => `<div class="sec"><h2>${esc(title)}</h2></div><div class="hgroup">${ids.map(id =>
      `<div class="hrow" role="button" tabindex="0" data-open="${id}"><img src="${icon(id)}" alt=""><span><b>${esc(name(id))}</b><i>${esc(tag(id))}</i></span>
        <button type="button" class="hpin${pins.includes(id) ? ' on' : ''}" data-pin="${id}" aria-label="${pins.includes(id) ? 'Unpin' : 'Pin'} ${esc(name(id))}">${STAR(pins.includes(id))}</button>
        <button type="button" class="hinfo" data-app="${id}" aria-label="About ${esc(name(id))}">i</button></div>`).join('')}</div>`).join('');
  }
  const appHue = id => (window.aosAppHue && aosAppHue(id)) || '129,147,188';
  function togglePin(id) {
    if (pins.includes(id)) pins = pins.filter(x => x !== id);
    else if (pins.length >= MAX_PINS) return toast('Four at most: unpin one first');
    else pins = [...pins, id];
    put(PINS, pins); paintHome();
  }
  $('favEdit').onclick = () => { const on = body.classList.toggle('editing'); $('favEdit').textContent = on ? 'Done' : 'Edit'; $('favHint').hidden = !on; };
  $('home').addEventListener('click', e => {
    const p = e.target.closest('[data-pin]'); if (p) { e.stopPropagation(); return togglePin(p.dataset.pin); }
    if (e.target.closest('[data-app]')) return;   // ⓘ: the app's page (aOS/app.js)
    const f = e.target.closest('[data-fav]'); if (f && editing()) return togglePin(f.dataset.fav);
    if (e.target.closest('#askIpsy') && !e.target.closest('.ipsy-btn')) { const b = $('ipsySlot').querySelector('.ipsy-btn'); if (b) b.click(); }
  });
  // anywhere in aOS (Home, an app's page): data-open opens that app inside aOS
  document.addEventListener('click', e => {
    const o = e.target.closest('[data-open]');
    if (!o || e.target.closest('[data-pin], [data-app]') || (editing() && o.closest('#favs'))) return;
    e.preventDefault(); show(o.dataset.open);
  });

  // ---- the apps, each in a frame of its own ----
  function load(id) {
    if (!open.includes(id)) {
      if (open.length >= MAX_OPEN) drop(used.find(x => x !== id && x !== current && !working.has(x)));   // put away the one used longest ago
      open.push(id);
    }
    const box = document.createElement('div'), f = document.createElement('iframe');
    box.className = 'frame'; box.dataset.id = id; box.hidden = true;
    f.src = `../${id}/`;
    f.title = name(id);
    f.allow = 'geolocation; screen-wake-lock; fullscreen; publickey-credentials-get';
    f.addEventListener('load', () => { pushInsets(); if (current === id) tint(); });
    box.append(f); frames[id] = box; $('stage').append(box);
    put(OPEN, open);
    // the first time it opens here, what it kept on the phone comes first (a few seconds at most)
    const go = () => { if (frames[id] === box && !f.getAttribute('src')) f.src = `../${id}/`; };
    Promise.race([carryIn(id), new Promise(r => setTimeout(r, 4000))]).then(go, go);
    return box;
  }

  // ---- moving into aOS 2 (../home/welcome.js, "moving into aOS 2") ----
  // Signed in, aOS tells the family account you use aOS 2 (handoff/want, once a day here; the account
  // writes it once a week), so your apps opened from their own icons hand over what they keep only on
  // the phone. Before an app first opens here, aOS takes that (handoff/take, once) and puts it in
  // place: all of it, if the app never opened here before; else only what isn't here yet (you may
  // have set it up here since). Nothing waiting: aOS asks again the next day it opens.
  const ACC = AllisonOS.account, CARRIED = 'aos.carry.in.', WANT = 'aos.carry.want';
  const dayKey = () => new Date().toISOString().slice(0, 10);
  const authed = path => { const t = ACC && ACC.token(); return t ? (b = {}) => fetch('api/' + path, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(b) }) : null; };
  async function carryIn(id) {
    const take = authed('handoff/take'); if (!take) return;
    let st = ''; try { st = localStorage.getItem(CARRIED + id) || ''; } catch {}
    if (st === 'done' || st === dayKey()) return;
    const fresh = !st && !(get(USED, {})[id] || []).length;   // never opened here: what came wins
    try {
      const r = await take({ app: id }); if (!r.ok) return;
      const j = await r.json();
      if (!j.data) { localStorage.setItem(CARRIED + id, dayKey()); return; }
      for (const [k, v] of Object.entries(j.data)) if (typeof v === 'string' && (fresh || localStorage.getItem(k) == null)) localStorage.setItem(k, v);
      localStorage.setItem(CARRIED + id, 'done');
    } catch {}
  }
  (async () => {
    const want = authed('handoff/want'); if (!want) return;
    try { if (localStorage.getItem(WANT) === dayKey()) return; if ((await want()).ok) localStorage.setItem(WANT, dayKey()); } catch {}
  })();
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
    id = known(id) ? id : null;
    const prev = current;
    if (id && !frames[id]) load(id);
    current = id;
    if (current) { used = used.filter(x => x !== current); used.push(current); if (current !== prev) noteUse(current); }
    clearTimeout(hideT);
    if (!current && prev) hideT = setTimeout(() => { if (!current) reveal(null); }, 400);   // it slides out first
    else reveal(current);
    body.classList.toggle('in-app', !!current);
    $('appwin').setAttribute('aria-hidden', String(!current));
    if (!current) paintHome();   // an app's design may have changed its icon
    try { history.replaceState(history.state, '', location.pathname + location.search + (current ? '#app=' + current : '')); } catch {}
    tint();
  }

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

  // behind the app while it loads, its own background; the status bar, its own bar colour (its
  // theme-color), as on the Home Screen; aOS's again on Home
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
    $('appwin').style.setProperty('--tint', c || 'var(--bg)');
    for (const m of metas) {
      if (!m.dataset.home) m.dataset.home = m.content;
      const want = bar || m.dataset.home;
      if (m.content !== want) m.content = want;
    }
  }
  setInterval(() => { if (current && document.visibilityState === 'visible') tint(); }, 1500);   // an app switched to light or dark
  addEventListener('aos:look', () => { for (const m of metas) delete m.dataset.home; tint(); });   // aOS's own look changed its colours

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

  const edge = $('appedge'), win = $('appwin');
  let ex = null, dx = 0;
  edge.addEventListener('pointerdown', e => {
    if (!current) return;
    ex = e.clientX; dx = 0; closeMenu();
    try { edge.setPointerCapture(e.pointerId); } catch {}
    body.classList.add('dragging');
  });
  edge.addEventListener('pointermove', e => {
    if (ex == null) return;
    dx = Math.max(0, e.clientX - ex);
    win.style.transform = `translateX(${dx}px)`;
    $('appshade').style.opacity = String(Math.max(0, 1 - dx / innerWidth));
  });
  const endEdge = () => {
    if (ex == null) return;
    ex = null;
    body.classList.remove('dragging');
    void body.offsetWidth;   // let it animate from where the finger left it
    win.style.transform = ''; $('appshade').style.opacity = '';
    if (dx > innerWidth * 0.3) show(null);
  };
  edge.addEventListener('pointerup', endEdge);
  edge.addEventListener('pointercancel', endEdge);

  let toastT = null;
  function toast(t) { const el = $('htoast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1800); }

  // ---- Ipsy in aOS: one helper across the apps that have Ipsy (functions/aOS/api/ipsy.js) ----
  // Claude names a tool with its app in front ("travel__search_gmail"). aOS opens that app out of
  // sight if it isn't open (../home/ipsy.js keeps the tools an app mounted, AllisonOS.ipsy.mounted)
  // and runs the tool there, with the app's own data, rules and sign-ins. Not Fitness (see the route).
  const IPSY_APPS = ['calendar', 'notes', 'meals', 'orders', 'travel', 'news'].filter(known);
  const SEP = '__';
  const working = new Set();   // apps Ipsy is using right now: not put away to open another
  const mountedOf = id => { try { const m = frames[id].firstChild.contentWindow.AllisonOS.ipsy.mounted; return m && m.app === id ? m : null; } catch { return null; } };
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
    working.add(id);
    try {
      const m = await ipsyOf(id);
      if (!m) return { error: true, content: `${name(id)} didn't start inside aOS. Ask the person to open ${name(id)} from aOS Home once, then try again.` };
      const fn = m.tools[tool];
      if (typeof fn !== 'function') return { error: true, content: `${name(id)} has no tool called ${tool}.` };
      return await fn(input, ctx);
    } finally { working.delete(id); }
  };
  if (AllisonOS.ipsy && IPSY_APPS.length) {
    const list = IPSY_APPS.map(name).join(', ').replace(/, ([^,]*)$/, ' and $1');
    $('ipsySub').textContent = `Across ${list}`;
    AllisonOS.ipsy.mount({
      app: 'aos', name: 'aOS', endpoint: 'api/ipsy', headers: { 'X-Aos': '1' }, slot: $('ipsySlot'),
      intro: `Hi, I’m Ipsy! In aOS I can work across ${list} at once.`,
      placeholder: 'Ask Ipsy about anything in your apps',
      suggestions: ['What’s on the calendar this week?', 'Do any orders arrive while we’re away?', 'Add this week’s dinners to the grocery list', 'Catch me up on the news'],
      consent: `Your question, and what Ipsy reads in ${list} (and Gmail, where it’s connected in those apps), go to Claude, by Anthropic, through the family server. Private items stay hidden, every change shows with Undo, and it asks before deleting. Fitness stays out of aOS: ask Ipsy inside Fitness.`,
      context: () => current ? `On screen: ${name(current)}, open inside aOS. Open in aOS: ${open.map(name).join(', ')}.` : `On screen: aOS Home.${open.length ? ' Open in aOS: ' + open.map(name).join(', ') + '.' : ''}`,
      tools: new Proxy({}, { get: (t, key) => typeof key === 'string' && key.includes(SEP) ? runIn(key) : undefined }),
      label: (n, input) => {
        const i = n.indexOf(SEP), id = n.slice(0, i), m = mountedOf(id);
        let l = ''; try { l = m && m.label ? m.label(n.slice(i + SEP.length), input || {}) : ''; } catch {}
        return l ? `${name(id)}: ${l}` : `Looking in ${name(id)}`;
      },
    });
  }

  window.aosHomeTab = { show, open: () => open.slice(), favorites, insets };   // for the tests (aOS/scripts/home-test.mjs)

  paintHome();
  const start = (/[#&]app=([a-z]+)/.exec(location.hash) || [])[1];
  if (known(start)) show(start);
})();
