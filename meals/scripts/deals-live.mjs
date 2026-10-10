// A real deals search, as Meals' "Find this week's deals" makes it, run from
// GitHub Actions (.github/workflows/meals-check.yml) with the ANTHROPIC_API_KEY
// secret - to see how well the web search finds a store's weekly sales before
// the family relies on it. Prints what it found, sorted into grocery sections,
// where it found it, and what the search cost. Saves nothing.
//   ANTHROPIC_API_KEY=… node meals/scripts/deals-live.mjs <store id, or a store and its address> [member: yes|no]
//   (store ids: functions/meals/api STORES - wholefoods, harristeeter, publix, …)
import fs from 'fs';
import '../../home/aisles.js';
import '../logic.js';
import { ask, json, cleanDeals, dealsAsk, week, modelOf, STORES } from '../../functions/meals/api/[[route]].js';

const arg = process.argv[2] || 'wholefoods';
const known = STORES.find(x => x.id === arg.trim().toLowerCase());
const store = known || { id: 'other', name: arg, where: arg };
const member = process.argv[3] !== 'no';
const env = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, MEALS_MODEL: process.env.MEALS_MODEL };
if (!env.ANTHROPIC_API_KEY) { console.error('No ANTHROPIC_API_KEY.'); process.exit(1); }

// count what it used, from the API's own answers
const use = { input: 0, output: 0, searches: 0, calls: 0 };
const counting = async (url, init) => {
  const r = await fetch(url, init);
  const j = await r.clone().json().catch(() => ({}));
  use.calls++;
  if (!r.ok) console.log('API answered ' + r.status + ': ' + JSON.stringify(j).slice(0, 400));
  const u = j.usage || {};
  use.input += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  use.output += u.output_tokens || 0;
  use.searches += (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
  return r;
};

const wk = week(), t0 = Date.now();
let d, raw = '';
try { raw = await ask(env, dealsAsk(store, wk, '', member), counting); d = cleanDeals(json(raw)); }
catch (e) { console.log('Failed: ' + e.message + (raw ? '\nIts answer began: ' + raw.slice(0, 600) : '')); process.exit(1); }
const secs = Math.round((Date.now() - t0) / 1000);
// Haiku 5.5: $0.10 in / $0.50 out per million tokens (under 100,000 a prompt); web search $10 per 1,000
const cost = use.input / 1e6 * 0.10 + use.output / 1e6 * 0.50 + use.searches * 0.01;

const L = globalThis.MealsLogic;
const lines = [`## ${store.where}`, '',
  `Sales week from Wednesday ${wk}; the deals say ${d.validFrom || '?'} to ${d.validTo || '?'}. ${store.cardName && member ? store.cardName + ' card' : 'Everyone\'s'} prices. Model ${modelOf(env)}.`, '',
  `**${d.items.length} food deals**, in ${secs} s: ${use.searches} web searches, ${use.input.toLocaleString('en-US')} tokens in, ${use.output.toLocaleString('en-US')} out, about ${(cost * 100).toFixed(1)}¢.`, ''];
for (const g of L.sections(d.items, x => x.name)) {
  lines.push(`**${g.name}**`);
  for (const x of g.items) lines.push(`- ${x.name}: ${x.price || '?'}${x.regular ? ' (usually ' + x.regular + ')' : ''}${x.member ? ' · ' + (store.cardName || 'member') : ''}${x.note ? ' · ' + x.note : ''}`);
  lines.push('');
}
lines.push('**Found on:** ' + (d.sources.length ? d.sources.join(', ') : 'no sources given'));
const out = lines.join('\n');
console.log(out);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + '\n');
