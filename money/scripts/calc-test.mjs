// Checks money/calc.js on made-up transactions: folding a summary into its own alert (and
// back), the card a summary's spend was most likely on, rewards (a flat 3% card, a card with 6%
// online and 2% grocery up to a quarterly cap, and a card with no rate set), the better card for a
// kind of spend, spending by card, what repeats, a month against the three before (like for like
// while the older months only had alerts over $200), where you could save, and which "can't
// sync" alerts are still open, the five years kept, and the family's own categories on top of Monarch's.
//   node money/scripts/calc-test.mjs
import assert from 'assert/strict';
import fs from 'fs';
import vm from 'vm';

vm.runInThisContext(fs.readFileSync(new URL('../calc.js', import.meta.url), 'utf8'));
const C = globalThis.MoneyCalc;

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const at = (date, h = 9) => new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h).getTime();
let k = 0;
const T = (date, amt, merchant, extra = {}) => Object.assign({ id: 'id' + (++k), at: at(date), date, amt, dir: 'out', merchant, account: '', last4: '', cat: 'Shopping', emoji: '🛍', mid: '', src: 'alert' }, extra);
const ROCKET = { account: 'Rocket Credit Card', last4: '9876' };          // stands in for a flat 3% card
const CUSTOM = { account: 'Customized Cash Rewards Visa Signature', last4: '1111' };   // the 6% online one
const TRAVEL = { account: 'Everyday Travel Visa Signature', last4: '2222' };          // a card with no rate set
const RULES = { cards: { 'rocket credit card': { base: 3, online: 0, grocery: 0, cap: 0 } } };

test('merge: a summary’s copy of an alert is dropped, whichever comes first; new ones are counted', () => {
  const alert = T('2026-10-06', 52.1, 'Big Box', CUSTOM), sum = T('2026-10-06', 52.1, 'Big Box', { src: 'summary', id: 's:0' });
  let r = C.merge([], [sum]); assert.equal(r.added, 1);
  r = C.merge(r.list, [alert]);
  assert.equal(r.list.length, 1); assert.equal(r.list[0].account, CUSTOM.account, 'the alert wins: it says which card');
  r = C.merge(r.list, [sum, alert]); assert.equal(r.added, 0); assert.equal(r.list.length, 1);
  // the same amount at the same place a week later is a new one
  r = C.merge(r.list, [T('2026-10-13', 52.1, 'Big Box', { src: 'summary', id: 's2:0' })]); assert.equal(r.list.length, 2);
  // Monarch's own id twice is one; something malformed is nothing
  r = C.merge([T('2026-10-01', 5, 'A', { mid: '77' })], [T('2026-10-03', 5, 'A', { mid: '77' }), { id: 'bad' }]);
  assert.equal(r.list.length, 1);
});

test('merge: a charge Ipsy found in an email gives way to Monarch’s, whichever comes first; never counted twice', () => {
  const found = T('2026-10-20', 1052.1, 'Frontier Airlines', { src: 'email', id: 'e:bk1:105210', last4: '4242' });
  const monarch = T('2026-10-21', 1052.1, 'FRONTIER AIRLINES INC', { account: 'Visa', last4: '4242', id: 'm1' });
  let r = C.merge([], [found]); assert.equal(r.list.length, 1);
  r = C.merge(r.list, [monarch]);
  assert.deepEqual(r.list.map(x => x.id), ['m1'], 'Monarch emailed it after all: its copy stays, the found one goes');
  r = C.merge([monarch], [found]); assert.deepEqual(r.list.map(x => x.id), ['m1'], 'and found after Monarch’s, it isn’t added');
  // another card, or four days apart, or another amount: a different charge
  assert.equal(C.merge([found], [T('2026-10-21', 1052.1, 'Frontier', { last4: '1111', id: 'm2' })]).list.length, 2);
  assert.equal(C.merge([found], [T('2026-10-25', 1052.1, 'Frontier', { id: 'm3' })]).list.length, 2);
  assert.equal(C.merge([found], [T('2026-10-20', 1052.11, 'Frontier', { id: 'm4' })]).list.length, 2);
  assert.ok(C.sameCharge(found, monarch));
  // never sent to Ipsy's daily check against Monarch's emails
  assert.deepEqual(C.toCheck([found, monarch], '2026-10-22').map(x => x.id), ['m1']);
});

test('accounts: a summary’s spend takes the card its merchant’s alerts nearly always used, as a guess', () => {
  const list = [T('2026-09-01', 391.5, 'Little Learners', ROCKET), T('2026-09-08', 391.5, 'Little Learners', ROCKET), T('2026-09-15', 391.5, 'Little Learners', { src: 'summary' }),
    T('2026-09-02', 40, 'Corner Shop', ROCKET), T('2026-09-03', 40, 'Corner Shop', CUSTOM), T('2026-09-04', 40, 'Corner Shop', { src: 'summary' })];
  const acct = C.accounts(list);
  assert.deepEqual(acct(list[2]), { name: 'Rocket Credit Card', guess: true });
  assert.deepEqual(acct(list[0]), { name: 'Rocket Credit Card', guess: false });
  assert.deepEqual(acct(list[5]), { name: '', guess: false }, 'two cards half and half: no guess');
  assert.ok(C.isCard('Rocket Credit Card')); assert.ok(!C.isCard('Shared Checking'));
});

test('rewards: 3% flat; 6% online, 2% at a wholesale club, 1% else on Customized Cash; nothing for a card with no rate', () => {
  const list = [T('2026-10-02', 100, 'Little Learners', ROCKET), T('2026-10-03', 100, 'Amazon', CUSTOM), T('2026-10-04', 100, 'Costco', CUSTOM),
    T('2026-10-05', 100, 'Diner', Object.assign({ cat: 'Restaurants' }, CUSTOM)), T('2026-10-06', 100, 'Costco', TRAVEL), T('2026-10-07', 50, 'Payroll', { dir: 'in', account: 'Shared Checking' })];
  const rw = C.rewards(list, RULES);
  assert.deepEqual([...list.slice(0, 5)].map(x => rw.get(x.id).earned), [3, 6, 2, 1, 0]);
  assert.deepEqual([...list.slice(0, 5)].map(x => rw.get(x.id).rate), [3, 6, 2, 1, null]);
  assert.equal(rw.get(list[1].id).kind, 'online'); assert.equal(rw.get(list[2].id).kind, 'grocery');
  assert.equal(rw.has(list[5].id), false, 'money in earns nothing');
  // a category of Groceries counts as grocery anywhere
  assert.equal(C.kindOf(T('2026-10-01', 1, 'Fresh Mart', { cat: 'Groceries' })), 'grocery');
  // the online list can be the family's own
  assert.equal(C.kindOf(T('2026-10-01', 1, 'Amazon'), { online: ['Book Nook'] }), 'base');
  assert.equal(C.kindOf(T('2026-10-01', 1, 'Book Nook'), { online: ['Book Nook'] }), 'online');
  // a card's rule can be switched off
  assert.equal(C.ruleFor('Rocket Credit Card', { cards: { 'rocket credit card': { off: true } } }), null);
});

test('rewards: Customized Cash’s bonus stops at its quarterly cap, and starts again next quarter', () => {
  const list = [T('2026-07-02', 2000, 'Amazon', CUSTOM), T('2026-08-02', 1000, 'Amazon', CUSTOM), T('2026-09-02', 100, 'Amazon', CUSTOM), T('2026-10-02', 100, 'Amazon', CUSTOM)];
  const rw = C.rewards(list, {});
  assert.equal(rw.get(list[0].id).earned, 120);
  assert.equal(rw.get(list[1].id).earned, 35, '$500 at 6% and $500 at 1%');
  assert.ok(rw.get(list[1].id).capped);
  assert.equal(rw.get(list[2].id).earned, 1); assert.equal(rw.get(list[2].id).rate, 1);
  assert.equal(rw.get(list[3].id).earned, 6, 'a new quarter');
});

test('rewards a month, per card, and spending by card', () => {
  const list = [T('2026-09-10', 200, 'Little Learners', ROCKET), T('2026-10-02', 100, 'Little Learners', ROCKET), T('2026-10-03', 100, 'Amazon', CUSTOM),
    T('2026-10-04', 300, 'Costco', TRAVEL), T('2026-10-05', 50, 'Little Learners', { src: 'summary' }), T('2026-10-06', 999, 'Mortgage Co', { account: 'Shared Checking', cat: 'Mortgage' })];
  const m = C.rewardMonths(list, RULES, '2026-10', 3);
  assert.deepEqual(m.map(x => x.ym), ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(m[1].cards, { 'Rocket Credit Card': 6 });
  assert.deepEqual(m[2].cards, { 'Rocket Credit Card': 4.5, 'Customized Cash Rewards Visa Signature': 6 });
  assert.equal(m[2].total, 10.5);
  const c = C.byCard(list, '2026-10', RULES);
  assert.deepEqual(c.map(x => [x.card, x.spent, x.n, x.earned, x.guessed]), [
    ['Shared Checking', 999, 1, 0, 0], ['Everyday Travel Visa Signature', 300, 1, 0, 0], ['Rocket Credit Card', 150, 2, 4.5, 1], ['Customized Cash Rewards Visa Signature', 100, 1, 6, 0]]);
  assert.equal(c[1].rule, null, 'no rate set'); assert.equal(c[2].rule.base, 3);
  assert.equal(c[0].isCard, false); assert.equal(c[1].isCard, true);
});

test('missed rewards: online shopping on the 3% card would earn 6% on Customized Cash', () => {
  const list = [T('2026-10-03', 100, 'Amazon', CUSTOM), T('2026-10-04', 400, 'Amazon', ROCKET), T('2026-09-04', 100, 'Amazon', ROCKET), T('2026-10-05', 200, 'Diner', Object.assign({ cat: 'Restaurants' }, CUSTOM))];
  const m = C.missed(list, RULES, '2026-08', '2026-10');
  assert.equal(m.length, 2);
  assert.deepEqual(m[0], { from: 'Rocket Credit Card', to: 'Customized Cash Rewards Visa Signature', kind: 'online', rate: 6, fromRate: 3, spent: 500, more: 15, n: 2 });
  assert.deepEqual([m[1].from, m[1].to, m[1].kind, m[1].more], ['Customized Cash Rewards Visa Signature', 'Rocket Credit Card', 'base', 4], 'a diner on the 1% card: 3% would earn $4 more');
  assert.equal(C.missed(list, RULES, '2026-10', '2026-10')[0].spent, 400, 'only the months asked');
});

test('recurring: weekly, monthly; a one-off isn’t; one that stopped is inactive', () => {
  const list = [];
  for (const d of ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13', '2026-10-20']) list.push(T(d, 391.5, 'Little Learners', ROCKET));
  for (const d of ['2026-06-03', '2026-07-03', '2026-08-04', '2026-09-03', '2026-10-03']) list.push(T(d, 1000, 'Mortgage Co', { cat: 'Mortgage', emoji: '🏠' }));
  for (const d of ['2026-03-10', '2026-04-10', '2026-05-11']) list.push(T(d, 15, 'Old Stream'));
  list.push(T('2026-10-01', 600, 'Sofa Store'), T('2026-10-09', 30, 'Sofa Store'), T('2026-10-21', 12, 'Sofa Store'));
  const r = C.recurring(list, '2026-10-24');
  assert.deepEqual(r.map(x => [x.merchant, x.every, x.amt, x.yearly, x.active]), [
    ['Little Learners', 'weekly', 391.5, 20358, true], ['Mortgage Co', 'monthly', 1000, 12000, true], ['Old Stream', 'monthly', 15, 180, false]]);
  assert.equal(r[1].emoji, '🏠');
});

test('a month: spent, income, by category and merchant; the pace once a week has gone', () => {
  const list = [T('2026-10-02', 100, 'Amazon'), T('2026-10-03', 50, 'Amazon'), T('2026-10-04', 25, 'Diner', { cat: 'Restaurants', emoji: '🍽' }), T('2026-10-05', 2000, 'Acme Payroll', { dir: 'in', cat: 'Paychecks' }), T('2026-09-30', 70, 'Diner', { cat: 'Restaurants' })];
  const m = C.month(list, '2026-10');
  assert.equal(m.spent, 175); assert.equal(m.income, 2000); assert.equal(m.out, 3);
  assert.deepEqual(m.cats.map(c => [c.name, c.total, c.n]), [['Shopping', 150, 2], ['Restaurants', 25, 1]]);
  assert.deepEqual(m.merchants[0], { name: 'Amazon', emoji: '🛍', total: 150, n: 2 });
  assert.equal(C.month(list, '2026-10', 60).spent, 100, 'only what is over an amount');
  assert.equal(C.pace(list, '2026-10', '2026-10-05'), null, 'too soon to say');
  assert.equal(C.pace(list, '2026-10', '2026-10-15'), Math.round(175 / 15 * 31 * 100) / 100);
  assert.equal(C.pace(list, '2026-09', '2026-10-15'), null, 'not this month');
  assert.equal(C.daysIn('2026-02'), 28); assert.equal(C.ymAdd('2026-01', -1), '2025-12');
});

test('compare: against the 3 months before, like for like while those only had alerts over $200', () => {
  const list = [
    T('2026-07-05', 300, 'Amazon', { min: 200 }), T('2026-08-05', 300, 'Amazon', { min: 200 }), T('2026-09-05', 300, 'Amazon', { min: 200 }), T('2026-09-06', 250, 'Mortgage Co', { cat: 'Mortgage', min: 200 }),
    T('2026-10-05', 700, 'Amazon', { min: 1 }), T('2026-10-06', 40, 'Diner', { cat: 'Restaurants', min: 1 }), T('2026-10-07', 12, 'Diner', { cat: 'Restaurants', src: 'summary' })];
  assert.equal(C.minFor(list, '2026-09', 'out'), 200); assert.equal(C.minFor(list, '2026-10', 'out'), 1);
  const c = C.compare(list, '2026-10');
  assert.equal(c.min, 200); assert.ok(c.likeForLike);
  assert.equal(c.spent, 700, 'the $40 and $12 aren’t counted against months that couldn’t have had them');
  assert.equal(c.avg, Math.round((300 + 300 + 550) / 3 * 100) / 100);
  assert.deepEqual(c.cats.find(x => x.name === 'Shopping'), { name: 'Shopping', emoji: '🛍', now: 700, avg: 300, diff: 400 });
  assert.equal(C.compare([T('2026-10-05', 1, 'A')], '2026-10'), null, 'nothing before: nothing to compare with');
  // all after the change: everything counts
  const later = [T('2026-11-03', 10, 'Diner', { cat: 'Restaurants', min: 1 }), T('2026-12-03', 30, 'Diner', { cat: 'Restaurants', min: 1 })];
  const c2 = C.compare(later, '2026-12');
  assert.equal(c2.min, 1); assert.equal(c2.likeForLike, false); assert.equal(c2.spent, 30);
});

test('tips: a spike, a better card, where the most went, what repeats', () => {
  const list = [T('2026-07-05', 300, 'Amazon', Object.assign({ min: 200 }, CUSTOM)), T('2026-08-05', 300, 'Amazon', Object.assign({ min: 200 }, CUSTOM)), T('2026-09-05', 300, 'Amazon', Object.assign({ min: 200 }, CUSTOM)),
    T('2026-10-05', 500, 'Amazon', Object.assign({ min: 200 }, ROCKET)), T('2026-10-12', 400, 'Amazon', Object.assign({ min: 200 }, ROCKET))];
  for (const d of ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13', '2026-10-20']) list.push(T(d, 391.5, 'Little Learners', Object.assign({ cat: 'Child Care', min: 200 }, ROCKET)));
  const t = C.tips(list, '2026-10', '2026-10-24', RULES);
  const kinds = t.map(x => x.kind);
  assert.ok(kinds.includes('spike') && kinds.includes('card') && kinds.includes('merchant') && kinds.includes('recurring'), kinds.join());
  assert.deepEqual(t.find(x => x.kind === 'spike'), { kind: 'spike', cat: 'Shopping', emoji: '🛍', now: 900, avg: 300, diff: 600, likeForLike: false, min: 200 });
  const card = t.find(x => x.kind === 'card');
  assert.deepEqual([card.from, card.to, card.kindOf, card.more], ['Rocket Credit Card', 'Customized Cash Rewards Visa Signature', 'online', 27]);
  assert.deepEqual(t.find(x => x.kind === 'merchant'), { kind: 'merchant', merchant: 'Little Learners', total: 1174.5, n: 3 });
  assert.equal(t.find(x => x.kind === 'recurring').total, 20358);
  assert.equal(t[0].kind, 'spike', 'biggest first');
});

test('open alerts: recent, not marked fixed, the newest per bank, and gone once that bank’s account syncs again', () => {
  const A = (id, date, inst, what = 'Access Expired') => ({ id, at: at(date), date, inst, what });
  const alerts = [A('a1', '2026-10-01', 'Rocket'), A('a2', '2026-10-10', 'Rocket'), A('a3', '2026-10-12', 'First Example Bank', 'Sign-In Required'), A('a4', '2026-08-01', 'Old Bank'), A('a5', '2026-10-20', 'Shared Bank')];
  const txs = [T('2026-10-11', 5, 'X', ROCKET)];
  const open = C.openAlerts(alerts, txs, ['a5'], '2026-10-24');
  assert.deepEqual(open.map(a => a.id), ['a3'], 'Rocket synced again after its alert; Old Bank is too old; Shared Bank was marked fixed');
  assert.deepEqual(C.openAlerts(alerts, [], [], '2026-10-24').map(a => a.id), ['a5', 'a3', 'a2']);
});

test('Ipsy’s check: what to send (this month and the last 3 days, never twice), a correction applied and undone', () => {
  const P = { account: s => { const m = /^(.*?)\s*\(\.\.\.(\d+)\)$/.exec(s); return m ? { account: m[1], last4: m[2] } : { account: s, last4: '' }; },
    category: s => { const m = /^([^\p{L}]*)(.*)$/u.exec(s); return { emoji: m[1].trim(), cat: m[2].trim() }; } };
  const list = [T('2026-11-02', 10, 'A'), T('2026-10-30', 20, 'B'), T('2026-10-20', 30, 'C'), T('2026-11-03', 40, 'D', { check: { s: 'ok', at: 1 } })];
  assert.deepEqual(C.toCheck(list, '2026-11-02').map(x => x.merchant), ['B', 'A'], 'oldest first; Oct 30 is within 3 days; checked ones never again');
  const x = T('2026-11-02', 52.1, 'Big Box', ROCKET);
  const ok = C.applyCheck(x, { s: 'ok' }, 5, P);
  assert.deepEqual(ok.check, { s: 'ok', at: 5 }); assert.equal(x.check, undefined, 'the old one is left as it was');
  const flag = C.applyCheck(x, { s: 'unsure', note: 'Two amounts' }, 5, P);
  assert.deepEqual(flag.check, { s: 'flag', at: 5, note: 'Two amounts' });
  const fix = C.applyCheck(x, { s: 'fix', issues: [{ field: 'amount', value: '$1,052.10' }, { field: 'account', value: 'Everyday Visa (...1234)' }, { field: 'category', value: '🔨 Home Improvement' }, { field: 'direction', value: 'sideways' }] }, 6, P);
  assert.equal(fix.amt, 1052.1); assert.equal(fix.account, 'Everyday Visa'); assert.equal(fix.last4, '1234'); assert.equal(fix.cat, 'Home Improvement'); assert.equal(fix.emoji, '🔨'); assert.equal(fix.dir, 'out');
  assert.deepEqual(fix.check, { s: 'fixed', at: 6, issues: [{ field: 'amount', was: '52.1', now: '1052.1' }, { field: 'account', was: 'Rocket Credit Card (...9876)', now: 'Everyday Visa (...1234)' }, { field: 'category', was: 'Shopping', now: 'Home Improvement' }] });
  const back = C.undoCheck(fix, P);
  assert.equal(back.amt, 52.1); assert.equal(back.account, 'Rocket Credit Card'); assert.equal(back.last4, '9876'); assert.equal(back.cat, 'Shopping');
  assert.deepEqual(back.check, { s: 'kept', at: 6 }, 'kept as the app read it, and never checked again');
  assert.equal(C.toCheck([back], '2026-11-02').length, 0);
  assert.deepEqual(C.applyCheck(x, { s: 'fix', issues: [{ field: 'direction', value: 'sideways' }] }, 7, P).check, { s: 'flag', at: 7 }, 'nothing usable: flagged, not fixed');
});

test('five years kept: this month and the 59 before it, at the end of a month and the start of a year too', () => {
  assert.equal(C.KEEP_MONTHS, 60);
  assert.equal(C.keepFrom('2026-10-25'), '2021-11'); assert.equal(C.keepFrom('2026-01-01'), '2021-02'); assert.equal(C.keepFrom('2026-12-31'), '2022-01');
  const list = [T('2021-10-31', 1, 'Too old'), T('2021-11-01', 2, 'Oldest kept'), T('2026-10-25', 3, 'Today')];
  assert.deepEqual(C.prune(list, '2026-10-25').map(x => x.merchant), ['Oldest kept', 'Today']);
});

test('a month sent to aOS is capped at the 1,500 it keeps: the newest by date, then by when they were read', () => {
  assert.equal(C.MAX_MONTH, 1500);
  const many = Array.from({ length: 1600 }, (_, i) => T('2026-10-' + String(1 + (i % 28)).padStart(2, '0'), 1, 'Shop ' + i, { at: 1e12 + i }));
  const sent = C.newest(many);
  assert.equal(sent.length, 1500); assert.equal(many.length, 1600, 'the phone keeps them all');
  assert.ok(sent.every((x, i) => !i || sent[i - 1].date > x.date || (sent[i - 1].date === x.date && sent[i - 1].at >= x.at)), 'newest first');
  const dropped = many.filter(x => !sent.includes(x));
  assert.ok(dropped.every(x => x.date <= sent[sent.length - 1].date), 'what is left out is the oldest');
  assert.deepEqual(C.newest([T('2026-10-05', 1, 'a', { at: 5 }), T('2026-10-05', 1, 'b', { at: 9 }), T('2026-10-01', 1, 'c', { at: 99 })], 2).map(x => x.merchant), ['b', 'a'], 'same day: the one read last first');
  assert.equal(C.newest(many.slice(0, 10)).length, 10, 'a small month goes whole');
});

test('a CSV cell: quoted, quotes doubled, and a cell a spreadsheet would run as a formula kept as text', () => {
  assert.equal(C.csvCell('Corner Diner'), '"Corner Diner"');
  assert.equal(C.csvCell('Joe "The Mechanic" Garage'), '"Joe ""The Mechanic"" Garage"');
  assert.equal(C.csvCell(null), '""'); assert.equal(C.csvCell(''), '""');
  assert.equal(C.csvCell('=HYPERLINK("http://evil.example")'), `"'=HYPERLINK(""http://evil.example"")"`);
  assert.equal(C.csvCell('+1 (555) 010-0000'), `"'+1 (555) 010-0000"`);
  assert.equal(C.csvCell('-cmd|calc'), `"'-cmd|calc"`);
  assert.equal(C.csvCell('@SUM(A1)'), `"'@SUM(A1)"`);
  assert.equal(C.csvCell('-12.50'), '"-12.50"', 'a plain negative number is a number, not a formula');
  assert.equal(C.csvCell((5).toFixed(2)), '"5.00"'); assert.equal(C.csvCell('2026-10-25'), '"2026-10-25"');
});

test('your own categories: just one, always for a merchant, a merge on top; Monarch’s underneath; two phones merged', () => {
  const list = [T('2026-10-05', 20, 'Corner Diner', { cat: 'Restaurants', emoji: '🍽' }), T('2026-10-06', 30, 'Corner Diner', { cat: 'Restaurants', emoji: '🍽' }),
    T('2026-10-07', 4, 'Bean Bar', { cat: 'Coffee Shops', emoji: '☕' }), T('2026-10-08', 90, 'Big Box')];
  assert.equal(C.recat(list, {}), list, 'nothing changed: the same list');
  const s = { recat: { m: { 'corner diner': { c: 'Eating out', e: '', at: 2 } }, t: { [list[1].id]: { c: 'Gifts', e: '🎁', at: 3 } }, g: { 'coffee shops': { c: 'Eating out', e: '', f: 'Coffee Shops', at: 2 }, 'eating out': { c: 'Food', e: '🍔', f: 'Eating out', at: 4 } } } };
  const v = C.recat(list, s);
  assert.deepEqual(v.map(x => [x.cat, x.mcat, x.how]), [['Food', 'Restaurants', 'merchant'], ['Gifts', 'Restaurants', 'tx'], ['Food', 'Coffee Shops', 'merge'], ['Shopping', undefined, undefined]],
    'just one wins over its merchant; merges follow on (Eating out is in Food); Big Box as Monarch said');
  assert.equal(v[1].emoji, '🎁'); assert.equal(v[0].emoji, '🍔'); assert.equal(list[0].cat, 'Restaurants', 'Monarch’s stays on the transaction');
  assert.equal(C.recat(list, { recat: { m: { 'corner diner': { c: '', e: '', at: 5 } } } })[0].cat, 'Restaurants', 'a change taken back');
  assert.deepEqual(C.categories(v).map(c => [c.name, c.n, c.total]), [['Shopping', 1, 90], ['Gifts', 1, 30], ['Food', 2, 24]]);
  // this phone's copy and aOS's: the newer base, every change the newer of each, ideas said no to from both
  const mine = { at: 10, cards: { a: 1 }, recat: { m: { 'corner diner': { c: 'Eating out', at: 9 } } }, ideas: { at: 9, list: [], no: ['x'] } };
  const theirs = { at: 20, cards: { b: 1 }, recat: { m: { 'corner diner': { c: 'Diner', at: 5 }, 'big box': { c: 'Household', at: 6 } } }, ideas: { at: 8, list: [{ id: 'y' }], no: ['z'] } };
  const both = C.mergeSettings(mine, theirs);
  assert.deepEqual(both.cards, { b: 1 }); assert.equal(both.recat.m['corner diner'].c, 'Eating out'); assert.equal(both.recat.m['big box'].c, 'Household');
  assert.deepEqual(both.ideas, { at: 9, list: [], no: ['x', 'z'] });
  // what Ipsy is shown: the last 12 months out, by category, with merchants; your changes; what you said no to
  const inp = C.ideasInput(v.concat(T('2025-09-01', 500, 'Old Shop')), { recat: s.recat, ideas: { no: ['merge:a>b'] } }, '2026-10-25');
  assert.deepEqual(inp.categories.map(c => c.name), ['Shopping', 'Gifts', 'Food'], 'more than 12 months ago: left out');
  assert.deepEqual(inp.categories[2].merchants.map(m => m.name), ['Corner Diner', 'Bean Bar']);
  assert.deepEqual(inp.yourChanges, [{ merchant: 'Corner Diner', category: 'Eating out' }, { merged: 'Coffee Shops', into: 'Eating out' }, { merged: 'Eating out', into: 'Food' }]);
  assert.deepEqual(inp.saidNo, ['merge:a>b']);
});

test('week by week, and through the month against the usual', () => {
  const list = [T('2026-10-04', 50, 'A', { cat: 'Food' }), T('2026-10-05', 20, 'B', { cat: 'Food' }), T('2026-10-11', 100, 'C'), T('2026-10-12', 7, 'D'),
    T('2026-10-31', 30, 'E'), T('2026-10-12', 900, 'Pay', { dir: 'in' }), T('2026-09-30', 40, 'F'), T('2026-09-01', 10, 'G'), T('2026-08-31', 60, 'H')];
  // Sundays: Oct 4 starts a week; Oct 31 is a Saturday
  const w = C.weeks(list, '2026-10-31', 5);
  assert.deepEqual(w.map(x => [x.start, x.end, x.spent, x.n]), [['2026-09-27', '2026-10-03', 40, 1], ['2026-10-04', '2026-10-10', 70, 2], ['2026-10-11', '2026-10-17', 107, 2], ['2026-10-18', '2026-10-24', 0, 0], ['2026-10-25', '2026-10-31', 30, 1]], 'money in left out');
  assert.deepEqual(w[1].cats.map(c => [c.name, c.total, c.n]), [['Food', 70, 2]]);
  assert.deepEqual(C.weeks(list, '2026-10-12', 2, 1).map(x => [x.start, x.spent]), [['2026-10-05', 120], ['2026-10-12', 7]], 'weeks from Monday');
  assert.deepEqual(C.weeks(list, '2026-10-12', 2, 0, 25).map(x => x.spent), [50, 100], 'only what’s over the threshold');
  const d = C.byDay(list, '2026-10');
  assert.equal(d.length, 31); assert.equal(d[2], 0); assert.equal(d[3], 50); assert.equal(d[11], 177); assert.equal(d[30], 207);
  const u = C.usualByDay(list, ['2026-09', '2026-08'], 31);
  assert.equal(u[0], 5, '(10 + 0) / 2'); assert.equal(u[29], 25, '(50 + 0) / 2: August’s 30th had nothing'); assert.equal(u[30], 55, '(50 + 60) / 2: September holds its last day');
  assert.equal(C.usualByDay(list, [], 31), null);
});

console.log(n + ' calc tests passed');
