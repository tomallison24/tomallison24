// Drives Ipsy (home/ipsy.js with travel/ipsy-tools.js) in Travel, in both its designs, light and
// dark, in headless Chromium, against a stubbed Gmail, a stubbed flight service (travel/api/flight
// and find) and a stand-in for Claude at /travel/api/ipsy (no network, no keys). Checks: Ipsy above
// the tabs, covering no control; asking once before the first question; the chat running the tools
// Claude asks for on the app's own bookings: live flight status for a booking and for a flight that
// is in neither the app nor an email, the departure board, every kind of change (a field, a day that
// keeps its time, a seat, a delete, moving a booking to another trip, a new name, a new booking, a
// cancel), each with an Undo that puts back exactly what was there; deleting a whole trip only after
// Yes in the chat; Gmail search and an email read with its links as their site only; a trip shown on
// screen; the conversation only ever added to; a failed question taken back out; the chat kept when
// the app is opened again; Ipsy changing with the design at once; and nothing tripping the page's
// Content Security Policy. Every booking, email and flight here is made up.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node travel/scripts/ipsy-test.mjs [repo root] [screenshot dir]
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
const QUERY_V = (/const QUERY_V = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'travel/app.js'), 'utf8')) || [])[1];

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

// ---- dates: always counted from today, so any day of the week and the end of a month work ----
const pad = n => String(n).padStart(2, '0');
const at = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const iso = n => { const d = at(n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const TOMORROW = iso(1), OUT = iso(20), HOME = iso(24), HOP = iso(40), FAR = iso(100);

// ---- the bookings on the phone ----
const fl = (id, al, no, from, to, day, dep, arr, conf, extra = {}) => ({ id, type: 'flight', status: 'confirmed', guess: false, conf, notes: '', airline: al === 'AS' ? 'Alaska Airlines' : al === 'UA' ? 'United' : 'Frontier',
  airlineCode: al, flightNo: no, from, to, fromName: '', toName: '', dep: day ? day + 'T' + dep : '', arr: day ? day + 'T' + arr : '', depIso: '', arrIso: '', created: 1, updated: 1, ...extra });
const BOOKINGS = [
  fl('f-ua110', 'UA', '110', 'DEN', 'BOS', TOMORROW, '08:00', '13:50', 'KQ7T2M', { seat: '14A', source: { msgId: 'e1', threadId: 't1', subject: 'Your trip confirmation - KQ7T2M', from: 'United Airlines <unitedairlines@united.com>', date: Date.now() - 864e5 } }),
  fl('f-as474', 'AS', '474', 'RDU', 'SAN', OUT, '17:10', '20:01', 'YAVUUB'),
  { id: 'h-hilton', type: 'hotel', status: 'confirmed', guess: false, conf: '3115096800', notes: '', name: 'Hilton San Diego Bayfront', address: '1 Park Boulevard, San Diego, CA', city: 'San Diego', checkIn: OUT, checkOut: HOME, created: 1, updated: 1 },
  fl('f-as434', 'AS', '434', 'SAN', 'RDU', HOME, '10:05', '18:20', 'YAVUUB'),
  fl('f-as120', 'AS', '120', 'RDU', 'PDX', HOP, '17:10', '20:01', 'HOP22X'),
  fl('f-as900', 'AS', '900', 'RDU', 'DEN', FAR, '17:10', '20:01', 'ZZ9PLU'),
  // read from an email with no day in it: waits in To check
  fl('f-f93073', 'F9', '3073', 'RDU', 'CLE', '', '', '', 'ZQ4RTE', { guess: true, depTime: '16:04', arrTime: '17:51', source: { msgId: 'e2', threadId: 't2', subject: 'Booking Confirmation: ZQ4RTE', from: 'Frontier Airlines <flights@t.flyfrontier.com>', date: Date.now() - 2 * 864e5 } }),
];

// ---- made-up emails ----
const EMAILS = [
  { id: 'e1', threadId: 't1', ago: 1, from: 'United Airlines <unitedairlines@united.com>', subject: 'Your trip confirmation - KQ7T2M', text:
    `Thanks for choosing United.\nConfirmation number: KQ7T2M\nUA 110 Denver (DEN) to Boston (BOS), ${TOMORROW} 8:00 AM\nSeat 14A\nManage your trip: https://www.united.com/manageres/mytrips?cn=KQ7T2M&ln=Example\nCheck in: https://checkin.united.com/x?pnr=KQ7T2M` },
  { id: 'e2', threadId: 't2', ago: 2, from: 'Frontier Airlines <flights@t.flyfrontier.com>', subject: 'Booking Confirmation: ZQ4RTE', text: 'Confirmation Code ZQ4RTE\nFlight #3073\nDeparts RDU 4:04 PM Arrives CLE 5:51 PM' },
];
const b64 = s => Buffer.from(s, 'utf8').toString('base64url');
const gmailMessage = m => ({
  id: m.id, threadId: m.threadId, internalDate: String(Date.now() - m.ago * 86400e3), snippet: m.text.slice(0, 80),
  payload: { mimeType: 'multipart/alternative', headers: [{ name: 'Subject', value: m.subject }, { name: 'From', value: m.from }, { name: 'To', value: 'pat@example.com' }],
    parts: [{ mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset=UTF-8' }], body: { data: b64(m.text) } }] },
});

// ---- the flight service ----
const leg = (no, from, to, day, status, gate) => ({ number: no, status, codeshare: 'IsOperator', cargo: false, airline: 'United', aircraft: 'Boeing 737-900',
  departure: { iata: from, name: from, tz: '', scheduled: { utc: day + ' 14:00Z', local: day + ' 08:00-06:00' }, revised: { utc: day + ' 14:35Z', local: day + ' 08:35-06:00' }, predicted: null, runway: null, terminal: 'West', gate, belt: '', checkIn: '' },
  arrival: { iata: to, name: to, tz: '', scheduled: { utc: day + ' 17:50Z', local: day + ' 13:50-04:00' }, revised: null, predicted: null, runway: null, terminal: 'B', gate: 'B9', belt: '4', checkIn: '' }, updated: '' });
function flightService(u) {
  const no = u.searchParams.get('no'), date = u.searchParams.get('date');
  if (no === 'UA110' && date === TOMORROW) return { ok: true, found: true, legs: [leg('UA 110', 'DEN', 'BOS', date, 'Delayed', 'B32')] };
  if (no === 'DL1500') return { ok: true, found: true, legs: [leg('DL 1500', 'RDU', 'CLE', date, 'Expected', 'C4')] };
  return { ok: true, found: false };
}

// ---- the stand-in for Claude: answers each step of a question from where the conversation is ----
let uid = 0;
const tu = (name, input) => ({ type: 'tool_use', id: 'toolu_' + (++uid), name, input });
const think = { type: 'thinking', thinking: '', signature: 'sig-' + 'x'.repeat(20) };
const said = text => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });
const use = (...uses) => ({ stop_reason: 'tool_use', content: uses });
const isNote = b => b.type === 'text' && b.text.startsWith('[From the app');
function where(msgs) {
  // the question this step belongs to, and how many answers it has had so far
  let qi = msgs.length - 1;
  while (qi > 0 && !(msgs[qi].role === 'user' && msgs[qi].content.some(isNote))) qi--;
  const question = msgs[qi].content.filter(b => b.type === 'text' && !isNote(b)).map(b => b.text).join(' ');
  return { question, n: msgs.slice(qi).filter(m => m.role === 'assistant').length, last: msgs[msgs.length - 1] };
}
// The latest result of a tool, parsed.
const R = (msgs, name) => {
  for (let i = msgs.length - 1; i > 0; i--) {
    const m = msgs[i]; if (m.role !== 'user' || !Array.isArray(m.content)) continue;
    for (const r of m.content) if (r.type === 'tool_result') {
      const u = msgs[i - 1].content.find(b => b.type === 'tool_use' && b.id === r.tool_use_id);
      if (u && u.name === name) { try { return { ...JSON.parse(r.content), is_error: r.is_error }; } catch { return { error: r.content, is_error: r.is_error }; } }
    }
  }
  return null;
};
const all = (msgs, name) => msgs.flatMap((m, i) => m.role === 'user' && Array.isArray(m.content) ? m.content.filter(r => r.type === 'tool_result' && msgs[i - 1].content.some(b => b.type === 'tool_use' && b.id === r.tool_use_id && b.name === name)) : []);
const ids = res => res.trips.flatMap(t => t.bookings);
const SCRIPT = [
  [/on time/, [
    () => use(think, { type: 'text', text: 'Let me look.' }, tu('find_trips', {})),
    m => { const ua = ids(R(m, 'find_trips')).find(b => /UA 110/.test(b.what));
      return use(tu('flight_status', { booking_id: ua.id }), tu('flight_status', { flight: 'dl 1500', date: TOMORROW }), tu('find_flight', { airline: 'F9', from: 'RDU', to: 'CLE', date: OUT, time: '16:04' })); },
    () => ({ stop_reason: 'end_turn', content: [
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'Frontier RDU to Cleveland afternoon flight number' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result', url: 'https://flights.example.com/f9', title: 'F9 RDU-CLE', encrypted_content: 'enc', page_age: null }] },
      { type: 'text', text: '**UA 110** is delayed 35 minutes, now leaving at 8:35 AM from gate B32.' }] }),
  ]],
  [/odd flights/, [
    () => use(tu('flight_status', { booking_id: 'h-hilton' }), tu('flight_status', { flight: 'United 110', date: TOMORROW }), tu('flight_status', { booking_id: 'f-f93073' }),
      tu('flight_status', { flight: 'UA110', date: TOMORROW }), tu('flight_status', { flight: 'DL1500', date: TOMORROW }), tu('find_flight', { airline: 'Frontier', from: 'RDU', date: OUT, time: '4pm' })),
    () => said('Those were odd.'),
  ]],
  [/tidy up/, [
    () => use(tu('find_trips', { when: 'all' })),
    m => { const b = ids(R(m, 'find_trips')), by = re => b.find(x => re.test(x.what)), trips = R(m, 'find_trips').trips;
      return use(tu('update_booking', { id: by(/AS 474/).id, changes: { dep: iso(21), arr: iso(21), seat: '12A', airline: 'Alaska' } }),
        tu('delete_bookings', { ids: [by(/Hilton/).id] }),
        tu('move_booking', { id: by(/AS 120/).id, with: by(/AS 900/).id }),
        tu('rename_trip', { trip_id: trips.find(t => t.bookings.some(x => /AS 474/.test(x.what))).id, name: 'December in San Diego' }),
        tu('add_booking', { kind: 'other', fields: { title: 'Dinner with Pat', start: iso(22) + 'T19:00', place: 'Old Town' } }),
        tu('update_booking', { id: by(/AS 434/).id, status: 'cancelled' }),
        tu('add_booking', { kind: 'hotel', fields: { name: 'No dates' } })); },
    () => said('Done: I moved your flight to SAN a day later and gave you seat 12A, deleted the Hilton, and more.'),
  ]],
  [/delete the portland/i, [
    () => use(tu('find_trips', {})),
    m => use(tu('delete_bookings', { ids: [ids(R(m, 'find_trips')).find(x => /AS 120/.test(x.what)).id] })),
    () => said('OK, I kept it.'),
  ]],
  [/delete the denver trip/i, [
    () => use(tu('find_trips', { query: 'DEN' })),
    m => use(tu('delete_trip', { trip_id: R(m, 'find_trips').trips.find(t => t.bookings.some(x => /AS 900/.test(x.what))).id })),
    () => said('Deleted the Denver trip.'),
  ]],
  [/united email/i, [
    () => use(tu('search_gmail', { query: 'from:united.com' })),
    m => use(tu('read_email', { message_id: R(m, 'search_gmail').emails[0].message_id }), tu('get_bookings', { ids: R(m, 'search_gmail').emails[0].bookings })),
    m => { const b = R(m, 'get_bookings').bookings[0]; return use(tu('show_trip', { trip_id: b.trip.id })); },
    () => said('It is your **UA 110** to Boston, seat 14A. I opened the trip.'),
  ]],
];
function claude(msgs) {
  const { question, n, last } = where(msgs);
  if (/limit please/.test(question)) return { status: 429, json: { error: 'limit' } };
  const s = SCRIPT.find(([re]) => re.test(question));
  if (!s) return { json: said('Hello! (' + question.length + ')') };
  if (last.role === 'assistant') return { json: said('(carried on)') };
  const f = s[1][Math.min(n, s[1].length - 1)];
  return { json: f(msgs) };
}

const browser = await chromium.launch();
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n  ', e.message.split('\n').slice(0, 8).join('\n   ')); } };
const texts = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

for (const [design, scheme] of [['glass', 'light'], ['vintage', 'dark'], ['glass', 'dark'], ['vintage', 'light']]) {
  const tag = 'travel (' + design + ', ' + scheme + ')', full = design === 'glass' ? scheme === 'light' : scheme === 'dark';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.addInitScript(d => { localStorage.setItem('aos.seen', JSON.stringify({ travel: '999' })); localStorage.setItem('aos.sky', 'day'); localStorage.setItem('design.travel', d); }, design);
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404|429/.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', e => problems.push(String(e)));
  page.on('console', m => { if (m.type() === 'warning' && /Ipsy|Content Security/.test(m.text())) problems.push(m.text()); });
  await ctx.route('https://gmail.googleapis.com/**', route => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/profile')) return route.fulfill({ json: { emailAddress: 'pat@example.com' } });
    if (u.pathname.endsWith('/messages')) {
      const q = u.searchParams.get('q') || '', list = /united/.test(q) ? EMAILS.filter(m => m.id === 'e1') : EMAILS;
      return route.fulfill({ json: { messages: list.map(m => ({ id: m.id, threadId: m.threadId })), resultSizeEstimate: list.length } });
    }
    const m = EMAILS.find(x => x.id === u.pathname.split('/').pop());
    return m ? route.fulfill({ json: gmailMessage(m) }) : route.fulfill({ status: 404, json: { error: { message: 'not found' } } });
  });
  await ctx.route(BASE + '/calendar/api/**', route => route.fulfill({ status: 404, json: { error: 'not-found' } }));
  const seen = { flight: [], find: [] }, sent = [];
  await ctx.route(BASE + '/travel/api/**', async route => {
    const req = route.request(), u = new URL(req.url());
    assert.equal(req.headers()['x-travel'], '1');
    if (u.pathname.endsWith('/ping')) return route.fulfill({ json: { ok: true, status: true, find: true, ai: true, models: { check: 'claude-haiku-5-5', ipsy: 'claude-sonnet-5-5' } } });
    if (u.pathname.endsWith('/flight')) { seen.flight.push(u.searchParams.get('no') + ' ' + u.searchParams.get('date')); return route.fulfill({ json: flightService(u) }); }
    if (u.pathname.endsWith('/find')) { seen.find.push(Object.fromEntries(u.searchParams)); return route.fulfill({ json: { ok: true, candidates: [{ number: '3073', to: 'CLE', local: OUT + ' 16:04' }] } }); }
    if (u.pathname.endsWith('/ipsy')) {
      const raw = req.postData();
      assert.ok(raw.startsWith('{"messages":'), 'the phone sends exactly {"messages":[...]}');
      const msgs = JSON.parse(raw).messages;
      sent.push(msgs);
      const a = claude(msgs); if (process.env.DBG) console.log('  stub:', a.status || 200, JSON.stringify(a.json).slice(0, 120));
      return route.fulfill({ status: a.status || 200, json: a.json.content ? { id: 'msg_' + sent.length, type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', ...a.json } : a.json });
    }
    return route.fulfill({ status: 404, json: { error: 'not-found' } });
  });
  await ctx.addInitScript(([bookings, qv]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('allison-travel-v1', JSON.stringify({ bookings, trips: [] }));
    localStorage.setItem('allison-travel-v1-query-v', qv);
    localStorage.setItem('allison-travel-v1-scan', String(Date.now()));            // Gmail was just read: no scan now
    localStorage.setItem('travel.token', JSON.stringify({ t: 'fake-token', exp: Date.now() + 3600e3, scope: 'https://www.googleapis.com/auth/gmail.readonly' }));
    localStorage.setItem('travel.token.ever', '1');
  }, [BOOKINGS, QUERY_V]);
  await page.goto(BASE + '/travel/');
  await page.waitForFunction(() => window.__travel && window.__travel.bookings.length === 7 && window.__travel.live['f-ua110'], null, { timeout: 10000 });   // the app's own look-up of tomorrow's flight
  const T = (f, a) => page.evaluate(f, a);
  const snapshot = () => T(() => { const t = window.__travel; return { bookings: JSON.stringify(t.bookings.map(({ updated, ...b }) => b).sort((a, b) => a.id.localeCompare(b.id))), trips: t.groupTrips().map(g => g.name + ':' + g.items.length).join(' | ') }; });
  const before = await snapshot();
  const flights0 = seen.flight.length;

  await step(tag + ': Ipsy sits above the tabs at the bottom left and covers no control, there or with the trips scrolled to the end', async () => {
    assert.equal(await page.$$eval('#ipsySlot .ipsy-btn', e => e.length), 1);
    assert.equal(await page.$eval('.ipsy-btn', (e, d) => e.classList.contains('ipsy-' + d), design), true, 'Ipsy wears the app\'s design');
    await T(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(100);
    const r = await T(() => {
      const box = e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, what: (e.id || e.className || e.tagName) + ' ' + (e.textContent || '').trim().slice(0, 20) }; };
      const me = box(document.querySelector('.ipsy-btn'));
      const others = [...document.querySelectorAll('button, a, input, [role="tab"]')].filter(e => !e.closest('#ipsySlot') && !e.closest('[hidden]') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(box);
      return { me, others, vw: innerWidth, vh: innerHeight };
    });
    assert.ok(r.me.left >= 0 && r.me.right <= r.vw && r.me.bottom <= r.vh && r.me.w >= 44, 'on screen, big enough to tap: ' + JSON.stringify(r.me));
    const hit = r.others.filter(o => overlap(r.me, o));
    assert.deepEqual(hit.map(o => o.what), [], 'nothing under Ipsy');
    await T(() => window.scrollTo(0, 0));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, design + '-' + scheme + '-trips.png') });
  });

  await step(tag + ': the chat asks once before the first question; nothing is sent before OK', async () => {
    await page.click('.ipsy-btn');
    await page.waitForSelector('.ipsy-bubble');
    await page.waitForFunction(() => document.querySelector('.ipsy-bubble').getAnimations().every(a => a.playState === 'finished'));
    assert.match(await page.textContent('.ipsy-consent'), /Anthropic.*AeroDataBox.*Undo.*whole trip/);
    assert.equal(await page.$eval('#ipsyIn', e => e.disabled), true, 'nothing is sent before OK');
    assert.equal(await page.getAttribute('#ipsyIn', 'placeholder'), 'Ask Ipsy about your trips');
    if (SHOTS && full) await page.screenshot({ path: path.join(SHOTS, design + '-' + scheme + '-consent.png') });
    await page.click('#ipsyOk');
    assert.equal(await page.$$eval('.ipsy-chip[data-ask]', e => e.length), 4);
    assert.equal(sent.length, 0);
  });

  const ask = async (q, done) => {
    const n0 = sent.length;
    await page.fill('#ipsyIn', q);
    await page.press('#ipsyIn', 'Enter');
    await page.waitForFunction(re => new RegExp(re).test(document.querySelector('.ipsy-log').textContent) && !document.querySelector('.ipsy-send').disabled, done, { timeout: 15000 });
    const mine = sent.slice(n0);
    for (let i = 1; i < mine.length; i++) assert.deepEqual(mine[i].slice(0, mine[i - 1].length), mine[i - 1], 'step ' + i + ' changed an earlier message');
    return mine;
  };

  await step(tag + ': live flights: a booking\'s and one in neither the app nor an email, through the app\'s own flight service; the departure board; the web', async () => {
    const lookups0 = await T(() => JSON.parse(localStorage.getItem('allison-travel-v1-lookups')).n);
    const mine = await ask('Is my flight tomorrow on time?', 'delayed 35 minutes');
    assert.equal(mine.length, 3);
    assert.match(mine[0][0].content[0].text, /^\[From the app: today is \w+day, .* \(\d{4}-\d\d-\d\d\)\. Travel has 7 bookings in 4 trips: 4 coming up \(the next: .*\), 1 to check\. On screen: the Upcoming trips\.\]$/);
    assert.deepEqual(mine[1][1].content[0], think, 'thinking goes back unchanged');
    const found = JSON.parse(mine[1][2].content[0].content);
    assert.equal(found.found, 4); assert.ok(found.trips.every(t => t.id && t.name && t.from && t.bookings.length));
    assert.match(found.to_check, /^1 booking need/);
    const results = mine[2][mine[2].length - 1].content.map(r => JSON.parse(r.content));
    const [ua, dl, board] = results;
    assert.equal(ua.flight, 'UA110'); assert.equal(ua.booking_id, 'f-ua110'); assert.equal(ua.legs[0].status, 'Delayed'); assert.equal(ua.legs[0].departure.gate, 'B32');
    assert.equal(ua.legs[0].departure.revised.local, TOMORROW + ' 08:35-06:00'); assert.equal(ua.legs[0].departure.predicted, undefined, 'nothing empty is sent');
    assert.equal(dl.flight, 'DL1500'); assert.equal(dl.found, true, 'a flight in neither the app nor an email');
    assert.deepEqual(board.flights, [{ flight: 'F93073', to: 'CLE', departs: OUT + ' 16:04' }]); assert.match(board.note, /One flight fits/);
    assert.deepEqual(seen.flight.slice(flights0), ['UA110 ' + TOMORROW, 'DL1500 ' + TOMORROW], 'the app\'s own flight route');
    assert.deepEqual(seen.find.at(-1), { airline: 'F9', from: 'RDU', to: 'CLE', date: OUT, time: '16:04' });
    assert.equal(await T(() => JSON.parse(localStorage.getItem('allison-travel-v1-lookups')).n), lookups0 + 2, 'counted in the phone\'s monthly allowance');
    assert.equal(await T(() => JSON.parse(localStorage.getItem('allison-travel-v1-ai')).find), 1, 'and the board\'s');
    // the booking's own flight, close to take-off: the app shows what came back
    assert.match(await page.textContent('#list .hero'), /Delayed 35 min/);
    const acts = await texts(page, '.ipsy-act');
    assert.ok(acts.includes('Looking through your trips') && acts.includes('Checking DL 1500 live') && acts.includes('Looking at the departure board') && acts.some(a => /Searching the web: Frontier RDU/.test(a)), acts.join(' | '));
    assert.deepEqual(await page.$$eval('.ipsy-change', e => e.length), 0, 'looking changes nothing');
    assert.equal(await page.locator('.ipsy-it').last().locator('b').textContent(), 'UA 110');
  });

  await step(tag + ': odd flight questions get plain errors, and the phone\'s monthly allowance of look-ups is kept to', async () => {
    const lookups = await T(() => localStorage.getItem('allison-travel-v1-lookups'));
    await T(() => localStorage.setItem('allison-travel-v1-lookups', JSON.stringify({ m: JSON.parse(localStorage.getItem('allison-travel-v1-lookups')).m, n: 249 })));
    const f0 = seen.flight.length;
    const mine = await ask('Some odd flights please', 'Those were odd');
    const res = mine.at(-1).at(-1).content;
    assert.deepEqual(res.map(r => !!r.is_error), [true, true, true, false, true, true]);
    assert.match(res[0].content, /isn’t a flight/); assert.match(res[1].content, /like UA1234/); assert.match(res[2].content, /no date in the app yet/);
    assert.match(res[4].content, /used up its live flight look-ups for this month/); assert.match(res[5].content, /2-character code/);
    assert.deepEqual(seen.flight.slice(f0), ['UA110 ' + TOMORROW], 'one look-up, the one that fit in the allowance');
    await T(v => localStorage.setItem('allison-travel-v1-lookups', v), lookups);
  });

  await step(tag + ': one question, every kind of change, each through the app\'s own checks and each with an Undo that works', async () => {
    const mine = await ask('Please tidy up my trips', 'Done: I moved');
    const res = mine.at(-1).at(-1).content;
    const by = name => res.find((r, i) => mine.at(-1).at(-2).content.filter(b => b.type === 'tool_use')[i].name === name);
    assert.equal(res.length, 7, 'every result in one message');
    const upd = JSON.parse(res[0].content);
    assert.deepEqual(upd.changed, ['dep', 'arr', 'seat']); assert.deepEqual(upd.skipped, ['airline'], 'a field it can\'t change is skipped, and said'); assert.match(upd.why, /Fields for a flight: airlineCode, flightNo/);
    assert.equal(res[6].is_error, true); assert.match(res[6].content, /Not added\. It needs: checkIn, checkOut/);
    assert.ok(by('rename_trip'));
    const after = await T(() => { const t = window.__travel, b = id => t.bookings.find(x => x.id === id);
      return { dep: b('f-as474').dep, seat: b('f-as474').seat, edited: b('f-as474').edited, hilton: !!b('h-hilton'), with: b('f-as120').tripWith, cx: b('f-as434').status,
        dinner: t.bookings.find(x => x.title === 'Dinner with Pat'), trips: t.groupTrips().map(g => g.name) }; });
    assert.equal(after.dep, iso(21) + 'T17:10', 'a day alone keeps the time'); assert.equal(after.seat, '12A'); assert.equal(after.edited, true, 'kept as the person\'s own');
    assert.equal(after.hilton, false); assert.equal(after.with, 'f-as900'); assert.equal(after.cx, 'cancelled');
    assert.deepEqual([after.dinner.type, after.dinner.place, after.dinner.start, after.dinner.edited], ['other', 'Old Town', iso(22) + 'T19:00', true]);
    assert.ok(after.trips.includes('December in San Diego'), after.trips.join(', '));
    assert.equal(after.trips.length, 3, 'Portland and Denver are one trip now: ' + after.trips.join(', '));
    const ch = await texts(page, '.ipsy-change');
    assert.equal(ch.length, 6, ch.join(' | '));
    assert.equal(ch[0], 'Changed AS 474 · RDU → SAN: departs ' + iso(21) + ' 17:10, arrives ' + iso(21) + ' 20:01, seat 12AUndo');
    assert.match(ch[1], /^Deleted Hilton San Diego Bayfront \(\d{4}-\d\d-\d\d\)Undo$/);
    assert.match(ch[2], /^Put AS 120 · RDU → PDX in the trip /); assert.match(ch[3], /^Renamed the trip “.*” to “December in San Diego”Undo$/);
    assert.match(ch[4], /^Added Dinner with Pat/); assert.match(ch[5], /^Marked AS 434 · SAN → RDU \(.*\) as canceledUndo$/);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, design + '-' + scheme + '-changes.png') });
    // each Undo, last first, until it is all as it was
    for (let i = 5; i >= 0; i--) await page.locator('.ipsy-change .ipsy-undo').nth(i).click();
    assert.equal(await page.$$eval('.ipsy-change.undone', e => e.length), 6);
    assert.deepEqual(await snapshot(), before, 'every change undone, exactly');
  });

  await step(tag + ': deleting every booking of a trip asks first, and No deletes nothing', async () => {
    const pending = ask('Delete the Portland flight', 'OK, I kept it');
    await page.waitForSelector('.ipsy-ask [data-ans="no"]', { timeout: 10000 });
    assert.match(await page.textContent('.ipsy-ask'), /Delete the whole trip .*1 booking.*won’t come back from the emails/);
    assert.equal(await T(() => !!window.__travel.bookings.find(b => b.id === 'f-as120')), true, 'nothing yet');
    if (SHOTS && full) await page.screenshot({ path: path.join(SHOTS, design + '-' + scheme + '-ask-first.png') });
    await page.click('.ipsy-ask [data-ans="no"]');
    const mine = await pending;
    assert.match(mine.at(-1).at(-1).content[0].content, /said no, so nothing was deleted/);
    assert.match(await page.textContent('.ipsy-ask'), /You said no, so nothing changed/);
    assert.deepEqual(await snapshot(), before);
  });

  await step(tag + ': deleting a whole trip: after Yes, it goes, and Undo brings it back', async () => {
    const pending = ask('Delete the Denver trip', 'Deleted the Denver trip');
    await page.waitForSelector('.ipsy-ask [data-ans="yes"]', { timeout: 10000 });
    assert.equal(await page.textContent('.ipsy-ask [data-ans="yes"]'), 'Delete the trip');
    await page.click('.ipsy-ask [data-ans="yes"]');
    await pending;
    assert.equal(await T(() => !!window.__travel.bookings.find(b => b.id === 'f-as900')), false, 'deleted');
    assert.match((await texts(page, '.ipsy-change')).at(-1), /^Deleted the trip .* \(1 booking\)Undo$/);
    await page.locator('.ipsy-change .ipsy-undo').last().click();
    assert.deepEqual(await snapshot(), before, 'Undo brings it back');
  });

  await step(tag + ': Gmail, read-only: a search, an email read with its links as their site only, and the trip shown on screen', async () => {
    const mine = await ask('What was in my United email?', 'I opened the trip');
    const search = JSON.parse(mine[1].at(-1).content[0].content);
    assert.equal(search.emails[0].subject, 'Your trip confirmation - KQ7T2M'); assert.deepEqual(search.emails[0].bookings, ['f-ua110'], 'which booking the email made');
    const read = mine[2].at(-1).content[0].content;
    assert.ok(read.includes('Manage your trip: [link to united.com]') && read.includes('Check in: [link to checkin.united.com]'), read);
    assert.ok(!/cn=KQ7T2M|pnr=|https?:/.test(read), 'never a link\'s address');
    const b = JSON.parse(mine[2].at(-1).content[1].content).bookings[0];
    assert.equal(b.seat, '14A'); assert.deepEqual(b.email, { message_id: 'e1', subject: 'Your trip confirmation - KQ7T2M', from: 'United Airlines <unitedairlines@united.com>', date: b.email.date });
    assert.equal(b.live.status, 'Delayed 35 min'); assert.equal(b.trip.id, 'f-ua110');
    assert.equal(await T(() => !document.getElementById('tripPage').hidden), true, 'the trip is open behind the chat');
    await page.click('.ipsy-x');
    await page.waitForFunction(() => document.querySelector('.ipsy-wrap').hidden);
    assert.equal(await T(() => !document.getElementById('tripPage').hidden), true);
    assert.match(await page.textContent('#tpBody'), /UA 110/);
    await page.click('#tpDone');
    await page.waitForFunction(() => document.getElementById('tripPage').hidden);
  });

  await step(tag + ': a question that fails says so and is taken back out of the conversation', async () => {
    await page.click('.ipsy-btn');
    const n0 = sent.length, len = sent[n0 - 1].length;
    await page.fill('#ipsyIn', 'limit please');
    await page.click('#ipsySend');
    await page.waitForSelector('.ipsy-err');
    assert.match((await texts(page, '.ipsy-err')).join(' | '), /a lot of questions/);
    await ask('hi', 'Hello!');
    const last = sent.at(-1);
    assert.equal(last.length, len + 2, 'the failed question is not in the next step');
    assert.ok(!JSON.stringify(last).includes('limit please'));
  });

  await step(tag + ': a change that doesn\'t check out is never made, whatever the chat asks', async () => {
    const bad = await T(() => {
      const t = window.__travel, b = t.bookings.find(x => x.type === 'flight');
      return [t.checkEdit({ op: 'set', id: b.id, field: 'from', value: 'Raleigh' }), t.checkEdit({ op: 'set', id: b.id, field: 'checkIn', value: '2026-12-01' }),
        t.checkEdit({ op: 'set', id: b.id, field: 'dep', value: '' }), t.checkEdit({ op: 'delete', id: 'nope' }), t.checkEdit({ op: 'join', id: b.id, with: b.id }),
        t.checkEdit({ op: 'rename', id: 'nope', name: 'x y' }), t.checkEdit({ op: 'drop table' })];
    });
    assert.deepEqual(bad, [null, null, null, null, null, null, null]);
  });

  await step(tag + ': the chat is kept when the app opens again (without Undo), and New chat clears it', async () => {
    await page.reload();
    await page.waitForFunction(() => window.__travel && document.querySelector('.ipsy-btn'));
    await page.click('.ipsy-btn');
    assert.ok((await texts(page, '.ipsy-me')).includes('Please tidy up my trips'));
    assert.equal(await page.$$eval('.ipsy-undo', e => e.length), 0, 'no Undo after the app was closed');
    await page.click('#ipsyNew');
    assert.equal(await page.$$eval('.ipsy-msg', e => e.length), 0);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.ipsy-wrap').hidden && getComputedStyle(document.querySelector('.ipsy-btn')).visibility === 'visible');
  });

  await step(tag + ': picking the other design in Settings changes Ipsy at once', async () => {
    const other = design === 'glass' ? 'vintage' : 'glass';
    await page.evaluate(d => window.aosDesign.set(d), other);
    assert.equal(await page.$eval('.ipsy-btn', (e, d) => e.classList.contains('ipsy-' + d), other), true);
    assert.equal(await page.$eval('.ipsy-wrap', (e, d) => e.classList.contains('ipsy-' + d), other), true);
    await page.evaluate(d => window.aosDesign.set(d), design);
  });

  await step(tag + ': no script errors and nothing blocked by the page policy', async () => {
    assert.deepEqual(problems, []);
  });
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
