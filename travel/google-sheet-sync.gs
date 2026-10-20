/**
 * Allison OS Travel <-> Google Sheet sync. The same design as Fitness'.
 *
 * One Sheet for the whole family, the record of everyone's trips: each
 * booking and trip name belongs to the person who added it (its by), and is
 * shared with the family, unless that person made it Just me (only), which
 * only they ever get (aOS/SHEETS.md, family mode). Phones don't talk to it
 * directly: every request comes through aOS (functions/sheet/api), signed in
 * with Face ID, which adds this script's SECRET and who's asking. So only aOS
 * knows the phrase, and a phone can't ask for anyone else's Just me bookings.
 *
 * Paste this whole file into your Sheet's Apps Script editor (Extensions >
 * Apps Script), change SECRET below, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone), or Manage deployments > New
 * version if it's deployed already. Then in aOS: Account > Google Sheets >
 * Travel, give it the phrase. Full steps: aOS/SHEETS.md.
 *
 * What it keeps in the Sheet:
 *   _bookings, _trips, _deleted, _people
 *                                  hidden tabs the app reads back from
 *                                  (one row per item, as JSON, with whose it is)
 *   Bookings                       every flight, hotel and car, soonest first, with Who
 * The Bookings tab is rebuilt on every change, so edit bookings in the app,
 * not there. Each phone keeps every booking still to come and the last 90
 * days of the rest, and asks here for older trips when you look back; this
 * Sheet keeps them all.
 *
 * VERSION 2: one Sheet for the family through aOS (who, by, Just me, the Who
 * column, the 90 days and older trips on asking).
 *
 * How changes merge: every booking and trip name carries the time it was
 * last changed; the newest version wins. Deleted items are kept as a short
 * record in _deleted so the other phones delete them too, and so an email
 * read again later doesn't bring them back.
 */

const SECRET = 'CHANGE-ME';   // <- replace with your own long phrase, e.g. 'maple-otter-47-lantern-quiet'

const APP = 'allison-travel-sync', VERSION = 2;
const DATA = {bookings: '_bookings', trips: '_trips'};
const DATED = {bookings: true};   // kept on the phone by their days (daysOf): all still to come, and the last 90 of the rest
const MODE = 'family';   // shared with the family, except an item marked Just me (only), which only its own person gets
const GRAVES = '_deleted', PEOPLE = '_people';
const KEEP_DELETED_DAYS = 400;   // longer than the year of email the app reads
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
function cutoff(today, days) { return new Date(Date.parse(today + 'T00:00:00Z') - (days - 1) * 864e5).toISOString().slice(0, 10); }

// A booking's days: from its start to its end (a flight's take-off and landing, a stay's check-in and
// check-out, a car's pick-up and return). One with no date yet has none, and always goes to the phones.
const startOf = b => b.type === 'flight' ? b.dep : b.type === 'hotel' ? b.checkIn : b.type === 'car' ? b.pickup : b.start;
const endOf = b => b.type === 'flight' ? b.arr : b.type === 'hotel' ? b.checkOut : b.type === 'car' ? b.dropoff : b.end;
function daysOf(b) {
  const from = String(startOf(b) || '').slice(0, 10), to = String(endOf(b) || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(from) ? {from: from, to: to > from ? to : from} : null;
}
// In an answer: a range's bookings are those on any of its days; otherwise every booking still to come
// or that ended on or after the cut (the window's first day), and every one with no date yet.
function inDays(b, range, cut) {
  const d = daysOf(b);
  if (range) return !!d && d.from <= range.to && d.to >= range.from;
  return !d || !cut || d.to >= cut;
}

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
    // people: the family's first names, so a phone can say whose a shared booking is
    const res = {ok: true, app: APP, v: VERSION, aos: true, at: Date.now(), by: c.who, people: db.people};
    // a range of days (looking back past what the phone keeps), or everything you can see: the bookings
    // still to come and the last `window` days of the rest, and all of the rest (trip names)
    const range = req.action === 'range' && /^\d{4}-\d{2}-\d{2}$/.test(req.from || '') && /^\d{4}-\d{2}-\d{2}$/.test(req.to || '') ? req : null;
    const cut = !range && req.window && /^\d{4}-\d{2}-\d{2}$/.test(req.today || '') ? cutoff(req.today, Math.max(1, Number(req.window) || 90)) : '';
    Object.keys(DATA).forEach(kind => {
      const f = DATED[kind];
      if (range && !f) return;
      res[kind] = Array.from(db[kind].values()).filter(it => canSee(it, c, db) && (!f || inDays(it, range, cut)));
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
  const db = {graves: new Map(), people: {}, owner: ''};
  Object.keys(DATA).forEach(kind => { db[kind] = new Map(); });
  Object.keys(DATA).forEach(kind => {
    rows(ss, DATA[kind]).forEach(r => {
      const id = String(r[0] || ''); if (!id) return;
      try { db[kind].set(id, JSON.parse(r.slice(2).join(''))); } catch (err) { /* skip a damaged row */ }
    });
  });
  // a grave from before aOS has no by (the owner's, as its item was)
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

// What a phone sent, from the person who sent it: only items they can see (someone else's Just me
// item, even with the same id, is never changed or deleted from another's phone), each kept as its
// own person's (by), and only that person makes it Just me, or shared again.
function merge(db, req, c) {
  let changed = false;
  const now = Date.now();
  Object.keys(req.graves || {}).forEach(k => {
    const t = Number(req.graves[k]) || 0, i = k.indexOf(':'), kind = k.slice(0, i);
    const cur = db[kind] && db[kind].get(k.slice(i + 1));
    if (cur && !canSee(cur, c, db)) return;
    const g = db.graves.get(k);
    if (!g || g.t < t) { db.graves.set(k, {t: t, by: cur ? ownerOf(cur, db) : (g && g.by) || c.who}); changed = true; }
  });
  Object.keys(DATA).forEach(kind => {
    (req[kind] || []).forEach(item => {
      if (!item || typeof item.id !== 'string') return;
      const u = Number(item.updated) || 0, key = kind + ':' + item.id;
      const cur = db[kind].get(item.id), g = db.graves.get(key), gone = g ? g.t : 0;
      if (cur && !canSee(cur, c, db)) return;
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

// ---------- the readable tab ----------

function views(ss, db) {
  const what = b => b.type === 'flight' ? [b.airline, (b.airlineCode || '') + (b.flightNo || '')].filter(Boolean).join(' ') + ' ' + (b.from || '?') + ' → ' + (b.to || '?')
    : b.type === 'hotel' ? b.name : b.type === 'car' ? (b.company || 'Car') + (b.carClass ? ' · ' + b.carClass : '') : b.title;
  const where = b => b.type === 'hotel' ? b.address : b.type === 'car' ? b.pickupPlace : b.type === 'flight' ? [b.fromName, b.toName].filter(Boolean).join(' → ') : b.place;
  const list = Array.from(db.bookings.values()).filter(b => !b.deletedAt)
    .sort((a, b) => String(startOf(a) || '9999').localeCompare(String(startOf(b) || '9999')));
  const header = ['Who', 'Starts', 'Ends', 'Type', 'Booking', 'Where', 'Confirmation', 'Status', 'Notes', 'Seen by'];
  const body = list.map(b => [whoName(b, db), String(startOf(b) || '').replace('T', ' '), String(endOf(b) || '').replace('T', ' '),
    b.type, what(b) || '', where(b) || '', b.conf || '', b.status === 'cancelled' ? 'Cancelled' : b.guess ? 'Check' : 'Confirmed', b.notes || '',
    b.only ? 'Just me' : 'Family']);
  const sh = ss.getSheetByName('Bookings') || ss.insertSheet('Bookings');
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (body.length) sh.getRange(2, 1, body.length, header.length).setValues(asTextRows(body));
  sh.setFrozenRows(1);
  sh.setColumnWidth(5, 280);
  sh.setColumnWidth(6, 280);
  ss.getSheets().forEach(s => {
    const n = s.getName();
    if ((n === 'Sheet1' || n === 'Sheet 1') && s.getLastRow() === 0) ss.deleteSheet(s);
  });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
