// Meals at iPhone size (390 x 844), against the real server code
// (functions/meals/api) on an in-memory KV with a real family session, and a
// stand-in for the AI service (no network, no key): no key yet, the Ipsy tab (the
// planner: one card, a row a step showing what's picked, kept on the phone; the plan
// waiting shows what it was asked with, and Edit choices takes them back), a plan (Try again, Accept), a
// recipe (rated, Swap), the shopping list (ticks kept, the list there offline), the
// plan folded away and cleared (with Undo), a plan that keeps using coconut never
// saved, the family's rules in Settings, the family's Google Sheet through aOS (the
// real google-sheet-sync.gs on a fake Sheet, with who's asking from each phone's
// session: not set up, signed out, the old link handed over, what is sent and when,
// whose rows, plans read back from it, a plan taken back), and no script errors or
// sideways scrolling in light and dark. Seeds localStorage['aos.seen'] so the walkthrough stays away.
// Both designs (../home/design.js): Vintage, the default, drawn in the Retro look (the sky held at day,
// aos.sky), and Standard (Sea glass); Settings > Design switches between them at once and keeps the
// choice; and the old Meals Vintage address (served from meals/, as the deploy does) moves that app's
// data on the phone over to Meals' names.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node meals/scripts/app-test.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fakeSheet } from '../../drinks/scripts/fake-sheet.mjs';   // an in-memory Sheet; the script under test is meals/google-sheet-sync.gs
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const R = path.resolve(new URL('../..', import.meta.url).pathname);
const { onRequest } = await import(path.join(R, 'functions/meals/api/[[route]].js'));
const { issue, putJSON } = await import(path.join(R, 'server/auth.js'));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  p = p.replace(/^\/mealsvintage\//, '/meals/');   // the old Meals Vintage address: the deploy copies meals/ there (news.yml)
  const f = path.join(R, p);
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;

const m = new Map();
const db = { get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, String(v)); }, delete: async k => { m.delete(k); } };
await db.put('owner', 'O1'); await putJSON(db, 'user:O1', { id: 'O1', name: 'Tom', role: 'owner', creds: [], created: Date.now() - 864e5 });
await putJSON(db, 'user:E1', { id: 'E1', name: 'Ella Allison', role: 'member', creds: [], created: Date.now() - 864e5 });
const tok = await issue(db, 'O1'), tok2 = await issue(db, 'E1');
const PEOPLE = { [tok]: { id: 'O1', name: 'Tom', role: 'owner' }, [tok2]: { id: 'E1', name: 'Ella Allison', role: 'member' } };

// The family's Google Sheet: the real Apps Script, on an in-memory Sheet, reached through aOS
// (functions/sheet/api, stood in for here): each phone's session says who's asking.
const SHEET_URL = 'https://script.google.com/macros/s/TEST/exec', SHEET_SECRET = 'test-secret-phrase';
const GS = path.join(R, 'meals/google-sheet-sync.gs');
let sheet = fakeSheet(GS, SHEET_SECRET), sheetSet = true;
const sheetCalls = [], claims = [];
let sheetRefused = 0;   // syncs aOS answered 'no-sheet' (not set up in aOS yet)
let sheetFail = '';     // when set, the Sheet answers every sync with this error
// Notes' Sheet (Add to Notes: the shopping list into the Groceries list in Notes, home/sheet.js): the real
// Notes script on an in-memory Sheet of its own, at /sheet/api/notes; notesSet false: not set up in aOS yet
const notesSheet = fakeSheet(path.join(R, 'notes/google-sheet-sync.gs'), SHEET_SECRET), notesCalls = [];
let notesSet = true;

// The stand-in AI (Anthropic's Messages API shape): every meal the prompt asks for, by its key.
const DISHES = ['Beef bulgogi bowls', 'Beef and bean chili', 'Bolognese with penne', 'Beef kofta wraps', 'Beef and broccoli stir-fry', 'Steak fajitas', 'Beef pho'];
let coconut = false, asked = 0, made = 0;
const opted = [];   // what the options were asked with
const ai = async (url, init) => {
  asked++;
  const b = JSON.parse(init.body), keys = [...String(b.messages[0].content).matchAll(/^- (d\d-\w+) \(/gm)].map(x => x[1]);
  const lines = String(b.messages[0].content).split('\n');
  if (/^Suggest/.test(b.messages[0].content)) {   // the options: three dishes a meal, each a title and a line
    opted.push(b.messages[0].content);
    await new Promise(r => setTimeout(r, 200));
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ meals: keys.map(key => ({ key, options: [1, 2, 3].map(n => ({ title: 'Pick ' + n + ' for ' + key, about: 'Option ' + n + ', nice and easy.',
      cuisine: 'Greek', minutes: 25 + n * 5, starter: /as \d courses: .*starter/.test(lines.find(l => l.startsWith('- ' + key + ' (')) || '') ? 'Soup ' + n : '', dessert: '' })) })) }) }], stop_reason: 'end_turn' }));
  }
  const picked = key => (/: "([^"]+)"/.exec(lines.find(l => l.startsWith('- ' + key + ' (')) || '') || [])[1];
  const meals = keys.map(key => { const cs = /as \d courses: (.*)$/.exec(lines.find(l => l.startsWith('- ' + key + ' (')) || '');
    const meal = { key, title: picked(key) || DISHES[made++ % DISHES.length], cuisine: 'Korean', method: 'skillet', minutes: 30, why: 'Quick on a weeknight.',
      veg: ['broccoli', 'carrots', 'spring onions'], protein: 38, fridge: [],
      ingredients: [{ item: 'ground beef', qty: '1.5 lb' }, { item: 'broccoli', qty: '1 lb' }, { item: 'olive oil', qty: '1 tbsp', pantry: true }, ...(coconut ? [{ item: 'coconut milk', qty: '1 can' }] : [])],
      steps: ['Brown the beef.', 'Add the rest and simmer.'] };
    if (!cs) return meal;
    // a dinner of courses: a beet salad first, pears after
    const want = cs[1].split(', ').map(w => w.replace(/^an? /, ''));
    return { ...meal, steps: [], ingredients: [...meal.ingredients.map(x => ({ ...x, course: 'main' })), ...(want.includes('starter') ? [{ item: 'beets', qty: '1 lb', course: 'starter' }] : []),
      ...(want.includes('dessert') ? [{ item: 'pears', qty: '4', course: 'dessert' }] : [])],
      courses: want.map(c => ({ course: c, title: { starter: 'Roast beet salad', main: meal.title, dessert: 'Poached pears' }[c], steps: { starter: ['Roast the beets.'], main: meal.steps, dessert: ['Poach the pears.'] }[c] })) }; });
  await new Promise(r => setTimeout(r, 300));
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ meals, tip: 'Buy the beef in one family pack.' }) }], stop_reason: 'end_turn' }));
};
let env = { ACCOUNTS: db }, down = false;

const browser = await chromium.launch();
let failed = 0;
const ok = (label, cond, extra) => { if (!cond) failed++; console.log((cond ? 'ok - ' : 'not ok - ') + label + (extra ? '  ' + extra : '')); };

async function phone(scheme = 'light', { design = null, seed = null, at = '/meals/', as = tok } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.route('**/meals/api/**', async route => {
    if (down) return route.abort('internetdisconnected');
    const rq = route.request(), u = new URL(rq.url());
    const res = await onRequest({ request: new Request(u.href, { method: rq.method(), headers: rq.headers(), body: rq.method() === 'POST' ? rq.postData() : undefined }), params: { route: u.pathname.split('/meals/api/')[1].split('/') }, env }, ai);
    route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
  });
  await ctx.route('**/sheet/api/**', route => {
    const rq = route.request(), who = PEOPLE[(rq.headers().authorization || '').replace('Bearer ', '')];
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (rq.headers()['x-sheet'] !== '1') return json({ error: 'header' }, 400);
    if (!who) return json({ error: 'signin' }, 401);
    if (/\/sheet\/api\/notes$/.test(new URL(rq.url()).pathname)) {
      if (!notesSet) return json({ ok: false, error: 'no-sheet' }, 409);
      notesCalls.push({ who: who.id, body: JSON.parse(rq.postData()) });
      return json(notesSheet.post(rq.postData(), { key: SHEET_SECRET, who: who.id, name: who.name.split(' ')[0], ...(who.role === 'owner' ? { owner: '1' } : {}) }));
    }
    if (rq.url().endsWith('/claim')) { claims.push({ who: who.id, ...JSON.parse(rq.postData()) }); sheetSet = true; return json({ configured: true }); }
    if (rq.method() === 'GET') return json({ configured: sheetSet });
    if (sheetFail && rq.method() === 'POST') return json({ ok: false, error: sheetFail });
    if (!sheetSet) { sheetRefused++; return json({ ok: false, error: 'no-sheet' }, 409); }
    sheetCalls.push({ who: who.id, body: JSON.parse(rq.postData()) });
    return json(sheet.post(rq.postData(), { key: SHEET_SECRET, who: who.id, name: who.name.split(' ')[0], ...(who.role === 'owner' ? { owner: '1' } : {}) }));
  });
  await ctx.route(/^https?:\/\/(?!localhost)/, route => route.abort());   // no phone talks to Google itself any more
  await ctx.addInitScript(([t, user, design, seed]) => {
    if (!sessionStorage.getItem('seeded')) {
      if (seed) for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      else localStorage.setItem('aos.seen', JSON.stringify({ meals: '999' }));
      localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.sky', 'day');
      if (design) localStorage.setItem('design.meals', design);
      localStorage.setItem('aos.session', JSON.stringify({ token: t, user, at: Date.now() }));
      sessionStorage.setItem('seeded', '1');
    }
  }, [as, PEOPLE[as], design, seed]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error' && !/Failed to load resource|net::ERR/.test(msg.text())) errs.push(msg.text()); });
  await page.goto(BASE + at);
  await page.waitForTimeout(800);
  return { ctx, page, errs };
}
const text = (page, sel) => page.evaluate(s => [...document.querySelectorAll(s)].map(e => e.textContent.trim()), sel);
// SHOTS=<folder> saves screenshots of each screen, to look at.
const shot = async (page, name) => { if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, name + '.png') }); };
const wide = page => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

// The Ipsy tab, from what you fancy to a plan: dinners for 3 days, for 4 (foods: picked first)
const planIt = async (page, { foods = [], days = 3, people = 4 } = {}) => {
  if ((await page.getAttribute('#tabs [data-tab="ipsy"]', 'aria-pressed')) !== 'true') { await page.click('#tabs [data-tab="ipsy"]'); await page.waitForTimeout(200); }
  if (foods.length) { await page.click('[data-step="foods"]'); for (const f of foods) await page.click('[data-food="' + f + '"]'); }
  await page.click('[data-step="days"]'); await page.click('[data-days="' + days + '"]'); await page.click('[data-people="' + people + '"]');
  await page.click('[data-act="make"]'); await recipesNow(page);
};
// the options come up on the Plan tab: the first of each is picked; Get the recipes writes the plan
const recipesNow = async page => { await page.waitForSelector('[data-act="recipes"]', { timeout: 8000 }); await page.click('[data-act="recipes"]'); };
const toPlan = async page => { if ((await page.getAttribute('#tabs [data-tab="plan"]', 'aria-pressed')) !== 'true') { await page.click('#tabs [data-tab="plan"]'); await page.waitForTimeout(300); } };

{ // no key yet
  const { ctx, page, errs } = await phone();
  ok('it opens on Ipsy', (await page.getAttribute('#tabs [data-tab="ipsy"]', 'aria-pressed')) === 'true' && await page.isVisible('#main .card.planner'));
  ok('no AI key: Make the plan is off', await page.locator('[data-act="make"]').isDisabled());
  await page.click('#setBtn'); await page.waitForTimeout(300);
  ok('no AI key: Settings say so', (await page.textContent('#setBody')).includes('Not set up yet'));
  ok('the family\'s rules and allergies show in Settings', (await page.textContent('#sVeg')) === '2' && (await page.getAttribute('#sProtein [data-value="good"]', 'aria-checked')) === 'true'
    && (await page.inputValue('#sPeople')) === '4' && (await page.inputValue('#sWeek')) === '40' && (await text(page, '#avoid [data-avoid]')).join('|') === 'Tree nuts ✕|Coconut ✕');
  ok('no deals anywhere', (await page.locator('#tabs [data-tab="deals"]').count()) === 0 && !/deal|store/i.test(await page.textContent('#setBody')));
  ok('no script errors', !errs.length, errs.join(' | '));
  await ctx.close();
}
env = { ACCOUNTS: db, ANTHROPIC_API_KEY: 'test' };
{ // Ipsy asks, a plan, a recipe, the list
  const { ctx, page, errs } = await phone();
  ok('Ipsy says hi by name and asks what we\'re eating', /^Hi Tom\. What are we eating\?/.test((await text(page, '#main .bub'))[0]));
  ok('Dinner is picked to start, and the family\'s rules show under the picks', (await page.getAttribute('[data-slot="dinner"]', 'aria-checked')) === 'true'
    && (await page.getAttribute('[data-slot="lunch"]', 'aria-checked')) === 'false' && /2\+ vegetables and about 30 g protein in every meal · never tree nuts and coconut/.test(await page.textContent('#main .rules')));
  const row = async k => (await page.textContent('[data-val="' + k + '"]')).trim();
  const open = async k => (await page.getAttribute('[data-step="' + k + '"]', 'aria-expanded')) === 'true';
  ok('one card, a row a step, each with what\'s picked: the usual to start', (await page.locator('#main .prow').count()) === 6 && await row('meals') === 'Dinner' && await row('courses') === 'Just a main' && await row('foods') === 'Surprise me'
    && await row('days') === '3 days' && await row('people') === '4 people' && await row('extras') === 'Optional' && await open('meals') && !(await open('foods')), (await text(page, '#main .prow')).join(' | '));
  await page.click('[data-act="next"]');
  ok('Next opens the next step, and only it: courses, for the dinners', await open('courses') && !(await open('meals')) && (await page.locator('[data-slot]').count()) === 0
    && (await text(page, '[data-courses]')).join('|') === 'Just a main|Starter + main|Main + dessert|All three' && (await page.getAttribute('[data-courses="main"]', 'aria-checked')) === 'true');
  await page.click('[data-courses="main"]');
  ok('a course picked, and the food step opens', await open('foods') && !(await open('courses')));
  await page.click('[data-food="beef"]'); await page.click('[data-food="surprise"]');
  ok('Surprise me and the foods take turns', (await page.getAttribute('[data-food="beef"]', 'aria-checked')) === 'false' && (await page.getAttribute('[data-food="surprise"]', 'aria-checked')) === 'true');
  await page.click('[data-food="beef"]');
  ok('picking a food, and its row says so', (await page.getAttribute('[data-food="beef"]', 'aria-checked')) === 'true' && (await page.getAttribute('[data-food="surprise"]', 'aria-checked')) === 'false' && await row('foods') === 'Beef');
  await page.click('[data-step="meals"]');
  ok('a row opens its step again (and closes the open one)', await open('meals') && !(await open('foods')));
  await page.click('[data-slot="dinner"]');
  ok('no meal picked: nothing to plan, and the row says so', await page.locator('[data-act="make"]').isDisabled() && await row('meals') === 'Pick at least one');
  await page.click('[data-slot="dinner"]');
  await page.click('[data-step="days"]');
  ok('how far ahead: three choices, 3 days to start', (await page.locator('[data-days]').count()) === 3 && (await page.getAttribute('[data-days="3"]', 'aria-checked')) === 'true');
  await page.click('[data-days="1"]'); await page.waitForTimeout(200);
  ok('a one-of choice picks, and the next step opens: how many, the usual number picked', await row('days') === 'Just today' && await open('people')
    && (await page.getAttribute('[data-people="4"]', 'aria-checked')) === 'true' && /Usually it’s 4\./.test(await page.textContent('#pb-people')));
  ok('no lunches step with dinners only', (await page.locator('[data-step="lunches"]').count()) === 0);
  await page.click('[data-step="days"]'); await page.click('[data-days="3"]'); await page.click('[data-people="4"]'); await page.waitForTimeout(200);
  ok('then the extras: quick notes, the fridge and anything else', await open('extras') && (await page.locator('[data-extra]').count()) === 6 && await page.isVisible('#fFridge') && await page.isVisible('#fNote'));
  await page.fill('#fFridge', 'half a cabbage');
  ok('what it will plan, under the steps', /Planning 3 days of dinners for 4: 3 meals, each with 2\+ vegetables and about 30 g protein\./.test(await page.textContent('#pSum')) && await row('extras') === 'Use up half a cabbage');
  await page.reload(); await page.waitForTimeout(800);
  ok('the choices are kept on the phone (opened again, they\'re all still there)', await row('foods') === 'Beef' && await row('days') === '3 days' && await row('extras') === 'Use up half a cabbage' && await open('extras'));
  await shot(page, 'ipsy-planner');
  await page.fill('#fNote', 'mild for the kids');
  const a0 = asked;
  await page.click('[data-act="make"]');
  ok('options: it shows that it\'s working, on the Plan tab', await page.locator('.busy').isVisible() && /Finding options for 3 meals/.test(await page.textContent('.busy')) && (await page.getAttribute('#tabs [data-tab="plan"]', 'aria-pressed')) === 'true');
  await page.waitForSelector('[data-act="recipes"]', { timeout: 5000 });
  await shot(page, 'options');
  const oc = await text(page, '#main .optc'), titles = await text(page, '#main .optcard .ot');
  ok('options: a card for each dinner, three dishes each, each a title and a line about it', oc.length === 3 && titles.length === 9 && titles[0] === 'Pick 1 for d1-dinner'
    && (await text(page, '#main .optcard .oa'))[0] === 'Option 1, nice and easy.', titles.join(' | '));
  ok('options: one call, asked with the choices', asked === a0 + 1 && /Suggest 3 dishes for each of these 3 meals for 4 people/.test(opted[opted.length - 1]) && /half a cabbage/.test(opted[opted.length - 1]));
  ok('options: the first of each is picked to start', (await page.$$eval('#main .optcard', els => els.map(e => e.getAttribute('aria-checked')))).join() === 'true,false,false,true,false,false,true,false,false');
  ok('options: nothing is a plan yet', !m.get('meals:draft') && (await page.locator('#main [data-meal]').count()) === 0);
  ok('options: Something else? Ask Ipsy… under them, the one ask bar on the page', (await page.locator('#main .askbar [data-act="optask"]').count()) === 1 && (await page.locator('#main .askbar').count()) === 1);
  await page.click('[data-opick="1:2"]');
  ok('options: tapping another picks it, for that meal only', (await page.getAttribute('[data-opick="1:2"]', 'aria-checked')) === 'true' && (await page.getAttribute('[data-opick="1:0"]', 'aria-checked')) === 'false'
    && (await page.getAttribute('[data-opick="0:0"]', 'aria-checked')) === 'true');
  await page.reload(); await page.waitForTimeout(800);
  ok('options: kept on the phone, with what was picked', (await page.getAttribute('[data-opick="1:2"]', 'aria-checked')) === 'true');
  await page.click('[data-act="recipes"]');
  ok('recipes: it shows that it\'s writing them', /Writing 3 recipes/.test(await page.textContent('.busy')));
  await page.waitForSelector('#main [data-meal]', { timeout: 5000 });
  const cards = await text(page, '#main [data-meal] .ct');
  await shot(page, 'plan');
  ok('3 different dinners, a day a card: the dishes picked', cards.join('|') === 'Pick 1 for d1-dinner|Pick 3 for d2-dinner|Pick 1 for d3-dinner' && (await page.locator('#main .card.dayc').count()) === 3, cards.join(' | '));
  ok('one more call to the AI, for the recipes', asked === a0 + 2);
  ok('the options are gone once the recipes are written', !(await page.evaluate(() => localStorage.getItem('allison-meals-v1-options'))) && (await page.locator('#main .optcard').count()) === 0);
  ok('each says its vegetables and protein', (await text(page, '#main [data-meal] .tag.veg')).length === 3 && (await text(page, '#main [data-meal] .tag.pro')).every(t => /38 g/.test(t)), (await text(page, '#main [data-meal] .tags')).join(' | '));
  ok('a new plan is a draft: nothing saved, and the list waits for it', (await page.textContent('#main')).includes('not saved yet') && !m.get('meals:plan'));
  ok('the plan waiting shows every choice it was asked with', (await text(page, '#main .card.accept .chosen .tag')).join('|') === 'Dinner|Beef|3 days|For 4|Use up half a cabbage|“mild for the kids”', (await text(page, '#main .card.accept .chosen .tag')).join('|'));
  const draft = JSON.parse(m.get('meals:draft'));
  ok('the draft keeps what was asked', draft.foods.join() === 'beef' && draft.days === 3 && draft.people === 4 && draft.fridge === 'half a cabbage' && draft.note === 'mild for the kids');
  // try again: another plan, the same choices
  const beforeAgain = asked;
  ok('the plan waiting offers New options', (await page.textContent('[data-act="again"]')) === 'New options');
  await page.click('[data-act="again"]');
  await page.waitForSelector('[data-act="recipes"]', { timeout: 5000 });
  ok('New options: options again, with the same choices, the plan waiting out of the way', asked === beforeAgain + 1 && /half a cabbage/.test(opted[opted.length - 1]) && (await page.locator('[data-act="accept"]').count()) === 0);
  await page.click('[data-act="recipes"]');
  await page.waitForFunction(() => document.querySelectorAll('#main [data-meal]').length === 3, null, { timeout: 5000 });
  ok('and then their recipes', asked === beforeAgain + 2 && JSON.parse(m.get('meals:draft')).fridge === 'half a cabbage');
  // Edit choices: back to the planner, with them
  await page.click('[data-act="edit"]'); await page.waitForTimeout(300);
  ok('Edit choices: the planner, with what the plan was asked with', (await page.getAttribute('#tabs [data-tab="ipsy"]', 'aria-pressed')) === 'true' && await row('foods') === 'Beef'
    && await row('extras') === 'Use up half a cabbage · “mild for the kids”' && (await page.locator('.pstep.on').count()) === 0);
  await toPlan(page);
  // accept it, starting tomorrow
  const tomorrow = await page.evaluate(() => document.querySelectorAll('#aStart option')[1].value);
  await page.selectOption('#aStart', tomorrow);
  await page.click('[data-act="accept"]'); await page.waitForTimeout(500);
  const saved = JSON.parse(m.get('meals:plan') || '{}');
  ok('accepting saves the plan for the family, from the day picked', saved.start === tomorrow && saved.dates.length === 3 && !m.get('meals:draft'), JSON.stringify(saved.dates));
  ok('its days show their dates', /^[A-Z][a-z]+day, [A-Z][a-z]{2} \d+$/.test((await text(page, '#main .card.dayc .night'))[0]), (await text(page, '#main .card.dayc .night'))[0]);
  ok('it\'s in Past plans, as the current one', (await page.locator('[data-past] .prime', { hasText: 'Current' }).count()) === 1);
  ok('accepted: the planner starts afresh next time', await page.evaluate(() => JSON.parse(localStorage.getItem('allison-meals-v1-flow')).foods.length === 0));
  await shot(page, 'accepted');
  await page.click('#main [data-meal="1"]'); await page.waitForTimeout(400);
  const recipe = await page.textContent('#recipeBody'), title = saved.meals[1].title;
  await shot(page, 'recipe');
  ok('a meal opens to its recipe, named by its day', recipe.includes(title) && recipe.includes('Brown the beef.') && recipe.includes('serves 4') && / dinner$/.test(await page.textContent('#recipeLbl')));
  ok('with its vegetables, as estimates', recipe.includes('Vegetables: broccoli, carrots and spring onions'));
  await page.click('#recipeBody [data-rate="up"]'); await page.waitForTimeout(400);
  ok('Loved it: the family\'s taste, for the next plan', JSON.parse(m.get('meals:taste')).loved[0].title === title && (await page.getAttribute('#recipeBody [data-rate="up"]', 'aria-checked')) === 'true');
  await page.click('#recipeBody [data-rate="down"]'); await page.waitForTimeout(400);
  ok('Not again moves it', JSON.parse(m.get('meals:taste')).nope[0].title === title && !JSON.parse(m.get('meals:taste')).loved.length && (await page.getAttribute('#recipeBody [data-rate="up"]', 'aria-checked')) === 'false');
  ok('Swap and Ask Ipsy', await page.isVisible('#recipeBody [data-act="swap"]') && await page.isVisible('#recipeBody [data-act="askmeal"]'));
  await page.click('#recipeSheet .iconbtn[data-close]'); await page.waitForTimeout(300);

  await page.click('#tabs [data-tab="list"]'); await page.waitForTimeout(300);
  const lh = await text(page, '#main .sechead span:first-child');
  await shot(page, 'list');
  ok('the shopping list is in grocery sections, staples apart', lh.join('|') === 'Produce|Meat|You probably have', lh.join('|'));
  const beef = page.locator('.irow', { hasText: 'Ground beef' });
  ok('the same ingredient once, with every day\'s amount and which days', (await beef.textContent()).includes('4.5 lb') && /[A-Z][a-z]{2}, [A-Z][a-z]{2}, [A-Z][a-z]{2}/.test(await beef.textContent()), await beef.textContent());
  ok('no sale prices', !/sale/i.test(await page.textContent('#main')));
  await beef.click();
  ok('ticking an item', (await beef.getAttribute('aria-checked')) === 'true');
  ok('nothing wider than the phone', !(await wide(page)));

  // Add to Notes: what's still to buy goes to the Groceries list in Notes, through the family's Notes Sheet
  const addToNotes = async () => { await page.click('[data-act="notes"]'); await page.waitForFunction(() => !document.querySelector('[data-act="notes"]').disabled && !document.getElementById('toast').hidden, null, { timeout: 8000 }); return page.textContent('#toastMsg'); };
  ok('Add to Notes sits beside Copy the list', (await text(page, '#main .card .btns .btn')).slice(0, 2).join('|') === 'Copy the list|Add to Notes');
  const unticked = await page.$$eval('.irow[aria-checked="false"]', els => els.map(e => e.querySelector('.it span').textContent));
  const n1 = unticked.length - 1, items = k => k + ' item' + (k === 1 ? '' : 's');   // the one under You probably have is a staple, not sent
  const t1 = await addToNotes();
  ok('the toast says how many went', t1 === 'Added ' + items(n1) + ' to Groceries in Notes.', t1);
  ok('two requests, as a phone\'s Notes sends them: a read (nothing in it), then the reminders with the Groceries list', notesCalls.length === 2
    && JSON.stringify(notesCalls[0].body) === JSON.stringify({ action: 'sync', v: 2, window: 90, today: notesCalls[0].body.today, notes: [], todos: [], lists: [], graves: {} })
    && /^\d{4}-\d{2}-\d{2}$/.test(notesCalls[0].body.today) && notesCalls[1].body.action === 'sync' && notesCalls[1].body.v === 2 && notesCalls[1].who === 'O1'
    && JSON.stringify(notesCalls[1].body.lists.map(l => [l.id, l.name, l.color])) === JSON.stringify([['l3', 'Groceries', '#10B981']]), JSON.stringify(notesCalls.map(c => c.body)).slice(0, 600));
  const sent = notesCalls[1].body.todos;
  ok('each unticked item once, named as the list shows it, the amount in its notes, in Notes\' own shape', sent.length === unticked.length - 1 && sent.every(t => Object.keys(t).sort().join() === 'created,date,done,doneAt,flagged,id,list,notes,prio,tags,time,title,updated' && t.list === 'l3' && t.done === false && /^t[0-9a-z]{8,16}$/.test(t.id) && typeof t.updated === 'number')
    && sent.some(t => t.title === 'Broccoli' && t.notes === '3 lb') && !sent.some(t => t.title === 'Ground beef') && !sent.some(t => /olive oil/i.test(t.title)), JSON.stringify(sent).slice(0, 400));
  const tab = notesSheet.tab('✓ Groceries');
  ok('the Sheet has them in its Groceries tab, as Tom\'s', tab && tab[0][0] === 'Who' && tab.slice(1).every(r => r[0] === 'Tom') && tab.slice(1).map(r => r[1]).includes('Broccoli'), JSON.stringify(tab).slice(0, 300));
  const t2 = await addToNotes();
  ok('again: nothing doubled, and the toast says so', t2 === 'They’re all in Groceries in Notes already.' && notesCalls.length === 3 && notesSheet.tab('✓ Groceries').length === tab.length, t2 + ' ' + notesCalls.length);
  // Ground beef unticked: it joins the list; the others are already there (the same ids)
  await beef.click();
  const t3 = await addToNotes();
  const ids = notesCalls[4].body.todos.map(t => t.id);
  ok('one more unticked: only it goes, the rest counted as there already', t3 === 'Added 1 item to Groceries in Notes; ' + n1 + (n1 === 1 ? ' was' : ' were') + ' there already.' && ids.length === 1 && !sent.some(t => ids.includes(t.id)) && notesCalls[4].body.todos[0].title === 'Ground beef' && notesCalls[4].body.lists.length === 0, t3);
  await beef.click();
  // not set up in aOS yet: a plain word why, and the list stays as it is
  notesSet = false;
  const t4 = await addToNotes();
  ok('no Notes Sheet in aOS: the toast says so', t4 === 'Set up the Notes Sheet in aOS first (Account → Google Sheets).', t4);
  notesSet = true;
  ok('no script errors', !errs.length, errs.join(' | '));

  // no signal in the store: the plan and list are still there, ticks kept
  down = true; await page.reload(); await page.waitForTimeout(800);
  ok('offline: the list is still there, with its tick', (await page.locator('.irow[aria-checked="true"]', { hasText: 'Ground beef' }).count()) === 1);
  ok('offline: it says so', (await page.textContent('#main')).includes('offline'));
  down = false;
  await ctx.close();
}
{ // a week of breakfast, lunch and dinner: Ipsy asks about lunches, and leftover lunches point to the dinner before
  const { ctx, page, errs } = await phone();
  await page.click('[data-slot="breakfast"]'); await page.click('[data-slot="lunch"]');
  ok('with lunch and dinner, a Lunches step', (await page.locator('[data-step="lunches"]').count()) === 1 && (await page.textContent('[data-val="meals"]')) === 'Breakfast, lunch and dinner');
  await page.click('[data-step="days"]'); await page.click('[data-days="7"]'); await page.click('[data-people="2"]'); await page.waitForTimeout(200);
  ok('it comes after how many, asking leftovers or fresh', (await page.getAttribute('[data-step="lunches"]', 'aria-expanded')) === 'true' && /leftovers, or something fresh/.test(await page.textContent('#pb-lunches')));
  await page.click('[data-lunches="leftovers"]'); await page.waitForTimeout(200);
  await page.click('[data-extra="quick"]');
  ok('and plans 21 meals', /21 meals/.test(await page.textContent('#pSum')) && (await page.textContent('[data-val="extras"]')) === 'Quick');
  await page.click('[data-act="make"]');
  ok('while it looks for options, the choices show', (await text(page, '.busy .chosen .tag')).join('|') === 'Breakfast, lunch and dinner|Surprise me|A week|For 2|Leftover lunches|Quick', (await text(page, '.busy .chosen .tag')).join('|'));
  await page.waitForSelector('[data-act="recipes"]', { timeout: 8000 });
  ok('options for every meal but the leftover lunches, which say whose they are', (await page.locator('#main .optc .optlist').count()) === 15 && (await text(page, '#main .optc .hint')).length === 6
    && /^Leftovers from .+’s dinner\.$/.test((await text(page, '#main .optc .hint'))[0]));
  await page.click('[data-act="recipes"]');
  await page.waitForSelector('#main [data-meal]', { timeout: 8000 });
  const d = JSON.parse(m.get('meals:draft'));
  ok('a quick note goes with the plan', JSON.parse(m.get('meals:draft')).note === 'quick to make');
  ok('21 meals, 6 of them leftover lunches', d.meals.length === 21 && d.meals.filter(x => x.leftover).length === 6 && (await page.locator('#main .card.dayc').count()) === 7);
  const li = d.meals.findIndex(x => x.leftover);
  await page.click('#main [data-meal="' + li + '"]'); await page.waitForTimeout(400);
  ok('a leftover lunch says so, and opens the dinner it comes from', (await page.textContent('#recipeBody')).includes('cooked double') && await page.isVisible('#recipeBody [data-open]'));
  await page.click('#recipeBody [data-open]'); await page.waitForTimeout(300);
  ok('that dinner\'s recipe', (await page.textContent('#recipeBody')).includes(d.meals.find(x => x.day === d.meals[li].leftover && x.slot === 'dinner').title));
  await page.click('#recipeSheet .iconbtn[data-close]'); await page.waitForTimeout(300);
  await page.click('[data-act="discard"]'); await page.waitForTimeout(400);
  ok('discarding drops the new plan; the accepted one shows again', !m.get('meals:draft') && (await page.locator('[data-src="plan"]').count()) === 3);
  ok('nothing wider than the phone; no script errors', !(await wide(page)) && !errs.length, errs.join(' | '));
  await ctx.close();
}
{ // a past plan opens with its meals and shopping list
  const { ctx, page } = await phone();
  await toPlan(page);
  await page.click('[data-past]'); await page.waitForTimeout(400);
  const t = await page.textContent('#pastBody');
  ok('a past plan opens with its meals and its shopping list', (await page.locator('#pastBody [data-meal]').count()) === 3 && t.includes('Shopping list') && t.includes('Ground beef'));
  await page.click('#pastBody [data-meal="0"]'); await page.waitForTimeout(400);
  ok('and its recipes', (await page.textContent('#recipeBody')).includes(JSON.parse(m.get('meals:plan')).meals[0].title));
  ok('the recipe opens over the past plan, not under it', await page.evaluate(() => { const r = document.querySelector('#recipeBody').getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return !!(el && el.closest('#recipeSheet')); }));
  await shot(page, 'past');
  await ctx.close();
}
{ // cooking again: a past plan's meals (all, or one) on the Plan tab with their recipes and in the List, for the family, with Undo
  const cur = JSON.parse(m.get('meals:plan')), log = JSON.parse(m.get('meals:log'));
  const old = { ...cur, id: 'pold9', start: '2026-01-05', dates: ['2026-01-05', '2026-01-06', '2026-01-07'], acceptedBy: 'Kim',
    meals: cur.meals.map((x, i) => ({ ...x, title: 'Old ' + x.title, ingredients: [...x.ingredients, { item: i ? 'Cumin seeds' : 'Ricotta', qty: '1 tbsp' }] })) };
  m.set('meals:log:pold9', JSON.stringify(old)); m.set('meals:log', JSON.stringify([...log, { id: 'pold9', start: old.start, end: '2026-01-07', foods: old.foods, slots: old.slots, people: old.people, titles: old.meals.map(x => x.title) }]));
  const { ctx, page, errs } = await phone();
  await toPlan(page);
  await page.click('[data-past="' + cur.id + '"]'); await page.waitForSelector('#pastSheet:not([hidden])');
  ok('the plan now has no Cook again (it is on the list already)', (await page.locator('#pastBody [data-againall]').count()) === 0);
  await page.click('#pastSheet .iconbtn[data-close]'); await page.waitForTimeout(300);
  await page.click('[data-past="pold9"]'); await page.waitForSelector('#pastSheet:not([hidden])');
  await page.click('#pastBody [data-againall]'); await page.waitForTimeout(500);
  const again = JSON.parse(m.get('meals:again') || '[]');
  ok('Cook them all again: its meals are the family\'s to cook again, on the server', again.length === 3 && again.every(x => x.from === 'pold9' && x.by === 'Tom'), JSON.stringify(again.map(x => [x.from, x.by])));
  ok('on the Plan tab, under Cooking again', (await page.locator('[data-src="again"]').count()) === 3 && /Cooking again/.test(await page.textContent('#main')));
  ok('with Undo', /on the list/.test(await page.textContent('#toastMsg')) && await page.locator('#toastAct').isVisible());
  await page.click('#tabs [data-tab="list"]'); await page.waitForTimeout(300);
  let t = await page.textContent('#main');
  ok('their ingredients are in the List beside the plan\'s, each saying which meal it is for', t.includes('Ricotta') && t.includes('Cumin seeds') && t.includes(old.meals[0].title), t.slice(0, 300));
  await toPlan(page);
  await page.click('[data-src="again"][data-meal="0"]'); await page.waitForSelector('#recipeSheet:not([hidden])');
  ok('a meal cooked again opens with its recipe, and Take it off the list', (await page.textContent('#recipeBody')).includes(old.meals[0].steps[0]) && await page.isVisible('#recipeBody [data-unagain]'));
  await page.click('#recipeBody [data-unagain]'); await page.waitForTimeout(500);
  ok('taken off: for the family too', JSON.parse(m.get('meals:again')).length === 2 && (await page.locator('[data-src="again"]').count()) === 2);
  await page.click('#toastAct'); await page.waitForTimeout(500);
  ok('Undo puts it back', JSON.parse(m.get('meals:again')).length === 3 && (await page.locator('[data-src="again"]').count()) === 3);
  for (const id of JSON.parse(m.get('meals:again')).map(x => x.id)) { await page.click('[data-unagain="' + id + '"]'); await page.waitForTimeout(400); }
  ok('× takes each off', JSON.parse(m.get('meals:again')).length === 0 && (await page.locator('[data-src="again"]').count()) === 0);
  await page.click('[data-past="pold9"]'); await page.waitForSelector('#pastSheet:not([hidden])');
  await page.click('#pastBody [data-meal="1"]'); await page.waitForSelector('#recipeSheet:not([hidden])');
  await page.click('#recipeBody [data-againone]'); await page.waitForTimeout(500);
  ok('Cook it again on one meal adds just that one', JSON.parse(m.get('meals:again')).map(x => x.title).join() === old.meals[1].title);
  await shot(page, 'again');
  ok('nothing wider than the phone; no script errors', !(await wide(page)) && !errs.length, errs.join(' | '));
  m.delete('meals:again'); m.delete('meals:log:pold9'); m.set('meals:log', JSON.stringify(log));
  await ctx.close();
}
{ // the plan's bar: it folds the days away (kept folded on this phone), and × clears the plan for the family, with Undo
  const { ctx, page, errs } = await phone();
  await toPlan(page);
  const id = JSON.parse(m.get('meals:plan')).id;
  ok('the plan has a bar: what it is, when, and a clear button', (await page.locator('.planbar [data-act="fold"][aria-expanded="true"]').count()) === 1
    && (await page.locator('.planbar [data-act="clear"]').count()) === 1 && (await page.locator('#planDays [data-meal]').count()) === 3
    && /3 meals/.test(await page.textContent('.planbar .pt small')));
  await page.click('.planbar [data-act="fold"]'); await page.waitForTimeout(300);
  ok('tapped, it folds the days away into the bar', await page.locator('#planDays').isHidden() && (await page.getAttribute('.planbar [data-act="fold"]', 'aria-expanded')) === 'false');
  await shot(page, 'folded');
  await page.reload(); await page.waitForTimeout(800);
  ok('and stays folded on this phone', await page.locator('#planDays').isHidden());
  await page.click('.planbar [data-act="fold"]'); await page.waitForTimeout(300);
  ok('tapped again, the days are back', (await page.locator('#planDays [data-meal]').count()) === 3 && await page.locator('#planDays').isVisible());
  await page.click('.planbar [data-act="clear"]'); await page.waitForTimeout(500);
  ok('× clears the plan for the family', !m.get('meals:plan') && (await page.locator('.planbar').count()) === 0 && (await page.textContent('#main')).includes('Nothing planned yet'));
  ok('it stays in Past plans', (await page.locator(`[data-past="${id}"]`).count()) === 1 && JSON.parse(m.get('meals:log'))[0].id === id);
  ok('and says so, with Undo', /still in Past plans/.test(await page.textContent('#toastMsg')) && await page.locator('#toastAct').isVisible());
  await page.click('#toastAct'); await page.waitForTimeout(500);
  ok('Undo puts it back as the family\'s plan', JSON.parse(m.get('meals:plan') || '{}').id === id && (await page.locator('#planDays [data-meal]').count()) === 3);
  ok('nothing wider than the phone; no script errors', !(await wide(page)) && !errs.length, errs.join(' | '));
  await ctx.close();
}
{ // Calendar's Meals layer (home/welcome.js AllisonOS.layer, built by logic.js), and ?date= from a day on it
  const { ctx, page, errs } = await phone();
  await page.waitForFunction(() => window.__meals.shared(), null, { timeout: 5000 });
  const plan = JSON.parse(m.get('meals:plan')), shared = await page.evaluate(() => window.__meals.shared());
  ok('Calendar\'s Meals layer: every meal of the family\'s plan on its day, a slot each', shared.items.length === 3 && shared.items.every((x, i) => x.id === plan.id + ':' + i && x.date === plan.dates[i] && x.slot === 'dinner' && x.title === plan.meals[i].title), JSON.stringify(shared));
  ok('no script errors', !errs.length, errs.join(' | '));
  await ctx.close();
  const d = await phone('light', { at: '/meals/?date=' + plan.dates[1] });
  await d.page.waitForTimeout(600);
  ok('?date= (Calendar\'s link) opens the Plan tab and that day\'s dinner', (await d.page.getAttribute('#tabs [data-tab="plan"]', 'aria-pressed')) === 'true' && await d.page.locator('#recipeSheet').isVisible()
    && (await d.page.textContent('#recipeBody')).includes(plan.meals[1].title) && / dinner$/.test(await d.page.textContent('#recipeLbl')) && !d.errs.length, (await d.page.textContent('#recipeLbl')) + ' ' + d.errs.join(' | '));
  await d.ctx.close();
  const n = await phone('light', { at: '/meals/?date=2020-01-01' });
  ok('a day the plan hasn\'t: the plan as usual', await n.page.locator('#recipeSheet').isHidden() && !n.errs.length, n.errs.join(' | '));
  await n.ctx.close();
}
{ // a plan that keeps using coconut is never kept
  coconut = true;
  const { ctx, page } = await phone();
  const was = m.get('meals:plan');
  await planIt(page);
  await page.waitForFunction(() => /something the family avoids/.test(document.getElementById('toastMsg').textContent), null, { timeout: 8000 }).catch(() => {});
  ok('a plan with coconut, twice: not kept, and it says why', (await page.textContent('#toastMsg')).includes('something the family avoids') && m.get('meals:plan') === was && !m.get('meals:draft'));
  ok('the last good plan still shows, under the options (kept, to try again)', (await text(page, '#main [data-meal] .ct')).length === 3 && (await page.locator('[data-act="recipes"]').count()) === 2, 'with Get the recipes at the top and the bottom');
  await page.click('[data-act="dropopts"]'); await page.waitForTimeout(300);
  ok('Discard takes the options away', (await page.locator('#main .optcard').count()) === 0 && !(await page.evaluate(() => localStorage.getItem('allison-meals-v1-options'))));
  coconut = false;
  await ctx.close();
}
{ // the family's rules are the family's
  const { ctx, page } = await phone('dark');
  await page.click('#setBtn'); await page.waitForTimeout(300);
  ok('Settings: titled Settings, with a Done tick like the other apps', (await page.textContent('#setLbl')) === 'Settings' && (await page.getAttribute('#sSave', 'aria-label')) === 'Done');
  ok('Settings: what Ipsy has learned, to forget one', (await text(page, '#setBody [data-forget]')).length === 1);
  await page.click('#setBody [data-veg="1"]');
  await page.click('#sProtein [data-value="high"]');
  await page.selectOption('#sPeople', '3'); await page.selectOption('#sWeek', '30');
  await page.fill('#sAdd', 'Shellfish'); await page.click('#sAddGo');
  await page.click('[data-avoid="coconut"]');
  await shot(page, 'settings-dark');
  await page.click('#sSave'); await page.waitForTimeout(400);
  const saved = JSON.parse(m.get('meals:settings'));
  ok('the rules saved for the family', saved.veg === 3 && saved.protein === 'high' && saved.people === 3 && saved.weeknight === 30 && saved.avoid.join('|') === 'tree nuts|shellfish', JSON.stringify(saved));
  await page.click('#tabs [data-tab="ipsy"]'); await page.waitForTimeout(300);
  ok('the Ipsy tab shows them', /3\+ vegetables and about 40 g protein in every meal · never tree nuts and shellfish/.test(await page.textContent('#main .rules')));
  // the next plan is asked for with them
  await page.click('[data-step="days"]'); await page.click('[data-days="1"]'); await page.waitForTimeout(200);
  ok('Ipsy remembers how many were at the table last time', /Last time it was 4\./.test(await page.textContent('#pb-people')));
  await page.click('[data-people="3"]'); await page.click('[data-act="make"]'); await recipesNow(page);
  await page.waitForSelector('[data-act="discard"]', { timeout: 8000 });
  ok('a plan made with the new rules', JSON.parse(m.get('meals:draft')).people === 3);
  await page.click('[data-act="discard"]'); await page.waitForTimeout(400);
  ok('dark: nothing wider than the phone', !(await wide(page)));
  await ctx.close();
}

// ---- The family's Google Sheet, through aOS: the record of every plan ----
const until = async (fn, ms = 12000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
const logCalls = page => { const a = []; page.on('request', r => { if (/\/meals\/api\/log\//.test(r.url())) a.push(r.url()); }); return a; };
const hiddenRows = tab => sheet.tab(tab).slice(1).map(r => JSON.parse(r.slice(2).join('')));
const ymd = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const synced = page => until(() => page.evaluate(() => +localStorage.getItem('allison-meals-v1-sheet-synced') > 0));
// the Sheet is set up in aOS, not in Meals: Settings have no Sheet row, and there's no Sheet sheet
const noSheetUI = page => page.evaluate(() => ['sheetBtn', 'sheetSub', 'syncSheet', 'syStatus', 'syNow', 'syLbl'].every(id => !document.getElementById(id))
  && !/The family’s record/.test(document.getElementById('setBody').textContent));
const SHEET_STEP = async () => {
  sheet = fakeSheet(GS, SHEET_SECRET); sheetCalls.length = 0; sheetSet = false;
  { // not set up in aOS yet, then signed out: Meals syncs by itself and says nothing (the owner sets it up in aOS); no Sheet UI or link or phrase on a phone
    const { ctx, page, errs } = await phone();
    sheetRefused = 0;
    await page.evaluate(() => window.__meals.sheetSync());
    ok('Sheet: it tried, through aOS, which says the Sheet isn’t set up yet', sheetRefused > 0, String(sheetRefused));
    await page.click('#setBtn'); await page.waitForTimeout(300);
    ok('Sheet: quietly, with no toast', await page.isHidden('#toast'));
    ok('Sheet: Settings have no Sheet row, and there’s no Sheet sheet (aOS → Account → Google Sheets has it)', await noSheetUI(page));
    ok('Sheet: no link, phrase, setup link or Disconnect on a phone', !(await page.$('#syUrl')) && !(await page.$('#sySecret')) && !(await page.$('#syShare')) && !(await page.$('#syOff')));
    await shot(page, 'settings-no-sheet');
    await page.click('#sSave'); await page.waitForTimeout(300);
    await page.evaluate(() => window.__meals.sheetSync()); await page.waitForTimeout(300);
    ok('Sheet: again, still no toast (not set up yet is never a pop-up)', await page.isHidden('#toast'));
    sheetFail = 'busy';
    await page.evaluate(() => window.__meals.sheetSync()); await page.waitForTimeout(300);
    ok('Sheet: a real error says so, once', await page.isVisible('#toast') && /The Sheet was busy/.test(await page.textContent('#toastMsg')), await page.textContent('#toastMsg'));
    await page.evaluate(() => { document.getElementById('toast').hidden = true; });
    await page.evaluate(() => window.__meals.sheetSync()); await page.waitForTimeout(300);
    ok('Sheet: and not again in the same session', await page.isHidden('#toast'));
    sheetFail = '';
    await page.evaluate(() => window.AllisonOS.account.signOut());
    const tried = sheetRefused;
    ok('Sheet: signed out, a sync sends nothing and says nothing', (await page.evaluate(() => window.__meals.sheetSync())) === false && sheetRefused === tried && await page.isHidden('#toast'));
    await page.click('#setBtn'); await page.waitForTimeout(300);
    ok('Sheet: signed out, Settings still offer Sign in with Face ID', await page.isVisible('#setBody [data-act="signin"]'));
    await page.click('#sSave'); await page.waitForTimeout(300);
    ok('Sheet: nothing was sent', sheetCalls.length === 0);
    ok('no script errors', !errs.length, errs.join(' | '));
    await ctx.close();
  }
  { // the owner's phone hands the link and phrase it kept over to aOS, forgets them, and syncs through aOS
    const seed = { 'aos.seen': JSON.stringify({ meals: '999' }), 'allison-meals-v1-sheet': JSON.stringify({ url: SHEET_URL, secret: SHEET_SECRET }), 'allison-meals-v1-sheet-sent': JSON.stringify({ url: SHEET_URL, ids: [] }) };
    const { ctx, page, errs } = await phone('light', { seed });
    const logs = logCalls(page);
    ok('Sheet: the owner’s phone hands its old link and phrase to aOS, once, and forgets them', await until(() => page.evaluate(() => !localStorage.getItem('allison-meals-v1-sheet') && !localStorage.getItem('allison-meals-v1-sheet-sent')))
      && claims.length === 1 && JSON.stringify(claims[0]) === JSON.stringify({ who: 'O1', url: SHEET_URL, secret: SHEET_SECRET }), JSON.stringify(claims));
    ok('Sheet: then it syncs, through aOS', await until(() => sheetCalls.length > 0));
    const first = sheetCalls[0].body;
    ok('Sheet: a sync is the plan, list, settings and graves (no deals now), keeping 90 days; never a phrase', first.action === 'sync' && first.v === 3 && first.window === 90 && /^\d{4}-\d\d-\d\d$/.test(first.today)
      && !('secret' in first) && first.plans.length === 1 && first.deals.length === 0 && first.shopping.buy.length > 0 && !!first.settings.stores.length && JSON.stringify(first.graves) === '{}', Object.keys(first).join());
    const cur = first.plans[0];
    ok('Sheet: the plan is whole (id, who, when read, a date a meal, what it was built around, meals with ingredients and steps)', /^p/.test(cur.id) && cur.acceptedBy === 'Tom' && cur.acceptedAt > 0 && cur.updated >= cur.acceptedAt
      && cur.dates.length === 3 && cur.shopName === 'Dinner' && cur.meat === 'Beef' && cur.meals[0].ingredients[0].item === 'ground beef' && cur.meals[0].steps.length === 2 && cur.sales === undefined && cur.by === undefined && cur.foods === undefined && cur.tip === 'Buy the beef in one family pack.', JSON.stringify({ ...cur, meals: cur.meals.length }));
    const beefRow = first.shopping.buy.find(x => x.item === 'Ground beef');
    ok('Sheet: the shopping list is as the List tab shows it (section, amount, days)', !!beefRow && beefRow.section === 'Meat' && beefRow.amount === '4.5 lb' && /^[A-Z][a-z]{2}, [A-Z][a-z]{2}, [A-Z][a-z]{2}$/.test(beefRow.nights) && beefRow.sale === '' && first.shopping.pantry.some(x => x.item === 'Olive oil' && x.amount === '3 tbsp'), JSON.stringify(beefRow));
    ok('Sheet: settings are the family\'s rules and what is avoided', /^3\+ vegetables and about 40 g protein in every meal$/.test(first.settings.stores[0]) && first.settings.stores[1] === 'cooking for 3' && first.settings.cards.length === 0 && first.settings.avoid.join() === 'tree nuts,shellfish' && /^Claude /.test(first.settings.model), JSON.stringify(first.settings));
    const plansTab = sheet.tab('Plans');
    ok('Sheet: Plans has a row a meal, Planned by Tom; Shopping list and Settings are readable', plansTab.length === 1 + 3 && plansTab[0][0] === 'Planned by' && plansTab.slice(1).every(r => r[0] === 'Tom')
      && sheet.tab('Shopping list').some(r => r[1] === 'Ground beef' && r[2] === '4.5 lb') && sheet.tab('Settings').some(r => r[0] === 'Never in a plan' && r[1] === 'tree nuts, shellfish'));
    ok('Sheet: each row says whose (the owner’s), and the Sheet knows the people', hiddenRows('_plans').every(p => p.by === 'O1') && JSON.stringify(sheet.tab('_people').slice(1)) === JSON.stringify([['(owner)', 'O1'], ['O1', 'Tom']]));
    ok('Sheet: synced, the phone notes when', await synced(page));
    await page.click('#setBtn'); await page.waitForTimeout(300);
    ok('Sheet: signed in and synced, Settings still have no Sheet row', await noSheetUI(page));
    await page.click('#sSave'); await page.waitForTimeout(300);
    // a second plan accepted: only it goes (the first is in the Sheet already, and is not fetched again)
    const n0 = sheetCalls.length, l0 = logs.length;
    await planIt(page);
    await page.waitForSelector('[data-act="accept"]', { timeout: 8000 });
    await page.click('[data-act="accept"]');
    ok('Sheet: accepting a plan sends it a moment later', await until(() => sheetCalls.length > n0));
    const second = sheetCalls[sheetCalls.length - 1].body, newId = JSON.parse(m.get('meals:plan')).id;
    ok('Sheet: that sync has just the new plan, with no fetch of the older one', second.plans.length === 1 && second.plans[0].id === newId && logs.length === l0, second.plans.map(p => p.id).join() + ' ' + (logs.length - l0));
    ok('Sheet: Plans now holds both plans, newest first', sheet.tab('Plans').length === 1 + 3 * 2 && sheet.tab('Plans')[1][16] === newId);
    // discarding a draft changes nothing the Sheet shows: no sync
    const n1 = sheetCalls.length;
    await planIt(page); await page.waitForSelector('[data-act="discard"]', { timeout: 8000 });
    await page.click('[data-act="discard"]'); await page.waitForTimeout(3800);
    ok('Sheet: nothing changed, nothing sent', sheetCalls.length === n1);
    // settings saved: the Settings tab follows
    await page.click('#setBtn'); await page.waitForTimeout(300); await page.fill('#sAdd', 'Mushrooms'); await page.click('#sAddGo'); await page.click('#sSave');
    ok('Sheet: saving settings sends them', await until(() => sheet.tab('Settings').some(r => r[0] === 'Never in a plan' && /mushrooms/.test(r[1]))));
    ok('no script errors', !errs.length, errs.join(' | '));
    await ctx.close();
  }
  { // Ella's phone, and a Sheet that lacks one of the family's plans: it sends it, fetched whole once
    sheet = fakeSheet(GS, SHEET_SECRET); sheetCalls.length = 0;
    const B = await phone('dark', { as: tok2 });
    const logs = logCalls(B.page);
    ok('Sheet: a phone whose Sheet lacks a plan the family server keeps sends it next (with the current plan), fetched whole once', await until(() => sheet.tab('Plans') && sheet.tab('Plans').length === 1 + 6)
      && sheetCalls.length === 2 && sheetCalls[0].body.plans.length === 1 && sheetCalls[1].body.plans.length === 2 && logs.length === 1 && sheetCalls.every(c => c.who === 'E1'), sheetCalls.map(c => c.body.plans.length).join() + ' ' + logs.length);
    ok('Sheet: from Ella’s phone the rows are hers (by), and Planned by still says who accepted each (Tom)', hiddenRows('_plans').every(p => p.by === 'E1') && sheet.tab('Plans').slice(1).every(r => r[0] === 'Tom')
      && sheet.tab('_people').slice(1).some(r => r[0] === 'E1' && r[1] === 'Ella'));
    await shot(B.page, 'sheet-dark');
    const n = sheetCalls.length;
    await B.page.evaluate(() => window.__meals.load()); await B.page.waitForTimeout(3500);
    ok('Sheet: opening again with nothing new sends nothing', sheetCalls.length === n);
    ok('Sheet: no script errors, nothing blocked by the page policy', !B.errs.length, B.errs.join(' | '));
    await B.ctx.close();
  }
  { // reading back: the plans the family server doesn't keep come from the Sheet, the last 90 days at once, older ones on asking
    const old = (id, start, title) => ({ id, acceptedAt: Date.parse(start + 'T18:00:00Z'), acceptedBy: 'Mum Allison', start, dates: [start], meat: 'pork', shop: 'publix', shopName: 'Publix', people: 4, tip: '',
      meals: [{ day: 1, title, cuisine: 'Italian', method: 'braise', minutes: 90, why: '', uses: [], ingredients: [{ item: 'pork shoulder', qty: '3 lb' }], steps: ['Brown the pork.', 'Braise for two hours.'] },
        { day: 2, title: title + ' sandwiches', cuisine: 'American', method: 'no-cook', minutes: 10, why: '', uses: [], ingredients: [{ item: 'rolls', qty: '4' }], steps: ['Fill the rolls.'] }] });
    sheet.post({ action: 'sync', plans: [old('phole1', ymd(-10), 'Pork stew'), old('pold2', ymd(-200), 'Pork ragù'), old('pold1', ymd(-600), 'Pulled pork')] }, { key: SHEET_SECRET, who: 'O1', name: 'Tom', owner: '1' });
    const { ctx, page, errs } = await phone();
    await toPlan(page);
    ok('Sheet: a plan of the last 90 days the family server doesn’t keep shows under Past plans, from the Sheet', await until(() => page.locator('[data-past="phole1"]').count().then(c => c === 1)));
    ok('Sheet: older ones aren’t on the phone until you look back', (await page.locator('[data-past="pold2"], [data-past="pold1"]').count()) === 0 && await page.isVisible('[data-act="older"]'));
    await shot(page, 'past-older');
    const n0 = sheetCalls.length;
    await page.click('[data-act="older"]');
    ok('Sheet: Older plans asks the Sheet for the year before', await until(() => page.locator('[data-past="pold2"]').count().then(c => c === 1)) && sheetCalls.slice(n0).every(c => c.body.action === 'range' && !c.body.plans)
      && sheetCalls[n0].body.to === ymd(-90) && sheetCalls[n0].body.from === ymd(-454) && (await page.locator('[data-past="pold1"]').count()) === 0, JSON.stringify(sheetCalls.slice(n0).map(c => c.body)));
    await page.click('[data-act="older"]');
    ok('Sheet: and the year before that', await until(() => page.locator('[data-past="pold1"]').count().then(c => c === 1)));
    await page.click('[data-act="older"]');
    ok('Sheet: until there are none older (then the button goes)', await until(() => page.evaluate(() => /No older plans/.test(document.getElementById('toastMsg').textContent))) && await until(() => page.locator('[data-act="older"]').count().then(c => c === 0)));
    await page.click('[data-past="pold1"]'); await page.waitForSelector('#pastSheet:not([hidden])');
    const t = await page.textContent('#pastBody');
    ok('Sheet: an old plan from the Sheet opens with its dinners, who accepted it and its shopping list', (await page.locator('#pastBody [data-meal]').count()) === 2 && /accepted by Mum Allison/.test(t) && t.includes('Shopping list') && t.includes('Pork shoulder'), t.slice(0, 200));
    await page.click('#pastBody [data-meal="0"]'); await page.waitForSelector('#recipeSheet:not([hidden])');
    ok('Sheet: and its recipe', (await page.textContent('#recipeBody')).includes('Braise for two hours.'));
    ok('no script errors', !errs.length, errs.join(' | '));
    await ctx.close();
  }
  { // a plan taken back (Undo of Accept, as Ipsy does it): its grave reaches the Sheet, and it leaves Plans
    const { ctx, page, errs } = await phone();
    await synced(page);
    const id = await page.evaluate(async () => {
      const t = JSON.parse(localStorage.getItem('aos.session')).token, id = window.__meals.data().plan.id;
      const r = await fetch('../meals/api/unaccept', { method: 'POST', headers: { 'X-Meals': '1', 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ id }) });
      const j = await r.json(); window.__meals.keep({ plan: j.plan, log: j.log, draft: j.draft }); return id;
    });
    ok('Sheet: a plan taken back goes to the Sheet as a grave, and leaves Plans', await until(() => sheetCalls.some(c => c.body.graves && c.body.graves['plans:' + id])) && await until(() => !sheet.tab('Plans').some(r => r[16] === id))
      && sheet.tab('_deleted').some(r => r[0] === 'plans:' + id) && sheet.tab('Plans').some(r => r[16] === 'phole1'), id);
    ok('no script errors', !errs.length, errs.join(' | '));
    await ctx.close();
  }
};
{ // Vintage, the default design, drawn in the Retro look, light and dark: Futura, flat cream or walnut, mustard, teal, orange, atomic shapes
  for (const scheme of ['light', 'dark']) {
    const { ctx, page, errs } = await phone(scheme);
    const q = (sel, props, pseudo) => page.$eval(sel, (e, [props, pseudo]) => { const c = getComputedStyle(e, pseudo || null); return props.map(p => c[p]); }, [props, pseudo]);
    const cream = scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', ground = scheme === 'light' ? 'rgb(241, 223, 187)' : 'rgb(74, 57, 30)';
    const teal = scheme === 'light' ? 'rgb(31, 111, 107)' : 'rgb(79, 179, 171)', orange = scheme === 'light' ? 'rgb(201, 80, 42)' : 'rgb(216, 87, 42)';
    const flat = v => v === 'none' || v === '';
    await page.waitForSelector('#main .card.planner', { timeout: 5000 });
    ok(scheme + ': Futura', /Futura/.test((await q('body', ['fontFamily']))[0]));
    ok(scheme + ': the ground is cream / walnut', (await q('body', ['backgroundColor']))[0] === ground);
    ok(scheme + ': a mustard sun, a teal dot and a burnt-orange pill behind the title', (await q('.ambient i:nth-child(1)', ['backgroundColor']))[0] === ('rgb(227, 167, 47)')
      && (await q('.ambient i:nth-child(2)', ['backgroundColor']))[0] === teal && (await q('.ambient i:nth-child(3)', ['backgroundColor']))[0] === 'rgb(216, 87, 42)');
    ok(scheme + ': the title is big, with the three little bars under it', (await q('.title', ['fontSize']))[0] === '44px' && (await q('.title', ['backgroundImage'], '::after'))[0].startsWith('url('));
    ok(scheme + ': the tabs have a mustard thumb', (await q('#tabs .slthumb', ['backgroundColor']))[0] === 'rgb(227, 167, 47)' && (await q('#tabs', ['backgroundColor']))[0] === cream);
    ok(scheme + ': the theme colour is the sky\'s ground (home/sky.js) and the status bar is not translucent', (await page.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content')) === (scheme === 'light' ? '#F1DFBB' : '#4A391E')
      && (await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content')) === 'default');
    const [pbg, pshadow, pbackdrop, pradius] = await q('#main .card.planner', ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
    ok(scheme + ': the planner is a flat cream / walnut card, 20px round', pbg === cream && pshadow === 'none' && flat(pbackdrop) && pradius === '20px', [pbg, pshadow, pbackdrop, pradius].join(' | '));
    ok(scheme + ': Ipsy\'s bubble is cream / walnut; a picked chip is mustard; Make the plan is solid orange', (await q('#main .bub', ['backgroundColor']))[0] === cream
      && (await q('[data-slot="dinner"]', ['boxShadow']))[0].includes('rgb(227, 167, 47)') && (await q('[data-act="make"]', ['backgroundColor']))[0] === orange);
    ok(scheme + ': the open step\'s number is teal', (await q('.pstep.on .pn', ['backgroundColor']))[0] === teal);
    await shot(page, 'retro-ipsy-' + scheme);
    await toPlan(page);
    await page.waitForSelector('#main [data-meal]', { timeout: 5000 });
    const [bg, shadow, backdrop, radius] = await q('#main .card.dayc', ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
    ok(scheme + ': a day is a flat cream / walnut card, 20px round', bg === cream && shadow === 'none' && flat(backdrop) && radius === '20px', [bg, shadow, backdrop, radius].join(' | '));
    ok(scheme + ': + is solid orange', (await q('#fab', ['backgroundColor']))[0] === orange);
    await shot(page, 'retro-plan-' + scheme);
    await page.click('#main [data-meal="0"]'); await page.waitForTimeout(600);
    const [sbg, sradius, sfilter] = await q('#recipeSheet .sheet', ['backgroundColor', 'borderRadius', 'backdropFilter']);
    ok(scheme + ': the recipe is a flat panel', sbg === cream && sradius === '28px' && flat(sfilter), [sbg, sradius, sfilter].join(' | '));
    ok(scheme + ': its Done and Ask Ipsy are solid orange; Swap is outlined teal, not filled', (await q('#recipeSheet .iconbtn.okbtn', ['backgroundColor']))[0] === orange && (await q('#recipeBody [data-act="askmeal"]', ['backgroundColor']))[0] === orange
      && (await q('#recipeBody [data-act="swap"]', ['backgroundColor']))[0] === 'rgba(0, 0, 0, 0)' && (await q('#recipeBody [data-act="swap"]', ['color']))[0] === (scheme === 'light' ? teal : 'rgb(92, 189, 181)'));
    await shot(page, 'retro-recipe-' + scheme);
    await page.click('#recipeSheet .iconbtn.okbtn'); await page.waitForTimeout(400);
    await page.click('#tabs [data-tab="list"]'); await page.waitForTimeout(500);
    await page.click('.irow >> nth=0'); await page.waitForTimeout(200);
    ok(scheme + ': a ticked item is teal', (await q('.irow[aria-checked="true"] .box', ['backgroundColor']))[0] === teal);
    await shot(page, 'retro-list-' + scheme);
    await page.click('#tabs [data-tab="plan"]'); await page.waitForTimeout(300);
    ok(scheme + ': no script errors, nothing blocked by the page policy', !errs.length, errs.join(' | '));
    await ctx.close();
  }
}
{ // Standard: Sea glass, the Vintage block switched off, no sky; the icon and status bar follow
  for (const scheme of ['light', 'dark']) {
    const { ctx, page, errs } = await phone(scheme, { design: 'glass' });
    await page.waitForSelector('#main .card.planner', { timeout: 5000 });
    const q = (sel, props) => page.$eval(sel, (e, props) => { const c = getComputedStyle(e); return props.map(p => c[p]); }, props);
    ok(scheme + ' Standard: data-look is glass, the Vintage styles are off, no sky', await page.evaluate(() => document.documentElement.dataset.look === 'glass' && document.getElementById('vintage').media === 'not all' && !document.documentElement.hasAttribute('data-sky')));
    ok(scheme + ' Standard: the Sea glass ground and the system font', (await q('body', ['backgroundColor']))[0] === (scheme === 'light' ? 'rgb(238, 242, 240)' : 'rgb(13, 18, 19)') && !/Futura/.test((await q('body', ['fontFamily']))[0]));
    ok(scheme + ' Standard: the Sea glass icon, a translucent status bar, the Sea glass bar colour', /icon-glass-180\.png/.test(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'))
      && (await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content')) === 'black-translucent'
      && (await page.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content')) === (scheme === 'light' ? '#EEF2F0' : '#0D1213'));
    await shot(page, 'glass-ipsy-' + scheme);
    ok(scheme + ' Standard: no script errors', !errs.length, errs.join(' | '));
    await ctx.close();
  }
}
{ // Settings > Design: Vintage, then Standard and back, at once, kept across a reload
  const { ctx, page, errs } = await phone();
  const look = () => page.evaluate(() => document.documentElement.dataset.look);
  ok('Design: Vintage by default, with the Vintage icon', await look() === 'vintage' && /\/?icon-180\.png/.test(await page.getAttribute('link[rel="apple-touch-icon"]', 'href')) && !/glass/.test(await page.getAttribute('link[rel="apple-touch-icon"]', 'href')));
  await page.click('#setBtn'); await page.waitForTimeout(400);
  ok('Design: Settings shows Vintage picked', (await page.getAttribute('#setBody [data-design="vintage"]', 'aria-checked')) === 'true' && (await page.getAttribute('#setBody [data-design="glass"]', 'aria-checked')) === 'false');
  await page.click('#setBody [data-design="glass"]'); await page.waitForTimeout(200);
  ok('Design: Standard at once', await look() === 'glass' && (await page.getAttribute('#setBody [data-design="glass"]', 'aria-checked')) === 'true' && await page.isVisible('#setSheet'));
  await page.reload(); await page.waitForTimeout(800);
  ok('Design: Standard is kept', await look() === 'glass' && (await page.evaluate(() => localStorage.getItem('design.meals'))) === 'glass');
  await page.click('#setBtn'); await page.waitForTimeout(400);
  await page.click('#setBody [data-design="vintage"]'); await page.waitForTimeout(200);
  await page.reload(); await page.waitForTimeout(800);
  ok('Design: back to Vintage, kept', await look() === 'vintage' && (await page.evaluate(() => localStorage.getItem('design.meals'))) === 'vintage');
  ok('Design: no script errors', !errs.length, errs.join(' | '));
  await ctx.close();
}
{ // the old Meals Vintage app, on a phone that added it: its address opens Meals, with its data moved over once
  const seed = { 'aos.seen': JSON.stringify({ mealsvintage: '1.3' }), 'allison-mealsv-v1-tab': '"list"', 'allison-mealsv-v1-ticks': JSON.stringify({ at: 1, keys: ['x'] }) };
  const { ctx, page, errs } = await phone('light', { seed, at: '/mealsvintage/' });
  await page.waitForTimeout(600);
  const got = await page.evaluate(() => ({ tab: document.querySelector('#tabs [aria-pressed="true"]').dataset.tab, ticks: localStorage.getItem('allison-meals-v1-ticks'), seen: JSON.parse(localStorage.getItem('aos.seen') || '{}'), old: localStorage.getItem('allison-mealsv-v1-tab'), look: document.documentElement.dataset.look }));
  ok('old address: Meals Vintage\'s data is now Meals\' (it opens on the tab it was on)', got.tab === 'list' && got.ticks === JSON.stringify({ at: 1, keys: ['x'] }), JSON.stringify(got));
  ok('old address: what it had seen carries over (no walkthrough again), and nothing old is deleted', got.seen.meals === '1.3' && !!got.old);
  ok('old address: in Vintage', got.look === 'vintage');
  // once only: a later change to the old keys is not copied again
  await page.evaluate(() => localStorage.setItem('allison-mealsv-v1-ticks', '{"at":2,"keys":[]}'));
  await page.reload(); await page.waitForTimeout(800);
  ok('old address: moved once only', (await page.evaluate(() => localStorage.getItem('allison-meals-v1-ticks'))) === JSON.stringify({ at: 1, keys: ['x'] }));
  ok('old address: no script errors', !errs.length, errs.join(' | '));
  await ctx.close();
}
{ // a phone with both: Meals' own data is kept, the old app's is not copied over it
  const seed = { 'aos.seen': JSON.stringify({ meals: '999', mealsvintage: '999' }), 'allison-meals-v1-tab': '"plan"', 'allison-mealsv-v1-tab': '"list"' };
  const { ctx, page } = await phone('light', { seed });
  ok('both: Meals\' own data is kept', (await page.evaluate(() => localStorage.getItem('allison-meals-v1-tab'))) === '"plan"');
  await ctx.close();
}
await SHEET_STEP();
{ // courses: a dinner with a starter and a dessert, picked in the planner; the recipe course by course; all of it on the list
  const { ctx, page, errs } = await phone();
  await page.click('#tabs [data-tab="ipsy"]'); await page.waitForTimeout(200);
  await page.click('[data-act="restart"]'); await page.waitForTimeout(200);
  const row = async k => (await page.textContent('[data-val="' + k + '"]')).trim();
  await page.click('[data-step="courses"]'); await page.click('[data-courses="all"]'); await page.waitForTimeout(200);
  ok('courses: All three, and its row says so', await row('courses') === 'All three' && (await page.getAttribute('[data-step="foods"]', 'aria-expanded')) === 'true');
  await page.click('[data-step="days"]'); await page.click('[data-days="1"]'); await page.click('[data-people="2"]'); await page.waitForTimeout(200);
  ok('the summary says the dinners have three courses', /Planning today’s three-course dinners for 2:/.test(await page.textContent('#pSum')), await page.textContent('#pSum'));
  await page.click('[data-step="meals"]'); await page.click('[data-slot="dinner"]'); await page.waitForTimeout(200);
  ok('no dinner, no courses step', (await page.locator('[data-step="courses"]').count()) === 0);
  await page.click('[data-slot="dinner"]'); await page.waitForTimeout(200);
  await page.click('[data-act="make"]');
  await page.waitForSelector('[data-act="recipes"]', { timeout: 5000 });
  ok('options for a dinner of courses show its starter', /^Starter: Soup 1$/.test((await text(page, '#main .optcard .oc'))[0] || ''), (await text(page, '#main .optcard .oc')).join('|'));
  await page.click('[data-act="recipes"]');
  await page.waitForSelector('#main [data-meal]', { timeout: 5000 });
  const d = JSON.parse(m.get('meals:draft'));
  ok('the plan is asked with the courses, and its dinner has them', d.courses === 'all' && d.meals[0].courses.map(c => c.course).join() === 'starter,main,dessert', JSON.stringify(d.meals[0].courses));
  ok('the dinner\'s card and the plan\'s choices say 3 courses', (await text(page, '#main [data-meal] .tag')).includes('3 courses') && (await text(page, '#main .card.accept .chosen .tag')).includes('3 courses'));
  await page.click('#main [data-meal="0"]'); await page.waitForTimeout(400);
  await shot(page, 'recipe-courses');
  const labels = await text(page, '#recipeBody .course .label'), dishes = await text(page, '#recipeBody .course h4'), steps = await text(page, '#recipeBody ol li');
  ok('the recipe, course by course: each its dish, its ingredients and its steps', labels.join('|') === 'Starter|Main|Dessert' && dishes[0] === 'Roast beet salad' && dishes[2] === 'Poached pears'
    && steps.join('|') === 'Roast the beets.|Brown the beef.|Add the rest and simmer.|Poach the pears.', labels.join('|') + ' / ' + dishes.join('|') + ' / ' + steps.join('|'));
  ok('the starter\'s ingredients under the starter', /beets/.test(await page.textContent('#recipeBody .course + .rgroup')));
  await page.click('#recipeSheet .iconbtn[data-close]'); await page.waitForTimeout(300);
  await page.click('[data-act="accept"]'); await page.waitForTimeout(500);
  await page.click('#tabs [data-tab="list"]'); await page.waitForTimeout(300);
  const list = await page.textContent('#main');
  ok('every course\'s ingredients are on the shopping list', /beets/i.test(list) && /pears/i.test(list) && /ground beef/i.test(list));
  ok('no script errors', !errs.length, errs.join(' | '));
  await ctx.close();
}
await browser.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
