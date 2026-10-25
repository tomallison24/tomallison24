"use strict";

// Money: where the family's money goes, from Monarch's alert emails.
//
// - Monarch has no API for its members, but it emails each expense and deposit
//   over the amounts set in its notification settings (set both to $1 and it's
//   every one), and a bank it can no longer sync. parse.js reads those emails;
//   calc.js does the sums.
// - One page, four views from the pill at the bottom (as Home's views):
//   This month (spent, the pace, against the usual, where you could save, by
//   category), Transactions (search them all), Cards and rewards (spending per
//   card, rewards a month as a chart, a better card for a kind of spend) and
//   Recurring (what repeats, and what it costs a year). A bank Monarch can't
//   sync shows as a card at the top of This month until it syncs again or you
//   tap Fixed it.
// - One phone reads Monarch's emails from its own Gmail, read-only (with Mail's
//   Google client, as Orders and Travel do): Money's reader. Signed in to the
//   family account, it sends what it read to aOS (functions/money/api), and the
//   family members it picks in Settings > Who sees Money see it too; their
//   phones only ever get it from there. Signed out, it all stays on the phone.
// - Data on this phone: localStorage allison-money-v1. Settings > Card rewards
//   (each card's cash back), the online stores and the alerts marked fixed are
//   shared with whoever sees Money.
// - Four designs, picked in Settings > Design (../home/design.js).

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
  const K = { token: 'money.token', state: 'money.state', silent: 'money.silent', silentFail: 'money.silentFail', lastAuth: 'money.lastAuth', hint: 'money.hint', view: KEY + '-view' };
  const FIRST_SCAN = 'newer_than:2y';
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
    export: '<svg viewBox="0 0 24 24"><path d="M12 15V4M7.6 8.4L12 4l4.4 4.4"/><path d="M4.4 13.6v4.6a2.2 2.2 0 0 0 2.2 2.2h10.8a2.2 2.2 0 0 0 2.2-2.2v-4.6"/></svg>',
    bin: '<svg viewBox="0 0 24 24"><path d="M4.6 6.8h14.8M9.6 6.8V4.6h4.8v2.2M6.6 6.8l.9 12a1.6 1.6 0 0 0 1.6 1.5h5.8a1.6 1.6 0 0 0 1.6-1.5l.9-12"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M14.4 4.6H18a2 2 0 0 1 2 2v10.8a2 2 0 0 1-2 2h-3.6"/><path d="M10 16.4L5.6 12 10 7.6M5.6 12h10.2"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M20 11.2a8 8 0 0 0-14.6-4.4L4 8.4"/><path d="M4 3.8v4.6h4.6"/><path d="M4 12.8a8 8 0 0 0 14.6 4.4l1.4-1.6"/><path d="M20 20.2v-4.6h-4.6"/></svg>',
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
  const D = { tx: [], alerts: [], hints: [], settings: null, mAt: {}, dirty: [], setDirty: false, seen: [], lastScan: 0, readAt: 0, reader: '' };
  function load() {
    const d = ls.json(KEY, null) || {};
    D.tx = Array.isArray(d.tx) ? d.tx.filter(C.okTx) : [];
    D.alerts = Array.isArray(d.alerts) ? d.alerts.filter(a => a && a.id) : [];
    D.hints = Array.isArray(d.hints) ? d.hints.filter(h => h && h.name) : [];
    D.settings = d.settings && typeof d.settings === 'object' ? d.settings : null;
    D.mAt = d.mAt && typeof d.mAt === 'object' ? d.mAt : {};
    D.dirty = Array.isArray(d.dirty) ? d.dirty : [];
    D.setDirty = !!d.setDirty;
    D.seen = Array.isArray(d.seen) ? d.seen : [];
    D.lastScan = +d.lastScan || 0; D.readAt = +d.readAt || 0; D.reader = d.reader || '';
  }
  let warned = false;
  function persist() {
    const ok = ls.set(KEY, JSON.stringify(D));
    if (!ok && !warned) { warned = true; toast('This phone couldn’t save Money: its storage is full.'); }
  }
  const settings = () => D.settings || { cards: {}, dismissed: [], at: 0 };
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
  const st = { view: VIEWS.some(v => v.id === ls.get(K.view, '')) ? ls.get(K.view, '') : 'month', ym: curYm(), q: '', server: null, reading: false, list: null };

  // Each card its own colour, in the order of what's been spent on them (the same on every view).
  function cardColours() {
    const acct = C.accounts(D.tx), tot = new Map();
    for (const x of D.tx) if (x.dir === 'out') { const a = acct(x).name; if (a) tot.set(a, (tot.get(a) || 0) + x.amt); }
    const order = [...tot].sort((a, b) => b[1] - a[1]).map(e => e[0]);
    return name => { const i = order.indexOf(name); return i >= 0 && i < 6 ? String(i) : 'x'; };
  }

  // ---------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------
  const main = $('main');
  function render() {
    drawBar();
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
  function monthHtml() {
    const ym = st.ym, m = C.month(D.tx, ym), cmp = C.compare(D.tx, ym), pace = C.pace(D.tx, ym, today()), min = C.minFor(D.tx, ym, 'out');
    let delta = '';
    if (cmp && cmp.avg > 0) {
      const d = cmp.diff, pct = Math.round(Math.abs(d) / cmp.avg * 100);
      delta = '<span class="delta ' + (d > 0 ? 'more' : 'less') + '">' + (d > 0 ? '▲ ' : '▼ ') + esc(usdR(Math.abs(d))) + ' (' + pct + '%) <span>' + (d > 0 ? 'more than usual' : 'less than usual') + '</span></span>';
    }
    const split = m.income > 0 ? '<span class="split"><span>Income <b>' + esc(usdR(m.income)) + '</b></span><span>Left over <b>' + esc(usdR(m.income - m.spent)) + '</b></span></span>' : '';
    const usual = cmp ? '<span class="line">' + 'Usual: <b>' + esc(usdR(cmp.avg)) + '</b>' + ' <span>a month, ' + esc(cmp.months.slice().reverse().map(monthShort).join(', ')) + '</span>'
      + (cmp.likeForLike ? '<span>. Counting charges over ' + esc(usdR(cmp.min)) + ' only, on both sides: Monarch emailed only those then.</span>' : '') + '</span>' : '';
    const sum = '<div class="sum" role="group" aria-label="Spent in ' + esc(monthName(ym)) + '"><span class="big"><b>' + esc(usdR(cmp && cmp.likeForLike ? cmp.spent : m.spent)) + '</b><span>spent' + (cmp && cmp.likeForLike ? ' <span>(over ' + esc(usdR(cmp.min)) + ')</span>' : '') + '</span></span>'
      + (delta ? delta : '') + usual
      + (pace ? '<span class="line">At this rate: <b>' + esc(usdR(pace)) + '</b> <span>by the end of the month</span></span>' : '')
      + split + '</div>';
    const tips = C.tips(D.tx, ym, today(), settings());
    const tipsHtml = tips.length ? '<p class="sechead"><span>Where you could save</span></p><div class="rgroup">' + tips.map(tipHtml).join('') + '</div>' : '';
    const top = Math.max(1, ...m.cats.map(c => c.total)), avgOf = name => cmp && (cmp.cats.find(c => c.name === name) || {}).avg;
    const cats = m.cats.length ? '<p class="sechead"><span>By category</span><span>' + esc(plural(m.out, 'charge')) + '</span></p><div class="rgroup">' + m.cats.map(c => {
      const a = avgOf(c.name);
      return '<button class="row" type="button" data-cat="' + esc(c.name) + '"><span class="em" aria-hidden="true">' + esc(c.emoji || '•') + '</span><span class="rt"><b>' + no(c.name) + '</b><small><span>' + esc(plural(c.n, 'charge')) + '</span>'
        + (a ? ' · <span>usual</span> ' + esc(usdR(a)) : '') + '</small><span class="bar" aria-hidden="true"><i style="width:' + (c.total / top * 100).toFixed(1) + '%"></i></span></span><span class="rv">' + esc(usdR(c.total)) + '</span></button>';
    }).join('') + '</div>' : '<div class="empty"><strong>Nothing this month yet</strong>Monarch hasn’t emailed anything for ' + esc(monthName(ym)) + '.</div>';
    const cover = min >= 20 ? '<p class="note">Monarch emailed only charges over ' + esc(usdR(min)) + ' in ' + esc(monthName(ym)) + ', so smaller ones aren’t here.</p>' : '';
    return alertsHtml() + navRow() + sum + tipsHtml + cats + cover;
  }
  function tipHtml(t) {
    if (t.kind === 'spike') return '<div class="tip"><span class="em" aria-hidden="true">' + esc(t.emoji || '•') + '</span><span class="tt"><b>' + no(t.cat) + '</b> <span>is well over its usual:</span> ' + esc(usdR(t.now)) + ' <span>against</span> ' + esc(usdR(t.avg)) + '<span>.</span></span><span class="tv">+' + esc(usdR(t.diff)) + '</span></div>';
    if (t.kind === 'card') return '<div class="tip"><span class="em" aria-hidden="true">' + I.card + '</span><span class="tt"><b>' + esc(KIND[t.kindOf]) + '</b> <span>on</span> ' + no(t.from) + ' (' + t.fromRate + '%): <span>use</span> ' + no(t.to) + ' (' + t.rate + '%) <span>instead. The last 3 months:</span> ' + esc(usdR(t.spent)) + '<span>.</span></span><span class="tv save">+' + esc(usd2(t.more)) + '<small>back</small></span></div>';
    if (t.kind === 'merchant') return '<div class="tip"><span class="em" aria-hidden="true">' + I.store + '</span><span class="tt"><b>' + no(t.merchant) + '</b> <span>is where the most went this month:</span> <span>' + esc(plural(t.n, 'charge')) + '</span><span>.</span></span><span class="tv">' + esc(usdR(t.total)) + '</span></div>';
    if (t.kind === 'recurring') return '<button class="tip row" type="button" data-view="repeats"><span class="em" aria-hidden="true">' + I.repeat + '</span><span class="tt"><b>' + esc(plural(t.n, 'recurring charge')) + '</b> <span>add up to this a year. Any to cut?</span></span><span class="tv">' + esc(usdR(t.total)) + '<small>a year</small></span></button>';
    return '';
  }
  function txRow(x, colour) {
    const acct = st.acct(x), r = st.rw.get(x.id);
    const bits = [acct.name ? no(acct.name) + (acct.guess ? '<span>?</span>' : '') : '', x.cat ? no(x.cat) : ''].filter(Boolean).join(' · ');
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
  function prep() { st.acct = C.accounts(D.tx); st.rw = C.rewards(D.tx, settings()); }
  function activityHtml() {
    prep();
    const q = st.q.trim().toLowerCase();
    const list = q ? D.tx.filter(x => [x.merchant, x.account, x.cat, String(x.amt)].some(v => String(v).toLowerCase().includes(q))) : D.tx.filter(x => C.ymOf(x.date) === st.ym);
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
    const colour = cardColours(), s = settings(), list = C.byCard(D.tx, st.ym, s), months = C.rewardMonths(D.tx, s, st.ym, 6);
    const earned = list.reduce((a, c) => a + c.earned, 0), spent = list.reduce((a, c) => a + c.spent, 0);
    const rows = list.length ? list.map(c => {
      const rate = !c.card ? 'From Monarch’s summaries, which don’t say' : !c.isCard ? 'Bank account' : c.rule ? rateText(c.rule) : 'Cash back not set';
      return '<button class="row" type="button" data-card="' + esc(c.card) + '"><span class="em" aria-hidden="true"' + (c.card ? ' data-k="' + colour(c.card) + '"' : '') + '>' + (c.isCard || !c.card ? I.card : I.store) + '</span>'
        + '<span class="rt"><b>' + (c.card ? no(c.card) : 'Card not known') + '</b><small><span>' + esc(plural(c.n, 'charge')) + '</span> · <span>' + esc(rate) + '</span></small></span>'
        + '<span class="rv">' + esc(usdR(c.spent)) + (c.earned ? '<small>+' + esc(usd2(c.earned)) + ' <span>back</span></small>' : '') + '</span></button>';
    }).join('') : '';
    const miss = C.missed(D.tx, s, C.ymAdd(st.ym, -2), st.ym);
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
    const rec = C.recurring(D.tx, today()), on = rec.filter(r => r.active), off = rec.filter(r => !r.active);
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
    const a = e.target.closest('[data-act]');
    if (a) {
      const act = a.dataset.act;
      if (act === 'prev' || act === 'next') { st.ym = C.ymAdd(st.ym, act === 'prev' ? -1 : 1); if (st.ym > curYm()) st.ym = curYm(); render(); animateIn(main); return; }
      if (act === 'connect') { signIn(); return; }
      if (act === 'read') { scan({ loud: true }); return; }
    }
    const fx = e.target.closest('[data-fixed]');
    if (fx) { const id = fx.dataset.fixed; changeSettings(s => { if (!s.dismissed.includes(id)) s.dismissed.push(id); }); toast('Marked fixed.', () => changeSettings(s => { s.dismissed = s.dismissed.filter(x => x !== id); })); return; }
    const vw = e.target.closest('[data-view]'); if (vw) { setView(vw.dataset.view); return; }
    const t = e.target.closest('[data-tx]'); if (t) { openTx(t.dataset.tx); return; }
    const c = e.target.closest('[data-cat]'); if (c) { openList(c.dataset.cat, D.tx.filter(x => x.dir === 'out' && x.cat === c.dataset.cat && C.ymOf(x.date) === st.ym)); return; }
    const k = e.target.closest('[data-card]'); if (k) { prep(); const name = k.dataset.card; openList(name || 'Card not known', D.tx.filter(x => x.dir === 'out' && C.ymOf(x.date) === st.ym && st.acct(x).name === name)); return; }
    const mm = e.target.closest('[data-merchant]'); if (mm) { const n = C.norm(mm.dataset.merchant); openList(mm.dataset.merchant, D.tx.filter(x => C.norm(x.merchant) === n)); }
  });
  main.addEventListener('input', e => { if (e.target.id === 'q') { st.q = e.target.value; st.focusQ = true; render(); } });

  // ---------------------------------------------------------------------
  // A transaction, and a list of them (a category, a card, a merchant)
  // ---------------------------------------------------------------------
  function openTx(id, back) {
    prep();
    const x = D.tx.find(t => t.id === id); if (!x) return;
    const a = st.acct(x), r = st.rw.get(x.id), gid = x.id.split(':')[0];
    $('txLbl').innerHTML = no(x.merchant);
    $('txBody').innerHTML = (back ? '<button class="chip quiet" type="button" data-back style="align-self:flex-start">' + I.chevL + 'Back</button>' : '')
      + '<p class="bigamt' + (x.dir === 'in' ? ' in' : '') + '">' + (x.dir === 'in' ? '+' : '') + esc(usd2(x.amt)) + '</p><p class="sub">' + esc(dayName(x.date)) + '</p>'
      + '<dl class="rgroup kv"><dt>' + (x.dir === 'in' ? 'Into' : 'Card') + '</dt><dd>' + (a.name ? no(a.name) + (x.last4 ? ' ···' + esc(x.last4) : '') + (a.guess ? ' <span>(probably: Monarch’s summary didn’t say)</span>' : '') : 'Not known') + '</dd>'
      + '<dt>Category</dt><dd>' + esc(x.emoji) + ' ' + no(x.cat || '—') + '</dd>'
      + (x.dir === 'out' ? '<dt>Cash back</dt><dd>' + (r && r.rate != null ? esc(usd2(r.earned)) + ' (' + r.rate + '%' + (r.capped ? ', <span>over the bonus limit</span>' : '') + ')' : 'Not set for this card') + '</dd>' : '')
      + '<dt>From</dt><dd>' + (x.src === 'summary' ? 'Monarch’s summary email' : 'Monarch’s alert email') + '</dd></dl>'
      + '<div class="chips" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">'
      + '<a class="chip" href="' + esc(x.mid ? 'https://app.monarch.com/links/transactions/' + x.mid : 'https://app.monarch.com/transactions') + '" target="_blank" rel="noopener">' + I.ext + 'Open in Monarch</a>'
      + (hasGmail() && mayRead() ? '<a class="chip quiet" href="https://mail.google.com/mail/u/0/#all/' + esc(gid) + '" target="_blank" rel="noopener">' + I.mail + 'The email</a>' : '') + '</div>';
    if ($('txSheet').hidden) openSheet('txSheet');
  }
  function openList(title, list) {
    prep();
    st.list = { title, list };
    const total = list.filter(x => x.dir === 'out').reduce((a, x) => a + x.amt, 0);
    $('txLbl').innerHTML = no(title);
    $('txBody').innerHTML = '<p class="bigamt">' + esc(usd2(total)) + '</p><p class="sub">' + esc(plural(list.length, 'transaction')) + '</p>'
      + (list.length ? '<div class="rgroup">' + txList(list) + '</div>' : '');
    if ($('txSheet').hidden) openSheet('txSheet');
  }
  $('txBody').addEventListener('click', e => {
    if (e.target.closest('[data-back]') && st.list) { openList(st.list.title, st.list.list); return; }
    const t = e.target.closest('[data-tx]'); if (t) openTx(t.dataset.tx, !!st.list);
  });

  // ---------------------------------------------------------------------
  // Gmail: sign-in (as Orders and Mail do it) and reading Monarch's emails
  // ---------------------------------------------------------------------
  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');
  class AuthError extends Error {}
  function ownToken() { try { const o = JSON.parse(ls.get(K.token, 'null')); if (o && o.exp > Date.now()) return o; } catch {} return null; }
  // Opened from aOS, Mail's sign-in is in the same storage: its permission covers reading.
  function mailToken() { try { const o = JSON.parse(ls.get('mail.token', 'null')); if (o && o.exp > Date.now() && /gmail\.(modify|readonly)|mail\.google\.com/.test(o.scope || '')) return o; } catch {} return null; }
  const getToken = () => ownToken() || mailToken();
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

  // Read what's new from Monarch (the first time, the last two years), fold it in, and send it on.
  async function scan({ loud, again } = {}) {
    if (st.reading || !mayRead()) return;
    if (!getToken()) {
      if (mayRenew()) { signIn({ silent: true }); return; }
      if (loud) signIn();
      return;
    }
    st.reading = true; render();
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
      } while (pageToken && ids.length < 3000);
      const seen = new Set(D.seen), todo = ids.filter(id => !seen.has(id)), items = [];
      await pool(todo, 4, async id => {
        const m = await gmail('/messages/' + id, { format: 'full' });
        const b = bodies(m.payload);
        const r = P.parse({ id, at: +m.internalDate || Date.now(), subject: header(m, 'subject'), html: b.html, text: b.text });
        seen.add(id);
        if (!r) return;
        if (r.kind === 'tx') items.push(...r.items);
        else if (r.kind === 'alert' && !D.alerts.some(a => a.id === r.alert.id)) { D.alerts.push(r.alert); alerts++; }
        else if (r.kind === 'recurring') for (const h of r.merchants) if (!D.hints.some(x => C.norm(x.name) === C.norm(h.name))) D.hints.push(h);
      });
      const before = new Map(D.tx.map(x => [x.id, x]));
      const res = C.merge(D.tx, items);
      added = res.added;
      // the months to send: those with a transaction that wasn't there, or one that went
      const months = new Set();
      const after = new Set(res.list.map(x => x.id));
      for (const x of res.list) if (!before.has(x.id)) months.add(C.ymOf(x.date));
      for (const [id, x] of before) if (!after.has(id)) months.add(C.ymOf(x.date));
      D.tx = res.list;
      D.dirty = [...new Set([...D.dirty, ...months])];
      D.alerts = D.alerts.sort((a, b) => a.at - b.at).slice(-50);
      D.seen = [...seen].slice(-6000);
      D.lastScan = started; D.readAt = Date.now();
      persist();
      pillDone(added ? 'Found ' + plural(added, 'transaction') : 'Up to date');
      if (loud && !added && !alerts) toast('Nothing new from Monarch.');
    } catch (err) {
      busyPill(null);
      if (err instanceof AuthError) { if (mayRenew()) signIn({ silent: true }); else if (loud) toast('Gmail needs you to sign in again: Settings, Connect Gmail.', null, 6000); }
      else if (loud) toast(err.message || 'Couldn’t read Gmail.', null, 6000);
    } finally {
      st.reading = false; render(); if (!$('setSheet').hidden) renderSettings();
    }
    if (signedIn()) sync();
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
    if (!r.ok) throw Object.assign(new Error(j.error || 'http-' + r.status), { status: r.status });
    return j;
  }
  let syncing = null, syncTimer = null;
  function scheduleSync(ms) { clearTimeout(syncTimer); if (signedIn()) syncTimer = setTimeout(() => sync(), ms == null ? 1500 : ms); }
  function sync(loud) {
    if (!signedIn()) return Promise.resolve();
    if (syncing) return syncing;
    syncing = (async () => {
      try {
        const s = await api('state', undefined, loud);
        st.server = s; D.reader = s.readerName || '';
        if (s.can && s.meta) {
          // months the family's copy has newer than this phone's (the last 25 at most)
          const want = Object.entries(s.meta.months || {}).filter(([ym, at]) => at > (D.mAt[ym] || 0)).map(e => e[0]).sort().slice(-25);
          if (want.length) {
            const r = await api('months?from=' + want[0] + '&to=' + want[want.length - 1]);
            for (const ym of want) {
              const theirs = (r.months[ym] || []).filter(C.okTx), mine = D.tx.filter(x => C.ymOf(x.date) === ym);
              // the reader's own unsent reading stays; everyone else takes the month as it is there
              const keep = s.reader && D.dirty.includes(ym) ? C.merge(theirs, mine).list : theirs;
              D.tx = D.tx.filter(x => C.ymOf(x.date) !== ym).concat(keep);
              D.mAt[ym] = s.meta.months[ym];
            }
            D.tx.sort((a, b) => b.at - a.at);
          }
          // a month gone from the family's copy (the reader deleted it): gone here too, for everyone but the reader
          if (!s.reader) for (const ym of Object.keys(D.mAt)) if (!(s.meta.months || {})[ym]) { D.tx = D.tx.filter(x => C.ymOf(x.date) !== ym); delete D.mAt[ym]; }
          if (!s.reader) { D.alerts = s.meta.alerts || []; D.hints = s.meta.hints || []; D.readAt = s.meta.readAt || 0; }
          if (s.meta.settings && (!D.settings || s.meta.settings.at > D.settings.at)) { D.settings = s.meta.settings; D.setDirty = false; }
        } else if (!s.can && !s.open) {
          // not shared with this person (or no longer): nothing of the family's stays here
          if (!hasGmail() || !s.reader) { D.tx = []; D.alerts = []; D.hints = []; D.mAt = {}; D.dirty = []; }
        }
        // the reader (or the first phone with something to send) sends what it read, six months at a time
        if ((s.reader || s.open) && hasGmail() && D.dirty.length && D.tx.length) {
          while (D.dirty.length) {
            const batch = D.dirty.slice(0, 6), months = {};
            for (const ym of batch) months[ym] = D.tx.filter(x => C.ymOf(x.date) === ym);
            const r = await api('push', { months, alerts: D.alerts, hints: D.hints, readAt: D.readAt });
            for (const ym of batch) D.mAt[ym] = (r.months || {})[ym] || r.at;
            D.dirty = D.dirty.filter(x => !batch.includes(x));
            persist();
          }
          if (s.open) st.server = await api('state');
        }
        if (D.setDirty && (st.server.can || st.server.reader)) {
          const r = await api('settings', { settings: D.settings });
          D.settings = r.settings || D.settings; D.setDirty = false;
        }
        persist();
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
  // Settings: the design, your account, Gmail, who sees Money, card rewards, your data
  // ---------------------------------------------------------------------
  let people = null;
  async function loadPeople() {
    try { people = (await api('people')).people || []; } catch { people = []; }
    if (!$('setSheet').hidden) renderSettings();
  }
  function renderSettings() {
    const s = st.server, signed = signedIn(), reader = signed && s && s.reader, viewer = signed && s && !s.reader && !s.open;
    let acct;
    if (!signed) acct = ['On this phone only', 'Sign in with Face ID to share Money with your family, or to see it if it’s shared with you.'];
    else if (!s) acct = ['Checking…', ''];
    else if (s.reader) acct = ['You read Monarch’s emails for the family', (s.with || []).length ? 'Shared with ' + names(s.with) + '.' : 'Not shared with anyone yet.'];
    else if (s.can) acct = [s.readerName + '’s phone reads Monarch’s emails', 'Updated ' + ago(D.readAt) + '.'];
    else if (s.open) acct = ['Nobody reads Monarch’s emails yet', 'Connect Gmail on the phone that gets them.'];
    else acct = [s.readerName + '’s phone reads Monarch’s emails', 'Ask ' + s.readerName + ' to share Money with you: Settings, Who sees Money.'];
    let html = '<p class="label">Design</p><div class="rgroup">' + (window.aosDesign ? aosDesign.picker() : '') + '</div>'
      + '<div class="rgroup acct"><p><strong>' + esc(acct[0]) + '</strong>' + esc(acct[1]) + '</p>' + (!signed ? '<button class="btn" type="button" id="signIn">Sign in with Face ID</button>' : '') + '</div>';
    if (!viewer) {
      html += '<p class="label">Monarch’s emails</p><div class="rgroup">';
      if (hasGmail()) html += '<div class="acct"><p><strong>Gmail connected</strong>Read ' + esc(ago(D.readAt)) + '. Money reads only Monarch’s emails, and can’t change or send anything.</p></div>'
        + '<button class="rowbtn" type="button" id="readNow"><span class="ic">' + I.refresh + '</span><span>Read now</span></button>'
        + '<button class="rowbtn" type="button" id="readAgain"><span class="ic">' + I.mail + '</span><span>Read the last 2 years again<span class="sub">Every Monarch email, from the start</span></span></button>'
        + '<button class="rowbtn" type="button" id="gmailOut"><span class="ic">' + I.out + '</span><span>Disconnect Gmail</span></button>';
      else html += '<div class="acct"><p><strong>Gmail not connected</strong>Money reads Monarch’s alert emails, read-only: it can’t change or send anything.</p><button class="btn" type="button" id="gmailIn">Connect Gmail</button></div>';
      html += '</div><p class="note">In Monarch, set the expense and deposit alerts to $1 (Settings, Notifications), so every transaction is emailed.</p>';
    }
    if (reader) {
      if (people === null) { people = []; loadPeople(); }
      html += '<p class="label">Who sees Money</p><div class="rgroup">' + (people.length ? people.map(p => '<button class="rowbtn" type="button" role="checkbox" data-person="' + esc(p.id) + '" aria-checked="' + (s.with || []).includes(p.id) + '"><span class="check" aria-hidden="true">' + I.tick + '</span><span>' + no(p.name) + '</span></button>').join('')
        : '<div class="acct"><p>Nobody else is in the family yet.</p></div>') + '</div><p class="note">Only you, and those you tick, see Money. Not even the family’s owner otherwise.</p>';
    }
    if (D.tx.length && (!viewer || (s && s.can))) {
      const colour = cardColours(), acct2 = C.accounts(D.tx);
      const cards = [...new Set(D.tx.filter(x => x.dir === 'out').map(x => acct2(x).name).filter(n => n && C.isCard(n)))];
      if (cards.length) {
        html += '<p class="label">Card rewards</p>' + cards.map(c => {
          const r = C.ruleFor(c, settings()) || { base: 0, online: 0, grocery: 0, cap: 0 }, k = esc(C.cardKey(c));
          const f = (id, label, v, unit) => '<div class="frow"><label for="' + id + k + '">' + esc(label) + '</label><input class="num" id="' + id + k + '" data-rule="' + id + '" data-key="' + k + '" type="text" inputmode="decimal" value="' + esc(v || 0) + '" aria-label="' + esc(label) + ', ' + unit + '"><span>' + unit + '</span></div>';
          return '<div class="rgroup"><div class="cardhead"><i class="cdot" data-k="' + colour(c) + '"></i>' + no(c) + '</div>'
            + f('base', 'On everything', r.base, '%') + f('online', 'Online shopping', r.online, '%') + f('grocery', 'Groceries and wholesale clubs', r.grocery, '%') + f('cap', 'Bonus on the first, a quarter', r.cap, '$') + '</div>';
        }).join('') + '<p class="note">Set from what you said: Robinhood 3% on everything; Customized Cash 6% online, and Bank of America’s 2% at grocery stores and wholesale clubs and 1% else, the bonus on the first $2,500 a quarter. Check them against your cards’ terms. 0 for the bonus limit means none.</p>'
          + '<p class="label">Online stores</p><div class="rgroup"><div class="frow"><label class="vh" for="onlineList">Online stores</label><input class="txt" id="onlineList" type="text" autocomplete="off" value="' + esc((settings().online || C.ONLINE).join(', ')) + '"></div></div>'
          + '<p class="note">What counts as online shopping for the card rates, separated by commas.</p>';
      }
    }
    html += '<p class="label">Your data</p><div class="rgroup">'
      + (D.tx.length ? '<button class="rowbtn" type="button" id="exportBtn"><span class="ic">' + I.export + '</span><span>Export<span class="sub">As a CSV spreadsheet</span></span></button>' : '')
      + '<button class="rowbtn danger" type="button" id="wipeBtn"><span class="ic">' + I.bin + '</span><span id="wipeTxt">Delete all data<span class="sub">' + (reader ? 'From this phone, and aOS for everyone it’s shared with' : 'From this phone') + '</span></span></button></div>';
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
    if (t.closest('#gmailOut')) { signOutGmail(); return; }
    if (t.closest('#readNow')) { closeSheet('setSheet'); scan({ loud: true }); return; }
    if (t.closest('#readAgain')) { closeSheet('setSheet'); scan({ loud: true, again: true }); return; }
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
      if (!w.dataset.armed) { w.dataset.armed = '1'; $('wipeTxt').firstChild.textContent = 'Tap again to delete everything'; setTimeout(() => { if (document.contains(w)) { delete w.dataset.armed; $('wipeTxt').firstChild.textContent = 'Delete all data'; } }, 3500); return; }
      if (st.server && st.server.reader) { try { await api('forget', {}, true); } catch { toast('Couldn’t reach aOS, so nothing was deleted. Try again when you’re online.', null, 6000); return; } }
      const n = D.tx.length;
      Object.assign(D, { tx: [], alerts: [], hints: [], settings: null, mAt: {}, dirty: [], setDirty: false, seen: [], lastScan: 0, readAt: 0 });
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
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['Date', 'Merchant', 'Amount', 'In or out', 'Card or account', 'Category', 'Cash back']].concat(
      [...D.tx].sort((a, b) => a.at - b.at).map(x => { const r = st.rw.get(x.id); return [x.date, x.merchant, x.amt.toFixed(2), x.dir === 'in' ? 'In' : 'Out', st.acct(x).name, x.cat, r && r.rate != null ? r.earned.toFixed(2) : '']; }));
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
  load();
  const back = consumeRedirect();
  render();
  animateIn(main);
  if (back && back.error) {
    if (!(back.silent && /^(interaction|login|consent|account_selection)_required$/.test(back.error))) toast(back.error === 'access_denied' ? 'Gmail access was declined.' : 'Gmail sign-in didn’t work (' + back.error + ').', null, 6000);
    else toast('Gmail needs one tap to sign in again: Settings, Connect Gmail.', null, 6000);
  }
  // The family's copy first (it says whether this phone reads Gmail), then Gmail: always after a
  // sign-in, else when it's been over an hour.
  (signedIn() ? sync() : Promise.resolve()).then(() => {
    if (getToken() && (back && back.ok || Date.now() - D.lastScan > H)) scan({ loud: !!(back && back.ok) });
    else if (!getToken() && mayRenew() && mayRead() && Date.now() - D.lastScan > 6 * H) setTimeout(() => signIn({ silent: true }), 800);
  });
  window.addEventListener('storage', e => { if (e.key === KEY) { load(); render(); } });
  let shown = curYm();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (curYm() !== shown) { if (st.ym === shown) st.ym = curYm(); shown = curYm(); }
    render();
    sync().then(() => { if (getToken() && Date.now() - D.lastScan > H) scan(); });
  });
  window.addEventListener('online', () => sync());
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // For the tests (money/scripts/app-test.mjs) only.
  window.__money = { st, D, render, setView, openTx, openList, sync, scan, renderSettings };
})();
