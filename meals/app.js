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
// - Settings (the gear): the store, Prime prices, what the family avoids, your
//   account, and the family's Google Sheet, the record of every plan ever
//   accepted (google-sheet-sync.gs, through aOS: aOS/SHEETS.md). Meals copies
//   the family's plans, deals, list and settings there, and reads back the
//   plans the family server no longer keeps (Past plans → Older plans).
// - Two designs, picked in Settings > Design: Vintage (the default) and Standard
//   (Sea glass), kept on this phone (../home/design.js, as in Clock).

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
    del: k => { try { localStorage.removeItem(k); } catch {} },
  };
  // (v2: deals by store. The v1 copy, one store's deals, is left behind.)
  const KEY = 'allison-meals-v2', K = { ticks: 'allison-meals-v1-ticks', tab: 'allison-meals-v1-tab', store: 'allison-meals-v1-store',
    // the family's Google Sheet: when it last synced, the plans it holds, plans taken back here (Undo);
    // sheet and sheetSent are the link, phrase and sent list from before aOS kept them (handed over, then gone)
    sheetAt: 'allison-meals-v1-sheet-synced', sheetHas: 'allison-meals-v1-sheet-has', sheetGraves: 'allison-meals-v1-sheet-graves',
    sheet: 'allison-meals-v1-sheet', sheetSent: 'allison-meals-v1-sheet-sent', sheetOldAt: 'allison-meals-v1-sheet-at' };
  const plural = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
  const cap = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
  const MEATS = [['chicken', 'Chicken'], ['beef', 'Beef'], ['pork', 'Pork'], ['turkey', 'Turkey'], ['lamb', 'Lamb'], ['salmon', 'Salmon'], ['white fish', 'White fish'], ['shrimp', 'Shrimp'], ['on sale', 'Whatever’s on sale']];
  const ICON = {
    tick: '<svg viewBox="0 0 24 24" class="b"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>',
    sheet: '<svg viewBox="0 0 24 24"><rect x="3.4" y="3.8" width="17.2" height="16.4" rx="3"/><path d="M3.4 9.4h17.2M3.4 14.8h17.2M9.4 9.4v10.8"/></svg>',
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
      // got: when this was read from the family server (the Sheet keeps the newest copy read)
      data = { ai: j.ai, model: j.model, week: j.week, stores: j.stores || STORES, settings: j.settings, deals: j.deals || {}, draft: j.draft || null, plan: j.plan, log: j.log || [], got: Date.now() };
      ls.set(KEY, data); st.state = 'ok'; st.error = '';
      scheduleSheet();   // the family's Google Sheet hears what the family changed
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
    $('fab').hidden = st.tab !== 'dinners' || !!(data.draft && data.draft.meals);   // a new plan waiting: accept, try again or discard it first
    main.innerHTML = notice() + (st.tab === 'dinners' ? dinners() : st.tab === 'deals' ? deals() : list());
  }

  // dates: 'YYYY-MM-DD' on this phone's calendar
  const isoDay = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dayLabel = (iso, o) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', o || { weekday: 'short', month: 'short', day: 'numeric' });
  const span = e => dayLabel(e.start, { month: 'short', day: 'numeric' }) + ' – ' + dayLabel(e.end, { month: 'short', day: 'numeric' });
  const where = p => p.shop && p.shop !== 'all' && storeById(p.shop) ? storeById(p.shop).name : p.shop === 'all' ? 'Best deals' : p.shopName || '';
  // a plan's nights as cards; src says which plan a tap opens ('draft', 'plan' or 'past')
  const nights = (p, src, from) => p.meals.map((m, i) => '<button class="card rgroup" type="button" data-meal="' + i + '" data-src="' + src + '" style="--i:' + (from + i) + '">'
    + '<span class="night">Night ' + m.day + (p.dates && p.dates[i] ? ' · ' + esc(dayLabel(p.dates[i])) : '') + '</span><span class="ct">' + esc(m.title) + '</span>'
    + '<span class="cm">' + esc([m.cuisine, m.method, m.minutes ? m.minutes + ' min' : ''].filter(Boolean).join(' · ')) + '</span>'
    + (m.uses && m.uses.length ? '<span class="saletag">On sale: ' + esc(m.uses.join(', ')) + '</span>' : '') + '</button>').join('');
  function startOptions() {
    const now = new Date();
    return Array.from({ length: 8 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i), iso = isoDay(d);
      return '<option value="' + iso + '">' + esc((i === 0 ? 'Today, ' : i === 1 ? 'Tomorrow, ' : '') + dayLabel(iso)) + '</option>'; }).join('');
  }
  function dinners() {
    const p = data.plan, d = data.draft;
    if (st.busy === 'plan') return busyCard('Planning ' + plural(st.planning.days, 'dinner') + '…', 'About half a minute.');
    let h = '';
    if (d && d.meals && d.meals.length) {
      // a new plan to look over: nothing is saved until someone accepts it
      // the choice first, where it's seen; the dinners under it
      h += '<div class="card accept" style="--i:1"><strong>New plan · not saved yet</strong>'
        + '<p>' + esc([cap(d.meat), 'for ' + d.people, where(d)].filter(Boolean).join(' · ')) + '</p>'
        + '<div class="frow storepick"><label for="aStart">Starting</label><select id="aStart">' + startOptions() + '</select></div>'
        + '<div class="btns"><button class="btn okbtn" type="button" data-act="accept">Accept plan</button><button class="btn" type="button" data-act="again"' + (noAI() ? ' disabled' : '') + '>Try again</button></div>'
        + '<div class="btns" style="margin-top:0"><button class="btn quiet" type="button" data-act="discard">Discard</button></div></div>'
        + nights(d, 'draft', 2) + (d.tip ? '<div class="card"><p><b>Tip:</b> ' + esc(d.tip) + '</p></div>' : '');
    } else if (p && p.meals && p.meals.length) {
      const when = p.dates && p.dates.length ? span({ start: p.dates[0], end: p.dates[p.dates.length - 1] }) : dayLabel(isoDay(new Date(p.at)));
      h += '<p class="sechead"><span>' + esc([cap(p.meat), 'for ' + p.people, where(p)].filter(Boolean).join(' · ')) + '</span><span>' + esc(when) + '</span></p>' + nights(p, 'plan', 1);
      if (p.tip) h += '<div class="card" style="--i:' + (p.meals.length + 1) + '"><p><b>Tip:</b> ' + esc(p.tip) + '</p></div>';
      if (p.acceptedBy || p.by) h += '<p class="hint">' + esc(p.acceptedBy ? 'Accepted by ' + p.acceptedBy : 'Planned by ' + p.by) + '.</p>';
    } else {
      h += '<div class="card" style="--i:1"><strong>No dinners planned yet</strong>'
        + '<div class="btns"><button class="btn okbtn" type="button" data-act="plan"' + (noAI() ? ' disabled' : '') + '>Plan dinners</button></div></div>';
    }
    // every accepted plan, as Fitness keeps every workout: the family server's last 52, then older ones
    // read back from the family's Google Sheet
    const log = pastList(), olderOn = signedIn() && sheetAt && !older.done;
    if (log.length || (olderOn && sheetHas.size)) h += '<p class="sechead"><span>Past plans</span><span>' + log.length + '</span></p><div class="rgroup">'
      + log.map(e => '<button class="rowbtn" type="button" data-past="' + esc(e.id) + '"><span>' + esc(span(e) + ' · ' + cap(e.meat) + (e.shop && e.shop !== 'all' && storeById(e.shop) ? ' · ' + storeById(e.shop).name : e.shopName ? ' · ' + e.shopName : ''))
        + (p && p.id === e.id ? ' <span class="prime">Current</span>' : '') + '<span class="sub">' + esc(e.titles.join(' · ')) + '</span></span></button>').join('')
      + (olderOn ? '<button class="rowbtn" type="button" data-act="older"' + (older.busy ? ' disabled' : '') + '><span class="ic">' + ICON.sheet + '</span><span>' + (older.busy ? 'Looking in the Sheet…' : 'Show older plans from the Sheet')
        + '</span></button>' : '') + '</div>';
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
      h += '<p>' + esc(store.where.replace(/^[^,]+,\s*/, '') + (d && d.items && d.items.length ? ' · ' + (thisWeek(d) ? 'This week' : 'An earlier week') + ', ' + L.weekLabel(d.week, d.validFrom, d.validTo) : '') + card) + '</p>'
        + '<div class="btns"><button class="btn" type="button" data-act="find"' + off + '>' + (thisWeek(d) ? 'Look again' : 'Find this week’s deals') + '</button>'
        + '<button class="btn quiet" type="button" data-act="paste"' + off + '>Paste deals</button></div></div>';
    }
    if (st.busy === 'deals') return h + busyCard('Looking for this week’s sales…', st.finding || 'This can take up to a minute.');
    // all stores: the same thing at different stores side by side, to compare
    const items = all ? weekItems(data.settings.stores || []).items.sort((a, b) => a.name.localeCompare(b.name, 'en-US')) : d && d.items ? d.items.map(x => ({ ...x, at: store })) : [];
    if (!items.length) return h + '<div class="empty" style="--i:2"><strong>No deals yet</strong></div>';
    h += L.sections(items, x => x.name).map((g, i) => '<p class="sechead"><span>' + esc(g.name) + '</span><span>' + g.items.length + '</span></p><div class="rgroup" style="--i:' + (i + 2) + '">'
      + g.items.map(x => '<div class="drow"><span class="dn">' + esc(x.name) + ((all ? [x.at.name] : []).concat(x.note ? [x.note] : []).length ? '<small>' + esc((all ? [x.at.name] : []).concat(x.note ? [x.note] : []).join(' · ')) + '</small>' : '') + '</span>'
        + '<span class="dp">' + esc(x.price || '') + memberTag(x) + (x.regular ? '<small>usually ' + esc(x.regular) + '</small>' : '') + '</span></div>').join('') + '</div>').join('');
    h += '<button class="btn okbtn" type="button" data-act="plan-deals"' + (noAI() ? ' disabled' : '') + '>Plan dinners with ' + (all ? 'the best of these' : 'these deals') + '</button>';
    const src = all ? [] : (d.sources || []);
    if (src.length) h += '<p class="src">Found on: ' + src.map(u => { let host = u; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch {} return '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(host) + '</a>'; }).join(', ') + '.</p>';
    else if (!all && d.how === 'paste') h += '<p class="src">From the sales you pasted.</p>';
    return h;
  }

  // the plan's sale items: its store's this week, or every store's for a plan across stores
  // a plan's sale items: the ones it was planned with (an older plan: its store's this week)
  const dealsOf = p => !p ? null : p.sales ? { items: p.sales.map(x => ({ ...x, at: storeById(x.store) || { name: x.store } })) } : weekItems(shopIds(p.shop || 'all'));
  const saleTag = (x, p) => x.deal ? '<span class="saletag">On sale' + (p && p.shop && p.shop !== 'all' ? ' ' : ' at ' + esc(x.deal.at.name) + ' ') + esc(x.deal.price || '') + '</span>' : '';
  const shopOf = p => L.shopping((p && p.meals) || [], dealsOf(p));
  function shop() { return shopOf(data.plan); }
  function list() {
    const p = data.plan;
    if (!p || !p.meals || !p.meals.length) return '<div class="empty" style="--i:1"><strong>Nothing to buy yet</strong>' + (data.draft ? 'Accept the new plan on Dinners.' : 'Plan dinners first.') + '</div>';
    if (ticks.at !== p.at) ticks = { at: p.at, keys: [] };
    const s = shop(), done = new Set(ticks.keys);
    const row = x => '<button class="irow" type="button" role="checkbox" aria-checked="' + done.has(x.key) + '" data-key="' + esc(x.key) + '"><span class="box">' + ICON.tick + '</span>'
      + '<span class="it">' + esc(cap(x.item)) + '<small>' + esc([L.total(x.amounts), 'night' + (x.nights.length > 1 ? 's ' : ' ') + x.nights.join(', ')].filter(Boolean).join(' · ')) + '</small>'
      + saleTag(x, p) + '</span></button>';
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
  main.addEventListener('click', async e => {
    const b = e.target.closest('[data-act], [data-meal], [data-key], [data-past]'); if (!b) return;
    if (b.dataset.meal) return openRecipe(+b.dataset.meal, b.dataset.src === 'draft' ? data.draft : data.plan);
    if (b.dataset.past) return openPast(b.dataset.past);
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
    if (act === 'accept') return accept();
    if (act === 'again') return again();
    if (act === 'discard') return discard();
    if (act === 'paste') { $('pasteText').value = ''; openSheet('pasteSheet'); setTimeout(() => $('pasteText').focus(), 300); return; }
    if (act === 'signin') return signIn();
    if (act === 'older') return loadOlder();
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
  addEventListener('aos:account', e => { if (e.detail) { load(); handOver(); } });
  main.addEventListener('change', e => { if (e.target.id === 'dStore') { st.store = e.target.value; ls.set(K.store, st.store); render(); } });

  // one store's deals: searched for, or read from pasted text
  async function oneStore(id, text) {
    const j = await api('deals', text ? { store: id, text } : { store: id, refresh: thisWeek((data.deals || {})[id]) });
    if (j.deals && j.deals.items.length) { data.deals = Object.assign({}, data.deals, { [id]: j.deals }); ls.set(KEY, data); scheduleSheet(); }
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
      + ((data.settings.avoid || []).length ? '<p class="hint">Never ' + esc(data.settings.avoid.join(' or ')) + '.</p>' : '')
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
  async function makePlan(more) {
    closeSheet('planSheet');
    const ask = more ? { ...more, again: true } : { ...form };
    st.busy = 'plan'; st.planning = ask; st.tab = 'dinners'; render(); scrollTo(0, 0);
    try {
      const j = await api('plan', ask);
      data.draft = j.draft; ls.set(KEY, data);
      st.busy = null; toast('Here’s a plan. Accept it to save it.', null, 6000);
    } catch (e) { st.busy = null; toast(say(e.code), null, 8000); }
    render();
  }
  // another go at the draft, with the same choices
  const again = () => { const d = data.draft; if (d) makePlan({ meat: d.meat, days: d.days, people: d.people, useDeals: d.useDeals, shop: d.shop, note: d.note || '' }); };
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
  // a past plan: its dinners and shopping list, as it was
  const pastCache = {};
  async function openPast(id) {
    let p = id === (data.plan || {}).id ? data.plan : pastCache[id] || sheetPlans.get(id);
    if (!p) { try { p = await wholePlan(id); } catch (e) { toast(say(e.code), null, 6000); return; } }
    st.past = p;
    const s = shopOf(p);
    $('pastLbl').textContent = span({ start: p.start, end: p.dates[p.dates.length - 1] || p.start });
    $('pastBody').innerHTML = '<p class="hint" style="margin:0 2px">' + esc([cap(p.meat), 'for ' + p.people, where(p), p.acceptedBy ? 'accepted by ' + p.acceptedBy : ''].filter(Boolean).join(' · ')) + '</p>'
      + nights(p, 'past', 0)
      + '<p class="label">Shopping list</p>' + L.sections(s.buy, x => x.item).map(g => '<div class="rgroup"><p class="sechead" style="margin:10px 14px 2px"><span>' + esc(g.name) + '</span></p><ul class="plain">'
        + g.items.map(x => '<li>' + esc(cap(x.item)) + ' <small>' + esc(L.total(x.amounts)) + '</small> ' + saleTag(x, p) + '</li>').join('') + '</ul></div>').join('');
    openSheet('pastSheet');
  }
  $('pastBody').addEventListener('click', e => { const b = e.target.closest('[data-meal]'); if (b) openRecipe(+b.dataset.meal, st.past); });
  $('fab').onclick = () => openPlan(false);

  function openRecipe(i, p) {
    const m = p && p.meals[i]; if (!m) return;
    $('recipeLbl').textContent = 'Night ' + m.day + (p.dates && p.dates[i] ? ' · ' + dayLabel(p.dates[i]) : '');
    const d = dealsOf(p);
    $('recipeBody').innerHTML = '<div><h3>' + esc(m.title) + '</h3><p class="cm">' + esc([m.cuisine, m.method, m.minutes ? m.minutes + ' min' : '', 'serves ' + p.people].filter(Boolean).join(' · ')) + '</p></div>'
      + (m.why ? '<p class="hint" style="margin:0 2px">' + esc(m.why) + '</p>' : '')
      + '<p class="label">Ingredients</p><div class="rgroup"><ul>' + m.ingredients.map(x => { const deal = L.dealFor(x.item, d); return '<li>' + esc(x.qty ? x.qty + ' ' : '') + esc(x.item) + (deal ? ' ' + saleTag({ deal }, p) : '') + '</li>'; }).join('') + '</ul></div>'
      + '<p class="label">Steps</p><div class="rgroup"><ol>' + m.steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol></div>'
      + '<p class="hint">Made by AI: check times, temperatures and labels.</p>';
    openSheet('recipeSheet');
  }

  // Settings: the family's stores and member cards, what they avoid, your account
  const modelName = () => String(data.model || '').replace(/^.*\//, '').replace(/^claude-(\w+)-(\d+)-(\d+)$/, (_, n, a, b) => 'Claude ' + cap(n) + ' ' + a + '.' + b);
  function renderSettings() {
    const s = data.settings, user = A() && A().user();
    const model = modelName();
    const ai = data.ai === 'anthropic' ? model + ', through Anthropic’s API' : st.state === 'ok' ? 'Not set up yet' : 'Unknown until you’re online';
    $('setBody').innerHTML = '<p class="label">Design</p><div class="rgroup">' + (window.aosDesign ? aosDesign.picker() : '') + '</div>'
      + '<p class="label">Account</p><div class="rgroup acct"><p><strong>' + esc(user ? user.name : 'Not signed in') + '</strong>'
      + (user ? '' : 'Sign in to plan for the family.') + '</p>'
      + (user ? '' : '<button class="btn" type="button" data-act="signin">Sign in with Face ID</button>') + '</div>'
      + '<p class="label">Your stores</p><div class="opts" id="sStores" role="group" aria-label="Your stores">'
      + (data.stores || STORES).map(x => '<button class="opt" type="button" role="checkbox" data-store="' + x.id + '" aria-checked="' + draft.stores.includes(x.id) + '">' + esc(x.name) + '</button>').join('') + '</div>'
      + '<p class="hint">Deals and plans come from these stores.</p>'
      + '<p class="label">Member cards</p><div class="opts" id="sCards" role="group" aria-label="Member cards">'
      + CARDS.map(([k, n]) => '<button class="opt" type="button" role="checkbox" data-card="' + k + '" aria-checked="' + draft.cards.includes(k) + '">' + esc(n) + '</button>').join('') + '</div>'
      + '<p class="hint">With a card, deals show its member prices.</p>'
      + '<p class="label">Never in a plan</p><div class="opts" id="avoid">' + (s.avoid || []).map(a => '<button class="opt" type="button" aria-checked="true" data-avoid="' + esc(a) + '" aria-label="Remove ' + esc(a) + '">' + esc(cap(a)) + ' ✕</button>').join('') + '</div>'
      + '<div class="rgroup"><div class="frow"><label class="vh" for="sAdd">Add an allergy or dislike</label><input class="txt" id="sAdd" maxlength="40" placeholder="Add an allergy or dislike"><button class="btn quiet" type="button" id="sAddGo">Add</button></div></div>'
      + '<p class="hint">AI: ' + esc(ai) + '.</p>';
  }
  let draftAvoid = null, draft = { stores: [], cards: [] };
  if (window.aosDesign) aosDesign.bind($('setBody'));   // Design: Vintage or Standard, at once (../home/design.js)
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
  });
  // Done (the tick) saves what was changed, then closes; with nothing changed it only closes
  $('sSave').addEventListener('click', async () => {
    const body = { stores: draft.stores, cards: draft.cards, avoid: draftAvoid }, was = data.settings;
    const same = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
    if (same(body.stores, was.stores) && same(body.cards, was.cards) && same(body.avoid, was.avoid)) return closeSheet('setSheet');
    try { const j = await api('settings', body); data.settings = j.settings; ls.set(KEY, data); scheduleSheet(); closeSheet('setSheet'); toast('Saved for the family.'); render(); }
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
  // The family's server is the working copy (the plan, the deals, the last 52 plans: Claude plans
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
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDay(d); };

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
  const fromSheet = x => !x || typeof x.id !== 'string' || !Array.isArray(x.meals) || !/^\d{4}-\d\d-\d\d$/.test(x.start || '') ? null : {
    id: x.id, start: x.start, dates: Array.isArray(x.dates) ? x.dates : [], meat: x.meat || '', people: x.people || '', shop: x.shop || '', shopName: x.shopName || '',
    tip: x.tip || '', acceptedAt: x.at || 0, acceptedBy: x.planner || '', sales: [], fromSheet: true,
    meals: x.meals.map((m, i) => ({ ...m, day: m.day || i + 1, uses: m.uses || [], ingredients: m.ingredients || [], steps: m.steps || [] })) };
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
      .map(p => ({ id: p.id, start: p.start, end: p.dates[p.dates.length - 1] || p.start, meat: p.meat, shop: p.shop, shopName: p.shopName, people: p.people, titles: p.meals.map(m => m.title) }));
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

  // What goes to the Sheet. Each plan is whole (without the sale prices kept for its list: the Sheet
  // doesn't show them), stamped with when this phone read it from the family server, so the newest copy
  // wins there. The current plan always goes; past plans the Sheet doesn't hold yet (it says which it
  // holds) are fetched whole, once a session, three at a time.
  const sheetPlan = p => { const { sales, by, got, fromSheet: f, ...rest } = p;
    return { ...rest, shopName: where(p), updated: Math.max(+p.acceptedAt || 0, +got || (data.plan && p.id === data.plan.id ? +data.got || 0 : 0)) }; };
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
    const s = shop(), all = !p.shop || p.shop === 'all';
    const nights = x => 'night' + (x.nights.length > 1 ? 's ' : ' ') + x.nights.join(', ');
    return {
      buy: L.sections(s.buy, x => x.item).flatMap(g => g.items.map(x => ({ section: g.name, item: cap(x.item), amount: L.total(x.amounts), nights: nights(x),
        sale: x.deal ? (x.deal.price || 'On sale') + (all && x.deal.at && x.deal.at.name ? ' at ' + x.deal.at.name : '') : '' }))),
      pantry: s.pantry.map(x => ({ item: cap(x.item), amount: L.total(x.amounts), nights: nights(x) })),
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
    const deals = Object.entries(data.deals || {}).map(([id, d]) => { const s = storeById(id);
      return s && d && d.week && d.items && d.items.length ? { store: s.name, week: d.week, at: d.at || 0, validFrom: d.validFrom || '', validTo: d.validTo || '',
        items: d.items.map(x => ({ name: x.name, price: x.price || '', regular: x.regular || '', member: !!x.member, note: x.note || '' })) } : null; }).filter(Boolean);
    const set = data.settings || {};
    const settings = { stores: mine().map(x => x.name), cards: (set.cards || []).map(k => (CARDS.find(c => c[0] === k) || [k, k])[1]), avoid: set.avoid || [], model: modelName() };
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
    const TAB_NAMES = { dinners: 'the Dinners tab', deals: 'the Deals tab', list: 'the List tab (the shopping list)' };
    window.AllisonOS.ipsy.mount({
      app: 'meals', name: 'Meals', endpoint: '../meals/api/ipsy', headers: { 'X-Meals': '1' }, slot: document.querySelector('.dock > span'),
      ...window.MealsIpsy({
        L, api, say, toast, storeById, mine, shopOf, dayLabel, past: wholePlan,
        get data() { return data; }, state: () => st.state,
        keep,
        today: () => isoDay(new Date()),
        planning: ask => { st.busy = ask ? 'plan' : null; st.planning = ask; if (ask) { st.tab = 'dinners'; ls.set(K.tab, st.tab); } render(); slideTabs(true); },
        ticked: () => data.plan && ticks.at === data.plan.at ? ticks.keys.slice() : [],
        setTicks: keys => { ticks = { at: data.plan && data.plan.at, keys: keys.slice() }; ls.set(K.ticks, ticks); render(); },
        show: (p, i) => { st.tab = 'dinners'; ls.set(K.tab, st.tab); render(); slideTabs(true); openRecipe(i, p); },
        screen: () => !$('recipeSheet').hidden ? 'the recipe for ' + $('recipeLbl').textContent : TAB_NAMES[st.tab] || 'Meals',
      }),
    });
  }

  // For the tests (meals/scripts/app-test.mjs) only.
  window.__meals = { st, data: () => data, render, load, openPlan, openRecipe, openPast, keep, sheetSync, loadOlder, sheetPlans: () => [...sheetPlans.keys()], graves: () => sheetGraves };
})();
