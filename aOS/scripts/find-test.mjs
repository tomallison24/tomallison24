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
console.log(n + ' find tests passed');
