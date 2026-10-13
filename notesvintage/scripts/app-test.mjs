// Drives Notes Vintage in headless Chromium at iPhone size (390 x 844), light and
// dark: the notes home (pinned, collections, recent, the grid and the list), a
// collection, writing and editing a note, a note's colour, trash and undo, the
// Reminders (views, lists, quick add, ticking one off, the details sheet, a new
// list), the swipe actions, and that nothing trips the page's Content Security
// Policy. And that it is drawn in the Retro look: Futura, flat cream (walnut)
// cards, a mustard thumb, an orange add button, the atomic shapes behind the
// title, a note's colour and a list's colour in the Retro palette. And that it
// keeps its own storage: every key is allison-notesv-v1* (Notes' is
// allison-notes-v1*), its Sheet copy is in IndexedDB allison-notesv, its
// Calendar layer is 'notesv' and its offline cache is notesvintage-v1.
// (Notes' own tests of the notifications, the grocery sections and hostile data
// are run on this app too: push-app-test, aisles-app-test and security-test.)
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node notesvintage/scripts/app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'node:assert/strict';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

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

const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = n => ymd(new Date(Date.now() + n * 864e5));   // any day of the week, end of a month: it is only ever "N days from now"
const now = Date.now();
let k = 0;
const N = (title, body, o = {}) => ({ id: 'n' + (++k), title, body, tags: [], color: 'none', pinned: false, reminder: null, created: now - k * 7 * 3600e3, updated: 1, archived: false, deletedAt: null, ...o });
const notes = [
  N('Welcome to Notes', 'Tap the pencil to write a note.', { tags: ['start'], color: 'blue', pinned: true }),
  N('Dinner ideas', 'Lemon chicken\nMushroom risotto', { tags: ['food', 'ideas'], color: 'yellow' }),
  N('Garden', 'Tomatoes in by May.', { tags: ['home'], color: 'green' }),
  N('Quick thought', 'Ask about the roof estimate', {}),
  N('Trashed note', 'Gone soon', { deletedAt: now - 3 * 864e5 }),
];
const lists = [{ id: 'l1', updated: 1, name: 'Personal', color: '#3B82F6' }, { id: 'l2', updated: 1, name: 'Home', color: '#F59E0B' }, { id: 'l3', updated: 1, name: 'Groceries', color: '#10B981' }];
let t = 0;
const T = (list, title, o = {}) => ({ id: 't' + (++t), list, title, notes: '', date: null, time: null, prio: 0, flagged: false, done: false, doneAt: null, tags: [], created: now - t * 6e5, updated: 1, ...o });
const todos = [
  T('l1', 'Renew passport', { date: day(-2), prio: 3, flagged: true }),
  T('l1', 'Call the bank', { date: day(0), tags: ['money'] }),
  T('l2', 'Fix the gate latch', { date: day(1) }),
  T('l3', 'Milk'), T('l3', 'Bananas'),
];
const seed = { notes, lists, todos };
const KEY = 'allison-notesv-v1';

const browser = await chromium.launch();
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n  ', e.message.split('\n').slice(0, 6).join('\n   ')); } };
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const calls = [];

for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, timezoneId: 'America/New_York', locale: 'en-US', serviceWorkers: 'block' });
  await ctx.addInitScript(() => localStorage.setItem('aos.seen', JSON.stringify({ notesvintage: '999' })));   // no aOS walkthrough over the page
  await ctx.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { window.__csp = (window.__csp || []).concat(e.violatedDirective + ' ' + e.blockedURI); }));
  await ctx.route('**/calendar/api/**', route => route.fulfill({ status: 503, json: {} }));
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404/.test(m.text())) problems.push(m.text()); });   // welcome.js asks ../aOS/api/state, which this static server doesn't have
  page.on('pageerror', e => problems.push(String(e)));
  await page.goto(BASE + '/notesvintage/');
  await page.evaluate(([seed, KEY]) => { localStorage.setItem(KEY, JSON.stringify(seed)); localStorage.setItem(KEY + '-backup', String(Date.now())); localStorage.setItem(KEY + '-tab', 'notes'); }, [seed, KEY]);
  await page.reload();
  await page.waitForSelector('#list .ctile');
  await page.waitForTimeout(900);
  const q = (sel, props, pseudo) => page.$eval(sel, (e, [props, pseudo]) => { const c = getComputedStyle(e, pseudo || null); return props.map(p => c[p]); }, [props, pseudo]);
  const cream = scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', ground = scheme === 'light' ? 'rgb(244, 236, 221)' : 'rgb(36, 30, 26)';
  const teal = scheme === 'light' ? 'rgb(31, 111, 107)' : 'rgb(79, 179, 171)';
  const orange = scheme === 'light' ? 'rgb(201, 80, 42)' : 'rgb(216, 87, 42)';

  await step(scheme + ': the notes home: pinned, collections, recent, and the chips', async () => {
    assert.equal(await page.textContent('#notesTitle'), 'Notes');
    assert.equal(await page.locator('#list .ctile').count(), 5, 'start, food, ideas, home, and No tag');
    assert.ok(await page.isVisible('#list .rgroup.nlist'), 'Recent');
    assert.match(await page.textContent('.morechips'), /All notes/);
    assert.match(await page.textContent('.morechips'), /Trash/);
    await shot(page, '01-home-' + scheme);
  });

  await step(scheme + ': drawn in the Retro look: Futura, flat cream or walnut, mustard, orange, atomic shapes', async () => {
    assert.match((await q('body', ['fontFamily']))[0], /Futura/);
    assert.equal((await q('body', ['backgroundColor']))[0], ground);
    const [bg, shadow, backdrop, radius] = await q('#list .ctile', ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
    assert.equal(bg, cream); assert.equal(shadow, 'none'); assert.ok(backdrop === 'none' || backdrop === '', backdrop); assert.equal(radius, '20px');
    assert.equal((await q('.ambient i:nth-child(1)', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard sun');
    assert.equal((await q('.ambient i:nth-child(2)', ['backgroundColor']))[0], teal, 'a teal dot');
    assert.equal((await q('.ambient i:nth-child(3)', ['backgroundColor']))[0], 'rgb(216, 87, 42)', 'a burnt-orange pill');
    assert.equal((await q('#fab', ['backgroundColor']))[0], orange, 'the new-note button is solid orange');
    assert.equal((await q('.tabs .slthumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard thumb under the chosen section');
    assert.equal((await q('#notesView .title', ['fontSize']))[0], '44px');
    assert.equal((await q('#notesView .title', ['backgroundImage'], '::after'))[0].startsWith('url('), true, 'the three little bars under the title');
    assert.equal((await q('.chip .badge', ['backgroundColor']))[0], 'rgb(216, 87, 42)', 'the Tidy up count is an orange disc');
    // the search field and a button are flat cream, not glass
    const [sbg, sblur] = await q('.search', ['backgroundColor', 'backdropFilter']);
    assert.equal(sbg, cream); assert.ok(sblur === 'none' || sblur === '');
  });

  await step(scheme + ': a note keeps its colour, flat, in the Retro palette; a tag has its own Retro colour', async () => {
    await page.click('[data-coll="all"]');
    await page.waitForSelector('.grid .card');
    await page.waitForTimeout(900);
    const [ybg, yshadow, yblur] = await q('.card[data-color="yellow"]', ['backgroundColor', 'boxShadow', 'backdropFilter']);
    assert.notEqual(ybg, cream, 'a yellow note is tinted');
    const [r, g, b] = ybg.match(/\d+/g).map(Number);
    assert.ok(r > b + 30 && r >= g, 'tinted mustard (warm, not blue): ' + ybg);
    assert.ok(yshadow.includes('inset') && !/\d+px \d+px \d+px/.test(yshadow.replace(/inset \d+px \d+px \d+px/, '')), 'a ring, no drop shadow: ' + yshadow);
    assert.ok(yblur === 'none' || yblur === '');
    const [bbg] = await q('.card[data-color="blue"]', ['backgroundColor']);
    const [br, bg2, bb] = bbg.match(/\d+/g).map(Number);
    assert.ok(bg2 > br && bb >= br, 'a "blue" note is tinted teal (greenish blue, not iOS blue): ' + bbg);
    assert.equal(await page.$eval('.tchip', e => e.getAttribute('style').startsWith('--tc:var(--tc')), true, 'a tag takes one of the ten Retro colours (tokens), not a hue');
    assert.notEqual((await q('.tchip', ['color']))[0], 'rgb(0, 0, 0)');
    await shot(page, '02-all-' + scheme);
  });

  await step(scheme + ': switch to the list view and back', async () => {
    await page.click('#viewBtn'); await page.waitForTimeout(300);
    assert.equal(await page.locator('.grid .col').count(), 1);
    await page.click('#viewBtn'); await page.waitForTimeout(300);
    assert.equal(await page.locator('.grid .col').count(), 2);
  });

  await step(scheme + ': swipe a note: its actions are Retro discs (pin mustard, tag teal, archive olive, delete orange)', async () => {
    const box = await page.locator('.grid .sw').first().boundingBox();
    await page.waitForTimeout(900);
    await page.evaluate(() => { const s = document.querySelector('.grid .sw'); s.classList.add('open-r', 'show-l'); s.querySelector('.card').style.transform = 'translateX(116px)'; });
    assert.equal((await q('.sw .sa.pin .gi', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'pin is mustard');
    assert.equal((await q('.sw .sa.tag .gi', ['backgroundColor']))[0], teal, 'tag is teal');
    assert.equal((await q('.sw .sa.arch .gi', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(126, 140, 52)' : 'rgb(163, 176, 74)', 'archive is olive');
    assert.equal((await q('.sw .sa.bin .gi', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(216, 87, 42)' : 'rgb(232, 104, 74)', 'delete is orange');
    assert.ok(box.width > 100);
    await page.evaluate(() => { const s = document.querySelector('.grid .sw'); s.classList.remove('open-r', 'show-l'); s.querySelector('.card').style.transform = ''; });
  });

  await step(scheme + ': write a note: the editor is a page with a mustard sun, and its buttons and switch are Retro', async () => {
    await page.click('#fab');
    await page.waitForSelector('#editor:not([hidden])');
    await page.waitForTimeout(600);
    assert.equal((await q('#editor .sheet.page', ['backgroundColor']))[0], ground);
    assert.equal((await q('#editor .sheet.page', ['backgroundColor'], '::before'))[0], 'rgb(227, 167, 47)', 'the sun');
    assert.equal((await q('#edDone', ['backgroundColor']))[0], orange, 'Done is solid orange');
    assert.equal((await q('#edPaper', ['backgroundColor']))[0], cream, 'the page of the note is a flat card');
    await page.fill('#edTitle', 'Test note');
    await page.fill('#edBody', 'Remember to buy stamps #errands');
    await page.click('.swatch[data-sw="pink"]');
    assert.equal(await page.getAttribute('.swatch[data-sw="pink"]', 'aria-checked'), 'true');
    await page.click('#edPrivate');
    assert.equal(await page.getAttribute('#edPrivate', 'aria-checked'), 'true');
    assert.equal((await q('#edPrivate .switch', ['backgroundColor']))[0], teal, 'a switch that is on is teal');
    await page.click('#edPrivate');
    await shot(page, '03-editor-' + scheme);
    await page.click('#edDone');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.card', { hasText: 'Test note' }).count(), 1);
    const saved = await page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
    const n = saved.notes.find(x => x.title === 'Test note');
    assert.ok(n && n.color === 'pink' && n.tags.includes('errands'), 'saved with its colour and #tag, in Notes\' own format: ' + JSON.stringify(n));
  });

  await step(scheme + ': delete a note: Trash, Undo, and Restore', async () => {
    await page.click('.card:has-text("Test note")');
    await page.waitForSelector('#editor:not([hidden])');
    await page.click('#edDelete');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.card', { hasText: 'Test note' }).count(), 0);
    assert.match(await page.textContent('#toastMsg'), /Moved to Trash/);
    await page.click('#toastAct');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.card', { hasText: 'Test note' }).count(), 1, 'Undo brings it back');
    await page.click('#collBack');
    await page.click('[data-coll="trash"]');
    assert.match(await page.textContent('#list'), /Trashed note/);
    assert.equal((await q('#emptyTrash', ['boxShadow']))[0].includes('inset'), true, 'Empty Trash is an outlined button');
    await page.click('[data-restore]');
    await page.waitForTimeout(300);
    await page.click('#collBack');
  });

  await step(scheme + ': Reminders: the views have a mustard thumb, lists are Retro colours, ticks are round', async () => {
    await page.click('.tab[data-tab="rem"]');
    await page.waitForSelector('#seg button');
    await page.waitForTimeout(900);
    assert.deepEqual(await page.$$eval('#seg button', bs => bs.map(b => b.textContent.replace(/\d+/, '').trim())), ['Today', 'Upcoming', 'Flagged', 'All']);
    assert.equal((await q('#seg .slthumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard thumb on the views');
    assert.equal((await q('#listChips .slthumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'and on the lists');
    assert.equal((await q('#seg', ['backgroundColor']))[0], cream);
    assert.equal((await q('#remView .rgroup', ['backgroundColor']))[0], cream);
    assert.equal((await q('#remView .rgroup', ['borderRadius']))[0], '20px');
    assert.equal((await q('#quickAdd .send', ['backgroundColor']))[0], orange, 'the add button is solid orange');
    // a list's colour: Personal (#3B82F6 in Notes) is teal here, Home (#F59E0B) mustard, Groceries (#10B981) olive
    const rings = await page.$$eval('.todo .check', cs => cs.map(c => [c.closest('.todo').querySelector('.t').textContent, getComputedStyle(c).borderTopColor, getComputedStyle(c).borderRadius]));
    const ring = n => rings.find(r => r[0] === n);
    assert.equal(ring('Renew passport')[1], teal, 'Personal is teal');
    assert.equal(ring('Renew passport')[2], '50%', 'a round tick');
    await page.click('#seg [data-view="all"]');
    await page.waitForTimeout(500);
    const rings2 = await page.$$eval('.todo .check', cs => cs.map(c => [c.closest('.todo').querySelector('.t').textContent, getComputedStyle(c).borderTopColor]));
    assert.equal(rings2.find(r => r[0] === 'Fix the gate latch')[1], 'rgb(227, 167, 47)', 'Home is mustard');
    await page.click('#listChips [data-list="l3"]');
    await page.waitForTimeout(500);
    const rings3 = await page.$$eval('.todo .check', cs => cs.map(c => getComputedStyle(c).borderTopColor));
    assert.ok(rings3.length >= 2 && rings3.every(c => c === (scheme === 'light' ? 'rgb(126, 140, 52)' : 'rgb(163, 176, 74)')), 'Groceries is olive: ' + rings3.join(' '));
    await page.click('#listChips [data-list=""]');
    await shot(page, '04-reminders-' + scheme);
  });

  await step(scheme + ': add a reminder, tick it off, open its details', async () => {
    await page.fill('#qa', 'Buy stamps tomorrow #errands');
    await page.press('#qa', 'Enter');
    await page.waitForTimeout(400);
    await page.click('#seg [data-view="upcoming"]');
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.todo', { hasText: 'Buy stamps' }).count(), 1);
    await page.click('.todo:has-text("Buy stamps") .check');
    await page.waitForTimeout(300);
    assert.equal(await page.getAttribute('.todo:has-text("Buy stamps") .check', 'aria-checked'), 'true');
    assert.equal((await q('.todo:has-text("Buy stamps") .check', ['backgroundColor']))[0], teal, 'a ticked box fills with its list colour');
    await page.click('.todo:has-text("Call the bank") .tbody').catch(async () => { await page.click('#seg [data-view="all"]'); await page.click('.todo:has-text("Call the bank") .tbody'); });
    await page.waitForSelector('#todoSheet:not([hidden])');
    await page.waitForTimeout(600);
    const [sbg, sradius, sfilter] = await q('#todoSheet .sheet', ['backgroundColor', 'borderRadius', 'backdropFilter']);
    assert.equal(sbg, cream, 'the sheet is a flat panel'); assert.equal(sradius, '28px'); assert.ok(sfilter === 'none' || sfilter === '');
    assert.equal((await q('#tdDone', ['backgroundColor']))[0], orange, 'Done is solid orange');
    assert.equal((await q('#tdQuick .slthumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard thumb under When');
    assert.equal((await q('#tdDelete', ['backgroundColor']))[0], 'rgba(0, 0, 0, 0)', 'Delete is outlined, not filled');
    await shot(page, '05-details-' + scheme);
    await page.click('#tdFlag');
    assert.equal(await page.getAttribute('#tdFlag', 'aria-checked'), 'true');
    await page.click('#tdDone');
    await page.waitForTimeout(300);
  });

  await step(scheme + ': a new list: its colour choices are the seven Retro colours', async () => {
    await page.click('#addList');
    await page.waitForSelector('#listSheet:not([hidden])');
    const colors = await page.$$eval('#lsColors .swatch', bs => bs.map(b => [b.dataset.c, getComputedStyle(b).backgroundColor]));
    assert.equal(colors.length, 7);
    assert.deepEqual(colors.map(c => c[0]), ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#EF4444'], 'stored as the same hex values as Notes');
    assert.equal(colors[0][1], teal); assert.equal(colors[1][1], 'rgb(227, 167, 47)');
    assert.ok(!colors.some(c => c[1] === 'rgb(59, 130, 246)'), 'not iOS blue');
    await page.fill('#lsName', 'Errands');
    await page.click('#lsColors [data-c="#8B5CF6"]');
    await page.click('#lsSave');
    await page.waitForTimeout(300);
    const saved = await page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)), KEY);
    assert.equal(saved.lists.find(l => l.name === 'Errands').color, '#8B5CF6', 'saved as Notes would');
  });

  await step(scheme + ': the Google Sheet and Backup sheets, a toast, and the "Updated" pill are flat too', async () => {
    await page.click('#remView [data-open-backup]');
    await page.waitForSelector('#backupSheet:not([hidden])');
    await page.waitForTimeout(500);
    assert.match(await page.textContent('#bkSheetSub'), /Not connected/);
    assert.equal((await q('#backupSheet .rgroup', ['borderRadius']))[0], '20px');
    await page.click('#bkSheet');
    await page.waitForSelector('#syncSheet:not([hidden])');
    assert.match(await page.inputValue('#syUrl'), /^https:\/\/script\.google\.com\/macros\/s\//, 'the owner\'s Sheet link is filled in');
    assert.equal(await page.inputValue('#sySecret'), '', 'the secret phrase is never filled in');
    assert.equal((await q('#syConnect', ['backgroundColor']))[0], orange, 'Connect is solid orange');
    await page.click('#syncSheet [data-close]');
    await page.evaluate(() => { document.getElementById('toastMsg').textContent = 'Moved to Trash'; document.getElementById('toast').hidden = false; });
    const [tbg, tfilter] = await q('#toast', ['backgroundColor', 'backdropFilter']);
    assert.equal(tbg, scheme === 'light' ? 'rgb(240, 229, 208)' : 'rgb(61, 51, 44)'); assert.ok(tfilter === 'none' || tfilter === '');
    await page.evaluate(() => { document.getElementById('toast').hidden = true; document.getElementById('updPill').hidden = false; });
    assert.equal((await q('#updPill', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(240, 229, 208)' : 'rgb(61, 51, 44)');
    await page.evaluate(() => { document.getElementById('updPill').hidden = true; });
  });

  await step(scheme + ': step by step is Retro too (a recipe, its ingredients and steps)', async () => {
    await page.click('.tab[data-tab="notes"]');
    await page.waitForSelector('#list');
    await page.click('#fab');
    await page.waitForSelector('#editor:not([hidden])');
    await page.fill('#edTitle', 'Pancakes');
    await page.fill('#edBody', 'INGREDIENTS\n• 1 cup flour\n• 1 egg\n\nMETHOD\n1. Whisk the flour and the egg.\n2. Fry until golden.');
    await page.dispatchEvent('#edBody', 'input');
    await page.click('#edCook');
    await page.waitForSelector('#cook:not([hidden])');
    await page.waitForTimeout(500);
    assert.equal((await q('#cook', ['backgroundColor']))[0], ground);
    assert.equal((await q('#cook', ['backgroundColor'], '::before'))[0], 'rgb(227, 167, 47)', 'a mustard sun');
    assert.equal((await q('#ckCard', ['backgroundColor']))[0], cream);
    assert.equal((await q('#ckBar', ['backgroundColor']))[0], teal);
    await page.click('#ckDots + #ckNext').catch(() => {});
    await page.click('#ckNext');
    await page.waitForTimeout(400);
    assert.match(await page.textContent('#ckCard'), /Step 1 of 2/);
    await shot(page, '06-cook-' + scheme);
    await page.click('#ckClose');
    await page.click('#edDelete').catch(() => {});
    await page.waitForTimeout(300);
  });

  await step(scheme + ': its own storage and Calendar layer: nothing under Notes\' names', async () => {
    const shared = await page.evaluate(() => { window.__shared = []; const o = AllisonOS.layer.share; AllisonOS.layer.share = (a, d) => { window.__shared.push(a); return o(a, d); }; return true; });
    assert.ok(shared);
    await page.click('.tab[data-tab="rem"]');
    await page.fill('#qa', 'One more thing');
    await page.press('#qa', 'Enter');
    await page.waitForTimeout(500);
    assert.deepEqual([...new Set(await page.evaluate(() => window.__shared))], ['notesv'], 'Calendar\'s Notes layer is kept under its own name');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    const mine = keys.filter(x => /notes/i.test(x));
    assert.ok(mine.length >= 3, 'it keeps things: ' + mine.join(', '));
    assert.ok(mine.every(x => x === KEY || x.startsWith(KEY + '-')), 'every key is ' + KEY + '…: ' + mine.join(', '));
    assert.ok(!keys.includes('allison-notes-v1') && !keys.some(x => x.startsWith('allison-notes-v1-')), 'nothing of Notes\'');
    // the Sheet link and code are also kept in IndexedDB; connect a stubbed Sheet to see which one
    await ctx.route('https://script.google.com/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, app: 'allison-notes-sync', v: 1, notes: [], todos: [], lists: [], graves: {} }) }));
    await page.click('#remView [data-open-backup]');
    await page.click('#bkSheet');
    await page.fill('#sySecret', 'maple-otter');
    await page.click('#syConnect');
    await page.waitForFunction(() => !document.getElementById('syOn').hidden, null, { timeout: 8000 });
    assert.ok(await page.evaluate(KEY => !!localStorage.getItem(KEY + '-sync'), KEY), 'the Sheet link is kept under its own key');
    await page.waitForTimeout(500);
    const dbs = await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name));
    assert.deepEqual(dbs, ['allison-notesv'], 'the Sheet copy is in its own IndexedDB');
    await page.click('#syncSheet [data-close]');
  });

  await step(scheme + ': the service worker and manifest are its own', async () => {
    const sw = fs.readFileSync(path.join(ROOT, 'notesvintage/sw.js'), 'utf8');
    assert.match(sw, /const CACHE = 'notesvintage-v1'/);
    assert.match(sw, /startsWith\('notesvintage-'\)/);
    for (const f of ['icon.svg?v=1', 'icon-180.png?v=1', 'icon-512.png?v=1', 'manifest.webmanifest?v=1', 'app.js', 'index.html', '../home/slide.js', '../home/welcome.js', '../home/aisles.js', '../home/account.js']) {
      assert.ok(fs.existsSync(path.join(ROOT, 'notesvintage', f.split('?')[0])), f + ' exists (the offline shell lists it)');
      assert.ok(sw.includes("'" + f + "'"), f + ' is in the shell');
    }
    const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'notesvintage/manifest.webmanifest'), 'utf8'));
    assert.equal(mf.related_applications[0].url, 'https://tomallison24-news.pages.dev/notesvintage/manifest.webmanifest');
    assert.equal(mf.theme_color, '#241E1A');
    const html = fs.readFileSync(path.join(ROOT, 'notesvintage/index.html'), 'utf8');
    assert.match(html, /data-app="notesvintage"/);
    assert.match(html, /apple-mobile-web-app-status-bar-style" content="default"/);
    assert.match(html, /theme-color" content="#F4ECDD" media="\(prefers-color-scheme: light\)"/);
    assert.match(html, /theme-color" content="#241E1A" media="\(prefers-color-scheme: dark\)"/);
  });

  await step(scheme + ': nothing tripped the Content Security Policy, no errors on the page', async () => {
    assert.deepEqual(await page.evaluate(() => window.__csp || []), []);
    assert.deepEqual(problems, []);
  });
  await ctx.close();
}

await browser.close(); server.close();
console.log(failed ? '\n' + failed + ' failed' : '\nall passed');
process.exit(failed ? 1 : 0);
