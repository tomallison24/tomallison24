// /meals/api/* - the family's Meals: this week's deals at the stores they shop
// at, and dinner plans built around a meat, made by an AI model. One plan and
// one deals list a store for the whole family (so everyone sees what's for
// dinner), locked to signed-in family by _middleware.js.
//
//   GET  state      -> { ai, model, week, stores, settings, deals: { <store id>: deals }, draft, plan, log }
//                      ai: 'anthropic', or null with no key yet; stores: STORES;
//                      log: the accepted plans, newest first, in short (id, dates, titles)
//   GET  log/<id>   -> { plan } one accepted plan, whole
//   POST deals      { store, text? } -> { deals }
//                      without text: the model searches the web for this week's
//                      sales at that store; with text (copied from the store's
//                      sales page or app): the model reads the deals out of it.
//                      This week's are kept, so a second ask is free unless
//                      { refresh: true } (at most every 10 minutes).
//   POST plan       { meat, days, people, useDeals, shop, note, again } -> { draft }
//                      a new plan to look over: kept as the family's draft until
//                      someone accepts it. shop: a store id, or 'all' for the
//                      best deals across the family's stores (each sale item
//                      says where it is). again: true for another go, unlike
//                      the draft before it.
//   POST accept     { start: 'YYYY-MM-DD' } -> { plan, log }
//                      the draft becomes the family's plan, night 1 on start:
//                      saved with its dates and the sale prices it was planned
//                      with (so its shopping list stays as it was), and added
//                      to the log, as Fitness keeps each workout
//   POST discard    { at? } -> {} the draft goes (with at: only if it is still that draft)
//   POST settings   { stores, cards, avoid } -> { settings }   (avoid: the owner only; { error: 'owner-only' } for anyone else)
//
// For Ipsy, the helper you chat with (its changes, and their Undo, go through these and the
// ones above, so the allergy check and every other rule here applies to them too):
//   POST night      { draft?, day, meal, id?, at? } -> { plan, log } or { draft }
//                      one night's dinner on the family's plan (or, with draft: true, on the
//                      new plan waiting): the whole dinner, cleaned as a plan's are and
//                      checked against what the family avoids ({ error: 'avoid', hits } if it
//                      slips; nothing is saved). id (the plan's) or at (the draft's): only if
//                      it is still that one ({ error: 'changed' } if someone changed it since).
//   POST draft      { draft, over? } -> { draft }
//                      puts a draft back as it was (Undo of a new plan, or of Discard),
//                      checked like a plan; over: the at of the draft it may replace (none:
//                      only when no draft is waiting).
//   POST unaccept   { id } -> { plan, log, draft }
//                      Undo of Accept: the plan id goes back to being the draft waiting, out
//                      of the log and the history, and the plan before it is the family's again.
//   POST ipsy       { messages } -> Anthropic's answer, as it comes (one step of Ipsy's chat,
//                      server/ipsy.js): adds Ipsy's instructions and tools (IPSY_SYSTEM,
//                      IPSY_CLIENT_TOOLS) and asks Claude Sonnet 5.5 (MEALS_IPSY_MODEL names
//                      another); the phone runs the tools, on the family's Meals through the
//                      routes above. Nothing about the conversation is kept: only a count of
//                      questions (meals:ipsy:<user id>:<day>, IPSY_DAILY a person a day).
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
//   meals:draft     { at, by, week, meat, days, people, useDeals, shop, note, meals, tip, sales }
//   meals:plan      the accepted plan: the draft, with id, start, dates, acceptedAt, acceptedBy
//   meals:log       [{ id, start, end, meat, shop, people, titles }] accepted plans, newest
//                   first, the last 52; meals:log:<id> each one whole
//   meals:history   [{ title, cuisine, at }] the last 40 dinners, so new plans differ
// Writes happen only when a deals list or a plan is made or changed, or settings change.
//
// The X-Meals header stops other web pages calling this (as X-Drinks does).

import { reply, kv, getJSON, putJSON, sessionUser } from '../../../server/auth.js';
import { IPSY_MODEL, IPSY_DAILY, T, DAY, persona, modelOf as ipsyModelFor, requestHead, ipsyStep } from '../../../server/ipsy.js';

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
// Plans and pasted deals cost money (a Claude call each): at most AI_DAILY a person a day, counted in
// the accounts' KV as meals:ai:<user id>:<day> (gone after two days), written before the call.
export const AI_DAILY = 20;
async function countAi(db, me) {
  const key = 'meals:ai:' + me.id + ':' + today(), n = (+(await db.get(key)) || 0) + 1;
  if (n > AI_DAILY) return false;
  await db.put(key, String(n), { expirationTtl: 2 * 86400 });
  return true;
}

// ---- the week: sales run Wednesday to Tuesday, in Cary's time ----
export function week(now = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
    .formatToParts(new Date(now)).map(x => [x.type, x.value]));
  const back = (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) + 4) % 7;   // days since Wednesday
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day - back)).toISOString().slice(0, 10);
}

// dates in Cary's time, as YYYY-MM-DD
export const today = (now = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(now));
export const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

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

// ---- Ipsy: the helper you chat with (server/ipsy.js, shared by every app with Ipsy) ----
// The phone keeps the conversation and runs Meals' tools (meals/ipsy-tools.js), on the family's
// plan, draft and deals through this route's own endpoints; Anthropic runs web search and web
// fetch. MEALS_IPSY_MODEL names another model than Claude Sonnet 5.5.
export { IPSY_MODEL, IPSY_DAILY };
export const ipsyModelOf = env => ipsyModelFor(env, 'MEALS_IPSY_MODEL');
const WHICH = { type: 'string', enum: ['current', 'draft'], description: 'current: the family\'s accepted plan; draft: the new plan waiting to be accepted' };
const NIGHT = { type: 'integer', description: 'The night\'s number in the plan, from 1' };
const DINNER = { type: 'object', additionalProperties: false, required: ['title', 'ingredients', 'steps'], properties: {
  title: { type: 'string', description: 'The dish, like "Honey-garlic chicken thighs with roasted broccoli"' },
  cuisine: { type: 'string' }, method: { type: 'string', description: 'The way it is cooked: grilled, braised, stir-fried, sheet pan, slow cooker, soup...' },
  minutes: { type: 'integer', description: 'Total time' }, why: { type: 'string', description: 'One short line on why it suits the night' },
  uses: { type: 'array', items: { type: 'string' }, description: 'Exact names of this week\'s sale items it uses (get_deals); for a plan across stores, the store in brackets, like "Ground chuck (Publix)"' },
  ingredients: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['item'], properties: {
    item: { type: 'string' }, qty: { type: 'string', description: 'For the whole family, in US measures, like "2 lb"' }, pantry: { type: 'boolean', description: 'A staple most kitchens have (oil, salt, pepper, dried spices, flour, sugar)' } } } },
  steps: { type: 'array', items: { type: 'string' }, description: 'Short steps, in order' },
} };
export const IPSY_CLIENT_TOOLS = [
  T('get_meals', 'An overview of the family\'s Meals: this week\'s plan (each night\'s date and dinner), the new plan waiting to be accepted if there is one, what the family never eats (avoid), their stores and member cards, which stores have this week\'s deals, and how many past plans there are.', {}),
  T('get_dinners', 'Whole recipes (ingredients, amounts, steps, the sale items each uses) from the current plan, the new plan waiting, or a past plan.', {
    plan: { type: 'string', description: 'current, draft, or a past plan\'s id (get_past_plans)' },
    nights: { type: 'array', items: { type: 'integer' }, description: 'Which nights, from 1 (default: all)' },
  }, ['plan']),
  T('get_deals', 'This week\'s sales at the family\'s stores (sales run Wednesday to Tuesday): each item\'s name, sale price, usual price, whether it needs the store\'s member card, and terms.', {
    store: { type: 'string', enum: ['all', ...STORES.map(x => x.id)], description: 'One store, or all of the family\'s (default)' },
    query: { type: 'string', description: 'Words to match in the item names, like "chicken"' },
  }),
  T('get_past_plans', 'The plans the family accepted before, newest first: each one\'s id, dates, meat, store and dinners.', {
    limit: { type: 'integer', description: 'Most to return (default 12, at most 52)' },
  }),
  T('get_shopping_list', 'The shopping list for the current plan, as the List tab shows it: by grocery section, each item\'s amount, which nights need it, its sale price, and whether it is ticked on this phone; staples apart.', {}),
  T('tick_items', 'Tick items off the shopping list (or untick them), on this phone only.', {
    items: { type: 'array', items: { type: 'string' }, description: 'Item names as get_shopping_list gives them' },
    ticked: { type: 'boolean', description: 'true to tick (default), false to untick' },
  }, ['items']),
  T('set_dinner', 'Change one night\'s dinner on the current plan or the new plan waiting: give the whole dinner. The server checks it against what the family never eats before saving; if it slips, nothing changes and the answer says what it found. Everyone in the family sees the change.', {
    plan: WHICH, night: NIGHT, dinner: DINNER,
  }, ['plan', 'night', 'dinner']),
  T('make_plan', 'Make a new plan the way the app\'s + button does: the meal planner writes a few nights of different dinners, checked against what the family never eats, and it waits as the new plan (not saved yet) until accepted. Takes about half a minute. If a new plan is already waiting, the person is asked first, as it takes its place.', {
    meat: { type: 'string', enum: MEATS, description: 'What every dinner is built around; "on sale" for whichever meat or fish is on sale' },
    nights: { type: 'integer', description: '2 to 7 (default 4)' }, people: { type: 'integer', description: '1 to 10 (default: as the current plan, else 4)' },
    shop: { type: 'string', enum: ['all', ...STORES.map(x => x.id)], description: 'One store, or all: the best deals across the family\'s stores (default)' },
    use_deals: { type: 'boolean', description: 'Build it around this week\'s deals (default true)' },
    note: { type: 'string', description: 'Anything else, like "kid-friendly" or "no spice" (at most 200 characters)' },
    again: { type: 'boolean', description: 'Make it unlike the new plan already waiting (another go)' },
  }, ['meat']),
  T('accept_plan', 'Accept the new plan waiting, so it becomes the family\'s plan, night 1 on start, with its shopping list. It takes the place of the current plan for everyone, so the person is asked first.', {
    start: { ...DAY, description: 'The first night (YYYY-MM-DD; default today)' },
  }),
  T('discard_draft', 'Discard the new plan waiting (the person is asked first). The current plan stays.', {}),
  T('show_dinner', 'Open one night\'s recipe on the person\'s screen, behind the chat.', { plan: WHICH, night: NIGHT }, ['plan', 'night']),
];
const GROUP_WORDS = Object.entries(GROUPS).map(([k, v]) => '"' + k + '" (' + v.join(', ') + ')').join('; ');
export const IPSY_SYSTEM = persona({
  app: 'Meals',
  about: 'an iPhone app a family uses to plan dinners around this week\'s grocery deals, with each dinner\'s recipe and a shopping list',
  can: [
    'Read the family\'s Meals: get_meals (the plan, the new plan waiting, what they never eat, their stores), get_dinners (whole recipes), get_deals (this week\'s sales), get_past_plans, and get_shopping_list.',
    'Change one night\'s dinner on the plan or on the new plan waiting (set_dinner): you write the whole dinner, and the server checks it before it is saved.',
    'Make a new plan the way the app does (make_plan), accept it so it becomes the family\'s plan (accept_plan), or discard it (discard_draft).',
    'Tick items off the shopping list on this phone (tick_items), and open a recipe on the screen (show_dinner).',
  ],
  rules: [
    'The allergy rules come first. Before you suggest or write any dish, check what the family never eats (the avoid list in get_meals; the note at the start of each message has it too), and never suggest anything with one of them in any form: oils, milks, flours, butters, sauces, garnishes, curry pastes. The app checks each dinner word by word: ' + GROUP_WORDS + '; anything else on the list by its own name. Peanuts aren\'t tree nuts.',
    'Never write those words in a dinner at all, not even to say it is free of them ("nut-free", "no coconut"): the check would turn it away. If set_dinner answers avoid, it names what it found: write the dinner again without it. Packaged foods can hide them, so say to check labels when it matters.',
    'Meals is the family\'s, not one person\'s: the plan, the new plan waiting, the deals and the settings are shared, so everyone in the family sees what you change.',
    'Change one night\'s dinner when asked, without asking first: it shows in the chat with an Undo. A whole week is different: make_plan in place of a new plan already waiting, accept_plan and discard_draft ask the person first with a Yes / No card in the chat. If they say no, leave it.',
    'A dinner you write is a whole recipe for the plan\'s number of people: US measures, amounts for everyone, staples (oil, salt, pepper, dried spices, flour, sugar) marked pantry, short steps in order, doable on a weeknight unless its minutes say otherwise, and a different cuisine and way of cooking from the plan\'s other nights. Put this week\'s sale items it uses in uses, named as get_deals names them.',
    '"What can I make with ...": suggest a few dinners that keep to the allergy rules; put one on the plan only when asked.',
    'You can\'t change the stores, member cards or what the family never eats (that is Settings, the gear, for the person to do), find new deals (the Deals tab: Find this week\'s deals, or Paste deals), or add things to the shopping list (it comes from the plan; Copy the list puts it in Notes). Ticks stay on this phone.',
    'Recipes are made by AI and sale prices come from deal pages: say to check times, temperatures and prices when it matters.',
  ],
  bold: 'a dinner or a store',
});
export const ipsyRequestHead = env => requestHead({ model: ipsyModelOf(env), system: IPSY_SYSTEM, tools: IPSY_CLIENT_TOOLS });

// One dinner, kept as a plan keeps them (cleanPlan), or null; a plan's sale items, kept as deals are.
const oneMeal = m => cleanPlan({ meals: [m] }, 1).meals[0] || null;
const cleanSales = a => (Array.isArray(a) ? a : []).slice(0, 400).map(x => x && storeOf(x.store) ? { ...cleanDeals({ items: [x] }).items[0], store: x.store } : null).filter(x => x && x.name);

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
    if (route === 'ipsy' && method === 'POST') {
      if (!aiOf(env)) return reply({ error: 'no-ai' }, 503);
      return await ipsyStep({ env, request, db, me, app: 'meals', head: ipsyRequestHead(env) }, f);
    }
    const settings = settingsOf(await getJSON(db, 'meals:settings')), wk = week();
    if (route === 'state' && method === 'GET') {
      const deals = {};
      for (const id of settings.stores) { const d = await getJSON(db, dealsKey(id)); if (d) deals[id] = d; }
      const plan = await getJSON(db, 'meals:plan'), draft = await getJSON(db, 'meals:draft'), log = (await getJSON(db, 'meals:log')) || [];
      return reply({ ai: aiOf(env), model: aiOf(env) ? modelOf(env) : null, week: wk, stores: STORES, settings, deals, draft, plan, log });
    }
    if (route === 'settings' && method === 'POST') {
      const b = await body(request), s = settingsOf(b);
      // What the family avoids is a safety rule: only the owner changes it. Everyone else's
      // stores and cards are kept, with the avoid list as it was; an avoid list of their own is refused.
      if (me.role !== 'owner' && 'avoid' in b && JSON.stringify(s.avoid) !== JSON.stringify(settings.avoid)) return reply({ error: 'owner-only' }, 403);
      if (me.role !== 'owner') s.avoid = settings.avoid;
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
      if (!(await countAi(db, me))) return reply({ error: 'limit' }, 429);
      const d = cleanDeals(json(await ask(env, dealsAsk(store, wk, text, settings.cards.includes(store.card)), f)));
      const deals = { week: wk, at: Date.now(), how: text ? 'paste' : 'search', store: store.id, ...d };
      if (d.items.length) await putJSON(db, dealsKey(store.id), deals);
      return reply({ deals });
    }
    if (route === 'plan' && method === 'POST') {
      if (!aiOf(env)) return reply({ error: 'no-ai' }, 503);
      if (!(await countAi(db, me))) return reply({ error: 'limit' }, 429);
      const b = await body(request);
      const shop = b.shop === 'all' || storeOf(b.shop) ? b.shop : 'all';
      const o = { meat: MEATS.includes(b.meat) ? b.meat : 'chicken', days: int(b.days, 1, 7, 4), people: int(b.people, 1, 10, 4), useDeals: !!b.useDeals, shop, note: str(b.note, 200) };
      const deals = o.useDeals ? await weekDeals(db, settings, wk, shop === 'all' ? settings.stores : [shop]) : [], history = (await getJSON(db, 'meals:history')) || [];
      // another go: different from the draft it replaces, as well as from what the family had
      const before = b.again ? ((await getJSON(db, 'meals:draft')) || {}).meals || [] : [];
      const p = await makePlan(env, settings, o, deals, [...history.slice(-20), ...before.map(m => ({ title: m.title }))], f);
      // the sale items it was planned with go with it, so its shopping list keeps them
      const sales = deals.flatMap(d => d.items.map(x => ({ ...x, store: d.store.id })));
      const draft = { at: Date.now(), by: me.name, week: wk, ...o, ...p, sales };
      await putJSON(db, 'meals:draft', draft);
      return reply({ draft });
    }
    if (route === 'accept' && method === 'POST') {
      const b = await body(request), draft = await getJSON(db, 'meals:draft');
      if (!draft) return reply({ error: 'no-draft' }, 409);
      const start = ISO.test(b.start) && !isNaN(Date.parse(b.start)) ? b.start : today();
      const dates = draft.meals.map((_, i) => addDays(start, i));
      const plan = { ...draft, id: 'p' + Date.now().toString(36), start, dates, acceptedAt: Date.now(), acceptedBy: me.name };
      const history = (await getJSON(db, 'meals:history')) || [];
      const log = (await getJSON(db, 'meals:log')) || [];
      const entry = { id: plan.id, start, end: dates[dates.length - 1], meat: plan.meat, shop: plan.shop, people: plan.people, titles: plan.meals.map(m => m.title) };
      const kept = [entry, ...log].slice(0, 52);
      await putJSON(db, 'meals:log:' + plan.id, plan);
      for (const old of log.slice(51)) await db.delete('meals:log:' + old.id);
      await putJSON(db, 'meals:log', kept);
      await putJSON(db, 'meals:plan', plan);
      await putJSON(db, 'meals:history', [...history, ...plan.meals.map(m => ({ title: m.title, cuisine: m.cuisine, at: plan.acceptedAt }))].slice(-40));
      await db.delete('meals:draft');
      return reply({ plan, log: kept });
    }
    if (route === 'discard' && method === 'POST') {
      const b = await body(request);
      if (b.at) { const d = await getJSON(db, 'meals:draft'); if (d && d.at !== b.at) return reply({ error: 'changed' }, 409); }
      await db.delete('meals:draft');
      return reply({});
    }
    // ---- for Ipsy: one night's dinner, a draft put back, an accept taken back (see the top) ----
    if (route === 'night' && method === 'POST') {
      const b = await body(request), key = b.draft ? 'meals:draft' : 'meals:plan', p = await getJSON(db, key);
      if (!p || !Array.isArray(p.meals) || !p.meals.length) return reply({ error: b.draft ? 'no-draft' : 'no-plan' }, 409);
      if (b.draft ? b.at && b.at !== p.at : b.id && b.id !== p.id) return reply({ error: 'changed' }, 409);
      const i = int(b.day, 1, p.meals.length, 0) - 1, m = oneMeal(b.meal);
      if (i < 0) return reply({ error: 'day' }, 400);
      if (!m) return reply({ error: 'meal' }, 400);
      const hits = avoidHits(planText([m]), settings.avoid);
      if (hits.length) return reply({ error: 'avoid', hits }, 422);
      const old = p.meals[i]; m.day = old.day;
      p.meals = p.meals.map((x, j) => j === i ? m : x);
      await putJSON(db, key, p);
      if (b.draft) return reply({ draft: p });
      // the accepted plan: its copy in the log, its titles there, and the history new plans differ from
      const log = (await getJSON(db, 'meals:log')) || [], e = log.find(x => x.id === p.id);
      if (p.id && e) { e.titles = p.meals.map(x => x.title); await putJSON(db, 'meals:log:' + p.id, p); await putJSON(db, 'meals:log', log); }
      const history = (await getJSON(db, 'meals:history')) || [], h = history.find(x => x.at === p.acceptedAt && x.title === old.title);
      if (h) { h.title = m.title; h.cuisine = m.cuisine; await putJSON(db, 'meals:history', history); }
      return reply({ plan: p, log });
    }
    if (route === 'draft' && method === 'POST') {
      const b = await body(request), d = b.draft && typeof b.draft === 'object' ? b.draft : {}, now = await getJSON(db, 'meals:draft');
      if (now && now.at !== b.over) return reply({ error: 'changed' }, 409);
      const p = cleanPlan(d, 7);
      if (!p.meals.length) return reply({ error: 'meal' }, 400);
      const hits = avoidHits(planText(p.meals), settings.avoid);
      if (hits.length) return reply({ error: 'avoid', hits }, 422);
      const at = +d.at > 0 && +d.at <= Date.now() ? Math.round(+d.at) : Date.now();
      const draft = { at, by: me.name, week: ISO.test(d.week) ? d.week : wk, meat: MEATS.includes(d.meat) ? d.meat : 'chicken', days: p.meals.length,
        people: int(d.people, 1, 10, 4), useDeals: !!d.useDeals, shop: d.shop === 'all' || storeOf(d.shop) ? d.shop : 'all', note: str(d.note, 200), ...p, sales: cleanSales(d.sales) };
      await putJSON(db, 'meals:draft', draft);
      return reply({ draft });
    }
    if (route === 'unaccept' && method === 'POST') {
      const b = await body(request), plan = await getJSON(db, 'meals:plan');
      if (!plan || !plan.id || plan.id !== b.id) return reply({ error: 'changed' }, 409);
      if (await getJSON(db, 'meals:draft')) return reply({ error: 'draft' }, 409);
      const log = ((await getJSON(db, 'meals:log')) || []).filter(e => e.id !== plan.id);
      const before = log[0] ? await getJSON(db, 'meals:log:' + log[0].id) : null;
      const history = ((await getJSON(db, 'meals:history')) || []).filter(h => h.at !== plan.acceptedAt);
      const { id, start, dates, acceptedAt, acceptedBy, ...draft } = plan;
      await putJSON(db, 'meals:draft', draft);
      await db.delete('meals:log:' + plan.id);
      await putJSON(db, 'meals:log', log);
      if (before) await putJSON(db, 'meals:plan', before); else await db.delete('meals:plan');
      await putJSON(db, 'meals:history', history);
      return reply({ plan: before, log, draft });
    }
    const lm = /^log\/(p[a-z0-9]{1,16})$/.exec(route);
    if (lm && method === 'GET') {
      const plan = await getJSON(db, 'meals:log:' + lm[1]);
      return plan ? reply({ plan }) : reply({ error: 'not-found' }, 404);
    }
    return reply({ error: 'not-found' }, 404);
  } catch (e) {
    return reply({ error: e.status ? e.message : 'server' }, e.status || 500);
  }
}
