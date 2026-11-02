"use strict";

// Improve: one list of feedback about the aOS apps, kept small so it's quick to dump into.
//
// - One screen: a box at the top to type a bug, an improvement or an idea, with its kind and which
//   app it's about (both remembered for the next one), and Add; under it the list, newest first,
//   Open or Done (two capsules with the sliding thumb, ../home/slide.js).
// - Tapping an item opens its sheet: change what it says, its kind or its app, mark it done (or
//   open again), or delete it (a danger row that asks again, then Undo).
// - The list lives on this phone (allison-improve-v1) and, signed in to your family account, in the
//   family's Google Sheet (through aOS: ../home/sheet.js, aOS/SHEETS.md). Everyone in the family sees
//   every item, each marked with whose it is; only its own person, or the owner, changes one (the
//   Sheet's script holds to that too). Nothing is dated: every phone keeps every item. Signed out,
//   it works on the phone alone, and goes to the Sheet once you sign in.
// - Settings: Design, Your data (Export as a spreadsheet) and Family account. No Sheet settings: it
//   syncs by itself, and the owner sets the Sheet up in aOS (Account -> Google Sheets).

// Refuse to run inside another site's frame; this same site may (see Mail's app.js for why).
if (window.top !== window.self && (() => { try { return window.top.location.origin !== location.origin; } catch { return true; } })()) {
  document.body.textContent = 'Improve can’t be opened inside another page.';
  throw new Error('Improve refuses to run inside a frame');
}

(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    json: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
    del: k => { try { localStorage.removeItem(k); } catch {} },
  };
  const pad = n => String(n).padStart(2, '0');
  const plural = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
  const KEY = 'allison-improve-v1';
  // add: the add box's kind and app, kept for the next one; show: Open or Done
  const K = { graves: KEY + '-graves', syncAt: KEY + '-synced-at', who: KEY + '-who', people: KEY + '-people', add: KEY + '-add', show: KEY + '-show' };

  // ---------------------------------------------------------------------
  // What an item says it is about
  // ---------------------------------------------------------------------
  const KINDS = [['bug', 'Bug'], ['improvement', 'Improvement'], ['idea', 'Idea']];
  const kindName = k => (KINDS.find(x => x[0] === k) || KINDS[1])[1];
  // The apps, from aOS's own list (../home/welcome.js, loaded after this; the same names as a fallback until it has)
  const FALLBACK = { mail: 'Mail', calendar: 'Calendar', clock: 'Clock', news: 'News', weather: 'Weather', notes: 'Notes', podcasts: 'Podcasts', travel: 'Travel',
    places: 'Places', fitness: 'Fitness', drinks: 'Drinks', meals: 'Meals', orders: 'Orders', school: 'School', money: 'Money', house: 'Home', sparkle: 'Sparkle Kingdom', improve: 'Improve' };
  function appList() {
    const D = window.AllisonOS && AllisonOS.welcome && AllisonOS.welcome.data;
    const names = D && D.NAMES ? Object.fromEntries((D.APPS || []).map(id => [id, D.NAMES[id] || id])) : FALLBACK;
    return [['general', 'General'], ['aos', 'aOS']].concat(Object.entries(names).sort((a, b) => a[1].localeCompare(b[1], 'en-US')));
  }
  const appName = id => (appList().find(x => x[0] === id) || [id, FALLBACK[id] || (id ? String(id) : 'General')])[1];

  // ---------------------------------------------------------------------
  // Data: { v: 1, items: [{ id, text, kind: bug | improvement | idea, app: an app's id, 'aos' or 'general',
  // status: open | done, added: 'YYYY-MM-DD', at: ms, doneOn: 'YYYY-MM-DD' | '', by, updated }] }.
  // 'updated' is stamped on any change, and anything deleted leaves a grave (items:id -> when), so a sync
  // can tell newer from older and gone from not yet seen (as Fitness and Drinks).
  // ---------------------------------------------------------------------
  let items = [], graves = {};
  const okItem = x => x && typeof x.id === 'string' && /^[A-Za-z0-9_-]{1,60}$/.test(x.id) && typeof x.text === 'string';
  function tidy(x) {
    if (!KINDS.some(k => k[0] === x.kind)) x.kind = 'improvement';
    if (typeof x.app !== 'string' || !x.app) x.app = 'general';
    if (x.status !== 'done') x.status = 'open';
    return x;
  }
  function load() {
    const d = ls.json(KEY, null) || {};
    items = Array.isArray(d.items) ? d.items.filter(okItem).map(tidy) : [];
    const g = ls.json(K.graves, {}); graves = g && typeof g === 'object' && !Array.isArray(g) ? g : {};
    initShadow();
  }
  // What each item looked like at the last save.
  const shadow = new Map();
  function initShadow() {
    shadow.clear();
    items.forEach(it => { if (!it.updated) it.updated = 1; const { updated, ...rest } = it; shadow.set('items:' + it.id, JSON.stringify(rest)); });
  }
  function track() {
    const now = Date.now(), have = new Set();
    items.forEach(it => {
      const k = 'items:' + it.id, { updated, ...rest } = it, j = JSON.stringify(rest);
      have.add(k);
      if (shadow.get(k) !== j) { it.updated = now; shadow.set(k, j); delete graves[k]; }
    });
    shadow.forEach((j, k) => { if (!have.has(k)) { graves[k] = now; shadow.delete(k); } });
  }
  let storeWarned = false;
  function persist() {
    const ok = ls.set(KEY, JSON.stringify({ v: 1, items })) && ls.set(K.graves, JSON.stringify(graves));
    if (!ok && !storeWarned) { storeWarned = true; toast('This phone couldn’t save Improve: its storage is full.'); }
  }
  function save() { track(); persist(); if (signedIn()) scheduleSync(); }
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // ---------------------------------------------------------------------
  // Dates: 'YYYY-MM-DD' strings in the phone's zone, shown the US way ("Nov 2")
  // ---------------------------------------------------------------------
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => ymd(new Date());
  const noon = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), 12);
  const short = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? noon(s).toLocaleDateString('en-US', s.slice(0, 4) === today().slice(0, 4) ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  // ---------------------------------------------------------------------
  // Who: whose an item is, and whether this phone's person may change it (its own, or the owner's phone)
  // ---------------------------------------------------------------------
  const A = () => window.AllisonOS && window.AllisonOS.account;
  const signedIn = () => !!(A() && A().token());
  const me = () => (A() && A().user()) || null;
  const meId = () => (me() && me().id) || ls.get(K.who, '');
  const people = () => ls.json(K.people, {}) || {};
  const mine = it => !it.by || it.by === meId();
  const canEdit = it => mine(it) || !!(me() && me().role === 'owner');
  const whoOf = it => mine(it) ? '' : (people()[it.by] || 'Someone else');

  // ---------------------------------------------------------------------
  // The page: the add box, Open / Done, the list
  // ---------------------------------------------------------------------
  const st = { show: ls.get(K.show, 'open') === 'done' ? 'done' : 'open', editing: null };
  const addPrefs = () => { const p = ls.json(K.add, {}) || {}; return { kind: KINDS.some(k => k[0] === p.kind) ? p.kind : 'improvement', app: typeof p.app === 'string' && p.app ? p.app : 'general' }; };
  const options = (list, v) => list.map(([k, l]) => '<option value="' + esc(k) + '"' + (k === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('');
  function drawPickers() {
    const p = addPrefs(), apps = appList();
    $('addKind').innerHTML = options(KINDS, p.kind);
    $('addApp').innerHTML = options(apps.some(a => a[0] === p.app) ? apps : apps.concat([[p.app, appName(p.app)]]), p.app);
  }
  const keepPrefs = () => ls.set(K.add, JSON.stringify({ kind: $('addKind').value, app: $('addApp').value }));
  $('addKind').addEventListener('change', keepPrefs);
  $('addApp').addEventListener('change', keepPrefs);

  const byNewest = (a, b) => (+b.at || 0) - (+a.at || 0) || (a.id < b.id ? 1 : -1);
  const byDone = (a, b) => String(b.doneOn || '').localeCompare(String(a.doneOn || '')) || byNewest(a, b);
  function render() {
    const open = items.filter(x => x.status !== 'done').sort(byNewest), done = items.filter(x => x.status === 'done').sort(byDone);
    const chips = $('showChips');
    chips.innerHTML = [['open', 'Open', open.length], ['done', 'Done', done.length]].map(([k, t, n]) =>
      '<button class="chip" type="button" data-show="' + k + '" aria-pressed="' + (st.show === k) + '">' + t + ' <span class="n">' + n + '</span></button>').join('');
    slideShow();
    const list = st.show === 'done' ? done : open;
    $('items').innerHTML = list.length ? '<div class="rgroup" role="list">' + list.map(rowHtml).join('') + '</div>'
      : st.show === 'done' ? '<div class="empty"><strong>Nothing done yet</strong>What you mark done shows here.</div>'
        : '<div class="empty"><strong>Nothing open</strong>Type a bug, an improvement or an idea above, then tap Add.</div>';
  }
  function rowHtml(it) {
    const who = whoOf(it), when = it.status === 'done' && it.doneOn ? 'Done ' + short(it.doneOn) : short(it.added);
    const label = kindName(it.kind) + ', ' + appName(it.app) + (when ? ', ' + when : '') + (who ? ', from ' + who : '') + ': ' + it.text;
    return '<button class="irow' + (it.status === 'done' ? ' done' : '') + '" type="button" role="listitem" data-id="' + esc(it.id) + '" aria-label="' + esc(label) + '">'
      + '<span class="itext">' + esc(it.text) + '</span>'
      + '<span class="imeta"><span class="pill" data-k="' + esc(it.kind) + '">' + esc(kindName(it.kind)) + '</span><span class="pill ap">' + esc(appName(it.app)) + '</span>'
      + (when || who ? '<span class="when">' + esc([when, who].filter(Boolean).join(' · ')) + '</span>' : '') + '</span></button>';
  }
  const slideShow = jump => { const box = $('showChips'); if (window.AllisonOS && AllisonOS.slide) AllisonOS.slide(box, box.querySelector('[aria-pressed="true"]'), 'improve-show', { jump }); };
  addEventListener('resize', () => slideShow(true));
  addEventListener('aos:design', () => setTimeout(() => slideShow(true), 50));   // a new look's font: the thumb fits the new capsule
  $('showChips').addEventListener('click', e => {
    const b = e.target.closest('[data-show]'); if (!b || b.dataset.show === st.show) return;
    st.show = b.dataset.show; ls.set(K.show, st.show); render(); animateIn($('items'));
  });

  // Add: one tap after typing. The kind and app stay as they were for the next one.
  function add() {
    const box = $('addText'), text = box.value.trim();
    if (!text) { box.focus(); return; }
    const u = me(), it = { id: newId(), text: text.slice(0, 4000), kind: $('addKind').value, app: $('addApp').value, status: 'open', added: today(), at: Date.now(), doneOn: '' };
    if (u) it.by = u.id;
    items.push(tidy(it)); keepPrefs(); save();
    box.value = '';
    if (st.show !== 'open') { st.show = 'open'; ls.set(K.show, 'open'); }
    render(); animateIn($('items'));
    toast('Added.', () => { items = items.filter(x => x.id !== it.id); save(); render(); if (!box.value) box.value = text; });
  }
  $('addBtn').addEventListener('click', add);
  // ⌘ or Ctrl + Return adds, from a keyboard
  $('addText').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); } });

  // ---------------------------------------------------------------------
  // An item's sheet: what it says, its kind and app, Done, Delete (built with ../home/settings.js's rows)
  // ---------------------------------------------------------------------
  const itemBody = $('itemBody');
  const find = id => items.find(x => x.id === id);
  $('items').addEventListener('click', e => { const r = e.target.closest('.irow'); if (r) openItem(r.dataset.id); });
  function openItem(id) {
    if (!find(id)) return;
    st.editing = id; renderItem(); openSheet('itemSheet');
  }
  function renderItem() {
    const it = find(st.editing); if (!it) return;
    const S = AllisonOS.settings, edit = canEdit(it), who = whoOf(it), done = it.status === 'done';
    const added = 'Added ' + (short(it.added) || 'here') + (who ? ' by ' + who : '') + '.';
    $('itemLbl').textContent = edit ? 'Edit' : kindName(it.kind);
    itemBody.innerHTML = S.section('', S.raw('<textarea class="edtext" id="edText" rows="4" aria-label="What it says"' + (edit ? '' : ' readonly') + '>' + esc(it.text) + '</textarea>'))
      + (edit ? S.section('About', [
        S.choice({ id: 'edKind', title: 'Kind', options: KINDS, value: it.kind }),
        S.select({ id: 'edApp', title: 'App', options: appList().some(a => a[0] === it.app) ? appList() : appList().concat([[it.app, appName(it.app)]]), value: it.app }),
      ]) + S.section('', [
        S.toggle({ id: 'edDone', title: 'Done', sub: done ? 'Done ' + (short(it.doneOn) || 'here') + '.' : 'Moves it to Done.', on: done }),
        S.info({ id: 'edAdded', title: added }),
      ]) + S.section('', S.danger({ id: 'edDel', title: 'Delete' }))
        : S.section('About', [
          S.info({ title: 'Kind', value: kindName(it.kind) }),
          S.info({ title: 'App', value: appName(it.app) }),
          S.info({ title: done ? 'Done' : 'Open', sub: done && it.doneOn ? 'Done ' + short(it.doneOn) + '.' : '' }),
          S.info({ title: added, sub: 'Only ' + who + ' or the family’s owner can change it.' }),
        ]));
  }
  // What it says: kept as you type (a pause), and when the sheet closes
  let textTimer = null;
  function keepText() {
    clearTimeout(textTimer);
    const it = find(st.editing), box = $('edText'); if (!it || !box || box.readOnly) return;
    const t = box.value.trim();
    if (t && t !== it.text) { it.text = t.slice(0, 4000); save(); render(); }
  }
  itemBody.addEventListener('input', e => { if (e.target.id === 'edText') { clearTimeout(textTimer); textTimer = setTimeout(keepText, 700); } });
  itemBody.addEventListener('change', e => {
    const it = find(st.editing); if (!it || !canEdit(it)) return;
    if (e.target.id === 'edApp') { it.app = e.target.value; save(); render(); }
  });
  itemBody.addEventListener('click', e => {
    const it = find(st.editing); if (!it || !canEdit(it)) return;
    const S = AllisonOS.settings, k = S.pick(e);
    if (k && e.target.closest('#edKind')) { it.kind = k; save(); render(); return; }
    const sw = e.target.closest('#edDone');
    if (sw) {
      keepText();
      const on = S.flip(sw);
      it.status = on ? 'done' : 'open'; it.doneOn = on ? today() : '';
      save(); render(); renderItem();
      toast(on ? 'Marked done.' : 'Open again.', () => { it.status = on ? 'open' : 'done'; it.doneOn = on ? '' : today(); save(); render(); if (st.editing === it.id) renderItem(); });
      return;
    }
    const del = e.target.closest('#edDel');
    if (del) {
      if (!S.armed(del, 'Tap again to delete it')) return;
      const was = items.indexOf(it), copy = Object.assign({}, it);
      items = items.filter(x => x !== it); save();
      closeItem(true); render();
      toast('Deleted.', () => { items.splice(Math.min(was, items.length), 0, copy); save(); render(); });
    }
  });
  function closeItem(gone) {
    if (!gone) keepText();
    st.editing = null; closeSheet('itemSheet');
  }

  // ---------------------------------------------------------------------
  // Settings, as in every app (../home/settings.js): Design · Your data · Family account
  // ---------------------------------------------------------------------
  const more = $('moreBody');
  const oneLine = m => String(m || '').replace(/\.\s+(\S)/g, (_, c) => '; ' + c.toLowerCase());   // a note in one sentence
  const ago = t => { if (!t) return 'just now'; const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  function renderMore() {
    const S = AllisonOS.settings, u = me();
    const ACCT = {
      ok: ['In the family’s Google Sheet', 'Last synced ' + ago(lastSyncAt) + '.'],
      syncing: ['Syncing…', ''],
      signin: ['On this phone only', 'Sign in to share your list with the family.'],
      offline: ['Offline', ''],
      error: ['Couldn’t sync just now', oneLine(SYNC_ERRORS[syncErr] || 'Your list is safe on this phone. Trying again shortly.')],
      idle: [signedIn() ? 'Checking…' : 'On this phone only', ''],
    }[syncState === 'syncing' && settled !== 'idle' ? settled : syncState] || ['', ''];
    more.innerHTML = (window.aosDesign ? S.section('Design', S.raw(aosDesign.picker(), { id: 'moreDesign' })) : '')
      + S.section('Your data', [
        S.action({ id: 'exportBtn', icon: 'upload', title: 'Export as a spreadsheet', sub: 'A CSV file of every item.' }),
      ])
      + S.section('Family account', [
        signedIn() && u ? S.info({ id: 'acctWho', title: 'Signed in as ' + (u.name || 'you') }) : '',
        S.info({ id: 'acctState', title: ACCT[0], sub: ACCT[1] }),
        !signedIn() ? S.action({ id: 'signIn', icon: 'face', title: 'Sign in with Face ID', sub: 'Shares your list in the family’s Google Sheet.' }) : '',
      ], { id: 'acct', open: !signedIn() });
  }
  $('moreBtn').onclick = () => { renderMore(); openSheet('moreSheet'); if (syncState !== 'syncing') sync(false); };
  if (window.aosDesign) aosDesign.bind(more);   // Design: the four looks, at once (../home/design.js)
  more.addEventListener('click', async e => {
    if (e.target.closest('#signIn')) {
      try { await A().signIn(); toast('Signed in. Syncing your list.'); sync(true); }
      catch (err) { toast(err && err.name === 'NotAllowedError' ? 'No passkey found, or canceled. Set up your account in aOS first.' : 'Couldn’t sign in.'); }
      return;
    }
    if (e.target.closest('#exportBtn')) exportCSV();
  });
  function exportCSV() {
    const q = v => /[",\n\r]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
    const rows = [['Who', 'Added', 'Kind', 'App', 'Status', 'Text', 'Done on']];
    const open = items.filter(x => x.status !== 'done').sort(byNewest), done = items.filter(x => x.status === 'done').sort(byDone);
    for (const x of open.concat(done)) rows.push([x.by ? (people()[x.by] || '') : '', x.added || '', kindName(x.kind), appName(x.app), x.status === 'done' ? 'Done' : 'Open', x.text, x.doneOn || '']);
    const file = new File([rows.map(r => r.map(q).join(',')).join('\r\n')], 'improve-' + today() + '.csv', { type: 'text/csv' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file] }).catch(() => {}); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // ---------------------------------------------------------------------
  // The family's Google Sheet: everyone's items, each marked with whose it is (aOS/SHEETS.md, family
  // mode). This phone keeps a working copy of every item (nothing is dated). Syncs go through aOS
  // (../home/sheet.js, functions/sheet/api), signed in, so the phone holds no Sheet link or phrase.
  // ---------------------------------------------------------------------
  const APP = 'allison-improve-sync';
  const SH = () => window.AllisonOS && AllisonOS.sheet;
  let syncing = false, syncAgain = false, syncTimer = null, syncState = 'idle', syncErr = '', errShown = false;
  let lastSyncAt = +ls.get(K.syncAt, 0) || 0;
  let settled = 'idle';   // the last state that wasn't "syncing", so Settings doesn't flicker on every save
  const SYNC_ERRORS = {
    signin: 'Sign in to share your list with the family.',
    'no-sheet': 'The family’s Improve Sheet isn’t set up yet. The owner sets it up in aOS: Account → Google Sheets.',
    'wrong-secret': 'aOS’s phrase for the Improve Sheet doesn’t match its script any more. The owner updates it in aOS: Account → Google Sheets.',
    'old-script': 'The Improve Sheet’s script is out of date. The owner pastes in the new one and deploys a new version (improve/README.md).',
    'secret-not-set': 'The Improve Sheet’s script still says SECRET = ‘CHANGE-ME’. The owner changes it and deploys a new version.',
    busy: 'The Sheet was busy. Trying again shortly.',
    offline: 'Offline. Changes will sync when you’re back online.',
    'sheet-unreachable': 'Couldn’t reach the Sheet. Trying again later.',
    'not-json': 'The Sheet didn’t answer as expected. Trying again later.',
  };
  function setState(s, err) {
    syncState = s; if (s !== 'syncing') { settled = s; syncErr = err || ''; }
    if (!$('moreSheet').hidden && !more.contains(document.activeElement)) renderMore();
  }
  function applyRemote(res, sent) {
    Object.keys(res.graves || {}).forEach(k => { const t = +res.graves[k] || 0; if ((graves[k] || 0) < t) graves[k] = t; });
    if (res.by) ls.set(K.who, String(res.by));
    if (res.people && typeof res.people === 'object' && !Array.isArray(res.people)) ls.set(K.people, JSON.stringify(res.people));
    let localNewer = false;
    const newer = l => (+l.updated || 0) > (sent.get(l.id) || 0);   // changed here since this sync was sent
    const remote = (Array.isArray(res.items) ? res.items : []).filter(okItem).map(tidy), map = new Map(items.map(x => [x.id, x]));
    remote.forEach(r => {
      const l = map.get(r.id);
      // someone else's that this phone may not change: the Sheet's is the one (a change made here anyway never got in)
      if (!l || (+r.updated || 0) > (+l.updated || 0) || (r.by && !canEdit(r))) map.set(r.id, r);
      else if ((+l.updated || 0) > (+r.updated || 0)) { if (newer(l)) localNewer = true; }
      else if (r.by && l.by !== r.by) l.by = r.by;   // the same version: whose it is, as the Sheet says
    });
    const ids = new Set(remote.map(r => r.id));
    items.forEach(l => {
      if (ids.has(l.id) || graves['items:' + l.id]) return;
      if (l.by && l.by !== res.by) map.delete(l.id);   // someone else's the Sheet no longer has
      else if (!sent.has(l.id) || newer(l)) localNewer = true;
    });
    items = [...map.values()].filter(x => { const g = graves['items:' + x.id]; return !(g && g >= (+x.updated || 0)); });
    initShadow(); persist();
    if (localNewer) syncAgain = true;
    render();
    if (st.editing) { if (!find(st.editing)) closeItem(true); else if (!itemBody.contains(document.activeElement)) renderItem(); }
  }
  // loud: you signed in in Settings (Face ID if you're signed out); otherwise quietly, when signed in.
  async function sync(loud) {
    if (!SH() || (!loud && !signedIn())) { setState(signedIn() ? 'idle' : 'signin'); return false; }
    if (syncing) { syncAgain = true; return false; }
    if (!navigator.onLine) { setState('offline'); return false; }
    syncing = true; setState('syncing');
    let ok = false;
    try {
      track(); persist();
      const sent = new Map(items.map(x => [x.id, +x.updated || 0]));
      const res = await SH().sync('improve', { action: 'sync', v: 1, window: SH().WINDOW || 90, today: today(), items, graves }, { ask: loud });
      if (res.app && res.app !== APP) throw new Error('not-json');
      if (!res.aos) throw new Error('old-script');
      lastSyncAt = Date.now(); ls.set(K.syncAt, String(lastSyncAt));
      ok = true;
      applyRemote(res, sent);
      setState('ok');
    } catch (e) {
      const m = e.message;
      setState(m === 'signin' ? 'signin' : m === 'offline' ? 'offline' : 'error', m);
      // A quiet sync toasts a real error once a session; not signed out (Settings signs in), offline, or a Sheet
      // the owner hasn't set up in aOS yet (Account → Google Sheets): nothing for the family to do here.
      if (loud || (!errShown && syncState === 'error' && m !== 'no-sheet')) { errShown = true; toast(SYNC_ERRORS[m] || 'Sync didn’t work. Trying again later.', null, 6000); }
    } finally {
      syncing = false;
      if (syncAgain) { syncAgain = false; scheduleSync(800); }
    }
    return ok;
  }
  // A couple of seconds after the last change, so a burst of items is one sync, not a dozen.
  function scheduleSync(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(() => sync(false), ms == null ? 2500 : ms); }
  addEventListener('aos:account', e => { if (e.detail) sync(false); else setState('signin'); render(); });

  // ---------------------------------------------------------------------
  // Sheets and the toast (as in Drinks)
  // ---------------------------------------------------------------------
  const focusStack = [];
  const lockPage = () => document.documentElement.classList.toggle('locked', [...document.querySelectorAll('.sheetwrap')].some(w => !w.hidden));
  function openSheet(id) { focusStack.push(document.activeElement); $(id).hidden = false; lockPage(); }
  function closeSheet(id) { $(id).hidden = true; lockPage(); const f = focusStack.pop(); if (f && f.focus && document.contains(f)) f.focus({ preventScroll: true }); }
  const closers = { itemSheet: () => closeItem() };
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
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.sheetwrap')].reverse().find(w => !w.hidden);
    if (open) closeWrap(open);
  });
  let toastTimer;
  function toast(msg, undo, ms) {
    $('toastMsg').textContent = msg;
    $('toastAct').hidden = !undo;
    $('toastAct').onclick = () => { if (undo) undo(); $('toast').hidden = true; };
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, ms || 4000);
  }
  function animateIn(el) { el.classList.add('enter'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('enter'), 900); }

  // ---------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------
  load();
  drawPickers();
  render();
  animateIn($('main'));
  // aOS's own list of apps (../home/welcome.js) comes in after this script: the App pickers take it then
  document.addEventListener('DOMContentLoaded', () => { const a = $('addApp').value, k = $('addKind').value; drawPickers(); $('addApp').value = a; $('addKind').value = k; render(); slideShow(true); });
  window.addEventListener('storage', e => { if (e.key === KEY) { load(); render(); if (st.editing && !itemBody.contains(document.activeElement)) renderItem(); } });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastSyncAt > 30000) sync(false);
  });
  window.addEventListener('online', () => sync(false));
  setTimeout(() => sync(false), 600);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // For the tests (improve/scripts/app-test.mjs) only.
  window.__improve = { st, items: () => items, graves: () => graves, render, sync, state: () => syncState, openItem };
})();
