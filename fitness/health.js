"use strict";

// Fitness's Health: the Apple Health readings Fitness shows, each person's own,
// read from their iPhone through the family's Home Assistant (the Home Assistant
// app 2026.9+ has an Apple Health sensor for each, turned on one by one in the
// app). One list, used by the page (app.js), the server (functions/fitness/api,
// which finds each sensor and sums its history into days) and, later, Ipsy.
// No page, so it can be tested in Node.
//
// A metric is { key, name, slug, cat, unit, kind, digits, label }:
//   key     short and stable: what a day's row keeps it under ({ m: { key: value } })
//           and the Sheet's Health tab column; never renamed
//   name    the sensor's name in the Home Assistant app (after the phone's name)
//   slug    the end of its entity id: sensor.<phone>_<slug>
//   cat     'activity' | 'heart' | 'sleep' | 'vitals'
//   unit    as shown (and as Home Assistant reports it on an American iPhone)
//   kind    'total'   a day's running total, reset at midnight: the day's last value
//           'latest'  a reading: the day's last (heart rate: the day's average)
//           'night'   the night just ended (Apple's sleep day runs 18:00 to 18:00),
//                     dated the morning it ends
//   digits  decimals kept
//   label   what Fitness calls it
// Body measurements (weight, body fat, height) and water aren't here: not chosen.
(function (root) {
  const M = (key, name, slug, cat, unit, kind, digits, label) => ({ key, name, slug, cat, unit, kind, digits, label });
  const METRICS = [
    M('steps', 'Health Steps', 'health_steps', 'activity', 'steps', 'total', 0, 'Steps'),
    M('active_kcal', 'Active Energy', 'active_energy', 'activity', 'kcal', 'total', 0, 'Active energy'),
    M('rest_kcal', 'Resting Energy', 'resting_energy', 'activity', 'kcal', 'total', 0, 'Resting energy'),
    M('dist_mi', 'Walking + Running Distance', 'walking_running_distance', 'activity', 'mi', 'total', 2, 'Walking + running'),
    M('exercise_min', 'Exercise Time', 'exercise_time', 'activity', 'min', 'total', 0, 'Exercise'),
    M('flights', 'Flights Climbed', 'flights_climbed', 'activity', 'floors', 'total', 0, 'Flights climbed'),
    M('hr', 'Heart Rate', 'heart_rate', 'heart', 'bpm', 'latest', 0, 'Heart rate'),
    M('hr_rest', 'Resting Heart Rate', 'resting_heart_rate', 'heart', 'bpm', 'latest', 0, 'Resting heart rate'),
    M('hrv', 'Heart Rate Variability', 'heart_rate_variability', 'heart', 'ms', 'latest', 0, 'Heart rate variability'),
    M('hr_walk', 'Walking Heart Rate Average', 'walking_heart_rate_average', 'heart', 'bpm', 'latest', 0, 'Walking heart rate'),
    M('sleep', 'Sleep Duration', 'sleep_duration', 'sleep', 'min', 'night', 0, 'Asleep'),
    M('in_bed', 'In Bed', 'in_bed', 'sleep', 'min', 'night', 0, 'In bed'),
    M('awake', 'Awake', 'awake', 'sleep', 'min', 'night', 0, 'Awake'),
    M('core', 'Core Sleep', 'core_sleep', 'sleep', 'min', 'night', 0, 'Core'),
    M('deep', 'Deep Sleep', 'deep_sleep', 'sleep', 'min', 'night', 0, 'Deep'),
    M('rem', 'REM Sleep', 'rem_sleep', 'sleep', 'min', 'night', 0, 'REM'),
    M('spo2', 'Blood Oxygen', 'blood_oxygen', 'vitals', '%', 'latest', 0, 'Blood oxygen'),
    M('resp', 'Respiratory Rate', 'respiratory_rate', 'vitals', '/min', 'latest', 1, 'Respiratory rate'),
    M('temp', 'Body Temperature', 'body_temperature', 'vitals', '°F', 'latest', 1, 'Body temperature'),
    M('temp_basal', 'Basal Body Temperature', 'basal_body_temperature', 'vitals', '°F', 'latest', 1, 'Basal body temperature'),
    M('bp_sys', 'Blood Pressure Systolic', 'blood_pressure_systolic', 'vitals', 'mmHg', 'latest', 0, 'Blood pressure, systolic'),
    M('bp_dia', 'Blood Pressure Diastolic', 'blood_pressure_diastolic', 'vitals', 'mmHg', 'latest', 0, 'Blood pressure, diastolic'),
    M('glucose', 'Blood Glucose', 'blood_glucose', 'vitals', 'mg/dL', 'latest', 0, 'Blood glucose'),
    M('vo2', 'VO2 Max', 'vo2_max', 'vitals', 'mL/kg/min', 'latest', 1, 'VO₂ max'),
  ];
  const CATS = [{ id: 'activity', name: 'Activity' }, { id: 'heart', name: 'Heart' }, { id: 'sleep', name: 'Sleep' }, { id: 'vitals', name: 'Vitals' }];
  const BY = Object.fromEntries(METRICS.map(m => [m.key, m]));
  const SLEEPY = new Set(METRICS.filter(m => m.cat === 'sleep').map(m => m.key));

  const get = key => BY[key] || null;
  const label = key => BY[key] ? BY[key].label : String(key);
  // A value kept to the metric's decimals (null: not a number).
  const round = (key, v) => { const n = Number(v), m = BY[key]; if (v === '' || v == null || !isFinite(n)) return null; const f = Math.pow(10, m ? m.digits : 2); return Math.round(n * f) / f; };
  // Minutes as "6 h 25 m" (sleep), "1 h" on the hour, "45 m" under an hour.
  const hm = v => { const t = Math.round(+v); return t >= 60 ? Math.floor(t / 60) + ' h' + (t % 60 ? ' ' + (t % 60) + ' m' : '') : t + ' m'; };
  // The number and its unit, apart (the page shows the unit smaller): { v: '8,412', u: 'steps' }.
  function parts(key, v, unit) {
    const m = BY[key], n = round(key, v);
    if (n == null) return { v: '—', u: '' };
    if (SLEEPY.has(key)) return { v: hm(n), u: '' };
    return { v: n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: m ? m.digits : 2 }), u: unit || (m ? m.unit : '') };
  }
  // As one line: "8,412 steps", "6 h 25 m", "98%", "62 bpm".
  function fmt(key, v, unit) { const p = parts(key, v, unit); return p.u === '%' ? p.v + '%' : p.u ? p.v + ' ' + p.u : p.v; }

  // Compact, for the tiles: "7h 20m", "45m".
  const hmShort = v => { const t = Math.round(+v); return t >= 60 ? Math.floor(t / 60) + 'h' + (t % 60 ? ' ' + (t % 60) + 'm' : '') : t + 'm'; };

  // ---------------------------------------------------------------------------------------------
  // At a glance: is a reading good? Each day's value gets 'good' | 'watch' | 'bad' | 'none'.
  // Healthy ranges (owner-approved; CDC, AHA, FDA): sleep 7 h+; exercise 150 min a week; steps
  // against your own daily goal; resting heart rate 60-100; blood pressure the AHA's categories;
  // blood oxygen 95-100%; breathing 12-20 a minute. Everything else is judged against your own usual
  // (typical, below). Activity and sleep are never red, except sleep far under your usual.
  // history: the days kept ([{ date, m: { key: value } }], data.health), or plain numbers already
  // picked; opts: { day (the day judged, YYYY-MM-DD), stepGoal, moveGoal, usual (your usual given,
  // from usualRanges, in place of working it out from history) }.
  // ---------------------------------------------------------------------------------------------
  const DAY = 864e5;
  const shift = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
  const num = v => v === '' || v == null || typeof v === 'boolean' || !isFinite(+v) ? null : +v;
  const valOf = (row, key) => row && row.m && typeof row.m === 'object' ? num(row.m[key]) : null;
  // The values of a reading from the day `from` to `to` (both kept), oldest first: [[date, value]].
  function series(key, history, from, to) {
    const out = [];
    for (const x of Array.isArray(history) ? history : []) {
      if (!x || typeof x.date !== 'string' || x.date < from || x.date > to) continue;
      const v = valOf(x, key); if (v != null) out.push([x.date, v]);
    }
    return out.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  }
  // The smallest change worth seeing (NEAR: the narrowest a typical range gets, and the least a
  // trend must move) and the smallest that counts as far from usual (FAR), in health.js's units, so
  // a very steady reading doesn't call every small wobble unusual.
  const NEAR = { steps: 1500, active_kcal: 60, rest_kcal: 80, dist_mi: 0.6, exercise_min: 8, flights: 3, hr: 4, hr_rest: 3, hrv: 6, hr_walk: 5,
    sleep: 25, in_bed: 25, awake: 10, core: 20, deep: 10, rem: 12, spo2: 1.5, resp: 1, temp: 0.5, temp_basal: 0.3, bp_sys: 6, bp_dia: 4, glucose: 10, vo2: 1.5 };
  const FAR = { hr: 15, hr_rest: 10, hrv: 20, hr_walk: 18, sleep: 120, spo2: 4, resp: 4, temp: 1.5, temp_basal: 1, bp_sys: 20, bp_dia: 12, glucose: 40, vo2: 5 };
  // Your usual: mean ± 1.5 SD of the 28 days before the day judged (7 days with a reading at least),
  // floored at NEAR; "far from usual" is beyond mean ± 3 SD, floored at FAR. Mean and SD rather than
  // a median: with a few weeks of daily values they are as steady, and simpler to check.
  function typical(key, history, day) {
    let vals;
    if (Array.isArray(history) && history.length && history.every(v => typeof v === 'number')) vals = history.filter(v => isFinite(v));
    else vals = series(key, history, day ? shift(day, -28) : '0000', day ? shift(day, -1) : '9999').map(p => p[1]);
    const n = vals.length;
    if (n < 7) return null;
    const mean = vals.reduce((s, v) => s + v, 0) / n;
    const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (n - 1));
    const near = NEAR[key] || 0, hw = Math.max(1.5 * sd, near), far = Math.max(3 * sd, FAR[key] || 2 * near, hw * 1.5);
    return { lo: mean - hw, hi: mean + hw, mean, sd, n, far };
  }
  const ORDER = { none: 0, good: 1, watch: 2, bad: 3 };
  const worse = (a, b) => ORDER[a] >= ORDER[b] ? a : b;
  // Your usual as given (opts.usual: { key: { lo, hi, mean, far } | null }, from usualRanges below:
  // the server judges with the ranges a phone sent, as it only sees a few days), else worked out
  // from history as always. A key opts.usual doesn't have is worked out from history.
  function typicalFor(key, history, o) {
    if (!(o && o.usual && typeof o.usual === 'object' && Object.prototype.hasOwnProperty.call(o.usual, key))) return typical(key, history, o && o.day);
    const T = o.usual[key];
    return T && ['lo', 'hi', 'mean', 'far'].every(k => typeof T[k] === 'number' && isFinite(T[k])) ? T : null;
  }
  // Against your usual, in the direction that matters ('high', 'low' or 'both'): null without a usual yet.
  function usual(key, v, history, o, dir) {
    const T = typicalFor(key, history, o);
    if (!T) return null;
    const d = v - T.mean, up = dir !== 'low', down = dir !== 'high';
    if ((up && d > T.far) || (down && -d > T.far)) return 'bad';
    if ((up && v > T.hi) || (down && v < T.lo)) return 'watch';
    return 'good';
  }
  function status(key, value, history, opts) {
    const o = opts || {}, v = num(value), day = o.day;
    if (v == null || !BY[key]) return 'none';
    switch (key) {
      case 'sleep': {   // 7 h+ is good; under it, check; red only when far under your usual
        if (v >= 420) return 'good';
        const T = typicalFor(key, history, o);
        return T && T.mean - v > T.far ? 'bad' : 'watch';
      }
      // Short of a goal today isn't judged yet (the day isn't over): no dot until it's met.
      case 'steps': return v >= (+o.stepGoal > 0 ? +o.stepGoal : 10000) ? 'good' : day && day === o.today ? 'none' : 'watch';
      case 'exercise_min': {   // the 150 minutes a week: this day and the 6 before
        const week = v + (day ? series(key, history, shift(day, -6), shift(day, -1)).reduce((s, p) => s + p[1], 0) : 0);
        return week >= 150 ? 'good' : day && day === o.today ? 'none' : 'watch';
      }
      case 'hr_rest': {   // over 100 is red; under 60 is fine when it's your usual
        if (v > 100) return 'bad';
        const T = typicalFor(key, history, o);
        if (!T) return 'good';
        if (v - T.mean > T.far) return 'bad';
        if (v > T.hi) return 'watch';
        return v < 60 && v < T.lo ? 'watch' : 'good';
      }
      case 'spo2': return worse(v >= 95 ? 'good' : v >= 90 ? 'watch' : 'bad', usual(key, v, history, o,'low') || 'none');
      case 'resp': return worse(v >= 12 && v <= 20 ? 'good' : 'watch', usual(key, v, history, o,'both') || 'none');
      // Blood pressure, the AHA's: under 120/80 normal; 120-129 and under 80 elevated; 130-139 or
      // 80-89 stage 1; 140+ or 90+ stage 2 (and over 180/120 a crisis). Each number on its own: the
      // pair's category is the worse of the two. A reading far over your usual is red too.
      case 'bp_sys': return worse(v >= 140 ? 'bad' : v >= 120 ? 'watch' : 'good', usual(key, v, history, o,'high') || 'none');
      case 'bp_dia': return worse(v >= 90 ? 'bad' : v >= 80 ? 'watch' : 'good', usual(key, v, history, o,'high') || 'none');
      case 'hr': case 'hr_walk': return usual(key, v, history, o,'high') || 'none';
      case 'hrv': case 'vo2': return usual(key, v, history, o,'low') || 'none';
      case 'temp': case 'temp_basal': case 'glucose': return usual(key, v, history, o,'both') || 'none';
      default: return 'none';   // the rest of Activity, and the sleep stages: shown, not judged
    }
  }
  // Every reading of a day: { key: status } (only the ones it has).
  function statuses(day, history, opts) {
    const row = (Array.isArray(history) ? history : []).find(x => x && x.date === day), out = {};
    for (const m of METRICS) { const v = valOf(row, m.key); if (v != null) out[m.key] = status(m.key, v, history, Object.assign({}, opts, { day })); }
    return out;
  }
  // A category's status on a day: the worst of its readings that day ('none': nothing judged).
  function catStatus(cat, day, history, opts) {
    const all = statuses(day, history, opts);
    return METRICS.filter(m => m.cat === cat && all[m.key]).reduce((s, m) => worse(s, all[m.key]), 'none');
  }
  // The vitals off on a day, as the Vitals tile counts them, and the server's vitals alert
  // (functions/fitness/api, alerts/check) with it: all, a day's statuses (above) -> { n: readings,
  // rated: judged, off: 'watch' or 'bad' }. Blood pressure counts once (the worse of its two numbers).
  function vitalsOff(all) {
    const s = {}; for (const m of METRICS) if (m.cat === 'vitals' && all && all[m.key]) { const k = /^bp_/.test(m.key) ? 'bp' : m.key; s[k] = worse(s[k] || 'none', all[m.key]); }
    const v = Object.values(s);
    return { n: v.length, rated: v.filter(x => x !== 'none').length, off: v.filter(x => x === 'watch' || x === 'bad').length };
  }
  // Your usual for each vital on a day (the 28 days before it, as typical), small enough to send: the
  // phone sends it for the vitals alert, as the server only sees the days Home Assistant keeps.
  // -> { key: { lo, hi, mean, far } | null (no usual yet) }, for opts.usual.
  const r3 = x => Math.round(x * 1000) / 1000;
  function usualRanges(history, day) {
    const out = {};
    for (const m of METRICS) {
      if (m.cat !== 'vitals') continue;
      const T = typical(m.key, history, day);
      out[m.key] = T ? { lo: r3(T.lo), hi: r3(T.hi), mean: r3(T.mean), far: r3(T.far) } : null;
    }
    return out;
  }
  // The healthy range a chart shades ({ lo, hi }; hi null: "at least", drawn as a line), where there is one.
  function band(key, opts) {
    const o = opts || {};
    switch (key) {
      case 'sleep': return { lo: 420, hi: 540 };
      case 'spo2': return { lo: 95, hi: 100 };
      case 'resp': return { lo: 12, hi: 20 };
      case 'bp_sys': return { lo: 90, hi: 120 };
      case 'bp_dia': return { lo: 60, hi: 80 };
      case 'steps': return { lo: +o.stepGoal > 0 ? +o.stepGoal : 10000, hi: null };
      case 'active_kcal': return { lo: +o.moveGoal > 0 ? +o.moveGoal : 500, hi: null };
      case 'exercise_min': return { lo: 30, hi: null };
      default: return null;
    }
  }
  // A trend worth saying: the last 7 days' average (3 days with a reading at least) against your
  // 90-day average (21 days, 7 of them over 4 weeks back), else your 28-day one (14 days); only a
  // change of NEAR and half a day-to-day SD or more. { recent, base, diff, over: 90 | 28 } or null.
  function trend(key, history, day) {
    const recent = series(key, history, shift(day, -6), day).map(p => p[1]);
    if (recent.length < 3) return null;
    const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
    const long = series(key, history, shift(day, -89), day), old = long.filter(p => p[0] < shift(day, -27));
    let over = 90, base = long.map(p => p[1]);
    if (!(base.length >= 21 && old.length >= 7)) { over = 28; base = series(key, history, shift(day, -27), day).map(p => p[1]); if (base.length < 14) return null; }
    const m = avg(base), sd = Math.sqrt(base.reduce((s, v) => s + (v - m) * (v - m), 0) / Math.max(1, base.length - 1)), r = avg(recent), diff = r - m;
    if (!diff || Math.abs(diff) < Math.max(NEAR[key] || 0, sd / 2)) return null;
    return { recent: r, base: m, diff, over };
  }

  // ---------------------------------------------------------------------------------------------
  // Sleep score: Fitness's own, 0-100, not Apple's (Apple Health has none). A night's
  // { sleep, in_bed, awake, core, deep, rem } in minutes -> { score, level, parts } or null.
  //   duration   50  full for 7-9 h asleep, down in a line to 0 at 4 h, a little less over 9 h
  //   deep       15  deep sleep's share of the time asleep: full at 13-23%
  //   rem        20  REM's share: full at 20-25%
  //   efficiency 15  asleep ÷ in bed (or asleep + awake): full at 85%+, 0 at 50%
  // Without stages (or in-bed time) the parts there are share the 100. Apple Watch tends to
  // underestimate deep sleep, so deep's full marks start at 13%, the low end of the usual range.
  // parts[k]: { pts, of, v } (v: minutes, or a share 0-1), or null when it couldn't be scored.
  // ---------------------------------------------------------------------------------------------
  const WEIGHTS = { duration: 50, deep: 15, rem: 20, efficiency: 15 };
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const sleepLevel = s => s <= 40 ? 'Very low' : s <= 60 ? 'Low' : s <= 80 ? 'OK' : s <= 95 ? 'High' : 'Very high';
  function sleepScore(m) {
    if (!m || typeof m !== 'object') return null;
    const g = k => { const v = num(m[k]); return v != null && v >= 0 ? v : null; };
    const deep = g('deep'), rem = g('rem'), core = g('core'), awake = g('awake'), inBed = g('in_bed');
    let asleep = g('sleep');
    if (asleep == null && deep != null && rem != null && core != null) asleep = deep + rem + core;
    if (!asleep) return null;
    const h = asleep / 60;
    const raw = { duration: [h < 4 ? 0 : h < 7 ? (h - 4) / 3 : h <= 9 ? 1 : Math.max(0.8, 1 - (h - 9) * 0.1), asleep] };
    if (deep != null && rem != null) {
      const ds = deep / asleep, rs = rem / asleep;
      raw.deep = [ds < 0.13 ? ds / 0.13 : ds <= 0.23 ? 1 : clamp01(1 - (ds - 0.23) / 0.2), ds];
      raw.rem = [rs < 0.2 ? rs / 0.2 : rs <= 0.25 ? 1 : clamp01(1 - (rs - 0.25) / 0.2), rs];
    }
    const bed = inBed != null && inBed >= asleep ? inBed : awake != null ? asleep + awake : null;
    if (bed) { const e = asleep / bed; raw.efficiency = [e >= 0.85 ? 1 : clamp01((e - 0.5) / 0.35), e]; }
    const total = Object.keys(raw).reduce((s, k) => s + WEIGHTS[k], 0), parts = {};
    let score = 0;
    for (const k of Object.keys(WEIGHTS)) {
      if (!raw[k]) { parts[k] = null; continue; }
      const of = WEIGHTS[k] * 100 / total, pts = Math.round(clamp01(raw[k][0]) * of);
      parts[k] = { pts, of: Math.round(of), v: raw[k][1] }; score += pts;
    }
    score = Math.max(0, Math.min(100, score));
    return { score, level: sleepLevel(score), parts };
  }

  root.FitnessHealth = { METRICS, CATS, get, label, round, parts, fmt, hm, hmShort,
    shift, series, typical, status, statuses, catStatus, vitalsOff, usualRanges, worse, band, trend, sleepScore, sleepLevel, NEAR, FAR };
})(typeof window !== 'undefined' ? window : globalThis);
