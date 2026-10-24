'use strict';

// Sparkle Kingdom's learning engine: where each child is on each skill's ladder, how a round is
// put together, when a word comes back for review, what a round earns, and how two phones' copies
// of a player are merged. Pure functions, no page, so they can be tested in Node
// (sparkle/scripts/logic-test.mjs); app.js draws the result and content.js makes the questions.
//
// A skill is a ladder of numbered levels (read 1-12, math 1-10, wand 1-7: content.js LADDERS).
// Each skill keeps its own place, so being good at adding never pushes subtraction too fast.
//
//   Moving on the ladder (her last 10 answers on that skill; a right answer after a hint is half):
//     up one level    4 right in a row, or 9 of the last 10
//     down one level  2 misses in a row on new items, or 6 or fewer of the last 10
//     stay            anything else
//   The warm-up (her first visit to a skill): up to 6 questions that climb a level for each right
//   answer (two at a time early on a long ladder) until a second miss; she starts one level below
//   the second miss, or where the climb ended.
//   Review: a word, sound or fact she missed (or just learned) comes back 1, 3 and 7 days later,
//   and counts as known once she has had it right on 3 separate days.
//   A round: 6 to 8 questions, about a quarter review, the rest from her level and the two below
//   (mixed practice), ending on one she is very likely to get right.
//   Coins: 1 for each right answer (first or second try), 3 for finishing a round. Never taken away.
//
// The thresholds are in TUNE, so they can be changed after watching her play.
(function (root) {
  const TUNE = {
    upStreak: 4, upOf10: 9, downOf10: 6, downMisses: 2, window: 10,
    warmMax: 6, warmMisses: 2,
    review: [1, 3, 7], knownDays: 3,
    roundMin: 6, roundMax: 8, reviewShare: 0.25,
    coinRight: 1, coinRound: 3, giftEvery: 4,
  };
  const DAY = 864e5;

  // ---- days: a day is its local date, YYYY-MM-DD; dayNum counts days so intervals are simple ----
  const pad = n => String(n).padStart(2, '0');
  const today = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const dayNum = iso => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);
  const addDays = (iso, n) => { const d = new Date((dayNum(iso) + n) * DAY); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

  // ---- a seeded random, so a round can be replayed in tests ----
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    const next = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
    next.pick = a => a[Math.floor(next() * a.length)];
    next.shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    return next;
  }

  // ---- a skill's place on its ladder ----
  const newSkill = (start = 1) => ({ level: start, hist: [], streak: 0, misses: 0, answers: 0, placed: false, warm: null, best: start });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // score: 1 right first try, 0.5 right after a hint, 0 missed. fresh: the item was a new one (not review).
  // Returns the move: 1 up, -1 down, 0 stay.
  function record(sk, score, max, fresh = true) {
    sk.answers++;
    sk.hist.push(score); if (sk.hist.length > TUNE.window) sk.hist.shift();
    if (score === 1) { sk.streak++; sk.misses = 0; }
    else { sk.streak = 0; if (score === 0 && fresh) sk.misses++; else if (score > 0) sk.misses = 0; }
    const sum = sk.hist.reduce((a, b) => a + b, 0), full = sk.hist.length >= TUNE.window;
    let move = 0;
    if (sk.streak >= TUNE.upStreak || (full && sum >= TUNE.upOf10)) move = 1;
    else if (sk.misses >= TUNE.downMisses || (full && sum <= TUNE.downOf10)) move = -1;
    const to = clamp(sk.level + move, 1, max);
    if (to === sk.level) move = 0;
    if (move) { sk.level = to; sk.hist = []; sk.streak = 0; sk.misses = 0; sk.best = Math.max(sk.best || 1, to); }
    return move;
  }

  // ---- the warm-up ----
  const warmStart = (start = 1) => ({ level: start, asked: 0, misses: 0, done: false });
  // right: answered right first try. max: the ladder's top. Returns the warm-up, done with .place when over.
  function warmStep(w, right, max) {
    w.asked++;
    if (right) w.level = clamp(w.level + (w.asked <= 3 && max >= 10 ? 2 : 1), 1, max);
    else w.misses++;
    if (w.misses >= TUNE.warmMisses) { w.done = true; w.place = clamp(w.level - 1, 1, max); }
    else if (w.asked >= TUNE.warmMax) { w.done = true; w.place = clamp(right ? w.level : w.level - 1, 1, max); }
    return w;
  }

  // ---- review: words, sounds and facts that come back ----
  // review: { key: { due, step, days, last } }, known: { key: day it became known }
  function remember(review, known, key, right, day, isNew) {
    if (!key) return;
    const r = review[key];
    if (!r) {
      if (known[key] && right) return;
      if (right && !isNew) return;   // an old item answered right: nothing to schedule
      review[key] = { due: addDays(day, TUNE.review[0]), step: 0, days: right ? 1 : 0, last: day, missed: right ? 0 : 1 };
      if (!right) delete known[key];
      return;
    }
    if (!right) { Object.assign(r, { due: addDays(day, TUNE.review[0]), step: 0, days: 0, last: day, missed: (r.missed || 0) + 1 }); delete known[key]; return; }
    if (r.last === day) return;   // right again the same day: counts once
    r.days++; r.step = Math.min(r.step + 1, TUNE.review.length - 1); r.last = day;
    r.due = addDays(day, TUNE.review[r.step]);
    if (r.days >= TUNE.knownDays) { delete review[key]; known[key] = day; }
  }
  const dueFor = (review, day, prefix) => Object.keys(review).filter(k => (!prefix || k.startsWith(prefix)) && dayNum(review[k].due) <= dayNum(day))
    .sort((a, b) => dayNum(review[a].due) - dayNum(review[b].due));

  // ---- a round's plan: which level each question comes from ----
  // Returns [{ level, review?: key }]: about a quarter review (keys due for this skill), the rest from
  // her level and the two below, the last one from below her level (a likely win to end on).
  function plan(sk, max, due, r) {
    const n = r.int(TUNE.roundMin, TUNE.roundMax);
    const out = [];
    const nRev = Math.min(due.length, Math.round(n * TUNE.reviewShare));
    for (let i = 0; i < nRev; i++) out.push({ level: sk.level, review: due[i] });
    while (out.length < n - 1) {
      const x = r();
      out.push({ level: clamp(x < 0.6 ? sk.level : x < 0.88 ? sk.level - 1 : sk.level - 2, 1, max) });
    }
    const body = r.shuffle(out);
    body.push({ level: clamp(sk.level - 1, 1, max), easy: true });
    return body;
  }

  // ---- a player ----
  function newPlayer(id, name, look) {
    return { id, name, look: look || {}, created: Date.now(), updated: Date.now(),
      skills: {}, review: {}, known: {}, wallet: {}, owned: [], wearing: {}, gifts: 0,
      world: { at: 'castle', stars: [], critters: [], fog: 0 }, chapters: {}, stickers: [],
      quest: null, play: {}, lands: {}, log: {}, rounds: 0 };
  }
  // Coins are kept per phone (wallet[device] = { earned, spent }), so two phones' copies add up
  // when they're merged, and nothing earned or spent on either is lost or counted twice.
  const coins = p => Object.values(p.wallet || {}).reduce((a, w) => a + (w.earned || 0) - (w.spent || 0), 0);
  function earn(p, device, n) { const w = p.wallet[device] = p.wallet[device] || { earned: 0, spent: 0 }; w.earned += n; }
  function spend(p, device, n) { if (coins(p) < n) return false; const w = p.wallet[device] = p.wallet[device] || { earned: 0, spent: 0 }; w.spent += n; return true; }

  // Seconds of active play, per day and per land, per phone (the same reason as coins).
  function played(p, device, day, land, secs) {
    const d = p.play[day] = p.play[day] || {}; d[device] = (d[device] || 0) + secs;
    const l = p.lands[land] = p.lands[land] || {}; l[device] = (l[device] || 0) + secs;
  }
  const sumDevices = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const playedOn = (p, day) => sumDevices(p.play[day]);
  const playedIn = (p, land) => sumDevices(p.lands[land]);

  // Each day's answers per skill: log[day][skill][device] = [right, total], for the Parent corner.
  function logAnswer(p, device, day, skill, right) {
    const d = p.log[day] = p.log[day] || {}, s = d[skill] = d[skill] || {}, c = s[device] = s[device] || [0, 0];
    if (right) c[0]++; c[1]++;
  }
  function accuracy(p, skill, days, day) {
    let r = 0, t = 0;
    for (let i = 0; i < days; i++) { const s = (p.log[addDays(day, -i)] || {})[skill]; for (const c of Object.values(s || {})) { r += c[0]; t += c[1]; } }
    return t ? { right: r, total: t, share: r / t } : { right: 0, total: 0, share: null };
  }
  // keep 90 days of the daily records
  function trim(p, day) {
    const cut = dayNum(day) - 90;
    for (const k of ['play', 'log']) for (const d of Object.keys(p[k] || {})) if (dayNum(d) < cut) delete p[k][d];
  }

  // ---- merging two copies of the same player (two phones, one offline) ----
  const maxMap = (a = {}, b = {}) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = Math.max(o[k] || 0, v); return o; };
  const maxPairs = (a = {}, b = {}) => { const o = JSON.parse(JSON.stringify(a)); for (const [k, v] of Object.entries(b)) { const c = o[k]; o[k] = !c ? v.slice() : [Math.max(c[0], v[0]), Math.max(c[1], v[1])]; } return o; };
  const union = (a = [], b = []) => [...new Set([...a, ...b])];
  function mergePlayer(a, b) {
    if (!a) return b; if (!b) return a;
    const newer = (b.updated || 0) > (a.updated || 0) ? b : a;
    const out = JSON.parse(JSON.stringify(newer));
    // each skill: the copy with more answers
    out.skills = {};
    for (const k of union(Object.keys(a.skills || {}), Object.keys(b.skills || {}))) {
      const x = (a.skills || {})[k], y = (b.skills || {})[k];
      out.skills[k] = JSON.parse(JSON.stringify(!x ? y : !y ? x : (y.answers > x.answers ? y : x)));
    }
    // review: each item's newer state; known: the union (an item known on either stays known unless missed later)
    out.known = { ...(a.known || {}), ...(b.known || {}) };
    out.review = {};
    for (const k of union(Object.keys(a.review || {}), Object.keys(b.review || {}))) {
      const x = (a.review || {})[k], y = (b.review || {})[k];
      const r = !x ? y : !y ? x : (dayNum(y.last) > dayNum(x.last) ? y : x);
      if (out.known[k] && dayNum(out.known[k]) >= dayNum(r.last)) continue;
      out.review[k] = { ...r }; delete out.known[k];
    }
    out.wallet = {};
    for (const d of union(Object.keys(a.wallet || {}), Object.keys(b.wallet || {}))) {
      const x = (a.wallet || {})[d] || { earned: 0, spent: 0 }, y = (b.wallet || {})[d] || { earned: 0, spent: 0 };
      out.wallet[d] = { earned: Math.max(x.earned, y.earned), spent: Math.max(x.spent, y.spent) };
    }
    out.owned = union(a.owned, b.owned);
    out.stickers = union(a.stickers, b.stickers);
    out.world = { ...newer.world, stars: union((a.world || {}).stars, (b.world || {}).stars), critters: union((a.world || {}).critters, (b.world || {}).critters), fog: Math.max((a.world || {}).fog || 0, (b.world || {}).fog || 0) };
    out.chapters = maxMap(a.chapters, b.chapters);
    out.rounds = Math.max(a.rounds || 0, b.rounds || 0);
    out.gifts = Math.max(a.gifts || 0, b.gifts || 0);
    out.play = {}; for (const d of union(Object.keys(a.play || {}), Object.keys(b.play || {}))) out.play[d] = maxMap((a.play || {})[d], (b.play || {})[d]);
    out.lands = {}; for (const l of union(Object.keys(a.lands || {}), Object.keys(b.lands || {}))) out.lands[l] = maxMap((a.lands || {})[l], (b.lands || {})[l]);
    out.log = {};
    for (const d of union(Object.keys(a.log || {}), Object.keys(b.log || {}))) {
      const x = (a.log || {})[d] || {}, y = (b.log || {})[d] || {}; out.log[d] = {};
      for (const s of union(Object.keys(x), Object.keys(y))) out.log[d][s] = maxPairs(x[s], y[s]);
    }
    out.updated = Math.max(a.updated || 0, b.updated || 0);
    return out;
  }
  // Two whole saves: every player merged; players removed on either stay removed (gone: { id: when }).
  function merge(a, b) {
    if (!a) return b; if (!b) return a;
    const gone = maxMap(a.gone, b.gone), players = {};
    for (const id of union(Object.keys(a.players || {}), Object.keys(b.players || {}))) {
      if (gone[id]) continue;
      players[id] = mergePlayer((a.players || {})[id], (b.players || {})[id]);
    }
    const settings = (b.settingsAt || 0) > (a.settingsAt || 0) ? b.settings : a.settings;
    return { v: 1, players, gone, settings: settings || {}, settingsAt: Math.max(a.settingsAt || 0, b.settingsAt || 0) };
  }

  root.SparkleEngine = { TUNE, today, dayNum, addDays, rng, newSkill, record, warmStart, warmStep, remember, dueFor, plan,
    newPlayer, coins, earn, spend, played, playedOn, playedIn, logAnswer, accuracy, trim, mergePlayer, merge };
})(typeof window !== 'undefined' ? window : globalThis);
