// Drives Notes in headless Chromium at iPhone size (390 x 844), light and dark:
// the notes home (pinned, collections, recent, the grid and the list), a
// collection, writing and editing a note, a note's colour, trash and undo, the
// Reminders (views, lists, quick add, ticking one off, the details sheet, a new
// list), the swipe actions, and that nothing trips the page's Content Security
// Policy. In both designs (../home/design.js):
// - Vintage, the default, drawn in the Retro look (the sky held at day,
//   aos.sky): Futura, flat cream (walnut) cards, a mustard thumb, an orange add
//   button, the atomic shapes behind the title, a note's colour, a list's colour
//   and a tag's colour in the Retro palette;
// - Standard (Sea glass): the Vintage block switched off, no sky, the glass
//   icon and a translucent status bar, list and tag colours as hex and hues;
// - Settings > Design (the first section of Settings, the gear) switches
//   between them at once, redraws the list colours and keeps the choice;
// - the old Notes Vintage address (served from notes/, as the deploy does)
//   moves that app's data on the phone over to Notes' names, once (its Sheet
//   link in IndexedDB too, and its Calendar layer 'notesv' is emptied), and a
//   phone with both keeps Notes' own.
// And that Notes' storage is its own: every key is allison-notes-v1*, the Sheet
// copy is in IndexedDB allison-notes, the Calendar layer is 'notes'.
// (Notes' tests of the notifications, the grocery sections and hostile data:
// push-app-test, aisles-app-test and security-test.)
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node notes/scripts/app-test.mjs [repo root] [screenshot dir]
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
  p = p.replace(/^\/notesvintage\//, '/notes/');   // the old Notes Vintage address: the deploy copies notes/ there (news.yml)
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
const KEY = 'allison-notes-v1';

const browser = await chromium.launch();
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n  ', e.message.split('\n').slice(0, 6).join('\n   ')); } };
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const calls = [];
// getComputedStyle gives a colour as rgb(…), or as color(srgb r g b) (0 to 1) for a colour-mix: read both
const rgbOf = c => { const n = (c.match(/[\d.]+/g) || []).map(Number); return /^color\(/.test(c) ? n.slice(0, 3).map(v => Math.round(v * 255)) : n.slice(0, 3); };

for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, timezoneId: 'America/New_York', locale: 'en-US', serviceWorkers: 'block' });
  await ctx.addInitScript(() => (localStorage.setItem('aos.sky', 'day'), localStorage.setItem('aos.seen', JSON.stringify({ notes: '999' }))));   // no aOS walkthrough over the page; the Vintage sky held still
  await ctx.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { window.__csp = (window.__csp || []).concat(e.violatedDirective + ' ' + e.blockedURI); }));
  await ctx.route('**/calendar/api/**', route => route.fulfill({ status: 503, json: {} }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404/.test(m.text())) problems.push(m.text()); });   // welcome.js asks ../aOS/api/state, which this static server doesn't have
  page.on('pageerror', e => problems.push(String(e)));
  await page.goto(BASE + '/notes/');
  await page.evaluate(([seed, KEY]) => { localStorage.setItem(KEY, JSON.stringify(seed)); localStorage.setItem(KEY + '-backup', String(Date.now())); localStorage.setItem(KEY + '-tab', 'notes'); }, [seed, KEY]);
  await page.reload();
  await page.waitForSelector('#list .ctile');
  await page.waitForTimeout(900);
  const q = (sel, props, pseudo) => page.$eval(sel, (e, [props, pseudo]) => { const c = getComputedStyle(e, pseudo || null); return props.map(p => c[p]); }, [props, pseudo]);
  const cream = scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', ground = scheme === 'light' ? 'rgb(241, 223, 187)' : 'rgb(74, 57, 30)';
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

  await step(scheme + ': Vintage by default: the Vintage styles on, the Vintage icon, a status bar that is not translucent', async () => {
    assert.equal(await page.evaluate(() => document.documentElement.dataset.look), 'vintage');
    assert.equal(await page.evaluate(() => document.getElementById('vintage').media), 'all');
    const icon = await page.getAttribute('link[rel="apple-touch-icon"]', 'href');
    assert.ok(/^icon-180\.png/.test(icon), icon);
    assert.equal(await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'default');
    assert.equal(await page.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content'), scheme === 'light' ? '#F1DFBB' : '#4A391E', 'the bar is the sky\'s ground (home/sky.js)');
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
    const [r, g, b] = rgbOf(ybg);
    assert.ok(r > b + 30 && r >= g, 'tinted mustard (warm, not blue): ' + ybg);
    assert.ok(/ 0px 0px 0px 1\.5px inset$/.test(yshadow), 'a ring, no drop shadow: ' + yshadow);
    assert.ok(yblur === 'none' || yblur === '');
    const [bbg] = await q('.card[data-color="blue"]', ['backgroundColor']);
    const [br, bg2, bb] = rgbOf(bbg);
    assert.ok(bg2 > br && bb >= br, 'a "blue" note is tinted teal (greenish blue, not iOS blue): ' + bbg);
    assert.match(await page.$eval('.tchip', e => e.getAttribute('style')), /--tc:var\(--tc\d\)/, 'a tag takes one of the ten Retro colours (tokens)');
    assert.ok((await q('.tchip', ['boxShadow']))[0].includes('inset'), 'drawn as an outlined Retro chip');
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
    await page.waitForTimeout(400);
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
    assert.match(await page.$eval('.todo', e => e.getAttribute('style')), /^--lc:var\(--lc\d\);--lci:var\(--lci\d\)/, 'a list\'s colour is a Retro token');
    // a list's colour: Personal (#3B82F6, as stored) is teal here, Home (#F59E0B) mustard, Groceries (#10B981) olive
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
    await page.click('#ckNext');
    await page.waitForTimeout(400);
    assert.match(await page.textContent('#ckCard'), /Step 1 of 2/);
    await shot(page, '06-cook-' + scheme);
    await page.click('#ckClose');
    await page.click('#edBack');
    await page.waitForTimeout(300);
  });

  await step(scheme + ': its storage and Calendar layer are Notes\' (allison-notes-v1…, IndexedDB allison-notes, \'notes\')', async () => {
    const shared = await page.evaluate(() => { window.__shared = []; const o = AllisonOS.layer.share; AllisonOS.layer.share = (a, d) => { window.__shared.push(a); return o(a, d); }; return true; });
    assert.ok(shared);
    await page.click('.tab[data-tab="rem"]');
    await page.fill('#qa', 'One more thing');
    await page.press('#qa', 'Enter');
    await page.waitForTimeout(500);
    assert.deepEqual([...new Set(await page.evaluate(() => window.__shared))], ['notes'], 'Calendar\'s Notes layer, under Notes\' name (\'notesv\' is only at the old Notes Vintage address)');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    const mine = keys.filter(x => /notes/i.test(x) && !x.startsWith('design.'));
    assert.ok(mine.length >= 3, 'it keeps things: ' + mine.join(', '));
    assert.ok(mine.every(x => x === KEY || x.startsWith(KEY + '-')), 'every key is ' + KEY + '…: ' + mine.join(', '));
    assert.ok(!keys.some(x => x.startsWith('allison-notesv-')), 'nothing under the old Notes Vintage names');
    // the Sheet link and code are also kept in IndexedDB; connect a stubbed Sheet to see which one
    await ctx.route('https://script.google.com/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, app: 'allison-notes-sync', v: 1, notes: [], todos: [], lists: [], graves: {} }) }));
    await page.click('#remSetBtn');
    await page.click('#bkSheet');
    await page.fill('#sySecret', 'maple-otter');
    await page.click('#syConnect');
    await page.waitForFunction(() => !document.getElementById('syOn').hidden, null, { timeout: 8000 });
    // saved once the Sheet has answered, which can be a moment after the form switches: wait for it, don't race it
    await page.waitForFunction(KEY => !!localStorage.getItem(KEY + '-sync'), KEY, { timeout: 8000 }).catch(() => { throw new Error('the Sheet link is kept under Notes\' key'); });
    await page.waitForFunction(async () => (await indexedDB.databases()).some(d => d.name === 'allison-notes'), null, { timeout: 8000 });
    await page.waitForTimeout(500);
    const dbs = await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name));
    assert.deepEqual(dbs, ['allison-notes'], 'the Sheet copy is in Notes\' IndexedDB');
    await page.click('#syncSheet [data-close]');
  });

  await step(scheme + ': the service worker, manifest and page head', async () => {
    const sw = fs.readFileSync(path.join(ROOT, 'notes/sw.js'), 'utf8');
    assert.match(sw, /const CACHE = 'notes-v\d+'/);
    assert.match(sw, /startsWith\('notesvintage-'\)/, 'the old Notes Vintage app\'s cache is cleared');
    const shell = JSON.parse(/const SHELL = (\[[^\]]*\])/.exec(sw)[1].replace(/'/g, '"'));
    for (const f of shell.filter(f => f !== './')) assert.ok(fs.existsSync(path.join(ROOT, 'notes', f.split('?')[0])), f + ' exists (the offline shell lists it)');
    for (const f of ['index.html', 'app.js', '../home/design.js', '../home/sky.js', '../home/slide.js', '../home/welcome.js', '../home/aisles.js', '../home/account.js']) assert.ok(shell.includes(f), f + ' is in the shell');
    assert.ok(shell.some(f => /^icon-glass-180\.png/.test(f)) && shell.some(f => /^icon-180\.png/.test(f)), 'both designs\' icons are in the shell');
    const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'notes/manifest.webmanifest'), 'utf8'));
    assert.equal(mf.related_applications[0].url, 'https://tomallison24-news.pages.dev/notes/manifest.webmanifest');
    assert.equal(mf.theme_color, '#241E1A');
    const html = fs.readFileSync(path.join(ROOT, 'notes/index.html'), 'utf8');
    assert.match(html, /welcome\.js" data-app="notes"/);
    assert.match(html, /design\.js" data-app="notes" data-was="notesvintage" data-keys="allison-notesv-=allison-notes-" data-dbs="allison-notesv=allison-notes"/);
    const at = x => html.indexOf(x);
    assert.ok(at('<style id="vintage">') > 0 && at('<style id="vintage">') < at('<script src="../home/design.js"') && at('<script src="../home/design.js"') < at('<script src="../home/sky.js"') && at('<script src="../home/sky.js"') < at('</head>'), 'the Vintage block, then design.js, then sky.js, in <head>');
    assert.match(html, /apple-mobile-web-app-status-bar-style" content="black-translucent"/);
    assert.match(html, /theme-color" content="#EEF2F0" media="\(prefers-color-scheme: light\)"/);
    assert.match(html, /theme-color" content="#0D1213" media="\(prefers-color-scheme: dark\)"/);
  });

  await step(scheme + ': nothing tripped the Content Security Policy, no errors on the page', async () => {
    assert.deepEqual(await page.evaluate(() => window.__csp || []), []);
    assert.deepEqual(problems, []);
  });
  await ctx.close();
}

// ---- both designs: Standard, Settings > Design, the old Notes Vintage address, a phone with both ----
// A fresh phone: `seed` is what localStorage holds before the app first opens (default: Notes' data, seen),
// `design` what Settings > Design was set to, `at` the address it opens, `idb` an IndexedDB to make first.
async function phone(scheme, { design = null, seed = null, at = '/notes/', idb = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, timezoneId: 'America/New_York', locale: 'en-US', serviceWorkers: 'block' });
  await ctx.route('**/calendar/api/**', route => route.fulfill({ status: 503, json: {} }));
  await ctx.route('https://script.google.com/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, app: 'allison-notes-sync', v: 1, notes: [], todos: [], lists: [], graves: {} }) }));
  await ctx.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { window.__csp = (window.__csp || []).concat(e.violatedDirective + ' ' + e.blockedURI); }));
  // what the app sends to Calendar (welcome.js AllisonOS.layer.share), from its first save on: wrapped before app.js's own 'load'
  await ctx.addInitScript(() => addEventListener('load', () => { const L = window.AllisonOS && AllisonOS.layer; if (!L) return; const o = L.share; L.share = (a, d) => { (window.__shared = window.__shared || []).push([a, d]); return o(a, d); }; }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404/.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', e => problems.push(String(e)));
  // seed on a page of the site that runs no app, so nothing is moved or written before the app opens
  await page.goto(BASE + '/notes/manifest.webmanifest');
  await page.evaluate(async ([seed, design, idb, KEY, data]) => {
    localStorage.clear();
    const s = seed || { 'aos.seen': JSON.stringify({ notes: '999' }), [KEY]: JSON.stringify(data), [KEY + '-backup']: String(Date.now()) };
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    localStorage.setItem('aos.sky', 'day');
    if (design) localStorage.setItem('design.notes', design);
    if (idb) await new Promise((res, rej) => { const r = indexedDB.open(idb.name, 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onerror = () => rej(r.error);
      r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); for (const [k, v] of Object.entries(idb.kv)) t.objectStore('kv').put(v, k); t.oncomplete = () => { r.result.close(); res(); }; t.onerror = () => rej(t.error); }; });
  }, [seed, design, idb, KEY, seed ? null : { notes, lists, todos }]);
  await page.goto(BASE + at);
  await page.waitForTimeout(1200);
  const q = (sel, props, pseudo) => page.$eval(sel, (e, [props, pseudo]) => { const c = getComputedStyle(e, pseudo || null); return props.map(p => c[p]); }, [props, pseudo]);
  return { ctx, page, q, problems };
}
const look = page => page.evaluate(() => document.documentElement.dataset.look);
const clean = async (page, problems) => { assert.deepEqual(await page.evaluate(() => window.__csp || []), [], 'nothing trips the page policy'); assert.deepEqual(problems, [], 'no errors on the page'); };

for (const scheme of ['light', 'dark']) {
  await step(scheme + ' Standard: Sea glass, the Vintage styles off, no sky; the icon, status bar and bar colour follow', async () => {
    const { ctx, page, q, problems } = await phone(scheme, { design: 'glass' });
    await page.waitForSelector('#list .ctile');
    assert.equal(await look(page), 'glass');
    assert.equal(await page.evaluate(() => document.getElementById('vintage').media), 'not all');
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-sky')), false, 'no sky');
    assert.equal((await q('body', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(238, 242, 240)' : 'rgb(13, 18, 19)', 'the Sea glass ground');
    assert.doesNotMatch((await q('body', ['fontFamily']))[0], /Futura/);
    assert.notEqual((await q('#notesView .title', ['fontSize']))[0], '44px');
    assert.equal((await q('#notesView .title', ['backgroundImage'], '::after'))[0], 'none', 'no little bars under the title');
    assert.notEqual((await q('#list .ctile', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', 'not a cream card');
    assert.match(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'), /^icon-glass-180\.png/);
    assert.equal(await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'black-translucent');
    assert.equal(await page.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content'), scheme === 'light' ? '#EEF2F0' : '#0D1213');
    // a tag is a hue of the colour wheel, a list its own hex
    await page.click('[data-coll="all"]'); await page.waitForSelector('.grid .card');
    const [tcol, tborder] = await q('.tchip', ['color', 'borderTopWidth']);
    assert.equal(tborder, '1px', 'a tag chip has its glass hairline');
    await shot(page, 'glass-all-' + scheme);
    await page.click('#collBack');
    await page.click('.tab[data-tab="rem"]'); await page.waitForSelector('#seg button'); await page.waitForTimeout(600);
    assert.match(await page.$eval('.todo', e => e.getAttribute('style')), /^--lc:#[0-9A-F]{6};/i, 'a list\'s colour is its own hex');
    const ring = await page.$$eval('.todo .check', cs => cs.map(c => [c.closest('.todo').querySelector('.t').textContent, getComputedStyle(c).borderTopColor]));
    assert.equal(ring.find(r => r[0] === 'Renew passport')[1], 'rgb(59, 130, 246)', 'Personal is its blue');
    await shot(page, 'glass-reminders-' + scheme);
    await clean(page, problems);
    await ctx.close();
  });
}

await step('Settings > Design: the first section of Settings; Standard and back, at once, redrawn, kept across a reload', async () => {
  const { ctx, page, problems } = await phone('light');
  assert.equal(await look(page), 'vintage', 'Vintage by default');
  await page.click('#setBtn');
  await page.waitForSelector('#backupSheet:not([hidden])');
  assert.equal(await page.textContent('#bkLbl'), 'Settings');
  assert.equal(await page.$eval('#bkBody > :first-child .label', e => e.textContent), 'Design', 'Design is the first section');
  assert.equal(await page.$$eval('#bkBody > :first-child [data-design]', bs => bs.map(b => b.dataset.design + ':' + b.getAttribute('aria-checked')).join(' ')), 'vintage:true glass:false');
  assert.match(await page.textContent('#bkBody > :first-child .hint'), /Just on this phone, and at once/);
  await shot(page, 'settings-vintage-light');
  await page.click('#bkDesign [data-design="glass"]'); await page.waitForTimeout(250);
  assert.equal(await look(page), 'glass', 'Standard at once');
  assert.equal(await page.getAttribute('#bkDesign [data-design="glass"]', 'aria-checked'), 'true');
  assert.ok(await page.isVisible('#backupSheet'), 'Settings stays open');
  assert.match(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'), /^icon-glass-180\.png/);
  await shot(page, 'settings-glass-light');
  await page.click('#backupSheet .sheethead [data-close]'); await page.waitForTimeout(400);
  // the thumb under Notes / Reminders is measured again (Futura and the system font are different widths)
  const fits = () => page.evaluate(() => { const t = document.querySelector('.tabs > .slthumb'), b = document.querySelector('.tab[aria-selected="true"]'); if (!t) return true; const a = t.getBoundingClientRect(), c = b.getBoundingClientRect(); return Math.abs(a.left - c.left) < 2 && Math.abs(a.width - c.width) < 2; });
  assert.ok(await fits(), 'the thumb fits its tab in Standard');
  await page.click('.tab[data-tab="rem"]'); await page.waitForSelector('#seg button'); await page.waitForTimeout(500);
  assert.match(await page.$eval('.todo', e => e.getAttribute('style')), /^--lc:#/, 'Standard draws a list as its hex');
  await page.reload(); await page.waitForTimeout(900);
  assert.equal(await look(page), 'glass', 'Standard is kept');
  assert.equal(await page.evaluate(() => localStorage.getItem('design.notes')), 'glass');
  await page.click('#remSetBtn'); await page.waitForSelector('#backupSheet:not([hidden])');
  await page.click('#bkDesign [data-design="vintage"]'); await page.waitForTimeout(300);
  assert.equal(await look(page), 'vintage', 'back to Vintage at once');
  assert.match(await page.$eval('.todo', e => e.getAttribute('style')), /^--lc:var\(--lc\d\)/, 'and the lists are redrawn in Retro colours at once');
  await page.click('#backupSheet .sheethead [data-close]'); await page.waitForTimeout(400);
  assert.ok(await fits(), 'the thumb fits its tab in Vintage');
  await page.reload(); await page.waitForTimeout(900);
  assert.equal(await look(page), 'vintage', 'Vintage is kept');
  assert.equal(await page.evaluate(() => localStorage.getItem('design.notes')), 'vintage');
  await clean(page, problems);
  await ctx.close();
});

const theirs = { notes: [N('From Notes Vintage', 'Written in the old app', { tags: ['old'] })], lists: [{ id: 'l1', updated: 1, name: 'Personal', color: '#3B82F6' }], todos: [T('l1', 'Vintage reminder', { date: day(0) })] };
const SYNC = { url: 'https://script.google.com/macros/s/OLDVINTAGE/exec', secret: 'old-otter' };
await step('the old Notes Vintage address: its data is now Notes\', once; what it had seen and its Sheet link carry over; its Calendar layer keeps its own name, notesv', async () => {
  // (seen as '999', as every browser test seeds it, so no update screen covers the page after the next release)
  const seed = { 'aos.seen': JSON.stringify({ notesvintage: '999' }), 'allison-notesv-v1': JSON.stringify(theirs), 'allison-notesv-v1-tab': 'rem', 'allison-notesv-v1-backup': String(Date.now()),
    'allison-notesv-v1-sync': JSON.stringify(SYNC), 'allison-notesv-v1-push': JSON.stringify({ nudges: false }) };
  const { ctx, page, problems } = await phone('light', { seed, at: '/notesvintage/', idb: { name: 'allison-notesv', kv: { sync: { url: SYNC.url, secret: SYNC.secret } } } });
  await page.click('#seg [data-view="all"]');   // (the reminder is due today in New York, which may not be today where the test runs)
  await page.waitForSelector('.todo');
  assert.equal(await look(page), 'vintage', 'in Vintage');
  assert.equal(await page.isVisible('#remView'), true, 'it opens on the tab it was on');
  assert.match(await page.textContent('#remBody'), /Vintage reminder/, 'its reminders are there');
  const got = await page.evaluate(() => ({ data: JSON.parse(localStorage.getItem('allison-notes-v1')), sync: JSON.parse(localStorage.getItem('allison-notes-v1-sync')), push: JSON.parse(localStorage.getItem('allison-notes-v1-push')), seen: JSON.parse(localStorage.getItem('aos.seen')), old: localStorage.getItem('allison-notesv-v1') }));
  assert.ok(got.data.notes.some(n => n.title === 'From Notes Vintage'), 'its notes are Notes\' now');
  assert.equal(got.sync.url, SYNC.url, 'its Google Sheet link');
  assert.equal(got.push.nudges, false, 'its notification choices');
  assert.equal(got.seen.notes, '999', 'what it had seen (no walkthrough again)');
  assert.ok(got.old, 'nothing old is deleted');
  await page.waitForFunction(async () => (await indexedDB.databases()).some(d => d.name === 'allison-notes'), null, { timeout: 8000 });
  const copy = await page.evaluate(() => new Promise(res => { const r = indexedDB.open('allison-notes'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('sync'); q.onsuccess = () => { res(q.result || null); r.result.close(); }; q.onerror = () => res(null); }; r.onerror = () => res(null); }));
  assert.deepEqual(copy, { url: SYNC.url, secret: SYNC.secret }, 'the IndexedDB copy of the Sheet link, under Notes\' name');
  await page.click('.todo:has-text("Vintage reminder") .check'); await page.waitForTimeout(400);   // a change: Calendar's layer is sent
  const sent = await page.evaluate(() => (window.__shared || []).map(([a, d]) => [a, d.todos.length + d.notes.length + d.lists.length]));
  assert.deepEqual([...new Set(sent.map(([a]) => a))], ['notesv'], 'Calendar\'s layer keeps the old app\'s name here, so a phone with both keeps two copies: ' + JSON.stringify(sent));
  assert.ok(sent.every(([, n]) => n > 0), 'with its reminders in it');
  // once only: a later change to the old keys is not copied again
  const before = await page.evaluate(() => localStorage.getItem('allison-notes-v1'));
  await page.evaluate(() => localStorage.setItem('allison-notesv-v1-tab', 'notes'));
  await page.reload(); await page.waitForTimeout(900);
  assert.equal(await page.evaluate(() => localStorage.getItem('allison-notes-v1-tab')), 'rem', 'moved once only');
  assert.equal(await page.evaluate(() => localStorage.getItem('allison-notes-v1')), before, 'and Notes\' data is left as it was');
  await clean(page, problems);
  await ctx.close();
});

await step('a phone with both: Notes\' own data is kept, the old app\'s is not copied over it', async () => {
  const mineData = { notes: [N('Mine', 'Written in Notes')], lists: [{ id: 'l1', updated: 1, name: 'Personal', color: '#3B82F6' }], todos: [] };
  const seed = { 'aos.seen': JSON.stringify({ notes: '999', notesvintage: '999' }), 'allison-notes-v1': JSON.stringify(mineData), 'allison-notes-v1-tab': 'notes', 'allison-notes-v1-backup': String(Date.now()),
    'allison-notesv-v1': JSON.stringify(theirs), 'allison-notesv-v1-tab': 'rem' };
  const { ctx, page, problems } = await phone('light', { seed });
  await page.waitForSelector('#list');
  const got = await page.evaluate(() => ({ data: JSON.parse(localStorage.getItem('allison-notes-v1')), tab: localStorage.getItem('allison-notes-v1-tab') }));
  assert.deepEqual(got.data.notes.map(n => n.title), ['Mine'], 'Notes\' notes, and only those');
  assert.equal(got.tab, 'notes');
  assert.match(await page.textContent('#list'), /Mine/);
  assert.doesNotMatch(await page.textContent('#list'), /From Notes Vintage/);
  await clean(page, problems);
  await ctx.close();
});

await browser.close(); server.close();
console.log(failed ? '\n' + failed + ' failed' : '\nall passed');
process.exit(failed ? 1 : 0);
