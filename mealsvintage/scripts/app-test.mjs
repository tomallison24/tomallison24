// Meals Vintage at iPhone size (390 x 844), Meals' own browser test run on this app, against the real
// server code (functions/meals/api: Meals Vintage calls Meals' route, ../meals/api, so it is the same
// family plan) on an in-memory KV with a real family session, and a
// stand-in for the AI service (no network, no key): no key yet, finding the
// week's deals (sorted into grocery sections), planning dinners, a recipe, the
// shopping list (ticks kept, the list there offline), a plan that keeps using
// coconut never saved, settings, the Google Sheet copy (the real google-sheet-sync.gs
// on a fake Sheet: the form, the errors, what is sent and when), and no script errors
// or sideways scrolling in light and dark. Seeds localStorage['aos.seen'] so the walkthrough stays away.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node mealsvintage/scripts/app-test.mjs
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
  const f = path.join(R, p);
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;

const m = new Map();
const db = { get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, String(v)); }, delete: async k => { m.delete(k); } };
await db.put('owner', 'O1'); await putJSON(db, 'user:O1', { id: 'O1', name: 'Tom', role: 'owner', creds: [], created: Date.now() - 864e5 });
const tok = await issue(db, 'O1');

// The stand-in AI (Anthropic's Messages API shape): deals, or a plan, by what it's asked.
const DEALS = { validFrom: '', validTo: '', items: [
  { name: 'Organic boneless skinless chicken thighs', price: '$3.99/lb', regular: '$5.99/lb', prime: true },
  { name: 'Grass-fed ground beef', price: '$5.99/lb', regular: '$7.49/lb', prime: true },
  { name: 'Broccoli crowns', price: '$1.99/lb' }, { name: 'Organic strawberries', price: '$3.99' }, { name: 'Greek yogurt', price: '$4.49' } ], sources: ['https://example.com/sales'] };
const meal = (title, cuisine, extra) => ({ title, cuisine, method: 'skillet', minutes: 30, why: 'Quick on a weeknight.', uses: ['Grass-fed ground beef'],
  ingredients: [{ item: 'ground beef', qty: '1.5 lb' }, { item: 'broccoli', qty: '1 lb' }, { item: 'olive oil', qty: '1 tbsp', pantry: true }, ...(extra || [])], steps: ['Brown the beef.', 'Add the rest and simmer.'] });
const PLAN = { meals: [meal('Beef bulgogi bowls', 'Korean'), meal('Beef and bean chili', 'Tex-Mex'), meal('Bolognese with penne', 'Italian'), meal('Beef kofta wraps', 'Middle Eastern')], tip: 'Buy the beef in one family pack.' };
let coconut = false, asked = 0;
const ai = async (url, init) => {
  asked++;
  const b = JSON.parse(init.body);
  const out = /grocery store sales/.test(b.system) ? DEALS
    : coconut ? { meals: PLAN.meals.map(x => ({ ...x, ingredients: [...x.ingredients, { item: 'coconut milk', qty: '1 can' }] })) } : PLAN;
  await new Promise(r => setTimeout(r, 300));
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(out) }], stop_reason: 'end_turn' }));
};
let env = { ACCOUNTS: db }, down = false;

const browser = await chromium.launch();
let failed = 0;
const ok = (label, cond, extra) => { if (!cond) failed++; console.log((cond ? 'ok - ' : 'not ok - ') + label + (extra ? '  ' + extra : '')); };

async function phone(scheme = 'light') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.route('**/meals/api/**', async route => {
    if (down) return route.abort('internetdisconnected');
    const rq = route.request(), u = new URL(rq.url());
    const res = await onRequest({ request: new Request(u.href, { method: rq.method(), headers: rq.headers(), body: rq.method() === 'POST' ? rq.postData() : undefined }), params: { route: u.pathname.split('/meals/api/')[1].split('/') }, env }, ai);
    route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
  });
  await ctx.route(/^https?:\/\/(?!localhost)/, route => route.abort());
  await ctx.addInitScript(t => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('aos.seen', JSON.stringify({ mealsvintage: '999' })); localStorage.setItem('aos.signin.asked', '1');
      localStorage.setItem('aos.session', JSON.stringify({ token: t, user: { id: 'O1', name: 'Tom', role: 'owner' }, at: Date.now() }));
      sessionStorage.setItem('seeded', '1');
    }
  }, tok);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error' && !/Failed to load resource|net::ERR/.test(msg.text())) errs.push(msg.text()); });
  await page.goto(BASE + '/mealsvintage/');
  await page.waitForTimeout(800);
  return { ctx, page, errs };
}
const text = (page, sel) => page.evaluate(s => [...document.querySelectorAll(s)].map(e => e.textContent.trim()), sel);
// SHOTS=<folder> saves screenshots of each screen, to look at.
const shot = async (page, name) => { if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, name + '.png') }); };
const wide = page => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

{ // no key yet
  const { ctx, page, errs } = await phone();
  ok('no AI key: Plan dinners is off', await page.locator('[data-act="plan"]').isDisabled());
  await page.click('#setBtn'); await page.waitForTimeout(300);
  ok('no AI key: the gear says so', (await page.textContent('#setBody')).includes('Not set up yet'));
  ok('the family\'s stores, cards and allergies show in settings', (await page.locator('#sStores [aria-checked="true"]').count()) === 8 && (await page.locator('#sCards [aria-checked="true"]').count()) === 2
    && (await text(page, '#avoid [data-avoid]')).join('|') === 'Tree nuts ✕|Coconut ✕');
  ok('no script errors', !errs.length, errs.join(' | '));
  await ctx.close();
}
env = { ACCOUNTS: db, ANTHROPIC_API_KEY: 'test' };
{ // deals, a plan, the list
  const { ctx, page, errs } = await phone();
  await page.click('#tabs [data-tab="deals"]'); await page.waitForTimeout(200);
  await page.click('[data-act="find"]');
  ok('finding deals shows that it\'s looking', await page.locator('.busy').isVisible());
  await page.waitForSelector('#main .drow', { timeout: 5000 });
  const heads = await text(page, '#main .sechead span:first-child');
  ok('deals sorted into grocery sections, in store order', heads.join('|') === 'Produce|Meat|Dairy & Eggs', heads.join('|'));
  ok('the first store is Whole Foods, and its Prime prices are marked', (await page.inputValue('#dStore')) === 'wholefoods' && (await text(page, '#main .prime')).join('|') === 'Prime|Prime');
  await shot(page, 'deals');
  ok('the page where they were found is linked', (await page.getAttribute('.src a', 'href')) === 'https://example.com/sales');
  const before = asked; await page.click('[data-act="find"]'); await page.waitForSelector('#main .drow');
  ok('looking again this week doesn\'t ask the AI again (within 10 minutes)', asked === before);

  // another store: its own deals, no card of the family's there
  await page.selectOption('#dStore', 'publix'); await page.waitForTimeout(200);
  ok('switching store: Publix has no deals yet', (await page.textContent('#main')).includes('No deals yet'));
  await page.click('[data-act="find"]'); await page.waitForSelector('#main .drow', { timeout: 5000 });
  ok('Publix\'s deals, with no member prices', (await page.locator('#main .drow').count()) === 5 && (await page.locator('#main .prime').count()) === 0);
  ok('each store\'s deals kept apart', !!m.get('meals:deals:publix') && !!m.get('meals:deals:wholefoods'));
  // all of them together
  await page.selectOption('#dStore', 'all'); await page.waitForTimeout(200);
  ok('all my stores: how many have deals', (await page.textContent('#main')).includes('2 of 8 stores'));
  ok('all my stores: each deal says where', (await text(page, '#main .drow .dn small')).some(t => t.startsWith('Publix')) && (await text(page, '#main .drow .dn small')).some(t => t.startsWith('Whole Foods')));
  const was = asked;
  await page.click('[data-act="find-all"]');
  ok('finding the rest says which store it\'s on', (await page.textContent('#main .busy')).includes('of 6'));
  await page.waitForFunction(() => document.querySelector('#main').textContent.includes('8 of 8 stores'), null, { timeout: 15000 });
  ok('finding the rest searched the other 6 stores', asked - was === 6);
  await shot(page, 'deals-all');

  await page.click('[data-act="plan-deals"]'); await page.waitForTimeout(400);
  ok('planning from all the deals: best deals at any store, using them', (await page.inputValue('#pShop')) === 'all' && (await page.inputValue('#pDeals')) === '1');
  await page.click('[data-meat="beef"]');
  ok('picking a meat', (await page.getAttribute('[data-meat="beef"]', 'aria-checked')) === 'true');
  await shot(page, 'plan-sheet');
  ok('the plan sheet names what the family never eats', (await page.textContent('#planBody')).includes('Never tree nuts or coconut'));
  await page.click('#planGo');
  ok('planning shows that it\'s working', await page.locator('.busy').isVisible());
  await page.waitForSelector('#main [data-meal]', { timeout: 5000 });
  const cards = await text(page, '#main [data-meal] .ct');
  await shot(page, 'dinners');
  ok('4 different dinners', cards.length === 4 && new Set(cards).size === 4, cards.join(' | '));
  ok('each says what\'s on sale in it', (await text(page, '#main [data-meal] .saletag')).length === 4);
  ok('a new plan is a draft: nothing saved, and the list waits for it', (await page.textContent('#main')).includes('not saved yet') && !m.get('meals:plan'));
  // try again: another plan, told to differ from this one
  const beforeAgain = asked;
  await page.click('[data-act="again"]');
  await page.waitForFunction(() => document.querySelectorAll('#main [data-meal]').length === 4, null, { timeout: 5000 });
  ok('try again asks for another plan', asked === beforeAgain + 1);
  // accept it, starting tomorrow
  const tomorrow = await page.evaluate(() => document.querySelectorAll('#aStart option')[1].value);
  await page.selectOption('#aStart', tomorrow);
  await page.click('[data-act="accept"]'); await page.waitForTimeout(500);
  const saved = JSON.parse(m.get('meals:plan') || '{}');
  ok('accepting saves the plan for the family, from the day picked', saved.start === tomorrow && saved.dates.length === 4 && !m.get('meals:draft'), JSON.stringify(saved.dates));
  ok('its nights show their dates', (await text(page, '#main [data-meal] .night'))[0].startsWith('Night 1 · '));
  ok('it\'s in Past plans, as the current one', (await page.locator('[data-past] .prime', { hasText: 'Current' }).count()) === 1);
  ok('the sale prices it was planned with are kept with it', Array.isArray(saved.sales) && saved.sales.length > 0);
  await shot(page, 'accepted');
  await page.click('#main [data-meal="2"]'); await page.waitForTimeout(400);
  const recipe = await page.textContent('#recipeBody');
  await shot(page, 'recipe');
  ok('a night opens to its recipe', recipe.includes('Bolognese with penne') && recipe.includes('Brown the beef.') && recipe.includes('serves 4'));
  ok('its ingredients show what\'s on sale', (await text(page, '#recipeBody .saletag')).some(t => t.includes('$1.99/lb')));
  await page.click('#recipeSheet .okbtn'); await page.waitForTimeout(300);

  await page.click('#tabs [data-tab="list"]'); await page.waitForTimeout(300);
  const lh = await text(page, '#main .sechead span:first-child');
  await shot(page, 'list');
  ok('the shopping list is in grocery sections, staples apart', lh.join('|') === 'Produce|Meat|You probably have', lh.join('|'));
  const beef = page.locator('.irow', { hasText: 'Ground beef' });
  ok('the same ingredient once, with every night\'s amount', (await beef.textContent()).includes('6 lb'));
  ok('and where it\'s on sale, at what price', /On sale at [A-Za-z ]+ \$5\.99\/lb/.test(await beef.textContent()));
  await beef.click();
  ok('ticking an item', (await beef.getAttribute('aria-checked')) === 'true');
  ok('nothing wider than the phone', !(await wide(page)));
  ok('no script errors', !errs.length, errs.join(' | '));

  // no signal in the store: the plan and list are still there, ticks kept
  down = true; await page.reload(); await page.waitForTimeout(800);
  ok('offline: the list is still there, with its tick', (await page.locator('.irow[aria-checked="true"]', { hasText: 'Ground beef' }).count()) === 1);
  ok('offline: it says so', (await page.textContent('#main')).includes('offline'));
  down = false;
  await ctx.close();
}
{ // a past plan opens with its dinners and shopping list
  const { ctx, page } = await phone();
  await page.click('[data-past]'); await page.waitForTimeout(400);
  const t = await page.textContent('#pastBody');
  ok('a past plan opens with its dinners and its shopping list', (await page.locator('#pastBody [data-meal]').count()) === 4 && t.includes('Shopping list') && t.includes('Ground beef'));
  await page.click('#pastBody [data-meal="0"]'); await page.waitForTimeout(400);
  ok('and its recipes', (await page.textContent('#recipeBody')).includes('Beef bulgogi bowls'));
  await shot(page, 'past');
  await ctx.close();
}
{ // a new plan can be discarded, and the accepted one stays
  const { ctx, page } = await phone();
  await page.click('#fab'); await page.waitForTimeout(300); await page.click('#planGo');
  await page.waitForSelector('[data-act="discard"]', { timeout: 5000 });
  await page.click('[data-act="discard"]'); await page.waitForTimeout(400);
  ok('discarding drops the new plan; the accepted one shows again', !m.get('meals:draft') && (await page.locator('[data-src="plan"]').count()) === 4);
  await ctx.close();
}
{ // a plan that keeps using coconut is never kept
  coconut = true;
  const { ctx, page } = await phone();
  const was = m.get('meals:plan');
  await page.click('#fab'); await page.waitForTimeout(300); await page.click('#planGo');
  await page.waitForSelector('#toast:not([hidden])', { timeout: 8000 });
  ok('a plan with coconut, twice: not kept, and it says why', (await page.textContent('#toastMsg')).includes('something the family avoids') && m.get('meals:plan') === was);
  ok('the last good plan still shows', (await text(page, '#main [data-meal] .ct')).length === 4);
  coconut = false;
  await ctx.close();
}
{ // settings are the family's
  const { ctx, page } = await phone('dark');
  await page.click('#setBtn'); await page.waitForTimeout(300);
  ok('Settings: titled Settings, with a Done tick like the other apps', (await page.textContent('#setLbl')) === 'Settings' && (await page.getAttribute('#sSave', 'aria-label')) === 'Done');
  await page.fill('#sAdd', 'Shellfish'); await page.click('#sAddGo');
  await page.click('[data-avoid="coconut"]');
  await page.click('[data-store="target"]'); await page.click('[data-store="lidl"]'); await page.click('[data-card="prime"]');
  await shot(page, 'settings-dark');
  await page.click('#sSave'); await page.waitForTimeout(400);
  await shot(page, 'dinners-dark');
  const saved = JSON.parse(m.get('meals:settings'));
  ok('settings saved for the family', saved.avoid.join('|') === 'tree nuts|shellfish' && saved.stores.join('|') === 'wholefoods|harristeeter|publix|lowesfoods|aldi|walmart' && saved.cards.join('|') === 'vic', JSON.stringify(saved));
  await page.click('#tabs [data-tab="deals"]'); await page.waitForTimeout(200);
  ok('the store picker shows only the family\'s stores', (await page.locator('#dStore option').count()) === 7);
  ok('dark: nothing wider than the phone', !(await wide(page)));
  await ctx.close();
}

{ // drawn in the Retro look, light and dark: Futura, flat cream or walnut, mustard, teal, orange, atomic shapes
  for (const scheme of ['light', 'dark']) {
    const { ctx, page, errs } = await phone(scheme);
    const q = (sel, props, pseudo) => page.$eval(sel, (e, [props, pseudo]) => { const c = getComputedStyle(e, pseudo || null); return props.map(p => c[p]); }, [props, pseudo]);
    const cream = scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', ground = scheme === 'light' ? 'rgb(244, 236, 221)' : 'rgb(36, 30, 26)';
    const teal = scheme === 'light' ? 'rgb(31, 111, 107)' : 'rgb(79, 179, 171)', orange = scheme === 'light' ? 'rgb(201, 80, 42)' : 'rgb(216, 87, 42)';
    const flat = v => v === 'none' || v === '';
    await page.waitForSelector('#main [data-meal]', { timeout: 5000 });
    ok(scheme + ': Futura', /Futura/.test((await q('body', ['fontFamily']))[0]));
    ok(scheme + ': the ground is cream / walnut', (await q('body', ['backgroundColor']))[0] === ground);
    const [bg, shadow, backdrop, radius] = await q('#main [data-meal]', ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
    ok(scheme + ': a night is a flat cream / walnut card, 20px round', bg === cream && shadow === 'none' && flat(backdrop) && radius === '20px', [bg, shadow, backdrop, radius].join(' | '));
    ok(scheme + ': a mustard sun, a teal dot and a burnt-orange pill behind the title', (await q('.ambient i:nth-child(1)', ['backgroundColor']))[0] === 'rgb(227, 167, 47)'
      && (await q('.ambient i:nth-child(2)', ['backgroundColor']))[0] === teal && (await q('.ambient i:nth-child(3)', ['backgroundColor']))[0] === 'rgb(216, 87, 42)');
    ok(scheme + ': the title is big, with the three little bars under it', (await q('.title', ['fontSize']))[0] === '44px' && (await q('.title', ['backgroundImage'], '::after'))[0].startsWith('url('));
    ok(scheme + ': the tabs have a mustard thumb', (await q('#tabs .slthumb', ['backgroundColor']))[0] === 'rgb(227, 167, 47)' && (await q('#tabs', ['backgroundColor']))[0] === cream);
    ok(scheme + ': + is solid orange', (await q('#fab', ['backgroundColor']))[0] === orange);
    ok(scheme + ': the theme colour is cream / walnut and the status bar is not translucent', (await page.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content')) === (scheme === 'light' ? '#F4ECDD' : '#241E1A')
      && (await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content')) === 'default');
    await page.click('#fab'); await page.waitForTimeout(700);
    const [sbg, sradius, sfilter] = await q('#planSheet .sheet', ['backgroundColor', 'borderRadius', 'backdropFilter']);
    ok(scheme + ': the sheet is a flat panel', sbg === cream && sradius === '28px' && flat(sfilter), [sbg, sradius, sfilter].join(' | '));
    ok(scheme + ': Plan is solid orange, the chosen meat is mustard, Nights is a flat menu', (await q('#planGo', ['backgroundColor']))[0] === orange
      && (await q('#meats [aria-checked="true"]', ['boxShadow']))[0].includes('rgb(227, 167, 47)') && (await q('#pDays', ['backgroundColor']))[0] === cream);
    await shot(page, 'retro-plan-' + scheme);
    await page.click('#planSheet .iconbtn[data-close]'); await page.waitForTimeout(400);
    await page.click('#main [data-meal="0"]'); await page.waitForTimeout(600);
    ok(scheme + ': a recipe\'s Done is solid orange', (await q('#recipeSheet .okbtn', ['backgroundColor']))[0] === orange);
    await shot(page, 'retro-recipe-' + scheme);
    await page.click('#recipeSheet .okbtn'); await page.waitForTimeout(400);
    await page.click('#tabs [data-tab="deals"]'); await page.waitForTimeout(500);
    ok(scheme + ': a secondary button is outlined teal, not filled', (await q('#main [data-act="find"]', ['backgroundColor']))[0] === 'rgba(0, 0, 0, 0)' && (await q('#main [data-act="find"]', ['color']))[0] === (scheme === 'light' ? teal : 'rgb(92, 189, 181)'));
    await shot(page, 'retro-deals-' + scheme);
    await page.click('#tabs [data-tab="list"]'); await page.waitForTimeout(500);
    await page.click('.irow >> nth=0'); await page.waitForTimeout(200);
    ok(scheme + ': a ticked item is teal', (await q('.irow[aria-checked="true"] .box', ['backgroundColor']))[0] === teal);
    await shot(page, 'retro-list-' + scheme);
    await page.click('#tabs [data-tab="dinners"]'); await page.waitForTimeout(300);
    ok(scheme + ': no script errors, nothing blocked by the page policy', !errs.length, errs.join(' | '));
    await ctx.close();
  }
}
{ // its own storage, the family's server route
  const { ctx, page } = await phone();
  const calls = []; page.on('request', r => { const u = new URL(r.url()); if (/\/api\//.test(u.pathname) && !u.pathname.startsWith('/aOS/api/')) calls.push(u.pathname); });   // aOS's own state call (welcome.js) is not the app's
  await page.reload(); await page.waitForTimeout(900);
  const keys = await page.evaluate(() => Object.keys(localStorage));
  ok('its own keys: allison-mealsv-…, never Meals\' allison-meals-…', keys.includes('allison-mealsv-v2') && keys.filter(k => !/^(allison-mealsv-|aos\.)/.test(k)).length === 0 && !keys.some(k => /^allison-meals-/.test(k)), keys.join());
  ok('its calls go to Meals\' route, the family\'s', calls.length > 0 && calls.every(c => c.startsWith('/meals/api/')), calls.join());
  const mine = JSON.parse(await page.evaluate(() => localStorage.getItem('allison-mealsv-v2')));
  ok('it shows the family\'s plan', !!mine.plan && mine.plan.id === JSON.parse(m.get('meals:plan')).id);
  // Meals itself, opened on the same account, has the same plan
  await page.goto(BASE + '/meals/'); await page.waitForTimeout(1200);
  const theirs = JSON.parse(await page.evaluate(() => localStorage.getItem('allison-meals-v2')));
  ok('Meals, on the same account, has the same plan', theirs.plan.id === mine.plan.id);
  await ctx.close();
}

// ---- The Google Sheet: a readable copy, one way ----
const SHEET_URL = 'https://script.google.com/macros/s/TEST/exec', SHEET_SECRET = 'test-secret-phrase';
const GS = path.join(R, 'meals/google-sheet-sync.gs');
const until = async (fn, ms = 12000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
const withSheet = async (ctx, sheet, posts) => {
  await ctx.route(/^https:\/\/script\.google(usercontent)?\.com\//, route => {
    const req = route.request(), cors = { 'access-control-allow-origin': '*' };
    if (req.method() === 'POST') { posts.push(JSON.parse(req.postData())); return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(sheet.post(req.postData())) }); }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(sheet.get()) });
  });
};
const logCalls = page => { const a = []; page.on('request', r => { if (/\/meals\/api\/log\//.test(r.url())) a.push(r.url()); }); return a; };
const SHEET_STEP = async () => {
  const sheet = fakeSheet(GS, SHEET_SECRET), posts = [];
  const { ctx, page, errs } = await phone();
  await withSheet(ctx, sheet, posts);
  const logs = logCalls(page);
  await page.click('#setBtn'); await page.waitForTimeout(300);
  ok('Sheet: the gear has the row, not connected', /Google Sheet\s*Not connected/.test(await page.textContent('#sheetBtn')));
  await page.click('#sheetBtn'); await page.waitForSelector('#syncSheet:not([hidden])');
  ok('Sheet: the form shows, with the owner\'s link filled in and no secret', await page.isVisible('#syForm') && await page.isHidden('#syOn')
    && /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(await page.inputValue('#syUrl')) && (await page.inputValue('#sySecret')) === '');
  await page.fill('#syUrl', 'https://example.com/x'); await page.fill('#sySecret', 'abc'); await page.click('#syConnect');
  ok('Sheet: a link that is not Apps Script\'s is refused before anything is sent', /starts with https:\/\/script\.google\.com/.test(await page.textContent('#syStatus')) && posts.length === 0);
  await page.fill('#syUrl', SHEET_URL); await page.fill('#sySecret', 'wrong'); await page.click('#syConnect');
  await page.waitForFunction(() => /secret code doesn.t match/.test(document.getElementById('syStatus').textContent));
  ok('Sheet: a wrong secret says so, and nothing is kept', (await page.evaluate(() => localStorage.getItem('allison-mealsv-v1-sheet'))) === null);
  await shot(page, 'sheet-form');
  await page.fill('#sySecret', SHEET_SECRET); await page.click('#syConnect');
  await page.waitForSelector('#syOn:not([hidden])', { timeout: 12000 });
  const first = posts[posts.length - 1];
  ok('Sheet: connecting sends a snapshot: the whole current plan, deals, shopping list, settings', first.action === 'sync' && first.v === 1 && first.secret === SHEET_SECRET && first.plans.length >= 1 && first.deals.length > 0 && first.shopping.buy.length > 0 && !!first.settings.stores.length, Object.keys(first).join());
  const cur = first.plans.find(p => p.meals.length === 4);
  ok('Sheet: the plan is whole (id, who, when, dates, store name, meals with ingredients and steps), without the sale prices kept for the list', !!cur && /^p/.test(cur.id) && cur.acceptedBy === 'Tom' && cur.acceptedAt > 0 && cur.dates.length === 4 && cur.shopName === 'Best deals' && cur.meat === 'beef'
    && cur.meals[0].ingredients[0].item === 'ground beef' && cur.meals[0].steps.length === 2 && cur.sales === undefined && cur.tip === 'Buy the beef in one family pack.', JSON.stringify(cur && Object.keys(cur)));
  const beefRow = first.shopping.buy.find(x => x.item === 'Ground beef');
  ok('Sheet: the shopping list is as the List tab shows it (section, amount, nights, sale)', !!beefRow && beefRow.section === 'Meat' && beefRow.amount === '6 lb' && beefRow.nights === 'nights 1, 2, 3, 4' && /^\$5\.99\/lb at /.test(beefRow.sale) && first.shopping.pantry.some(x => x.item === 'Olive oil' && x.amount === '4 tbsp'), JSON.stringify(beefRow));
  const d0 = first.deals.find(d => d.store === 'Publix');
  ok('Sheet: deals go with the store\'s name and week', !!d0 && /^\d{4}-\d\d-\d\d$/.test(d0.week) && d0.items.length === 5 && d0.items[0].name && typeof d0.items[0].member === 'boolean', JSON.stringify(d0 && d0.items[0]));
  ok('Sheet: settings are the stores and cards by name, and what is avoided', first.settings.stores.includes('Harris Teeter') && !first.settings.stores.includes('Target') && first.settings.cards.join() === 'VIC (Harris Teeter)' && first.settings.avoid.join() === 'tree nuts,shellfish' && /^Claude /.test(first.settings.model), JSON.stringify(first.settings));
  const plansTab = sheet.tab('Plans');
  ok('Sheet: Plans has a row a night, Shopping list and Deals are readable', plansTab.length === 1 + 4 * first.plans.length && plansTab[1][4] && sheet.tab('Shopping list').some(r => r[1] === 'Ground beef' && r[2] === '6 lb') && sheet.tab('Deals').some(r => r[1] === 'Publix') && sheet.tab('Settings').some(r => r[0] === 'Never in a plan' && r[1] === 'tree nuts, shellfish'));
  ok('Sheet: the status says connected', /Connected/.test(await page.textContent('#syStatus')), await page.textContent('#syStatus'));
  await shot(page, 'sheet-on');
  // a second plan accepted: only it goes (the first was sent as the current plan, and is not fetched again)
  await page.click('#syncSheet .iconbtn[data-close]'); await page.click('#sSave'); await page.waitForTimeout(300);
  const n0 = posts.length, l0 = logs.length;
  await page.click('#fab'); await page.waitForTimeout(300); await page.click('#planGo');
  await page.waitForSelector('[data-act="accept"]', { timeout: 8000 });
  await page.click('[data-act="accept"]');
  ok('Sheet: accepting a plan sends it a moment later, and nothing old again', await until(() => posts.length > n0));
  const second = posts[posts.length - 1], newId = JSON.parse(m.get('meals:plan')).id;
  ok('Sheet: that send has just the new plan, with no fetch of the older one', second.plans.length === 1 && second.plans[0].id === newId && logs.length === l0, second.plans.map(p => p.id).join() + ' ' + (logs.length - l0));
  ok('Sheet: Plans now holds both plans, newest first', sheet.tab('Plans').length === 1 + 4 * 2 && sheet.tab('Plans')[1][16] === newId);
  // discarding a draft changes nothing the Sheet shows: no send
  const n1 = posts.length;
  await page.click('#fab'); await page.waitForTimeout(300); await page.click('#planGo'); await page.waitForSelector('[data-act="discard"]', { timeout: 8000 });
  await page.click('[data-act="discard"]'); await page.waitForTimeout(3800);
  ok('Sheet: nothing changed, nothing sent', posts.length === n1);
  // settings saved: the Settings tab follows
  await page.click('#setBtn'); await page.waitForTimeout(300); await page.fill('#sAdd', 'Mushrooms'); await page.click('#sAddGo'); await page.click('#sSave');
  ok('Sheet: saving settings sends them', await until(() => sheet.tab('Settings').some(r => r[0] === 'Never in a plan' && /mushrooms/.test(r[1]))));
  ok('no script errors', !errs.length, errs.join(' | '));
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('allison-mealsv-v1-sheet')));
  ok('Sheet: the link and code are kept on this phone', kept && kept.url === SHEET_URL && kept.secret === SHEET_SECRET);
  await ctx.close();

  // a fresh phone: connecting fetches the plans the list only summarised, once, and sends all of them
  const sheet2 = fakeSheet(GS, SHEET_SECRET), posts2 = [];
  const B = await phone('dark');
  await withSheet(B.ctx, sheet2, posts2);
  const logs2 = logCalls(B.page);
  await B.page.click('#setBtn'); await B.page.click('#sheetBtn');
  await B.page.fill('#syUrl', SHEET_URL); await B.page.fill('#sySecret', SHEET_SECRET); await B.page.click('#syConnect');
  await B.page.waitForSelector('#syOn:not([hidden])', { timeout: 15000 });
  const all = posts2[posts2.length - 1];
  const logLen = JSON.parse(await B.page.evaluate(() => localStorage.getItem('allison-mealsv-v2'))).log.length;
  ok('Sheet: a new connection sends every plan, fetching each past one whole once', all.plans.length === logLen && logLen >= 2 && logs2.length === logLen - 1 && new Set(all.plans.map(p => p.id)).size === logLen && all.plans.every(p => p.meals.length && p.meals[0].steps.length), logLen + ' ' + logs2.length);
  ok('Sheet: and Plans has them all', sheet2.tab('Plans').length === 1 + 4 * logLen);
  await shot(B.page, 'sheet-on-dark');
  // later sends: only the current plan
  await B.page.evaluate(() => window.__meals.load()); await B.page.waitForTimeout(3500);
  ok('Sheet: opening again with nothing new sends nothing', posts2.length === 1);
  // disconnecting forgets the link here and leaves the Sheet as it is
  await B.page.click('#syOff'); await B.page.click('#syOff');
  ok('Sheet: Disconnect forgets the link and code on this phone', (await B.page.evaluate(() => localStorage.getItem('allison-mealsv-v1-sheet'))) === null && await B.page.isVisible('#syForm') && sheet2.tab('Plans').length === 1 + 4 * logLen);
  ok('Sheet: no script errors, nothing blocked by the page policy', !B.errs.length, B.errs.join(' | '));
  await B.ctx.close();

  // the other errors, in words
  const E = await phone();
  let app = 'allison-drinks-sync', reply = null;
  await E.ctx.route(/^https:\/\/script\.google(usercontent)?\.com\//, route => route.request().method() === 'POST'
    ? route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(reply || { ok: false, error: 'wrong-secret' }) })
    : route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, app, v: 1 }) }));
  await E.page.click('#setBtn'); await E.page.click('#sheetBtn');
  const tryConnect = async re => { await E.page.evaluate(() => { document.getElementById('toast').hidden = true; }); await E.page.fill('#syUrl', SHEET_URL); await E.page.fill('#sySecret', 'x'); await E.page.click('#syConnect'); await E.page.waitForFunction(r => new RegExp(r).test(document.getElementById('syStatus').textContent), re.source); };
  await tryConnect(/another AllisonOS app/);
  app = 'allison-meals-sync'; await tryConnect(/old copy of the script/);
  reply = { ok: false, error: 'secret-not-set' }; await tryConnect(/still says SECRET/);
  reply = { ok: false, error: 'busy' }; await tryConnect(/Sheet was busy/);
  reply = { ok: false, error: 'bad-request' }; await tryConnect(/didn.t understand/);
  reply = { ok: true, app: 'allison-orders-sync' }; await tryConnect(/another AllisonOS app/);
  await E.ctx.route(/^https:\/\/script\.google(usercontent)?\.com\//, route => route.request().method() === 'POST' ? route.fulfill({ status: 200, contentType: 'text/html', body: '<html>sign in</html>' }) : route.abort());
  await tryConnect(/didn.t answer like the Meals script/);
  await E.ctx.route(/^https:\/\/script\.google(usercontent)?\.com\//, route => route.abort());
  await tryConnect(/Couldn.t reach the Sheet/);
  ok('Sheet: every error says what to do', true);
  await E.ctx.close();

  // a setup link from another phone fills the form; the backup copy in IndexedDB reconnects a phone that lost its storage
  const sheet3 = fakeSheet(GS, SHEET_SECRET), posts3 = [];
  const S = await phone();
  await withSheet(S.ctx, sheet3, posts3);
  const link = '#sync=' + Buffer.from(JSON.stringify({ u: SHEET_URL, s: SHEET_SECRET })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await S.page.goto('about:blank'); await S.page.goto(BASE + '/mealsvintage/' + link);
  await S.page.waitForSelector('#syncSheet:not([hidden])');
  ok('Sheet: a setup link opens the form filled in', (await S.page.inputValue('#syUrl')) === SHEET_URL && (await S.page.inputValue('#sySecret')) === SHEET_SECRET && !(await S.page.evaluate(() => location.hash)));
  await S.page.click('#syConnect'); await S.page.waitForSelector('#syOn:not([hidden])', { timeout: 15000 });
  const idb = await S.page.evaluate(() => new Promise(res => { const r = indexedDB.open('allison-mealsv', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('sheet'); q.onsuccess = () => res(q.result); }; }));
  ok('Sheet: the link and code are also kept in IndexedDB', !!idb && idb.url === SHEET_URL && idb.secret === SHEET_SECRET);
  const n3 = posts3.length;
  await S.page.evaluate(() => localStorage.removeItem('allison-mealsv-v1-sheet'));
  await S.page.reload(); await S.page.waitForTimeout(500);
  ok('Sheet: a phone that lost its storage reconnects from the IndexedDB copy', await until(() => posts3.length > n3), String(posts3.length - n3));
  await S.ctx.close();
};
await SHEET_STEP();
await browser.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
