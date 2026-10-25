// /money/api/* - Money's transactions, kept for the family members who may see them.
//
// One phone reads Monarch's emails (Money reads its own Gmail, on the phone: money/app.js); that
// person is Money's reader, and decides who else in the family sees it (Settings > Who sees Money).
// Everyone else's Money shows what the reader's phone sent here. Nobody else ever sees any of it,
// not even the family's owner unless the reader adds them.
//
//   GET  state                          -> { reader: you are the reader, can: you may see it, readerName,
//                                           with: [ids] (the reader only), meta (if you may see it) }
//                                           No reader yet: { reader: false, can: false, open: true }
//   GET  months?from=YYYY-MM&to=YYYY-MM -> { months: { 'YYYY-MM': [transactions] } } at most 25 months
//   POST push   { months: { 'YYYY-MM': [transactions] }, alerts, hints, readAt }
//                                       (the reader, or the first to send while there is none, who
//                                        becomes the reader) each month sent replaces that month
//   POST settings { settings }          (anyone who may see it) card rewards, the online stores, the
//                                        "can't sync" alerts marked fixed; kept when newer
//   GET  people                         (the reader) the family, first names and ids, to pick from
//   POST share  { with: [ids] }         (the reader) who else sees Money
//   POST forget                         (the reader) everything here deleted: Settings > Delete all data
//
// Kept in the accounts' Workers KV (server/auth.js lists the keys):
//   money:share        { by: the reader's id, with: [ids], at }
//   money:meta         { at, months: { 'YYYY-MM': at }, alerts, hints, settings, readAt }
//   money:tx:YYYY-MM   { at, items: [transactions] }
// Free plan: a push writes only the months the phone says changed, plus the meta; a request gets
// 10 ms of CPU, so a month is at most 1,500 transactions and a push at most 6 months.
//
// The X-Money header stops other web pages calling this (as X-Drinks does), and
// _middleware.js locks it to signed-in family.

import { reply, kv, getJSON, putJSON, sessionUser } from '../../../server/auth.js';

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_BODY = 512 * 1024, MAX_MONTH = 1500, MAX_PUSH = 6, MAX_RANGE = 25;
const first = n => String(n || '').trim().split(/\s+/)[0].slice(0, 40);
const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
const num = v => typeof v === 'number' && isFinite(v) ? v : null;

// A transaction as the app sends it (money/parse.js), kept to its fields and sizes; anything else is dropped.
export function cleanTx(x) {
  if (!x || typeof x !== 'object') return null;
  const id = str(x.id, 80), date = str(x.date, 10), amt = num(x.amt), at = num(x.at);
  if (!id || !ISO.test(date) || amt == null || amt < 0 || amt > 1e8 || at == null || (x.dir !== 'in' && x.dir !== 'out')) return null;
  const merchant = str(x.merchant, 120).trim(); if (!merchant) return null;
  return { id, at, date, amt: Math.round(amt * 100) / 100, dir: x.dir, merchant, account: str(x.account, 120), last4: /^\d{0,5}$/.test(x.last4 || '') ? x.last4 || '' : '',
    cat: str(x.cat, 60), emoji: str(x.emoji, 16), mid: /^\d{0,30}$/.test(x.mid || '') ? x.mid || '' : '', src: x.src === 'summary' ? 'summary' : 'alert', min: num(x.min) };
}
const cleanAlert = a => a && typeof a === 'object' && str(a.id, 80) && ISO.test(str(a.date, 10)) && num(a.at) != null
  ? { id: str(a.id, 80), at: a.at, date: a.date, inst: str(a.inst, 80), what: str(a.what, 80) } : null;
const cleanHint = h => h && typeof h === 'object' && str(h.name, 60) ? { name: str(h.name, 60), freq: str(h.freq, 30) } : null;
// Settings: each card's rule ({ base, online, grocery, cap } percentages and dollars, or off), the online
// stores, the alerts marked fixed.
const pct = v => { const n = num(v); return n == null ? 0 : Math.min(30, Math.max(0, Math.round(n * 100) / 100)); };
export function cleanSettings(s) {
  if (!s || typeof s !== 'object') return null;
  const cards = {};
  if (s.cards && typeof s.cards === 'object') for (const [k, v] of Object.entries(s.cards).slice(0, 40)) {
    const key = str(k, 120); if (!key || !v || typeof v !== 'object') continue;
    cards[key] = v.off ? { off: true } : { base: pct(v.base), online: pct(v.online), grocery: pct(v.grocery), cap: Math.min(1e6, Math.max(0, Math.round(num(v.cap) || 0))) };
  }
  const online = Array.isArray(s.online) ? s.online.map(x => str(x, 60).trim()).filter(Boolean).slice(0, 60) : undefined;
  const dismissed = Array.isArray(s.dismissed) ? s.dismissed.map(x => str(x, 80)).filter(Boolean).slice(-100) : [];
  const out = { cards, dismissed, at: num(s.at) || Date.now() };
  if (online) out.online = online;
  return out;
}

async function body(request) {
  const t = await request.text();
  if (t.length > MAX_BODY) throw Object.assign(new Error('too-big'), { status: 413 });
  try { return JSON.parse(t || '{}') || {}; } catch { throw Object.assign(new Error('bad-json'), { status: 400 }); }
}
const allowed = (share, me) => !!share && (share.by === me.id || (share.with || []).includes(me.id));

export async function onRequest({ request, params, env }) {
  if (request.headers.get('X-Money') !== '1') return reply({ error: 'not-found' }, 404);
  const route = [].concat(params.route || []).join('/');
  const method = request.method.toUpperCase();
  const db = kv(env);
  if (!db || !(await db.get('owner'))) return reply({ error: 'accounts-off' }, 503);
  const me = await sessionUser(db, request);
  if (!me) return reply({ error: 'signin' }, 401);
  try {
    const share = await getJSON(db, 'money:share');
    const reader = !!share && share.by === me.id, can = allowed(share, me);

    if (route === 'state' && method === 'GET') {
      if (!share) return reply({ reader: false, can: false, open: true });
      const by = await getJSON(db, 'user:' + share.by);
      const out = { reader, can, readerName: first(by && by.name) };
      if (reader) out.with = share.with || [];
      if (can) out.meta = (await getJSON(db, 'money:meta')) || { at: 0, months: {}, alerts: [], hints: [], settings: null, readAt: 0 };
      return reply(out);
    }

    if (route === 'months' && method === 'GET') {
      if (!can) return reply({ error: 'not-shared' }, 403);
      const u = new URL(request.url), from = u.searchParams.get('from') || '', to = u.searchParams.get('to') || '';
      if (!YM.test(from) || !YM.test(to) || from > to) return reply({ error: 'range' }, 400);
      const list = [];
      for (let y = +from.slice(0, 4), m = +from.slice(5, 7); ; m++) {
        if (m > 12) { m = 1; y++; }
        const ym = y + '-' + String(m).padStart(2, '0');
        if (ym > to) break;
        list.push(ym);
        if (list.length > MAX_RANGE) return reply({ error: 'range' }, 400);
      }
      const meta = await getJSON(db, 'money:meta'), have = (meta && meta.months) || {}, months = {};
      for (const ym of list) if (have[ym]) { const v = await getJSON(db, 'money:tx:' + ym); months[ym] = (v && v.items) || []; }
      return reply({ months });
    }

    if (route === 'push' && method === 'POST') {
      if (share && !reader) return reply({ error: 'not-reader' }, 403);
      const b = await body(request);
      const sent = b.months && typeof b.months === 'object' ? Object.entries(b.months) : [];
      if (sent.length > MAX_PUSH) return reply({ error: 'too-many-months' }, 400);
      const now = Date.now(), meta = (await getJSON(db, 'money:meta')) || { at: 0, months: {}, alerts: [], hints: [], settings: null, readAt: 0 };
      const months = {};
      for (const [ym, items] of sent) {
        if (!YM.test(ym) || !Array.isArray(items)) return reply({ error: 'month' }, 400);
        if (items.length > MAX_MONTH) return reply({ error: 'too-big' }, 413);
        months[ym] = items.map(cleanTx).filter(x => x && x.date.slice(0, 7) === ym);
      }
      if (!share) await putJSON(db, 'money:share', { by: me.id, with: [], at: now });   // the first phone to send is the reader
      for (const [ym, items] of Object.entries(months)) {
        if (items.length) { await putJSON(db, 'money:tx:' + ym, { at: now, items }); meta.months[ym] = now; }
        else if (meta.months[ym]) { await db.delete('money:tx:' + ym); delete meta.months[ym]; }
      }
      if (Array.isArray(b.alerts)) meta.alerts = b.alerts.map(cleanAlert).filter(Boolean).slice(-50);
      if (Array.isArray(b.hints)) meta.hints = b.hints.map(cleanHint).filter(Boolean).slice(-60);
      if (num(b.readAt)) meta.readAt = b.readAt;
      meta.at = now;
      await putJSON(db, 'money:meta', meta);
      return reply({ ok: true, at: now, months: meta.months });
    }

    if (route === 'settings' && method === 'POST') {
      if (!can) return reply({ error: 'not-shared' }, 403);
      const s = cleanSettings((await body(request)).settings);
      if (!s) return reply({ error: 'settings' }, 400);
      const meta = (await getJSON(db, 'money:meta')) || { at: 0, months: {}, alerts: [], hints: [], settings: null, readAt: 0 };
      if (meta.settings && meta.settings.at > s.at) return reply({ ok: false, settings: meta.settings });   // someone changed them since: theirs stays
      meta.settings = s; meta.at = Date.now();
      await putJSON(db, 'money:meta', meta);
      return reply({ ok: true, settings: s });
    }

    if (route === 'people' && method === 'GET') {
      if (!reader) return reply({ error: 'not-reader' }, 403);
      const people = [];
      let cursor;
      do {
        const page = await db.list({ prefix: 'user:', cursor });
        for (const k of page.keys) { const u = await getJSON(db, k.name); if (u && !u.removed && u.id !== me.id) people.push({ id: u.id, name: first(u.name), role: u.role }); }
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      return reply({ people });
    }

    if (route === 'share' && method === 'POST') {
      if (!reader) return reply({ error: 'not-reader' }, 403);
      const b = await body(request);
      if (!Array.isArray(b.with) || b.with.length > 20 || !b.with.every(x => typeof x === 'string' && ID.test(x))) return reply({ error: 'with' }, 400);
      const ids = [];
      for (const id of new Set(b.with)) { const u = id !== me.id && await getJSON(db, 'user:' + id); if (u && !u.removed) ids.push(id); }
      await putJSON(db, 'money:share', { by: me.id, with: ids, at: Date.now() });
      return reply({ ok: true, with: ids });
    }

    if (route === 'forget' && method === 'POST') {
      if (!reader) return reply({ error: 'not-reader' }, 403);
      await forgetMoney(db);
      return reply({ ok: true });
    }

    return reply({ error: 'not-found' }, 404);
  } catch (e) {
    return reply({ error: e.status ? e.message : 'server' }, e.status || 500);
  }
}

// Everything Money keeps here (the reader asked, or the reader left the family: functions/aOS/api, forget).
export async function forgetMoney(db) {
  const keys = ['money:share', 'money:meta'];
  let cursor;
  do { const page = await db.list({ prefix: 'money:tx:', cursor }); keys.push(...page.keys.map(k => k.name)); cursor = page.list_complete ? null : page.cursor; } while (cursor);
  for (const k of keys) await db.delete(k);
}
