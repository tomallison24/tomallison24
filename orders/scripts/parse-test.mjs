// Checks orders/parse.js against made-up order emails written in the shapes
// stores and carriers use: a hardware store's HTML tables, an auction site's
// delivery window, a WooCommerce shop, a small store's labelled lines, UPS
// notices, a store that only sends HTML, pickups, and the like. None of these
// are real emails and every name, number and address is invented; the wording
// of real ones varies, which is why an order read from words can still come
// out marked "check this" in the app.
//
//   node orders/scripts/parse-test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const P = createRequire(import.meta.url)('../parse.js');
const at = (m, d, h = 12) => new Date(2026, m - 1, d, h, 0).getTime();
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const one = (msg) => { const r = P.parseEmail({ date: at(10, 12), id: 'm' + Math.random(), ...msg }); return { r, f: r.orders[0] }; };
const fold = (list, msgs, ctx) => { msgs.forEach(m => { const { f } = one(m); if (f) P.upsert(list, f, ctx); }); return list; };

// ---- layouts --------------------------------------------------------------
const HARDWARE_FROM = 'The Home Depot <HomeDepot@order.homedepot.com>';
const hardwareConfirm = `<html><body><table><tr><td>Thanks for ordering from The Home Depot.</td></tr>
<tr><td>Order Number WK00000001</td><td>Order Date Oct. 6, 2026</td></tr>
<tr><td>Item</td><td>Unit Price</td><td>Qty</td><td>Item Total</td></tr>
<tr><td><img src="x.png"></td><td>Oak Click Lock Vinyl Plank Flooring (23.62 sq. ft./Case)<br>Store SKU # 1000000001 Internet # 300000001 Est Arrival: Oct. 9</td><td>$63.54</td><td>12.00</td><td>$762.48</td></tr>
<tr><td>Foam Underlayment for Laminate Flooring, 100 sq. ft.<br>Store SKU # 1000000002 Internet # 300000002</td><td>$79.00</td><td>2.00</td><td>$158.00</td></tr>
<tr><td>Subtotal</td><td>$920.48</td></tr><tr><td>Delivery</td><td>FREE</td></tr><tr><td>Sales Tax</td><td>$66.73</td></tr>
<tr><td>Order Total</td><td>$987.21</td></tr><tr><td>Paid with Credit Card ending in 1111</td></tr></table></body></html>`;
const hardwareShipped = `<html><body><p>Order #: WK00000001</p><p>Order Date: Oct 6, 2026</p><h2>Your package has shipped, Tom!</h2>
<p>Note: tracking information may not be available until 24 - 48 hours after this email is sent.</p>
<table><tr><td>Estimated Delivery</td><td>Fri, Oct 9</td></tr><tr><td>Tracking ID: WK00000001-12345678</td></tr>
<tr><td>Home Decorators Collection</td></tr><tr><td>Oak Click Lock Vinyl Plank Flooring (23.62 sq. ft./Case)</td></tr><tr><td>SKU #1000000001</td></tr><tr><td>Qty: 12</td><td>$762.48</td></tr>
<tr><td>Order Subtotal</td><td>$1,005.44</td></tr><tr><td>Total</td><td>$987.21</td></tr></table></body></html>`;
const hardwareDelivered = `<html><body><p>Order # WK00000001. Order Date: October 6, 2026</p><h2>Your delivery has arrived, Tom.</h2><p>Your item(s) arrived today, Friday, October 9.</p></body></html>`;

const auctionConfirm = `<html><body><h1>Thanks for shopping! Your order is confirmed.</h1><h3>Your order will ship to:</h3><p>Tom Example<br>1 Example Street<br>Apex, NC</p>
<h3>Estimated delivery:</h3><p>Fri, Oct 16 - Tue, Oct 20</p><h2>Your order details</h2>
<p>We’ll let you know when your order has shipped. The Refurbished item you have purchased is backed by our Money Back Guarantee.</p>
<h3><a href="#">Air Purifier Heating Fan HP04 | Nickel/Silver | Refurbished</a></h3>
<table><tr><td>Price: $309.99</td><td>$309.99</td></tr><tr><td>Item ID: 100000000001</td></tr><tr><td>Order number: 10-00000-00001</td></tr><tr><td>Seller: outletstore</td></tr></table>
<h3>Order total:</h3><table><tr><td>Subtotal</td><td>$309.99</td></tr><tr><td>Shipping</td><td>Free</td></tr><tr><td>Sales tax</td><td>$22.47</td></tr><tr><td>Coupons, discounts</td><td>− $62.00</td></tr><tr><td>Total charged to</td><td>$270.46</td></tr></table></body></html>`;
const auctionOut = `<html><body><h1>Your order is out for delivery today.</h1><h3><a href="#">Air Purifier Heating Fan HP04 | Nickel/Silver | Refurbished</a></h3>
<table><tr><td>Item ID: 100000000001</td></tr><tr><td>Order number: 10-00000-00001</td></tr></table><h3>Estimated delivery:</h3><p>Fri, Oct 16</p><h3>Carrier:</h3><p>UPS</p>
<p>For questions on your shipment, please contact UPS.</p></body></html>`;

const wooShipped = `<html><body><h2>Your order has shipped</h2><p>Hi there. Your recent order on Green Home Supply has been shipped. Your order details are shown below for your reference:</p>
<h3>Tracking Information</h3><table><tr><th>Provider</th><th>Tracking Number</th><th>Date</th></tr><tr><td>USPS</td><td>9400100000000000000000</td><td>October 9, 2026</td></tr></table>
<h3>Order #IN-100001</h3><table><tr><th>Product</th><th>Quantity</th><th>Price</th></tr><tr><td>Activator Capsules - Every 3 Months -<br><strong>Delivery Frequency:</strong> Every 3 Months</td><td>1</td><td>$28.75</td></tr>
<tr><td>Subtotal:</td><td>$28.75</td></tr><tr><td>Shipping:</td><td>First Class (1-4 days delivery)</td></tr><tr><td>Tax:</td><td>$2.09</td></tr><tr><td>Payment method:</td><td>Visa ending in 1111</td></tr><tr><td>Total:</td><td>$30.84</td></tr></table></body></html>`;

const smallStoreShipped = `Order On The Way.

Hey Tom

Your Skin Tech order has been packed and picked up by UPS. We will let you know when it’s out for delivery.

Order No. US-0000000001

What's Coming?

item.ProductName
Skin Tech LED Light Therapy Face Mask

x1
Series 2 / LED Red Light Mask

Delivery Address

Tom Example

Delivery Carrier

UPS

Tracking No.

1Z0000000000000001`;

const upsShip = `You have a package coming.

Scheduled Delivery Date: Monday, 10/12/2026

Shipment Details

From: SKIN TECH

Tracking Number: 1Z0000000000000001
https://www.ups.com/track?loc=en_US&tracknum=1Z0000000000000001

Ship To:

Tom Example
UPS Service: UPS GROUND`;
const upsDelivered = `, your package has been delivered.

Delivery Date: Monday, 10/12/2026

Delivery Time: 1:19 PM

Left At: FRONT DOOR

SKIN TECH

Tracking Number: 1Z0000000000000001
Ship To: TOM EXAMPLE`;

const electronicsOut = {
  from: 'Best Buy <BestBuyInfo@emailinfo.bestbuy.com>', subject: '📦 Your package is out for delivery. 📦',
  text: 'View as a Web page:\nhttps://click.example.com/?qs=abc\n\nBEST BUY\n\nView full message:\nhttps://click.example.com/?qs=def',
  html: `<html><body><p>See inside for details.</p><p>Top Deals</p><p>Outlet</p><p>TVs</p><p>Computers</p><h2>Your package is out for delivery.</h2><p>FedEx let us know your package will be delivered today.</p>
<p>Order number:</p><p>BBY01-100000000001</p><p>Tracking number:</p><p>100000000001</p><p>Status:</p><p>Out for delivery</p><p>Arriving:</p><p>Monday, October 12</p>
<h3>Product Details</h3><p>Acme - 50” Class QLED 4K Smart TV (2025)</p><p>Model #:</p><p>AC50Q8FA</p><p>Qty:</p><p>1</p><h3>What you should know.</h3><p>Additional items in your order?</p><p>Computers</p><p>Appliances</p></body></html>`,
};

const pickupReady = { from: 'Target <orders@oe.target.com>', subject: 'Your order’s ready for pickup at Apex. Order #100000000012345',
  text: 'Your order’s available now through Mon, October 19.\n\nBring your phone to the Order Pickup counter.\n\nOrder #100000000012345\nPlaced Oct 12, 2026' };
const pickupDone = { from: 'Target <orders@oe.target.com>', subject: 'Thanks for picking up your order. Order #100000000012345', text: 'Thanks for picking up your order #100000000012345 at Apex.' };
const homePickup = { from: HARDWARE_FROM, subject: 'Your order\'s ready! Pick it up by Saturday, October 17',
  text: 'Order #: WK00000002 Order Date: Oct 12, 2026\nTom, your order is ready for Curbside Pickup until Saturday, October 17. Check in with the app and bring your photo ID.' };

const unavailable = { from: 'Big Box <help@walmart.com>', subject: 'Review your order updates',
  text: 'Your order has 1 unavailable item\nOrder date: Mon, Oct 12, 2026\nOrder number: 2000000-00000001\nReview your order updates. 1 item unavailable. You’ll only be charged for the items you receive.\nMini Fridge, 4L Portable Personal Cooler, Black\n$29.84/EA\nQty: 1\n$49.99\nTemporary hold: $142.04' };

// ---- tests ----------------------------------------------------------------
test('hardware store: confirmation, shipping and delivery are one order', () => {
  const list = fold([], [
    { html: hardwareConfirm, subject: 'We received your order!', from: HARDWARE_FROM, date: at(10, 6, 12) },
    { html: hardwareShipped, subject: 'Order #WK00000001 Shipped: Your order is on its way, Tom!', from: HARDWARE_FROM, date: at(10, 7, 12) },
    { html: hardwareDelivered, subject: "We've delivered your order!", from: HARDWARE_FROM, date: at(10, 9, 15) },
  ]);
  assert.equal(list.length, 1);
  const o = list[0];
  assert.equal(o.store, 'Home Depot'); assert.equal(o.orderNo, 'WK00000001'); assert.equal(o.total, 987.21);
  assert.equal(o.status, 'delivered'); assert.equal(o.kind, 'package');
  assert.deepEqual(o.steps, { ordered: '2026-10-06', shipped: '2026-10-07', delivered: '2026-10-09' });
  assert.equal(o.tracking, 'WK00000001-12345678');
  assert.equal(o.orderDate, '2026-10-06');
  assert.equal(o.items.length, 2, 'both items, no duplicates from the shipping email');
  assert.match(o.items[0].name, /Oak Click Lock Vinyl Plank Flooring/); assert.equal(o.items[0].qty, 12);
  assert.match(o.items[1].name, /Foam Underlayment/); assert.equal(o.items[1].qty, 2);
});
test('hardware store: totals, dates and the estimated arrival', () => {
  const { f } = one({ html: hardwareConfirm, subject: 'We received your order!', from: HARDWARE_FROM, date: at(10, 6) });
  assert.equal(f.status, 'ordered'); assert.equal(f.eta, '2026-10-09'); assert.equal(f.total, 987.21); assert.equal(f.cur, 'USD'); assert.equal(f.guess, false);
  const s = one({ html: hardwareShipped, subject: 'Order #WK00000001 Shipped', from: HARDWARE_FROM, date: at(10, 7) }).f;
  assert.equal(s.status, 'shipped'); assert.equal(s.eta, '2026-10-09'); assert.equal(s.total, 987.21, 'Total, not Order Subtotal');
  assert.match(s.items[0].name, /Home Decorators Collection Oak Click Lock/, 'a brand line above the name joins it');
});

test('auction site: delivery window, item, totals; then out for delivery with the carrier', () => {
  const a = one({ html: auctionConfirm, subject: 'Your order’s confirmed for Air Purifier Heating Fan...', from: 'eBay <ebay@ebay.com>', date: at(10, 12) }).f;
  assert.equal(a.store, 'eBay'); assert.equal(a.orderNo, '10-00000-00001'); assert.equal(a.status, 'ordered');
  assert.equal(a.eta, '2026-10-16'); assert.equal(a.etaEnd, '2026-10-20'); assert.equal(a.total, 270.46);
  assert.equal(a.items.length, 1); assert.match(a.items[0].name, /^Air Purifier Heating Fan HP04/);
  const o = one({ html: auctionOut, subject: 'OUT FOR DELIVERY: Air Purifier Heating Fan...', from: 'eBay <ebay@ebay.com>', date: at(10, 16) }).f;
  assert.equal(o.status, 'out'); assert.equal(o.carrier, 'UPS'); assert.equal(o.orderNo, '10-00000-00001'); assert.equal(o.eta, '2026-10-16');
  assert.equal(a.id, o.id, 'the same order');
  const list = fold([], [{ html: auctionConfirm, subject: 'Your order’s confirmed', from: 'eBay <ebay@ebay.com>', date: at(10, 12) }, { html: auctionOut, subject: 'OUT FOR DELIVERY: x', from: 'eBay <ebay@ebay.com>', date: at(10, 16) }]);
  assert.equal(list.length, 1); assert.equal(list[0].status, 'out'); assert.equal(list[0].carrier, 'UPS'); assert.equal(list[0].etaEnd, '2026-10-20');
});

test('WooCommerce-style shop: provider and tracking number in a table, USPS link', () => {
  const { f } = one({ html: wooShipped, subject: 'Your Green Home Supply order from October 8, 2026 has shipped', from: 'support@greenhomesupply.example', date: at(10, 9) });
  assert.equal(f.store, 'Green Home Supply'); assert.equal(f.orderNo, 'IN-100001'); assert.equal(f.status, 'shipped');
  assert.equal(f.carrier, 'USPS'); assert.equal(f.tracking, '9400100000000000000000');
  assert.equal(f.trackUrl, 'https://tools.usps.com/go/TrackConfirmAction_input?qtc_tLabels1=9400100000000000000000');
  assert.equal(f.total, 30.84); assert.equal(f.items.length, 1); assert.equal(f.items[0].name, 'Activator Capsules - Every 3 Months'); assert.equal(f.guess, false);
});

test('small store: carrier and tracking on labelled lines, template junk ignored', () => {
  const { f } = one({ text: smallStoreShipped, subject: 'Your order is on the way', from: 'Skin Tech <sales@skintech.example>', date: at(10, 9) });
  assert.equal(f.store, 'Skin Tech'); assert.equal(f.orderNo, 'US-0000000001'); assert.equal(f.status, 'shipped');
  assert.equal(f.carrier, 'UPS'); assert.equal(f.tracking, '1Z0000000000000001'); assert.equal(f.trackUrl, 'https://www.ups.com/track?tracknum=1Z0000000000000001');
  assert.deepEqual(f.items.map(i => i.name), ['Skin Tech LED Light Therapy Face Mask'], 'not item.ProductName, not the variant line');
});

test('a heading above the item is not part of its name', () => {
  const { f } = one({ text: 'Order On The Way.\n\nOrder No. US-0000000001\n\nWhat\'s Coming?\nSkin Tech LED Light Therapy Face Mask\nx1\nTracking No. 1Z0000000000000001', subject: 'Your order is on the way', from: 'Skin Tech <sales@skintech.example>' });
  assert.deepEqual(f.items.map(i => i.name), ['Skin Tech LED Light Therapy Face Mask']);
});
test('UPS notices: the shipper, the number, the date; they fold into the store’s order in either order', () => {
  const ship = one({ text: upsShip, subject: 'UPS Ship Notification, Tracking Number 1Z0000000000000001', from: 'UPS <pkginfo@ups.com>', date: at(10, 9) }).f;
  assert.equal(ship.carrier, 'UPS'); assert.equal(ship.status, 'shipped'); assert.equal(ship.store, 'Skin Tech'); assert.equal(ship.eta, '2026-10-12'); assert.equal(ship.orderNo, '');
  const del = one({ text: upsDelivered, subject: 'UPS Delivery Notification, Tracking Number 1Z0000000000000001', from: 'UPS <pkginfo@ups.com>', date: at(10, 12, 13) }).f;
  assert.equal(del.status, 'delivered'); assert.equal(del.deliveredOn, '2026-10-12'); assert.equal(del.store, 'Skin Tech');
  const store = { text: smallStoreShipped, subject: 'Your order is on the way', from: 'Skin Tech <sales@skintech.example>', date: at(10, 9) };
  const mails = [store, { text: upsShip, subject: 'UPS Ship Notification, Tracking Number 1Z0000000000000001', from: 'UPS <pkginfo@ups.com>', date: at(10, 9) },
    { text: upsDelivered, subject: 'UPS Delivery Notification, Tracking Number 1Z0000000000000001', from: 'UPS <pkginfo@ups.com>', date: at(10, 12, 13) }];
  for (const order of [[0, 1, 2], [2, 1, 0], [1, 2, 0], [2, 0, 1]]) {
    const list = fold([], order.map(i => mails[i]));
    assert.equal(list.length, 1, 'one order, read in order ' + order);
    const o = list[0];
    assert.equal(o.status, 'delivered'); assert.equal(o.orderNo, 'US-0000000001'); assert.equal(o.tracking, '1Z0000000000000001');
    assert.equal(o.steps.delivered, '2026-10-12'); assert.equal(o.steps.shipped, '2026-10-09'); assert.match(o.items[0].name, /LED Light Therapy/);
  }
});
test('a carrier notice with no store order behind it becomes its own package', () => {
  const list = fold([], [{ text: upsShip, subject: 'UPS Ship Notification, Tracking Number 1Z0000000000000001', from: 'UPS <pkginfo@ups.com>', date: at(10, 9) }]);
  assert.equal(list.length, 1); assert.equal(list[0].store, 'Skin Tech'); assert.equal(list[0].tracking, '1Z0000000000000001'); assert.equal(list[0].status, 'shipped');
  // a different shipper's order is not mixed in
  const other = fold(list, [{ text: smallStoreShipped.replace('1Z0000000000000001', '1Z0000000000000002').replace('US-0000000001', 'US-0000000002').replace(/Skin Tech/g, 'Pet Shop'), subject: 'Your order is on the way', from: 'Pet Shop <sales@petshop.example>', date: at(10, 9) }]);
  assert.equal(other.length, 2);
});

test('an email that is only HTML: the order, FedEx number and arrival are read from it', () => {
  const { f } = one(electronicsOut);
  assert.equal(f.store, 'Best Buy'); assert.equal(f.orderNo, 'BBY01-100000000001'); assert.equal(f.status, 'out');
  assert.equal(f.carrier, 'FedEx'); assert.equal(f.tracking, '100000000001'); assert.equal(f.trackUrl, 'https://www.fedex.com/fedextrack/?trknbr=100000000001');
  assert.equal(f.eta, '2026-10-12');
  assert.deepEqual(f.items.map(i => i.name), ['Acme - 50” Class QLED 4K Smart TV (2025)'], 'no model number, no menu words');
});

test('store pickup: ready, with the day it is held until, then picked up', () => {
  const r = one(pickupReady).f;
  assert.equal(r.kind, 'pickup'); assert.equal(r.status, 'pickup'); assert.equal(r.orderNo, '100000000012345'); assert.equal(r.pickupBy, '2026-10-19'); assert.equal(r.store, 'Target');
  const list = fold([], [{ ...pickupReady, date: at(10, 12) }, { ...pickupDone, date: at(10, 14) }]);
  assert.equal(list.length, 1); assert.equal(list[0].status, 'pickedup'); assert.equal(list[0].kind, 'pickup');
  const h = one(homePickup).f;
  assert.equal(h.kind, 'pickup'); assert.equal(h.status, 'pickup'); assert.equal(h.pickupBy, '2026-10-17');   // Saturday
});
test('a store’s order confirmation that turns out to be a pickup becomes one', () => {
  const list = fold([], [
    { from: 'Target <orders@oe1.target.com>', subject: 'Thanks for shopping with us! Here\'s your order #:100000000012345.', text: 'Thanks for shopping with us!\nOrder #:100000000012345\nTotal $48.21', date: at(10, 12, 9) },
    { ...pickupReady, date: at(10, 12, 15) },
  ]);
  assert.equal(list.length, 1); assert.equal(list[0].kind, 'pickup'); assert.equal(list[0].status, 'pickup'); assert.equal(list[0].total, 48.21);
});

test('an unavailable item is flagged for a check', () => {
  const { f } = one(unavailable);
  assert.equal(f.status, 'ordered'); assert.equal(f.orderNo, '2000000-00000001'); assert.equal(f.guess, true); assert.equal(f.issue, 'An item is unavailable');
  assert.equal(f.orderDate, '2026-10-12'); assert.match(f.items[0].name, /Mini Fridge/); assert.equal(f.store, 'Walmart');
  const list = fold([], [unavailable, { from: 'Walmart <help@walmart.com>', subject: 'Your order was delivered!', text: 'Order number: 2000000-00000001\nYour order was delivered.', date: at(10, 15) }]);
  assert.equal(list[0].status, 'delivered'); assert.equal(list[0].issue, '', 'delivered clears the flag'); assert.equal(list[0].guess, false);
});

test('a big-box store’s three emails (thanks, shipped, delivered) are one order, with the carrier named in a sentence', () => {
  const from = 'Walmart <help@walmart.com>';
  const html = (h, rest = '') => `<html><body><p>${h}</p><p>Order date: Sat, Oct 10, 2026</p><p>Order number: 2000000-00000009</p>${rest}</body></html>`;
  const list = fold([], [
    { html: html('We’re on it!', '<p>Arriving by Sun, Oct 11</p>'), subject: 'Thanks for your delivery order, Tom', from, date: at(10, 10) },
    { html: html('Your package shipped, Tom!', '<p>Arrives Mon, Oct 12 Arrives late</p><p>Sold and shipped by Big Box</p><p>Fedex tracking number 100000000002</p>'), subject: 'Shipped: Vitamin D3 Softgels, 5...', from, date: at(10, 11) },
    { html: html('Delivered', '<p>Please bring any fresh and frozen items inside soon</p>'), subject: 'Delivered: Vitamin D3 Softgels, 5...', from, date: at(10, 12) },
  ]);
  assert.equal(list.length, 1); const o = list[0];
  assert.equal(o.status, 'delivered'); assert.equal(o.carrier, 'FedEx'); assert.equal(o.tracking, '100000000002');
  assert.equal(o.trackUrl, 'https://www.fedex.com/fedextrack/?trknbr=100000000002'); assert.equal(o.items[0].name, 'Vitamin D3 Softgels, 5...');
  assert.deepEqual(o.steps, { ordered: '2026-10-10', shipped: '2026-10-11', delivered: '2026-10-12' });
});
test('restaurants and coffee shops are food, not packages'
, () => {
  const coffee = one({ from: 'Foxtail Coffee <guest@tsg.example>', subject: 'Online Ordering Receipt', text: 'Online Order Confirmation\nHi Tom, Thank you for your order from Foxtail Coffee!\nOrder #4455\nTotal $9.25' }).f;
  assert.equal(coffee.kind, 'food');
  const rest = one({ from: 'oo_at_rmpos.example_tom@duck.com', subject: 'Online Order submitted', text: 'Web Order\nOrdered at: Sep 3 2026 5:24PM\nType: Carryout Restaurant\nOrder Number: 123456\nTotal $31.20' }).f;
  assert.equal(rest.kind, 'food');
});

test('kinds: food, subscriptions and ordinary packages', () => {
  const food = one({ from: 'DoorDash <no-reply@doordash.com>', subject: 'Order Confirmation for Tom from King’s Tandoor', text: 'Order Confirmation\nOrder #AB12CD\nTotal $24.50\nEstimated pickup 6:30 PM' }).f;
  assert.equal(food.kind, 'food');
  const sub = one({ from: 'Apple <no_reply@email.apple.com>', subject: 'Your receipt from Apple.', text: 'Receipt\nOrder ID:\nMB1234567X\nStreaming Plus (Monthly) Renews November 3, 2026 $12.99\nSubtotal\n$12.99\nTax\n$0.91\n$13.90' }).f;
  assert.equal(sub.kind, 'digital'); assert.equal(sub.total, 13.9, 'subtotal plus tax when there is no total line');
  const stripe = one({ from: 'Fitness App <invoice+statements+acct_1ABC@stripe.com>', subject: 'Your receipt from Fitness App #1234-5678', text: 'Receipt #1234-5678\nAmount paid $9.99' }).f;
  assert.equal(stripe.kind, 'digital');
  const hw = one({ from: 'Apple <orders@apple.com>', subject: 'Your order has shipped', text: 'Order Number: W1234567890\nTracking number: 1Z0000000000000003\nShipped via UPS' }).f;
  assert.equal(hw.kind, 'package', 'a shipped Apple order is a package, not a receipt'); assert.equal(hw.carrier, 'UPS');
  const pkg = one({ html: hardwareConfirm, subject: 'We received your order!', from: HARDWARE_FROM }).f;
  assert.equal(pkg.kind, 'package');
});
test('offers, surveys and mail with nothing to go on are skipped', () => {
  for (const m of [
    { from: 'Five Guys <info_at_fiveguys.com_tom@duck.com>', subject: 'How was your order today?', text: 'We appreciate you! Tell us how we did.' },
    { from: 'Store <news@store.example>', subject: 'Big sale: 50% off orders over $50', text: 'Shop now. Free shipping on orders over $50.' },
    { from: 'Ro <ro@notifications.ro.example>', subject: 'Urgent: Your order has been paused', text: 'Re-activate your order in 1 min.' },
    { from: 'Library <lib@library.example>', subject: 'Your receipt from County Public Libraries', text: 'The receipt for your recent visit follows below. Date: 05/17/2026' },
    { from: 'A Friend <a@yahoo.com>', subject: 'dinner?', text: 'are you free on Friday' },
  ]) { const r = P.parseEmail({ date: at(10, 12), ...m }); assert.equal(r.orders.length, 0, m.subject); assert.ok(r.skip); }
});

test('structured data: JSON-LD Order and ParcelDelivery', () => {
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({ '@context': 'http://schema.org', '@graph': [
    { '@type': 'Order', merchant: { '@type': 'Organization', name: 'Maple Outfitters' }, orderNumber: 'MO-5555', orderStatus: 'http://schema.org/OrderInTransit', priceCurrency: 'USD', price: '84.10',
      acceptedOffer: [{ '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Trail Backpack 30L' } }, { '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Water Bottle' } }] },
    { '@type': 'ParcelDelivery', trackingNumber: '9400111111111111111111', trackingUrl: 'https://example.com/t/1', carrier: { '@type': 'Organization', name: 'USPS' },
      expectedArrivalFrom: '2026-10-14T09:00:00-04:00', expectedArrivalUntil: '2026-10-16T18:00:00-04:00', partOfOrder: { '@type': 'Order', orderNumber: 'MO-5555', seller: { name: 'Maple Outfitters' } } },
  ] })}</script></head><body>Your order is on its way</body></html>`;
  const { f } = one({ html, subject: 'Your order is on its way', from: 'orders@maple.example' });
  assert.equal(f.store, 'Maple Outfitters'); assert.equal(f.orderNo, 'MO-5555'); assert.equal(f.status, 'shipped'); assert.equal(f.total, 84.1);
  assert.deepEqual(f.items.map(i => i.name), ['Trail Backpack 30L', 'Water Bottle']);
  assert.equal(f.carrier, 'USPS'); assert.equal(f.tracking, '9400111111111111111111'); assert.equal(f.trackUrl, 'https://example.com/t/1');
  assert.equal(f.eta, '2026-10-14'); assert.equal(f.etaEnd, '2026-10-16');
});

test('a tracking link from an email is kept only if it is a web link', () => {
  const mk = url => `<html><head><script type="application/ld+json">${JSON.stringify({ '@context': 'http://schema.org', '@type': 'ParcelDelivery', trackingNumber: '1Z0000000000000009', trackingUrl: url, carrier: { name: 'UPS' }, partOfOrder: { '@type': 'Order', orderNumber: 'AB-123456', seller: { name: 'Shop' } } })}</script></head><body>Your order has shipped</body></html>`;
  assert.equal(one({ html: mk('https://example.com/t/1'), subject: 'Your order has shipped', from: 'orders@shop.example' }).f.trackUrl, 'https://example.com/t/1');
  assert.equal(one({ html: mk('javascript:alert(1)'), subject: 'Your order has shipped', from: 'orders@shop.example' }).f.trackUrl, 'https://www.ups.com/track?tracknum=1Z0000000000000009');
});

test('a DuckDuckGo relay and a forwarded email still find the store', () => {
  const dd = one({ from: 'info_at_fiveguys.com_tom@duck.com', subject: 'Thanks for your order #FG-100200', text: 'Thanks for ordering! Order #FG-100200 Total $18.40' }).f;
  assert.equal(dd.store, 'Fiveguys'); assert.equal(dd.kind, 'food');
  const fw = one({ from: 'Sam <sam@yahoo.com>', subject: 'Fwd: Your order is ready but expires tomorrow!',
    text: 'Sent from my iPhone\n\nBegin forwarded message:\n\nFrom: DICK\'S Sporting Goods <from@notifications.dcsg.com>\nDate: October 11, 2026\nSubject: Your order is ready but expires tomorrow!\n\nOrder #: 5000123456\nYour order is ready for pickup. Pick up by Tuesday, October 13.' }).f;
  assert.equal(fw.store, 'DICK’S Sporting Goods'); assert.equal(fw.status, 'pickup'); assert.equal(fw.kind, 'pickup'); assert.equal(fw.orderNo, '5000123456');
});

test('Amazon-style subjects name the item and the stage', () => {
  const a = one({ from: 'Amazon <auto-confirm@amazon.com>', subject: 'Ordered: “Stainless Steel Water Bottle, 32 oz...”', text: 'Hello Tom,\nThank you for shopping with us.\nOrder #\n111-2223334-5556667\nArriving Thursday, October 15\nOrder Total: $24.99' }).f;
  assert.equal(a.store, 'Amazon'); assert.equal(a.status, 'ordered'); assert.equal(a.orderNo, '111-2223334-5556667'); assert.equal(a.eta, '2026-10-15'); assert.equal(a.total, 24.99);
  assert.equal(a.items[0].name, 'Stainless Steel Water Bottle, 32 oz...');
  const s = one({ from: 'Amazon <shipment-tracking@amazon.com>', subject: 'Shipped: “Stainless Steel Water Bottle, 32 oz...”', text: 'Your package has shipped.\nOrder # 111-2223334-5556667\nCarrier: Amazon Logistics\nTracking ID: TBA000000000000' }).f;
  assert.equal(s.status, 'shipped'); assert.equal(s.carrier, 'Amazon Logistics'); assert.equal(s.tracking, 'TBA000000000000'); assert.equal(s.id, a.id);
});

test('Whole Foods orders come from Amazon’s address but are Whole Foods’, and a pickup promise is not “ready”', () => {
  const wfText = `Whole Foods Market
https://www.amazon.com/alm/storefront?almBrandId=EXAMPLE
Hi Sam, Thank you for shopping with us. You can add more items until we start packing your order.
To reduce your wait, check in 5 minutes before you arrive
You'll receive a notification when your order is ready for pickup. Check in at least 5 minutes before you arrive.
Order Details: 113-0000001-0000001
Pickup Time: Tuesday, October 13, 2026, 4:00 PM - 5:00 PMPickup Location: Whole Foods Market - Cary 1 Example Place, Cary, NC 27518Payment Authorization: $292.50This may include an additional amount.
Take care, Whole Foods Market
©2026 Amazon.com, Inc. or its affiliates.`;
  const wf = one({ from: 'order-update@amazon.com', subject: 'Your Whole Foods Market order has been received', text: wfText }).f;
  assert.equal(wf.store, 'Whole Foods Market'); assert.equal(wf.orderNo, '113-0000001-0000001');
  assert.equal(wf.status, 'ordered', 'a promise to say when it is ready is not ready'); assert.equal(wf.kind, 'pickup');
  assert.equal(wf.eta, '2026-10-13', 'the booked pickup day'); assert.equal(wf.total, 292.5);
  // later, the store says it is ready: the same order, now ready for pickup
  const list = fold([], [{ from: 'order-update@amazon.com', subject: 'Your Whole Foods Market order has been received', text: wfText, date: at(10, 12, 9) },
    { from: 'order-update@amazon.com', subject: 'Your Whole Foods Market order is ready for pickup', text: 'Whole Foods Market\nYour order is ready for pickup.\nOrder Details: 113-0000001-0000001', date: at(10, 13, 15) }]);
  assert.equal(list.length, 1); assert.equal(list[0].status, 'pickup'); assert.equal(list[0].store, 'Whole Foods Market');
  // an ordinary Amazon order stays Amazon, and its progress bar (Ordered Shipped Out for delivery Delivered) is not a status
  const am = one({ from: 'Amazon.com <auto-confirm@amazon.com>', subject: 'Ordered 1 item: Supplements',
    text: 'Your Orders\nSam, your Supplements are confirmed!\nView or edit order\nOrdered\nShipped\nOut for delivery\nDelivered\nArriving tomorrow 7 AM – 10 AM\nSam - RALEIGH, NC\nOrder #\n113-0000002-0000002\nGrand Total:\n64.23 USD\n' }).f;
  assert.equal(am.store, 'Amazon'); assert.equal(am.status, 'ordered'); assert.equal(am.kind, 'package');
  assert.equal(am.total, 64.23); assert.equal(am.eta, '2026-10-13'); assert.deepEqual(am.items.map(i => i.name), ['Supplements']);
  // a Whole Foods order and an Amazon order are two orders, even from the same address
  const both = fold([], [{ from: 'order-update@amazon.com', subject: 'Your Whole Foods Market order has been received', text: wfText }, { from: 'Amazon.com <auto-confirm@amazon.com>', subject: 'Ordered 1 item: Supplements', text: 'Order #\n113-0000002-0000002\nGrand Total:\n64.23 USD\n' }]);
  assert.deepEqual(both.map(o => o.store).sort(), ['Amazon', 'Whole Foods Market']);
});

test('cancellation, and the order that stays gone once deleted', () => {
  const list = fold([], [{ html: hardwareConfirm, subject: 'We received your order!', from: HARDWARE_FROM, date: at(10, 6) },
    { text: 'Your order WK00000001 has been canceled.', subject: 'Your Home Depot order has been canceled', from: HARDWARE_FROM, date: at(10, 7) }]);
  assert.equal(list.length, 1); assert.equal(list[0].status, 'cancelled');
  const id = list[0].id, graves = { ['orders:' + id]: Date.now() };
  assert.equal(P.upsert([], one({ html: hardwareConfirm, subject: 'We received your order!', from: HARDWARE_FROM }).f, { graves }), 'gone');
  assert.equal(P.upsert([], one({ html: hardwareConfirm, subject: 'We received your order!', from: HARDWARE_FROM }).f, { graves, revive: new Set([id]) }), 'new');
});
test('the same email twice changes nothing; what you edited stays', () => {
  const m = { html: auctionConfirm, subject: 'Your order’s confirmed', from: 'eBay <ebay@ebay.com>', date: at(10, 12), id: 'same' };
  const list = fold([], [m, m]);
  assert.equal(list.length, 1); assert.equal(P.upsert(list, one(m).f), 'same');
  list[0].locks = { total: true, status: true }; list[0].total = 250; list[0].status = 'shipped';
  fold(list, [{ html: auctionOut, subject: 'OUT FOR DELIVERY: x', from: 'eBay <ebay@ebay.com>', date: at(10, 16) }]);
  assert.equal(list[0].total, 250); assert.equal(list[0].status, 'shipped', 'a locked status stays; the carrier still arrives'); assert.equal(list[0].carrier, 'UPS');
});
test('two different orders from one store stay two', () => {
  const a = { html: hardwareConfirm, subject: 'We received your order!', from: HARDWARE_FROM, date: at(10, 6) };
  const b = { html: hardwareConfirm.replace(/WK00000001/g, 'WK00000002'), subject: 'We received your order!', from: HARDWARE_FROM, date: at(10, 8) };
  assert.equal(fold([], [a, b]).length, 2);
});
// ---- returns ----------------------------------------------------------------
const AMZ_RET_FROM = 'Amazon.com <return@amazon.com>';
const amazonReturn = by => `<html><body><p>Hello Sam,</p><p>Your return request is confirmed.</p><p><a href="#">View return request</a></p>
<table><tr><td>Drop off by</td></tr><tr><td>${by}</td></tr><tr><td>Dropoff location</td></tr><tr><td>THE UPS STORE, 1 EXAMPLE PKWY, APEX, NC, 27500</td></tr></table>
<h3>Item(s) in your return request</h3><p><a href="#">Striped Wool Winter Hat Fleece Lined...</a></p><p>Quantity: 1</p><p>Order # 111-0000001-0000001</p><p>Reason for return: Too Large</p>
<p>Cancel return</p><p>Return code</p><h3>Return summary</h3><p>Your refund will be issued within 24 hours after dropoff.</p>
<table><tr><td>Refund subtotal</td><td>$21.50</td></tr><tr><td>Return shipping</td><td>FREE $0.00</td></tr><tr><td>Total estimated refund*</td><td>$21.50</td></tr></table>
<h3>Refund method</h3><p>$21.50 to your Visa ending in 0000</p><p>Keep the item in its original manufacturer packaging. Show QR code to the store associate.</p></body></html>`;
test('a return request: the drop-off day and place, the reason, the refund; a later email moves the day', () => {
  const list = fold([], [{ html: amazonReturn('Thu, Nov 19'), subject: 'Return request confirmed for Striped Wool Winter Hat...', from: AMZ_RET_FROM, date: at(10, 21), id: 'r1', threadId: 't1' }]);
  assert.equal(list.length, 1, 'a return of an order the app never saw becomes an order of its own');
  const o = list[0], r = o.ret;
  assert.equal(o.store, 'Amazon'); assert.equal(o.orderNo, '111-0000001-0000001'); assert.equal(o.status, 'delivered', 'something being returned has arrived');
  assert.equal(r.status, 'started'); assert.equal(r.steps.started, '2026-10-21'); assert.equal(r.by, '2026-11-19');
  assert.equal(r.where, 'THE UPS STORE, 1 EXAMPLE PKWY, APEX, NC, 27500'); assert.equal(r.reason, 'Too Large');
  assert.equal(r.refund, 21.5); assert.equal(r.refundTo, 'your Visa ending in 0000'); assert.deepEqual(r.items, ['Striped Wool Winter Hat Fleece Lined...']);
  assert.equal(o.total, undefined, 'the refund is not what the order cost');
  fold(list, [{ html: amazonReturn('Mon, Jan 18'), subject: 'Return request confirmed for Striped Wool Winter Hat...', from: AMZ_RET_FROM, date: at(10, 21, 13), id: 'r2', threadId: 't1' }]);
  assert.equal(list.length, 1); assert.equal(list[0].ret.by, '2027-01-18', 'the newest email’s day wins, in the next year');
  assert.equal(list[0].ret.items.length, 1);
});
test('a return joins its order, which keeps its own email; status only moves forward', () => {
  const list = fold([], [{ text: 'Ordered: "Striped Wool Winter Hat"\nOrder # 111-0000001-0000001\nOrder Total: $23.10', subject: 'Ordered 1 item: "Striped Wool Winter Hat..."', from: 'Amazon.com <auto-confirm@amazon.com>', date: at(10, 10), id: 'o1', threadId: 'o1' },
    { text: 'Delivered: your package was delivered.\nOrder # 111-0000001-0000001', subject: 'Delivered: "Striped Wool Winter Hat..."', from: 'Amazon.com <shipment-tracking@amazon.com>', date: at(10, 13), id: 'o2', threadId: 'o2' },
    { html: amazonReturn('Thu, Nov 19'), subject: 'Return request confirmed for Striped Wool Winter Hat...', from: AMZ_RET_FROM, date: at(10, 21), id: 'r1', threadId: 't1' }]);
  assert.equal(list.length, 1); const o = list[0];
  assert.equal(o.status, 'delivered'); assert.equal(o.total, 23.1); assert.equal(o.ret.status, 'started'); assert.equal(o.source.msgId, 'o2', 'the order’s email stays its own');
  assert.equal(o.ret.source.msgId, 'r1');
  fold(list, [{ text: 'Hello Sam, We’ve issued your refund.\nTotal refund* $21.50\nOrder # 111-0000001-0000001', subject: 'Your refund confirmation', from: AMZ_RET_FROM, date: at(10, 24) }]);
  assert.equal(o.ret.status, 'refunded'); assert.equal(o.ret.steps.started, '2026-10-21'); assert.equal(o.ret.steps.refunded, '2026-10-24');
  fold(list, [{ html: amazonReturn('Thu, Nov 19'), subject: 'Return request confirmed for Striped Wool Winter Hat...', from: AMZ_RET_FROM, date: at(10, 21), id: 'r1', threadId: 't1' }]);
  assert.equal(o.ret.status, 'refunded', 'an older return email read again doesn’t undo the refund');
});
test('a package the carrier sent back: refunded, the order canceled, its problem cleared', () => {
  const list = fold([], [{ text: 'Shipped 1 item\nOrder # 111-0000002-0000002', subject: 'Shipped: "Magnesium Glycinate Capsules..."', from: 'Amazon.com <shipment-tracking@amazon.com>', date: at(10, 12) }]);
  list[0].issue = 'The store says there’s an update'; list[0].guess = true;
  fold(list, [{ text: 'Hello Sam, You ordered the item below, but the package is being returned to us by the carrier. We’ve issued your refund.\nView return & refund status (https://www.amazon.com/spr/returns)\n\nReturn summary\n\nRefund subtotal $30.00\nTotal refund* $30.00\n\nRefund will appear on your Visa in 3-5 business days.\n\nItem(s) in your return request\n\n[Magnesium Glycinate Capsules,...](https://www.amazon.com/gp/product/B000000000)\nQuantity: 1 Order # 111-0000002-0000002',
    subject: 'Your refund confirmation', from: AMZ_RET_FROM, date: at(10, 13) }]);
  const o = list[0];
  assert.equal(list.length, 1); assert.equal(o.status, 'cancelled'); assert.equal(o.ret.status, 'refunded'); assert.equal(o.ret.undelivered, true);
  assert.equal(o.ret.refund, 30); assert.equal(o.ret.refundTo, 'your Visa'); assert.equal(o.issue, ''); assert.deepEqual(o.ret.items, ['Magnesium Glycinate Capsules,...']);
});
test('a store that received the return and refunded it in one email; items under their size and colour', () => {
  const { f } = one({ text: 'Hello Sam,\nWe Received Your Return.\n\nYour refund has been processed. Please allow up to 5 business days.\n\nReturn Date:\n 2026-01-24\n\nOrder Number:\n\nJW00000001\n\nReturned Items\n\nPolished Silver Bangle\n\n $120.00\n\n Item Number: 500000C00-1\n Size: 1700\n\n Color: No color\n\n Quantity: 1\n\nTwisted Gold Bangle\n\n $120.00\n\n Item Number: 500001C00-1\n Size: 1600\n\n Color: No color\n\n Quantity: 1\n\nOrder Subtotal$300.00\nShipping$0.00\n\n Total\n\n $240.00\n',
    subject: 'We received your return order #JW00000001', from: 'Jewel Shop <orders@shop.jewel.example>', date: at(1, 24) });
  assert.equal(f.ret.status, 'refunded'); assert.equal(f.ret.steps.received, '2026-01-24'); assert.equal(f.orderNo, 'JW00000001');
  assert.deepEqual(f.ret.items, ['Polished Silver Bangle', 'Twisted Gold Bangle']); assert.equal(f.ret.refund, 240);
});
test('a return number and a return label’s tracking, with no order number', () => {
  const list = fold([], [{ text: 'Hi Sam,\n\nYour return request (RMA #RTEST001) has been approved. Please follow the instructions below.\n\n1. Place your return in a parcel.\n2. Take your parcel to a Royal Mail location near you.\n\nTracking number: YR000000001GB\n\nDownload Return Label',
    subject: 'RMA #RTEST001 Your return request has been received', from: 'Beauty Shop <order.update@beautyshop.example>', date: at(4, 17), threadId: 'rma' }]);
  assert.equal(list.length, 1); const r = list[0].ret;
  assert.equal(r.status, 'started', '"return request … received" is the start, not the store having it');
  assert.equal(r.rma, 'RTEST001'); assert.equal(r.tracking, 'YR000000001GB'); assert.equal(r.carrier, 'Royal Mail');
});
test('not a return: tax and rental returns, and the "start a return" in every order email’s footer', () => {
  assert.equal(one({ text: 'Great news! Your 2025 state return was accepted.', subject: 'TurboTax Update: State Return Accepted', from: 'TurboTax <TurboTax@intuit.example>' }).f, undefined);
  assert.equal(one({ text: 'Please confirm the details for your upcoming rental return. Rental Agreement: 900000001', subject: 'Time to confirm or modify your rental return', from: 'Cars <no-reply@cars.example>' }).f, undefined);
  const { f } = one({ html: hardwareConfirm.replace('</table>', '</table><p>Need to start a return? Print a return label from your account.</p>'), subject: 'We received your order!', from: HARDWARE_FROM });
  assert.equal(f.ret, undefined); assert.equal(f.status, 'ordered');
  assert.equal(P.returnOf('Your refund has been processed', ''), 'refunded'); assert.equal(P.returnOf('Your return is on its way', ''), 'sent');
});
test('helpers', () => {
  assert.equal(P.trackUrl('UPS', '1Z0000000000000001'), 'https://www.ups.com/track?tracknum=1Z0000000000000001');
  assert.equal(P.trackUrl('', 'x'), ''); assert.equal(P.trackUrl('Veho', 'x'), '');
  assert.equal(P.findTotal('Subtotal $10.00\nShipping $2.00\nTotal: $12.00').total, 12);
  assert.equal(P.findTotal('Order Total CA$1,234.50').cur, 'CAD');
  assert.equal(P.senderInfo('"Store" <A@B.com>').domain, 'b.com');
  assert.equal(P.senderInfo('info_at_shop.example_tom@duck.com').domain, 'shop.example');
  assert.equal(P.dateIn('Saturday', at(10, 12)), '2026-10-17'); assert.equal(P.dateIn('tomorrow', at(10, 12)), '2026-10-13');
});

console.log('\n' + n + ' tests passed');
