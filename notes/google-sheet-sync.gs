/**
 * Allison OS Notes (and Places) <-> Google Sheet sync. The same design as Fitness's.
 *
 * One Sheet for the whole family, the record of everyone's notes, reminders,
 * lists and places (aOS/SHEETS.md). Everything is shared with the family,
 * except an item marked Just me (only: true), which only the person who made
 * it ever gets. Phones don't talk to it directly: every request comes through
 * aOS (functions/sheet/api), signed in with Face ID, which adds this script's
 * SECRET and who's asking. So only aOS knows the phrase, and a phone can't ask
 * for anyone's Just-me items but its own person's.
 *
 * Paste this whole file into your Sheet's Apps Script editor (Extensions >
 * Apps Script), change SECRET below, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone), or Manage deployments > New
 * version if it's deployed already. Then in aOS: Account > Google Sheets >
 * Notes, give it the phrase. Full steps: aOS/SHEETS.md.
 *
 * What it keeps in the Sheet:
 *   _notes, _reminders, _lists, _places,  hidden tabs the apps read back from
 *   _deleted, _people                      (one row per item, as JSON, with whose it is)
 *   #recipe, #home, ... No tag            one tab per tag, newest note first, with Who
 *   ✓ Groceries, ✓ Home, ...              one tab per reminder list, with Who
 *   📍 Want to go, 📍 Been                 the Places app's lists (places/), which
 *                                          shares this Sheet and its secret
 * The readable tabs are rebuilt on every change, so change things in the
 * apps, not there. They leave out Just-me items (those stay in the hidden
 * tabs, as everything does: this Sheet is the record). Each phone keeps
 * every note, list and open reminder, and the last 90 days of finished
 * reminders (by the day they were ticked off); this Sheet keeps them all.
 *
 * VERSION 2: one Sheet for the family through aOS (who, by, Just me, the Who
 * column, finished reminders older than 90 days kept here and fetched on
 * asking).
 *
 * How changes merge: every note, reminder, list and place carries the time it
 * was last changed; the newest version wins. Deleted-for-good items are kept
 * as a short record in _deleted so the other phones delete them too.
 */

const SECRET = 'CHANGE-ME';   // <- replace with your own long phrase, e.g. 'maple-otter-47-lantern-quiet'

const APP = 'allison-notes-sync', VERSION = 2;
const DATA = {notes: '_notes', todos: '_reminders', lists: '_lists', places: '_places'};   // places: the Places app (places/)
const NOTES = ['notes', 'todos', 'lists'], PLACES = ['places'];   // what each app sends and gets back
const DATED = ['todos'];   // what's kept on the phones by its day, the last 90: finished reminders only (dayOf)
const MODE = 'family';   // shared with the family, except Just-me items (Fitness, Drinks, Podcasts and Orders are 'personal')
const GRAVES = '_deleted', PEOPLE = '_people';
const KEEP_DELETED_DAYS = 400;   // long enough that a phone left unopened for a year still hears of a deletion
const CHUNK = 45000;             // a Sheet cell holds up to 50,000 characters

// The phrase as typed on a phone and as typed here can differ in ways you
// can't see: spaces at the ends, and a phone's "smart" curly quotes and long
// dashes. Those don't count.
function same(s) {
  return String(s == null ? '' : s).normalize('NFKC').trim()
    .replace(/[‘’‛′]/g, "'").replace(/[“”″]/g, '"').replace(/[‐-―−]/g, '-');
}

function doGet() {
  return out({ok: true, app: APP, v: VERSION, aos: true});
}

// ---------- who's asking (aOS) ----------
// Every request comes through aOS (functions/sheet/api), signed in: ?key= this SECRET,
// who= the person's family id, name= their first name, owner=1 for the family's owner.
// (Notes' notification server, notes/push, and Places' calendar workflow come with the key too.)
function caller(e) {
  const p = (e && e.parameter) || {};
  if (SECRET === 'CHANGE-ME') return {error: 'secret-not-set'};
  if (same(p.key) !== same(SECRET)) return {error: 'wrong-secret'};
  const who = String(p.who || '');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(who)) return {error: 'who'};
  return {who: who, name: String(p.name || '').slice(0, 40), owner: p.owner === '1'};
}
// Whose an item is: its by; one from before by was kept is the owner's.
function ownerOf(it, db) { return (it && it.by) || db.owner || ''; }
function canSee(it, c, db) { const o = ownerOf(it, db); return MODE === 'family' ? !it.only || o === c.who : o === c.who; }
// A reminder in someone else's Just-me list is theirs to see, too.
function visible(kind, it, c, db) {
  if (!canSee(it, c, db)) return false;
  const l = kind === 'todos' && it.list ? db.lists.get(String(it.list)) : null;
  return !l || canSee(l, c, db);
}
// The one dated kind: a finished reminder, by the day it was ticked off. Everything else is
// undated ('') and always on the phones.
function dayOf(kind, it) {
  if (kind !== 'todos' || !it.done) return '';
  const t = Number(it.doneAt) || Number(it.updated) || 0;
  return t > 0 ? new Date(t).toISOString().slice(0, 10) : '';
}
function cutoff(today, days) { return new Date(Date.parse(today + 'T00:00:00Z') - (days - 1) * 864e5).toISOString().slice(0, 10); }
const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ok: false, error: 'bad-request'}); }
  const c = caller(e);
  if (c.error) return out({ok: false, app: APP, aos: true, error: c.error});
  if (req && req.action === 'ping') return out({ok: true, app: APP, v: VERSION, aos: true});
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return out({ok: false, error: 'busy'});
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const db = load(ss);
    if (req.action === 'due') return out(due(db));
    // The Places app shares this Sheet: it sends and gets back only its places.
    const kinds = req.action === 'places' ? PLACES : NOTES;
    let changed = meet(db, c);
    if (req.action === 'sync' || req.action === 'places') changed = merge(db, req, c, kinds) || changed;
    if (changed || req.action === 'rebuild') { store(ss, db); views(ss, db); }
    const res = {ok: true, app: APP, v: VERSION, aos: true, at: Date.now(), by: c.who};
    // a range of days (looking back past what the phone keeps), or everything you can see: the
    // last `window` days of finished reminders, and all of the rest
    const range = req.action === 'range' && isDay(req.from) && isDay(req.to) ? req : null;
    const cut = !range && req.window && isDay(req.today) ? cutoff(req.today, Math.max(1, Number(req.window) || 90)) : '';
    kinds.forEach(kind => {
      if (range && DATED.indexOf(kind) < 0) return;
      res[kind] = Array.from(db[kind].values()).filter(it => {
        if (!visible(kind, it, c, db)) return false;
        const d = dayOf(kind, it);
        return range ? !!d && d >= range.from && d <= range.to : !d || !cut || d >= cut;
      });
    });
    if (!range) {
      res.graves = {};
      db.graves.forEach((g, k) => { if (kinds.indexOf(k.slice(0, k.indexOf(':'))) >= 0 && (MODE === 'family' || (g.by || db.owner) === c.who)) res.graves[k] = g.t; });
    }
    return out(res);
  } finally {
    lock.releaseLock();
  }
}

// The people the Sheet has heard from, for the Who column; and the owner, whose are the rows from
// before aOS kept whose each one is. Changed only when something is new.
function meet(db, c) {
  let changed = false;
  if (c.name && db.people[c.who] !== c.name) { db.people[c.who] = c.name; changed = true; }
  if (c.owner && db.owner !== c.who) { db.owner = c.who; changed = true; }
  // the owner's first time: the rows from before aOS kept whose each is are theirs, written down as such
  if (c.owner) Object.keys(DATA).forEach(kind => db[kind].forEach(it => { if (!it.by) { it.by = c.who; changed = true; } }));
  return changed;
}
const whoName = (it, db) => db.people[ownerOf(it, db)] || '';

// For the notification server (notes/push): only what it needs to alert.
// Open reminders with a date, and nudges on notes; titles, never note text.
// A Just-me one says whose it is (who), so it alerts only that person's phones.
// Changes nothing.
function due(db) {
  const only = (it, l) => it.only ? ownerOf(it, db) : l && l.only ? ownerOf(l, db) : '';
  const who = (it, l) => { const w = only(it, l); return w ? {who: w} : {}; };
  const todos = Array.from(db.todos.values()).filter(t => t.date && !t.done && !t.deletedAt)
    .filter(t => { const l = db.lists.get(String(t.list || '')); return !(t.only && l && l.only && ownerOf(t, db) !== ownerOf(l, db)); })   // nobody's to see
    .map(t => Object.assign({id: t.id, title: t.title, list: t.list, date: t.date, time: t.time || null, alert: t.alert == null ? null : t.alert}, who(t, db.lists.get(String(t.list || '')))));
  const notes = Array.from(db.notes.values()).filter(n => n.reminder && !n.deletedAt && !n.archived)
    .map(n => Object.assign({id: n.id, title: n.title || String(n.body || '').split('\n')[0].slice(0, 120), reminder: n.reminder}, who(n)));
  const lists = Array.from(db.lists.values()).map(l => ({id: l.id, name: l.name}));
  return {ok: true, app: APP, v: VERSION, aos: true, at: Date.now(), todos: todos, notes: notes, lists: lists};
}

// A "Notes" menu in the Sheet, to rebuild the tag and list tabs by hand.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Notes').addItem('Rebuild tag and list tabs', 'rebuildTabs').addToUi();
}
function rebuildTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  views(ss, load(ss));
}

// ---------- reading and writing the hidden data tabs ----------

function load(ss) {
  const db = {graves: new Map(), people: {}, owner: ''};
  Object.keys(DATA).forEach(kind => { db[kind] = new Map(); });
  Object.keys(DATA).forEach(kind => {
    rows(ss, DATA[kind]).forEach(r => {
      const id = String(r[0] || ''); if (!id) return;
      try { db[kind].set(id, JSON.parse(r.slice(2).join(''))); } catch (err) { /* skip a damaged row */ }
    });
  });
  rows(ss, GRAVES).forEach(r => { const k = String(r[0] || ''); if (k) db.graves.set(k, {t: Number(r[1]) || 0, by: String(r[2] || '')}); });
  rows(ss, PEOPLE).forEach(r => { const id = String(r[0] || ''); if (id === '(owner)') db.owner = String(r[1] || ''); else if (id) db.people[id] = String(r[1] || ''); });
  return db;
}

function rows(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1);
}

function store(ss, db) {
  Object.keys(DATA).forEach(kind => {
    const list = Array.from(db[kind].values()).map(it => {
      const json = JSON.stringify(it), parts = [];
      for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
      return [it.id, Number(it.updated) || 0].concat(parts);
    });
    const width = Math.max(3, ...list.map(r => r.length));
    const header = ['id', 'updated', 'data'].concat(Array(width - 3).fill('data (continued)'));
    write(ss, DATA[kind], [header].concat(list.map(r => r.concat(Array(width - r.length).fill('')))), true);
  });
  const g = Array.from(db.graves.entries()).map(([k, x]) => [k, x.t, x.by || '']);
  write(ss, GRAVES, [['item', 'deleted', 'by']].concat(g), true);
  const p = Object.keys(db.people).map(id => [id, db.people[id]]);
  write(ss, PEOPLE, [['id', 'name'], ['(owner)', db.owner]].concat(p), true);
}

// Text that starts with = + - or @ would become a formula (a note titled
// =IMPORTXML(...), or a piece of a long note that happens to start with =).
// A leading apostrophe makes Sheets keep it as text; the apostrophe is not
// part of the value, so getValues() reads back exactly what was written.
function asText(v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; }
const asTextRows = rows => rows.map(r => r.map(asText));

function write(ss, name, values, hidden) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  if (values.length) sh.getRange(1, 1, values.length, values[0].length).setValues(asTextRows(values));
  if (hidden) sh.hideSheet();
  return sh;
}

// ---------- merging what a phone sent ----------

// What a phone sent, from the person who sent it: shared items and their own Just-me ones (someone
// else's Just-me item, even with the same id, is never changed from another's phone, nor deleted),
// each kept as whoever's it was (by). Only an item's own person makes it Just me, or not.
function merge(db, req, c, kinds) {
  let changed = false;
  const now = Date.now(), ours = k => kinds.indexOf(k) >= 0;
  Object.keys(req.graves || {}).forEach(k => {
    const t = Number(req.graves[k]) || 0, i = k.indexOf(':'), kind = k.slice(0, i);
    if (!ours(kind)) return;                             // Places can't delete a note, nor Notes a place
    const cur = db[kind].get(k.slice(i + 1));
    if (cur && !visible(kind, cur, c, db)) return;
    const g = db.graves.get(k);
    if (!g || g.t < t) { db.graves.set(k, {t: t, by: cur ? ownerOf(cur, db) : (g && g.by) || c.who}); changed = true; }
  });
  kinds.forEach(kind => {
    (req[kind] || []).forEach(item => {
      if (!item || typeof item.id !== 'string') return;
      const u = Number(item.updated) || 0, key = kind + ':' + item.id;
      const cur = db[kind].get(item.id), g = db.graves.get(key), gone = g ? g.t : 0;
      if (cur && !visible(kind, cur, c, db)) return;
      item.by = cur ? ownerOf(cur, db) : c.who;
      if (MODE === 'family' && item.by !== c.who) item.only = !!(cur && cur.only);   // only its own person makes it Just me
      if (!item.only) delete item.only;
      if (gone && gone >= u) return;                       // deleted after this change
      if (!cur || u > (Number(cur.updated) || 0)) { db[kind].set(item.id, item); changed = true; }
      if (gone && u > gone) { db.graves.delete(key); changed = true; }   // brought back (Undo)
    });
  });
  db.graves.forEach((g, key) => {
    const i = key.indexOf(':'), kind = key.slice(0, i), id = key.slice(i + 1);
    const cur = db[kind] && db[kind].get(id);
    if (cur && (Number(cur.updated) || 0) <= g.t) { db[kind].delete(id); changed = true; }
    if (now - g.t > KEEP_DELETED_DAYS * 864e5) { db.graves.delete(key); changed = true; }
  });
  return changed;
}

// ---------- the readable tabs: one per tag, one per reminder list, and the places ----------
// Shared items only: a Just-me item (or a reminder in a Just-me list) isn't drawn here.

function views(ss, db) {
  const wanted = {};
  const day = t => t ? new Date(Number(t)) : '';
  const safe = s => String(s).replace(/[:\\\/?*\[\]]/g, ' ').slice(0, 90);
  const shared = it => it && !it.only;

  const notes = Array.from(db.notes.values()).filter(n => shared(n) && !n.deletedAt);
  const byTab = {};
  notes.forEach(n => {
    const tags = n.tags && n.tags.length ? n.tags : [null];
    tags.forEach(t => { const name = t ? safe('#' + t) : 'No tag'; (byTab[name] = byTab[name] || []).push(n); });
  });
  Object.keys(byTab).forEach(name => {
    const list = byTab[name].sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0));
    const header = ['Who', 'Title', 'Note', 'Tags', 'Created', 'Updated', 'Pinned', 'Archived'];
    const body = list.map(n => [whoName(n, db), n.title || '', String(n.body || '').slice(0, CHUNK), (n.tags || []).map(t => '#' + t).join(' '),
      day(n.created), day(n.updated), n.pinned ? 'Yes' : '', n.archived ? 'Yes' : '']);
    view(ss, name, header, body);
    wanted[name] = true;
  });

  const lists = Array.from(db.lists.values()).filter(l => shared(l) && !l.deletedAt);
  const todos = Array.from(db.todos.values()).filter(t => shared(t) && !t.deletedAt);
  const prio = ['', 'Low', 'Medium', 'High'];
  lists.forEach(l => {
    const name = safe('✓ ' + (l.name || 'List'));
    const list = todos.filter(t => t.list === l.id).sort((a, b) =>
      (a.done === b.done ? 0 : a.done ? 1 : -1) || String(a.date || '9999').localeCompare(String(b.date || '9999')) || (Number(a.created) || 0) - (Number(b.created) || 0));
    const header = ['Who', 'Reminder', 'Notes', 'Due date', 'Time', 'Priority', 'Flagged', 'Done', 'Tags'];
    const body = list.map(t => [whoName(t, db), t.title || '', t.notes || '', t.date || '', t.time || '', prio[t.prio] || '', t.flagged ? 'Yes' : '', t.done ? 'Yes' : '',
      (t.tags || []).map(x => '#' + x).join(' ')]);
    view(ss, name, header, body);
    wanted[name] = true;
  });

  // Places: one tab for where you want to go, one for where you've been.
  const places = Array.from(db.places.values()).filter(shared);
  const money = p => p ? '$$$$'.slice(0, p) : '';
  [['📍 Want to go', 'want'], ['📍 Been', 'been']].forEach(([name, status]) => {
    const list = places.filter(p => (p.status || 'want') === status)
      .sort((a, b) => status === 'been' ? String(b.visited || '').localeCompare(String(a.visited || '')) : String(a.planned || '9999').localeCompare(String(b.planned || '9999')));
    if (!list.length) return;
    const header = ['Who', 'Place', 'Type', 'Address', status === 'been' ? 'Went on' : 'Planned for', 'Rating', 'Price', 'Tags', 'Notes', 'Map'];
    view(ss, name, header, list.map(p => [whoName(p, db), p.name || '', p.category || '', p.address || '', (status === 'been' ? p.visited : p.planned) || '',
      p.rating ? '★★★★★'.slice(0, p.rating) : '', money(p.price), (p.tags || []).map(t => '#' + t).join(' '), p.notes || '',
      p.lat != null ? 'https://maps.apple.com/?ll=' + p.lat + ',' + p.lon + '&q=' + encodeURIComponent(p.name || 'Place') : '']));
    wanted[name] = true;
  });

  // Remove tabs for tags, lists and places that no longer exist, and the empty starter tab.
  ss.getSheets().forEach(sh => {
    const n = sh.getName();
    const ours = n.charAt(0) === '#' || n.indexOf('✓ ') === 0 || n === 'No tag' || n.indexOf('📍 ') === 0;
    if (ours && !wanted[n]) ss.deleteSheet(sh);
    else if ((n === 'Sheet1' || n === 'Sheet 1') && sh.getLastRow() === 0 && Object.keys(wanted).length) ss.deleteSheet(sh);
  });
}

function view(ss, name, header, body) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (body.length) sh.getRange(2, 1, body.length, header.length).setValues(asTextRows(body));
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 90);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 420);
  if (body.length) sh.getRange(2, 3, body.length, 1).setWrap(true);
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
