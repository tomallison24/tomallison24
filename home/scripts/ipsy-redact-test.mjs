// Personal details stay on the phone in Ipsy's chat (home/redact.js in home/ipsy.js): the real home/ipsy.js, mounted in
// headless Chromium with an app's tools, against a stand-in for Claude. What a tool hands back (an email address, a
// phone number, a card number) reaches the server only as placeholders; Claude using a placeholder in a tool gets the
// real one to the tool; its answer shows the real one on screen; the question tells Claude what the placeholders are;
// the placeholders' real values are kept on the phone (ipsy.<app>.masks), and a new question carries them on.
// Every name, number and address is invented.
//   node home/scripts/ipsy-redact-test.mjs [repo root]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const PAGE = `<!doctype html><meta charset="utf-8"><title>Redact</title><body>
<script src="/home/redact.js"></script><script src="/home/ipsy.js"></script>
<script>
  window.ran = [];
  window.chat = AllisonOS.ipsy.mount({ app: 'redact', endpoint: '/redact/api/ipsy', consent: 'Test.',
    context: () => 'On screen: the contact for Ann, ann.lee@example.com.',
    tools: {
      find_contact: async () => ({ content: { name: 'Ann Lee', email: 'ann.lee@example.com', phone: '(303) 555-0142', card: '4111 1111 1111 1111', order: '112-1234567-1234567' } }),
      write_to: async input => { window.ran.push(input); return { content: { sent: true, to: input.to } }; },
    } });
</script>`;
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/redact.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => { localStorage.setItem('aos.helper', '{"who":"mia","name":"Ipsy"}'); localStorage.setItem('ipsy.redact.ok', '1'); });
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', e => problems.push(String(e)));

// The stand-in for Claude: looks the contact up, writes to the placeholder it was given, then says so.
let failed = 0;
const sent = [];
const reply = json => ({ id: 'msg_' + sent.length, type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', ...json });
await ctx.route('**/redact/api/ipsy', route => {
  const raw = route.request().postData(); sent.push(raw);
  const msgs = JSON.parse(raw).messages, last = msgs[msgs.length - 1];
  const results = Array.isArray(last.content) ? last.content.filter(b => b.type === 'tool_result') : [];
  let json;
  if (!results.length) json = { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'find_contact', input: {} }] };
  else if (results[0].tool_use_id === 't1') {
    const r = JSON.parse(results[0].content);
    json = { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'write_to', input: { to: r.email, note: 'call ' + r.phone } }] };
  } else json = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done: I wrote to [email-1] and noted [phone-1].' }] };
  return route.fulfill({ json: reply(json) });
});
await page.goto(BASE + '/redact.html');

const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { failed++; console.log('not ok -', name, '\n  ', e.message.split('\n').slice(0, 8).join('\n   ')); } };
const REAL = /ann\.lee@example\.com|555-0142|4111 1111 1111 1111/;

await page.evaluate(() => chat.prompt('Write to Ann about the order'));
const answered = n => page.waitForFunction(n => (document.querySelector('.ipsy-log').textContent.match(/noted \(303\) 555-0142\./g) || []).length >= n && !document.querySelector('.ipsy-send').disabled, n, { timeout: 15000 });   // (typed out a little at a time)
await answered(1).catch(() => { failed++; console.log('not ok - Ipsy answered with the real details on screen'); });

await step('what reaches the server has placeholders, never the real email address, phone or card number', async () => {
  assert.equal(sent.length, 3, 'three steps: the question, the look-up\'s result, the write\'s result');
  for (const s of sent) if (REAL.test(s)) assert.fail('a real detail went to the server: ' + s.match(REAL)[0]);
  const first = JSON.parse(sent[0]).messages[0].content[0].text;
  assert.match(first, /\[email-1\]/, 'the context line has the placeholder');
  assert.match(first, /placeholders such as \[email-1\]/, 'the question tells Claude what the placeholders are');
  const look = JSON.parse(JSON.parse(sent[1]).messages.at(-1).content[0].content);
  assert.deepEqual(look, { name: 'Ann Lee', email: '[email-1]', phone: '[phone-1]', card: '[card-1 ending 1111]', order: '112-1234567-1234567' });
});

await step('a tool Claude runs with a placeholder gets the real one', async () => {
  assert.deepEqual(await page.evaluate(() => window.ran), [{ to: 'ann.lee@example.com', note: 'call (303) 555-0142' }]);
});

await step('the answer on screen shows the real ones', async () => {
  const shown = await page.evaluate(() => document.querySelector('.ipsy-log').textContent);
  assert.match(shown, /I wrote to ann\.lee@example\.com and noted \(303\) 555-0142\./);
  assert.ok(!/\[email-1\]|\[phone-1\]/.test(shown), 'a placeholder on screen');
});

await step('kept on the phone: the chat as sent (placeholders), and what they stand for, apart', async () => {
  const s = await page.evaluate(() => ({ chat: localStorage.getItem('ipsy.redact.chat'), masks: JSON.parse(localStorage.getItem('ipsy.redact.masks') || '{}') }));
  assert.equal(s.masks['[email-1]'], 'ann.lee@example.com');
  assert.equal(s.masks['[card-1 ending 1111]'], '4111 1111 1111 1111');
  assert.ok(!REAL.test(JSON.stringify(JSON.parse(s.chat).messages)), 'the conversation kept for Claude has a real detail');
});

await step('a new page carries on with the same placeholders', async () => {
  sent.length = 0;
  await page.reload();
  await page.evaluate(() => chat.prompt('Again'));
  await answered(2).catch(async e => { throw new Error(e.message + '\n' + await page.evaluate(() => document.querySelector('.ipsy-log').textContent) + '\nsent: ' + sent.length); });
  const look = JSON.parse(JSON.parse(sent[1]).messages.at(-1).content[0].content);
  assert.equal(look.email, '[email-1]', 'the same address, the same placeholder');
});

if (problems.length) { failed++; console.log('not ok - no script errors\n  ' + problems.join('\n  ')); } else console.log('ok - no script errors');
await browser.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed'); process.exit(failed ? 1 : 0);
