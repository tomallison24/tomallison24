/**
 * Allison OS Travel <-> Google Sheet sync. The same design as Notes'.
 *
 * Paste this whole file into your Sheet's Apps Script editor (Extensions >
 * Apps Script), change SECRET below, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Paste the web app link and the
 * secret into Travel. Full steps: travel/README.md, "Google Sheet sync".
 *
 * What it keeps in the Sheet:
 *   _bookings, _trips, _deleted   hidden tabs the app reads back from
 *                                  (one row per item, as JSON)
 *   Bookings                       every flight, hotel and car, soonest first
 * The Bookings tab is rebuilt on every change, so edit bookings in the app,
 * not there.
 *
 * How changes merge: every booking and trip name carries the time it was
 * last changed; the newest version wins. Deleted items are kept as a short
 * record in _deleted so the other phone deletes them too, and so an email
 * read again later doesn't bring them back.
 */

const SECRET = 'CHANGE-ME';   // <- replace with your own long phrase, e.g. 'maple-otter-47-lantern-quiet'

const APP = 'allison-travel-sync', VERSION = 1;
const DATA = {bookings: '_bookings', trips: '_trips'};
const GRAVES = '_deleted';
const KEEP_DELETED_DAYS = 400;   // longer than the year of email the app reads
const CHUNK = 45000;             // a Sheet cell holds up to 50,000 characters

// The phrase as typed on a phone and as typed here can differ in ways you
// can't see: spaces at the ends, and a phone's "smart" curly quotes and long
// dashes. Those don't count.
function same(s) {
  return String(s == null ? '' : s).normalize('NFKC').trim()
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"').replace(/[\u2010-\u2015\u2212]/g, '-');
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
    const changed = req.action === 'sync' ? merge(db, req) : false;
    if (changed || req.action === 'rebuild') { store(ss, db); views(ss, db); }
    return out({
      ok: true, app: APP, v: VERSION, at: Date.now(),
      bookings: Array.from(db.bookings.values()), trips: Array.from(db.trips.values()),
      graves: Object.fromEntries(db.graves)
    });
  } finally {
    lock.releaseLock();
  }
}

// A "Travel" menu in the Sheet, to rebuild the Bookings tab by hand.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Travel').addItem('Rebuild Bookings tab', 'rebuildTabs').addToUi();
}
function rebuildTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  views(ss, load(ss));
}

// ---------- reading and writing the hidden data tabs ----------

function load(ss) {
  const db = {bookings: new Map(), trips: new Map(), graves: new Map()};
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

// ---------- the readable tab ----------

function views(ss, db) {
  const start = b => b.type === 'flight' ? b.dep : b.type === 'hotel' ? b.checkIn : b.type === 'car' ? b.pickup : b.start;
  const end = b => b.type === 'flight' ? b.arr : b.type === 'hotel' ? b.checkOut : b.type === 'car' ? b.dropoff : b.end;
  const what = b => b.type === 'flight' ? [b.airline, (b.airlineCode || '') + (b.flightNo || '')].filter(Boolean).join(' ') + ' ' + (b.from || '?') + ' → ' + (b.to || '?')
    : b.type === 'hotel' ? b.name : b.type === 'car' ? (b.company || 'Car') + (b.carClass ? ' · ' + b.carClass : '') : b.title;
  const where = b => b.type === 'hotel' ? b.address : b.type === 'car' ? b.pickupPlace : b.type === 'flight' ? [b.fromName, b.toName].filter(Boolean).join(' → ') : b.place;
  const list = Array.from(db.bookings.values()).filter(b => !b.deletedAt)
    .sort((a, b) => String(start(a) || '9999').localeCompare(String(start(b) || '9999')));
  const header = ['Starts', 'Ends', 'Type', 'Booking', 'Where', 'Confirmation', 'Status', 'Notes'];
  const body = list.map(b => [String(start(b) || '').replace('T', ' '), String(end(b) || '').replace('T', ' '),
    b.type, what(b) || '', where(b) || '', b.conf || '', b.status === 'cancelled' ? 'Cancelled' : b.guess ? 'Check' : 'Confirmed', b.notes || '']);
  const sh = ss.getSheetByName('Bookings') || ss.insertSheet('Bookings');
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (body.length) sh.getRange(2, 1, body.length, header.length).setValues(body);
  sh.setFrozenRows(1);
  sh.setColumnWidth(4, 280);
  sh.setColumnWidth(5, 280);
  ss.getSheets().forEach(s => {
    const n = s.getName();
    if ((n === 'Sheet1' || n === 'Sheet 1') && s.getLastRow() === 0) ss.deleteSheet(s);
  });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
