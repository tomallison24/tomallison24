// Checks functions/calendar/api/[[route]].js (the CalDAV function) in plain
// Node, with iCloud and Cloudflare's cache stubbed out: the header guard,
// the three-step lookup of the Family calendar (with iCloud's redirect to a
// numbered server), listing events, writing, deleting, the "changed
// elsewhere" case, imports from Travel and Notes, and the error cases. The
// XML is shaped like iCloud's replies as documented for CalDAV (RFC 4791);
// the real service was not called from here.
//
//   node calendar/scripts/api-test.mjs
import fs from 'fs';
import assert from 'assert/strict';

const src = fs.readFileSync(new URL('../../functions/calendar/api/[[route]].js', import.meta.url), 'utf8');
const { onRequest } = await import('data:text/javascript,' + encodeURIComponent(src));

const store = new Map();
globalThis.caches = { default: {
  match: async req => { const r = store.get(req.url); return r ? r.clone() : undefined; },
  put: async (req, res) => { store.set(req.url, res.clone()); },
  delete: async req => store.delete(req.url),
} };

// ---- a pretend iCloud ----
const HOME = 'https://p50-caldav.icloud.com/123456/calendars/';
const FAMILY = HOME + 'ABCD-1234/';
let calls = [];
const files = new Map();      // name -> {etag, ics}
let auth = 'ok';
const ms = (...parts) => `<?xml version="1.0" encoding="UTF-8"?><multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/" xmlns:A="http://apple.com/ns/ical/">${parts.join('')}</multistatus>`;
const xmlEsc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
globalThis.fetch = async (url, init) => {
  const u = new URL(url);
  calls.push({ url: u.href, method: init.method, headers: init.headers, body: init.body });
  if (init.redirect !== 'manual') throw new Error('redirects must be followed by hand');
  if (auth !== 'ok') return new Response('', { status: 401 });
  if (u.hostname === 'caldav.icloud.com') return new Response('', { status: 301, headers: { Location: 'https://p50-caldav.icloud.com' + u.pathname } });
  if (u.hostname !== 'p50-caldav.icloud.com') return new Response('', { status: 500 });
  if (init.method === 'PROPFIND' && u.pathname === '/') return new Response(ms('<response><href>/</href><propstat><prop><current-user-principal><href>/123456/principal/</href></current-user-principal></prop><status>HTTP/1.1 200 OK</status></propstat></response>'), { status: 207 });
  if (init.method === 'PROPFIND' && u.pathname === '/123456/principal/') return new Response(ms(`<response><href>/123456/principal/</href><propstat><prop><C:calendar-home-set><href>${HOME}</href></C:calendar-home-set></prop><status>HTTP/1.1 200 OK</status></propstat></response>`), { status: 207 });
  if (init.method === 'PROPFIND' && u.href === HOME) return new Response(ms(
    '<response><href>/123456/calendars/</href><propstat><prop><displayname>Tom</displayname><resourcetype><collection/></resourcetype></prop><status>HTTP/1.1 200 OK</status></propstat></response>',
    '<response><href>/123456/calendars/home/</href><propstat><prop><displayname>Home</displayname><resourcetype><collection/><C:calendar/></resourcetype><C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set><A:calendar-color>#1BADF8FF</A:calendar-color></prop><status>HTTP/1.1 200 OK</status></propstat></response>',
    '<response><href>/123456/calendars/ABCD-1234/</href><propstat><prop><displayname>Family</displayname><resourcetype><collection/><C:calendar/></resourcetype><C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set><A:calendar-color>#FF2968FF</A:calendar-color><CS:getctag>ctag-1</CS:getctag></prop><status>HTTP/1.1 200 OK</status></propstat></response>',
    '<response><href>/123456/calendars/tasks/</href><propstat><prop><displayname>Reminders</displayname><resourcetype><collection/><C:calendar/></resourcetype><C:supported-calendar-component-set><C:comp name="VTODO"/></C:supported-calendar-component-set></prop><status>HTTP/1.1 200 OK</status></propstat></response>',
    '<response><href>/123456/calendars/inbox/</href><propstat><prop><displayname>Family</displayname><resourcetype><collection/><C:schedule-inbox/></resourcetype></prop><status>HTTP/1.1 200 OK</status></propstat></response>'), { status: 207 });
  if (init.method === 'REPORT' && u.href === FAMILY) {
    const rows = [...files].map(([name, f]) => `<response><href>/123456/calendars/ABCD-1234/${name}</href><propstat><prop><getetag>${xmlEsc(f.etag)}</getetag><C:calendar-data>${xmlEsc(f.ics)}</C:calendar-data></prop><status>HTTP/1.1 200 OK</status></propstat></response>`);
    return new Response(ms(...rows), { status: 207 });
  }
  if (u.href.startsWith(FAMILY)) {
    const name = decodeURIComponent(u.href.slice(FAMILY.length));
    const have = files.get(name);
    if (init.method === 'PUT') {
      if (init.headers['If-None-Match'] === '*' && have) return new Response('', { status: 412 });
      if (init.headers['If-Match'] && (!have || have.etag !== init.headers['If-Match'])) return new Response('', { status: 412 });
      const etag = '"v' + (files.size + 1) + '-' + Math.random().toString(36).slice(2, 6) + '"';
      files.set(name, { etag, ics: init.body });
      return new Response(have ? null : '', { status: have ? 204 : 201, headers: { ETag: etag } });
    }
    if (init.method === 'DELETE') {
      if (!have) return new Response('', { status: 404 });
      if (init.headers['If-Match'] && have.etag !== init.headers['If-Match']) return new Response('', { status: 412 });
      files.delete(name); return new Response(null, { status: 204 });
    }
  }
  return new Response('', { status: 404 });
};

const call = async (method, path, { body, headers = {}, env = { ICLOUD_APPLE_ID: 'tom@example.com', ICLOUD_APP_PASSWORD: 'abcd-efgh-ijkl-mnop' }, guard = true } = {}) => {
  const h = Object.assign(guard ? { 'X-Calendar': '1' } : {}, headers);
  const request = new Request('https://site.example/calendar/api/' + path, { method, headers: h, body });
  const route = path.split('?')[0].split('/');
  const res = await onRequest({ request, params: { route }, env, waitUntil: () => {} });
  return { status: res.status, body: await res.json(), headers: res.headers };
};
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const ICS = (uid, summary, extra = '') => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Allison OS//Calendar//EN\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:20260929T120000Z\r\nDTSTART;TZID=America/Denver:20261016T190000\r\nDTEND;TZID=America/Denver:20261016T200000\r\nSUMMARY:${summary}\r\n${extra}END:VEVENT\r\nEND:VCALENDAR\r\n`;

await test('refuses requests without the app header', async () => {
  const r = await call('GET', 'ping', { guard: false });
  assert.equal(r.status, 404); assert.equal(calls.length, 0);
});
await test('ping without the secrets says so and calls nothing', async () => {
  const r = await call('GET', 'ping', { env: {} });
  assert.deepEqual(r.body, { ok: true, configured: false }); assert.equal(calls.length, 0);
  const r2 = await call('GET', 'events?start=20261001T000000Z&end=20261101T000000Z', { env: {} });
  assert.equal(r2.status, 503); assert.equal(r2.body.error, 'no-account');
});
await test('finds the Family calendar in three steps, following the redirect, and remembers it', async () => {
  const r = await call('GET', 'ping');
  assert.deepEqual(r.body, { ok: true, configured: true, calendar: { name: 'Family', color: '#FF2968' } });
  assert.deepEqual(calls.map(c => c.method + ' ' + c.url), [
    'PROPFIND https://caldav.icloud.com/', 'PROPFIND https://p50-caldav.icloud.com/', 'PROPFIND https://p50-caldav.icloud.com/123456/principal/', 'PROPFIND ' + HOME]);
  assert.equal(calls[0].headers.Authorization, 'Basic ' + Buffer.from('tom@example.com:abcd-efgh-ijkl-mnop').toString('base64'));
  assert.equal(calls[1].headers.Depth, '0'); assert.equal(calls[3].headers.Depth, '1');
  calls = [];
  await call('GET', 'ping');
  assert.equal(calls.length, 0, 'the second ping comes from the cache');
});
await test('a wrong password is reported as auth, not as a crash', async () => {
  store.clear(); auth = 'bad';
  const r = await call('GET', 'ping');
  assert.equal(r.body.error, 'auth');
  auth = 'ok';
});
await test('a calendar of another name lists what is there', async () => {
  store.clear();
  const r = await call('GET', 'ping', { env: { ICLOUD_APPLE_ID: 'tom@example.com', ICLOUD_APP_PASSWORD: 'x', ICLOUD_CALENDAR: 'Elena' } });
  assert.equal(r.body.error, 'no-calendar'); assert.deepEqual(r.body.calendars, ['Home', 'Family']);
  store.clear();
});
await test('lists the events in a time range', async () => {
  files.set('A1.ics', { etag: '"e1"', ics: ICS('A1', 'Dentist & <check>') });
  files.set('B2.ics', { etag: '"e2"', ics: ICS('B2', 'School run') });
  calls = [];
  const r = await call('GET', 'events?start=20261001T000000Z&end=20261101T000000Z');
  assert.equal(r.status, 200); assert.equal(r.body.items.length, 2);
  assert.equal(r.body.items[0].name, 'A1.ics'); assert.equal(r.body.items[0].etag, '"e1"');
  assert.ok(r.body.items[0].ics.includes('SUMMARY:Dentist & <check>'), 'XML escapes undone');
  assert.equal(r.body.calendar.color, '#FF2968');
  const rep = calls.find(c => c.method === 'REPORT');
  assert.equal(rep.url, FAMILY);
  assert.ok(rep.body.includes('<c:time-range start="20261001T000000Z" end="20261101T000000Z"/>'));
  assert.equal(rep.headers.Depth, '1');
  for (const q of ['start=2026-10-01&end=20261101T000000Z', 'start=20261101T000000Z&end=20261001T000000Z', 'start=20261001T000000Z']) assert.equal((await call('GET', 'events?' + q)).status, 400, q);
});
await test('writes a new event, refuses to write over one it did not read, updates with the etag', async () => {
  const r = await call("PUT", "event?name=C3.ics", { body: ICS("C3", "Piano") });
  assert.equal(r.status, 200); assert.equal(r.body.name, 'C3.ics'); assert.ok(r.body.etag.startsWith('"v'));
  const put = calls[calls.length - 1];
  assert.equal(put.url, FAMILY + 'C3.ics'); assert.equal(put.headers['If-None-Match'], '*'); assert.equal(put.headers['Content-Type'], 'text/calendar; charset=utf-8');
  const again = await call('PUT', 'event?name=C3.ics', { body: ICS('C3', 'Piano 2') });
  assert.equal(again.status, 412); assert.equal(again.body.error, 'changed');
  const stale = await call('PUT', 'event?name=C3.ics', { body: ICS('C3', 'Piano 2'), headers: { 'If-Match': '"old"' } });
  assert.equal(stale.status, 412);
  const ok = await call('PUT', 'event?name=C3.ics', { body: ICS('C3', 'Piano 2'), headers: { 'If-Match': r.body.etag } });
  assert.equal(ok.status, 200); assert.ok(files.get('C3.ics').ics.includes('SUMMARY:Piano 2'));
  const force = await call('PUT', 'event?name=C3.ics&overwrite=1', { body: ICS('C3', 'Piano 3') });
  assert.equal(force.status, 200); assert.ok(files.get('C3.ics').ics.includes('SUMMARY:Piano 3'));
});
await test('rejects odd names and non-calendar bodies', async () => {
  for (const name of ['../x.ics', 'a/b.ics', 'C3', '', 'x y.ics', 'https://evil.example/x.ics']) {
    const r = await call('PUT', 'event?name=' + encodeURIComponent(name), { body: ICS('Z', 'z') });
    assert.equal(r.status, 400, name);
  }
  assert.equal((await call('PUT', 'event?name=D4.ics', { body: '<html>hi</html>' })).status, 400);
  assert.equal((await call('PUT', 'event?name=D4.ics', { body: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n' })).status, 400, 'no event inside');
  assert.equal(calls.filter(c => c.url.endsWith('D4.ics')).length, 0, 'nothing reached iCloud');
});
await test('deletes, with and without the etag; deleting what is gone is fine', async () => {
  const etag = files.get('C3.ics').etag;
  assert.equal((await call('DELETE', 'event?name=C3.ics', { headers: { 'If-Match': '"nope"' } })).status, 412);
  assert.equal((await call('DELETE', 'event?name=C3.ics', { headers: { 'If-Match': etag } })).status, 200);
  assert.equal(files.has('C3.ics'), false);
  const r = await call('DELETE', 'event?name=C3.ics');
  assert.equal(r.status, 200); assert.equal(r.body.gone, true);
});
await test('imports a Travel trip: one file per event, named after the UID, same UID replaces', async () => {
  const trip = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Allison OS//Travel//EN\r\nCALSCALE:GREGORIAN\r\n'
    + 'BEGIN:VEVENT\r\nUID:bk1@allison-travel\r\nDTSTAMP:20260929T120000Z\r\nDTSTART:20261016T130500Z\r\nDTEND:20261016T175000Z\r\nSUMMARY:✈ UA 1234 DEN → BOS\r\nEND:VEVENT\r\n'
    + 'BEGIN:VEVENT\r\nUID:bk2@allison-travel\r\nDTSTAMP:20260929T120000Z\r\nDTSTART;VALUE=DATE:20261016\r\nDTEND;VALUE=DATE:20261020\r\nSUMMARY:🏨 Courtyard Boston\r\nEND:VEVENT\r\n'
    + 'END:VCALENDAR\r\n';
  const r = await call('POST', 'import', { body: trip });
  assert.equal(r.status, 200); assert.deepEqual(r.body.names, ['bk1@allison-travel.ics', 'bk2@allison-travel.ics']);
  const f = files.get('bk1@allison-travel.ics').ics;
  assert.ok(f.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Allison OS//Travel//EN\r\nCALSCALE:GREGORIAN\r\nBEGIN:VEVENT\r\nUID:bk1@allison-travel'));
  assert.ok(!f.includes('bk2@allison-travel'), 'one event per file');
  assert.ok(f.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n'));
  const r2 = await call('POST', 'import', { body: trip.replace('UA 1234', 'UA 1234 (new time)') });
  assert.equal(r2.status, 200); assert.ok(files.get('bk1@allison-travel.ics').ics.includes('(new time)')); assert.equal(files.size, 4);
  // Notes' file, with a line-feed-only ending and a zone block
  const note = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Allison OS//Notes//EN\nBEGIN:VTIMEZONE\nTZID:America/Denver\nBEGIN:STANDARD\nDTSTART:19701101T020000\nTZOFFSETFROM:-0600\nTZOFFSETTO:-0700\nEND:STANDARD\nEND:VTIMEZONE\nBEGIN:VEVENT\nUID:t9@allison-notes\nDTSTAMP:20260929T120000Z\nDTSTART;TZID=America/Denver:20261016T090000\nDTEND;TZID=America/Denver:20261016T093000\nSUMMARY:Call the plumber\nEND:VEVENT\nEND:VCALENDAR\n';
  const r3 = await call('POST', 'import', { body: note });
  assert.deepEqual(r3.body.names, ['t9@allison-notes.ics']);
  assert.ok(files.get('t9@allison-notes.ics').ics.includes('BEGIN:VTIMEZONE\r\nTZID:America/Denver'));
  assert.equal((await call('POST', 'import', { body: 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:no uid\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n' })).status, 400);
});
await test('a calendar that vanished is looked up afresh next time', async () => {
  const r = await call('POST', 'forget');
  assert.equal(r.body.ok, true); assert.equal(store.size, 0);
  calls = [];
  await call('GET', 'ping');
  assert.equal(calls.filter(c => c.method === 'PROPFIND').length, 4);
});
await test('replies carry the safety headers', async () => {
  const r = await call('GET', 'ping');
  assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(r.headers.get('Content-Security-Policy'), "sandbox; default-src 'none'");
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
});
await test('never talks to a host that is not iCloud, even on a redirect', async () => {
  store.clear();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url) }); return new Response('', { status: 301, headers: { Location: 'https://evil.example/steal' } }); };
  calls = [];
  const r = await call('GET', 'ping');
  assert.equal(r.body.error, 'bad-host');
  assert.equal(calls.length, 1);
  globalThis.fetch = realFetch;
});

console.log('\n' + n + ' tests passed');
