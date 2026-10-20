/**
 * Allison OS Meals <-> Google Sheet. The same design as Fitness's (aOS/SHEETS.md).
 *
 * One Sheet for the whole family, the record of the family's dinners: every
 * plan ever accepted, the deals of the last weeks, the shopping list and the
 * settings. Meals' working copy is the family's server (functions/meals/api,
 * which Claude plans against and which keeps the last 52 plans); the app copies
 * it here, and reads back from here the plans the server no longer keeps, when
 * you look back past them. Phones don't talk to it directly: every request comes
 * through aOS (functions/sheet/api), signed in with Face ID, which adds this
 * script's SECRET and who's asking. So only aOS knows the phrase.
 *
 * Paste this whole file into your Sheet's Apps Script editor (Extensions >
 * Apps Script), change SECRET below, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone), or Manage deployments > New
 * version if it's deployed already. Then in aOS: Account > Google Sheets >
 * Meals, give it the phrase. Full steps: aOS/SHEETS.md.
 *
 * What it keeps in the Sheet:
 *   Plans          one row per planned night, for EVERY plan ever accepted,
 *                  newest first, with who planned it. A plan is never removed
 *                  (except one taken back with Undo), even after the family
 *                  server drops it from its last 52.
 *   Shopping list  the current plan's list, in the same sections as the app
 *   Deals          each store's sales by week (the last 8 weeks are kept), with Who
 *   Settings       the stores, member cards and foods the family avoids
 *   _plans, _deals, _deleted, _people
 *                  hidden tabs the readable tabs are rebuilt from (one row per
 *                  item, as JSON, with whose it is)
 * The readable tabs are rebuilt from the app's copy, so change things in the
 * app, not there.
 *
 * VERSION 3: one Sheet for the family through aOS (who, by, the Who column,
 * the plans read back: the last 90 days with each copy, older ones on asking).
 *
 * How copies merge: each plan and each store's week of deals is a picture of
 * the family server, stamped (updated) with when the phone last read it from
 * there; the newest picture wins, and the same picture again changes nothing.
 * A plan taken back (Undo of Accept, in Ipsy) is kept as a short record in
 * _deleted, so a phone that still has it doesn't bring it back.
 */

const SECRET = 'CHANGE-ME';   // <- replace with your own long phrase, e.g. 'maple-otter-47-lantern-quiet'

const APP = 'allison-meals-sync', VERSION = 3;
const DATA = {plans: '_plans', deals: '_deals'};
const DATED = {plans: 'start', deals: 'week'};   // by their day: a phone gets the last 90 days of plans, older ones on asking
const ANSWER = ['plans'];   // what a phone reads back. The deals are the family server's (found again each week); their past weeks stay here to read.
const MODE = 'family';      // the family's dinners, shared by everyone (Meals has no "Just me" items)
const GRAVES = '_deleted', PEOPLE = '_people';
const KEEP_DEAL_WEEKS = 8;
const KEEP_DELETED_DAYS = 400;
const CHUNK = 45000;          // a Sheet cell holds up to 50,000 characters
const CELL = 45000;
const MAX_PLANS = 600, MAX_DEAL_ROWS = 4000;

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
const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

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
    let changed = meet(db, c);
    if (req.action === 'sync') changed = merge(db, req, c) || changed;
    if (changed) store(ss, db);
    if (req.action === 'sync' || req.action === 'rebuild') views(ss, db, req, changed || req.action === 'rebuild');
    const res = {ok: true, app: APP, v: VERSION, aos: true, at: Date.now(), by: c.who};
    // a range of days (looking back past what the phone has), or the last `window` days of plans
    const range = req.action === 'range' && isDay(req.from) && isDay(req.to) ? req : null;
    const cut = !range && req.window && isDay(req.today) ? cutoff(req.today, Math.max(1, Number(req.window) || 90)) : '';
    ANSWER.forEach(kind => {
      const f = DATED[kind];
      res[kind] = Array.from(db[kind].values()).filter(it => canSee(it, c, db)
        && (!f || (range ? it[f] >= range.from && it[f] <= range.to : !cut || String(it[f] || '') >= cut)));
    });
    if (!range) {
      res.graves = {};
      db.graves.forEach((g, k) => { if (MODE === 'family' || (g.by || db.owner) === c.who) res.graves[k] = g.t; });
      // every plan the Sheet holds, by id: the phone sends only the ones it doesn't
      res.planIds = Array.from(db.plans.values()).filter(it => canSee(it, c, db)).map(it => it.id);
      res.counts = {plans: db.plans.size, deals: db.deals.size};
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
const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
// Who planned it: the person the family server says accepted it (from their own sign-in), else whose row it is.
const plannedBy = (p, db) => firstName(p.planner) || whoName(p, db);

// A "Meals" menu in the Sheet, to rebuild the readable tabs by hand.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Meals').addItem('Rebuild the tabs', 'rebuildTabs').addToUi();
}
function rebuildTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  views(ss, load(ss), null, true);
}

// ---------- reading and writing the hidden data tabs ----------

function load(ss) {
  const db = {graves: new Map(), people: {}, owner: ''};
  Object.keys(DATA).forEach(kind => {
    db[kind] = new Map();
    rows(ss, DATA[kind]).forEach(r => {
      const id = String(r[0] || ''); if (!id) return;
      try { db[kind].set(id, fromV1(kind, JSON.parse(r.slice(2).join('')), r[1])); } catch (err) { /* skip a damaged row */ }
    });
  });
  rows(ss, GRAVES).forEach(r => { const k = String(r[0] || ''); if (k) db.graves.set(k, {t: Number(r[1]) || 0, by: String(r[2] || '')}); });
  rows(ss, PEOPLE).forEach(r => { const id = String(r[0] || ''); if (id === '(owner)') db.owner = String(r[1] || ''); else if (id) db.people[id] = String(r[1] || ''); });
  return db;
}
// A row from VERSION 1 (before aOS): its by was the planner's name, and its shop the store's name. Its
// planner is kept as that name; whose row it is (by) the owner's, from their first sync (meet).
function fromV1(kind, it, saved) {
  if (!it || typeof it !== 'object') return it;
  if (kind === 'plans' && !('planner' in it)) {
    it.planner = String(it.by || ''); delete it.by;
    it.shopName = String(it.shop || ''); it.shop = '';
  }
  if (!it.updated) it.updated = Number(it.at) || Number(saved) || 0;
  return it;
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

const s = (v, n) => String(v == null ? '' : v).slice(0, n || 300);
const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };

// A plan is kept as sent, trimmed to what is shown (and what the app needs to show it again).
function cleanPlan(p) {
  if (!p || typeof p.id !== 'string' || !p.id || p.id.length > 60 || !Array.isArray(p.meals)) return null;
  const at = num(p.acceptedAt) || num(p.at);
  return {
    id: p.id, at: at, updated: num(p.updated) || at, start: s(p.start, 10), planner: s(p.acceptedBy || p.planner, 60), meat: s(p.meat, 40),
    shop: s(p.shop, 40), shopName: s(p.shopName, 60), people: num(p.people), tip: s(p.tip, 300), dates: (Array.isArray(p.dates) ? p.dates : []).map(d => s(d, 10)).slice(0, 14),
    meals: p.meals.slice(0, 14).map((m, i) => m && {
      day: num(m.day) || i + 1, title: s(m.title, 120), cuisine: s(m.cuisine, 40), method: s(m.method, 40), minutes: num(m.minutes), why: s(m.why, 240),
      uses: (Array.isArray(m.uses) ? m.uses : []).map(u => s(u, 80)).slice(0, 10),
      ingredients: (Array.isArray(m.ingredients) ? m.ingredients : []).slice(0, 40).map(x => x && {item: s(x.item, 80), qty: s(x.qty, 40), pantry: !!x.pantry}).filter(x => x && x.item),
      steps: (Array.isArray(m.steps) ? m.steps : []).map(t => s(t, 500)).slice(0, 14)
    }).filter(m => m && m.title)
  };
}

function cleanDeal(d) {
  if (!d || !d.store || !d.week) return null;
  const at = num(d.at) || Date.now();
  return {
    id: s(d.week, 10) + '|' + s(d.store, 40), at: at, updated: num(d.updated) || at, store: s(d.store, 40), week: s(d.week, 10), from: s(d.validFrom, 10), to: s(d.validTo, 10),
    items: (Array.isArray(d.items) ? d.items : []).slice(0, 150).map(x => x && {name: s(x.name, 100), price: s(x.price, 40), regular: s(x.regular, 40), member: !!x.member, note: s(x.note, 120)}).filter(x => x && x.name)
  };
}
const CLEAN = {plans: cleanPlan, deals: cleanDeal};
const LIMIT = {plans: MAX_PLANS, deals: 40};
// the same picture, whenever and by whoever it was sent
const sameAs = (a, b) => { const k = x => JSON.stringify(Object.assign({}, x, {updated: 0, by: ''})); return k(a) === k(b); };

// What a phone sent, from the person who sent it. A new plan or week of deals is theirs (by); one
// already here keeps its by. Meals' items are never "Just me" (cleanPlan and cleanDeal keep no only).
function merge(db, req, c) {
  let changed = false;
  const now = Date.now();
  Object.keys(req.graves || {}).forEach(k => {
    const t = Number(req.graves[k]) || 0, i = k.indexOf(':'), kind = k.slice(0, i);
    if (!DATA[kind] || !t) return;
    const cur = db[kind].get(k.slice(i + 1));
    if (cur && !canSee(cur, c, db)) return;
    const g = db.graves.get(k);
    if (!g || g.t < t) { db.graves.set(k, {t: t, by: cur ? ownerOf(cur, db) : (g && g.by) || c.who}); changed = true; }
  });
  Object.keys(DATA).forEach(kind => {
    (Array.isArray(req[kind]) ? req[kind] : []).slice(0, LIMIT[kind]).forEach(raw => {
      const item = CLEAN[kind](raw);
      if (!item || (kind === 'deals' && !item.items.length)) return;
      const u = Number(item.updated) || 0, key = kind + ':' + item.id;
      const cur = db[kind].get(item.id), g = db.graves.get(key), gone = g ? g.t : 0;
      if (cur && !canSee(cur, c, db)) return;
      item.by = cur ? ownerOf(cur, db) : c.who;
      if (gone && gone >= u) return;                       // taken back after this copy was read
      if (!cur || (u > (Number(cur.updated) || 0) && !sameAs(cur, item))) { db[kind].set(item.id, item); changed = true; }
      if (gone && u > gone) { db.graves.delete(key); changed = true; }
    });
  });
  db.graves.forEach((g, key) => {
    const i = key.indexOf(':'), kind = key.slice(0, i), id = key.slice(i + 1);
    const cur = db[kind] && db[kind].get(id);
    if (cur && (Number(cur.updated) || 0) <= g.t) { db[kind].delete(id); changed = true; }
    if (now - g.t > KEEP_DELETED_DAYS * 864e5) { db.graves.delete(key); changed = true; }
  });
  // only the newest weeks of deals are kept
  const weeks = Array.from(new Set(Array.from(db.deals.values()).map(d => d.week))).sort().reverse();
  const keep = new Set(weeks.slice(0, KEEP_DEAL_WEEKS));
  db.deals.forEach((d, id) => { if (!keep.has(d.week)) { db.deals.delete(id); changed = true; } });
  return changed;
}

// ---------- the readable tabs ----------

function views(ss, db, req, all) {
  if (all) { planTab(ss, db); dealsTab(ss, db); }
  // These two are a picture of the moment the phone last sent, not a history.
  if (req && req.shopping) shoppingTab(ss, req.shopping);
  if (req && req.settings) settingsTab(ss, req.settings);
  ss.getSheets().forEach(sh => {
    const n = sh.getName();
    if ((n === 'Sheet1' || n === 'Sheet 1') && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });
}

// Planned by is the Plans tab's Who column.
function planTab(ss, db) {
  const header = ['Planned by', 'Accepted', 'Plan', 'Night', 'Date', 'Dinner', 'Cuisine', 'Method', 'Minutes', 'Store', 'People', 'Why', 'Uses (on sale)', 'Ingredients', 'Steps', 'Tip', 'PlanID'];
  const day = ms => ms ? Utilities.formatDate(new Date(ms), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : '';
  const plans = Array.from(db.plans.values()).sort((a, b) => (b.at || 0) - (a.at || 0));
  const body = [];
  plans.forEach(p => {
    const store = p.shopName || p.shop || '';
    const label = [p.meat ? p.meat.charAt(0).toUpperCase() + p.meat.slice(1) : '', store].filter(Boolean).join(' · ');
    p.meals.forEach((m, i) => {
      const ing = m.ingredients.map(x => (x.qty ? x.qty + ' ' : '') + x.item + (x.pantry ? ' (pantry)' : '')).join('; ');
      body.push([plannedBy(p, db), day(p.at), label, i + 1, p.dates[i] || '', m.title, m.cuisine, m.method, m.minutes || '', store, p.people || '', m.why, m.uses.join('; '),
        ing.slice(0, CELL), m.steps.map((t, k) => (k + 1) + '. ' + t).join('\n').slice(0, CELL), i === 0 ? p.tip : '', p.id]);
    });
  });
  fill(ss, 'Plans', header, body, {2: 90, 3: 170, 6: 300, 15: 360, 16: 360});
}

function dealsTab(ss, db) {
  const header = ['Who', 'Week', 'Store', 'Item', 'Price', 'Usually', 'Member price', 'Note', 'Runs from', 'Runs to'];
  const list = Array.from(db.deals.values()).sort((a, b) => b.week.localeCompare(a.week) || a.store.localeCompare(b.store));
  const body = [];
  list.forEach(d => d.items.forEach(x => body.push([whoName(d, db), d.week, d.store, x.name, x.price, x.regular, x.member ? 'Yes' : '', x.note, d.from, d.to])));
  fill(ss, 'Deals', header, body.slice(0, MAX_DEAL_ROWS), {3: 120, 4: 320});
}

function shoppingTab(ss, sh) {
  const header = ['Section', 'Item', 'How much', 'Nights', 'On sale', 'Pantry'];
  const body = [];
  (Array.isArray(sh.buy) ? sh.buy : []).slice(0, 400).forEach(x => body.push([s(x.section, 40), s(x.item, 100), s(x.amount, 80), s(x.nights, 40), s(x.sale, 80), '']));
  (Array.isArray(sh.pantry) ? sh.pantry : []).slice(0, 200).forEach(x => body.push(['You probably have', s(x.item, 100), s(x.amount, 80), s(x.nights, 40), '', 'Yes']));
  fill(ss, 'Shopping list', header, body, {1: 140, 2: 260});
}

function settingsTab(ss, st) {
  const list = v => (Array.isArray(v) ? v : []).map(x => s(x, 60)).join(', ');
  const body = [['Stores', list(st.stores)], ['Member cards', list(st.cards)], ['Never in a plan', list(st.avoid)]];
  if (st.model) body.push(['Model', s(st.model, 60)]);
  fill(ss, 'Settings', ['Setting', 'Value'], body, {1: 160, 2: 420});
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
