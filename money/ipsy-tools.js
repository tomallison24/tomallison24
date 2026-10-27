"use strict";

// Ipsy's tools in Money. Claude asks for them by name through functions/money/api (IPSY_CLIENT_TOOLS
// describes them to it); they run here, on the phone, on the transactions as the family sees them
// (their own categories on top of Monarch's), and what they return goes back to Claude. They only
// read, but for one thing: a charge Monarch never emailed about (a booking whose confirmation is the
// only email), which Ipsy finds in the reader's Gmail when asked and adds only once the person says
// Yes (add_transaction, below). Nothing else here changes a transaction, a category or a setting.
// Each looks at no more than it was asked for (at most five years; 200 transactions, 40 groups), as
// compact JSON.
//
//   window.MoneyIpsy(app) -> the options for AllisonOS.ipsy.mount (tools, label, context, words)
//   app: money/app.js's pieces: view() (the transactions as the family sees them), calc (calc.js),
//        settings(), today(), raw() (the transactions as Monarch emailed them, for cash back),
//        alerts() (banks Monarch can't sync now), reader() (who reads Monarch's emails), screen();
//        for Gmail: isReader() (this phone reads Monarch's emails), gmail, bodies, header, getToken,
//        AuthError, htmlText (parse.js), addTx(tx), removeTx(id)
//
//   transactions(from, to, merchant?, category?, card?, direction?, min_amount?)
//   totals(from, to, by, ...the same filters)   by category, merchant, card, month or week
//   recurring()                                 what repeats, and a year of it
//   cards(from, to)                             months: spending and cash back per card, the rates, missed cash back
//   context()                                   today, the screen, the months, cards and categories there are
//   search_gmail(query), read_email(message_id)  the reader's Gmail, read only, on the reader's phone
//   add_transaction(message_id, date, amount…)   a charge Monarch missed, from an email read in this chat,
//                                               added only on Yes (with Undo); the amount must be in the
//                                               email's own words, and it can't be one Money already has
window.MoneyIpsy = function (app) {
  const C = app.calc, MAX_TX = 200, MAX_GROUPS = 40, MAX_MONTHS = 24;
  const isDay = s => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && !isNaN(Date.parse(s + 'T12:00:00Z'));
  const isMonth = s => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  const r2 = n => Math.round(n * 100) / 100;
  const low = s => String(s || '').toLowerCase().trim();
  const fail = msg => { throw new Error(msg); };
  const short = s => new Date(s + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // the days asked for, checked, in order, and no further back than Money keeps (five years)
  function range(i) {
    if (!isDay(i.from) || !isDay(i.to)) fail('from and to must be dates, YYYY-MM-DD');
    let [from, to] = i.from <= i.to ? [i.from, i.to] : [i.to, i.from];
    const keep = C.keepFrom(app.today()) + '-01';
    if (from < keep) from = keep;
    return { from, to };
  }
  // the transactions in a range that match the filters
  function pick(i) {
    const { from, to } = range(i), acct = C.accounts(app.view());
    const m = low(i.merchant), c = low(i.category), k = low(i.card), dir = i.direction === 'in' ? 'in' : 'out';
    const min = typeof i.min_amount === 'number' && isFinite(i.min_amount) ? i.min_amount : null;
    const list = app.view().filter(x => x.date >= from && x.date <= to && x.dir === dir
      && (!m || low(x.merchant).includes(m)) && (!c || low(x.cat) === c)
      && (!k || low(acct(x).name).includes(k) || (x.last4 && x.last4 === k))
      && (min == null || x.amt >= min));
    return { from, to, dir, list, acct };
  }
  const cardOf = (x, acct) => { const a = acct(x); return a.name ? a.name + (x.last4 ? ' ···' + x.last4 : '') + (a.guess ? ' (probably: Monarch’s summary didn’t say)' : '') : 'not known'; };
  const weekOf = d => { const t = new Date(d + 'T12:00'); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };

  const tools = {
    async transactions(i) {
      const { from, to, dir, list, acct } = pick(i || {});
      const rw = C.rewards(app.raw(), app.settings());
      const rows = list.slice(0, MAX_TX).map(x => {
        const r = rw.get(x.id), o = { date: x.date, merchant: x.merchant, amount: x.amt, direction: x.dir, card: cardOf(x, acct), category: x.cat || 'none' };
        if (x.how) o.monarch_category = x.mcat;
        if (r && r.rate != null) o.cash_back = r.earned;
        return o;
      });
      return { content: { from, to, direction: dir, count: list.length, total: r2(list.reduce((a, x) => a + x.amt, 0)), transactions: rows,
        ...(list.length > MAX_TX ? { more_not_shown: list.length - MAX_TX } : {}) } };
    },
    async totals(i) {
      i = i || {};
      const by = ['category', 'merchant', 'card', 'month', 'week'].includes(i.by) ? i.by : fail('by must be category, merchant, card, month or week');
      const { from, to, dir, list, acct } = pick(i), g = new Map();
      const key = { category: x => x.cat || 'none', merchant: x => x.merchant, card: x => acct(x).name || 'not known', month: x => C.ymOf(x.date), week: x => weekOf(x.date) }[by];
      for (const x of list) { const k = key(x), e = g.get(k) || { [by]: k, count: 0, total: 0 }; e.count++; e.total = r2(e.total + x.amt); g.set(k, e); }
      const groups = [...g.values()].sort(by === 'month' || by === 'week' ? (a, b) => (a[by] < b[by] ? -1 : 1) : (a, b) => b.total - a.total);
      return { content: { from, to, direction: dir, by, count: list.length, total: r2(list.reduce((a, x) => a + x.amt, 0)), groups: groups.slice(0, MAX_GROUPS),
        ...(groups.length > MAX_GROUPS ? { more_groups_not_shown: groups.length - MAX_GROUPS } : {}) } };
    },
    async recurring() {
      const list = C.recurring(app.view(), app.today());
      return { content: { recurring: list.map(r => ({ merchant: r.merchant, category: r.cat, every: r.every, usual_amount: r.amt, amount_varies: r.varies, a_year: r.yearly, times_seen: r.n, last: r.last, active: r.active })),
        a_year_while_active: r2(list.filter(r => r.active).reduce((a, r) => a + r.yearly, 0)) } };
    },
    async cards(i) {
      i = i || {};
      if (!isMonth(i.from) || !isMonth(i.to)) fail('from and to must be months, YYYY-MM');
      let [from, to] = i.from <= i.to ? [i.from, i.to] : [i.to, i.from];
      if (to > C.ymOf(app.today())) to = C.ymOf(app.today());
      const keep = C.keepFrom(app.today()); if (from < keep) from = keep;
      const raw = app.raw(), s = app.settings(), months = [];
      for (let ym = from, n = 0; ym <= to && n < MAX_MONTHS; ym = C.ymAdd(ym, 1), n++) months.push(ym);
      if (!months.length) fail('nothing in that range');
      const per = new Map();
      for (const ym of months) for (const c of C.byCard(raw, ym, s)) {
        const k = c.card || 'not known', e = per.get(k) || { card: k, spent: 0, charges: 0, cash_back: 0, rates: c.rule ? { on_everything: c.rule.base, online: c.rule.online, groceries: c.rule.grocery, bonus_limit_a_quarter: c.rule.cap } : 'not set in Money' };
        e.spent = r2(e.spent + c.spent); e.charges += c.n; e.cash_back = r2(e.cash_back + c.earned); per.set(k, e);
      }
      const missed = C.missed(raw, s, months[0], months[months.length - 1]).map(m => ({ spent_on: m.from, better: m.to, kind: m.kind, spent: m.spent, more_cash_back: m.more, charges: m.n }));
      return { content: { from: months[0], to: months[months.length - 1], cards: [...per.values()].sort((a, b) => b.spent - a.spent), better_card: missed,
        note: 'Cash back is worked out from the rates set in Money (Settings, Card rewards), and the card’s bonus categories as Money guesses them from the merchant: the bank’s own statement is what counts.' } };
    },
    async context() {
      const v = app.view(), t = app.today(), acct = C.accounts(v);
      const dates = v.map(x => x.date).sort();
      const cats = C.categories(v).map(c => c.name), cards = [...new Set(v.map(x => acct(x).name).filter(Boolean))];
      const min = C.minFor(v, C.ymOf(t), 'out');
      let screen = ''; try { screen = app.screen(); } catch {}
      return { content: {
        today: t, weekday: new Date(t + 'T12:00').toLocaleDateString('en-US', { weekday: 'long' }), screen,
        transactions: v.length, first: dates[0] || null, last: dates[dates.length - 1] || null,
        money_keeps: 'five years, from ' + C.keepFrom(t),
        cards_and_accounts: cards, categories: cats,
        monarch_emails_charges_over: min ? '$' + min + ' (smaller ones aren’t in Money)' : 'every charge, as far as Money knows',
        banks_monarch_cant_sync_now: (app.alerts() || []).map(a => a.inst || 'a bank'),
        reads_monarch_emails: app.reader() || 'not known',
        categories_note: 'Categories are as the family sees them: Monarch’s, unless they changed one (then monarch_category says Monarch’s).',
      } };
    },
  };

  // ---- a charge Monarch missed, from the reader's Gmail: searched only when asked, added only on Yes ----
  const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);
  const read = new Map();                   // emails read in this chat: id -> { text, subject, date } (what an addition may come from)
  async function mail(path, params) {
    if (!app.isReader || !app.isReader()) fail('Only ' + (app.reader() || 'the family member who reads Monarch\'s emails') + '\'s phone reads email for Money, so Ipsy can search Gmail only there. Say so.');
    if (!app.getToken()) fail('Gmail isn\'t connected in Money on this phone. They can connect it in Money\'s Settings.');
    try { return await app.gmail(path, params); }
    catch (e) { if (e instanceof app.AuthError) fail('Gmail\'s sign-in has run out on this phone. They can sign in again in Money\'s Settings.'); throw e; }
  }
  const head = (m, n) => app.header(m, n.toLowerCase());
  const day = ms => { const d = new Date(+ms); return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  // the amount as the email writes it: 1052.1 is in "$1,052.10", "USD 1052.10", "1,052.10 USD" (a whole one also as "$1,052")
  function amountIn(text, amt) {
    const t = String(text).replace(/(\d),(?=\d{3}\b)/g, '$1'), a = amt.toFixed(2).replace('.', '\\.');
    return new RegExp('(?<![\\d.])' + a + '(?!\\d)').test(t) || (Number.isInteger(amt) && new RegExp('\\$\\s?' + amt + '(?![\\d.,])').test(t));
  }
  const usd = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  Object.assign(tools, {
    async search_gmail(q) {
      const query = clip(q.query, 300); if (!query) fail('Give a Gmail search.');
      const max = Math.max(1, Math.min(25, Number.isInteger(q.max) ? q.max : 10));
      const r = await mail('/messages', { q: query + ' -in:chats -in:spam -in:trash', maxResults: max });
      const emails = [];
      for (const m of (r && r.messages || []).slice(0, max)) {
        const msg = await mail('/messages/' + m.id, { format: 'metadata' });
        emails.push({ message_id: m.id, from: head(msg, 'From'), subject: head(msg, 'Subject'), date: day(msg.internalDate), snippet: clip(msg.snippet, 200) });
      }
      return { content: { found: emails.length, ...(r && r.resultSizeEstimate > emails.length ? { more: true } : {}), emails } };
    },
    // Links are shown as their site only (an email's links can carry one-tap actions), as in Orders.
    async read_email(q) {
      const id = clip(q.message_id, 40); if (!/^[0-9a-zA-Z_-]+$/.test(id)) fail('That isn\'t a message id.');
      const msg = await mail('/messages/' + id, { format: 'full' });
      const { html, text } = app.bodies(msg.payload);
      const fromHtml = html ? app.htmlText(html) : '';
      const body = (fromHtml && fromHtml.length > text.length * 1.2 ? fromHtml : (text || fromHtml))
        .replace(/https?:\/\/([^\s/?#]+)\S*/g, (u, host) => '[link to ' + host.replace(/^www\./, '') + ']').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      const subject = head(msg, 'Subject'), date = day(msg.internalDate);
      read.set(id, { text: body + ' ' + subject, subject, date });
      return { content: { message_id: id, from: head(msg, 'From'), subject, date, text: body.slice(0, 20000) + (body.length > 20000 ? '\n[the rest of the email is cut off]' : '') } };
    },
    async add_transaction(q, ctx) {
      const id = clip(q.message_id, 40), mail0 = read.get(id);
      if (!mail0) fail('Read the email first (read_email): a transaction is only added from an email read in this chat.');
      if (!app.isReader || !app.isReader()) fail('Only the reader\'s phone can add to Money.');
      const amt = Math.round(Number(q.amount) * 100) / 100;
      if (!(amt > 0 && amt < 1e6)) fail('amount must be the charge, more than 0.');
      if (!amountIn(mail0.text, amt)) fail(usd(amt) + ' isn\'t written in that email, so it can\'t be added. Use the amount exactly as the email states it.');
      const dir = q.direction === 'in' ? 'in' : 'out';
      if (!isDay(q.date)) fail('date must be YYYY-MM-DD: the day of the charge (the booking or purchase date the email gives).');
      if (q.date > app.today()) fail('That date is still to come: a charge is added on the day it was made.');
      if (q.date < C.keepFrom(app.today()) + '-01') fail('Money keeps five years: that date is older.');
      const merchant = clip(q.merchant, 120); if (!merchant) fail('Give the merchant (who was paid).');
      const last4 = /^\d{4}$/.test(String(q.card_last4 || '')) && mail0.text.includes(q.card_last4) ? String(q.card_last4) : '';
      const all = app.raw(), x = { id: 'e:' + id + ':' + Math.round(amt * 100), at: Date.parse(q.date + 'T12:00:00'), date: q.date, amt, dir, merchant, account: '', last4, cat: '', emoji: '', mid: '', src: 'email', min: null };
      if (all.some(t => t.id === x.id)) fail('That charge from this email is in Money already.');
      const twin = all.find(t => C.sameCharge(t, x));
      if (twin) fail('Money already has ' + usd(twin.amt) + ' at ' + twin.merchant + ' on ' + twin.date + (twin.src === 'email' ? ' (added from an email)' : ' (from Monarch)') + ', which looks like the same charge, so nothing was added. Say so.');
      if (last4) { const same = all.find(t => t.last4 === last4 && t.account); if (same) x.account = same.account; }
      const cat = clip(q.category, 60);
      if (cat) { const c = C.categories(app.view()).find(k => low(k.name) === low(cat)); if (c) { x.cat = c.name; x.emoji = c.emoji || ''; } }
      const what = merchant + ', ' + usd(amt) + (dir === 'in' ? ' in' : '') + ' on ' + short(q.date) + (last4 ? ', card ···' + last4 : '') + (x.cat ? ', ' + x.cat : '');
      const ok = ctx && ctx.confirm ? await ctx.confirm('Add this to Money? ' + what + '. From the email “' + clip(mail0.subject, 80) + '” (' + short(mail0.date) + '). It counts in your totals, and everyone who sees Money sees it.', { yes: 'Yes, add it', no: 'No' }) : false;
      if (!ok) return { content: { added: false, note: 'They said no, so nothing was added.' } };
      app.addTx(x);
      return { content: { added: true, transaction: { date: x.date, merchant, amount: amt, direction: dir, card: last4 ? '···' + last4 : 'not known', category: x.cat || 'none' } },
        change: { text: 'Added ' + what, undo: () => app.removeTx(x.id) } };
    },
  });

  const LABELS = {
    transactions: i => 'Looking at your transactions' + (i.merchant ? ' at ' + i.merchant : i.category ? ' in ' + i.category : '') + (isDay(i.from) && isDay(i.to) ? ', ' + short(i.from < i.to ? i.from : i.to) + ' – ' + short(i.from < i.to ? i.to : i.from) : ''),
    totals: i => 'Adding up by ' + (i.by || 'category'),
    recurring: () => 'Looking at what repeats',
    cards: () => 'Looking at your cards and cash back',
    context: () => 'Looking at Money',
    search_gmail: () => 'Searching your email', read_email: () => 'Reading an email', add_transaction: () => 'Adding a transaction',
  };
  return {
    tools,
    label: (name, input) => (LABELS[name] || (() => ''))(input || {}),
    context() { let s = ''; try { s = app.screen(); } catch {} return s ? 'On screen: ' + s + '.' : ''; },
    intro: 'Hi, I’m Ipsy! Ask me where your money goes: a merchant, a category, a card, or how a month compares.',
    placeholder: 'Ask Ipsy about your spending',
    suggestions: ['What did we spend at Costco this month?', 'What are our biggest categories this year?', 'Which subscriptions could we cut?', 'Are we using the right card for online shopping?'],
    consent: 'Your question and only the transactions Ipsy needs go to Claude, by Anthropic, through aOS; Anthropic doesn’t train on it. Ipsy has no web search and isn’t a financial adviser. On the phone that reads Monarch’s emails, when you ask, it can search your Gmail for a charge Monarch missed, and adds one only when you say Yes.',
  };
};
