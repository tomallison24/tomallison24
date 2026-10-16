"use strict";

// Ipsy's tools in Orders (in both its designs). Claude asks for them by name through
// functions/orders/api (IPSY_CLIENT_TOOLS describes them to it); they run here, on the phone,
// against the same orders and the same Gmail sign-in as the app, and what they return goes back
// to Claude. Every change comes back with an undo for the chat's Undo button.
//
//   window.OrdersIpsy(app) -> the options for AllisonOS.ipsy.mount (tools, label, context, words)
//   app: the app's own pieces (orders/app.js passes them): orders (get and set), save, render, P
//        (parse.js), todayStr, isOpen, needsCheck, checkReason, kindOn, gmail, bodies, header,
//        getToken, AuthError, openOrder, current (the open order), closeOrder, refreshOrder, screen
//
// Changes follow the app's own rules: a field Ipsy sets is locked like one you typed (a later
// email won't overwrite it), a new status gets its step's date, a deleted order gets a grave (it
// doesn't come back from the email), and everything goes through save(), so the Sheet syncs and
// its Log tab records it.
window.OrdersIpsy = function (app) {
  const P = app.P;
  const copy = o => JSON.parse(JSON.stringify(o));
  const ymd = s => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && !isNaN(Date.parse(s + 'T12:00:00Z'));
  const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);
  const STATUSES = ['ordered', 'shipped', 'out', 'pickup', 'delivered', 'pickedup', 'cancelled'];
  const KINDS = ['package', 'pickup', 'food', 'digital', 'other'];
  const EDITABLE = ['store', 'items', 'total', 'orderNo', 'orderDate', 'eta', 'etaEnd', 'carrier', 'tracking', 'status', 'kind', 'pickupBy', 'notes'];
  const byId = id => app.orders.find(o => o.id === id);
  const done = () => { app.save(); app.render(); app.refreshOrder(); };
  const fail = msg => { throw new Error(msg); };

  // What the orders looked like before a change, and how to put them back.
  function snapshot(ids) { return ids.map(id => { const o = byId(id); return [id, o ? copy(o) : null]; }); }
  function undoTo(snap) {
    return () => {
      snap.forEach(([id, before]) => {
        const o = byId(id);
        if (!before) { if (o) { app.orders = app.orders.filter(x => x.id !== id); app.closeOrder(id); } return; }
        if (o) { Object.keys(o).forEach(k => { if (!(k in before)) delete o[k]; }); Object.assign(o, copy(before)); }
        else app.orders = app.orders.concat(copy(before));
      });
      done();
    };
  }

  // ---- how an order is shown to Claude ----
  const lastNews = o => P.lastDay(o) || o.orderDate || '';
  function brief(o) {
    const s = o.steps || {}, it = o.items || [];
    const b = { id: o.id, store: o.store || '', status: o.status, kind: o.kind || 'package' };
    if (it.length) b.items = it.slice(0, 3).map(i => (i.qty > 1 ? i.qty + ' x ' : '') + i.name).join('; ') + (it.length > 3 ? '; and ' + (it.length - 3) + ' more' : '');
    if (o.total != null) b.total = o.total;
    for (const k of ['orderNo', 'tracking', 'carrier', 'eta', 'etaEnd', 'pickupBy']) if (o[k]) b[k] = o[k];
    if (s.ordered || o.orderDate) b.ordered = s.ordered || o.orderDate;
    if (s.delivered || s.pickedup) b.arrived = s.delivered || s.pickedup;
    b.lastNews = lastNews(o);
    if (app.needsCheck(o)) b.check = app.checkReason(o);
    if (!app.kindOn(o)) b.hiddenBySettings = true;
    return b;
  }
  function full(o) {
    const { source, updated, created, storeKey, shadow, ...rest } = o;
    const f = { ...rest, check: app.needsCheck(o) ? app.checkReason(o) : '' };
    if (source && source.msgId) f.email = { message_id: source.msgId, subject: source.subject || '', from: source.from || '', date: source.date ? new Date(source.date).toISOString().slice(0, 10) : '' };
    if (created) f.addedOn = new Date(created).toISOString().slice(0, 10);
    return f;
  }

  // ---- changes, checked as the edit sheet checks them ----
  function clean(ch) {
    const out = {}, bad = [];
    if (!ch || typeof ch !== 'object') return { out, bad: ['changes'] };
    for (const [k, v] of Object.entries(ch)) {
      if (k === 'checked') { out.checked = !!v; continue; }
      if (!EDITABLE.includes(k)) { bad.push(k); continue; }
      if (k === 'items') {
        if (!Array.isArray(v)) { bad.push(k); continue; }
        out.items = v.slice(0, 60).map(i => {
          const name = clip(i && i.name, 160), qty = Number.isInteger(i && i.qty) && i.qty > 1 && i.qty < 1000 ? i.qty : 0, price = +(i && i.price);
          return name ? { name, ...(qty ? { qty } : {}), ...(price > 0 && price < 1e6 ? { price: Math.round(price * 100) / 100 } : {}) } : null;
        }).filter(Boolean);
      } else if (k === 'total') {
        if (v == null || v === '') out.total = null;
        else { const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, '')); if (isFinite(n) && n >= 0 && n < 1e7) out.total = Math.round(n * 100) / 100; else bad.push(k); }
      } else if (['orderDate', 'eta', 'etaEnd', 'pickupBy'].includes(k)) {
        if (v === '' || v == null) out[k] = ''; else if (ymd(v)) out[k] = v; else bad.push(k);
      } else if (k === 'status') { if (STATUSES.includes(v)) out.status = v; else bad.push(k); }
      else if (k === 'kind') { if (KINDS.includes(v)) out.kind = v; else bad.push(k); }
      else out[k] = clip(v, k === 'notes' ? 2000 : k === 'store' ? 80 : 60);
    }
    return { out, bad };
  }
  // Puts changes onto an order, as "Edit details" does; returns the names of what changed.
  function apply(o, ch) {
    const changed = [], locks = { ...(o.locks || {}) }, today = app.todayStr();
    const prevStatus = o.status, prevCarrier = o.carrier, prevTracking = o.tracking;
    for (const k of EDITABLE) {
      if (!(k in ch)) continue;
      const v = ch[k];
      if (JSON.stringify(o[k] == null ? '' : o[k]) === JSON.stringify(v == null ? '' : v)) continue;
      o[k] = v; locks[k] = true; changed.push(k);
    }
    o.locks = locks;
    if (changed.includes('store')) o.storeKey = P.keyOf(o.store);
    if (o.status !== prevStatus) {
      o.steps = { ...(o.steps || {}) };
      if (o.status !== 'cancelled') o.steps[o.status] = o.steps[o.status] || today;
      if (o.status === 'delivered' || o.status === 'pickedup') { o.issue = ''; o.checked = true; o.guess = false; }
    }
    if (o.carrier !== prevCarrier || o.tracking !== prevTracking) o.trackUrl = o.carrier && o.tracking ? (P.trackUrl(o.carrier, o.tracking) || '') : '';
    if (o.etaEnd && (!o.eta || o.etaEnd < o.eta)) o.etaEnd = '';
    if (ch.checked === true && (!o.checked || o.guess || o.issue)) { o.checked = true; o.guess = false; o.issue = ''; changed.push('checked'); }
    if (ch.checked === false && o.checked) { o.checked = false; changed.push('checked'); }
    return changed;
  }
  const NAMES = { store: 'store', items: 'items', total: 'total', orderNo: 'order number', orderDate: 'order date', eta: 'expected date', etaEnd: 'expected date',
    carrier: 'carrier', tracking: 'tracking number', status: 'status', kind: 'kind', pickupBy: 'pickup date', notes: 'notes', checked: 'checked' };
  const said = keys => [...new Set(keys.map(k => NAMES[k] || k))].join(', ');
  const who = o => o.store || (o.items && o.items[0] && o.items[0].name) || 'an order';

  // ---- Gmail ----
  async function mail(path, params) {
    if (!app.getToken()) fail('Gmail isn’t connected in Orders on this phone. The person can connect it in Settings (the gear), Connect Gmail.');
    try { return await app.gmail(path, params); }
    catch (e) { if (e instanceof app.AuthError) fail('Gmail’s sign-in has run out on this phone. The person can sign in again in Settings (the gear), Connect Gmail.'); throw e; }
  }
  const head = (m, n) => app.header(m, n.toLowerCase());
  const day = ms => { const d = new Date(+ms); return isNaN(d) ? '' : d.toISOString().slice(0, 10); };
  const orderOfMsg = id => { const o = app.orders.find(x => x.source && x.source.msgId === id); return o ? o.id : undefined; };

  const tools = {
    async find_orders(q) {
      const words = clip(q.query, 200).toLowerCase().split(/\s+/).filter(Boolean);
      const limit = Math.max(1, Math.min(100, Number.isInteger(q.limit) ? q.limit : 30));
      let list = app.orders.filter(o => {
        if (words.length) {
          const hay = [o.store, o.orderNo, o.tracking, o.carrier, o.notes, ...(o.items || []).map(i => i.name)].join(' ').toLowerCase();
          if (!words.every(w => hay.includes(w))) return false;
        }
        if (q.status === 'open' && !app.isOpen(o)) return false;
        if (q.status === 'done' && app.isOpen(o)) return false;
        if (q.status === 'check' && !app.needsCheck(o)) return false;
        if (STATUSES.includes(q.status) && o.status !== q.status) return false;
        if (q.kind && (o.kind || 'package') !== q.kind) return false;
        const last = lastNews(o), first = (o.steps && o.steps.ordered) || o.orderDate || last;
        if (ymd(q.from) && last && last < q.from) return false;
        if (ymd(q.to) && first && first > q.to) return false;
        return true;
      });
      list = list.sort((a, b) => lastNews(b).localeCompare(lastNews(a)));
      return { content: { found: list.length, shown: Math.min(limit, list.length), orders: list.slice(0, limit).map(brief) } };
    },

    async get_orders(q) {
      const ids = (Array.isArray(q.ids) ? q.ids : []).slice(0, 20);
      return { content: { orders: ids.map(id => { const o = byId(id); return o ? full(o) : { id, missing: 'No order with this id.' }; }) } };
    },

    async update_order(q) {
      const o = byId(q.id); if (!o) fail('No order with id ' + q.id + '.');
      const { out, bad } = clean(q.changes);
      if (bad.length && !Object.keys(out).length) fail('Nothing to change: these fields aren’t valid: ' + bad.join(', ') + '.');
      const snap = snapshot([o.id]);
      const changed = apply(o, out);
      if (!changed.length) return { content: { order: brief(o), changed: [], note: 'It already says that.' + (bad.length ? ' Skipped: ' + bad.join(', ') : '') } };
      done();
      return { content: { order: brief(o), changed, ...(bad.length ? { skipped: bad } : {}) },
        change: { text: 'Changed ' + said(changed) + ' on ' + who(o), undo: undoTo(snap) } };
    },

    async create_order(q) {
      const { out, bad } = clean(q.order);
      if (!out.store && !(out.items || []).length) fail('A new order needs a store or an item.');
      const today = app.todayStr();
      const o = { id: 'h-' + P.hash(Date.now() + Math.random() + (out.store || '')), store: '', items: [], status: 'ordered', kind: 'package', notes: '',
        created: Date.now(), checked: true, guess: false, source: null };
      o.orderDate = out.orderDate || today;
      o.steps = { ordered: o.orderDate };
      apply(o, out);
      o.steps = { ordered: o.orderDate, ...(o.status !== 'ordered' && o.status !== 'cancelled' ? { [o.status]: (o.steps || {})[o.status] || today } : {}) };
      o.storeKey = P.keyOf(o.store);
      const snap = [[o.id, null]];
      app.orders = app.orders.concat(o);
      done();
      return { content: { order: brief(o), ...(bad.length ? { skipped: bad } : {}) }, change: { text: 'Added ' + who(o), undo: undoTo(snap) } };
    },

    async delete_orders(q) {
      const ids = [...new Set(Array.isArray(q.ids) ? q.ids : [])];
      const found = ids.filter(byId), missing = ids.filter(id => !byId(id));
      if (!found.length) fail('None of those orders are here.');
      const snap = snapshot(found), names = found.map(id => who(byId(id)));
      app.orders = app.orders.filter(o => !found.includes(o.id));
      found.forEach(app.closeOrder);
      done();
      return { content: { deleted: found, ...(missing.length ? { missing } : {}) },
        change: { text: found.length === 1 ? 'Deleted ' + names[0] : 'Deleted ' + found.length + ' orders (' + [...new Set(names)].slice(0, 3).join(', ') + (new Set(names).size > 3 ? '…' : '') + ')', undo: undoTo(snap) } };
    },

    async merge_orders(q) {
      const keep = byId(q.keep_id); if (!keep) fail('No order with id ' + q.keep_id + '.');
      const others = [...new Set(Array.isArray(q.merge_ids) ? q.merge_ids : [])].filter(id => id !== keep.id).map(byId).filter(Boolean);
      if (!others.length) fail('Nothing to merge: none of merge_ids are other orders here.');
      const snap = snapshot([keep.id, ...others.map(o => o.id)]);
      const L = keep.locks || {};
      for (const m of others) {
        for (const k of ['store', 'orderNo', 'tracking', 'carrier', 'trackUrl', 'eta', 'etaEnd', 'pickupBy', 'orderDate', 'cur']) if (!keep[k] && m[k]) keep[k] = m[k];
        if (keep.total == null && m.total != null) keep.total = m.total;
        const have = new Set((keep.items || []).map(i => i.name.toLowerCase()));
        keep.items = (keep.items || []).concat((m.items || []).filter(i => !have.has(i.name.toLowerCase())));
        const s = { ...(keep.steps || {}) };
        Object.entries(m.steps || {}).forEach(([k, d]) => { if (d && (!s[k] || d < s[k])) s[k] = d; });
        keep.steps = s;
        if (!L.status && m.status !== 'cancelled' && (keep.status === 'cancelled' ? false : P.rank(m.status) > P.rank(keep.status))) keep.status = m.status;
        if (m.notes && !(keep.notes || '').includes(m.notes)) keep.notes = [keep.notes, m.notes].filter(Boolean).join('\n');
        if (!keep.source && m.source) keep.source = m.source;
        keep.locks = { ...(m.locks || {}), ...(keep.locks || {}) };
        if (m.created && (!keep.created || m.created < keep.created)) keep.created = m.created;
      }
      if (keep.status === 'delivered' || keep.status === 'pickedup') keep.issue = '';
      keep.storeKey = P.keyOf(keep.store);
      if (keep.carrier && keep.tracking && !keep.trackUrl) keep.trackUrl = P.trackUrl(keep.carrier, keep.tracking) || '';
      const { out } = clean(q.changes || {});
      if (Object.keys(out).length) apply(keep, out);
      const gone = others.map(o => o.id);
      app.orders = app.orders.filter(o => !gone.includes(o.id));
      gone.forEach(app.closeOrder);
      done();
      return { content: { order: brief(keep), merged: gone },
        change: { text: 'Merged ' + (others.length + 1) + ' orders into one: ' + who(keep), undo: undoTo(snap) } };
    },

    async show_order(q) {
      const o = byId(q.id); if (!o) fail('No order with id ' + q.id + '.');
      app.openOrder(o.id);
      return { content: { shown: o.id, note: 'It is open behind the chat; closing the chat shows it.' } };
    },

    async search_gmail(q) {
      const query = clip(q.query, 300); if (!query) fail('Give a Gmail search.');
      const max = Math.max(1, Math.min(25, Number.isInteger(q.max) ? q.max : 10));
      const r = await mail('/messages', { q: query + ' -in:chats', maxResults: max });
      const ids = (r && r.messages || []).slice(0, max);
      const emails = [];
      for (const m of ids) {
        const msg = await mail('/messages/' + m.id, { format: 'metadata' });
        emails.push({ message_id: m.id, from: head(msg, 'From'), subject: head(msg, 'Subject'), date: day(msg.internalDate), snippet: clip(msg.snippet, 200), ...(orderOfMsg(m.id) ? { order_id: orderOfMsg(m.id) } : {}) });
      }
      return { content: { found: emails.length, ...(r && r.resultSizeEstimate > emails.length ? { more: true } : {}), emails } };
    },

    // Links are shown as their site only: an email's links can carry one-tap actions (confirm,
    // cancel, unsubscribe) that a page fetch would set off, so Claude never gets the address.
    async read_email(q) {
      const id = clip(q.message_id, 40); if (!/^[0-9a-zA-Z_-]+$/.test(id)) fail('That isn’t a message id.');
      const msg = await mail('/messages/' + id, { format: 'full' });
      const { html, text } = app.bodies(msg.payload);
      const fromHtml = html ? P.htmlToText(html) : '';
      const body = (fromHtml && fromHtml.length > text.length * 1.2 ? fromHtml : (text || fromHtml))
        .replace(/https?:\/\/([^\s/?#]+)\S*/g, (u, host) => '[link to ' + host.replace(/^www\./, '') + ']').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      return { content: { message_id: id, from: head(msg, 'From'), to: head(msg, 'To'), subject: head(msg, 'Subject'), date: day(msg.internalDate),
        ...(orderOfMsg(id) ? { order_id: orderOfMsg(id) } : {}), text: body.slice(0, 20000) + (body.length > 20000 ? '\n[the rest of the email is cut off]' : '') } };
    },
  };

  const LABELS = {
    find_orders: () => 'Looking through your orders', get_orders: () => 'Reading the details',
    update_order: () => 'Updating an order', create_order: () => 'Adding an order', delete_orders: i => 'Deleting ' + ((i.ids || []).length === 1 ? 'an order' : 'orders'),
    merge_orders: () => 'Merging orders', show_order: () => 'Opening the order',
    search_gmail: i => 'Searching Gmail' + (i.query ? ': ' + clip(i.query, 60) : ''), read_email: () => 'Reading an email',
  };

  return {
    tools,
    label: (name, input) => (LABELS[name] || (() => ''))(input || {}),
    context() {
      const all = app.orders, open = all.filter(app.isOpen).length, check = all.filter(app.needsCheck).length, o = app.current();
      return 'Orders has ' + all.length + ' orders: ' + open + ' on the way' + (check ? ', ' + check + ' marked Check details' : '') + '. '
        + (o ? 'On screen: the order ' + o.id + ' from ' + (o.store || 'an unnamed store') + '.' : 'On screen: ' + app.screen() + '.')
        + (app.getToken() ? '' : ' Gmail isn’t connected right now.');
    },
    intro: 'Hi, I’m Ipsy! I can find an order, fix its details, merge duplicates, clear out old ones, check your Gmail for anything missing, or look something up on the web.',
    placeholder: 'Ask Ipsy about your orders',
    suggestions: ['What’s arriving this week?', 'Find duplicate orders and merge them', 'Is anything late?', 'Check Gmail for orders I’m missing'],
    consent: 'Ipsy runs on Claude, by Anthropic. When you ask something, your question and whatever Ipsy looks at to answer it (your orders, and any email it opens in your Gmail) go to Claude through the family server, which keeps only a count of questions. Ipsy can change, delete and merge orders: each change shows here with Undo.',
  };
};
