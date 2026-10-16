"use strict";

// Ipsy's tools in Meals (in both its designs). Claude asks for them by name through
// functions/meals/api (IPSY_CLIENT_TOOLS describes them to it); they run here, on the phone,
// and what they return goes back to Claude. Every change comes back with an undo for the
// chat's Undo button.
//
//   window.MealsIpsy(app) -> the options for AllisonOS.ipsy.mount (tools, label, context, words)
//   app: the app's own pieces (meals/app.js passes them): data (the family's Meals as the app
//        has it), api (its server calls), keep (its save: this phone's copy, the Sheet, the
//        screen), say, toast, L (logic.js), storeById, mine, shopOf, dayLabel,
//        past (a past plan, whole), state, today, planning, ticked, setTicks, show, screen
//
// The plan, the new plan waiting (the draft), the deals and the settings are the family's,
// on the family server. Ipsy changes them only through the app's own server calls (night,
// plan, accept, discard, and draft and unaccept for Undo), so the server's allergy check and
// every other rule there applies to what it saves; nothing is checked or saved here. A whole
// week (a new plan in place of one waiting, accepting, discarding) is asked first in the chat.
// Ticks are this phone's, as in the app.
window.MealsIpsy = function (app) {
  const copy = o => JSON.parse(JSON.stringify(o));
  const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
  const ymd = s => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && !isNaN(Date.parse(s + 'T12:00:00Z'));
  const fail = msg => { throw new Error(msg); };
  const MEATS = ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'salmon', 'white fish', 'shrimp', 'on sale'];
  const D = () => app.data;
  const has = p => !!(p && Array.isArray(p.meals) && p.meals.length);
  const planOf = which => which === 'draft' ? D().draft : D().plan;
  const thisWeek = id => { const d = (D().deals || {})[id]; return d && d.week === D().week && d.items && d.items.length ? d : null; };
  const join = a => a.length <= 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

  // The app's own server calls. What the server turns away comes back as words for Claude.
  const WHY = {
    avoid: b => 'Nothing was saved: the family never eats ' + join(b.hits || ['something in it']) + ', and the dinner had it. Write it again without it, and without naming it.',
    changed: () => 'Nothing was changed: someone in the family changed it in the meantime. Look again first.',
    draft: () => 'Nothing was changed: a new plan is waiting now. Discard or accept it first.',
    'no-draft': () => 'There’s no new plan waiting.',
    'no-plan': () => 'There’s no plan yet.',
    meal: () => 'A dinner needs a title, ingredients and steps.',
    day: () => 'That night isn’t in the plan.',
  };
  async function call(path, body) {
    try { return await app.api(path, body); }
    catch (e) { throw new Error(WHY[e.code] ? WHY[e.code](e.body || {}) : app.say(e.code)); }
  }
  // An undo that goes to the server: it says so here if it couldn't.
  const later = (what, job) => () => { const p = job(); p.catch(e => app.toast('Couldn’t undo ' + what + '. ' + e.message, null, 8000)); return p; };

  // ---- how the family's Meals is shown to Claude ----
  const shopName = p => !p.shop || p.shop === 'all' ? 'best deals, any store' : (app.storeById(p.shop) || { name: p.shop }).name;
  const sum = p => p.meals.length + ' ' + (p.meat === 'on sale' ? 'dinners around what’s on sale' : p.meat + ' dinners') + ' for ' + p.people;
  const short = (p, m, i) => ({ night: m.day, ...(p.dates && p.dates[i] ? { date: p.dates[i] } : {}), title: m.title, cuisine: m.cuisine, method: m.method, minutes: m.minutes });
  const whole = (p, m, i) => ({ ...short(p, m, i), why: m.why, ...(m.uses && m.uses.length ? { usesSales: m.uses } : {}), ingredients: m.ingredients.map(x => (x.qty ? x.qty + ' ' : '') + x.item + (x.pantry ? ' (pantry)' : '')), steps: m.steps });
  const head = p => ({ ...(p.id ? { id: p.id } : {}), meat: p.meat, people: p.people, shop: shopName(p), ...(p.note ? { asked: p.note } : {}),
    ...(p.acceptedBy ? { acceptedBy: p.acceptedBy } : p.by ? { plannedBy: p.by } : {}), ...(p.tip ? { tip: p.tip } : {}) });
  const brief = p => ({ ...head(p), nights: p.meals.map((m, i) => short(p, m, i)) });
  const night = (p, i) => 'Night ' + p.meals[i].day + (p.dates && p.dates[i] ? ' (' + app.dayLabel(p.dates[i]) + ')' : '');
  const nightOf = (q, p) => { const n = q.night; if (!Number.isInteger(n) || n < 1 || n > p.meals.length) fail('night is 1 to ' + p.meals.length + ' in this plan.'); return n; };
  const which = q => q.plan === 'draft' ? 'draft' : 'current';
  const need = w => { const p = planOf(w); if (!has(p)) fail(w === 'draft' ? 'There’s no new plan waiting.' : 'There’s no plan yet: make one first.'); return p; };

  const tools = {
    async get_meals() {
      const d = D(), s = d.settings || {}, state = app.state();
      return { content: {
        today: app.today(), salesWeekFrom: d.week || '',
        plan: has(d.plan) ? brief(d.plan) : null,
        draft: has(d.draft) ? { ...brief(d.draft), saved: false } : null,
        avoid: s.avoid || [],
        stores: app.mine().map(x => ({ id: x.id, name: x.name, where: x.where, dealsThisWeek: thisWeek(x.id) ? thisWeek(x.id).items.length : 0,
          ...(x.cardName && (s.cards || []).includes(x.card) ? { card: x.cardName } : {}) })),
        pastPlans: (d.log || []).length,
        ...(d.ai === null && state === 'ok' ? { ai: 'Meals’ AI key isn’t set up yet, so make_plan won’t work.' } : {}),
        ...(state !== 'ok' && state !== 'loading' ? { note: 'Meals couldn’t reach the family server just now: this is the copy on this phone.' } : {}),
      } };
    },

    async get_dinners(q) {
      let p;
      if (q.plan === 'current' || q.plan === 'draft') p = need(which(q));
      else {
        const id = clip(q.plan, 20); if (!/^p[a-z0-9]{1,16}$/.test(id)) fail('plan is current, draft, or a past plan’s id from get_past_plans.');
        try { p = await app.past(id); } catch (e) { fail(e.code === 'not-found' ? 'No past plan with id ' + id + '.' : app.say(e.code)); }
        if (!has(p)) fail('No past plan with id ' + id + '.');
      }
      const want = Array.isArray(q.nights) && q.nights.length ? new Set(q.nights) : null;
      return { content: { ...head(p), dinners: p.meals.map((m, i) => whole(p, m, i)).filter(m => !want || want.has(m.night)) } };
    },

    async get_deals(q) {
      const d = D(), ids = q.store && q.store !== 'all' ? [q.store] : (d.settings.stores || []);
      const words = clip(q.query, 100).toLowerCase().split(/\s+/).filter(Boolean);
      const stores = ids.map(id => {
        const s = app.storeById(id); if (!s) return null;
        const x = thisWeek(id);
        if (!x) return { store: s.name, id, deals: 'None found for this week yet.' };
        const card = s.cardName && (d.settings.cards || []).includes(s.card) ? s.cardName : '';
        const items = x.items.filter(i => words.every(w => i.name.toLowerCase().includes(w)));
        return { store: s.name, id, runs: x.validFrom && x.validTo ? x.validFrom + ' to ' + x.validTo : 'the week from ' + x.week, ...(card ? { memberPricesFor: card } : {}),
          items: items.map(i => i.name + ': ' + (i.price || '?') + (i.regular ? ' (usually ' + i.regular + ')' : '') + (i.member ? ' [' + (s.cardName || 'member') + ' card]' : '') + (i.note ? ' - ' + i.note : '')) };
      }).filter(Boolean);
      return { content: { week: d.week, stores } };
    },

    async get_past_plans(q) {
      const limit = Math.max(1, Math.min(52, Number.isInteger(q.limit) ? q.limit : 12)), cur = D().plan && D().plan.id;
      const log = D().log || [];
      return { content: { total: log.length, plans: log.slice(0, limit).map(e => ({ id: e.id, from: e.start, to: e.end, meat: e.meat, shop: shopName(e), people: e.people, dinners: e.titles, ...(e.id === cur ? { current: true } : {}) })) } };
    },

    async get_shopping_list() {
      const p = D().plan;
      if (!has(p)) return { content: { sections: [], note: D().draft ? 'No accepted plan yet: the list comes once the new plan is accepted.' : 'No plan yet.' } };
      const s = app.shopOf(p), done = new Set(app.ticked()), all = !p.shop || p.shop === 'all';
      const row = x => ({ item: x.item, ...(x.amounts.length ? { amount: app.L.total(x.amounts) } : {}), nights: x.nights,
        ...(x.deal ? { onSale: (x.deal.price || 'yes') + (all && x.deal.at && x.deal.at.name ? ' at ' + x.deal.at.name : '') } : {}), ...(done.has(x.key) ? { ticked: true } : {}) });
      return { content: { plan: p.id || '', sections: app.L.sections(s.buy, x => x.item).map(g => ({ section: g.name, items: g.items.map(row) })), youProbablyHave: s.pantry.map(row) } };
    },

    async tick_items(q) {
      const p = D().plan; if (!has(p)) fail('There’s no shopping list yet: no plan has been accepted.');
      const s = app.shopOf(p), list = [...s.buy, ...s.pantry], norm = t => String(t || '').toLowerCase().trim();
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

    async set_dinner(q) {
      const w = which(q), p = need(w), n = nightOf(q, p);
      if (!q.dinner || typeof q.dinner !== 'object') fail('Give the whole dinner: title, ingredients and steps.');
      const old = copy(p.meals[n - 1]), label = night(p, n - 1), who = w === 'draft' ? { draft: true, at: p.at } : { id: p.id };
      const put = async meal => {
        const j = await call('night', { ...who, day: n, meal });
        app.keep(w === 'draft' ? { draft: j.draft } : { plan: j.plan, log: j.log });
        return w === 'draft' ? j.draft : j.plan;
      };
      const now = await put(q.dinner), m = now.meals[n - 1];
      return { content: { plan: w, dinner: whole(now, m, n - 1) },
        change: { text: label + (w === 'draft' ? ' of the new plan' : '') + ': ' + old.title + ' → ' + m.title, undo: later(label, () => put(old)) } };
    },

    async make_plan(q, { confirm }) {
      const d = D(), before = has(d.draft) ? copy(d.draft) : null;
      const int = (v, lo, hi, dflt) => Number.isInteger(v) && v >= lo && v <= hi ? v : dflt;
      const shop = q.shop === 'all' || app.mine().some(x => x.id === q.shop) ? q.shop : 'all';
      const ask = { meat: MEATS.includes(q.meat) ? q.meat : 'chicken', days: int(q.nights, 2, 7, 4), people: int(q.people, 1, 10, (d.plan && d.plan.people) || 4),
        useDeals: q.use_deals !== false, shop, note: clip(q.note, 200), ...(before && q.again ? { again: true } : {}) };
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
      const d = need('draft'), today = app.today(), start = q.start == null || q.start === '' ? today : q.start;
      if (!ymd(start)) fail('start is a day, YYYY-MM-DD.');
      const off = (Date.parse(start + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 864e5;
      if (off < -7 || off > 30) fail('start should be from a week ago to a month from today.');
      const cur = has(D().plan) ? D().plan : null;
      const ok = await confirm('Save the new plan (' + sum(d) + ') for the family, night 1 on ' + app.dayLabel(start) + '?'
        + (cur ? ' It takes the place of the current plan (' + cur.meals.map(m => m.title).join(', ') + ') for everyone.' : ' Everyone in the family sees it.'),
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

    async show_dinner(q) {
      const p = need(which(q)), n = nightOf(q, p);
      app.show(p, n - 1);
      return { content: { shown: night(p, n - 1) + ': ' + p.meals[n - 1].title, note: 'It is open behind the chat; closing the chat shows it.' } };
    },
  };

  const LABELS = {
    get_meals: () => 'Looking at the family’s dinners', get_dinners: () => 'Reading the recipes',
    get_deals: i => 'Checking this week’s deals' + (i.store && i.store !== 'all' && app.storeById(i.store) ? ' at ' + app.storeById(i.store).name : ''),
    get_past_plans: () => 'Looking at past plans', get_shopping_list: () => 'Reading the shopping list',
    tick_items: i => i.ticked === false ? 'Unticking the list' : 'Ticking off the list', set_dinner: i => 'Changing night ' + (Number.isInteger(i.night) ? i.night : ''),
    make_plan: () => 'Planning dinners (about half a minute)', accept_plan: () => 'Saving the plan', discard_draft: () => 'Discarding the new plan', show_dinner: () => 'Opening the recipe',
  };

  return {
    tools,
    label: (name, input) => (LABELS[name] || (() => ''))(input || {}),
    context() {
      const d = D(), p = has(d.plan) ? d.plan : null, dr = has(d.draft) ? d.draft : null, avoid = (d.settings || {}).avoid || [], state = app.state();
      const when = p && p.dates && p.dates.length ? ', ' + app.dayLabel(p.dates[0]) + ' to ' + app.dayLabel(p.dates[p.dates.length - 1]) : '';
      return 'Meals: ' + (p ? 'the family’s plan is ' + sum(p) + when : 'no plan yet') + (dr ? '; a new plan (' + sum(dr) + ') is waiting to be accepted' : '') + '. '
        + 'Never in a plan: ' + (avoid.length ? avoid.join(', ') : 'nothing listed') + '. On screen: ' + app.screen() + '.'
        + (state !== 'ok' && state !== 'loading' ? ' Meals couldn’t reach the family server just now.' : '');
    },
    intro: 'Hi, I’m Ipsy! I can swap a night’s dinner, plan a new week around the deals, find what’s on sale, or tell you what you can make with what you have, always keeping to what the family never eats.',
    placeholder: 'Ask Ipsy about dinner',
    suggestions: ['What’s for dinner tonight?', 'Swap Thursday for something quicker', 'What’s on sale this week?', 'What can I make with ground beef?'],
    consent: 'Ipsy runs on Claude, by Anthropic. When you ask something, your question and whatever Ipsy looks at to answer it (the family’s plans, deals and settings in Meals) go to Claude through the family server, which keeps only a count of questions. Ipsy can change the family’s dinners, and everyone in the family sees what it changes: each change shows here with Undo, and it asks first before replacing, saving or discarding a whole week.',
  };
};
