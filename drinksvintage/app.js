"use strict";

// Drinks Vintage: Drinks in a mid-century modern look, as its own app (its look is the last
// block of index.html; this is Drinks' script with its own storage, allison-drinksv-v1, and its
// calls to your account going to Drinks' route, ../drinks/api/, so it is the same private log;
// nothing else changed). Drinks: a log of what you drink, kept small.
//
// - One screen: the week as seven rows, one a day, each its standard drinks or
//   alcohol-free; above them the week's one number against your weekly limit.
//   Arrows (or a swipe) move a week at a time.
// - Tapping a day opens its sheet: what you had, your usual drinks as tiles
//   (one tap logs one, with Undo), "Something else…" for anything new, and,
//   on a day with nothing logged, Alcohol-free day.
// - Tapping the week's number ("Analysis ›") opens the Analysis page: a glass
//   pill at the bottom picks its view, the first being the last 7 days against
//   the 7 before, or the last 4 weeks against the 4 before; the rest chart the
//   last twelve weeks. The sums are calc.js's.
// - The log lives on this phone (allison-drinksv-v1) and, signed in to your
//   family account, in that account too, private to you
//   (functions/drinks/api): it follows you to another phone, and Calendar can
//   show it. Until accounts are on, it stays on the phone.
//   The views: compared with before, weekly drinks, weeks over the limit, top
//   drinks, days of the week, alcohol-free days, days over the limit, strength
//   and size.
// - More (the person button): your account, your goals, bringing in the ABV
//   Tracker's history, export, and delete.

// Refuse to run inside another page's frame (see Mail's app.js for why).
if (window.top !== window.self) {
  document.body.textContent = 'Drinks can’t be opened inside another page.';
  throw new Error('Drinks refuses to run inside a frame');
}

(function () {
  const C = window.DrinksCalc;
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
  const KEY = 'allison-drinksv-v1';
  const K = { graves: KEY + '-graves', sync: KEY + '-sync', sheet: KEY + '-sheet', sheetAt: KEY + '-sheet-at', period: KEY + '-period', trview: KEY + '-trview', trgroup: KEY + '-trgroup' };
  // One decimal, as people say it: 3.2, 1, 0.5.
  const f1 = n => (Math.round(n * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const sizeOf = x => (+x.vol).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' ' + x.unit;
  const catName = c => (C.CAT[c] || C.CAT.other).name;

  const ICON = {
    chevL: '<svg viewBox="0 0 24 24" class="b"><path d="M14.6 5.4L8.4 11.3a1 1 0 0 0 0 1.4l6.2 5.9"/></svg>',
    chevR: '<svg viewBox="0 0 24 24" class="b"><path d="M9.4 5.4l6.2 5.9a1 1 0 0 1 0 1.4l-6.2 5.9"/></svg>',
    close: '<svg viewBox="0 0 24 24" class="b"><path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"/></svg>',
    tick: '<svg viewBox="0 0 24 24" class="b"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" class="b"><path d="M12 6v12M6 12h12"/></svg>',
    import: '<svg viewBox="0 0 24 24"><path d="M12 3.6v11M7.6 10.6l4.4 4.4 4.4-4.4"/><path d="M4.4 15.6v2.6a2.2 2.2 0 0 0 2.2 2.2h10.8a2.2 2.2 0 0 0 2.2-2.2v-2.6"/></svg>',
    sheet: '<svg viewBox="0 0 24 24"><rect x="3.4" y="3.8" width="17.2" height="16.4" rx="3"/><path d="M3.4 9.4h17.2M3.4 14.8h17.2M9.4 9.4v10.8"/></svg>',
    export: '<svg viewBox="0 0 24 24"><path d="M12 15V4M7.6 8.4L12 4l4.4 4.4"/><path d="M4.4 13.6v4.6a2.2 2.2 0 0 0 2.2 2.2h10.8a2.2 2.2 0 0 0 2.2-2.2v-4.6"/></svg>',
    bin: '<svg viewBox="0 0 24 24"><path d="M4.6 6.8h14.8M9.6 6.8V4.6h4.8v2.2M6.6 6.8l.9 12a1.6 1.6 0 0 0 1.6 1.5h5.8a1.6 1.6 0 0 0 1.6-1.5l.9-12"/></svg>',
  };

  // ---------------------------------------------------------------------
  // Data: { v: 1, entries: [{id, date, time, name, cat, vol, unit, abv, qty,
  // note, updated}], days: [{id: date, status: 'af', updated}] (alcohol-free),
  // prefs: [{id: 'goals', week, day, af, updated}] }. 'updated' is stamped on
  // any change, and anything deleted leaves a grave (kind:id -> when), so a
  // sync can tell newer from older and gone from not yet seen (as Fitness).
  // ---------------------------------------------------------------------
  const data = { entries: [], days: [], prefs: [] };
  let graves = {};
  const KINDS = ['entries', 'days', 'prefs'];
  const okDay = x => x && /^\d{4}-\d{2}-\d{2}$/.test(x.id || '') && x.status === 'af';
  const okPref = x => x && x.id === 'goals';
  function load() {
    const d = ls.json(KEY, null) || {};
    data.entries = Array.isArray(d.entries) ? d.entries.filter(C.okEntry) : [];
    data.days = Array.isArray(d.days) ? d.days.filter(okDay) : [];
    data.prefs = Array.isArray(d.prefs) ? d.prefs.filter(okPref) : [];
    const g = ls.json(K.graves, {}); graves = g && typeof g === 'object' && !Array.isArray(g) ? g : {};
    initShadow();
  }
  // What each item looked like at the last save.
  const shadow = new Map();
  function initShadow() {
    shadow.clear();
    KINDS.forEach(kind => data[kind].forEach(it => {
      if (!it.updated) it.updated = 1;
      const { updated, ...rest } = it; shadow.set(kind + ':' + it.id, JSON.stringify(rest));
    }));
  }
  function track() {
    const now = Date.now(), have = new Set();
    KINDS.forEach(kind => data[kind].forEach(it => {
      const k = kind + ':' + it.id, { updated, ...rest } = it, j = JSON.stringify(rest);
      have.add(k);
      if (shadow.get(k) !== j) { it.updated = now; shadow.set(k, j); delete graves[k]; }
    }));
    shadow.forEach((j, k) => { if (!have.has(k)) { graves[k] = now; shadow.delete(k); } });
  }
  let storeWarned = false;
  function persist() {
    const ok = ls.set(KEY, JSON.stringify({ v: 1, entries: data.entries, days: data.days, prefs: data.prefs })) && ls.set(K.graves, JSON.stringify(graves));
    if (!ok && !storeWarned) { storeWarned = true; toast('This phone couldn’t save Drinks: its storage is full.'); }
  }
  function save() { track(); persist(); scheduleSync(); scheduleSheet(); }
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const goals = () => Object.assign({}, C.GOALS, data.prefs.find(p => p.id === 'goals') || {});
  const entriesOn = day => data.entries.filter(x => x.date === day).sort((a, b) => (a.time || '99').localeCompare(b.time || '99') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));   // ids start with when they were made
  const markOf = day => { const m = data.days.find(x => x.id === day); return m ? m.status : null; };
  function setMark(day, status) {
    data.days = data.days.filter(x => x.id !== day);
    if (status) data.days.push({ id: day, status });
  }

  // ---------------------------------------------------------------------
  // Dates: 'YYYY-MM-DD' strings in the phone's zone.
  // ---------------------------------------------------------------------
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const noon = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), 12);
  const today = () => ymd(new Date());
  const nowTime = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const addDays = (s, n) => { const d = noon(s); d.setDate(d.getDate() + n); return ymd(d); };
  // Monday, unless Calendar has been set to start its weeks on Sunday (as Fitness).
  const weekStartsSunday = () => { const c = ls.json('allison-calendar-v1-settings', {}); return !(c.weekStart === 1 && c.weekStartPicked); };   // Sunday, unless Monday was picked in Calendar
  const weekStartOf = s => { const wd = noon(s).getDay(); return addDays(s, -(weekStartsSunday() ? wd : (wd + 6) % 7)); };
  const fmt = (s, o) => noon(s).toLocaleDateString('en-US', o);
  const sameYear = s => s.slice(0, 4) === today().slice(0, 4);
  const short = s => fmt(s, { day: 'numeric', month: 'short' });

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const st = { week: weekStartOf(today()), day: null, form: null, period: ls.get(K.period, 'week') === 'month' ? 'month' : 'week' };

  // ---------------------------------------------------------------------
  // The week: its one number (tap it for Analysis), and seven days
  // ---------------------------------------------------------------------
  const main = $('main');
  function render() {
    renderWeek();
    if (!$('trends').hidden) renderTrends();
  }
  // What a day was, in words: "Wine ×2, Beer".
  function said(list) {
    const m = new Map();
    for (const x of list) { const k = x.name || catName(x.cat); m.set(k, (m.get(k) || 0) + (+x.qty || 1)); }
    return [...m].map(([k, q]) => k + (q > 1 ? ' ×' + q : '')).join(', ');
  }
  function renderWeek() {
    const ws = st.week, we = addDays(ws, 6), tod = today(), g = goals();
    const thisWeek = ws === weekStartOf(tod);
    const rel = thisWeek ? 'This week' : ws === weekStartOf(addDays(tod, -7)) ? 'Last week' : '';
    const label = (rel ? rel + ' · ' : '') + short(ws) + ' – ' + fmt(we, { day: 'numeric', month: 'short', year: sameYear(we) ? undefined : 'numeric' });
    const map = C.byDay(data.entries), mk = C.marks(data.days);
    let rows = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i), s = C.statusOf(d, map, mk), x = map.get(d);
      let text = '', cls = 'quiet', val = '';
      if (s === 'drinks') { text = said(entriesOn(d)); cls = ''; val = '<span class="dval' + (C.round(x.sd, 2) > g.day ? ' over' : '') + '">' + f1(x.sd) + '</span>'; }
      else if (s === 'af') { text = 'Alcohol-free'; cls = 'af'; }
      else text = d < tod ? 'Not logged' : d === tod ? 'Nothing yet' : '';
      const aria = fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }) + ', ' + (s === 'drinks' ? f1(x.sd) + ' standard drinks' : text || 'not yet');
      rows += '<button class="drow' + (d === tod ? ' today' : '') + '" type="button" data-day="' + d + '" aria-label="' + esc(aria) + '">'
        + '<span class="dn"><small>' + esc(fmt(d, { weekday: 'short' })) + '</small><b>' + +d.slice(8) + '</b></span>'
        + '<span class="dsum ' + cls + '">' + esc(text) + '</span>' + val + '</button>';
    }
    // The week's one number, against your weekly limit. Tapping it opens Analysis.
    const s = C.stats(data.entries, data.days, ws, we, tod);
    const over = g.week > 0 && C.round(s.sd, 1) > g.week;
    const pct = g.week > 0 ? Math.min(100, s.sd / g.week * 100) : 0;
    const bits = [g.af ? s.afDays + ' of ' + g.af + ' alcohol-free days' : plural(s.afDays, 'alcohol-free day')];
    if (thisWeek) { const k = C.streaks(data.entries, data.days, tod).current; if (k > 1) bits.push(k + ' in a row'); }
    $('todayBtn').hidden = thisWeek;
    main.innerHTML = '<div class="navrow" style="--i:0"><button class="iconbtn" type="button" data-act="prev" aria-label="Previous week">' + ICON.chevL + '</button><span class="lbl">' + esc(label) + '</span><button class="iconbtn" type="button" data-act="next" aria-label="Next week">' + ICON.chevR + '</button></div>'
      + '<button class="sum' + (over ? ' over' : '') + '" type="button" id="sumBtn" style="--i:1" aria-label="' + esc(f1(s.sd) + ' standard drinks' + (g.week ? ' of your ' + g.week + ' a week' : '') + '. ' + bits.join(', ') + '. Open analysis') + '">'
      + '<span class="big"><b>' + f1(s.sd) + '</b><span>' + (g.week ? 'of ' + g.week + ' standard drinks' : 'standard drinks') + (over ? ', over your limit' : '') + '</span><span class="more">Analysis' + ICON.chevR + '</span></span>'
      + (g.week ? '<span class="track" aria-hidden="true"><i style="width:' + pct.toFixed(1) + '%"></i></span>' : '')
      + '<span class="line">' + esc(bits.join(' · ')) + '</span></button>'
      + '<div class="rgroup week" style="--i:2">' + rows + '</div>';
  }
  function goWeek(n) { st.week = addDays(st.week, 7 * n); render(); animateIn(main); }
  main.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (a) { goWeek(a.dataset.act === 'prev' ? -1 : 1); return; }
    if (e.target.closest('#sumBtn')) { openTrends(); return; }
    const d = e.target.closest('[data-day]');
    if (d) openDay(d.dataset.day);
  });
  // A sideways swipe on the week moves a week, as in Fitness.
  let sx = null, sy = 0;
  main.addEventListener('touchstart', e => { if (e.touches.length === 1 && e.target.closest('.week')) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } else sx = null; }, { passive: true });
  main.addEventListener('touchend', e => {
    if (sx === null) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goWeek(dx < 0 ? 1 : -1);
  });
  $('todayBtn').onclick = () => { st.week = weekStartOf(today()); render(); animateIn(main); };
  $('fab').onclick = () => { st.week = weekStartOf(today()); render(); openDay(today()); };

  // ---------------------------------------------------------------------
  // Analysis (below, with Trends): the week's number opens one page with a pill
  // at the bottom for every view. Its first view puts this week or month
  // against the one before; the sums are calc.js's.
  // ---------------------------------------------------------------------
  const PERIODS = { week: { days: 7, name: 'Week', before: 'the 7 days before' }, month: { days: 28, name: 'Month', before: 'the 4 weeks before' } };

  // ---------------------------------------------------------------------
  // A day: what you had, your usual drinks, the form
  // ---------------------------------------------------------------------
  function openDay(day) {
    st.day = day; st.form = null;
    $('dayLbl').textContent = day === today() ? 'Today · ' + fmt(day, { weekday: 'long' }) : fmt(day, { weekday: 'long', day: 'numeric', month: 'long', year: sameYear(day) ? undefined : 'numeric' });
    renderDay();
    if ($('daySheet').hidden) openSheet('daySheet');
  }
  // Your usual drinks: the ones you've had most in the last four months, then
  // the ABV Tracker's presets, six in all.
  function usual() {
    const from = addDays(today(), -120), m = new Map();
    const same = (a, b) => a.cat === b.cat && +a.vol === +b.vol && a.unit === b.unit && +a.abv === +b.abv;
    for (const x of data.entries) {
      if (x.date < from) continue;
      const k = [(x.name || '').toLowerCase(), x.cat, x.vol, x.unit, x.abv].join('|'), u = m.get(k) || { x, n: 0 };
      u.n += +x.qty || 1; if (x.date >= u.x.date) u.x = x; m.set(k, u);
    }
    const list = [...m.values()].sort((a, b) => b.n - a.n || b.x.date.localeCompare(a.x.date)).slice(0, 6)
      .map(u => ({ name: u.x.name || catName(u.x.cat), cat: u.x.cat, vol: +u.x.vol, unit: u.x.unit, abv: +u.x.abv }));
    for (const p of C.PRESETS) { if (list.length >= 6) break; if (!list.some(y => same(y, p))) list.push(p); }
    return list;
  }
  const opts = (list, val, label) => list.map(v => '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(label ? label(v) : v) + '</option>').join('');
  const withVal = (list, v) => list.includes(+v) ? list : list.concat(+v).sort((a, b) => a - b);
  function renderDay() {
    const day = st.day, f = st.form, list = entriesOn(day), mark = markOf(day), g = goals();
    if (day > today()) { $('dayBody').innerHTML = '<div class="rgroup"><div class="dempty">That day hasn’t come yet.</div></div>'; return; }
    let html = '';
    if (list.length) {
      const total = list.reduce((a, x) => a + C.std(x), 0), over = C.round(total, 2) > g.day;
      html += '<div class="rgroup" id="dList">' + list.map(x => '<div class="erow' + (f && f.editing === x.id ? ' editing' : '') + '" data-c="' + esc(C.CAT[x.cat] ? x.cat : 'other') + '">'
        + '<button class="ebody" type="button" data-edit="' + esc(x.id) + '" aria-label="Change ' + esc(x.name || catName(x.cat)) + '"><i class="cdot"></i><span class="et">' + esc(x.name || catName(x.cat)) + (+x.qty > 1 ? ' ×' + x.qty : '')
        + '<small>' + esc([sizeOf(x), x.abv + '%', x.time, x.note].filter(Boolean).join(' · ')) + '</small></span><span class="ev">' + f1(C.std(x)) + '</span></button>'
        + '<button class="del" type="button" data-del="' + esc(x.id) + '" aria-label="Delete ' + esc(x.name || catName(x.cat)) + '">' + ICON.close + '</button></div>').join('')
        + '<div class="dtotal' + (over ? ' over' : '') + '"><span>' + (over ? 'Over your ' + g.day + ' a day' : 'Total') + '</span><span><b>' + f1(total) + '</b> standard drinks</span></div></div>';
    } else {
      // Nothing logged: an alcohol-free day is one tap.
      html += '<button class="btn quiet afbtn" type="button" data-mark="af" aria-pressed="' + (mark === 'af') + '">' + (mark === 'af' ? ICON.tick + 'Alcohol-free day' : 'Alcohol-free day') + '</button>';
    }
    if (f) html += formHtml();
    else {
      html += '<p class="label">' + (list.length ? 'Add another' : 'Had a drink?') + '</p><div class="usual" id="usual">' + usual().map((u, i) => '<button class="utile" type="button" data-usual="' + i + '" data-c="' + esc(u.cat) + '" aria-label="Add ' + esc(u.name + ', ' + sizeOf(u) + ', ' + u.abv + '%') + '"><i class="cdot"></i><span class="ut">' + esc(u.name) + '<small>' + esc(sizeOf(u) + ' · ' + u.abv + '%') + '</small></span>' + ICON.plus + '</button>').join('') + '</div>'
        + '<button class="linkbtn" type="button" id="somethingElse">Something else…</button>';
    }
    $('dayBody').innerHTML = html;
  }
  function blankForm(cat) {
    const c = C.CAT[cat] || C.CAT.beer;
    return { editing: null, cat: c.id, name: '', vol: c.vol, unit: c.unit, abv: c.abv, qty: 1, time: st.day === today() ? nowTime() : '', note: '' };
  }
  function formHtml() {
    const f = st.form, sizes = withVal(C.SIZES[f.unit], f.vol), abvs = withVal(C.ABVS, f.abv);
    const sd = C.std({ vol: f.vol, unit: f.unit, abv: f.abv, qty: f.qty });
    return '<p class="label">' + (f.editing ? 'Change this drink' : 'Something else') + '</p>'
      + '<div class="opts" role="radiogroup" aria-label="Kind of drink">' + C.CATS.map(c => '<button class="opt" type="button" role="radio" data-c="' + c.id + '" data-cat="' + c.id + '" aria-checked="' + (f.cat === c.id) + '"><i class="cdot"></i>' + esc(c.name) + '</button>').join('') + '</div>'
      + '<div class="rgroup">'
      + '<div class="frow"><input class="txt" id="fName" type="text" maxlength="60" autocomplete="off" placeholder="' + esc(catName(f.cat)) + ' (or its name)" aria-label="Name" value="' + esc(f.name) + '"></div>'
      + '<div class="frow"><label for="fVol">Size</label><select id="fVol">' + opts(sizes, f.vol, v => (+v).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' ' + f.unit) + '</select>'
      + '<span class="unit" role="group" aria-label="Unit">' + ['oz', 'ml'].map(u => '<button type="button" data-unit="' + u + '" aria-pressed="' + (f.unit === u) + '">' + u + '</button>').join('') + '</span></div>'
      + '<div class="frow"><label for="fAbv">Strength</label><select id="fAbv">' + opts(abvs, f.abv, v => v + '%') + '</select></div>'
      + '<div class="frow"><label for="fQty">How many</label><select id="fQty">' + opts(withVal([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12], f.qty), f.qty) + '</select></div>'
      + '<div class="frow"><label for="fTime">Time <small>optional</small></label><input type="time" id="fTime" value="' + esc(f.time) + '"></div>'
      + '<div class="frow"><input class="txt" id="fNote" type="text" maxlength="200" autocomplete="off" placeholder="Note (optional)" aria-label="Note" value="' + esc(f.note) + '"></div>'
      + '</div>'
      + (f.cat === 'cocktail' ? '<p class="hint">For a cocktail, log the spirit in it: 2 oz of 40% is a typical one.</p>' : '')
      + '<p class="calc" id="fCalc">' + calcLine(sd) + '</p>'
      + '<div class="formbtns"><button class="btn quiet" type="button" id="fCancel">Cancel</button><button class="btn" type="button" id="fSave">' + (f.editing ? 'Save' : 'Add') + '</button></div>';
  }
  const calcLine = sd => '<b>' + f1(sd) + '</b> standard ' + (C.round(sd, 1) === 1 ? 'drink' : 'drinks');
  // The nearest size in the other unit, when you switch oz and ml.
  const nearest = (list, v) => list.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a, list[0]);
  function addDrink(d, qty) {
    const x = { id: newId(), date: st.day, time: st.day === today() ? nowTime() : '', name: String(d.name || '').trim().slice(0, 60), cat: C.CAT[d.cat] ? d.cat : 'other',
      vol: +d.vol, unit: d.unit === 'ml' ? 'ml' : 'oz', abv: +d.abv, qty: qty || 1, note: '' };
    data.entries.push(x);
    setMark(st.day, null);   // a drink makes it a drinks day
    save(); renderDay(); render();
    return x;
  }
  const body = $('dayBody');
  body.addEventListener('click', e => {
    const f = st.form;
    const mk = e.target.closest('[data-mark]');
    if (mk) { const s = mk.dataset.mark; setMark(st.day, markOf(st.day) === s ? null : s); save(); renderDay(); render(); return; }
    const u = e.target.closest('[data-usual]');
    if (u) {
      const d = usual()[+u.dataset.usual]; if (!d) return;
      const x = addDrink(d);
      toast('Added ' + (x.name || catName(x.cat)), () => { data.entries = data.entries.filter(y => y.id !== x.id); save(); if (st.day) renderDay(); render(); });
      return;
    }
    if (e.target.closest('#somethingElse')) { st.form = blankForm(); renderDay(); $('fName').focus({ preventScroll: true }); return; }
    const c = e.target.closest('[data-cat]');
    if (c && f) {
      // Picking a kind fills in its usual size and strength.
      const k = C.CAT[c.dataset.cat]; f.cat = k.id; f.unit = k.unit; f.vol = k.vol; f.abv = k.abv;
      renderDay(); return;
    }
    const un = e.target.closest('[data-unit]');
    if (un && f && un.dataset.unit !== f.unit) {
      const ml = f.unit === 'oz' ? f.vol * C.OZ_ML : f.vol;
      f.unit = un.dataset.unit; f.vol = nearest(C.SIZES[f.unit], f.unit === 'oz' ? ml / C.OZ_ML : ml);
      renderDay(); return;
    }
    const ed = e.target.closest('[data-edit]');
    if (ed) {
      const x = data.entries.find(y => y.id === ed.dataset.edit); if (!x) return;
      if (f && f.editing === x.id) { st.form = null; renderDay(); return; }
      st.form = { editing: x.id, cat: x.cat, name: x.name, vol: +x.vol, unit: x.unit, abv: +x.abv, qty: +x.qty, time: x.time || '', note: x.note || '' };
      renderDay(); return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const i = data.entries.findIndex(y => y.id === del.dataset.del); if (i < 0) return;
      const [x] = data.entries.splice(i, 1); save();
      if (f && f.editing === x.id) st.form = null;
      renderDay(); render();
      toast('Deleted ' + (x.name || catName(x.cat)), () => { data.entries.push(x); save(); if (st.day) renderDay(); render(); });
      return;
    }
    if (e.target.closest('#fCancel')) { st.form = null; renderDay(); return; }
    if (e.target.closest('#fSave')) saveForm();
  });
  body.addEventListener('change', e => {
    const f = st.form, t = e.target; if (!f) return;
    if (t.id === 'fVol') f.vol = +t.value;
    else if (t.id === 'fAbv') f.abv = +t.value;
    else if (t.id === 'fQty') f.qty = +t.value;
    else if (t.id === 'fTime') f.time = /^\d{2}:\d{2}$/.test(t.value) ? t.value : '';
    else return;
    const calc = $('fCalc'); if (calc) calc.innerHTML = calcLine(C.std(f));
  });
  body.addEventListener('input', e => {
    const f = st.form; if (!f) return;
    if (e.target.id === 'fName') f.name = e.target.value;
    if (e.target.id === 'fNote') f.note = e.target.value;
  });
  body.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.target.id === 'fName' || e.target.id === 'fNote')) { e.preventDefault(); saveForm(); } });
  function saveForm() {
    const f = st.form; if (!f) return;
    const fields = { name: f.name.replace(/\s+/g, ' ').trim().slice(0, 60), cat: f.cat, vol: +f.vol, unit: f.unit, abv: +f.abv, qty: +f.qty, time: f.time, note: f.note.trim().slice(0, 200) };
    if (f.editing) {
      const x = data.entries.find(y => y.id === f.editing);
      if (x) Object.assign(x, fields);
      st.form = null; save(); renderDay(); render();
      toast('Saved');
    } else {
      data.entries.push(Object.assign({ id: newId(), date: st.day }, fields));
      setMark(st.day, null);
      st.form = null; save(); renderDay(); render();
      toast('Added ' + (fields.name || catName(fields.cat)));
    }
  }

  // ---------------------------------------------------------------------
  // More: your account, your goals, your data
  // ---------------------------------------------------------------------
  const A = () => window.AllisonOS && window.AllisonOS.account;
  function renderMore() {
    const g = goals(), user = A() && A().user();
    const ACCT = {
      ok: ['Saved to your account', 'Private to you' + (user ? ', ' + user.name : '') + ', and on any phone you sign in on. Last saved ' + ago(lastSyncAt) + '.'],
      syncing: ['Saving…', 'To your family account.'],
      signin: ['On this phone only', 'Sign in with your family account to keep your log safe and on your other phones. Only you can see it.'],
      local: ['On this phone only', 'Family accounts aren’t switched on yet, so your log stays on this phone.'],
      offline: ['Offline', 'Changes will be saved to your account when you’re back online.'],
      error: ['Couldn’t save just now', 'Your log is safe on this phone. Trying again shortly.'],
      idle: ['Checking…', ''],
    }[syncState === 'syncing' && settled !== 'idle' ? settled : syncState] || ['', ''];
    $('moreBody').innerHTML = '<div class="rgroup acct" id="acct"><p><strong>' + esc(ACCT[0]) + '</strong>' + esc(ACCT[1]) + '</p>'
      + (settled === 'signin' && syncState !== 'ok' ? '<button class="btn" type="button" id="signIn">Sign in with Face ID</button>' : '') + '</div>'
      + '<p class="label">Your goals</p><div class="rgroup">'
      + '<div class="frow"><label for="gWeek">A week, at most</label><select id="gWeek">' + opts(withVal([0, 3, 5, 7, 10, 12, 14, 18, 21, 25, 30], g.week), g.week, v => +v ? v + ' drinks' : 'No limit') + '</select></div>'
      + '<div class="frow"><label for="gDay">A day, at most</label><select id="gDay">' + opts(withVal([1, 2, 3, 4, 5, 6, 8, 10], g.day), g.day, v => plural(+v, 'drink')) + '</select></div>'
      + '<div class="frow"><label for="gAf">Alcohol-free days a week</label><select id="gAf">' + opts([0, 1, 2, 3, 4, 5, 6, 7], g.af) + '</select></div></div>'
      + '<p class="hint">In standard drinks (14 g of alcohol each).</p>'
      + '<p class="label">Your data</p><div class="rgroup">'
      + '<button class="rowbtn" type="button" id="sheetBtn"><span class="ic">' + ICON.sheet + '</span><span>Google Sheet sync<span class="sub" id="sheetSub">' + esc(sheetLine()) + '</span></span></button>'
      + '<button class="rowbtn" type="button" id="importBtn"><span class="ic">' + ICON.import + '</span><span>Bring in ABV Tracker history<span class="sub">Its JSON backup, or its Google Sheet’s Log tab downloaded as CSV</span></span></button>'
      + '<button class="rowbtn" type="button" id="exportBtn"><span class="ic">' + ICON.export + '</span><span>Export<span class="sub">Everything you’ve logged, as a spreadsheet (CSV)</span></span></button>'
      + '<button class="rowbtn danger" type="button" id="wipeBtn"><span class="ic">' + ICON.bin + '</span><span id="wipeTxt">Delete all data<span class="sub">From this phone, your account' + (sheetCfg ? ' and your Google Sheet' : '') + '</span></span></button></div>';
  }
  const ago = t => { if (!t) return 'just now'; const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  $('moreBtn').onclick = () => { renderMore(); openSheet('moreSheet'); if (syncState !== 'syncing') sync(); };
  const more = $('moreBody');
  more.addEventListener('change', e => {
    const t = e.target, k = { gWeek: 'week', gDay: 'day', gAf: 'af' }[t.id]; if (!k) return;
    const g = Object.assign({ id: 'goals' }, goals(), { [k]: +t.value });
    delete g.updated;
    data.prefs = [g]; save(); render();
  });
  more.addEventListener('click', async e => {
    if (e.target.closest('#signIn')) {
      try { await A().signIn(); toast('Signed in. Saving your log to your account.'); sync(true); }
      catch (err) { toast(err && err.name === 'NotAllowedError' ? 'No passkey found, or canceled. Set up your account in aOS first.' : 'Couldn’t sign in.'); }
      return;
    }
    if (e.target.closest('#sheetBtn')) { openSheetSync(); return; }
    if (e.target.closest('#importBtn')) { $('importFile').value = ''; $('importFile').click(); return; }
    if (e.target.closest('#exportBtn')) { exportCSV(); return; }
    const w = e.target.closest('#wipeBtn');
    if (w) {
      if (!w.dataset.armed) { w.dataset.armed = '1'; $('wipeTxt').firstChild.textContent = 'Tap again to delete everything'; setTimeout(() => { if (document.contains(w)) { delete w.dataset.armed; $('wipeTxt').firstChild.textContent = 'Delete all data'; } }, 3500); return; }
      const n = data.entries.length;
      data.entries = []; data.days = []; data.prefs = [];
      save(); sync(true); render(); renderMore();
      toast('Deleted ' + plural(n, 'drink') + ' and your marked days.');
    }
  });
  // Bringing in the ABV Tracker: drinks it had that this log hasn't, marked
  // days with nothing logged, and its goals if you haven't set any here.
  $('importFile').addEventListener('change', async () => {
    const file = $('importFile').files[0]; if (!file) return;
    $('importFile').value = '';   // so the same file can be chosen again
    let r; try { r = C.fromAbvTracker(await file.text()); }
    catch (err) { toast(err.message === 'not-a-log' ? 'That CSV isn’t the ABV Tracker’s Log tab.' : 'That file isn’t an ABV Tracker backup or Log.', null, 6000); return; }
    const have = new Set(data.entries.map(x => x.id)), drinkDays = new Set(data.entries.map(x => x.date).concat(r.entries.map(x => x.date)));
    let added = 0, marked = 0;
    for (const x of r.entries) if (!have.has(x.id)) { data.entries.push(x); added++; }
    for (const d of r.days) if (!markOf(d.id) && !drinkDays.has(d.id)) { data.days.push({ id: d.id, status: d.status }); marked++; }
    for (const d of drinkDays) if (markOf(d)) setMark(d, null);
    if (r.goals && !data.prefs.length) data.prefs.push(Object.assign({ id: 'goals' }, r.goals));
    save(); render(); renderMore();
    toast(added || marked ? 'Brought in ' + plural(added, 'drink') + ' and ' + plural(marked, 'marked day') + '.' : 'Nothing new: it’s all here already.', null, 6000);
  });
  function exportCSV() {
    const q = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
    const rows = [['Date', 'Time', 'Drink', 'Kind', 'Size', 'Unit', 'ABV %', 'How many', 'Standard drinks', 'Note']];
    for (const x of [...data.entries].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')))
      rows.push([x.date, x.time || '', x.name || '', catName(x.cat), x.vol, x.unit, x.abv, x.qty, C.round(C.std(x), 2), x.note || '']);
    for (const d of [...data.days].sort((a, b) => a.id.localeCompare(b.id))) rows.push([d.id, '', 'Alcohol-free day', '', '', '', '', '', 0, '']);
    const file = new File([rows.map(r => r.map(q).join(',')).join('\r\n')], 'drinks-' + today() + '.csv', { type: 'text/csv' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file] }).catch(() => {}); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // ---------------------------------------------------------------------
  // Your account: the log, private to you (functions/drinks/api). A phone
  // sends only what changed since it last synced, and hears everything only
  // when another phone changed something (the free plan's limits: see there).
  // ---------------------------------------------------------------------
  let info = ls.json(K.sync, {}) || {};   // { at: the server's time of our last sync, pushed: our time then, user }
  let syncing = false, syncAgain = false, syncTimer = null, syncState = 'idle', lastSyncAt = +info.when || 0;
  const saveInfo = () => ls.set(K.sync, JSON.stringify(info));
  let settled = 'idle';   // the last state that wasn't "syncing", so More doesn't flicker on every save
  function setState(s) {
    syncState = s; if (s !== 'syncing') settled = s;
    $('moreBtn').classList.toggle('warn', s === 'error');
    if (!$('moreSheet').hidden && !more.contains(document.activeElement)) renderMore();
  }
  // Someone else signed in on this phone: their log isn't the last person's.
  function forOtherPerson(user) {
    if (!user || !info.user || info.user === user.id) return false;
    data.entries = []; data.days = []; data.prefs = []; graves = {};
    sheetForget();   // and the Google Sheet is theirs: it stays connected only for them
    initShadow(); persist(); info = {}; saveInfo(); render();
    return true;
  }
  function applyRemote(res, started) {
    Object.keys(res.graves || {}).forEach(k => { const t = +res.graves[k] || 0; if ((graves[k] || 0) < t) graves[k] = t; });
    let missing = false;
    for (const kind of KINDS) {
      const map = new Map(data[kind].map(x => [x.id, x])), remote = Array.isArray(res[kind]) ? res[kind] : [];
      remote.forEach(r => { const l = map.get(r.id); if (!l || (+r.updated || 0) > (+l.updated || 0)) map.set(r.id, r); });
      const ids = new Set(remote.map(r => r.id));
      // Something here the account hasn't got, from before this sync: send everything next time.
      data[kind].forEach(l => { if (!ids.has(l.id) && !graves[kind + ':' + l.id] && (+l.updated || 0) <= started) missing = true; });
      data[kind] = [...map.values()].filter(x => { const g = graves[kind + ':' + x.id]; return !(g && g >= (+x.updated || 0)); })
        .filter(kind === 'entries' ? C.okEntry : kind === 'days' ? okDay : okPref);
    }
    initShadow(); persist();
    render();
    if (st.day && !$('daySheet').hidden) { if (st.form && st.form.editing && !data.entries.some(x => x.id === st.form.editing)) st.form = null; renderDay(); }
    scheduleSheet();   // the Google Sheet, if connected, hears what another phone changed
    return missing;
  }
  async function sync(loud) {
    if (syncing) { syncAgain = true; return false; }
    if (!navigator.onLine) { setState('offline'); return false; }
    const acct = A(), token = acct && acct.token(), user = acct && acct.user();
    forOtherPerson(user);
    syncing = true; setState('syncing');
    let ok = false;
    try {
      track(); persist();
      const started = Date.now(), since = token && info.at ? info.at : 0, pushed = since ? (+info.pushed || 0) : 0;
      const pick = arr => arr.filter(x => (+x.updated || 0) > pushed);
      const payload = { since, entries: pick(data.entries), days: pick(data.days), prefs: pick(data.prefs),
        graves: Object.fromEntries(Object.entries(graves).filter(([, t]) => t > pushed)) };
      const headers = { 'Content-Type': 'application/json', 'X-Drinks': '1' };
      if (token) headers.Authorization = 'Bearer ' + token;
      let r; try { r = await fetch('../drinks/api/sync', { method: 'POST', headers, body: JSON.stringify(payload), cache: 'no-store' }); }
      catch { setState(navigator.onLine ? 'error' : 'offline'); return false; }
      let res = {}; try { res = await r.json(); } catch {}
      if (r.status === 401) { setState('signin'); return false; }
      // No accounts yet (or no server here, as on GitHub Pages): the log stays on the phone.
      if (r.status === 503 || r.status === 404 || res.error === 'accounts-off') { setState('local'); return false; }
      if (!r.ok || !res.ok) { setState('error'); if (loud) toast('Couldn’t save to your account just now.'); return false; }
      const missing = res.full ? applyRemote(res, started) : false;
      info = { at: res.at || 0, pushed: missing ? 0 : started, user: user ? user.id : info.user, when: Date.now() };
      if (missing) syncAgain = true;
      lastSyncAt = info.when; saveInfo();
      ok = true; setState('ok');
    } finally {
      syncing = false;
      if (syncAgain) { syncAgain = false; scheduleSync(800); }
    }
    return ok;
  }
  // A few seconds after the last change, so a night's drinks are a few saves, not dozens.
  function scheduleSync(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(() => sync(false), ms == null ? 4000 : ms); }
  addEventListener('aos:account', e => { if (e.detail) sync(true); else setState('signin'); });

  // ---------------------------------------------------------------------
  // Google Sheet sync - optional, the same design as Fitness's, for the whole log
  // (google-sheet-sync.gs; steps in the README). The Sheet is your own, so it is for you
  // alone: another person who signs in on this phone does not inherit it. Its Log tab
  // goes both ways: a row typed or changed there comes back here.
  // ---------------------------------------------------------------------
  const SHEET_APP = 'allison-drinks-sync';
  // The owner's Sheet. The link alone opens nothing (changes need the secret phrase), so it is filled in for you; only the phrase is typed.
  const SHEET_URL = 'https://script.google.com/macros/s/AKfycbzjULI2qY8he38bdMmGq2Pv1J3cjIX8gC5m2YzaGPVkqWgNpcURDco2CYLuldHRKHtz/exec';
  let sheetCfg = ls.json(K.sheet, null);
  if (!sheetCfg || typeof sheetCfg.url !== 'string' || typeof sheetCfg.secret !== 'string') sheetCfg = null;
  let sheetBusy = false, sheetAgain = false, sheetTimer = null, sheetState = sheetCfg ? 'idle' : 'off', sheetErr = '', sheetErrShown = false;
  let sheetAt = +ls.get(K.sheetAt, 0) || 0;
  const SHEET_ERRORS = {
    'wrong-secret': 'The secret code doesn’t match the script’s. If you changed SECRET after deploying, the web app still has the old one: Deploy → Manage deployments → ✏️ → Version: New version → Deploy. Also check the phone didn’t add a space to the code.',
    'old-script': 'The Sheet is running an old copy of the script. Deploy → Manage deployments → ✏️ → Version: New version → Deploy, then try again.',
    'secret-not-set': 'The script still says SECRET = ‘CHANGE-ME’. Change it, save, and deploy a new version.',
    'busy': 'The Sheet was busy. Trying again shortly.',
    'bad-request': 'The Sheet didn’t understand the request.',
    'network': 'Couldn’t reach the Sheet. Check the link, or you may be offline.',
    'not-json': 'That link didn’t answer like the Drinks script. Check it ends in /exec and “Who has access” is Anyone.',
    'wrong-app': 'That link belongs to another AllisonOS app’s Sheet. Drinks needs the web app link from its own Sheet (Extensions → Apps Script → Deploy → Manage deployments).',
  };
  // A copy of the link and code in IndexedDB, as in Fitness: it survives a full or cleared localStorage
  // (every AllisonOS app shares its space).
  const sheetKeep = (() => {
    let db = null;
    const open = () => db || (db = new Promise((res, rej) => {
      const r = indexedDB.open('allison-drinksv', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = (mode, fn) => open().then(d => new Promise((res, rej) => {
      const t = d.transaction('kv', mode), q = fn(t.objectStore('kv'));
      t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error);
    }));
    return {
      get: k => tx('readonly', x => x.get(k)).catch(() => null),
      set: (k, v) => tx('readwrite', x => v == null ? x.delete(k) : x.put(v, k)).catch(() => {}),
    };
  })();
  function saveSheetCfg() {
    if (sheetCfg) ls.set(K.sheet, JSON.stringify(sheetCfg)); else ls.del(K.sheet);
    sheetKeep.set('sheet', sheetCfg ? { url: sheetCfg.url, secret: sheetCfg.secret } : null);
  }
  // Disconnect (someone else signed in on this phone): the link and code are gone from here, and the Sheet is left as it is.
  function sheetForget() {
    if (!sheetCfg) return;
    sheetCfg = null; sheetState = 'off'; ls.del(K.sheetAt); sheetAt = 0; saveSheetCfg(); renderSheetStatus();
  }
  function applyFromSheet(res) {
    Object.keys(res.graves || {}).forEach(k => { const t = +res.graves[k] || 0; if ((graves[k] || 0) < t) graves[k] = t; });
    const before = JSON.stringify([data.entries, data.days, data.prefs]);
    for (const kind of KINDS) {
      const map = new Map(data[kind].map(x => [x.id, x])), remote = Array.isArray(res[kind]) ? res[kind] : [];
      remote.forEach(r => { const l = map.get(r.id); if (!l || (+r.updated || 0) > (+l.updated || 0)) map.set(r.id, r); });
      data[kind] = [...map.values()].filter(x => { const g = graves[kind + ':' + x.id]; return !(g && g >= (+x.updated || 0)); })
        .filter(kind === 'entries' ? C.okEntry : kind === 'days' ? okDay : okPref);
    }
    const changed = JSON.stringify([data.entries, data.days, data.prefs]) !== before;
    initShadow(); persist();
    if (changed) {
      render();
      if (st.day && !$('daySheet').hidden) { if (st.form && st.form.editing && !data.entries.some(x => x.id === st.form.editing)) st.form = null; renderDay(); }
      scheduleSync();   // a change typed into the Sheet goes on to your account
    }
    return changed;
  }
  async function sheetSync(loud) {
    if (!sheetCfg) return false;
    if (sheetBusy) { sheetAgain = true; return false; }
    if (!navigator.onLine) { sheetState = 'offline'; renderSheetStatus(); return false; }
    sheetBusy = true; sheetState = 'syncing';
    if (loud) busyPill('Syncing');
    let ok = false;
    try {
      track(); persist();
      let r, res;
      try {
        r = await fetch(sheetCfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', cache: 'no-store',
          body: JSON.stringify({ secret: sheetCfg.secret, action: 'sync', v: 1, entries: data.entries, days: data.days, prefs: data.prefs, graves }) });
      } catch { throw new Error('network'); }
      try { res = await r.json(); } catch { throw new Error('not-json'); }
      if (res && res.ok && res.app && res.app !== SHEET_APP) throw new Error('wrong-app');
      if (res && res.error === 'wrong-secret' && res.app !== SHEET_APP) throw new Error(await whichSheetScript(sheetCfg.url));
      if (!res || !res.ok) throw new Error((res && res.error) || 'not-json');
      sheetAt = Date.now(); ls.set(K.sheetAt, String(sheetAt));
      sheetState = 'ok'; sheetErr = ''; sheetErrShown = false; ok = true;
      applyFromSheet(res);
      if (loud) pillDone('Synced');
    } catch (e) {
      sheetState = 'error'; sheetErr = e.message; busyPill();
      if (loud || !sheetErrShown) { sheetErrShown = true; toast(SHEET_ERRORS[sheetErr] || 'The Google Sheet didn’t sync. Trying again later.', null, 6000); }
    } finally {
      sheetBusy = false; renderSheetStatus();
      if (sheetAgain) { sheetAgain = false; scheduleSheet(800); }
    }
    return ok;
  }
  // A "wrong secret" from a script that doesn't say it's Drinks': ask the link which app it belongs to (every script
  // answers a plain GET with its name).
  async function whichSheetScript(url) {
    try {
      const r = await fetch(url, { cache: 'no-store', redirect: 'follow' });
      const d = await r.json();
      if (d && d.app && d.app !== SHEET_APP) return 'wrong-app';
      if (d && d.app === SHEET_APP) return 'old-script';
    } catch {}
    return 'wrong-secret';
  }
  function scheduleSheet(ms) { if (!sheetCfg) return; clearTimeout(sheetTimer); sheetTimer = setTimeout(() => sheetSync(false), ms == null ? 2500 : ms); }
  const sheetLine = () => !sheetCfg ? 'Not connected' : sheetState === 'error' ? 'Couldn’t sync just now' : sheetState === 'syncing' ? 'Syncing…'
    : sheetState === 'offline' ? 'Offline: will sync when you’re back online' : sheetAt ? 'Connected. Last synced ' + ago(sheetAt) + '.' : 'Connected';
  function renderSheetStatus() {
    const on = !!sheetCfg;
    if ($('syStatus')) {
      $('syStatus').textContent = !on ? 'Back up your log to a Google Sheet of your own. Its Log tab goes both ways: change a row there, or add one, and it comes back here.'
        : sheetState === 'error' ? (SHEET_ERRORS[sheetErr] || 'Not synced') : sheetState === 'syncing' ? 'Syncing…'
        : sheetState === 'offline' ? 'Offline. Changes will sync when you’re back online.' : sheetAt ? 'Connected. Last synced ' + ago(sheetAt) + '.' : 'Connected.';
      $('syForm').hidden = on; $('syOn').hidden = !on;
    }
    const sub = $('sheetSub'); if (sub) sub.textContent = sheetLine();
  }
  function openSheetSync(pre) {
    $('syUrl').value = pre ? pre.u : sheetCfg ? sheetCfg.url : SHEET_URL;
    $('sySecret').value = pre ? pre.s : sheetCfg ? sheetCfg.secret : '';
    renderSheetStatus();
    if (pre) { $('syForm').hidden = false; $('syOn').hidden = true; $('syStatus').textContent = 'From a setup link. Tap Connect and sync.'; }
    openSheet('syncSheet');
  }
  $('syForm').onsubmit = async e => {
    e.preventDefault();
    const url = $('syUrl').value.trim(), secret = $('sySecret').value.trim();
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { $('syStatus').textContent = 'Paste the web app link from Apps Script. It starts with https://script.google.com/ and ends in /exec.'; return; }
    if (!secret) { $('syStatus').textContent = 'Enter the secret code you put in the script.'; return; }
    const before = sheetCfg;
    sheetCfg = { url, secret };
    $('syConnect').disabled = true; $('syStatus').textContent = 'Connecting…';
    const ok = await sheetSync(true);
    $('syConnect').disabled = false;
    if (!ok) { sheetCfg = before; sheetState = before ? 'idle' : 'off'; const err = sheetErr; renderSheetStatus(); $('syForm').hidden = false; $('syOn').hidden = true; $('syStatus').textContent = SHEET_ERRORS[err] || 'Couldn’t connect.'; return; }
    saveSheetCfg(); renderSheetStatus();
    toast('Connected. ' + plural(data.entries.length, 'drink') + ' now in the Sheet.');
  };
  $('syNow').onclick = async () => { if (await sheetSync(true)) toast('Synced'); };
  const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  $('syShare').onclick = async () => {
    const link = location.href.split('#')[0].split('?')[0] + '#sync=' + b64e(JSON.stringify({ u: sheetCfg.url, s: sheetCfg.secret }));
    try { await navigator.clipboard.writeText(link); toast('Setup link copied. Open it in Drinks on your other phone. Keep it private.', null, 6000); }
    catch { toast('Copy isn’t available here.'); }
  };
  $('syOff').onclick = () => {
    const b = $('syOff');
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to disconnect'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Disconnect this phone'; }, 3500); return; }
    delete b.dataset.armed; b.textContent = 'Disconnect this phone';
    sheetCfg = null; sheetState = 'off'; saveSheetCfg(); renderSheetStatus();
    toast('Disconnected. Your log stays on this phone, in your account and in the Sheet.');
  };
  function takeSetupLink(text) {
    const m = String(text).match(/#sync=([\w-]+)/); if (!m) return false;
    try { const c = JSON.parse(b64d(m[1])); if (c && c.u && c.s) { openSheetSync(c); return true; } } catch {}
    toast('That setup link is damaged. Copy it again.'); return true;
  }
  // The pill at the top while the Sheet syncs (as in Fitness).
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

  // ---------------------------------------------------------------------
  // Sheets and the toast (as in Fitness)
  // ---------------------------------------------------------------------
  const focusStack = [];
  const lockPage = () => document.documentElement.classList.toggle('locked', [...document.querySelectorAll('.sheetwrap')].some(w => !w.hidden));
  function openSheet(id) { focusStack.push(document.activeElement); $(id).hidden = false; lockPage(); }
  function closeSheet(id) { $(id).hidden = true; lockPage(); const f = focusStack.pop(); if (f && f.focus && document.contains(f)) f.focus(); }
  const closers = { daySheet: () => { closeSheet('daySheet'); st.day = null; st.form = null; } };
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
    if (trendsEscape()) return;
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
  // The Analysis page: one view at a time, picked from the pill at the bottom
  // (as Home's views), opened from the week's number. The sums are calc.js's;
  // the charts are plain SVG that follows light and dark.
  // ---------------------------------------------------------------------
  const WEEKS = 12;
  const tr = { view: ls.get(K.trview, 'compare'), sel: null, group: ls.get(K.trgroup, 'name') === 'kind' ? 'kind' : 'name', table: false, T: null, scroll: 0 };
  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const wk = w => short(w.start) + ' – ' + short(w.end);
  const sign = n => (n < 0 ? '−' : '+') + f1(Math.abs(n));
  const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);
  const kpi = (label, value, sub) => '<div class="kpi" aria-label="' + esc(label + ': ' + value + (sub ? ', ' + sub : '')) + '"><span class="kl">' + esc(label) + '</span><span class="kv">' + esc(value) + '</span><span class="kd">' + esc(sub || '') + '</span></div>';
  const kpis = list => '<div class="kpis">' + list.join('') + '</div>';
  const legend = items => '<div class="legend">' + items.map(([c, t]) => '<span><i class="' + c + '"></i>' + esc(t) + '</span>').join('') + '</div>';
  // Every chart has its numbers as a table too, for anyone who'd rather read them.
  const tview = (head, rows) => '<details class="tview"' + (tr.table ? ' open' : '') + '><summary>Show as a table</summary><table><thead><tr>' + head.map((h, i) => '<th' + (i ? ' class="n"' : '') + '>' + esc(h) + '</th>').join('')
    + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map((c, i) => '<td' + (i ? ' class="n"' : '') + '>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></details>';
  const readout = html => '<p class="readout" aria-live="polite">' + html + '</p>';
  // A scale that starts at 0 with at most five clean steps; `whole` keeps steps whole numbers.
  function scale(max, whole) {
    const steps = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100].filter(s => !whole || s >= 1);
    const step = steps.find(s => Math.ceil(max / s - 1e-9) <= 5) || 100;
    return { max: Math.max(step, Math.ceil(max / step - 1e-9) * step), step };
  }
  // A scale for a line, not starting at 0.
  function span(lo, hi) {
    const steps = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20];
    const step = steps.find(s => Math.ceil((hi - lo) / s - 1e-9) <= 4) || 20;
    let a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step;
    if (a === b) b += step;
    return { min: a, max: b, step };
  }
  const dec = step => step % 1 === 0 ? 0 : (step * 10) % 1 === 0 ? 1 : 2;   // decimals a scale's ticks need
  const W = 340, PL = 30, PR = 8, PT = 16, PB = 24;
  // The frame every chart shares: grid, ticks, the week labels, and the hit area over each week.
  function frame(o) {
    const n = o.n, H = o.h || 190, iw = W - PL - PR, ih = H - PT - PB, slot = iw / n;
    const y = v => PT + ih - (v - o.min) / (o.max - o.min) * ih;
    const x = i => PL + slot * (i + 0.5);
    let g = '';
    for (let v = o.min; v <= o.max + 1e-9; v += o.step) g += '<line class="grid" x1="' + PL + '" x2="' + (W - PR) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text class="tick" x="' + (PL - 6) + '" y="' + (y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + o.fmt(v) + '</text>';
    for (let i = 0; i < n; i++) if ((n - 1 - i) % o.every === 0) g += '<text class="xl" x="' + x(i).toFixed(1) + '" y="' + (H - 7) + '">' + esc(o.xl[i]) + '</text>';
    const sel = o.sel == null ? '' : '<rect class="selbg" x="' + (PL + slot * o.sel).toFixed(1) + '" y="' + (PT - 6) + '" width="' + slot.toFixed(1) + '" height="' + (ih + 6) + '" rx="6"/>';
    let hits = '';
    for (let i = 0; i < n; i++) hits += '<rect class="hit" data-i="' + i + '" tabindex="0" role="button" aria-label="' + esc(o.aria[i]) + '" x="' + (PL + slot * i).toFixed(1) + '" y="' + (PT - 6) + '" width="' + slot.toFixed(1) + '" height="' + (ih + PB + 6) + '"/>';
    return { H, ih, slot, x, y, base: '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="' + esc(o.label) + '">' + g + sel, hits };
  }
  // Columns grow from the baseline with a rounded top; `cls(i)` colours them, `flag(i)` marks one with a triangle.
  function columns(o) {
    const f = frame(o), bw = Math.min(20, f.slot - 6);
    let s = f.base, top = -1;
    o.vals.forEach((v, i) => { if (v != null && v > 0 && (top < 0 || v > o.vals[top])) top = i; });
    o.vals.forEach((v, i) => {
      if (v == null || v <= 0) return;
      const x0 = f.x(i) - bw / 2, y0 = f.y(v), b = f.y(o.min), r = Math.min(4, b - y0);
      s += '<path class="bar ' + o.cls(i) + '" d="M' + x0.toFixed(1) + ' ' + b + 'V' + (y0 + r).toFixed(1) + 'Q' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' ' + (x0 + r).toFixed(1) + ' ' + y0.toFixed(1)
        + 'H' + (x0 + bw - r).toFixed(1) + 'Q' + (x0 + bw).toFixed(1) + ' ' + y0.toFixed(1) + ' ' + (x0 + bw).toFixed(1) + ' ' + (y0 + r).toFixed(1) + 'V' + b + 'Z"/>';
      if (o.flag && o.flag(i)) s += '<path class="tri" d="M' + f.x(i).toFixed(1) + ' ' + (y0 - 11).toFixed(1) + 'l4.5 8h-9z"/>';
    });
    if (top >= 0) s += '<text class="val" x="' + f.x(top).toFixed(1) + '" y="' + (f.y(o.vals[top]) - (o.flag && o.flag(top) ? 14 : 5)).toFixed(1) + '">' + o.fmt(o.vals[top]) + '</text>';
    if (o.line != null) s += '<line class="' + (o.lineCls || 'limit') + '" x1="' + PL + '" x2="' + (W - PR) + '" y1="' + f.y(o.line).toFixed(1) + '" y2="' + f.y(o.line).toFixed(1) + '"/><text class="lbl" x="' + (PL + 4) + '" y="' + (f.y(o.line) - 4).toFixed(1) + '">' + esc(o.lineText) + '</text>';
    if (o.avg) {
      let d = '';
      o.avg.forEach((v, i) => { d += v == null ? '' : (d && o.avg[i - 1] != null ? 'L' : 'M') + f.x(i).toFixed(1) + ' ' + f.y(v).toFixed(1); });
      s += '<path class="avgline" d="' + d + '"/>';
    }
    return s + f.hits + '</svg>';
  }
  // A line, broken where there is nothing to show; every point is a dot with a ring.
  function lineChart(o) {
    const f = frame(o);
    let s = f.base, d = '';
    o.vals.forEach((v, i) => { d += v == null ? '' : (d && o.vals[i - 1] != null ? 'L' : 'M') + f.x(i).toFixed(1) + ' ' + f.y(v).toFixed(1); });
    s += '<path class="ln" d="' + d + '"/>';
    o.vals.forEach((v, i) => { if (v != null) s += '<circle class="dot" cx="' + f.x(i).toFixed(1) + '" cy="' + f.y(v).toFixed(1) + '" r="4"/>'; });
    return s + f.hits + '</svg>';
  }
  const xlabels = ws => ws.map(w => short(w.start));
  const selOf = (n, last) => tr.sel != null && tr.sel >= 0 && tr.sel < n ? tr.sel : last;
  // The week you tapped, or else the newest with something in it.
  const lastWith = ws => { for (let i = ws.length - 1; i >= 0; i--) if (ws[i].hasData) return i; return ws.length - 1; };
  const notLogged = T => { const k = sum(T.weeks, w => w.notRecorded); return k ? '<p class="anote">' + plural(k, 'day') + ' in these weeks weren’t logged. They’re left out of the averages, so a week with gaps can read low.</p>' : ''; };

  const TV = [
    { id: 'compare', name: 'Compared with before', sub: () => '',
      icon: '<svg viewBox="0 0 24 24"><path d="M8 4v16M4.6 7.4L8 4l3.4 3.4M16 20V4M12.6 16.6L16 20l3.4-3.4"/></svg>',
      sum: T => { const P = PERIODS[st.period], a = C.compare(data.entries, data.days, T.tod, P.days), d = C.round(a.now.sd - a.before.sd, 1);
        return !a.hasNow ? 'Nothing logged in the last ' + P.days + ' days' : 'Last ' + P.days + ' days: ' + f1(a.now.sd) + (a.hasBefore && d ? ' (' + (d > 0 ? 'up ' : 'down ') + f1(Math.abs(d)) + ')' : ''); },
      draw(T) {
        const P = PERIODS[st.period], a = C.compare(data.entries, data.days, T.tod, P.days), r = a.range, n = a.now, b = a.before;
        const seg = '<div class="seg slides" role="radiogroup" aria-label="Compare">' + Object.entries(PERIODS).map(([k, p]) => '<button type="button" data-period="' + k + '" aria-pressed="' + (st.period === k) + '">' + p.name + '</button>').join('') + '</div>';
        const note = '<p class="anote">' + esc(short(r.from) + ' – ' + short(r.to) + ' against ' + short(r.beforeFrom) + ' – ' + short(r.beforeTo)) + '</p>';
        if (!a.hasNow && !a.hasBefore) return seg + note + '<div class="empty"><strong>Nothing to compare yet</strong>Log a few days, drinks or alcohol-free, and this fills in.</div>';
    // Four numbers, each against the window before. Fewer drinks is better; more alcohol-free days is better.
        const cmp = (label, now, before, lowerIsBetter) => {
          const has = now !== null, d = has && before !== null ? C.round(now - before, 1) : null;
          const dir = !a.hasBefore || d === null || d === 0 ? '' : (d < 0) === lowerIsBetter ? 'good' : 'bad';
          const delta = !a.hasBefore || d === null ? 'nothing before' : d === 0 ? 'same as before' : (d > 0 ? '↑ +' : '↓ −') + f1(Math.abs(d));
          const words = !a.hasBefore || d === null || !d ? delta : (d > 0 ? 'up ' : 'down ') + f1(Math.abs(d)) + ' on ' + P.before + (dir === 'good' ? ', better' : ', worse');
          return '<div class="kpi" aria-label="' + esc(label + ': ' + (has ? f1(now) : 'not known') + ', ' + words) + '"><span class="kl">' + esc(label) + '</span><span class="kv">' + (has ? f1(now) : '—') + '</span><span class="kd ' + dir + '">' + esc(delta) + '</span></div>';
        };
        const kpis = '<div class="kpis">'
          + cmp('Standard drinks', n.sd, b.sd, true)
          + cmp('Days you drank', n.drinkingDays, b.drinkingDays, true)
          + cmp('Alcohol-free days', n.afDays, b.afDays, false)
          + cmp('A day, on average', n.avg, b.avg, true) + '</div>';
        const k = C.streaks(data.entries, data.days, T.tod);
        const rows = '<div class="xrow"><span class="xt">Alcohol-free in a row<small>Your best: ' + plural(k.best, 'day') + '</small></span><span class="xv">' + plural(k.current, 'day') + '</span></div>'
          + (n.heaviest ? '<div class="xrow"><span class="xt">Most in one day<small>' + esc(fmt(n.heaviest.date, { weekday: 'long', day: 'numeric', month: 'short' })) + '</small></span><span class="xv">' + f1(n.heaviest.sd) + '</span></div>' : '')
          + (n.notRecorded ? '<div class="xrow"><span class="xt">Days not logged<small>Left out of the average. Tap a day in the week to fill it in.</small></span><span class="xv">' + n.notRecorded + '</span></div>' : '');
        const cats = Object.entries(n.cats).sort((p, q) => q[1] - p[1]);
        const max = Math.max(0.1, ...cats.map(c => c[1]));
        const bars = cats.map(([c, v]) => '<div class="gbar" data-c="' + esc(c) + '" aria-label="' + esc(catName(c) + ': ' + f1(v) + ' standard drinks') + '"><span class="gn"><i class="cdot"></i>' + esc(catName(c)) + '</span><span class="gt"><span class="bar" style="width:' + (v / max * 72).toFixed(1) + '%"></span><span class="gv">' + f1(v) + '</span></span></div>').join('');
        return seg + note + kpis
          + '<div class="rgroup">' + rows + '</div>'
          + (bars ? '<p class="label">By drink</p><div class="rgroup bars">' + bars + '</div>' : '')
          + '<p class="hint">In standard drinks: 14 g of alcohol each (the US measure), such as 12 oz of 5% beer or 1.5 oz of 40% spirits. The average counts the days you logged, drinks or alcohol-free.</p>';
      } },
    { id: 'weekly', name: 'Weekly drinks',
      icon: '<svg viewBox="0 0 24 24"><path d="M5 20V12M10 20V6M15 20V10M20 20V15"/></svg>',
      sum: T => { const d = T.weeks.filter(w => w.hasData && !w.partial); return d.length ? f1(sum(d, w => w.sd) / d.length) + ' a week on average' : 'Nothing logged yet'; },
      draw(T) {
        const g = T.g, ws = T.weeks, done = ws.filter(w => w.hasData && !w.partial), i = selOf(ws.length, lastWith(ws));
        const avg = done.length ? sum(done, w => w.sd) / done.length : null;
        const hi = done.reduce((a, w) => !a || w.sd > a.sd ? w : a, null), lo = done.reduce((a, w) => !a || w.sd < a.sd ? w : a, null);
        const say = w => !w.hasData ? '<b>' + esc(wk(w)) + '</b> · nothing logged'
          : '<b>' + esc(wk(w)) + '</b> · <b>' + f1(w.sd) + '</b> standard drinks' + (w.partial ? ' so far' : '') + (g.week ? (w.over ? ', <b>' + f1(w.sd - g.week) + ' over</b> your ' + g.week : ', ' + f1(Math.max(0, g.week - w.sd)) + ' under your ' + g.week) : '')
          + (w.notRecorded ? ' · ' + plural(w.notRecorded, 'day') + ' not logged' : '') + (w.avg4 != null ? ' · 4-week average ' + f1(w.avg4) : '');
        const plain = w => say(w).replace(/<[^>]+>/g, '');
        const sc = scale(Math.max(g.week || 0, ...ws.map(w => w.sd)) * 1.08);
        const chart = columns({ n: ws.length, label: 'Standard drinks each week for the last ' + WEEKS + ' weeks', vals: ws.map(w => w.hasData ? w.sd : null), min: 0, max: sc.max, step: sc.step, fmt: f1, every: 3, xl: xlabels(ws),
          aria: ws.map(plain), sel: i, cls: j => (ws[j].over ? 'over' : '') + (ws[j].partial ? ' part' : ''), flag: j => ws[j].over, avg: ws.map(w => w.avg4),
          line: g.week || null, lineText: 'limit ' + g.week });
        return kpis([kpi('Average a week', avg == null ? '—' : f1(avg), done.length ? 'over ' + plural(done.length, 'finished week') : 'no finished weeks yet'),
            kpi('Weeks over your limit', g.week ? T.goals.over + ' of ' + T.goals.counted : '—', g.week ? 'limit ' + g.week + ' a week' : 'no weekly limit set'),
            kpi('Highest week', hi ? f1(hi.sd) : '—', hi ? short(hi.start) : ''), kpi('Lowest week', lo ? f1(lo.sd) : '—', lo ? short(lo.start) : '')])
          + '<div class="chartcard">' + readout(say(ws[i])) + chart
          + legend([['', 'Standard drinks'], ['over', 'Over your limit (▲)'], ['part', 'Lighter: this week so far'], ['avg', '4-week average'], ['lim', 'Weekly limit']].filter(x => g.week || (x[0] !== 'over' && x[0] !== 'lim')))
          + tview(['Week', 'Std drinks', '4-wk avg'], ws.map(w => [wk(w), w.hasData ? f1(w.sd) + (w.partial ? ' so far' : '') : 'not logged', w.avg4 == null ? '—' : f1(w.avg4)])) + '</div>' + notLogged(T);
      } },
    { id: 'over', name: 'Weeks over the limit',
      icon: '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 5h12l-2.4 4 2.4 4H5"/></svg>',
      sum: T => !T.g.week ? 'No weekly limit set' : T.goals.counted ? T.goals.over + ' of ' + T.goals.counted + ' weeks over' : 'Nothing logged yet',
      draw(T) {
        const g = T.g, ws = T.weeks, r = T.goals;
        if (!g.week) return '<div class="empty"><strong>No weekly limit set</strong>Set “A week, at most” in More (the person button), and this shows which weeks went over.</div>';
        const kind = w => !w.hasData ? 'none' : w.over ? 'over' : w.partial ? 'going' : 'ok';
        const sym = { none: '–', over: '▲', going: '…', ok: '✓' };
        const word = { none: 'nothing logged', over: 'over', going: 'so far, under', ok: 'under' };
        const strip = '<div class="wstrip" aria-hidden="true">' + ws.map(w => { const k = kind(w); return '<div class="wt ' + k + '"><b>' + sym[k] + '</b><span>' + esc(short(w.start)) + '</span></div>'; }).join('') + '</div>';
        const rows = '<div class="rgroup">' + ws.slice().reverse().map(w => {
          const k = kind(w), d = w.sd - g.week;
          return '<div class="xrow"><span class="xt">' + esc(wk(w)) + '<small>' + (k === 'none' ? 'Nothing logged' : f1(w.sd) + ' standard drinks' + (w.partial ? ' so far' : '')) + '</small></span><span class="xv ' + (k === 'over' ? 'over' : k === 'ok' ? 'ok' : '') + '" aria-label="' + esc(word[k] + (k === 'over' || k === 'ok' ? ' by ' + f1(Math.abs(d)) : '')) + '">'
            + (k === 'over' ? '▲ ' + sign(d) + ' over' : k === 'ok' ? '✓ ' + f1(-d) + ' under' : k === 'going' ? '… ' + f1(-d) + ' to go' : '–') + '</span></div>';
        }).join('') + '</div>';
        return kpis([kpi('Weeks over', r.over + ' of ' + r.counted, 'limit ' + g.week + ' a week'), kpi('Under your limit', String(r.under), r.noData + ' not logged'),
            kpi('Running under now', plural(r.runUnder, 'week'), 'in a row'), kpi('Best run under', plural(r.bestRun, 'week'), 'in these ' + WEEKS)])
          + strip + '<p class="anote">✓ under your limit · ▲ over · … this week so far, under it · – nothing logged</p>'
          + rows + '<p class="anote">A week counts once it’s over, or once it’s finished. Weeks with nothing logged aren’t counted.</p>';
      } },
    { id: 'top', name: 'Top drinks',
      icon: '<svg viewBox="0 0 24 24"><path d="M6.4 4h11.2l-1 6.2a4.6 4.6 0 0 1-9.2 0zM12 14.8V20M8.4 20h7.2"/></svg>',
      sum: T => { const t = C.topDrinks(data.entries, T.from, T.tod, 'name').sort((a, b) => b.qty - a.qty)[0]; return t ? t.label + ' most often' : 'Nothing logged yet'; },
      draw(T) {
        const all = C.topDrinks(data.entries, T.from, T.tod, tr.group), total = sum(all, x => x.sd);
        if (!all.length) return '<div class="empty"><strong>No drinks in these ' + WEEKS + ' weeks</strong>Only alcohol-free days so far.</div>';
        const pc = x => total ? Math.round(x.sd / total * 100) : 0;
        const row = (x, text, v, max) => '<div class="gbar" data-c="' + esc(x.cat) + '" aria-label="' + esc(x.label + ': ' + text) + '"><span class="gn"><i class="cdot"></i><span class="nm">' + esc(x.label) + '</span></span><span class="gt"><span class="bar" style="width:' + (v / max * 55).toFixed(1) + '%"></span><span class="gv">' + esc(text) + '</span></span></div>';
        const list = (arr, text, val) => {
          const top = arr.slice(0, 6), rest = arr.slice(6), max = Math.max(0.1, val(top[0]));
          return '<div class="rgroup bars tops">' + top.map(x => row(x, text(x), val(x), max)).join('')
            + (rest.length ? '<div class="gbar rest" aria-label="' + esc(plural(rest.length, 'other drink') + ': ' + text({ qty: sum(rest, val), sd: sum(rest, val) })) + '"><span class="gn"><span class="nm">' + plural(rest.length, 'other') + '</span></span><span class="gt"><span class="bar" style="width:' + (sum(rest, val) / max * 55).toFixed(1) + '%"></span><span class="gv">' + esc(text({ qty: sum(rest, val), sd: sum(rest, val) })) + '</span></span></div>' : '') + '</div>';
        };
        const seg = '<div class="seg slides" role="radiogroup" aria-label="Group drinks by">' + [['name', 'By name'], ['kind', 'By kind']].map(([k, t]) => '<button type="button" data-group="' + k + '" aria-pressed="' + (tr.group === k) + '">' + t + '</button>').join('') + '</div>';
        const byQty = all.slice().sort((a, b) => b.qty - a.qty || b.sd - a.sd), bySd = all.slice().sort((a, b) => b.sd - a.sd);
        const most = byQty[0], big = bySd[0];
        const callout = '<p class="callout">In the last ' + WEEKS + ' weeks you had <b>' + esc(most.label) + '</b> most often (' + plural(Math.round(most.qty), 'drink') + ')'
          + (big.key === most.key ? ', and it’s also what adds up to the most: <b>' + f1(big.sd) + '</b> standard drinks, ' + Math.round(big.sd / total * 100) + '% of all of them.'
            : ', but <b>' + esc(big.label) + '</b> adds up to the most: <b>' + f1(big.sd) + '</b> standard drinks, ' + pc(big) + '% of all of them.') + '</p>';
        return seg + callout
          + '<p class="label">Had most often</p>' + list(byQty, x => plural(Math.round(x.qty), 'drink'), x => x.qty)
          + '<p class="label">Adds up to the most</p>' + list(bySd, x => f1(x.sd) + ' · ' + pc(x) + '%', x => x.sd)
          + tview(['Drink', 'Drinks', 'Std drinks'], byQty.map(x => [x.label, String(Math.round(x.qty)), f1(x.sd)]))
          + '<p class="hint">Drinks with the same name are counted together, whatever their size. A drink with no name is counted as its kind. Standard drinks are 14 g of alcohol each.</p>';
      } },
    { id: 'days', name: 'Days of the week',
      icon: '<svg viewBox="0 0 24 24"><rect x="4" y="5.4" width="16" height="14.6" rx="3"/><path d="M4 10h16M8.6 3.6v3.2M15.4 3.6v3.2M8.6 14h.01M12 14h.01M15.4 14h.01"/></svg>',
      sum: T => { const d = TVdays(T).filter(x => x.avg != null).sort((a, b) => b.avg - a.avg)[0]; return d ? DOW[d.dow] + 's the heaviest' : 'Nothing logged yet'; },
      draw(T) {
        const d = TVdays(T), g = T.g, i = selOf(7, -1), tot = sum(d, x => x.sd), have = d.filter(x => x.avg != null);
        const hi = have.reduce((a, x) => !a || x.avg > a.avg ? x : a, null), lo = have.reduce((a, x) => !a || x.avg < a.avg ? x : a, null);
        const say = x => '<b>' + DOW[x.dow] + 's</b> · ' + (x.avg == null ? 'none logged' : '<b>' + f1(x.avg) + '</b> standard drinks on average · ' + Math.round(x.share * 100) + '% of everything · drank on ' + x.drinkingDays + ' of ' + x.recorded + ' logged');
        const sc = scale(Math.max(g.day || 0, ...d.map(x => x.avg || 0)) * 1.08);
        const chart = columns({ n: 7, label: 'Average standard drinks on each day of the week', vals: d.map(x => x.avg), min: 0, max: sc.max, step: sc.step, fmt: f1, every: 1, xl: d.map(x => DOW[x.dow].slice(0, 3)),
          aria: d.map(x => say(x).replace(/<[^>]+>/g, '')), sel: i < 0 ? null : i, cls: j => d[j].avg > g.day ? 'over' : '', flag: j => g.day && d[j].avg > g.day, line: g.day || null, lineText: 'limit ' + g.day });
        return kpis([kpi('Heaviest day', hi ? DOW[hi.dow] : '—', hi ? f1(hi.avg) + ' on average' : ''), kpi('Lightest day', lo ? DOW[lo.dow] : '—', lo ? f1(lo.avg) + ' on average' : '')])
          + (hi && tot ? '<p class="callout"><b>' + DOW[hi.dow] + 's</b> are your heaviest: ' + f1(hi.avg) + ' standard drinks on average, ' + Math.round(hi.share * 100) + '% of all you drank in these ' + WEEKS + ' weeks.</p>' : '')
          + '<div class="chartcard">' + readout(i < 0 ? 'Tap a day to see it.' : say(d[i])) + chart
          + legend([['', 'Average on that day'], ['over', 'Over your daily limit (▲)'], ['lim', 'Daily limit']].filter(x => g.day || x[0] === ''))
          + tview(['Day', 'Average', 'Share', 'Days drank'], d.map(x => [DOW[x.dow], x.avg == null ? 'not logged' : f1(x.avg), Math.round(x.share * 100) + '%', x.drinkingDays + ' of ' + x.recorded])) + '</div>'
          + '<p class="anote">The average counts the days of that name you logged, drinks or alcohol-free.</p>';
      } },
    { id: 'free', name: 'Alcohol-free days',
      icon: '<svg viewBox="0 0 24 24"><path d="M12 3.4c4.6 3.4 6.6 6.4 6.6 9.4a6.6 6.6 0 0 1-13.2 0c0-3 2-6 6.6-9.4zM9.4 13.2l2.2 2.2 3.4-3.8"/></svg>',
      sum: T => !T.g.af ? 'No goal set' : T.goals.afCounted ? 'Goal met in ' + T.goals.afMet + ' of ' + T.goals.afCounted + ' weeks' : 'Nothing logged yet',
      draw(T) {
        const g = T.g, ws = T.weeks, r = T.goals, i = selOf(ws.length, lastWith(ws)), k = C.streaks(data.entries, data.days, T.tod), done = ws.filter(w => w.hasData && !w.partial);
        const say = w => !w.hasData ? '<b>' + esc(wk(w)) + '</b> · nothing logged' : '<b>' + esc(wk(w)) + '</b> · <b>' + plural(w.afDays, 'alcohol-free day') + '</b>' + (w.partial ? ' so far' : '') + (g.af ? (w.afDays >= g.af ? ' · goal of ' + g.af + ' met ✓' : ' · ' + (g.af - w.afDays) + ' short of your ' + g.af) : '') + ' · drank on ' + w.drinkingDays + (w.notRecorded ? ' · ' + plural(w.notRecorded, 'day') + ' not logged' : '');
        const chart = columns({ n: ws.length, label: 'Alcohol-free days each week', vals: ws.map(w => w.hasData ? w.afDays : null), min: 0, max: 7, step: 1, fmt: v => String(v), every: 3, xl: xlabels(ws),
          aria: ws.map(w => say(w).replace(/<[^>]+>/g, '')), sel: i, cls: j => 'af' + (ws[j].partial ? ' part' : ''), line: g.af || null, lineCls: 'goal', lineText: 'goal ' + g.af });
        return kpis([kpi('Goal met', g.af ? r.afMet + ' of ' + r.afCounted : '—', g.af ? 'goal ' + g.af + ' a week' : 'no goal set'), kpi('Average a week', done.length ? f1(sum(done, w => w.afDays) / done.length) : '—', 'alcohol-free days'),
            kpi('Alcohol-free in a row', plural(k.current, 'day'), 'now'), kpi('Your best', plural(k.best, 'day'), 'in a row')])
          + '<div class="chartcard">' + readout(say(ws[i])) + chart
          + legend([['af', 'Alcohol-free days'], ['part', 'Lighter: this week so far'], ['gl', 'Your goal']].filter(x => g.af || x[0] !== 'gl'))
          + tview(['Week', 'Alcohol-free', 'Drank on'], ws.map(w => [wk(w), w.hasData ? String(w.afDays) : 'not logged', w.hasData ? String(w.drinkingDays) : '—'])) + '</div>'
          + '<p class="anote">A day only counts if you marked it alcohol-free. Days you didn’t log don’t.</p>';
      } },
    { id: 'heavy', name: 'Days over the limit',
      icon: '<svg viewBox="0 0 24 24"><path d="M12 4.2l8.4 14.6H3.6zM12 10v4.2M12 16.9h.01"/></svg>',
      sum: T => !T.g.day ? 'No daily limit set' : plural(sum(T.weeks, w => w.overDays), 'day') + ' over ' + T.g.day + ' a day',
      draw(T) {
        const g = T.g, ws = T.weeks, i = selOf(ws.length, lastWith(ws)), total = sum(ws, w => w.overDays), clean = ws.filter(w => w.hasData && !w.partial && !w.overDays).length;
        const most = ws.reduce((a, w) => !a || w.overDays > a.overDays ? w : a, null);
        const say = w => !w.hasData ? '<b>' + esc(wk(w)) + '</b> · nothing logged' : '<b>' + esc(wk(w)) + '</b> · <b>' + plural(w.overDays, 'day') + '</b> over ' + g.day + ' standard drinks' + (w.partial ? ' so far' : '') + ' · drank on ' + w.drinkingDays;
        const sc = scale(Math.max(1, ...ws.map(w => w.overDays)) * 1.1, true);
        const chart = columns({ n: ws.length, label: 'Days over your daily limit each week', vals: ws.map(w => w.hasData ? w.overDays : null), min: 0, max: sc.max, step: sc.step, fmt: v => String(v), every: 3, xl: xlabels(ws),
          aria: ws.map(w => say(w).replace(/<[^>]+>/g, '')), sel: i, cls: j => 'heavy' + (ws[j].partial ? ' part' : '') });
        return kpis([kpi('Days over', String(total), 'over ' + g.day + ' standard drinks'), kpi('Weeks with none', String(clean), 'of the finished weeks'),
            kpi('Most in a week', most && most.overDays ? String(most.overDays) : '0', most && most.overDays ? short(most.start) : ''), kpi('Your daily limit', String(g.day), 'standard drinks')])
          + '<div class="chartcard">' + readout(say(ws[i])) + chart
          + legend([['heavy', 'Days over your daily limit'], ['part', 'Lighter: this week so far']])
          + tview(['Week', 'Days over'], ws.map(w => [wk(w), w.hasData ? String(w.overDays) : 'not logged'])) + '</div>'
          + '<p class="anote">A weekly total can look fine while one night runs high. This counts those nights.</p>';
      } },
    { id: 'strength', name: 'Strength and size',
      icon: '<svg viewBox="0 0 24 24"><path d="M3.6 16.4l5-6 4 3.6 7.8-8.6M15 5.4h5.4V11"/></svg>',
      sum: T => { const w = T.weeks.filter(x => x.abv != null); return w.length ? strengthAll(T).toFixed(1) + '% average strength' : 'Nothing logged yet'; },
      draw(T) {
        const ws = T.weeks, i = selOf(ws.length, lastWith(ws)), all = ws.filter(w => w.abv != null);
        if (!all.length) return '<div class="empty"><strong>No drinks in these ' + WEEKS + ' weeks</strong>Only alcohol-free days so far.</div>';
        const say = w => w.abv == null ? '<b>' + esc(wk(w)) + '</b> · no drinks' : '<b>' + esc(wk(w)) + '</b> · <b>' + w.abv.toFixed(1) + '%</b> average strength · <b>' + (Math.round(w.perDrink * 100) / 100).toLocaleString('en-US') + '</b> standard drinks in an average drink';
        const abvs = all.map(w => w.abv), pd = all.map(w => w.perDrink);
        const a = span(Math.min(...abvs) - 0.2, Math.max(...abvs) + 0.2), b = span(Math.min(...pd) - 0.05, Math.max(...pd) + 0.05);
        const common = { n: ws.length, min: 0, every: 3, xl: xlabels(ws), aria: ws.map(w => say(w).replace(/<[^>]+>/g, '')), sel: i, h: 150 };
        const c1 = lineChart(Object.assign({}, common, { label: 'Average strength each week, in percent', vals: ws.map(w => w.abv), min: a.min, max: a.max, step: a.step, fmt: v => v.toFixed(dec(a.step)) + '%' }));
        const c2 = lineChart(Object.assign({}, common, { label: 'Standard drinks in an average drink, each week', vals: ws.map(w => w.perDrink), min: b.min, max: b.max, step: b.step, fmt: v => v.toFixed(dec(b.step)) }));
        const gAll = sum(T.weeks, w => w.perDrink == null ? 0 : w.sd), nAll = sum(T.weeks, w => w.drinks);
        return kpis([kpi('Average strength', strengthAll(T).toFixed(1) + '%', 'by volume, all ' + WEEKS + ' weeks'), kpi('An average drink', nAll ? (Math.round(gAll / nAll * 100) / 100).toLocaleString('en-US') : '—', 'standard drinks')])
          + '<div class="chartcard">' + readout(say(ws[i]))
          + '<p class="label" style="margin:0 4px 2px">Average strength (ABV)</p>' + c1
          + '<p class="label" style="margin:12px 4px 2px">Standard drinks in an average drink</p>' + c2
          + legend([['dk', 'Each dot is a week']])
          + tview(['Week', 'Strength', 'Std per drink'], ws.map(w => [wk(w), w.abv == null ? '—' : w.abv.toFixed(1) + '%', w.perDrink == null ? '—' : (Math.round(w.perDrink * 100) / 100).toLocaleString('en-US')])) + '</div>'
          + '<p class="anote">Strength is the alcohol over all the liquid you drank, so a bigger glass of a stronger drink moves it more. These scales don’t start at zero.</p>';
      } },
  ];
  const TVdays = T => C.weekdays(data.entries, data.days, T.from, T.tod, T.tod).slice().sort((p, q) => ((p.dow - (weekStartsSunday() ? 0 : 1) + 7) % 7) - ((q.dow - (weekStartsSunday() ? 0 : 1) + 7) % 7));
  const strengthAll = T => { let gr = 0, ml = 0; const m = C.byDay(data.entries); for (let d = T.from; d <= T.tod; d = addDays(d, 1)) { const x = m.get(d); if (x) { gr += x.g; ml += x.ml; } } return ml ? gr / C.ETHANOL / ml * 100 : 0; };

  function trendData() {
    const tod = today(), g = goals(), weeks = C.weeks(data.entries, data.days, weekStartOf(tod), WEEKS, tod, g);
    return { tod, g, weeks, from: weeks[0].start, goals: C.weekGoals(weeks, g) };
  }
  function renderTrends() {
    if (!TV.some(x => x.id === tr.view)) tr.view = TV[0].id;
    const T = tr.T = trendData(), v = TV.find(x => x.id === tr.view), has = T.weeks.some(w => w.hasData);
    $('trBody').innerHTML = '<div class="thead"><h2>' + esc(v.name) + '</h2><small>' + esc(v.sub ? v.sub(T) : short(T.from) + ' – ' + short(T.tod)) + '</small></div>'
      + (has ? v.draw(T) : '<div class="empty"><strong>Nothing to chart yet</strong>Log a few days, drinks or alcohol-free, and this fills in.</div>');
    $('trName').textContent = v.name; $('trIcon').innerHTML = v.icon;
    if (!$('trMenu').hidden) drawTrMenu();
    const box = $('trBody').querySelector('.seg');
    if (box && window.AllisonOS && AllisonOS.slide) AllisonOS.slide(box, box.querySelector('[aria-pressed="true"]'), 'seg:' + tr.view);
  }
  function drawTrMenu() {
    const T = tr.T || trendData();
    $('trMenu').innerHTML = TV.map(v => '<button type="button" role="option" data-view="' + v.id + '" aria-selected="' + (v.id === tr.view) + '"><span class="ic">' + v.icon + '</span><span class="k">' + esc(v.name) + '<small>' + esc(T.weeks.some(w => w.hasData) ? v.sum(T) : 'Nothing logged yet') + '</small></span><span class="tick">' + ICON.tick + '</span></button>').join('');
  }
  function closeTrMenu(focus) { $('trMenu').hidden = true; $('trBtn').setAttribute('aria-expanded', 'false'); if (focus) $('trBtn').focus({ preventScroll: true }); }
  $('trBtn').addEventListener('click', e => {
    e.stopPropagation();
    if (!$('trMenu').hidden) return closeTrMenu();
    drawTrMenu(); $('trMenu').hidden = false; $('trBtn').setAttribute('aria-expanded', 'true');
    const cur = $('trMenu').querySelector('[aria-selected="true"]'); if (cur) cur.focus({ preventScroll: true });
  });
  $('trMenu').addEventListener('click', e => {
    const b = e.target.closest('[data-view]'); if (!b) return;
    tr.view = b.dataset.view; tr.sel = null; ls.set(K.trview, tr.view);
    closeTrMenu(true); renderTrends(); window.scrollTo({ top: 0 });
  });
  document.addEventListener('click', e => { if (!$('trMenu').hidden && !e.target.closest('#trMenu, #trBtn')) closeTrMenu(); });
  // Tap a week (or a day) to read it; the chart keeps what you picked.
  function pick(el) {
    tr.sel = +el.dataset.i; renderTrends();
    const again = $('trBody').querySelector('.hit[data-i="' + tr.sel + '"]'); if (again) again.focus({ preventScroll: true });
  }
  $('trBody').addEventListener('click', e => {
    const g = e.target.closest('[data-group]');
    if (g) { tr.group = g.dataset.group === 'kind' ? 'kind' : 'name'; ls.set(K.trgroup, tr.group); renderTrends(); return; }
    const pd = e.target.closest('[data-period]');
    if (pd) { st.period = pd.dataset.period === 'month' ? 'month' : 'week'; ls.set(K.period, st.period); renderTrends(); return; }
    const h = e.target.closest('.hit'); if (h) pick(h);
  });
  $('trBody').addEventListener('keydown', e => { const h = e.target.closest && e.target.closest('.hit'); if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(h); } });
  $('trBody').addEventListener('toggle', e => { if (e.target.matches && e.target.matches('details.tview')) tr.table = e.target.open; }, true);
  window.addEventListener('resize', () => { const box = $('trBody').querySelector('.seg'); if (box && !$('trends').hidden && window.AllisonOS && AllisonOS.slide) AllisonOS.slide(box, box.querySelector('[aria-pressed="true"]'), 'seg:' + tr.view, { jump: true }); });
  function openTrends() {
    tr.scroll = window.scrollY; tr.sel = null;
    $('app').classList.add('intrends'); $('trends').hidden = false; window.scrollTo(0, 0);
    renderTrends(); $('trBack').focus({ preventScroll: true });
  }
  function closeTrends() {
    closeTrMenu(); $('trends').hidden = true; $('app').classList.remove('intrends');
    window.scrollTo(0, tr.scroll || 0);
    const f = $('sumBtn'); if (f) f.focus({ preventScroll: true });
  }
  $('trBack').onclick = closeTrends;
  // Escape closes the view menu, then Trends (the sheets are all closed while Trends is open).
  function trendsEscape() { if ($('trends').hidden) return false; if (!$('trMenu').hidden) closeTrMenu(true); else closeTrends(); return true; }

  // ---------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------
  load();
  render();
  animateIn(main);
  // A setup link from your other phone: #sync=...
  if (location.hash.startsWith('#sync=')) { const h = location.hash; history.replaceState(null, '', location.pathname + location.search); setTimeout(() => takeSetupLink(h), 300); }
  // Opened from Calendar's Drinks layer: ?date=YYYY-MM-DD opens that day.
  const q = new URLSearchParams(location.search).get('date');
  if (/^\d{4}-\d{2}-\d{2}$/.test(q || '') && !isNaN(noon(q))) { st.week = weekStartOf(q); render(); openDay(q); }
  window.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    load(); render();
    if (st.day) { if (st.form && st.form.editing && !data.entries.some(x => x.id === st.form.editing)) st.form = null; renderDay(); }
  });
  // Back to the app: today may be a new day, and another phone may have logged something.
  let shownDay = today();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (today() !== shownDay) { shownDay = today(); st.week = weekStartOf(today()); }
    if (!st.day) render();
    if (Date.now() - lastSyncAt > 60000) sync(false);
    if (sheetCfg && Date.now() - sheetAt > 30000) sheetSync(false);
  });
  window.addEventListener('online', () => { sync(false); if (sheetCfg) sheetSync(false); });
  setTimeout(() => sync(false), 600);
  if (sheetCfg) { setTimeout(() => sheetSync(false), 900); sheetKeep.get('sheet').then(c => { if (!c || c.url !== sheetCfg.url || c.secret !== sheetCfg.secret) saveSheetCfg(); }); }
  else sheetKeep.get('sheet').then(c => {
    if (sheetCfg || !c || !c.url || !c.secret) return;
    sheetCfg = { url: c.url, secret: c.secret }; sheetState = 'idle'; ls.set(K.sheet, JSON.stringify(sheetCfg));
    sheetSync(false); toast('Reconnected to the Google Sheet from this phone’s backup copy.');
  });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // For the tests (drinksvintage/scripts/app-test.mjs) only.
  window.__drinks = { st, data, render, openDay, sync, sheetSync, sheetState: () => sheetState, sheetCfg: () => sheetCfg, graves: () => graves, info: () => info, state: () => syncState, usual, openAnalysis: openTrends, openTrends };
})();
