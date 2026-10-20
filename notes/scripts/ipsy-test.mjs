// Drives Ipsy (home/ipsy.js with notes/ipsy-tools.js) in Notes, in both its designs, light and dark,
// in headless Chromium, against a stand-in for Claude at /notes/api/ipsy and a stand-in for the
// Google Sheet (no network, no keys). Checks: Ipsy just above the Notes / Reminders bar, covering
// none of the dock's buttons and none of the page once it is scrolled to the end; asking once before
// the first question; the chat running the tools Claude asks for on the app's own notes, reminders
// and lists (checking off, adding to a list, choosing an item's store section, sorting a shopping
// note into store sections, finding, reading, writing and changing notes, a reminder's date, time
// and alert, tidying a recipe, opening a note and then changing it); each kind of change with an
// Undo that works; deleting a note only after Yes is tapped in the chat (No leaves it); private
// notes never sent to Claude; changes reaching the Google Sheet through the app's own sync; the
// conversation only ever added to between steps; the chat kept when the app opens again; Ipsy
// changing with the design at once; and no script errors or Content Security Policy violations.
// Dates are worked out from today, so it runs on any day of the week and at the end of a month.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node notes/scripts/ipsy-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
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
const TZ = 'America/New_York';

// ---- what's on the phone (every name is made up) ----
const now = Date.now();
const N = (id, title, body, o = {}) => ({ id, title, body, tags: [], color: 'none', pinned: false, reminder: null, created: now - 3600e3 * id.length, updated: 1, archived: false, deletedAt: null, ...o });
const T = (id, list, title, o = {}) => ({ id, list, title, notes: '', date: null, time: null, prio: 0, flagged: false, done: false, doneAt: null, tags: [], created: now - 1000, updated: 1, ...o });
const SEED = {
  notes: [
    N('nhouse', 'House projects', 'Fix the fence\nPaint the porch #house', { tags: ['house'] }),
    N('nshop', 'Shopping', '- milk\n- bananas\n- paper towels\n- sourdough\n- chicken thighs'),
    N('ncake', 'Pancakes', 'Pancakes for Sunday\nIngredients\n200g flour\n2 eggs\n300ml milk\nMethod\nWhisk everything together.\nCook on a hot pan for 2 minutes a side.'),
    N('nold', 'Old ideas', 'A boat?'),
    N('npriv', 'Gate', 'The gate code is 4321', { private: true }),
  ],
  lists: [{ id: 'l1', updated: 1, name: 'Personal', color: '#3B82F6' }, { id: 'l3', updated: 1, name: 'Groceries', color: '#10B981' }, { id: 'l2', updated: 1, name: 'Home', color: '#F59E0B' }],
  todos: [T('tmilk', 'l3', 'Milk'), T('tban', 'l3', 'Bananas'), T('ttort', 'l3', 'Corn tortillas'), T('tegg', 'l3', 'Eggs', { done: true, doneAt: 1 }), T('tfence', 'l2', 'Fix the fence')],
};
const SECRET = /4321|Gate/;                // the private note's words: they must never reach Claude

// ---- the stand-in for Claude: answers each step from where the conversation is ----
let uid = 0;
const tu = (name, input) => ({ type: 'tool_use', id: 'toolu_' + (++uid), name, input });
const think = { type: 'thinking', thinking: '', signature: 'sig-' + 'x'.repeat(20) };
const said = text => ({ json: { stop_reason: 'end_turn', content: [{ type: 'text', text }] } });
const use = (...uses) => ({ json: { stop_reason: 'tool_use', content: uses } });
const isQ = m => m.role === 'user' && m.content.some(b => b.type === 'text' && !b.text.startsWith('[From the app'));
let DATES = {};
function claude(msgs) {
  const qi = msgs.map(isQ).lastIndexOf(true), q = msgs[qi].content.filter(b => b.type === 'text' && !b.text.startsWith('[From the app')).map(b => b.text).join(' ');
  // this question's tool results so far, by tool name
  const got = {};
  let results = 0;
  for (let i = qi + 1; i < msgs.length; i++) for (const r of msgs[i].role === 'user' ? msgs[i].content : []) if (r.type === 'tool_result') {
    const u = msgs[i - 1].content.find(b => b.type === 'tool_use' && b.id === r.tool_use_id);
    results++;
    got[u.name] = { r, json: (() => { try { return JSON.parse(r.content); } catch { return null; } })() };
  }
  const step = Object.keys(got).length;
  if (/grocer/.test(q)) {
    if (!step) return use(think, tu('get_lists', {}), tu('find_reminders', { list: 'Groceries' }));
    if (!got.set_done) {
      const items = got.find_reminders.json.reminders, id = t => items.find(x => x.title === t).id;
      return use(tu('set_done', { ids: [id('Milk')] }), tu('add_reminders', { list: 'Groceries', items: [{ title: 'Greek yogurt' }, { title: 'Apples #fruit' }] }),
        tu('update_reminder', { id: id('Corn tortillas'), changes: { section: 'pantry' } }));
    }
    if (!got.find_notes) return use(tu('find_notes', { query: 'shopping' }));
    if (!got.sort_into_aisles) return use(tu('sort_into_aisles', { note_id: got.find_notes.json.notes[0].id }));
    return said('Done! I checked off **Milk**, added two things to **Groceries** and sorted your **Shopping** note by aisle.');
  }
  if (/house/.test(q)) {
    if (!step) return use(tu('find_notes', { query: '#house' }), tu('find_reminders', { query: 'fence' }));
    if (!got.read_notes) return use(tu('read_notes', { ids: [got.find_notes.json.notes[0].id] }));
    if (!got.edit_note) return use(
      tu('edit_note', { id: 'nhouse', changes: { append: 'Clean the gutters', add_tags: ['todo'], pinned: true } }),
      tu('update_reminder', { id: got.find_reminders.json.reminders[0].id, changes: { date: DATES.tomorrow, time: '17:00', alert: 15, flagged: true } }),
      tu('create_note', { title: 'Packing list', body: '• Passports\n• Chargers #travel', color: 'green' }),
      tu('tidy_recipe', { id: 'ncake' }));
    return said('All set: the gutters are on your **House projects** note.');
  }
  if (/delete/.test(q)) {
    if (!step) return use(tu('delete_notes', { ids: ['nold', 'npriv'] }));
    return said(got.delete_notes.json.declined ? 'OK, I left it.' : 'Moved it to Trash.');
  }
  if (/show/.test(q)) {
    if (!step) return use(tu('show', { note_id: 'nhouse' }));
    if (!got.edit_note) return use(tu('edit_note', { id: 'nhouse', changes: { title: 'House jobs' } }));
    if (results === 2) return use(tu('show', { list: 'Groceries' }));
    return said('Here it is.');
  }
  if (/secret/.test(q)) {
    if (!step) return use(tu('read_notes', { ids: ['npriv'] }), tu('edit_note', { id: 'npriv', changes: { body: 'leaked' } }));
    return said('That one is private, so I can’t read it.');
  }
  return said('Hello!');
}

const browser = await chromium.launch();
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n  ', e.message.split('\n').slice(0, 8).join('\n   ')); } };
const until = async (fn, what, ms = 10000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await new Promise(r => setTimeout(r, 100)); } };
const texts = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));

// Where Ipsy sits, in each design, light and dark, on both tabs: over none of the dock's buttons, and
// the end of the page can be scrolled clear of it.
for (const design of ['glass', 'vintage']) for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, serviceWorkers: 'block', timezoneId: TZ });
  await ctx.addInitScript(([d, seed]) => {
    localStorage.setItem('aos.seen', JSON.stringify({ notes: '999' })); localStorage.setItem('aos.sky', 'day'); localStorage.setItem('design.notes', d);
    if (!localStorage.getItem('allison-notes-v1')) localStorage.setItem('allison-notes-v1', JSON.stringify(seed));
  }, [design, { ...SEED, notes: [...SEED.notes, ...Array.from({ length: 12 }, (_, i) => N('nfill' + i, 'Note ' + i, 'Some words\nand more words', { tags: ['t' + (i % 4)] }))] }]);
  const page = await ctx.newPage();
  await page.goto(BASE + '/notes/');
  await page.waitForSelector('.dock .ipsy-btn');
  await step(`notes (${design}, ${scheme}): Ipsy sits just above the bar on the left, over no button, and the page scrolls clear of it`, async () => {
    for (const tab of ['notes', 'rem']) {
      await page.click(`.tab[data-tab="${tab}"]`); await page.waitForTimeout(300);
      const g = await page.evaluate(() => {
        const r = e => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
        const ip = r(document.querySelector('.ipsy-btn'));
        const hits = ['.tabs', '#pasteBtn', '#fab', '#qa', '#remBellBtn'].map(s => document.querySelector(s)).filter(e => e && e.offsetParent)
          .filter(e => { const b = r(e); return b.l < ip.r && b.r > ip.l && b.t < ip.b && b.b > ip.t; }).map(e => e.id || e.className);
        scrollTo(0, document.documentElement.scrollHeight);
        const main = [...document.querySelectorAll('main.list')].find(m => m.offsetParent), last = main && main.lastElementChild;
        return { ip, tabs: r(document.querySelector('.tabs')), hits, lastBottom: last ? last.getBoundingClientRect().bottom : 0, design: document.querySelector('.ipsy-btn').className };
      });
      assert.deepEqual(g.hits, [], tab + ': Ipsy covers ' + g.hits.join(', '));
      assert.ok(g.ip.b <= g.tabs.t && g.tabs.t - g.ip.b < 16, tab + ': just above the bar: ' + JSON.stringify(g));
      assert.ok(g.ip.l < 30, tab + ': on the left');
      assert.ok(g.lastBottom <= g.ip.t, tab + ': the end of the page scrolls clear of Ipsy (' + g.lastBottom + ' > ' + g.ip.t + ')');
      assert.ok(g.design.includes('ipsy-' + design));
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `place-${design}-${scheme}-${tab}.png`) });
      await page.evaluate(() => scrollTo(0, 0));
    }
  });
  await ctx.close();
}

for (const [design, scheme] of [['glass', 'light'], ['vintage', 'dark']]) {
  const tag = 'notes (' + design + ')';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, serviceWorkers: 'block', timezoneId: TZ });
  await ctx.addInitScript(([d, seed]) => {
    localStorage.setItem('aos.seen', JSON.stringify({ notes: '999' })); localStorage.setItem('aos.sky', 'day'); localStorage.setItem('design.notes', d);
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('allison-notes-v1', JSON.stringify(seed));
    localStorage.setItem('aos.session', JSON.stringify({ token: 'tok-test', user: { id: 'u1', name: 'Tom', role: 'owner' }, at: 1 }));   // signed in: syncs with the family's Sheet
    localStorage.setItem('allison-notes-v1-backup', String(Date.now()));
  }, [design, SEED]);
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404/.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', e => problems.push(String(e)));
  page.on('console', m => { if (m.type() === 'warning' && /Ipsy/.test(m.text())) problems.push(m.text()); });
  // The family's Google Sheet, through aOS: takes what the phone sends and hands it back, as the script does with one phone.
  const synced = [];
  await ctx.route('**/sheet/api/**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { configured: true } });
    const b = JSON.parse(route.request().postData()); synced.push(b);
    return route.fulfill({ json: { ok: true, app: 'allison-notes-sync', v: 2, aos: true, notes: b.notes, todos: b.todos, lists: b.lists, graves: b.graves } });
  });
  const sent = [];
  await ctx.route('**/notes/api/ipsy', async route => {
    const req = route.request(), raw = req.postData();
    assert.ok(raw.startsWith('{"messages":'), 'the phone sends exactly {"messages":[...]}');
    assert.equal(req.headers()['x-notes'], '1');
    const msgs = JSON.parse(raw).messages;
    sent.push(msgs);
    const a = claude(msgs); if (process.env.DBG) console.log('  stub:', JSON.stringify(a.json).slice(0, 120));
    return route.fulfill({ status: a.status || 200, json: a.json.content ? { id: 'msg_' + sent.length, type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', ...a.json } : a.json });
  });
  await page.goto(BASE + '/notes/');
  await page.waitForSelector('.dock .ipsy-btn');
  await page.waitForFunction(() => document.getElementById('syncPill').hidden, null, { timeout: 10000 });
  DATES = await page.evaluate(() => { const p = n => String(n).padStart(2, '0'), f = d => d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); const d = new Date(); d.setDate(d.getDate() + 1); return { tomorrow: f(d) }; });
  const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('allison-notes-v1')));
  const note = async id => (await data()).notes.find(n => n.id === id);
  const todo = async id => (await data()).todos.find(t => t.id === id);
  const ask = async (text, until) => {
    await page.fill('#ipsyIn', text);
    await page.press('#ipsyIn', 'Enter');
    await page.waitForFunction(re => new RegExp(re).test(document.querySelector('.ipsy-log').textContent) && !document.querySelector('.ipsy-send').disabled, until, { timeout: 15000 });
  };
  const undo = async re => {
    const n0 = await page.$$eval('.ipsy-change.undone', e => e.length);
    await page.locator('.ipsy-change', { hasText: re }).last().locator('.ipsy-undo').click();
    assert.equal(await page.$$eval('.ipsy-change.undone', e => e.length), n0 + 1);
  };

  await step(tag + ': Ipsy opens a chat that asks once before the first question, and says what goes where', async () => {
    assert.equal(await page.$eval('.ipsy-btn', (e, d) => e.classList.contains('ipsy-' + d), design), true, 'Ipsy wears the app\'s design');
    await page.click('.ipsy-btn');
    await page.waitForSelector('.ipsy-bubble');
    await page.waitForFunction(() => document.querySelector('.ipsy-bubble').getAnimations().every(a => a.playState === 'finished'));
    const c = await page.textContent('.ipsy-consent');
    assert.match(c, /notes, reminders and lists Ipsy reads to answer it go to Claude through the family server, which keeps only a count/);
    assert.match(c, /Private notes are hidden from Ipsy/); assert.match(c, /Undo/); assert.match(c, /asks before deleting a note/);
    assert.equal(await page.$eval('#ipsyIn', e => e.disabled), true, 'nothing is sent before OK');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, design + '-consent.png') });
    await page.click('#ipsyOk');
    assert.equal(await page.$$eval('.ipsy-chip[data-ask]', e => e.length), 4);
  });

  await step(tag + ': one question: checks off, adds to a list, picks a store section and sorts a shopping note by aisle', async () => {
    const s0 = synced.length;
    await ask('Sort out my groceries', 'by aisle');
    assert.equal((await todo('tmilk')).done, true, 'Milk checked off');
    const d = await data(), added = d.todos.filter(t => t.list === 'l3' && /Greek yogurt|Apples/.test(t.title));
    assert.deepEqual(added.map(t => t.title), ['Greek yogurt', 'Apples']);
    assert.deepEqual(added[1].tags, ['fruit'], 'a #word becomes a tag, as in quick add');
    assert.equal((await todo('ttort')).aisle, 'pantry');
    assert.equal(d.lists.find(l => l.id === 'l3').learn['corn tortilla'], 'pantry', 'the list learns it, as when you pick a section');
    assert.equal((await note('nshop')).body, 'PRODUCE\n• bananas\n\nBAKERY\n• sourdough\n\nMEAT\n• chicken thighs\n\nDAIRY & EGGS\n• milk\n\nHOUSEHOLD\n• paper towels');
    const ch = await texts(page, '.ipsy-change');
    assert.equal(ch.length, 4, ch.join(' | '));
    assert.match(ch[0], /Checked off “Milk”.*Undo/); assert.match(ch[1], /Added 2 things to Groceries.*Undo/); assert.match(ch[2], /Changed “Corn tortillas” in Groceries.*Undo/); assert.match(ch[3], /Sorted “Shopping” into store sections.*Undo/);
    const acts = await texts(page, '.ipsy-act');
    assert.ok(acts.includes('Looking at your lists') && acts.includes('Adding to Groceries') && acts.includes('Sorting into store sections'), acts.join(' | '));
    assert.equal(await page.locator('.ipsy-it').last().locator('b').first().textContent(), 'Milk');
    // what went to Claude: the note from the app, then only ever added to; nothing private
    assert.match(sent[0][0].content[0].text, /^\[From the app: today is \w+day, .* \(\d{4}-\d\d-\d\d\)\. Notes has 4 notes, plus 1 private one you can’t see, and \d+ open reminders in the lists Personal, Groceries, Home\. On screen: the Notes home\.\]$/);
    assert.equal(sent[0][0].content[1].text, 'Sort out my groceries');
    for (let i = 1; i < sent.length; i++) assert.deepEqual(sent[i].slice(0, sent[i - 1].length), sent[i - 1], 'step ' + i + ' changed an earlier message');
    assert.deepEqual(sent[1][1].content[0], think, 'thinking goes back unchanged');
    assert.equal(sent[2].at(-1).content.length, 3, 'all three tool results in one message');
    const found = JSON.parse(sent[2].at(-1 - 2).content.find(r => /reminders/.test(r.content)).content);
    assert.ok(found.reminders.every(r => r.section), 'a grocery list’s items come with their store section');
    const notesFound = JSON.parse(sent[3].at(-1).content[0].content);
    assert.equal(notesFound.privateNotesNotShown, 1);
    assert.ok(!SECRET.test(JSON.stringify(sent)), 'the private note never went to Claude');
    // and the change went out the app's own way: saved, then synced to the Sheet
    await until(() => synced.length > s0 && synced.at(-1).todos.some(t => t.title === 'Greek yogurt') && synced.at(-1).notes.some(n => n.id === 'nshop' && /PRODUCE/.test(n.body)), 'synced to the Sheet');
    const last = synced.at(-1);
    assert.ok(last.notes.some(n => n.id === 'npriv' && n.private), 'the private note syncs to the Sheet like any other: Private only hides it from Ipsy');
  });
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, design + '-chat-' + scheme + '.png') });

  await step(tag + ': Undo on each kind of change puts it back (and the Sheet hears of it)', async () => {
    await undo(/Added 2 things/);
    assert.equal((await data()).todos.filter(t => /Greek yogurt|Apples/.test(t.title)).length, 0, 'the added items are gone');
    await undo(/Checked off/);
    assert.equal((await todo('tmilk')).done, false);
    await undo(/Corn tortillas/);
    assert.equal((await todo('ttort')).aisle, undefined);
    assert.equal(((await data()).lists.find(l => l.id === 'l3').learn || {})['corn tortilla'], undefined, 'and the list forgets it');
    await undo(/Sorted “Shopping”/);
    assert.equal((await note('nshop')).body, SEED.notes[1].body);
    await until(() => !synced.at(-1).todos.some(t => t.title === 'Greek yogurt') && synced.at(-1).notes.some(n => n.id === 'nshop' && !/PRODUCE/.test(n.body)), 'the Sheet hears of the undo');
  });

  await step(tag + ': notes: finds and reads, adds to a note, writes one, tidies a recipe and sets a reminder’s day, time and alert', async () => {
    await ask('Add the gutters to my house list', 'House projects');
    const h = await note('nhouse');
    assert.equal(h.body, 'Fix the fence\nPaint the porch #house\nClean the gutters'); assert.deepEqual(h.tags, ['house', 'todo']); assert.equal(h.pinned, true);
    const f = await todo('tfence');
    assert.deepEqual([f.date, f.time, f.alert, f.flagged], [DATES.tomorrow, '17:00', 15, true]);
    const pk = (await data()).notes.find(n => n.title === 'Packing list');
    assert.ok(pk && pk.color === 'green' && pk.tags.includes('travel') && /^n[0-9a-z]{8}/.test(pk.id), JSON.stringify(pk));
    const cake = await note('ncake');
    assert.match(cake.body, /^Pancakes for Sunday\n\nINGREDIENTS\n• 200g flour[\s\S]*METHOD\n1\. Whisk everything together\.\n\n2\. Cook/); assert.ok(cake.tags.includes('recipe'));
    const ch = (await texts(page, '.ipsy-change')).slice(-4);
    assert.match(ch[0], /Updated “House projects”: text, tags, pinned it.*Undo/); assert.match(ch[1], /Changed “Fix the fence” in Home/); assert.match(ch[2], /Wrote the note “Packing list”/); assert.match(ch[3], /Tidied the recipe “Pancakes”: 3 ingredients, 2 steps/);
    const read = JSON.parse(sent.at(-2).at(-1).content[0].content);
    assert.equal(read.notes[0].body, 'Fix the fence\nPaint the porch #house');
    await undo(/Updated “House projects”/);
    assert.deepEqual(await note('nhouse'), { ...SEED.notes[0], updated: (await note('nhouse')).updated }, 'the note is as it was');
    await undo(/Fix the fence/);
    assert.deepEqual([(await todo('tfence')).date, (await todo('tfence')).time, (await todo('tfence')).flagged], [null, null, false]);
    await undo(/Packing list/);
    assert.ok(!(await data()).notes.some(n => n.title === 'Packing list'));
    await undo(/Tidied/);
    assert.equal((await note('ncake')).body, SEED.notes[2].body);
  });

  await step(tag + ': deleting a note asks first in the chat: No leaves it, Yes moves it to Trash, Undo brings it back; a private one is never touched', async () => {
    await page.fill('#ipsyIn', 'delete my old ideas note');
    await page.press('#ipsyIn', 'Enter');
    await page.waitForSelector('.ipsy-ask [data-ans="no"]');
    assert.match(await page.textContent('.ipsy-ask'), /Move the note “Old ideas” to Trash\?/);
    assert.equal((await note('nold')).deletedAt, null, 'nothing happens before an answer');
    await page.click('.ipsy-ask [data-ans="no"]');
    await page.waitForFunction(() => /OK, I left it/.test(document.querySelector('.ipsy-log').textContent));
    assert.equal((await note('nold')).deletedAt, null);
    assert.match(await page.textContent('.ipsy-ask'), /You said no/);
    await page.fill('#ipsyIn', 'please delete it after all');
    await page.press('#ipsyIn', 'Enter');
    await page.waitForFunction(() => [...document.querySelectorAll('.ipsy-ask')].length === 2 && [...document.querySelectorAll('.ipsy-ask')][1].querySelector('[data-ans="yes"]'));
    assert.equal((await note('nold')).deletedAt, null, 'nothing happens before an answer');
    await page.locator('.ipsy-ask').last().locator('[data-ans="yes"]').click();
    await page.waitForFunction(() => /Moved it to Trash\./.test(document.querySelector('.ipsy-log').textContent) && !document.querySelector('.ipsy-send').disabled);
    const old = await note('nold');
    assert.ok(old.deletedAt > 0, 'in Trash'); assert.equal(old.pinned, false);
    assert.equal((await note('npriv')).deletedAt, null, 'the private note is not touched');
    assert.deepEqual(JSON.parse(sent.at(-1).at(-1).content[0].content).missing, ['npriv'], 'a private note is not there for Ipsy');
    assert.match((await texts(page, '.ipsy-change')).at(-1), /Moved “Old ideas” to Trash/);
    await undo(/Old ideas/);
    assert.equal((await note('nold')).deletedAt, null);
  });

  await step(tag + ': a private note can’t be read or changed', async () => {
    await ask('what is my secret note', 'private');
    const r = sent.at(-1).at(-1).content;
    assert.match(r[0].content, /No note with this id/); assert.equal(r[1].is_error, true);
    assert.equal((await note('npriv')).body, 'The gate code is 4321');
    assert.ok(!SECRET.test(JSON.stringify(sent)), 'nothing of it went to Claude');
  });

  await step(tag + ': show opens a note behind the chat; changing it then keeps the change (the editor is finished first), and a list opens in Reminders', async () => {
    await ask('show me that note', 'Here it is');
    assert.equal((await note('nhouse')).title, 'House jobs');
    assert.equal(await page.$eval('#editor', e => e.hidden), true, 'the editor was finished, so its copy can’t write over the change');
    assert.equal(await page.$eval('.tab[data-tab="rem"]', e => e.getAttribute('aria-selected')), 'true');
    assert.equal(await page.$eval('#listChips [data-list="l3"]', e => e.getAttribute('aria-pressed')), 'true');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.ipsy-wrap').hidden);
    assert.match(await page.textContent('#remBody'), /Corn tortillas/);
    await page.click('.ipsy-btn');
    await undo(/House jobs/);
    assert.equal((await note('nhouse')).title, 'House projects');
  });

  await step(tag + ': the chat is kept when the app opens again, and New chat clears it', async () => {
    await page.reload();
    await page.waitForSelector('.dock .ipsy-btn');
    await page.click('.ipsy-btn');
    assert.ok((await texts(page, '.ipsy-me')).includes('Sort out my groceries'));
    assert.equal(await page.$$eval('.ipsy-undo', e => e.length), 0, 'no Undo after the app was closed');
    await page.click('#ipsyNew');
    assert.equal(await page.$$eval('.ipsy-msg', e => e.length), 0);
    await page.click('.ipsy-speaker');
    await page.waitForFunction(() => document.querySelector('.ipsy-wrap').hidden, null, { timeout: 2000 });
  });

  await step(tag + ': picking the other design in Settings changes Ipsy at once', async () => {
    const other = design === 'glass' ? 'vintage' : 'glass';
    await page.evaluate(d => window.aosDesign.set(d), other);
    assert.equal(await page.$eval('.ipsy-btn', (e, d) => e.classList.contains('ipsy-' + d), other), true);
    assert.equal(await page.$eval('.ipsy-wrap', (e, d) => e.classList.contains('ipsy-' + d), other), true);
    await page.evaluate(d => window.aosDesign.set(d), design);
  });

  await step(tag + ': no script errors and nothing blocked by the page policy', async () => {
    assert.deepEqual(problems, []);
  });
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
