// Notes, against hostile data: nothing from a backup file, the family's Sheet
// or what is already stored can become part of the page, and an old setup
// link (from before aOS kept the Sheet) is refused and changes nothing. In Vintage (the
// default design) and, for what is drawn differently (a list's colour), in
// Standard too.
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
  await page.addInitScript(() => { try { localStorage.getItem('aos.seen') || localStorage.setItem('aos.seen', JSON.stringify({ notes: '999' })); localStorage.setItem('aos.sky', 'day'); } catch (e) {} });   // no aOS walkthrough over the page
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/notes/');
  await page.evaluate(seed => { localStorage.clear(); localStorage.setItem('allison-notes-v1', JSON.stringify(seed)); }, seed);
  return page;
};

// 1. Already stored on the phone (from before this fix), in both designs: Vintage draws the seven list colours as
// Retro tokens, Standard as the hex itself.
for (const [design, want] of [['vintage', '--lc:var(--lc0);--lci:var(--lci0)'], ['glass', '--lc:#3B82F6']]) {
  const page = await fresh();
  const e = evil('stored');
  await page.evaluate(([seed, e, design]) => { localStorage.setItem('allison-notes-v1', JSON.stringify({ notes: e.notes, lists: seed.lists.concat(e.lists), todos: e.todos })); localStorage.setItem('design.notes', design); }, [seed, e, design]);
  await showReminders(page);
  const D = design === 'glass' ? ' (Standard)' : ' (Vintage)';
  ok('stored data: nothing runs' + D, !(await pwned(page)), await pwned(page));
  const chip = await page.$$eval('#listChips [data-list]', bs => bs.map(b => b.dataset.list));
  ok('stored data: the odd list id is kept as plain text' + D, chip.includes(e.lists[0].id), JSON.stringify(chip));
  // (it is fixed as Notes loads; the stored copy is rewritten on the next save)
  const style = await page.evaluate(() => [...document.querySelectorAll('#listChips [data-list]')].find(b => b.textContent.includes('Evil stored'))?.getAttribute('style'));
  ok('stored data: a bad list colour is drawn as the first list colour, never as the stored text' + D, style === want, String(style));
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

// 3. The family Sheet's answer (through aOS, signed in).
{
  const page = await fresh();
  await page.route('**/sheet/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, app: 'allison-notes-sync', v: 2, aos: true, graves: {}, ...evil('sheet') }) }));
  await page.evaluate(() => localStorage.setItem('aos.session', JSON.stringify({ token: 'tok', user: { id: 'u1', name: 'Tom', role: 'owner' }, at: 1 })));
  await page.reload();
  await showReminders(page);
  await page.waitForTimeout(1200);   // the sync on open
  await showReminders(page);
  ok('sheet: its lists and reminders arrived', await page.evaluate(() => JSON.parse(localStorage.getItem('allison-notes-v1')).lists.some(l => l.name === 'Evil sheet')));
  ok('sheet: nothing runs', !(await pwned(page)), await pwned(page));
  await page.close();
}

// 4. An old setup link (#sync=…, from before aOS kept the Sheet): nothing in it is kept, and it says so.
{
  const page = await fresh();
  const link = { u: 'https://script.google.com/macros/s/EVILSCRIPTID123/exec', s: 'x', p: 'https://evil.example' };
  await page.goto(BASE + '/notes/#sync=' + Buffer.from(JSON.stringify(link)).toString('base64url'));
  await page.waitForTimeout(700);
  const said = await page.textContent('#toastMsg');
  ok('setup link: says setup links aren\'t needed any more', /Setup links aren’t needed any more/.test(said), said);
  ok('setup link: taken out of the address', !(await page.evaluate(() => location.hash)));
  const server = await page.evaluate(() => (JSON.parse(localStorage.getItem('allison-notes-v1-push')) || {}).server || '');
  ok('setup link: notification server not changed', server !== link.p, server);
  ok('setup link: no link or phrase kept', !(await page.evaluate(() => localStorage.getItem('allison-notes-v1-sync'))));
  await page.close();
}

ok('no page errors', errors.length === 0, errors.join(' | '));
await browser.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
