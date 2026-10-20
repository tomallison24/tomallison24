// Drives the Orders app in headless Chromium against a stubbed Gmail, with
// made-up order emails dated around today: reading Gmail into orders, the
// lists (on the way, delivered, to check), the order page with its tracking
// button, marking delivered, editing, adding by hand, search, the kinds in
// Settings, deleting, and that nothing trips the page's Content Security
// Policy. Screenshots go to the folder given as the second argument
// (default: none).
// Both designs (../home/design.js): Vintage, the default, drawn in the Retro look (Futura, flat
// cream or walnut cards, a mustard thumb, an orange add button, atomic shapes behind the title;
// the sky held at day, aos.sky), and Standard (Sea glass); Settings > Design switches between them
// at once and keeps the choice; and the old Orders Vintage address (served from orders/, as the
// deploy does) moves that app's data on the phone over to Orders' names, IndexedDB copy included.
// The family's Google Sheet, through aOS (aOS/SHEETS.md): the real google-sheet-sync.gs on an
// in-memory Sheet answers **/sheet/api/orders, with who's asking from the page's session. Signed out,
// the Sheet sheet asks to sign in; your orders go up as yours (Private too) and reach your other phone
// but not Ella's; an id that's someone else's is kept on the phone, not sent again; the 90 days, every
// order still on its way, and older ones back from the Sheet at the end of Delivered; an old order read
// again from Gmail folding into the Sheet's copy; the Log with Who; and the old link handed to aOS.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node orders/scripts/app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';

// ---- a static server for the repo ----
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  p = p.replace(/^\/ordersvintage\//, '/orders/');   // the old Orders Vintage address: the deploy copies orders/ there (news.yml)
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
  await ctx.addInitScript(() => (localStorage.setItem('aos.sky', 'day'), localStorage.setItem('aos.seen', JSON.stringify({ orders: '999' }))));   // no aOS walkthrough over the page; the sky held still
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
    localStorage.setItem('orders.token', JSON.stringify({ t: 'fake-token', exp: Date.now() + 3600e3, scope: 'https://www.googleapis.com/auth/gmail.readonly' }));
    localStorage.setItem('orders.token.ever', '1');
    localStorage.setItem('allison-orders-v1-ipsy-auto', '0');   // Ipsy's own To check pass: orders/scripts/ipsy-test.mjs
  });
  await page.goto(BASE + '/orders/');

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
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'list-' + scheme + '.png') });

  await step(scheme + ': Vintage by default, drawn in the Retro look: Futura, flat cream or walnut, mustard, orange, atomic shapes', async () => {
    const q = (sel, props, pseudo) => page.$eval(sel, (e, [props, pseudo]) => { const c = getComputedStyle(e, pseudo || null); return props.map(p => c[p]); }, [props, pseudo]);
    const cream = scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', ground = scheme === 'light' ? 'rgb(241, 223, 187)' : 'rgb(74, 57, 30)';
    assert.equal(await page.evaluate(() => document.documentElement.dataset.look), 'vintage');
    assert.equal(await page.evaluate(() => document.getElementById('vintage').media), 'all');
    assert.match((await q('body', ['fontFamily']))[0], /Futura/);
    assert.equal((await q('body', ['backgroundColor']))[0], ground);
    const [bg, shadow, backdrop, radius] = await q('.ocard', ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
    assert.equal(bg, cream); assert.equal(shadow, 'none'); assert.ok(backdrop === 'none' || backdrop === '', backdrop); assert.equal(radius, '20px');
    assert.equal((await q('.ambient i:nth-child(1)', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard sun');
    assert.equal((await q('.ambient i:nth-child(3)', ['backgroundColor']))[0], 'rgb(216, 87, 42)', 'a burnt-orange pill');
    assert.equal((await q('#fab', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(201, 80, 42)' : 'rgb(216, 87, 42)', 'the add button is solid orange');
    assert.equal((await q('#whenChips .slthumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard thumb');
    assert.equal((await q('.title', ['fontSize']))[0], '44px');
    assert.ok((await q('.title', ['backgroundImage'], '::after'))[0].startsWith('url('), 'the three little bars under the title');
    assert.equal((await q('.ocard .mono', ['borderRadius']))[0], '50%');
    assert.match(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'), /^icon-180\.png/, 'the Vintage icon');
    assert.equal(await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'default', 'the status bar is not translucent');
  });

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
    assert.ok(await page.$('#opBody a[href^="../mail/?thread="]'), 'a link to the email in Mail');
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

  await step(scheme + ': Have Ipsy check this order sends one email (no links) to the family server, asks first once in Ipsy\'s chat, and the answer lands on the order, with Undo', async () => {
    const sent = [];
    await ctx.route('**/orders/api/read', route => { sent.push({ h: route.request().headers(), b: JSON.parse(route.request().postData()) }); return route.fulfill({ json: { fact: {
      store: 'Walmart', kind: 'package', status: 'ordered', orderNo: '2000000-00000001', total: 49.99, cur: 'USD', items: [{ name: 'Mini Fridge 4L Cooler', qty: 1 }] } } }); });
    await page.click('#whenChips [data-when="way"]');
    await page.click('#list .ocard:has(.ostore:text("Walmart"))');
    await page.waitForSelector('#opage:not([hidden]) #opAi');
    await page.click('#opAi');
    await page.click('.ipsy-ask [data-ans="yes"]');                // asked once, in Ipsy's chat
    await page.waitForFunction(() => /Ipsy fixed/.test(document.getElementById('toastMsg').textContent), null, { timeout: 8000 });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].h['x-orders'], '1');
    assert.match(sent[0].b.subject, /Review your order updates/); assert.match(sent[0].b.text, /2000000-00000001/);
    assert.ok(!/https?:/.test(sent[0].b.text), 'no links are sent');
    const o = await page.evaluate(() => window.__orders.orders.find(o => o.store === 'Walmart'));
    assert.equal(o.items[0].name, 'Mini Fridge 4L Cooler'); assert.equal(o.ai, true); assert.equal(o.guess, false);
    assert.match(await page.textContent('#opBody .srcnote'), /fixed by Ipsy/);
    assert.match(await page.evaluate(() => JSON.parse(localStorage.getItem('ipsy.orders.chat')).view.map(v => v.text).join('|')), /Fixed Walmart: items/, 'the fix is in Ipsy\'s chat too');
    await page.click('#toastAct');
    const back = await page.evaluate(() => window.__orders.orders.find(o => o.store === 'Walmart'));
    assert.equal(back.ai, undefined); assert.match(back.items[0].name, /Mini Fridge, 4L/);
    await page.click('#opBack');
  });

  await step(scheme + ': Claude not set up, or not signed in: the order page says so and nothing changes', async () => {
    await ctx.unroute('**/orders/api/read');
    await ctx.route('**/orders/api/read', route => route.fulfill({ status: 503, json: { error: 'no-ai' } }));
    await page.click('#list .ocard:has(.ostore:text("Walmart"))');
    await page.click('#opAi');
    await page.waitForFunction(() => /isn’t set up/.test(document.getElementById('toastMsg').textContent), null, { timeout: 8000 });
    assert.equal(await page.evaluate(() => window.__orders.orders.find(o => o.store === 'Walmart').ai), undefined);
    await page.click('#opBack');
  });

  await step(scheme + ': the one-off clean-up marks old open orders as received once, with Undo; recent, expected and edited ones are left alone', async () => {
    const flag = await page.evaluate(() => Object.keys(localStorage).filter(k => /-cleanup-5d$/.test(k)));
    assert.equal(flag.length, 1, 'it ran once already, after the first full read of Gmail: ' + flag);
    await page.evaluate(k => localStorage.removeItem(k), flag[0]);
    await page.evaluate(() => {
      const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      const mk = (id, over) => Object.assign({ id, store: 'Test ' + id, storeKey: 'test' + id, items: [], status: 'shipped', kind: 'package', locks: {}, created: Date.now(), notes: '' }, over);
      window.__orders.orders.push(
        mk('old1', { steps: { shipped: ago(9) }, orderDate: ago(10) }),
        mk('oldpick', { kind: 'pickup', status: 'pickup', steps: { pickup: ago(8) } }),
        mk('recent', { steps: { shipped: ago(2) } }),
        mk('expected', { steps: { shipped: ago(9) }, eta: ago(-3) }),
        mk('edited', { steps: { shipped: ago(9) }, locks: { status: true } }));
      window.__orders.tidy();
    });
    await page.waitForFunction(() => /Marked 2 old orders as received/.test(document.getElementById('toastMsg').textContent));
    const st = await page.evaluate(() => Object.fromEntries(window.__orders.orders.filter(o => /^(old1|oldpick|recent|expected|edited)$/.test(o.id)).map(o => [o.id, o.status + (o.auto ? '*' : '')])));
    assert.deepEqual(st, { old1: 'delivered*', oldpick: 'pickedup*', recent: 'shipped', expected: 'shipped', edited: 'shipped' });
    // a rule it is not: an order that goes quiet later is not marked
    await page.evaluate(() => {
      const d = new Date(); d.setDate(d.getDate() - 12); const y = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      window.__orders.orders.push({ id: 'later', store: 'Test later', storeKey: 'testlater', items: [], status: 'shipped', kind: 'package', locks: {}, created: Date.now(), notes: '', steps: { shipped: y } });
      window.__orders.tidy(); window.__orders.render();
    });
    assert.equal(await page.evaluate(() => window.__orders.orders.find(o => o.id === 'later').status), 'shipped', 'once, not a rule');
    await page.click('#toastAct');
    const back = await page.evaluate(() => window.__orders.orders.filter(o => /^old/.test(o.id)).map(o => o.status + (o.auto ? '*' : '') + (o.locks.status ? 'L' : '')));
    assert.deepEqual(back, ['shippedL', 'pickupL'], 'undone, and left alone from now on');
    await page.evaluate(() => { window.__orders.orders.splice(0, window.__orders.orders.length, ...window.__orders.orders.filter(o => !/^(old1|oldpick|recent|expected|edited|later)$/.test(o.id))); window.__orders.save(); });
  });

  await step(scheme + ': a deleted order stays deleted when Gmail is read again', async () => {
    await page.click('#whenChips [data-when="way"]');
    await page.click('#list .ocard:has(.ostore:text("Walmart"))');
    await page.waitForSelector('#opage:not([hidden])');
    await page.click('#opDel');
    assert.match(await page.textContent('#opDel'), /Tap again/);
    await page.click('#opDel');
    await page.waitForFunction(() => !window.__orders.orders.some(o => o.store === 'Walmart'));
    await page.evaluate(() => { localStorage.removeItem('allison-orders-v1-seen'); });
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
    assert.equal(await page.getAttribute('#stIpsyAuto', 'aria-checked'), 'false', 'Ipsy\'s own To check pass is a switch, off here');
    assert.deepEqual(await texts(page, '#setSheet .sheetbody > .label'), ['Design', 'Gmail', 'Ipsy', 'What counts as an order', 'Backup Log', 'Backup'], 'Design is the first section');
    assert.equal(await page.getAttribute('#stDesign [data-design="vintage"]', 'aria-checked'), 'true');
    if (SHOTS) await page.waitForTimeout(700);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'settings-' + scheme + '.png') });
  });
  await step(scheme + ': no script errors and nothing blocked by the page policy', async () => {
    assert.deepEqual(problems.filter(p => !/favicon/.test(p)), []);
  });
  await ctx.close();
}

// ---- Both designs (../home/design.js) ----
// The family's Google Sheet through aOS (functions/sheet/api, stood in for here): the real script
// (google-sheet-sync.gs) on an in-memory Sheet, with who's asking taken from the session the page sends.
const GS = path.join(ROOT, 'orders', 'google-sheet-sync.gs'), SECRET = 'test-secret-phrase';
const PEOPLE = { 'tok-tom': { id: 'tom', name: 'Tom', role: 'owner' }, 'tok-ella': { id: 'ella', name: 'Ella', role: 'member' } };
const session = tok => JSON.stringify({ token: tok, user: PEOPLE[tok], at: 1 });
function sheetRoute(ctx, sheet, { calls = [], claims = [], answer = null } = {}) {
  return ctx.route('**/sheet/api/**', route => {
    const req = route.request(), tok = (req.headers().authorization || '').replace('Bearer ', ''), who = PEOPLE[tok];
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (!who) return json({ error: 'signin' }, 401);
    if (req.url().endsWith('/claim')) { claims.push({ who: who.id, ...JSON.parse(req.postData()) }); return json({ configured: true }); }
    if (req.method() === 'GET') return json({ configured: true });
    const body = JSON.parse(req.postData());
    calls.push({ who: who.id, ...body });
    const a = answer && answer(body, who);
    return json(a || sheet.post(req.postData(), { key: SECRET, who: who.id, name: who.name, ...(who.role === 'owner' ? { owner: '1' } : {}) }));
  });
}

// A phone: Gmail answers with no mail (or the made-up emails), the Sheet and the rest of the web are stubbed or cut off.
async function phone(scheme = 'light', { design = null, at = '/orders/', emails = false, sheet = null, answer = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.route(/^https?:\/\/(?!localhost)/, route => route.abort());
  await ctx.route('https://gmail.googleapis.com/**', route => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/profile')) return route.fulfill({ json: { emailAddress: 'tom@example.com' } });
    const list = Array.isArray(emails) ? emails : emails ? EMAILS : [];   // emails: true for the made-up ones, or a list of its own
    if (u.pathname.endsWith('/messages')) return route.fulfill({ json: { messages: list.map(m => ({ id: m.id, threadId: m.threadId })) } });
    const m = list.find(x => x.id === u.pathname.split('/').pop());
    return m ? route.fulfill({ json: gmailMessage(m) }) : route.fulfill({ status: 404, json: { error: { message: 'not found' } } });
  });
  // the family's Sheet: its own, or one shared with another phone (sheet); answer: stands in for the script when it returns something
  const posts = [], claims = [];
  sheet = sheet || fakeSheet(GS, SECRET);
  await sheetRoute(ctx, sheet, { calls: posts, claims, answer });
  await ctx.addInitScript(design => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('aos.sky', 'day');
    if (!localStorage.getItem('aos.seen')) localStorage.setItem('aos.seen', JSON.stringify({ orders: '999' }));
    if (design) localStorage.setItem('design.orders', design);
  }, design);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404|net::ERR/.test(m.text())) errs.push(m.text()); });
  return { ctx, page, errs, posts, claims, sheet, open: async () => { await page.goto(BASE + at); await page.waitForFunction(() => window.__orders); await page.waitForTimeout(600); } };
}
// What an old app left on the phone, written from a page of the same site before the app first opens (localStorage, and an IndexedDB database of key -> value)
const seedPhone = (page, ls, dbs = {}) => page.evaluate(async ([ls, dbs]) => {
  for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v);
  for (const [name, rows] of Object.entries(dbs)) await new Promise((res, rej) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); for (const [k, v] of Object.entries(rows)) t.objectStore('kv').put(v, k); t.oncomplete = () => { r.result.close(); res(); }; t.onerror = () => rej(t.error); };
    r.onerror = () => rej(r.error);
  });
}, [ls, dbs]);
const readDB = (page, name, key) => page.evaluate(([name, key]) => new Promise(res => {
  const r = indexedDB.open(name);
  r.onsuccess = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) { d.close(); return res(null); } const q = d.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => { d.close(); res(q.result || null); }; q.onerror = () => res(null); };
  r.onerror = () => res(null);
}), [name, key]);
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const TOKEN = () => JSON.stringify({ t: 'fake-token', exp: Date.now() + 3600e3, scope: 'https://www.googleapis.com/auth/gmail.readonly' });
const ORDER = (id, store) => ({ id, store, storeKey: store.toLowerCase().replace(/\W/g, ''), items: [{ name: 'A thing from ' + store }], status: 'shipped', kind: 'package', locks: {}, created: Date.now(), updated: Date.now(), notes: '', steps: { shipped: ymd(day(-1)) } });

for (const scheme of ['light', 'dark']) {
  await step(scheme + ' Standard: Sea glass, the Vintage block switched off, no sky; the icon, status bar and bar colour follow', async () => {
    const { ctx, page, errs, open } = await phone(scheme, { design: 'glass', emails: true });
    await ctx.addInitScript(t => { if (!localStorage.getItem('orders.token')) { localStorage.setItem('orders.token', t); localStorage.setItem('orders.token.ever', '1'); } }, TOKEN());
    await open();
    await page.waitForFunction(() => window.__orders.orders.length >= 5, null, { timeout: 8000 });
    await settled(page);
    const q = (sel, props) => page.$eval(sel, (e, props) => { const c = getComputedStyle(e); return props.map(p => c[p]); }, props);
    assert.ok(await page.evaluate(() => document.documentElement.dataset.look === 'glass' && document.getElementById('vintage').media === 'not all' && !document.documentElement.hasAttribute('data-sky')));
    assert.equal((await q('body', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(238, 242, 240)' : 'rgb(13, 18, 19)');
    assert.doesNotMatch((await q('body', ['fontFamily']))[0], /Futura/);
    assert.notEqual((await q('.ocard', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', 'no cream card');
    assert.notEqual((await q('#whenChips .slthumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'no mustard thumb');
    assert.notEqual((await q('.title', ['fontSize']))[0], '44px');
    assert.match(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'), /^icon-glass-180\.png/);
    assert.equal(await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'black-translucent');
    assert.equal(await page.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content'), scheme === 'light' ? '#EEF2F0' : '#0D1213');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'glass-list-' + scheme + '.png') });
    assert.deepEqual(errs, []);
    await ctx.close();
  });
}

await step('Settings > Design: Vintage, then Standard and back, at once (the filter thumb follows the new widths), kept across a reload', async () => {
  const { ctx, page, errs, open } = await phone('light', { emails: true });
  await ctx.addInitScript(t => { if (!localStorage.getItem('orders.token')) { localStorage.setItem('orders.token', t); localStorage.setItem('orders.token.ever', '1'); } }, TOKEN());
  await open();
  await page.waitForFunction(() => window.__orders.orders.length >= 5, null, { timeout: 8000 });
  await settled(page);
  const look = () => page.evaluate(() => document.documentElement.dataset.look);
  const box = sel => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width }; });
  const thumbFits = async () => { const t = await box('#whenChips .slthumb'), c = await box('#whenChips [aria-pressed="true"]'); return Math.abs(t.x - c.x) < 3 && Math.abs(t.w - c.w) < 3; };
  assert.equal(await look(), 'vintage');
  await page.click('#whenChips [data-when="done"]'); await page.waitForTimeout(700);
  await page.click('#setBtn'); await page.waitForTimeout(500);
  assert.equal(await page.getAttribute('#stDesign [data-design="vintage"]', 'aria-checked'), 'true');
  assert.equal(await page.getAttribute('#stDesign [data-design="glass"]', 'aria-checked'), 'false');
  await page.click('#stDesign [data-design="glass"]'); await page.waitForTimeout(300);
  assert.equal(await look(), 'glass', 'Standard at once');
  assert.equal(await page.getAttribute('#stDesign [data-design="glass"]', 'aria-checked'), 'true');
  assert.ok(await page.isVisible('#setSheet'), 'Settings stays open');
  await page.click('#setSheet [data-close].okbtn'); await page.waitForTimeout(700);
  assert.ok(await thumbFits(), 'the thumb fits the chosen filter in the system font');
  await page.reload(); await page.waitForFunction(() => window.__orders); await page.waitForTimeout(500);
  assert.equal(await look(), 'glass', 'Standard is kept');
  assert.equal(await page.evaluate(() => localStorage.getItem('design.orders')), 'glass');
  await page.click('#setBtn'); await page.waitForTimeout(500);
  await page.click('#stDesign [data-design="vintage"]'); await page.waitForTimeout(300);
  assert.equal(await look(), 'vintage');
  await page.click('#setSheet [data-close].okbtn'); await page.waitForTimeout(700);
  assert.ok(await thumbFits(), 'the thumb fits the chosen filter in Futura');
  await page.reload(); await page.waitForFunction(() => window.__orders);
  assert.equal(await look(), 'vintage', 'back to Vintage, kept');
  assert.deepEqual(errs, []);
  await ctx.close();
});

await step('the old Orders Vintage address: its orders, sign-in, settings and Sheet copy move over once, and what it had seen', async () => {
  const { ctx, page, errs, posts, claims, open } = await phone('light', { at: '/ordersvintage/' });
  await page.goto(BASE + '/orders/icon.svg');   // the same site, before the app has ever opened
  await seedPhone(page, {
    'aos.seen': JSON.stringify({ ordersvintage: '1.3' }), 'aos.session': session('tok-tom'),
    'ordersv.token': TOKEN(), 'ordersv.token.ever': '1', 'ordersv.me': 'tom@example.com',
    'allison-ordersv-v1': JSON.stringify({ orders: [ORDER('o-v', 'Vintage Shop')], kinds: { package: true, pickup: true, food: true } }),
    'allison-ordersv-v1-tab': 'way',
  }, { 'allison-ordersv': { sync: { url: 'https://script.google.com/macros/s/vintage/exec', secret: 'maple-otter' } } });
  await open();
  const got = await page.evaluate(() => ({ stores: window.__orders.orders.map(o => o.store), food: window.__orders.kinds.food, token: !!localStorage.getItem('orders.token'), me: localStorage.getItem('orders.me'),
    seen: JSON.parse(localStorage.getItem('aos.seen') || '{}'), old: localStorage.getItem('allison-ordersv-v1'), look: document.documentElement.dataset.look }));
  assert.deepEqual(got.stores, ['Vintage Shop'], JSON.stringify(got));
  assert.ok(await page.isVisible('#list .ocard:has(.ostore:text("Vintage Shop"))'), 'and it is on the list');
  assert.equal(got.food, true, 'its kinds'); assert.ok(got.token, 'its Gmail sign-in'); assert.equal(got.me, 'tom@example.com');
  assert.equal(got.seen.orders, '1.3', 'what it had seen (no walkthrough again)');
  assert.ok(got.old, 'nothing old is deleted'); assert.equal(got.look, 'vintage');
  // the Sheet link only lived in the old app's IndexedDB copy: it is copied over before Orders opens its own, and on the
  // owner's phone, signed in, Orders hands it to aOS (which keeps it from then on) and forgets it
  for (let i = 0; i < 60 && !claims.length; i++) await page.waitForTimeout(150);
  assert.deepEqual(claims[0], { who: 'tom', url: 'https://script.google.com/macros/s/vintage/exec', secret: 'maple-otter' });
  let kept = true;
  for (let i = 0; i < 40 && kept; i++) { kept = !!(await readDB(page, 'allison-orders', 'sync')); if (kept) await page.waitForTimeout(150); }
  assert.ok(!kept, 'Orders\' own copy is forgotten');
  assert.equal(await page.evaluate(() => localStorage.getItem('allison-orders-v1-sync')), null);
  assert.ok(await readDB(page, 'allison-ordersv', 'sync'), 'the old app\'s copy is kept, as everything old is');
  for (let i = 0; i < 40 && !posts.some(p => p.action === 'sync'); i++) await page.waitForTimeout(150);
  const first = posts.find(p => p.action === 'sync');
  assert.ok(first && first.orders.some(o => o.store === 'Vintage Shop'), 'and syncs with the family Sheet, through aOS');
  assert.ok(posts.every(p => !('secret' in p)), 'with no phrase');
  // once only: a later change to the old keys is not copied again
  await page.evaluate(() => localStorage.setItem('allison-ordersv-v1', JSON.stringify({ orders: [], kinds: {} })));
  await page.reload(); await page.waitForFunction(() => window.__orders); await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(() => window.__orders.orders.map(o => o.store)), ['Vintage Shop'], 'moved once only');
  assert.deepEqual(errs, []);
  await ctx.close();
});

await step('a phone with both: Orders\' own orders are kept, the old app\'s are not copied over them', async () => {
  const { ctx, page, errs, open } = await phone('light', { at: '/ordersvintage/' });
  await page.goto(BASE + '/orders/icon.svg');
  await seedPhone(page, {
    'aos.seen': JSON.stringify({ orders: '999', ordersvintage: '999' }),
    'allison-orders-v1': JSON.stringify({ orders: [ORDER('o-s', 'Standard Shop')], kinds: { package: true } }),
    'allison-ordersv-v1': JSON.stringify({ orders: [ORDER('o-v', 'Vintage Shop')], kinds: { package: true } }),
  });
  await open();
  assert.deepEqual(await page.evaluate(() => window.__orders.orders.map(o => o.store)), ['Standard Shop']);
  assert.deepEqual(errs, []);
  await ctx.close();
});


// ---- The family's Google Sheet, through aOS (aOS/SHEETS.md) ----
const TOM = { key: SECRET, who: 'tom', name: 'Tom', owner: '1' };
const until = async (page, fn, what, ms = 12000) => { for (let t = 0; t < ms; t += 150) { if (await fn()) return; await page.waitForTimeout(150); } assert.fail('never saw ' + (typeof what === 'function' ? what() : what)); };
const OLD = n => ymd(day(-n));
const SEEDED = (id, store, extra) => Object.assign(ORDER(id, store), extra);
const SEEN = JSON.stringify({ orders: '999' });

await step('the family’s Google Sheet: signed out it asks to sign in, with no link or phrase to type; signed in, your orders go up as yours', async () => {
  const { ctx, page, errs, posts, sheet, open } = await phone('light');
  await page.goto(BASE + '/orders/icon.svg');
  await seedPhone(page, { 'allison-orders-v1': JSON.stringify({ orders: [ORDER('o-c', 'Corner Shop'), SEEDED('o-p', 'Pharmacy', { private: true })], kinds: { package: true } }) });
  await open();
  await page.click('#setBtn');
  assert.equal(await page.textContent('#stSheetSub'), 'Sign in to sync');
  await page.click('#stSheet');
  await page.waitForSelector('#syncSheet:not([hidden])');
  assert.match(await page.textContent('#syStatus'), /Sign in to sync with the family’s Google Sheet/);
  assert.equal(await page.textContent('#syNow .t'), 'Sign in and sync');
  assert.equal(await page.$('#syUrl'), null, 'no link or phrase on a phone');
  assert.equal(await page.$('#syShare'), null, 'and no setup link');
  assert.equal(posts.length, 0, 'nothing goes anywhere signed out');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'sheet-signed-out.png') });
  await page.evaluate(s => localStorage.setItem('aos.session', s), session('tok-tom'));
  await page.reload(); await page.waitForFunction(() => window.__orders);
  await until(page, () => sheet.tab('Orders'), 'the Orders tab');
  assert.deepEqual(sheet.tab('Orders').slice(1).map(r => r[0] + ':' + r[2]).sort(), ['Tom:Corner Shop', 'Tom:Pharmacy'], 'each order says whose it is');
  assert.ok(posts.every(p => !('secret' in p)), 'the phone sends no phrase');
  assert.equal(posts.find(p => p.action === 'sync').window, 90, 'and keeps 90 days');
  assert.equal(sheet.post({ action: 'sync', graves: {} }, TOM).orders.find(o => o.id === 'o-p').private, true, 'Private goes up like any other detail');
  await page.click('#setBtn'); await page.click('#stSheet');
  await page.waitForFunction(() => /In the family’s Google Sheet\. Last synced/.test(document.getElementById('syStatus').textContent), null, { timeout: 8000 });
  assert.equal(await page.textContent('#syNow .t'), 'Sync now');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'sheet-synced.png') });
  // your other phone gets your orders
  const two = await phone('light', { sheet });
  await two.page.goto(BASE + '/orders/icon.svg'); await seedPhone(two.page, { 'aos.session': session('tok-tom'), 'aos.seen': SEEN }); await two.open();
  await two.page.waitForFunction(() => window.__orders.orders.length === 2, null, { timeout: 8000 });
  assert.equal(await two.page.evaluate(() => window.__orders.orders.find(o => o.id === 'o-p').private), true, 'Private, and so hidden from Ipsy, there too');
  await two.ctx.close();
  // Ella's phone gets none of them. It has an order with one of Tom's ids (the same email in her Gmail), and one of her own.
  const ella = await phone('light', { sheet });
  await ella.page.goto(BASE + '/orders/icon.svg');
  await seedPhone(ella.page, { 'aos.session': session('tok-ella'), 'aos.seen': SEEN, 'allison-orders-v1': JSON.stringify({ orders: [ORDER('o-c', 'Corner Shop'), ORDER('o-e', 'Etsy')], kinds: { package: true } }) });
  await ella.open();
  await until(ella.page, () => ella.page.evaluate(() => window.__orders.notMine.has('o-c')), 'Tom\'s id turned down');
  await ella.page.waitForTimeout(3000);
  const n = ella.posts.filter(p => p.action === 'sync').length;
  await ella.page.waitForTimeout(2500);
  assert.equal(ella.posts.filter(p => p.action === 'sync').length, n, 'and no sync after sync because of it');
  assert.deepEqual(await ella.page.evaluate(() => window.__orders.orders.map(o => o.id).sort()), ['o-c', 'o-e'], 'her copy stays on her phone');
  assert.ok(!ella.posts.at(-1).orders.some(o => o.id === 'o-c'), 'and isn\'t sent again');
  assert.deepEqual(sheet.post({ action: 'sync', graves: {} }, TOM).orders.map(o => o.id).sort(), ['o-c', 'o-p'], 'Tom\'s are as they were');
  assert.deepEqual(sheet.tab('Orders').slice(1).map(r => r[0] + ':' + r[2]).sort(), ['Ella:Etsy', 'Tom:Corner Shop', 'Tom:Pharmacy']);
  assert.deepEqual(ella.errs, []);
  await ella.ctx.close();
  assert.deepEqual(errs, []);
  await ctx.close();
});

await step('the phone keeps 90 days and every order still on its way; older ones come back from the Sheet at the end of Delivered', async () => {
  const { ctx, page, errs, posts, sheet, open } = await phone('light');
  await page.goto(BASE + '/orders/icon.svg');
  await seedPhone(page, { 'aos.session': session('tok-tom'), 'allison-orders-v1': JSON.stringify({ kinds: { package: true }, orders: [
    SEEDED('o-new', 'New Shop', { status: 'delivered', orderDate: OLD(10), steps: { ordered: OLD(10), delivered: OLD(8) } }),
    SEEDED('o-old', 'Old Shop', { status: 'delivered', orderDate: OLD(200), steps: { ordered: OLD(200), delivered: OLD(195) } }),
    SEEDED('o-lost', 'Slow Boat', { status: 'shipped', orderDate: OLD(150), steps: { ordered: OLD(150), shipped: OLD(149) } }),
  ] }) });
  await open();
  await until(page, () => page.evaluate(() => !!window.__orders.pruneFrom() && !window.__orders.orders.some(o => o.id === 'o-old')), 'the old order tidied away');
  assert.deepEqual(await page.evaluate(() => window.__orders.orders.map(o => o.id).sort()), ['o-lost', 'o-new'], 'the last 90 days, and the one still on its way');
  assert.deepEqual(Object.keys(await page.evaluate(() => window.__orders.graves())), [], 'with no grave: the Sheet keeps it');
  assert.ok(sheet.post({ action: 'sync', graves: {} }, TOM).orders.some(o => o.id === 'o-old'), 'it is in the Sheet');
  await page.click('#whenChips [data-when="done"]');
  await page.waitForSelector('#olderGo');
  assert.doesNotMatch(await page.textContent('#list'), /Old Shop/);
  await page.click('#olderGo');
  await page.waitForFunction(() => /Old Shop/.test(document.getElementById('list').textContent), null, { timeout: 8000 });
  assert.match(await page.textContent('#toastMsg'), /^Found 1 older order, /, 'the one still on its way was here already');
  const range = posts.filter(p => p.action === 'range').at(-1);
  assert.ok(range && range.to < OLD(89) && range.from <= OLD(200), JSON.stringify(range));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'sheet-older.png') });
  // it stays while Orders is open, through another sync
  await page.evaluate(() => window.__orders.sync(false)); await page.waitForTimeout(500);
  assert.ok(await page.evaluate(() => window.__orders.orders.some(o => o.id === 'o-old')));
  // a second tap goes a year further back, and finds nothing
  await page.click('#olderGo');
  await page.waitForFunction(() => /Nothing older in the family’s Google Sheet/.test(document.getElementById('list').textContent), null, { timeout: 8000 });
  // and no sync after sync because of what was fetched
  await page.waitForTimeout(1500);
  const n = posts.length; await page.waitForTimeout(2500);
  assert.equal(posts.length, n, posts.slice(n).map(p => p.action).join());
  // the next time Orders opens, it goes again
  await page.reload(); await page.waitForFunction(() => window.__orders);
  await until(page, () => page.evaluate(() => !window.__orders.orders.some(o => o.id === 'o-old')), 'the old order gone again');
  assert.deepEqual(errs, []);
  await ctx.close();
});

await step('an old order read again from Gmail folds into your copy in the Sheet: your edits, Private and notes stay', async () => {
  const OLD_MAIL = { id: 'e-old', threadId: 't-old', ago: 200, from: 'Skin Tech <sales@skintech.example>', subject: 'Your order is on the way', text:
    `Order On The Way.\n\nYour Skin Tech order has been packed and picked up by UPS.\n\nOrder No. US-0000000099\n\nWhat's Coming?\n\nSkin Tech Hair Dryer\n\nx1\n\nDelivery Carrier\n\nUPS\n\nTracking No.\n\n1Z0000000000000099` };
  const { ctx, page, errs, posts, sheet, open } = await phone('light', { emails: [OLD_MAIL, EMAILS[0]] });
  // what Orders makes of that email (the same reader, here in Node), and Tom's copy of it in the Sheet from long ago, edited
  const P = require(path.join(ROOT, 'orders', 'parse.js'));
  const f = P.parseEmail({ text: OLD_MAIL.text, subject: OLD_MAIL.subject, from: OLD_MAIL.from, date: Date.now() - 200 * 864e5, id: OLD_MAIL.id, threadId: OLD_MAIL.threadId }).orders[0];
  const T0 = Date.now() - 200 * 864e5;
  sheet.post({ action: 'sync', orders: [{ ...f, status: 'delivered', steps: { ...f.steps, delivered: OLD(195) }, tracking: '', trackUrl: '', private: true, notes: 'For Mum', locks: { status: true }, checked: true, guess: false, created: T0, updated: T0 + 5 * 864e5 }], graves: {} }, TOM);
  await page.goto(BASE + '/orders/icon.svg');
  await seedPhone(page, { 'aos.session': session('tok-tom'), 'orders.token': TOKEN(), 'orders.token.ever': '1', 'allison-orders-v1-family': '1', 'allison-orders-v1-log-seed': '1', 'allison-orders-v1-sync-at': String(Date.now() - 864e5) });
  await open();
  await until(page, () => posts.some(p => p.action === 'range') && posts.filter(p => p.action === 'sync').length >= 2, () => 'the Sheet asked first, then a sync: ' + posts.map(p => p.action).join());
  await page.waitForTimeout(800);
  const all = sheet.post({ action: 'sync', graves: {} }, TOM).orders, back = all.find(o => o.id === f.id);
  assert.ok(back, 'the same order');
  assert.equal(all.filter(o => o.store === 'Skin Tech').length, 1, 'not two');
  assert.equal(back.private, true); assert.equal(back.notes, 'For Mum'); assert.equal(back.status, 'delivered', 'the status you set stays');
  assert.equal(back.created, T0);
  assert.equal(back.tracking, '1Z0000000000000099', 'what the email says that the Sheet\'s copy lacked is folded in');
  const mine = await page.evaluate(id => window.__orders.orders.find(o => o.id === id), f.id);
  assert.ok(mine && mine.private && mine.notes === 'For Mum', 'and this phone has it as the Sheet does, for now');
  assert.ok(!posts.flatMap(p => p.log || []).some(e => e.ev === 'Added' && e.o.store === 'Skin Tech'), 'it wasn\'t logged as added');
  assert.ok(all.some(o => o.store === 'Home Depot'), 'a new order from the same read goes up as usual');
  assert.deepEqual(errs, []);
  await ctx.close();
});

await step('Sheet Log, through aOS: every order added, status change, edit, deletion and left-out email is sent once, acknowledged and written with whose it is', async () => {
  let oldScript = false;
  // an old script (VERSION 2) turns away aOS's request: there's no phrase in it
  const { ctx, page, errs, posts, sheet, open } = await phone('light', { emails: true, answer: () => oldScript ? { ok: false, app: 'allison-orders-sync', error: 'wrong-secret' } : null });
  await page.goto(BASE + '/orders/icon.svg');
  await seedPhone(page, { 'aos.session': session('tok-tom'), 'orders.token': TOKEN(), 'orders.token.ever': '1', 'allison-orders-v1-family': '1', 'allison-orders-v1-log-seed': '1', 'allison-orders-v1-ipsy-auto': '0' });
  await open();
  const events = () => posts.flatMap(p => p.log || []);
  const seen = (fn, what) => until(page, () => events().some(fn), () => what + ': ' + JSON.stringify(events().map(e => e.ev + ' ' + (e.o.store || '') + ' ' + e.note)));
  await until(page, () => new Set(events().filter(e => e.ev === 'Added').map(e => e.id)).size >= 5, 'five Added');
  assert.deepEqual([...new Set(events().filter(e => e.ev === 'Added').map(e => e.o.store))].sort(), ['Green Home Supply', 'Home Depot', 'Skin Tech', 'Target', 'Walmart']);
  // the food order Settings leaves out is in the Log all the same
  await seen(e => e.ev === 'Left out', 'Left out');
  const left = events().find(e => e.ev === 'Left out');
  assert.equal(left.o.kind, 'food'); assert.match(left.note, /switched off in Settings/);
  assert.equal(await page.evaluate(() => window.__orders.orders.some(o => o.kind === 'food')), false, 'and it is still not in the list');
  // a status change is a new row, with where it came from
  await page.evaluate(() => { const o = window.__orders.orders.find(x => x.store === 'Home Depot'); o.status = 'delivered'; o.steps = { ...o.steps, delivered: o.steps.shipped }; window.__orders.save(); });
  await seen(e => e.ev === 'Status changed' && e.o.store === 'Home Depot', 'Status changed');
  const st = events().find(e => e.ev === 'Status changed');
  assert.equal(st.note, 'Shipped → Delivered'); assert.equal(st.o.status, 'delivered'); assert.equal(st.o.orderNo, 'WK00000001');
  // a detail edit is an Updated row; a deletion is a Deleted row with the order as it was
  await page.evaluate(() => { const o = window.__orders.orders.find(x => x.store === 'Target'); o.tracking = 'TRK123'; window.__orders.save(); });
  await seen(e => e.ev === 'Updated' && e.o.store === 'Target', 'Updated');
  assert.equal(events().find(e => e.ev === 'Updated').note, 'Changed: tracking');
  await page.evaluate(() => { const a = window.__orders.orders, i = a.findIndex(x => x.store === 'Walmart'); a.splice(i, 1); window.__orders.save(); });
  await seen(e => e.ev === 'Deleted', 'Deleted');
  assert.equal(events().find(e => e.ev === 'Deleted').o.store, 'Walmart');
  await until(page, () => page.evaluate(() => JSON.parse(localStorage.getItem('allison-orders-v1-log') || '[]').length === 0), 'every event acknowledged');
  const log = sheet.tab('Log');
  assert.equal(log[0][0], 'Who');
  assert.equal(new Set(log.slice(1).map(r => r[14])).size, log.length - 1, 'every event written once');
  assert.ok(log.slice(1).every(r => r[0] === 'Tom'), 'each with whose phone it came from');
  assert.ok(log.some(r => r[2] === 'Left out' && r[4] === 'food'));
  // an old script: the events stay queued, and Orders says what the owner has to do
  oldScript = true;
  await page.evaluate(() => { const o = window.__orders.orders.find(x => x.store === 'Target'); o.tracking = 'TRK456'; window.__orders.save(); });
  await page.waitForFunction(() => /still on its old script/.test(document.body.textContent), null, { timeout: 8000 });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('allison-orders-v1-log')).length), 1);
  assert.deepEqual(errs, []);
  await ctx.close();
});

await step('the owner\'s phone hands the Sheet link and phrase it kept over to aOS, then forgets them; another phone just forgets them once aOS has one', async () => {
  for (const tok of ['tok-tom', 'tok-ella']) {
    const { ctx, page, errs, claims, open } = await phone('light');
    await page.goto(BASE + '/orders/icon.svg');
    await seedPhone(page, { 'aos.session': session(tok), 'allison-orders-v1-sync': JSON.stringify({ url: 'https://script.google.com/macros/s/abc/exec', secret: 'maple-otter' }) });
    await open();
    await until(page, () => page.evaluate(() => !localStorage.getItem('allison-orders-v1-sync')), 'the old link forgotten');
    assert.deepEqual(claims, tok === 'tok-tom' ? [{ who: 'tom', url: 'https://script.google.com/macros/s/abc/exec', secret: 'maple-otter' }] : [], 'only the owner\'s phone hands it over');
    assert.deepEqual(errs, []);
    await ctx.close();
  }
  // an old setup link opened on a phone is only taken off the address
  const { ctx, page, open } = await phone('light', { at: '/orders/#sync=' + Buffer.from(JSON.stringify({ u: 'https://script.google.com/macros/s/abc/exec', s: 'maple-otter' })).toString('base64url') });
  await open();
  assert.equal(await page.evaluate(() => location.hash), '');
  assert.equal(await page.evaluate(() => localStorage.getItem('allison-orders-v1-sync')), null);
  await ctx.close();
});

await browser.close();
server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
