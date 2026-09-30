// Tests Notes' notification Worker (notes/push) without Cloudflare, Google or
// Apple: the Google Sheet and the push service are stand-ins, and every
// notification is decrypted here with Node's own crypto to read what the
// phone would show.
//   node notes/scripts/push-test.mjs
import crypto from 'node:crypto';
import { b64u } from '../../mail/push/webpush.js';
import { handle, tick, fireAt, localTime, slim, dueFor, when } from '../push/worker.js';

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? '  — ' + extra : '')); };
const MIN = 60e3, DAY = 864e5;

// ---- a phone: an ECDH key pair and an auth secret, as PushManager makes ----
function phone(n) {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return { ecdh, auth, endpoint: 'https://web.push.apple.com/phone-' + n, keys: { p256dh: b64u.enc(ecdh.getPublicKey()), auth: b64u.enc(auth) } };
}
function decrypt(body, ph) {
  const buf = Buffer.from(body);
  const salt = buf.subarray(0, 16), idlen = buf[20], keyid = buf.subarray(21, 21 + idlen), ct = buf.subarray(21 + idlen);
  const shared = ph.ecdh.computeSecret(keyid);
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), ph.ecdh.getPublicKey(), keyid]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, ph.auth, info, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  let end = plain.length - 1;
  while (end > 0 && plain[end] === 0) end--;
  return JSON.parse(plain.subarray(0, end).toString());
}

// ---- stand-ins: KV, the Google Sheet's script, Apple's push service ----
function makeKV() {
  const m = new Map(); const kv = { writes: 0, map: m };
  kv.get = async (k, type) => { const v = m.get(k); return v == null ? null : type === 'json' ? JSON.parse(v) : v; };
  kv.put = async (k, v) => { kv.writes++; m.set(k, String(v)); };
  kv.delete = async k => { m.delete(k); };
  return kv;
}
const SHEET = 'https://script.google.com/macros/s/AKfycbTEST/exec';
const OTHER = 'https://script.google.com/macros/s/AKfycbOTHER/exec';
function world() {
  const w = {
    secrets: { [SHEET]: 'maple-otter', [OTHER]: 'someone-else' },
    lists: [{ id: 'l1', name: 'Personal', updated: 1 }, { id: 'l3', name: 'Groceries', updated: 1 }],
    todos: [], notes: [],
    sheetCalls: 0, pushed: [], pushStatus: 201, sheetDown: false,
  };
  w.fetch = async (url, init = {}) => {
    url = String(url);
    if (url.startsWith('https://script.google.com/')) {
      w.sheetCalls++;
      if (w.sheetDown) throw new TypeError('fetch failed');
      if (!(url in w.secrets)) return new Response('<html>Not found</html>', { status: 404 });
      const req = JSON.parse(init.body);
      if (req.secret !== w.secrets[url]) return Response.json({ ok: false, error: 'wrong-secret' });
      // An older script: answers "due" with everything, as a sync does.
      return Response.json({ ok: true, app: 'allison-notes-sync', v: 1, todos: w.todos, notes: w.notes, lists: w.lists, graves: {} });
    }
    if (url.startsWith('https://web.push.apple.com/')) {
      w.pushed.push({ endpoint: url, headers: init.headers, body: init.body });
      return new Response(null, { status: w.pushStatus });
    }
    throw new Error('unexpected fetch ' + url);
  };
  w.env = { PUSH: makeKV(), ALLOWED_ORIGIN: 'https://tomallison24.github.io', VAPID_SUBJECT: 'https://tomallison24.github.io/tomallison24/notes/' };
  return w;
}
const req = (path, body, origin = 'https://tomallison24.github.io', method = 'POST') =>
  new Request('https://notes-push.example.workers.dev' + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const call = async (w, path, body, origin) => { const r = await handle(req(path, body, origin, body ? 'POST' : 'GET'), w.env, w.fetch); return { status: r.status, body: await r.json(), headers: r.headers }; };
const NY = { tz: 'America/New_York', lang: 'en-US', morning: '09:00', skip: [], nudges: true };

// ---- 1. time ----
{
  ok('1. 17:30 in New York on 2 Oct 2026 is 21:30 UTC (daylight time)', localTime('2026-10-02', '17:30', 'America/New_York') === Date.UTC(2026, 9, 2, 21, 30));
  ok('1. 09:00 in New York on 2 Nov 2026 is 14:00 UTC (the clocks went back on 1 Nov)', localTime('2026-11-02', '09:00', 'America/New_York') === Date.UTC(2026, 10, 2, 14, 0));
  ok('1. 08:00 in London on 29 Mar 2026, the morning the clocks go forward, is 07:00 UTC', localTime('2026-03-29', '08:00', 'Europe/London') === Date.UTC(2026, 2, 29, 7, 0));
  const t = { date: '2026-10-02', time: '17:30' };
  ok('1. no alert chosen: at the time', fireAt(t, NY) === Date.UTC(2026, 9, 2, 21, 30));
  ok('1. 15 minutes before', fireAt({ ...t, alert: 15 }, NY) === Date.UTC(2026, 9, 2, 21, 15));
  ok('1. 1 day before', fireAt({ ...t, alert: 1440 }, NY) === Date.UTC(2026, 9, 1, 21, 30));
  ok('1. None: never', fireAt({ ...t, alert: -1 }, NY) === null);
  ok('1. a date but no time: 9:00 that morning', fireAt({ date: '2026-10-02' }, NY) === Date.UTC(2026, 9, 2, 13, 0));
  ok('1. a date but no time, the phone\'s morning set to 7:30', fireAt({ date: '2026-10-02' }, { ...NY, morning: '07:30' }) === Date.UTC(2026, 9, 2, 11, 30));
  ok('1. a date but no time, 2 days before', fireAt({ date: '2026-10-02', alert: 2880 }, NY) === Date.UTC(2026, 8, 30, 13, 0));
  ok('1. a date but no time, a minutes-before alert left from a time: on the day', fireAt({ date: '2026-10-02', alert: 15 }, NY) === Date.UTC(2026, 9, 2, 13, 0));
  ok('1. no date: never', fireAt({ date: null, time: '09:00' }, NY) === null);
  const now = Date.UTC(2026, 9, 2, 21, 15);
  ok('1. wording: "In 15 min, 5:30 PM"', when(t, NY, now) === 'In 15 min, 5:30 PM', when(t, NY, now));
  ok('1. wording: tomorrow', when({ date: '2026-10-03', time: '08:00' }, NY, now) === 'Tomorrow, 8:00 AM', when({ date: '2026-10-03', time: '08:00' }, NY, now));
  ok('1. wording: a week ahead, no time', when({ date: '2026-10-09' }, NY, now) === 'Fri, Oct 9', when({ date: '2026-10-09' }, NY, now));
  ok('1. wording: today, no time', when({ date: '2026-10-02' }, NY, now) === 'Today');
}

// ---- 2. what's kept from the Sheet ----
{
  const now = Date.UTC(2026, 9, 2, 12);
  const s = slim({
    lists: [{ id: 'l1', name: 'Personal' }],
    todos: [
      { id: 'a', title: 'Call mum', list: 'l1', date: '2026-10-02', time: '17:30', notes: 'private words', done: false },
      { id: 'b', title: 'Done already', list: 'l1', date: '2026-10-02', done: true },
      { id: 'c', title: 'Last year', list: 'l1', date: '2025-10-02' },
      { id: 'd', title: 'No date', list: 'l1', date: null },
    ],
    notes: [
      { id: 'n1', title: 'Dentist', body: 'secret body', reminder: '2026-10-02T14:00:00.000Z' },
      { id: 'n2', title: 'Archived', body: '', reminder: '2026-10-02T14:00:00.000Z', archived: true },
      { id: 'n3', title: '', body: 'First line\nsecond', reminder: '2026-10-03T14:00:00.000Z' },
      { id: 'n4', title: 'Old nudge', body: '', reminder: '2026-09-01T14:00:00.000Z' },
    ],
  }, now);
  ok('2. keeps open, dated, recent reminders only', s.todos.map(t => t.id).join() === 'a');
  ok('2. keeps no reminder notes and no note text', !JSON.stringify(s).includes('private words') && !JSON.stringify(s).includes('secret body'));
  ok('2. nudges: live ones only; untitled notes use their first line', s.nudges.map(n => n.id + '=' + n.title).join() === 'n1=Dentist,n3=First line');
}

// ---- 3. subscribing ----
const A = phone('a'), B = phone('b');
{
  const w = world();
  const k1 = await call(w, '/key', null, undefined), k2 = await call(w, '/key');
  ok('3. /key makes the push key once and keeps it', k1.body.key && k1.body.key === k2.body.key && b64u.dec(k1.body.key).length === 65);
  ok('3. CORS: allowed for the app\'s address only', k2.headers.get('Access-Control-Allow-Origin') === 'https://tomallison24.github.io' && !(await call(w, '/key', null, 'https://evil.example')).headers.get('Access-Control-Allow-Origin'));

  const sub = ph => ({ endpoint: ph.endpoint, keys: ph.keys });
  let r = await call(w, '/subscribe', { subscription: sub(A), prefs: NY });
  ok('3. no Sheet link: refused', r.status === 403 && r.body.error === 'no-sheet');
  r = await call(w, '/subscribe', { subscription: sub(A), sheet: { url: SHEET, secret: 'guess' }, prefs: NY });
  ok('3. wrong secret: refused, as the Sheet says', r.status === 403 && r.body.error === 'wrong-secret');
  r = await call(w, '/subscribe', { subscription: { endpoint: 'https://evil.example/x', keys: A.keys }, sheet: { url: SHEET, secret: 'maple-otter' }, prefs: NY });
  ok('3. a push address that isn\'t a real push service: refused', r.status === 400);
  r = await call(w, '/subscribe', { subscription: sub(A), sheet: { url: 'https://example.com/exec', secret: 'x' }, prefs: NY });
  ok('3. a "Sheet" that isn\'t an Apps Script link: refused without fetching it', r.status === 403 && r.body.error === 'no-sheet');
  r = await call(w, '/subscribe', { subscription: sub(A), sheet: { url: SHEET, secret: 'maple-otter' }, prefs: { ...NY, skip: ['l3'] } });
  ok('3. the right link and secret: subscribed', r.status === 200 && r.body.ok);
  const calls = w.sheetCalls;
  r = await call(w, '/subscribe', { subscription: sub(B), sheet: { url: SHEET, secret: 'maple-otter' }, prefs: { ...NY, nudges: false } });
  ok('3. the second phone, same link and secret: subscribed without asking the Sheet again', r.status === 200 && w.sheetCalls === calls);
  const subs = await w.env.PUSH.get('subs', 'json');
  ok('3. each phone keeps its own choices', Object.values(subs).map(s => s.skip.join('') + '/' + s.nudges).sort().join() === '/false,l3/true');
  r = await call(w, '/subscribe', { subscription: sub(phone('x')), sheet: { url: OTHER, secret: 'someone-else' }, prefs: NY });
  ok('3. someone else\'s Sheet can\'t take over the server', r.status === 403 && r.body.error === 'other-sheet');
  w.secrets[SHEET] = 'new-secret';
  r = await call(w, '/subscribe', { subscription: sub(A), sheet: { url: SHEET, secret: 'new-secret' }, prefs: NY });
  ok('3. after the secret is changed in the script, the new one takes over', r.status === 200 && (await w.env.PUSH.get('sheet', 'json')).secret === 'new-secret');
  r = await call(w, '/refresh', { endpoint: 'https://web.push.apple.com/nobody' });
  ok('3. /refresh from a phone that isn\'t subscribed: refused', r.status === 403);
  r = await call(w, '/refresh', { endpoint: A.endpoint });
  ok('3. /refresh from a subscribed phone reads the Sheet', r.status === 200 && r.body.ok);
  r = await call(w, '/test', { endpoint: A.endpoint });
  const last = w.pushed.at(-1);
  ok('3. /test reaches only that phone, and it can read it', r.status === 200 && last.endpoint === A.endpoint && decrypt(last.body, A).body === 'Notifications are working.');
  let other = false; try { decrypt(last.body, B); } catch { other = true; }
  ok('3. the other phone (or Apple) can\'t read it', other);
  r = await call(w, '/unsubscribe', { endpoint: B.endpoint });
  ok('3. /unsubscribe forgets the phone', r.status === 200 && Object.keys(await w.env.PUSH.get('subs', 'json')).length === 1);
}

// ---- 4. every minute ----
{
  const w = world();
  const due = Date.UTC(2026, 9, 2, 21, 30);                   // 5:30 PM in New York
  w.todos = [
    { id: 't1', title: 'Pick up Sofia', list: 'l1', date: '2026-10-02', time: '17:30', done: false },
    { id: 't2', title: 'Milk', list: 'l3', date: '2026-10-02', time: '17:30', done: false },
    { id: 't3', title: 'Bins out', list: 'l1', date: '2026-10-02', time: '17:45', alert: 15, done: false },
    { id: 't4', title: 'Quiet one', list: 'l1', date: '2026-10-02', time: '17:30', alert: -1, done: false },
    { id: 't5', title: 'Done', list: 'l1', date: '2026-10-02', time: '17:30', done: true },
  ];
  w.notes = [{ id: 'n1', title: 'Book the dentist', body: 'x', reminder: new Date(due).toISOString() }];
  const sub = ph => ({ endpoint: ph.endpoint, keys: ph.keys });
  await call(w, '/subscribe', { subscription: sub(A), sheet: { url: SHEET, secret: 'maple-otter' }, prefs: { ...NY, skip: ['l3'] } });
  await call(w, '/subscribe', { subscription: sub(B), sheet: { url: SHEET, secret: 'maple-otter' }, prefs: { ...NY, nudges: false } });

  let r = await tick(w.env, w.fetch, due - 2 * MIN);
  ok('4. nothing due yet: nothing sent', r.sent === 0 && w.pushed.length === 0, JSON.stringify(r));
  r = await tick(w.env, w.fetch, due + 20e3);
  const got = ph => w.pushed.filter(p => p.endpoint === ph.endpoint).map(p => decrypt(p.body, ph));
  const a = got(A), b = got(B);
  ok('4. phone A: its reminders (not Groceries) and the nudge', a.map(m => m.title).sort().join('|') === 'Bins out|Book the dentist|Pick up Sofia', a.map(m => m.title).join('|'));
  ok('4. phone B: Groceries too, but no nudges', b.map(m => m.title).sort().join('|') === 'Bins out|Milk|Pick up Sofia', b.map(m => m.title).join('|'));
  const sofia = a.find(m => m.title === 'Pick up Sofia'), bins = a.find(m => m.title === 'Bins out');
  ok('4. the wording: list and time', sofia.body === 'Personal · 5:30 PM' && bins.body === 'Personal · In 15 min, 5:45 PM', sofia.body + ' / ' + bins.body);
  ok('4. tapping it opens that reminder', sofia.open === 'todo:t1' && sofia.tag === 'todo:t1' && a.find(m => m.title === 'Book the dentist').open === 'note:n1');
  ok('4. sent with a short life and high urgency (an alert, not news)', w.pushed[0].headers.TTL === '3600' && w.pushed[0].headers.Urgency === 'high');
  const n = w.pushed.length;
  r = await tick(w.env, w.fetch, due + 80e3);
  ok('4. the next minute: nothing sent twice', w.pushed.length === n && r.sent === 0);

  // Moved to later in the app: the phone pings, and the new time alerts.
  w.todos[0] = { ...w.todos[0], time: '17:40' };
  await call(w, '/refresh', { endpoint: A.endpoint });
  await tick(w.env, w.fetch, due + 10 * MIN + 5e3);
  ok('4. a reminder moved to a later time alerts again at the new time', got(A).filter(m => m.title === 'Pick up Sofia').length === 2);

  // More than three at once: one notification listing them.
  const w2 = world();
  w2.todos = ['A', 'B', 'C', 'D'].map((x, i) => ({ id: 'm' + i, title: 'Thing ' + x, list: 'l1', date: '2026-10-02', time: '17:30', done: false }));
  await call(w2, '/subscribe', { subscription: sub(A), sheet: { url: SHEET, secret: 'maple-otter' }, prefs: NY });
  await tick(w2.env, w2.fetch, due + 5e3);
  const many = w2.pushed.map(p => decrypt(p.body, A));
  ok('4. four due together: one notification that lists them', many.length === 1 && many[0].title === '4 reminders' && many[0].body === 'Thing A, Thing B, Thing C, Thing D' && many[0].open === 'rem');

  // Too late (the server was down): not sent.
  const w3 = world();
  w3.todos = [{ id: 'z', title: 'Long gone', list: 'l1', date: '2026-10-02', time: '17:30', done: false }];
  await call(w3, '/subscribe', { subscription: sub(A), sheet: { url: SHEET, secret: 'maple-otter' }, prefs: NY });
  await tick(w3.env, w3.fetch, due + 11 * MIN);
  ok('4. more than 10 minutes late: not sent', w3.pushed.length === 0);
  await tick(w3.env, w3.fetch, due + 9 * MIN);
  ok('4. up to 10 minutes late: sent', w3.pushed.length === 1);

  // Sheet reads: every 15 minutes, not every minute; and KV only written on change.
  const w4 = world();
  w4.todos = [{ id: 'y', title: 'Later', list: 'l1', date: '2026-10-05', time: '09:00', done: false }];
  await call(w4, '/key');                                     // as the phone does first
  await call(w4, '/subscribe', { subscription: sub(A), sheet: { url: SHEET, secret: 'maple-otter' }, prefs: NY });
  const base = Math.floor(due / (15 * MIN)) * 15 * MIN;       // a quarter hour
  const c0 = w4.sheetCalls, kv0 = w4.env.PUSH.writes;
  for (let i = 1; i < 15; i++) await tick(w4.env, w4.fetch, base + i * MIN);
  ok('4. 14 quiet minutes: the Sheet isn\'t read and nothing is written', w4.sheetCalls === c0 && w4.env.PUSH.writes === kv0, (w4.sheetCalls - c0) + ' reads, ' + (w4.env.PUSH.writes - kv0) + ' writes');
  await tick(w4.env, w4.fetch, base + 15 * MIN);
  ok('4. on the quarter hour: read once, unchanged, so not written', w4.sheetCalls === c0 + 1 && w4.env.PUSH.writes === kv0);
  w4.sheetDown = true;
  w4.todos = [];
  r = await tick(w4.env, w4.fetch, base + 30 * MIN);
  ok('4. the Sheet unreachable: carries on with what it last read', r.pulled === 'network' && r.sent === 0);

  // The phone turned notifications off (Apple says 410): forgotten.
  const w5 = world();
  w5.todos = [{ id: 'q', title: 'Gone phone', list: 'l1', date: '2026-10-02', time: '17:30', done: false }];
  await call(w5, '/subscribe', { subscription: sub(A), sheet: { url: SHEET, secret: 'maple-otter' }, prefs: NY });
  w5.pushStatus = 410;
  await tick(w5.env, w5.fetch, due + 5e3);
  ok('4. a phone Apple says is gone is forgotten', Object.keys(await w5.env.PUSH.get('subs', 'json')).length === 0);
  r = await tick(w5.env, w5.fetch, due + 65e3);
  ok('4. nobody subscribed: the minute is skipped', r.skipped === 'nobody subscribed');

  // Time zones: the same reminder alerts each phone at its own 5:30 PM.
  const la = dueFor({ todos: [{ id: 'x', title: 'x', list: 'l1', date: '2026-10-02', time: '17:30' }], nudges: [], lists: {} }, { ...NY, tz: 'America/Los_Angeles' }, 's', Date.UTC(2026, 9, 3, 0, 30), {});
  ok('4. a phone in Los Angeles gets it at 5:30 PM there', la.length === 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
