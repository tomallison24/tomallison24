"use strict";

// Fitness: a workout log, kept small.
//
// - The week as seven rows, one a day, each showing the muscle groups worked
//   and how many exercises and sets; arrows (or a swipe) move a week at a
//   time, and the totals for the week sit underneath.
// - Tapping a day opens its sheet: what was logged that day, and the form to
//   add to it - a muscle group, then the exercise (a list for each group,
//   plus any you have typed in yourself), then the weight, reps and sets.
//   Choosing an exercise fills in what you did last time.
// - Everything stays in this phone's storage (allison-fitness-v1). Calendar
//   reads it to show each workout as a layer, linking back here with
//   ?date=YYYY-MM-DD; and the week starts on the day Calendar's own setting
//   says, so the two agree.

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
  const K = { version: KEY + '-version' };

  const ICON = {
    chevL: '<svg viewBox="0 0 24 24" class="b"><path d="M14.6 5.4L8.4 11.3a1 1 0 0 0 0 1.4l6.2 5.9"/></svg>',
    chevR: '<svg viewBox="0 0 24 24" class="b"><path d="M9.4 5.4l6.2 5.9a1 1 0 0 1 0 1.4l-6.2 5.9"/></svg>',
    close: '<svg viewBox="0 0 24 24" class="b"><path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"/></svg>',
  };

  // ---------------------------------------------------------------------
  // The muscle groups and their exercises. Ones marked * are usually done
  // with your own bodyweight, so their weight starts at "Bodyweight".
  // ---------------------------------------------------------------------
  const GROUPS = [
    { id: 'chest', name: 'Chest', ex: ['Bench press', 'Incline bench press', 'Dumbbell bench press', 'Incline dumbbell press', 'Chest fly', 'Cable crossover', 'Push-ups*', 'Dips*'] },
    { id: 'back', name: 'Back', ex: ['Pull-ups*', 'Chin-ups*', 'Lat pulldown', 'Barbell row', 'Dumbbell row', 'Seated cable row', 'T-bar row', 'Face pulls'] },
    { id: 'lowerback', name: 'Lower back', ex: ['Deadlift', 'Romanian deadlift', 'Back extension*', 'Good mornings', 'Rack pull', 'Superman*', 'Bird dog*'] },
    { id: 'shoulders', name: 'Shoulders', ex: ['Overhead press', 'Dumbbell shoulder press', 'Arnold press', 'Lateral raise', 'Front raise', 'Rear delt fly', 'Upright row', 'Shrugs'] },
    { id: 'arms', name: 'Arms', ex: ['Barbell curl', 'Dumbbell curl', 'Hammer curl', 'Preacher curl', 'Triceps pushdown', 'Skull crushers', 'Overhead triceps extension', 'Close-grip bench press'] },
    { id: 'core', name: 'Core', ex: ['Crunches*', 'Sit-ups*', 'Hanging leg raise*', 'Russian twist', 'Cable crunch', 'Ab wheel rollout*', 'Dead bug*', 'Woodchopper'] },
    { id: 'legs', name: 'Legs', ex: ['Back squat', 'Front squat', 'Leg press', 'Lunges', 'Bulgarian split squat', 'Leg extension', 'Leg curl', 'Calf raise'] },
    { id: 'glutes', name: 'Glutes', ex: ['Hip thrust', 'Glute bridge', 'Cable kickback', 'Sumo deadlift', 'Step-ups', 'Hip abduction'] },
  ];
  const GROUP = Object.fromEntries(GROUPS.map(g => [g.id, g]));
  const BODYWEIGHT = new Set(GROUPS.flatMap(g => g.ex.filter(e => e.endsWith('*')).map(e => e.slice(0, -1).toLowerCase())));
  for (const g of GROUPS) g.ex = g.ex.map(e => e.replace(/\*$/, ''));
  const groupName = id => GROUP[id] ? GROUP[id].name : 'Other';

  // Weights in pounds: 2.5 lb steps to 100, then 5 lb steps to 500. 0 is
  // bodyweight. Reps 1-50, sets 1-10.
  const WEIGHTS = [0];
  for (let w = 2.5; w <= 100; w += 2.5) WEIGHTS.push(w);
  for (let w = 105; w <= 500; w += 5) WEIGHTS.push(w);
  const REPS = Array.from({ length: 50 }, (_, i) => i + 1);
  const SETS = Array.from({ length: 10 }, (_, i) => i + 1);
  const fmtW = w => +w === 0 ? 'Bodyweight' : (+w).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' lb';
  const fmtLine = x => x.sets + ' × ' + x.reps + ' · ' + fmtW(x.weight);

  // ---------------------------------------------------------------------
  // Data: { v, logs: [{id, date, group, exercise, weight, reps, sets,
  // updated}], custom: {group: [exercise names you typed in]} }
  // ---------------------------------------------------------------------
  const data = { v: 1, logs: [], custom: {} };
  function load() {
    const d = ls.json(KEY, null) || {};
    const ok = x => x && typeof x.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') && typeof x.exercise === 'string';
    data.logs = Array.isArray(d.logs) ? d.logs.filter(ok) : [];
    data.custom = d.custom && typeof d.custom === 'object' && !Array.isArray(d.custom) ? d.custom : {};
  }
  load();
  const save = () => { if (!ls.set(KEY, JSON.stringify(data))) toast('Couldn’t save: this phone’s storage is full.'); };
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const logsOn = day => data.logs.filter(x => x.date === day);
  const exercisesFor = gid => {
    const base = GROUP[gid] ? GROUP[gid].ex : [];
    const mine = (Array.isArray(data.custom[gid]) ? data.custom[gid] : []).filter(n => !base.some(b => b.toLowerCase() === String(n).toLowerCase()));
    return base.concat(mine);
  };
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
  const weekStartsSunday = () => ls.json('allison-calendar-v1-settings', {}).weekStart === 0;
  const weekStartOf = s => { const wd = noon(s).getDay(); return addDays(s, -(weekStartsSunday() ? wd : (wd + 6) % 7)); };
  const fmt = (s, o) => noon(s).toLocaleDateString(undefined, o);
  const sameYear = s => s.slice(0, 4) === today().slice(0, 4);

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const st = { week: weekStartOf(today()), day: null, form: null };
  const blankForm = () => ({ editing: null, group: null, exercise: '', other: '', weight: '', reps: 10, sets: 3 });

  // ---------------------------------------------------------------------
  // The week
  // ---------------------------------------------------------------------
  const main = $('main');
  function render() {
    const ws = st.week, we = addDays(ws, 6), tod = today();
    const thisWeek = ws === weekStartOf(tod);
    $('titleSub').textContent = thisWeek ? 'This week' : ws === weekStartOf(addDays(tod, -7)) ? 'Last week' : ws === weekStartOf(addDays(tod, 7)) ? 'Next week' : 'Week of ' + fmt(ws, { day: 'numeric', month: 'short', year: sameYear(ws) ? undefined : 'numeric' });
    const label = fmt(ws, { day: 'numeric', month: 'short' }) + ' – ' + fmt(we, { day: 'numeric', month: 'short', year: sameYear(we) ? undefined : 'numeric' });
    let rows = '', days = 0, exCount = 0, sets = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i), logs = logsOn(d);
      const groups = [...new Set(logs.map(x => x.group))];
      const n = logs.reduce((a, x) => a + (+x.sets || 0), 0);
      if (logs.length) { days++; exCount += logs.length; sets += n; }
      const sum = logs.length
        ? '<span class="tmeta">' + groups.map(g => '<span class="tchip" data-g="' + esc(GROUP[g] ? g : 'other') + '">' + esc(groupName(g)) + '</span>').join('') + '</span><span class="dline">' + plural(logs.length, 'exercise') + ' · ' + plural(n, 'set') + '</span>'
        : '<span class="rest">' + (d < tod ? 'Rest day' : d === tod ? 'Nothing logged yet' : '') + '</span>';
      rows += '<button class="drow' + (d === tod ? ' today' : '') + (logs.length ? ' has' : '') + '" type="button" data-day="' + d + '" aria-label="' + esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }) + (logs.length ? ', ' + plural(logs.length, 'exercise') : '')) + '">'
        + '<span class="dn"><small>' + esc(fmt(d, { weekday: 'short' })) + '</small><b>' + +d.slice(8) + '</b></span><span class="dsum">' + sum + '</span>' + ICON.chevR + '</button>';
    }
    $('todayBtn').hidden = thisWeek;
    main.innerHTML = '<div class="navrow" style="--i:0"><button class="iconbtn glass" type="button" data-act="prev" aria-label="Previous week">' + ICON.chevL + '</button><span class="lbl">' + esc(label) + '</span><button class="iconbtn glass" type="button" data-act="next" aria-label="Next week">' + ICON.chevR + '</button></div>'
      + '<div class="rgroup week" style="--i:1">' + rows + '</div>'
      + '<p class="sechead">' + (thisWeek ? 'This week' : 'That week') + '</p>'
      + '<div class="stats" style="--i:2"><div class="stat"><b>' + days + '</b><span>' + (days === 1 ? 'day' : 'days') + ' trained</span></div><div class="stat"><b>' + exCount + '</b><span>' + (exCount === 1 ? 'exercise' : 'exercises') + '</span></div><div class="stat"><b>' + sets + '</b><span>' + (sets === 1 ? 'set' : 'sets') + '</span></div></div>';
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
    const groups = '<div class="opts" role="radiogroup" aria-label="Muscle group">' + GROUPS.map(g => '<button class="opt" type="button" role="radio" data-g="' + g.id + '" data-group="' + g.id + '" aria-checked="' + (f.group === g.id) + '"><span class="gd"></span>' + esc(g.name) + '</button>').join('') + '</div>';
    let form = '';
    if (f.group) {
      const names = exercisesFor(f.group);
      const isOther = f.exercise === OTHER;
      if (f.exercise && !isOther && !names.includes(f.exercise)) names.push(f.exercise);
      form += '<div class="rgroup"><div class="frow"><label for="fxEx">Exercise</label><select id="fxEx"><option value=""' + (f.exercise ? '' : ' selected') + ' disabled>Choose…</option>' + opts(names, f.exercise) + '<option value="' + OTHER + '"' + (isOther ? ' selected' : '') + '>Other…</option></select></div>'
        + (isOther ? '<div class="frow"><input class="txt" id="fxOther" type="text" maxlength="60" placeholder="Name of the exercise" autocomplete="off" aria-label="Name of the exercise" value="' + esc(f.other) + '"></div>' : '');
      if (formName(f)) {
        const ws = WEIGHTS.slice(); if (f.weight !== '' && !ws.includes(+f.weight)) ws.push(+f.weight), ws.sort((a, b) => a - b);
        form += '<div class="frow"><label for="fxW">Weight</label><select id="fxW">' + (f.weight === '' ? '<option value="" selected disabled>Choose…</option>' : '') + opts(ws, f.weight, fmtW) + '</select></div>'
          + '<div class="frow"><label for="fxR">Reps</label><select id="fxR">' + opts(REPS, f.reps) + '</select></div>'
          + '<div class="frow"><label for="fxS">Sets</label><select id="fxS">' + opts(SETS, f.sets) + '</select></div>';
      }
      form += '</div>';
      const name = isOther ? f.other.trim() : f.exercise;
      const last = name && lastOf(name, day, f.editing);
      if (last) form += '<p class="hint">Last time, ' + esc(fmt(last.date, { weekday: 'short', day: 'numeric', month: 'short', year: sameYear(last.date) ? undefined : 'numeric' })) + ': ' + esc(fmtLine(last)) + '</p>';
    } else form += '<p class="hint">Pick a muscle group, then the exercise.</p>';
    form += '<div class="formbtns">' + (f.editing ? '<button class="btn quiet" type="button" id="fxCancel">Cancel</button>' : '')
      + '<button class="btn" type="button" id="fxAdd"' + (formReady() ? '' : ' disabled') + '>' + (f.editing ? 'Save changes' : 'Add to ' + esc(day === today() ? 'today' : fmt(day, { weekday: 'long' }))) + '</button></div>';
    $('dayBody').innerHTML = '<p class="label">Done</p><div class="rgroup" id="fxList">' + list + '</div>'
      + '<p class="label">' + (f.editing ? 'Change exercise' : 'Add an exercise') + '</p>' + groups + form;
  }
  const formName = f => f.exercise === OTHER ? f.other.trim() : f.exercise;
  const formReady = () => { const f = st.form; return !!(f.group && formName(f) && f.weight !== '' && f.reps && f.sets); };
  // Choosing an exercise starts its numbers from the last time it was done.
  function pickExercise(name) {
    const f = st.form;
    f.exercise = name;
    if (name === OTHER) { f.weight = ''; return; }
    const last = lastOf(name, st.day, f.editing);
    if (last) { f.weight = last.weight; f.reps = last.reps; f.sets = last.sets; }
    else { f.weight = BODYWEIGHT.has(name.toLowerCase()) ? 0 : ''; f.reps = 10; f.sets = 3; }
  }
  const body = $('dayBody');
  body.addEventListener('click', e => {
    const f = st.form;
    const g = e.target.closest('[data-group]');
    if (g) { if (f.group !== g.dataset.group) { f.group = g.dataset.group; f.exercise = ''; f.other = ''; f.weight = ''; } renderDay(); const ex = $('fxEx'); if (ex) ex.focus({ preventScroll: true }); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) {
      const x = data.logs.find(l => l.id === ed.dataset.edit); if (!x) return;
      if (f.editing === x.id) { st.form = blankForm(); renderDay(); return; }
      st.form = { editing: x.id, group: x.group, exercise: x.exercise, other: '', weight: x.weight, reps: x.reps, sets: x.sets };
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
    if (t.id === 'fxW') f.weight = +t.value;
    else if (t.id === 'fxR') f.reps = +t.value;
    else if (t.id === 'fxS') f.sets = +t.value;
    $('fxAdd').disabled = !formReady();
  });
  body.addEventListener('input', e => {
    if (e.target.id !== 'fxOther') return;
    const f = st.form, had = !!f.other.trim();
    f.other = e.target.value;
    // The weight, reps and sets appear once the exercise has a name.
    if (had !== !!f.other.trim()) {
      if (!had && f.weight === '') { const last = lastOf(f.other.trim(), st.day, f.editing); if (last) { f.weight = last.weight; f.reps = last.reps; f.sets = last.sets; } }
      const pos = e.target.selectionStart; renderDay(); const o = $('fxOther'); o.focus(); o.setSelectionRange(pos, pos);
    }
    $('fxAdd').disabled = !formReady();
  });
  body.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'fxOther' && formReady()) addOrSave(); });
  function addOrSave() {
    if (!formReady()) return;
    const f = st.form, name = formName(f).replace(/\s+/g, ' ').slice(0, 60);
    // A name typed in is kept, so it is in the list next time.
    if (f.exercise === OTHER && !exercisesFor(f.group).some(n => n.toLowerCase() === name.toLowerCase())) {
      data.custom[f.group] = (Array.isArray(data.custom[f.group]) ? data.custom[f.group] : []).concat(name);
    }
    const fields = { group: f.group, exercise: name, weight: +f.weight, reps: +f.reps, sets: +f.sets, updated: Date.now() };
    if (f.editing) {
      const x = data.logs.find(l => l.id === f.editing);
      if (x) Object.assign(x, fields);
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
  render();
  animateIn(main);
  // Opened from Calendar's Fitness layer: ?date=YYYY-MM-DD opens that day.
  const q = new URLSearchParams(location.search).get('date');
  if (/^\d{4}-\d{2}-\d{2}$/.test(q || '') && !isNaN(noon(q))) { st.week = weekStartOf(q); render(); openDay(q); }
  // Another tab may have changed the log, or Calendar's week start.
  window.addEventListener('storage', e => {
    if (e.key !== KEY && e.key !== 'allison-calendar-v1-settings') return;
    load(); render();
    if (st.day) { if (st.form.editing && !data.logs.some(l => l.id === st.form.editing)) st.form = blankForm(); renderDay(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !st.day) render(); });
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
  window.__fitness = { st, data, render, openDay, GROUPS, lastOf, weekStartOf };
})();
