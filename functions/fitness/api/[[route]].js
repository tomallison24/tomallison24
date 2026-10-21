// /fitness/api/* - your own iPhone's step count, for Fitness, read from the
// family's Home Assistant. The Home Assistant app on an iPhone has a Steps
// sensor (sensor.<phone>_steps: the phone's own motion chip, steps since
// midnight, reset at midnight). Fitness can't talk to Home Assistant with a
// token of its own without keeping one on the phone, and a Home Assistant
// token can run the whole house; so the token stays here, a Cloudflare Pages
// secret (HA_TOKEN, never in this repository: aOS/RELEASING.md), and this
// route hands out nothing but steps, and only each person's own.
//
// Each person links their own phone's sensor once, in Fitness. A phone linked
// to someone can't be linked by anyone else, and you can only ever read the
// phone linked to you; the owner can unlink anyone (a mistake, or a new phone).
//
//   GET  phones          -> { linked: { entity, name } | null, phones: [{ entity, name }] (no one's yet),
//                            list: false when Home Assistant won't list them (a token that isn't an
//                            admin's: then you type your sensor's name), links (owner): [{ id, name, entity }] }
//   POST link            { entity } -> { linked }   your phone's sensor (it must exist and end in _steps)
//   POST unlink          {} yours, or (the owner) { id } someone's
//   GET  steps           ?days=1..10 -> { entity, points: [[ms, steps], ...] } your phone's count just
//                        before each reset (the day's total, as far as the phone told Home Assistant)
//                        and its latest; Fitness puts each in its day on the phone's own clock. Once
//                        the phone's Health Steps sensor (Apple Health, with an Apple Watch's steps)
//                        has been found (GET health), it is read in place of the Steps sensor (the
//                        phone's own motion chip)
//   GET  health          ?days=1..10 (2 if not said) -> { entities: { key: entity_id }, units: { key: unit },
//                        days: { 'YYYY-MM-DD': { key: value } } } your phone's Apple Health sensors
//                        (fitness/health.js lists them: Activity, Heart, Sleep, Vitals), each summed
//                        into days on the family's calendar (America/New_York): today and the
//                        days-1 before it. A sensor that reads unavailable (no Health permission,
//                        no Apple Watch) gives nothing.
//   POST ipsy            { messages } -> Anthropic's answer, as it comes (one step of Ipsy's chat,
//                        server/ipsy.js): Ipsy looking for patterns in your own workouts, steps, meds
//                        and health stats. This adds Ipsy's instructions and tools (IPSY_SYSTEM,
//                        IPSY_CLIENT_TOOLS) and asks Claude Sonnet 5.5 (FITNESS_IPSY_MODEL, a Pages
//                        secret, names another); the tools run on the phone, read-only, and send only
//                        the days a question needs. No web search or web pages here, so nothing about
//                        your health can end up in a search query. The key is ANTHROPIC_API_KEY.
//                        Nothing about a conversation is kept: only IPSY_DAILY questions a person a day
//                        are counted (fitness:ipsy:<user id>:<day>, gone after two days).
//   POST vitals          { on, day, usual: { key: { lo, hi, mean, far } | null } } -> { ok } your vitals
//                        alert's switch (Fitness Settings > Health > Vitals alerts) and your usual for
//                        each vital (health.js usualRanges, the 28 days before day, which Home Assistant's
//                        10 days can't give), sent by your phone after a Health fetch when they change
//   POST alerts/begin    {} -> { people: [id, ...] } (the scheduled check only, .github/workflows/
//                        fitness-vitals.yml, with its key: no session) who to check: linked, with
//                        aOS notifications on (push:<id>), the alert not turned off, not alerted today
//   POST alerts/check    { to } -> { alerted, sent, failed, gone } | { skipped } | { error } one person:
//                        their newest vitals (today's, else yesterday's; none older than 36 hours) judged
//                        by health.js as the Vitals tile judges them (statuses + vitalsOff, against the
//                        healthy ranges and the usual their phone sent). Even one off: a notification
//                        through aOS, "A vital is off your usual. Open Fitness." (nothing more: no
//                        number, no name), opening ../fitness/?view=health&day=<that day>. Once a day
//                        at most, and never twice for the same day. Readings are never logged or answered.
//                        The key is derived from ANNOUNCE_KEY (the release's, aOS/scripts/announce.mjs),
//                        so there is nothing to set up; without it these answer 404.
//
// The Health sensors end in _steps too (Health Steps): they are never offered or linked as a phone.
//
// Home Assistant keeps 10 days of history by default (recorder purge_keep_days),
// so that is as far back as this reads; Fitness keeps each day it has seen.
//
// Stored in the accounts' Workers KV (ACCOUNTS, server/auth.js):
//   steps:<user id>       the sensor linked to that person
//   steps:by:<entity>     who it's linked to (so no one else can link it)
//   health:<user id>      { entity, at, how, map: { key: entity_id }, units, scale } that phone's
//                         Apple Health sensors, looked for again after a day (an hour while it has
//                         none, so turning them on shows soon); gone on an unlink
//   vitals:<user id>      { on, day, usual, at } the vitals alert's switch and usual (POST vitals)
//   vitals-sent:<user id> { on: the day it was sent, day: the day it was about } (3 days)
// Written only on a link or an unlink (and health: when its sensors are looked for). The address is the one the owner set
// for the Home app (config:home). The X-Fitness header stops other web pages
// calling this (as X-Drinks does). Everything here needs the family session.

import { reply, kv, getJSON, putJSON, sessionUser } from '../../../server/auth.js';
import { devices, message, sendTo } from '../../../server/push.js';
import { IPSY_MODEL, IPSY_DAILY, IPSY_MAX_BODY, IPSY_MAX_MESSAGES, T, DAY, persona, modelOf, requestHead, ipsyStep } from '../../../server/ipsy.js';

export { IPSY_MODEL, IPSY_DAILY, IPSY_MAX_BODY, IPSY_MAX_MESSAGES };
export const ipsyModelOf = env => modelOf(env, 'FITNESS_IPSY_MODEL');

// Ipsy's tools in Fitness (fitness/ipsy-tools.js runs them on the phone). All read-only, each at most
// about 120 days (a year of weeks for summary), answered as compact JSON.
const METRIC = { type: 'string', description: 'A daily number: steps, volume (lb lifted: weight × reps × sets), sets, cardio_min, trained (1 a day with a workout, else 0), group:<muscle group> (that group\'s sets: group:legs, group:chest...), meds_taken, meds_missed, adherence (share of the day\'s due doses taken, 0 to 1), med:<name> (that one\'s share taken), or a health stat\'s key (context lists the ones there are)' };
export const IPSY_CLIENT_TOOLS = [
  T('days', 'Day by day, from one date to another (at most 120 days): each day\'s workouts (muscle group, exercise, sets × reps at a weight in lb, a hold\'s seconds, or cardio minutes and distance), its volume, steps, the meds and supplements taken, missed and taken as needed (by the person\'s own names), and health stats, with health_status for the readings judged (good, watch or bad against healthy ranges or their usual) and sleep_score (Fitness\'s own, 0 to 100). Days with nothing are left out.', {
    from: DAY, to: DAY,
    include: { type: 'array', items: { type: 'string', enum: ['workouts', 'steps', 'meds', 'health'] }, description: 'Only these parts (default: all)' },
  }, ['from', 'to']),
  T('summary', 'Week by week, from one date to another (at most 53 weeks): days trained, sets per muscle group, total volume, cardio minutes, average steps, the share of due meds taken, and the average of each health stat, the average sleep score and the days each health stat was at watch or bad.', {
    from: DAY, to: DAY,
  }, ['from', 'to']),
  T('compare', 'Line up two daily numbers over a stretch of days (at most 120), the second lag_days later (sleep against the next day\'s volume: lag_days 1), and work out how closely they go together on the phone: the paired days, each one\'s average, and the correlation r (Pearson, -1 to 1) with n, how many days it rests on.', {
    metric_a: METRIC, metric_b: METRIC, from: DAY, to: DAY,
    lag_days: { type: 'integer', description: 'metric_b is taken this many days after metric_a (default 0, -14 to 14)' },
  }, ['metric_a', 'metric_b', 'from', 'to']),
  T('meds', 'The person\'s list of medications and supplements, by their own names: the dose, medication or supplement, when in the day, which days, as needed, paused, and since when.', {}),
  T('context', 'Today\'s date, what\'s on the screen, how far back the phone keeps days, the muscle groups, and the daily numbers compare can use (the health stats there are, with their names and units).', {}),
];

export const IPSY_SYSTEM = persona({
  app: 'Fitness',
  about: 'an iPhone app where one person keeps their own workout log, steps, medications and supplements, and health stats from Apple Health (sleep, heart rate and the like), on their phone and in the family\'s Google Sheet. You help them find patterns in their own numbers',
  can: [
    'Look at their days (days): workouts, volume, steps, meds and supplements taken or missed, and health stats, day by day.',
    'Add it up week by week (summary): days trained, sets per muscle group, volume, average steps, the share of meds taken, and the average of each health stat.',
    'Line two daily numbers up against each other, the same day or a few days apart (compare): the paired days and how closely they go together (r, and n, the days it rests on).',
    'See their list of meds and supplements (meds), and today\'s date, the screen and the numbers there are (context).',
  ],
  rules: [
    'You only read. You can\'t log, change or delete anything; if they want a change, say where in the app to make it.',
    'Never guess a number: look with your tools first, every time. Quote the numbers you found, the dates they cover, and how many days a pattern rests on ("on 7 of your 9 leg days").',
    'Call what you find a pattern ("tends to", "goes with"), never a cause: say one thing goes with another, not that it made it happen. With fewer than about 10 days, or an r between -0.3 and 0.3, say plainly that it is too little to go on, or weak.',
    'You are not a doctor. No diagnosis, no medical advice, and nothing about starting, stopping or changing a medication or dose. For anything medical (a symptom, a worrying number, a medication), suggest they talk to their doctor. Noticing patterns in training and habits is fine.',
    'Call meds and supplements by the person\'s own names for them, as the app has them. Don\'t explain what one is for or guess why they take it.',
    'You only ever see this one person\'s data. Never mention, guess about or compare them with anyone else in the family.',
    'The phone keeps the last 90 days; older days come from the family\'s Google Sheet when it can be reached. If a tool says it used only the phone\'s days, say so.',
    'A day with no number means nothing was recorded, not zero. Health stats are as Apple Health gave them to the app.',
  ],
  bold: 'a number or a pattern',
  web: false, privacy: false,
});

export const ipsyRequestHead = env => requestHead({ model: ipsyModelOf(env), system: IPSY_SYSTEM, tools: IPSY_CLIENT_TOOLS, web: false });
import '../../../fitness/health.js';   // globalThis.FitnessHealth: the Apple Health sensors Fitness shows

const ENTITY = /^sensor\.[a-z0-9_]{1,80}_steps$/;
const HEALTH_STEPS = /_health_steps$/;   // Apple Health's own Steps sensor: read for steps, never linked as the phone
const DAYS = 10;
const LIST = `{% set ns = namespace(o=[]) %}{% for s in states.sensor if s.entity_id.endswith('_steps') %}{% set ns.o = ns.o + [{'entity': s.entity_id, 'name': s.name}] %}{% endfor %}{{ ns.o | tojson }}`;
const tidy = n => String(n || '').replace(/\s*steps$/i, '').trim().slice(0, 60);

// Home Assistant, with the token kept here.
async function ha(env, db, path, opts = {}) {
  const base = await db.get('config:home'), tok = env && env.HA_TOKEN;
  if (!base || !tok) throw Object.assign(new Error('ha-off'), { status: 503 });
  let r;
  try { r = await fetch(base + path, Object.assign({}, opts, { headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' } })); }
  catch { throw Object.assign(new Error('ha-unreachable'), { status: 502 }); }
  if (r.status === 401) throw Object.assign(new Error('ha-token'), { status: 502 });
  return r;
}

// One sensor's history as [[ms, number], ...], oldest first: 'unavailable', 'unknown' and
// blank readings left out.
function points(list, whole) {
  const pts = [];
  for (const s of Array.isArray(list) ? list : []) {
    if (!s || s.state === '' || s.state == null) continue;
    const n = Number(s.state), t = Date.parse(s.last_changed || s.last_updated);
    if (isFinite(n) && n >= 0 && isFinite(t)) pts.push([t, whole ? Math.round(n) : n]);
  }
  return pts.sort((a, b) => a[0] - b[0]);
}

// The count just before each drop (a reset at midnight) and the last one: each
// day's highest, without sending every reading.
export function peaks(history) {
  const pts = points(Array.isArray(history) && Array.isArray(history[0]) ? history[0] : [], true);
  return pts.filter((p, i) => i === pts.length - 1 || pts[i + 1][1] < p[1]);
}

// ---------------------------------------------------------------------------
// Apple Health: your own phone's Health sensors, summed into days.
// ---------------------------------------------------------------------------
const H = globalThis.FitnessHealth;
const ZONE = 'America/New_York';   // the family's calendar (Apex, NC), as in server/ipsy.js
const SENSOR = /^sensor\.[a-z0-9_]{1,120}$/;
// The day an instant falls on, on the family's calendar. Offsets there are whole hours: one
// lookup an hour, however many readings.
function dayOf() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }), seen = new Map();
  return t => { const h = Math.floor(t / 36e5); let d = seen.get(h); if (!d) { d = f.format(new Date(h * 36e5)); seen.set(h, d); } return d; };
}
const addDay = (s, n) => new Date(Date.parse(s + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
// Midnight at the start of a day there (EDT or EST).
function midnight(day) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE });
  for (const h of [4, 5]) { const t = Date.parse(day + 'T0' + h + ':00:00Z'); if (f.format(new Date(t)) === day && f.format(new Date(t - 1)) !== day) return t; }
  return Date.parse(day + 'T05:00:00Z');
}

// A history (Home Assistant's /api/history/period, minimal_response) summed into days:
// { 'YYYY-MM-DD': { key: value } }. entities: { key: entity_id }; from: the instant asked from
// (the reading standing then is left out: it may be from any day before); scale: { key: factor }.
//   total   the day's last reading: a running total reset at midnight, so its value at the end
//           of the day (as far as the phone told Home Assistant) - the count before the reset
//   latest  the day's last reading; heart rate, the average of the day's readings
//   night   the last reading of the sleep day (18:00 to 18:00), dated the morning it ends; a 0
//           is no night yet (the sensor starting the next one)
export function rollup(history, entities, from, scale = {}) {
  const keyOf = new Map(Object.entries(entities || {}).map(([k, e]) => [e, k]));
  const day = dayOf(), out = {};
  for (const list of Array.isArray(history) ? history : []) {
    const first = Array.isArray(list) && list[0], key = first && keyOf.get(first.entity_id), m = key && H.get(key);
    if (!m) continue;
    const f = +scale[key] || 1, sums = {};
    for (const [t, raw] of points(list)) {
      if (t <= from + 1000) continue;
      const v = raw * f;
      if (m.kind === 'night') { if (v > 0) sums[day(t + 6 * 36e5)] = { v, sum: v, n: 1 }; continue; }
      const d = day(t), s = sums[d] || (sums[d] = { v, sum: 0, n: 0 });
      s.v = v; s.sum += v; s.n++;
    }
    for (const d of Object.keys(sums)) {
      const s = sums[d], v = H.round(key, key === 'hr' ? s.sum / s.n : s.v);
      if (v != null) (out[d] || (out[d] = {}))[key] = v;
    }
  }
  return out;
}

// Which Health sensors this person's phone has: the ones on the same device as their Steps
// sensor, matched by name (with an admin's token, Home Assistant lists a device's sensors), or
// else sensor.<phone>_<slug>, kept when Home Assistant has it.
const DEVICE = e => `{% set d = device_id('${e}') %}{% set ns = namespace(o=[]) %}{% if d %}{% for x in device_entities(d) if x.startswith('sensor.') %}{% set ns.o = ns.o + [{'e': x, 'n': state_attr(x, 'friendly_name') or '', 'u': state_attr(x, 'unit_of_measurement') or ''}] %}{% endfor %}{% endif %}{{ {'dev': ((device_attr(d, 'name_by_user') or device_attr(d, 'name')) if d else '') or '', 'list': ns.o} | tojson }}`;
export function matchHealth(dev, list, prefix) {
  const map = {}, units = {}, taken = new Set(), name = String(dev || '').trim().toLowerCase();
  const ok = (Array.isArray(list) ? list : []).filter(x => x && SENSOR.test(x.e));
  // longest name first, so Resting Heart Rate is never taken for Heart Rate
  for (const m of H.METRICS.slice().sort((a, b) => b.name.length - a.name.length)) {
    const want = 'sensor.' + prefix + m.slug, nm = m.name.toLowerCase();
    const hit = ok.find(x => x.e === want && !taken.has(x.e)) || ok.find(x => {
      if (taken.has(x.e)) return false;
      const n = String(x.n || '').trim().toLowerCase();
      return n === nm || (name ? n === name + ' ' + nm : n.endsWith(' ' + nm));
    });
    if (!hit) continue;
    taken.add(hit.e); map[m.key] = hit.e;
    if (hit.u) units[m.key] = String(hit.u).slice(0, 12);
  }
  return { map, units };
}
// Kept in KV (health:<id>) for a day, or an hour while the phone has none on.
async function healthOf(env, db, me, mine) {
  const k = 'health:' + me.id;
  let c = null; try { c = JSON.parse(await db.get(k) || 'null'); } catch {}
  if (c && c.entity === mine && c.map && Date.now() - c.at < (Object.keys(c.map).length ? 864e5 : 36e5)) return c;
  const prefix = mine.slice(7, -5);   // sensor.tom_fs_iphone_steps -> tom_fs_iphone_
  let found = null, how = 'guess';
  try {
    const r = await ha(env, db, '/api/template', { method: 'POST', body: JSON.stringify({ template: DEVICE(mine) }) });
    if (r.ok) { const j = JSON.parse(await r.text()); if (j && Array.isArray(j.list) && j.list.length) { found = matchHealth(j.dev, j.list, prefix); how = 'device'; } }
  } catch (e) { if (e.message === 'ha-off' || e.message === 'ha-unreachable') throw e; }   // a token that isn't an admin's: guess instead
  if (!found) {
    const r = await ha(env, db, '/api/states');
    if (!r.ok) throw Object.assign(new Error('ha-' + r.status), { status: 502 });
    const text = await r.text(), map = {};   // only looked through, never parsed: it can be long
    for (const m of H.METRICS) { const e = 'sensor.' + prefix + m.slug; if (text.includes('"' + e + '"')) map[m.key] = e; }
    found = { map, units: {} };
  }
  // Sleep in hours (or seconds) is turned into minutes.
  const scale = {};
  for (const [key, u] of Object.entries(found.units)) {
    if (H.get(key).unit !== 'min') continue;
    if (/^(h|hr|hrs|hours?)$/i.test(u)) { scale[key] = 60; found.units[key] = 'min'; }
    else if (/^(s|sec|secs|seconds?)$/i.test(u)) { scale[key] = 1 / 60; found.units[key] = 'min'; }
  }
  c = { entity: mine, at: Date.now(), how, map: found.map, units: found.units, scale };
  await db.put(k, JSON.stringify(c));
  return c;
}

// ---------------------------------------------------------------------------
// The vitals alert: a notification when even one of your newest vitals is off (the Vitals tile's
// "N off": health.js statuses + vitalsOff), checked by a schedule (alerts/begin, alerts/check).
// ---------------------------------------------------------------------------
export const VITALS_ALERT = { title: 'Fitness', body: 'A vital is off your usual. Open Fitness.', tag: 'fitness-vitals' };
export const FRESH = 36 * 36e5;   // a reading older than this never alerts
const VITALS = H.METRICS.filter(m => m.cat === 'vitals').map(m => m.key);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// What a phone sends (POST vitals), checked: the switch, the day its usual is for, and each vital's
// usual (numbers only, or null). Anything else is dropped. null: not that shape.
export function cleanVitals(b) {
  if (!b || typeof b !== 'object' || typeof b.on !== 'boolean') return null;
  const ok = x => typeof x === 'number' && isFinite(x) && Math.abs(x) < 1e5, usual = {};
  const src = b.usual && typeof b.usual === 'object' ? b.usual : {};
  for (const k of VITALS) {
    const T = src[k];
    usual[k] = T && typeof T === 'object' && ['lo', 'hi', 'mean', 'far'].every(f => ok(T[f])) ? { lo: T.lo, hi: T.hi, mean: T.mean, far: T.far } : null;
  }
  return { on: b.on, day: ISO_DAY.test(String(b.day || '')) ? String(b.day) : '', usual };
}

// The time of each vital's last reading on each day: { day: { key: ms } } (the reading standing at
// `from` left out, as rollup leaves it out).
function lastAt(history, entities, from) {
  const keyOf = new Map(Object.entries(entities || {}).map(([k, e]) => [e, k])), day = dayOf(), out = {};
  for (const list of Array.isArray(history) ? history : []) {
    const first = Array.isArray(list) && list[0], key = first && keyOf.get(first.entity_id);
    if (!key) continue;
    for (const [t] of points(list)) { if (t <= from + 1000) continue; const d = day(t), o = out[d] || (out[d] = {}); o[key] = Math.max(o[key] || 0, t); }
  }
  return out;
}

// The day to alert about, or null: today (on the family's calendar), else yesterday, skipping a day
// already alerted (after: the last one) and any reading older than FRESH. A day's vitals are judged
// as Fitness's Vitals tile judges them: health.js statuses (the healthy ranges, and your usual as
// your phone sent it) and vitalsOff; even one off is enough.
export function offDay(history, entities, from, { today, now = Date.now(), usual, after, scale } = {}) {
  const days = rollup(history, entities, from, scale), at = lastAt(history, entities, from);
  for (const d of [today, addDay(today, -1)]) {
    if (after && d <= after) continue;
    const m = {};
    for (const [k, v] of Object.entries(days[d] || {})) if (VITALS.includes(k) && at[d] && at[d][k] && now - at[d][k] <= FRESH) m[k] = v;
    if (!Object.keys(m).length) continue;
    const all = H.statuses(d, [{ date: d, m }], { day: d, today, usual: usual && typeof usual === 'object' ? usual : {} });
    if (H.vitalsOff(all).off > 0) return d;
  }
  return null;
}

// The schedule's key: derived from ANNOUNCE_KEY (the release workflow puts it on the Pages project),
// so the scheduled check has nothing of its own to set up: HMAC-SHA256(ANNOUNCE_KEY, 'fitness-vitals').
const enc = s => new TextEncoder().encode(s);
export async function alertsKey(announceKey) {
  const k = await crypto.subtle.importKey('raw', enc(String(announceKey)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc('fitness-vitals')))].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function alertsKeyOk(request, env) {
  const base = String((env && env.ANNOUNCE_KEY) || ''), got = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
  if (base.length < 32 || !got) return false;
  const h = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', enc(s)));
  const [a, b] = await Promise.all([h(await alertsKey(base)), h(got)]);
  return a.every((x, i) => x === b[i]);
}

// Whether to look at someone at all: in the family, linked, with aOS notifications on, the alert not
// turned off, and not alerted today. -> { mine, pref, sent } or { skipped }
async function alertable(db, id, today) {
  const u = await getJSON(db, 'user:' + id);
  if (!u || u.removed) return { skipped: 'unknown' };
  const mine = await db.get('steps:' + id);
  if (!mine) return { skipped: 'not-linked' };
  if (!(await devices(db, id)).length) return { skipped: 'no-phones' };
  const pref = (await getJSON(db, 'vitals:' + id)) || {};
  if (pref.on === false) return { skipped: 'off' };
  const sent = (await getJSON(db, 'vitals-sent:' + id)) || {};
  if (sent.on === today) return { skipped: 'already' };
  return { mine, pref, sent };
}

// -> { status, body }. One person per check, as aOS's announcement: a request never has much to do.
export async function vitalsAlerts(db, env, request, step, b, { push = sendTo, now = Date.now() } = {}) {
  if (!env || !env.ANNOUNCE_KEY) return { status: 404, body: { error: 'not-found' } };
  if (!(await alertsKeyOk(request, env))) return { status: 403, body: { error: 'key' } };
  const today = dayOf()(now);
  if (step === 'begin') {
    const people = [];
    let cursor;
    do {
      const page = await db.list({ prefix: 'steps:by:', cursor });
      for (const k of page.keys) { const id = await db.get(k.name); if (id && !people.includes(id) && !(await alertable(db, id, today)).skipped) people.push(id); }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return { status: 200, body: { people } };
  }
  if (step !== 'check') return { status: 404, body: { error: 'not-found' } };
  const id = String((b && b.to) || ''), who = await alertable(db, id, today);
  if (who.skipped) return { status: 200, body: { skipped: who.skipped } };
  try {
    const c = await healthOf(env, db, { id }, who.mine), entities = {};
    for (const [k, e] of Object.entries(c.map || {})) if (VITALS.includes(k) && SENSOR.test(e)) entities[k] = e;
    if (!Object.keys(entities).length) return { status: 200, body: { skipped: 'no-vitals' } };
    const from = midnight(addDay(today, -1));
    const r = await ha(env, db, '/api/history/period/' + encodeURIComponent(new Date(from).toISOString()) + '?filter_entity_id=' + Object.values(entities).join(',')
      + '&end_time=' + encodeURIComponent(new Date(now + 60e3).toISOString()) + '&minimal_response&no_attributes&significant_changes_only=0');
    if (!r.ok) return { status: 200, body: { error: 'ha-' + r.status } };
    const day = offDay(JSON.parse(await r.text()), entities, from, { today, now, usual: who.pref.usual, after: who.sent.day, scale: c.scale });
    if (!day) return { status: 200, body: { alerted: false } };
    const res = await push(db, env, id, message({ ...VITALS_ALERT, url: '../fitness/?view=health&day=' + day }));
    if (res && res.sent) await putJSON(db, 'vitals-sent:' + id, { on: today, day }, 3 * 864e2);
    return { status: 200, body: { alerted: !!(res && res.sent), sent: (res && res.sent) || 0, failed: (res && res.failed) || 0, gone: (res && res.gone) || 0 } };
  } catch (e) {
    return { status: 200, body: { error: e.message || 'error' } };
  }
}

export async function onRequest({ request, params, env }, f = fetch, opts = {}) {
  const route = [].concat(params.route || []).join('/');
  const method = request.method.toUpperCase();
  // The scheduled vitals check (no session: its own key)
  if (route.startsWith('alerts/')) {
    const db = kv(env);
    if (!db) return reply({ error: 'storage' }, 503);
    if (method !== 'POST') return reply({ error: 'not-found' }, 404);
    let b = {}; try { b = JSON.parse(await request.text() || '{}'); } catch {}
    const r = await vitalsAlerts(db, env, request, route.slice(7), b, opts);
    return reply(r.body, r.status);
  }
  if (request.headers.get('X-Fitness') !== '1') return reply({ error: 'header' }, 400);
  const db = kv(env);
  if (!db) return reply({ error: 'storage' }, 503);
  const me = await sessionUser(db, request);
  if (!me) return reply({ error: 'signin' }, 401);
  if (route === 'ipsy') {
    if (method !== 'POST') return reply({ error: 'not-found' }, 404);
    if (!env.ANTHROPIC_API_KEY) return reply({ error: 'no-ai' }, 503);
    return ipsyStep({ env, request, db, me, app: 'fitness', head: ipsyRequestHead(env) }, f);
  }
  if (route === 'vitals') {
    if (method !== 'POST') return reply({ error: 'not-found' }, 404);
    const text = await request.text();
    let b = null; if (text.length <= 4000) { try { b = JSON.parse(text || 'null'); } catch {} }
    const rec = cleanVitals(b);
    if (!rec) return reply({ error: 'vitals' }, 400);
    await db.put('vitals:' + me.id, JSON.stringify({ ...rec, at: Date.now() }));
    return reply({ ok: true });
  }
  try {
    const mine = await db.get('steps:' + me.id);

    if (route === 'phones' && method === 'GET') {
      const out = { linked: mine ? { entity: mine, name: '' } : null, phones: [], list: true };
      try {
        const r = await ha(env, db, '/api/template', { method: 'POST', body: JSON.stringify({ template: LIST }) });
        if (r.ok) {
          const all = JSON.parse(await r.text());
          for (const p of Array.isArray(all) ? all : []) {
            if (!p || !ENTITY.test(p.entity) || HEALTH_STEPS.test(p.entity)) continue;
            if (p.entity === mine) out.linked.name = tidy(p.name);
            else if (!(await db.get('steps:by:' + p.entity))) out.phones.push({ entity: p.entity, name: tidy(p.name) });
          }
        } else out.list = false;   // a token that isn't an admin's can't list sensors: type yours instead
      } catch (e) { if (e.message === 'ha-off' || e.message === 'ha-token') return reply({ error: e.message }, e.status); out.list = false; }
      if (me.role === 'owner') {
        out.links = [];
        const page = await db.list({ prefix: 'steps:by:' });
        for (const k of page.keys) {
          const id = await db.get(k.name), u = id && await getJSON(db, 'user:' + id);
          out.links.push({ id, name: u ? u.name : '?', entity: k.name.slice(9) });
        }
      }
      return reply(out);
    }

    if (route === 'link' && method === 'POST') {
      let b = {}; try { b = JSON.parse(await request.text() || '{}'); } catch {}
      const entity = String(b.entity || '').trim().toLowerCase();
      if (!ENTITY.test(entity) || HEALTH_STEPS.test(entity)) return reply({ error: 'entity' }, 400);
      const who = await db.get('steps:by:' + entity);
      if (who && who !== me.id) return reply({ error: 'taken' }, 409);
      const r = await ha(env, db, '/api/states/' + entity);
      if (r.status === 404) return reply({ error: 'no-sensor' }, 404);
      if (!r.ok) return reply({ error: 'ha-' + r.status }, 502);
      if (mine === entity) return reply({ linked: { entity } });
      if (mine) await db.delete('steps:by:' + mine);
      await db.put('steps:' + me.id, entity);
      await db.put('steps:by:' + entity, me.id);
      return reply({ linked: { entity } });
    }

    if (route === 'unlink' && method === 'POST') {
      let b = {}; try { b = JSON.parse(await request.text() || '{}'); } catch {}
      const id = b.id ? String(b.id) : me.id;
      if (id !== me.id && me.role !== 'owner') return reply({ error: 'owner-only' }, 403);
      const e = await db.get('steps:' + id);
      if (e) { await db.delete('steps:by:' + e); await db.delete('steps:' + id); }
      await db.delete('health:' + id);
      return reply({ ok: true });
    }

    if (route === 'steps' && method === 'GET') {
      if (!mine) return reply({ error: 'not-linked' }, 404);
      const days = Math.min(DAYS, Math.max(1, Math.round(+new URL(request.url).searchParams.get('days') || DAYS)));
      // Apple Health's steps (an Apple Watch's too), once that phone's Health sensors have been found
      let c = null; try { c = JSON.parse(await db.get('health:' + me.id) || 'null'); } catch {}
      const read = c && c.entity === mine && c.map && SENSOR.test(c.map.steps || '') ? c.map.steps : mine;
      const now = Date.now(), from = new Date(now - days * 864e5).toISOString(), to = new Date(now + 60e3).toISOString();
      const r = await ha(env, db, '/api/history/period/' + encodeURIComponent(from) + '?filter_entity_id=' + read
        + '&end_time=' + encodeURIComponent(to) + '&minimal_response&no_attributes&significant_changes_only=0');
      if (!r.ok) return reply({ error: 'ha-' + r.status }, 502);
      return reply({ entity: read, points: peaks(JSON.parse(await r.text())) });
    }

    if (route === 'health' && method === 'GET') {
      if (!mine) return reply({ error: 'not-linked' }, 404);
      const days = Math.min(DAYS, Math.max(1, Math.round(+new URL(request.url).searchParams.get('days') || 2)));
      const c = await healthOf(env, db, me, mine);
      const entities = {};
      for (const [k, e] of Object.entries(c.map || {})) if (H.get(k) && SENSOR.test(e)) entities[k] = e;
      const ids = Object.values(entities);
      if (!ids.length) return reply({ entities, units: {}, days: {} });
      const today = dayOf()(Date.now()), from = midnight(addDay(today, -(days - 1)));
      const r = await ha(env, db, '/api/history/period/' + encodeURIComponent(new Date(from).toISOString()) + '?filter_entity_id=' + ids.join(',')
        + '&end_time=' + encodeURIComponent(new Date(Date.now() + 60e3).toISOString()) + '&minimal_response&no_attributes&significant_changes_only=0');
      if (!r.ok) return reply({ error: 'ha-' + r.status }, 502);
      return reply({ entities, units: c.units || {}, days: rollup(JSON.parse(await r.text()), entities, from, c.scale) });
    }

    return reply({ error: 'not-found' }, 404);
  } catch (e) {
    return reply({ error: e.message || 'error' }, e.status || 500);
  }
}
