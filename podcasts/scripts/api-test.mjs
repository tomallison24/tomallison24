// Checks functions/podcasts/api/[[route]].js (the feed fetcher) in plain Node, with Apple, Podcast
// Index and Cloudflare's cache stubbed out: Search when Apple turns the site away ("429"), from
// Podcast Index once its key is set, from the copy kept at Cloudflare, or the busy message; the Top
// shows chart kept the same way; and Podcast Index's signed headers. And the tags (POST tags), with a
// stand-in for Anthropic's API and Workers KV and real sessions from server/auth.js: signed in only,
// tags from the list only, for the shows asked about only, and the daily count. Podcast Index's answer is shaped
// as its documentation shows (search/byterm: feeds with url, artwork, itunesId, categories); the
// real services were not called.
//
//   node podcasts/scripts/api-test.mjs
import assert from 'assert/strict';
import { createHash } from 'crypto';
import { issue, putJSON } from '../../server/auth.js';

const { onRequestGet, onRequestPost, TAGS, TAG_MODEL, TAG_MAX, TAG_DAILY } = await import('../../functions/podcasts/api/[[route]].js');

const store = new Map();
globalThis.caches = { default: {
  match: async req => { const r = store.get(req.url); return r ? r.clone() : undefined; },
  put: async (req, res) => { store.set(req.url, res.clone()); },
} };
let calls = [], answer = () => new Response('{}');
globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), headers: init.headers || {} }); if (init.body) globalThis.__lastBody = init.body; return answer(String(url)); };
const jsonRes = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });

const KEYS = { PODCASTINDEX_KEY: 'PIKEY', PODCASTINDEX_SECRET: 'pisecret' };
const call = async (path, env = {}) => {
  const pending = [];
  const res = await onRequestGet({ request: new Request('https://site.example/podcasts/api/' + path, { headers: { 'X-Podcasts': '1' } }),
    params: { route: path.split('?')[0].split('/') }, env, waitUntil: p => pending.push(p) });
  await Promise.all(pending);
  return { status: res.status, body: await res.json() };
};
const apple = { collectionId: 1, collectionName: 'Apple Show', artistName: 'A', feedUrl: 'https://feeds.example.com/a', artworkUrl600: 'https://img.example.com/a.jpg', primaryGenreName: 'News' };
const pi = { id: 77, title: 'Index Show', author: 'B', url: 'https://feeds.example.com/b', artwork: 'https://img.example.com/b.jpg', itunesId: 2, categories: { 9: 'Comedy' }, episodeCount: 12 };
const isApple = u => u.startsWith('https://itunes.apple.com/');
const isIndex = u => u.startsWith('https://api.podcastindex.org/');
let n = 0;
const test = async (name, fn) => { store.clear(); calls = []; await fn(); n++; console.log('ok -', name); };

await test('Search: Apple answers, and the answer is kept', async () => {
  answer = u => isApple(u) ? jsonRes({ results: [apple] }) : jsonRes({}, 500);
  const r = await call('search?term=Apple&cc=us', KEYS);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.results.map(s => s.title), ['Apple Show']);
  assert.ok(!calls.some(c => isIndex(c.url)), 'Podcast Index is only asked when Apple fails');
  calls = [];
  answer = () => jsonRes({}, 429);
  const again = await call('search?term=apple&cc=us', KEYS);
  assert.deepEqual(again.body.results.map(s => s.title), ['Apple Show'], 'the same search (any case) comes from the kept copy');
  assert.equal(calls.length, 0, 'nobody is asked again while it is fresh');
});

await test('Search: Apple says 429, Podcast Index answers, signed as its API asks', async () => {
  answer = u => isApple(u) ? jsonRes({}, 429) : isIndex(u) ? jsonRes({ status: 'true', feeds: [pi, { ...pi, title: 'Dead', dead: 1 }, { title: 'No feed' }] }) : jsonRes({}, 500);
  const r = await call('search?term=index&cc=us', KEYS);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.results, [{ id: '2', title: 'Index Show', author: 'B', feed: 'https://feeds.example.com/b', art: 'https://img.example.com/b.jpg', genre: 'Comedy', count: 12 }]);
  const asked = calls.find(c => isIndex(c.url));
  assert.equal(asked.url, 'https://api.podcastindex.org/api/1.0/search/byterm?max=30&q=index');
  const h = asked.headers, date = h['X-Auth-Date'];
  assert.equal(h['X-Auth-Key'], 'PIKEY');
  assert.match(date, /^\d{10}$/);
  assert.ok(Math.abs(Number(date) - Date.now() / 1000) < 5);
  assert.equal(h.Authorization, createHash('sha1').update('PIKEY' + 'pisecret' + date).digest('hex'));
  assert.ok(h['User-Agent']);
});

await test('Search: Apple finds nothing, Podcast Index is asked too', async () => {
  answer = u => isApple(u) ? jsonRes({ results: [] }) : jsonRes({ feeds: [pi] });
  assert.deepEqual((await call('search?term=rare', KEYS)).body.results.map(s => s.title), ['Index Show']);
});

await test('Search: Apple says 429 and there is no Podcast Index key: the busy message, not "429"', async () => {
  answer = u => isApple(u) ? jsonRes({}, 429) : jsonRes({}, 500);
  const r = await call('search?term=busy&cc=us');
  assert.equal(r.status, 502);
  assert.match(r.body.error, /busy right now.*RSS link/);
  assert.doesNotMatch(r.body.error, /429/);
  assert.ok(!calls.some(c => isIndex(c.url)), 'no key: Podcast Index is not asked');
});

await test('Search: nothing found anywhere is an empty list, and not kept', async () => {
  answer = u => isApple(u) ? jsonRes({ results: [] }) : jsonRes({ feeds: [] });
  const r = await call('search?term=zzzz', KEYS);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.results, []);
  assert.equal(store.size, 0);
});

await test('Search: both refuse, an older kept copy is used', async () => {
  answer = u => isApple(u) ? jsonRes({ results: [apple] }) : jsonRes({}, 500);
  await call('search?term=old&cc=us', KEYS);
  const [k] = store.keys(), kept = await store.get(k).json();
  store.set(k, jsonRes({ ...kept, at: Date.now() - 3 * 86400e3 }));   // three days old: past fresh
  answer = () => jsonRes({}, 429);
  const r = await call('search?term=old&cc=us', KEYS);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.results.map(s => s.title), ['Apple Show']);
});

await test('Top shows: kept, and an older copy used when Apple refuses', async () => {
  answer = u => u.startsWith('https://rss.applemarketingtools.com/') ? jsonRes({ feed: { results: [{ id: '1' }] } })
    : u.includes('/lookup?') ? jsonRes({ results: [apple] }) : jsonRes({}, 500);
  assert.deepEqual((await call('top?cc=us')).body.results.map(s => s.title), ['Apple Show']);
  calls = [];
  assert.deepEqual((await call('top?cc=us')).body.results.map(s => s.title), ['Apple Show']);
  assert.equal(calls.length, 0, 'fresh for six hours');
  const [k] = store.keys(), kept = await store.get(k).json();
  store.set(k, jsonRes({ ...kept, at: Date.now() - 7 * 3600e3 }));
  answer = () => jsonRes({}, 429);
  assert.deepEqual((await call('top?cc=us')).body.results.map(s => s.title), ['Apple Show']);
});

await test('Top shows: Apple refuses and nothing is kept: an error, as before', async () => {
  answer = () => jsonRes({}, 429);
  const r = await call('top?cc=us');
  assert.equal(r.status, 502);
  assert.match(r.body.error, /429/);
});

await test('still refuses requests without the app header', async () => {
  const res = await onRequestGet({ request: new Request('https://site.example/podcasts/api/search?term=x'), params: { route: ['search'] }, env: KEYS });
  assert.equal(res.status, 404);
});

// ---- tags ----
const fakeKV = () => { const m = new Map(); return { m, get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, String(v)); }, delete: async k => { m.delete(k); } }; };
const db = fakeKV();
await db.put('owner', 'u1');
await putJSON(db, 'user:u1', { id: 'u1', name: 'Sam', role: 'owner', creds: [] });
const tok = await issue(db, 'u1');
const ENV = { ACCOUNTS: db, ANTHROPIC_API_KEY: 'ak' };
const post = async (body, { env = ENV, t = tok, header = true } = {}) => {
  const h = { 'Content-Type': 'application/json' }; if (header) h['X-Podcasts'] = '1'; if (t) h.Authorization = 'Bearer ' + t;
  const res = await onRequestPost({ request: new Request('https://site.example/podcasts/api/tags', { method: 'POST', headers: h, body: JSON.stringify(body) }), params: { route: ['tags'] }, env });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const claude = text => () => jsonRes({ content: [{ type: 'text', text }] });
const two = { shows: [{ id: 'a1', title: 'Song Exploder', author: 'Hrishikesh Hirway', genre: 'Music', desc: 'Musicians take apart their songs.' }, { id: 'b2', title: 'The Daily', genre: 'News' }] };

await test('tags: Claude picks from the list, for the shows asked about only', async () => {
  answer = claude('Here you go: {"a1": ["music", "Talk", "Jazz"], "b2": ["News", "News", "Politics", "Society"], "zz": ["Comedy"]}');
  const r = await post(two);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.tags, { a1: ['Music', 'Talk'], b2: ['News', 'Society'] }, 'known tags, any case, no repeats, at most two, nothing for a show not asked about');
  const asked = calls.find(c => c.url === 'https://api.anthropic.com/v1/messages');
  assert.equal(asked.headers['x-api-key'], 'ak');
  const sent = JSON.parse(globalThis.__lastBody);
  assert.equal(sent.model, TAG_MODEL);
  for (const t of TAGS) assert.ok(sent.system.includes(t), 'the list is in the instructions: ' + t);
  assert.deepEqual(JSON.parse(sent.messages[0].content).map(x => x.id), ['a1', 'b2']);
  assert.equal(JSON.parse(sent.messages[0].content)[0].about, 'Musicians take apart their songs.');
});

await test('tags: signed in only, the app header only, a key needed', async () => {
  answer = claude('{}');
  assert.equal((await post(two, { t: '' })).status, 401);
  assert.equal((await post(two, { t: 'nonsense' })).status, 401);
  assert.equal((await post(two, { header: false })).status, 404);
  assert.equal((await post(two, { env: { ACCOUNTS: db } })).body.error, 'no-ai');
  assert.ok(!calls.some(c => c.url.includes('anthropic')), 'Claude never asked');
});

await test('tags: at most TAG_MAX shows a call, nothing asked for nothing', async () => {
  answer = claude('{}');
  assert.deepEqual((await post({ shows: [] })).body, { tags: {} });
  assert.equal(calls.length, 0);
  await post({ shows: Array.from({ length: TAG_MAX + 10 }, (_, i) => ({ id: 's' + i, title: 'Show ' + i })) });
  assert.equal(JSON.parse(JSON.parse(globalThis.__lastBody).messages[0].content).length, TAG_MAX);
});

await test('tags: a garbled answer is an error, not wrong tags', async () => {
  answer = claude('Sorry, I can’t.');
  const r = await post(two);
  assert.equal(r.status, 502); assert.equal(r.body.error, 'ai-format');
});

await test('tags: TAG_DAILY calls a person a day', async () => {
  const d2 = fakeKV(); await d2.put('owner', 'u1'); await putJSON(d2, 'user:u1', { id: 'u1', name: 'Sam', role: 'owner', creds: [] });
  const t2 = await issue(d2, 'u1'), env = { ACCOUNTS: d2, ANTHROPIC_API_KEY: 'ak' };
  answer = claude('{"a1": ["Music"]}');
  for (let i = 0; i < TAG_DAILY; i++) assert.equal((await post(two, { env, t: t2 })).status, 200);
  const r = await post(two, { env, t: t2 });
  assert.equal(r.status, 429); assert.equal(r.body.error, 'limit');
});

console.log(`\n${n} passed`);
