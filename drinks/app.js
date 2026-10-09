"use strict";

// Drinks: a log of what you drink, kept small.
//
// - One screen: the week as seven rows, one a day, each its standard drinks or
//   alcohol-free; above them the week's one number against your weekly limit.
//   Arrows (or a swipe) move a week at a time.
// - Tapping a day opens its sheet: what you had, your usual drinks as tiles
//   (one tap logs one, with Undo), "Something else…" for anything new, and,
//   on a day with nothing logged, Alcohol-free day.
// - Tapping the week's number opens Analysis: the last 7 days against the 7
//   before, or the last 4 weeks against the 4 before. The sums are calc.js's.
// - The log lives on this phone (allison-drinks-v1) and, signed in to your
//   family account, in that account too, private to you
//   (functions/drinks/api): it follows you to another phone, and Calendar can
//   show it. Until accounts are on, it stays on the phone.
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
  const KEY = 'allison-drinks-v1';
  const K = { graves: KEY + '-graves', sync: KEY + '-sync', period: KEY + '-period' };
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
  function save() { track(); persist(); scheduleSync(); }
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
    if (!$('anSheet').hidden) renderAnalysis();
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
      + '<button class="sum' + (over ? ' over' : '') + '" type="button" id="sumBtn" style="--i:1" aria-label="' + esc(f1(s.sd) + ' standard drinks' + (g.week ? ' of your ' + g.week + ' a week' : '') + '. ' + bits.join(', ') + '. Show Analysis') + '">'
      + '<span class="big"><b>' + f1(s.sd) + '</b><span>' + (g.week ? 'of ' + g.week + ' standard drinks' : 'standard drinks') + (over ? ', over your limit' : '') + '</span>' + ICON.chevR + '</span>'
      + (g.week ? '<span class="track" aria-hidden="true"><i style="width:' + pct.toFixed(1) + '%"></i></span>' : '')
      + '<span class="line">' + esc(bits.join(' · ')) + '</span></button>'
      + '<div class="rgroup week" style="--i:2">' + rows + '</div>';
  }
  function goWeek(n) { st.week = addDays(st.week, 7 * n); render(); animateIn(main); }
  main.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (a) { goWeek(a.dataset.act === 'prev' ? -1 : 1); return; }
    if (e.target.closest('#sumBtn')) { openAnalysis(); return; }
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
  // Analysis, in a sheet from the week's number: this window against the
  // one before (calc.js does the sums)
  // ---------------------------------------------------------------------
  const an = $('anBody');
  const PERIODS = { week: { days: 7, name: 'Week', before: 'the 7 days before' }, month: { days: 28, name: 'Month', before: 'the 4 weeks before' } };
  function openAnalysis() { renderAnalysis(); openSheet('anSheet'); slideSeg(); }
  function renderAnalysis() {
    const P = PERIODS[st.period], a = C.compare(data.entries, data.days, today(), P.days), r = a.range, n = a.now, b = a.before;
    const seg = '<div class="seg slides" role="radiogroup" aria-label="Compare">' + Object.entries(PERIODS).map(([k, p]) => '<button type="button" data-period="' + k + '" aria-pressed="' + (st.period === k) + '">' + p.name + '</button>').join('') + '</div>';
    const note = '<p class="anote">' + esc(short(r.from) + ' – ' + short(r.to) + ' against ' + short(r.beforeFrom) + ' – ' + short(r.beforeTo)) + '</p>';
    if (!a.hasNow && !a.hasBefore) {
      an.innerHTML = seg + note + '<div class="empty"><strong>Nothing to compare yet</strong>Log a few days, drinks or alcohol-free, and this fills in.</div>';
      slideSeg(); return;
    }
    // Four numbers, each against the window before. Fewer drinks is better; more alcohol-free days is better.
    const kpi = (label, now, before, lowerIsBetter) => {
      const has = now !== null, d = has && before !== null ? C.round(now - before, 1) : null;
      const dir = !a.hasBefore || d === null || d === 0 ? '' : (d < 0) === lowerIsBetter ? 'good' : 'bad';
      const delta = !a.hasBefore || d === null ? 'nothing before' : d === 0 ? 'same as before' : (d > 0 ? '↑ +' : '↓ −') + f1(Math.abs(d));
      const words = !a.hasBefore || d === null || !d ? delta : (d > 0 ? 'up ' : 'down ') + f1(Math.abs(d)) + ' on ' + P.before + (dir === 'good' ? ', better' : ', worse');
      return '<div class="kpi" aria-label="' + esc(label + ': ' + (has ? f1(now) : 'not known') + ', ' + words) + '"><span class="kl">' + esc(label) + '</span><span class="kv">' + (has ? f1(now) : '—') + '</span><span class="kd ' + dir + '">' + esc(delta) + '</span></div>';
    };
    const kpis = '<div class="kpis">'
      + kpi('Standard drinks', n.sd, b.sd, true)
      + kpi('Days you drank', n.drinkingDays, b.drinkingDays, true)
      + kpi('Alcohol-free days', n.afDays, b.afDays, false)
      + kpi('A day, on average', n.avg, b.avg, true) + '</div>';
    const k = C.streaks(data.entries, data.days, today());
    const rows = '<div class="xrow"><span class="xt">Alcohol-free in a row<small>Your best: ' + plural(k.best, 'day') + '</small></span><span class="xv">' + plural(k.current, 'day') + '</span></div>'
      + (n.heaviest ? '<div class="xrow"><span class="xt">Most in one day<small>' + esc(fmt(n.heaviest.date, { weekday: 'long', day: 'numeric', month: 'short' })) + '</small></span><span class="xv">' + f1(n.heaviest.sd) + '</span></div>' : '')
      + (n.notRecorded ? '<div class="xrow"><span class="xt">Days not logged<small>Left out of the average. Tap a day in the week to fill it in.</small></span><span class="xv">' + n.notRecorded + '</span></div>' : '');
    const cats = Object.entries(n.cats).sort((p, q) => q[1] - p[1]);
    const max = Math.max(0.1, ...cats.map(c => c[1]));
    const bars = cats.map(([c, v]) => '<div class="gbar" data-c="' + esc(c) + '" aria-label="' + esc(catName(c) + ': ' + f1(v) + ' standard drinks') + '"><span class="gn"><i class="cdot"></i>' + esc(catName(c)) + '</span><span class="gt"><span class="bar" style="width:' + (v / max * 72).toFixed(1) + '%"></span><span class="gv">' + f1(v) + '</span></span></div>').join('');
    an.innerHTML = seg + note + kpis
      + '<div class="rgroup">' + rows + '</div>'
      + (bars ? '<p class="label">By drink</p><div class="rgroup bars">' + bars + '</div>' : '')
      + '<p class="hint">In standard drinks: 14 g of alcohol each (the US measure), such as 12 oz of 5% beer or 1.5 oz of 40% spirits. The average counts the days you logged, drinks or alcohol-free.</p>';
    slideSeg();
  }
  const slideSeg = () => { const box = an.querySelector('.seg'); if (box && !$('anSheet').hidden && window.AllisonOS && AllisonOS.slide) AllisonOS.slide(box, box.querySelector('[aria-pressed="true"]'), 'seg:period'); };
  an.addEventListener('click', e => {
    const b = e.target.closest('[data-period]'); if (!b) return;
    st.period = b.dataset.period === 'month' ? 'month' : 'week'; ls.set(K.period, st.period);
    renderAnalysis();
  });
  window.addEventListener('resize', () => { const box = an.querySelector('.seg'); if (box && !$('anSheet').hidden && window.AllisonOS && AllisonOS.slide) AllisonOS.slide(box, box.querySelector('[aria-pressed="true"]'), 'seg:period', { jump: true }); });

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
      + '<button class="rowbtn" type="button" id="importBtn"><span class="ic">' + ICON.import + '</span><span>Bring in ABV Tracker history<span class="sub">Its JSON backup, or its Google Sheet’s Log tab downloaded as CSV</span></span></button>'
      + '<button class="rowbtn" type="button" id="exportBtn"><span class="ic">' + ICON.export + '</span><span>Export<span class="sub">Everything you’ve logged, as a spreadsheet (CSV)</span></span></button>'
      + '<button class="rowbtn danger" type="button" id="wipeBtn"><span class="ic">' + ICON.bin + '</span><span id="wipeTxt">Delete all data<span class="sub">From this phone and your account</span></span></button></div>';
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
      let r; try { r = await fetch('api/sync', { method: 'POST', headers, body: JSON.stringify(payload), cache: 'no-store' }); }
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
  load();
  render();
  animateIn(main);
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
  });
  window.addEventListener('online', () => sync(false));
  setTimeout(() => sync(false), 600);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // For the tests (drinks/scripts/app-test.mjs) only.
  window.__drinks = { st, data, render, openDay, sync, graves: () => graves, info: () => info, state: () => syncState, usual, openAnalysis };
})();
