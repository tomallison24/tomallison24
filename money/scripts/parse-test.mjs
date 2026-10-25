// Checks money/parse.js on made-up emails in Monarch's templates (as of October 2026): one
// expense alert (read from the HTML, since the plain text drops the merchant and the account), a
// card with its number twice, an account with no number, a deposit, a summary of several, the
// three kinds of "can't sync" email, new recurring merchants, and what isn't Monarch's at all.
//   node money/scripts/parse-test.mjs
import assert from 'assert/strict';
import { createRequire } from 'module';
const P = createRequire(import.meta.url)('../parse.js');

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const AT = new Date(2026, 9, 6, 9, 30).getTime();   // 6 October 2026, 9:30 on the phone's clock

// Monarch's single-alert email, cut down to what matters: the paragraph split over two lines, the
// View Transaction link with its id, and the threshold line. Values are made up.
const one = (sentence, over = '$200') => `<!DOCTYPE html><html><head><title>💲 New expense in Monarch</title><style>p{color:#000}</style></head><body>
<p style="margin:0">\r\n  Hi Pat,\r\n</p>\r\n<p style="margin:0">\r\n  \r\n  ${sentence.replace(' and has been', ' and has\r\n  been')}\r\n  \r\n</p>
<a href="https://app.monarch.com/links/transactions/111122223333444455?notification=9" style="color:#fff">View Transaction</a>
<p>You've asked to be notified about expenses over ${over}. You can customize this\r\n alert in your account's <a href="#">notification settings</a>.</p>
<p>This email was sent to <a href="mailto:pat@example.com">pat@example.com</a>.</p></body></html>`;
const BROKEN_TEXT = 'Hi Pat,\n\nWe noticed an expense of $52.10 from , which was spent from and has been categorized as 🛍 Shopping.';

test('one expense alert: from the HTML, with the card, its last four, the category and Monarch’s id', () => {
  const r = P.parse({ id: 'm1', at: AT, subject: '💲 New expense from Corner Hardware in Monarch', html: one('We noticed an expense of $1,052.10 from Corner Hardware, which was spent from Everyday Rewards Visa Signature (...1234) and has been categorized as 🔨 Home Improvement.'), text: BROKEN_TEXT });
  assert.equal(r.kind, 'tx');
  assert.deepEqual(r.items, [{ id: 'm1', at: AT, date: '2026-10-06', amt: 1052.1, dir: 'out', merchant: 'Corner Hardware', account: 'Everyday Rewards Visa Signature', last4: '1234',
    cat: 'Home Improvement', emoji: '🔨', mid: '111122223333444455', src: 'alert', min: 200 }]);
});
test('a card that shows its number twice, and an account with no number', () => {
  const a = P.parse({ id: 'm2', at: AT, subject: 's', html: one('We noticed an expense of $45.00 from Little Learners, which was spent from Rocket Credit Card **9876 (...9876) and has been categorized as 👶 Child Care.', '$1') }).items[0];
  assert.equal(a.account, 'Rocket Credit Card'); assert.equal(a.last4, '9876'); assert.equal(a.min, 1); assert.equal(a.cat, 'Child Care');
  const b = P.parse({ id: 'm3', at: AT, subject: 's', html: one('We noticed an expense of $12.00 from Pharmacy Plus, which was spent from Fruit Card and has been categorized as 💊 Medical.') }).items[0];
  assert.equal(b.account, 'Fruit Card'); assert.equal(b.last4, '');
});
test('an ampersand and an apostrophe in a category or a merchant come out as written', () => {
  const a = P.parse({ id: 'm4', at: AT, subject: 's', html: one('We noticed an expense of $88.20 from Joe&#39;s Gas &amp; Go, which was spent from Shared Checking (...0001) and has been categorized as ⚡️ Gas &amp; Electric.') }).items[0];
  assert.equal(a.merchant, 'Joe\'s Gas & Go'); assert.equal(a.cat, 'Gas & Electric'); assert.equal(a.emoji, '⚡️');
});
test('a deposit comes in, whatever its verb', () => {
  const a = P.parse({ id: 'd1', at: AT, subject: '💵 New deposit from Acme Payroll in Monarch', html: one('We noticed a deposit of $2,400.00 from Acme Payroll, which was deposited into Shared Checking (...0001) and has been categorized as 💵 Paychecks.') }).items[0];
  assert.equal(a.dir, 'in'); assert.equal(a.amt, 2400); assert.equal(a.account, 'Shared Checking'); assert.equal(a.cat, 'Paychecks');
  const b = P.parse({ id: 'd2', at: AT, subject: 's', html: one('We noticed an income of $15.00 from Bank Interest, which was received in Savings (...0002) and has been categorized as 💸 Interest.') }).items[0];
  assert.equal(b.dir, 'in'); assert.equal(b.merchant, 'Bank Interest');
});
test('the plain text only when there is no HTML (and a broken one gives nothing)', () => {
  assert.equal(P.parse({ id: 't1', at: AT, subject: 's', text: BROKEN_TEXT }), null);
  const r = P.parse({ id: 't2', at: AT, subject: 's', text: 'Hi Pat,\n\nWe noticed an expense of $60.00 from Book Nook, which was spent from Fruit Card and has been categorized as 📚 Books.' });
  assert.equal(r.items[0].merchant, 'Book Nook');
});
test('a summary: each alert in it, with no account, numbered after the email', () => {
  const html = `<html><body><p>Hi Pat,</p><p class="activity-message">Here&#39;s a quick summary of recent activity you asked to stay on top of.</p>
  <p class="activity-title"><a href="#">\r\n 💲 New expense from Big Box\r\n</a></p><p class="activity-body"><a href="#">\r\n A new expense of $209.68 from Big Box has been categorized as 🛍 Shopping.\r\n</a></p>
  <p class="activity-title"><a href="#">💲 New expense from Town Utilities</a></p><p class="activity-body"><a href="#">A new expense of $1,241.71 from Town Utilities has been categorized as ⚡️ Gas &amp; Electric.</a></p>
  <p class="activity-title"><a href="#">📥 Transactions need review</a></p><p class="activity-body"><a href="#">You have 2 transactions to review.</a></p>
  <a href="https://app.monarch.com/links/notifications?notification=1">Open Monarch</a></body></html>`;
  const r = P.parse({ id: 's1', at: AT, subject: '✨ You have 3 new updates in Monarch', html });
  assert.equal(r.kind, 'tx');
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.items.map(x => [x.id, x.merchant, x.amt, x.cat, x.account, x.src]), [['s1:0', 'Big Box', 209.68, 'Shopping', '', 'summary'], ['s1:1', 'Town Utilities', 1241.71, 'Gas & Electric', '', 'summary']]);
  assert.equal(r.items[0].min, undefined, 'a summary doesn’t say the threshold');
  // its plain text works too
  const t = P.parse({ id: 's2', at: AT, subject: 's', text: 'Hi Pat,\n\nHere&#x27;s a quick summary.\n\n💲 New expense from Big Box\nA new expense of $9.99 from Big Box has been categorized as 🛍 Shopping.\nhttps://email.example/x\n' });
  assert.equal(t.items[0].amt, 9.99);
});
test('“can’t sync” emails: which bank, and what Monarch says', () => {
  const a = P.parse({ id: 'a1', at: AT, subject: '🛠️ Access Expired', text: 'Hi Pat,\n\nRocket Bank only grants Monarch access for a limited time. To continue syncing, reauthorize the connection.\n\nOpen Monarch to update' });
  assert.deepEqual(a, { kind: 'alert', alert: { id: 'a1', at: AT, date: '2026-10-06', inst: 'Rocket Bank', what: 'Access Expired' } });
  const b = P.parse({ id: 'a2', at: AT, subject: '🛠️ Multi-Factor Authentication Required', html: '<p>Hi Pat,</p><p>Complete First Example Bank&#39;s authentication step, such as entering a code or answering a security question, to allow Monarch to securely sync your data.</p>' });
  assert.equal(b.alert.inst, 'First Example Bank'); assert.equal(b.alert.what, 'Multi-Factor Authentication Required');
  const c = P.parse({ id: 'a3', at: AT, subject: '🛠️ Sign-In Required', text: 'Hi Pat, The login credentials for Example Loan Services are no longer working. This may happen if you recently updated your password.' });
  assert.equal(c.alert.inst, 'Example Loan Services');
  const d = P.parse({ id: 'a4', at: AT, subject: '🛠️ Connection Error', text: 'Hi Pat, We were unable to sync. Please try again later.' });
  assert.equal(d.kind, 'alert'); assert.equal(d.alert.inst, ''); assert.equal(d.alert.what, 'Connection Error');
});
test('new recurring merchants: names and how often', () => {
  const r = P.parse({ id: 'r1', at: AT, subject: '🗓 New recurring merchant found', text: 'Hi Pat, We found 2 new recurring merchants in your transaction history. Open Monarch to review and add to your recurring page for tracking. Stream Box Monthly City Gym Every 2 weeks View all recurring If you have any questions' });
  assert.deepEqual(r, { kind: 'recurring', merchants: [{ name: 'Stream Box', freq: 'Monthly' }, { name: 'City Gym', freq: 'Every 2 weeks' }] });
});
test('anything else is nothing', () => {
  assert.equal(P.parse({ id: 'x1', at: AT, subject: 'Your weekly recap', html: '<p>You spent less on dining this week!</p>' }), null);
  assert.equal(P.parse(null), null);
  assert.equal(P.parse({ at: AT, subject: 's' }), null);
});
test('the helpers', () => {
  assert.deepEqual(P.category('🛍 Shopping'), { emoji: '🛍', cat: 'Shopping' });
  assert.deepEqual(P.category('Shopping'), { emoji: '', cat: 'Shopping' });
  assert.deepEqual(P.account('Card xx4321'), { account: 'Card', last4: '4321' });
  assert.equal(P.decode('&#x27;&#39;&amp;&nbsp;&unknown;'), '\'\'& &unknown;');
  assert.equal(P.htmlText('<style>x{}</style><p>a</p><p>b  c</p>'), 'a\nb c');
  assert.ok(P.QUERY.includes('from:monarch.com'));
});
console.log(n + ' parse tests passed');
