/**
 * Allison OS Improve <-> Google Sheet sync. The same design as Fitness' and Travel's.
 *
 * One Sheet for the whole family: the log of everyone's feedback, bugs and ideas
 * about the aOS apps. Each item belongs to the person who added it (its by), and
 * the whole family sees every item (aOS/SHEETS.md, family mode), so anyone can
 * report a bug. Only its own person changes or deletes an item, and the owner,
 * who works through the log (marks items done). Phones don't talk to it
 * directly: every request comes through aOS (functions/sheet/api), signed in
 * with Face ID, which adds this script's SECRET and who's asking.
 *
 * Paste this whole file into your Sheet's Apps Script editor (Extensions >
 * Apps Script), change SECRET below, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone), or Manage deployments > New
 * version if it's deployed already. Then in aOS: Account > Google Sheets >
 * Improve, give it the link and the phrase. Full steps: improve/README.md.
 *
 * What it keeps in the Sheet:
 *   _items, _deleted, _people   hidden tabs the app reads back from
 *                               (one row per item, as JSON, with whose it is)
 *   Improve                     every item: open ones first, newest first, then the
 *                               done ones, last done first; with Who, Added, Kind,
 *                               App, Status, Text and Done on
 * The Improve tab is rebuilt on every change, so change items in the app, not
 * there. Nothing here is dated for the phones: each keeps every item.
 *
 * VERSION 1.
 *
 * How changes merge: every item carries the time it was last changed; the
 * newest version wins. Deleted items are kept as a short record in _deleted so
 * the other phones delete them too.
 */

const SECRET = 'CHANGE-ME';   // <- replace with your own long phrase, e.g. 'maple-otter-47-lantern-quiet'

const APP = 'allison-improve-sync', VERSION = 1;
const DATA = {items: '_items'};
const DATED = {};          // nothing dated: every phone keeps every item
const MODE = 'family';     // the whole family sees every item (there is no Just me here)
const GRAVES = '_deleted', PEOPLE = '_people';
const KEEP_DELETED_DAYS = 400;
const CHUNK = 45000;       // a Sheet cell holds up to 50,000 characters
const KINDS = {bug: 'Bug', improvement: 'Improvement', idea: 'Idea'};
// The app an item is about, by its id (home/welcome.js NAMES); one not here is written as it is.
const APP_NAMES = {general: 'General', aos: 'aOS', mail: 'Mail', calendar: 'Calendar', clock: 'Clock', news: 'News', weather: 'Weather',
  notes: 'Notes', podcasts: 'Podcasts', travel: 'Travel', places: 'Places', fitness: 'Fitness', drinks: 'Drinks', meals: 'Meals',
  orders: 'Orders', school: 'School', money: 'Money', house: 'Home', sparkle: 'Sparkle Kingdom', improve: 'Improve'};

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
function caller(e) {
  const p = (e && e.parameter) || {};
  if (SECRET === 'CHANGE-ME') return {error: 'secret-not-set'};
  if (same(p.key) !== same(SECRET)) return {error: 'wrong-secret'};
  const who = String(p.who || '');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(who)) return {error: 'who'};
  return {who: who, name: String(p.name || '').slice(0, 40), owner: p.owner === '1'};
}
// Whose an item is: its by; one without a by is the owner's.
function ownerOf(it, db) { return (it && it.by) || db.owner || ''; }
// Everyone in the family sees every item (family mode, and nothing is Just me here).
function canSee(it, c, db) { const o = ownerOf(it, db); return MODE === 'family' ? !it.only || o === c.who : o === c.who; }
// Only its own person changes or deletes an item, and the owner (who works through the log).
function canChange(it, c, db) { return c.owner || ownerOf(it, db) === c.who; }

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
    let changed = meet(db, c);
    if (req.action === 'sync') changed = merge(db, req, c) || changed;
    if (changed || req.action === 'rebuild') { store(ss, db); views(ss, db); }
    // people: the family's first names, so a phone can say whose an item is
    const res = {ok: true, app: APP, v: VERSION, aos: true, at: Date.now(), by: c.who, people: db.people};
    // a range of days asks only for dated kinds, and nothing here is dated: it answers none
    const range = req.action === 'range';
    Object.keys(DATA).forEach(kind => {
      if (range && !DATED[kind]) return;
      res[kind] = Array.from(db[kind].values()).filter(it => canSee(it, c, db));
    });
    if (!range) {
      res.graves = {};
      db.graves.forEach((g, k) => { if (MODE === 'family' || (g.by || db.owner) === c.who) res.graves[k] = g.t; });
    }
    return out(res);
  } finally {
    lock.releaseLock();
  }
}

// The people the Sheet has heard from, for the Who column; and the owner, whose are the rows with no
// by. Changed only when something is new.
function meet(db, c) {
  let changed = false;
  if (c.name && db.people[c.who] !== c.name) { db.people[c.who] = c.name; changed = true; }
  if (c.owner && db.owner !== c.who) { db.owner = c.who; changed = true; }
  // the owner's first time: rows with no by are theirs, written down as such
  if (c.owner) Object.keys(DATA).forEach(kind => db[kind].forEach(it => { if (!it.by) { it.by = c.who; changed = true; } }));
  return changed;
}
const whoName = (it, db) => db.people[ownerOf(it, db)] || '';

// An "Improve" menu in the Sheet, to rebuild the Improve tab by hand.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Improve').addItem('Rebuild Improve tab', 'rebuildTabs').addToUi();
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

// Text a cell would otherwise read as a formula (=, +, -, @) is kept as text.
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

// What a phone sent, from the person who sent it: a new item becomes theirs (by); one already here
// changes or goes only when it's theirs, or the owner sent it (anyone else's phone changes nothing of
// it, however it sends it), and it keeps its own person's by.
function merge(db, req, c) {
  let changed = false;
  const now = Date.now();
  Object.keys(req.graves || {}).forEach(k => {
    const t = Number(req.graves[k]) || 0, i = k.indexOf(':'), kind = k.slice(0, i);
    if (!db[kind]) return;
    const cur = db[kind].get(k.slice(i + 1)), g = db.graves.get(k);
    if (cur ? !canChange(cur, c, db) : g && !c.owner && (g.by || db.owner) !== c.who) return;
    if (!g || g.t < t) { db.graves.set(k, {t: t, by: cur ? ownerOf(cur, db) : (g && g.by) || c.who}); changed = true; }
  });
  Object.keys(DATA).forEach(kind => {
    (req[kind] || []).forEach(item => {
      if (!item || typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,60}$/.test(item.id)) return;
      const u = Number(item.updated) || 0, key = kind + ':' + item.id;
      const cur = db[kind].get(item.id), g = db.graves.get(key), gone = g ? g.t : 0;
      if (cur && !canChange(cur, c, db)) return;
      if (!cur && g && !c.owner && (g.by || db.owner) !== c.who) return;   // someone else's, deleted: not back from another phone
      item.by = cur ? ownerOf(cur, db) : (g && g.by) || c.who;
      delete item.only;                                    // nothing is Just me here
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

// ---------- the readable tab ----------

function views(ss, db) {
  const open = it => it.status !== 'done';
  const list = Array.from(db.items.values()).sort((a, b) => (open(a) === open(b) ? 0 : open(a) ? -1 : 1)
    || (open(a) ? (Number(b.at) || 0) - (Number(a.at) || 0) : String(b.doneOn || '').localeCompare(String(a.doneOn || '')) || (Number(b.at) || 0) - (Number(a.at) || 0)));
  const header = ['Who', 'Added', 'Kind', 'App', 'Status', 'Text', 'Done on'];
  const body = list.map(it => [whoName(it, db), String(it.added || ''), KINDS[it.kind] || 'Improvement', APP_NAMES[it.app] || String(it.app || 'General'),
    open(it) ? 'Open' : 'Done', String(it.text || ''), open(it) ? '' : String(it.doneOn || '')]);
  const sh = ss.getSheetByName('Improve') || ss.insertSheet('Improve');
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (body.length) {
    sh.getRange(2, 1, body.length, 2).setNumberFormat('@');   // the dates as written (2026-11-02), not turned into the Sheet's own
    sh.getRange(2, 7, body.length, 1).setNumberFormat('@');
    sh.getRange(2, 1, body.length, header.length).setValues(asTextRows(body));
    sh.getRange(2, 6, body.length, 1).setWrap(true);
  }
  sh.setFrozenRows(1);
  sh.setColumnWidth(6, 420);
  ss.getSheets().forEach(s => {
    const n = s.getName();
    if ((n === 'Sheet1' || n === 'Sheet 1') && s.getLastRow() === 0) ss.deleteSheet(s);
  });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
