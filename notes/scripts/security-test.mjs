// Notes, against hostile data: nothing from a backup file, the Sheet or what
// is already stored can become part of the page, and a setup link says where
// it points and doesn't change anything until Connect works.
//
//   node notes/scripts/security-test.mjs [repo root]
//
// Every payload tries to add <img src=x onerror=...>; if any of them lands in
// the page, window.__pwned is set (and an img with src "x" exists).
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? '  — ' + extra : '')); };

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;

const X = n => `x"><img src=x onerror="window.__pwned=(window.__pwned||'')+'${n} '">`;
const evil = tag => ({
  lists: [{ id: X(tag + '-list-id'), updated: 5, name: 'Evil ' + tag, color: `red;"><img src=x onerror="window.__pwned=(window.__pwned||'')+'${tag}-list-color '">` }],
  todos: [{ id: X(tag + '-todo-id'), list: 'l1', title: 'Evil todo ' + tag, notes: '', tags: [], updated: 5, created: 5,
            prio: `1"><img src=x onerror="window.__pwned=(window.__pwned||'')+'${tag}-prio '">`, done: `false" onfocus="window.__pwned=1` }],
  notes: [{ id: X(tag + '-note-id'), title: 'Evil note ' + tag, body: 'b', tags: [], updated: 5, created: 5, color: X(tag + '-note-color') }],
});
const seed = { notes: [], lists: [{ id: 'l1', updated: 1, name: 'Personal', color: '#3B82F6' }], todos: [] };
const pwned = async page => page.evaluate(() => (window.__pwned || '') + (document.querySelector('img[src="x"]') ? ' img-in-page' : ''));
const showReminders = async page => {
  await page.evaluate(() => localStorage.setItem('allison-notes-v1-tab', 'rem'));
  await page.reload(); await page.waitForTimeout(700);
  // open every list chip and a reminder's details, so every list-drawing path runs
  const count = await page.$$eval('#listChips [data-list]', bs => bs.length);
  for (let i = 0; i < count; i++) { await page.evaluate(i => document.querySelectorAll('#listChips [data-list]')[i]?.click(), i); await page.waitForTimeout(80); }   // the chips redraw after each tap
};

const browser = await chromium.launch();
const errors = [];
const fresh = async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/notes/');
  await page.evaluate(seed => { localStorage.clear(); localStorage.setItem('allison-notes-v1', JSON.stringify(seed)); }, seed);
  return page;
};

// 1. Already stored on the phone (from before this fix).
{
  const page = await fresh();
  const e = evil('stored');
  await page.evaluate(([seed, e]) => localStorage.setItem('allison-notes-v1', JSON.stringify({ notes: e.notes, lists: seed.lists.concat(e.lists), todos: e.todos })), [seed, e]);
  await showReminders(page);
  ok('stored data: nothing runs', !(await pwned(page)), await pwned(page));
  const chip = await page.$$eval('#listChips [data-list]', bs => bs.map(b => b.dataset.list));
  ok('stored data: the odd list id is kept as plain text', chip.includes(e.lists[0].id), JSON.stringify(chip));
  // (it is fixed as Notes loads; the stored copy is rewritten on the next save)
  const style = await page.evaluate(() => [...document.querySelectorAll('#listChips [data-list]')].find(b => b.textContent.includes('Evil stored'))?.getAttribute('style'));
  ok('stored data: a bad list colour is drawn as a plain colour', style === '--lc:#3B82F6', String(style));
  await page.close();
}

// 2. A backup file: asks first; nothing runs either way.
{
  const page = await fresh();
  await showReminders(page);
  const file = { name: 'recipes.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ kind: 'backup', ...evil('backup') })) };
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.dismiss(); });
  await page.setInputFiles('#bkFile', file); await page.waitForTimeout(500);
  ok('backup: asks before adding anything', /Add 1 note, 1 reminder and 1 list from this file\?/.test(asked), asked);
  const listsAfterNo = await page.evaluate(() => JSON.parse(localStorage.getItem('allison-notes-v1')).lists.length);
  ok('backup: Cancel adds nothing', listsAfterNo === 1, String(listsAfterNo));
  page.once('dialog', d => d.accept());
  await page.setInputFiles('#bkFile', file); await page.waitForTimeout(500);
  await showReminders(page);
  ok('backup: accepted, nothing runs', !(await pwned(page)), await pwned(page));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('allison-notes-v1')));
  const t = saved.todos.find(x => x.title === 'Evil todo backup'), l = saved.lists.find(x => x.name === 'Evil backup'), n = saved.notes.find(x => x.title === 'Evil note backup');
  ok('backup: priority and done made safe', t && t.prio === 0 && t.done === true, JSON.stringify(t && { prio: t.prio, done: t.done }));
  ok('backup: list colour made safe', l && /^#[0-9a-f]{6}$/i.test(l.color), l && l.color);
  ok('backup: note colour made safe', n && n.color === 'none', n && n.color);
  await page.close();
}

// 3. The Sheet's answer.
{
  const page = await fresh();
  const SHEET = 'https://script.google.com/macros/s/TESTSHEET/exec';
  await page.route(SHEET + '**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, graves: {}, ...evil('sheet') }) }));
  await page.evaluate(url => localStorage.setItem('allison-notes-v1-sync', JSON.stringify({ url, secret: 's' })), SHEET);
  await showReminders(page);
  await page.waitForTimeout(1200);   // the sync on open
  await showReminders(page);
  ok('sheet: its lists and reminders arrived', await page.evaluate(() => JSON.parse(localStorage.getItem('allison-notes-v1')).lists.some(l => l.name === 'Evil sheet')));
  ok('sheet: nothing runs', !(await pwned(page)), await pwned(page));
  await page.close();
}

// 4. A setup link: says where it points, changes nothing until Connect.
{
  const page = await fresh();
  const link = { u: 'https://script.google.com/macros/s/EVILSCRIPTID123/exec', s: 'x', p: 'https://evil.example' };
  await page.goto(BASE + '/notes/#sync=' + Buffer.from(JSON.stringify(link)).toString('base64url'));
  await page.waitForTimeout(700);
  const said = await page.textContent('#syStatus');
  ok('setup link: names where it points', /script\.google\.com\/macros\/s\/EVILSC…\/exec/.test(said), said);
  ok('setup link: warns before Connect', /Only tap Connect if the link came from your own Notes/.test(said), said);
  const server = await page.evaluate(() => (JSON.parse(localStorage.getItem('allison-notes-v1-push')) || {}).server || '');
  ok('setup link: notification server not changed before Connect', server !== link.p, server);
  ok('setup link: not connected yet', !(await page.evaluate(() => localStorage.getItem('allison-notes-v1-sync'))));
  await page.close();
}

ok('no page errors', errors.length === 0, errors.join(' | '));
await browser.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
