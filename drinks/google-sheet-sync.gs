/**
 * Allison OS Drinks <-> Google Sheet sync. The same design as Fitness's, with a Log tab you can
 * edit as well as read.
 *
 * One Sheet for the whole family, the record of everyone's Drinks: each row belongs to the person
 * who logged it, and each person's phone only ever gets their own (aOS/SHEETS.md). Phones don't
 * talk to it directly: every request comes through aOS (functions/sheet/api, and Drinks' own
 * functions/drinks/api for the summary Fitness and Calendar show), signed in with Face ID, which
 * adds this script's SECRET and who's asking. So only aOS knows the phrase, and a phone can't ask
 * for anyone else's rows.
 *
 * Paste this whole file into your Sheet's Apps Script editor (Extensions >
 * Apps Script), change SECRET below, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone), or Manage deployments > New
 * version if it's deployed already. Then in aOS: Account > Google Sheets >
 * Drinks, give it the phrase. Full steps: aOS/SHEETS.md.
 *
 * What it keeps in the Sheet:
 *   _entries, _days, _prefs, _deleted, _rows, _people   hidden tabs the app reads back from
 *                                                         (one row per item, as JSON, with whose it is)
 *   Log                                                   every drink and alcohol-free day, newest first:
 *     Who, Timestamp, Date, Time, Name, Category, Volume, Unit, ABV, Qty, StandardDrinks,
 *     GramsAlcohol, Note, EntryID   (and Check, only when a row you typed needs fixing)
 * Each phone keeps the last 90 days and asks here for older days when you look back; this Sheet
 * keeps them all.
 *
 * The Log tab goes both ways. Almost every drink comes from the app, but you can also:
 *   - change a row: the app takes the change, as long as it is newer than the app's own;
 *   - add a row: fill in Date, Name, Category, Volume, Unit, ABV (Qty is 1 if left empty), and
 *     Who: the person's first name, as the other rows have it (left empty, it's the owner's);
 *     the Timestamp, EntryID, StandardDrinks and GramsAlcohol fill themselves in;
 *   - remove a drink: set its Qty to 0 (deleting a row does not remove it: the app puts it back).
 * An alcohol-free day is a row whose Category is "alcohol-free" (Qty 0 removes it).
 * A row that can't be read (no date, no size, a Who the Sheet doesn't know...) is left where it
 * is with a note in the Check column, and is not sent to the app until it is fixed. The Who of a
 * row the app wrote doesn't change whose it is.
 *
 * VERSION 2: one Sheet for the family through aOS (who, by, the Who column, the 90 days and older
 * on asking, the summary for Fitness and Calendar).
 *
 * How changes merge: every drink carries the time it was last changed; the newest version wins,
 * from the app, another phone or the Sheet. Deleted items are kept as a short record in
 * _deleted so the other phone deletes them too.
 */

const SECRET = 'CHANGE-ME';   // <- replace with your own long phrase, e.g. 'maple-otter-47-lantern-quiet'

const APP = 'allison-drinks-sync', VERSION = 2;
const DATA = {entries: '_entries', days: '_days', prefs: '_prefs'};
const DATED = {entries: 'date', days: 'id'};   // what's kept on the phone by its day: the last 90
// Kinds whose ids are a person's own, not made up (an alcohol-free day is its date, goals are 'goals'):
// two people can have the same one, so the Sheet keeps them by person (who~id).
const PER = {days: true, prefs: true};
const MODE = 'personal';   // each person's own rows only (Notes and Travel are 'family': shared, with "Just me" items)
const GRAVES = '_deleted', ROWS = '_rows', PEOPLE = '_people', LOG = 'Log';
const KEEP_DELETED_DAYS = 400;   // long enough that a phone left unopened for a year still hears of a deletion
const CHUNK = 45000;             // a Sheet cell holds up to 50,000 characters
const OZ_ML = 29.5735, ETHANOL = 0.789, STD_G = 14;   // as in Drinks: a standard drink is 14 g of alcohol
const HEADER = ['Who', 'Timestamp', 'Date', 'Time', 'Name', 'Category', 'Volume', 'Unit', 'ABV', 'Qty', 'StandardDrinks', 'GramsAlcohol', 'Note', 'EntryID', 'Check'];
const CATS = {beer: 'Beer', wine: 'Wine', spirits: 'Spirits', cocktail: 'Cocktail', seltzer: 'Seltzer', cider: 'Cider', other: 'Other'};
const AF = 'alcohol-free';
const ISO = /^\d{4}-\d{2}-\d{2}$/, ID = /^[A-Za-z0-9_-]{1,40}$/;

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
// Every request comes through aOS, signed in: ?key= this SECRET, who= the person's family id,
// name= their first name, owner=1 for the family's owner.
function caller(e) {
  const p = (e && e.parameter) || {};
  if (SECRET === 'CHANGE-ME') return {error: 'secret-not-set'};
  if (same(p.key) !== same(SECRET)) return {error: 'wrong-secret'};
  const who = String(p.who || '');
  if (!ID.test(who)) return {error: 'who'};
  return {who: who, name: String(p.name || '').slice(0, 40), owner: p.owner === '1'};
}
// Whose an item is: its by; one from before by was kept is the owner's.
function ownerOf(it, db) { return (it && it.by) || db.owner || ''; }
function canSee(it, c, db) { const o = ownerOf(it, db); return MODE === 'family' ? !it.only || o === c.who : o === c.who; }
function cutoff(today, days) { return new Date(Date.parse(today + 'T00:00:00Z') - (days - 1) * 864e5).toISOString().slice(0, 10); }
// Where the Sheet keeps an item: its id, or for a person's own kind (days, prefs), who~id.
function keyOf(kind, id, who) { return PER[kind] ? (who || '') + '~' + id : String(id); }
// The id a phone knows it by, from where the Sheet keeps it.
function idOf(kind, key) { return PER[kind] ? key.slice(key.indexOf('~') + 1) : key; }

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
    let changed = meet(db, c), kept = [];
    if (req.action === 'sync' || req.action === 'rebuild') {
      const r = ingest(ss, db);          // what was typed into the Log tab since the last sync
      kept = r.kept; changed = r.changed || changed;
    }
    if (req.action === 'sync') changed = merge(db, req, c) || changed;
    if (changed || req.action === 'rebuild') { store(ss, db); views(ss, db, kept); }
    const res = {ok: true, app: APP, v: VERSION, aos: true, at: Date.now(), by: c.who};
    if (req.action === 'summary') { res.days = summary(db, c, req.from, req.to); return out(res); }
    // a range of days (looking back past what the phone keeps), or everything of yours: the last
    // `window` days of anything dated, and all of the rest
    const range = req.action === 'range' && ISO.test(req.from || '') && ISO.test(req.to || '') ? req : null;
    const cut = !range && req.window && ISO.test(req.today || '') ? cutoff(req.today, Math.max(1, Number(req.window) || 90)) : '';
    Object.keys(DATA).forEach(kind => {
      const f = DATED[kind];
      if (range && !f) return;
      res[kind] = Array.from(db[kind].values()).filter(it => canSee(it, c, db)
        && (!f || (range ? it[f] >= range.from && it[f] <= range.to : !cut || String(it[f] || '') >= cut)));
    });
    if (!range) {
      res.graves = {};
      db.graves.forEach((g, k) => {
        if (MODE !== 'family' && (g.by || db.owner) !== c.who) return;
        const i = k.indexOf(':'), kind = k.slice(0, i);
        res.graves[kind + ':' + idOf(kind, k.slice(i + 1))] = g.t;
      });
    }
    return out(res);
  } finally {
    lock.releaseLock();
  }
}

// Each day's standard drinks, or { status: 'af' }, of the caller's own, from `from` to `to` (at most
// 400 days): what Fitness and Calendar show of your Drinks (functions/drinks/api/summary).
function summary(db, c, from, to) {
  const days = {};
  if (!ISO.test(from || '') || !ISO.test(to || '') || from > to || (Date.parse(to) - Date.parse(from)) / 864e5 > 400) return days;
  db.days.forEach(d => { if (canSee(d, c, db) && d.status === 'af' && d.id >= from && d.id <= to) days[d.id] = {status: 'af'}; });
  db.entries.forEach(x => {
    if (!canSee(x, c, db) || !(x.date >= from && x.date <= to) || !(num(x.qty) > 0)) return;
    const d = days[x.date] && days[x.date].sd !== undefined ? days[x.date] : (days[x.date] = {sd: 0, n: 0});   // a drink beats an alcohol-free mark
    d.sd += grams(x) / STD_G; d.n += num(x.qty);
  });
  Object.keys(days).forEach(k => { if (days[k].sd !== undefined) days[k].sd = round(days[k].sd, 2); });
  return days;
}

// The people the Sheet has heard from, for the Who column; and the owner, whose are the rows from
// before aOS kept whose each one is. Changed only when something is new.
function meet(db, c) {
  let changed = false;
  if (c.name && db.people[c.who] !== c.name) { db.people[c.who] = c.name; changed = true; }
  if (c.owner && db.owner !== c.who) { db.owner = c.who; changed = true; }
  // the owner's first time: the rows from before aOS kept whose each is are theirs, written down as such
  if (c.owner) Object.keys(DATA).forEach(kind => db[kind].forEach(it => { if (!it.by) { it.by = c.who; changed = true; } }));
  if (changed) rekey(db);
  return changed;
}
const whoName = (it, db) => { const o = ownerOf(it, db); return db.people[o] || o; };

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
    const width = Math.max(HEADER.length, sh.getLastColumn ? sh.getLastColumn() : 0);
    const head = sh.getRange(1, 1, 1, width).getValues()[0], col = {};
    head.forEach((h, i) => { const k = String(h).trim().toLowerCase(); if (k && col[k] == null) col[k] = i + 1; });
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
  const db = {graves: new Map(), rows: new Map(), people: {}, owner: ''};
  rows(ss, PEOPLE).forEach(r => { const id = String(r[0] || ''); if (id === '(owner)') db.owner = String(r[1] || ''); else if (id) db.people[id] = String(r[1] || ''); });
  Object.keys(DATA).forEach(kind => {
    db[kind] = new Map();
    rows(ss, DATA[kind]).forEach(r => {
      if (!String(r[0] || '')) return;
      try { const it = JSON.parse(r.slice(2).join('')); if (it && it.id != null) db[kind].set(keyOf(kind, it.id, ownerOf(it, db)), it); } catch (err) { /* skip a damaged row */ }
    });
  });
  rows(ss, GRAVES).forEach(r => { const k = String(r[0] || ''); if (k) db.graves.set(k, {t: Number(r[1]) || 0, by: String(r[2] || '')}); });
  rows(ss, ROWS).forEach(r => { const k = String(r[0] || ''); if (k) db.rows.set(k, String(r[1] || '')); });   // id -> what its Log row said when it was last written
  rekey(db);
  return db;
}

// Keys every person's own kind (days, prefs) and its graves by whose it is, now that the Sheet knows
// (a row or grave from before aOS is the owner's); the newest wins if two meet.
function rekey(db) {
  Object.keys(PER).forEach(kind => {
    const m = new Map();
    db[kind].forEach(it => { const k = keyOf(kind, it.id, ownerOf(it, db)), cur = m.get(k); if (!cur || (Number(it.updated) || 0) > (Number(cur.updated) || 0)) m.set(k, it); });
    db[kind] = m;
  });
  const g = new Map();
  db.graves.forEach((x, key) => {
    const i = key.indexOf(':'), kind = key.slice(0, i);
    let k = key;
    if (PER[kind]) {
      const id = key.slice(i + 1), j = id.indexOf('~');
      k = kind + ':' + keyOf(kind, j >= 0 ? id.slice(j + 1) : id, (j > 0 ? id.slice(0, j) : '') || x.by || db.owner);
    }
    const cur = g.get(k);
    if (!cur || cur.t < x.t) g.set(k, x);
  });
  db.graves = g;
}

function rows(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1);
}

function store(ss, db) {
  Object.keys(DATA).forEach(kind => {
    const list = Array.from(db[kind].entries()).map(([k, it]) => {
      const json = JSON.stringify(it), parts = [];
      for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
      return [k, Number(it.updated) || 0].concat(parts);
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

// What a phone sent, from the person who sent it: their own items only (someone else's, even
// with the same id, is never changed from another's phone), each kept as theirs (by).
function merge(db, req, c) {
  let changed = false;
  const now = Date.now();
  Object.keys(req.graves || {}).forEach(k => {
    const t = Number(req.graves[k]) || 0, i = k.indexOf(':'), kind = k.slice(0, i), id = k.slice(i + 1);
    if (!DATA[kind] || !ID.test(id)) return;
    const key = keyOf(kind, id, c.who), cur = db[kind].get(key);
    if (cur && !canSee(cur, c, db)) return;
    const gk = kind + ':' + key, g = db.graves.get(gk);
    if (!g || g.t < t) { db.graves.set(gk, {t: t, by: cur ? ownerOf(cur, db) : (g && g.by) || c.who}); changed = true; }
  });
  Object.keys(DATA).forEach(kind => {
    (req[kind] || []).forEach(item => {
      if (!item || typeof item.id !== 'string' || !ID.test(item.id)) return;
      const u = Number(item.updated) || 0, key = keyOf(kind, item.id, c.who), gk = kind + ':' + key;
      const cur = db[kind].get(key), g = db.graves.get(gk), gone = g ? g.t : 0;
      if (cur && !canSee(cur, c, db)) return;
      item.by = cur ? ownerOf(cur, db) : c.who;
      if (gone && gone >= u) return;                       // deleted after this change
      if (!cur || u > (Number(cur.updated) || 0)) { db[kind].set(key, item); changed = true; }
      if (gone && u > gone) { db.graves.delete(gk); changed = true; }   // brought back (Undo)
    });
  });
  return sweep(db, now) || changed;
}

// An item with a grave newer than itself goes; graves older than KEEP_DELETED_DAYS go too.
function sweep(db, now) {
  let changed = false;
  db.graves.forEach((g, gk) => {
    const i = gk.indexOf(':'), kind = gk.slice(0, i), key = gk.slice(i + 1);
    const cur = db[kind] && db[kind].get(key);
    if (cur && (Number(cur.updated) || 0) <= g.t) { db[kind].delete(key); changed = true; }
    if (now - g.t > KEEP_DELETED_DAYS * 864e5) { db.graves.delete(gk); changed = true; }
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
// An alcohol-free day's EntryID: af-<date>, and whose it is when it isn't the owner's.
const afId = (x, db) => 'af-' + x.id + (ownerOf(x, db) && ownerOf(x, db) !== db.owner ? '-' + ownerOf(x, db) : '');
const AF_ID = /^af-(\d{4}-\d{2}-\d{2})(?:-([A-Za-z0-9_-]{1,40}))?$/;
const withBy = (x, who) => { if (who) x.by = who; return x; };

// Whose a row typed into the Log tab is, from its Who: empty is the owner's; a first name (or an id)
// the Sheet knows is that person's. null: someone the Sheet doesn't know (or two people of that name).
function whoOf(v, db) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return db.owner;
  if (s === db.owner || Object.prototype.hasOwnProperty.call(db.people, s)) return s;
  const low = s.toLowerCase(), ids = Object.keys(db.people).filter(id => String(db.people[id]).trim().toLowerCase() === low);
  return ids.length === 1 ? ids[0] : null;
}

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
// Qty 0 (a removal). Returns { changed, kept }: kept are rows that couldn't be read, to be left in place
// (in this script's column order, whatever order the tab had them in).
function ingest(ss, db) {
  const sh = ss.getSheetByName(LOG), res = {changed: false, kept: []};
  if (!sh || sh.getLastRow() < 2) return res;
  const values = sh.getDataRange().getValues(), head = values[0].map(h => String(h).trim().toLowerCase());
  const col = {}; head.forEach((h, i) => { if (h && col[h] == null) col[h] = i; });
  for (const need of ['date', 'name', 'category', 'volume', 'unit', 'abv', 'qty', 'entryid']) if (col[need] == null) return res;   // not our layout: leave it
  const tz = ss.getSpreadsheetTimeZone ? ss.getSpreadsheetTimeZone() : 'UTC', now = Date.now();
  const cell = (r, k) => (col[k] == null ? '' : r[col[k]]);
  const seen = new Set();
  const unknownWho = () => 'Who: the first name of someone in the family, as other rows have it (left empty, it’s ' + (db.people[db.owner] || 'the owner') + '’s)';
  values.slice(1).forEach(r => {
    if (!r.some(v => String(v).trim() !== '')) return;
    const id = String(cell(r, 'entryid')).trim(), cat = String(cell(r, 'category')).trim().toLowerCase();
    const stamp = col.timestamp != null ? stampOf(r[col.timestamp]) : 0;
    const bad = why => { res.kept.push({row: HEADER.map(h => cell(r, h.toLowerCase())), why: why, id: id}); };
    if (cat === 'unknown day' || id === 'test' || /^__connection test__$/i.test(String(cell(r, 'name')).trim())) return;   // the ABV Tracker's own rows: nothing to bring in
    if (id) seen.add(id);
    // an alcohol-free day: whose it is from its EntryID (af-<date>-<who>), else from Who
    if (cat === AF) {
      const date = dateOf(cell(r, 'date'), tz); if (!date) return bad('Needs a date, like 2026-10-12');
      const m = AF_ID.exec(id), who = m && m[2] ? m[2] : whoOf(cell(r, 'who'), db);
      if (who === null) return bad(unknownWho());
      seen.add('af~' + (who || '') + '~' + date);
      const key = keyOf('days', date, who), gk = 'days:' + key, g = db.graves.get(gk), qtyEmpty = String(cell(r, 'qty')).trim() === '';
      if (!qtyEmpty && num(cell(r, 'qty')) === 0) {   // Qty 0: remove the day
        if (db.days.has(key)) { db.days.delete(key); db.graves.set(gk, {t: now, by: who || ''}); res.changed = true; }
        return;
      }
      if (!db.days.has(key) && !(g && g.t >= (stamp || now))) { db.days.set(key, withBy({id: date, status: 'af', updated: stamp || now}, who)); res.changed = true; }
      return;
    }
    const known = id ? db.entries.get(id) : null;
    const qtyEmpty = String(cell(r, 'qty')).trim() === '';
    // Qty 0 removes a drink the app knows
    if (known && !qtyEmpty && num(cell(r, 'qty')) === 0) {
      db.entries.delete(id); db.graves.set('entries:' + id, {t: now, by: ownerOf(known, db)}); db.rows.delete(id); res.changed = true; return;
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
    if (!known) {                                 // a new row typed in, or an EntryID the app has not got (a drink from another copy, or a removed one)
      const who = whoOf(cell(r, 'who'), db);
      if (who === null) return bad(unknownWho());
      const gone = id ? (db.graves.get('entries:' + id) || {t: 0}).t : 0;
      if (gone && gone >= (stamp || 0)) return;   // removed after this row was written: it will drop out
      entry.updated = stamp || now; db.entries.set(entry.id, withBy(entry, who)); res.changed = true; return;
    }
    // a row the app wrote: has it been changed in the Sheet since? (It stays its person's, whatever its Who says.)
    if (rowSig(entry) === db.rows.get(id)) return;                            // untouched
    const was = {id: id, date: known.date, time: known.time, name: known.name, cat: known.cat, vol: known.vol, unit: known.unit, abv: known.abv, qty: known.qty, note: known.note};
    if (rowSig(entry) === rowSig(was)) return;                                 // same as the app's own
    const at = stamp || now;
    if (at > (Number(known.updated) || 0)) { entry.updated = at; db.entries.set(id, withBy(entry, known.by)); res.changed = true; }   // newer than the app's: take it
    else res.changed = true;                                                                                                       // older: the row is rebuilt as the app has it
  });
  // A drink or day the Log tab no longer shows (its row was deleted): rebuild it, so it comes back.
  db.entries.forEach((x, id) => { if (x && ISO.test(String(x.date || '')) && !seen.has(id)) res.changed = true; });
  db.days.forEach(x => { if (x && x.status === 'af' && !seen.has('af~' + ownerOf(x, db) + '~' + x.id)) res.changed = true; });
  return res;
}

// ---------- the readable tab ----------

function views(ss, db, kept) {
  const ts = u => new Date(Number(u) || 0).toISOString();
  const keptIds = new Set((kept || []).map(k => k.id).filter(Boolean));   // a row being fixed shows once, as typed
  const entries = Array.from(db.entries.values())
    .filter(x => x && !keptIds.has(x.id) && ISO.test(String(x.date || '')))
    .map(x => ({ at: String(x.date) + ' ' + String(x.time || '00:00'), u: Number(x.updated) || 0, row: [
      whoName(x, db), ts(x.updated), x.date, x.time || '', String(x.name || '').slice(0, 60), CATS[x.cat] || 'Other', num(x.vol), x.unit === 'ml' ? 'ml' : 'oz', num(x.abv), num(x.qty),
      round(grams(x) / STD_G, 2), round(grams(x), 1), String(x.note || '').slice(0, 200), x.id, ''] }));
  const days = Array.from(db.days.values()).filter(x => x && ISO.test(String(x.id || '')) && x.status === 'af')
    .map(x => ({ at: x.id + ' 00:00', u: Number(x.updated) || 0, row: [whoName(x, db), ts(x.updated), x.id, '', 'Alcohol-free day', AF, '', '', '', '', 0, 0, '', afId(x, db), ''] }));
  const list = entries.concat(days).sort((a, b) => b.at.localeCompare(a.at) || b.u - a.u);
  const body = (kept || []).map(k => { const r = k.row.slice(0, HEADER.length); while (r.length < HEADER.length) r.push(''); r[HEADER.length - 1] = k.why; return r; }).concat(list.map(x => x.row));
  const sh = ss.getSheetByName(LOG) || ss.insertSheet(LOG);
  sh.clearContents();
  // Who, dates, times and names stay text, so the Sheet doesn't turn 2026-10-12 into a date it would show differently.
  const textCols = [1, 3, 4, 5, 6, 8, 13, 14, 15];
  textCols.forEach(c => sh.getRange(1, c, Math.max(sh.getMaxRows(), body.length + 1), 1).setNumberFormat('@'));
  sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]).setFontWeight('bold');
  if (body.length) sh.getRange(2, 1, body.length, HEADER.length).setValues(asTextRows(body));
  sh.setFrozenRows(1);
  sh.setColumnWidth(2, 170); sh.setColumnWidth(5, 200); sh.setColumnWidth(13, 220); sh.setColumnWidth(14, 150); sh.setColumnWidth(15, 260);
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
