"use strict";

// Meals: the family's meals, planned with Ipsy.
//
// - Three tabs on one screen: Ipsy (say what you fancy: which meals, what to build them around,
//   what's in the fridge; then Ipsy asks the rest one question at a time and plans it), Plan
//   (the plan, a card a day, each meal opening to its recipe) and List (what to buy for the
//   plan, in the grocery sections Notes uses, ticked off in the store).
// - Every plan keeps to the family's rules (Settings, the gear): vegetables and protein in
//   every meal, how many they cook for, the weeknight time, what they never eat; and learns
//   from the meals the family loved, or never wants again (the thumbs on a recipe).
// - The plan is the family's, made by an AI model on the server (functions/meals/api), which
//   also checks every meal against what the family avoids. The last copy is kept on this
//   phone (allison-meals-v2), so the list works in the store with no signal; ticks stay on
//   this phone only.
// - Ipsy (bottom left) is the helper you chat with: "Or just tell Ipsy", "Change anything",
//   Swap and Ask Ipsy all open it, with what you typed.
// - The family's Google Sheet is the record of every plan ever accepted
//   (google-sheet-sync.gs, through aOS: aOS/SHEETS.md). Meals copies the plans, the list
//   and the rules there, and reads back the plans the family server no longer keeps.
// - The designs, picked in Settings > Design or for every app in aOS (../home/design.js).

// Refuse to run inside another site's frame; this same site may (see Mail's app.js for why).
if (window.top !== window.self && (() => { try { return window.top.location.origin !== location.origin; } catch { return true; } })()) {
  document.body.textContent = 'Meals can’t be opened inside another page.';
  throw new Error('Meals refuses to run inside a frame');
}

(function () {
  const L = window.MealsLogic;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = {
    json: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del: k => { try { localStorage.removeItem(k); } catch {} },
  };
  const KEY = 'allison-meals-v2', K = { ticks: 'allison-meals-v1-ticks', tab: 'allison-meals-v1-tab',
    // the family's Google Sheet: when it last synced, the plans it holds, plans taken back here (Undo);
    // sheet and sheetSent are the link, phrase and sent list from before aOS kept them (handed over, then gone)
    sheetAt: 'allison-meals-v1-sheet-synced', sheetHas: 'allison-meals-v1-sheet-has', sheetGraves: 'allison-meals-v1-sheet-graves',
    sheet: 'allison-meals-v1-sheet', sheetSent: 'allison-meals-v1-sheet-sent', sheetOldAt: 'allison-meals-v1-sheet-at',
    fold: 'allison-meals-v1-fold' };   // the plan folded away (this phone only)
  const plural = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
  const cap = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
  const join = a => a.length <= 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const SLOTS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']];
  const FOODS = [['chicken', 'Chicken'], ['lamb', 'Lamb'], ['beef', 'Beef'], ['pork', 'Pork'], ['turkey', 'Turkey'], ['fish', 'Fish'], ['shrimp', 'Shrimp'], ['vegetarian', 'Vegetarian']];
  const PROTEIN = [['some', 'Some', 20], ['good', 'Good', 30], ['high', 'High', 40]];
  const WEEKNIGHT = [[0, 'No limit'], [20, '20 minutes'], [30, '30 minutes'], [40, '40 minutes'], [60, 'An hour']];
  const ICON = {
    tick: '<svg viewBox="0 0 24 24" class="b"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>',
    sheet: '<svg viewBox="0 0 24 24"><rect x="3.4" y="3.8" width="17.2" height="16.4" rx="3"/><path d="M3.4 9.4h17.2M3.4 14.8h17.2M9.4 9.4v10.8"/></svg>',
    chev: '<svg viewBox="0 0 24 24" class="b"><path d="M8.6 10l3.4 3.4 3.4-3.4"/></svg>',
    clear: '<svg viewBox="0 0 24 24" class="b"><path d="M7 7l10 10M17 7L7 17"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8.4" y="8.4" width="11.6" height="11.6" rx="2.4"/><path d="M15.6 8.4V6.2A2.2 2.2 0 0 0 13.4 4H6.2A2.2 2.2 0 0 0 4 6.2v7.2a2.2 2.2 0 0 0 2.2 2.2h2.2"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M7.5 10.5V20H4.8a.8.8 0 0 1-.8-.8v-7.9a.8.8 0 0 1 .8-.8zM7.5 10.5l3.8-6.2a1.6 1.6 0 0 1 2.9 1.2l-.8 3.9h5a1.8 1.8 0 0 1 1.8 2.1l-1.2 6.9A1.8 1.8 0 0 1 17.2 20H7.5"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M7.5 13.5V4H4.8a.8.8 0 0 0-.8.8v7.9a.8.8 0 0 0 .8.8zM7.5 13.5l3.8 6.2a1.6 1.6 0 0 0 2.9-1.2l-.8-3.9h5a1.8 1.8 0 0 0 1.8-2.1l-1.2-6.9A1.8 1.8 0 0 0 17.2 4H7.5"/></svg>',
  };
  const DEFAULT_SETTINGS = { avoid: ['tree nuts', 'coconut'], veg: 2, protein: 'good', people: 4, weeknight: 40 };

  // ---------------------------------------------------------------------
  // The family's Meals: { ai, model, settings, taste, draft, plan, log } from the server,
  // the last copy kept here for when there's no signal.
  // ---------------------------------------------------------------------
  const blank = { ai: null, model: null, settings: DEFAULT_SETTINGS, taste: { loved: [], nope: [] }, draft: null, plan: null, log: [] };
  let data = Object.assign({}, blank, ls.json(KEY, null) || {});
  data.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
  data.taste = data.taste || { loved: [], nope: [] };
  const st = { tab: ['ipsy', 'plan', 'list'].includes(ls.json(K.tab, '')) ? ls.json(K.tab, '') : (data.plan || data.draft ? 'plan' : 'ipsy'), state: 'idle', busy: null, error: '' };
  let ticks = ls.json(K.ticks, { at: 0, keys: [] });
  let folded = ls.json(K.fold, false) === true;

  const A = () => window.AllisonOS && window.AllisonOS.account;
  // Meals' route (functions/meals/api), named from the site root's side so it is the same from the old
  // Meals Vintage address, which opens this same app (../home/design.js)
  const API = '../meals/api/';
  async function api(path, body) {
    const opts = { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Meals': '1' }, cache: 'no-store' };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let r;
    try { r = A() ? await A().fetch(API + path, opts) : await fetch(API + path, opts); }
    catch { throw Object.assign(new Error('offline'), { code: 'offline' }); }
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) throw Object.assign(new Error(j.error || 'http-' + r.status), { code: j.error || (r.status === 404 ? 'off' : 'server'), body: j });
    return j;
  }
  const SAY = {
    'no-ai': 'Meals needs its AI key first: the owner adds it (see Meals’ README).',
    'accounts-off': 'Family accounts aren’t switched on yet, so Meals can’t plan for the family.',
    'setup': 'Family accounts aren’t switched on yet, so Meals can’t plan for the family.',
    'signin': 'Sign in with your family account to see the family’s meals.',
    'off': 'Meals’ server isn’t set up on this site.',
    'offline': 'You’re offline. Showing what this phone kept.',
    'ai-key': 'The AI service didn’t accept Meals’ key. The owner can check it.',
    'ai-busy': 'The AI service is busy. Try again in a minute.',
    'ai-unreachable': 'Couldn’t reach the AI service. Try again in a minute.',
    'ai-format': 'That didn’t come back right. Try again.',
    'avoid': 'Every plan it made used something the family avoids, so none was kept. Try again, or pick something else.',
    'limit': 'That’s a lot of plans today. Try again tomorrow.',
    'owner-only': 'Only the owner can change what the family avoids. Your other rules were kept.',
    'changed': 'Someone in the family changed the plan just now. Here’s the plan as it is.',
  };
  const say = code => SAY[code] || 'Something went wrong. Try again in a minute.';

  async function load() {
    st.state = 'loading';
    try {
      const j = await api('state');
      // got: when this was read from the family server (the Sheet keeps the newest copy read)
      data = { ai: j.ai, model: j.model, settings: Object.assign({}, DEFAULT_SETTINGS, j.settings || {}), taste: j.taste || { loved: [], nope: [] },
        draft: j.draft || null, plan: j.plan, log: j.log || [], got: Date.now() };
      ls.set(KEY, data); st.state = 'ok'; st.error = '';
      scheduleSheet();   // the family's Google Sheet hears what the family changed
    } catch (e) { st.state = e.code; st.error = e.code; }
    render();
  }

  // ---------------------------------------------------------------------
  // The screen
  // ---------------------------------------------------------------------
  const main = $('main');
  const notice = () => {
    if (!st.error || st.error === 'loading') return '';
    const signin = st.error === 'signin';
    return '<div class="card" style="--i:0"><p>' + esc(say(st.error)) + '</p>' + (signin ? '<div class="btns"><button class="btn" type="button" data-act="signin">Sign in with Face ID</button></div>' : '') + '</div>';
  };
  const noAI = () => data.ai === null && st.state === 'ok';
  const busyCard = (title, line) => '<div class="card busy" role="status" style="--i:1"><span class="spin" aria-hidden="true"></span><strong>' + esc(title) + '</strong>' + esc(line) + '</div>';

  function render() {
    document.querySelectorAll('#tabs [data-tab]').forEach(b => { const on = b.dataset.tab === st.tab; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
    slideTabs(true);
    $('fab').hidden = st.tab !== 'plan' || !!(data.draft && data.draft.meals) || st.busy === 'plan';   // a new plan waiting: accept, try again or discard it first
    main.innerHTML = notice() + (st.tab === 'ipsy' ? talk() : st.tab === 'plan' ? planTab() : list());
  }

  // dates: 'YYYY-MM-DD' on this phone's calendar
  const isoDay = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dayLabel = (iso, o) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', o || { weekday: 'short', month: 'short', day: 'numeric' });
  const span = e => dayLabel(e.start, { month: 'short', day: 'numeric' }) + ' – ' + dayLabel(e.end, { month: 'short', day: 'numeric' });
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDay(d); };
  const slotOf = m => m.slot || 'dinner';
  const slotName = m => (SLOTS.find(s => s[0] === slotOf(m)) || SLOTS[2])[1];
  // a plan's day d (from 1) as a date: its own dates once accepted, else from the day it was planned from
  const dateOf = (p, d) => (p.dates && p.dates[d - 1]) || (p.start ? addDays(p.start, d - 1) : '');
  const dayName = (p, d) => { const iso = dateOf(p, d); return iso ? dayLabel(iso, { weekday: 'long', month: 'short', day: 'numeric' }) : 'Day ' + d; };
  // "Monday lunch" (a recipe's title, Ipsy's words): the weekday, else "Day 2"
  const mealName = (p, m) => { const iso = dateOf(p, m.day || 1); return (iso ? dayLabel(iso, { weekday: 'long' }) : 'Day ' + (m.day || 1)) + ' ' + slotName(m).toLowerCase(); };
  // what a plan was built around, in a few words: "Chicken and lamb · lunch and dinner · for 4"; plans from before: "Chicken · for 4"
  const foodWords = p => p.foods ? (p.foods.includes('surprise') && p.foods.length === 1 ? 'Anything' : cap(join(p.foods.filter(f => f !== 'surprise')))) : cap(p.meat === 'on sale' ? 'Whatever’s on sale' : p.meat || '');
  const slotWords = p => p.slots ? join(SLOTS.filter(s => p.slots.includes(s[0])).map(s => s[1].toLowerCase())) : 'dinners';
  const about = p => [foodWords(p), slotWords(p), 'for ' + p.people].filter(Boolean).join(' · ');
  const tags = m => {
    const t = [];
    if (m.leftover) t.push('<span class="tag lo">Leftovers</span>');
    if (Array.isArray(m.veg) && m.veg.length) t.push('<span class="tag veg">' + esc(plural(m.veg.length, 'vegetable')) + '</span>');
    if (m.protein) t.push('<span class="tag pro">' + esc('about ' + m.protein + ' g protein') + '</span>');
    if (m.minutes) t.push('<span class="tag">' + esc(m.minutes + ' min') + '</span>');
    if (Array.isArray(m.fridge) && m.fridge.length) t.push('<span class="tag fr">' + esc('uses your ' + join(m.fridge)) + '</span>');
    return t.length ? '<span class="tags">' + t.join('') + '</span>' : '';
  };
  // a plan's days as cards, a meal a row; src says which plan a tap opens ('draft', 'plan' or 'past')
  function days(p, src, from) {
    const by = new Map();
    p.meals.forEach((m, i) => { const d = m.day || i + 1; if (!by.has(d)) by.set(d, []); by.get(d).push([m, i]); });
    return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([d, ms], k) => '<div class="card dayc" style="--i:' + (from + k) + '"><p class="night">' + esc(dayName(p, d)) + '</p>'
      + ms.map(([m, i]) => '<button class="mrow" type="button" data-meal="' + i + '" data-src="' + src + '"><span class="slot">' + esc(slotName(m)) + '</span>'
        + '<span class="ct" translate="no">' + esc(m.title) + '</span>' + tags(m) + '</button>').join('') + '</div>').join('');
  }

  // ---- the Ipsy tab: what you fancy, then Ipsy's questions, one at a time ----
  const flow = { step: 'pick', slots: ['dinner'], foods: [], fridge: '', days: 0, people: 0, lunches: '', note: '' };
  const rules = () => data.settings;
  const proteinG = () => (PROTEIN.find(x => x[0] === rules().protein) || PROTEIN[1])[2];
  const rulesLine = () => (rules().veg ? plural(rules().veg, 'vegetable').replace(/^(\d+)/, '$1+') + ' and about ' + proteinG() + ' g protein in every meal' : 'About ' + proteinG() + ' g protein in every meal')
    + ((rules().avoid || []).length ? ' · never ' + join(rules().avoid) : '');
  const lastPeople = () => (data.plan && +data.plan.people) || rules().people || 4;
  // the questions still to ask, in order: how far ahead, how many, leftovers (lunch and dinner both), anything else
  const QUESTIONS = () => ['days', 'people', ...(flow.slots.includes('lunch') && flow.slots.includes('dinner') ? ['lunches'] : []), 'note'];
  const ASK = {
    days: ['Lovely. How far ahead should I plan?', [[1, 'Just today'], [3, 'Next 3 days'], [7, 'The week']]],
    people: [null, [1, 2, 3, 4, 5, 6, 8].map(n => [n, String(n)])],
    lunches: ['For lunches: the night before’s leftovers, or something fresh each day?', [['leftovers', 'Leftovers are great'], ['fresh', 'Fresh each day'], ['mix', 'A mix']]],
  };
  const answerWords = q => q === 'days' ? (ASK.days[1].find(x => x[0] === flow.days) || [0, ''])[1] : q === 'people' ? plural(flow.people, 'person').replace('persons', 'people')
    : q === 'lunches' ? (ASK.lunches[1].find(x => x[0] === flow.lunches) || [0, ''])[1] : flow.note || 'Nothing else';
  const pickWords = () => [cap(join(SLOTS.filter(s => flow.slots.includes(s[0])).map(s => s[1].toLowerCase()))),
    flow.foods.length ? join(flow.foods.map(f => f === 'surprise' ? 'surprise me' : f)) : 'surprise me', flow.fridge ? 'use up ' + flow.fridge : ''].filter(Boolean).join(' · ');
  const chip = (attr, v, label, on, multi) => '<button class="opt" type="button" role="' + (multi ? 'checkbox' : 'radio') + '" ' + attr + '="' + esc(v) + '" aria-checked="' + !!on + '">' + esc(label) + '</button>';
  const bub = (who, html) => '<div class="bub' + (who === 'me' ? ' me' : '') + '">' + html + '</div>';
  function talk() {
    if (st.busy === 'plan') return busyCard('Planning ' + plural(st.planning.n, 'meal') + '…', st.planning.n > 6 ? 'About a minute.' : 'About half a minute.');
    const user = A() && A().user(), hi = 'Hi' + (user && user.name ? ' ' + user.name.split(' ')[0] : '') + '. What are we eating? Pick a few things and I’ll ask the rest.';
    let h = '<div class="chat">' + bub('ipsy', esc(hi));
    if (flow.step === 'pick') {
      h += '<div class="card pick" style="--i:1">'
        + '<p class="label" id="lSlots">Which meals</p><div class="opts" role="group" aria-labelledby="lSlots">' + SLOTS.map(([k, n]) => chip('data-slot', k, n, flow.slots.includes(k), true)).join('') + '</div>'
        + '<p class="label" id="lFoods">What do you fancy</p><div class="opts" role="group" aria-labelledby="lFoods">' + FOODS.map(([k, n]) => chip('data-food', k, n, flow.foods.includes(k), true)).join('')
        + chip('data-food', 'surprise', 'Surprise me', flow.foods.includes('surprise'), true) + '</div>'
        + '<label class="label" for="fFridge">In the fridge (optional)</label><div class="rgroup"><div class="frow"><input class="txt" id="fFridge" maxlength="300" placeholder="Half a cabbage, feta, eggs…" value="' + esc(flow.fridge) + '"></div></div>'
        + '<div class="rules"><p>' + esc('Family rules: ' + rulesLine()) + '</p><button class="linkbtn" type="button" data-act="rules">Edit</button></div>'
        + '<div class="btns"><button class="btn okbtn" type="button" data-act="pick"' + (noAI() || !flow.slots.length ? ' disabled' : '') + '>Plan it</button></div></div>';
    } else {
      h += bub('me', esc(pickWords()));
      const qs = QUESTIONS();
      for (const q of qs) {
        const asked = q === 'people' ? 'How many at the table?' + (data.plan && data.plan.people ? ' Last time it was ' + data.plan.people + '.' : ' Usually it’s ' + rules().people + '.') : q === 'note' ? 'Anything else? (No spicy food, kid-friendly…)' : ASK[q][0];
        h += bub('ipsy', esc(asked));
        const answered = q === 'note' ? flow.step === 'done' : !!flow[q];
        if (answered) { h += bub('me', esc(answerWords(q))); continue; }
        if (q === 'note') {
          h += '<div class="card ready"><p>' + esc(summary()) + '</p>'
            + '<div class="rgroup"><div class="frow"><label class="vh" for="fNote">Anything else</label><input class="txt" id="fNote" maxlength="200" placeholder="Anything else? (optional)" value="' + esc(flow.note) + '"></div></div>'
            + '<div class="btns"><button class="btn okbtn" type="button" data-act="make"' + (noAI() ? ' disabled' : '') + '>Make it</button></div></div>';
        } else {
          const cur = q === 'people' ? lastPeople() : null;
          h += '<div class="opts answers" role="radiogroup" aria-label="' + esc(q === 'days' ? 'How far ahead' : q === 'people' ? 'How many at the table' : 'Lunches') + '">'
            + ASK[q][1].map(([v, n]) => chip('data-' + q, v, n, v === cur, false)).join('') + '</div>';
        }
        break;
      }
      h += '<button class="linkbtn" type="button" data-act="restart">Start over</button>';
    }
    h += '</div>' + askBar('Or just tell Ipsy…', 'tell');
    return h;
  }
  function summary() {
    const n = flow.days * flow.slots.length, which = join(SLOTS.filter(s => flow.slots.includes(s[0])).map(s => ({ breakfast: 'breakfasts', lunch: 'lunches', dinner: 'dinners' })[s[0]]));
    return 'Planning ' + (flow.days === 1 ? 'today’s ' + which : flow.days + ' days of ' + which) + ' for ' + flow.people
      + (flow.lunches === 'leftovers' && flow.days > 1 ? ', lunches from the night before' : '') + ': ' + plural(n, 'meal') + ', each with ' + rulesLine().split(' · ')[0].replace(/ in every meal$/, '') + '.';
  }
  const askBar = (ph, act) => '<div class="rgroup askbar"><div class="frow"><label class="vh" for="askIn">' + esc(ph) + '</label><input class="txt" id="askIn" maxlength="300" placeholder="' + esc(ph) + '">'
    + '<button class="btn" type="button" data-act="' + act + '">Ask</button></div></div>';

  // ---- the Plan tab ----
  function startOptions(sel) {
    const now = new Date();
    return Array.from({ length: 8 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i), iso = isoDay(d);
      return '<option value="' + iso + '"' + (iso === sel ? ' selected' : '') + '>' + esc((i === 0 ? 'Today, ' : i === 1 ? 'Tomorrow, ' : '') + dayLabel(iso)) + '</option>'; }).join('');
  }
  function planTab() {
    const p = data.plan, d = data.draft;
    if (st.busy === 'plan') return busyCard('Planning ' + plural(st.planning.n, 'meal') + '…', st.planning.n > 6 ? 'About a minute.' : 'About half a minute.');
    let h = '';
    if (d && d.meals && d.meals.length) {
      // a new plan to look over: nothing is saved until someone accepts it; the choice first, where it's seen
      h += '<div class="card accept" style="--i:1"><strong>New plan · not saved yet</strong>'
        + '<p>' + esc(about(d) + (d.by ? ' · by ' + d.by : '')) + '</p>'
        + '<div class="frow storepick"><label for="aStart">Starting</label><select id="aStart">' + startOptions(d.start && d.start >= isoDay(new Date()) ? d.start : isoDay(new Date())) + '</select></div>'
        + '<div class="btns"><button class="btn okbtn" type="button" data-act="accept">Accept plan</button><button class="btn" type="button" data-act="again"' + (noAI() ? ' disabled' : '') + '>Try again</button></div>'
        + '<div class="btns" style="margin-top:0"><button class="btn quiet" type="button" data-act="discard">Discard</button></div></div>'
        + days(d, 'draft', 2) + (d.tip ? '<div class="card"><p><b>Tip:</b> <span translate="no">' + esc(d.tip) + '</span></p></div>' : '')
        + askBar('Change anything…', 'change');
    } else if (p && p.meals && p.meals.length) {
      // the plan's bar: tap it to fold the days away (kept folded on this phone), × to clear the plan
      // (it stays in Past plans, with Undo)
      const when = p.dates && p.dates.length ? span({ start: p.dates[0], end: p.dates[p.dates.length - 1] }) : dayLabel(isoDay(new Date(p.at)));
      const ti = (p.dates || []).indexOf(isoDay(new Date())), tonight = ti >= 0 ? p.meals.filter(m => (m.day || 1) === ti + 1 && slotOf(m) === 'dinner')[0] : null;
      h += '<div class="planbar card" style="--i:1"><button class="pfold" type="button" data-act="fold" aria-expanded="' + !folded + '" aria-controls="planDays">'
        + '<span class="chev" aria-hidden="true">' + ICON.chev + '</span><span class="pt">' + esc(about(p))
        + '<small>' + esc(folded && tonight ? 'Tonight: ' + tonight.title : when + ' · ' + plural(p.meals.length, 'meal')) + '</small></span></button>'
        + '<button class="iconbtn pclear" type="button" data-act="clear" aria-label="Clear this plan">' + ICON.clear + '</button></div>'
        + '<div class="pnights" id="planDays"' + (folded ? ' hidden' : '') + '>' + days(p, 'plan', 2);
      if (p.tip) h += '<div class="card"><p><b>Tip:</b> <span translate="no">' + esc(p.tip) + '</span></p></div>';
      if (p.acceptedBy || p.by) h += '<p class="hint">' + esc(p.acceptedBy ? 'Accepted by ' + p.acceptedBy : 'Planned by ' + p.by) + '.</p>';
      h += '</div>' + askBar('Change anything…', 'change');
    } else {
      h += '<div class="card" style="--i:1"><strong>Nothing planned yet</strong><p>Tell Ipsy what you fancy, and it plans the meals.</p>'
        + '<div class="btns"><button class="btn okbtn" type="button" data-act="new"' + (noAI() ? ' disabled' : '') + '>Plan with Ipsy</button></div></div>';
    }
    // every accepted plan, as Fitness keeps every workout: the family server's last 52, then older ones
    // read back from the family's Google Sheet
    const log = pastList(), olderOn = signedIn() && sheetAt && !older.done;
    if (log.length || (olderOn && sheetHas.size)) h += '<p class="sechead"><span>Past plans</span><span>' + log.length + '</span></p><div class="rgroup">'
      + log.map(e => '<button class="rowbtn" type="button" data-past="' + esc(e.id) + '"><span>' + esc(span(e) + ' · ' + about(e))
        + (p && p.id === e.id ? ' <span class="prime">Current</span>' : '') + '<span class="sub" translate="no">' + esc(e.titles.join(' · ')) + '</span></span></button>').join('')
      + (olderOn ? '<button class="rowbtn" type="button" data-act="older"' + (older.busy ? ' disabled' : '') + '><span class="ic">' + ICON.sheet + '</span><span>' + (older.busy ? 'Looking in the Sheet…' : 'Show older plans from the Sheet')
        + '</span></button>' : '') + '</div>';
    return h;
  }

  // ---- the List tab ----
  const shopOf = p => L.shopping((p && p.meals) || []);
  function shop() { return shopOf(data.plan); }
  // which days an item is for: "Mon, Wed" from the plan's dates, else "days 1, 3"
  const whenWords = (x, p) => { const d = x.nights.map(n => dateOf(p, n)); return d.every(Boolean) ? d.map(iso => dayLabel(iso, { weekday: 'short' })).join(', ') : 'day' + (x.nights.length > 1 ? 's ' : ' ') + x.nights.join(', '); };
  function list() {
    const p = data.plan;
    if (!p || !p.meals || !p.meals.length) return '<div class="empty" style="--i:1"><strong>Nothing to buy yet</strong>' + (data.draft ? 'Accept the new plan first.' : 'Plan your meals with Ipsy first.') + '</div>';
    if (ticks.at !== p.at) ticks = { at: p.at, keys: [] };
    const s = shop(), done = new Set(ticks.keys);
    const row = x => '<button class="irow" type="button" role="checkbox" aria-checked="' + done.has(x.key) + '" data-key="' + esc(x.key) + '"><span class="box">' + ICON.tick + '</span>'
      + '<span class="it"><span translate="no">' + esc(cap(x.item)) + '</span><small>' + esc([L.total(x.amounts), whenWords(x, p)].filter(Boolean).join(' · ')) + '</small></span></button>';
    const groups = L.sections(s.buy, x => x.item);
    let h = groups.map((g, i) => '<p class="sechead"><span>' + esc(g.name) + '</span><span>' + g.items.filter(x => !done.has(x.key)).length + '</span></p><div class="rgroup" style="--i:' + (i + 1) + '">' + g.items.map(row).join('') + '</div>').join('');
    if (s.pantry.length) h += '<p class="sechead"><span>You probably have</span><span>' + s.pantry.length + '</span></p><div class="rgroup">' + s.pantry.map(row).join('') + '</div>';
    h += '<div class="card"><div class="btns" style="margin-top:0"><button class="btn" type="button" data-act="copy">' + ICON.copy + 'Copy the list</button>'
      + (done.size ? '<button class="btn quiet" type="button" data-act="untick">Clear ticks</button>' : '') + '</div></div>';
    return h;
  }

  // ---------------------------------------------------------------------
  // Doing things
  // ---------------------------------------------------------------------
  const toggle = (a, v) => { const i = a.indexOf(v); if (i < 0) a.push(v); else a.splice(i, 1); };
  main.addEventListener('click', async e => {
    const b = e.target.closest('[data-act], [data-meal], [data-key], [data-past], [data-slot], [data-food], [data-days], [data-people], [data-lunches]'); if (!b) return;
    if (b.dataset.meal) return openRecipe(+b.dataset.meal, b.dataset.src === 'draft' ? data.draft : data.plan);
    if (b.dataset.past) return openPast(b.dataset.past);
    if (b.dataset.key) {
      const k = b.dataset.key, i = ticks.keys.indexOf(k);
      if (i < 0) ticks.keys.push(k); else ticks.keys.splice(i, 1);
      ls.set(K.ticks, ticks); b.setAttribute('aria-checked', i < 0);
      return;
    }
    // what you fancy: the chips toggle in place (Surprise me and the foods take turns)
    if (b.dataset.slot) { toggle(flow.slots, b.dataset.slot); b.setAttribute('aria-checked', flow.slots.includes(b.dataset.slot)); const go = main.querySelector('[data-act="pick"]'); if (go) go.disabled = noAI() || !flow.slots.length; return; }
    if (b.dataset.food) {
      const f = b.dataset.food; toggle(flow.foods, f);
      if (f === 'surprise' && flow.foods.includes('surprise')) flow.foods = ['surprise']; else if (f !== 'surprise') flow.foods = flow.foods.filter(x => x !== 'surprise');
      main.querySelectorAll('[data-food]').forEach(x => x.setAttribute('aria-checked', flow.foods.includes(x.dataset.food)));
      return;
    }
    // an answer to Ipsy's question: the next question comes
    for (const q of ['days', 'people', 'lunches']) if (b.dataset[q] != null) { flow[q] = q === 'lunches' ? b.dataset[q] : +b.dataset[q]; return next(); }
    const act = b.dataset.act;
    if (act === 'pick') { flow.fridge = ($('fFridge') || {}).value || ''; flow.fridge = flow.fridge.trim(); flow.step = 'ask'; return next(); }
    if (act === 'make') { flow.note = (($('fNote') || {}).value || '').trim(); return makePlan(); }
    if (act === 'restart') { Object.assign(flow, { step: 'pick', days: 0, people: 0, lunches: '', note: '' }); return render(); }
    if (act === 'rules') return openSettings();
    if (act === 'tell' || act === 'change') { const t = (($('askIn') || {}).value || '').trim(); return askIpsy(act === 'change' && t && data.draft ? t + ' (on the new plan waiting)' : t); }
    if (act === 'new') return goTab('ipsy');
    if (act === 'accept') return accept();
    if (act === 'again') return again();
    if (act === 'discard') return discard();
    if (act === 'fold') { folded = !folded; ls.set(K.fold, folded); return render(); }
    if (act === 'clear') return clearPlan();
    if (act === 'signin') return signIn();
    if (act === 'older') return loadOlder();
    if (act === 'untick') { ticks.keys = []; ls.set(K.ticks, ticks); render(); return; }
    if (act === 'copy') {
      const s = shop(), text = L.listText(L.sections(s.buy, x => x.item));
      try { await navigator.clipboard.writeText(text); toast('Copied ' + plural(s.buy.length, 'item') + '.'); }
      catch { toast('Couldn’t copy on this phone.'); }
    }
  });
  main.addEventListener('input', e => { if (e.target.id === 'fFridge') flow.fridge = e.target.value; if (e.target.id === 'fNote') flow.note = e.target.value; });
  main.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'askIn') { e.preventDefault(); main.querySelector('.askbar [data-act]').click(); } });
  // the next question, scrolled into sight
  function next() { render(); const last = [...main.querySelectorAll('.bub')].pop(); if (last && last.scrollIntoView) last.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  function goTab(t) { st.tab = t; ls.set(K.tab, t); render(); slideTabs(false); scrollTo(0, 0); }
  async function signIn() {
    try { await A().signIn(); toast('Signed in.'); load(); }
    catch (err) { toast(err && err.name === 'NotAllowedError' ? 'No passkey found, or canceled. Set up your account in aOS first.' : 'Couldn’t sign in.'); }
  }
  addEventListener('aos:account', e => { if (e.detail) { load(); handOver(); } });

  // A new plan: what was picked and answered, or (Try again) the draft's own choices
  async function makePlan(more) {
    const ask = more || { slots: flow.slots.slice(), foods: flow.foods.length ? flow.foods.slice() : ['surprise'], days: flow.days, people: flow.people, lunches: flow.lunches || 'leftovers',
      fridge: flow.fridge, note: flow.note, start: isoDay(new Date()) };
    const n = ask.days * ask.slots.length;
    st.busy = 'plan'; st.planning = { ...ask, n }; st.tab = 'plan'; ls.set(K.tab, st.tab); render(); slideTabs(false); scrollTo(0, 0);
    try {
      const j = await api('plan', ask);
      data.draft = j.draft; ls.set(KEY, data);
      Object.assign(flow, { step: 'pick', days: 0, people: 0, lunches: '', note: '', fridge: '' });
      st.busy = null; toast('Here’s a plan. Accept it to save it.', null, 6000);
    } catch (e) { st.busy = null; toast(say(e.code), null, 8000); }
    render();
  }
  // another go at the draft, with the same choices
  const again = () => { const d = data.draft; if (d) makePlan({ slots: d.slots || ['dinner'], foods: d.foods || ['surprise'], days: d.days || d.meals.length, people: d.people, lunches: d.lunches || 'leftovers',
    fridge: d.fridge || '', note: d.note || '', start: d.start && d.start >= isoDay(new Date()) ? d.start : isoDay(new Date()), again: true }); };
  async function accept() {
    const start = ($('aStart') || {}).value;
    try {
      const j = await api('accept', { start });
      data.plan = j.plan; data.log = j.log; data.draft = null; data.got = Date.now(); ls.set(KEY, data);
      ticks = { at: j.plan.at, keys: [] }; ls.set(K.ticks, ticks);
      scheduleSheet();
      toast('Saved for the family, from ' + dayLabel(j.plan.start) + '. The shopping list is ready.', null, 5000);
    } catch (e) { toast(say(e.code), null, 6000); }
    render(); scrollTo(0, 0);
  }
  async function discard() {
    try { await api('discard', {}); data.draft = null; ls.set(KEY, data); scheduleSheet(); toast('New plan discarded.'); }
    catch (e) { toast(say(e.code), null, 6000); }
    render();
  }
  // × on the plan: the family's plan is cleared for everyone (it stays in Past plans and the Sheet), with Undo
  async function clearPlan() {
    const p = data.plan; if (!p) return;
    try { await api('clear', { id: p.id }); }
    catch (e) { toast(say(e.code), null, 6000); if (e.code === 'changed') load(); return; }
    data.plan = null; ls.set(KEY, data); scheduleSheet(); render();
    toast('Plan cleared. It’s still in Past plans.', async () => {
      try { const j = await api('current', { id: p.id }); data.plan = j.plan; ls.set(KEY, data); scheduleSheet(); render(); toast('Plan back.'); }
      catch (e) { toast(say(e.code), null, 6000); if (e.code === 'changed') load(); }
    }, 7000);
  }
  // a past plan: its meals and shopping list, as it was
  const pastCache = {};
  async function openPast(id) {
    let p = id === (data.plan || {}).id ? data.plan : pastCache[id] || sheetPlans.get(id);
    if (!p) { try { p = await wholePlan(id); } catch (e) { toast(say(e.code), null, 6000); return; } }
    st.past = p;
    const s = shopOf(p);
    $('pastLbl').textContent = span({ start: p.start, end: p.dates[p.dates.length - 1] || p.start });
    $('pastBody').innerHTML = '<p class="hint" style="margin:0 2px">' + esc([about(p), p.acceptedBy ? 'accepted by ' + p.acceptedBy : ''].filter(Boolean).join(' · ')) + '</p>'
      + days(p, 'past', 0)
      + '<p class="label">Shopping list</p>' + L.sections(s.buy, x => x.item).map(g => '<div class="rgroup"><p class="sechead" style="margin:10px 14px 2px"><span>' + esc(g.name) + '</span></p><ul class="plain">'
        + g.items.map(x => '<li><span translate="no">' + esc(cap(x.item)) + '</span> <small>' + esc(L.total(x.amounts)) + '</small></li>').join('') + '</ul></div>').join('');
    openSheet('pastSheet');
  }
  $('pastBody').addEventListener('click', e => { const b = e.target.closest('[data-meal]'); if (b) openRecipe(+b.dataset.meal, st.past); });
  $('fab').onclick = () => goTab('ipsy');

  // One meal's recipe: what it's like, the ingredients (what's from the fridge marked), the steps, the
  // thumbs (the family loved it, or never again), and Swap or Ask Ipsy about it
  const lovedNow = t => data.taste.loved.some(x => x.title.toLowerCase() === t.toLowerCase()) ? true : data.taste.nope.some(x => x.title.toLowerCase() === t.toLowerCase()) ? false : null;
  const fromFridge = (item, m) => (m.fridge || []).some(f => { const a = f.toLowerCase(), b = item.toLowerCase(); return a.includes(b) || b.includes(a); });
  function openRecipe(i, p) {
    const m = p && p.meals[i]; if (!m) return;
    st.recipe = { p, i };
    $('recipeLbl').textContent = mealName(p, m);
    if (m.leftover) {
      const j = p.meals.findIndex(x => x.day === m.leftover && slotOf(x) === 'dinner');
      $('recipeBody').innerHTML = '<div><h3 translate="no">' + esc(m.title) + '</h3>' + tags(m) + '</div><p class="hint" style="margin:0 2px">The night before’s dinner, cooked double for today’s lunch.</p>'
        + (j >= 0 ? '<button class="btn" type="button" data-open="' + j + '">See that recipe</button>' : '');
      return openSheet('recipeSheet');
    }
    const up = lovedNow(m.title);
    $('recipeBody').innerHTML = '<div><h3 translate="no">' + esc(m.title) + '</h3><p class="cm">' + ([m.cuisine, m.method].filter(Boolean).length ? '<span translate="no">' + esc([m.cuisine, m.method].filter(Boolean).join(' · ')) + '</span> · ' : '') + '<span>' + esc('serves ' + p.people) + '</span></p>' + tags(m) + '</div>'
      + (m.veg && m.veg.length ? '<p class="hint" style="margin:0 2px">' + esc('Vegetables: ' + join(m.veg) + '. The vegetables and protein are Ipsy’s estimates.') + '</p>' : '')
      + (m.why ? '<p class="hint" style="margin:0 2px" translate="no">' + esc(m.why) + '</p>' : '')
      + '<p class="label">Ingredients</p><div class="rgroup"><ul>' + m.ingredients.map(x => '<li><span translate="no">' + esc(x.qty ? x.qty + ' ' : '') + esc(x.item) + '</span>'
        + (fromFridge(x.item, m) ? ' <span class="tag fr">In your fridge</span>' : '') + '</li>').join('') + '</ul></div>'
      + '<p class="label">Steps</p><div class="rgroup"><ol>' + m.steps.map(s => '<li translate="no">' + esc(s) + '</li>').join('') + '</ol></div>'
      + '<div class="opts rate" role="group" aria-label="What the family thought">'
      + '<button class="opt" type="button" role="checkbox" data-rate="up" aria-checked="' + (up === true) + '">' + ICON.up + 'Loved it</button>'
      + '<button class="opt" type="button" role="checkbox" data-rate="down" aria-checked="' + (up === false) + '">' + ICON.down + 'Not again</button></div>'
      + (p === data.plan || p === data.draft ? '<div class="btns two"><button class="btn" type="button" data-act="swap">Swap this meal</button><button class="btn okbtn" type="button" data-act="askmeal">Ask Ipsy about it</button></div>' : '')
      + '<p class="hint">Made by AI: check times, temperatures and labels.</p>';
    openSheet('recipeSheet');
  }
  $('recipeBody').addEventListener('click', async e => {
    const o = e.target.closest('[data-open]'); if (o) return openRecipe(+o.dataset.open, st.recipe.p);
    const r = e.target.closest('[data-rate]'), cur = st.recipe, m = cur && cur.p.meals[cur.i];
    if (r && m) {
      const want = r.getAttribute('aria-checked') === 'true' ? null : r.dataset.rate === 'up';
      try { const j = await api('rate', { title: m.title, up: want }); data.taste = j.taste; ls.set(KEY, data); }
      catch (err) { toast(say(err.code), null, 6000); return; }
      $('recipeBody').querySelectorAll('[data-rate]').forEach(x => x.setAttribute('aria-checked', want !== null && (x.dataset.rate === 'up') === want));
      toast(want === true ? 'Noted: Ipsy will make more like it.' : want === false ? 'Noted: Ipsy won’t make it again.' : 'Forgotten.');
      return;
    }
    const a = e.target.closest('[data-act]'); if (!a || !m) return;
    const which = (cur.p === data.draft ? 'the new plan’s ' : '') + mealName(cur.p, m);
    // Swap asks Ipsy straight away; Ask Ipsy opens the chat over the recipe (Ipsy sees which one is open)
    if (a.dataset.act === 'swap') { closeSheet('recipeSheet'); askIpsy('Swap ' + which + ' (' + m.title + ') for something else.'); } else askIpsy('');
  });

  // Ipsy, the helper you chat with, with what was typed (or a start for it)
  let ipsy = null;
  function askIpsy(t) {
    if (!ipsy) { toast('Ipsy isn’t ready yet. Try again in a moment.'); return; }
    if (t) ipsy.prompt(t); else ipsy.open();
  }

  // Settings: the family's rules (vegetables, protein, how many, weeknights, what they never eat), what
  // Ipsy has learned from the thumbs, your account
  const modelName = () => String(data.model || '').replace(/^.*\//, '').replace(/^claude-(\w+)-(\d+)-(\d+)$/, (_, n, a, b) => 'Claude ' + cap(n) + ' ' + a + '.' + b);
  let draft = null, draftAvoid = null;
  // the owner, or no one signed in yet (the server decides then)
  const canAvoid = () => { const u = A() && A().user(); return !u || u.role === 'owner'; };
  const avoidChip = a => canAvoid() ? '<button class="opt" type="button" aria-checked="true" data-avoid="' + esc(a) + '" aria-label="Remove ' + esc(a) + '"><span translate="no">' + esc(cap(a)) + '</span> ✕</button>'
    : '<span class="opt" aria-checked="true" translate="no">' + esc(cap(a)) + '</span>';
  function renderSettings() {
    const user = A() && A().user(), t = data.taste;
    const ai = data.ai === 'anthropic' ? modelName() + ', through Anthropic’s API' : st.state === 'ok' ? 'Not set up yet' : 'Unknown until you’re online';
    const sel = (id, opts, v) => '<select id="' + id + '">' + opts.map(([k, n]) => '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>';
    const learned = (who, a) => a.map(x => '<button class="opt" type="button" aria-checked="true" data-forget="' + esc(x.title) + '" aria-label="Forget ' + esc(x.title) + '"><span translate="no">' + esc(x.title) + '</span> ✕</button>').join('');
    $('setBody').innerHTML = '<p class="label">Design</p><div class="rgroup">' + (window.aosDesign ? aosDesign.picker() : '') + '</div>'
      + '<p class="label">Account</p><div class="rgroup acct"><p><strong' + (user ? ' translate="no"' : '') + '>' + esc(user ? user.name : 'Not signed in') + '</strong>'
      + (user ? '' : 'Sign in to plan for the family.') + '</p>'
      + (user ? '' : '<button class="btn" type="button" data-act="signin">Sign in with Face ID</button>') + '</div>'
      + '<p class="label" id="rulesHead">Family rules</p><div class="rgroup">'
      + '<div class="frow"><label for="sVeg">Vegetables<small>at least, in every meal</small></label><span class="step"><button class="iconbtn" type="button" data-veg="-1" aria-label="Fewer">−</button>'
      + '<output id="sVeg">' + draft.veg + '</output><button class="iconbtn" type="button" data-veg="1" aria-label="More">+</button></span></div>'
      + '<div class="frow"><span class="flabel" id="lPro">Protein<small>a person, every meal</small></span><span class="unit" role="radiogroup" aria-labelledby="lPro">'
      + PROTEIN.map(([k, n, g]) => '<button type="button" role="radio" data-protein="' + k + '" aria-pressed="' + (draft.protein === k) + '" aria-checked="' + (draft.protein === k) + '">' + esc(n + ' (' + g + ' g)') + '</button>').join('') + '</span></div>'
      + '<div class="frow"><label for="sPeople">Usually cooking for</label>' + sel('sPeople', Array.from({ length: 10 }, (_, i) => [i + 1, String(i + 1)]), draft.people) + '</div>'
      + '<div class="frow"><label for="sWeek">Weeknight dinners<small>ready in</small></label>' + sel('sWeek', WEEKNIGHT, draft.weeknight) + '</div></div>'
      // what the family avoids is a safety list: only the owner changes it (the server refuses anyone else)
      + '<p class="label">Never in a plan</p><div class="opts" id="avoid">' + draftAvoid.map(avoidChip).join('') + '</div>'
      + (canAvoid() ? '<div class="rgroup"><div class="frow"><label class="vh" for="sAdd">Add an allergy or dislike</label><input class="txt" id="sAdd" maxlength="40" placeholder="Add an allergy or dislike"><button class="btn quiet" type="button" id="sAddGo">Add</button></div></div>'
        : '<p class="hint">Only the owner can change what the family avoids.</p>')
      + '<p class="label">What Ipsy has learned</p>'
      + (t.loved.length ? '<p class="hint">Loved</p><div class="opts">' + learned('up', t.loved) + '</div>' : '')
      + (t.nope.length ? '<p class="hint">Not again</p><div class="opts">' + learned('down', t.nope) + '</div>' : '')
      + (t.loved.length || t.nope.length ? '' : '<p class="hint">Nothing yet. Use Loved it or Not again on a recipe, and Ipsy plans with it.</p>')
      + '<p class="hint">AI: ' + esc(ai) + '.</p>';
  }
  function openSettings() {
    const s = data.settings;
    draft = { veg: s.veg, protein: s.protein, people: s.people, weeknight: s.weeknight }; draftAvoid = [...(s.avoid || [])];
    renderSettings(); openSheet('setSheet');
  }
  if (window.aosDesign) aosDesign.bind($('setBody'));   // Design, at once (../home/design.js)
  $('setBtn').onclick = openSettings;
  $('setBody').addEventListener('click', async e => {
    if (e.target.closest('[data-act="signin"]')) { closeSheet('setSheet'); return signIn(); }
    const v = e.target.closest('[data-veg]');
    if (v) { draft.veg = Math.max(0, Math.min(5, draft.veg + +v.dataset.veg)); $('sVeg').textContent = draft.veg; return; }
    const pr = e.target.closest('[data-protein]');
    if (pr) { draft.protein = pr.dataset.protein; $('setBody').querySelectorAll('[data-protein]').forEach(x => { x.setAttribute('aria-pressed', x === pr); x.setAttribute('aria-checked', x === pr); }); return; }
    const fg = e.target.closest('[data-forget]');
    if (fg) {
      try { const j = await api('rate', { title: fg.dataset.forget, up: null }); data.taste = j.taste; ls.set(KEY, data); fg.remove(); toast('Forgotten.'); }
      catch (err) { toast(say(err.code), null, 6000); }
      return;
    }
    const rm = e.target.closest('[data-avoid]');
    if (rm && canAvoid()) { draftAvoid = draftAvoid.filter(a => a !== rm.dataset.avoid); rm.remove(); return; }
    if (e.target.closest('#sAddGo')) {
      const a = $('sAdd').value.trim().toLowerCase(); if (!a) return;
      if (!draftAvoid.includes(a)) { draftAvoid.push(a); $('avoid').insertAdjacentHTML('beforeend', avoidChip(a)); }
      $('sAdd').value = ''; return;
    }
  });
  $('setBody').addEventListener('change', e => {
    if (e.target.id === 'sPeople') draft.people = +e.target.value;
    if (e.target.id === 'sWeek') draft.weeknight = +e.target.value;
  });
  // Done (the tick) saves what was changed, then closes; with nothing changed it only closes
  $('sSave').addEventListener('click', async () => {
    const was = data.settings, body = { ...draft, ...(canAvoid() ? { avoid: draftAvoid } : {}) };
    const same = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
    if (['veg', 'protein', 'people', 'weeknight'].every(k => body[k] === was[k]) && (!('avoid' in body) || same(body.avoid, was.avoid))) return closeSheet('setSheet');
    try { const j = await api('settings', body); data.settings = Object.assign({}, DEFAULT_SETTINGS, j.settings); ls.set(KEY, data); scheduleSheet(); closeSheet('setSheet'); toast('Saved for the family.'); render(); }
    catch (err) { toast(say(err.code), null, 6000); }
  });

  // Tabs
  const slideTabs = jump => { const box = $('tabs'); if (window.AllisonOS && AllisonOS.slide) AllisonOS.slide(box, box.querySelector('[aria-pressed="true"]'), 'meals:tab', { jump }); };
  addEventListener('aos:design', () => requestAnimationFrame(() => slideTabs(true)));   // Futura and the system font are different widths
  $('tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b || b.dataset.tab === st.tab) return;
    st.tab = b.dataset.tab; ls.set(K.tab, st.tab); render(); slideTabs(false); animateIn(main); scrollTo(0, 0);
  });
  window.addEventListener('resize', () => slideTabs(true));

  // ---------------------------------------------------------------------
  // Sheets and the toast (as in Drinks)
  // ---------------------------------------------------------------------
  const focusStack = [];
  const lockPage = () => document.documentElement.classList.toggle('locked', [...document.querySelectorAll('.sheetwrap')].some(w => !w.hidden));
  function openSheet(id) { focusStack.push(document.activeElement); $(id).hidden = false; lockPage(); }
  function closeSheet(id) { if ($(id).hidden) return; $(id).hidden = true; lockPage(); const f = focusStack.pop(); if (f && f.focus && document.contains(f)) f.focus(); }
  document.querySelectorAll('.sheetwrap').forEach(w => w.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(w.id); }));
  if (window.visualViewport) {
    const vv = window.visualViewport, root = document.documentElement.style;
    const fit = () => { root.setProperty('--vvh', vv.height + 'px'); root.setProperty('--vvt', vv.offsetTop + 'px'); };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
  }
  document.addEventListener('focusin', e => { const el = e.target; if (el.matches && el.matches('input, select, textarea') && el.closest('.sheetbody')) setTimeout(() => el.scrollIntoView({ block: 'nearest' }), 350); });
  // Drag a sheet down by its handle or title bar to close it.
  document.querySelectorAll('.sheetwrap').forEach(w => {
    const sheet = w.querySelector('.sheet'), scrim = w.querySelector('.scrim');
    let y0 = null, t0 = 0, dy = 0, drag = false, suppress = false;
    const reset = () => { sheet.classList.remove('dragging', 'settling'); sheet.style.transform = ''; scrim.style.opacity = ''; };
    const start = (y, target) => { if (!target.closest('.grab, .sheethead') || target.closest('button')) { y0 = null; return; } y0 = y; t0 = Date.now(); dy = 0; drag = false; };
    const move = (y, e) => {
      if (y0 === null) return;
      dy = y - y0;
      if (!drag) { if (dy < 8) return; drag = true; sheet.classList.add('dragging'); }
      if (e.cancelable) e.preventDefault();
      const dd = Math.max(0, dy);
      sheet.style.transform = 'translateY(' + dd + 'px)'; scrim.style.opacity = String(Math.max(0, 1 - dd / sheet.offsetHeight));
    };
    const end = () => {
      if (y0 === null) return;
      y0 = null;
      if (!drag) return;
      suppress = true; setTimeout(() => { suppress = false; }, 50);
      const fast = dy / Math.max(1, Date.now() - t0) > 0.5;
      sheet.classList.remove('dragging'); sheet.classList.add('settling');
      if (dy > 110 || (fast && dy > 30)) { sheet.style.transform = 'translateY(100%)'; scrim.style.opacity = '0'; setTimeout(() => { closeSheet(w.id); reset(); }, 260); }
      else { sheet.style.transform = ''; scrim.style.opacity = ''; setTimeout(reset, 300); }
    };
    sheet.addEventListener('touchstart', e => { if (e.touches.length === 1) start(e.touches[0].clientY, e.target); }, { passive: true });
    sheet.addEventListener('touchmove', e => move(e.touches[0].clientY, e), { passive: false });
    sheet.addEventListener('touchend', end); sheet.addEventListener('touchcancel', end);
    sheet.addEventListener('mousedown', e => { if (e.button === 0) start(e.clientY, e.target); });
    window.addEventListener('mousemove', e => move(e.clientY, e)); window.addEventListener('mouseup', end);
    sheet.addEventListener('click', e => { if (suppress) { e.stopPropagation(); e.preventDefault(); } }, true);
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.sheetwrap')].reverse().find(w => !w.hidden);
    if (open) closeSheet(open.id);
  });
  let toastTimer;
  function toast(msg, undo, ms) {
    $('toastMsg').textContent = msg;
    $('toastAct').hidden = !undo;
    $('toastAct').onclick = () => { undo(); $('toast').hidden = true; };
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, ms || 4000);
  }
  function animateIn(el) { el.classList.add('enter'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('enter'), 900); }

  // ---------------------------------------------------------------------
  // The family's Google Sheet: the record of the family's dinners (aOS/SHEETS.md, google-sheet-sync.gs).
  // The family's server is the working copy (the plan, the rules, the last 52 plans: Claude plans
  // against it); Meals copies it to the Sheet, which keeps every plan ever accepted, and reads back from
  // the Sheet the plans the server no longer keeps: the last 90 days with each copy, and older ones when
  // you look back (Past plans → Older plans). Syncs go through aOS (../home/sheet.js,
  // functions/sheet/api), signed in, so the phone holds no Sheet link or phrase.
  // ---------------------------------------------------------------------
  const SHEET_APP = 'allison-meals-sync', KEEP_DAYS = 90;
  const SH = () => window.AllisonOS && AllisonOS.sheet;
  function signedIn() { return !!(A() && A().token()); }
  // sheetErrShown: a sync shows one toast a session at most, for a real error (aOS sets the Sheet up, so not for
  // 'signin' or 'no-sheet').
  let sheetBusy = false, sheetAgain = false, sheetTimer = null, sheetErrShown = false, sheetLast = '';
  let sheetAt = +ls.json(K.sheetAt, 0) || 0;
  // the plans the Sheet holds (by id, from its last answer: none known until one), and plans taken back here (Undo of Accept)
  const hadIds = ls.json(K.sheetHas, null);
  let sheetHas = new Set(Array.isArray(hadIds) ? hadIds : []), sheetKnows = Array.isArray(hadIds);
  const sheetGraves = (g => g && typeof g === 'object' && !Array.isArray(g) ? g : {})(ls.json(K.sheetGraves, {}));
  const sheetPlans = new Map();      // plans read back from the Sheet that the family server doesn't keep (any more)
  const sheetTried = new Set();      // past plans fetched to send this session (each once)
  const older = { from: '', done: false, busy: false };
  const SHEET_ERRORS = {
    signin: 'Sign in to sync with the family’s Google Sheet. Until then, Meals shows what the family server has.',
    'no-sheet': 'The family’s Meals Sheet isn’t set up yet. The owner sets it up in aOS: Account → Google Sheets.',
    'wrong-secret': 'aOS’s phrase for the Meals Sheet doesn’t match its script any more. The owner updates it in aOS: Account → Google Sheets.',
    'old-script': 'The Meals Sheet is still on its old script. The owner pastes in the new one and deploys a new version (aOS/SHEETS.md).',
    'secret-not-set': 'The Meals Sheet’s script still says SECRET = ‘CHANGE-ME’. The owner changes it and deploys a new version.',
    busy: 'The Sheet was busy. Trying again shortly.',
    offline: 'Offline. Meals will sync when you’re back online.',
    'sheet-unreachable': 'Couldn’t reach the Sheet. Trying again later.',
    'not-json': 'The Sheet didn’t answer as expected. Trying again later.',
  };

  // The link and phrase this phone used to keep (before aOS kept them: localStorage, a copy in IndexedDB,
  // or a #sync= setup link opened here): on the owner's phone they go to aOS once (it keeps them from then
  // on); on every phone, once aOS has them, they're forgotten here.
  const sheetKeep = (() => {
    let db = null;
    // At the old Meals Vintage address, once its copy (allison-mealsv) has been moved over (../home/design.js).
    const open = () => db || (db = Promise.resolve(window.aosDesign && aosDesign.moved).catch(() => {}).then(() => new Promise((res, rej) => {
      const r = indexedDB.open('allison-meals', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    })));
    const tx = (mode, fn) => open().then(d => new Promise((res, rej) => {
      const t = d.transaction('kv', mode), q = fn(t.objectStore('kv'));
      t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error);
    }));
    return {
      get: k => tx('readonly', x => x.get(k)).catch(() => null),
      set: (k, v) => tx('readwrite', x => v == null ? x.delete(k) : x.put(v, k)).catch(() => {}),
    };
  })();
  let linkCfg = null;
  if (location.hash.startsWith('#sync=')) {
    try { const c = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(6).replace(/-/g, '+').replace(/_/g, '/'))))); if (c && c.u && c.s) linkCfg = { url: c.u, secret: c.s }; } catch {}
    history.replaceState(null, '', location.pathname + location.search);
  }
  async function handOver() {
    const old = ls.json(K.sheet, null) || linkCfg || await sheetKeep.get('sheet');
    if (!old || !old.secret || !SH() || !signedIn()) return;
    if (await SH().adopt('meals', old)) { ls.del(K.sheet); ls.del(K.sheetSent); ls.del(K.sheetOldAt); sheetKeep.set('sheet', null); linkCfg = null; }
  }

  // A plan read back from the Sheet, as the app shows one (the Sheet keeps what it shows: no sale prices).
  // (Meals sends each meal's own date there, and "Breakfast: " or "Lunch: " before a title that isn't a dinner.)
  const fromSheet = x => {
    if (!x || typeof x.id !== 'string' || !Array.isArray(x.meals) || !/^\d{4}-\d\d-\d\d$/.test(x.start || '')) return null;
    const meals = x.meals.map((m, i) => { const t = /^(Breakfast|Lunch): (.+)$/.exec(m.title || '');
      return { ...m, day: m.day || i + 1, slot: t ? t[1].toLowerCase() : 'dinner', title: t ? t[2] : m.title, uses: m.uses || [], ingredients: m.ingredients || [], steps: m.steps || [] }; });
    const dates = Array.isArray(x.dates) ? x.dates : [], perMeal = dates.length === meals.length && new Set(meals.map(m => m.day)).size < meals.length;
    const byDay = []; if (perMeal) meals.forEach((m, i) => { byDay[m.day - 1] = byDay[m.day - 1] || dates[i]; });
    return { id: x.id, start: x.start, dates: perMeal ? byDay : dates, meat: x.meat || '', people: x.people || '', shop: x.shop || '', shopName: x.shopName || '',
      tip: x.tip || '', acceptedAt: x.at || 0, acceptedBy: x.planner || '', fromSheet: true, meals };
  };
  const gone = id => !!sheetGraves['plans:' + id];
  // what the Sheet sent back: the plans the family server doesn't keep are added to Past plans
  function takeSheetPlans(list, graves) {
    Object.keys(graves || {}).forEach(k => { if (k.startsWith('plans:')) sheetPlans.delete(k.slice(6)); });
    let n = 0;
    for (const x of list || []) {
      const p = fromSheet(x);
      if (!p || gone(p.id) || (graves && graves['plans:' + p.id]) || (data.log || []).some(e => e.id === p.id) || sheetPlans.has(p.id)) continue;
      sheetPlans.set(p.id, p); n++;
    }
    return n;
  }
  // Past plans: the family server's (newest first), then the older ones from the Sheet
  function pastList() {
    const log = data.log || [], ids = new Set(log.map(e => e.id));
    const more = [...sheetPlans.values()].filter(p => !ids.has(p.id) && !gone(p.id)).sort((a, b) => b.start.localeCompare(a.start) || b.acceptedAt - a.acceptedAt)
      .map(p => ({ id: p.id, start: p.start, end: p.dates[p.dates.length - 1] || p.start, meat: p.meat, people: p.people, titles: p.meals.map(m => m.title) }));
    return log.concat(more);
  }
  // A plan taken back (Undo of Accept, in Ipsy): the log shrinks. Its grave tells the Sheet, so a phone that
  // still has it doesn't bring it back. (An accept never shrinks the log: past 52 the oldest just drops.)
  function noteGone(before, after) {
    if (!Array.isArray(before) || !Array.isArray(after) || after.length >= before.length) return;
    const now = new Set(after.map(e => e.id));
    for (const e of before) if (!now.has(e.id)) { sheetGraves['plans:' + e.id] = Date.now(); sheetHas.delete(e.id); sheetPlans.delete(e.id); }
    const old = Date.now() - 400 * 864e5;
    for (const k of Object.keys(sheetGraves)) if (sheetGraves[k] < old) delete sheetGraves[k];
    ls.set(K.sheetGraves, sheetGraves);
  }

  // What goes to the Sheet. Each plan is whole, stamped with when this phone read it from the family server,
  // so the newest copy wins there. The current plan always goes; past plans the Sheet doesn't hold yet (it
  // says which it holds) are fetched whole, once a session, three at a time. Its Plans tab has a row a meal
  // with the date beside it: dinners first (an older Sheet script keeps 14 meals a plan), each meal with its
  // own date, "Breakfast: " or "Lunch: " before its title, and no leftover lunches (no recipe of their own).
  const sheetPlan = p => { const { sales, by, got, fromSheet: f, dates, foods, slots, ...rest } = p;
    const rank = m => ['dinner', 'lunch', 'breakfast'].indexOf(slotOf(m)) * 10 + (m.day || 0);
    const meals = p.meals.filter(m => !m.leftover).slice().sort((a, b) => rank(a) - rank(b));
    return { ...rest, meat: foods ? foodWords(p) : p.meat, shopName: foods ? cap(slotWords(p)) : '', dates: meals.map(m => dateOf(p, m.day || 1)),
      meals: meals.map(m => ({ ...m, title: slotOf(m) === 'dinner' ? m.title : slotName(m) + ': ' + m.title })),
      updated: Math.max(+p.acceptedAt || 0, +got || (data.plan && p.id === data.plan.id ? +data.got || 0 : 0)) }; };
  async function wholePlan(id) {
    if (data.plan && data.plan.id === id) return data.plan;
    if (pastCache[id]) return pastCache[id];
    if (sheetPlans.has(id)) return sheetPlans.get(id);
    const p = (await api('log/' + id)).plan;
    return (pastCache[id] = p && { ...p, got: Date.now() });
  }
  function sheetShopping() {
    const p = data.plan;
    if (!p || !p.meals || !p.meals.length) return { buy: [], pantry: [] };
    const s = shop();
    return {
      buy: L.sections(s.buy, x => x.item).flatMap(g => g.items.map(x => ({ section: g.name, item: cap(x.item), amount: L.total(x.amounts), nights: whenWords(x, p), sale: '' }))),
      pantry: s.pantry.map(x => ({ item: cap(x.item), amount: L.total(x.amounts), nights: whenWords(x, p) })),
    };
  }
  // (only with the family server answering: a call that fails with a 401 would ask for Face ID, and a copy never should)
  const missing = () => !sheetKnows || st.state !== 'ok' ? [] : (data.log || []).map(e => e.id)
    .filter(id => !sheetHas.has(id) && !sheetTried.has(id) && !gone(id) && !(data.plan && data.plan.id === id)).slice(0, 52);
  async function sheetSnapshot() {
    const cur = data.plan && data.plan.meals ? data.plan : null, plans = cur ? [sheetPlan(cur)] : [];
    const todo = missing();
    todo.forEach(id => sheetTried.add(id));
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const id = todo[i++];
        try { const p = await wholePlan(id); if (p && Array.isArray(p.meals)) plans.push(sheetPlan(p)); } catch {}
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    // (deals: none now; the Sheet keeps the weeks it had. Its Settings tab: the family's rules in its Stores row.)
    const deals = [], set = data.settings || {};
    const settings = { stores: [rulesLine().split(' · ')[0], 'cooking for ' + set.people, set.weeknight ? 'weeknight dinners in ' + set.weeknight + ' min' : 'no weeknight limit'], cards: [], avoid: set.avoid || [], model: modelName() };
    const shopping = sheetShopping();
    // what's compared with the last copy: the current plan (not when it was read), the rest, and the graves
    const key = JSON.stringify({ cur: cur && { ...sheetPlan(cur), updated: 0 }, deals, shopping, settings, graves: sheetGraves });
    return { key, more: plans.length - (cur ? 1 : 0), body: { plans, deals, shopping, settings } };
  }
  // Always quietly, when signed in: aOS sets the Sheet up, and Meals syncs by itself.
  async function sheetSync() {
    if (!SH() || !signedIn()) return false;
    if (sheetBusy) { sheetAgain = true; return false; }
    if (!navigator.onLine) return false;
    sheetBusy = true;
    let ok = false;
    try {
      const snap = await sheetSnapshot();
      if (snap.key === sheetLast && !snap.more) { ok = true; return true; }   // nothing new since the last copy
      const res = await SH().sync('meals', Object.assign({ action: 'sync', v: 3, window: KEEP_DAYS, today: isoDay(new Date()) }, snap.body, { graves: sheetGraves }));
      if (res.app && res.app !== SHEET_APP) throw new Error('not-json');
      if (!res.aos) throw new Error('old-script');
      sheetLast = snap.key;
      if (Array.isArray(res.planIds)) { sheetHas = new Set(res.planIds); sheetKnows = true; ls.set(K.sheetHas, res.planIds.slice(-2000)); }
      sheetAt = Date.now(); ls.set(K.sheetAt, sheetAt);
      ok = true;
      if (takeSheetPlans(res.plans, res.graves)) render();
      if (missing().length) sheetAgain = true;   // the Sheet lacks some of the family server's plans: they go next
    } catch (e) {
      const code = e.message;
      if (!sheetErrShown && !['signin', 'no-sheet', 'offline'].includes(code)) { sheetErrShown = true; toast(SHEET_ERRORS[code] || 'The family’s Google Sheet didn’t sync. Trying again later.', null, 6000); }
    } finally {
      sheetBusy = false;
      if (sheetAgain) { sheetAgain = false; scheduleSheet(800); }
    }
    return ok;
  }
  function scheduleSheet(ms) { clearTimeout(sheetTimer); sheetTimer = setTimeout(() => sheetSync(), ms == null ? 2500 : ms); }

  // Looking back past the plans the family server keeps: a year at a time from the Sheet (if a year has
  // none, everything before it at once), each range once a session.
  async function loadOlder() {
    if (older.busy || older.done || !SH()) return;
    older.busy = true; render();
    try {
      if (!older.from) {
        const floor = addDays(isoDay(new Date()), -(KEEP_DAYS - 1)), first = (data.log || []).map(e => e.start).filter(Boolean).sort()[0];
        older.from = first && first < floor ? first : floor;
      }
      const ask = async (from, to) => { const res = await SH().sync('meals', { action: 'range', from, to }, { ask: true }); older.from = from; return takeSheetPlans(res.plans); };
      const from = addDays(older.from, -365);
      let n = await ask(from, addDays(older.from, -1));
      if (!n) n = await ask('2000-01-01', addDays(from, -1));
      if (older.from === '2000-01-01') older.done = true;
      toast(n ? 'Found ' + plural(n, 'older plan') + ' in the family’s Google Sheet.' : 'No older plans in the family’s Google Sheet.');
    } catch (e) { toast(SHEET_ERRORS[e.message] || 'Couldn’t reach the family’s Google Sheet. Try again later.', null, 6000); }
    older.busy = false; render();
  }

  // ---------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------
  render();
  animateIn(main);
  load();
  setTimeout(() => handOver(), 600);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !st.busy) load(); });
  window.addEventListener('online', () => { if (!st.busy) load(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // the app's own save, for Ipsy's changes: the copy on this phone, the family's Google Sheet (a plan taken
  // back leaves it), the screen
  function keep(patch) { if (patch.log) noteGone(data.log, patch.log); Object.assign(data, patch, { got: Date.now() }); ls.set(KEY, data); scheduleSheet(); render(); }

  // Ipsy (../home/ipsy.js), the helper you chat with: its tools (ipsy-tools.js) read this same
  // data and change the family's plan only through this app's own server calls (api), so the
  // server's allergy check applies to everything it saves; Claude answers through functions/meals/api (ipsy).
  if (window.AllisonOS && window.AllisonOS.ipsy && window.MealsIpsy) {
    const TAB_NAMES = { ipsy: 'the Ipsy tab (planning a new plan)', plan: 'the Plan tab', list: 'the List tab (the shopping list)' };
    ipsy = window.AllisonOS.ipsy.mount({
      app: 'meals', name: 'Meals', endpoint: '../meals/api/ipsy', headers: { 'X-Meals': '1' }, slot: document.querySelector('.dock > span'),
      ...window.MealsIpsy({
        L, api, say, toast, shopOf, dayLabel, dateOf, slotName, about, past: wholePlan,
        get data() { return data; }, state: () => st.state,
        keep,
        today: () => isoDay(new Date()),
        planning: ask => { st.busy = ask ? 'plan' : null; st.planning = ask && { ...ask, n: (ask.days || 1) * (ask.slots || ['dinner']).length }; if (ask) { st.tab = 'plan'; ls.set(K.tab, st.tab); } render(); slideTabs(true); },
        ticked: () => data.plan && ticks.at === data.plan.at ? ticks.keys.slice() : [],
        setTicks: keys => { ticks = { at: data.plan && data.plan.at, keys: keys.slice() }; ls.set(K.ticks, ticks); render(); },
        show: (p, i) => { st.tab = 'plan'; ls.set(K.tab, st.tab); render(); slideTabs(true); openRecipe(i, p); },
        screen: () => !$('recipeSheet').hidden ? 'the recipe for ' + $('recipeLbl').textContent + (st.recipe ? ' (' + st.recipe.p.meals[st.recipe.i].title + ')' : '') : TAB_NAMES[st.tab] || 'Meals',
      }),
    });
  }

  // For the tests (meals/scripts/app-test.mjs) only.
  window.__meals = { st, flow, data: () => data, render, load, makePlan, openRecipe, openPast, openSettings, keep, sheetSync, loadOlder, sheetPlans: () => [...sheetPlans.keys()], graves: () => sheetGraves };
})();
