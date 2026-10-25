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
//  - Calendar's Travel layer leaves out what the calendar already has;
//  - Have Ipsy check this trip (a trip's page) reads each booking's newest email, a schedule change
//    the reader didn't recognise included, and updates what changed, with Undo; an edited one stays.
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
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';
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
// Found only by searching for a confirmation code (Have Ipsy check this trip): a schedule change the reader doesn't
// take for a booking, newer than United's confirmation.
const SEARCH_ONLY = [
  { id: 'e6', threadId: 'u2', age: 0.5, from: 'United Airlines <notifications@united.com>', subject: 'Important information about your trip', text:
    `Confirmation number KQ7T2M\nWe had to change your schedule.\nUA 110 Denver (DEN) to Boston (BOS) on ${long(BACK)} now departs at 9:05 PM and arrives at 12:30 AM.\nNo action is needed.` },
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
  await ctx.addInitScript(id => (localStorage.setItem('aos.helper', '{"who":"mia","name":"Ipsy"}'), localStorage.setItem('aos.sky', 'day'), localStorage.setItem('aos.seen', JSON.stringify({ [id]: '999' }))), ID);   // the sky held at day
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404/.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', e => problems.push(String(e)));
  const seen = { extract: [], auth: [], find: [], imports: [], deletes: [], events: 0, sheet: [], searches: [] };
  // The family's Google Sheet, through aOS (functions/sheet/api, stood in for here): the real script on an
  // in-memory Sheet, who's asking from the session the page sends. Only a signed-in phone syncs.
  const sheet = seen.sheetTab = fakeSheet(path.join(ROOT, 'travel', 'google-sheet-sync.gs'), 'test-secret-phrase');
  const FAMILY = { 'sess-1': { id: 'u1', name: 'Pat' } };
  await ctx.route(BASE + '/sheet/api/**', route => {
    const req = route.request(), who = FAMILY[(req.headers().authorization || '').replace('Bearer ', '')];
    if (!who) return route.fulfill({ status: 401, json: { error: 'signin' } });
    if (req.method() === 'GET') return route.fulfill({ json: { configured: true } });
    seen.sheet.push(JSON.parse(req.postData()));
    return route.fulfill({ json: sheet.post(req.postData(), { key: 'test-secret-phrase', who: who.id, name: who.name }) });
  });
  await ctx.route('https://gmail.googleapis.com/**', route => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/profile')) return route.fulfill({ json: { emailAddress: 'pat@example.com' } });
    if (u.pathname.endsWith('/messages')) {
      const conf = /^"([A-Z0-9]+)"/.exec(u.searchParams.get('q') || '');      // a search for one confirmation code
      if (conf) { seen.searches.push(u.searchParams.get('q')); return route.fulfill({ json: { messages: [...SEARCH_ONLY, ...EMAILS].filter(m => (m.text || m.html).includes(conf[1])).map(m => ({ id: m.id, threadId: m.threadId })) } }); }
      return route.fulfill({ json: { messages: (empty ? [] : EMAILS).map(m => ({ id: m.id, threadId: m.threadId })) } });
    }
    if (failGets) return route.fulfill({ status: 500, body: 'down' });
    const m = [...EMAILS, ...SEARCH_ONLY].find(x => x.id === u.pathname.split('/').pop());
    return m ? route.fulfill({ json: gmailMessage(m) }) : route.fulfill({ status: 404, json: {} });
  });
  await ctx.route(BASE + '/travel/api/**', route => {
    const req = route.request(), u = new URL(req.url());
    if (req.headers()['x-travel'] !== '1') return route.fulfill({ status: 404, json: { error: 'not-found' } });
    if (u.pathname.endsWith('/ping')) return route.fulfill({ json: { ok: true, status: true, find: board, ai, models: { check: 'claude-haiku-5-5', ipsy: 'claude-sonnet-5-5' } } });
    if (u.pathname.endsWith('/extract')) {
      const body = JSON.parse(req.postData() || '{}');
      seen.extract.push(body); seen.auth.push(req.headers().authorization || '');
      if (seen.tooBig) return route.fulfill({ status: 413, json: { error: 'too-big' } });   // the server's answer to a body over its limit
      // the made-up AI: knows the airports when asked for them, and says nothing it cannot quote; checking a booking,
      // it reads the new time out of United's schedule change
      if (body.check) return route.fulfill({ json: { ok: true, fields: /now departs at 9:05 PM/.test(body.text) ? { airlineCode: 'UA', flightNo: '110', from: 'DEN', to: 'BOS', date: iso(BACK), depTime: '21:05', arrTime: '00:30' } : {} } });
      return route.fulfill({ json: { ok: true, fields: body.missing.includes('from') ? { from: 'MCO', to: 'PHL' } : {} } });
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
  await step('only a trip with something missing has a Have Ipsy check button; pressing it asks once, for what is missing, and marks the answer', async () => {
    await page.click('[data-when="upcoming"]');
    const cards = await page.$$eval('.tripwrap', els => els.map(e => ({ name: e.querySelector('h3').textContent, ai: !!e.querySelector('[data-ai]') })));
    assert.equal(cards.filter(c => c.ai).length, 1, JSON.stringify(cards));
    assert.equal(cards.filter(c => !c.ai).length >= 1, true, 'the trip that has everything has no button: ' + JSON.stringify(cards));
    if (SHOTS) { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(SHOTS, APP + '-aicard.png') }); }
    await page.click('.tripwrap [data-ai]');
    await page.waitForFunction(() => /Ipsy filled in 2 details/.test(document.getElementById('toastMsg').textContent), null, { timeout: 8000 });
    assert.equal(seen.extract.length, 1, JSON.stringify(seen.extract.map(x => x.missing)));
    assert.deepEqual(seen.extract[0].missing.sort(), ['from', 'to']);
    assert.equal(seen.extract[0].type, 'flight');
    assert.ok(!JSON.stringify(seen.extract[0]).includes('pat@example.com'));
    assert.ok(seen.extract[0].text.length <= 8000, 'an excerpt the server takes (functions/travel/api MAX_BODY): ' + seen.extract[0].text.length);
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
  await step('an email the server will not take (too-big) is said, not passed off as read', async () => {
    await page.evaluate(() => { const b = window.__travel.bookings.find(x => x.conf === 'TRZ4KD'); b.from = ''; b.to = ''; delete b.filled; window.__travel.render(); });
    seen.tooBig = true;
    const before = seen.extract.length;
    await page.click('.tripwrap [data-ai]');
    await page.waitForFunction(() => /couldn’t read the emails/.test(document.getElementById('toastMsg').textContent), null, { timeout: 8000 });
    assert.equal(seen.extract.length, before + 1, 'asked once');
    assert.doesNotMatch(await page.textContent('#toastMsg'), /doesn’t say anything more/);
    const b = await pick(page, () => window.__travel.bookings.find(x => x.conf === 'TRZ4KD'));
    assert.equal(b.from, ''); assert.equal(b.filled, undefined, 'nothing filled in');
    seen.tooBig = false;
    await page.evaluate(() => { const b = window.__travel.bookings.find(x => x.conf === 'TRZ4KD'); b.from = 'MCO'; b.to = 'PHL'; window.__travel.render(); });
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
    assert.match(await page.textContent('#stLog'), /stopped: \d+ emails? could not be downloaded$/);
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
    assert.match(await page.textContent('#lgHint'), /^\d+ emails? matched Travel’s search in the last look\.$/);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, APP + '-log.png') });
    await page.evaluate(() => document.querySelectorAll('.sheetwrap').forEach(w => { if (!w.hidden) w.querySelector('[data-close]').click(); }));
  });
  await step('the Family calendar and AI switches are in Settings, and off means off', async () => {
    await page.click('#setBtn');
    await page.waitForSelector('#setSheet:not([hidden]) #stCalOpt');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, APP + '-settings.png') });
    assert.equal(await page.textContent('#stCalSub'), 'On. Shares bookings with the Family calendar, both ways.'); assert.match(await page.textContent('#stAiSub'), /^On\. Ipsy fills in a trip’s missing details from its email\./);
    assert.equal(await page.textContent('#stIpsyAutoSub'), 'Asks first. Ipsy checks new bookings that are missing details.');
    assert.ok(!!(await page.$('.tripwrap [data-ai]')), 'the button is there while the switch is on');
    await page.click('#stCalOpt'); await page.click('#stAiOpt');
    assert.equal(await page.textContent('#stCalSub'), 'Off. Shares bookings with the Family calendar, both ways.'); assert.equal(await page.textContent('#stAiSub'), 'Off. Ipsy fills in a trip’s missing details from its email.');
    assert.equal(!!(await page.$('.tripwrap [data-ai]')), false, 'and gone when it is off');
    const before = { ev: seen.events, ex: seen.extract.length };
    await page.evaluate(() => window.__travel.smartPass());
    assert.equal(seen.events, before.ev); assert.equal(seen.extract.length, before.ex);
    await page.click('#stAiOpt');
  });
  await step('Settings says which models answer: Check, with what its last answer came from, and Ipsy', async () => {
    await page.evaluate(() => { const k = Object.keys(localStorage).find(x => /-ai-last$/.test(x)) || 'allison-travel-v1-ai-last'; localStorage.setItem(k, JSON.stringify({ check: 'claude-haiku-5-5' })); });
    await page.click('#stCalOpt'); await page.click('#stCalOpt');     // any redraw of Settings
    await page.waitForFunction(() => /Models:/.test(document.getElementById('stAiSub').textContent), null, { timeout: 5000 });
    let sub = await page.textContent('#stAiSub');
    assert.match(sub, /Models: Check Haiku 5\.5 \(the last answer came from it\); Ipsy Sonnet 5\.5\./, sub);
    // a different model answering (a fallback, say) is said out loud
    await page.evaluate(() => { const k = Object.keys(localStorage).find(x => /-ai-last$/.test(x)); localStorage.setItem(k, JSON.stringify({ check: 'claude-opus-5-5-20261001' })); });
    await page.click('#stCalOpt'); await page.click('#stCalOpt');
    sub = await page.textContent('#stAiSub');
    assert.match(sub, /Check Haiku 5\.5 \(but the last answer came from Opus 5\.5\); Ipsy Sonnet 5\.5\./, sub);
    await page.$eval('#stAiSub', e => e.scrollIntoView({ block: 'center' }));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, APP + '-models.png') });
  });
  await ctx.close();
}

// =================== Ipsy checks by itself: offered once, then each booking's email read quietly, with Undo ===================
{
  const { ctx, page, seen, problems } = await open({ calendar: false, stored: { 'aos.session': JSON.stringify({ token: 'sess-1', user: { id: 'u1', name: 'Pat' } }) } });
  page.on('dialog', d => { problems.push('a browser dialog: ' + d.message()); d.dismiss(); });
  const orl = () => pick(page, () => { const b = window.__travel.bookings.find(x => x.conf === 'TRZ4KD'); return b && { from: b.from, to: b.to, guess: b.guess, filled: b.filled || null }; });
  await step('Ipsy\'s own check: offered once, from its corner, before anything is sent', async () => {
    await page.waitForSelector('.ipsy-hint', { timeout: 12000 });
    assert.match(await page.textContent('.ipsy-hint'), /missing details\. Want me to look\?/);
    assert.equal(seen.extract.length, 0, 'nothing is sent before a yes');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, APP + '-ipsy-offer.png') });
    await page.click('.ipsy-hint');
    await page.waitForSelector('.ipsy-ask [data-ans="yes"]');
    assert.match(await page.textContent('.ipsy-ask'), /fill in what your upcoming bookings are missing, by myself/);
    await page.click('.ipsy-ask [data-ans="yes"]');
  });
  await step('Ipsy\'s own check: each booking missing something is asked about once, signed in quietly, with Undo in the chat', async () => {
    await page.waitForFunction(() => { const b = window.__travel.bookings.find(x => x.conf === 'TRZ4KD'); return b && b.from === 'MCO'; }, null, { timeout: 15000 });
    assert.equal(seen.extract.length, 1, JSON.stringify(seen.extract.map(x => x.missing)));
    assert.deepEqual(seen.extract[0].missing.sort(), ['from', 'to']);
    assert.equal(seen.auth[0], 'Bearer sess-1', 'the family session, never a Face ID prompt');
    const b = await orl();
    assert.equal(b.to, 'PHL'); assert.equal(b.filled.from, 'ai'); assert.equal(b.guess, true, 'what Ipsy fills in waits in To check');
    await page.waitForFunction(() => /I filled in 2 details/.test((document.querySelector('.ipsy-hint') || {}).textContent || ''), null, { timeout: 8000 });
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, APP + '-ipsy-filled.png') });
    await page.click('.ipsy-hint');
    await page.waitForSelector('.ipsy-change');
    assert.match(await page.textContent('.ipsy-change'), /Filled in 2 details on .*Marked Check\..*Undo/);
    await page.locator('.ipsy-change .ipsy-undo').first().click();
    await page.waitForFunction(() => { const b = window.__travel.bookings.find(x => x.conf === 'TRZ4KD'); return b && !b.from && !b.filled; }, null, { timeout: 5000 });
    await page.keyboard.press('Escape');
  });
  await step('Ipsy\'s own check: the same email is never asked about twice, and Settings turns it off', async () => {
    const n = seen.extract.length;
    await page.reload();
    await page.waitForFunction(() => window.__travel && document.querySelector('.ipsy-btn'));
    await page.waitForTimeout(4000);
    assert.equal(seen.extract.length, n, 'already checked: not sent again');
    assert.equal(await page.$$eval('.ipsy-hint', e => e.length), 0);
    await page.click('#setBtn');
    await page.waitForSelector('#setSheet:not([hidden]) #stIpsyAutoOpt');
    assert.match(await page.textContent('#stIpsyAutoSub'), /^On\./);
    await page.click('#stIpsyAutoOpt');
    assert.match(await page.textContent('#stIpsyAutoSub'), /^Off\./);
    assert.equal(await page.evaluate(() => localStorage.getItem('allison-travel-v1-ipsy-auto')), '0');
  });
  await step('signed in, the bookings (and what Ipsy filled in, then undid) went to the family\'s Google Sheet as Pat\'s', async () => {
    assert.ok(seen.sheet.length && seen.sheet.every(c => !('secret' in c)), 'synced through aOS, with no phrase');
    const rows = seen.sheetTab.tab('Bookings').slice(1);
    assert.ok(rows.length && rows.every(r => r[0] === 'Pat'), rows.map(r => r[0] + ':' + r[4]).join(' | '));
    assert.ok(await page.evaluate(() => window.__travel.bookings.filter(b => b.conf === 'TRZ4KD').every(b => b.by === 'u1' && !b.from)), 'the Undo kept, marked as hers');
  });
  await step('Ipsy\'s own check: no script errors and no browser dialogs', async () => { assert.deepEqual(problems, []); });
  await ctx.close();
}

// =================== Have Ipsy check this trip ===================
{
  const { ctx, page, seen, problems } = await open({ calendar: false });
  await page.waitForFunction(() => window.__travel.bookings.some(b => b.conf === 'KQ7T2M'), null, { timeout: 10000 });
  const ua = () => pick(page, () => { const b = window.__travel.bookings.find(x => x.conf === 'KQ7T2M'); return JSON.parse(JSON.stringify(b)); });
  const openTrip = async conf => {
    const id = await page.evaluate(c => window.__travel.groupTrips().find(g => g.items.some(b => b.conf === c)).id, conf);
    await page.click('[data-trip="' + id + '"]');
    await page.waitForSelector('#tripPage:not([hidden]) #tpAi');
  };
  await step('Have Ipsy check this trip: on a trip\'s page, it reads the newest email (a schedule change) and updates the flight, marked Check', async () => {
    const was = await ua();
    assert.equal(was.dep, iso(BACK) + 'T20:15');
    await openTrip('KQ7T2M');
    assert.match(await page.textContent('#tpAi'), /Have Ipsy check this trip/);
    if (SHOTS) { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(SHOTS, APP + '-tripcheck.png') }); }
    await page.click('#tpAi');
    await page.waitForFunction(() => /Ipsy updated 1 booking/.test(document.getElementById('toastMsg').textContent), null, { timeout: 8000 });
    assert.ok(seen.searches.some(q => q.startsWith('"KQ7T2M" after:')), seen.searches.join(' | '));
    const sent = seen.extract.filter(x => x.check);
    assert.equal(sent.length, 1, JSON.stringify(sent.map(x => x.known)));
    assert.deepEqual(sent[0].missing, ['airlineCode', 'flightNo', 'from', 'to', 'date', 'depTime', 'arrTime'], 'every detail is asked for, not only what is missing');
    assert.equal(sent[0].known.depTime, '20:15'); assert.equal(sent[0].known.date, iso(BACK));
    assert.match(sent[0].text, /now departs at 9:05 PM/, 'the newer email, not the confirmation');
    const b = await ua();
    assert.equal(b.dep, iso(BACK) + 'T21:05'); assert.equal(b.arr, iso(day(34)) + 'T00:30'); assert.equal(b.depIso, '');
    assert.equal(b.filled.time, 'ai'); assert.equal(b.filled.date, undefined, 'the day didn\'t change'); assert.equal(b.guess, true);
    assert.equal(b.source.msgId, 'e6', 'the booking follows the newer email');
    assert.match(await page.textContent('#tpAi'), /Have Ipsy check this trip/, 'the button is back once Ipsy is done');
  });
  await step('Have Ipsy check this trip: Undo puts the flight back as it was', async () => {
    await page.click('#toastAct');
    await page.waitForFunction(() => window.__travel.bookings.find(x => x.conf === 'KQ7T2M').dep.endsWith('T20:15'), null, { timeout: 5000 });
    const b = await ua();
    assert.equal(b.source.msgId, 'e2'); assert.equal(b.filled, undefined);
  });
  await step('Have Ipsy check this trip: a booking you edited stays as you typed it, and nothing about it is sent', async () => {
    await page.evaluate(() => { const b = window.__travel.bookings.find(x => x.conf === 'KQ7T2M'); b.edited = true; window.__travel.save(); });
    const n = seen.extract.length;
    await page.click('#tpAi');
    await page.waitForFunction(() => /as you typed/.test(document.getElementById('toastMsg').textContent), null, { timeout: 8000 });
    assert.equal(seen.extract.length, n);
    assert.equal((await ua()).dep, iso(BACK) + 'T20:15');
  });
  await step('Have Ipsy check this trip: a private trip has no button', async () => {
    await page.click('#tpPriv');
    assert.equal(!!(await page.$('#tpAi')), false);
    await page.click('#tpPriv');
    assert.ok(!!(await page.$('#tpAi')));
  });
  // welcome.js: a popup's way out floats at the bottom left too (every app; tested here, on Travel's popups)
  const floater = () => page.evaluate(() => { const f = document.querySelector('.aos-fback'); return f && !f.hidden ? { label: f.getAttribute('aria-label'), kind: f.dataset.kind, ...JSON.parse(JSON.stringify(f.getBoundingClientRect())) } : null; });
  const floats = label => page.waitForFunction(l => { const f = document.querySelector('.aos-fback'); return l ? f && !f.hidden && f.getAttribute('aria-label') === l : !f || f.hidden; }, label, { timeout: 5000 });
  await step('the way out floats at the bottom: Back on a trip, Done on a booking, nothing beside Cancel, and it presses the real one', async () => {
    await floats('Back to trips');
    const f = await floater();
    assert.equal(f.kind, 'back'); assert.ok(f.left < 40 && f.bottom > 844 - 60, JSON.stringify(f));
    await page.click('#tpBody [data-bk]');
    await page.waitForSelector('#bkSheet:not([hidden])');
    await floats('Done');
    if (SHOTS) { await page.waitForTimeout(800); await page.screenshot({ path: path.join(SHOTS, APP + '-floatdone.png') }); }
    await page.click('.aos-fback');
    await page.waitForSelector('#bkSheet', { state: 'hidden' });
    await floats('Back to trips');
    await page.click('#tpAdd');
    await page.waitForSelector('#addSheet:not([hidden])');
    await floats(null);
    await page.click('#addSheet .sheethead [aria-label="Cancel"]');
    await floats('Back to trips');
    await page.click('.aos-fback');
    await page.waitForSelector('#tripPage', { state: 'hidden' });
    await floats(null);
  });
  await step('Have Ipsy check these, in To check: the same check for what\'s waiting there, with Undo', async () => {
    await page.evaluate(() => { const b = window.__travel.bookings.find(x => x.conf === 'KQ7T2M'); b.edited = false; b.guess = true; delete b.filled; window.__travel.save(); window.__travel.render(); });
    await page.click('[data-when="check"]');
    await page.waitForSelector('#ckAi');
    assert.match(await page.textContent('#ckAi'), /Have Ipsy check these/);
    if (SHOTS) { await page.waitForTimeout(800); await page.screenshot({ path: path.join(SHOTS, APP + '-tocheck-ipsy.png') }); }
    const n = seen.extract.length;
    await page.click('#ckAi');
    await page.waitForFunction(() => /Ipsy updated 1 booking/.test(document.getElementById('toastMsg').textContent), null, { timeout: 8000 });
    const sent = seen.extract.slice(n).filter(x => x.check);
    assert.ok(sent.length >= 1 && sent.some(x => x.known.depTime === '20:15'), JSON.stringify(sent.map(x => x.known)));
    const b = await ua();
    assert.equal(b.dep, iso(BACK) + 'T21:05'); assert.equal(b.filled.time, 'ai'); assert.equal(b.guess, true, 'still waiting in To check for you');
    assert.match(await page.textContent('#ckAi'), /Have Ipsy check these/, 'the button is back once Ipsy is done');
    await page.click('#toastAct');
    await page.waitForFunction(() => window.__travel.bookings.find(x => x.conf === 'KQ7T2M').dep.endsWith('T20:15'), null, { timeout: 5000 });
  });
  await step('Have Ipsy check these: a private booking isn\'t sent', async () => {
    await page.evaluate(() => { const b = window.__travel.bookings.find(x => x.conf === 'KQ7T2M'); b.private = true; b.guess = true; window.__travel.save(); window.__travel.render(); });
    const n = seen.extract.length;
    if (await page.$('#ckAi')) { await page.click('#ckAi'); await page.waitForTimeout(1500); }
    assert.ok(!seen.extract.slice(n).some(x => /KQ7T2M/.test(x.text || '')), 'nothing about the private booking');
    await page.evaluate(() => { const b = window.__travel.bookings.find(x => x.conf === 'KQ7T2M'); delete b.private; window.__travel.save(); window.__travel.render(); });
  });
  await step('Have Ipsy check this trip: no script errors', async () => { assert.deepEqual(problems, []); });
  await ctx.close();
}

await browser.close();
server.close();
if (failed) { console.log(failed + ' failed'); process.exit(1); }
console.log('all passed');
