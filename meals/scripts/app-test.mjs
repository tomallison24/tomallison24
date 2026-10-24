// Meals at iPhone size (390 x 844), against the real server code
// (functions/meals/api) on an in-memory KV with a real family session, and a
// stand-in for the AI service (no network, no key): no key yet, finding the
// week's deals (sorted into grocery sections), planning dinners, a recipe, the
// shopping list (ticks kept, the list there offline), the plan folded away and cleared (with Undo), a plan that keeps using
// coconut never saved, settings, the family's Google Sheet through aOS (the real
// google-sheet-sync.gs on a fake Sheet, with who's asking from each phone's session:
// not set up, signed out, the old link handed over, what is sent and when, whose rows,
// plans read back from it, a plan taken back), and no script errors
// or sideways scrolling in light and dark. Seeds localStorage['aos.seen'] so the walkthrough stays away.
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
{ // the plan's bar: it folds the dinners away (kept folded on this phone), and × clears the plan for the family, with Undo
  const { ctx, page, errs } = await phone();
  const id = JSON.parse(m.get('meals:plan')).id;
  ok('the plan has a bar: what it is, when, and a clear button', (await page.locator('.planbar [data-act="fold"][aria-expanded="true"]').count()) === 1
    && (await page.locator('.planbar [data-act="clear"]').count()) === 1 && (await page.locator('#planNights [data-meal]').count()) === 4
    && /4 dinners/.test(await page.textContent('.planbar .pt small')));
  await page.click('.planbar [data-act="fold"]'); await page.waitForTimeout(300);
  ok('tapped, it folds the dinners away into the bar', await page.locator('#planNights').isHidden() && (await page.getAttribute('.planbar [data-act="fold"]', 'aria-expanded')) === 'false');
  await shot(page, 'folded');
  await page.reload(); await page.waitForTimeout(800);
  ok('and stays folded on this phone', await page.locator('#planNights').isHidden());
  await page.click('.planbar [data-act="fold"]'); await page.waitForTimeout(300);
  ok('tapped again, the dinners are back', (await page.locator('#planNights [data-meal]').count()) === 4 && await page.locator('#planNights').isVisible());
  await page.click('.planbar [data-act="clear"]'); await page.waitForTimeout(500);
  ok('× clears the plan for the family', !m.get('meals:plan') && (await page.locator('.planbar').count()) === 0 && (await page.textContent('#main')).includes('No dinners planned yet'));
  ok('it stays in Past plans', (await page.locator(`[data-past="${id}"]`).count()) === 1 && JSON.parse(m.get('meals:log'))[0].id === id);
  ok('and says so, with Undo', /still in Past plans/.test(await page.textContent('#toastMsg')) && await page.locator('#toastAct').isVisible());
  await page.click('#toastAct'); await page.waitForTimeout(500);
  ok('Undo puts it back as the family\'s plan', JSON.parse(m.get('meals:plan') || '{}').id === id && (await page.locator('#planNights [data-meal]').count()) === 4);
  ok('nothing wider than the phone; no script errors', !(await wide(page)) && !errs.length, errs.join(' | '));
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
    ok('Sheet: a sync is the plan, deals, list, settings and graves, keeping 90 days; never a phrase', first.action === 'sync' && first.v === 3 && first.window === 90 && /^\d{4}-\d\d-\d\d$/.test(first.today)
      && !('secret' in first) && first.plans.length === 1 && first.deals.length > 0 && first.shopping.buy.length > 0 && !!first.settings.stores.length && JSON.stringify(first.graves) === '{}', Object.keys(first).join());
    const cur = first.plans[0];
    ok('Sheet: the plan is whole (id, who, when read, dates, store, meals with ingredients and steps), without the sale prices kept for the list', /^p/.test(cur.id) && cur.acceptedBy === 'Tom' && cur.acceptedAt > 0 && cur.updated >= cur.acceptedAt
      && cur.dates.length === 4 && cur.shopName === 'Best deals' && cur.meat === 'beef' && cur.meals[0].ingredients[0].item === 'ground beef' && cur.meals[0].steps.length === 2 && cur.sales === undefined && cur.by === undefined && cur.tip === 'Buy the beef in one family pack.', JSON.stringify(Object.keys(cur)));
    const beefRow = first.shopping.buy.find(x => x.item === 'Ground beef');
    ok('Sheet: the shopping list is as the List tab shows it (section, amount, nights, sale)', !!beefRow && beefRow.section === 'Meat' && beefRow.amount === '6 lb' && beefRow.nights === 'nights 1, 2, 3, 4' && /^\$5\.99\/lb at /.test(beefRow.sale) && first.shopping.pantry.some(x => x.item === 'Olive oil' && x.amount === '4 tbsp'), JSON.stringify(beefRow));
    const d0 = first.deals.find(d => d.store === 'Publix');
    ok('Sheet: deals go with the store’s name and week', !!d0 && /^\d{4}-\d\d-\d\d$/.test(d0.week) && d0.items.length === 5 && d0.items[0].name && typeof d0.items[0].member === 'boolean', JSON.stringify(d0 && d0.items[0]));
    ok('Sheet: settings are the stores and cards by name, and what is avoided', first.settings.stores.includes('Harris Teeter') && !first.settings.stores.includes('Target') && first.settings.cards.join() === 'VIC (Harris Teeter)' && first.settings.avoid.join() === 'tree nuts,shellfish' && /^Claude /.test(first.settings.model), JSON.stringify(first.settings));
    const plansTab = sheet.tab('Plans');
    ok('Sheet: Plans has a row a night, Planned by Tom; Shopping list, Deals (with Who) and Settings are readable', plansTab.length === 1 + 4 && plansTab[0][0] === 'Planned by' && plansTab.slice(1).every(r => r[0] === 'Tom')
      && sheet.tab('Shopping list').some(r => r[1] === 'Ground beef' && r[2] === '6 lb') && sheet.tab('Deals').some(r => r[0] === 'Tom' && r[2] === 'Publix') && sheet.tab('Settings').some(r => r[0] === 'Never in a plan' && r[1] === 'tree nuts, shellfish'));
    ok('Sheet: each row says whose (the owner’s), and the Sheet knows the people', hiddenRows('_plans').every(p => p.by === 'O1') && JSON.stringify(sheet.tab('_people').slice(1)) === JSON.stringify([['(owner)', 'O1'], ['O1', 'Tom']]));
    ok('Sheet: synced, the phone notes when', await synced(page));
    await page.click('#setBtn'); await page.waitForTimeout(300);
    ok('Sheet: signed in and synced, Settings still have no Sheet row', await noSheetUI(page));
    await page.click('#sSave'); await page.waitForTimeout(300);
    // a second plan accepted: only it goes (the first is in the Sheet already, and is not fetched again)
    const n0 = sheetCalls.length, l0 = logs.length;
    await page.click('#fab'); await page.waitForTimeout(300); await page.click('#planGo');
    await page.waitForSelector('[data-act="accept"]', { timeout: 8000 });
    await page.click('[data-act="accept"]');
    ok('Sheet: accepting a plan sends it a moment later', await until(() => sheetCalls.length > n0));
    const second = sheetCalls[sheetCalls.length - 1].body, newId = JSON.parse(m.get('meals:plan')).id;
    ok('Sheet: that sync has just the new plan, with no fetch of the older one', second.plans.length === 1 && second.plans[0].id === newId && logs.length === l0, second.plans.map(p => p.id).join() + ' ' + (logs.length - l0));
    ok('Sheet: Plans now holds both plans, newest first', sheet.tab('Plans').length === 1 + 4 * 2 && sheet.tab('Plans')[1][16] === newId);
    // discarding a draft changes nothing the Sheet shows: no sync
    const n1 = sheetCalls.length;
    await page.click('#fab'); await page.waitForTimeout(300); await page.click('#planGo'); await page.waitForSelector('[data-act="discard"]', { timeout: 8000 });
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
    ok('Sheet: a phone whose Sheet lacks a plan the family server keeps sends it next (with the current plan), fetched whole once', await until(() => sheet.tab('Plans') && sheet.tab('Plans').length === 1 + 8)
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
    ok('Sheet: an old plan from the Sheet opens with its dinners, who accepted it, its store and its shopping list', (await page.locator('#pastBody [data-meal]').count()) === 2 && /accepted by Mum Allison/.test(t) && /Publix/.test(t) && t.includes('Shopping list') && t.includes('Pork shoulder'), t.slice(0, 200));
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
    await page.waitForSelector('#main [data-meal]', { timeout: 5000 });
    ok(scheme + ': Futura', /Futura/.test((await q('body', ['fontFamily']))[0]));
    ok(scheme + ': the ground is cream / walnut', (await q('body', ['backgroundColor']))[0] === ground);
    const [bg, shadow, backdrop, radius] = await q('#main [data-meal]', ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
    ok(scheme + ': a night is a flat cream / walnut card, 20px round', bg === cream && shadow === 'none' && flat(backdrop) && radius === '20px', [bg, shadow, backdrop, radius].join(' | '));
    ok(scheme + ': a mustard sun, a teal dot and a burnt-orange pill behind the title', (await q('.ambient i:nth-child(1)', ['backgroundColor']))[0] === ('rgb(227, 167, 47)')
      && (await q('.ambient i:nth-child(2)', ['backgroundColor']))[0] === teal && (await q('.ambient i:nth-child(3)', ['backgroundColor']))[0] === 'rgb(216, 87, 42)');
    ok(scheme + ': the title is big, with the three little bars under it', (await q('.title', ['fontSize']))[0] === '44px' && (await q('.title', ['backgroundImage'], '::after'))[0].startsWith('url('));
    ok(scheme + ': the tabs have a mustard thumb', (await q('#tabs .slthumb', ['backgroundColor']))[0] === 'rgb(227, 167, 47)' && (await q('#tabs', ['backgroundColor']))[0] === cream);
    ok(scheme + ': + is solid orange', (await q('#fab', ['backgroundColor']))[0] === orange);
    ok(scheme + ': the theme colour is the sky\'s ground (home/sky.js) and the status bar is not translucent', (await page.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content')) === (scheme === 'light' ? '#F1DFBB' : '#4A391E')
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
{ // Standard: Sea glass, the Vintage block switched off, no sky; the icon and status bar follow
  for (const scheme of ['light', 'dark']) {
    const { ctx, page, errs } = await phone(scheme, { design: 'glass' });
    await page.waitForSelector('#main [data-meal]', { timeout: 5000 });
    const q = (sel, props) => page.$eval(sel, (e, props) => { const c = getComputedStyle(e); return props.map(p => c[p]); }, props);
    ok(scheme + ' Standard: data-look is glass, the Vintage styles are off, no sky', await page.evaluate(() => document.documentElement.dataset.look === 'glass' && document.getElementById('vintage').media === 'not all' && !document.documentElement.hasAttribute('data-sky')));
    ok(scheme + ' Standard: the Sea glass ground and the system font', (await q('body', ['backgroundColor']))[0] === (scheme === 'light' ? 'rgb(238, 242, 240)' : 'rgb(13, 18, 19)') && !/Futura/.test((await q('body', ['fontFamily']))[0]));
    ok(scheme + ' Standard: the Sea glass icon, a translucent status bar, the Sea glass bar colour', /icon-glass-180\.png/.test(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'))
      && (await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content')) === 'black-translucent'
      && (await page.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content')) === (scheme === 'light' ? '#EEF2F0' : '#0D1213'));
    await shot(page, 'glass-dinners-' + scheme);
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
  const seed = { 'aos.seen': JSON.stringify({ meals: '999', mealsvintage: '999' }), 'allison-meals-v1-tab': '"deals"', 'allison-mealsv-v1-tab': '"list"' };
  const { ctx, page } = await phone('light', { seed });
  ok('both: Meals\' own data is kept', (await page.evaluate(() => localStorage.getItem('allison-meals-v1-tab'))) === '"deals"');
  await ctx.close();
}
await SHEET_STEP();
await browser.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
