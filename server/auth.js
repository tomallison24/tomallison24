// AllisonOS family accounts: the server side, shared by the Pages Functions
// (functions/aOS/api for the accounts themselves; the _middleware.js files that
// lock calendar/api and travel/api). Not under functions/, so it isn't a route.
//
// Everyone signs in with a passkey (Face ID), kept in their iCloud Keychain and
// tied to this site's address, so every app on the site - each with its own
// storage on an iPhone - can sign in with one tap. The server keeps, in a Workers
// KV namespace bound as ACCOUNTS (made and bound by .github/workflows/news.yml):
//   owner            the owner's id; until it exists, nothing is locked
//   user:<id>        { id, name, role: 'owner'|'member', creds: [...], created, by }
//   cred:<credId>    { user, spki, alg, created } - a passkey's public key
//   invite:<token>   { name, by } - one use, gone after 24 hours
//   chal:<id>        a sign-in or sign-up challenge, gone after 5 minutes
//   secret           the key sessions are signed with, made on first use
// A session is "<payload>.<HMAC>", payload { u: user id, e: expiry }; it holds
// only while the user is still in the family, so removing someone signs them out
// everywhere (within KV's ~60 seconds).
//
// The very first account, the owner's, needs the one-time owner code: its SHA-256
// is below (the code itself was given to the owner, never stored). After that,
// only an invite from the owner makes a new account.

export const OWNER_CODE_SHA256 = '5ade36922c62396e826de278737418bd6b5c0b0cd172df9b7d9f99af3ab6065c';
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
export async function issue(db, userId, now = Date.now()) {
  const payload = b64u(enc.encode(JSON.stringify({ u: userId, e: Math.floor(now / 1000) + SESSION_DAYS * 86400 })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(db), enc.encode(payload));
  return payload + '.' + b64u(sig);
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
  return getJSON(db, 'user:' + p.u);
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

export const ownerCodeOk = async code => hex(await sha256(String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))) === OWNER_CODE_SHA256;

// ---- the lock, for the server routes that hold the family's secrets ----
// Until accounts are switched on (storage bound and the owner signed up) it lets
// requests through as before, so nothing breaks before the owner is set up.
export async function lock({ request, env, next }) {
  const db = kv(env);
  if (!db || !(await db.get('owner'))) return next();
  if (await sessionUser(db, request)) return next();
  return reply({ error: 'signin' }, 401);
}
