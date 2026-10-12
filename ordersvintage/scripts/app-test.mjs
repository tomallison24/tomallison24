// Drives the Orders Vintage app in headless Chromium against a stubbed Gmail, with
// made-up order emails dated around today: reading Gmail into orders, the
// lists (on the way, delivered, to check), the order page with its tracking
// button, marking delivered, editing, adding by hand, search, the kinds in
// Settings, deleting, and that nothing trips the page's Content Security
// Policy, and that it is drawn in the Retro look: Futura, flat cream (walnut)
// cards, a mustard thumb, an orange add button, atomic shapes behind the title.
// Screenshots go to the folder given as the second argument (default: none).
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node ordersvintage/scripts/app-test.mjs [repo root] [screenshot dir]
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

// ---- a static server for the repo ----
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

// ---- made-up emails, dated from today (every name, number and address is invented) ----
const pad = n => String(n).padStart(2, '0');
const day = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const med = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const long = d => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const us = d => pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + '/' + d.getFullYear();
const HW = 'The Home Depot <HomeDepot@order.homedepot.com>';
const EMAILS = [
  { id: 'e1', threadId: 't1', ago: 3, from: HW, subject: 'We received your order!', html:
    `<html><body><p>Order Number WK00000001</p><p>Order Date ${med(day(-3))}</p><table><tr><td>Item</td><td>Unit Price</td><td>Qty</td><td>Item Total</td></tr>
     <tr><td>Oak Click Lock Vinyl Plank Flooring (23.62 sq. ft./Case)<br>Store SKU # 1000000001 Est Arrival: ${med(day(0))}</td><td>$63.54</td><td>12.00</td><td>$762.48</td></tr>
     <tr><td>Foam Underlayment for Laminate Flooring<br>Store SKU # 1000000002</td><td>$79.00</td><td>2.00</td><td>$158.00</td></tr>
     <tr><td>Order Total</td><td>$987.21</td></tr></table></body></html>` },
  { id: 'e2', threadId: 't2', ago: 2, from: HW, subject: 'Order #WK00000001 Shipped: Your order is on its way, Tom!', html:
    `<html><body><p>Order #: WK00000001</p><h2>Your package has shipped, Tom!</h2><table><tr><td>Estimated Delivery</td><td>${med(day(0))}</td></tr>
     <tr><td>Tracking ID: WK00000001-12345678</td></tr><tr><td>Total</td><td>$987.21</td></tr></table></body></html>` },
  { id: 'e3', threadId: 't3', ago: 4, from: 'Skin Tech <sales@skintech.example>', subject: 'Your order is on the way', text:
    `Order On The Way.\n\nYour Skin Tech order has been packed and picked up by UPS.\n\nOrder No. US-0000000001\n\nWhat's Coming?\n\nSkin Tech LED Light Therapy Face Mask\n\nx1\n\nDelivery Carrier\n\nUPS\n\nTracking No.\n\n1Z0000000000000001` },
  { id: 'e4', threadId: 't4', ago: 1, from: 'UPS <pkginfo@ups.com>', subject: 'UPS Delivery Notification, Tracking Number 1Z0000000000000001', text:
    `, your package has been delivered.\n\nDelivery Date: ${long(day(-1))}, ${us(day(-1))}\n\nDelivery Time: 1:19 PM\n\nSKIN TECH\n\nTracking Number: 1Z0000000000000001\n\nShip To: TOM EXAMPLE` },
  { id: 'e5', threadId: 't5', ago: 1, from: 'Target <orders@oe.target.com>', subject: 'Your order’s ready for pickup at Apex. Order #100000000012345', text:
    `Your order’s available now through ${day(2).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}.\n\nBring your phone to the Order Pickup counter.\n\nOrder #100000000012345\nPlaced ${med(day(-1))}` },
  { id: 'e6', threadId: 't6', ago: 1, from: 'Walmart <help@walmart.com>', subject: 'Review your order updates', text:
    `Your order has 1 unavailable item\nOrder date: ${med(day(-1))}\nOrder number: 2000000-00000001\nMini Fridge, 4L Portable Personal Cooler, Black\n$29.84/EA\nQty: 1\n$49.99` },
  { id: 'e7', threadId: 't7', ago: 2, from: 'DoorDash <no-reply@doordash.com>', subject: 'Order Confirmation for Tom from Tandoor House', text:
    `Order Confirmation\nOrder #AB12CD\nTotal $24.50\nEstimated pickup 6:30 PM` },
  { id: 'e8', threadId: 't8', ago: 1, from: 'Store <news@store.example>', subject: 'Big sale: 50% off orders over $50', text: 'Shop now. Free shipping on orders over $50.' },
  { id: 'e9', threadId: 't9', ago: 5, from: 'support@greenhomesupply.example', subject: 'Your Green Home Supply order from ' + med(day(-6)) + ' has shipped', html:
    `<html><body><h2>Your order has shipped</h2><p>Your recent order on Green Home Supply has been shipped.</p><table><tr><th>Provider</th><th>Tracking Number</th><th>Date</th></tr>
     <tr><td>USPS</td><td>9400100000000000000000</td><td>${med(day(-5))}</td></tr></table><h3>Order #IN-100001</h3>
     <table><tr><th>Product</th><th>Quantity</th><th>Price</th></tr><tr><td>Activator Capsules - Every 3 Months -</td><td>1</td><td>$28.75</td></tr>
     <tr><td>Total:</td><td>$30.84</td></tr></table></body></html>` },
];
const b64 = s => Buffer.from(s, 'utf8').toString('base64url');
const gmailMessage = m => ({
  id: m.id, threadId: m.threadId, internalDate: String(Date.now() - m.ago * 86400e3),
  payload: { mimeType: 'multipart/alternative', headers: [{ name: 'Subject', value: m.subject }, { name: 'From', value: m.from }],
    parts: [m.html ? { mimeType: 'text/html', headers: [{ name: 'Content-Type', value: 'text/html; charset="UTF-8"' }], body: { data: b64(m.html) } }
      : { mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset=UTF-8' }], body: { data: b64(m.text) } }] },
});

const browser = await chromium.launch();
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n  ', e.message.split('\n').slice(0, 6).join('\n   ')); } };
const settled = page => page.waitForFunction(() => document.getElementById('syncPill').hidden, null, { timeout: 8000 });
const texts = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));

for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.addInitScript(() => localStorage.setItem('aos.seen', JSON.stringify({ ordersvintage: '999' })));   // no aOS walkthrough over the page
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404/.test(m.text())) problems.push(m.text()); });   // welcome.js asks ../aOS/api/state, which this static server doesn't have
  page.on('pageerror', e => problems.push(String(e)));
  const listed = [], fetched = [];
  await ctx.route('https://gmail.googleapis.com/**', route => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/profile')) return route.fulfill({ json: { emailAddress: 'tom@example.com' } });
    if (u.pathname.endsWith('/messages')) { listed.push(u.searchParams.get('q')); return route.fulfill({ json: { messages: EMAILS.map(m => ({ id: m.id, threadId: m.threadId })) } }); }
    const id = u.pathname.split('/').pop(), m = EMAILS.find(x => x.id === id);
    if (m) fetched.push(id);
    return m ? route.fulfill({ json: gmailMessage(m) }) : route.fulfill({ status: 404, json: { error: { message: 'not found' } } });
  });
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('ordersv.token', JSON.stringify({ t: 'fake-token', exp: Date.now() + 3600e3, scope: 'https://www.googleapis.com/auth/gmail.readonly' }));
    localStorage.setItem('ordersv.token.ever', '1');
  });
  await page.goto(BASE + '/ordersvintage/');

  await step(scheme + ': reads Gmail into orders; food waits, offers are skipped', async () => {
    await page.waitForFunction(() => window.__orders && window.__orders.orders.length >= 5, null, { timeout: 8000 });
    await settled(page);
    const o = await page.evaluate(() => window.__orders.orders.map(x => ({ store: x.store, status: x.status, kind: x.kind, tracking: x.tracking, carrier: x.carrier, guess: x.guess })));
    assert.equal(o.length, 5, JSON.stringify(o));
    assert.ok(!o.some(x => x.kind === 'food'), 'food is switched off');
    const find = s => o.find(x => x.store === s);
    assert.equal(find('Home Depot').status, 'shipped'); assert.equal(find('Home Depot').tracking, 'WK00000001-12345678');
    assert.equal(find('Skin Tech').status, 'delivered'); assert.equal(find('Skin Tech').carrier, 'UPS');
    assert.equal(find('Target').status, 'pickup'); assert.equal(find('Target').kind, 'pickup');
    assert.equal(find('Walmart').guess, true);
    assert.equal(find('Green Home Supply').carrier, 'USPS');
    assert.ok(listed[0].startsWith('newer_than:1y') && listed[0].includes('label:Orders') && listed[0].includes('-label:Travel'), listed[0]);
  });
  await step(scheme + ': drawn in the Retro look: Futura, flat cream or walnut, mustard, orange, atomic shapes', async () => {
    const q = (sel, props) => page.$eval(sel, (e, props) => { const c = getComputedStyle(e); return props.map(p => c[p]); }, props);
    const cream = scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', ground = scheme === 'light' ? 'rgb(244, 236, 221)' : 'rgb(36, 30, 26)';
    assert.match((await q('body', ['fontFamily']))[0], /Futura/);
    assert.equal((await q('body', ['backgroundColor']))[0], ground);
    const [bg, shadow, backdrop, radius] = await q('.ocard', ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
    assert.equal(bg, cream); assert.equal(shadow, 'none'); assert.ok(backdrop === 'none' || backdrop === '', backdrop); assert.equal(radius, '20px');
    assert.equal((await q('.ambient i:nth-child(1)', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard sun');
    assert.equal((await q('.ambient i:nth-child(3)', ['backgroundColor']))[0], 'rgb(216, 87, 42)', 'a burnt-orange pill');
    assert.equal((await q('#fab', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(201, 80, 42)' : 'rgb(216, 87, 42)', 'the add button is solid orange');
    assert.equal((await q('#whenChips .slthumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard thumb');
    assert.equal((await q('.title', ['fontSize']))[0], '44px');
    assert.equal((await q('.ocard .mono', ['borderRadius']))[0], '50%');
  });
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'list-' + scheme + '.png') });

  await step(scheme + ': On the way: sections, cards with the courier and tracking number', async () => {
    assert.deepEqual(await texts(page, '#whenChips .chip'), ['On the way 4', 'Delivered 1', 'To check 1']);
    assert.deepEqual(await texts(page, '#list .sechead'), ['Arriving today', 'Ready for pickup', 'On the way', 'Ordered']);
    const cards = await texts(page, '#list .ocard');
    assert.match(cards[0], /Home Depot.*\$987\.21.*Out for delivery|Home Depot.*\$987\.21.*Shipped/);
    assert.match(cards[0], /WK00000001-12345678/); assert.match(cards[0], /Oak Click Lock Vinyl Plank Flooring.*and 1 more/);
    assert.match(cards.find(c => /Green Home Supply/.test(c)), /USPS.*9400100000000000000000/);
    assert.match(cards.find(c => /Target/.test(c)), /Ready for pickup.*Until/);
    assert.match(cards.find(c => /Walmart/.test(c)), /Check details/);
    assert.equal(await page.$$eval('#list .ocard .osteps', e => e.length), 4);
    assert.equal(await page.$eval('#list .ocard:has(.ostore:text("Target")) .osteps', e => e.children.length), 3, 'a pickup has three steps');
  });

  await step(scheme + ': switches: a glass thumb slides under the chosen filter', async () => {
    await page.waitForSelector('#whenChips .slthumb');
    const box = async sel => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width }; });
    await page.click('#whenChips [data-when="done"]');
    await page.waitForTimeout(800);
    const t = await box('#whenChips .slthumb'), c = await box('#whenChips [aria-pressed="true"]');
    assert.ok(Math.abs(t.x - c.x) < 3 && Math.abs(t.w - c.w) < 3, JSON.stringify({ t, c }));
  });

  await step(scheme + ': Delivered, and an order page with a Track button', async () => {
    assert.deepEqual(await texts(page, '#list .sechead'), ['This week']);
    assert.match((await texts(page, '#list .ocard'))[0], /Skin Tech.*Delivered.*UPS.*1Z0000000000000001/);
    await page.click('#list .ocard');
    await page.waitForSelector('#opage:not([hidden]) .ohero');
    assert.match(await page.textContent('#opBody .ohero h3'), /^Delivered/);
    const href = await page.getAttribute('#opBody .ctabtn', 'href');
    assert.equal(href, 'https://www.ups.com/track?tracknum=1Z0000000000000001');
    assert.match(await page.textContent('#opBody .ctabtn'), /Track on UPS/);
    assert.deepEqual(await texts(page, '#opBody .otl li span'), ['Ordered', 'Shipped', 'Out for delivery', 'Delivered']);
    assert.equal(await page.$$eval('#opBody .otl li.on', e => e.length), 4);
    assert.match(await page.textContent('#opBody .okv'), /Order number.*US-0000000001/);
    assert.ok(await page.$('#opBody a[href^="../mailvintage/?thread="]'), 'a link to the email in Mail');
    if (SHOTS) { await page.waitForTimeout(700); await page.screenshot({ path: path.join(SHOTS, 'order-' + scheme + '.png') }); }
    await page.click('#opBack');
    await page.click('#whenChips [data-when="way"]');
  });

  await step(scheme + ': an order that is unsure waits under To check until you say it looks right', async () => {
    await page.click('#whenChips [data-when="check"]');
    assert.equal((await texts(page, '#list .ocard')).length, 1);
    await page.click('#list .ocard');
    await page.waitForSelector('#opage:not([hidden]) .verify');
    assert.match(await page.textContent('#opBody .verify'), /unavailable/);
    await page.click('#opOk');
    await page.waitForFunction(() => !document.querySelector('#opBody .verify'));
    await page.click('#opBack');
    assert.deepEqual(await texts(page, '#whenChips .chip'), ['On the way 4', 'Delivered 1'], 'the To check chip goes when nothing is left to check');
  });

  await step(scheme + ': mark as delivered, and undo', async () => {
    await page.click('#list .ocard:has(.ostore:text("Green Home Supply"))');
    await page.waitForSelector('#opage:not([hidden])');
    assert.match(await page.textContent('#opBody .ohero h3'), /On its way/);
    assert.equal(await page.getAttribute('#opBody .ctabtn', 'href'), 'https://tools.usps.com/go/TrackConfirmAction_input?qtc_tLabels1=9400100000000000000000');
    await page.click('#opDelivered');
    await page.waitForFunction(() => /^Delivered/.test(document.querySelector('#opBody .ohero h3').textContent));
    await page.click('#toastAct');
    await page.waitForFunction(() => /On its way/.test(document.querySelector('#opBody .ohero h3').textContent));
    await page.click('#opDelivered');
    await page.click('#opBack');
    assert.deepEqual(await texts(page, '#whenChips .chip'), ['On the way 3', 'Delivered 2']);
  });

  await step(scheme + ': search finds a store, an item or a tracking number', async () => {
    await page.click('#searchBtn');
    await page.fill('#q', 'underlay');
    assert.equal((await texts(page, '#list .ocard')).length, 1);
    await page.fill('#q', '1Z0000000000000001');
    assert.match((await texts(page, '#list .ocard'))[0], /Skin Tech/);
    await page.fill('#q', 'nothing like this');
    assert.match(await page.textContent('#list'), /No match/);
    await page.click('#searchBtn');
    assert.equal(await page.inputValue('#q'), '');
  });

  await step(scheme + ': edits stick, and an email read again doesn’t undo them', async () => {
    await page.click('#list .ocard:has(.ostore:text("Home Depot"))');
    await page.click('#opEdit');
    await page.waitForSelector('#edSheet:not([hidden])');
    await page.fill('#ef_store', 'Hardware Co'); await page.fill('#ef_notes', 'Leave on the porch');
    await page.selectOption('#ef_carrier', 'FedEx');
    await page.click('#edDone');
    await page.waitForFunction(() => window.__orders.orders.some(o => o.store === 'Hardware Co'));
    const o = await page.evaluate(() => window.__orders.orders.find(o => o.store === 'Hardware Co'));
    assert.equal(o.carrier, 'FedEx'); assert.equal(o.locks.store, true); assert.equal(o.notes, 'Leave on the porch');
    await page.click('#opBack');
    await page.click('#setBtn'); await page.click('#stRescan');
    await settled(page).catch(() => {});
    await page.waitForFunction(() => window.__orders.orders.length >= 5 && !document.getElementById('list').textContent.includes('Reading'), null, { timeout: 8000 });
    await settled(page);
    const again = await page.evaluate(() => window.__orders.orders.map(o => o.store));
    assert.ok(again.includes('Hardware Co') && !again.includes('Home Depot'), again.join(', '));
    assert.equal(again.length, 5);
  });

  await step(scheme + ': add an order by hand', async () => {
    await page.click('#fab');
    await page.waitForSelector('#edSheet:not([hidden])');
    await page.click('#edDone');
    assert.match(await page.textContent('#toastMsg'), /needs a store or an item/);
    await page.fill('#ef_store', 'Corner Shop'); await page.fill('#ef_items', '2 x Notebook\nPens'); await page.fill('#ef_total', '12.50');
    await page.click('#edDone');
    await page.waitForFunction(() => window.__orders.orders.some(o => o.store === 'Corner Shop'));
    const o = await page.evaluate(() => window.__orders.orders.find(o => o.store === 'Corner Shop'));
    assert.deepEqual(o.items, [{ name: 'Notebook', qty: 2 }, { name: 'Pens' }]); assert.equal(o.total, 12.5); assert.equal(o.status, 'ordered');
    assert.match((await texts(page, '#list .ocard:has(.ostore:text("Corner Shop"))'))[0], /Notebook ×2 and 1 more.*\$12\.50/);
  });

  await step(scheme + ': turning on Food orders reads what was passed over', async () => {
    await page.click('#setBtn');
    assert.deepEqual(await texts(page, '#stKinds .swrow .grow'), ['PackagesAnything that ships to you', 'Store pickupsOrder ahead, collect in store', 'Food ordersDelivery apps, restaurant pickup', 'Subscriptions and app receiptsMonthly renewals, App Store', 'Tickets and other receiptsEvents, library, parking']);
    fetched.length = 0;
    await page.click('#stKinds [data-kind="food"]');
    await page.waitForFunction(() => window.__orders.orders.some(o => o.kind === 'food'), null, { timeout: 8000 });
    await settled(page);
    assert.deepEqual(fetched, ['e7'], 'only the email passed over is read');
    assert.ok(await page.evaluate(() => window.__orders.kinds.food));
    await page.reload();
    assert.ok(await page.evaluate(() => window.__orders.kinds.food), 'kept');
    await page.waitForFunction(() => window.__orders);
  });

  await step(scheme + ': a deleted order stays deleted when Gmail is read again', async () => {
    await page.click('#whenChips [data-when="way"]');
    await page.click('#list .ocard:has(.ostore:text("Walmart"))');
    await page.waitForSelector('#opage:not([hidden])');
    await page.click('#opDel');
    assert.match(await page.textContent('#opDel'), /Tap again/);
    await page.click('#opDel');
    await page.waitForFunction(() => !window.__orders.orders.some(o => o.store === 'Walmart'));
    await page.evaluate(() => { localStorage.removeItem('allison-ordersv-v1-seen'); });
    await page.reload();
    await page.waitForFunction(() => window.__orders);
    await page.evaluate(() => window.__orders.scan());
    await settled(page);
    assert.ok(!(await page.evaluate(() => window.__orders.orders.some(o => o.store === 'Walmart'))));
  });

  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'list2-' + scheme + '.png') });
  await step(scheme + ': settings open and show Gmail', async () => {
    await page.click('#setBtn');
    assert.match(await page.textContent('#stGmail'), /Look for new orders now/);
    if (SHOTS) await page.waitForTimeout(700);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'settings-' + scheme + '.png') });
  });
  await step(scheme + ': no script errors and nothing blocked by the page policy', async () => {
    assert.deepEqual(problems.filter(p => !/favicon/.test(p)), []);
  });
  await ctx.close();
}

// Google Sheet: a "wrong secret" says which link it was.
await step('another app’s Sheet link is recognised, and an old Orders script is named', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => localStorage.setItem('aos.seen', JSON.stringify({ ordersvintage: '999' })));
  const page = await ctx.newPage();
  let app = 'allison-travel-sync';
  await ctx.route('https://script.google.com/**', route => route.request().method() === 'POST'
    ? route.fulfill({ json: { ok: false, error: 'wrong-secret' } })
    : route.fulfill({ json: { ok: true, app, v: 1 } }));
  await page.goto(BASE + '/ordersvintage/');
  await page.click('#setBtn'); await page.click('#stSheet');
  await page.fill('#syUrl', 'https://script.google.com/macros/s/abc/exec'); await page.fill('#sySecret', 'maple-otter');
  await page.click('#syConnect');
  await page.waitForFunction(() => /another app/.test(document.getElementById('syStatus').textContent));
  app = 'allison-orders-sync';
  await page.click('#syConnect');
  await page.waitForFunction(() => /old copy of the script/.test(document.getElementById('syStatus').textContent));
  await ctx.close();
});

// A working Sheet: orders go up, the other phone's come down, deleted ones are gone.
await step('Sheet sync sends this phone’s orders and merges the other phone’s', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => localStorage.setItem('aos.seen', JSON.stringify({ ordersvintage: '999' })));
  const page = await ctx.newPage();
  const sent = [];
  await ctx.route('https://script.google.com/**', route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: { ok: true, app: 'allison-orders-sync', v: 1 } });
    const body = JSON.parse(route.request().postData());
    sent.push(body);
    return route.fulfill({ json: { ok: true, app: 'allison-orders-sync', v: 1, at: Date.now(), graves: {},
      orders: [{ id: 'o-other', store: 'Other Phone Shop', storeKey: 'otherphoneshop', status: 'shipped', kind: 'package', items: [{ name: 'A thing from the other phone' }], steps: { shipped: '2026-01-02' }, updated: Date.now() }] } });
  });
  await page.goto(BASE + '/ordersvintage/');
  await page.click('#fab');
  await page.fill('#ef_store', 'Corner Shop'); await page.click('#edDone');
  await page.click('#setBtn'); await page.click('#stSheet');
  await page.fill('#syUrl', 'https://script.google.com/macros/s/abc/exec'); await page.fill('#sySecret', 'maple-otter');
  await page.click('#syConnect');
  await page.waitForFunction(() => window.__orders.orders.some(o => o.store === 'Other Phone Shop'), null, { timeout: 8000 });
  assert.equal(sent[0].action, 'sync'); assert.ok(sent[0].orders.some(o => o.store === 'Corner Shop'));
  assert.equal(sent[0].bookings, undefined);
  await ctx.close();
});

await browser.close();
server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
