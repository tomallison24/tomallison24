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
// Written only on a link or an unlink (and health: when its sensors are looked for). The address is the one the owner set
// for the Home app (config:home). The X-Fitness header stops other web pages
// calling this (as X-Drinks does).

import { reply, kv, getJSON, sessionUser } from '../../../server/auth.js';
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

export async function onRequest({ request, params, env }) {
  const route = [].concat(params.route || []).join('/');
  const method = request.method.toUpperCase();
  if (request.headers.get('X-Fitness') !== '1') return reply({ error: 'header' }, 400);
  const db = kv(env);
  if (!db) return reply({ error: 'storage' }, 503);
  const me = await sessionUser(db, request);
  if (!me) return reply({ error: 'signin' }, 401);
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
