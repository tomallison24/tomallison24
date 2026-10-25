"use strict";

// Fitness's Meds: which doses are due on a day, and how often each was taken.
// Pure functions, no page, so they can be tested in Node
// (fitness/scripts/meds-test.mjs); app.js draws the result.
//
// A med (or supplement) is { id, slots, days, prn, paused, since }:
//   slots   when in the day: 'am' (Morning), 'mid' (Midday), 'pm' (Evening),
//           'bed' (Bedtime); none means once a day, any time ('day')
//   days    the weekdays it's taken on, 0 Sunday to 6 Saturday; none means every day
//   prn     as needed: logged each time it's taken, never "due", never missed
//   paused  stopped for now: not due, and left out of the numbers
//   since   the day it was added (YYYY-MM-DD): nothing is due before it
// A dose is { med, date, slot }: one tick on the checklist.
//
// Taken, as a share: the doses taken out of those due, over the last 7 or 30
// days. Today only counts once everything due today is in, so a morning check
// never reads as a miss. A streak is the run of days with everything taken,
// up to yesterday (or today, once today is done); days it isn't taken on
// don't break it. With the Google Sheet connected the phone keeps only the
// last 90 days of doses (app.js), so 'floor' is the first day still here:
// nothing before it is counted as missed, and a streak that reaches it says so.
(function (root) {
  const D = 864e5;
  const add = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * D).toISOString().slice(0, 10);
  const weekday = s => new Date(Date.parse(s + 'T00:00:00Z')).getUTCDay();
  const SLOT_ORDER = ['am', 'mid', 'pm', 'bed', 'day'];

  const slotsOf = m => Array.isArray(m.slots) && m.slots.length ? SLOT_ORDER.filter(s => m.slots.includes(s)) : ['day'];
  const takesOn = (m, day) => !!m && !m.paused && !m.prn && (!m.since || day >= m.since)
    && (!Array.isArray(m.days) || !m.days.length || m.days.includes(weekday(day)));

  // date|med|slot -> taken, for quick look-ups
  const index = doses => { const s = new Set(); for (const x of doses || []) if (x) s.add(x.date + '|' + x.med + '|' + x.slot); return s; };

  // What's due on a day: [{ med, slot }], in the order of the day.
  function dueOn(meds, day) {
    const out = [];
    for (const m of meds || []) if (takesOn(m, day)) for (const slot of slotsOf(m)) out.push({ med: m, slot });
    return out.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  }

  // Taken out of due over the n days ending today: { due, taken, share } (share null: nothing due).
  function adherence(m, doses, today, n, floor, idx) {
    const got = idx || index(doses);
    let due = 0, taken = 0;
    for (let i = 0; i < n; i++) {
      const d = add(today, -i);
      if (floor && d < floor) break;
      if (!takesOn(m, d)) continue;
      const sl = slotsOf(m), t = sl.filter(s => got.has(d + '|' + m.id + '|' + s)).length;
      if (d === today && t < sl.length) continue;
      due += sl.length; taken += t;
    }
    return { due, taken, share: due ? taken / due : null };
  }

  // Days in a row with everything taken: { days, more } (more: it runs back past what's kept).
  function streak(m, doses, today, floor, idx) {
    const got = idx || index(doses);
    const done = d => slotsOf(m).every(s => got.has(d + '|' + m.id + '|' + s));
    let d = today, days = 0;
    if (!takesOn(m, d) || !done(d)) d = add(d, -1);
    for (let i = 0; i < 800; i++, d = add(d, -1)) {
      if (m.since && d < m.since) return { days, more: false };
      if (floor && d < floor) return { days, more: days > 0 };
      if (!takesOn(m, d)) continue;
      if (!done(d)) break;
      days++;
    }
    return { days, more: false };
  }

  root.FitnessMeds = { dueOn, adherence, streak, takesOn, slotsOf, index, add };
})(typeof window !== 'undefined' ? window : globalThis);
