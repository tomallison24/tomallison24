/**
 * Allison OS Orders <-> Google Sheet sync. The same design as Fitness'.
 *
 * One Sheet for the whole family, the record of everyone's Orders: each
 * order belongs to the person whose Gmail (or hands) it came from, and each
 * person's phone only ever gets their own (aOS/SHEETS.md). Phones don't talk
 * to it directly: every request comes through aOS (functions/sheet/api),
 * signed in with Face ID, which adds this script's SECRET and who's asking.
 * So only aOS knows the phrase, and a phone can't ask for anyone else's
 * orders.
 *
 * Paste this whole file into your Sheet's Apps Script editor (Extensions >
 * Apps Script), change SECRET below, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone), or Manage deployments > New
 * version if it's deployed already. Then in aOS: Account > Google Sheets >
 * Orders, give it the phrase. Full steps: aOS/SHEETS.md.
 *
 * What it keeps in the Sheet:
 *   _orders, _deleted, _people   hidden tabs the app reads back from
 *                                (one row per order, as JSON, with whose it is)
 *   Orders                       every order, newest first, with Who
 *   Log                          a history that only grows: one row each time an
 *                                order is added, changes status, is updated or
 *                                deleted, or an email is left out because its
 *                                kind is switched off in Settings (oldest at the
 *                                top), with Who
 * The Orders tab is rebuilt on every change, so edit orders in the app, not
 * there. The Log tab is never rebuilt or cleared: rows are only added. Each
 * phone keeps the last 90 days of orders, and every order that hasn't arrived
 * yet whatever its age, and asks here for older ones when you look back; this
 * Sheet keeps them all.
 *
 * VERSION 2 added the Log tab; VERSION 3, one Sheet for the family through
 * aOS (who, by, the Who column, the 90 days and older on asking).
 *
 * How changes merge: every order carries the time it was last changed; the
 * newest version wins. Deleted orders are kept as a short record in _deleted
 * so your other phone deletes them too, and so an email read again later
 * doesn't bring them back.
 */

const SECRET = 'CHANGE-ME';   // <- replace with your own long phrase, e.g. 'maple-otter-47-lantern-quiet'

const APP = 'allison-orders-sync', VERSION = 3;
const DATA = {orders: '_orders'};
// What's kept on the phone by its day (the last 90): an order, by the day it was ordered (orderDay).
// An order that isn't finished yet (ordered, shipped, out for delivery, waiting to be picked up) is
// always kept on the phone and always sent back, however old it is.
const DATED = {orders: orderDay};
const FINISHED = ['delivered', 'pickedup', 'cancelled'];
const MODE = 'personal';   // each person's own orders only (Notes and Travel are 'family': shared, with "Just me" items)
const GRAVES = '_deleted', PEOPLE = '_people';
const LOG = 'Log';
const LOGHEAD = ['Who', 'Logged', 'Event', 'Store', 'Kind', 'Items', 'Total', 'Status', 'Carrier', 'Tracking', 'Expected', 'Order number', 'What changed', 'Order ID', 'EventID'];
const LOG_TEXT = [1, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15];   // everything but the time and the total: kept as text, so a tracking number stays a tracking number
const STATUS_NAMES = {ordered: 'Ordered', shipped: 'Shipped', out: 'Out for delivery', pickup: 'Ready for pickup', delivered: 'Delivered', pickedup: 'Picked up', cancelled: 'Canceled'};
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
  return out({ok: true, app: APP, v: VERSION, aos: true, log: 1});
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
// Whose an order is: its by; one from before by was kept is the owner's.
function ownerOf(it, db) { return (it && it.by) || db.owner || ''; }
function canSee(it, c, db) { const o = ownerOf(it, db); return MODE === 'family' ? !it.only || o === c.who : o === c.who; }
function cutoff(today, days) { return new Date(Date.parse(today + 'T00:00:00Z') - (days - 1) * 864e5).toISOString().slice(0, 10); }
const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
// The day an order was placed: its order date, else its first step's, else the day of its email (or of
// when it was added), in UTC, so this script and the phone (orders/app.js, orderDay) always agree.
function orderDay(o) {
  if (!o) return '';
  if (isDay(o.orderDate)) return o.orderDate;
  const steps = Object.keys(o.steps || {}).map(k => o.steps[k]).filter(isDay).sort();
  if (steps.length) return steps[0];
  const t = Number(o.source && o.source.date) || Number(o.created) || 0;
  return t > 0 ? new Date(t).toISOString().slice(0, 10) : '';
}
const unfinished = o => FINISHED.indexOf(o && o.status) < 0;

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
    let logged = [];
    try { logged = appendLog(ss, req.log, c, db); } catch (err) { logged = []; }   // not acknowledged: the phone sends them again
    if (req.action === 'sync') changed = merge(db, req, c) || changed;
    if (changed || req.action === 'rebuild') { store(ss, db); views(ss, db); }
    const res = {ok: true, app: APP, v: VERSION, aos: true, log: 1, logged: logged, at: Date.now(), by: c.who};
    // a range of days (looking back past what the phone keeps), or everything of yours: the last
    // `window` days of orders, every order not finished yet, and, as the Sheet now has it, every
    // order the phone sent (so it hears of a change made on your other phone to one it still keeps)
    const range = req.action === 'range' && isDay(req.from) && isDay(req.to) ? req : null;
    const cut = !range && req.window && isDay(req.today) ? cutoff(req.today, Math.max(1, Number(req.window) || 90)) : '';
    const sent = new Set((Array.isArray(req.orders) ? req.orders : []).map(it => it && it.id));
    Object.keys(DATA).forEach(kind => {
      const day = DATED[kind];
      if (range && !day) return;
      res[kind] = Array.from(db[kind].values()).filter(it => {
        if (!canSee(it, c, db)) return false;
        if (!day) return true;
        const d = day(it);
        if (range) return d >= range.from && d <= range.to;
        return !cut || !d || d >= cut || unfinished(it) || sent.has(it.id);
      });
    });
    if (!range) {
      res.graves = {};
      db.graves.forEach((g, k) => { if (MODE === 'family' || (g.by || db.owner) === c.who) res.graves[k] = g.t; });
      if (c.refused && c.refused.length) res.refused = c.refused;   // someone else's id: the phone keeps its copy to itself
    }
    return out(res);
  } finally {
    lock.releaseLock();
  }
}

// The people the Sheet has heard from, for the Who column; and the owner, whose are the orders from
// before aOS kept whose each one is. Changed only when something is new.
function meet(db, c) {
  let changed = false;
  if (c.name && db.people[c.who] !== c.name) { db.people[c.who] = c.name; changed = true; }
  if (c.owner && db.owner !== c.who) { db.owner = c.who; changed = true; }
  // the owner's first time: the orders from before aOS kept whose each is are theirs, written down as such
  if (c.owner) Object.keys(DATA).forEach(kind => db[kind].forEach(it => { if (!it.by) { it.by = c.who; changed = true; } }));
  return changed;
}
const whoName = (it, db) => db.people[ownerOf(it, db)] || '';

// An "Orders" menu in the Sheet, to rebuild the Orders tab by hand.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Orders').addItem('Rebuild Orders tab', 'rebuildTabs').addToUi();
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

function write(ss, name, values, hidden) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  if (values.length) sh.getRange(1, 1, values.length, values[0].length).setValues(values.map(r => r.map(asText)));
  if (hidden) sh.hideSheet();
  return sh;
}

// ---------- merging what a phone sent ----------

// What a phone sent, from the person who sent it: their own orders only (someone else's, even with
// the same id, is never changed from another's phone: the same email in two people's Gmail makes the
// same id, and the first to send it keeps it), each kept as theirs (by). The ids of someone else's
// go back to the phone as refused, so it stops sending them.
function merge(db, req, c) {
  let changed = false;
  const now = Date.now();
  c.refused = [];
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
      if (cur && !canSee(cur, c, db)) { c.refused.push(item.id); return; }
      item.by = cur ? ownerOf(cur, db) : c.who;
      if (MODE === 'family' && item.by !== c.who) item.only = !!(cur && cur.only);   // only its own person makes it Just me
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
  const day = o => (o.steps && (o.steps.delivered || o.steps.pickedup || o.steps.out || o.steps.shipped || o.steps.pickup || o.steps.ordered)) || o.orderDate || '';
  const items = o => (o.items || []).map(i => (i.qty > 1 ? i.qty + ' x ' : '') + i.name).join('; ');
  const list = Array.from(db.orders.values()).sort((a, b) => String(day(b)).localeCompare(String(day(a))));
  const header = ['Who', 'Ordered', 'Store', 'Items', 'Total', 'Status', 'Carrier', 'Tracking', 'Expected', 'Order number', 'Kind', 'Notes'];
  const body = list.map(o => [whoName(o, db), o.orderDate || (o.steps && o.steps.ordered) || '', o.store || '', items(o), o.total == null ? '' : o.total, STATUS_NAMES[o.status] || o.status || '',
    o.carrier || '', o.tracking || '', o.eta || '', o.orderNo || '', o.kind || 'package', o.notes || '']);
  const sh = ss.getSheetByName('Orders') || ss.insertSheet('Orders');
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (body.length) sh.getRange(2, 1, body.length, header.length).setValues(body.map(r => r.map(asText)));
  sh.setFrozenRows(1);
  sh.setColumnWidth(3, 160);
  sh.setColumnWidth(4, 360);
  ss.getSheets().forEach(s => {
    const n = s.getName();
    if ((n === 'Sheet1' || n === 'Sheet 1') && s.getLastRow() === 0) ss.deleteSheet(s);
  });
}

// ---------- the Log tab: rows are only ever added ----------

// Adds the events a phone sent (each has an id, so one sent twice is written once), each with the name
// of the person whose phone sent it, and returns the ids it now holds, which the phone then stops sending.
function appendLog(ss, events, c, db) {
  if (!Array.isArray(events) || !events.length) return [];
  const sh = ss.getSheetByName(LOG) || startLog(ss);
  whoFirst(sh, db);
  const last = sh.getLastRow(), col = LOGHEAD.length;
  const have = new Set(last > 1 ? sh.getRange(2, col, last - 1, 1).getValues().map(r => String(r[0])) : []);
  const who = db.people[c.who] || c.name || '';
  const fresh = [], done = [];
  events.slice(0, 500).sort((a, b) => (Number(a && a.at) || 0) - (Number(b && b.at) || 0)).forEach(e => {
    if (!e || typeof e.id !== 'string' || !e.id || e.id.length > 120) return;
    done.push(e.id);
    if (have.has(e.id)) return;
    have.add(e.id);
    const o = e.o || {};
    const items = (Array.isArray(o.items) ? o.items : []).map(i => i && ((i.qty > 1 ? i.qty + ' x ' : '') + (i.name || ''))).filter(Boolean).join('; ');
    const total = o.total == null || o.total === '' ? '' : Number(o.total);
    fresh.push([who, new Date(Number(e.at) || Date.now()), String(e.ev || ''), o.store || '', o.kind || 'package', items, isFinite(total) ? total : '',
      STATUS_NAMES[o.status] || o.status || '', o.carrier || '', o.tracking || '', o.eta || '', o.orderNo || '', String(e.note || '').slice(0, 300), o.id || '', e.id]);
  });
  if (fresh.length) sh.getRange(last + 1, 1, fresh.length, col).setValues(fresh.map(r => r.map(asText)));
  return done;
}

function startLog(ss) {
  const sh = ss.insertSheet(LOG);
  LOG_TEXT.forEach(c => sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@'));
  sh.getRange(1, 2, sh.getMaxRows(), 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sh.getRange(1, 1, 1, LOGHEAD.length).setValues([LOGHEAD]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 90); sh.setColumnWidth(2, 150); sh.setColumnWidth(4, 160); sh.setColumnWidth(6, 320); sh.setColumnWidth(13, 260);
  return sh;
}

// A Log from before VERSION 3 has no Who column: one is put in front of it (every row moves one
// column right, as it is; nothing is rewritten), and its rows, all from before aOS, are the owner's.
function whoFirst(sh, db) {
  const head = sh.getRange(1, 1, 1, 1).getValues()[0][0];
  if (head === 'Who') return;
  sh.insertColumnBefore(1);
  sh.getRange(1, 1, sh.getMaxRows(), 1).setNumberFormat('@');
  sh.getRange(1, 1, 1, 1).setValues([['Who']]).setFontWeight('bold');
  const last = sh.getLastRow(), name = db.people[db.owner] || '';
  if (last > 1 && name) sh.getRange(2, 1, last - 1, 1).setValues(Array.from({length: last - 1}, () => [name]));
}

// Text a cell would otherwise read as a formula (=, +, -, @) is kept as text.
function asText(v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; }

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
