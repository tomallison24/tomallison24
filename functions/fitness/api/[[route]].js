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
//                        and its latest; Fitness puts each in its day on the phone's own clock
//
// Home Assistant keeps 10 days of history by default (recorder purge_keep_days),
// so that is as far back as this reads; Fitness keeps each day it has seen.
//
// Stored in the accounts' Workers KV (ACCOUNTS, server/auth.js):
//   steps:<user id>       the sensor linked to that person
//   steps:by:<entity>     who it's linked to (so no one else can link it)
// Written only on a link or an unlink. The address is the one the owner set
// for the Home app (config:home). The X-Fitness header stops other web pages
// calling this (as X-Drinks does).

import { reply, kv, getJSON, sessionUser } from '../../../server/auth.js';

const ENTITY = /^sensor\.[a-z0-9_]{1,80}_steps$/;
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

// The count just before each drop (a reset at midnight) and the last one: each
// day's highest, without sending every reading.
export function peaks(history) {
  const pts = [];
  for (const s of (Array.isArray(history) && Array.isArray(history[0]) ? history[0] : [])) {
    const n = Number(s && s.state), t = Date.parse(s && (s.last_changed || s.last_updated));
    if (s && s.state !== '' && isFinite(n) && n >= 0 && isFinite(t)) pts.push([t, Math.round(n)]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  return pts.filter((p, i) => i === pts.length - 1 || pts[i + 1][1] < p[1]);
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
            if (!p || !ENTITY.test(p.entity)) continue;
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
      if (!ENTITY.test(entity)) return reply({ error: 'entity' }, 400);
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
      return reply({ ok: true });
    }

    if (route === 'steps' && method === 'GET') {
      if (!mine) return reply({ error: 'not-linked' }, 404);
      const days = Math.min(DAYS, Math.max(1, Math.round(+new URL(request.url).searchParams.get('days') || DAYS)));
      const now = Date.now(), from = new Date(now - days * 864e5).toISOString(), to = new Date(now + 60e3).toISOString();
      const r = await ha(env, db, '/api/history/period/' + encodeURIComponent(from) + '?filter_entity_id=' + mine
        + '&end_time=' + encodeURIComponent(to) + '&minimal_response&no_attributes&significant_changes_only=0');
      if (!r.ok) return reply({ error: 'ha-' + r.status }, 502);
      return reply({ entity: mine, points: peaks(JSON.parse(await r.text())) });
    }

    return reply({ error: 'not-found' }, 404);
  } catch (e) {
    return reply({ error: e.message || 'error' }, e.status || 500);
  }
}
