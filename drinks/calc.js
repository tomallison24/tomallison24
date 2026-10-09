"use strict";

// Drinks' maths: standard drinks, what each day was, the Analysis windows,
// alcohol-free streaks, and reading an ABV Tracker export. Pure functions,
// no page, so they can be tested in Node (drinks/scripts/calc-test.mjs);
// app.js draws the result.
//
// A standard drink is the US one: 14 g of alcohol. A drink's alcohol is
//   millilitres × quantity × ABV ÷ 100 × 0.789 (the density of ethanol, g/ml)
// with a fluid ounce of 29.5735 ml. So 12 oz of 5% beer is 14.0 g, one
// standard drink. functions/drinks/api/[[route]].js works the same sum out
// for Calendar's layer; keep the two the same.
//
// A day is one of:
//   drinks    something was logged that day
//   af        marked alcohol-free
//   unknown   marked "don't remember": left out of averages
//   none      nothing logged and not marked (also left out of averages)
// Logging a drink on a day marked alcohol-free makes it a drinks day.
(function (root) {
  const OZ_ML = 29.5735, ETHANOL = 0.789, STD_G = 14;
  const D = 864e5;
  const ISO = /^\d{4}-\d{2}-\d{2}$/;

  // The kinds of drink: a typical size and strength for each, used to fill
  // the form in when you pick one. A cocktail is logged as the spirit in it.
  const CATS = [
    { id: 'beer', name: 'Beer', vol: 12, unit: 'oz', abv: 5 },
    { id: 'wine', name: 'Wine', vol: 5, unit: 'oz', abv: 13 },
    { id: 'spirits', name: 'Spirits', vol: 1.5, unit: 'oz', abv: 40 },
    { id: 'cocktail', name: 'Cocktail', vol: 2, unit: 'oz', abv: 40 },
    { id: 'seltzer', name: 'Seltzer', vol: 12, unit: 'oz', abv: 5 },
    { id: 'cider', name: 'Cider', vol: 12, unit: 'oz', abv: 5 },
    { id: 'other', name: 'Other', vol: 12, unit: 'oz', abv: 5 },
  ];
  const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
  // The ABV Tracker's presets, so the drinks you had there are one tap here too.
  const PRESETS = [
    { name: 'Beer', cat: 'beer', vol: 12, unit: 'oz', abv: 5 },
    { name: 'IPA', cat: 'beer', vol: 16, unit: 'oz', abv: 6.8 },
    { name: 'Wine', cat: 'wine', vol: 5, unit: 'oz', abv: 13 },
    { name: 'Large wine', cat: 'wine', vol: 8, unit: 'oz', abv: 14 },
    { name: 'Shot', cat: 'spirits', vol: 1.5, unit: 'oz', abv: 40 },
    { name: 'Cocktail', cat: 'cocktail', vol: 2, unit: 'oz', abv: 40 },
    { name: 'Hard seltzer', cat: 'seltzer', vol: 12, unit: 'oz', abv: 5 },
    { name: 'Cider', cat: 'cider', vol: 12, unit: 'oz', abv: 4.5 },
  ];
  // Sizes and strengths offered in the pickers (anything else you had stays as it was).
  const SIZES = {
    oz: [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 9, 10, 12, 14, 16, 19.2, 20, 22, 24, 25.4, 32, 40, 64],
    ml: [25, 30, 35, 44, 50, 60, 75, 100, 125, 150, 175, 187, 200, 250, 275, 330, 355, 375, 440, 473, 500, 568, 650, 750, 1000],
  };
  const ABVS = [0.5, 1, 2, 2.5, 3, 3.5, 4, 4.2, 4.5, 5, 5.5, 6, 6.5, 6.8, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5,
    13, 13.5, 14, 14.5, 15, 16, 17, 18, 20, 22, 25, 30, 35, 37.5, 40, 42, 43, 45, 46, 50, 55, 60];
  const GOALS = { week: 14, day: 4, af: 3 };

  const num = v => { const n = +v; return isFinite(n) ? n : 0; };
  const grams = x => (x.unit === 'ml' ? num(x.vol) : num(x.vol) * OZ_ML) * Math.max(0, num(x.qty) || 0) * num(x.abv) / 100 * ETHANOL;
  const std = x => grams(x) / STD_G;
  const round = (n, d = 1) => { const p = Math.pow(10, d); return Math.round(n * p) / p; };
  // Dates are 'YYYY-MM-DD' strings; the sums run in UTC so a day is always 24 hours.
  const add = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * D).toISOString().slice(0, 10);
  const between = (s, from, to) => s >= from && s <= to;

  const okEntry = x => x && typeof x.id === 'string' && ISO.test(x.date || '') && num(x.vol) > 0 && num(x.qty) > 0 && num(x.abv) >= 0 && num(x.abv) <= 100;
  // What was had each day: standard drinks, how many drinks, and by kind.
  function byDay(entries) {
    const m = new Map();
    for (const x of entries || []) {
      if (!okEntry(x)) continue;
      let d = m.get(x.date);
      if (!d) m.set(x.date, d = { sd: 0, n: 0, cats: {} });
      const s = std(x);
      d.sd += s; d.n += num(x.qty);
      const c = CAT[x.cat] ? x.cat : 'other';
      d.cats[c] = (d.cats[c] || 0) + s;
    }
    return m;
  }
  // The days you marked: { date: 'af' | 'unknown' }.
  function marks(days) {
    const out = {};
    for (const x of days || []) if (x && ISO.test(x.id || '') && (x.status === 'af' || x.status === 'unknown')) out[x.id] = x.status;
    return out;
  }
  const statusOf = (date, map, mk) => map.has(date) ? 'drinks' : mk[date] || 'none';

  // A window of days, [from, to], up to today (later days are not counted yet).
  function stats(entries, days, from, to, today, cache) {
    const map = cache ? cache.map : byDay(entries), mk = cache ? cache.mk : marks(days);
    const out = { from, to, sd: 0, drinks: 0, drinkingDays: 0, afDays: 0, unknownDays: 0, notRecorded: 0, recorded: 0, heaviest: null, cats: {}, overDay: 0 };
    const last = to < today ? to : today;
    for (let d = from; d <= last; d = add(d, 1)) {
      const s = statusOf(d, map, mk);
      if (s === 'drinks') {
        const x = map.get(d);
        out.sd += x.sd; out.drinks += x.n; out.drinkingDays++; out.recorded++;
        if (!out.heaviest || x.sd > out.heaviest.sd) out.heaviest = { date: d, sd: x.sd };
        for (const c in x.cats) out.cats[c] = (out.cats[c] || 0) + x.cats[c];
      } else if (s === 'af') { out.afDays++; out.recorded++; }
      else if (s === 'unknown') out.unknownDays++;
      else out.notRecorded++;
    }
    // A day's average over the days you recorded (drinks or alcohol-free).
    out.avg = out.recorded ? out.sd / out.recorded : null;
    return out;
  }
  const overDays = (entries, from, to, max) => { let n = 0; byDay(entries).forEach((x, d) => { if (between(d, from, to) && round(x.sd, 2) > max) n++; }); return n; };

  // Analysis: the last n days (ending today) against the n days before.
  function compare(entries, days, today, n) {
    const cache = { map: byDay(entries), mk: marks(days) };
    const range = { from: add(today, -(n - 1)), to: today };
    range.beforeTo = add(range.from, -1); range.beforeFrom = add(range.beforeTo, -(n - 1));
    const now = stats(null, null, range.from, range.to, today, cache);
    const before = stats(null, null, range.beforeFrom, range.beforeTo, today, cache);
    return { range, now, before, hasNow: now.recorded > 0, hasBefore: before.recorded > 0 };
  }

  // Alcohol-free streaks: days in a row marked alcohol-free. Today counts once
  // it is marked; until then it doesn't break the streak (so it isn't 0 every
  // morning). Drinks, "don't remember" and unrecorded days end a streak.
  function streaks(entries, days, today) {
    const map = byDay(entries), mk = marks(days);
    const af = d => statusOf(d, map, mk) === 'af';
    let d = today;
    if (!af(d) && statusOf(d, map, mk) === 'none') d = add(d, -1);
    let current = 0;
    while (af(d)) { current++; d = add(d, -1); }
    const afDates = Object.keys(mk).filter(x => af(x) && x <= today).sort();
    let best = 0, run = 0, prev = null;
    for (const x of afDates) { run = prev && add(prev, 1) === x ? run + 1 : 1; prev = x; if (run > best) best = run; }
    return { current, best: Math.max(best, current) };
  }

  // ---------------------------------------------------------------------
  // Bringing in the ABV Tracker: its JSON backup (Export JSON backup), or
  // its Google Sheet's Log tab downloaded as CSV (File → Download → .csv).
  // Its "Alcohol-free day" and "Unknown day" rows become marked days; its
  // connection test row is skipped. Each drink keeps the tracker's entry id
  // (as abv-<id>), so bringing the same file in twice adds nothing.
  // ---------------------------------------------------------------------
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim() !== ''));
  }
  const pad = n => String(n).padStart(2, '0');
  function isoDate(s) {
    s = String(s || '').trim();
    if (ISO.test(s)) return s;
    let m = /^(\d{4})-(\d{2})-(\d{2})T/.exec(s); if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);   // a Sheet set to US dates: 8/11/2026
    if (m) return m[3] + '-' + pad(m[1]) + '-' + pad(m[2]);
    return null;
  }
  function hhmm(s) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(s || '').trim());
    return m && +m[1] < 24 ? pad(m[1]) + ':' + m[2] : '';
  }
  // The tracker named drinks with their size and strength ("Wine large 8oz 14%");
  // Drinks shows those on their own line, so the name keeps just the words.
  const shortName = s => String(s || '').replace(/\s+\d+(\.\d+)?\s?(oz|ml)\b/i, '').replace(/\s+\d+(\.\d+)?%$/, '').trim().slice(0, 60);
  const catOf = c => { const k = String(c || '').trim().toLowerCase(); return CAT[k] ? k : k === 'spirit' ? 'spirits' : 'other'; };
  const cleanId = s => String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  function oneRow(r, out) {
    const date = isoDate(r.date), cat = String(r.category || '').trim().toLowerCase(), id = cleanId(r.id);
    if (!date || id === 'test' || /^__connection test__$/i.test(String(r.name || '').trim())) { out.skipped++; return; }
    if (cat === 'alcohol-free' || cat === 'unknown') { out.days.set(date, cat === 'unknown' ? 'unknown' : 'af'); return; }
    const x = { id: 'abv-' + (id || date + '-' + out.entries.size), date, time: hhmm(r.time), name: shortName(r.name),
      cat: catOf(r.category), vol: num(r.volume), unit: String(r.unit).trim().toLowerCase() === 'ml' ? 'ml' : 'oz',
      abv: num(r.abv), qty: Math.round(num(r.qty)) || 1, note: String(r.note || '').trim().slice(0, 200) };
    if (x.note.toLowerCase() === 'backfilled') x.note = '';
    if (!okEntry(x)) { out.skipped++; return; }
    out.entries.set(x.id, x);
  }
  function fromAbvTracker(text) {
    const out = { entries: new Map(), days: new Map(), goals: null, skipped: 0 };
    text = String(text || '').replace(/^﻿/, '').trim();
    if (text.startsWith('{')) {
      let s; try { s = JSON.parse(text); } catch { throw new Error('not-a-backup'); }
      if (!s || !Array.isArray(s.entries)) throw new Error('not-a-backup');
      for (const e of s.entries) oneRow({ date: e.date, time: e.time, name: e.name, category: e.cat, volume: e.vol, unit: e.unit, abv: e.abv, qty: e.qty, note: e.note, id: e.id }, out);
      for (const d of s.unknown || []) { const k = isoDate(d); if (k) out.days.set(k, 'unknown'); }
      for (const d of s.dry || []) { const k = isoDate(d); if (k) out.days.set(k, 'af'); }
      const c = s.cfg || {};
      if (c.week || c.day || c.af != null) out.goals = { week: num(c.week) || GOALS.week, day: num(c.day) || GOALS.day, af: c.af == null ? GOALS.af : Math.max(0, Math.min(7, Math.round(num(c.af)))) };
    } else {
      const rows = parseCSV(text);
      const head = (rows.shift() || []).map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
      const col = k => head.indexOf(k);
      const need = ['date', 'name', 'category', 'volume', 'abv'];
      if (need.some(k => col(k) < 0)) throw new Error('not-a-log');
      const at = { date: col('date'), time: col('time'), name: col('name'), category: col('category'), volume: col('volume'), unit: col('unit'), abv: col('abv'), qty: col('qty'), note: col('note'), id: col('entryid') };
      for (const r of rows) { const o = {}; for (const k in at) o[k] = at[k] < 0 ? '' : r[at[k]]; oneRow(o, out); }
    }
    // A day with drinks isn't alcohol-free, whatever it was marked.
    const drinkDays = new Set([...out.entries.values()].map(x => x.date));
    for (const d of [...out.days.keys()]) if (drinkDays.has(d)) out.days.delete(d);
    return { entries: [...out.entries.values()], days: [...out.days].map(([id, status]) => ({ id, status })), goals: out.goals, skipped: out.skipped };
  }

  root.DrinksCalc = { OZ_ML, ETHANOL, STD_G, CATS, CAT, PRESETS, SIZES, ABVS, GOALS, grams, std, round, add, okEntry, byDay, marks, statusOf, stats, overDays, compare, streaks, parseCSV, fromAbvTracker };
})(typeof window !== 'undefined' ? window : globalThis);
