"use strict";

// Fitness's Analysis: where you are getting stronger, and where you have
// slipped, from the log alone. Pure functions, no page, so they can be
// tested in Node (fitness/scripts/analysis-test.mjs); app.js draws the result.
//
// A reading compares two windows of the same length that end today: the
// last 7 days against the 7 before (Week), or the last 28 days against the
// 28 before (Month; four whole weeks, so each window has the same weekdays).
//
// - Totals: days trained, sets, and volume (weight × reps × sets, for
//   exercises done with a weight).
// - Each exercise done in the latest window is compared with its best in the
//   window before, or, if it wasn't done then, with the last time it was
//   done at all. "Best" is the strongest entry:
//     with a weight   estimated one-rep max, weight × (1 + reps ÷ 30)
//                     (Epley), so 105 lb × 6 counts as stronger than 95 lb × 8
//     bodyweight      reps
//     a hold          seconds
//     cardio          speed (distance ÷ minutes) when a distance was
//                     logged, otherwise minutes
//   Under 1% either way is "steady"; entries of different kinds (a
//   bodyweight pull-up against a weighted one, or a timed treadmill against
//   one with a distance) aren't compared.
// - Cardio minutes are totalled on their own; cardio done before but none
//   now needs work too.
// - Muscle groups: sets in each window. A group trained before but not now,
//   or with under 70% of its sets (from at least 3), needs work.
(function (root) {
  const D = 864e5;
  const add = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * D).toISOString().slice(0, 10);
  const kindOf = x => x.cardio ? (+x.dist > 0 ? 'pace' : 'mins') : x.timed ? 'time' : +x.weight > 0 ? 'load' : 'reps';
  const score = x => x.cardio ? (+x.dist > 0 ? +x.dist / Math.max(1, +x.mins || 0) : +x.mins || 0)
    : x.timed ? +x.reps : +x.weight > 0 ? +x.weight * (1 + +x.reps / 30) : +x.reps;
  const key = x => String(x.exercise).trim().toLowerCase();
  const better = (a, b) => !b || score(a) > score(b) || (score(a) === score(b) && a.date > b.date);

  // Totals and each exercise's best for the logs in [from, to].
  function summarize(logs, from, to) {
    const days = new Set(), groups = {}, ex = new Map();
    let sets = 0, volume = 0, mins = 0;
    for (const x of logs) {
      if (x.date < from || x.date > to) continue;
      const n = Math.max(0, +x.sets || 0);
      days.add(x.date); sets += n;
      if (x.cardio) mins += Math.max(0, +x.mins || 0);
      groups[x.group] = (groups[x.group] || 0) + n;
      if (!x.timed && +x.weight > 0) volume += +x.weight * (+x.reps || 0) * n;
      const k = key(x), cur = ex.get(k);
      // The best of each kind: a weighted entry never hides a bodyweight one.
      const slot = cur && cur.byKind[kindOf(x)];
      if (!cur) ex.set(k, { name: x.exercise, group: x.group, last: x, byKind: { [kindOf(x)]: x } });
      else {
        if (better(x, slot)) cur.byKind[kindOf(x)] = x;
        if (x.date >= cur.last.date) { cur.last = x; cur.name = x.exercise; cur.group = x.group; }
      }
    }
    return { workouts: days.size, sets, volume: Math.round(volume), cardio: mins, groups, ex, any: days.size > 0 };
  }

  function analyze(logs, today, days, groupIds) {
    const list = (logs || []).filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') && typeof x.exercise === 'string');
    const range = { from: add(today, -(days - 1)), to: today };
    range.beforeTo = add(range.from, -1); range.beforeFrom = add(range.beforeTo, -(days - 1));
    const now = summarize(list, range.from, range.to), before = summarize(list, range.beforeFrom, range.beforeTo);

    const up = [], down = [], same = [], fresh = [];
    for (const [k, e] of now.ex) {
      const kind = kindOf(e.last), cur = e.byKind[kind];
      let base = before.ex.get(k) && before.ex.get(k).byKind[kind], when = 'before';
      if (!base) {
        // Not done in the window before: the last time it was done at all.
        const earlier = list.filter(x => key(x) === k && kindOf(x) === kind && x.date < range.from);
        const lastDay = earlier.reduce((m, x) => x.date > m ? x.date : m, '');
        for (const x of earlier) if (x.date === lastDay && better(x, base)) base = x;
        when = 'earlier';
      }
      const row = { name: e.name, group: e.group, kind, now: cur, was: base || null, when };
      if (!base) { fresh.push(row); continue; }
      row.change = score(base) > 0 ? (score(cur) - score(base)) / score(base) : 0;
      (row.change > 0.01 ? up : row.change < -0.01 ? down : same).push(row);
    }
    up.sort((a, b) => b.change - a.change); down.sort((a, b) => a.change - b.change);
    const byName = (a, b) => a.name.localeCompare(b.name);
    same.sort(byName); fresh.sort(byName);

    const ids = groupIds || [...new Set([...Object.keys(now.groups), ...Object.keys(before.groups)])];
    const groups = ids.map(id => ({ id, now: now.groups[id] || 0, before: before.groups[id] || 0 }));
    const missed = groups.filter(g => g.before > 0 && g.now === 0);
    const dropped = groups.filter(g => g.before >= 3 && g.now > 0 && g.now < g.before * 0.7);

    const totals = ['workouts', 'sets', 'volume', 'cardio'].map(k => ({ id: k, now: now[k], before: before[k] }));
    const cardioMissed = before.cardio > 0 && now.cardio === 0 ? { before: before.cardio } : null;
    return { range, days, totals, up, down, same, fresh, groups, missed, dropped, cardioMissed,
      hasNow: now.any, hasBefore: before.any, score, kindOf };
  }

  root.FitnessAnalysis = { analyze, score, kindOf, add };
})(typeof window !== 'undefined' ? window : globalThis);
