// News' stem cell log: log-stemcells.mjs sends the Stem cells topic to the owner's Google Sheet
// only on a publishing run with the secret set, and never fails the run; stemcell-sheet.gs, run
// against a pretend Sheet, logs each article once (by DOI or link), newest first, refuses the
// wrong phrase, and never lets feed text become a formula.
//   node news/scripts/stemcell-log-test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { articles, logStemCells } from './log-stemcells.mjs';

let pass = 0, fail = 0;
const ok = (what, cond) => { if (cond) pass++; else fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); };
const quiet = async f => { const log = console.log, said = []; console.log = (...a) => said.push(a.join(' ')); try { await f(); } finally { console.log = log; } return said.join('\n'); };

const STORIES = [
  { topic: 'stemcells', title: 'Microglia from iPSCs', source: 'Cell Stem Cell', url: 'https://www.cell.com/a', published: '2026-10-20T00:00:00Z', summary: 'S1', doi: '10.1016/j.stem.2026.1', image: 'x' },
  { topic: 'stemcells', title: 'Organoids, again', source: 'ScienceDaily', url: 'https://www.sciencedaily.com/b', published: '2026-10-22T00:00:00Z', summary: 'S2' },
  { topic: 'world', title: 'Not this one', source: 'BBC', url: 'https://bbc.co.uk/c', published: '2026-10-22T00:00:00Z' },
];

// ---- the sender ----
{
  const a = articles(STORIES);
  ok('only the Stem cells topic is sent, with its DOI when it has one', a.length === 2 && a[0].doi === '10.1016/j.stem.2026.1' && !('doi' in a[1]) && !('image' in a[0]) && !('topic' in a[0]));
  let calls = [];
  const fake = answer => async (u, o) => { calls.push({ u, body: JSON.parse(o.body), method: o.method }); return { status: 200, json: async () => answer }; };
  await quiet(() => logStemCells(STORIES, { url: 'https://script.example/exec?key=k', publish: 'false', fetch: fake({ ok: true, added: 2 }) }));
  ok('a branch\'s check sends nothing', calls.length === 0);
  const noSecret = await quiet(() => logStemCells(STORIES, { url: '', publish: 'true', fetch: fake({ ok: true, added: 2 }) }));
  ok('without the secret, nothing is sent, and the log says where to set it up', calls.length === 0 && /STEMCELL_SHEET/.test(noSecret));
  const sent = await quiet(() => logStemCells(STORIES, { url: 'https://script.example/exec?key=k', publish: 'true', fetch: fake({ ok: true, added: 2 }) }));
  ok('a publishing run posts the topic to the Sheet\'s address', calls.length === 1 && calls[0].method === 'POST' && calls[0].u === 'https://script.example/exec?key=k' && calls[0].body.articles.length === 2);
  ok('and says how many were new, never the address or its key', /2 new of 2/.test(sent) && !/key=k/.test(sent));
  const refused = await quiet(() => logStemCells(STORIES, { url: 'https://script.example/exec?key=k', publish: 'true', fetch: fake({ ok: false, error: 'key' }) }));
  ok('a refused phrase is a warning, not a failed run', /::warning::.*key/.test(refused));
  let threw = false;
  const down = await quiet(async () => { try { await logStemCells(STORIES, { url: 'https://script.example/exec?key=k', publish: 'true', fetch: async () => { throw new Error('network down'); } }); } catch { threw = true; } });
  ok('the Sheet out of reach is a warning, never an error', !threw && /::warning::.*network down/.test(down));
}

// ---- the Sheet's script ----
{
  const src = readFileSync(new URL('../stemcell-sheet.gs', import.meta.url), 'utf8');
  const make = secret => {
    const grid = [];   // rows of values; row 1 is grid[0]
    const sh = {
      getLastRow: () => grid.length,
      getRange: (r, c, nr = 1, nc = 1) => ({
        setFontWeight() { return this; }, setBackground() { return this; }, setNumberFormat() { return this; },
        getValues: () => grid.slice(r - 1, r - 1 + nr).map(row => row.slice(c - 1, c - 1 + nc)),
        setValues: v => { v.forEach((row, i) => { grid[r - 1 + i] = grid[r - 1 + i] || []; row.forEach((x, j) => { grid[r - 1 + i][c - 1 + j] = x; }); }); return { setFontWeight: () => {} }; },
      }),
      insertRowsAfter: (r, n) => { grid.splice(r, 0, ...Array.from({ length: n }, () => [])); },
      setFrozenRows: () => {},
    };
    const ctx = {
      SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => (ctx.made ? sh : null), insertSheet: () => { ctx.made = true; return sh; } }) },
      LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
      ContentService: { createTextOutput: t => ({ setMimeType: () => JSON.parse(t) }), MimeType: { JSON: 'json' } },
      JSON, Date, Set, Array, String, isNaN, made: false,
    };
    vm.runInNewContext(src.replace("const SECRET = 'CHANGE-ME';", `const SECRET = ${JSON.stringify(secret)};`), ctx);
    const post = (key, body) => vm.runInNewContext('doPost(e)', Object.assign(ctx, { e: { parameter: { key }, postData: { contents: JSON.stringify(body) } } }));
    return { post, grid };
  };
  const PHRASE = 'maple-otter-47-lantern-quiet';
  const unset = make('CHANGE-ME');
  ok('left as CHANGE-ME, it refuses everything', unset.post('CHANGE-ME', { action: 'ping' }).error === 'key');
  const { post, grid } = make(PHRASE);
  ok('the wrong phrase gets nothing', post('nope', { action: 'log', articles: articles(STORIES) }).error === 'key' && grid.length === 0);
  ok('the right one answers a ping', post(PHRASE, { action: 'ping' }).ok === true);
  const r1 = post(PHRASE, { action: 'log', articles: articles(STORIES) });
  ok('the first run logs both, under a header', r1.added === 2 && grid[0].join() === 'Logged,Published,Title,Source,DOI,Link,Summary' && grid.length === 3);
  ok('newest first, with the DOI where there is one', grid[1][2] === 'Organoids, again' && grid[1][4] === '' && grid[2][2] === 'Microglia from iPSCs' && grid[2][4] === '10.1016/j.stem.2026.1');
  const r2 = post(PHRASE, { action: 'log', articles: articles(STORIES) });
  ok('the next run adds nothing it already has', r2.added === 0 && grid.length === 3);
  const sameDoi = { title: 'Microglia from iPSCs', source: 'Nature Portfolio', url: 'https://doi.org/10.1016/j.stem.2026.1', doi: '10.1016/J.STEM.2026.1', published: '2026-10-20T00:00:00Z' };
  const evil = { title: '=HYPERLINK("https://x.example","click")', source: '+cmd', url: 'https://x.example/d', summary: '@SUM(1)' };
  const r3 = post(PHRASE, { action: 'log', articles: [sameDoi, evil, { title: 'no link', url: 'javascript:alert(1)' }] });
  ok('the same paper from another feed (same DOI) is skipped; a link that isn\'t a web address is too', r3.added === 1 && grid.length === 4);
  ok('text from a feed never becomes a formula', grid[1][2].startsWith("'=") && grid[1][3].startsWith("'+") && grid[1][6].startsWith("'@"));
}

console.log(fail ? `\n${fail} failed, ${pass} passed` : `\nall ${pass} passed`);
process.exit(fail ? 1 : 0);
