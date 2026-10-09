"use strict";

// Travel: every flight, hotel and car hire in one place.
//
// - Bookings come from Gmail (read on the phone, read-only), from a pasted
//   confirmation, or typed in. parse.js does the reading.
// - Bookings close together in time make a trip; each trip is a timeline.
// - Flights close to departure get live status from travel/api/flight (a
//   Cloudflare Pages Function holding the flight data key).
// - A Google Sheet keeps both phones in step, as in Notes.
// - Explore and each trip link out to Google Flights, Google Hotels,
//   Marriott and car hire searches, filled in.

// Refuse to run inside another page's frame (see Mail's app.js for why).
if (window.top !== window.self) {
  document.body.textContent = 'Travel can’t be opened inside another page.';
  throw new Error('Travel refuses to run inside a frame');
}

(function () {
  const P = window.TravelParse;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del: k => { try { localStorage.removeItem(k); } catch {} },
    json: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
  };
  const plural = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
  const pad = n => String(n).padStart(2, '0');
  const H = 3600e3, D = 24 * H;

  // ---------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------
  // Mail's OAuth client (not a secret: see mail/app.js). Travel's own address
  // must be added to it as a redirect URI once - travel/README.md, "Gmail".
  const CLIENT_ID = '804406956056-e91hbdndc4cqgerh9sffl9fmt76nfpua.apps.googleusercontent.com';
  const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
  const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
  const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
  const KEY = 'allison-travel-v1';
  const K = {
    token: 'travel.token', state: 'travel.state', silent: 'travel.silent', silentFail: 'travel.silentFail', lastAuth: 'travel.lastAuth', hint: 'travel.hint', me: 'travel.me',
    seen: KEY + '-seen', lastScan: KEY + '-scan', queryV: KEY + '-query-v', live: KEY + '-live', lookups: KEY + '-lookups', tab: KEY + '-tab', when: KEY + '-when',
    sync: KEY + '-sync', graves: KEY + '-graves', syncAt: KEY + '-sync-at', explore: KEY + '-explore',
  };
  const FIRST_SCAN = 'newer_than:1y';
  const MAX_SCAN = 400;              // messages read in one go at most
  const LOOKUPS_A_MONTH = 250;       // per phone; meant to stay inside AeroDataBox's free plan (README, "What I could not verify")
  // Booking emails: the subjects they use, and the senders you book with.
  const SENDERS = ['united.com', 'delta.com', 'aa.com', 'southwest.com', 'alaskaair.com', 'jetblue.com', 'flyfrontier.com',
    'flybreeze.com', 'spirit.com', 'hawaiianairlines.com', 'allegiantair.com', 'suncountry.com', 'aircanada.com', 'westjet.com',
    'britishairways.com', 'virginatlantic.com', 'marriott.com', 'nationalcar.com', 'enterprise.com', 'alamo.com', 'hertz.com', 'avis.com'];
  const SUBJECTS = ['confirmation', 'confirmed', 'itinerary', 'reservation', 'booking', 'eticket', '"e-ticket"', 'receipt', '"your trip"',
    '"your flight"', '"your stay"', '"check in"', 'cancelled', 'canceled', 'cancellation'];
  // Plus anything Mail's Travel auto-tag has labelled (rides, Hopper, gate and
  // delay notices): Gmail keeps that label up to date as mail arrives.
  const QUERY = '-in:chats -in:spam -in:trash -category:promotions {label:Travel ' + SUBJECTS.map(s => 'subject:' + s).join(' ') + ' ' + SENDERS.map(s => 'from:' + s).join(' ') + '}';
  const QUERY_V = '2';               // when QUERY widens, the next scan looks back FIRST_SCAN once more

  const I = {
    flight: '<svg viewBox="0 0 24 24"><path d="M3.2 13.6l5.4 1.3L6 19.6l1.9.5 4.4-4.3 5.6 1.4a2 2 0 0 0 2.4-1.5v0a2 2 0 0 0-1.4-2.4l-5.6-1.4-1.6-6-1.9-.5-.4 5.4-3.1-.8-1.5-2-1.4-.4.5 3.5z"/></svg>',
    hotel: '<svg viewBox="0 0 24 24"><path d="M3.2 19.6V6.4"/><path d="M3.2 15.2h17.6v4.4"/><path d="M20.8 15.2v-3.4a3 3 0 0 0-3-3h-6.6v6.4"/><circle cx="7.4" cy="11.4" r="2"/></svg>',
    car: '<svg viewBox="0 0 24 24"><path d="M4 15.8v-3.2l1.8-4.5a2.4 2.4 0 0 1 2.2-1.5h8a2.4 2.4 0 0 1 2.2 1.5l1.8 4.5v3.2a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 15.8z"/><path d="M4 12.6h16"/><path d="M6.6 17.2v1.6M17.4 17.2v1.6"/><circle cx="7.6" cy="14.8" r=".6" class="fs"/><circle cx="16.4" cy="14.8" r=".6" class="fs"/></svg>',
    other: '<svg viewBox="0 0 24 24"><rect x="3.8" y="4.6" width="16.4" height="16" rx="3.2"/><path d="M3.8 9.6h16.4M8.4 2.8v3.6M15.6 2.8v3.6"/></svg>',
    plane: '<svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>',
    check: '<svg viewBox="0 0 24 24" class="b"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="2.8" y="5" width="18.4" height="14" rx="3.4"/><path d="M3.6 7.4l7.2 5a2 2 0 0 0 2.4 0l7.2-5"/></svg>',
    map: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.6-5.6-6.6-11a6.6 6.6 0 0 1 13.2 0c0 5.4-6.6 11-6.6 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3.4" y="4.6" width="17.2" height="16" rx="3.2"/><path d="M3.4 9.6h17.2M8 2.8v3.6M16 2.8v3.6"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="7.2"/><path d="M16.2 16.2l4.3 4.3"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M13.6 4h6.4v6.4"/><path d="M20 4l-9 9"/><path d="M17.6 13.6v3.6a2.8 2.8 0 0 1-2.8 2.8H6.8A2.8 2.8 0 0 1 4 17.2V9.2a2.8 2.8 0 0 1 2.8-2.8h3.6"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M20 11.2a8 8 0 0 0-14.6-4.4L4 8.4"/><path d="M4 3.8v4.6h4.6"/><path d="M4 12.8a8 8 0 0 0 14.6 4.4l1.4-1.6"/><path d="M20 20.2v-4.6h-4.6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" class="b"><path d="M12 5.2v13.6M5.2 12h13.6"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M9.6 20H6.8A2.8 2.8 0 0 1 4 17.2V6.8A2.8 2.8 0 0 1 6.8 4h2.8"/><path d="M15.4 16.6l4.1-4.1a.7.7 0 0 0 0-1l-4.1-4.1M19.6 12H9.4"/></svg>',
  };
  const TYPE_NAME = { flight: 'Flight', hotel: 'Hotel', car: 'Car hire', other: 'Other' };

  // ---------------------------------------------------------------------
  // Data: bookings (and trip names), kept like Notes keeps notes
  // ---------------------------------------------------------------------
  const saved = ls.json(KEY, null);
  let bookings = saved && Array.isArray(saved.bookings) ? saved.bookings : [];
  let trips = saved && Array.isArray(saved.trips) ? saved.trips : [];        // {id (first booking's id), name, updated}
  let graves = ls.json(K.graves, {});
  let seen = new Set(ls.json(K.seen, []));
  let live = ls.json(K.live, {});                                            // booking id -> {at, leg, error}
  let syncCfg = ls.json(K.sync, null);
  const shadow = new Map();
  const st = { tab: ls.get(K.tab, 'trips'), when: ls.get(K.when, 'upcoming'), trip: null, booking: null, isNew: false, scanning: false, scanDone: 0, scanTotal: 0 };

  // IndexedDB copy of the Sheet link and code, as in Notes: survives a full
  // or cleared localStorage (every AllisonOS app shares its space).
  const keep = (() => {
    let db = null;
    const open = () => db || (db = new Promise((res, rej) => {
      const r = indexedDB.open('allison-travel', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = (mode, fn) => open().then(d => new Promise((res, rej) => {
      const t = d.transaction('kv', mode), q = fn(t.objectStore('kv'));
      t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error);
    }));
    return {
      get: k => tx('readonly', s => s.get(k)).catch(() => null),
      set: (k, v) => tx('readwrite', s => v == null ? s.delete(k) : s.put(v, k)).catch(() => {}),
    };
  })();

  // What each item looked like at the last save: any change stamps a new
  // 'updated' time, and anything that vanished becomes a grave for the Sheet.
  const kinds = () => [['bookings', bookings], ['trips', trips]];
  function initShadow() {
    shadow.clear();
    kinds().forEach(([kind, arr]) => arr.forEach(it => {
      if (!it.updated) it.updated = it.created || 1;
      const { updated, ...rest } = it; shadow.set(kind + ':' + it.id, JSON.stringify(rest));
    }));
  }
  function track() {
    const now = Date.now(), have = new Set();
    kinds().forEach(([kind, arr]) => arr.forEach(it => {
      const k = kind + ':' + it.id, { updated, ...rest } = it, j = JSON.stringify(rest);
      have.add(k);
      if (shadow.get(k) !== j) { it.updated = now; shadow.set(k, j); delete graves[k]; }
    }));
    shadow.forEach((j, k) => { if (!have.has(k)) { graves[k] = now; shadow.delete(k); } });
  }
  initShadow();
  let storeWarned = false;
  function persist() {
    const ok = ls.set(KEY, JSON.stringify({ bookings, trips })) && ls.set(K.graves, JSON.stringify(graves));
    if (!ok && !storeWarned) { storeWarned = true; toast('This phone couldn’t save Travel: storage is full.' + (syncCfg ? ' Your bookings are safe in the Google Sheet.' : ' Back up soon.')); }
  }
  function save() { track(); persist(); if (syncCfg) scheduleSync(); }
  const saveSeen = () => ls.set(K.seen, JSON.stringify([...seen].slice(-4000)));
  const saveLive = () => ls.set(K.live, JSON.stringify(live));

  // ---------------------------------------------------------------------
  // Dates
  // ---------------------------------------------------------------------
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const todayStr = () => ymd(new Date());
  // A wall time like "2026-10-16T07:05" as a moment: exact when the email
  // gave the time zone, otherwise read as this phone's own time.
  const moment = (at, iso) => { const t = Date.parse(iso || ''); if (!isNaN(t)) return t; if (!at) return NaN; return Date.parse(at.length === 10 ? at + 'T12:00' : at); };
  const dOf = at => at ? new Date(at.slice(0, 10) + 'T12:00') : null;
  const fmtDay = (at, o = {}) => { const d = dOf(at); return d ? d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...o }) : ''; };
  const fmtTime = at => { if (!at || at.length < 16) return ''; const [h, m] = at.slice(11, 16).split(':').map(Number); const d = new Date(2000, 0, 1, h, m); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  function fmtRange(a, b) {
    const da = dOf(a), db = dOf(b || a);
    if (!da) return '';
    const sameYear = da.getFullYear() === db.getFullYear(), thisYear = da.getFullYear() === new Date().getFullYear();
    if (a.slice(0, 10) === (b || a).slice(0, 10)) return da.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(thisYear ? {} : { year: 'numeric' }) });
    const left = da.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
    const right = db.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear && thisYear ? {} : { year: 'numeric' }) });
    return left + ' – ' + right;
  }
  function until(t) {
    const m = Math.round((t - Date.now()) / 6e4);
    if (m < 0) return '';
    if (m < 60) return 'in ' + m + ' min';
    if (m < 36 * 60) { const h = Math.floor(m / 60), r = m % 60; return 'in ' + h + ' h' + (r && h < 10 ? ' ' + r + ' min' : ''); }
    const days = Math.round((dOf(new Date(t).toISOString().slice(0, 10)) - dOf(todayStr())) / D);
    return days <= 1 ? 'tomorrow' : 'in ' + days + ' days';
  }
  const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };

  // ---------------------------------------------------------------------
  // Bookings -> trips
  // ---------------------------------------------------------------------
  // A check-in with no time given sorts after that day's flights, and a
  // check-out with none before them: you arrive, then check in.
  const startOf = b => b.type === 'flight' ? b.dep : b.type === 'hotel' ? (b.checkIn ? b.checkIn + 'T' + (b.checkInTime || '23:00') : '') : b.type === 'car' ? b.pickup : b.start;
  const endOf = b => (b.type === 'flight' ? b.arr : b.type === 'hotel' ? (b.checkOut ? b.checkOut + 'T' + (b.checkOutTime || '06:00') : '') : b.type === 'car' ? b.dropoff : b.end) || startOf(b);
  const startT = b => b.type === 'flight' ? moment(b.dep, b.depIso) : b.type === 'car' ? moment(b.pickup, b.pickupIso) : moment(startOf(b));
  const endT = b => b.type === 'flight' ? moment(b.arr || b.dep, b.arr ? b.arrIso : b.depIso) : b.type === 'car' ? moment(b.dropoff || b.pickup, b.dropoff ? b.dropoffIso : b.pickupIso) : moment(endOf(b));
  const alive = () => bookings.filter(b => startOf(b));
  const city = code => P.AIRPORTS[code] || code || '';
  const flightName = b => ((b.airlineCode || '') + ' ' + (b.flightNo || '')).trim() || b.airline || 'Flight';
  function titleOf(b) {
    if (b.type === 'flight') return flightName(b) + ' · ' + (b.from || '?') + ' → ' + (b.to || '?');
    if (b.type === 'hotel') return b.name || 'Hotel';
    if (b.type === 'car') return (b.company || 'Car hire') + (b.carClass ? ' · ' + b.carClass : '');
    return b.title || 'Booking';
  }
  // Where people usually fly from: the most common first departure of a trip.
  let homeAirport = '';
  function groupTrips() {
    const list = alive().filter(b => !b.ride).sort((a, b) => startOf(a).localeCompare(startOf(b)));
    const groups = [];
    let cur = null;
    for (const b of list) {
      const s = startOf(b), e = endOf(b);
      if (cur && (dOf(s) - dOf(cur.end)) / D <= 1) { cur.items.push(b); if (e > cur.end) cur.end = e; }
      else { cur = { items: [b], start: s, end: e }; groups.push(cur); }
    }
    // An Uber or Lyft ride joins the trip it was taken on (a day either side,
    // for the ride to the airport); a ride at home isn't a trip, so it isn't shown.
    for (const r of alive().filter(b => b.ride)) {
      const t = +dOf(startOf(r)), g = groups.find(g => t >= +dOf(g.start) - D && t <= +dOf(g.end) + D);
      if (g) g.items.push(r);
    }
    const origins = {};
    groups.forEach(g => { const f = g.items.find(b => b.type === 'flight' && b.from); if (f) origins[f.from] = (origins[f.from] || 0) + 1; });
    homeAirport = Object.entries(origins).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const names = new Map(trips.map(t => [t.id, t]));
    groups.forEach(g => {
      g.id = g.items[0].id;
      g.auto = autoName(g);
      g.name = names.get(g.id)?.name || g.auto;
      g.live = g.items.filter(b => b.status !== 'cancelled');
      g.startT = Math.min(...g.items.map(startT).filter(x => !isNaN(x)));
      g.endT = Math.max(...g.items.map(endT).filter(x => !isNaN(x)));
      g.past = g.endT < Date.now() - 6 * H;
      g.check = g.items.filter(b => b.guess).length;
    });
    return groups;
  }
  function autoName(g) {
    const hotel = g.items.find(b => b.type === 'hotel' && b.status !== 'cancelled');
    if (hotel && hotel.city) return hotel.city;
    const flights = g.items.filter(b => b.type === 'flight' && b.status !== 'cancelled');
    const away = flights.find(f => f.to && f.to !== homeAirport);
    if (away) return (away.toName && !/airport|international/i.test(away.toName) ? away.toName : city(away.to));
    const car = g.items.find(b => b.type === 'car' && b.city);
    if (car) return car.city;
    if (hotel) return hotel.name;
    return titleOf(g.items[0]);
  }

  // ---------------------------------------------------------------------
  // Sheets (bottom sheets and pages), toast - the same behaviour as Notes
  // ---------------------------------------------------------------------
  const focusStack = [];
  const lockPage = () => document.documentElement.classList.toggle('locked', [...document.querySelectorAll('.sheetwrap')].some(w => !w.hidden));
  function openSheet(id) { focusStack.push(document.activeElement); $(id).hidden = false; lockPage(); }
  function closeSheet(id) { $(id).hidden = true; lockPage(); const f = focusStack.pop(); if (f && f.focus && document.contains(f)) f.focus(); }
  const closers = { bkSheet: () => finishBooking(), tripPage: () => finishTrip() };
  const closeWrap = w => (closers[w.id] || (() => closeSheet(w.id)))();
  document.querySelectorAll('.sheetwrap').forEach(w => w.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeWrap(w); }));
  if (window.visualViewport) {
    const vv = window.visualViewport, root = document.documentElement.style;
    const fit = () => { root.setProperty('--vvh', vv.height + 'px'); root.setProperty('--vvt', vv.offsetTop + 'px'); };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
  }
  document.addEventListener('focusin', e => {
    const el = e.target;
    if (el.matches && el.matches('input, textarea') && el.closest('.sheetbody')) setTimeout(() => el.scrollIntoView({ block: 'nearest' }), 350);
  });
  // Drag a sheet down by its handle or title bar to close it.
  document.querySelectorAll('.sheetwrap').forEach(w => {
    const sheet = w.querySelector('.sheet'), scrim = w.querySelector('.scrim');
    if (sheet.classList.contains('page')) return;
    let y0 = null, t0 = 0, dy = 0, dragging = false, suppress = false;
    const reset = () => { sheet.classList.remove('dragging', 'settling'); sheet.style.transform = ''; scrim.style.opacity = ''; };
    const start = (y, target) => { if (!target.closest('.grab, .sheethead')) { y0 = null; return; } y0 = y; t0 = Date.now(); dy = 0; dragging = false; };
    const move = (y, e) => {
      if (y0 === null) return;
      dy = y - y0;
      if (!dragging) { if (dy < 8) return; dragging = true; sheet.classList.add('dragging'); }
      if (e.cancelable) e.preventDefault();
      const d = Math.max(0, dy);
      sheet.style.transform = 'translateY(' + d + 'px)';
      scrim.style.opacity = String(Math.max(0, 1 - d / sheet.offsetHeight));
    };
    const end = () => {
      if (y0 === null) return;
      y0 = null;
      if (!dragging) return;
      suppress = true; setTimeout(() => { suppress = false; }, 50);
      const fast = dy / Math.max(1, Date.now() - t0) > 0.5;
      sheet.classList.remove('dragging'); sheet.classList.add('settling');
      if (dy > 110 || (fast && dy > 30)) { sheet.style.transform = 'translateY(100%)'; scrim.style.opacity = '0'; setTimeout(() => { closeWrap(w); reset(); }, 260); }
      else { sheet.style.transform = ''; scrim.style.opacity = ''; setTimeout(reset, 300); }
    };
    sheet.addEventListener('touchstart', e => { if (e.touches.length === 1) start(e.touches[0].clientY, e.target); }, { passive: true });
    sheet.addEventListener('touchmove', e => move(e.touches[0].clientY, e), { passive: false });
    sheet.addEventListener('touchend', end);
    sheet.addEventListener('touchcancel', end);
    sheet.addEventListener('mousedown', e => { if (e.button === 0) start(e.clientY, e.target); });
    window.addEventListener('mousemove', e => move(e.clientY, e));
    window.addEventListener('mouseup', end);
    sheet.addEventListener('click', e => { if (suppress) { e.stopPropagation(); e.preventDefault(); } }, true);
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.sheetwrap')].reverse().find(w => !w.hidden);
    if (open) closeWrap(open);
  });
  // Switches with a sliding glass thumb: the shared AllisonOS one (home/slide.js),
  // for the section bar and the Trips filter.
  const slide = (window.AllisonOS && window.AllisonOS.slide) || (() => {});
  const tabBar = document.querySelector('.tabs'), whenBox = $('whenChips');
  const slideTabs = jump => slide(tabBar, tabBar.querySelector('.tab[aria-selected="true"]'), 'tabs', { jump });
  const slideWhen = jump => slide(whenBox, whenBox.querySelector('[aria-pressed="true"]'), 'when', { jump });
  window.addEventListener('resize', () => { slideTabs(true); slideWhen(true); });
  let toastTimer;
  function toast(msg, undo, ms) {
    $('toastMsg').textContent = msg;
    $('toastAct').hidden = !undo;
    $('toastAct').onclick = () => { undo(); $('toast').hidden = true; };
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, ms || 4000);
  }
  function animateIn(el) { el.classList.add('enter'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('enter'), 900); }

  // The pill at the top while Gmail is read or the Sheet syncs.
  let pillAt = 0, pillTimer = null;
  function busyPill(text) {
    const p = $('syncPill');
    if (text) {
      clearTimeout(pillTimer);
      if (p.hidden) pillAt = Date.now();
      p.classList.remove('out', 'done'); p.hidden = false; $('syncPillTxt').textContent = text;
      return;
    }
    if (p.hidden || p.classList.contains('out')) return;
    clearTimeout(pillTimer);
    pillTimer = setTimeout(() => { p.classList.add('out'); pillTimer = setTimeout(() => { p.hidden = true; p.classList.remove('out', 'done'); }, 450); }, Math.max(0, 900 - (Date.now() - pillAt)));
  }
  function pillDone(text) {
    const p = $('syncPill');
    if (p.hidden) return;
    clearTimeout(pillTimer);
    p.classList.add('done'); $('syncPillTxt').textContent = text;
    pillTimer = setTimeout(() => { p.classList.add('out'); pillTimer = setTimeout(() => { p.hidden = true; p.classList.remove('out', 'done'); }, 450); }, 1300);
  }

  // Files out: the phone's share menu, else a download.
  function download(file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = file.name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  async function shareOut(file, title) {
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return 'shared'; } }
    catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
    download(file); return 'downloaded';
  }
  const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

  // ---------------------------------------------------------------------
  // Links out: searches and places
  // ---------------------------------------------------------------------
  const mdY = d => d ? d.slice(5, 7) + '/' + d.slice(8, 10) + '/' + d.slice(0, 4) : '';
  const LINKS = {
    // Google documents no URL format for these; a plain-words search in q=
    // is what the sites themselves put in the address bar.
    googleFlights: (from, to, out, back) => 'https://www.google.com/travel/flights?q=' + encodeURIComponent(['Flights', from ? 'from ' + from : '', to ? 'to ' + to : '', out ? 'on ' + out : '', back ? 'through ' + back : ''].filter(Boolean).join(' ')),
    googleHotels: (place, cin, cout) => 'https://www.google.com/travel/search?q=' + encodeURIComponent(['Hotels in', place || '', cin ? cin : '', cout ? 'to ' + cout : ''].filter(Boolean).join(' ')),
    marriott: (place, cin, cout) => 'https://www.marriott.com/search/findHotels.mi?' + new URLSearchParams({ 'destinationAddress.destination': place || '', ...(cin ? { fromDate: mdY(cin) } : {}), ...(cout ? { toDate: mdY(cout) } : {}) }),
    kayakCars: (place, a, b) => 'https://www.kayak.com/cars/' + encodeURIComponent(place || '') + (a ? '/' + a + (b ? '/' + b : '') : ''),
    national: () => 'https://www.nationalcar.com/',
    maps: q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q),
    mailApp: threadId => '../mail/?thread=' + encodeURIComponent(threadId),
    gmailWeb: msgId => 'https://mail.google.com/mail/u/0/#all/' + encodeURIComponent(msgId),
  };
  const linkRow = (href, title, sub, icon) => '<a class="rowbtn" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer"><span class="ic">' + (icon || I.search) + '</span><span>' + esc(title) + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</span></a>';
  // A place in words for a search: a city name beats an airport code.
  const placeWords = x => (P.AIRPORTS[String(x || '').toUpperCase()] || x || '').replace(/ (JFK|LaGuardia|O'Hare|Midway|Hobby|Heathrow|Gatwick|Orly)$/i, '');

  // ---------------------------------------------------------------------
  // Render: the trips list
  // ---------------------------------------------------------------------
  function statusPill(b) {
    if (b.status === 'cancelled') return '<span class="st bad">Canceled</span>';
    const l = b.type === 'flight' && liveView(b);
    if (l) return '<span class="st ' + l.cls + '">' + esc(l.text) + '</span>';
    if (b.guess) return '<span class="st warn">Check details</span>';
    return '';
  }
  function heroHTML(groups) {
    const now = Date.now();
    const soon = alive().filter(b => !b.ride && b.status !== 'cancelled' && endT(b) > now - H && startT(b) < now + 14 * D);
    const flightsIn = d => soon.filter(f => f.type === 'flight' && (f.dep || '').slice(0, 10) === d && startT(f) > now - 30 * 6e4);
    // On the day you fly in, the flight comes before the hotel check-in.
    const key = b => b.type === 'hotel' && startT(b) > now && flightsIn(b.checkIn).length ? Math.max(startT(b), ...flightsIn(b.checkIn).map(endT)) + 1 : startT(b);
    const next = soon.sort((a, b) => key(a) - key(b))[0];
    if (!next) return '';
    const s = startT(next), going = s <= now;
    const k = going ? 'Now' : 'Next · ' + until(s);
    let h = '<button class="hero glass" type="button" data-bk="' + esc(next.id) + '" style="--tint:var(--' + ({ flight: 'fl', hotel: 'ho', car: 'ca' }[next.type] || 'fl') + ')">';
    h += '<p class="k">' + (I[next.type] || I.other) + esc(k) + '</p>';
    if (next.type === 'flight') {
      h += '<div class="route"><div class="ap"><b>' + esc(next.from || '—') + '</b><span>' + esc(next.fromName || city(next.from)) + '</span></div><div class="line">' + I.plane + '</div>'
        + '<div class="ap r"><b>' + esc(next.to || '—') + '</b><span>' + esc(next.toName || city(next.to)) + '</span></div></div>';
      h += '<div class="when">' + esc(flightName(next)) + ' · ' + esc(fmtDay(next.dep)) + (fmtTime(next.dep) ? ' · ' + esc(fmtTime(next.dep)) : '') + '</div>';
      const l = liveView(next);
      const bits = [];
      const gate = (l && l.gate) || next.gate, term = (l && l.terminal) || next.terminal;
      if (term) bits.push('Terminal ' + term);
      if (gate) bits.push('Gate ' + gate);
      if (next.seat) bits.push('Seat ' + next.seat);
      if (next.conf) bits.push('Conf. ' + next.conf);
      if (bits.length) h += '<div class="sub">' + esc(bits.join(' · ')) + '</div>';
    } else if (next.type === 'hotel') {
      const inStay = next.checkIn <= todayStr();
      h += '<h3>' + esc(next.name || 'Hotel') + '</h3><div class="when">' + (inStay ? 'Check out ' + esc(fmtDay(next.checkOut)) : 'Check in ' + esc(fmtDay(next.checkIn)) + (next.checkInTime ? ' · from ' + esc(fmtTime(next.checkIn + 'T' + next.checkInTime)) : '')) + '</div>';
      h += '<div class="sub">' + esc([next.address, next.conf ? 'Conf. ' + next.conf : ''].filter(Boolean).join(' · ')) + '</div>';
    } else if (next.type === 'car') {
      const out = next.pickup && moment(next.pickup, next.pickupIso) <= now;
      h += '<h3>' + esc(next.company || 'Car hire') + '</h3><div class="when">' + (out ? 'Return ' + esc(fmtDay(next.dropoff)) + ' · ' + esc(fmtTime(next.dropoff)) : 'Pick up ' + esc(fmtDay(next.pickup)) + (fmtTime(next.pickup) ? ' · ' + esc(fmtTime(next.pickup)) : '')) + '</div>';
      h += '<div class="sub">' + esc([out ? next.dropPlace : next.pickupPlace, next.conf ? 'Conf. ' + next.conf : ''].filter(Boolean).join(' · ')) + '</div>';
    } else {
      h += '<h3>' + esc(titleOf(next)) + '</h3><div class="when">' + esc(fmtDay(startOf(next))) + '</div>';
    }
    const pill = statusPill(next);
    if (pill) h += '<div class="meta">' + pill + '</div>';
    return h + '</button>';
  }
  function tripCard(g, i) {
    const n = t => g.live.filter(b => b.type === t).length;
    const counts = [['flight', n('flight'), 'flight'], ['hotel', n('hotel'), 'hotel'], ['car', n('car'), 'car']].filter(x => x[1])
      .map(([t, k, w]) => '<span class="count">' + I[t] + esc(plural(k, w === 'car' ? 'car' : w)) + '</span>').join('');
    const soon = !g.past && g.startT > Date.now() ? until(g.startT) : !g.past ? 'Now' : '';
    return '<button class="trip glass' + (g.past ? ' past' : '') + '" type="button" data-trip="' + esc(g.id) + '" style="--i:' + i + '">'
      + '<div class="tt"><h3>' + esc(g.name) + '</h3>' + (soon ? '<span class="soon">' + esc(soon) + '</span>' : '') + '</div>'
      + '<div class="dates">' + esc(fmtRange(g.start, g.end)) + '</div>'
      + '<div class="icons">' + counts + (g.check ? '<span class="st warn">' + esc(g.check + ' to check') + '</span>' : '')
      + (g.live.length < g.items.length ? '<span class="st bad">' + esc((g.items.length - g.live.length) + ' canceled') + '</span>' : '') + '</div></button>';
  }
  function render() {
    const groups = groupTrips();
    const up = groups.filter(g => !g.past), past = groups.filter(g => g.past).reverse();
    const check = alive().filter(b => b.guess).length;
    const chips = [['upcoming', 'Upcoming', up.length], ['past', 'Past', past.length]];
    if (check) chips.push(['check', 'To check', check]);
    if (st.when === 'check' && !check) st.when = 'upcoming';
    $('whenChips').innerHTML = chips.map(([k, t, n]) => '<button class="chip glass" type="button" data-when="' + k + '" aria-pressed="' + (st.when === k) + '">' + esc(t) + ' <span class="n">' + n + '</span></button>').join('');
    slideWhen();
    const sub = [];
    if (up.length) sub.push(plural(up.length, 'trip') + ' coming up');
    if (st.scanning) sub.push('Reading Gmail…');
    else if (+ls.get(K.lastScan, 0)) sub.push('Gmail checked ' + ago(+ls.get(K.lastScan, 0)));
    if (syncCfg) sub.push(syncState === 'error' ? 'Not synced' : syncState === 'syncing' ? 'Syncing…' : 'Synced');
    $('tripsSub').textContent = sub.join(' · ');

    let h = '';
    if (!bookings.length) {
      h = '<div class="empty glass"><strong>No trips yet</strong>'
        + (hasGmail() ? 'Tap the envelope to look through Gmail for flight, hotel and car hire confirmations.' : 'Connect Gmail and Travel finds your flight, hotel and car hire confirmations by itself.')
        + '</div><button class="btn" type="button" id="emptyGo">' + (hasGmail() ? 'Look in Gmail now' : 'Connect Gmail') + '</button>'
        + '<button class="btn quiet" type="button" id="emptyAdd">Add a booking by hand</button>';
    } else if (st.when === 'check') {
      const list = alive().filter(b => b.guess).sort((a, b) => startOf(a).localeCompare(startOf(b)));
      h = '<p class="hint">These were read from the words of an email rather than its booking data, so the details may be off. Open each one, fix anything wrong and tap “Looks right”.</p>'
        + '<div class="tl glass">' + list.map(b => evRow(b, startOf(b), 'start', true)).join('') + '</div>';
    } else {
      if (st.when === 'upcoming') h += heroHTML(groups);
      const list = st.when === 'past' ? past : up;
      if (list.length) h += list.map(tripCard).join('');
      else h += '<div class="empty glass"><strong>' + (st.when === 'past' ? 'No past trips' : 'Nothing coming up') + '</strong>'
        + (st.when === 'past' ? 'Trips move here the day after they end.' : 'New bookings in Gmail show up here after the next check (the envelope, top right).') + '</div>';
    }
    $('list').innerHTML = h;
    if ($('emptyGo')) $('emptyGo').onclick = () => hasGmail() ? scan({ loud: true }) : openSettings();
    if ($('emptyAdd')) $('emptyAdd').onclick = () => openAdd();
    if (!$('tripPage').hidden && st.trip) renderTrip();
  }
  $('whenChips').addEventListener('click', e => {
    const b = e.target.closest('[data-when]'); if (!b) return;
    st.when = b.dataset.when; ls.set(K.when, st.when); render(); animateIn($('list'));
  });
  $('list').addEventListener('click', e => {
    const t = e.target.closest('[data-trip]'); if (t) return openTrip(t.dataset.trip);
    const b = e.target.closest('[data-bk]'); if (b) return openBooking(b.dataset.bk);
  });

  // ---------------------------------------------------------------------
  // A trip page: the timeline
  // ---------------------------------------------------------------------
  // One row of the timeline. side: 'start' | 'end' (a hotel's check-out, a car's return).
  function evRow(b, at, side, withDate) {
    const cx = b.status === 'cancelled' ? ' cx' : '';
    let t = '', s = '', time = fmtTime(at) || (b.type === 'hotel' ? (side === 'start' ? 'Check in' : 'Check out') : 'All day');
    if (b.type === 'flight') {
      t = flightName(b) + ' · ' + (b.from || '?') + ' → ' + (b.to || '?');
      const lv = liveView(b), term = (lv && lv.terminal) || b.terminal, gate = (lv && lv.gate) || b.gate;
      s = [[b.fromName || city(b.from), b.toName || city(b.to)].filter(Boolean).join(' → '), b.arr ? 'lands ' + fmtTime(b.arr) + (b.arr.slice(0, 10) !== (b.dep || '').slice(0, 10) ? ' ' + fmtDay(b.arr, { weekday: undefined }) : '') : '',
        term ? 'Terminal ' + term : '', gate ? 'Gate ' + gate : ''].filter(Boolean).join(' · ');
    } else if (b.type === 'hotel') {
      t = (side === 'start' ? 'Check in · ' : 'Check out · ') + (b.name || 'Hotel');
      if (!fmtTime(at)) time = side === 'start' ? 'In' : 'Out';
      s = side === 'start' ? [b.address, b.checkOut ? plural(Math.max(1, Math.round((dOf(b.checkOut) - dOf(b.checkIn)) / D)), 'night') : ''].filter(Boolean).join(' · ') : '';
    } else if (b.type === 'car') {
      t = (side === 'start' ? 'Pick up · ' : 'Return · ') + (b.company || 'Car hire');
      s = [side === 'start' ? b.pickupPlace : (b.dropPlace || b.pickupPlace), side === 'start' ? b.carClass : ''].filter(Boolean).join(' · ');
    } else { t = b.title || 'Booking'; s = b.place || ''; }
    const meta = [statusPill(b), b.conf && side === 'start' ? '<span class="st bare">' + esc(b.conf) + '</span>' : ''].filter(Boolean).join('');
    return '<button class="ev ' + esc(b.type) + cx + '" type="button" data-bk="' + esc(b.id) + '">'
      + '<span class="tm">' + esc(time) + (withDate ? '<small>' + esc(fmtDay(at)) + '</small>' : '') + '</span><span class="ic">' + (b.ride ? I.car : I[b.type] || I.other) + '</span>'
      + '<span class="bd"><span class="t">' + esc(t) + '</span>' + (s ? '<span class="s">' + esc(s) + '</span>' : '') + (meta ? '<span class="m">' + meta + '</span>' : '') + '</span></button>';
  }
  function tripById(id) { return groupTrips().find(g => g.id === id || g.items.some(b => b.id === id)); }
  function openTrip(id) {
    const g = tripById(id); if (!g) return;
    st.trip = g.id;
    renderTrip();
    openSheet('tripPage');
    $('tpBody').scrollTop = 0;
    g.items.filter(b => b.type === 'flight').forEach(b => refreshLive(b));
  }
  function renderTrip() {
    const g = tripById(st.trip);
    if (!g) { closeSheet('tripPage'); st.trip = null; return; }
    st.trip = g.id;
    const events = [];
    for (const b of g.items) {
      events.push({ b, at: startOf(b), side: 'start' });
      if (b.type === 'hotel' && b.checkOut) events.push({ b, at: endOf(b), side: 'end' });
      if (b.type === 'car' && b.dropoff) events.push({ b, at: endOf(b), side: 'end' });
    }
    events.sort((x, y) => x.at.localeCompare(y.at));
    const days = [];
    for (const e of events) { const d = e.at.slice(0, 10); if (!days.length || days[days.length - 1].d !== d) days.push({ d, list: [] }); days[days.length - 1].list.push(e); }
    let h = '<div class="triphead"><input id="tpName" value="' + esc(g.name) + '" aria-label="Trip name" placeholder="' + esc(g.auto) + '" enterkeyhint="done"><div class="dates">' + esc(fmtRange(g.start, g.end)) + '</div></div>';
    h += days.map((d, i) => '<div class="dayblock" style="--i:' + i + '"><p class="sechead"><span>' + esc(fmtDay(d.d, { weekday: 'long', month: 'long' })) + '</span></p><div class="tl glass">'
      + d.list.map(e => evRow(e.b, e.at, e.side)).join('') + '</div></div>').join('');
    h += '<button class="btn quiet" type="button" id="tpAdd">' + I.plus + 'Add a booking to this trip</button>';
    // Search for more around this trip.
    const flights = g.live.filter(b => b.type === 'flight');
    const hotel = g.live.find(b => b.type === 'hotel');
    const dest = flights.find(f => f.to && f.to !== homeAirport)?.to || (hotel && hotel.city) || g.name;
    const from = homeAirport || flights[0]?.from || '';
    const d0 = g.start.slice(0, 10), d1 = g.end.slice(0, 10);
    const where = hotel && hotel.city || placeWords(dest);
    h += '<p class="sechead"><span>Find more for this trip</span></p><div class="rgroup glass">'
      + linkRow(LINKS.googleFlights(from, dest, d0, d1 > d0 ? d1 : ''), 'Google Flights', (from ? from + ' → ' : '') + dest + ' · ' + fmtRange(d0, d1), I.flight)
      + linkRow(LINKS.googleHotels(where, d0, d1), 'Google Hotels', where + ' · ' + fmtRange(d0, d1), I.hotel)
      + linkRow(LINKS.marriott(where, d0, d1), 'Marriott', where + ' · ' + fmtRange(d0, d1), I.hotel)
      + linkRow(LINKS.kayakCars(/^[A-Z]{3}$/.test(dest) ? dest : where, d0, d1), 'Car hire (Kayak)', 'Compares National, Enterprise, Hertz and others', I.car)
      + linkRow(LINKS.national(), 'National Car Rental', 'Opens nationalcar.com', I.car)
      + '</div>';
    $('tpBody').innerHTML = h;
    $('tpAdd').onclick = () => openAdd(g.start.slice(0, 10));
  }
  function finishTrip() {
    const g = tripById(st.trip), inp = $('tpName');
    if (g && inp) {
      const name = inp.value.trim(), cur = trips.find(t => t.id === g.id);
      if (!name || name === g.auto) { if (cur) { trips = trips.filter(t => t !== cur); save(); } }
      else if (!cur) { trips.push({ id: g.id, name }); save(); }
      else if (cur.name !== name) { cur.name = name; save(); }
    }
    st.trip = null; closeSheet('tripPage'); render();
  }
  $('tpBack').onclick = finishTrip;
  $('tpDone').onclick = finishTrip;
  $('tpBody').addEventListener('click', e => { const b = e.target.closest('[data-bk]'); if (b) openBooking(b.dataset.bk); });
  $('tpBody').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'tpName') e.target.blur(); });
  $('tpCal').onclick = async () => {
    const g = tripById(st.trip); if (!g) return;
    await addToCalendar(ics(g.live), g.name, 'the trip');
  };

  // ---------------------------------------------------------------------
  // One booking: details you can edit, live status, links
  // ---------------------------------------------------------------------
  const FIELDS = {
    flight: [['airlineCode', 'Airline code', 'UA'], ['flightNo', 'Flight number', '1234'], ['from', 'From (airport)', 'DEN'], ['to', 'To (airport)', 'BOS'],
      ['dep', 'Departs', '', 'datetime-local'], ['arr', 'Lands', '', 'datetime-local'], ['terminal', 'Terminal', ''], ['gate', 'Gate', ''],
      ['conf', 'Confirmation', ''], ['seat', 'Seat', ''], ['traveller', 'Traveler', '', '', 'w']],
    hotel: [['name', 'Hotel', 'Courtyard Boston', '', 'w'], ['address', 'Address', '', '', 'w'], ['city', 'City', ''], ['conf', 'Confirmation', ''],
      ['checkIn', 'Check in', '', 'date'], ['checkInTime', 'From', '', 'time'], ['checkOut', 'Check out', '', 'date'], ['checkOutTime', 'By', '', 'time'], ['phone', 'Phone', '', 'tel', 'w']],
    car: [['company', 'Company', 'National'], ['conf', 'Confirmation', ''], ['pickupPlace', 'Pick up at', '', '', 'w'], ['pickup', 'Pick up', '', 'datetime-local'],
      ['dropoff', 'Return', '', 'datetime-local'], ['dropPlace', 'Return to (if different)', '', '', 'w'], ['carClass', 'Car', ''], ['city', 'City', '']],
    other: [['title', 'What', 'Train, tour, restaurant…', '', 'w'], ['place', 'Where', '', '', 'w'], ['start', 'Starts', '', 'datetime-local'], ['end', 'Ends', '', 'datetime-local'], ['conf', 'Confirmation', '']],
  };
  function openBooking(id, fresh) {
    const b = fresh || bookings.find(x => x.id === id); if (!b) return;
    st.booking = JSON.parse(JSON.stringify(b)); st.isNew = !!fresh;
    renderBooking();
    openSheet('bkSheet');
    if (b.type === 'flight' && !fresh) refreshLive(b).then(() => { if (st.booking && st.booking.id === b.id) renderLiveBox(); });
  }
  function renderBooking() {
    const b = st.booking;
    $('bkLbl').textContent = st.isNew ? 'New ' + TYPE_NAME[b.type].toLowerCase() : TYPE_NAME[b.type];
    let h = '';
    if (b.guess) h += '<div class="verify"><span>Read from the words of the email. Check these details.</span><button class="textbtn" type="button" id="bkOk">Looks right</button></div>';
    if (b.type === 'flight' && !st.isNew) h += '<div class="live glass" id="bkLive"></div>';
    h += '<div class="box glass"><div class="kv">' + FIELDS[b.type].map(([k, label, ph, type, w]) => {
      const v = b[k] || '';
      return '<div class="f' + (w ? ' w' : '') + '"><label for="bf_' + k + '">' + esc(label) + '</label><input id="bf_' + k + '" data-k="' + k + '" type="' + (type || 'text') + '" value="' + esc(type === 'datetime-local' ? v.slice(0, 16) : v) + '" placeholder="' + esc(ph) + '"'
        + (/^(airlineCode|from|to)$/.test(k) ? ' autocapitalize="characters"' : '') + '></div>';
    }).join('') + '<div class="f w"><label for="bf_notes">Notes</label><textarea id="bf_notes" data-k="notes" placeholder="Anything to remember">' + esc(b.notes || '') + '</textarea></div></div></div>';
    const rows = [];
    if (b.source && b.source.threadId) {
      rows.push('<a class="rowbtn" href="' + esc(LINKS.mailApp(b.source.threadId)) + '"><span class="ic">' + I.mail + '</span><span>Open the email in Mail<span class="sub">' + esc(b.source.subject || '') + '</span></span></a>');
      rows.push(linkRow(LINKS.gmailWeb(b.source.msgId), 'Open in Gmail', 'In the browser', I.ext));
    }
    const place = b.type === 'hotel' ? [b.name, b.address].filter(Boolean).join(', ') : b.type === 'car' ? b.pickupPlace : b.type === 'other' ? b.place : '';
    if (place) rows.push(linkRow(LINKS.maps(place), 'Map', place, I.map));
    if (!st.isNew) rows.push('<button class="rowbtn" type="button" id="bkCal"><span class="ic">' + I.cal + '</span><span>Add to calendar<span class="sub">The phone’s calendar does the reminding</span></span></button>');
    if (b.type === 'flight' && b.from && b.to) rows.push(linkRow(LINKS.googleFlights(b.from, b.to, (b.dep || '').slice(0, 10)), 'This route on Google Flights', b.from + ' → ' + b.to, I.search));
    if (b.type === 'hotel' && (b.city || b.address)) rows.push(linkRow(LINKS.googleHotels(b.city || b.address, b.checkIn, b.checkOut), 'Other hotels nearby', 'Google Hotels, same dates', I.search));
    if (rows.length) h += '<div class="rgroup glass">' + rows.join('') + '</div>';
    if (b.source && b.source.from) h += '<p class="hint">From ' + esc(b.source.from.replace(/<[^>]*>/g, '').trim() || b.source.from) + (b.source.date ? ', ' + esc(new Date(b.source.date).toLocaleDateString()) : '') + '.</p>';
    if (!st.isNew) {
      h += '<div class="opts"><button class="opt" type="button" id="bkCx" aria-pressed="' + (b.status === 'cancelled') + '">' + (b.status === 'cancelled' ? 'Canceled' : 'Mark as canceled') + '</button></div>';
      h += '<button class="btn quiet danger" type="button" id="bkDel">Delete booking</button>';
    }
    $('bkBody').innerHTML = h;
    if (b.type === 'flight' && !st.isNew) renderLiveBox();
  }
  function readFields() {
    const b = st.booking;
    $('bkBody').querySelectorAll('[data-k]').forEach(inp => {
      let v = inp.value.trim();
      if (/^(airlineCode|from|to)$/.test(inp.dataset.k)) v = v.toUpperCase();
      if (inp.dataset.k === 'flightNo') v = v.replace(/\s+/g, '');
      b[inp.dataset.k] = v;
    });
    if (b.type === 'flight') {
      const code = b.airlineCode;
      if (/^[A-Z0-9]{2}\d{1,4}$/.test(b.flightNo || '') && !code) { b.airlineCode = b.flightNo.slice(0, 2).toUpperCase(); b.flightNo = b.flightNo.slice(2); }
      b.airline = P.AIRLINES[b.airlineCode] || b.airline || '';
      if (!b.fromName || P.AIRPORTS[b.from]) b.fromName = P.AIRPORTS[b.from] || b.fromName || '';
      if (!b.toName || P.AIRPORTS[b.to]) b.toName = P.AIRPORTS[b.to] || b.toName || '';
    }
  }
  function finishBooking() {
    readFields();
    const b = st.booking;
    if (st.isNew) {
      if (startOf(b)) {
        b.id = b.id || P.idFor(b);
        b.created = Date.now(); b.edited = true;
        if (bookings.some(x => x.id === b.id)) b.id += '-' + Date.now().toString(36);
        bookings.push(b); save(); toast('Added');
      } else if (FIELDS[b.type].some(([k]) => b[k])) toast('Not added: it needs a date.');
    } else {
      const i = bookings.findIndex(x => x.id === b.id);
      if (i >= 0) {
        const before = JSON.stringify(bookings[i]);
        if (before !== JSON.stringify(b)) { b.edited = true; b.guess = false; bookings[i] = b; if (b.type === 'flight') delete live[b.id]; save(); }
      }
    }
    st.booking = null; closeSheet('bkSheet'); render();
  }
  $('bkDone').onclick = finishBooking;
  $('bkBody').addEventListener('click', async e => {
    const b = st.booking; if (!b) return;
    if (e.target.closest('#bkOk')) {
      readFields(); b.guess = false; b.checked = true;
      const i = bookings.findIndex(x => x.id === b.id);
      if (i >= 0) { bookings[i] = JSON.parse(JSON.stringify(b)); save(); }   // a copy: the sheet keeps editing its own
      renderBooking(); toast('Thanks. Marked as checked.'); return;
    }
    if (e.target.closest('#bkCx')) { b.status = b.status === 'cancelled' ? 'confirmed' : 'cancelled'; renderBooking(); return; }
    if (e.target.closest('#bkCal')) { readFields(); await addToCalendar(ics([b]), titleOf(b), 'it'); return; }
    if (e.target.closest('#bkLiveGo')) { refreshLive(b, true).then(renderLiveBox); renderLiveBox(true); return; }
    if (e.target.closest('#bkDel')) {
      const del = $('bkDel');
      if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Tap again to delete'; setTimeout(() => { if (document.contains(del)) { delete del.dataset.armed; del.textContent = 'Delete booking'; } }, 3500); return; }
      const gone = bookings.find(x => x.id === b.id);
      bookings = bookings.filter(x => x.id !== b.id);
      st.booking = null; closeSheet('bkSheet'); save(); render();
      toast('Deleted. It won’t come back from the email.', () => { bookings.push(gone); save(); render(); });
    }
  });

  // ---------------------------------------------------------------------
  // Add
  // ---------------------------------------------------------------------
  let addDate = '';
  function openAdd(date) {
    addDate = date || '';
    $('addTypes').innerHTML = ['flight', 'hotel', 'car', 'other'].slice(0, 3).map(t => '<button class="glass" type="button" data-type="' + t + '">' + I[t] + esc(TYPE_NAME[t]) + '</button>').join('');
    openSheet('addSheet');
  }
  $('fab').onclick = () => openAdd();
  $('addTypes').addEventListener('click', e => {
    const t = e.target.closest('[data-type]'); if (!t) return;
    closeSheet('addSheet');
    const type = t.dataset.type, d = addDate;
    const b = { type, status: 'confirmed', guess: false, conf: '', notes: '' };
    if (d) { if (type === 'flight') b.dep = d + 'T09:00'; if (type === 'hotel') { b.checkIn = d; b.checkOut = P.addDays(d, 1); } if (type === 'car') b.pickup = d + 'T10:00'; }
    openBooking(null, b);
  });
  $('addPaste').onclick = () => { closeSheet('addSheet'); pasteIn(); };

  // ---------------------------------------------------------------------
  // Paste: a confirmation, or a Sheet setup link
  // ---------------------------------------------------------------------
  async function pasteIn() {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch {}
    if (text && takeSetupLink(text)) return;
    if (text && text.trim().length > 20) return readPasted(text);
    $('psText').value = ''; openSheet('pasteSheet'); setTimeout(() => $('psText').focus(), 300);
  }
  function readPasted(text) {
    const r = P.parseText(text);
    if (!r.bookings.length) {
      $('psText').value = text; $('psHint').textContent = 'No flight, hotel or car booking found in that text. Add it by hand with the + button instead.';
      if ($('pasteSheet').hidden) openSheet('pasteSheet');
      return;
    }
    const res = r.bookings.map(b => upsert(b, true));
    save(); render();
    const n = res.filter(x => x === 'new').length;
    toast(n ? 'Added ' + plural(n, 'booking') + '. Check the details.' : 'Already here.');
    if (r.bookings.length === 1) openBooking(r.bookings[0].id);
  }
  $('pasteBtn').onclick = pasteIn;
  $('psAdd').onclick = () => { const t = $('psText').value; if (!t.trim()) return; if (takeSetupLink(t)) { closeSheet('pasteSheet'); return; } closeSheet('pasteSheet'); readPasted(t); };

  // ---------------------------------------------------------------------
  // Merge a booking found in an email
  // ---------------------------------------------------------------------
  const INFO_KEYS = ['conf', 'traveller', 'airline', 'airlineCode', 'flightNo', 'from', 'fromName', 'to', 'toName', 'dep', 'depIso', 'arr', 'arrIso', 'terminal', 'gate', 'seat',
    'name', 'address', 'city', 'phone', 'checkIn', 'checkInTime', 'checkOut', 'checkOutTime', 'company', 'carClass', 'pickupPlace', 'pickup', 'pickupIso', 'dropPlace', 'dropoff', 'dropoffIso',
    'title', 'place', 'start', 'end'];
  const num = n => String(n || '').replace(/^0+(?=\d)/, '');
  const day = b => String(b.dep || '').slice(0, 10);
  const sameFlight = (a, b) => a.type === 'flight' && b.type === 'flight' && a.airlineCode === b.airlineCode && num(a.flightNo) === num(b.flightNo) && day(a) === day(b);
  const when = b => (b && b.source && b.source.date) || 0;
  let revive = new Set();   // ids "Read the last year again" cleared, which may come back
  function upsert(b, byHand) {
    if (graves['bookings:' + b.id] && !revive.has(b.id)) return 'gone';  // deleted on purpose: stays deleted
    let cur = bookings.find(x => x.id === b.id);
    // A gate or time update that doesn't name the airports belongs to that flight.
    if (!cur && b.type === 'flight' && (!b.from || !b.to)) cur = bookings.find(x => sameFlight(x, b));
    // The same flight number on another day in the same booking: the flight
    // was moved, and the newest email about it decides which day is right.
    if (b.type === 'flight' && b.conf) {
      const moved = bookings.filter(x => x !== cur && x.type === 'flight' && x.conf === b.conf && x.airlineCode === b.airlineCode && num(x.flightNo) === num(b.flightNo) && day(x) !== day(b));
      if (moved.some(x => x.edited || when(x) > when(b))) return 'old';
      if (moved.length) bookings = bookings.filter(x => !moved.includes(x));
    }
    if (!cur) { bookings.push({ ...b, created: Date.now(), notes: '', ...(byHand ? { source: null } : {}) }); return 'new'; }
    if (b.status === 'cancelled' && cur.status !== 'cancelled') { cur.status = 'cancelled'; return 'changed'; }
    if (cur.edited) return 'same';                                        // what you typed wins over any email
    let changed = false;
    // A later email wins, except a best-guess read over exact booking data.
    const newer = when(b) >= when(cur) && (!b.guess || cur.guess);
    for (const k of INFO_KEYS) {
      if (b[k] && (newer ? cur[k] !== b[k] : !cur[k])) { cur[k] = b[k]; changed = true; }
    }
    if (newer && cur.guess && !b.guess) { cur.guess = false; changed = true; }
    if (newer && b.source) cur.source = b.source;
    return changed ? 'changed' : 'same';
  }
  // A cancellation email that names a confirmation code but no bookings.
  function cancelByConf(conf) {
    let n = 0;
    if (!conf) return 0;
    bookings.forEach(b => { if (b.conf === conf && b.status !== 'cancelled') { b.status = 'cancelled'; n++; } });
    return n;
  }

  // ---------------------------------------------------------------------
  // Gmail: sign-in (as Mail does it) and reading
  // ---------------------------------------------------------------------
  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');
  class AuthError extends Error {}
  function ownToken() {
    try { const o = JSON.parse(ls.get(K.token, 'null')); if (o && o.exp > Date.now()) return o; } catch {}
    return null;
  }
  // Opened from AllisonOS Home, Mail's sign-in is in the same storage; its
  // permission (read, label, move) covers reading, so there's no second sign-in.
  function mailToken() {
    try { const o = JSON.parse(ls.get('mail.token', 'null')); if (o && o.exp > Date.now() && /gmail\.(modify|readonly)|mail\.google\.com/.test(o.scope || '')) return o; } catch {}
    return null;
  }
  const getToken = () => ownToken() || mailToken();
  // A quiet sign-in happens by itself only if the last one didn't fail in the
  // past 12 hours, so a Google that wants a tap never causes a redirect on every open.
  const mayRenew = () => !!ls.get(K.token + '.ever', '') && Date.now() - +ls.get(K.lastAuth, 0) > 60e3 && Date.now() - +ls.get(K.silentFail, 0) > 12 * H;
  const hasGmail = () => !!getToken() || !!ls.get(K.token + '.ever', '') || !!ls.get('mail.token.ever', '');
  function signIn(opts = {}) {
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    ls.set(K.state, nonce); ls.set(K.lastAuth, String(Date.now()));
    const hint = ls.get(K.hint, '') || ls.get('mail.hint', '');
    const u = new URL(AUTH);
    u.search = new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: redirectUri(), response_type: 'token', scope: SCOPE, include_granted_scopes: 'true', state: nonce,
      ...(hint && !opts.choose ? { login_hint: hint } : {}), ...(opts.choose ? { prompt: 'select_account' } : {}), ...(opts.silent ? { prompt: 'none' } : {}),
    });
    if (opts.silent) ls.set(K.silent, '1'); else ls.del(K.silent);
    location.href = u.toString();
  }
  function signOut() {
    const tok = ownToken();
    if (tok) fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true, body: new URLSearchParams({ token: tok.t }) }).catch(() => {});
    [K.token, K.token + '.ever', K.state, K.silent, K.silentFail, K.lastAuth, K.hint, K.me].forEach(ls.del);
    renderSettings(); render();
    toast('Signed out of Gmail. Your bookings stay.');
  }
  function consumeRedirect() {
    const raw = location.hash.slice(1);
    if (!raw || !/(^|&)(access_token|error)=/.test(raw)) return null;
    const p = new URLSearchParams(raw);
    history.replaceState(null, '', redirectUri() + location.search);
    const want = ls.get(K.state, ''), silent = ls.get(K.silent, '') === '1';
    ls.del(K.state); ls.del(K.silent);
    if (p.get('error')) { if (silent) ls.set(K.silentFail, String(Date.now())); return { error: p.get('error'), silent }; }
    if (!want || p.get('state') !== want) return { error: 'state_mismatch' };
    const life = parseInt(p.get('expires_in') || '3600', 10);
    ls.set(K.token, JSON.stringify({ t: p.get('access_token'), exp: Date.now() + life * 1000 - 60e3, scope: p.get('scope') || '' }));
    ls.set(K.token + '.ever', '1'); ls.del(K.silentFail);
    return { ok: true };
  }
  async function gmail(path, params, tries = 0) {
    const tok = getToken();
    if (!tok) throw new AuthError('signed out');
    const url = new URL(GMAIL + path);
    for (const [k, v] of Object.entries(params || {})) if (v != null) url.searchParams.set(k, v);
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
    let res, text;
    try { res = await fetch(url, { headers: { Authorization: 'Bearer ' + tok.t }, signal: ctl.signal }); text = await res.text(); }
    catch { clearTimeout(timer); if (tries < 2) { await sleep(600 * 2 ** tries); return gmail(path, params, tries + 1); } throw new Error('No connection to Gmail'); }
    clearTimeout(timer);
    if (res.status === 401) { if (tok === ownToken()) ls.del(K.token); throw new AuthError('expired'); }
    if (res.status === 429 || (res.status === 403 && /rate ?limit|quota/i.test(text))) { if (tries < 2) { await sleep(2500 + Math.random() * 1500); return gmail(path, params, tries + 1); } throw new Error('Gmail asked to slow down. Try again in a minute.'); }
    if (res.status >= 500 && tries < 2) { await sleep(800 * 2 ** tries); return gmail(path, params, tries + 1); }
    if (!res.ok) { let m = text.slice(0, 160); try { m = JSON.parse(text).error.message; } catch {} throw new Error(m || 'Gmail returned ' + res.status); }
    return text ? JSON.parse(text) : null;
  }
  async function pool(items, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
  }
  function decodePart(data, charset) {
    const bin = atob(String(data).replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    try { return new TextDecoder(charset || 'utf-8').decode(bytes); } catch { return new TextDecoder('utf-8').decode(bytes); }
  }
  function bodies(payload) {
    let html = '', text = '';
    const walk = p => {
      if (!p) return;
      const type = String(p.mimeType || '').toLowerCase();
      const cs = (/charset="?([\w-]+)/i.exec((p.headers || []).find(h => /^content-type$/i.test(h.name))?.value || '') || [])[1];
      if (p.body && p.body.data && !(p.filename)) {
        if (type === 'text/html' && !html) html = decodePart(p.body.data, cs);
        else if (type === 'text/plain' && !text) text = decodePart(p.body.data, cs);
      }
      (p.parts || []).forEach(walk);
    };
    walk(payload);
    return { html, text };
  }
  const header = (m, name) => ((m.payload && m.payload.headers) || []).find(h => h.name.toLowerCase() === name)?.value || '';

  let scanErr = '';
  async function scan({ loud } = {}) {
    if (st.scanning) return;
    if (!getToken()) {
      if (mayRenew()) { signIn({ silent: true }); return; }
      if (loud) openSettings();
      return;
    }
    st.scanning = true; scanErr = ''; render();
    busyPill('Reading Gmail');
    const startedAt = Date.now();
    const last = ls.get(K.queryV, '') === QUERY_V ? +ls.get(K.lastScan, 0) : 0;   // a wider search reads back a year once (seen mail is skipped)
    const since = last ? 'after:' + Math.floor(last / 1000 - 3 * 86400) : FIRST_SCAN;
    let added = 0, changed = 0, cancelled = 0, read = 0;
    try {
      if (!ls.get(K.me, '')) gmail('/profile').then(p => { if (p && p.emailAddress) { ls.set(K.me, p.emailAddress); ls.set(K.hint, p.emailAddress); } }).catch(() => {});
      const ids = [];
      let pageToken;
      do {
        const r = await gmail('/messages', { q: since + ' ' + QUERY, maxResults: 100, pageToken });
        (r.messages || []).forEach(m => ids.push(m));
        pageToken = r.nextPageToken;
      } while (pageToken && ids.length < MAX_SCAN);
      const todo = ids.filter(m => !seen.has(m.id)).slice(0, MAX_SCAN);
      st.scanTotal = todo.length; st.scanDone = 0;
      await pool(todo, 4, async m => {
        let msg;
        try { msg = await gmail('/messages/' + m.id, { format: 'full' }); }
        catch (e) { if (e instanceof AuthError) throw e; return; }        // one bad message doesn't stop the rest
        const { html, text } = bodies(msg.payload);
        let doc = null;
        if (html && /itemscope/i.test(html) && window.DOMParser) { try { doc = new DOMParser().parseFromString(html, 'text/html'); } catch {} }
        const r = P.parseEmail({ html, text, doc, subject: header(msg, 'subject'), from: header(msg, 'from'), date: +msg.internalDate || Date.now(), id: msg.id, threadId: msg.threadId });
        r.bookings.forEach(b => { const x = upsert(b); if (x === 'new') added++; else if (x === 'changed') changed++; });
        if (r.cancelled && !r.bookings.length) cancelled += cancelByConf(P.findConf(P.htmlToText(html) || text));
        seen.add(m.id); read++;
        st.scanDone++;
        if (st.scanDone % 10 === 0) busyPill('Reading Gmail · ' + st.scanDone + ' of ' + st.scanTotal);
      });
      ls.set(K.lastScan, String(startedAt)); ls.set(K.queryV, QUERY_V);
    } catch (e) {
      scanErr = e instanceof AuthError ? 'auth' : e.message;
    } finally {
      saveSeen(); save(); revive = new Set();
      st.scanning = false;
      render();
      if (scanErr === 'auth') { busyPill(); if (loud) { toast('Gmail needs you to sign in again.'); openSettings(); } else if (mayRenew()) signIn({ silent: true }); }
      else if (scanErr) { busyPill(); if (loud) toast(scanErr); }
      else {
        const bits = [];
        if (added) bits.push(plural(added, 'new booking'));
        if (changed) bits.push(plural(changed, 'update'));
        if (cancelled) bits.push(plural(cancelled, 'cancellation'));
        pillDone(bits.length ? bits.join(', ') : 'Up to date');
        if (loud && !bits.length) toast(read ? 'Read ' + plural(read, 'email') + '. Nothing new.' : 'Nothing new in Gmail.');
      }
      alive().filter(b => b.type === 'flight').forEach(b => refreshLive(b));
    }
  }
  $('scanBtn').onclick = () => scan({ loud: true });
  // Due every half hour, and straight away once the search has widened.
  const scanDue = () => ls.get(K.queryV, '') !== QUERY_V || Date.now() - +ls.get(K.lastScan, 0) > 30 * 6e4;

  // ---------------------------------------------------------------------
  // Live flight status (travel/api/flight, a Cloudflare Pages Function)
  // ---------------------------------------------------------------------
  let liveAvail = null;   // null: not asked yet; true/false once the server has answered
  const API = new URL('api/', location.href).href;
  // calls to the locked server routes go signed in (home/account.js), once accounts are on
  const aosFetch = (u, o) => window.AllisonOS && AllisonOS.account ? AllisonOS.account.fetch(u, o) : fetch(u, o);
  function lookupsThisMonth() { const o = ls.json(K.lookups, {}); const m = todayStr().slice(0, 7); return o.m === m ? o.n || 0 : 0; }
  function countLookup() { const m = todayStr().slice(0, 7), n = lookupsThisMonth() + 1; ls.set(K.lookups, JSON.stringify({ m, n })); }
  const liveWindow = b => {
    if (b.type !== 'flight' || b.status === 'cancelled' || !b.flightNo || !b.airlineCode || !b.dep) return false;
    const s = moment(b.dep, b.depIso), e = moment(b.arr || b.dep, b.arr ? b.arrIso : b.depIso);
    return s - Date.now() < 36 * H && Date.now() - e < 4 * H;
  };
  const inflight = new Map();
  function refreshLive(b, force) {
    if (!liveWindow(b) || liveAvail === false) return Promise.resolve();
    const cur = live[b.id];
    const soon = moment(b.dep, b.depIso) - Date.now() < 6 * H;
    if (!force && cur && Date.now() - cur.at < (soon ? 10 : 60) * 6e4) return Promise.resolve();
    if (!force && lookupsThisMonth() >= LOOKUPS_A_MONTH) return Promise.resolve();
    if (inflight.has(b.id)) return inflight.get(b.id);
    const p = (async () => {
      let r, data;
      try {
        r = await aosFetch(API + 'flight?' + new URLSearchParams({ no: b.airlineCode + b.flightNo, date: b.dep.slice(0, 10) }), { headers: { 'X-Travel': '1' }, cache: 'no-store' });
        data = await r.json();
      } catch { if (r && !/json/.test(r.headers.get('content-type') || '')) liveAvail = false; return; }   // no server here (e.g. GitHub Pages)
      liveAvail = true;
      if (data.error === 'no-key') { liveAvail = false; return; }
      countLookup();
      if (data.error) { live[b.id] = { at: Date.now(), error: data.error }; saveLive(); return; }
      const legs = (data.legs || []).filter(l => !l.cargo);
      const leg = legs.find(l => l.departure.iata === b.from) || legs.find(l => l.arrival.iata === b.to) || legs[0] || null;
      live[b.id] = { at: Date.now(), leg, found: !!leg };
      saveLive();
    })().finally(() => { inflight.delete(b.id); render(); if (st.booking && st.booking.id === b.id) renderLiveBox(); });
    inflight.set(b.id, p);
    return p;
  }
  const utc = s => { const t = Date.parse(String(s || '').replace(' ', 'T').replace(/Z$/, ':00Z').replace(/:(\d\d):00Z$/, ':$1:00Z')); return isNaN(t) ? Date.parse(String(s || '').replace(' ', 'T')) : t; };
  const localHM = s => { const m = /\d\d:\d\d/.exec(String(s || '')); if (!m) return ''; const [h, mi] = m[0].split(':').map(Number); return new Date(2000, 0, 1, h, mi).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  // What to show for a flight's live status, or null.
  function liveView(b) {
    const x = live[b.id];
    if (!x || !x.leg) return null;
    const l = x.leg, d = l.departure || {}, a = l.arrival || {};
    const sched = d.scheduled && utc(d.scheduled.utc), best = (d.revised || d.predicted) && utc((d.revised || d.predicted).utc);
    const late = sched && best ? Math.round((best - sched) / 6e4) : 0;
    const s = String(l.status || '').toLowerCase();
    let text = 'Scheduled', cls = 'info';
    if (/cancel/.test(s)) { text = 'Canceled'; cls = 'bad'; }
    else if (/divert/.test(s)) { text = 'Diverted'; cls = 'bad'; }
    else if (/arrived/.test(s)) { text = 'Landed'; cls = 'ok'; }
    else if (/departed|enroute|approaching/.test(s)) { text = 'In the air'; cls = 'ok'; }
    else if (/boarding/.test(s)) { text = 'Boarding'; cls = 'ok'; }
    else if (/gateclosed/.test(s)) { text = 'Gate closed'; cls = 'warn'; }
    else if (late >= 15 || /delay/.test(s)) { text = late > 0 ? 'Delayed ' + (late >= 60 ? Math.floor(late / 60) + ' h ' + (late % 60 ? late % 60 + ' min' : '') : late + ' min') : 'Delayed'; cls = 'warn'; }
    else if (/checkin/.test(s)) { text = 'Check-in open'; cls = 'ok'; }
    else if (/expected|scheduled/.test(s)) { text = late > 4 ? 'Late ' + late + ' min' : 'On time'; cls = late > 4 ? 'warn' : 'ok'; }
    return { text: text.trim(), cls, late, gate: d.gate, terminal: d.terminal, arrGate: a.gate, arrTerminal: a.terminal, belt: a.belt, l, at: x.at };
  }
  function renderLiveBox(loading) {
    const box = $('bkLive'), b = st.booking;
    if (!box || !b) return;
    const v = liveView(b), x = live[b.id];
    let h = '<div class="row"><b class="grow">Live status</b>';
    if (v) h += '<span class="st ' + v.cls + '">' + esc(v.text) + '</span>';
    h += '<button class="iconbtn" type="button" id="bkLiveGo" aria-label="Check again">' + I.refresh + '</button></div>';
    if (loading || inflight.has(b.id)) h += '<p class="hint" style="margin:0">Checking…</p>';
    else if (liveAvail === false) h += '<p class="hint" style="margin:0">Live status isn’t set up on this copy of the site. It works on the Cloudflare site once the flight data key is added (Travel README, “Live flight status”).</p>';
    else if (!liveWindow(b)) h += '<p class="hint" style="margin:0">Shows from 36 hours before take-off until the flight has landed.</p>';
    else if (x && x.error) h += '<p class="hint" style="margin:0">' + esc({ limit: 'The flight data service’s monthly allowance is used up.', 'key-refused': 'The flight data service refused the key.', unreachable: 'Couldn’t reach the flight data service.' }[x.error] || 'Couldn’t get the status just now.') + '</p>';
    else if (x && !x.found) h += '<p class="hint" style="margin:0">No live data for ' + esc(flightName(b)) + ' on this date yet. Check the flight number and date.</p>';
    else if (v) {
      const d = v.l.departure || {}, a = v.l.arrival || {};
      const cell = (label, big, small, old) => '<div class="cell"><span>' + esc(label) + '</span><b>' + esc(big || '—') + '</b>' + (old ? '<s>' + esc(old) + '</s>' : '') + (small ? '<i>' + esc(small) + '</i>' : '') + '</div>';
      const t = e => { const best = e.revised || e.predicted || e.scheduled; return best ? localHM(best.local) : ''; };
      const was = e => (e.revised || e.predicted) && e.scheduled && localHM((e.revised || e.predicted).local) !== localHM(e.scheduled.local) ? localHM(e.scheduled.local) : '';
      h += '<div class="grid2">' + cell('Departs ' + (d.iata || b.from || ''), t(d), [d.terminal ? 'Terminal ' + d.terminal : '', d.gate ? 'Gate ' + d.gate : ''].filter(Boolean).join(' · '), was(d))
        + cell('Lands ' + (a.iata || b.to || ''), t(a), [a.terminal ? 'Terminal ' + a.terminal : '', a.gate ? 'Gate ' + a.gate : '', a.belt ? 'Bags: belt ' + a.belt : ''].filter(Boolean).join(' · '), was(a)) + '</div>';
      h += '<p class="hint" style="margin:0">Checked ' + esc(ago(v.at)) + (v.l.aircraft ? ' · ' + esc(v.l.aircraft) : '') + '. From AeroDataBox; times are local to each airport.</p>';
    } else h += '<p class="hint" style="margin:0">Not checked yet.</p>';
    box.innerHTML = h;
  }

  // ---------------------------------------------------------------------
  // Calendar files, and the Family calendar
  // ---------------------------------------------------------------------
  // Where the site is on Cloudflare, the Calendar app's function puts the
  // events straight into the iCloud Family calendar (calendar/README.md);
  // anywhere else, or if that fails, a calendar file as before.
  const CAL_API = new URL('../calendar/api/', location.href).href;
  let calAvail = null;
  async function addToCalendar(text, title, what) {
    if (calAvail !== false) {
      try {
        const r = await aosFetch(CAL_API + 'import', { method: 'POST', headers: { 'X-Calendar': '1', 'Content-Type': 'text/calendar; charset=utf-8' }, body: text, cache: 'no-store' });
        let d = null; try { d = await r.json(); } catch {}
        if (r.ok && d && d.ok) { calAvail = true; toast('Added ' + what + ' to the ' + (d.calendar && d.calendar.name || 'Family') + ' calendar.'); return; }
        if (r.status === 404 || (d && d.error === 'no-account')) calAvail = false;
        else if (d && d.error) toast('The Family calendar couldn’t take it (' + d.error + '). Saving a calendar file instead.');
      } catch {}
    }
    const r = await shareOut(new File([text], fileName(title) + '.ics', { type: 'text/calendar' }), title);
    if (r === 'downloaded') toast('Calendar file saved. Open it to add ' + what + ' to your calendar.');
  }
  const fileName = s => (s || 'trip').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'trip';
  function ics(list) {
    const e2 = v => String(v || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\r\n|\r|\n/g, '\\n');   // \r too: a lone \r would start a line of its own
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const utcS = t => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const floating = at => at.replace(/[-:]/g, '').slice(0, 13) + '00';
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Allison OS//Travel//EN', 'CALSCALE:GREGORIAN'];
    // Exact (UTC) when the email gave the time zone; otherwise "floating",
    // which the calendar shows at that clock time wherever you are.
    const timed = (at, iso) => ({ s: iso && !isNaN(Date.parse(iso)) ? 'DTSTART:' + utcS(Date.parse(iso)) : 'DTSTART:' + floating(at) });
    const ev = (uid, summary, start, endLine, loc, desc, alarmMin) => {
      L.push('BEGIN:VEVENT', 'UID:' + uid + '@allison-travel', 'DTSTAMP:' + stamp, start, endLine, 'SUMMARY:' + e2(summary));
      if (loc) L.push('LOCATION:' + e2(loc));
      if (desc) L.push('DESCRIPTION:' + e2(desc));
      if (alarmMin != null) L.push('BEGIN:VALARM', 'TRIGGER:-PT' + alarmMin + 'M', 'ACTION:DISPLAY', 'DESCRIPTION:' + e2(summary), 'END:VALARM');
      L.push('END:VEVENT');
    };
    const endFor = (startAt, startIso, endAt, endIso, fallbackMin) => {
      if (endIso && startIso && !isNaN(Date.parse(endIso))) return 'DTEND:' + utcS(Date.parse(endIso));
      if (startIso && !isNaN(Date.parse(startIso))) return 'DTEND:' + utcS(Date.parse(startIso) + (endAt && startAt ? Math.max(30, (Date.parse(endAt) - Date.parse(startAt)) / 6e4) : fallbackMin) * 6e4);
      if (endAt && endAt.length >= 16) return 'DTEND:' + floating(endAt);
      const d = new Date(Date.parse(startAt) + fallbackMin * 6e4);
      return 'DTEND:' + floating(ymd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()));
    };
    for (const b of list) {
      const desc = [b.conf ? 'Confirmation: ' + b.conf : '', b.notes].filter(Boolean).join('\n');
      if (b.type === 'flight' && b.dep) {
        const dep = b.dep.length >= 16 ? b.dep : b.dep + 'T09:00';
        ev(b.id, '✈ ' + flightName(b) + ' ' + (b.from || '') + ' → ' + (b.to || ''), timed(dep, b.depIso).s, endFor(dep, b.depIso, b.arr, b.arrIso, 120), b.fromName || city(b.from), desc, 180);
      } else if (b.type === 'hotel' && b.checkIn) {
        const out = b.checkOut && b.checkOut > b.checkIn ? b.checkOut : P.addDays(b.checkIn, 1);
        ev(b.id, '🏨 ' + (b.name || 'Hotel'), 'DTSTART;VALUE=DATE:' + b.checkIn.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + out.replace(/-/g, ''), [b.name, b.address].filter(Boolean).join(', '), desc, null);
      } else if (b.type === 'car' && b.pickup) {
        const pu = b.pickup.length >= 16 ? b.pickup : b.pickup + 'T10:00';
        ev(b.id + '-pu', '🚗 Pick up · ' + (b.company || 'Car hire'), timed(pu, b.pickupIso).s, endFor(pu, b.pickupIso, '', '', 30), b.pickupPlace, desc, 60);
        if (b.dropoff) { const dr = b.dropoff.length >= 16 ? b.dropoff : b.dropoff + 'T10:00'; ev(b.id + '-dr', '🚗 Return · ' + (b.company || 'Car hire'), timed(dr, b.dropoffIso).s, endFor(dr, b.dropoffIso, '', '', 30), b.dropPlace || b.pickupPlace, desc, 60); }
      } else if (b.start) {
        const s = b.start.length >= 16 ? b.start : b.start + 'T09:00';
        ev(b.id, b.title || 'Booking', 'DTSTART:' + floating(s), endFor(s, '', b.end, '', 60), b.place, desc, 60);
      }
    }
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  // ---------------------------------------------------------------------
  // Explore
  // ---------------------------------------------------------------------
  const ex = Object.assign({ from: '', to: '', out: '', back: '' }, ls.json(K.explore, {}));
  function renderExplore() {
    $('exFrom').value = ex.from || homeAirport || ''; $('exTo').value = ex.to; $('exOut').value = ex.out; $('exBack').value = ex.back;
    drawLinks();
  }
  function drawLinks() {
    const from = $('exFrom').value.trim(), to = $('exTo').value.trim(), out = $('exOut').value, back = $('exBack').value;
    Object.assign(ex, { from, to, out, back }); ls.set(K.explore, JSON.stringify(ex));
    const where = placeWords(to) || 'anywhere', when = out ? fmtRange(out, back || out) : 'any dates';
    $('exLinks').innerHTML = linkRow(LINKS.googleFlights(from, to, out, back), 'Google Flights', (from || 'From anywhere') + ' → ' + (to || 'anywhere') + ' · ' + when, I.flight)
      + linkRow(LINKS.googleHotels(placeWords(to), out, back), 'Google Hotels', where + ' · ' + when, I.hotel)
      + linkRow(LINKS.marriott(placeWords(to), out, back), 'Marriott', where + ' · ' + when, I.hotel)
      + linkRow(LINKS.kayakCars(to || '', out, back), 'Car hire (Kayak)', where + ' · ' + when, I.car)
      + linkRow(LINKS.national(), 'National Car Rental', 'Opens nationalcar.com', I.car);
  }
  ['exFrom', 'exTo', 'exOut', 'exBack'].forEach(id => $(id).addEventListener('input', drawLinks));
  $('exSwap').onclick = () => { const a = $('exFrom').value; $('exFrom').value = $('exTo').value; $('exTo').value = a; drawLinks(); };
  $('exForm').onsubmit = e => e.preventDefault();

  // ---------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------
  function setTab(t) {
    if (st.tab !== t) window.scrollTo(0, 0);
    st.tab = t; ls.set(K.tab, t);
    $('tripsView').hidden = t !== 'trips';
    $('exploreView').hidden = t !== 'explore';
    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    slideTabs();
    if (t === 'trips') slideWhen();   // hidden until now, so not measured
    if (t === 'explore') renderExplore(); else animateIn($('list'));
  }
  document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });

  // ---------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------
  function renderSettings() {
    const own = ownToken(), viaMail = !own && mailToken(), ever = ls.get(K.token + '.ever', '');
    const me = ls.get(K.me, '');
    let rows = '';
    if (own || viaMail || ever) {
      rows += '<button class="rowbtn" type="button" id="stScan"><span class="ic">' + I.mail + '</span><span>Look for new bookings now<span class="sub">'
        + esc(+ls.get(K.lastScan, 0) ? 'Last checked ' + ago(+ls.get(K.lastScan, 0)) + '.' : 'Not checked yet.') + ' It also checks each time Travel opens.</span></span></button>';
      rows += '<button class="rowbtn" type="button" id="stRescan"><span class="ic">' + I.refresh + '</span><span>Read the last year again<span class="sub">Reads every booking email afresh and replaces what was read before. Bookings you edited, checked or deleted stay as they are.</span></span></button>';
      if (own || ever) rows += '<button class="rowbtn" type="button" id="stOut"><span class="ic">' + I.out + '</span><span>Sign out of Gmail<span class="sub">' + esc(me || 'Signed in') + '</span></span></button>';
    } else {
      rows += '<button class="rowbtn" type="button" id="stIn"><span class="ic">' + I.mail + '</span><span>Connect Gmail<span class="sub">Read-only: Travel can read email, never send, change or delete it</span></span></button>';
    }
    $('stGmail').innerHTML = rows;
    $('stGmailHint').textContent = viaMail ? 'Using Mail’s sign-in (opened from AllisonOS Home). Travel only reads.'
      : 'Travel looks for confirmations from airlines, hotels and car hire firms in the last year of email, then for new ones each time it opens. Promotions are skipped.';
    $('stSheetSub').textContent = !syncCfg ? 'Not connected' : syncState === 'error' ? (SYNC_ERRORS[syncErr] || 'Not synced') : lastSyncAt ? 'Last synced ' + ago(lastSyncAt) : 'Connected';
    const n = lookupsThisMonth();
    $('stLive').textContent = liveAvail === true ? 'Working. Flights are checked from 36 hours before take-off until they land. ' + plural(n, 'lookup') + ' this month on this phone (stops at ' + LOOKUPS_A_MONTH + ' to stay in the free allowance).'
      : liveAvail === false ? 'Not available on this copy of the site. It works on the Cloudflare copy once the AERODATABOX_KEY secret is added (Travel README).'
      : 'Checking…';
  }
  function openSettings() {
    renderSettings(); openSheet('setSheet');
    if (liveAvail === null) pingLive().then(renderSettings);
  }
  async function pingLive() {
    try {
      const r = await aosFetch(API + 'ping', { headers: { 'X-Travel': '1' }, cache: 'no-store' });
      const d = await r.json();
      liveAvail = !!d.status;
    } catch { liveAvail = false; }
  }
  $('setBtn').onclick = openSettings;
  $('stGmail').addEventListener('click', e => {
    if (e.target.closest('#stIn')) signIn({ choose: true });
    else if (e.target.closest('#stScan')) { closeSheet('setSheet'); scan({ loud: true }); }
    else if (e.target.closest('#stRescan')) {
      // Start over: bookings read from email (and not edited or checked by
      // you) are cleared and read again, so an improved reader replaces its
      // old mistakes. Anything not found again stays gone, on both phones.
      const auto = bookings.filter(b => b.source && b.source.msgId && !b.edited && !b.checked);
      revive = new Set(auto.map(b => b.id));
      bookings = bookings.filter(b => !revive.has(b.id));
      save();
      seen = new Set(); saveSeen(); ls.del(K.lastScan); closeSheet('setSheet'); scan({ loud: true });
    }
    else if (e.target.closest('#stOut')) signOut();
  });
  $('stSheet').onclick = () => { closeSheet('setSheet'); openSyncSheet(); };
  $('stExport').onclick = async () => {
    const file = new File([JSON.stringify({ app: 'allison-travel', v: 1, kind: 'backup', saved: new Date().toISOString(), bookings, trips }, null, 2)], 'travel-backup-' + todayStr() + '.json', { type: 'application/json' });
    const r = await shareOut(file, 'Travel backup');
    toast({ shared: 'Backup saved', downloaded: 'Backup saved to Downloads', cancelled: 'Backup canceled' }[r] || 'Couldn’t save the backup');
  };
  $('stImport').onclick = () => $('stFile').click();
  $('stFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); } catch { toast('That file isn’t a Travel backup.'); return; }
    if (!data || data.app !== 'allison-travel' || !Array.isArray(data.bookings)) { toast('That file isn’t a Travel backup.'); return; }
    const have = new Set(bookings.map(b => b.id));
    const ok = b => b && typeof b.id === 'string' && /^(flight|hotel|car|other)$/.test(b.type);
    const add = data.bookings.filter(b => ok(b) && !have.has(b.id));
    bookings.push(...add);
    (data.trips || []).forEach(t => { if (t && typeof t.id === 'string' && typeof t.name === 'string' && !trips.some(x => x.id === t.id)) trips.push(t); });
    save(); render(); closeSheet('setSheet');
    toast('Restored ' + plural(add.length, 'booking'));
  });

  // ---------------------------------------------------------------------
  // Google Sheet sync - the same as Notes', for bookings and trip names
  // ---------------------------------------------------------------------
  let syncing = false, syncAgain = false, syncTimer = null, syncState = syncCfg ? 'idle' : 'off', syncErr = '', errShown = false;
  let lastSyncAt = +ls.get(K.syncAt, 0) || 0;
  const SYNC_ERRORS = {
    'wrong-secret': 'The secret code doesn’t match the script’s. If you changed SECRET after deploying, the web app still has the old one: Deploy → Manage deployments → ✏️ → Version: New version → Deploy. Also check the phone didn’t fill in the Notes code.',
    'old-script': 'The Sheet is running an old copy of the script. Deploy → Manage deployments → ✏️ → Version: New version → Deploy, then try again.',
    'secret-not-set': 'The script still says SECRET = ‘CHANGE-ME’. Change it, save, and deploy a new version.',
    'busy': 'The Sheet was busy. Trying again shortly.',
    'bad-request': 'The Sheet didn’t understand the request.',
    'network': 'Couldn’t reach the Sheet. Check the link, or you may be offline.',
    'not-json': 'That link didn’t answer like the Travel script. Check it ends in /exec and “Who has access” is Anyone.',
    'wrong-app': 'That’s the Notes Sheet’s link. Travel needs the web app link from the AllisonOS - Travel Sheet (Extensions → Apps Script → Deploy → Manage deployments).',
  };
  function saveSyncCfg() {
    if (syncCfg) ls.set(K.sync, JSON.stringify(syncCfg)); else ls.del(K.sync);
    keep.set('sync', syncCfg ? { url: syncCfg.url, secret: syncCfg.secret } : null);
  }
  function applyRemote(res) {
    Object.keys(res.graves || {}).forEach(k => { const t = +res.graves[k] || 0; if ((graves[k] || 0) < t) graves[k] = t; });
    let localNewer = false;
    const mergeKind = (kind, local, remote) => {
      const map = new Map(local.map(x => [x.id, x]));
      (remote || []).forEach(r => {
        if (!r || typeof r.id !== 'string') return;
        const l = map.get(r.id);
        if (!l || (+r.updated || 0) > (+l.updated || 0)) map.set(r.id, r);
        else if ((+l.updated || 0) > (+r.updated || 0)) localNewer = true;
      });
      const remoteIds = new Set((remote || []).map(r => r && r.id));
      local.forEach(l => { if (!remoteIds.has(l.id) && !graves[kind + ':' + l.id]) localNewer = true; });
      return [...map.values()].filter(x => { const g = graves[kind + ':' + x.id]; return !(g && g >= (+x.updated || 0)); });
    };
    // Only bookings of a type this app knows, as the backup import requires.
    bookings = mergeKind('bookings', bookings, (res.bookings || []).filter(b => b && /^(flight|hotel|car|other)$/.test(b.type)));
    trips = mergeKind('trips', trips, res.trips);
    initShadow(); persist();
    if (localNewer) syncAgain = true;
    render();
  }
  async function sync(loud) {
    if (!syncCfg) return false;
    if (syncing) { syncAgain = true; return false; }
    if (!navigator.onLine) { syncState = 'offline'; return false; }
    syncing = true; syncState = 'syncing';
    if (loud) busyPill('Syncing');
    let ok = false;
    try {
      track(); persist();
      let r, res;
      try {
        r = await fetch(syncCfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', cache: 'no-store',
          body: JSON.stringify({ secret: syncCfg.secret, action: 'sync', v: 1, bookings, trips, graves }) });
      } catch { throw new Error('network'); }
      try { res = await r.json(); } catch { throw new Error('not-json'); }
      if (res && res.ok && res.app && res.app !== 'allison-travel-sync') throw new Error('wrong-app');
      if (res && res.error === 'wrong-secret' && res.app !== 'allison-travel-sync') throw new Error(await whichScript(syncCfg.url));
      if (!res || !res.ok) throw new Error((res && res.error) || 'not-json');
      lastSyncAt = Date.now(); ls.set(K.syncAt, String(lastSyncAt));
      syncState = 'ok'; syncErr = ''; errShown = false; ok = true;
      applyRemote(res);
      if (loud) pillDone('Synced');
    } catch (e) {
      syncState = 'error'; syncErr = e.message; busyPill();
      if (loud || !errShown) { errShown = true; toast(SYNC_ERRORS[syncErr] || 'Sync didn’t work. Trying again later.'); }
    } finally {
      syncing = false; renderSyncStatus();
      if (syncAgain) { syncAgain = false; scheduleSync(800); }
    }
    return ok;
  }
  // A "wrong secret" from a script that doesn't say it's Travel's: ask the
  // link which app it belongs to (every script answers a plain GET with its
  // name). Notes' means the wrong link; Travel's means the deployed copy is
  // older than this change, which added the name to that answer.
  async function whichScript(url) {
    try {
      const r = await fetch(url, { cache: 'no-store', redirect: 'follow' });
      const d = await r.json();
      if (d && d.app && d.app !== 'allison-travel-sync') return 'wrong-app';
      if (d && d.app === 'allison-travel-sync') return 'old-script';
    } catch {}
    return 'wrong-secret';
  }
  function scheduleSync(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(() => sync(false), ms == null ? 2000 : ms); }
  function renderSyncStatus() {
    const on = !!syncCfg;
    const line = !on ? 'Not connected' : syncState === 'error' ? (SYNC_ERRORS[syncErr] || 'Not synced') : syncState === 'syncing' ? 'Syncing…'
      : syncState === 'offline' ? 'Offline. Changes will sync when you’re back online.' : lastSyncAt ? 'Connected. Last synced ' + ago(lastSyncAt) + '.' : 'Connected.';
    $('syStatus').textContent = line;
    $('syForm').hidden = on; $('syOn').hidden = !on;
    if (!$('setSheet').hidden) renderSettings();
    if (!$('tripsView').hidden) { const sub = $('tripsSub').textContent; if (/Sync/.test(sub) || on) render(); }
  }
  function openSyncSheet(pre) {
    $('syUrl').value = pre ? pre.u : syncCfg ? syncCfg.url : '';
    $('sySecret').value = pre ? pre.s : syncCfg ? syncCfg.secret : '';
    renderSyncStatus();
    if (pre) { $('syForm').hidden = false; $('syOn').hidden = true; $('syStatus').textContent = 'From a setup link. Tap Connect and sync.'; }
    openSheet('syncSheet');
  }
  $('syForm').onsubmit = async e => {
    e.preventDefault();
    const url = $('syUrl').value.trim(), secret = $('sySecret').value.trim();
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { $('syStatus').textContent = 'Paste the web app link from Apps Script. It starts with https://script.google.com/ and ends in /exec.'; return; }
    if (!secret) { $('syStatus').textContent = 'Enter the secret code you put in the script.'; return; }
    const before = syncCfg;
    syncCfg = { url, secret };
    $('syConnect').disabled = true; $('syStatus').textContent = 'Connecting…';
    const ok = await sync(true);
    $('syConnect').disabled = false;
    if (!ok) { syncCfg = before; renderSyncStatus(); $('syStatus').textContent = SYNC_ERRORS[syncErr] || 'Couldn’t connect.'; return; }
    saveSyncCfg(); renderSyncStatus();
    toast('Connected. ' + plural(bookings.length, 'booking') + ' now in the Sheet.');
  };
  $('syNow').onclick = async () => { if (await sync(true)) toast('Synced'); };
  $('syShare').onclick = async () => {
    const link = location.href.split('#')[0] + '#sync=' + b64e(JSON.stringify({ u: syncCfg.url, s: syncCfg.secret }));
    try { await navigator.clipboard.writeText(link); toast('Setup link copied. On the other phone: copy it, open Travel and tap the clipboard button. Keep it private.', null, 6000); }
    catch { toast('Copy isn’t available here.'); }
  };
  $('syOff').onclick = () => {
    const b = $('syOff');
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to disconnect'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Disconnect this phone'; }, 3500); return; }
    delete b.dataset.armed; b.textContent = 'Disconnect this phone';
    syncCfg = null; syncState = 'off'; saveSyncCfg(); renderSyncStatus();
    toast('Disconnected. Your bookings stay on this phone and in the Sheet.');
  };
  function takeSetupLink(text) {
    const m = String(text).match(/#sync=([\w-]+)/); if (!m) return false;
    try { const c = JSON.parse(b64d(m[1])); if (c && c.u && c.s) { openSyncSheet(c); return true; } } catch {}
    toast('That setup link is damaged. Copy it again.'); return true;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (syncCfg && Date.now() - lastSyncAt > 30000) sync(false);
    if (getToken() && scanDue()) scan();
    alive().filter(b => b.type === 'flight').forEach(b => refreshLive(b));
    render();
  });
  window.addEventListener('online', () => { if (syncCfg) sync(false); });

  // ---------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------
  const back = consumeRedirect();
  if (location.hash.startsWith('#sync=')) { const h = location.hash; history.replaceState(null, '', location.pathname + location.search); setTimeout(() => takeSetupLink(h), 300); }
  setTab(st.tab === 'explore' ? 'explore' : 'trips');
  render();
  if (back && back.error) {
    if (!(back.silent && /^(interaction|login|consent|account_selection)_required$/.test(back.error))) toast(back.error === 'access_denied' ? 'Gmail access was declined.' : 'Gmail sign-in didn’t work (' + back.error + ').', null, 6000);
    else toast('Gmail needs one tap to sign in again: Settings → Connect Gmail.', null, 6000);
  }
  // Read Gmail on open: always after a sign-in, else if it's been a while.
  if (getToken() && (back && back.ok || scanDue())) setTimeout(() => scan({ loud: !!(back && back.ok) }), 400);
  else if (!getToken() && mayRenew() && Date.now() - +ls.get(K.lastScan, 0) > 6 * H) setTimeout(() => signIn({ silent: true }), 800);
  alive().filter(b => b.type === 'flight').forEach(b => refreshLive(b));
  if (syncCfg) { setTimeout(() => sync(false), 600); keep.get('sync').then(c => { if (!c || c.url !== syncCfg.url || c.secret !== syncCfg.secret) saveSyncCfg(); }); }
  else keep.get('sync').then(c => {
    if (syncCfg || !c || !c.url || !c.secret) return;
    syncCfg = { url: c.url, secret: c.secret }; syncState = 'idle'; ls.set(K.sync, JSON.stringify(syncCfg));
    sync(false); toast('Reconnected to the Google Sheet from this phone’s backup copy.');
  });
  // Refresh "in 3 h" labels and live status while open.
  setInterval(() => { if (document.visibilityState === 'visible') { alive().filter(b => b.type === 'flight').forEach(b => refreshLive(b)); render(); } }, 5 * 6e4);
  // "Updated" pill, once, when a new version arrives (as in Notes).
  (function () {
    const src = [...document.querySelectorAll('style')].map(e => e.textContent).join('') + String(document.scripts.length);
    let h = 2166136261;
    for (let i = 0; i < src.length; i++) { h ^= src.charCodeAt(i); h = Math.imul(h, 16777619); }
    const ver = (h >>> 0).toString(36) + (window.TRAVEL_BUILD || ''), VK = KEY + '-version';
    const prev = ls.get(VK, null);
    ls.set(VK, ver);
    if (!prev || prev === ver) return;
    const pill = $('updPill'); pill.hidden = false;
    setTimeout(() => { pill.classList.add('out'); setTimeout(() => { pill.hidden = true; pill.classList.remove('out'); }, 450); }, 5000);
  })();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // For the tests (travel/scripts/app-test.mjs) only.
  window.__travel = { get bookings() { return bookings; }, upsert, groupTrips, ics, liveView, live, render, scan, save };
})();
