// aOS's own script, moved out of index.html so the page's
// Content-Security-Policy can allow only this site's own files (script-src 'self').
'use strict';
(() => {
  const W = AllisonOS.welcome, D = W.data, ACC = AllisonOS.account, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const tx = s => (window.aosLang ? aosLang.t(s) : s);   // a text the page doesn't show as text (a confirm), or one whose words move around its <b>, in Russian (../home/lang.js)
  const line = k => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${W.lines[k] || W.lines.sparkle}</svg>`;
  // Every app carries both its designs itself (picked in its own Settings, ../home/design.js), so its folder has
  // its icons: icon-512.png (Vintage), icon-glass-512.png (Sea glass), icon-neon-512.png, icon-folk-512.png, icon-grid-512.png. aOS shows
  // the one for its own look. The app's own icon (what a Home Screen shows) follows the design picked in the app.
  const lookNow = () => (window.aosLook ? aosLook.get() : 'vintage');
  const icon = id => `../${id}/icon-${lookNow() === 'vintage' ? '' : lookNow() + '-'}512.png`;
  const appUrl = id => new URL(`../${id}/`, location.href).href + '?via=aos';
  const T = id => D.TOURS[id] || { tag: '', cards: [] };
  const v = D.shown(), live = D.RELEASES.filter(r => !r.silent);
  const GLASS_HUE = { clock: '78,93,126', mail: '127,147,194', calendar: '192,138,132', news: '160,141,123', weather: '110,162,183', notes: '111,165,151', podcasts: '141,132,190', travel: '201,151,110', orders: '90,166,168', places: '143,165,112', fitness: '107,127,145', drinks: '169,117,144', meals: '181,112,90', house: '188,156,104', sparkle: '184,140,192' };   // each icon's Sea glass tint
  const VINTAGE_HUE = { notes: '85,96,107', podcasts: '122,74,140', places: '62,142,90', meals: '142,58,43', news: '126,140,52', fitness: '74,52,38', travel: '74,52,38', drinks: '126,140,52', weather: '126,140,52', calendar: '63,110,154', mail: '31,111,107', house: '227,167,47', orders: '216,87,42', sparkle: '194,87,127' };   // each mid-century icon's colour
  const NEON_HUE = { notes: '86,73,110', podcasts: '145,63,113', places: '29,142,174', meals: '146,42,94', news: '135,109,217', fitness: '51,35,76', travel: '51,35,76', drinks: '135,109,217', weather: '135,109,217', calendar: '101,98,159', mail: '34,113,137', house: '251,162,74', orders: '223,56,142', sparkle: '205,72,136' };   // the same, in Night Drive (aOS/scripts/looks.mjs)
  const GRID_HUE = { notes: '58,86,99', podcasts: '159,62,24', places: '4,138,161', meals: '138,64,0', news: '10,139,150', fitness: '16,51,66', travel: '16,51,66', drinks: '10,139,150', weather: '10,139,150', calendar: '35,113,160', mail: '0,110,128', house: '252,151,36', orders: '201,103,28', sparkle: '194,99,25' };   // and in Grid
  const FOLK_HUE = { notes: '63,76,106', podcasts: '155,61,73', places: '48,87,207', meals: '142,43,34', news: '97,140,71', fitness: '32,46,83', travel: '32,46,83', drinks: '97,140,71', weather: '97,140,71', calendar: '70,95,157', mail: '42,69,144', house: '219,156,34', orders: '221,62,49', sparkle: '202,74,61' };   // and in Folk
  // the glow behind an app: its icon's tint, for aOS's look
  const HUE = new Proxy(GLASS_HUE, { get: (o, id) => ({ glass: o, neon: NEON_HUE, folk: FOLK_HUE, grid: GRID_HUE }[lookNow()] || VINTAGE_HUE)[id] || o[id] });
  const CAT = { clock: 'Utilities', mail: 'Productivity', calendar: 'Productivity', news: 'News', weather: 'Weather', notes: 'Productivity', podcasts: 'Entertainment', travel: 'Travel', places: 'Travel', orders: 'Shopping', fitness: 'Health & Fitness', drinks: 'Health & Fitness', meals: 'Food & Drink', house: 'Lifestyle', sparkle: 'Games' };
  const SHARED = ['calendar', 'travel', 'notes', 'places', 'meals'];
  const group = id => D.CORE.includes(id) ? 'Core apps' : 'Allison family apps';
  // what each app needs from a new person today: ok = nothing to do, once = a one-time step
  const NEEDS = {
    clock: [['ok', 'Nothing']],
    mail: [['once', 'Sign in with your own Google account']],
    calendar: [['ok', 'Your family account (Face ID)']],
    news: [['ok', 'Nothing']],
    weather: [['ok', 'Your location, if you allow it']],
    notes: [['once', 'The family Google Sheet, to share notes (optional)']],
    podcasts: [['ok', 'Nothing']],
    travel: [['ok', 'Your family account (Face ID)'], ['once', 'Your Google account, to find trips in Gmail (optional)']],
    places: [['once', 'The family Google Sheet, to share lists (optional)']],
    orders: [['ok', 'Your family account (Face ID), for Ipsy'], ['once', 'Your Google account, to find orders in Gmail (optional)']],
    fitness: [['once', 'Your own Google Sheet, as a backup (optional)']],
    drinks: [['ok', 'Your family account (Face ID)']],
    meals: [['ok', 'Your family account (Face ID)']],
    house: [['ok', 'Your family\'s Home Assistant address, filled in'], ['once', 'Your own Home Assistant token']],
    sparkle: [['ok', 'Nothing for the children'], ['once', 'A grown-up signs in with Face ID, to keep progress on every phone (optional)']],
  };
  // ✓ Installed: an app opened from your Home Screen in the last 90 days, signed in
  // (home/welcome.js reports it); a tap still offers the install steps, in case it's gone.
  // iOS never tells a page it was removed, so the app's page asks "Removed it?": that
  // shows Get at once, until the app is next opened from the Home Screen.
  let INST = new Set();
  const getBtn = id => `<a class="get${INST.has(id) ? ' done' : ''}" data-get="${id}" href="${appUrl(id)}" target="_blank" rel="noopener">${INST.has(id) ? 'Installed' : 'Get'}</a>`;
  const paintGets = () => {
    document.querySelectorAll('[data-get]').forEach(b => { const on = INST.has(b.dataset.get); b.classList.toggle('done', on); b.textContent = on ? 'Installed' : 'Get'; });
    document.querySelectorAll('[data-gone]').forEach(b => { b.hidden = !INST.has(b.dataset.gone); });
  };
  // ---- designs: an app that comes in more than one design (home/welcome.js DESIGNS) ----
  // One row for the app, a Design menu on its page. Each design is its own app, so the one
  // picked here (kept on this device) decides which app Get adds and which one says Installed.
  const DESIGNS = D.DESIGNS, hasDesigns = id => !!DESIGNS[id];
  const baseOf = app => Object.keys(DESIGNS).find(b => DESIGNS[b].some(d => d.app === app));
  const LOOK_DOTS = { glass: ['#6FA597', '#8193BC', '#BE918F'], vintage: ['#1F6F6B', '#E3A72F', '#D8572A'] };
  const lookDots = d => `<span class="dd" aria-hidden="true">${LOOK_DOTS[d.look].map(c => `<i style="background:${c}"></i>`).join('')}</span>`;
  const DKEY = id => 'aos.design.' + id;
  const chosenDesign = id => {
    const ds = DESIGNS[id]; let want = null; try { want = localStorage.getItem(DKEY(id)); } catch {}
    // a pick made here; else, in the Vintage look, the Vintage design, even when the Standard app is already on the
    // Home Screen (so Get offers the Vintage app, and every link goes to it); else the design already added, else Standard
    const vintage = ds.find(d => d.look === 'vintage'), glassLook = window.aosLook && aosLook.get() === 'glass';
    return ds.find(d => d.id === want) || (!glassLook && vintage) || ds.find(d => INST.has(d.app)) || ds[0];
  };
  const appOf = id => hasDesigns(id) ? chosenDesign(id).app : id;
  const pickDesign = (id, did) => { try { localStorage.setItem(DKEY(id), did); } catch {} };
  const dopts = id => { const cur = chosenDesign(id); return DESIGNS[id].map(d => `<button type="button" role="option" class="dopt" data-did="${d.id}" aria-selected="${d.id === cur.id}"><span class="dth ${d.look}" aria-hidden="true"><i></i><i></i><i></i></span><span class="dt"><b>${esc(d.name)}</b><small>${esc(d.note)} · ${INST.has(d.app) ? 'Installed' : 'Not added'}</small></span><span class="dck" aria-hidden="true">✓</span></button>`).join(''); };
  const CHEV = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const dsel = id => { const cur = chosenDesign(id); return `<div class="dsel" data-dsel="${id}"><button type="button" class="dbtn" aria-haspopup="listbox" aria-expanded="false"><span class="dl">Design</span>${lookDots(cur)}<b>${esc(cur.name)}</b>${CHEV}</button><div class="dmenu" role="listbox" aria-label="Design" hidden>${dopts(id)}</div></div>`; };
  let repaintLists = () => {};
  const goneBtn = id => `<button type="button" class="gone" data-gone="${id}"${INST.has(id) ? '' : ' hidden'}>Removed it from your Home Screen?</button>`;
  async function markGone(b) {
    const id = b.dataset.gone; b.disabled = true;
    try { await ACC.call('installed', { app: id, removed: true }); } catch (e) { b.disabled = false; b.textContent = 'Couldn’t reach aOS. Try again?'; return; }
    INST.delete(id); paintGets(); b.disabled = false;
    b.insertAdjacentHTML('afterend', '<p class="gone-note">Shows Get now.</p>');
  }
  const learnInstalled = st => { const a = (st && st.user && st.user.apps) || {}; INST = new Set(Object.keys(a).filter(k => Date.now() - a[k] < 90 * 864e5)); paintGets(); repaintLists(); };
  // an app the newest (non-silent) release changed says so under its name
  const now = live[0];
  const changed = id => { const e = D.entry((now.apps || {})[id]); return e.highlights.length + e.notes.length > 0; };
  const sub = id => changed(id) ? `New in aOS<sup>${esc(now.v)}</sup>` : esc(T(id).tag);
  const mk = sv => `aOS<sup>${esc(sv)}</sup>`;

  // ---- account: the avatar everywhere ----
  const user = () => ACC.user();
  const paintAvatars = () => { const u = user(); for (const a of document.querySelectorAll('[data-acct]')) a.innerHTML = u ? esc(u.name[0].toUpperCase()) : '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.2"/><path d="M4 21c.8-4.4 4-6.6 8-6.6s7.2 2.2 8 6.6z"/></svg>'; };
  paintAvatars(); addEventListener('aos:account', paintAvatars);

  // ---- Today ----
  $('date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  // Today's postcards: what's new first, then a mix of apps that changes every day.
  //   - an app the newest release brought to aOS (its `added`, home/welcome.js) leads, big,
  //     for 30 days after the release's date; with two or more, a different one leads each day
  //   - what's new in aOS (the mark, #mark) sits beside it while that release is fresh (and is
  //     the big card when it brought no app); after that it joins the mix
  //   - then every other app's card, setting up Home and your family account, shuffled by the
  //     day (the same mix all day, a new one tomorrow); the first is the app of the day
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);
  const rnd = (n => () => (n = (n * 1664525 + 1013904223) >>> 0) / 2 ** 32)(day);
  const mix = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fresh = Date.now() - Date.parse(now.date || 0) < 30 * 864e5;
  const added = fresh ? (now.added || []).filter(id => D.APPS.includes(id) && !D.VARIANTS.has(id)) : [];
  const brought = added.map((_, i) => added[(i + day) % added.length]);
  const HEAD = { travel: 'Every trip, the whole family\'s' };
  const meet = (id, k) => ({ id, k, h: HEAD[id] || `${D.NAMES[id]}: ${T(id).tag}`, art: (T(id).cards[0] || {}).i, body: () => T(id).cards.map(c => `<h3>${esc(c.t)}</h3><p>${esc(c.d)}</p>`).join('') });
  const NEWS = { k: 'What\'s new', h: `The Power of ${mk(v)}`, plain: true, body: () => { const r = live[0]; return `<p>${esc(r.title || '')}</p><ol>${hi(r).map(n => `<li>${esc(n)}</li>`).join('')}</ol>`; } };
  const SETUP = { house: { id: 'house', k: 'Get started', h: 'Set up Home in two minutes', art: 'house', body: () => `
      <h3>1. Sign in</h3><p>The address fills itself in.</p>
      <h3>2. Make your own token</h3><p>In the Home Assistant app: <b>☰</b> → <b>your name</b> → <b>Security</b> → <b>Long-lived access tokens</b> → <b>Create token</b>, then <b>Copy</b>.</p>
      <h3>3. Paste and connect</h3><p>Open Home, tap the gear, paste the token, tap <b>Connect</b>, and choose a PIN.</p>` } };
  const FAM = { id: 'calendar', k: 'Your family', h: 'One Face ID, every app', art: 'people', body: () => `
      <p>Every AllisonOS app signs in with one Face ID tap.</p>
      <h3>Invite someone</h3><p>Under your account, top right.</p>` };
  // Meet Ipsy: the helper you chat with (home/ipsy.js), a little stem cell that changes shape as it works.
  // While a release that introduces it is fresh (its intro: 'ipsy'), it leads Today, big, telling what it can
  // do in a speech bubble as it turns from one cell into the next; after that it joins the mix.
  const IPSY_APPS = ['orders', 'travel', 'meals', 'calendar', 'notes', 'news'];   // the apps Ipsy is in
  const IPSY_SAYS = [
    ['stem', 'Hi! I’m Ipsy, a little stem cell.'], ['wbc', 'I track down orders and trips.'],
    ['neuron', 'I check flights, Gmail and the web.'], ['rbc', 'I plan dinners and tidy your lists.'],
    ['heart', 'Every change I make has an Undo.'], ['muscle', 'Find me on aOS Home, and in six apps!'],
  ];
  const IPSY_FORMS = [['stem', 'Stem cell', 'Resting, ready to help'], ['neuron', 'Nerve cell', 'Thinking'], ['wbc', 'White blood cell', 'On the hunt through your things'],
    ['rbc', 'Red blood cell', 'Just showing off'], ['muscle', 'Muscle cell', 'Also showing off'], ['heart', 'Heart cell', 'Showing a lot of heart']];
  const IPSY = { id: 'orders', ipsy: true, k: 'Meet Ipsy', h: 'Say hi to Ipsy, your new helper', body: () => `
      <p>A little stem cell you can chat with, in ${IPSY_APPS.map(id => esc(D.NAMES[id] || id)).join(', ').replace(/, ([^,]*)$/, ' and $1')}.</p>
      <h3>Ask in your own words</h3><p>“Is anything late?” (Orders) “When should we leave for the airport?” (Travel) “Swap Tuesday for something quick.” (Meals) “Find us a free evening next week.” (Calendar) “Sort my grocery list by aisle.” (Notes) “What happened in the game last night?” (News)</p>
      <h3>It does the work</h3><p>Ipsy finds, fixes, adds and tidies in the app you’re in. Every change has Undo.</p>
      <h3>A cell of many shapes</h3><div class="ipsy-forms">${IPSY_FORMS.map(([f, n, d]) => `<figure><div class="ipsy-mini" data-ipsy-form="${f}"></div><figcaption><b>${esc(n)}</b><i>${esc(d)}</i></figcaption></figure>`).join('')}</div>
      <h3>Where to find it</h3><p>At the top of aOS Home, where I work across your apps, and in the bottom left corner of each app.</p>` };
  const ipsyStage = (cls, line) => `<div class="${cls}" data-ipsy-stage></div><p class="ipsy-say" aria-hidden="true"><span>${esc(line)}</span></p>`;
  // Brings every Ipsy on the page to life: the card's and the page's tell what it can do, one shape at a time.
  let ipsyTimer = 0;
  const ipsys = [];
  function wakeIpsy(root) {
    const I = AllisonOS.ipsy; if (!I || !I.character) return;
    for (const host of root.querySelectorAll('[data-ipsy-stage]:not([data-on])')) {
      host.dataset.on = '1';
      ipsys.push({ host, say: host.parentNode.querySelector('.ipsy-say'), c: I.character(host, { look: aosLook.get(), live: true }), i: 0 });
    }
    for (const host of root.querySelectorAll('[data-ipsy-form]:not([data-on])')) {
      host.dataset.on = '1';
      I.character(host, { look: aosLook.get(), form: host.dataset.ipsyForm, mood: host.dataset.ipsyForm === 'neuron' ? 'think' : 'idle' });
    }
    if (!ipsyTimer && !matchMedia('(prefers-reduced-motion: reduce)').matches) ipsyTimer = setInterval(() => {
      for (let k = ipsys.length - 1; k >= 0; k--) {
        const o = ipsys[k];
        if (!o.host.isConnected) { ipsys.splice(k, 1); continue; }
        o.i = (o.i + 1) % IPSY_SAYS.length;
        const [form, line] = IPSY_SAYS[o.i];
        o.c.form(form); o.c.mood('talk'); setTimeout(() => o.c.mood('idle'), 1100);
        if (o.say) o.say.innerHTML = `<span>${esc(line)}</span>`;
      }
    }, 2900);
  }
  addEventListener('aos:look', () => {
    for (const host of document.querySelectorAll('[data-ipsy-stage], [data-ipsy-form]')) AllisonOS.ipsy && AllisonOS.ipsy.wear ? AllisonOS.ipsy.wear(host, aosLook.get()) : (host.classList.toggle('ipsy-vintage', aosLook.flat()), host.classList.toggle('ipsy-glass', !aosLook.flat()));
  });
  const SHAPE = ['', 'half', 'half', 'wide', '', 'half', 'half'];   // the bento: one tall, two halves, one wide, again
  const intro = fresh && now.intro === 'ipsy';
  // apps still being tested: never on Today (as Meet or App of the day) until they're announced
  const QUIET = ['sparkle'];
  const pool = mix([...D.APPS.filter(id => !D.VARIANTS.has(id) && !added.includes(id) && !QUIET.includes(id)).map(id => SETUP[id] || meet(id, 'Meet')), FAM, ...(fresh ? [] : [NEWS]), ...(intro ? [] : [IPSY])]);
  const STORIES = [...(intro ? [IPSY] : []), ...brought.slice(0, 1).map(id => meet(id, 'New in aOS')), ...(fresh ? [NEWS] : []), ...brought.slice(1).map(id => meet(id, 'New in aOS'))];
  for (const s of pool) if (STORIES.length < SHAPE.length && !STORIES.some(o => o.id && o.id === s.id)) STORIES.push(s);
  const aotd = STORIES.find(s => s.k === 'Meet'); if (aotd) aotd.k = 'App of the day';   // the first app shown (one from the pool can be left out: Meet Ipsy is Orders')
  const w = STORIES.indexOf(NEWS); if (SHAPE[w] === 'wide') [STORIES[w], STORIES[w + 1]] = [STORIES[w + 1], STORIES[w]];   // the mark needs height
  let tint = 0; for (const s of STORIES) s.cls = s.plain ? 's2' : s.ipsy ? (tint++, 's0') : ['s0', 's1', 's3', 's4'][tint++ % 4];   // the Vintage postcard colors (Ipsy: mustard on teal)
  $('stories').innerHTML = STORIES.map((s, i) => s.ipsy
    ? `<div class="story ipsy ${s.cls} ${SHAPE[i]}" role="button" tabindex="0" data-story="${i}" style="--c:129,147,188"><div class="art">${ipsyStage('ipsy-stage', IPSY_SAYS[0][1])}</div>
       <div class="txt"><span class="chip">${esc(s.k)}</span><h2>${esc(s.h)}</h2></div>
       <div class="foot"><img src="${icon(s.id)}" alt=""><span><b>Ipsy is in ${IPSY_APPS.length} apps</b><i>On aOS Home, and in each app</i></span>${getBtn(appOf(s.id))}</div></div>`
    : s.plain
    ? `<div class="story plain ${s.cls} ${SHAPE[i]}" role="button" tabindex="0" data-story="${i}"><div class="art"></div><div class="txt"><span class="chip">${esc(s.k)}</span><h2 id="power">${s.h}</h2></div><div class="mk ink" id="mark">${mk(v)}</div></div>`
    : `<div class="story ${s.cls} ${SHAPE[i]}" role="button" tabindex="0" data-story="${i}" style="--c:${HUE[s.id]}"><div class="art">${line(s.art)}<img src="${icon(s.id)}" alt=""></div>
       <div class="txt"><span class="chip">${esc(s.k)}</span><h2>${esc(s.h)}</h2></div>
       <div class="foot"><img src="${icon(s.id)}" alt=""><span><b>${esc(D.NAMES[s.id])}</b><i>${esc(T(s.id).tag)}</i></span>${getBtn(appOf(s.id))}</div></div>`).join('');

  wakeIpsy($('stories'));

  // ---- Apps, and Search ----
  const rows = ids => ids.map(id => { const ap = appOf(id), ds = hasDesigns(id);
    return `<div class="row" role="button" tabindex="0" data-app="${id}" style="--c:${HUE[ap]}"><img src="${icon(ap)}" alt=""><span class="t"><span><b>${esc(D.NAMES[id])}</b><i>${sub(id)}</i>${ds ? `<em class="dtag">${DESIGNS[id].map(d => `<span class="dd" aria-hidden="true"><i style="background:${LOOK_DOTS[d.look][1]}"></i></span>`).join('')}${DESIGNS[id].length} designs</em>` : ''}</span>${getBtn(ap)}</span></div>`; }).join('');
  // two collections: the core apps, then the Allison family's own (a design of an app is not a row of its own)
  const find = () => { const q = $('q').value.trim().toLowerCase(); const hit = id => !q || [D.NAMES[id], T(id).tag, CAT[id], group(id), ...(DESIGNS[id] || []).map(d => d.name + ' ' + d.note), ...T(id).cards.map(c => c.t + ' ' + c.d)].join(' ').toLowerCase().includes(q); const ids = [...D.CORE, ...D.FAMILY].filter(hit); $('found').innerHTML = ids.length ? rows(ids) : '<p class="muted">No apps match.</p>'; };
  const paintList = () => { $('list').innerHTML = `<div class="sec"><h2>Core apps</h2></div>${rows(D.CORE)}<div class="sec"><h2>Allison family apps</h2></div>${rows(D.FAMILY)}`; find(); };
  repaintLists = paintList; paintList();
  $('q').oninput = find;

  // ---- tabs ----
  const tabs = document.querySelectorAll('[data-tab]');
  // the tabs in the order the dock shows them (aOS 2's Home takes the Apps tab's place: aOS/home-tab.js)
  const show = t => { const names = [...document.querySelectorAll('[data-tab]')].map(b => b.dataset.tab); for (const s of ['today', 'apps', 'search', 'home']) if ($(s)) $(s).hidden = s !== t; document.querySelector('.tabs').style.setProperty('--i', names.indexOf(t)); tabs.forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t))); $('scroller').scrollTop = 0; if (t === 'search') setTimeout(() => $('q').focus(), 50); };
  tabs.forEach(b => b.onclick = () => show(b.dataset.tab));
  window.aosTabs = { show };
  window.aosAccount = { open: at => acctPage(at) };   // Ipsy's open_setting: 'appearance', 'notifications', 'plan', 'updates', 'lost', 'move', 'owner'
  window.aosAppHue = id => HUE[id];

  // ---- pages that slide over ----
  function page(html, { up = false, c = '', cls = '' } = {}) {
    const el = document.createElement('div');
    el.className = 'page' + (up ? ' up' : ''); el.style.setProperty('--c', c);
    el.innerHTML = `${up ? '<button type="button" class="close" aria-label="Close">✕</button>' : '<button type="button" class="back" aria-label="Back">‹</button>'}<div class="in ${cls}">${html}</div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    const done = () => { el.classList.remove('on'); setTimeout(() => el.remove(), 400); };
    el.querySelector('.back, .close').onclick = done;
    if (!up) swipeBack(el, done);
    return el;
  }
  // swipe right from the left edge, as iOS goes back
  function swipeBack(el, done) {
    let x0 = null, dx = 0;
    el.addEventListener('touchstart', e => { const t = e.touches[0]; x0 = t.clientX < 30 ? t.clientX : null; dx = 0; }, { passive: true });
    el.addEventListener('touchmove', e => { if (x0 == null) return; dx = Math.max(0, e.touches[0].clientX - x0); el.style.transition = 'none'; el.style.transform = `translateX(${dx}px)`; }, { passive: true });
    el.addEventListener('touchend', () => { if (x0 == null) return; el.style.transition = ''; el.style.transform = ''; if (dx > 90) done(); x0 = null; });
  }

  function appPage(id) {
    const r = live.find(x => { const e = D.entry((x.apps || {})[id]); return e.highlights.length + e.notes.length; });
    const e = r ? D.entry(r.apps[id]) : null;
    const ap = appOf(id);
    const el = page(`<div class="apphead"><img src="${icon(ap)}" alt=""><div><h1>${esc(D.NAMES[id])}</h1><p>${esc(T(id).tag)}</p>${hasDesigns(id) ? dsel(id) : ''}<span class="gets">${window.aosHomeTab ? `<button type="button" class="get open" data-open="${id}">Open</button>` : ''}${getBtn(ap)}${goneBtn(ap)}</span></div></div>
      <div class="strip">
        <div><b class="ink">${mk(v)}</b><small>Latest</small></div>
        <div>${line((T(id).cards[0] || {}).i)}<i>${esc(CAT[id])}</i></div>
        <div>${line(SHARED.includes(id) ? 'people' : 'lock')}<i>${SHARED.includes(id) ? 'Shared with family' : 'Just you'}</i></div>
        <div>${line('sparkle')}<i>Allison Corporation</i></div>
      </div>
      <div class="sec"><h2>What's New</h2></div>
      <div class="wn"><small>${mk(r ? r.v : v)} · ${esc((r || live[live.length - 1]).date || '')}</small>${e ? `<ul>${hi(r.apps[id]).map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : `<p>Part of ${mk(v)}: ${esc(live[live.length - 1].title)}.</p>`}</div>
      <div class="sec"><h2>Preview</h2></div>
      <div class="shots">${T(id).cards.map(c => `<div class="shot">${line(c.i)}<b>${esc(c.t)}</b><p>${esc(c.d)}</p></div>`).join('')}</div>
      <div class="sec"><h2>What it needs</h2></div>
      ${(NEEDS[id] || []).map(([k, t]) => `<div class="need"><span>${esc(t)}</span><em class="${k}">${k === 'ok' ? 'Ready' : 'Once'}</em></div>`).join('')}
      <div class="sec"><h2>About</h2></div>
      <div class="desc">${T(id).cards.map(c => `<p><b>${esc(c.t)}.</b> <span class="muted">${esc(c.d)}</span></p>`).join('')}</div>
      <div class="sec"><h2>Information</h2></div>
      <div class="info"><div><span>Provider</span><span>Allison Corporation</span></div><div><span>Collection</span><span>${group(id)}</span></div><div><span>Category</span><span>${esc(CAT[id])}</span></div><div><span>Compatibility</span><span>iOS &amp; Android</span></div><div><span>Languages</span><span>English</span></div><div><span>Price</span><span>Free</span></div></div>`, { c: HUE[ap] });
    el.addEventListener('click', ev => {
      const g = ev.target.closest('[data-gone]'); if (g && !g.disabled) return markGone(g);
      const ds = el.querySelector('.dsel'); if (!ds) return;
      const btn = ds.querySelector('.dbtn'), menu = ds.querySelector('.dmenu');
      const setOpen = on => { menu.hidden = !on; btn.setAttribute('aria-expanded', String(on)); };
      if (ev.target.closest('.dbtn')) return setOpen(menu.hidden);
      const o = ev.target.closest('.dopt');
      if (o) {   // a design picked: this page, and the app's row, follow it
        pickDesign(id, o.dataset.did); setOpen(false);
        const nap = appOf(id);
        el.style.setProperty('--c', HUE[nap]); el.querySelector('.apphead img').src = icon(nap);
        el.querySelector('.gets').innerHTML = getBtn(nap) + goneBtn(nap);
        const cur = chosenDesign(id); btn.querySelector('b').textContent = cur.name; btn.querySelector('.dd').outerHTML = lookDots(cur);
        menu.innerHTML = dopts(id); repaintLists(); return;
      }
      setOpen(false);
    });
  }
  // Get on an app with designs, not yet added: pick the design first, then the app's own address
  // opens (it shows how to add it). Several designs can be added; each is its own Home Screen app.
  function designSheet(id) {
    const goHtml = ap => INST.has(ap) ? `<a class="get big done" data-go="${ap}" href="${appUrl(ap)}" target="_blank" rel="noopener">Installed</a>` : `<a class="get big" data-go="${ap}" href="${appUrl(ap)}" target="_blank" rel="noopener">Open ${esc(D.NAMES[ap])} to add it</a>`;
    const ap0 = appOf(id);
    const el = page(`<div class="dsheet"><h1>Make ${esc(D.NAMES[id])} yours</h1><p>Pick a design.</p>
      <div class="dlist" role="listbox" aria-label="Design">${dopts(id)}</div><div class="dgo">${goHtml(ap0)}</div></div>`, { up: true, c: HUE[ap0] });
    el.addEventListener('click', ev => {
      const o = ev.target.closest('.dopt'); if (!o) return;
      pickDesign(id, o.dataset.did); const nap = appOf(id);
      el.style.setProperty('--c', HUE[nap]);
      el.querySelector('.dlist').innerHTML = dopts(id); el.querySelector('.dgo').innerHTML = goHtml(nap); repaintLists();
    });
  }
  function storyPage(i) {
    const s = STORIES[i];
    if (s.ipsy) {
      const el = page(`<div class="hero ipsy ${s.cls}"><div class="art">${ipsyStage('ipsy-hero', IPSY_SAYS[0][1])}</div>
        <div class="txt"><span class="chip">${esc(s.k)}</span><h2>${esc(s.h)}</h2></div></div>
        <div class="body">${s.body()}</div>
        <div class="approw"><img src="${icon(s.id)}" alt=""><span><b>${esc(D.NAMES[s.id])}</b><i>${esc(T(s.id).tag)}</i></span>${getBtn(appOf(s.id))}</div>`, { up: true, c: '129,147,188' });
      return wakeIpsy(el);
    }
    page(`<div class="hero ${s.cls}" style="${s.plain ? 'color:var(--text)' : ''}"><div class="art" style="${s.plain ? 'background:var(--card)' : ''}">${s.plain ? `<div class="mk ink" style="position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top) + 90px);text-align:center;font-size:96px;font-weight:800;letter-spacing:-3px">${mk(v)}</div>` : `<img src="${icon(s.id)}" alt="">`}</div>
      <div class="txt"><span class="chip">${esc(s.k)}</span><h2>${s.plain ? s.h : esc(s.h)}</h2></div></div>
      <div class="body">${s.body()}</div>
      ${s.id ? `<div class="approw"><img src="${icon(s.id)}" alt=""><span><b>${esc(D.NAMES[s.id])}</b><i>${esc(T(s.id).tag)}</i></span>${getBtn(appOf(s.id))}</div>` : ''}`, { up: true, c: s.id ? HUE[s.id] : '' });
  }
  // ---- your account (the avatar): family accounts with passkeys (Face ID) ----
  // The owner sets up once with the owner code; everyone else joins with an
  // invite link (#invite=...), opened in Safari: the account is made there, then
  // aOS shows how to add it to the Home Screen. Every app signs in with Face ID.
  const li = (n, hi) => `<li${hi ? ' class="hi"' : ''}>${esc(n)}</li>`;
  // updates are told simply: what's new at a high level (a release's highlights), never the details
  const hi = r => { const e = D.entry(r); return (e.highlights.length ? e.highlights : e.notes).slice(0, 5); };
  // ---- Subscription: just for fun, nothing is charged. The family's plan, kept in the
  // family account (functions/aOS/api, POST plan) so every app on every phone sees it:
  // Pro+ until the owner changes it. A cancelled plan runs to the end of its month, a
  // trial for 7 days; then every app but aOS is switched off (home/welcome.js) until
  // the owner picks a plan here. Only the owner changes it; everyone sees it. The
  // trial is once per family. Switched off deletes nothing: it's all there again.
  const PLANS = [
    { id: 'proplus', n: 'Pro+', p: 35, d: 'Every stock app, customizable, plus new app building' },
    { id: 'pro', n: 'Pro', p: 15, d: 'Every stock app, customizable' },
    { id: 'trial', n: 'Trial', p: 0, d: 'The stock apps, free for 7 days, once' },
  ];
  const DAY = 864e5;
  const price = p => p.p ? `$${p.p}<small> a month</small>` : 'Free';
  const onDay = t => new Date(t).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const shortDay = t => new Date(t).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  const planLive = p => !p || !p.ends || Date.now() < p.ends;
  const OFF = 'every app but aOS switches off';
  function planNote(cur, me, owner) {
    const fun = ' Just for fun: nothing is charged.';
    if (!cur) return state ? '' : 'Checking…';
    if (!planLive(cur)) return `${cur.id === 'trial' ? 'The trial' : me.n} ended on ${onDay(cur.ends)}: every app but aOS is off.${owner ? ` Choose ${cur.id === 'trial' ? 'Pro or Pro+' : 'a plan'} to turn them back on.` : ''}${fun}`;
    if (cur.id === 'trial') { const left = Math.ceil((cur.ends - Date.now()) / DAY); return `${left} ${left === 1 ? 'day' : 'days'} left in the trial: it ends on ${onDay(cur.ends)}, and ${OFF} then.${fun}`; }
    if (cur.cancelled) return `${me.n} is canceled: it ends on ${onDay(cur.ends)}, and ${OFF} then.${fun}`;
    return `${me.n}, $${me.p} a month, since ${onDay(cur.since)}. Renews ${onDay(cur.renews)}.${fun}`;
  }
  // ui: { pick: plan id } to confirm a switch, { cancel: true } to confirm cancelling, { err }
  function paintPlans(ui = {}) {
    const box = $('plans'); if (!box) return;
    const cur = (state && state.plan) || null, me = cur && PLANS.find(p => p.id === cur.id);
    const owner = !!(cur && state.user && state.user.role === 'owner'), live = planLive(cur), to = PLANS.find(p => p.id === ui.pick);
    const usedUp = p => p.id === 'trial' && !!cur && cur.trialUsed && !(cur.id === 'trial' && live);   // the trial is once
    const badge = p => !cur ? '' : p.id !== cur.id ? (usedUp(p) ? ' <em class="used">Used</em>' : '') : ` <em class="${live ? '' : 'off'}">${!live ? 'Ended' : cur.ends ? 'Ends ' + esc(shortDay(cur.ends)) : 'Your plan'}</em>`;
    let rows = PLANS.map(p => `<button type="button" class="plan" data-plan="${p.id}" aria-pressed="${!!cur && live && p.id === cur.id}"${owner && !usedUp(p) ? '' : ' disabled'}>
        <span class="pn"><b>${esc(p.n)}${badge(p)}</b><i>${esc(p.d)}</i></span><span class="pp">${price(p)}</span></button>`).join('');
    if (owner && to) rows += `<div class="pick"><div class="row2"><button type="button" data-plan-no>Not now</button><button type="button" class="go" data-plan-ok="${to.id}">${to.id === 'trial' ? 'Start the 7-day trial' : `Switch to ${esc(to.n)}`}</button></div></div>`;
    else if (owner && ui.cancel) rows += `<div class="pick"><p>${esc(me.n)} stays on until ${esc(onDay(cur.renews))}, then ${OFF}.</p><div class="row2"><button type="button" data-plan-no>Keep ${esc(me.n)}</button><button type="button" class="go stop" data-plan-stop>Cancel ${esc(me.n)}</button></div></div>`;
    else if (owner && live && cur.id !== 'trial') rows += cur.cancelled ? `<button type="button" class="pact" data-plan-resume>Keep ${esc(me.n)}</button>` : `<button type="button" class="pact stop" data-plan-cancel>Cancel ${esc(me.n)}</button>`;
    box.innerHTML = rows;
    $('planNote').innerHTML = (ui.err ? `<span class="perr">${esc(ui.err)}</span> ` : '') + esc(planNote(cur, me, owner));
  }
  const PLAN_WHY = { 'trial-used': 'The trial is once per family: choose Pro or Pro+.', ended: 'That plan has already ended: choose a plan.', 'owner-only': 'Only the owner can change the plan.', signin: 'Sign in to change the plan.' };
  async function setPlan(btn, body) {
    busy(btn, true);
    try { const r = await ACC.call('plan', body); state.plan = r.plan; paintPlans(); paintSigninCard(); }
    catch (e) { paintPlans({ err: PLAN_WHY[e && e.message] || why(e) }); }
  }
  function onPlanTap(ev) {
    const cur = state && state.plan;
    const pl = ev.target.closest('[data-plan]'); if (pl) return paintPlans(cur && pl.dataset.plan === cur.id && planLive(cur) ? {} : { pick: pl.dataset.plan });
    if (ev.target.closest('[data-plan-no]')) return paintPlans();
    if (ev.target.closest('[data-plan-cancel]')) return paintPlans({ cancel: true });
    let b;
    if ((b = ev.target.closest('[data-plan-ok]'))) return setPlan(b, { id: b.dataset.planOk });
    if ((b = ev.target.closest('[data-plan-stop]'))) return setPlan(b, { cancel: true });
    if ((b = ev.target.closest('[data-plan-resume]'))) return setPlan(b, { resume: true });
  }
  // Look: Vintage (mid-century, the default), Sea glass, Night Drive, Folk or Grid, kept on this phone (look.js); every app takes it too
  const LOOKS = [['vintage', 'Vintage', 'Mid-century, Retro colors'], ['glass', 'Sea glass', 'The original look'], ['neon', 'Night Drive', '80s neon, magenta and cyan'], ['folk', 'Folk', 'Gzhel by day, Khokhloma by night'], ['grid', 'Grid', 'Light cycles, cyan and orange']];
  const lookOpts = () => LOOKS.map(([id, n, note]) => `<button type="button" role="option" class="dopt" data-look="${id}" aria-selected="${aosLook.get() === id}"><span class="dth ${id}" aria-hidden="true"><i></i><i></i><i></i></span><span class="dt"><b>${esc(n)}</b><small>${esc(note)}</small></span><span class="dck" aria-hidden="true">✓</span></button>`).join('');
  // Account: your name and Sign out, then every section folded under its heading until it's tapped (fold);
  // a link to Updates or Subscription (a notification, the plan card) opens that one
  // (subId: its line under the heading, kept up to date; anchor: the id a link opens it by, #whats-new, #subscription)
  const fold = (id, title, sub, body, subId = '', anchor = '') => `<button type="button" class="tools" data-fold aria-expanded="false" aria-controls="${id}"${anchor ? ` id="${anchor}"` : ''}><span><b>${title}</b><small${subId ? ` id="${subId}"` : ''}>${sub}</small></span><i aria-hidden="true">›</i></button>
    <div class="fbody" id="${id}" hidden>${body}</div>`;
  const unfold = (b, on) => { if (!b) return; on = on == null ? b.getAttribute('aria-expanded') !== 'true' : on; b.setAttribute('aria-expanded', String(on)); const x = $(b.getAttribute('aria-controls')); if (x) x.hidden = !on; };
  const THEME_NAME = t => (W.theme.list.find(([v]) => v === t) || [, 'Automatic'])[1];
  // Language: English or Russian, for aOS and every app (../home/lang.js); each named in its own language, so it can always be found
  const LANGS = window.aosLang ? aosLang.list : [['en', 'English']];
  const langNow = () => (window.aosLang ? aosLang.get() : 'en');
  const looksLine = () => `${THEME_NAME(W.theme.read())} · ${(LOOKS.find(([id]) => id === aosLook.get()) || LOOKS[0])[1]} · ${(LANGS.find(([l]) => l === langNow()) || LANGS[0])[1]}`;
  function acctPage(at) {
    const r0 = live[0];
    const el = page(`<h1 class="ptitle">Account</h1>
      <div class="group acct" id="acct"><p class="note">Checking…</p></div>
      <div class="group acct">
        ${fold('fLook', 'Appearance', looksLine(), `<div class="seg" id="theme">${W.theme.list.map(([t, n]) => `<button type="button" data-t="${t}" aria-pressed="${t === W.theme.read()}">${n}</button>`).join('')}</div>
          <p class="lnote">Language</p>
          <div class="seg" id="lang" translate="no">${LANGS.map(([l, n]) => `<button type="button" data-lang="${l}" lang="${l}" aria-pressed="${l === langNow()}">${n}</button>`).join('')}</div>
          <div class="dlist" id="looks" role="listbox" aria-label="Look">${lookOpts()}</div>`, 'lookSub')}
        ${fold('fPlan', 'Subscription', 'The family\'s plan', `<div class="group plans" id="plans"></div><p class="note" id="planNote"></p>`, '', 'subscription')}
        ${fold('fNew', 'Updates', r0 ? `${mk(r0.v)} · ${esc(r0.title || '')}` : 'What\'s new', `<div class="group" id="rels">${live.slice(0, 1).map(r => `<div class="rel"><h4>${mk(r.v)} <span class="muted" style="font-weight:400">${esc(r.title || '')}</span></h4><small>${esc(r.date || '')}</small>
          <ul>${hi(r).map(n => li(n)).join('')}</ul></div>`).join('')}</div>
          <button type="button" class="soft" data-replay>Replay the welcome</button>`, '', 'whats-new')}
      </div>`, { up: true });
    el.addEventListener('click', ev => {
      const f = ev.target.closest('[data-fold]'); if (f) unfold(f);
      const t = ev.target.closest('[data-t]'); if (t) { W.theme.set(t.dataset.t); el.querySelectorAll('[data-t]').forEach(b => b.setAttribute('aria-pressed', String(b === t))); }
      const lk = ev.target.closest('[data-look]');
      if (lk) Promise.resolve(window.aosHomeTab && aosHomeTab.everyLook ? aosHomeTab.everyLook(lk.dataset.look) : aosLook.set(lk.dataset.look, { apps: D.APPS }))
        .then(() => { el.querySelector('#looks').innerHTML = lookOpts(); $('lookSub').textContent = looksLine(); });
      if (t) $('lookSub').textContent = looksLine();
      const lg = ev.target.closest('[data-lang]'); if (lg && window.aosLang) aosLang.set(lg.dataset.lang);   // aOS and every open app are drawn again in it
      if (ev.target.closest('[data-replay]')) W.play();
      onPlanTap(ev);
    });
    paintPlans();
    paintAccount(el.querySelector('#acct'));
    if (at === 'updates' || at === 'plan') { unfold(el.querySelector(at === 'plan' ? '#subscription' : '#whats-new'), true); setTimeout(() => el.querySelector(at === 'plan' ? '#subscription' : '#whats-new').scrollIntoView({ block: 'start' }), 450); }
    // a section the account's own card draws (Ipsy's open_setting): once it's there, unfolded and in sight
    const SECTION = { appearance: '[aria-controls="fLook"]', notifications: '[aria-controls="fNotify"]', lost: '[aria-controls="fLost"]', move: '[aria-controls="fMove"]', owner: '#tToggle' };
    if (SECTION[at]) { let n = 0; const find = () => { const b = el.querySelector(SECTION[at]); if (b) { unfold(b, true); setTimeout(() => b.scrollIntoView({ block: 'start' }), 300); } else if (n++ < 30) setTimeout(find, 200); }; find(); }
    return el;
  }

  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(navigator.userAgent);
  const invite = (/[#&]invite=([A-Za-z0-9_-]+)/.exec(location.hash) || [])[1] || null;
  if (invite) { try { sessionStorage.setItem('aos.later.aos', '1'); } catch {} }   // the account first, then how to add aOS
  const WHY = { code: 'That code isn\'t right.', invite: 'This invite has expired or was already used. Ask for a new one.', name: 'Use letters and spaces for your name.',
    storage: 'Family accounts aren\'t switched on yet.', 'owner-exists': 'The owner\'s account already exists: sign in instead.', unknown: 'That account isn\'t in the family any more.',
    NotAllowedError: 'Canceled, or Face ID didn\'t finish.', 'no-passkeys': 'This browser can\'t make passkeys: use Safari on your iPhone.',
    'passkey-exists': 'That passkey already belongs to an account here: sign in instead.' };
  const why = e => WHY[e && (e.name === 'NotAllowedError' ? e.name : e.message)] || 'Something went wrong (' + ((e && (e.message || e.name)) || '?') + ').';
  const busy = (b, on) => { b.disabled = on; b.style.opacity = on ? .6 : 1; };
  let state = null;
  const getState = async () => {
    const t = ACC.token();
    try { state = await ACC.call('state'); } catch (e) { state = { error: (e && e.status) || 'network' }; }
    if (state.erase && t && t === ACC.token()) { AllisonOS.erase(true); return state; }   // you erased aOS from your other devices: this was one
    learnInstalled(state); paintHero(state); paintPlans(); return state;
  };

  // ---- Lost a phone? How to sign out of aOS and erase it, step by step ----
  // The buttons: "Sign out and erase my other devices" (signout-others { erase: true }: each
  // other app of yours erases itself as it next opens online, home/welcome.js), the owner's
  // "Erase" for someone who lost their only phone (erase { id }), and "Sign out and erase aOS
  // on this phone" (this app only, at once). Linked as aOS/#lost-phone.
  function lostPage() {
    const u = user();
    const el = page(`<h1 class="ptitle">Lost a phone?</h1>
      <div class="glbl">1. First: Find My</div>
      <div class="group acct lost"><div><ol>
        <li>${tx('Open <b>Find My</b> on another Apple device, or go to <b>icloud.com/find</b>.')}</li>
        <li>Choose the lost iPhone, then <b>Mark As Lost</b> to lock it.</li>
        <li>If it's gone for good, choose <b>Erase This Device</b>.</li></ol></div></div>
      <div class="glbl">2. Erase aOS from your other devices</div>
      <div class="group acct lost"><div><ol>
        <li>Back up first: open each app, online, on a phone you still have.</li>
        <li>Here in aOS, tap <b>Sign out and erase my other devices</b>.</li>
        <li>Each of your aOS apps elsewhere erases itself when it next opens online.</li>
        <li>${tx('On <b>this</b> phone, open each other aOS app and sign in again.')}</li></ol>
        ${u ? `<button type="button" class="soft danger" id="lEraseOthers">Sign out and erase my other devices</button><div class="err" id="lErr"></div>` : `<p>Sign in to aOS first.</p>`}</div></div>
      <div class="glbl">3. Lost your only phone?</div>
      <div class="group acct lost"><div><ol>
        <li>On a new iPhone, open aOS in Safari, sign in, then do step 2.</li>
        <li>Or ask the owner to erase your devices from their <b>Lost a phone?</b> page.</li></ol>
        ${u && u.role === 'owner' ? '<div class="fam" id="lFam"><p>Loading the family…</p></div>' : ''}</div></div>
      <div class="glbl">4. Just this phone</div>
      <div class="group acct lost"><div><ol>
        <li>In <b>Fitness</b>: Settings (the gear) → <b>Sign out and erase</b>.</li>
        <li>In aOS: tap the button below.</li>
        <li>For the whole phone: <b>Settings → General → Transfer or Reset iPhone → Erase All Content and Settings</b>.</li></ol>
        <button type="button" class="soft danger" id="lEraseHere">Sign out and erase aOS on this phone</button></div></div>`);
    const lErr = el.querySelector('#lErr');
    if (el.querySelector('#lEraseOthers')) el.querySelector('#lEraseOthers').onclick = async e => {
      const b = e.currentTarget;
      if (!confirm(tx('Sign out and erase every other device, and the other aOS apps on this phone?'))) return;
      busy(b, true); lErr.textContent = ''; lErr.style.color = '';
      try { await ACC.signOutOthers(true);
        lErr.style.color = 'var(--muted)'; lErr.textContent = 'Done: each erases itself when it next opens online.'; }
      catch (x) { lErr.textContent = why(x); }
      busy(b, false);
    };
    el.querySelector('#lEraseHere').onclick = () => {
      if (!confirm(tx('Sign out and erase what aOS keeps on this phone?'))) return;
      AllisonOS.erase();
    };
    if (u && u.role === 'owner') paintLostFamily(el.querySelector('#lFam'));
    return el;
  }
  async function paintLostFamily(box) {
    let f; try { f = (await ACC.call('family')).family.filter(m => m.role !== 'owner' && !m.removed); } catch { box.innerHTML = '<p>Couldn\'t load the family.</p>'; return; }
    box.innerHTML = f.length ? f.map(m => `<div><span translate="no">${esc(m.name)}</span><button type="button" data-erase="${esc(m.id)}">Erase their devices</button></div>`).join('') : '<p>No one else in the family yet.</p>';
    box.onclick = async e => {
      const b = e.target.closest('[data-erase]'); if (!b) return;
      const name = b.parentElement.querySelector('span').textContent;
      if (!confirm(tx(`Sign out and erase every aOS app on ${name}'s devices (their account stays)?`))) return;
      busy(b, true);
      try { await ACC.call('erase', { id: b.dataset.erase }); b.textContent = 'Erased'; } catch (x) { b.textContent = why(x); busy(b, false); }
    };
  }

  // Today, signed out: a card that opens the account
  // The family card: aOS is curated for the Allison family. A greeting by name, and
  // everyone in the family (names only, for signed-in family).
  const FAMILY = 'Allison';
  const FAMILY_ICON_VINTAGE = `<svg class="ficon" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#1F6F6B"/><circle cx="52" cy="10" r="19" fill="#E3A72F"/>
      <path d="M32 8.6c-1.3-2.1-4.8-1.7-4.8 1.1 0 2.4 4.8 5.1 4.8 5.1s4.8-2.7 4.8-5.1c0-2.8-3.5-3.2-4.8-1.1z" fill="#D8572A"/><g fill="#FBF5E9">
      <circle cx="21.5" cy="22" r="6.2"/><path d="M10 46c0-7.4 5.2-12.6 11.5-12.6S33 38.6 33 46z"/>
      <circle cx="42.5" cy="22" r="6.2"/><path d="M31 46c0-7.4 5.2-12.6 11.5-12.6S54 38.6 54 46z"/></g>
      <g fill="#FBF5E9" stroke="#1F6F6B" stroke-width="2"><circle cx="26" cy="36" r="4.8"/><path d="M17.5 54c0-5.8 3.8-9.6 8.5-9.6s8.5 3.8 8.5 9.6z"/>
      <circle cx="38" cy="36" r="4.8"/><path d="M29.5 54c0-5.8 3.8-9.6 8.5-9.6s8.5 3.8 8.5 9.6z"/></g></svg>`;
  const FAMILY_ICON_GLASS = `<svg class="ficon" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="fam-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A9D3C7"/><stop offset=".35" stop-color="#B9C6E0"/><stop offset=".68" stop-color="#E3C5C3"/><stop offset="1" stop-color="#E9D6B4"/></linearGradient></defs>
      <rect width="64" height="64" rx="18" fill="url(#fam-g)"/><g fill="#fff">
      <path d="M32 8.6c-1.3-2.1-4.8-1.7-4.8 1.1 0 2.4 4.8 5.1 4.8 5.1s4.8-2.7 4.8-5.1c0-2.8-3.5-3.2-4.8-1.1z"/>
      <circle cx="21.5" cy="22" r="6.2" opacity=".9"/><path d="M10 46c0-7.4 5.2-12.6 11.5-12.6S33 38.6 33 46z" opacity=".9"/>
      <circle cx="42.5" cy="22" r="6.2" opacity=".9"/><path d="M31 46c0-7.4 5.2-12.6 11.5-12.6S54 38.6 54 46z" opacity=".9"/></g>
      <g fill="#fff" stroke="#9FB0C9" stroke-width="1.2"><circle cx="26" cy="36" r="4.8"/><path d="M17.5 54c0-5.8 3.8-9.6 8.5-9.6s8.5 3.8 8.5 9.6z"/>
      <circle cx="38" cy="36" r="4.8"/><path d="M29.5 54c0-5.8 3.8-9.6 8.5-9.6s8.5 3.8 8.5 9.6z"/></g></svg>`;
  // Night Drive, Folk and Grid: the mid-century one, repainted (aOS/scripts/looks.mjs)
  const FAMILY_PAINT = {
    neon: { '#1F6F6B': '#227189', '#A9D3C7': '#AAD7E7', '#B9C6E0': '#C8C2D6', '#D8572A': '#DF388E', '#E3A72F': '#FBA24A', '#E3C5C3': '#D1CBDD', '#E9D6B4': '#FAD8BB', '#FBF5E9': '#FBF9FF' },
    grid: { '#1F6F6B': '#006E80', '#A9D3C7': '#92D5E5', '#B9C6E0': '#BCC9CF', '#D8572A': '#C9671C', '#E3A72F': '#FC9724', '#E3C5C3': '#C6D2D7', '#E9D6B4': '#F7D0AF', '#FBF5E9': '#F7FCFF' },
    folk: { '#1F6F6B': '#2A4590', '#A9D3C7': '#97AEE3', '#B9C6E0': '#C1C5CF', '#D8572A': '#DD3E31', '#E3A72F': '#DB9C22', '#E3C5C3': '#CBCFD8', '#E9D6B4': '#E1CBAB', '#FBF5E9': '#FBFCFF' },
  };
  const familyIcon = () => { const l = aosLook.get(); return l === 'glass' ? FAMILY_ICON_GLASS : FAMILY_PAINT[l] ? FAMILY_ICON_VINTAGE.replace(/#[0-9A-F]{6}/g, c => FAMILY_PAINT[l][c] || c) : FAMILY_ICON_VINTAGE; };
  addEventListener('aos:look', () => {   // the picker: the family icon and every app's icon follow the look
    if (state) paintHero(state);
    paintList();
    for (const el of document.querySelectorAll('#stories .story[data-story]')) { const st = STORIES[+el.dataset.story]; if (st && st.id) for (const im of el.querySelectorAll('img')) im.src = icon(st.id); }
  });   // the picker: the family icon follows the look
  let members = null;
  async function paintHero(st) {
    const u = st && st.user, h = new Date().getHours();
    const hello = u ? `Good ${h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'}, ${esc(u.name.split(/\s+/)[0])}` : 'Welcome home';
    if (u && !members) { try { members = (await ACC.call('members')).members; } catch { members = null; } }
    if (!u) members = null;
    const famT = tx('The {family} Family').split('{family}');   // in Russian the words go round the name the other way
    $('famhero').innerHTML = `<div class="famhero">${familyIcon()}<div class="ftxt"><small>${hello}</small><h2>${esc(famT[0])}<span class="ink">${FAMILY}</span>${esc(famT[1])}</h2></div>
      ${members && members.length ? `<div class="fwho">${members.map(m => `<span translate="no"><i>${esc(m.name[0].toUpperCase())}</i>${esc(m.name.split(/\s+/)[0])}</span>`).join('')}</div>` : ''}</div>`;
  }

  function paintSigninCard() {
    const c = $('signin'), st = state || {};
    const what = st.error || !st.storage || st.user ? null : invite ? ['Join the family', 'You\'ve been invited: make your account with Face ID.'] : !st.setup ? ['Set up your family account', 'Once, by the owner, with the owner code.'] : ['Sign in', 'Face ID signs you in to every app.'];
    const off = !what && st.plan && !planLive(st.plan) ? ['Your apps are off', `The family's ${st.plan.id === 'trial' ? 'trial' : 'plan'} ended on ${onDay(st.plan.ends)}. ${st.user && st.user.role === 'owner' ? 'Choose a plan to turn them back on.' : 'The owner can choose a plan.'}`] : null;
    c.hidden = !what && !off;
    c.innerHTML = what ? `<div class="signin" role="button" tabindex="0" data-signin-card><span class="avatar">${STAR}</span><span><b>${what[0]}</b><i>${what[1]}</i></span><span class="chev">›</span></div>`
      : off ? `<div class="signin" role="button" tabindex="0" data-plan-card><span class="avatar">${STAR}</span><span><b>${off[0]}</b><i>${esc(off[1])}</i></span><span class="chev">›</span></div>` : '';
  }
  const STAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z"/></svg>';

  async function paintAccount(box) {
    const st = await getState(); paintSigninCard(); paintAvatars();
    if (!box.isConnected) return;
    if (st.error) { box.innerHTML = `<div><p>Accounts can\'t be reached right now (${esc(st.error === 'network' ? 'no connection' : 'error ' + st.error)}${/\.pages\.dev$/.test(location.hostname) ? '' : ', ' + esc(location.hostname)}).</p></div>`; return; }
    if (!st.storage) { box.innerHTML = '<div><h3>Family accounts</h3><p>Not switched on yet.</p></div>'; return; }
    if (!st.user && ACC.token()) ACC.signOut();   // removed from the family, or a stale session
    if (st.user) return paintSignedIn(box, st.user);
    if (invite) {
      box.innerHTML = `<div><h3>Join the family</h3><p>Make your account with Face ID.</p>
        <input id="aName" placeholder="Your name" autocomplete="given-name" maxlength="40"><button type="button" class="go" id="aGo">Create my account</button><div class="err" id="aErr"></div></div>`;
      $('aGo').onclick = async () => {
        busy($('aGo'), true);
        try {
          await ACC.signUp({ name: $('aName').value.trim(), invite });
          history.replaceState(null, '', location.pathname);
          try { sessionStorage.removeItem('aos.later.aos'); } catch {}
          await paintAccount(box);
          if ((iphone || android) && !standalone) W.playInstall('aos');   // next: aOS on the Home Screen (Android: Chrome's Install)
        } catch (e) { $('aErr').textContent = why(e); busy($('aGo'), false); }
      };
      return;
    }
    if (!st.setup) {
      box.innerHTML = `<div><h3>Set up your family account</h3><p>Enter the owner code and your name.</p>
        <input id="aCode" placeholder="Owner code" autocapitalize="characters" autocomplete="off" spellcheck="false">
        <input id="aName" placeholder="Your name" autocomplete="given-name" maxlength="40"><button type="button" class="go" id="aGo">Create the owner account</button><div class="err" id="aErr"></div></div>`;
      $('aGo').onclick = async () => {
        busy($('aGo'), true);
        try { await ACC.signUp({ name: $('aName').value.trim(), code: $('aCode').value }); await paintAccount(box); }
        catch (e) { $('aErr').textContent = why(e); busy($('aGo'), false); }
      };
      return;
    }
    box.innerHTML = `<div><h3>Sign in</h3><button type="button" class="go" id="aGo">Continue with Face ID</button><div class="err" id="aErr"></div>
      <p class="note">New here? Ask the owner for an invite link.</p></div>`;
    $('aGo').onclick = async () => {
      busy($('aGo'), true);
      try { await ACC.signIn(); await paintAccount(box); } catch (e) { $('aErr').textContent = why(e); busy($('aGo'), false); }
    };
  }

  async function paintSignedIn(box, u) {
    box.innerHTML = `<div class="me"><span class="avatar">${esc(u.name[0].toUpperCase())}</span><span style="flex:1"><b translate="no">${esc(u.name)}</b> <small class="muted">${u.role === 'owner' ? 'Owner' : 'Family'}</small></span>
      <button type="button" class="soft" id="aOut">Sign out</button></div>`;
    $('aOut').onclick = () => { ACC.signOut(); paintAccount(box); };
    box.insertAdjacentHTML('beforeend', fold('fLost', 'Lost a phone?', 'Sign out everywhere else, erase a lost phone', `
      <button type="button" class="soft" id="aOthers">Sign out everywhere else</button><div class="err" id="oErr"></div>
      <button type="button" class="soft" data-lost>Erase a lost phone, step by step</button>`));
    $('aOthers').onclick = async () => {
      if (!confirm(tx('Sign out everywhere else, including the other apps on this phone?'))) return;
      busy($('aOthers'), true); const m = $('oErr'); m.textContent = ''; m.style.color = '';
      try { await ACC.signOutOthers(); m.style.color = 'var(--muted)'; m.textContent = 'Done: everywhere else is signed out.'; }
      catch (e) { m.textContent = why(e); }
      busy($('aOthers'), false);
    };
    // your settings follow you to your other devices by themselves (aOS/prefs-sync.js); this carries the rest
    // (Home's Home Assistant sign-in, Ipsy's chats, every app's own settings) to a phone or aOS icon that replaces this one
    box.insertAdjacentHTML('beforeend', fold('fMove', 'Replacing this phone?', 'Bring everything to a new phone or aOS icon', `
      <p>Your settings already follow you to your other devices. To replace this phone or this aOS icon (or rename aOS), get ready here, then open the new aOS icon and sign in: everything else comes too, like Home's Home Assistant sign-in and Ipsy's chats.</p>
      <button type="button" class="soft" id="mGo">Get ready to move</button><div class="err" id="mErr"></div>`));
    $('mGo').onclick = async () => {
      busy($('mGo'), true); const m = $('mErr'); m.textContent = ''; m.style.color = '';
      try { await moveOut(); m.style.color = 'var(--muted)'; m.innerHTML = 'Ready for two days. Now open your other <b>aOS</b> icon and sign in (or add one: <b>tomallison24-news.pages.dev/aOS</b> in Safari, Share, <b>Add to Home Screen</b>). Once everything is there, press and hold this icon, <b>Remove App</b>.'; }
      catch (e) { m.textContent = e.message === 'too-big' ? 'Too much to move in one go.' : why(e); }
      busy($('mGo'), false);
    };
    box.insertAdjacentHTML('beforeend', fold('fNotify', 'Notifications', 'Updates and family news', '<div id="nBox"></div>', 'nSub'));
    paintNotify();
    if (u.role !== 'owner') return;
    // the owner's tools, folded away until wanted
    box.insertAdjacentHTML('beforeend', `<button type="button" class="tools" id="tToggle" data-fold aria-expanded="false" aria-controls="tTools"><span><b>Owner tools</b><small>Notifications, Home Assistant, invites, Sheets, the family</small></span><i aria-hidden="true">›</i></button>
      <div class="fbody" id="tTools" hidden><div id="tSend"><h3>Send a notification</h3>
      <input id="nTitle" placeholder="Title" maxlength="60"><textarea id="nBody" placeholder="Message" maxlength="240" rows="3"></textarea>
      <div class="row2"><button type="button" class="soft" id="nFill">Announce update</button><button type="button" class="go" id="nGo">Send</button></div><div class="err" id="nErr"></div><p class="note" id="nWho"></p></div>
      <div id="tHome"><h3>Home Assistant address</h3><p>From Home Assistant: Settings → Home Assistant Cloud.</p>
      <input id="hAddr" type="url" inputmode="url" placeholder="https://xxxxxxxx.ui.nabu.casa" autocapitalize="off" autocomplete="off" spellcheck="false"><button type="button" class="go" id="hSave">Save</button><div class="err" id="hErr"></div></div>
      <div id="tInvite"><h3>Invite someone</h3><p>Good once, for 24 hours.</p>
      <input id="iName" placeholder="Their name" maxlength="40"><button type="button" class="go" id="iGo">Make an invite link</button><div class="err" id="iErr"></div><div id="iOut"></div></div>
      <div><h3>Google Sheets</h3><p>Paste the new script into each Sheet first (aOS/SHEETS.md).</p>
      <div class="fam sheets" id="shList"><p class="note">Checking…</p></div></div>
      <div><h3>Your family</h3><div class="fam" id="fam"></div></div></div>`);
    $('iGo').onclick = async () => {
      busy($('iGo'), true); $('iErr').textContent = '';
      try { showInvite(await ACC.call('invite', { name: $('iName').value.trim() })); $('iName').value = ''; }
      catch (e) { $('iErr').textContent = why(e); }
      busy($('iGo'), false);
    };
    paintFamily();
    paintSheets();
    paintComposer();
    ACC.call('home').then(r => { if (r.address && !$('hAddr').value) $('hAddr').value = r.address; }).catch(() => {});
    $('hSave').onclick = async () => {
      busy($('hSave'), true); const m = $('hErr'); m.textContent = ''; m.style.color = '';
      try { const r = await ACC.call('home', { address: $('hAddr').value.trim() }); $('hAddr').value = r.address || ''; m.style.color = 'var(--muted)'; m.textContent = r.address ? 'Saved.' : 'Cleared.'; }
      catch (e) { m.textContent = e.message === 'address' ? 'Use the https address, like https://xxxxxxxx.ui.nabu.casa.' : why(e); }
      busy($('hSave'), false);
    };
  }

  // ---- moving to another aOS icon (functions/aOS/api, move) ----
  // Each aOS icon on the Home Screen keeps its own storage, and it goes when the icon is removed. So
  // to switch to another aOS icon (one added earlier, a new one to rename aOS, or a new phone), Get
  // ready to move leaves everything aOS keeps here (every app's, since they all share aOS's storage)
  // in your family account for two days, and the next aOS icon of yours to open, signed in, takes it
  // and opens again with it; what it brings wins over what that icon had. Left behind: this icon's
  // sign-in (the other signs in itself), Gmail's (an hour long) and what comes back anyway (caches).
  // aos.move: when this icon left it; it doesn't take its own back while that's waiting. Only an
  // icon on the Home Screen takes it, never Safari (where a new icon is added from).
  const MOVE = 'aos.move', MOVE_MAX = 4.5 * 1024 * 1024, MOVE_WAIT = 2 * 864e5;
  const MOVE_SKIP = ['aos.session', MOVE, MOVE + '.in', 'mail.token', 'mail.state', 'mail.lastAuth', 'mail.pending', 'news.data', 'news.table.cache', 'news.sport.catalog', 'wx.cache', 'wx.pt'];
  const idbReq = r => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  async function idbOut(room) {   // every database's rows that are plain data (not files), up to `room`
    const out = [];
    if (!window.indexedDB || !indexedDB.databases) return out;
    for (const { name, version } of await indexedDB.databases().catch(() => [])) {
      if (!name) continue;
      let d; try { d = await idbReq(indexedDB.open(name)); } catch { continue; }
      const stores = [];
      for (const sn of d.objectStoreNames) {
        try {
          const t = d.transaction(sn, 'readonly'), st = t.objectStore(sn);
          const [keys, vals] = await Promise.all([idbReq(st.getAllKeys()), idbReq(st.getAll())]);
          const rows = [];
          keys.forEach((k, i) => {
            const v = vals[i]; if (v instanceof Blob || v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return;
            let j; try { j = JSON.stringify([k, v]); } catch { return; }
            if (!j || j.length > room) return; room -= j.length; rows.push([k, v]);
          });
          stores.push({ name: sn, keyPath: st.keyPath, auto: st.autoIncrement, rows });
        } catch {}
      }
      d.close(); out.push({ name, version: version || d.version, stores });
    }
    return out;
  }
  async function idbIn(list) {
    for (const db of list || []) {
      try {
        const r = indexedDB.open(db.name, db.version);
        r.onupgradeneeded = () => { for (const s of db.stores) if (!r.result.objectStoreNames.contains(s.name)) r.result.createObjectStore(s.name, s.keyPath ? { keyPath: s.keyPath, autoIncrement: s.auto } : { autoIncrement: s.auto }); };
        const d = await idbReq(r);
        for (const s of db.stores) {
          if (!d.objectStoreNames.contains(s.name) || !s.rows.length) continue;
          const t = d.transaction(s.name, 'readwrite'), st = t.objectStore(s.name);
          for (const [k, v] of s.rows) st.put(v, s.keyPath ? undefined : k);
          await new Promise(ok => { t.oncomplete = t.onerror = t.onabort = () => ok(); });
        }
        d.close();
      } catch {}
    }
  }
  async function moveOut() {
    const ls = {}; let size = 0;
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (MOVE_SKIP.includes(k)) continue; const v = localStorage.getItem(k); ls[k] = v; size += k.length + v.length + 6; }
    if (size > MOVE_MAX) throw new Error('too-big');
    await ACC.call('move', { data: { ls, idb: await idbOut(MOVE_MAX - size) } });
    try { localStorage.setItem(MOVE, String(Date.now())); } catch {}
  }
  let moving = false;
  async function moveIn() {
    if (moving || !ACC || !ACC.token()) return;
    if (!(navigator.standalone === true || matchMedia('(display-mode: standalone)').matches)) return;   // only the icon on the Home Screen: Safari, where you add it from, would keep it to itself
    try {
      if (Date.now() - (+localStorage.getItem(MOVE) || 0) < MOVE_WAIT) return;   // this icon left it
      if (Date.now() - (+localStorage.getItem(MOVE + '.in') || 0) < 5 * 60e3) return;   // it just came in (the account may still show it for a moment)
    } catch { return; }
    moving = true;
    try {
      const { data } = await ACC.call('move/take', {});
      if (!data) return;
      await idbIn(data.idb);
      for (const [k, v] of Object.entries(data.ls || {})) if (!MOVE_SKIP.includes(k) && typeof v === 'string') try { localStorage.setItem(k, v); } catch {}
      try { localStorage.setItem(MOVE + '.in', String(Date.now())); sessionStorage.setItem('aos.moved.in', '1'); } catch {}
      location.reload();
    } catch {} finally { moving = false; }
  }
  addEventListener('aos:account', e => { if (e.detail) moveIn(); });
  moveIn();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) moveIn(); });   // left from the other icon a moment ago
  try { if (sessionStorage.getItem('aos.moved.in')) { sessionStorage.removeItem('aos.moved.in'); setTimeout(() => { const t = $('htoast'); if (t) { t.textContent = 'Everything moved in from your other aOS icon'; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 3500); } }, 600); } } catch {}

  // ---- notifications: Web Push from the owner (server/push.js; aOS/sw.js shows them) ----
  // On iPhone they only work for an app opened from the Home Screen (iOS 16.4 or later),
  // and the permission can only be asked for from a tap.
  const pushOK = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const keyBytes = k => { const t = k.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(t + '='.repeat((4 - t.length % 4) % 4)), c => c.charCodeAt(0)); };
  const thisPhone = async () => { const reg = await navigator.serviceWorker.ready; return { reg, sub: await reg.pushManager.getSubscription() }; };
  async function paintNotify(msg) {
    const box = $('nBox'); if (!box) return;
    let on = false, sub = null;
    if (pushOK() && Notification.permission === 'granted') { try { sub = (await thisPhone()).sub; on = !!sub; } catch {} }
    if (!$('nBox')) return;
    let html;
    if (!pushOK()) html = `<p>${iphone && !standalone ? 'Add aOS to your Home Screen to turn these on.' : 'This browser can\'t show notifications from aOS.'}</p>`;
    else if (Notification.permission === 'denied') html = `<p>Blocked: allow them in ${iphone ? 'Settings → Notifications → aOS' : 'this browser\'s site settings'}.</p>`;
    else if (on) html = '<p>On: you hear when aOS is updated, and when the family has news.</p><button type="button" class="soft" id="nOff">Turn off</button>';
    else html = '<p>Hear when aOS is updated, and when the family has news.</p><button type="button" class="go" id="nOn">Turn on notifications</button>';
    box.innerHTML = `<div>${html}<div class="err" id="nMsg"></div></div>`;
    if ($('nSub')) $('nSub').textContent = !pushOK() ? 'Not on this phone' : Notification.permission === 'denied' ? 'Blocked' : on ? 'On' : 'Off';   // on its fold, under Account
    if (msg) { const m = $('nMsg'); m.style.color = msg.err ? '' : 'var(--muted)'; m.textContent = msg.t; }
    if ($('nOn')) $('nOn').onclick = turnOn;
    if ($('nOff')) $('nOff').onclick = async () => {
      busy($('nOff'), true);
      try { const { sub: s } = await thisPhone(); if (s) { const ep = s.endpoint; await s.unsubscribe(); await ACC.call('push/unsubscribe', { endpoint: ep }); } paintNotify({ t: 'Off for this phone.' }); }
      catch (e) { paintNotify({ err: 1, t: why(e) }); }
    };
  }
  async function turnOn() {
    busy($('nOn'), true);
    try {
      const perm = await Notification.requestPermission();   // from the tap
      if (perm !== 'granted') return paintNotify({ err: 1, t: perm === 'denied' ? 'Blocked. You can allow it in Settings.' : 'Not turned on.' });
      const { reg, sub: had } = await thisPhone();
      const { key } = await ACC.call('push');
      if (!key) throw new Error('storage');
      const sub = had || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
      await ACC.call('push/subscribe', { subscription: sub.toJSON() });
      paintNotify();
    } catch (e) { paintNotify({ err: 1, t: e && e.message === 'subscription' ? 'This phone\'s notification service isn\'t supported.' : why(e) }); }
  }
  // A phone's address can change, and someone else may sign in on it: say again, quietly,
  // at most twice a day (the server writes only if something changed).
  async function syncPush() {
    try {
      if (!pushOK() || Notification.permission !== 'granted' || !ACC.user()) return;
      if (Date.now() - (+localStorage.getItem('aos.pushsync') || 0) < 12 * 36e5) return;
      const { sub } = await thisPhone(); if (!sub) return;
      await ACC.call('push/subscribe', { subscription: sub.toJSON() });
      localStorage.setItem('aos.pushsync', String(Date.now()));
    } catch {}
  }
  // the owner's side: who will get it, and one person at a time (a request only encrypts for a few phones)
  let audience = [], announce = false;
  async function paintComposer() {
    if (!$('nWho')) return;
    try { audience = (await ACC.call('push/audience')).people; } catch { audience = []; }
    if (!$('nWho')) return;
    const phones = audience.reduce((a, p) => a + p.devices, 0);
    $('nWho').textContent = audience.length ? `Goes to ${audience.map(p => p.name.split(/\s+/)[0]).join(', ')} (${phones} ${phones === 1 ? 'phone' : 'phones'}).` : 'No one has turned notifications on yet.';
    $('nFill').onclick = () => {
      $('nTitle').value = `aOS updated to ${live[0].v}`; $('nBody').value = 'Click for update details.';
      announce = true;   // a tap on it opens the Updates screen
    };
    $('nTitle').oninput = () => { announce = false; };
    $('nGo').onclick = async () => {
      const m = $('nErr'); m.style.color = ''; m.textContent = '';
      const title = $('nTitle').value.trim(), body = $('nBody').value.trim();
      if (!title) { m.textContent = 'Give it a title.'; return; }
      if (!audience.length) { m.textContent = 'No one has notifications on yet.'; return; }
      if (!confirm(tx(`Send "${title}" to ${audience.length} ${audience.length === 1 ? 'person' : 'people'}?`))) return;
      busy($('nGo'), true);
      let sent = 0, failed = 0;
      try {
        for (const p of audience) {
          m.style.color = 'var(--muted)'; m.textContent = `Sending to ${p.name.split(/\s+/)[0]}…`;
          const r = await ACC.call('push/send', { to: p.id, title, body, url: announce ? './#whats-new' : './' });
          sent += r.sent; failed += r.failed + r.gone;
        }
        m.style.color = 'var(--muted)'; m.textContent = `Sent to ${sent} ${sent === 1 ? 'phone' : 'phones'}${failed ? `; ${failed} didn't take it` : ''}.`;
        $('nTitle').value = ''; $('nBody').value = ''; announce = false;
      } catch (e) { m.style.color = ''; m.textContent = `Stopped after ${sent} ${sent === 1 ? 'phone' : 'phones'}: ${why(e)}`; }
      busy($('nGo'), false); paintComposer();
    };
  }

  // An invite link, to share or copy, for someone new.
  function showInvite(r) {
    const link = new URL('./#invite=' + r.token, location.href).href;
    $('iOut').innerHTML = `<div class="link" translate="no">${esc(link)}</div><div class="row2"><button type="button" class="go" id="iShare">Share</button><button type="button" class="soft" id="iCopy">Copy</button></div>`;
    $('iShare').onclick = () => navigator.share ? navigator.share({ title: 'Join AllisonOS', text: r.name + ', here is your AllisonOS invite. Open it in Safari on iPhone, or Chrome on Android.', url: link }).catch(() => {}) : $('iCopy').click();
    $('iCopy').onclick = async () => { try { await navigator.clipboard.writeText(link); $('iCopy').textContent = 'Copied'; } catch { $('iCopy').textContent = 'Press and hold the link'; } };
  }
  // ---- the family's Google Sheets (functions/sheet/api; aOS/SHEETS.md) ----
  // Each app's Apps Script link and secret phrase, kept by aOS, so the phones don't hold them.
  const SHEET_APPS = [['fitness', 'Fitness'], ['drinks', 'Drinks'], ['notes', 'Notes and Places'], ['travel', 'Travel'], ['orders', 'Orders'], ['meals', 'Meals'], ['podcasts', 'Podcasts']];
  const SHEET_WHY = { 'wrong-secret': 'That phrase doesn\'t match the script\'s SECRET.', 'short-secret': 'Use a phrase of at least 16 characters (the script\'s SECRET: a long random one is best).', 'old-script': 'That Sheet is still on the old script: paste the new one in and deploy a new version.',
    'wrong-app': 'That link is another app\'s Sheet.', url: 'Use the web app link: https://script.google.com/…/exec.', secret: 'Enter the secret phrase.', 'not-json': 'That link didn\'t answer like a Sheet script.', 'sheet-unreachable': 'Couldn\'t reach the Sheet.' };
  const sheetCall = async (path, body) => {
    const r = await fetch('../sheet/api/' + path, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { 'X-Sheet': '1', 'Content-Type': 'application/json', Authorization: 'Bearer ' + (ACC.token() || '') }, body: body ? JSON.stringify(body) : undefined });
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) throw new Error(j.error || 'http-' + r.status);
    return j;
  };
  async function paintSheets() {
    const box = $('shList'); if (!box) return;
    const st = await Promise.all(SHEET_APPS.map(([id]) => sheetCall(id).catch(e => ({ error: e.message }))));
    if (!$('shList')) return;
    box.innerHTML = SHEET_APPS.map(([id, name], i) => `<div data-sheet="${id}"><span>${esc(name)}<small>${st[i].error ? 'Can\'t check' : st[i].configured ? 'Connected' : 'Not set up'}</small></span><button type="button" class="again" data-shopen="${id}">${st[i].configured ? 'Change' : 'Set up'}</button></div>
      <div class="shform" data-shform="${id}" hidden><input data-shurl="${id}" type="url" inputmode="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(st[i].url || '')}" autocapitalize="off" autocomplete="off" spellcheck="false">
        <input data-shkey="${id}" type="password" placeholder="Its secret phrase (SECRET in the script)" autocapitalize="off" autocomplete="off" spellcheck="false">
        <button type="button" class="go" data-shsave="${id}">Save</button><div class="err" data-sherr="${id}"></div></div>`).join('');
    box.onclick = async e => {
      let b;
      if ((b = e.target.closest('[data-shopen]'))) { const f = box.querySelector(`[data-shform="${b.dataset.shopen}"]`); f.hidden = !f.hidden; return; }
      if ((b = e.target.closest('[data-shsave]'))) {
        const id = b.dataset.shsave, m = box.querySelector(`[data-sherr="${id}"]`);
        busy(b, true); m.textContent = ''; m.style.color = '';
        try {
          await sheetCall(id + '/config', { url: box.querySelector(`[data-shurl="${id}"]`).value.trim(), secret: box.querySelector(`[data-shkey="${id}"]`).value });
          m.style.color = 'var(--muted)'; m.textContent = 'Connected.';
          setTimeout(paintSheets, 1500);
        } catch (x) { m.textContent = SHEET_WHY[x.message] || 'Couldn\'t connect (' + x.message + ').'; }
        busy(b, false);
      }
    };
  }

  async function paintFamily() {
    let f; try { f = (await ACC.call('family')).family; } catch { return; }
    if (!$('fam')) return;
    // Remove takes someone out completely (functions/aOS/api, forget): there's no inviting them back
    // as they were. Anyone removed before that (signed out, their data kept) shows Signed out, to remove for good.
    $('fam').innerHTML = f.map(m => `<div${m.removed ? ' class="gone"' : ''}><span><span translate="no">${esc(m.name)}</span><small>${m.role === 'owner' ? 'Owner' : m.removed ? 'Signed out' : 'Family'}</small></span>${m.role === 'owner' ? ''
      : `<button type="button" data-rm="${esc(m.id)}">Remove</button>`}</div>`).join('');
    $('fam').onclick = async e => {
      const b = e.target.closest('[data-rm]'); if (!b) return;
      const name = b.parentElement.querySelector('span').firstChild.textContent;
      if (!confirm(tx(`Remove ${name} from the family? They're signed out of every app, and their account and everything aOS keeps for them is deleted. This can't be undone.`))) return;
      try { await ACC.call('remove', { id: b.dataset.rm }); } catch {}
      paintFamily();
    };
  }


  // ---- taps ----
  document.addEventListener('click', ev => {
    if (ev.target.closest('[data-go]')) { watch(); return; }    // the design sheet's button: the link opens the app's own address
    const gt = ev.target.closest('[data-get]');
    if (gt) {   // Get: the link opens the app's own address, which shows how to add it - after a design is picked, for an app that has them
      const base = baseOf(gt.dataset.get);
      if (base && !INST.has(gt.dataset.get)) { ev.preventDefault(); ev.stopPropagation(); designSheet(base); return; }
      watch(); return;
    }
    const a = ev.target.closest('[data-app]'); if (a) return appPage(a.dataset.app);
    const s = ev.target.closest('[data-story]'); if (s) return storyPage(+s.dataset.story);
    if (ev.target.closest('[data-signin-card]')) return acctPage();
    if (ev.target.closest('[data-plan-card]')) return acctPage('plan');
    if (ev.target.closest('[data-acct]')) return acctPage();
    if (ev.target.closest('[data-lost]')) return lostPage();
  });

  // ✓ Installed as soon as it's true: iOS doesn't tell a page it was added to the Home
  // Screen, but the new app reports itself the first time it's opened from there
  // (home/welcome.js). So check again whenever aOS comes back to the front, and every
  // few seconds for three minutes after a Get, without needing aOS closed and reopened.
  let lastCheck = 0, watchUntil = 0, watcher = null;
  const recheck = () => { if (document.visibilityState !== 'visible' || Date.now() - lastCheck < 2000) return; lastCheck = Date.now(); getState().then(() => paintSigninCard()); };
  function watch() {
    watchUntil = Date.now() + 180e3;
    if (!watcher) watcher = setInterval(() => { if (Date.now() > watchUntil) { clearInterval(watcher); watcher = null; return; } recheck(); }, 6000);
  }
  document.addEventListener('visibilitychange', recheck);
  addEventListener('focus', recheck);
  addEventListener('pageshow', e => { if (e.persisted) recheck(); });

  getState().then(st => {
    lastCheck = Date.now();
    paintSigninCard(); paintAvatars();
    if (st.user) syncPush();
    if (location.hash === '#whats-new' || location.hash === '#subscription') { const at = location.hash === '#whats-new' ? 'updates' : 'plan'; history.replaceState(null, '', location.pathname); acctPage(at); }
    else if (location.hash === '#lost-phone') { history.replaceState(null, '', location.pathname); lostPage(); }
    else if (invite || (st.storage && !st.setup && !st.error)) acctPage();
  });
  // a tap on a notification while aOS is already open (aOS/sw.js)
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.aosGo === '#whats-new') { const w = $('whats-new'); if (w) { unfold(w, true); w.scrollIntoView({ block: 'start' }); } else acctPage('updates'); }
  });
  addEventListener('hashchange', () => { if (location.hash === '#whats-new' || location.hash === '#subscription') { const at = location.hash === '#whats-new' ? 'updates' : 'plan'; history.replaceState(null, '', location.pathname); acctPage(at); } });
})();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
