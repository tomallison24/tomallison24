// An in-memory stand-in for the bits of Google Apps Script that drinks/google-sheet-sync.gs uses
// (SpreadsheetApp, LockService, ContentService, Utilities), so the script itself can run in Node:
// the sheet test calls doPost directly, and the app test answers the app's sync requests with it.
// As in a real Sheet, a leading ' marks text and is not part of the value read back, and a person
// can type into a cell (type(), which runs the script's own onEdit, as Sheets does for edits made by hand).
import fs from 'fs';
import vm from 'vm';
import path from 'path';

export function fakeSheet(gsPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'google-sheet-sync.gs'), secret = 'test-secret-phrase') {
  const sheets = new Map();
  const makeSheet = name => {
    const sh = {
      name, cells: [], raw: [], hidden: false, formats: new Set(),
      getName: () => sh.name,
      getLastRow: () => sh.cells.length,
      getMaxRows: () => Math.max(1000, sh.cells.length),
      getDataRange: () => ({ getValues: () => sh.cells.map(r => Array.from(r, v => v === undefined ? '' : v)) }),
      clearContents: () => { sh.cells = []; },
      getRange: (r, c, nr = 1, nc = 1) => ({
        setValues: vals => {
          for (let i = 0; i < nr; i++) {
            sh.cells[r - 1 + i] = sh.cells[r - 1 + i] || [];
            for (let j = 0; j < nc; j++) { const v = vals[i][j]; sh.raw.push(v); sh.cells[r - 1 + i][c - 1 + j] = typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v; }
          }
          return { setFontWeight: () => {} };
        },
        setValue: v => { sh.cells[r - 1] = sh.cells[r - 1] || []; sh.cells[r - 1][c - 1] = v; },
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => { const v = (sh.cells[r - 1 + i] || [])[c - 1 + j]; return v === undefined ? '' : v; })),
        setNumberFormat: f => { sh.formats.add(c + ':' + f); },
        getSheet: () => sh, getRow: () => r, getNumRows: () => nr,
      }),
      hideSheet: () => { sh.hidden = true; },
      setFrozenRows: () => {}, setColumnWidth: () => {},
    };
    return sh;
  };
  const ss = {
    getSheetByName: n => sheets.get(n) || null,
    insertSheet: n => { const s = makeSheet(n); sheets.set(n, s); return s; },
    getSheets: () => [...sheets.values()],
    deleteSheet: s => sheets.delete(s.name),
    getSpreadsheetTimeZone: () => 'UTC',
  };
  ss.insertSheet('Sheet1');
  const pad = n => String(n).padStart(2, '0');
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() {} }) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    ContentService: { createTextOutput: s => ({ text: s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    Utilities: { formatDate: (d, tz, f) => f.replace('yyyy', d.getUTCFullYear()).replace('MM', pad(d.getUTCMonth() + 1)).replace('dd', pad(d.getUTCDate())).replace('HH', pad(d.getUTCHours())).replace('mm', pad(d.getUTCMinutes())).replace('EEE', ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]) },
    Date, JSON, Math, Number, String, Object, Array, Map, Set, isFinite, parseFloat, isNaN,
  };
  const src = fs.readFileSync(gsPath, 'utf8').replace("const SECRET = 'CHANGE-ME';", 'const SECRET = ' + JSON.stringify(secret) + ';');
  vm.createContext(ctx);
  vm.runInContext(src + '\n;this.__api = { doGet, doPost, onEdit, rebuildTabs };', ctx);
  const api = {
    sheets,
    get: () => JSON.parse(ctx.__api.doGet().text),
    post: body => JSON.parse(ctx.__api.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).text),
    tab: n => sheets.get(n) ? sheets.get(n).cells : null,
    // a person typing into the Log tab: row is 1-based (the header is row 1), col is a header name
    type(row, header, value, tab = 'Log') {
      const sh = sheets.get(tab), h = (sh.cells[0] || []).findIndex(x => String(x).toLowerCase() === header.toLowerCase());
      if (h < 0) throw new Error('no column ' + header);
      sh.cells[row - 1] = sh.cells[row - 1] || []; sh.cells[row - 1][h] = value;
      ctx.__api.onEdit({ range: { getSheet: () => sh, getRow: () => row, getNumRows: () => 1 } });
    },
    rebuild: () => ctx.__api.rebuildTabs(),
  };
  return api;
}
