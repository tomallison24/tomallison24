// aOS/home-find.js's search, for Ipsy in aOS (its search_apps tool, aOS/home-tab.js): what each app keeps on
// the phone, found by a word, with whatever is marked Private left out (a private note, order or booking, an
// event private in itself or on this phone's list), while the Ipsy bar's own search, for the person, still
// finds them. Plain Node: the apps' storage is a stand-in, and the calendar's .ics is read by calendar/ical.js.
//   node aOS/scripts/find-test.mjs
import assert from 'assert/strict';
import fs from 'fs';
import vm from 'vm';

const store = new Map();
globalThis.window = globalThis;
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const load = f => vm.runInThisContext(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'), { filename: f });
load('calendar/ical.js');
load('aOS/home-find.js');

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok - ' + name); };
const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// an event tomorrow at 10:00 UTC, named and maybe private in itself
const t = new Date(Date.now() + 864e5), d = t.toISOString().slice(0, 10).replace(/-/g, '');
const ics = (uid, summary, priv) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:20260101T000000Z', `DTSTART:${d}T100000Z`, `DTEND:${d}T110000Z`,
  'SUMMARY:' + summary, ...(priv ? ['X-AOS-PRIVATE:TRUE'] : []), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
put('allison-calendar-v1-items', { at: 1, win: {}, items: [
  { name: 'a.ics', ics: ics('a', 'Sophie recital', true) },          // private in itself
  { name: 'b.ics', ics: ics('b', 'Sophie dentist', false) },
  { name: 'c.ics', ics: ics('c', 'Sophie party planning', false) },  // private on this phone's list
] });
put('calendar.private', ['c.ics']);
put('allison-notes-v1', { notes: [{ id: 'n1', title: 'Sophie birthday ideas', body: 'a necklace', private: true, updated: 2 }, { id: 'n2', title: 'Sophie school forms', body: '', updated: 1 }], todos: [] });
put('allison-orders-v1', { orders: [{ id: 'o1', store: 'Etsy', items: [{ name: 'Sophie necklace' }], private: true, orderDate: '2026-10-01' }, { id: 'o2', store: 'Target', items: [{ name: 'Sophie backpack' }], orderDate: '2026-10-02' }] });
put('allison-travel-v1', { bookings: [{ id: 'b1', type: 'hotel', name: 'Sophie surprise hotel', private: true, checkIn: '2026-12-01' }, { id: 'b2', type: 'hotel', name: 'Sophie camp lodge', checkIn: '2026-12-05' }] });
put('allison-places-v1', [{ name: 'Sophie\'s favourite bakery', city: 'Apex', status: 'been' }]);

const titles = r => r.map(x => x.app + ':' + x.title).sort();
test('the Ipsy bar, for the person: finds everything, private things too', () => {
  const r = aosFind.search('sophie', { per: 8, max: 30 });
  for (const want of ['calendar:Sophie recital', 'calendar:Sophie party planning', 'notes:Sophie birthday ideas', 'travel:Sophie surprise hotel'])
    assert.ok(titles(r).includes(want), want);
});
test('for Ipsy: the same search, nothing marked Private, in any app, either way it was marked', () => {
  const r = aosFind.search('sophie', { per: 8, max: 30, forIpsy: true });
  assert.deepEqual(titles(r), ['calendar:Sophie dentist', 'notes:Sophie school forms', 'orders:Sophie backpack', 'places:Sophie\'s favourite bakery', 'travel:Sophie camp lodge']);
  assert.ok(r.every(x => !/recital|party|birthday|necklace|surprise/i.test(JSON.stringify(x))), 'not a word of them');
  assert.equal(r.hidden, undefined, 'not even how many');
});
test('a private item\'s other words don\'t find it either', () => {
  assert.deepEqual(aosFind.search('necklace', { forIpsy: true }), []);
  assert.deepEqual(aosFind.search('etsy', { forIpsy: true }), []);
  assert.equal(aosFind.search('necklace', {}).length, 2, 'the person still finds them');
});
test('only the apps asked about, and nothing for a word too short', () => {
  assert.deepEqual([...new Set(aosFind.search('sophie', { forIpsy: true, per: 8, max: 30, known: a => a === 'notes' }).map(x => x.app))], ['notes']);
  assert.deepEqual(aosFind.search('s', { forIpsy: true }), []);
});

// ---- the morning brief and the next trip (brief) ----
const pad = x => String(x).padStart(2, '0');
const dayAt = k => { const x = new Date(); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() + k); return x; };
const ymdOf = x => x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
const T0 = ymdOf(dayAt(0)), T3 = ymdOf(dayAt(3)), T4 = ymdOf(dayAt(4)), T6 = ymdOf(dayAt(6));
const floating = (k, h) => ymdOf(dayAt(k)).replace(/-/g, '') + 'T' + pad(h) + '0000';   // the phone's own clock
const vevent = (uid, summary, k, h) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:20260101T000000Z', 'DTSTART:' + floating(k, h), 'DTEND:' + floating(k, h + 1), 'SUMMARY:' + summary, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
function seedDay({ tripIn = 3 } = {}) {
  store.clear();
  put('allison-calendar-v1-items', { at: Date.now() + tripIn, win: {}, items: [{ name: 'e1.ics', ics: vevent('e1', 'School run', 0, 23) }, { name: 'e2.ics', ics: vevent('e2', 'Museum', tripIn + 1, 10) }] });
  put('allison-orders-v1', { orders: [
    { id: 'o1', store: 'Target', status: 'shipped', eta: T0 }, { id: 'o2', store: 'Costco', status: 'pickup' },
    { id: 'o3', store: 'Gift shop', status: 'shipped', eta: T0, hide: true }, { id: 'o4', store: 'Old', status: 'delivered', eta: T0 },
    { id: 'o5', store: 'Away Co', status: 'shipped', eta: ymdOf(dayAt(tripIn + 1)) }] });
  put('allison-meals-v2', { plan: { dates: [T0], meals: [{ day: 1, title: 'Tacos', slot: 'dinner' }, { day: 1, title: 'Soup', slot: 'lunch' }] } });
  put('allison-notes-v1', { notes: [], todos: [{ id: 't1', title: 'Call the dentist', date: ymdOf(dayAt(-1)) }, { id: 't2', title: 'Bins out', date: T0 }, { id: 't3', title: 'Done', date: T0, done: true }, { id: 't4', title: 'Later', date: ymdOf(dayAt(1)) }] });
  const here = { lat: 35.78, lon: -78.638 };
  put('wx.here', here);
  put('wx.cache', { '35.780,-78.638': { cur: { tF: 60, c: 'rainy' }, rKind: 'pop', fetchedAt: Date.now(), daily: [{ t: Math.floor(dayAt(0).getTime() / 1000), c: 'rainy', r: 70 }], hourly: [] } });
  const d0 = ymdOf(dayAt(tripIn)), d3 = ymdOf(dayAt(tripIn + 3));
  put('allison-travel-v1', { trips: [{ id: 'f1', name: 'Boston weekend' }], bookings: [
    { id: 'f1', type: 'flight', dep: d0 + 'T08:00', arr: d0 + 'T11:00', from: 'RDU', to: 'BOS', toName: 'Boston' },
    { id: 'h1', type: 'hotel', name: 'Harbor Inn', city: 'Boston', checkIn: d0, checkOut: d3 },
    { id: 'x1', type: 'hotel', name: 'Cancelled place', city: 'Nowhere', checkIn: d0, checkOut: d3, status: 'cancelled' }] });
}
test('the brief: the day\'s events, deliveries due, pickups, tonight\'s dinner, reminders due or late, rain', () => {
  seedDay();
  const b = aosFind.brief(), say = b.lines.map(l => l.app + ': ' + l.text);
  assert.ok(say.some(x => /^calendar: 1 event today/.test(x)), say.join(' | '));
  assert.ok(say.includes('orders: A delivery due today: Target'), 'not the hidden gift, not the delivered one');
  assert.ok(say.includes('orders: A pickup waiting: Costco'));
  assert.ok(say.includes('meals: Dinner tonight: Tacos'), 'the dinner, not lunch');
  assert.ok(say.includes('notes: 2 reminders due (1 late): Call the dentist and more'), 'not one done, not tomorrow\'s');
  assert.ok(say.includes('weather: Rain likely today (70%)'));
  assert.deepEqual(b.lines.map(l => l.app), ['calendar', 'weather', 'orders', 'orders', 'meals', 'notes'], 'in that order, six at most');
});
test('the trip card: the next trip within a week, with what happens while away, and the words for Ipsy', () => {
  seedDay();
  const t = aosFind.brief().trip;
  assert.equal(t.name, 'Boston weekend'); assert.equal(t.starts, 'In 3 days'); assert.equal(t.days, 3);
  assert.deepEqual(t.deliveries, ['Away Co']); assert.equal(t.events, 1); assert.equal(t.dinners, 0);
  assert.match(t.dates, / – /);
  assert.match(t.ask, /^Help me get ready for the trip to Boston weekend, .+ a packing list in Notes/);
  seedDay({ tripIn: 10 }); assert.equal(aosFind.brief().trip, null, 'over a week away: no card yet');
  seedDay({ tripIn: -1 }); assert.equal(aosFind.brief().trip.starts, 'Under way', 'and while it\'s on');
  seedDay({ tripIn: -6 }); assert.equal(aosFind.brief().trip, null, 'over: gone');
});
test('an empty phone: no lines, no trip', () => {
  store.clear();
  assert.deepEqual(aosFind.brief(), { lines: [], trip: null });
});
console.log(n + ' find tests passed');
