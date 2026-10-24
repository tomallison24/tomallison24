// Checks functions/sparkle/api/[[route]].js in plain Node, on an in-memory stand-in for Workers KV
// with real sessions from server/auth.js: the header guard, signing in, each account's own save
// (never another's), a stale save answered 409 with the newer copy, which merges (engine.js) and goes
// through, bad saves and clips refused, and that a save is one write.
//   node sparkle/scripts/api-test.mjs
import assert from 'assert/strict';
import fs from 'fs';
import vm from 'vm';
import { onRequest, okSave, okClips } from '../../functions/sparkle/api/[[route]].js';
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
console.log(n + ' passed');
