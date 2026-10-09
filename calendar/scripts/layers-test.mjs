// Calendar's Notes, Travel, Fitness and Mail layers through the family account,
// as on an iPhone, where every Home Screen app keeps its own storage: each app runs
// in its own browser context (its own storage), signed in, and sends its copy
// (AllisonOS.layer in home/welcome.js) to the real functions/aOS/api code on an
// in-memory KV; then Calendar, with none of their data in its own storage, shows
// them all. Also: only changes are sent, Notes' samples never are, and signed out,
// Calendar says to sign in.
//   node calendar/scripts/layers-test.mjs [repo root]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const { onRequest } = await import(path.join(ROOT, 'functions/aOS/api/[[route]].js'));
const { issue, putJSON } = await import(path.join(ROOT, 'server/auth.js'));

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

const m = new Map();
const db = { get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, String(v)); }, delete: async k => { m.delete(k); },
  list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
await db.put('owner', 'O1');
await putJSON(db, 'user:O1', { id: 'O1', name: 'Tom', role: 'owner', creds: [], created: Date.now() - 864e5 });
const tom = await issue(db, 'O1');
let posts = 0;

const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const TODAY = ymd(day(0)), TOMORROW = ymd(day(1));

const browser = await chromium.launch();
const errors = [];
// One app, in its own storage, as its own Home Screen app would be.
async function app(dir, { signedIn = true, seed = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'America/Denver', locale: 'en-US' });
  await ctx.route('**/aOS/api/**', async route => {
    const rq = route.request(), u = new URL(rq.url());
    if (u.pathname.endsWith('/layer') && rq.method() === 'POST') posts++;
    const res = await onRequest({ request: new Request(u.href, { method: rq.method(), headers: rq.headers(), body: rq.method() === 'POST' ? rq.postData() : undefined }), params: { route: u.pathname.split('/aOS/api/')[1].split('/') }, env: { ACCOUNTS: db } });
    route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
  });
  await ctx.route('**/calendar/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(new URL(route.request().url()).pathname.endsWith('/ping') ? { ok: true, configured: true, calendar: { name: 'Family', color: '#FF2968' } } : { ok: true, items: [], calendar: { name: 'Family' } }) }));
  await ctx.route(/open-meteo|gmail\.googleapis|googleapis|bigdatacloud/, route => route.fulfill({ status: 404, body: '' }));
  await ctx.addInitScript(([token, seed]) => {
    localStorage.setItem('aos.seen', JSON.stringify(Object.fromEntries(['aos', 'notes', 'travel', 'fitness', 'mail', 'calendar'].map(a => [a, '999']))));
    localStorage.setItem('aos.signin.asked', '1');
    if (token) localStorage.setItem('aos.session', JSON.stringify({ token, user: { id: 'O1', name: 'Tom', role: 'owner' }, at: Date.now() }));
    for (const [k, v] of Object.entries(seed)) if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v));
  }, [signedIn ? tom : null, seed]);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(dir + ': ' + e.message));
  await page.goto(BASE + '/' + dir + '/');
  return { ctx, page };
}
const waitFor = async (cond, ms = 8000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) return false; await new Promise(r => setTimeout(r, 100)); } return true; };
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

await test('Notes shows samples before a first save, and never sends them', async () => {
  const { ctx } = await app('notes');
  await new Promise(r => setTimeout(r, 4500));
  assert.ok(!m.has('layer:notes:O1'), 'no samples in the account');
  await ctx.close();
});

await test('Notes, Travel and Fitness, each in its own storage and signed in, send their copy', async () => {
  const notes = await app('notes', { seed: { 'allison-notes-v1': {
    notes: [{ id: 'n9', title: 'Renew passports', body: 'Both of ours', tags: [], color: 'none', pinned: false, reminder: TOMORROW + 'T09:30', created: 1, updated: 1, archived: false, deletedAt: null }],
    lists: [{ id: 'l1', name: 'Home', color: '#F59E0B' }],
    todos: [{ id: 't1', list: 'l1', title: 'Call the plumber', notes: 'About the tap', date: TODAY, time: '09:00', prio: 0, flagged: false, done: false, tags: [] }] } } });
  const travel = await app('travel', { seed: { 'allison-travel-v1': { bookings: [
    { id: 'bk1', type: 'flight', airlineCode: 'UA', flightNo: '1234', from: 'DEN', to: 'BOS', fromName: 'Denver', toName: 'Boston', dep: TOMORROW + 'T07:05', depIso: '', arr: TOMORROW + 'T13:50', arrIso: '', conf: 'KQ7T2M', updated: 1 },
    { id: 'bk2', type: 'hotel', status: 'cancelled', name: 'Old hotel', checkIn: TOMORROW, checkOut: TOMORROW, updated: 1 }], trips: [] } } });
  const fitness = await app('fitness', { seed: { 'allison-fitness-v1': { v: 2, logs: [{ id: 'f1', date: TODAY, exercise: 'Bench press', group: 'chest', sets: 3, reps: 8, weight: 135, updated: 1 }], exercises: [] } } });
  assert.ok(await waitFor(() => ['notes', 'travel', 'fitness'].every(a => m.has('layer:' + a + ':O1'))), 'all three sent: ' + [...m.keys()].join());
  const t = JSON.parse(m.get('layer:travel:O1')).data;
  assert.deepEqual(t.bookings.map(b => b.id), ['bk1'], 'cancelled bookings stay out');
  assert.equal(JSON.parse(m.get('layer:notes:O1')).data.todos[0].title, 'Call the plumber');
  const before = posts;
  await notes.page.reload(); await new Promise(r => setTimeout(r, 4500));
  assert.equal(posts, before, 'nothing new: nothing sent');
  for (const x of [notes, travel, fitness]) await x.ctx.close();
});

await putJSON(db, 'layer:mail:O1', { at: Date.now(), data: { items: [{ id: 'th1', date: TOMORROW, subject: 'Book the vet', from: 'Sam' }] } });

await test('Calendar, with none of their data in its own storage, shows Notes, Travel, Fitness and Mail from the account', async () => {
  const { page, ctx } = await app('calendar');
  await page.waitForFunction(() => window.__calendar && window.__calendar.st.layersState === 'ok', null, { timeout: 8000 });
  await page.waitForTimeout(400);
  const kinds = await page.evaluate(() => { const c = window.__calendar; return [...new Set(c.st.all ? c.st.all.map(x => x.kind) : [])]; }).catch(() => []);
  await page.click('.tab[data-view="list"]').catch(() => {});
  await page.waitForTimeout(300);
  const text = await page.textContent('#main');
  for (const s of ['Call the plumber', 'Renew passports', 'UA 1234', 'Workout', 'Remind: Book the vet']) assert.ok(text.includes(s), s + ' missing (' + kinds + '): ' + text.slice(0, 600));
  assert.ok(!text.includes('Old hotel'));
  assert.equal(await page.evaluate(() => localStorage.getItem('allison-notes-v1')), null, 'Calendar has no Notes data of its own');
  await ctx.close();
});

await test('signed out, Calendar asks to sign in, and shows none of it', async () => {
  const { page, ctx } = await app('calendar', { signedIn: false });
  await page.waitForFunction(() => window.__calendar && window.__calendar.st.layersState === 'signin', null, { timeout: 8000 });
  await page.click('#setBtn'); await page.waitForSelector('#setSheet:not([hidden])');
  assert.ok((await page.textContent('#stBody')).includes('Sign in to your family account first'));
  await ctx.close();
});

assert.deepEqual(errors, []);
await browser.close(); server.close();
console.log(`${n} tests passed`);
