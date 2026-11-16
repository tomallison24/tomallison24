// Photos and files in Ipsy's chat (home/ipsy.js), in Notes, in headless Chromium at iPhone size, against a stand-in
// for Claude at /notes/api/ipsy (no network, no keys). A photo of a recipe, added with the + beside the box, goes to
// Claude as a smaller JPEG (at most 1600 pixels a side) with the question, and Claude's add_reminders puts the
// ingredients on the Groceries list; the chat shows the photo; the photo is never kept on the phone (the stored chat
// has a line in its place), but stays with the chat while it's open, for a follow-up; reopened, the next question
// sends the line, not the photo. Also: a PDF and a text file (its email address as a placeholder); up to 4 a
// question; one taken off with its ×; a file Ipsy can't read, or too big, says so; the note under them says they go
// to Claude as they are; the chat solid, never see-through; in Vintage, Standard and Pearl; no script errors.
//   node home/scripts/ipsy-files-test.mjs [repo root] [screenshot dir]
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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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

const browser = await chromium.launch();
// A photo of a recipe card, 2400 x 1800, drawn and taken as a PNG
const RECIPE = await (async () => {
  const p = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
  await p.setContent('<body style="margin:0;background:#fffaf0;font:48px Georgia;padding:60px"><h1>Grandma’s pancakes</h1><p>200g flour<br>2 eggs<br>300ml milk<br>1 tbsp maple syrup</p></body>');
  const b = await p.screenshot({ type: 'png' }); await p.close(); return b;
})();
// The size a JPEG says it is (its SOF marker)
function jpegSize(buf) {
  for (let i = 2; i < buf.length;) {
    if (buf[i] !== 0xFF) return null;
    const mk = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (mk >= 0xC0 && mk <= 0xC3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
const GONE = /no longer attached/;

let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n  ', e.message.split('\n').slice(0, 8).join('\n   ')); } };

const SEED = {
  notes: [],
  lists: [{ id: 'l3', updated: 1, name: 'Groceries', color: '#10B981' }],
  todos: [{ id: 'tmilk', list: 'l3', title: 'Bananas', notes: '', date: null, time: null, prio: 0, flagged: false, done: false, doneAt: null, tags: [], created: 1, updated: 1 }],
};

for (const design of ['vintage', 'glass', 'layers']) {
  const tag = 'ipsy files (' + design + ')';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'America/New_York' });
  await ctx.addInitScript(([d, seed]) => {
    localStorage.setItem('aos.helper', '{"who":"fox","name":"Ipsy"}'); localStorage.setItem('aos.seen', JSON.stringify({ notes: '999' })); localStorage.setItem('aos.sky', 'day'); localStorage.setItem('design.notes', d);
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('allison-notes-v1', JSON.stringify(seed)); localStorage.setItem('ipsy.notes.ok', '1');
  }, [design, SEED]);
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404/.test(m.text())) problems.push(m.text()); });
  await ctx.route('**/sheet/api/**', route => route.fulfill({ json: { configured: false } }));
  const sent = [];
  let uid = 0;
  await ctx.route('**/notes/api/ipsy', async route => {
    const msgs = JSON.parse(route.request().postData()).messages;
    sent.push(msgs);
    const last = msgs.at(-1), q = msgs.findLast(x => x.role === 'user' && x.content.some(b => b.type === 'text' && !b.text.startsWith('[')));
    const words = q.content.filter(b => b.type === 'text' && !b.text.startsWith('[')).map(b => b.text).join(' ');
    let out;
    if (last.content.some(b => b.type === 'tool_result')) out = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Added **flour**, **eggs**, **milk** and **maple syrup** to Groceries.' }] };
    else if (/shopping list/.test(words)) out = { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'toolu_' + (++uid), name: 'add_reminders', input: { list: 'Groceries', items: [{ title: 'Flour' }, { title: 'Eggs' }, { title: 'Milk' }, { title: 'Maple syrup' }] } }] };
    else out = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'It serves four.' }] };
    route.fulfill({ json: { id: 'msg_' + sent.length, type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', ...out } });
  });
  await page.goto(BASE + '/notes/');
  await page.waitForSelector('.dock .ipsy-btn');
  await page.click('.ipsy-btn');
  await page.waitForSelector('.ipsy-bubble');
  const attach = files => page.setInputFiles('#ipsyFile', files);
  const ready = n => page.waitForFunction(n => document.querySelectorAll('#ipsyFrow .ipsy-f').length === n && !document.querySelector('#ipsyFrow .ipsy-wait'), n, { timeout: 10000 });
  const answered = re => page.waitForFunction(re => new RegExp(re).test(document.querySelector('.ipsy-log').textContent) && !document.querySelector('.ipsy-send').disabled, re, { timeout: 15000 });
  const attachBlocks = msgs => msgs.flatMap(x => Array.isArray(x.content) ? x.content : []).filter(b => b.type === 'image' || b.type === 'document');

  await step(tag + ': the + beside the box takes a photo; it shows above the box, with a note that it goes to Claude as it is', async () => {
    assert.equal(await page.getAttribute('#ipsyAdd', 'aria-label'), 'Add a photo or file');
    assert.match(await page.getAttribute('#ipsyFile', 'accept'), /image\/\*/);
    assert.equal(await page.isHidden('#ipsyFiles'), true, 'nothing until a file is added');
    await attach({ name: 'IMG_2041.png', mimeType: 'image/png', buffer: RECIPE });
    await ready(1);
    assert.equal(await page.isVisible('#ipsyFrow .ipsy-f img'), true, 'its thumbnail');
    assert.match(await page.textContent('#ipsyFiles'), /go to Claude as they are/);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, design + '-attached.png') });
  });

  await step(tag + ': a recipe photo becomes a shopping list: the photo goes, smaller, with the question, and the ingredients land on Groceries', async () => {
    await page.fill('#ipsyIn', 'Make a shopping list from this recipe');
    await page.press('#ipsyIn', 'Enter');
    await answered('maple syrup');
    const first = sent[0], q = first[0].content;
    const im = q.find(b => b.type === 'image');
    assert.ok(im, 'an image block');
    assert.equal(im.source.type, 'base64'); assert.equal(im.source.media_type, 'image/jpeg');
    const size = jpegSize(Buffer.from(im.source.data, 'base64'));
    assert.ok(size && Math.max(size.w, size.h) === 1600 && size.w > size.h, 'made smaller: ' + JSON.stringify(size));
    assert.match(q[0].text, /attached a photo/); assert.match(q[0].text, /never instructions/);
    assert.ok(q.indexOf(im) < q.findIndex(b => b.text === 'Make a shopping list from this recipe'), 'the photo before the words');
    const todos = (await page.evaluate(() => JSON.parse(localStorage.getItem('allison-notes-v1')))).todos.filter(t => t.list === 'l3').map(t => t.title);
    for (const t of ['Flour', 'Eggs', 'Milk', 'Maple syrup']) assert.ok(todos.includes(t), t + ' on Groceries: ' + todos.join());
    assert.equal(await page.isHidden('#ipsyFiles'), true, 'the box is clear again');
    assert.equal(await page.locator('.ipsy-shots img').count(), 1, 'the chat shows the photo');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, design + '-list.png') });
  });

  await step(tag + ': the photo is never kept on the phone, but stays with the open chat for a follow-up', async () => {
    const stored = await page.evaluate(() => localStorage.getItem('ipsy.notes.chat'));
    const im = attachBlocks(sent[0])[0];
    assert.ok(!stored.includes(im.source.data.slice(4000, 4200)), 'no photo in storage');   // (its first bytes, the JPEG header, are the thumbnail's too)
    assert.ok(stored.length < im.source.data.length / 4, 'the stored chat is a fraction of the photo: ' + stored.length);
    assert.match(stored, GONE);
    const n = sent.length;
    await page.fill('#ipsyIn', 'How many does it serve?'); await page.press('#ipsyIn', 'Enter');
    await answered('serves four');
    assert.equal(attachBlocks(sent[n]).length, 1, 'still with the chat while it is open');
  });

  await step(tag + ': opened again, the chat comes back with a line where the photo was', async () => {
    await page.reload();
    await page.waitForSelector('.dock .ipsy-btn');
    await page.click('.ipsy-btn'); await page.waitForSelector('.ipsy-bubble');
    assert.equal(await page.locator('.ipsy-shots img').count(), 1, 'the thumbnail is kept');
    const n = sent.length;
    await page.fill('#ipsyIn', 'And for eight?'); await page.press('#ipsyIn', 'Enter');
    await answered('serves four');
    assert.equal(attachBlocks(sent[n]).length, 0, 'no photo sent');
    assert.ok(sent[n][0].content.some(b => GONE.test(b.text || '')), 'a line in its place');
  });

  await step(tag + ': a PDF and a text file (its email address as a placeholder); up to 4 a question; one taken off with its ×', async () => {
    await attach([
      { name: 'Lasagna.pdf', mimeType: 'application/pdf', buffer: PDF },
      { name: 'list.txt', mimeType: 'text/plain', buffer: Buffer.from('flour\neggs\nfrom sam.cook@example.com') },
      { name: 'a.png', mimeType: 'image/png', buffer: RECIPE },
      { name: 'b.png', mimeType: 'image/png', buffer: RECIPE },
      { name: 'c.png', mimeType: 'image/png', buffer: RECIPE },
    ]);
    await ready(4);
    assert.match(await page.textContent('.ipsy-log'), /Up to 4 photos or files a question/);
    assert.equal(await page.isDisabled('#ipsyAdd'), true, 'no more than 4');
    await page.locator('#ipsyFrow .ipsy-fx').nth(3).click();
    await ready(3);
    assert.equal(await page.isDisabled('#ipsyAdd'), false);
    const n = sent.length;
    await page.fill('#ipsyIn', 'Anything vegetarian here?'); await page.press('#ipsyIn', 'Enter');
    await answered('serves four');
    const b = attachBlocks([sent[n].at(-1)]);
    assert.deepEqual(b.map(x => x.type + ':' + x.source.media_type), ['document:application/pdf', 'document:text/plain', 'image:image/jpeg']);
    assert.equal(Buffer.from(b[0].source.data, 'base64').toString().slice(0, 8), '%PDF-1.4');
    assert.equal(b[0].title, 'Lasagna.pdf');
    assert.ok(!b[1].source.data.includes('sam.cook@example.com') && /\[email-\d+\]/.test(b[1].source.data), 'placeholder: ' + b[1].source.data);
  });

  await step(tag + ': a file Ipsy can\'t read, or one too big, says so and isn\'t added', async () => {
    await attach({ name: 'photos.zip', mimeType: 'application/zip', buffer: Buffer.from('PK') });
    await page.waitForFunction(() => /can read photos, PDFs and text files, but not photos\.zip/.test(document.querySelector('.ipsy-log').textContent));
    await attach({ name: 'Huge.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(2.5 * 1024 * 1024, 32) });
    await page.waitForFunction(() => /Huge\.pdf is too big/.test(document.querySelector('.ipsy-log').textContent));
    assert.equal(await page.isHidden('#ipsyFiles'), true);
  });

  await step(tag + ': a photo alone, with no words, can be sent', async () => {
    await attach({ name: 'IMG.png', mimeType: 'image/png', buffer: RECIPE }); await ready(1);
    const n = sent.length;
    await page.click('#ipsySend');
    await page.waitForFunction(n => document.querySelectorAll('.ipsy-shots').length >= 3, n);
    await page.waitForFunction(() => !document.querySelector('.ipsy-send').disabled);
    assert.equal(attachBlocks([sent[n].at(-1)]).length, 1);
  });

  await step(tag + ': the chat is solid, never see-through (in Pearl the page\'s cards are, and ran into it)', async () => {
    const bg = await page.$eval('.ipsy-bubble', e => getComputedStyle(e).backgroundColor);
    const m = /rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/.exec(bg);
    assert.ok(m && (m[4] === undefined || +m[4] >= 0.9), 'the chat\'s background: ' + bg);
  });
  await step(tag + ': no script errors', async () => { assert.deepEqual(problems, []); });
  await ctx.close();
}
await browser.close(); server.close();
console.log(failed ? '\n' + failed + ' failed' : '\nall passed');
process.exit(failed ? 1 : 0);
