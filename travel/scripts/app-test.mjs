// Drives the Travel app in headless Chromium against a stubbed Gmail and a
// stubbed flight status function, with made-up booking emails dated around
// today: reading Gmail, grouping into a trip, the trip page, a booking with
// live status, the calendar file, Explore's links, and that nothing trips
// the page's Content Security Policy. Screenshots go to the folder given as
// the second argument (default: none).
// Both designs (../home/design.js): Vintage, the default, drawn in the Retro look (the sky held at day,
// aos.sky): Futura, flat cream (walnut) cards, a mustard thumb, an orange add button, atomic shapes
// behind the title; and Standard (Sea glass). Settings > Design switches between them at once and
// keeps the choice; and the old Travel Vintage address (served from travel/, as the deploy does)
// moves that app's data on the phone over to Travel's names, and still reaches Travel's route.
// The family's Google Sheet, through aOS (the real script on fake-sheet.mjs, answering **/sheet/api/travel
// as the session token says who): signed out it asks to sign in; signed in, bookings go to the Sheet as
// their person's; Just me on a booking and a trip (only you see it), and Ella's phone not getting them;
// past trips over 90 days kept in the Sheet and fetched back for Past; the old link handed over to aOS.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node travel/scripts/app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';

// ---- a static server for the repo ----
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

// ---- made-up emails, dated from today ----
const pad = n => String(n).padStart(2, '0');
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const long = d => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const med = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const soon = new Date(Date.now() + 5 * 3600e3);                      // the first flight leaves in 5 hours
const hm = d => { let h = d.getHours(), m = d.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + pad(m) + ' ' + ap; };
const arrive = new Date(soon.getTime() + 4 * 3600e3);
const EMAILS = [
  { id: 'm1', threadId: 't1', from: 'United Airlines <unitedairlines@united.com>', subject: 'Your trip confirmation - KQ7T2M', html:
    `<html><body><table><tr><td>Confirmation number:</td><td>KQ7T2M</td></tr>
     <tr><td>${long(soon)}</td></tr><tr><td>UA 1234</td></tr>
     <tr><td>Denver, CO, US (DEN) to Boston, MA, US (BOS)</td></tr>
     <tr><td>Departs ${hm(soon)}</td><td>Arrives ${hm(arrive)}</td></tr>
     <tr><td>${long(day(4))}</td></tr><tr><td>UA 987</td></tr>
     <tr><td>Boston, MA, US (BOS) to Denver, CO, US (DEN)</td></tr><tr><td>Departs 6:15 PM</td><td>Arrives 9:02 PM</td></tr></table></body></html>` },
  { id: 'm2', threadId: 't2', from: 'Marriott Bonvoy <reservations@res.marriott.com>', subject: 'Reservation Confirmation #81234567 for Courtyard Boston Downtown', html:
    `<html><head><script type="application/ld+json">${JSON.stringify({ '@context': 'http://schema.org', '@type': 'LodgingReservation', reservationNumber: '81234567',
      reservationStatus: 'http://schema.org/ReservationConfirmed', reservationFor: { '@type': 'LodgingBusiness', name: 'Courtyard Boston Downtown',
      address: { streetAddress: '275 Tremont St', addressLocality: 'Boston', addressRegion: 'MA', postalCode: '02116', addressCountry: 'US' } },
      checkinDate: iso(soon), checkoutDate: iso(day(4)) })}</script></head><body>See you soon.</body></html>` },
  { id: 'm3', threadId: 't3', from: 'National Car Rental <nationalcar@nationalcar.com>', subject: 'National Car Rental Reservation Confirmation', text:
    `Confirmation Number: 1234567890\nPick-Up\n${long(day(1))} 10:00 AM\nBoston Logan International Airport (BOS)\nReturn\n${long(day(4))} 3:00 PM\nBoston Logan International Airport (BOS)\nVehicle Class: Midsize` },
  { id: 'm4', threadId: 't4', from: 'Deals <deals@example.com>', subject: 'Your booking deals', text: 'Fares from $49. Book by Friday.' },
  { id: 'm5', threadId: 't5', from: 'Frontier Airlines <noreply@emails.flyfrontier.com>', subject: 'Your Frontier Airlines Itinerary', text:
    `Your trip confirmation code is TRZ4KD\nFlight 2154\nOrlando (MCO) → Philadelphia (PHL)\n${long(day(40))}\nDepart 10:40am  Arrive 1:18pm` },
  // Rides, from Mail's Travel label: one from Boston airport on the trip, one at home.
  { id: 'm6', threadId: 't6', from: 'Uber Receipts <noreply@uber.com>', subject: '[Personal] Your Friday evening trip with Uber', text:
    `${med(soon)} 9:05 PM\nThanks for riding, Tom\nTotal  $31.20\nTrip details\n9:10 PM\nBoston Logan International Airport (BOS), Boston, MA 02128, US\n9:32 PM\n275 Tremont St, Boston, MA 02116, US` },
  { id: 'm7', threadId: 't7', from: 'Lyft <no-reply@lyftmail.com>', subject: 'Your ride with Jess on ' + med(day(-20)), text:
    `Thanks for riding with Jess!\nApple Pay (Visa)  $14.10\nPickup 8:02 AM\n12 Main St, Apex, NC 27502, US\nDrop-off 8:15 AM\n500 Salem St, Apex, NC 27502, US\n${med(day(-20))}` },
];
const b64 = s => Buffer.from(s, 'utf8').toString('base64url');
const gmailMessage = m => ({
  id: m.id, threadId: m.threadId, internalDate: String(Date.now() - 86400e3),
  payload: { mimeType: 'multipart/alternative', headers: [{ name: 'Subject', value: m.subject }, { name: 'From', value: m.from }],
    parts: [m.html ? { mimeType: 'text/html', headers: [{ name: 'Content-Type', value: 'text/html; charset="UTF-8"' }], body: { data: b64(m.html) } }
      : { mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset=UTF-8' }], body: { data: b64(m.text) } }] },
});
const utc = d => d.toISOString().slice(0, 16).replace('T', ' ') + 'Z';
const loc = d => iso(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '-06:00';
const late = new Date(soon.getTime() + 35 * 6e4);

const browser = await chromium.launch();
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n  ', e.message.split('\n').slice(0, 6).join('\n   ')); } };

for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.addInitScript(() => (localStorage.setItem('aos.sky', 'day'), localStorage.setItem('aos.seen', JSON.stringify({ travel: '999' }))));   // no aOS walkthrough over the page; the sky held at day
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404/.test(m.text())) problems.push(m.text()); });   // welcome.js asks ../aOS/api/state, which this static server doesn't have
  page.on('pageerror', e => problems.push(String(e)));
  const listed = [];
  await ctx.route('https://gmail.googleapis.com/**', route => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/profile')) return route.fulfill({ json: { emailAddress: 'tom@example.com' } });
    if (u.pathname.endsWith('/messages')) { listed.push(u.searchParams.get('q')); return route.fulfill({ json: { messages: EMAILS.map(m => ({ id: m.id, threadId: m.threadId })) } }); }
    const id = u.pathname.split('/').pop(), m = EMAILS.find(x => x.id === id);
    return m ? route.fulfill({ json: gmailMessage(m) }) : route.fulfill({ status: 404, json: { error: { message: 'not found' } } });
  });
  const lookups = [], drives = [];
  await ctx.route(BASE + '/travel/api/**', route => {
    const u = new URL(route.request().url());
    if (route.request().headers()['x-travel'] !== '1') return route.fulfill({ status: 404, json: { error: 'not-found' } });
    if (u.pathname.endsWith('/ping')) return route.fulfill({ json: { ok: true, status: true } });
    if (u.pathname.endsWith('/drive')) { drives.push(Object.fromEntries(u.searchParams)); return route.fulfill({ json: { ok: true, min: 25, km: 21.4 } }); }
    lookups.push(u.searchParams.get('no') + '@' + u.searchParams.get('date'));
    return route.fulfill({ json: { ok: true, found: true, legs: [{ number: 'UA 1234', status: 'Delayed', cargo: false, aircraft: 'Boeing 737-900',
      departure: { iata: 'DEN', scheduled: { utc: utc(soon), local: loc(soon) }, revised: { utc: utc(late), local: loc(late) }, terminal: 'West', gate: 'B32' },
      arrival: { iata: 'BOS', scheduled: { utc: utc(arrive), local: loc(arrive) }, terminal: 'B', gate: 'B9', belt: '4' } }] } });
  });
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('travel.token', JSON.stringify({ t: 'fake-token', exp: Date.now() + 3600e3, scope: 'https://www.googleapis.com/auth/gmail.readonly' }));
    localStorage.setItem('travel.token.ever', '1');
  });
  await page.goto(BASE + '/travel/');

  await step(scheme + ': reads Gmail and finds the bookings', async () => {
    await page.waitForFunction(() => window.__travel && window.__travel.bookings.length >= 7, null, { timeout: 8000 });
    const b = await page.evaluate(() => window.__travel.bookings.map(x => ({ type: x.type, id: x.id, guess: x.guess, flightNo: x.flightNo, name: x.name, company: x.company })));
    assert.equal(b.filter(x => x.type === 'flight').length, 3, JSON.stringify(b));
    assert.equal(b.filter(x => x.type === 'hotel').length, 1);
    assert.equal(b.filter(x => x.type === 'car').length, 1);
    assert.ok(listed[0].includes('newer_than:1y'), 'first read covers a year: ' + listed[0]);
    assert.ok(listed[0].includes('from:flybreeze.com') && listed[0].includes('from:marriott.com') && listed[0].includes('from:nationalcar.com'));
    assert.ok(listed[0].includes('{label:Travel '), 'reads what Mail tags Travel: ' + listed[0]);
    assert.equal(b.filter(x => x.type === 'other').length, 2, 'the two rides');
  });
  await step(scheme + ': groups them into two trips and shows the next flight', async () => {
    const trips = await page.evaluate(() => window.__travel.groupTrips().map(g => ({ name: g.name, n: g.items.length })));
    assert.equal(trips.length, 2, JSON.stringify(trips));
    assert.equal(trips[0].name, 'Boston'); assert.equal(trips[0].n, 5);     // 2 flights, the stay, the car, the ride from the airport
    await page.waitForSelector('.hero');
    const hero = await page.textContent('.hero');
    assert.match(hero, /DEN/); assert.match(hero, /BOS/); assert.match(hero, /UA 1234/);
  });
  await step(scheme + ': asks for live status for the flight leaving today only', async () => {
    await page.waitForFunction(() => document.querySelector('.hero .st'), null, { timeout: 5000 });
    assert.deepEqual([...new Set(lookups)], ['UA1234@' + iso(soon)]);
    assert.match(await page.textContent('.hero .st'), /Delayed 35 min/);
    assert.match(await page.textContent('.hero'), /Gate B32/);
  });
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'trips-' + scheme + '.png') });

  await step(scheme + ': switches: a glass thumb slides under the chosen section and filter', async () => {
    // true once the thumb in `box` sits exactly over its chosen option
    const under = ([box, chosen]) => { const b = document.querySelector(box), t = b && b.querySelector(':scope > .slthumb'), c = b && b.querySelector(chosen); if (!t || !c) return false; const q = c.getBoundingClientRect(), r = t.getBoundingClientRect(); return Math.abs(r.left - q.left) < 1 && Math.abs(r.width - q.width) < 1 && Math.abs(r.top - q.top) < 1; };
    const tabs = ['.tabs', '.tab[aria-selected="true"]'], when = ['#whenChips', '[aria-pressed="true"]'];
    // Counts the slides started (a thumb animating its move), so "it slid"
    // doesn't depend on catching it mid-way on a slow machine.
    await page.evaluate(() => { const a = Element.prototype.animate; window.__slides = 0; Element.prototype.animate = function (k, o) { if (this.classList.contains('slthumb') && k[0] && k[0].transform) window.__slides++; return a.call(this, k, o); }; });
    const slides = () => page.evaluate(() => window.__slides);
    await page.waitForFunction(under, tabs, { timeout: 3000 });
    await page.waitForFunction(under, when, { timeout: 3000 });
    for (const [sel, sw] of [['[data-tab="explore"]', tabs], ['[data-tab="trips"]', tabs], ['[data-when="past"]', when], ['[data-when="upcoming"]', when]]) {
      const n = await slides();
      await page.click(sel);
      assert.ok(await slides() > n, 'the thumb slid to ' + sel);
      await page.waitForFunction(under, sw, { timeout: 3000 });
    }
  });

  await step(scheme + ': drawn in the Retro look: Futura, flat cream or walnut, mustard, orange, atomic shapes', async () => {
    const q = (sel, props) => page.$eval(sel, (e, props) => { const c = getComputedStyle(e); return props.map(p => c[p]); }, props);
    const cream = scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', ground = scheme === 'light' ? 'rgb(241, 223, 187)' : 'rgb(74, 57, 30)';
    assert.match((await q('body', ['fontFamily']))[0], /Futura/);
    assert.equal((await q('body', ['backgroundColor']))[0], ground);
    const [bg, shadow, backdrop, radius] = await q('.trip', ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
    assert.equal(bg, cream); assert.equal(shadow, 'none'); assert.ok(backdrop === 'none' || backdrop === '', backdrop); assert.equal(radius, '20px');
    assert.equal((await q('.ambient i:nth-child(1)', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard sun');
    assert.equal((await q('.ambient i:nth-child(3)', ['backgroundColor']))[0], 'rgb(216, 87, 42)', 'a burnt-orange pill');
    assert.equal((await q('#fab', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(201, 80, 42)' : 'rgb(216, 87, 42)', 'the add button is solid orange');
    assert.equal((await q('#whenChips .slthumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard thumb under the filter');
    assert.equal((await q('.tabs .slthumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard thumb under the sections');
    assert.equal((await q('.title', ['fontSize']))[0], '44px');
    const hero = await q('.hero', ['backgroundColor', 'borderRadius']);
    assert.equal(hero[1], '20px'); assert.notEqual(hero[0], cream, 'the next-up card is tinted by the kind of booking');
    assert.equal((await q('.hero .line', ['borderTopStyle']))[0], 'dashed', 'a dashed flight path');
    assert.equal(await page.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content'), scheme === 'light' ? '#F1DFBB' : '#4A391E', 'the theme colour is the sky\'s ground (home/sky.js)');
    assert.equal(await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'default', 'the status bar is not translucent on the cream');
    assert.ok(await page.evaluate(() => document.documentElement.dataset.look === 'vintage' && document.getElementById('vintage').media === 'all'), 'Vintage by default');
  });

  await step(scheme + ': a trip page is a day-by-day timeline with search links', async () => {
    await page.click('.trip');
    await page.waitForSelector('#tripPage:not([hidden]) .ev');
    const days = await page.$$eval('#tpBody .dayblock', els => els.length);
    assert.ok(days >= 2, 'days: ' + days);   // 2 or 3, depending on the time of day the test runs
    const rows = await page.$$eval('#tpBody .ev .t', els => els.map(e => e.textContent));
    assert.ok(rows.some(t => /Check in · Courtyard Boston Downtown/.test(t)), rows.join(' | '));
    assert.ok(rows.some(t => /Return · National/.test(t)), rows.join(' | '));
    assert.ok(rows.includes('Uber ride · $31.20'), 'the ride is on the trip: ' + rows.join(' | '));
    const ride = await page.$eval('#tpBody .ev.other', e => e.querySelector('.s').textContent + ' ' + e.querySelector('.ic').innerHTML);
    assert.match(ride, /^Boston airport → 275 Tremont St /); assert.match(ride, /M4 15\.8v-3\.2/, 'with the car icon');
    const links = await page.$$eval('#tpBody a.rowbtn', els => els.map(a => a.href));
    assert.ok(links.some(h => h.startsWith('https://www.google.com/travel/flights?q=')));
    assert.ok(links.some(h => h.startsWith('https://www.marriott.com/search/findHotels.mi?') && h.includes('Boston')));
  });
  await step(scheme + ': on the day you fly in, check-in comes after the flight, the car and the drive', async () => {
    const run = () => page.evaluate(() => {
      const fl = { id: 'xf', type: 'flight', dep: '2026-11-05T12:00', arr: '2026-11-05T17:10', from: 'RDU', to: 'LAX' };
      const car = { id: 'xc', type: 'car', pickup: '2026-11-05T17:30', pickupPlace: 'LAX Airport, 9020 Aviation Blvd' };
      const h = { id: 'xh', type: 'hotel', checkIn: '2026-11-05', checkInTime: '15:00', checkOut: '2026-11-07', address: '900 W Olympic Blvd, Los Angeles' };
      const a = window.__travel.arrival;
      return { car: a(h, [fl, car, h]), noCar: a(h, [fl, h]), late: a({ ...h, checkInTime: '20:00' }, [fl, car, h]), otherDay: a({ ...h, checkIn: '2026-11-06' }, [fl, car, h]) };
    });
    let r = await run();
    assert.deepEqual([r.car.at, r.car.min, r.car.from], ['2026-11-05T18:25', 45, 'car'], 'landed + 30 min for bags, then the guess for the drive: ' + JSON.stringify(r.car));
    assert.equal(r.late.at, '2026-11-05T20:00', 'never before the hotel\'s own check-in time');
    assert.equal(r.otherDay, null, 'no flight in that day: the hotel\'s time');
    await page.waitForFunction(() => window.__travel.arrival({ type: 'hotel', checkIn: '2026-11-05', address: '900 W Olympic Blvd, Los Angeles' },
      [{ type: 'flight', arr: '2026-11-05T17:10', to: 'LAX' }, { type: 'car', pickup: '2026-11-05T17:30', pickupPlace: 'LAX Airport, 9020 Aviation Blvd' }]).min === 25, null, { timeout: 5000 });
    r = await run();
    assert.deepEqual([r.car.at, r.car.routed], ['2026-11-05T18:05', true], 'then the drive from travel/api/drive');
    const asked = drives.find(d => /9020 Aviation/.test(d.from));
    assert.ok(asked && asked.to === '900 W Olympic Blvd, Los Angeles' && !asked.airport, 'from the car hire desk to the hotel: ' + JSON.stringify(drives));
    assert.ok(drives.some(d => d.airport === 'LAX' && /^LAX airport/.test(d.from)), 'with no car, from the airport: ' + JSON.stringify(drives));
    // The trip page: when the flight in lands on the check-in day, the check-in row comes after it
    const rows = await page.$$eval('#tpBody .dayblock', els => els.map(d => [...d.querySelectorAll('.ev .t')].map(e => e.textContent)));
    const dayOf = rows.find(l => l.some(t => /^UA 1234/.test(t)) && l.some(t => /^Check in/.test(t)));
    if (dayOf) assert.ok(dayOf.findIndex(t => /^Check in/.test(t)) > dayOf.findIndex(t => /^UA 1234/.test(t)), dayOf.join(' | '));
  });
  await step(scheme + ': the trip page: round teal, orange and olive kinds on a cream ground', async () => {
    const q = (sel, props) => page.$eval(sel, (e, props) => { const c = getComputedStyle(e); return props.map(p => c[p]); }, props);
    const light = scheme === 'light';
    assert.equal((await q('#tripPage .sheet.page', ['backgroundColor']))[0], light ? 'rgb(241, 223, 187)' : 'rgb(74, 57, 30)');
    assert.equal((await q('#tpBody .tl', ['backgroundColor']))[0], light ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)');
    const [flight, hotel, car] = await Promise.all(['flight', 'hotel', 'car'].map(k => q('#tpBody .ev.' + k + ' .ic', ['backgroundColor', 'borderRadius'])));
    assert.equal(flight[0], light ? 'rgb(31, 111, 107)' : 'rgb(79, 179, 171)', 'a flight is teal'); assert.equal(flight[1], '50%');
    assert.equal(hotel[0], light ? 'rgb(216, 87, 42)' : 'rgb(232, 104, 74)', 'a hotel is burnt orange');
    assert.equal(car[0], light ? 'rgb(126, 140, 52)' : 'rgb(163, 176, 74)', 'a rental car is olive');
    assert.equal((await q('#tpDone', ['backgroundColor']))[0], light ? 'rgb(201, 80, 42)' : 'rgb(216, 87, 42)', 'Done is solid orange');
  });
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'trip-' + scheme + '.png') });

  await step(scheme + ': a flight shows live gates and times; a text-read one asks to be checked', async () => {
    await page.click('#tpBody .ev.flight');
    await page.waitForSelector('#bkSheet:not([hidden]) #bkLive .grid2');
    const t = await page.textContent('#bkLive');
    assert.match(t, /Gate B32/); assert.match(t, /Bags: belt 4/);
    assert.ok(await page.$('#bkBody .verify'), 'guess banner');
    assert.ok(await page.$('#bkBody a[href^="../mail/?thread="]'), 'a link to the email in Mail');
    assert.equal(await page.inputValue('#bf_conf'), 'KQ7T2M');
  });
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'booking-' + scheme + '.png') });

  await step(scheme + ': "Looks right" and edits stick', async () => {
    await page.click('#bkOk');
    await page.fill('#bf_seat', '23C');
    await page.click('#bkDone');
    const b = await page.evaluate(() => window.__travel.bookings.find(x => x.flightNo === '1234'));
    assert.equal(b.guess, false); assert.equal(b.seat, '23C'); assert.equal(b.edited, true);
  });
  await step(scheme + ': the calendar file is well formed', async () => {
    const txt = await page.evaluate(() => window.__travel.ics(window.__travel.bookings));
    assert.match(txt, /^BEGIN:VCALENDAR\r\n/); assert.match(txt, /END:VCALENDAR\r\n$/);
    assert.equal((txt.match(/BEGIN:VEVENT/g) || []).length, 8);       // 3 flights, 1 stay, car pick-up and return, 2 rides
    assert.match(txt, /DTSTART;VALUE=DATE:\d{8}/);
    // the zones: both known gives the exact end; only the start's known gives the usual two hours, not the wall-clock
    // difference across two zones (DEN 07:05 → BOS 12:45 is 3h40, which that would call 5h40); neither gives floating times
    const fl = ([dep, depIso, arr, arrIso]) => window.__travel.ics([{ id: 'tz', type: 'flight', status: 'confirmed', airlineCode: 'F9', flightNo: '1', from: 'DEN', to: 'BOS', dep, depIso, arr, arrIso }]);
    const both = await page.evaluate(fl, ['2027-03-04T07:05', '2027-03-04T07:05:00-07:00', '2027-03-04T12:45', '2027-03-04T12:45:00-05:00']);
    assert.match(both, /DTSTART:20270304T140500Z/); assert.match(both, /DTEND:20270304T174500Z/);
    const one = await page.evaluate(fl, ['2027-03-04T07:05', '2027-03-04T07:05:00-07:00', '2027-03-04T12:45', '']);
    assert.match(one, /DTSTART:20270304T140500Z/); assert.match(one, /DTEND:20270304T160500Z/);
    const none = await page.evaluate(fl, ['2027-03-04T07:05', '', '2027-03-04T12:45', '']);
    assert.match(none, /DTSTART:20270304T070500/); assert.match(none, /DTEND:20270304T124500/);
  });
  await step(scheme + ': a flight read from text, no zone: the live leg\'s UTC is the moment counted down to, in the layer too', async () => {
    await page.click('#tpDone');   // a booking added ahead of the trip's first one renames the trip, so the trip page would close: close it first, open it again after
    const r = await page.evaluate(() => {
      const t = window.__travel, pad = n => String(n).padStart(2, '0');
      const d = new Date(Date.now() + 2 * 3600e3), ymd = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      const b = { id: 'tz-live', type: 'flight', status: 'confirmed', airlineCode: 'F9', flightNo: '77', from: 'DEN', to: 'BOS', dep: ymd + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()), arr: ymd + 'T' + pad((d.getHours() + 3) % 24) + ':' + pad(d.getMinutes()) };
      const wall = t.startT(b), wallEnd = t.endT(b);                                 // read as this phone's clock: in 2 h
      const real = wall - 90 * 6e4, realEnd = real + 3 * 3600e3 + 40 * 6e4;       // Denver is behind this phone: it really leaves in 30 min
      const u = ms => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + 'Z';   // the status server's "2027-03-04 14:05Z"
      t.bookings.push(b);
      const before = document.querySelector('.hero .k') && document.querySelector('.hero .k').textContent;
      t.keepLive(b, { ok: true, found: true, legs: [{ number: 'F9 77', status: 'Scheduled', cargo: false, departure: { iata: 'DEN', scheduled: { utc: u(real) } }, arrival: { iata: 'BOS', scheduled: { utc: u(realEnd) } } }] });
      t.render();
      const hero = document.querySelector('.hero').textContent;
      const lay = t.calLayer().bookings.find(x => x.id === 'tz-live');
      const out = { wall, wallEnd, real, realEnd, after: t.startT(b), afterEnd: t.endT(b), lay, hero, before, bare: t.startT({ ...b, id: 'no-leg' }), own: t.startT({ ...b, id: 'no-leg', depIso: new Date(wall + 3600e3).toISOString() }) };
      t.bookings.pop(); delete t.live['tz-live']; t.render();
      return out;
    });
    assert.equal(r.after, r.real, 'startT is the live instant'); assert.equal(r.afterEnd, r.realEnd, 'endT too');
    assert.match(r.hero, /F9 77/); assert.match(r.hero, /Next · in (29|30) min/, 'the countdown: ' + r.hero);
    assert.equal(r.lay.depIso, new Date(r.real).toISOString(), 'the layer carries the instant'); assert.equal(r.lay.arrIso, new Date(r.realEnd).toISOString());
    assert.equal(r.bare, r.wall, 'no live leg: the wall clock stays as this phone\'s');
    assert.equal(r.own, r.wall + 3600e3, 'a zone the email gave comes first');
    assert.match(await page.textContent('.hero'), /UA 1234/, 'the hero is back to the real next flight');
    await page.click('.trip[data-trip]');
    await page.waitForSelector('#tripPage:not([hidden]) #tpDone');
  });
  await step(scheme + ': a deleted booking stays deleted when Gmail is read again', async () => {
    await page.click('#tpDone');
    await page.click('[data-when="upcoming"]');
    const id = await page.evaluate(() => window.__travel.bookings.find(x => x.type === 'car').id);
    await page.evaluate(i => { const t = window.__travel; const all = t.bookings; all.splice(all.findIndex(x => x.id === i), 1); t.save(); }, id);
    await page.evaluate(() => { localStorage.removeItem('allison-travel-v1-seen'); localStorage.removeItem('allison-travel-v1-scan'); });
    await page.reload();
    await page.waitForFunction(() => window.__travel && !document.getElementById('syncPill').hidden, null, { timeout: 5000 }).catch(() => {});
    await page.waitForFunction(() => document.getElementById('syncPill').hidden, null, { timeout: 8000 });
    const cars = await page.evaluate(() => window.__travel.bookings.filter(x => x.type === 'car').length);
    assert.equal(cars, 0);
  });
  await step(scheme + ': a flight moved to another day keeps only the newest day', async () => {
    const r = await page.evaluate(() => {
      const t = window.__travel, src = (d, id) => ({ msgId: id, threadId: id, subject: 's', from: 'f', date: d });
      const mk = (dep, d, id) => ({ type: 'flight', status: 'confirmed', conf: 'MOVED1', airlineCode: 'F9', airline: 'Frontier', flightNo: '3073', from: 'RDU', to: 'CLE', dep, arr: '', guess: true, source: src(d, id), id: 'f-test-' + dep.slice(0, 10) });
      t.upsert(mk('2027-03-06T15:32', 1000, 'old'));
      t.upsert(mk('2027-03-07T15:32', 2000, 'new'));
      t.upsert(mk('2027-03-06T15:32', 1000, 'old'));          // the old email read again later
      const got = t.bookings.filter(b => b.conf === 'MOVED1').map(b => b.dep);
      // tidied away: its emails were never read on this phone, so "Read the last year again" (next) leaves it alone
      for (let i = t.bookings.length - 1; i >= 0; i--) if (t.bookings[i].conf === 'MOVED1') t.bookings.splice(i, 1);
      t.save();
      return got;
    });
    assert.deepEqual(r, ['2027-03-07T15:32']);
  });
  await step(scheme + ': "Read the last year again" replaces old mistakes and keeps your edits', async () => {
    await page.evaluate(() => {
      const t = window.__travel;
      t.bookings.push({ id: 'f-wrong', type: 'flight', status: 'confirmed', conf: 'KQ7T2M', airlineCode: 'UA', flightNo: '555', from: 'BOS', to: 'DEN', dep: '2030-01-01T10:00', guess: true,
        source: { msgId: 'm1', threadId: 't1', subject: 'x', from: 'x', date: 1 } });
      t.save(); t.render();
    });
    await page.click('#setBtn');
    await page.click('#stRescan');
    await page.waitForFunction(() => !document.getElementById('syncPill').hidden, null, { timeout: 5000 }).catch(() => {});
    await page.waitForFunction(() => document.getElementById('syncPill').hidden, null, { timeout: 8000 });
    const b = await page.evaluate(() => window.__travel.bookings.map(x => ({ id: x.id, flightNo: x.flightNo, seat: x.seat, dep: x.dep })));
    assert.ok(!b.some(x => x.id === 'f-wrong'), 'old mistake gone');
    assert.equal(b.filter(x => x.flightNo === '1234').length, 1, 'no duplicates');
    assert.equal(b.find(x => x.flightNo === '1234').seat, '23C', 'your edit kept');
    assert.equal(b.filter(x => x.flightNo === '987').length, 1);
  });
  await step(scheme + ': a ride at home makes no trip, and a widened search reads back a year once', async () => {
    const trips = await page.evaluate(() => window.__travel.groupTrips().map(g => g.items.map(b => b.title || b.type).join()));
    assert.ok(!trips.some(t => /Lyft/.test(t)), trips.join(' | '));
    assert.equal(trips.length, 2, trips.join(' | '));
    listed.length = 0;
    await page.evaluate(() => { localStorage.setItem('allison-travel-v1-scan', String(Date.now())); localStorage.removeItem('allison-travel-v1-query-v'); });
    await page.reload();
    await page.waitForFunction(() => window.__travel, null, { timeout: 5000 });
    for (let i = 0; i < 40 && !listed.length; i++) await page.waitForTimeout(100);   // the scan on open starts after a moment
    assert.ok(listed.length && listed[0].startsWith('newer_than:1y'), 'no query version -> a year: ' + listed[0]);
    await page.waitForFunction(() => document.getElementById('syncPill').hidden, null, { timeout: 8000 });
    await page.waitForTimeout(300);
    listed.length = 0;
    await page.evaluate(() => window.__travel.scan());
    assert.ok(listed.length && listed[0].startsWith('after:'), 'after that, only what is new: ' + listed[0]);
  });
  await step(scheme + ': Explore builds the search links', async () => {
    await page.click('[data-tab="explore"]');
    await page.fill('#exFrom', 'DEN'); await page.fill('#exTo', 'BOS'); await page.fill('#exOut', '2026-12-01'); await page.fill('#exBack', '2026-12-05');
    const hrefs = await page.$$eval('#exLinks a', a => a.map(x => x.href));
    assert.ok(hrefs[0].includes(encodeURIComponent('Flights from DEN to BOS on 2026-12-01 through 2026-12-05')), hrefs[0]);
    assert.ok(hrefs.some(h => h.includes('fromDate=12%2F01%2F2026') && h.includes('toDate=12%2F05%2F2026')), hrefs.join('\n'));
    assert.ok(hrefs.some(h => h === 'https://www.kayak.com/cars/BOS/2026-12-01/2026-12-05'), hrefs.join('\n'));
  });
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'explore-' + scheme + '.png') });
  await step(scheme + ': settings open and show Gmail and live status', async () => {
    await page.click('[data-tab="trips"]');
    await page.click('#setBtn');
    await page.waitForFunction(() => /Working/.test(document.getElementById('stLive').textContent));
    assert.match(await page.textContent('#stGmail'), /Check now/);
  });
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'settings-' + scheme + '.png') });
  await step(scheme + ': no script errors and nothing blocked by the page policy', async () => {
    assert.deepEqual(problems.filter(p => !/favicon/.test(p)), []);
  });
  await ctx.close();
}

// The family's Google Sheet: the real Apps Script, on an in-memory Sheet, reached through aOS
// (functions/sheet/api, stood in for here): each phone's session says who's asking.
const SHEET_URL = 'https://script.google.com/macros/s/TEST/exec', SECRET = 'test-secret-phrase';
const sheet = fakeSheet(path.join(ROOT, 'travel', 'google-sheet-sync.gs'), SECRET);
const sheetCalls = [], claims = [];
let sheetFail = '';   // when set, aOS (or the Sheet) answers every sync with this error
const refused = [];
const PEOPLE = { 'tok-tom': { id: 'tom', name: 'Tom', role: 'owner' }, 'tok-ella': { id: 'ella', name: 'Ella', role: 'member' } };
const session = tok => JSON.stringify({ token: tok, user: PEOPLE[tok], at: 1 });
const stay = (id, name, a, b, extra) => ({ type: 'hotel', status: 'confirmed', conf: id.toUpperCase(), name, city: name.split(' ')[0], checkIn: iso(day(a)), checkOut: iso(day(b)), guess: false, edited: true, id, created: 1, updated: 1, notes: '', ...extra });
const hop = (id, a, extra) => ({ type: 'flight', status: 'confirmed', airlineCode: 'UA', flightNo: '88', airline: 'United', from: 'DEN', to: 'SAN', fromName: 'Denver', toName: 'San Diego', dep: iso(day(a)) + 'T08:00', arr: iso(day(a)) + 'T10:00', conf: 'SD88', guess: false, edited: true, id, created: 1, updated: 1, notes: '', ...extra });
// A family phone: signed in as tok (or signed out), nothing but the Sheet (and Travel's own route) reachable.
async function famPhone(tok, bookings = [], extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route(/^https?:\/\/(?!localhost)/, route => route.abort());   // no phone talks to Google's Sheet itself any more
  await ctx.route(BASE + '/**/api/**', route => {
    const req = route.request(), u = new URL(req.url());
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname.startsWith('/travel/api/')) return u.pathname.endsWith('/ping') ? json({ ok: true, status: true }) : json({ ok: true, found: false });
    if (!u.pathname.startsWith('/sheet/api/travel')) return json({ error: 'not-found' }, 404);
    const who = PEOPLE[(req.headers().authorization || '').replace('Bearer ', '')];
    if (req.headers()['x-sheet'] !== '1') return json({ error: 'header' }, 400);
    if (!who) return json({ error: 'signin' }, 401);
    if (u.pathname.endsWith('/claim')) { claims.push({ who: who.id, ...JSON.parse(req.postData()) }); return json({ configured: true }); }
    if (req.method() === 'GET') return json({ configured: true });
    if (sheetFail) { refused.push(sheetFail); return sheetFail === 'no-sheet' ? json({ ok: false, error: 'no-sheet' }, 409) : json({ ok: false, error: sheetFail }); }
    sheetCalls.push({ who: who.id, ...JSON.parse(req.postData()) });
    return json(sheet.post(req.postData(), { key: SECRET, who: who.id, name: who.name, ...(who.role === 'owner' ? { owner: '1' } : {}) }));
  });
  await ctx.addInitScript(([seed]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, [{ 'aos.seen': JSON.stringify({ travel: '999' }), 'aos.sky': 'day', 'allison-travel-v1': JSON.stringify({ bookings, trips: [] }), ...(tok ? { 'aos.session': session(tok) } : {}), ...extra }]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404|net::ERR/.test(m.text())) errs.push(m.text()); });
  await page.goto(BASE + '/travel/');
  await page.waitForFunction(() => window.__travel, null, { timeout: 5000 });
  return { ctx, page, errs };
}
const synced = page => page.waitForFunction(() => /Synced/.test(document.getElementById('tripsSub').textContent), null, { timeout: 8000 });
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('allison-travel-v1')));
// the sync after a change waits 2 s: wait for what the Sheet was sent
const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out waiting for the Sheet'); await new Promise(r => setTimeout(r, 100)); } };
// the Sheet is set up in aOS, not in Travel: Settings have no Sync row, and there's no Sheet sheet
const noSheetUI = page => page.evaluate(() => ['stSheet', 'stSheetSub', 'syncSheet', 'syStatus', 'syNow', 'syLbl'].every(id => !document.getElementById(id))
  && ![...document.querySelectorAll('#setSheet .label')].some(l => /^(Sync|The family’s Google Sheet)$/.test(l.textContent.trim())));
const sentLast = id => { const c = sheetCalls.filter(c => c.action === 'sync').at(-1); return c && (c.bookings || []).find(b => b.id === id); };

await step('the family\'s Google Sheet: signed out, Travel works on the phone, sends nothing and says nothing; no Sheet UI, link or phrase', async () => {
  const { ctx, page, errs } = await famPhone(null, [stay('h-solo', 'Austin Motel', 20, 22)]);
  await page.waitForSelector('.trip');
  await page.waitForTimeout(1200);   // past the first sync (600 ms after start)
  assert.ok(await page.isHidden('#toast'), 'no toast signed out');
  assert.equal(await page.evaluate(() => window.__travel.sync()), false, 'a sync signed out does nothing');
  await page.click('#setBtn');
  assert.ok(await noSheetUI(page), 'Settings have no Sheet row, and there\'s no Sheet sheet (aOS → Account → Google Sheets has it)');
  assert.equal(await page.$('#syUrl'), null, 'no link or phrase to type on a phone');
  assert.equal(await page.$('#syShare'), null, 'no setup link');
  assert.equal(await page.$('#syOff'), null, 'no Disconnect');
  assert.equal(sheetCalls.length, 0, 'nothing is sent signed out');
  assert.deepEqual(errs, []);
  await ctx.close();
});

await step('signed out, live status on open, the ping, the calendar pass and the flight board ask nobody to sign in (the 401 is kept quiet); Check again on a flight does', async () => {
  const dep = new Date(soon), arr = new Date(soon.getTime() + 2 * 3600e3), hm = d => iso(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  const { ctx, page, errs } = await famPhone(null, [hop('f-quiet', 0, { dep: hm(dep), arr: hm(arr) })]);   // a flight in 5 hours: in the live window
  const calls = [];
  // Travel's and Calendar's routes, locked (functions/<app>/api/_middleware.js): a 401 with no session. A page route comes before the phone's
  await page.route(u => u.origin === BASE && /^\/(travel|calendar)\/api\//.test(u.pathname), route => {
    const req = route.request(), who = PEOPLE[(req.headers().authorization || '').replace('Bearer ', '')];
    calls.push(new URL(req.url()).pathname + (who ? ' as ' + who.id : ' signed out'));
    if (!who) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'signin' }) });
    return route.fulfill({ json: req.url().includes('/ping') ? { ok: true, status: true, ai: true, find: true } : { ok: true, found: false } });
  });
  await page.evaluate(() => { localStorage.removeItem('allison-travel-v1-live'); localStorage.removeItem('allison-travel-v1-smart-at'); });   // the first open (the phone's own route answered) is forgotten: this open asks again
  await page.reload(); await page.waitForFunction(() => window.__travel);
  await page.waitForTimeout(4000);   // past the ping (1.5 s) and the smart pass (2.5 s: the calendar, then the flight board)
  assert.ok(calls.some(c => c.startsWith('/travel/api/flight')), 'live status was asked for on open: ' + JSON.stringify(calls));
  assert.ok(calls.some(c => c.startsWith('/travel/api/ping')), 'the ping was asked: ' + JSON.stringify(calls));
  assert.ok(calls.some(c => c.startsWith('/calendar/api/events')), 'the calendar pass asked: ' + JSON.stringify(calls));
  assert.ok(calls.every(c => c.endsWith(' signed out')), 'nothing went with a session');
  assert.equal(await page.$('#aos-signin'), null, 'no sign-in sheet for any of them');
  assert.ok(await page.isHidden('#toast'), 'and no toast');
  // the app keeps what it has: the trip is there, and a flight's live status is simply not checked yet
  await page.click('.trip[data-trip]'); await page.waitForSelector('#tripPage:not([hidden])');
  await page.click('#tpBody .ev.flight'); await page.waitForSelector('#bkSheet:not([hidden]) #bkLive');
  await page.waitForTimeout(800);
  assert.equal(await page.$('#aos-signin'), null, 'opening the flight asks nobody either');
  assert.match(await page.textContent('#bkLive'), /Not checked yet/, 'live status stays unknown, not "not set up"');
  // a tap: Check again asks for Face ID
  await page.click('#bkLiveGo');
  await page.waitForSelector('#aos-signin', { timeout: 5000 });
  assert.match(await page.textContent('#aos-signin'), /Continue with Face ID/, 'a tap raises the sign-in sheet');
  await page.click('#aos-signin .s-not'); await page.waitForTimeout(1500);
  assert.equal(await page.$('#aos-signin'), null, 'Not now closes it');
  assert.deepEqual(errs, []);
  await ctx.close();
});

await step('signed in, a Sheet not set up in aOS yet says nothing; a real error shows one toast a session', async () => {
  sheetFail = 'no-sheet';
  const { ctx, page, errs } = await famPhone('tok-ella', [stay('h-solo', 'Austin Motel', 20, 22)]);
  await until(() => refused.includes('no-sheet'));
  await page.evaluate(() => window.__travel.sync());
  assert.ok(await page.isHidden('#toast'), 'no toast: the owner sets the Sheet up in aOS');
  sheetFail = 'busy';
  await page.evaluate(() => window.__travel.sync());
  await page.waitForSelector('#toast:not([hidden])', { timeout: 5000 });
  assert.match(await page.textContent('#toastMsg'), /The Sheet was busy/);
  await page.evaluate(() => { document.getElementById('toast').hidden = true; });
  const n = refused.length;
  await page.evaluate(() => window.__travel.sync());
  await until(() => refused.length > n); await page.waitForTimeout(300);
  assert.ok(await page.isHidden('#toast'), 'and not again this session');
  assert.equal(sheetCalls.length, 0, 'nothing reached the Sheet');
  assert.deepEqual(errs, []);
  sheetFail = ''; refused.length = 0;
  await ctx.close();
});

let tom, ella;
await step('signed in (Tom, the owner): his bookings go to the family Sheet as his, with the Who column; past ones over 90 days stay there', async () => {
  tom = await famPhone('tok-tom', [stay('h-tom', 'Boston Courtyard', 20, 22), hop('f-tom', 20), stay('h-recent', 'Chicago Inn', -40, -37), stay('h-old', 'Lisbon Palace', -200, -196)]);
  await synced(tom.page);
  const rows = sheet.tab('Bookings');
  assert.deepEqual(rows.slice(1).map(r => r[0] + ':' + r[4]).sort(), ['Tom:Boston Courtyard', 'Tom:Chicago Inn', 'Tom:Lisbon Palace', 'Tom:United UA88 DEN → SAN'], 'every booking, each says whose');
  assert.ok(sheetCalls.every(c => !('secret' in c)), 'the phone sends no phrase');
  assert.equal(sheetCalls.at(-1).window, 90, 'and keeps 90 days');
  assert.deepEqual((await stored(tom.page)).bookings.map(b => b.id).sort(), ['f-tom', 'h-recent', 'h-tom'], 'the trip that ended 200 days ago is in the Sheet, not on the phone');
  assert.ok((await stored(tom.page)).bookings.every(b => b.by === 'tom'), 'marked as his');
  assert.ok(+(await tom.page.evaluate(() => localStorage.getItem('allison-travel-v1-sync-at'))) > 0, 'the phone notes when it last synced');
  await tom.page.click('#setBtn');
  assert.ok(await noSheetUI(tom.page), 'signed in and synced, Settings still have no Sheet row');
  await tom.page.click('#setSheet .sheethead [data-close]');
});

await step('Just me on a booking of yours: only you see it, with a small Just me pill; Private is something else', async () => {
  const { page } = tom;
  await page.click('[data-when="upcoming"]');
  await page.click('.trip[data-trip]');
  await page.waitForSelector('#tripPage:not([hidden])');
  await page.click('#tpBody .ev[data-bk="h-tom"]');
  await page.waitForSelector('#bkSheet:not([hidden])');
  assert.equal(await page.getAttribute('#bkOnly', 'aria-pressed'), 'false');
  assert.equal(await page.textContent('#bkOnlyHint'), 'Just me: only you see it, not the family.');
  assert.match(await page.textContent('#bkBody'), /Private hides this booking and its email from Ipsy\./, 'Private says Ipsy');
  await page.click('#bkOnly');
  assert.equal(await page.getAttribute('#bkOnly', 'aria-pressed'), 'true');
  assert.equal(await page.textContent('#bkOnlyHint'), 'Just me: only you see it, not the family.', 'the same one line, on or off');
  assert.equal(await page.getAttribute('#bkPriv', 'aria-pressed'), 'false', 'and it isn\'t Private');
  await page.click('#bkDone');
  assert.ok(await page.isVisible('#tpBody .ev[data-bk="h-tom"] .st.jm'), 'the Just me pill on its row');
  assert.equal(await page.evaluate(() => window.__travel.bookings.find(b => b.id === 'h-tom').edited), true, 'typed in, as it was');
  await until(() => sentLast('h-tom') && sentLast('h-tom').only === true);   // sent to the Sheet
  assert.ok(sheet.tab('Bookings').some(r => r[4] === 'Boston Courtyard' && r[9] === 'Just me'));
});

await step('Ella\'s phone: the family\'s shared bookings, none of Tom\'s Just me ones, and no Just me switch on his', async () => {
  ella = await famPhone('tok-ella', [stay('h-ella', 'Denver Lodge', 30, 31)]);
  await synced(ella.page);
  const ids = (await stored(ella.page)).bookings.map(b => b.id).sort();
  assert.deepEqual(ids, ['f-tom', 'h-ella', 'h-recent'], 'Tom\'s shared ones and hers; not his Just me hotel: ' + ids.join(' '));
  await ella.page.evaluate(() => { document.querySelector('[data-when="upcoming"]').click(); });
  await ella.page.click('.trip[data-trip="f-tom"]');
  await ella.page.waitForSelector('#tripPage:not([hidden])');
  assert.equal(await ella.page.$('#tpOnly'), null, 'not hers to make Just me');
  assert.match(await ella.page.textContent('#tpBody'), /Tom’s trip, shared with the family\./);
  await ella.page.click('#tpBody .ev[data-bk="f-tom"]');
  await ella.page.waitForSelector('#bkSheet:not([hidden])');
  assert.equal(await ella.page.$('#bkOnly'), null);
  assert.equal(await ella.page.textContent('#bkOnlyHint'), 'Tom’s booking, shared with the family.');
  assert.ok(await ella.page.isVisible('#bkPriv'), 'Private (hidden from Ipsy) she can still use');
  await ella.page.click('#bkDone');
  await ella.page.click('#tpDone');
});

await step('a Just me trip: Tom\'s trip page makes all of it his alone, and Ella\'s phone lets it go at her next sync', async () => {
  const { page } = tom;
  assert.equal(await page.getAttribute('#tpOnly', 'aria-pressed'), 'false', 'one of two is Just me: not the whole trip');
  assert.equal(await page.textContent('#tpOnlyHint'), 'Just me trip: only you see it, not the family.');
  await page.click('#tpOnly');
  assert.equal(await page.getAttribute('#tpOnly', 'aria-pressed'), 'true');
  assert.equal(await page.textContent('#tpOnlyHint'), 'Just me trip: only you see it, not the family.', 'the same one line, on or off');
  await page.click('#tpDone');
  assert.ok(await page.isVisible('.trip[data-trip] .st.jm'), 'the trip card says Just me');
  await until(() => ['f-tom', 'h-tom'].every(id => sentLast(id) && sentLast(id).only));   // both sent as Just me
  await ella.page.evaluate(() => window.__travel.sync(false));
  await ella.page.waitForFunction(() => !window.__travel.bookings.some(b => b.id === 'f-tom'), null, { timeout: 5000 });
  assert.deepEqual((await stored(ella.page)).bookings.map(b => b.id).sort(), ['h-ella', 'h-recent']);
  assert.ok(!(await ella.page.evaluate(() => Object.keys(window.__travel.graves()).some(k => /f-tom/.test(k)))), 'without a deletion: Tom still has it');
  assert.deepEqual(ella.errs, []);
  await ella.ctx.close();
});

await step('Past: trips that ended more than 90 days ago come back from the Sheet when you look', async () => {
  const { page, errs } = tom;
  const before = sheetCalls.length;
  await page.click('[data-when="past"]');
  await page.waitForFunction(() => /Lisbon/.test(document.getElementById('list').textContent), null, { timeout: 5000 });
  assert.ok(sheetCalls.slice(before).some(c => c.action === 'range' && c.from === '2000-01-01'), 'asked for older days');
  assert.equal(await page.$('#olderHint'), null, 'no explanation once they came back');
  assert.ok(/Chicago/.test(await page.textContent('#list')), 'with the recent past trip');
  assert.deepEqual(errs, []);
  await tom.ctx.close();
});

await step('the owner\'s phone hands the Sheet link and phrase it kept over to aOS, then forgets them', async () => {
  const o = await famPhone('tok-tom', [], { 'allison-travel-v1-sync': JSON.stringify({ url: SHEET_URL, secret: SECRET }) });
  await o.page.waitForFunction(() => !localStorage.getItem('allison-travel-v1-sync'), null, { timeout: 8000 });
  assert.deepEqual(claims.at(-1), { who: 'tom', url: SHEET_URL, secret: SECRET });
  // an old setup link opened on a phone is only taken off the address
  await o.page.goto(BASE + '/travel/index.html#sync=eyJ1IjoieCIsInMiOiJ5In0'); await o.page.waitForFunction(() => window.__travel);
  assert.equal(await o.page.evaluate(() => location.hash), '');
  assert.equal(await o.page.$('#syncSheet'), null, 'and no Sheet sheet opens');
  assert.deepEqual(o.errs, []);
  await o.ctx.close();
});

// Without the server function (GitHub Pages): no lookups, a clear message.
await step('without the flight status server, it says so', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => (localStorage.setItem('aos.sky', 'day'), localStorage.setItem('aos.seen', JSON.stringify({ travel: '999' }))));   // no aOS walkthrough over the page; the sky held at day
  const page = await ctx.newPage();
  await page.goto(BASE + '/travel/');
  await page.click('#setBtn');
  await page.waitForFunction(() => /Not available/.test(document.getElementById('stLive').textContent));
  await ctx.close();
});

// ---- the two designs ----
// A phone: Gmail and Travel's route stubbed (the route only at /travel/api/, where Pages Functions are), nothing else
// outside reachable. `design` seeds design.travel; `seed` is localStorage written before the first open (else the
// aOS walkthrough is marked seen); `before` runs on a page at that address that runs no app script (storage there is
// the app's), e.g. to make an IndexedDB database.
const apiCalls = [];
async function phone(scheme = 'light', { design = null, seed = null, at = '/travel/', before = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.route(/^https?:\/\/(?!localhost)/, route => route.abort());
  await ctx.route('https://gmail.googleapis.com/**', route => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/profile')) return route.fulfill({ json: { emailAddress: 'tom@example.com' } });
    if (u.pathname.endsWith('/messages')) return route.fulfill({ json: { messages: EMAILS.slice(0, 3).map(m => ({ id: m.id, threadId: m.threadId })) } });
    const m = EMAILS.find(x => x.id === u.pathname.split('/').pop());
    return m ? route.fulfill({ json: gmailMessage(m) }) : route.fulfill({ status: 404, json: { error: { message: 'not found' } } });
  });
  await ctx.route(BASE + '/**/api/**', route => {
    const u = new URL(route.request().url());
    apiCalls.push(u.pathname);
    if (!u.pathname.startsWith('/travel/api/') || route.request().headers()['x-travel'] !== '1') return route.fulfill({ status: 404, json: { error: 'not-found' } });
    if (u.pathname.endsWith('/ping')) return route.fulfill({ json: { ok: true, status: true } });
    return route.fulfill({ json: { ok: true, found: false } });
  });
  if (before) { const p0 = await ctx.newPage(); await p0.goto(BASE + at + 'manifest.webmanifest'); await p0.evaluate(before); await p0.close(); }
  await ctx.addInitScript(([design, seed]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (seed) for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    else localStorage.setItem('aos.seen', JSON.stringify({ travel: '999' }));
    localStorage.setItem('aos.sky', 'day');
    if (design) localStorage.setItem('design.travel', design);
  }, [design, seed]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404|net::ERR/.test(m.text())) errs.push(m.text()); });
  await page.goto(BASE + at);
  await page.waitForFunction(() => window.__travel, null, { timeout: 5000 });
  await page.waitForTimeout(600);
  return { ctx, page, errs };
}
const css = (page, sel, props) => page.$eval(sel, (e, props) => { const c = getComputedStyle(e); return props.map(p => c[p]); }, props);
const thumbUnder = page => page.evaluate(() => [['.tabs', '.tab[aria-selected="true"]'], ['#whenChips', '[aria-pressed="true"]']].every(([box, chosen]) => {
  const b = document.querySelector(box), t = b && b.querySelector(':scope > .slthumb'), c = b && b.querySelector(chosen); if (!t || !c) return false;
  const q = c.getBoundingClientRect(), r = t.getBoundingClientRect(); return Math.abs(r.left - q.left) < 1 && Math.abs(r.width - q.width) < 1;
}));
const token = JSON.stringify({ t: 'fake-token', exp: Date.now() + 3600e3, scope: 'https://www.googleapis.com/auth/gmail.readonly' });
const mine = (id, name) => ({ type: 'hotel', status: 'confirmed', conf: id.toUpperCase(), name, city: 'Boston', checkIn: iso(day(20)), checkOut: iso(day(22)), guess: false, edited: true, id, created: 1, updated: 1, notes: '' });   // typed in, so a re-read of Gmail leaves it alone

// Standard: Sea glass, the Vintage block switched off, no sky; the icon and status bar follow
for (const scheme of ['light', 'dark']) {
  await step(scheme + ' Standard: Sea glass, no Vintage styles, no sky, the glass icon and a translucent status bar', async () => {
    const { ctx, page, errs } = await phone(scheme, { design: 'glass', seed: { 'aos.seen': JSON.stringify({ travel: '999' }), 'allison-travel-v1': JSON.stringify({ bookings: [mine('h-std', 'Courtyard Boston Downtown')], trips: [] }) } });
    await page.waitForSelector('.trip');
    assert.ok(await page.evaluate(() => document.documentElement.dataset.look === 'glass' && document.getElementById('vintage').media === 'not all' && !document.documentElement.hasAttribute('data-sky')), 'data-look glass, #vintage off, no data-sky');
    assert.equal((await css(page, 'body', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(238, 242, 240)' : 'rgb(13, 18, 19)', 'the Sea glass ground');
    assert.doesNotMatch((await css(page, 'body', ['fontFamily']))[0], /Futura/);
    assert.notEqual((await css(page, '.trip', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', 'no cream card');
    assert.notEqual((await css(page, '.tabs .slthumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'no mustard thumb');
    assert.match(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'), /icon-glass-180\.png/);
    assert.equal(await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'black-translucent');
    assert.equal(await page.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content'), scheme === 'light' ? '#EEF2F0' : '#0D1213');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'glass-trips-' + scheme + '.png') });
    assert.deepEqual(errs, []);
    await ctx.close();
  });
}

// Settings > Design: the first section; Vintage, then Standard and back, at once, kept across a reload
await step('Settings > Design switches both ways at once and is kept', async () => {
  const { ctx, page, errs } = await phone('light');
  const look = () => page.evaluate(() => document.documentElement.dataset.look);
  assert.equal(await look(), 'vintage', 'Vintage by default');
  assert.match(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'), /^icon-180\.png/, 'with the Vintage icon');
  await page.click('#setBtn'); await page.waitForTimeout(400);
  assert.equal(await page.$eval('#stBody .st-sec:first-child .st-lbl', b => b.textContent), 'Design', 'Design is the first section');
  assert.ok(await page.isVisible('#stDesign [data-design="glass"]'));
  assert.equal(await page.getAttribute('#stDesign [data-design="vintage"]', 'aria-checked'), 'true');
  await page.click('#stDesign [data-design="glass"]'); await page.waitForTimeout(250);
  assert.equal(await look(), 'glass', 'Standard at once');
  assert.equal(await page.getAttribute('#stDesign [data-design="glass"]', 'aria-checked'), 'true');
  assert.ok(await page.isVisible('#setSheet'), 'Settings stays open');
  await page.click('#setSheet [data-close].okbtn'); await page.waitForTimeout(400);
  assert.ok(await thumbUnder(page), 'the thumbs are measured again for the system font');
  await page.reload(); await page.waitForFunction(() => window.__travel);
  assert.equal(await look(), 'glass', 'Standard is kept');
  assert.equal(await page.evaluate(() => localStorage.getItem('design.travel')), 'glass');
  await page.click('#setBtn'); await page.waitForTimeout(400);
  await page.click('#stDesign [data-design="vintage"]'); await page.waitForTimeout(250);
  assert.equal(await look(), 'vintage', 'Vintage at once');
  await page.click('#setSheet [data-close].okbtn'); await page.waitForTimeout(400);
  assert.ok(await thumbUnder(page), 'the thumbs are measured again for Futura');
  await page.reload(); await page.waitForFunction(() => window.__travel);
  assert.equal(await look(), 'vintage', 'back to Vintage, kept');
  assert.equal(await page.evaluate(() => window.__travel.layer), 'travel', 'at Travel\'s own address, Calendar\'s layer is Travel\'s');
  assert.deepEqual(errs, []);
  await ctx.close();
});

// The old Travel Vintage app, on a phone that added it: its address opens Travel, with its data moved over once
await step('the old Travel Vintage address: its bookings, Gmail sign-in, Sheet backup copy and what it had seen move over, once', async () => {
  apiCalls.length = 0;
  const seed = { 'aos.seen': JSON.stringify({ travelvintage: '999' }), 'allison-travelv-v1': JSON.stringify({ bookings: [mine('h-old', 'Hotel From Vintage')], trips: [] }),
    'allison-travelv-v1-tab': 'trips', 'travelv.token': token, 'travelv.token.ever': '1', 'travelv.me': 'tom@example.com' };
  const before = () => new Promise((res, rej) => {   // the old app's IndexedDB copy of the Sheet link
    const r = indexedDB.open('allison-travelv', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put({ url: 'https://script.google.com/macros/s/old/exec', secret: 'maple-otter' }, 'sync'); t.oncomplete = () => { r.result.close(); res(); }; t.onerror = () => rej(t.error); };
    r.onerror = () => rej(r.error);
  });
  const { ctx, page, errs } = await phone('light', { seed, at: '/travelvintage/', before });
  await page.waitForSelector('.trip');
  const got = await page.evaluate(() => ({ look: document.documentElement.dataset.look, seen: JSON.parse(localStorage.getItem('aos.seen') || '{}'), own: localStorage.getItem('allison-travel-v1'), tok: localStorage.getItem('travel.token'),
    old: localStorage.getItem('allison-travelv-v1'), oldTok: localStorage.getItem('travelv.token'), names: window.__travel.bookings.map(b => b.name), layer: window.__travel.layer }));
  assert.ok(got.names.includes('Hotel From Vintage'), 'its booking is in Travel: ' + JSON.stringify(got.names));
  assert.match(await page.textContent('#tripsView'), /Boston/);
  assert.ok(got.own && got.tok, 'under Travel\'s names (allison-travel-v1, travel.token)');
  assert.equal(got.seen.travel, '999', 'what it had seen carries over (no walkthrough again)');
  assert.ok(got.old && got.oldTok, 'nothing old is deleted');
  assert.equal(got.look, 'vintage');
  assert.equal(got.layer, 'travelv', 'Calendar\'s layer keeps the old app\'s own name there, so neither copy overwrites the other');
  // the old app's copy of the Sheet link moves to Travel's database (handed over to aOS once signed in, then deleted)
  await page.waitForFunction(() => new Promise(res => { const r = indexedDB.open('allison-travel', 1); r.onsuccess = () => { try { const q = r.result.transaction('kv').objectStore('kv').get('sync'); q.onsuccess = () => res(!!(q.result && /macros\/s\/old/.test(q.result.url))); q.onerror = () => res(false); } catch { res(false); } }; r.onerror = () => res(false); }), null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => localStorage.getItem('allison-travel-v1-sync')), null, 'and the phone doesn\'t reconnect to the Sheet with it: aOS keeps the Sheet now');
  await page.click('#setBtn');
  await page.waitForFunction(() => /Working/.test(document.getElementById('stLive').textContent), null, { timeout: 5000 });
  assert.match(await page.textContent('#stGmail'), /Check now/, 'still signed in to Gmail');
  assert.ok(apiCalls.some(p => p.startsWith('/travel/api/')) && !apiCalls.some(p => p.startsWith('/travelvintage/')), 'it asks Travel\'s route, never one at the old address: ' + apiCalls.join(' '));
  // once only: a later change to the old keys is not copied again
  await page.evaluate(() => localStorage.setItem('allison-travelv-v1', JSON.stringify({ bookings: [], trips: [] })));
  await page.reload(); await page.waitForFunction(() => window.__travel);
  assert.ok(await page.evaluate(() => window.__travel.bookings.some(b => b.name === 'Hotel From Vintage')), 'moved once only');
  assert.deepEqual(errs, []);
  await ctx.close();
});
await step('a phone with both: Travel\'s own data is kept, the old app\'s is not copied over it', async () => {
  const seed = { 'aos.seen': JSON.stringify({ travel: '999', travelvintage: '999' }), 'allison-travel-v1': JSON.stringify({ bookings: [mine('h-new', 'Travel Own Hotel')], trips: [] }),
    'allison-travelv-v1': JSON.stringify({ bookings: [mine('h-old', 'Hotel From Vintage')], trips: [] }) };
  const { ctx, page } = await phone('light', { seed, at: '/travelvintage/' });
  const names = await page.evaluate(() => window.__travel.bookings.map(b => b.name));
  assert.deepEqual(names, ['Travel Own Hotel']);
  await ctx.close();
});

await browser.close();
server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
