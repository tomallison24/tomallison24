// /meals/api/* - the family's Meals: a week (or a day, or a few) of breakfasts, lunches and dinners,
// planned by an AI model from what the family fancies, kept to the family's rules (vegetables and
// protein in every meal, what they never eat). One plan for the whole family (so everyone sees
// what's for dinner), locked to signed-in family by _middleware.js.
//
//   GET  state      -> { ai, model, settings, taste, draft, plan, log, again }
//                      ai: 'anthropic', or null with no key yet; log: the accepted plans,
//                      newest first, in short (id, dates, what they were built around, titles)
//   GET  log/<id>   -> { plan } one accepted plan, whole
//   POST options    { slots, foods, days, people, lunches, courses, fridge, note, start } -> { options }
//                      first, OPTIONS_N dishes to choose from for each meal (a title and a line about it, and for a
//                      dinner of courses its starter and/or dessert): { ...the choices, at, meals: [{ key, day, slot,
//                      choices: [{ title, about, cuisine, minutes, starter, dessert }] } or { day, slot, leftover }] }.
//                      Not kept here: the phone keeps them until you pick, then asks for the plan with picks.
//   POST plan       { slots, foods, days, people, lunches, courses, fridge, note, start, again, picks } -> { draft }
//                      a new plan to look over, kept as the family's draft until someone accepts it.
//                      slots: which meals ('breakfast', 'lunch', 'dinner'); foods: what to build the
//                      lunches and dinners around (FOODS, or 'surprise'); days: 1 to 7 from start
//                      (YYYY-MM-DD, default today); lunches: 'leftovers' (the night before's dinner,
//                      cooked double), 'fresh' or 'mix'; courses: each dinner as 'main' alone (the default),
//                      'starter' + main, main + 'dessert', or 'all' three (COURSES); fridge: what to use up first;
//                      picks: { <key>: { title, about, starter, dessert } } the options picked, written as those dishes. again: true
//                      for another go, unlike the draft before it.
//   POST accept     { start? } -> { plan, log }
//                      the draft becomes the family's plan, day 1 on start (default: the draft's),
//                      saved with its dates and added to the log, as Fitness keeps each workout
//   POST discard    { at? } -> {} the draft goes (with at: only if it is still that draft)
//   POST clear      { id } -> { plan: null } the family's plan is cleared (the plan's ×), only if it is still
//                      plan id ({ error: 'changed' } if someone replaced it since). It stays in the log
//                      (Past plans, the Sheet) and in the history new plans differ from.
//   POST current    { id, over? } -> { plan } plan id from the log is the family's plan again (Undo of
//                      clear), only while the plan now is over (none: only while there is no plan)
//   POST settings   { avoid, veg, protein, people, weeknight } -> { settings }   the family's rules (avoid: the
//                      owner only; { error: 'owner-only' } for anyone else)
//   POST rate       { title, up } -> { taste } a meal the family loved (up: true), or never again
//                      (false); null forgets it. New plans make more like the loved ones, none of the others.
//   POST again      { add: [meal], from?, people? } -> { again } meals from a past plan, cooked again:
//                      on the Plan tab with their recipes, and in the shopping list beside the plan's.
//                      Cleaned and checked against what the family avoids now, as a plan's meals are
//                      ({ error: 'avoid', hits }: nothing is added); the same meal again isn't added twice.
//                   { remove: [id] } takes them off; { put: [entry] } puts the list back as it was (Undo).
//                      Each one goes by itself AGAIN_DAYS after it was added.
//
// For Ipsy, the helper you chat with (its changes, and their Undo, go through these and the
// ones above, so the allergy check and every other rule here applies to them too):
//   POST night      { draft?, day, slot?, meal, id?, at? } -> { plan, log } or { draft }
//                      one meal on the family's plan (or, with draft: true, on the new plan waiting),
//                      day and slot (default dinner): the whole meal, cleaned as a plan's are and
//                      checked against what the family avoids ({ error: 'avoid', hits } if it slips;
//                      nothing is saved). id (the plan's) or at (the draft's): only if it is still
//                      that one ({ error: 'changed' } if someone changed it since).
//   POST draft      { draft, over? } -> { draft }
//                      puts a draft back as it was (Undo of a new plan, or of Discard), checked like
//                      a plan; over: the at of the draft it may replace (none: only when no draft waits).
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
// The model: Claude Haiku 5.5 (the cheapest Claude, and plenty for this: the allergy check below
// doesn't rely on the model), through Anthropic's API with the key the owner adds as a Pages
// secret, ANTHROPIC_API_KEY (news.yml puts it). MEALS_MODEL names another model. No key:
// everything that needs the model answers { error: 'no-ai' }. A big plan (a week of three meals
// a day) is written in parts of up to CHUNK meals at once, side by side, so it takes about as
// long as a small one; each part is given its own cuisines and foods, so the parts don't repeat.
//
// Safety for the family's allergies: every meal is checked here, word by word, against what the
// family avoids (settings.avoid: tree nuts and coconut to start), not just asked of the model. A
// part that slips is sent back to the model once with what it got wrong; if it slips again, no
// plan is saved. The vegetables and protein are asked for, counted (the model lists the vegetables
// and estimates the protein) and sent back once if short; they are estimates, and say so.
//
// Stored in the accounts' Workers KV (ACCOUNTS, server/auth.js):
//   meals:settings  { avoid, veg, protein, people, weeknight, at }
//   meals:taste     { loved: [{ title, at }], nope: [{ title, at }] } the last 20 of each
//   meals:draft     { at, by, start, days, slots, foods, people, lunches, courses, fridge, note, meals, tip }
//                   meals: [{ day, slot, title, cuisine, method, minutes, why, veg, protein, fridge,
//                   ingredients, steps }], or { day, slot: 'lunch', leftover: <day>, title, ... }
//   meals:plan      the accepted plan: the draft, with id, dates (one a day), acceptedAt, acceptedBy
//   meals:log       [{ id, start, end, foods, slots, people, titles }] accepted plans, newest
//                   first, the last 52; meals:log:<id> each one whole
//   meals:history   [{ title, cuisine, at }] the last 60 meals, so new plans differ
//   meals:again     [{ id, from, people, at, by, ...meal }] meals cooked again (POST again), oldest first
// (Plans from before had only dinners, one a night, built around one meat: meat, shop, sales.
// They still open, as dinners.) Writes happen only when a plan is made or changed, or settings change.
//
// The X-Meals header stops other web pages calling this (as X-Drinks does).

import { reply, kv, getJSON, putJSON, sessionUser } from '../../../server/auth.js';
import { IPSY_MODEL, IPSY_DAILY, T, DAY, persona, modelOf as ipsyModelFor, requestHead, ipsyStep, fail, aiFail, today } from '../../../server/ipsy.js';

export const MODEL = 'claude-haiku-5-5';
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 120e3;
const MAX_BODY = 128 * 1024;
export const CHUNK = 6;            // meals the model writes at once (a dinner of two or three courses counts as two or three)

export const SLOTS = ['breakfast', 'lunch', 'dinner'];
export const FOODS = ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'fish', 'shrimp', 'vegetarian'];
export const LUNCHES = ['leftovers', 'fresh', 'mix'];
// A dinner's courses (POST plan's courses): one dish, or a starter and/or a dessert with the main. The meal is the
// main (its title, the plan's tags); each course keeps its own title and steps (courses), each ingredient says
// which course it's for, and the meal's steps are all of them, course by course, so everything that reads a
// meal's ingredients and steps (the shopping list, the Sheet, Ipsy, the allergy check) has the whole dinner.
export const COURSES = { main: ['main'], starter: ['starter', 'main'], dessert: ['main', 'dessert'], all: ['starter', 'main', 'dessert'] };
const COURSE = ['starter', 'main', 'dessert'];
const COURSE_NAME = { starter: 'Starter', main: 'Main', dessert: 'Dessert' };
// protein a person a meal, grams: the family picks one in Settings (breakfasts aim for at most 25)
export const PROTEIN = { some: 20, good: 30, high: 40 };
export const WEEKNIGHT = [0, 20, 30, 40, 60];   // minutes for a Monday to Thursday dinner; 0: no limit
export const DEFAULTS = { avoid: ['tree nuts', 'coconut'], veg: 2, protein: 'good', people: 4, weeknight: 40 };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Each lunch and dinner is given a cuisine, and each breakfast a kind, in turn from a random place in
// these, so no two are alike and the parts the plan is written in don't repeat each other.
export const CUISINES = ['Mediterranean', 'Mexican', 'Italian', 'Japanese', 'Indian', 'Thai', 'Middle Eastern', 'Korean', 'American',
  'Greek', 'Chinese', 'Moroccan', 'French', 'Vietnamese', 'Spanish', 'Caribbean'];
export const BREAKFASTS = ['eggs (scrambled, an omelette or a frittata)', 'Greek yogurt bowl', 'overnight oats', 'savory toast', 'breakfast burrito',
  'cottage cheese pancakes', 'egg muffins', 'smoothie with eggs on the side', 'tofu or egg scramble', 'oatmeal with eggs'];

const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const int = (v, lo, hi, d) => { if (v == null || v === '') return d; const n = Math.round(+v); return isFinite(n) && n >= lo && n <= hi ? n : d; };
// Plans cost money (a few Claude calls each): at most AI_DAILY a person a day, counted in the
// accounts' KV as meals:ai:<user id>:<day> (gone after two days), written before the call.
export const AI_DAILY = 20;
// Meals cooked again from past plans (POST again): at most AGAIN_MAX at once, each kept AGAIN_DAYS
export const AGAIN_MAX = 21, AGAIN_DAYS = 14;
const againOf = (a, now = Date.now()) => (Array.isArray(a) ? a : []).filter(x => x && x.id && x.at > now - AGAIN_DAYS * 864e5).slice(-AGAIN_MAX);
async function countAi(db, me) {
  const key = 'meals:ai:' + me.id + ':' + today(), n = (+(await db.get(key)) || 0) + 1;
  if (n > AI_DAILY) return false;
  await db.put(key, String(n), { expirationTtl: 2 * 86400 });
  return true;
}

// dates in Cary's time, as YYYY-MM-DD (today: server/ipsy.js)
export { today };
export const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isDay = s => ISO.test(s) && !isNaN(Date.parse(s + 'T12:00:00Z'));

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
const planText = meals => meals.flatMap(m => [m.title, m.why, ...(m.veg || []), ...(m.courses || []).map(c => c.title), ...m.ingredients.map(i => i.item + ' ' + i.qty), ...m.steps]);

// ---- the model ----
export const modelOf = env => str(env && env.MEALS_MODEL, 60) || MODEL;
export const aiOf = env => env && env.ANTHROPIC_API_KEY ? 'anthropic' : null;

// Claude Haiku 5.5 thinks before it answers (adaptive thinking, on unless turned off), and the thinking
// counts toward max_tokens: a plan's meals came back cut off mid-way ("That didn't come back right").
// So a plan part asks for low effort, leaves room for the thinking, and has its answer held to
// MEALS_SCHEMA (structured outputs: always whole, parseable JSON); an answer that still stops short
// (stop_reason max_tokens) or is declined says so as ai-format, not as a parse failure.
export async function ask(env, { system, prompt, maxTokens = 4000, schema, effort }, f = fetch) {
  const ai = aiOf(env), model = modelOf(env);
  if (!ai) throw fail('no-ai', 503);
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    let r;
    try {
      r = await f(ANTHROPIC_URL, { method: 'POST', signal: ac.signal,
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }],
          ...(schema || effort ? { output_config: { ...(effort ? { effort } : {}), ...(schema ? { format: { type: 'json_schema', schema } } : {}) } } : {}) }) });
    } catch { throw fail('ai-unreachable', 502); }
    if (!r.ok) throw await aiFail(r);
    const j = await r.json();
    if (j.stop_reason === 'max_tokens' || j.stop_reason === 'refusal') throw fail('ai-format', 502);
    return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  } finally { clearTimeout(timer); }
}

// The JSON object in a reply (models sometimes wrap it in words or a code fence).
export function json(text) {
  const s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw fail('ai-format', 502);
  try { return JSON.parse(s.slice(a, b + 1)); } catch { throw fail('ai-format', 502); }
}

// ---- the family's rules ----
export const settingsOf = s => ({
  avoid: Array.isArray(s && s.avoid) ? [...new Set(s.avoid.map(a => str(a, 40).toLowerCase()).filter(Boolean))].slice(0, 12) : DEFAULTS.avoid,
  veg: int(s && s.veg, 0, 5, DEFAULTS.veg),
  protein: s && PROTEIN[s.protein] ? s.protein : DEFAULTS.protein,
  people: int(s && s.people, 1, 10, DEFAULTS.people),
  weeknight: s && s.weeknight != null && s.weeknight !== '' && WEEKNIGHT.includes(+s.weeknight) ? +s.weeknight : DEFAULTS.weeknight,
});
// protein a person for a meal, as the rules ask (breakfasts at most 25 g)
export const proteinFor = (settings, slot) => Math.min(PROTEIN[settings.protein] || 30, slot === 'breakfast' ? 25 : 99);
const tasteOf = t => ({ loved: Array.isArray(t && t.loved) ? t.loved.slice(0, 20) : [], nope: Array.isArray(t && t.nope) ? t.nope.slice(0, 20) : [] });

// ---- plans ----
// One meal, kept as a plan keeps them, or null. A leftover lunch (the night before's dinner) has
// no recipe of its own: just what it is and which day's dinner it comes from.
export function cleanMeal(m) {
  if (!m || typeof m !== 'object') return null;
  const day = int(m.day, 1, 7, 1), slot = SLOTS.includes(m.slot) ? m.slot : 'dinner';
  const base = { day, slot, title: str(m.title, 100) };
  if (Number.isInteger(m.leftover) && m.leftover >= 1 && m.leftover < day) {
    return base.title ? { ...base, slot: 'lunch', leftover: m.leftover, minutes: int(m.minutes, 0, 60, 10), veg: list(m.veg, 40, 8), protein: int(m.protein, 0, 150, 0),
      ingredients: [], steps: (Array.isArray(m.steps) ? m.steps : []).map(s => str(s, 300)).filter(Boolean).slice(0, 3) } : null;
  }
  const meal = { ...base, cuisine: str(m.cuisine, 30), method: str(m.method, 30), minutes: int(m.minutes, 5, 600, 0), why: str(m.why, 200),
    veg: list(m.veg, 40, 8), protein: int(m.protein, 0, 150, 0), fridge: list(m.fridge, 60, 8),
    ingredients: (Array.isArray(m.ingredients) ? m.ingredients : []).slice(0, 40).map(x => x && { item: str(x.item, 60), qty: str(x.qty, 30), pantry: !!x.pantry,
      ...(COURSE.includes(x.course) && x.course !== 'main' ? { course: x.course } : {}) }).filter(x => x && x.item),
    steps: (Array.isArray(m.steps) ? m.steps : []).map(s => str(s, 400)).filter(Boolean).slice(0, 12) };
  // a dinner of courses: each with its title and steps, in order (starter, main, dessert); the meal's steps are theirs
  const courses = (Array.isArray(m.courses) ? m.courses : []).filter(c => c && COURSE.includes(c.course))
    .map(c => ({ course: c.course, title: str(c.title, 100), steps: (Array.isArray(c.steps) ? c.steps : []).map(s => str(s, 400)).filter(Boolean).slice(0, 12) }))
    .filter((c, i, a) => c.title && c.steps.length && a.findIndex(x => x.course === c.course) === i).sort((a, b) => COURSE.indexOf(a.course) - COURSE.indexOf(b.course));
  if (courses.length > 1 && courses.some(c => c.course === 'main')) {
    meal.courses = courses;
    meal.steps = courses.flatMap(c => c.steps.map(s => COURSE_NAME[c.course] + ': ' + s)).slice(0, 36);
  } else meal.ingredients.forEach(x => delete x.course);
  return meal.title && meal.ingredients.length && meal.steps.length ? meal : null;
}
const list = (a, n, max) => (Array.isArray(a) ? a : []).map(x => str(x, n)).filter(Boolean).slice(0, max);
// A whole plan's meals, in order (by day, then breakfast, lunch, dinner), and its tip.
const ORDER = m => m.day * 3 + SLOTS.indexOf(m.slot);
export function cleanPlan(j, most = 21) {
  const meals = (Array.isArray(j && j.meals) ? j.meals : []).slice(0, most).map(cleanMeal).filter(Boolean).sort((a, b) => ORDER(a) - ORDER(b));
  return { meals, tip: str(j && j.tip, 300) };
}
const leftoverOf = (dinner, day) => ({ day, slot: 'lunch', leftover: dinner.day, title: 'Leftovers: ' + dinner.title, minutes: 10, veg: dinner.veg, protein: dinner.protein,
  ingredients: [], steps: ['Reheat last night’s ' + dinner.title.charAt(0).toLowerCase() + dinner.title.slice(1) + ', or pack it to take.'] });

// What the plan asks for, a line a meal: o is the plan's choices (cleaned), rnd picks where the
// cuisines and breakfasts start. A lunch that is the night before's leftovers isn't asked of the
// model; that dinner is cooked double instead.
export function specs(o, settings, rnd = Math.random) {
  const out = [], foods = o.foods.filter(f => f !== 'surprise');
  let ci = Math.floor(rnd() * CUISINES.length), bi = Math.floor(rnd() * BREAKFASTS.length), fi = 0;
  const leftoverDay = d => o.slots.includes('dinner') && o.slots.includes('lunch') && d > 1 && (o.lunches === 'leftovers' || (o.lunches === 'mix' && d % 2 === 0));
  for (let d = 1; d <= o.days; d++) {
    const wd = new Date(addDays(o.start, d - 1) + 'T12:00:00Z').getUTCDay();
    for (const slot of SLOTS) {
      if (!o.slots.includes(slot)) continue;
      if (slot === 'lunch' && leftoverDay(d)) { out.push({ day: d, slot, leftover: d - 1 }); continue; }
      const s = { key: 'd' + d + '-' + slot, day: d, slot, weekday: WEEKDAYS[wd] };
      if (slot === 'breakfast') s.style = BREAKFASTS[bi++ % BREAKFASTS.length];
      else { s.cuisine = CUISINES[ci++ % CUISINES.length]; s.food = foods.length ? foods[fi++ % foods.length] : ''; }
      if (slot === 'dinner') { s.maxMinutes = wd >= 1 && wd <= 4 ? settings.weeknight : 0; s.double = d < o.days && leftoverDay(d + 1);
        if (COURSES[o.courses] && o.courses !== 'main') s.courses = COURSES[o.courses]; }
      out.push(s);
    }
  }
  return out;
}
const MEAL_SHAPE = '{"meals":[{"key":"d1-dinner","title":"Lemon chicken thighs with white beans and greens","cuisine":"Mediterranean","method":"roasted","minutes":35,"why":"one short line on why it suits the day",'
  + '"veg":["spinach","leeks","zucchini"],"protein":42,"fridge":["cabbage"],"ingredients":[{"item":"boneless chicken thighs","qty":"2 lb","pantry":false,"course":"main"},{"item":"olive oil","qty":"2 tbsp","pantry":true,"course":"main"}],"steps":["..."],"courses":[]}],"tip":"one prep-ahead or money-saving tip"}';
// The shape every plan part's answer is held to (structured outputs: no numeric or length limits here;
// cleanMeal checks those).
const STR = { type: 'string' }, STRS = { type: 'array', items: STR };
export const MEALS_SCHEMA = { type: 'object', additionalProperties: false, required: ['meals', 'tip'], properties: {
  meals: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['key', 'title', 'cuisine', 'method', 'minutes', 'why', 'veg', 'protein', 'fridge', 'ingredients', 'steps', 'courses'], properties: {
      key: STR, title: STR, cuisine: STR, method: STR, minutes: { type: 'integer' }, why: STR, veg: STRS, protein: { type: 'integer' }, fridge: STRS,
      ingredients: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['item', 'qty', 'pantry', 'course'],
        properties: { item: STR, qty: STR, pantry: { type: 'boolean' }, course: { type: 'string', enum: COURSE } } } },
      steps: STRS,
      courses: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['course', 'title', 'steps'],
        properties: { course: { type: 'string', enum: COURSE }, title: STR, steps: STRS } } } } } },
  tip: STR } };
const FOOD_WORDS = { vegetarian: 'meat-free (vegetarian: beans, lentils, eggs, tofu, cheese)', fish: 'fish (salmon, cod, tuna...)' };
function specLine(s, o) {
  const pk = s.pick, what = pk ? s.slot + ': "' + pk.title + '"' + (pk.about ? ' (' + pk.about + ')' : '')
    + (pk.starter ? ', starter "' + pk.starter + '"' : '') + (pk.dessert ? ', dessert "' + pk.dessert + '"' : '')
    : s.slot === 'breakfast' ? 'breakfast: ' + s.style
    : s.slot + ', ' + s.cuisine + (s.food ? ', built around ' + (FOOD_WORDS[s.food] || s.food) : '');
  return '- ' + s.key + ' (' + s.weekday + ' ' + s.slot + '): ' + what
    + (s.maxMinutes ? ', ready in ' + s.maxMinutes + ' minutes or less' : '')
    + (s.double ? ', cook enough ' + (s.courses ? 'of the main ' : '') + 'for ' + o.people + ' tonight plus ' + o.people + ' lunches tomorrow (list amounts for both)' : '')
    + (s.courses ? ', as ' + s.courses.length + ' courses: ' + s.courses.map(c => c === 'main' ? 'a main' : 'a ' + c).join(', ') : '');
}
export function chunkAsk(settings, o, part, { history = [], taste = { loved: [], nope: [] }, fridge = false, why = '' } = {}) {
  const avoid = settings.avoid.join(', '), protein = PROTEIN[settings.protein] || 30;
  const system = 'You plan a family\'s meals: healthy, varied home cooking. Answer with one JSON object only, no other words, shaped like: ' + MEAL_SHAPE + '. '
    + 'One entry for every meal asked, with its "key". Write US English with US measures; quantities for the whole family. Mark staples most kitchens have (oil, salt, pepper, dried spices, flour, sugar) "pantry": true. Steps are short and in order. '
    + 'Healthy: every meal has at least ' + settings.veg + ' different vegetables (for a breakfast, fruit counts), named in "veg", and about ' + protein + ' g of protein a person (breakfasts at least ' + Math.min(protein, 25) + ' g), your honest estimate in "protein" (grams a person). Whole foods, not much sugar or deep frying. '
    + '"fridge" lists the things from the family\'s fridge a meal uses (none: []). '
    + 'A meal asked as courses is one dinner: "title" is the main\'s dish; "courses" has an entry for each course asked (its "course", its own dish as "title", and its own "steps"), "steps" is [], and every ingredient says which course it is for ("starter", "main" or "dessert"). The time ("minutes") is for the whole dinner; the vegetables and protein count across its courses. A starter is light; a dessert is simple and not too sweet, fruit welcome. Any other meal has "courses": [] and every ingredient "course": "main". '
    + (avoid ? 'ALLERGIES - the family must never eat: ' + avoid + '. Use none of them in any form (oils, milks, flours, butters, sauces, garnishes, pesto, curry pastes), and don\'t mention them at all, not even to say a dish is free of them. ' : '');
  const lines = ['Write these ' + part.length + ' meals for ' + o.people + ' people, every one a different dish and a different way of cooking'
    + (part.some(s => s.pick) ? ' (a dish in quotes is the one the family picked: write that dish, with that title)' : '') + ':\n' + part.map(s => specLine(s, o)).join('\n')];
  if (fridge && o.fridge) lines.push('Use up what is in the fridge in these first meals where it fits: ' + o.fridge + '.');
  if (history.length) lines.push('The family had these lately; make different dishes: ' + history.map(h => h.title).join('; ') + '.');
  if (taste.loved.length) lines.push('The family loved these: ' + taste.loved.map(t => t.title).join('; ') + '. Now and then make something in the same spirit.');
  if (taste.nope.length) lines.push('Never make these again, or anything much like them: ' + taste.nope.map(t => t.title).join('; ') + '.');
  if (o.note) lines.push('Also: ' + o.note);
  if (why) lines.push(why);
  return { system, prompt: lines.join('\n\n'), maxTokens: Math.min(16000, 1800 * weight(part) + 4000), schema: MEALS_SCHEMA, effort: 'low' };
}

// How much writing a part of a plan is: a meal each, a dinner of courses one a course.
const weight = part => part.reduce((n, s) => n + (s.courses ? s.courses.length : 1), 0);
// One part of a plan: the meals asked for, by key, checked; sent back once with what was wrong.
async function writePart(env, settings, o, part, extra, f) {
  const q = chunkAsk(settings, o, part, extra);
  const take = j => { const by = new Map(); for (const m of Array.isArray(j && j.meals) ? j.meals : []) if (m && typeof m.key === 'string') by.set(m.key, m);
    return { tip: str(j && j.tip, 300), meals: part.map(s => { const m = by.get(s.key); return m ? cleanMeal({ ...m, day: s.day, slot: s.slot }) : null; }) }; };
  const problems = r => {
    const out = [], missing = part.filter((s, i) => !r.meals[i]).map(s => s.key);
    if (missing.length) out.push('It left out ' + missing.join(', ') + '.');
    const hits = avoidHits(planText(r.meals.filter(Boolean)), settings.avoid);
    if (hits.length) out.push('It used ' + hits.join(', ') + ', which this family must never eat.');
    r.meals.forEach((m, i) => {
      if (!m) return;
      if (m.veg.length < settings.veg) out.push(part[i].key + ' has ' + m.veg.length + ' vegetables; it needs at least ' + settings.veg + '.');
      if (m.protein < proteinFor(settings, m.slot) * 0.85) out.push(part[i].key + ' has about ' + m.protein + ' g protein a person; it needs about ' + proteinFor(settings, m.slot) + ' g.');
      const want = part[i].courses, got = (m.courses || []).map(c => c.course);
      if (want && want.join() !== got.join()) out.push(part[i].key + ' needs its courses (' + want.join(', ') + '), each with its title and steps.');
    });
    return { out, missing: missing.length, hits };
  };
  let r = take(json(await ask(env, q, f))), p = problems(r);
  if (p.out.length) {
    r = take(json(await ask(env, chunkAsk(settings, o, part, { ...extra, why: 'Your last answer was wrong: ' + p.out.join(' ') + ' Write all of these meals again.' }), f)));
    p = problems(r);
  }
  if (p.hits.length) throw fail('avoid', 422);
  if (p.missing) throw fail('ai-format', 502);
  return r;   // a vegetable or a few grams short after two goes: kept, with the counts it has
}

export async function makePlan(env, settings, o, history = [], taste = { loved: [], nope: [] }, f = fetch, rnd = Math.random, picks = {}) {
  const sp = specs(o, settings, rnd), todo = sp.filter(s => !s.leftover), parts = [];
  for (const s of todo) if (Object.hasOwn(picks, s.key)) s.pick = picks[s.key];
  for (const s of todo) { const last = parts[parts.length - 1]; if (last && weight([...last, s]) <= CHUNK) last.push(s); else parts.push([s]); }
  const done = await Promise.all(parts.map((part, i) => writePart(env, settings, o, part, { history, taste, fridge: i === 0 }, f)));
  const by = new Map(); parts.forEach((part, i) => part.forEach((s, j) => by.set(s.key, done[i].meals[j])));
  const meals = [];
  for (const s of sp) {
    if (s.leftover) { const dinner = meals.find(m => m.day === s.leftover && m.slot === 'dinner'); if (dinner) meals.push(leftoverOf(dinner, s.day)); }
    else meals.push(by.get(s.key));
  }
  return { meals, tip: done[0] ? done[0].tip : '' };
}

// ---- options: a few dishes for each meal, to pick from before the recipes are written ----
export const OPTIONS_N = 3, OPTIONS_CHUNK = 8;   // dishes a meal; meals asked at once
export const OPTIONS_SCHEMA = { type: 'object', additionalProperties: false, required: ['meals'], properties: {
  meals: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'options'], properties: {
    key: STR, options: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'about', 'cuisine', 'minutes', 'starter', 'dessert'],
      properties: { title: STR, about: STR, cuisine: STR, minutes: { type: 'integer' }, starter: STR, dessert: STR } } } } } } } };
export function optionsAsk(settings, o, part, { history = [], taste = { loved: [], nope: [] }, why = '' } = {}) {
  const avoid = settings.avoid.join(', ');
  const system = 'You suggest dishes for a family\'s meals: healthy, varied home cooking. Answer with one JSON object only: for each meal asked, its "key" and '
    + OPTIONS_N + ' "options", each a different dish (a different cuisine or way of cooking where the meal allows): "title" (the dish, like "Lemon chicken thighs with white beans and greens"), '
    + '"about" (one short sentence that makes it appealing: what it is like and why it suits the day), "cuisine", "minutes" (total time), and for a meal asked as courses the "starter" and/or "dessert" dish that goes with it ("" when not asked). '
    + 'Write US English. Every dish has vegetables and good protein; whole foods, not much sugar or deep frying. '
    + (avoid ? 'ALLERGIES - the family must never eat: ' + avoid + '. Suggest nothing with any of them in any form, and don\'t mention them at all. ' : '');
  const lines = ['Suggest ' + OPTIONS_N + ' dishes for each of these ' + part.length + ' meals for ' + o.people + ' people (the cuisine named is a starting point, not a rule):\n' + part.map(s => specLine(s, o)).join('\n')];
  if (o.fridge) lines.push('Use up what is in the fridge where it fits: ' + o.fridge + '.');
  if (history.length) lines.push('The family had these lately; suggest different dishes: ' + history.map(h => h.title).join('; ') + '.');
  if (taste.loved.length) lines.push('The family loved these: ' + taste.loved.map(t => t.title).join('; ') + '.');
  if (taste.nope.length) lines.push('Never suggest these again, or anything much like them: ' + taste.nope.map(t => t.title).join('; ') + '.');
  if (o.note) lines.push('Also: ' + o.note);
  if (why) lines.push(why);
  return { system, prompt: lines.join('\n\n'), maxTokens: Math.min(16000, 500 * part.length + 4000), schema: OPTIONS_SCHEMA, effort: 'low' };
}
const cleanOption = (x, s) => x && typeof x === 'object' && str(x.title, 100) ? { title: str(x.title, 100), about: str(x.about, 200), cuisine: str(x.cuisine, 30), minutes: int(x.minutes, 5, 600, 0),
  ...(s.courses && s.courses.includes('starter') && str(x.starter, 100) ? { starter: str(x.starter, 100) } : {}),
  ...(s.courses && s.courses.includes('dessert') && str(x.dessert, 100) ? { dessert: str(x.dessert, 100) } : {}) } : null;
const optionText = c => [c.title, c.about, c.starter || '', c.dessert || ''];
// One part's options: what the family avoids is taken out; a meal left with fewer than two is asked again once
async function optionsPart(env, settings, o, part, extra, f) {
  const take = j => { const by = new Map(); for (const m of Array.isArray(j && j.meals) ? j.meals : []) if (m && typeof m.key === 'string') by.set(m.key, m);
    return part.map(s => ((by.get(s.key) || {}).options || []).slice(0, OPTIONS_N + 2).map(x => cleanOption(x, s)).filter(c => c && !avoidHits(optionText(c), settings.avoid).length)
      .filter((c, i, a) => a.findIndex(x => x.title.toLowerCase() === c.title.toLowerCase()) === i).slice(0, OPTIONS_N)); };
  let got = take(json(await ask(env, optionsAsk(settings, o, part, extra), f)));
  const short = part.filter((s, i) => got[i].length < 2).map(s => s.key);
  if (short.length) {
    const again = take(json(await ask(env, optionsAsk(settings, o, part, { ...extra, why: 'Your last answer was short of options for ' + short.join(', ') + ' (or used something the family never eats). Write all of them again.' }), f)));
    got = got.map((g, i) => again[i].length > g.length ? again[i] : g);
  }
  if (got.some(g => !g.length)) throw fail('ai-format', 502);
  return got;
}
export async function makeOptions(env, settings, o, history = [], taste = { loved: [], nope: [] }, f = fetch, rnd = Math.random) {
  const sp = specs(o, settings, rnd), todo = sp.filter(s => !s.leftover), parts = [];
  for (let i = 0; i < todo.length; i += OPTIONS_CHUNK) parts.push(todo.slice(i, i + OPTIONS_CHUNK));
  const done = await Promise.all(parts.map(part => optionsPart(env, settings, o, part, { history, taste }, f)));
  const by = new Map(); parts.forEach((part, i) => part.forEach((s, j) => by.set(s.key, done[i][j])));
  return sp.map(s => s.leftover ? { day: s.day, slot: s.slot, leftover: s.leftover } : { key: s.key, day: s.day, slot: s.slot, choices: by.get(s.key) });
}
// The options picked, from the phone: { <key>: { title, about, starter, dessert } }, only for the plan's own keys
const PICK_KEY = /^d[1-7]-(breakfast|lunch|dinner)$/;
export function picksOf(b) {
  const out = {};
  if (b && b.picks && typeof b.picks === 'object' && !Array.isArray(b.picks)) for (const [k, v] of Object.entries(b.picks).slice(0, 21)) {
    if (!PICK_KEY.test(k) || !v || typeof v !== 'object' || !str(v.title, 100)) continue;
    out[k] = { title: str(v.title, 100), about: str(v.about, 200), ...(str(v.starter, 100) ? { starter: str(v.starter, 100) } : {}), ...(str(v.dessert, 100) ? { dessert: str(v.dessert, 100) } : {}) };
  }
  return out;
}

// The plan's choices, from what the phone (or Ipsy) asked for.
export function choicesOf(b, settings, now = Date.now()) {
  const t = today(now), start = isDay(b.start) && b.start >= addDays(t, -1) && b.start <= addDays(t, 14) ? b.start : t;
  const slots = SLOTS.filter(s => Array.isArray(b.slots) && b.slots.includes(s));
  const foods = [...new Set((Array.isArray(b.foods) ? b.foods : []).map(x => String(x).toLowerCase()).filter(x => FOODS.includes(x) || x === 'surprise'))].slice(0, 8);
  return { start, days: int(b.days, 1, 7, 3), slots: slots.length ? slots : ['dinner'], foods: foods.length ? foods : ['surprise'],
    people: int(b.people, 1, 10, settings.people), lunches: LUNCHES.includes(b.lunches) ? b.lunches : 'leftovers',
    courses: typeof b.courses === 'string' && Object.hasOwn(COURSES, b.courses) ? b.courses : 'main', fridge: str(b.fridge, 300), note: str(b.note, 200) };
}

// ---- Ipsy: the helper you chat with (server/ipsy.js, shared by every app with Ipsy) ----
// The phone keeps the conversation and runs Meals' tools (meals/ipsy-tools.js), on the family's
// plan and draft through this route's own endpoints; Anthropic runs web search and web fetch.
// MEALS_IPSY_MODEL names another model than Claude Sonnet 5.5.
export { IPSY_MODEL, IPSY_DAILY };
export const ipsyModelOf = env => ipsyModelFor(env, 'MEALS_IPSY_MODEL');
const WHICH = { type: 'string', enum: ['current', 'draft'], description: 'current: the family\'s accepted plan; draft: the new plan waiting to be accepted' };
const DAYN = { type: 'integer', description: 'The day\'s number in the plan, from 1' };
const SLOT = { type: 'string', enum: SLOTS, description: 'Which meal of the day (default dinner)' };
const MEAL = { type: 'object', additionalProperties: false, required: ['title', 'ingredients', 'steps'], properties: {
  title: { type: 'string', description: 'The dish, like "Honey-garlic chicken thighs with roasted broccoli"' },
  cuisine: { type: 'string' }, method: { type: 'string', description: 'The way it is cooked: grilled, braised, stir-fried, sheet pan, slow cooker, soup...' },
  minutes: { type: 'integer', description: 'Total time' }, why: { type: 'string', description: 'One short line on why it suits the day' },
  veg: { type: 'array', items: { type: 'string' }, description: 'The vegetables in it (for a breakfast, fruit counts): at least as many as the family\'s rule' },
  protein: { type: 'integer', description: 'Your honest estimate of the protein a person, in grams' },
  ingredients: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['item'], properties: {
    item: { type: 'string' }, qty: { type: 'string', description: 'For the whole family, in US measures, like "2 lb"' }, pantry: { type: 'boolean', description: 'A staple most kitchens have (oil, salt, pepper, dried spices, flour, sugar)' } } } },
  steps: { type: 'array', items: { type: 'string' }, description: 'Short steps, in order' },
} };
export const IPSY_CLIENT_TOOLS = [
  T('get_meals', 'An overview of the family\'s Meals: the plan (each day\'s date and its meals), the new plan waiting to be accepted if there is one, the family\'s rules (vegetables and protein in every meal, how many they cook for, weeknight time, what they never eat), the meals they loved and never want again, and how many past plans there are.', {}),
  T('get_recipes', 'Whole recipes (ingredients, amounts, steps, vegetables, protein) from the current plan, the new plan waiting, or a past plan.', {
    plan: { type: 'string', description: 'current, draft, or a past plan\'s id (get_past_plans)' },
    days: { type: 'array', items: { type: 'integer' }, description: 'Which days, from 1 (default: all)' },
  }, ['plan']),
  T('get_past_plans', 'The plans the family accepted before, newest first: each one\'s id, dates, what it was built around and its meals.', {
    limit: { type: 'integer', description: 'Most to return (default 12, at most 52)' },
  }),
  T('get_shopping_list', 'The shopping list, as the List tab shows it: the current plan\'s ingredients and those of the meals being cooked again, by grocery section, each item\'s amount, which days (or which meal cooked again) need it, and whether it is ticked on this phone; staples apart.', {}),
  T('add_past_meals', 'Cook meals from a past plan again: they go on the Plan tab (Cooking again) with their recipes, and their ingredients into the shopping list, for everyone in the family, for two weeks. The server checks them against what the family never eats now. Undo takes them off.', {
    plan: { type: 'string', description: 'A past plan\'s id (get_past_plans)' },
    meals: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['day'], properties: { day: DAYN, slot: SLOT } }, description: 'Which of its meals (default: all but leftover lunches)' },
  }, ['plan']),
  T('remove_past_meals', 'Take meals being cooked again off the Plan tab and the shopping list.', {
    titles: { type: 'array', items: { type: 'string' }, description: 'Their titles, as get_meals gives them under cookingAgain' },
  }, ['titles']),
  T('tick_items', 'Tick items off the shopping list (or untick them), on this phone only.', {
    items: { type: 'array', items: { type: 'string' }, description: 'Item names as get_shopping_list gives them' },
    ticked: { type: 'boolean', description: 'true to tick (default), false to untick' },
  }, ['items']),
  T('set_meal', 'Change one meal on the current plan or the new plan waiting: give the whole meal. The server checks it against what the family never eats before saving; if it slips, nothing changes and the answer says what it found. Everyone in the family sees the change.', {
    plan: WHICH, day: DAYN, slot: SLOT, meal: MEAL,
  }, ['plan', 'day', 'meal']),
  T('make_plan', 'Make a new plan the way the app does: the planner writes the meals asked for, checked against what the family never eats and kept to their rules, and it waits as the new plan (not saved yet) until accepted. A day takes about half a minute, a week a minute or so. If a new plan is already waiting, the person is asked first, as it takes its place.', {
    meals: { type: 'array', items: { type: 'string', enum: SLOTS }, description: 'Which meals of the day (default dinner)' },
    foods: { type: 'array', items: { type: 'string', enum: [...FOODS, 'surprise'] }, description: 'What the lunches and dinners are built around, in turn; surprise for anything' },
    days: { type: 'integer', description: '1 to 7 (default 3)' }, people: { type: 'integer', description: '1 to 10 (default: the family\'s usual)' },
    start: { ...DAY, description: 'The first day (YYYY-MM-DD; default today)' },
    lunches: { type: 'string', enum: LUNCHES, description: 'leftovers: the night before\'s dinner, cooked double (default); fresh: a new lunch every day; mix: some of each' },
    courses: { type: 'string', enum: Object.keys(COURSES), description: 'Each dinner\'s courses: main alone (default); starter: a starter and the main; dessert: the main and a dessert; all: starter, main and dessert' },
    fridge: { type: 'string', description: 'What is in the fridge to use up first (at most 300 characters)' },
    note: { type: 'string', description: 'Anything else, like "kid-friendly" or "no spice" (at most 200 characters)' },
    again: { type: 'boolean', description: 'Make it unlike the new plan already waiting (another go)' },
  }),
  T('accept_plan', 'Accept the new plan waiting, so it becomes the family\'s plan, with its shopping list. It takes the place of the current plan for everyone, so the person is asked first.', {
    start: { ...DAY, description: 'The first day (YYYY-MM-DD; default: the day it was planned from)' },
  }),
  T('discard_draft', 'Discard the new plan waiting (the person is asked first). The current plan stays.', {}),
  T('show_meal', 'Open one meal\'s recipe on the person\'s screen, behind the chat.', { plan: WHICH, day: DAYN, slot: SLOT }, ['plan', 'day']),
];
const GROUP_WORDS = Object.entries(GROUPS).map(([k, v]) => '"' + k + '" (' + v.join(', ') + ')').join('; ');
export const IPSY_SYSTEM = persona({
  app: 'Meals',
  about: 'an iPhone app a family uses to plan healthy breakfasts, lunches and dinners with you: they say what they fancy and you plan the meals, each with its recipe, and a shopping list',
  can: [
    'Read the family\'s Meals: get_meals (the plan, the new plan waiting, the family\'s rules, what they loved, the meals being cooked again), get_recipes (whole recipes), get_past_plans, and get_shopping_list.',
    'Bring back meals from a past plan, one or all of them, to cook again (add_past_meals): their recipes go on the Plan tab and their ingredients into the shopping list. Take them off again with remove_past_meals.',
    'Change one meal on the plan or on the new plan waiting (set_meal): you write the whole meal, and the server checks it before it is saved.',
    'Make a new plan the way the app does (make_plan), accept it so it becomes the family\'s plan (accept_plan), or discard it (discard_draft).',
    'Tick items off the shopping list on this phone (tick_items), and open a recipe on the screen (show_meal).',
  ],
  rules: [
    'The allergy rules come first. Before you suggest or write any dish, check what the family never eats (the avoid list in get_meals; the note at the start of each message has it too), and never suggest anything with one of them in any form: oils, milks, flours, butters, sauces, garnishes, curry pastes. The app checks each meal word by word: ' + GROUP_WORDS + '; anything else on the list by its own name. Peanuts aren\'t tree nuts.',
    'Never write those words in a meal at all, not even to say it is free of them ("nut-free", "no coconut"): the check would turn it away. If set_meal answers avoid, it names what it found: write the meal again without it. Packaged foods can hide them, so say to check labels when it matters.',
    'Keep to the family\'s rules in everything you write: at least their number of vegetables in every meal (list them in veg; fruit counts at breakfast), and about their protein a person (estimate it honestly in protein). Weeknight dinners (Monday to Thursday) within their time.',
    'Meals is the family\'s, not one person\'s: the plan, the new plan waiting and the rules are shared, so everyone in the family sees what you change.',
    'Change one meal when asked, without asking first: it shows in the chat with an Undo. A whole plan is different: make_plan in place of a new plan already waiting, accept_plan and discard_draft ask the person first with a Yes / No card in the chat. If they say no, leave it.',
    'A meal you write is a whole recipe for the plan\'s number of people: US measures, amounts for everyone, staples (oil, salt, pepper, dried spices, flour, sugar) marked pantry, short steps in order, and a different dish and way of cooking from the plan\'s other meals.',
    '"What can I make with ...": suggest a few meals that keep to the rules; put one on the plan only when asked. When they want a plan, ask what you need to know one short question at a time (which meals, what they fancy, how many days, how many people), then make it.',
    'You can\'t change the family\'s rules or what they never eat (that is Settings, the gear, for the person to do), or add single items to the shopping list (it comes from the plan and the meals cooked again; Copy the list puts it in Notes). Ticks stay on this phone.',
    'Recipes, vegetables and protein are made and estimated by AI: say to check times, temperatures and labels when it matters.',
  ],
  bold: 'a meal or a day',
});
export const ipsyRequestHead = env => requestHead({ model: ipsyModelOf(env), system: IPSY_SYSTEM, tools: IPSY_CLIENT_TOOLS });

// ---- the route ----
async function body(request) {
  const t = await request.text();
  if (t.length > MAX_BODY) throw fail('too-big', 413);
  try { return JSON.parse(t || '{}'); } catch { throw fail('bad-json', 400); }
}
const histOf = (meals, at) => meals.filter(m => !m.leftover).map(m => ({ title: m.title, cuisine: m.cuisine || '', at }));
// A plan's log entry: what it was built around, and its meals' titles (leftovers left out)
const entryOf = p => ({ id: p.id, start: p.start, end: p.dates[p.dates.length - 1] || p.start, ...(p.foods ? { foods: p.foods, slots: p.slots } : { meat: p.meat, shop: p.shop }),
  people: p.people, titles: p.meals.filter(m => !m.leftover).map(m => m.title) });

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
    const settings = settingsOf(await getJSON(db, 'meals:settings'));
    if (route === 'state' && method === 'GET') {
      const plan = await getJSON(db, 'meals:plan'), draft = await getJSON(db, 'meals:draft'), log = (await getJSON(db, 'meals:log')) || [];
      return reply({ ai: aiOf(env), model: aiOf(env) ? modelOf(env) : null, settings, taste: tasteOf(await getJSON(db, 'meals:taste')), draft, plan, log, again: againOf(await getJSON(db, 'meals:again')) });
    }
    if (route === 'settings' && method === 'POST') {
      const b = await body(request), s = settingsOf({ ...settings, ...b });
      // What the family avoids is a safety rule: only the owner changes it. Everyone else's
      // other rules are kept, with the avoid list as it was; an avoid list of their own is refused.
      if (me.role !== 'owner' && 'avoid' in b && JSON.stringify(s.avoid) !== JSON.stringify(settings.avoid)) return reply({ error: 'owner-only' }, 403);
      if (me.role !== 'owner') s.avoid = settings.avoid;
      await putJSON(db, 'meals:settings', { ...s, at: Date.now() });
      return reply({ settings: s });
    }
    if (route === 'rate' && method === 'POST') {
      const b = await body(request), title = str(b.title, 100);
      if (!title) return reply({ error: 'title' }, 400);
      const t = tasteOf(await getJSON(db, 'meals:taste')), same = x => x.title.toLowerCase() !== title.toLowerCase();
      t.loved = t.loved.filter(same); t.nope = t.nope.filter(same);
      if (b.up === true) t.loved = [{ title, at: Date.now() }, ...t.loved].slice(0, 20);
      if (b.up === false) t.nope = [{ title, at: Date.now() }, ...t.nope].slice(0, 20);
      await putJSON(db, 'meals:taste', t);
      return reply({ taste: t });
    }
    if (route === 'again' && method === 'POST') {
      const b = await body(request), now = againOf(await getJSON(db, 'meals:again'));
      let again = now;
      if (Array.isArray(b.put)) {   // Undo: the list as it was, each entry checked again as it's added
        const put = b.put.slice(-AGAIN_MAX).map(x => x && typeof x === 'object' && /^a[a-z0-9]{1,20}$/.test(String(x.id)) && +x.at > 0
          ? { ...cleanMeal({ ...x, leftover: undefined }), id: x.id, from: str(x.from, 20), people: int(x.people, 1, 12, 0), at: Math.min(Math.round(+x.at), Date.now()), by: str(x.by, 60) } : null)
          .filter(x => x && x.title);
        const hits = avoidHits(planText(put), settings.avoid);
        if (hits.length) return reply({ error: 'avoid', hits }, 422);
        again = againOf(put);
      } else if (Array.isArray(b.remove)) {
        const ids = new Set(b.remove.map(String));
        again = now.filter(x => !ids.has(x.id));
      } else {
        const add = (Array.isArray(b.add) ? b.add : []).slice(0, AGAIN_MAX).filter(m => m && !m.leftover).map(m => cleanMeal({ ...m, leftover: undefined })).filter(Boolean);
        if (!add.length) return reply({ error: 'meal' }, 400);
        const hits = avoidHits(planText(add), settings.avoid);
        if (hits.length) return reply({ error: 'avoid', hits }, 422);
        const same = m => x => x.title.toLowerCase() === m.title.toLowerCase();
        const at = Date.now(), from = str(b.from, 20), people = int(b.people, 1, 12, 0);
        const fresh = add.filter((m, i) => !now.some(same(m)) && add.findIndex(same(m)) === i)
          .map((m, i) => ({ ...m, id: 'a' + (at + i).toString(36), from, people, at, by: me.name }));
        again = againOf([...now, ...fresh]);
      }
      await putJSON(db, 'meals:again', again);
      return reply({ again });
    }
    if (route === 'options' && method === 'POST') {
      if (!aiOf(env)) return reply({ error: 'no-ai' }, 503);
      if (!(await countAi(db, me))) return reply({ error: 'limit' }, 429);
      const b = await body(request), o = choicesOf(b, settings), history = (await getJSON(db, 'meals:history')) || [];
      const meals = await makeOptions(env, settings, o, history.slice(-30), tasteOf(await getJSON(db, 'meals:taste')), f);
      return reply({ options: { ...o, at: Date.now(), meals } });
    }
    if (route === 'plan' && method === 'POST') {
      if (!aiOf(env)) return reply({ error: 'no-ai' }, 503);
      if (!(await countAi(db, me))) return reply({ error: 'limit' }, 429);
      const b = await body(request), o = choicesOf(b, settings), history = (await getJSON(db, 'meals:history')) || [];
      // another go: different from the draft it replaces, as well as from what the family had
      const before = b.again ? ((await getJSON(db, 'meals:draft')) || {}).meals || [] : [];
      const p = await makePlan(env, settings, o, [...history.slice(-30), ...before.filter(m => !m.leftover).map(m => ({ title: m.title }))], tasteOf(await getJSON(db, 'meals:taste')), f, Math.random, picksOf(b));
      const draft = { at: Date.now(), by: me.name, ...o, ...p };
      await putJSON(db, 'meals:draft', draft);
      return reply({ draft });
    }
    if (route === 'accept' && method === 'POST') {
      const b = await body(request), draft = await getJSON(db, 'meals:draft');
      if (!draft) return reply({ error: 'no-draft' }, 409);
      const start = isDay(b.start) ? b.start : isDay(draft.start) ? draft.start : today();
      const days = Math.max(1, ...draft.meals.map(m => m.day || 1));
      const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
      const plan = { ...draft, id: 'p' + Date.now().toString(36), start, dates, acceptedAt: Date.now(), acceptedBy: me.name };
      const history = (await getJSON(db, 'meals:history')) || [];
      const log = (await getJSON(db, 'meals:log')) || [];
      const kept = [entryOf(plan), ...log].slice(0, 52);
      await putJSON(db, 'meals:log:' + plan.id, plan);
      for (const old of log.slice(51)) await db.delete('meals:log:' + old.id);
      await putJSON(db, 'meals:log', kept);
      await putJSON(db, 'meals:plan', plan);
      await putJSON(db, 'meals:history', [...history, ...histOf(plan.meals, plan.acceptedAt)].slice(-60));
      await db.delete('meals:draft');
      return reply({ plan, log: kept });
    }
    if (route === 'discard' && method === 'POST') {
      const b = await body(request);
      if (b.at) { const d = await getJSON(db, 'meals:draft'); if (d && d.at !== b.at) return reply({ error: 'changed' }, 409); }
      await db.delete('meals:draft');
      return reply({});
    }
    if (route === 'clear' && method === 'POST') {
      const b = await body(request), plan = await getJSON(db, 'meals:plan');
      if (plan && plan.id !== b.id) return reply({ error: 'changed' }, 409);
      await db.delete('meals:plan');
      return reply({ plan: null });
    }
    if (route === 'current' && method === 'POST') {
      const b = await body(request), now = await getJSON(db, 'meals:plan');
      if ((now ? now.id : null) !== (b.over || null)) return reply({ error: 'changed' }, 409);
      const plan = /^p[a-z0-9]{1,16}$/.test(String(b.id || '')) ? await getJSON(db, 'meals:log:' + b.id) : null;
      if (!plan) return reply({ error: 'not-found' }, 404);
      await putJSON(db, 'meals:plan', plan);
      return reply({ plan });
    }
    // ---- for Ipsy: one meal, a draft put back, an accept taken back (see the top) ----
    if (route === 'night' && method === 'POST') {
      const b = await body(request), key = b.draft ? 'meals:draft' : 'meals:plan', p = await getJSON(db, key);
      if (!p || !Array.isArray(p.meals) || !p.meals.length) return reply({ error: b.draft ? 'no-draft' : 'no-plan' }, 409);
      if (b.draft ? b.at && b.at !== p.at : b.id && b.id !== p.id) return reply({ error: 'changed' }, 409);
      const day = int(b.day, 1, 7, 0), slot = SLOTS.includes(b.slot) ? b.slot : 'dinner';
      const i = p.meals.findIndex(x => x.day === day && (x.slot || 'dinner') === slot);
      if (i < 0) return reply({ error: 'day' }, 400);
      const m = cleanMeal({ ...(b.meal && typeof b.meal === 'object' ? b.meal : {}), day, slot, leftover: undefined });
      if (!m) return reply({ error: 'meal' }, 400);
      const hits = avoidHits(planText([m]), settings.avoid);
      if (hits.length) return reply({ error: 'avoid', hits }, 422);
      const old = p.meals[i];
      // a lunch that is this dinner's leftovers follows it
      p.meals = p.meals.map((x, j) => j === i ? m : slot === 'dinner' && x.leftover === day ? leftoverOf(m, x.day) : x);
      await putJSON(db, key, p);
      if (b.draft) return reply({ draft: p });
      // the accepted plan: its copy in the log, its titles there, and the history new plans differ from
      const log = (await getJSON(db, 'meals:log')) || [], e = log.find(x => x.id === p.id);
      if (p.id && e) { e.titles = entryOf(p).titles; await putJSON(db, 'meals:log:' + p.id, p); await putJSON(db, 'meals:log', log); }
      const history = (await getJSON(db, 'meals:history')) || [], h = history.find(x => x.at === p.acceptedAt && x.title === old.title);
      if (h) { h.title = m.title; h.cuisine = m.cuisine; await putJSON(db, 'meals:history', history); }
      return reply({ plan: p, log });
    }
    if (route === 'draft' && method === 'POST') {
      const b = await body(request), d = b.draft && typeof b.draft === 'object' ? b.draft : {}, now = await getJSON(db, 'meals:draft');
      if (now && now.at !== b.over) return reply({ error: 'changed' }, 409);
      const p = cleanPlan(d);
      if (!p.meals.length) return reply({ error: 'meal' }, 400);
      const hits = avoidHits(planText(p.meals), settings.avoid);
      if (hits.length) return reply({ error: 'avoid', hits }, 422);
      const at = +d.at > 0 && +d.at <= Date.now() ? Math.round(+d.at) : Date.now();
      const o = choicesOf({ ...d, days: Math.max(...p.meals.map(m => m.day)) }, settings);
      if (!Array.isArray(d.slots)) o.slots = [...new Set(p.meals.map(m => m.slot))];
      const draft = { at, by: me.name, ...o, ...(isDay(d.start) ? { start: d.start } : {}), ...p };
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
      const { id, dates, acceptedAt, acceptedBy, ...draft } = plan;
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
    return reply({ error: e.status ? e.message : 'server', ...(e.until ? { until: e.until } : {}) }, e.status || 500);
  }
}
