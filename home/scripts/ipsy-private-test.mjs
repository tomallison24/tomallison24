// Private: what the person keeps from Ipsy. Loads the real home/ipsy.js and the Ipsy tools of
// Orders, Travel and Calendar (orders/ipsy-tools.js, travel/ipsy-tools.js, calendar/ipsy-tools.js
// with calendar/ical.js) in headless Chromium, each with a stand-in for its app holding one private
// item beside ordinary ones, and a stubbed Gmail. Checks that nothing about a private item comes
// back from any tool or the context line (what would go to Claude): not in a search, not by its id,
// not as a change; that a private item can't be changed; that a trip with a private booking is
// shown, named and dated by its other bookings and can't be renamed; that free time counts a
// private event as busy, as "Private" and nothing more; that the emails behind private items (the
// email itself, its thread, and an email naming its order, tracking or confirmation number) are
// left out of Gmail searches and can't be read; that Gmail can be turned off for Ipsy in each app;
// and privacy.guard's matching (numbers however they're written, letter codes only as words).
// Every name, number and address is invented.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node home/scripts/ipsy-private-test.mjs [repo root]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const PAGE = '<!doctype html><meta charset="utf-8"><title>Private</title>'
  + '<script src="/home/ipsy.js"></script><script src="/calendar/ical.js"></script>'
  + '<script src="/orders/ipsy-tools.js"></script><script src="/travel/ipsy-tools.js"></script><script src="/calendar/ipsy-tools.js"></script>';
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/private.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
const problems = [];
page.on('pageerror', e => problems.push(String(e)));
await page.goto(BASE + '/private.html');

let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n  ', e.message.split('\n').slice(0, 8).join('\n   ')); } };

// What each app's private item is called: none of it may come back from a tool.
const SECRET = /Secret Spa|SEC-55501|1ZPRIV0000099|Hidden Lodge|QXPRVT|Surgery consult|Gate code 4321/;

await step('privacy.guard: an email is hidden by its id, its thread, or a number of a private item however it is written', async () => {
  const r = await page.evaluate(() => {
    const g = AllisonOS.ipsy.privacy.guard([{ msgId: 'm1', threadId: 't1', words: ['112-1234567', 'QXPRVT', 'ab', ''] }]);
    return {
      id: g.hides({ id: 'm1' }), thread: g.hides({ id: 'm9', threadId: 't1' }),
      spaced: g.hides({ id: 'm2', subject: 'Order 112 1234567 shipped' }), joined: g.hides({ id: 'm3', snippet: 'order 1121234567' }),
      code: g.hides({ id: 'm4', subject: 'Booking QXPRVT confirmed' }), codeInWord: g.hides({ id: 'm5', subject: 'qxprvtion is not a word' }),
      text: g.hides({ id: 'm6', subject: 'Hello' }, 'Your confirmation is qxprvt.'), short: g.hides({ id: 'm7', subject: 'ab cd' }),
      other: g.hides({ id: 'm8', threadId: 't8', subject: 'Order 999-0000000' }),
      headers: g.hides({ id: 'm10', payload: { headers: [{ name: 'Subject', value: 'Re: 112-1234567' }] } }),
    };
  });
  assert.deepEqual(r, { id: true, thread: true, spaced: true, joined: true, code: true, codeInWord: false, text: true, short: false, other: false, headers: true });
});

await step('privacy.gmail: on unless turned off, per app, on this phone', async () => {
  const r = await page.evaluate(() => { const P = AllisonOS.ipsy.privacy; const a = P.gmail('orders'); P.gmail('orders', false); const b = [P.gmail('orders'), P.gmail('travel')]; P.gmail('orders', true); return [a, ...b, P.gmail('orders')]; });
  assert.deepEqual(r, [true, false, true, true]);
});

// ---- Orders ----
await page.evaluate(() => {
  const msgs = {
    pmail: { id: 'pmail', threadId: 'pthread', subject: 'Your Secret Spa order', from: 'Secret Spa <a@spa.example>', text: 'Order SEC-55501 is on its way.' },
    pship: { id: 'pship', threadId: 'other', subject: 'Shipped: 1ZPRIV0000099', from: 'UPS <u@ups.example>', text: 'Tracking 1ZPRIV0000099' },
    preply: { id: 'preply', threadId: 'pthread', subject: 'Re: your order', from: 'Help <h@help.example>', text: 'Thanks for writing.' },
    vmail: { id: 'vmail', threadId: 'vthread', subject: 'Your Lamp Co order', from: 'Lamp Co <l@lamp.example>', text: 'Order LC-0001 shipped.' },
  };
  const asMsg = m => ({ id: m.id, threadId: m.threadId, internalDate: String(Date.now()), snippet: m.text, payload: { headers: [{ name: 'Subject', value: m.subject }, { name: 'From', value: m.from }], _text: m.text } });
  const orders = [
    { id: 'o-lamp', store: 'Lamp Co', items: [{ name: 'Desk lamp' }], status: 'shipped', kind: 'package', orderNo: 'LC-0001', source: { msgId: 'vmail', threadId: 'vthread' }, steps: {} },
    { id: 'o-spa', private: true, store: 'Secret Spa', items: [{ name: 'Gift card' }], status: 'ordered', kind: 'package', orderNo: 'SEC-55501', tracking: '1ZPRIV0000099', source: { msgId: 'pmail', threadId: 'pthread' }, steps: {} },
  ];
  window.__orders = { orders, saved: 0 };
  window.__ordersIpsy = window.OrdersIpsy({
    get orders() { return window.__orders.orders; }, set orders(v) { window.__orders.orders = v; },
    save: () => { window.__orders.saved++; }, render() {}, refreshOrder() {}, closeOrder() {}, openOrder() {},
    P: { lastDay: () => '', keyOf: s => String(s || '').toLowerCase(), trackUrl: () => '', htmlToText: s => s, rank: () => 0, hash: s => String(s).length },
    todayStr: () => '2026-10-20', isOpen: o => o.status !== 'delivered', needsCheck: () => false, checkReason: () => '', kindOn: () => true,
    getToken: () => 'token', AuthError: class extends Error {}, current: () => null, screen: () => 'the order list',
    header: (m, n) => { const h = (m.payload.headers || []).find(x => x.name.toLowerCase() === n); return h ? h.value : ''; },
    bodies: p => ({ html: '', text: p._text || '' }),
    gmail: async (p, params) => {
      if (p === '/messages') return { messages: Object.values(msgs).map(m => ({ id: m.id, threadId: m.threadId })), resultSizeEstimate: 4 };
      const m = msgs[p.split('/').pop()]; if (!m) throw new Error('404'); return asMsg(m);
    },
  });
});
const run = (app, name, input) => page.evaluate(async ([app, name, input]) => {
  const t = window[app];
  try { const r = await t.tools[name](input || {}, { confirm: async () => true }); return { ok: true, content: r.content, change: r.change ? r.change.text : '' }; }
  catch (e) { return { ok: false, error: String(e.message || e) }; }
}, [app, name, input]);
const ctxOf = app => page.evaluate(a => window[a].context(), app);

await step('Orders: a private order is left out of finding, reading, the context and Gmail, and can’t be changed', async () => {
  const all = [];
  const f = await run('__ordersIpsy', 'find_orders', {}); all.push(f);
  assert.equal(f.content.found, 1); assert.equal(f.content.privateOrdersNotShown, 1);
  const q = await run('__ordersIpsy', 'find_orders', { query: 'secret spa' }); all.push(q);
  assert.equal(q.content.found, 0);
  const g = await run('__ordersIpsy', 'get_orders', { ids: ['o-spa', 'o-lamp'] }); all.push(g);
  assert.match(g.content.orders[0].missing, /private orders can’t be read/); assert.equal(g.content.orders[1].store, 'Lamp Co');
  for (const [name, input] of [['update_order', { id: 'o-spa', changes: { notes: 'x' } }], ['delete_orders', { ids: ['o-spa'] }], ['show_order', { id: 'o-spa' }],
    ['merge_orders', { keep_id: 'o-lamp', merge_ids: ['o-spa'] }]]) { const r = await run('__ordersIpsy', name, input); all.push(r); assert.equal(r.ok, false, name + ' on a private order'); }
  assert.equal(await page.evaluate(() => window.__orders.orders.length), 2, 'nothing deleted or merged');
  const s = await run('__ordersIpsy', 'search_gmail', { query: 'order' }); all.push(s);
  assert.deepEqual(s.content.emails.map(e => e.message_id), ['vmail'], 'its email, its thread and an email naming its tracking number are left out');
  assert.equal(s.content.privateEmailsNotShown, 3);
  for (const id of ['pmail', 'pship', 'preply']) { const r = await run('__ordersIpsy', 'read_email', { message_id: id }); all.push(r); assert.equal(r.ok, false); assert.match(r.error, /marked Private/); }
  const ok = await run('__ordersIpsy', 'read_email', { message_id: 'vmail' }); assert.equal(ok.ok, true);
  const c = await ctxOf('__ordersIpsy'); all.push(c);
  assert.match(c, /^Orders has 1 orders \(plus 1 private one you can’t see\)/);
  assert.ok(!SECRET.test(JSON.stringify(all)), 'nothing private came back: ' + JSON.stringify(all).match(SECRET));
});

await step('Orders: Gmail turned off for Ipsy: no search or read, and the context says so', async () => {
  await page.evaluate(() => AllisonOS.ipsy.privacy.gmail('orders', false));
  const s = await run('__ordersIpsy', 'search_gmail', { query: 'order' }), r = await run('__ordersIpsy', 'read_email', { message_id: 'vmail' });
  assert.equal(s.ok, false); assert.match(s.error, /turned off Gmail for Ipsy in Orders/); assert.equal(r.ok, false);
  assert.match(await ctxOf('__ordersIpsy'), /Gmail is turned off for Ipsy here/);
  await page.evaluate(() => AllisonOS.ipsy.privacy.gmail('orders', true));
});

await step('Orders: Undo of a change still works after the order is made private', async () => {
  const u = await page.evaluate(async () => {
    const r = await window.__ordersIpsy.tools.update_order({ id: 'o-lamp', changes: { notes: 'Leave at the door' } });
    const o = window.__orders.orders.find(x => x.id === 'o-lamp'); o.private = true;
    r.change.undo();
    const after = window.__orders.orders.filter(x => x.id === 'o-lamp');
    delete after[0].private;
    return { n: after.length, notes: after[0].notes || '' };
  });
  assert.deepEqual(u, { n: 1, notes: '' }, 'put back, not added again');
});

// ---- Travel ----
await page.evaluate(() => {
  const bookings = [
    { id: 'f-1', type: 'flight', airlineCode: 'UA', flightNo: '100', from: 'RDU', to: 'BOS', dep: '2026-11-03T08:00', arr: '2026-11-03T10:00', conf: 'ABC123', status: 'confirmed', source: { msgId: 'tv', threadId: 'tvt' } },
    { id: 'h-1', type: 'hotel', private: true, name: 'Hidden Lodge', city: 'Boston', checkIn: '2026-11-03', checkOut: '2026-11-05', conf: 'QXPRVT', status: 'confirmed', source: { msgId: 'tp', threadId: 'tpt' } },
    { id: 'h-2', type: 'hotel', private: true, name: 'Hidden Lodge', city: 'Boston', checkIn: '2026-12-10', checkOut: '2026-12-12', conf: 'QXPRVT', status: 'confirmed', source: { msgId: 'tp2', threadId: 'tpt2' } },
  ];
  const startOf = b => b.dep || b.checkIn || '', endOf = b => b.arr || b.checkOut || '';
  const titleOf = b => b.type === 'flight' ? b.airlineCode + b.flightNo + ' ' + b.from + ' → ' + b.to : b.name;
  const autoName = g => { const h = g.items.find(b => b.type === 'hotel'); return h ? h.city : g.items[0].to; };
  const trips = [];
  const groupTrips = () => [['f-1', 'h-1'], ['h-2']].map(ids => {
    const items = ids.map(id => bookings.find(b => b.id === id)).filter(Boolean);
    if (!items.length) return null;
    const named = trips.find(t => t.id === items[0].id);
    return { id: items[0].id, items, live: items, name: named ? named.name : (items.some(b => b.private) ? 'Hidden Lodge weekend' : autoName({ items })), auto: autoName({ items }),
      start: items.map(startOf).sort()[0], end: items.map(endOf).sort().pop(), startT: Date.parse(items.map(startOf).sort()[0]), past: false };
  }).filter(Boolean);
  const msgs = {
    tp: { id: 'tp', threadId: 'tpt', subject: 'Hidden Lodge: your stay', text: 'Confirmation QXPRVT' },
    tq: { id: 'tq', threadId: 'zz', subject: 'Reminder for booking QXPRVT', text: 'See you soon' },
    tv: { id: 'tv', threadId: 'tvt', subject: 'United confirmation ABC123', text: 'UA100 RDU to BOS' },
  };
  const asMsg = m => ({ id: m.id, threadId: m.threadId, internalDate: String(Date.now()), snippet: m.text, payload: { headers: [{ name: 'Subject', value: m.subject }, { name: 'From', value: 'x@example.com' }], _text: m.text } });
  window.__travel = { bookings };
  window.__travelIpsy = window.TravelIpsy({
    get bookings() { return window.__travel.bookings; }, groupTrips, checkList: () => bookings.slice(), tripById: id => groupTrips().find(g => g.id === id || g.items.some(b => b.id === id)),
    autoName, startOf, endOf, isPast: () => false, titleOf, fillText: () => '', liveView: () => null, liveWindow: () => false,
    checkField: () => true, checkEdit: o => o.op === 'rename' ? o : null, applyEdits: ops => { ops.forEach(o => { if (o.op === 'rename') trips.push({ id: o.id, name: o.name }); }); return { undo() {}, added: [] }; },
    editText: o => 'Renamed', EDIT_FIELDS: { flight: {}, hotel: {} }, EDIT_NEEDED: { flight: [], hotel: [] }, EDIT_LABEL: {}, render() {}, openTrip() {}, openBooking() {},
    flightData: async () => ({}), keepLive() {}, boardData: async () => ({}), allowance: { flight: () => 1, countFlight() {}, board: () => 1, countBoard() {} },
    getToken: () => 'token', AuthError: class extends Error {}, P: { htmlToText: s => s },
    header: (m, n) => { const h = (m.payload.headers || []).find(x => x.name.toLowerCase() === n); return h ? h.value : ''; },
    bodies: p => ({ html: '', text: p._text || '' }),
    gmail: async p => { if (p === '/messages') return { messages: Object.values(msgs).map(m => ({ id: m.id, threadId: m.threadId })), resultSizeEstimate: 3 }; return asMsg(msgs[p.split('/').pop()]); },
    screen: () => 'the trips',
  });
});

await step('Travel: private bookings are left out; a trip with one is shown with the others, named and dated by them, and can’t be renamed', async () => {
  const all = [];
  const f = await run('__travelIpsy', 'find_trips', { when: 'all' }); all.push(f);
  assert.equal(f.content.found, 1, 'the trip of private bookings only is left out');
  const t = f.content.trips[0];
  assert.equal(t.name, 'BOS', 'named by its other bookings'); assert.equal(t.to, '2026-11-03', 'dated by them');
  assert.deepEqual(t.bookings.map(b => b.id), ['f-1']); assert.equal(f.content.privateBookingsNotShown, 2);
  const chk = await run('__travelIpsy', 'find_trips', { when: 'check' }); all.push(chk);
  assert.deepEqual(chk.content.bookings.map(b => b.id), ['f-1']);
  const g = await run('__travelIpsy', 'get_bookings', { ids: ['h-1'] }); all.push(g);
  assert.match(g.content.bookings[0].missing, /private bookings can’t be read/);
  const rn = await run('__travelIpsy', 'rename_trip', { trip_id: t.id, name: 'Work trip' }); all.push(rn);
  assert.equal(rn.ok, false); assert.match(rn.error, /marked Private/);
  for (const [name, input] of [['update_booking', { id: 'h-1', changes: { notes: 'x' } }], ['delete_bookings', { ids: ['h-1'] }], ['delete_trip', { trip_id: 'h-2' }], ['move_booking', { id: 'f-1', with: 'h-2' }]]) {
    const r = await run('__travelIpsy', name, input); all.push(r); assert.equal(r.ok, false, name + ' with a private booking');
  }
  const s = await run('__travelIpsy', 'search_gmail', { query: 'booking' }); all.push(s);
  assert.deepEqual(s.content.emails.map(e => e.message_id), ['tv']); assert.equal(s.content.privateEmailsNotShown, 2);
  const r = await run('__travelIpsy', 'read_email', { message_id: 'tq' }); all.push(r); assert.equal(r.ok, false);
  const c = await ctxOf('__travelIpsy'); all.push(c);
  assert.match(c, /^Travel has 1 booking in 1 trip \(plus 2 private ones you can’t see\)/);
  assert.ok(!SECRET.test(JSON.stringify(all)), 'nothing private came back: ' + JSON.stringify(all).match(SECRET));
});

await step('Travel: Gmail turned off for Ipsy', async () => {
  await page.evaluate(() => AllisonOS.ipsy.privacy.gmail('travel', false));
  const s = await run('__travelIpsy', 'search_gmail', { query: 'x' });
  assert.equal(s.ok, false); assert.match(s.error, /turned off Gmail for Ipsy in Travel/);
  await page.evaluate(() => AllisonOS.ipsy.privacy.gmail('travel', true));
});

// ---- Calendar ----
await page.evaluate(() => {
  const I = window.AllisonICal, TZ = 'UTC', D = 864e5, MIN = 6e4;
  const ymd = ms => new Date(ms).toISOString().slice(0, 10), dayMs = s => Date.parse(s + 'T00:00:00Z'), addDays = (s, n) => ymd(dayMs(s) + n * D);
  const today = () => ymd(Date.now());
  const at = (d, h) => dayMs(d) + h * 3600e3;
  const d1 = addDays(today(), 1);
  const ev = (name, title, h1, h2, extra) => ({ kind: 'family', id: name, name, title, start: at(d1, h1), end: at(d1, h2), allDay: false, startDate: d1, endDate: d1, o: Object.assign({ location: '', recurring: false, alarms: [], attendees: [], transp: 'OPAQUE' }, extra || {}) });
  const occ = [
    ev('a.ics', 'Dentist', 9, 10),
    ev('b.ics', 'Surgery consult', 13, 14, { private: true, location: 'Clinic' }),
    ev('c.ics', 'Lunch with Kim', 12, 13),
    { kind: 'note', id: 'nudge|n1', title: 'Gate code 4321', start: at(d1, 16), end: at(d1, 16.5), allDay: false, startDate: d1, endDate: d1, private: true, sub: 'Nudge' },
    { kind: 'travel', id: 'trv|h-1', title: 'Hidden Lodge', allDay: true, startDate: d1, endDate: addDays(d1, 1), start: dayMs(d1), end: dayMs(addDays(d1, 1)), private: true },
  ];
  localStorage.setItem('calendar.private', JSON.stringify(['c.ics']));   // kept on this phone: private even without the mark in the event
  const items = new Map(occ.filter(x => x.kind === 'family').map(x => [x.name, { etag: '"1"', ics: '', cal: I.parse('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:' + x.name + '\r\nSUMMARY:' + x.title + '\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n') }]));
  const st = { occ, items, win: { from: dayMs(today()) - 7 * D, to: dayMs(today()) + 60 * D }, api: 'ok', offline: false };
  const isPrivate = x => !!(x && (x.kind === 'family' ? (x.o && x.o.private) || JSON.parse(localStorage.getItem('calendar.private') || '[]').includes(x.name) : x.private));
  const LAYER = { note: { name: 'Notes' }, travel: { name: 'Travel' }, holiday: { name: 'US Holidays' }, mail: { name: 'Mail' }, fitness: { name: 'Fitness' } };
  const travelLayer = { bookings: [{ id: 'h-1', private: true, conf: 'QXPRVT', msgId: 'cm1', threadId: 'ct1' }] };
  window.__cal = { st };
  window.__calIpsy = window.CalendarIpsy({
    I, TZ, st, settings: { layers: { note: true, travel: true }, duration: 60 }, LAYER, isPrivate,
    layerData: (key, app) => app === 'travel' ? travelLayer : null,
    eventsOn: d => occ.filter(x => x.allDay ? x.startDate <= d && x.endDate > d : ymd(x.start) === d),
    matches: (x, words) => words.every(w => (x.title + ' ' + (x.o && x.o.location || '')).toLowerCase().includes(w)),
    refresh: async () => {}, rebuild() {}, render() {}, goTo() {}, writeEvent: async () => { throw new Error('no writes in this test'); }, writeItem: async () => {}, deleteFile: async () => {}, written() {},
    formFrom: x => ({ title: x ? x.title : '', location: '', allDay: false, start: x ? x.start : 0, end: x ? x.end : 0, notes: '', rule: '', ruleEnd: { type: 'never' } }),
    ymd, dayMs, addDays, today, fmtTime: ms => new Date(ms).toISOString().slice(11, 16), longDate: s => s, medDate: s => s, wxFor: () => null,
    busyPill() {}, toast() {}, errText: () => 'error', calendarName: () => 'Family', screen: () => 'the week view',
  });
  window.__d1 = d1;
});

await step('Calendar: private events and private layer items are left out; free time counts a private event as busy, as "Private"', async () => {
  const all = [];
  const d1 = await page.evaluate(() => window.__d1);
  const f = await run('__calIpsy', 'find_events', { from: d1, to: d1 }); all.push(f);
  assert.deepEqual(f.content.events.map(e => e.title), ['Dentist'], 'the event marked private, the one kept private on this phone, a private nudge and a private booking are left out');
  assert.equal(f.content.privateEventsNotShown, 4);
  const q = await run('__calIpsy', 'find_events', { query: 'surgery' }); all.push(q); assert.equal(q.content.found, 0);
  const g = await run('__calIpsy', 'get_event', { id: 'b.ics' }); all.push(g); assert.equal(g.ok, false);
  const ft = await run('__calIpsy', 'free_time', { from: d1, to: d1, earliest: '08:00', latest: '18:00' }); all.push(ft);
  const day = ft.content.days[0];
  assert.deepEqual(day.busy.slice().sort(), ['09:00-10:00 Dentist', '12:00-13:00 Private', '13:00-14:00 Private'], 'their time is taken, nothing more');
  assert.ok(!day.all_day, 'a private all-day booking isn’t listed');
  assert.ok(!day.free.some(s => s.from === '12:00' || s.from === '13:00'), 'no free time over a private event');
  for (const [name, input] of [['update_event', { id: 'b.ics', title: 'x' }], ['delete_event', { id: 'c.ics' }]]) {
    const r = await run('__calIpsy', name, input); all.push(r); assert.ok(r.ok === false || (r.content && /no Family event/i.test(JSON.stringify(r.content))), name + ' on a private event: ' + JSON.stringify(r));
  }
  all.push(await ctxOf('__calIpsy'));
  assert.ok(!SECRET.test(JSON.stringify(all)), 'nothing private came back: ' + JSON.stringify(all).match(SECRET));
});

await step('Calendar: Gmail turned off for Ipsy; the emails of private Travel bookings are left out', async () => {
  await page.evaluate(() => AllisonOS.ipsy.privacy.gmail('calendar', false));
  const s = await run('__calIpsy', 'search_gmail', { query: 'x' });
  assert.equal(s.ok, false); assert.match(s.error, /turned off Gmail for Ipsy in Calendar/);
  assert.match(await ctxOf('__calIpsy'), /Gmail is turned off for Ipsy here/);
  await page.evaluate(() => AllisonOS.ipsy.privacy.gmail('calendar', true));
  // Calendar's Gmail module, stubbed: a session and consent given, three emails
  await page.evaluate(() => {
    sessionStorage.setItem('calendar.gmail.session', JSON.stringify({ token: 't', expires: Date.now() + 3600e3 })); sessionStorage.setItem('calendar.gmail.consent', 'yes');
    const msgs = { cm1: ['ct1', 'Your stay', 'See you soon'], cm2: ['zz', 'Booking QXPRVT updated', 'New time'], cm3: ['yy', 'Dentist reminder', 'Tomorrow 9am'] };
    const real = window.fetch;
    window.fetch = async (u, o) => {
      u = String(u); if (!u.startsWith('https://gmail.googleapis.com/')) return real(u, o);
      const p = new URL(u).pathname.split('/').pop();
      const body = p === 'messages' ? { messages: Object.entries(msgs).map(([id, [t]]) => ({ id, threadId: t })) }
        : { id: p, threadId: msgs[p][0], snippet: msgs[p][2], payload: { headers: [{ name: 'Subject', value: msgs[p][1] }, { name: 'From', value: 'x@example.com' }], mimeType: 'text/plain', body: { data: btoa(msgs[p][2]) } } };
      return new Response(JSON.stringify(body), { status: 200 });
    };
  });
  const r = await run('__calIpsy', 'search_gmail', { query: 'stay' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.content.emails.map(e => e.message_id), ['cm3']); assert.equal(r.content.privateEmailsNotShown, 2);
  const read = await run('__calIpsy', 'read_email', { message_id: 'cm2' });
  assert.equal(read.ok, false); assert.match(read.error, /marked Private/);
});

await step('no script errors', async () => { assert.deepEqual(problems, []); });

await browser.close();
server.close();
if (failed) { console.log(failed + ' failed'); process.exit(1); }
console.log('all passed');
