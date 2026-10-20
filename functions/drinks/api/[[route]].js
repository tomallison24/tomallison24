// /drinks/api/* - your own Drinks numbers, for the other apps that show them
// (Fitness's Analysis and week, Calendar's Drinks layer). Drinks keeps its log
// in the family's Google Sheet (drinks/google-sheet-sync.gs, through aOS:
// functions/sheet/api, aOS/SHEETS.md), each row marked with whose it is; this
// route asks that Sheet's script for the person signed in, and only for them.
// Private to its owner: every call needs that person's session, and there is
// no way to ask for anyone else's days (not even the owner's tools can).
//
//   GET  summary   ?from=YYYY-MM-DD&to=YYYY-MM-DD   -> { days: { date: { sd, n } | { status } } }
//                  each day's standard drinks, or { status: 'af' } (alcohol-free); at most 400
//                  days at a time. No Sheet set up yet: { days: {} }, as if nothing were logged.
//                  The Sheet unreachable or answering wrongly: 502 { error }, so the app asks again later.
//
// Drinks used to keep each person's log here too, in the accounts' Workers KV
// (drinks:<user id>). The Sheet replaced that: Drinks no longer syncs to it,
// and nothing here reads or writes it any more. The values already there are
// left as they were (aOS keeps or hands them back when someone leaves or comes
// back, server/auth.js).
//
// The Sheet's link and phrase are aOS's (config:sheet:drinks, given by the
// owner in aOS > Account > Google Sheets); the script is asked as aOS asks it
// for a sync: ?key=&who=&name=&owner=1 (the owner only)&app=drinks, and trusts
// who only with the key. The free plan gives a request 10 ms of CPU: the
// script's answer is a small map of days (at most 400), parsed and passed on.
//
// The X-Drinks header stops other web pages calling this (as X-Travel does).

import { reply, kv, getJSON, sessionUser } from '../../../server/auth.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const first = n => String(n || '').trim().split(/\s+/)[0].slice(0, 40);

// What the script says, kept to the shape Fitness and Calendar read.
export function clean(days) {
  const out = {};
  if (!days || typeof days !== 'object') return out;
  for (const [d, x] of Object.entries(days)) {
    if (!ISO.test(d) || !x || typeof x !== 'object') continue;
    if (typeof x.sd === 'number' && isFinite(x.sd)) out[d] = { sd: Math.round(x.sd * 100) / 100, n: +x.n || 0 };
    else if (x.status === 'af') out[d] = { status: 'af' };
  }
  return out;
}

async function fromSheet(cfg, me, from, to) {
  const u = new URL(cfg.url);
  u.searchParams.set('key', cfg.secret);
  u.searchParams.set('who', me.id);
  u.searchParams.set('name', first(me.name));
  if (me.role === 'owner') u.searchParams.set('owner', '1');
  u.searchParams.set('app', 'drinks');
  let r;
  try { r = await fetch(u.toString(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'summary', from, to }), redirect: 'follow' }); }
  catch { return { error: 'sheet-unreachable' }; }
  if (!r.ok) return { error: 'sheet-' + r.status };
  let j = null; try { j = await r.json(); } catch {}
  if (!j) return { error: 'not-json' };
  // a script from before aOS: it wants the phrase in the body, so says 'wrong-secret' without aos
  if (!j.ok) return { error: j.error === 'wrong-secret' && !j.aos ? 'old-script' : j.error || 'sheet-error' };
  if (!j.aos || !j.days || typeof j.days !== 'object' || Array.isArray(j.days)) return { error: 'old-script' };
  return { days: clean(j.days) };
}

export async function onRequest({ request, params, env }) {
  if (request.headers.get('X-Drinks') !== '1') return reply({ error: 'not-found' }, 404);
  const route = [].concat(params.route || []).join('/');
  const method = request.method.toUpperCase();
  const db = kv(env);
  // Accounts aren't switched on yet (no storage, or no owner): there's no one to ask for.
  if (!db) return reply({ error: 'accounts-off' }, 503);
  if (!(await db.get('owner'))) return reply({ error: 'accounts-off' }, 503);
  const me = await sessionUser(db, request);
  if (!me) return reply({ error: 'signin' }, 401);
  try {
    if (route === 'summary' && method === 'GET') {
      const u = new URL(request.url), from = u.searchParams.get('from') || '', to = u.searchParams.get('to') || '';
      if (!ISO.test(from) || !ISO.test(to) || from > to) return reply({ error: 'range' }, 400);
      if ((Date.parse(to) - Date.parse(from)) / 864e5 > 400) return reply({ error: 'range' }, 400);
      const cfg = await getJSON(db, 'config:sheet:drinks');
      if (!cfg || !cfg.url || !cfg.secret) return reply({ days: {} });   // the owner hasn't set the Sheet up yet: nothing logged, as far as anyone can tell
      const r = await fromSheet(cfg, me, from, to);
      return r.error ? reply({ error: r.error }, 502) : reply({ days: r.days });
    }
    return reply({ error: 'not-found' }, 404);
  } catch (e) {
    return reply({ error: e.status ? e.message : 'server' }, e.status || 500);
  }
}
