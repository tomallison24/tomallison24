// Drives Travel in headless Chromium for the "smart" parts, with
// Gmail, the Family calendar, the flight board and the AI all stubbed:
//
//  - an email with no date goes to "To check" instead of being dropped, and you can give it its day;
//  - past bookings never sit in "To check";
//  - a booking that has everything makes no AI call; one missing something does, once, and the
//    answer is marked "Check" with where it came from;
//  - a flight with an airline, airports, day and time but no number gets it from the flight board;
//  - the Family calendar is read: the event for an undated flight gives it its day, a hotel only in
//    the calendar becomes a booking, our own events and other events are ignored;
//  - confirmed bookings are written to the calendar once (never twice, never beside an event that
//    is already there), and the guesses are not written;
//  - Calendar's Travel layer leaves out what the calendar already has.
//
// Every email and event here is made up.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node travel/scripts/smart-test.mjs [address: travel | travelvintage] [repo root]
// travelvintage is the old Travel Vintage address, which opens this same app (the deploy copies travel/
// there, news.yml; this test's server does the same): everything must work from there too.
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const APP = process.argv[2] || 'travel';   // the address it is opened at
const ROOT = path.resolve(process.argv[3] || new URL('../..', import.meta.url).pathname);
const ID = 'travel';   // the aOS id (data-app), at either address
const QUERY_V = (/const QUERY_V = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'travel/app.js'), 'utf8')) || [])[1];
const SHOTS = process.env.SHOTS || '';   // a folder for screenshots (optional)

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  p = p.replace(/^\/travelvintage\//, '/travel/');   // the old Travel Vintage address: the deploy copies travel/ there (news.yml)
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;

// ---- dates: always ahead of today, so the test works on any day ----
const pad = n => String(n).padStart(2, '0');
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const ymd8 = d => iso(d).replace(/-/g, '');
const long = d => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const FLY = day(30), BACK = day(33), ORL = day(45), PAST = day(-40);

const EMAILS = [
  // 1. Frontier's confirmation with no day in it (the real one looked like this): kept for "To check"
  { id: 'e1', threadId: 'u1', from: 'Frontier Airlines <flights@t.flyfrontier.com>', subject: '    Booking Confirmation: ZQ4RTE – Your Upcoming Trip to Cleveland', text:
    `Confirmation Email - Confirmed\n\n Raleigh/Durham to Cleveland\n\n Confirmation Code\n ZQ4RTE\n\n Your Itinerary\n\n Departing Flight:\n Departing Flight:\n\n Flight\n #3073\n\n Departs RDU\n 4:04 PM Raleigh/Durham Arrives CLE\n 5:51 PM Cleveland\n\n Passenger Details\n\n Pat Example\n\n Total 209.98\n ${pad(day(-1).getMonth() + 1)}/${pad(day(-1).getDate())}/${String(day(-1).getFullYear()).slice(2)} 06:54 PM` },
  // 2. A booking that has everything (exact data): no AI, and it is written to the calendar
  { id: 'e2', threadId: 'u2', from: 'United Airlines <unitedairlines@united.com>', subject: 'Your trip confirmation - KQ7T2M', html:
    `<html><head><script type="application/ld+json">${JSON.stringify({ '@context': 'http://schema.org', '@type': 'FlightReservation', reservationNumber: 'KQ7T2M',
      reservationFor: { '@type': 'Flight', flightNumber: '110', airline: { '@type': 'Airline', name: 'United', iataCode: 'UA' },
        departureAirport: { iataCode: 'DEN' }, departureTime: iso(BACK) + 'T20:15:00-06:00', arrivalAirport: { iataCode: 'BOS' }, arrivalTime: iso(BACK) + 'T23:40:00-05:00' } })}</script></head><body>Thanks for flying</body></html>` },
  // 3. A flight read from words, with the day but no airports: the AI is asked, once
  { id: 'e3', threadId: 'u3', from: 'Frontier Airlines <noreply@emails.flyfrontier.com>', subject: 'Your Frontier Airlines Itinerary', text:
    `Your trip confirmation code is TRZ4KD\nFlight 2154\n${long(ORL)}\nDepart 10:40am  Arrive 1:18pm\nOrlando to Philadelphia` },
  // 4. A flight in the past that was read from words: never in "To check"
  { id: 'e4', threadId: 'u4', from: 'Frontier Airlines <noreply@emails.flyfrontier.com>', subject: 'Your Frontier Airlines Itinerary', text:
    `Your trip confirmation code is OLD1AA\nFlight 1100\nMCO → PHL\n${long(PAST)}\nDepart 10:40am  Arrive 1:18pm` },
  // 5. An old undated confirmation (reading the last year of mail again must not make a backlog)
  { id: 'e5', threadId: 'u5', age: 200, from: 'Frontier Airlines <flights@t.flyfrontier.com>', subject: '    Booking Confirmation: OLDUND – Your Upcoming Trip to Raleigh', text:
    `Confirmation Email - Confirmed\n\n Cleveland to Raleigh/Durham\n\n Confirmation Code\n OLDUND\n\n Your Itinerary\n\n Departing Flight:\n\n Flight\n #3074\n\n Departs CLE\n 6:30 PM Cleveland Arrives RDU\n 8:05 PM Raleigh/Durham\n\n Passenger Details\n\n Pat Example\n` },
];
const b64 = s => Buffer.from(s, 'utf8').toString('base64url');
const gmailMessage = m => ({
  id: m.id, threadId: m.threadId, internalDate: String(Date.now() - (m.age || 1) * 86400e3),
  payload: { mimeType: 'multipart/alternative', headers: [{ name: 'Subject', value: m.subject }, { name: 'From', value: m.from }],
    parts: [m.text && { mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset=UTF-8' }], body: { data: b64(m.text) } },
      m.html && { mimeType: 'text/html', headers: [{ name: 'Content-Type', value: 'text/html; charset="UTF-8"' }], body: { data: b64(m.html) } }].filter(Boolean) },
});

// ---- the Family calendar: made-up events ----
const vevent = (uid, summary, start, end, loc) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:20261001T000000Z\r\n${start}\r\n${end || ''}\r\nSUMMARY:${summary}\r\n${loc ? 'LOCATION:' + loc + '\r\n' : ''}END:VEVENT\r\nEND:VCALENDAR\r\n`;
const CAL = [
  vevent('cal-cle', 'Flight to Cleveland', `DTSTART;TZID=America/New_York:${ymd8(FLY)}T160400`, `DTEND;TZID=America/New_York:${ymd8(FLY)}T175100`),
  vevent('cal-hotel', 'Courtyard Cleveland Beachwood', `DTSTART;VALUE=DATE:${ymd8(FLY)}`, `DTEND;VALUE=DATE:${ymd8(day(33))}`),
  vevent('cal-dentist', 'Dentist', `DTSTART;TZID=America/New_York:${ymd8(FLY)}T090000`),
  vevent('cal-own@allison-travel', '✈ UA 9 SFO → LAX', `DTSTART:${ymd8(FLY)}T210000Z`),
  vevent('cal-ua', 'Fly UA 110 to Boston', `DTSTART;TZID=America/Denver:${ymd8(BACK)}T201500`),
];

const browser = await chromium.launch();
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n  ', e.message.split('\n').slice(0, 8).join('\n   ')); } };

async function open({ calendar = true, ai = true, board = true, empty = false, stored = null, failGets = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript(id => (localStorage.setItem('aos.sky', 'day'), localStorage.setItem('aos.seen', JSON.stringify({ [id]: '999' }))), ID);   // the sky held at day
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404/.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', e => problems.push(String(e)));
  const seen = { extract: [], find: [], ask: [], edit: [], imports: [], deletes: [], events: 0 };
  await ctx.route('https://gmail.googleapis.com/**', route => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/profile')) return route.fulfill({ json: { emailAddress: 'pat@example.com' } });
    if (u.pathname.endsWith('/messages')) return route.fulfill({ json: { messages: (empty ? [] : EMAILS).map(m => ({ id: m.id, threadId: m.threadId })) } });
    if (failGets) return route.fulfill({ status: 500, body: 'down' });
    const m = EMAILS.find(x => x.id === u.pathname.split('/').pop());
    return m ? route.fulfill({ json: gmailMessage(m) }) : route.fulfill({ status: 404, json: {} });
  });
  await ctx.route(BASE + '/travel/api/**', route => {
    const req = route.request(), u = new URL(req.url());
    if (req.headers()['x-travel'] !== '1') return route.fulfill({ status: 404, json: { error: 'not-found' } });
    if (u.pathname.endsWith('/ping')) return route.fulfill({ json: { ok: true, status: true, find: board, ai, models: { check: 'claude-haiku-5-5', ask: 'claude-sonnet-5-5' } } });
    if (u.pathname.endsWith('/extract')) {
      const body = JSON.parse(req.postData() || '{}');
      seen.extract.push(body);
      // the made-up AI: knows the airports when asked for them, and says nothing it cannot quote
      return route.fulfill({ json: { ok: true, fields: body.missing.includes('from') ? { from: 'MCO', to: 'PHL' } : {} } });
    }
    if (u.pathname.endsWith('/ask')) {
      const body = JSON.parse(req.postData() || '{}');
      seen.ask.push(body);
      const first = body.trips.flatMap(t => t.items).find(i => i.kind === 'flight');
      return route.fulfill({ json: { ok: true, model: 'claude-sonnet-5-5', answer: 'Your next flight is ' + (first && first.flight) + '.', bookingIds: first ? [first.id, 'not-a-booking'] : [] } });
    }
    if (u.pathname.endsWith('/edit')) {
      const body = JSON.parse(req.postData() || '{}');
      seen.edit.push(body);
      const items = body.trips.flatMap(t => t.items), flights = items.filter(i => i.kind === 'flight'), hotel = items.find(i => i.kind === 'hotel');
      const first = flights[0], pdx = flights.find(i => i.to === 'PDX'), den = flights.find(i => i.to === 'DEN');
      const O = o => ({ op: '', id: '', field: '', value: '', with: '', name: '', kind: '', pairs: [], ...o });
      if (/WIDER/.test(body.question)) {
        // the whole vocabulary: set and clear, add, cancel, bring back, mark checked, take out of a trip
        return route.fulfill({ json: { ok: true, model: 'claude-sonnet-5-5', summary: 'A little of everything.', question: '', dropped: 0, ops: [
          O({ op: 'set', id: first.id, field: 'seat', value: '12A' }), O({ op: 'set', id: first.id, field: 'gate', value: '' }),
          O({ op: 'set', id: hotel.id, field: 'checkInTime', value: '15:00' }),
          O({ op: 'add', kind: 'other', pairs: [{ field: 'title', value: 'Dinner with Pat' }, { field: 'start', value: iso(day(72)) + 'T19:00' }, { field: 'place', value: 'Old Town' }] }),
          O({ op: 'add', kind: 'hotel', pairs: [{ field: 'name', value: 'No dates' }] }),
          O({ op: 'status', id: pdx.id, value: 'cancelled' }), O({ op: 'check', id: hotel.id }), O({ op: 'detach', id: den.id })] } });
      }
      // the made-up AI: a good list, with two changes the checks must throw out (a bad value, an id that is not there)
      return route.fulfill({ json: { ok: true, model: 'claude-sonnet-5-5', summary: 'Move the flight, drop the hotel, join the two later flights and rename the trip.', question: '', dropped: 0, ops: [
        { op: 'set', id: first.id, field: 'dep', value: iso(day(71)), with: '', name: '' },
        { op: 'delete', id: hotel.id, field: '', value: '', with: '', name: '' },
        { op: 'join', id: pdx.id, field: '', value: '', with: den.id, name: '' },
        { op: 'rename', id: body.trips[0].tid, field: '', value: '', with: '', name: 'December in San Diego' },
        { op: 'set', id: hotel.id, field: 'checkIn', value: 'next tuesday', with: '', name: '' },
        { op: 'delete', id: 'not-a-booking', field: '', value: '', with: '', name: '' },
        { op: 'set', id: first.id, field: 'airline', value: 'Alaska', with: '', name: '' }] } });
    }
    if (u.pathname.endsWith('/find')) { seen.find.push(Object.fromEntries(u.searchParams)); return route.fulfill({ json: { ok: true, candidates: [{ number: '2154', to: 'PHL', local: '' }] } }); }
    return route.fulfill({ json: { ok: true, found: false } });
  });
  await ctx.route(BASE + '/calendar/api/**', route => {
    const req = route.request(), u = new URL(req.url());
    if (!calendar || req.headers()['x-calendar'] !== '1') return route.fulfill({ status: 404, body: 'not found' });
    if (u.pathname.endsWith('/events')) { seen.events++; return route.fulfill({ json: { ok: true, items: CAL.map((ics, i) => ({ name: 'e' + i + '.ics', etag: '"1"', ics })) } }); }
    if (u.pathname.endsWith('/import')) { seen.imports.push(req.postData()); return route.fulfill({ json: { ok: true, names: [], calendar: { name: 'Family' } } }); }
    if (u.pathname.endsWith('/event') && req.method() === 'DELETE') { seen.deletes.push(u.searchParams.get('name')); return route.fulfill({ json: { ok: true } }); }
    return route.fulfill({ status: 404, json: { error: 'not-found' } });
  });
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (localStorage.getItem('test.nomail')) return;
    localStorage.setItem('travel.token', JSON.stringify({ t: 'fake-token', exp: Date.now() + 3600e3, scope: 'https://www.googleapis.com/auth/gmail.readonly' }));
    localStorage.setItem('travel.token.ever', '1');
  });
  // the reader is at the current version unless a test says an update is due (a scan after an update rebuilds what the old reader made)
  await ctx.addInitScript(([key, v]) => { if (!sessionStorage.getItem('qv')) { sessionStorage.setItem('qv', '1'); localStorage.setItem(key + '-query-v', v); } }, ['allison-travel-v1', QUERY_V]);
  if (empty) await ctx.addInitScript(() => localStorage.setItem('test.nomail', '1'));
  if (stored) await ctx.addInitScript(st => { if (!sessionStorage.getItem('stored')) { sessionStorage.setItem('stored', '1'); Object.entries(st).forEach(([k, v]) => localStorage.setItem(k, v)); } }, stored);
  await page.goto(BASE + '/' + APP + '/');
  await page.waitForFunction(fg => window.__travel && (window.__travel.bookings.length >= 4 || localStorage.getItem('test.nomail') || fg), failGets, { timeout: 10000 });
  return { ctx, page, seen, problems };
}
const pick = (page, f) => page.evaluate(f);

// =================== without the calendar: undated bookings, the backlog, the AI and the board ===================
{
  const { ctx, page, seen, problems } = await open({ calendar: false });
  await page.waitForFunction(() => window.__travel.bookings.some(b => b.conf === 'TRZ4KD') && window.__travel.bookings.some(b => b.conf === 'OLDUND'), null, { timeout: 10000 });

  await step('an email with no day is kept and waits in "To check" with its times', async () => {
    const b = await pick(page, () => window.__travel.bookings.find(x => x.flightNo === '3073'));
    assert.ok(b, 'the Cleveland flight is kept');
    assert.equal(b.dep, ''); assert.equal(b.depTime, '16:04'); assert.equal(b.arrTime, '17:51'); assert.equal(b.from, 'RDU'); assert.equal(b.to, 'CLE'); assert.equal(b.conf, 'ZQ4RTE');
    const list = await pick(page, () => window.__travel.checkList().map(x => x.flightNo + ':' + (x.dep || 'nodate')));
    assert.ok(list.includes('3073:nodate'), list.join(' '));
    await page.click('[data-when="check"]');
    const rows = await page.$$eval('#list .ev', els => els.map(e => e.textContent));
    assert.ok(rows.some(t => /F9 3073/.test(t) && /Needs a date/.test(t) && /4:04 PM/.test(t)), rows.join(' | '));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, APP + '-check.png') });
  });
  await step('an undated confirmation from months ago is kept but not listed, and nothing is asked about it', async () => {
    const old = await pick(page, () => window.__travel.bookings.find(x => x.conf === 'OLDUND'));
    assert.ok(old && old.dep === '', 'kept');
    const list = await pick(page, () => window.__travel.checkList().map(x => x.conf));
    assert.ok(!list.includes('OLDUND'), list.join(' '));
    assert.ok(!seen.extract.some(x => /OLDUND/.test(JSON.stringify(x))));
  });
  await step('past bookings never count as "To check"', async () => {
    const chip = await page.textContent('[data-when="check"]');
    const n = await pick(page, () => window.__travel.checkList().length);
    assert.equal(+chip.replace(/\D/g, ''), n);
    const list = await pick(page, () => window.__travel.checkList().map(x => x.conf));
    assert.ok(!list.includes('OLD1AA'), 'the past flight is not to check: ' + list.join(' '));
    const old = await pick(page, () => window.__travel.bookings.find(x => x.conf === 'OLD1AA'));
    assert.ok(old, 'but it is still kept as history');
  });
  await step('nothing is sent to the AI by itself: not when reading Gmail, not when opening', async () => {
    assert.equal(seen.extract.length, 0, JSON.stringify(seen.extract.map(x => x.missing)));
    await page.evaluate(() => window.__travel.smartPass());
    assert.equal(seen.extract.length, 0);
  });
  await step('only a trip with something missing has a Check with AI button; pressing it asks once, for what is missing, and marks the answer', async () => {
    await page.click('[data-when="upcoming"]');
    const cards = await page.$$eval('.tripwrap', els => els.map(e => ({ name: e.querySelector('h3').textContent, ai: !!e.querySelector('[data-ai]') })));
    assert.equal(cards.filter(c => c.ai).length, 1, JSON.stringify(cards));
    assert.equal(cards.filter(c => !c.ai).length >= 1, true, 'the trip that has everything has no button: ' + JSON.stringify(cards));
    if (SHOTS) { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(SHOTS, APP + '-aicard.png') }); }
    await page.click('.tripwrap [data-ai]');
    await page.waitForFunction(() => /Filled in 2 details/.test(document.getElementById('toastMsg').textContent), null, { timeout: 8000 });
    assert.equal(seen.extract.length, 1, JSON.stringify(seen.extract.map(x => x.missing)));
    assert.deepEqual(seen.extract[0].missing.sort(), ['from', 'to']);
    assert.equal(seen.extract[0].type, 'flight');
    assert.ok(!JSON.stringify(seen.extract[0]).includes('pat@example.com'));
    const b = await pick(page, () => window.__travel.bookings.find(x => x.conf === 'TRZ4KD'));
    assert.equal(b.from, 'MCO'); assert.equal(b.to, 'PHL'); assert.equal(b.filled.from, 'ai'); assert.equal(b.guess, true);
    const ua = await pick(page, () => window.__travel.bookings.find(x => x.conf === 'KQ7T2M'));
    assert.equal(ua.guess, false); assert.equal(ua.filled, undefined);
    // the undated Cleveland email says no date anywhere, so there was nothing to ask the AI to read
    assert.ok(!seen.extract.some(x => /Cleveland/.test(x.text) || (x.missing || []).includes('date')));
    assert.equal(!!(await page.$('.tripwrap [data-ai]')), false, 'nothing is missing any more, so the button is gone');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, APP + '-aibutton.png') });
  });
  await step('the button follows what is missing: back when something is missing, gone when it is complete', async () => {
    await page.evaluate(() => { const b = window.__travel.bookings.find(x => x.conf === 'TRZ4KD'); b.from = ''; b.to = ''; delete b.filled; window.__travel.render(); });
    assert.ok(!!(await page.$('.tripwrap [data-ai]')), 'the button is back while something is missing');
    await page.evaluate(() => { const b = window.__travel.bookings.find(x => x.conf === 'TRZ4KD'); b.from = 'MCO'; b.to = 'PHL'; window.__travel.render(); });
    assert.equal(!!(await page.$('.tripwrap [data-ai]')), false);
  });
  await step('the Ask AI bar: nothing is sent until you ask; the question goes with the current, past and to-check trips (no names), and the answer names its bookings', async () => {
    await page.click('[data-when="upcoming"]');
    assert.equal(await page.$eval('#askForm', e => e.hidden), false, 'the bar is there');
    await page.fill('#askInput', 'When is my next flight?');
    await page.waitForTimeout(300);
    assert.equal(seen.ask.length, 0, 'typing sends nothing');
    await page.press('#askInput', 'Enter');
    await page.waitForSelector('.askout .aska:not(.err)');
    await page.waitForFunction(() => /Your next flight is/.test(document.querySelector('.askout .aska').textContent), null, { timeout: 8000 });
    assert.equal(seen.ask.length, 1);
    const sent = seen.ask[0];
    assert.equal(sent.question, 'When is my next flight?'); assert.match(sent.today, /^\d{4}-\d\d-\d\d$/);
    const whens = sent.trips.map(t => t.when);
    assert.ok(whens.includes('upcoming') && whens.includes('past') && whens.includes('to check'), whens.join());
    const items = sent.trips.flatMap(t => t.items);
    assert.ok(items.some(i => i.flight === 'F9 3073' && i.check === true && i.conf === 'ZQ4RTE'), 'the undated Cleveland flight is in the to-check part');
    const text = JSON.stringify(sent);
    for (const never of ['Pat Example', 'pat@example.com', 'traveller', 'seat', 'notes', 'source']) assert.equal(text.includes(never), false, never + ' was sent');
    if (SHOTS) { await page.waitForTimeout(900); await page.screenshot({ path: path.join(SHOTS, APP + '-ask.png') }); }
    const rows = await page.$$eval('.askout .ev', els => els.length);
    assert.equal(rows, 1, 'only the booking that was sent is shown');
    await page.click('.askout .ev');
    await page.waitForSelector('#bkSheet:not([hidden])');
    await page.click('#bkDone');
    await page.click('#askClear');
    assert.equal(await page.$('.askout'), null);
  });
  await step('a flight with an airline, airports, day and time but no number gets it from the flight board; an edited one does not', async () => {
    await page.evaluate(day => {
      const mk = (id, edited) => ({ type: 'flight', id, status: 'confirmed', guess: false, edited, conf: 'BRD' + id.slice(-1), airline: 'Frontier', airlineCode: 'F9', flightNo: '', from: 'MCO', fromName: 'Orlando', to: 'PHL', toName: 'Philadelphia', dep: day + 'T10:40', depIso: '', arr: day + 'T13:18', arrIso: '', notes: '', created: Date.now() });
      window.__travel.bookings.push(mk('f-board1', false), mk('f-board2', true));
    }, iso(ORL));
    await page.evaluate(() => window.__travel.findNumbers());
    assert.equal(seen.find.length, 1, JSON.stringify(seen.find));
    assert.deepEqual(seen.find[0], { airline: 'F9', from: 'MCO', to: 'PHL', date: iso(ORL), time: '10:40' });
    const b = await pick(page, () => window.__travel.bookings.find(x => x.id === 'f-board1'));
    assert.equal(b.flightNo, '2154'); assert.equal(b.filled.flightNo, 'board'); assert.equal(b.guess, true);
    assert.equal((await pick(page, () => window.__travel.bookings.find(x => x.id === 'f-board2'))).flightNo, '');
    await page.evaluate(() => window.__travel.findNumbers());
    assert.equal(seen.find.length, 1, 'asked once');
  });
  await step('the booking sheet asks for the day, and giving it moves the flight into the trips', async () => {
    await page.click('[data-when="check"]');
    await page.click('#list .ev:has-text("3073")');
    await page.waitForSelector('#bkSheet:not([hidden]) #bf__day');
    assert.match(await page.textContent('#bkBody .verify'), /no date/i);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, APP + '-nodate.png') });
    await page.fill('#bf__day', iso(FLY));
    await page.click('#bkDone');
    const b = await pick(page, () => window.__travel.bookings.find(x => x.flightNo === '3073'));
    assert.equal(b.dep, iso(FLY) + 'T16:04'); assert.equal(b.arr, iso(FLY) + 'T17:51'); assert.equal(b.edited, true); assert.equal(b.guess, false);
    const trips = await pick(page, () => window.__travel.groupTrips().map(g => g.items.map(x => x.flightNo).join(',')));
    assert.ok(trips.some(t => t.includes('3073')), trips.join(' | '));
  });
  await step('with the calendar not there, nothing is written and nothing breaks', async () => {
    assert.equal(seen.imports.length, 0);
    assert.deepEqual(problems, []);
  });
  await ctx.close();
}

// =================== with the Family calendar ===================
{
  const { ctx, page, seen, problems } = await open({ calendar: true });
  await page.waitForFunction(() => window.__travel.bookings.some(b => b.calUid === 'cal-cle'), null, { timeout: 10000 });

  await step('the calendar event for an undated flight gives it its day, marked "from your calendar"', async () => {
    const b = await pick(page, () => window.__travel.bookings.find(x => x.flightNo === '3073'));
    assert.equal(b.dep, iso(FLY) + 'T16:04'); assert.equal(b.arr, iso(FLY) + 'T17:51'); assert.equal(b.filled.date, 'calendar'); assert.equal(b.guess, true); assert.equal(b.calUid, 'cal-cle');
    await page.click('[data-when="check"]');
    await page.click('#list .ev:has-text("3073")');
    await page.waitForSelector('#bkSheet:not([hidden]) #bkBody .verify');
    assert.match(await page.textContent('#bkBody .verify'), /from your calendar/);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, APP + '-fromcal.png') });
    await page.click('#bkOk');
    await page.click('#bkDone');
    const after = await pick(page, () => window.__travel.bookings.find(x => x.flightNo === '3073'));
    assert.equal(after.guess, false); assert.equal(after.filled, undefined);
  });
  await step('a hotel only in the calendar becomes a booking to check; other events are ignored', async () => {
    const h = await pick(page, () => window.__travel.bookings.find(x => x.calUid === 'cal-hotel'));
    assert.ok(h, 'the hotel'); assert.equal(h.type, 'hotel'); assert.equal(h.fromCal, true); assert.equal(h.checkIn, iso(FLY)); assert.equal(h.checkOut, iso(day(33))); assert.equal(h.guess, true);
    const all = await pick(page, () => window.__travel.bookings.map(x => x.calUid || '').filter(Boolean));
    assert.ok(!all.includes('cal-dentist') && !all.includes('cal-own@allison-travel'), all.join(' '));
  });
  await step('a calendar event for a booking already here adds nothing', async () => {
    const ua = await pick(page, () => window.__travel.bookings.filter(x => x.flightNo === '110'));
    assert.equal(ua.length, 1); assert.equal(ua[0].calUid, 'cal-ua'); assert.equal(ua[0].fromCal, undefined);
  });
  await step('only what is confirmed is written to the calendar, and the one that is there already is not', async () => {
    const texts = seen.imports.join('\n');
    assert.equal(seen.imports.length, 0, 'United is already in your calendar as an event of yours, so nothing is written for it: ' + texts.slice(0, 300));
  });
  await step('the Travel layer leaves out what the calendar already has', async () => {
    await page.evaluate(() => { window.__shared = null; AllisonOS.layer.share = (app, data) => { window.__shared = { app, data }; }; window.__travel.save(); });
    const sh = await pick(page, () => window.__shared);
    assert.ok(sh && sh.data.bookings, 'shared');
    assert.equal(sh.app, APP === 'travelvintage' ? 'travelv' : 'travel', 'as the layer of the app at this address (the old Travel Vintage one keeps its own)');
    const confs = sh.data.bookings.map(x => x.conf);
    assert.ok(!confs.includes('KQ7T2M'), 'United has its own calendar event: ' + confs.join(' '));
    assert.ok(!sh.data.bookings.some(x => x.name === 'Courtyard Cleveland Beachwood'), 'the hotel came from the calendar');
    assert.ok(confs.includes('TRZ4KD'), 'what the calendar does not have is still shared');
  });
  await ctx.close();
}

// =================== writing: a confirmed booking with no matching event ===================
{
  const keep = CAL.splice(0, CAL.length, ...CAL.filter(x => !/cal-ua|cal-cle/.test(x)));       // no event for United or Cleveland this time
  const { ctx, page, seen } = await open({ calendar: true });
  await page.waitForFunction(() => window.__travel.bookings.some(b => b.calSig), null, { timeout: 10000 });
  await step('a confirmed booking with no event is written once, with its own id, and never twice', async () => {
    assert.equal(seen.imports.length, 1, seen.imports.map(t => t.slice(0, 200)).join('\n--\n'));
    assert.match(seen.imports[0], /UID:f-[a-z0-9]+@allison-travel/); assert.match(seen.imports[0], /SUMMARY:✈ UA 110 DEN → BOS/);
    await page.evaluate(() => window.__travel.syncCalendar());
    await page.evaluate(() => window.__travel.syncCalendar());
    assert.equal(seen.imports.length, 1, 'no second write when nothing changed');
    const guesses = await pick(page, () => window.__travel.bookings.filter(x => x.guess && x.calSig).length);
    assert.equal(guesses, 0, 'a guess is never written');
  });
  await step('a changed booking is written again; a cancelled one is taken out of the calendar', async () => {
    await page.evaluate(() => { const b = window.__travel.bookings.find(x => x.flightNo === '110'); b.dep = b.dep.slice(0, 11) + '21:00'; b.depIso = ''; });
    await page.evaluate(() => window.__travel.syncCalendar());
    assert.equal(seen.imports.length, 2); assert.match(seen.imports[1], /DTSTART/);
    await page.evaluate(() => { window.__travel.bookings.find(x => x.flightNo === '110').status = 'cancelled'; });
    await page.evaluate(() => window.__travel.syncCalendar());
    assert.equal(seen.deletes.length, 1); assert.match(seen.deletes[0], /@allison-travel\.ics$/);
    await page.evaluate(() => window.__travel.syncCalendar());
    assert.equal(seen.deletes.length, 1);
  });
  CAL.splice(0, CAL.length, ...keep);
  await ctx.close();
}

// =================== no bookings at all: the Ask AI bar is still there ===================
{
  const { ctx, page, seen } = await open({ empty: true });
  await step('with no bookings the Ask AI bar still shows, and answers without asking Claude', async () => {
    assert.equal(await page.evaluate(() => window.__travel.bookings.length), 0);
    await page.waitForFunction(() => !document.getElementById('askForm').hidden, null, { timeout: 5000 });
    await page.fill('#askInput', 'When is my next flight?');
    await page.press('#askInput', 'Enter');
    await page.waitForFunction(() => /no bookings to look through/.test(document.querySelector('.askout .aska').textContent), null, { timeout: 5000 });
    assert.equal(seen.ask.length, 0, 'nothing to look through, so nothing is sent');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /-ai$/.test(k)) || 'x') || '{}').ask || 0), 0, 'and no question used up');
  });
  await ctx.close();
}

// =================== one reservation is one trip; a hotel's pending and confirmed emails are one stay ===================
{
  const { ctx, page } = await open({ empty: true, calendar: false });
  const OUT = day(70), HOME = day(74), HOP = day(80), FAR = day(140);
  const flightJson = (no, from, to, d, conf) => ({ '@context': 'http://schema.org', '@type': 'FlightReservation', reservationNumber: conf,
    reservationFor: { '@type': 'Flight', flightNumber: no, airline: { '@type': 'Airline', name: 'Alaska Airlines', iataCode: 'AS' },
      departureAirport: { iataCode: from }, departureTime: iso(d) + 'T17:10:00-05:00', arrivalAirport: { iataCode: to }, arrivalTime: iso(d) + 'T20:01:00-07:00' } });
  const hotelText = conf => `ISSCR SYMPOSIUM\n${long(day(71))}\nHilton San Diego Bayfront\n1 Park Boulevard\nSan Diego, CA, 92101\nRESERVATION CONFIRMATION\nWe are pleased to confirm your reservation at Hilton San Diego Bayfront. Below you will find details of your reservation.\nHotel confirmation:\n${conf}\nDate booked:\n${long(day(-1))}\nArrival date:\n${long(OUT)}\nDeparture date:\n${long(day(73))}\nRoom type:\nSkyline Bay City View 1 King Bed\n`;
  const feed = emails => page.evaluate(emails => {
    const T = window.__travel;
    emails.forEach(m => { const r = T.P.parseEmail({ ...m, date: Date.now(), id: m.id, threadId: m.id }); r.bookings.forEach(b => T.upsert(b)); });
    return T.groupTrips().map(g => ({ n: g.items.length, kinds: g.items.map(b => b.type).join(','), name: g.name }));
  }, emails);

  await step('the flights out and home of one booking are one trip, even with no hotel yet', async () => {
    const groups = await feed([
      { id: 'a1', from: 'Alaska Airlines <reservation@email.alaskaair.com>', subject: 'Your flight is booked: YAVUUB',
        html: `<html><head><script type="application/ld+json">${JSON.stringify([flightJson('474', 'RDU', 'SAN', OUT, 'YAVUUB'), flightJson('434', 'SAN', 'RDU', HOME, 'YAVUUB')])}</script></head><body>booked</body></html>` }]);
    assert.equal(groups.length, 1, JSON.stringify(groups));
    assert.equal(groups[0].n, 2);
  });
  await step('a flight on from where the last one landed, away from home, joins that trip; a trip months later does not', async () => {
    const groups = await feed([
      { id: 'a2', from: 'Alaska Airlines <reservation@email.alaskaair.com>', subject: 'Your flight is booked: ZZ9PLU',
        html: `<html><head><script type="application/ld+json">${JSON.stringify(flightJson('900', 'RDU', 'DEN', FAR, 'ZZ9PLU'))}</script></head><body>booked</body></html>` },
      { id: 'a3', from: 'Alaska Airlines <reservation@email.alaskaair.com>', subject: 'Your flight is booked: HOP22X',
        html: `<html><head><script type="application/ld+json">${JSON.stringify(flightJson('120', 'RDU', 'PDX', HOP, 'HOP22X'))}</script></head><body>booked</body></html>` }]);
    // RDU→SAN d70, SAN→RDU d74 are one trip; RDU→PDX d80 leaves from home, so it is its own trip; RDU→DEN d140 too
    assert.deepEqual(groups.map(g => g.n), [2, 1, 1], JSON.stringify(groups));
  });
  await step('the hotel email that says "pending" and the one with its number are one stay, named and placed from the email', async () => {
    const groups = await feed([
      { id: 'h1', from: 'Hilton Reservations <info@cvent.com>', subject: 'Hilton San Diego Bayfront Reservation Confirmation', text: hotelText('Pending. Another email will be sent with your hotel number.') },
      { id: 'h2', from: 'Hilton Reservations <info@cvent.com>', subject: 'Hilton San Diego Bayfront Reservation Confirmation', text: hotelText('3115096800') }]);
    const hotels = await page.evaluate(() => window.__travel.bookings.filter(b => b.type === 'hotel').map(b => ({ name: b.name, city: b.city, conf: b.conf })));
    assert.deepEqual(hotels, [{ name: 'Hilton San Diego Bayfront', city: 'San Diego', conf: '3115096800' }], JSON.stringify(hotels));
    assert.equal(groups[0].kinds.split(',').filter(k => k === 'hotel').length, 1);
    assert.equal(groups[0].n, 3, 'the hotel sits in the same trip as the flights: ' + JSON.stringify(groups));
    assert.equal(groups[0].name, 'San Diego');
  });
  await ctx.close();
}

// =================== an improved reader reads the mail again once, and rebuilds what the old one made ===================
{
  const KEY = 'allison-travel-v1';
  const P = require(path.join(ROOT, 'travel/parse.js'));
  const link = v => 'http://rlm.passkey.com/Tracking/track.do?token=' + Buffer.from('trkid=1~~~url=' + v).toString('base64') + '&hash=5A9787681ED76AA41C92F9A7B7F9E453';
  const sd = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const rows = [['Hotel confirmation:', '3115096800'], ['Arrival date:', sd(day(60))], ['Departure date:', sd(day(63))]];
  const hilton = { id: 'hx', from: 'Hilton Reservations <info@cvent.com>', subject: 'Hilton San Diego Bayfront Reservation Confirmation',
    html: `<html><body><table><tr><td><strong>Hilton San Diego Bayfront</strong><br/><span>1 Park Boulevard</span><br/><span>San Diego, CA, 92101</span></td></tr><tr><td><strong>RESERVATION CONFIRMATION</strong></td></tr><tr><td><table>${rows.map(([a, b]) => `<tr><td><span>${a}</span></td><td><span>&nbsp;${b}</span></td></tr>`).join('')}</table></td></tr></table></body></html>`,
    text: `RESERVATION CONFIRMATION\n\nWe are pleased to confirm your reservation at ${link('Hilton San Diego Bayfront')}. Below you will find details of your reservation. If your travel plans change, please click here (https://book.passkey.com/entry?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXlsb2FkIjoieXYwYWEwU0IrQVhrVG8xWXhhWm84SkpiRU4v&utm_source=71485).\n\n` + rows.map(([a, b]) => `${a}\t ${link(b)}`).join('\n') + '\n' };
  EMAILS.push(hilton);
  const e2 = P.parseEmail({ ...EMAILS[1], date: Date.now(), threadId: 'x' }).bookings[0];
  const old = id => ({ type: 'flight', status: 'confirmed', conf: 'WRONG1', airlineCode: 'F9', flightNo: '3073', from: 'RDU', to: 'CLE', dep: iso(day(30)) + 'T10:00', guess: true, id, created: 1, notes: '', source: { msgId: 'e1', date: 1 } });
  const mine = { type: 'hotel', status: 'confirmed', conf: 'MINE1', name: 'My own hotel', checkIn: iso(day(40)), checkOut: iso(day(42)), guess: false, edited: true, id: 'h-mine', created: 1, notes: '', source: { msgId: 'zz', date: 1 } };
  const { ctx, page } = await open({ calendar: false, stored: {
    [KEY]: JSON.stringify({ bookings: [old('f-stale'), mine], trips: [] }),
    [KEY + '-query-v']: '3', [KEY + '-seen']: JSON.stringify(['e1', 'e2', 'e3', 'e4', 'e5', 'hx']), [KEY + '-scan']: String(Date.now() - 60000),
    [KEY + '-graves']: JSON.stringify({ ['bookings:' + e2.id]: Date.now() }) } });
  await step('the first scan after an update rebuilds what the old reader made, keeps what you edited, and keeps deleted bookings deleted', async () => {
    await page.waitForFunction(() => window.__travel.bookings.some(b => b.type === 'hotel' && /Hilton/.test(b.name)), null, { timeout: 10000 });
    const r = await page.evaluate(KEY => { const T = window.__travel; return { stale: T.bookings.some(b => b.conf === 'WRONG1'), rebuilt: T.bookings.some(b => b.conf === 'ZQ4RTE'), mine: T.bookings.some(b => b.id === 'h-mine' && b.edited),
      hilton: T.bookings.find(b => b.type === 'hotel' && /Hilton/.test(b.name)), united: T.bookings.some(b => b.conf === 'KQ7T2M'), v: localStorage.getItem(KEY + '-query-v'), revive: localStorage.getItem(KEY + '-revive') }; }, KEY);
    assert.equal(r.stale, false, 'the old reader\'s booking is gone'); assert.equal(r.rebuilt, true, 'and the new reader made it again');
    assert.equal(r.mine, true, 'what you edited stays'); assert.equal(r.united, false, 'a booking you deleted stays deleted');
    assert.deepEqual([r.hilton.name, r.hilton.checkIn, r.hilton.checkOut, r.hilton.conf], ['Hilton San Diego Bayfront', iso(day(60)), iso(day(63)), '3115096800'], 'Hilton\'s email, marked read by the old reader, is read again');
    assert.equal(r.v, QUERY_V, 'and the reader is at the current version');
    assert.equal(r.revive, null, 'nothing is left to revive once the scan finished');
  });
  await ctx.close();
  EMAILS.pop();
}

// =================== a re-read that cannot download the mail puts back what it cleared, and tries again ===================
{
  const KEY = 'allison-travel-v1';
  const old = { type: 'flight', status: 'confirmed', conf: 'OLD123', airlineCode: 'F9', flightNo: '3073', from: 'RDU', to: 'CLE', dep: iso(day(30)) + 'T10:00', guess: true, id: 'f-old', created: 1, notes: '', source: { msgId: 'e1', date: 1 } };
  const { ctx, page } = await open({ calendar: false, failGets: true, stored: { [KEY]: JSON.stringify({ bookings: [old], trips: [] }), [KEY + '-query-v']: '3', [KEY + '-seen']: JSON.stringify(['e1', 'e2']), [KEY + '-scan']: String(Date.now() - 3600e3) } });
  await step('when the mail cannot be downloaded, nothing the old reader made is lost, the re-read is tried again, and Settings says what happened', async () => {
    await page.waitForFunction(KEY => JSON.parse(localStorage.getItem(KEY + '-scan-info') || 'null'), KEY, { timeout: 15000 });
    const r = await page.evaluate(KEY => ({ have: window.__travel.bookings.map(b => b.id), v: localStorage.getItem(KEY + '-query-v'), seen: JSON.parse(localStorage.getItem(KEY + '-seen') || '[]').length, info: JSON.parse(localStorage.getItem(KEY + '-scan-info')) }), KEY);
    assert.deepEqual(r.have, ['f-old'], 'the booking is still there'); assert.equal(r.v, '3', 'the update is not marked done'); assert.equal(r.seen, 0, 'so the next look reads everything again');
    assert.equal(r.info.ok, false); assert.match(r.info.err, /could not be downloaded/);
    await page.click('#setBtn');
    await page.waitForSelector('#setSheet:not([hidden]) #stLog');
    assert.match(await page.textContent('#stLog'), /stopped: \d+ emails? could not be downloaded\. It tries again next time\./);
  });
  await ctx.close();
}

// =================== two trips to the same place, on the same flight number, stay two trips ===================
{
  const { ctx, page } = await open({ empty: true, calendar: false });
  // Frontier flies 3073 every day: a September trip and a November trip, as the real emails look (made-up people and codes)
  const SEPT = day(-38), SEPT_BACK = day(-34), NOV = day(20), NOV_BACK = day(24);
  const L = d => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const stamp = `${pad(day(0).getMonth() + 1)}/${pad(day(0).getDate())}/${String(day(0).getFullYear()).slice(2)} 06:54 PM`;   // the print stamp at the foot of a Frontier email: the day it was sent
  const M = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' }).replace(/^(\w+), (\w+) (\d+), /, '$1, $2 $3, ').replace(/(\w+ \d\d),? (\d{4})$/, '$1, $2');
  const frontierSept = { id: 'fs', from: 'Frontier Airlines <flights@t.flyfrontier.com>', subject: 'Booking Confirmation: QJI23A. Your Upcoming Trip to CLE', text:
    `Confirmation Email - Confirmed\n\n ${L(SEPT)}\n RDU\n ${L(SEPT)}\n CLE\n\n Raleigh/Durham to Cleveland\n\n Confirmation Code\n QJI23A\n\n Your Itinerary\n\n Outbound Trip: ${L(SEPT)}\n Departing Flight: ${L(SEPT)}\n\n Flight\n#3073\n\n Departs RDU\n 3:32 PM Raleigh/Durham Arrives CLE\n 5:15 PM Cleveland\n\n Return Trip: ${L(SEPT_BACK)}\n Return Trip: ${L(SEPT_BACK)}\n\n Flight\n #3074\n Departs CLE\n 1:34 PM Cleveland Arrives RDU\n 3:09 PM Raleigh/Durham\n\n Passenger Details\n\n Pat Example\n\n Total 392.96\n ${stamp}\n` };
  const frontierNov = { id: 'fn', from: 'Frontier Airlines <flights@t.flyfrontier.com>', subject: '    Booking Confirmation: ELM7JX – Your Upcoming Trip to Cleveland', text:
    `Confirmation Email - Confirmed\n\n RDU\n\n CLE\n\n Raleigh/Durham to Cleveland\n\n Confirmation Code\n ELM7JX\n\n Your Itinerary\n\n Departing Flight:\n Departing Flight:\n\n Flight\n #3073\n\n Departs RDU\n 4:04 PM Raleigh/Durham Arrives CLE\n 5:51 PM Cleveland\n\n Passenger Details\n\n Pat Example\n\n Total 209.98\n ${stamp}\n` };
  const courtyard = (id, conf, a, b) => ({ id, from: 'Marriott Reservations <reservations@res-marriott.com>', subject: `Reservation Confirmation #${conf} for Courtyard by Marriott Cleveland Beachwood`, text:
    `Reservation Confirmation #${conf} for Courtyard by Marriott Cleveland Beachwood\nYour reservation details and tips to make the most of your trip.\n\n| Courtyard by Marriott Cleveland Beachwood |\n| 3695 Orange Place Beachwood, Ohio 44122 USA |\n| Thank you for booking with us, Pat Example. |\n\n| Check-In |\n| ${M(a)} |\n| 03:00 PM |\n\n| Check-Out |\n| ${M(b)} |\n| 12:00 PM |\n\n| Room 1 | Confirmation Number: ${conf} |\n| Total for Stay | 709.33 USD |\n` });
  const feed = emails => page.evaluate(emails => { const T = window.__travel; T.bookings.splice(0);
    emails.forEach(m => T.P.parseEmail({ ...m, date: Date.now(), threadId: m.id }).bookings.forEach(b => T.upsert(b)));
    const g = T.groupTrips();
    return { flights: T.bookings.filter(b => b.type === 'flight').map(b => b.flightNo + ':' + b.conf + ':' + (b.dep || 'undated').slice(0, 10)), hotels: T.bookings.filter(b => b.type === 'hotel').map(b => b.conf + ':' + b.checkIn),
      trips: g.map(x => ({ n: x.items.length, past: x.past, start: x.start.slice(0, 10), end: x.end.slice(0, 10) })), undated: T.undated().length }; }, emails);

  await step('a November flight with no day in its email is not taken for the September flight with the same number', async () => {
    // newest first, as Gmail lists them
    const r = await feed([courtyard('hn', '8DOFD0OCPE', NOV, NOV_BACK), frontierNov, courtyard('hs', '0WY2X7WBI2', SEPT, SEPT_BACK), frontierSept]);
    assert.deepEqual(r.flights.sort(), ['3073:ELM7JX:undated', '3073:QJI23A:' + iso(SEPT), '3074:QJI23A:' + iso(SEPT_BACK)].sort(), 'three flights, each with its own code: ' + JSON.stringify(r.flights));
    assert.deepEqual(r.hotels.sort(), ['0WY2X7WBI2:' + iso(SEPT), '8DOFD0OCPE:' + iso(NOV)].sort());
    assert.equal(r.trips.length, 2, JSON.stringify(r.trips));
    assert.equal(r.trips[0].past, true, 'September is in the past: ' + JSON.stringify(r.trips[0])); assert.equal(r.trips[1].past, false);
    assert.equal(r.undated, 1, 'the November flight waits in To check');
  });
  await step('the same, whichever email is read first', async () => {
    const r = await feed([frontierSept, courtyard('hs', '0WY2X7WBI2', SEPT, SEPT_BACK), frontierNov, courtyard('hn', '8DOFD0OCPE', NOV, NOV_BACK)]);
    assert.equal(r.flights.length, 3, JSON.stringify(r.flights)); assert.equal(r.trips.length, 2, JSON.stringify(r.trips)); assert.equal(r.trips[0].past, true);
  });
  await step('trips that share a confirmation code join only when they are close in time', async () => {
    const r = await page.evaluate(() => {
      const T = window.__travel; T.bookings.splice(0);
      const mk = (no, from, to, d, conf) => ({ type: 'flight', status: 'confirmed', conf, airlineCode: 'F9', flightNo: no, from, to, dep: d + 'T10:00', arr: d + 'T12:00', guess: false, id: 'x' + no + d });
      const add = b => T.bookings.push(b);
      const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
      add(mk('1', 'RDU', 'CLE', d(10), 'SAME1')); add(mk('2', 'CLE', 'RDU', d(14), 'SAME1'));       // a round trip on one code: one trip
      add(mk('3', 'RDU', 'BOS', d(100), 'SAME2')); add(mk('4', 'BOS', 'RDU', d(160), 'SAME2'));    // the same code two months apart: two trips
      return T.groupTrips().map(g => g.items.length);
    });
    assert.deepEqual(r, [2, 1, 1], JSON.stringify(r));
  });
  await ctx.close();
}

// =================== change by asking: a preview first, nothing until Apply, and Undo ===================
{
  const { ctx, page, seen } = await open({ empty: true, calendar: false });
  const OUT = day(70), HOME = day(74), HOP = day(80), FAR = day(140);
  const flightJson = (no, from, to, d, conf) => ({ '@context': 'http://schema.org', '@type': 'FlightReservation', reservationNumber: conf,
    reservationFor: { '@type': 'Flight', flightNumber: no, airline: { '@type': 'Airline', name: 'Alaska Airlines', iataCode: 'AS' },
      departureAirport: { iataCode: from }, departureTime: iso(d) + 'T17:10:00-05:00', arrivalAirport: { iataCode: to }, arrivalTime: iso(d) + 'T20:01:00-07:00' } });
  const mail = (id, subject, jsonld) => ({ id, from: 'Alaska Airlines <reservation@email.alaskaair.com>', subject, html: `<html><head><script type="application/ld+json">${JSON.stringify(jsonld)}</script></head><body>booked</body></html>` });
  const hotel = { id: 'hx', from: 'Hilton Reservations <info@cvent.com>', subject: 'Hilton San Diego Bayfront Reservation Confirmation',
    text: `Hilton San Diego Bayfront\n1 Park Boulevard\nSan Diego, CA, 92101\nRESERVATION CONFIRMATION\nHotel confirmation:\n3115096800\nArrival date:\n${long(OUT)}\nDeparture date:\n${long(day(73))}\n` };
  await page.evaluate(emails => { const T = window.__travel; T.bookings.splice(0); emails.forEach(m => T.P.parseEmail({ ...m, date: Date.now(), threadId: m.id }).bookings.forEach(b => T.upsert(b))); }, [
    mail('f1', 'Your flight is booked: YAVUUB', [flightJson('474', 'RDU', 'SAN', OUT, 'YAVUUB'), flightJson('434', 'SAN', 'RDU', HOME, 'YAVUUB')]),
    mail('f2', 'Your flight is booked: HOP22X', flightJson('120', 'RDU', 'PDX', HOP, 'HOP22X')),
    mail('f3', 'Your flight is booked: ZZ9PLU', flightJson('900', 'RDU', 'DEN', FAR, 'ZZ9PLU')), hotel]);
  const snapshot = () => page.evaluate(() => { const T = window.__travel; return { bookings: JSON.stringify(T.bookings.map(({ updated, ...rest }) => rest)), trips: T.groupTrips().map(g => g.name + ':' + g.items.length) }; });
  const before = await snapshot();
  assert.equal(before.trips.length, 3, 'the San Diego trip, Portland and Denver: ' + before.trips);

  await step('Change mode: the instruction goes with the trip list (and trip ids, no names), and the changes come back as a preview that changes nothing', async () => {
    await page.waitForFunction(() => !document.getElementById('askForm').hidden, null, { timeout: 5000 });
    assert.equal(await page.textContent('#askMode'), 'Ask');
    await page.click('#askMode');
    assert.equal(await page.textContent('#askMode'), 'Change');
    assert.equal(await page.getAttribute('#askInput', 'placeholder'), 'Tell Travel what to change');
    await page.fill('#askInput', 'Delete the Hilton, move my first flight a day later, join Portland and Denver, and call it December in San Diego');
    await page.press('#askInput', 'Enter');
    await page.waitForSelector('#editYes', { timeout: 5000 });
    assert.equal(seen.edit.length, 1); assert.equal(seen.ask.length, 0, 'it is not a question');
    const sent = JSON.stringify(seen.edit[0]);
    assert.ok(seen.edit[0].trips.every(t => t.tid), 'each trip has an id to rename it by');
    assert.ok(!/Tom|Allison|Pat Example|seat/i.test(sent), 'no names or seats go: ' + sent.slice(0, 200));
    const lines = await page.$$eval('.editlist li', els => els.map(e => e.textContent));
    assert.equal(lines.length, 4, 'the bad value, the unknown booking and the seat are thrown out: ' + JSON.stringify(lines));
    assert.ok(lines.some(l => /^Delete Hilton San Diego Bayfront/.test(l)), JSON.stringify(lines));
    assert.equal(await page.$eval('.editlist li.del', e => e.textContent.startsWith('Delete')), true, 'a delete is marked');
    assert.match(await page.textContent('.askout'), /left out because they didn’t check out/);
    assert.deepEqual(await snapshot(), before, 'nothing has changed yet');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, APP + '-edit-preview.png') });
  });
  await step('Cancel changes nothing; Apply makes exactly the listed changes, keeping the time of a moved flight', async () => {
    await page.click('#askClear');
    assert.equal(await page.$('#editYes'), null); assert.deepEqual(await snapshot(), before);
    await page.fill('#askInput', 'Delete the Hilton, move my first flight a day later, join Portland and Denver, and call it December in San Diego');
    await page.press('#askInput', 'Enter');
    await page.waitForSelector('#editYes', { timeout: 5000 });
    await page.click('#editYes');
    await page.waitForFunction(() => !document.querySelector('#editYes'));
    const after = await page.evaluate(() => { const T = window.__travel; return { hotels: T.bookings.filter(b => b.type === 'hotel').length, first: T.bookings.find(b => b.flightNo === '474'), trips: T.groupTrips().map(g => g.name) }; });
    assert.equal(after.hotels, 0, 'the hotel is gone');
    assert.equal(after.first.dep, iso(day(71)) + 'T17:10', 'a day later, same time: ' + after.first.dep);
    assert.equal(after.first.edited, true);
    assert.equal(after.trips.length, 2, 'Portland and Denver are one trip now: ' + after.trips);
    assert.ok(after.trips.includes('December in San Diego'), 'and the trip has its new name: ' + after.trips);
    assert.match(await page.textContent('#toastMsg'), /^Done: 4 changes\./);
  });
  await step('Undo puts everything back', async () => {
    assert.equal(await page.$eval('#toastAct', e => !e.hidden), true);
    await page.click('#toastAct');
    const back = await snapshot();
    assert.deepEqual(back.trips, before.trips); assert.equal(back.bookings, before.bookings);
  });
  await step('the wider list: set and clear fields, add a booking, cancel, mark checked, take out of a trip; Undo puts it all back', async () => {
    await page.fill('#askInput', 'WIDER: seat 12A, no gate, hotel from 3pm, add dinner with Pat, cancel Portland, looks right, Denver on its own');
    await page.press('#askInput', 'Enter');
    await page.waitForSelector('#editYes', { timeout: 5000 });
    const lines = await page.$$eval('.editlist li', els => els.map(e => e.textContent));
    assert.equal(lines.length, 7, JSON.stringify(lines));
    assert.ok(lines.some(l => /^Add other: Dinner with Pat \(20\d\d-\d\d-\d\d\)$/.test(l)), JSON.stringify(lines));
    assert.ok(lines.some(l => /^Cancel AS 120/.test(l)) && lines.some(l => /^Mark Hilton San Diego Bayfront as checked$/.test(l)) && lines.some(l => /^Take AS 900.* out of its trip/.test(l)), JSON.stringify(lines));
    assert.match(await page.textContent('.askout'), /1 change left out because it didn’t check out/);
    await page.click('#editYes');
    await page.waitForFunction(() => !document.querySelector('#editYes'));
    const after = await page.evaluate(() => { const T = window.__travel, by = n => T.bookings.find(b => b.flightNo === n);
      return { seat: by('474').seat, gate: by('474').gate, hotel: T.bookings.find(b => b.type === 'hotel'), dinner: T.bookings.find(b => b.title === 'Dinner with Pat'), pdx: by('120').status, den: by('900').tripApart, count: T.bookings.length }; });
    assert.equal(after.seat, '12A'); assert.equal(after.gate, '');
    assert.equal(after.hotel.checkInTime, '15:00'); assert.equal(after.hotel.checked, true); assert.equal(after.hotel.guess, false);
    assert.deepEqual([after.dinner.type, after.dinner.place, after.dinner.edited, after.dinner.guess], ['other', 'Old Town', true, false]);
    assert.equal(after.pdx, 'cancelled'); assert.equal(after.den, true);
    assert.equal(after.count, JSON.parse(before.bookings).length + 1, 'one booking added');
    assert.match(await page.textContent('#toastMsg'), /^Done: 7 changes\./);
    await page.click('#toastAct');
    const back = await snapshot();
    assert.equal(back.bookings, before.bookings); assert.deepEqual(back.trips, before.trips);
  });
  await step('Settings says which models answer, and what the last answer came from', async () => {
    await page.click('#setBtn');
    await page.waitForSelector('#setSheet:not([hidden]) #stAiSub');
    await page.waitForFunction(() => /Models:/.test(document.getElementById('stAiSub').textContent), null, { timeout: 5000 });
    let sub = await page.textContent('#stAiSub');
    assert.match(sub, /Models: Check Haiku 5\.5; Ask and Change Sonnet 5\.5 \(the last answer came from it\)\./, sub);
    // a different model answering (a fallback, say) is said out loud
    await page.evaluate(() => { const k = Object.keys(localStorage).find(x => /-ai-last$/.test(x)); localStorage.setItem(k, JSON.stringify({ ask: 'claude-opus-5-5-20261001', check: 'claude-haiku-5-5' })); });
    await page.click('#stCalOpt'); await page.click('#stCalOpt');     // any redraw of Settings
    sub = await page.textContent('#stAiSub');
    assert.match(sub, /Check Haiku 5\.5 \(the last answer came from it\); Ask and Change Sonnet 5\.5 \(but the last answer came from Opus 5\.5\)\./, sub);
    await page.$eval('#stAiSub', e => e.scrollIntoView({ block: 'center' }));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, APP + '-models.png') });
    await page.keyboard.press('Escape');
    await page.evaluate(() => { document.querySelectorAll('.sheetwrap').forEach(w => { if (!w.hidden && w.querySelector('[data-close]')) w.querySelector('[data-close]').click(); }); });
  });
  await step('a change that checks out nowhere is never offered; the app checks again whatever the server says', async () => {
    const bad = await page.evaluate(() => {
      const T = window.__travel, b = T.bookings.find(x => x.type === 'flight');
      return [T.checkEdit({ op: 'set', id: b.id, field: 'from', value: 'Raleigh' }), T.checkEdit({ op: 'set', id: b.id, field: 'checkIn', value: '2026-12-01' }),
        T.checkEdit({ op: 'delete', id: 'nope' }), T.checkEdit({ op: 'join', id: b.id, with: b.id }), T.checkEdit({ op: 'rename', id: 'nope', name: 'x y' }), T.checkEdit({ op: 'drop table' })];
    });
    assert.deepEqual(bad, [null, null, null, null, null, null]);
  });
  await ctx.close();
}

// =================== the settings switches ===================
{
  const { ctx, page, seen } = await open({ calendar: true });
  await step('Settings lists what Travel read: each email, and what it made of it', async () => {
    await page.click('#setBtn');
    await page.waitForSelector('#setSheet:not([hidden]) #stLog');
    assert.match(await page.textContent('#stLog'), /Last look .*: \d+ emails? read, \d+ bookings? found/);
    await page.click('#stLog');
    await page.waitForSelector('#logSheet:not([hidden]) .logrow');
    const rows = await page.$$eval('#logSheet .logrow', els => els.map(e => [e.querySelector('b').textContent.trim(), e.querySelector('.lgo').textContent.trim()]));
    assert.equal(rows.length, EMAILS.length, JSON.stringify(rows));
    const by = s => rows.find(([t]) => t.includes(s));
    assert.match(by('KQ7T2M')[1], /^1 flight$/); assert.match(by('Cleveland')[1], /flight/);
    assert.match(await page.textContent('#lgHint'), /was not matched/);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, APP + '-log.png') });
    await page.evaluate(() => document.querySelectorAll('.sheetwrap').forEach(w => { if (!w.hidden) w.querySelector('[data-close]').click(); }));
  });
  await step('the Family calendar and AI switches are in Settings, and off means off', async () => {
    await page.click('#setBtn');
    await page.waitForSelector('#setSheet:not([hidden]) #stCalOpt');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, APP + '-settings.png') });
    assert.match(await page.textContent('#stCalSub'), /^On\./); assert.match(await page.textContent('#stAiSub'), /Nothing is sent until you press or ask/);
    assert.ok(!!(await page.$('.tripwrap [data-ai]')), 'the button is there while the switch is on');
    await page.click('#stCalOpt'); await page.click('#stAiOpt');
    assert.equal((await page.textContent('#stCalSub')).trim(), 'Off'); assert.match(await page.textContent('#stAiSub'), /^Off\. No button and no bar/);
    assert.equal(!!(await page.$('.tripwrap [data-ai]')), false, 'and gone when it is off');
    assert.equal(await page.$eval('#askForm', e => e.hidden), true, 'the Ask AI bar goes with it');
    const before = { ev: seen.events, ex: seen.extract.length };
    await page.evaluate(() => window.__travel.smartPass());
    assert.equal(seen.events, before.ev); assert.equal(seen.extract.length, before.ex);
  });
  await ctx.close();
}

await browser.close();
server.close();
if (failed) { console.log(failed + ' failed'); process.exit(1); }
console.log('all passed');
