// Drives Fitness's Meds page and Steps in headless Chromium at iPhone size, and
// "Sign out and erase": Meds asks you to sign in first; adding something you
// take (a name, a dose, the times of day, the days), ticking it off, as needed
// with + and −, how often it was taken, Pause, and Delete with Undo; steps from
// your iPhone (a stand-in for ../fitness/api) on the week and in the day, typed
// steps winning over the iPhone's, and the totals in Analysis; linking your
// phone in Settings; the family's Google Sheet, through aOS (the real google-sheet-sync.gs on
// fake-sheet.mjs) taking Meds and Steps and the phone then keeping only the last
// 90 days, with no graves, and fetching older days back; a Sheet not set up yet keeping them
// on the phone with no toast (aOS sets it up), and a real error toasting once a session; an app told to erase itself (GET /aOS/api/state's erase) and
// Settings > Sign out and erase clearing the phone; and aOS's Lost a phone? page.
// Dates are relative to today, so it works on any day.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node fitness/scripts/meds-steps-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fakeSheet } from './fake-sheet.mjs';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
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

const TZ = 'America/Denver';
process.env.TZ = TZ;
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const TODAY = ymd(day(0)), YESTERDAY = ymd(day(-1)), D2 = ymd(day(-2)), OLD = ymd(day(-100));
const SECRET = 'test-secret-phrase', SHEET_URL = 'https://script.google.com/macros/s/TEST/exec';
const SESSION = { token: 'made.up', user: { id: 'u1', name: 'Test', role: 'owner' }, at: 1 };

const browser = await chromium.launch();
const errors = [];
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

// One phone: its storage seeded once, aOS's and Fitness's server routes stood in for.
async function phone({ seed = null, session = SESSION, state = { storage: true, setup: true }, steps = null, sheet = null, noSheet = false, design = 'glass' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: TZ, locale: 'en-US' });
  const calls = [];
  await ctx.route('**/aOS/api/**', r => { calls.push({ url: r.request().url(), body: r.request().postData(), auth: r.request().headers().authorization }); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().endsWith('/state') ? state : { ok: true, token: 'new.token', user: SESSION.user }) }); });
  await ctx.route('**/drinks/api/**', r => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/calendar/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/fitness/api/**', r => {
    const u = r.request().url(), h = r.request().headers();
    calls.push({ url: u, body: r.request().postData(), auth: h.authorization, x: h['x-fitness'] });
    if (u.includes('/steps')) return steps ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entity: 'sensor.test_iphone_steps', points: steps }) }) : r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not-linked"}' });
    if (u.endsWith('/link')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"linked":{"entity":"sensor.test_iphone_steps"}}' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ linked: null, list: true, phones: [{ entity: 'sensor.test_iphone_steps', name: 'Test iPhone' }], links: [] }) });
  });
  // the family's Sheet, through aOS (functions/sheet/api, stood in for): who's asking comes from the session
  await ctx.route('**/sheet/api/**', r => {
    calls.push({ url: r.request().url(), body: r.request().postData() });
    const json = (b, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (noSheet) return json({ ok: false, error: 'no-sheet' }, 409);
    if (!sheet) return json({ ok: false, error: 'sheet-unreachable' }, 502);
    if (r.request().method() === 'GET') return json({ configured: true });
    return json(sheet.post(r.request().postData(), { key: SECRET, who: 'u1', name: 'Test', owner: '1' }));
  });
  // every toast the page shows (there's no Sheet sheet: a sync's trouble can only show here)
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    window.__toasts = [];
    const m = document.getElementById('toastMsg');   // each toast sets its text anew, even the same text
    if (m) new MutationObserver(rs => rs.forEach(() => window.__toasts.push(m.textContent))).observe(m, { childList: true });
  }));
  await ctx.addInitScript(({ seed, session, design, sync }) => {
    if (location.protocol !== 'http:' || window.name.includes('seeded')) return;   // once a tab, on the site (not sessionStorage: erasing clears that too)
    window.name += ' seeded';
    localStorage.setItem('aos.seen', JSON.stringify({ fitness: '999', aos: '999' }));
    localStorage.setItem('aos.sky', 'day');
    localStorage.setItem('design.fitness', design);
    if (session) localStorage.setItem('aos.session', JSON.stringify(session));
    if (seed) localStorage.setItem('allison-fitness-v1', JSON.stringify(seed));
    if (sync) localStorage.setItem('allison-fitness-v1-sync', JSON.stringify(sync));
  }, { seed, session, design, sync: null });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  return { ctx, page, calls };
}
const open = async (page, url = '/fitness/') => { await page.goto(BASE + url); await page.waitForFunction(() => window.__fitness || document.querySelector('#today')); await page.waitForTimeout(400); };
const meds = page => page.evaluate(() => JSON.parse(JSON.stringify(__fitness.data)));
const toasts = page => page.evaluate(() => [...new Set(window.__toasts || [])]);

await test('Meds asks you to sign in first, and stays off the week', async () => {
  const { ctx, page } = await phone({ session: null });
  await open(page);
  await page.evaluate(() => __fitness.setView('meds'));
  assert.ok(await page.isVisible('#mdSignin'));
  assert.match(await page.textContent('#main'), /Sign in to use Meds/);
  await page.evaluate(() => __fitness.setView('week'));
  assert.ok(!(await page.textContent('#main')).includes('Meds'));
  await ctx.close();
});

await test('add what you take, tick it off, as needed with + and −, Pause, Delete and Undo', async () => {
  const seed = { v: 2, logs: [], exercises: [], meds: [{ id: 'm1', name: 'Vitamin D', dose: '1000 IU', kind: 'supp', slots: ['am'], days: [], since: D2, updated: 1 }],
    doses: [{ id: 'a', med: 'm1', date: D2, slot: 'am', at: 1, updated: 1 }, { id: 'b', med: 'm1', date: YESTERDAY, slot: 'am', at: 1, updated: 1 }], steps: [] };
  const { ctx, page } = await phone({ seed, design: 'vintage' });
  await open(page);
  await page.click('#viewBtn'); await page.click('[data-view="meds"]');
  assert.match(await page.textContent('#main'), /0 of 1 taken/);
  assert.match(await page.textContent('#main'), /7 days 100% · 30 days 100% · 2 days in a row/);
  // Add one, twice a day.
  await page.click('#fab');
  await page.fill('#mdName', 'Metformin'); await page.fill('#mdDose', '500 mg');
  await page.click('[data-mslot="am"]'); await page.click('[data-mslot="pm"]');
  assert.equal(await page.getAttribute('[data-mkind="med"]', 'aria-checked'), 'true');
  await shot(page, 'meds-editor');
  await page.click('#mdSave');
  await page.waitForSelector('#medSheet', { state: 'hidden' });
  assert.match(await page.textContent('#main'), /0 of 3 taken/);
  await page.click('[data-take="m1"][data-slot="am"]');
  const metf = (await meds(page)).meds.find(m => m.name === 'Metformin');
  assert.deepEqual([metf.dose, metf.slots, metf.since, metf.kind], ['500 mg', ['am', 'pm'], TODAY, 'med']);
  await page.click(`[data-take="${metf.id}"][data-slot="pm"]`);
  assert.match(await page.textContent('#main'), /2 of 3 taken/);
  assert.match(await page.textContent('[data-take="m1"]'), /Taken \d{1,2}:\d{2} [AP]M/);
  assert.match(await page.textContent('#main'), /3 days in a row/, 'Vitamin D done today too');
  // Untick.
  await page.click(`[data-take="${metf.id}"][data-slot="pm"]`);
  assert.match(await page.textContent('#main'), /1 of 3 taken/);
  await page.click(`[data-take="${metf.id}"][data-slot="am"]`);
  // As needed.
  await page.click('[data-madd]'); await page.fill('#mdName', 'Ibuprofen'); await page.click('[data-mprn]'); await page.click('#mdSave');
  const ib = (await meds(page)).meds.find(m => m.name === 'Ibuprofen');
  assert.equal(ib.prn, true);
  await page.click(`[data-prn="${ib.id}"]`); await page.click(`[data-prn="${ib.id}"]`);
  assert.match(await page.textContent('#main'), /2 times/);
  await page.click(`[data-prnless="${ib.id}"]`);
  assert.match(await page.textContent('#main'), /1 time:/);
  assert.match(await page.textContent('#main'), /2 of 3 taken/, 'as needed is never "due"');
  await shot(page, 'meds-day');
  // Yesterday, and back.
  await page.click('[data-mday="-1"]');
  assert.match(await page.textContent('#main'), /Yesterday/);
  assert.match(await page.textContent('#main'), /1 of 1 taken/, 'Metformin wasn\'t on the list yet');
  await page.click('#todayBtn');
  // Pause, then Delete and Undo.
  await page.click(`[data-medit="${metf.id}"]`); await page.click('#mdPause');
  assert.match(await page.textContent('#main'), /1 of 1 taken/);
  assert.match(await page.textContent('#main'), /Paused · Medication/);
  await page.click(`[data-medit="${metf.id}"]`); await page.click('#mdDel');
  assert.ok(!(await meds(page)).meds.some(m => m.id === metf.id));
  assert.ok((await meds(page)).doses.some(x => x.med === metf.id), 'the days it was taken stay');
  await page.click('#toastAct');
  assert.ok((await meds(page)).meds.some(m => m.id === metf.id));
  // Kept on the phone.
  await page.reload(); await page.waitForTimeout(400);
  assert.equal(await page.textContent('#viewName'), 'Meds');
  assert.equal((await meds(page)).meds.length, 3);
  await ctx.close();
});

await test('steps: your iPhone\'s on the week and the day; typed in wins; the goal; Analysis', async () => {
  const points = [[day(-2).getTime() - 30 * 60e3 + 12 * 3600e3 - 60e3, 12500], [day(-1).getTime() + 8 * 3600e3, 5000], [Date.now() - 60e3, 4321]];
  const { ctx, page, calls } = await phone({ seed: { v: 2, logs: [], exercises: [], meds: [], doses: [], steps: [{ id: YESTERDAY, date: YESTERDAY, n: 6000, src: 'you', updated: 1 }] }, steps: points });
  await open(page);
  await page.waitForFunction(() => __fitness.data.steps.length === 3);
  const s = (await meds(page)).steps;
  assert.equal(s.find(x => x.date === TODAY).n, 4321);
  assert.equal(s.find(x => x.date === YESTERDAY).n, 6000, 'typed in: the iPhone\'s 5,000 doesn\'t replace it');
  assert.equal(s.find(x => x.date === YESTERDAY).src, 'you');
  const fx = calls.find(c => c.url.includes('/fitness/api/steps'));
  assert.equal(fx.auth, 'Bearer made.up'); assert.equal(fx.x, '1');
  assert.match(fx.url, /days=10/, 'the whole 10 days, the first time today');
  await page.evaluate(() => __fitness.setView('week'));
  assert.match(await page.textContent(`[data-day="${TODAY}"]`), /4\.3K/);
  assert.match(await page.getAttribute(`[data-day="${TODAY}"]`, 'aria-label'), /4,321 steps/);
  // The day: type a number in.
  await page.evaluate(d => __fitness.openDay(d), TODAY);
  assert.equal(await page.inputValue('#fxSteps'), '4321');
  assert.match(await page.textContent('#dayBody'), /From your iPhone/);
  await page.fill('#fxSteps', '10,250'); await page.press('#fxSteps', 'Enter');
  await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(d => { const x = __fitness.data.steps.find(y => y.date === d); return [x.n, x.src]; }, TODAY), [10250, 'you']);
  assert.match(await page.textContent('#dayBody'), /Goal met/);
  await shot(page, 'steps-day');
  // Cleared: gone, and the iPhone's fills it in again.
  await page.fill('#fxSteps', ''); await page.press('#fxSteps', 'Enter');
  assert.equal(await page.evaluate(d => __fitness.data.steps.some(y => y.date === d), TODAY), false);
  await page.evaluate(() => __fitness.takeSteps([[Date.now(), 4400]]));
  assert.equal(await page.evaluate(d => __fitness.data.steps.find(y => y.date === d).n, TODAY), 4400);
  await page.keyboard.press('Escape');
  // A lower goal, in Settings.
  await page.click('#setBtn'); await page.waitForSelector('#stGoal');
  await page.selectOption('#stGoal', '4000');
  await page.keyboard.press('Escape');
  assert.ok(await page.isVisible(`[data-day="${TODAY}"] .stp.met`));
  await page.evaluate(() => __fitness.setView('analysis'));
  assert.match(await page.textContent('#main'), /Steps a day/);
  assert.match(await page.textContent('#main'), /Days at goal \(4K\)/);
  await shot(page, 'steps-analysis');
  await ctx.close();
});

await test('Settings: link your own iPhone', async () => {
  const { ctx, page, calls } = await phone();
  await open(page);
  await page.click('#setBtn');
  await page.waitForSelector('[data-plink="sensor.test_iphone_steps"]');
  assert.match(await page.textContent('#setBody'), /Test iPhone/);
  await page.click('[data-plink="sensor.test_iphone_steps"]');
  await page.waitForTimeout(300);
  const link = calls.find(c => c.url.endsWith('/fitness/api/link'));
  assert.deepEqual(JSON.parse(link.body), { entity: 'sensor.test_iphone_steps' });
  assert.match(await page.textContent('#toastMsg'), /Linked/);
  await shot(page, 'settings-steps');
  await ctx.close();
});

await test('the family Sheet takes Meds and Steps; the phone keeps only the last 90 days, with no graves, and fetches older ones back', async () => {
  const sheet = fakeSheet(undefined, SECRET);
  const seed = { v: 2, logs: [{ id: 'w1', date: OLD, group: 'chest', exercise: 'Dip', weight: 0, reps: 10, sets: 3, updated: 5 }], exercises: [],
    meds: [{ id: 'm1', name: 'Vitamin D', dose: '1000 IU', kind: 'supp', slots: ['am'], days: [], since: OLD, updated: 5 }],
    doses: [{ id: 'old', med: 'm1', date: OLD, slot: 'am', at: 1, updated: 5 }, { id: 'new', med: 'm1', date: YESTERDAY, slot: 'am', at: 1, updated: 5 }],
    steps: [{ id: OLD, date: OLD, n: 9000, src: 'you', updated: 5 }, { id: YESTERDAY, date: YESTERDAY, n: 7000, src: 'you', updated: 5 }] };
  const { ctx, page, calls } = await phone({ seed, sheet });
  await open(page);
  await page.waitForFunction(() => __fitness.data.doses.length === 1, null, { timeout: 8000 });
  const d = await meds(page);
  assert.deepEqual(d.doses.map(x => x.id), ['new']);
  assert.deepEqual(d.steps.map(x => x.date), [YESTERDAY]);
  assert.equal(d.logs.length, 0, 'a workout over 90 days old: in the Sheet only');
  assert.equal(d.meds.length, 1, 'your list stays');
  assert.deepEqual(Object.keys(await page.evaluate(() => __fitness.graves())), [], 'no graves: the Sheet keeps them');
  const back = sheet.post({ action: 'sync', graves: {} }, { key: SECRET, who: 'u1', owner: '1' });
  assert.deepEqual(back.doses.map(x => x.id).sort(), ['new', 'old'], 'the Sheet has both');
  assert.equal(sheet.tab('Steps').length, 3);
  // A second sync doesn't bring the old ones back.
  await page.evaluate(() => __fitness.sync(true));
  assert.deepEqual((await meds(page)).doses.map(x => x.id), ['new']);
  // looking back at that week: it comes from the Sheet
  await page.evaluate(d => { __fitness.st.view = 'week'; __fitness.st.week = __fitness.weekStartOf(d); __fitness.render(); }, OLD);
  await page.waitForFunction(() => __fitness.data.logs.some(x => x.id === 'w1'), null, { timeout: 8000 });
  assert.match(await page.textContent(`[data-day="${OLD}"]`), /Chest/);
  // and having looked back doesn't set off sync after sync (older days aren't "new on this phone")
  const before = calls.filter(c => c.url.includes('/sheet/api/')).length;
  await page.evaluate(() => __fitness.sync(false)); await page.waitForTimeout(2500);
  assert.ok(calls.filter(c => c.url.includes('/sheet/api/')).length - before <= 2, 'one sync, not a loop');
  assert.ok(+(await page.evaluate(() => localStorage.getItem('allison-fitness-v1-sync-at'))) > 0, 'in the family’s Google Sheet');
  assert.equal(await page.$('#syncBtn'), null, 'no Sheet button: aOS sets the Sheet up');
  await ctx.close();
});

await test('a family Sheet not set up yet: everything stays on the phone, with no toast (the owner sets it up in aOS)', async () => {
  const seed = { v: 2, logs: [], exercises: [], meds: [{ id: 'm1', name: 'Zinc', slots: [], days: [], since: OLD, updated: 5 }], doses: [{ id: 'old', med: 'm1', date: OLD, slot: 'day', at: 1, updated: 5 }], steps: [] };
  const { ctx, page, calls } = await phone({ seed, noSheet: true });
  await open(page);
  await page.waitForTimeout(1500);
  assert.ok(calls.some(c => c.url.includes('/sheet/api/')), 'it tried, through aOS');
  assert.deepEqual((await meds(page)).doses.map(x => x.id), ['old'], 'kept: nothing has it yet');
  await page.evaluate(() => __fitness.sync(false)); await page.waitForTimeout(300);
  assert.deepEqual(await toasts(page), [], 'nobody is nagged to set up the Sheet');
  assert.equal(await page.evaluate(() => localStorage.getItem('allison-fitness-v1-sync-at')), null, 'not synced');
  await ctx.close();
});

await test('a Sheet that can\'t be reached: one toast a session, however many quiet syncs', async () => {
  const seed = { v: 2, logs: [], exercises: [], meds: [], doses: [], steps: [] };
  const { ctx, page, calls } = await phone({ seed });   // no Sheet behind aOS: sheet-unreachable
  await open(page);
  await page.waitForFunction(() => (window.__toasts || []).length > 0, null, { timeout: 8000 });
  for (let i = 0; i < 3; i++) { await page.evaluate(() => __fitness.sync(false)); await page.waitForTimeout(200); }
  assert.ok(calls.filter(c => c.url.includes('/sheet/api/')).length >= 4, 'it kept trying');
  assert.deepEqual(await toasts(page), ['Couldn’t reach the Sheet. Trying again later.']);
  assert.equal((await page.evaluate(() => window.__toasts)).length, 1, 'once');
  await ctx.close();
});

await test('told to erase (you erased your other devices): the app erases what it keeps on the phone', async () => {
  const seed = { v: 2, logs: [{ id: 'w1', date: TODAY, group: 'chest', exercise: 'Dip', weight: 0, reps: 10, sets: 3, updated: 5 }], exercises: [], meds: [{ id: 'm1', name: 'Zinc', slots: [], days: [], since: TODAY, updated: 5 }], doses: [], steps: [] };
  const { ctx, page, calls } = await phone({ seed, state: { storage: true, setup: true, user: null, erase: true } });
  await ctx.addInitScript(() => { if (location.protocol !== 'http:' || window.name.includes('idb')) return; window.name += ' idb'; indexedDB.open('allison-fitness', 1).onupgradeneeded = e => e.target.result.createObjectStore('kv').put({ url: 'https://script.google.com/x', secret: 's' }, 'sync'); });
  await page.goto(BASE + '/fitness/');
  await page.waitForSelector('#aos-off', { timeout: 8000 });
  assert.match(await page.textContent('#aos-off'), /Signed out and erased/);
  assert.equal(calls.find(c => c.url.endsWith('/aOS/api/state')).auth, 'Bearer made.up', 'asked with this app\'s session');
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
  assert.equal(await page.evaluate(() => __fitness.data.logs.length + __fitness.data.meds.length), 0);
  // Its database (the Sheet link's backup copy): Fitness opens it again on the reload, empty.
  assert.equal(await page.evaluate(() => new Promise(ok => { const r = indexedDB.open('allison-fitness', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').count(); q.onsuccess = () => ok(q.result); }; })), 0);
  await shot(page, 'erased');
  await page.click('#aos-off .o-go');
  assert.equal(await page.$('#aos-off'), null);
  await ctx.close();
});

await test('signed in and not asked to erase: nothing is erased', async () => {
  const seed = { v: 2, logs: [], exercises: [], meds: [{ id: 'm1', name: 'Zinc', slots: [], days: [], since: TODAY, updated: 5 }], doses: [], steps: [] };
  const { ctx, page } = await phone({ seed, state: { storage: true, setup: true, user: SESSION.user } });
  await open(page); await page.waitForTimeout(800);
  assert.equal((await meds(page)).meds.length, 1);
  assert.equal(await page.$('#aos-off'), null);
  await ctx.close();
});

await test('Settings > Sign out and erase clears this phone', async () => {
  const seed = { v: 2, logs: [], exercises: [], meds: [{ id: 'm1', name: 'Zinc', slots: [], days: [], since: TODAY, updated: 5 }], doses: [], steps: [] };
  const { ctx, page } = await phone({ seed });
  await open(page);
  await page.click('#setBtn'); await page.click('#setErase');
  assert.match(await page.textContent('#setErase'), /Tap again to sign out and erase/, 'it asks again');
  await page.click('#setErase');
  await page.waitForSelector('#aos-off', { timeout: 8000 });
  assert.match(await page.textContent('#aos-off'), /Fitness has erased what it kept on this phone/);
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
  await ctx.close();
});

await test('aOS: Lost a phone? step by step, and Sign out and erase my other devices', async () => {
  const { ctx, page, calls } = await phone({ state: { storage: true, setup: true, user: SESSION.user } });
  await page.goto(BASE + '/aOS/#lost-phone');
  await page.waitForSelector('#lEraseOthers', { timeout: 8000 });
  const text = await page.textContent('.page.on');
  for (const s of ['Find My', 'Erase This Device', 'Sign out and erase my other devices', 'Lost your only phone?', 'Erase All Content and Settings']) assert.ok(text.includes(s), s);
  assert.ok(!text.includes('What erasing can\'t do'), 'no explanations under the steps');
  await shot(page, 'aos-lost');
  await page.click('#lEraseOthers');
  await page.waitForFunction(() => /Done/.test(document.querySelector('#lErr').textContent));
  const c = calls.find(x => x.url.endsWith('/aOS/api/signout-others'));
  assert.deepEqual(JSON.parse(c.body), { erase: true });
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('aos.session'))).token, 'new.token', 'this device carries on with a fresh session');
  assert.ok(await page.isVisible('[data-erase]') || (await page.textContent('#lFam')).length > 0, 'the owner\'s list');
  await ctx.close();
});

assert.deepEqual(errors, [], 'no script errors');
await browser.close(); server.close();
console.log('\n' + n + ' tests passed');
