/**
 * Allison OS Podcasts <-> Google Sheet sync. The same design as Fitness's.
 *
 * One Sheet for the whole family, the record of everyone's Podcasts: the
 * shows each person follows, the episodes they saved, what they played and
 * where they got to. Each row belongs to its person, and each person's phone
 * only ever gets their own (aOS/SHEETS.md). Phones don't talk to it directly:
 * every request comes through aOS (functions/sheet/api), signed in with Face
 * ID, which adds this script's SECRET and who's asking. So only aOS knows the
 * phrase, and a phone can't ask for anyone else's rows.
 *
 * Paste this whole file into your Sheet's Apps Script editor (Extensions >
 * Apps Script), change SECRET below, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone), or Manage deployments > New
 * version if it's deployed already. Then in aOS: Account > Google Sheets >
 * Podcasts, give it the phrase. Full steps: aOS/SHEETS.md.
 *
 * What it keeps in the Sheet:
 *   _shows, _saved, _history, _progress, _deleted, _people
 *             hidden tabs the app reads back from (one row per item, as
 *             JSON, with whose it is)
 *   Shows     the shows each person follows, with Who
 *   Saved     each person's saved episodes, newest first, with Who
 *   History   every episode played, newest first, with Who and where they
 *             got to. Each phone keeps the last 90 days (at most its last
 *             100) and asks here for older ones; this Sheet keeps them all.
 * The readable tabs are rebuilt on every change, so change things in the
 * app, not there.
 *
 * VERSION 1 was a one-way backup that added several phones together; VERSION
 * 2, one Sheet for the family through aOS, two-way (who, by, the Who column,
 * the 90 days and older on asking). A VERSION 1 Sheet's rows are the owner's:
 * the shows and saved episodes some phone still had, and every History row.
 *
 * How changes merge: every show, saved episode, play and bit of progress
 * carries the time it was last changed; the newest version wins. Deleted
 * items (an unfollow, an episode unsaved, History cleared) are kept as a
 * short record in _deleted so your other phones delete them too.
 *
 * Unlike Fitness's, Podcasts' ids are the same for everyone (a show's comes
 * from its feed, an episode's from the show and the feed's own id), so two
 * people can follow the same show. Each person's rows are kept apart (by
 * whose they are, then the id; the id column reads who/id), and a phone only
 * ever changes or deletes its own person's.
 */

const SECRET = 'CHANGE-ME';   // <- replace with your own long phrase, e.g. 'maple-otter-47-lantern-quiet'

const APP = 'allison-podcasts-sync', VERSION = 2;
const DATA = {shows: '_shows', saved: '_saved', hist: '_history', prog: '_progress'};
const DATED = {hist: 'date', prog: 'date'};   // what's kept on the phone by its day: the last 90
const MODE = 'personal';   // each person's own rows only (Notes and Travel are 'family': shared, with "Just me" items)
const GRAVES = '_deleted', PEOPLE = '_people';
const KEEP_DELETED_DAYS = 400;   // long enough that a phone left unopened for a year still hears of a deletion
const CHUNK = 45000;             // a Sheet cell holds up to 50,000 characters
const MAX_EACH = 5000;           // items of a kind taken from one request

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
// Each kind is kept person by person (by, or '' for rows from before by was kept), then by id.
function bucket(db, kind, who) { if (!db[kind].has(who)) db[kind].set(who, new Map()); return db[kind].get(who); }
function all(db, kind) { const out = []; db[kind].forEach(m => m.forEach(it => out.push(it))); return out; }
const gkey = (who, item) => who + '\n' + item;   // a grave: whose, and kind:id
function cutoff(today, days) { return new Date(Date.parse(today + 'T00:00:00Z') - (days - 1) * 864e5).toISOString().slice(0, 10); }

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ok: false, error: 'bad-request'}); }
  const c = caller(e);
  if (c.error) return out({ok: false, app: APP, aos: true, error: c.error});
  if (!req || typeof req !== 'object') return out({ok: false, error: 'bad-request'});
  if (req.action === 'ping') return out({ok: true, app: APP, v: VERSION, aos: true});
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return out({ok: false, error: 'busy'});
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const db = load(ss);
    let changed = meet(db, c) || db.legacy;
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
      res[kind] = all(db, kind).filter(it => canSee(it, c, db)
        && (!f || (range ? it[f] >= range.from && it[f] <= range.to : !cut || String(it[f] || '') >= cut)));
    });
    if (!range) {
      res.graves = {};
      db.graves.forEach(g => { if ((g.by || db.owner) === c.who) res.graves[g.item] = g.t; });
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
  if (c.owner) Object.keys(DATA).forEach(kind => {
    const old = db[kind].get('');
    if (!old) return;
    const mine = bucket(db, kind, c.who);
    old.forEach((it, id) => { it.by = c.who; const cur = mine.get(id); if (!cur || (Number(it.updated) || 0) > (Number(cur.updated) || 0)) mine.set(id, it); });
    db[kind].delete('');
    changed = true;
  });
  return changed;
}
const whoName = (it, db) => db.people[ownerOf(it, db)] || '';

// A "Podcasts" menu in the Sheet, to rebuild the readable tabs by hand.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Podcasts').addItem('Rebuild the tabs', 'rebuildTabs').addToUi();
}
function rebuildTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  views(ss, load(ss));
}

// ---------- reading and writing the hidden data tabs ----------

function load(ss) {
  const db = {graves: new Map(), people: {}, owner: '', legacy: false};
  const tz = ss.getSpreadsheetTimeZone();
  Object.keys(DATA).forEach(kind => { db[kind] = new Map(); });
  Object.keys(DATA).forEach(kind => {
    rows(ss, DATA[kind]).forEach(r => {
      const col = String(r[0] || ''); if (!col) return;
      let it;
      try { it = JSON.parse(r.slice(2).join('')); } catch (err) { return; }   // skip a damaged row
      if (!it || typeof it !== 'object') return;
      if (it.updated === undefined) { it = fromV1(kind, col, it, tz); db.legacy = true; }   // written down in the new shape at the next change
      if (it && typeof it.id === 'string' && it.id) bucket(db, kind, String(it.by || '')).set(it.id, it);
    });
  });
  rows(ss, GRAVES).forEach(r => { const item = String(r[0] || ''), by = String(r[2] || ''); if (item) db.graves.set(gkey(by, item), {item: item, t: Number(r[1]) || 0, by: by}); });
  rows(ss, PEOPLE).forEach(r => { const id = String(r[0] || ''); if (id === '(owner)') db.owner = String(r[1] || ''); else if (id) db.people[id] = String(r[1] || ''); });
  return db;
}

// A VERSION 1 row (the one-way backup, which added phones together): in the shape the app keeps.
// A show or saved episode no phone had any more is left out; every History row is kept. Stamped
// updated 0, so any phone's own copy wins over it.
function fromV1(kind, id, it, tz) {
  const had = Object.keys(it.dev || {}).some(d => it.dev[d]);
  if (kind === 'shows') return had ? {id: id, feed: it.feed || '', title: it.title || '', author: it.author || '', art: '', genre: it.genre || '', at: Number(it.first) || 0, updated: 0} : null;
  if (kind === 'prog') return null;
  const ep = {id: id, k: id, sid: id.split('|')[0], t: it.title || '', d: Number(it.pub) || 0, u: it.url || '', v: false, dur: Number(it.dur) || 0, img: '', st: it.show || '', sa: '',
    feed: it.feed || '', link: it.link || '', s: '', sn: 0, en: 0, x: '', updated: 0};
  if (kind === 'saved') return had ? Object.assign(ep, {at: Number(it.first) || 0}) : null;
  const pl = Number(it.played) || Number(it.first) || 0;
  return Object.assign(ep, {pl: pl, date: pl ? Utilities.formatDate(new Date(pl), tz, 'yyyy-MM-dd') : ''});
}

function rows(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1);
}

function store(ss, db) {
  Object.keys(DATA).forEach(kind => {
    const list = all(db, kind).map(it => {
      const json = JSON.stringify(it), parts = [];
      for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
      return [(it.by ? it.by + '/' : '') + it.id, Number(it.updated) || 0].concat(parts);
    });
    const width = Math.max(3, ...list.map(r => r.length));
    const header = ['id', 'updated', 'data'].concat(Array(width - 3).fill('data (continued)'));
    write(ss, DATA[kind], [header].concat(list.map(r => r.concat(Array(width - r.length).fill('')))), true);
  });
  const g = Array.from(db.graves.values()).map(x => [x.item, x.t, x.by || '']);
  write(ss, GRAVES, [['item', 'deleted', 'by']].concat(g), true);
  const p = Object.keys(db.people).map(id => [id, db.people[id]]);
  write(ss, PEOPLE, [['id', 'name'], ['(owner)', db.owner]].concat(p), true);
}

// Text a cell would otherwise read as a formula (=, +, -, @) is kept as text.
// Show and episode names come from podcast feeds, which anyone can write.
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

// What a phone sent, from the person who sent it: their own items only, each kept as theirs (by).
// Someone else's, even with the same id (the same show), is never changed or deleted from another's
// phone: theirs are kept apart.
function merge(db, req, c) {
  let changed = false;
  const now = Date.now();
  Object.keys(req.graves && typeof req.graves === 'object' ? req.graves : {}).forEach(k => {
    const t = Number(req.graves[k]) || 0, kind = k.slice(0, k.indexOf(':'));
    if (!DATA[kind] || k.length > 1100) return;
    const gk = gkey(c.who, k), g = db.graves.get(gk);
    if (!g || g.t < t) { db.graves.set(gk, {item: k, t: t, by: c.who}); changed = true; }
  });
  Object.keys(DATA).forEach(kind => {
    const mine = bucket(db, kind, c.who);
    (Array.isArray(req[kind]) ? req[kind] : []).slice(0, MAX_EACH).forEach(item => {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || item.id.length > 1000) return;
      const u = Number(item.updated) || 0, gk = gkey(c.who, kind + ':' + item.id);
      const cur = mine.get(item.id), g = db.graves.get(gk), gone = g ? g.t : 0;
      item.by = c.who;
      if (gone && gone >= u) return;                       // deleted after this change
      if (!cur || u > (Number(cur.updated) || 0)) { mine.set(item.id, item); changed = true; }
      if (gone && u > gone) { db.graves.delete(gk); changed = true; }   // brought back (Undo, or followed again)
    });
  });
  db.graves.forEach((g, gk) => {
    const i = g.item.indexOf(':'), kind = g.item.slice(0, i), id = g.item.slice(i + 1);
    const m = db[kind] && db[kind].get(g.by || db.owner), cur = m && m.get(id);
    if (cur && (Number(cur.updated) || 0) <= g.t) { m.delete(id); changed = true; }
    if (now - g.t > KEEP_DELETED_DAYS * 864e5) { db.graves.delete(gk); changed = true; }
  });
  return changed;
}

// ---------- the readable tabs ----------

const str = v => String(v == null ? '' : v);
const web = v => /^https?:\/\//i.test(str(v)) ? str(v).slice(0, 500) : '';   // only web links: never a javascript: one from a feed

function views(ss, db) {
  const tz = ss.getSpreadsheetTimeZone();
  const day = ms => Number(ms) > 0 ? Utilities.formatDate(new Date(Number(ms)), tz, 'yyyy-MM-dd') : '';
  const when = ms => Number(ms) > 0 ? Utilities.formatDate(new Date(Number(ms)), tz, 'yyyy-MM-dd HH:mm') : '';
  const length = sec => { sec = Number(sec) || 0; if (!sec) return ''; const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return h ? h + ':' + String(m).padStart(2, '0') : m + ' min'; };
  const clock = sec => { sec = Math.max(0, Math.floor(Number(sec) || 0)); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = String(sec % 60).padStart(2, '0'); return h ? h + ':' + String(m).padStart(2, '0') + ':' + s : m + ':' + s; };
  const byWho = (a, b) => whoName(a, db).localeCompare(whoName(b, db));

  const shows = all(db, 'shows').sort((a, b) => byWho(a, b) || str(a.title).localeCompare(str(b.title)));
  fill(ss, 'Shows', ['Who', 'Show', 'Author', 'Genre', 'Following since', 'Feed link'],
    shows.map(x => [whoName(x, db), str(x.title), str(x.author), str(x.genre), day(x.at), web(x.feed)]), {2: 280, 3: 180, 6: 300});

  const saved = all(db, 'saved').sort((a, b) => byWho(a, b) || (Number(b.at) || 0) - (Number(a.at) || 0));
  fill(ss, 'Saved', ['Who', 'Show', 'Episode', 'Published', 'Length', 'Saved', 'Episode page', 'Audio link'],
    saved.map(x => [whoName(x, db), str(x.st), str(x.t), day(x.d), length(x.dur), day(x.at), web(x.link), web(x.u)]), {2: 220, 3: 380, 7: 240, 8: 240});

  // where each person got to in each episode (their own progress for it)
  const got = it => {
    const m = db.prog.get(it.by || ''), p = m && m.get(it.id);
    if (!p) return '';
    if (p.p) return 'Finished';
    return Number(p.t) > 0 ? clock(p.t) + (Number(p.d) > 0 ? ' of ' + clock(p.d) : '') : '';
  };
  const hist = all(db, 'hist').sort((a, b) => (Number(b.pl) || 0) - (Number(a.pl) || 0));
  fill(ss, 'History', ['Who', 'Played', 'Show', 'Episode', 'Published', 'Length', 'Where you got to', 'Episode page', 'EpisodeID'],
    hist.map(x => [whoName(x, db), when(x.pl), str(x.st), str(x.t), day(x.d), length(x.dur), got(x), web(x.link), str(x.id)]), {3: 220, 4: 380, 8: 240});

  ss.getSheets().forEach(sh => {
    const n = sh.getName();
    if ((n === 'Sheet1' || n === 'Sheet 1') && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });
}

function fill(ss, name, header, body, widths) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (body.length) sh.getRange(2, 1, body.length, header.length).setValues(asTextRows(body));
  sh.setFrozenRows(1);
  Object.keys(widths).forEach(c => sh.setColumnWidth(Number(c), widths[c]));
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
