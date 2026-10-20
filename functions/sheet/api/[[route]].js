// /sheet/api/<app> - each app's Google Sheet, through aOS. The family's Sheets
// are the record for Fitness, Drinks, Podcasts, Orders, Notes (and Places, on
// Notes' Sheet), Travel and Meals: one Sheet an app for the whole family, each
// row marked with who it belongs to (aOS/SHEETS.md).
//
// The phones never hold a Sheet's link or secret phrase any more: the owner
// gives them to aOS once (here, kept in the accounts' Workers KV), and every
// sync comes through this route, which checks the person's own session (Face
// ID) and passes the phone's request on to the app's Apps Script with
//   ?key=<the Sheet's secret>&who=<their user id>&name=<their first name>&owner=1 (the owner only)
// The script trusts who only with the key, so it can hand each person their
// own rows and nobody else's: a lost phone, or one family member, can't read
// another's.
//
//   GET  <app>            (family) -> { configured, url? (owner), at? }
//   POST <app>            (family) the app's sync request, passed on as it is; the script's answer back
//   POST <app>/config     (owner)  { url, secret } -> checked with the script ('ping'), then kept;
//                                  { secret } alone keeps the link it has (or the app's usual one);
//                                  { clear: true } forgets it
//   POST <app>/claim      (owner)  { url, secret }: the same, but only while nothing is kept yet - an
//                                  owner's phone moving the link and phrase it already had over to aOS
//
// Stored as config:sheet:<sheet> { url, secret, at } (Places is Notes' Sheet).
// Only the owner's tools ever see a link, and nothing ever sends a secret back.
// The free plan gives a request 10 ms of CPU: the phone's request and the
// script's answer are passed through as text, never parsed here.

import { reply, kv, getJSON, putJSON, sessionUser } from '../../../server/auth.js';

// app -> [its Sheet, personal (each person's own rows) or family (shared, with "Just me" items)]
export const SHEETS = {
  fitness: ['fitness', 'personal'], drinks: ['drinks', 'personal'], podcasts: ['podcasts', 'personal'], orders: ['orders', 'personal'],
  notes: ['notes', 'family'], places: ['notes', 'family'], travel: ['travel', 'family'], meals: ['meals', 'family'],
};
// The owner's own Sheets, as the apps had them filled in: the link alone opens nothing (it needs the phrase).
const USUAL = {
  fitness: 'https://script.google.com/macros/s/AKfycbzGn0a1Qva6N365vkI8T8yia3sDtOIfeYxHTLU9fivWgu8FOnI4w6cwzH2P1-wPAblu/exec',   // deployed anew with aOS's script (VERSION 3)
  drinks: 'https://script.google.com/macros/s/AKfycbxzpSXXD2t-j7kaNrA3S-kK74uaxC5J6P_OykrOQrdYYww4JCViMrwMnXSVo4Qn3nOO/exec',
  podcasts: 'https://script.google.com/macros/s/AKfycbzyRxvnOvC97ByhaBJ0_Oc1Z-pP_SBIA9rZPEa5dyvvn1c4W1tGcOyM8LG4XXXbf7Vb/exec',
  orders: 'https://script.google.com/macros/s/AKfycbxj_O0w_Q30WKA-AfWXh86ZyspCG2JsxtsSal_pO8_rpz1xQbbDRNx0L_LY-2ylKJgT/exec',
  notes: 'https://script.google.com/macros/s/AKfycbz8kIAKSV-PVYnVX_TvZeSGNiR1t5kqArVzcjnSw7OkiHbyWEmVmxNqoPwFc4oQZRcO/exec',
  travel: 'https://script.google.com/macros/s/AKfycbzEjKlk2PnB_VrMrrPdX6ObNX_kRX2cdxrdfhqjAJFmyzQ8mJEDU9phaKDD_B2CElI1gg/exec',
  meals: 'https://script.google.com/macros/s/AKfycbx7TrC5hNipE0gpjFOMZLRl_mMay1oMDYTkosgPLqvui5wJuOz6WN04iVe1tks-GEmD_w/exec',
};
// Links the owner has since replaced with a new deployment of the same Sheet's script: a kept one moves to the usual link.
const RETIRED = new Set([
  'https://script.google.com/macros/s/AKfycbwaEyJbjiKey2XfSQQWat96T-9l_c-BFkDskBvQ-fjWk03cjgilRWjK11lr2vKChHsvEQ/exec',
  'https://script.google.com/macros/s/AKfycbwcj6XPCZPiRyc8nX4hK5cH7vezioihiGTLlYPeoxd_6D3HuHdCE6DzzJlwdAVDghIzXA/exec',
  'https://script.google.com/macros/s/AKfycbzxpkjVaf-qQYWOgGIL5iHrdHYse8htiEm1Jjp6fyX8Af7c2a-Oc5F58W864pufSm7ICw/exec',
]);
const current = (cfg, sheetApp) => cfg && (RETIRED.has(cfg.url) && USUAL[sheetApp] ? { ...cfg, url: USUAL[sheetApp] } : cfg);
const MAX_BODY = 8 * 1024 * 1024;
const okUrl = u => { try { const x = new URL(u); return x.protocol === 'https:' && /^script\.google(usercontent)?\.com$/.test(x.hostname) && !x.username ? x.origin + x.pathname : null; } catch { return null; } };
const first = n => String(n || '').trim().split(/\s+/)[0].slice(0, 40);

// The address to post to: the script's link with who's asking.
function target(cfg, me, sheetApp) {
  const u = new URL(cfg.url);
  u.searchParams.set('key', cfg.secret);
  u.searchParams.set('who', me.id);
  u.searchParams.set('name', first(me.name));
  if (me.role === 'owner') u.searchParams.set('owner', '1');
  u.searchParams.set('app', sheetApp);
  return u.toString();
}
async function post(url, body) {
  let r;
  try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, redirect: 'follow' }); }
  catch { return { status: 502, text: JSON.stringify({ ok: false, error: 'sheet-unreachable' }) }; }
  const text = await r.text();
  return { status: r.ok ? 200 : 502, text: r.ok ? text : JSON.stringify({ ok: false, error: 'sheet-' + r.status }) };
}
const raw = (text, status = 200) => new Response(text, { status, headers: {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox", 'Referrer-Policy': 'no-referrer' } });

// Ask the script who it is, with this key: a new script answers { ok, app } to 'ping'.
async function check(url, secret, sheetApp, me) {
  const r = await post(target({ url, secret }, me, sheetApp), JSON.stringify({ action: 'ping' }));
  let j = null; try { j = JSON.parse(r.text); } catch {}
  if (!j) return 'not-json';
  if (j.ok && j.app && !String(j.app).includes(sheetApp === 'notes' ? 'notes' : sheetApp)) return 'wrong-app';
  if (j.ok) return null;
  if (j.error === 'wrong-secret' && j.aos) return 'wrong-secret';   // a script made for this: just the phrase is wrong
  if (j.error === 'wrong-secret' || j.error === 'bad-request') return 'old-script';   // a script from before aOS passed the phrase on
  return j.error || 'sheet-error';
}

export async function onRequest({ request, params, env }) {
  const [app, sub] = [].concat(params.route || []);
  const method = request.method.toUpperCase();
  if (request.headers.get('X-Sheet') !== '1') return reply({ error: 'header' }, 400);
  if (!SHEETS[app]) return reply({ error: 'app' }, 404);
  const db = kv(env);
  if (!db) return reply({ error: 'storage' }, 503);
  const me = await sessionUser(db, request);
  if (!me) return reply({ error: 'signin' }, 401);
  const [sheetApp] = SHEETS[app], key = 'config:sheet:' + sheetApp;
  const cfg = current(await getJSON(db, key), sheetApp);

  if (!sub && method === 'GET') return reply({ configured: !!cfg, ...(me.role === 'owner' ? { url: (cfg && cfg.url) || USUAL[sheetApp] || '', at: cfg ? cfg.at : null } : {}) });

  if (!sub && method === 'POST') {
    if (!cfg) return reply({ ok: false, error: 'no-sheet' }, 409);
    const body = await request.text();
    if (body.length > MAX_BODY) return reply({ ok: false, error: 'too-big' }, 413);
    const r = await post(target(cfg, me, sheetApp), body);
    return raw(r.text, r.status);
  }

  if ((sub === 'config' || sub === 'claim') && method === 'POST') {
    if (me.role !== 'owner') return reply({ error: 'owner-only' }, 403);
    let b = {}; try { b = JSON.parse(await request.text() || '{}'); } catch {}
    if (sub === 'config' && b.clear === true) { await db.delete(key); return reply({ configured: false }); }
    if (sub === 'claim' && cfg) return reply({ configured: true, kept: true });
    const url = okUrl((RETIRED.has(b.url) ? '' : b.url) || (cfg && cfg.url) || USUAL[sheetApp] || ''), secret = String(b.secret || '').trim();
    if (!url) return reply({ error: 'url' }, 400);
    if (!secret) return reply({ error: 'secret' }, 400);
    const bad = await check(url, secret, sheetApp, me);
    if (bad) return reply({ error: bad }, 400);
    await putJSON(db, key, { url, secret, at: Date.now() });
    return reply({ configured: true, url });
  }
  return reply({ error: 'not-found' }, 404);
}
