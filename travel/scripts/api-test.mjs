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
const { onRequestGet } = await import('data:text/javascript,' + encodeURIComponent(src));

const store = new Map();
globalThis.caches = { default: {
  match: async req => { const r = store.get(req.url); return r ? r.clone() : undefined; },
  put: async (req, res) => { store.set(req.url, res.clone()); },
} };
let calls = [], upstream = () => new Response('[]', { status: 200 });
globalThis.fetch = async (url, init) => { calls.push({ url: String(url), headers: init.headers }); return upstream(); };

const pending = [];
const call = async (path, { key = 'k-123', header = true } = {}) => {
  const request = new Request('https://site.example/travel/api/' + path, { headers: header ? { 'X-Travel': '1' } : {} });
  const route = path.split('?')[0].split('/');
  const res = await onRequestGet({ request, params: { route }, env: key ? { AERODATABOX_KEY: key } : {}, waitUntil: p => pending.push(p) });
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
  assert.deepEqual((await call('ping')).body, { ok: true, status: true });
  assert.deepEqual((await call('ping', { key: '' })).body, { ok: true, status: false });
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
console.log(n + ' passed');
