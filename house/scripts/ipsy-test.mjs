// Home's tools for Ipsy in aOS (house/ipsy-tools.js, offered as AllisonOS.ipsyTools): what they read,
// and the three groups, kept on the phone by what each device is: lights, thermostats, speakers,
// vacuums… change at once, with an Undo that puts them back; heaters, the blinds and automations ask
// first (nothing is sent on No); the alarm, cameras and locks are never changed, whatever is asked.
// Home Assistant is a stand-in (Playwright's WebSocket routing, no network). In the preview (no Home
// Assistant on the phone) every tool says so.
//   node house/scripts/ipsy-test.mjs [repo root]
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

const s = (v, a = {}) => ({ s: v, a, lc: 1, lu: 1 });
const HOUSE = {
  'light.kitchen': s('on', { friendly_name: 'Kitchen Lights', brightness: 128 }),
  'light.living_room_fireplace_lights_socket': s('off', { friendly_name: 'Fireplace' }),
  'light.outdoor_deck': s('off', { friendly_name: 'Outdoor Deck' }),
  'climate.office_office': s('heat', { friendly_name: 'Office', temperature: 68, current_temperature: 66, hvac_action: 'heating', min_temp: 50, max_temp: 90 }),
  'climate.office_heater': s('off', { friendly_name: 'Office Heater', temperature: 70 }),
  'media_player.kitchen_sonos_kitchen_sonos': s('playing', { friendly_name: 'Kitchen', volume_level: 0.3, media_title: 'Clair de Lune', media_artist: 'Debussy' }),
  'vacuum.shark': s('docked', { friendly_name: 'Shark' }),
  'input_number.office_blinds_target': s('40', {}),
  'cover.office_blinds': s('open', { current_position: 40 }),
  'lock.velux_gateway_departure_mode': s('unlocked', {}),
  'alarm_control_panel.blink_system': s('armed_away', { friendly_name: 'Blink' }),
  'camera.yard': s('idle', {}), 'switch.yard_camera_motion_detection': s('on', {}),
  'automation.goodnight': s('on', { friendly_name: 'Goodnight', last_triggered: null }),
};

async function phone({ ha = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin !== BASE) return route.abort('internetdisconnected');
    if (u.pathname.includes('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
    return route.continue();
  });
  await ctx.addInitScript(live => {
    localStorage.setItem('aos.seen', JSON.stringify({ house: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.sky', 'day');
    if (live) localStorage.setItem('house.ha', JSON.stringify({ url: 'https://ha.example', token: 'tok' }));
  }, !!ha);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const calls = [];
  if (ha) await page.routeWebSocket('wss://ha.example/api/websocket', ws => {
    ws.send(JSON.stringify({ type: 'auth_required', ha_version: '2026.10.0' }));
    ws.onMessage(m => {
      const d = JSON.parse(m);
      if (d.type === 'auth') ws.send(JSON.stringify({ type: 'auth_ok', ha_version: '2026.10.0' }));
      if (d.type === 'ping') ws.send(JSON.stringify({ id: d.id, type: 'pong' }));
      if (d.type === 'subscribe_entities') ws.send(JSON.stringify({ id: d.id, type: 'event', event: { a: ha } }));
      if (d.type === 'call_service') { calls.push({ domain: d.domain, service: d.service, data: d.service_data }); ws.send(JSON.stringify({ id: d.id, type: 'result', success: true, result: {} })); }
    });
  });
  await page.goto(BASE + '/house/');
  await page.waitForSelector('#vtop [data-view]');
  if (ha) await page.waitForFunction(() => document.getElementById('chip').dataset.s === 'live', null, { timeout: 10000 });
  // a tool, as Ipsy in aOS runs it: ctx.confirm answers the Yes / No (yes: true, false, or null for none asked)
  const run = (name, input, yes = true) => page.evaluate(async ([name, input, yes]) => {
    const asked = [];
    try {
      const r = await AllisonOS.ipsyTools.tools[name](input, { confirm: async t => { asked.push(t); return yes; } });
      const undo = r.change && r.change.undo; if (undo) window.__undo = undo;
      return { content: r.content, change: r.change ? r.change.text : null, undo: !!undo, asked };
    } catch (e) { return { error: e.message, asked }; }
  }, [name, input, yes]);
  return { ctx, page, errors, calls, run };
}

{
  const { ctx, run } = await phone();
  await test('preview: Home offers its tools to aOS, and says it isn\'t connected', async () => {
    const r = await run('list_devices', {});
    assert.match(r.error, /isn't connected to Home Assistant on this phone/);
  });
  await ctx.close();
}

{
  const { ctx, page, errors, calls, run } = await phone({ ha: HOUSE });
  await test('the offer: app house, its three tools', async () => {
    assert.deepEqual(await page.evaluate(() => [AllisonOS.ipsyTools.app, Object.keys(AllisonOS.ipsyTools.tools).sort()]), ['house', ['control', 'list_devices', 'open_home']]);
  });
  await test('list_devices: every card\'s device, how it is, and what Ipsy may do with it', async () => {
    const r = (await run('list_devices', {})).content, by = id => r.devices.find(d => d.id === id);
    assert.deepEqual([by('light.kitchen').room, by('light.kitchen').state, by('light.kitchen').brightness, by('light.kitchen').ipsy_can_change], ['Kitchen', 'on', 50, 'yes, with Undo']);
    assert.equal(by('climate.office_office').target, 68);
    assert.equal(by('media_player.kitchen_sonos_kitchen_sonos').playing, 'Debussy - Clair de Lune');
    assert.equal(by('climate.office_heater').ipsy_can_change, 'asks the person first');
    assert.deepEqual([by('alarm_control_panel.blink_system').state, by('alarm_control_panel.blink_system').ipsy_can_change], ['armed_away', 'no: open Home to do it']);
    assert.equal(by('camera.yard').motion_detection, 'on');
    assert.match(r.automations, /^1 /);
    const lights = (await run('list_devices', { kind: 'light', room: 'kitchen' })).content.devices;
    assert.ok(lights.length && lights.every(d => d.kind === 'light' && d.room === 'Kitchen'), 'by kind and room');
    assert.equal((await run('list_devices', { kind: 'automation' })).content.automations[0].name, 'Goodnight');
    assert.equal(calls.length, 0, 'reading sends nothing');
  });
  await test('a light: dimmed at once, with an Undo that puts it back', async () => {
    const r = await run('control', { id: 'light.kitchen', action: 'brightness', value: 30 });
    assert.deepEqual(r.asked, [], 'not asked');
    assert.equal(r.change, 'Kitchen Lights to 30%'); assert.ok(r.undo);
    assert.deepEqual(calls.at(-1), { domain: 'light', service: 'turn_on', data: { entity_id: 'light.kitchen', brightness_pct: 30 } });
    await page.evaluate(() => window.__undo());
    assert.deepEqual(calls.at(-1), { domain: 'light', service: 'turn_on', data: { entity_id: 'light.kitchen', brightness_pct: 50 } });
    assert.match((await run('control', { id: 'light.living_room_fireplace_lights_socket', action: 'brightness', value: 40 })).error, /only turns on and off/);
  });
  await test('a thermostat: set within its limits; out of them, nothing is sent', async () => {
    await run('control', { id: 'climate.office_office', action: 'temperature', value: 70 });
    assert.deepEqual(calls.at(-1), { domain: 'climate', service: 'set_temperature', data: { entity_id: 'climate.office_office', temperature: 70 } });
    const n = calls.length;
    assert.match((await run('control', { id: 'climate.office_office', action: 'temperature', value: 120 })).error, /50 to 90/);
    assert.match((await run('control', { id: 'climate.office_office', action: 'mode', value: 'boost' })).error, /modes are Heat, Cool, Auto, Off/);
    assert.equal(calls.length, n);
  });
  await test('the vacuum: started by its own script, and Undo sends it home', async () => {
    await run('control', { id: 'vacuum.shark', action: 'start' });
    assert.deepEqual(calls.at(-1), { domain: 'script', service: 'turn_on', data: { entity_id: 'script.toggle_shark_clean' } });
    await page.evaluate(() => window.__undo());
    assert.deepEqual(calls.at(-1), { domain: 'vacuum', service: 'return_to_base', data: { entity_id: 'vacuum.shark' } });
    assert.match((await run('control', { id: 'vacuum.shark', action: 'pause' })).error, /isn't cleaning/, 'a pause when docked would start it: not sent');
  });
  await test('a heater, the blinds and an automation ask first: No sends nothing, Yes does it', async () => {
    const n = calls.length;
    const no = await run('control', { id: 'climate.office_heater', action: 'on' }, false);
    assert.deepEqual(no.asked, ['Turn on the Office Heater?']); assert.equal(no.content.changed, false); assert.equal(calls.length, n);
    const yes = await run('control', { id: 'climate.office_heater', action: 'on' }, true);
    assert.equal(yes.change, 'Turned on the Office Heater');
    assert.deepEqual(calls.at(-1), { domain: 'climate', service: 'set_hvac_mode', data: { entity_id: 'climate.office_heater', hvac_mode: 'heat' } });
    const b = await run('control', { id: 'input_number.office_blinds_target', action: 'position', value: 0 });
    assert.deepEqual(b.asked, ['Close the Office Blinds?']);
    assert.deepEqual(calls.at(-1), { domain: 'input_number', service: 'set_value', data: { entity_id: 'input_number.office_blinds_target', value: 0 } });
    await page.evaluate(() => window.__undo());
    assert.deepEqual(calls.at(-1), { domain: 'input_number', service: 'set_value', data: { entity_id: 'input_number.office_blinds_target', value: 40 } });
    const a = await run('control', { id: 'automation.goodnight', action: 'off' });
    assert.match(a.asked[0], /Turn off the automation “Goodnight”/);
    assert.deepEqual(calls.at(-1), { domain: 'automation', service: 'turn_off', data: { entity_id: 'automation.goodnight' } });
  });
  await test('the alarm, cameras and locks: never changed, nothing asked, nothing sent', async () => {
    const n = calls.length;
    for (const [id, action] of [['alarm_control_panel.blink_system', 'off'], ['camera.yard', 'off'], ['lock.velux_gateway_departure_mode', 'off'], ['camera.outside_front_outside_front_doorbell', 'on']]) {
      const r = await run('control', { id, action });
      assert.match(r.error, /never changes the alarm, cameras, the doorbell or locks/, id); assert.deepEqual(r.asked, []);
    }
    for (const id of ['lock.front_door', 'switch.yard_camera_motion_detection', 'script.pause_yard_camera_motion_detection', 'light.olivias_hatch_light'])
      assert.match((await run('control', { id, action: 'off' })).error, /No device with that id on Home's cards/, id + ': only the cards\' devices');
    assert.equal(calls.length, n);
  });
  await test('no script errors', async () => assert.deepEqual(errors, []));
  await ctx.close();
}

await browser.close();
server.close();
console.log(passed + ' tests passed');
