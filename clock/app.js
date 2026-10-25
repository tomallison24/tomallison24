"use strict";

// Clock: the iPhone's Clock app as an aOS app.
//
// - Four tabs at the bottom (the floating pill): World Clock, Alarms, Stopwatch, Timers.
// - World Clock: your own time on a big face, then the cities you add (+), each with its
//   time, its day and how far ahead or behind it is. Edit removes and reorders them.
// - Alarms: Sleep | Wake Up first (a bedtime, a wake-up alarm, the days, a bedtime chime),
//   then the other alarms. Each: a time, the days it repeats (none: it rings once, then
//   turns itself off), a label, a sound, snooze and for how long. A switch turns one off.
// - Stopwatch: digital or analog (tap the face, or the dots), Start / Stop, Lap / Reset;
//   the fastest and slowest laps are marked (in words too). It keeps counting while Clock
//   is closed: only the moment it started is kept.
// - Timers: as many at once as you like, each with a label and a sound; pause, resume,
//   cancel. The length is picked on three wheels or a quick-length chip; Recents are one tap.
// - Ringing: the whole screen, Stop and Snooze (a timer: Stop and Repeat). The sounds are
//   made by logic.js as WAV files and played through one <audio>, which the first tap
//   anywhere unlocks (iPhone won't play sound a person didn't start).
// - Nightstand (the moon): a dark bedside clock that asks the phone to keep the screen on
//   (the Screen Wake Lock), so alarms ring in the morning.
// - What a web app can't do: ring while it's closed or the phone is locked. A ring that
//   came due then is listed under Alarms as missed when Clock is next opened (or rings,
//   if it's less than ten minutes late).
// - Everything is kept on this phone, in localStorage (the key is the page's aos-store meta).
// - Two designs, picked in Settings > Design: Vintage (the default) and Standard (Sea glass).
//   design.js applies the one kept in set.design before the page is drawn.

// Refuse to run inside another site's frame; this same site may (see Mail's app.js for why).
if (window.top !== window.self && (() => { try { return window.top.location.origin !== location.origin; } catch { return true; } })()) {
  document.body.textContent = 'Clock can’t be opened inside another page.';
  throw new Error('Clock refuses to run inside a frame');
}

(function () {
  const L = window.ClockLogic;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    json: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
  };
  const KEY = (document.querySelector('meta[name="aos-store"]') || {}).content || 'allison-clock-v1';
  const now = () => Date.now();
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = n => String(n).padStart(2, '0');
  const LATE = 10 * 60e3;   // a ring more than this late (Clock was closed) is listed as missed instead

  const ICON = {
    minus: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><path d="M7.6 12h8.8" stroke="#fff" stroke-width="2.4"/></svg>',
    grip: '<svg viewBox="0 0 24 24"><path d="M5 8.4h14M5 12h14M5 15.6h14"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8.4 5.6v12.8a.8.8 0 0 0 1.2.7l10-6.4a.8.8 0 0 0 0-1.4l-10-6.4a.8.8 0 0 0-1.2.7z" fill="currentColor" stroke="none"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6.6" y="5.4" width="3.6" height="13.2" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.8" y="5.4" width="3.6" height="13.2" rx="1.2" fill="currentColor" stroke="none"/></svg>',
    close: '<svg viewBox="0 0 24 24" class="b"><path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M6 10.8a6 6 0 0 1 12 0v3.4a3.6 3.6 0 0 0 1.1 2.6l.2.2a1 1 0 0 1-.7 1.7H5.4a1 1 0 0 1-.7-1.7l.2-.2A3.6 3.6 0 0 0 6 14.2z"/><path d="M9.9 20.9a2.4 2.4 0 0 0 4.2 0"/></svg>',
    bed: '<svg viewBox="0 0 24 24"><path d="M3 18.6V6M3 15h18v3.6M21 15v-2.6a3 3 0 0 0-3-3h-7v5.6"/><circle cx="7" cy="11.6" r="1.8"/></svg>',
    tick: '<svg viewBox="0 0 24 24" class="b"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>',
    chev: '<svg viewBox="0 0 24 24" class="b"><path d="M9.4 5.4l6.2 5.9a1 1 0 0 1 0 1.4l-6.2 5.9"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7.4v5.4M12 16.2v.2"/></svg>',
    speaker: '<svg viewBox="0 0 24 24"><path d="M4.4 9.6h3.2l4.8-4v12.8l-4.8-4H4.4z"/><path d="M15.6 9a4 4 0 0 1 0 6"/></svg>',
  };

  // ---------------------------------------------------------------------
  // What's kept: { v: 1, tab, cities: [{id, name, where, tz}],
  //   alarms: [{id, h, m, days, label, sound, snooze, snoozeMin, on, next, snoozeAt}],
  //   sleep: {set, on, bed: {h, m}, wake: {h, m}, days, alarm, sound, snooze, snoozeMin, remind, next, bedNext, skip, snoozeAt},
  //   sw: {run, t0, acc, laps, face}, timers: [{id, label, dur, sound, end, left, state, made}],
  //   recents: [{dur, label, sound}], pick: {h, m, s}, tsound,
  //   set: {h24, h24Picked, secs, analog}, missed: [{kind, label, at}], tz }
  // next / bedNext / end / snoozeAt are moments (ms) the tick watches for.
  // ---------------------------------------------------------------------
  const SOUND_IDS = L.SOUNDS.map(s => s.id);
  const okSound = s => SOUND_IDS.includes(s) ? s : 'twinbell';
  const okHM = o => o && Number.isInteger(o.h) && o.h >= 0 && o.h < 24 && Number.isInteger(o.m) && o.m >= 0 && o.m < 60;
  const okTs = t => typeof t === 'number' && isFinite(t) ? t : null;
  const SNOOZES = [1, 3, 5, 9, 10, 15];
  const okSnz = n => SNOOZES.includes(n) ? n : 9;
  const SLEEP0 = { set: false, on: false, bed: { h: 22, m: 30 }, wake: { h: 6, m: 30 }, days: [1, 2, 3, 4, 5], alarm: true, sound: 'sunrise', snooze: true, snoozeMin: 9, remind: true, next: null, bedNext: null, skip: null, snoozeAt: null };
  function load() {
    const d = ls.json(KEY, {}) || {};
    const S = {
      v: 1,
      tab: ['world', 'alarms', 'stopwatch', 'timers'].includes(d.tab) ? d.tab : 'world',
      cities: (Array.isArray(d.cities) ? d.cities : []).filter(c => c && typeof c.name === 'string' && L.validZone(c.tz))
        .map(c => ({ id: String(c.id || newId()), name: c.name.slice(0, 60), where: String(c.where || '').slice(0, 60), tz: c.tz })),
      alarms: (Array.isArray(d.alarms) ? d.alarms : []).filter(a => a && okHM(a)).map(a => ({
        id: String(a.id || newId()), h: a.h, m: a.m, days: L.cleanDays(a.days), label: String(a.label || '').slice(0, 40), sound: okSound(a.sound),
        snooze: a.snooze !== false, snoozeMin: okSnz(a.snoozeMin), on: !!a.on, next: okTs(a.next), snoozeAt: okTs(a.snoozeAt) })),
      sleep: Object.assign({}, SLEEP0, d.sleep && typeof d.sleep === 'object' ? d.sleep : {}),
      sw: Object.assign({ run: false, t0: 0, acc: 0, laps: [], face: 'digital' }, d.sw && typeof d.sw === 'object' ? d.sw : {}),
      timers: (Array.isArray(d.timers) ? d.timers : []).filter(t => t && t.dur > 0 && ['run', 'pause', 'done'].includes(t.state)).map(t => ({
        id: String(t.id || newId()), label: String(t.label || '').slice(0, 40), dur: +t.dur, sound: okSound(t.sound), end: okTs(t.end), left: okTs(t.left),
        state: t.state === 'done' ? 'run' : t.state, made: okTs(t.made) || 0 }))   // one that was ringing when Clock closed rings (or is missed) again
        .filter(t => t.state === 'run' ? t.end : t.left != null),
      recents: (Array.isArray(d.recents) ? d.recents : []).filter(r => r && r.dur > 0).slice(0, 10).map(r => ({ dur: +r.dur, label: String(r.label || '').slice(0, 40), sound: okSound(r.sound) })),
      pick: Object.assign({ h: 0, m: 5, s: 0 }, d.pick && typeof d.pick === 'object' ? d.pick : {}),
      tsound: okSound(d.tsound || 'twinbell'),
      set: Object.assign({ h24: false, secs: false, analog: false, design: 'vintage', home: null }, d.set && typeof d.set === 'object' ? d.set : {}),
      missed: (Array.isArray(d.missed) ? d.missed : []).filter(x => x && x.at).slice(-10),
      tz: typeof d.tz === 'string' ? d.tz : '',
    };
    const sl = S.sleep;
    if (!okHM(sl.bed)) sl.bed = { ...SLEEP0.bed };
    if (!okHM(sl.wake)) sl.wake = { ...SLEEP0.wake };
    sl.days = L.cleanDays(sl.days); sl.sound = okSound(sl.sound); sl.snoozeMin = okSnz(sl.snoozeMin);
    ['next', 'bedNext', 'skip', 'snoozeAt'].forEach(k => { sl[k] = okTs(sl[k]); });
    S.sw.laps = Array.isArray(S.sw.laps) ? S.sw.laps.filter(n => typeof n === 'number' && n >= 0) : [];
    S.sw.acc = +S.sw.acc || 0; S.sw.t0 = +S.sw.t0 || 0; S.sw.run = !!S.sw.run && S.sw.t0 > 0;
    if (S.sw.face !== 'analog') S.sw.face = 'digital';
    if (!['glass', 'neon', 'folk', 'grid'].includes(S.set.design)) S.set.design = 'vintage';
    const hm = S.set.home;   // the main clock's city: null is this phone's own time zone
    S.set.home = hm && typeof hm.name === 'string' && L.validZone(hm.tz) ? { name: hm.name.slice(0, 60), where: String(hm.where || '').slice(0, 60), tz: hm.tz } : null;
    ['h', 'm', 's'].forEach(k => { const v = Math.floor(+S.pick[k] || 0); S.pick[k] = Math.max(0, Math.min(k === 'h' ? 23 : 59, v)); });
    return S;
  }
  const S = load();
  let warned = false;
  function save() {
    if (!ls.set(KEY, JSON.stringify(S)) && !warned) { warned = true; toast('This phone couldn’t save Clock: its storage is full.'); }
  }
  // 24-hour time: as picked in Settings; until it's picked (h24Picked), Russian is 24-hour (../home/lang.js), English 12
  const russian = () => !!(window.aosLang && aosLang.get() === 'ru');
  const h24 = () => S.set.h24Picked ? !!S.set.h24 : (!!S.set.h24 || russian());
  const hereZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } };
  const timeHTML = (h, m, secs) => { const c = L.clockText(h, m, h24(), secs); return esc(c.time) + (c.ap ? '<span>' + c.ap + '</span>' : ''); };
  const atLine = t => { const d = new Date(t); return L.clockLine(d.getHours(), d.getMinutes(), h24()); };
  const dayLine = (t, tz) => new Date(t).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz || undefined });
  // "7:00 AM" today, "7:00 AM tomorrow", "Fri 7:00 AM" later on
  function whenLine(t) {
    const d = new Date(t), n = new Date(), days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
    const tl = atLine(t);
    return days === 0 ? tl : days === 1 ? tl + ' tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + tl;
  }
  // "at 7:00 AM", "yesterday at 7:00 AM", "on Tue, Oct 13 at 7:00 AM": when something already happened
  function pastLine(t) {
    const d = new Date(t), n = new Date(), days = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    const tl = 'at ' + atLine(t);
    return days <= 0 ? tl : days === 1 ? 'yesterday ' + tl : 'on ' + d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' + tl;
  }

  // ---------------------------------------------------------------------
  // Faces: one SVG (200 x 200), its hands turned by setHands. The Vintage design's
  // style sheet shows the starburst (.rays) behind it; Standard hides it.
  // ---------------------------------------------------------------------
  function faceSVG(kind) {
    const big = kind === 'big', P = (r, a) => [100 + r * Math.sin(a * Math.PI / 180), 100 - r * Math.cos(a * Math.PI / 180)].map(v => v.toFixed(2));
    let rays = '', ticks = '', nums = '';
    for (let i = 0; i < 12; i++) {
      const a = i * 30, long = i % 3 === 0, [x1, y1] = P(84, a), [x2, y2] = P(long ? 99 : 94, a), [cx, cy] = P(long ? 101 : 95.5, a);
      rays += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><circle class="tip" cx="${cx}" cy="${cy}" r="${long ? 4.6 : 3.2}"/>`;
    }
    for (let i = 0; i < (big ? 60 : 12); i++) {
      const a = i * (big ? 6 : 30), five = big ? i % 5 === 0 : true, [x1, y1] = P(big ? (five ? 66 : 70) : 64, a), [x2, y2] = P(74, a);
      ticks += `<line class="tk${five ? ' big' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    }
    if (big) [12, 3, 6, 9].forEach((n, i) => { const [x, y] = P(53, i * 90); nums += `<text class="nm" x="${x}" y="${y}">${n}</text>`; });
    return `<svg class="face ${kind}" viewBox="0 0 200 200" aria-hidden="true"><g class="rays">${rays}</g><circle class="dial" cx="100" cy="100" r="80"/>${ticks}${nums}`
      + '<line class="hh" x1="100" y1="106" x2="100" y2="58"/><line class="mh" x1="100" y1="108" x2="100" y2="34"/>'
      + (kind === 'mini' ? '' : '<line class="sh" x1="100" y1="118" x2="100" y2="30"/>') + '<circle class="hub" cx="100" cy="100" r="6"/><circle class="hub2" cx="100" cy="100" r="2.6"/></svg>';
  }
  function setHands(svg, h, m, s, ms) {
    if (!svg) return;
    const a = L.hands(h, m, s || 0, ms || 0), r = (sel, deg) => { const el = svg.querySelector(sel); if (el) el.setAttribute('transform', 'rotate(' + deg.toFixed(2) + ' 100 100)'); };
    r('.hh', a.h); r('.mh', a.m); r('.sh', a.s);
    svg.classList.toggle('dark', h < 6 || h >= 18);
  }
  // The stopwatch's dial: 60 seconds round, a 30-minute dial inside, a lap hand.
  function swSVG() {
    const P = (r, a, cx = 100, cy = 100) => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)].map(v => v.toFixed(2));
    let t = '', sub = '';
    for (let i = 0; i < 240; i++) {
      const a = i * 1.5, five = i % 20 === 0, one = i % 4 === 0, [x1, y1] = P(five ? 84 : one ? 88 : 91, a), [x2, y2] = P(95, a);
      t += `<line class="tk${five ? ' big' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${!one ? ' opacity=".5"' : ''}/>`;
    }
    for (let i = 1; i <= 12; i++) { const [x, y] = P(72, i * 30); t += `<text class="nm" x="${x}" y="${y}">${i * 5}</text>`; }
    for (let i = 0; i < 30; i++) { const a = i * 12, big = i % 5 === 0, [x1, y1] = P(big ? 14 : 16, a, 100, 62), [x2, y2] = P(19, a, 100, 62); sub += `<line class="tk${big ? ' big' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }
    return `<svg class="face sw" viewBox="0 0 200 200" aria-hidden="true"><g class="rays"></g><circle class="dial" cx="100" cy="100" r="98"/>${t}<circle class="sub" cx="100" cy="62" r="21"/>${sub}`
      + '<line class="mh subh" x1="100" y1="62" x2="100" y2="45"/><circle class="hub" cx="100" cy="62" r="2.6"/>'
      + '<text class="dg" id="swAnaDg" x="100" y="146">00:00.00</text>'
      + '<line class="lh" x1="100" y1="116" x2="100" y2="8" opacity="0"/><line class="sh" x1="100" y1="116" x2="100" y2="8"/>'
      + '<circle class="hub2" cx="100" cy="100" r="4.4"/><circle class="hub" cx="100" cy="100" r="1.8"/></svg>';
  }

  // ---------------------------------------------------------------------
  // Sound: one <audio>, unlocked by the first tap. Sounds are WAV blobs from logic.js.
  // ---------------------------------------------------------------------
  const AUD = { el: null, urls: {}, unlocked: false, playing: null, stopT: 0 };
  const audioEl = () => { if (!AUD.el) { AUD.el = new Audio(); AUD.el.preload = 'auto'; AUD.el.setAttribute('playsinline', ''); } return AUD.el; };
  const soundUrl = id => AUD.urls[id] || (AUD.urls[id] = URL.createObjectURL(new Blob([id === 'silence' ? L.wav('silence', .2) : L.wav(id)], { type: 'audio/wav' })));
  function unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    if (AUD.unlocked) { if (RING.length && !AUD.playing) ringSound(); return; }
    const a = audioEl();
    if (RING.length) { ringSound(); return; }
    a.loop = false; a.src = soundUrl('silence');
    const p = a.play();
    if (p && p.then) p.then(() => { AUD.unlocked = true; if (!AUD.playing) a.pause(); }).catch(() => {});
  }
  document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  document.addEventListener('keydown', unlock, { capture: true });
  // Play a sound: looped until stopSound(), or for `ms`. Resolves to whether it's heard.
  function playSound(id, ms) {
    const a = audioEl();
    clearTimeout(AUD.stopT);
    a.loop = !ms || ms > 4000; a.src = soundUrl(okSound(id)); AUD.playing = id;
    try { a.currentTime = 0; } catch {}
    if (ms) AUD.stopT = setTimeout(stopSound, ms);
    let p; try { p = a.play(); } catch { p = Promise.reject(); }
    return Promise.resolve(p).then(() => { AUD.unlocked = true; return true; }, () => { if (AUD.playing === id) AUD.playing = null; return false; });
  }
  function stopSound() { clearTimeout(AUD.stopT); AUD.playing = null; if (AUD.el) { try { AUD.el.pause(); } catch {} } }

  // ---------------------------------------------------------------------
  // Tabs, the header
  // ---------------------------------------------------------------------
  const TITLES = { world: 'World Clock', alarms: 'Alarms', stopwatch: 'Stopwatch', timers: 'Timers' };
  let editing = false;
  function setTab(tab, quiet) {
    if (!TITLES[tab]) return;
    if (S.tab !== tab) { editing = false; S.tab = tab; save(); if (!quiet) window.scrollTo(0, 0); }
    document.querySelectorAll('#tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    document.querySelectorAll('.pane').forEach(p => { p.hidden = p.id !== 'p-' + tab; });
    renderHead(); renderPane(tab);
    slideTabs(quiet);
    if (!quiet) animateIn($('main'));
    loop();
  }
  function slideTabs(jump) {
    const on = document.querySelector('#tabs [aria-selected="true"]');
    if (window.AllisonOS && AllisonOS.slide) AllisonOS.slide($('tabs'), on, 'clock-tabs', { jump });
  }
  $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  $('tabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const tabs = [...document.querySelectorAll('#tabs [data-tab]')], i = tabs.findIndex(b => b.dataset.tab === S.tab);
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; setTab(n.dataset.tab); n.focus();
  });
  window.addEventListener('resize', () => slideTabs(true));
  function renderHead() {
    const t = S.tab;
    $('title').textContent = TITLES[t];
    const canEdit = (t === 'world' && S.cities.length) || (t === 'alarms' && S.alarms.length);
    if (!canEdit) editing = false;
    $('editBtn').hidden = !canEdit;
    $('editBtn').textContent = editing ? 'Done' : 'Edit';
    $('editBtn').setAttribute('aria-pressed', String(editing));
    $('addBtn').hidden = !(t === 'world' || t === 'alarms');
    $('addBtn').setAttribute('aria-label', t === 'world' ? 'Add a city' : 'Add an alarm');
    paintSub();
  }
  function paintSub() {
    const t = S.tab, el = $('sub');
    let s = '';
    if (t === 'world') s = dayLine(now(), mainTz());
    else if (t === 'alarms') { const n = nextAlarm(); s = n ? 'Next alarm in ' + L.untilText(n.t - now()) : 'No alarms on'; }
    else if (t === 'timers') { const r = S.timers.filter(x => x.state === 'run').length; s = r ? r + (r === 1 ? ' timer running' : ' timers running') : ''; }
    else if (t === 'stopwatch') s = S.sw.run ? 'Running' : swElapsed() ? 'Stopped' : '';
    if (el.textContent !== s) el.textContent = s;
  }
  $('editBtn').addEventListener('click', () => { editing = !editing; renderHead(); renderPane(S.tab); });
  $('addBtn').addEventListener('click', () => { if (S.tab === 'world') openCities(); else openAlarm(null); });
  function renderPane(t) { ({ world: renderWorld, alarms: renderAlarms, stopwatch: renderSW, timers: renderTimers })[t](); }
  function animateIn(el) { el.classList.add('enter'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('enter'), 900); }

  // ---------------------------------------------------------------------
  // World Clock
  // ---------------------------------------------------------------------
  // The main clock (the big face): this phone's own time, or a city picked in Settings > Main Clock.
  // Alarms and Nightstand always keep this phone's time.
  function phoneName() { const tz = hereZone(), c = L.CITIES.find(x => x.tz === tz) || L.zoneCity(tz); return c ? c.name : 'Here'; }
  const mainTz = () => (S.set.home && S.set.home.tz) || hereZone();
  const hereName = () => S.set.home ? S.set.home.name : phoneName();
  function renderWorld() {
    $('hero').innerHTML = `<div class="fw">${faceSVG('big')}</div><div class="ht"><small${hereName() === 'Here' ? '' : ' translate="no"'}>${esc(hereName())}</small><b id="heroT" class="num"></b><em id="heroD"></em></div>`;
    $('cityEmpty').hidden = S.cities.length > 0;
    const list = $('cityList');
    list.hidden = !S.cities.length;
    list.classList.toggle('editing', editing);
    list.innerHTML = S.cities.map(c => `<div class="crow" data-id="${esc(c.id)}">`
      + (editing ? `<button class="del" type="button" data-del="${esc(c.id)}" aria-label="Remove ${esc(c.name)}">${ICON.minus}</button>` : `<div class="fw">${faceSVG('mini')}</div>`)
      + `<div class="cn"><small data-rel></small><strong translate="no">${esc(c.name)}</strong></div><div class="ct" data-t></div>`
      + (editing ? `<button class="grip" type="button" data-grip="${esc(c.id)}" aria-label="Move ${esc(c.name)}: use the up and down arrow keys, or drag">${ICON.grip}</button>` : '') + '</div>').join('');
    paintWorld();
  }
  function paintWorld() {
    const t = now(), d = new Date(t);
    const ht = $('heroT'); if (!ht) return;
    const tz = mainTz(), z = L.zoneParts(tz, t), off = S.set.home ? L.zoneVs(tz, t).diff : 0;
    const html = timeHTML(z.h, z.mi);
    if (ht.innerHTML !== html) ht.innerHTML = html;
    const dl = dayLine(t, tz) + (off ? ' · ' + L.diffText(off) + (off > 0 ? ' of' : '') + ' this phone' : '');   // "5 hr ahead of this phone", "3 hr behind this phone"
    if ($('heroD').textContent !== dl) $('heroD').textContent = dl;
    setHands($('hero').querySelector('svg'), z.h, z.mi, z.s, d.getMilliseconds());
    for (const row of $('cityList').children) {
      const c = S.cities.find(x => x.id === row.dataset.id); if (!c) continue;
      const z = L.zoneParts(c.tz, t), v = L.zoneVs(c.tz, t), th = timeHTML(z.h, z.mi);
      const te = row.querySelector('[data-t]'), re = row.querySelector('[data-rel]');
      if (te.innerHTML !== th) te.innerHTML = th;
      if (re.textContent !== v.text) re.textContent = v.text;
      setHands(row.querySelector('svg'), z.h, z.mi, z.s);
    }
  }
  $('cityList').addEventListener('click', e => {
    const del = e.target.closest('[data-del]'); if (!del) return;
    const i = S.cities.findIndex(c => c.id === del.dataset.del); if (i < 0) return;
    const [gone] = S.cities.splice(i, 1); save(); renderHead(); renderWorld();
    toast(gone.name + ' removed.', () => { S.cities.splice(i, 0, gone); save(); renderHead(); renderWorld(); });
  });
  // Reorder: drag a row by its grip, or move it with the arrow keys.
  function moveCity(id, to) {
    const i = S.cities.findIndex(c => c.id === id); if (i < 0) return;
    to = Math.max(0, Math.min(S.cities.length - 1, to)); if (to === i) return;
    const [c] = S.cities.splice(i, 1); S.cities.splice(to, 0, c); save(); renderWorld();
    const g = document.querySelector(`[data-grip="${CSS.escape(id)}"]`); if (g) g.focus();
  }
  $('cityList').addEventListener('keydown', e => {
    const g = e.target.closest('[data-grip]'); if (!g || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault(); moveCity(g.dataset.grip, S.cities.findIndex(c => c.id === g.dataset.grip) + (e.key === 'ArrowUp' ? -1 : 1));
  });
  $('cityList').addEventListener('pointerdown', e => {
    const g = e.target.closest('[data-grip]'); if (!g) return;
    e.preventDefault();
    const row = g.closest('.crow'), y0 = e.clientY, h = row.offsetHeight, i0 = S.cities.findIndex(c => c.id === g.dataset.grip);
    let dy = 0;
    row.classList.add('dragging'); try { g.setPointerCapture(e.pointerId); } catch {}
    const move = ev => { dy = ev.clientY - y0; row.style.transform = 'translateY(' + dy + 'px)'; };
    const up = () => { g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); row.classList.remove('dragging'); row.style.transform = ''; moveCity(g.dataset.grip, i0 + Math.round(dy / h)); };
    g.addEventListener('pointermove', move); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  });

  // Add a city
  // The same sheet picks the main clock's city (from Settings): mode 'home'
  let cityMode = 'add';
  function openCities(mode) {
    cityMode = mode === 'home' ? 'home' : 'add';
    $('cityLbl').textContent = cityMode === 'home' ? 'Main Clock' : 'Choose a City';
    $('cityHereBox').hidden = cityMode !== 'home';
    $('cityHere').querySelector('.sub').textContent = phoneName() + (S.set.home ? '' : ', as now');
    $('citySheet').style.zIndex = cityMode === 'home' ? '12' : '';   // over Settings
    $('cityQ').value = ''; paintCityRes(); openSheet('citySheet'); setTimeout(() => $('cityQ').focus(), 380);
  }
  function paintCityRes() {
    const q = $('cityQ').value, res = L.searchCities(q, 60), t = now();
    const have = new Set(cityMode === 'home' ? (S.set.home ? [S.set.home.tz + '|' + S.set.home.name] : []) : S.cities.map(c => c.tz + '|' + c.name));
    $('cityRes').hidden = !res.length;
    $('cityHint').hidden = !!res.length || !q.trim();
    $('cityHint').textContent = q.trim() ? 'No cities match “' + q.trim() + '”.' : '';
    $('cityRes').innerHTML = res.map((c, i) => { const z = L.zoneParts(c.tz, t), on = have.has(c.tz + '|' + c.name);
      return `<button class="cres${on ? ' have' : ''}" type="button" data-i="${i}"><span class="cn"><b translate="no">${esc(c.name)}</b><small><span translate="no">${esc(c.where)}</span>${on ? (cityMode === 'home' ? ' · main clock' : ' · added') : ''}</small></span><span class="cv">${esc(L.clockLine(z.h, z.mi, h24()))}</span></button>`; }).join('');
    $('cityRes')._res = res;
  }
  $('cityQ').addEventListener('input', paintCityRes);
  $('cityRes').addEventListener('click', e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    const c = $('cityRes')._res[+b.dataset.i]; if (!c) return;
    if (cityMode === 'home') { setHome({ name: c.name, where: c.where, tz: c.tz }); return; }
    if (!S.cities.some(x => x.tz === c.tz && x.name === c.name)) S.cities.push({ id: newId(), name: c.name, where: c.where, tz: c.tz });
    save(); closeSheet('citySheet'); renderHead(); renderWorld(); animateIn($('main'));
  });
  function setHome(c) {
    S.set.home = c; save(); closeSheet('citySheet'); paintSettings(); renderHead(); renderWorld();
    toast('The main clock shows ' + (c ? c.name : 'this phone’s time') + '.');
  }
  $('cityHere').addEventListener('click', () => setHome(null));

  // ---------------------------------------------------------------------
  // Alarms: the next one, missed ones, Sleep | Wake Up, the list
  // ---------------------------------------------------------------------
  const sleepAsAlarm = () => ({ h: S.sleep.wake.h, m: S.sleep.wake.m, days: S.sleep.days, skip: S.sleep.skip });
  function nextAlarm() {
    const c = [];
    for (const a of S.alarms) { if (a.on && a.next) c.push({ t: a.next, label: a.label || 'Alarm', own: !!a.label }); if (a.snoozeAt) c.push({ t: a.snoozeAt, label: a.label || 'Alarm', own: !!a.label }); }
    const sl = S.sleep;
    if (sl.set && sl.on && sl.alarm && sl.next) c.push({ t: sl.next, label: 'Wake Up' });
    if (sl.snoozeAt) c.push({ t: sl.snoozeAt, label: 'Wake Up' });
    return c.sort((a, b) => a.t - b.t)[0] || null;
  }
  // When each alarm next rings; kept up to date after any change, and when the phone's zone changes.
  function schedule(t = now()) {
    for (const a of S.alarms) a.next = a.on ? L.nextRing(a, t) : null;
    const sl = S.sleep;
    if (sl.skip && sl.skip <= t) sl.skip = null;
    sl.next = sl.set && sl.on && sl.alarm && sl.days.length ? L.nextRing(sleepAsAlarm(), t) : null;
    sl.bedNext = sl.set && sl.on && sl.remind && sl.days.length ? L.nextRing({ h: sl.bed.h, m: sl.bed.m, days: L.bedDays(sl) }, t) : null;
    S.tz = hereZone();
  }
  function renderAlarms() {
    // missed while Clock was closed
    $('missed').innerHTML = S.missed.length ? `<div class="missed" role="status">${ICON.alert}<p>${S.missed.map(x => `<b${x.own ? ' translate="no"' : ''}>${esc(x.label)}</b> ${x.kind === 'timer' ? 'ended' : 'came due'} ${esc(pastLine(x.at))} while Clock was closed.`).join('<br>')}</p><button type="button" id="missedOk">OK</button></div>` : '';
    // Sleep | Wake Up
    const sl = S.sleep;
    if (!sl.set) $('sleepCard').innerHTML = `<div class="sleepoff"><span>No sleep schedule</span><button class="btn quiet" type="button" id="sleepSetup">Set Up</button></div>`;
    else {
      const len = L.hoursText(L.sleepMinutes(sl));
      const state = !sl.on ? 'Off' : sl.skip ? 'Skipping ' + whenLine(sl.skip) : sl.days.length ? L.repeatText(sl.days) : 'No days picked';
      $('sleepCard').innerHTML = `<div class="sleeprow${sl.on ? '' : ' off'}"><button class="sleepcard" type="button" id="sleepOpen"><span class="sl">${ICON.bed}<span>Wake Up · ${esc(state)}</span></span>`
        + `<span class="st"><b>${sl.alarm ? timeHTML(sl.wake.h, sl.wake.m) : 'No Alarm'}</b></span><span class="sm">Bedtime ${esc(L.clockLine(sl.bed.h, sl.bed.m, h24()))} · ${esc(len)} of sleep${sl.snoozeAt ? ' · <span class="snz">Snoozed until ' + esc(atLine(sl.snoozeAt)) + '</span>' : ''}</span></button>`
        + `<button class="switch" type="button" role="switch" id="sleepSw" aria-checked="${sl.on}" aria-label="Sleep schedule"></button></div>`;
    }
    // the rest, earliest in the day first
    const list = $('alarmList'), A = S.alarms.slice().sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
    list.hidden = !A.length; $('alarmEmpty').hidden = !!A.length;
    list.innerHTML = A.map(a => `<div class="arow${a.on ? '' : ' off'}" data-id="${esc(a.id)}">`
      + (editing ? `<button class="del" type="button" data-del="${esc(a.id)}" aria-label="Delete the ${esc(L.clockLine(a.h, a.m, h24()))} alarm">${ICON.minus}</button>` : '')
      + `<button class="open" type="button" data-open="${esc(a.id)}" aria-label="Edit the ${esc(L.clockLine(a.h, a.m, h24()))} alarm"><span class="at">${timeHTML(a.h, a.m)}</span><span class="al">${a.label ? '<span translate="no">' + esc(a.label) + '</span>' : 'Alarm'}${a.days.length ? ', ' + esc(L.repeatText(a.days)) : ''}${a.snoozeAt ? ' · <span class="snz">Snoozed until ' + esc(atLine(a.snoozeAt)) + '</span>' : ''}</span></button>`
      + (editing ? '' : `<button class="switch" type="button" role="switch" data-sw="${esc(a.id)}" aria-checked="${a.on}" aria-label="${esc(L.clockLine(a.h, a.m, h24()))} ${esc(a.label || 'alarm')}"></button>`) + '</div>').join('');
    paintSub();
  }
  $('p-alarms').addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#missedOk')) { S.missed = []; save(); renderAlarms(); return; }
    if (t.closest('#sleepSetup') || t.closest('#sleepOpen')) { openSleep(); return; }
    if (t.closest('#sleepSw')) { S.sleep.on = !S.sleep.on; S.sleep.snoozeAt = null; schedule(); save(); renderAlarms(); if (S.sleep.on) setToast(); return; }
    const sw = t.closest('[data-sw]');
    if (sw) { const a = S.alarms.find(x => x.id === sw.dataset.sw); if (!a) return; a.on = !a.on; if (!a.on) a.snoozeAt = null; schedule(); save(); renderAlarms(); if (a.on) setToast(a); return; }
    const op = t.closest('[data-open]'); if (op) { openAlarm(op.dataset.open); return; }
    const del = t.closest('[data-del]');
    if (del) {
      const i = S.alarms.findIndex(x => x.id === del.dataset.del); if (i < 0) return;
      const [gone] = S.alarms.splice(i, 1); save(); renderHead(); renderAlarms();
      toast('Alarm deleted.', () => { S.alarms.splice(i, 0, gone); schedule(); save(); renderHead(); renderAlarms(); });
    }
  });
  // "Alarm set for 7 hr 12 min from now." as the iPhone says it
  function setToast(a) {
    const t = a ? a.next : S.sleep.next;
    if (t) toast((a ? 'Alarm' : 'Wake-up alarm') + ' set for ' + L.untilText(t - now()) + ' from now.');
  }

  // The alarm editor
  let edit = null;   // the alarm being edited (a copy), and whether it's new
  function dayButtons(box, days) {
    const letter = i => { const d = new Date(2024, 0, 7 + i).toLocaleDateString('en-US', { weekday: 'short' }); return /^[A-Za-z]/.test(d) ? d.slice(0, 1) : d.slice(0, 1).toUpperCase() + d.slice(1, 2); };   // 7 January 2024 was a Sunday; in Russian two letters (Пн), as iOS has them
    box.innerHTML = L.DAY_SHORT.map((d, i) => `<button type="button" data-d="${i}" aria-pressed="${days.includes(i)}" aria-label="${L.DAY_LONG[i]}">${letter(i)}</button>`).join('');
  }
  function openAlarm(id) {
    const a = id ? S.alarms.find(x => x.id === id) : null;
    const d = new Date(now() + 60e3);
    edit = a ? { ...a, days: a.days.slice() } : { id: newId(), h: d.getHours(), m: d.getMinutes(), days: [], label: '', sound: 'twinbell', snooze: true, snoozeMin: 9, on: true, next: null, snoozeAt: null, fresh: true };
    $('alLbl').textContent = a ? 'Edit Alarm' : 'Add Alarm';
    $('alTime').value = pad(edit.h) + ':' + pad(edit.m);
    $('alLabel').value = edit.label;
    $('alDelete').hidden = !a;
    paintAlarmForm();
    openSheet('alarmSheet');
  }
  function paintAlarmForm() {
    dayButtons($('alDays'), edit.days);
    $('alDaySum').textContent = 'Repeat: ' + L.repeatText(edit.days);
    $('alSoundName').textContent = L.soundName(edit.sound);
    $('alSnooze').setAttribute('aria-checked', String(edit.snooze));
    $('alSnoozeLen').hidden = !edit.snooze;
    $('alSnoozeLen').innerHTML = SNOOZES.map(n => `<button type="button" data-n="${n}" aria-pressed="${edit.snoozeMin === n}">${n} min</button>`).join('');
  }
  $('alDays').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b) return; const d = +b.dataset.d; edit.days = edit.days.includes(d) ? edit.days.filter(x => x !== d) : L.cleanDays([...edit.days, d]); paintAlarmForm(); });
  $('alSnooze').addEventListener('click', () => { edit.snooze = !edit.snooze; paintAlarmForm(); });
  $('alSnoozeLen').addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b) { edit.snoozeMin = +b.dataset.n; paintAlarmForm(); } });
  $('alSound').addEventListener('click', () => openSounds(edit.sound, s => { edit.sound = s; paintAlarmForm(); }));
  $('alSave').addEventListener('click', () => {
    const m = /^(\d{1,2}):(\d{2})/.exec($('alTime').value || '');
    if (!m) { toast('Pick a time for the alarm.'); $('alTime').focus(); return; }
    edit.h = +m[1]; edit.m = +m[2]; edit.label = $('alLabel').value.trim().slice(0, 40); edit.on = true; edit.snoozeAt = null;
    const { fresh, ...a } = edit, i = S.alarms.findIndex(x => x.id === a.id);
    if (i >= 0) S.alarms[i] = a; else S.alarms.push(a);
    schedule(); save(); closeSheet('alarmSheet'); edit = null; renderHead(); renderAlarms(); setToast(S.alarms.find(x => x.id === a.id));
  });
  $('alDelete').addEventListener('click', () => {
    const i = S.alarms.findIndex(x => x.id === edit.id); if (i < 0) return;
    const [gone] = S.alarms.splice(i, 1); save(); closeSheet('alarmSheet'); edit = null; renderHead(); renderAlarms();
    toast('Alarm deleted.', () => { S.alarms.splice(i, 0, gone); schedule(); save(); renderHead(); renderAlarms(); });
  });

  // Sleep | Wake Up
  let sled = null;
  function openSleep() {
    const sl = S.sleep;
    sled = { ...sl, bed: { ...sl.bed }, wake: { ...sl.wake }, days: sl.days.slice(), on: sl.set ? sl.on : true };
    $('slBed').value = pad(sled.bed.h) + ':' + pad(sled.bed.m);
    $('slWake').value = pad(sled.wake.h) + ':' + pad(sled.wake.m);
    paintSleepForm(); openSheet('sleepSheet');
  }
  function paintSleepForm() {
    const rd = (inp, o) => { const m = /^(\d{1,2}):(\d{2})/.exec(inp.value || ''); if (m) { o.h = +m[1]; o.m = +m[2]; } };
    rd($('slBed'), sled.bed); rd($('slWake'), sled.wake);
    $('slOn').setAttribute('aria-checked', String(sled.on));
    $('slAlarm').setAttribute('aria-checked', String(sled.alarm));
    $('slSnooze').setAttribute('aria-checked', String(sled.snooze));
    $('slRemind').setAttribute('aria-checked', String(sled.remind));
    $('slSoundName').textContent = L.soundName(sled.sound);
    $('slLen').textContent = L.hoursText(L.sleepMinutes(sled)) + ' of sleep · wake up ' + L.repeatText(sled.days).replace(/^Every day$/, 'every day').replace(/^Never$/, 'on no days');
    dayButtons($('slDays'), sled.days);
    const nx = S.sleep.set && S.sleep.on && S.sleep.alarm ? L.nextRing(sleepAsAlarm(), now()) : null;
    $('slSkip').hidden = !nx || !!S.sleep.skip;
    if (nx) $('slSkip').textContent = 'Skip the next wake-up (' + whenLine(nx) + ')';
  }
  ['slBed', 'slWake'].forEach(id => $(id).addEventListener('change', paintSleepForm));
  $('slDays').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b) return; const d = +b.dataset.d; sled.days = sled.days.includes(d) ? sled.days.filter(x => x !== d) : L.cleanDays([...sled.days, d]); paintSleepForm(); });
  [['slOn', 'on'], ['slAlarm', 'alarm'], ['slSnooze', 'snooze'], ['slRemind', 'remind']].forEach(([id, k]) => $(id).addEventListener('click', () => { sled[k] = !sled[k]; paintSleepForm(); }));
  $('slSound').addEventListener('click', () => openSounds(sled.sound, s => { sled.sound = s; paintSleepForm(); }));
  $('slSkip').addEventListener('click', () => {
    const nx = L.nextRing(sleepAsAlarm(), now()); if (!nx) return;
    S.sleep.skip = nx; schedule(); save(); paintSleepForm(); renderAlarms(); toast('The ' + whenLine(nx) + ' wake-up is skipped.');
  });
  $('slSave').addEventListener('click', () => {
    paintSleepForm();
    const { next, bedNext, snoozeAt, ...keep } = sled;
    Object.assign(S.sleep, keep, { set: true, snoozeAt: null });
    schedule(); save(); closeSheet('sleepSheet'); renderAlarms(); if (S.sleep.on && S.sleep.alarm) setToast();
  });

  // Sounds: pick one, hear it
  let soundPick = null;
  function openSounds(cur, done) {
    soundPick = { cur, done };
    paintSounds(); openSheet('soundSheet');
  }
  function paintSounds() {
    $('sdList').innerHTML = L.SOUNDS.map(s => `<button class="snd${AUD.playing === s.id ? ' playing' : ''}" type="button" role="radio" aria-checked="${soundPick.cur === s.id}" data-s="${s.id}"><span class="pl">${ICON.speaker}</span><span class="grow"><b>${esc(s.name)}</b><small>${esc(s.d)}</small></span><span class="tick">${ICON.tick}</span></button>`).join('');
  }
  $('sdList').addEventListener('click', e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    soundPick.cur = b.dataset.s; soundPick.done(soundPick.cur);
    playSound(soundPick.cur, 3500).then(ok => { if (!ok) toast('Your phone didn’t play it. Check the volume and try again.'); paintSounds(); });
    paintSounds(); setTimeout(() => { if ($('soundSheet').hidden === false) paintSounds(); }, 3600);
  });

  // ---------------------------------------------------------------------
  // Stopwatch: only when it started (t0) and what came before (acc) are kept
  // ---------------------------------------------------------------------
  const swElapsed = (t = now()) => S.sw.acc + (S.sw.run ? t - S.sw.t0 : 0);
  function renderSW() {
    const an = S.sw.face === 'analog';
    $('swFace').innerHTML = an ? `<div class="ana">${swSVG()}</div>` : '<div class="dig" id="swDig">00:00.00</div>';
    document.querySelectorAll('#swDots [data-face]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.face === S.sw.face)));
    const el = swElapsed(), run = S.sw.run;
    $('swLeft').textContent = run || !el ? 'Lap' : 'Reset';
    $('swLeft').disabled = !run && !el;
    $('swRight').textContent = run ? 'Stop' : 'Start';
    $('swRight').classList.toggle('go', !run); $('swRight').classList.toggle('stop', run);
    const laps = S.sw.laps, mk = L.lapMarks(laps), started = el > 0;
    $('laps').hidden = !started;
    $('laps').innerHTML = (started ? `<div class="lrow now"><span>Lap ${laps.length + 1}</span><span id="lapNow"></span></div>` : '')
      + laps.map((v, i) => ({ v, i })).reverse().map(({ v, i }) => `<div class="lrow${i === mk.best ? ' best' : i === mk.worst ? ' worst' : ''}"><span>Lap ${i + 1}${i === mk.best ? '<small>Fastest</small>' : i === mk.worst ? '<small>Slowest</small>' : ''}</span><span>${L.swText(v)}</span></div>`).join('');
    paintSW();
    paintSub();
  }
  function paintSW() {
    const el = swElapsed(), txt = L.swText(el), lapNow = el - S.sw.laps.reduce((a, b) => a + b, 0);
    const dg = $('swDig'); if (dg) dg.textContent = txt;
    const ad = $('swAnaDg'); if (ad) ad.textContent = txt;
    const ln = $('lapNow'); if (ln) ln.textContent = L.swText(lapNow);
    const svg = $('swFace').querySelector('svg');
    if (svg) {
      const r = (sel, deg, cy = 100) => { const e = svg.querySelector(sel); if (e) e.setAttribute('transform', 'rotate(' + deg.toFixed(2) + ' 100 ' + cy + ')'); };
      r('.sh', (el / 1000 % 60) * 6); r('.subh', (el / 60000 % 30) * 12, 62);
      const lh = svg.querySelector('.lh'); if (lh) { lh.setAttribute('opacity', S.sw.laps.length ? '1' : '0'); r('.lh', (lapNow / 1000 % 60) * 6); }
    }
  }
  $('swRight').addEventListener('click', () => {
    const t = now();
    if (S.sw.run) { S.sw.acc += t - S.sw.t0; S.sw.run = false; }
    else { S.sw.t0 = t; S.sw.run = true; }
    save(); renderSW(); loop();
  });
  $('swLeft').addEventListener('click', () => {
    if (S.sw.run) { const el = swElapsed(); S.sw.laps.push(el - S.sw.laps.reduce((a, b) => a + b, 0)); }
    else { S.sw.acc = 0; S.sw.laps = []; S.sw.t0 = 0; }
    save(); renderSW();
  });
  function flipFace(to) { S.sw.face = to || (S.sw.face === 'analog' ? 'digital' : 'analog'); save(); renderSW(); }
  $('swFace').addEventListener('click', () => flipFace());
  $('swFace').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipFace(); } });
  $('swDots').addEventListener('click', e => { const b = e.target.closest('[data-face]'); if (b) flipFace(b.dataset.face); });
  // swipe sideways on the face, as on the iPhone
  { let x0 = null; const f = $('swFace');
    f.addEventListener('touchstart', e => { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    f.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) { e.preventDefault(); flipFace(dx < 0 ? 'analog' : 'digital'); } }); }

  // ---------------------------------------------------------------------
  // Timers
  // ---------------------------------------------------------------------
  const tLeft = (x, t = now()) => x.state === 'run' ? Math.max(0, x.end - t) : x.state === 'pause' ? x.left : 0;
  const PRESETS = [60, 180, 300, 600, 900, 1800, 3600];
  // the three wheels: hours, minutes, seconds
  const WH = [['h', 24, 'hours', 'Hours'], ['m', 60, 'min', 'Minutes'], ['s', 60, 'sec', 'Seconds']];
  function buildWheels() {
    $('wheels').innerHTML = WH.map(([k, n, u, name]) => `<div class="wheel" data-k="${k}" tabindex="0" role="spinbutton" aria-label="${name}" aria-valuemin="0" aria-valuemax="${n - 1}"><ol>`
      + Array.from({ length: n }, (_, i) => `<li>${i}${'<span>' + (k === 'h' && i === 1 ? 'hour' : u) + '</span>'}</li>`).join('') + '</ol></div>').join('');
    $('presets').innerHTML = PRESETS.map(s => `<button class="chip" type="button" data-p="${s}">${esc(L.durText(s))}</button>`).join('');
    document.querySelectorAll('.wheel').forEach(w => {
      let t;
      w.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => readWheel(w), 90); }, { passive: true });
      w.addEventListener('keydown', e => {
        const k = w.dataset.k, max = k === 'h' ? 23 : 59, d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        if (!d) return; e.preventDefault(); S.pick[k] = Math.max(0, Math.min(max, S.pick[k] + d)); setWheels(true); pickChanged();
      });
    });
    setWheels(false);
  }
  function readWheel(w) {
    const k = w.dataset.k, max = k === 'h' ? 23 : 59, v = Math.max(0, Math.min(max, Math.round(w.scrollTop / 40)));
    if (S.pick[k] !== v) { S.pick[k] = v; pickChanged(); }
    w.setAttribute('aria-valuenow', String(v)); w.setAttribute('aria-valuetext', v + ' ' + (k === 'h' ? 'hours' : k === 'm' ? 'minutes' : 'seconds'));
  }
  function setWheels(smooth) {
    document.querySelectorAll('.wheel').forEach(w => {
      const v = S.pick[w.dataset.k], top = v * 40;
      if (Math.abs(w.scrollTop - top) > 1) { try { w.scrollTo({ top, behavior: smooth && !calm() ? 'smooth' : 'auto' }); } catch { w.scrollTop = top; } }
      w.setAttribute('aria-valuenow', String(v)); w.setAttribute('aria-valuetext', v + ' ' + (w.dataset.k === 'h' ? 'hours' : w.dataset.k === 'm' ? 'minutes' : 'seconds'));
    });
    pickChanged(true);
  }
  const pickMs = () => (S.pick.h * 3600 + S.pick.m * 60 + S.pick.s) * 1000;
  function pickChanged(quiet) { $('tStart').disabled = !pickMs(); if (!quiet) save(); }
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('presets').addEventListener('click', e => {
    const b = e.target.closest('[data-p]'); if (!b) return; const s = +b.dataset.p;
    S.pick = { h: Math.floor(s / 3600), m: Math.floor(s / 60) % 60, s: s % 60 }; setWheels(true); save();
  });
  $('tSound').addEventListener('click', () => openSounds(S.tsound, s => { S.tsound = s; save(); $('tSoundName').textContent = L.soundName(s); }));
  function startTimer(dur, label, sound) {
    const t = now();
    S.timers.unshift({ id: newId(), label, dur, sound, end: t + dur, left: null, state: 'run', made: t });
    S.recents = [{ dur, label, sound }, ...S.recents.filter(r => !(r.dur === dur && r.label === label))].slice(0, 10);
    save(); renderTimers(); loop();
  }
  $('tStart').addEventListener('click', () => { const d = pickMs(); if (d) { startTimer(d, $('tLabel').value.trim().slice(0, 40), S.tsound); $('tLabel').value = ''; } });
  function renderTimers() {
    const T = S.timers.filter(x => x.state !== 'done');
    $('runTimers').hidden = !T.length;
    $('runTimers').innerHTML = T.map(x => `<div class="trow${x.state === 'pause' ? ' paused' : ''}" data-id="${esc(x.id)}">`
      + '<div class="tring" aria-hidden="true"><svg viewBox="0 0 64 64"><circle class="bgc" cx="32" cy="32" r="28"/><circle class="fgc" cx="32" cy="32" r="28" stroke-dasharray="175.93" stroke-dashoffset="0"/></svg></div>'
      + `<div class="tt"><b data-left></b><small><span${x.label ? ' translate="no"' : ''}>${esc(x.label || L.durText(x.dur / 1000))}</span><span data-end></span></small></div>`
      + `<div class="tb"><button class="mini" type="button" data-cancel="${esc(x.id)}" aria-label="Cancel the ${esc(x.label || L.durText(x.dur / 1000))} timer">${ICON.close}</button>`
      + `<button class="mini go" type="button" data-pp="${esc(x.id)}" aria-label="${x.state === 'run' ? 'Pause' : 'Resume'} the ${esc(x.label || L.durText(x.dur / 1000))} timer">${x.state === 'run' ? ICON.pause : ICON.play}</button></div></div>`).join('');
    $('tSoundName').textContent = L.soundName(S.tsound);
    $('recentHead').hidden = $('recents').hidden = !S.recents.length;
    $('recents').innerHTML = S.recents.map((r, i) => `<div class="rrow"><div class="rt"><b>${esc(L.leftText(r.dur))}</b><small${r.label ? ' translate="no"' : ''}>${esc(r.label || L.durText(r.dur / 1000))}</small></div>`
      + `<button class="x" type="button" data-rx="${i}" aria-label="Remove from Recents">${ICON.close}</button><button class="mini go" type="button" data-rs="${i}" aria-label="Start ${esc(r.label || L.durText(r.dur / 1000))}">${ICON.play}</button></div>`).join('');
    paintTimers(); paintSub(); setWheels(false);
  }
  function paintTimers() {
    const t = now();
    for (const row of $('runTimers').children) {
      const x = S.timers.find(y => y.id === row.dataset.id); if (!x) continue;
      const left = tLeft(x, t), lt = L.leftText(left);
      const b = row.querySelector('[data-left]'); if (b.textContent !== lt) b.textContent = lt;
      const e = row.querySelector('[data-end]'), et = x.state === 'run' ? ' · ' + atLine(x.end) : ' · Paused';
      if (e.textContent !== et) e.textContent = et;
      row.querySelector('.fgc').setAttribute('stroke-dashoffset', (175.93 * (1 - left / x.dur)).toFixed(2));
    }
  }
  $('p-timers').addEventListener('click', e => {
    const t = e.target, at = now();
    const pp = t.closest('[data-pp]');
    if (pp) { const x = S.timers.find(y => y.id === pp.dataset.pp); if (!x) return;
      if (x.state === 'run') { x.left = Math.max(0, x.end - at); x.state = 'pause'; x.end = null; } else { x.end = at + x.left; x.left = null; x.state = 'run'; }
      save(); renderTimers(); loop(); return; }
    const c = t.closest('[data-cancel]');
    if (c) { S.timers = S.timers.filter(y => y.id !== c.dataset.cancel); save(); renderTimers(); return; }
    const rs = t.closest('[data-rs]'); if (rs) { const r = S.recents[+rs.dataset.rs]; if (r) startTimer(r.dur, r.label, r.sound); return; }
    const rx = t.closest('[data-rx]'); if (rx) { S.recents.splice(+rx.dataset.rx, 1); save(); renderTimers(); return; }
    if (t.closest('#recentClear')) { const was = S.recents.slice(); S.recents = []; save(); renderTimers(); toast('Recents cleared.', () => { S.recents = was; save(); renderTimers(); }); }
  });

  // ---------------------------------------------------------------------
  // Ringing: one at a time, the rest wait their turn
  // ---------------------------------------------------------------------
  const RING = [];   // { kind: 'alarm' | 'sleep' | 'timer' | 'bed', id, label, at, sound, snooze, snoozeMin }
  let ringStart = 0;
  function due(r, late) {
    if (r.kind === 'bed' && late > LATE) return;   // a bedtime chime long gone isn't worth a word
    if (late > LATE) { S.missed.push({ kind: r.kind === 'timer' ? 'timer' : 'alarm', label: r.label, at: r.at, own: !!r.own }); S.missed = S.missed.slice(-10); return; }
    if (r.kind === 'bed') { if (!RING.length) { playSound('chimes', 4500); toast('Bedtime: ' + L.clockLine(S.sleep.bed.h, S.sleep.bed.m, h24()) + '. Your wake-up is ' + (S.sleep.next ? whenLine(S.sleep.next) : 'off') + '.', null, 9000); } return; }
    RING.push(r);
    if (RING.length === 1) showRing();
    else $('rMore').textContent = (RING.length - 1) + ' more waiting';
  }
  function showRing() {
    const r = RING[0], box = $('ring');
    if (!r) { if (!box.hidden) { box.hidden = true; stopSound(); lockPage(); if (ringFocus && document.contains(ringFocus)) ringFocus.focus(); } return; }
    if (box.hidden) ringFocus = document.activeElement;
    const d = new Date(r.kind === 'timer' ? now() : r.at);
    $('rKind').textContent = r.kind === 'timer' ? 'Timer' : r.kind === 'sleep' ? 'Wake Up' : 'Alarm';
    $('rTime').innerHTML = timeHTML(d.getHours(), d.getMinutes());
    if (r.own) $('rLabel').setAttribute('translate', 'no'); else $('rLabel').removeAttribute('translate');   // a label typed in stays as it is in Russian
    $('rLabel').textContent = r.label;
    $('rNote').textContent = r.kind === 'timer' ? 'Ended at ' + atLine(r.at) : '';
    $('rSnooze').hidden = r.kind === 'timer' ? false : !r.snooze;
    $('rSnooze').textContent = r.kind === 'timer' ? 'Repeat' : 'Snooze ' + r.snoozeMin + ' min';
    $('rMore').textContent = RING.length > 1 ? (RING.length - 1) + ' more waiting' : '';
    box.hidden = false; lockPage(); ringStart = now();
    $('rStop').focus();
    ringSound();
  }
  let ringFocus = null;
  function ringSound() {
    const r = RING[0]; if (!r) return;
    playSound(r.sound).then(ok => { if (!ok && RING[0] === r) $('rNote').textContent = (r.kind === 'timer' ? 'Ended at ' + atLine(r.at) + '. ' : '') + 'Tap anywhere to hear it.'; });
  }
  function finishRing(snooze) {
    const r = RING.shift(); if (!r) return;
    stopSound();
    if (r.kind === 'timer') {
      const x = S.timers.find(y => y.id === r.id);
      S.timers = S.timers.filter(y => y.id !== r.id);
      if (snooze && x) startTimer(x.dur, x.label, x.sound);
    } else if (snooze) {
      const at = now() + r.snoozeMin * 60e3;
      if (r.kind === 'sleep') S.sleep.snoozeAt = at; else { const a = S.alarms.find(y => y.id === r.id); if (a) a.snoozeAt = at; }
      toast('Snoozed until ' + atLine(at) + '.');
    }
    save(); showRing(); renderHead(); renderPane(S.tab);
  }
  $('rStop').addEventListener('click', () => finishRing(false));
  $('rSnooze').addEventListener('click', () => finishRing(true));

  // ---------------------------------------------------------------------
  // The tick: what's due rings; the clocks on screen move
  // ---------------------------------------------------------------------
  function tick() {
    const t = now();
    let changed = false;
    const missed = S.missed.length;
    for (const a of S.alarms) {
      const base = { kind: 'alarm', id: a.id, label: a.label || 'Alarm', own: !!a.label, sound: a.sound, snooze: a.snooze, snoozeMin: a.snoozeMin };
      if (a.snoozeAt && t >= a.snoozeAt) { const at = a.snoozeAt; a.snoozeAt = null; changed = true; due({ ...base, at }, t - at); }
      if (a.on && a.next && t >= a.next) {
        const at = a.next; changed = true;
        if (a.days.length) a.next = L.nextRing(a, t); else { a.on = false; a.next = null; }   // a one-time alarm turns itself off
        due({ ...base, at }, t - at);
      }
    }
    const sl = S.sleep, sbase = { kind: 'sleep', id: 'sleep', label: 'Wake Up', sound: sl.sound, snooze: sl.snooze, snoozeMin: sl.snoozeMin };
    if (sl.snoozeAt && t >= sl.snoozeAt) { const at = sl.snoozeAt; sl.snoozeAt = null; changed = true; due({ ...sbase, at }, t - at); }
    if (sl.next && t >= sl.next) { const at = sl.next; changed = true; schedule(t); due({ ...sbase, at }, t - at); }
    if (sl.bedNext && t >= sl.bedNext) { const at = sl.bedNext; changed = true; schedule(t); due({ kind: 'bed', id: 'bed', label: 'Bedtime', at }, t - at); }
    for (const x of S.timers) if (x.state === 'run' && t >= x.end) {
      x.state = 'done'; changed = true;
      due({ kind: 'timer', id: x.id, label: x.label || L.durText(x.dur / 1000) + ' timer', own: !!x.label, at: x.end, sound: x.sound }, t - x.end);
      if (t - x.end > LATE) S.timers = S.timers.filter(y => y.id !== x.id);
    }
    // the phone moved zones: alarms follow the clock on the wall (after what was already due has rung)
    if (S.tz !== hereZone()) { schedule(t); changed = true; }
    if (RING.length && AUD.playing && t - ringStart > 15 * 60e3) { stopSound(); $('rNote').textContent = 'Rang for 15 minutes.'; }
    if (changed) { save(); renderHead(); renderPane(S.tab); }
    if (S.missed.length > missed) { const x = S.missed[S.missed.length - 1]; toast(x.label + (x.kind === 'timer' ? ' ended ' : ' came due ') + pastLine(x.at) + ', while Clock was closed.', null, 8000); }
    paint();
  }
  function paint() {
    if (document.hidden) return;
    paintSub();
    if (S.tab === 'world') paintWorld();
    else if (S.tab === 'timers') paintTimers();
    else if (S.tab === 'stopwatch' && !S.sw.run) paintSW();
    if (!$('night').hidden) paintNight();
  }
  setInterval(tick, 250);
  // the stopwatch's hundredths: every frame while it runs on screen
  let raf = 0;
  function loop() {
    if (raf) return;
    const step = () => { raf = 0; if (document.hidden || S.tab !== 'stopwatch' || !S.sw.run) return; paintSW(); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); loop(); if (!$('night').hidden) keepAwake(true); } });

  // ---------------------------------------------------------------------
  // Nightstand: dark, big, and the screen kept on
  // ---------------------------------------------------------------------
  let lock = null, calmT = 0;
  async function keepAwake(on) {
    if (!on) { try { if (lock) await lock.release(); } catch {} lock = null; return; }
    if (lock || !('wakeLock' in navigator)) { if (!('wakeLock' in navigator)) warnNight(false); return; }
    try { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); warnNight(true); }
    catch { warnNight(false); }
  }
  function warnNight(ok) {
    $('nWarn').textContent = ok ? 'Screen stays on: keep your phone on charge.'
      : 'Set Auto-Lock to Never tonight, or alarms may not ring.';
  }
  function openNight() {
    const n = $('night');
    nightFocus = document.activeElement;
    $('nWarn').textContent = '';
    n.hidden = false; lockPage(); paintNight(true); keepAwake(true); wake();
    $('nClose').focus();
  }
  let nightFocus = null;
  function closeNight() { $('night').hidden = true; keepAwake(false); lockPage(); if (nightFocus && document.contains(nightFocus)) nightFocus.focus(); }
  function wake() { const n = $('night'); n.classList.remove('calm'); clearTimeout(calmT); calmT = setTimeout(() => n.classList.add('calm'), 5000); }
  function paintNight(fresh) {
    const t = now(), d = new Date(t), an = !!S.set.analog;
    const fb = $('nFaceBox');
    if (fresh || fb.hidden === an) { fb.hidden = !an; fb.innerHTML = an ? faceSVG('big') : ''; $('nTime').hidden = an; }
    if (an) setHands(fb.querySelector('svg'), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
    else {
      const c = L.clockText(d.getHours(), d.getMinutes(), h24(), null);
      const html = esc(c.time) + (S.set.secs ? '<i>:' + pad(d.getSeconds()) + '</i>' : '') + (c.ap ? '<span>' + c.ap + '</span>' : '');
      if ($('nTime').innerHTML !== html) $('nTime').innerHTML = html;
    }
    const dl = dayLine(t); if ($('nDate').textContent !== dl) $('nDate').textContent = dl;
    const nx = nextAlarm(), al = nx ? ICON.bell + '<span><span' + (nx.own ? ' translate="no"' : '') + '>' + esc(nx.label) + '</span> ' + esc(whenLine(nx.t)) + '</span>' : '<span>No alarm set</span>';
    if ($('nAlarm').innerHTML !== al) $('nAlarm').innerHTML = al;
  }
  $('nightBtn').addEventListener('click', openNight);
  $('nClose').addEventListener('click', e => { e.stopPropagation(); closeNight(); });
  $('nFace').addEventListener('click', e => { e.stopPropagation(); S.set.analog = !S.set.analog; save(); paintNight(true); wake(); paintSettings(); });
  $('night').addEventListener('click', wake);

  // ---------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------
  function paintSettings() {
    if (S.set.home) $('setHomeName').setAttribute('translate', 'no'); else $('setHomeName').removeAttribute('translate');   // a place name stays as it is in Russian
    $('setHomeName').textContent = S.set.home ? S.set.home.name : phoneName() + ' (this phone)';
    document.querySelectorAll('#setDesign [data-design]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.design === S.set.design)));
    $('set24').setAttribute('aria-checked', String(h24()));
    $('setSecs').setAttribute('aria-checked', String(!!S.set.secs));
    $('setAnalog').setAttribute('aria-checked', String(!!S.set.analog));
  }
  $('setBtn').addEventListener('click', () => { paintSettings(); openSheet('setSheet'); });
  // Design: Vintage, Standard, Night Drive, Folk or Grid, at once (design.js swaps the style sheet, the sky, the icon iOS would take)
  $('setDesign').addEventListener('click', e => {
    const b = e.target.closest('[data-design]'); if (!b || b.dataset.design === S.set.design) return;
    S.set.design = b.dataset.design; save();
    if (window.clockDesign) clockDesign.set(S.set.design);
    paintSettings(); requestAnimationFrame(() => slideTabs(true));   // Futura and the system font are different widths
  });
  // aOS's Appearance picked a look for every app (design.js has applied it): keep it, so a save here doesn't put the old one back
  addEventListener('clock:design', () => { if (window.clockDesign && clockDesign.get() !== S.set.design) { S.set.design = clockDesign.get(); paintSettings(); } });
  $('setHome').addEventListener('click', () => openCities('home'));
  $('set24').addEventListener('click', () => { S.set.h24 = !h24(); S.set.h24Picked = true; save(); paintSettings(); renderPane(S.tab); });   // picked: kept in either language
  [['setSecs', 'secs'], ['setAnalog', 'analog']].forEach(([id, k]) => $(id).addEventListener('click', () => { S.set[k] = !S.set[k]; save(); paintSettings(); renderPane(S.tab); }));
  $('setTest').addEventListener('click', () => {
    const a = S.alarms.find(x => x.on) || S.alarms[0];
    playSound(a ? a.sound : 'twinbell', 4000).then(ok => toast(ok ? 'Playing ' + L.soundName(a ? a.sound : 'twinbell') + '.' : 'Your phone didn’t play it. Check the volume and try again.'));
  });

  // ---------------------------------------------------------------------
  // Sheets and the toast (as in Fitness)
  // ---------------------------------------------------------------------
  const focusStack = [];
  function lockPage() { document.documentElement.classList.toggle('locked', [...document.querySelectorAll('.sheetwrap')].some(w => !w.hidden) || !$('night').hidden || !$('ring').hidden); }
  function openSheet(id) { focusStack.push(document.activeElement); $(id).hidden = false; lockPage(); }
  function closeSheet(id) {
    if ($(id).hidden) return;
    $(id).hidden = true; lockPage();
    if (id === 'soundSheet' && !RING.length) stopSound();
    const f = focusStack.pop(); if (f && f.focus && document.contains(f)) f.focus();
  }
  const closers = { alarmSheet: () => { closeSheet('alarmSheet'); edit = null; }, sleepSheet: () => { closeSheet('sleepSheet'); sled = null; } };
  const closeWrap = w => (closers[w.id] || (() => closeSheet(w.id)))();
  document.querySelectorAll('.sheetwrap').forEach(w => w.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeWrap(w); }));
  if (window.visualViewport) {
    const vv = window.visualViewport, root = document.documentElement.style;
    const fit = () => { root.setProperty('--vvh', vv.height + 'px'); root.setProperty('--vvt', vv.offsetTop + 'px'); };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
  }
  // Drag a sheet down by its handle or title bar to close it.
  document.querySelectorAll('.sheetwrap').forEach(w => {
    const sheet = w.querySelector('.sheet'), scrim = w.querySelector('.scrim');
    let y0 = null, t0 = 0, dy = 0, drag = false, suppress = false;
    const reset = () => { sheet.classList.remove('dragging', 'settling'); sheet.style.transform = ''; scrim.style.opacity = ''; };
    const start = (y, target) => { if (!target.closest('.grab, .sheethead') || target.closest('button')) { y0 = null; return; } y0 = y; t0 = Date.now(); dy = 0; drag = false; };
    const move = (y, e) => {
      if (y0 === null) return;
      dy = y - y0;
      if (!drag) { if (dy < 8) return; drag = true; sheet.classList.add('dragging'); }
      if (e.cancelable) e.preventDefault();
      const dd = Math.max(0, dy);
      sheet.style.transform = 'translateY(' + dd + 'px)'; scrim.style.opacity = String(Math.max(0, 1 - dd / sheet.offsetHeight));
    };
    const end = () => {
      if (y0 === null) return;
      y0 = null;
      if (!drag) return;
      suppress = true; setTimeout(() => { suppress = false; }, 50);
      const fast = dy / Math.max(1, Date.now() - t0) > 0.5;
      sheet.classList.remove('dragging'); sheet.classList.add('settling');
      if (dy > 110 || (fast && dy > 30)) { sheet.style.transform = 'translateY(100%)'; scrim.style.opacity = '0'; setTimeout(() => { closeWrap(w); reset(); }, 260); }
      else { sheet.style.transform = ''; scrim.style.opacity = ''; setTimeout(reset, 300); }
    };
    sheet.addEventListener('touchstart', e => { if (e.touches.length === 1) start(e.touches[0].clientY, e.target); }, { passive: true });
    sheet.addEventListener('touchmove', e => move(e.touches[0].clientY, e), { passive: false });
    sheet.addEventListener('touchend', end); sheet.addEventListener('touchcancel', end);
    sheet.addEventListener('mousedown', e => { if (e.button === 0) start(e.clientY, e.target); });
    window.addEventListener('mousemove', e => move(e.clientY, e)); window.addEventListener('mouseup', end);
    sheet.addEventListener('click', e => { if (suppress) { e.stopPropagation(); e.preventDefault(); } }, true);
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !$('ring').hidden) return;
    const open = [...document.querySelectorAll('.sheetwrap')].reverse().find(w => !w.hidden);
    if (open) closeWrap(open); else if (!$('night').hidden) closeNight();
  });
  let toastTimer;
  function toast(msg, undo, ms) {
    $('toastMsg').textContent = msg;
    $('toastAct').hidden = !undo;
    $('toastAct').onclick = () => { undo(); $('toast').hidden = true; };
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, ms || 4000);
  }

  // ---------------------------------------------------------------------
  // Start: catch up on anything that came due while Clock was closed, then draw
  // ---------------------------------------------------------------------
  for (const a of S.alarms) if (a.on && !a.next) a.next = L.nextRing(a, now());
  if (S.sleep.set && S.sleep.on && !S.sleep.next && !S.sleep.bedNext) schedule();
  tick();
  schedule(); save();
  buildWheels();
  setTab(S.tab, true);
  renderAlarms();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // For the tests (clock/scripts/app-test.mjs) only.
  window.__clock = { S, tick, schedule, setTab, render: () => renderPane(S.tab), ring: () => RING.slice(), audio: () => ({ unlocked: AUD.unlocked, playing: AUD.playing }), openNight, closeNight };
})();
