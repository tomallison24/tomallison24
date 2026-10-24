// /sparkle/api/* - Sparkle Kingdom's players and letter sounds, kept in the family account of the
// grown-up signed in on the phone (server/auth.js), so the children's progress follows them to any
// family phone signed in to the same account. The game itself runs on the phone (sparkle/app.js):
// this only keeps a copy. Private to that account: every call needs its session.
//
//   GET  save                    -> { save, rev }   the account's copy (null and 0 before the first)
//   POST save   { save, rev }    -> { ok, rev }     kept if rev is still the account's newest; else 409
//                                                   { save, rev } with the newer copy, which the phone
//                                                   merges (sparkle/engine.js merge) and sends again
//   GET  clips                   -> { clips }       the letter sounds a grown-up recorded
//   POST clips  { clips }        -> { ok }          { letter: 'data:audio/...;base64,...' }, each short
//
// KV (the accounts' Workers KV, server/auth.js): sparkle:<user id> { save, rev, at } and
// sparkle:clips:<user id> { clips, at }. The phone writes a save at the end of a round and when the
// game is put away, never once per answer, and only when it changed: the free plan's writes are scarce.
// Kept when someone is removed from the family, like the rest of their data (functions/aOS/api remove).
//
// The X-Sparkle header stops other web pages calling this (as X-Drinks does).

import { reply, kv, getJSON, putJSON, sessionUser } from '../../../server/auth.js';

export const SAVE_MAX = 256 * 1024, CLIPS_MAX = 1536 * 1024, CLIP_MAX = 96 * 1024;
const LETTER = /^[a-z]$/;
const AUDIO = /^data:audio\/[a-z0-9.+-]+(;[a-z0-9=.+-]+)*;base64,[A-Za-z0-9+/]+=*$/i;

// a save looks like one: players by id, each with an id and a name
export function okSave(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s) || s.v !== 1) return false;
  if (!s.players || typeof s.players !== 'object' || Array.isArray(s.players)) return false;
  if (Object.keys(s.players).length > 12) return false;
  for (const [id, p] of Object.entries(s.players)) if (!p || typeof p !== 'object' || p.id !== id || typeof p.name !== 'string' || p.name.length > 40) return false;
  return true;
}
export function okClips(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  for (const [k, v] of Object.entries(c)) if (!LETTER.test(k) || typeof v !== 'string' || v.length > CLIP_MAX || !AUDIO.test(v)) return false;
  return true;
}

async function body(request, max) {
  const t = await request.text();
  if (t.length > max) throw Object.assign(new Error('too-big'), { status: 413 });
  try { return JSON.parse(t || '{}'); } catch { throw Object.assign(new Error('bad-json'), { status: 400 }); }
}

export async function onRequest({ request, params, env }) {
  const route = [].concat(params.route || []).join('/');
  const method = request.method.toUpperCase();
  if (request.headers.get('X-Sparkle') !== '1') return reply({ error: 'header' }, 400);
  const db = kv(env); if (!db) return reply({ error: 'storage' }, 503);
  try {
    const me = await sessionUser(db, request);
    if (!me) return reply({ error: 'signin' }, 401);
    if (route === 'save' && method === 'GET') {
      const v = await getJSON(db, 'sparkle:' + me.id);
      return reply({ save: (v && v.save) || null, rev: (v && v.rev) || 0 });
    }
    if (route === 'save' && method === 'POST') {
      const b = await body(request, SAVE_MAX + 1024);
      if (!okSave(b.save)) return reply({ error: 'bad-save' }, 400);
      const v = await getJSON(db, 'sparkle:' + me.id), rev = (v && v.rev) || 0;
      if ((+b.rev || 0) !== rev) return reply({ error: 'stale', save: v ? v.save : null, rev }, 409);
      await putJSON(db, 'sparkle:' + me.id, { save: b.save, rev: rev + 1, at: Date.now() });
      return reply({ ok: true, rev: rev + 1 });
    }
    if (route === 'clips' && method === 'GET') {
      const v = await getJSON(db, 'sparkle:clips:' + me.id);
      return reply({ clips: (v && v.clips) || {} });
    }
    if (route === 'clips' && method === 'POST') {
      const b = await body(request, CLIPS_MAX);
      if (!okClips(b.clips)) return reply({ error: 'bad-clips' }, 400);
      await putJSON(db, 'sparkle:clips:' + me.id, { clips: b.clips, at: Date.now() });
      return reply({ ok: true });
    }
    return reply({ error: 'unknown' }, 404);
  } catch (e) {
    return reply({ error: e.message || 'error' }, e.status || 500);
  }
}
