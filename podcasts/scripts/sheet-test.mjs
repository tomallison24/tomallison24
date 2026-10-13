// Runs podcasts/google-sheet-sync.gs in Node against an in-memory Sheet (the Drinks test's fake-sheet.mjs):
// the secret check, a first backup, two phones adding together and never overwriting each other, an
// unfollow reading "No" only when no phone follows the show any more, History that never shrinks, and
// text from a podcast feed kept as text.
//   node podcasts/scripts/sheet-test.mjs
import assert from 'assert/strict';
import path from 'path';
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';

const GS = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'google-sheet-sync.gs');
const SECRET = 'test-secret-phrase';
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const T = Date.parse('2026-10-05T18:30:00Z');
const show = (id, extra) => Object.assign({ id, feed: 'https://example.com/' + id + '.xml', title: 'Show ' + id, author: 'An Author', genre: 'News', at: T }, extra);
const ep = (k, extra) => Object.assign({ k, sid: 'a', show: 'Show a', t: 'Episode ' + k, d: T - 86400e3, dur: 3725, u: 'https://example.com/' + k + '.mp3', link: 'https://example.com/ep/' + k }, extra);
const sync = (s, body) => s.post(Object.assign({ secret: SECRET, action: 'sync', device: 'phone1', follows: [], saved: [], hist: [] }, body));
const mk = () => fakeSheet(GS, SECRET);
const col = (s, tab, c) => s.tab(tab).slice(1).map(r => r[c]);

test('answers a GET with its name, and refuses a wrong or unset secret', () => {
  const s = mk();
  assert.deepEqual(s.get(), { ok: true, app: 'allison-podcasts-sync', v: 1 });
  assert.equal(s.post({ secret: 'nope', action: 'sync' }).error, 'wrong-secret');
  assert.equal(s.post('not json').error, 'bad-request');
  assert.equal(fakeSheet(GS, 'CHANGE-ME').post({ secret: 'CHANGE-ME', action: 'sync' }).error, 'secret-not-set');
});

test('a first backup builds Shows, Saved and History, readable', () => {
  const s = mk();
  const r = sync(s, { follows: [show('b', { title: 'Beta Show' }), show('a', { title: 'Alpha Show' })], saved: [ep('e1')], hist: [ep('e2', { played: T }), ep('e3', { played: T + 60e3 })] });
  assert.deepEqual([r.ok, r.shows, r.saved, r.history], [true, 2, 1, 2]);
  assert.deepEqual(s.tab('Shows')[0], ['Show', 'Author', 'Genre', 'Following', 'Feed link', 'First followed']);
  assert.deepEqual(col(s, 'Shows', 0), ['Alpha Show', 'Beta Show'], 'alphabetical');
  assert.equal(col(s, 'Shows', 3)[0], 'Yes');
  const saved = s.tab('Saved')[1];
  assert.deepEqual(saved.slice(0, 5), ['Show a', 'Episode e1', '2026-10-04', '1:02', 'Yes']);
  assert.deepEqual(col(s, 'History', 2), ['Episode e3', 'Episode e2'], 'newest first');
  assert.equal(s.tab('History')[1][0], '2026-10-05 18:31');
});

test('a repeat backup changes nothing; an episode listened to again moves its time on without a second row', () => {
  const s = mk();
  const body = { follows: [show('a')], saved: [ep('e1')], hist: [ep('e2', { played: T })] };
  sync(s, body);
  const before = JSON.stringify([...s.sheets.keys()].map(k => s.tab(k)));
  sync(s, body);
  assert.equal(JSON.stringify([...s.sheets.keys()].map(k => s.tab(k))), before);
  sync(s, { hist: [ep('e2', { played: T + 3600e3 })] });
  assert.equal(s.tab('History').length, 2); assert.equal(s.tab('History')[1][0], '2026-10-05 19:30');
});

test('history never shrinks: the app trims its list, the Sheet keeps every episode', () => {
  const s = mk();
  sync(s, { hist: [ep('old1', { played: T }), ep('old2', { played: T + 1000 })] });
  sync(s, { hist: [ep('new1', { played: T + 5000 })] });
  assert.equal(s.tab('History').length, 4);
  sync(s, { hist: [] });
  assert.equal(s.tab('History').length, 4);
});

test('an unfollow reads No, a saved episode removed reads No, and both stay listed', () => {
  const s = mk();
  sync(s, { follows: [show('a'), show('b')], saved: [ep('e1'), ep('e2')] });
  sync(s, { follows: [show('a')], saved: [ep('e1')] });
  const shows = Object.fromEntries(s.tab('Shows').slice(1).map(r => [r[0], r[3]]));
  assert.deepEqual(shows, { 'Show a': 'Yes', 'Show b': 'No' });
  const saved = Object.fromEntries(s.tab('Saved').slice(1).map(r => [r[1], r[4]]));
  assert.deepEqual(saved, { 'Episode e1': 'Yes', 'Episode e2': 'No' });
  sync(s, { follows: [show('a'), show('b')], saved: [ep('e1')] });
  assert.equal(s.tab('Shows').slice(1).find(r => r[0] === 'Show b')[3], 'Yes', 'followed again');
});

test('two phones add together: one stopping does not unfollow the show for the other', () => {
  const s = mk();
  sync(s, { device: 'phone1', follows: [show('a'), show('b')] });
  sync(s, { device: 'phone2', follows: [show('b'), show('c')] });
  assert.deepEqual(col(s, 'Shows', 0).sort(), ['Show a', 'Show b', 'Show c']);
  sync(s, { device: 'phone1', follows: [show('a')] });          // phone 1 stops following b
  let f = Object.fromEntries(s.tab('Shows').slice(1).map(r => [r[0], r[3]]));
  assert.deepEqual(f, { 'Show a': 'Yes', 'Show b': 'Yes', 'Show c': 'Yes' }, 'phone 2 still follows b');
  sync(s, { device: 'phone2', follows: [show('c')] });
  f = Object.fromEntries(s.tab('Shows').slice(1).map(r => [r[0], r[3]]));
  assert.equal(f['Show b'], 'No');
});

test('text from a feed is kept as text; a damaged item is skipped; limits hold', () => {
  const s = mk();
  const r = sync(s, { follows: [show('a', { title: '=HYPERLINK("https://evil.example","Free")' }), null, { id: 5 }, show('b', { feed: 'javascript:alert(1)' })], hist: [ep('x', { t: '+cmd|calc', played: T }), { nope: 1 }] });
  assert.equal(r.ok, true); assert.equal(r.shows, 2); assert.equal(r.history, 1);
  const sheet = s.sheets.get('Shows');
  assert.ok(sheet.raw.includes("'=HYPERLINK(\"https://evil.example\",\"Free\")"), 'written with the text marker');
  assert.equal(col(s, 'Shows', 4).includes('javascript:alert(1)'), false, 'only web links are kept');
  assert.ok(s.sheets.get('History').raw.includes("'+cmd|calc"));
  assert.equal(s.sheets.get('_shows').hidden, true);
});

console.log(n + ' tests passed');
