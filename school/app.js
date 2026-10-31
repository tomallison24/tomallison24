"use strict";

// School: the school's ParentSquare emails as one page, most urgent first.
//
// - The top card: today until school is out (3:15 by default), then the next school day: what to wear
//   or bring, events, days off on the way to it, and pickup (the usual carpool, or that weekday's club).
// - Needs you: sign-ups, RSVPs, forms, surveys and payments for her, soonest due first; Mark done
//   (with Undo) takes one away.
// - Coming up: the next two weeks, from the posts' own dates and the newsletters' lists; See all
//   opens the rest of the year.
// - From the class: her homeroom, her grade, her clubs and messages to you, newest first.
// - Everything else: the rest (the whole school, other grades), searchable.
// - Links: the school's other sites, found in its emails (grades, the lunch menu, reading minutes),
//   report cards and payments.
// - Read from Gmail on the phone, read-only (gmail.readonly), as Orders does: Mail's Google client,
//   its own sign-in, or Mail's and Orders' when they're in the same storage (inside aOS). sort.js
//   does the reading; nothing leaves the phone except Calendar's School layer, sent to your own
//   family account when you're signed in (AllisonOS.layer, ../home/welcome.js).
// - Settings: Design · Your child · After school · Connected accounts · Your data · Family account.

// Refuse to run inside another site's frame; this same site may (see Mail's app.js for why).
if (window.top !== window.self && (() => { try { return window.top.location.origin !== location.origin; } catch { return true; } })()) {
  document.body.textContent = 'School can’t be opened inside another page.';
  throw new Error('School refuses to run inside a frame');
}

(function () {
  const P = window.SchoolSort;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    json: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
    del: k => { try { localStorage.removeItem(k); } catch {} },
  };
  const plural = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const H = 36e5, DAY = 864e5;
  const KEY = 'allison-school-v1';
  const K = {
    items: KEY + '-items', seen: KEY + '-seen', done: KEY + '-done', moved: KEY + '-moved', opened: KEY + '-opened', prefs: KEY + '-prefs', lastScan: KEY + '-scan', loc: KEY + '-loc', wx: KEY + '-wx',
    token: 'school.token', state: 'school.state', silent: 'school.silent', silentFail: 'school.silentFail', lastAuth: 'school.lastAuth', hint: 'school.hint', me: 'school.me',
  };
  // Mail's OAuth client (not a secret: see mail/app.js). School's own address must be added to it as a
  // redirect URI once - school/README.md, "Gmail".
  const CLIENT_ID = '804406956056-e91hbdndc4cqgerh9sffl9fmt76nfpua.apps.googleusercontent.com';
  const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
  const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
  const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
  const QUERY = 'from:parentsquare.com', FIRST_SCAN = 'newer_than:1y', MAX_SCAN = 250, KEEP = 400 * DAY;
  const updating = (task, on) => { try { AllisonOS.updating(task, on); } catch {} };

  const ICON = {
    chev: '<svg viewBox="0 0 24 24" class="b"><path d="M9.4 5.4l6.2 5.9a1 1 0 0 1 0 1.4l-6.2 5.9"/></svg>',
    tick: '<svg viewBox="0 0 24 24" class="b"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>',
    shirt: '<svg viewBox="0 0 24 24"><path d="M8.6 3.6 4 6l1.8 4.2 2-.9V20h8.4V9.3l2 .9L20 6l-4.6-2.4a3.6 3.6 0 0 1-6.8 0z"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3.6l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6-5.1-2.8-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7z"/></svg>',
    off: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.4"/><path d="M6.1 6.1l11.8 11.8"/></svg>',
    car: '<svg viewBox="0 0 24 24"><path d="M5 16.6V12l1.7-4.4A2 2 0 0 1 8.6 6.3h6.8a2 2 0 0 1 1.9 1.3L19 12v4.6"/><path d="M4 12h16v4.6H4z"/><circle cx="7.6" cy="19" r="1.6"/><circle cx="16.4" cy="19" r="1.6"/></svg>',
    post: '<svg viewBox="0 0 24 24"><rect x="4.4" y="3.6" width="15.2" height="16.8" rx="3"/><path d="M8 8.4h8M8 12h8M8 15.6h5"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4.4 6.6a3 3 0 0 1 3-3h9.2a3 3 0 0 1 3 3v6.6a3 3 0 0 1-3 3H10l-4.2 3.6v-3.6h-.4a3 3 0 0 1-1-.2z"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1"/></svg>',
    doc: '<svg viewBox="0 0 24 24"><path d="M7 3.6h7l4 4v12.8H7z"/><path d="M14 3.6v4h4M9.6 12.4h5M9.6 15.8h5"/></svg>',
    pay: '<svg viewBox="0 0 24 24"><rect x="3.4" y="6" width="17.2" height="12" rx="2.6"/><path d="M3.4 10h17.2M7 14.6h3"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="10.6" cy="10.6" r="6"/><path d="M15.2 15.2 20 20"/></svg>',
  };

  // ---------------------------------------------------------------------
  // Data, all on this phone: the items read from the emails (sort.js readEmail), which emails were
  // read, what you marked done, moved or opened, and your settings.
  // ---------------------------------------------------------------------
  let items = ls.json(K.items, []);
  let seen = new Set(ls.json(K.seen, []));
  let done = ls.json(K.done, {}), moved = ls.json(K.moved, {}), opened = ls.json(K.opened, {});
  let prefs = ls.json(K.prefs, {});
  const st = { scanning: false, item: null, list: null, q: '' };
  function load() {
    items = ls.json(K.items, []); seen = new Set(ls.json(K.seen, []));
    done = ls.json(K.done, {}); moved = ls.json(K.moved, {}); opened = ls.json(K.opened, {}); prefs = ls.json(K.prefs, {});
  }
  // Kept to about a year; if the phone runs out of room, the oldest posts go first.
  function saveItems() {
    const cut = Date.now() - KEEP;
    items = items.filter(x => x && x.at > cut).sort((a, b) => b.at - a.at);
    let list = items;
    while (!ls.set(K.items, JSON.stringify(list)) && list.length > 50) list = list.slice(0, Math.floor(list.length * 0.8));
    if (list !== items) items = list;
  }
  const saveSeen = () => { const a = [...seen]; ls.set(K.seen, JSON.stringify(a.slice(-6000))); };
  const saveMarks = () => { ls.set(K.done, JSON.stringify(done)); ls.set(K.moved, JSON.stringify(moved)); ls.set(K.opened, JSON.stringify(opened)); };
  const savePrefs = () => ls.set(K.prefs, JSON.stringify(prefs));

  // What we know about the child: your settings, and what the emails say for anything not set.
  const GRADES = [[0, 'Kindergarten'], ...Array.from({ length: 8 }, (_, i) => [i + 1, ['1st', '2nd', '3rd'][i] ? ['1st', '2nd', '3rd'][i] + ' grade' : (i + 1) + 'th grade'])];
  const gradeName = g => (GRADES.find(x => x[0] === +g) || [0, ''])[1];
  const me = () => P.child(items, prefs);

  // ---------------------------------------------------------------------
  // Dates and words
  // ---------------------------------------------------------------------
  const fmt = (s, o) => P.noon(s).toLocaleDateString('en-US', o);
  const day = s => fmt(s, { weekday: 'short', month: 'short', day: 'numeric' });
  const span = (a, b) => b && b !== a ? (P.noon(a).getMonth() === P.noon(b).getMonth() ? fmt(a, { month: 'short', day: 'numeric' }) + '–' + P.noon(b).getDate() : fmt(a, { month: 'short', day: 'numeric' }) + ' – ' + fmt(b, { month: 'short', day: 'numeric' })) : day(a);
  const posted = t => { const d = new Date(t), now = new Date(); return d.toDateString() === now.toDateString() ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  const ago = t => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : plural(Math.round(m / 1440), 'day') + ' ago'; };
  const KIND_WORD = { noschool: 'No school', wear: 'Wear or bring', event: 'Event', clubOff: 'Club', rsvp: 'RSVP', form: 'Sign-up', signup: 'Sign-up', survey: 'Survey', pay: 'Payment', newsletter: 'Newsletter', message: 'Message', post: 'Post', report: 'Report', paid: 'Paid' };
  const KIND_ICON = { wear: 'shirt', event: 'star', noschool: 'off', clubOff: 'off', message: 'chat', report: 'doc', paid: 'pay', pay: 'pay' };
  const ASKS = new Set(['signup', 'rsvp', 'form', 'survey', 'pay']);
  const byId = id => items.find(x => x.id === id);

  // ---------------------------------------------------------------------
  // The page
  // ---------------------------------------------------------------------
  const main = $('main');
  let last = null;   // the sections last drawn
  const row = (o) => {
    const tag = o.href ? 'a' : o.open || o.act ? 'button' : 'div';
    const attrs = o.href ? ' href="' + esc(o.href) + '" target="_blank" rel="noopener"' : (tag === 'button' ? ' type="button"' : '')
      + (o.open ? ' data-open="' + esc(o.open) + '"' : '') + (o.act ? ' data-act="' + esc(o.act) + '"' : '');
    return '<' + tag + ' class="row' + (o.cls ? ' ' + o.cls : '') + '"' + attrs + '>'
      + (o.when != null ? '<span class="when">' + o.when + '</span>' : o.icon ? '<span class="ic" aria-hidden="true">' + ICON[o.icon] + '</span>' : '')
      + '<span class="rt"><b>' + esc(o.title) + '</b>' + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</span>'
      + (o.tag ? '<span class="tag' + (o.tagCls ? ' ' + o.tagCls : '') + '">' + esc(o.tag) + '</span>' : '')
      + (o.chev ? '<span class="chev" aria-hidden="true">' + ICON.chev + '</span>' : '')
      + '</' + tag + '>';
  };
  const whenCell = (d, end) => esc(fmt(d, { weekday: 'short' })) + '<small>' + esc(end && end !== d ? span(d, end).replace(/^[A-Za-z]{3}, /, '') : fmt(d, { month: 'short', day: 'numeric' })) + '</small>';
  const mark = x => '<button class="mark" type="button" data-done="' + esc(x.id) + '" aria-pressed="' + !!done[x.id] + '" aria-label="' + esc((done[x.id] ? 'Not done: ' : 'Mark done: ') + x.title) + '"><i>' + ICON.tick + '</i></button>';
  const timeWord = t => t ? 'At ' + P.clock(t) : '';
  const sec = (label, inner, i) => '<h2 class="sechead" style="--i:' + i + '">' + label + '</h2>' + inner;
  const group = (rows, cls) => '<div class="rgroup' + (cls ? ' ' + cls : '') + '">' + rows.join('') + '</div>';

  function subLine(m) {
    const bits = [m.name || '', m.grade != null ? gradeName(m.grade) : '', m.teacher ? m.teacher : ''].filter(Boolean);
    const kid = bits.length ? '<button class="kid" type="button" data-act="child">' + esc(bits.join(' · ')) + '</button>' : '';
    // (when Gmail was last checked is in Settings: out here it would run over Vintage's shapes)
    $('sub').innerHTML = kid;
    $('sub').hidden = !kid;
  }

  function render() {
    const m = me(), now = new Date();
    subLine(m);
    if (!items.length) {
      main.innerHTML = st.scanning
        ? '<div class="empty"><strong>Reading the school’s emails</strong>This takes a minute the first time.</div>'
        : '<div class="empty"><strong>No school news yet</strong>School reads the school’s ParentSquare emails in Gmail.</div>'
          + '<button class="btn" type="button" data-act="' + (hasGmail() ? 'scan' : 'connect') + '">' + (hasGmail() ? 'Check now' : 'Connect Gmail') + '</button>';
      return;
    }
    const s = last = P.sections(items, { now, me: m, done, moved });
    let h = '', i = 0;

    // 1. the next school day
    const t = s.top, topRows = [];
    for (const g of t.gaps) topRows.push(row({ icon: 'off', title: 'No school ' + span(g.d, g.end), sub: g.why, cls: 'info', tag: 'Day off', tagCls: 'off' }));
    for (const l of t.lines) topRows.push(row({ icon: KIND_ICON[l.kind] || 'post', title: l.title, sub: [timeWord(l.time), KIND_WORD[l.kind] && l.kind !== 'post' ? KIND_WORD[l.kind] : ''].filter(Boolean).join(' · '), open: l.id, chev: true }));
    if (!t.lines.length) topRows.push(row({ icon: 'post', title: 'Nothing special from school', sub: 'A regular day.', cls: 'info' }));
    topRows.push(row({ icon: 'car', title: t.pickup.text, cls: 'info' }));
    const w = weatherLine(t.d, m);
    if (w) topRows.push(row({ icon: 'sun', title: w, cls: 'info' }));
    h += sec(esc(t.label) + (t.label === 'Today' || t.label === 'Tomorrow' ? ' · ' + esc(day(t.d)) : ', ' + esc(fmt(t.d, { month: 'short', day: 'numeric' }))), group(topRows, 'focus'), i++);

    // 2. what needs you
    const needRows = s.needs.slice(0, 6).map(x => '<div class="row">'
      + '<button class="rt" type="button" data-open="' + esc(x.id) + '" style="text-align:left;color:inherit"><b>' + esc(x.title) + '</b><small>' + esc(x.due ? 'Due ' + day(x.due) : [x.author, posted(x.at)].filter(Boolean).join(' · ')) + '</small></button>'
      + mark(x) + '</div>');
    if (s.needs.length > 6) needRows.push(row({ title: 'See all ' + s.needs.length, act: 'list:needs', cls: 'more', chev: true }));
    h += sec('Needs you', s.needs.length ? group(needRows) : group([row({ icon: 'tick', title: 'Nothing needs you right now', cls: 'info' })]), i++);

    // 3. the next two weeks
    const comingRows = s.coming.slice(0, 8).map(e => row({ when: whenCell(e.d, e.end), title: e.title, sub: [timeWord(e.time), e.from ? 'From ' + e.from : ''].filter(Boolean).join(' · '), open: e.id, tag: e.kind === 'noschool' ? 'No school' : '', tagCls: 'off' }));
    comingRows.push(row({ title: 'See the rest of the year', act: 'list:year', cls: 'more', chev: true }));
    h += sec('Coming up', s.coming.length ? group(comingRows) : group([row({ icon: 'star', title: 'Nothing in the next two weeks', cls: 'info' }), comingRows.pop()]), i++);

    // 4. from the class
    if (s.cls.length) {
      const fresh = x => !opened[x.id] && now - x.at < 7 * DAY;
      const clsRows = s.cls.slice(0, 5).map(x => row({ icon: KIND_ICON[x.kind] || 'post', title: x.title, sub: [x.author, posted(x.at)].filter(Boolean).join(' · '), open: x.id, tag: fresh(x) ? 'New' : '' }));
      if (s.cls.length > 5) clsRows.push(row({ title: 'See all from the class', act: 'list:class', cls: 'more', chev: true }));
      h += sec('From the class', group(clsRows), i++);
    }

    // 5. everything else
    h += sec('Everything else', group([row({ icon: 'post', title: 'More from school', sub: plural(s.rest.length, 'post') + ', newest first.', act: 'list:rest', chev: true })]), i++);

    // 6. the school's other sites, report cards and payments
    const siteRows = P.sites(items).map(l => row({ icon: 'link', title: l.name, sub: l.sub, href: l.u }));
    for (const r of s.records.slice(0, 3)) siteRows.push(row({ icon: 'doc', title: r.title, sub: [r.child, posted(r.at)].filter(Boolean).join(' · '), open: r.id, chev: true }));
    if (s.paid.length) siteRows.push(row({ icon: 'pay', title: 'Payments', sub: plural(s.paid.length, 'receipt') + ' from school.', act: 'list:paid', chev: true }));
    if (siteRows.length) h += sec('Links', group(siteRows), i++);

    main.innerHTML = h;
    shareLayer();
    loadWeather(false);
  }

  // ---------------------------------------------------------------------
  // A post, opened; a whole list
  // ---------------------------------------------------------------------
  const gmailWeb = id => 'https://mail.google.com/mail/u/0/#all/' + encodeURIComponent(id);
  const mailApp = thread => '../mail/?thread=' + encodeURIComponent(thread);   // the email in Mail, as Orders opens one
  function openItem(id) {
    const x = byId(id); if (!x) return;
    st.item = id; opened[id] = Date.now(); saveMarks();
    $('itemLbl').textContent = KIND_WORD[x.kind] || 'Post';
    const aud = moved[id] || P.audience(x, me());
    const meta = [x.author, (x.groups || []).join(', '), new Date(x.at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })].filter(Boolean).join(' · ');
    const dates = (x.dates || []).map(d => '<span>' + esc(span(d.d, d.end)) + (d.time ? ', ' + esc(P.clock(d.time)) : '') + '</span>');
    const evs = (x.events || []).map(e => row({ when: whenCell(e.d, e.end), title: e.what, sub: timeWord(e.time) }));
    let h = '<h3 class="ptext" style="font-size:20px;font-weight:600;white-space:normal;margin-top:0">' + esc(x.title) + '</h3>'
      + '<p class="meta">' + esc(meta) + (x.amount ? ' · $' + esc(x.amount) : '') + '</p>';
    if (x.image && /^https:\/\/posts\.parentsquare\.com\//.test(x.image)) h += '<img class="pimg" src="' + esc(x.image) + '" alt="' + esc(x.picture ? 'The newsletter, as a picture' : 'The post’s picture') + '" loading="lazy" referrerpolicy="no-referrer">';
    if (x.body) h += '<p class="ptext">' + esc(x.body.length > 4000 ? x.body.slice(0, 4000) + '…' : x.body) + '</p>';
    if (dates.length) h += '<div class="dchips" aria-label="Dates in this post">' + dates.join('') + '</div>';
    if (evs.length) h += '<h2 class="sechead">Dates in this newsletter</h2>' + group(evs);
    h += '<div class="pbtns">'
      + (x.url ? '<a class="btn" href="' + esc(x.url) + '" target="_blank" rel="noopener">Open in ParentSquare</a>' : '')
      + '<a class="btn quiet" href="' + esc(mailApp(x.thread || x.msg)) + '">Open in Mail</a>'
      + '<a class="btn quiet" href="' + esc(gmailWeb(x.msg)) + '" target="_blank" rel="noopener">Open in Gmail</a>'
      + (ASKS.has(x.kind) || (x.dates || []).length ? '<button class="btn quiet" type="button" data-remind="' + esc(x.id) + '"' + (remindBusy ? ' disabled' : '') + '>Remind me in Notes</button>' : '')
      + (ASKS.has(x.kind) ? '<button class="btn quiet" type="button" data-done="' + esc(x.id) + '">' + (done[x.id] ? 'Not done' : 'Mark done') + '</button>' : '')
      + (x.kind !== 'report' && x.kind !== 'paid' && x.kind !== 'message' ? '<button class="btn quiet" type="button" data-move="' + esc(x.id) + '">' + (aud === 'class' ? 'Move to Everything else' : 'Move to From the class') + '</button>' : '')
      + '</div>';
    $('itemBody').innerHTML = h;
    if ($('itemSheet').hidden) openSheet('itemSheet');
    $('itemBody').scrollTop = 0;
    render();
  }
  function openList(kind) {
    st.list = kind;
    const s = last || P.sections(items, { now: new Date(), me: me(), done, moved });
    const title = { year: 'Coming up', class: 'From the class', rest: 'Everything else', paid: 'Payments', needs: 'Needs you' }[kind];
    $('listLbl').textContent = title;
    let rows = [];
    const q = st.q.trim().toLowerCase();
    const hit = x => !q || (x.title + ' ' + (x.body || '') + ' ' + (x.author || '')).toLowerCase().includes(q);
    if (kind === 'year') rows = s.year.map(e => row({ when: whenCell(e.d, e.end), title: e.title, sub: [timeWord(e.time), e.from ? 'From ' + e.from : ''].filter(Boolean).join(' · '), open: e.id, tag: e.kind === 'noschool' ? 'No school' : '', tagCls: 'off' }));
    if (kind === 'class' || kind === 'rest') rows = (kind === 'class' ? s.cls : s.rest).filter(hit).slice(0, 300).map(x => row({ icon: KIND_ICON[x.kind] || 'post', title: x.title, sub: [x.author, posted(x.at)].filter(Boolean).join(' · '), open: x.id, chev: true }));
    if (kind === 'paid') rows = s.paid.map(x => row({ icon: 'pay', title: x.title, sub: [x.amount ? '$' + x.amount : '', posted(x.at)].filter(Boolean).join(' · '), open: x.id, chev: true }));
    if (kind === 'needs') rows = s.needs.map(x => row({ icon: 'post', title: x.title, sub: x.due ? 'Due ' + day(x.due) : posted(x.at), open: x.id, chev: true }));
    const search = kind === 'rest' || kind === 'class' ? '<label class="search">' + ICON.search + '<span class="vh">Search</span><input id="listQ" type="search" placeholder="Search" value="' + esc(st.q) + '" autocomplete="off"></label>' : '';
    $('listBody').innerHTML = search + (rows.length ? group(rows) : '<div class="empty">' + (q ? 'Nothing matches.' : 'Nothing here yet.') + '</div>');
    if ($('listSheet').hidden) openSheet('listSheet');
  }
  $('listBody').addEventListener('input', e => { if (e.target.id !== 'listQ') return; st.q = e.target.value; const pos = e.target.selectionStart; openList(st.list); const q = $('listQ'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch {} } });

  // Remind me in Notes: a dated reminder in the family's Notes (through its Sheet: ../home/sheet.js
  // AllisonOS.sheet.notes, signed in), the day before it's due or happens (today when that's today, tomorrow
  // or past; today for an ask with no date). Its id comes from the post, so tapping again adds nothing twice.
  // Extra, if you use Notes: with no sign-in or Notes Sheet the toast says so (as Orders' return reminder).
  let remindBusy = false;
  const NOTES_SAY = {
    signin: 'Sign in with Face ID in Settings to set a reminder in Notes.',
    'no-sheet': 'Set up the Notes Sheet in aOS first (Account → Google Sheets).',
    offline: 'Offline. Try again when you’re back online.',
  };
  const remindDay = x => {
    const today = P.ymd(new Date()), when = x.due || ((x.dates || []).find(d => (d.end || d.d) >= today) || {}).d;
    return !when || P.between(today, when) <= 1 ? today : P.addDays(when, -1);
  };
  const dayWord = d => d === P.ymd(new Date()) ? 'today' : d === P.addDays(P.ymd(new Date()), 1) ? 'tomorrow' : day(d);
  async function remind(id) {
    const x = byId(id), SN = window.AllisonOS && AllisonOS.sheet && AllisonOS.sheet.notes;
    if (!x || remindBusy) return;
    if (!SN) { toast(NOTES_SAY.signin); return; }
    const s = last || P.sections(items, { now: new Date(), me: me(), done, moved }), ask = s.needs.find(n => n.id === id) || x;
    const date = remindDay(ask), when = ask.due ? 'Due ' + day(ask.due) : (x.dates || [])[0] ? day(x.dates[0].d) : '';
    const notes = ['From School' + (x.author ? ', ' + x.author : ''), when].filter(Boolean).join('\n');
    remindBusy = true; if (st.item === id) openItem(id);
    const res = await SN.addTodos({ list: 'Family', items: [{ key: 'school:' + x.id, title: x.title.slice(0, 200), date, notes }] });
    remindBusy = false; if (st.item === id) openItem(id);
    if (!res.ok) { toast(NOTES_SAY[res.why] || 'Couldn’t reach the Notes Sheet. Try again later.', null, 6000); return; }
    toast(res.added ? 'Reminder set in Notes for ' + dayWord(date) + '.' : 'It’s in Notes already.', null, 5000);
  }
  function setDone(id, on, quiet) {   // quiet: Ipsy's change, whose Undo is in its chat
    const x = byId(id); if (!x) return;
    if (on) done[id] = Date.now(); else delete done[id];
    saveMarks(); render();
    if (st.item === id) openItem(id);
    if (on && !quiet) toast('Marked done.', () => setDone(id, false));
  }
  function move(id) {
    const x = byId(id); if (!x) return;
    const now = moved[id] || P.audience(x, me()), to = now === 'class' ? 'school' : 'class';
    const was = moved[id];
    moved[id] = to; saveMarks(); openItem(id);
    toast(to === 'class' ? 'Moved to From the class.' : 'Moved to Everything else.', () => { if (was) moved[id] = was; else delete moved[id]; saveMarks(); render(); if (st.item === id) openItem(id); });
  }

  document.addEventListener('click', e => {
    const d = e.target.closest('[data-done]'); if (d) { e.preventDefault(); setDone(d.dataset.done, !done[d.dataset.done]); return; }
    const mv = e.target.closest('[data-move]'); if (mv) { move(mv.dataset.move); return; }
    const rm = e.target.closest('[data-remind]'); if (rm) { remind(rm.dataset.remind); return; }
    const o = e.target.closest('[data-open]'); if (o) { openItem(o.dataset.open); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    if (act === 'connect') { signIn(); return; }
    if (act === 'scan') { scan({ loud: true }); return; }
    if (act === 'child') { renderMore(); openSheet('moreSheet'); return; }
    if (act.startsWith('list:')) { st.q = ''; openList(act.slice(5)); }
  });

  // ---------------------------------------------------------------------
  // Settings, as in every app (../home/settings.js): Design · Your child · After school ·
  // Connected accounts · Your data · Family account
  // ---------------------------------------------------------------------
  const A = () => window.AllisonOS && window.AllisonOS.account;
  const signedIn = () => !!(A() && A().token && A().token());
  const more = $('moreBody');
  const TIMES = (from, to) => { const out = []; for (let m = from; m <= to; m += 5) out.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')); return out; };
  function renderMore() {
    const S = AllisonOS.settings, m = me(), d = P.detect(items);
    const groups = [...new Set(items.flatMap(x => x.groups || []))].filter(g => g && g !== d.school).sort();
    const timeSel = (id, title, value, from, to) => S.select({ id, title, value, options: TIMES(from, to).map(t => [t, P.clock(t)]) });
    const tok = getToken(), who = ls.get(K.me, '') || ls.get('mail.me', '');
    more.innerHTML = (window.aosDesign ? S.section('Design', S.raw(aosDesign.picker(), { id: 'moreDesign' })) : '')
      + S.section('Your child', [
        S.input({ id: 'cName', title: 'Name', value: prefs.name || '', placeholder: 'Her first name' }),
        S.select({ id: 'cGrade', title: 'Grade', value: prefs.grade != null && prefs.grade !== '' ? prefs.grade : '', options: [['', d.grade != null ? 'From the emails: ' + gradeName(d.grade) : 'Not set'], ...GRADES] }),
        S.input({ id: 'cTeacher', title: 'Teacher', value: prefs.teacher || '', placeholder: d.teacher || 'Her teacher’s name' }),
        S.select({ id: 'cRoom', title: 'Her class in ParentSquare', value: prefs.homeroom != null ? prefs.homeroom : '', options: [['', d.homeroom ? 'From the emails: ' + d.homeroom : 'Not set'], ...groups.map(g => [g, g])] }),
      ], { hint: 'Anything left empty comes from the school’s emails.' })
      + S.section('After school', [
        timeSel('cDrop', 'Drop-off', prefs.dropoff || '07:45', 6 * 60 + 30, 9 * 60),
        timeSel('cEnds', 'School ends', m.ends, 13 * 60, 16 * 60 + 30),
        timeSel('cBy', 'Pick up by', m.pickupBy, 13 * 60, 17 * 60),
        S.input({ id: 'cLane', title: 'Carpool lane', value: prefs.lane || '', placeholder: 'Lane 1' }),
        ...['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((w, i) => S.input({ id: 'club' + (i + 1), title: w + ' club', value: prefs['club' + (i + 1)] || '', placeholder: 'None' })),
        timeSel('cClub', 'Clubs end', prefs.clubUntil || '15:50', 15 * 60, 18 * 60),
        S.toggle({ id: 'cCare', title: 'After-school care', sub: 'Pickup is any time until care ends, every school day.', on: prefs.care === 'on' }),
        prefs.care === 'on' ? timeSel('cCareTo', 'Care ends', prefs.careUntil || '18:00', 15 * 60 + 30, 19 * 60) : '',
        S.toggle({ id: 'cWx', title: 'Weather at drop-off and pickup', sub: 'Uses Weather’s place, or where this phone is.', on: prefs.weather !== 'off' }),
      ], { hint: 'A club on a weekday changes that day’s pickup time.' })
      + S.section('Connected accounts', hasGmail() ? [
        S.info({ id: 'gState', title: 'Gmail', sub: tok ? (who ? 'Signed in as ' + who + '.' : 'Signed in.') : 'Signed out; it signs in again when School opens.' }),
        S.action({ id: 'scanBtn', icon: 'refresh', title: 'Check now', sub: 'Last checked ' + ago(+ls.get(K.lastScan, 0)) + '.' }),
        S.action({ id: 'rereadBtn', icon: 'mail', title: 'Read the last year again', sub: 'Keeps what you marked done or moved.' }),
        ls.get(K.token + '.ever', '') ? S.danger({ id: 'gOut', icon: 'out', title: 'Disconnect Gmail', sub: 'What School has read stays on this phone.' }) : '',
      ] : [S.action({ id: 'gIn', icon: 'mail', title: 'Connect Gmail', sub: 'Reads the school’s ParentSquare emails, read-only.' })])
      + S.section('Your data', [
        S.action({ id: 'exportBtn', icon: 'upload', title: 'Back up everything', sub: 'A file with what School has read and your settings.' }),
        S.action({ id: 'importBtn', icon: 'download', title: 'Import a backup', sub: 'Brings back a School backup.' }),
        S.danger({ id: 'wipeBtn', title: 'Delete all data', sub: 'From this phone; your Gmail is not touched.' }),
      ])
      + S.section('Family account', [
        S.info({ id: 'acctState', title: signedIn() ? 'Signed in' : 'Not signed in', sub: signedIn() ? 'School’s dates show in your Calendar.' : 'Sign in to show school dates in Calendar.' }),
        !signedIn() && A() ? S.action({ id: 'signInBtn', icon: 'face', title: 'Sign in with Face ID', sub: 'Shows school dates in Calendar.' }) : '',
      ]);
  }
  $('moreBtn').onclick = () => { renderMore(); openSheet('moreSheet'); };
  if (window.aosDesign) aosDesign.bind(more);
  const PREF = { cCareTo: 'careUntil', cDrop: 'dropoff', cName: 'name', cGrade: 'grade', cTeacher: 'teacher', cRoom: 'homeroom', cEnds: 'ends', cBy: 'pickupBy', cLane: 'lane', cClub: 'clubUntil', club1: 'club1', club2: 'club2', club3: 'club3', club4: 'club4', club5: 'club5' };
  more.addEventListener('change', e => {
    const k = PREF[e.target.id]; if (!k) return;
    const v = String(e.target.value || '').trim().slice(0, 80);
    if (v === '') delete prefs[k]; else prefs[k] = v;
    savePrefs(); render();
  });
  more.addEventListener('click', async e => {
    const S = AllisonOS.settings;
    if (e.target.closest('#gIn')) { signIn({ choose: true }); return; }
    const cb = e.target.closest('#cCare');
    if (cb) { if (S.flip(cb)) prefs.care = 'on'; else delete prefs.care; savePrefs(); render(); renderMore(); return; }
    const wxb = e.target.closest('#cWx');
    if (wxb) { const on = S.flip(wxb); if (on) delete prefs.weather; else prefs.weather = 'off'; savePrefs(); render(); if (on) loadWeather(true); return; }
    if (e.target.closest('#scanBtn')) { closeSheet('moreSheet'); scan({ loud: true }); return; }
    if (e.target.closest('#rereadBtn')) { seen = new Set(); ls.del(K.lastScan); saveSeen(); closeSheet('moreSheet'); scan({ loud: true }); return; }
    const out = e.target.closest('#gOut'); if (out) { if (S.armed(out, 'Tap again to disconnect')) signOut(); return; }
    if (e.target.closest('#exportBtn')) { backup(); return; }
    if (e.target.closest('#importBtn')) { $('importFile').value = ''; $('importFile').click(); return; }
    if (e.target.closest('#signInBtn')) {
      try { await A().signIn(); toast('Signed in. School’s dates go to your Calendar.'); ls.del('aos.layer.school'); shareLayer(); renderMore(); }
      catch (err) { toast(err && err.name === 'NotAllowedError' ? 'No passkey found, or canceled. Set up your account in aOS first.' : 'Couldn’t sign in.'); }
      return;
    }
    const w = e.target.closest('#wipeBtn');
    if (w && S.armed(w, 'Tap again to delete everything')) {
      const n = items.length;
      items = []; seen = new Set(); done = {}; moved = {}; opened = {}; prefs = {};
      [K.items, K.seen, K.done, K.moved, K.opened, K.prefs, K.lastScan].forEach(ls.del);
      render(); renderMore();
      toast('Deleted ' + plural(n, 'post') + ' and your settings.');
    }
  });
  function backup() {
    const blob = new Blob([JSON.stringify({ app: 'school', v: 1, at: new Date().toISOString(), prefs, done, moved, opened, items }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'school-backup-' + P.ymd(new Date()) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Saved a backup.');
  }
  $('importFile').addEventListener('change', async () => {
    const file = $('importFile').files[0]; if (!file) return;
    $('importFile').value = '';
    let b; try { b = JSON.parse(await file.text()); } catch { b = null; }
    if (!b || b.app !== 'school' || !Array.isArray(b.items)) { toast('That file isn’t a School backup.', null, 6000); return; }
    const have = new Set(items.map(x => x.id)); let added = 0;
    for (const x of b.items) if (x && x.id && x.title && !have.has(x.id)) { items.push(x); seen.add(x.msg); added++; }
    done = Object.assign({}, b.done, done); moved = Object.assign({}, b.moved, moved); opened = Object.assign({}, b.opened, opened);
    if (b.prefs && typeof b.prefs === 'object') prefs = Object.assign({}, b.prefs, prefs);
    saveItems(); saveSeen(); saveMarks(); savePrefs(); render(); renderMore();
    toast(added ? 'Brought in ' + plural(added, 'post') + '.' : 'Nothing new: it’s all here already.', null, 6000);
  });

  // ---------------------------------------------------------------------
  // Gmail: sign-in (as Mail and Orders do it) and reading
  // ---------------------------------------------------------------------
  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');
  class AuthError extends Error {}
  const tokenAt = k => { try { const o = JSON.parse(ls.get(k, 'null')); if (o && o.exp > Date.now() && (k === K.token || /gmail\.(modify|readonly)|mail\.google\.com/.test(o.scope || ''))) return o; } catch {} return null; };
  // Opened in aOS, Mail's and Orders' sign-ins are in the same storage and cover reading.
  const getToken = () => tokenAt(K.token) || tokenAt('mail.token') || tokenAt('orders.token');
  const mayRenew = () => !!ls.get(K.token + '.ever', '') && Date.now() - +ls.get(K.lastAuth, 0) > 60e3 && Date.now() - +ls.get(K.silentFail, 0) > 12 * H;
  const hasGmail = () => !!getToken() || !!ls.get(K.token + '.ever', '');
  // Inside aOS Google's sign-in can't open in this app's frame: the whole aOS window goes to Google and comes
  // back to this page, which ../home/welcome.js takes back into aOS (aos.away), as for Orders.
  function toGoogle(u, silent) {
    let inAOS = false; try { inAOS = window.top !== window && !!window.top.aosHome; } catch {}
    if (!inAOS) { location.replace(u); return; }
    const box = window.frameElement && window.frameElement.parentElement;
    if (silent && box && box.hidden) return;
    try { localStorage.setItem('aos.away', 'school|' + Date.now()); } catch {}
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
    const tok = tokenAt(K.token);
    if (tok) fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true, body: new URLSearchParams({ token: tok.t }) }).catch(() => {});
    [K.token, K.token + '.ever', K.state, K.silent, K.silentFail, K.lastAuth, K.hint, K.me].forEach(ls.del);
    renderMore(); render();
    toast('Disconnected Gmail. What School read stays.');
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
    if (res.status === 401) { if (tok === tokenAt(K.token)) ls.del(K.token); throw new AuthError('expired'); }
    if (res.status === 429 || (res.status === 403 && /rate ?limit|quota/i.test(text))) { if (tries < 2) { await sleep(2500 + Math.random() * 1500); return gmail(path, params, tries + 1); } throw new Error('Gmail asked to slow down. Try again in a minute.'); }
    if (res.status >= 500 && tries < 2) { await sleep(800 * 2 ** tries); return gmail(path, params, tries + 1); }
    if (!res.ok) { let m = text.slice(0, 160); try { m = JSON.parse(text).error.message; } catch {} throw new Error(m || 'Gmail returned ' + res.status); }
    return text ? JSON.parse(text) : null;
  }
  async function pool(list, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) { const k = i++; await fn(list[k], k); } }));
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
      if (p.body && p.body.data && !p.filename) {
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
  async function scan({ loud, next } = {}) {
    if (st.scanning) return;
    if (!getToken()) {
      if (mayRenew()) { signIn({ silent: true }); return; }
      if (loud) { renderMore(); openSheet('moreSheet'); }
      return;
    }
    st.scanning = true; scanErr = ''; render();
    if (!next) updating('gmail', true);
    busyPill('Reading Gmail');
    const startedAt = Date.now(), lastAt = +ls.get(K.lastScan, 0);
    const since = lastAt ? 'after:' + Math.floor(lastAt / 1000 - 3 * 86400) : FIRST_SCAN;
    let added = 0, more = false;
    try {
      if (!ls.get(K.me, '')) gmail('/profile').then(p => { if (p && p.emailAddress) { ls.set(K.me, p.emailAddress); ls.set(K.hint, p.emailAddress); } }).catch(() => {});
      const ids = [];
      let pageToken;
      do {
        const r = await gmail('/messages', { q: QUERY + ' ' + since, maxResults: 100, pageToken });
        (r.messages || []).forEach(m => ids.push(m));
        pageToken = r.nextPageToken;
      } while (pageToken && ids.length < 3000);
      const fresh = ids.filter(m => !seen.has(m.id));
      more = fresh.length > MAX_SCAN;
      const todo = fresh.slice(0, MAX_SCAN);   // newest first
      let doneN = 0;
      await pool(todo, 4, async m => {
        let msg;
        try { msg = await gmail('/messages/' + m.id, { format: 'full' }); }
        catch (e) { if (e instanceof AuthError) throw e; return; }   // one bad message doesn't stop the rest
        const { html, text } = bodies(msg.payload);
        const got = P.readEmail({ id: msg.id, threadId: msg.threadId, subject: header(msg, 'subject'), date: +msg.internalDate || Date.now(), text: text && text.length > 40 ? text : '', html });
        items = items.filter(x => x.msg !== msg.id).concat(got);
        added += got.length; seen.add(m.id); doneN++;
        if (doneN % 10 === 0) busyPill('Reading Gmail · ' + doneN + ' of ' + todo.length);
        if (doneN % 40 === 0) { saveItems(); saveSeen(); }
      });
      if (!more) ls.set(K.lastScan, String(startedAt));
    } catch (e) {
      scanErr = e instanceof AuthError ? 'auth' : e.message;
    } finally {
      saveItems(); saveSeen();
      st.scanning = false;
      if (scanErr || !more) updating('gmail', false);
      render();
      if (scanErr === 'auth') { busyPill(); if (loud) { toast('Gmail needs you to sign in again.'); renderMore(); openSheet('moreSheet'); } else if (mayRenew()) signIn({ silent: true }); }
      else if (scanErr) { busyPill(); if (loud) toast(scanErr); }
      else if (more) { busyPill('Reading Gmail · more to read'); setTimeout(() => scan({ loud: false, next: true }), 400); }
      else pillDone(added ? plural(added, 'new post') : 'Up to date');
    }
  }
  const scanDue = () => Date.now() - +ls.get(K.lastScan, 0) > 30 * 6e4;

  // ---------------------------------------------------------------------
  // The weather at drop-off and pickup (Settings > After school), from Open-Meteo's hourly forecast for
  // where you are: Weather's saved place if it left one in this storage (as Calendar does), else this
  // phone's location, asked once and kept on the phone. Fetched at most once an hour; °F on a US phone.
  // ---------------------------------------------------------------------
  let wx = ls.json(K.wx, null), wxBusy = false;
  const useF = () => /^en-(US|LR|MM)|^(my|en)$/i.test(navigator.language || 'en-US') || /-US$/i.test(navigator.language || '');
  function weatherLine(d, m) {
    if (prefs.weather === 'off' || !wx || !wx.hourly) return '';
    const p = P.pickup(d, m), at = p.care ? m.careUntil : p.club ? (prefs.clubUntil || '15:50') : m.ends;
    const a = P.wxAt(wx.hourly, d, prefs.dropoff || '07:45', useF()), b = P.wxAt(wx.hourly, d, at, useF());
    if (!a && !b) return '';
    return [a ? 'Drop-off ' + a.text : '', b ? 'Pickup ' + b.text : ''].filter(Boolean).join(' · ') + '.';
  }
  function savedPlace() {
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k.startsWith('wx.')) continue; const v = JSON.parse(localStorage.getItem(k)); const o = v && typeof v === 'object' ? (Array.isArray(v) ? v[0] : v) : null; if (o && isFinite(o.lat) && isFinite(o.lon)) return { lat: +o.lat, lon: +o.lon }; } } catch {}
    return null;
  }
  async function loadWeather(force) {
    if (prefs.weather === 'off' || wxBusy || !items.length) return;
    if (!force && wx && wx.hourly && Date.now() - wx.at < H) return;
    let loc = ls.json(K.loc, null) || savedPlace();
    if (!loc && navigator.geolocation && !ls.get(K.loc + '-denied', '')) {
      wxBusy = true;
      try { const p = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, maximumAge: 6 * H })); loc = { lat: p.coords.latitude, lon: p.coords.longitude }; }
      catch { ls.set(K.loc + '-denied', '1'); }
      wxBusy = false;
    }
    if (!loc) return;
    ls.set(K.loc, JSON.stringify({ lat: +(+loc.lat).toFixed(3), lon: +(+loc.lon).toFixed(3) }));
    wxBusy = true;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto';
      const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + (+loc.lat).toFixed(3) + '&longitude=' + (+loc.lon).toFixed(3) + '&hourly=temperature_2m,precipitation_probability,weather_code&timezone=' + encodeURIComponent(tz) + '&forecast_days=7', { referrerPolicy: 'no-referrer' });
      const j = await r.json();
      if (j && j.hourly && Array.isArray(j.hourly.time)) { wx = { at: Date.now(), hourly: j.hourly }; ls.set(K.wx, JSON.stringify(wx)); if (!st.item && !st.list) render(); }
    } catch {} finally { wxBusy = false; }
  }

  // Calendar's School layer: days off, events and what's due, in your own family account
  // (../home/welcome.js AllisonOS.layer; sent only when it changed, and only signed in).
  function shareLayer() {
    const L = window.AllisonOS && AllisonOS.layer;
    if (!L || !L.share || !items.length) return;
    try { L.share('school', { items: P.calendarItems(items, { me: me(), done, moved }) }); } catch {}
  }

  // ---------------------------------------------------------------------
  // The busy pill, sheets and the toast (as in Drinks)
  // ---------------------------------------------------------------------
  let pillTimer, pillAt = 0;
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
  const focusStack = [];
  const lockPage = () => document.documentElement.classList.toggle('locked', [...document.querySelectorAll('.sheetwrap')].some(w => !w.hidden));
  function openSheet(id) { focusStack.push(document.activeElement); $(id).hidden = false; lockPage(); }
  function closeSheet(id) { if ($(id).hidden) return; $(id).hidden = true; lockPage(); const f = focusStack.pop(); if (f && f.focus && document.contains(f)) f.focus(); }
  const closers = { itemSheet: () => { closeSheet('itemSheet'); st.item = null; }, listSheet: () => { closeSheet('listSheet'); st.list = null; } };
  const closeWrap = w => (closers[w.id] || (() => closeSheet(w.id)))();
  document.querySelectorAll('.sheetwrap').forEach(w => w.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeWrap(w); }));
  if (window.visualViewport) {
    const vv = window.visualViewport, root = document.documentElement.style;
    const fit = () => { root.setProperty('--vvh', vv.height + 'px'); root.setProperty('--vvt', vv.offsetTop + 'px'); };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
  }
  document.addEventListener('focusin', e => { const el = e.target; if (el.matches && el.matches('input, select') && el.closest('.sheetbody')) setTimeout(() => el.scrollIntoView({ block: 'nearest' }), 350); });
  // Drag a sheet down by its handle or title bar to close it.
  document.querySelectorAll('.sheetwrap').forEach(w => {
    const sheet = w.querySelector('.sheet'), scrim = w.querySelector('.scrim');
    let y0 = null, t0 = 0, dy = 0, drag = false, suppress = false;
    const reset = () => { sheet.classList.remove('dragging', 'settling'); sheet.style.transform = ''; scrim.style.opacity = ''; };
    const start = (y, target) => { if (!target.closest('.grab, .sheethead') || target.closest('button')) { y0 = null; return; } y0 = y; t0 = Date.now(); dy = 0; drag = false; };
    const mv = (y, e) => {
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
    sheet.addEventListener('touchmove', e => mv(e.touches[0].clientY, e), { passive: false });
    sheet.addEventListener('touchend', end); sheet.addEventListener('touchcancel', end);
    sheet.addEventListener('mousedown', e => { if (e.button === 0) start(e.clientY, e.target); });
    window.addEventListener('mousemove', e => mv(e.clientY, e)); window.addEventListener('mouseup', end);
    sheet.addEventListener('click', e => { if (suppress) { e.stopPropagation(); e.preventDefault(); } }, true);
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.sheetwrap')].reverse().find(w => !w.hidden);
    if (open) closeWrap(open);
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

  // ---------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------
  const back = consumeRedirect();
  render();
  animateIn(main);
  if (back && back.ok) setTimeout(() => scan({ loud: true }), 100);
  else if (back && back.error && !back.silent) toast(back.error === 'access_denied' ? 'Gmail wasn’t connected.' : 'Couldn’t connect Gmail. Try again.', null, 6000);
  else if (getToken() && scanDue()) setTimeout(() => scan({ loud: false }), 600);
  else if (!getToken() && mayRenew() && scanDue()) setTimeout(() => signIn({ silent: true }), 800);
  // Opened from Calendar's School layer: ?item=<id> opens that post.
  const q = new URLSearchParams(location.search).get('item');
  if (q && byId(q)) openItem(q);
  window.addEventListener('load', () => { setTimeout(shareLayer, 1500); setTimeout(() => loadWeather(false), 900); });
  window.addEventListener('storage', e => { if (e.key && e.key.startsWith(KEY)) { load(); render(); } });
  // Back to the app: the time of day moves the top card (3:15), and there may be new mail.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!st.item && !st.list) render();
    if (getToken() && scanDue()) scan({ loud: false });
    loadWeather(false);
  });
  setInterval(() => { if (document.visibilityState === 'visible' && !st.item && !st.list) render(); }, 5 * 6e4);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // Ipsy in aOS (../aOS/home-tab.js) reads the school day, what needs you and the posts, and marks an ask
  // done: ipsy-tools.js, offered as AllisonOS.ipsyTools (School has no chat of its own).
  if (window.SchoolIpsy) (window.AllisonOS = window.AllisonOS || {}).ipsyTools = { app: 'school', name: 'School', ...window.SchoolIpsy({
    P, items: () => items, me, done: () => done, moved: () => moved, setDone, weatherLine, openItem }) };

  // For the tests (school/scripts/app-test.mjs) only.
  window.__school = { st, items: () => items, set: list => { items = list; saveItems(); render(); }, render, openItem, openList, me, done: () => done };
})();
