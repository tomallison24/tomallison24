/**
 * Allison OS Drinks <-> Google Sheet sync. The same design as Fitness's, with a Log tab you can
 * edit as well as read.
 *
 * Paste this whole file into your Sheet's Apps Script editor (Extensions >
 * Apps Script), change SECRET below, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Paste the web app link and the
 * secret into Drinks. Full steps: drinks/README.md, "Google Sheet sync".
 *
 * What it keeps in the Sheet:
 *   _entries, _days, _prefs, _deleted, _rows   hidden tabs the app reads back from
 *                                               (one row per item, as JSON)
 *   Log                                         every drink and alcohol-free day, newest first:
 *     Timestamp, Date, Time, Name, Category, Volume, Unit, ABV, Qty, StandardDrinks,
 *     GramsAlcohol, Note, EntryID   (and Check, only when a row you typed needs fixing)
 *
 * The Log tab goes both ways. Almost every drink comes from the app, but you can also:
 *   - change a row: the app takes the change, as long as it is newer than the app's own;
 *   - add a row: fill in Date, Name, Category, Volume, Unit, ABV (Qty is 1 if left empty);
 *     the Timestamp, EntryID, StandardDrinks and GramsAlcohol fill themselves in;
 *   - remove a drink: set its Qty to 0 (deleting a row does not remove it: the app puts it back).
 * An alcohol-free day is a row whose Category is "alcohol-free" (Qty 0 removes it).
 * A row that can't be read (no date, no size...) is left where it is with a note in the Check
 * column, and is not sent to the app until it is fixed.
 *
 * How changes merge: every drink carries the time it was last changed; the newest version wins,
 * from the app, another phone or the Sheet. Deleted items are kept as a short record in
 * _deleted so the other phone deletes them too.
 */

const SECRET = 'CHANGE-ME';   // <- replace with your own long phrase, e.g. 'maple-otter-47-lantern-quiet'

const APP = 'allison-drinks-sync', VERSION = 1;
const DATA = {entries: '_entries', days: '_days', prefs: '_prefs'};
const GRAVES = '_deleted', ROWS = '_rows', LOG = 'Log';
const KEEP_DELETED_DAYS = 400;   // long enough that a phone left unopened for a year still hears of a deletion
const CHUNK = 45000;             // a Sheet cell holds up to 50,000 characters
const OZ_ML = 29.5735, ETHANOL = 0.789, STD_G = 14;   // as in Drinks: a standard drink is 14 g of alcohol
const HEADER = ['Timestamp', 'Date', 'Time', 'Name', 'Category', 'Volume', 'Unit', 'ABV', 'Qty', 'StandardDrinks', 'GramsAlcohol', 'Note', 'EntryID', 'Check'];
const CATS = {beer: 'Beer', wine: 'Wine', spirits: 'Spirits', cocktail: 'Cocktail', seltzer: 'Seltzer', cider: 'Cider', other: 'Other'};
const AF = 'alcohol-free';

// The phrase as typed on a phone and as typed here can differ in ways you
// can't see: spaces at the ends, and a phone's "smart" curly quotes and long
// dashes. Those don't count.
function same(s) {
  return String(s == null ? '' : s).normalize('NFKC').trim()
    .replace(/[‘’‛′]/g, "'").replace(/[“”″]/g, '"').replace(/[‐-―−]/g, '-');
}

function doGet() {
  return out({ok: true, app: APP, v: VERSION});
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ok: false, error: 'bad-request'}); }
  if (SECRET === 'CHANGE-ME') return out({ok: false, error: 'secret-not-set'});
  if (!req || same(req.secret) !== same(SECRET)) return out({ok: false, app: APP, error: 'wrong-secret'});
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return out({ok: false, error: 'busy'});
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const db = load(ss);
    let changed = false, kept = [];
    if (req.action === 'sync' || req.action === 'rebuild') {
      const r = ingest(ss, db);          // what was typed into the Log tab since the last sync
      kept = r.kept; changed = r.changed;
    }
    if (req.action === 'sync' && merge(db, req)) changed = true;
    if (changed || req.action === 'rebuild') { store(ss, db); views(ss, db, kept); }
    return out({
      ok: true, app: APP, v: VERSION, at: Date.now(),
      entries: Array.from(db.entries.values()), days: Array.from(db.days.values()), prefs: Array.from(db.prefs.values()),
      graves: Object.fromEntries(db.graves)
    });
  } finally {
    lock.releaseLock();
  }
}

// A "Drinks" menu in the Sheet, to rebuild the Log tab by hand.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Drinks').addItem('Rebuild Log tab', 'rebuildTabs').addToUi();
}
function rebuildTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const db = load(ss), r = ingest(ss, db);
  if (r.changed) store(ss, db);
  views(ss, db, r.kept);
}

// A change typed into the Log tab: stamp the row with the time, give a new row its EntryID and work out
// StandardDrinks and GramsAlcohol. (A simple trigger: it runs by itself, on your edits only.)
function onEdit(e) {
  try {
    const sh = e.range.getSheet();
    if (sh.getName() !== LOG || e.range.getRow() < 2) return;
    const head = sh.getRange(1, 1, 1, HEADER.length).getValues()[0], col = {};
    head.forEach((h, i) => { col[String(h).trim().toLowerCase()] = i + 1; });
    if (!col.timestamp || !col.entryid) return;
    for (let r = e.range.getRow(); r < e.range.getRow() + e.range.getNumRows(); r++) {
      const row = sh.getRange(r, 1, 1, head.length).getValues()[0];
      if (!row.some((v, i) => i + 1 !== col.timestamp && i + 1 !== col.entryid && String(v).trim() !== '')) continue;
      if (String(row[col.entryid - 1]).trim() === '') sh.getRange(r, col.entryid).setValue('sh' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      sh.getRange(r, col.timestamp).setValue(new Date().toISOString());
      const g = grams({vol: num(row[col.volume - 1]), unit: String(row[col.unit - 1]).toLowerCase() === 'ml' ? 'ml' : 'oz', abv: num(row[col.abv - 1]), qty: String(row[col.qty - 1]).trim() === '' ? 1 : num(row[col.qty - 1])});
      if (col.standarddrinks) sh.getRange(r, col.standarddrinks).setValue(round(g / STD_G, 2));
      if (col.gramsalcohol) sh.getRange(r, col.gramsalcohol).setValue(round(g, 1));
    }
  } catch (err) { /* a failed stamp must never stop an edit */ }
}

// ---------- reading and writing the hidden data tabs ----------

function load(ss) {
  const db = {entries: new Map(), days: new Map(), prefs: new Map(), graves: new Map(), rows: new Map()};
  Object.keys(DATA).forEach(kind => {
    rows(ss, DATA[kind]).forEach(r => {
      const id = String(r[0] || ''); if (!id) return;
      try { db[kind].set(id, JSON.parse(r.slice(2).join(''))); } catch (err) { /* skip a damaged row */ }
    });
  });
  rows(ss, GRAVES).forEach(r => { const k = String(r[0] || ''); if (k) db.graves.set(k, Number(r[1]) || 0); });
  rows(ss, ROWS).forEach(r => { const k = String(r[0] || ''); if (k) db.rows.set(k, String(r[1] || '')); });   // id -> what its Log row said when it was last written
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

// ---------- the Log tab: what is typed into it comes back ----------

const num = v => { if (typeof v === 'number') return isFinite(v) ? v : 0; const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
const round = (n, d) => { const p = Math.pow(10, d); return Math.round(n * p) / p; };
const grams = x => (x.unit === 'ml' ? num(x.vol) : num(x.vol) * OZ_ML) * Math.max(0, num(x.qty)) * num(x.abv) / 100 * ETHANOL;
const catId = name => { const n = String(name || '').trim().toLowerCase(); return Object.keys(CATS).find(k => k === n || CATS[k].toLowerCase() === n) || 'other'; };
// The Log tab shows a name of up to 60 characters and a note of up to 200 (as the app takes), so a longer one isn't mistaken for an edit.
const rowSig = e => JSON.stringify([e.date, e.time || '', String(e.name || '').slice(0, 60), e.cat, num(e.vol), e.unit, num(e.abv), num(e.qty), String(e.note || '').slice(0, 200)]);

// A date as the Sheet may hold it: text (2026-10-12, 10/12/2026) or a real date.
function dateOf(v, tz) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, tz || 'UTC', 'yyyy-MM-dd');
  const s = String(v == null ? '' : v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (!m) { const u = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); if (u) m = [0, u[3], u[1], u[2]]; }
  if (!m) return '';
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
function timeOf(v, tz) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, tz || 'UTC', 'HH:mm');
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i.exec(String(v == null ? '' : v).trim());
  if (!m) return '';
  let h = +m[1]; const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
  return h < 24 && +m[2] < 60 ? String(h).padStart(2, '0') + ':' + m[2] : '';
}
function stampOf(v) {
  if (v instanceof Date && !isNaN(v)) return v.getTime();
  const t = Date.parse(String(v == null ? '' : v).trim());
  return isNaN(t) ? 0 : t;
}

// Reads the Log tab and applies what differs from what was last written: a changed row, a new row, or
// Qty 0 (a removal). Returns { changed, kept }: kept are rows that couldn't be read, to be left in place.
function ingest(ss, db) {
  const sh = ss.getSheetByName(LOG), res = {changed: false, kept: []};
  if (!sh || sh.getLastRow() < 2) return res;
  const values = sh.getDataRange().getValues(), head = values[0].map(h => String(h).trim().toLowerCase());
  const col = {}; head.forEach((h, i) => { if (h && col[h] == null) col[h] = i; });
  for (const need of ['date', 'name', 'category', 'volume', 'unit', 'abv', 'qty', 'entryid']) if (col[need] == null) return res;   // not our layout: leave it
  const tz = ss.getSpreadsheetTimeZone ? ss.getSpreadsheetTimeZone() : 'UTC', now = Date.now();
  const cell = (r, k) => (col[k] == null ? '' : r[col[k]]);
  const seen = new Set();
  values.slice(1).forEach(r => {
    if (!r.some(v => String(v).trim() !== '')) return;
    const id = String(cell(r, 'entryid')).trim(), cat = String(cell(r, 'category')).trim().toLowerCase();
    const stamp = col.timestamp != null ? stampOf(r[col.timestamp]) : 0;
    const bad = why => { res.kept.push({row: r.slice(), why: why, id: id}); };
    if (cat === 'unknown day' || id === 'test' || /^__connection test__$/i.test(String(cell(r, 'name')).trim())) return;   // the ABV Tracker's own rows: nothing to bring in
    if (id) seen.add(id);
    // an alcohol-free day
    if (cat === AF) {
      const date = dateOf(cell(r, 'date'), tz); if (!date) return bad('Needs a date, like 2026-10-12');
      const key = 'days:' + date, qtyEmpty = String(cell(r, 'qty')).trim() === '';
      if (!qtyEmpty && num(cell(r, 'qty')) === 0) {   // Qty 0: remove the day
        if (db.days.has(date)) { db.days.delete(date); db.graves.set(key, now); res.changed = true; }
        return;
      }
      if (!db.days.has(date) && !(db.graves.get(key) && db.graves.get(key) >= (stamp || now))) { db.days.set(date, {id: date, status: 'af', updated: stamp || now}); res.changed = true; }
      return;
    }
    const known = id ? db.entries.get(id) : null;
    const qtyEmpty = String(cell(r, 'qty')).trim() === '';
    // Qty 0 removes a drink the app knows
    if (known && !qtyEmpty && num(cell(r, 'qty')) === 0) {
      db.entries.delete(id); db.graves.set('entries:' + id, now); db.rows.delete(id); res.changed = true; return;
    }
    const date = dateOf(cell(r, 'date'), tz), vol = num(cell(r, 'volume')), unit = String(cell(r, 'unit')).trim().toLowerCase() === 'ml' ? 'ml' : 'oz';
    const abvRaw = String(cell(r, 'abv')).trim(), abv = num(cell(r, 'abv')), qty = qtyEmpty ? 1 : num(cell(r, 'qty'));
    if (!date) return bad('Needs a date, like 2026-10-12');
    if (!(vol > 0)) return bad('Needs a size in Volume');
    if (abvRaw === '' || abv < 0 || abv > 100) return bad('Needs the strength in ABV (0 to 100)');
    if (!(qty > 0)) return bad('Qty must be 1 or more (0 removes a drink)');
    const entry = {
      id: id || ('sh' + now.toString(36) + Math.random().toString(36).slice(2, 6)),
      date: date, time: timeOf(cell(r, 'time'), tz), name: String(cell(r, 'name')).trim().slice(0, 60), cat: catId(cell(r, 'category')),
      vol: vol, unit: unit, abv: abv, qty: qty, note: String(cell(r, 'note')).trim().slice(0, 200),
    };
    if (!id) {                                    // a new row typed in: it becomes a drink
      entry.updated = stamp || now; db.entries.set(entry.id, entry); res.changed = true; return;
    }
    if (!known) {                                 // an EntryID the app has not got: a drink from another copy, or a removed one
      const gone = db.graves.get('entries:' + id) || 0;
      if (gone && gone >= (stamp || 0)) return;   // removed after this row was written: it will drop out
      entry.updated = stamp || now; db.entries.set(id, entry); res.changed = true; return;
    }
    // a row the app wrote: has it been changed in the Sheet since?
    if (rowSig(entry) === db.rows.get(id)) return;                            // untouched
    const was = {id: id, date: known.date, time: known.time, name: known.name, cat: known.cat, vol: known.vol, unit: known.unit, abv: known.abv, qty: known.qty, note: known.note};
    if (rowSig(entry) === rowSig(was)) return;                                 // same as the app's own
    const at = stamp || now;
    if (at > (Number(known.updated) || 0)) { entry.updated = at; db.entries.set(id, entry); res.changed = true; }   // newer than the app's: take it
    else res.changed = true;                                                                                          // older: the row is rebuilt as the app has it
  });
  // A drink or day the Log tab no longer shows (its row was deleted): rebuild it, so it comes back.
  db.entries.forEach((x, id) => { if (x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || '')) && !seen.has(id)) res.changed = true; });
  db.days.forEach((x, id) => { if (x && x.status === 'af' && !seen.has('af-' + id)) res.changed = true; });
  return res;
}

// ---------- the readable tab ----------

function views(ss, db, kept) {
  const tz = ss.getSpreadsheetTimeZone ? ss.getSpreadsheetTimeZone() : 'UTC';
  const ts = u => new Date(Number(u) || 0).toISOString();
  const keptIds = new Set((kept || []).map(k => k.id).filter(Boolean));   // a row being fixed shows once, as typed
  const entries = Array.from(db.entries.values())
    .filter(x => x && !keptIds.has(x.id) && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || '')))
    .map(x => ({ at: String(x.date) + ' ' + String(x.time || '00:00'), u: Number(x.updated) || 0, row: [
      ts(x.updated), x.date, x.time || '', String(x.name || '').slice(0, 60), CATS[x.cat] || 'Other', num(x.vol), x.unit === 'ml' ? 'ml' : 'oz', num(x.abv), num(x.qty),
      round(grams(x) / STD_G, 2), round(grams(x), 1), String(x.note || '').slice(0, 200), x.id, ''] }));
  const days = Array.from(db.days.values()).filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.id || '')) && x.status === 'af')
    .map(x => ({ at: x.id + ' 00:00', u: Number(x.updated) || 0, row: [ts(x.updated), x.id, '', 'Alcohol-free day', AF, '', '', '', '', 0, 0, '', 'af-' + x.id, ''] }));
  const list = entries.concat(days).sort((a, b) => b.at.localeCompare(a.at) || b.u - a.u);
  const body = (kept || []).map(k => { const r = k.row.slice(); while (r.length < HEADER.length) r.push(''); r[HEADER.length - 1] = k.why; return r; }).concat(list.map(x => x.row));
  const sh = ss.getSheetByName(LOG) || ss.insertSheet(LOG);
  sh.clearContents();
  // Dates, times and names stay text, so the Sheet doesn't turn 2026-10-12 into a date it would show differently.
  const textCols = [2, 3, 4, 5, 7, 12, 13, 14];
  textCols.forEach(c => sh.getRange(1, c, Math.max(sh.getMaxRows(), body.length + 1), 1).setNumberFormat('@'));
  sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]).setFontWeight('bold');
  if (body.length) sh.getRange(2, 1, body.length, HEADER.length).setValues(asTextRows(body));
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 170); sh.setColumnWidth(4, 200); sh.setColumnWidth(12, 220); sh.setColumnWidth(13, 150); sh.setColumnWidth(14, 260);
  // What each row said when it was written: the next sync tells a changed row from an untouched one.
  const sig = [['id', 'row']];
  db.entries.forEach((x, id) => sig.push([id, rowSig(x)]));
  write(ss, ROWS, sig, true);
  ss.getSheets().forEach(s => {
    const n = s.getName();
    if ((n === 'Sheet1' || n === 'Sheet 1') && s.getLastRow() === 0) ss.deleteSheet(s);
  });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
