// Gmail that stays signed in (not a route: functions/aOS/api uses it). A sign-in on a phone gives an hour-long key
// that can't be renewed (Google's sign-in for a page alone), so the apps asked again every hour. With this, the
// person signs in once through aOS's server (Google's sign-in with a code): Google gives the server a long-lived
// key, the refresh token, which stays here, sealed, and is never sent to a phone; the phone asks for an hour-long
// key when it needs one (POST gmail/token), signed in to the family, for its own Gmail only.
//
//   - read-only (gmail.readonly) for Travel, Orders, School and Money; Mail's own (gmail.modify, to label, move and
//     trash, and gmail.settings.basic, for its tags' sender rules) when Mail asks;
//   - sealed with AES-GCM under a key made from the client secret (env GOOGLE_CLIENT_SECRET): the KV alone opens
//     nothing, and the refresh token is useless without that secret anyway;
//   - DAYS (30) after signing in it's revoked at Google and deleted: the person signs in again, once a month;
//   - Disconnect (POST gmail/disconnect) revokes it at Google and deletes it; so does leaving the family (forget);
//   - off until GOOGLE_CLIENT_SECRET is set (and the consent screen is In production, or Google ends the refresh
//     token after 7 days): until then the apps sign in on the phone, as before.
//
// Kept in the accounts' KV:
//   gm:<user>            [{ email, kind, at, sealed }]  one entry an account and kind ('read' or 'modify'), at most 4
//   gmst:<state>         { uid, kind, back, nonce }     a sign-in on its way, 10 minutes, used once
//
// A sign-in is tied to the phone that started it (a cookie, aos_gm, set by gmail/start and checked when Google sends
// the person back): a link to Google's page sent to someone else can't put their Gmail in the sender's account.
import { getJSON, putJSON, rand, b64u, unb64u } from './auth.js';

export const DAYS = 30;
export const CLIENT_ID = '804406956056-e91hbdndc4cqgerh9sffl9fmt76nfpua.apps.googleusercontent.com';   // Mail's (mail/app.js)
export const SCOPES = { read: 'https://www.googleapis.com/auth/gmail.readonly', modify: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic' };
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth', TOKEN = 'https://oauth2.googleapis.com/token', REVOKE = 'https://oauth2.googleapis.com/revoke';
const PROFILE = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
const MAX = 4, STATE_SECS = 600;

export const on = env => !!(env && env.GOOGLE_CLIENT_SECRET);
const clientId = env => (env && env.GOOGLE_CLIENT_ID) || CLIENT_ID;
const back = site => site + '/aOS/api/gmail/back';
const covers = (have, want) => have === want || (have === 'modify' && want === 'read');
const sameEmail = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

async function sealKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('aos-gmail-v1|' + env.GOOGLE_CLIENT_SECRET));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(env, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sealKey(env), new TextEncoder().encode(text));
  return b64u(iv) + '.' + b64u(ct);
}
export async function unseal(env, s) {
  const [iv, ct] = String(s || '').split('.');
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv) }, await sealKey(env), unb64u(ct)));
}
const form = o => new URLSearchParams(o).toString();
const post = (f, url, o) => f(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(o) });

// Where Google sends the person back to: a page of this site (a path), never another site.
export const safeBack = s => (typeof s === 'string' && /^\/[a-zA-Z0-9]/.test(s) && !s.startsWith('//') && !/[\s\\]/.test(s) ? s.slice(0, 200) : '/aOS/');

// POST gmail/start { kind, hint, back } -> the address of Google's sign-in (with a code), for this person
export async function start(db, env, me, site, { kind = 'read', hint = '', back: to = '' } = {}) {
  if (!SCOPES[kind]) kind = 'read';
  const state = rand(18), nonce = rand(18);
  await putJSON(db, 'gmst:' + state, { uid: me.id, kind, back: safeBack(to), nonce }, STATE_SECS);
  const u = new URL(AUTH);
  u.search = new URLSearchParams({
    client_id: clientId(env), redirect_uri: back(site), response_type: 'code', scope: SCOPES[kind],   // just this kind's: not what Mail was granted too
    access_type: 'offline', prompt: 'consent', state, ...(hint ? { login_hint: String(hint).slice(0, 120) } : {}),
  });
  return { url: u.toString(), cookie: COOKIE + '=' + nonce + '; Path=/aOS/api/gmail; HttpOnly; Secure; SameSite=Lax; Max-Age=' + STATE_SECS };
}
export const COOKIE = 'aos_gm';
export const cookieOf = header => { const m = new RegExp('(?:^|;\\s*)' + COOKIE + '=([A-Za-z0-9_-]+)').exec(header || ''); return m ? m[1] : ''; };
export const clearCookie = COOKIE + '=; Path=/aOS/api/gmail; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

// GET gmail/back?code&state: Google sends the person here. The code becomes the refresh token (kept, sealed) and
// they go back to the page they came from, with #gmail=kept (or #gmail=error).
export async function finish(db, env, site, params, nonce = '', f = fetch) {
  const state = params.get('state') || '', st = state && await getJSON(db, 'gmst:' + state);
  if (st) await db.delete('gmst:' + state);
  const go = (ok, extra = '') => ({ to: site + (st ? st.back : '/aOS/') + '#gmail=' + (ok ? 'kept' : 'error') + extra });
  if (!st || params.get('error') || !params.get('code')) return go(false);
  if (!nonce || nonce !== st.nonce) return go(false);   // not the phone that started this sign-in
  const r = await post(f, TOKEN, { code: params.get('code'), client_id: clientId(env), client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: back(site), grant_type: 'authorization_code' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.refresh_token || !j.access_token) return go(false);
  const p = await f(PROFILE, { headers: { Authorization: 'Bearer ' + j.access_token } });
  const email = p.ok ? ((await p.json().catch(() => ({}))).emailAddress || '') : '';
  if (!email) { await post(f, REVOKE, { token: j.refresh_token }).catch(() => {}); return go(false); }
  const list = ((await getJSON(db, 'gm:' + st.uid)) || []).filter(x => !(sameEmail(x.email, email) && x.kind === st.kind));
  list.unshift({ email, kind: st.kind, at: Date.now(), sealed: await seal(env, j.refresh_token) });
  for (const old of list.slice(MAX)) await revoke(env, old, f);
  await putJSON(db, 'gm:' + st.uid, list.slice(0, MAX));
  return go(true, '&acct=' + encodeURIComponent(email));
}

async function revoke(env, x, f = fetch) { try { await post(f, REVOKE, { token: await unseal(env, x.sealed) }); } catch {} }

// POST gmail/token { email, kind } -> { token, exp, scope, email, until } an hour-long key, from the refresh token;
// { error: 'none' | 'expired' | 'revoked' } when the person has to sign in again.
export async function token(db, env, me, { email = '', kind = 'read' } = {}, now = Date.now(), f = fetch) {
  const list = (await getJSON(db, 'gm:' + me.id)) || [];
  const mine = y => !email || sameEmail(y.email, email);
  const x = list.find(y => y.kind === kind && mine(y)) || list.find(y => covers(y.kind, kind) && mine(y));   // its own kind first: read-only for the apps that only read
  if (!x) return { error: 'none' };
  const drop = async () => putJSON(db, 'gm:' + me.id, list.filter(y => y !== x));
  if (now - x.at > DAYS * 864e5) { await revoke(env, x, f); await drop(); return { error: 'expired' }; }
  let rt; try { rt = await unseal(env, x.sealed); } catch { await drop(); return { error: 'revoked' }; }
  const r = await post(f, TOKEN, { refresh_token: rt, client_id: clientId(env), client_secret: env.GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    if (j.error === 'invalid_grant') { await drop(); return { error: 'revoked' }; }   // a new password, or removed in Google's settings
    return { error: 'google', status: 502 };
  }
  return { token: j.access_token, exp: now + Math.max(60, (+j.expires_in || 3600) - 60) * 1000, scope: j.scope || SCOPES[x.kind], email: x.email, until: x.at + DAYS * 864e5 };
}

// POST gmail/disconnect { email, kind } (all of them without an email; every kind without one): revoked at Google,
// deleted here. Mail names its kind, so signing out of Mail leaves Travel's read-only sign-in alone.
export async function disconnect(db, env, me, { email = '', kind = '' } = {}, f = fetch) {
  const list = (await getJSON(db, 'gm:' + me.id)) || [];
  const gone = list.filter(x => (!email || sameEmail(x.email, email)) && (!kind || x.kind === kind)), kept = list.filter(x => !gone.includes(x));
  for (const x of gone) await revoke(env, x, f);
  if (kept.length) await putJSON(db, 'gm:' + me.id, kept); else await db.delete('gm:' + me.id);
  return { ok: true, removed: gone.length };
}

// GET gmail -> { on, accounts: [{ email, kind, until }] } (never a token)
export async function view(db, env, me) {
  const list = (await getJSON(db, 'gm:' + me.id)) || [];
  return { on: on(env), accounts: list.map(x => ({ email: x.email, kind: x.kind, until: x.at + DAYS * 864e5 })) };
}
