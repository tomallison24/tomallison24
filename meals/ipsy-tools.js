"use strict";

// Ipsy's tools in Meals (in every design). Claude asks for them by name through
// functions/meals/api (IPSY_CLIENT_TOOLS describes them to it); they run here, on the phone,
// and what they return goes back to Claude. Every change comes back with an undo for the
// chat's Undo button.
//
//   window.MealsIpsy(app) -> the options for AllisonOS.ipsy.mount (tools, label, context, words)
//   app: the app's own pieces (meals/app.js passes them): data (the family's Meals as the app
//        has it), api (its server calls), keep (its save: this phone's copy, the Sheet, the
//        screen), say, toast, L (logic.js), shopOf, shop (the List's: the plan and the meals
//        cooked again), whenWords, dayLabel, dateOf, slotName, about, past (a past plan, whole),
//        state, today, planning, ticked, setTicks, show, screen
//
// The plan, the new plan waiting (the draft) and the family's rules are the family's, on the
// family server. Ipsy changes the plans only through the app's own server calls (night, plan,
// accept, discard, and draft and unaccept for Undo), so the server's allergy check and every
// other rule there applies to what it saves; nothing is checked or saved here. A whole plan
// (a new plan in place of one waiting, accepting, discarding) is asked first in the chat.
// Ticks are this phone's, as in the app.
window.MealsIpsy = function (app) {
  const copy = o => JSON.parse(JSON.stringify(o));
  const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
  const ymd = s => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && !isNaN(Date.parse(s + 'T12:00:00Z'));
  const fail = msg => { throw new Error(msg); };
  const SLOTS = ['breakfast', 'lunch', 'dinner'], FOODS = ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'fish', 'shrimp', 'vegetarian', 'surprise'];
  const D = () => app.data;
  const has = p => !!(p && Array.isArray(p.meals) && p.meals.length);
  const planOf = which => which === 'draft' ? D().draft : D().plan;
  const join = a => a.length <= 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const slotOf = m => m.slot || 'dinner';

  // The app's own server calls. What the server turns away comes back as words for Claude.
  const WHY = {
    avoid: b => 'Nothing was saved: the family never eats ' + join(b.hits || ['something in it']) + ', and the meal had it. Write it again without it, and without naming it.',
    changed: () => 'Nothing was changed: someone in the family changed it in the meantime. Look again first.',
    draft: () => 'Nothing was changed: a new plan is waiting now. Discard or accept it first.',
    'no-draft': () => 'There’s no new plan waiting.',
    'no-plan': () => 'There’s no plan yet.',
    meal: () => 'A meal needs a title, ingredients and steps.',
    day: () => 'That meal isn’t in the plan.',
  };
  async function call(path, body) {
    try { return await app.api(path, body); }
    catch (e) { throw new Error(WHY[e.code] ? WHY[e.code](e.body || {}) : app.say(e.code)); }
  }
  // An undo that goes to the server: it says so here if it couldn't.
  const later = (what, job) => () => { const p = job(); p.catch(e => app.toast('Couldn’t undo ' + what + '. ' + e.message, null, 8000)); return p; };

  // ---- how the family's Meals is shown to Claude ----
  const sum = p => p.meals.length + ' meals (' + app.about(p) + ')';
  const short = (p, m) => ({ day: m.day || 1, ...(app.dateOf(p, m.day || 1) ? { date: app.dateOf(p, m.day || 1) } : {}), meal: slotOf(m), title: m.title,
    ...(m.leftover ? { leftoversOfDay: m.leftover } : { cuisine: m.cuisine, minutes: m.minutes }), ...(m.veg ? { vegetables: m.veg.length } : {}), ...(m.protein ? { proteinGramsAPerson: m.protein } : {}) });
  const whole = (p, m) => ({ ...short(p, m), ...(m.leftover ? {} : { method: m.method, why: m.why, vegetables: m.veg || [], ...(m.fridge && m.fridge.length ? { usesFromTheFridge: m.fridge } : {}),
    ...(m.courses ? { courses: m.courses.map(c => c.course + ': ' + c.title) } : {}),
    ingredients: m.ingredients.map(x => (x.qty ? x.qty + ' ' : '') + x.item + (x.pantry ? ' (pantry)' : '') + (x.course ? ' (' + x.course + ')' : '')), steps: m.steps }) });
  const head = p => ({ ...(p.id ? { id: p.id } : {}), builtAround: p.foods || [p.meat], meals: p.slots || ['dinner'], people: p.people, ...(p.lunches ? { lunches: p.lunches } : {}), ...(p.courses && p.courses !== 'main' ? { courses: p.courses } : {}),
    ...(p.fridge ? { fridge: p.fridge } : {}), ...(p.note ? { asked: p.note } : {}), ...(p.acceptedBy ? { acceptedBy: p.acceptedBy } : p.by ? { plannedBy: p.by } : {}), ...(p.tip ? { tip: p.tip } : {}) });
  const brief = p => ({ ...head(p), schedule: p.meals.map(m => short(p, m)) });
  const label = (p, m) => app.dateOf(p, m.day || 1) ? app.dayLabel(app.dateOf(p, m.day || 1)) + ' ' + slotOf(m) : 'Day ' + (m.day || 1) + ' ' + slotOf(m);
  const which = q => q.plan === 'draft' ? 'draft' : 'current';
  const need = w => { const p = planOf(w); if (!has(p)) fail(w === 'draft' ? 'There’s no new plan waiting.' : 'There’s no plan yet: make one first.'); return p; };
  const find = (p, q) => {
    const day = q.day, slot = SLOTS.includes(q.slot) ? q.slot : 'dinner';
    const i = Number.isInteger(day) ? p.meals.findIndex(m => (m.day || 1) === day && slotOf(m) === slot) : -1;
    if (i < 0) fail('That plan has no ' + slot + ' on day ' + day + '. Its meals: ' + p.meals.map(m => 'day ' + (m.day || 1) + ' ' + slotOf(m)).join(', ') + '.');
    return i;
  };

  const tools = {
    async get_meals() {
      const d = D(), s = d.settings || {}, t = d.taste || { loved: [], nope: [] }, state = app.state();
      return { content: {
        today: app.today(),
        plan: has(d.plan) ? brief(d.plan) : null,
        draft: has(d.draft) ? { ...brief(d.draft), saved: false } : null,
        rules: { vegetablesInEveryMeal: s.veg, proteinAPerson: s.protein, usuallyCookingFor: s.people, weeknightDinnerMinutes: s.weeknight || 'no limit' },
        avoid: s.avoid || [],
        loved: t.loved.map(x => x.title), neverAgain: t.nope.map(x => x.title),
        pastPlans: (d.log || []).length,
        cookingAgain: (d.again || []).map(m => ({ title: m.title, meal: slotOf(m), ...(m.by ? { addedBy: m.by } : {}) })),
        ...(d.ai === null && state === 'ok' ? { ai: 'Meals’ AI key isn’t set up yet, so make_plan won’t work.' } : {}),
        ...(state !== 'ok' && state !== 'loading' ? { note: 'Meals couldn’t reach the family server just now: this is the copy on this phone.' } : {}),
      } };
    },

    async get_recipes(q) {
      let p;
      if (q.plan === 'current' || q.plan === 'draft') p = need(which(q));
      else {
        const id = clip(q.plan, 20); if (!/^p[a-z0-9]{1,16}$/.test(id)) fail('plan is current, draft, or a past plan’s id from get_past_plans.');
        try { p = await app.past(id); } catch (e) { fail(e.code === 'not-found' ? 'No past plan with id ' + id + '.' : app.say(e.code)); }
        if (!has(p)) fail('No past plan with id ' + id + '.');
      }
      const want = Array.isArray(q.days) && q.days.length ? new Set(q.days) : null;
      return { content: { ...head(p), meals: p.meals.filter(m => !want || want.has(m.day || 1)).map(m => whole(p, m)) } };
    },

    async get_past_plans(q) {
      const limit = Math.max(1, Math.min(52, Number.isInteger(q.limit) ? q.limit : 12)), cur = D().plan && D().plan.id;
      const log = D().log || [];
      return { content: { total: log.length, plans: log.slice(0, limit).map(e => ({ id: e.id, from: e.start, to: e.end, builtAround: e.foods || [e.meat], people: e.people, meals: e.titles, ...(e.id === cur ? { current: true } : {}) })) } };
    },

    async get_shopping_list() {
      const p = D().plan, again = D().again || [];
      if (!has(p) && !again.length) return { content: { sections: [], note: D().draft ? 'No accepted plan yet: the list comes once the new plan is accepted.' : 'No plan yet, and no past meals being cooked again.' } };
      const s = app.shop(), done = new Set(app.ticked());
      const row = x => ({ item: x.item, ...(x.amounts.length ? { amount: app.L.total(x.amounts) } : {}), for: app.whenWords(x, has(p) ? p : null), ...(done.has(x.key) ? { ticked: true } : {}) });
      return { content: { plan: (has(p) && p.id) || '', sections: app.L.sections(s.buy, x => x.item).map(g => ({ section: g.name, items: g.items.map(row) })), youProbablyHave: s.pantry.map(row) } };
    },

    async tick_items(q) {
      if (!has(D().plan) && !(D().again || []).length) fail('There’s no shopping list yet: no plan has been accepted.');
      const s = app.shop(), list = [...s.buy, ...s.pantry], norm = t => String(t || '').toLowerCase().trim();
      const before = app.ticked(), keys = new Set(before), on = q.ticked !== false, found = [], missing = [];
      for (const name of (Array.isArray(q.items) ? q.items : []).slice(0, 200)) {
        const x = list.find(i => norm(i.item) === norm(name) || i.key === norm(name));
        if (!x) { missing.push(clip(name, 60)); continue; }
        found.push(x.item); if (on) keys.add(x.key); else keys.delete(x.key);
      }
      if (!found.length) fail('None of those are on the list' + (missing.length ? ': ' + missing.join(', ') : '') + '. Use the names get_shopping_list gives.');
      app.setTicks([...keys]);
      return { content: { [on ? 'ticked' : 'unticked']: found, ...(missing.length ? { notOnTheList: missing } : {}) },
        change: { text: (on ? 'Ticked off ' : 'Unticked ') + (found.length > 3 ? found.length + ' items' : join(found)), undo: () => app.setTicks(before) } };
    },

    async set_meal(q) {
      const w = which(q), p = need(w), i = find(p, q);
      if (!q.meal || typeof q.meal !== 'object') fail('Give the whole meal: title, ingredients and steps.');
      const old = copy(p.meals[i]), name = label(p, old), who = w === 'draft' ? { draft: true, at: p.at } : { id: p.id };
      const put = async meal => {
        const j = await call('night', { ...who, day: old.day || 1, slot: slotOf(old), meal });
        app.keep(w === 'draft' ? { draft: j.draft } : { plan: j.plan, log: j.log });
        return w === 'draft' ? j.draft : j.plan;
      };
      const now = await put(q.meal), m = now.meals[find(now, { day: old.day || 1, slot: slotOf(old) })];
      return { content: { plan: w, meal: whole(now, m) },
        change: { text: name + (w === 'draft' ? ' of the new plan' : '') + ': ' + old.title + ' → ' + m.title, undo: later(name, () => put(old)) } };
    },

    async make_plan(q, { confirm }) {
      const d = D(), before = has(d.draft) ? copy(d.draft) : null;
      const int = (v, lo, hi, dflt) => Number.isInteger(v) && v >= lo && v <= hi ? v : dflt;
      const slots = SLOTS.filter(s => Array.isArray(q.meals) && q.meals.includes(s)), foods = (Array.isArray(q.foods) ? q.foods : []).filter(f => FOODS.includes(f));
      const ask = { slots: slots.length ? slots : ['dinner'], foods: foods.length ? foods : ['surprise'], days: int(q.days, 1, 7, 3),
        people: int(q.people, 1, 10, (d.settings && d.settings.people) || 4), start: ymd(q.start) ? q.start : app.today(),
        lunches: ['leftovers', 'fresh', 'mix'].includes(q.lunches) ? q.lunches : 'leftovers', courses: ['main', 'starter', 'dessert', 'all'].includes(q.courses) ? q.courses : 'main', fridge: clip(q.fridge, 300), note: clip(q.note, 200), ...(before && q.again ? { again: true } : {}) };
      if (before && !(await confirm('Make a new plan in place of the one waiting (' + sum(before) + (before.by ? ', by ' + before.by : '') + ')? Everyone in the family sees the change.',
        { yes: 'Yes, make a new one', no: 'No, keep it' }))) return { content: { made: false, note: 'They said no, so the new plan waiting is as it was.' } };
      app.planning(ask);
      let j;
      try { j = await call('plan', ask); } finally { app.planning(null); }
      const made = j.draft;
      app.keep({ draft: made });
      return { content: { draft: brief(made), saved: false, note: 'Not saved yet: it waits as the new plan until it is accepted (accept_plan, or Accept plan in the app).' },
        change: { text: 'Made a new plan: ' + sum(made) + ' (not saved yet)', undo: later('the new plan', async () => {
          if (before) { const r = await call('draft', { draft: before, over: made.at }); app.keep({ draft: r.draft }); }
          else { await call('discard', { at: made.at }); app.keep({ draft: null }); }
        }) } };
    },

    async accept_plan(q, { confirm }) {
      const d = need('draft'), today = app.today(), start = q.start == null || q.start === '' ? (ymd(d.start) && d.start >= today ? d.start : today) : q.start;
      if (!ymd(start)) fail('start is a day, YYYY-MM-DD.');
      const off = (Date.parse(start + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 864e5;
      if (off < -7 || off > 30) fail('start should be from a week ago to a month from today.');
      const cur = has(D().plan) ? D().plan : null;
      const ok = await confirm('Save the new plan (' + sum(d) + ') for the family, from ' + app.dayLabel(start) + '?'
        + (cur ? ' It takes the place of the current plan (' + sum(cur) + ') for everyone.' : ' Everyone in the family sees it.'),
        { yes: 'Yes, save it', no: 'Not yet' });
      if (!ok) return { content: { accepted: false, note: 'They said no, so the new plan is still waiting.' } };
      const j = await call('accept', { start });
      app.keep({ plan: j.plan, log: j.log, draft: null });
      return { content: { accepted: true, plan: brief(j.plan) },
        change: { text: 'Saved the new plan for the family, from ' + app.dayLabel(start), undo: later('saving the plan', async () => {
          const r = await call('unaccept', { id: j.plan.id });
          app.keep({ plan: r.plan, log: r.log, draft: r.draft });
        }) } };
    },

    async discard_draft(q, { confirm }) {
      const d = need('draft'), before = copy(d);
      if (!(await confirm('Discard the new plan waiting (' + sum(d) + (d.by ? ', by ' + d.by : '') + ')? It goes for everyone in the family; the current plan stays.',
        { yes: 'Yes, discard it', no: 'No, keep it' }))) return { content: { discarded: false, note: 'They said no, so the new plan is still waiting.' } };
      await call('discard', { at: d.at });
      app.keep({ draft: null });
      return { content: { discarded: true },
        change: { text: 'Discarded the new plan (' + sum(before) + ')', undo: later('the discard', async () => {
          const r = await call('draft', { draft: before });
          app.keep({ draft: r.draft });
        }) } };
    },

    async add_past_meals(q) {
      const id = clip(q.plan, 20); if (!/^p[a-z0-9]{1,16}$/.test(id)) fail('plan is a past plan’s id from get_past_plans.');
      let p; try { p = await app.past(id); } catch (e) { fail(e.code === 'not-found' ? 'No past plan with id ' + id + '.' : app.say(e.code)); }
      if (!has(p)) fail('No past plan with id ' + id + '.');
      const want = Array.isArray(q.meals) && q.meals.length ? q.meals.map(x => p.meals[find(p, x || {})]) : p.meals;
      const cook = want.filter(m => m && !m.leftover && (m.ingredients || []).length);
      if (!cook.length) fail('Those are leftover lunches, with no recipe of their own: bring back the dinner they came from.');
      const before = copy(D().again || []), on = t => before.some(x => x.title.toLowerCase() === t.toLowerCase());
      const add = cook.filter(m => !on(m.title));
      if (!add.length) return { content: { added: [], note: 'They’re all being cooked again already.' } };
      const j = await call('again', { add, from: p.id || '', people: p.people });
      app.keep({ again: j.again });
      const titles = add.map(m => m.title);
      return { content: { added: titles, cookingAgain: j.again.map(m => m.title), note: 'On the Plan tab with their recipes, and their ingredients are in the shopping list.' },
        change: { text: 'Cooking again: ' + (titles.length > 3 ? titles.length + ' meals' : join(titles)), undo: later('cooking those again', async () => {
          const r = await call('again', { put: before }); app.keep({ again: r.again });
        }) } };
    },

    async remove_past_meals(q) {
      const before = copy(D().again || []), norm = t => String(t || '').toLowerCase().trim();
      const names = (Array.isArray(q.titles) ? q.titles : []).map(norm);
      const gone = before.filter(m => names.includes(norm(m.title)));
      if (!gone.length) fail('None of those are being cooked again. They are: ' + (before.map(m => m.title).join('; ') || 'none') + '.');
      const j = await call('again', { remove: gone.map(m => m.id) });
      app.keep({ again: j.again });
      return { content: { removed: gone.map(m => m.title) },
        change: { text: 'Off the list: ' + join(gone.map(m => m.title)), undo: later('taking those off', async () => {
          const r = await call('again', { put: before }); app.keep({ again: r.again });
        }) } };
    },

    async show_meal(q) {
      const p = need(which(q)), i = find(p, q);
      app.show(p, i);
      return { content: { shown: label(p, p.meals[i]) + ': ' + p.meals[i].title, note: 'It is open behind the chat; closing the chat shows it.' } };
    },
  };

  const LABELS = {
    get_meals: () => 'Looking at the family’s meals', get_recipes: () => 'Reading the recipes',
    get_past_plans: () => 'Looking at past plans', get_shopping_list: () => 'Reading the shopping list',
    tick_items: i => i.ticked === false ? 'Unticking the list' : 'Ticking off the list', set_meal: i => 'Changing ' + (SLOTS.includes(i.slot) ? i.slot : 'dinner') + (Number.isInteger(i.day) ? ' on day ' + i.day : ''),
    make_plan: i => 'Planning the meals (' + ((i.days || 3) * ((i.meals || ['dinner']).length || 1) > 6 ? 'about a minute' : 'about half a minute') + ')', accept_plan: () => 'Saving the plan',
    discard_draft: () => 'Discarding the new plan', show_meal: () => 'Opening the recipe',
    add_past_meals: () => 'Bringing back past meals', remove_past_meals: () => 'Taking meals off the list',
  };

  return {
    tools,
    label: (name, input) => (LABELS[name] || (() => ''))(input || {}),
    context() {
      const d = D(), p = has(d.plan) ? d.plan : null, dr = has(d.draft) ? d.draft : null, s = d.settings || {}, avoid = s.avoid || [], state = app.state();
      const when = p && p.dates && p.dates.length ? ', ' + app.dayLabel(p.dates[0]) + ' to ' + app.dayLabel(p.dates[p.dates.length - 1]) : '';
      return 'Meals: ' + (p ? 'the family’s plan is ' + sum(p) + when : 'no plan yet') + (dr ? '; a new plan (' + sum(dr) + ') is waiting to be accepted' : '') + '. '
        + 'Rules: at least ' + s.veg + ' vegetables and ' + s.protein + ' protein in every meal, cooking for ' + s.people + '. '
        + 'Never in a plan: ' + (avoid.length ? avoid.join(', ') : 'nothing listed') + '. On screen: ' + app.screen() + '.'
        + (state !== 'ok' && state !== 'loading' ? ' Meals couldn’t reach the family server just now.' : '');
    },
    intro: 'Hi, I’m Ipsy! Tell me what you fancy and I’ll plan the meals, swap one, or say what you can make with what’s in the fridge, always with plenty of vegetables and protein, and never what the family can’t eat.',
    placeholder: 'Ask Ipsy about meals',
    suggestions: ['What’s for dinner tonight?', 'Plan a week of lamb and chicken dinners', 'Swap Thursday for something quicker', 'What can I make with eggs and spinach?'],
    consent: 'Ipsy runs on Claude, by Anthropic: what you ask, and the plans it reads, go there through the family server. Everyone in the family sees its changes, each with Undo, and it asks first before replacing a whole plan.',
  };
};
