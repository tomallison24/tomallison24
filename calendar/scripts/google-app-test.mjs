// Your own Google calendar in Calendar, in the app (headless Chromium at iPhone size): Pat has connected theirs
// (seeded, as the sign-in leaves it: sealed in the accounts' KV) and Sam hasn't. Calendar's server code is the real
// one (functions/calendar/api google/*, server/gcal.js) on an in-memory KV, with a stand-in for Google. Checks:
// Pat sees their events in Personal, in full, with Open in Google Calendar; Settings > Connected accounts says which
// account and has Share with the family, off; Sam sees nothing of Pat's until Pat switches it on, then sees Pat's
// events in Shared with you, a private one only as Busy, no notes, and no Add to the Family calendar; each layer's
// switch hides it; Ipsy is never told about a personal event open on the screen.
//   node calendar/scripts/google-app-test.mjs [repo root]
process.env.TZ = 'America/Denver';
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const { onRequest: calendarApi } = await import(path.join(ROOT, 'functions/calendar/api/[[route]].js'));
const { onRequest: aosApi } = await import(path.join(ROOT, 'functions/aOS/api/[[route]].js'));
const { issue, putJSON, getJSON } = await import(path.join(ROOT, 'server/auth.js'));
const { seal, SCOPES } = await import(path.join(ROOT, 'server/gmail.js'));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css', '.woff2': 'font/woff2' };
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

const m = new Map();
const db = { get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, String(v)); }, delete: async k => { m.delete(k); },
  list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
const ENV = { ACCOUNTS: db, GOOGLE_CLIENT_SECRET: 'made-up-secret' };
await db.put('owner', 'u1');
await putJSON(db, 'user:u1', { id: 'u1', name: 'Pat', role: 'owner', creds: [], created: 1 });
await putJSON(db, 'user:u2', { id: 'u2', name: 'Sam', role: 'member', creds: [], created: 2 });
const pat = await issue(db, 'u1'), sam = await issue(db, 'u2');
await putJSON(db, 'gc:u1', { email: 'pat@example.com', at: Date.now(), sealed: await seal(ENV, 'RT-pat'), share: false });

// Pat's Google calendar: tomorrow's dentist at 3, a private appointment the day after, and a two-day conference
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const at = (n, h) => { const d = day(n); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const EVENTS = [
  { id: 'e1', summary: 'Dentist', location: '12 Main St', description: 'Bring the card', htmlLink: 'https://www.google.com/calendar/event?eid=e1', start: { dateTime: at(1, 15) }, end: { dateTime: at(1, 16) } },
  { id: 'e2', summary: 'Therapy', location: 'Clinic', description: 'private notes', visibility: 'private', start: { dateTime: at(2, 9) }, end: { dateTime: at(2, 10) } },
  { id: 'e3', summary: 'Conference', start: { date: ymd(day(3)) }, end: { date: ymd(day(5)) } },
];
const google = async (url, opts = {}) => {
  const u = String(url), json = o => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (u === 'https://oauth2.googleapis.com/token') return json({ access_token: 'AT-pat', expires_in: 3599, scope: SCOPES.calendar });
  if (u.startsWith('https://www.googleapis.com/calendar/v3/calendars/primary/events?')) { assert.equal(opts.headers.Authorization, 'Bearer AT-pat'); return json({ items: EVENTS }); }
  throw new Error('unexpected ' + u);
};

const browser = await chromium.launch();
const errors = [];
async function open(token, user, { look = 'vintage' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'America/Denver', locale: 'en-US' });
  await ctx.route('**/calendar/api/**', async route => {
    const rq = route.request(), u = new URL(rq.url()), sub = u.pathname.split('/calendar/api/')[1];
    if (!sub.startsWith('google')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sub === 'ping' ? { ok: true, configured: true, calendar: { name: 'Family', color: '#FF2968' } } : { ok: true, items: [], calendar: { name: 'Family' } }) });
    const res = await calendarApi({ request: new Request(u.href, { method: rq.method(), headers: rq.headers(), body: rq.method() === 'POST' ? rq.postData() : undefined }), params: { route: sub.split('/') }, env: ENV }, google);
    route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
  });
  await ctx.route('**/aOS/api/**', async route => {
    const rq = route.request(), u = new URL(rq.url());
    const res = await aosApi({ request: new Request(u.href, { method: rq.method(), headers: rq.headers(), body: rq.method() === 'POST' ? rq.postData() : undefined }), params: { route: u.pathname.split('/aOS/api/')[1].split('/') }, env: ENV });
    route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
  });
  await ctx.route(/open-meteo|gmail\.googleapis|bigdatacloud|accounts\.google/, route => route.fulfill({ status: 404, body: '' }));
  await ctx.addInitScript(([token, user, look]) => {
    localStorage.setItem('aos.seen', JSON.stringify({ aos: '999', calendar: '999' }));
    localStorage.setItem('aos.signin.asked', '1');
    localStorage.setItem('aos.gmail.on', '1');
    localStorage.setItem('design.calendar', look);
    localStorage.setItem('aos.session', JSON.stringify({ token, user, at: Date.now() }));
  }, [token, user, look]);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(user.name + ': ' + e.message));
  await page.goto(BASE + '/calendar/');
  return { ctx, page };
}
const occ = page => page.evaluate(() => window.__calendar.st.occ.filter(x => x.kind === 'google' || x.kind === 'gshared').map(x => ({ kind: x.kind, title: x.title, sub: x.sub, notes: x.notes || '', who: x.who || '', allDay: x.allDay, startDate: x.startDate, endDate: x.endDate })));
const until = async (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 8000 });
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

const P = await open(pat, { id: 'u1', name: 'Pat', role: 'owner' });
await test('Pat sees their own Google calendar in Personal, in full', async () => {
  await until(P.page, () => window.__calendar.st.occ.some(x => x.kind === 'google'));
  const list = await occ(P.page);
  assert.deepEqual(list.map(x => x.title), ['Conference', 'Dentist', 'Therapy']);
  const dentist = list.find(x => x.title === 'Dentist');
  assert.equal(dentist.sub, '12 Main St'); assert.equal(dentist.notes, 'Bring the card'); assert.equal(dentist.startDate, ymd(day(1)));
  const conf = list.find(x => x.title === 'Conference');
  assert.equal(conf.allDay, true); assert.equal(conf.startDate, ymd(day(3))); assert.equal(conf.endDate, ymd(day(5)));
});

await test('its sheet: the place, notes, Open in Google Calendar, and Add to the Family calendar', async () => {
  await P.page.evaluate(() => window.__calendar.openEvent(window.__calendar.st.occ.find(x => x.title === 'Dentist')));
  const body = await P.page.locator('#evBody').innerText();
  assert.match(body, /Personal/i); assert.match(body, /12 Main St/); assert.match(body, /Bring the card/);
  assert.match(body, /Open in Google Calendar/); assert.match(body, /Add to the Family calendar/);
  assert.equal(await P.page.locator('#evBody a', { hasText: 'Open in Google Calendar' }).getAttribute('href'), 'https://www.google.com/calendar/event?eid=e1');
  await P.page.evaluate(() => window.__calendar.openEvent(window.__calendar.st.occ.find(x => x.title === 'Therapy')));
  assert.match(await P.page.locator('#evBody').innerText(), /Private in Google[\s\S]*Only you see it/);
  await P.page.locator('#evActs [data-close]').click();
});

await test('Settings > Connected accounts: the account, read-only, and Share with the family, off', async () => {
  await P.page.locator('#setBtn').click();
  await until(P.page, () => !!document.getElementById('stGcalShare'));
  const text = await P.page.locator('#stBody').innerText();
  assert.match(text, /pat@example\.com, read-only, signed in until/);
  assert.equal(await P.page.locator('#stGcalShare').getAttribute('aria-checked'), 'false');
  assert.match(text, /Disconnect Google Calendar/);
  assert.match(text, /Personal[\s\S]*Your own Google calendar, seen only by you\./);
});

const S = await open(sam, { id: 'u2', name: 'Sam', role: 'member' }, { look: 'glass' });
await test('Sam sees nothing of Pat\'s while it isn\'t shared, and is offered Connect Google Calendar', async () => {
  await until(S.page, () => window.__calendar.st.google && window.__calendar.st.googleState === 'ok');
  assert.deepEqual(await occ(S.page), []);
  await S.page.locator('#setBtn').click();
  await until(S.page, () => !!document.getElementById('stGcalIn'));
  assert.match(await S.page.locator('#stBody').innerText(), /Nobody shares one with you yet\./);
  await S.page.locator('#stBody [data-close], #setSheet [data-close]').first().click().catch(() => {});
});

await test('Pat switches on Share with the family', async () => {
  await P.page.locator('#stGcalShare').click();
  await until(P.page, () => document.getElementById('stGcalShare').getAttribute('aria-checked') === 'true');
  await P.page.waitForTimeout(300);
  assert.equal((await getJSON(db, 'gc:u1')).share, true);
  assert.match(await P.page.locator('#stBody').innerText(), /Your Google calendar, shared with the family\./);
});

await test('now Sam sees Pat\'s, as the family sees it: a private event only as Busy, no notes', async () => {
  await S.page.reload();
  await until(S.page, () => window.__calendar.st.occ.some(x => x.kind === 'gshared'));
  const list = await occ(S.page);
  assert.deepEqual(list.map(x => x.title), ['Conference', 'Dentist', 'Busy']);
  assert.ok(list.every(x => x.kind === 'gshared' && x.who === 'Pat' && !x.notes));
  assert.equal(list.find(x => x.title === 'Busy').sub, '');
  const all = JSON.stringify(await S.page.evaluate(() => window.__calendar.st.google));
  for (const w of ['Therapy', 'Clinic', 'private notes', 'Bring the card', 'pat@example.com']) assert.ok(!all.includes(w), w);
});

await test('Sam\'s sheet for it: whose it is, no Google link and no Add to the Family calendar; Ipsy isn\'t told', async () => {
  await S.page.evaluate(() => window.__calendar.openEvent(window.__calendar.st.occ.find(x => x.title === 'Dentist')));
  const body = await S.page.locator('#evBody').innerText();
  assert.match(body, /Pat’s calendar/i); assert.match(body, /12 Main St/);
  assert.doesNotMatch(body, /Open in Google Calendar|Add to the Family calendar|Bring the card/);
  await S.page.locator('#evActs [data-close]').click();
  await S.page.locator('#setBtn').click();
  await until(S.page, () => /From Pat\./.test(document.getElementById('stBody').innerText));
});

await test('each layer\'s switch hides it', async () => {
  await S.page.locator('#stBody [data-layer="gshared"]').click();
  assert.deepEqual(await occ(S.page), []);
  await S.page.locator('#stBody [data-layer="gshared"]').click();
  await until(S.page, () => window.__calendar.st.occ.some(x => x.kind === 'gshared'));
  await P.page.locator('#stBody [data-layer="google"]').click();
  assert.deepEqual(await occ(P.page), []);
});

await test('Pat disconnects: gone for both', async () => {
  const out = P.page.locator('#stGcalOut');
  await out.click(); await out.click();
  await until(P.page, () => !!document.getElementById('stGcalIn'));
  assert.equal(await getJSON(db, 'gc:u1'), null);
  await S.page.reload();
  await until(S.page, () => window.__calendar.st.googleState === 'ok');
  assert.deepEqual(await occ(S.page), []);
});

await browser.close(); server.close();
assert.deepEqual(errors, [], 'no page errors');
console.log('\n' + n + ' Google calendar app tests passed');
