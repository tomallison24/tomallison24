// home/redact.js: what's sent to Claude has email addresses, phone numbers, card, account and ID numbers swapped for
// placeholders, and what comes back has them put back; order, tracking and booking numbers, dates, prices, the last
// four digits and the apps' own ids are left alone.
//   node home/scripts/redact-test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../redact.js');
let failed = 0;
const test = (name, fn) => { try { fn(); console.log('ok - ' + name); } catch (e) { failed++; console.log('not ok - ' + name + '\n  ' + String(e.message).split('\n').join('\n  ')); } };

test('swapped: email addresses, phone numbers, card, account and ID numbers', () => {
  const M = R.make();
  const text = 'From Tom <tom.allison@example.com>, call me on (303) 555-0142 or +44 20 7946 0958 or 303.555.0199. '
    + 'Card 4111 1111 1111 1111, Visa 4012888888881881. IBAN GB82 WEST 1234 5698 7654 32. Account number: 000123456789, routing # 021000021. SSN 123-45-6789.';
  const out = M.hide(text);
  for (const s of ['tom.allison@example.com', '555-0142', '7946 0958', '555.0199', '4111 1111 1111 1111', '4012888888881881', 'GB82 WEST', '000123456789', '021000021', '123-45-6789'])
    assert.ok(!out.includes(s), `still in it: ${s}\n${out}`);
  assert.match(out, /\[email-1\]/); assert.match(out, /\[phone-1\]/); assert.match(out, /\[card-1 ending 1111\]/); assert.match(out, /\[card-2 ending 1881\]/);
  assert.match(out, /\[account-1\]/); assert.match(out, /\[id-1\]/);
  assert.equal(M.show(out), text, 'shown again, it is the text as it was');
});

test('left alone: order, tracking and booking numbers, dates, times, prices, last four digits, ids and timestamps', () => {
  const M = R.make();
  const text = 'Order #112-1234567-1234567 shipped by UPS 1Z999AA10123456784, USPS 9400111899223344556677, FedEx 123456789012. '
    + 'Booking ref ABC123, flight UA 1234 on 2026-10-28 at 14:35, total $1,234.56. Visa ending 4242, Chase account ending 1234. '
    + 'Saved at 1793070125025, id pmvq3mohl, zip 80202, phone ext 12, 39.7392,-104.9903. Call 911.';
  assert.equal(M.hide(text), text);
  assert.equal(M.size, 0);
});

test('the same detail always gets the same placeholder, and a saved set carries on numbering', () => {
  const M = R.make();
  const a = M.hide('a@b.co and c@d.co'), b = M.hide('again a@b.co');
  assert.equal(a, '[email-1] and [email-2]'); assert.equal(b, 'again [email-1]');
  const N = R.make(JSON.parse(JSON.stringify(M.saved())));
  assert.equal(N.hide('c@d.co, e@f.co'), '[email-2], [email-3]');
  assert.equal(N.show('[email-1] [email-3] [email-9]'), 'a@b.co e@f.co [email-9]', 'an unknown placeholder stays as it is');
});

test('put back in anything made of strings: a tool\'s input, the facts read from an email', () => {
  const M = R.make();
  M.hide('write to sam@example.com or 720-555-0100');
  assert.deepEqual(M.show({ to: '[email-1]', list: ['[phone-1]', 3, null, { x: '[email-1]!' }], n: 2, ok: true }),
    { to: 'sam@example.com', list: ['720-555-0100', 3, null, { x: 'sam@example.com!' }], n: 2, ok: true });
});

test('inside JSON text, as a tool\'s result goes: still JSON that reads right', () => {
  const M = R.make();
  const out = M.hide(JSON.stringify({ guest: 'Ann', email: 'ann@example.com', phone: '+1 415 555 0132', notes: 'card 5555 5555 5555 4444' }));
  const j = JSON.parse(out);
  assert.deepEqual(j, { guest: 'Ann', email: '[email-1]', phone: '[phone-1]', notes: 'card [card-1 ending 4444]' });
  assert.equal(JSON.parse(M.show(out)).email, 'ann@example.com');
});

test('not text: passed through untouched', () => {
  const M = R.make();
  assert.equal(M.hide(''), ''); assert.equal(M.hide(null), null); assert.equal(M.hide(undefined), undefined);
  assert.equal(M.show(5), 5);
});

console.log(failed ? failed + ' failed' : 'all passed'); process.exit(failed ? 1 : 0);
