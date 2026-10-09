// aOS's own script, moved out of index.html so the page's
// Content-Security-Policy can allow only this site's own files (script-src 'self').
'use strict';
(() => {
  const W = AllisonOS.welcome, D = W.data, ACC = AllisonOS.account, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const line = k => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${W.lines[k] || W.lines.sparkle}</svg>`;
  const icon = id => `../${id}/icon-512.png`;
  const appUrl = id => new URL(`../${id}/`, location.href).href + '?via=aos';
  const T = id => D.TOURS[id] || { tag: '', cards: [] };
  const v = D.shown(), live = D.RELEASES.filter(r => !r.silent);
  const HUE = { mail: '240,120,200', calendar: '255,84,112', news: '110,140,255', weather: '70,150,255', notes: '40,200,170', podcasts: '190,90,240', travel: '255,150,60', places: '70,200,120', fitness: '140,155,180', drinks: '176,72,120', house: '125,105,245' };
  const CAT = { mail: 'Productivity', calendar: 'Productivity', news: 'News', weather: 'Weather', notes: 'Productivity', podcasts: 'Entertainment', travel: 'Travel', places: 'Travel', fitness: 'Health & Fitness', drinks: 'Health & Fitness', house: 'Lifestyle' };
  const SHARED = ['calendar', 'travel', 'notes', 'places'];
  // what each app needs from a new person today: ok = nothing to do, once = a one-time step
  const NEEDS = {
    mail: [['once', 'Sign in with your own Google account']],
    calendar: [['ok', 'Your family account (Face ID)']],
    news: [['ok', 'Nothing']],
    weather: [['ok', 'Your location, if you allow it']],
    notes: [['once', 'The family Google Sheet, to share notes (optional)']],
    podcasts: [['ok', 'Nothing']],
    travel: [['ok', 'Your family account (Face ID)'], ['once', 'Your Google account, to find trips in Gmail (optional)']],
    places: [['once', 'The family Google Sheet, to share lists (optional)']],
    fitness: [['once', 'Your own Google Sheet, as a backup (optional)']],
    drinks: [['ok', 'Your family account (Face ID), so your log is kept, private to you']],
    house: [['ok', 'Your family\'s Home Assistant address, filled in'], ['once', 'Your own Home Assistant token']],
  };
  // ✓ Installed: an app opened from your Home Screen in the last 90 days, signed in
  // (home/welcome.js reports it); a tap still offers the install steps, in case it's gone
  let INST = new Set();
  const getBtn = id => `<a class="get${INST.has(id) ? ' done' : ''}" data-get="${id}" href="${appUrl(id)}" target="_blank" rel="noopener">${INST.has(id) ? 'Installed' : 'Get'}</a>`;
  const paintGets = () => document.querySelectorAll('[data-get]').forEach(b => { const on = INST.has(b.dataset.get); b.classList.toggle('done', on); b.textContent = on ? 'Installed' : 'Get'; });
  const learnInstalled = st => { const a = (st && st.user && st.user.apps) || {}; INST = new Set(Object.keys(a).filter(k => Date.now() - a[k] < 90 * 864e5)); paintGets(); };
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
  $('date').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const day = Math.floor(Date.now() / 864e5), aotd = D.APPS[day % D.APPS.length];
  const STORIES = [
    { id: 'house', k: 'Get started', h: 'Set up Home in two minutes', art: 'house', body: () => `
      <p>Home shows your whole house: heating, lights, cameras and more, from your family's Home Assistant.</p>
      <h3>1. The address fills itself in</h3><p>Signed in to your family account, Home already knows where your house is. Nothing to type.</p>
      <h3>2. Make your own token</h3><p>In the Home Assistant app: <b>☰</b> → <b>your name</b> at the bottom → <b>Security</b> → <b>Long-lived access tokens</b> → <b>Create token</b>. Name it <b>AllisonOS</b> and your name, and tap <b>Copy</b> straight away: it's only shown once.</p>
      <p class="muted">Home shows these steps animated, the first time you open it.</p>
      <h3>3. Paste and connect</h3><p>Open Home, tap the gear, paste the token, tap <b>Connect</b>, and choose a PIN.</p>` },
    { id: aotd, k: 'App of the day', h: `${D.NAMES[aotd]}: ${T(aotd).tag}`, art: (T(aotd).cards[0] || {}).i, body: () => T(aotd).cards.map(c => `<h3>${esc(c.t)}</h3><p>${esc(c.d)}</p>`).join('') },
    { k: 'What\'s new', h: `The Power of ${mk(v)}`, plain: true, body: () => { const r = live[0]; return `<p>${esc(r.title || '')}</p><ol>${[...(r.highlights || []), ...(r.notes || [])].map(n => `<li>${esc(n)}</li>`).join('')}</ol>`; } },
    { id: 'travel', k: 'Meet', h: 'Every trip, the whole family\'s', art: 'plane', body: () => T('travel').cards.map(c => `<h3>${esc(c.t)}</h3><p>${esc(c.d)}</p>`).join('') },
    { id: 'calendar', k: 'Your family', h: 'One Face ID, every app', art: 'people', body: () => `
      <p>Your family account is a passkey in your iCloud Keychain. Every AllisonOS app signs in with one Face ID tap, even though each keeps its own storage.</p>
      <h3>Private to your family</h3><p>Calendar and Travel only answer people signed in to the family. Removing someone signs them out of every app straight away.</p>
      <h3>Invite someone</h3><p>Under your account (top right): a link for one person, good once for 24 hours.</p>` },
  ];
  const SHAPE = ['', 'half', 'half', 'wide', ''];
  $('stories').innerHTML = STORIES.map((s, i) => s.plain
    ? `<div class="story plain ${SHAPE[i]}" role="button" tabindex="0" data-story="${i}"><div class="art"></div><div class="txt"><span class="chip">${esc(s.k)}</span><h2 id="power">${s.h}</h2></div><div class="mk ink" id="mark">${mk(v)}</div></div>`
    : `<div class="story ${SHAPE[i]}" role="button" tabindex="0" data-story="${i}" style="--c:${HUE[s.id]}"><div class="art">${line(s.art)}<img src="${icon(s.id)}" alt=""></div>
       <div class="txt"><span class="chip">${esc(s.k)}</span><h2>${esc(s.h)}</h2></div>
       <div class="foot"><img src="${icon(s.id)}" alt=""><span><b>${esc(D.NAMES[s.id])}</b><i>${esc(T(s.id).tag)}</i></span>${getBtn(s.id)}</div></div>`).join('');

  // ---- Apps, and Search ----
  const rows = ids => ids.map(id => `<div class="row" role="button" tabindex="0" data-app="${id}" style="--c:${HUE[id]}"><img src="${icon(id)}" alt=""><span class="t"><span><b>${esc(D.NAMES[id])}</b><i>${sub(id)}</i></span>${getBtn(id)}</span></div>`).join('');
  $('list').innerHTML = `<div class="sec"><h2>Curated for the Allison family</h2></div>${rows(D.APPS)}`;
  const find = () => { const q = $('q').value.trim().toLowerCase(); const hit = id => !q || [D.NAMES[id], T(id).tag, CAT[id], ...T(id).cards.map(c => c.t + ' ' + c.d)].join(' ').toLowerCase().includes(q); const ids = D.APPS.filter(hit); $('found').innerHTML = ids.length ? rows(ids) : '<p class="muted">No apps match.</p>'; };
  $('q').oninput = find; find();

  // ---- tabs ----
  const tabs = document.querySelectorAll('[data-tab]');
  const show = t => { for (const s of ['today', 'apps', 'search']) $(s).hidden = s !== t; document.querySelector('.tabs').style.setProperty('--i', ['today', 'apps', 'search'].indexOf(t)); tabs.forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t))); scrollTo(0, 0); if (t === 'search') setTimeout(() => $('q').focus(), 50); };
  tabs.forEach(b => b.onclick = () => show(b.dataset.tab));

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
    const hist = live.filter(x => { const y = D.entry((x.apps || {})[id]); return y.highlights.length + y.notes.length; });
    page(`<div class="apphead"><img src="${icon(id)}" alt=""><div><h1>${esc(D.NAMES[id])}</h1><p>${esc(T(id).tag)}</p>${getBtn(id)}</div></div>
      <div class="strip">
        <div><b class="ink">${mk(v)}</b><small>Latest</small></div>
        <div>${line((T(id).cards[0] || {}).i)}<i>${esc(CAT[id])}</i></div>
        <div>${line(SHARED.includes(id) ? 'people' : 'lock')}<i>${SHARED.includes(id) ? 'Shared with family' : 'Just you'}</i></div>
        <div>${line('sparkle')}<i>Allison Corporation</i></div>
      </div>
      <div class="sec"><h2>What's New</h2>${hist.length > 1 ? '<button type="button" data-hist>Version History</button>' : ''}</div>
      <div class="wn"><small>${mk(r ? r.v : v)} · ${esc((r || live[live.length - 1]).date || '')}</small>${e ? `<ul>${[...e.highlights, ...e.notes].map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : `<p>Part of ${mk(v)}: ${esc(live[live.length - 1].title)}.</p>`}</div>
      <div class="sec"><h2>Preview</h2></div>
      <div class="shots">${T(id).cards.map(c => `<div class="shot">${line(c.i)}<b>${esc(c.t)}</b><p>${esc(c.d)}</p></div>`).join('')}</div>
      <div class="sec"><h2>What it needs</h2></div>
      ${(NEEDS[id] || []).map(([k, t]) => `<div class="need"><span>${esc(t)}</span><em class="${k}">${k === 'ok' ? 'Ready' : 'Once'}</em></div>`).join('')}
      <div class="sec"><h2>About</h2></div>
      <div class="desc">${T(id).cards.map(c => `<p><b>${esc(c.t)}.</b> <span class="muted">${esc(c.d)}</span></p>`).join('')}</div>
      <div class="sec"><h2>Information</h2></div>
      <div class="info"><div><span>Provider</span><span>Allison Corporation</span></div><div><span>Category</span><span>${esc(CAT[id])}</span></div><div><span>Compatibility</span><span>iOS &amp; Android</span></div><div><span>Languages</span><span>English</span></div><div><span>Price</span><span>Free</span></div></div>`, { c: HUE[id] })
      .addEventListener('click', ev => { if (ev.target.closest('[data-hist]')) histPage(id, hist); });
  }
  function histPage(id, hist) {
    page(`<h1 style="margin:0 0 10px;font-size:30px">Version History</h1>${hist.map(x => { const y = D.entry(x.apps[id]); return `<div class="group"><div class="rel"><h4>${mk(x.v)}</h4><small>${esc(x.date || '')}</small><ul>${[...y.highlights, ...y.notes].map(n => `<li>${esc(n)}</li>`).join('')}</ul></div></div>`; }).join('')}`);
  }
  function storyPage(i) {
    const s = STORIES[i];
    page(`<div class="hero" style="${s.plain ? 'color:var(--text)' : ''}"><div class="art" style="${s.plain ? 'background:var(--card)' : ''}">${s.plain ? `<div class="mk ink" style="position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top) + 90px);text-align:center;font-size:96px;font-weight:800;letter-spacing:-3px">${mk(v)}</div>` : `<img src="${icon(s.id)}" alt="">`}</div>
      <div class="txt"><span class="chip">${esc(s.k)}</span><h2>${s.plain ? s.h : esc(s.h)}</h2></div></div>
      <div class="body">${s.body()}</div>
      ${s.id ? `<div class="approw"><img src="${icon(s.id)}" alt=""><span><b>${esc(D.NAMES[s.id])}</b><i>${esc(T(s.id).tag)}</i></span>${getBtn(s.id)}</div>` : ''}`, { up: true, c: s.id ? HUE[s.id] : '' });
  }
  // ---- your account (the avatar): family accounts with passkeys (Face ID) ----
  // The owner sets up once with the owner code; everyone else joins with an
  // invite link (#invite=...), opened in Safari: the account is made there, then
  // aOS shows how to add it to the Home Screen. Every app signs in with Face ID.
  const li = (n, hi) => `<li${hi ? ' class="hi"' : ''}>${esc(n)}</li>`;
  const block = x => { const e = D.entry(x); return [...e.highlights.map(n => li(n, 1)), ...e.notes.map(n => li(n))].join(''); };
  // ---- Subscription: just for fun, nothing is charged. Kept on this phone (aos.plan);
  // Pro+ until changed. Trial is 7 days of the stock apps, from when it's picked.
  const PLANS = [
    { id: 'proplus', n: 'Pro+', p: 35, d: 'Every stock app, fully custom, plus custom app designs: apps you make for your own needs' },
    { id: 'pro', n: 'Pro', p: 15, d: 'Every stock app' },
    { id: 'trial', n: 'Trial', p: 0, d: 'The stock apps, free for 7 days' },
  ];
  const TRIAL_DAYS = 7, DAY = 864e5;
  const readPlan = () => { try { const x = JSON.parse(localStorage.getItem('aos.plan')); if (x && PLANS.some(p => p.id === x.id)) return x; } catch {} return { id: 'proplus', since: null }; };
  const savePlan = id => { try { localStorage.setItem('aos.plan', JSON.stringify({ id, since: Date.now() })); } catch {} };
  const price = p => p.p ? `$${p.p}<small> a month</small>` : 'Free';
  const onDay = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const renews = since => { const d = new Date(since), now = Date.now(); while (d.getTime() <= now) d.setMonth(d.getMonth() + 1); return d; };
  function paintPlans(el, pick) {
    const cur = readPlan(), me = PLANS.find(p => p.id === cur.id), to = PLANS.find(p => p.id === pick);
    el.querySelector('#plans').innerHTML = PLANS.map(p => `<button type="button" class="plan" data-plan="${p.id}" aria-pressed="${p.id === cur.id}">
        <span class="pn"><b>${esc(p.n)}${p.id === cur.id ? ' <em>Your plan</em>' : ''}</b><i>${esc(p.d)}</i></span><span class="pp">${price(p)}</span></button>`).join('')
      + (to ? `<div class="pick"><div class="row2"><button type="button" data-plan-no>Cancel</button><button type="button" class="go" data-plan-ok="${to.id}">${to.id === 'trial' ? 'Start the 7-day trial' : `Switch to ${esc(to.n)}`}</button></div></div>` : '');
    let note;
    if (me.id === 'trial') {
      const left = Math.ceil(((cur.since || Date.now()) + TRIAL_DAYS * DAY - Date.now()) / DAY);
      note = left > 0 ? `${left} ${left === 1 ? 'day' : 'days'} left in your trial.` : `Your trial ended on ${onDay(cur.since + TRIAL_DAYS * DAY)}: choose Pro or Pro+ to keep the stock apps.`;
    } else note = `${me.n}, $${me.p} a month${cur.since ? `, since ${onDay(cur.since)}` : ''}. ${cur.since ? `Renews ${onDay(renews(cur.since))}.` : 'Renews monthly.'}`;
    el.querySelector('#planNote').textContent = note + ' Just for fun: nothing is charged.';
  }
  function acctPage(at) {
    const el = page(`<h1 class="ptitle">Account</h1>
      <div class="group acct" id="acct"><p class="note">Checking…</p></div>
      <div class="glbl">Appearance</div>
      <div class="group"><div><div class="seg" id="theme" style="flex:1">${W.theme.list.map(([t, n]) => `<button type="button" data-t="${t}" aria-pressed="${t === W.theme.read()}">${n}</button>`).join('')}</div></div></div>
      <div class="glbl">Subscription</div>
      <div class="group plans" id="plans"></div>
      <p class="note" id="planNote"></p>
      <div class="glbl" id="whats-new">Updates</div>
      <div class="group" id="rels">${live.map(r => `<div class="rel"><h4>${mk(r.v)} <span class="muted" style="font-weight:400">${esc(r.title || '')}</span></h4><small>${esc(r.date || '')}</small>
        ${block(r) ? `<ul>${block(r)}</ul>` : ''}${Object.entries(r.apps || {}).sort(([a], [b]) => D.APPS.indexOf(a) - D.APPS.indexOf(b)).map(([id, x]) => block(x) ? `<h5>${esc(D.NAMES[id] || id)}</h5><ul>${block(x)}</ul>` : '').join('')}</div>`).join('')}</div>
      <div class="group" style="margin-top:20px"><button type="button" data-replay style="color:var(--accent)">Replay the welcome</button></div>`, { up: true });
    el.addEventListener('click', ev => {
      const t = ev.target.closest('[data-t]'); if (t) { W.theme.set(t.dataset.t); el.querySelectorAll('[data-t]').forEach(b => b.setAttribute('aria-pressed', String(b === t))); }
      if (ev.target.closest('[data-replay]')) W.play();
      const pl = ev.target.closest('[data-plan]'); if (pl) paintPlans(el, pl.dataset.plan === readPlan().id ? null : pl.dataset.plan);
      if (ev.target.closest('[data-plan-no]')) paintPlans(el);
      const ok = ev.target.closest('[data-plan-ok]'); if (ok) { savePlan(ok.dataset.planOk); paintPlans(el); }
    });
    paintPlans(el);
    paintAccount(el.querySelector('#acct'));
    if (at === 'updates') setTimeout(() => el.querySelector('#whats-new').scrollIntoView({ block: 'start' }), 450);
    return el;
  }

  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const invite = (/[#&]invite=([A-Za-z0-9_-]+)/.exec(location.hash) || [])[1] || null;
  if (invite) { try { sessionStorage.setItem('aos.later.aos', '1'); } catch {} }   // the account first, then how to add aOS
  const WHY = { code: 'That code isn\'t right.', invite: 'This invite has expired or was already used. Ask for a new one.', name: 'Use letters and spaces for your name.',
    storage: 'Family accounts aren\'t switched on yet.', 'owner-exists': 'The owner\'s account already exists: sign in instead.', unknown: 'That account isn\'t in the family any more.',
    NotAllowedError: 'Cancelled, or Face ID didn\'t finish.', 'no-passkeys': 'This browser can\'t make passkeys: use Safari on your iPhone.' };
  const why = e => WHY[e && (e.name === 'NotAllowedError' ? e.name : e.message)] || 'Something went wrong (' + ((e && (e.message || e.name)) || '?') + ').';
  const busy = (b, on) => { b.disabled = on; b.style.opacity = on ? .6 : 1; };
  let state = null;
  const getState = async () => { try { state = await ACC.call('state'); } catch (e) { state = { error: (e && e.status) || 'network' }; } learnInstalled(state); paintHero(state); return state; };

  // Today, signed out: a card that opens the account
  // The family card: aOS is curated for the Allison family. A greeting by name, and
  // everyone in the family (names only, for signed-in family).
  const FAMILY = 'Allison';
  const FAMILY_ICON = `<svg class="ficon" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="fam-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A9D3C7"/><stop offset=".35" stop-color="#B9C6E0"/><stop offset=".68" stop-color="#E3C5C3"/><stop offset="1" stop-color="#E9D6B4"/></linearGradient></defs>
      <rect width="64" height="64" rx="18" fill="url(#fam-g)"/><g fill="#fff">
      <path d="M32 8.6c-1.3-2.1-4.8-1.7-4.8 1.1 0 2.4 4.8 5.1 4.8 5.1s4.8-2.7 4.8-5.1c0-2.8-3.5-3.2-4.8-1.1z"/>
      <circle cx="21.5" cy="22" r="6.2" opacity=".9"/><path d="M10 46c0-7.4 5.2-12.6 11.5-12.6S33 38.6 33 46z" opacity=".9"/>
      <circle cx="42.5" cy="22" r="6.2" opacity=".9"/><path d="M31 46c0-7.4 5.2-12.6 11.5-12.6S54 38.6 54 46z" opacity=".9"/></g>
      <g fill="#fff" stroke="#9FB0C9" stroke-width="1.2"><circle cx="26" cy="36" r="4.8"/><path d="M17.5 54c0-5.8 3.8-9.6 8.5-9.6s8.5 3.8 8.5 9.6z"/>
      <circle cx="38" cy="36" r="4.8"/><path d="M29.5 54c0-5.8 3.8-9.6 8.5-9.6s8.5 3.8 8.5 9.6z"/></g></svg>`;
  let members = null;
  async function paintHero(st) {
    const u = st && st.user, h = new Date().getHours();
    const hello = u ? `Good ${h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'}, ${esc(u.name.split(/\s+/)[0])}` : 'Welcome home';
    if (u && !members) { try { members = (await ACC.call('members')).members; } catch { members = null; } }
    if (!u) members = null;
    $('famhero').innerHTML = `<div class="famhero">${FAMILY_ICON}<div class="ftxt"><small>${hello}</small><h2>The <span class="ink">${FAMILY}</span> Family</h2>
      <p>Every app here is chosen for our family: ${D.APPS.length} apps, one account.</p></div>
      ${members && members.length ? `<div class="fwho">${members.map(m => `<span><i>${esc(m.name[0].toUpperCase())}</i>${esc(m.name.split(/\s+/)[0])}</span>`).join('')}</div>` : ''}</div>`;
  }

  function paintSigninCard() {
    const c = $('signin'), st = state || {};
    const what = st.error || !st.storage || st.user ? null : invite ? ['Join the family', 'You\'ve been invited: make your account with Face ID.'] : !st.setup ? ['Set up your family account', 'Once, by the owner, with the owner code.'] : ['Sign in', 'Face ID signs you in to every app.'];
    c.hidden = !what;
    c.innerHTML = what ? `<div class="signin" role="button" tabindex="0" data-signin-card><span class="avatar">${STAR}</span><span><b>${what[0]}</b><i>${what[1]}</i></span><span class="chev">›</span></div>` : '';
  }
  const STAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z"/></svg>';

  async function paintAccount(box) {
    const st = await getState(); paintSigninCard(); paintAvatars();
    if (!box.isConnected) return;
    if (st.error) { box.innerHTML = `<div><p>Accounts can\'t be reached right now (${esc(st.error === 'network' ? 'no connection' : 'error ' + st.error)}${/\.pages\.dev$/.test(location.hostname) ? '' : ', ' + esc(location.hostname)}).</p></div>`; return; }
    if (!st.storage) { box.innerHTML = '<div><h3>Family accounts</h3><p>Not switched on yet: the site needs its account storage on Cloudflare (aOS/RELEASING.md).</p></div>'; return; }
    if (!st.user && ACC.token()) ACC.signOut();   // removed from the family, or a stale session
    if (st.user) return paintSignedIn(box, st.user);
    if (invite) {
      box.innerHTML = `<div><h3>Join the family</h3><p>You've been invited to AllisonOS. Your account is a passkey: Face ID signs you in to every app.</p>
        <input id="aName" placeholder="Your name" autocomplete="given-name" maxlength="40"><button type="button" class="go" id="aGo">Create my account</button><div class="err" id="aErr"></div></div>`;
      $('aGo').onclick = async () => {
        busy($('aGo'), true);
        try {
          await ACC.signUp({ name: $('aName').value.trim(), invite });
          history.replaceState(null, '', location.pathname);
          try { sessionStorage.removeItem('aos.later.aos'); } catch {}
          await paintAccount(box);
          if (iphone && !standalone) W.playInstall('aos');   // next: aOS on the Home Screen
        } catch (e) { $('aErr').textContent = why(e); busy($('aGo'), false); }
      };
      return;
    }
    if (!st.setup) {
      box.innerHTML = `<div><h3>Set up your family account</h3><p>Once, by the owner: enter your owner code and your name, then Face ID.</p>
        <input id="aCode" placeholder="Owner code" autocapitalize="characters" autocomplete="off" spellcheck="false">
        <input id="aName" placeholder="Your name" autocomplete="given-name" maxlength="40"><button type="button" class="go" id="aGo">Create the owner account</button><div class="err" id="aErr"></div></div>`;
      $('aGo').onclick = async () => {
        busy($('aGo'), true);
        try { await ACC.signUp({ name: $('aName').value.trim(), code: $('aCode').value }); await paintAccount(box); }
        catch (e) { $('aErr').textContent = why(e); busy($('aGo'), false); }
      };
      return;
    }
    box.innerHTML = `<div><h3>Sign in</h3><p>With the passkey you made when you joined.</p><button type="button" class="go" id="aGo">Continue with Face ID</button><div class="err" id="aErr"></div>
      <p class="note">New here? Ask the owner for an invite link.</p></div>`;
    $('aGo').onclick = async () => {
      busy($('aGo'), true);
      try { await ACC.signIn(); await paintAccount(box); } catch (e) { $('aErr').textContent = why(e); busy($('aGo'), false); }
    };
  }

  async function paintSignedIn(box, u) {
    box.innerHTML = `<div class="me"><span class="avatar">${esc(u.name[0].toUpperCase())}</span><span style="flex:1"><b>${esc(u.name)}</b> <small class="muted">${u.role === 'owner' ? 'Owner' : 'Family'}</small><br><small class="muted">Face ID signs you in to every app</small></span>
      <button type="button" class="soft" id="aOut">Sign out</button></div>`;
    $('aOut').onclick = () => { ACC.signOut(); paintAccount(box); };
    if (u.role !== 'owner') return;
    box.insertAdjacentHTML('beforeend', `<div><h3>Home Assistant address</h3><p>Fills in the Home app for everyone in the family, so each person only makes their own token. Your Nabu Casa address, from Home Assistant: Settings → Home Assistant Cloud.</p>
      <input id="hAddr" type="url" inputmode="url" placeholder="https://xxxxxxxx.ui.nabu.casa" autocapitalize="off" autocomplete="off" spellcheck="false"><button type="button" class="go" id="hSave">Save</button><div class="err" id="hErr"></div></div>
      <div><h3>Invite someone</h3><p>A link for one person, good once, for 24 hours. They open it in Safari on their iPhone.</p>
      <input id="iName" placeholder="Their name" maxlength="40"><button type="button" class="go" id="iGo">Make an invite link</button><div class="err" id="iErr"></div><div id="iOut"></div></div>
      <div><h3>Your family</h3><div class="fam" id="fam"></div></div>`);
    $('iGo').onclick = async () => {
      busy($('iGo'), true); $('iErr').textContent = '';
      try {
        const r = await ACC.call('invite', { name: $('iName').value.trim() });
        const link = new URL('./#invite=' + r.token, location.href).href;
        $('iOut').innerHTML = `<div class="link">${esc(link)}</div><div class="row2"><button type="button" class="go" id="iShare">Share</button><button type="button" class="soft" id="iCopy">Copy</button></div>`;
        $('iShare').onclick = () => navigator.share ? navigator.share({ title: 'Join AllisonOS', text: r.name + ', here is your AllisonOS invite. Open it in Safari.', url: link }).catch(() => {}) : $('iCopy').click();
        $('iCopy').onclick = async () => { try { await navigator.clipboard.writeText(link); $('iCopy').textContent = 'Copied'; } catch { $('iCopy').textContent = 'Press and hold the link'; } };
        $('iName').value = '';
      } catch (e) { $('iErr').textContent = why(e); }
      busy($('iGo'), false);
    };
    paintFamily();
    ACC.call('home').then(r => { if (r.address && !$('hAddr').value) $('hAddr').value = r.address; }).catch(() => {});
    $('hSave').onclick = async () => {
      busy($('hSave'), true); const m = $('hErr'); m.textContent = ''; m.style.color = '';
      try { const r = await ACC.call('home', { address: $('hAddr').value.trim() }); $('hAddr').value = r.address || ''; m.style.color = 'var(--muted)'; m.textContent = r.address ? 'Saved: Home fills this in for the family.' : 'Cleared.'; }
      catch (e) { m.textContent = e.message === 'address' ? 'Use the https address, like https://xxxxxxxx.ui.nabu.casa.' : why(e); }
      busy($('hSave'), false);
    };
  }

  async function paintFamily() {
    let f; try { f = (await ACC.call('family')).family; } catch { return; }
    if (!$('fam')) return;
    $('fam').innerHTML = f.map(m => `<div><span>${esc(m.name)}<small>${m.role === 'owner' ? 'Owner' : 'Family'}</small></span>${m.role === 'owner' ? '' : `<button type="button" data-rm="${esc(m.id)}">Remove</button>`}</div>`).join('');
    $('fam').onclick = async e => {
      const b = e.target.closest('[data-rm]'); if (!b) return;
      const name = b.parentElement.querySelector('span').firstChild.textContent;
      if (!confirm(`Remove ${name}? They're signed out of every app straight away.`)) return;
      try { await ACC.call('remove', { id: b.dataset.rm }); } catch {}
      paintFamily();
    };
  }


  // ---- taps ----
  document.addEventListener('click', ev => {
    if (ev.target.closest('[data-get]')) return;   // Get: the link opens the app's own address, which shows how to add it
    const a = ev.target.closest('[data-app]'); if (a) return appPage(a.dataset.app);
    const s = ev.target.closest('[data-story]'); if (s) return storyPage(+s.dataset.story);
    if (ev.target.closest('[data-signin-card]')) return acctPage();
    if (ev.target.closest('[data-acct]')) return acctPage();
  });

  getState().then(st => {
    paintSigninCard(); paintAvatars();
    if (location.hash === '#whats-new') { history.replaceState(null, '', location.pathname); acctPage('updates'); }
    else if (invite || (st.storage && !st.setup && !st.error)) acctPage();
  });
  addEventListener('hashchange', () => { if (location.hash === '#whats-new') { history.replaceState(null, '', location.pathname); acctPage('updates'); } });
})();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
