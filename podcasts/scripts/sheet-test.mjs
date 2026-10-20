// Runs podcasts/google-sheet-sync.gs in Node against an in-memory Sheet (the Drinks test's fake-sheet.mjs),
// reached as aOS reaches it (functions/sheet/api: ?key=&who=&name=&owner=): who gets in; a first sync and
// the readable Shows, Saved and History tabs, each with Who; two phones of one person kept the same (an
// unfollow reaching the other, Undo bringing it back, the newest change winning); each person getting only
// their own, and two people following the same show without touching each other's; a VERSION 1 Sheet's rows
// (the one-way backup's) becoming the owner's; the 90 days and older History on asking; and text from a
// podcast feed kept as text.
//   node podcasts/scripts/sheet-test.mjs
import assert from 'assert/strict';
import path from 'path';
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';

const GS = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'google-sheet-sync.gs');
const SECRET = 'test-secret-phrase';
// what aOS adds to every request (functions/sheet/api): the phrase, and who's asking
const TOM = { key: SECRET, who: 'tom', name: 'Tom', owner: '1' }, ELLA = { key: SECRET, who: 'ella', name: 'Ella' };
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const T = Date.now();   // stamps near now: graves older than 400 days are dropped
const P = Date.parse('2026-10-05T18:30:00Z');
// as the app sends them (podcasts/app.js, SYNC)
const show = (id, extra) => Object.assign({ id, feed: 'https://example.com/' + id + '.xml', title: 'Show ' + id, author: 'An Author', art: '', genre: 'News', at: P, updated: T + 1 }, extra);
const ep = (k, extra) => Object.assign({ id: 'a|' + k, k: 'a|' + k, sid: 'a', t: 'Episode ' + k, d: P - 86400e3, u: 'https://example.com/' + k + '.mp3', v: false, dur: 3725, img: '', st: 'Show a', sa: '', feed: 'https://example.com/a.xml', link: 'https://example.com/ep/' + k, s: '', sn: 0, en: 0, x: '', updated: T + 1 }, extra);
const played = (k, date, extra) => ep(k, Object.assign({ pl: Date.parse(date + 'T18:30:00Z'), date }, extra));
const prog = (k, date, extra) => Object.assign({ id: 'a|' + k, t: 600, d: 3725, p: false, at: Date.parse(date + 'T18:40:00Z'), date, updated: T + 1 }, extra);
const sync = (s, body, who = TOM) => s.post(Object.assign({ action: 'sync', v: 2, shows: [], saved: [], hist: [], prog: [], graves: {} }, body), who);
const mk = () => fakeSheet(GS, SECRET);
const col = (s, tab, c) => s.tab(tab).slice(1).map(r => r[c]);
const ids = list => list.map(x => x.id).sort();

test('answers a GET with its name; only aOS, with the phrase and who\'s asking, gets in', () => {
  const s = mk();
  assert.deepEqual(s.get(), { ok: true, app: 'allison-podcasts-sync', v: 2, aos: true });
  assert.equal(s.post({ action: 'sync' }, { key: 'nope', who: 'tom' }).error, 'wrong-secret');
  assert.equal(s.post({ secret: SECRET, action: 'sync', device: 'p0', follows: [] }, {}).error, 'wrong-secret', 'a phone with the phrase in its request, as before aOS, gets nothing');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET }).error, 'who');
  assert.equal(s.post({ action: 'sync' }, { key: SECRET, who: 'a b' }).error, 'who');
  assert.equal(s.post('not json', TOM).error, 'bad-request');
  assert.equal(fakeSheet(GS, 'CHANGE-ME').post({ action: 'sync' }, { key: 'CHANGE-ME', who: 'tom' }).error, 'secret-not-set');
  assert.deepEqual(s.post({ action: 'ping' }, TOM), { ok: true, app: 'allison-podcasts-sync', v: 2, aos: true });
  assert.equal(fakeSheet(GS, "tom's-code").post({ action: 'sync' }, { key: ' tom’s-code ', who: 'tom' }).ok, true, 'curly quotes and stray spaces don\'t count');
});

test('a first sync keeps everything, sends it back, and builds Shows, Saved and History with Who', () => {
  const s = mk();
  const r = sync(s, { shows: [show('b', { title: 'Beta Show' }), show('a', { title: 'Alpha Show' })], saved: [ep('e1', { at: P })],
    hist: [played('e2', '2026-10-05'), played('e3', '2026-10-06')], prog: [prog('e2', '2026-10-05', { p: true, t: 0 }), prog('e3', '2026-10-06', { t: 905 })] });
  assert.equal(r.ok, true); assert.equal(r.aos, true); assert.equal(r.by, 'tom');
  assert.deepEqual([r.shows.length, r.saved.length, r.hist.length, r.prog.length], [2, 1, 2, 2]);
  assert.ok(r.shows.every(x => x.by === 'tom'), 'each kept as Tom\'s');
  assert.deepEqual(r.graves, {});
  assert.deepEqual(s.tab('Shows')[0], ['Who', 'Show', 'Author', 'Genre', 'Following since', 'Feed link']);
  assert.deepEqual(s.tab('Shows').slice(1), [['Tom', 'Alpha Show', 'An Author', 'News', '2026-10-05', 'https://example.com/a.xml'], ['Tom', 'Beta Show', 'An Author', 'News', '2026-10-05', 'https://example.com/b.xml']]);
  assert.deepEqual(s.tab('Saved')[1].slice(0, 6), ['Tom', 'Show a', 'Episode e1', '2026-10-04', '1:02', '2026-10-05']);
  assert.deepEqual(s.tab('History')[0], ['Who', 'Played', 'Show', 'Episode', 'Published', 'Length', 'Where you got to', 'Episode page', 'EpisodeID']);
  assert.deepEqual(col(s, 'History', 3), ['Episode e3', 'Episode e2'], 'newest first');
  assert.deepEqual(s.tab('History')[1].slice(0, 2), ['Tom', '2026-10-06 18:30']);
  assert.deepEqual(col(s, 'History', 6), ['15:05 of 1:02:05', 'Finished'], 'where you got to');
  assert.deepEqual(col(s, '_shows', 0), ['tom/b', 'tom/a'], 'the hidden rows say whose they are');
  for (const t of ['_shows', '_saved', '_history', '_progress', '_deleted', '_people']) assert.equal(s.sheets.get(t).hidden, true, t + ' is hidden');
  assert.equal(s.tab('Sheet1'), null, 'the empty first tab is tidied away');
});

test('your phones are kept the same: an unfollow reaches the other, Undo brings it back, the newest change wins', () => {
  const s = mk();
  sync(s, { shows: [show('a'), show('b')], saved: [ep('e1')] });
  // phone 2: says nothing yet, gets both
  let r = sync(s, {});
  assert.deepEqual(ids(r.shows), ['a', 'b']); assert.deepEqual(ids(r.saved), ['a|e1']);
  // phone 1 unfollows b and unsaves e1
  r = sync(s, { shows: [show('a')], graves: { 'shows:b': T + 50, 'saved:a|e1': T + 50 } });
  assert.deepEqual(ids(r.shows), ['a']); assert.deepEqual(r.saved, []);
  assert.deepEqual(r.graves, { 'shows:b': T + 50, 'saved:a|e1': T + 50 });
  assert.deepEqual(col(s, 'Shows', 1), ['Show a'], 'gone from the readable tab too');
  // phone 2 still has b, unchanged since before: it stays gone
  r = sync(s, { shows: [show('a'), show('b')], saved: [ep('e1')] });
  assert.deepEqual(ids(r.shows), ['a']);
  // Undo (or followed again) on phone 1: stamped after the unfollow
  r = sync(s, { shows: [show('a'), show('b', { updated: T + 60 })] });
  assert.deepEqual(ids(r.shows), ['a', 'b']); assert.equal(r.graves['shows:b'], undefined);
  // the newest change wins, from either phone
  sync(s, { prog: [prog('e1', '2026-10-05', { t: 900, updated: T + 100 })] });
  r = sync(s, { prog: [prog('e1', '2026-10-05', { t: 300, updated: T + 90 })] });
  assert.equal(r.prog[0].t, 900, 'an older copy does not win');
  r = sync(s, { prog: [prog('e1', '2026-10-05', { p: true, t: 0, updated: T + 200 })] });
  assert.equal(r.prog[0].p, true);
});

test('one Sheet for the family: each gets only their own; the same show followed by two people is two rows; nobody changes or deletes another\'s', () => {
  const s = mk();
  sync(s, { shows: [show('a'), show('shared', { title: 'Shared Show' })], saved: [ep('e1')], hist: [played('e2', '2026-10-05')] }, TOM);
  let e = sync(s, { shows: [show('shared', { title: 'Shared Show' }), show('c')] }, ELLA);
  assert.deepEqual(ids(e.shows), ['c', 'shared'], 'Ella gets hers: her own follow of the shared show too');
  assert.deepEqual([e.saved, e.hist], [[], []], 'and none of Tom\'s');
  assert.ok(e.shows.every(x => x.by === 'ella'));
  // Ella's phone unfollowing the shared show, and sending Tom's ids (by mistake or not), touches only hers
  e = sync(s, { shows: [show('c'), show('a', { title: 'Hacked', updated: T + 9999 })], graves: { 'shows:shared': T + 50, 'saved:a|e1': T + 50, 'hist:a|e2': T + 50 } }, ELLA);
  assert.deepEqual(ids(e.shows), ['a', 'c'], 'her own row for show a');
  const t = sync(s, {}, TOM);
  assert.deepEqual(ids(t.shows), ['a', 'shared'], 'Tom still follows the shared show');
  assert.equal(t.shows.find(x => x.id === 'a').title, 'Show a', 'his show a unchanged');
  assert.equal(t.saved.length, 1); assert.equal(t.hist.length, 1);
  assert.deepEqual(t.graves, {}, 'nor does he see her deletions');
  assert.deepEqual(Object.keys(e.graves).sort(), ['hist:a|e2', 'saved:a|e1', 'shows:shared'], 'she sees hers');
  // the Who column
  assert.deepEqual(s.tab('Shows').slice(1).map(r => r[0] + ':' + r[1]), ['Ella:Hacked', 'Ella:Show c', 'Tom:Shared Show', 'Tom:Show a']);
  assert.deepEqual(col(s, 'History', 0), ['Tom']);
  assert.deepEqual(s.tab('_people').slice(1), [['(owner)', 'tom'], ['tom', 'Tom'], ['ella', 'Ella']]);
});

test('a VERSION 1 Sheet: its rows (from the one-way backup, several phones added together) become the owner\'s', () => {
  const s = mk();
  // the hidden tabs made (a first request), then filled as VERSION 1 left them: id, since, data; no by, no updated
  sync(s, {}, { key: SECRET, who: 'nobody', name: 'Nobody' });
  s.sheets.get('_people').cells = [['id', 'name']];
  const row = (id, it) => [id, it.first || 0, JSON.stringify(it)];
  const dev = on => ({ p1: on ? P : 0, p2: 0 });   // which phones had it (0: not any more)
  const tab = (name, rows) => { s.sheets.get(name).cells = [['id', 'since', 'data']].concat(rows); };
  tab('_shows', [row('s1', { id: 's1', feed: 'https://example.com/s1.xml', title: 'Old Show', author: 'A', genre: 'News', first: P, dev: dev(true) }),
    row('s2', { id: 's2', feed: 'https://example.com/s2.xml', title: 'Unfollowed Show', author: 'A', genre: 'News', first: P, dev: dev(false) })]);
  tab('_saved', [row('s1|g1', { k: 's1|g1', show: 'Old Show', title: 'Kept', pub: P, dur: 60, link: 'https://example.com/g1', url: 'https://example.com/g1.mp3', feed: '', first: P, dev: dev(true) }),
    row('s1|g2', { k: 's1|g2', show: 'Old Show', title: 'Unsaved', pub: P, dur: 60, link: '', url: 'https://example.com/g2.mp3', feed: '', first: P, dev: dev(false) })]);
  tab('_history', [row('s1|g3', { k: 's1|g3', show: 'Old Show', title: 'Played long ago', pub: P, dur: 60, link: '', url: 'https://example.com/g3.mp3', feed: '', played: Date.parse('2026-01-02T10:00:00Z'), first: P }),
    row('s1|g4', { k: 's1|g4', show: 'Old Show', title: 'Played lately', pub: P, dur: 60, link: '', url: 'https://example.com/g4.mp3', feed: '', played: Date.parse('2026-10-10T10:00:00Z'), first: P })]);
  assert.deepEqual(sync(s, {}, ELLA).shows, [], 'not Ella\'s');
  const r = sync(s, { window: 90, today: '2026-10-20' }, TOM);
  assert.deepEqual(r.shows.map(x => [x.id, x.title, x.by, x.updated]), [['s1', 'Old Show', 'tom', 0]], 'the followed one, the owner\'s, and any phone\'s own copy wins over it');
  assert.deepEqual(r.saved.map(x => [x.id, x.k, x.sid, x.t, x.u, x.st]), [['s1|g1', 's1|g1', 's1', 'Kept', 'https://example.com/g1.mp3', 'Old Show']], 'in the app\'s shape');
  assert.deepEqual(r.hist.map(x => [x.id, x.date]), [['s1|g4', '2026-10-10']], 'the last 90 days of History');
  assert.deepEqual(s.post({ action: 'range', from: '2026-01-01', to: '2026-07-22' }, TOM).hist.map(x => x.t), ['Played long ago'], 'and the rest on asking');
  assert.ok(s.tab('_history').slice(1).every(r => r[0].startsWith('tom/') && JSON.parse(r[2]).by === 'tom'), 'written down as Tom\'s, in the new shape');
  assert.deepEqual(col(s, 'History', 0), ['Tom', 'Tom']);
  // a phone's own copy wins over the converted row
  const r2 = sync(s, { shows: [show('s1', { title: 'Old Show', art: 'https://example.com/art.png', updated: 1 })] }, TOM);
  assert.equal(r2.shows[0].art, 'https://example.com/art.png');
  assert.deepEqual(sync(s, {}, ELLA).shows, [], 'still not Ella\'s');
});

test('the phone keeps 90 days of History: older plays stay here, and come back when asked for', () => {
  const s = mk();
  sync(s, { shows: [show('a')], saved: [ep('old-saved', { at: Date.parse('2025-01-01T00:00:00Z') })],
    hist: [played('new', '2026-10-01'), played('old', '2026-05-01')], prog: [prog('new', '2026-10-01'), prog('old', '2026-05-01', { p: true })] }, TOM);
  sync(s, { hist: [played('ellas-old', '2026-05-02')] }, ELLA);
  const r = sync(s, { window: 90, today: '2026-10-20' }, TOM);
  assert.deepEqual(ids(r.hist), ['a|new']); assert.deepEqual(ids(r.prog), ['a|new']);
  assert.equal(r.shows.length, 1, 'undated: always all of them'); assert.equal(r.saved.length, 1);
  const old = s.post({ action: 'range', from: '2025-10-20', to: '2026-07-22' }, TOM);
  assert.deepEqual(ids(old.hist), ['a|old']); assert.deepEqual(ids(old.prog), ['a|old']);
  assert.equal(old.shows, undefined, 'a range is only dated rows'); assert.equal(old.graves, undefined);
  assert.deepEqual(ids(s.post({ action: 'range', from: '2025-10-20', to: '2026-07-22' }, ELLA).hist), ['a|ellas-old'], 'and only yours');
  // the window counts back from the phone's today: 90 days, today included
  assert.deepEqual(ids(sync(s, { window: 90, today: '2026-12-30' }, TOM).hist), [], 'on 2026-12-30, 2026-10-01 is the 91st day back');
  assert.deepEqual(ids(sync(s, { window: 90, today: '2026-12-29' }, TOM).hist), ['a|new'], 'and on 2026-12-29 the 90th');
});

test('text from a feed stays text, only web links are written, and a damaged item is skipped', () => {
  const s = mk();
  const r = sync(s, { shows: [show('a', { title: '=HYPERLINK("https://evil.example","Free")' }), null, { id: 5 }, 'x', show('b', { feed: 'javascript:alert(1)' })],
    hist: [played('x', '2026-10-05', { t: '+cmd|calc', link: 'javascript:alert(1)' }), { nope: 1 }], graves: { 'nope:1': T, 'shows': T } });
  assert.equal(r.ok, true); assert.equal(r.shows.length, 2); assert.equal(r.hist.length, 1);
  assert.ok(s.sheets.get('Shows').raw.includes("'=HYPERLINK(\"https://evil.example\",\"Free\")"), 'written with the text marker');
  assert.equal(col(s, 'Shows', 5).includes('javascript:alert(1)'), false, 'only web links in the readable tabs');
  assert.ok(s.sheets.get('History').raw.includes("'+cmd|calc"));
  assert.equal(col(s, 'History', 7)[0], '');
  assert.deepEqual(r.graves, {}, 'no grave for a kind that isn\'t one');
});

console.log(n + ' tests passed');
