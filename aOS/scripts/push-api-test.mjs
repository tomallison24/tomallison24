// Checks aOS notifications' server rules (server/push.js, the push routes in
// functions/aOS/api/[[route]].js), in plain Node on an in-memory stand-in for Workers KV
// and a stand-in push service. Real encryption: every message is decrypted here with the
// phone's own keys, as a phone would.
//   node aOS/scripts/push-api-test.mjs
import assert from 'assert/strict';
import { onRequest } from '../../functions/aOS/api/[[route]].js';
import { issue, putJSON, getJSON } from '../../server/auth.js';
import { sendTo, message, cleanSub, MAX_DEVICES } from '../../server/push.js';
import { b64u } from '../../mail/push/webpush.js';

function fakeKV() {
  const m = new Map();
  return { m, get: async k => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, String(v)); }, delete: async k => { m.delete(k); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
}
const db = fakeKV(), env = { ACCOUNTS: db };
let n = 0; const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

// the stand-in push service: records what each endpoint was sent, answers with a status we choose
const sent = []; const status = new Map();
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith('https://web.push.apple.com/')) return realFetch(url, init);
  sent.push({ url: String(url), headers: init.headers, body: init.body });
  return new Response('', { status: status.get(String(url)) || 201 });
};

// a phone: its own key pair, as PushSubscription.toJSON() reports it
async function phone(tag) {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)), auth = crypto.getRandomValues(new Uint8Array(16));
  return { kp, raw, auth, sub: { endpoint: 'https://web.push.apple.com/' + tag, keys: { p256dh: b64u.enc(raw), auth: b64u.enc(auth) } } };
}
// what a phone does with a push (RFC 8291): the message, or throws
async function open(ph, body) {
  const te = new TextEncoder(), salt = body.slice(0, 16), idlen = body[20], asPub = body.slice(21, 21 + idlen), data = body.slice(21 + idlen);
  const hkdf = async (s, ikm, info, len) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), len * 8));
  const cat = (...p) => { const o = new Uint8Array(p.reduce((a, x) => a + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []) }, ph.kp.privateKey, 256));
  const ikm = await hkdf(ph.auth, shared, cat(te.encode('WebPush: info\0'), ph.raw, asPub), 32);
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), data));
  return JSON.parse(new TextDecoder().decode(plain.slice(0, plain.lastIndexOf(2))));
}

const call = async (path, body, token) => {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const request = new Request('https://site.example/aOS/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await onRequest({ request, params: { route: path.split('/') }, env });
  return { status: res.status, body: await res.json() };
};

// the family: Tom (owner), Sam and Mia (members), Lee (removed)
const people = { tom: ['T1', 'owner'], sam: ['S1', 'member'], mia: ['M1', 'member'], lee: ['L1', 'member'] };
for (const [name, [id, role]] of Object.entries(people)) await putJSON(db, 'user:' + id, { id, name: name[0].toUpperCase() + name.slice(1), role, creds: [], created: 1, ...(name === 'lee' ? { removed: 5 } : {}) });
await db.put('owner', 'T1');
const tok = {}; for (const [name, [id]] of Object.entries(people)) tok[name] = await issue(db, id);

await test('only signed-in family can ask for the key or subscribe', async () => {
  assert.equal((await call('push')).status, 401);
  assert.equal((await call('push/subscribe', { subscription: {} })).status, 401);
  assert.equal((await call('push/send', { to: 'S1', title: 'x' })).status, 401);
});

let key;
await test('the push key is made on first use, kept, and is the same for everyone', async () => {
  const a = await call('push', undefined, tok.sam); assert.equal(a.status, 200);
  assert.ok(a.body.key && a.body.key.length > 80); assert.equal(a.body.devices, 0);
  key = a.body.key;
  assert.equal((await call('push', undefined, tok.mia)).body.key, key);
  assert.equal(JSON.parse(db.m.get('config:vapid')).publicKey, key);
});

const sam1 = await phone('sam-1'), sam2 = await phone('sam-2'), mia1 = await phone('mia-1'), lee1 = await phone('lee-1');
await test('a subscription is checked: a push service we know, and keys of the right shape', async () => {
  const bad = [
    { endpoint: 'https://evil.example/x', keys: sam1.sub.keys },
    { endpoint: 'http://web.push.apple.com/x', keys: sam1.sub.keys },
    { endpoint: sam1.sub.endpoint, keys: { p256dh: 'AAAA', auth: sam1.sub.keys.auth } },
    { endpoint: sam1.sub.endpoint, keys: { p256dh: sam1.sub.keys.p256dh, auth: 'AAAA' } },
    { endpoint: sam1.sub.endpoint }, null, 'text',
  ];
  for (const s of bad) assert.equal((await call('push/subscribe', { subscription: s }, tok.sam)).status, 400);
  assert.equal(cleanSub(sam1.sub).endpoint, sam1.sub.endpoint);
  assert.equal(db.m.has('push:S1'), false, 'nothing kept');
});

await test('subscribing keeps the phone for that person; again, identical, writes nothing', async () => {
  assert.equal((await call('push/subscribe', { subscription: sam1.sub }, tok.sam)).body.devices, 1);
  const before = db.m.get('push:S1');
  assert.equal((await call('push/subscribe', { subscription: sam1.sub }, tok.sam)).body.devices, 1);
  assert.equal(db.m.get('push:S1'), before);
  assert.equal((await call('push/subscribe', { subscription: sam2.sub }, tok.sam)).body.devices, 2);
  assert.equal((await call('push/subscribe', { subscription: mia1.sub }, tok.mia)).body.devices, 1);
  await call('push/subscribe', { subscription: lee1.sub }, tok.lee);
  assert.equal((await call('push', undefined, tok.sam)).body.devices, 2);
});

await test('a phone is one person\'s: someone else signing in on it takes it over', async () => {
  const shared = await phone('shared');
  await call('push/subscribe', { subscription: shared.sub }, tok.sam);
  assert.ok(JSON.parse(db.m.get('push:S1')).subs.some(s => s.endpoint === shared.sub.endpoint));
  await call('push/subscribe', { subscription: shared.sub }, tok.mia);
  assert.ok(!JSON.parse(db.m.get('push:S1')).subs.some(s => s.endpoint === shared.sub.endpoint), 'no longer Sam\'s');
  assert.ok(JSON.parse(db.m.get('push:M1')).subs.some(s => s.endpoint === shared.sub.endpoint));
  await call('push/unsubscribe', { endpoint: shared.sub.endpoint }, tok.mia);
});

await test('only so many phones a person; the newest stay', async () => {
  const many = []; for (let i = 0; i < MAX_DEVICES + 2; i++) { const p = await phone('many-' + i); many.push(p); await call('push/subscribe', { subscription: p.sub }, tok.tom); }
  const subs = JSON.parse(db.m.get('push:T1')).subs;
  assert.equal(subs.length, MAX_DEVICES);
  assert.equal(subs.at(-1).endpoint, many.at(-1).sub.endpoint); assert.ok(!subs.some(s => s.endpoint === many[0].sub.endpoint));
});

await test('a test goes to your own phones only, and is readable by that phone alone', async () => {
  sent.length = 0;
  const r = await call('push/test', {}, tok.mia); assert.equal(r.body.sent, 1);
  assert.equal(sent.length, 1); assert.equal(sent[0].url, mia1.sub.endpoint);
  assert.match(sent[0].headers.Authorization, /^vapid t=.+, k=/);
  const got = await open(mia1, sent[0].body); assert.match(got.body, /test/);
  await assert.rejects(open(sam1, sent[0].body), 'another phone cannot read it');
});

await test('members cannot send or list; the owner can', async () => {
  assert.equal((await call('push/send', { to: 'M1', title: 'Hi' }, tok.sam)).status, 403);
  assert.equal((await call('push/audience', undefined, tok.sam)).status, 403);
  const a = (await call('push/audience', undefined, tok.tom)).body.people;
  assert.deepEqual(a.map(p => [p.name, p.devices]).sort(), [['Mia', 1], ['Sam', 2], ['Tom', MAX_DEVICES]], 'Lee, removed, is not listed');
});

await test('the owner sends to one person: all their phones get the message, and no one else\'s', async () => {
  sent.length = 0;
  const r = await call('push/send', { to: 'S1', title: 'New in aOS', body: 'Notifications are here.', url: '/aOS/#whats-new' }, tok.tom);
  assert.deepEqual([r.status, r.body.sent, r.body.failed, r.body.gone], [200, 2, 0, 0]);
  assert.deepEqual(sent.map(s => s.url).sort(), [sam1.sub.endpoint, sam2.sub.endpoint]);
  for (const [ph, s] of [[sam1, sent.find(x => x.url === sam1.sub.endpoint)], [sam2, sent.find(x => x.url === sam2.sub.endpoint)]]) {
    const m = await open(ph, s.body); assert.equal(m.title, 'New in aOS'); assert.equal(m.body, 'Notifications are here.'); assert.equal(m.url, './#whats-new');
  }
});

await test('a removed or unknown person cannot be sent to; an empty title is refused', async () => {
  sent.length = 0;
  assert.equal((await call('push/send', { to: 'L1', title: 'Hi' }, tok.tom)).status, 404);
  assert.equal((await call('push/send', { to: 'nobody', title: 'Hi' }, tok.tom)).status, 404);
  assert.equal((await call('push/send', { to: 'S1', title: '  ' }, tok.tom)).status, 400);
  assert.equal(sent.length, 0);
});

await test('a phone that has let go (410) is forgotten; a push service error is only counted', async () => {
  status.set(sam2.sub.endpoint, 410); status.set(sam1.sub.endpoint, 500);
  const r = (await call('push/send', { to: 'S1', title: 'Hi' }, tok.tom)).body;
  assert.deepEqual([r.sent, r.failed, r.gone], [0, 1, 1]);
  assert.deepEqual(JSON.parse(db.m.get('push:S1')).subs.map(s => s.endpoint), [sam1.sub.endpoint]);
  status.set(sam1.sub.endpoint, 404);
  assert.equal((await call('push/send', { to: 'S1', title: 'Hi' }, tok.tom)).body.gone, 1);
  assert.equal(db.m.has('push:S1'), false, 'no phones left: nothing kept');
  status.clear();
});

await test('turning it off removes the phone, and no one can remove another person\'s', async () => {
  assert.equal((await call('push/unsubscribe', { endpoint: mia1.sub.endpoint }, tok.sam)).status, 200);
  assert.equal(JSON.parse(db.m.get('push:M1')).subs.length, 1, 'Sam cannot remove Mia\'s phone');
  assert.equal((await call('push/unsubscribe', { endpoint: mia1.sub.endpoint }, tok.mia)).body.devices, 0);
  assert.equal(db.m.has('push:M1'), false);
});

await test('what a notification may say: trimmed, and it can only open a page on this site', () => {
  assert.equal(message({ title: 'x'.repeat(200), body: 'y'.repeat(900) }).title.length, 60);
  assert.equal(message({ title: 't', body: 'y'.repeat(900) }).body.length, 240);
  assert.equal(message({ body: 'no title' }), null);
  assert.equal(message({ title: 't', url: 'https://evil.example/phish' }).url, './', 'another site: opens aOS instead');
  assert.equal(message({ title: 't', url: '//evil.example/x' }).url, './');
  assert.equal(message({ title: 't', url: '/weather/' }).url, '/weather/');
  assert.equal(message({ title: 't' }).url, './');
});

await test('the Pages secrets VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY win over the stored key', async () => {
  const { vapidKeys } = await import('../../server/push.js');
  const k = await vapidKeys(db, { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' });
  assert.equal(k.publicKey, 'pub');
  assert.equal((await vapidKeys(db, {})).publicKey, key);
});

globalThis.fetch = realFetch;
console.log(`${n} of ${n} passed`);
