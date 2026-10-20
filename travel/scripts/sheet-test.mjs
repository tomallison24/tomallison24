// Runs travel/google-sheet-sync.gs in Node against an in-memory Sheet (the Drinks test's
// fake-sheet.mjs): who gets in (only aOS, with the phrase and who's asking), a first sync and the
// readable Bookings tab with its Who column, newest change winning, a deletion reaching the other
// phones, one Sheet for the family (shared bookings, and Just me ones only their own person gets,
// sets or clears, and nobody else can change or delete), rows from before aOS becoming the owner's,
// and the phones' 90 days (everything still to come, older trips on asking).
//   node travel/scripts/sheet-test.mjs
import assert from 'assert/strict';
import path from 'path';
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';

const GS = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'google-sheet-sync.gs');
const SECRET = 'test-secret-phrase';
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
// what aOS adds to every request (functions/sheet/api): the phrase, and who's asking
const TOM = { key: SECRET, who: 'tom', name: 'Tom', owner: '1' }, ELLA = { key: SECRET, who: 'ella', name: 'Ella' }, MAX = { key: SECRET, who: 'max', name: 'Max' };
const T = Date.now();   // stamps near now: graves older than 400 days are dropped
const flight = (id, extra) => Object.assign({ id, type: 'flight', status: 'confirmed', airline: 'United', airlineCode: 'UA', flightNo: '1234', from: 'DEN', to: 'BOS',
  fromName: 'Denver', toName: 'Boston', dep: '2026-11-02T07:05', arr: '2026-11-02T12:40', conf: 'KQ7T2M', notes: '', updated: T + 1000 }, extra);
const hotel = (id, extra) => Object.assign({ id, type: 'hotel', status: 'confirmed', name: 'Courtyard Boston Downtown', address: '275 Tremont St', city: 'Boston',
  checkIn: '2026-11-02', checkOut: '2026-11-05', conf: '81234567', notes: '', updated: T + 1000 }, extra);
const mk = asAos => fakeSheet(GS, SECRET, asAos);
const ids = list => (list || []).map(x => x.id).sort();

test('answers a GET with its name; only aOS, with the phrase and who\'s asking, gets in', () => {
  const s = mk(TOM);
  assert.deepEqual(s.get(), { ok: true, app: 'allison-travel-sync', v: 2, aos: true });
  assert.equal(s.post({ action: 'sync' }, { key: 'nope', who: 'tom' }).error, 'wrong-secret');
  const old = s.post({ secret: SECRET, action: 'sync', bookings: [flight('f1')] }, {});
  assert.equal(old.error, 'wrong-secret', 'a phone with the phrase in its request, as before aOS, gets nothing');
  assert.equal(old.aos, true, 'and aOS can tell the phrase is wrong (not an old script)');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET }).error, 'who');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET, who: 'a b' }).error, 'who');
  assert.equal(s.post('not json').error, 'bad-request');
  assert.equal(fakeSheet(GS, 'CHANGE-ME').post({ action: 'sync' }, { key: 'CHANGE-ME', who: 'tom' }).error, 'secret-not-set');
  assert.deepEqual(s.post({ action: 'ping' }), { ok: true, app: 'allison-travel-sync', v: 2, aos: true });
  assert.equal(s.tab('_bookings'), null, 'nothing was written by any of those');
  // curly quotes and stray spaces in the phrase don't count against you
  assert.equal(fakeSheet(GS, "tom's-code").post({ action: 'sync', bookings: [] }, { key: ' tom’s-code ', who: 'tom' }).ok, true);
});

test('a first sync stores the bookings and builds the Bookings tab, soonest first, with Who', () => {
  const s = mk(TOM);
  const r = s.post({ action: 'sync', bookings: [hotel('h1'), flight('f1', { notes: '=HYPERLINK("http://x")' })], trips: [{ id: 'f1', name: 'Boston', updated: T }], graves: {} });
  assert.equal(r.ok, true);
  assert.equal(r.by, 'tom');
  assert.deepEqual(r.people, { tom: 'Tom' });
  assert.deepEqual(ids(r.bookings), ['f1', 'h1']);
  assert.ok(r.bookings.every(b => b.by === 'tom'), 'each is marked as Tom\'s');
  assert.equal(r.trips[0].name, 'Boston');
  const w = s.tab('Bookings');
  assert.deepEqual(w[0], ['Who', 'Starts', 'Ends', 'Type', 'Booking', 'Where', 'Confirmation', 'Status', 'Notes', 'Seen by']);
  assert.deepEqual(w[1], ['Tom', '2026-11-02', '2026-11-05', 'hotel', 'Courtyard Boston Downtown', '275 Tremont St', '81234567', 'Confirmed', '', 'Family']);
  assert.deepEqual(w[2], ['Tom', '2026-11-02 07:05', '2026-11-02 12:40', 'flight', 'United UA1234 DEN → BOS', 'Denver → Boston', 'KQ7T2M', 'Confirmed', '=HYPERLINK("http://x")', 'Family']);
  assert.ok(s.sheets.get('Bookings').raw.includes('\'=HYPERLINK("http://x")'), 'text that looks like a formula is kept as text');
  assert.ok(s.sheets.get('_bookings').hidden && s.sheets.get('_deleted').hidden && s.sheets.get('_people').hidden);
  assert.equal(s.tab('Sheet1'), null, 'the empty first tab is tidied away');
});

test('the newest change wins, from any phone; a deletion reaches the others, and Undo brings it back', () => {
  const s = mk(TOM);
  s.post({ action: 'sync', bookings: [flight('f1', { gate: 'B2', updated: T + 2000 }), hotel('h1')], graves: {} });
  let r = s.post({ action: 'sync', bookings: [flight('f1', { gate: 'A1', updated: T + 1500 })], graves: {} });
  assert.equal(r.bookings.find(b => b.id === 'f1').gate, 'B2', 'an older copy does not win');
  r = s.post({ action: 'sync', bookings: [flight('f1', { gate: 'C3', updated: T + 3000 })], graves: {} }, ELLA);
  assert.equal(r.bookings.find(b => b.id === 'f1').gate, 'C3', 'Ella changes a shared booking');
  assert.equal(r.bookings.find(b => b.id === 'f1').by, 'tom', 'and it stays Tom\'s');
  r = s.post({ action: 'sync', bookings: [], graves: { 'bookings:h1': T + 4000 } }, ELLA);
  assert.deepEqual(ids(r.bookings), ['f1'], 'Ella deletes a shared booking');
  r = s.post({ action: 'sync', bookings: [hotel('h1')], graves: {} });
  assert.deepEqual(ids(r.bookings), ['f1'], 'Tom\'s phone, unchanged since, hears of it and doesn\'t bring it back');
  assert.equal(r.graves['bookings:h1'], T + 4000);
  r = s.post({ action: 'sync', bookings: [hotel('h1', { updated: T + 5000 })], graves: {} });
  assert.deepEqual(ids(r.bookings), ['f1', 'h1'], 'Undo, stamped after the deletion');
  assert.equal(r.graves['bookings:h1'], undefined);
});

test('one Sheet for the family: shared bookings reach everyone, Just me ones only their own person', () => {
  const s = mk();
  s.post({ action: 'sync', bookings: [flight('t-shared'), hotel('t-only', { only: true })], trips: [{ id: 't-only', name: 'Surprise', only: true, updated: T }], graves: {} }, TOM);
  s.post({ action: 'sync', bookings: [flight('e-shared', { flightNo: '77' }), hotel('e-only', { only: true, name: 'Spa' })], graves: {} }, ELLA);
  const t = s.post({ action: 'sync', graves: {} }, TOM), e = s.post({ action: 'sync', graves: {} }, ELLA), m = s.post({ action: 'sync', graves: {} }, MAX);
  assert.deepEqual(ids(t.bookings), ['e-shared', 't-only', 't-shared'], 'Tom: the family\'s and his own Just me one');
  assert.deepEqual(ids(e.bookings), ['e-only', 'e-shared', 't-shared'], 'Ella: the family\'s and her own');
  assert.deepEqual(ids(m.bookings), ['e-shared', 't-shared'], 'Max: just the family\'s');
  assert.deepEqual(ids(e.trips), [], 'a Just me trip name is Tom\'s alone');
  assert.equal(t.trips[0].name, 'Surprise');
  assert.deepEqual(m.people, { tom: 'Tom', ella: 'Ella', max: 'Max' }, 'the family\'s names, for whose a booking is');
  const w = s.tab('Bookings').slice(1).map(r => r[0] + ':' + r[4] + ':' + r[9]);
  assert.ok(w.includes('Ella:Spa:Just me') && w.includes('Tom:Courtyard Boston Downtown:Just me') && w.includes('Ella:United UA77 DEN → BOS:Family'), w.join('\n'));
});

test('only its own person sets or clears Just me; nobody else can change or delete a Just me booking', () => {
  const s = mk();
  s.post({ action: 'sync', bookings: [flight('f1'), hotel('h1', { only: true })], graves: {} }, TOM);
  // Ella makes Tom's shared flight Just me: not hers to do, so it stays shared (her other change is kept)
  let e = s.post({ action: 'sync', bookings: [flight('f1', { only: true, seat: '12A', updated: T + 2000 })], graves: {} }, ELLA);
  assert.equal(e.bookings.find(b => b.id === 'f1').seat, '12A');
  assert.equal(e.bookings.find(b => b.id === 'f1').only, undefined, 'still shared');
  assert.deepEqual(ids(s.post({ action: 'sync', graves: {} }, MAX).bookings), ['f1'], 'Max still sees it');
  // Ella's phone sends Tom's Just me hotel's id (it can't know it): changes nothing, gets nothing back
  e = s.post({ action: 'sync', bookings: [hotel('h1', { name: 'Not his', updated: T + 9000 })], graves: {} }, ELLA);
  assert.deepEqual(ids(e.bookings), ['f1']);
  assert.equal(s.post({ action: 'sync', graves: {} }, TOM).bookings.find(b => b.id === 'h1').name, 'Courtyard Boston Downtown');
  // nor can it delete it
  s.post({ action: 'sync', graves: { 'bookings:h1': T + 9999 } }, ELLA);
  let t = s.post({ action: 'sync', graves: {} }, TOM);
  assert.deepEqual(ids(t.bookings), ['f1', 'h1'], 'Tom\'s Just me hotel is still there');
  assert.equal(t.graves['bookings:h1'], undefined);
  // Tom shares it again: now the family sees it
  s.post({ action: 'sync', bookings: [hotel('h1', { updated: T + 3000 })], graves: {} }, TOM);
  assert.deepEqual(ids(s.post({ action: 'sync', graves: {} }, ELLA).bookings), ['f1', 'h1']);
  // and Ella can't make it Just me, or Just me again
  s.post({ action: 'sync', bookings: [hotel('h1', { only: true, updated: T + 4000 })], graves: {} }, ELLA);
  assert.deepEqual(ids(s.post({ action: 'sync', graves: {} }, MAX).bookings), ['f1', 'h1']);
  // Tom makes his flight Just me: Ella and Max don't get it any more
  s.post({ action: 'sync', bookings: [flight('f1', { only: true, updated: T + 5000 })], graves: {} }, TOM);
  assert.deepEqual(ids(s.post({ action: 'sync', graves: {} }, ELLA).bookings), ['h1']);
  t = s.post({ action: 'sync', graves: {} }, TOM);
  assert.equal(t.bookings.find(b => b.id === 'f1').only, true);
  // Tom can delete his own Just me booking
  t = s.post({ action: 'sync', graves: { 'bookings:f1': T + 6000 } }, TOM);
  assert.deepEqual(ids(t.bookings), ['h1']);
});

test('rows from before aOS are the owner\'s, and written down as theirs the first time the owner syncs', () => {
  const s = mk();
  s.post({ action: 'sync', bookings: [flight('old1'), hotel('old2')], trips: [{ id: 'old1', name: 'Boston', updated: T }], graves: {} }, { key: SECRET, who: 'nobody' });
  // an old Sheet: rows with no by (as a VERSION 1 script kept them), and no _people
  for (const tab of ['_bookings', '_trips']) s.sheets.get(tab).cells = s.sheets.get(tab).cells.map((r, i) => i ? [r[0], r[1], JSON.stringify(Object.assign(JSON.parse(r[2]), { by: undefined }))] : r);
  s.sheets.get('_people').cells = [['id', 'name']];
  // before the owner has synced, they're nobody's in particular: shared, as they always were
  assert.deepEqual(ids(s.post({ action: 'sync', graves: {} }, ELLA).bookings), ['old1', 'old2']);
  const t = s.post({ action: 'sync', graves: {} }, TOM);
  assert.ok(t.bookings.every(b => b.by === 'tom') && t.trips.every(x => x.by === 'tom'), 'the owner\'s');
  assert.ok(s.tab('_bookings').slice(1).every(r => JSON.parse(r[2]).by === 'tom'), 'written down as Tom\'s');
  assert.deepEqual(s.tab('Bookings').slice(1).map(r => r[0]), ['Tom', 'Tom'], 'the Who column says so');
  // and so only Tom can make one Just me
  s.post({ action: 'sync', bookings: [flight('old1', { only: true, updated: T + 5000 })], graves: {} }, ELLA);
  assert.deepEqual(ids(s.post({ action: 'sync', graves: {} }, MAX).bookings), ['old1', 'old2']);
});

test('the phones keep everything still to come and 90 days of the rest; older trips come back when asked for', () => {
  const s = mk();
  s.post({ action: 'sync', graves: {}, trips: [{ id: 'past-old', name: 'Lisbon', updated: T }], bookings: [
    flight('next', { dep: '2027-03-01T09:00', arr: '2027-03-01T12:00' }),                      // still to come
    hotel('now', { checkIn: '2026-10-18', checkOut: '2026-10-23' }),                             // under way
    flight('recent', { dep: '2026-07-25T09:00', arr: '2026-07-25T12:00' }),                     // inside the 90 days
    hotel('edge', { checkIn: '2026-07-10', checkOut: '2026-07-23' }),                            // ended on the window's first day
    flight('past-old', { dep: '2026-05-01T09:00', arr: '2026-05-01T12:00' }),                   // older
    hotel('past-old-only', { checkIn: '2026-05-01', checkOut: '2026-05-04', only: true }),       // older, Just me
    hotel('long-ago', { checkIn: '2024-12-20', checkOut: '2024-12-27' }),
    { id: 'nodate', type: 'flight', status: 'confirmed', airlineCode: 'F9', flightNo: '2154', from: 'MCO', to: 'PHL', updated: T },   // no date yet
  ] }, TOM);
  const r = s.post({ action: 'sync', window: 90, today: '2026-10-20', graves: {} }, TOM);
  assert.deepEqual(ids(r.bookings), ['edge', 'next', 'nodate', 'now', 'recent'], 'the 90 days run from 2026-07-23');
  assert.equal(r.trips.length, 1, 'trip names: always all of them');
  assert.ok(s.tab('_bookings').length === 9, 'the Sheet keeps them all');
  const old = s.post({ action: 'range', from: '2000-01-01', to: '2026-07-22' }, TOM);
  assert.deepEqual(ids(old.bookings), ['edge', 'long-ago', 'past-old', 'past-old-only'], 'any booking on those days (edge ran into them; a phone that has it already skips it)');
  assert.equal(old.trips, undefined, 'a range is only bookings'); assert.equal(old.graves, undefined, 'and no deletions');
  assert.deepEqual(ids(s.post({ action: 'range', from: '2026-04-01', to: '2026-05-02' }, TOM).bookings), ['past-old', 'past-old-only'], 'a booking on any of the days');
  assert.deepEqual(ids(s.post({ action: 'range', from: '2026-05-04', to: '2026-05-10' }, TOM).bookings), ['past-old-only'], 'its last day counts too');
  assert.deepEqual(ids(s.post({ action: 'range', from: '2000-01-01', to: '2026-07-22' }, ELLA).bookings), ['edge', 'long-ago', 'past-old'], 'and only what you may see');
  // a phone that keeps only its 90 days sends less: nothing is deleted without a grave
  const r2 = s.post({ action: 'sync', window: 90, today: '2026-10-20', bookings: r.bookings, graves: {} }, TOM);
  assert.equal(r2.bookings.length, 5);
  assert.equal(s.tab('_bookings').length, 9);
});

console.log('\n' + n + ' tests passed');
