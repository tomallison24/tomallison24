/**
 * Allison OS Podcasts -> Google Sheet. A readable backup of your shows, saved
 * episodes and listening history, one way: the app writes, nothing is read
 * back, so edit nothing here.
 *
 * Paste this whole file into your Sheet's Apps Script editor (Extensions >
 * Apps Script), change SECRET below, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Paste the web app link and the
 * secret into Podcasts. Full steps: podcasts/README.md, "Google Sheet backup".
 *
 * What it keeps in the Sheet:
 *   Shows     every show ever followed, with whether you still follow it
 *   Saved     every episode ever saved, with whether it is still saved
 *   History   every episode you have played, newest first. Never trimmed:
 *             the app keeps only its last 100, the Sheet keeps them all.
 *   _shows, _saved, _history   hidden tabs the readable tabs are built from
 *
 * Several phones can back up to one Sheet: each phone says what it follows
 * and has saved, and the Sheet adds them together. A show counts as followed
 * while any phone still follows it; when the phone that followed it stops, it
 * reads "No". Nothing is ever removed.
 */

const SECRET = 'CHANGE-ME';   // <- replace with your own long phrase, e.g. 'maple-otter-47-lantern-quiet'

const APP = 'allison-podcasts-sync', VERSION = 1;
const KINDS = {shows: '_shows', saved: '_saved', hist: '_history'};
const CHUNK = 45000;          // a Sheet cell holds up to 50,000 characters
const MAX_EACH = 4000;

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
    const changed = req.action === 'sync' ? merge(db, req) : false;
    if (changed || req.action === 'rebuild') { store(ss, db); views(ss, db); }
    return out({ok: true, app: APP, v: VERSION, at: Date.now(), shows: db.shows.size, saved: db.saved.size, history: db.hist.size});
  } finally {
    lock.releaseLock();
  }
}

// A "Podcasts" menu in the Sheet, to rebuild the readable tabs by hand.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Podcasts').addItem('Rebuild tabs', 'rebuildTabs').addToUi();
}
function rebuildTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  views(ss, load(ss));
}

// ---------- reading and writing the hidden data tabs ----------

function load(ss) {
  const db = {shows: new Map(), saved: new Map(), hist: new Map()};
  Object.keys(KINDS).forEach(kind => {
    rows(ss, KINDS[kind]).forEach(r => {
      const id = String(r[0] || ''); if (!id) return;
      try { db[kind].set(id, JSON.parse(r.slice(2).join(''))); } catch (err) { /* skip a damaged row */ }
    });
  });
  return db;
}

function rows(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1);
}

function store(ss, db) {
  Object.keys(KINDS).forEach(kind => {
    const list = Array.from(db[kind].entries()).map(([id, it]) => {
      const json = JSON.stringify(it), parts = [];
      for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
      return [id, Number(it.first) || 0].concat(parts);
    });
    const width = Math.max(3, ...list.map(r => r.length));
    const header = ['id', 'since', 'data'].concat(Array(width - 3).fill('data (continued)'));
    write(ss, KINDS[kind], [header].concat(list.map(r => r.concat(Array(width - r.length).fill('')))), true);
  });
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

const str = (v, n) => String(v == null ? '' : v).slice(0, n || 300);
const num = v => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0; };
const web = v => /^https?:\/\//i.test(String(v || '')) ? String(v).slice(0, 500) : '';

// dev: this phone. Each item keeps, per phone, when that phone last had it (0 once it stopped having it).
function merge(db, req) {
  const dev = str(req.device, 40) || 'phone', now = Date.now();
  let changed = false;
  const bump = (map, key, make) => {
    const cur = map.get(key);
    const next = make(cur);
    if (JSON.stringify(cur) !== JSON.stringify(next)) { map.set(key, next); changed = true; }
  };
  // when this phone started having the item (kept while it still does, so a repeat backup changes nothing); 0 once it stopped
  const mine = (it, on) => { const d = Object.assign({}, it && it.dev); d[dev] = on ? d[dev] || now : 0; return d; };

  // shows: followed by this phone now; ones this phone followed before and doesn't now are marked unfollowed here
  const follows = (Array.isArray(req.follows) ? req.follows : []).slice(0, MAX_EACH).filter(f => f && typeof f.id === 'string' && f.id);
  const sentShows = new Set(follows.map(f => f.id));
  follows.forEach(f => bump(db.shows, f.id, cur => ({
    id: f.id, feed: web(f.feed) || (cur && cur.feed) || '', title: str(f.title, 200) || (cur && cur.title) || '', author: str(f.author, 120) || (cur && cur.author) || '',
    genre: str(f.genre, 60) || (cur && cur.genre) || '', first: (cur && cur.first) || num(f.at) || now, dev: mine(cur, true)
  })));
  db.shows.forEach((it, id) => { if (!sentShows.has(id) && it.dev && it.dev[dev]) { it.dev = mine(it, false); changed = true; } });

  // saved episodes, the same way
  const saved = (Array.isArray(req.saved) ? req.saved : []).slice(0, MAX_EACH).filter(e => e && typeof e.k === 'string' && e.k);
  const sentSaved = new Set(saved.map(e => e.k));
  saved.forEach(e => bump(db.saved, e.k, cur => Object.assign(episode(e, cur), {first: (cur && cur.first) || now, dev: mine(cur, true)})));
  db.saved.forEach((it, k) => { if (!sentSaved.has(k) && it.dev && it.dev[dev]) { it.dev = mine(it, false); changed = true; } });

  // history: only ever added to. A later play of the same episode moves its time on.
  (Array.isArray(req.hist) ? req.hist : []).slice(0, MAX_EACH).filter(e => e && typeof e.k === 'string' && e.k).forEach(e => {
    const cur = db.hist.get(e.k), played = num(e.played) || now;
    const next = Object.assign(episode(e, cur), {played: Math.max(played, (cur && cur.played) || 0), first: (cur && cur.first) || played});
    if (!cur || cur.played !== next.played || cur.title !== next.title || cur.show !== next.show) { db.hist.set(e.k, next); changed = true; }
  });
  return changed;
}

function episode(e, cur) {
  return {
    k: e.k, show: str(e.show, 200) || (cur && cur.show) || '', title: str(e.title || e.t, 300) || (cur && cur.title) || '', pub: num(e.pub || e.d) || (cur && cur.pub) || 0,
    dur: num(e.dur) || (cur && cur.dur) || 0, link: web(e.link) || (cur && cur.link) || '', url: web(e.url || e.u) || (cur && cur.url) || '', feed: web(e.feed) || (cur && cur.feed) || ''
  };
}

// ---------- the readable tabs ----------

function views(ss, db) {
  const tz = ss.getSpreadsheetTimeZone();
  const day = ms => ms ? Utilities.formatDate(new Date(ms), tz, 'yyyy-MM-dd') : '';
  const when = ms => ms ? Utilities.formatDate(new Date(ms), tz, 'yyyy-MM-dd HH:mm') : '';
  const length = sec => { if (!sec) return ''; const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return h ? h + ':' + String(m).padStart(2, '0') : m + ' min'; };
  const following = it => Object.keys(it.dev || {}).some(d => it.dev[d]);

  const shows = Array.from(db.shows.values()).sort((a, b) => (following(b) - following(a)) || a.title.localeCompare(b.title));
  fill(ss, 'Shows', ['Show', 'Author', 'Genre', 'Following', 'Feed link', 'First followed'],
    shows.map(x => [x.title, x.author, x.genre, following(x) ? 'Yes' : 'No', x.feed, day(x.first)]), {1: 280, 2: 180, 5: 300});

  const saved = Array.from(db.saved.values()).sort((a, b) => (following(b) - following(a)) || (b.first || 0) - (a.first || 0));
  fill(ss, 'Saved', ['Show', 'Episode', 'Published', 'Length', 'Saved', 'First saved', 'Episode page', 'Audio link'],
    saved.map(x => [x.show, x.title, day(x.pub), length(x.dur), following(x) ? 'Yes' : 'No', day(x.first), x.link, x.url]), {1: 220, 2: 380, 7: 240, 8: 240});

  const hist = Array.from(db.hist.values()).sort((a, b) => (b.played || 0) - (a.played || 0));
  fill(ss, 'History', ['Played', 'Show', 'Episode', 'Published', 'Length', 'Episode page', 'EpisodeID'],
    hist.map(x => [when(x.played), x.show, x.title, day(x.pub), length(x.dur), x.link, x.k]), {1: 130, 2: 220, 3: 380, 6: 240});

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
