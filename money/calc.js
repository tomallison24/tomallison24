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
  // One Ipsy found in another email and the person added (src 'email', money/ipsy-tools.js) gives way
  // to Monarch's, when Monarch emails it after all: the same amount, in or out, within three days, on
  // the same card if both say (the merchant's name is the email's own, so it isn't compared).
  // ---------------------------------------------------------------------
  const sameTx = (a, b) => a.dir === b.dir && Math.abs(a.amt - b.amt) < 0.005 && norm(a.merchant) === norm(b.merchant) && Math.abs(a.at - b.at) <= 2 * 864e5;
  const sameCharge = (a, b) => a.dir === b.dir && Math.abs(a.amt - b.amt) < 0.005 && Math.abs(dayNo(a.date) - dayNo(b.date)) <= 3 && (!a.last4 || !b.last4 || a.last4 === b.last4);
  function merge(list, items) {
    const out = list.filter(okTx).slice(), byId = new Map(out.map(x => [x.id, x]));
    let added = 0;
    for (const it of items) {
      if (!okTx(it) || byId.has(it.id)) continue;
      if (it.mid && out.some(x => x.mid === it.mid)) continue;
      if (it.src === 'summary' && out.some(x => x.src === 'alert' && sameTx(x, it))) continue;
      if (it.src === 'email' && out.some(x => x.src !== 'email' && sameCharge(x, it))) continue;
      if (it.src === 'alert') {
        const dup = out.findIndex(x => x.src === 'summary' && sameTx(x, it));
        if (dup >= 0) { byId.delete(out[dup].id); out.splice(dup, 1); added--; }
      }
      if (it.src !== 'email') {
        const found = out.findIndex(x => x.src === 'email' && sameCharge(x, it));
        if (found >= 0) { byId.delete(out[found].id); out.splice(found, 1); added--; }
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
  // Week by week (the trends sheet): the n weeks up to the one holding `last`, oldest first, each
  // { start, end, spent, n, cats: [{ name, emoji, total, n }] } with only what went out over min. A week
  // starts on day ws of the week (0 Sunday, 1 Monday).
  const dayStr = n => { const d = new Date(n * 864e5); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  function weeks(txs, last, n, ws = 0, minAmt = 0) {
    const l = dayNo(last), first = l - ((new Date(l * 864e5).getUTCDay() - ws + 7) % 7) - 7 * (n - 1);
    const out = [];
    for (let i = 0; i < n; i++) out.push({ start: dayStr(first + 7 * i), end: dayStr(first + 7 * i + 6), spent: 0, n: 0, cats: new Map() });
    for (const x of txs) {
      if (x.dir !== 'out' || x.amt < minAmt) continue;
      const i = Math.floor((dayNo(x.date) - first) / 7), w = out[i];
      if (!w) continue;
      const k = x.cat || 'Uncategorized', c = w.cats.get(k) || { name: k, emoji: x.emoji, total: 0, n: 0 };
      c.total = r2(c.total + x.amt); c.n++; w.cats.set(k, c);
      w.spent = r2(w.spent + x.amt); w.n++;
    }
    return out.map(w => Object.assign(w, { cats: [...w.cats.values()].sort((a, b) => b.total - a.total) }));
  }
  // Through the month (the trends sheet): what had gone out by the end of each day, day 1 first.
  function byDay(txs, ym, minAmt = 0) {
    const out = new Array(daysIn(ym)).fill(0);
    for (const x of txs) if (x.dir === 'out' && x.amt >= minAmt && ymOf(x.date) === ym) out[+x.date.slice(8, 10) - 1] += x.amt;
    let acc = 0;
    return out.map(v => r2(acc += v));
  }
  // The usual by each day: the months given, day by day, averaged (a shorter month holds its last day).
  function usualByDay(txs, months, days, minAmt = 0) {
    if (!months.length) return null;
    const runs = months.map(m => byDay(txs, m, minAmt));
    return Array.from({ length: days }, (_, d) => r2(sum(runs, r => r[Math.min(d, r.length - 1)]) / runs.length));
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

  // ---------------------------------------------------------------------
  // Ipsy's daily check (functions/money/api, POST check): each transaction against its own email.
  // x.check: { s: 'ok' | 'fixed' | 'flag' | 'kept', at, issues?: [{ field, was, now }], note? }.
  // Only what hasn't been checked, this calendar month (and the last 3 days, so the last of a month
  // is checked on the 1st); what passed, was fixed or flagged is never sent again.
  // ---------------------------------------------------------------------
  function toCheck(txs, today) {
    const ym = ymOf(today), t = dayNo(today);
    return txs.filter(x => !x.check && x.src !== 'email' && (ymOf(x.date) === ym || (t - dayNo(x.date) <= 3 && t >= dayNo(x.date)))).sort((a, b) => a.at - b.at);
  }
  // A transaction with what the check said applied (a new object; the old one is left as it was).
  // parse: { account(s) -> { account, last4 }, category(s) -> { cat, emoji } } (money/parse.js).
  const FIELD_OF = { amount: x => x.amt, direction: x => x.dir, merchant: x => x.merchant, account: x => x.account + (x.last4 ? ' (...' + x.last4 + ')' : ''), category: x => x.cat };
  function applyCheck(x, r, at, parse) {
    const y = Object.assign({}, x);
    if (!r) return y;
    if (r.s === 'ok') { y.check = { s: 'ok', at }; return y; }
    if (r.s === 'unsure') { y.check = { s: 'flag', at }; if (r.note) y.check.note = r.note; return y; }
    const issues = [];
    for (const i of r.issues || []) {
      const was = FIELD_OF[i.field] ? String(FIELD_OF[i.field](y)) : '';
      if (i.field === 'amount') { const n = Math.round(parseFloat(String(i.value).replace(/[^\d.]/g, '')) * 100) / 100; if (!isFinite(n)) continue; y.amt = n; }
      else if (i.field === 'direction') { if (i.value !== 'in' && i.value !== 'out') continue; y.dir = i.value; }
      else if (i.field === 'merchant') y.merchant = String(i.value);
      else if (i.field === 'account') { const a = parse.account(i.value); y.account = a.account; y.last4 = a.last4; }
      else if (i.field === 'category') { const c = parse.category(i.value); y.cat = c.cat; if (c.emoji) y.emoji = c.emoji; }
      else continue;
      issues.push({ field: i.field, was, now: String(FIELD_OF[i.field](y)) });
    }
    y.check = issues.length ? { s: 'fixed', at, issues } : { s: 'flag', at };
    return y;
  }
  // Undo a fix: what the app read comes back, and it stays as it is (never checked again).
  function undoCheck(x, parse) {
    const y = Object.assign({}, x);
    if (!x.check || x.check.s !== 'fixed') return y;
    for (const i of x.check.issues || []) {
      if (i.field === 'amount') y.amt = parseFloat(i.was) || y.amt;
      else if (i.field === 'direction') y.dir = i.was === 'in' ? 'in' : 'out';
      else if (i.field === 'merchant') y.merchant = i.was;
      else if (i.field === 'account') { const a = parse.account(i.was); y.account = a.account; y.last4 = a.last4; }
      else if (i.field === 'category') y.cat = i.was;
    }
    y.check = { s: 'kept', at: x.check.at };
    return y;
  }

  // ---------------------------------------------------------------------
  // Your own categories (shared settings, recat): Monarch's category stays on each transaction, and
  // what the family changed sits on top of it.
  //   t: { txId: { c, e, at } }        just this one
  //   m: { merchant key: { c, e, at } } always for this merchant (the default)
  //   g: { category key: { c, e, f, at } } a category folded into another (f: its name as it was)
  // c '' is a change taken back (kept, with its time, so it wins over an older copy on another
  // phone). Ipsy's ideas (ideas: { at, ym, list, no: the ids of those accepted or said no to}) are
  // suggestions until you accept one (functions/money/api, POST ideas).
  // ---------------------------------------------------------------------
  const catKey = s => norm(s);
  function catOf(x, rc) {
    let c = x.cat, e = x.emoji, how = '';
    const t = rc.t && rc.t[x.id], m = rc.m && rc.m[catKey(x.merchant)];
    if (t && t.c) { c = t.c; e = t.e || ''; how = 'tx'; } else if (m && m.c) { c = m.c; e = m.e || ''; how = 'merchant'; }
    for (let i = 0; i < 4; i++) {
      const g = rc.g && rc.g[catKey(c)];
      if (!g || !g.c || catKey(g.c) === catKey(c)) break;
      c = g.c; e = g.e || e; how = how || 'merge';
    }
    return { c, e, how };
  }
  // Each transaction as the family sees it: a copy where its category changed (with Monarch's as mcat).
  function recat(txs, settings) {
    const rc = settings && settings.recat;
    if (!rc) return txs;
    const emoji = new Map();
    for (const x of txs) if (x.cat && x.emoji && !emoji.has(catKey(x.cat))) emoji.set(catKey(x.cat), x.emoji);
    return txs.map(x => {
      const r = catOf(x, rc);
      if (!r.how || (r.c === x.cat && (r.e || x.emoji) === x.emoji)) return x;
      return Object.assign({}, x, { cat: r.c, emoji: r.e || emoji.get(catKey(r.c)) || '🏷️', mcat: x.cat, memoji: x.emoji, how: r.how });
    });
  }
  // Every category in use (as the family sees them), most spent first: [{ name, emoji, n, total }].
  function categories(view) {
    const by = new Map();
    for (const x of view) {
      if (!x.cat) continue;
      const k = catKey(x.cat), c = by.get(k) || { name: x.cat, emoji: x.emoji, n: 0, total: 0 };
      c.n++; if (x.dir === 'out') c.total = r2(c.total + x.amt); by.set(k, c);
    }
    return [...by.values()].sort((a, b) => b.total - a.total || b.n - a.n);
  }
  // ---------------------------------------------------------------------
  // Your own fixes to a transaction's merchant, amount, date and card (shared settings, edits):
  //   edits: { txId: { merch, amt, date, acct, l4, at } }   any of them (acct with its last 4, l4)
  // What Monarch's email said stays on the transaction, as its category does; the fix sits on top of it,
  // and the copy says what it was (ed: { merchant, amt, date, account, last4 }). A new merchant takes
  // that merchant's own category, if the family gave it one. An entry with none of them is a
  // fix taken back (kept, with its time, so it wins over an older copy on another phone). A new date
  // moves it to that day (its at, which orders the lists, becomes noon that day).
  // ---------------------------------------------------------------------
  const EDITS_MAX = 400;
  function edited(txs, settings) {
    const ed = settings && settings.edits;
    if (!ed || !Object.keys(ed).length) return txs;
    let moved = false;
    const out = txs.map(x => {
      const e = ed[x.id]; if (!e) return x;
      const y = Object.assign({}, x), was = {};
      if (typeof e.merch === 'string' && e.merch.trim() && e.merch.trim() !== x.merchant) { was.merchant = x.merchant; y.merchant = e.merch.trim(); }
      if (typeof e.amt === 'number' && isFinite(e.amt) && e.amt >= 0 && Math.abs(e.amt - x.amt) >= 0.005) { was.amt = x.amt; y.amt = r2(e.amt); }
      if (typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date !== x.date) { was.date = x.date; y.date = e.date; y.at = Date.parse(e.date + 'T12:00:00Z'); moved = true; }
      if (typeof e.acct === 'string' && e.acct.trim() && (e.acct !== (x.account || '') || (e.l4 || '') !== (x.last4 || ''))) { was.account = x.account || ''; was.last4 = x.last4 || ''; y.account = e.acct.trim(); y.last4 = e.l4 || ''; }
      if (!Object.keys(was).length) return x;
      y.ed = was; return y;
    });
    return moved ? out.sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1)) : out;
  }
  // A fix to one transaction: the fields given (null takes one back), the rest as they were. A field the
  // same as Monarch's is no fix at all, so it's left out.
  function setEdit(edits, x, patch, at) {
    const o = Object.assign({}, edits), e = Object.assign({}, o[x.id] || {});
    delete e.at;
    for (const [k, v] of Object.entries(patch)) { if (v == null) delete e[k]; else e[k] = v; }
    if (e.merch != null && (!String(e.merch).trim() || String(e.merch).trim() === x.merchant)) delete e.merch;
    if (e.amt != null && Math.abs(e.amt - x.amt) < 0.005) delete e.amt;
    if (e.date != null && e.date === x.date) delete e.date;
    if (e.acct != null && e.acct === (x.account || '') && (e.l4 || '') === (x.last4 || '')) { delete e.acct; delete e.l4; }
    if (e.acct == null) delete e.l4;
    delete o[x.id]; o[x.id] = Object.assign(e, { at });   // the newest last, so the oldest go first past EDITS_MAX
    return Object.fromEntries(Object.entries(o).slice(-EDITS_MAX));
  }
  // Every card and account the transactions name, with the last 4 digits each most often has: [{ name, last4 }].
  function cardList(txs) {
    const m = new Map();
    for (const x of txs) if (x.account) {
      const k = cardKey(x.account), c = m.get(k) || { name: x.account, n: 0, l4: new Map() };
      c.n++; if (x.last4) c.l4.set(x.last4, (c.l4.get(x.last4) || 0) + 1); m.set(k, c);
    }
    return [...m.values()].sort((a, b) => b.n - a.n).map(c => ({ name: c.name, last4: ([...c.l4].sort((a, b) => b[1] - a[1])[0] || [''])[0] }));
  }
  // Two copies of the settings (this phone's and aOS's): the newer one, with every category change,
  // fix and idea taken back from both, entry by entry, the newer of each.
  function mergeSettings(a, b) {
    if (!a) return b; if (!b) return a;
    const base = Object.assign({}, (b.at || 0) >= (a.at || 0) ? b : a);
    const ra = a.recat || {}, rb = b.recat || {}, recat = {};
    for (const k of ['t', 'm', 'g']) {
      const o = Object.assign({}, ra[k] || {});
      for (const [id, v] of Object.entries(rb[k] || {})) if (!o[id] || (v && v.at || 0) >= (o[id].at || 0)) o[id] = v;
      recat[k] = o;
    }
    if (ra.t || ra.m || ra.g || rb.t || rb.m || rb.g) base.recat = recat;
    if (a.edits || b.edits) {
      const o = Object.assign({}, a.edits || {});
      for (const [id, v] of Object.entries(b.edits || {})) if (!o[id] || (v && v.at || 0) >= (o[id].at || 0)) o[id] = v;
      base.edits = Object.fromEntries(Object.entries(o).sort((x, y) => (x[1].at || 0) - (y[1].at || 0)).slice(-EDITS_MAX));
    }
    const ia = a.ideas, ib = b.ideas;
    if (ia || ib) {
      const newer = !ia ? ib : !ib ? ia : (ib.at || 0) >= (ia.at || 0) ? ib : ia;
      base.ideas = Object.assign({}, newer, { no: [...new Set([...(ia && ia.no) || [], ...(ib && ib.no) || []])].slice(-200) });
    }
    return base;
  }
  // What Ipsy is shown for its ideas: the last 12 months' spending by category, the merchants in
  // each, the family's own changes (what it learns from) and the ideas said no to.
  function ideasInput(view, settings, today) {
    const from = ymAdd(ymOf(today), -11), cats = new Map();
    for (const x of view) {
      if (x.dir !== 'out' || !x.cat || ymOf(x.date) < from) continue;
      const k = catKey(x.cat), c = cats.get(k) || { name: x.cat, n: 0, amt: 0, m: new Map() };
      c.n++; c.amt = r2(c.amt + x.amt);
      const mk = catKey(x.merchant), m = c.m.get(mk) || { name: x.merchant, n: 0, amt: 0 };
      m.n++; m.amt = r2(m.amt + x.amt); c.m.set(mk, m); cats.set(k, c);
    }
    const rc = (settings && settings.recat) || {}, names = new Map(view.map(x => [catKey(x.merchant), x.merchant]));
    return {
      categories: [...cats.values()].sort((a, b) => b.amt - a.amt).slice(0, 40).map(c => ({ name: c.name, charges: c.n, spent: c.amt,
        merchants: [...c.m.values()].sort((a, b) => b.amt - a.amt).slice(0, 8).map(m => ({ name: m.name, charges: m.n, spent: m.amt })) })),
      yourChanges: [...Object.entries(rc.m || {}).filter(([, v]) => v && v.c).map(([k, v]) => ({ merchant: names.get(k) || k, category: v.c })),
        ...Object.values(rc.g || {}).filter(v => v && v.c).map(v => ({ merged: v.f, into: v.c }))].slice(0, 80),
      saidNo: ((settings && settings.ideas && settings.ideas.no) || []).slice(-60),
    };
  }

  // ---------------------------------------------------------------------
  // Five years kept: this month and the 59 before it, on the phone and in aOS
  // (functions/money/api keeps the same, KEEP_MONTHS). Anything older is let go.
  // ---------------------------------------------------------------------
  const KEEP_MONTHS = 60;
  const keepFrom = today => ymAdd(ymOf(today), 1 - KEEP_MONTHS);
  const prune = (txs, today) => { const from = keepFrom(today); return txs.filter(x => ymOf(x.date) >= from); };
  // aOS keeps at most MAX_MONTH transactions a month (functions/money/api): the newest n, by date and then by when
  // they were read, so a busier month is sent and not refused (and the months after it still go).
  const MAX_MONTH = 1500;
  const newest = (txs, n = MAX_MONTH) => txs.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.at || 0) - (a.at || 0))).slice(0, n);
  // A CSV cell: quoted, quotes doubled. A cell starting with =, +, - or @ is a formula to Excel or Numbers (CSV
  // injection); it gets a ' in front, as a spreadsheet keeps text, unless it is just a number (-12.50).
  const csvCell = v => { const s = String(v == null ? '' : v); return '"' + (/^[=+\-@]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"'; };

  root.MoneyCalc = { DEFAULT_RULES, ONLINE, okTx, norm, ymOf, ymAdd, daysIn, merge, sameCharge, accounts, isCard, cardKey, ruleFor, kindOf, rateOf, rewards, best, rewardMonths, byCard, missed,
    recurring, minFor, month, pace, compare, weeks, byDay, usualByDay, tips, openAlerts, toCheck, applyCheck, undoCheck, KEEP_MONTHS, keepFrom, prune, MAX_MONTH, newest, csvCell,
    catKey, recat, categories, mergeSettings, ideasInput, edited, setEdit, cardList, EDITS_MAX };
})(typeof window !== 'undefined' ? window : globalThis);
