// Drives Clock in headless Chromium at iPhone size, as a person would, in each of its two
// designs (Vintage in Light, Standard in Dark), with the page's clock held at a made-up moment (Wednesday, March 11, 2026,
// 8:00 AM in New York) and moved on by the test, so it works on any day and at any hour:
//   - World Clock: a city found and added, its time and how far ahead it is; removed with
//     Edit, and Undo
//   - Alarms: one set for two minutes on ("Alarm set for 2 min from now"), what you type shown
//     as text; it rings with its sound, snoozes, rings again, stops, and having rung once it is
//     off; a repeating one switched off and on; Sleep | Wake Up set up; one that came due while
//     Clock was closed listed as missed, not rung
//   - Stopwatch: start, laps, the fastest and slowest marked, stop, analog, reset; still
//     running after a reload
//   - Timers: a quick length, a label, pause and resume, it rings, Repeat, cancel, Recents
//   - Nightstand opens and closes; Settings' 24-hour time changes the digits
//   - the main clock shows a city picked in Settings, and goes back to this phone's time
//   - each design looks like itself (Vintage: Futura, starburst faces, a mustard tab thumb, the
//     sky; Standard: Sea glass, no starburst, no sky), and Settings > Design switches between
//     them at once, keeps the choice, and gives iOS the right icon and status bar
//   - no script errors and nothing the page's Content Security Policy blocks
// Screenshots go to the folder given as the second argument.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node clock/scripts/app-test.mjs [screenshot dir]
process.env.TZ = 'America/New_York';   // this test's own dates read in New York's time, as the page's do
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const APP = 'clock';
const SHOTS = process.argv[2] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const KEY = 'allison-clock-v1';

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
const T0 = new Date('2026-03-11T08:00:00-04:00');   // a Wednesday morning in New York (summer time began on the 8th)

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok - ' + name); } catch (e) { failed++; console.log('not ok - ' + name + '\n  ' + String(e && e.message || e).split('\n').slice(0, 6).join('\n  ')); } };

async function open(scheme, seed, { at = T0, query = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, locale: 'en-US', timezoneId: 'America/New_York', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  // (aOS's own sign-in check, /aOS/api/, has no server here: that's welcome.js's, not Clock's, and Clock never calls a server)
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !/\/aOS\/api\//.test(r.url())) errors.push('response ' + r.status() + ': ' + r.url()); });
  await page.clock.install({ time: at.getTime() - 20e3 });
  await page.addInitScript(([app, key, seed]) => {
    window.__csp = window.__csp || [];   // what the page's Content Security Policy blocks, on every load
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('aos.seen', JSON.stringify({ [app]: '999' }));
    localStorage.setItem('aos.sky', 'day');
    if (seed) localStorage.setItem(key, JSON.stringify(seed));
  }, [APP, KEY, seed || null]);
  await page.goto(BASE + '/' + APP + '/' + query);
  await page.waitForSelector('#hero svg');
  await page.clock.pauseAt(at);   // from here time moves only when the test says
  await page.clock.runFor(500);
  return { ctx, page, errors };
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, APP + '-' + name + '.png') }); };
const text = (page, sel) => page.locator(sel).first().innerText();
const stored = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);

const look = page => page.evaluate(() => ({
  look: document.documentElement.getAttribute('data-look'),
  sky: document.documentElement.getAttribute('data-sky'),
  font: getComputedStyle(document.body).fontFamily,
  rays: getComputedStyle(document.querySelector('#hero .rays')).display,
  thumb: getComputedStyle(document.querySelector('#tabs .slthumb')).backgroundColor,
  touch: document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href'),
  bar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content,
}));
const isVintage = l => { assert.equal(l.look, 'vintage'); assert.match(l.font, /Futura/); assert.notEqual(l.rays, 'none', 'starburst faces'); assert.equal(l.thumb, 'rgb(227, 167, 47)', 'a mustard tab thumb'); assert.equal(l.sky, 'day', 'the Vintage sky'); assert.match(l.touch, /^icon-180\.png/); assert.equal(l.bar, 'default'); };
const isGlass = l => { assert.equal(l.look, 'glass'); assert.doesNotMatch(l.font, /Futura/); assert.equal(l.rays, 'none', 'no starburst in Sea glass'); assert.equal(l.sky, null, 'no sky in Sea glass'); assert.match(l.touch, /^icon-glass-180\.png/); assert.equal(l.bar, 'black-translucent'); };

for (const [scheme, design] of [['light', 'vintage'], ['dark', 'glass']]) {
  const VINTAGE = design === 'vintage';
  const { ctx, page, errors } = await open(scheme, VINTAGE ? null : { set: { design: 'glass' } });   // a new install opens in Vintage

  await step(`${scheme}: opens on World Clock with your own time`, async () => {
    assert.equal(await text(page, '#title'), 'World Clock');
    assert.match(await text(page, '#heroT'), /^8:00\s*AM$/);
    assert.equal(await text(page, '#heroD'), 'Wednesday, March 11');
    assert.equal(await text(page, '#hero small'), 'NEW YORK');
    assert.ok(await page.locator('#cityEmpty').isVisible());
  });

  await step(`${scheme}: it opens in the ${VINTAGE ? 'Vintage' : 'Standard'} design`, async () => {
    const tabs = await page.evaluate(() => ({ pos: getComputedStyle(document.querySelector('#tabs')).position, bottom: Math.round(innerHeight - document.querySelector('#tabs').getBoundingClientRect().bottom) }));
    assert.equal(tabs.pos, 'fixed', 'the tab bar floats at the bottom');
    assert.ok(tabs.bottom >= 8 && tabs.bottom <= 40, 'the tab bar sits at the bottom (' + tabs.bottom + ')');
    (VINTAGE ? isVintage : isGlass)(await look(page));
    await shot(page, scheme + '-world-empty');
  });

  await step(`${scheme}: a city is found, added, removed and brought back`, async () => {
    await page.click('#addBtn');
    await page.fill('#cityQ', 'toky');
    await page.locator('#cityRes .cres').first().click();
    await page.waitForSelector('#citySheet', { state: 'hidden' });
    const row = page.locator('#cityList .crow').first();
    assert.equal(await row.locator('strong').innerText(), 'Tokyo');
    assert.equal(await row.locator('[data-rel]').innerText(), 'Today, 13 hr ahead');
    assert.match(await row.locator('[data-t]').innerText(), /^9:00\s*PM$/);
    await page.click('#addBtn'); await page.fill('#cityQ', 'zzqx');
    assert.match(await text(page, '#cityHint'), /No cities match/);
    await page.click('#citySheet .sheethead [data-close]');
    await page.click('#editBtn');
    assert.equal(await text(page, '#editBtn'), 'Done');
    await page.click('#cityList [data-del]');
    assert.ok(await page.locator('#cityEmpty').isVisible());
    await page.click('#toastAct');
    assert.equal(await page.locator('#cityList .crow').count(), 1);
    assert.equal((await stored(page)).cities[0].tz, 'Asia/Tokyo');
    await shot(page, scheme + '-world');
  });

  await step(`${scheme}: an alarm is set, rings, snoozes, rings again and stops`, async () => {
    await page.click('#tabs [data-tab="alarms"]');
    assert.equal(await text(page, '#title'), 'Alarms');
    assert.equal(await text(page, '#sub'), 'No alarms on');
    await page.click('#addBtn');
    await page.fill('#alTime', '08:02');
    await page.fill('#alLabel', '<b>Gym</b>');
    await page.click('#alSave');
    assert.match(await text(page, '#toastMsg'), /Alarm set for 2 min from now/);
    const row = page.locator('#alarmList .arow').first();
    assert.equal(await row.locator('.al').innerText(), '<b>Gym</b>', 'what you type is shown as text');
    assert.equal(await page.locator('#alarmList b').count(), 0);
    assert.equal(await text(page, '#sub'), 'Next alarm in 2 min');
    await page.clock.fastForward('02:00');
    await page.waitForSelector('#ring', { state: 'visible' });
    assert.equal(await text(page, '#rKind'), 'ALARM');
    assert.equal(await text(page, '#rLabel'), '<b>Gym</b>');
    assert.match(await text(page, '#rTime'), /^8:02\s*AM$/);
    assert.equal(await text(page, '#rSnooze'), 'Snooze 9 min');
    assert.equal((await page.evaluate(() => window.__clock.audio())).playing, 'twinbell', 'its sound plays');
    await shot(page, scheme + '-ring');
    await page.click('#rSnooze');
    await page.waitForSelector('#ring', { state: 'hidden' });
    assert.match(await row.locator('.al').innerText(), /Snoozed until 8:11\s*AM/);
    let s = await stored(page);
    assert.equal(s.alarms[0].on, false, 'a one-time alarm turns itself off once it has rung');
    assert.equal(await page.evaluate(() => window.__clock.audio().playing), null, 'quiet while snoozed');
    await page.clock.fastForward('09:00');
    await page.waitForSelector('#ring', { state: 'visible' });
    await page.click('#rStop');
    await page.waitForSelector('#ring', { state: 'hidden' });
    s = await stored(page);
    assert.equal(s.alarms[0].snoozeAt, null);
    assert.equal(await page.evaluate(() => window.__clock.audio().playing), null);
  });

  await step(`${scheme}: a repeating alarm is switched off and on, and opened to edit`, async () => {
    await page.click('#addBtn');
    await page.fill('#alTime', '06:45');
    for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) await page.click(`#alDays [aria-label="${d}"]`);
    assert.equal(await text(page, '#alDaySum'), 'Repeat: Weekdays');
    await page.click('#alSnoozeLen [data-n="5"]');
    await page.click('#alSave');
    const row = page.locator('#alarmList .arow').first();   // earliest in the day first
    assert.equal(await row.locator('.al').innerText(), 'Alarm, Weekdays');
    let a = (await stored(page)).alarms.find(x => x.h === 6);
    assert.equal(new Date(a.next).toString().slice(0, 21), 'Thu Mar 12 2026 06:45');
    assert.equal(a.snoozeMin, 5);
    await row.locator('[data-sw]').click();
    a = (await stored(page)).alarms.find(x => x.h === 6);
    assert.equal(a.on, false); assert.equal(a.next, null);
    await row.locator('[data-sw]').click();
    assert.equal((await stored(page)).alarms.find(x => x.h === 6).on, true);
    await row.locator('[data-open]').click();
    assert.equal(await text(page, '#alLbl'), 'Edit Alarm');
    assert.ok(await page.locator('#alDelete').isVisible());
    await page.click('#alarmSheet .sheethead [data-close]');
  });

  await step(`${scheme}: Sleep | Wake Up is set up`, async () => {
    await page.click('#sleepSetup');
    assert.match(await text(page, '#slLen'), /^8 hr of sleep · wake up Weekdays/);
    await page.click('#slSave');
    assert.match(await text(page, '#sleepCard .st'), /^6:30\s*AM$/);
    assert.match(await text(page, '#sleepCard .sm'), /Bedtime 10:30 PM · 8 hr of sleep/);
    const sl = (await stored(page)).sleep;
    assert.equal(new Date(sl.next).toString().slice(0, 21), 'Thu Mar 12 2026 06:30');
    assert.equal(new Date(sl.bedNext).toString().slice(0, 21), 'Wed Mar 11 2026 22:30');
    await shot(page, scheme + '-alarms');
  });

  await step(`${scheme}: the stopwatch laps, marks the fastest and slowest, stops and resets`, async () => {
    await page.click('#tabs [data-tab="stopwatch"]');
    assert.equal(await text(page, '#swDig'), '00:00.00');
    assert.ok(await page.locator('#swLeft').isDisabled());
    await page.click('#swRight');
    assert.equal(await text(page, '#swRight'), 'Stop');
    await page.clock.runFor(3000); await page.click('#swLeft');
    await page.clock.runFor(2000); await page.click('#swLeft');
    await page.clock.runFor(4000); await page.click('#swRight');
    assert.equal(await text(page, '#swDig'), '00:09.00');
    assert.equal(await text(page, '#swLeft'), 'Reset');
    const rows = await page.locator('#laps .lrow').allInnerTexts();
    assert.equal(rows.length, 3);
    assert.match(rows[0], /Lap 3\s+00:04\.00/);
    assert.match(rows[1], /Lap 2\s*Fastest\s+00:02\.00/i);
    assert.match(rows[2], /Lap 1\s*Slowest\s+00:03\.00/i);
    await page.click('#swFace');
    assert.ok(await page.locator('#swFace svg.face.sw').isVisible(), 'analog');
    assert.equal(await page.locator('#swAnaDg').textContent(), '00:09.00');
    await shot(page, scheme + '-stopwatch');
    await page.click('#swDots [data-face="digital"]');
    await page.click('#swLeft');
    assert.equal(await text(page, '#swDig'), '00:00.00');
    assert.ok(await page.locator('#laps').isHidden());
  });

  await step(`${scheme}: a timer runs, pauses, rings, repeats and goes into Recents`, async () => {
    await page.click('#tabs [data-tab="timers"]');
    await page.click('#presets [data-p="60"]');
    await page.fill('#tLabel', 'Tea');
    await page.click('#tStart');
    const row = page.locator('#runTimers .trow').first();
    assert.equal(await row.locator('[data-left]').innerText(), '1:00');
    assert.match(await row.locator('small').innerText(), /Tea\s*· 8:\d\d AM/);
    await page.clock.runFor(10000);
    assert.equal(await row.locator('[data-left]').innerText(), '0:50');
    await row.locator('[data-pp]').click();
    assert.match(await row.locator('small').innerText(), /Paused/);
    await page.clock.runFor(30000);
    assert.equal(await row.locator('[data-left]').innerText(), '0:50', 'paused, it waits');
    await row.locator('[data-pp]').click();
    assert.equal(await text(page, '#sub'), '1 timer running');
    await page.clock.fastForward('00:51');
    await page.waitForSelector('#ring', { state: 'visible' });
    assert.equal(await text(page, '#rKind'), 'TIMER');
    assert.equal(await text(page, '#rLabel'), 'Tea');
    assert.equal(await text(page, '#rSnooze'), 'Repeat');
    await page.click('#rSnooze');
    await page.waitForSelector('#ring', { state: 'hidden' });
    assert.equal(await page.locator('#runTimers .trow').count(), 1, 'Repeat starts it again');
    assert.equal(await row.locator('[data-left]').innerText(), '1:00');
    await row.locator('[data-cancel]').click();
    assert.ok(await page.locator('#runTimers').isHidden());
    const rec = await page.locator('#recents .rrow').allInnerTexts();
    assert.equal(rec.length, 1); assert.match(rec[0], /1:00\s+Tea/);
    await shot(page, scheme + '-timers');
  });

  await step(`${scheme}: Nightstand and 24-hour time`, async () => {
    await page.click('#nightBtn');
    await page.waitForSelector('#night', { state: 'visible' });
    assert.match(await text(page, '#nTime'), /^8:\d\d\s*AM$/);
    assert.match(await text(page, '#nAlarm'), /Wake Up 6:30 AM tomorrow/);
    await page.waitForFunction(() => /stays on|may still lock/.test(document.getElementById('nWarn').textContent), null, { timeout: 5000 });   // it says whether the screen stays on
    await shot(page, scheme + '-nightstand');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#night', { state: 'hidden' });
    await page.click('#setBtn'); await page.click('#set24'); await page.click('#setSheet .sheethead [data-close]');
    await page.click('#tabs [data-tab="world"]');
    assert.match(await text(page, '#heroT'), /^08:\d\d$/);
  });

  await step(`${scheme}: Settings > Design switches the design at once, and keeps it`, async () => {
    const other = VINTAGE ? 'glass' : 'vintage';
    await page.click('#setBtn');
    assert.equal(await page.locator(`#setDesign [data-design="${design}"]`).getAttribute('aria-checked'), 'true');
    await page.click(`#setDesign [data-design="${other}"]`);
    assert.equal(await page.locator(`#setDesign [data-design="${other}"]`).getAttribute('aria-checked'), 'true');
    (VINTAGE ? isGlass : isVintage)(await look(page));
    await shot(page, scheme + '-design-' + other);
    await page.click('#setSheet .sheethead [data-close]');
    assert.equal((await stored(page)).set.design, other);
    await page.reload(); await page.waitForSelector('#hero svg'); await page.clock.runFor(300);
    (VINTAGE ? isGlass : isVintage)(await look(page));
    await page.click('#setBtn'); await page.click(`#setDesign [data-design="${design}"]`); await page.click('#setSheet .sheethead [data-close]');
    (VINTAGE ? isVintage : isGlass)(await look(page));
  });

  await step(`${scheme}: nothing was blocked or broken`, async () => {
    const csp = await page.evaluate(() => window.__csp);
    assert.deepEqual(csp, []);
    assert.deepEqual(errors, []);
  });

  await step(`${scheme}: the stopwatch keeps running across a reload`, async () => {
    await page.click('#tabs [data-tab="stopwatch"]');
    await page.click('#swRight');
    await page.clock.runFor(5000);
    await page.reload(); await page.waitForSelector('#swDig');
    await page.clock.runFor(1000);
    assert.equal(await text(page, '#title'), 'Stopwatch', 'it opens on the tab you left');
    const secs = +(/^00:(\d\d\.\d\d)$/.exec(await text(page, '#swDig')) || [])[1];
    assert.ok(secs >= 5.9 && secs <= 6.5, 'five seconds before the reload and one after: ' + secs);
    assert.equal(await text(page, '#swRight'), 'Stop');
  });
  await ctx.close();
}

await step('an alarm that came due while Clock was closed is listed, not rung', async () => {
  const seed = { alarms: [{ id: 'w', h: 7, m: 0, days: [1, 2, 3, 4, 5], label: 'Work', on: true, next: T0.getTime() - 3600e3 }],
    timers: [{ id: 'k', label: 'Eggs', dur: 300000, end: T0.getTime() - 60e3, state: 'run' }] };
  const { ctx, page, errors } = await open('light', seed);
  await page.waitForSelector('#ring', { state: 'visible' });
  assert.equal(await text(page, '#rLabel'), 'Eggs', 'a timer a minute late still rings');
  assert.match(await text(page, '#rNote'), /Ended at 7:59 AM/);
  await page.click('#rStop');
  await page.click('#tabs [data-tab="alarms"]');
  assert.match(await text(page, '#missed'), /Work came due at 7:00 AM while Clock was closed/);
  const a = (await stored(page)).alarms[0];
  assert.equal(new Date(a.next).toString().slice(0, 21), 'Thu Mar 12 2026 07:00', 'and it is set for its next day');
  await page.click('#missedOk');
  assert.equal(await page.locator('#missed .missed').count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

await step('the main clock shows another city, and goes back to this phone\'s time', async () => {
  const { ctx, page, errors } = await open('light');
  await page.click('#setBtn');
  assert.equal(await text(page, '#setHomeName'), 'New York (this phone)');
  await page.click('#setHome');
  assert.equal(await text(page, '#cityLbl'), 'Main Clock');
  await page.fill('#cityQ', 'los ang');
  await page.locator('#cityRes .cres').first().click();
  await page.waitForSelector('#citySheet', { state: 'hidden' });
  assert.equal(await text(page, '#setHomeName'), 'Los Angeles');
  assert.equal(await text(page, '#hero small'), 'LOS ANGELES');
  assert.match(await text(page, '#heroT'), /^5:00\s*AM$/);
  assert.equal(await text(page, '#heroD'), 'Wednesday, March 11 · 3 hr behind this phone');
  await page.click('#setSheet .sheethead [data-close]');
  await page.click('#nightBtn');
  assert.match(await text(page, '#nTime'), /^8:00\s*AM$/, 'Nightstand keeps this phone\'s time');
  await page.click('#nClose');
  await page.click('#setBtn'); await page.click('#setHome'); await page.click('#cityHere');
  assert.equal(await text(page, '#hero small'), 'NEW YORK');
  assert.match(await text(page, '#heroT'), /^8:00\s*AM$/);
  assert.equal(await text(page, '#heroD'), 'Wednesday, March 11');
  assert.equal((await stored(page)).set.home, null);
  assert.deepEqual(errors, []);
  await ctx.close();
});

await browser.close();
server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
