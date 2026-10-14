// Checks functions/travel/api/[[route]].js (the live flight status function)
// in plain Node, with AeroDataBox and Cloudflare's cache stubbed out: the
// header guard, input checks, what is sent to AeroDataBox, the trimmed
// answer, the 10-minute cache and the error cases. The answer's shape is
// taken from AeroDataBox's documentation as far as it could be read from
// here; the real service was not called.
//
//   node travel/scripts/api-test.mjs
import fs from 'fs';
import assert from 'assert/strict';

const src = fs.readFileSync(new URL('../../functions/travel/api/[[route]].js', import.meta.url), 'utf8');
const { onRequestGet, onRequestPost } = await import('data:text/javascript,' + encodeURIComponent(src));

const store = new Map();
globalThis.caches = { default: {
  match: async req => { const r = store.get(req.url); return r ? r.clone() : undefined; },
  put: async (req, res) => { store.set(req.url, res.clone()); },
} };
let calls = [], upstream = () => new Response('[]', { status: 200 });
globalThis.fetch = async (url, init) => { calls.push({ url: String(url), headers: init.headers }); return upstream(); };

const pending = [];
const call = async (path, { key = 'k-123', header = true, ai = '' } = {}) => {
  const request = new Request('https://site.example/travel/api/' + path, { headers: header ? { 'X-Travel': '1' } : {} });
  const route = path.split('?')[0].split('/');
  const res = await onRequestGet({ request, params: { route }, env: { ...(key ? { AERODATABOX_KEY: key } : {}), ...(ai ? { ANTHROPIC_API_KEY: ai } : {}) }, waitUntil: p => pending.push(p) });
  await Promise.all(pending.splice(0));
  return { status: res.status, body: await res.json(), headers: res.headers };
};
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

await test('refuses requests without the app header', async () => {
  const r = await call('flight?no=UA1234&date=2026-10-16', { header: false });
  assert.equal(r.status, 404); assert.equal(calls.length, 0);
});
await test('ping says whether the key is set', async () => {
  assert.deepEqual((await call('ping')).body, { ok: true, status: true, find: true, ai: false });
  assert.deepEqual((await call('ping', { key: '' })).body, { ok: true, status: false, find: false, ai: false });
});
await test('no key: says so, calls nothing', async () => {
  const r = await call('flight?no=UA1234&date=2026-10-16', { key: '' });
  assert.equal(r.status, 503); assert.equal(r.body.error, 'no-key'); assert.equal(calls.length, 0);
});
await test('rejects odd flight numbers and dates', async () => {
  for (const q of ['no=UA1234/../x&date=2026-10-16', 'no=UA1234&date=16/10/2026', 'no=&date=2026-10-16', 'no=https://x&date=2026-10-16'])
    assert.equal((await call('flight?' + q)).status, 400, q);
  assert.equal(calls.length, 0);
});
await test('asks AeroDataBox for that flight and trims the answer', async () => {
  upstream = () => new Response(JSON.stringify([{
    number: 'UA 1234', status: 'Delayed', isCargo: false, codeshareStatus: 'IsOperator', lastUpdatedUtc: '2026-10-16 10:01Z',
    airline: { name: 'United' }, aircraft: { model: 'Boeing 737-900', reg: 'N12345' },
    departure: { airport: { iata: 'DEN', municipalityName: 'Denver', timeZone: 'America/Denver' }, scheduledTime: { utc: '2026-10-16 13:05Z', local: '2026-10-16 07:05-06:00' },
      revisedTime: { utc: '2026-10-16 13:40Z', local: '2026-10-16 07:40-06:00' }, terminal: 'West', gate: 'B32', checkInDesk: '1-20' },
    arrival: { airport: { iata: 'BOS', name: 'Boston Logan' }, scheduledTime: { utc: '2026-10-16 17:50Z', local: '2026-10-16 13:50-04:00' }, baggageBelt: '4' },
  }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const r = await call('flight?no=ua1234&date=2026-10-16');
  assert.equal(r.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://aerodatabox.p.rapidapi.com/flights/number/UA1234/2026-10-16?withAircraftImage=false&withLocation=false&dateLocalRole=Departure');
  assert.equal(calls[0].headers['X-RapidAPI-Key'], 'k-123');
  const leg = r.body.legs[0];
  assert.equal(leg.status, 'Delayed'); assert.equal(leg.departure.gate, 'B32'); assert.equal(leg.departure.revised.utc, '2026-10-16 13:40Z');
  assert.equal(leg.arrival.belt, '4'); assert.equal(leg.aircraft, 'Boeing 737-900');
  assert.equal(JSON.stringify(r.body).includes('N12345'), false, 'no more than the app needs');
  assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff');
});
await test('a second ask within 10 minutes comes from the cache', async () => {
  const r = await call('flight?no=UA1234&date=2026-10-16');
  assert.equal(r.body.legs[0].departure.gate, 'B32'); assert.equal(calls.length, 1);
});
await test('limits and refusals come back as plain errors', async () => {
  upstream = () => new Response('', { status: 429 });
  assert.equal((await call('flight?no=DL1&date=2026-10-17')).body.error, 'limit');
  upstream = () => new Response('', { status: 403 });
  assert.equal((await call('flight?no=DL2&date=2026-10-17')).body.error, 'key-refused');
  upstream = () => new Response(null, { status: 204 });
  assert.deepEqual((await call('flight?no=DL3&date=2026-10-17')).body, { ok: true, found: false });
});

// ---- find: the one flight that fits ----
await test('find: asks the airport board for a window around the time and answers only when one flight fits', async () => {
  calls = [];
  upstream = () => new Response(JSON.stringify({ departures: [
    { number: 'F9 3073', airline: { iata: 'F9' }, isCargo: false, movement: { airport: { iata: 'CLE' }, scheduledTime: { local: '2026-11-02 16:04-05:00' } } },
    { number: 'F9 2101', airline: { iata: 'F9' }, isCargo: false, movement: { airport: { iata: 'MCO' }, scheduledTime: { local: '2026-11-02 16:30-05:00' } } },
    { number: 'DL 1500', airline: { iata: 'DL' }, isCargo: false, movement: { airport: { iata: 'CLE' }, scheduledTime: { local: '2026-11-02 16:10-05:00' } } },
  ] }), { status: 200 });
  const r = await call('find?airline=F9&from=RDU&to=CLE&date=2026-11-02&time=16:04');
  assert.equal(r.status, 200);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/flights\/airports\/iata\/RDU\/2026-11-02T14:49\/2026-11-02T17:19\?direction=Departure/);
  assert.deepEqual(r.body.candidates.map(c => c.number), ['3073']);
  const again = await call('find?airline=F9&from=RDU&to=CLE&date=2026-11-02&time=16:04');
  assert.equal(calls.length, 1, 'cached for an hour'); assert.equal(again.body.candidates.length, 1);
});
await test('find: odd input is refused, no key says so', async () => {
  calls = [];
  for (const q of ['airline=F9&from=RDU&date=2026-11-02', 'airline=F9&from=RDU&date=2026-11-02&time=4pm', 'airline=F9&from=R/U&date=2026-11-02&time=16:04', 'airline=&from=RDU&date=2026-11-02&time=16:04'])
    assert.equal((await call('find?' + q)).status, 400, q);
  assert.equal((await call('find?airline=F9&from=RDU&date=2026-11-02&time=16:04', { key: '' })).body.error, 'no-key');
  assert.equal(calls.length, 0);
});

// ---- extract: Claude reads one email for what is missing ----
const EMAIL = 'Your itinerary\nFlight 3073  Departs RDU 4:04 PM  Arrives CLE 5:51 PM\nMonday, Nov 2, 2026 is your travel day.\nFrontier Miles 40123456789 Elite Silver\nVisa ending 4242 total $209.98\nQuestions: jane.doe@example.com or 801-401-9000 https://www.flyfrontier.com/x';
const post = async (body, { key = 'sk-ant-test', header = true, raw } = {}) => {
  const request = new Request('https://site.example/travel/api/extract', { method: 'POST', headers: header ? { 'X-Travel': '1', 'Content-Type': 'application/json' } : {}, body: raw || JSON.stringify(body) });
  const res = await onRequestPost({ request, params: { route: ['extract'] }, env: key ? { ANTHROPIC_API_KEY: key } : {} });
  return { status: res.status, body: await res.json() };
};
const claude = (found, quotes, extra = {}) => () => new Response(JSON.stringify({ model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify({ found, quotes }) }], ...extra }), { status: 200 });
await test('extract: needs the header and the key', async () => {
  calls = [];
  assert.equal((await post({}, { header: false })).status, 404);
  assert.equal((await post({ type: 'flight', missing: ['date'], text: EMAIL }, { key: '' })).body.error, 'no-key');
  assert.equal((await post({ type: 'flight', missing: ['date'], text: EMAIL }, { raw: '{nope' })).status, 400);
  assert.equal((await post({ type: 'train', missing: ['date'], text: EMAIL })).status, 400);
  assert.equal((await post({ type: 'flight', missing: ['nothing'], text: EMAIL })).status, 400);
  assert.equal(calls.length, 0);
});
await test('extract: sends only a scrubbed excerpt and asks only for the missing fields', async () => {
  calls = [];
  let sent;
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), headers: init.headers }); sent = JSON.parse(init.body); return claude({ date: '2026-11-02' }, [{ field: 'date', quote: 'Monday, Nov 2, 2026' }])(); };
  const r = await post({ type: 'flight', missing: ['date', 'bogus'], known: { flightNo: '3073', from: 'RDU', evil: 'x' }, text: EMAIL, emailDate: '2026-10-13T18:54:05Z', subject: 'Booking Confirmation' });
  assert.equal(r.status, 200); assert.deepEqual(r.body.fields, { date: '2026-11-02' });
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(calls[0].headers['x-api-key'], 'sk-ant-test');
  assert.equal(sent.model, 'claude-haiku-5-5', 'reading an email for a missing detail is the small model'); assert.equal(sent.output_config.format.type, 'json_schema'); assert.equal(sent.output_config.effort, 'low');
  assert.equal('fallbacks' in sent, false, 'Haiku 5.5 has no server-side fallback, so none is asked for');
  assert.equal('anthropic-beta' in calls[0].headers, false);
  assert.deepEqual(Object.keys(sent.output_config.format.schema.properties.found.properties), ['date']);
  const prompt = sent.messages[0].content;
  assert.match(prompt, /Fields to fill in: date\n/); assert.match(prompt, /"flightNo":"3073"/); assert.equal(prompt.includes('evil'), false);
  for (const secret of ['40123456789', 'jane.doe', '801-401', 'flyfrontier.com', '4242', '209.98']) assert.equal(prompt.includes(secret), false, secret + ' was sent');
  assert.match(prompt, /Monday, Nov 2, 2026/);
});
await test('extract: an answer whose words are not in the email is thrown away', async () => {
  globalThis.fetch = async () => claude({ date: '2026-11-09', airlineCode: 'F9' }, [{ field: 'date', quote: 'November 9' }])();
  const r = await post({ type: 'flight', missing: ['date', 'airlineCode'], text: EMAIL });
  assert.deepEqual(r.body.fields, {});
});
await test('extract: wrong shapes are dropped, null stays unknown', async () => {
  globalThis.fetch = async () => claude({ date: 'next Monday', from: 'rdu', to: null, depTime: '25:99' }, [{ field: 'date', quote: 'Nov 2' }, { field: 'from', quote: 'Departs RDU' }, { field: 'depTime', quote: '4:04 PM' }])();
  const r = await post({ type: 'flight', missing: ['date', 'from', 'to', 'depTime'], text: EMAIL });
  assert.deepEqual(r.body.fields, { from: 'RDU' });
});
await test('extract: limits, refusals and garbage come back as plain answers', async () => {
  globalThis.fetch = async () => new Response('', { status: 429 });
  assert.equal((await post({ type: 'flight', missing: ['date'], text: EMAIL })).body.error, 'limit');
  globalThis.fetch = async () => new Response('', { status: 401 });
  assert.equal((await post({ type: 'flight', missing: ['date'], text: EMAIL })).body.error, 'key-refused');
  globalThis.fetch = async () => new Response(JSON.stringify({ stop_reason: 'refusal', content: [] }), { status: 200 });
  assert.equal((await post({ type: 'flight', missing: ['date'], text: EMAIL })).body.refused, true);
  globalThis.fetch = async () => new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }), { status: 200 });
  assert.deepEqual((await post({ type: 'flight', missing: ['date'], text: EMAIL })).body.fields, {});
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal((await post({ type: 'flight', missing: ['date'], text: EMAIL })).body.error, 'unreachable');
});
// ---- ask: a question about your trips ----
const postAsk = async (body, { key = 'sk-ant-test', header = true, raw } = {}) => {
  const request = new Request('https://site.example/travel/api/ask', { method: 'POST', headers: header ? { 'X-Travel': '1', 'Content-Type': 'application/json' } : {}, body: raw || JSON.stringify(body) });
  const res = await onRequestPost({ request, params: { route: ['ask'] }, env: key ? { ANTHROPIC_API_KEY: key } : {} });
  return { status: res.status, body: await res.json() };
};
const TRIPS = [
  { name: 'Cleveland', when: 'upcoming', items: [
    { id: 'f-1', kind: 'flight', flight: 'F9 3073', from: 'RDU', to: 'CLE', dep: '2026-11-02T16:04', arr: '2026-11-02T17:51', conf: 'ZQ4RTE', traveller: 'Pat Example', seat: '19A', notes: 'window please', source: { from: 'x@y.z', subject: 'secret subject' } },
    { id: 'h-1', kind: 'hotel', name: 'Courtyard Cleveland Beachwood', city: 'Beachwood', checkIn: '2026-11-02', checkOut: '2026-11-05', check: true, phone: '555-0100' }] },
  { name: 'Boston', when: 'past', items: [{ id: 'f-2', kind: 'flight', flight: 'UA 110', from: 'DEN', to: 'BOS', dep: '2026-03-04T20:15', status: 'cancelled' }] },
  { name: 'Needs a date', when: 'to check', items: [{ id: 'f-3', kind: 'flight', flight: 'F9 3074', from: 'CLE', to: 'RDU', check: true }, { id: 'bad id!', kind: 'flight' }] },
];
const asked = (answer, bookingIds) => () => new Response(JSON.stringify({ model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify({ answer, bookingIds }) }] }), { status: 200 });
await test('ask: needs the header, the key and a question and a trip list', async () => {
  calls = [];
  assert.equal((await postAsk({}, { header: false })).status, 404);
  assert.equal((await postAsk({ question: 'When do I fly?', today: '2026-10-14', trips: TRIPS }, { key: '' })).body.error, 'no-key');
  assert.equal((await postAsk({ question: 'hi', today: '2026-10-14', trips: TRIPS })).status, 400, 'too short');
  assert.equal((await postAsk({ question: 'When do I fly?', today: 'soon', trips: TRIPS })).status, 400);
  assert.equal((await postAsk({ question: 'When do I fly?', today: '2026-10-14', trips: 'nope' })).status, 400);
  assert.equal((await postAsk({}, { raw: '{nope' })).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await postAsk({ question: 'When do I fly?', today: '2026-10-14', trips: [] })).body.answer, 'There are no bookings to look through yet.');
  assert.equal(calls.length, 0, 'no bookings: nothing to ask Claude');
});
await test('ask: sends only the allowed fields, asks for a structured answer, and returns it with the bookings it used', async () => {
  calls = [];
  let sent;
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), headers: init.headers }); sent = JSON.parse(init.body); return asked('Your next flight is F9 3073 from RDU to CLE on Nov 2 at 4:04 PM.', ['f-1', 'not-sent', 'f-1'])(); };
  const r = await postAsk({ question: 'When is my next flight?', today: '2026-10-14', trips: TRIPS });
  assert.equal(r.status, 200); assert.match(r.body.answer, /F9 3073/); assert.deepEqual(r.body.bookingIds, ['f-1'], 'only bookings that were sent, once each');
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages'); assert.equal(calls[0].headers['x-api-key'], 'sk-ant-test');
  assert.equal(sent.model, 'claude-sonnet-5-5', 'a question about your trips is the mid-size model'); assert.equal(sent.output_config.format.type, 'json_schema'); assert.equal(sent.output_config.effort, 'medium');
  assert.equal(sent.fallbacks, 'default'); assert.equal(calls[0].headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.deepEqual(Object.keys(sent.output_config.format.schema.properties), ['answer', 'bookingIds']);
  const prompt = sent.messages[0].content;
  assert.match(prompt, /^Today is 2026-10-14\./); assert.match(prompt, /Question: When is my next flight\?$/);
  for (const never of ['Pat Example', '19A', 'window please', 'x@y.z', 'secret subject', '555-0100', 'bad id']) assert.equal(prompt.includes(never), false, never + ' was sent');
  for (const kept of ['F9 3073', 'ZQ4RTE', 'Courtyard Cleveland Beachwood', '"when":"to check"', '"check":true', '"status":"cancelled"']) assert.ok(prompt.includes(kept), kept + ' should be sent');
});
await test('the two models can each be changed (TRAVEL_AI_MODEL for reading an email, TRAVEL_ASK_MODEL for questions), and a Haiku never gets a fallback', async () => {
  const seen = [];
  globalThis.fetch = async (url, init) => { seen.push({ body: JSON.parse(init.body), headers: init.headers }); return seen.length % 2 ? claude({ date: '2026-11-02' }, [{ field: 'date', quote: 'Monday, Nov 2, 2026' }])() : asked('ok', [])(); };
  const env = m => ({ ANTHROPIC_API_KEY: 'sk-ant-test', ...m });
  const run = async (route, body, e) => (await onRequestPost({ request: new Request('https://site.example/travel/api/' + route, { method: 'POST', headers: { 'X-Travel': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), params: { route: [route] }, env: e })).status;
  const ex = { type: 'flight', missing: ['date'], text: EMAIL };
  const qa = { question: 'When is my next flight?', today: '2026-10-14', trips: TRIPS };
  await run('extract', ex, env({ TRAVEL_AI_MODEL: 'claude-sonnet-5-5' }));
  await run('ask', qa, env({ TRAVEL_ASK_MODEL: 'claude-haiku-5-5' }));
  await run('extract', ex, env({ TRAVEL_ASK_MODEL: 'claude-haiku-5-5' }));
  await run('ask', qa, env({ TRAVEL_AI_MODEL: 'claude-haiku-5-5' }));
  assert.equal(seen[0].body.model, 'claude-sonnet-5-5'); assert.equal(seen[0].body.fallbacks, 'default');
  assert.equal(seen[1].body.model, 'claude-haiku-5-5'); assert.equal('fallbacks' in seen[1].body, false); assert.equal('anthropic-beta' in seen[1].headers, false);
  assert.equal(seen[2].body.model, 'claude-haiku-5-5', 'the other secret does not change it'); assert.equal(seen[3].body.model, 'claude-sonnet-5-5');
});
await test('ask: limits, refusals and garbage come back as plain answers', async () => {
  const q = { question: 'When is my next flight?', today: '2026-10-14', trips: TRIPS };
  globalThis.fetch = async () => new Response('', { status: 429 });
  assert.equal((await postAsk(q)).body.error, 'limit');
  globalThis.fetch = async () => new Response('', { status: 401 });
  assert.equal((await postAsk(q)).body.error, 'key-refused');
  globalThis.fetch = async () => new Response(JSON.stringify({ stop_reason: 'refusal', content: [] }), { status: 200 });
  assert.equal((await postAsk(q)).body.refused, true);
  globalThis.fetch = async () => new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }), { status: 200 });
  assert.equal((await postAsk(q)).body.error, 'unreadable');
  globalThis.fetch = async () => asked('   ', [])();
  assert.equal((await postAsk(q)).body.error, 'unreadable');
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal((await postAsk(q)).body.error, 'unreachable');
});
console.log(n + ' passed');
