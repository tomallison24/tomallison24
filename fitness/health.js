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

  root.FitnessHealth = { METRICS, CATS, get, label, round, parts, fmt, hm };
})(typeof window !== 'undefined' ? window : globalThis);
