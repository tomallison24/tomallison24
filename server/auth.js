// AllisonOS family accounts: the server side, shared by the Pages Functions
// (functions/aOS/api for the accounts themselves; the _middleware.js files that
// lock calendar/api and travel/api). Not under functions/, so it isn't a route.
//
// Everyone signs in with a passkey (Face ID), kept in their iCloud Keychain and
// tied to this site's address, so every app on the site - each with its own
// storage on an iPhone - can sign in with one tap. The server keeps, in a Workers
// KV namespace bound as ACCOUNTS (made and bound by .github/workflows/news.yml):
//   owner            the owner's id; until it exists, the locked routes refuse everyone
//   user:<id>        { id, name, role: 'owner'|'member', creds: [...], created, by,
//                      removed?: when the owner removed them (signed out, data kept) }
//   apps:<id>        { <app>: when it was last opened from their Home Screen }
//   sv:<id>          how many times they've used "Sign out other devices"
//   used:<challenge> a sign-in challenge already used, gone after 5 minutes
//   layer:<app>:<id> { at, data } - what Notes, Travel, Fitness or Mail shows in that
//                    person's Calendar (functions/aOS/api); only they can read it
//   cred:<credId>    { user, spki, alg, created } - a passkey's public key
//   invite:<token>   { name, by, user? } - one use, gone after 24 hours; with user,
//                    it brings that removed person back, with everything they had
//   chal:<id>        a sign-in or sign-up challenge, gone after 5 minutes
//   secret           the key sessions are signed with, made on first use
//   config:home      the family's Home Assistant address (an https origin), set by
//                    the owner in aOS; only signed-in family can read it
//   drinks:<id>      that person's Drinks log (functions/drinks/api); only they can
//                    read it, and it stays when they are removed (for an invite back)
//   config:plan, config:trial   the family's plan (functions/aOS/api, planView)
// A session is "<payload>.<HMAC>", payload { u: user id, e: expiry, s: sign-out
// count }; it holds only while the user is still in the family and their sign-out
// count (sv:<id>, kept apart from the user record so it never rewrites it) still
// matches, so removing someone, or "Sign out other devices",
// signs those sessions out everywhere (within KV's ~60 seconds).
// A sign-in challenge is signed the same way ({ k, c, e }, with a "c." prefix so it
// can never pass for a session) rather than stored: asking for one writes nothing.
//
// The very first account, the owner's, needs the owner code: a Cloudflare Pages
// secret, OWNER_CODE (never in this repository; aOS/RELEASING.md). Without it no
// owner can be made. After that, only an invite from the owner makes an account.

export const SESSION_DAYS = 400;
const enc = new TextEncoder();

// ---- bytes ----
export const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64u = s => { const t = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(t + '='.repeat((4 - t.length % 4) % 4)), c => c.charCodeAt(0)); };
export const rand = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async data => new Uint8Array(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data));
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

export function reply(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox", 'Referrer-Policy': 'no-referrer' } });
}

// ---- storage ----
export const kv = env => env && env.ACCOUNTS && typeof env.ACCOUNTS.get === 'function' ? env.ACCOUNTS : null;
export const getJSON = async (db, key) => { const v = await db.get(key); if (!v) return null; try { return JSON.parse(v); } catch { return null; } };
export const putJSON = (db, key, value, ttl) => db.put(key, JSON.stringify(value), ttl ? { expirationTtl: ttl } : undefined);

async function hmacKey(db) {
  let s = await db.get('secret');
  if (!s) { await db.put('secret', rand(32)); s = await db.get('secret'); }   // re-read: two first requests agree on one
  return crypto.subtle.importKey('raw', unb64u(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

// ---- sessions ----
export async function issue(db, userId, now = Date.now(), sv = 0) {
  const payload = b64u(enc.encode(JSON.stringify({ u: userId, e: Math.floor(now / 1000) + SESSION_DAYS * 86400, s: sv || 0 })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(db), enc.encode(payload));
  return payload + '.' + b64u(sig);
}

// ---- signed sign-in challenges (no KV write to hand one out) ----
export async function sealChallenge(db, kind, challenge, secs, now = Date.now()) {
  const payload = b64u(enc.encode(JSON.stringify({ k: kind, c: challenge, e: Math.floor(now / 1000) + secs })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(db), enc.encode('c.' + payload));
  return payload + '.' + b64u(sig);
}
export async function openChallenge(db, kind, id, now = Date.now()) {
  const m = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(id || ''));
  if (!m) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await hmacKey(db), unb64u(m[2]), enc.encode('c.' + m[1])); } catch { return null; }
  if (!ok) return null;
  let p; try { p = JSON.parse(new TextDecoder().decode(unb64u(m[1]))); } catch { return null; }
  return p && p.k === kind && typeof p.c === 'string' && typeof p.e === 'number' && p.e * 1000 >= now ? p.c : null;
}

// The signed-in user, or null: the session must be signed by us, unexpired, and its user still in the family.
export async function sessionUser(db, request, now = Date.now()) {
  const m = /^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(request.headers.get('Authorization') || '');
  if (!m) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await hmacKey(db), unb64u(m[2]), enc.encode(m[1])); } catch { return null; }
  if (!ok) return null;
  let p; try { p = JSON.parse(new TextDecoder().decode(unb64u(m[1]))); } catch { return null; }
  if (!p || typeof p.u !== 'string' || typeof p.e !== 'number' || p.e * 1000 < now) return null;
  const u = await getJSON(db, 'user:' + p.u);
  return u && !u.removed && (p.s || 0) === await signOuts(db, u.id) ? u : null;
}
export const signOuts = async (db, id) => +(await db.get('sv:' + id)) || 0;
export async function signOutOthers(db, id) {
  const sv = (await signOuts(db, id)) + 1;
  await db.put('sv:' + id, String(sv));
  return sv;
}

// ---- passkeys (WebAuthn) ----
// The address the request came to, and the origin a browser must have signed for.
export function party(request) {
  const u = new URL(request.url);
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  return { rpId: u.hostname, origin: (local ? u.protocol : 'https:') + '//' + u.host };
}

async function checkClient(clientDataJSON, type, challenge, origin) {
  let c; try { c = JSON.parse(new TextDecoder().decode(clientDataJSON)); } catch { throw new Error('client-data'); }
  if (c.type !== type) throw new Error('type');
  if (c.challenge !== challenge) throw new Error('challenge');
  if (c.origin !== origin) throw new Error('origin');
  if (c.crossOrigin) throw new Error('cross-origin');
}

async function checkAuthData(authData, rpId) {
  if (authData.length < 37) throw new Error('auth-data');
  if (!same(authData.slice(0, 32), await sha256(rpId))) throw new Error('rp');
  const flags = authData[32];
  if (!(flags & 0x01)) throw new Error('presence');        // UP: a person was there
  if (!(flags & 0x04)) throw new Error('verification');    // UV: Face ID (or the passcode) checked it was them
  return flags;
}

const ALGS = {
  [-7]: { key: { name: 'ECDSA', namedCurve: 'P-256' }, sig: { name: 'ECDSA', hash: 'SHA-256' } },
  [-257]: { key: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, sig: { name: 'RSASSA-PKCS1-v1_5' } },
};

// A sign-up: the browser's own record of the new passkey. Returns what to keep.
export async function verifyRegistration({ credId, clientDataJSON, authenticatorData, spki, alg }, challenge, { rpId, origin }) {
  const A = ALGS[alg]; if (!A) throw new Error('alg');
  const cd = unb64u(clientDataJSON), ad = unb64u(authenticatorData), id = unb64u(credId);
  await checkClient(cd, 'webauthn.create', challenge, origin);
  const flags = await checkAuthData(ad, rpId);
  if (!(flags & 0x40)) throw new Error('no-credential');
  const n = (ad[53] << 8) | ad[54];                         // after rpIdHash, flags, counter and the 16-byte AAGUID
  if (!same(ad.slice(55, 55 + n), id)) throw new Error('credential-id');
  await crypto.subtle.importKey('spki', unb64u(spki), A.key, false, ['verify']);   // a usable public key, of that kind
  return { credId: b64u(id), spki, alg };
}

// ECDSA signatures come DER-encoded; WebCrypto wants r and s, 32 bytes each.
function derToRaw(der) {
  if (der[0] !== 0x30) throw new Error('signature');
  let i = 2; const parts = [];
  for (let k = 0; k < 2; k++) {
    if (der[i] !== 0x02) throw new Error('signature');
    const len = der[i + 1]; let v = der.slice(i + 2, i + 2 + len); i += 2 + len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    if (v.length > 32) throw new Error('signature');
    const p = new Uint8Array(32); p.set(v, 32 - v.length); parts.push(p);
  }
  const out = new Uint8Array(64); out.set(parts[0]); out.set(parts[1], 32); return out;
}

// A sign-in: proof the person holds the passkey with this id.
export async function verifyAssertion({ clientDataJSON, authenticatorData, signature }, cred, challenge, { rpId, origin }) {
  const A = ALGS[cred.alg]; if (!A) throw new Error('alg');
  const cd = unb64u(clientDataJSON), ad = unb64u(authenticatorData);
  await checkClient(cd, 'webauthn.get', challenge, origin);
  await checkAuthData(ad, rpId);
  const signed = new Uint8Array(ad.length + 32); signed.set(ad); signed.set(await sha256(cd), ad.length);
  let sig = unb64u(signature); if (cred.alg === -7) sig = derToRaw(sig);
  const key = await crypto.subtle.importKey('spki', unb64u(cred.spki), A.key, false, ['verify']);
  if (!(await crypto.subtle.verify(A.sig, key, sig, signed))) throw new Error('signature');
}

// The owner code, checked against the OWNER_CODE secret (letters and digits count,
// case and spaces don't). Unset, or shorter than 16, nothing matches.
const plainCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export async function ownerCodeOk(code, env) {
  const want = plainCode(env && env.OWNER_CODE);
  if (want.length < 16) return false;
  const [a, b] = await Promise.all([sha256(plainCode(code)), sha256(want)]);
  return hex(a) === hex(b);
}

// ---- the lock, for the server routes that hold the family's secrets ----
// Only signed-in family get through. Until accounts are switched on (storage bound
// and the owner signed up) it refuses everyone: closed, never open by default.
export async function lock({ request, env, next }) {
  const db = kv(env);
  if (!db) return reply({ error: 'accounts-off' }, 503);
  if (!(await db.get('owner'))) return reply({ error: 'setup' }, 503);
  if (await sessionUser(db, request)) return next();
  return reply({ error: 'signin' }, 401);
}
