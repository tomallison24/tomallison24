/**
 * News' stem cell log: every story the Stem cells topic brings in, one row each, kept for good
 * (the app itself keeps only the last 30 days). The News job (.github/workflows/news.yml, every
 * 30 minutes) sends this script the topic's current stories (news/scripts/log-stemcells.mjs);
 * the ones the Sheet already has, by DOI or link, are skipped, so each article is logged once.
 *
 * Set-up (once, by the owner; full steps in news/README.md, "Stem cell log"):
 *   1. In the Sheet: Extensions > Apps Script, paste this whole file, change SECRET below.
 *   2. Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone). Copy its URL.
 *   3. In GitHub: Settings > Secrets and variables > Actions > New repository secret, named
 *      STEMCELL_SHEET, with the URL followed by ?key= and the phrase:
 *        https://script.google.com/macros/s/…/exec?key=maple-otter-47-lantern-quiet
 * The phrase is this script's only lock: anyone with it can add rows. It lives only here and in
 * that secret, never in the (public) repository.
 *
 * What it keeps, in the Articles tab, newest first:
 *   Logged, Published, Title, Source, DOI, Link, Summary
 * DOI is filled in when the journal's feed gives one (Nature, Cell Press, Europe PMC); news sites
 * such as ScienceDaily don't. Rows you add, edit, sort or delete are left alone; a deleted row
 * comes back only while its story is still in the app (the last 30 days).
 */

const SECRET = 'CHANGE-ME';   // <- replace with your own long phrase, e.g. 'maple-otter-47-lantern-quiet'

const APP = 'news-stemcell-log', VERSION = 1;
const TAB = 'Articles';
const HEADER = ['Logged', 'Published', 'Title', 'Source', 'DOI', 'Link', 'Summary'];
const COL = {doi: 5, link: 6};

function doPost(e) {
  if (SECRET === 'CHANGE-ME' || SECRET.length < 16 || !e || !e.parameter || e.parameter.key !== SECRET) return out({ok: false, error: 'key'});
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ok: false, error: 'bad-request'}); }
  if (req && req.action === 'ping') return out({ok: true, app: APP, v: VERSION});
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return out({ok: false, error: 'busy'});
  try {
    return out({ok: true, app: APP, v: VERSION, added: log(sheet(), Array.isArray(req && req.articles) ? req.articles : [])});
  } finally {
    lock.releaseLock();
  }
}

// The new articles, newest first, under the header; returns how many
function log(sh, articles) {
  const seen = new Set(), last = sh.getLastRow();
  if (last > 1) sh.getRange(2, COL.doi, last - 1, 2).getValues().forEach(([doi, link]) => {
    if (doi) seen.add('doi:' + String(doi).toLowerCase());
    if (link) seen.add(String(link));
  });
  const rows = [];
  articles.forEach(a => {
    const url = /^https?:\/\//i.test(String(a && a.url || '')) ? String(a.url) : '';
    const doi = String(a && a.doi || '').toLowerCase();
    if (!url || !a.title || seen.has(url) || (doi && seen.has('doi:' + doi))) return;
    seen.add(url); if (doi) seen.add('doi:' + doi);
    const at = a.published ? new Date(a.published) : null;
    rows.push([new Date(), at && !isNaN(at) ? at : '', cell(a.title), cell(a.source), cell(doi), url, cell(a.summary)]);
  });
  if (!rows.length) return 0;
  rows.sort((x, y) => (y[1] || 0) - (x[1] || 0));
  const n = rows.length;
  sh.insertRowsAfter(1, n);
  // new rows take the header's look; give them the plain one, and dates as dates
  sh.getRange(2, 1, n, HEADER.length).setFontWeight('normal').setBackground(null);
  sh.getRange(2, 1, n, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  sh.getRange(2, 2, n, 1).setNumberFormat('yyyy-mm-dd');
  sh.getRange(2, COL.doi, n, 1).setNumberFormat('@');
  sh.getRange(2, 1, n, HEADER.length).setValues(rows);
  return n;
}

// Text from a feed, never read as a formula
function cell(v) {
  const s = String(v == null ? '' : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TAB);
  if (!sh) sh = ss.insertSheet(TAB, 0);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
