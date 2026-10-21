// Home's Automations view (house/automations.js): every Home Assistant
// automation's name, by group; tapping one shows whether it is on, the devices
// it works with their state, what it does and when it runs.
// In the preview, the list is Home's copy of ha-config (automations-data.js).
// Live, Home Assistant is a stand-in (Playwright's WebSocket routing, no
// network) with a few automations: their status is its own; what each does
// comes from the copy when the token may not read configs (not an admin's),
// and from Home Assistant itself when it may.
//   node house/scripts/automations-test.mjs [repo root]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
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
const browser = await chromium.launch();
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('ok - ' + name); }
  catch (e) { console.log('not ok - ' + name + '\n  ' + String(e.message || e).split('\n')[0]); await browser.close(); server.close(); process.exit(1); }
}

// How many automations Home's copy has.
const copy = fs.readFileSync(path.join(ROOT, 'house/automations-data.js'), 'utf8');
const COPY_N = Object.keys(JSON.parse(/const HA_AUTOS = (.*);\n/.exec(copy)[1])).length;

// ha: null for the preview; else { admin } for a stand-in Home Assistant.
async function phone({ scheme = 'dark', design = 'glass', ha = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin !== BASE) return route.abort('internetdisconnected');
    if (u.pathname.includes('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
    return route.continue();
  });
  await ctx.addInitScript(([design, live]) => {
    localStorage.setItem('aos.seen', JSON.stringify({ house: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.sky', 'day');
    if (design === 'glass') localStorage.setItem('design.house', 'glass');
    if (live) localStorage.setItem('house.ha', JSON.stringify({ url: 'https://ha.example', token: 'tok' }));
  }, [design, !!ha]);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const asked = [];
  if (ha) await page.routeWebSocket('wss://ha.example/api/websocket', ws => {
    ws.send(JSON.stringify({ type: 'auth_required', ha_version: '2026.10.0' }));
    ws.onMessage(m => {
      const d = JSON.parse(m);
      if (d.type === 'auth') ws.send(JSON.stringify({ type: 'auth_ok', ha_version: '2026.10.0' }));
      if (d.type === 'ping') ws.send(JSON.stringify({ id: d.id, type: 'pong' }));
      if (d.type === 'subscribe_entities') {
        const now = new Date().toISOString(), s = (v, a = {}) => ({ s: v, a, lc: 1, lu: 1 });
        ws.send(JSON.stringify({ id: d.id, type: 'event', event: { a: {
          // Goodnight ran just now; the 08:30 blinds are off; Mom's Awake is running; one made in Home Assistant's editor, not in the copy.
          'automation.goodnight': s('on', { id: '1785000000001', friendly_name: 'Goodnight', last_triggered: now, current: 0 }),
          'automation.blinds_open_office_blinds_at_08_30': s('off', { id: '1785890100001', friendly_name: 'Blinds - Open Office Blinds at 08:30', last_triggered: null, current: 0 }),
          'automation.mom_s_awake': s('on', { id: '1785900000001', friendly_name: "Mom's Awake", last_triggered: now, current: 1 }),
          'automation.porch_at_dusk': s('on', { id: '1799999999999', friendly_name: 'Porch at dusk', last_triggered: null, current: 0 }),
          'light.side_lamps': s('on', { friendly_name: 'Side Lamps', brightness: 128 }),
          'light.porch': s('off', { friendly_name: 'Porch Light' }),
          'cover.office_blinds': s('open', { friendly_name: 'Office Blinds', current_position: 40 }),
        } } }));
      }
      if (d.type === 'automation/config' || d.type === 'script/config') {
        asked.push(d.entity_id);
        if (!ha.admin) return ws.send(JSON.stringify({ id: d.id, type: 'result', success: false, error: { code: 'unauthorized', message: 'Unauthorized' } }));
        const cfg = d.entity_id === 'automation.porch_at_dusk'
          ? { id: '1799999999999', alias: 'Porch at dusk', description: 'Turns the porch light on at dusk. Made in the editor.', triggers: [{ trigger: 'sun', event: 'sunset', offset: '-00:15:00' }], actions: [{ action: 'light.turn_on', target: { entity_id: 'light.porch' } }] }
          : null;
        ws.send(JSON.stringify(cfg ? { id: d.id, type: 'result', success: true, result: { config: cfg } } : { id: d.id, type: 'result', success: false, error: { code: 'not_found', message: 'Entity not found' } }));
      }
    });
  });
  await page.goto(BASE + '/house/');
  await page.waitForSelector('#viewBtn');
  if (ha) await page.waitForFunction(() => document.getElementById('chip').dataset.s === 'live', null, { timeout: 10000 });
  await page.click('#viewBtn');
  await page.click('#viewMenu [data-view="autos"]');
  await page.waitForTimeout(400);
  return { ctx, page, errors, asked };
}
const row = (page, ent) => page.locator(`#g-autos [data-dv="autos:${ent}"]`);
const groupOf = (page, ent) => row(page, ent).evaluate(c => c.closest('.au-group').querySelector('.vsec-h span').textContent);
// Opens one's popup: its title, its pill and everything in it.
async function popup(page, ent) {
  await row(page, ent).click();
  await page.waitForSelector('#devWrap.open', { state: 'attached' });
  const out = { title: await page.textContent('#dTitle'), pill: await page.textContent('#devWrap [data-s="pill"]'), body: await page.textContent('#devWrap [data-s="body"]') };
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#devWrap.open'));
  return out;
}

for (const [scheme, design] of [['dark', 'glass'], ['light', 'vintage']]) {
  const label = `preview, ${design === 'glass' ? 'Standard' : 'Vintage'} ${scheme}`;
  const { ctx, page, errors } = await phone({ scheme, design });
  await test(`${label}: Automations lists every automation in Home's copy by name, in groups, and nothing else`, async () => {
    assert.equal(await page.textContent('#viewName'), 'Automations');
    assert.equal(await page.locator('#g-autos .au-row').count(), COPY_N);
    const groups = await page.$$eval('#g-autos .au-group .vsec-h', hs => hs.map(h => [h.querySelector('span').textContent, Number(h.querySelector('.au-n').textContent)]));
    assert.equal(groups.reduce((n, [, c]) => n + c, 0), COPY_N, 'each group counts its own');
    assert.deepEqual(groups.map(g => g[0]), ['Routines', 'Climate', 'Lights', 'Blinds', 'Security', 'Media', 'Nursery', 'Behind the scenes']);
    assert.equal(groups[0][1], 6, 'Goodnight, Mom\'s Awake and its reminder, Away, Home, Babysitter');
    for (const id of ['1785000000001', 'home_first_one_back', 'babysitter_mode_expire_unused', 'moms_awake_weekday_reminder']) assert.equal(await groupOf(page, 'automation.' + id), 'Routines', id);
    assert.equal(await groupOf(page, 'automation.1785890100001'), 'Blinds');
    // Only the name on a row: no status, devices or description.
    assert.equal(await row(page, 'automation.1785890100001').textContent(), 'Blinds - Open Office Blinds at 08:30');
    assert.equal(await page.locator('#g-autos .alert, #g-autos [data-a]').count(), 0);
  });
  await test(`${label}: tapping a name shows its status and devices first, then what it does, when it runs and only if`, async () => {
    const p = await popup(page, 'automation.1785890100001');
    assert.equal(p.title, 'Blinds - Open Office Blinds at 08:30');
    assert.equal(p.pill, 'On');
    assert.match(p.body, /^\s*Status\s*On\s*Last ran\s*—\s*CONTROLS\s*Office blinds\s*Now open 50%\s*Opens/, 'its state now, and what it does to it');
    assert.match(p.body, /WHAT IT DOES\s*Opens both VELUX office blinds fully each morning\./);
    assert.match(p.body, /RUNS\s*At 8:30 AM/);
    assert.match(p.body, /ONLY IF\s*Guest mode is off/);
    assert.doesNotMatch(p.body, /Read from|automations\.yaml|Run and change it/, 'no note on where it was read from');
  });
  await test(`${label}: what Home Assistant's own list says: the mirror only reads the thermostats, seconds kept, devices made by a template found, Goodnight sends nothing itself`, async () => {
    const mirror = await popup(page, 'automation.signal_lr_setpoint_mirror');
    assert.doesNotMatch(mirror.body, /CONTROLS/);
    assert.match(mirror.body, /WATCHES\s*Living room living room/);
    assert.match((await popup(page, 'automation.thermostat_hold_release_0400')).body, /RUNS\s*At 4:00:30 AM/);
    assert.match((await popup(page, 'automation.1785890100004')).body, /CONTROLS\s*Office blinds.*Office left blind.*Office right blind/s);
    assert.match((await popup(page, 'automation.signal_dyson_restore_night')).body, /CONTROLS\s*Sofias dyson night mode/);
    assert.match((await popup(page, 'automation.blink_snapshot_on_motion')).body, /CONTROLS\s*Garage/);
    const home = await popup(page, 'automation.home_first_one_back');
    assert.match(home.body, /CONTROLS\s*Garage camera motion detection/);
    assert.doesNotMatch(home.body.split('WATCHES')[0], /Yard/, 'the Yard is only named in the push');
    const gn = (await popup(page, 'automation.1785000000001')).body;
    assert.doesNotMatch(gn, /NOTIFIES/);
    assert.match(gn, /Elena lamp\s*(Now [^A-Z]*)?Sets to 1%/);
    // Away turns the lamps off, whatever they are at now (the Sunset Ladder may have them at 25%).
    assert.match((await popup(page, 'automation.away_everyone_out')).body, /Side lamps\s*Now 25%\s*Turns off/);
  });
  await test(`${label}: no script errors`, async () => assert.deepEqual(errors, []));
  await ctx.close();
}

{
  const { ctx, page, errors, asked } = await phone({ ha: { admin: false } });
  await test('live, not an admin: each automation\'s status is Home Assistant\'s, in its popup', async () => {
    await page.waitForSelector('#g-autos [data-dv="autos:automation.goodnight"]');
    const gn = await popup(page, 'automation.goodnight');
    assert.equal(gn.pill, 'On');
    assert.match(gn.body, /Last ran\s*Just now/);
    const bl = await popup(page, 'automation.blinds_open_office_blinds_at_08_30');
    assert.equal(bl.pill, 'Off');
    assert.match(bl.body, /Last ran\s*Never/);
    assert.match(bl.body, /CONTROLS\s*Office Blinds\s*Now open 40%\s*Opens/, 'the device\'s own name and state, and what it does');
    assert.equal((await popup(page, 'automation.mom_s_awake')).pill, 'Running now');
    assert.match(await page.textContent('#secSum'), /1 running · 2 ran today · 1 off/);
  });
  await test('live, not an admin: what each does comes from the copy (Home Assistant turned the config down, asked once)', async () => {
    assert.match((await popup(page, 'automation.goodnight')).body, /WHAT IT DOES\s*Shuts the house down for the night\./);
    assert.match((await popup(page, 'automation.porch_at_dusk')).body, /Not in Home's copy/);
    assert.equal(asked.length, 1, 'asked: ' + asked.join());
  });
  await test('live: the copy\'s automations Home Assistant doesn\'t have are listed apart', async () => {
    assert.equal(await groupOf(page, 'x.1754320000000'), 'Not in Home Assistant');
    assert.equal(await page.locator('#g-autos .au-group:last-child .au-row').count(), COPY_N - 3);
  });
  await test('live, not an admin: no script errors', async () => assert.deepEqual(errors, []));
  await ctx.close();
}

{
  const { ctx, page, errors, asked } = await phone({ ha: { admin: true } });
  await test('live, an admin: what each does is read from Home Assistant itself, the editor\'s own included', async () => {
    await page.waitForFunction(() => document.querySelector('#g-autos [data-dv="autos:automation.porch_at_dusk"]')
      && document.querySelector('#g-autos [data-dv="autos:automation.porch_at_dusk"]').closest('.au-group').querySelector('.vsec-h span').textContent === 'Lights');
    const p = await popup(page, 'automation.porch_at_dusk');
    assert.match(p.body, /CONTROLS\s*Porch Light\s*Now off\s*Turns on/);
    assert.match(p.body, /WHAT IT DOES\s*Turns the porch light on at dusk\./);
    assert.match(p.body, /RUNS\s*15 min before sunset/);
    assert.doesNotMatch(p.body, /Read from/, 'no note on where it was read from');
    assert.equal(asked.length, 4, 'each automation asked for once');
  });
  await test('live, an admin: no script errors', async () => assert.deepEqual(errors, []));
  await ctx.close();
}

await browser.close();
server.close();
console.log(passed + ' tests passed');
