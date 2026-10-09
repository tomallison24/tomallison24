// Tests the notification Worker (mail/push) without Cloudflare, Google or
// Apple: Gmail and the push service are stand-ins, and every notification is
// decrypted here with Node's own crypto - a second, independent reading of
// RFC 8291 - to show the phone could read it and nobody in between could.
//   node mail/scripts/push-test.mjs
import crypto from 'node:crypto';
import { encrypt, vapidHeader, makeKeys, b64u } from '../push/webpush.js';
import { handle, check, wanted } from '../push/worker.js';

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? '  — ' + extra : '')); };

// ---- a phone: an ECDH key pair and an auth secret, as PushManager makes ----
function phone() {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return { ecdh, auth, keys: { p256dh: b64u.enc(ecdh.getPublicKey()), auth: b64u.enc(auth) } };
}
// RFC 8291 decryption, written against Node's crypto rather than WebCrypto.
function decrypt(body, ph) {
  const buf = Buffer.from(body);
  const salt = buf.subarray(0, 16), rs = buf.readUInt32BE(16), idlen = buf[20], keyid = buf.subarray(21, 21 + idlen), ct = buf.subarray(21 + idlen);
  const shared = ph.ecdh.computeSecret(keyid);
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), ph.ecdh.getPublicKey(), keyid]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, ph.auth, info, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  let end = plain.length - 1;
  while (end > 0 && plain[end] === 0) end--;                 // padding, then the 0x02 delimiter
  return { rs, idlen, delim: plain[end], text: plain.subarray(0, end).toString() };
}

// ---- 1. encryption ----
{
  const ph = phone();
  const body = await encrypt(JSON.stringify({ title: 'Mum', body: 'Dinner Sunday? ☕' }), ph.keys);
  const d = decrypt(body, ph);
  ok('1. the phone can decrypt the notification (independent RFC 8291 reading)', d.text === JSON.stringify({ title: 'Mum', body: 'Dinner Sunday? ☕' }));
  ok('1. record size 4096, 65-byte sender key, last-record delimiter', d.rs === 4096 && d.idlen === 65 && d.delim === 2);
  let other = false;
  try { decrypt(body, phone()); } catch { other = true; }
  ok('1. another phone (or the push service) cannot read it', other);
  const again = await encrypt('same', ph.keys), again2 = await encrypt('same', ph.keys);
  ok('1. the same text never encrypts the same way twice', Buffer.compare(Buffer.from(again), Buffer.from(again2)) !== 0);
}

// ---- 2. VAPID ----
const vapid = { ...(await makeKeys()), subject: 'mailto:tomallison24@gmail.com' };
{
  const h = await vapidHeader('https://web.push.apple.com/QGuQyavXutnMH8', vapid);
  const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(h) || [];
  const [head, claims, sig] = t.split('.');
  const pub = b64u.dec(k);
  const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33)) }, format: 'jwk' });
  const good = crypto.verify('sha256', Buffer.from(head + '.' + claims), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(b64u.dec(sig)));
  const c = JSON.parse(Buffer.from(b64u.dec(claims)).toString());
  ok('2. VAPID signature verifies with the public key it names', good && k === vapid.publicKey);
  ok('2. JWT is for the push service origin, expires within a day, names a contact', c.aud === 'https://web.push.apple.com' && c.exp > Date.now() / 1000 && c.exp < Date.now() / 1000 + 86400 && c.sub.startsWith('mailto:'));
}

// ---- stand-ins: KV, Gmail, Google's token endpoint, Apple's push service ----
function makeKV() {
  const m = new Map(); const kv = { writes: 0, map: m };
  kv.get = async (k, type) => { const v = m.get(k); return v == null ? null : type === 'json' ? JSON.parse(v) : v; };
  kv.put = async (k, v) => { kv.writes++; m.set(k, String(v)); };
  kv.delete = async k => { m.delete(k); };
  return kv;
}
const ME = 'tomallison24@gmail.com';
function world() {
  const w = {
    historyId: 1000, history: [], messages: {}, unread: 7, tokens: 0, profileFor: { 'good-token': ME, 'other-token': 'someone@else.com' },
    pushed: [], pushStatus: 201, historyStatus: 200,
    labels: [{ id: 'INBOX', name: 'INBOX' }, { id: 'Label_23', name: 'Marketing' }, { id: 'Label_24', name: 'School' }],
  };
  w.calls = 0;
  w.fetch = async (url, init = {}) => {
    w.calls++;
    const u = new URL(url), auth = (init.headers?.Authorization || '').replace('Bearer ', '');
    const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
    if (u.host === 'oauth2.googleapis.com') { w.tokens++; return J({ access_token: 'worker-token', expires_in: 3599 }); }
    if (u.host === 'web.push.apple.com') { w.pushed.push({ url: String(url), headers: init.headers, body: init.body }); return new Response(null, { status: w.pushStatus }); }
    const p = u.pathname.replace('/gmail/v1/users/me', '');
    if (p === '/profile') return auth === 'worker-token' ? J({ historyId: String(w.historyId), emailAddress: ME }) : w.profileFor[auth] ? J({ emailAddress: w.profileFor[auth] }) : J({}, 401);
    if (p === '/history') {
      if (w.historyStatus !== 200) return J({ error: {} }, w.historyStatus);
      const from = Number(u.searchParams.get('startHistoryId'));
      const h = w.history.filter(x => x.id > from);
      return J({ history: h.map(x => ({ id: String(x.id), messagesAdded: [{ message: { id: x.msg, threadId: 't' + x.msg, labelIds: w.messages[x.msg].labelIds } }] })), historyId: String(w.historyId) });
    }
    if (p === '/labels') return J({ labels: w.labels });
    if (p === '/labels/INBOX') return J({ id: 'INBOX', threadsUnread: w.unread });
    const mm = /^\/messages\/(\w+)$/.exec(p);
    if (mm) { const m = w.messages[mm[1]]; return m ? J({ id: mm[1], threadId: 't' + mm[1], labelIds: m.labelIds, payload: { headers: [{ name: 'From', value: m.from }, { name: 'Subject', value: m.subject }] } }) : J({}, 404); }
    return J({ error: 'unexpected ' + p }, 500);
  };
  w.mail = (id, from, subject, labelIds = ['INBOX', 'UNREAD', 'CATEGORY_PERSONAL']) => {
    w.messages[id] = { from, subject, labelIds };
    w.historyId += 7; w.history.push({ id: w.historyId, msg: id });
  };
  return w;
}
const envFor = kv => ({
  PUSH: kv, ALLOWED_EMAIL: ME, ALLOWED_ORIGIN: 'https://tomallison24-news.pages.dev', MARKETING_LABEL: 'Marketing',
  GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret', GOOGLE_REFRESH_TOKEN: 'refresh',
  VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: vapid.subject,
});
const req = (path, { method = 'POST', token, body, origin = 'https://tomallison24-news.pages.dev' } = {}) => new Request('https://mail-push.example.workers.dev' + path, {
  method, headers: { Origin: origin, ...(token && { Authorization: 'Bearer ' + token }), 'Content-Type': 'application/json' }, ...(body && { body: JSON.stringify(body) }),
});
const lastPush = (w, ph) => JSON.parse(decrypt(w.pushed.at(-1).body, ph).text);

// ---- 3. the app's requests ----
const kv = makeKV(), env = envFor(kv), w = world(), ph = phone();
const sub = { endpoint: 'https://web.push.apple.com/QGuQyavXutnMH8abc', keys: ph.keys };
{
  const r = await handle(req('/key', { method: 'GET' }), env, w.fetch);
  ok('3. /key gives the public key, with CORS for the app only', (await r.json()).key === vapid.publicKey && r.headers.get('Access-Control-Allow-Origin') === 'https://tomallison24-news.pages.dev');
  const r2 = await handle(req('/key', { method: 'GET', origin: 'https://evil.example' }), env, w.fetch);
  ok('3. …no CORS for other sites', r2.headers.get('Access-Control-Allow-Origin') === null);
  ok('3. subscribing needs a Google token', (await handle(req('/subscribe', { body: { subscription: sub } }), env, w.fetch)).status === 403);
  ok('3. …and it must be your Gmail account', (await handle(req('/subscribe', { token: 'other-token', body: { subscription: sub } }), env, w.fetch)).status === 403);
  ok('3. …a made-up token is refused', (await handle(req('/subscribe', { token: 'nonsense', body: { subscription: sub } }), env, w.fetch)).status === 403);
  const bad = await handle(req('/subscribe', { token: 'good-token', body: { subscription: { ...sub, endpoint: 'https://attacker.example/x' } } }), env, w.fetch);
  ok('3. only real push services are accepted as endpoints', bad.status === 400);
  const junk = await handle(req('/subscribe', { token: 'good-token', body: { subscription: { ...sub, keys: { p256dh: 'BAAAA', auth: sub.keys.auth } } } }), env, w.fetch);
  ok('3. keys that are not a real phone key are refused', junk.status === 400);
  const good = await handle(req('/subscribe', { token: 'good-token', body: { subscription: sub, mode: 'all' } }), env, w.fetch);
  ok('3. your phone subscribes', good.status === 200 && Object.keys(await kv.get('subs', 'json')).length === 1);
  const t = await handle(req('/test', { token: 'good-token' }), env, w.fetch);
  const d = lastPush(w, ph);
  ok('3. /test sends a notification the phone can read', (await t.json()).sent === 1 && d.title === 'Mail' && d.body.includes('working'));
  const hd = w.pushed.at(-1).headers;
  ok('3. push request: aes128gcm, VAPID, a TTL', hd['Content-Encoding'] === 'aes128gcm' && hd.Authorization.startsWith('vapid t=') && Number(hd.TTL) > 0);
}

// ---- 4. every minute ----
{
  const n0 = w.pushed.length;
  let r = await check(env, w.fetch);
  ok('4. first run: remembers where the mailbox is, sends nothing', r.started && (await kv.get('history')) === '1000' && w.pushed.length === n0);
  const writes = kv.writes;
  r = await check(env, w.fetch);
  ok('4. nothing new: no notification and no storage write', r.new === 0 && w.pushed.length === n0 && kv.writes === writes, JSON.stringify(r));
  w.mail('m1', '"Mum" <janeallison@gmail.com>', 'Dinner Sunday?');
  r = await check(env, w.fetch);
  let d = lastPush(w, ph);
  ok('4. new mail: one notification, sender as title, subject as text', w.pushed.length === n0 + 1 && d.title === 'Mum' && d.body === 'Dinner Sunday?', JSON.stringify(d));
  ok('4. …it opens that conversation and carries the unread count', d.thread === 'tm1' && d.tag === 'tm1' && d.badge === 7);
  r = await check(env, w.fetch);
  ok('4. the same mail is never notified twice', w.pushed.length === n0 + 1);
  w.mail('m2', 'ASOS <news@e.asos.com>', '20% off', ['INBOX', 'UNREAD', 'Label_23']);
  w.mail('m3', 'Shop <deals@shop.example>', 'Big sale', ['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS']);
  w.mail('m4', 'Me <tomallison24@gmail.com>', 'Re: Dinner', ['SENT']);
  r = await check(env, w.fetch);
  ok('4. Marketing, Promotions and your own sent mail stay quiet', w.pushed.length === n0 + 1, JSON.stringify(r));
  w.mail('m5', 'TMSA <office@tmsa.org>', 'Harvest Festival', ['INBOX', 'UNREAD', 'CATEGORY_UPDATES', 'Label_24']);
  w.mail('m6', 'Acme <billing@acme.io>', 'Invoice', ['INBOX', 'UNREAD', 'CATEGORY_UPDATES']);
  w.mail('m7', 'Bob <bob@example.com>', 'Lunch?', ['INBOX', 'UNREAD', 'CATEGORY_PERSONAL']);
  r = await check(env, w.fetch);
  d = lastPush(w, ph);
  ok('4. several at once: one summary, not a burst', w.pushed.length === n0 + 2 && d.title === '3 new emails' && d.body === 'TMSA, Acme, Bob', JSON.stringify(d));
  w.mail('m8', 'Old <old@example.com>', 'Already read', ['INBOX', 'CATEGORY_PERSONAL']);
  r = await check(env, w.fetch);
  ok('4. mail you already read elsewhere stays quiet', w.pushed.length === n0 + 2);
}

// ---- 5. modes ----
{
  const s = { mode: 'primary', tags: [] }, t = { mode: 'tags', tags: ['Label_24'] }, a = { mode: 'all', tags: [] };
  const m = l => ({ labelIds: ['INBOX', 'UNREAD', ...l] });
  ok('5. Primary only: personal yes, updates no', wanted(m(['CATEGORY_PERSONAL']), s, 'Label_23') && !wanted(m(['CATEGORY_UPDATES']), s, 'Label_23'));
  ok('5. Tags only: School yes, others no', wanted(m(['CATEGORY_UPDATES', 'Label_24']), t, 'Label_23') && !wanted(m(['CATEGORY_PERSONAL']), t, 'Label_23'));
  ok('5. Everything: all but Marketing, Promotions, Spam', wanted(m(['CATEGORY_UPDATES']), a, 'Label_23') && !wanted(m(['Label_23']), a, 'Label_23') && !wanted(m(['CATEGORY_PROMOTIONS']), a, 'Label_23') && !wanted(m(['SPAM']), a, 'Label_23'));
}

// ---- 6. housekeeping ----
{
  ok('6. the Google token is reused across runs, not fetched every minute', w.tokens === 1, 'token requests: ' + w.tokens);
  w.pushStatus = 410;
  w.mail('m9', 'Bob <bob@example.com>', 'Again', ['INBOX', 'UNREAD', 'CATEGORY_PERSONAL']);
  await check(env, w.fetch);
  ok('6. a phone that unsubscribed (410) is forgotten', Object.keys((await kv.get('subs', 'json')) || {}).length === 0);
  w.pushStatus = 201;
  await kv.put('subs', JSON.stringify({ broken: { subscription: { endpoint: 'https://web.push.apple.com/broken', keys: { p256dh: 'BAAAA', auth: 'AAAAAAAAAAAAAAAAAAAAAA' } }, mode: 'all', tags: [] },
    fine: { subscription: sub, mode: 'all', tags: [] } }));
  w.mail('m10', 'Bob <bob@example.com>', 'Still there?', ['INBOX', 'UNREAD', 'CATEGORY_PERSONAL']);
  const rb = await check(env, w.fetch);
  ok('6. one broken subscription neither stops the others nor stays', rb.sent === 1 && Object.keys(await kv.get('subs', 'json')).join() === 'fine', JSON.stringify(rb));
  await kv.put('subs', JSON.stringify({}));
  const c0 = w.calls, r = await check(env, w.fetch);
  ok('6. with nobody subscribed, Gmail is not even asked', !!r.skipped && w.calls === c0);
  await handle(req('/subscribe', { token: 'good-token', body: { subscription: sub } }), env, w.fetch);
  w.historyStatus = 404;
  const r2 = await check(env, w.fetch);
  ok('6. history too old (404): starts again from now instead of failing', r2.reset === true && (await kv.get('history')) === String(w.historyId));
  w.historyStatus = 200;
  const r3 = await handle(req('/unsubscribe', { token: 'good-token', body: { endpoint: sub.endpoint } }), env, w.fetch);
  ok('6. /unsubscribe removes the phone', r3.status === 200 && Object.keys((await kv.get('subs', 'json')) || {}).length === 0);
}

// ---- 7. the phone's side: sw.js shows the notification and opens it ----
{
  const { readFileSync } = await import('node:fs');
  const vm = await import('node:vm');
  const src = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const make = clientsList => {
    const L = {}, log = { shown: [], badge: [], opened: [], posted: [], focused: 0 };
    const self = {
      addEventListener: (t, f) => { L[t] = f; },
      registration: { scope: 'https://tomallison24-news.pages.dev/mail/', showNotification: async (t, o) => { log.shown.push({ t, o }); } },
      navigator: { setAppBadge: async n => log.badge.push(n), clearAppBadge: async () => log.badge.push(0) },
      clients: {
        matchAll: async () => clientsList.map(() => ({ postMessage: m => log.posted.push(m), focus: async () => { log.focused++; } })),
        openWindow: async u => { log.opened.push(u); }, claim: async () => {},
      },
      skipWaiting: () => {}, location: { origin: 'https://tomallison24-news.pages.dev' },
    };
    vm.runInNewContext(src, { self, caches: { open: async () => ({}), keys: async () => [] }, URL, location: self.location, fetch: async () => ({}) });
    const fire = async (type, ev) => { let p; L[type]({ ...ev, waitUntil: x => { p = x; } }); await p; };
    return { fire, log };
  };
  const a = make([]);
  await a.fire('push', { data: { json: () => ({ title: 'Mum', body: 'Dinner Sunday?', tag: 'tm1', thread: 'tm1', badge: 3 }) } });
  ok('7. a push shows the notification: sender, subject, grouped by conversation', a.log.shown[0]?.t === 'Mum' && a.log.shown[0].o.body === 'Dinner Sunday?' && a.log.shown[0].o.tag === 'tm1' && a.log.shown[0].o.data.thread === 'tm1');
  ok('7. …and sets the icon count', a.log.badge[0] === 3);
  await a.fire('push', { data: { json: () => { throw new Error('garbled'); } } });
  ok('7. even a garbled push still shows something (iOS requires it)', a.log.shown[1]?.t === 'Mail');
  await a.fire('notificationclick', { notification: { close() {}, data: { thread: 'tm1' } } });
  ok('7. tapping it with the app closed opens the app on that conversation', a.log.opened[0] === 'https://tomallison24-news.pages.dev/mail/?thread=tm1');
  const b = make([1]);
  await b.fire('notificationclick', { notification: { close() {}, data: { thread: 'tm9' } } });
  ok('7. with the app open, it is brought forward and told which one', b.log.focused === 1 && b.log.posted[0]?.open === 'tm9' && b.log.opened.length === 0);
}

console.log(fail ? `\n${fail} failed, ${pass} passed` : `\nall ${pass} passed`);
process.exit(fail ? 1 : 0);
