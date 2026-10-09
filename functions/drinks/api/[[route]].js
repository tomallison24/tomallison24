// /drinks/api/* - each person's Drinks log, kept in their family account so it
// follows them to another phone and other apps can show their own numbers.
// Private to its owner: every call needs that person's session, and there is
// no way to ask for anyone else's log (not even the owner's tools can).
//
//   POST sync      { since, entries, days, prefs, graves } -> { at } or, when
//                  another phone changed something since 'since', the whole log
//                  too ({ at, full: true, entries, days, prefs, graves })
//   GET  summary   ?from=YYYY-MM-DD&to=YYYY-MM-DD   -> { days: { date: { sd, n } | { status } } }
//                  each day's standard drinks, or its mark (af / unknown), for
//                  Calendar's Drinks layer; at most 400 days at a time
// Deleting is a sync too: Drinks' "Delete all data" deletes every item on the
// phone, which leaves graves, so your other phones delete them as well. When
// the owner removes someone from the family, aOS deletes their log here.
//
// Stored in the accounts' Workers KV (ACCOUNTS, server/auth.js) as one value a
// person, drinks:<user id>: { v, at, entries, days, prefs, graves }, 'at' being
// when it last changed. The free plan allows 1,000 KV writes a day across the
// whole account (Mail's and Notes' push workers use some), so a sync only
// writes when it changed something, and the app waits a few seconds after the
// last change before it syncs. Reads are cheap (100,000 a day). The free plan
// also gives a request only 10 ms of CPU, so a phone sends just what changed
// since its last sync ('since' is the 'at' it got back then), and gets the
// whole log back only when another phone has changed it since.
//
// Merging works as Fitness's Google Sheet sync does: every item carries
// 'updated' (when it last changed, on the phone that changed it); the newer
// copy wins, and a deleted item leaves a grave (kind:id -> when), so a phone
// that hasn't heard yet can't bring it back. Graves older than 400 days go.
//
// The X-Drinks header stops other web pages calling this (as X-Travel does).

import { reply, kv, getJSON, sessionUser } from '../../../server/auth.js';

const MAX_BODY = 2 * 1024 * 1024;
const MAX_ITEMS = 20000;
const GRAVE_DAYS = 400;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const CATS = ['beer', 'wine', 'spirits', 'cocktail', 'seltzer', 'cider', 'other'];

const num = (v, lo, hi) => { const n = +v; return isFinite(n) && n >= lo && n <= hi ? n : null; };
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const when = v => { const n = +v; return isFinite(n) && n > 0 ? Math.round(n) : 1; };

// Only what Drinks stores, checked and trimmed; anything else is dropped.
const CLEAN = {
  entries(x) {
    if (!x || !ID.test(x.id) || !ISO.test(x.date)) return null;
    const vol = num(x.vol, 0.01, 10000), abv = num(x.abv, 0, 100), qty = num(x.qty, 1, 100);
    if (vol === null || abv === null || qty === null) return null;
    return { id: x.id, date: x.date, time: /^\d{2}:\d{2}$/.test(x.time || '') ? x.time : '', name: str(x.name, 60),
      cat: CATS.includes(x.cat) ? x.cat : 'other', vol, unit: x.unit === 'ml' ? 'ml' : 'oz', abv, qty: Math.round(qty), note: str(x.note, 200), updated: when(x.updated) };
  },
  days(x) {
    if (!x || !ISO.test(x.id) || (x.status !== 'af' && x.status !== 'unknown')) return null;
    return { id: x.id, status: x.status, updated: when(x.updated) };
  },
  prefs(x) {
    if (!x || x.id !== 'goals') return null;
    const week = num(x.week, 0, 500), day = num(x.day, 0, 100), af = num(x.af, 0, 7);
    if (week === null || day === null || af === null) return null;
    return { id: 'goals', week, day, af: Math.round(af), updated: when(x.updated) };
  },
};
const KINDS = Object.keys(CLEAN);

export function clean(log) {
  const out = { entries: [], days: [], prefs: [], graves: {} };
  if (!log || typeof log !== 'object') return out;
  for (const k of KINDS) if (Array.isArray(log[k])) for (const x of log[k].slice(0, MAX_ITEMS)) { const c = CLEAN[k](x); if (c) out[k].push(c); }
  if (log.graves && typeof log.graves === 'object') {
    for (const [k, t] of Object.entries(log.graves).slice(0, MAX_ITEMS)) {
      const m = /^(entries|days|prefs):(.+)$/.exec(k);
      if (m && ID.test(m[2]) && +t > 0) out.graves[k] = Math.round(+t);
    }
  }
  return out;
}

// Folds a phone's changes into the stored log (which this route wrote, so it
// is trusted as it is). Says whether anything changed, so nothing is written
// when nothing did.
export function apply(stored, inc, now = Date.now()) {
  const graves = Object.assign({}, stored.graves);
  let changed = false;
  for (const [k, t] of Object.entries(inc.graves)) if (!(graves[k] >= t)) { graves[k] = t; changed = true; }
  const old = now - GRAVE_DAYS * 864e5;
  for (const k of Object.keys(graves)) if (graves[k] < old) { delete graves[k]; changed = true; }
  const out = { graves };
  for (const kind of KINDS) {
    const map = new Map((stored[kind] || []).map(x => [x.id, x]));
    for (const x of inc[kind]) { const y = map.get(x.id); if (!y || x.updated > y.updated) { map.set(x.id, x); changed = true; } }
    for (const [id, x] of map) if (graves[kind + ':' + id] >= x.updated) { map.delete(id); changed = true; }
    out[kind] = [...map.values()];
  }
  return { log: out, changed };
}

// A drink's standard drinks: the same sum as drinks/calc.js (14 g of alcohol a drink).
const std = x => (x.unit === 'ml' ? x.vol : x.vol * 29.5735) * x.qty * x.abv / 100 * 0.789 / 14;

export function summary(log, from, to) {
  const days = {};
  for (const d of log.days) if (d.id >= from && d.id <= to) days[d.id] = { status: d.status };
  for (const x of log.entries) {
    if (x.date < from || x.date > to) continue;
    const d = days[x.date] && days[x.date].sd !== undefined ? days[x.date] : (days[x.date] = { sd: 0, n: 0 });
    d.sd += std(x); d.n += x.qty;
  }
  for (const d of Object.values(days)) if (d.sd !== undefined) d.sd = Math.round(d.sd * 100) / 100;
  return { days };
}

async function body(request) {
  const t = await request.text();
  if (t.length > MAX_BODY) throw Object.assign(new Error('too-big'), { status: 413 });
  try { return JSON.parse(t || '{}'); } catch { throw Object.assign(new Error('bad-json'), { status: 400 }); }
}

export async function onRequest({ request, params, env }) {
  if (request.headers.get('X-Drinks') !== '1') return reply({ error: 'not-found' }, 404);
  const route = [].concat(params.route || []).join('/');
  const method = request.method.toUpperCase();
  const db = kv(env);
  // Accounts aren't switched on yet (no storage, or no owner): Drinks keeps the log on the phone.
  if (!db) return reply({ error: 'accounts-off' }, 503);
  if (!(await db.get('owner'))) return reply({ error: 'accounts-off' }, 503);
  const me = await sessionUser(db, request);
  if (!me) return reply({ error: 'signin' }, 401);
  const key = 'drinks:' + me.id;
  try {
    if (route === 'sync' && method === 'POST') {
      const b = await body(request), mine = clean(b);
      let stored = null; try { stored = JSON.parse(await db.get(key) || 'null'); } catch {}
      if (!stored || typeof stored !== 'object') stored = { entries: [], days: [], prefs: [], graves: {} };
      const { log, changed } = apply(stored, mine);
      // Did another phone change it since this one last synced? Then send it all.
      const full = !(+b.since > 0 && +b.since === stored.at);
      let at = stored.at || 0;
      if (changed) {   // KV writes are the scarce thing: only when something changed
        at = Math.max(Date.now(), at + 1);
        await db.put(key, JSON.stringify({ v: 1, at, ...log }));
      }
      return reply(full ? { ok: true, at, full: true, ...log } : { ok: true, at });
    }
    if (route === 'summary' && method === 'GET') {
      const u = new URL(request.url), from = u.searchParams.get('from') || '', to = u.searchParams.get('to') || '';
      if (!ISO.test(from) || !ISO.test(to) || from > to) return reply({ error: 'range' }, 400);
      if ((Date.parse(to) - Date.parse(from)) / 864e5 > 400) return reply({ error: 'range' }, 400);
      const log = await getJSON(db, key);
      return reply(summary({ entries: (log && log.entries) || [], days: (log && log.days) || [] }, from, to));
    }
    return reply({ error: 'not-found' }, 404);
  } catch (e) {
    return reply({ error: e.status ? e.message : 'server' }, e.status || 500);
  }
}
