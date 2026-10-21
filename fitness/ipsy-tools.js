"use strict";

// Ipsy's tools in Fitness (in both its designs). Claude asks for them by name through
// functions/fitness/api (IPSY_CLIENT_TOOLS describes them to it); they run here, on the phone, on
// this person's own log, and what they return goes back to Claude. They only read: nothing here
// changes the log. Each looks at no more than it was asked for, at most about 120 days (summary: a
// year of weeks), as compact JSON, so only the days a question needs leave the phone.
//
//   window.FitnessIpsy(app) -> the options for AllisonOS.ipsy.mount (tools, label, context, words)
//   app: the app's own pieces (fitness/app.js passes them): data (logs, meds, doses, steps, and
//        health once Fitness has it: [{ date, m: { key: value } }]), today, addDays, weekStartOf,
//        groups ([{ id, name }]), groupName, pruneFrom (the first day the phone keeps, or null),
//        older(from, to) -> Promise<true if the Sheet's older days are here now>, screen
//
//   days(from, to, include?)                  each day: workouts, volume, steps, meds, health stats
//   summary(from, to)                         each week: days trained, sets by group, volume,
//                                             cardio, average steps, meds taken %, health averages
//   compare(metric_a, metric_b, from, to, lag_days?)
//                                             paired daily values and Pearson's r, worked out here
//   meds()                                    the med list, by the person's own names
//   context()                                 today, the screen, what the phone keeps, the metrics
//
// Health stats (sleep, resting heart rate...) are named and given units by window.FitnessHealth
// (fitness/health.js: METRICS [{ key, name, cat, unit, kind }], label(key)) when it is there;
// without it a stat goes by its key.
window.FitnessIpsy = function (app) {
  const MAX_DAYS = 120, MAX_WEEKS = 53;
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const isDay = s => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && !isNaN(new Date(s + 'T12:00')) && ymd(new Date(s + 'T12:00')) === s;
  const add = (s, n) => app.addDays(s, n);
  const span = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5) + 1;
  const short = s => new Date(s + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const r2 = n => Math.round(n * 100) / 100;
  const num = v => typeof v === 'number' ? (isFinite(v) ? v : null) : typeof v === 'string' && v.trim() !== '' && isFinite(+v) ? +v : null;
  const fail = msg => { throw new Error(msg); };
  const M = () => window.FitnessMeds;
  const SLOT = { am: 'Morning', mid: 'Midday', pm: 'Evening', bed: 'Bedtime', day: 'Once a day', prn: 'As needed' };
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ---- health stats: from data.health, named by FitnessHealth if it's loaded ----
  const HM = () => { const H = window.FitnessHealth; return H && Array.isArray(H.METRICS) ? H.METRICS : []; };
  function statInfo(key) {
    const m = HM().find(x => x && x.key === key), H = window.FitnessHealth;
    let name = m && m.name;
    if (!name && H && typeof H.label === 'function') { try { name = H.label(key); } catch {} }
    return { name: String(name || key), ...(m && m.unit ? { unit: String(m.unit) } : {}) };
  }

  // ---- everything the tools read, by day (built once a call: the data is small) ----
  function look() {
    const d = app.data || {};
    const logs = new Map(), steps = new Map(), doses = new Map(), health = new Map();
    for (const x of d.logs || []) if (x && isDay(x.date)) { if (!logs.has(x.date)) logs.set(x.date, []); logs.get(x.date).push(x); }
    for (const x of d.steps || []) if (x && isDay(x.date) && num(x.n) != null) steps.set(x.date, num(x.n));
    for (const x of d.doses || []) if (x && isDay(x.date)) { if (!doses.has(x.date)) doses.set(x.date, []); doses.get(x.date).push(x); }
    for (const row of Array.isArray(d.health) ? d.health : []) {
      if (!row || !isDay(row.date) || !row.m || typeof row.m !== 'object') continue;
      const day = health.get(row.date) || {};
      for (const [k, v] of Object.entries(row.m)) if (num(v) != null) day[k] = num(v);
      health.set(row.date, day);
    }
    const meds = (d.meds || []).filter(m => m && m.name);
    return { logs, steps, doses, health, meds, today: app.today() };
  }
  const gname = id => app.groupName(id);
  // One logged exercise, as you'd say it: "Legs · Leg Press 3×10 @ 180 lb".
  function said(x) {
    const head = gname(x.group) + ' · ' + String(x.exercise || '').slice(0, 60) + ' ';
    if (x.cardio) return head + (+x.mins || 0) + ' min' + (+x.dist > 0 ? ' ' + +x.dist + ' ' + (x.unit || 'mi') : '');
    const w = +x.weight > 0 ? ' @ ' + +x.weight + ' lb' : ' bodyweight';
    return head + (+x.sets || 0) + '×' + (x.timed ? (+x.reps || 0) + ' s' : (+x.reps || 0)) + w;
  }
  // A day's workout numbers: sets (not cardio), volume (weighted sets: weight × reps × sets, as
  // Analysis counts it), cardio minutes, and sets by muscle group.
  function work(list) {
    let sets = 0, volume = 0, mins = 0; const groups = {};
    for (const x of list || []) {
      if (x.cardio) { mins += +x.mins || 0; continue; }
      const n = +x.sets || 0; sets += n; groups[x.group] = (groups[x.group] || 0) + n;
      if (!x.timed && +x.weight > 0) volume += +x.weight * (+x.reps || 0) * n;
    }
    return { sets, volume: Math.round(volume), mins, groups };
  }
  // A day's meds: what was due (by the schedule each has now) and taken, missed or still to come
  // today, and the as-needed ones taken. Names are the person's own.
  function medsOn(L, day) {
    const due = M() ? M().dueOn(L.meds, day) : [], got = L.doses.get(day) || [];
    const has = (id, slot) => got.some(x => x.med === id && x.slot === slot);
    const multi = m => Array.isArray(m.slots) && m.slots.length > 1;
    const nm = (m, slot) => m.name + (multi(m) ? ' (' + (SLOT[slot] || slot) + ')' : '');
    const taken = [], missed = [], later = [];
    for (const { med, slot } of due) (has(med.id, slot) ? taken : day < L.today ? missed : later).push(nm(med, slot));
    // taken but not due by today's schedule (changed since, or deleted): still taken
    for (const x of got) if (x.slot !== 'prn' && !due.some(u => u.med.id === x.med && u.slot === x.slot)) { const m = L.meds.find(y => y.id === x.med); taken.push(m ? nm(m, x.slot) : String(x.name || 'a deleted one')); }
    const prn = {};
    for (const x of got) if (x.slot === 'prn') { const m = L.meds.find(y => y.id === x.med), n = m ? m.name : String(x.name || 'a deleted one'); prn[n] = (prn[n] || 0) + 1; }
    // a day counts toward the share taken once it's over (today: once everything due is in)
    const counts = day < L.today || (due.length && !later.length);
    return { due: due.length, taken, missed, later, prn, counts, nTaken: due.filter(u => has(u.med.id, u.slot)).length };
  }

  // ---- a range of days: checked, put in order, kept to what the phone has (or fetched) ----
  async function range(from, to, max, unit) {
    if (!isDay(from) || !isDay(to)) fail('from and to must be dates, YYYY-MM-DD.');
    if (from > to) [from, to] = [to, from];
    const notes = [], tod = app.today();
    if (from > tod) fail('Those days haven’t happened yet: today is ' + tod + '.');
    if (to > tod) to = tod;
    if (span(from, to) > max) { from = add(to, -(max - 1)); notes.push('Cut to the last ' + (unit === 'weeks' ? MAX_WEEKS + ' weeks' : max + ' days') + ' (' + from + ' to ' + to + '): ask for less at a time.'); }
    const floor = app.pruneFrom && app.pruneFrom();
    if (floor && from < floor) {
      let ok = false;
      try { ok = await app.older(from, to); } catch {}
      if (!ok) {
        notes.push('Only the days this phone keeps were used (from ' + floor + '): the older ones are in the family’s Google Sheet, which couldn’t be reached just now.');
        from = floor;
        if (from > to) return { from, to, notes, none: true };
      } else notes.push('Days before ' + floor + ' came from the family’s Google Sheet.');
    }
    return { from, to, notes };
  }
  const each = function* (from, to) { for (let d = from; d <= to; d = add(d, 1)) yield d; };
  const out = (o, notes) => notes.length ? { ...o, note: notes.join(' ') } : o;

  // ---- the daily numbers compare lines up ----
  const BASE = {
    steps: { name: 'Steps', unit: 'steps' },
    volume: { name: 'Volume', unit: 'lb' },
    sets: { name: 'Sets' },
    cardio_min: { name: 'Cardio', unit: 'min' },
    trained: { name: 'Trained (1 or 0)' },
    meds_taken: { name: 'Doses taken' },
    meds_missed: { name: 'Doses missed' },
    adherence: { name: 'Share of due doses taken', unit: '0 to 1' },
  };
  function healthKeys(L) { const s = new Set(); L.health.forEach(m => Object.keys(m).forEach(k => s.add(k))); return [...s]; }
  function metric(L, raw) {
    const key = String(raw || '').trim();
    const k = key.toLowerCase();
    if (BASE[k]) {
      const v = {
        steps: d => L.steps.has(d) ? L.steps.get(d) : null,
        volume: d => work(L.logs.get(d)).volume,
        sets: d => work(L.logs.get(d)).sets,
        cardio_min: d => work(L.logs.get(d)).mins,
        trained: d => (L.logs.get(d) || []).length ? 1 : 0,
        meds_taken: d => { const m = medsOn(L, d); return m.counts ? m.nTaken : null; },
        meds_missed: d => { const m = medsOn(L, d); return m.counts && m.due ? m.missed.length : null; },
        adherence: d => { const m = medsOn(L, d); return m.counts && m.due ? r2(m.nTaken / m.due) : null; },
      }[k];
      return { key: k, ...BASE[k], v };
    }
    if (k.startsWith('group:')) {
      const want = k.slice(6).trim(), g = app.groups.find(x => x.id === want || x.name.toLowerCase() === want);
      if (!g) fail('No muscle group "' + want + '". The groups: ' + app.groups.map(x => x.id).join(', ') + '.');
      return { key: 'group:' + g.id, name: g.name + (g.id === 'cardio' ? ' (min)' : ' sets'), v: d => g.id === 'cardio' ? work(L.logs.get(d)).mins : work(L.logs.get(d)).groups[g.id] || 0 };
    }
    if (k.startsWith('med:')) {
      const want = k.slice(4).trim(), m = L.meds.find(x => x.name.toLowerCase() === want) || L.meds.find(x => x.name.toLowerCase().includes(want));
      if (!m || !want) fail('No med or supplement called "' + key.slice(4).trim() + '". The list: ' + L.meds.map(x => x.name).join(', ') + '.');
      return { key: 'med:' + m.name, name: m.name + ' (share taken, 0 to 1)', v: d => {
        const due = (M() ? M().dueOn([m], d) : []);
        if (!due.length || d > L.today || (d === L.today && !medsOn(L, d).counts)) return null;
        const got = L.doses.get(d) || [];
        return r2(due.filter(u => got.some(x => x.med === m.id && x.slot === u.slot)).length / due.length);
      } };
    }
    const hk = healthKeys(L).concat(HM().map(x => x.key)).find(x => x === key || x.toLowerCase() === k);
    if (hk) return { key: hk, ...statInfo(hk), v: d => { const m = L.health.get(d); return m && m[hk] != null ? m[hk] : null; } };
    fail('No daily number called "' + key + '". There are: ' + Object.keys(BASE).join(', ') + ', group:<muscle group>, med:<name>'
      + (healthKeys(L).length ? ', and the health stats ' + healthKeys(L).join(', ') : '') + '.');
  }
  function pearson(pairs) {
    const n = pairs.length;
    if (n < 3) return null;
    const ma = pairs.reduce((s, p) => s + p[1], 0) / n, mb = pairs.reduce((s, p) => s + p[2], 0) / n;
    let sab = 0, saa = 0, sbb = 0;
    for (const [, a, b] of pairs) { sab += (a - ma) * (b - mb); saa += (a - ma) ** 2; sbb += (b - mb) ** 2; }
    return saa && sbb ? r2(sab / Math.sqrt(saa * sbb)) : null;
  }
  const mean = a => a.length ? r2(a.reduce((s, x) => s + x, 0) / a.length) : null;

  const tools = {
    async days(i) {
      const R = await range(i.from, i.to, MAX_DAYS);
      if (R.none) return { content: out({ from: R.from, to: R.to, days: [] }, R.notes) };
      const inc = new Set(Array.isArray(i.include) && i.include.length ? i.include : ['workouts', 'steps', 'meds', 'health']);
      const L = look(), days = [], used = new Set();
      for (const d of each(R.from, R.to)) {
        const o = { date: d, dow: WEEKDAYS[new Date(d + 'T12:00').getDay()] };
        const logs = L.logs.get(d) || [];
        if (inc.has('workouts') && logs.length) {
          const w = work(logs);
          o.workouts = logs.map(said);
          if (w.sets) o.sets = w.sets;
          if (w.volume) o.volume = w.volume;
          if (w.mins) o.cardio_min = w.mins;
        }
        if (inc.has('steps') && L.steps.has(d)) o.steps = L.steps.get(d);
        if (inc.has('meds')) {
          const m = medsOn(L, d);
          if (m.taken.length) o.meds_taken = m.taken;
          if (m.missed.length) o.meds_missed = m.missed;
          if (m.later.length) o.meds_not_yet = m.later;
          if (Object.keys(m.prn).length) o.as_needed = m.prn;
        }
        if (inc.has('health') && L.health.has(d)) { o.health = L.health.get(d); Object.keys(o.health).forEach(k => used.add(k)); }
        if (Object.keys(o).length > 2) days.push(o);
      }
      const legend = {}; used.forEach(k => { legend[k] = statInfo(k); });
      return { content: out({ from: R.from, to: R.to, days_with_something: days.length, of_days: span(R.from, R.to), days, ...(used.size ? { health_stats: legend } : {}) }, R.notes) };
    },

    async summary(i) {
      const R = await range(i.from, i.to, MAX_WEEKS * 7, 'weeks');
      if (R.none) return { content: out({ from: R.from, to: R.to, weeks: [] }, R.notes) };
      const L = look(), weeks = new Map(), used = new Set();
      for (const d of each(R.from, R.to)) {
        const k = app.weekStartOf(d);
        if (!weeks.has(k)) weeks.set(k, { week_of: k, days: 0, trained: 0, sets: 0, volume: 0, cardio_min: 0, groups: {}, steps: [], due: 0, taken: 0, health: {} });
        const w = weeks.get(k), logs = L.logs.get(d) || [], x = work(logs);
        w.days++;
        if (logs.length) w.trained++;
        w.sets += x.sets; w.volume += x.volume; w.cardio_min += x.mins;
        for (const [g, n] of Object.entries(x.groups)) w.groups[gname(g)] = (w.groups[gname(g)] || 0) + n;
        if (L.steps.has(d)) w.steps.push(L.steps.get(d));
        const m = medsOn(L, d); if (m.counts) { w.due += m.due; w.taken += m.nTaken; }
        const h = L.health.get(d) || {};
        for (const [k2, v] of Object.entries(h)) { (w.health[k2] = w.health[k2] || []).push(v); used.add(k2); }
      }
      const list = [...weeks.values()].map(w => {
        const o = { week_of: w.week_of, days: w.days, trained: w.trained };
        if (w.sets) o.sets = w.sets;
        const g = Object.fromEntries(Object.entries(w.groups).filter(([, n]) => n > 0)); if (Object.keys(g).length) o.sets_by_group = g;
        if (w.volume) o.volume = w.volume;
        if (w.cardio_min) o.cardio_min = w.cardio_min;
        if (w.steps.length) { o.steps_avg = Math.round(w.steps.reduce((s, n) => s + n, 0) / w.steps.length); o.steps_days = w.steps.length; }
        if (w.due) { o.meds_taken_pct = Math.round(w.taken / w.due * 100); o.doses = w.taken + ' of ' + w.due; }
        const h = {}; for (const [k2, vs] of Object.entries(w.health)) h[k2] = { avg: r2(vs.reduce((s, v) => s + v, 0) / vs.length), days: vs.length };
        if (Object.keys(h).length) o.health = h;
        return o;
      });
      const legend = {}; used.forEach(k => { legend[k] = statInfo(k); });
      return { content: out({ from: R.from, to: R.to, weeks_start: 'the week starts on ' + (new Date(app.weekStartOf(app.today()) + 'T12:00').getDay() ? 'Monday' : 'Sunday'), weeks: list, ...(used.size ? { health_stats: legend } : {}) }, R.notes) };
    },

    async compare(i) {
      const lag = Math.max(-14, Math.min(14, Math.round(+i.lag_days || 0)));
      const R = await range(i.from, i.to, MAX_DAYS);
      const L = look(), A = metric(L, i.metric_a), B = metric(L, i.metric_b);
      const pairs = [];
      if (!R.none) for (const d of each(R.from, R.to)) {
        const e = add(d, lag);
        if (e > L.today) continue;
        const a = A.v(d), b = B.v(e);
        if (a != null && b != null) pairs.push([d, a, b]);
      }
      const notes = R.notes.slice();
      const r = pearson(pairs);
      if (pairs.length < 10) notes.push('Only ' + pairs.length + ' paired ' + (pairs.length === 1 ? 'day' : 'days') + ': too few to go on.');
      else if (r == null) notes.push('One of them doesn’t change over these days, so there is no correlation to work out.');
      const o = {
        metric_a: { key: A.key, name: A.name, ...(A.unit ? { unit: A.unit } : {}) },
        metric_b: { key: B.key, name: B.name, ...(B.unit ? { unit: B.unit } : {}), ...(lag ? { taken: lag > 0 ? lag + (lag === 1 ? ' day' : ' days') + ' later' : -lag + (lag === -1 ? ' day' : ' days') + ' earlier' } : {}) },
        from: R.from, to: R.to, lag_days: lag, n: pairs.length, r,
        mean_a: mean(pairs.map(p => p[1])), mean_b: mean(pairs.map(p => p[2])),
      };
      // a yes-or-no kind of metric_a (a leg day, a missed dose): metric_b on the days with it and without
      const on = pairs.filter(p => p[1] > 0), off = pairs.filter(p => p[1] === 0);
      if (on.length && off.length) { o.b_when_a_above_0 = { days: on.length, mean_b: mean(on.map(p => p[2])) }; o.b_when_a_is_0 = { days: off.length, mean_b: mean(off.map(p => p[2])) }; }
      o.pairs = pairs.map(p => [p[0], r2(p[1]), r2(p[2])]);
      o.pairs_are = '[day of metric_a, metric_a, metric_b]';
      return { content: out(o, notes) };
    },

    async meds() {
      const L = look(), floor = app.pruneFrom && app.pruneFrom(), idx = M() ? M().index((app.data || {}).doses) : null;
      const list = L.meds.slice().sort((a, b) => !!a.paused - !!b.paused || a.name.localeCompare(b.name)).map(m => {
        const o = { name: m.name };
        if (m.dose) o.dose = m.dose;
        o.kind = m.kind === 'supp' ? 'supplement' : 'medication';
        o.when = m.prn ? 'as needed' : Array.isArray(m.slots) && m.slots.length ? m.slots.map(s => SLOT[s] || s) : 'once a day, any time';
        if (!m.prn) o.days = Array.isArray(m.days) && m.days.length && m.days.length < 7 ? m.days.slice().sort().map(d => WEEKDAYS[d]) : 'every day';
        if (m.paused) o.paused = true;
        if (m.since) o.since = m.since;
        if (M() && !m.paused && !m.prn) {
          const a = M().adherence(m, (app.data || {}).doses, L.today, 30, floor, idx);
          if (a.due) o.taken_last_30_days = Math.round(a.share * 100) + '% (' + a.taken + ' of ' + a.due + ' doses)';
        }
        return o;
      });
      return { content: { meds: list, count: list.length, ...(list.length ? {} : { note: 'Nothing on the list: they can add what they take in Meds (the view picker at the bottom).' }) } };
    },

    async context() {
      const L = look(), floor = app.pruneFrom && app.pruneFrom();
      const counts = {}; L.health.forEach(m => Object.keys(m).forEach(k => { counts[k] = (counts[k] || 0) + 1; }));
      const stats = Object.keys(counts).map(k => ({ key: k, ...statInfo(k), days_recorded: counts[k] }));
      let screen = ''; try { screen = app.screen(); } catch {}
      return { content: {
        today: L.today, weekday: new Date(L.today + 'T12:00').toLocaleDateString('en-US', { weekday: 'long' }),
        screen,
        phone_keeps: floor ? 'the days from ' + floor + ' (older ones are in the family’s Google Sheet, fetched when asked for)' : 'every day logged (it hasn’t synced with the Sheet yet)',
        logged: { workouts: (app.data.logs || []).length, days_with_steps: L.steps.size, meds_on_list: L.meds.length, days_with_health_stats: L.health.size },
        muscle_groups: app.groups.map(g => ({ id: g.id, name: g.name })),
        metrics_for_compare: Object.keys(BASE).concat(['group:<id>', 'med:<name>']),
        health_stats: stats.length ? stats : 'none yet',
      } };
    },
  };

  const metricName = k => { try { return metric(look(), k).name.toLowerCase(); } catch { return String(k || ''); } };
  const LABELS = {
    days: i => 'Looking at your days' + (isDay(i.from) && isDay(i.to) ? ', ' + short(i.from < i.to ? i.from : i.to) + ' – ' + short(i.from < i.to ? i.to : i.from) : ''),
    summary: () => 'Adding up your weeks',
    compare: i => 'Comparing ' + metricName(i.metric_a) + ' with ' + metricName(i.metric_b),
    meds: () => 'Looking at your meds list',
    context: () => 'Looking at Fitness',
  };

  return {
    tools,
    label: (name, input) => (LABELS[name] || (() => ''))(input || {}),
    context() {
      let s = ''; try { s = app.screen(); } catch {}
      return s ? 'On screen: ' + s + '.' : '';
    },
    intro: 'Hi, I’m Ipsy! Ask me about patterns in your workouts, steps, meds and health.',
    placeholder: 'Ask Ipsy about your patterns',
    suggestions: ['How did I sleep after leg days?', 'Is my resting heart rate trending down?', 'Did I miss meds more on low-sleep days?', 'Do I walk more on days I train?'],
    consent: 'Your question and only the days Ipsy needs go to Claude, by Anthropic, through aOS; Anthropic doesn’t train on it. Ipsy only reads your log, has no web search, and isn’t a doctor.',
  };
};
