/**
 * Allison OS Fitness <-> Google Sheet sync. The same design as Travel's.
 *
 * One Sheet for the whole family, the record of everyone's Fitness: each
 * row belongs to the person who logged it, and each person's phone only ever
 * gets their own (aOS/SHEETS.md). Phones don't talk to it directly: every
 * request comes through aOS (functions/sheet/api), signed in with Face ID,
 * which adds this script's SECRET and who's asking. So only aOS knows the
 * phrase, and a phone can't ask for anyone else's rows.
 *
 * Paste this whole file into your Sheet's Apps Script editor (Extensions >
 * Apps Script), change SECRET below, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone), or Manage deployments > New
 * version if it's deployed already. Then in aOS: Account > Google Sheets >
 * Fitness, give it the phrase. Full steps: aOS/SHEETS.md.
 *
 * What it keeps in the Sheet:
 *   _logs, _exercises, _meds, _doses, _steps, _deleted, _people
 *                                  hidden tabs the app reads back from
 *                                  (one row per item, as JSON, with whose it is)
 *   Workouts                       every exercise logged, newest first, with Who
 *   Meds                           every dose ticked off, newest first, with Who
 *   Med list                       what each person takes, and when
 *   Steps                          each day's steps, newest first, with Who
 * The readable tabs are rebuilt on every change, so change things in the
 * app, not there. Each phone keeps the last 90 days of anything dated and
 * asks here for older days when you look back; this Sheet keeps them all.
 *
 * VERSION 2 added Meds and Steps; VERSION 3, one Sheet for the family
 * through aOS (who, by, the Who column, the 90 days and older on asking).
 *
 * How changes merge: every logged exercise (and every exercise you typed
 * in) carries the time it was last changed; the newest version wins.
 * Deleted items are kept as a short record in _deleted so the other phone
 * deletes them too.
 */

const SECRET = 'CHANGE-ME';   // <- replace with your own long phrase, e.g. 'maple-otter-47-lantern-quiet'

const APP = 'allison-fitness-sync', VERSION = 3;
const DATA = {logs: '_logs', exercises: '_exercises', meds: '_meds', doses: '_doses', steps: '_steps'};
const DATED = {logs: 'date', doses: 'date', steps: 'date'};   // what's kept on the phone by its day: the last 90
// A day's steps have the day as their id, so two people's steps on one day share it: kept here as
// '<who>~<day>', and sent back to each phone by the day alone.
const PER_PERSON = {steps: true};
const MODE = 'personal';   // each person's own rows only (Notes and Travel are 'family': shared, with "Just me" items)
const GRAVES = '_deleted', PEOPLE = '_people';
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
function slot(kind, id, who) { return PER_PERSON[kind] ? who + '~' + id : id; }
function phoneKey(key) { const i = key.indexOf(':'), kind = key.slice(0, i), id = key.slice(i + 1); return PER_PERSON[kind] && id.includes('~') ? kind + ':' + id.slice(id.indexOf('~') + 1) : key; }
// After meet(): the per-person kinds keyed by whose each item is (rows from before, by the day alone).
function rekey(db) {
  Object.keys(PER_PERSON).forEach(kind => {
    const m = new Map();
    db[kind].forEach(it => m.set(slot(kind, it.id, ownerOf(it, db)), it));
    db[kind] = m;
  });
  Array.from(db.graves.keys()).forEach(k => {
    const i = k.indexOf(':'), kind = k.slice(0, i), id = k.slice(i + 1);
    if (PER_PERSON[kind] && !id.includes('~')) { const g = db.graves.get(k); db.graves.delete(k); db.graves.set(kind + ':' + slot(kind, id, g.by || db.owner), g); }
  });
}
function cutoff(today, days) { return new Date(Date.parse(today + 'T00:00:00Z') - (days - 1) * 864e5).toISOString().slice(0, 10); }

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
    rekey(db);
    if (req.action === 'sync') changed = merge(db, req, c) || changed;
    if (changed || req.action === 'rebuild') { store(ss, db); views(ss, db); }
    const res = {ok: true, app: APP, v: VERSION, aos: true, at: Date.now(), by: c.who};
    // a range of days (looking back past what the phone keeps), or everything of yours: the last
    // `window` days of anything dated, and all of the rest
    const range = req.action === 'range' && /^\d{4}-\d{2}-\d{2}$/.test(req.from || '') && /^\d{4}-\d{2}-\d{2}$/.test(req.to || '') ? req : null;
    const cut = !range && req.window && /^\d{4}-\d{2}-\d{2}$/.test(req.today || '') ? cutoff(req.today, Math.max(1, Number(req.window) || 90)) : '';
    Object.keys(DATA).forEach(kind => {
      const f = DATED[kind];
      if (range && !f) return;
      res[kind] = Array.from(db[kind].values()).filter(it => canSee(it, c, db)
        && (!f || (range ? it[f] >= range.from && it[f] <= range.to : !cut || String(it[f] || '') >= cut)));
    });
    if (!range) {
      res.graves = {};
      db.graves.forEach((g, k) => { if (MODE === 'family' || (g.by || db.owner) === c.who) res.graves[phoneKey(k)] = g.t; });
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
    const list = Array.from(db[kind].entries()).map(([id, it]) => {
      const json = JSON.stringify(it), parts = [];
      for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
      return [id, Number(it.updated) || 0].concat(parts);
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
    const t = Number(req.graves[k]) || 0, i = k.indexOf(':'), kind = k.slice(0, i);
    if (!db[kind]) return;
    const id = slot(kind, k.slice(i + 1), c.who), key = kind + ':' + id;
    const cur = db[kind].get(id);
    if (cur && !canSee(cur, c, db)) return;
    const g = db.graves.get(key);
    if (!g || g.t < t) { db.graves.set(key, {t: t, by: cur ? ownerOf(cur, db) : (g && g.by) || c.who}); changed = true; }
  });
  Object.keys(DATA).forEach(kind => {
    (req[kind] || []).forEach(item => {
      if (!item || typeof item.id !== 'string') return;
      const id = slot(kind, item.id, c.who), u = Number(item.updated) || 0, key = kind + ':' + id;
      const cur = db[kind].get(id), g = db.graves.get(key), gone = g ? g.t : 0;
      if (cur && !canSee(cur, c, db)) return;
      item.by = cur ? ownerOf(cur, db) : c.who;
      if (MODE === 'family' && item.by !== c.who) item.only = !!(cur && cur.only);   // only its own person makes it Just me
      if (gone && gone >= u) return;                       // deleted after this change
      if (!cur || u > (Number(cur.updated) || 0)) { db[kind].set(id, item); changed = true; }
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

const GROUP_NAMES = {chest: 'Chest', back: 'Back', lowerback: 'Lower back', shoulders: 'Shoulders', arms: 'Arms', core: 'Core', legs: 'Legs', glutes: 'Glutes', cardio: 'Cardio'};

function views(ss, db) {
  const list = Array.from(db.logs.values())
    .filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || '')))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (Number(a.updated) || 0) - (Number(b.updated) || 0));
  const header = ['Who', 'Date', 'Day', 'Muscle group', 'Exercise', 'Sets', 'Reps', 'Seconds', 'Weight (lb)', 'Volume (lb)', 'Minutes', 'Distance', 'Unit'];
  const body = list.map(x => {
    const d = new Date(x.date + 'T12:00:00Z'), w = Number(x.weight) || 0, reps = Number(x.reps) || 0, sets = Number(x.sets) || 0;
    const day = [whoName(x, db), x.date, Utilities.formatDate(d, 'UTC', 'EEE'), GROUP_NAMES[x.group] || 'Other', String(x.exercise || '')];
    // Cardio: minutes and a distance, in place of sets, reps and weight.
    if (x.cardio) return day.concat(['', '', '', '', '', Number(x.mins) || 0, Number(x.dist) > 0 ? Number(x.dist) : '', Number(x.dist) > 0 ? String(x.unit || 'mi') : '']);
    return day.concat([sets, x.timed ? '' : reps, x.timed ? reps : '', w ? w : 'Bodyweight', !x.timed && w ? w * reps * sets : '', '', '', '']);
  });
  const sh = ss.getSheetByName('Workouts') || ss.insertSheet('Workouts');
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (body.length) sh.getRange(2, 1, body.length, header.length).setValues(asTextRows(body));
  sh.setFrozenRows(1);
  sh.setColumnWidth(5, 240);
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
  table(ss, 'Meds', ['Who', 'Date', 'Day', 'Time', 'Name', 'Dose', 'Type', 'When'], doses.map(x => {
    const m = byId.get(x.med) || {};
    return [whoName(x, db), x.date, dayName(x.date), Number(x.at) > 0 ? Utilities.formatDate(new Date(Number(x.at)), tz, 'h:mm a') : '',
      String(m.name || x.name || ''), String(m.dose || ''), KIND_NAMES[m.kind] || '', SLOT_NAMES[x.slot] || ''];
  }), 5);
  table(ss, 'Med list', ['Who', 'Name', 'Dose', 'Type', 'When', 'Days', 'Status', 'Since'], meds.sort((a, b) => whoName(a, db).localeCompare(whoName(b, db)) || String(a.name).localeCompare(String(b.name))).map(m => [
    whoName(m, db), String(m.name), String(m.dose || ''), KIND_NAMES[m.kind] || '',
    m.prn ? 'As needed' : (Array.isArray(m.slots) && m.slots.length ? m.slots.map(k => SLOT_NAMES[k] || k).join(', ') : 'Once a day'),
    m.prn || !Array.isArray(m.days) || !m.days.length || m.days.length === 7 ? 'Every day' : m.days.map(i => WEEKDAYS[i]).join(', '),
    m.paused ? 'Paused' : 'Taking', isDay(m.since) ? m.since : ''
  ]), 2);
  const steps = Array.from(db.steps.values()).filter(x => x && isDay(x.date)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  table(ss, 'Steps', ['Who', 'Date', 'Day', 'Steps', 'From'], steps.map(x => [whoName(x, db), x.date, dayName(x.date), Number(x.n) || 0, x.src === 'ha' ? 'iPhone' : 'Typed in']));
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
