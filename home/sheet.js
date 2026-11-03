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
//
// Notes' Sheet, for the other apps (Meals' shopping list, Orders' return, Calendar's tick): small writes
// into the family's reminders, through Notes' own sync protocol (notes/google-sheet-sync.gs), so what
// they write is what a phone's Notes would have sent: Notes merges it on its next open (newest change
// wins), and the same id sent again changes nothing. Signed in only, and never a throw: each resolves
// { ok: true, ... } or { ok: false, why } with why 'signin' (not signed in), 'no-sheet' (the owner hasn't
// set the Notes Sheet up in aOS), 'offline', 'not-found' (setDone: no such reminder), or the script's
// own error ('sheet-unreachable', 'busy', 'not-json', 'old-script', 'wrong-app'...).
//   AllisonOS.sheet.notes.addTodos({ list, items: [{ title, date?, time?, notes?, key? }], reopen? })
//                       Adds reminders to the list named (made if there is none: Notes' own sample ids
//                       for Personal, Home, Groceries and Family, so a phone still showing the samples
//                       merges them as one). An item's id comes from its key (else list + title), so
//                       the same item sent twice is one reminder: one already there is left alone, and
//                       counted in already; with reopen: true a finished one is unticked instead
//                       (a grocery bought last week, on the list again).
//                       -> { ok: true, added, already, reopened, ids, list: { id, name } }
//   AllisonOS.sheet.notes.setDone(id, done)   ticks a reminder off (or back on) -> { ok: true, already? }
//   AllisonOS.sheet.notes.build               the request builders (pure; notes/scripts/sheet-test.mjs)
//
// Improve's Sheet, for Ipsy in any app (home/ipsy.js: log_improvement, list_improvements, update_improvement): a bug,
// an improvement or an idea, written in Improve's own sync protocol (improve/google-sheet-sync.gs) through
// /sheet/api/improve, so it is what the Improve app would have sent. Signed out, offline, or before the owner has set
// Improve's Sheet up, an item waits in aOS's outbox on this phone (localStorage 'aos.improve.outbox', shared
// code's own key: home/, not the Improve app's storage), sent with the next write that works here, and taken in by
// the Improve app when it next opens. Never a throw: each resolves { ok, ... } or { ok: false, why }.
//   AllisonOS.sheet.improve.add({ text, kind?, app? })   -> { ok: true, item, saved: 'sheet' | 'phone', why? }
//   AllisonOS.sheet.improve.list({ status? })            -> { ok: true, items, from: 'sheet' | 'phone', why? }
//   AllisonOS.sheet.improve.update(id, { text?, kind?, app?, done? }) -> { ok: true, item, before, saved }
//   AllisonOS.sheet.improve.remove(id)                    an item just added, taken back (Ipsy's Undo)
//   AllisonOS.sheet.improve.build                         the request builders (pure; improve/scripts/sheet-test.mjs)
// Needs ../home/account.js loaded first (in a page; the builders run in Node too).
(() => {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const A = root.AllisonOS = root.AllisonOS || {};
  if (A.sheet) return;
  const me = typeof document !== 'undefined' ? document.currentScript : null;
  const API = typeof location !== 'undefined' ? new URL('../sheet/api/', (me && me.src) || location.href).href : '';
  const acct = () => A.account;
  const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
  async function call(path, body, ask) {
    const go = () => {
      const t = acct() && acct().token(), h = { 'X-Sheet': '1', 'Content-Type': 'text/plain;charset=utf-8' };
      if (t) h.Authorization = 'Bearer ' + t;
      return fetch(API + path, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)), cache: 'no-store' });
    };
    if (offline()) throw new Error('offline');
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

  // ---- Notes' Sheet: reminders from the other apps ----
  // The requests are built as Notes' own sync sends them (notes/app.js, "The family's Google Sheet"):
  // { action: 'sync', v: 2, window, today, notes, todos, lists, graves }. The script merges what is sent
  // and answers with everything this person may see; nothing sent is ever deleted (only a grave does
  // that), so a request carrying only the new reminders is safe. One with nothing in it reads.
  const NOTES_APP = 'allison-notes-sync', NOTES_V = 2;
  // Notes' sample lists (notes/app.js SAMPLE_LISTS): the same ids, so a phone that still shows them merges
  // ours as the same list rather than a second Groceries.
  const SAMPLE_LISTS = { personal: ['l1', '#3B82F6'], home: ['l2', '#F59E0B'], groceries: ['l3', '#10B981'], family: ['l4', '#8B5CF6'] };
  const LIST_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#EF4444'];
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  // an id from a key, the same every time (FNV-1a of the key and of the key reversed: 10-13 characters)
  const idFor = (pfx, key) => pfx + hash(key) + hash(key.split('').reverse().join('') + '\n' + key.length);
  const str = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
  const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const isTime = s => /^\d{2}:\d{2}$/.test(String(s || ''));
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const sync = (today, body) => Object.assign({ action: 'sync', v: NOTES_V, window: A.sheet.WINDOW, today, notes: [], todos: [], lists: [], graves: {} }, body || {});
  const lower = s => str(s, 200).toLowerCase();
  const build = {
    // the request that only reads (what a phone with nothing on it sends)
    read: today => sync(today),
    // the list named, in what the Sheet answered: by name (a shared one first), else by Notes' sample id
    // for that name, else a new one (with the sample's id and colour when the name is one of them)
    list(state, name, now) {
      const want = lower(name) || 'personal', lists = (state && state.lists) || [];
      const byName = lists.filter(l => l && typeof l.id === 'string' && lower(l.name) === want);
      const have = byName.find(l => !l.only) || byName[0] || (SAMPLE_LISTS[want] && lists.find(l => l && l.id === SAMPLE_LISTS[want][0]));
      if (have) return { list: have, made: false };
      const s = SAMPLE_LISTS[want];
      return { list: { id: s ? s[0] : idFor('l', want), updated: now, name: str(name, 60) || 'Personal', color: s ? s[1] : LIST_COLORS[hash(want).charCodeAt(0) % LIST_COLORS.length] }, made: true };
    },
    // the reminders to send for items, against what the Sheet has: new ones as Notes makes them, a finished
    // one unticked again when reopen; null when there is nothing to send
    add(state, { list, items, reopen } = {}, now, today) {
      const L = build.list(state, list, now), have = new Map(((state && state.todos) || []).filter(t => t && typeof t.id === 'string').map(t => [t.id, t]));
      const todos = [], ids = [];
      let added = 0, already = 0, reopened = 0;
      for (const it of Array.isArray(items) ? items : []) {
        const title = str(it && it.title, 200); if (!title) continue;
        const id = idFor('t', it.key != null && it.key !== '' ? 'key:' + String(it.key) : L.list.id + '\n' + title.toLowerCase());
        if (ids.includes(id)) continue;
        ids.push(id);
        const date = isDay(it.date) ? it.date : null, time = date && isTime(it.time) ? it.time : null, notes = String(it.notes == null ? '' : it.notes).slice(0, 2000);
        const cur = have.get(id);
        if (cur && !(reopen && cur.done)) { already++; continue; }
        if (cur) { reopened++; todos.push(Object.assign({}, cur, { title, notes, date, time, done: false, doneAt: null, updated: now })); continue; }
        added++;
        todos.push({ id, list: L.list.id, title, notes, date, time, prio: 0, flagged: false, done: false, doneAt: null, tags: [], created: now, updated: now });
      }
      const body = todos.length ? sync(today, { todos, lists: L.made ? [L.list] : [] }) : null;
      return { body, ids, added, already, reopened, list: { id: L.list.id, name: L.list.name } };
    },
    // a reminder ticked off (or back on), as the phone sends it: the whole item, newer
    done(state, id, done, now, today) {
      const cur = ((state && state.todos) || []).find(t => t && t.id === id);
      if (!cur) return { body: null, why: 'not-found' };
      if (!!cur.done === !!done) return { body: null, already: true };
      return { body: sync(today, { todos: [Object.assign({}, cur, { done: !!done, doneAt: done ? now : null, updated: now })] }) };
    },
  };
  const fail = e => ({ ok: false, why: (e && e.message) || 'error' });
  async function notesSync(body) {
    if (!(acct() && acct().token())) throw new Error('signin');
    const res = await call('notes', body, false);
    if (res.app && res.app !== NOTES_APP) throw new Error('wrong-app');
    if (!res.aos) throw new Error('old-script');
    if (!Array.isArray(res.todos) || !Array.isArray(res.lists)) throw new Error('not-json');
    return res;
  }
  A.sheet.notes = {
    build,
    async addTodos(o) {
      try {
        const today = ymd(new Date()), state = await notesSync(build.read(today));
        const r = build.add(state, o || {}, Date.now(), today);
        if (r.body) await notesSync(r.body);
        return { ok: true, added: r.added, already: r.already, reopened: r.reopened, ids: r.ids, list: r.list };
      } catch (e) { return fail(e); }
    },
    async setDone(id, done) {
      try {
        const today = ymd(new Date()), state = await notesSync(build.read(today));
        const r = build.done(state, String(id || ''), done !== false, Date.now(), today);
        if (r.why) return { ok: false, why: r.why };
        if (r.body) await notesSync(r.body);
        return { ok: true, already: !!r.already };
      } catch (e) { return fail(e); }
    },
  };

  // ---- Improve's Sheet: bugs, improvements and ideas, from Ipsy in any app ----
  const IMPROVE_APP = 'allison-improve-sync', IMPROVE_V = 1, OUTBOX = 'aos.improve.outbox';
  const KINDS = ['bug', 'improvement', 'idea'];
  const ib = {
    // an item as the Improve app makes one (improve/app.js): its words, kind, the app it's about, open
    item(o, now, today) {
      const text = String((o && o.text) || '').replace(/\s+/g, ' ').trim().slice(0, 4000);
      if (!text) return null;
      const kind = KINDS.includes(o.kind) ? o.kind : 'improvement';
      const app = typeof o.app === 'string' && /^[a-z]{2,20}$/.test(o.app) ? o.app : 'general';
      return { id: now.toString(36) + Math.random().toString(36).slice(2, 8), text, kind, app, status: 'open', added: today, at: now, doneOn: '', updated: now };
    },
    // the sync request: what is sent is added or changed, nothing else (the script keeps the rest)
    sync: (today, items, graves) => ({ action: 'sync', v: IMPROVE_V, window: A.sheet.WINDOW, today, items: items || [], graves: graves || {} }),
    // a change to an item: its words, kind, app, or done (and when)
    change(cur, c, now, today) {
      const it = Object.assign({}, cur);
      if (typeof c.text === 'string' && c.text.trim()) it.text = c.text.replace(/\s+/g, ' ').trim().slice(0, 4000);
      if (KINDS.includes(c.kind)) it.kind = c.kind;
      if (typeof c.app === 'string' && /^[a-z]{2,20}$/.test(c.app)) it.app = c.app;
      if (typeof c.done === 'boolean') { it.status = c.done ? 'done' : 'open'; it.doneOn = c.done ? (cur.status === 'done' && cur.doneOn) || today : ''; }
      it.updated = now;
      return it;
    },
  };
  const store = typeof localStorage !== 'undefined' ? localStorage : null;
  const outbox = {
    get() { try { const v = JSON.parse(store.getItem(OUTBOX) || '[]'); return Array.isArray(v) ? v.filter(x => x && typeof x.id === 'string' && typeof x.text === 'string') : []; } catch { return []; } },
    set(list) { try { if (list.length) store.setItem(OUTBOX, JSON.stringify(list.slice(-200))); else store.removeItem(OUTBOX); } catch {} },
  };
  async function improveSync(items, graves) {
    if (!(acct() && acct().token())) throw new Error('signin');
    const waiting = outbox.get(), send = [...waiting.filter(w => !items.some(x => x.id === w.id)), ...items];
    const res = await call('improve', ib.sync(ymd(new Date()), send, graves), false);
    if (res.app && res.app !== IMPROVE_APP) throw new Error('wrong-app');
    if (!res.aos) throw new Error('old-script');
    if (!Array.isArray(res.items)) throw new Error('not-json');
    outbox.set(outbox.get().filter(w => !send.some(x => x.id === w.id)));   // they're in the Sheet now
    return res;
  }
  const latest = list => { const m = new Map(); for (const x of list) { const c = m.get(x.id); if (!c || (+x.updated || 0) >= (+c.updated || 0)) m.set(x.id, x); } return [...m.values()]; };
  A.sheet.improve = {
    build: ib, OUTBOX,
    async add(o) {
      const it = ib.item(o || {}, Date.now(), ymd(new Date()));
      if (!it) return { ok: false, why: 'empty' };
      try { await improveSync([it]); return { ok: true, item: it, saved: 'sheet' }; }
      catch (e) { outbox.set([...outbox.get(), it]); return { ok: true, item: it, saved: 'phone', why: e.message }; }
    },
    async list(o = {}) {
      let items, from = 'sheet', why;
      try { items = latest([...(await improveSync([])).items, ...outbox.get()]); }
      catch (e) { items = outbox.get(); from = 'phone'; why = e.message; }
      const st = o.status === 'done' || o.status === 'all' ? o.status : 'open';
      items = items.filter(x => st === 'all' || (st === 'done') === (x.status === 'done')).sort((a, b) => (+b.at || 0) - (+a.at || 0));
      return { ok: true, items, from, ...(why ? { why } : {}) };
    },
    async update(id, c) {
      const all = await A.sheet.improve.list({ status: 'all' }), cur = all.items.find(x => x.id === id);
      if (!cur) return { ok: false, why: 'not-found' };
      const it = ib.change(cur, c || {}, Date.now(), ymd(new Date()));
      if (all.from === 'sheet') { try { await improveSync([it]); return { ok: true, item: it, before: cur, saved: 'sheet' }; } catch (e) { return fail(e); } }
      outbox.set(outbox.get().map(x => x.id === id ? it : x));
      return { ok: true, item: it, before: cur, saved: 'phone' };
    },
    async remove(id) {
      const was = outbox.get();
      if (was.some(x => x.id === id)) { outbox.set(was.filter(x => x.id !== id)); return { ok: true }; }
      try { await improveSync([], { ['items:' + id]: Date.now() }); return { ok: true }; } catch (e) { return fail(e); }
    },
  };
})();
