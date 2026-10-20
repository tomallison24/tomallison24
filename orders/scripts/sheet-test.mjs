// Runs orders/google-sheet-sync.gs in Node against an in-memory Sheet (the Drinks test's fake-sheet.mjs):
// who gets in (only aOS, with the phrase and who's asking), a first sync, the readable Orders tab with
// Who, newest change winning, one Sheet for the family (each person gets only their own orders, can't
// change or delete anyone else's, and hears which ids are someone else's), orders from before aOS
// becoming the owner's, the 90 days a phone keeps (and every order not finished yet, whatever its age),
// looking back with 'range', Private kept, and the Log tab, which only ever grows: rows from the phone
// in time order with whose phone sent them, one row per event id however often it is sent, every order
// kind, deleted orders, text kept as text, nothing lost when the other tabs are rebuilt, and an old Log
// getting its Who column without a row being rewritten.
//   node orders/scripts/sheet-test.mjs
import assert from 'assert/strict';
import path from 'path';
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';

const GS = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'google-sheet-sync.gs');
const SECRET = 'test-secret-phrase';
// what aOS adds to every request (functions/sheet/api): the phrase, and who's asking
const TOM = { key: SECRET, who: 'tom', name: 'Tom', owner: '1' }, ELLA = { key: SECRET, who: 'ella', name: 'Ella' };
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const T = Date.now();
const order = (id, extra) => Object.assign({ id, store: 'Home Depot', kind: 'package', status: 'shipped', items: [{ name: 'Plank flooring', qty: 12 }, { name: 'Underlayment' }], total: 987.21, carrier: 'UPS', tracking: '1Z0000000000000001', eta: '2026-10-05', orderNo: 'WK00000001', orderDate: '2026-10-01', steps: { ordered: '2026-10-01', shipped: '2026-10-02' }, updated: T - 1000 }, extra);
const ev = (id, e, o, extra) => Object.assign({ id, at: T, ev: e, note: '', o }, extra);
const sync = (s, body, who = TOM) => s.post(Object.assign({ action: 'sync', orders: [], graves: {} }, body), who);
const LOGHEAD = ['Who', 'Logged', 'Event', 'Store', 'Kind', 'Items', 'Total', 'Status', 'Carrier', 'Tracking', 'Expected', 'Order number', 'What changed', 'Order ID', 'EventID'];
const mk = () => fakeSheet(GS, SECRET, TOM);

test('answers a GET with its name; only aOS, with the phrase and who\'s asking, gets in', () => {
  const s = mk();
  assert.deepEqual(s.get(), { ok: true, app: 'allison-orders-sync', v: 3, aos: true, log: 1 });
  assert.equal(s.post({ action: 'sync' }, { key: 'nope', who: 'tom' }).error, 'wrong-secret');
  const old = s.post({ secret: SECRET, action: 'sync' }, {});
  assert.equal(old.error, 'wrong-secret', 'a phone with the phrase in its request, as before aOS, gets nothing');
  assert.equal(old.aos, true, 'and aOS can tell this script from one that hasn\'t been updated');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET }).error, 'who');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET, who: 'a b' }).error, 'who');
  assert.equal(s.post('not json').error, 'bad-request');
  assert.equal(fakeSheet(GS, 'CHANGE-ME').post({ action: 'sync' }, { key: 'CHANGE-ME', who: 'tom' }).error, 'secret-not-set');
  assert.deepEqual(s.post({ action: 'ping' }), { ok: true, app: 'allison-orders-sync', v: 3, aos: true });
  assert.equal(s.tab('_orders'), null, 'a ping writes nothing');
  // curly quotes and stray spaces in the phrase don't count against you
  assert.equal(fakeSheet(GS, "tom's-code").post({ action: 'sync', orders: [] }, { key: ' tom’s-code ', who: 'tom' }).ok, true);
});

test('orders merge as before: the newest change wins, a deletion reaches your other phone, the Orders tab is readable, with Who', () => {
  const s = mk();
  assert.equal(sync(s, { orders: [order('a'), order('b', { store: 'Target', kind: 'pickup', status: 'pickup', items: [{ name: 'Lamp' }] })] }).orders.length, 2);
  const r = sync(s, { orders: [order('a', { status: 'delivered', updated: T })] });
  assert.equal(r.orders.find(o => o.id === 'a').status, 'delivered');
  assert.equal(r.by, 'tom');
  assert.equal(sync(s, { orders: [order('a', { status: 'shipped', updated: T - 5000 })] }).orders.find(o => o.id === 'a').status, 'delivered');
  assert.equal(sync(s, { graves: { 'orders:b': T + 10 } }).orders.length, 1);
  const tab = s.tab('Orders');
  assert.deepEqual(tab[0], ['Who', 'Ordered', 'Store', 'Items', 'Total', 'Status', 'Carrier', 'Tracking', 'Expected', 'Order number', 'Kind', 'Notes']);
  assert.deepEqual(tab[1].slice(0, 6), ['Tom', '2026-10-01', 'Home Depot', '12 x Plank flooring; Underlayment', 987.21, 'Delivered']);
  assert.ok(s.sheets.get('_orders').hidden && s.sheets.get('_deleted').hidden && s.sheets.get('_people').hidden);
});

test('one Sheet for the family: each person gets only their own orders, and can\'t change or delete anyone else\'s', () => {
  const s = mk();
  sync(s, { orders: [order('t1'), order('shared', { store: 'Target', orderNo: 'T-1' })] }, TOM);
  const e = sync(s, { orders: [order('e1', { store: 'Etsy', orderNo: 'E-1' })] }, ELLA);
  assert.deepEqual(e.orders.map(x => x.id), ['e1'], 'Ella gets only hers');
  assert.deepEqual(sync(s, {}, TOM).orders.map(x => x.id).sort(), ['shared', 't1'], 'and Tom only his');
  // Ella's phone sends an order with Tom's id (the same email in her Gmail, say), a change to it and a deletion of his
  const e2 = sync(s, { orders: [order('shared', { store: 'Target', status: 'delivered', updated: T + 9999 }), order('t1', { notes: 'hers?', updated: T + 9999 })], graves: { 'orders:t1': T + 9999 } }, ELLA);
  assert.deepEqual(e2.refused.sort(), ['shared', 't1'], 'she hears which ids are someone else\'s');
  assert.deepEqual(e2.orders.map(x => x.id), ['e1'], 'and gets none of his');
  assert.deepEqual(Object.keys(e2.graves), [], 'nor his deletions');
  const t = sync(s, {}, TOM);
  assert.equal(t.orders.find(x => x.id === 'shared').status, 'shipped', 'his order is as he left it');
  assert.equal(t.orders.find(x => x.id === 't1').notes, undefined);
  assert.equal(t.refused, undefined);
  // each row says whose it is
  assert.deepEqual(s.tab('Orders').slice(1).map(r => r[0] + ':' + r[2]).sort(), ['Ella:Etsy', 'Tom:Home Depot', 'Tom:Target']);
  // a deletion of her own goes through, and only she hears of it
  sync(s, { graves: { 'orders:e1': T + 5 } }, ELLA);
  assert.deepEqual(sync(s, {}, ELLA).orders, []);
  assert.deepEqual(Object.keys(sync(s, {}, ELLA).graves), ['orders:e1']);
  assert.deepEqual(Object.keys(sync(s, {}, TOM).graves), []);
});

test('Private (hidden from Ipsy) is kept like any other detail, and is nothing to do with whose an order is', () => {
  const s = mk();
  sync(s, { orders: [order('p', { private: true })] }, TOM);
  const back = sync(s, {}, TOM).orders[0];
  assert.equal(back.private, true); assert.equal(back.by, 'tom');
  sync(s, { orders: [order('p', { updated: T + 50 })] }, TOM);   // switched off again (the field goes)
  assert.equal(sync(s, {}, TOM).orders[0].private, undefined);
  assert.deepEqual(sync(s, {}, ELLA).orders, [], 'private or not, Ella never gets Tom\'s');
});

test('orders from before aOS are the owner\'s, and written down as theirs the first time the owner syncs', () => {
  const s = fakeSheet(GS, SECRET);
  // an old Sheet: orders with no by (as a VERSION 2 script kept them)
  s.post({ action: 'sync', orders: [order('old1'), order('old2', { orderNo: 'X' })], graves: {} }, { key: SECRET, who: 'nobody' });
  s.sheets.get('_orders').cells = s.sheets.get('_orders').cells.map((r, i) => i ? [r[0], r[1], JSON.stringify(Object.assign(JSON.parse(r[2]), { by: undefined }))] : r);
  s.sheets.get('_people').cells = [['id', 'name']];
  const e = sync(s, { orders: [order('old2', { orderNo: 'X', updated: T + 1 })] }, ELLA);
  assert.deepEqual(e.orders, [], 'not Ella\'s');
  assert.deepEqual(e.refused, ['old2'], 'nor can she take one over');
  assert.deepEqual(sync(s, {}, TOM).orders.map(x => x.id).sort(), ['old1', 'old2'], 'the owner\'s');
  assert.ok(s.tab('_orders').slice(1).every(r => JSON.parse(r[2]).by === 'tom'), 'written down as Tom\'s');
  assert.deepEqual(sync(s, {}, ELLA).orders, []);
});

test('the phone keeps 90 days: older finished orders stay here and come back when asked for; one not finished always comes back', () => {
  const s = mk();
  sync(s, { orders: [
    order('new', { orderDate: '2026-10-01', status: 'delivered' }),
    order('old', { orderDate: '2026-05-01', status: 'delivered', steps: { ordered: '2026-05-01', delivered: '2026-05-04' } }),
    order('oldpickup', { orderDate: '2026-04-20', kind: 'pickup', status: 'pickedup' }),
    order('stuck', { orderDate: '2026-03-01', status: 'shipped', steps: { ordered: '2026-03-01', shipped: '2026-03-02' } }),
    order('waiting', { orderDate: '', steps: { pickup: '2026-02-10' }, kind: 'pickup', status: 'pickup' }),
    order('cancelled', { orderDate: '2026-02-01', status: 'cancelled' }),
    // no order date: its first step's day; no steps either: its email's day
    order('nodate', { orderDate: '', status: 'delivered', steps: { shipped: '2026-04-02', delivered: '2026-04-05' } }),
    order('mail', { orderDate: '', status: 'delivered', steps: {}, source: { msgId: 'm', date: Date.parse('2026-09-30T12:00:00Z') } }),
  ] });
  const r = s.post({ action: 'sync', window: 90, today: '2026-10-20', orders: [], graves: {} }, TOM);
  assert.deepEqual(r.orders.map(x => x.id).sort(), ['mail', 'new', 'stuck', 'waiting'], 'the last 90 days, and what hasn\'t arrived yet whatever its age');
  assert.ok(r.graves, 'graves come with a sync');
  // the first of the 90 days is in, the day before is not
  sync(s, { orders: [order('edge', { orderDate: '2026-07-23', status: 'delivered' }), order('over', { orderDate: '2026-07-22', status: 'delivered' })] });
  const ids = s.post({ action: 'sync', window: 90, today: '2026-10-20', graves: {} }, TOM).orders.map(x => x.id);
  assert.ok(ids.includes('edge') && !ids.includes('over'), ids.join());
  // an order a phone sends comes back as the Sheet has it, old or not (your other phone marked it delivered)
  sync(s, { orders: [order('stuck', { orderDate: '2026-03-01', status: 'delivered', steps: { ordered: '2026-03-01', delivered: '2026-03-09' }, updated: T + 100 })] });
  const back = s.post({ action: 'sync', window: 90, today: '2026-10-20', orders: [order('stuck', { orderDate: '2026-03-01', status: 'shipped', updated: T })], graves: {} }, TOM);
  assert.equal(back.orders.find(x => x.id === 'stuck').status, 'delivered');
  assert.ok(!s.post({ action: 'sync', window: 90, today: '2026-10-20', graves: {} }, TOM).orders.some(x => x.id === 'stuck'), 'and once it has arrived it stays in the Sheet');
  // looking back
  const old = s.post({ action: 'range', from: '2026-04-01', to: '2026-05-31' }, TOM);
  assert.deepEqual(old.orders.map(x => x.id).sort(), ['nodate', 'old', 'oldpickup']);
  assert.equal(old.graves, undefined, 'a range is only orders');
  assert.deepEqual(s.post({ action: 'range', from: '2026-04-01', to: '2026-05-31' }, ELLA).orders, [], 'and only yours');
  assert.equal(s.post({ action: 'range', from: 'last year', to: '2026-05-31' }, TOM).graves !== undefined, true, 'a range without days is an ordinary answer');
});

test('a sync with no log does not make a Log tab, and says nothing was logged', () => {
  const s = mk();
  const r = sync(s, { orders: [order('a')] });
  assert.deepEqual(r.logged, []); assert.equal(s.tab('Log'), null);
});

test('events become Log rows: header, whose phone, oldest at the top, readable items and status, the id of each one acknowledged', () => {
  const s = mk();
  const r = sync(s, { log: [
    ev('e2', 'Status changed', order('a', { status: 'delivered' }), { at: T + 2000, note: 'Shipped → Delivered' }),
    ev('e1', 'Added', order('a', { status: 'ordered', tracking: undefined }), { at: T + 1000 }),
    ev('e3', 'Left out', { id: 'f1', store: 'Tandoor House', kind: 'food', status: 'ordered', items: [{ name: 'Naan' }], orderNo: 'AB12CD', total: 24.5 }, { at: T + 3000, note: 'The “food” kind is switched off in Settings' }),
  ] });
  assert.deepEqual(r.logged.sort(), ['e1', 'e2', 'e3']);
  sync(s, { log: [ev('e4', 'Added', order('x', { store: 'Etsy' }), { at: T + 4000 })] }, ELLA);
  const log = s.tab('Log');
  assert.deepEqual(log[0], LOGHEAD);
  assert.deepEqual(log.slice(1).map(x => x[0] + ' ' + x[2]), ['Tom Added', 'Tom Status changed', 'Tom Left out', 'Ella Added'], 'in the order they happened, each with whose phone');
  assert.deepEqual(log[2].slice(3, 15), ['Home Depot', 'package', '12 x Plank flooring; Underlayment', 987.21, 'Delivered', 'UPS', '1Z0000000000000001', '2026-10-05', 'WK00000001', 'Shipped → Delivered', 'a', 'e2']);
  assert.ok(log[1][1] instanceof Date && log[1][1].getTime() === T + 1000);
  assert.deepEqual(log[3].slice(3, 9), ['Tandoor House', 'food', 'Naan', 24.5, 'Ordered', ''], 'a kind that is switched off is still logged');
});

test('an event sent twice is written once (and acknowledged both times); a deleted order stays in the Log', () => {
  const s = mk();
  const e = ev('d1', 'Added', order('a'));
  assert.deepEqual(sync(s, { log: [e] }).logged, ['d1']);
  assert.deepEqual(sync(s, { log: [e, ev('d2', 'Deleted', order('a'), { at: T + 5 })] }).logged, ['d1', 'd2']);
  assert.equal(s.tab('Log').length, 3);
  sync(s, { graves: { 'orders:a': T + 10 } });
  assert.equal(s.tab('Orders').length, 1, 'the order is gone from Orders');
  assert.equal(s.tab('Log').length, 3, 'its rows are still in the Log');
});

test('the Log is never rebuilt: rebuilding the other tabs, or syncing from an empty phone, keeps every row', () => {
  const s = mk();
  sync(s, { orders: [order('a')], log: [ev('r1', 'Added', order('a'))] });
  s.rebuild();
  sync(s, { action: 'rebuild' });
  sync(s, { log: [ev('r2', 'Updated', order('a'), { at: T + 9, note: 'Changed: tracking' })] });
  assert.deepEqual(s.tab('Log').slice(1).map(x => x[14]), ['r1', 'r2']);
});

test('a Log from before aOS gets a Who column in front: its rows move over as they are and are the owner\'s, and nothing is written twice', () => {
  const s = mk();
  sync(s, {}, TOM);   // the Sheet knows Tom is the owner
  // the old layout (VERSION 2): no Who, the time in column 1, tracking in column 9, the event id last
  s.post({ action: 'sync', log: [ev('seed', 'Added', order('z'))] }, TOM);
  const log = s.sheets.get('Log');
  log.cells = [LOGHEAD.slice(1), [new Date(T), 'Added', 'Home Depot', 'package', 'Plank', 9, 'Shipped', 'UPS', '00123', '', 'WK1', '', 'a', 'old-1']];
  log.formats = new Set(['1:yyyy-mm-dd hh:mm:ss', '9:@', '14:@']);
  const r = sync(s, { log: [ev('old-1', 'Added', order('a')), ev('new-1', 'Updated', order('a', { tracking: '00999' }), { at: T + 1 })] }, ELLA);
  assert.deepEqual(r.logged, ['old-1', 'new-1']);
  assert.deepEqual(log.cells[0], LOGHEAD);
  assert.deepEqual(log.cells[1].slice(0, 3), ['Tom', log.cells[1][1], 'Added']);
  assert.ok(log.cells[1][1] instanceof Date, 'the old time, one column right');
  assert.equal(log.cells[1][9], '00123', 'the old tracking number, one column right');
  assert.equal(log.cells.length, 3, 'the event already there is not written again');
  assert.deepEqual([log.cells[2][0], log.cells[2][2], log.cells[2][9], log.cells[2][14]], ['Ella', 'Updated', '00999', 'new-1']);
  assert.ok(log.formats.has('2:yyyy-mm-dd hh:mm:ss') && log.formats.has('10:@') && log.formats.has('1:@'), [...log.formats].join());
  sync(s, { log: [ev('new-2', 'Added', order('b'))] }, TOM);
  assert.equal(log.cells[0].filter(h => h === 'Who').length, 1, 'once only');
});

test('text from an email is kept as text: a store starting with = is not a formula, tracking numbers are text columns', () => {
  const s = mk();
  sync(s, { orders: [order('x', { store: '=IMPORTXML("https://evil.example","//a")' })], log: [ev('x1', 'Added', order('x', { store: '=IMPORTXML("https://evil.example","//a")', tracking: '00123456789012' }))] });
  const log = s.tab('Log'), sheet = s.sheets.get('Log');
  assert.equal(log[1][3], '=IMPORTXML("https://evil.example","//a")');
  assert.ok(sheet.raw.includes("'=IMPORTXML(\"https://evil.example\",\"//a\")"), 'written with the text marker');
  assert.equal(log[1][9], '00123456789012');
  assert.ok([...sheet.formats].some(f => f.startsWith('10:@')), 'the tracking column is formatted as text');
  assert.equal(s.sheets.get('Orders').raw.some(v => typeof v === 'string' && v.startsWith('=')), false);
  assert.equal(sync(s, {}).orders[0].store, '=IMPORTXML("https://evil.example","//a")', 'and read back as it was');
});

test('bad events are skipped, not fatal: no id, junk, more than 500', () => {
  const s = mk();
  const r = sync(s, { log: [null, 5, { at: T }, ev('', 'Added', order('a')), ev('ok1', 'Added', order('a'))] });
  assert.deepEqual(r.logged, ['ok1']);
  const many = Array.from({ length: 520 }, (_, i) => ev('m' + i, 'Added', order('o' + i)));
  assert.equal(sync(s, { log: many }).logged.length, 500);
});

console.log(n + ' tests passed');
