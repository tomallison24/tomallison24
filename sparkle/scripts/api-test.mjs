// Checks functions/sparkle/api/[[route]].js in plain Node, on an in-memory stand-in for Workers KV
// with real sessions from server/auth.js: the header guard, signing in, each account's own save
// (never another's), a stale save answered 409 with the newer copy, which merges (engine.js) and goes
// through, bad saves and clips refused, that a save is one write, and the natural voices (speak): only
// signed in, only its voices and short sentences, the request Google gets, and each sentence made once.
//   node sparkle/scripts/api-test.mjs
import assert from 'assert/strict';
import fs from 'fs';
import vm from 'vm';
import { onRequest, okSave, okClips, speak, VOICES, SOUNDS } from '../../functions/sparkle/api/[[route]].js';
import { issue, putJSON } from '../../server/auth.js';

vm.runInThisContext(fs.readFileSync(new URL('../engine.js', import.meta.url), 'utf8'));
const E = globalThis.SparkleEngine;

function fakeKV() {
  const m = new Map(); let writes = 0;
  return { m, writes: () => writes, get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { writes++; m.set(k, String(v)); }, delete: async k => { m.delete(k); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
}
const db = fakeKV(), env = { ACCOUNTS: db };
await db.put('owner', 'U1');
await putJSON(db, 'user:U1', { id: 'U1', name: 'Tom', role: 'owner', creds: [], created: 1 });
await putJSON(db, 'user:U2', { id: 'U2', name: 'Kate', role: 'member', creds: [], created: 2 });
const tom = await issue(db, 'U1'), kate = await issue(db, 'U2');

async function call(path, { body, token, header = true, method } = {}) {
  const headers = {}; if (header) headers['X-Sparkle'] = '1'; if (token) headers.Authorization = 'Bearer ' + token; if (body) headers['Content-Type'] = 'application/json';
  const res = await onRequest({ request: new Request('https://x.test/sparkle/api/' + path, { method: method || (body ? 'POST' : 'GET'), headers, body: body ? JSON.stringify(body) : undefined }), params: { route: path.split('/') }, env });
  return { status: res.status, j: await res.json() };
}
let n = 0; const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const player = (id, name) => E.newPlayer(id, name, { skin: 's2', hair: 'brown', style: 'long' });
const saveOf = (...ps) => ({ v: 1, players: Object.fromEntries(ps.map(p => [p.id, p])), gone: {}, settings: {}, settingsAt: 0 });

await test('needs its header and a signed-in family member', async () => {
  assert.equal((await call('save', { token: tom, header: false })).status, 400);
  assert.equal((await call('save')).status, 401);
  assert.equal((await call('save', { token: 'nonsense' })).status, 401);
});
await test('a first save, then the account\'s copy comes back; another account sees only its own', async () => {
  let r = await call('save', { token: tom }); assert.deepEqual(r.j, { save: null, rev: 0 });
  const w = db.writes();
  const ava = player('p1', 'Ava'); E.earn(ava, 'A', 12);
  r = await call('save', { token: tom, body: { save: saveOf(ava), rev: 0 } }); assert.equal(r.status, 200); assert.equal(r.j.rev, 1);
  assert.equal(db.writes() - w, 1, 'one write');
  r = await call('save', { token: tom }); assert.equal(r.j.rev, 1); assert.equal(E.coins(r.j.save.players.p1), 12);
  r = await call('save', { token: kate }); assert.deepEqual(r.j, { save: null, rev: 0 });
});
await test('a stale save gets the newer copy back; merged, it goes through and nothing is lost', async () => {
  const phoneB = player('p1', 'Ava'); E.earn(phoneB, 'B', 5);
  let r = await call('save', { token: tom, body: { save: saveOf(phoneB), rev: 0 } });
  assert.equal(r.status, 409); assert.equal(r.j.rev, 1);
  const merged = E.merge(saveOf(phoneB), r.j.save);
  r = await call('save', { token: tom, body: { save: merged, rev: r.j.rev } }); assert.equal(r.status, 200);
  r = await call('save', { token: tom }); assert.equal(E.coins(r.j.save.players.p1), 17, '12 from phone A and 5 from phone B');
});
await test('bad saves are refused', async () => {
  for (const bad of [null, [], { v: 2, players: {} }, { v: 1 }, { v: 1, players: { p1: { id: 'p2', name: 'x' } } }, { v: 1, players: { p1: { id: 'p1' } } }])
    assert.equal(okSave(bad), false, JSON.stringify(bad));
  assert.equal((await call('save', { token: tom, body: { save: { v: 1, players: [] }, rev: 2 } })).status, 400);
  assert.equal((await call('save', { token: tom, body: { save: saveOf(player('p1', 'x'.repeat(300 * 1024))), rev: 2 } })).status, 413);
});
await test('letter sounds: kept per account, only short audio for a single letter', async () => {
  const clip = 'data:audio/mp4;base64,' + 'A'.repeat(4000);
  assert.equal(okClips({ m: clip }), true);
  assert.equal(okClips({ mm: clip }), false); assert.equal(okClips({ m: 'data:text/html;base64,AAAA' }), false); assert.equal(okClips({ m: 'javascript:alert(1)' }), false);
  assert.equal(okClips({ m: 'data:audio/mp4;base64,' + 'A'.repeat(100 * 1024) }), false, 'too long for one sound');
  assert.equal((await call('clips', { token: tom, body: { clips: { m: clip, t: clip } } })).status, 200);
  assert.deepEqual(Object.keys((await call('clips', { token: tom })).j.clips).sort(), ['m', 't']);
  assert.deepEqual((await call('clips', { token: kate })).j.clips, {});
  assert.equal((await call('clips', { token: tom, body: { clips: { m: 'nope' } } })).status, 400);
});
await test('anything else is unknown', async () => {
  assert.equal((await call('nothing', { token: tom })).status, 404);
  assert.equal((await call('save', { token: tom, method: 'DELETE' })).status, 404);
});
// speak: a sentence in a character's voice (Google Cloud Text-to-Speech, faked here)
await test('natural voices: signed in only, its voices, short sentences, the request Google gets, each sentence made once', async () => {
  const say = (q, token = tom) => onRequest({ request: new Request('https://x.test/sparkle/api/speak?' + new URLSearchParams(q), { headers: { 'X-Sparkle': '1', ...(token ? { Authorization: 'Bearer ' + token } : {}) } }), params: { route: ['speak'] }, env });
  assert.equal((await say({ v: 'owl', t: 'Hoo hoo!' }, null)).status, 401, 'signed out: no voice');
  assert.equal((await say({ v: 'owl', t: 'Hoo hoo!' })).status, 503, 'no key yet: 503, and the phone speaks itself');
  const sent = [], store = new Map();
  globalThis.caches = { default: { match: async k => { const b = store.get(k.url); return b ? new Response(b, { headers: { 'Content-Type': 'audio/mpeg' } }) : null; }, put: async (k, r) => { store.set(k.url, await r.arrayBuffer()); } } };
  const google = async (url, init) => { const b = JSON.parse(init.body); sent.push({ url, key: init.headers['X-Goog-Api-Key'], b });
    if (b.audioConfig.speakingRate === 0.75) return new Response('{"error":{}}', { status: 400 });
    return new Response(JSON.stringify({ audioContent: Buffer.from('ID3fake-mp3').toString('base64') }), { headers: { 'Content-Type': 'application/json' } }); };
  const kenv = { GOOGLE_TTS_KEY: 'k123' }, u = q => new URL('https://x.test/sparkle/api/speak?' + new URLSearchParams(q));
  assert.equal((await speak(kenv, u({ v: 'unicorn', t: 'Hi' }), google)).status, 400, 'only its voices');
  assert.equal((await speak(kenv, u({ v: 'owl', t: 'x'.repeat(401) }), google)).status, 400, 'short sentences only');
  assert.equal((await speak(kenv, u({ v: 'owl', t: '  ' }), google)).status, 400, 'something to say');
  let r = await speak(kenv, u({ v: 'owl', t: 'Hoo hoo! Welcome to Story Tower.', r: '0.9' }), google);
  assert.equal(r.status, 200); assert.equal(r.headers.get('Content-Type'), 'audio/mpeg');
  assert.equal(Buffer.from(await r.arrayBuffer()).toString(), 'ID3fake-mp3');
  assert.equal(sent.length, 1); assert.equal(sent[0].url, 'https://texttospeech.googleapis.com/v1/text:synthesize'); assert.equal(sent[0].key, 'k123');
  assert.deepEqual(sent[0].b, { input: { text: 'Hoo hoo! Welcome to Story Tower.' }, voice: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-' + VOICES.owl }, audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9 } });
  r = await speak(kenv, u({ v: 'owl', t: 'Hoo hoo! Welcome to Story Tower.', r: '0.9' }), google);
  assert.equal(r.status, 200); assert.equal(sent.length, 1, 'the same sentence again comes from the cache');
  await speak(kenv, u({ v: 'dragon', t: 'Hoo hoo! Welcome to Story Tower.', r: '0.9' }), google);
  assert.equal(sent.length, 2, 'another voice is another sentence');
  r = await speak(kenv, u({ v: 'gemma', t: 'Tap the gems.', r: '0.75' }), google);
  assert.equal(r.status, 200); assert.equal(sent.length, 4); assert.equal(sent[3].b.audioConfig.speakingRate, undefined, 'a refused speed: asked again without one');
  // a letter's sound: Google is told how to say it, so "sss" isn't read as "s, s, s"
  assert.equal((await speak(kenv, u({ v: 'owl', t: 'sss', s: '1' }), google)).status, 400, 'only a letter');
  r = await speak(kenv, u({ v: 'owl', t: 'sss', s: 's', r: '0.9' }), google);
  assert.equal(r.status, 200); assert.equal(sent.length, 5);
  assert.deepEqual(sent[4].b.input, { text: 'sss', customPronunciations: { pronunciations: [{ phrase: 'sss', phoneticEncoding: 'PHONETIC_ENCODING_IPA', pronunciation: SOUNDS.s }] } });
  await speak(kenv, u({ v: 'owl', t: 'sss', r: '0.9' }), google);
  assert.equal(sent.length, 6, 'the sound and the same words read as text are kept apart');
  const no = async () => new Response('{"error":{}}', { status: 400 });
  assert.equal((await speak(kenv, u({ v: 'owl', t: 'mmm', s: 'm' }), no)).status, 422, 'a sound Google won\'t say: the phone says it');
  const bad = async () => new Response('{}', { status: 403 });
  assert.equal((await speak(kenv, u({ v: 'bloom', t: 'Pop!' }), bad)).status, 502, 'Google refusing: 502, and the phone speaks itself');
  delete globalThis.caches;
});
console.log(n + ' passed');
