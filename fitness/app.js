"use strict";

// Fitness: a workout log, kept small.
//
// - The week as seven rows, one a day, each showing the muscle groups worked
//   and how many exercises and sets; arrows (or a swipe) move a week at a
//   time, and the totals for the week sit underneath.
// - Tapping a day opens its sheet: what was logged that day, and the form to
//   add to it - a muscle group, then the exercise, then the weight, reps (or
//   seconds, for a hold such as a plank) and sets. The exercises are the
//   ones in the old Fitness Tracker Data sheet, checked against the gym's
//   equipment list and grouped so each list stays short; ones you used
//   lately come first, and any you type in are kept.
//   Choosing an exercise fills in what you did last time.
// - The log lives in this phone's storage (allison-fitness-v1). Calendar
//   reads it to show each workout as a layer, linking back here with
//   ?date=YYYY-MM-DD; and the week starts on the day Calendar's own setting
//   says, so the two agree.
// - Analysis: the last 7 days against the 7
//   before, or the last 4 weeks against the 4 before - totals, the
//   exercises getting stronger or weaker, and muscle groups missed or cut
//   back. The comparisons are analysis.js's. Week and Analysis are picked
//   from a Liquid Glass pill at the bottom of the screen, as in Home.
// - Optionally it syncs with a Google Sheet of your own through a small
//   Apps Script (google-sheet-sync.gs), the same design as Travel's: a
//   backup, a readable Workouts tab, and a second phone kept in step.
// - Signed in to the family account and logging in Drinks, Analysis also shows
//   your standard drinks and alcohol-free days over the same two windows,
//   read from your own Drinks log (drinks/api/summary; only you can read it).

// Refuse to run inside another page's frame (see Mail's app.js for why).
if (window.top !== window.self) {
  document.body.textContent = 'Fitness can’t be opened inside another page.';
  throw new Error('Fitness refuses to run inside a frame');
}

(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    json: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
  };
  const pad = n => String(n).padStart(2, '0');
  const OTHER = '__other__';   // the exercise list's "Other…": a name typed in
  const plural = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
  const KEY = 'allison-fitness-v1';
  const K = { version: KEY + '-version', graves: KEY + '-graves', sync: KEY + '-sync', syncAt: KEY + '-sync-at', view: KEY + '-view', period: KEY + '-period' };

  const ICON = {
    chevL: '<svg viewBox="0 0 24 24" class="b"><path d="M14.6 5.4L8.4 11.3a1 1 0 0 0 0 1.4l6.2 5.9"/></svg>',
    chevR: '<svg viewBox="0 0 24 24" class="b"><path d="M9.4 5.4l6.2 5.9a1 1 0 0 1 0 1.4l-6.2 5.9"/></svg>',
    close: '<svg viewBox="0 0 24 24" class="b"><path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"/></svg>',
    week: '<svg viewBox="0 0 24 24"><rect x="3.4" y="4.6" width="17.2" height="16" rx="3.2"/><path d="M3.4 9.6h17.2M8 2.8v3.6M16 2.8v3.6"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M4 19.6h16"/><path d="M4.6 15.4l4.6-4.8 3.6 3.2 6.6-7.2"/><path d="M15.4 6.6h4v4"/></svg>',
    glass: '<svg viewBox="0 0 24 24"><path d="M7.2 3.6h9.6c.4 3.8.3 6.2-.6 7.8-.9 1.6-2.4 2.6-4.2 2.6s-3.3-1-4.2-2.6c-.9-1.6-1-4-.6-7.8z"/><path d="M12 14v6.2M8.6 20.4h6.8"/></svg>',
    tick: '<svg viewBox="0 0 24 24" class="b"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>',
    up: '<svg viewBox="0 0 24 24" class="b"><path d="M12 19V5.6M6.4 11.2L12 5.6l5.6 5.6"/></svg>',
    down: '<svg viewBox="0 0 24 24" class="b"><path d="M12 5v13.4M6.4 12.8l5.6 5.6 5.6-5.6"/></svg>',
  };
  const lsDel = k => { try { localStorage.removeItem(k); } catch {} };

  // ---------------------------------------------------------------------
  // The muscle groups and their exercises: the list from the Fitness
  // Tracker Data sheet, checked against the gym's equipment. Its one ab
  // wheel exercise is left out (the gym lists no ab wheel); its lying and
  // seated leg curls, and standing and seated calf raises, are one each (the
  // gym lists one machine for each); and the gym's back extension and ab
  // machines are in, so Lower back and Core have enough. Each group is split
  // into short sections so a list is easy to scan.
  //   * usually done with your own bodyweight: weight starts at Bodyweight
  //   ~ a hold, timed in seconds instead of counted in reps
  // ---------------------------------------------------------------------
  const GROUPS = [
    { id: 'chest', name: 'Chest', sec: [
      ['Presses', ['Barbell Bench Press', 'Incline Barbell Bench Press', 'Decline Barbell Bench Press', 'Dumbbell Bench Press', 'Incline Dumbbell Press', 'Chest Press Machine']],
      ['Flys', ['Dumbbell Fly', 'Cable Fly', 'Pec Deck Machine']],
      ['Bodyweight', ['Push-Up*', 'Dip*']]] },
    { id: 'back', name: 'Back', sec: [
      ['Pulldowns and pull-ups', ['Lat Pulldown', 'Close-Grip Lat Pulldown', 'Pull-Up*', 'Chin-Up*']],
      ['Rows', ['Seated Cable Row', 'Machine Row', 'Barbell Row', 'Pendlay Row', 'One-Arm Dumbbell Row', 'T-Bar Row']]] },
    { id: 'lowerback', name: 'Lower back', sec: [
      ['', ['Deadlift', 'Romanian Deadlift', 'Sumo Deadlift', 'Hyperextension*', 'Back Extension Machine']]] },
    { id: 'shoulders', name: 'Shoulders', sec: [
      ['Presses', ['Overhead Barbell Press', 'Seated Dumbbell Shoulder Press', 'Shoulder Press Machine', 'Arnold Press']],
      ['Raises', ['Lateral Raise', 'Cable Lateral Raise', 'Front Raise', 'Upright Row']],
      ['Rear delts and traps', ['Rear Delt Fly', 'Face Pull', 'Shrug']]] },
    { id: 'arms', name: 'Arms', sec: [
      ['Biceps', ['Dumbbell Curl', 'Barbell Curl', 'EZ-Bar Curl', 'Hammer Curl', 'Incline Dumbbell Curl', 'Preacher Curl', 'Cable Curl', 'Concentration Curl']],
      ['Triceps', ['Triceps Pushdown', 'Rope Overhead Extension', 'Overhead Triceps Extension', 'Skull Crusher', 'Close-Grip Bench Press', 'Triceps Kickback', 'Bench Dip*']]] },
    { id: 'core', name: 'Core', sec: [
      ['', ['Plank~', 'Side Plank~', 'Hanging Leg Raise*', 'Cable Crunch', 'Ab Crunch Machine', 'Russian Twist*', 'Sit-Up*']]] },
    { id: 'legs', name: 'Legs', sec: [
      ['Quads', ['Barbell Back Squat', 'Barbell Front Squat', 'Goblet Squat', 'Leg Press', 'Hack Squat', 'Bulgarian Split Squat', 'Walking Lunge', 'Leg Extension']],
      ['Hamstrings', ['Romanian Deadlift', 'Leg Curl']],
      ['Calves and inner thigh', ['Calf Raise', 'Hip Adduction Machine']]] },
    { id: 'glutes', name: 'Glutes', sec: [
      ['', ['Hip Thrust', 'Glute Bridge*', 'Cable Kickback', 'Hip Abduction Machine']]] },
    // The gym's cardio equipment (the GymEquipment tab): logged by time, and
    // distance if you like, instead of weight, reps and sets.
    { id: 'cardio', name: 'Cardio', sec: [
      ['Machines', ['Treadmill', 'Elliptical', 'Stair Climber', 'Rowing Machine', 'ARC Trainer', 'Adaptive Motion Trainer', 'Seated Elliptical']],
      ['Bikes', ['Upright Bike', 'Recumbent Bike', 'Spin Bike']],
      ['Track and pool', ['Indoor Track', 'Swimming']]] },
  ];
  const BODYWEIGHT = new Set(), TIMED = new Set();
  for (const g of GROUPS) {
    g.sec = g.sec.map(([label, list]) => [label, list.map(e => {
      const k = e.replace(/[*~]$/, '').toLowerCase();
      if (/[*~]$/.test(e)) BODYWEIGHT.add(k);
      if (e.endsWith('~')) TIMED.add(k);
      return e.replace(/[*~]$/, '');
    })]);
    g.ex = [...new Set(g.sec.flatMap(([, list]) => list))];
  }
  const GROUP = Object.fromEntries(GROUPS.map(g => [g.id, g]));
  const groupName = id => GROUP[id] ? GROUP[id].name : 'Other';
  const isTimed = name => TIMED.has(String(name).toLowerCase());
  // Cardio: minutes, and a distance in the unit the machine shows - metres
  // on the rower, yards in the pool, miles on everything else.
  const isCardio = gid => gid === 'cardio';
  const unitFor = name => /rowing|rower/i.test(name) ? 'm' : /swim/i.test(name) ? 'yd' : 'mi';
  const MINS = [];
  for (let m = 1; m <= 60; m++) MINS.push(m);
  for (let m = 65; m <= 180; m += 5) MINS.push(m);
  const DIST = { mi: [], m: [], yd: [] };
  for (let d = 0.25; d <= 10; d += 0.25) DIST.mi.push(+d.toFixed(2));
  for (let d = 10.5; d <= 30; d += 0.5) DIST.mi.push(d);
  for (let d = 250; d <= 10000; d += 250) DIST.m.push(d);
  for (let d = 50; d <= 3000; d += 50) DIST.yd.push(d);
  const fmtDist = (d, u) => (+d).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + u;
  const fmtMins = n => n < 60 ? n + ' min' : Math.floor(n / 60) + ' h' + (n % 60 ? ' ' + n % 60 + ' min' : '');

  // Weights in pounds: 2.5 lb steps to 100, then 5 lb steps to 500. 0 is
  // bodyweight. Reps 1-50, sets 1-10.
  const WEIGHTS = [0];
  for (let w = 2.5; w <= 100; w += 2.5) WEIGHTS.push(w);
  for (let w = 105; w <= 500; w += 5) WEIGHTS.push(w);
  // A hold is timed instead: 10 seconds to 5 minutes.
  const REPS = Array.from({ length: 50 }, (_, i) => i + 1);
  const SECS = [10, 15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
  const SETS = Array.from({ length: 10 }, (_, i) => i + 1);
  const fmtW = w => +w === 0 ? 'Bodyweight' : (+w).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' lb';
  const fmtSecs = n => n < 60 ? n + ' s' : Math.floor(n / 60) + ' min' + (n % 60 ? ' ' + n % 60 + ' s' : '');
  const fmtLine = x => x.cardio ? fmtMins(+x.mins) + (+x.dist > 0 ? ' · ' + fmtDist(x.dist, x.unit || 'mi') : '')
    : x.sets + ' × ' + (x.timed ? fmtSecs(+x.reps) : x.reps) + ' · ' + fmtW(x.weight);

  // ---------------------------------------------------------------------
  // Data: { v: 2, logs: [{id, date, group, exercise, weight, reps, sets,
  // timed, updated}], exercises: [{id, group, name, updated}] } - the second
  // is the exercises you typed in yourself. 'updated' is stamped on any
  // change, and anything deleted leaves a grave (kind:id -> when), so a
  // Google Sheet sync can tell newer from older and gone from not yet seen.
  // ---------------------------------------------------------------------
  const data = { logs: [], exercises: [] };
  let graves = {};
  const okLog = x => x && typeof x.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') && typeof x.exercise === 'string' && x.exercise.trim() && typeof x.group === 'string';
  const okEx = x => x && typeof x.id === 'string' && typeof x.name === 'string' && x.name.trim() && typeof x.group === 'string';
  function load() {
    const d = ls.json(KEY, null) || {};
    data.logs = Array.isArray(d.logs) ? d.logs.filter(okLog) : [];
    data.exercises = Array.isArray(d.exercises) ? d.exercises.filter(okEx) : [];
    const g = ls.json(K.graves, {}); graves = g && typeof g === 'object' && !Array.isArray(g) ? g : {};
    initShadow();
  }
  // What each item looked like at the last save (as in Travel).
  const shadow = new Map();
  const kinds = () => [['logs', data.logs], ['exercises', data.exercises]];
  function initShadow() {
    shadow.clear();
    kinds().forEach(([kind, arr]) => arr.forEach(it => {
      if (!it.updated) it.updated = 1;
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
  let storeWarned = false;
  function persist() {
    const ok = ls.set(KEY, JSON.stringify({ v: 2, logs: data.logs, exercises: data.exercises })) && ls.set(K.graves, JSON.stringify(graves));
    if (!ok && !storeWarned) { storeWarned = true; toast('This phone couldn’t save Fitness: storage is full.' + (syncCfg ? ' Your log is safe in the Google Sheet.' : '')); }
    shareCal();
  }
  // Calendar's Fitness layer: the last 400 days of your log, just what Calendar shows,
  // kept in your own family account (home/welcome.js AllisonOS.layer), since Calendar
  // can't read this app's storage on an iPhone.
  function shareCal() {
    const L = window.AllisonOS && AllisonOS.layer; if (!L) return;
    const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
    L.share('fitness', { logs: data.logs.filter(x => x && x.date >= since).map(x => ({ date: x.date, exercise: String(x.exercise || '').slice(0, 80), group: x.group, cardio: !!x.cardio, sets: x.sets, reps: x.reps, timed: !!x.timed, weight: x.weight, mins: x.mins, dist: x.dist, unit: x.unit })) });
  }
  addEventListener('load', () => { if (ls.get(KEY, null)) shareCal(); });
  function save() { track(); persist(); if (syncCfg) scheduleSync(); }
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const logsOn = day => data.logs.filter(x => x.date === day);
  // Your own exercises in a group, not already in its list.
  const mineIn = gid => { const base = GROUP[gid] ? GROUP[gid].ex.map(n => n.toLowerCase()) : []; return data.exercises.filter(x => x.group === gid && !base.includes(x.name.toLowerCase())).map(x => x.name); };
  const exercisesFor = gid => (GROUP[gid] ? GROUP[gid].ex : []).concat(mineIn(gid));
  // The last few exercises done in a group, newest first.
  function recentIn(gid, n) {
    const seen = new Set(), out = [];
    const list = data.logs.filter(x => x.group === gid).sort((a, b) => b.date.localeCompare(a.date) || (b.updated || 0) - (a.updated || 0));
    for (const x of list) { const k = x.exercise.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(x.exercise); if (out.length === n) break; } }
    return out;
  }
  // The last time an exercise was done, before a day (or on it, earlier).
  function lastOf(name, beforeDay, skipId) {
    const n = name.toLowerCase();
    let best = null;
    for (const x of data.logs) {
      if (x.id === skipId || x.exercise.toLowerCase() !== n || x.date > beforeDay) continue;
      if (!best || x.date > best.date || (x.date === best.date && (x.updated || 0) > (best.updated || 0))) best = x;
    }
    return best;
  }

  // ---------------------------------------------------------------------
  // Dates: 'YYYY-MM-DD' strings in the phone's zone.
  // ---------------------------------------------------------------------
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const noon = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), 12);
  const today = () => ymd(new Date());
  const addDays = (s, n) => { const d = noon(s); d.setDate(d.getDate() + n); return ymd(d); };
  // Monday, unless Calendar has been set to start its weeks on Sunday.
  const weekStartsSunday = () => { const c = ls.json('allison-calendar-v1-settings', {}); return !(c.weekStart === 1 && c.weekStartPicked); };   // Sunday, unless Monday was picked in Calendar
  const weekStartOf = s => { const wd = noon(s).getDay(); return addDays(s, -(weekStartsSunday() ? wd : (wd + 6) % 7)); };
  const fmt = (s, o) => noon(s).toLocaleDateString('en-US', o);
  const sameYear = s => s.slice(0, 4) === today().slice(0, 4);

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const st = { week: weekStartOf(today()), day: null, form: null, view: ls.get(K.view, 'week') === 'analysis' ? 'analysis' : 'week', period: ls.get(K.period, 'week') === 'month' ? 'month' : 'week' };
  const blankForm = () => ({ editing: null, group: null, exercise: '', other: '', weight: '', reps: 10, sets: 3, timed: false, q: '', mins: 20, dist: '' });

  // ---------------------------------------------------------------------
  // The week
  // ---------------------------------------------------------------------
  const main = $('main');
  function render() {
    const v = VIEWS.find(x => x.id === st.view);
    $('viewName').textContent = v.name;
    if ($('vbIcon').dataset.v !== v.icon) { $('vbIcon').dataset.v = v.icon; $('vbIcon').innerHTML = ICON[v.icon]; }
    if (!$('viewMenu').hidden) drawViewMenu();
    if (st.view === 'analysis') renderAnalysis(); else renderWeek();
  }
  function renderWeek() {
    const ws = st.week, we = addDays(ws, 6), tod = today();
    const thisWeek = ws === weekStartOf(tod);
    const rel = thisWeek ? 'This week' : ws === weekStartOf(addDays(tod, -7)) ? 'Last week' : ws === weekStartOf(addDays(tod, 7)) ? 'Next week' : '';
    const label = (rel ? rel + ' · ' : '') + fmt(ws, { day: 'numeric', month: 'short' }) + ' – ' + fmt(we, { day: 'numeric', month: 'short', year: sameYear(we) ? undefined : 'numeric' });
    let rows = '', days = 0, exCount = 0, sets = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i), logs = logsOn(d);
      const groups = [...new Set(logs.map(x => x.group))];
      const n = logs.reduce((a, x) => a + (+x.sets || 0), 0);
      if (logs.length) { days++; exCount += logs.length; sets += n; }
      const sum = logs.length
        ? '<span class="tmeta">' + groups.map(g => '<span class="tchip" data-g="' + esc(GROUP[g] ? g : 'other') + '">' + esc(groupName(g)) + '</span>').join('') + '</span><span class="dline">' + dayLine(logs) + '</span>'
        : '<span class="rest">' + (d < tod ? 'Rest day' : d === tod ? 'Nothing logged yet' : '') + '</span>';
      rows += '<button class="drow' + (d === tod ? ' today' : '') + (logs.length ? ' has' : '') + '" type="button" data-day="' + d + '" aria-label="' + esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }) + (logs.length ? ', ' + plural(logs.length, 'exercise') : '') + (drinks.days[d] && typeof drinks.days[d].sd === 'number' ? ', ' + f1(drinks.days[d].sd) + ' standard drinks' : '')) + '">'
        + '<span class="dn"><small>' + esc(fmt(d, { weekday: 'short' })) + '</small><b>' + +d.slice(8) + '</b></span><span class="dsum">' + sum + '</span>' + drinkTag(d) + ICON.chevR + '</button>';
    }
    $('todayBtn').hidden = thisWeek;
    loadDrinks(ws, we);
    main.innerHTML = '<div class="navrow" style="--i:0"><button class="iconbtn glass" type="button" data-act="prev" aria-label="Previous week">' + ICON.chevL + '</button><span class="lbl">' + esc(label) + '</span><button class="iconbtn glass" type="button" data-act="next" aria-label="Next week">' + ICON.chevR + '</button></div>'
      + '<div class="rgroup week" style="--i:1">' + rows + '</div>'
      + '<p class="sechead">' + (thisWeek ? 'This week' : 'That week') + '</p>'
      + '<div class="stats" style="--i:2"><div class="stat"><b>' + days + '</b><span>' + (days === 1 ? 'day' : 'days') + ' trained</span></div><div class="stat"><b>' + exCount + '</b><span>' + (exCount === 1 ? 'exercise' : 'exercises') + '</span></div><div class="stat"><b>' + sets + '</b><span>' + (sets === 1 ? 'set' : 'sets') + '</span></div></div>';
  }
  // "3 exercises · 9 sets · 20 min cardio"
  function dayLine(logs) {
    const lift = logs.filter(x => !x.cardio), mins = logs.reduce((a, x) => a + (x.cardio ? +x.mins || 0 : 0), 0);
    const sets = lift.reduce((a, x) => a + (+x.sets || 0), 0);
    return [lift.length ? plural(lift.length, 'exercise') + ' · ' + plural(sets, 'set') : '', mins ? fmtMins(mins) + ' cardio' : ''].filter(Boolean).join(' · ');
  }
  // A day you drank on (from Drinks): a small glass and its standard drinks.
  const f1 = n => (Math.round(n * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
  function drinkTag(d) {
    const x = drinks.days[d];
    return x && typeof x.sd === 'number' ? '<span class="drk" title="Standard drinks, from Drinks">' + ICON.glass + f1(x.sd) + '</span>' : '';
  }
  function goWeek(n) { st.week = addDays(st.week, 7 * n); render(); animateIn(main); }
  main.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (a) { goWeek(a.dataset.act === 'prev' ? -1 : 1); return; }
    const d = e.target.closest('[data-day]');
    if (d) openDay(d.dataset.day);
  });
  // A sideways swipe on the week moves a week, as the month grid does in Calendar.
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
  // The view picker: a glass pill at the bottom, as Home's; Week or Analysis
  // ---------------------------------------------------------------------
  const VIEWS = [
    { id: 'week', name: 'Week', icon: 'week', sum: () => { const n = new Set(data.logs.filter(x => x.date >= weekStartOf(today()) && x.date <= today()).map(x => x.date)).size; return n ? plural(n, 'day') + ' trained this week' : 'Log each day’s workout'; } },
    { id: 'analysis', name: 'Analysis', icon: 'chart', sum: () => { const a = analysisNow(); return a.hasNow || a.hasBefore ? 'Improving ' + a.up.length + ' · needs work ' + (a.down.length + a.missed.length + a.dropped.length + (a.cardioMissed ? 1 : 0)) : 'Where you’re improving, and what needs work'; } },
  ];
  function drawViewMenu() {
    $('viewMenu').innerHTML = VIEWS.map(v => '<button type="button" role="option" data-view="' + v.id + '" aria-selected="' + (v.id === st.view) + '"><span class="ic">' + ICON[v.icon] + '</span><span class="k">' + esc(v.name) + '<small>' + esc(v.sum()) + '</small></span><span class="tick">' + ICON.tick + '</span></button>').join('');
  }
  function closeViewMenu() { $('viewMenu').hidden = true; $('viewBtn').setAttribute('aria-expanded', 'false'); }
  $('viewBtn').addEventListener('click', e => {
    e.stopPropagation();
    if (!$('viewMenu').hidden) return closeViewMenu();
    drawViewMenu(); $('viewMenu').hidden = false; $('viewBtn').setAttribute('aria-expanded', 'true');
  });
  $('viewMenu').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
  document.addEventListener('click', e => { if (!$('viewMenu').hidden && !e.target.closest('#viewMenu, #viewBtn')) closeViewMenu(); });
  function setView(v) {
    st.view = v === 'analysis' ? 'analysis' : 'week'; ls.set(K.view, st.view);
    closeViewMenu(); render(); animateIn(main); window.scrollTo({ top: 0 });
  }

  // ---------------------------------------------------------------------
  // Analysis: this window against the one before (analysis.js does the sums)
  // ---------------------------------------------------------------------
  const A = window.FitnessAnalysis;
  const PERIODS = { week: { days: 7, name: 'Week', words: 'the last 7 days', before: 'the 7 before' }, month: { days: 28, name: 'Month', words: 'the last 4 weeks', before: 'the 4 weeks before' } };
  const analysisNow = () => A.analyze(data.logs, today(), PERIODS[st.period].days, GROUPS.filter(g => !isCardio(g.id)).map(g => g.id));
  const compact = n => n >= 1000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K' : n.toLocaleString('en-US');
  const short = s => fmt(s, { day: 'numeric', month: 'short' });
  // One entry, as you'd say it: 100 lb × 6, 12 reps, 45 s.
  const said = x => x.cardio ? fmtLine(x) : x.timed ? fmtSecs(+x.reps) : +x.weight > 0 ? fmtW(x.weight) + ' × ' + x.reps : x.reps + ' reps';
  function renderAnalysis() {
    $('todayBtn').hidden = true;
    const P = PERIODS[st.period], a = analysisNow(), r = a.range;
    const seg = '<div class="seg two small slides" role="radiogroup" aria-label="Compare" style="--i:0">' + Object.entries(PERIODS).map(([k, p]) => '<button type="button" data-period="' + k + '" aria-pressed="' + (st.period === k) + '">' + p.name + '</button>').join('') + '</div>';
    const note = '<p class="anote">' + esc(short(r.from) + ' – ' + short(r.to) + ' against ' + short(r.beforeFrom) + ' – ' + short(r.beforeTo)) + '</p>';
    if (!a.hasNow && !a.hasBefore) {
      main.innerHTML = seg + note + '<div class="empty" style="--i:1"><strong>Nothing to compare yet</strong>Log a few workouts and this fills in: where you’re getting stronger, and what needs work.</div>';
      slideSeg(); return;
    }
    // Totals, each with its change against the window before.
    const LBL = { workouts: 'Days trained', sets: 'Sets', volume: 'Volume (lb)', cardio: 'Cardio (min)' };
    const kpis = '<div class="kpis" style="--i:1">' + a.totals.map(t => {
      const d = t.now - t.before, dir = !a.hasBefore || d === 0 ? '' : d > 0 ? 'up' : 'down';
      const delta = !a.hasBefore ? 'nothing before' : d === 0 ? 'same as before' : (d > 0 ? '+' : '−') + compact(Math.abs(d));
      const said = !a.hasBefore || !d ? delta : (d > 0 ? 'up ' : 'down ') + Math.abs(d).toLocaleString('en-US') + (t.before ? ', ' + Math.round(Math.abs(d) / t.before * 100) + '%' : '') + ' on ' + P.before;
      return '<div class="kpi" aria-label="' + esc(LBL[t.id] + ': ' + t.now.toLocaleString('en-US') + ', ' + said) + '"><span class="kl">' + LBL[t.id] + '</span><span class="kv">' + (t.now >= 100000 ? compact(t.now) : t.now.toLocaleString('en-US')) + '</span><span class="kd ' + dir + '">' + (dir ? (dir === 'up' ? '↑ ' : '↓ ') : '') + esc(delta) + '</span></div>';
    }).join('') + '</div>';
    const g = id => GROUP[id] ? id : 'other';
    const was = x => x.was ? 'was ' + said(x.was) + (x.when === 'earlier' ? ' on ' + short(x.was.date) : '') : '';
    const pct = x => Math.max(1, Math.round(Math.abs(x.change) * 100)) + '%';
    const exRow = (x, dir) => '<div class="xrow" data-g="' + g(x.group) + '"><i></i><span class="xt">' + esc(x.name) + '<small>' + esc(said(x.now) + ' · ' + was(x)) + '</small></span><span class="chg ' + dir + '" aria-label="' + (dir === 'up' ? 'up ' : 'down ') + pct(x) + '">' + ICON[dir] + pct(x) + '</span></div>';
    const grpRow = (gr, words) => '<div class="xrow" data-g="' + gr.id + '"><i></i><span class="xt">' + esc(groupName(gr.id)) + '<small>' + esc(words) + '</small></span><span class="chg down" aria-label="down">' + ICON.down + '</span></div>';
    const improving = a.up.map(x => exRow(x, 'up')).join('');
    const work = a.down.map(x => exRow(x, 'down')).join('')
      + a.missed.map(gr => grpRow(gr, 'Not trained in ' + P.words + ' (' + plural(gr.before, 'set') + ' in ' + P.before + ')')).join('')
      + a.dropped.map(gr => grpRow(gr, plural(gr.now, 'set') + ', down from ' + gr.before)).join('')
      + (a.cardioMissed ? grpRow({ id: 'cardio' }, 'None in ' + P.words + ' (' + fmtMins(a.cardioMissed.before) + ' in ' + P.before + ')') : '');
    const quiet = (title, list) => list.length ? '<div class="xrow quiet"><span class="xt">' + esc(title) + '<small>' + esc(list.map(x => x.name).join(', ')) + '</small></span></div>' : '';
    // Sets by muscle group: one colour, scaled to the biggest of either window.
    const max = Math.max(1, ...a.groups.map(x => Math.max(x.now, x.before)));
    const bars = a.groups.map(x => {
      const d = x.now - x.before;
      return '<div class="gbar" data-g="' + x.id + '" aria-label="' + esc(groupName(x.id) + ': ' + plural(x.now, 'set') + ', ' + x.before + ' before') + '"><span class="gn"><i></i>' + esc(groupName(x.id)) + '</span><span class="track"><span class="bar' + (x.now ? '' : ' zero') + '" style="width:' + (x.now / max * 72).toFixed(1) + '%"></span><span class="gv">' + x.now + (a.hasBefore && d ? ' <small>' + (d > 0 ? '+' : '−') + Math.abs(d) + '</small>' : '') + '</span></span></div>';
    }).join('');
    loadDrinks(r.beforeFrom, r.to);
    main.innerHTML = seg + note + kpis
      + '<p class="sechead" style="--i:2">Improving</p><div class="rgroup" id="anUp" style="--i:2">' + (improving || '<div class="dempty">' + (a.hasNow ? 'Nothing stronger than before yet. Keep at it.' : 'Nothing logged in ' + P.words + '.') + '</div>') + quiet('New', a.fresh) + '</div>'
      + '<p class="sechead" style="--i:3">Needs work</p><div class="rgroup" id="anWork" style="--i:3">' + (work || '<div class="dempty">' + (a.hasBefore ? 'Nothing has slipped. Nice.' : 'Nothing logged in ' + P.before + ' to compare with.') + '</div>') + quiet('Holding steady', a.same) + '</div>'
      + '<p class="sechead" style="--i:4">Sets by muscle group<span>' + (a.hasBefore ? 'change vs before' : '') + '</span></p><div class="rgroup bars" id="anGroups" style="--i:4">' + bars + '</div>'
      + drinksHtml(r, P)
      + '<p class="hint">Strength is compared by estimated one-rep max (weight × (1 + reps ÷ 30)), so a heavier weight for fewer reps can still count as stronger. Bodyweight moves are compared by reps, holds by time, and cardio by speed (distance ÷ time) when you log a distance, otherwise by minutes. Volume counts weighted sets only.</p>';
    slideSeg();
  }
  // Drinks, beside your training: your own standard drinks and alcohol-free
  // days in the same two windows, from your Drinks log in your family account
  // (functions/drinks/api). Only with a session already on this phone: it
  // never asks you to sign in, and shows nothing until there is something to show.
  // Each range asked for is kept for 5 minutes; the days merge into one map.
  const drinks = { days: {}, got: new Map() };
  const drinksFor = (from, to) => drinks.got.has(from + '|' + to);
  async function loadDrinks(from, to) {
    const acct = window.AllisonOS && window.AllisonOS.account, tok = acct && acct.token();
    const key = from + '|' + to, got = drinks.got.get(key);
    if (!tok || (got !== undefined && Date.now() - got < 5 * 60e3)) return;
    drinks.got.set(key, Date.now());
    try {
      const r = await fetch('../drinks/api/summary?from=' + from + '&to=' + to, { headers: { 'X-Drinks': '1', Authorization: 'Bearer ' + tok }, cache: 'no-store' });
      if (!r.ok) { drinks.got.delete(key); return; }
      const days = (await r.json()).days || {};
      for (const d of Object.keys(drinks.days)) if (d >= from && d <= to) delete drinks.days[d];
      Object.assign(drinks.days, days);
    } catch { drinks.got.delete(key); return; }
    if (!st.day) render();
  }
  function drinksHtml(r, P) {
    if (!drinksFor(r.beforeFrom, r.to)) return '';
    const sum = (from, to) => { let sd = 0, af = 0; for (const [d, x] of Object.entries(drinks.days)) if (d >= from && d <= to) { if (typeof x.sd === 'number') sd += x.sd; else if (x.status === 'af') af++; } return { sd: Math.round(sd * 10) / 10, af }; };
    const now = sum(r.from, r.to), before = sum(r.beforeFrom, r.beforeTo);
    if (!now.sd && !now.af && !before.sd && !before.af) return '';
    return '<p class="sechead" style="--i:5">Drinks<span>from Drinks</span></p><div class="rgroup" id="anDrinks" style="--i:5">'
      + '<div class="xrow"><span class="xt">Standard drinks<small>' + f1(before.sd) + ' in ' + P.before + '</small></span><span class="chg">' + f1(now.sd) + '</span></div>'
      + '<div class="xrow"><span class="xt">Alcohol-free days<small>' + before.af + ' in ' + P.before + '</small></span><span class="chg">' + now.af + '</span></div>'
      + '<a class="xrow" href="../drinks/"><span class="xt">Open Drinks</span>' + ICON.chevR + '</a></div>';
  }
  const slideSeg = () => { const box = main.querySelector('.seg'); if (box) window.AllisonOS.slide(box, box.querySelector('[aria-pressed="true"]'), 'seg:period'); };
  main.addEventListener('click', e => {
    const b = e.target.closest('[data-period]'); if (!b) return;
    st.period = b.dataset.period === 'month' ? 'month' : 'week'; ls.set(K.period, st.period);
    render();
  });
  window.addEventListener('resize', () => { const box = main.querySelector('.seg'); if (box) window.AllisonOS.slide(box, box.querySelector('[aria-pressed="true"]'), 'seg:period', { jump: true }); });

  // ---------------------------------------------------------------------
  // A day: what was done, and the form
  // ---------------------------------------------------------------------
  function openDay(day) {
    st.day = day; st.form = blankForm();
    $('dayLbl').textContent = day === today() ? 'Today · ' + fmt(day, { weekday: 'long' }) : fmt(day, { weekday: 'long', day: 'numeric', month: 'long', year: sameYear(day) ? undefined : 'numeric' });
    renderDay();
    if ($('daySheet').hidden) openSheet('daySheet');
  }
  const opts = (list, val, label) => list.map(v => '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(label ? label(v) : v) + '</option>').join('');
  function renderDay() {
    const day = st.day, f = st.form, logs = logsOn(day);
    const list = logs.length
      ? logs.map(x => '<div class="erow' + (f.editing === x.id ? ' editing' : '') + '" data-g="' + esc(GROUP[x.group] ? x.group : 'other') + '"><button class="ebody" type="button" data-edit="' + esc(x.id) + '" aria-label="Edit ' + esc(x.exercise) + '"><i></i><span class="et">' + esc(x.exercise) + '<small>' + esc(groupName(x.group)) + ' · ' + esc(fmtLine(x)) + '</small></span></button>'
        + '<button class="iconbtn del" type="button" data-del="' + esc(x.id) + '" aria-label="Delete ' + esc(x.exercise) + '">' + ICON.close + '</button></div>').join('')
      : '<div class="dempty">Nothing logged ' + (day === today() ? 'today' : 'this day') + ' yet.</div>';
    $('dayBody').innerHTML = '<p class="label">Done</p><div class="rgroup" id="fxList">' + list + '</div>'
      + '<p class="label">' + (f.editing ? 'Change exercise' : 'Add an exercise') + '</p>'
      + '<div class="search" role="search"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="7.2"/><path d="M16.2 16.2l4.3 4.3"/></svg>'
      + '<input type="search" id="fxSearch" placeholder="Search all exercises" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" aria-label="Search all exercises" aria-controls="fxPick" value="' + esc(f.q) + '">'
      + '<button class="clear" type="button" id="fxSearchClear" aria-label="Clear search"' + (f.q ? '' : ' hidden') + '>' + ICON.close + '</button></div>'
      + '<div class="field" id="fxPick">' + pickHtml() + '</div>';
  }
  // Under the search bar: the results while searching, else the muscle
  // groups and the form.
  function pickHtml() {
    const day = st.day, f = st.form;
    if (f.q.trim()) return searchHtml(f.q);
    const groups = '<div class="opts" role="radiogroup" aria-label="Muscle group">' + GROUPS.map(g => '<button class="opt" type="button" role="radio" data-g="' + g.id + '" data-group="' + g.id + '" aria-checked="' + (f.group === g.id) + '"><span class="gd"></span>' + esc(g.name) + '</button>').join('') + '</div>';
    let form = '';
    if (f.group) {
      const isOther = f.exercise === OTHER;
      form += '<div class="rgroup"><div class="frow"><label for="fxEx">Exercise</label><select id="fxEx">' + exerciseOptions(f.group, f.exercise) + '</select></div>'
        + (isOther ? '<div class="frow"><input class="txt" id="fxOther" type="text" maxlength="60" placeholder="Name of the exercise" autocomplete="off" aria-label="Name of the exercise" value="' + esc(f.other) + '"></div>' : '');
      if (formName(f) && isCardio(f.group)) {
        const u = unitFor(formName(f)), ds = DIST[u].includes(+f.dist) || f.dist === '' ? DIST[u] : DIST[u].concat(+f.dist).sort((a, b) => a - b);
        form += '<div class="frow"><label for="fxM">Time</label><select id="fxM">' + opts(MINS.includes(+f.mins) ? MINS : MINS.concat(+f.mins).sort((a, b) => a - b), f.mins, fmtMins) + '</select></div>'
          + '<div class="frow"><label for="fxD">Distance <small>optional</small></label><select id="fxD"><option value=""' + (f.dist === '' ? ' selected' : '') + '>—</option>' + opts(ds, f.dist, d => fmtDist(d, u)) + '</select></div>';
      } else if (formName(f)) {
        const ws = WEIGHTS.slice(); if (f.weight !== '' && !ws.includes(+f.weight)) ws.push(+f.weight), ws.sort((a, b) => a - b);
        form += '<div class="frow"><label for="fxW">Weight</label><select id="fxW">' + (f.weight === '' ? '<option value="" selected disabled>Choose…</option>' : '') + opts(ws, f.weight, fmtW) + '</select></div>'
          + (f.timed ? '<div class="frow"><label for="fxR">Time</label><select id="fxR">' + opts(SECS.includes(+f.reps) ? SECS : SECS.concat(+f.reps).sort((a, b) => a - b), f.reps, fmtSecs) + '</select></div>'
            : '<div class="frow"><label for="fxR">Reps</label><select id="fxR">' + opts(REPS.includes(+f.reps) ? REPS : REPS.concat(+f.reps).sort((a, b) => a - b), f.reps) + '</select></div>')
          + '<div class="frow"><label for="fxS">Sets</label><select id="fxS">' + opts(SETS, f.sets) + '</select></div>';
      }
      form += '</div>';
      const name = isOther ? f.other.trim() : f.exercise;
      const last = name && lastOf(name, day, f.editing);
      if (last) form += '<p class="hint">Last time, ' + esc(fmt(last.date, { weekday: 'short', day: 'numeric', month: 'short', year: sameYear(last.date) ? undefined : 'numeric' })) + ': ' + esc(fmtLine(last)) + '</p>';
    } else form += '<p class="hint">' + (f.exercise === OTHER && f.other ? 'Now pick the muscle group for ' + esc(f.other) + '.' : 'Search, or pick a muscle group and then the exercise.') + '</p>';
    form += '<div class="formbtns">' + (f.editing ? '<button class="btn quiet" type="button" id="fxCancel">Cancel</button>' : '')
      + '<button class="btn" type="button" id="fxAdd"' + (formReady() ? '' : ' disabled') + '>' + (f.editing ? 'Save changes' : 'Add to ' + esc(day === today() ? 'today' : fmt(day, { weekday: 'long' }))) + '</button></div>';
    return groups + form;
  }

  // ---------------------------------------------------------------------
  // Search: every exercise in every group, and your own. Each word typed
  // must start a word of the name (or its group's), in any order, so "db
  // curl" finds Dumbbell Curl and "raise" every raise; db, bb and ez stand
  // for dumbbell, barbell and EZ-bar. Names that start with what you typed,
  // then ones you've done, come first.
  // ---------------------------------------------------------------------
  const ALIAS = { db: 'dumbbell', bb: 'barbell', ez: 'ez-bar', ohp: 'overhead', rdl: 'romanian', rower: 'rowing', erg: 'rowing', stairmaster: 'stair', amt: 'adaptive', arc: 'arc' };
  // Other words a cardio machine goes by, so "run" or "cycle" finds it.
  const ALSO = { 'treadmill': 'run walk jog', 'indoor track': 'run walk jog', 'swimming': 'pool laps swim', 'upright bike': 'cycle cycling', 'recumbent bike': 'cycle cycling', 'spin bike': 'cycle cycling spinning', 'stair climber': 'stairs steps', 'rowing machine': 'row' };
  const words = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  function allExercises() {
    const out = new Map();   // one entry a name; Romanian Deadlift is in two groups, so keep where you last logged it
    const add = (name, group) => { const k = name.toLowerCase(); if (!out.has(k)) out.set(k, { name, group }); };
    for (const x of [...data.logs].sort((a, b) => b.date.localeCompare(a.date))) if (GROUP[x.group]) add(x.exercise, x.group);
    for (const g of GROUPS) for (const n of g.ex) add(n, g.id);
    for (const x of data.exercises) if (GROUP[x.group]) add(x.name, x.group);
    return [...out.values()];
  }
  function searchExercises(q) {
    const qs = words(q).map(w => ALIAS[w] || w);
    if (!qs.length) return [];
    const done = new Set(data.logs.map(x => x.exercise.toLowerCase()));
    const ql = String(q).trim().toLowerCase();
    return allExercises().map(x => {
      const ws = words(x.name + ' ' + groupName(x.group) + ' ' + (ALSO[x.name.toLowerCase()] || ''));
      if (!qs.every(w => ws.some(v => v.startsWith(w) || (w.length > 3 && v.includes(w))))) return null;
      const rank = (x.name.toLowerCase().startsWith(ql) ? 0 : 2) + (done.has(x.name.toLowerCase()) ? 0 : 1);
      return Object.assign({ rank }, x);
    }).filter(Boolean).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).slice(0, 12);
  }
  function searchHtml(q) {
    const hits = searchExercises(q), t = q.trim().replace(/\s+/g, ' ').slice(0, 60);
    const rows = hits.map(x => {
      const last = lastOf(x.name, st.day, st.form.editing);
      return '<button class="srow" type="button" data-pick="' + esc(x.name) + '" data-pg="' + x.group + '" data-g="' + x.group + '"><i></i><span class="st">' + esc(x.name)
        + '<small>' + esc(groupName(x.group)) + (last ? ' · last ' + esc(fmtLine(last)) : '') + '</small></span>' + ICON.chevR + '</button>';
    }).join('');
    const known = hits.some(x => x.name.toLowerCase() === t.toLowerCase());
    const add = known ? '' : '<button class="srow add" type="button" data-addnew="' + esc(t) + '"><span class="st">Add “' + esc(t) + '”<small>A new exercise of your own; pick its muscle group next</small></span>' + ICON.chevR + '</button>';
    return '<div class="rgroup" id="fxResults" role="list" aria-label="Exercises found">' + (rows || '<div class="dempty">No exercise matches “' + esc(t) + '”.</div>') + add + '</div>';
  }
  function pickFromSearch(name, gid) {
    const f = st.form;
    f.q = ''; f.group = gid; f.other = '';
    pickExercise(name);
    renderDay();
    const w = $('fxW'); if (w) w.focus({ preventScroll: true });
  }
  // The exercise list: what you did lately in this group first, then the
  // group's sections, then your own, then Other… to type one in.
  function exerciseOptions(gid, val) {
    let picked = false;
    const o = n => { const sel = !picked && n === val; if (sel) picked = true; return '<option value="' + esc(n) + '"' + (sel ? ' selected' : '') + '>' + esc(n) + '</option>'; };
    const grp = (label, list) => list.length ? (label ? '<optgroup label="' + esc(label) + '">' + list.map(o).join('') + '</optgroup>' : list.map(o).join('')) : '';
    const recent = recentIn(gid, 3), g = GROUP[gid], mine = mineIn(gid);
    const known = exercisesFor(gid).concat(recent);
    const extra = val && val !== OTHER && !known.includes(val) ? [val] : [];
    const secs = g ? g.sec : [];
    const labelled = recent.length || secs.length > 1 || mine.length;
    return '<option value=""' + (val ? '' : ' selected') + ' disabled>Choose…</option>'
      + grp('Recent', recent)
      + secs.map(([label, list]) => grp(label || (labelled ? g.name : ''), list)).join('')
      + grp('Yours', mine.concat(extra))
      + '<option value="' + OTHER + '"' + (val === OTHER ? ' selected' : '') + '>Other…</option>';
  }
  const formName = f => f.exercise === OTHER ? f.other.trim() : f.exercise;
  // The Add button follows the form (it isn't there while search results show).
  const syncAdd = () => { const b = $('fxAdd'); if (b) b.disabled = !formReady(); };
  const formReady = () => { const f = st.form; return !!(f.group && formName(f) && (isCardio(f.group) ? +f.mins > 0 : f.weight !== '' && f.reps && f.sets)); };
  // Choosing an exercise starts its numbers from the last time it was done.
  function pickExercise(name) {
    const f = st.form;
    f.exercise = name;
    f.timed = name !== OTHER && isTimed(name);
    if (name === OTHER) { f.weight = ''; f.reps = 10; return; }
    const last = lastOf(name, st.day, f.editing);
    if (isCardio(f.group)) { f.mins = last && last.cardio ? last.mins : 20; f.dist = last && last.cardio && +last.dist > 0 && (last.unit || 'mi') === unitFor(name) ? last.dist : ''; return; }
    if (last && !!last.timed === f.timed) { f.weight = last.weight; f.reps = last.reps; f.sets = last.sets; }
    else { f.weight = BODYWEIGHT.has(name.toLowerCase()) ? 0 : ''; f.reps = f.timed ? 30 : 10; f.sets = 3; }
  }
  const body = $('dayBody');
  body.addEventListener('click', e => {
    const f = st.form;
    const g = e.target.closest('[data-group]');
    if (g) {
      if (!f.group && f.exercise === OTHER && f.other) f.group = g.dataset.group;   // a new name from the search: keep it
      else if (f.group !== g.dataset.group) { f.group = g.dataset.group; f.exercise = ''; f.other = ''; f.weight = ''; }
      renderDay(); const ex = $(f.exercise === OTHER ? 'fxOther' : 'fxEx'); if (ex) ex.focus({ preventScroll: true }); return;
    }
    const pk = e.target.closest('[data-pick]');
    if (pk) { pickFromSearch(pk.dataset.pick, pk.dataset.pg); return; }
    const nw = e.target.closest('[data-addnew]');
    if (nw) {
      // A new name of your own: you say which muscle group it belongs to.
      f.q = ''; f.group = null; f.exercise = OTHER; f.other = nw.dataset.addnew; f.weight = ''; f.timed = false;
      renderDay();
      return;
    }
    if (e.target.closest('#fxSearchClear')) { f.q = ''; renderDay(); $('fxSearch').focus(); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) {
      const x = data.logs.find(l => l.id === ed.dataset.edit); if (!x) return;
      if (f.editing === x.id) { st.form = blankForm(); renderDay(); return; }
      st.form = Object.assign(blankForm(), { editing: x.id, group: x.group, exercise: x.exercise, weight: x.weight, reps: x.reps, sets: x.sets, timed: !!x.timed },
        x.cardio ? { mins: +x.mins || 20, dist: +x.dist > 0 ? +x.dist : '' } : {});
      renderDay(); return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const i = data.logs.findIndex(l => l.id === del.dataset.del); if (i < 0) return;
      const [x] = data.logs.splice(i, 1); save();
      if (f.editing === x.id) st.form = blankForm();
      renderDay(); render();
      toast('Deleted ' + x.exercise, () => { data.logs.splice(Math.min(i, data.logs.length), 0, x); save(); if (st.day) renderDay(); render(); });
      return;
    }
    if (e.target.closest('#fxCancel')) { st.form = blankForm(); renderDay(); return; }
    if (e.target.closest('#fxAdd')) addOrSave();
  });
  body.addEventListener('change', e => {
    const f = st.form, t = e.target;
    if (t.id === 'fxEx') { pickExercise(t.value === OTHER ? OTHER : t.value); renderDay(); if (f.exercise === OTHER) $('fxOther').focus(); return; }
    if (!/^fx[WRSMD]$/.test(t.id)) return;
    if (t.id === 'fxM') f.mins = +t.value;
    else if (t.id === 'fxD') f.dist = t.value === '' ? '' : +t.value;
    else if (t.id === 'fxW') f.weight = +t.value;
    else if (t.id === 'fxR') f.reps = +t.value;
    else if (t.id === 'fxS') f.sets = +t.value;
    syncAdd();
  });
  body.addEventListener('input', e => {
    if (e.target.id === 'fxSearch') {
      // Only the part under the search bar is redrawn, so typing carries on.
      st.form.q = e.target.value;
      $('fxPick').innerHTML = pickHtml();
      $('fxSearchClear').hidden = !st.form.q;
      return;
    }
    if (e.target.id !== 'fxOther') return;
    const f = st.form, had = !!f.other.trim();
    f.other = e.target.value;
    // The weight, reps and sets appear once the exercise has a name.
    if (had !== !!f.other.trim()) {
      if (!had && f.weight === '' && !isCardio(f.group)) { const last = lastOf(f.other.trim(), st.day, f.editing); if (last && !last.timed && !last.cardio) { f.weight = last.weight; f.reps = last.reps; f.sets = last.sets; } }
      const pos = e.target.selectionStart; renderDay(); const o = $('fxOther'); o.focus(); o.setSelectionRange(pos, pos);
    }
    syncAdd();
  });
  body.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'fxOther' && formReady()) addOrSave();
    // Enter in the search takes the first result.
    if (e.key === 'Enter' && e.target.id === 'fxSearch') { e.preventDefault(); const b = $('fxPick').querySelector('[data-pick], [data-addnew]'); if (b) b.click(); }
  });
  function addOrSave() {
    if (!formReady()) return;
    const f = st.form, name = formName(f).replace(/\s+/g, ' ').slice(0, 60);
    // A name typed in is kept, so it is in the list next time.
    if (f.exercise === OTHER && !exercisesFor(f.group).some(n => n.toLowerCase() === name.toLowerCase())) {
      data.exercises.push({ id: newId(), group: f.group, name });
    }
    // Cardio keeps weight, reps and sets at 0, so everything that adds up
    // sets or volume leaves it out without asking.
    const fields = isCardio(f.group)
      ? { group: f.group, exercise: name, weight: 0, reps: 0, sets: 0, cardio: true, mins: +f.mins, dist: f.dist === '' ? 0 : +f.dist, unit: unitFor(name) }
      : { group: f.group, exercise: name, weight: +f.weight, reps: +f.reps, sets: +f.sets };
    if (f.timed && !fields.cardio) fields.timed = true;
    if (f.editing) {
      const x = data.logs.find(l => l.id === f.editing);
      if (x) { for (const k of ['timed', 'cardio', 'mins', 'dist', 'unit']) delete x[k]; Object.assign(x, fields); }
      toast('Saved ' + name);
    } else {
      data.logs.push(Object.assign({ id: newId(), date: st.day }, fields));
      toast('Added ' + name);
    }
    save();
    // Ready for the next one in the same group.
    const g = f.group; st.form = blankForm(); st.form.group = g;
    renderDay(); render();
  }

  // ---------------------------------------------------------------------
  // Google Sheet sync - the same design as Travel's, for the log and your
  // own exercises (google-sheet-sync.gs; steps in the README)
  // ---------------------------------------------------------------------
  const APP = 'allison-fitness-sync';
  let syncCfg = ls.json(K.sync, null);
  if (!syncCfg || typeof syncCfg.url !== 'string' || typeof syncCfg.secret !== 'string') syncCfg = null;
  let syncing = false, syncAgain = false, syncTimer = null, syncState = syncCfg ? 'idle' : 'off', syncErr = '', errShown = false;
  let lastSyncAt = +ls.get(K.syncAt, 0) || 0;
  const SYNC_ERRORS = {
    'wrong-secret': 'The secret code doesn’t match the script’s. If you changed SECRET after deploying, the web app still has the old one: Deploy → Manage deployments → ✏️ → Version: New version → Deploy. Also check the phone didn’t fill in another app’s code.',
    'old-script': 'The Sheet is running an old copy of the script. Deploy → Manage deployments → ✏️ → Version: New version → Deploy, then try again.',
    'secret-not-set': 'The script still says SECRET = ‘CHANGE-ME’. Change it, save, and deploy a new version.',
    'busy': 'The Sheet was busy. Trying again shortly.',
    'bad-request': 'The Sheet didn’t understand the request.',
    'network': 'Couldn’t reach the Sheet. Check the link, or you may be offline.',
    'not-json': 'That link didn’t answer like the Fitness script. Check it ends in /exec and “Who has access” is Anyone.',
    'wrong-app': 'That link belongs to another AllisonOS app’s Sheet. Fitness needs the web app link from its own Sheet (Extensions → Apps Script → Deploy → Manage deployments).',
  };
  // A copy of the link and code in IndexedDB, as in Travel: it survives a
  // full or cleared localStorage (every AllisonOS app shares its space).
  const keep = (() => {
    let db = null;
    const open = () => db || (db = new Promise((res, rej) => {
      const r = indexedDB.open('allison-fitness', 1);
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
  function saveSyncCfg() {
    if (syncCfg) ls.set(K.sync, JSON.stringify(syncCfg)); else lsDel(K.sync);
    keep.set('sync', syncCfg ? { url: syncCfg.url, secret: syncCfg.secret } : null);
  }
  function applyRemote(res) {
    Object.keys(res.graves || {}).forEach(k => { const t = +res.graves[k] || 0; if ((graves[k] || 0) < t) graves[k] = t; });
    let localNewer = false;
    const mergeKind = (kind, local, remote) => {
      const map = new Map(local.map(x => [x.id, x]));
      remote.forEach(r => {
        const l = map.get(r.id);
        if (!l || (+r.updated || 0) > (+l.updated || 0)) map.set(r.id, r);
        else if ((+l.updated || 0) > (+r.updated || 0)) localNewer = true;
      });
      const remoteIds = new Set(remote.map(r => r.id));
      local.forEach(l => { if (!remoteIds.has(l.id) && !graves[kind + ':' + l.id]) localNewer = true; });
      return [...map.values()].filter(x => { const g = graves[kind + ':' + x.id]; return !(g && g >= (+x.updated || 0)); });
    };
    data.logs = mergeKind('logs', data.logs, (res.logs || []).filter(okLog));
    data.exercises = mergeKind('exercises', data.exercises, (res.exercises || []).filter(okEx));
    initShadow(); persist();
    if (localNewer) syncAgain = true;
    render();
    if (st.day) { if (st.form.editing && !data.logs.some(l => l.id === st.form.editing)) st.form = blankForm(); renderDay(); }
  }
  async function sync(loud) {
    if (!syncCfg) return false;
    if (syncing) { syncAgain = true; return false; }
    if (!navigator.onLine) { syncState = 'offline'; renderSyncStatus(); return false; }
    syncing = true; syncState = 'syncing';
    if (loud) busyPill('Syncing');
    let ok = false;
    try {
      track(); persist();
      let r, res;
      try {
        r = await fetch(syncCfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', cache: 'no-store',
          body: JSON.stringify({ secret: syncCfg.secret, action: 'sync', v: 1, logs: data.logs, exercises: data.exercises, graves }) });
      } catch { throw new Error('network'); }
      try { res = await r.json(); } catch { throw new Error('not-json'); }
      if (res && res.ok && res.app && res.app !== APP) throw new Error('wrong-app');
      if (res && res.error === 'wrong-secret' && res.app !== APP) throw new Error(await whichScript(syncCfg.url));
      if (!res || !res.ok) throw new Error((res && res.error) || 'not-json');
      lastSyncAt = Date.now(); ls.set(K.syncAt, String(lastSyncAt));
      syncState = 'ok'; syncErr = ''; errShown = false; ok = true;
      applyRemote(res);
      if (loud) pillDone('Synced');
    } catch (e) {
      syncState = 'error'; syncErr = e.message; busyPill();
      if (loud || !errShown) { errShown = true; toast(SYNC_ERRORS[syncErr] || 'Sync didn’t work. Trying again later.', null, 6000); }
    } finally {
      syncing = false; renderSyncStatus();
      if (syncAgain) { syncAgain = false; scheduleSync(800); }
    }
    return ok;
  }
  // A "wrong secret" from a script that doesn't say it's Fitness's: ask the
  // link which app it belongs to (every script answers a plain GET with its name).
  async function whichScript(url) {
    try {
      const r = await fetch(url, { cache: 'no-store', redirect: 'follow' });
      const d = await r.json();
      if (d && d.app && d.app !== APP) return 'wrong-app';
      if (d && d.app === APP) return 'old-script';
    } catch {}
    return 'wrong-secret';
  }
  function scheduleSync(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(() => sync(false), ms == null ? 2000 : ms); }
  const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  function renderSyncStatus() {
    const on = !!syncCfg;
    $('syStatus').textContent = !on ? 'Back up the log to a Google Sheet of your own, and keep a second phone in step.'
      : syncState === 'error' ? (SYNC_ERRORS[syncErr] || 'Not synced') : syncState === 'syncing' ? 'Syncing…'
      : syncState === 'offline' ? 'Offline. Changes will sync when you’re back online.' : lastSyncAt ? 'Connected. Last synced ' + ago(lastSyncAt) + '.' : 'Connected.';
    $('syForm').hidden = on; $('syOn').hidden = !on;
    $('syncBtn').classList.toggle('warn', on && syncState === 'error');
  }
  function openSyncSheet(pre) {
    $('syUrl').value = pre ? pre.u : syncCfg ? syncCfg.url : '';
    $('sySecret').value = pre ? pre.s : syncCfg ? syncCfg.secret : '';
    renderSyncStatus();
    if (pre) { $('syForm').hidden = false; $('syOn').hidden = true; $('syStatus').textContent = 'From a setup link. Tap Connect and sync.'; }
    openSheet('syncSheet');
  }
  $('syncBtn').onclick = () => openSyncSheet();
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
    if (!ok) { syncCfg = before; syncState = before ? 'idle' : 'off'; const err = syncErr; renderSyncStatus(); $('syForm').hidden = false; $('syOn').hidden = true; $('syStatus').textContent = SYNC_ERRORS[err] || 'Couldn’t connect.'; return; }
    saveSyncCfg(); renderSyncStatus();
    toast('Connected. ' + plural(data.logs.length, 'exercise') + ' logged, now in the Sheet.');
  };
  $('syNow').onclick = async () => { if (await sync(true)) toast('Synced'); };
  const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  $('syShare').onclick = async () => {
    const link = location.href.split('#')[0].split('?')[0] + '#sync=' + b64e(JSON.stringify({ u: syncCfg.url, s: syncCfg.secret }));
    try { await navigator.clipboard.writeText(link); toast('Setup link copied. Open it in Fitness on the other phone. Keep it private.', null, 6000); }
    catch { toast('Copy isn’t available here.'); }
  };
  $('syOff').onclick = () => {
    const b = $('syOff');
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to disconnect'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Disconnect this phone'; }, 3500); return; }
    delete b.dataset.armed; b.textContent = 'Disconnect this phone';
    syncCfg = null; syncState = 'off'; saveSyncCfg(); renderSyncStatus();
    toast('Disconnected. Your log stays on this phone and in the Sheet.');
  };
  function takeSetupLink(text) {
    const m = String(text).match(/#sync=([\w-]+)/); if (!m) return false;
    try { const c = JSON.parse(b64d(m[1])); if (c && c.u && c.s) { openSyncSheet(c); return true; } } catch {}
    toast('That setup link is damaged. Copy it again.'); return true;
  }
  // The pill at the top while the Sheet syncs (as in Travel).
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
  // Sheets and the toast (as in Calendar)
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
    if (!$('viewMenu').hidden) { closeViewMenu(); return; }
    const open = [...document.querySelectorAll('.sheetwrap')].reverse().find(w => !w.hidden);
    if (open) closeWrap(open);
  });
  let toastTimer;
  function toast(msg, undo, ms) {
    $('toastMsg').textContent = msg;
    $('toastAct').hidden = !undo;
    $('toastAct').textContent = undo && undo.label || 'Undo';
    $('toastAct').onclick = () => { (undo.action || undo)(); $('toast').hidden = true; };
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
  // A setup link from the other phone: #sync=...
  if (location.hash.startsWith('#sync=')) { const h = location.hash; history.replaceState(null, '', location.pathname + location.search); setTimeout(() => takeSetupLink(h), 300); }
  // Opened from Calendar's Fitness layer: ?date=YYYY-MM-DD opens that day.
  const q = new URLSearchParams(location.search).get('date');
  if (/^\d{4}-\d{2}-\d{2}$/.test(q || '') && !isNaN(noon(q))) { st.view = 'week'; st.week = weekStartOf(q); render(); openDay(q); }
  // Another tab may have changed the log, or Calendar's week start.
  window.addEventListener('storage', e => {
    if (e.key !== KEY && e.key !== 'allison-calendar-v1-settings') return;
    load(); render();
    if (st.day) { if (st.form.editing && !data.logs.some(l => l.id === st.form.editing)) st.form = blankForm(); renderDay(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!st.day) render();
    if (syncCfg && Date.now() - lastSyncAt > 30000) sync(false);
  });
  window.addEventListener('online', () => { if (syncCfg) sync(false); });
  if (syncCfg) { setTimeout(() => sync(false), 600); keep.get('sync').then(c => { if (!c || c.url !== syncCfg.url || c.secret !== syncCfg.secret) saveSyncCfg(); }); }
  else keep.get('sync').then(c => {
    if (syncCfg || !c || !c.url || !c.secret) return;
    syncCfg = { url: c.url, secret: c.secret }; syncState = 'idle'; ls.set(K.sync, JSON.stringify(syncCfg));
    sync(false); toast('Reconnected to the Google Sheet from this phone’s backup copy.');
  });
  // "Updated" pill, once, when a new version arrives (as in Notes and Calendar).
  (function () {
    const src = [...document.querySelectorAll('style')].map(e => e.textContent).join('') + String(document.scripts.length);
    let h = 2166136261;
    for (let i = 0; i < src.length; i++) { h ^= src.charCodeAt(i); h = Math.imul(h, 16777619); }
    const ver = (h >>> 0).toString(36), prev = ls.get(K.version, null);
    ls.set(K.version, ver);
    if (!prev || prev === ver) return;
    const pill = $('updPill'); pill.hidden = false;
    setTimeout(() => { pill.classList.add('out'); setTimeout(() => { pill.hidden = true; pill.classList.remove('out'); }, 450); }, 5000);
  })();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // For the tests (fitness/scripts/app-test.mjs) only.
  window.__fitness = { st, data, render, openDay, GROUPS, lastOf, weekStartOf, sync, graves: () => graves, TIMED, setView, analysisNow, searchExercises };
})();
