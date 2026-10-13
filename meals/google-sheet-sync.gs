/**
 * Allison OS Meals -> Google Sheet. A readable copy of Meals, one way: the app
 * writes, nothing is read back, so edit nothing here (changes are lost the
 * next time a tab is rebuilt, except Plans, which only ever grows).
 *
 * Paste this whole file into your Sheet's Apps Script editor (Extensions >
 * Apps Script), change SECRET below, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Paste the web app link and the
 * secret into Meals. Full steps: meals/README.md, "Google Sheet".
 *
 * What it keeps in the Sheet:
 *   Plans          one row per planned night, for EVERY plan ever accepted,
 *                  newest first. A plan is never removed, even after the app
 *                  drops it from its list of the last 52.
 *   Shopping list  the current plan's list, in the same sections as the app
 *   Deals          this week's sales for each store (the last 8 weeks are kept)
 *   Settings       the stores, member cards and foods the family avoids
 *   _plans, _deals hidden tabs the readable tabs are rebuilt from
 */

const SECRET = 'CHANGE-ME';   // <- replace with your own long phrase, e.g. 'maple-otter-47-lantern-quiet'

const APP = 'allison-meals-sync', VERSION = 1;
const PLANS = '_plans', DEALS = '_deals';
const KEEP_DEAL_WEEKS = 8;
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
    if (changed) store(ss, db);
    if (req.action === 'sync' || req.action === 'rebuild') views(ss, db, req, changed || req.action === 'rebuild');
    return out({ok: true, app: APP, v: VERSION, at: Date.now(), plans: db.plans.size, deals: db.deals.size});
  } finally {
    lock.releaseLock();
  }
}

// A "Meals" menu in the Sheet, to rebuild the readable tabs by hand.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Meals').addItem('Rebuild Plans tab', 'rebuildTabs').addToUi();
}
function rebuildTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  views(ss, load(ss), null, true);
}

// ---------- reading and writing the hidden data tabs ----------

function load(ss) {
  const db = {plans: new Map(), deals: new Map()};
  rows(ss, PLANS).forEach(r => { const id = String(r[0] || ''); if (id) try { db.plans.set(id, JSON.parse(r.slice(2).join(''))); } catch (err) { /* skip a damaged row */ } });
  rows(ss, DEALS).forEach(r => { const id = String(r[0] || ''); if (id) try { db.deals.set(id, JSON.parse(r.slice(2).join(''))); } catch (err) { /* skip a damaged row */ } });
  return db;
}

function rows(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1);
}

function store(ss, db) {
  [[PLANS, db.plans], [DEALS, db.deals]].forEach(([name, map]) => {
    const list = Array.from(map.entries()).map(([id, it]) => {
      const json = JSON.stringify(it), parts = [];
      for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
      return [id, Number(it.at) || 0].concat(parts);
    });
    const width = Math.max(3, ...list.map(r => r.length));
    const header = ['id', 'saved', 'data'].concat(Array(width - 3).fill('data (continued)'));
    write(ss, name, [header].concat(list.map(r => r.concat(Array(width - r.length).fill('')))), true);
  });
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

// ---------- merging what the phone sent ----------

const s = (v, n) => String(v == null ? '' : v).slice(0, n || 300);
const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };

// A plan is kept as sent, trimmed to what is shown. A newer copy of the same plan replaces it;
// nothing the phone leaves out of a later snapshot is removed.
function cleanPlan(p) {
  if (!p || typeof p.id !== 'string' || !p.id || p.id.length > 60 || !Array.isArray(p.meals)) return null;
  return {
    id: p.id, at: num(p.acceptedAt) || num(p.at), start: s(p.start, 10), by: s(p.acceptedBy || p.by, 60), meat: s(p.meat, 40), shop: s(p.shopName || p.shop, 60),
    people: num(p.people), tip: s(p.tip, 300), dates: (Array.isArray(p.dates) ? p.dates : []).map(d => s(d, 10)).slice(0, 14),
    meals: p.meals.slice(0, 14).map(m => m && {
      title: s(m.title, 120), cuisine: s(m.cuisine, 40), method: s(m.method, 40), minutes: num(m.minutes), why: s(m.why, 240),
      uses: (Array.isArray(m.uses) ? m.uses : []).map(u => s(u, 80)).slice(0, 10),
      ingredients: (Array.isArray(m.ingredients) ? m.ingredients : []).slice(0, 40).map(x => x && {item: s(x.item, 80), qty: s(x.qty, 40), pantry: !!x.pantry}).filter(x => x && x.item),
      steps: (Array.isArray(m.steps) ? m.steps : []).map(t => s(t, 500)).slice(0, 14)
    }).filter(m => m && m.title)
  };
}

function cleanDeal(d) {
  if (!d || !d.store || !d.week) return null;
  return {
    id: s(d.week, 10) + '|' + s(d.store, 40), at: num(d.at) || Date.now(), store: s(d.store, 40), week: s(d.week, 10), from: s(d.validFrom, 10), to: s(d.validTo, 10),
    items: (Array.isArray(d.items) ? d.items : []).slice(0, 150).map(x => x && {name: s(x.name, 100), price: s(x.price, 40), regular: s(x.regular, 40), member: !!x.member, note: s(x.note, 120)}).filter(x => x && x.name)
  };
}

function merge(db, req) {
  let changed = false;
  (Array.isArray(req.plans) ? req.plans : []).slice(0, MAX_PLANS).forEach(p => {
    const c = cleanPlan(p); if (!c) return;
    if (JSON.stringify(db.plans.get(c.id)) !== JSON.stringify(c)) { db.plans.set(c.id, c); changed = true; }
  });
  (Array.isArray(req.deals) ? req.deals : []).slice(0, 40).forEach(d => {
    const c = cleanDeal(d); if (!c || !c.items.length) return;
    const old = db.deals.get(c.id);
    if (!old || JSON.stringify(old.items) !== JSON.stringify(c.items) || old.from !== c.from || old.to !== c.to) { db.deals.set(c.id, c); changed = true; }
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

function planTab(ss, db) {
  const header = ['Accepted', 'Plan', 'Night', 'Date', 'Dinner', 'Cuisine', 'Method', 'Minutes', 'Store', 'People', 'Planned by', 'Why', 'Uses (on sale)', 'Ingredients', 'Steps', 'Tip', 'PlanID'];
  const day = ms => ms ? Utilities.formatDate(new Date(ms), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : '';
  const plans = Array.from(db.plans.values()).sort((a, b) => (b.at || 0) - (a.at || 0));
  const body = [];
  plans.forEach(p => {
    const label = [p.meat ? p.meat.charAt(0).toUpperCase() + p.meat.slice(1) : '', p.shop].filter(Boolean).join(' · ');
    p.meals.forEach((m, i) => {
      const ing = m.ingredients.map(x => (x.qty ? x.qty + ' ' : '') + x.item + (x.pantry ? ' (pantry)' : '')).join('; ');
      body.push([day(p.at), label, i + 1, p.dates[i] || '', m.title, m.cuisine, m.method, m.minutes || '', p.shop, p.people || '', p.by, m.why, m.uses.join('; '),
        ing.slice(0, CELL), m.steps.map((t, k) => (k + 1) + '. ' + t).join('\n').slice(0, CELL), i === 0 ? p.tip : '', p.id]);
    });
  });
  fill(ss, 'Plans', header, body, {1: 90, 2: 170, 5: 300, 14: 360, 15: 360});
}

function dealsTab(ss, db) {
  const header = ['Week', 'Store', 'Item', 'Price', 'Usually', 'Member price', 'Note', 'Runs from', 'Runs to'];
  const list = Array.from(db.deals.values()).sort((a, b) => b.week.localeCompare(a.week) || a.store.localeCompare(b.store));
  const body = [];
  list.forEach(d => d.items.forEach(x => body.push([d.week, d.store, x.name, x.price, x.regular, x.member ? 'Yes' : '', x.note, d.from, d.to])));
  fill(ss, 'Deals', header, body.slice(0, MAX_DEAL_ROWS), {2: 120, 3: 320});
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
