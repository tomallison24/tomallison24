// Ipsy and the person's settings (home/ipsy.js get_settings, change_setting, open_setting; server/ipsy.js
// SETTINGS_TOOLS), as a person uses them at iPhone size, with Claude stood in for:
//   - the phone's list of settings is the server's, one for one;
//   - in aOS, Ipsy changes the look of aOS and every app at once, with Undo; an app's setting (Clock's 24-hour
//     time) reaches that app; a setting that asks first changes only on Yes;
//   - anything not on the list (Mail's clean-up, the plan, the family's allergies) or a value it doesn't take is
//     refused on the phone, and nothing changes;
//   - open_setting opens an app's Settings inside aOS, and a section of aOS's Account;
//   - in an app, Ipsy turns dark mode on at once, and an app's own setting is kept after the app is drawn again.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node aOS/scripts/ipsy-settings-test.mjs [repo root]
import { createRequire } from 'module'; import { execSync } from 'child_process'; import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/'); const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const { SETTING_IDS } = await import(path.join(ROOT, 'server/ipsy.js'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, r)); const BASE = 'http://localhost:' + server.address().port;
const b = await chromium.launch();
let failed = 0;
const report = (name, problems) => { if (problems.length) { failed++; console.log('not ok - ' + name + '\n  ' + problems.join('\n  ')); } else console.log('ok - ' + name); };
const APPS = ['calendar', 'clock', 'drinks', 'fitness', 'house', 'mail', 'meals', 'news', 'notes', 'orders', 'places', 'podcasts', 'travel', 'weather'];

// A phone, signed in, with Claude stood in for: each question gets the tool call in `claude.next`, and the tool's
// result is kept in `claude.results`.
async function phone(seed = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const user = { id: 'u1', name: 'Sarah', role: 'member', apps: {} };
  const seen = Object.fromEntries(['aos', ...APPS].map(id => [id, '999']));
  await ctx.addInitScript(([s, seen]) => { try { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('aos.sky', 'day'); localStorage.setItem('aos.helper', '{"who":"mia","name":"Ipsy"}'); localStorage.setItem('aos.seen', JSON.stringify(seen)); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.session', JSON.stringify({ t: 'x' }));
    for (const k in s) localStorage.setItem(k, s[k]); } catch {} }, [seed, seen]);
  const claude = { next: null, results: [] };
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort();
    if (!u.pathname.includes('/api/')) return r.continue();
    const route = u.pathname.slice(u.pathname.indexOf('/api/') + 5), J = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (route === 'state') return J({ storage: true, setup: true, user, plan: { id: 'pro', until: Date.now() + 9e9 } });
    if (route === 'members') return J({ members: [user] });
    if (route === 'ipsy') {
      const last = (JSON.parse(r.request().postData() || '{}').messages || []).slice(-1)[0] || {};
      const res = Array.isArray(last.content) && last.content.find(c => c.type === 'tool_result');
      if (res) { claude.results.push(res); return J({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done.' }] }); }
      return J({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu' + claude.results.length, name: claude.next.name, input: claude.next.input }] });
    }
    return J({}, 401);
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  return { ctx, p, errs, claude };
}
async function ask(p, claude, name, input, { btn = '.ipsy-btn', answer } = {}) {
  claude.next = { name, input };
  if (!await p.locator('#ipsyIn').isVisible().catch(() => false)) { await p.click(btn); await p.waitForSelector('#ipsyIn', { state: 'visible' }).catch(() => {}); }
  if (await p.locator('#ipsyOk').count()) await p.click('#ipsyOk');
  const n = claude.results.length;
  await p.fill('#ipsyIn', 'Please ' + name); await p.click('.ipsy-send');
  if (answer) { await p.waitForSelector('.ipsy-ask [data-ans="' + answer + '"]', { timeout: 10000 }); await p.click('.ipsy-ask [data-ans="' + answer + '"]'); }
  for (let t = 0; t < 60 && claude.results.length === n; t++) await p.waitForTimeout(100);
  const r = claude.results[n] || {};
  return { error: !!r.is_error, text: String(r.content || '') };
}
const openAos = async p => { await p.goto(BASE + '/aOS/'); await p.waitForSelector('#ipsySlot .ipsy-btn', { state: 'visible', timeout: 15000 }); };   // aOS opens on Home, Ipsy in its bar
const store = (p, k) => p.evaluate(k => localStorage.getItem(k), k);

// 1. the phone's list is the server's
{
  const { ctx, p, errs } = await phone(); const pr = [...errs];
  await openAos(p);
  const ids = await p.evaluate(() => AllisonOS.ipsy.settings());
  if (JSON.stringify([...ids].sort()) !== JSON.stringify([...SETTING_IDS].sort())) pr.push('the phone and the server list different settings: ' + ids.filter(i => !SETTING_IDS.includes(i)).concat(SETTING_IDS.filter(i => !ids.includes(i))).join(', '));
  for (const never of ['mail.delete_after', 'meals.never_in_a_plan', 'plan', 'notifications', 'house.address']) if (ids.includes(never)) pr.push(never + ' is on the list');
  report('the phone lists the same settings as the server, and none of the ones Ipsy must never change', pr); await ctx.close();
}

// 2. in aOS: the look of every app at once, with Undo; Clock's 24-hour time; one that asks first; refusals
{
  const { ctx, p, errs, claude } = await phone(); const pr = [...errs];
  await openAos(p);
  let r = await ask(p, claude, 'change_setting', { setting: 'look', value: 'neon' }, { btn: '#ipsySlot .ipsy-btn' });
  if (r.error) pr.push('look: ' + r.text);
  if (await p.evaluate(() => document.documentElement.dataset.look) !== 'neon') pr.push('aOS did not take Night Drive');
  if (await store(p, 'design.mail') !== 'neon' || !/"design":"neon"/.test(await store(p, 'allison-clock-v1') || '')) pr.push('not every app took Night Drive');
  const undo = p.locator('.ipsy-undo').last();
  if (!await undo.count()) pr.push('no Undo for the change'); else { await undo.click(); await p.waitForTimeout(400); if (await p.evaluate(() => document.documentElement.dataset.look) !== 'vintage') pr.push('Undo did not put Vintage back'); }
  r = await ask(p, claude, 'change_setting', { setting: 'clock.24_hour', value: 'on' });
  const clk = JSON.parse(await store(p, 'allison-clock-v1') || '{}').set || {};
  if (r.error || clk.h24 !== true || clk.h24Picked !== true) pr.push('Clock\'s 24-hour time was not set: ' + r.text + ' ' + JSON.stringify(clk));
  r = await ask(p, claude, 'change_setting', { setting: 'calendar.new_event_length', value: '30' }, { answer: 'no' });
  if ((JSON.parse(await store(p, 'allison-calendar-v1-settings') || '{}').duration) === 30) pr.push('a setting that asks first changed after No');
  r = await ask(p, claude, 'change_setting', { setting: 'calendar.new_event_length', value: '30' }, { answer: 'yes' });
  if ((JSON.parse(await store(p, 'allison-calendar-v1-settings') || '{}').duration) !== 30) pr.push('a setting that asks first did not change after Yes: ' + r.text);
  for (const [setting, value] of [['mail.delete_after', '1'], ['meals.never_in_a_plan', 'none'], ['fitness.step_goal', '999999'], ['look', 'disco'], ['ipsy.gmail_orders', 'on']]) {
    r = await ask(p, claude, 'change_setting', { setting, value });
    if (!r.error) pr.push(`${setting} = ${value} was not refused: ${r.text}`);
  }
  if (await store(p, 'ipsy.orders.gmail') === 'on') pr.push('Gmail for Ipsy was turned on');
  report('in aOS, Ipsy changes every app\'s look (with Undo) and Clock\'s 24-hour time, asks first where it should, and refuses the rest', pr); await ctx.close();
}

// 3. open_setting: an app's Settings inside aOS, and a section of aOS's Account
{
  const { ctx, p, errs, claude } = await phone(); const pr = [...errs];
  await openAos(p);
  await ask(p, claude, 'open_setting', { place: 'clock' }, { btn: '#ipsySlot .ipsy-btn' });
  let opened = false;
  for (let t = 0; t < 100 && !opened; t++) { await p.waitForTimeout(250); opened = await p.evaluate(() => [...document.querySelectorAll('iframe')].some(f => { try { const s = f.contentWindow.location.pathname.includes('/clock/') && f.contentDocument.getElementById('setSheet'); return !!s && !s.hidden; } catch { return false; } })); }
  if (!opened) pr.push('Clock\'s Settings did not open inside aOS');
  report('open_setting opens an app\'s Settings inside aOS', pr); await ctx.close();
}
{
  const { ctx, p, errs, claude } = await phone(); const pr = [...errs];
  await openAos(p);
  await ask(p, claude, 'open_setting', { place: 'aos.appearance' }, { btn: '#ipsySlot .ipsy-btn' });
  await p.waitForTimeout(800);
  if (await p.locator('[aria-controls="fLook"][aria-expanded="true"]').count() !== 1) pr.push('Account > Appearance did not open');
  report('open_setting opens a section of aOS\'s Account', pr); await ctx.close();
}

// 4. in an app: dark mode at once; the app's own setting kept once it's drawn again
{
  const { ctx, p, errs, claude } = await phone(); const pr = [...errs];
  await p.goto(BASE + '/orders/'); await p.waitForTimeout(600);
  let r = await ask(p, claude, 'change_setting', { setting: 'theme', value: 'dark' });
  if (r.error || await p.evaluate(() => document.documentElement.dataset.theme) !== 'dark') pr.push('dark mode did not apply at once: ' + r.text);
  r = await ask(p, claude, 'change_setting', { setting: 'orders.count_food', value: 'on' });
  await p.waitForEvent('load', { timeout: 8000 }).catch(() => pr.push('Orders was not drawn again'));
  await p.waitForTimeout(400);
  if (!(JSON.parse(await store(p, 'allison-orders-v1') || '{}').kinds || {}).food) pr.push('food orders were not kept: ' + r.text);
  report('in an app, Ipsy turns dark mode on at once, and the app\'s own setting is kept after it\'s drawn again', pr); await ctx.close();
}

await b.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed'); process.exit(failed ? 1 : 0);
