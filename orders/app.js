"use strict";

// Orders: everything you've bought, and where it is.
//
// - Orders come from Gmail (read on the phone, read-only), from a pasted
//   email, or typed in. parse.js does the reading: an order confirmation, its
//   shipping email, the carrier's own notice and the delivery email end up as
//   one order, whatever order they are read in.
// - Tracking opens the carrier's own page (no lookups, no keys, no cost).
// - The family's Google Sheet is the record (aOS/SHEETS.md): one Sheet for
//   everyone's orders, each person's phone getting only their own, through aOS
//   (signed in). The phone keeps the last 90 days and every order still on
//   its way; older ones come from the Sheet when you look back.
// - Packages and store pickups show by default; food, subscriptions and
//   tickets can be switched on in Settings.
// - Two designs, picked in Settings > Design: Vintage (the default) and Standard
//   (Sea glass), kept on this phone (../home/design.js, as in Clock).

// Refuse to run inside another site's frame; this same site may (see Mail's app.js for why).
if (window.top !== window.self && (() => { try { return window.top.location.origin !== location.origin; } catch { return true; } })()) {
  document.body.textContent = 'Orders can’t be opened inside another page.';
  throw new Error('Orders refuses to run inside a frame');
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
  // Mail's OAuth client (not a secret: see mail/app.js). Orders' own address
  // must be added to it as a redirect URI once - orders/README.md, "Gmail".
  // The old Orders Vintage address (which opens this same app) is already there.
  const CLIENT_ID = '804406956056-e91hbdndc4cqgerh9sffl9fmt76nfpua.apps.googleusercontent.com';
  const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
  const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
  const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
  const KEY = 'allison-orders-v1';
  const K = {
    token: 'orders.token', state: 'orders.state', silent: 'orders.silent', silentFail: 'orders.silentFail', lastAuth: 'orders.lastAuth', hint: 'orders.hint', me: 'orders.me',
    seen: KEY + '-seen', skipped: KEY + '-skipped', lastScan: KEY + '-scan', queryV: KEY + '-query-v', returnsV: KEY + '-returns-v', tab: KEY + '-tab',
    sync: KEY + '-sync', graves: KEY + '-graves', syncAt: KEY + '-sync-at', log: KEY + '-log', logSeed: KEY + '-log-seed',
    family: KEY + '-family', notMine: KEY + '-not-mine',
    aiOk: KEY + '-ai-ok', ipsyAuto: KEY + '-ipsy-auto', ipsyTried: KEY + '-ipsy-tried',
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
  const SUBJECTS = ['order', '"your package"', 'shipped', 'shipping', 'shipment', 'delivered', 'delivery', 'tracking', 'pickup', '"pick up"', 'receipt', 'purchase', 'invoice', '"ready for"',
    'return', 'returns', 'returned', 'refund', 'refunded', 'RMA'];
  const QUERY = '-in:chats -in:spam -in:trash -label:Travel {label:Orders (-category:promotions {' + SUBJECTS.map(s => 'subject:' + s).join(' ') + ' ' + SENDERS.map(s => 'from:' + s).join(' ') + '})}';
  const QUERY_V = '2';               // when QUERY widens, the next scan looks back FIRST_SCAN once more
  // Returns arrived with QUERY_V 2. Return emails read before then (Amazon's, say) were read as orders,
  // so the year's return emails are read once more, even if already seen.
  const RETURNS_Q = '-in:chats -in:spam -in:trash -label:Travel {subject:return subject:returns subject:returned subject:refund subject:refunded subject:RMA}';
  const RETURNS_V = '1';

  const I = {
    mail: '<svg viewBox="0 0 24 24"><rect x="2.8" y="5" width="18.4" height="14" rx="3.4"/><path d="M3.6 7.4l7.2 5a2 2 0 0 0 2.4 0l7.2-5"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M13.6 4h6.4v6.4"/><path d="M20 4l-9 9"/><path d="M17.6 13.6v3.6a2.8 2.8 0 0 1-2.8 2.8H6.8A2.8 2.8 0 0 1 4 17.2V9.2a2.8 2.8 0 0 1 2.8-2.8h3.6"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M20 11.2a8 8 0 0 0-14.6-4.4L4 8.4"/><path d="M4 3.8v4.6h4.6"/><path d="M4 12.8a8 8 0 0 0 14.6 4.4l1.4-1.6"/><path d="M20 20.2v-4.6h-4.6"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M9.6 20H6.8A2.8 2.8 0 0 1 4 17.2V6.8A2.8 2.8 0 0 1 6.8 4h2.8"/><path d="M15.4 16.6l4.1-4.1a.7.7 0 0 0 0-1l-4.1-4.1M19.6 12H9.4"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19.2 8.8a2.4 2.4 0 0 0 0-3.4l-.6-.6a2.4 2.4 0 0 0-3.4 0L4 16z"/><path d="M13.6 6.4l4 4"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M11 3.6l1.9 5.1 5.1 1.9-5.1 1.9L11 17.6l-1.9-5.1L4 10.6l5.1-1.9z"/><path d="M18.4 15.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/></svg>',
    box: '<svg viewBox="0 0 24 24"><path d="M3.8 8.2L12 4l8.2 4.2v7.6L12 20l-8.2-4.2z"/><path d="M3.8 8.2L12 12.4l8.2-4.2M12 12.4V20"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="4.6" y="10.4" width="14.8" height="10.4" rx="3"/><path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24"><path d="M3.4 12s3.2-6 8.6-6 8.6 6 8.6 6-3.2 6-8.6 6-8.6-6-8.6-6z"/><circle cx="12" cy="12" r="2.6"/><path d="M4.4 4.4l15.2 15.2"/></svg>',
    ret: '<svg viewBox="0 0 24 24"><path d="M8.6 5.4L4.4 9.6l4.2 4.2"/><path d="M4.6 9.6h10.2a4.8 4.8 0 0 1 0 9.6H11"/></svg>',
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
  const RET_STEPS = ['started', 'sent', 'received', 'refunded'];
  const RET_STEP_NAMES = { started: 'Return started', sent: 'Sent back', received: 'Store has it', refunded: 'Refunded' };
  const RET_SHOW_DAYS = 30;          // a refunded return stays under Returns this long

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
  let outbox = ls.json(K.log, []);                                            // log events not yet in the Sheet's Log tab
  if (!Array.isArray(outbox)) outbox = [];
  // Synced with the family's Sheet at least once (through aOS): from then on this phone keeps the last
  // 90 days of orders and every one not finished yet, and the Sheet keeps the rest (below).
  let synced = ls.get(K.family, '') === '1';
  // Ids the Sheet says are someone else's (the same email in two people's Gmail makes the same order):
  // kept on this phone as they are, not sent again.
  const notMine = new Set(ls.json(K.notMine, []));
  // Orders fetched from the Sheet this session (looking back past the 90 days): kept until the next start.
  const older = new Set();
  const past = { day: '', busy: false, end: false };   // how far "Show older orders" has reached
  let startSync = null;   // the first sync of this session (Gmail is read after it)
  const shadow = new Map();
  let ipsy = null;   // Ipsy's handle (home/ipsy.js), once it's in its corner (the end of this script)
  const st = { unlocked: false, tab: ls.get(K.tab, 'way'), q: '', search: false, order: null, edit: null, isNew: false, scanning: false, scanDone: 0, scanTotal: 0 };

  // IndexedDB copy of the Sheet link and code, as in Notes: survives a full
  // or cleared localStorage (every AllisonOS app shares its space). Opened only
  // once the old Orders Vintage app's copy is moved over (../home/design.js).
  const keep = (() => {
    let db = null;
    const open = () => db || (db = Promise.resolve(window.aosDesign && aosDesign.moved).catch(() => {}).then(() => new Promise((res, rej) => {
      const r = indexedDB.open('allison-orders', 1);
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

  // What each order looked like at the last save: any change stamps a new
  // 'updated' time, and anything that vanished becomes a grave for the Sheet.
  const kindsOfData = () => [['orders', orders]];
  const bare = it => { const { updated, ...rest } = it; return JSON.stringify(rest); };
  function initShadow() {
    shadow.clear();
    kindsOfData().forEach(([kind, arr]) => arr.forEach(it => {
      if (!it.updated) it.updated = it.created || 1;
      const { updated, ...rest } = it; shadow.set(kind + ':' + it.id, JSON.stringify(rest));
    }));
  }
  // The Log tab in the Sheet only ever grows: every order added, every status change, edit and
  // deletion, and every email left out because its kind is off in Settings, is queued here
  // (whatever the kinds are set to) and goes to the Sheet with the next sync. Ids are fixed for
  // the common ones so two phones that notice the same thing write one row.
  const LOG_MAX = 2000;
  const LOG_WATCH = { store: 'store', items: 'items', total: 'total', orderNo: 'order number', orderDate: 'order date', eta: 'expected date', carrier: 'carrier', tracking: 'tracking', kind: 'kind', pickupBy: 'pickup date', notes: 'notes' };
  // Queued once this phone has synced with the family's Sheet (or still holds an old link, from before aOS).
  const logging = () => synced || !!ls.get(K.sync, '');
  function logEvent(ev, o, note, id) {
    if (!logging() || !o) return;
    const at = Date.now(), snap = {};
    ['id', 'store', 'kind', 'items', 'total', 'status', 'carrier', 'tracking', 'eta', 'orderNo'].forEach(k => { if (o[k] != null) snap[k] = o[k]; });
    outbox.push({ id: id || ev.toLowerCase().replace(/\W+/g, '-') + '-' + o.id + '-' + at, at, ev, note: note || '', o: snap });
    if (outbox.length > LOG_MAX) outbox = outbox.slice(-LOG_MAX);
    ls.set(K.log, JSON.stringify(outbox));
  }
  function logChange(prev, o) {
    if (!logging()) return;
    if (prev == null) return logEvent('Added', o, '', 'add-' + o.id + '-' + (o.created || 0));
    let p; try { p = JSON.parse(prev); } catch { return; }
    const same = k => JSON.stringify(p[k] == null ? null : p[k]) === JSON.stringify(o[k] == null ? null : o[k]);
    const fields = Object.keys(LOG_WATCH).filter(k => !same(k)).map(k => LOG_WATCH[k]);
    const pr = (p.ret && p.ret.status) || '', or = (o.ret && o.ret.status) || '';
    if (pr !== or) {
      const amt = or && o.ret.refund != null ? ' (' + money(o.ret.refund, o.ret.cur || o.cur) + ')' : '';
      logEvent('Return', o, (pr ? RET_STEP_NAMES[pr] + ' → ' : '') + (or ? RET_STEP_NAMES[or] + amt : 'Return removed'), 'ret-' + o.id + '-' + (or || 'none'));
    }
    if (p.status !== o.status) return logEvent('Status changed', o, (P.STATUS_NAMES[p.status] || p.status) + ' → ' + (P.STATUS_NAMES[o.status] || o.status) + (fields.length ? '; also ' + fields.join(', ') : ''), 'st-' + o.id + '-' + p.status + '-' + o.status + '-' + todayStr());
    if (fields.length) logEvent('Updated', o, 'Changed: ' + fields.join(', '));
  }
  function logGone(prev) {
    let p; try { p = JSON.parse(prev); } catch { return; }
    if (p && p.id) logEvent('Deleted', p, '');
  }
  function track() {
    const now = Date.now(), have = new Set();
    kindsOfData().forEach(([kind, arr]) => arr.forEach(it => {
      const k = kind + ':' + it.id, { updated, ...rest } = it, j = JSON.stringify(rest);
      have.add(k);
      if (shadow.get(k) !== j) { logChange(shadow.get(k), it); it.updated = now; shadow.set(k, j); delete graves[k]; }
    }));
    shadow.forEach((j, k) => { if (!have.has(k)) { logGone(j); graves[k] = now; shadow.delete(k); } });
  }
  initShadow();
  let storeWarned = false;
  function persist() {
    const ok = ls.set(KEY, JSON.stringify({ orders, kinds })) && ls.set(K.graves, JSON.stringify(graves));
    if (!ok && !storeWarned) { storeWarned = true; toast('This phone couldn’t save Orders: storage is full.' + (synced ? ' Your orders are safe in the family’s Google Sheet.' : ' Back up soon.')); }
  }
  const signedIn = () => !!(window.AllisonOS && AllisonOS.account && AllisonOS.account.token());
  function save() { track(); persist(); if (signedIn()) scheduleSync(); }
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
  // In Russian (../home/lang.js) what came from a store or an email (stores, items, tracking numbers, notes) stays
  // as written: translate="no" (raw); tr gives a placeholder the page can't translate by itself (a textarea's).
  const raw = s => '<span translate="no">' + esc(s) + '</span>';
  const tr = s => window.aosLang ? aosLang.t(s) : s;

  // ---------------------------------------------------------------------
  // What an order is, for the screens
  // ---------------------------------------------------------------------
  const isOpen = o => OPEN.includes(o.status);
  const kindOn = o => kinds[o.kind || 'package'] !== false;
  // Hidden (a gift, say): out of every list, search, count and Ipsy, on every phone it syncs to;
  // only Settings > Hidden orders shows them, after Face ID, until Orders goes to the background.
  const shown = o => !o.hide;
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
  // The same, with the item's name kept as written in Russian.
  function whatHtml(o) {
    const it = o.items || [];
    if (!it.length) return esc(whatOf(o));
    return raw(it[0].name) + esc((it[0].qty > 1 ? ' ×' + it[0].qty : '') + (it.length > 1 ? ' and ' + (it.length - 1) + ' more' : ''));
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
  // Returns: o.ret = { status: started|sent|received|refunded, steps, by (drop off or send by), where,
  // reason, refund, cur, refundTo, rma, tracking, carrier, trackUrl, items, undelivered, source, locks }
  const hasRet = o => !!(o.ret && o.ret.status);
  const retOpen = o => hasRet(o) && o.ret.status !== 'refunded';
  const retDay = o => { const r = o.ret || {}, st = r.steps || {}; return st.refunded || st.received || st.sent || st.started || last(o) || ''; };
  const retShows = o => retOpen(o) || (hasRet(o) && daysFrom(retDay(o) || todayStr(), todayStr()) <= RET_SHOW_DAYS);
  const retSoon = o => hasRet(o) && o.ret.status === 'started' && !!o.ret.by && daysFrom(todayStr(), o.ret.by) <= 7;
  const refundWord = o => o.ret.refund != null ? money(o.ret.refund, o.ret.cur || o.cur) : '';
  function retState(o) {
    const r = o.ret, s = r.steps || {}, amt = refundWord(o);
    switch (r.status) {
      case 'started': {
        if (r.undelivered) return { label: 'Coming back', cls: 's-now', when: 'Sent back by the carrier' };
        const left = r.by ? daysFrom(todayStr(), r.by) : null;
        return { label: 'Return started', cls: left != null && left <= 3 ? 's-warn' : 's-now', when: r.by ? (left < 0 ? 'Was due ' + fmtMD(r.by) : 'Drop off by ' + (left <= 1 ? dayWord(r.by) : fmtDay(r.by))) : s.started ? 'Since ' + fmtMD(s.started) : '' };
      }
      case 'sent': return { label: 'Sent back', cls: 's-now', when: [s.sent ? fmtMD(s.sent) : '', amt ? amt + ' refund to come' : ''].filter(Boolean).join(' · ') };
      case 'received': return { label: 'Store has it', cls: 's-now', when: amt ? amt + ' refund to come' : 'Refund to come' };
      case 'refunded': return { label: 'Refunded', cls: 's-done', when: [amt, s.refunded ? fmtMD(s.refunded) : ''].filter(Boolean).join(' · ') };
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
  window.addEventListener('aos:design', () => requestAnimationFrame(() => slideWhen(true)));   // Futura and the system font are different widths
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
  const LINKS = {
    mailApp: threadId => '../mail/?thread=' + encodeURIComponent(threadId),
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
    if (o.carrier || o.tracking) return '<div class="ocarrier">' + (o.carrier ? '<span class="cpill" translate="no">' + esc(o.carrier) + '</span>' : '') + (o.tracking ? '<span class="t" translate="no">' + esc(o.tracking) + '</span>' : '') + '</div>';
    if (o.status === 'ordered' && o.kind !== 'pickup') return '<div class="ocarrier"><span class="t">Waiting for a shipping email</span></div>';
    return '';
  }
  function retBar(o) {
    const r = P.retRank(o.ret.status);
    return '<div class="osteps ret" style="grid-template-columns:repeat(4,1fr)" aria-hidden="true">' + RET_STEPS.map(s => '<i' + (P.retRank(s) <= r ? ' class="on"' : '') + '></i>').join('') + '</div>';
  }
  function retRow(o) {
    const r = o.ret;
    if (r.status === 'started' && r.where) return '<div class="ocarrier"><span class="t" translate="no">' + esc(r.where) + '</span></div>';
    if (r.tracking) return '<div class="ocarrier">' + (r.carrier ? '<span class="cpill" translate="no">' + esc(r.carrier) + '</span>' : '') + '<span class="t" translate="no">' + esc(r.tracking) + '</span></div>';
    if (r.reason) return '<div class="ocarrier"><span class="t" translate="no">' + esc(r.reason) + '</span></div>';
    return '';
  }
  function card(o, i) {
    const ret = hasRet(o), s = ret ? retState(o) : stateOf(o), warn = !ret && needsCheck(o);
    return '<button class="ocard' + (isOpen(o) ? '' : ' done') + '" type="button" data-o="' + esc(o.id) + '" style="--i:' + i + '">'
      + '<div class="otop">' + mono(o) + '<div class="omid"><div class="ostore"' + (o.store ? ' translate="no"' : '') + '>' + esc(o.store || 'Order') + (o.private ? '<span class="olock" title="' + esc(tr('Private: hidden from Ipsy')) + '">' + I.lock + '</span>' : '') + '</div><div class="owhat">' + whatHtml(o) + '</div></div>'
      + (o.total != null ? '<span class="oprice">' + esc(money(o.total, o.cur)) + '</span>' : '') + '</div>'
      + '<div class="ostate"><b class="' + (warn ? 's-warn' : s.cls) + '">' + esc(warn ? 'Check details' : s.label) + '</b><span class="when">' + esc(s.when) + '</span></div>'
      + (ret ? retBar(o) + retRow(o) : stepBar(o) + carrierRow(o)) + '</button>';
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
  function retSections(list) {
    const by = (a, b) => (a.ret.by || '9999').localeCompare(b.ret.by || '9999') || retDay(b).localeCompare(retDay(a));
    const send = list.filter(o => o.ret.status === 'started').sort(by);
    const back = list.filter(o => o.ret.status === 'sent' || o.ret.status === 'received').sort((a, b) => retDay(b).localeCompare(retDay(a)));
    const paid = list.filter(o => o.ret.status === 'refunded').sort((a, b) => retDay(b).localeCompare(retDay(a)));
    return [['To send back', send], ['Waiting for the refund', back], ['Refunded', paid]].filter(x => x[1].length);
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
    const r = o.ret || {};
    const hay = [o.store, o.orderNo, o.tracking, o.carrier, o.notes, ...(o.items || []).map(i => i.name), r.rma, r.tracking, r.status ? 'return ' + r.status : ''].join(' ').toLowerCase();
    return q.split(/\s+/).every(w => hay.includes(w));
  }
  function render() {
    const vis = orders.filter(o => kindOn(o) && shown(o)), hid = st.unlocked ? orders.filter(o => o.hide) : [];
    const way = vis.filter(isOpen), done = vis.filter(o => !isOpen(o)), check = vis.filter(o => !hasRet(o) && needsCheck(o)), rets = vis.filter(retShows);
    const q = st.q.trim().toLowerCase();
    const chips = [['way', 'On the way', way.length]];
    if (rets.length) chips.push(['ret', 'Returns', rets.length]);
    chips.push(['done', 'Delivered', done.length]);
    if (check.length) chips.push(['check', 'To check', check.length]);
    if (st.unlocked) chips.push(['hidden', 'Hidden', hid.length]);
    if ((st.tab === 'check' && !check.length) || (st.tab === 'ret' && !rets.length) || (st.tab === 'hidden' && !st.unlocked)) st.tab = 'way';
    $('whenChips').innerHTML = chips.map(([k, t, n]) => '<button class="chip glass" type="button" data-when="' + k + '" aria-pressed="' + (!q && st.tab === k) + '">' + esc(t) + ' <span class="n">' + n + '</span></button>').join('');
    slideWhen();
    renderSub(way.length);
    $('qClear').hidden = !st.q;

    let h = '', i = 0;
    const group = (title, list) => '<p class="sechead"><span>' + esc(title) + '</span></p>' + list.map(o => card(o, i++)).join('');
    if (!orders.length) {
      h = '<div class="empty glass"><strong>No orders yet</strong></div><button class="btn" type="button" id="emptyGo">' + (hasGmail() ? 'Look in Gmail now' : 'Connect Gmail') + '</button>'
        + '<button class="btn quiet" type="button" id="emptyAdd">Add an order by hand</button>';
    } else if (q) {
      const list = vis.filter(o => matches(o, q)).sort(byRecent);
      h = (list.length ? '<p class="resulthead">' + plural(list.length, 'result') + '</p>' + list.map(o => card(o, i++)).join('') : '<div class="empty glass"><strong>No match</strong>Try a store, an item or an order number.</div>') + olderRow();
    } else if (st.tab === 'check') {
      h = check.sort(byRecent).map(o => card(o, i++)).join('');
    } else if (st.tab === 'hidden') {
      h = hid.length ? '<p class="hint">Only you, after Face ID. They hide again when you leave Orders.</p>' + hid.sort(byRecent).map(o => card(o, i++)).join('') : '<div class="empty glass"><strong>Nothing hidden</strong>Hide an order (a gift, say) from its page.</div>';
    } else if (st.tab === 'ret') {
      h = retSections(rets).map(([t, l]) => group(t, l)).join('');
    } else if (st.tab === 'done') {
      const secs = doneSections(done);
      h = (secs.length ? secs.map(([t, l]) => group(t, l)).join('') : '<div class="empty glass"><strong>Nothing delivered yet</strong></div>') + olderRow();
    } else {
      // A return due within the week leads On the way: it's the one thing here with a deadline.
      const soon = vis.filter(retSoon).sort((a, b) => a.ret.by.localeCompare(b.ret.by));
      const secs = (soon.length ? [['Returns to send back', soon]] : []).concat(waySections(way));
      h = secs.length ? secs.map(([t, l]) => group(t, l)).join('') : '<div class="empty glass"><strong>Nothing on the way</strong></div>';
    }
    $('list').innerHTML = h;
    if ($('emptyGo')) $('emptyGo').onclick = () => hasGmail() ? scan({ loud: true }) : openSettings();
    if ($('emptyAdd')) $('emptyAdd').onclick = () => openEdit();
    if ($('olderGo')) $('olderGo').onclick = showOlder;
    if (!$('opage').hidden && st.order) renderOrder();
  }
  // The line under the title: what's on the way, Gmail, and the Sheet.
  function renderSub(onWay) {
    const sub = [];
    if (onWay == null) onWay = orders.filter(o => kindOn(o) && shown(o) && isOpen(o)).length;
    if (onWay) sub.push(onWay + ' on the way');
    const rets = orders.filter(o => kindOn(o) && shown(o) && retOpen(o)).length;
    if (rets) sub.push(plural(rets, 'return'));
    if (st.scanning) sub.push('Reading Gmail…');
    else if (+ls.get(K.lastScan, 0)) sub.push('Gmail checked ' + ago(+ls.get(K.lastScan, 0)));
    if (signedIn()) { const s = { error: 'Not synced', syncing: 'Syncing…', offline: 'Offline' }[syncState] || (synced ? 'Synced' : ''); if (s) sub.push(s); }
    $('sub').textContent = sub.join(' · ');
  }
  // At the end of Delivered and of a search: older orders, a year at a time, from the family's Sheet.
  function olderRow() {
    if (!synced) return '';
    if (past.end) return '<p class="hint olderhint">Nothing older in the family’s Google Sheet' + (past.day ? ' (before ' + esc(fmtDay(past.day)) + ')' : '') + '.</p>';
    return '<button class="btn quiet" type="button" id="olderGo"' + (past.busy ? ' disabled' : '') + '>' + (past.busy ? 'Looking in the Sheet…' : 'Show older orders from the Sheet') + '</button>';
  }
  $('whenChips').addEventListener('click', e => {
    const b = e.target.closest('[data-when]'); if (!b) return;
    st.tab = b.dataset.when; st.q = ''; $('q').value = ''; if (st.tab !== 'hidden') ls.set(K.tab, st.tab); render(); animateIn($('list'));
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
  function retHeadline(o) {
    const r = o.ret, s = r.steps || {}, amt = refundWord(o);
    switch (r.status) {
      case 'started':
        if (r.undelivered) return { h: 'On its way back to ' + (o.store || 'the store'), p: 'The carrier is sending it back.' + (amt ? ' Refund: ' + amt + '.' : '') };
        return { h: r.by ? (daysFrom(todayStr(), r.by) < 0 ? 'Return was due ' + fmtDay(r.by) : 'Drop off by ' + fmtDay(r.by)) : 'Return started', p: r.by && s.started ? 'Return started ' + fmtDay(s.started) + '.' : '' };
      case 'sent': return { h: 'Sent back' + (s.sent ? ' ' + dayWord(s.sent) : ''), p: amt ? amt + ' refund to come once ' + (o.store || 'the store') + ' has it.' : 'Waiting for ' + (o.store || 'the store') + ' to get it.' };
      case 'received': return { h: (o.store || 'The store') + ' has it', p: amt ? amt + ' refund to come.' : 'Refund to come.' };
      case 'refunded': return { h: 'Refunded' + (amt ? ' ' + amt : ''), p: (s.refunded ? 'Refunded ' + fmtDay(s.refunded) : '') + (r.refundTo ? (s.refunded ? ' to ' : 'To ') + r.refundTo : '') + (s.refunded || r.refundTo ? '.' : '') + (r.undelivered ? ' The carrier sent it back.' : '') };
      default: return null;
    }
  }
  function headline(o) {
    if (hasRet(o)) return retHeadline(o);
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
  // The return, under the order: its steps, then what to do and the refund.
  function retBox(o) {
    const r = o.ret, s = r.steps || {}, rk = P.retRank(r.status), amt = refundWord(o);
    let h = '<p class="sechead"><span>Return</span></p><ul class="otl ret" aria-label="Return">' + RET_STEPS.map((k, n) => {
      const on = P.retRank(k) <= rk, nextOn = RET_STEPS[n + 1] && P.retRank(RET_STEPS[n + 1]) <= rk;
      return '<li class="' + (on ? 'on' : 'todo') + (on && nextOn ? ' link' : '') + '"><span>' + esc(RET_STEP_NAMES[k]) + '</span><time>' + esc(s[k] ? fmtMD(s[k]) : '—') + '</time></li>';
    }).join('') + '</ul>';
    const rows = [];
    if (r.by && r.status === 'started') rows.push('<div><dt>Drop off by</dt><dd>' + esc(fmtDay(r.by)) + '</dd></div>');
    if (r.where && r.status === 'started') rows.push('<div><dt>Drop off at</dt><dd translate="no">' + esc(r.where) + '</dd></div>');
    if ((r.items || []).length) rows.push('<div><dt>Returning</dt><dd translate="no">' + r.items.map(esc).join('<br>') + '</dd></div>');
    if (r.reason) rows.push('<div><dt>Reason</dt><dd translate="no">' + esc(r.reason) + '</dd></div>');
    if (r.rma) rows.push('<div><dt>Return number</dt><dd translate="no">' + esc(r.rma) + '</dd></div>');
    if (r.tracking) rows.push('<div><dt>Return tracking</dt><dd>' + raw(r.tracking) + ' <button class="copy" type="button" data-copy="' + esc(r.tracking) + '">Copy</button></dd></div>');
    if (r.refundTo) rows.push('<div><dt>Refund to</dt><dd translate="no">' + esc(r.refundTo.replace(/^your /i, 'Your ')) + '</dd></div>');
    if (amt) rows.push('<div class="total"><dt>' + (r.status === 'refunded' ? 'Refunded' : 'Refund (estimated)') + '</dt><dd>' + esc(amt) + '</dd></div>');
    if (rows.length || (r.trackUrl && r.carrier)) {
      h += '<div class="obox">' + (rows.length ? '<dl class="okv">' + rows.join('') + '</dl>' : '');
      if (r.trackUrl && r.carrier && r.status !== 'refunded') h += '<a class="ctabtn" href="' + esc(r.trackUrl) + '" target="_blank" rel="noopener noreferrer">Track the return on ' + esc(r.carrier) + I.ext + '</a>';
      h += '</div>';
    }
    return h;
  }
  function renderOrder() {
    const o = st.order; if (!o) return;
    const hd = headline(o), steps = stepsOf(o), r = P.rank(o.status), s = o.steps || {};
    let h = '<div class="ohero"><div class="who">' + mono(o) + '<span' + (o.store ? ' translate="no"' : '') + '>' + esc(o.store || 'Order') + '</span></div><h3>' + esc(hd.h) + '</h3>' + (hd.p ? '<p>' + esc(hd.p) + '</p>' : '') + '</div>';
    if (needsCheck(o)) h += '<div class="verify"><span>' + esc(checkReason(o)) + ' Check the details, then tap Looks right.</span><button class="textbtn" type="button" id="opOk">Looks right</button></div>';
    // An order known only from its return has no steps of its own to show.
    if (o.status !== 'cancelled' && !(hasRet(o) && !Object.keys(s).length)) {
      h += '<ul class="otl" aria-label="Progress">' + steps.map((k, n) => {
        const on = P.rank(k) <= r, nextOn = steps[n + 1] && P.rank(steps[n + 1]) <= r;
        return '<li class="' + (on ? 'on' : 'todo') + (on && nextOn ? ' link' : '') + '"><span>' + esc(stepName(o, k)) + '</span><time>' + esc(s[k] ? fmtMD(s[k]) : '—') + '</time></li>';
      }).join('') + '</ul>';
    }
    const rows = [];
    if (o.carrier || o.tracking || (o.status !== 'ordered' && !(hasRet(o) && !s.shipped && !s.delivered))) {
      rows.push('<div><dt>Carrier</dt><dd' + (o.carrier ? ' translate="no"' : '') + '>' + esc(o.carrier || (o.kind === 'pickup' ? 'Store pickup' : '—')) + '</dd></div>');
      if (o.kind !== 'pickup') rows.push('<div><dt>Tracking number</dt><dd>' + (o.tracking ? raw(o.tracking) + ' <button class="copy" type="button" data-copy="' + esc(o.tracking) + '">Copy</button>' : '—') + '</dd></div>');
    }
    if (o.orderNo) rows.push('<div><dt>Order number</dt><dd translate="no">' + esc(o.orderNo) + '</dd></div>');
    if (o.orderDate) rows.push('<div><dt>Ordered</dt><dd>' + esc(fmtDay(o.orderDate)) + '</dd></div>');
    if (o.eta && isOpen(o)) rows.push('<div><dt>' + (o.kind === 'pickup' ? 'Pickup' : 'Expected') + '</dt><dd>' + esc(o.etaEnd ? fmtRange(o.eta, o.etaEnd) : fmtDay(o.eta)) + '</dd></div>');
    if (o.pickupBy && o.status === 'pickup') rows.push('<div><dt>Pick up by</dt><dd>' + esc(fmtDay(o.pickupBy)) + '</dd></div>');
    if (rows.length || o.trackUrl) {
      h += '<div class="obox">' + (rows.length ? '<dl class="okv">' + rows.join('') + '</dl>' : '');
      if (o.trackUrl && o.carrier) h += '<a class="ctabtn" href="' + esc(o.trackUrl) + '" target="_blank" rel="noopener noreferrer">Track on ' + esc(o.carrier) + I.ext + '</a>';
      h += '</div>';
    }
    if ((o.items || []).length || o.total != null) {
      h += '<div class="obox">' + (o.items || []).map(it => '<div class="oitem"><span>' + raw(it.name) + (it.qty > 1 ? '<small>Qty ' + it.qty + '</small>' : '') + '</span>' + (it.price ? '<b>' + esc(money(it.price, o.cur)) + '</b>' : '') + '</div>').join('');
      if (o.total != null) h += '<dl class="okv"><div class="total"><dt>Total</dt><dd>' + esc(money(o.total, o.cur)) + '</dd></div></dl>';
      h += '</div>';
    }
    if (hasRet(o)) h += retBox(o);
    if (o.notes) h += '<div class="obox"><p translate="no" style="margin:8px 0;white-space:pre-line;overflow-wrap:anywhere">' + esc(o.notes) + '</p></div>';
    const acts = [];
    if (hasRet(o)) {
      const r = o.ret;
      if (r.status === 'started' && !r.undelivered) acts.push('<button class="rowbtn" type="button" id="opRetSent"><span class="ic">' + I.ret + '</span><span>Mark as sent back<span class="sub">Dropped off or posted</span></span></button>');
      if (r.status !== 'refunded') acts.push('<button class="rowbtn" type="button" id="opRetPaid"><span class="ic">' + I.check + '</span><span>Mark as refunded</span></button>');
      if (r.source && r.source.threadId) acts.push('<a class="rowbtn" href="' + esc(LINKS.mailApp(r.source.threadId)) + '"><span class="ic">' + I.mail + '</span><span>Open the return email in Mail<span class="sub" translate="no">' + esc(r.source.subject || '') + '</span></span></a>');
    }
    if (o.source && o.source.threadId) {
      acts.push('<a class="rowbtn" href="' + esc(LINKS.mailApp(o.source.threadId)) + '"><span class="ic">' + I.mail + '</span><span>Open the email in Mail<span class="sub" translate="no">' + esc(o.source.subject || '') + '</span></span></a>');
      acts.push(linkRow(LINKS.gmailWeb(o.source.msgId), 'Open in Gmail', 'In the browser', I.ext));
    }
    if (o.source && o.source.msgId && !o.private) acts.push('<button class="rowbtn" type="button" id="opAi"' + (st.aiBusy ? ' disabled' : '') + '><span class="ic">' + I.spark + '</span><span>' + (st.aiBusy ? 'Ipsy is reading it…' : 'Have Ipsy check this order') + '</span></button>');
    acts.push('<button class="rowbtn" type="button" id="opEdit2"><span class="ic">' + I.edit + '</span><span>Edit details</span></button>');
    if (isOpen(o)) acts.push('<button class="rowbtn" type="button" id="opDelivered"><span class="ic">' + I.check + '</span><span>' + (o.kind === 'pickup' ? 'Mark as picked up' : 'Mark as delivered') + '</span></button>');
    if (!hasRet(o) && (o.status === 'delivered' || o.status === 'pickedup')) acts.push('<button class="rowbtn" type="button" id="opRetStart"><span class="ic">' + I.ret + '</span><span>Start a return<span class="sub">Keeps track of it until the refund</span></span></button>');
    h += '<div class="rgroup glass">' + acts.join('') + '</div>';
    // Private: hidden from Ipsy (ipsy-tools.js), with its emails; it still syncs and shows here as usual.
    h += '<div class="rgroup glass"><button class="swrow" type="button" role="switch" id="opPrivate" aria-checked="' + !!o.private + '">' + I.lock
      + '<span class="grow">Private<span class="sub">Hides this order and its emails from Ipsy.</span></span><span class="switch" aria-hidden="true"></span></button>'
      + '<button class="swrow" type="button" role="switch" id="opHide" aria-checked="' + !!o.hide + '">' + I.eyeOff
      + '<span class="grow">Hidden<span class="sub">For gifts: off every list, search and Ipsy. Settings shows it, with Face ID.</span></span><span class="switch" aria-hidden="true"></span></button></div>';
    if (o.source && o.source.from) h += '<p class="srcnote">From ' + esc(o.source.from.replace(/<[^>]*>/g, '').trim() || o.source.from) + (o.source.date ? ', ' + esc(new Date(o.source.date).toLocaleDateString('en-US')) : '') + '.' + (o.ai ? ' Details fixed by Ipsy.' : '') + (o.auto ? ' Marked as received in a clean-up.' : '') + '</p>';
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
    if (e.target.closest('#opPrivate')) {
      if (o.private) delete o.private; else o.private = true;
      save(); renderOrder(); render();
      toast(o.private ? 'Private: hidden from Ipsy' : 'Ipsy can see this order again');
      return;
    }
    if (e.target.closest('#opHide')) {
      const before = !!o.hide;
      if (before) delete o.hide; else o.hide = true;
      save();
      const undo = () => { if (before) o.hide = true; else delete o.hide; save(); if (st.order === o) renderOrder(); render(); };
      if (o.hide && !st.unlocked) { finishPage(); toast('Hidden. Settings > Hidden orders shows it again.', undo); }
      else { renderOrder(); render(); toast(o.hide ? 'Hidden' : 'Back in your lists', undo); }
      return;
    }
    if (e.target.closest('#opEdit2')) return openEdit(o.id);
    const retTo = e.target.closest('#opRetStart') ? 'started' : e.target.closest('#opRetSent') ? 'sent' : e.target.closest('#opRetPaid') ? 'refunded' : '';
    if (retTo) {
      const before = JSON.parse(JSON.stringify(o)), r = o.ret = o.ret || { status: '', steps: {} };
      r.status = retTo; r.steps = { ...(r.steps || {}), [retTo]: (r.steps || {})[retTo] || todayStr() };
      save(); renderOrder(); render();
      toast(retTo === 'started' ? 'Return started. Edit details adds the drop-off date.' : retTo === 'sent' ? 'Marked as sent back' : 'Marked as refunded',
        () => { Object.keys(o).forEach(k => { if (!(k in before)) delete o[k]; }); Object.assign(o, before); save(); if (st.order === o) renderOrder(); render(); });
      return;
    }
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
  // quiet (Ipsy checking by itself): never asks for Face ID; signed out, it just says so.
  async function aiCall(body, quiet) {
    const opts = { method: 'POST', cache: 'no-store', headers: { 'X-Orders': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const acct = window.AllisonOS && window.AllisonOS.account;
    if (quiet && acct) { const tok = acct.token && acct.token(); if (!tok) throw Object.assign(new Error('signin'), { code: 'signin' }); opts.headers.Authorization = 'Bearer ' + tok; }
    let r;
    try { r = acct && !quiet ? await acct.fetch('../orders/api/read', opts) : await fetch('../orders/api/read', opts); }
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
  async function aiRead(o, quiet) {
    const msg = await gmail('/messages/' + o.source.msgId, { format: 'full' });
    const { html, text } = bodies(msg.payload);
    const fromHtml = html ? P.htmlToText(html) : '';
    const body = (fromHtml && fromHtml.length > text.length * 1.2 ? fromHtml : (text || fromHtml))
      .replace(/https?:\/\/\S+/g, '[link]').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 12000);
    const j = await aiCall({ subject: header(msg, 'subject'), from: header(msg, 'from'), date: +msg.internalDate || o.source.date, text: body }, quiet);
    return j.fact || null;
  }
  // Ipsy checks an order: its email read again by Claude (functions/orders/api read: Haiku 5.5, every
  // number checked against the email's own words), what it found put onto the order, with Undo in
  // Ipsy's chat. Asked once first (in Ipsy's chat), for this and for Ipsy's own checking of To check.
  const ipsyAsked = async () => {
    if (ls.get(K.aiOk, '')) return true;
    if (!ipsy) return false;
    const ok = await ipsy.ask('Send this order’s email to Claude, through the family server, to fix its details?', { yes: 'OK', no: 'Not now' });
    if (ok) ls.set(K.aiOk, '1');
    return ok;
  };
  const undoTo = (o, before) => () => { Object.keys(o).forEach(k => { if (!(k in before)) delete o[k]; }); Object.assign(o, before); if (!orders.includes(o)) orders.push(o); save(); if (st.order === o) renderOrder(); render(); };
  // One order: { changed: [...] } or { none: true } (not an order email) or { error }.
  async function checkOrder(o, quiet) {
    const before = JSON.parse(JSON.stringify(o));
    try {
      const f = await aiRead(o, quiet);
      if (!f) return { none: true };
      const changed = [...new Set(applyAi(o, f))];
      save();
      if (changed.length && ipsy) ipsy.change('Fixed ' + (o.store || 'an order') + ': ' + changed.slice(0, 4).join(', '), undoTo(o, before));
      return { changed, undo: undoTo(o, before) };
    } catch (e) {
      return { error: e instanceof AuthError ? 'auth' : e.code || 'server', message: e.message };
    }
  }
  // "Have Ipsy check this order", on its page.
  async function aiFix(o) {
    if (st.aiBusy || st.sorting || !o.source || !o.source.msgId || o.private || o.hide) return;
    if (!getToken()) { toast('Connect Gmail in Settings first, so Orders can open the email.'); return; }
    if (!(await ipsyAsked())) return;
    if (ipsy) ipsy.close();
    st.aiBusy = true; renderOrder(); if (ipsy) ipsy.working(true);
    const r = await checkOrder(o);
    st.aiBusy = false; if (ipsy) ipsy.working(false); if (st.order === o) renderOrder(); render();
    if (r.error === 'auth') { toast('Gmail needs you to sign in again.'); openSettings(); }
    else if (r.error) toast(AI_SAY[r.error] || (r.error !== 'server' ? 'Something went wrong. Try again in a minute.' : r.message));
    else if (r.none) toast('Ipsy doesn’t think that email is about an order.');
    else toast(r.changed.length ? 'Ipsy fixed the ' + r.changed.slice(0, 4).join(', ') + '.' : 'Ipsy agrees with what’s there.', r.changed.length ? r.undo : null, 6000);
  }

  // Ipsy keeps orders up to date by itself: after each read of Gmail (and when Orders opens), every order
  // in To check, and every order still on its way, whose newest email Ipsy hasn't read yet, is checked
  // once (per email), To check first, at most 10 at a time, quietly. Asked once first, from Ipsy's corner;
  // Settings > Ipsy turns it on or off. A fix shows in Ipsy's chat with Undo, and Ipsy says in its corner
  // what it did. What it can't fix stays in To check.
  let autoBusy = false, autoOffered = false;     // offered once each time Orders opens
  const AUTO_STOP = ['signin', 'accounts-off', 'no-ai', 'limit', 'offline', 'auth', 'ai-key', 'ai-unreachable', 'ai-busy'];
  const when = o => (o.source && o.source.date) || 0;
  async function autoCheck() {
    if (!ipsy || autoBusy || st.aiBusy || st.scanning || !getToken()) return;
    const tried = new Set(ls.json(K.ipsyTried, []));
    const todo = orders.filter(o => !o.private && !o.hide && kindOn(o) && (needsCheck(o) || isOpen(o)) && o.source && o.source.msgId && !tried.has(o.id + ':' + o.source.msgId))
      .sort((a, b) => needsCheck(b) - needsCheck(a) || when(b) - when(a)).slice(0, 10);
    if (!todo.length) return;
    const mode = ls.get(K.ipsyAuto, '');
    if (mode === '0') return;
    if (mode !== '1') {
      if (autoOffered) return;
      autoOffered = true;
      ipsy.hint('Want me to keep your orders up to date by myself?', async () => {
        const ok = await ipsy.ask('Want me to keep your orders up to date by myself? I’ll reread their emails with Claude and fix what I can, with Undo.', { yes: 'Yes, keep them up to date', no: 'Not now' });
        ls.set(K.ipsyAuto, ok ? '1' : '0');
        if (ok) { ls.set(K.aiOk, '1'); ipsy.close(); autoCheck(); }
      });
      return;
    }
    autoBusy = true; ipsy.working(true);
    let checked = 0, fixed = 0, left = 0, stop = '';
    for (const o of todo) {
      if (!orders.includes(o)) continue;
      const r = await checkOrder(o, true);
      if (r.error && AUTO_STOP.includes(r.error)) { stop = r.error; break; }      // not marked tried: next time
      tried.add(o.id + ':' + o.source.msgId); checked++;
      if (r.changed && r.changed.length) fixed++;
      if (needsCheck(o)) left++;
    }
    ls.set(K.ipsyTried, JSON.stringify([...tried].slice(-500)));
    autoBusy = false; ipsy.working(false); render();
    const need = n => n + ' still need' + (n === 1 ? 's' : '') + ' you';
    if (checked) ipsy.note('Checked ' + plural(checked, 'order') + ': ' + (fixed ? 'updated ' + fixed : 'nothing to change') + (left ? ', ' + need(left) : '') + '.');
    if (fixed) ipsy.hint('I updated ' + plural(fixed, 'order') + (left ? '; ' + need(left) + ' in To check.' : '.'));
    else if (left) ipsy.hint(left === 1 ? 'I couldn’t fix the one in To check: it needs you.' : 'I couldn’t fix those in To check: they need you.');
    else if (stop === 'signin') ipsy.hint('Sign in with Face ID in aOS and I can keep your orders up to date.');
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
  const RET_FIELDS = [['by', 'Drop off by', 'date'], ['refund', 'Refund', 'number'], ['rma', 'Return number', 'text'], ['tracking', 'Return tracking', 'text', true], ['where', 'Drop off at', 'text', true], ['reason', 'Reason', 'text', true]];
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
      if (type === 'textarea') ctl = '<textarea id="ef_' + k + '" data-k="' + k + '" placeholder="' + esc(tr(ph)) + '" style="min-height:84px">' + esc(itemsText(o.items)) + '</textarea>';
      else if (k === 'carrier') ctl = '<select id="ef_carrier" data-k="carrier"><option value=""></option>' + CARRIERS.concat(o.carrier && !CARRIERS.includes(o.carrier) ? [o.carrier] : []).map(c => '<option' + (o.carrier === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>';
      else if (k === 'status') ctl = '<select id="ef_status" data-k="status">' + statuses.map(s => '<option value="' + s + '"' + (o.status === s ? ' selected' : '') + '>' + esc(P.STATUS_NAMES[s] || s) + '</option>').join('') + '</select>';
      else if (k === 'kind') ctl = '<select id="ef_kind" data-k="kind">' + KIND_ROWS.map(([v, t]) => '<option value="' + v + '"' + ((o.kind || 'package') === v ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>';
      else if (k === 'pickupBy' && o.kind !== 'pickup') return '';
      else ctl = '<input id="ef_' + k + '" data-k="' + k + '" type="' + (type === 'number' ? 'text' : type) + '"' + (type === 'number' ? ' inputmode="decimal"' : '') + ' value="' + esc(k === 'total' ? (o.total != null ? o.total : '') : o[k] || '') + '" placeholder="' + esc(ph) + '" autocomplete="off">';
      return '<div class="f' + (wide ? ' w' : '') + '"><label for="ef_' + k + '">' + esc(label) + '</label>' + ctl + '</div>';
    }).join('') + '<div class="f w"><label for="ef_notes">Notes</label><textarea id="ef_notes" data-k="notes" placeholder="' + esc(tr('Anything to remember')) + '">' + esc(o.notes || '') + '</textarea></div></div></div>';
    if (o.ret && o.ret.status) {
      const r = o.ret, val = k => k === 'refund' ? (r.refund != null ? r.refund : '') : r[k] || '';
      h += '<p class="sechead"><span>Return</span></p><div class="box glass"><div class="kv">'
        + '<div class="f"><label for="ef_ret_status">Return</label><select id="ef_ret_status" data-r="status">' + RET_STEPS.map(k => '<option value="' + k + '"' + (r.status === k ? ' selected' : '') + '>' + esc(RET_STEP_NAMES[k]) + '</option>').join('') + '</select></div>'
        + RET_FIELDS.map(([k, label, type, wide]) => '<div class="f' + (wide ? ' w' : '') + '"><label for="ef_ret_' + k + '">' + esc(label) + '</label><input id="ef_ret_' + k + '" data-r="' + k + '" type="' + (type === 'number' ? 'text' : type) + '"' + (type === 'number' ? ' inputmode="decimal" placeholder="0.00"' : '') + ' value="' + esc(val(k)) + '" autocomplete="off"></div>').join('')
        + '</div></div>';
    }
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
    $('edBody').querySelectorAll('[data-r]').forEach(inp => {
      const k = inp.dataset.r, v = inp.value.trim();
      if (k === 'refund') { const n = parseFloat(v.replace(/[^0-9.]/g, '')); o.ret.refund = isNaN(n) ? null : n; }
      else o.ret[k] = v;
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
        if (o.ret && cur.ret) {
          // what you set on the return is yours: a later email doesn't change it
          const was = cur.ret, rl = { ...(was.locks || {}) };
          ['by', 'refund', 'where', 'reason', 'rma', 'tracking'].forEach(k => { if (String(was[k] == null ? '' : was[k]) !== String(o.ret[k] == null ? '' : o.ret[k])) rl[k] = true; });
          next.ret = { ...o.ret, locks: rl, steps: { ...(was.steps || {}) } };
          if (next.ret.status !== was.status) next.ret.steps[next.ret.status] = next.ret.steps[next.ret.status] || todayStr();
          if (next.ret.tracking !== was.tracking) { next.ret.carrier = next.ret.tracking ? next.ret.carrier || '' : ''; next.ret.trackUrl = next.ret.carrier && next.ret.tracking ? P.trackUrl(next.ret.carrier, next.ret.tracking) : ''; }
          if (next.ret.refund == null) delete next.ret.refund;
        }
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
  // Paste: an order email
  // ---------------------------------------------------------------------
  async function pasteIn() {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch {}
    if (text && text.trim().length > 20) return readPasted(text);
    $('psText').value = ''; $('psHint').hidden = true; openSheet('pasteSheet'); setTimeout(() => $('psText').focus(), 300);
  }
  function readPasted(text) {
    const r = P.parseText(text);
    if (!r.orders.length) {
      $('psText').value = text; $('psHint').textContent = 'No order found in that text. Add it by hand with the + button instead.'; $('psHint').hidden = false;
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
  $('psText').placeholder = tr($('psText').placeholder);
  $('psAdd').onclick = () => { const t = $('psText').value; if (!t.trim()) return; closeSheet('pasteSheet'); readPasted(t); };

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
  // Inside aOS 2 (aOS/home-tab.js) Google's sign-in page can't open in this app's frame: the whole aOS
  // window goes to Google instead and comes back to this page, which ../home/welcome.js then takes
  // back into aOS (aos.away). A quiet renewal waits while the app is out of sight there. Google takes
  // this page's place in the history (replace), not a step of its own for the back swipe to land on.
  function toGoogle(u, silent) {
    let inAOS = false; try { inAOS = window.top !== window && !!window.top.aosHome; } catch {}
    if (!inAOS) { location.replace(u); return; }
    const box = window.frameElement && window.frameElement.parentElement;
    if (silent && box && box.hidden) return;
    try { localStorage.setItem('aos.away', 'orders|' + Date.now()); } catch {}
    window.top.location.replace(u);
  }
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
    toGoogle(u.toString(), !!opts.silent);
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
    // The first sync of this session goes first, so an email read now folds into your own copy of its
    // order from the Sheet (with your edits) rather than starting a new one.
    if (startSync) await Promise.race([startSync, sleep(15000)]);
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
      // Once: the year's return emails again, even those already read (as orders, before returns).
      const again = new Set(), retsDue = ls.get(K.returnsV, '') !== RETURNS_V;
      if (retsDue) {
        pageToken = undefined;
        do {
          const r = await gmail('/messages', { q: FIRST_SCAN + ' ' + RETURNS_Q, maxResults: 100, pageToken });
          (r.messages || []).forEach(m => { again.add(m.id); if (!ids.some(x => x.id === m.id)) ids.push(m); });
          pageToken = r.nextPageToken;
        } while (pageToken && again.size < 1000);
        // Taken off "read" once; a long first read goes on in batches without reading them again.
        if (ls.get(K.returnsV, '') !== RETURNS_V + '-reading') { again.forEach(id => seen.delete(id)); saveSeen(); ls.set(K.returnsV, RETURNS_V + '-reading'); }
      }
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
          if (kinds[f.kind] === false && !(f.isReturn && P.findMatch(orders, f))) { skipped[m.id] = f.kind; logEvent('Left out', f, 'The “' + f.kind + '” kind is switched off in Settings', 'skip-' + m.id + '-' + f.id); return; }   // switched off in Settings: remembered, so turning it on reads it; the Log tab still gets it
          const x = P.upsert(orders, f, { graves, revive });
          if (x === 'new') added++; else if (x === 'changed') changed++;
        });
        seen.add(m.id); read++;
        st.scanDone++;
        if (st.scanDone % 10 === 0) busyPill('Reading Gmail · ' + st.scanDone + ' of ' + st.scanTotal);
      });
      if (!more) { ls.set(K.lastScan, String(startedAt)); ls.set(K.queryV, QUERY_V); ls.set(K.returnsV, RETURNS_V); }
    } catch (e) {
      scanErr = e instanceof AuthError ? 'auth' : e.message;
    } finally {
      saveSeen(); save(); revive = new Set();
      if (!scanErr && !more) { cleanupOnce(); setTimeout(autoCheck, 600); }
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
  const scanDue = () => ls.get(K.queryV, '') !== QUERY_V || ls.get(K.returnsV, '') !== RETURNS_V || Date.now() - +ls.get(K.lastScan, 0) > 30 * 6e4;

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
        + esc(+ls.get(K.lastScan, 0) ? 'Last checked ' + ago(+ls.get(K.lastScan, 0)) : 'Not checked yet') + '</span></span></button>';
      rows += '<button class="rowbtn" type="button" id="stRescan"><span class="ic">' + I.refresh + '</span><span>Read the last year again<span class="sub">Orders you edited, checked or deleted stay as they are</span></span></button>';
      if (own || ever) rows += '<button class="rowbtn" type="button" id="stOut"><span class="ic">' + I.out + '</span><span>Sign out of Gmail<span class="sub"' + (me ? ' translate="no"' : '') + '>' + esc(me || 'Signed in') + '</span></span></button>';
    } else {
      rows += '<button class="rowbtn" type="button" id="stIn"><span class="ic">' + I.mail + '</span><span>Connect Gmail<span class="sub">Read-only</span></span></button>';
    }
    $('stGmail').innerHTML = rows;
    const PV = window.AllisonOS && window.AllisonOS.ipsy && window.AllisonOS.ipsy.privacy;
    $('stIpsy').innerHTML = '<button class="swrow" type="button" role="switch" id="stIpsyAuto" aria-checked="' + (ls.get(K.ipsyAuto, '') === '1') + '"><span class="grow">Ipsy keeps orders up to date<span class="sub">Ipsy rereads new order emails and To check, and fixes them.</span></span><span class="switch" aria-hidden="true"></span></button>'
      + (PV ? '<button class="swrow" type="button" role="switch" id="stIpsyGmail" aria-checked="' + PV.gmail('orders') + '"><span class="grow">Ipsy can search Gmail<span class="sub">Lets Ipsy search and read your email in chats.</span></span><span class="switch" aria-hidden="true"></span></button>' : '');
    $('stGmailHint').textContent = viaMail ? 'Using Mail’s sign-in from this browser.' : '';
    $('stGmailHint').hidden = !viaMail;
  }
  function openSettings() { renderSettings(); openSheet('setSheet'); }
  // Hidden orders, behind Face ID (the family account's passkey) when this phone has signed in to aOS.
  function lockHidden() {
    if (!st.unlocked) return;
    st.unlocked = false;
    if (st.order && st.order.hide) { st.order = null; closeSheet('opage'); }
    if (st.tab === 'hidden') st.tab = ls.get(K.tab, 'way');
    render();
  }
  // Always Face ID, signed in before or not: a passkey that isn't yours (or none) leaves them hidden.
  $('stHidden').onclick = async () => {
    const A = window.AllisonOS && AllisonOS.account;
    try { if (!A) throw new Error('no-account'); await A.signIn(); }
    catch { toast('Face ID didn’t go through, so hidden orders stay hidden.'); return; }
    st.unlocked = true; st.tab = 'hidden'; st.q = ''; $('q').value = '';
    closeSheet('setSheet'); render(); animateIn($('list'));
  };
  // Design: Vintage or Standard, at once, just on this phone (../home/design.js)
  if (window.aosDesign) { $('stDesign').innerHTML = aosDesign.picker(); aosDesign.bind($('stDesign')); }
  else $('stDesign').previousElementSibling.hidden = $('stDesign').hidden = true;
  $('setBtn').onclick = openSettings;
  $('stIpsy').addEventListener('click', e => {
    if (e.target.closest('#stIpsyGmail')) { const PV = window.AllisonOS.ipsy.privacy; PV.gmail('orders', !PV.gmail('orders')); renderSettings(); return; }
    if (!e.target.closest('#stIpsyAuto')) return;
    const on = ls.get(K.ipsyAuto, '') !== '1';
    ls.set(K.ipsyAuto, on ? '1' : '0'); if (on) ls.set(K.aiOk, '1');
    renderSettings();
    if (on) { ls.del(K.ipsyTried); closeSheet('setSheet'); autoCheck(); }
  });
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
  $('stExport').onclick = async () => {
    const file = new File([JSON.stringify({ app: 'allison-orders', v: 1, kind: 'backup', saved: new Date().toISOString(), orders }, null, 2)], 'orders-backup-' + todayStr() + '.json', { type: 'application/json' });
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
  // The family's Google Sheet: the record of everyone's orders, each one
  // marked with whose it is (aOS/SHEETS.md). This phone keeps a working
  // copy: the last 90 days of orders (by the day each was ordered) and every
  // order not finished yet, whatever its age; older ones come from the Sheet
  // when you look back (Delivered, a search, Ipsy). Syncs go through aOS
  // (../home/sheet.js, functions/sheet/api), signed in, so the phone holds no
  // Sheet link or phrase and only ever gets your own orders. It syncs by
  // itself, with nothing to set up here: the owner links the Sheet in aOS
  // (Account → Google Sheets). Private (hidden from Ipsy) is just another
  // detail of an order here: it syncs like the rest.
  // ---------------------------------------------------------------------
  const APP = 'allison-orders-sync';
  const SH = () => window.AllisonOS && AllisonOS.sheet;
  let syncing = false, syncAgain = false, syncTimer = null, syncState = 'idle', errShown = false;
  let lastSyncAt = +ls.get(K.syncAt, 0) || 0;
  const KEEP_DAYS = 90, FINISHED = ['delivered', 'pickedup', 'cancelled'];
  const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  // The day an order was placed, worked out as the Sheet's script does (google-sheet-sync.gs, orderDay):
  // its order date, else its first step's, else its email's (or when it was added), in UTC.
  function orderDay(o) {
    if (!o) return '';
    if (isDay(o.orderDate)) return o.orderDate;
    const steps = Object.values(o.steps || {}).filter(isDay).sort();
    if (steps.length) return steps[0];
    const t = Number(o.source && o.source.date) || Number(o.created) || 0;
    return t > 0 ? new Date(t).toISOString().slice(0, 10) : '';
  }
  const finished = o => FINISHED.includes(o.status);
  const floorDay = () => P.addDays(todayStr(), -(KEEP_DAYS - 1));
  const pruneFrom = () => synced ? floorDay() : null;
  // What this phone keeps: an order not finished yet, any from the last 90 days, one fetched from the
  // Sheet this session, and the one that's open. Older ones are dropped with no grave (the Sheet keeps them).
  const keepHere = (o, from) => !from || !finished(o) || !orderDay(o) || orderDay(o) >= from || older.has(o.id) || (st.order && st.order.id === o.id);
  const okOrder = o => o && typeof o.id === 'string' && o.status in P.STATUS_NAMES;   // a status this app knows, as the backup import requires
  const SYNC_ERRORS = {
    signin: 'Sign in to sync with the family’s Google Sheet. Until then, Orders keeps everything on this phone.',
    'no-sheet': 'The family’s Orders Sheet isn’t set up yet. The owner sets it up in aOS: Account → Google Sheets.',
    'wrong-secret': 'aOS’s phrase for the Orders Sheet doesn’t match its script any more. The owner updates it in aOS: Account → Google Sheets.',
    'old-script': 'The Orders Sheet is still on its old script. The owner pastes in the new one and deploys a new version (aOS/SHEETS.md).',
    'secret-not-set': 'The Orders Sheet’s script still says SECRET = ‘CHANGE-ME’. The owner changes it and deploys a new version.',
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
    if (await SH().adopt('orders', old)) { ls.del(K.sync); keep.set('sync', null); }
  }
  // Before sending orders the Sheet may already have, with your edits on them, that this phone has only
  // just read from an email (its first sync with the family's Sheet, or older mail read again: a first
  // read of a year of Gmail, or "Read the last year again"), the Sheet's copies of those days come first.
  // What the email said is folded into the Sheet's copy, as a later email would be, so its edits, its
  // checks and Private stay; an order the Sheet doesn't have goes up as new.
  async function lookFirst() {
    const floor = floorDay();
    const strays = orders.filter(o => !older.has(o.id) && !notMine.has(o.id) && orderDay(o)
      && (!synced || ((+o.created || 0) > lastSyncAt && orderDay(o) < floor)));
    if (!strays.length) return;
    const days = strays.map(orderDay).sort();
    const res = await SH().sync('orders', { action: 'range', from: days[0], to: days[days.length - 1] }, { ask: false });
    const here = new Map(orders.map(o => [o.id, o]));
    let n = 0;
    for (const r of (res.orders || []).filter(okOrder)) {
      const l = here.get(r.id);
      if (!l || !((+r.created || 0) < (+l.created || 0))) continue;   // the same copy as the Sheet's: the newest change wins, as ever
      const base = bare(r), x = P.upsert([r], l, {});
      orders[orders.indexOf(l)] = r; if (st.order === l) st.order = r;
      shadow.set('orders:' + r.id, x === 'changed' ? base : bare(r));   // changed: sent, and logged against the Sheet's copy
      outbox = outbox.filter(e => e.id !== 'add-' + l.id + '-' + (l.created || 0));   // not new after all
      if (orderDay(r) < floor) older.add(r.id);
      n++;
    }
    if (n) { ls.set(K.log, JSON.stringify(outbox)); persist(); }
  }
  function applyRemote(res, sentAt) {
    Object.keys(res.graves || {}).forEach(k => { const t = +res.graves[k] || 0; if ((graves[k] || 0) < t) graves[k] = t; });
    if ((res.refused || []).length) { res.refused.forEach(id => notMine.add(id)); ls.set(K.notMine, JSON.stringify([...notMine].slice(-2000))); }
    const from = pruneFrom(), stays = o => keepHere(o, from);
    const map = new Map(orders.filter(stays).map(x => [x.id, x]));
    (res.orders || []).filter(okOrder).filter(stays).forEach(r => {
      const l = map.get(r.id);
      if (!l || (+r.updated || 0) > (+l.updated || 0)) map.set(r.id, r);
    });
    // older finished orders went to the Sheet with this sync: kept there, not here (initShadow below leaves no graves)
    orders = [...map.values()].filter(x => { const g = graves['orders:' + x.id]; return !(g && g >= (+x.updated || 0)); });
    if (st.order && !orders.includes(st.order)) st.order = orders.find(o => o.id === st.order.id) || st.order;
    initShadow(); persist();
    if (orders.some(o => (+o.updated || 0) > sentAt)) syncAgain = true;   // changed while this sync was on its way
    render();
  }
  // Always quietly, and only when signed in (it never asks for Face ID). A real error shows once a session;
  // signed out or no Sheet in aOS yet says nothing: the owner sets the Sheet up in aOS.
  async function sync() {
    if (!SH() || !signedIn()) { syncState = signedIn() ? 'idle' : 'signin'; renderSub(); return false; }
    if (syncing) { syncAgain = true; return false; }
    if (!navigator.onLine) { syncState = 'offline'; renderSub(); return false; }
    syncing = true; syncState = 'syncing'; renderSub();
    let ok = false;
    try {
      track(); persist();
      await lookFirst();
      track(); persist();
      const sentAt = Date.now(), had = orders;
      const res = await SH().sync('orders', { action: 'sync', v: 3, window: KEEP_DAYS, today: todayStr(), orders: orders.filter(o => !notMine.has(o.id)), graves, log: outbox.slice(0, 300) }, { ask: false });
      if (res.app && res.app !== APP) throw new Error('not-json');
      if (!res.aos) throw new Error('old-script');
      lastSyncAt = Date.now(); ls.set(K.syncAt, String(lastSyncAt));
      if (!synced) { synced = true; ls.set(K.family, '1'); }
      syncState = 'ok'; ok = true;
      applyRemote(res, sentAt);
      const got = new Set(res.logged || []);
      outbox = outbox.filter(e => !got.has(e.id)); ls.set(K.log, JSON.stringify(outbox));
      if (got.size && outbox.length) syncAgain = true;
      // The first time this phone's orders reach the Log: what was already in Orders is logged once, so the Log starts complete.
      if (!ls.get(K.logSeed, '')) { had.forEach(o => { if (!notMine.has(o.id)) logEvent('Existing', o, 'Already in Orders when the Log began', 'ex-' + o.id); }); ls.set(K.logSeed, '1'); if (outbox.length) syncAgain = true; }
    } catch (e) {
      const code = e.message === 'wrong-secret' && e.data && !e.data.aos ? 'old-script' : e.message;   // a script from before aOS turns away aOS's request
      syncState = code === 'signin' ? 'signin' : code === 'offline' ? 'offline' : 'error';
      if (!errShown && syncState === 'error' && code !== 'no-sheet') { errShown = true; toast(SYNC_ERRORS[code] || 'Sync didn’t work. Trying again later.', null, 6000); }
    } finally {
      syncing = false; renderSub();
      if (syncAgain) { syncAgain = false; scheduleSync(800); }
    }
    return ok;
  }
  // Looking back past the 90 days this phone keeps: those days come from the Sheet (each range once a
  // session), and stay here until the next start. loud: you asked (Face ID if you're signed out).
  // { got: how many orders the Sheet had for those days, added: how many weren't here already }, or null when it wasn't asked.
  const olderAsked = new Set();
  async function loadOlder(from, to, loud) {
    const floor = pruneFrom();
    if (!floor || from >= floor || !SH() || (!loud && !signedIn()) || !navigator.onLine) return null;
    if (to >= floor) to = P.addDays(floor, -1);
    const key = from + '|' + to; if (olderAsked.has(key)) return null;
    olderAsked.add(key);
    try {
      const res = await SH().sync('orders', { action: 'range', from, to }, { ask: !!loud });
      const got = (res.orders || []).filter(okOrder);
      let n = 0;
      for (const x of got) {
        if (graves['orders:' + x.id] >= (+x.updated || 0)) continue;
        older.add(x.id);
        if (orders.some(y => y.id === x.id)) continue;
        orders.push(x); shadow.set('orders:' + x.id, bare(x)); n++;
      }
      if (n) { persist(); render(); }
      return { got: got.length, added: n };
    } catch (e) { olderAsked.delete(key); if (loud) throw e; return null; }
  }
  // "Show older orders from the Sheet", at the end of Delivered and of a search: a year further back each time.
  async function showOlder() {
    const floor = pruneFrom();
    if (!floor || past.busy) return;
    const to = P.addDays(past.day || floor, -1), from = P.addDays(to, -364);
    past.busy = true; render();
    try {
      const r = await loadOlder(from, to, true);
      past.day = from;
      if (r && !r.got) past.end = true;
      else if (r) toast(r.added ? 'Found ' + plural(r.added, 'older order') + ', ' + fmtMD(from) + ' to ' + fmtMD(to) + '.' : 'Nothing more from ' + fmtMD(from) + ' to ' + fmtMD(to) + '.');
    } catch (e) {
      toast(SYNC_ERRORS[e.message] || 'Couldn’t reach the Sheet. Try again in a minute.', null, 6000);
    } finally { past.busy = false; render(); }
  }
  // Ipsy, asked about orders from before the 90 days (or about any order with no dates given: the last
  // year, as Gmail is read): those come from the Sheet first, quietly.
  const lookBack = from => {
    const f = pruneFrom();
    if (!f || (from && from >= f)) return Promise.resolve(null);
    return loadOlder(from || P.addDays(f, -365), P.addDays(f, -1));
  };
  function scheduleSync(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(() => sync(), ms == null ? 2000 : ms); }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') { lockHidden(); return; }
    if (Date.now() - lastSyncAt > 30000) sync();
    if (getToken() && scanDue()) scan();
    render();
  });
  window.addEventListener('online', () => sync());
  addEventListener('aos:account', e => { if (e.detail) handOver().then(() => sync()); else renderSub(); });

  // ---------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------
  const back = consumeRedirect();
  // An old setup link from another phone (#sync=…): aOS keeps the Sheet now, so it's only taken off the address.
  if (location.hash.startsWith('#sync=')) history.replaceState(null, '', location.pathname + location.search);
  if (+ls.get(K.lastScan, 0)) cleanupOnce();
  render();
  if (back && back.error) {
    if (!(back.silent && /^(interaction|login|consent|account_selection)_required$/.test(back.error))) toast(back.error === 'access_denied' ? 'Gmail access was declined.' : 'Gmail sign-in didn’t work (' + back.error + ').', null, 6000);
    else toast('Gmail needs one tap to sign in again: Settings → Connect Gmail.', null, 6000);
  }
  // Read Gmail on open: always after a sign-in, else if it's been a while.
  if (getToken() && (back && back.ok || scanDue())) setTimeout(() => scan({ loud: !!(back && back.ok) }), 400);
  else if (!getToken() && mayRenew() && Date.now() - +ls.get(K.lastScan, 0) > 6 * H) setTimeout(() => signIn({ silent: true }), 800);
  // The family's Sheet: what this phone kept of its old link goes to aOS, then a sync (Gmail is read after it).
  startSync = sleep(600).then(handOver).catch(() => {}).then(() => sync());
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

  // Ipsy (../home/ipsy.js), the helper you chat with: its tools (ipsy-tools.js) work on these same
  // orders and this same Gmail sign-in; Claude answers through functions/orders/api (ipsy).
  if (window.AllisonOS && window.AllisonOS.ipsy && window.OrdersIpsy) {
    const TAB_NAMES = { way: 'the On the way list', done: 'the Delivered list', check: 'the To check list' };
    ipsy = window.AllisonOS.ipsy.mount({
      app: 'orders', name: 'Orders', endpoint: '../orders/api/ipsy', headers: { 'X-Orders': '1' }, slot: document.querySelector('.dock > span'),
      ...window.OrdersIpsy({
        P, get orders() { return orders; }, set orders(v) { orders = v; }, save, render, todayStr, isOpen, needsCheck, checkReason, kindOn,
        gmail, bodies, header, getToken, AuthError, openOrder, lookBack, current: () => (!$('opage').hidden && st.order) || null,
        closeOrder: id => { if (st.order && st.order.id === id) { st.order = null; closeSheet('opage'); } },
        refreshOrder: () => { if (st.order && !orders.includes(st.order)) { const o = orders.find(x => x.id === st.order.id); if (o) { st.order = o; renderOrder(); } else { st.order = null; closeSheet('opage'); } } },
        screen: () => st.q ? 'search results' + (orders.some(o => o.private || o.hide) ? '' : ' for "' + st.q + '"') : TAB_NAMES[st.tab] || 'the order list',   // a search could name a private order
      }),
    });
    setTimeout(autoCheck, 2500);   // To check and orders on their way with an email Ipsy hasn't read (a read of Gmail checks again when it's done)
  }

  // For the tests (orders/scripts/app-test.mjs) only.
  window.__orders = { get orders() { return orders; }, tidy: cleanupOnce, get kinds() { return kinds; }, upsert: f => P.upsert(orders, f, { graves, revive }), render, scan, save, needsCheck, stale,
    sync, orderDay, pruneFrom, older, notMine, graves: () => graves };
})();
