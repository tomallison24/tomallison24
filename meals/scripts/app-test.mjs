// Meals at iPhone size (390 x 844), against the real server code
// (functions/meals/api) on an in-memory KV with a real family session, and a
// stand-in for the AI service (no network, no key): no key yet, finding the
// week's deals (sorted into grocery sections), planning dinners, a recipe, the
// shopping list (ticks kept, the list there offline), a plan that keeps using
// coconut never saved, settings, and no script errors or sideways scrolling in
// light and dark. Seeds localStorage['aos.seen'] so the walkthrough stays away.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node meals/scripts/app-test.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
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

// The stand-in AI (Perplexity's shape): deals, or a plan, by what it's asked.
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
  const out = /grocery store sales/.test(b.instructions) ? DEALS
    : coconut ? { meals: PLAN.meals.map(x => ({ ...x, ingredients: [...x.ingredients, { item: 'coconut milk', qty: '1 can' }] })) } : PLAN;
  await new Promise(r => setTimeout(r, 300));
  return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(out) }] }] }));
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
      localStorage.setItem('aos.seen', JSON.stringify({ meals: '999' })); localStorage.setItem('aos.signin.asked', '1');
      localStorage.setItem('aos.session', JSON.stringify({ token: t, user: { id: 'O1', name: 'Tom', role: 'owner' }, at: Date.now() }));
      sessionStorage.setItem('seeded', '1');
    }
  }, tok);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error' && !/Failed to load resource|net::ERR/.test(msg.text())) errs.push(msg.text()); });
  await page.goto(BASE + '/meals/');
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
  ok('the family\'s store and allergies show in settings', (await page.inputValue('#sStore')).includes('Waverly Place') && (await text(page, '#avoid [data-avoid]')).join('|') === 'Tree nuts ✕|Coconut ✕');
  ok('no script errors', !errs.length, errs.join(' | '));
  await ctx.close();
}
env = { ACCOUNTS: db, PERPLEXITY_API_KEY: 'test' };
{ // deals, a plan, the list
  const { ctx, page, errs } = await phone();
  await page.click('#tabs [data-tab="deals"]'); await page.waitForTimeout(200);
  await page.click('[data-act="find"]');
  ok('finding deals shows that it\'s looking', await page.locator('.busy').isVisible());
  await page.waitForSelector('#main .drow', { timeout: 5000 });
  const heads = await text(page, '#main .sechead span:first-child');
  ok('deals sorted into grocery sections, in store order', heads.join('|') === 'Produce|Meat|Dairy & Eggs', heads.join('|'));
  ok('Prime prices are marked', (await text(page, '#main .prime')).length === 2);
  await shot(page, 'deals');
  ok('the page where they were found is linked', (await page.getAttribute('.src a', 'href')) === 'https://example.com/sales');
  const before = asked; await page.click('[data-act="find"]'); await page.waitForSelector('#main .drow');
  ok('looking again this week doesn\'t ask the AI again (within 10 minutes)', asked === before);

  await page.click('[data-act="plan-deals"]'); await page.waitForTimeout(400);
  ok('planning from the deals: use this week\'s deals is on', (await page.inputValue('#pDeals')) === '1');
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
  ok('and its sale price', (await beef.textContent()).includes('On sale $5.99/lb'));
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
  await page.fill('#sAdd', 'Shellfish'); await page.click('#sAddGo');
  await page.click('[data-avoid="coconut"]');
  await shot(page, 'settings-dark');
  await page.click('#sSave'); await page.waitForTimeout(400);
  await shot(page, 'dinners-dark');
  ok('settings saved for the family', JSON.parse(m.get('meals:settings')).avoid.join('|') === 'tree nuts|shellfish');
  ok('dark: nothing wider than the phone', !(await wide(page)));
  await ctx.close();
}
await browser.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
