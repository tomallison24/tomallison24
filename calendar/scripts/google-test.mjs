// Your own Google calendar in Calendar (server/gcal.js; functions/calendar/api google/*; the sign-in is aOS's,
// server/gmail.js kind 'calendar'), in plain Node on an in-memory stand-in for Workers KV, with a stand-in for
// Google: read-only; kept apart from the Gmail sign-ins; yours is seen only by you until you share it; shared, the
// family sees titles, places and times but never notes or links, and a private event only as Busy; stopping sharing,
// disconnecting and the 30 days each end it; off until the client secret is set.
//   node calendar/scripts/google-test.mjs
import assert from 'assert/strict';
import { onRequest as aos } from '../../functions/aOS/api/[[route]].js';
import { onRequest as calendar } from '../../functions/calendar/api/[[route]].js';
import { issue, putJSON, getJSON } from '../../server/auth.js';
import { DAYS, SCOPES } from '../../server/gmail.js';
import { shape } from '../../server/gcal.js';

function fakeKV() {
  const m = new Map();
  return {
    m,
    get: async k => (m.has(k) ? m.get(k) : null),
    put: async (k, v) => { m.set(k, String(v)); },
    delete: async k => { m.delete(k); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }),
  };
}
const SITE = 'https://site.example';
const db = fakeKV();
const ON = { ACCOUNTS: db, GOOGLE_CLIENT_SECRET: 'made-up-secret' }, OFF = { ACCOUNTS: db };

// Google, made up. A code: 'good' (Pat's calendar), 'kim' (Kim's), 'nocal' (the calendar box unticked).
// Each refresh token's calendar has its own events; RT-1 is Pat's.
const google = { revoked: new Set(), calls: [], n: 0, owner: {} };
const EVENTS = {
  'pat@example.com': [
    { id: 'e1', status: 'confirmed', summary: 'Dentist', location: '12 Main St', description: 'Bring the <b>card</b><br>Floor 2', htmlLink: 'https://www.google.com/calendar/event?eid=e1', start: { dateTime: '2026-11-20T15:00:00-05:00' }, end: { dateTime: '2026-11-20T16:00:00-05:00' } },
    { id: 'e2', status: 'confirmed', summary: 'Therapy', location: 'Clinic', description: 'private notes', visibility: 'private', start: { dateTime: '2026-11-21T09:00:00-05:00' }, end: { dateTime: '2026-11-21T10:00:00-05:00' } },
    { id: 'e3', status: 'confirmed', summary: 'Conference', start: { date: '2026-11-24' }, end: { date: '2026-11-26' }, transparency: 'transparent' },
    { id: 'e4', status: 'cancelled', summary: 'Gone', start: { dateTime: '2026-11-22T09:00:00Z' }, end: { dateTime: '2026-11-22T10:00:00Z' } },
    { id: 'e5', eventType: 'workingLocation', summary: 'Home', start: { date: '2026-11-23' }, end: { date: '2026-11-24' } },
  ],
  'kim@example.com': [{ id: 'k1', summary: 'Kim\'s run', start: { dateTime: '2026-11-20T07:00:00Z' }, end: { dateTime: '2026-11-20T08:00:00Z' } }],
};
const realFetch = globalThis.fetch;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const fakeGoogle = async (url, opts = {}) => {
  const u = String(url), form = new URLSearchParams(opts.body || '');
  google.calls.push({ url: u, form: Object.fromEntries(form), auth: opts.headers && opts.headers.Authorization });
  if (u === 'https://oauth2.googleapis.com/token') {
    assert.equal(form.get('client_secret'), 'made-up-secret');
    if (form.get('grant_type') === 'authorization_code') {
      const code = form.get('code'), rt = 'RT-' + (++google.n);
      if (!['good', 'kim', 'nocal'].includes(code)) return json({ error: 'invalid_grant' }, 400);
      google.owner[rt] = code === 'kim' ? 'kim@example.com' : 'pat@example.com';
      return json({ access_token: 'AT-' + rt, refresh_token: rt, expires_in: 3599, scope: code === 'nocal' ? 'openid' : SCOPES.calendar });
    }
    const rt = form.get('refresh_token');
    if (google.revoked.has(rt)) return json({ error: 'invalid_grant' }, 400);
    return json({ access_token: 'AT-' + rt, expires_in: 3599, scope: SCOPES.calendar });
  }
  if (u === 'https://oauth2.googleapis.com/revoke') { google.revoked.add(form.get('token')); return new Response('', { status: 200 }); }
  const rt = String(opts.headers && opts.headers.Authorization || '').replace('Bearer AT-', '');
  if (google.revoked.has(rt)) return json({ error: { code: 401 } }, 401);
  if (u === 'https://www.googleapis.com/calendar/v3/calendars/primary') return json({ id: google.owner[rt], summary: google.owner[rt] });
  if (u.startsWith('https://www.googleapis.com/calendar/v3/calendars/primary/events?')) {
    const q = new URL(u).searchParams;
    assert.equal(q.get('singleEvents'), 'true', 'repeats laid out by Google');
    assert.match(q.get('timeMin'), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    return json({ items: EVENTS[google.owner[rt]] || [] });
  }
  throw new Error('unexpected fetch ' + u);
};
globalThis.fetch = fakeGoogle;

let jar = '';
const callAOS = async (path, body, token, env = ON, query = '') => {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token; if (jar) h.Cookie = jar;
  const request = new Request(SITE + '/aOS/api/' + path + query, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await aos({ request, params: { route: path.split('/') }, env });
  const sc = res.headers.get('Set-Cookie') || '';
  if (sc) { const m = /aos_gm=([^;]*)/.exec(sc); jar = m && m[1] ? 'aos_gm=' + m[1] : ''; }
  let b = null; try { b = await res.json(); } catch {}
  return { status: res.status, body: b, location: res.headers.get('Location') };
};
const RANGE = '?start=20261101T000000Z&end=20261201T000000Z';
const cal = async (path, body, token, env = ON, query = '') => {
  const h = { 'X-Calendar': '1', 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const request = new Request(SITE + '/calendar/api/' + path + query, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await calendar({ request, params: { route: path.split('/') }, env }, fakeGoogle);
  let b = null; try { b = await res.json(); } catch {}
  return { status: res.status, body: b };
};
// a sign-in, all the way: start, Google, back
const connect = async (token, code, back = '/calendar/') => {
  const r = await callAOS('gmail/start', { kind: 'calendar', back }, token);
  const s = new URL(r.body.url).searchParams.get('state');
  return callAOS('gmail/back', undefined, null, ON, '?state=' + s + '&code=' + code);
};
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

await db.put('owner', 'u1');
await putJSON(db, 'user:u1', { id: 'u1', name: 'Pat', role: 'owner', created: 1 });
await putJSON(db, 'user:u2', { id: 'u2', name: 'Sam', role: 'member', created: 2 });
await putJSON(db, 'user:u3', { id: 'u3', name: 'Kim', role: 'member', created: 3 });
const pat = await issue(db, 'u1'), sam = await issue(db, 'u2'), kim = await issue(db, 'u3');

await test('off until the client secret is set; only signed-in family', async () => {
  const v = await cal('google', undefined, pat, OFF);
  assert.equal(v.status, 200); assert.equal(v.body.on, false);
  assert.equal((await cal('google/events', undefined, pat, OFF, RANGE)).status, 404);
  assert.equal((await cal('google', undefined, null)).status, 401);
  assert.equal((await cal('google/events', undefined, null, ON, RANGE)).status, 401);
  assert.equal((await cal('google', undefined, pat)).body.on, true);
  assert.equal((await cal('google', undefined, pat)).body.mine, null, 'nothing connected yet');
});

await test('the sign-in asks for the calendar, read-only, and nothing else', async () => {
  const r = await callAOS('gmail/start', { kind: 'calendar', back: '/calendar/' }, pat);
  const q = new URL(r.body.url).searchParams;
  assert.equal(q.get('scope'), 'https://www.googleapis.com/auth/calendar.readonly');
  assert.equal(q.get('access_type'), 'offline');
  assert.equal(q.get('redirect_uri'), SITE + '/aOS/api/gmail/back', 'the same address Google already knows');
});

await test('back from Google: kept sealed, on its own (not with the Gmail sign-ins), and back with #gcal=', async () => {
  const r = await connect(pat, 'good');
  assert.equal(r.status, 302);
  assert.equal(r.location, SITE + '/calendar/#gcal=kept');
  const kept = await getJSON(db, 'gc:u1');
  assert.equal(kept.email, 'pat@example.com'); assert.equal(kept.share, false, 'not shared until you say so');
  assert.equal(await getJSON(db, 'gm:u1'), null, 'not in the Gmail list');
  assert.ok(![...db.m.values()].some(v => v.includes('RT-1')), 'the refresh token is nowhere in the KV as it is');
  assert.deepEqual((await callAOS('gmail', undefined, pat)).body.accounts, [], 'aOS\'s Gmail accounts don\'t show it');
  assert.equal((await callAOS('gmail/token', { kind: 'read' }, pat)).body.error, 'none', 'it never gives a Gmail key');
});

await test('a sign-in without the calendar ticked: nothing kept, revoked at Google', async () => {
  await putJSON(db, 'user:u9', { id: 'u9', name: 'Lee', role: 'member', created: 9 });
  const lee = await issue(db, 'u9');
  const r = await connect(lee, 'nocal');
  assert.equal(r.location, SITE + '/calendar/#gcal=error');
  assert.equal(await getJSON(db, 'gc:u9'), null);
  assert.ok(google.revoked.has('RT-' + google.n));
  await db.delete('user:u9');
});

await test('yours, in full, to you: notes as plain text, the link, private marked; cancelled and working places left out', async () => {
  const r = await cal('google/events', undefined, pat, ON, RANGE);
  assert.equal(r.status, 200);
  assert.equal(r.body.mine.email, 'pat@example.com');
  const ev = r.body.mine.events;
  assert.deepEqual(ev.map(e => e.id), ['e1', 'e2', 'e3']);
  assert.equal(ev[0].title, 'Dentist'); assert.equal(ev[0].location, '12 Main St');
  assert.equal(ev[0].notes, 'Bring the card\nFloor 2'); assert.match(ev[0].link, /^https:\/\/www\.google\.com\/calendar\//);
  assert.equal(ev[0].start, '2026-11-20T15:00:00-05:00'); assert.equal(ev[0].allDay, false);
  assert.equal(ev[1].private, true); assert.equal(ev[1].title, 'Therapy', 'your own private event, to you, in full');
  assert.equal(ev[2].allDay, true); assert.equal(ev[2].start, '2026-11-24'); assert.equal(ev[2].end, '2026-11-26'); assert.equal(ev[2].busy, false);
  assert.deepEqual(r.body.shared, []);
  assert.ok(!JSON.stringify(r.body).includes('RT-'), 'no Google key in the answer');
});

await test('not shared: nobody else in the family sees it', async () => {
  const r = await cal('google/events', undefined, sam, ON, RANGE);
  assert.equal(r.body.mine, null); assert.deepEqual(r.body.shared, []);
  assert.deepEqual((await cal('google', undefined, sam)).body.shared, []);
  assert.ok(!JSON.stringify(r.body).includes('Dentist'));
});

await test('an hour-long key is kept (sealed) and used again, not asked of Google each time', async () => {
  const before = google.calls.filter(c => c.url === 'https://oauth2.googleapis.com/token').length;
  await cal('google/events', undefined, pat, ON, RANGE);
  assert.equal(google.calls.filter(c => c.url === 'https://oauth2.googleapis.com/token').length, before);
  assert.ok(!(await db.get('gct:u1')).includes('AT-RT-1'), 'sealed');
});

await test('shared: the family sees titles, places and times; never notes or links; private only as Busy', async () => {
  const s = await cal('google/share', { share: true }, pat);
  assert.equal(s.status, 200); assert.equal(s.body.share, true);
  assert.deepEqual((await cal('google', undefined, sam)).body.shared, ['Pat']);
  const r = await cal('google/events', undefined, sam, ON, RANGE);
  assert.equal(r.body.mine, null);
  assert.equal(r.body.shared.length, 1); assert.equal(r.body.shared[0].who, 'Pat');
  const ev = r.body.shared[0].events;
  assert.deepEqual(ev.map(e => e.title), ['Dentist', 'Busy', 'Conference']);
  assert.equal(ev[0].location, '12 Main St');
  for (const e of ev) { assert.equal(e.notes, undefined); assert.equal(e.link, undefined); assert.equal(e.private, undefined); }
  assert.equal(ev[1].location, undefined, 'a private event: no place either');
  const text = JSON.stringify(r.body);
  for (const word of ['Therapy', 'Clinic', 'private notes', 'Bring the', 'pat@example.com']) assert.ok(!text.includes(word), word);
  const own = await cal('google/events', undefined, pat, ON, RANGE);
  assert.deepEqual(own.body.shared, [], 'your own isn\'t shown to you twice');
  assert.equal(own.body.mine.share, true);
});

await test('another person\'s calendar is kept apart from yours: each sees their own in full and the other\'s as shared', async () => {
  await connect(kim, 'kim');
  const k = await cal('google/events', undefined, kim, ON, RANGE);
  assert.equal(k.body.mine.email, 'kim@example.com');
  assert.deepEqual(k.body.mine.events.map(e => e.title), ['Kim\'s run']);
  assert.deepEqual(k.body.shared.map(p => p.who), ['Pat']);
  const p = await cal('google/events', undefined, pat, ON, RANGE);
  assert.deepEqual(p.body.shared, [], 'Kim hasn\'t shared');
});

await test('stop sharing: gone for the family at once', async () => {
  assert.equal((await cal('google/share', { share: false }, pat)).body.share, false);
  assert.deepEqual((await cal('google/events', undefined, sam, ON, RANGE)).body.shared, []);
  assert.equal((await cal('google/share', { share: true }, sam)).status, 409, 'nothing to share without a sign-in');
});

await test('connecting the same account again keeps sharing as it was; another account starts unshared', async () => {
  await cal('google/share', { share: true }, pat);
  await connect(pat, 'good');
  assert.equal((await getJSON(db, 'gc:u1')).share, true);
  assert.equal(google.revoked.has('RT-1'), false);
  assert.ok((await getJSON(db, 'gc:u3')).email === 'kim@example.com');
});

await test('only a real range is read', async () => {
  for (const q of ['', '?start=x&end=y', '?start=20261201T000000Z&end=20261101T000000Z', '?start=20200101T000000Z&end=20261101T000000Z'])
    assert.equal((await cal('google/events', undefined, pat, ON, q)).status, 400, q);
});

await test('after 30 days it ends: revoked at Google, deleted, and gone for the family too', async () => {
  const x = await getJSON(db, 'gc:u1'), rt = 'RT-' + Object.keys(google.owner).filter(k => google.owner[k] === 'pat@example.com').map(k => +k.slice(3)).sort((a, b) => b - a)[0];
  x.at = Date.now() - (DAYS + 1) * 864e5; await putJSON(db, 'gc:u1', x);
  const r = await cal('google/events', undefined, pat, ON, RANGE);
  assert.equal(r.body.mine.error, 'expired');
  assert.equal(await getJSON(db, 'gc:u1'), null);
  assert.ok(google.revoked.has(rt));
  assert.deepEqual((await cal('google/events', undefined, sam, ON, RANGE)).body.shared, []);
});

await test('Disconnect revokes at Google, deletes it and stops sharing', async () => {
  await connect(pat, 'good'); await cal('google/share', { share: true }, pat);
  const rt = 'RT-' + google.n;
  assert.equal((await cal('google/disconnect', {}, pat)).status, 200);
  assert.ok(google.revoked.has(rt));
  assert.equal(await getJSON(db, 'gc:u1'), null); assert.equal(await db.get('gct:u1'), null);
  assert.ok(!(await getJSON(db, 'gcshare') || []).includes('u1'));
  assert.deepEqual((await cal('google/events', undefined, sam, ON, RANGE)).body.shared, []);
});

await test('Google ending it (a new password): the person connects again, nothing breaks', async () => {
  await connect(pat, 'good');
  google.revoked.add('RT-' + google.n); await db.delete('gct:u1');
  const r = await cal('google/events', undefined, pat, ON, RANGE);
  assert.equal(r.body.mine.error, 'revoked');
  assert.equal(await getJSON(db, 'gc:u1'), null);
});

await test('someone removed from the family: their calendar is no longer shown', async () => {
  await cal('google/share', { share: true }, kim);
  assert.deepEqual((await cal('google/events', undefined, sam, ON, RANGE)).body.shared.map(p => p.who), ['Kim']);
  await putJSON(db, 'user:u3', { id: 'u3', name: 'Kim', role: 'member', created: 3, removed: Date.now() });
  assert.deepEqual((await cal('google/events', undefined, sam, ON, RANGE)).body.shared, []);
});

await test('shape: Google\'s odd ones are left out, not drawn wrong', async () => {
  assert.equal(shape(null, true), null);
  assert.equal(shape({ id: 'x', start: {} }, true), null);
  assert.equal(shape({ id: 'x', status: 'cancelled', start: { date: '2026-01-01' } }, true), null);
  assert.equal(shape({ id: 'x', visibility: 'confidential', summary: 'Secret', start: { date: '2026-01-01' }, end: { date: '2026-01-02' } }, false).title, 'Busy');
  assert.equal(shape({ id: 'x', htmlLink: 'https://evil.example/', summary: 'a', start: { date: '2026-01-01' } }, true).link, undefined);
});

globalThis.fetch = realFetch;
console.log('\n' + n + ' Google calendar tests passed');
