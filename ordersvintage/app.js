"use strict";

// Orders Vintage: Orders in a mid-century modern look, as its own app (its look is the last
// block of index.html; this is Orders' script with its own storage, ordersv.*, and nothing else
// changed). Orders: everything you've bought, and where it is.
//
// - Orders come from Gmail (read on the phone, read-only), from a pasted
//   email, or typed in. parse.js does the reading: an order confirmation, its
//   shipping email, the carrier's own notice and the delivery email end up as
//   one order, whatever order they are read in.
// - Tracking opens the carrier's own page (no lookups, no keys, no cost).
// - A Google Sheet keeps both phones in step, as in Notes and Travel.
// - Packages and store pickups show by default; food, subscriptions and
//   tickets can be switched on in Settings.

// Refuse to run inside another page's frame (see Mail's app.js for why).
if (window.top !== window.self) {
  document.body.textContent = 'Orders Vintage can’t be opened inside another page.';
  throw new Error('Orders Vintage refuses to run inside a frame');
}

(function () {
  const P = window.OrdersParse;
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
  // Mail's OAuth client (not a secret: see mail/app.js). Orders Vintage's own address
  // must be added to it as a redirect URI once - ordersvintage/README.md, "Gmail".
  const CLIENT_ID = '804406956056-e91hbdndc4cqgerh9sffl9fmt76nfpua.apps.googleusercontent.com';
  const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
  const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
  const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
  const KEY = 'allison-ordersv-v1';
  const K = {
    token: 'ordersv.token', state: 'ordersv.state', silent: 'ordersv.silent', silentFail: 'ordersv.silentFail', lastAuth: 'ordersv.lastAuth', hint: 'ordersv.hint', me: 'ordersv.me',
    seen: KEY + '-seen', skipped: KEY + '-skipped', lastScan: KEY + '-scan', queryV: KEY + '-query-v', tab: KEY + '-tab',
    sync: KEY + '-sync', graves: KEY + '-graves', syncAt: KEY + '-sync-at',
    aiOk: KEY + '-ai-ok',
    cleanup: KEY + '-cleanup-5d',
  };
  const FIRST_SCAN = 'newer_than:1y';
  const MAX_SCAN = 500;              // messages read in one go at most; the rest follow straight away
  const CLEANUP_DAYS = 5;            // the one-off clean-up marks open orders nothing has been heard about for longer than this as received
  const STALE_DAYS = 45;             // an open order nothing has been heard about for this long is worth a look
  // What an order email looks like: the subjects stores and carriers use, and
  // the senders you buy from. Plus everything Mail's Orders auto-tag has
  // labelled: Gmail keeps that label up to date as mail arrives. Offers are skipped.
  const SENDERS = ['ups.com', 'fedex.com', 'usps.com', 'dhl.com', 'ontrac.com', 'lasership.com', 'narvar.com', 'amazon.com', 'ebay.com', 'walmart.com',
    'target.com', 'bestbuy.com', 'homedepot.com', 'lowes.com', 'costco.com', 'etsy.com', 'wayfair.com', 'chewy.com', 'shopifyemail.com'];
  const SUBJECTS = ['order', '"your package"', 'shipped', 'shipping', 'shipment', 'delivered', 'delivery', 'tracking', 'pickup', '"pick up"', 'receipt', 'purchase', 'invoice', '"ready for"'];
  const QUERY = '-in:chats -in:spam -in:trash -label:Travel {label:Orders (-category:promotions {' + SUBJECTS.map(s => 'subject:' + s).join(' ') + ' ' + SENDERS.map(s => 'from:' + s).join(' ') + '})}';
  const QUERY_V = '1';               // when QUERY widens, the next scan looks back FIRST_SCAN once more

  const I = {
    mail: '<svg viewBox="0 0 24 24"><rect x="2.8" y="5" width="18.4" height="14" rx="3.4"/><path d="M3.6 7.4l7.2 5a2 2 0 0 0 2.4 0l7.2-5"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M13.6 4h6.4v6.4"/><path d="M20 4l-9 9"/><path d="M17.6 13.6v3.6a2.8 2.8 0 0 1-2.8 2.8H6.8A2.8 2.8 0 0 1 4 17.2V9.2a2.8 2.8 0 0 1 2.8-2.8h3.6"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M20 11.2a8 8 0 0 0-14.6-4.4L4 8.4"/><path d="M4 3.8v4.6h4.6"/><path d="M4 12.8a8 8 0 0 0 14.6 4.4l1.4-1.6"/><path d="M20 20.2v-4.6h-4.6"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M9.6 20H6.8A2.8 2.8 0 0 1 4 17.2V6.8A2.8 2.8 0 0 1 6.8 4h2.8"/><path d="M15.4 16.6l4.1-4.1a.7.7 0 0 0 0-1l-4.1-4.1M19.6 12H9.4"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19.2 8.8a2.4 2.4 0 0 0 0-3.4l-.6-.6a2.4 2.4 0 0 0-3.4 0L4 16z"/><path d="M13.6 6.4l4 4"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M11 3.6l1.9 5.1 5.1 1.9-5.1 1.9L11 17.6l-1.9-5.1L4 10.6l5.1-1.9z"/><path d="M18.4 15.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/></svg>',
    box: '<svg viewBox="0 0 24 24"><path d="M3.8 8.2L12 4l8.2 4.2v7.6L12 20l-8.2-4.2z"/><path d="M3.8 8.2L12 12.4l8.2-4.2M12 12.4V20"/></svg>',
  };
  const KIND_ROWS = [
    ['package', 'Packages', 'Anything that ships to you'],
    ['pickup', 'Store pickups', 'Order ahead, collect in store'],
    ['food', 'Food orders', 'Delivery apps, restaurant pickup'],
    ['digital', 'Subscriptions and app receipts', 'Monthly renewals, App Store'],
    ['other', 'Tickets and other receipts', 'Events, library, parking'],
  ];
  const CARRIERS = ['UPS', 'USPS', 'FedEx', 'DHL', 'OnTrac', 'LaserShip', 'Amazon Logistics', 'Veho'];
  const OPEN = ['ordered', 'shipped', 'out', 'pickup'];
  const PACKAGE_STEPS = ['ordered', 'shipped', 'out', 'delivered'], PICKUP_STEPS = ['ordered', 'pickup', 'pickedup'];

  // ---------------------------------------------------------------------
  // Data: orders, kept like Notes keeps notes
  // ---------------------------------------------------------------------
  const saved = ls.json(KEY, null);
  let orders = saved && Array.isArray(saved.orders) ? saved.orders.filter(o => o && typeof o.id === 'string') : [];
  let kinds = { package: true, pickup: true, food: false, digital: false, other: false, ...(saved && saved.kinds ? saved.kinds : {}) };
  kinds.package = true;
  let graves = ls.json(K.graves, {});
  let seen = new Set(ls.json(K.seen, []));
  let skipped = ls.json(K.skipped, {});                                       // message id -> the kind that was switched off when it was read
  let syncCfg = ls.json(K.sync, null);
  const shadow = new Map();
  const st = { tab: ls.get(K.tab, 'way'), q: '', search: false, order: null, edit: null, isNew: false, scanning: false, scanDone: 0, scanTotal: 0 };

  // IndexedDB copy of the Sheet link and code, as in Notes: survives a full
  // or cleared localStorage (every AllisonOS app shares its space).
  const keep = (() => {
    let db = null;
    const open = () => db || (db = new Promise((res, rej) => {
      const r = indexedDB.open('allison-ordersv', 1);
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

  // What each order looked like at the last save: any change stamps a new
  // 'updated' time, and anything that vanished becomes a grave for the Sheet.
  const kindsOfData = () => [['orders', orders]];
  function initShadow() {
    shadow.clear();
    kindsOfData().forEach(([kind, arr]) => arr.forEach(it => {
      if (!it.updated) it.updated = it.created || 1;
      const { updated, ...rest } = it; shadow.set(kind + ':' + it.id, JSON.stringify(rest));
    }));
  }
  function track() {
    const now = Date.now(), have = new Set();
    kindsOfData().forEach(([kind, arr]) => arr.forEach(it => {
      const k = kind + ':' + it.id, { updated, ...rest } = it, j = JSON.stringify(rest);
      have.add(k);
      if (shadow.get(k) !== j) { it.updated = now; shadow.set(k, j); delete graves[k]; }
    }));
    shadow.forEach((j, k) => { if (!have.has(k)) { graves[k] = now; shadow.delete(k); } });
  }
  initShadow();
  let storeWarned = false;
  function persist() {
    const ok = ls.set(KEY, JSON.stringify({ orders, kinds })) && ls.set(K.graves, JSON.stringify(graves));
    if (!ok && !storeWarned) { storeWarned = true; toast('This phone couldn’t save Orders: storage is full.' + (syncCfg ? ' Your orders are safe in the Google Sheet.' : ' Back up soon.')); }
  }
  function save() { track(); persist(); if (syncCfg) scheduleSync(); }
  const saveSeen = () => { ls.set(K.seen, JSON.stringify([...seen].slice(-6000))); ls.set(K.skipped, JSON.stringify(skipped)); };

  // ---------------------------------------------------------------------
  // Dates and words
  // ---------------------------------------------------------------------
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const todayStr = () => ymd(new Date());
  const dOf = at => at ? new Date(String(at).slice(0, 10) + 'T12:00') : null;
  const daysFrom = (a, b) => Math.round((dOf(b) - dOf(a)) / D);          // days from a to b
  const fmtDay = (at, o = {}) => {
    const d = dOf(at); if (!d || isNaN(d)) return '';
    const other = d.getFullYear() !== new Date().getFullYear();
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(other ? { year: 'numeric' } : {}), ...o });
  };
  const fmtMD = at => fmtDay(at, { weekday: undefined });
  const dayWord = at => { if (!at) return ''; const n = daysFrom(todayStr(), at); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : fmtDay(at); };
  function fmtRange(a, b) {
    const da = dOf(a), db = dOf(b);
    if (!da) return '';
    if (!db || a === b) return fmtMD(a);
    if (da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear()) return fmtMD(a) + ' to ' + db.getDate();
    return fmtMD(a) + ' to ' + fmtMD(b);
  }
  const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  const money = (n, cur) => {
    if (n == null || n === '' || isNaN(n)) return '';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD' }).format(n); } catch { return '$' + Number(n).toFixed(2); }
  };
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

  // ---------------------------------------------------------------------
  // What an order is, for the screens
  // ---------------------------------------------------------------------
  const isOpen = o => OPEN.includes(o.status);
  const kindOn = o => kinds[o.kind || 'package'] !== false;
  const last = o => P.lastDay(o);
  const stale = o => isOpen(o) && !(o.eta && o.eta >= todayStr()) && daysFrom(last(o) || todayStr(), todayStr()) > STALE_DAYS;
  const needsCheck = o => !o.checked && (!!o.guess || stale(o));
  const stepsOf = o => o.kind === 'pickup' ? PICKUP_STEPS : PACKAGE_STEPS;
  const stepName = (o, s) => s === 'pickup' ? 'Ready for pickup' : s === 'pickedup' ? 'Picked up' : P.STATUS_NAMES[s];
  const doneDay = o => (o.steps && (o.steps.delivered || o.steps.pickedup)) || last(o) || '';
  const hueOf = o => parseInt(P.hash(o.storeKey || P.keyOf(o.store) || 'x'), 36) % 4;
  const initial = o => (String(o.store || '').match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase();
  function whatOf(o) {
    const it = o.items || [];
    if (!it.length) return o.orderNo ? 'Order ' + o.orderNo : '';
    const first = it[0].name + (it[0].qty > 1 ? ' ×' + it[0].qty : '');
    return it.length > 1 ? first + ' and ' + (it.length - 1) + ' more' : first;
  }
  // The line under the store: where it is, and when to expect it.
  function stateOf(o) {
    const t = todayStr(), s = o.steps || {};
    const late = o.eta && daysFrom(o.eta, t) > 0;
    switch (o.status) {
      case 'out': return { label: 'Out for delivery', cls: 's-now', when: o.eta && o.eta > t ? 'Expected ' + fmtDay(o.eta) : 'Today' };
      case 'shipped':
        if (late) return { label: 'Shipped', cls: 's-warn', when: 'Was due ' + fmtMD(o.eta) };
        return { label: 'Shipped', cls: '', when: o.eta ? 'Arrives ' + (o.etaEnd ? fmtRange(o.eta, o.etaEnd) : dayWord(o.eta) === 'today' ? 'today' : fmtDay(o.eta)) : s.shipped ? fmtMD(s.shipped) : '' };
      case 'ordered': return { label: 'Ordered', cls: '', when: [s.ordered || o.orderDate ? fmtMD(s.ordered || o.orderDate) : '', o.eta ? (o.kind === 'pickup' ? 'pickup ' : 'arrives ') + fmtMD(o.eta) : ''].filter(Boolean).join(' · ') };
      case 'pickup': return { label: 'Ready for pickup', cls: 's-now', when: o.pickupBy ? 'Until ' + fmtDay(o.pickupBy) : s.pickup ? 'Since ' + fmtMD(s.pickup) : '' };
      case 'delivered': return { label: 'Delivered', cls: 's-done', when: s.delivered ? fmtDay(s.delivered) : '' };
      case 'pickedup': return { label: 'Picked up', cls: 's-done', when: s.pickedup ? fmtDay(s.pickedup) : '' };
      case 'cancelled': return { label: 'Canceled', cls: 's-bad', when: '' };
      default: return { label: '', cls: '', when: '' };
    }
  }
  function checkReason(o) {
    if (o.issue) return o.issue + '.';
    if (stale(o)) return 'No news for ' + plural(Math.round(daysFrom(last(o), todayStr()) / 7), 'week') + '. Still on its way?';
    return 'Some details are a best guess.';
  }

  // ---------------------------------------------------------------------
  // Sheets (bottom sheets and pages), toast - the same behaviour as Notes
  // ---------------------------------------------------------------------
  const focusStack = [];
  const lockPage = () => document.documentElement.classList.toggle('locked', [...document.querySelectorAll('.sheetwrap')].some(w => !w.hidden));
  function openSheet(id) { focusStack.push(document.activeElement); $(id).hidden = false; lockPage(); }
  function closeSheet(id) { $(id).hidden = true; lockPage(); const f = focusStack.pop(); if (f && f.focus && document.contains(f)) f.focus(); }
  const closers = { opage: () => finishPage(), edSheet: () => cancelEdit() };
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
  // The filter's sliding glass thumb: the shared AllisonOS one (home/slide.js).
  const slide = (window.AllisonOS && window.AllisonOS.slide) || (() => {});
  const whenBox = $('whenChips');
  const slideWhen = jump => slide(whenBox, whenBox.querySelector('[aria-pressed="true"]'), 'when', { jump });
  window.addEventListener('resize', () => slideWhen(true));
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
  const LINKS = {
    mailApp: threadId => '../mailvintage/?thread=' + encodeURIComponent(threadId),
    gmailWeb: msgId => 'https://mail.google.com/mail/u/0/#all/' + encodeURIComponent(msgId),
  };
  const linkRow = (href, title, sub, icon) => '<a class="rowbtn" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer"><span class="ic">' + (icon || I.ext) + '</span><span>' + esc(title) + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</span></a>';

  // ---------------------------------------------------------------------
  // Render: the list
  // ---------------------------------------------------------------------
  const mono = o => '<span class="mono m' + hueOf(o) + '" aria-hidden="true">' + esc(initial(o)) + '</span>';
  function stepBar(o) {
    if (o.status === 'cancelled') return '';
    const steps = stepsOf(o), r = P.rank(o.status);
    return '<div class="osteps" style="grid-template-columns:repeat(' + steps.length + ',1fr)" aria-hidden="true">' + steps.map(s => '<i' + (P.rank(s) <= r ? ' class="on"' : '') + '></i>').join('') + '</div>';
  }
  function carrierRow(o) {
    if (needsCheck(o)) return '<div class="ocarrier"><span class="t">' + esc(checkReason(o)) + '</span></div>';
    if (o.carrier || o.tracking) return '<div class="ocarrier">' + (o.carrier ? '<span class="cpill">' + esc(o.carrier) + '</span>' : '') + (o.tracking ? '<span class="t">' + esc(o.tracking) + '</span>' : '') + '</div>';
    if (o.status === 'ordered' && o.kind !== 'pickup') return '<div class="ocarrier"><span class="t">Waiting for a shipping email</span></div>';
    return '';
  }
  function card(o, i) {
    const s = stateOf(o), warn = needsCheck(o);
    return '<button class="ocard' + (isOpen(o) ? '' : ' done') + '" type="button" data-o="' + esc(o.id) + '" style="--i:' + i + '">'
      + '<div class="otop">' + mono(o) + '<div class="omid"><div class="ostore">' + esc(o.store || 'Order') + '</div><div class="owhat">' + esc(whatOf(o)) + '</div></div>'
      + (o.total != null ? '<span class="oprice">' + esc(money(o.total, o.cur)) + '</span>' : '') + '</div>'
      + '<div class="ostate"><b class="' + (warn ? 's-warn' : s.cls) + '">' + esc(warn ? 'Check details' : s.label) + '</b><span class="when">' + esc(s.when) + '</span></div>'
      + stepBar(o) + carrierRow(o) + '</button>';
  }
  const byEta = (a, b) => (a.eta || '9999').localeCompare(b.eta || '9999') || last(b).localeCompare(last(a));
  const byRecent = (a, b) => last(b).localeCompare(last(a));
  function waySections(list) {
    const t = todayStr(), g = { today: [], pickup: [], way: [], ordered: [] };
    list.filter(isOpen).forEach(o => {
      if (o.status === 'out' || (o.status === 'shipped' && o.eta === t)) g.today.push(o);
      else if (o.status === 'pickup') g.pickup.push(o);
      else if (o.status === 'shipped') g.way.push(o);
      else g.ordered.push(o);
    });
    return [['Arriving today', g.today.sort(byEta)], ['Ready for pickup', g.pickup.sort(byEta)], ['On the way', g.way.sort(byEta)], ['Ordered', g.ordered.sort(byEta)]].filter(x => x[1].length);
  }
  function doneSections(list) {
    const t = todayStr(), groups = new Map();
    list.filter(o => !isOpen(o)).sort((a, b) => doneDay(b).localeCompare(doneDay(a))).forEach(o => {
      const d = doneDay(o), age = daysFrom(d || t, t);
      const label = !d ? 'Earlier' : age <= 7 ? 'This week' : d.slice(0, 7) === t.slice(0, 7) ? 'Earlier this month' : cap(dOf(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(o);
    });
    return [...groups.entries()];
  }
  function matches(o, q) {
    const hay = [o.store, o.orderNo, o.tracking, o.carrier, o.notes, ...(o.items || []).map(i => i.name)].join(' ').toLowerCase();
    return q.split(/\s+/).every(w => hay.includes(w));
  }
  function render() {
    const vis = orders.filter(kindOn);
    const way = vis.filter(isOpen), done = vis.filter(o => !isOpen(o)), check = vis.filter(needsCheck);
    const q = st.q.trim().toLowerCase();
    const chips = [['way', 'On the way', way.length], ['done', 'Delivered', done.length]];
    if (check.length) chips.push(['check', 'To check', check.length]);
    if (st.tab === 'check' && !check.length) st.tab = 'way';
    $('whenChips').innerHTML = chips.map(([k, t, n]) => '<button class="chip glass" type="button" data-when="' + k + '" aria-pressed="' + (!q && st.tab === k) + '">' + esc(t) + ' <span class="n">' + n + '</span></button>').join('');
    slideWhen();
    const sub = [];
    if (way.length) sub.push(way.length + ' on the way');
    if (st.scanning) sub.push('Reading Gmail…');
    else if (+ls.get(K.lastScan, 0)) sub.push('Gmail checked ' + ago(+ls.get(K.lastScan, 0)));
    if (syncCfg) sub.push(syncState === 'error' ? 'Not synced' : syncState === 'syncing' ? 'Syncing…' : 'Synced');
    $('sub').textContent = sub.join(' · ');
    $('qClear').hidden = !st.q;

    let h = '', i = 0;
    const group = (title, list) => '<p class="sechead"><span>' + esc(title) + '</span></p>' + list.map(o => card(o, i++)).join('');
    if (!orders.length) {
      h = '<div class="empty glass"><strong>No orders yet</strong>'
        + (hasGmail() ? 'Tap the envelope to look through Gmail for order, shipping and pickup emails.' : 'Connect Gmail and Orders finds your order, shipping and pickup emails by itself.')
        + '</div><button class="btn" type="button" id="emptyGo">' + (hasGmail() ? 'Look in Gmail now' : 'Connect Gmail') + '</button>'
        + '<button class="btn quiet" type="button" id="emptyAdd">Add an order by hand</button>';
    } else if (q) {
      const list = vis.filter(o => matches(o, q)).sort(byRecent);
      h = list.length ? '<p class="resulthead">' + plural(list.length, 'result') + '</p>' + list.map(o => card(o, i++)).join('') : '<div class="empty glass"><strong>No match</strong>Try a store, an item or an order number.</div>';
    } else if (st.tab === 'check') {
      h = '<p class="hint">These were read from the words of an email, or nothing has been heard about them for a while. Open each one, fix anything wrong and tap “Looks right”.</p>' + check.sort(byRecent).map(o => card(o, i++)).join('');
    } else if (st.tab === 'done') {
      const secs = doneSections(done);
      h = secs.length ? secs.map(([t, l]) => group(t, l)).join('') : '<div class="empty glass"><strong>Nothing delivered yet</strong>Orders move here once they arrive or you pick them up.</div>';
    } else {
      const secs = waySections(way);
      h = secs.length ? secs.map(([t, l]) => group(t, l)).join('') : '<div class="empty glass"><strong>Nothing on the way</strong>New orders in Gmail show up here after the next check (the envelope, top right).</div>';
    }
    $('list').innerHTML = h;
    if ($('emptyGo')) $('emptyGo').onclick = () => hasGmail() ? scan({ loud: true }) : openSettings();
    if ($('emptyAdd')) $('emptyAdd').onclick = () => openEdit();
    if (!$('opage').hidden && st.order) renderOrder();
  }
  $('whenChips').addEventListener('click', e => {
    const b = e.target.closest('[data-when]'); if (!b) return;
    st.tab = b.dataset.when; st.q = ''; $('q').value = ''; ls.set(K.tab, st.tab); render(); animateIn($('list'));
  });
  $('list').addEventListener('click', e => {
    const c = e.target.closest('[data-o]'); if (c) openOrder(c.dataset.o);
  });
  $('searchBtn').onclick = () => {
    st.search = !st.search; $('searchBar').hidden = !st.search; $('searchBtn').setAttribute('aria-pressed', String(st.search));
    if (st.search) $('q').focus(); else { st.q = ''; $('q').value = ''; render(); }
  };
  $('q').addEventListener('input', e => { st.q = e.target.value; render(); });
  $('qClear').onclick = () => { st.q = ''; $('q').value = ''; render(); $('q').focus(); };

  // ---------------------------------------------------------------------
  // One order
  // ---------------------------------------------------------------------
  function openOrder(id) {
    const o = orders.find(x => x.id === id); if (!o) return;
    st.order = o; renderOrder(); openSheet('opage');
  }
  function finishPage() { st.order = null; closeSheet('opage'); render(); }
  function headline(o) {
    const s = o.steps || {}, t = todayStr();
    const via = o.carrier ? ' with ' + o.carrier : '';
    switch (o.status) {
      case 'out': return { h: o.eta && o.eta > t ? 'Out for delivery, due ' + fmtDay(o.eta) : 'Out for delivery today', p: o.carrier ? 'On the truck with ' + o.carrier + '.' : '' };
      case 'shipped':
        if (o.eta && daysFrom(o.eta, t) > 0) return { h: 'Was due ' + fmtDay(o.eta), p: 'Shipped ' + fmtDay(s.shipped) + via + '. It may be late: check the carrier.' };
        return { h: o.eta ? 'Arrives ' + (o.etaEnd ? fmtRange(o.eta, o.etaEnd) : dayWord(o.eta) === 'today' || dayWord(o.eta) === 'tomorrow' ? dayWord(o.eta) : fmtDay(o.eta)) : 'On its way', p: (s.shipped ? 'Shipped ' + fmtDay(s.shipped) : 'Shipped') + via + '.' };
      case 'ordered': return { h: 'Ordered' + (s.ordered || o.orderDate ? ' ' + dayWord(s.ordered || o.orderDate) : ''), p: o.eta ? (o.kind === 'pickup' ? 'Pickup booked for ' : 'Expected ') + fmtDay(o.eta) + '.' : o.kind === 'pickup' ? 'Waiting for the store to say it’s ready.' : 'Waiting for a shipping email.' };
      case 'pickup': return { h: o.pickupBy ? 'Pick up by ' + fmtDay(o.pickupBy) : 'Ready for pickup', p: s.pickup ? 'Ready since ' + fmtDay(s.pickup) + '.' : '' };
      case 'delivered': return { h: 'Delivered' + (s.delivered ? ' ' + dayWord(s.delivered) : ''), p: o.carrier ? 'Delivered by ' + o.carrier + '.' : '' };
      case 'pickedup': return { h: 'Picked up' + (s.pickedup ? ' ' + dayWord(s.pickedup) : ''), p: '' };
      case 'cancelled': return { h: 'Canceled', p: 'This order was canceled.' };
      default: return { h: 'Order', p: '' };
    }
  }
  function renderOrder() {
    const o = st.order; if (!o) return;
    const hd = headline(o), steps = stepsOf(o), r = P.rank(o.status), s = o.steps || {};
    let h = '<div class="ohero"><div class="who">' + mono(o) + '<span>' + esc(o.store || 'Order') + '</span></div><h3>' + esc(hd.h) + '</h3>' + (hd.p ? '<p>' + esc(hd.p) + '</p>' : '') + '</div>';
    if (needsCheck(o)) h += '<div class="verify"><span>' + esc(checkReason(o)) + ' Check the details, then tap Looks right.</span><button class="textbtn" type="button" id="opOk">Looks right</button></div>';
    if (o.status !== 'cancelled') {
      h += '<ul class="otl" aria-label="Progress">' + steps.map((k, n) => {
        const on = P.rank(k) <= r, nextOn = steps[n + 1] && P.rank(steps[n + 1]) <= r;
        return '<li class="' + (on ? 'on' : 'todo') + (on && nextOn ? ' link' : '') + '"><span>' + esc(stepName(o, k)) + '</span><time>' + esc(s[k] ? fmtMD(s[k]) : '—') + '</time></li>';
      }).join('') + '</ul>';
    }
    const rows = [];
    if (o.carrier || o.tracking || o.status !== 'ordered') {
      rows.push('<div><dt>Carrier</dt><dd>' + esc(o.carrier || (o.kind === 'pickup' ? 'Store pickup' : '—')) + '</dd></div>');
      if (o.kind !== 'pickup') rows.push('<div><dt>Tracking number</dt><dd>' + (o.tracking ? esc(o.tracking) + ' <button class="copy" type="button" data-copy="' + esc(o.tracking) + '">Copy</button>' : '—') + '</dd></div>');
    }
    if (o.orderNo) rows.push('<div><dt>Order number</dt><dd>' + esc(o.orderNo) + '</dd></div>');
    if (o.orderDate) rows.push('<div><dt>Ordered</dt><dd>' + esc(fmtDay(o.orderDate)) + '</dd></div>');
    if (o.eta && isOpen(o)) rows.push('<div><dt>' + (o.kind === 'pickup' ? 'Pickup' : 'Expected') + '</dt><dd>' + esc(o.etaEnd ? fmtRange(o.eta, o.etaEnd) : fmtDay(o.eta)) + '</dd></div>');
    if (o.pickupBy && o.status === 'pickup') rows.push('<div><dt>Pick up by</dt><dd>' + esc(fmtDay(o.pickupBy)) + '</dd></div>');
    if (rows.length || o.trackUrl) {
      h += '<div class="obox">' + (rows.length ? '<dl class="okv">' + rows.join('') + '</dl>' : '');
      if (o.trackUrl && o.carrier) h += '<a class="ctabtn" href="' + esc(o.trackUrl) + '" target="_blank" rel="noopener noreferrer">Track on ' + esc(o.carrier) + I.ext + '</a>';
      h += '</div>';
    }
    if ((o.items || []).length || o.total != null) {
      h += '<div class="obox">' + (o.items || []).map(it => '<div class="oitem"><span>' + esc(it.name) + (it.qty > 1 ? '<small>Qty ' + it.qty + '</small>' : '') + '</span>' + (it.price ? '<b>' + esc(money(it.price, o.cur)) + '</b>' : '') + '</div>').join('');
      if (o.total != null) h += '<dl class="okv"><div class="total"><dt>Total</dt><dd>' + esc(money(o.total, o.cur)) + '</dd></div></dl>';
      h += '</div>';
    }
    if (o.notes) h += '<div class="obox"><p style="margin:8px 0;white-space:pre-line;overflow-wrap:anywhere">' + esc(o.notes) + '</p></div>';
    const acts = [];
    if (o.source && o.source.threadId) {
      acts.push('<a class="rowbtn" href="' + esc(LINKS.mailApp(o.source.threadId)) + '"><span class="ic">' + I.mail + '</span><span>Open the email in Mail Vintage<span class="sub">' + esc(o.source.subject || '') + '</span></span></a>');
      acts.push(linkRow(LINKS.gmailWeb(o.source.msgId), 'Open in Gmail', 'In the browser', I.ext));
    }
    if (o.source && o.source.msgId) acts.push('<button class="rowbtn" type="button" id="opAi"' + (st.aiBusy ? ' disabled' : '') + '><span class="ic">' + I.spark + '</span><span>' + (st.aiBusy ? 'Claude is reading it…' : 'Fix details with Claude') + '<span class="sub">Sends this one email’s text to Claude. Nothing is kept.</span></span></button>');
    acts.push('<button class="rowbtn" type="button" id="opEdit2"><span class="ic">' + I.edit + '</span><span>Edit details</span></button>');
    if (isOpen(o)) acts.push('<button class="rowbtn" type="button" id="opDelivered"><span class="ic">' + I.check + '</span><span>' + (o.kind === 'pickup' ? 'Mark as picked up' : 'Mark as delivered') + '</span></button>');
    h += '<div class="rgroup glass">' + acts.join('') + '</div>';
    if (o.source && o.source.from) h += '<p class="srcnote">From ' + esc(o.source.from.replace(/<[^>]*>/g, '').trim() || o.source.from) + (o.source.date ? ', ' + esc(new Date(o.source.date).toLocaleDateString('en-US')) : '') + '.' + (o.ai ? ' Details fixed with Claude.' : '') + (o.auto ? ' Marked as received in a one-off clean-up: nothing had been heard for over ' + CLEANUP_DAYS + ' days.' : '') + '</p>';
    h += '<button class="btn quiet danger" type="button" id="opDel">Delete order</button>';
    $('opBody').innerHTML = h;
  }
  $('opBack').onclick = finishPage; $('opDone').onclick = finishPage;
  $('opEdit').onclick = () => { if (st.order) openEdit(st.order.id); };
  $('opBody').addEventListener('click', async e => {
    const o = st.order; if (!o) return;
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      try { await navigator.clipboard.writeText(cp.dataset.copy); cp.textContent = 'Copied'; } catch { cp.textContent = 'Select it'; }
      setTimeout(() => { if (document.contains(cp)) cp.textContent = 'Copy'; }, 1400); return;
    }
    if (e.target.closest('#opOk')) { o.checked = true; o.guess = false; save(); renderOrder(); render(); toast('Thanks. Marked as checked.'); return; }
    if (e.target.closest('#opAi')) return aiFix(o);
    if (e.target.closest('#opEdit2')) return openEdit(o.id);
    if (e.target.closest('#opDelivered')) {
      const to = o.kind === 'pickup' ? 'pickedup' : 'delivered', before = JSON.parse(JSON.stringify(o));
      o.status = to; o.steps = { ...(o.steps || {}), [to]: (o.steps || {})[to] || todayStr() }; o.locks = { ...(o.locks || {}), status: true }; o.issue = ''; o.checked = true; o.guess = false;
      save(); renderOrder(); render();
      toast(o.kind === 'pickup' ? 'Marked as picked up' : 'Marked as delivered', () => { Object.assign(o, before); save(); if (st.order === o) renderOrder(); render(); });
      return;
    }
    if (e.target.closest('#opDel')) {
      const del = $('opDel');
      if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Tap again to delete'; setTimeout(() => { if (document.contains(del)) { delete del.dataset.armed; del.textContent = 'Delete order'; } }, 3500); return; }
      const gone = orders.find(x => x.id === o.id);
      orders = orders.filter(x => x.id !== o.id);
      st.order = null; closeSheet('opage'); save(); render();
      toast('Deleted. It won’t come back from the email.', () => { orders.push(gone); save(); render(); });
    }
  });

  // ---------------------------------------------------------------------
  // Fix with Claude: one email, read by Claude when the words-only reader got it wrong
  // (server: functions/orders/api; it is for signed-in family, and checks the answer)
  // ---------------------------------------------------------------------
  const AI_SAY = {
    signin: 'Sign in with Face ID to use Claude.', 'accounts-off': 'Family sign-in isn’t switched on yet, so Claude can’t be used.',
    'no-ai': 'Claude isn’t set up yet: the owner needs to add the AI key.', limit: 'That’s enough Claude for today. Try again tomorrow.',
    'ai-key': 'Anthropic didn’t accept the key. The owner can check it.', 'ai-busy': 'Claude is busy. Try again in a minute.',
    'ai-unreachable': 'Couldn’t reach Claude. Try again in a minute.', 'ai-refused': 'Claude wouldn’t read this one.',
    'ai-format': 'That didn’t come back right. Try again.', empty: 'There’s too little text in that email to read.',
    offline: 'No connection. Try again when you’re online.',
  };
  const AI_LABEL = { store: 'store', kind: 'kind', orderNo: 'order number', items: 'items', total: 'total', carrier: 'courier', tracking: 'tracking number', eta: 'expected date', etaEnd: 'expected date', pickupBy: 'pickup date', status: 'status' };
  async function aiCall(body) {
    const opts = { method: 'POST', cache: 'no-store', headers: { 'X-Orders': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const acct = window.AllisonOS && window.AllisonOS.account;
    let r;
    try { r = acct ? await acct.fetch('../orders/api/read', opts) : await fetch('../orders/api/read', opts); }
    catch { throw Object.assign(new Error('offline'), { code: 'offline' }); }
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) throw Object.assign(new Error(j.error || 'http-' + r.status), { code: j.error || (r.status === 404 ? 'no-ai' : 'server') });
    return j;
  }
  // What Claude found goes onto the order: whatever it found replaces what is there, except what
  // you edited (locked); a status only moves forward, unless the order was already marked as a guess.
  function applyAi(o, f) {
    const L = o.locks || {}, changed = [], flagged = needsCheck(o) || !!o.issue;
    const put = (k, v) => {
      if (L[k] || v == null || v === '' || (Array.isArray(v) && !v.length) || JSON.stringify(o[k]) === JSON.stringify(v)) return;
      o[k] = v; if (!changed.includes(AI_LABEL[k] || k)) changed.push(AI_LABEL[k] || k);
    };
    put('store', f.store); if (!L.store && f.store) o.storeKey = P.keyOf(o.store);
    put('kind', f.kind); put('orderNo', f.orderNo); put('items', f.items);
    if (f.total != null && !L.total) { put('total', f.total); if (f.cur) o.cur = f.cur; }
    put('carrier', f.carrier); put('tracking', f.tracking); put('eta', f.eta); put('etaEnd', f.etaEnd); put('pickupBy', f.pickupBy);
    if (f.status && !L.status && f.status !== o.status && o.status !== 'cancelled') {
      const up = P.rank(f.status) > P.rank(o.status);
      if (up || flagged || f.status === 'cancelled') {
        const day = o.source && o.source.date ? P.localYmd(o.source.date) : todayStr(), s = { ...(o.steps || {}) };
        if (!up && s[o.status] === day) delete s[o.status];          // the step the misreading added
        s[f.status] = s[f.status] || (f.status === 'delivered' && f.deliveredOn) || day;
        o.steps = s; o.status = f.status; changed.push('status');
      }
    }
    if ((o.carrier || o.tracking) && (changed.includes('courier') || changed.includes('tracking number'))) { const u = P.trackUrl(o.carrier, o.tracking); if (u) o.trackUrl = u; }
    if (o.status === 'delivered' || o.status === 'pickedup') o.issue = ''; else if (f.issue) o.issue = f.issue; else if (o.issue && changed.length) o.issue = '';
    o.guess = !!o.issue; o.ai = true;
    return changed;
  }
  // The email of an order, fetched again from Gmail, read by Claude: its facts, or null for "not an order".
  async function aiRead(o) {
    const msg = await gmail('/messages/' + o.source.msgId, { format: 'full' });
    const { html, text } = bodies(msg.payload);
    const fromHtml = html ? P.htmlToText(html) : '';
    const body = (fromHtml && fromHtml.length > text.length * 1.2 ? fromHtml : (text || fromHtml))
      .replace(/https?:\/\/\S+/g, '[link]').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 12000);
    const j = await aiCall({ subject: header(msg, 'subject'), from: header(msg, 'from'), date: +msg.internalDate || o.source.date, text: body });
    return j.fact || null;
  }
  // The first time Claude is used, say what is sent and ask. False if the answer is no.
  function aiAsk() {
    if (ls.get(K.aiOk, '')) return true;
    if (!confirm('Claude will read the email of an order to fix its details. The text, without links, goes to Anthropic through the family server. It isn’t kept, and nothing else is sent.\n\nContinue?')) return false;
    ls.set(K.aiOk, '1'); return true;
  }
  async function aiFix(o) {
    if (st.aiBusy || st.sorting || !o.source || !o.source.msgId) return;
    if (!getToken()) { toast('Connect Gmail in Settings first, so Orders can open the email.'); return; }
    if (!aiAsk()) return;
    st.aiBusy = true; renderOrder();
    const before = JSON.parse(JSON.stringify(o));
    try {
      const f = await aiRead(o);
      if (!f) toast('Claude doesn’t think that email is about an order.');
      else {
        const changed = applyAi(o, f);
        save();
        toast(changed.length ? 'Claude updated the ' + [...new Set(changed)].slice(0, 4).join(', ') + '.' : 'Claude agrees with what’s there.',
          changed.length ? () => { Object.keys(o).forEach(k => { if (!(k in before)) delete o[k]; }); Object.assign(o, before); save(); if (st.order === o) renderOrder(); render(); } : null, 6000);
      }
    } catch (e) {
      if (e instanceof AuthError) { toast('Gmail needs you to sign in again.'); openSettings(); }
      else toast(AI_SAY[e.code] || (e.code ? 'Something went wrong. Try again in a minute.' : e.message));
    } finally {
      st.aiBusy = false; if (st.order === o) renderOrder(); render();
    }
  }

  // ---------------------------------------------------------------------
  // A one-off clean-up (not a rule): the first time Orders opens after a full read of Gmail, every open
  // order nothing has been heard about for more than CLEANUP_DAYS is marked received (delivered, or picked
  // up for a pickup), because many stores never send a "delivered" email. Orders still expected, a pickup
  // still being held, and an order whose status you set by hand are left alone. Once per phone; Undo in the toast.
  // ---------------------------------------------------------------------
  function cleanupOnce() {
    if (ls.get(K.cleanup, '') || !orders.length) return;
    ls.set(K.cleanup, '1');
    const t = todayStr(), hit = [];
    orders.forEach(o => {
      if (!isOpen(o) || (o.locks && o.locks.status)) return;
      if (o.eta && o.eta >= t) return;
      if (o.status === 'pickup' && o.pickupBy && o.pickupBy >= t) return;
      const l = last(o);
      if (!l || daysFrom(l, t) <= CLEANUP_DAYS) return;
      hit.push([o, JSON.parse(JSON.stringify(o))]);
      const to = o.kind === 'pickup' ? 'pickedup' : 'delivered';
      o.steps = { ...(o.steps || {}), [to]: l }; o.status = to; o.issue = ''; o.guess = false; o.auto = true;
    });
    if (!hit.length) return;
    save(); render();
    toast('Marked ' + plural(hit.length, 'old order') + ' as received.', () => {
      hit.forEach(([o, b]) => { Object.keys(o).forEach(k => { if (!(k in b)) delete o[k]; }); Object.assign(o, b); o.locks = { ...(o.locks || {}), status: true }; });
      save(); if (st.order) renderOrder(); render();
    }, 7000);
  }

  // ---------------------------------------------------------------------
  // Edit an order, or add one by hand
  // ---------------------------------------------------------------------
  const FIELDS = [
    ['store', 'Store', 'Where you bought it', 'text', true],
    ['items', 'Items', 'One per line, e.g. 2 x Phone case', 'textarea', true],
    ['total', 'Total', '0.00', 'number'], ['orderNo', 'Order number', '', 'text'],
    ['orderDate', 'Ordered', '', 'date'], ['eta', 'Expected', '', 'date'],
    ['carrier', 'Carrier', '', 'select'], ['tracking', 'Tracking number', '', 'text'],
    ['status', 'Status', '', 'select'], ['kind', 'Kind', '', 'select'],
    ['pickupBy', 'Pick up by', '', 'date'],
  ];
  const itemsText = it => (it || []).map(i => (i.qty > 1 ? i.qty + ' x ' : '') + i.name).join('\n');
  function parseItems(text, old) {
    const prev = new Map((old || []).map(i => [i.name.toLowerCase(), i]));
    return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const m = /^(\d{1,3})\s*[x×]\s*(.+)$/i.exec(l), name = (m ? m[2] : l).trim(), q = m ? +m[1] : 1, p = prev.get(name.toLowerCase());
      return { name, ...(q > 1 ? { qty: q } : {}), ...(p && p.price ? { price: p.price } : {}) };
    });
  }
  function openEdit(id) {
    const o = id ? orders.find(x => x.id === id) : null;
    st.isNew = !o;
    st.edit = o ? JSON.parse(JSON.stringify(o)) : { id: '', store: '', items: [], status: 'ordered', kind: 'package', steps: { ordered: todayStr() }, orderDate: todayStr(), notes: '', locks: {} };
    renderEdit(); openSheet('edSheet');
  }
  function renderEdit() {
    const o = st.edit;
    $('edLbl').textContent = st.isNew ? 'New order' : 'Edit order';
    const statuses = (o.kind === 'pickup' ? ['ordered', 'pickup', 'pickedup', 'cancelled'] : ['ordered', 'shipped', 'out', 'delivered', 'cancelled']);
    if (!statuses.includes(o.status)) statuses.push(o.status);
    let h = '<div class="box glass"><div class="kv">' + FIELDS.map(([k, label, ph, type, wide]) => {
      let ctl;
      if (type === 'textarea') ctl = '<textarea id="ef_' + k + '" data-k="' + k + '" placeholder="' + esc(ph) + '" style="min-height:84px">' + esc(itemsText(o.items)) + '</textarea>';
      else if (k === 'carrier') ctl = '<select id="ef_carrier" data-k="carrier"><option value=""></option>' + CARRIERS.concat(o.carrier && !CARRIERS.includes(o.carrier) ? [o.carrier] : []).map(c => '<option' + (o.carrier === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>';
      else if (k === 'status') ctl = '<select id="ef_status" data-k="status">' + statuses.map(s => '<option value="' + s + '"' + (o.status === s ? ' selected' : '') + '>' + esc(P.STATUS_NAMES[s] || s) + '</option>').join('') + '</select>';
      else if (k === 'kind') ctl = '<select id="ef_kind" data-k="kind">' + KIND_ROWS.map(([v, t]) => '<option value="' + v + '"' + ((o.kind || 'package') === v ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>';
      else if (k === 'pickupBy' && o.kind !== 'pickup') return '';
      else ctl = '<input id="ef_' + k + '" data-k="' + k + '" type="' + (type === 'number' ? 'text' : type) + '"' + (type === 'number' ? ' inputmode="decimal"' : '') + ' value="' + esc(k === 'total' ? (o.total != null ? o.total : '') : o[k] || '') + '" placeholder="' + esc(ph) + '" autocomplete="off">';
      return '<div class="f' + (wide ? ' w' : '') + '"><label for="ef_' + k + '">' + esc(label) + '</label>' + ctl + '</div>';
    }).join('') + '<div class="f w"><label for="ef_notes">Notes</label><textarea id="ef_notes" data-k="notes" placeholder="Anything to remember">' + esc(o.notes || '') + '</textarea></div></div></div>';
    if (!st.isNew) h += '<p class="hint">What you type here stays: an email that arrives later won’t change it.</p>';
    $('edBody').innerHTML = h;
  }
  $('edBody').addEventListener('change', e => { if (e.target.id === 'ef_kind') { readEdit(); renderEdit(); } });
  function readEdit() {
    const o = st.edit, old = st.isNew ? null : orders.find(x => x.id === o.id) || {};
    $('edBody').querySelectorAll('[data-k]').forEach(inp => {
      const k = inp.dataset.k; let v = inp.value.trim();
      if (k === 'items') { o.items = parseItems(inp.value, (old && old.items) || o.items); return; }
      if (k === 'total') { const n = parseFloat(v.replace(/[^0-9.]/g, '')); o.total = isNaN(n) ? null : n; return; }
      o[k] = v;
    });
    return old;
  }
  function cancelEdit() { st.edit = null; closeSheet('edSheet'); }
  $('edDone').onclick = () => {
    const old = readEdit(), o = st.edit;
    if (st.isNew) {
      if (!o.store && !(o.items || []).length) { toast('Not added: it needs a store or an item.'); return; }
      o.id = 'h-' + P.hash(Date.now() + Math.random() + o.store);
      o.storeKey = P.keyOf(o.store); o.created = Date.now(); o.checked = true; o.guess = false; o.source = null;
      o.steps = { ordered: o.orderDate || todayStr() };
      if (o.status !== 'ordered') o.steps[o.status] = todayStr();
      o.locks = {}; ['store', 'items', 'total', 'orderNo', 'eta', 'carrier', 'tracking', 'status', 'kind', 'pickupBy'].forEach(k => { if (o[k] != null && o[k] !== '' && !(Array.isArray(o[k]) && !o[k].length)) o.locks[k] = true; });
      if (o.carrier && o.tracking) o.trackUrl = P.trackUrl(o.carrier, o.tracking);
      orders.push(o); save(); toast('Added');
    } else {
      const i = orders.findIndex(x => x.id === o.id);
      if (i >= 0) {
        const cur = orders[i], locks = { ...(cur.locks || {}) };
        ['store', 'items', 'total', 'orderNo', 'orderDate', 'eta', 'carrier', 'tracking', 'status', 'kind', 'pickupBy'].forEach(k => {
          if (JSON.stringify(cur[k] == null ? '' : cur[k]) !== JSON.stringify(o[k] == null ? '' : o[k])) locks[k] = true;
        });
        const next = { ...cur, ...o, locks, steps: { ...(cur.steps || {}) } };
        next.storeKey = P.keyOf(next.store);
        if (next.status !== cur.status && next.status !== 'cancelled') next.steps[next.status] = next.steps[next.status] || todayStr();
        if (next.carrier !== cur.carrier || next.tracking !== cur.tracking) next.trackUrl = next.carrier && next.tracking ? P.trackUrl(next.carrier, next.tracking) : '';
        next.checked = true; next.guess = false;
        if (JSON.stringify(next) !== JSON.stringify(cur)) { orders[i] = next; if (st.order && st.order.id === next.id) st.order = next; save(); }
      }
    }
    st.edit = null; closeSheet('edSheet'); render();
  };
  $('fab').onclick = () => openEdit();

  // ---------------------------------------------------------------------
  // Paste: an order email, or a Sheet setup link
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
    if (!r.orders.length) {
      $('psText').value = text; $('psHint').textContent = 'No order found in that text. Add it by hand with the + button instead.';
      if ($('pasteSheet').hidden) openSheet('pasteSheet');
      return;
    }
    const res = r.orders.map(f => { f.guess = true; return P.upsert(orders, f, { graves, revive }); });
    save(); render();
    const n = res.filter(x => x === 'new').length;
    toast(n ? 'Added ' + plural(n, 'order') + '. Check the details.' : 'Already here.');
    if (r.orders.length === 1) { const o = orders.find(x => x.id === r.orders[0].id) || orders[orders.length - 1]; if (o) openOrder(o.id); }
  }
  $('pasteBtn').onclick = pasteIn;
  $('psAdd').onclick = () => { const t = $('psText').value; if (!t.trim()) return; if (takeSetupLink(t)) { closeSheet('pasteSheet'); return; } closeSheet('pasteSheet'); readPasted(t); };

  let revive = new Set();   // ids "Read the last year again" cleared, which may come back

  // ---------------------------------------------------------------------
  // Gmail: sign-in (as Mail does it) and reading
  // ---------------------------------------------------------------------
  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');
  class AuthError extends Error {}
  function ownToken() {
    try { const o = JSON.parse(ls.get(K.token, 'null')); if (o && o.exp > Date.now()) return o; } catch {}
    return null;
  }
  // Opened from AllisonOS Home, Orders', Mail's and Mail Vintage's sign-ins are in the same storage;
  // their permission (read, label, move) covers reading, so there's no second sign-in while one is fresh.
  function mailToken() {
    for (const k of ['orders.token', 'mail.token', 'mailv.token']) {
      try { const o = JSON.parse(ls.get(k, 'null')); if (o && o.exp > Date.now() && /gmail\.(modify|readonly)|mail\.google\.com/.test(o.scope || '')) return o; } catch {}
    }
    return null;
  }
  const getToken = () => ownToken() || mailToken();
  // A quiet sign-in happens by itself only if the last one didn't fail in the
  // past 12 hours, so a Google that wants a tap never causes a redirect on every open.
  const mayRenew = () => !!ls.get(K.token + '.ever', '') && Date.now() - +ls.get(K.lastAuth, 0) > 60e3 && Date.now() - +ls.get(K.silentFail, 0) > 12 * H;
  const hasGmail = () => !!getToken() || !!ls.get(K.token + '.ever', '') || !!ls.get('orders.token.ever', '') || !!ls.get('mail.token.ever', '') || !!ls.get('mailv.token.ever', '');
  function signIn(opts = {}) {
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    ls.set(K.state, nonce); ls.set(K.lastAuth, String(Date.now()));
    const hint = ls.get(K.hint, '') || ls.get('orders.hint', '') || ls.get('mail.hint', '');
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
    toast('Signed out of Gmail. Your orders stay.');
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
    let added = 0, changed = 0, read = 0, more = false;
    try {
      if (!ls.get(K.me, '')) gmail('/profile').then(p => { if (p && p.emailAddress) { ls.set(K.me, p.emailAddress); ls.set(K.hint, p.emailAddress); } }).catch(() => {});
      const ids = [];
      let pageToken;
      do {
        const r = await gmail('/messages', { q: since + ' ' + QUERY, maxResults: 100, pageToken });
        (r.messages || []).forEach(m => ids.push(m));
        pageToken = r.nextPageToken;
      } while (pageToken && ids.length < 4000);
      const fresh = ids.filter(m => !seen.has(m.id));
      more = fresh.length > MAX_SCAN;
      const todo = fresh.slice(0, MAX_SCAN);                      // newest first
      st.scanTotal = todo.length; st.scanDone = 0;
      await pool(todo, 4, async m => {
        let msg;
        try { msg = await gmail('/messages/' + m.id, { format: 'full' }); }
        catch (e) { if (e instanceof AuthError) throw e; return; }        // one bad message doesn't stop the rest
        const { html, text } = bodies(msg.payload);
        let doc = null;
        if (html && /itemscope/i.test(html) && window.DOMParser) { try { doc = new DOMParser().parseFromString(html, 'text/html'); } catch {} }
        const r = P.parseEmail({ html, text, doc, subject: header(msg, 'subject'), from: header(msg, 'from'), date: +msg.internalDate || Date.now(), id: msg.id, threadId: msg.threadId });
        r.orders.forEach(f => {
          if (kinds[f.kind] === false) { skipped[m.id] = f.kind; return; }   // switched off in Settings: remembered, so turning it on reads it
          const x = P.upsert(orders, f, { graves, revive });
          if (x === 'new') added++; else if (x === 'changed') changed++;
        });
        seen.add(m.id); read++;
        st.scanDone++;
        if (st.scanDone % 10 === 0) busyPill('Reading Gmail · ' + st.scanDone + ' of ' + st.scanTotal);
      });
      if (!more) { ls.set(K.lastScan, String(startedAt)); ls.set(K.queryV, QUERY_V); }
    } catch (e) {
      scanErr = e instanceof AuthError ? 'auth' : e.message;
    } finally {
      saveSeen(); save(); revive = new Set();
      if (!scanErr && !more) cleanupOnce();
      st.scanning = false;
      render();
      if (scanErr === 'auth') { busyPill(); if (loud) { toast('Gmail needs you to sign in again.'); openSettings(); } else if (mayRenew()) signIn({ silent: true }); }
      else if (scanErr) { busyPill(); if (loud) toast(scanErr); }
      else if (more) { busyPill('Reading Gmail · more to read'); setTimeout(() => scan({ loud: false }), 400); }
      else {
        const bits = [];
        if (added) bits.push(plural(added, 'new order'));
        if (changed) bits.push(plural(changed, 'update'));
        pillDone(bits.length ? bits.join(', ') : 'Up to date');
        if (loud && !bits.length) toast(read ? 'Read ' + plural(read, 'email') + '. Nothing new.' : 'Nothing new in Gmail.');
      }
    }
  }
  $('scanBtn').onclick = () => scan({ loud: true });
  // Due every half hour, and straight away once the search has widened.
  const scanDue = () => ls.get(K.queryV, '') !== QUERY_V || Date.now() - +ls.get(K.lastScan, 0) > 30 * 6e4;

  // ---------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------
  function renderSettings() {
    const own = ownToken(), viaMail = !own && mailToken(), ever = ls.get(K.token + '.ever', '');
    const me = ls.get(K.me, '');
    $('stKinds').innerHTML = KIND_ROWS.map(([k, t, sub]) => k === 'package'
      ? '<div class="swrow"><span class="grow">' + esc(t) + '<span class="sub">' + esc(sub) + '</span></span><span class="fixed">Always on</span></div>'
      : '<button class="swrow" type="button" role="switch" aria-checked="' + (kinds[k] !== false) + '" data-kind="' + k + '"><span class="grow">' + esc(t) + '<span class="sub">' + esc(sub) + '</span></span><span class="switch" aria-hidden="true"></span></button>').join('');
    let rows = '';
    if (own || viaMail || ever) {
      rows += '<button class="rowbtn" type="button" id="stScan"><span class="ic">' + I.mail + '</span><span>Look for new orders now<span class="sub">'
        + esc(+ls.get(K.lastScan, 0) ? 'Last checked ' + ago(+ls.get(K.lastScan, 0)) + '.' : 'Not checked yet.') + ' It also checks each time Orders opens.</span></span></button>';
      rows += '<button class="rowbtn" type="button" id="stRescan"><span class="ic">' + I.refresh + '</span><span>Read the last year again<span class="sub">Reads every order email afresh and replaces what was read before. Orders you edited, checked or deleted stay as they are.</span></span></button>';
      if (own || ever) rows += '<button class="rowbtn" type="button" id="stOut"><span class="ic">' + I.out + '</span><span>Sign out of Gmail<span class="sub">' + esc(me || 'Signed in') + '</span></span></button>';
    } else {
      rows += '<button class="rowbtn" type="button" id="stIn"><span class="ic">' + I.mail + '</span><span>Connect Gmail<span class="sub">Read-only: Orders can read email, never send, change or delete it</span></span></button>';
    }
    $('stGmail').innerHTML = rows;
    $('stGmailHint').textContent = viaMail ? 'Using the sign-in Orders or Mail already has in this browser. Orders Vintage only reads.'
      : 'Orders looks for order, shipping and pickup emails in the last year of email (Mail’s Orders tag, and the big stores and carriers), then for new ones each time it opens. Promotions are skipped.';
    $('stSheetSub').textContent = !syncCfg ? 'Not connected' : syncState === 'error' ? (SYNC_ERRORS[syncErr] || 'Not synced') : lastSyncAt ? 'Last synced ' + ago(lastSyncAt) : 'Connected';
  }
  function openSettings() { renderSettings(); openSheet('setSheet'); }
  $('setBtn').onclick = openSettings;
  $('stKinds').addEventListener('click', e => {
    const b = e.target.closest('[data-kind]'); if (!b) return;
    const k = b.dataset.kind, on = !(kinds[k] !== false);
    kinds[k] = on; persist(); renderSettings(); render();
    if (!on) return;
    // Turned on: read again the mail that was passed over while it was off.
    let n = 0;
    Object.keys(skipped).forEach(id => { if (skipped[id] === k) { delete skipped[id]; seen.delete(id); n++; } });
    saveSeen();
    if (n && getToken()) { closeSheet('setSheet'); scan({ loud: true }); toast('Looking for ' + plural(n, 'email') + ' that were skipped.'); }
    else if (!getToken() && hasGmail()) toast('Connect Gmail again to look for them.');
  });
  $('stGmail').addEventListener('click', e => {
    if (e.target.closest('#stIn')) signIn({ choose: true });
    else if (e.target.closest('#stScan')) { closeSheet('setSheet'); scan({ loud: true }); }
    else if (e.target.closest('#stRescan')) {
      // Start over: orders read from email (and not edited or checked by
      // you) are cleared and read again, so an improved reader replaces its
      // old mistakes. Anything not found again stays gone, on both phones.
      const auto = orders.filter(o => o.source && o.source.msgId && !Object.keys(o.locks || {}).length && !o.checked);
      revive = new Set(auto.map(o => o.id));
      orders = orders.filter(o => !revive.has(o.id));
      save();
      seen = new Set(); skipped = {}; saveSeen(); ls.del(K.lastScan); closeSheet('setSheet'); scan({ loud: true });
    }
    else if (e.target.closest('#stOut')) signOut();
  });
  $('stSheet').onclick = () => { closeSheet('setSheet'); openSyncSheet(); };
  $('stExport').onclick = async () => {
    const file = new File([JSON.stringify({ app: 'allison-orders', v: 1, kind: 'backup', saved: new Date().toISOString(), orders }, null, 2)], 'ordersvintage-backup-' + todayStr() + '.json', { type: 'application/json' });
    const r = await shareOut(file, 'Orders backup');
    toast({ shared: 'Backup saved', downloaded: 'Backup saved to Downloads', cancelled: 'Backup canceled' }[r] || 'Couldn’t save the backup');
  };
  $('stImport').onclick = () => $('stFile').click();
  $('stFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); } catch { toast('That file isn’t an Orders backup.'); return; }
    if (!data || data.app !== 'allison-orders' || !Array.isArray(data.orders)) { toast('That file isn’t an Orders backup.'); return; }
    const have = new Set(orders.map(o => o.id));
    const ok = o => o && typeof o.id === 'string' && o.status in P.STATUS_NAMES;
    const add = data.orders.filter(o => ok(o) && !have.has(o.id));
    orders.push(...add);
    save(); render(); closeSheet('setSheet');
    toast('Restored ' + plural(add.length, 'order'));
  });

  // ---------------------------------------------------------------------
  // Google Sheet sync - the same as Notes' and Travel's, for orders
  // ---------------------------------------------------------------------
  let syncing = false, syncAgain = false, syncTimer = null, syncState = syncCfg ? 'idle' : 'off', syncErr = '', errShown = false;
  let lastSyncAt = +ls.get(K.syncAt, 0) || 0;
  const SYNC_ERRORS = {
    'wrong-secret': 'The secret code doesn’t match the script’s. If you changed SECRET after deploying, the web app still has the old one: Deploy → Manage deployments → ✏️ → Version: New version → Deploy. Also check the phone didn’t fill in the Notes or Travel code.',
    'old-script': 'The Sheet is running an old copy of the script. Deploy → Manage deployments → ✏️ → Version: New version → Deploy, then try again.',
    'secret-not-set': 'The script still says SECRET = ‘CHANGE-ME’. Change it, save, and deploy a new version.',
    'busy': 'The Sheet was busy. Trying again shortly.',
    'bad-request': 'The Sheet didn’t understand the request.',
    'network': 'Couldn’t reach the Sheet. Check the link, or you may be offline.',
    'not-json': 'That link didn’t answer like the Orders script. Check it ends in /exec and “Who has access” is Anyone.',
    'wrong-app': 'That’s another app’s Sheet link. Orders needs the web app link from the AllisonOS - Orders Sheet (Extensions → Apps Script → Deploy → Manage deployments).',
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
    // Only orders with a status this app knows, as the backup import requires.
    orders = mergeKind('orders', orders, (res.orders || []).filter(o => o && o.status in P.STATUS_NAMES));
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
          body: JSON.stringify({ secret: syncCfg.secret, action: 'sync', v: 1, orders, graves }) });
      } catch { throw new Error('network'); }
      try { res = await r.json(); } catch { throw new Error('not-json'); }
      if (res && res.ok && res.app && res.app !== 'allison-orders-sync') throw new Error('wrong-app');
      if (res && res.error === 'wrong-secret' && res.app !== 'allison-orders-sync') throw new Error(await whichScript(syncCfg.url));
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
  // A "wrong secret" from a script that doesn't say it's Orders': ask the
  // link which app it belongs to (every script answers a plain GET with its name).
  async function whichScript(url) {
    try {
      const r = await fetch(url, { cache: 'no-store', redirect: 'follow' });
      const d = await r.json();
      if (d && d.app && d.app !== 'allison-orders-sync') return 'wrong-app';
      if (d && d.app === 'allison-orders-sync') return 'old-script';
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
    if (!$('listView').hidden) { const sub = $('sub').textContent; if (/Sync/.test(sub) || on) render(); }
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
    toast('Connected. ' + plural(orders.length, 'order') + ' now in the Sheet.');
  };
  $('syNow').onclick = async () => { if (await sync(true)) toast('Synced'); };
  $('syShare').onclick = async () => {
    const link = location.href.split('#')[0] + '#sync=' + b64e(JSON.stringify({ u: syncCfg.url, s: syncCfg.secret }));
    try { await navigator.clipboard.writeText(link); toast('Setup link copied. On the other phone: copy it, open Orders and tap the clipboard button. Keep it private.', null, 6000); }
    catch { toast('Copy isn’t available here.'); }
  };
  $('syOff').onclick = () => {
    const b = $('syOff');
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to disconnect'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Disconnect this phone'; }, 3500); return; }
    delete b.dataset.armed; b.textContent = 'Disconnect this phone';
    syncCfg = null; syncState = 'off'; saveSyncCfg(); renderSyncStatus();
    toast('Disconnected. Your orders stay on this phone and in the Sheet.');
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
    render();
  });
  window.addEventListener('online', () => { if (syncCfg) sync(false); });

  // ---------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------
  const back = consumeRedirect();
  if (location.hash.startsWith('#sync=')) { const h = location.hash; history.replaceState(null, '', location.pathname + location.search); setTimeout(() => takeSetupLink(h), 300); }
  if (+ls.get(K.lastScan, 0)) cleanupOnce();
  render();
  if (back && back.error) {
    if (!(back.silent && /^(interaction|login|consent|account_selection)_required$/.test(back.error))) toast(back.error === 'access_denied' ? 'Gmail access was declined.' : 'Gmail sign-in didn’t work (' + back.error + ').', null, 6000);
    else toast('Gmail needs one tap to sign in again: Settings → Connect Gmail.', null, 6000);
  }
  // Read Gmail on open: always after a sign-in, else if it's been a while.
  if (getToken() && (back && back.ok || scanDue())) setTimeout(() => scan({ loud: !!(back && back.ok) }), 400);
  else if (!getToken() && mayRenew() && Date.now() - +ls.get(K.lastScan, 0) > 6 * H) setTimeout(() => signIn({ silent: true }), 800);
  if (syncCfg) { setTimeout(() => sync(false), 600); keep.get('sync').then(c => { if (!c || c.url !== syncCfg.url || c.secret !== syncCfg.secret) saveSyncCfg(); }); }
  else keep.get('sync').then(c => {
    if (syncCfg || !c || !c.url || !c.secret) return;
    syncCfg = { url: c.url, secret: c.secret }; syncState = 'idle'; ls.set(K.sync, JSON.stringify(syncCfg));
    sync(false); toast('Reconnected to the Google Sheet from this phone’s backup copy.');
  });
  // Refresh "today" and "was due" labels while open.
  setInterval(() => { if (document.visibilityState === 'visible') render(); }, 5 * 6e4);
  // "Updated" pill, once, when a new version arrives (as in Notes).
  (function () {
    const src = [...document.querySelectorAll('style')].map(e => e.textContent).join('') + String(document.scripts.length);
    let h = 2166136261;
    for (let i = 0; i < src.length; i++) { h ^= src.charCodeAt(i); h = Math.imul(h, 16777619); }
    const ver = (h >>> 0).toString(36) + (window.ORDERS_BUILD || ''), VK = KEY + '-version';
    const prev = ls.get(VK, null);
    ls.set(VK, ver);
    if (!prev || prev === ver) return;
    const pill = $('updPill'); pill.hidden = false;
    setTimeout(() => { pill.classList.add('out'); setTimeout(() => { pill.hidden = true; pill.classList.remove('out'); }, 450); }, 5000);
  })();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // For the tests (ordersvintage/scripts/app-test.mjs) only.
  window.__orders = { get orders() { return orders; }, tidy: cleanupOnce, get kinds() { return kinds; }, upsert: f => P.upsert(orders, f, { graves, revive }), render, scan, save, needsCheck, stale };
})();
