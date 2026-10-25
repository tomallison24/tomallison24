"use strict";
// Money: reads Monarch's alert emails into transactions and alerts.
//
// Monarch (monarch.com) has no API for its members, but it emails you when
// something happens, and those emails follow a few fixed templates:
//
//   one alert     "We noticed an expense of $52.10 from Big Box, which was spent
//                 from Travel Rewards Visa Signature (...1234) and has been
//                 categorized as 🛍 Shopping."  (an expense or deposit alert over
//                 the amount you set in Monarch's notification settings)
//   a summary     "✨ You have 2 new updates in Monarch": several alerts in one
//                 email, each "A new expense of $209.68 from Amazon has been
//                 categorized as 🛍 Shopping." - with no account
//   disconnected  "🛠️ Access Expired", "🛠️ Sign-In Required", "🛠️ Multi-Factor
//                 Authentication Required": a bank Monarch can no longer sync
//   recurring     "🗓 New recurring merchant found": names and how often
//
// The email's plain-text part can't be trusted: Monarch's leaves the merchant
// and the account out of a single alert ("from , which was spent from and
// has..."), so the HTML is read first, as text, and the plain text only when
// there is no HTML.
//
// No network and no page, so the same file runs in the app and under Node for
// the tests (money/scripts/parse-test.mjs).
(function (root) {
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', ndash: '–', mdash: '—' };
  const decode = s => String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
    return Object.prototype.hasOwnProperty.call(ENT, e.toLowerCase()) ? ENT[e.toLowerCase()] : m;
  });
  // The words of an HTML email, one paragraph a line, with every run of spaces made one.
  function htmlText(html) {
    return decode(String(html || '')
      .replace(/<(head|style|script|title)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d|table)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '))
      .replace(/[ \t\r\f\v ]+/g, ' ').replace(/ *\n[\s]*/g, '\n').trim();
  }
  const squeeze = s => String(s || '').replace(/\s+/g, ' ').trim();
  const money = s => { const n = parseFloat(String(s).replace(/[$,\s]/g, '')); return isFinite(n) ? Math.round(n * 100) / 100 : NaN; };
  const pad = n => String(n).padStart(2, '0');
  // The day an email came, in the phone's own zone: the day the transaction is shown on.
  const dayOf = ms => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

  // "🛍 Shopping" -> { emoji: '🛍', cat: 'Shopping' }; "Gas & Electric" stays whole.
  function category(s) {
    const t = squeeze(s), m = /^([^\p{L}\p{N}]*)(.*)$/u.exec(t);
    return { emoji: squeeze(m[1]), cat: squeeze(m[2]) || t };
  }
  // "Robinhood Credit Card **9876 (...9876)" -> { account: 'Robinhood Credit Card', last4: '9876' };
  // "Apple Card" -> { account: 'Apple Card', last4: '' }.
  function account(s) {
    let t = squeeze(s), last4 = '';
    const m = /\(\s*(?:\.\.\.|…|x+|\*+)\s*(\d{3,5})\s*\)\s*$/i.exec(t);
    if (m) { last4 = m[1]; t = t.slice(0, m.index).trim(); }
    const k = /\s*(?:\*\*|x{2,}|…|\.\.\.)\s*(\d{3,5})\s*$/i.exec(t);
    if (k) { last4 = last4 || k[1]; t = t.slice(0, k.index).trim(); }
    return { account: t, last4 };
  }
  const IN_WORDS = /^(deposit|income|credit|refund|payment received|inflow)/i;
  // a merchant read from a broken plain text ("from , which was spent from and has...") is none
  const okName = s => !!s && !/^[,.\s]/.test(s) && !/\bwhich was\b/i.test(s);
  const dirOf = word => IN_WORDS.test(word) ? 'in' : 'out';

  // One alert. Monarch's own wording, as it is now, is "which was spent from <account>"; for
  // a deposit it may be "deposited into" or the like, so the verb and the little word are open.
  const ONE = /We noticed an? ([a-z][a-z ]{1,24}?) of (-?\$\s?[\d,]+(?:\.\d{1,2})?) (?:from|at|to) (.+?),? which was ([a-z]+(?: [a-z]+)?) (?:from|to|into|in|on|at) (.+?) and has been categori[sz]ed as (.+?)\.(?=\s|$)/i;
  const ONE_SHORT = /We noticed an? ([a-z][a-z ]{1,24}?) of (-?\$\s?[\d,]+(?:\.\d{1,2})?) (?:from|at|to) (.+?),? (?:and )?(?:which )?(?:has been|was) categori[sz]ed as (.+?)\.(?=\s|$)/i;
  // One of a summary's alerts.
  const MANY = /A new ([a-z][a-z ]{1,24}?) of (-?\$\s?[\d,]+(?:\.\d{1,2})?) (?:from|at|to) (.+?) (?:has been|was) categori[sz]ed as (.+?)\.(?=\s|$)/gim;
  // A bank Monarch can't sync, in each of the wordings seen so far, and a catch-all.
  const INST = [
    /(?:^|\n|\s)(?:Hi [^,\n]+,\s*)?([A-Z][^.\n]{1,60}?) only grants Monarch access/,
    /Complete ([^.\n]{2,60}?)['’]s authentication step/i,
    /login credentials for ([^.\n]{2,60}?) are no longer working/i,
    /(?:connection|account|accounts) (?:to|with|at|for) ([A-Z][^.\n]{1,60}?) (?:has|have|is|are|needs?|expired|stopped|was|were|isn['’]t)/,
    /reconnect (?:to |your )?([A-Z][^.\n]{1,60}?)(?: account| accounts)?[.,\n]/,
  ];
  const ALERT_SUBJECT = /access expired|sign[- ]in required|multi[- ]factor|authentication required|reauthori|reconnect|connection (?:lost|error|issue|expired|broken)|disconnected|sync(?:ing)? (?:error|issue|paused|stopped)|unable to (?:sync|connect)/i;
  const ALERT_TEXT = /reauthori[sz]e the connection|no longer working|authentication step|to continue syncing|reconnect your|unable to (?:sync|connect)|has been disconnected/i;
  const FREQ = '(Weekly|Bi-?weekly|Every \\d+ (?:weeks|months|days)|Every (?:week|month|other week)|Twice (?:a|per) month|Semi-?monthly|Monthly|Quarterly|Semi-?annually|Twice a year|Yearly|Annually)';

  // An email -> what it says, or null when it is none of these (a newsletter, Monarch's own news).
  //   { kind: 'tx', items: [{ id, at, date, amt, dir, merchant, account, last4, cat, emoji, mid, src, min? }] }
  //     min: the alert's threshold, from one alert's own words (null when it doesn't say)
  //   { kind: 'alert', alert: { id, at, date, inst, what } }
  //   { kind: 'recurring', merchants: [{ name, freq }] }
  // msg: { id, at (ms), subject, html, text }
  function parse(msg) {
    if (!msg || !msg.id) return null;
    const subject = squeeze(decode(msg.subject || '')), at = +msg.at || 0, date = dayOf(at);
    const text = msg.html ? htmlText(msg.html) : decode(msg.text || '').replace(/[ \t]+/g, ' ');
    const flat = squeeze(text);
    // Monarch's own id for the transaction, from the View Transaction link (one alert only)
    const mid = (/app\.monarch(?:money)?\.com\/links\/transactions\/(\d{6,30})/.exec(msg.html || msg.text || '') || [])[1] || '';
    // what the alert is set to ("You've asked to be notified about expenses over $200"): smaller ones weren't emailed
    const over = (/notified about [a-z ]{0,20}?over (\$\s?[\d,]+(?:\.\d{1,2})?)/i.exec(flat) || [])[1];
    const min = over ? money(over) : null;

    let m = ONE.exec(flat);
    if (m) {
      const amt = money(m[2]), c = category(m[6]), a = account(m[5]);
      if (isFinite(amt) && okName(squeeze(m[3])) && okName(a.account)) return { kind: 'tx', items: [{ id: msg.id, at, date, amt: Math.abs(amt), dir: amt < 0 ? 'in' : dirOf(m[1]), merchant: squeeze(m[3]), account: a.account, last4: a.last4, cat: c.cat, emoji: c.emoji, mid, src: 'alert', min }] };
    }
    m = ONE_SHORT.exec(flat);
    if (m && !/A new [a-z ]+ of \$/i.test(flat)) {
      const amt = money(m[2]), c = category(m[4]);
      if (isFinite(amt) && okName(squeeze(m[3]))) return { kind: 'tx', items: [{ id: msg.id, at, date, amt: Math.abs(amt), dir: amt < 0 ? 'in' : dirOf(m[1]), merchant: squeeze(m[3]), account: '', last4: '', cat: c.cat, emoji: c.emoji, mid, src: 'alert', min }] };
    }
    // A summary: one line each (the HTML has each in its own paragraph; the plain text too)
    const items = [];
    MANY.lastIndex = 0;
    let i = 0;
    for (const line of text.split('\n')) {
      MANY.lastIndex = 0;
      const k = MANY.exec(squeeze(line));
      if (!k) continue;
      const amt = money(k[2]), c = category(k[4]);
      if (!isFinite(amt) || !okName(squeeze(k[3]))) continue;
      items.push({ id: msg.id + ':' + i++, at, date, amt: Math.abs(amt), dir: amt < 0 ? 'in' : dirOf(k[1]), merchant: squeeze(k[3]), account: '', last4: '', cat: c.cat, emoji: c.emoji, mid: '', src: 'summary' });
    }
    if (items.length) return { kind: 'tx', items };

    if (ALERT_SUBJECT.test(subject) || ALERT_TEXT.test(flat)) {
      let inst = '';
      for (const re of INST) { const k = re.exec(text) || re.exec(flat); if (k) { inst = squeeze(k[1]).replace(/^(?:your|the)\s+/i, ''); break; } }
      const what = squeeze(subject.replace(/^[^\p{L}\p{N}]+/u, '')) || 'Connection needs attention';
      return { kind: 'alert', alert: { id: msg.id, at, date, inst, what } };
    }
    if (/recurring merchant/i.test(subject + ' ' + flat)) {
      const from = flat.search(/for tracking\.?/i), to = flat.search(/View all recurring/i);
      const part = from >= 0 ? flat.slice(from).replace(/^for tracking\.?/i, '').slice(0, to > from ? to - from : undefined) : '';
      const merchants = [], re = new RegExp('\\s*(.+?)\\s+' + FREQ + '(?=\\s|$)', 'gi');
      let k;
      while ((k = re.exec(part))) { const name = squeeze(k[1]); if (name && name.length <= 60) merchants.push({ name, freq: k[2] }); }
      if (merchants.length) return { kind: 'recurring', merchants };
    }
    return null;
  }

  // The Gmail search for Monarch's emails (both its addresses: monarchmoney.com was the old one).
  const QUERY = '{from:monarch.com from:monarchmoney.com} -in:chats -in:spam -in:trash';

  const api = { parse, htmlText, decode, category, account, dayOf, QUERY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MoneyParse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
