"use strict";

// Travel: every flight, hotel and rental car in one place.
//
// - Bookings come from Gmail (read on the phone, read-only), from a pasted
//   confirmation, or typed in. parse.js does the reading.
// - Bookings close together in time make a trip; each trip is a timeline.
// - Flights close to departure get live status from travel/api/flight (a
//   Cloudflare Pages Function holding the flight data key).
// - The family's Google Sheet, through aOS, is the record: trips are shared
//   with the family, except a booking or trip marked Just me (aOS/SHEETS.md).
// - Explore and each trip link out to Google Flights, Google Hotels,
//   Marriott and rental car searches, filled in.
// - Two designs, picked in Settings > Design: Vintage (the default) and Standard
//   (Sea glass), kept on this phone (../home/design.js, as in Clock).

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
    sync: KEY + '-sync', graves: KEY + '-graves', syncAt: KEY + '-sync-at', explore: KEY + '-explore', family: KEY + '-family', who: KEY + '-who', people: KEY + '-people',
    calOn: KEY + '-cal-on', aiOn: KEY + '-ai-on', ai: KEY + '-ai', aiLast: KEY + '-ai-last', revive: KEY + '-revive', scanLog: KEY + '-scan-log', scanInfo: KEY + '-scan-info', smartAt: KEY + '-smart-at',
    ipsyAuto: KEY + '-ipsy-auto', ipsyTried: KEY + '-ipsy-tried',
  };
  const FIRST_SCAN = 'newer_than:1y';
  const MAX_SCAN = 400;              // messages read in one go at most
  const LOOKUPS_A_MONTH = 250;       // per phone; meant to stay inside AeroDataBox's free plan (README, "What I could not verify")
  // Booking emails: the subjects they use, and the senders you book with.
  const SENDERS = [
    // airlines
    'united.com', 'delta.com', 'aa.com', 'southwest.com', 'alaskaair.com', 'jetblue.com', 'flyfrontier.com', 'flybreeze.com', 'spirit.com', 'hawaiianairlines.com',
    'allegiantair.com', 'suncountry.com', 'aveloair.com', 'aircanada.com', 'westjet.com', 'britishairways.com', 'virginatlantic.com', 'lufthansa.com', 'klm.com',
    'airfrance.com', 'iberia.com', 'emirates.com', 'qatarairways.com', 'etihad.com', 'turkishairlines.com', 'singaporeair.com', 'cathaypacific.com', 'qantas.com',
    'aeromexico.com', 'copaair.com', 'latam.com', 'icelandair.com', 'norwegian.com', 'ryanair.com', 'easyjet.com', 'volaris.com',
    // hotels (Hilton's group blocks come through Cvent and Passkey)
    'marriott.com', 'res-marriott.com', 'hilton.com', 'hyatt.com', 'ihg.com', 'wyndhamhotels.com', 'choicehotels.com', 'bestwestern.com', 'radissonhotels.com',
    'accor.com', 'omnihotels.com', 'fourseasons.com', 'sonesta.com', 'cvent.com', 'passkey.com',
    // rental cars, trains, and the sites that book all of it
    'nationalcar.com', 'enterprise.com', 'alamo.com', 'hertz.com', 'avis.com', 'budget.com', 'dollar.com', 'thrifty.com', 'sixt.com', 'turo.com', 'amtrak.com',
    'booking.com', 'expedia.com', 'hotels.com', 'airbnb.com', 'vrbo.com', 'priceline.com', 'kayak.com', 'orbitz.com', 'travelocity.com', 'hopper.com'];
  const SUBJECTS = ['confirmation', 'confirmed', 'itinerary', 'reservation', 'booking', 'eticket', '"e-ticket"', 'receipt', '"your trip"',
    '"your flight"', '"your stay"', '"check in"', 'cancelled', 'canceled', 'cancellation'];
  // Plus anything Mail's Travel auto-tag has labelled (rides, Hopper, gate and
  // delay notices): Gmail keeps that label up to date as mail arrives.
  const QUERY = '-in:chats -in:spam -in:trash -category:promotions {label:Travel ' + SUBJECTS.map(s => 'subject:' + s).join(' ') + ' ' + SENDERS.map(s => 'from:' + s).join(' ') + '}';
  // Bump QUERY_V whenever the reader (parse.js) or QUERY changes: the next scan then reads the last year again, once, and what the old
  // reader made of those emails is rebuilt (travel/scripts/reader-version-test.mjs fails if parse.js changes and this does not).
  const QUERY_V = '5';

  const I = {
    lock: '<svg class="lk" viewBox="0 0 24 24"><rect x="4.6" y="10.4" width="14.8" height="10.4" rx="3"/><path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8"/></svg>',
    me: '<svg class="lk" viewBox="0 0 24 24"><circle cx="12" cy="8.2" r="3.8"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M12 3.2l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z"/><path d="M18.6 15.4l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/></svg>',
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
  const TYPE_NAME = { flight: 'Flight', hotel: 'Hotel', car: 'Rental car', other: 'Other' };
  // a rental car's company, or "Rental car" (older bookings were saved as "Car hire")
  const carCo = b => b.company && b.company !== 'Car hire' ? b.company : 'Rental car';

  // ---------------------------------------------------------------------
  // Data: bookings (and trip names), kept like Notes keeps notes
  // ---------------------------------------------------------------------
  const saved = ls.json(KEY, null);
  let bookings = saved && Array.isArray(saved.bookings) ? saved.bookings : [];
  let trips = saved && Array.isArray(saved.trips) ? saved.trips : [];        // {id (first booking's id), name, updated}
  let graves = ls.json(K.graves, {});
  let seen = new Set(ls.json(K.seen, []));
  let live = ls.json(K.live, {});                                            // booking id -> {at, leg, error}
  const shadow = new Map();
  let ipsy = null;      // Ipsy's handle (../home/ipsy.js), once it is mounted at the bottom of this file
  const st = { tab: ls.get(K.tab, 'trips'), when: ls.get(K.when, 'upcoming'), trip: null, booking: null, isNew: false, scanning: false, scanDone: 0, scanTotal: 0 };
  let lastSyncAt = +ls.get(K.syncAt, 0) || 0;

  // Whose a booking is. In the family's Sheet each booking and trip name is its own person's (by,
  // stamped by the Sheet), shared with the family unless that person made it Just me (only). One
  // not synced yet has no by: it's yours. Who you are: your family sign-in, or (signed out) who
  // the Sheet last said you were.
  const signedIn = () => !!(window.AllisonOS && AllisonOS.account && AllisonOS.account.token());
  const meId = () => { const u = window.AllisonOS && AllisonOS.account && AllisonOS.account.user(); return (u && u.id) || ls.get(K.who, ''); };
  const mine = b => !!b && (!b.by || b.by === meId());
  const whose = b => (ls.json(K.people, {})[b.by] || '').trim();
  // A booking whose email is in this phone's Gmail (read here, or yours): someone else's shared booking came from theirs.
  const myMail = b => !!(b && b.source && b.source.msgId && (seen.has(b.source.msgId) || mine(b)));

  // The IndexedDB copy of the Sheet link and code this phone kept before aOS kept them: read once
  // to hand them over to aOS (handOver, below), then deleted. Opened once the old Travel Vintage
  // app's copy is moved over, at its address (../home/design.js).
  const keep = (() => {
    let db = null;
    const open = () => db || (db = Promise.resolve(window.aosDesign && aosDesign.moved).catch(() => {}).then(() => new Promise((res, rej) => {
      const r = indexedDB.open('allison-travel', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    })));
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
    if (!ok && !storeWarned) { storeWarned = true; toast('This phone couldn’t save Travel: storage is full.' + (lastSyncAt ? ' Your bookings are safe in the family’s Google Sheet.' : ' Back up soon.')); }
    shareCal();
  }
  // Calendar's Travel layer: your bookings, just the fields Calendar shows, kept in your
  // own family account (home/welcome.js AllisonOS.layer), since Calendar can't read
  // this app's storage on an iPhone.
  const CAL_FIELDS = ['type', 'status', 'id', 'conf', 'notes', 'dep', 'depIso', 'arr', 'arrIso', 'airlineCode', 'flightNo', 'airline', 'from', 'to', 'fromName', 'toName', 'checkIn', 'checkOut', 'name', 'address', 'city', 'pickup', 'pickupIso', 'company', 'pickupPlace', 'dropoff', 'dropoffIso', 'dropPlace', 'start', 'end', 'title', 'place'];
  // The layer's name: 'travelv' at the old Travel Vintage address (it opens this same app, ../home/design.js),
  // 'travel' everywhere else, as the two apps did. On a phone with both on the Home Screen, each keeps its own
  // copy up to date and neither overwrites the other's; the server shows the two together as Travel
  // (functions/aOS/api, GET layer).
  const LAYER = /^\/travelvintage\//.test(location.pathname) ? 'travelv' : 'travel';
  function shareCal() {
    const L = window.AllisonOS && AllisonOS.layer; if (!L) return;
    // a private booking goes with its email's ids, so Calendar's Ipsy leaves that email out too
    const priv = b => b.private ? { private: true, msgId: (b.source && b.source.msgId) || '', threadId: (b.source && b.source.threadId) || '' } : {};
    L.share(LAYER, { bookings: bookings.filter(b => b && b.status !== 'cancelled' && !b.fromCal && !b.calUid && !b.calSig).map(b => ({ ...Object.fromEntries(CAL_FIELDS.filter(k => b[k] != null && b[k] !== '').map(k => [k, typeof b[k] === 'string' ? b[k].slice(0, 500) : b[k]])), ...priv(b) })) });
  }
  addEventListener('load', () => { if (ls.get(KEY, null)) shareCal(); });
  function save() { track(); persist(); if (signedIn()) scheduleSync(); }
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
  // A booking with no date (Frontier's emails sometimes leave it out) isn't on any day yet:
  // it waits in "To check" for a date from the calendar, the AI or you.
  // (One whose email is months old is long past by now, so it isn't listed: reading the last year of mail again must not make a backlog.)
  const staleUndated = b => !startOf(b) && !!(b.source && b.source.date) && Date.now() - b.source.date > 120 * D;
  const undated = () => bookings.filter(b => !startOf(b) && b.status !== 'cancelled' && !b.ride && !staleUndated(b));
  const isPast = b => { const t = endT(b); return !isNaN(t) && t < Date.now() - 6 * H; };
  // To check: undated bookings, and upcoming ones read from the words of an email. Past ones are history, not a to-do.
  const checkList = () => [...undated(), ...alive().filter(b => b.guess && !isPast(b))];
  const city = code => P.AIRPORTS[code] || code || '';
  const flightName = b => ((b.airlineCode || '') + ' ' + (b.flightNo || '')).trim() || b.airline || 'Flight';
  function titleOf(b) {
    if (b.type === 'flight') return flightName(b) + ' · ' + (b.from || '?') + ' → ' + (b.to || '?');
    if (b.type === 'hotel') return b.name || 'Hotel';
    if (b.type === 'car') return carCo(b) + (b.carClass ? ' · ' + b.carClass : '');
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
      if (cur && !b.tripApart && !cur.solo && (dOf(s) - dOf(cur.end)) / D <= 1) { cur.items.push(b); if (e > cur.end) cur.end = e; }
      else { cur = { items: [b], start: s, end: e, solo: !!b.tripApart }; groups.push(cur); }     // a booking taken out of its trip stands alone
    }
    // One reservation is one trip: neighbouring groups that share a confirmation code (an Alaska booking with a flight out and a
    // flight home), or where the next one leaves from the place the last one flew to (away from home, within two weeks), join up.
    const out = {}; list.forEach(b => { if (b.type === 'flight' && b.from) out[b.from] = (out[b.from] || 0) + 1; });
    const home0 = Object.entries(out).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const fl = g => g.items.filter(b => b.type === 'flight' && b.status !== 'cancelled');
    const joinGroups = (a, c) => {
      a.ids = (a.ids || [a.items[0].id]).concat(c.ids || [c.items[0].id]);
      a.solo = false;
      a.items = a.items.concat(c.items).sort((x, y) => startOf(x).localeCompare(startOf(y)));
      if (c.start < a.start) a.start = c.start;
      if (c.end > a.end) a.end = c.end;
      groups.splice(groups.indexOf(c), 1);
    };
    for (let i = 0; i < groups.length - 1;) {
      const a = groups[i], c = groups[i + 1];
      // a code shared by two trips joins them when they are close in time (a flight out and one home); months apart is another trip
      const ca = new Set(a.items.map(b => b.conf).filter(Boolean)), shared = (dOf(c.start) - dOf(a.end)) / D <= 30 && c.items.some(b => b.conf && ca.has(b.conf));
      const last = fl(a).pop(), first = fl(c)[0];
      const chain = !!(last && first && last.to && last.to === first.from && last.to !== home0 && (dOf(c.start) - dOf(a.end)) / D <= 14);
      if (!a.solo && !c.solo && (shared || chain)) joinGroups(a, c); else i++;
    }
    // Bookings you put in a trip by hand ("put the hotel in the San Diego trip") point at one in the other trip.
    for (let again = true; again;) {
      again = false;
      for (const g of groups) {
        const hit = g.items.find(b => b.tripWith && groups.some(o => o !== g && o.items.some(x => x.id === b.tripWith)));
        if (hit) { const o = groups.find(o => o !== g && o.items.some(x => x.id === hit.tripWith)); const [first, second] = groups.indexOf(g) < groups.indexOf(o) ? [g, o] : [o, g]; joinGroups(first, second); again = true; break; }
      }
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
      g.name = names.get(g.id)?.name || (g.ids || []).map(i => names.get(i)?.name).find(Boolean) || g.auto;
      g.live = g.items.filter(b => b.status !== 'cancelled');
      g.startT = Math.min(...g.items.map(startT).filter(x => !isNaN(x)));
      g.endT = Math.max(...g.items.map(endT).filter(x => !isNaN(x)));
      g.past = g.endT < Date.now() - 6 * H;
      g.check = g.items.filter(b => b.guess && !isPast(b)).length;
      g.gaps = g.items.filter(b => !b.private && !isPast(b) && b.status !== 'cancelled' && !b.ride && P.missingFields(b).length).length;     // something Have Ipsy check could be asked for
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
  addEventListener('aos:design', () => requestAnimationFrame(() => { slideTabs(true); slideWhen(true); }));   // Futura and the system font are different widths
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

  // The pill at the top while Gmail is read.
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
    if (!startOf(b)) return '<span class="st warn">Needs a date</span>';
    if (b.guess && !isPast(b)) return '<span class="st warn">Check details</span>';
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
      h += '<h3>' + esc(carCo(next)) + '</h3><div class="when">' + (out ? 'Return ' + esc(fmtDay(next.dropoff)) + ' · ' + esc(fmtTime(next.dropoff)) : 'Pick up ' + esc(fmtDay(next.pickup)) + (fmtTime(next.pickup) ? ' · ' + esc(fmtTime(next.pickup)) : '')) + '</div>';
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
    const ai = !g.past && g.gaps && aiOn() && aiAvail !== false;
    return '<div class="tripwrap" style="--i:' + i + '"><button class="trip glass' + (g.past ? ' past' : '') + (ai ? ' hasai' : '') + '" type="button" data-trip="' + esc(g.id) + '" style="--i:' + i + '">'
      + '<div class="tt"><h3>' + esc(g.name) + '</h3>' + (soon ? '<span class="soon">' + esc(soon) + '</span>' : '') + '</div>'
      + '<div class="dates">' + esc(fmtRange(g.start, g.end)) + '</div>'
      + '<div class="icons">' + counts + (g.items.every(b => b.only) ? justMePill : '') + (g.check ? '<span class="st warn">' + esc(g.check + ' to check') + '</span>' : '')
      + (g.live.length < g.items.length ? '<span class="st bad">' + esc((g.items.length - g.live.length) + ' canceled') + '</span>' : '') + '</div></button>'
      + (ai ? '<button class="chip glass aibtn" type="button" data-ai="' + esc(g.id) + '" aria-label="Have Ipsy check ' + esc(g.name) + '">' + I.spark + 'Have Ipsy check</button>' : '') + '</div>';
  }
  function render() {
    const groups = groupTrips();
    const up = groups.filter(g => !g.past), past = groups.filter(g => g.past).reverse();
    const check = checkList().length;
    const chips = [['upcoming', 'Upcoming', up.length], ['past', 'Past', past.length]];
    if (check) chips.push(['check', 'To check', check]);
    if (st.when === 'check' && !check) st.when = 'upcoming';
    $('whenChips').innerHTML = chips.map(([k, t, n]) => '<button class="chip glass" type="button" data-when="' + k + '" aria-pressed="' + (st.when === k) + '">' + esc(t) + ' <span class="n">' + n + '</span></button>').join('');
    slideWhen();
    const sub = [];
    if (up.length) sub.push(plural(up.length, 'trip') + ' coming up');
    if (st.scanning) sub.push('Reading Gmail…');
    else if (+ls.get(K.lastScan, 0)) sub.push('Gmail checked ' + ago(+ls.get(K.lastScan, 0)));
    const synced1 = syncState === 'error' ? 'Not synced' : syncState === 'syncing' ? 'Syncing…' : syncState === 'offline' ? 'Offline' : lastSyncAt ? 'Synced' : '';
    if (signedIn() && synced1) sub.push(synced1);
    $('tripsSub').textContent = sub.join(' · ');

    let h = '';
    if (!bookings.length) {
      h = '<div class="empty glass"><strong>No trips yet</strong></div><button class="btn" type="button" id="emptyGo">' + (hasGmail() ? 'Look in Gmail now' : 'Connect Gmail') + '</button>'
        + '<button class="btn quiet" type="button" id="emptyAdd">Add a booking by hand</button>';
    } else if (st.when === 'check') {
      const list = checkList().sort((a, b) => (startOf(a) || '9999').localeCompare(startOf(b) || '9999'));
      h = '<div class="tl glass">' + list.map(b => evRow(b, startOf(b), 'start', true)).join('') + '</div>';
    } else {
      if (st.when === 'upcoming') h += heroHTML(groups);
      const list = st.when === 'past' ? past : up;
      if (list.length) h += list.map(tripCard).join('');
      else h += '<div class="empty glass"><strong>' + (st.when === 'past' ? 'No past trips' : 'Nothing coming up') + '</strong></div>';
      if (st.when === 'past') h += olderHTML();
    }
    $('list').innerHTML = h;
    if ($('emptyGo')) $('emptyGo').onclick = () => hasGmail() ? scan({ loud: true }) : openSettings();
    if ($('emptyAdd')) $('emptyAdd').onclick = () => openAdd();
    if ($('olderBtn')) $('olderBtn').onclick = () => loadOlder(true);
    if (st.when === 'past' && st.tab !== 'explore') loadOlder(false);
    if (!$('tripPage').hidden && st.trip) renderTrip();
  }
  $('whenChips').addEventListener('click', e => {
    const b = e.target.closest('[data-when]'); if (!b) return;
    st.when = b.dataset.when; ls.set(K.when, st.when); render(); animateIn($('list'));
  });
  $('list').addEventListener('click', e => {
    const a = e.target.closest('[data-ai]'); if (a) return checkTripWithAI(a.dataset.ai, a);
    const t = e.target.closest('[data-trip]'); if (t) return openTrip(t.dataset.trip);
    const b = e.target.closest('[data-bk]'); if (b) return openBooking(b.dataset.bk);
  });

  // ---------------------------------------------------------------------
  // A trip page: the timeline
  // ---------------------------------------------------------------------
  // One row of the timeline. side: 'start' | 'end' (a hotel's check-out, a car's return).
  function evRow(b, at, side, withDate) {
    const cx = b.status === 'cancelled' ? ' cx' : '';
    let t = '', s = '', time = fmtTime(at) || (!at ? (b.depTime ? fmtTime('2000-01-01T' + b.depTime) : '') || '—' : b.type === 'hotel' ? (side === 'start' ? 'Check in' : 'Check out') : 'All day');
    if (b.type === 'flight') {
      t = flightName(b) + ' · ' + (b.from || '?') + ' → ' + (b.to || '?');
      const lv = liveView(b), term = (lv && lv.terminal) || b.terminal, gate = (lv && lv.gate) || b.gate;
      s = [[b.fromName || city(b.from), b.toName || city(b.to)].filter(Boolean).join(' → '), b.arr ? 'lands ' + fmtTime(b.arr) + (b.arr.slice(0, 10) !== (b.dep || '').slice(0, 10) ? ' ' + fmtDay(b.arr, { weekday: undefined }) : '') : (b.arrTime ? 'lands ' + fmtTime('2000-01-01T' + b.arrTime) : ''),
        term ? 'Terminal ' + term : '', gate ? 'Gate ' + gate : ''].filter(Boolean).join(' · ');
    } else if (b.type === 'hotel') {
      t = (side === 'start' ? 'Check in · ' : 'Check out · ') + (b.name || 'Hotel');
      if (!fmtTime(at)) time = side === 'start' ? 'In' : 'Out';
      s = side === 'start' ? [b.address, b.checkOut ? plural(Math.max(1, Math.round((dOf(b.checkOut) - dOf(b.checkIn)) / D)), 'night') : ''].filter(Boolean).join(' · ') : '';
    } else if (b.type === 'car') {
      t = (side === 'start' ? 'Pick up · ' : 'Return · ') + carCo(b);
      s = [side === 'start' ? b.pickupPlace : (b.dropPlace || b.pickupPlace), side === 'start' ? b.carClass : ''].filter(Boolean).join(' · ');
    } else { t = b.title || 'Booking'; s = b.place || ''; }
    const meta = [statusPill(b), b.only && side === 'start' ? justMePill : '', b.conf && side === 'start' ? '<span class="st bare">' + esc(b.conf) + '</span>' : ''].filter(Boolean).join('');
    return '<button class="ev ' + esc(b.type) + cx + '" type="button" data-bk="' + esc(b.id) + '">'
      + '<span class="tm">' + esc(time) + (withDate ? '<small>' + esc(at ? fmtDay(at) : 'No date') + '</small>' : '') + '</span><span class="ic">' + (b.ride ? I.car : I[b.type] || I.other) + '</span>'
      + '<span class="bd"><span class="t">' + esc(t) + '</span>' + (s ? '<span class="s">' + esc(s) + '</span>' : '') + (meta ? '<span class="m">' + meta + '</span>' : '') + '</span></button>';
  }
  function tripById(id) { return groupTrips().find(g => g.id === id || g.items.some(b => b.id === id)); }
  // Private: hidden from Ipsy (ipsy-tools.js), with its email; it still syncs, and an email can still update it.
  function setPrivate(ids, on) {
    bookings.forEach(b => { if (ids.includes(b.id)) { if (on) b.private = true; else delete b.private; } });
    save(); render();
  }
  // Just me: only you see it. It stays on your phones and in the family's Sheet, and the Sheet gives it to nobody
  // else (google-sheet-sync.gs); only its own person can make a booking Just me or shared again, so only yours change
  // here. It isn't put in the Family calendar either (the family sees that), and comes out if Travel put it there.
  function setJustMe(ids, on) {
    const list = bookings.filter(b => ids.includes(b.id) && mine(b));
    list.forEach(b => {
      if (on) { b.only = true; if (b.calSig) { dropFromCalendar(b); delete b.calSig; } }
      else delete b.only;
    });
    save(); render();
    return list.length;
  }
  // A trip is Just me when every booking in it is: its name goes with it (when the name is yours).
  function setTripJustMe(g, on) {
    const n = setJustMe(g.items.map(b => b.id), on);
    const t = trips.find(x => x.id === g.id), all = g.items.every(b => b.only);
    if (t && mine(t) && !!t.only !== (on && all)) { if (on && all) t.only = true; else delete t.only; save(); }
    return n;
  }
  const justMePill = '<span class="st info jm">' + I.me + 'Just me</span>';
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
    const priv = g.items.filter(b => b.private).length, all = priv === g.items.length;
    // Just me trip: every booking in it that is yours (someone else's stays shared: only they can change that)
    const yours = g.items.filter(mine), only = yours.filter(b => b.only).length;
    const jm = !!yours.length && only === yours.length;
    h += '<div class="opts"><button class="opt" type="button" id="tpPriv" aria-pressed="' + all + '">' + I.lock + 'Private trip</button>'
      + (yours.length ? '<button class="opt" type="button" id="tpOnly" aria-pressed="' + jm + '">' + I.me + 'Just me trip</button>' : '') + '</div><p class="hint">Private trip hides this trip and its emails from Ipsy.</p>';
    if (yours.length) h += '<p class="hint" id="tpOnlyHint">Just me trip: only you see it, not the family.</p>';
    else h += '<p class="hint">' + esc(g.items.some(b => b.by) && whose(g.items[0]) ? whose(g.items[0]) + '’s trip, shared with the family.' : 'Shared with the family.') + '</p>';
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
      + linkRow(LINKS.kayakCars(/^[A-Z]{3}$/.test(dest) ? dest : where, d0, d1), 'Rental cars (Kayak)', 'Compares National, Enterprise, Hertz and others', I.car)
      + linkRow(LINKS.national(), 'National Car Rental', 'Opens nationalcar.com', I.car)
      + '</div>';
    $('tpBody').innerHTML = h;
    $('tpAdd').onclick = () => openAdd(g.start.slice(0, 10));
    $('tpPriv').onclick = () => { setPrivate(g.items.map(b => b.id), !all); renderTrip(); toast(all ? 'Ipsy can see this trip again' : 'Private: hidden from Ipsy'); };
    if ($('tpOnly')) $('tpOnly').onclick = () => { setTripJustMe(g, !jm); renderTrip(); toast(jm ? 'Shared with the family again' : 'Just me: only you see it'); };
  }
  function finishTrip() {
    const g = tripById(st.trip), inp = $('tpName');
    if (g && inp) {
      const name = inp.value.trim(), cur = trips.find(t => t.id === g.id);
      if (!name || name === g.auto) { if (cur) { trips = trips.filter(t => t !== cur); save(); } }
      // the name of a Just me trip (all of it yours) is Just me too
      else if (!cur) { trips.push({ id: g.id, name, ...(g.items.every(b => b.only && mine(b)) ? { only: true } : {}) }); save(); }
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
    if (!st.isNew && !startOf(b)) h += '<div class="verify"><span>' + esc(P.missingFields(b).includes('date') && b.type !== 'hotel' ? 'The email has no date. Pick the day below (or your calendar may supply it).' : 'The email has no dates. Fill them in below.') + '</span></div>';
    else if (b.guess && !isPast(b)) h += '<div class="verify"><span>' + esc(b.filled ? 'Filled in ' + fillText(b) + '. Check these details.' : b.fromCal ? 'Made from an event in your calendar. Check these details.' : 'Read from the words of the email. Check these details.') + '</span><button class="textbtn" type="button" id="bkOk">Looks right</button></div>';
    if (b.type === 'flight' && !st.isNew) h += '<div class="live glass" id="bkLive"></div>';
    const dayField = !st.isNew && !startOf(b) && b.type !== 'hotel' ? [['_day', 'Date', '', 'date']] : [];
    h += '<div class="box glass"><div class="kv">' + dayField.concat(FIELDS[b.type]).map(([k, label, ph, type, w]) => {
      const v = b[k] || '';
      return '<div class="f' + (w ? ' w' : '') + '"><label for="bf_' + k + '">' + esc(label) + '</label><input id="bf_' + k + '" data-k="' + k + '" type="' + (type || 'text') + '" value="' + esc(type === 'datetime-local' ? v.slice(0, 16) : v) + '" placeholder="' + esc(ph) + '"'
        + (/^(airlineCode|from|to)$/.test(k) ? ' autocapitalize="characters"' : '') + '></div>';
    }).join('') + '<div class="f w"><label for="bf_notes">Notes</label><textarea id="bf_notes" data-k="notes" placeholder="Anything to remember">' + esc(b.notes || '') + '</textarea></div></div></div>';
    const rows = [];
    if (b.source && b.source.threadId && myMail(b)) {
      rows.push('<a class="rowbtn" href="' + esc(LINKS.mailApp(b.source.threadId)) + '"><span class="ic">' + I.mail + '</span><span>Open the email in Mail<span class="sub">' + esc(b.source.subject || '') + '</span></span></a>');
      rows.push(linkRow(LINKS.gmailWeb(b.source.msgId), 'Open in Gmail', 'In the browser', I.ext));
    }
    const place = b.type === 'hotel' ? [b.name, b.address].filter(Boolean).join(', ') : b.type === 'car' ? b.pickupPlace : b.type === 'other' ? b.place : '';
    if (place) rows.push(linkRow(LINKS.maps(place), 'Map', place, I.map));
    if (!st.isNew && startOf(b)) rows.push('<button class="rowbtn" type="button" id="bkCal"><span class="ic">' + I.cal + '</span><span>Add to calendar</span></button>');
    if (b.type === 'flight' && b.from && b.to) rows.push(linkRow(LINKS.googleFlights(b.from, b.to, (b.dep || '').slice(0, 10)), 'This route on Google Flights', b.from + ' → ' + b.to, I.search));
    if (b.type === 'hotel' && (b.city || b.address)) rows.push(linkRow(LINKS.googleHotels(b.city || b.address, b.checkIn, b.checkOut), 'Other hotels nearby', 'Google Hotels, same dates', I.search));
    if (rows.length) h += '<div class="rgroup glass">' + rows.join('') + '</div>';
    if (b.source && b.source.from) h += '<p class="hint">From ' + esc(b.source.from.replace(/<[^>]*>/g, '').trim() || b.source.from) + (b.source.date ? ', ' + esc(new Date(b.source.date).toLocaleDateString()) : '') + '.</p>';
    if (!st.isNew) {
      const own = mine(b), who = whose(b);
      h += '<div class="opts"><button class="opt" type="button" id="bkCx" aria-pressed="' + (b.status === 'cancelled') + '">' + (b.status === 'cancelled' ? 'Canceled' : 'Mark as canceled') + '</button>'
        + '<button class="opt" type="button" id="bkPriv" aria-pressed="' + !!b.private + '">' + I.lock + 'Private</button>'
        + (own ? '<button class="opt" type="button" id="bkOnly" aria-pressed="' + !!b.only + '">' + I.me + 'Just me</button>' : '') + '</div>'
        + '<p class="hint">Private hides this booking and its email from Ipsy.</p>'
        // Just me is its own person's to set: someone else's booking just says whose it is
        + '<p class="hint" id="bkOnlyHint">' + (!own ? esc((who ? who + '’s' : 'Someone else’s') + ' booking, shared with the family.')
          : 'Just me: only you see it, not the family.') + '</p>';
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
    if (b._day !== undefined) { if (b._day && !startOf(b)) P.applyDate(b, b._day); delete b._day; }
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
        if (before !== JSON.stringify(b)) { b.edited = true; b.guess = false; delete b.filled; bookings[i] = b; if (b.type === 'flight') delete live[b.id]; save(); smartSoon(); }
      }
    }
    st.booking = null; closeSheet('bkSheet'); render();
  }
  $('bkDone').onclick = finishBooking;
  // After Private or Just me is kept (which stamps the booking's change time), the sheet's copy takes the same stamp,
  // so closing the sheet doesn't count it as an edit of yours.
  const keptStamp = b => { const cur = bookings.find(x => x.id === b.id); if (cur) b.updated = cur.updated; };
  $('bkBody').addEventListener('click', async e => {
    const b = st.booking; if (!b) return;
    if (e.target.closest('#bkOk')) {
      readFields(); b.guess = false; b.checked = true;
      const i = bookings.findIndex(x => x.id === b.id);
      delete b.filled;
      if (i >= 0) { bookings[i] = JSON.parse(JSON.stringify(b)); save(); smartSoon(); }   // a copy: the sheet keeps editing its own
      renderBooking(); toast('Thanks. Marked as checked.'); return;
    }
    if (e.target.closest('#bkCx')) { b.status = b.status === 'cancelled' ? 'confirmed' : 'cancelled'; renderBooking(); return; }
    if (e.target.closest('#bkPriv')) {
      // Private is kept at once, on the booking itself (it isn't an edit: an email can still update it).
      readFields(); setPrivate([b.id], !b.private);
      if (b.private) delete b.private; else b.private = true;
      keptStamp(b); renderBooking(); return;
    }
    if (e.target.closest('#bkOnly')) {
      // Just me, like Private, is kept at once, on the booking itself.
      readFields();
      if (!setJustMe([b.id], !b.only)) return;
      if (b.only) delete b.only; else { b.only = true; delete b.calSig; }
      keptStamp(b); renderBooking(); toast(b.only ? 'Just me: only you see it' : 'Shared with the family again'); return;
    }
    if (e.target.closest('#bkCal')) { readFields(); await addToCalendar(ics([b]), titleOf(b), 'it'); return; }
    if (e.target.closest('#bkLiveGo')) { refreshLive(b, true).then(renderLiveBox); renderLiveBox(true); return; }
    if (e.target.closest('#bkDel')) {
      const del = $('bkDel');
      if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Tap again to delete'; setTimeout(() => { if (document.contains(del)) { delete del.dataset.armed; del.textContent = 'Delete booking'; } }, 3500); return; }
      const gone = bookings.find(x => x.id === b.id);
      bookings = bookings.filter(x => x.id !== b.id);
      st.booking = null; closeSheet('bkSheet'); save(); render(); dropFromCalendar(gone);
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
  // Paste: a confirmation
  // ---------------------------------------------------------------------
  async function pasteIn() {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch {}
    if (text && oldSetupLink(text)) return;
    if (text && text.trim().length > 20) return readPasted(text);
    $('psText').value = ''; $('psHint').hidden = true; openSheet('pasteSheet'); setTimeout(() => $('psText').focus(), 300);
  }
  function readPasted(text) {
    const r = P.parseText(text);
    if (!r.bookings.length) {
      $('psText').value = text; $('psHint').textContent = 'No flight, hotel or car booking found in that text. Add it by hand with the + button instead.'; $('psHint').hidden = false;
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
  $('psAdd').onclick = () => { const t = $('psText').value; if (!t.trim()) return; if (oldSetupLink(t)) { closeSheet('pasteSheet'); return; } closeSheet('pasteSheet'); readPasted(t); };

  // ---------------------------------------------------------------------
  // Merge a booking found in an email
  // ---------------------------------------------------------------------
  const INFO_KEYS = ['depTime', 'arrTime', 'conf', 'traveller', 'airline', 'airlineCode', 'flightNo', 'from', 'fromName', 'to', 'toName', 'dep', 'depIso', 'arr', 'arrIso', 'terminal', 'gate', 'seat',
    'name', 'address', 'city', 'phone', 'checkIn', 'checkInTime', 'checkOut', 'checkOutTime', 'company', 'carClass', 'pickupPlace', 'pickup', 'pickupIso', 'dropPlace', 'dropoff', 'dropoffIso',
    'title', 'place', 'start', 'end'];
  const num = n => String(n || '').replace(/^0+(?=\d)/, '');
  const day = b => String(b.dep || '').slice(0, 10);
  const sameFlight = (a, b) => a.type === 'flight' && b.type === 'flight' && a.airlineCode === b.airlineCode && num(a.flightNo) === num(b.flightNo) && day(a) === day(b);
  const when = b => (b && b.source && b.source.date) || 0;
  // The same booking when one of the two has no date yet: same flight (number, and the confirmation code or the airports),
  // or the same hotel or car confirmation.
  function sameBooking(x, b) {
    if (x.type !== b.type || (startOf(x) && startOf(b))) return false;
    // The airline numbers a flight every day (Frontier's 3073 is every day's), so the same number is not enough: two different
    // confirmation codes are two different bookings, however alike.
    if (b.type === 'flight') return x.airlineCode === b.airlineCode && num(x.flightNo) === num(b.flightNo) && !!x.flightNo && !(x.conf && b.conf && x.conf !== b.conf)
      && ((b.conf && x.conf === b.conf) || (x.from && x.from === b.from && x.to && x.to === b.to));
    if (b.type === 'hotel' || b.type === 'car') return !!b.conf && x.conf === b.conf;
    return false;
  }
  let revive = new Set(ls.json(K.revive, []));   // ids "Read the last year again" cleared, which may come back (kept until a scan finishes)
  function upsert(b, byHand) {
    upsert.id = b.id;
    if (graves['bookings:' + b.id] && !revive.has(b.id)) return 'gone';  // deleted on purpose: stays deleted
    let cur = bookings.find(x => x.id === b.id);
    // The same flight on the same day, whatever id it was given (a gate or time update that doesn't name the airports, a flight whose day you typed).
    if (!cur && b.type === 'flight') cur = bookings.find(x => sameFlight(x, b) && (!x.from || !b.from || x.from === b.from) && (!x.conf || !b.conf || x.conf === b.conf));
    // The same stay in two emails (one says the confirmation number is pending, the next has it).
    if (!cur && b.type === 'hotel') cur = bookings.find(x => x.type === 'hotel' && !x.fromCal && P.sameStay(x, b) && (!x.conf || !b.conf || x.conf === b.conf));
    // The same booking with and without its date (Frontier's confirmation has none; its check-in email does).
    if (!cur) cur = bookings.find(x => sameBooking(x, b));
    // A booking made from a calendar event: the email about the same trip takes it over (nothing is listed twice).
    if (!cur) { const hits = bookings.filter(x => x.fromCal && !x.edited && P.sameThing(x, b)); if (hits.length === 1) cur = hits[0]; }
    // A trip that ended more than 90 days ago is kept in the family's Sheet, not on this phone: an email about it, read
    // again, doesn't make it over again here (a fresh copy would win over what the Sheet has, edits and all).
    if (!cur && !byHand && isOld(b)) return 'old';
    // The same flight number on another day in the same booking: the flight
    // was moved, and the newest email about it decides which day is right.
    if (b.type === 'flight' && b.conf) {
      const moved = bookings.filter(x => x !== cur && x.type === 'flight' && x.conf === b.conf && x.airlineCode === b.airlineCode && num(x.flightNo) === num(b.flightNo) && day(x) !== day(b));
      if (moved.some(x => x.edited || when(x) > when(b))) return 'old';
      if (moved.length) bookings = bookings.filter(x => !moved.includes(x));
    }
    if (!cur) { bookings.push({ ...b, created: Date.now(), notes: '', ...(byHand ? { source: null } : {}) }); return 'new'; }
    upsert.id = cur.id;
    if (b.status === 'cancelled' && cur.status !== 'cancelled') { cur.status = 'cancelled'; return 'changed'; }
    if (cur.edited) return 'same';                                        // what you typed wins over any email
    let changed = false;
    // A later email wins, except a best-guess read over exact booking data.
    const newer = when(b) >= when(cur) && (!b.guess || cur.guess);
    for (const k of INFO_KEYS) {
      if (b[k] && (newer ? cur[k] !== b[k] : !cur[k])) { cur[k] = b[k]; changed = true; }
    }
    if (newer && cur.guess && !b.guess) { cur.guess = false; changed = true; }
    if (b.source && b.source.msgId && (cur.fromCal || cur.filled)) { cur.fromCal = false; if (!b.guess) delete cur.filled; changed = true; }
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
  // -- what the last look at Gmail read: one line per email, and what became of it (Settings > What Travel read) --
  const senderName = f => (/^"?([^"<]+?)"?\s*</.exec(f || '') || [])[1] || String(f || '').replace(/^.*@/, '').replace(/>$/, '');
  const kindsText = bs => { const n = {}; bs.forEach(b => { const k = b.ride ? 'ride' : b.type === 'flight' ? 'flight' : b.type === 'hotel' ? 'hotel' : b.type === 'car' ? 'rental car' : 'booking'; n[k] = (n[k] || 0) + 1; }); return Object.entries(n).map(([k, c]) => plural(c, k)).join(', '); };
  function saveScanLog(notes, info) {
    const old = ls.json(K.scanLog, []), byId = new Map(old.map(e => [e.id, e]));
    notes.forEach((e, id) => byId.set(id, { ...(byId.get(id) || {}), ...Object.fromEntries(Object.entries(e).filter(([k, v]) => v || k === 'out')) }));
    ls.set(K.scanLog, JSON.stringify([...byId.values()].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 200)));
    ls.set(K.scanInfo, JSON.stringify(info));
  }
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
    const rebuild = ls.get(K.queryV, '') !== QUERY_V;   // the reader changed: read the mail again once, and rebuild what the old reader made of it
    const readHere = new Set(seen);                      // the emails read on this phone, from its own Gmail
    if (rebuild) { seen = new Set(); saveSeen(); }
    const last = ls.get(K.queryV, '') === QUERY_V ? +ls.get(K.lastScan, 0) : 0;   // a wider search reads back a year once (seen mail is skipped)
    const since = last ? 'after:' + Math.floor(last / 1000 - 3 * 86400) : FIRST_SCAN;
    let added = 0, changed = 0, cancelled = 0, read = 0, failed = 0, listed = 0, found = 0, dropped = [];
    const failedIds = new Set();
    const notes = new Map();   // what each email came to, for Settings > What Travel read
    const note = (m, msg, out) => notes.set(m.id, { id: m.id, at: +(msg && msg.internalDate) || 0, from: msg ? senderName(header(msg, 'from')) : '', subj: msg ? header(msg, 'subject').trim().slice(0, 100) : '', out });
    try {
      if (!ls.get(K.me, '')) gmail('/profile').then(p => { if (p && p.emailAddress) { ls.set(K.me, p.emailAddress); ls.set(K.hint, p.emailAddress); } }).catch(() => {});
      const ids = [];
      let pageToken;
      do {
        const r = await gmail('/messages', { q: since + ' ' + QUERY, maxResults: 100, pageToken });
        (r.messages || []).forEach(m => ids.push(m));
        pageToken = r.nextPageToken;
      } while (pageToken && ids.length < MAX_SCAN);
      listed = ids.length;
      if (rebuild) {
        // Only now that the list came back (a failed look leaves everything as it was). What you edited, checked or deleted, and what was
        // filled in by AI or came from the calendar, stays; the rest was made by the old reader and is made again by the new one.
        // Only bookings from emails read on this phone (someone else's shared booking came from their Gmail, which this
        // phone can't read again), and not those kept in the Sheet past the 90 days (fetched to look back).
        const old = bookings.filter(b => b.source && b.source.msgId && readHere.has(b.source.msgId) && !isOld(b) && !b.edited && !b.checked && !b.filled && !b.fromCal);
        old.forEach(b => revive.add(b.id));
        ls.set(K.revive, JSON.stringify([...revive]));
        dropped = old;
        bookings = bookings.filter(b => !revive.has(b.id));
      }
      const todo = ids.filter(m => !seen.has(m.id)).slice(0, MAX_SCAN);
      st.scanTotal = todo.length; st.scanDone = 0;
      await pool(todo, 4, async m => {
        let msg;
        try { msg = await gmail('/messages/' + m.id, { format: 'full' }); }
        catch (e) { if (e instanceof AuthError) throw e; failed++; failedIds.add(m.id); note(m, null, 'couldn’t be downloaded'); return; }        // one bad message doesn't stop the rest
        const { html, text } = bodies(msg.payload);
        let doc = null;
        if (html && /itemscope/i.test(html) && window.DOMParser) { try { doc = new DOMParser().parseFromString(html, 'text/html'); } catch {} }
        const r = P.parseEmail({ html, text, doc, subject: header(msg, 'subject'), from: header(msg, 'from'), date: +msg.internalDate || Date.now(), id: msg.id, threadId: msg.threadId });
        r.bookings.forEach(b => {
          const x = upsert(b); if (x === 'new') added++; else if (x === 'changed') changed++;
        });
        if (r.cancelled && !r.bookings.length) cancelled += cancelByConf(P.findConf(P.htmlToText(html) || text));
        found += r.bookings.length;
        note(m, msg, r.bookings.length ? kindsText(r.bookings) : r.cancelled ? 'cancellation' : 'no booking found in it');
        seen.add(m.id); read++;
        st.scanDone++;
        if (st.scanDone % 10 === 0) busyPill('Reading Gmail · ' + st.scanDone + ' of ' + st.scanTotal);
      });
      // A look that read the mail again after an update counts as done when (nearly) all of it came down; otherwise it is tried again.
      if (rebuild && failed > 3) scanErr = plural(failed, 'email') + ' could not be downloaded';
      else { ls.set(K.lastScan, String(startedAt)); ls.set(K.queryV, QUERY_V); }
    } catch (e) {
      scanErr = e instanceof AuthError ? 'auth' : e.message;
    } finally {
      // A rebuild that stopped partway puts back what it had not made again (the old reader's version is better than a hole).
      if (dropped.length) { const have = new Set(bookings.map(b => b.id)); dropped.forEach(b => { if (!have.has(b.id) && (scanErr || failedIds.has(b.source.msgId))) bookings.push(b); }); }
      if (scanErr && rebuild) seen = new Set();     // the next look starts the re-reading afresh
      saveSeen(); save();
      if (!scanErr) { revive = new Set(); ls.del(K.revive); }
      saveScanLog(notes, { at: startedAt, ok: !scanErr, err: scanErr === 'auth' ? 'signed out' : scanErr, listed, read, failed, found, rebuilt: rebuild });
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
      smartPass();
    }
  }
  $('scanBtn').onclick = () => scan({ loud: true });
  // Due every half hour, and straight away once the search has widened.
  const scanDue = () => ls.get(K.queryV, '') !== QUERY_V || Date.now() - +ls.get(K.lastScan, 0) > 30 * 6e4;

  // ---------------------------------------------------------------------
  // Live flight status (travel/api/flight, a Cloudflare Pages Function). Travel's route, named from
  // the site root's side so it is the same from the old Travel Vintage address, which opens this same
  // app (../home/design.js).
  // ---------------------------------------------------------------------
  let liveAvail = null;   // null: not asked yet; true/false once the server has answered
  const API = new URL('../travel/api/', location.href).href;
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
      let data;
      try { data = await flightData(b.airlineCode + b.flightNo, b.dep.slice(0, 10)); } catch { return; }
      if (data.error === 'no-key') return;
      countLookup();
      keepLive(b, data);
    })().finally(() => { inflight.delete(b.id); render(); if (st.booking && st.booking.id === b.id) renderLiveBox(); });
    inflight.set(b.id, p);
    return p;
  }
  // One flight on one day, from travel/api/flight: {ok, found, legs} or {error}. Throws when nothing answers; no server here
  // at all (e.g. GitHub Pages), or no key there, turns live status off. Used by refreshLive, and by Ipsy (ipsy-tools.js).
  async function flightData(no, date) {
    let r, data;
    try {
      r = await aosFetch(API + 'flight?' + new URLSearchParams({ no, date }), { headers: { 'X-Travel': '1' }, cache: 'no-store' });
      data = await r.json();
    } catch (e) { if (r && !/json/.test(r.headers.get('content-type') || '')) liveAvail = false; throw e; }
    if (!data || typeof data !== 'object') throw new Error('bad answer');
    liveAvail = data.error !== 'no-key';
    return data;
  }
  // What came back for a booking's flight, kept for the app to show (its leg: the one from or to the booking's airports).
  function keepLive(b, data) {
    if (data.error) live[b.id] = { at: Date.now(), error: data.error };
    else {
      const legs = (data.legs || []).filter(l => !l.cargo);
      const leg = legs.find(l => l.departure.iata === b.from) || legs.find(l => l.arrival.iata === b.to) || legs[0] || null;
      live[b.id] = { at: Date.now(), leg, found: !!leg };
    }
    saveLive();
  }
  // The airport's departure board, from travel/api/find: {ok, candidates: [{number, to, local}]} or {error}. Used by
  // findNumbers, and by Ipsy.
  async function boardData(q) {
    const r = await aosFetch(API + 'find?' + new URLSearchParams(q), { headers: { 'X-Travel': '1' }, cache: 'no-store' });
    return r.json();
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
    else if (liveAvail === false) h += '<p class="hint" style="margin:0">Live status isn’t set up on this copy of the site.</p>';
    else if (!liveWindow(b)) h += '<p class="hint" style="margin:0">Shows from 36 hours before take-off.</p>';
    else if (x && x.error) h += '<p class="hint" style="margin:0">' + esc({ limit: 'The flight data service’s monthly allowance is used up.', 'key-refused': 'The flight data service refused the key.', unreachable: 'Couldn’t reach the flight data service.' }[x.error] || 'Couldn’t get the status just now.') + '</p>';
    else if (x && !x.found) h += '<p class="hint" style="margin:0">No live data for ' + esc(flightName(b)) + ' on this date yet.</p>';
    else if (v) {
      const d = v.l.departure || {}, a = v.l.arrival || {};
      const cell = (label, big, small, old) => '<div class="cell"><span>' + esc(label) + '</span><b>' + esc(big || '—') + '</b>' + (old ? '<s>' + esc(old) + '</s>' : '') + (small ? '<i>' + esc(small) + '</i>' : '') + '</div>';
      const t = e => { const best = e.revised || e.predicted || e.scheduled; return best ? localHM(best.local) : ''; };
      const was = e => (e.revised || e.predicted) && e.scheduled && localHM((e.revised || e.predicted).local) !== localHM(e.scheduled.local) ? localHM(e.scheduled.local) : '';
      h += '<div class="grid2">' + cell('Departs ' + (d.iata || b.from || ''), t(d), [d.terminal ? 'Terminal ' + d.terminal : '', d.gate ? 'Gate ' + d.gate : ''].filter(Boolean).join(' · '), was(d))
        + cell('Lands ' + (a.iata || b.to || ''), t(a), [a.terminal ? 'Terminal ' + a.terminal : '', a.gate ? 'Gate ' + a.gate : '', a.belt ? 'Bags: belt ' + a.belt : ''].filter(Boolean).join(' · '), was(a)) + '</div>';
      h += '<p class="hint" style="margin:0">Checked ' + esc(ago(v.at)) + (v.l.aircraft ? ' · ' + esc(v.l.aircraft) : '') + '. Local times.</p>';
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
    let priv = false;   // the booking being written is private: hidden from Ipsy in Calendar too (calendar/ical.js)
    const ev = (uid, summary, start, endLine, loc, desc, alarmMin) => {
      L.push('BEGIN:VEVENT', 'UID:' + uid + '@allison-travel', 'DTSTAMP:' + stamp, start, endLine, 'SUMMARY:' + e2(summary));
      if (priv) L.push('X-AOS-PRIVATE:TRUE');
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
      priv = !!b.private;
      const desc = [b.conf ? 'Confirmation: ' + b.conf : '', b.notes].filter(Boolean).join('\n');
      if (b.type === 'flight' && b.dep) {
        const dep = b.dep.length >= 16 ? b.dep : b.dep + 'T09:00';
        ev(b.id, '✈ ' + flightName(b) + ' ' + (b.from || '') + ' → ' + (b.to || ''), timed(dep, b.depIso).s, endFor(dep, b.depIso, b.arr, b.arrIso, 120), b.fromName || city(b.from), desc, 180);
      } else if (b.type === 'hotel' && b.checkIn) {
        const out = b.checkOut && b.checkOut > b.checkIn ? b.checkOut : P.addDays(b.checkIn, 1);
        ev(b.id, '🏨 ' + (b.name || 'Hotel'), 'DTSTART;VALUE=DATE:' + b.checkIn.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + out.replace(/-/g, ''), [b.name, b.address].filter(Boolean).join(', '), desc, null);
      } else if (b.type === 'car' && b.pickup) {
        const pu = b.pickup.length >= 16 ? b.pickup : b.pickup + 'T10:00';
        ev(b.id + '-pu', '🚗 Pick up · ' + carCo(b), timed(pu, b.pickupIso).s, endFor(pu, b.pickupIso, '', '', 30), b.pickupPlace, desc, 60);
        if (b.dropoff) { const dr = b.dropoff.length >= 16 ? b.dropoff : b.dropoff + 'T10:00'; ev(b.id + '-dr', '🚗 Return · ' + carCo(b), timed(dr, b.dropoffIso).s, endFor(dr, b.dropoffIso, '', '', 30), b.dropPlace || b.pickupPlace, desc, 60); }
      } else if (b.start) {
        const s = b.start.length >= 16 ? b.start : b.start + 'T09:00';
        ev(b.id, b.title || 'Booking', 'DTSTART:' + floating(s), endFor(s, '', b.end, '', 60), b.place, desc, 60);
      }
    }
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  // ---------------------------------------------------------------------
  // Smart help: the Family calendar both ways, and filling in what is missing
  // ---------------------------------------------------------------------
  // A booking that has everything is left alone: nothing is looked up for it. A missing detail is looked for in this
  // order: other emails about the same booking (the merge above), the Family calendar, the airport's flight board and,
  // last, the AI, which only reads the email's own words and has to quote them. Anything found this way is marked
  // "To check" (with where it came from) until you tap "Looks right" or edit it.
  const FILLED = { calendar: 'from your calendar', ai: 'by AI from the email', board: 'from the airport’s flight board' };
  const FILLED_WHAT = { date: 'the date', flightNo: 'the flight number', airlineCode: 'the airline', from: 'the departure airport', to: 'the arrival airport', time: 'the time', name: 'the hotel', checkIn: 'the check-in date', checkOut: 'the check-out date', company: 'the company', address: 'the address' };
  const fill = (b, field, source) => { (b.filled = b.filled || {})[field] = source; b.guess = true; };
  const fillText = b => {
    const bySrc = {};
    Object.entries(b.filled || {}).forEach(([f, s]) => (bySrc[s] = bySrc[s] || []).push(FILLED_WHAT[f] || f));
    return Object.entries(bySrc).map(([s, fs]) => fs.join(', ') + ' ' + (FILLED[s] || '')).join('; ');
  };

  // -- the Family calendar --
  const calOn = () => ls.get(K.calOn, '1') !== '0';
  let calBusy = false;
  const calStamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const icsName = uid => uid.trim().replace(/[^A-Za-z0-9._@-]+/g, '-').slice(0, 200) + '.ics';
  const uidsOf = b => [...ics([b]).matchAll(/UID:(.+)\r\n/g)].map(m => m[1]);
  const sigOf = text => P.hash(text.replace(/DTSTAMP:.*\r\n/g, ''));
  async function calFetch(path, init) {
    const r = await aosFetch(CAL_API + path, { cache: 'no-store', ...(init || {}), headers: { 'X-Calendar': '1', ...((init && init.headers) || {}) } });
    let d = null; try { d = await r.json(); } catch {}
    return { r, d };
  }
  // Takes a booking's events out of the calendar (cancelled or deleted here). Only events this app wrote.
  async function dropFromCalendar(b) {
    if (!b || !b.calSig || !calOn() || calAvail === false) return;
    try { for (const uid of uidsOf(b)) await calFetch('event?name=' + encodeURIComponent(icsName(uid)), { method: 'DELETE' }); } catch {}
  }
  async function syncCalendar() {
    if (!calOn() || calAvail === false || calBusy) return;
    calBusy = true;
    let changed = false;
    try {
      const a = new Date(); a.setDate(a.getDate() - 1); const z = new Date(); z.setDate(z.getDate() + 400);
      const { r, d } = await calFetch('events?start=' + calStamp(a) + '&end=' + calStamp(z));
      if (!r.ok || !d || !d.ok) { if (r.status === 404 || (d && d.error === 'no-account')) calAvail = false; return; }
      calAvail = true;
      const today = todayStr();
      const events = [];
      for (const it of d.items || []) for (const e of P.eventsFromIcs(it.ics)) { const b = P.bookingFromEvent(e); if (b) events.push({ e, b }); }
      // 1. The calendar into Travel. Events this app wrote are skipped (they are its own bookings).
      for (const { e, b } of events) {
        const linked = bookings.find(x => x.calUid === e.uid);
        if (linked) {
          // A booking made from this event follows the event (moved, renamed) until you edit it or an email takes it over.
          if (linked.fromCal && !linked.edited && !linked.checked) {
            for (const k of ['dep', 'arr', 'from', 'to', 'fromName', 'toName', 'flightNo', 'airlineCode', 'airline', 'checkIn', 'checkOut', 'pickup', 'dropoff', 'name', 'company', 'address'])
              if (b[k] && b[k] !== linked[k]) { linked[k] = b[k]; changed = true; }
          }
          continue;
        }
        if (graves['bookings:cal-' + P.hash(e.uid)]) continue;
        const hits = bookings.filter(x => x.status !== 'cancelled' && !x.ride && P.sameThing(x, b));
        if (hits.length === 1) {                                   // already here (from an email, or by hand): link it, add nothing
          const x = hits[0];
          if (!x.calUid) { x.calUid = e.uid; changed = true; }
          if (x.type === 'flight' && !startOf(x) && b.dep) { P.applyDate(x, b.dep.slice(0, 10)); fill(x, 'date', 'calendar'); changed = true; }
          if (x.type === 'flight' && b.flightNo && !x.flightNo && !x.edited) { x.flightNo = b.flightNo; x.airlineCode = x.airlineCode || b.airlineCode; x.airline = x.airline || b.airline; fill(x, 'flightNo', 'calendar'); changed = true; }
          continue;
        }
        if (hits.length > 1) continue;                             // could be more than one: leave it to you
        const when0 = b.type === 'hotel' ? b.checkOut : b.type === 'car' ? b.pickup : b.dep;
        if (String(when0 || '').slice(0, 10) < today) continue;    // history isn't imported
        bookings.push({ ...b, id: 'cal-' + P.hash(e.uid), calUid: e.uid, fromCal: true, created: Date.now(), notes: '', source: { msgId: '', threadId: '', subject: e.title.slice(0, 200), from: 'Calendar', date: 0 } });
        changed = true;
      }
      // 2. Travel into the calendar: only what is plainly right and still to come, once, and never beside
      // an event that is already there for the same trip.
      const wrote = [];
      for (const b of bookings.slice()) {
        if (b.fromCal || b.ride) continue;
        // a Just me booking isn't put in the Family calendar (the family sees that), and comes out if it was
        if (b.status === 'cancelled' || b.only) { if (b.calSig) { await dropFromCalendar(b); delete b.calSig; changed = true; } continue; }
        const start = startOf(b);
        if (b.guess || !start || start.slice(0, 10) < today || b.type === 'other') continue;
        if (b.type === 'flight' && (start.length < 16 || !(b.from && b.to))) continue;
        if (!b.calSig) {
          const there = events.find(x => P.sameThing(b, x.b));
          if (there) { if (!b.calUid) { b.calUid = there.e.uid; changed = true; } continue; }
          if (b.calUid) continue;
        }
        const text = ics([b]), sig = sigOf(text);
        if (b.calSig !== sig) wrote.push({ b, text, sig });
      }
      for (const w of wrote) {
        const { r: wr, d: wd } = await calFetch('import', { method: 'POST', headers: { 'Content-Type': 'text/calendar; charset=utf-8' }, body: w.text });
        if (wr.ok && wd && wd.ok) { w.b.calSig = w.sig; changed = true; }
        else if (wr.status === 404 || (wd && wd.error === 'no-account')) { calAvail = false; break; }
      }
    } catch {} finally {
      calBusy = false;
      if (changed) { save(); render(); }
    }
  }

  // -- the AI and the flight board --
  const aiOn = () => ls.get(K.aiOn, '1') !== '0';
  let aiAvail = null, findAvail = null, aiModels = null;
  // Which models answer: what the function says it is set to use, and, for Check, what the last answer said it came from (kept
  // on this phone). Ipsy's answers go to the chat as they come, so only the model it is set to use is named.
  const modelName = id => { const m = /claude-(haiku|sonnet|opus|fable)-(\d+)-(\d+)/i.exec(String(id || '')); return m ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() + ' ' + m[2] + '.' + m[3] : String(id || '').slice(0, 40); };
  function noteModel(which, id) { if (!id) return; const o = ls.json(K.aiLast, {}); o[which] = String(id).slice(0, 60); ls.set(K.aiLast, JSON.stringify(o)); }
  function modelsLine() {
    if (!aiModels) return '';
    const last = ls.json(K.aiLast, {});
    const bit = (label, cfg, served) => label + ' ' + modelName(cfg) + (served ? (modelName(served) === modelName(cfg) ? ' (the last answer came from it)' : ' (but the last answer came from ' + modelName(served) + ')') : '');
    return '\nModels: ' + bit('Check', aiModels.check, last.check) + (aiModels.ipsy ? '; Ipsy ' + modelName(aiModels.ipsy) : '') + '.';
  }
  const FIND_A_MONTH = 30;                                // board lookups per phone; the free allowance is small
  function aiUse() { const o = ls.json(K.ai, {}), m = todayStr().slice(0, 7); return o.m === m ? { tried: {}, ai: 0, find: 0, ...o } : { m, ai: 0, find: 0, tried: o.tried || {} }; }
  const aiSave = o => ls.set(K.ai, JSON.stringify({ ...o, tried: Object.fromEntries(Object.entries(o.tried).slice(-300)) }));
  // What each kind of booking can be missing, as the function names the fields.
  const ASK = {
    flight: { airline: 'airlineCode', flightNo: 'flightNo', from: 'from', to: 'to', date: 'date', time: 'depTime' },
    hotel: { name: 'name', date: 'checkIn', checkOut: 'checkOut' },
    car: { company: 'company', date: 'pickupDate', time: 'pickupTime' },
  };
  const knownFor = b => Object.fromEntries(Object.values(ASK[b.type] || {}).filter(k => typeof b[k] === 'string' && b[k] && !/^(date|depTime|checkIn|checkOut|pickupDate|pickupTime)$/.test(k)).map(k => [k, b[k]]));
  function applyAi(b, f) {
    const ok = (re, v) => typeof v === 'string' && re.test(v);
    let any = false;
    const set = (k, v, field) => { if (v && !b[k]) { b[k] = v; fill(b, field || k, 'ai'); any = true; } };
    if (b.type === 'flight') {
      if (ok(/^[A-Z0-9]{2}$/, f.airlineCode)) { if (!b.airlineCode) { b.airlineCode = f.airlineCode; b.airline = P.AIRLINES[f.airlineCode] || b.airline || ''; fill(b, 'airlineCode', 'ai'); any = true; } }
      if (ok(/^\d{1,4}[A-Z]?$/, f.flightNo)) set('flightNo', f.flightNo);
      if (ok(/^[A-Z]{3}$/, f.from) && !b.from) { b.from = f.from; b.fromName = P.AIRPORTS[f.from] || b.fromName || ''; fill(b, 'from', 'ai'); any = true; }
      if (ok(/^[A-Z]{3}$/, f.to) && !b.to) { b.to = f.to; b.toName = P.AIRPORTS[f.to] || b.toName || ''; fill(b, 'to', 'ai'); any = true; }
      const hm = ok(/^([01]\d|2[0-3]):[0-5]\d$/, f.depTime) ? f.depTime : '';
      if (hm) { if (startOf(b)) { if (b.dep.length < 16) { b.dep += 'T' + hm; fill(b, 'time', 'ai'); any = true; } } else if (!b.depTime) { b.depTime = hm; any = true; } }
      if (ok(/^([01]\d|2[0-3]):[0-5]\d$/, f.arrTime) && !startOf(b) && !b.arrTime) b.arrTime = f.arrTime;
      if (ok(/^20\d\d-\d\d-\d\d$/, f.date) && !startOf(b)) { P.applyDate(b, f.date); fill(b, 'date', 'ai'); any = true; }
    } else if (b.type === 'hotel') {
      if (typeof f.name === 'string' && f.name && (!b.name || b.name === 'Hotel')) { b.name = f.name.slice(0, 90); fill(b, 'name', 'ai'); any = true; }
      set('address', typeof f.address === 'string' ? f.address.slice(0, 160) : '');
      if (ok(/^20\d\d-\d\d-\d\d$/, f.checkIn) && !b.checkIn) { b.checkIn = f.checkIn; fill(b, 'checkIn', 'ai'); any = true; }
      if (ok(/^20\d\d-\d\d-\d\d$/, f.checkOut) && !b.checkOut) { b.checkOut = f.checkOut; fill(b, 'checkOut', 'ai'); any = true; }
      if (b.checkIn && (!b.checkOut || b.checkOut <= b.checkIn)) b.checkOut = P.addDays(b.checkIn, 1);
    } else if (b.type === 'car') {
      if (typeof f.company === 'string' && f.company && !b.company) { b.company = f.company.slice(0, 40); fill(b, 'company', 'ai'); any = true; }
      if (ok(/^20\d\d-\d\d-\d\d$/, f.pickupDate) && !startOf(b)) { P.applyDate(b, f.pickupDate); if (ok(/^([01]\d|2[0-3]):[0-5]\d$/, f.pickupTime)) b.pickup = f.pickupDate + 'T' + f.pickupTime; fill(b, 'date', 'ai'); any = true; }
    }
    return any;
  }
  // queue: [{bid, text, subject, date, msgId}] - the emails of bookings that still lack something. A press of Have Ipsy
  // check gets here, and Ipsy's own check (ipsyAutoCheck, once you have said yes). Returns {asked, filled, nothing, done,
  // changes, stop}: calls made, details filled in, bookings whose email does not state what is missing, the bookings
  // looked at, what changed ({id, before, after} for Undo), and why it stopped early ('' if it didn't). quiet: no Face ID
  // prompt (Ipsy's own check uses the session it has, or stops).
  async function aiPass(queue, quiet) {
    const out = { asked: 0, filled: 0, nothing: 0, done: new Set(), changes: [], stop: '' };
    if (!aiOn() || !queue.length) return out;
    if (aiAvail === null) await pingLive();
    if (!aiAvail) return out;
    const use = aiUse();
    let changed = false;
    const acct = window.AllisonOS && window.AllisonOS.account;
    for (const q of queue) {
      const b = bookings.find(x => x.id === q.bid);
      if (!b || b.private || b.edited || b.status === 'cancelled' || b.ride || staleUndated(b) || (startOf(b) && isPast(b))) { out.done.add(q.bid); continue; }     // history isn't looked up
      const map = ASK[b.type]; if (!map) { out.done.add(q.bid); continue; }
      let miss = P.missingFields(b);                       // nothing missing: nothing is asked, nothing is sent
      if (!miss.length) { out.done.add(q.bid); continue; }
      // A date the email never states can't be read out of it: ask for the date only if the text has one.
      if (!P.realDates(q.text, q.date).length) miss = miss.filter(m => m !== 'date' && m !== 'checkOut');
      const ask = [...new Set(miss.map(m => map[m]).filter(Boolean))];
      if (!ask.length) { out.nothing++; out.done.add(q.bid); continue; }
      const init = { method: 'POST', headers: { 'X-Travel': '1', 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ type: b.type, missing: ask, known: knownFor(b), text: q.text.slice(0, 12000), subject: q.subject, emailDate: new Date(q.date).toISOString() }) };
      const tok = quiet && acct && acct.token && acct.token();      // no session: tried as is (a 401 stops it), never a Face ID prompt
      if (tok) init.headers.Authorization = 'Bearer ' + tok;
      out.asked++;
      let res, d = null;
      try {
        res = await (quiet ? fetch(API + 'extract', init) : aosFetch(API + 'extract', init));
        if (quiet && res.status === 401) { out.stop = 'signin'; break; }
        d = await res.json();
      } catch { if (quiet) { out.stop = 'offline'; break; } continue; }
      if (d && d.error === 'no-key') { aiAvail = false; out.stop = 'no-key'; break; }
      if (!d || d.error === 'limit') { out.stop = 'limit'; break; }
      out.done.add(q.bid);
      const before = JSON.parse(JSON.stringify(b)), had = Object.keys(b.filled || {}).length;
      if (d.ok) noteModel('check', d.model);
      if (d.ok && applyAi(b, d.fields || {})) {
        changed = true; out.filled += Math.max(1, Object.keys(b.filled || {}).length - had);
        out.changes.push({ id: b.id, before, after: sameAs(b) });
      }
    }
    if (changed) { save(); render(); }
    return out;
  }
  // The emails behind some bookings, read again from Gmail (each email once): the queue aiPass takes, and how many
  // bookings didn't come from an email. Throws AuthError when Gmail needs a sign-in.
  async function mailQueue(list) {
    const mails = new Map(), queue = [];
    let noMail = 0;
    for (const b of list) {
      const mid = b.source && b.source.msgId;
      if (!mid) { noMail++; continue; }
      if (!mails.has(mid)) {
        try {
          const msg = await gmail('/messages/' + mid, { format: 'full' });
          const { html, text } = bodies(msg.payload);
          mails.set(mid, { text: P.htmlToText(html) || text || '', subject: header(msg, 'subject'), date: +msg.internalDate || Date.now() });
        } catch (e) { if (e instanceof AuthError) throw e; mails.set(mid, null); }
      }
      const m = mails.get(mid);
      if (m) queue.push({ bid: b.id, msgId: mid, ...m });
    }
    return { queue, noMail };
  }
  // Undo for what a check filled in: each booking goes back to how it was, unless it has changed again since.
  const sameAs = b => { const { updated, ...rest } = b; return JSON.stringify(rest); };     // save() stamps updated
  const undoChanges = changes => () => {
    let any = false;
    for (const c of changes) {
      const i = bookings.findIndex(x => x.id === c.id);
      if (i < 0 || sameAs(bookings[i]) !== c.after) continue;
      bookings[i] = c.before; any = true;
    }
    if (any) { save(); render(); smartSoon(); }
  };
  const filledLine = r => 'Filled in ' + plural(r.filled, 'detail') + ' on ' + (r.changes.length === 1 ? titleOf(bookings.find(b => b.id === r.changes[0].id) || {}) : plural(r.changes.length, 'booking')) + '. Marked Check.';
  // Have Ipsy check, on a trip card: reads the emails behind the trip's bookings that still lack something and
  // asks Claude only about what they lack. You press it, so you decide when anything is sent.
  async function checkTripWithAI(id, btn) {
    if (st.aiBusy) return;
    const g = tripById(id); if (!g) return;
    st.aiBusy = true;
    if (btn) { btn.disabled = true; btn.innerHTML = I.spark + 'Checking…'; }
    if (ipsy) ipsy.working(true);
    try {
      if (aiAvail === null) await pingLive();
      if (!aiAvail) { toast('AI isn’t set up on this copy of the site.'); return; }
      if (!getToken()) { toast('Connect Gmail first, so Travel can read the emails.'); return; }
      const todo = g.items.filter(b => !b.private && !isPast(b) && b.status !== 'cancelled' && !b.ride && P.missingFields(b).length);
      const { queue, noMail } = await mailQueue(todo);
      const r = await aiPass(queue);
      await findNumbers();
      const bits = [];
      if (r.filled) bits.push('Ipsy filled in ' + plural(r.filled, 'detail') + '. They’re marked to check.');
      else if (r.asked) bits.push('Ipsy read the email. It doesn’t say anything more.');
      else if (r.nothing) bits.push('The email doesn’t state what’s missing, so Ipsy has nothing to read. Your calendar, or you, can add it.');
      if (noMail) bits.push(plural(noMail, 'booking') + ' didn’t come from an email.');
      const undo = r.changes.length ? undoChanges(r.changes) : null;
      if (undo && ipsy) ipsy.change(filledLine(r), undo);
      toast(bits.join(' ') || 'Nothing is missing.', undo, undo ? 6000 : 0);
    } catch (e) {
      toast(e instanceof AuthError ? 'Gmail needs you to sign in again.' : 'Couldn’t check just now. Try again in a moment.');
    } finally { st.aiBusy = false; if (ipsy) ipsy.working(false); render(); }
  }
  // Ipsy checks by itself: after Travel reads Gmail, opens or you change a booking (smartPass, once the calendar and the
  // flight board have had their go), every upcoming booking still missing something that came from an email is
  // checked once per email, at most 10 at a time, quietly, the way Have Ipsy check does. Asked once first, from Ipsy's
  // corner; Settings > Smart help turns it on or off. What it fills in is marked Check (To check), with Undo in Ipsy's chat.
  let autoBusy = false, autoOffered = false;
  async function ipsyAutoCheck() {
    if (!ipsy || autoBusy || st.aiBusy || st.scanning || !aiOn() || !getToken()) return;
    const mode = ls.get(K.ipsyAuto, '');
    if (mode === '0') return;
    const tried = new Set(ls.json(K.ipsyTried, [])), tag = b => b.id + ':' + b.source.msgId;
    const todo = bookings.filter(b => !b.private && myMail(b) && !b.edited && b.status !== 'cancelled' && !b.ride && !staleUndated(b)
      && !(startOf(b) && isPast(b)) && P.missingFields(b).length && !tried.has(tag(b))).slice(0, 10);
    if (!todo.length) return;
    if (aiAvail === null) await pingLive();
    if (!aiAvail) return;
    if (mode !== '1') {
      if (autoOffered) return;
      autoOffered = true;
      ipsy.hint(plural(todo.length, 'booking') + (todo.length === 1 ? ' is' : ' are') + ' missing details. Want me to look?', async () => {
        const ok = await ipsy.ask('Want me to fill in what your upcoming bookings are missing, by myself? I’ll send Claude a short excerpt of each email, and mark what I fill in **Check**, with Undo.', { yes: 'Yes, check them', no: 'Not now' });
        ls.set(K.ipsyAuto, ok ? '1' : '0');
        if (ok) { ipsy.close(); ipsyAutoCheck(); }
      });
      return;
    }
    autoBusy = true; ipsy.working(true);
    let r = null, stop = '';
    try {
      const { queue } = await mailQueue(todo);
      r = await aiPass(queue, true);
      stop = r.stop;
    } catch (e) { stop = e instanceof AuthError ? 'auth' : 'error'; }
    if (r) {
      // looked at: marked tried. Stopped early (no sign-in, offline, the limit): the rest waits for next time.
      todo.forEach(b => { if (!stop || r.done.has(b.id)) tried.add(tag(b)); });
      ls.set(K.ipsyTried, JSON.stringify([...tried].slice(-500)));
    }
    autoBusy = false; ipsy.working(false); render();
    if (r && r.changes.length) {
      ipsy.change(filledLine(r), undoChanges(r.changes));
      ipsy.hint('I filled in ' + plural(r.filled, 'detail') + ' on ' + plural(r.changes.length, 'booking') + '. They’re in To check for you to look over.');
    } else if (r && r.done.size) ipsy.note('Checked ' + plural(r.done.size, 'booking') + ' missing details: ' + (r.done.size === 1 ? 'its email doesn’t' : 'their emails don’t') + ' say any more.');
    else if (stop === 'signin') ipsy.hint('Sign in with Face ID in aOS and I can fill in what your bookings are missing.');
  }
  // -- Changes Ipsy makes (ipsy-tools.js): "delete the Sheraton", "put the hotel in the San Diego trip", "add a dinner on the 16th" --
  // A short list of changes (set or clear a field, add a booking, delete, cancel or bring back, mark checked, join trips, take a
  // booking out of its trip, rename a trip), each checked here against what is in the app, and made the way the booking sheet
  // makes them: what is changed is yours (an email never overwrites it again), and a deleted booking stays deleted.
  const DT = /^20\d\d-\d\d-\d\d(?:T\d\d:\d\d)?$/, D8 = /^20\d\d-\d\d-\d\d$/, HM = /^\d\d:\d\d$/, CONFRE = /^[A-Za-z0-9]{0,12}$/;
  const tx = n => new RegExp('^.{0,' + n + '}$'), wd = (lo, hi) => new RegExp('^.{' + lo + ',' + hi + '}$');
  // Every field you can edit by hand, by kind, and the shape its value must have; an empty value clears it, except the ones in EDIT_NEEDED.
  const EDIT_FIELDS = {
    flight: { airlineCode: /^[A-Z0-9]{2}$/, flightNo: /^\d{1,4}[A-Z]?$/, from: /^[A-Z]{3}$/, to: /^[A-Z]{3}$/, dep: DT, arr: DT, terminal: tx(10), gate: tx(10), conf: CONFRE, seat: tx(8), traveller: tx(60), notes: tx(300) },
    hotel: { name: wd(2, 80), address: tx(140), city: tx(60), conf: CONFRE, checkIn: D8, checkInTime: HM, checkOut: D8, checkOutTime: HM, phone: tx(30), notes: tx(300) },
    car: { company: wd(2, 60), conf: CONFRE, pickupPlace: tx(120), pickup: DT, dropoff: DT, dropPlace: tx(120), carClass: tx(40), city: tx(60), notes: tx(300) },
    other: { title: wd(2, 80), place: tx(120), start: DT, end: DT, conf: CONFRE, notes: tx(300) },
  };
  const EDIT_NEEDED = { flight: ['dep', 'airlineCode', 'flightNo', 'from', 'to'], hotel: ['checkIn', 'name', 'checkOut'], car: ['pickup', 'company'], other: ['start', 'title'] };
  const EDIT_LABEL = { flightNo: 'flight number', airlineCode: 'airline', from: 'from', to: 'to', dep: 'departs', arr: 'arrives', terminal: 'terminal', gate: 'gate', conf: 'confirmation', seat: 'seat', traveller: 'traveler', notes: 'notes',
    name: 'name', address: 'address', city: 'city', checkIn: 'check-in', checkInTime: 'check-in time', checkOut: 'check-out', checkOutTime: 'check-out time', phone: 'phone',
    company: 'company', pickupPlace: 'pick-up place', pickup: 'pick-up', dropoff: 'drop-off', dropPlace: 'drop-off place', carClass: 'car', title: 'title', place: 'place', start: 'starts', end: 'ends' };
  const clipS = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);
  // One field and value of a kind, normalised, or null when it is not allowed.
  function checkField(kind, field, value) {
    const re = EDIT_FIELDS[kind] && EDIT_FIELDS[kind][field];
    if (!re) return null;
    let v = clipS(value, 300);
    if (/^(airlineCode|from|to|conf)$/.test(field)) v = v.toUpperCase();
    if (v === '') return EDIT_NEEDED[kind].includes(field) ? null : { field, value: '' };
    return re.test(v) ? { field, value: v } : null;
  }
  // One proposed change, or null when it does not check out against what is here.
  function checkEdit(o, tids = new Set()) {
    if (!o || typeof o !== 'object') return null;
    const id = clipS(o.id, 48), b = bookings.find(x => x.id === id);
    if (o.op === 'set') { const f = b && checkField(b.type, clipS(o.field, 20), o.value); return f ? { op: 'set', id, field: f.field, value: f.value } : null; }
    if (o.op === 'add') {
      const kind = clipS(o.kind, 10);
      if (!EDIT_FIELDS[kind] || !Array.isArray(o.pairs)) return null;
      const fields = {};
      for (const p of o.pairs.slice(0, 20)) { const f = p && checkField(kind, clipS(p.field, 20), p.value); if (!f) return null; if (f.value) fields[f.field] = f.value; }
      return EDIT_NEEDED[kind].every(k => fields[k]) ? { op: 'add', kind, pairs: Object.entries(fields).map(([field, value]) => ({ field, value })) } : null;
    }
    if (o.op === 'delete' || o.op === 'check' || o.op === 'detach') return b ? { op: o.op, id } : null;
    if (o.op === 'status') { const v = clipS(o.value, 12); return b && (v === 'cancelled' || v === 'confirmed') ? { op: 'status', id, value: v } : null; }
    if (o.op === 'join') { const w = clipS(o.with, 48); return b && w !== id && bookings.some(x => x.id === w) ? { op: 'join', id, with: w } : null; }
    if (o.op === 'rename') { const name = clipS(o.name, 60); return tids.has(id) && name.length >= 2 ? { op: 'rename', id, name } : null; }
    return null;
  }
  const dayWords = v => v ? (String(v).length > 10 ? v.replace('T', ' ') : v) : 'nothing';
  // A day alone keeps the time the booking has.
  const keepTime = (field, value, old) => /^(dep|arr|pickup|dropoff|start|end)$/.test(field) && value.length === 10 && String(old).length > 10 ? value + String(old).slice(10) : value;
  function setField(b, field, value) {
    value = keepTime(field, value, b[field] || '');
    b[field] = value; b.edited = true; b.guess = false; delete b.filled;
    if (field === 'dep' || field === 'arr' || field === 'pickup' || field === 'dropoff') delete b[field + 'Iso'];
    if (field === 'dep') delete b.depTime;
    if (field === 'airlineCode') b.airline = P.AIRLINES[value] || b.airline || '';
    if (field === 'from') b.fromName = P.AIRPORTS[value] || '';
    if (field === 'to') b.toName = P.AIRPORTS[value] || '';
    if (b.type === 'flight') delete live[b.id];
  }
  function newBooking(kind, pairs) {
    const b = { type: kind, status: 'confirmed', guess: false, conf: '', notes: '', edited: true, created: Date.now() };
    pairs.forEach(p => setField(b, p.field, p.value));
    b.id = P.idFor(b);
    if (bookings.some(x => x.id === b.id)) b.id += '-' + Date.now().toString(36);
    return b;
  }
  // A change in words, for Ipsy's chat (worked out before it is made).
  function editText(o) {
    const b = bookings.find(x => x.id === o.id), w = o.with && bookings.find(x => x.id === o.with);
    const nm = x => titleOf(x) + (startOf(x) ? ' (' + startOf(x).slice(0, 10) + ')' : '');
    if (o.op === 'set') return 'Changed ' + titleOf(b) + ': ' + EDIT_LABEL[o.field] + ' from ' + dayWords(b[o.field]) + ' to ' + dayWords(keepTime(o.field, o.value, b[o.field] || ''));
    if (o.op === 'add') { const t = { type: o.kind }; o.pairs.forEach(p => { t[p.field] = p.value; }); return 'Added ' + nm(t) + (t.checkOut ? ' to ' + t.checkOut : ''); }
    if (o.op === 'delete') return 'Deleted ' + nm(b);
    if (o.op === 'status') return (o.value === 'cancelled' ? 'Marked ' + nm(b) + ' as canceled' : 'Brought back ' + nm(b));
    if (o.op === 'check') return 'Marked ' + titleOf(b) + ' as checked';
    if (o.op === 'detach') return 'Took ' + titleOf(b) + ' out of its trip, into a trip of its own';
    if (o.op === 'join') return 'Put ' + titleOf(b) + ' in the same trip as ' + titleOf(w);
    const g = tripById(o.id);
    return 'Renamed the trip' + (g ? ' “' + g.name + '”' : '') + ' to “' + o.name + '”';
  }
  // Makes changes that checked out (checkEdit). Returns how many, the ids of bookings it added, and an undo that puts back just
  // the bookings and trip names these changes touched (Ipsy shows each change in its chat with Undo).
  function applyEdits(ops) {
    const copy = x => JSON.parse(JSON.stringify(x));
    const before = new Map(), names = new Map(), added = [], gone = [];
    let n = 0;
    for (const o of ops) {
      const b = o.op === 'add' || o.op === 'rename' ? null : bookings.find(x => x.id === o.id);
      if (b && !before.has(b.id)) before.set(b.id, copy(b));
      if (o.op === 'add') { const nb = newBooking(o.kind, o.pairs); bookings.push(nb); added.push(nb.id); n++; }
      else if (o.op === 'set' && b) { setField(b, o.field, o.value); n++; }
      else if (o.op === 'delete' && b) { bookings = bookings.filter(x => x !== b); gone.push(b); n++; }
      else if (o.op === 'status' && b) { b.status = o.value; b.edited = true; n++; }
      else if (o.op === 'check' && b) { b.guess = false; b.checked = true; delete b.filled; n++; }
      else if (o.op === 'join' && b) { b.tripWith = o.with; delete b.tripApart; n++; }
      else if (o.op === 'detach' && b) { b.tripApart = true; delete b.tripWith; n++; }
      else if (o.op === 'rename') {
        const g = tripById(o.id);
        if (g) {
          const cur = trips.find(t => t.id === g.id);
          if (!names.has(g.id)) names.set(g.id, cur ? copy(cur) : null);
          if (cur) cur.name = o.name; else trips.push({ id: g.id, name: o.name });
          n++;
        }
      }
    }
    save(); smartSoon(); gone.forEach(dropFromCalendar); render(); refreshOpen();
    const undo = () => {
      bookings = bookings.filter(x => !added.includes(x.id));
      before.forEach((was, id) => {
        const i = bookings.findIndex(x => x.id === id), b = copy(was);
        // the calendar as it is now: one taken out of it (deleted or canceled) is written to it again on the next sync
        if (i >= 0 && bookings[i].calSig) b.calSig = bookings[i].calSig; else delete b.calSig;
        if (i >= 0) bookings[i] = b; else bookings.push(b);
      });
      names.forEach((was, id) => { trips = trips.filter(t => t.id !== id); if (was) trips.push(was); });
      save(); smartSoon(); render(); refreshOpen();
    };
    return { n, added, undo };
  }
  // The booking sheet edits its own copy: after a change made from the chat, it shows the booking as it is now (or
  // closes, if it was deleted), so closing it can't write the old copy back.
  function refreshOpen() {
    if ($('bkSheet').hidden || !st.booking || st.isNew) return;
    const b = bookings.find(x => x.id === st.booking.id);
    if (b) { st.booking = JSON.parse(JSON.stringify(b)); renderBooking(); }
    else { st.booking = null; closeSheet('bkSheet'); }
  }

  // A flight with an airline, the airports, the day and the time but no number: the airport's departure board has it.
  async function findNumbers() {
    if (findAvail === null && liveAvail === null) await pingLive();
    if (!findAvail) return;
    const use = aiUse();
    let changed = false;
    for (const b of bookings) {
      if (b.type !== 'flight' || b.flightNo || b.status === 'cancelled' || b.edited || b.ride || !b.airlineCode || !b.from || !b.to || String(b.dep || '').length < 16 || isPast(b)) continue;
      const tried = 'find:' + b.id + ':' + b.dep;
      if (use.tried[tried]) continue;
      if (use.find >= FIND_A_MONTH) break;
      use.tried[tried] = Date.now(); use.find++; aiSave(use);
      try {
        const d = await boardData({ airline: b.airlineCode, from: b.from, to: b.to, date: b.dep.slice(0, 10), time: b.dep.slice(11, 16) });
        if (d && d.error === 'no-key') { findAvail = false; break; }
        if (d && d.error === 'limit') break;
        if (d && d.ok && d.candidates && d.candidates.length === 1 && /^\d{1,4}[A-Z]?$/.test(d.candidates[0].number)) { b.flightNo = d.candidates[0].number; fill(b, 'flightNo', 'board'); changed = true; }
      } catch {}
    }
    if (changed) { save(); render(); }
  }
  // After a read of Gmail, when the app opens, and after an edit: the cheap steps first.
  let smartBusy = false;
  async function smartPass() {
    if (smartBusy) return;
    smartBusy = true;
    try {
      ls.set(K.smartAt, String(Date.now()));
      await syncCalendar();
      await findNumbers();
    } catch {} finally { smartBusy = false; }
    ipsyAutoCheck();                // last: what the calendar and the flight board fill in isn't asked of Claude
  }
  let calTimer = 0;
  const smartSoon = () => { clearTimeout(calTimer); calTimer = setTimeout(() => smartPass(), 3000); };

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
      + linkRow(LINKS.kayakCars(to || '', out, back), 'Rental cars (Kayak)', where + ' · ' + when, I.car)
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
  function scanSummary() {
    const i = ls.json(K.scanInfo, null);
    if (!i) return 'Nothing yet';
    return i.ok ? 'Last look ' + ago(i.at) + ': ' + plural(i.read, 'email') + ' read, ' + plural(i.found, 'booking') + ' found' + (i.failed ? ', ' + i.failed + ' not downloaded' : '')
      : 'Last look ' + ago(i.at) + ' stopped: ' + (i.err || 'something went wrong');
  }
  function openLog() {
    const list = ls.json(K.scanLog, []), i = ls.json(K.scanInfo, null);
    let h = '';
    if (!list.length) h = '<div class="box glass"><span class="hint" style="margin:0">No emails read yet.</span></div>';
    else h = '<div class="rgroup glass">' + list.map(e => '<div class="logrow"><div class="lgt"><b>' + esc(e.subj || '(no subject)') + '</b><span>' + esc([e.from, e.at ? new Date(e.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''].filter(Boolean).join(' · ')) + '</span></div><span class="lgo' + (/^(no booking|couldn)/.test(e.out || '') ? ' no' : '') + '">' + esc(e.out || '') + '</span></div>').join('') + '</div>';
    $('lgBody').innerHTML = h;
    $('lgHint').textContent = i ? plural(i.listed, 'email') + ' matched Travel’s search in the last look.' : '';
    $('lgHint').hidden = !i;
    closeSheet('setSheet'); openSheet('logSheet');
  }
  function renderSettings() {
    const own = ownToken(), viaMail = !own && mailToken(), ever = ls.get(K.token + '.ever', '');
    const me = ls.get(K.me, '');
    let rows = '';
    if (own || viaMail || ever) {
      rows += '<button class="rowbtn" type="button" id="stScan"><span class="ic">' + I.mail + '</span><span>Look for new bookings now<span class="sub">'
        + esc(+ls.get(K.lastScan, 0) ? 'Last checked ' + ago(+ls.get(K.lastScan, 0)) : 'Not checked yet') + '</span></span></button>';
      rows += '<button class="rowbtn" type="button" id="stLog"><span class="ic">' + I.mail + '</span><span>What Travel read<span class="sub">' + esc(scanSummary()) + '</span></span></button>';
      rows += '<button class="rowbtn" type="button" id="stRescan"><span class="ic">' + I.refresh + '</span><span>Read the last year again<span class="sub">Bookings you edited, checked or deleted stay as they are</span></span></button>';
      if (own || ever) rows += '<button class="rowbtn" type="button" id="stOut"><span class="ic">' + I.out + '</span><span>Sign out of Gmail<span class="sub">' + esc(me || 'Signed in') + '</span></span></button>';
    } else {
      rows += '<button class="rowbtn" type="button" id="stIn"><span class="ic">' + I.mail + '</span><span>Connect Gmail<span class="sub">Read-only</span></span></button>';
    }
    $('stGmail').innerHTML = rows;
    $('stGmailHint').textContent = viaMail ? 'Using Mail’s sign-in from this browser.' : '';
    $('stGmailHint').hidden = !viaMail;
    $('stCalSub').textContent = calAvail === false ? 'Not available on this copy of the site.' : (calOn() ? 'On. ' : 'Off. ') + 'Shares bookings with the Family calendar, both ways.';
    $('stAiSub').textContent = aiAvail === false ? 'Not set up on this copy of the site.' : aiOn() ? 'On. Ipsy fills in a trip’s missing details from its email.' + modelsLine() : 'Off. Ipsy fills in a trip’s missing details from its email.';
    const auto = ls.get(K.ipsyAuto, '');
    $('stIpsyAutoOpt').hidden = aiAvail === false || !aiOn();
    $('stIpsyAutoSub').textContent = (auto === '1' ? 'On. ' : auto === '0' ? 'Off. ' : 'Asks first. ') + 'Ipsy checks new bookings that are missing details.';
    const PV = window.AllisonOS && window.AllisonOS.ipsy && window.AllisonOS.ipsy.privacy;
    $('stIpsyGmailOpt').hidden = !PV;
    if (PV) $('stIpsyGmailSub').textContent = (PV.gmail('travel') ? 'On. ' : 'Off. ') + 'Lets Ipsy search and read your email in chats.';
    const n = lookupsThisMonth();
    $('stLive').textContent = liveAvail === true ? 'Working. ' + plural(n, 'lookup') + ' this month, of ' + LOOKUPS_A_MONTH + '.'
      : liveAvail === false ? 'Not available on this copy of the site.'
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
      liveAvail = !!d.status; aiAvail = !!d.ai; findAvail = !!d.find; aiModels = d.models && d.models.check ? d.models : null;
    } catch { liveAvail = false; aiAvail = false; findAvail = false; }
  }
  $('setBtn').onclick = openSettings;
  // Design: Vintage or Standard, at once, the first section of Settings (../home/design.js)
  if (window.aosDesign) {
    $('stDesign').innerHTML = aosDesign.picker(); aosDesign.bind($('stDesign'));
    document.querySelectorAll('#setSheet [data-design-row]').forEach(e => { e.hidden = false; });
  }
  $('stCalOpt').onclick = () => { ls.set(K.calOn, calOn() ? '0' : '1'); renderSettings(); if (calOn()) smartSoon(); };
  $('stAiOpt').onclick = () => { ls.set(K.aiOn, aiOn() ? '0' : '1'); renderSettings(); render(); };
  $('stIpsyAutoOpt').onclick = () => {
    const on = ls.get(K.ipsyAuto, '') !== '1';
    ls.set(K.ipsyAuto, on ? '1' : '0'); renderSettings();
    if (on) { ls.del(K.ipsyTried); closeSheet('setSheet'); ipsyAutoCheck(); }
  };
  $('stIpsyGmailOpt').onclick = () => { const PV = window.AllisonOS.ipsy.privacy; PV.gmail('travel', !PV.gmail('travel')); renderSettings(); };
  $('stGmail').addEventListener('click', e => {
    if (e.target.closest('#stIn')) signIn({ choose: true });
    else if (e.target.closest('#stScan')) { closeSheet('setSheet'); scan({ loud: true }); }
    else if (e.target.closest('#stLog')) openLog();
    else if (e.target.closest('#stRescan')) {
      // Start over: bookings read from email (and not edited or checked by
      // you) are cleared and read again, so an improved reader replaces its
      // old mistakes. Anything not found again stays gone, on both phones.
      // Only those whose email was read on this phone (as when the reader changes, in scan), and none past the 90 days.
      const auto = bookings.filter(b => b.source && b.source.msgId && seen.has(b.source.msgId) && !isOld(b) && !b.edited && !b.checked);
      revive = new Set(auto.map(b => b.id)); ls.set(K.revive, JSON.stringify([...revive]));
      bookings = bookings.filter(b => !revive.has(b.id));
      save();
      seen = new Set(); saveSeen(); ls.del(K.lastScan); closeSheet('setSheet'); scan({ loud: true });
    }
    else if (e.target.closest('#stOut')) signOut();
  });
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
  // The family's Google Sheet: the record of everyone's trips, each booking
  // and trip name marked with whose it is, and shared with the family unless
  // its own person made it Just me (aOS/SHEETS.md, family mode). This phone
  // keeps a working copy: every booking still to come, the last 90 days of
  // the rest, and every trip name; older trips come from the Sheet when you
  // look back (Past). Syncs go through aOS (../home/sheet.js,
  // functions/sheet/api), signed in, so the phone holds no Sheet link or
  // phrase, and never gets anyone else's Just me bookings.
  // ---------------------------------------------------------------------
  const APP = 'allison-travel-sync';
  const SH = () => window.AllisonOS && AllisonOS.sheet;
  // errShown: a quiet sync shows one toast a session at most, for a real error (aOS sets the Sheet up, so not
  // for 'signin' or 'no-sheet').
  let syncing = false, syncAgain = false, syncTimer = null, syncState = 'idle', syncErr = '', errShown = false;
  // Synced with the family Sheet at least once: from then on the phone keeps 90 days of past trips.
  let synced = ls.get(K.family, '') === '1';
  const KEEP_DAYS = 90;
  const olderIds = new Set();   // past bookings fetched from the Sheet to look back (until the next tidy-up)
  const pruneFrom = () => synced ? P.addDays(todayStr(), -(KEEP_DAYS - 1)) : null;
  const endDay = b => String(endOf(b) || '').slice(0, 10);
  // A booking that ended before the 90 days (one with no date yet never has): kept in the Sheet, not here.
  const isOld = b => { const f = pruneFrom(); return !!f && !!startOf(b) && endDay(b) < f; };
  const keepHere = b => !isOld(b) || olderIds.has(b.id);
  function prune() {
    if (!pruneFrom()) return;
    const n = bookings.length;
    bookings = bookings.filter(b => { if (keepHere(b)) return true; shadow.delete('bookings:' + b.id); return false; });   // no grave: the Sheet keeps it
    if (bookings.length !== n) persist();
  }
  const SYNC_ERRORS = {
    signin: 'Sign in to sync with the family’s Google Sheet. Until then, Travel keeps everything on this phone.',
    'no-sheet': 'The family’s Travel Sheet isn’t set up yet. The owner sets it up in aOS: Account → Google Sheets.',
    'wrong-secret': 'aOS’s phrase for the Travel Sheet doesn’t match its script any more. The owner updates it in aOS: Account → Google Sheets.',
    'old-script': 'The Travel Sheet is still on its old script. The owner pastes in the new one and deploys a new version (aOS/SHEETS.md).',
    'secret-not-set': 'The Travel Sheet’s script still says SECRET = ‘CHANGE-ME’. The owner changes it and deploys a new version.',
    busy: 'The Sheet was busy. Trying again shortly.',
    offline: 'Offline. Changes will sync when you’re back online.',
    'sheet-unreachable': 'Couldn’t reach the Sheet. Trying again later.',
    'not-json': 'The Sheet didn’t answer as expected. Trying again later.',
  };
  // The link and phrase this phone used to keep (before aOS kept them): on the owner's phone they go
  // to aOS once (it keeps them from then on); on every phone, once aOS has them, they're forgotten here.
  async function handOver() {
    const old = ls.json(K.sync, null) || await keep.get('sync');
    if (!old || !old.secret || !SH() || !signedIn()) return;
    if (await SH().adopt('travel', old)) { ls.del(K.sync); keep.set('sync', null); }
  }
  // sent: each item's change time as this sync sent it. What changed here since goes with the next sync; what was sent
  // and isn't in the answer (an id that is someone else's Just me booking) isn't sent again and again.
  function applyRemote(res, sent) {
    Object.keys(res.graves || {}).forEach(k => { const t = +res.graves[k] || 0; if ((graves[k] || 0) < t) graves[k] = t; });
    if (res.by) ls.set(K.who, String(res.by));
    if (res.people && typeof res.people === 'object') ls.set(K.people, JSON.stringify(res.people));
    const who = res.by || meId();
    let localNewer = false;
    const newer = (kind, l) => (+l.updated || 0) > (sent.get(kind + ':' + l.id) || 0);
    const mergeKind = (kind, local, remote) => {
      const map = new Map(local.map(x => [x.id, x]));
      remote.forEach(r => {
        const l = map.get(r.id);
        if (!l || (+r.updated || 0) > (+l.updated || 0)) map.set(r.id, r);
        else if ((+l.updated || 0) > (+r.updated || 0)) { if (newer(kind, l)) localNewer = true; }
        else {
          // the same version: whose it is, as the Sheet says (kept in place, as other code may be holding this booking)
          if (r.by && l.by !== r.by) l.by = r.by;
          if (!!r.only !== !!l.only) { if (r.only) l.only = true; else delete l.only; }
        }
      });
      const remoteIds = new Set(remote.map(r => r.id));
      local.forEach(l => {
        if (remoteIds.has(l.id) || graves[kind + ':' + l.id]) return;
        // someone else's that the Sheet no longer gives this phone: its own person made it Just me (one past the 90 days,
        // fetched for Past, isn't in this answer anyway: it goes at the tidy-up)
        if (l.by && l.by !== who) { if (kind !== 'bookings' || !isOld(l)) map.delete(l.id); }
        else if (newer(kind, l)) localNewer = true;
      });
      return [...map.values()].filter(x => { const g = graves[kind + ':' + x.id]; return !(g && g >= (+x.updated || 0)); });
    };
    const ok = x => x && typeof x.id === 'string';
    // Only bookings of a type this app knows, as the backup import requires. Past trips older than the 90 days went to
    // the Sheet with this sync: kept there, not here (initShadow below leaves no graves for them).
    bookings = mergeKind('bookings', bookings.filter(keepHere), (res.bookings || []).filter(b => ok(b) && /^(flight|hotel|car|other)$/.test(b.type)).filter(keepHere));
    trips = mergeKind('trips', trips, (res.trips || []).filter(ok));
    initShadow(); persist();
    if (localNewer) syncAgain = true;
    render();
  }
  // Always quietly, when signed in: aOS sets the Sheet up, and Travel syncs by itself.
  async function sync() {
    if (!SH() || !signedIn()) { syncState = signedIn() ? 'idle' : 'signin'; renderSyncStatus(); return false; }
    if (syncing) { syncAgain = true; return false; }
    if (!navigator.onLine) { syncState = 'offline'; renderSyncStatus(); return false; }
    syncing = true; syncState = 'syncing';
    let ok = false;
    try {
      track(); persist();
      const sent = new Map();
      kinds().forEach(([kind, arr]) => arr.forEach(it => sent.set(kind + ':' + it.id, +it.updated || 0)));
      const res = await SH().sync('travel', { action: 'sync', v: 2, window: KEEP_DAYS, today: todayStr(), bookings, trips, graves });
      if (res.app && res.app !== APP) throw new Error('not-json');
      if (!res.aos) throw new Error('old-script');
      lastSyncAt = Date.now(); ls.set(K.syncAt, String(lastSyncAt));
      if (!synced) { synced = true; ls.set(K.family, '1'); }
      syncState = 'ok'; syncErr = ''; ok = true;
      applyRemote(res, sent);
      prune();
    } catch (e) {
      syncState = e.message === 'signin' ? 'signin' : e.message === 'offline' ? 'offline' : 'error'; syncErr = e.message;
      if (!errShown && syncState === 'error' && syncErr !== 'no-sheet') { errShown = true; toast(SYNC_ERRORS[syncErr] || 'Sync didn’t work. Trying again later.', null, 6000); }
    } finally {
      syncing = false; renderSyncStatus();
      if (syncAgain) { syncAgain = false; scheduleSync(800); }
    }
    return ok;
  }
  function scheduleSync(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(() => sync(), ms == null ? 2000 : ms); }
  // Looking back (Past): the trips that ended before the 90 days this phone keeps come from the Sheet, once a
  // session when Past is shown (or when you tap Show older trips), and go from the phone at the next tidy-up.
  let older = '';   // '', 'loading', 'done' or 'failed'
  async function loadOlder(ask) {
    const floor = pruneFrom();
    if (!floor || !SH() || older === 'loading' || older === 'done') return;
    if (!ask && (older === 'failed' || !signedIn() || !navigator.onLine)) return;
    older = 'loading'; render();
    try {
      const res = await SH().sync('travel', { action: 'range', from: '2000-01-01', to: P.addDays(floor, -1) }, { ask: !!ask });
      let n = 0;
      for (const b of (res.bookings || []).filter(b => b && typeof b.id === 'string' && /^(flight|hotel|car|other)$/.test(b.type))) {
        olderIds.add(b.id);
        if (bookings.some(x => x.id === b.id) || graves['bookings:' + b.id]) continue;
        const { updated, ...rest } = b;
        bookings.push(b); shadow.set('bookings:' + b.id, JSON.stringify(rest)); n++;
      }
      older = 'done';
      if (n) persist();
    } catch (e) {
      older = 'failed';
      if (ask) toast(SYNC_ERRORS[e.message] || 'Couldn’t get older trips from the Sheet. Try again later.', null, 6000);
    }
    render();
  }
  // The end of Past: where older trips are, and a button to get them when they didn't come by themselves.
  function olderHTML() {
    if (!pruneFrom() || older === 'done') return '';
    if (older === 'loading') return '<p class="hint" id="olderHint">Getting older trips from the Sheet…</p>';
    return '<button class="btn quiet" type="button" id="olderBtn">Show older trips from the Sheet</button>' + (signedIn() ? '' : '<p class="hint" id="olderHint">Sign in to see older trips.</p>');
  }
  // The sync's state shows only in the trips' subtitle (Synced, Syncing…, Not synced, Offline).
  function renderSyncStatus() {
    if (!$('tripsView').hidden) render();
  }
  // An old setup link (#sync=…, pasted): aOS keeps the family's Sheet now, so there's nothing to set up.
  function oldSetupLink(text) {
    if (!/#sync=[\w-]+/.test(String(text))) return false;
    toast('That’s an old Sheet setup link: there’s nothing to set up. Just sign in.', null, 6000);
    return true;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastSyncAt > 30000) sync();
    if (getToken() && scanDue()) scan();
    alive().filter(b => b.type === 'flight').forEach(b => refreshLive(b));
    render();
  });
  window.addEventListener('online', () => sync());
  addEventListener('aos:account', e => { if (e.detail) handOver().then(() => sync()); else { syncState = 'signin'; renderSyncStatus(); } });

  // ---------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------
  const back = consumeRedirect();
  // An old setup link from another phone (#sync=…): aOS keeps the Sheet now, so it's only taken off the address.
  if (location.hash.startsWith('#sync=')) history.replaceState(null, '', location.pathname + location.search);
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
  if (Date.now() - +ls.get(K.smartAt, 0) > 20 * 6e4) setTimeout(() => smartPass(), 2500);
  else setTimeout(() => ipsyAutoCheck(), 2500);
  if (aiOn()) setTimeout(() => pingLive().then(render), 1500);
  setTimeout(() => handOver().finally(() => sync()), 600);
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

  // Ipsy (../home/ipsy.js), the helper you chat with, above the tabs at the bottom left: its tools (ipsy-tools.js) work on
  // these same bookings, through the same checks and saves, this same Gmail sign-in and this app's own flight look-ups;
  // Claude answers through functions/travel/api (ipsy).
  if (window.AllisonOS && window.AllisonOS.ipsy && window.TravelIpsy) {
    const WHEN_NAMES = { upcoming: 'the Upcoming trips', past: 'the Past trips', check: 'the To check list' };
    ipsy = window.AllisonOS.ipsy.mount({
      app: 'travel', name: 'Travel', endpoint: '../travel/api/ipsy', headers: { 'X-Travel': '1' }, slot: $('ipsySlot'),
      ...window.TravelIpsy({
        P, get bookings() { return bookings; }, groupTrips, checkList, tripById, autoName, startOf, endOf, isPast, titleOf, fillText, liveView, liveWindow,
        checkField, checkEdit, applyEdits, editText, EDIT_FIELDS, EDIT_NEEDED, EDIT_LABEL, render, openTrip, openBooking,
        flightData, keepLive, boardData,
        // the same monthly allowances on this phone as the app's own look-ups
        allowance: { flight: () => LOOKUPS_A_MONTH - lookupsThisMonth(), countFlight: countLookup, board: () => FIND_A_MONTH - aiUse().find, countBoard: () => { const u = aiUse(); u.find++; aiSave(u); } },
        gmail, bodies, header, getToken, AuthError,
        screen() {
          if (!$('bkSheet').hidden && st.booking && !st.isNew) return st.booking.private ? 'a private booking' : 'the booking ' + st.booking.id + ' (' + titleOf(st.booking) + ')';
          const g = !$('tripPage').hidden && st.trip && tripById(st.trip);
          if (g) return g.items.some(b => b.private) ? 'a trip with private bookings' : 'the trip ' + g.id + ' ("' + g.name + '")';
          if (st.tab === 'explore') return 'Explore, which opens Google Flights, Google Hotels and others with a search filled in';
          return WHEN_NAMES[st.when] || 'the trips';
        },
      }),
    });
  }

  // For the tests (travel/scripts/app-test.mjs) only.
  window.__travel = { layer: LAYER, get bookings() { return bookings; }, get trips() { return trips; }, graves: () => graves, sync, pruneFrom, loadOlder, setJustMe, checkEdit, upsert, groupTrips, ics, liveView, live, render, scan, save, smartPass, syncCalendar, aiPass, findNumbers, checkList, undated, P };
})();
