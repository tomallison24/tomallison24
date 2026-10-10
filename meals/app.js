"use strict";

// Meals: dinner for the family.
//
// - Three tabs on one screen: Dinners (this week's plan, each night opening to
//   its recipe), Deals (this week's sales at the family's Whole Foods, in the
//   same grocery sections as Notes' grocery lists) and List (what to buy for
//   the plan, in those sections, ticked off in the store).
// - + plans dinners: a meat, how many nights and people, and whether to build
//   them around this week's deals. Each night is a different cuisine and way
//   of cooking, and different from what the family had lately.
// - The plan and the deals are the family's, made by an AI model on the
//   server (functions/meals/api), which also checks every plan against what
//   the family avoids. The last ones are kept on this phone
//   (allison-meals-v1), so the list works in the store with no signal; ticks
//   stay on this phone only.
// - Settings (the gear): the store, Prime prices, what the family avoids, and
//   your account.

// Refuse to run inside another page's frame (see Mail's app.js for why).
if (window.top !== window.self) {
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
  };
  // (v2: deals by store. The v1 copy, one store's deals, is left behind.)
  const KEY = 'allison-meals-v2', K = { ticks: 'allison-meals-v1-ticks', tab: 'allison-meals-v1-tab', store: 'allison-meals-v1-store' };
  const plural = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
  const cap = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
  const MEATS = [['chicken', 'Chicken'], ['beef', 'Beef'], ['pork', 'Pork'], ['turkey', 'Turkey'], ['lamb', 'Lamb'], ['salmon', 'Salmon'], ['white fish', 'White fish'], ['shrimp', 'Shrimp'], ['on sale', 'Whatever’s on sale']];
  const ICON = {
    tick: '<svg viewBox="0 0 24 24" class="b"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8.4" y="8.4" width="11.6" height="11.6" rx="2.4"/><path d="M15.6 8.4V6.2A2.2 2.2 0 0 0 13.4 4H6.2A2.2 2.2 0 0 0 4 6.2v7.2a2.2 2.2 0 0 0 2.2 2.2h2.2"/></svg>',
  };

  // The stores Meals knows (the server's STORES; this copy until it answers).
  const STORES = [['wholefoods', 'Whole Foods', 'Whole Foods Market, 102 New Waverly Pl, Cary, NC', 'prime', 'Prime'], ['harristeeter', 'Harris Teeter', 'Harris Teeter, 750 W Williams St, Apex, NC', 'vic', 'VIC'],
    ['publix', 'Publix', 'Publix, 1441 Kelly Rd, Apex, NC'], ['lidl', 'Lidl', 'Lidl, 670 Grand Central Station, Apex, NC'], ['lowesfoods', 'Lowes Foods', 'Lowes Foods, 5400 Apex Peakway, Apex, NC'],
    ['aldi', 'Aldi', 'Aldi, 1770 W Williams St, Apex, NC'], ['walmart', 'Walmart', 'Walmart Supercenter, 3151 Apex Peakway, Apex, NC'], ['target', 'Target', 'Target, 1201 Beaver Creek Commons Dr, Apex, NC']]
    .map(([id, name, where, card, cardName]) => ({ id, name, where, card, cardName }));
  const CARDS = [['prime', 'Amazon Prime (Whole Foods)'], ['vic', 'VIC (Harris Teeter)']];

  // ---------------------------------------------------------------------
  // The family's Meals: { ai, week, stores, settings, deals: { store id: deals },
  // plan } from the server, the last copy kept here for when there's no signal.
  // ---------------------------------------------------------------------
  let data = ls.json(KEY, null) || { ai: null, model: null, week: '', stores: STORES, settings: { stores: STORES.map(x => x.id), cards: ['prime', 'vic'], avoid: ['tree nuts', 'coconut'] }, deals: {}, plan: null };
  const st = { tab: ['dinners', 'deals', 'list'].includes(ls.json(K.tab, '')) ? ls.json(K.tab, '') : 'dinners', store: ls.json(K.store, ''), state: 'idle', busy: null, error: '' };
  const storeById = id => (data.stores || STORES).find(x => x.id === id) || null;
  const mine = () => (data.settings.stores || []).map(storeById).filter(Boolean);
  // this week's deals at these stores, as one list, each item saying where it is
  const weekItems = ids => ({ items: ids.flatMap(id => { const d = (data.deals || {})[id], s = storeById(id); return d && d.week === data.week && s ? d.items.map(x => ({ ...x, at: s })) : []; }) });
  const shopIds = shop => shop === 'all' ? data.settings.stores || [] : [shop];
  const memberTag = x => x.member && x.at && x.at.cardName ? ' <span class="prime">' + esc(x.at.cardName) + '</span>' : '';
  let ticks = ls.json(K.ticks, { at: 0, keys: [] });

  const A = () => window.AllisonOS && window.AllisonOS.account;
  async function api(path, body) {
    const opts = { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Meals': '1' }, cache: 'no-store' };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let r;
    try { r = A() ? await A().fetch('api/' + path, opts) : await fetch('api/' + path, opts); }
    catch { throw Object.assign(new Error('offline'), { code: 'offline' }); }
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) throw Object.assign(new Error(j.error || 'http-' + r.status), { code: j.error || (r.status === 404 ? 'off' : 'server') });
    return j;
  }
  const SAY = {
    'no-ai': 'Meals needs its AI key first: the owner adds it (see Meals’ README).',
    'accounts-off': 'Family accounts aren’t switched on yet, so Meals can’t plan for the family.',
    'setup': 'Family accounts aren’t switched on yet, so Meals can’t plan for the family.',
    'signin': 'Sign in with your family account to see the family’s dinners.',
    'off': 'Meals’ server isn’t set up on this site.',
    'offline': 'You’re offline. Showing what this phone kept.',
    'ai-key': 'The AI service didn’t accept Meals’ key. The owner can check it.',
    'ai-busy': 'The AI service is busy. Try again in a minute.',
    'ai-unreachable': 'Couldn’t reach the AI service. Try again in a minute.',
    'ai-format': 'That didn’t come back right. Try again.',
    'avoid': 'Every plan it made used something the family avoids, so none was kept. Try again, or pick another meat.',
  };
  const say = code => SAY[code] || 'Something went wrong. Try again in a minute.';

  async function load() {
    st.state = 'loading';
    try {
      const j = await api('state');
      data = { ai: j.ai, model: j.model, week: j.week, stores: j.stores || STORES, settings: j.settings, deals: j.deals || {}, plan: j.plan };
      ls.set(KEY, data); st.state = 'ok'; st.error = '';
    } catch (e) { st.state = e.code; st.error = e.code; }
    render();
  }

  // ---------------------------------------------------------------------
  // The screen
  // ---------------------------------------------------------------------
  const main = $('main');
  // the store the Deals tab shows: one of the family's, or 'all'
  const curStore = () => st.store === 'all' || mine().some(x => x.id === st.store) ? st.store : (mine()[0] || {}).id || 'all';
  const notice = () => {
    if (!st.error || st.error === 'loading') return '';
    const signin = st.error === 'signin';
    return '<div class="card" style="--i:0"><p>' + esc(say(st.error)) + '</p>' + (signin ? '<div class="btns"><button class="btn" type="button" data-act="signin">Sign in with Face ID</button></div>' : '') + '</div>';
  };
  const noAI = () => data.ai === null && st.state === 'ok';
  const thisWeek = d => d && d.week === data.week;
  const busyCard = (title, line) => '<div class="card busy" role="status" style="--i:1"><span class="spin" aria-hidden="true"></span><strong>' + esc(title) + '</strong>' + esc(line) + '</div>';

  function render() {
    document.querySelectorAll('#tabs [data-tab]').forEach(b => { const on = b.dataset.tab === st.tab; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
    slideTabs(true);
    $('fab').hidden = st.tab !== 'dinners';
    main.innerHTML = notice() + (st.tab === 'dinners' ? dinners() : st.tab === 'deals' ? deals() : list());
  }

  function dinners() {
    const p = data.plan;
    if (st.busy === 'plan') return busyCard('Planning ' + plural(st.planning.days, 'dinner') + '…', 'Different every night, and nothing the family avoids. This takes about half a minute.');
    if (!p || !p.meals || !p.meals.length) {
      return '<div class="card" style="--i:1"><strong>No dinners planned yet</strong><p>Pick a meat, and Meals plans a few nights of different dinners for the family: a different cuisine and way of cooking each night, using this week’s deals.</p>'
        + '<div class="btns"><button class="btn okbtn" type="button" data-act="plan"' + (noAI() ? ' disabled' : '') + '>Plan dinners</button></div></div>';
    }
    const when = new Date(p.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const at = p.shop && p.shop !== 'all' && storeById(p.shop) ? ' · ' + storeById(p.shop).name : '';
    let h = '<p class="sechead"><span>' + (thisWeek(p) ? 'This week' : 'Last planned') + ' · ' + esc(cap(p.meat)) + ' · for ' + p.people + esc(at) + '</span><span>' + esc(when) + '</span></p>';
    h += p.meals.map((m, i) => '<button class="card rgroup" type="button" data-meal="' + i + '" style="--i:' + (i + 1) + '">'
      + '<span class="night">Night ' + m.day + '</span><span class="ct">' + esc(m.title) + '</span>'
      + '<span class="cm">' + esc([m.cuisine, m.method, m.minutes ? m.minutes + ' min' : ''].filter(Boolean).join(' · ')) + '</span>'
      + (m.uses && m.uses.length ? '<span class="saletag">On sale: ' + esc(m.uses.join(', ')) + '</span>' : '') + '</button>').join('');
    if (p.tip) h += '<div class="card" style="--i:' + (p.meals.length + 1) + '"><p><b>Tip:</b> ' + esc(p.tip) + '</p></div>';
    if (p.by) h += '<p class="hint">Planned by ' + esc(p.by) + '. Everyone in the family sees this plan.</p>';
    return h;
  }

  function deals() {
    const cur = curStore(), all = cur === 'all', store = storeById(cur), d = all ? null : (data.deals || {})[cur];
    const has = id => thisWeek((data.deals || {})[id]) && data.deals[id].items.length;
    const pick = '<div class="frow storepick"><label for="dStore">Store</label><select id="dStore">'
      + mine().map(x => '<option value="' + x.id + '"' + (x.id === cur ? ' selected' : '') + '>' + esc(x.name) + (has(x.id) ? ' ✓' : '') + '</option>').join('')
      + (mine().length > 1 ? '<option value="all"' + (all ? ' selected' : '') + '>All my stores</option>' : '') + '</select></div>';
    const off = noAI() || st.busy ? ' disabled' : '';
    let h = '<div class="card" style="--i:1">' + pick;
    if (all) {
      const n = mine().filter(x => has(x.id)).length;
      h += '<p>' + esc(n + ' of ' + plural(mine().length, 'store') + ' have this week’s deals. ' + L.weekLabel(data.week || '')) + '</p>'
        + '<div class="btns"><button class="btn" type="button" data-act="find-all"' + off + '>' + (n < mine().length ? 'Find deals at the rest' : 'All found') + '</button></div></div>';
    } else {
      const card = store.cardName && (data.settings.cards || []).includes(store.card) ? ' · ' + store.cardName + ' prices' : '';
      h += '<p>' + esc(store.where.replace(/^[^,]+,\s*/, '') + ' · ' + (d && d.items && d.items.length ? (thisWeek(d) ? 'This week' : 'An earlier week') + ', ' + L.weekLabel(d.week, d.validFrom, d.validTo) : 'Sales usually run Wednesday to Tuesday') + card) + '</p>'
        + '<div class="btns"><button class="btn" type="button" data-act="find"' + off + '>' + (thisWeek(d) ? 'Look again' : 'Find this week’s deals') + '</button>'
        + '<button class="btn quiet" type="button" data-act="paste"' + off + '>Paste deals</button></div></div>';
    }
    if (st.busy === 'deals') return h + busyCard('Looking for this week’s sales…', st.finding || 'This can take up to a minute.');
    // all stores: the same thing at different stores side by side, to compare
    const items = all ? weekItems(data.settings.stores || []).items.sort((a, b) => a.name.localeCompare(b.name, 'en-US')) : d && d.items ? d.items.map(x => ({ ...x, at: store })) : [];
    if (!items.length) return h + '<div class="empty" style="--i:2"><strong>No deals yet</strong>' + (all ? 'Find each store’s deals, and they all show here together, sorted like a grocery list.' : 'Find this week’s deals, or paste them from ' + esc(store.name) + '’s app, and they’re sorted here like a grocery list.') + '</div>';
    h += L.sections(items, x => x.name).map((g, i) => '<p class="sechead"><span>' + esc(g.name) + '</span><span>' + g.items.length + '</span></p><div class="rgroup" style="--i:' + (i + 2) + '">'
      + g.items.map(x => '<div class="drow"><span class="dn">' + esc(x.name) + ((all ? [x.at.name] : []).concat(x.note ? [x.note] : []).length ? '<small>' + esc((all ? [x.at.name] : []).concat(x.note ? [x.note] : []).join(' · ')) + '</small>' : '') + '</span>'
        + '<span class="dp">' + esc(x.price || '') + memberTag(x) + (x.regular ? '<small>usually ' + esc(x.regular) + '</small>' : '') + '</span></div>').join('') + '</div>').join('');
    h += '<button class="btn okbtn" type="button" data-act="plan-deals"' + (noAI() ? ' disabled' : '') + '>Plan dinners with ' + (all ? 'the best of these' : 'these deals') + '</button>';
    const src = all ? [] : (d.sources || []);
    if (src.length) h += '<p class="src">Found on: ' + src.map(u => { let host = u; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch {} return '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(host) + '</a>'; }).join(', ') + '. Check prices in the store: they can be wrong or change.</p>';
    else h += '<p class="src">' + (!all && d.how === 'paste' ? 'From the sales you pasted. ' : '') + 'Check prices in the store: they can change.</p>';
    return h;
  }

  // the plan's sale items: its store's this week, or every store's for a plan across stores
  const planDeals = () => data.plan ? weekItems(shopIds(data.plan.shop || 'all')) : null;
  const saleTag = x => x.deal ? '<span class="saletag">On sale' + (data.plan && data.plan.shop !== 'all' ? ' ' : ' at ' + esc(x.deal.at.name) + ' ') + esc(x.deal.price || '') + '</span>' : '';
  function shop() { return L.shopping((data.plan && data.plan.meals) || [], planDeals()); }
  function list() {
    const p = data.plan;
    if (!p || !p.meals || !p.meals.length) return '<div class="empty" style="--i:1"><strong>Nothing to buy yet</strong>Plan dinners, and everything they need shows here, sorted like a grocery list.</div>';
    if (ticks.at !== p.at) ticks = { at: p.at, keys: [] };
    const s = shop(), done = new Set(ticks.keys);
    const row = x => '<button class="irow" type="button" role="checkbox" aria-checked="' + done.has(x.key) + '" data-key="' + esc(x.key) + '"><span class="box">' + ICON.tick + '</span>'
      + '<span class="it">' + esc(cap(x.item)) + '<small>' + esc([L.total(x.amounts), 'night' + (x.nights.length > 1 ? 's ' : ' ') + x.nights.join(', ')].filter(Boolean).join(' · ')) + '</small>'
      + saleTag(x) + '</span></button>';
    const groups = L.sections(s.buy, x => x.item);
    let h = groups.map((g, i) => '<p class="sechead"><span>' + esc(g.name) + '</span><span>' + g.items.filter(x => !done.has(x.key)).length + '</span></p><div class="rgroup" style="--i:' + (i + 1) + '">' + g.items.map(row).join('') + '</div>').join('');
    if (s.pantry.length) h += '<p class="sechead"><span>You probably have</span><span>' + s.pantry.length + '</span></p><div class="rgroup">' + s.pantry.map(row).join('') + '</div>';
    h += '<div class="card"><div class="btns" style="margin-top:0"><button class="btn" type="button" data-act="copy">' + ICON.copy + 'Copy the list</button>'
      + (done.size ? '<button class="btn quiet" type="button" data-act="untick">Clear ticks</button>' : '') + '</div></div>'
      + '<p class="hint">Copy it into a grocery list in Notes, or anywhere. Ticks stay on this phone.</p>';
    return h;
  }

  // ---------------------------------------------------------------------
  // Doing things
  // ---------------------------------------------------------------------
  main.addEventListener('click', async e => {
    const b = e.target.closest('[data-act], [data-meal], [data-key]'); if (!b) return;
    if (b.dataset.meal) return openRecipe(+b.dataset.meal);
    if (b.dataset.key) {
      const k = b.dataset.key, i = ticks.keys.indexOf(k);
      if (i < 0) ticks.keys.push(k); else ticks.keys.splice(i, 1);
      ls.set(K.ticks, ticks); b.setAttribute('aria-checked', i < 0);
      return;
    }
    const act = b.dataset.act;
    if (act === 'plan') return openPlan(false);
    if (act === 'plan-deals') return openPlan(true);
    if (act === 'find') return findDeals();
    if (act === 'find-all') return findAll();
    if (act === 'paste') { $('pasteText').value = ''; openSheet('pasteSheet'); setTimeout(() => $('pasteText').focus(), 300); return; }
    if (act === 'signin') return signIn();
    if (act === 'untick') { ticks.keys = []; ls.set(K.ticks, ticks); render(); return; }
    if (act === 'copy') {
      const s = shop(), text = L.listText(L.sections(s.buy, x => x.item));
      try { await navigator.clipboard.writeText(text); toast('Copied ' + plural(s.buy.length, 'item') + '.'); }
      catch { toast('Couldn’t copy on this phone.'); }
    }
  });
  async function signIn() {
    try { await A().signIn(); toast('Signed in.'); load(); }
    catch (err) { toast(err && err.name === 'NotAllowedError' ? 'No passkey found, or canceled. Set up your account in aOS first.' : 'Couldn’t sign in.'); }
  }
  addEventListener('aos:account', e => { if (e.detail) load(); });
  main.addEventListener('change', e => { if (e.target.id === 'dStore') { st.store = e.target.value; ls.set(K.store, st.store); render(); } });

  // one store's deals: searched for, or read from pasted text
  async function oneStore(id, text) {
    const j = await api('deals', text ? { store: id, text } : { store: id, refresh: thisWeek((data.deals || {})[id]) });
    if (j.deals && j.deals.items.length) { data.deals = Object.assign({}, data.deals, { [id]: j.deals }); ls.set(KEY, data); }
    return j.deals ? j.deals.items.length : 0;
  }
  async function findDeals(text) {
    const id = curStore(), s = storeById(id); if (!s) return;
    st.busy = 'deals'; st.finding = 'At ' + s.name + '. This can take up to a minute.'; st.tab = 'deals'; render();
    try {
      const n = await oneStore(id, text);
      toast(n ? 'Found ' + plural(n, 'deal') + ' at ' + s.name + '.' : text ? 'No food deals in that text.' : 'Couldn’t find ' + s.name + '’s sales online this week. Paste them from its app instead.', null, n ? 4000 : 7000);
    } catch (e) { toast(say(e.code), null, 7000); }
    st.busy = null; render();
  }
  // every store without this week's deals yet, one after another
  async function findAll() {
    const todo = mine().filter(x => !(thisWeek((data.deals || {})[x.id]) && data.deals[x.id].items.length));
    let found = 0, none = [];
    st.busy = 'deals'; st.tab = 'deals';
    for (const [i, s] of todo.entries()) {
      st.finding = s.name + ' (' + (i + 1) + ' of ' + todo.length + '). About half a minute a store.'; render();
      try { const n = await oneStore(s.id); found += n; if (!n) none.push(s.name); }
      catch (e) { st.busy = null; render(); toast(say(e.code), null, 7000); return; }
    }
    st.busy = null; render();
    toast('Found ' + plural(found, 'deal') + (none.length ? '. None online for ' + none.join(', ') + ': paste theirs from their apps.' : '.'), null, none.length ? 8000 : 4000);
  }
  $('pasteGo').onclick = () => {
    const t = $('pasteText').value.trim();
    if (t.length < 20) { toast('Paste the sales first.'); return; }
    closeSheet('pasteSheet'); findDeals(t);
  };

  // A new plan
  const form = { meat: 'chicken', days: 4, people: 4, useDeals: true, shop: 'all', note: '' };
  const haveDeals = shop => weekItems(shopIds(shop)).items.length > 0;
  function openPlan(withDeals) {
    if (data.plan) Object.assign(form, { meat: data.plan.meat, days: data.plan.days, people: data.plan.people, shop: data.plan.shop || 'all' });
    if (withDeals) form.shop = curStore();
    if (form.shop !== 'all' && !mine().some(x => x.id === form.shop)) form.shop = 'all';
    form.useDeals = haveDeals(form.shop) && (withDeals || form.useDeals);
    const nums = (a, b, v) => Array.from({ length: b - a + 1 }, (_, i) => a + i).map(n => '<option' + (n === v ? ' selected' : '') + '>' + n + '</option>').join('');
    $('planBody').innerHTML = '<p class="label">Built around</p><div class="opts" id="meats" role="radiogroup" aria-label="Built around">'
      + MEATS.map(([k, n]) => '<button class="opt" type="button" role="radio" data-meat="' + k + '" aria-checked="' + (form.meat === k) + '">' + esc(n) + '</button>').join('') + '</div>'
      + '<div class="rgroup">'
      + '<div class="frow"><label for="pDays">Nights</label><select id="pDays">' + nums(2, 7, form.days) + '</select></div>'
      + '<div class="frow"><label for="pPeople">People</label><select id="pPeople">' + nums(1, 8, form.people) + '</select></div>'
      + '<div class="frow"><label for="pShop">Shop at</label><select id="pShop"><option value="all"' + (form.shop === 'all' ? ' selected' : '') + '>Best deals, any store</option>'
      + mine().map(x => '<option value="' + x.id + '"' + (form.shop === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></div>'
      + '<div class="frow"><label for="pDeals">Use this week’s deals</label>' + dealsPick() + '</div>'
      + '<div class="frow"><label class="vh" for="pNote">Anything else</label><input class="txt" id="pNote" maxlength="200" placeholder="Anything else? (kid-friendly, no spice…)" value="' + esc(form.note) + '"></div></div>'
      + '<p class="hint">Never ' + esc((data.settings.avoid || []).join(' or ') || 'anything you’ve listed') + ': every plan is checked before it’s kept. Change this in settings (the gear).</p>'
      + '<button class="btn okbtn" type="button" id="planGo">Plan ' + plural(form.days, 'dinner') + '</button>';
    openSheet('planSheet');
  }
  $('planBody').addEventListener('click', e => {
    const m = e.target.closest('[data-meat]');
    if (m) { form.meat = m.dataset.meat; $('meats').querySelectorAll('[data-meat]').forEach(x => x.setAttribute('aria-checked', x === m)); return; }
    if (e.target.closest('#planGo')) makePlan();
  });
  function dealsPick() {
    const have = haveDeals(form.shop);
    return '<select id="pDeals"' + (have ? '' : ' disabled') + '><option value="1"' + (form.useDeals && have ? ' selected' : '') + '>Yes</option><option value="0"' + (form.useDeals && have ? '' : ' selected') + '>' + (have ? 'No' : 'None found yet') + '</option></select>';
  }
  $('planBody').addEventListener('change', e => {
    if (e.target.id === 'pShop') { form.shop = e.target.value; form.useDeals = haveDeals(form.shop); $('pDeals').outerHTML = dealsPick(); }
    if (e.target.id === 'pDays') { form.days = +e.target.value; $('planGo').textContent = 'Plan ' + plural(form.days, 'dinner'); }
    if (e.target.id === 'pPeople') form.people = +e.target.value;
    if (e.target.id === 'pDeals') form.useDeals = e.target.value === '1';
  });
  $('planBody').addEventListener('input', e => { if (e.target.id === 'pNote') form.note = e.target.value; });
  async function makePlan() {
    closeSheet('planSheet');
    st.busy = 'plan'; st.planning = { ...form }; st.tab = 'dinners'; render();
    try {
      const j = await api('plan', form);
      data.plan = j.plan; ls.set(KEY, data);
      st.busy = null; toast(plural(j.plan.meals.length, 'dinner') + ' planned. The shopping list is ready.');
    } catch (e) { st.busy = null; toast(say(e.code), null, 8000); }
    render();
  }
  $('fab').onclick = () => openPlan(false);

  function openRecipe(i) {
    const m = data.plan && data.plan.meals[i]; if (!m) return;
    $('recipeLbl').textContent = 'Night ' + m.day;
    const d = planDeals();
    $('recipeBody').innerHTML = '<div><h3>' + esc(m.title) + '</h3><p class="cm">' + esc([m.cuisine, m.method, m.minutes ? m.minutes + ' min' : '', 'serves ' + data.plan.people].filter(Boolean).join(' · ')) + '</p></div>'
      + (m.why ? '<p class="hint" style="margin:0 2px">' + esc(m.why) + '</p>' : '')
      + '<p class="label">Ingredients</p><div class="rgroup"><ul>' + m.ingredients.map(x => { const deal = L.dealFor(x.item, d); return '<li>' + esc(x.qty ? x.qty + ' ' : '') + esc(x.item) + (deal ? ' ' + saleTag({ deal }) : '') + '</li>'; }).join('') + '</ul></div>'
      + '<p class="label">Steps</p><div class="rgroup"><ol>' + m.steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol></div>'
      + '<p class="hint">Made by AI: check times and temperatures, and labels on anything packaged for what the family avoids.</p>';
    openSheet('recipeSheet');
  }

  // Settings: the family's stores and member cards, what they avoid, your account
  function renderSettings() {
    const s = data.settings, user = A() && A().user();
    const model = String(data.model || '').replace(/^.*\//, '').replace(/^claude-(\w+)-(\d+)-(\d+)$/, (_, n, a, b) => 'Claude ' + cap(n) + ' ' + a + '.' + b);
    const ai = data.ai === 'anthropic' ? model + ', through Anthropic’s API' : st.state === 'ok' ? 'Not set up yet' : 'Unknown until you’re online';
    $('setBody').innerHTML = '<div class="rgroup acct"><p><strong>' + esc(user ? user.name : 'Not signed in') + '</strong>'
      + esc(user ? 'The plan, deals and settings are the family’s: everyone signed in sees the same.' : 'Sign in with your family account to plan for the family.') + '</p>'
      + (user ? '' : '<button class="btn" type="button" data-act="signin">Sign in with Face ID</button>') + '</div>'
      + '<p class="label">Your stores</p><div class="opts" id="sStores" role="group" aria-label="Your stores">'
      + (data.stores || STORES).map(x => '<button class="opt" type="button" role="checkbox" data-store="' + x.id + '" aria-checked="' + draft.stores.includes(x.id) + '">' + esc(x.name) + '</button>').join('') + '</div>'
      + '<p class="hint">Their deals, and plans across them. All near Apex and Cary.</p>'
      + '<p class="label">Member cards</p><div class="opts" id="sCards" role="group" aria-label="Member cards">'
      + CARDS.map(([k, n]) => '<button class="opt" type="button" role="checkbox" data-card="' + k + '" aria-checked="' + draft.cards.includes(k) + '">' + esc(n) + '</button>').join('') + '</div>'
      + '<p class="hint">With a card, deals show its member prices.</p>'
      + '<p class="label">Never in a plan</p><div class="opts" id="avoid">' + (s.avoid || []).map(a => '<button class="opt" type="button" aria-checked="true" data-avoid="' + esc(a) + '" aria-label="Remove ' + esc(a) + '">' + esc(cap(a)) + ' ✕</button>').join('') + '</div>'
      + '<div class="rgroup"><div class="frow"><label class="vh" for="sAdd">Add an allergy or dislike</label><input class="txt" id="sAdd" maxlength="40" placeholder="Add an allergy or dislike"><button class="btn quiet" type="button" id="sAddGo">Add</button></div></div>'
      + '<p class="hint">“Tree nuts” covers almonds, cashews, pecans, walnuts, pistachios, pine nuts, pesto and the like; peanuts are fine. Anything else you add is checked by its name.</p>'
      + '<button class="btn okbtn" type="button" id="sSave">Save</button>'
      + '<p class="hint">AI: ' + esc(ai) + '.</p>';
  }
  let draftAvoid = null, draft = { stores: [], cards: [] };
  $('setBtn').onclick = () => { draftAvoid = [...(data.settings.avoid || [])]; draft = { stores: [...(data.settings.stores || [])], cards: [...(data.settings.cards || [])] }; renderSettings(); openSheet('setSheet'); };
  $('setBody').addEventListener('click', async e => {
    if (e.target.closest('[data-act="signin"]')) { closeSheet('setSheet'); return signIn(); }
    const tg = e.target.closest('[data-store], [data-card]');
    if (tg) {
      const [list, v] = tg.dataset.store ? [draft.stores, tg.dataset.store] : [draft.cards, tg.dataset.card], i = list.indexOf(v);
      if (i < 0) list.push(v); else if (!(tg.dataset.store && list.length === 1)) list.splice(i, 1); else { toast('Keep at least one store.'); return; }
      tg.setAttribute('aria-checked', i < 0); return;
    }
    const rm = e.target.closest('[data-avoid]');
    if (rm) { draftAvoid = draftAvoid.filter(a => a !== rm.dataset.avoid); rm.remove(); return; }
    if (e.target.closest('#sAddGo')) {
      const v = $('sAdd').value.trim().toLowerCase(); if (!v) return;
      if (!draftAvoid.includes(v)) { draftAvoid.push(v); $('avoid').insertAdjacentHTML('beforeend', '<button class="opt" type="button" aria-checked="true" data-avoid="' + esc(v) + '" aria-label="Remove ' + esc(v) + '">' + esc(cap(v)) + ' ✕</button>'); }
      $('sAdd').value = ''; return;
    }
    if (e.target.closest('#sSave')) {
      const body = { stores: draft.stores, cards: draft.cards, avoid: draftAvoid };
      try { const j = await api('settings', body); data.settings = j.settings; ls.set(KEY, data); closeSheet('setSheet'); toast('Saved for the family.'); render(); }
      catch (err) { toast(say(err.code), null, 6000); }
    }
  });

  // Tabs
  const slideTabs = jump => { const box = $('tabs'); if (window.AllisonOS && AllisonOS.slide) AllisonOS.slide(box, box.querySelector('[aria-pressed="true"]'), 'meals:tab', { jump }); };
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
  // Start
  // ---------------------------------------------------------------------
  render();
  animateIn(main);
  load();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !st.busy) load(); });
  window.addEventListener('online', () => { if (!st.busy) load(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // For the tests (meals/scripts/app-test.mjs) only.
  window.__meals = { st, data: () => data, render, load, openPlan, openRecipe };
})();
