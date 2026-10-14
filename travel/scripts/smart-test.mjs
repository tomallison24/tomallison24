// Drives Travel (or Travel Vintage) in headless Chromium for the "smart" parts, with
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
//   node travel/scripts/smart-test.mjs [app folder: travel | travelvintage] [repo root]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const APP = process.argv[2] || 'travel';
const ROOT = path.resolve(process.argv[3] || new URL('../..', import.meta.url).pathname);
const ID = APP;   // the aOS id (data-app)
const SHOTS = process.env.SHOTS || '';   // a folder for screenshots (optional)

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
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
    parts: [m.html ? { mimeType: 'text/html', headers: [{ name: 'Content-Type', value: 'text/html; charset="UTF-8"' }], body: { data: b64(m.html) } }
      : { mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset=UTF-8' }], body: { data: b64(m.text) } }] },
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

async function open({ calendar = true, ai = true, board = true, empty = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript(id => localStorage.setItem('aos.seen', JSON.stringify({ [id]: '999' })), ID);
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404/.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', e => problems.push(String(e)));
  const seen = { extract: [], find: [], ask: [], imports: [], deletes: [], events: 0 };
  await ctx.route('https://gmail.googleapis.com/**', route => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/profile')) return route.fulfill({ json: { emailAddress: 'pat@example.com' } });
    if (u.pathname.endsWith('/messages')) return route.fulfill({ json: { messages: EMAILS.map(m => ({ id: m.id, threadId: m.threadId })) } });
    const m = EMAILS.find(x => x.id === u.pathname.split('/').pop());
    return m ? route.fulfill({ json: gmailMessage(m) }) : route.fulfill({ status: 404, json: {} });
  });
  await ctx.route(BASE + '/travel/api/**', route => {
    const req = route.request(), u = new URL(req.url());
    if (req.headers()['x-travel'] !== '1') return route.fulfill({ status: 404, json: { error: 'not-found' } });
    if (u.pathname.endsWith('/ping')) return route.fulfill({ json: { ok: true, status: true, find: board, ai } });
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
      return route.fulfill({ json: { ok: true, answer: 'Your next flight is ' + (first && first.flight) + '.', bookingIds: first ? [first.id, 'not-a-booking'] : [] } });
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
    const k = location.pathname.includes('travelvintage') ? 'travelv' : 'travel';
    if (localStorage.getItem('test.nomail')) return;
    localStorage.setItem(k + '.token', JSON.stringify({ t: 'fake-token', exp: Date.now() + 3600e3, scope: 'https://www.googleapis.com/auth/gmail.readonly' }));
    localStorage.setItem(k + '.token.ever', '1');
  });
  if (empty) await ctx.addInitScript(() => localStorage.setItem('test.nomail', '1'));
  await page.goto(BASE + '/' + APP + '/');
  await page.waitForFunction(() => window.__travel && (window.__travel.bookings.length >= 4 || localStorage.getItem('test.nomail')), null, { timeout: 10000 });
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

// =================== the settings switches ===================
{
  const { ctx, page, seen } = await open({ calendar: true });
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
