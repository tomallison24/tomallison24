// An in-memory stand-in for the bits of Google Apps Script that
// fitness/google-sheet-sync.gs uses (SpreadsheetApp, LockService,
// ContentService, Utilities), so the script itself can run in Node: the
// sheet test calls doPost directly, and the app test answers the app's
// sync requests with it. As in a real Sheet, a leading ' marks text and is
// not part of the value read back.
import fs from 'fs';
import vm from 'vm';
import path from 'path';

export function fakeSheet(gsPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'google-sheet-sync.gs'), secret = 'test-secret-phrase') {
  const sheets = new Map();
  const makeSheet = name => {
    const sh = {
      name, cells: [], raw: [], hidden: false,
      getName: () => sh.name,
      getLastRow: () => sh.cells.length,
      getDataRange: () => ({ getValues: () => sh.cells.map(r => r.slice()) }),
      clearContents: () => { sh.cells = []; },
      getRange: (r, c, nr = 1, nc = 1) => ({
        setValues: vals => {
          for (let i = 0; i < nr; i++) {
            sh.cells[r - 1 + i] = sh.cells[r - 1 + i] || [];
            for (let j = 0; j < nc; j++) { const v = vals[i][j]; sh.raw.push(v); sh.cells[r - 1 + i][c - 1 + j] = typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v; }
          }
          return { setFontWeight: () => {} };
        },
        setNumberFormat: () => {},
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
  };
  ss.insertSheet('Sheet1');
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() {} }) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    ContentService: { createTextOutput: s => ({ text: s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    Utilities: { formatDate: d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()] },
    Date, JSON, Math, Number, String, Object, Array, Map, Set,
  };
  const src = fs.readFileSync(gsPath, 'utf8').replace("const SECRET = 'CHANGE-ME';", 'const SECRET = ' + JSON.stringify(secret) + ';');
  vm.createContext(ctx);
  vm.runInContext(src + '\n;this.__api = { doGet, doPost };', ctx);
  return {
    sheets,
    get: () => JSON.parse(ctx.__api.doGet().text),
    post: body => JSON.parse(ctx.__api.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).text),
    tab: n => sheets.get(n) ? sheets.get(n).cells : null,
  };
}
