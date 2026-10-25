// Checks money/calc.js on made-up transactions: folding a summary into its own alert (and
// back), the card a summary's spend was most likely on, rewards (a flat 3% card, a card with 6%
// online and 2% grocery up to a quarterly cap, and a card with no rate set), the better card for a
// kind of spend, spending by card, what repeats, a month against the three before (like for like
// while the older months only had alerts over $200), where you could save, and which "can't
// sync" alerts are still open.
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

console.log(n + ' calc tests passed');
