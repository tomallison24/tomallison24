// Runs improve/google-sheet-sync.gs in Node against an in-memory Sheet (the Drinks test's
// fake-sheet.mjs): who gets in (only aOS, with the phrase and who's asking), a first sync and the
// readable Improve tab with its Who column (open first, newest first, then the done ones), newest
// change winning, a deletion reaching the other phones, one Sheet for the family (everyone sees every
// item), only its own person (or the owner) changing or deleting one, rows with no by becoming the
// owner's, and nothing dated (every phone keeps every item; a range asks for nothing).
//   node improve/scripts/sheet-test.mjs
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
const item = (id, extra) => Object.assign({ id, text: 'The week view jumps when a sheet closes', kind: 'bug', app: 'drinks', status: 'open', added: '2026-11-01', at: T - 864e5, doneOn: '', updated: T + 1000 }, extra);
const mk = asAos => fakeSheet(GS, SECRET, asAos);
const ids = list => (list || []).map(x => x.id).sort();

test('answers a GET with its name; only aOS, with the phrase and who\'s asking, gets in', () => {
  const s = mk(TOM);
  assert.deepEqual(s.get(), { ok: true, app: 'allison-improve-sync', v: 1, aos: true });
  assert.equal(s.post({ action: 'sync' }, { key: 'nope', who: 'tom' }).error, 'wrong-secret');
  const old = s.post({ secret: SECRET, action: 'sync', items: [item('a1')] }, {});
  assert.equal(old.error, 'wrong-secret', 'a phone with the phrase in its request gets nothing');
  assert.equal(old.aos, true, 'and aOS can tell the phrase is wrong (not an old script)');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET }).error, 'who');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET, who: 'a b' }).error, 'who');
  assert.equal(s.post('not json').error, 'bad-request');
  assert.equal(fakeSheet(GS, 'CHANGE-ME').post({ action: 'sync' }, { key: 'CHANGE-ME', who: 'tom' }).error, 'secret-not-set');
  assert.deepEqual(s.post({ action: 'ping' }), { ok: true, app: 'allison-improve-sync', v: 1, aos: true });
  assert.equal(s.tab('_items'), null, 'nothing was written by any of those');
  // curly quotes and stray spaces in the phrase don't count against you
  assert.equal(fakeSheet(GS, "tom's-code").post({ action: 'sync', items: [] }, { key: ' tom’s-code ', who: 'tom' }).ok, true);
});

test('a first sync stores the items and builds the Improve tab: open first, newest first, then done; with Who', () => {
  const s = mk(TOM);
  const r = s.post({ action: 'sync', v: 1, window: 90, today: '2026-11-02', graves: {}, items: [
    item('a1', { text: 'Weather: the radar is slow to open', kind: 'improvement', app: 'weather', at: T - 3 * 864e5, added: '2026-10-30' }),
    item('a2', { text: '=HYPERLINK("http://x")', kind: 'idea', app: 'general', at: T - 864e5, added: '2026-11-01' }),
    item('a3', { text: 'Fixed thing', status: 'done', doneOn: '2026-11-02', app: 'aos', at: T - 5 * 864e5, added: '2026-10-28' }),
  ] });
  assert.equal(r.ok, true);
  assert.equal(r.by, 'tom');
  assert.deepEqual(r.people, { tom: 'Tom' });
  assert.deepEqual(ids(r.items), ['a1', 'a2', 'a3']);
  assert.ok(r.items.every(x => x.by === 'tom'), 'each is marked as Tom\'s');
  const w = s.tab('Improve');
  assert.deepEqual(w[0], ['Who', 'Added', 'Kind', 'App', 'Status', 'Text', 'Done on']);
  assert.deepEqual(w[1], ['Tom', '2026-11-01', 'Idea', 'General', 'Open', '=HYPERLINK("http://x")', '']);
  assert.deepEqual(w[2], ['Tom', '2026-10-30', 'Improvement', 'Weather', 'Open', 'Weather: the radar is slow to open', '']);
  assert.deepEqual(w[3], ['Tom', '2026-10-28', 'Bug', 'aOS', 'Done', 'Fixed thing', '2026-11-02']);
  assert.ok(s.sheets.get('Improve').raw.includes('\'=HYPERLINK("http://x")'), 'text that looks like a formula is kept as text');
  assert.ok(s.sheets.get('Improve').formats.has('1:@') && s.sheets.get('Improve').formats.has('7:@'), 'the dates kept as written');
  assert.ok(s.sheets.get('_items').hidden && s.sheets.get('_deleted').hidden && s.sheets.get('_people').hidden);
  assert.equal(s.tab('Sheet1'), null, 'the empty first tab is tidied away');
});

test('the newest change wins; a deletion reaches the other phones, and Undo brings it back', () => {
  const s = mk(TOM);
  s.post({ action: 'sync', items: [item('a1', { text: 'B', updated: T + 2000 }), item('a2')], graves: {} });
  let r = s.post({ action: 'sync', items: [item('a1', { text: 'A', updated: T + 1500 })], graves: {} });
  assert.equal(r.items.find(x => x.id === 'a1').text, 'B', 'an older copy does not win');
  r = s.post({ action: 'sync', items: [item('a1', { status: 'done', doneOn: '2026-11-02', updated: T + 3000 })], graves: {} });
  assert.equal(r.items.find(x => x.id === 'a1').status, 'done', 'marked done');
  r = s.post({ action: 'sync', items: [], graves: { 'items:a2': T + 4000 } });
  assert.deepEqual(ids(r.items), ['a1'], 'deleted');
  r = s.post({ action: 'sync', items: [item('a2')], graves: {} });
  assert.deepEqual(ids(r.items), ['a1'], 'a phone unchanged since hears of it and doesn\'t bring it back');
  assert.equal(r.graves['items:a2'], T + 4000);
  r = s.post({ action: 'sync', items: [item('a2', { updated: T + 5000 })], graves: {} });
  assert.deepEqual(ids(r.items), ['a1', 'a2'], 'Undo, stamped after the deletion');
  assert.equal(r.graves['items:a2'], undefined);
});

test('one Sheet for the family: everyone sees every item, each with whose it is', () => {
  const s = mk();
  s.post({ action: 'sync', items: [item('t1', { text: 'Tom\'s idea', kind: 'idea', app: 'general' })], graves: {} }, TOM);
  s.post({ action: 'sync', items: [item('e1', { text: 'Calendar shows the wrong week', app: 'calendar', only: true })], graves: {} }, ELLA);
  s.post({ action: 'sync', items: [item('m1', { text: 'Sparkle needs more unicorns', app: 'sparkle', kind: 'idea' })], graves: {} }, MAX);
  for (const who of [TOM, ELLA, MAX]) assert.deepEqual(ids(s.post({ action: 'sync', graves: {} }, who).items), ['e1', 'm1', 't1'], who.name + ' sees them all');
  const e = s.post({ action: 'sync', graves: {} }, MAX).items.find(x => x.id === 'e1');
  assert.equal(e.by, 'ella'); assert.equal(e.only, undefined, 'nothing is Just me here');
  assert.deepEqual(s.post({ action: 'sync', graves: {} }, MAX).people, { tom: 'Tom', ella: 'Ella', max: 'Max' }, 'the family\'s names, for whose an item is');
  const w = s.tab('Improve').slice(1).map(r => r[0] + ':' + r[3] + ':' + r[5]);
  assert.ok(w.includes('Ella:Calendar:Calendar shows the wrong week') && w.includes('Max:Sparkle Kingdom:Sparkle needs more unicorns') && w.includes('Tom:General:Tom\'s idea'), w.join('\n'));
});

test('only its own person, or the owner, changes or deletes an item; nobody else can', () => {
  const s = mk();
  s.post({ action: 'sync', items: [item('t1', { text: 'Tom\'s' })], graves: {} }, TOM);
  s.post({ action: 'sync', items: [item('e1', { text: 'Ella\'s' })], graves: {} }, ELLA);
  // Max changes Ella's and Tom's: nothing changes
  let m = s.post({ action: 'sync', items: [item('e1', { text: 'Max was here', updated: T + 9000 }), item('t1', { status: 'done', updated: T + 9000 })], graves: {} }, MAX);
  assert.equal(m.items.find(x => x.id === 'e1').text, 'Ella\'s');
  assert.equal(m.items.find(x => x.id === 't1').status, 'open');
  // nor can he delete them
  m = s.post({ action: 'sync', graves: { 'items:e1': T + 9999, 'items:t1': T + 9999 } }, MAX);
  assert.deepEqual(ids(m.items), ['e1', 't1']);
  assert.equal(m.graves['items:e1'], undefined);
  // Ella changes her own, and it stays hers
  let e = s.post({ action: 'sync', items: [item('e1', { text: 'Ella\'s, clearer', updated: T + 2000 })], graves: {} }, ELLA);
  assert.equal(e.items.find(x => x.id === 'e1').text, 'Ella\'s, clearer');
  // the owner marks Ella's done (he works through the log): it's done, and still Ella's
  const t = s.post({ action: 'sync', items: [item('e1', { text: 'Ella\'s, clearer', status: 'done', doneOn: '2026-11-02', updated: T + 3000 })], graves: {} }, TOM);
  assert.equal(t.items.find(x => x.id === 'e1').status, 'done');
  assert.equal(t.items.find(x => x.id === 'e1').by, 'ella');
  assert.equal(s.tab('Improve').slice(1).find(r => r[5] === 'Ella\'s, clearer')[0], 'Ella', 'the Who column still says Ella');
  // Ella's phone can't take someone else's id for a new item
  e = s.post({ action: 'sync', items: [item('t1', { text: 'Not hers', by: 'ella', updated: T + 9000 })], graves: {} }, ELLA);
  assert.equal(e.items.find(x => x.id === 't1').text, 'Tom\'s');
  assert.equal(e.items.find(x => x.id === 't1').by, 'tom');
  // the owner deletes Ella's; Max can't bring it back
  s.post({ action: 'sync', graves: { 'items:e1': T + 4000 } }, TOM);
  m = s.post({ action: 'sync', items: [item('e1', { updated: T + 5000 })], graves: {} }, MAX);
  assert.deepEqual(ids(m.items), ['t1'], 'gone, and not back from Max\'s phone');
  // Ella deletes her own new one
  s.post({ action: 'sync', items: [item('e2')], graves: {} }, ELLA);
  e = s.post({ action: 'sync', graves: { 'items:e2': T + 6000 } }, ELLA);
  assert.deepEqual(ids(e.items), ['t1']);
});

test('rows with no by are the owner\'s, and written down as theirs the first time the owner syncs', () => {
  const s = mk();
  s.post({ action: 'sync', items: [item('old1'), item('old2')], graves: {} }, { key: SECRET, who: 'nobody' });
  s.sheets.get('_items').cells = s.sheets.get('_items').cells.map((r, i) => i ? [r[0], r[1], JSON.stringify(Object.assign(JSON.parse(r[2]), { by: undefined }))] : r);
  s.sheets.get('_people').cells = [['id', 'name']];
  assert.deepEqual(ids(s.post({ action: 'sync', graves: {} }, ELLA).items), ['old1', 'old2'], 'everyone sees them');
  const t = s.post({ action: 'sync', graves: {} }, TOM);
  assert.ok(t.items.every(x => x.by === 'tom'), 'the owner\'s');
  assert.ok(s.tab('_items').slice(1).every(r => JSON.parse(r[2]).by === 'tom'), 'written down as Tom\'s');
  assert.deepEqual(s.tab('Improve').slice(1).map(r => r[0]), ['Tom', 'Tom'], 'the Who column says so');
  s.post({ action: 'sync', items: [item('old1', { text: 'Ella\'s edit', updated: T + 5000 })], graves: {} }, ELLA);
  assert.notEqual(s.post({ action: 'sync', graves: {} }, MAX).items.find(x => x.id === 'old1').text, 'Ella\'s edit', 'and only Tom changes them');
});

test('nothing is dated: every item goes to every phone, however old, and a range asks for none', () => {
  const s = mk(TOM);
  s.post({ action: 'sync', graves: {}, items: [item('new'), item('old', { added: '2024-01-05', at: Date.parse('2024-01-05T12:00:00Z') })] });
  const r = s.post({ action: 'sync', window: 90, today: '2026-11-02', graves: {} });
  assert.deepEqual(ids(r.items), ['new', 'old'], 'the old one too');
  const rg = s.post({ action: 'range', from: '2000-01-01', to: '2999-12-31' });
  assert.equal(rg.ok, true); assert.equal(rg.items, undefined); assert.equal(rg.graves, undefined);
  // a bad id is never kept
  s.post({ action: 'sync', graves: {}, items: [item('a b'), item('x'.repeat(80))] });
  assert.deepEqual(ids(s.post({ action: 'sync', graves: {} }).items), ['new', 'old']);
});

console.log('\n' + n + ' tests passed');
