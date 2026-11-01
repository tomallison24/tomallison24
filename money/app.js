"use strict";

// Money: where the family's money goes, from Monarch's alert emails.
//
// - Monarch has no API for its members, but it emails each expense and deposit
//   over the amounts set in its notification settings (set both to $1 and it's
//   every one), and a bank it can no longer sync. parse.js reads those emails;
//   calc.js does the sums.
// - One page, four views from the pill at the bottom (as Home's views):
//   This month (spent against the usual, with a meter and Trends behind it: week by
//   week and day by day; where you could save and by category, folded until opened),
//   Transactions (search them all), Cards and rewards (spending per
//   card, rewards a month as a chart, a better card for a kind of spend) and
//   Recurring (what repeats, and what it costs a year). A bank Monarch can't
//   sync shows as a card at the top of This month until it syncs again or you
//   tap Fixed it.
// - Categories are Monarch's, as its emails say, until someone changes one: on a transaction's sheet
//   (Change: always for that merchant, or just this one), or by accepting one of Ipsy's ideas (merge a
//   category into another, move a merchant), from Settings > Categories > Ask Ipsy for ideas and once
//   a month on its own. Kept in the shared settings (calc.js, recat), so whoever sees Money sees them
//   and may change them; Monarch's own category stays underneath (Use Monarch's puts it back).
// - Ipsy, the helper you chat with (../home/ipsy.js), for whoever is signed in and sees Money: ask
//   it about your spending (ipsy-tools.js, read-only; Claude through ../money/api, no web search).
// - Once a day the reader's phone has Ipsy check this month's new transactions against
//   their Monarch emails (functions/money/api, POST check: Claude Sonnet 5.5): what passed is
//   marked and never sent again; a misreading is corrected from the email's own words (Undo
//   puts the app's reading back); one Ipsy couldn't confirm is marked Check.
// - One phone reads Monarch's emails from its own Gmail, read-only (with Mail's
//   Google client, as Orders and Travel do): Money's reader. Signed in to the
//   family account, it sends what it read to aOS (functions/money/api), and the
//   family members it picks in Settings > Who sees Money see it too; their
//   phones only ever get it from there. Signed out, it all stays on the phone.
// - Data on this phone: IndexedDB allison-money, five years of it (calc.js, prune), as in
//   aOS (functions/money/api). Settings > Card rewards
//   (each card's cash back), the online stores and the alerts marked fixed are
//   shared with whoever sees Money.
// - Five designs, picked in Settings > Design (../home/design.js).

// Refuse to run inside another site's frame; this same site may (see Mail's app.js for why).
if (window.top !== window.self && (() => { try { return window.top.location.origin !== location.origin; } catch { return true; } })()) {
  document.body.textContent = 'Money can’t be opened inside another page.';
  throw new Error('Money refuses to run inside a frame');
}

(function () {
  const P = window.MoneyParse, C = window.MoneyCalc;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const no = s => '<span translate="no">' + esc(s) + '</span>';   // what came from the emails: a name, a card, a category
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    json: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
    del: k => { try { localStorage.removeItem(k); } catch {} },
  };
  const pad = n => String(n).padStart(2, '0');
  const plural = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const H = 3600e3;

  // Mail's OAuth client (not a secret: see mail/app.js). Money's own address must be added to it as
  // a redirect URI once - money/README.md, "Gmail".
  const CLIENT_ID = '804406956056-e91hbdndc4cqgerh9sffl9fmt76nfpua.apps.googleusercontent.com';
  const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
  const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
  const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
  const KEY = 'allison-money-v1';
  const K = { token: 'money.token', state: 'money.state', silent: 'money.silent', silentFail: 'money.silentFail', lastAuth: 'money.lastAuth', hint: 'money.hint', view: KEY + '-view', checkOff: KEY + '-check-off', open: KEY + '-open', cut: KEY + '-scan-cut' };
  // Inside aOS, reading Gmail, sending it to the family's copy and the daily check count as an update under way: aOS
  // doesn't put Money away or start it again until it's done (../home/welcome.js AllisonOS.updating).
  const updating = (task, on) => { try { AllisonOS.updating(task, on); } catch {} };
  // due: an hour since the last read, or one was cut off (Money closed, the phone): it goes on as soon as Money is back
  const scanDue = () => !!ls.get(K.cut, '') || Date.now() - D.lastScan > H;
  const FIRST_SCAN = 'newer_than:5y';   // as much as Money keeps (calc.js, KEEP_MONTHS)
  const API = '../money/api/';

  const I = {
    chevL: '<svg viewBox="0 0 24 24" class="b"><path d="M14.6 5.4L8.4 11.3a1 1 0 0 0 0 1.4l6.2 5.9"/></svg>',
    chevR: '<svg viewBox="0 0 24 24" class="b"><path d="M9.4 5.4l6.2 5.9a1 1 0 0 1 0 1.4l-6.2 5.9"/></svg>',
    tick: '<svg viewBox="0 0 24 24" class="b"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>',
    warn: '<svg viewBox="0 0 24 24"><path d="M12 4.2l9 15.6H3z"/><path d="M12 10v4.4M12 17.2v.1"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M13.6 4h6.4v6.4"/><path d="M20 4l-9 9"/><path d="M17.6 13.6v3.6a2.8 2.8 0 0 1-2.8 2.8H6.8A2.8 2.8 0 0 1 4 17.2V9.2a2.8 2.8 0 0 1 2.8-2.8h3.6"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="2.8" y="5" width="18.4" height="14" rx="3.4"/><path d="M3.6 7.4l7.2 5a2 2 0 0 0 2.4 0l7.2-5"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.4"/><path d="M15.6 15.6l4.6 4.6"/></svg>',
    month: '<svg viewBox="0 0 24 24"><rect x="3.4" y="4.6" width="17.2" height="16" rx="3.2"/><path d="M3.4 9.6h17.2M8 2.8v3.6M16 2.8v3.6"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M8.6 6.6h11.2M8.6 12h11.2M8.6 17.4h11.2"/><circle cx="4.6" cy="6.6" r="1" fill="currentColor"/><circle cx="4.6" cy="12" r="1" fill="currentColor"/><circle cx="4.6" cy="17.4" r="1" fill="currentColor"/></svg>',
    card: '<svg viewBox="0 0 24 24"><rect x="2.8" y="5.4" width="18.4" height="13.2" rx="2.8"/><path d="M2.8 9.8h18.4M6.4 14.8h4"/></svg>',
    repeat: '<svg viewBox="0 0 24 24"><path d="M17 3.6l3 3-3 3"/><path d="M4 11.4V10a3.4 3.4 0 0 1 3.4-3.4H20"/><path d="M7 20.4l-3-3 3-3"/><path d="M20 12.6V14a3.4 3.4 0 0 1-3.4 3.4H4"/></svg>',
    trend: '<svg viewBox="0 0 24 24"><path d="M3.6 16.4l5.6-5.6 4 4 7.2-7.2"/><path d="M15.4 7.6h5v5"/></svg>',
    store: '<svg viewBox="0 0 24 24"><path d="M4 9.4l1.4-4.8h13.2L20 9.4"/><path d="M4 9.4h16v1a2.6 2.6 0 0 1-5.2 0 2.6 2.6 0 0 1-5.2 0 2.6 2.6 0 0 1-5.6 0z"/><path d="M5.4 12.6v6.8h13.2v-6.8"/></svg>',
  };

  // ---------------------------------------------------------------------
  // Money, dates and words
  // ---------------------------------------------------------------------
  const usd = (n, cents) => (n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  const usd2 = n => usd(n, true);
  const usdR = n => usd(n, Math.abs(n) < 100 && Math.round(n) !== n);   // whole dollars from $100 up
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => ymd(new Date());
  const noon = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +(s.slice(8, 10) || 1), 12);
  const monthName = ym => noon(ym + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthShort = ym => noon(ym + '-01').toLocaleDateString('en-US', { month: 'short' });
  const dayName = s => noon(s).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const short = s => noon(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const ago = t => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : plural(Math.round(m / 1440), 'day') + ' ago'; };
  const EVERY = { weekly: 'Weekly', 'every 2 weeks': 'Every 2 weeks', monthly: 'Monthly', 'every 3 months': 'Every 3 months', yearly: 'Yearly' };
  const KIND = { online: 'Online shopping', grocery: 'Groceries and wholesale clubs', base: 'Everything else' };

  // ---------------------------------------------------------------------
  // Data: { tx: [transactions], alerts: [], hints: [], settings, mAt: { 'YYYY-MM': when the family's
  // copy of that month was last taken }, dirty: [months read here, not sent yet], setDirty, seen: [Gmail
  // ids read], lastScan, readAt }
  // ---------------------------------------------------------------------
  const D = { tx: [], alerts: [], hints: [], settings: null, mAt: {}, dirty: [], setDirty: false, seen: [], lastScan: 0, readAt: 0, reader: '', checkDay: '', lastCheck: null };
  // Kept in IndexedDB (allison-money, store kv, key 'data'): five years of transactions is a few MB,
  // and localStorage's 5 MB or so is shared by every aOS app. A phone that kept Money in localStorage
  // (KEY, before) has it moved over once; with no IndexedDB (an old private window) it stays there.
  // Saving stamps KEY + '-at' in localStorage, so another tab of Money reads it again ('storage').
  const store = (() => {
    let db = null;
    const open = () => db || (db = new Promise((res, rej) => {
      const r = indexedDB.open('allison-money', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = (mode, fn) => open().then(d => new Promise((res, rej) => {
      const t = d.transaction('kv', mode), q = fn(t.objectStore('kv'));
      t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    }));
    return { get: k => tx('readonly', s => s.get(k)), set: (k, v) => tx('readwrite', s => s.put(v, k)) };
  })();
  let idb = !!window.indexedDB;
  async function load() {
    let d = null;
    if (idb) { try { d = await store.get('data'); } catch { idb = false; } }
    const old = ls.json(KEY, null);
    if (idb && old) {
      if (!d) { try { await store.set('data', old); d = old; } catch { idb = false; } }
      if (idb) ls.del(KEY);
    }
    if (!idb) d = old;
    d = d || {};
    D.tx = Array.isArray(d.tx) ? C.prune(d.tx.filter(C.okTx), today()) : [];
    D.alerts = Array.isArray(d.alerts) ? d.alerts.filter(a => a && a.id) : [];
    D.hints = Array.isArray(d.hints) ? d.hints.filter(h => h && h.name) : [];
    D.settings = d.settings && typeof d.settings === 'object' ? d.settings : null;
    D.mAt = d.mAt && typeof d.mAt === 'object' ? d.mAt : {};
    D.dirty = Array.isArray(d.dirty) ? d.dirty : [];
    D.setDirty = !!d.setDirty;
    D.seen = Array.isArray(d.seen) ? d.seen : [];
    D.lastScan = +d.lastScan || 0; D.readAt = +d.readAt || 0; D.reader = d.reader || '';
    D.checkDay = d.checkDay || ''; D.lastCheck = d.lastCheck && typeof d.lastCheck === 'object' ? d.lastCheck : null;
  }
  let warned = false, saving = null, again = false;
  const full = () => { if (!warned) { warned = true; toast('This phone couldn’t save Money: its storage is full.'); } };
  // Five years at most (calc.js, prune), then saved; saves while one is under way fold into one more.
  function persist() {
    D.tx = C.prune(D.tx, today());
    const from = C.keepFrom(today());
    for (const ym of Object.keys(D.mAt)) if (ym < from) delete D.mAt[ym];
    D.dirty = D.dirty.filter(ym => ym >= from);
    if (!idb) { if (!ls.set(KEY, JSON.stringify(D))) full(); else ls.set(KEY + '-at', String(Date.now())); return; }
    if (saving) { again = true; return; }
    saving = store.set('data', D)
      .then(() => ls.set(KEY + '-at', String(Date.now())), full)
      .then(() => { saving = null; if (again) { again = false; persist(); } });
  }
  const settings = () => D.settings || { cards: {}, dismissed: [], at: 0 };
  // Every transaction as the family sees it: Monarch's category, or the one they gave it (calc.js, recat).
  // Under that, the amount, date and card the family fixed by hand (calc.js, edited); D.tx keeps what was read.
  const base = () => C.edited(D.tx, settings());
  const view = () => (st.T = C.recat(base(), settings()));
  const byId = id => (st.T || view()).find(t => t.id === id);
  function changeSettings(fn) {
    const s = JSON.parse(JSON.stringify(settings()));
    s.cards = s.cards || {}; s.dismissed = s.dismissed || [];
    fn(s); s.at = Date.now();
    D.settings = s; D.setDirty = true; persist(); render(); scheduleSync();
  }

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const VIEWS = [
    { id: 'month', name: 'This month', sub: 'Spent, the usual, where to save', icon: I.month },
    { id: 'activity', name: 'Transactions', sub: 'Every one, and search', icon: I.list },
    { id: 'cards', name: 'Cards and rewards', sub: 'Spending and cash back per card', icon: I.card },
    { id: 'repeats', name: 'Recurring', sub: 'What repeats, and a year of it', icon: I.repeat },
  ];
  const curYm = () => today().slice(0, 7);
  const st = { view: VIEWS.some(v => v.id === ls.get(K.view, '')) ? ls.get(K.view, '') : 'month', ym: curYm(), q: '', server: null, reading: false, list: null, mailBad: '' };

  // Each card its own colour, in the order of what's been spent on them (the same on every view).
  function cardColours() {
    const all = base(), acct = C.accounts(all), tot = new Map();
    for (const x of all) if (x.dir === 'out') { const a = acct(x).name; if (a) tot.set(a, (tot.get(a) || 0) + x.amt); }
    const order = [...tot].sort((a, b) => b[1] - a[1]).map(e => e[0]);
    return name => { const i = order.indexOf(name); return i >= 0 && i < 6 ? String(i) : 'x'; };
  }

  // ---------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------
  const main = $('main');
  function render() {
    view();
    drawBar();
    placeIpsy();
    $('readBtn').hidden = !hasGmail() || !mayRead();
    if (!D.tx.length && !D.alerts.length) { main.innerHTML = emptyHtml(); return; }
    main.innerHTML = { month: monthHtml, activity: activityHtml, cards: cardsHtml, repeats: repeatsHtml }[st.view]();
    if (st.view === 'activity') { const s = $('q'); if (s && st.focusQ) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); st.focusQ = false; } }
  }
  function emptyHtml() {
    const s = st.server, signed = signedIn();
    let t, d, btn = '';
    if (signed && s && !s.can && !s.open && s.readerName) {
      t = s.readerName + '’s phone reads Monarch’s emails';
      d = 'Ask ' + s.readerName + ' to share Money with you: Settings, Who sees Money.';
    } else if (st.reading) {
      t = 'Reading Monarch’s emails…'; d = 'The first time takes a minute.';
    } else if (hasGmail()) {
      t = 'No Monarch emails yet'; d = 'Money found no emails from Monarch in this Gmail. In Monarch, set the expense and deposit alerts to $1 (Settings, Notifications) and they’ll show here.';
      btn = '<button class="btn" type="button" data-act="read">Read Gmail again</button>';
    } else {
      t = 'See where your money goes'; d = 'Money reads Monarch’s alert emails from your Gmail, read-only, and shows this month against the usual, each card’s spending and rewards, and what repeats.';
      btn = '<button class="btn" type="button" data-act="connect">Connect Gmail</button>';
      if (!signed) d += ' Already shared with you? Sign in with Face ID in Settings.';
    }
    return '<div class="empty"><strong>' + esc(t) + '</strong>' + esc(d) + btn + '</div>';
  }
  const navRow = () => {
    const cur = st.ym === curYm();
    return '<div class="navrow"><button class="iconbtn" type="button" data-act="prev" aria-label="Previous month">' + I.chevL + '</button><span class="lbl">' + esc(monthName(st.ym)) + '</span>'
      + '<button class="iconbtn" type="button" data-act="next" aria-label="Next month"' + (cur ? ' disabled style="opacity:.35"' : '') + '>' + I.chevR + '</button></div>';
  };
  // A bank Monarch can't sync: one card each.
  function alertsHtml() {
    return C.openAlerts(D.alerts, D.tx, settings().dismissed, today()).map(a => '<div class="alert" role="group" aria-label="Sync problem">' + I.warn
      + '<div class="at"><strong>' + (a.inst ? no(a.inst) + ' <span>isn’t syncing with Monarch</span>' : 'A bank isn’t syncing with Monarch') + '</strong>'
      + no(a.what) + ' · ' + esc(short(a.date)) + '<span>. Transactions from it won’t show until it’s fixed.</span>'
      + '<div class="chips"><a class="chip" href="https://app.monarch.com/settings/institutions" target="_blank" rel="noopener">' + I.ext + 'Fix in Monarch</a>'
      + '<button class="chip quiet" type="button" data-fixed="' + esc(a.id) + '">' + I.tick + 'Fixed it</button></div></div></div>').join('');
  }
  // This month: the one number (tap it for the trends sheet), then each section folded away until you open it.
  function monthHtml() {
    const ym = st.ym, T = st.T, m = C.month(T, ym), cmp = C.compare(T, ym), pace = C.pace(T, ym, today()), min = C.minFor(T, ym, 'out');
    const spent = cmp && cmp.likeForLike ? cmp.spent : m.spent;
    let delta = '';
    if (cmp && cmp.avg > 0) {
      const d = cmp.diff, pct = Math.round(Math.abs(d) / cmp.avg * 100);
      delta = '<span class="delta ' + (d > 0 ? 'more' : 'less') + '">' + (d > 0 ? '▲ ' : '▼ ') + esc(usdR(Math.abs(d))) + ' (' + pct + '%) <span>' + (d > 0 ? 'more than usual' : 'less than usual') + '</span></span>';
    }
    // the meter: spent so far, the usual as a mark, and where this pace ends the month as a paler run
    let meter = '';
    if (cmp || pace) {
      const scale = Math.max(spent, cmp ? cmp.avg : 0, pace || 0) * 1.04 || 1, pc = v => (Math.min(v, scale) / scale * 100).toFixed(1);
      meter = '<span class="meter" aria-hidden="true">' + (pace > spent ? '<i class="pace" style="width:' + pc(pace) + '%"></i>' : '') + '<i class="fill' + (cmp && spent > cmp.avg ? ' over' : '') + '" style="width:' + pc(spent) + '%"></i>'
        + (cmp ? '<i class="mark" style="left:' + pc(cmp.avg) + '%"></i>' : '') + '</span>'
        + '<span class="mkey">' + (cmp ? '<span><i class="k-mark"></i>Usual <b>' + esc(usdR(cmp.avg)) + '</b></span>' : '') + (pace ? '<span><i class="k-pace"></i>On pace for <b>' + esc(usdR(pace)) + '</b></span>' : '') + '</span>';
    }
    const sum = '<button class="sum" type="button" id="sumBtn" aria-label="' + esc(usdR(spent) + ' spent in ' + monthName(ym) + (cmp ? ', usual ' + usdR(cmp.avg) : '') + (pace ? ', on pace for ' + usdR(pace) : '') + '. Open trends') + '">'
      + '<span class="big"><b>' + esc(usdR(spent)) + '</b><span>spent' + (cmp && cmp.likeForLike ? ' <span>(over ' + esc(usdR(cmp.min)) + ')</span>' : '') + '</span><span class="more">' + I.trend + 'Trends' + I.chevR + '</span></span>'
      + delta + meter + '</button>';
    const tips = C.tips(T, ym, today(), settings());
    const save = tips.filter(t => t.kind === 'card').reduce((a, t) => a + t.more, 0);
    const tipsHtml = tips.length ? section('save', 'Where you could save', I.trend, '<span class="badge">' + tips.length + '</span>' + (save >= 1 ? '<span class="sv">+' + esc(usdR(save)) + ' <span>back</span></span>' : ''),
      '<div class="rgroup">' + tips.map(t => tipHtml(t, m)).join('') + '</div>') : '';
    const top = Math.max(1, ...m.cats.map(c => c.total)), avgOf = name => cmp && (cmp.cats.find(c => c.name === name) || {}).avg;
    const k = i => i < 6 ? String(i) : 'x';
    // the summary's strip: each category's share of the month, in the same colours as its row
    const strip = '<span class="strip" aria-hidden="true">' + m.cats.map((c, i) => '<i data-k="' + k(i) + '" style="flex:' + c.total.toFixed(2) + '"></i>').join('') + '</span>';
    const cats = m.cats.length ? section('cats', 'By category', I.list, '<span class="cnt">' + esc(plural(m.out, 'charge')) + '</span>', '<div class="rgroup">' + m.cats.map((c, i) => {
      const a = avgOf(c.name);
      return '<button class="row" type="button" data-cat="' + esc(c.name) + '"' + (a ? ' aria-label="' + esc(c.name + ': ' + usdR(c.total) + ', usual ' + usdR(a)) + '"' : '') + '><span class="em" aria-hidden="true" data-k="' + k(i) + '">' + esc(c.emoji || '•') + '</span><span class="rt"><b>' + no(c.name) + '</b><small><span>' + esc(plural(c.n, 'charge')) + '</span>'
        + (a ? ' · <span>usual</span> ' + esc(usdR(a)) : '') + '</small><span class="bar" aria-hidden="true"><i data-k="' + k(i) + '" style="width:' + (c.total / top * 100).toFixed(1) + '%"></i>' + (a ? '<u style="left:' + Math.min(100, a / top * 100).toFixed(1) + '%"></u>' : '') + '</span></span><span class="rv">' + esc(usdR(c.total)) + '</span></button>';
    }).join('') + '</div>', strip) : '<div class="empty"><strong>Nothing this month yet</strong>Monarch hasn’t emailed anything for ' + esc(monthName(ym)) + '.</div>';
    const cover = min >= 20 ? '<p class="note">Monarch emailed only charges over ' + esc(usdR(min)) + ' in ' + esc(monthName(ym)) + ', so smaller ones aren’t here.</p>' : '';
    const fixedN = D.tx.filter(x => C.ymOf(x.date) === ym && x.check && x.check.s === 'fixed').length, flagN = D.tx.filter(x => C.ymOf(x.date) === ym && x.check && x.check.s === 'flag').length;
    const checked = fixedN || flagN ? '<button class="tip row rgroup" type="button" data-act="checked"><span class="em" aria-hidden="true">' + I.tick + '</span><span class="tt"><b>Ipsy’s check</b> '
      + (fixedN ? '<span>' + esc(plural(fixedN, 'correction')) + '</span>' : '') + (fixedN && flagN ? ', ' : '') + (flagN ? '<span>' + esc(flagN + ' to look at') + '</span>' : '') + '</span><span class="tv">' + I.chevR + '</span></button>' : '';
    return alertsHtml() + navRow() + sum + checked + (ym === curYm() ? ideasHtml() : '') + tipsHtml + cats + cover;
  }
  // A section of This month, folded away until it's opened (and kept open or shut on this phone).
  const secOpen = id => { const o = ls.json(K.open, {}); return !!o[id]; };
  const section = (id, title, icon, aside, body, under) => '<details class="sec" data-sec="' + id + '"' + (secOpen(id) ? ' open' : '') + '><summary><span class="si" aria-hidden="true">' + icon + '</span><span class="st">' + esc(title) + '</span>'
    + aside + '<span class="chev" aria-hidden="true">' + I.chevR + '</span>' + (under || '') + '</summary>' + body + '</details>';
  // Ipsy's ideas for the categories (Settings > Categories, and once a month): Accept or No thanks.
  const ideaWhat = i => i.kind === 'merge' ? '<span>Merge</span> ' + no(i.from) + ' <span>into</span> ' + no(i.to) : '<span>Move</span> ' + no(i.merchant) + ' <span>to</span> ' + no(i.to);
  function ideasHtml() {
    const list = (settings().ideas || {}).list || [];
    if (!list.length) return '';
    return section('ideas', 'Ipsy’s ideas for your categories', '<span>💡</span>', '<span class="badge">' + list.length + '</span>', '<div class="rgroup">' + list.map(i => '<div class="tip"><span class="em" aria-hidden="true">💡</span><span class="tt"><b>' + ideaWhat(i) + '</b> '
      + (i.why ? '<span translate="no">' + esc(i.why) + '</span>' : '')
      + '<span style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="chip" type="button" data-idea-ok="' + esc(i.id) + '">' + I.tick + 'Accept</button><button class="chip quiet" type="button" data-idea-no="' + esc(i.id) + '">No thanks</button></span></span></div>').join('') + '</div>');
  }
  // One way to save, drawn more than written: a category against its usual as two bars, a merchant's share of the month.
  function tipHtml(t, m) {
    const pair = (a, b, cls) => '<span class="cmp" aria-hidden="true"><i class="' + cls + '" style="width:' + (a / Math.max(a, b, 1) * 100).toFixed(1) + '%"></i><i class="was" style="width:' + (b / Math.max(a, b, 1) * 100).toFixed(1) + '%"></i></span>';
    if (t.kind === 'spike') return '<div class="tip" role="group" aria-label="' + esc(t.cat + ' is well over its usual: ' + usdR(t.now) + ' against ' + usdR(t.avg)) + '"><span class="em" aria-hidden="true">' + esc(t.emoji || '•') + '</span><span class="tt"><b>' + no(t.cat) + '</b> <small><span>this month</span> ' + esc(usdR(t.now)) + ' · <span>usual</span> ' + esc(usdR(t.avg)) + '</small>' + pair(t.now, t.avg, 'now') + '</span><span class="tv">+' + esc(usdR(t.diff)) + '<small>over</small></span></div>';
    if (t.kind === 'card') return '<div class="tip"><span class="em" aria-hidden="true">' + I.card + '</span><span class="tt"><b>' + esc(KIND[t.kindOf]) + '</b> <small><span>on</span> ' + no(t.from) + ' (' + t.fromRate + '%): <span>use</span> ' + no(t.to) + ' (' + t.rate + '%) <span>instead, on the last 3 months’</span> ' + esc(usdR(t.spent)) + '</small></span><span class="tv save">+' + esc(usd2(t.more)) + '<small>back</small></span></div>';
    if (t.kind === 'merchant') { const share = m && m.spent ? Math.round(t.total / m.spent * 100) : 0; return '<div class="tip"><span class="em" aria-hidden="true">' + I.store + '</span><span class="tt"><b>' + no(t.merchant) + '</b> <small><span>where the most went:</span> ' + esc(plural(t.n, 'charge')) + (share ? ', ' + share + '% <span>of the month</span>' : '') + '</small>' + (share ? '<span class="cmp" aria-hidden="true"><i class="now" style="width:' + share + '%"></i></span>' : '') + '</span><span class="tv">' + esc(usdR(t.total)) + '</span></div>'; }
    if (t.kind === 'recurring') return '<button class="tip row" type="button" data-view="repeats"><span class="em" aria-hidden="true">' + I.repeat + '</span><span class="tt"><b>' + esc(plural(t.n, 'recurring charge')) + '</b> <small>Any to cut?</small></span><span class="tv">' + esc(usdR(t.total)) + '<small>a year</small></span></button>';
    return '';
  }
  // ---------------------------------------------------------------------
  // Trends (tap This month's number): the month in four numbers, week by week against a usual week
  // (tap a week for where it went), and the month day by day against the usual month.
  // ---------------------------------------------------------------------
  const tr = { sel: null, day: null, R: null };
  // Weeks start on Sunday, unless Monday was picked in Calendar (as Drinks).
  const weekStart = () => { const c = ls.json('allison-calendar-v1-settings', {}); return c.weekStart === 1 && c.weekStartPicked ? 1 : 0; };
  const addDays = (s, n) => { const d = noon(s); d.setDate(d.getDate() + n); return ymd(d); };
  function trData() {
    const ym = st.ym, T = st.T, cur = ym === curYm(), cmp = C.compare(T, ym), min = cmp ? cmp.min : C.minFor(T, ym, 'out');
    const days = C.daysIn(ym), upTo = cur ? +today().slice(8, 10) : days;
    const weeks = C.weeks(T, cur ? today() : ym + '-' + pad(days), 8, weekStart(), min);
    return { ym, cur, cmp, min, days, upTo, weeks, m: C.month(T, ym, min), all: C.month(T, ym), pace: C.pace(T, ym, today()),
      usualWeek: cmp ? cmp.avg * 12 / 52 : null, run: C.byDay(T, ym, min), usual: cmp ? C.usualByDay(T, cmp.months, days, min) : null };
  }
  function openTrends() {
    view(); tr.sel = null; tr.day = null;
    $('trLbl').textContent = monthName(st.ym);
    renderTrends(); openSheet('trSheet');
  }
  function renderTrends() {
    const R = tr.R = trData(), cmp = R.cmp, spent = R.m.spent;
    const kpi = (l, v, d, cls) => '<div class="kpi"><span class="kl">' + l + '</span><span class="kv">' + v + '</span><span class="kd' + (cls ? ' ' + cls : '') + '">' + (d || '&nbsp;') + '</span></div>';
    const pct = cmp && cmp.avg > 0 ? Math.round((spent - cmp.avg) / cmp.avg * 100) : null;
    const kpis = '<div class="kpis">'
      + kpi('Spent', esc(usdR(spent)), pct == null ? esc(plural(R.m.out, 'charge')) : (pct > 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '% <span>against the usual</span>', pct == null ? '' : pct > 0 ? 'bad' : 'good')
      + kpi('Usual a month', cmp ? esc(usdR(cmp.avg)) : '—', cmp ? esc(cmp.months.slice().reverse().map(monthShort).join(', ')) : 'Not enough months yet')
      + (R.pace ? kpi('At this rate', esc(usdR(R.pace)), '<span>by the end of the month</span>', cmp && R.pace > cmp.avg ? 'bad' : '') : kpi('Charges', String(R.m.out), esc(plural(R.m.cats.length, 'category'))))
      + (R.all.income > 0 ? kpi('Left over', esc(usdR(R.all.income - R.all.spent)), '<span>of</span> ' + esc(usdR(R.all.income)) + ' <span>in</span>', R.all.income < R.all.spent ? 'bad' : 'good')
        : kpi('A usual week', R.usualWeek ? esc(usdR(R.usualWeek)) : '—', R.usualWeek ? '<span>from the usual month</span>' : ''))
      + '</div>';
    const like = cmp && cmp.likeForLike ? '<p class="anote">Counting charges over ' + esc(usdR(cmp.min)) + ' only, on both sides: Monarch emailed only those then.</p>' : '';
    $('trBody').innerHTML = kpis
      + '<p class="sechead"><span>Week by week</span><span>Tap a week</span></p><div class="chartcard" id="trWeeks">' + weeksHtml(R) + '</div>'
      + '<p class="sechead"><span>Through the month</span><span>Tap a day</span></p><div class="chartcard" id="trRun">' + runHtml(R) + '</div>' + like;
  }
  // The chart's frame, as Drinks' Analysis: grid, ticks, and a scale that ends on a round number.
  const CW = 340, PL = 40, PR = 8, PT = 14, PB = 22;
  function scale(max) {
    const step = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000].find(s => Math.max(1, max) / s <= 4) || 100000;
    return { top: Math.ceil(Math.max(1, max) / step) * step, step };
  }
  const money$ = v => v >= 1000 ? '$' + (v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'k' : '$' + v;
  function gridLines(sc, y, H) {
    let g = '';
    for (let v = 0; v <= sc.top; v += sc.step) g += '<line class="grid" x1="' + PL + '" x2="' + (CW - PR) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text class="tick" x="' + (PL - 6) + '" y="' + (y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + money$(v) + '</text>';
    return g;
  }
  function weeksHtml(R) {
    const W = R.weeks, n = W.length, H = 170, ih = H - PT - PB, slot = (CW - PL - PR) / n, bw = Math.min(22, slot - 8);
    const sel = tr.sel != null && tr.sel < n ? tr.sel : n - 1, u = R.usualWeek;
    const sc = scale(Math.max(u || 0, ...W.map(w => w.spent))), y = v => PT + ih - v / sc.top * ih, x = i => PL + slot * (i + 0.5);
    const last = W[n - 1], open = R.cur && last.end > today();
    let g = '<svg class="chart" viewBox="0 0 ' + CW + ' ' + H + '" role="group" aria-label="Spent each week, the last ' + n + ' weeks">' + gridLines(sc, y, H)
      + '<rect class="selbg" x="' + (PL + slot * sel).toFixed(1) + '" y="' + (PT - 6) + '" width="' + slot.toFixed(1) + '" height="' + (ih + 6) + '" rx="6"/>';
    W.forEach((w, i) => {
      if (w.spent > 0) {
        const x0 = x(i) - bw / 2, y0 = y(w.spent), b = y(0), r = Math.min(4, b - y0);
        g += '<path class="bar' + (u && w.spent > u * 1.25 ? ' over' : '') + (open && i === n - 1 ? ' part' : '') + (C.ymOf(w.end) !== R.ym && C.ymOf(w.start) !== R.ym ? ' dim' : '') + '" d="M' + x0.toFixed(1) + ' ' + b + 'V' + (y0 + r).toFixed(1) + 'Q' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' ' + (x0 + r).toFixed(1) + ' ' + y0.toFixed(1)
          + 'H' + (x0 + bw - r).toFixed(1) + 'Q' + (x0 + bw).toFixed(1) + ' ' + y0.toFixed(1) + ' ' + (x0 + bw).toFixed(1) + ' ' + (y0 + r).toFixed(1) + 'V' + b + 'Z"/>';
      }
      if (i % 2 === (n - 1) % 2) g += '<text class="xl" x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '">' + esc(short(w.start)) + '</text>';
    });
    if (W[sel].spent > 0) g += '<text class="val" x="' + x(sel).toFixed(1) + '" y="' + (y(W[sel].spent) - 5).toFixed(1) + '">' + esc(money$(Math.round(W[sel].spent))) + '</text>';
    if (u) g += '<line class="goal" x1="' + PL + '" x2="' + (CW - PR) + '" y1="' + y(u).toFixed(1) + '" y2="' + y(u).toFixed(1) + '"/><text class="lbl" x="' + (PL + 4) + '" y="' + (y(u) - 4).toFixed(1) + '">Usual week ' + esc(usdR(u)) + '</text>';
    W.forEach((w, i) => { g += '<rect class="hit" data-wk="' + i + '" tabindex="0" role="button" aria-pressed="' + (i === sel) + '" aria-label="' + esc(short(w.start) + ' to ' + short(w.end) + ': ' + usdR(w.spent)) + '" x="' + (PL + slot * i).toFixed(1) + '" y="' + (PT - 6) + '" width="' + slot.toFixed(1) + '" height="' + (ih + PB + 6) + '"/>'; });
    g += '</svg>';
    // the week you tapped: its total against a usual week, and where it went
    const w = W[sel], vs = u ? Math.round((w.spent - u) / u * 100) : null, topC = Math.max(1, ...w.cats.map(c => c.total));
    const head = '<p class="readout"><b>' + esc(short(w.start) + ' – ' + short(w.end)) + '</b>' + (open && sel === n - 1 ? ' <span>(so far)</span>' : '') + ': <b>' + esc(usdR(w.spent)) + '</b>'
      + (w.n ? ' · ' + esc(plural(w.n, 'charge')) : '') + (vs != null && w.n ? ' · <span class="' + (vs > 0 ? 'up' : 'dn') + '">' + (vs > 0 ? '▲ ' : '▼ ') + Math.abs(vs) + '%</span> <span>against a usual week</span>' : '') + '</p>';
    const cats = w.cats.slice(0, 5).map(c => '<button class="wcat" type="button" data-wcat="' + esc(c.name) + '"><span class="wn">' + esc(c.emoji || '•') + ' ' + no(c.name) + '</span><span class="wb" aria-hidden="true"><i style="width:' + (c.total / topC * 100).toFixed(1) + '%"></i></span><span class="wv">' + esc(usdR(c.total)) + '</span></button>').join('');
    return g + head + (cats ? '<div class="wcats">' + cats + (w.n ? '<button class="linkbtn" type="button" data-wall>' + esc('See the ' + plural(w.n, 'charge')) + '</button>' : '') + '</div>' : '');
  }
  function runHtml(R) {
    const H = 170, ih = H - PT - PB, n = R.days, iw = CW - PL - PR, x = d => PL + iw * d / (n - 1), act = R.run.slice(0, R.upTo);
    const sc = scale(Math.max(act[act.length - 1] || 0, R.usual ? R.usual[n - 1] : 0, R.pace || 0)), y = v => PT + ih - v / sc.top * ih;
    const path = arr => arr.map((v, d) => (d ? 'L' : 'M') + x(d).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
    let g = '<svg class="chart run" id="runSvg" viewBox="0 0 ' + CW + ' ' + H + '" role="img" aria-label="' + esc('Spent through ' + monthName(R.ym) + ', day by day' + (R.usual ? ', against the usual month' : '')) + '">' + gridLines(sc, y, H);
    for (const d of [0, 7, 14, 21, n - 1]) g += '<text class="xl" x="' + x(d).toFixed(1) + '" y="' + (H - 6) + '">' + (d + 1) + '</text>';
    if (R.usual) g += '<path class="usual" d="' + path(R.usual) + '"/>';
    if (R.pace && R.upTo < n) g += '<path class="pace" d="M' + x(R.upTo - 1).toFixed(1) + ' ' + y(act[act.length - 1]).toFixed(1) + 'L' + x(n - 1).toFixed(1) + ' ' + y(R.pace).toFixed(1) + '"/>';
    g += '<path class="area" d="' + path(act) + 'L' + x(act.length - 1).toFixed(1) + ' ' + y(0).toFixed(1) + 'L' + x(0).toFixed(1) + ' ' + y(0).toFixed(1) + 'Z"/><path class="ln" d="' + path(act) + '"/>';
    const d = tr.day != null && tr.day < R.upTo ? tr.day : R.upTo - 1;
    g += '<line class="cursor" x1="' + x(d).toFixed(1) + '" x2="' + x(d).toFixed(1) + '" y1="' + PT + '" y2="' + (PT + ih) + '"/>'
      + (R.usual ? '<circle class="dot u" cx="' + x(d).toFixed(1) + '" cy="' + y(R.usual[d]).toFixed(1) + '" r="3.5"/>' : '') + '<circle class="dot" cx="' + x(d).toFixed(1) + '" cy="' + y(act[d]).toFixed(1) + '" r="4.5"/></svg>';
    const legend = '<div class="legend"><span><i class="ln"></i>' + esc(monthShort(R.ym)) + '</span>' + (R.usual ? '<span><i class="usual"></i>Usual</span>' : '') + (R.pace && R.upTo < n ? '<span><i class="pace"></i>At this rate</span>' : '') + '</div>';
    const u = R.usual && R.usual[d], diff = u != null ? act[d] - u : null;
    const read = '<p class="readout" id="runRead">By <b>' + esc(short(R.ym + '-' + pad(d + 1))) + '</b>: <b>' + esc(usdR(act[d])) + '</b> <span>spent</span>'
      + (u != null ? ' · <span>usual by then</span> ' + esc(usdR(u)) + (Math.abs(diff) >= 1 ? ' <span class="' + (diff > 0 ? 'up' : 'dn') + '">(' + (diff > 0 ? '+' : '−') + esc(usdR(Math.abs(diff))) + ')</span>' : '') : '') + '</p>';
    return g + legend + read;
  }
  $('trBody').addEventListener('click', e => {
    const h = e.target.closest('[data-wk]');
    if (h) { tr.sel = +h.dataset.wk; $('trWeeks').innerHTML = weeksHtml(tr.R); const f = $('trWeeks').querySelector('[data-wk="' + tr.sel + '"]'); if (f && e.detail === 0) f.focus(); return; }
    const R = tr.R, w = R.weeks[tr.sel != null && tr.sel < R.weeks.length ? tr.sel : R.weeks.length - 1];
    const inWeek = x => x.dir === 'out' && x.amt >= R.min && x.date >= w.start && x.date <= w.end;
    const c = e.target.closest('[data-wcat]');
    if (c) { const cat = c.dataset.wcat; openList(cat + ', ' + short(w.start) + ' – ' + short(w.end), st.T.filter(x => inWeek(x) && (x.cat || 'Uncategorized') === cat)); return; }
    if (e.target.closest('[data-wall]')) openList(short(w.start) + ' – ' + short(w.end), st.T.filter(inWeek));
  });
  $('trBody').addEventListener('keydown', e => { const h = e.target.closest('[data-wk]'); if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); h.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 })); } });
  // Through the month: a finger on the chart reads off that day.
  function scrub(e) {
    const svg = e.target.closest && e.target.closest('#runSvg'); if (!svg) return;
    const R = tr.R, r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * CW;
    const d = Math.max(0, Math.min(R.upTo - 1, Math.round((px - PL) / (CW - PL - PR) * (R.days - 1))));
    if (d === tr.day) return;
    tr.day = d; $('trRun').innerHTML = runHtml(R);
  }
  $('trBody').addEventListener('pointerdown', scrub);
  $('trBody').addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'mouse') scrub(e); });
  function txRow(x, colour) {
    const acct = st.acct(x), r = st.rw.get(x.id);
    const bits = [acct.name ? no(acct.name) + (acct.guess ? '<span>?</span>' : '') : '', x.cat ? no(x.cat) : ''].filter(Boolean).join(' · ')
      + (x.check && x.check.s === 'fixed' ? ' <span class="badge">Corrected</span>' : x.check && x.check.s === 'flag' ? ' <span class="badge warn">Check</span>' : '');
    return '<button class="row" type="button" data-tx="' + esc(x.id) + '"><span class="em" aria-hidden="true"' + (acct.name ? ' data-k="' + colour(acct.name) + '"' : '') + '>' + esc(x.emoji || '•') + '</span>'
      + '<span class="rt"><b>' + no(x.merchant) + '</b><small>' + bits + '</small></span><span class="rv' + (x.dir === 'in' ? ' in' : '') + '">' + (x.dir === 'in' ? '+' : '') + esc(usd2(x.amt))
      + (r && r.rate ? '<small>+' + esc(usd2(r.earned)) + ' <span>back</span></small>' : '') + '</span></button>';
  }
  function txList(list) {
    const colour = cardColours();
    let html = '', day = '';
    for (const x of list) {
      if (x.date !== day) { day = x.date; html += '<p class="daylbl">' + esc(dayName(day)) + '</p>'; }
      html += txRow(x, colour);
    }
    return html;
  }
  function prep() { const all = base(); st.acct = C.accounts(all); st.rw = C.rewards(all, settings()); }
  function activityHtml() {
    prep();
    const q = st.q.trim().toLowerCase();
    const list = q ? st.T.filter(x => [x.merchant, x.account, x.cat, x.mcat || '', String(x.amt)].some(v => String(v).toLowerCase().includes(q))) : st.T.filter(x => C.ymOf(x.date) === st.ym);
    const total = list.filter(x => x.dir === 'out').reduce((a, x) => a + x.amt, 0);
    return '<label class="search"><span class="vh">Search</span>' + I.search + '<input id="q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Search every transaction" value="' + esc(st.q) + '"></label>'
      + (q ? '' : navRow())
      + (list.length ? '<div class="rgroup">' + txList(list) + '<div class="total"><span>' + esc(plural(list.length, 'transaction')) + '</span><b>' + esc(usd2(total)) + '</b></div></div>'
        : '<div class="empty"><strong>' + (q ? 'Nothing found' : 'Nothing this month yet') + '</strong>' + (q ? 'No transaction matches that.' : 'Monarch hasn’t emailed anything for ' + esc(monthName(st.ym)) + '.') + '</div>');
  }
  // Rewards a month, per card, as stacked columns (plain SVG that follows light and dark), with a table.
  function rewardChart(months, colour) {
    const W = 340, Hh = 150, L = 34, B = 20, T = 10, cards = [...new Set(months.flatMap(m => Object.keys(m.cards)))];
    const max = Math.max(1, ...months.map(m => m.total)), step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find(s => max / s <= 4) || 1000, top = Math.ceil(max / step) * step;
    const y = v => T + (Hh - T - B) * (1 - v / top), bw = (W - L) / months.length;
    let g = '';
    for (let v = 0; v <= top; v += step) g += '<line class="grid" x1="' + L + '" x2="' + W + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text class="tick" x="' + (L - 6) + '" y="' + (y(v) + 3.5).toFixed(1) + '" text-anchor="end">$' + v + '</text>';
    months.forEach((m, i) => {
      let acc = 0;
      const x = L + i * bw + bw * 0.2, w = bw * 0.6;
      for (const c of cards) { const v = m.cards[c] || 0; if (!v) continue; g += '<rect data-k="' + colour(c) + '" x="' + x.toFixed(1) + '" y="' + y(acc + v).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(0.5, y(acc) - y(acc + v)).toFixed(1) + '" rx="2"/>'; acc += v; }
      g += '<text class="xl" x="' + (x + w / 2).toFixed(1) + '" y="' + (Hh - 5) + '">' + esc(monthShort(m.ym)) + '</text>';
      if (m.total) g += '<text class="val" x="' + (x + w / 2).toFixed(1) + '" y="' + (y(m.total) - 4).toFixed(1) + '">$' + Math.round(m.total) + '</text>';
    });
    const legend = '<div class="legend">' + cards.map(c => '<span><i data-k="' + colour(c) + '"></i>' + no(c) + '</span>').join('') + '</div>';
    const table = '<details class="tview"><summary>Show as a table</summary><table><thead><tr><th>Month</th>' + cards.map(c => '<th class="n">' + no(c) + '</th>').join('') + '<th class="n">Total</th></tr></thead><tbody>'
      + months.map(m => '<tr><td>' + esc(monthName(m.ym)) + '</td>' + cards.map(c => '<td class="n">' + esc(usd2(m.cards[c] || 0)) + '</td>').join('') + '<td class="n">' + esc(usd2(m.total)) + '</td></tr>').join('') + '</tbody></table></details>';
    return '<div class="chartcard"><svg class="chart" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Rewards a month, per card, for the last ' + months.length + ' months">' + g + '</svg>' + (cards.length ? legend : '') + table + '</div>';
  }
  function cardsHtml() {
    prep();
    const colour = cardColours(), s = settings(), all = base(), list = C.byCard(all, st.ym, s), months = C.rewardMonths(all, s, st.ym, 6);
    const earned = list.reduce((a, c) => a + c.earned, 0), spent = list.reduce((a, c) => a + c.spent, 0);
    const rows = list.length ? list.map(c => {
      const rate = !c.card ? 'From Monarch’s summaries, which don’t say' : !c.isCard ? 'Bank account' : c.rule ? rateText(c.rule) : 'Cash back not set';
      return '<button class="row" type="button" data-card="' + esc(c.card) + '"><span class="em" aria-hidden="true"' + (c.card ? ' data-k="' + colour(c.card) + '"' : '') + '>' + (c.isCard || !c.card ? I.card : I.store) + '</span>'
        + '<span class="rt"><b>' + (c.card ? no(c.card) : 'Card not known') + '</b><small><span>' + esc(plural(c.n, 'charge')) + '</span> · <span>' + esc(rate) + '</span></small></span>'
        + '<span class="rv">' + esc(usdR(c.spent)) + (c.earned ? '<small>+' + esc(usd2(c.earned)) + ' <span>back</span></small>' : '') + '</span></button>';
    }).join('') : '';
    const miss = C.missed(all, s, C.ymAdd(st.ym, -2), st.ym);
    const missHtml = miss.length ? '<p class="sechead"><span>Use the better card</span><span>Last 3 months</span></p><div class="rgroup">' + miss.slice(0, 5).map(e => '<div class="tip"><span class="em" aria-hidden="true">' + I.card + '</span><span class="tt"><b>' + esc(KIND[e.kind]) + '</b> <span>on</span> ' + no(e.from) + ' (' + e.fromRate + '%) <span>would earn</span> ' + e.rate + '% <span>on</span> ' + no(e.to) + '<span>:</span> <span>' + esc(plural(e.n, 'charge')) + '</span>, ' + esc(usdR(e.spent)) + '<span>.</span></span><span class="tv save">+' + esc(usd2(e.more)) + '</span></div>').join('') + '</div>' : '';
    return navRow()
      + '<div class="sum" role="group" aria-label="Rewards"><span class="big"><b class="in">' + esc(usd2(earned)) + '</b><span>back <span>in ' + esc(monthName(st.ym)) + '</span></span></span><span class="line"><span>On</span> ' + esc(usdR(spent)) + ' <span>spent</span></span></div>'
      + (rows ? '<p class="sechead"><span>By card</span></p><div class="rgroup">' + rows + '</div>' : '<div class="empty"><strong>Nothing this month yet</strong>Monarch hasn’t emailed anything for ' + esc(monthName(st.ym)) + '.</div>')
      + '<p class="sechead"><span>Rewards a month</span></p>' + rewardChart(months, colour) + missHtml
      + '<p class="note">Each card’s cash back is in Settings, Card rewards. A card with a ? was guessed from where you usually use it.</p>';
  }
  const rateText = r => r.online > r.base || r.grocery > r.base
    ? [r.online > r.base ? r.online + '% online' : '', r.grocery > r.base ? r.grocery + '% groceries' : '', r.base + '% else'].filter(Boolean).join(', ')
    : r.base + '% on everything';
  function repeatsHtml() {
    const rec = C.recurring(base(), today()), on = rec.filter(r => r.active), off = rec.filter(r => !r.active);
    const year = on.reduce((a, r) => a + r.yearly, 0);
    const row = r => '<button class="row' + (r.active ? '' : ' off') + '" type="button" data-merchant="' + esc(r.merchant) + '"><span class="em" aria-hidden="true">' + esc(r.emoji || '•') + '</span><span class="rt"><b>' + no(r.merchant) + '</b><small>'
      + '<span>' + esc(EVERY[r.every]) + '</span> · <span>last</span> ' + esc(short(r.last)) + '</small></span><span class="rv">' + (r.varies ? '~' : '') + esc(usdR(r.amt)) + '<small>' + esc(usdR(r.yearly)) + ' <span>a year</span></small></span></button>';
    const known = new Set(rec.map(r => C.norm(r.merchant)));
    const hints = D.hints.filter(h => !known.has(C.norm(h.name)));
    return (on.length ? '<div class="sum" role="group" aria-label="Recurring"><span class="big"><b>' + esc(usdR(year)) + '</b><span>a year</span></span><span class="line">' + esc(plural(on.length, 'recurring charge')) + '<span>, from what Monarch emailed</span></span></div>'
      + '<div class="rgroup">' + on.map(row).join('') + '</div>' : '<div class="empty"><strong>Nothing recurring found yet</strong>A charge shows here once the same amount has come from the same place at a steady rhythm three times.</div>')
      + (off.length ? '<p class="sechead"><span>Stopped?</span></p><div class="rgroup">' + off.map(row).join('') + '</div>' : '')
      + (hints.length ? '<p class="sechead"><span>Monarch found these too</span></p><div class="rgroup">' + hints.map(h => '<div class="row"><span class="em" aria-hidden="true">' + I.repeat + '</span><span class="rt"><b>' + no(h.name) + '</b><small>' + no(h.freq) + '</small></span></div>').join('') + '</div>' : '')
      + '<p class="note">Until Monarch has emailed every charge for a few months, only the bigger bills can show here.</p>';
  }

  // The view pill at the bottom (as in Home and Drinks).
  function drawBar() {
    const v = VIEWS.find(x => x.id === st.view);
    $('vIcon').innerHTML = v.icon; $('vName').textContent = v.name;
    $('vMenu').innerHTML = VIEWS.map(x => '<button type="button" role="option" data-v="' + x.id + '" aria-selected="' + (x.id === st.view) + '"><span class="ic">' + x.icon + '</span><span class="k">' + esc(x.name) + '<small>' + esc(x.sub) + '</small></span><span class="tick">' + I.tick + '</span></button>').join('');
  }
  const closeMenu = focus => { $('vMenu').hidden = true; $('vBtn').setAttribute('aria-expanded', 'false'); if (focus) $('vBtn').focus({ preventScroll: true }); };
  $('vBtn').onclick = () => { const open = $('vMenu').hidden; $('vMenu').hidden = !open; $('vBtn').setAttribute('aria-expanded', String(open)); };
  $('vMenu').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { setView(b.dataset.v); closeMenu(true); } });
  document.addEventListener('click', e => { if (!$('vMenu').hidden && !e.target.closest('#vBar')) closeMenu(false); });
  function setView(v) { st.view = v; ls.set(K.view, v); render(); animateIn(main); scrollTo(0, 0); }

  main.addEventListener('click', e => {
    // a section opened or shut: kept at once (not on its toggle event, which comes after a render that may land first)
    const sm = e.target.closest('details.sec > summary');
    if (sm) { const d = sm.parentElement, o = ls.json(K.open, {}); o[d.dataset.sec] = !d.open; ls.set(K.open, JSON.stringify(o)); return; }
    if (e.target.closest('#sumBtn')) { openTrends(); return; }
    const a = e.target.closest('[data-act]');
    if (a) {
      const act = a.dataset.act;
      if (act === 'prev' || act === 'next') { st.ym = C.ymAdd(st.ym, act === 'prev' ? -1 : 1); if (st.ym > curYm()) st.ym = curYm(); render(); animateIn(main); return; }
      if (act === 'connect') { signIn(); return; }
      if (act === 'read') { scan({ loud: true }); return; }
      if (act === 'checked') { openList('Ipsy’s check', st.T.filter(x => C.ymOf(x.date) === st.ym && x.check && (x.check.s === 'fixed' || x.check.s === 'flag'))); return; }
    }
    const fx = e.target.closest('[data-fixed]');
    if (fx) { const id = fx.dataset.fixed; changeSettings(s => { if (!s.dismissed.includes(id)) s.dismissed.push(id); }); toast('Marked fixed.', () => changeSettings(s => { s.dismissed = s.dismissed.filter(x => x !== id); })); return; }
    const io = e.target.closest('[data-idea-ok]'); if (io) { takeIdea(io.dataset.ideaOk, true); return; }
    const ino = e.target.closest('[data-idea-no]'); if (ino) { takeIdea(ino.dataset.ideaNo, false); return; }
    const vw = e.target.closest('[data-view]'); if (vw) { setView(vw.dataset.view); return; }
    const t = e.target.closest('[data-tx]'); if (t) { openTx(t.dataset.tx); return; }
    const c = e.target.closest('[data-cat]'); if (c) { openList(c.dataset.cat, st.T.filter(x => x.dir === 'out' && x.cat === c.dataset.cat && C.ymOf(x.date) === st.ym)); return; }
    const k = e.target.closest('[data-card]'); if (k) { prep(); const name = k.dataset.card; openList(name || 'Card not known', st.T.filter(x => x.dir === 'out' && C.ymOf(x.date) === st.ym && st.acct(x).name === name)); return; }
    const mm = e.target.closest('[data-merchant]'); if (mm) { const n = C.norm(mm.dataset.merchant); openList(mm.dataset.merchant, st.T.filter(x => C.norm(x.merchant) === n)); }
  });
  $('txBody').addEventListener('keydown', e => { if (e.target.id === 'newCat' && e.key === 'Enter') { e.preventDefault(); setCat(st.txId, e.target.value, ''); } });
  main.addEventListener('input', e => { if (e.target.id === 'q') { st.q = e.target.value; st.focusQ = true; render(); } });

  // ---------------------------------------------------------------------
  // A transaction, and a list of them (a category, a card, a merchant)
  // ---------------------------------------------------------------------
  function openTx(id, back) {
    prep(); view();
    const x = byId(id); if (!x) return;
    if (st.txId !== id) st.acctNew = false;
    st.txId = id;
    const a = st.acct(x), r = st.rw.get(x.id), gid = x.id.split(':')[0];
    $('txLbl').innerHTML = no(x.merchant);
    $('txBody').innerHTML = (back ? '<button class="chip quiet" type="button" data-back style="align-self:flex-start">' + I.chevL + 'Back</button>' : '')
      + '<p class="bigamt' + (x.dir === 'in' ? ' in' : '') + '">' + (x.dir === 'in' ? '+' : '') + esc(usd2(x.amt)) + '</p><p class="sub">' + esc(dayName(x.date)) + '</p>'
      + editHtml(x, a)
      + '<dl class="rgroup kv"><dt>Category</dt><dd>' + esc(x.emoji) + ' ' + no(x.cat || '—') + (x.how ? '<br><small><span>Monarch said:</span> ' + no(x.mcat || '—') + '</small>' : '')
      + ' <button class="chip quiet" type="button" data-recat="' + esc(x.id) + '" style="margin-top:6px">Change</button></dd>'
      + (x.dir === 'out' ? '<dt>Cash back</dt><dd>' + (r && r.rate != null ? esc(usd2(r.earned)) + ' (' + r.rate + '%' + (r.capped ? ', <span>over the bonus limit</span>' : '') + ')' : 'Not set for this card') + '</dd>' : '')
      + '<dt>From</dt><dd>' + (x.src === 'summary' ? 'Monarch’s summary email' : x.src === 'email' ? 'An email Ipsy found (Monarch didn’t email about it), added when you said yes' : 'Monarch’s alert email') + '</dd>'
      + (x.src === 'email' ? '' : '<dt>Checked</dt><dd>' + checkHtml(x) + '</dd>') + '</dl>'
      + '<div id="recatBox" hidden></div>'
      + (x.check && x.check.s === 'fixed' && mayRead() && hasGmail() ? '<button class="chip quiet" type="button" data-undocheck="' + esc(x.id) + '" style="align-self:center">' + I.chevL + 'Undo Ipsy’s correction</button>' : '')
      + '<div class="chips" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">'
      + (x.src === 'email' ? '' : '<a class="chip" href="' + esc(x.mid ? 'https://app.monarch.com/links/transactions/' + x.mid : 'https://app.monarch.com/transactions') + '" target="_blank" rel="noopener">' + I.ext + 'Open in Monarch</a>')
      + (hasGmail() && mayRead() ? '<a class="chip quiet" href="https://mail.google.com/mail/u/0/#all/' + esc(x.src === 'email' ? x.id.split(':')[1] : gid) + '" target="_blank" rel="noopener">' + I.mail + 'The email</a>' : '')
      + (x.src === 'email' && st.server && st.server.reader ? '<button class="chip quiet" type="button" data-unfound="' + esc(x.id) + '">Remove</button>' : '') + '</div>';
    if ($('txSheet').hidden) openSheet('txSheet');
  }
  // The amount, date and card, each changed in place (calc.js, edited): saved as you leave it, with Undo.
  function editHtml(x, a) {
    const cards = st.cards = C.cardList(base()), cur = x.account ? cards.findIndex(c => C.cardKey(c.name) === C.cardKey(x.account)) : -1, ed = x.ed || {};
    const card = c => c.name + (c.last4 ? ' ···' + c.last4 : '');
    const opts = (cur < 0 ? '<option value="" selected>' + esc(x.account ? card({ name: x.account, last4: x.last4 }) : a.name ? 'Probably ' + a.name : 'Not known') + '</option>' : '')
      + cards.map((c, i) => '<option value="' + i + '"' + (i === cur ? ' selected' : '') + '>' + esc(i === cur ? card({ name: c.name, last4: x.last4 }) : card(c)) + '</option>').join('')
      + '<option value="other">Another card…</option>';
    const said = [ed.merchant != null ? 'Merchant ' + no(ed.merchant) : '', ed.amt != null ? 'Amount ' + no(usd2(ed.amt)) : '', ed.date ? 'Date ' + esc(dayName(ed.date)) : '', ed.account != null ? (x.dir === 'in' ? 'Into ' : 'Card ') + no(ed.account ? card({ name: ed.account, last4: ed.last4 }) : 'not known') : ''].filter(Boolean);
    return '<div class="rgroup" id="txEdit">'
      + '<div class="frow"><label for="edMerch">Merchant</label><input class="amt merch" id="edMerch" type="text" maxlength="120" autocomplete="off" enterkeyhint="done" translate="no" value="' + esc(x.merchant) + '"></div>'
      + '<div class="frow"><label for="edAmt">Amount</label><input class="amt" id="edAmt" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="' + esc(x.amt.toFixed(2)) + '"></div>'
      + '<div class="frow"><label for="edDate">Date</label><input id="edDate" type="date" min="' + esc(C.keepFrom(today())) + '-01" max="' + esc(today()) + '" value="' + esc(x.date) + '"></div>'
      + '<div class="frow"><label for="edAcct">' + (x.dir === 'in' ? 'Into' : 'Card') + '</label><select id="edAcct" translate="no">' + opts + '</select></div>'
      + (st.acctNew ? '<div class="frow"><input class="txt" id="edAcctNew" type="text" maxlength="60" autocomplete="off" enterkeyhint="done" placeholder="Its name, as on the card" aria-label="Another card’s name"><button class="chip" type="button" id="edAcctGo">Use it</button></div>' : '')
      + '</div>'
      + (said.length ? '<p class="note"><span>Monarch said:</span> ' + said.join('; ') + '. <button class="chip quiet" type="button" data-unedit style="margin-top:6px">Put back Monarch’s</button></p>' : '');
  }
  function editTx(id, patch, what) {
    const raw = D.tx.find(t => t.id === id); if (!raw) return;
    const prev = ((settings().edits || {})[id]) || null;
    changeSettings(s => { s.edits = C.setEdit(s.edits || {}, raw, patch, Date.now()); });
    st.acctNew = false; openTx(id, !!st.list);
    toast(what, () => {
      changeSettings(s => { const o = Object.assign({}, s.edits); delete o[id]; o[id] = Object.assign({}, prev || {}, { at: Date.now() }); s.edits = o; });
      if (!$('txSheet').hidden && st.txId === id) openTx(id, !!st.list);
    });
  }
  function onEdit(t) {
    const x = byId(st.txId); if (!x) return;
    if (t.id === 'edMerch') {
      const v = String(t.value).replace(/\s+/g, ' ').trim().slice(0, 120);
      if (!v) { t.value = x.merchant; toast('Give it a name.'); return; }
      if (v !== x.merchant) editTx(x.id, { merch: v }, 'Now ' + v + '.');
    } else if (t.id === 'edAmt') {
      const n = Math.round(parseFloat(String(t.value).replace(/[$,\s]/g, '')) * 100) / 100;
      if (!isFinite(n) || n < 0 || n > 1e7) { t.value = x.amt.toFixed(2); toast('That isn’t an amount.'); return; }
      if (Math.abs(n - x.amt) >= 0.005) editTx(x.id, { amt: n }, 'Amount changed to ' + usd2(n) + '.');
      else t.value = n.toFixed(2);
    } else if (t.id === 'edDate') {
      const v = t.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v > today() || v < C.keepFrom(today()) + '-01') { t.value = x.date; toast('Pick a day up to today.'); return; }
      if (v !== x.date) editTx(x.id, { date: v }, 'Moved to ' + dayName(v) + '.');
    } else if (t.id === 'edAcct') {
      if (t.value === 'other') { st.acctNew = true; openTx(x.id, !!st.list); const i = $('edAcctNew'); if (i) i.focus(); return; }
      const c = (st.cards || [])[+t.value]; if (!c || t.value === '') return;
      editTx(x.id, { acct: c.name, l4: c.last4 || null }, (x.dir === 'in' ? 'Into ' : 'On ') + c.name + ' now.');
    }
  }
  function newCard() {
    const i = $('edAcctNew'), name = i ? i.value.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
    if (!name) { toast('Give the card a name.'); return; }
    const x = byId(st.txId); if (!x) return;
    editTx(x.id, { acct: name, l4: null }, (x.dir === 'in' ? 'Into ' : 'On ') + name + ' now.');
  }
  $('txBody').addEventListener('change', e => { if (e.target.closest('#txEdit')) onEdit(e.target); });
  $('txBody').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'edAmt' || e.target.id === 'edMerch') { e.preventDefault(); e.target.blur(); }
    else if (e.target.id === 'edAcctNew') { e.preventDefault(); newCard(); }
  });
  const FIELD_NAME = { amount: 'Amount', direction: 'In or out', merchant: 'Merchant', account: 'Card', category: 'Category' };
  const fieldVal = (f, v) => f === 'amount' ? usd2(parseFloat(v) || 0) : f === 'direction' ? (v === 'in' ? 'Money in' : 'Money out') : v;
  function checkHtml(x) {
    const c = x.check;
    if (!c) return 'Not yet';
    if (c.s === 'ok') return '✓ <span>Ipsy checked it against the email</span>';
    if (c.s === 'kept') return 'You kept the app’s reading';
    if (c.s === 'flag') return '<span>Ipsy couldn’t confirm it against the email</span>' + (c.note ? ': <span translate="no">' + esc(c.note) + '</span>' : '');
    return '<span>Ipsy corrected it from the email:</span> ' + (c.issues || []).map(i => '<span>' + esc(FIELD_NAME[i.field] || i.field) + '</span> ' + no(fieldVal(i.field, i.was)) + ' → ' + no(fieldVal(i.field, i.now))).join('; ');
  }
  const PARSE = { account: P.account, category: P.category };
  function undoCheck(id) {
    const i = D.tx.findIndex(t => t.id === id); if (i < 0) return;
    const x = D.tx[i]; D.tx[i] = C.undoCheck(x, PARSE);
    D.dirty = [...new Set([...D.dirty, C.ymOf(x.date)])]; persist(); render(); openTx(id, !!st.list); scheduleSync();
    toast('The app’s reading is back.');
  }
  // An email's words for the check: the HTML as text (the plain text drops the merchant and card), up to its footer.
  const emailText = b => { const t = b.html ? P.htmlText(b.html) : P.decode(b.text || ''); const k = t.search(/If you have any questions|This email was sent to|You can update your\s+notification/i); return (k > 0 ? t.slice(0, k) : t).slice(0, 1500); };
  // Once a day, on the reader's phone: this month's transactions not checked yet, 20 to a call (POST check).
  const checkOn = () => ls.get(K.checkOff, '') !== '1';
  // Claude turned off for Money on this phone (Settings > AI helper, Use Claude in Money; ../home/account.js): no check, no ideas
  const claudeOn = () => !(window.AllisonOS && AllisonOS.claude) || AllisonOS.claude.on('money');
  const CLAUDE_OFF = 'Claude is turned off for Money on this phone (Settings, AI helper).';
  async function dailyCheck(o) { updating('check', true); try { return await dailyCheckNow(o); } finally { updating('check', false); } }
  async function dailyCheckNow({ loud } = {}) {
    if (!claudeOn()) { if (loud) toast(CLAUDE_OFF); return; }
    if (st.checking || !signedIn() || !st.server || !st.server.reader || !getToken()) { if (loud) toast(!getToken() ? 'Connect Gmail first, so Ipsy can read the emails.' : 'Only the phone that reads Monarch’s emails can check them.'); return; }
    if (!loud && (!checkOn() || D.checkDay === today())) return;
    const todo = C.toCheck(D.tx, today());
    if (!todo.length) { D.checkDay = today(); persist(); if (loud) toast('Nothing new to check this month.'); return; }
    st.checking = true; busyPill('Ipsy is checking');
    let n = 0, fixed = 0, flagged = 0, stop = '', until = '';
    const cache = new Map();
    try {
      for (let k = 0; k < todo.length && !stop; k += 20) {
        // email addresses, phone, card and account numbers stay on the phone (home/redact.js): placeholders go, the real ones come back
        const batch = todo.slice(k, k + 20), items = [], M = (window.AllisonOS && AllisonOS.redact ? AllisonOS.redact.make() : { hide: x => x, show: x => x });
        await pool(batch, 4, async x => {
          const gid = x.id.split(':')[0];
          if (!cache.has(gid)) cache.set(gid, gmail('/messages/' + gid, { format: 'full' }).then(m => ({ subject: header(m, 'subject'), text: emailText(bodies(m.payload)) })).catch(() => null));
          const e = await cache.get(gid);
          if (e && e.text.length >= 20) items.push({ id: x.id, subject: M.hide(e.subject), text: M.hide(e.text), parsed: { amt: x.amt, dir: x.dir, merchant: x.merchant, account: M.hide(x.account), last4: x.last4, cat: x.cat } });
        });
        if (!items.length) continue;
        let r;
        try { r = await api('check', { items }); }
        catch (err) { stop = err.message || 'error'; until = err.until; break; }
        const at = Date.now();
        for (const [id, res] of Object.entries(M.show(r.results || {}))) {
          const i = D.tx.findIndex(t => t.id === id); if (i < 0) continue;
          D.tx[i] = C.applyCheck(D.tx[i], res, at, PARSE);
          n++; if (D.tx[i].check.s === 'fixed') fixed++; else if (D.tx[i].check.s === 'flag') flagged++;
          D.dirty = [...new Set([...D.dirty, C.ymOf(D.tx[i].date)])];
        }
      }
      if (!stop || stop === 'limit') D.checkDay = today();
      D.lastCheck = { at: Date.now(), n, fixed, flagged };
      persist();
      pillDone(n ? 'Checked ' + plural(n, 'transaction') : 'Nothing checked');
      if (stop && stop !== 'limit' && loud) toast(stop === 'no-ai' ? 'Ipsy isn’t set up in aOS yet (its key).' : stop === 'ai-budget' ? AllisonOS.budgetSay(until) : 'Ipsy couldn’t check just now. Try again later.', null, 5000);
      else if (fixed || flagged) toast((fixed ? 'Ipsy corrected ' + plural(fixed, 'transaction') : '') + (fixed && flagged ? '. ' : '') + (flagged ? flagged + ' to look at' : '') + '.', null, 5000);
    } finally {
      st.checking = false; busyPill(null); render(); if (!$('setSheet').hidden) renderSettings();
      if (n) sync();
    }
  }
  // Change a transaction's category: one of those in use, or a new one; always for its merchant (the
  // default) or just this one. Picking Monarch's own puts it back.
  function recatOpen(id) {
    const x = byId(id), box = $('recatBox'); if (!x || !box) return;
    const cats = C.categories(st.T).filter(c => C.catKey(c.name) !== C.catKey(x.cat)).slice(0, 24);
    if (x.how && x.how !== 'merge' && !cats.some(c => C.catKey(c.name) === C.catKey(x.mcat))) cats.unshift({ name: x.mcat, emoji: x.memoji });
    box.innerHTML = '<p class="label">Move to</p><div class="rgroup" style="padding:12px"><div style="display:flex;gap:8px;flex-wrap:wrap">'
      + cats.map(c => '<button class="chip quiet" type="button" data-pick="' + esc(c.name) + '" data-emoji="' + esc(c.emoji || '') + '">' + (c.emoji ? '<span aria-hidden="true">' + esc(c.emoji) + '</span> ' : '') + no(c.name)
        + (x.how && x.how !== 'merge' && C.catKey(c.name) === C.catKey(x.mcat) ? ' <small>(Monarch’s)</small>' : '') + '</button>').join('') + '</div></div>'
      + '<div class="rgroup"><div class="frow"><label for="newCat">New category</label><input class="txt" id="newCat" type="text" maxlength="40" autocomplete="off" enterkeyhint="done"><button class="chip" type="button" id="newCatGo">Use it</button></div></div>'
      + AllisonOS.settings.section('', AllisonOS.settings.toggle({ id: 'recatAll', html: true, title: 'Always for ' + no(x.merchant), sub: 'Its other transactions too, and those to come.', on: true }))
      + (x.how === 'merge' ? '<p class="note">Its category was merged into another: Settings, Categories.</p>' : '');
    box.hidden = false;
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  const recatOf = s => { const rc = s.recat = s.recat || {}; rc.t = rc.t || {}; rc.m = rc.m || {}; rc.g = rc.g || {}; return rc; };
  function setCat(id, name, emoji) {
    const x = D.tx.find(t => t.id === id), b = $('recatAll'); if (!x) return;
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40); if (!name) { toast('Give the new category a name.'); return; }
    const all = !b || b.getAttribute('aria-checked') === 'true', mk = C.catKey(x.merchant), monarchs = C.catKey(name) === C.catKey(x.cat);
    const was = JSON.parse(JSON.stringify({ m: (settings().recat || {}).m && settings().recat.m[mk], t: (settings().recat || {}).t && settings().recat.t[id] }));
    const gone = at => ({ c: '', e: '', at });
    changeSettings(s => {
      const rc = recatOf(s), at = Date.now();
      if (all) { rc.m[mk] = monarchs ? gone(at) : { c: name, e: emoji, at }; if (rc.t[id]) rc.t[id] = gone(at); }
      else rc.t[id] = monarchs && !(rc.m[mk] && rc.m[mk].c) ? gone(at) : { c: name, e: emoji, at };
    });
    openTx(id, !!st.list);
    const undo = () => { changeSettings(s => { const rc = recatOf(s), at = Date.now(); rc.m[mk] = was.m ? Object.assign({}, was.m, { at }) : gone(at); rc.t[id] = was.t ? Object.assign({}, was.t, { at }) : gone(at); }); if (!$('txSheet').hidden && st.txId === id) openTx(id, !!st.list); };
    toast(monarchs ? 'Back to Monarch’s category.' : all ? 'Every ' + x.merchant + ' is ' + name + ' now.' : 'Moved to ' + name + '.', undo);
  }
  // An idea of Ipsy's taken (a rule, as if made by hand) or said no to; either way it's never suggested again.
  function takeIdea(id, ok) {
    const it = ((settings().ideas || {}).list || []).find(i => i.id === id); if (!it) return;
    const emoji = (C.categories(st.T).find(c => C.catKey(c.name) === C.catKey(it.to)) || {}).emoji || '';
    changeSettings(s => {
      const at = Date.now();
      if (ok) { const rc = recatOf(s); if (it.kind === 'merge') rc.g[C.catKey(it.from)] = { c: it.to, e: emoji, f: it.from, at }; else rc.m[C.catKey(it.merchant)] = { c: it.to, e: emoji, at }; }
      s.ideas = Object.assign({}, s.ideas, { at, list: (s.ideas.list || []).filter(i => i.id !== id), no: [...(s.ideas.no || []), id].slice(-200) });
    });
    toast(ok ? (it.kind === 'merge' ? it.from + ' is in ' + it.to + ' now.' : 'Every ' + it.merchant + ' is ' + it.to + ' now.') : 'Ipsy won’t suggest that again.');
  }
  // Ipsy's ideas (functions/money/api, POST ideas): when asked, and once a month on its own.
  async function askIdeas({ loud } = {}) {
    if (st.ideasBusy) return;
    if (!claudeOn()) { if (loud) toast(CLAUDE_OFF); return; }
    if (!signedIn() || !st.server || !st.server.can) { if (loud) toast('Sign in, and have Money shared with you, to ask Ipsy.'); return; }
    const input = C.ideasInput(view(), settings(), today());
    if (!input.categories.length) { if (loud) toast('Nothing spent in the last year to look at.'); return; }
    st.ideasBusy = true; if (loud) busyPill('Ipsy is looking');
    try {
      const r = await api('ideas', input, loud), n = (r.ideas || []).length;
      changeSettings(s => { s.ideas = { at: Date.now(), ym: curYm(), list: r.ideas || [], no: (s.ideas && s.ideas.no) || [] }; });
      if (loud) { pillDone(n ? plural(n, 'idea') : 'No ideas'); toast(n ? 'Ipsy’s ideas are on This month.' : 'No ideas this time: your categories look clear.', null, 5000); }
    } catch (err) {
      if (loud) { busyPill(null); toast(err.message === 'no-ai' ? 'Ipsy isn’t set up in aOS yet (its key).' : err.message === 'ai-budget' ? AllisonOS.budgetSay(err.until) : err.message === 'limit' ? 'That’s all Ipsy’s ideas for today. Try again tomorrow.' : 'Ipsy couldn’t look just now. Try again later.', null, 5000); }
    } finally {
      st.ideasBusy = false; render(); if (!$('setSheet').hidden) renderSettings();
    }
  }
  function monthlyIdeas() {
    const i = settings().ideas;
    if (st.ideasTried || !signedIn() || !st.server || !st.server.can || (i && i.ym === curYm()) || D.tx.length < 20) return;
    st.ideasTried = true; askIdeas();
  }
  function openList(title, list) {
    prep();
    st.list = { title, ids: list.map(x => x.id) };
    const total = list.filter(x => x.dir === 'out').reduce((a, x) => a + x.amt, 0);
    $('txLbl').innerHTML = no(title);
    $('txBody').innerHTML = '<p class="bigamt">' + esc(usd2(total)) + '</p><p class="sub">' + esc(plural(list.length, 'transaction')) + '</p>'
      + (list.length ? '<div class="rgroup">' + txList(list) + '</div>' : '');
    if ($('txSheet').hidden) openSheet('txSheet');
  }
  $('txBody').addEventListener('click', e => {
    const u = e.target.closest('[data-undocheck]'); if (u) { undoCheck(u.dataset.undocheck); return; }
    const rf = e.target.closest('[data-unfound]');
    if (rf) { const x = D.tx.find(t => t.id === rf.dataset.unfound); if (!x) return; removeFound(x.id); closeSheet('txSheet'); toast('Removed ' + x.merchant + '.', () => addFound(x)); return; }
    if (e.target.closest('[data-back]') && st.list) { view(); openList(st.list.title, st.list.ids.map(byId).filter(Boolean)); return; }
    const rb = e.target.closest('[data-recat]'); if (rb) { recatOpen(rb.dataset.recat); return; }
    if (e.target.closest('#edAcctGo')) { newCard(); return; }
    if (e.target.closest('[data-unedit]')) { editTx(st.txId, { merch: null, amt: null, date: null, acct: null, l4: null }, 'Back to what Monarch said.'); return; }
    const pk = e.target.closest('[data-pick]'); if (pk) { setCat(st.txId, pk.dataset.pick, pk.dataset.emoji || ''); return; }
    if (e.target.closest('#newCatGo')) { setCat(st.txId, $('newCat').value, ''); return; }
    if (e.target.closest('#recatAll')) { AllisonOS.settings.flip($('recatAll')); return; }
    const t = e.target.closest('[data-tx]'); if (t) openTx(t.dataset.tx, !!st.list);
  });

  // ---------------------------------------------------------------------
  // Gmail: sign-in (as Orders and Mail do it) and reading Monarch's emails
  // ---------------------------------------------------------------------
  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');
  class AuthError extends Error {}
  function ownToken() { try { const o = JSON.parse(ls.get(K.token, 'null')); if (o && o.exp > Date.now()) return o; } catch {} return null; }
  // Opened from aOS, Mail's sign-in is in the same storage: its permission covers reading, so Money
  // uses it first (same Google account, fresh, not refused by Gmail this session) and never goes
  // back through Google while Mail is signed in; its own sign-in is for Money on its own. Mail's
  // token is Mail's to keep or drop: Money only reads it (one Gmail refused is skipped, st.mailBad).
  function mailToken() {
    try {
      const o = JSON.parse(ls.get('mail.token', 'null')), mine = ls.get(K.hint, '').toLowerCase(), theirs = ls.get('mail.hint', '').toLowerCase();
      if (o && o.t && o.t !== st.mailBad && o.exp > Date.now() && /gmail\.(modify|readonly)|mail\.google\.com/.test(o.scope || '') && (!mine || !theirs || mine === theirs)) return Object.assign({}, o, { mail: true });
    } catch {}
    return null;
  }
  const getToken = () => mailToken() || ownToken();
  const mayRenew = () => !!ls.get(K.token + '.ever', '') && Date.now() - +ls.get(K.lastAuth, 0) > 60e3 && Date.now() - +ls.get(K.silentFail, 0) > 12 * H;
  const hasGmail = () => !!getToken() || !!ls.get(K.token + '.ever', '');
  // This phone may read Monarch's emails: nobody reads them yet, or its person is the reader (or it's signed out).
  const mayRead = () => !signedIn() || !st.server || st.server.open || st.server.reader;
  function toGoogle(u, silent) {
    let inAOS = false; try { inAOS = window.top !== window && !!window.top.aosHome; } catch {}
    if (!inAOS) { location.replace(u); return; }
    const box = window.frameElement && window.frameElement.parentElement;
    if (silent && box && box.hidden) return;
    try { localStorage.setItem('aos.away', 'money|' + Date.now()); } catch {}
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
  function signOutGmail() {
    const tok = ownToken();
    if (tok) fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true, body: new URLSearchParams({ token: tok.t }) }).catch(() => {});
    [K.token, K.token + '.ever', K.state, K.silent, K.silentFail, K.lastAuth].forEach(ls.del);
    renderSettings(); render();
    toast('Gmail disconnected. What Money read stays.');
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
    if (res.status === 401) {
      // Mail's token refused: left to Mail, not used again this session; Money's own, if any, has its turn
      if (tok.mail) { st.mailBad = tok.t; if (ownToken()) return gmail(path, params, tries); }
      else ls.del(K.token);
      throw new AuthError('expired');
    }
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
      const cs = (/charset="?([\w-]+)/i.exec(((p.headers || []).find(h => /^content-type$/i.test(h.name)) || {}).value || '') || [])[1];
      if (p.body && p.body.data && !p.filename) {
        if (type === 'text/html' && !html) html = decodePart(p.body.data, cs);
        else if (type === 'text/plain' && !text) text = decodePart(p.body.data, cs);
      }
      (p.parts || []).forEach(walk);
    };
    walk(payload);
    return { html, text };
  }
  const header = (m, name) => (((m.payload && m.payload.headers) || []).find(h => h.name.toLowerCase() === name) || {}).value || '';

  // Read what's new from Monarch (the first time, the last five years), fold it in, and send it on.
  async function scan({ loud, again } = {}) {
    await ready;
    if (st.reading || !mayRead()) return;
    if (!getToken()) {
      if (mayRenew()) { signIn({ silent: true }); return; }
      if (loud) signIn();
      return;
    }
    st.reading = true; render();
    updating('gmail', true); ls.set(K.cut, '1');
    let signedOut = false;
    busyPill('Reading Gmail');
    if (again) { D.seen = []; D.lastScan = 0; }
    const started = Date.now();
    const since = D.lastScan ? 'after:' + Math.floor(D.lastScan / 1000 - 3 * 86400) : FIRST_SCAN;
    let added = 0, alerts = 0;
    try {
      if (!ls.get(K.hint, '')) gmail('/profile').then(p => { if (p && p.emailAddress) ls.set(K.hint, p.emailAddress); }).catch(() => {});
      const ids = [];
      let pageToken;
      do {
        const r = await gmail('/messages', { q: since + ' ' + P.QUERY, maxResults: 100, pageToken });
        (r.messages || []).forEach(m => ids.push(m.id));
        pageToken = r.nextPageToken;
      } while (pageToken && ids.length < 15000);
      // Each email on its own: one that can't be fetched (gone, the connection dropped, the page
      // went away) stops nothing, and isn't marked read, so the next read tries it again. What was
      // read is folded in every 40 emails, so a long first read keeps what it got this far.
      const seen = new Set(D.seen), todo = ids.filter(id => !seen.has(id));
      let items = [], failed = 0;
      const fold = () => {
        const before = new Map(D.tx.map(x => [x.id, x]));
        const res = C.merge(D.tx, items);
        added += res.added; items = [];
        // the months to send: those with a transaction that wasn't there, or one that went
        const months = new Set(), after = new Set(res.list.map(x => x.id));
        for (const x of res.list) if (!before.has(x.id)) months.add(C.ymOf(x.date));
        for (const [id, x] of before) if (!after.has(id)) months.add(C.ymOf(x.date));
        D.tx = res.list;
        D.dirty = [...new Set([...D.dirty, ...months])];
        D.alerts = D.alerts.sort((a, b) => a.at - b.at).slice(-50);
        D.seen = [...seen].slice(-6000);
        persist();
      };
      try {
        await pool(todo, 4, async (id, k) => {
          let m;
          try { m = await gmail('/messages/' + id, { format: 'full' }); }
          catch (err) { if (err instanceof AuthError) throw err; failed++; return; }
          seen.add(id);
          let r = null;
          try { const b = bodies(m.payload); r = P.parse({ id, at: +m.internalDate || Date.now(), subject: header(m, 'subject'), html: b.html, text: b.text }); } catch {}   // one Money can't make sense of: passed over
          if (r && r.kind === 'tx') items.push(...r.items);
          else if (r && r.kind === 'alert' && !D.alerts.some(a => a.id === r.alert.id)) { D.alerts.push(r.alert); alerts++; }
          else if (r && r.kind === 'recurring') for (const h of r.merchants) if (!D.hints.some(x => C.norm(x.name) === C.norm(h.name))) D.hints.push(h);
          if ((k + 1) % 40 === 0) fold();
        });
      } finally { fold(); }
      if (!failed) D.lastScan = started;   // else the next read looks back as far again, for what's left
      D.readAt = Date.now();
      persist();
      if (failed && loud) toast(plural(failed, 'email') + ' couldn’t be read just now: Money tries again next time.', null, 5000);
      pillDone(added ? 'Found ' + plural(added, 'transaction') : 'Up to date');
      if (loud && !added && !alerts && !failed) toast('Nothing new from Monarch.');
    } catch (err) {
      busyPill(null);
      signedOut = err instanceof AuthError;
      if (err instanceof AuthError) { if (mayRenew()) signIn({ silent: true }); else if (loud) toast('Gmail needs you to sign in again: Settings, Connect Gmail.', null, 6000); }
      else if (loud) toast(err.message || 'Couldn’t read Gmail.', null, 6000);
    } finally {
      st.reading = false; render(); if (!$('setSheet').hidden) renderSettings();
      if (!signedOut) ls.del(K.cut);   // cut off by a sign-in that ran out out of sight: renewed once Money is on screen
    }
    if (signedIn()) sync().then(() => dailyCheck()).finally(() => updating('gmail', false));   // still part of the update
    else updating('gmail', false);
  }

  // ---------------------------------------------------------------------
  // The family's copy (functions/money/api): what the reader sends, and everyone who may see it gets.
  // ---------------------------------------------------------------------
  const A = () => window.AllisonOS && AllisonOS.account;
  const signedIn = () => !!(A() && A().token());
  async function api(path, body, loud) {
    const opts = { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Money': '1', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' };
    let r;
    if (loud) r = await A().fetch(API + path, opts);
    else { const t = A() && A().token(); if (t) opts.headers.Authorization = 'Bearer ' + t; r = await fetch(API + path, opts); }
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) throw Object.assign(new Error(j.error || 'http-' + r.status), { status: r.status, until: j.until });
    return j;
  }
  let syncing = null, syncTimer = null;
  function scheduleSync(ms) { clearTimeout(syncTimer); if (signedIn()) syncTimer = setTimeout(() => sync(), ms == null ? 1500 : ms); }
  function sync(loud) {
    if (!signedIn()) return Promise.resolve();
    if (syncing) return syncing;
    syncing = (async () => {
      try {
        await ready;
        const s = await api('state', undefined, loud);
        st.server = s; D.reader = s.readerName || '';
        if (s.can && s.meta) {
          // months the family's copy has newer than this phone's (five years at most), 25 months a request
          const from = C.keepFrom(today());
          const want = Object.entries(s.meta.months || {}).filter(([ym, at]) => ym >= from && at > (D.mAt[ym] || 0)).map(e => e[0]).sort();
          for (let i = 0; i < want.length;) {
            const end = C.ymAdd(want[i], 24), part = [];
            while (i < want.length && want[i] <= end) part.push(want[i++]);
            const r = await api('months?from=' + part[0] + '&to=' + part[part.length - 1]);
            for (const ym of part) {
              const theirs = (r.months[ym] || []).filter(C.okTx), mine = D.tx.filter(x => C.ymOf(x.date) === ym);
              // the reader's own unsent reading stays; everyone else takes the month as it is there
              const keep = s.reader && D.dirty.includes(ym) ? C.merge(mine, theirs).list : theirs;   // this phone's own reading (and checks) win for a month it hasn't sent yet
              D.tx = D.tx.filter(x => C.ymOf(x.date) !== ym).concat(keep);
              D.mAt[ym] = s.meta.months[ym];
            }
            D.tx.sort((a, b) => b.at - a.at);
          }
          // a month gone from the family's copy (the reader deleted it): gone here too, for everyone but the reader
          if (!s.reader) for (const ym of Object.keys(D.mAt)) if (!(s.meta.months || {})[ym]) { D.tx = D.tx.filter(x => C.ymOf(x.date) !== ym); delete D.mAt[ym]; }
          if (!s.reader) { D.alerts = s.meta.alerts || []; D.hints = s.meta.hints || []; D.readAt = s.meta.readAt || 0; }
          if (s.meta.settings) {
            // the newer copy, with every category change and idea from both (calc.js, mergeSettings); anything newer here is still sent
            const both = C.mergeSettings(D.settings, s.meta.settings);
            D.setDirty = D.setDirty && JSON.stringify(both) !== JSON.stringify(s.meta.settings);
            D.settings = both;
          }
        } else if (!s.can && !s.open) {
          // not shared with this person (or no longer): nothing of the family's stays here
          // (the reader always may see it, so this is never the reader's own reading)
          D.tx = []; D.alerts = []; D.hints = []; D.mAt = {}; D.dirty = [];
        }
        // the reader (or the first phone with something to send) sends what it read, six months at a time
        if ((s.reader || s.open) && hasGmail() && D.dirty.length && D.tx.length) {
          while (D.dirty.length) {
            const batch = D.dirty.slice(0, 6), months = {};
            for (const ym of batch) months[ym] = C.newest(D.tx.filter(x => C.ymOf(x.date) === ym));   // at most the 1,500 aOS keeps a month, else 413 and the months after it never go
            const r = await api('push', { months, alerts: D.alerts, hints: D.hints, readAt: D.readAt });
            for (const ym of batch) D.mAt[ym] = (r.months || {})[ym] || r.at;
            D.dirty = D.dirty.filter(x => !batch.includes(x));
            persist();
          }
          if (s.open) st.server = await api('state');
        }
        if (D.setDirty && (st.server.can || st.server.reader)) {
          const r = await api('settings', { settings: D.settings });
          D.settings = r.settings ? C.mergeSettings(D.settings, r.settings) : D.settings; D.setDirty = false;
        }
        persist();
        setTimeout(monthlyIdeas, 0);
      } catch (err) {
        if (loud && err.status !== 401) toast('Couldn’t reach aOS just now. Money is safe on this phone.', null, 5000);
      } finally {
        syncing = null; render(); if (!$('setSheet').hidden) renderSettings();
      }
    })();
    return syncing;
  }
  addEventListener('aos:account', e => { if (e.detail) sync(); else { st.server = null; render(); } });

  // ---------------------------------------------------------------------
  // Settings: the design, who sees Money, card rewards, categories, Gmail, Ipsy, your data, your account
  // ---------------------------------------------------------------------
  let people = null;
  async function loadPeople() {
    try { people = (await api('people')).people || []; } catch { people = []; }
    if (!$('setSheet').hidden) renderSettings();
  }
  // Settings, as in every app (../home/settings.js): Design · Who sees Money · Card rewards · Categories ·
  // Connected accounts · Ipsy · Your data · Family account
  function renderSettings() {
    const S = AllisonOS.settings, s = st.server, signed = signedIn(), reader = signed && s && s.reader, viewer = signed && s && !s.reader && !s.open;
    const user = signed && A().user ? A().user() : null, sees = D.tx.length && (!viewer || (s && s.can));
    // the family account: who reads Monarch's emails, in a sentence
    let how = '';
    if (!s) how = 'Checking…';
    else if (s.reader) how = 'You read Monarch’s emails for the family, ' + ((s.with || []).length ? 'shared with ' + names(s.with) + '.' : 'not shared with anyone yet.');
    else if (s.can) how = s.readerName + '’s phone reads Monarch’s emails, updated ' + ago(D.readAt) + '.';
    else if (s.open) how = 'Nobody reads Monarch’s emails yet: connect Gmail on the phone that gets them.';
    else how = s.readerName + '’s phone reads Monarch’s emails: ask ' + s.readerName + ' to share Money with you (Settings, Who sees Money).';
    let html = window.aosDesign ? S.section('Design', S.raw(aosDesign.picker(), { id: 'setDesign' })) : '';
    if (reader) {
      if (people === null) { people = []; loadPeople(); }
      html += S.section('Who sees Money', people.length ? people.map(p => S.toggle({ html: true, title: no(p.name), on: (s.with || []).includes(p.id), data: { person: p.id } }))
        : S.info({ title: 'Nobody else is in the family yet.' }), { hint: 'Only you, and those you turn on, see Money: not even the family’s owner otherwise.' });
    }
    if (sees) {
      const all = base(), colour = cardColours(), acct2 = C.accounts(all);
      const cards = [...new Set(all.filter(x => x.dir === 'out').map(x => acct2(x).name).filter(n => n && C.isCard(n)))];
      if (cards.length) {
        const f = (rule, key, title, v, sub) => S.input({ id: rule + key, title, sub, value: String(v || 0), data: { rule, key }, attrs: 'inputmode="decimal" autocomplete="off"' });
        html += S.section('Card rewards', cards.flatMap(c => {
          const r = C.ruleFor(c, settings()) || { base: 0, online: 0, grocery: 0, cap: 0 }, k = C.cardKey(c);
          return [S.raw('<div class="cardhead"><i class="cdot" data-k="' + colour(c) + '"></i>' + no(c) + '</div>'),
            f('base', k, 'On everything (%)', r.base), f('online', k, 'Online shopping (%)', r.online), f('grocery', k, 'Groceries and wholesale clubs (%)', r.grocery),
            f('cap', k, 'Bonus on the first, a quarter ($)', r.cap, '0 for no limit.')];
        }).concat(S.input({ id: 'onlineList', title: 'Online stores', sub: 'What counts as online shopping, separated by commas.', value: (settings().online || C.ONLINE).join(', '), attrs: 'autocomplete="off"' })),
        { hint: 'Set from what you said (Robinhood 3% on everything; Customized Cash 6% online, 2% at groceries and wholesale clubs, 1% else, the bonus on the first $2,500 a quarter): check them against your cards’ terms.' });
      }
      const rc = settings().recat || {}, merchants = new Map(D.tx.map(x => [C.catKey(x.merchant), x.merchant]));
      const rules = [...Object.entries(rc.g || {}).filter(([, v]) => v.c).map(([k, v]) => ({ k: 'g:' + k, what: no(v.f || k) + ' → ' + no(v.c), sub: 'Category merged.' })),
        ...Object.entries(rc.m || {}).filter(([, v]) => v.c).map(([k, v]) => ({ k: 'm:' + k, what: no(merchants.get(k) || k) + ' → ' + no(v.c), sub: 'Always for this merchant.' }))];
      const one = Object.values(rc.t || {}).filter(v => v.c).length;
      html += S.section('Categories', [
        ...(rules.length ? rules.map(r => S.info({ html: true, title: r.what, sub: esc(r.sub), extra: '<button class="chip quiet" type="button" data-unrule="' + esc(r.k) + '">Remove</button>' }))
          : [S.info({ title: 'Monarch’s categories, as its emails say', sub: 'Change one from a transaction: tap it, then Change.' })]),
        one ? S.info({ title: plural(one, 'transaction') + ' changed on its own' }) : '',
      ], { hint: 'Shared with whoever sees Money.' });
    }
    if (!viewer) {
      const tok = getToken(), own = !!ls.get(K.token + '.ever', '');   // Mail's sign-in, or Money's own (ever: there's one to disconnect)
      const who = tok && tok.mail ? 'Mail’s sign-in' : ls.get(K.hint, '') || 'Connected';
      html += S.section('Connected accounts', hasGmail() ? [
        S.info({ id: 'gmailWho', title: 'Gmail', sub: who + ', read-only.' }),
        S.action({ id: 'readNow', icon: 'refresh', title: 'Check now', sub: D.readAt ? 'Last checked ' + ago(D.readAt) + '.' : 'Not checked yet.' }),
        S.action({ id: 'readAgain', icon: 'mail', title: 'Read the last 5 years again', sub: 'Every Monarch email, from the start.' }),
        own ? S.danger({ id: 'gmailOut', icon: 'out', title: 'Disconnect Gmail' }) : '',
      ] : S.action({ id: 'gmailIn', icon: 'mail', title: 'Connect Gmail', sub: 'Read-only: Money reads only Monarch’s emails, and can’t change or send anything.' }),
      { hint: 'In Monarch, set the expense and deposit alerts to $1 (Settings, Notifications), so every transaction is emailed.' });
    }
    const lc = D.lastCheck, ideas = sees && signed && s && s.can;
    html += S.section('AI helper', [
      S.claude('money'),
      reader ? S.toggle({ id: 'checkOn', title: 'Check each day', sub: 'Ipsy checks each new transaction against its Monarch email; what passed is never checked again.', on: checkOn() }) : '',
      reader ? S.action({ id: 'checkNow', icon: 'refresh', title: 'Check now', sub: lc ? 'Last checked ' + ago(lc.at) + ': ' + plural(lc.n, 'transaction') + (lc.fixed ? ', ' + plural(lc.fixed, 'correction') : '') + (lc.flagged ? ', ' + lc.flagged + ' to look at' : '') + '.' : 'Not checked yet.' }) : '',
      ideas ? S.action({ id: 'ideasNow', icon: 'list', title: 'Ask Ipsy for ideas', sub: 'Categories to merge and merchants to move; it looks once a month too, and nothing changes until you accept.' }) : '',
    ], { hint: reader || ideas ? 'Ipsy uses Claude Sonnet 5.5: a few cents a month for the daily check, under a cent for each look at your categories.' : '' });
    html += S.section('Your data', [
      D.tx.length ? S.action({ id: 'exportBtn', icon: 'upload', title: 'Export as a spreadsheet', sub: 'A CSV file.' }) : '',
      S.danger({ id: 'wipeBtn', title: 'Delete all data', sub: reader ? 'From this phone, and from aOS for everyone it’s shared with.' : 'From this phone.' }),
    ]);
    html += S.section('Family account', user ? S.info({ id: 'acctState', title: 'Signed in as ' + user.name, sub: how })
      : [S.info({ id: 'acctState', title: 'On this phone only' }),
        S.action({ id: 'signIn', icon: 'face', title: 'Sign in with Face ID', sub: 'Shares Money with your family, or shows it if it’s shared with you.' })], { id: 'acct' });
    $('setBody').innerHTML = html;
  }
  const names = ids => (people || []).filter(p => ids.includes(p.id)).map(p => p.name).join(', ') || plural(ids.length, 'person');
  $('setBtn').onclick = () => { renderSettings(); openSheet('setSheet'); sync(); };
  const setBody = $('setBody');
  if (window.aosDesign) aosDesign.bind(setBody);
  setBody.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('#signIn')) {
      try { await A().signIn(); toast('Signed in.'); sync(true); }
      catch (err) { toast(err && err.name === 'NotAllowedError' ? 'No passkey found, or canceled. Set up your account in aOS first.' : 'Couldn’t sign in.'); }
      return;
    }
    if (t.closest('#gmailIn')) { signIn(); return; }
    const go = t.closest('#gmailOut'); if (go) { if (AllisonOS.settings.armed(go, 'Tap again to disconnect')) signOutGmail(); return; }
    if (t.closest('#readNow')) { closeSheet('setSheet'); scan({ loud: true }); return; }
    if (t.closest('#readAgain')) { closeSheet('setSheet'); scan({ loud: true, again: true }); return; }
    if (t.closest('#checkOn')) { ls.set(K.checkOff, checkOn() ? '1' : ''); renderSettings(); return; }
    if (t.closest('#checkNow')) { closeSheet('setSheet'); dailyCheck({ loud: true }); return; }
    if (t.closest('#ideasNow')) { closeSheet('setSheet'); setView('month'); askIdeas({ loud: true }); return; }
    const ur = t.closest('[data-unrule]');
    if (ur) { const [k, key] = [ur.dataset.unrule.slice(0, 1), ur.dataset.unrule.slice(2)]; changeSettings(s => { recatOf(s)[k][key] = { c: '', e: '', at: Date.now() }; }); renderSettings(); toast('Removed: Monarch’s categories are back for it.'); return; }
    const p = t.closest('[data-person]');
    if (p) {
      const id = p.dataset.person, now = new Set(st.server.with || []);
      now.has(id) ? now.delete(id) : now.add(id);
      p.setAttribute('aria-checked', String(now.has(id)));
      try { const r = await api('share', { with: [...now] }, true); st.server.with = r.with; toast(now.has(id) ? 'Shared with ' + names([id]) + '.' : 'No longer shared with ' + names([id]) + '.'); }
      catch { p.setAttribute('aria-checked', String(!now.has(id))); toast('Couldn’t change that just now. Try again.'); }
      renderSettings();
      return;
    }
    if (t.closest('#exportBtn')) { exportCSV(); return; }
    const w = t.closest('#wipeBtn');
    if (w) {
      if (!AllisonOS.settings.armed(w, 'Tap again to delete everything')) return;
      if (st.server && st.server.reader) { try { await api('forget', {}, true); } catch { toast('Couldn’t reach aOS, so nothing was deleted. Try again when you’re online.', null, 6000); return; } }
      const n = D.tx.length;
      Object.assign(D, { tx: [], alerts: [], hints: [], settings: null, mAt: {}, dirty: [], setDirty: false, seen: [], lastScan: 0, readAt: 0, checkDay: '', lastCheck: null });
      persist(); if (signedIn()) await sync(); render(); renderSettings();
      toast('Deleted ' + plural(n, 'transaction') + '.');
    }
  });
  setBody.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.rule) {
      const v = Math.max(0, parseFloat(String(t.value).replace(/[^\d.]/g, '')) || 0), key = t.dataset.key, rule = t.dataset.rule;
      changeSettings(s => {
        const name = [...new Set(D.tx.map(x => x.account))].find(n => C.cardKey(n) === key) || key;
        const cur = Object.assign({ base: 0, online: 0, grocery: 0, cap: 0 }, C.ruleFor(name, s) || {});
        cur[rule] = rule === 'cap' ? Math.round(v) : Math.min(30, Math.round(v * 100) / 100);
        delete cur.off;
        s.cards[key] = cur;
      });
      return;
    }
    if (t.id === 'onlineList') changeSettings(s => { s.online = t.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 60); });
  });
  function exportCSV() {
    prep();
    const q = C.csvCell;   // a merchant name starting with = + - @ is text, not a formula, in the spreadsheet
    const rows = [['Date', 'Merchant', 'Amount', 'In or out', 'Card or account', 'Category', 'Monarch’s category', 'Cash back']].concat(
      [...view()].sort((a, b) => a.at - b.at).map(x => { const r = st.rw.get(x.id); return [x.date, x.merchant, x.amt.toFixed(2), x.dir === 'in' ? 'In' : 'Out', st.acct(x).name, x.cat, x.how ? x.mcat : x.cat, r && r.rate != null ? r.earned.toFixed(2) : '']; }));
    const blob = new Blob([rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'money-' + today() + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------------------------------------------------------------------
  // Sheets, the toast and the pill (as in Drinks)
  // ---------------------------------------------------------------------
  const focusStack = [];
  const lockPage = () => document.documentElement.classList.toggle('locked', [...document.querySelectorAll('.sheetwrap')].some(w => !w.hidden));
  function openSheet(id) { focusStack.push(document.activeElement); $(id).hidden = false; lockPage(); }
  function closeSheet(id) { $(id).hidden = true; lockPage(); if (id === 'txSheet') st.list = null; const f = focusStack.pop(); if (f && f.focus && document.contains(f)) f.focus(); }
  document.querySelectorAll('.sheetwrap').forEach(w => w.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(w.id); }));
  if (window.visualViewport) {
    const vv = window.visualViewport, root = document.documentElement.style;
    const fit = () => { root.setProperty('--vvh', vv.height + 'px'); root.setProperty('--vvt', vv.offsetTop + 'px'); };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
  }
  document.addEventListener('focusin', e => { const el = e.target; if (el.matches && el.matches('input') && el.closest('.sheetbody')) setTimeout(() => el.scrollIntoView({ block: 'nearest' }), 350); });
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
      if (dy > 110 || (fast && dy > 30)) { sheet.style.transform = 'translateY(100%)'; scrim.style.opacity = '0'; setTimeout(() => { closeSheet(w.id); reset(); }, 260); }
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
    if (e.key !== 'Escape') return;
    if (!$('vMenu').hidden) { closeMenu(true); return; }
    const open = [...document.querySelectorAll('.sheetwrap')].reverse().find(w => !w.hidden);
    if (open) closeSheet(open.id);
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
  function animateIn(el) { el.classList.add('enter'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('enter'), 900); }
  let pillAt = 0, pillTimer = null;
  function busyPill(text) {
    const p = $('syncPill');
    if (text) { clearTimeout(pillTimer); if (p.hidden) pillAt = Date.now(); p.classList.remove('out', 'done'); p.hidden = false; $('syncPillTxt').textContent = text; return; }
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
  $('readBtn').onclick = () => scan({ loud: true });

  // ---------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------
  // Back from Google's sign-in: the token is taken from the address at once, before anything waits,
  // since welcome.js sends the page straight back into aOS (backToAOS) as soon as it has loaded.
  const back = consumeRedirect();
  // Start once this phone's copy is read (IndexedDB).
  const ready = load().catch(() => {});
  ready.then(start);
  function start() {
    render();
    animateIn(main);
    if (back && back.error) {
      if (!(back.silent && /^(interaction|login|consent|account_selection)_required$/.test(back.error))) toast(back.error === 'access_denied' ? 'Gmail access was declined.' : 'Gmail sign-in didn’t work (' + back.error + ').', null, 6000);
      else toast('Gmail needs one tap to sign in again: Settings, Connect Gmail.', null, 6000);
    }
    // The family's copy first (it says whether this phone reads Gmail), then Gmail: always after a
    // sign-in, else when it's been over an hour.
    (signedIn() ? sync() : Promise.resolve()).then(() => {
      if (getToken() && (back && back.ok || scanDue())) scan({ loud: !!(back && back.ok) });
      else if (getToken()) dailyCheck();
      else if (!getToken() && mayRenew() && mayRead() && Date.now() - D.lastScan > 6 * H) setTimeout(() => signIn({ silent: true }), 800);
    });
  }
  window.addEventListener('storage', e => { if (e.key === KEY + '-at' && !saving) load().then(render, () => {}); });
  let shown = curYm();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (curYm() !== shown) { if (st.ym === shown) st.ym = curYm(); shown = curYm(); }
    render();
    sync().then(() => { if (getToken() && scanDue()) scan(); else if (getToken()) dailyCheck(); });
  });
  // back on screen inside aOS, after another app: a read cut off out of sight goes on (its sign-in renewed if it ran out)
  addEventListener('aos:shown', () => {
    if (getToken() && scanDue()) scan();
    else if (!getToken() && ls.get(K.cut, '') && mayRenew() && mayRead()) signIn({ silent: true });
  });
  window.addEventListener('online', () => sync());
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // Ipsy (../home/ipsy.js), the helper you chat with: for whoever is signed in and sees Money. Its tools
  // (ipsy-tools.js) read the transactions as the family sees them, and on the reader's phone search
  // Gmail for a charge Monarch missed, added only on Yes; Claude answers through ../money/api (ipsy),
  // with no web search.
  // A charge Ipsy found in an email (src 'email'): one more transaction, in every total and shared with the
  // family like Monarch's, until Monarch emails the same charge (calc.js merge: Monarch's then wins).
  function addFound(x) {
    D.tx = C.merge(D.tx, [x]).list;
    D.dirty = [...new Set([...D.dirty, C.ymOf(x.date)])]; persist(); render(); scheduleSync();
  }
  function removeFound(id) {
    const x = D.tx.find(t => t.id === id && t.src === 'email'); if (!x) return;
    D.tx = D.tx.filter(t => t !== x);
    D.dirty = [...new Set([...D.dirty, C.ymOf(x.date)])]; persist(); render(); scheduleSync();
  }
  let ipsy = null;
  function placeIpsy() {
    const slot = $('ipsySlot'), on = !!slot && signedIn() && !!(st.server && st.server.can) && !!window.MoneyIpsy && !!(window.AllisonOS && AllisonOS.ipsy);
    document.documentElement.classList.toggle('ipsy-on', on);
    if (slot) slot.hidden = !on;
    if (!on || ipsy) return;
    ipsy = AllisonOS.ipsy.mount({
      app: 'money', name: 'Money', endpoint: '../money/api/ipsy', headers: { 'X-Money': '1' }, slot,
      ...window.MoneyIpsy({
        calc: C, view: () => st.T || view(), raw: () => D.tx, settings, today, reader: () => D.reader,
        // a charge Monarch missed, from this phone's Gmail (the reader's only), added once the person says Yes
        isReader: () => !!(st.server && st.server.reader), gmail, bodies, header, getToken, AuthError, htmlText: P.htmlText, addTx: addFound, removeTx: removeFound,
        alerts: () => C.openAlerts(D.alerts, D.tx, settings().dismissed, today()),
        screen: () => (VIEWS.find(v => v.id === st.view) || { name: st.view }).name + (st.view !== 'repeats' ? ', ' + monthName(st.ym) : '')
          + (!$('txSheet').hidden && st.txId && !st.list ? ', a transaction open (' + ((byId(st.txId) || {}).merchant || '') + ')' : !$('txSheet').hidden && st.list ? ', a list open (' + st.list.title + ')' : ''),
      }),
    });
  }

  // For the tests (money/scripts/app-test.mjs) only.
  window.__money = { st, D, view, raw: () => D.tx, render, setView, openTx, openList, sync, scan, renderSettings, dailyCheck, askIdeas, addFound, removeFound };
})();
