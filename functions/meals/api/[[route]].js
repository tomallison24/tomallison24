// /meals/api/* - the family's Meals: this week's deals at the stores they shop
// at, and dinner plans built around a meat, made by an AI model. One plan and
// one deals list a store for the whole family (so everyone sees what's for
// dinner), locked to signed-in family by _middleware.js.
//
//   GET  state      -> { ai, model, week, stores, settings, deals: { <store id>: deals }, plan }
//                      ai: 'anthropic', or null with no key yet; stores: STORES
//   POST deals      { store, text? } -> { deals }
//                      without text: the model searches the web for this week's
//                      sales at that store; with text (copied from the store's
//                      sales page or app): the model reads the deals out of it.
//                      This week's are kept, so a second ask is free unless
//                      { refresh: true } (at most every 10 minutes).
//   POST plan       { meat, days, people, useDeals, shop, note } -> { plan }
//                      shop: a store id, or 'all' for the best deals across the
//                      family's stores (each sale item says where it is)
//   POST settings   { stores, cards, avoid } -> { settings }
//
// The model: Claude Haiku 5.5 (the cheapest Claude, and plenty for this: the
// allergy check below doesn't rely on the model), through Anthropic's API with
// the key the owner adds as a Pages secret, ANTHROPIC_API_KEY (news.yml puts
// it); the deals search is Anthropic's web search tool. MEALS_MODEL names
// another model (claude-sonnet-5-5 for richer recipes). No key: everything
// that needs the model answers { error: 'no-ai' }.
//
// Safety for the family's allergies: every plan is checked here, word by word,
// against what the family avoids (settings.avoid: tree nuts and coconut to
// start), not just asked of the model. A plan that slips is sent back to the
// model once with what it got wrong; if it slips again, no plan is saved.
//
// Stored in the accounts' Workers KV (ACCOUNTS, server/auth.js):
//   meals:settings  { stores, cards, avoid, at }
//   meals:deals:<store id>  { week, at, how, store, validFrom, validTo, items, sources }
//   meals:plan      { at, by, week, meat, days, people, useDeals, shop, meals, tip }
//   meals:history   [{ title, cuisine, at }] the last 40 dinners, so new plans differ
// Writes happen only when a deals list or a plan is made, or settings change.
//
// The X-Meals header stops other web pages calling this (as X-Drinks does).

import { reply, kv, getJSON, putJSON, sessionUser } from '../../../server/auth.js';

export const MODEL = 'claude-haiku-5-5';
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 120e3;
const MAX_BODY = 64 * 1024;
const MAX_TEXT = 30000;
const REFRESH_MS = 10 * 60e3;
// The stores near the family (Apex, 27502) Meals knows: where each is (the
// search asks for that store's chain and area), and the member card whose
// prices it shows when the family has the card (settings.cards).
export const STORES = [
  { id: 'wholefoods', name: 'Whole Foods', where: 'Whole Foods Market, 102 New Waverly Pl, Cary, NC', card: 'prime', cardName: 'Prime' },
  { id: 'harristeeter', name: 'Harris Teeter', where: 'Harris Teeter, 750 W Williams St, Apex, NC', card: 'vic', cardName: 'VIC' },
  { id: 'publix', name: 'Publix', where: 'Publix, 1441 Kelly Rd, Apex, NC' },
  { id: 'lidl', name: 'Lidl', where: 'Lidl, 670 Grand Central Station, Apex, NC' },
  { id: 'lowesfoods', name: 'Lowes Foods', where: 'Lowes Foods, 5400 Apex Peakway, Apex, NC' },
  { id: 'aldi', name: 'Aldi', where: 'Aldi, 1770 W Williams St, Apex, NC' },
  { id: 'walmart', name: 'Walmart', where: 'Walmart Supercenter, 3151 Apex Peakway, Apex, NC' },
  { id: 'target', name: 'Target', where: 'Target, 1201 Beaver Creek Commons Dr, Apex, NC' },
];
export const CARDS = ['prime', 'vic'];
export const DEFAULTS = { stores: STORES.map(x => x.id), cards: ['prime', 'vic'], avoid: ['tree nuts', 'coconut'] };
const storeOf = id => STORES.find(x => x.id === id) || null;
export const MEATS = ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'salmon', 'white fish', 'shrimp', 'on sale'];

const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const int = (v, lo, hi, d) => { const n = Math.round(+v); return isFinite(n) && n >= lo && n <= hi ? n : d; };
const fail = (message, status) => Object.assign(new Error(message), { status });

// ---- the week: sales run Wednesday to Tuesday, in Cary's time ----
export function week(now = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
    .formatToParts(new Date(now)).map(x => [x.type, x.value]));
  const back = (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) + 4) % 7;   // days since Wednesday
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day - back)).toISOString().slice(0, 10);
}

// ---- what the family avoids ----
// A named group is matched by everything in it; anything else by its own word.
// Peanuts aren't tree nuts, so "peanut butter" passes; "nutmeg" and
// "butternut squash" aren't nuts at all.
export const GROUPS = {
  'tree nuts': ['almond', 'almonds', 'cashew', 'cashews', 'pecan', 'pecans', 'walnut', 'walnuts', 'pistachio', 'pistachios', 'hazelnut', 'hazelnuts', 'filbert', 'filberts',
    'macadamia', 'macadamias', 'brazil nut', 'brazil nuts', 'pine nut', 'pine nuts', 'pignoli', 'chestnut', 'chestnuts', 'praline', 'pralines', 'marzipan', 'frangipane',
    'nougat', 'gianduja', 'nutella', 'pesto', 'amaretto', 'amaretti', 'nut', 'nuts', 'mixed nuts', 'nut butter', 'nut milk', 'nut oil', 'romesco', 'dukkah', 'baklava'],
  'coconut': ['coconut', 'coconuts', 'copra'],
};
const words = s => ' ' + String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
export function avoidHits(texts, avoid) {
  const hay = words(texts.join(' | ')).replace(/ (peanut|pea) (nut|nuts|butter) /g, ' peanut ');
  const hits = new Set();
  for (const a of avoid) {
    const key = str(a, 40).toLowerCase(); if (!key) continue;
    const terms = GROUPS[key] || [key, key.endsWith('s') ? key.slice(0, -1) : key + 's'];
    for (const t of terms) if (hay.includes(words(t))) hits.add(t);
  }
  return [...hits];
}
const planText = meals => meals.flatMap(m => [m.title, m.why, ...m.ingredients.map(i => i.item + ' ' + i.qty), ...m.steps]);

// ---- the model ----
export const modelOf = env => str(env && env.MEALS_MODEL, 60) || MODEL;
export const aiOf = env => env && env.ANTHROPIC_API_KEY ? 'anthropic' : null;

export async function ask(env, { system, prompt, search = false, maxTokens = 4000 }, f = fetch) {
  const ai = aiOf(env), model = modelOf(env);
  if (!ai) throw fail('no-ai', 503);
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const post = async (url, headers, body) => {
    let r;
    try { r = await f(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ac.signal }); }
    catch { throw fail('ai-unreachable', 502); }
    if (!r.ok) throw fail(r.status === 401 || r.status === 403 ? 'ai-key' : r.status === 429 ? 'ai-busy' : 'ai-' + r.status, 502);
    return r.json();
  };
  try {
    // A long search turn can pause; send it back as it is to carry on.
    const messages = [{ role: 'user', content: prompt }];
    // 5 searches keep the prompt (search results count as input) well under 100,000
    // tokens, past which Haiku 5.5 costs five times as much.
    const tools = search ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5,
      user_location: { type: 'approximate', city: 'Cary', region: 'North Carolina', country: 'US', timezone: 'America/New_York' } }] : undefined;
    let text = '';
    for (let turn = 0; turn < 4; turn++) {
      const j = await post(ANTHROPIC_URL, { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, { model, max_tokens: maxTokens, system, messages, ...(tools ? { tools } : {}) });
      text += (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
      if (j.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: j.content });
    }
    return text;
  } finally { clearTimeout(timer); }
}

// The JSON object in a reply (models sometimes wrap it in words or a code fence).
export function json(text) {
  const s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw fail('ai-format', 502);
  try { return JSON.parse(s.slice(a, b + 1)); } catch { throw fail('ai-format', 502); }
}

// ---- deals ----
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function cleanDeals(j) {
  const items = (Array.isArray(j && j.items) ? j.items : []).slice(0, 120).map(x => x && {
    name: str(x.name, 80), price: str(x.price, 30), regular: str(x.regular, 30), member: !!(x.member || x.prime), note: str(x.note, 80),
  }).filter(x => x && x.name);
  const sources = (Array.isArray(j && j.sources) ? j.sources : []).map(u => str(u, 300)).filter(u => /^https:\/\//.test(u)).slice(0, 6);
  return { validFrom: ISO.test(j && j.validFrom) ? j.validFrom : '', validTo: ISO.test(j && j.validTo) ? j.validTo : '', items, sources };
}
const DEALS_SHAPE = '{"validFrom":"YYYY-MM-DD","validTo":"YYYY-MM-DD","items":[{"name":"Organic boneless skinless chicken thighs","price":"$3.99/lb","regular":"$5.99/lb","member":true,"note":"Buy one get one"}],"sources":["https://..."]}';
// store: an entry of STORES; member: whether the family has its card
export function dealsAsk(store, wk, text, member) {
  const card = store.cardName && member ? store.cardName : '';
  const system = 'You read grocery store sales for a family. Answer with one JSON object only, no other words, shaped like: ' + DEALS_SHAPE
    + '. "price" is the sale price' + (card ? ' with a ' + card + ' card (use the ' + card + ' price when one is shown)' : ' everyone pays (not member-card-only prices)')
    + ', "regular" the usual price if shown, "member" true when the price needs the ' + (store.cardName || 'store\'s member') + ' card. Put deal terms (buy one get one, limits, which days) in "note". Food only: leave out alcohol, flowers, household and beauty items. List this week\'s sale items; leave out standing offers that run for months. Never make up a deal: if you can\'t find this week\'s sales, return "items": [].';
  const prompt = text
    ? 'These are this week\'s sales at ' + store.where + ', copied from the store\'s sales page or app. List every food deal in them.\n\n' + text
    : 'Find this week\'s sales at ' + store.where + ' (the week starting Wednesday ' + wk + '). Stores\' own weekly-ad pages usually load their items in a way search can\'t read, so look for pages that write this week\'s ad out item by item with prices: deal and coupon blogs that break the weekly ad down, weekly-ad preview and match-up pages, and local news "this week\'s deals" posts. Check they are for this week and this chain (prices are usually the same across a chain\'s stores in the area). List every food deal you find, with the dates they run. Put the pages you used in "sources".';
  return { system, prompt, search: !text, maxTokens: 6000 };
}

// ---- plans ----
export function cleanPlan(j, days) {
  const meals = (Array.isArray(j && j.meals) ? j.meals : []).slice(0, days).map((m, i) => m && {
    day: i + 1, title: str(m.title, 90), cuisine: str(m.cuisine, 30), method: str(m.method, 30), minutes: int(m.minutes, 5, 600, 0), why: str(m.why, 200),
    uses: (Array.isArray(m.uses) ? m.uses : []).map(u => str(u, 80)).filter(Boolean).slice(0, 8),
    ingredients: (Array.isArray(m.ingredients) ? m.ingredients : []).slice(0, 30).map(x => x && { item: str(x.item, 60), qty: str(x.qty, 30), pantry: !!x.pantry }).filter(x => x && x.item),
    steps: (Array.isArray(m.steps) ? m.steps : []).map(s => str(s, 400)).filter(Boolean).slice(0, 12),
  }).filter(m => m && m.title && m.ingredients.length && m.steps.length);
  return { meals, tip: str(j && j.tip, 300) };
}
const PLAN_SHAPE = '{"meals":[{"title":"Honey-garlic chicken thighs with roasted broccoli","cuisine":"American","method":"sheet pan","minutes":40,"why":"one short line on why it suits tonight","uses":["exact names of the sale items it uses"],"ingredients":[{"item":"boneless chicken thighs","qty":"2 lb","pantry":false},{"item":"olive oil","qty":"2 tbsp","pantry":true}],"steps":["..."]}],"tip":"one money-saving or prep-ahead tip for the week"}';
function planAsk(settings, o, deals, history) {
  const avoid = settings.avoid.length ? settings.avoid.join(', ') : '';
  const system = 'You plan family dinners. Answer with one JSON object only, no other words, shaped like: ' + PLAN_SHAPE + '. '
    + 'Write US English with US measures. Quantities are for the whole family, enough for everyone with no leftovers needed. Mark staples most kitchens have (oil, salt, pepper, dried spices, flour, sugar) "pantry": true. '
    + 'Steps are short and in order; each meal is doable on a weeknight unless its time says otherwise. '
    + (avoid ? 'ALLERGIES - the family must never eat: ' + avoid + '. Use none of them in any form (oils, milks, flours, butters, sauces, garnishes, pesto, curry pastes), and don\'t mention them at all, not even to say a dish is free of them. ' : '');
  const lines = [
    'Plan ' + o.days + ' different dinners for ' + o.people + ' people, one a night, each built around ' + (o.meat === 'on sale' ? 'whichever meat or fish is on sale this week' : o.meat) + '.',
    'Variety matters most: every night a different cuisine and a different way of cooking (for example grilled, braised, stir-fried, roasted, slow cooker, tacos, soup, pasta, salad bowl), so no two feel alike.',
    'Where it saves money, buy the ' + (o.meat === 'on sale' ? 'meat' : o.meat) + ' once in bulk for the week and use it across the nights.',
  ];
  // deals: [{ store, items }] - one store, or every store the family shops at
  const sales = (deals || []).filter(d => d.items.length);
  if (o.useDeals && sales.length) lines.push((sales.length > 1
    ? 'This week\'s sales at the family\'s stores. Use the best of them to save money, and list the ones each dinner uses in "uses" with the store in brackets, like "Ground chuck (Publix)":'
    : 'This week\'s sales at ' + sales[0].store.name + ' (use them to save money, and list the ones each dinner uses in "uses"):')
    + sales.map(d => (sales.length > 1 ? '\n' + d.store.name + ':' : '') + '\n' + d.items.map(x => '- ' + x.name + (x.price ? ' ' + x.price : '') + (x.regular ? ' (usually ' + x.regular + ')' : '') + (x.note ? ' [' + x.note + ']' : '')).join('\n')).join(''));
  if (history.length) lines.push('The family had these recently; make different dishes: ' + history.map(h => h.title).join('; ') + '.');
  if (o.note) lines.push('Also: ' + o.note);
  return { system, prompt: lines.join('\n\n'), search: false, maxTokens: 1500 * o.days + 1000 };
}

export async function makePlan(env, settings, o, deals, history, f = fetch) {
  const q = planAsk(settings, o, deals, history);
  let plan = cleanPlan(json(await ask(env, q, f)), o.days), hits = avoidHits(planText(plan.meals), settings.avoid);
  if (plan.meals.length < o.days || hits.length) {
    // Once more, saying what was wrong.
    const why = (hits.length ? 'Your last plan used ' + hits.join(', ') + ', which this family must never eat. ' : '') + (plan.meals.length < o.days ? 'It also needs all ' + o.days + ' dinners. ' : '');
    plan = cleanPlan(json(await ask(env, { ...q, prompt: q.prompt + '\n\n' + why + 'Make the whole plan again.' }, f)), o.days);
    hits = avoidHits(planText(plan.meals), settings.avoid);
  }
  if (hits.length) throw fail('avoid', 422);
  if (plan.meals.length < o.days) throw fail('ai-format', 502);
  return plan;
}

// ---- the route ----
async function body(request) {
  const t = await request.text();
  if (t.length > MAX_BODY) throw fail('too-big', 413);
  try { return JSON.parse(t || '{}'); } catch { throw fail('bad-json', 400); }
}
// (Settings from before the stores, { store, prime }, start with every store and both cards.)
const settingsOf = s => ({
  stores: Array.isArray(s && s.stores) ? STORES.map(x => x.id).filter(id => s.stores.includes(id)) : DEFAULTS.stores,
  cards: Array.isArray(s && s.cards) ? CARDS.filter(c => s.cards.includes(c)) : DEFAULTS.cards,
  avoid: Array.isArray(s && s.avoid) ? [...new Set(s.avoid.map(a => str(a, 40).toLowerCase()).filter(Boolean))].slice(0, 12) : DEFAULTS.avoid });
const dealsKey = id => 'meals:deals:' + id;
// this week's deals at each of the family's stores that has some
async function weekDeals(db, settings, wk, ids) {
  const out = [];
  for (const id of ids) { const d = await getJSON(db, dealsKey(id)); if (d && d.week === wk && d.items.length) out.push({ store: storeOf(id), items: d.items }); }
  return out;
}

export async function onRequest({ request, params, env }, f = fetch) {
  if (request.headers.get('X-Meals') !== '1') return reply({ error: 'not-found' }, 404);
  const route = [].concat(params.route || []).join('/');
  const method = request.method.toUpperCase();
  const db = kv(env);
  if (!db || !(await db.get('owner'))) return reply({ error: 'accounts-off' }, 503);
  const me = await sessionUser(db, request);
  if (!me) return reply({ error: 'signin' }, 401);
  try {
    const settings = settingsOf(await getJSON(db, 'meals:settings')), wk = week();
    if (route === 'state' && method === 'GET') {
      const deals = {};
      for (const id of settings.stores) { const d = await getJSON(db, dealsKey(id)); if (d) deals[id] = d; }
      const plan = await getJSON(db, 'meals:plan');
      return reply({ ai: aiOf(env), model: aiOf(env) ? modelOf(env) : null, week: wk, stores: STORES, settings, deals, plan });
    }
    if (route === 'settings' && method === 'POST') {
      const s = settingsOf(await body(request));
      await putJSON(db, 'meals:settings', { ...s, at: Date.now() });
      return reply({ settings: s });
    }
    if (route === 'deals' && method === 'POST') {
      const b = await body(request), text = str(b.text, MAX_TEXT), store = storeOf(b.store);
      if (!store) return reply({ error: 'store' }, 400);
      const old = await getJSON(db, dealsKey(store.id));
      // This week's search already done: hand it back (searches cost money).
      if (!text && old && old.week === wk && old.items.length && (!b.refresh || Date.now() - old.at < REFRESH_MS)) return reply({ deals: old });
      if (!aiOf(env)) return reply({ error: 'no-ai' }, 503);
      const d = cleanDeals(json(await ask(env, dealsAsk(store, wk, text, settings.cards.includes(store.card)), f)));
      const deals = { week: wk, at: Date.now(), how: text ? 'paste' : 'search', store: store.id, ...d };
      if (d.items.length) await putJSON(db, dealsKey(store.id), deals);
      return reply({ deals });
    }
    if (route === 'plan' && method === 'POST') {
      if (!aiOf(env)) return reply({ error: 'no-ai' }, 503);
      const b = await body(request);
      const shop = b.shop === 'all' || storeOf(b.shop) ? b.shop : 'all';
      const o = { meat: MEATS.includes(b.meat) ? b.meat : 'chicken', days: int(b.days, 1, 7, 4), people: int(b.people, 1, 10, 4), useDeals: !!b.useDeals, shop, note: str(b.note, 200) };
      const deals = o.useDeals ? await weekDeals(db, settings, wk, shop === 'all' ? settings.stores : [shop]) : [], history = (await getJSON(db, 'meals:history')) || [];
      const p = await makePlan(env, settings, o, deals, history.slice(-20), f);
      const plan = { at: Date.now(), by: me.name, week: wk, ...o, ...p };
      await putJSON(db, 'meals:plan', plan);
      await putJSON(db, 'meals:history', [...history, ...p.meals.map(m => ({ title: m.title, cuisine: m.cuisine, at: plan.at }))].slice(-40));
      return reply({ plan });
    }
    return reply({ error: 'not-found' }, 404);
  } catch (e) {
    return reply({ error: e.status ? e.message : 'server' }, e.status || 500);
  }
}
