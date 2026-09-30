// Drives the Travel app in headless Chromium against a stubbed Gmail and a
// stubbed flight status function, with made-up booking emails dated around
// today: reading Gmail, grouping into a trip, the trip page, a booking with
// live status, the calendar file, Explore's links, and that nothing trips
// the page's Content Security Policy. Screenshots go to the folder given as
// the second argument (default: none).
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node travel/scripts/app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';

// ---- a static server for the repo ----
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
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
  page.on('pageerror', e => problems.push(String(e)));
  const listed = [];
  await ctx.route('https://gmail.googleapis.com/**', route => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/profile')) return route.fulfill({ json: { emailAddress: 'tom@example.com' } });
    if (u.pathname.endsWith('/messages')) { listed.push(u.searchParams.get('q')); return route.fulfill({ json: { messages: EMAILS.map(m => ({ id: m.id, threadId: m.threadId })) } }); }
    const id = u.pathname.split('/').pop(), m = EMAILS.find(x => x.id === id);
    return m ? route.fulfill({ json: gmailMessage(m) }) : route.fulfill({ status: 404, json: { error: { message: 'not found' } } });
  });
  const lookups = [];
  await ctx.route(BASE + '/travel/api/**', route => {
    const u = new URL(route.request().url());
    if (route.request().headers()['x-travel'] !== '1') return route.fulfill({ status: 404, json: { error: 'not-found' } });
    if (u.pathname.endsWith('/ping')) return route.fulfill({ json: { ok: true, status: true } });
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
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'trip-' + scheme + '.png') });

  await step(scheme + ': a flight shows live gates and times; a text-read one asks to be checked', async () => {
    await page.click('#tpBody .ev.flight');
    await page.waitForSelector('#bkSheet:not([hidden]) #bkLive .grid2');
    const t = await page.textContent('#bkLive');
    assert.match(t, /Gate B32/); assert.match(t, /Bags: belt 4/);
    assert.ok(await page.$('#bkBody .verify'), 'guess banner');
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
      return t.bookings.filter(b => b.conf === 'MOVED1').map(b => b.dep);
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
    assert.equal(trips.length, 2);
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
    assert.match(await page.textContent('#stGmail'), /Look for new bookings now/);
  });
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'settings-' + scheme + '.png') });
  await step(scheme + ': no script errors and nothing blocked by the page policy', async () => {
    assert.deepEqual(problems.filter(p => !/favicon/.test(p)), []);
  });
  await ctx.close();
}

// Google Sheet: a "wrong secret" says which link it was.
await step('a Notes Sheet link is recognised, and an old Travel script is named', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  let app = 'allison-notes-sync';
  await ctx.route('https://script.google.com/**', route => route.request().method() === 'POST'
    ? route.fulfill({ json: { ok: false, error: 'wrong-secret' } })
    : route.fulfill({ json: { ok: true, app, v: 1 } }));
  await page.goto(BASE + '/travel/');
  await page.click('#setBtn'); await page.click('#stSheet');
  await page.fill('#syUrl', 'https://script.google.com/macros/s/abc/exec'); await page.fill('#sySecret', 'maple-otter');
  await page.click('#syConnect');
  await page.waitForFunction(() => /Notes Sheet/.test(document.getElementById('syStatus').textContent));
  app = 'allison-travel-sync';
  await page.click('#syConnect');
  await page.waitForFunction(() => /old copy of the script/.test(document.getElementById('syStatus').textContent));
  await ctx.close();
});

// Without the server function (GitHub Pages): no lookups, a clear message.
await step('without the flight status server, it says so', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/travel/');
  await page.click('#setBtn');
  await page.waitForFunction(() => /Not available/.test(document.getElementById('stLive').textContent));
  await ctx.close();
});

await browser.close();
server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
