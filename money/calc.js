"use strict";
// Money's sums: folding transactions together, cards and their rewards, what
// repeats, a month against the ones before, and where you could save. Pure
// functions, no page, so they can be tested in Node (money/scripts/calc-test.mjs);
// app.js draws the result and writes the words.
//
// A transaction (parse.js): { id, at, date 'YYYY-MM-DD', amt (always positive),
// dir 'out' | 'in', merchant, account, last4, cat, emoji, mid, src 'alert' |
// 'summary', min? }. Monarch emails only what is over the amount set in its
// notification settings, and that amount is in each alert's own words (min), so
// a month from before it was lowered only holds the big ones: comparisons with
// such a month count only what is over that amount on both sides (likeForLike).
(function (root) {
  const pad = n => String(n).padStart(2, '0');
  const r2 = n => Math.round(n * 100) / 100;
  const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);
  const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const ymOf = date => String(date).slice(0, 7);
  const ymAdd = (ym, n) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  const daysIn = ym => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  const dayNo = date => Math.round(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 864e5);
  const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  const okTx = x => x && typeof x.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') && typeof x.amt === 'number' && isFinite(x.amt) && x.amt >= 0 && (x.dir === 'in' || x.dir === 'out') && typeof x.merchant === 'string';

  // ---------------------------------------------------------------------
  // Folding in what was read. The same transaction can come twice: as its own
  // alert and in a summary (which has no account), or as two alerts with the
  // same Monarch id. The alert wins: it says which card.
  // ---------------------------------------------------------------------
  const sameTx = (a, b) => a.dir === b.dir && Math.abs(a.amt - b.amt) < 0.005 && norm(a.merchant) === norm(b.merchant) && Math.abs(a.at - b.at) <= 2 * 864e5;
  function merge(list, items) {
    const out = list.filter(okTx).slice(), byId = new Map(out.map(x => [x.id, x]));
    let added = 0;
    for (const it of items) {
      if (!okTx(it) || byId.has(it.id)) continue;
      if (it.mid && out.some(x => x.mid === it.mid)) continue;
      if (it.src === 'summary' && out.some(x => x.src === 'alert' && sameTx(x, it))) continue;
      if (it.src === 'alert') {
        const dup = out.findIndex(x => x.src === 'summary' && sameTx(x, it));
        if (dup >= 0) { byId.delete(out[dup].id); out.splice(dup, 1); added--; }
      }
      out.push(it); byId.set(it.id, it); added++;
    }
    out.sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1));
    return { list: out, added: Math.max(0, added) };
  }

  // ---------------------------------------------------------------------
  // Cards and accounts. A card is known by its name, whatever its number: a
  // replaced card (Robinhood's **1111, then **9876) is still the same card.
  // A summary's transactions name no account: each takes the one its
  // merchant's own alerts nearly always used, marked as a guess.
  // ---------------------------------------------------------------------
  const cardKey = name => norm(name);
  const isCard = name => /\b(card|visa|mastercard|amex|american express|discover|signature|rewards|credit)\b/i.test(name || '');
  function accounts(txs) {
    const byMerchant = new Map();
    for (const x of txs) if (x.account) {
      const k = norm(x.merchant), m = byMerchant.get(k) || new Map();
      m.set(x.account, (m.get(x.account) || 0) + 1); byMerchant.set(k, m);
    }
    const guess = new Map();
    byMerchant.forEach((m, k) => {
      const all = [...m.values()].reduce((a, b) => a + b, 0), top = [...m].sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] / all >= 0.8) guess.set(k, top[0]);
    });
    return x => x.account ? { name: x.account, guess: false } : guess.has(norm(x.merchant)) ? { name: guess.get(norm(x.merchant)), guess: true } : { name: '', guess: false };
  }

  // ---------------------------------------------------------------------
  // Rewards. Each card's rule: { base: % on everything, online: % on online
  // shopping, grocery: % at grocery stores and wholesale clubs, cap: $ a quarter
  // the online and grocery rates are paid on (0: no cap), then base }. A card
  // with no rule earns nothing here and says "not set" (its rate is the
  // family's to enter, in Settings). The rules start from what the owner asked for:
  // Robinhood 3% on everything, Bank of America's Customized Cash 6% on online
  // shopping (and BofA's 2% at grocery stores and wholesale clubs, 1% else,
  // the bonus on the first $2,500 a quarter: change it in Settings if yours differs).
  // ---------------------------------------------------------------------
  const DEFAULT_RULES = [
    { match: 'robinhood', base: 3, online: 0, grocery: 0, cap: 0 },
    { match: 'customized cash', base: 1, online: 6, grocery: 2, cap: 2500 },
  ];
  const ONLINE = ['Amazon', 'Etsy', 'eBay', 'Wayfair', 'Chewy', 'Temu', 'Shein', 'Zappos'];
  const WHOLESALE = ['Costco', 'Sam\'s Club', 'BJ\'s', 'BJs Wholesale'];
  const GROCERY_CATS = ['groceries', 'grocery'];
  function ruleFor(name, settings) {
    const key = cardKey(name), own = settings && settings.cards && settings.cards[key];
    if (own) return own.off ? null : own;
    const d = DEFAULT_RULES.find(r => key.includes(r.match));
    return d ? { base: d.base, online: d.online, grocery: d.grocery, cap: d.cap } : null;
  }
  const onlineList = settings => (settings && Array.isArray(settings.online) ? settings.online : ONLINE).map(norm).filter(Boolean);
  function kindOf(x, settings) {
    const m = norm(x.merchant), on = onlineList(settings);
    if (on.some(o => m === o || m.startsWith(o + ' ') || m.endsWith(' ' + o))) return 'online';
    if (GROCERY_CATS.includes(norm(x.cat)) || WHOLESALE.map(norm).some(w => m === w || m.startsWith(w + ' '))) return 'grocery';
    return 'base';
  }
  const rateOf = (rule, kind) => !rule ? null : kind === 'online' && rule.online > rule.base ? rule.online : kind === 'grocery' && rule.grocery > rule.base ? rule.grocery : rule.base;
  const quarter = date => date.slice(0, 4) + 'Q' + (((+date.slice(5, 7)) - 1) / 3 | 0);
  // What each spend earned: Map id -> { card, rate, earned, kind, capped }. Oldest first, for the caps.
  function rewards(txs, settings) {
    const acct = accounts(txs), out = new Map(), used = new Map();
    for (const x of [...txs].filter(t => t.dir === 'out').sort((a, b) => a.at - b.at)) {
      const a = acct(x); if (!a.name) continue;
      const rule = ruleFor(a.name, settings);
      if (!rule) { out.set(x.id, { card: a.name, guess: a.guess, rate: null, earned: 0, kind: kindOf(x, settings) }); continue; }
      const kind = kindOf(x, settings);
      let rate = rateOf(rule, kind), capped = false, earned = x.amt * rate / 100;
      if (rate !== rule.base && rule.cap > 0) {
        const k = cardKey(a.name) + '|' + quarter(x.date), before = used.get(k) || 0, room = Math.max(0, rule.cap - before);
        used.set(k, before + x.amt);
        if (x.amt > room) { capped = true; earned = (room * rate + (x.amt - room) * rule.base) / 100; if (!room) rate = rule.base; }
      }
      out.set(x.id, { card: a.name, guess: a.guess, rate, earned: r2(earned), kind, capped });
    }
    return out;
  }
  // The card that pays most for one spend, among the family's cards with a rule (caps aside).
  function best(x, cards, settings) {
    const kind = kindOf(x, settings);
    let top = null;
    for (const c of cards) { const r = rateOf(ruleFor(c, settings), kind); if (r != null && (!top || r > top.rate)) top = { card: c, rate: r }; }
    return top && Object.assign(top, { kind });
  }
  // Rewards a month, per card: [{ ym, cards: { name: earned }, total }], oldest first.
  function rewardMonths(txs, settings, lastYm, n) {
    const rw = rewards(txs, settings), months = [];
    for (let i = n - 1; i >= 0; i--) months.push({ ym: ymAdd(lastYm, -i), cards: {}, total: 0 });
    const at = new Map(months.map(m => [m.ym, m]));
    for (const x of txs) {
      const r = rw.get(x.id), m = at.get(ymOf(x.date));
      if (!r || !m || r.rate == null) continue;
      m.cards[r.card] = r2((m.cards[r.card] || 0) + r.earned); m.total = r2(m.total + r.earned);
    }
    return months;
  }
  // Spending by card in a month: [{ card, spent, n, earned, rate (null: not set), guessed }], biggest first.
  function byCard(txs, ym, settings) {
    const rw = rewards(txs, settings), acct = accounts(txs), m = new Map();
    for (const x of txs) {
      if (x.dir !== 'out' || ymOf(x.date) !== ym) continue;
      const a = acct(x), name = a.name || '', c = m.get(name) || { card: name, spent: 0, n: 0, earned: 0, guessed: 0, card_: isCard(name) };
      c.spent = r2(c.spent + x.amt); c.n++; if (a.guess) c.guessed++;
      const r = rw.get(x.id); if (r && r.rate != null) c.earned = r2(c.earned + r.earned);
      m.set(name, c);
    }
    return [...m.values()].map(c => { const rule = c.card ? ruleFor(c.card, settings) : null; return { card: c.card, spent: c.spent, n: c.n, earned: c.earned, guessed: c.guessed, isCard: c.card_, rule }; })
      .sort((a, b) => (!a.card) - (!b.card) || b.spent - a.spent);
  }
  // Rewards you missed: spends where another of your cards pays more, grouped by
  // the card used, the card to use and the kind of spend, over the months given.
  function missed(txs, settings, fromYm, toYm) {
    const rw = rewards(txs, settings), cards = [...new Set([...rw.values()].map(r => r.card))].filter(c => ruleFor(c, settings));
    const g = new Map();
    for (const x of txs) {
      const ym = ymOf(x.date), r = rw.get(x.id);
      if (x.dir !== 'out' || ym < fromYm || ym > toYm || !r) continue;
      const b = best(x, cards, settings);
      if (!b || b.card === r.card || r.rate == null || b.rate <= r.rate) continue;
      const k = r.card + '|' + b.card + '|' + b.kind, e = g.get(k) || { from: r.card, to: b.card, kind: b.kind, rate: b.rate, fromRate: r.rate, spent: 0, more: 0, n: 0 };
      e.spent = r2(e.spent + x.amt); e.more = r2(e.more + x.amt * (b.rate - r.rate) / 100); e.n++;
      g.set(k, e);
    }
    return [...g.values()].filter(e => e.more >= 1).sort((a, b) => b.more - a.more);
  }

  // ---------------------------------------------------------------------
  // What repeats: the same merchant at a steady rhythm (weekly, every two
  // weeks, monthly, every three months, yearly) at about the same amount.
  // ---------------------------------------------------------------------
  const RHYTHMS = [['weekly', 7, 1.5, 52], ['every 2 weeks', 14, 2.5, 26], ['monthly', 30.4, 4, 12], ['every 3 months', 91, 10, 4], ['yearly', 365, 20, 1]];
  function recurring(txs, today) {
    const t = dayNo(today), g = new Map();
    for (const x of txs) if (x.dir === 'out' && t - dayNo(x.date) <= 400) { const k = norm(x.merchant); (g.get(k) || g.set(k, []).get(k)).push(x); }
    const out = [];
    g.forEach(list => {
      if (list.length < 3) return;
      list.sort((a, b) => a.at - b.at);
      // one a day at most (a bill paid in two goes on the same day counts once)
      const days = [], amts = [];
      for (const x of list) { const d = dayNo(x.date); if (days.length && days[days.length - 1] === d) { amts[amts.length - 1] += x.amt; continue; } days.push(d); amts.push(x.amt); }
      if (days.length < 3) return;
      const gaps = days.slice(1).map((d, i) => d - days[i]), gap = median(gaps);
      const rh = RHYTHMS.find(([, len, tol]) => Math.abs(gap - len) <= tol);
      if (!rh) return;
      const steady = gaps.filter(x => Math.abs(x - rh[1]) <= rh[2] * 1.6).length / gaps.length;
      if (steady < 0.8) return;   // Amazon most months and once more in one isn't a bill
      const amt = median(amts.slice(-6)), last = list[list.length - 1];
      const spread = Math.max(...amts.slice(-6)) - Math.min(...amts.slice(-6));
      const since = t - days[days.length - 1];
      out.push({ merchant: last.merchant, cat: last.cat, emoji: last.emoji, every: rh[0], amt: r2(amt), varies: spread > Math.max(2, amt * 0.1), yearly: r2(amt * rh[3]), n: days.length,
        last: last.date, active: since <= rh[1] * 1.8 + rh[2] });
    });
    return out.sort((a, b) => b.active - a.active || b.yearly - a.yearly);
  }

  // ---------------------------------------------------------------------
  // A month: what went out and came in, by category, merchant and card; how
  // it compares with the three months before; and where you could save.
  // ---------------------------------------------------------------------
  // Monarch's alert threshold for a month and direction: the highest one its alerts said that month,
  // else the last one before it. 0 when no alert said (every transaction was emailed, as far as anyone knows).
  function minFor(txs, ym, dir) {
    const said = txs.filter(x => x.dir === dir && x.min != null && isFinite(x.min)).sort((a, b) => a.at - b.at);
    const inMonth = said.filter(x => ymOf(x.date) === ym);
    if (inMonth.length) return Math.max(...inMonth.map(x => x.min));
    const before = said.filter(x => ymOf(x.date) < ym);
    if (before.length) return before[before.length - 1].min;
    // a month before any alert said: the first threshold heard of, if the month has anything at all
    return said.length && txs.some(x => ymOf(x.date) === ym) ? said[0].min : 0;
  }
  function month(txs, ym, minAmt) {
    const min = minAmt || 0, list = txs.filter(x => ymOf(x.date) === ym && x.amt >= min);
    const out = list.filter(x => x.dir === 'out'), inn = list.filter(x => x.dir === 'in');
    const group = (arr, key) => { const m = new Map(); for (const x of arr) { const k = key(x), e = m.get(k) || { name: k, emoji: x.emoji, total: 0, n: 0 }; e.total = r2(e.total + x.amt); e.n++; m.set(k, e); } return [...m.values()].sort((a, b) => b.total - a.total); };
    return { ym, spent: r2(sum(out, x => x.amt)), income: r2(sum(inn, x => x.amt)), n: list.length, out: out.length,
      cats: group(out, x => x.cat || 'Uncategorized'), merchants: group(out, x => x.merchant) };
  }
  // At this rate, by the end of the month (the current month only, and only once a week has gone).
  function pace(txs, ym, today) {
    if (ymOf(today) !== ym) return null;
    const d = +today.slice(8, 10); if (d < 7) return null;
    return r2(month(txs, ym).spent / d * daysIn(ym));
  }
  // This month against the 3 before it, category by category.
  function compare(txs, ym, n = 3) {
    const prev = []; for (let i = 1; i <= n; i++) prev.push(ymAdd(ym, -i));
    const have = prev.filter(p => txs.some(x => ymOf(x.date) === p));
    if (!have.length) return null;
    const min = Math.max(minFor(txs, ym, 'out'), ...have.map(p => minFor(txs, p, 'out')));
    const now = month(txs, ym, min), past = have.map(p => month(txs, p, min));
    const avg = r2(sum(past, m => m.spent) / past.length);
    const names = new Set([...now.cats.map(c => c.name), ...past.flatMap(m => m.cats.map(c => c.name))]);
    const cats = [...names].map(name => {
      const c = now.cats.find(x => x.name === name), a = r2(sum(past, m => (m.cats.find(x => x.name === name) || { total: 0 }).total) / past.length);
      const emoji = (c || past.flatMap(m => m.cats).find(x => x.name === name) || {}).emoji || '';
      return { name, emoji, now: c ? c.total : 0, avg: a, diff: r2((c ? c.total : 0) - a) };
    }).sort((a, b) => b.now - a.now || b.avg - a.avg);
    return { ym, months: have, min, likeForLike: min > minFor(txs, ym, 'out'), spent: now.spent, avg, diff: r2(now.spent - avg), cats };
  }
  // Where you could save, biggest first:
  //   { kind: 'spike', cat, emoji, now, avg, diff }        a category well over its usual
  //   { kind: 'merchant', merchant, total, n }              where the most went this month
  //   { kind: 'card', from, to, kindOf, rate, more, spent }  a better card for that kind of spend (the last 3 months)
  //   { kind: 'recurring', total, n }                       what repeats, a year
  function tips(txs, ym, today, settings) {
    const out = [], cmp = compare(txs, ym);
    if (cmp) for (const c of cmp.cats) if (c.avg > 0 && c.now > c.avg * 1.3 && c.diff >= 75) out.push({ kind: 'spike', cat: c.name, emoji: c.emoji, now: c.now, avg: c.avg, diff: c.diff, likeForLike: cmp.likeForLike, min: cmp.min });
    for (const e of missed(txs, settings, ymAdd(ym, -2), ym).slice(0, 1)) out.push({ kind: 'card', from: e.from, to: e.to, kindOf: e.kind, rate: e.rate, fromRate: e.fromRate, more: e.more, spent: e.spent, n: e.n });
    const m = month(txs, ym), top = m.merchants[0];
    if (top && top.n >= 2 && top.total >= Math.max(150, m.spent * 0.15)) out.push({ kind: 'merchant', merchant: top.name, total: top.total, n: top.n });
    const rec = recurring(txs, today).filter(r => r.active);
    if (rec.length) out.push({ kind: 'recurring', total: r2(sum(rec, r => r.yearly)), n: rec.length });
    const weight = t => t.kind === 'spike' ? t.diff : t.kind === 'card' ? t.more * 4 : t.kind === 'merchant' ? t.total / 4 : 1;
    return out.sort((a, b) => weight(b) - weight(a));
  }
  // Banks Monarch can't sync, still to fix: an alert from the last 30 days that wasn't marked fixed, with no
  // transaction from an account with that bank's name read after it.
  function openAlerts(alerts, txs, dismissed, today) {
    const t = dayNo(today), done = new Set(dismissed || []);
    const latest = new Map();
    for (const a of alerts || []) {
      if (!a || done.has(a.id) || t - dayNo(a.date) > 30) continue;
      const k = norm(a.inst || a.what);
      if (latest.has(k) && latest.get(k).at >= a.at) continue;
      const word = norm(a.inst).split(' ')[0];
      if (word && txs.some(x => x.at > a.at + 36e5 && norm(x.account).split(' ').includes(word))) continue;
      latest.set(k, a);
    }
    return [...latest.values()].sort((a, b) => b.at - a.at);
  }

  root.MoneyCalc = { DEFAULT_RULES, ONLINE, okTx, norm, ymOf, ymAdd, daysIn, merge, accounts, isCard, cardKey, ruleFor, kindOf, rateOf, rewards, best, rewardMonths, byCard, missed,
    recurring, minFor, month, pace, compare, tips, openAlerts };
})(typeof window !== 'undefined' ? window : globalThis);
