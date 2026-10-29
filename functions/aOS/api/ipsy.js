// /aOS/api/ipsy - Ipsy in aOS (aOS 2's Home): one helper across the apps that have Ipsy.
//
//   POST ipsy   { messages } -> Anthropic's answer, as it comes (one step of Ipsy's chat, server/ipsy.js)
//
// Every app inside aOS lives on the same phone storage (aOS/home-tab.js), so Ipsy in aOS can use each
// app's own tools: aOS opens the app out of sight and runs the tool there, with the app's data and
// its rules. Here, those tools are the apps' own (IPSY_CLIENT_TOOLS of each app's route), each named
// with its app in front and two underscores ("travel__search_gmail": Calendar, Orders and Travel each
// have a search_gmail of their own, with their own Gmail sign-in); and Ipsy's instructions are each
// app's own (IPSY_SYSTEM), under a part about working across them.
//
// Not Fitness: Ipsy in aOS searches the web, and Fitness keeps health data out of web searches (its
// own Ipsy has no web search at all). Asked about it, Ipsy says so and points to Fitness's own Ipsy.
// Not Money either: its data is shared only with whom its reader picks, and stays in Money's own Ipsy.
// Weather (and Home) have no chat of their own: their tools come from server/ipsy-<app>.js, and run
// inside the app, offered as AllisonOS.ipsyTools (aOS/home-tab.js).
//
// Claude Sonnet 5.5, as in the apps (AOS_IPSY_MODEL, a Pages secret, names another). Signed-in family
// only, IPSY_DAILY new questions a person a day (aos:ipsy:<user id>:<day>, gone after two days) and the steps
// they take (aos:ipsy:steps:<user id>:<day>, server/ipsy.js).
// This is more specific than [[route]].js, so /aOS/api/ipsy comes here; the accounts API is unchanged.
import { reply, kv, sessionUser } from '../../../server/auth.js';
import { T, modelOf, requestHead, ipsyStep } from '../../../server/ipsy.js';
import * as calendar from '../../calendar/api/[[route]].js';
import * as notes from '../../notes/api/[[route]].js';
import * as meals from '../../meals/api/[[route]].js';
import * as orders from '../../orders/api/[[route]].js';
import * as travel from '../../travel/api/[[route]].js';
import * as news from '../../news/api/[[route]].js';
import * as weather from '../../../server/ipsy-weather.js';   // no chat of their own: tools for this one only
import * as house from '../../../server/ipsy-house.js';

// the apps Ipsy works across in aOS, in the order Claude reads about them
export const IPSY_APPS = { calendar: ['Calendar', calendar], notes: ['Notes', notes], meals: ['Meals', meals], orders: ['Orders', orders], travel: ['Travel', travel], news: ['News', news], weather: ['Weather', weather], house: ['Home', house] };
export const SEP = '__';

// search_apps is aOS's own (aOS/home-tab.js): one look across what's on the phone, before an app's own tools.
export const SEARCH_APPS = T('search_apps', 'Search every app on this phone at once (Calendar, Notes and reminders, Travel, Orders, Meals, Places, Podcasts) for a word or name: each match\'s app, title and a line about it. Use it first when a question names something and you don\'t know which app has it; then the app\'s own tools for details. Anything marked Private is never searched.', {
  query: { type: 'string', description: 'A word or two, e.g. "Sophie", "dentist", "Lisbon", "costco"' },
}, ['query']);
export const IPSY_CLIENT_TOOLS = [SEARCH_APPS, ...Object.entries(IPSY_APPS).flatMap(([id, [name, m]]) =>
  m.IPSY_CLIENT_TOOLS.map(t => ({ ...t, name: id + SEP + t.name, description: `(${name}) ${t.description}` })))];

const names = Object.values(IPSY_APPS).map(([n]) => n);
const list = names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];

export const IPSY_SYSTEM = `You are Ipsy, the friendly helper in aOS: the home of the Allison family's apps on their iPhones, where every app opens. Each person picks what you look like (Mia, the family's Australian Shepherd, a fox, an owl, a hedgehog, or an AI made of light that builds shapes and tools out of code) and can give you a name of your own; the app says which at the start of each question. Answer to that name, and keep the character light, never at length.

In aOS you work across ${list} at once, with each app's own tools. A tool's name starts with its app and two underscores: calendar${SEP}find_events, notes${SEP}find_notes, travel${SEP}search_gmail. Use them together when a question crosses apps (a trip and the calendar, the week's dinners and the grocery list, an order arriving while the family is away), and say which app each thing comes from when it helps. When a question names someone or something and you don't know which app has it, search_apps first: one look across all of them, quicker than asking each app.

Below is how you work inside each app, written for Ipsy in that app. Its rules hold for its tools here too. It names its tools without the app in front; here, always call them with it (notes${SEP}find_notes, never find_notes). Where it says "the app", it means that app.

What isn't here:
- Fitness (workouts, steps, meds, health). Ipsy in aOS can search the web, and Fitness keeps health data out of web searches, so its data stays in Fitness. If a question needs Fitness, say that plainly in a line or two, and that they can ask Ipsy inside Fitness, which reads their log there and never searches the web. Don't guess at their health or workout data, and never put health details in a web search.
- Money (the family's spending). Its data stays in Money, with whoever the person who reads it has shared it with. If a question needs Money, say so in a line, and that they can ask Ipsy inside Money. Don't guess at their spending.
- Places and Podcasts you can only search (search_apps). Clock, Drinks and Mail have no tools for you yet. Say so if a question needs their data, and point to the app. You can still use the web for general things (opening hours).

Each of the person's messages starts with a note from aOS in [brackets]: today's date and what's on their screen. aOS adds it; the person didn't type it.
Replies: short and friendly, in plain US English, dates like "Oct 9" and times like "3:30 PM". Use "- " at the start of a line for a list. No headings, tables or other markdown, except **bold** for a name. Say in a line what you changed, and in which app.

${Object.values(IPSY_APPS).map(([name, m]) => `===== Ipsy in ${name} =====\n${m.IPSY_SYSTEM}`).join('\n\n')}`;

export const ipsyModelOf = env => modelOf(env, 'AOS_IPSY_MODEL');
export const ipsyRequestHead = env => requestHead({ model: ipsyModelOf(env), system: IPSY_SYSTEM, tools: IPSY_CLIENT_TOOLS });

export async function onRequest({ request, env }, f = fetch) {
  if (request.headers.get('X-Aos') !== '1' || request.method.toUpperCase() !== 'POST') return reply({ error: 'not-found' }, 404);
  const db = kv(env);
  if (!db || !(await db.get('owner'))) return reply({ error: 'accounts-off' }, 503);
  const me = await sessionUser(db, request);
  if (!me) return reply({ error: 'signin' }, 401);
  if (!env.ANTHROPIC_API_KEY) return reply({ error: 'no-ai' }, 503);
  return ipsyStep({ env, request, db, me, app: 'aos', head: ipsyRequestHead(env) }, f);
}
