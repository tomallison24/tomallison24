// Drives the Calendar app in headless Chromium against a stubbed iCloud
// function (the same routes functions/calendar/api answers, kept in memory),
// with events dated around today, Notes and Travel data in storage, and the
// weather stubbed: the month grid, the day and week grids, opening an event,
// editing it (the write carries the etag), a new event (with its time zone
// block), deleting one occurrence of a repeating event (an EXDATE), search,
// the switches' sliding thumbs, the layers, settings, and that nothing
// trips the page's Content Security Policy. Screenshots go to the folder given as the second argument.
// Both designs (../home/design.js): Vintage, the default, drawn in the Retro look (the sky held at day,
// aos.sky): Futura, flat cream (walnut) cards, a mustard thumb, a burnt-orange new-event button and
// today, the Family calendar in mustard and seven Retro colours for the calendars and layers; and
// Standard (Sea glass), with iCloud's and Notes' own colours. Settings > Design switches between them
// at once and keeps the choice; the old Calendar Vintage address (served from calendar/, as the
// deploy does) moves that app's data on the phone over to Calendar's names, and calls only
// /calendar/api/ and /aOS/api/.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node calendar/scripts/app-test.mjs [repo root] [screenshot dir]
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
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

// ---- a static server for the repo ----
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  p = p.replace(/^\/calendarvintage\//, '/calendar/');   // the old Calendar Vintage address: the deploy copies calendar/ there (news.yml)
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;

// ---- dates around today, in the test's own zone (the browser gets the same one) ----
const TZ = 'America/Denver';
process.env.TZ = TZ;
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const TODAY = ymd(day(0)), TOMORROW = ymd(day(1));
const ics = (uid, lines) => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Apple Inc.//iOS 26.0//EN\r\nCALSCALE:GREGORIAN\r\nBEGIN:VEVENT\r\nUID:' + uid + '\r\nDTSTAMP:20260901T120000Z\r\n' + lines.join('\r\n') + '\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
const compact = s => s.replace(/-/g, '');
const weekStartSun = (() => { const d = day(0); d.setDate(d.getDate() - d.getDay()); return ymd(d); })();
const files = new Map([
  ['dentist.ics', { etag: '"d1"', ics: ics('DENTIST-1', ['DTSTART;TZID=' + TZ + ':' + compact(TODAY) + 'T140000', 'DTEND;TZID=' + TZ + ':' + compact(TODAY) + 'T150000', 'SUMMARY:Dentist', 'LOCATION:12 High Street', 'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'END:VALARM']) }],
  ['away.ics', { etag: '"a1"', ics: ics('AWAY-1', ['DTSTART;VALUE=DATE:' + compact(TOMORROW), 'DTEND;VALUE=DATE:' + compact(ymd(day(3))), 'SUMMARY:Grandma visiting']) }],
  ['swim.ics', { etag: '"s1"', ics: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Apple Inc.//iOS 26.0//EN\r\n'
    + 'BEGIN:VEVENT\r\nUID:SWIM-1\r\nDTSTAMP:20260901T120000Z\r\nDTSTART;TZID=' + TZ + ':' + compact(ymd(day(-21))) + 'T170000\r\nDTEND;TZID=' + TZ + ':' + compact(ymd(day(-21))) + 'T180000\r\nRRULE:FREQ=WEEKLY\r\nSUMMARY:Swimming\r\nEND:VEVENT\r\n'
    + 'BEGIN:VEVENT\r\nUID:SWIM-1\r\nDTSTAMP:20260901T120000Z\r\nRECURRENCE-ID;TZID=' + TZ + ':' + compact(ymd(day(-7))) + 'T170000\r\nDTSTART;TZID=' + TZ + ':' + compact(ymd(day(-7))) + 'T183000\r\nDTEND;TZID=' + TZ + ':' + compact(ymd(day(-7))) + 'T193000\r\nSUMMARY:Swimming (late)\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n' }],
]);
const calls = [], apis = new Set();

const browser = await chromium.launch();
const violations = [], errors = [];
// design: 'glass' for Standard (nothing kept is Vintage); seed: what the phone had (else Calendar's walkthrough seen)
async function newPage(scheme, { design = null, seed = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, timezoneId: TZ, locale: 'en-US', geolocation: { latitude: 39.74, longitude: -104.99 }, permissions: ['geolocation'] });
  await ctx.addInitScript(([design, seed]) => {
    if (sessionStorage.getItem('seeded')) return;   // once: a reload keeps what the app did
    sessionStorage.setItem('seeded', '1');
    if (seed) for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    else localStorage.setItem('aos.seen', JSON.stringify({ calendar: '999' }));   // no aOS walkthrough over the page
    localStorage.setItem('aos.sky', 'day');   // the Vintage sky held still
    if (design) localStorage.setItem('design.calendar', design);
  }, [design, seed]);
  await ctx.route('**/calendar/api/**', async route => {
    const req = route.request(), u = new URL(req.url()), r = u.pathname.split('/api/')[1];
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (req.headers()['x-calendar'] !== '1') return json({ error: 'not-found' }, 404);
    calls.push({ method: req.method(), route: r, q: Object.fromEntries(u.searchParams), headers: req.headers(), body: req.postData() });
    if (r === 'ping') return json({ ok: true, configured: true, calendar: { name: 'Family', color: '#FF2968' } });
    if (r === 'events') return json({ ok: true, items: [...files].map(([name, f]) => ({ name, etag: f.etag, ics: f.ics })), calendar: { name: 'Family', color: '#FF2968' } });
    if (r === 'event' && req.method() === 'PUT') {
      const name = u.searchParams.get('name'), have = files.get(name), ifm = req.headers()['if-match'];
      if (ifm && (!have || have.etag !== ifm)) return json({ error: 'changed' }, 412);
      if (!ifm && have && u.searchParams.get('overwrite') !== '1') return json({ error: 'changed' }, 412);
      const etag = '"v' + Math.random().toString(36).slice(2, 7) + '"';
      files.set(name, { etag, ics: req.postData() });
      return json({ ok: true, name, etag });
    }
    if (r === 'event' && req.method() === 'DELETE') { files.delete(u.searchParams.get('name')); return json({ ok: true }); }
    if (r === 'forget') return json({ ok: true });
    return json({ error: 'not-found' }, 404);
  });
  await ctx.route('**/api.open-meteo.com/**', route => {
    const time = [], code = [], hi = [], lo = [];
    for (let i = 0; i < 16; i++) { time.push(ymd(day(i))); code.push([0, 2, 3, 61, 71, 95][i % 6]); hi.push(20 + i % 5); lo.push(8 + i % 4); }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ daily: { time, weather_code: code, temperature_2m_max: hi, temperature_2m_min: lo } }) });
  });
  await ctx.route('**/gmail.googleapis.com/**', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await ctx.addInitScript(({ TODAY, TOMORROW, YESTERDAY, CHECKOUT }) => {
    if (localStorage.getItem('allison-notes-v1')) return;
    localStorage.setItem('allison-notes-v1', JSON.stringify({
      notes: [{ id: 'n9', title: 'Renew passports', body: 'Both of ours', tags: [], color: 'none', pinned: false, reminder: TOMORROW + 'T09:30', created: 1, updated: 1, archived: false, deletedAt: null }],
      lists: [{ id: 'l1', name: 'Home', color: '#F59E0B' }],
      todos: [{ id: 't1', list: 'l1', title: 'Call the plumber', notes: 'About the tap', date: TODAY, time: '09:00', prio: 0, flagged: false, done: false, tags: [] }, { id: 't2', list: 'l1', title: 'Bins out', notes: '', date: TODAY, time: null, prio: 0, flagged: false, done: false, tags: [] }],
    }));
    localStorage.setItem('allison-travel-v1', JSON.stringify({ bookings: [
      { id: 'bk1', type: 'flight', airlineCode: 'UA', flightNo: '1234', from: 'DEN', to: 'BOS', fromName: 'Denver', toName: 'Boston', dep: TOMORROW + 'T07:05', depIso: '', arr: TOMORROW + 'T13:50', arrIso: '', conf: 'KQ7T2M' },
      { id: 'bk2', type: 'hotel', name: 'Courtyard Boston', checkIn: TOMORROW, checkOut: CHECKOUT, address: '275 Tremont St', city: 'Boston' },
    ], trips: [] }));
    localStorage.setItem('allison-fitness-v1', JSON.stringify({ v: 2, logs: [{ id: 'f1', date: YESTERDAY, exercise: 'Bench press', group: 'chest', sets: 3, reps: 8, weight: 135 }], exercises: [] }));
  }, { TODAY, TOMORROW, YESTERDAY: ymd(day(-1)), CHECKOUT: ymd(day(3)) });
  const page = await ctx.newPage();
  page.on('request', r => { const u = new URL(r.url()); if (u.origin === BASE && u.pathname.includes('/api/')) apis.add(u.pathname.replace(/\/api\/.*/, '/api/')); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource|404/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { window.__csp = (window.__csp || []).concat(e.violatedDirective + ' ' + e.blockedURI); }));
  return { ctx, page };
}
// Vintage, the default: the Retro look: Futura, flat cream (walnut) cards, mustard, burnt orange.
async function retroLook(page, scheme) {
  const q = (sel, props) => page.$eval(sel, (e, props) => { const c = getComputedStyle(e); return props.map(p => c[p]); }, props);
  const cream = scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', ground = scheme === 'light' ? 'rgb(241, 223, 187)' : 'rgb(74, 57, 30)';
  const orange = scheme === 'light' ? 'rgb(201, 80, 42)' : 'rgb(216, 87, 42)';
  assert.equal(await page.evaluate(() => document.documentElement.dataset.look), 'vintage');
  assert.equal(await page.evaluate(() => document.getElementById('vintage').media), 'all');
  assert.match((await q('body', ['fontFamily']))[0], /Futura/);
  assert.equal((await q('body', ['backgroundColor']))[0], ground, 'the sky’s day ground');
  const [bg, shadow, backdrop, radius] = await q('#mgrid', ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
  assert.equal(bg, cream, 'a flat cream (walnut) card'); assert.equal(shadow, 'none'); assert.ok(backdrop === 'none' || backdrop === '', backdrop); assert.equal(radius, '20px');
  assert.equal((await q('.ambient i:nth-child(1)', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard sun');
  assert.equal((await q('.ambient i:nth-child(3)', ['backgroundColor']))[0], 'rgb(216, 87, 42)', 'a burnt-orange pill');
  assert.equal((await q('#fab', ['backgroundColor']))[0], orange, 'the new-event button is solid orange');
  assert.equal((await q('#tabThumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'a mustard thumb under the chosen view');
  assert.equal((await q('.mday.today .n', ['backgroundColor']))[0], orange, 'today is an orange disc');
  assert.equal((await q('.title', ['fontSize']))[0], '38px');
  assert.equal((await q('.dock .tabs', ['backdropFilter']))[0], 'none');
  // the calendars and layers keep their own colour, from the Retro palette
  const pal = await page.evaluate(() => { const c = getComputedStyle(document.documentElement); return ['--cal', '--hol', '--nt', '--tr', '--ml', '--fit', '--drk'].map(k => c.getPropertyValue(k).trim().toLowerCase()); });
  assert.equal(new Set(pal).size, 7, 'seven different colours: ' + pal);
  assert.equal(pal[0], '#e3a72f', 'the Family calendar is mustard');
  assert.ok(!pal.some(c => /^#(ff2968|1f9d55|8b5cf6|18a58a|7b6cf6|f2780c|b0457a)$/.test(c)), 'none of the Sea glass colours: ' + pal);
  assert.deepEqual(await colours(page), { family: 'var(--cal)', note: 'var(--nt)' }, 'not iCloud’s or the Notes list’s own colour');
  assert.equal(await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'default');
  assert.ok(!/glass/.test(await page.getAttribute('link[rel="apple-touch-icon"]', 'href')), 'the Vintage icon');
}
// Standard: Sea glass, the Vintage block switched off, no sky; the icon and the status bar follow.
async function glassLook(page, scheme) {
  const q = (sel, props) => page.$eval(sel, (e, props) => { const c = getComputedStyle(e); return props.map(p => c[p]); }, props);
  assert.ok(await page.evaluate(() => document.documentElement.dataset.look === 'glass' && document.getElementById('vintage').media === 'not all' && !document.documentElement.hasAttribute('data-sky')), 'data-look glass, the Vintage styles off, no sky');
  assert.equal((await q('body', ['backgroundColor']))[0], scheme === 'light' ? 'rgb(238, 242, 240)' : 'rgb(13, 18, 19)', 'the Sea glass ground');
  assert.ok(!/Futura/.test((await q('body', ['fontFamily']))[0]), 'the system font');
  assert.notEqual((await q('#tabThumb', ['backgroundColor']))[0], 'rgb(227, 167, 47)', 'no mustard thumb');
  assert.match(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'), /icon-glass-180\.png/);
  assert.equal(await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'), 'black-translucent');
  assert.equal(await page.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content'), scheme === 'light' ? '#EEF2F0' : '#0D1213');
  assert.deepEqual(await colours(page), { family: '#FF2968', note: '#F59E0B' }, 'iCloud’s colour for the calendar, the Notes list’s own');
}
// The colour the Family calendar and a Notes reminder are drawn in.
const colours = page => page.evaluate(() => { const o = window.__calendar.st.occ; return { family: o.find(x => x.kind === 'family').color, note: o.find(x => x.kind === 'note' && x.id.startsWith('todo|')).color }; });
const shot = (page, name) => SHOTS ? page.screenshot({ path: path.join(SHOTS, name + '.png') }) : null;
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

const { ctx, page } = await newPage('light');
await page.goto(BASE + '/calendar/');
await page.waitForFunction(() => window.__calendar && window.__calendar.st.api === 'ok' && window.__calendar.st.items.size === 3);
await page.waitForTimeout(400);

await test('Vintage, the default: drawn in the Retro look (light)', async () => { await retroLook(page, 'light'); });

await test('Notes, Travel and Fitness in this storage show as layers', async () => {
  const kinds = await page.evaluate(() => [...new Set(window.__calendar.st.occ.map(x => x.kind))]);
  for (const k of ['note', 'travel', 'fitness', 'holiday', 'family']) assert.ok(kinds.includes(k), k + ': ' + kinds);
});

await test('the month grid shows the Family events, the layers and a holiday', async () => {
  const grid = await page.textContent('#mgrid');
  assert.ok(grid.includes('+2'), 'four things today: two shown and “+2”: ' + grid);
  assert.ok(grid.includes('Grandma visiting'), 'the all-day event');
  assert.ok(grid.includes('Swimming (late)'), 'the changed occurrence of the weekly swim');
  const sel = await page.textContent('#main');
  assert.ok(sel.includes('Dentist') && sel.includes('Bins out') && sel.includes('Call the plumber'), 'today’s list under the grid: ' + sel.slice(0, 300));
  assert.ok(sel.includes('12 High Street'));
  await shot(page, '01-month');
  await page.evaluate(() => window.__calendar.goTo('2026-12-25'));
  await page.waitForTimeout(200);
  assert.ok((await page.textContent('#mgrid')).includes('Christmas Day'));
  const hol = await page.evaluate(() => window.__calendar.usHolidays(2026).map(h => h.s + ' ' + h.name));
  assert.ok(hol.includes('2026-11-26 Thanksgiving') && hol.includes('2026-01-19 Martin Luther King Jr. Day') && hol.includes('2026-04-05 Easter') && hol.includes('2026-07-03 Independence Day (observed)') && hol.includes('2026-05-25 Memorial Day'), hol.join('\n'));
  await page.evaluate(() => window.__calendar.goTo(window.__calendar.st.sel = new Date().toISOString().slice(0, 10)));
  await page.click('#todayBtn');
});

await test('the day view has the time grid, the now line, the weather and the event block', async () => {
  await page.click('.tab[data-view="day"]');
  await page.waitForSelector('#timeview');
  assert.ok(await page.$('.nowline'), 'now line');
  const titles = await page.$$eval('.tev b', els => els.map(e => e.textContent));
  assert.ok(titles.includes('Dentist') && titles.includes('Call the plumber'), titles.join());
  assert.ok((await page.textContent('.tghead')).includes('°'), 'weather in the header');
  assert.ok((await page.textContent('.allday')).includes('Bins out'), 'all-day row');
  await shot(page, '02-day');
});

await test('the week view lays events out and Travel’s flight is on tomorrow', async () => {
  await page.click('.tab[data-view="week"]');
  await page.waitForSelector('#timeview');
  assert.equal((await page.$$('.col')).length, 7);
  const first = await page.$eval('.dh[data-day]', e => e.dataset.day);
  assert.equal(first, weekStartSun, 'the week starts on Sunday');
  let titles = await page.$$eval('.tev b', els => els.map(e => e.textContent));
  assert.ok(titles.includes('Swimming') || titles.includes('Swimming (late)'), 'the weekly swim: ' + titles.join());
  // On a Saturday, tomorrow is in next week's view
  if (new Date(TOMORROW + 'T12:00').getDay() === 0) {
    await page.click('[data-act="next"]');
    await page.waitForFunction(d => document.querySelector('.dh[data-day]')?.dataset.day === d, TOMORROW);
    titles = await page.$$eval('.tev b', els => els.map(e => e.textContent));
  }
  assert.ok(titles.some(t => t.startsWith('UA 1234')), 'Travel flight: ' + titles.join());
  assert.ok((await page.textContent('.allday')).includes('Courtyard Boston'), 'Travel hotel as all-day');
  await shot(page, '03-week');
  // Travel's flight opens in Travel (which carries both designs: not the old Travel Vintage address)
  await page.click('.tev:has-text("UA 1234")');
  await page.waitForSelector('#evSheet:not([hidden])');
  assert.equal(await page.getAttribute('#evBody a.rowbtn', 'href'), '../travel/');
  assert.ok((await page.textContent('#evBody a.rowbtn')).includes('Open in Travel'));
  await page.click('#evSheet .iconbtn');
  await page.waitForFunction(() => document.getElementById('evSheet').hidden);
  if (new Date(TOMORROW + 'T12:00').getDay() === 0) await page.click('[data-act="prev"]');   // back to this week, for the steps after
});

await test('opening an event shows its details; editing writes back with the etag', async () => {
  await page.click('.tab[data-view="month"]');
  await page.click('.evrow:has-text("Dentist")');
  await page.waitForSelector('#evSheet:not([hidden])');
  const body = await page.textContent('#evBody');
  assert.ok(body.includes('Dentist') && body.includes('12 High Street') && body.includes('30 minutes before') && body.includes('2:00 PM'), body);
  await shot(page, '04-event');
  await page.click('#evEdit');
  await page.waitForSelector('#edSheet:not([hidden])');
  await page.fill('#edTitle', 'Dentist (moved)');
  await page.selectOption('#edAlert1', '-PT1H');
  await page.selectOption('#edTravel', '30');
  await shot(page, '05-editor');
  calls.length = 0;
  await page.click('#edSave');
  await page.waitForFunction(() => document.getElementById('edSheet').hidden);
  const put = calls.find(c => c.method === 'PUT');
  assert.ok(put, 'a PUT happened');
  assert.equal(put.q.name, 'dentist.ics'); assert.equal(put.headers['if-match'], '"d1"');
  assert.ok(put.body.includes('SUMMARY:Dentist (moved)') && put.body.includes('TRIGGER:-PT1H') && put.body.includes('X-APPLE-TRAVEL-DURATION;VALUE=DURATION:PT30M') && put.body.includes('SEQUENCE:1'), put.body);
  assert.ok(put.body.includes('BEGIN:VTIMEZONE') && put.body.includes('TZID:' + TZ), 'a VTIMEZONE block for the zone');
  assert.ok(put.body.includes('LOCATION:12 High Street'), 'what was not edited survives');
  await page.waitForTimeout(200);
  assert.ok((await page.textContent('#main')).includes('Dentist (moved)'));
});

await test('a new event goes to iCloud as its own file', async () => {
  calls.length = 0;
  await page.click('#fab');
  await page.waitForSelector('#edSheet:not([hidden])');
  await page.fill('#edTitle', 'Piano lesson');
  await page.fill('#edLoc', 'Music school');
  await page.selectOption('#edRepeat', 'FREQ=WEEKLY');
  await page.selectOption('#edRuleEnd', 'count');
  await page.fill('#edCount', '8');
  await page.$eval('#edCount', e => e.dispatchEvent(new Event('change')));
  await page.click('#edSave');
  await page.waitForFunction(() => document.getElementById('edSheet').hidden);
  const put = calls.find(c => c.method === 'PUT');
  assert.ok(put && /^[0-9A-F-]{36}\.ics$/.test(put.q.name), 'named after a new UID: ' + (put && put.q.name));
  assert.equal(put.headers['if-match'], undefined);
  assert.ok(put.body.includes('SUMMARY:Piano lesson') && put.body.includes('LOCATION:Music school') && put.body.includes('RRULE:FREQ=WEEKLY;COUNT=8') && put.body.includes('DTSTART;TZID=' + TZ), put.body);
  assert.ok(put.body.includes('TRIGGER:-PT15M'), 'the default alert');
  assert.equal(files.size, 4);
  await page.waitForTimeout(200);
  assert.ok((await page.textContent('#main')).includes('Piano lesson'));
});

await test('deleting one occurrence of a repeating event adds an EXDATE', async () => {
  const swimDay = ymd(day(0 - ((day(0).getDay() - day(-21).getDay() + 7) % 7)));
  await page.evaluate(d => window.__calendar.goTo(d, 'day'), swimDay);
  await page.waitForSelector('#timeview');
  await page.click('.tev:has-text("Swimming")');
  await page.waitForSelector('#evSheet:not([hidden])');
  assert.ok((await page.textContent('#evBody')).includes('Every week on'), 'the repeat in words');
  calls.length = 0;
  await page.click('#evDelete');
  await page.waitForSelector('#pickSheet:not([hidden])');
  await page.click('[data-pick="this"]');
  await page.waitForFunction(() => document.getElementById('pickSheet').hidden);
  await page.waitForTimeout(300);
  const put = calls.find(c => c.method === 'PUT');
  assert.ok(put && put.q.name === 'swim.ics' && put.headers['if-match'] === '"s1"', 'the series file was rewritten');
  assert.ok(put.body.includes('EXDATE;TZID=' + TZ + ':' + compact(swimDay) + 'T170000'), put.body);
  assert.ok(put.body.includes('RRULE:FREQ=WEEKLY'), 'the rule stays');
  const titles = await page.$$eval('.tev b', els => els.map(e => e.textContent));
  assert.ok(!titles.includes('Swimming'), 'gone from that day: ' + titles.join());
});

await test('search finds by title and place', async () => {
  await page.click('#searchBtn');
  await page.fill('#searchIn', 'music');
  await page.waitForTimeout(150);
  const t = await page.textContent('#main');
  assert.ok(t.includes('Piano lesson') && !t.includes('Dentist'), t.slice(0, 200));
  await page.fill('#searchIn', 'grandma');
  await page.waitForTimeout(150);
  assert.ok((await page.textContent('#main')).includes('Grandma visiting'));
  await shot(page, '06-search');
  await page.click('#searchBtn');
});

await test('the year and list views', async () => {
  await page.click('.tab[data-view="year"]');
  assert.equal((await page.$$('.ymon')).length, 12);
  await shot(page, '07-year');
  await page.click('.tab[data-view="list"]');
  const t = await page.textContent('#main');
  assert.ok(t.includes('Today') && t.includes('Grandma visiting'), t.slice(0, 300));
  await shot(page, '08-list');
});

await test('switches: a glass thumb slides under the chosen view, day and setting, and hides while searching', async () => {
  // true once the thumb in `box` sits exactly over its chosen option (or that option's `inner`)
  const under = ([box, chosen, inner]) => { const b = document.querySelector(box), t = b && b.querySelector(':scope > .slthumb'), c = b && b.querySelector(chosen); if (!t || !c) return false; const q = (inner ? c.querySelector(inner) : c).getBoundingClientRect(), r = t.getBoundingClientRect(); return Math.abs(r.left - q.left) < 1 && Math.abs(r.width - q.width) < 1 && Math.abs(r.top - q.top) < 1; };
  const tabs = ['.tabs', '.tab[aria-selected="true"]'];
  // Counts the slides started (a thumb animating its move), so "it slid"
  // doesn't depend on catching it mid-way on a slow machine.
  await page.evaluate(() => { const a = Element.prototype.animate; window.__slides = 0; Element.prototype.animate = function (k, o) { if (this.classList.contains('slthumb') && k[0] && k[0].transform) window.__slides++; return a.call(this, k, o); }; });
  const slides = () => page.evaluate(() => window.__slides);
  await page.click('.tab[data-view="week"]');
  assert.equal(await slides(), 1, 'the thumb slid to Week');
  // a redraw mid-slide (events arriving from iCloud) lets the slide run on
  assert.ok(await page.evaluate(() => { const t = document.getElementById('tabThumb'), n = t.getAnimations().length; window.__calendar.render(); return n > 0 && t.getAnimations().length > 0; }), 'the slide survives a redraw');
  await page.waitForFunction(under, tabs, { timeout: 3000 });
  await page.click('#searchBtn');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('tabThumb')).opacity === '0', null, { timeout: 3000 });
  await page.click('#searchBtn');
  await page.click('.tab[data-view="list"]');
  await page.waitForFunction(under, tabs, { timeout: 3000 });
  // the Day view's week strip: the circle slides to the day tapped
  const strip = ['.strip', 'button[aria-selected="true"]', 'b'];
  await page.click('.tab[data-view="day"]');
  await page.waitForFunction(under, strip, { timeout: 3000 });
  const other = await page.$eval('.strip button[aria-selected="false"]', b => b.dataset.day);
  let n = await slides();
  await page.click('.strip button[data-day="' + other + '"]');
  assert.ok(await slides() > n, 'the circle slid to the day');
  await page.waitForFunction(under, strip, { timeout: 3000 });
  // Settings' segmented choices
  const seg = ['#stBody .seg:has([data-set="clock"])', '[aria-pressed="true"]'];
  await page.click('#setBtn');
  await page.waitForFunction(under, seg, { timeout: 3000 });
  n = await slides();
  await page.click('[data-set="clock"][data-val="24"]');
  assert.ok(await slides() > n, 'the choice slid');
  await page.waitForFunction(under, seg, { timeout: 3000 });
  await page.click('[data-set="clock"][data-val="auto"]');
  await page.click('#setSheet .sheethead [data-close]');
  await page.click('.tab[data-view="list"]');
});

await test('settings: the layers switch off and on, and the week can start on Monday', async () => {
  await page.click('#setBtn');
  await page.waitForSelector('#setSheet:not([hidden])');
  const t = await page.textContent('#stBody');
  assert.ok(t.includes('Connected') && t.includes('Family') && t.includes('US Holidays') && t.includes('Sign in to your family account first'), t);
  await shot(page, '09-settings');
  await page.click('[data-layer="notes"]');
  await page.click('[data-set="weekStart"][data-val="1"]');
  await page.click('#setSheet .sheethead [data-close]');
  await page.click('.tab[data-view="month"]');
  await page.waitForTimeout(150);
  assert.ok(!(await page.textContent('#main')).includes('Call the plumber'), 'Notes layer off');
  assert.equal(await page.$eval('.wkhead span', e => e.textContent), 'M', 'Monday first, once picked');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('allison-calendar-v1-settings')).weekStartPicked), true);
  await page.click('#setBtn'); await page.click('[data-layer="notes"]'); await page.click('[data-set="weekStart"][data-val="0"]'); await page.click('#setSheet .sheethead [data-close]');
});

await test('dark mode renders', async () => {
  const dark = await newPage('dark');
  await dark.page.goto(BASE + '/calendar/');
  await dark.page.waitForFunction(() => window.__calendar && window.__calendar.st.api === 'ok');
  await dark.page.waitForTimeout(400);
  await retroLook(dark.page, 'dark');
  await shot(dark.page, '10-month-dark');
  await dark.page.click('.tab[data-view="day"]'); await dark.page.waitForSelector('#timeview'); await shot(dark.page, '11-day-dark');
  await dark.page.click('.evrow, .tev'); await dark.page.waitForTimeout(300); await shot(dark.page, '12-event-dark');
  const csp = await dark.page.evaluate(() => window.__csp || []);
  violations.push(...csp);
  await dark.ctx.close();
});

await test('it keeps Calendar’s storage and cache, and talks only to Calendar’s server route and aOS’s', async () => {
  const keys = await page.evaluate(() => Object.keys(localStorage));
  assert.ok(keys.some(k => k.startsWith('allison-calendar-v1-')), keys.join());
  assert.deepEqual(keys.filter(k => k.startsWith('allison-calendarv-')), [], 'nothing under the old Calendar Vintage keys');
  assert.deepEqual([...apis].sort(), ['/aOS/api/', '/calendar/api/'], [...apis].join());
  await page.evaluate(() => navigator.serviceWorker.ready);
  const caches = await page.evaluate(async () => { for (let i = 0; i < 40; i++) { const k = await window.caches.keys(); if (k.length) return k; await new Promise(r => setTimeout(r, 100)); } return []; });
  assert.deepEqual(caches, [/const CACHE = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'calendar/sw.js'), 'utf8'))[1]]);   // calendar/sw.js's own
});

await test('Standard (Sea glass), light and dark: no Vintage, iCloud’s and Notes’ own colours', async () => {
  for (const scheme of ['light', 'dark']) {
    const g = await newPage(scheme, { design: 'glass' });
    await g.page.goto(BASE + '/calendar/');
    await g.page.waitForFunction(() => window.__calendar && window.__calendar.st.api === 'ok' && window.__calendar.st.items.size > 0);
    await g.page.waitForTimeout(400);
    await glassLook(g.page, scheme);
    await shot(g.page, '13-glass-month-' + scheme);
    violations.push(...(await g.page.evaluate(() => window.__csp || [])));
    await g.ctx.close();
  }
});

await test('Settings > Design: Vintage, then Standard and back, at once and kept across a reload', async () => {
  const { ctx: c, page: p } = await newPage('light');
  await p.goto(BASE + '/calendar/');
  await p.waitForFunction(() => window.__calendar && window.__calendar.st.api === 'ok' && window.__calendar.st.items.size > 0);
  await p.waitForTimeout(300);
  const look = () => p.evaluate(() => document.documentElement.dataset.look);
  const under = () => p.evaluate(() => { const t = document.getElementById('tabThumb').getBoundingClientRect(), c = document.querySelector('.tab[aria-selected="true"]').getBoundingClientRect(); return Math.abs(t.left - c.left) < 1 && Math.abs(t.width - c.width) < 1; });
  assert.equal(await look(), 'vintage');
  await p.click('#setBtn'); await p.waitForSelector('#setSheet:not([hidden])');
  assert.equal(await p.textContent('#stBody .label'), 'Design', 'Design is the first section');
  assert.equal(await p.getAttribute('#stBody [data-design="vintage"]', 'aria-checked'), 'true');
  assert.equal(await p.getAttribute('#stBody [data-design="glass"]', 'aria-checked'), 'false');
  assert.ok(!(await p.textContent('#stBody')).includes('Just on this phone'), 'no explanation under Design');
  await shot(p, '14-settings-vintage');
  await p.click('#stBody [data-design="glass"]'); await p.waitForTimeout(250);
  assert.equal(await look(), 'glass', 'Standard at once');
  assert.equal(await p.getAttribute('#stBody [data-design="glass"]', 'aria-checked'), 'true');
  assert.ok(await p.isVisible('#setSheet'), 'Settings stays open');
  assert.deepEqual(await colours(p), { family: '#FF2968', note: '#F59E0B' }, 'drawn again in Standard’s colours');
  assert.equal(await p.$eval('#stFamily', e => e.style.getPropertyValue('--c')), '#FF2968');
  await shot(p, '15-settings-glass');
  await p.click('#setSheet .sheethead [data-close]');
  await p.waitForTimeout(300);
  assert.ok(await under(), 'the view bar’s thumb measured again for the system font');
  await p.reload(); await p.waitForFunction(() => window.__calendar && window.__calendar.st.api === 'ok');
  assert.equal(await look(), 'glass', 'Standard is kept');
  assert.equal(await p.evaluate(() => localStorage.getItem('design.calendar')), 'glass');
  await p.click('#setBtn'); await p.waitForSelector('#setSheet:not([hidden])');
  await p.click('#stBody [data-design="vintage"]'); await p.waitForTimeout(250);
  assert.equal(await look(), 'vintage', 'Vintage at once');
  assert.equal(await p.evaluate(() => window.__calendar.st.occ.find(x => x.kind === 'family').color), 'var(--cal)');
  await p.click('#setSheet .sheethead [data-close]');
  await p.waitForTimeout(300);
  assert.ok(await under(), 'the thumb measured again for Futura');
  await p.reload(); await p.waitForFunction(() => window.__calendar && window.__calendar.st.api === 'ok');
  assert.equal(await look(), 'vintage', 'Vintage is kept');
  assert.equal(await p.evaluate(() => localStorage.getItem('design.calendar')), 'vintage');
  violations.push(...(await p.evaluate(() => window.__csp || [])));
  await c.close();
});

await test('the old Calendar Vintage address: its data moves over to Calendar’s names, once', async () => {
  apis.clear();
  const seed = {
    'aos.seen': JSON.stringify({ calendarvintage: '1.3' }),
    'allison-calendarv-v1-view': 'week',
    'allison-calendarv-v1-settings': JSON.stringify({ weekStart: 1, weekStartPicked: true }),
  };
  const { ctx: c, page: p } = await newPage('light', { seed });
  await p.goto(BASE + '/calendarvintage/');
  await p.waitForFunction(() => window.__calendar && window.__calendar.st.api === 'ok' && window.__calendar.st.items.size > 0);
  await p.waitForTimeout(300);
  const got = await p.evaluate(() => ({ view: window.__calendar.st.view, weekStart: window.__calendar.settings.weekStart, newView: localStorage.getItem('allison-calendar-v1-view'), seen: JSON.parse(localStorage.getItem('aos.seen') || '{}'), old: localStorage.getItem('allison-calendarv-v1-view'), look: document.documentElement.dataset.look }));
  assert.equal(got.view, 'week', 'it opens on the view it was on: ' + JSON.stringify(got));
  assert.equal(got.newView, 'week'); assert.equal(got.weekStart, 1, 'its settings came too');
  assert.equal(await p.$eval('.dh[data-day]', e => new Date(e.dataset.day + 'T12:00').getDay()), 1, 'its week starts on Monday');
  assert.equal(got.seen.calendar, '1.3', 'what it had seen carries over (no walkthrough again)');
  assert.equal(got.old, 'week', 'nothing old is deleted');
  assert.equal(got.look, 'vintage');
  assert.deepEqual([...apis].sort(), ['/aOS/api/', '/calendar/api/'], 'Calendar’s route from the old address too: ' + [...apis]);
  // once only: a later change to the old keys is not copied again
  await p.evaluate(() => localStorage.setItem('allison-calendarv-v1-view', 'year'));
  await p.reload(); await p.waitForFunction(() => window.__calendar && window.__calendar.st.api === 'ok');
  assert.equal(await p.evaluate(() => localStorage.getItem('allison-calendar-v1-view')), 'week', 'moved once only');
  violations.push(...(await p.evaluate(() => window.__csp || [])));
  await c.close();
});

await test('a phone with both: Calendar’s own data is kept, the old app’s is not copied over it', async () => {
  const seed = { 'aos.seen': JSON.stringify({ calendar: '999', calendarvintage: '999' }), 'allison-calendar-v1-view': 'day', 'allison-calendarv-v1-view': 'week' };
  const { ctx: c, page: p } = await newPage('light', { seed });
  await p.goto(BASE + '/calendarvintage/');
  await p.waitForFunction(() => window.__calendar && window.__calendar.st.api === 'ok');
  assert.equal(await p.evaluate(() => localStorage.getItem('allison-calendar-v1-view')), 'day');
  assert.equal(await p.evaluate(() => window.__calendar.st.view), 'day');
  await c.close();
});

await test('a ?date= that isn’t a real day opens on today, as no date would; an all-day alert after the day has its words, in Russian too', async () => {
  const { ctx: c, page: p } = await newPage('light');
  for (const bad of ['2026-02-30', '2026-13-45', '2026-1-5']) {
    await p.goto(BASE + '/calendar/?date=' + bad + '&view=day');
    await p.waitForFunction(() => window.__calendar);
    assert.deepEqual(await p.evaluate(() => [window.__calendar.st.sel, window.__calendar.st.view]), [TODAY, 'month'], bad);
  }
  await p.goto(BASE + '/calendar/?date=2026-02-28&view=day');
  await p.waitForFunction(() => window.__calendar);
  assert.deepEqual(await p.evaluate(() => [window.__calendar.st.sel, window.__calendar.st.view]), ['2026-02-28', 'day']);
  // alarmWords: an all-day event's alert set after the day (another calendar app can), before it, on it, and a timed event's
  const words = [[{ minutes: 1980 }, true], [{ minutes: 7 * 1440 + 540 }, true], [{ minutes: 2 * 1440 }, true], [{ minutes: -900 }, true], [{ minutes: 540 }, true], [{ minutes: 60, related: 'start' }, false]];
  assert.deepEqual(await p.evaluate(w => w.map(([a, allDay]) => window.__calendar.alarmWords(a, allDay)), words),
    ['1 day after at 9:00 AM', '1 week after at 9:00 AM', '2 days after at 12:00 AM', '1 day before at 9:00 AM', 'On the day at 9:00 AM', '1 hour after']);
  await p.evaluate(() => aosLang.set('ru'));   // drawn again in Russian (a reload)
  await p.waitForFunction(() => window.__calendar && aosLang.get() === 'ru');
  assert.deepEqual(await p.evaluate(() => ['1 day after at 9:00 AM', '1 week after at 9:00 AM', '2 days after at 12:00 AM', '1 day before at 9:00 AM'].map(aosLang.t)),
    ['Через 1 день в 9:00 AM', 'Через 1 неделю в 9:00 AM', 'Через 2 дня в 12:00 AM', 'За 1 день в 9:00 AM']);
  violations.push(...(await p.evaluate(() => window.__csp || [])));
  await c.close();
});

await test('nothing tripped the Content Security Policy and no script errors', async () => {
  violations.push(...(await page.evaluate(() => window.__csp || [])));
  assert.deepEqual(violations, []);
  assert.deepEqual(errors, []);
});

await ctx.close();
await browser.close();
server.close();
console.log('\n' + n + ' tests passed');
