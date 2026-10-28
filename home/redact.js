// Personal details kept on the phone: what an app sends Claude (home/ipsy.js, Ipsy's chat; Orders, Travel and Money's
// checks of their emails) goes with each email address, phone number, card number, bank account number and ID number
// swapped for a placeholder - [email-1], [phone-2], [card-1 ending 4242], [account-1], [id-1] - and the real one kept
// here. Claude works with the placeholders as they are; what comes back (a tool to run, an answer to show, the facts
// read from an email) has the real ones put back on the phone, so nothing it does is any the worse for not seeing them.
// The same detail always gets the same placeholder (make(saved) carries a chat's on from where it was).
//
// Left as they are, because the apps need them read: names, addresses, order, tracking and booking numbers, and the
// last four digits a card or account is known by ("Visa ending 4242"). Only what looks clearly like one of the
// above is swapped: a phone number needs its separators or a +, a card number has to pass the card check digit
// (Luhn) and be written in groups or next to a word like card or Visa, an account number needs its label
// ("account number", "routing", "IBAN" by its own check), so order and tracking numbers aren't mistaken for them.
//
// AllisonOS.redact: make(saved) -> { hide(text), show(anything), saved(), size }. Also a module, for its tests
// (home/scripts/redact-test.mjs).
'use strict';
(function () {
  const luhn = d => { let s = 0; for (let i = d.length - 1, alt = false; i >= 0; i--, alt = !alt) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } s += n; } return s % 10 === 0; };
  const ibanOk = raw => {
    const s = raw.replace(/ /g, '');
    if (s.length < 15 || s.length > 34) return false;
    const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
    let m = 0; for (const ch of r) m = (m * 10 + +ch) % 97;
    return m === 1;
  };
  const digits = s => s.replace(/\D/g, '');

  // In order: an email's digits aren't a phone number, a card's groups aren't one either.
  const RULES = [
    { kind: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
    { kind: 'account', re: /(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?(?![A-Za-z0-9])/g, ok: ibanOk },
    // a number after its label: "Account number: 000123456789", "routing # 021000021", "acct 12-345678"
    { kind: 'account', re: /\b(?:account|acct|a\/c|routing|sort code|bsb)\b(?:\s*(?:number|no\.?|num|#))?\s*[:#]?\s*(\d[\d -]{4,22}\d)(?![\w-])/gi, group: 1, ok: v => digits(v).length >= 6 },
    { kind: 'card', re: /(?<![\w-])\d{4}(?:[ -]\d{4}){2}[ -]\d{1,7}(?![\w-])/g, ok: v => { const d = digits(v); return d.length >= 13 && d.length <= 19 && luhn(d); } },
    { kind: 'card', re: /\b(?:card|visa|mastercard|master card|amex|american express|discover|credit|debit|cc)\b[^\d\n]{0,24}(?<!\d)(\d{13,19})(?!\d)/gi, group: 1, ok: v => luhn(v) },
    { kind: 'id', re: /(?<![\w-])\d{3}-\d{2}-\d{4}(?![\w-])/g },
    { kind: 'phone', re: /(?<![\w+])(?:\+\d{1,3}[ .-]?(?:\(\d{1,4}\)[ .-]?)?\d{1,4}(?:[ .-]?\d{2,4}){2,4}|\(\d{3}\) ?\d{3}[ .-]\d{4}|\d{3}[.-]\d{3}[.-]\d{4}|\d{3} \d{3} \d{4})(?![\w-])/g, ok: v => { const n = digits(v).length; return n >= 7 && n <= 15; } },
  ];
  const TOKEN = /\[(email|phone|card|account|id)-(\d+)(?: ending \d{4})?\]/g;

  function make(saved) {
    const byVal = new Map(), byTok = new Map(), count = {};
    if (saved && typeof saved === 'object') {
      for (const [tok, val] of Object.entries(saved)) {
        const m = /^\[(email|phone|card|account|id)-(\d+)/.exec(tok);
        if (!m || typeof val !== 'string') continue;
        byTok.set(tok, val); byVal.set(m[1] + ':' + val, tok);
        count[m[1]] = Math.max(count[m[1]] || 0, +m[2]);
      }
    }
    const tokenFor = (kind, val) => {
      const key = kind + ':' + val;
      if (byVal.has(key)) return byVal.get(key);
      const n = (count[kind] || 0) + 1; count[kind] = n;
      const tok = '[' + kind + '-' + n + (kind === 'card' ? ' ending ' + digits(val).slice(-4) : '') + ']';
      byVal.set(key, tok); byTok.set(tok, val);
      return tok;
    };
    function hide(text) {
      if (typeof text !== 'string' || !text) return text;
      let out = text;
      for (const r of RULES) {
        out = out.replace(r.re, (...m) => {
          const whole = m[0], val = r.group ? m[r.group] : whole;
          if (!val || (r.ok && !r.ok(val))) return whole;
          return r.group ? whole.replace(val, tokenFor(r.kind, val)) : tokenFor(r.kind, val);
        });
      }
      return out;
    }
    // The real ones back, in a string or anything made of strings (a tool's input, the facts read from an email).
    function show(x) {
      if (typeof x === 'string') return x.replace(TOKEN, t => byTok.has(t) ? byTok.get(t) : t);
      if (Array.isArray(x)) return x.map(show);
      if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, show(v)]));
      return x;
    }
    return { hide, show, saved: () => Object.fromEntries(byTok), get size() { return byTok.size; } };
  }

  const api = { make };
  if (typeof window !== 'undefined') { const A = window.AllisonOS = window.AllisonOS || {}; A.redact = api; }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
