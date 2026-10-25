// Drives Ipsy in Fitness (home/ipsy.js with fitness/ipsy-tools.js) in headless Chromium, against a
// stand-in for Claude at /fitness/api/ipsy and for the family's Google Sheet (no network, no keys).
// Checks:
//   - the tools on their own (a bare page with meds.js and ipsy-tools.js), on a made-up log whose
//     numbers are worked out here independently: days (workouts, volume, steps, meds taken, missed and
//     not yet, as needed, health stats; the include filter; at most 120 days), summary (each week's
//     days trained, sets by group, volume, cardio, average steps, meds taken %, health averages),
//     compare (the paired days, Pearson's r and n, a lag, a yes-or-no metric split, r = 1 and -1 on
//     constructed series, too few days called out, unknown metrics), meds (by the person's own names,
//     taken over 30 days), context; health stats named by window.FitnessHealth when it's there and by
//     their key when it isn't; and days older than the phone keeps: fetched, or said to be left out;
//   - in the app: Ipsy off by default (no button), the Settings switch turning it on and off (off
//     clears its chat), signed out no button even when on; where it sits (just above the bottom row on
//     the left, over neither the view picker nor the +, the page scrolling clear of it) at 320 to 430
//     px, in both designs, light and dark; asking once before the first question; a question running
//     the tools on the app's own log with the right numbers and the screen in the app's note; the log
//     left as it was (read-only); older days fetched from the Sheet through the app; and no script
//     errors or Content Security Policy violations.
// Dates are worked out from today, so it runs on any day of the week and at the end of a month.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node fitness/scripts/ipsy-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/__tools.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><meta charset="utf-8"><script src="/fitness/meds.js"></script><script src="/fitness/ipsy-tools.js"></script>'); }
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;
const TZ = 'America/New_York';
process.env.TZ = TZ;

// ---- the made-up log: the last 30 days, worked out from today (every name is made up) ----
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const D = i => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i); return ymd(d); };
const TODAY = D(0);
const dow = s => new Date(s + 'T12:00').getDay();
const weekOf = s => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() - d.getDay()); return ymd(d); };   // Sunday, as Fitness does unless Calendar says Monday
const logs = [], steps = [], doses = [], health = [];
for (let i = 0; i < 30; i++) {
  const d = D(i);
  if (i % 3 === 1) logs.push({ id: 'l' + i, date: d, group: 'legs', exercise: 'Leg Press', weight: 100 + i, reps: 10, sets: 3, updated: 1 });
  if (i % 3 === 2) logs.push({ id: 'c' + i, date: d, group: 'chest', exercise: 'Barbell Bench Press', weight: 80, reps: 8, sets: 3, updated: 1 });
  if (i % 6 === 2) logs.push({ id: 't' + i, date: d, group: 'cardio', exercise: 'Treadmill', weight: 0, reps: 0, sets: 0, cardio: true, mins: 20, dist: 2, unit: 'mi', updated: 1 });
  if (i === 4) logs.push({ id: 'p4', date: d, group: 'core', exercise: 'Plank', weight: 0, reps: 45, sets: 2, timed: true, updated: 1 });
  if (i !== 5) steps.push({ id: d, date: d, n: 4000 + 150 * i, src: 'ha', updated: 1 });
  const m = { rhr: 60 + (i % 7) };
  if (i !== 10) m.sleep = 6 + (i % 4) * 0.5;
  health.push({ date: d, m });
}
const SINCE = D(40);
const meds = [
  { id: 'm1', name: 'Vitamin D', dose: '1000 IU', kind: 'supp', slots: ['am'], days: [], since: SINCE, updated: 1 },
  { id: 'm2', name: 'Pill B', dose: '500 mg', kind: 'med', slots: ['am', 'pm'], days: [1, 3, 5], since: SINCE, updated: 1 },
  { id: 'm3', name: 'Headache tabs', kind: 'med', prn: true, slots: [], days: [], since: SINCE, updated: 1 },
  { id: 'm4', name: 'Fish oil', kind: 'supp', slots: [], days: [], paused: true, since: SINCE, updated: 1 },
];
const dueOn = d => meds.filter(m => !m.paused && !m.prn && d >= m.since && (!m.days.length || m.days.includes(dow(d)))).flatMap(m => (m.slots.length ? m.slots : ['day']).map(slot => ({ m, slot })));
for (let i = 1; i < 30; i++) {
  const d = D(i);
  for (const { m, slot } of dueOn(d)) {
    const take = m.id === 'm1' ? i % 5 !== 0 : slot === 'am' ? true : i % 2 === 0;
    if (take) doses.push({ id: 'd' + i + m.id + slot, med: m.id, name: m.name, date: d, slot, at: 0, updated: 1 });
  }
}
doses.push({ id: 'prn1', med: 'm3', name: 'Headache tabs', date: D(3), slot: 'prn', at: 0, updated: 1 }, { id: 'prn2', med: 'm3', name: 'Headache tabs', date: D(3), slot: 'prn', at: 0, updated: 1 });
const SEED = { v: 2, logs, exercises: [], meds, doses, steps };
const HEALTH = health;

// ---- the same numbers, worked out here ----
const has = (d, m, slot) => doses.some(x => x.date === d && x.med === m.id && x.slot === slot);
const vol = d => logs.filter(x => x.date === d && !x.cardio && !x.timed && x.weight > 0).reduce((s, x) => s + x.weight * x.reps * x.sets, 0);
const setsOn = (d, g) => logs.filter(x => x.date === d && !x.cardio && (!g || x.group === g)).reduce((s, x) => s + x.sets, 0);
const stepOn = d => (steps.find(x => x.date === d) || {}).n;
const hOn = (d, k) => { const r = health.find(x => x.date === d); return r && r.m[k] != null ? r.m[k] : null; };
const r2 = n => Math.round(n * 100) / 100;
function pearson(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let c = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) { c += (xs[i] - mx) * (ys[i] - my); vx += (xs[i] - mx) ** 2; vy += (ys[i] - my) ** 2; }
  return c / Math.sqrt(vx * vy);
}
const near = (a, b, what, tol = 0.011) => assert.ok(a != null && Math.abs(a - b) <= tol, what + ': ' + a + ' vs ' + b);

// ---- the stand-in for Claude: answers each step from where the conversation is ----
let uid = 0;
const tu = (name, input) => ({ type: 'tool_use', id: 'toolu_' + (++uid), name, input });
const think = { type: 'thinking', thinking: '', signature: 'sig-' + 'x'.repeat(20) };
const said = text => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });
const use = (...uses) => ({ stop_reason: 'tool_use', content: uses });
const isQ = m => m.role === 'user' && m.content.some(b => b.type === 'text' && !b.text.startsWith('[From the app'));
function claude(msgs) {
  const qi = msgs.map(isQ).lastIndexOf(true), q = msgs[qi].content.filter(b => b.type === 'text' && !b.text.startsWith('[From the app')).map(b => b.text).join(' ');
  const got = {};
  for (let i = qi + 1; i < msgs.length; i++) for (const r of msgs[i].role === 'user' ? msgs[i].content : []) if (r.type === 'tool_result') {
    const u = msgs[i - 1].content.find(b => b.type === 'tool_use' && b.id === r.tool_use_id);
    got[u.name] = JSON.parse(r.content);
  }
  const step = Object.keys(got).length;
  if (/leg days/.test(q)) {
    if (!step) return use(think, tu('context', {}), tu('compare', { metric_a: 'group:legs', metric_b: 'sleep', from: D(29), to: TODAY, lag_days: 1 }));
    if (!got.days) return use(tu('days', { from: D(6), to: TODAY }), tu('summary', { from: D(13), to: TODAY }), tu('meds', {}));
    return said('After leg days you slept **' + got.compare.b_when_a_above_0.mean_b + ' h** on average, over ' + got.compare.b_when_a_above_0.days + ' nights. A pattern, not a cause.');
  }
  if (/back in time/.test(q)) {
    if (!step) return use(tu('days', { from: D(100), to: D(95) }));
    return said('Found it.');
  }
  if (/further back/.test(q)) {
    if (!step) return use(tu('days', { from: D(110), to: D(105) }));
    return said('Only the phone’s days.');
  }
  return said('Hello!');
}

const browser = await chromium.launch();
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n  ', e.message.split('\n').slice(0, 8).join('\n   ')); } };

// =====================================================================================
// 1. The tools on their own
// =====================================================================================
{
  const ctx = await browser.newContext({ timezoneId: TZ });
  const page = await ctx.newPage();
  await page.goto(BASE + '/__tools.html');
  await page.addScriptTag({ content: `
    window.mkApp = (data, o) => {
      const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return ymd(d); };
      const G = [['chest', 'Chest'], ['back', 'Back'], ['core', 'Core'], ['legs', 'Legs'], ['cardio', 'Cardio']].map(([id, name]) => ({ id, name }));
      return FitnessIpsy({ data, today: () => o.today, addDays, weekStartOf: s => addDays(s, -new Date(s + 'T12:00').getDay()), groups: G,
        groupName: id => (G.find(g => g.id === id) || { name: 'Other' }).name, pruneFrom: () => o.floor || null,
        older: async (from, to) => { window.olderAsked = (window.olderAsked || []).concat([[from, to]]); return !!o.olderOk; }, screen: () => 'Week, the week of ' + o.today });
    };` });
  const run = (name, input, o = {}, data = { ...SEED, health: HEALTH }) => page.evaluate(async ([data, name, input, o]) => {
    if (o.metrics) window.FitnessHealth = { METRICS: o.metrics, label: k => k }; else delete window.FitnessHealth;
    try { return (await mkApp(data, o).tools[name](input)).content; } catch (e) { return { error: e.message }; }
  }, [data, name, input, { today: TODAY, ...o }]);
  const METRICS = [{ key: 'sleep', name: 'Sleep', cat: 'sleep', unit: 'h', kind: 'avg' }, { key: 'rhr', name: 'Resting heart rate', cat: 'heart', unit: 'bpm', kind: 'avg' }];

  await step('days: each day’s workouts, volume, steps, meds taken / missed / not yet / as needed, and health stats, as worked out here', async () => {
    const r = await run('days', { from: D(6), to: TODAY }, { metrics: METRICS });
    assert.equal(r.from, D(6)); assert.equal(r.to, TODAY); assert.equal(r.of_days, 7);
    for (let i = 0; i <= 6; i++) {
      const d = D(i), x = r.days.find(y => y.date === d);
      assert.ok(x, d + ' is there');
      assert.equal(x.volume || 0, vol(d), d + ' volume');
      assert.equal(x.sets || 0, setsOn(d), d + ' sets');
      assert.equal(x.steps, stepOn(d), d + ' steps');
      assert.deepEqual(x.health, health.find(h => h.date === d).m, d + ' health');
      const due = dueOn(d), name = (m, s) => m.name + (m.slots.length > 1 ? ' (' + { am: 'Morning', pm: 'Evening' }[s] + ')' : '');
      if (i === 0) { assert.equal(x.meds_taken, undefined); assert.deepEqual(x.meds_not_yet, due.map(u => name(u.m, u.slot))); }
      else {
        assert.deepEqual((x.meds_taken || []).slice().sort(), due.filter(u => has(d, u.m, u.slot)).map(u => name(u.m, u.slot)).sort(), d + ' taken');
        assert.deepEqual((x.meds_missed || []).slice().sort(), due.filter(u => !has(d, u.m, u.slot)).map(u => name(u.m, u.slot)).sort(), d + ' missed');
      }
    }
    const leg = r.days.find(y => y.date === D(1));
    assert.deepEqual(leg.workouts, ['Legs · Leg Press 3×10 @ 101 lb']);
    assert.ok(r.days.find(y => y.date === D(2)).workouts.includes('Cardio · Treadmill 20 min 2 mi'));
    assert.equal(r.days.find(y => y.date === D(2)).cardio_min, 20);
    assert.ok(r.days.find(y => y.date === D(4)).workouts.includes('Core · Plank 2×45 s bodyweight'), 'a hold, in seconds');
    assert.deepEqual(r.days.find(y => y.date === D(3)).as_needed, { 'Headache tabs': 2 });
    assert.equal(r.days.find(y => y.date === D(5)).steps, undefined, 'no steps that day: none, not 0');
    assert.deepEqual(r.health_stats, { rhr: { name: 'Resting heart rate', unit: 'bpm' }, sleep: { name: 'Sleep', unit: 'h' } });
    assert.ok(!JSON.stringify(r).includes('Fish oil'), 'a paused one is never due');
  });

  await step('days: only what’s asked for, health stats by their key without FitnessHealth, at most 120 days, and bad dates said so', async () => {
    const r = await run('days', { from: D(6), to: TODAY, include: ['steps'] });
    assert.ok(r.days.every(x => Object.keys(x).sort().join() === 'date,dow,steps'), JSON.stringify(r.days[0]));
    const h = await run('days', { from: D(2), to: TODAY, include: ['health'] });
    assert.deepEqual(h.health_stats, { rhr: { name: 'rhr' }, sleep: { name: 'sleep' } }, 'no FitnessHealth: the key');
    const long = await run('days', { from: D(300), to: TODAY });
    assert.equal(long.from, D(119)); assert.match(long.note, /Cut to the last 120 days/);
    const back = await run('days', { from: TODAY, to: D(6) });
    assert.equal(back.from, D(6), 'from and to the other way round');
    assert.match((await run('days', { from: 'yesterday', to: TODAY })).error, /YYYY-MM-DD/);
    const future = new Date(); future.setDate(future.getDate() + 3);
    assert.match((await run('days', { from: ymd(future), to: ymd(future) })).error, /haven’t happened yet/);
  });

  await step('summary: each week’s days trained, sets by group, volume, cardio, average steps, meds taken % and health averages, as worked out here', async () => {
    const from = D(27), r = await run('summary', { from, to: TODAY }, { metrics: METRICS });
    const weeks = new Map();
    for (let i = 27; i >= 0; i--) { const d = D(i), k = weekOf(d); if (!weeks.has(k)) weeks.set(k, []); weeks.get(k).push(d); }
    assert.deepEqual(r.weeks.map(w => w.week_of), [...weeks.keys()]);
    for (const w of r.weeks) {
      const ds = weeks.get(w.week_of);
      assert.equal(w.days, ds.length, w.week_of + ' days');
      assert.equal(w.trained, ds.filter(d => logs.some(x => x.date === d)).length, w.week_of + ' trained');
      assert.equal(w.volume || 0, ds.reduce((s, d) => s + vol(d), 0), w.week_of + ' volume');
      assert.equal((w.sets_by_group || {}).Legs || 0, ds.reduce((s, d) => s + setsOn(d, 'legs'), 0), w.week_of + ' legs');
      assert.equal(w.cardio_min || 0, ds.reduce((s, d) => s + logs.filter(x => x.date === d && x.cardio).reduce((a, x) => a + x.mins, 0), 0), w.week_of + ' cardio');
      const st = ds.map(stepOn).filter(n => n != null);
      assert.equal(w.steps_avg, Math.round(st.reduce((a, b) => a + b, 0) / st.length), w.week_of + ' steps');
      let due = 0, taken = 0;
      for (const d of ds.filter(d => d < TODAY)) for (const u of dueOn(d)) { due++; if (has(d, u.m, u.slot)) taken++; }
      if (due) assert.equal(w.meds_taken_pct, Math.round(taken / due * 100), w.week_of + ' meds');
      const sl = ds.map(d => hOn(d, 'sleep')).filter(v => v != null);
      near(w.health.sleep.avg, sl.reduce((a, b) => a + b, 0) / sl.length, w.week_of + ' sleep avg', 0.006);
      assert.equal(w.health.sleep.days, sl.length);
    }
    assert.equal(r.health_stats.sleep.name, 'Sleep');
  });

  await step('compare: sleep the night after leg days, paired here, with r, n and the split by leg day or not', async () => {
    const r = await run('compare', { metric_a: 'group:legs', metric_b: 'sleep', from: D(29), to: TODAY, lag_days: 1 }, { metrics: METRICS });
    const pairs = [];
    for (let i = 29; i >= 1; i--) { const b = hOn(D(i - 1), 'sleep'); if (b != null) pairs.push([D(i), setsOn(D(i), 'legs'), b]); }
    assert.equal(r.n, pairs.length); assert.equal(r.lag_days, 1);
    assert.deepEqual(r.pairs, pairs);
    near(r.r, pearson(pairs.map(p => p[1]), pairs.map(p => p[2])), 'r');
    const on = pairs.filter(p => p[1] > 0), off = pairs.filter(p => p[1] === 0);
    assert.equal(r.b_when_a_above_0.days, on.length);
    near(r.b_when_a_above_0.mean_b, on.reduce((s, p) => s + p[2], 0) / on.length, 'after leg days', 0.006);
    near(r.b_when_a_is_0.mean_b, off.reduce((s, p) => s + p[2], 0) / off.length, 'after other days', 0.006);
    assert.equal(r.metric_a.name, 'Legs sets'); assert.equal(r.metric_b.name, 'Sleep'); assert.equal(r.metric_b.taken, '1 day later');
  });

  await step('compare: r = 1 and -1 on constructed series, steps against volume, adherence and a med by name; too few days and unknown metrics said so', async () => {
    const lin = Array.from({ length: 20 }, (_, i) => ({ date: D(i), m: { up: 10 + 2 * i, down: 100 - 3 * i } }));
    const data = { ...SEED, health: lin };
    const a = await run('compare', { metric_a: 'up', metric_b: 'down', from: D(19), to: TODAY }, {}, data);
    assert.equal(a.n, 20); assert.equal(a.r, -1);
    const b = await run('compare', { metric_a: 'steps', metric_b: 'up', from: D(19), to: TODAY }, {}, data);
    assert.equal(b.n, 19, 'the day with no steps is left out'); assert.equal(b.r, 1);
    const v = await run('compare', { metric_a: 'steps', metric_b: 'volume', from: D(29), to: TODAY });
    const vp = []; for (let i = 29; i >= 0; i--) if (stepOn(D(i)) != null) vp.push([stepOn(D(i)), vol(D(i))]);
    assert.equal(v.n, vp.length); near(v.r, pearson(vp.map(p => p[0]), vp.map(p => p[1])), 'steps vs volume');
    const ad = await run('compare', { metric_a: 'sleep', metric_b: 'adherence', from: D(29), to: TODAY });
    const ap = [];
    for (let i = 29; i >= 1; i--) { const d = D(i), s = hOn(d, 'sleep'), due = dueOn(d); if (s != null && due.length) ap.push([s, r2(due.filter(u => has(d, u.m, u.slot)).length / due.length)]); }
    assert.equal(ad.n, ap.length, 'today isn’t counted until everything due is in'); near(ad.r, pearson(ap.map(p => p[0]), ap.map(p => p[1])), 'sleep vs adherence');
    const md = await run('compare', { metric_a: 'sleep', metric_b: 'med:vitamin d', from: D(9), to: TODAY });
    assert.equal(md.metric_b.key, 'med:Vitamin D'); assert.equal(md.n, 9, 'D(9)..D(1): today isn’t counted until everything due is in');
    assert.ok(md.pairs.every(p => p[2] === 0 || p[2] === 1));
    const few = await run('compare', { metric_a: 'steps', metric_b: 'sleep', from: D(4), to: TODAY });
    assert.match(few.note, /Only 5 paired days: too few to go on/);
    assert.match((await run('compare', { metric_a: 'mood', metric_b: 'steps', from: D(4), to: TODAY })).error, /No daily number called "mood"/);
    assert.match((await run('compare', { metric_a: 'group:arms', metric_b: 'steps', from: D(4), to: TODAY })).error, /No muscle group/);
    assert.match((await run('compare', { metric_a: 'med:aspirin', metric_b: 'steps', from: D(4), to: TODAY })).error, /No med or supplement called "aspirin"/);
  });

  await step('meds: the list by the person’s own names, when, which days, paused, and taken over 30 days', async () => {
    const r = await run('meds', {});
    assert.deepEqual(r.meds.map(m => m.name), ['Headache tabs', 'Pill B', 'Vitamin D', 'Fish oil']);
    const vd = r.meds.find(m => m.name === 'Vitamin D');
    assert.deepEqual([vd.dose, vd.kind, vd.when, vd.days], ['1000 IU', 'supplement', ['Morning'], 'every day']);
    let due = 0, taken = 0; for (let i = 1; i < 30; i++) { due++; if (i % 5 !== 0) taken++; }
    assert.equal(vd.taken_last_30_days, Math.round(taken / due * 100) + '% (' + taken + ' of ' + due + ' doses)');
    const pb = r.meds.find(m => m.name === 'Pill B');
    assert.deepEqual([pb.kind, pb.when, pb.days], ['medication', ['Morning', 'Evening'], ['Mon', 'Wed', 'Fri']]);
    assert.equal(r.meds.find(m => m.name === 'Headache tabs').when, 'as needed');
    assert.equal(r.meds.find(m => m.name === 'Fish oil').paused, true);
  });

  await step('with health.js: each day\'s health_status (only what was judged) and sleep_score; each week\'s sleep_score_avg and health_off_days', async () => {
    const rows = []; for (let i = 0; i < 14; i++) rows.push({ date: D(i), m: { sleep: i === 0 ? 300 : 450, deep: 70, rem: 100, core: 280, in_bed: 480, hr_rest: 58 } });
    const [days, summary] = await page.evaluate(async ([rows, today, from]) => {
      await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = '/fitness/health.js'; s.onload = ok; s.onerror = bad; document.head.append(s); });
      try {
        const app = mkApp({ logs: [], steps: [], meds: [], doses: [], health: rows }, { today });
        return [(await app.tools.days({ from, to: today, include: ['health'] })).content, (await app.tools.summary({ from, to: today })).content];
      } finally { delete window.FitnessHealth; }
    }, [rows, TODAY, D(13)]);
    const t = days.days.find(x => x.date === TODAY), y = days.days.find(x => x.date === D(1));
    assert.deepEqual(t.health_status, { hr_rest: 'good', sleep: 'bad' }, '5 h, far under a steady 7.5 h; the stages aren\'t judged');
    assert.equal(t.sleep_score, 49);
    assert.deepEqual([y.health_status, y.sleep_score], [{ hr_rest: 'good', sleep: 'good' }, 100]);
    assert.match(days.health_status_means, /not a diagnosis/); assert.match(days.health_status_means, /not Apple/);
    const wk = summary.weeks.at(-1);
    assert.deepEqual(wk.health_off_days, { sleep: 1 });
    assert.ok(wk.sleep_score_avg < 100 && wk.sleep_score_avg >= 49, String(wk.sleep_score_avg));
    assert.ok(summary.weeks.slice(0, -1).every(w => !w.health_off_days && w.sleep_score_avg === 100));
    assert.match(summary.health_status_means, /good/);
  });

  await step('context: today, the screen, what the phone keeps, the groups, and the health stats there are', async () => {
    const r = await run('context', {}, { metrics: METRICS });
    assert.equal(r.today, TODAY); assert.match(r.screen, /^Week/);
    assert.match(r.phone_keeps, /every day logged/);
    assert.deepEqual(r.health_stats.map(s => [s.key, s.name, s.days_recorded]), [['rhr', 'Resting heart rate', 30], ['sleep', 'Sleep', 29]]);
    assert.ok(r.metrics_for_compare.includes('adherence'));
    const none = await run('context', {}, {}, SEED);
    assert.equal(none.health_stats, 'none yet', 'no health stats yet (data.health not there)');
  });

  await step('older than the phone keeps: fetched through the app, or left out and said so', async () => {
    const floor = D(89);
    const ok = await run('days', { from: D(100), to: D(80) }, { floor, olderOk: true });
    assert.equal(ok.from, D(100)); assert.match(ok.note, /came from the family’s Google Sheet/);
    assert.deepEqual(await page.evaluate(() => window.olderAsked.at(-1)), [D(100), D(80)]);
    const no = await run('summary', { from: D(100), to: TODAY }, { floor, olderOk: false });
    assert.equal(no.from, floor); assert.match(no.note, /Only the days this phone keeps were used \(from /);
    const none = await run('days', { from: D(110), to: D(100) }, { floor, olderOk: false });
    assert.deepEqual(none.days, []);
    const recent = await run('days', { from: D(10), to: TODAY }, { floor });
    assert.equal(recent.note, undefined, 'nothing to fetch inside the phone’s days');
  });
  await ctx.close();
}

// =====================================================================================
// 2. In the app
// =====================================================================================
const SESSION = { token: 'tok-test', user: { id: 'u1', name: 'Tom', role: 'owner' }, at: 1 };
async function phone({ width = 390, design = 'glass', scheme = 'light', session = SESSION, ipsy = false, synced = false, extra = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, serviceWorkers: 'block', timezoneId: TZ, locale: 'en-US' });
  await ctx.addInitScript(([d, seed, session, ipsy, synced, extra]) => {
    localStorage.setItem('aos.helper', '{"who":"mia","name":""}'); localStorage.setItem('aos.seen', JSON.stringify({ fitness: '999' })); localStorage.setItem('aos.sky', 'day'); localStorage.setItem('design.fitness', d);
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('allison-fitness-v1', JSON.stringify(seed));
    if (session) localStorage.setItem('aos.session', JSON.stringify(session));
    if (ipsy) localStorage.setItem('allison-fitness-v1-ipsy', '1');
    if (synced) localStorage.setItem('allison-fitness-v1-sheet-health', 'family');
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, [design, SEED, session, ipsy, synced, extra]);
  const state = { sent: [], rangeFails: false, ranges: [] };
  await ctx.route('**/aOS/api/**', r => r.fulfill({ json: { ok: true } }));
  await ctx.route('**/drinks/api/**', r => r.fulfill({ status: 404, json: {} }));
  await ctx.route('**/calendar/api/**', r => r.fulfill({ status: 503, json: {} }));
  await ctx.route('**/sheet/api/**', r => {
    if (r.request().method() === 'GET') return r.fulfill({ json: { configured: true } });
    const b = JSON.parse(r.request().postData() || '{}');
    if (b.action !== 'range') return r.fulfill({ status: 409, json: { ok: false, error: 'no-sheet' } });
    state.ranges.push([b.from, b.to]);
    if (state.rangeFails) return r.fulfill({ status: 502, json: { ok: false, error: 'sheet-unreachable' } });
    return r.fulfill({ json: { ok: true, app: 'allison-fitness-sync', aos: true,
      logs: [{ id: 'old1', date: D(100), group: 'back', exercise: 'Lat Pulldown', weight: 90, reps: 10, sets: 3, updated: 5 }], doses: [], steps: [{ id: D(100), date: D(100), n: 12345, src: 'you', updated: 5 }] } });
  });
  await ctx.route('**/fitness/api/**', async r => {
    const req = r.request(), u = req.url();
    if (!u.endsWith('/ipsy')) return r.fulfill({ status: 404, json: { error: 'not-linked' } });
    const raw = req.postData();
    assert.ok(raw.startsWith('{"messages":'), 'the phone sends exactly {"messages":[...]}');
    assert.equal(req.headers()['x-fitness'], '1'); assert.equal(req.headers().authorization, 'Bearer tok-test');
    const msgs = JSON.parse(raw).messages;
    state.sent.push(msgs);
    return r.fulfill({ json: { id: 'msg_' + state.sent.length, type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', ...claude(msgs) } });
  });
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404|409|502|503/.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', e => problems.push(String(e)));
  page.on('console', m => { if (m.type() === 'warning' && /Ipsy/.test(m.text())) problems.push(m.text()); });
  await page.goto(BASE + '/fitness/');
  await page.waitForFunction(() => window.__fitness);
  await page.evaluate(h => { window.__fitness.data.health = h; }, HEALTH);
  return { ctx, page, state, problems };
}
const btnShown = page => page.evaluate(() => { const b = document.querySelector('.ipsy-btn'); return !!(b && b.offsetParent && !b.closest('[hidden]')); });

await step('off by default: no Ipsy button; Settings > Ipsy turns it on (and the button stays after a reload), and off again (its chat goes too)', async () => {
  const { ctx, page, problems } = await phone();
  assert.equal(await btnShown(page), false, 'no button');
  assert.equal(await page.$('.ipsy-btn'), null, 'not even mounted');
  await page.click('#setBtn');
  await page.waitForSelector('#stIpsy');
  assert.equal(await page.getAttribute('#stIpsy', 'aria-checked'), 'false');
  const t = await page.textContent('#stIpsy');
  assert.match(t, /Ask Ipsy about your patterns/); assert.equal(await page.textContent('#stIpsy .sub'), 'Ipsy finds patterns in your workouts, sleep and meds.', 'one short sentence on what it does');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'settings-off.png') });
  await page.click('#stIpsy');
  assert.equal(await page.getAttribute('#stIpsy', 'aria-checked'), 'true');
  assert.equal(await page.evaluate(() => localStorage.getItem('allison-fitness-v1-ipsy')), '1');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('setSheet').hidden);
  assert.equal(await btnShown(page), true, 'the button is there');
  assert.equal(await page.evaluate(() => !!document.querySelector('.dock > .ipsyslot .ipsy-btn')), true, 'in its slot');
  await page.reload(); await page.waitForFunction(() => window.__fitness);
  assert.equal(await btnShown(page), true, 'still on after a reload');
  await page.evaluate(() => localStorage.setItem('ipsy.fitness.chat', '{"messages":[],"view":[]}'));
  await page.click('#setBtn'); await page.waitForSelector('#stIpsy');
  await page.click('#stIpsy');
  assert.equal(await page.getAttribute('#stIpsy', 'aria-checked'), 'false');
  assert.equal(await page.evaluate(() => localStorage.getItem('ipsy.fitness.chat')), null, 'its chat is gone');
  await page.keyboard.press('Escape');
  assert.equal(await btnShown(page), false, 'off: no button');
  assert.deepEqual(problems, []);
  await ctx.close();
});

await step('signed out: no Ipsy button, even turned on', async () => {
  const { ctx, page, problems } = await phone({ session: null, ipsy: true });
  assert.equal(await btnShown(page), false);
  await page.click('#setBtn'); await page.waitForSelector('#stIpsy');
  assert.equal(await page.textContent('#stIpsy .sub'), 'Ipsy finds patterns in your workouts, sleep and meds.', 'the same one sentence, signed out');
  assert.deepEqual(problems, []);
  await ctx.close();
});

for (const width of [320, 375, 390, 430]) for (const design of ['glass', 'vintage']) for (const scheme of ['light', 'dark']) {
  await step(`placed (${width} px, ${design}, ${scheme}): just above the bottom row on the left, over neither the view picker nor the +, the page scrolling clear of it`, async () => {
    const { ctx, page, problems } = await phone({ width, design, scheme, ipsy: true });
    await page.waitForSelector('.dock .ipsy-btn');
    for (const view of ['week', 'analysis', 'meds']) {
      await page.evaluate(v => window.__fitness.setView(v), view); await page.waitForTimeout(150);
      const g = await page.evaluate(() => {
        const r = e => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
        const ip = r(document.querySelector('.ipsy-btn'));
        const hits = ['#fab', '#viewBtn', '.vbar', '#todayBtn', '#setBtn'].map(s => document.querySelector(s)).filter(e => e && e.offsetParent)
          .filter(e => { const b = r(e); return b.l < ip.r && b.r > ip.l && b.t < ip.b && b.b > ip.t; }).map(e => e.id || e.className);
        scrollTo(0, document.documentElement.scrollHeight);
        const main = document.getElementById('main'), last = main.lastElementChild;
        const out = { ip, vbar: r(document.querySelector('.vbar')), hits, lastBottom: last ? last.getBoundingClientRect().bottom : 0, look: document.querySelector('.ipsy-btn').className, W: innerWidth, H: innerHeight, sw: document.documentElement.scrollWidth };
        scrollTo(0, 0);
        return out;
      });
      assert.deepEqual(g.hits, [], view + ': Ipsy covers ' + g.hits.join(', '));
      assert.ok(g.ip.l >= 0 && g.ip.r <= g.W && g.ip.t >= 0 && g.ip.b <= g.H, view + ': on screen ' + JSON.stringify(g.ip));
      assert.ok(g.ip.b <= g.vbar.t && g.vbar.t - g.ip.b < 24, view + ': just above the bottom row ' + JSON.stringify(g));
      assert.ok(g.ip.l < 30, view + ': on the left');
      assert.ok(g.lastBottom <= g.ip.t, view + ': the end of the page scrolls clear of Ipsy (' + g.lastBottom + ' > ' + g.ip.t + ')');
      assert.ok(g.look.includes('ipsy-' + design), 'Ipsy wears the app’s design');
      assert.ok(g.sw <= g.W, 'no sideways scroll');
    }
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `place-${width}-${design}-${scheme}.png`) });
    assert.deepEqual(problems, []);
    await ctx.close();
  });
}

{
  const { ctx, page, state, problems } = await phone({ ipsy: true, synced: true, design: 'vintage', scheme: 'dark' });
  await page.waitForSelector('.dock .ipsy-btn');
  const logBefore = await page.evaluate(() => JSON.stringify({ logs: __fitness.data.logs, meds: __fitness.data.meds, doses: __fitness.data.doses, steps: __fitness.data.steps }));
  const ask = async (text, until) => {
    await page.fill('#ipsyIn', text);
    await page.press('#ipsyIn', 'Enter');
    await page.waitForFunction(re => new RegExp(re).test(document.querySelector('.ipsy-log').textContent) && !document.querySelector('.ipsy-send').disabled, until, { timeout: 15000 });
  };
  const results = msgs => { const out = {}; for (let i = 1; i < msgs.length; i++) for (const r of msgs[i].role === 'user' ? msgs[i].content : []) if (r.type === 'tool_result') { const u = msgs[i - 1].content.find(b => b.id === r.tool_use_id); out[u.name] = JSON.parse(r.content); } return out; };

  await step('the chat asks once before the first question, and says what goes where', async () => {
    await page.click('.ipsy-btn');
    await page.waitForSelector('.ipsy-bubble');
    const c = await page.textContent('.ipsy-consent');
    assert.match(c, /only the days Ipsy needs go to Claude, by Anthropic, through aOS/);
    assert.match(c, /Anthropic doesn’t train on it/); assert.match(c, /no web search/); assert.match(c, /only reads your log/); assert.match(c, /isn’t a doctor/);
    assert.equal(await page.$eval('#ipsyIn', e => e.disabled), true, 'nothing is sent before OK');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'consent.png') });
    await page.click('#ipsyOk');
    const chips = await page.$$eval('.ipsy-chip[data-ask]', e => e.map(x => x.textContent));
    assert.deepEqual(chips.slice(0, 3), ['How did I sleep after leg days?', 'Is my resting heart rate trending down?', 'Did I miss meds more on low-sleep days?']);
  });

  await step('a question runs the tools on the app’s own log, with the right numbers, and the screen in the app’s note; the log is left as it was', async () => {
    await ask('How did I sleep after leg days?', 'A pattern, not a cause');
    const sent = state.sent;
    assert.match(sent[0][0].content[0].text, /^\[From the app: today is \w+day, .* \(\d{4}-\d\d-\d\d\)\. On screen: Week, the week of \d{4}-\d\d-\d\d\.(?: You are this person’s helper[^\]]*)?\]$/);
    for (let i = 1; i < sent.length; i++) assert.deepEqual(sent[i].slice(0, sent[i - 1].length), sent[i - 1], 'step ' + i + ' changed an earlier message');
    const R = results(sent.at(-1));
    assert.equal(R.context.today, TODAY); assert.match(R.context.phone_keeps, /the days from /);
    const pairs = []; for (let i = 29; i >= 1; i--) { const b = hOn(D(i - 1), 'sleep'); if (b != null) pairs.push([D(i), setsOn(D(i), 'legs'), b]); }
    assert.equal(R.compare.n, pairs.length); near(R.compare.r, pearson(pairs.map(p => p[1]), pairs.map(p => p[2])), 'r in the app');
    assert.equal(R.days.days.find(x => x.date === D(1)).volume, vol(D(1)));
    assert.equal(R.days.days.find(x => x.date === D(1)).steps, stepOn(D(1)));
    assert.ok(R.summary.weeks.length >= 2);
    assert.deepEqual(R.meds.meds.map(m => m.name), ['Headache tabs', 'Pill B', 'Vitamin D', 'Fish oil']);
    const acts = await page.$$eval('.ipsy-act', e => e.map(x => x.textContent));
    assert.ok(acts.some(a => /^Comparing legs sets with sleep( duration)?$/.test(a)) && acts.some(a => a.startsWith('Looking at your days, ')) && acts.includes('Adding up your weeks') && acts.includes('Looking at your meds list'), acts.join(' | '));
    assert.equal(await page.$$eval('.ipsy-change', e => e.length), 0, 'nothing changed, so no Undo');
    assert.equal(await page.locator('.ipsy-it').last().locator('b').first().count(), 1);
    const logAfter = await page.evaluate(() => JSON.stringify({ logs: __fitness.data.logs, meds: __fitness.data.meds, doses: __fitness.data.doses, steps: __fitness.data.steps }));
    assert.equal(logAfter, logBefore, 'the log is as it was');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'chat.png') });
  });

  await step('older than the phone keeps: fetched from the family’s Sheet through the app; when it can’t be reached, said so', async () => {
    await ask('Go back in time', 'Found it');
    const R = results(state.sent.at(-1));
    assert.deepEqual(state.ranges[0][0], D(100));
    assert.match(R.days.note, /came from the family’s Google Sheet/);
    const old = R.days.days.find(x => x.date === D(100));
    assert.ok(old && old.workouts[0] === 'Back · Lat Pulldown 3×10 @ 90 lb' && old.steps === 12345, JSON.stringify(R.days));
    state.rangeFails = true;
    await ask('Even further back', 'Only the phone');
    const R2 = results(state.sent.at(-1));
    assert.match(R2.days.note, /Only the days this phone keeps were used \(from /);
  });

  await step('no script errors and nothing blocked by the page policy', async () => {
    assert.deepEqual(problems, []);
  });
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
