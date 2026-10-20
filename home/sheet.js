// The family's Google Sheets, from the apps' side (aOS/SHEETS.md). Each app's
// Sheet is the record: one Sheet an app for the whole family, each row marked
// with who it belongs to. The phone keeps a working copy (the last 90 days of
// anything dated), syncs it with the Sheet, and asks the Sheet for older days
// when you look back.
//
// The phone holds no Sheet link or secret phrase: every sync goes through aOS
// (functions/sheet/api), signed in, which passes it on to the app's script
// with who's asking. So syncing needs this app's own family sign-in (Face ID,
// once); without one the app works on this phone alone until you sign in.
//
//   AllisonOS.sheet.sync(app, body, { ask })   POST the app's sync request; the script's answer.
//                                              Throws Error(code): 'signin' (not signed in; ask: true
//                                              shows Face ID once and tries again), 'no-sheet' (the
//                                              owner hasn't set this Sheet up in aOS yet),
//                                              'sheet-unreachable', 'offline', or the script's own error
//   AllisonOS.sheet.status(app)                { configured, url? (the owner) } or null (offline, signed out)
//   AllisonOS.sheet.adopt(app, { url, secret }) the owner's phone: hand a link and phrase it still keeps to
//                                              aOS, once (only while aOS has none). True when aOS has one
//                                              now, so the phone can forget its own.
//   AllisonOS.sheet.WINDOW                     90: days of dated items kept on the phone
// Needs ../home/account.js loaded first.
(() => {
  'use strict';
  const A = window.AllisonOS = window.AllisonOS || {};
  if (A.sheet) return;
  const me = document.currentScript;
  const API = new URL('../sheet/api/', (me && me.src) || location.href).href;
  const acct = () => A.account;
  async function call(path, body, ask) {
    const go = () => {
      const t = acct() && acct().token(), h = { 'X-Sheet': '1', 'Content-Type': 'text/plain;charset=utf-8' };
      if (t) h.Authorization = 'Bearer ' + t;
      return fetch(API + path, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)), cache: 'no-store' });
    };
    if (!navigator.onLine) throw new Error('offline');
    if (!(acct() && acct().token())) {
      if (!ask || !acct() || !(await acct().prompt('Sign in to sync with the family’s Google Sheet.'))) throw new Error('signin');
    }
    let r; try { r = await go(); } catch { throw new Error('offline'); }
    if (r.status === 401 && ask && acct() && await acct().prompt('Sign in to sync with the family’s Google Sheet.')) { try { r = await go(); } catch { throw new Error('offline'); } }
    let j = null; try { j = await r.json(); } catch {}
    if (r.status === 401) throw new Error('signin');
    if (!j) throw new Error('not-json');
    if (!r.ok || j.ok === false) throw Object.assign(new Error(j.error || 'http-' + r.status), { data: j });
    return j;
  }
  A.sheet = {
    WINDOW: 90,
    sync: (app, body, o = {}) => call(app, body, !!o.ask),
    status: app => call(app).catch(() => null),
    async adopt(app, cfg) {
      const u = acct() && acct().user();
      if (!cfg || !cfg.secret) return false;
      if (!u || u.role !== 'owner') { const s = await A.sheet.status(app); return !!(s && s.configured); }
      try { const r = await call(app + '/claim', { url: cfg.url, secret: cfg.secret }); return !!r.configured; } catch { return false; }
    },
  };
})();
