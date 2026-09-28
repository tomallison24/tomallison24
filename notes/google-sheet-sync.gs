/**
 * Allison OS Notes <-> Google Sheet sync.
 *
 * Paste this whole file into your Sheet's Apps Script editor (Extensions >
 * Apps Script), change SECRET below, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Paste the web app link and the
 * secret into Notes. Full steps: notes/README.md, "Google Sheet sync".
 *
 * What it keeps in the Sheet:
 *   _notes, _reminders, _lists, _deleted  hidden tabs the app reads back from
 *                                          (one row per item, as JSON)
 *   #recipe, #home, ... No tag            one tab per tag, newest note first
 *   ✓ Groceries, ✓ Home, ...              one tab per reminder list
 * The tag and list tabs are rebuilt on every change, so edit notes in the
 * app, not in those tabs.
 *
 * How changes merge: every note, reminder and list carries the time it was
 * last changed; the newest version wins. Deleted-for-good items are kept as
 * a short record in _deleted so the other phone deletes them too.
 */

const SECRET = 'CHANGE-ME';   // <- replace with your own long phrase, e.g. 'maple-otter-47-lantern-quiet'

const APP = 'allison-notes-sync', VERSION = 1;
const DATA = {notes: '_notes', todos: '_reminders', lists: '_lists'};
const GRAVES = '_deleted';
const KEEP_DELETED_DAYS = 180;
const CHUNK = 45000;          // a Sheet cell holds up to 50,000 characters

function doGet() {
  return out({ok: true, app: APP, v: VERSION});
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ok: false, error: 'bad-request'}); }
  if (SECRET === 'CHANGE-ME') return out({ok: false, error: 'secret-not-set'});
  if (!req || req.secret !== SECRET) return out({ok: false, error: 'wrong-secret'});
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return out({ok: false, error: 'busy'});
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const db = load(ss);
    const changed = req.action === 'sync' ? merge(db, req) : false;
    if (changed || req.action === 'rebuild') { store(ss, db); views(ss, db); }
    return out({
      ok: true, app: APP, v: VERSION, at: Date.now(),
      notes: Array.from(db.notes.values()), todos: Array.from(db.todos.values()), lists: Array.from(db.lists.values()),
      graves: Object.fromEntries(db.graves)
    });
  } finally {
    lock.releaseLock();
  }
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
  const db = {notes: new Map(), todos: new Map(), lists: new Map(), graves: new Map()};
  Object.keys(DATA).forEach(kind => {
    rows(ss, DATA[kind]).forEach(r => {
      const id = String(r[0] || ''); if (!id) return;
      try { db[kind].set(id, JSON.parse(r.slice(2).join(''))); } catch (err) { /* skip a damaged row */ }
    });
  });
  rows(ss, GRAVES).forEach(r => { const k = String(r[0] || ''); if (k) db.graves.set(k, Number(r[1]) || 0); });
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
  const g = Array.from(db.graves.entries()).map(([k, t]) => [k, t]);
  write(ss, GRAVES, [['item', 'deleted']].concat(g), true);
}

function write(ss, name, values, hidden) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  if (values.length) sh.getRange(1, 1, values.length, values[0].length).setValues(values);
  if (hidden) sh.hideSheet();
  return sh;
}

// ---------- merging what a phone sent ----------

function merge(db, req) {
  let changed = false;
  const now = Date.now();
  Object.keys(req.graves || {}).forEach(k => {
    const t = Number(req.graves[k]) || 0;
    if ((db.graves.get(k) || 0) < t) { db.graves.set(k, t); changed = true; }
  });
  Object.keys(DATA).forEach(kind => {
    (req[kind] || []).forEach(item => {
      if (!item || typeof item.id !== 'string') return;
      const u = Number(item.updated) || 0, key = kind + ':' + item.id;
      const cur = db[kind].get(item.id), gone = db.graves.get(key) || 0;
      if (gone && gone >= u) return;                       // deleted after this change
      if (!cur || u > (Number(cur.updated) || 0)) { db[kind].set(item.id, item); changed = true; }
      if (gone && u > gone) { db.graves.delete(key); changed = true; }   // brought back (Undo)
    });
  });
  db.graves.forEach((t, key) => {
    const i = key.indexOf(':'), kind = key.slice(0, i), id = key.slice(i + 1);
    const cur = db[kind] && db[kind].get(id);
    if (cur && (Number(cur.updated) || 0) <= t) { db[kind].delete(id); changed = true; }
    if (now - t > KEEP_DELETED_DAYS * 864e5) { db.graves.delete(key); changed = true; }
  });
  return changed;
}

// ---------- the readable tabs: one per tag, one per reminder list ----------

function views(ss, db) {
  const wanted = {};
  const day = t => t ? new Date(Number(t)) : '';
  const safe = s => String(s).replace(/[:\\\/?*\[\]]/g, ' ').slice(0, 90);

  const notes = Array.from(db.notes.values()).filter(n => !n.deletedAt);
  const byTab = {};
  notes.forEach(n => {
    const tags = n.tags && n.tags.length ? n.tags : [null];
    tags.forEach(t => { const name = t ? safe('#' + t) : 'No tag'; (byTab[name] = byTab[name] || []).push(n); });
  });
  Object.keys(byTab).forEach(name => {
    const list = byTab[name].sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0));
    const header = ['Title', 'Note', 'Tags', 'Created', 'Updated', 'Pinned', 'Archived'];
    const body = list.map(n => [n.title || '', String(n.body || '').slice(0, CHUNK), (n.tags || []).map(t => '#' + t).join(' '),
      day(n.created), day(n.updated), n.pinned ? 'Yes' : '', n.archived ? 'Yes' : '']);
    view(ss, name, header, body);
    wanted[name] = true;
  });

  const lists = Array.from(db.lists.values()).filter(l => !l.deletedAt);
  const todos = Array.from(db.todos.values()).filter(t => !t.deletedAt);
  const prio = ['', 'Low', 'Medium', 'High'];
  lists.forEach(l => {
    const name = safe('✓ ' + (l.name || 'List'));
    const list = todos.filter(t => t.list === l.id).sort((a, b) =>
      (a.done === b.done ? 0 : a.done ? 1 : -1) || String(a.date || '9999').localeCompare(String(b.date || '9999')) || (Number(a.created) || 0) - (Number(b.created) || 0));
    const header = ['Reminder', 'Notes', 'Due date', 'Time', 'Priority', 'Flagged', 'Done', 'Tags'];
    const body = list.map(t => [t.title || '', t.notes || '', t.date || '', t.time || '', prio[t.prio] || '', t.flagged ? 'Yes' : '', t.done ? 'Yes' : '',
      (t.tags || []).map(x => '#' + x).join(' ')]);
    view(ss, name, header, body);
    wanted[name] = true;
  });

  // Remove tabs for tags and lists that no longer exist, and the empty starter tab.
  ss.getSheets().forEach(sh => {
    const n = sh.getName();
    const ours = n.charAt(0) === '#' || n.indexOf('✓ ') === 0 || n === 'No tag';
    if (ours && !wanted[n]) ss.deleteSheet(sh);
    else if ((n === 'Sheet1' || n === 'Sheet 1') && sh.getLastRow() === 0 && Object.keys(wanted).length) ss.deleteSheet(sh);
  });
}

function view(ss, name, header, body) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (body.length) sh.getRange(2, 1, body.length, header.length).setValues(body);
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 220);
  sh.setColumnWidth(2, 420);
  if (body.length) sh.getRange(2, 2, body.length, 1).setWrap(true);
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
