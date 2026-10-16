// Drives Ipsy (home/ipsy.js with orders/ipsy-tools.js) in Orders and Orders Vintage, in headless
// Chromium, against a stubbed Gmail and a stand-in for Claude at /orders/api/ipsy (no network, no
// keys). Checks: the button in the dock, asking once before the first question, the chat running
// the tools Claude asks for (finding, updating, merging and deleting orders, searching and reading
// Gmail) on the app's own orders, each change with an Undo that works, web searches and sources
// shown, a paused turn carried on, the conversation only ever added to between steps, a failed
// question taken back out, the chat kept when the app is opened again, light and dark, both looks,
// and nothing tripping the page's Content Security Policy. Screenshots go to the folder given as
// the second argument (default: none).
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node orders/scripts/ipsy-test.mjs [repo root] [screenshot dir]
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

// ---- made-up emails (every name, number and address is invented) ----
const day = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const med = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const EMAILS = [
  { id: 'e3', threadId: 't3', ago: 4, from: 'Skin Tech <sales@skintech.example>', subject: 'Your order is on the way', text:
    'Order On The Way.\n\nYour Skin Tech order has been picked up by UPS. Track it: https://www.ups.com/track?tracknum=1Z0000000000000001\n\nOrder No. US-0000000001\n\nSkin Tech LED Light Therapy Face Mask\n\nx1\n\nDelivery Carrier\n\nUPS\n\nTracking No.\n\n1Z0000000000000001' },
  { id: 'e5', threadId: 't5', ago: 1, from: 'Target <orders@oe.target.com>', subject: 'Your order’s ready for pickup at Apex. Order #100000000012345', text:
    `Your order’s available now through ${day(2).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}.\n\nBring your phone to the Order Pickup counter.\n\nOrder #100000000012345\nPlaced ${med(day(-1))}` },
  { id: 'e6', threadId: 't6', ago: 1, from: 'Walmart <help@walmart.com>', subject: 'Review your order updates', text:
    `Your order has 1 unavailable item\nOrder date: ${med(day(-1))}\nOrder number: 2000000-00000001\nMini Fridge, 4L Portable Personal Cooler, Black\n$29.84/EA\nQty: 1\n$49.99` },
];
const b64 = s => Buffer.from(s, 'utf8').toString('base64url');
const gmailMessage = m => ({
  id: m.id, threadId: m.threadId, internalDate: String(Date.now() - m.ago * 86400e3), snippet: m.text.slice(0, 80),
  payload: { mimeType: 'multipart/alternative', headers: [{ name: 'Subject', value: m.subject }, { name: 'From', value: m.from }, { name: 'To', value: 'sam@example.com' }],
    parts: [{ mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset=UTF-8' }], body: { data: b64(m.text) } }] },
});

// ---- the stand-in for Claude: answers each step from where the conversation is ----
const lastUser = msgs => [...msgs].reverse().find(m => m.role === 'user');
const resultOf = (msgs, name) => {
  // the latest tool result for a tool_use of this name
  for (let i = msgs.length - 1; i > 0; i--) {
    const m = msgs[i]; if (m.role !== 'user' || !Array.isArray(m.content)) continue;
    for (const r of m.content) if (r.type === 'tool_result') {
      const use = msgs[i - 1].content.find(b => b.type === 'tool_use' && b.id === r.tool_use_id);
      if (use && use.name === name) return { use, r, json: (() => { try { return JSON.parse(r.content); } catch { return null; } })() };
    }
  }
  return null;
};
let uid = 0;
const tu = (name, input) => ({ type: 'tool_use', id: 'toolu_' + (++uid), name, input });
const think = { type: 'thinking', thinking: '', signature: 'sig-' + 'x'.repeat(20) };
function claude(msgs) {
  const q = lastUser(msgs).content.filter(b => b.type === 'text').map(b => b.text).join(' ');
  const qs = msgs.filter(m => m.role === 'user' && m.content.some(b => b.type === 'text' && !b.text.startsWith('[From the app')));
  const question = qs.length ? qs[qs.length - 1].content.filter(b => b.type === 'text' && !b.text.startsWith('[From the app')).map(b => b.text).join(' ') : '';
  const lastMsg = msgs[msgs.length - 1];
  if (/limit please/.test(question)) return { status: 429, json: { error: 'limit' } };
  if (/tidy up/.test(question)) {
    if (lastMsg.role === 'user' && lastMsg.content.some(b => b.type === 'text' && /tidy up/.test(b.text)))
      return { json: { stop_reason: 'tool_use', content: [think, { type: 'text', text: 'Let me look.' }, tu('find_orders', { status: 'open' })] } };
    const found = resultOf(msgs, 'find_orders');
    if (!resultOf(msgs, 'merge_orders')) {
      const tg = found.json.orders.filter(o => o.store === 'Target'), wm = found.json.orders.find(o => o.store === 'Walmart');
      return { json: { stop_reason: 'tool_use', content: [tu('merge_orders', { keep_id: tg.find(o => o.orderNo).id, merge_ids: tg.filter(o => !o.orderNo).map(o => o.id) }),
        tu('update_order', { id: wm.id, changes: { total: 49.99, checked: true } })] } };
    }
    return { json: { stop_reason: 'end_turn', content: [
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'Target order pickup how long held' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result', url: 'https://help.example.com/pickup', title: 'Order Pickup help', encrypted_content: 'enc', page_age: null }] },
      { type: 'text', text: 'Done! I merged the two **Target** orders and set the Walmart total to $49.99.\n- Target pickup is held for a few days' },
      { type: 'text', text: ', so grab it soon.', citations: [{ type: 'web_search_result_location', url: 'https://help.example.com/pickup', title: 'Order Pickup help', cited_text: 'held', encrypted_index: 'x' }] },
    ] } };
  }
  if (/skin tech/i.test(question)) {
    if (lastMsg.role === 'user' && lastMsg.content.some(b => b.type === 'text' && /skin tech/i.test(b.text)))
      return { json: { stop_reason: 'tool_use', content: [tu('find_orders', { query: 'skin tech' }), tu('search_gmail', { query: 'from:skintech.example' })] } };
    if (!resultOf(msgs, 'read_email')) {
      const st = resultOf(msgs, 'find_orders').json.orders[0], mail = resultOf(msgs, 'search_gmail').json.emails[0];
      return { json: { stop_reason: 'tool_use', content: [tu('read_email', { message_id: mail.message_id }), tu('delete_orders', { ids: [st.id] })] } };
    }
    if (lastMsg.role === 'user')     // a long web look-up that Anthropic pauses, then carries on
      return { json: { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', id: 'srvtoolu_2', name: 'web_fetch', input: { url: 'https://www.ups.com/track?tracknum=1Z0000000000000001' } }] } };
    return { json: { stop_reason: 'end_turn', content: [{ type: 'web_fetch_tool_result', tool_use_id: 'srvtoolu_2', content: { type: 'web_fetch_tool_error', error_code: 'unavailable' } },
      { type: 'text', text: 'Deleted the Skin Tech order. Its email says UPS had it.' }] } };
  }
  return { json: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hello! (' + q.length + ')' }] } };
}

const browser = await chromium.launch();
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n  ', e.message.split('\n').slice(0, 8).join('\n   ')); } };
const texts = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));

for (const [app, scheme] of [['orders', 'light'], ['ordersvintage', 'dark']]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.addInitScript(a => localStorage.setItem('aos.seen', JSON.stringify({ [a]: '999' })), app);
  await ctx.addInitScript(() => localStorage.setItem('aos.sky', 'day'));
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404|429/.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', e => problems.push(String(e)));
  page.on('console', m => { if (m.type() === 'warning' && /Ipsy/.test(m.text())) problems.push(m.text()); });
  await ctx.route('https://gmail.googleapis.com/**', route => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/profile')) return route.fulfill({ json: { emailAddress: 'sam@example.com' } });
    if (u.pathname.endsWith('/messages')) {
      const q = u.searchParams.get('q') || '';
      const list = /skintech/.test(q) ? EMAILS.filter(m => m.id === 'e3') : EMAILS;
      return route.fulfill({ json: { messages: list.map(m => ({ id: m.id, threadId: m.threadId })), resultSizeEstimate: list.length } });
    }
    const m = EMAILS.find(x => x.id === u.pathname.split('/').pop());
    return m ? route.fulfill({ json: gmailMessage(m) }) : route.fulfill({ status: 404, json: { error: { message: 'not found' } } });
  });
  const sent = [];
  await ctx.route('**/orders/api/ipsy', async route => {
    const req = route.request(), raw = req.postData();
    assert.ok(raw.startsWith('{"messages":'), 'the phone sends exactly {"messages":[...]}');
    assert.equal(req.headers()['x-orders'], '1');
    const msgs = JSON.parse(raw).messages;
    sent.push(msgs);
    const a = claude(msgs); if (process.env.DBG) console.log('  stub:', a.status || 200, JSON.stringify(a.json).slice(0, 90));
    return route.fulfill({ status: a.status || 200, json: a.json.content ? { id: 'msg_' + sent.length, type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', ...a.json } : a.json });
  });
  await ctx.addInitScript(a => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const k = a === 'orders' ? 'orders' : 'ordersv';
    localStorage.setItem(k + '.token', JSON.stringify({ t: 'fake-token', exp: Date.now() + 3600e3, scope: 'https://www.googleapis.com/auth/gmail.readonly' }));
    localStorage.setItem(k + '.token.ever', '1');
  }, app);
  await page.goto(BASE + '/' + app + '/');
  await page.waitForFunction(() => window.__orders && window.__orders.orders.length >= 3 && document.getElementById('syncPill').hidden, null, { timeout: 10000 });
  // a second Target order for the same pickup, without its order number: one for Ipsy to merge
  await page.evaluate(() => { const t = window.__orders.orders.find(o => o.store === 'Target'); const d = JSON.parse(JSON.stringify(t)); d.id = 'h-dup'; delete d.orderNo; d.source = null; window.__orders.orders.push(d); window.__orders.save(); window.__orders.render(); });
  const count = () => page.evaluate(() => window.__orders.orders.length);
  const before = await count();

  await step(app + ': Ipsy sits in the dock, and opens a chat that asks once before the first question', async () => {
    assert.equal(await page.$$eval('.dock > span .ipsy-btn', e => e.length), 1);
    assert.equal(await page.$eval('.ipsy-btn', e => e.classList.contains(location.pathname.includes('vintage') ? 'ipsy-vintage' : 'ipsy-glass')), true);
    await page.click('.ipsy-btn');
    await page.waitForSelector('.ipsy-sheet');
    assert.match(await page.textContent('.ipsy-consent'), /Anthropic.*Undo/);
    assert.equal(await page.$eval('#ipsyIn', e => e.disabled), true, 'nothing is sent before OK');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, app + '-consent.png') });
    await page.click('#ipsyOk');
    assert.equal(await page.$$eval('.ipsy-chip[data-ask]', e => e.length), 4);
  });

  await step(app + ': one question: Ipsy finds the orders, merges the duplicate and fixes a total, with web sources', async () => {
    await page.fill('#ipsyIn', 'Please tidy up my orders');
    await page.press('#ipsyIn', 'Enter');
    await page.waitForFunction(() => /grab it soon/.test(document.querySelector('.ipsy-log').textContent) && !document.querySelector('.ipsy-send').disabled, null, { timeout: 15000 });
    assert.equal(await count(), before - 1, 'the duplicate is merged away');
    const wm = await page.evaluate(() => window.__orders.orders.find(o => o.store === 'Walmart'));
    assert.equal(wm.total, 49.99); assert.equal(wm.locks.total, true, 'kept like your own edit'); assert.equal(wm.checked, true); assert.equal(wm.guess, false);
    const ch = await texts(page, '.ipsy-change');
    assert.equal(ch.length, 2); assert.match(ch[0], /Merged 2 orders into one: Target.*Undo/); assert.match(ch[1], /Changed total, checked on Walmart.*Undo/);
    const acts = await texts(page, '.ipsy-act');
    assert.ok(acts.includes('Looking through your orders') && acts.includes('Merging orders') && acts.some(a => /Searching the web: Target order pickup/.test(a)), acts.join(' | '));
    assert.equal(await page.locator('.ipsy-it').last().locator('b').textContent(), 'Target');
    assert.equal(await page.locator('.ipsy-it').last().locator('li').textContent(), 'Target pickup is held for a few days, so grab it soon.');
    assert.deepEqual(await page.$$eval('.ipsy-src a', e => e.map(a => [a.textContent, a.href, a.target])), [['Order Pickup help', 'https://help.example.com/pickup', '_blank']]);
    // what the server was sent: the question with the app's note, then only ever added to
    assert.equal(sent.length, 3);
    assert.match(sent[0][0].content[0].text, /^\[From the app: today is \w+day, .* \(\d{4}-\d\d-\d\d\)\. Orders has \d+ orders: .* On screen: the On the way list\.\]$/);
    assert.equal(sent[0][0].content[1].text, 'Please tidy up my orders');
    for (let i = 1; i < sent.length; i++) assert.deepEqual(sent[i].slice(0, sent[i - 1].length), sent[i - 1], 'step ' + i + ' changed an earlier message');
    assert.deepEqual(sent[1][1].content[0], { type: 'thinking', thinking: '', signature: 'sig-' + 'x'.repeat(20) }, 'thinking goes back unchanged');
    assert.equal(sent[2][3].content.length, 2, 'both tool results in one message');
  });
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, app + '-chat-' + scheme + '.png') });

  await step(app + ': Undo on a change puts the order back', async () => {
    await page.locator('.ipsy-change .ipsy-undo').first().click();
    assert.equal(await count(), before, 'the merged order is back');
    assert.ok(await page.evaluate(() => !!window.__orders.orders.find(o => o.id === 'h-dup')));
    assert.match((await texts(page, '.ipsy-change'))[0], /Merged/);
    assert.equal(await page.$$eval('.ipsy-change.undone', e => e.length), 1);
  });

  await step(app + ': a question that reads Gmail, deletes an order and waits out a paused web look-up', async () => {
    const n0 = sent.length;
    await page.fill('#ipsyIn', 'Check the Skin Tech one and delete it');
    await page.click('#ipsySend');
    await page.waitForFunction(() => /Deleted the Skin Tech order/.test(document.querySelector('.ipsy-log').textContent), null, { timeout: 15000 });
    assert.ok(!(await page.evaluate(() => window.__orders.orders.some(o => o.store === 'Skin Tech'))), 'deleted');
    const st = sent.slice(n0);
    assert.equal(st.length, 4);
    const read = st[2][st[2].length - 1].content.find(r => /Skin Tech LED/.test(r.content));
    assert.ok(read && read.content.includes('Track it: [link to ups.com]'), 'the email, its links as their site only');
    assert.ok(!read.content.includes('tracknum='), 'never a link’s address');
    const search = JSON.parse(st[1][st[1].length - 1].content.find(r => /emails/.test(r.content)).content);
    assert.equal(search.emails[0].subject, 'Your order is on the way'); assert.ok(search.emails[0].order_id, 'says which order the email made');
    assert.equal(st[3][st[3].length - 1].role, 'assistant', 'a paused turn is sent back as it is, with no new message');
    assert.ok((await texts(page, '.ipsy-act')).some(a => /Reading ups\.com/.test(a)));
    await page.locator('.ipsy-change .ipsy-undo').last().click();
    assert.ok(await page.evaluate(() => window.__orders.orders.some(o => o.store === 'Skin Tech')), 'Undo brings it back');
  });

  await step(app + ': a question that fails says so and is taken back out of the conversation', async () => {
    const n0 = sent.length, len = sent[n0 - 1].length;
    await page.fill('#ipsyIn', 'limit please');
    await page.click('#ipsySend');
    await page.waitForSelector('.ipsy-err');
    assert.match((await texts(page, '.ipsy-err')).join(' | '), /a lot of questions/);
    await page.fill('#ipsyIn', 'hi');
    await page.click('#ipsySend');
    await page.waitForFunction(() => /Hello!/.test(document.querySelector('.ipsy-log').textContent));
    const last = sent[sent.length - 1];
    assert.equal(last.length, len + 2, 'the failed question is not in the next step');
    assert.ok(!JSON.stringify(last).includes('limit please'));
  });

  await step(app + ': the chat is kept when the app opens again, and New chat clears it', async () => {
    await page.reload();
    await page.waitForFunction(() => window.__orders && document.querySelector('.ipsy-btn'));
    await page.click('.ipsy-btn');
    assert.ok((await texts(page, '.ipsy-me')).includes('Please tidy up my orders'));
    assert.equal(await page.$$eval('.ipsy-undo', e => e.length), 0, 'no Undo after the app was closed');
    await page.click('#ipsyNew');
    assert.equal(await page.$$eval('.ipsy-msg', e => e.length), 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('.ipsy-wrap', e => e.hidden), true);
  });

  await step(app + ': no script errors and nothing blocked by the page policy', async () => {
    assert.deepEqual(problems, []);
  });
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
