// Drives Notes' grocery sections in headless Chromium: a Groceries list shown
// under store sections in supermarket order, moving an item to another
// section (and the list remembering it for next time), the list editor's
// "Sort into store sections" switch, and that other lists keep their dates.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node notes/scripts/aisles-app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
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

let n = 0;
const T = (list, title, o = {}) => ({ id: 't' + (++n), list, title, notes: '', date: null, time: null, prio: 0, flagged: false, done: false, doneAt: null, tags: [], created: n, updated: 1, ...o });
const seed = {
  notes: [],
  lists: [{ id: 'l1', updated: 1, name: 'Personal', color: '#3B82F6' }, { id: 'l3', updated: 1, name: 'Groceries', color: '#10B981' }, { id: 'l2', updated: 1, name: 'Home', color: '#F59E0B' }],
  todos: [
    T('l3', 'Milk'), T('l3', 'Bananas'), T('l3', 'Chicken thighs'), T('l3', 'Paper towels'), T('l3', 'Sourdough'), T('l3', 'Ice cream'),
    T('l3', 'Corn tortillas'), T('l3', 'Birthday card'), T('l3', 'Greek yogurt'), T('l3', 'Eggs', { done: true, doneAt: 1 }),
    T('l2', 'Fix the fence', { date: '2026-10-05' }), T('l2', 'Buy lightbulbs'),
  ],
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'America/New_York' });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(BASE + '/notes/');
await page.evaluate(seed => { localStorage.setItem('allison-notes-v1', JSON.stringify(seed)); localStorage.setItem('allison-notes-v1-tab', 'rem'); }, seed);
await page.reload();
await page.waitForTimeout(800);
const sections = () => page.evaluate(() => [...document.querySelectorAll('#remBody .rgroup')].map(g => g.querySelector('.sechead span').textContent + ': ' + [...g.querySelectorAll('.tbody .t')].map(x => x.textContent).join(', ')));

await page.click('#listChips [data-list="l3"]');
await page.waitForTimeout(500);
let s = await sections();
ok('choosing Groceries shows all of it (the All view)', await page.getAttribute('#seg [data-view="all"]', 'aria-pressed') === 'true');
ok('grouped under store sections, in supermarket order', s.join(' | ') === 'Produce: Bananas | Bakery: Sourdough, Corn tortillas | Meat: Chicken thighs | Dairy & Eggs: Milk, Greek yogurt | Frozen: Ice cream | Household: Paper towels | Other: Birthday card', s.join(' | '));
ok('completed items stay out of the sections', !s.some(x => x.split(': ')[1].split(', ').includes('Eggs')));
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '1-groceries.png'), fullPage: true });

// Move Corn tortillas to Pantry; the list learns it.
await page.click('#remBody .tbody:has-text("Corn tortillas")');
await page.waitForTimeout(400);
ok('a grocery item\'s details offer Section, with Auto naming its guess', await page.isVisible('#tdAisleField') && (await page.textContent('#tdAisle [data-ai=""]')) === 'Auto · Bakery');
await page.click('#tdAisle [data-ai="pantry"]');
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '2-section.png') });
await page.click('#tdDone');
await page.waitForTimeout(400);
s = await sections();
ok('it moves to Pantry', s.some(x => x === 'Pantry: Corn tortillas'), s.join(' | '));
const learn = await page.evaluate(() => JSON.parse(localStorage.getItem('allison-notes-v1')).lists.find(l => l.id === 'l3').learn);
ok('the list remembers it (and that syncs with the list)', learn && learn['corn tortilla'] === 'pantry', JSON.stringify(learn));
await page.fill('#qa', '2 packs corn tortillas');
await page.press('#qa', 'Enter');
await page.waitForTimeout(400);
s = await sections();
ok('next time, typed differently, it goes to Pantry by itself', s.some(x => x === 'Pantry: Corn tortillas, 2 packs corn tortillas'), s.join(' | '));
await page.fill('#qa', 'Salmon');
await page.press('#qa', 'Enter');
await page.waitForTimeout(400);
ok('a new item lands in its section (Salmon in Seafood)', (await sections()).includes('Seafood: Salmon'));

// Back to Auto: forgets it.
await page.click('#remBody .tbody:has-text("2 packs corn tortillas")');
await page.waitForTimeout(300);
ok('an item placed by what the list learned shows Auto · Pantry', (await page.textContent('#tdAisle [data-ai=""]')) === 'Auto · Pantry' && await page.getAttribute('#tdAisle [data-ai=""]', 'aria-checked') === 'true');
await page.click('#tdDone');

// Other lists keep their dates; the switch turns sections on for one.
await page.click('#listChips [data-list="l2"]');
await page.waitForTimeout(400);
s = await sections();
ok('Home keeps date groups', s.some(x => x.startsWith('No date')) && !s.some(x => x.startsWith('Household')), s.join(' | '));
await page.click('#listChips [data-list="l2"]');     // again: edit the list
await page.waitForTimeout(400);
ok('the list editor\'s switch is off for Home', await page.getAttribute('#lsGrocery', 'aria-checked') === 'false');
await page.click('#lsGrocery');
await page.click('#lsSave');
await page.waitForTimeout(400);
s = await sections();
ok('switched on, Home sorts into sections too', s.some(x => x.startsWith('Household: Buy lightbulbs')), s.join(' | '));
await page.click('#listChips [data-list="l3"]'); await page.waitForTimeout(200);
await page.click('#listChips [data-list="l3"]'); await page.waitForTimeout(400);
ok('Groceries\' switch is on by itself (its name)', await page.getAttribute('#lsGrocery', 'aria-checked') === 'true');
await page.click('#listSheet [data-close].iconbtn');

await page.click('#listChips [data-list=""]');
await page.waitForTimeout(400);
s = await sections();
ok('All lists keeps date groups', !s.some(x => x.startsWith('Produce')), s.join(' | '));
ok('no errors on the page', errors.length === 0, errors.join(' | '));
await browser.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
