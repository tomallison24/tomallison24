// Runs the real shared Notes/Places Apps Script (notes/google-sheet-sync.gs, VERSION 2) against an
// in-memory Sheet (drinks/scripts/fake-sheet.mjs): who gets in; one Sheet for the family, where
// everything is shared except Just-me items, which only their own person gets, sets, clears or
// deletes; rows from before aOS become the owner's; finished reminders older than 90 days stay in
// the Sheet and come back when asked for; the Who column; Places on the same Sheet; what the
// notification server (notes/push) gets; and the reminders the other apps write through home/sheet.js
// (AllisonOS.sheet.notes: Meals' shopping list, Orders' return, Calendar's tick), built as a phone's
// Notes would send them and merged by the same script.
//   node notes/scripts/sheet-test.mjs
import assert from 'node:assert/strict';
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';
await import('../../home/sheet.js');   // a plain script: in Node it puts AllisonOS.sheet on globalThis
const NB = globalThis.AllisonOS.sheet.notes.build;

const GS = new URL('../google-sheet-sync.gs', import.meta.url).pathname;
const SECRET = 'test-secret-phrase';
// what aOS adds to every request (functions/sheet/api): the phrase, and who's asking
const TOM = { key: SECRET, who: 'tom', name: 'Tom', owner: '1' }, ELLA = { key: SECRET, who: 'ella', name: 'Ella' };
const now = Date.now();
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok - ' + name); };
const mk = () => fakeSheet(GS, SECRET, TOM);
const sync = (s, body = {}, who = TOM) => s.post({ action: 'sync', notes: [], todos: [], lists: [], graves: {}, ...body }, who);
const places = (s, body = {}, who = TOM) => s.post({ action: 'places', places: [], graves: {}, ...body }, who);
const note = { id: 'n1', title: 'Dinner', body: 'Plan dinner', tags: ['home'], created: now, updated: now };
const place = { id: 'p1', name: 'Test Cafe', status: 'want', notes: 'Try brunch', tags: ['brunch'], updated: now };
const list = { id: 'l1', name: 'Groceries', color: '#10B981', updated: now };
const todo = (id, extra) => ({ id, list: 'l1', title: 'Milk', notes: '', date: null, time: null, prio: 0, flagged: false, done: false, doneAt: null, tags: [], created: now, updated: now, ...extra });
const ids = a => (a || []).map(x => x.id).sort();
const strip = ({ by, ...rest }) => rest;

test('answers a GET with its name; only aOS, with the phrase and who\'s asking, gets in', () => {
  const s = mk();
  assert.deepEqual(s.get(), { ok: true, app: 'allison-notes-sync', v: 2, aos: true });
  assert.equal(s.post({ action: 'sync' }, { key: 'nope', who: 'tom' }).error, 'wrong-secret');
  const old = s.post({ secret: SECRET, action: 'sync' }, {});
  assert.equal(old.error, 'wrong-secret', 'a phone with the phrase in its request, as before aOS, gets nothing');
  assert.equal(old.aos, true, 'and aOS can tell it is the new script');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET }).error, 'who');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET, who: 'a b' }).error, 'who');
  assert.equal(s.post('not json').error, 'bad-request');
  assert.equal(fakeSheet(GS, 'CHANGE-ME').post({ action: 'sync' }, { key: 'CHANGE-ME', who: 'tom' }).error, 'secret-not-set');
  assert.deepEqual(s.post({ action: 'ping' }), { ok: true, app: 'allison-notes-sync', v: 2, aos: true });
  assert.equal(s.post({ secret: SECRET, action: 'due' }, {}).error, 'wrong-secret', 'nor does the notification server without the key');
  assert.equal(s.sheets.size, 1, 'nothing opened or changed');
});

test('Notes and Places can both start on an empty Sheet', () => {
  const s = mk();
  assert.deepEqual(sync(s).notes, []);
  assert.deepEqual(places(s).places, []);
  assert.equal(sync(s).by, 'tom');
});

test('the first Notes save: kept as Tom\'s, in a tag tab that starts with Who', () => {
  const s = mk();
  const r = sync(s, { notes: [note] });
  assert.deepEqual(r.notes.map(strip), [note]);
  assert.equal(r.notes[0].by, 'tom');
  assert.deepEqual(s.tab('#home')[0], ['Who', 'Title', 'Note', 'Tags', 'Created', 'Updated', 'Pinned', 'Archived']);
  assert.deepEqual(s.tab('#home')[1].slice(0, 3), ['Tom', 'Dinner', 'Plan dinner']);
  assert.deepEqual(places(s).places, []);
  assert.ok(s.sheets.get('_people').hidden && s.sheets.get('_notes').hidden);
});

test('places survive a Notes save and reload; Notes survives a Places save; the place tabs have Who', () => {
  const s = mk();
  assert.deepEqual(places(s, { places: [place] }).places.map(strip), [place]);
  sync(s, { notes: [note] });
  assert.deepEqual(places(s).places.map(strip), [place]);
  assert.deepEqual(s.tab('📍 Want to go')[0].slice(0, 2), ['Who', 'Place']);
  assert.deepEqual(s.tab('📍 Want to go')[1].slice(0, 2), ['Tom', place.name]);
  const visited = { ...place, status: 'been', visited: '2026-10-01', updated: now + 1 };
  assert.deepEqual(places(s, { places: [visited] }, ELLA).places.map(strip), [visited], 'Ella moves the family\'s place to Been');
  assert.deepEqual(sync(s).notes.map(strip), [note]);
  assert.deepEqual(s.tab('📍 Been')[1].slice(0, 2), ['Tom', place.name], 'still Tom\'s: he added it');
  assert.equal(sync(s).places, undefined, 'Notes gets no places');
  assert.equal(places(s).notes, undefined, 'and Places no notes');
});

test('newest Places edits win and deletion marks reach the other phone', () => {
  const s = mk();
  places(s, { places: [place] });
  const newer = { ...place, name: 'Updated Cafe', updated: now + 1 };
  places(s, { places: [newer] });
  assert.deepEqual(places(s, { places: [place] }).places.map(strip), [newer]);
  const deleted = places(s, { graves: { 'places:p1': now + 2 } }, ELLA);
  assert.deepEqual(deleted.places, [], 'a shared place: anyone in the family can delete it');
  assert.equal(deleted.graves['places:p1'], now + 2);
  assert.deepEqual(places(s, { places: [place] }).places, []);
});

test('Places can\'t delete Notes through cross-kind deletion marks, nor Notes a place', () => {
  const s = mk();
  sync(s, { notes: [note] }); places(s, { places: [place] });
  places(s, { graves: { 'notes:n1': now + 1 } });
  sync(s, { graves: { 'places:p1': now + 1 } });
  assert.deepEqual(ids(sync(s).notes), ['n1']);
  assert.deepEqual(ids(places(s).places), ['p1']);
  assert.ok(!Object.keys(sync(s).graves).some(k => k.startsWith('places:')), 'and each gets only its own kind\'s deletion marks');
});

test('one Sheet for the family: shared notes, lists and reminders reach everyone, and anyone can change them', () => {
  const s = mk();
  sync(s, { notes: [note], lists: [list], todos: [todo('t1')] }, TOM);
  const e = sync(s, {}, ELLA);
  assert.deepEqual(ids(e.notes), ['n1']); assert.deepEqual(ids(e.lists), ['l1']); assert.deepEqual(ids(e.todos), ['t1']);
  // Ella ticks off Tom's reminder and edits his note: changed, still his
  sync(s, { todos: [todo('t1', { done: true, doneAt: now + 5, updated: now + 5 })], notes: [{ ...note, body: 'Plan dinner for Friday', updated: now + 5 }] }, ELLA);
  const t = sync(s, {}, TOM);
  assert.equal(t.todos[0].done, true); assert.equal(t.todos[0].by, 'tom');
  assert.equal(t.notes[0].body, 'Plan dinner for Friday'); assert.equal(t.notes[0].by, 'tom');
  assert.deepEqual(s.tab('✓ Groceries')[0], ['Who', 'Reminder', 'Notes', 'Due date', 'Time', 'Priority', 'Flagged', 'Done', 'Tags']);
  assert.deepEqual(s.tab('✓ Groceries')[1].slice(0, 2), ['Tom', 'Milk']);
  // a deletion from either phone reaches the other
  sync(s, { graves: { 'notes:n1': now + 9 } }, ELLA);
  const t2 = sync(s, {}, TOM);
  assert.deepEqual(t2.notes, []); assert.equal(t2.graves['notes:n1'], now + 9);
});

test('Just me: only its own person gets it; another phone can\'t change it, delete it or even see it', () => {
  const s = mk();
  const mine = { id: 'ne', title: 'Gift ideas', body: 'For Tom', tags: ['gifts'], created: now, updated: now, only: true };
  sync(s, { notes: [note] }, TOM);
  const e = sync(s, { notes: [mine] }, ELLA);
  assert.deepEqual(ids(e.notes), ['n1', 'ne'], 'Ella gets hers and the family\'s');
  assert.equal(e.notes.find(n => n.id === 'ne').only, true);
  assert.deepEqual(ids(sync(s, {}, TOM).notes), ['n1'], 'Tom doesn\'t get it');
  assert.equal(s.tab('#gifts'), null, 'nor is it drawn in a tab of the Sheet');
  // Tom's phone sending the same id (by mistake or not) changes nothing, and can't delete it
  sync(s, { notes: [{ ...mine, body: 'Changed', only: false, updated: now + 99 }], graves: { 'notes:ne': now + 999 } }, TOM);
  const e2 = sync(s, {}, ELLA);
  const kept = e2.notes.find(n => n.id === 'ne');
  assert.equal(kept.body, 'For Tom'); assert.equal(kept.only, true); assert.equal(kept.by, 'ella');
  assert.equal(e2.graves['notes:ne'], undefined, 'no deletion mark for it');
  // Ella herself can delete it
  sync(s, { graves: { 'notes:ne': now + 50 } }, ELLA);
  assert.deepEqual(ids(sync(s, {}, ELLA).notes), ['n1']);
});

test('only its own person sets or clears Just me', () => {
  const s = mk();
  sync(s, { notes: [note] }, TOM);
  // Ella can't make Tom's note Just me (it stays shared, though her other change counts)
  sync(s, { notes: [{ ...note, title: 'Dinner plans', only: true, updated: now + 1 }] }, ELLA);
  let t = sync(s, {}, TOM).notes[0];
  assert.equal(t.title, 'Dinner plans'); assert.ok(!t.only);
  assert.deepEqual(ids(sync(s, {}, ELLA).notes), ['n1'], 'still the family\'s');
  // Tom can: then only he gets it
  sync(s, { notes: [{ ...t, only: true, updated: now + 2 }] }, TOM);
  assert.equal(sync(s, {}, TOM).notes[0].only, true);
  assert.deepEqual(sync(s, {}, ELLA).notes, []);
  // and back to shared: Ella gets it again
  sync(s, { notes: [{ ...t, only: false, updated: now + 3 }] }, TOM);
  assert.deepEqual(ids(sync(s, {}, ELLA).notes), ['n1']);
});

test('a Just-me list keeps its reminders to its person too', () => {
  const s = mk();
  const secret = { id: 'l9', name: 'Surprise party', color: '#EC4899', updated: now, only: true };
  sync(s, { lists: [list, secret], todos: [todo('t1'), todo('t9', { list: 'l9', title: 'Order the cake' })] }, ELLA);
  const t = sync(s, {}, TOM);
  assert.deepEqual(ids(t.lists), ['l1']); assert.deepEqual(ids(t.todos), ['t1'], 'the reminder isn\'t Just me itself, but its list is');
  assert.deepEqual(ids(sync(s, {}, ELLA).todos), ['t1', 't9']);
  assert.equal(s.tab('✓ Surprise party'), null, 'no tab for it');
  sync(s, { todos: [todo('t9', { list: 'l1', title: 'Hacked', updated: now + 9 })], graves: { 'todos:t9': now + 99 } }, TOM);
  const e = sync(s, {}, ELLA).todos.find(x => x.id === 't9');
  assert.equal(e.title, 'Order the cake', 'Tom can\'t change it'); assert.equal(e.list, 'l9');
});

test('rows from before aOS are the owner\'s: shared with the family, written down as his the first time he syncs', () => {
  const s = mk();
  // an old Sheet: rows with no by (as VERSION 1 kept them)
  sync(s, { notes: [note], todos: [todo('t1')], lists: [list] }, { key: SECRET, who: 'nobody' });
  places(s, { places: [place] }, { key: SECRET, who: 'nobody' });
  for (const tab of ['_notes', '_reminders', '_lists', '_places']) s.sheets.get(tab).cells = s.sheets.get(tab).cells.map((r, i) => i ? [r[0], r[1], JSON.stringify(Object.assign(JSON.parse(r[2]), { by: undefined }))] : r);
  s.sheets.get('_people').cells = [['id', 'name']];
  const e = sync(s, {}, ELLA);
  assert.deepEqual(ids(e.notes), ['n1'], 'the family\'s, so Ella has them');
  // before the owner has synced, Ella can't make one Just me: nobody's yet is the owner's, not hers
  sync(s, { notes: [{ ...note, only: true, updated: now + 1 }] }, ELLA);
  sync(s, {}, TOM);
  assert.ok(['_notes', '_reminders', '_lists', '_places'].every(tab => s.tab(tab).slice(1).every(r => JSON.parse(r[2]).by === 'tom')), 'written down as Tom\'s');
  assert.ok(!sync(s, {}, TOM).notes[0].only);
  assert.deepEqual(ids(sync(s, {}, ELLA).notes), ['n1']);
  assert.deepEqual(s.tab('#home')[1][0], 'Tom', 'and Who says so');
});

test('the phones keep 90 days of finished reminders: older ones stay here, and come back when asked for', () => {
  const s = mk();
  const at = d => Date.parse(d + 'T15:00:00Z');
  sync(s, { lists: [list], notes: [{ ...note, created: at('2020-01-01') }], todos: [
    todo('open', { date: '2025-01-01' }),                                  // open: always, however old its date
    todo('recent', { done: true, doneAt: at('2026-09-01') }),
    todo('old', { done: true, doneAt: at('2026-05-01') }),
    todo('older', { done: true, doneAt: at('2025-12-24') }),
  ] }, TOM);
  const r = sync(s, { window: 90, today: '2026-10-20' }, TOM);
  assert.deepEqual(ids(r.todos), ['open', 'recent']);
  assert.deepEqual(ids(r.notes), ['n1'], 'notes are undated: always all of them'); assert.equal(r.lists.length, 1);
  assert.deepEqual(ids(sync(s, {}, TOM).todos), ['old', 'older', 'open', 'recent'], 'without a window: everything');
  // a phone that keeps only 90 days sends less: nothing is deleted without a deletion mark
  sync(s, { todos: [todo('recent', { done: true, doneAt: at('2026-09-01') })], window: 90, today: '2026-10-20' }, TOM);
  const old = s.post({ action: 'range', from: '2026-01-01', to: '2026-07-22' }, TOM);
  assert.deepEqual(ids(old.todos), ['old']);
  assert.equal(old.notes, undefined, 'a range is only dated rows'); assert.equal(old.lists, undefined); assert.equal(old.graves, undefined);
  assert.deepEqual(ids(s.post({ action: 'range', from: '2025-01-01', to: '2026-07-22' }, ELLA).todos), ['old', 'older'], 'the family\'s, for anyone in it');
  // a Just-me one only for its person
  sync(s, { todos: [todo('mine', { done: true, doneAt: at('2026-03-03'), only: true })] }, ELLA);
  assert.deepEqual(ids(s.post({ action: 'range', from: '2026-03-01', to: '2026-03-31' }, TOM).todos), []);
  assert.deepEqual(ids(s.post({ action: 'range', from: '2026-03-01', to: '2026-03-31' }, ELLA).todos), ['mine']);
  // unticked again: an open reminder, on every phone
  sync(s, { todos: [todo('old', { done: false, doneAt: null, updated: now + 9 })] }, ELLA);
  assert.ok(ids(sync(s, { window: 90, today: '2026-10-20' }, TOM).todos).includes('old'));
});

test('the notification server gets titles and times only, and whose each Just-me one is', () => {
  const s = mk();
  const secret = { id: 'l9', name: 'Surprise party', color: '#EC4899', updated: now, only: true };
  sync(s, { lists: [list], todos: [todo('t1', { date: '2026-10-21', time: '09:00', alert: 15 }), todo('t2', { date: '2026-10-21', done: true })],
    notes: [{ ...note, reminder: '2026-10-21T15:00:00.000Z', body: 'private words' }] }, TOM);
  sync(s, { lists: [secret], todos: [todo('t9', { list: 'l9', date: '2026-10-22' }), todo('t8', { date: '2026-10-22', only: true })],
    notes: [{ id: 'ne', title: '', body: 'Call the florist\nmore', tags: [], reminder: '2026-10-22T15:00:00.000Z', created: now, updated: now, only: true }] }, ELLA);
  const push = { key: SECRET, who: 'notes-push' };
  const d = s.post({ action: 'due' }, push);
  assert.equal(d.ok, true);
  assert.deepEqual(d.todos.map(t => t.id + ':' + (t.who || '')).sort(), ['t1:', 't8:ella', 't9:ella'], 'open dated ones; Just me (or in a Just-me list) says whose');
  assert.deepEqual(d.notes.map(n => n.id + ':' + n.title + ':' + (n.who || '')).sort(), ['n1:Dinner:', 'ne:Call the florist:ella']);
  assert.ok(!JSON.stringify(d).includes('private words'), 'never note text');
  assert.equal(s.tab('_people').some(r => r[0] === 'notes-push'), false, 'and the server isn\'t one of the family');
});

test('text that looks like a formula stays text, and a long note survives the 45,000-character cell limit', () => {
  const s = mk();
  const long = 'x'.repeat(100000);
  sync(s, { notes: [{ ...note, title: '=IMPORTXML("http://x")' }, { ...note, id: 'n2', title: 'Long', body: long }] });
  assert.ok(s.sheets.get('#home').raw.includes('\'=IMPORTXML("http://x")'), 'written with a leading \' so the Sheet keeps it as text');
  assert.equal(sync(s).notes.find(n => n.id === 'n2').body.length, 100000);
});

// ---- home/sheet.js: reminders from the other apps, through Notes' own protocol ----
const TODAY = '2026-10-20';
const T0 = Date.parse('2026-10-20T15:00:00Z');
const phoneSync = (s, who = TOM) => sync(s, { window: 90, today: TODAY }, who);   // what a phone's Notes sends on opening
const openTodos = r => r.todos.filter(t => !t.done).map(t => t.title).sort();
const LIST_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#EF4444'];   // Notes' list colours (notes/app.js)

test('home/sheet.js: the read is a phone\'s empty sync, and adding builds reminders as Notes makes them', () => {
  const read = NB.read(TODAY);
  assert.deepEqual(read, { action: 'sync', v: 2, window: 90, today: TODAY, notes: [], todos: [], lists: [], graves: {} });
  const s = mk(), state = s.post(read, TOM);
  assert.deepEqual([state.lists, state.todos], [[], []]);
  const r = NB.add(state, { list: 'Groceries', items: [{ title: 'Milk', notes: '2 qt' }, { title: ' Eggs ' }, { title: '' }, { title: 'Milk' }] }, T0, TODAY);
  assert.deepEqual([r.added, r.already, r.reopened, r.ids.length], [2, 0, 0, 2], 'blank and repeated titles dropped');
  assert.deepEqual(r.list, { id: 'l3', name: 'Groceries' }, 'no Groceries list yet: made with Notes\' own sample id, so a phone still showing the samples has one Groceries');
  assert.deepEqual(r.body.lists, [{ id: 'l3', updated: T0, name: 'Groceries', color: '#10B981' }]);
  assert.deepEqual(Object.keys(r.body).sort(), ['action', 'graves', 'lists', 'notes', 'today', 'todos', 'v', 'window']);
  const milk = r.body.todos[0];
  assert.deepEqual(milk, { id: r.ids[0], list: 'l3', title: 'Milk', notes: '2 qt', date: null, time: null, prio: 0, flagged: false, done: false, doneAt: null, tags: [], created: T0, updated: T0 }, 'the shape of a reminder Notes\' quick add makes');
  assert.match(milk.id, /^t[0-9a-z]{8,16}$/);
  assert.equal(r.body.todos[1].title, 'Eggs');
  // the script takes it, as the person's own, and a phone opening Notes gets it in its Groceries list
  s.post(r.body, ELLA);
  const phone = phoneSync(s, TOM);
  assert.deepEqual(phone.lists.map(l => [l.id, l.name, l.by]), [['l3', 'Groceries', 'ella']]);
  assert.deepEqual(openTodos(phone), ['Eggs', 'Milk']);
  assert.equal(phone.todos[0].by, 'ella');
  assert.deepEqual(s.tab('✓ Groceries').slice(1).map(x => x.slice(0, 2)), [['Ella', 'Milk'], ['Ella', 'Eggs']]);
});

test('home/sheet.js: the same items again are the same ids, and nothing is sent or doubled; reopen unticks a finished one', () => {
  const s = mk();
  const first = NB.add(s.post(NB.read(TODAY), TOM), { list: 'Groceries', items: [{ title: 'Milk' }, { title: 'Eggs' }] }, T0, TODAY);
  s.post(first.body, TOM);
  const again = NB.add(s.post(NB.read(TODAY), TOM), { list: 'groceries', items: [{ title: 'milk' }, { title: 'Eggs' }, { title: 'Bread' }] }, T0 + 1000, TODAY);
  assert.deepEqual(again.ids.slice(0, 2), first.ids, 'ids from the list and the title, whatever the case');
  assert.deepEqual([again.added, again.already], [1, 2]);
  assert.deepEqual(again.body.todos.map(t => t.title), ['Bread'], 'only the new one goes');
  assert.deepEqual(again.body.lists, [], 'the list is there already: not sent again');
  s.post(again.body, TOM);
  assert.deepEqual(openTodos(phoneSync(s)), ['Bread', 'Eggs', 'Milk']);
  // a phone ticks Milk off; the list sent again leaves it ticked, unless reopen (Meals: bought last week, needed again)
  const milk = phoneSync(s).todos.find(t => t.title === 'Milk');
  s.post(sync(s, { todos: [{ ...milk, done: true, doneAt: T0 + 2000, updated: T0 + 2000 }] }), ELLA);
  const kept = NB.add(s.post(NB.read(TODAY), TOM), { list: 'Groceries', items: [{ title: 'Milk' }] }, T0 + 3000, TODAY);
  assert.deepEqual([kept.body, kept.already], [null, 1]);
  const re = NB.add(s.post(NB.read(TODAY), TOM), { list: 'Groceries', items: [{ title: 'Milk', notes: '1 gal' }], reopen: true }, T0 + 3000, TODAY);
  assert.deepEqual([re.added, re.already, re.reopened], [0, 0, 1]);
  assert.deepEqual([re.body.todos[0].id, re.body.todos[0].done, re.body.todos[0].doneAt, re.body.todos[0].notes, re.body.todos[0].updated], [milk.id, false, null, '1 gal', T0 + 3000]);
  s.post(re.body, TOM);
  const after = phoneSync(s).todos.find(t => t.id === milk.id);
  assert.deepEqual([after.done, after.by, after.list], [false, 'tom', 'l3'], 'open again, still whose it was, in its list');
  assert.equal(phoneSync(s).todos.filter(t => t.title === 'Milk').length, 1, 'never two');
});

test('home/sheet.js: a key gives an item its id (Orders: the order), a date and time travel, and the list is found by name or made', () => {
  const s = mk();
  const nope = NB.add(s.post(NB.read(TODAY), TOM), { list: 'Home', items: [{ title: 'Drop off the Amazon return', key: 'orders:return:o-abc', date: '2026-10-24', time: '09:00', notes: 'Amazon\nReturn number RMA1' }] }, T0, TODAY);
  const same = NB.add(s.post(NB.read(TODAY), TOM), { list: 'Home', items: [{ title: 'Drop off the Amazon return (edited)', key: 'orders:return:o-abc' }] }, T0 + 1, TODAY);
  assert.equal(same.ids[0], nope.ids[0], 'the key, not the words, is the id');
  assert.notEqual(NB.add(s.post(NB.read(TODAY), TOM), { list: 'Home', items: [{ title: 'x', key: 'orders:return:o-abd' }] }, T0, TODAY).ids[0], nope.ids[0]);
  assert.deepEqual([nope.body.todos[0].date, nope.body.todos[0].time, nope.body.todos[0].notes, nope.body.todos[0].list], ['2026-10-24', '09:00', 'Amazon\nReturn number RMA1', 'l2']);
  const bad = NB.add(s.post(NB.read(TODAY), TOM), { list: 'Home', items: [{ title: 'x', date: 'tomorrow', time: '9am' }] }, T0, TODAY);
  assert.deepEqual([bad.body.todos[0].date, bad.body.todos[0].time], [null, null], 'a date or time not in Notes\' form is left off');
  s.post(nope.body, TOM);
  const rep = NB.add(s.post(NB.read(TODAY), TOM), { list: 'Home', items: [{ title: 'y', key: 'orders:return:o-abc' }] }, T0 + 2, TODAY);
  assert.deepEqual([rep.body, rep.already, rep.ids], [null, 1, nope.ids], 'the same order again: nothing to send');
  assert.deepEqual(s.post({ action: 'due' }, { key: SECRET, who: 'notes-push' }).todos.map(t => [t.title, t.date, t.time]), [['Drop off the Amazon return', '2026-10-24', '09:00']], 'and Notes\' notifications know it');
  // a list the family named (any case), a Just-me list only as a last resort, a list of a new name made with an id of its own
  s.post(sync(s, { lists: [{ id: 'lx', name: 'School run', color: '#EC4899', updated: T0 }, { id: 'ly', name: 'Errands', color: '#EC4899', updated: T0, only: true }, { id: 'lz', name: 'Errands', color: '#06B6D4', updated: T0 }] }), TOM);
  const st = s.post(NB.read(TODAY), TOM);
  assert.equal(NB.list(st, 'school RUN', T0).list.id, 'lx');
  assert.equal(NB.list(st, 'Errands', T0).list.id, 'lz', 'the shared one first');
  const made = NB.list(st, 'Chores', T0);
  assert.equal(made.made, true); assert.match(made.list.id, /^l[0-9a-z]{8,16}$/); assert.equal(made.list.id, NB.list(st, 'chores', T0 + 9).list.id);
  assert.ok(LIST_COLORS.includes(made.list.color));
  // a phone still on the samples (Groceries as l3, maybe in Russian): found by the sample id when no name matches
  assert.equal(NB.list({ lists: [{ id: 'l3', name: 'Продукты', color: '#10B981', grocery: true }] }, 'Groceries', T0).list.name, 'Продукты');
});

test('home/sheet.js: ticking a reminder off (Calendar) sends it whole and newer; back on again; a missing one says so', () => {
  const s = mk();
  s.post(sync(s, { lists: [list], todos: [todo('t1', { date: TODAY, notes: 'About the tap', created: T0 - 10, updated: T0 - 10 })] }), TOM);
  let st = s.post(NB.read(TODAY), ELLA);
  const d = NB.done(st, 't1', true, T0, TODAY);
  assert.deepEqual([d.body.todos.length, d.body.todos[0].id, d.body.todos[0].done, d.body.todos[0].doneAt, d.body.todos[0].updated, d.body.todos[0].notes, d.body.todos[0].title], [1, 't1', true, T0, T0, 'About the tap', 'Milk']);
  assert.deepEqual([d.body.lists, d.body.notes, d.body.graves], [[], [], {}]);
  s.post(d.body, ELLA);
  let t = phoneSync(s, TOM).todos[0];
  assert.deepEqual([t.done, t.doneAt, t.by], [true, T0, 'tom'], 'done on Tom\'s phone too, still his');
  assert.equal(s.tab('✓ Groceries')[1][7], 'Yes');
  st = s.post(NB.read(TODAY), ELLA);
  assert.deepEqual(NB.done(st, 't1', true, T0 + 1, TODAY), { body: null, already: true });
  const u = NB.done(st, 't1', false, T0 + 5, TODAY);
  assert.deepEqual([u.body.todos[0].done, u.body.todos[0].doneAt, u.body.todos[0].updated], [false, null, T0 + 5]);
  s.post(u.body, ELLA);
  t = phoneSync(s, TOM).todos[0];
  assert.deepEqual([t.done, t.doneAt], [false, null]);
  assert.deepEqual(NB.done(st, 'nope', true, T0, TODAY), { body: null, why: 'not-found' });
  // a phone that had it open and syncs later: the Sheet's newer tick wins there (newest change wins)
  s.post(NB.done(s.post(NB.read(TODAY), TOM), 't1', true, T0 + 9, TODAY).body, TOM);
  const late = s.post(sync(s, { todos: [todo('t1', { date: TODAY, notes: 'About the tap', updated: T0 + 2 })], window: 90, today: TODAY }), ELLA);
  assert.equal(late.todos[0].done, true);
});

console.log(passed + ' tests passed');
