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
//   GET  speak?v=&t=&r=&s=       -> audio/mpeg      a sentence (t) in a character's own voice (v: VOICES); s: t is
//                                                   that letter's sound (SOUNDS)
//                                                   at a speed (r), from Google Cloud Text-to-Speech's
//                                                   Chirp 3: HD voices with the GOOGLE_TTS_KEY secret;
//                                                   503 { error: 'no-voice' } until that secret is set,
//                                                   and the phone speaks with its own voice instead
//
// KV (the accounts' Workers KV, server/auth.js): sparkle:<user id> { save, rev, at } and
// sparkle:clips:<user id> { clips, at }. The phone writes a save at the end of a round and when the
// game is put away, never once per answer, and only when it changed: the free plan's writes are scarce.
// Kept when someone is removed from the family, like the rest of their data (functions/aOS/api remove).
//
// Speech costs money past Google's free million characters a month, so it's for signed-in family only, the
// voices and the length are fixed, and each sentence is made once: kept in Cloudflare's cache here, and on
// the phone that asked (sparkle/voice.js). Nothing is kept in KV.
//
// The X-Sparkle header stops other web pages calling this (as X-Drinks does).

import { reply, kv, getJSON, putJSON, sessionUser } from '../../../server/auth.js';

export const SAVE_MAX = 256 * 1024, CLIPS_MAX = 1536 * 1024, CLIP_MAX = 96 * 1024, SPEAK_MAX = 400;
// each character's voice (Chirp 3: HD, en-US): the narrator and her unicorn, Professor Hoot, Pebble, Gemma, Bloom
export const VOICES = { narrator: 'Sulafat', owl: 'Charon', dragon: 'Puck', gemma: 'Leda', bloom: 'Vindemiatrix' };
// a letter's sound (s: the letter) said as that sound: read as text, "sss" or "mmm" comes out as the letter's
// name three times, so Google is given how to say it (IPA, its custom pronunciations)
export const SOUNDS = { a: 'æ', e: 'ɛ', i: 'ɪ', o: 'ɑ', u: 'ʌ', s: 'sː', m: 'mː', f: 'fː', n: 'nː', l: 'lː', r: 'ɹː', z: 'zː', v: 'vː',
  h: 'hə', t: 'tə', p: 'pə', c: 'kə', k: 'kə', b: 'bə', d: 'də', g: 'ɡə', j: 'dʒə', w: 'wə', y: 'jə', x: 'ks', q: 'kwə' };
const TTS = 'https://texttospeech.googleapis.com/v1/text:synthesize';
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

// a sentence's audio: from the cache, else made by Google and kept
export async function speak(env, url, fetcher = fetch) {
  const v = url.searchParams.get('v'), t = (url.searchParams.get('t') || '').trim(), s = url.searchParams.get('s') || '';
  const r = Math.round(Math.min(1.2, Math.max(0.6, +url.searchParams.get('r') || 0.9)) * 20) / 20;
  if (!VOICES[v] || !t || t.length > SPEAK_MAX || (s && !SOUNDS[s])) return reply({ error: 'bad-speak' }, 400);
  if (!env.GOOGLE_TTS_KEY) return reply({ error: 'no-voice' }, 503);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v + '|' + r + '|' + t + (s ? '|' + s : '')));
  const key = new Request('https://sparkle-voice.invalid/' + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('') + '.mp3');
  const cache = typeof caches !== 'undefined' && caches.default;
  const hit = cache && await cache.match(key).catch(() => null);
  if (hit) return hit;
  const ask = rate => fetcher(TTS, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_TTS_KEY },
    body: JSON.stringify({ input: Object.assign({ text: t }, s ? { customPronunciations: { pronunciations: [{ phrase: t, phoneticEncoding: 'PHONETIC_ENCODING_IPA', pronunciation: SOUNDS[s] }] } } : {}), voice: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-' + VOICES[v] }, audioConfig: Object.assign({ audioEncoding: 'MP3' }, rate ? { speakingRate: rate } : {}) }) });
  let g = await ask(r);
  if (g.status === 400) g = await ask(0);   // Google's docs disagree on whether these voices take a speed
  if (g.status === 400 && s) return reply({ error: 'no-sound' }, 422);   // a sound it won't say: the phone says it, never "s, s, s"
  if (!g.ok) return reply({ error: 'voice-failed', status: g.status }, 502);
  const j = await g.json().catch(() => ({}));
  if (!j.audioContent) return reply({ error: 'voice-failed' }, 502);
  const bin = atob(j.audioContent), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const res = new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=31536000, immutable' } });
  if (cache) await cache.put(key, new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=31536000, immutable' } })).catch(() => {});
  return res;
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
    if (route === 'speak' && method === 'GET') return await speak(env, new URL(request.url));
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
