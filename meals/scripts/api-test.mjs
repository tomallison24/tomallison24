// Checks functions/meals/api/[[route]].js in plain Node, on an in-memory
// stand-in for Workers KV with real sessions from server/auth.js, and stand-ins
// for both AI services (no network, no keys): the header guard, accounts off,
// signing in, no key, the week, deals by search and by paste (and that this
// week's search isn't paid for twice), plans (variety asked for, recent dinners
// passed on, sale items used) and, above all, that a plan with anything the
// family avoids is never saved.
//   node meals/scripts/api-test.mjs
import assert from 'assert/strict';
import { onRequest, week, avoidHits, ask, json, cleanPlan, ANTHROPIC_URL } from '../../functions/meals/api/[[route]].js';
import { issue, putJSON } from '../../server/auth.js';

function fakeKV() {
  const m = new Map(); let writes = 0;
  return { m, writes: () => writes, get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { writes++; m.set(k, String(v)); }, delete: async k => { m.delete(k); } };
}
const db = fakeKV();
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

// ---- a stand-in AI: answers with whatever the test queues, and keeps what it was asked ----
const asked = [];
let answers = [];
const ai = async (url, init) => {
  const b = JSON.parse(init.body); asked.push({ url, headers: init.headers, body: b });
  const text = answers.length ? answers.shift() : '{}';
  if (text instanceof Response) return text;
  return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }));
};
const A = { ANTHROPIC_API_KEY: 'ak' };
const call = async (path, { body, token, header = true, env = { ACCOUNTS: db, ...A } } = {}) => {
  const h = {}; if (header) h['X-Meals'] = '1'; if (token) h.Authorization = 'Bearer ' + token;
  const request = new Request('https://site.example/meals/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await onRequest({ request, params: { route: path.split('/') }, env }, ai);
  return { status: res.status, body: await res.json() };
};
const meal = (title, extra = {}) => ({ title, cuisine: 'Mexican', method: 'grilled', minutes: 30, why: 'Quick', uses: [], ingredients: [{ item: 'chicken thighs', qty: '2 lb' }, { item: 'olive oil', qty: '1 tbsp', pantry: true }], steps: ['Cook it.'], ...extra });
const planJSON = (meals, tip = 'Buy the family pack.') => JSON.stringify({ meals, tip });
const four = (extra = {}) => ['Chicken tacos', 'Chicken tikka masala', 'Lemon chicken orzo soup', 'Teriyaki chicken bowls'].map(t => meal(t, extra));

await test('refuses requests without the app header', async () => {
  assert.equal((await call('state', { header: false })).status, 404);
});
await test('accounts off: says so', async () => {
  assert.equal((await call('state', { env: A })).body.error, 'accounts-off');
});
await db.put('owner', 'u1');
await putJSON(db, 'user:u1', { id: 'u1', name: 'Sam', role: 'owner', creds: [] });
const token = await issue(db, 'u1');
await test('needs a signed-in family member', async () => {
  const r = await call('state'); assert.equal(r.status, 401); assert.equal(r.body.error, 'signin');
});
await test('state: the store, Prime and allergies start as the family set them; which AI is set up', async () => {
  const r = await call('state', { token });
  assert.equal(r.status, 200);
  assert.equal(r.body.ai, 'anthropic'); assert.equal(r.body.model, 'claude-haiku-5-5');
  assert.equal((await call('state', { token, env: { ACCOUNTS: db, ...A, MEALS_MODEL: 'claude-sonnet-5-5' } })).body.model, 'claude-sonnet-5-5');
  assert.match(r.body.settings.store, /Waverly Place, Cary/);
  assert.equal(r.body.settings.prime, true);
  assert.deepEqual(r.body.settings.avoid, ['tree nuts', 'coconut']);
  assert.equal((await call('state', { token, env: { ACCOUNTS: db } })).body.ai, null);
});
await test('no key yet: deals and plans say so, without calling anything', async () => {
  asked.length = 0;
  assert.equal((await call('deals', { token, body: {}, env: { ACCOUNTS: db } })).body.error, 'no-ai');
  assert.equal((await call('plan', { token, body: { meat: 'chicken' }, env: { ACCOUNTS: db } })).body.error, 'no-ai');
  assert.equal(asked.length, 0);
});
await test('the sales week starts on Wednesday, in Cary\'s time', async () => {
  assert.equal(week(Date.UTC(2026, 9, 7, 12)), '2026-10-07');        // Wed
  assert.equal(week(Date.UTC(2026, 9, 13, 23)), '2026-10-07');       // Tue evening
  assert.equal(week(Date.UTC(2026, 9, 14, 3)), '2026-10-07');        // Tue 11pm in Cary, Wed in UTC
  assert.equal(week(Date.UTC(2026, 9, 14, 5)), '2026-10-14');        // Wed 1am in Cary
});
await test('the allergy check: tree nuts and coconut in any form, but not peanuts, nutmeg or butternut squash', async () => {
  const avoid = ['tree nuts', 'coconut'];
  assert.deepEqual(avoidHits(['1 cup slivered almonds'], avoid), ['almonds']);
  assert.deepEqual(avoidHits(['Stir in the coconut milk'], avoid), ['coconut']);
  assert.deepEqual(avoidHits(['basil pesto'], avoid), ['pesto']);
  assert.deepEqual(avoidHits(['Toasted pine nuts'], avoid).sort(), ['nuts', 'pine nuts']);
  assert.deepEqual(avoidHits(['2 tbsp peanut butter', 'pinch of nutmeg', 'butternut squash', 'crushed peanuts', 'doughnut'], avoid), []);
  assert.deepEqual(avoidHits(['shrimp'], ['shrimp']), ['shrimp']);
});
await test('deals by search: Anthropic\'s API with its web search near Cary, Claude Haiku 5.5, for the family\'s store, Prime prices', async () => {
  asked.length = 0;
  answers = ['Here you go: ' + JSON.stringify({ validFrom: '2026-10-07', validTo: '2026-10-13', items: [{ name: 'Boneless chicken thighs', price: '$3.99/lb', regular: '$5.99/lb', prime: true }, { name: '' }, { name: 'Organic strawberries', price: '$3.99' }], sources: ['https://example.com/sales', 'javascript:alert(1)'] })];
  const r = await call('deals', { token, body: {} });
  assert.equal(r.status, 200);
  assert.equal(asked.length, 1);
  const q = asked[0];
  assert.equal(q.url, ANTHROPIC_URL); assert.equal(q.headers['x-api-key'], 'ak'); assert.equal(q.headers['anthropic-version'], '2023-06-01');
  assert.equal(q.body.model, 'claude-haiku-5-5');
  assert.equal(q.body.tools[0].type, 'web_search_20250305'); assert.equal(q.body.tools[0].max_uses, 3); assert.equal(q.body.tools[0].user_location.city, 'Cary');
  assert.match(q.body.messages[0].content, /Waverly Place, Cary/); assert.match(q.body.system, /Prime/);
  assert.equal(r.body.deals.items.length, 2);
  assert.deepEqual(r.body.deals.sources, ['https://example.com/sales']);
  assert.equal(r.body.deals.how, 'search');
});
await test('this week\'s search is kept: asking again costs nothing; refresh waits 10 minutes', async () => {
  asked.length = 0;
  assert.equal((await call('deals', { token, body: {} })).body.deals.items.length, 2);
  assert.equal((await call('deals', { token, body: { refresh: true } })).body.deals.items.length, 2);
  assert.equal(asked.length, 0);
});
await test('deals by paste: read out of the text, no search', async () => {
  asked.length = 0;
  answers = [JSON.stringify({ items: [{ name: 'Wild sockeye salmon', price: '$9.99/lb' }] })];
  const r = await call('deals', { token, body: { text: 'Sockeye salmon fillets $9.99/lb Prime' } });
  assert.equal(r.body.deals.how, 'paste'); assert.equal(r.body.deals.items[0].name, 'Wild sockeye salmon');
  assert.equal(asked[0].body.tools, undefined); assert.match(asked[0].body.messages[0].content, /Sockeye salmon fillets/);
});
await test('a search that finds nothing keeps the last list', async () => {
  answers = [JSON.stringify({ items: [] })];
  await call('deals', { token, body: { refresh: true, text: 'nothing useful' } });
  assert.equal(JSON.parse(db.m.get('meals:deals')).items[0].name, 'Wild sockeye salmon');
});
await test('a plan: 4 different dinners for 4, variety asked for, this week\'s deals passed on, saved for the family', async () => {
  asked.length = 0;
  answers = ['```json\n' + planJSON(four()) + '\n```'];
  const r = await call('plan', { token, body: { meat: 'chicken', useDeals: true } });
  assert.equal(r.status, 200);
  const p = r.body.plan;
  assert.equal(p.meals.length, 4); assert.equal(p.people, 4); assert.equal(p.days, 4); assert.equal(p.by, 'Sam');
  const q = asked[0].body;
  assert.match(q.messages[0].content, /4 different dinners for 4 people/); assert.match(q.messages[0].content, /different cuisine/);
  assert.match(q.messages[0].content, /Wild sockeye salmon \$9\.99\/lb/);
  assert.match(q.system, /never eat: tree nuts, coconut/);
  assert.equal(q.tools, undefined);
  assert.equal(JSON.parse(db.m.get('meals:plan')).meals[0].title, 'Chicken tacos');
  assert.equal(JSON.parse(db.m.get('meals:history')).length, 4);
});
await test('the next plan is told what the family just had', async () => {
  asked.length = 0;
  answers = [planJSON(four())];
  await call('plan', { token, body: { meat: 'chicken' } });
  assert.match(asked[0].body.messages[0].content, /recently; make different dishes: Chicken tacos; Chicken tikka masala/);
  assert.doesNotMatch(asked[0].body.messages[0].content, /sockeye/);   // useDeals off
});
await test('a plan with coconut milk goes back once with what was wrong, and the fixed one is saved', async () => {
  asked.length = 0;
  const bad = four(); bad[1] = meal('Thai green curry', { ingredients: [{ item: 'coconut milk', qty: '1 can' }] });
  answers = [planJSON(bad), planJSON(four())];
  const r = await call('plan', { token, body: { meat: 'chicken' } });
  assert.equal(r.status, 200); assert.equal(asked.length, 2);
  assert.match(asked[1].body.messages[0].content, /used coconut, which this family must never eat/);
  assert.ok(!r.body.plan.meals.some(m => /curry/i.test(m.title)));
});
await test('a plan that slips twice is never saved', async () => {
  const before = db.m.get('meals:plan');
  const bad = four({ steps: ['Top with toasted almonds.'] });
  answers = [planJSON(bad), planJSON(bad)];
  const r = await call('plan', { token, body: { meat: 'beef' } });
  assert.equal(r.status, 422); assert.equal(r.body.error, 'avoid');
  assert.equal(db.m.get('meals:plan'), before);
});
await test('settings: the family can change the store, Prime and what they avoid', async () => {
  const r = await call('settings', { token, body: { store: 'Whole Foods Market, West Cary', prime: false, avoid: ['Tree nuts', 'coconut', 'shellfish', ''] } });
  assert.deepEqual(r.body.settings, { store: 'Whole Foods Market, West Cary', prime: false, avoid: ['tree nuts', 'coconut', 'shellfish'] });
  assert.deepEqual((await call('state', { token })).body.settings.avoid, ['tree nuts', 'coconut', 'shellfish']);
});
await test('a model that answers in words, or an AI service that refuses the key, gives a plain error', async () => {
  answers = ['Sorry, I can\'t help with that.'];
  assert.equal((await call('plan', { token, body: { meat: 'pork' } })).body.error, 'ai-format');
  answers = [new Response('{}', { status: 401 })];
  assert.equal((await call('plan', { token, body: { meat: 'pork' } })).body.error, 'ai-key');
});
await test('Anthropic\'s API: the key and version headers, web search near Cary, and a paused search carried on', async () => {
  asked.length = 0;
  const replies = [
    new Response(JSON.stringify({ content: [{ type: 'server_tool_use', id: 's1', name: 'web_search', input: {} }], stop_reason: 'pause_turn' })),
    new Response(JSON.stringify({ content: [{ type: 'text', text: '{"items":[{"name":"Ground beef","price":"$4.99/lb"}]}' }], stop_reason: 'end_turn' })),
  ];
  const f = async (url, init) => { asked.push({ url, headers: init.headers, body: JSON.parse(init.body) }); return replies.shift(); };
  const text = await ask(A, { system: 's', prompt: 'p', search: true }, f);
  assert.equal(json(text).items[0].name, 'Ground beef');
  assert.equal(asked.length, 2); assert.equal(asked[0].url, ANTHROPIC_URL);
  assert.equal(asked[0].headers['x-api-key'], 'ak'); assert.equal(asked[0].headers['anthropic-version'], '2023-06-01');
  assert.equal(asked[0].body.model, 'claude-haiku-5-5');
  assert.equal(asked[0].body.tools[0].max_uses, 3);
  assert.equal(asked[0].body.tools[0].type, 'web_search_20250305'); assert.equal(asked[0].body.tools[0].user_location.city, 'Cary');
  assert.equal(asked[1].body.messages[1].role, 'assistant');
});
await test('plans are trimmed to what Meals shows', async () => {
  const p = cleanPlan({ meals: [{ title: 'x'.repeat(500), ingredients: [{ item: 'egg' }], steps: ['a'], minutes: 99999 }, { title: 'No steps', ingredients: [{ item: 'egg' }] }] }, 4);
  assert.equal(p.meals.length, 1); assert.equal(p.meals[0].title.length, 90); assert.equal(p.meals[0].minutes, 0);
});
console.log(`\n${n} passed`);
