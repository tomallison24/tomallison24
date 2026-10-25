// Drives Ipsy (home/ipsy.js with meals/ipsy-tools.js) in Meals, in both its designs, light and dark,
// in headless Chromium at iPhone size, against the real server code (functions/meals/api: Ipsy's
// step and every route its changes go through) on an in-memory KV with a real family session, and a
// stand-in for Claude behind it (no network, no keys): Sonnet 5.5's side of the chat, and Haiku's
// plans. Checks: Ipsy in the dock beside +, covering nothing; asking once before the first question;
// the chat running the tools Claude asks for on the family's real data (the plan, the rules, the
// shopping list); one day's dinner changed, with the server's allergy check turning away a
// dinner with coconut first; a new plan made and accepted, asked first with a Yes / No card; No
// leaving it be; discarding; ticking the list; a recipe opened on screen; every change with an Undo
// that puts it back on the server; what Ipsy changed reaching the family's Google Sheet (the real
// google-sheet-sync.gs on a fake Sheet, through a stand-in for aOS's /sheet/api), an accept taken
// back leaving it; the conversation only ever added to; and no script errors or Content Security
// Policy violations. Screenshots go to the folder in SHOTS (default: none).
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node meals/scripts/ipsy-test.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';   // an in-memory Sheet for meals/google-sheet-sync.gs
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const R = path.resolve(new URL('../..', import.meta.url).pathname);
const { onRequest, IPSY_SYSTEM } = await import(path.join(R, 'functions/meals/api/[[route]].js'));
const { issue, putJSON } = await import(path.join(R, 'server/auth.js'));
const SHOTS = process.env.SHOTS || '';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(R, p);
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;

// ---- the stand-in for Haiku: every meal it is asked for, built around the food its line names ----
const meal = (title, cuisine, meat = 'chicken thighs', extra = {}) => ({ title, cuisine, method: 'skillet', minutes: 30, why: 'Quick on a weeknight.', veg: ['broccoli', 'carrots'], protein: 35,
  ingredients: [{ item: meat, qty: '1.5 lb' }, { item: 'broccoli', qty: '1 lb' }, { item: 'olive oil', qty: '1 tbsp', pantry: true }], steps: ['Brown the meat.', 'Add the rest and simmer.'], ...extra });
const PLANS = {
  chicken: ['Chicken tacos', 'Chicken tikka masala', 'Lemon chicken orzo soup', 'Teriyaki chicken bowls'],
  pork: ['Pork carnitas', 'Pork ramen', 'Pork schnitzel', 'Pork souvlaki'],
  beef: ['Beef bulgogi bowls', 'Beef and bean chili', 'Bolognese with penne', 'Beef kofta wraps'],
};
let planAsked = 0;
function haiku(b) {
  planAsked++;
  const p = b.messages[0].content, lines = [...p.matchAll(/^- (d\d-\w+) \(.*built around (\w+)/gm)];
  const again = /make different dishes: .*Beef bulgogi/.test(p);
  const meals = lines.map(([, key, food], i) => { const names = PLANS[food] || PLANS.chicken; return { key, ...meal((again ? [...names].reverse() : names)[i % names.length], 'Any', food) }; });
  return { content: [{ type: 'text', text: JSON.stringify({ meals, tip: 'Buy it in one family pack.' }) }], stop_reason: 'end_turn' };
}

// ---- the stand-in for Claude (Sonnet 5.5): each question has a script, one turn a step ----
let uid = 0;
const use = (...calls) => ({ stop_reason: 'tool_use', content: [{ type: 'thinking', thinking: '', signature: 'sig-' + 'x'.repeat(20) }, ...calls.map(([name, input]) => ({ type: 'tool_use', id: 'toolu_' + (++uid), name, input }))] });
const end = text => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });
const parsed = r => { try { return JSON.parse(r.content); } catch { return r.content; } };
const GREEK = { title: 'Sheet-pan Greek lemon chicken', cuisine: 'Greek', method: 'sheet pan', minutes: 35, why: 'Bright and easy.', veg: ['lemons', 'red onion', 'peppers'], protein: 40,
  ingredients: [{ item: 'chicken thighs', qty: '2 lb' }, { item: 'lemons', qty: '2' }, { item: 'olive oil', qty: '2 tbsp', pantry: true }], steps: ['Roast everything at 425°F for 30 minutes.'] };
const CURRY = { ...GREEK, title: 'Thai green curry', cuisine: 'Thai', ingredients: [{ item: 'chicken thighs', qty: '2 lb' }, { item: 'coconut milk', qty: '1 can' }] };
const SCRIPTS = [
  { re: /swap day 2/i, turns: [
    () => use(['get_meals', {}]),
    () => use(['set_meal', { plan: 'current', day: 2, slot: 'dinner', meal: CURRY }]),          // the check turns this one away
    r => { assert.equal(r[0].is_error, true); assert.match(r[0].content, /never eats coconut/); return use(['set_meal', { plan: 'current', day: 2, slot: 'dinner', meal: GREEK }]); },
    () => end('Done! Night 2 is now **Sheet-pan Greek lemon chicken**.'),
  ] },
  { re: /pork week/i, turns: [
    () => use(['get_meals', {}]),
    () => use(['make_plan', { meals: ['dinner'], foods: ['pork'], days: 3, people: 4 }]),
    r => { assert.equal(parsed(r[0]).saved, false); return use(['accept_plan', {}]); },
    r => { assert.equal(parsed(r[0]).accepted, true); return end('Saved 3 pork dinners for the family, from today.'); },
  ] },
  { re: /beef plan/i, turns: [
    () => use(['make_plan', { foods: ['beef'], days: 4 }]),
    () => end('Here’s a beef plan, waiting for you to accept it.'),
  ] },
  { re: /another go/i, turns: [
    () => use(['make_plan', { foods: ['beef'], days: 4, again: true }]),
    r => { assert.equal(parsed(r[0]).made, false); return end('OK, I left it as it was.'); },
  ] },
  { re: /throw it away/i, turns: [
    () => use(['discard_draft', {}]),
    r => { assert.equal(parsed(r[0]).discarded, true); return end('Discarded it. This week’s plan stays.'); },
  ] },
  { re: /tick/i, turns: [
    () => use(['get_shopping_list', {}]),
    r => { const items = parsed(r[0]).sections.flatMap(s => s.items).map(i => i.item); return use(['tick_items', { items: [items[0], 'unicorn steak'] }]); },
    r => { assert.deepEqual(parsed(r[0]).notOnTheList, ['unicorn steak']); return end('Ticked it off.'); },
  ] },
  { re: /show me day 1/i, turns: [
    () => use(['get_recipes', { plan: 'current', days: [1] }], ['show_meal', { plan: 'current', day: 1 }]),
    () => end('It’s open behind the chat.'),
  ] },
];
const sent = [], results = [];
function claude(b) {
  assert.equal(b.model, 'claude-sonnet-5-5'); assert.equal(b.system[0].text, IPSY_SYSTEM);
  const msgs = b.messages; sent.push(msgs);
  let qi = msgs.length - 1; while (qi > 0 && !(msgs[qi].role === 'user' && msgs[qi].content.some(x => x.type === 'text'))) qi--;
  const q = msgs[qi].content.filter(x => x.type === 'text').map(x => x.text).slice(1).join(' ');
  const step = msgs.slice(qi).filter(m => m.role === 'assistant').length;
  const last = msgs[msgs.length - 1], r = last.role === 'user' ? last.content.filter(x => x.type === 'tool_result') : [];
  r.forEach(x => results.push(x));
  const s = SCRIPTS.find(x => x.re.test(q));
  const turn = s && s.turns[step];
  return { id: 'msg_' + sent.length, type: 'message', role: 'assistant', model: b.model, ...(turn ? turn(r, msgs) : end('Hello!')) };
}
const ai = async (url, init) => {
  const b = JSON.parse(init.body);
  if (b.tools && b.tools.some(t => t.name === 'set_meal')) {
    try { return new Response(JSON.stringify(claude(b))); }
    catch (e) { console.log('  stand-in:', e.message); return new Response(JSON.stringify({ type: 'error', error: { message: e.message } }), { status: 400 }); }
  }
  await new Promise(r => setTimeout(r, 100));
  return new Response(JSON.stringify(haiku(b)));
};

// ---- a family with this week's plan (chicken dinners) ----
async function family() {
  const m = new Map();
  const db = { m, get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, String(v)); }, delete: async k => { m.delete(k); } };
  await db.put('owner', 'O1'); await putJSON(db, 'user:O1', { id: 'O1', name: 'Tom', role: 'owner', creds: [], created: Date.now() - 864e5 });
  const tok = await issue(db, 'O1'), env = { ACCOUNTS: db, ANTHROPIC_API_KEY: 'test' };
  const go = async (route, body) => {
    const res = await onRequest({ request: new Request('https://x/meals/api/' + route, { method: 'POST', headers: { 'X-Meals': '1', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) }), params: { route: [route] }, env }, ai);
    return res.json();
  };
  await go('plan', { slots: ['dinner'], foods: ['chicken'], days: 4, people: 4 });
  await go('accept', {});
  return { db, m, tok, env };
}
const plan = m => JSON.parse(m.get('meals:plan') || 'null');
const draft = m => JSON.parse(m.get('meals:draft') || 'null');
const until = async (fn, what, ms = 5000) => { const t = Date.now(); while (!(await fn())) { if (Date.now() - t > ms) throw new Error('timed out: ' + what); await new Promise(r => setTimeout(r, 40)); } };

const browser = await chromium.launch();
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n  ', e.message.split('\n').slice(0, 8).join('\n   ')); } };
const texts = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));

async function phone(design, scheme) {
  const fam = await family();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.route('**/meals/api/**', async route => {
    const rq = route.request(), u = new URL(rq.url());
    const res = await onRequest({ request: new Request(u.href, { method: rq.method(), headers: rq.headers(), body: rq.method() === 'POST' ? rq.postData() : undefined }), params: { route: u.pathname.split('/meals/api/')[1].split('/') }, env: fam.env }, ai);
    route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
  });
  // the family's Google Sheet, through aOS (functions/sheet/api, stood in for here)
  const sheet = fakeSheet(path.join(R, 'meals/google-sheet-sync.gs'), 'test-secret-phrase'), sheetCalls = [];
  await ctx.route('**/sheet/api/**', route => {
    const rq = route.request();
    if (rq.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":true}' });
    sheetCalls.push(JSON.parse(rq.postData()));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sheet.post(rq.postData(), { key: 'test-secret-phrase', who: 'O1', name: 'Tom', owner: '1' })) });
  });
  await ctx.route(/^https?:\/\/(?!localhost)/, route => route.abort());
  await ctx.addInitScript(([t, design]) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('aos.seen', JSON.stringify({ meals: '999' }));
    localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.sky', 'day'); localStorage.setItem('design.meals', design);
    localStorage.setItem('aos.session', JSON.stringify({ token: t, user: { id: 'O1', name: 'Tom', role: 'owner' }, at: Date.now() }));
    sessionStorage.setItem('seeded', '1');
  }, [fam.tok, design]);
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(String(e)));
  page.on('console', msg => { if ((msg.type() === 'error' && !/Failed to load resource|net::ERR/.test(msg.text())) || (msg.type() === 'warning' && /Ipsy|Content Security/.test(msg.text()))) problems.push(msg.text()); });
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => console.error('CSP: ' + e.violatedDirective + ' ' + e.blockedURI)));
  await page.goto(BASE + '/meals/');
  await page.waitForFunction(() => window.__meals && window.__meals.st.state === 'ok', null, { timeout: 10000 });
  await page.click('#tabs [data-tab="plan"]');
  await page.waitForFunction(() => document.querySelectorAll('#main [data-meal]').length === 4, null, { timeout: 10000 });
  return { ...fam, ctx, page, problems, sheet, sheetCalls };
}
async function ask(page, q) {
  await page.fill('#ipsyIn', q);
  await page.press('#ipsyIn', 'Enter');
}
const idle = page => page.waitForFunction(() => !window.AllisonOS.ipsy || !document.querySelector('.ipsy-send').disabled, null, { timeout: 15000 });

// Ipsy sits in the dock and covers nothing, in every design and light or dark.
for (const [design, scheme] of [['glass', 'light'], ['glass', 'dark'], ['vintage', 'light'], ['vintage', 'dark']]) {
  const { ctx, page, problems } = await phone(design, scheme);
  await step('meals (' + design + ', ' + scheme + '): Ipsy sits in the dock beside +, wearing the design, and covers nothing on any tab', async () => {
    assert.equal(await page.$$eval('.dock > span .ipsy-btn', e => e.length), 1);
    assert.equal(await page.$eval('.ipsy-btn', (e, d) => e.classList.contains('ipsy-' + d), design), true);
    for (const tab of ['ipsy', 'plan', 'list']) {
      await page.click('#tabs [data-tab="' + tab + '"]');
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(150);
      const g = await page.evaluate(() => {
        const b = document.querySelector('.ipsy-btn').getBoundingClientRect(), fab = document.getElementById('fab');
        const f = fab.hidden ? null : fab.getBoundingClientRect();
        // every control in the page, at the bottom of the scroll: none under Ipsy
        const under = [...document.querySelectorAll('#main button, #main select, #main a, #main input, .toast')].filter(el => el.offsetParent).map(el => [el, el.getBoundingClientRect()])
          .filter(([, r]) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top).map(([el]) => el.outerHTML.slice(0, 80));
        return { b: [b.left, b.top, b.right, b.bottom], f: f && [f.left, f.top, f.right, f.bottom], W: innerWidth, H: innerHeight, under, wide: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      assert.ok(g.b[0] >= 8 && g.b[2] < g.W / 2 && g.b[3] <= g.H, 'bottom left: ' + g.b);
      if (g.f) assert.ok(g.f[0] > g.b[2] + 100, '+ stays on the right');
      assert.deepEqual(g.under, [], tab);
      assert.equal(g.wide, false);
    }
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'meals-' + design + '-' + scheme + '-list.png') });
    await page.click('#tabs [data-tab="plan"]');
    if (SHOTS) { await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(1200); await page.screenshot({ path: path.join(SHOTS, 'meals-' + design + '-' + scheme + '.png') }); }
  });
  await step('meals (' + design + ', ' + scheme + '): no script errors and nothing blocked by the page policy', async () => assert.deepEqual(problems, []));
  await ctx.close();
}

for (const [design, scheme] of [['glass', 'light'], ['vintage', 'dark']]) {
  const tag = 'meals (' + design + ')';
  const { ctx, page, problems, m, sheet, sheetCalls } = await phone(design, scheme);
  let pork = null;
  const n0 = sent.length, r0 = results.length;
  const first = plan(m);

  await step(tag + ': Ipsy opens a chat that asks once before the first question', async () => {
    await page.click('.ipsy-btn');
    await page.waitForSelector('.ipsy-bubble');
    assert.match(await page.textContent('.ipsy-consent'), /Anthropic.*Everyone in the family sees.*Undo.*asks first/);
    assert.equal(await page.$eval('#ipsyIn', e => e.disabled), true, 'nothing is sent before OK');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'meals-' + design + '-consent.png') });
    await page.click('#ipsyOk');
    assert.equal(await page.$$eval('.ipsy-chip[data-ask]', e => e.length), 4);
  });

  await step(tag + ': one dinner swapped: the allergy check turns away a curry with coconut, then the new dinner is saved for the family', async () => {
    await ask(page, 'Swap day 2 for something Greek');
    await page.waitForFunction(() => /Night 2 is now/.test(document.querySelector('.ipsy-log').textContent), null, { timeout: 15000 });
    await idle(page);
    const p = plan(m);
    assert.equal(p.id, first.id); assert.equal(p.meals[1].title, 'Sheet-pan Greek lemon chicken'); assert.equal(p.meals[0].title, first.meals[0].title);
    assert.equal(JSON.parse(m.get('meals:log'))[0].titles[1], 'Sheet-pan Greek lemon chicken');
    assert.ok((await texts(page, '#main [data-meal] .ct')).includes('Sheet-pan Greek lemon chicken'), 'on screen behind the chat');
    const ch = await texts(page, '.ipsy-change');
    assert.equal(ch.length, 1, 'only the dinner that was saved'); assert.match(ch[0], /^\w{3}, \w{3} \d+ dinner: Chicken tikka masala → Sheet-pan Greek lemon chicken ?Undo$/);
    // what Claude saw: the family's Meals, the allergy list first among them
    const q = sent[n0];
    assert.match(q[0].content[0].text, /^\[From the app: today is \w+day, .* \(\d{4}-\d\d-\d\d\)\. Meals: the family’s plan is 4 meals \(Chicken · dinner · for 4\), .* Rules: at least 2 vegetables and good protein in every meal, cooking for 4\. Never in a plan: tree nuts, coconut\. On screen: the Plan tab\.\]$/, q[0].content[0].text);
    const meals = JSON.parse(results.slice(r0).find(r => /"avoid"/.test(r.content)).content);
    assert.deepEqual(meals.avoid, ['tree nuts', 'coconut']); assert.equal(meals.plan.schedule.length, 4); assert.equal(meals.rules.vegetablesInEveryMeal, 2); assert.equal(meals.stores, undefined);
    const acts = await texts(page, '.ipsy-act');
    assert.ok(acts.includes('Looking at the family’s meals') && acts.includes('Changing dinner on day 2'), acts.join(' | '));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'meals-' + design + '-chat.png') });
  });

  await step(tag + ': Undo puts the night back, on the server', async () => {
    await page.locator('.ipsy-change .ipsy-undo').first().click();
    await until(() => plan(m).meals[1].title === first.meals[1].title, 'the night back');
    assert.deepEqual(plan(m).meals, first.meals);
    await page.waitForFunction(t => [...document.querySelectorAll('#main [data-meal] .ct')].some(e => e.textContent === t), first.meals[1].title);
    assert.equal(await page.$$eval('.ipsy-change.undone', e => e.length), 1);
  });

  await step(tag + ': a new plan made, then accepted after a Yes in the chat; Undo takes each back', async () => {
    await ask(page, 'Plan a pork week and save it');
    await page.waitForSelector('.ipsy-ask [data-ans="yes"]', { timeout: 15000 });
    assert.match(await page.textContent('.ipsy-ask'), /Save the new plan \(3 meals \(Pork · dinner · for 4\)\) for the family, from \w{3}, \w{3} \d+\? It takes the place of the current plan \(4 meals \(Chicken · dinner · for 4\)\) for everyone/);
    assert.equal(draft(m).meals.length, 3, 'the new plan waits, not saved yet'); assert.equal(plan(m).id, first.id, 'nothing accepted before the Yes');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'meals-' + design + '-ask.png') });
    await page.click('.ipsy-ask [data-ans="yes"]');
    await page.waitForFunction(() => /Saved 3 pork dinners/.test(document.querySelector('.ipsy-log').textContent), null, { timeout: 15000 });
    await idle(page);
    const p = plan(m);
    assert.deepEqual(p.meals.map(x => x.title), ['Pork carnitas', 'Pork ramen', 'Pork schnitzel']); assert.equal(draft(m), null);
    pork = p.id;
    assert.equal(JSON.parse(m.get('meals:log')).length, 2);
    const ch = (await texts(page, '.ipsy-change')).slice(-2);
    assert.match(ch[0], /^Made a new plan: 3 meals \(Pork · dinner · for 4\) \(not saved yet\) ?Undo$/); assert.match(ch[1], /^Saved the new plan for the family, from \w{3}, \w{3} \d+ ?Undo$/);
    // Undo the accept: the chicken plan is the family's again, the pork plan waits
    await page.locator('.ipsy-change .ipsy-undo').last().click();
    await until(() => plan(m).id === first.id && draft(m) && draft(m).foods[0] === 'pork', 'the accept taken back');
    assert.equal(JSON.parse(m.get('meals:log')).length, 1);
    await page.waitForFunction(() => /New plan · not saved yet/.test(document.getElementById('main').textContent));
    // Undo the new plan: it goes
    await page.locator('.ipsy-change .ipsy-undo').last().click();
    await until(() => !m.get('meals:draft'), 'the new plan gone');
    assert.equal(plan(m).id, first.id);
    await page.waitForFunction(() => !/not saved yet/.test(document.getElementById('main').textContent));
  });

  await step(tag + ': a new plan in place of one waiting is asked first, and No leaves it', async () => {
    await ask(page, 'Make a beef plan');
    await page.waitForFunction(() => /beef plan, waiting/.test(document.querySelector('.ipsy-log').textContent), null, { timeout: 15000 });
    await idle(page);
    const d = draft(m); assert.deepEqual(d.foods, ['beef']);
    const asked = planAsked;
    await ask(page, 'Give it another go');
    await page.waitForSelector('.ipsy-ask [data-ans="no"]', { timeout: 15000 });
    assert.match((await texts(page, '.ipsy-ask')).at(-1), /Make a new plan in place of the one waiting \(4 meals \(Beef · dinner · for 4\), by Tom\)\?/);
    await page.locator('.ipsy-ask [data-ans="no"]').last().click();
    await page.waitForFunction(() => /left it as it was/.test(document.querySelector('.ipsy-log').textContent), null, { timeout: 15000 });
    await idle(page);
    assert.deepEqual(draft(m), d, 'unchanged'); assert.equal(planAsked, asked, 'no plan asked for');
    assert.match((await texts(page, '.ipsy-ask')).at(-1), /You said no, so nothing changed/);
  });

  await step(tag + ': discarding the new plan is asked first; Undo puts it back as it was', async () => {
    const d = draft(m);
    await ask(page, 'Throw it away');
    await page.waitForSelector('.ipsy-ask [data-ans="yes"]:not([disabled])', { timeout: 15000 });
    assert.match((await texts(page, '.ipsy-ask')).at(-1), /Discard the new plan waiting \(4 meals \(Beef · dinner · for 4\), by Tom\)\? It goes for everyone in the family/);
    await page.locator('.ipsy-ask [data-ans="yes"]').last().click();
    await page.waitForFunction(() => /Discarded it/.test(document.querySelector('.ipsy-log').textContent), null, { timeout: 15000 });
    await idle(page);
    assert.equal(draft(m), null);
    await page.locator('.ipsy-change .ipsy-undo').last().click();
    await until(() => !!draft(m), 'the new plan back');
    assert.deepEqual(draft(m), d, 'just as it was');
    await page.waitForFunction(() => /New plan · not saved yet/.test(document.getElementById('main').textContent));
    // (and away again, the app's own way, for what's next)
    await page.evaluate(() => fetch('../meals/api/discard', { method: 'POST', headers: { 'X-Meals': '1', 'Content-Type': 'application/json', Authorization: 'Bearer ' + JSON.parse(localStorage.getItem('aos.session')).token }, body: '{}' }));
    await page.evaluate(() => window.__meals.load());
  });

  await step(tag + ': ticking the shopping list, on this phone; Undo unticks', async () => {
    await ask(page, 'Tick the first thing on the list');
    await page.waitForFunction(() => /Ticked it off/.test(document.querySelector('.ipsy-log').textContent), null, { timeout: 15000 });
    await idle(page);
    const ticks = await page.evaluate(() => JSON.parse(localStorage.getItem('allison-meals-v1-ticks')));
    assert.equal(ticks.keys.length, 1); assert.equal(ticks.at, plan(m).at);
    await page.locator('.ipsy-change .ipsy-undo').last().click();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('allison-meals-v1-ticks')).keys), []);
  });

  await step(tag + ': a recipe opened on screen behind the chat', async () => {
    await ask(page, 'Show me day 1');
    await page.waitForFunction(() => /open behind the chat/.test(document.querySelector('.ipsy-log').textContent), null, { timeout: 15000 });
    await idle(page);
    const full = JSON.parse(results.slice(r0).findLast(r => /"steps"/.test(r.content)).content);
    assert.equal(full.meals.length, 1); assert.equal(full.meals[0].title, 'Chicken tacos'); assert.ok(full.meals[0].steps.length && full.meals[0].ingredients.length);
    assert.equal(await page.$eval('#recipeSheet', e => e.hidden), false);
    assert.match(await page.textContent('#recipeBody'), /Chicken tacos/);
    await page.keyboard.press('Escape');
  });

  await step(tag + ': what Ipsy changed reaches the family’s Google Sheet; the accept taken back leaves it', async () => {
    await until(() => sheetCalls.some(c => c.graves && c.graves['plans:' + pork]), 'the taken-back plan’s grave sent', 8000);
    await until(() => sheet.tab('Plans') && !sheet.tab('Plans').some(r => r[16] === pork), 'out of Plans', 8000);
    const kept = sheet.tab('_plans').slice(1).map(r => JSON.parse(r.slice(2).join(''))).find(x => x.id === first.id);
    assert.deepEqual(kept.meals.map(x => x.title), plan(m).meals.map(x => x.title), 'the family’s plan, as the family server has it');
    assert.ok(sheetCalls.every(c => !('secret' in c)), 'no phrase from the phone');
  });

  await step(tag + ': the conversation is only ever added to, between steps and questions', async () => {
    const mine = sent.slice(n0);
    assert.ok(mine.length >= 15, String(mine.length));
    for (let i = 1; i < mine.length; i++) assert.deepEqual(mine[i].slice(0, mine[i - 1].length), mine[i - 1], 'step ' + i + ' changed an earlier message');
    assert.deepEqual(mine[1][1].content[0], { type: 'thinking', thinking: '', signature: 'sig-' + 'x'.repeat(20) }, 'thinking goes back unchanged');
  });

  await step(tag + ': no script errors and nothing blocked by the page policy', async () => assert.deepEqual(problems, []));
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
