// /meals/api/* - the family's Meals: this week's deals at their Whole Foods, and
// dinner plans built around a meat, made by an AI model. One plan and one deals
// list for the whole family (so everyone sees what's for dinner), locked to
// signed-in family by _middleware.js.
//
//   GET  state      -> { ai, model, week, settings, deals, plan }
//                      ai: 'anthropic', or null with no key yet
//   POST deals      { text? } -> { deals }
//                      without text: the model searches the web for this week's
//                      sales at the store; with text (copied from the store's
//                      sales page or app): the model reads the deals out of it.
//                      This week's are kept, so a second ask is free unless
//                      { refresh: true } (at most every 10 minutes).
//   POST plan       { meat, days, people, useDeals, note } -> { plan }
//   POST settings   { store, prime, avoid } -> { settings }
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
//   meals:settings  { store, prime, avoid, at }
//   meals:deals     { week, at, how, store, validFrom, validTo, items, sources }
//   meals:plan      { at, by, week, meat, days, people, useDeals, meals, tip }
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
export const DEFAULTS = { store: 'Whole Foods Market, Waverly Place, Cary, NC', prime: true, avoid: ['tree nuts', 'coconut'] };
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
    // 3 searches keep the prompt (search results count as input) well under 100,000
    // tokens, past which Haiku 5.5 costs five times as much.
    const tools = search ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3,
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
    name: str(x.name, 80), price: str(x.price, 30), regular: str(x.regular, 30), prime: !!x.prime, note: str(x.note, 80),
  }).filter(x => x && x.name);
  const sources = (Array.isArray(j && j.sources) ? j.sources : []).map(u => str(u, 300)).filter(u => /^https:\/\//.test(u)).slice(0, 6);
  return { validFrom: ISO.test(j && j.validFrom) ? j.validFrom : '', validTo: ISO.test(j && j.validTo) ? j.validTo : '', items, sources };
}
const DEALS_SHAPE = '{"validFrom":"YYYY-MM-DD","validTo":"YYYY-MM-DD","items":[{"name":"Organic boneless skinless chicken thighs","price":"$3.99/lb","regular":"$5.99/lb","prime":true,"note":"Prime members"}],"sources":["https://..."]}';
function dealsAsk(settings, wk, text) {
  const system = 'You read grocery store sales for a family. Answer with one JSON object only, no other words, shaped like: ' + DEALS_SHAPE
    + '. "price" is the sale price' + (settings.prime ? ' a Prime member pays (use the Prime price when one is shown)' : ' for everyone (not Prime-only prices)')
    + ', "regular" the usual price if shown, "prime" true when the price is for Prime members only. Food only: leave out alcohol, flowers, household and beauty items. Never make up a deal: if you can\'t find this week\'s sales, return "items": [].';
  const prompt = text
    ? 'These are this week\'s sales at ' + settings.store + ', copied from the store\'s sales page or app. List every food deal in them.\n\n' + text
    : 'Find this week\'s sales at ' + settings.store + ' (the week starting Wednesday ' + wk + '). Look for that store\'s weekly sales page and list every food deal you find, with the dates they run. Put the pages you used in "sources".';
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
  if (o.useDeals && deals && deals.items.length) lines.push('This week\'s sales at ' + settings.store + ' (use them to save money, and list the ones each dinner uses in "uses"):\n'
    + deals.items.map(d => '- ' + d.name + (d.price ? ' ' + d.price : '') + (d.regular ? ' (usually ' + d.regular + ')' : '')).join('\n'));
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
const settingsOf = s => ({ store: str(s && s.store, 100) || DEFAULTS.store, prime: s && typeof s.prime === 'boolean' ? s.prime : DEFAULTS.prime,
  avoid: Array.isArray(s && s.avoid) ? [...new Set(s.avoid.map(a => str(a, 40).toLowerCase()).filter(Boolean))].slice(0, 12) : DEFAULTS.avoid });

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
      const deals = await getJSON(db, 'meals:deals'), plan = await getJSON(db, 'meals:plan');
      return reply({ ai: aiOf(env), model: aiOf(env) ? modelOf(env) : null, week: wk, settings, deals, plan });
    }
    if (route === 'settings' && method === 'POST') {
      const s = settingsOf(await body(request));
      await putJSON(db, 'meals:settings', { ...s, at: Date.now() });
      return reply({ settings: s });
    }
    if (route === 'deals' && method === 'POST') {
      const b = await body(request), text = str(b.text, MAX_TEXT);
      const old = await getJSON(db, 'meals:deals');
      // This week's search already done: hand it back (searches cost money).
      if (!text && old && old.week === wk && old.store === settings.store && old.items.length && (!b.refresh || Date.now() - old.at < REFRESH_MS)) return reply({ deals: old });
      if (!aiOf(env)) return reply({ error: 'no-ai' }, 503);
      const d = cleanDeals(json(await ask(env, dealsAsk(settings, wk, text), f)));
      const deals = { week: wk, at: Date.now(), how: text ? 'paste' : 'search', store: settings.store, ...d };
      if (d.items.length) await putJSON(db, 'meals:deals', deals);
      return reply({ deals });
    }
    if (route === 'plan' && method === 'POST') {
      if (!aiOf(env)) return reply({ error: 'no-ai' }, 503);
      const b = await body(request);
      const o = { meat: MEATS.includes(b.meat) ? b.meat : 'chicken', days: int(b.days, 1, 7, 4), people: int(b.people, 1, 10, 4), useDeals: !!b.useDeals, note: str(b.note, 200) };
      const deals = await getJSON(db, 'meals:deals'), history = (await getJSON(db, 'meals:history')) || [];
      const p = await makePlan(env, settings, o, deals && deals.week === wk ? deals : null, history.slice(-20), f);
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
