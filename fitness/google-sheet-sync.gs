/**
 * Allison OS Fitness <-> Google Sheet sync. The same design as Travel's.
 *
 * Paste this whole file into your Sheet's Apps Script editor (Extensions >
 * Apps Script), change SECRET below, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Paste the web app link and the
 * secret into Fitness. Full steps: fitness/README.md, "Google Sheet sync".
 *
 * What it keeps in the Sheet:
 *   _logs, _exercises, _meds, _doses, _steps, _deleted
 *                                  hidden tabs the app reads back from
 *                                  (one row per item, as JSON)
 *   Workouts                       every exercise logged, newest first
 *   Meds                           every dose ticked off, newest first
 *   Med list                       what you take, and when
 *   Steps                          each day's steps, newest first
 * The readable tabs are rebuilt on every change, so change things in the
 * app, not there. The phone keeps only the last 30 days of doses and steps
 * once this Sheet holds them; this Sheet keeps them all.
 *
 * VERSION 2 added Meds and Steps. A phone talking to a VERSION 1 script keeps
 * them to itself and says to paste this one in and deploy a new version.
 *
 * How changes merge: every logged exercise (and every exercise you typed
 * in) carries the time it was last changed; the newest version wins.
 * Deleted items are kept as a short record in _deleted so the other phone
 * deletes them too.
 */

const SECRET = 'CHANGE-ME';   // <- replace with your own long phrase, e.g. 'maple-otter-47-lantern-quiet'

const APP = 'allison-fitness-sync', VERSION = 2;
const DATA = {logs: '_logs', exercises: '_exercises', meds: '_meds', doses: '_doses', steps: '_steps'};
const GRAVES = '_deleted';
const KEEP_DELETED_DAYS = 400;   // long enough that a phone left unopened for a year still hears of a deletion
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
      logs: Array.from(db.logs.values()), exercises: Array.from(db.exercises.values()),
      meds: Array.from(db.meds.values()), doses: Array.from(db.doses.values()), steps: Array.from(db.steps.values()),
      graves: Object.fromEntries(db.graves)
    });
  } finally {
    lock.releaseLock();
  }
}

// A "Fitness" menu in the Sheet, to rebuild the readable tabs by hand.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Fitness').addItem('Rebuild the tabs', 'rebuildTabs').addToUi();
}
function rebuildTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  views(ss, load(ss));
}

// ---------- reading and writing the hidden data tabs ----------

function load(ss) {
  const db = {graves: new Map()};
  Object.keys(DATA).forEach(kind => { db[kind] = new Map(); });
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

// ---------- the readable tab ----------

const GROUP_NAMES = {chest: 'Chest', back: 'Back', lowerback: 'Lower back', shoulders: 'Shoulders', arms: 'Arms', core: 'Core', legs: 'Legs', glutes: 'Glutes', cardio: 'Cardio'};

function views(ss, db) {
  const list = Array.from(db.logs.values())
    .filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || '')))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (Number(a.updated) || 0) - (Number(b.updated) || 0));
  const header = ['Date', 'Day', 'Muscle group', 'Exercise', 'Sets', 'Reps', 'Seconds', 'Weight (lb)', 'Volume (lb)', 'Minutes', 'Distance', 'Unit'];
  const body = list.map(x => {
    const d = new Date(x.date + 'T12:00:00Z'), w = Number(x.weight) || 0, reps = Number(x.reps) || 0, sets = Number(x.sets) || 0;
    const day = [x.date, Utilities.formatDate(d, 'UTC', 'EEE'), GROUP_NAMES[x.group] || 'Other', String(x.exercise || '')];
    // Cardio: minutes and a distance, in place of sets, reps and weight.
    if (x.cardio) return day.concat(['', '', '', '', '', Number(x.mins) || 0, Number(x.dist) > 0 ? Number(x.dist) : '', Number(x.dist) > 0 ? String(x.unit || 'mi') : '']);
    return day.concat([sets, x.timed ? '' : reps, x.timed ? reps : '', w ? w : 'Bodyweight', !x.timed && w ? w * reps * sets : '', '', '', '']);
  });
  const sh = ss.getSheetByName('Workouts') || ss.insertSheet('Workouts');
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (body.length) sh.getRange(2, 1, body.length, header.length).setValues(asTextRows(body));
  sh.setFrozenRows(1);
  sh.setColumnWidth(4, 240);
  medViews(ss, db);
  ss.getSheets().forEach(s => {
    const n = s.getName();
    if ((n === 'Sheet1' || n === 'Sheet 1') && s.getLastRow() === 0) ss.deleteSheet(s);
  });
}

// ---------- Meds and Steps, readable ----------

const SLOT_NAMES = {am: 'Morning', mid: 'Midday', pm: 'Evening', bed: 'Bedtime', day: 'Once a day', prn: 'As needed'};
const KIND_NAMES = {med: 'Medication', supp: 'Supplement'};
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const dayName = s => Utilities.formatDate(new Date(s + 'T12:00:00Z'), 'UTC', 'EEE');

function table(ss, name, header, body, wide) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (body.length) sh.getRange(2, 1, body.length, header.length).setValues(asTextRows(body));
  sh.setFrozenRows(1);
  if (wide) sh.setColumnWidth(wide, 200);
}

function medViews(ss, db) {
  const meds = Array.from(db.meds.values()).filter(m => m && m.name);
  const byId = new Map(meds.map(m => [m.id, m]));
  if (!meds.length && !db.doses.size && !db.steps.size) return;   // nothing yet: no empty tabs
  const tz = ss.getSpreadsheetTimeZone();
  const doses = Array.from(db.doses.values()).filter(x => x && isDay(x.date))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (Number(b.at) || 0) - (Number(a.at) || 0));
  table(ss, 'Meds', ['Date', 'Day', 'Time', 'Name', 'Dose', 'Type', 'When'], doses.map(x => {
    const m = byId.get(x.med) || {};
    return [x.date, dayName(x.date), Number(x.at) > 0 ? Utilities.formatDate(new Date(Number(x.at)), tz, 'h:mm a') : '',
      String(m.name || x.name || ''), String(m.dose || ''), KIND_NAMES[m.kind] || '', SLOT_NAMES[x.slot] || ''];
  }), 4);
  table(ss, 'Med list', ['Name', 'Dose', 'Type', 'When', 'Days', 'Status', 'Since'], meds.sort((a, b) => String(a.name).localeCompare(String(b.name))).map(m => [
    String(m.name), String(m.dose || ''), KIND_NAMES[m.kind] || '',
    m.prn ? 'As needed' : (Array.isArray(m.slots) && m.slots.length ? m.slots.map(k => SLOT_NAMES[k] || k).join(', ') : 'Once a day'),
    m.prn || !Array.isArray(m.days) || !m.days.length || m.days.length === 7 ? 'Every day' : m.days.map(i => WEEKDAYS[i]).join(', '),
    m.paused ? 'Paused' : 'Taking', isDay(m.since) ? m.since : ''
  ]), 1);
  const steps = Array.from(db.steps.values()).filter(x => x && isDay(x.date)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  table(ss, 'Steps', ['Date', 'Day', 'Steps', 'From'], steps.map(x => [x.date, dayName(x.date), Number(x.n) || 0, x.src === 'ha' ? 'iPhone' : 'Typed in']));
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
