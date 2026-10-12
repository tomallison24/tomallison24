"use strict";
// Orders: turns order, shipping, delivery and pickup emails into orders.
//
// Two ways in, best first:
// 1. Structured data. Some stores put a hidden schema.org block in their
//    emails (Order, ParcelDelivery): the same data Gmail uses for its package
//    cards. As JSON-LD it is read straight from the HTML; as microdata it is
//    read from the parsed page (browser only).
// 2. Reading the words: the order number, total, items, carrier and tracking
//    number, the estimated delivery date and where the order is (ordered,
//    shipped, out for delivery, ready for pickup, delivered). This is a best
//    guess, so an order found only this way is marked guess: true when
//    something important is missing, and the app asks for a quick check.
//
// One email gives one "fact": what that email says about one order. upsert()
// folds facts into the list of orders, so an order confirmation, its shipping
// email, the carrier's own notice and the delivery email end up as one order,
// whatever order they are read in.
//
// No network, no DOM needed for the core, so the same file runs in the app
// and under Node for the tests (orders/scripts/parse-test.mjs).
(function (root) {
  // ---------------------------------------------------------------------
  // Reference tables
  // ---------------------------------------------------------------------
  // Sender domain -> the store's name, for the stores people buy from most.
  const STORES = [
    [/(^|\.)wholefoodsmarket\.com$/, 'Whole Foods Market'], [/(^|\.)amazon\.[a-z.]+$/, 'Amazon'], [/(^|\.)ebay\.com$/, 'eBay'], [/(^|\.)walmart\.com$/, 'Walmart'],
    [/(^|\.)target\.com$/, 'Target'], [/(^|\.)homedepot\.com$/, 'Home Depot'], [/(^|\.)lowes\.com$/, 'Lowe’s'],
    [/(^|\.)bestbuy\.com$/, 'Best Buy'], [/(^|\.)costco\.com$/, 'Costco'], [/(^|\.)etsy\.com$/, 'Etsy'],
    [/(^|\.)wayfair\.com$/, 'Wayfair'], [/(^|\.)chewy\.com$/, 'Chewy'], [/(^|\.)nike\.com$/, 'Nike'],
    [/(^|\.)dcsg\.com$|dickssportinggoods\.com$/, 'DICK’S Sporting Goods'], [/(^|\.)harristeeter\.com$/, 'Harris Teeter'],
    [/(^|\.)kohls\.com$/, 'Kohl’s'], [/(^|\.)macys\.com$/, 'Macy’s'], [/(^|\.)ikea\.com$/, 'IKEA'],
    [/(^|\.)apple\.com$/, 'Apple'], [/(^|\.)walgreens\.com$/, 'Walgreens'], [/(^|\.)cvs\.com$/, 'CVS'],
    [/(^|\.)newegg\.com$/, 'Newegg'], [/(^|\.)bhphotovideo\.com$/, 'B&H'], [/(^|\.)samsclub\.com$/, 'Sam’s Club'],
    [/(^|\.)instacart\.com$/, 'Instacart'], [/(^|\.)temu\.com$/, 'Temu'], [/(^|\.)shein\.com$/, 'SHEIN'],
    [/(^|\.)aliexpress\.com$/, 'AliExpress'], [/(^|\.)gap\.com$/, 'Gap'], [/(^|\.)oldnavy\.com$/, 'Old Navy'],
    [/(^|\.)sephora\.com$/, 'Sephora'], [/(^|\.)ulta\.com$/, 'Ulta'], [/(^|\.)petco\.com$/, 'Petco'],
    [/(^|\.)petsmart\.com$/, 'PetSmart'], [/(^|\.)staples\.com$/, 'Staples'], [/(^|\.)officedepot\.com$/, 'Office Depot'],
    [/(^|\.)autozone\.com$/, 'AutoZone'], [/(^|\.)advanceautoparts\.com$/, 'Advance Auto Parts'],
    [/(^|\.)googlestore\.com$|store\.google\.com$/, 'Google Store'], [/(^|\.)shopify\.com$/, ''],
  ];
  // Senders that are carriers, not stores: the store comes from the email.
  const CARRIER_DOMAINS = [
    [/(^|\.)ups\.com$/, 'UPS'], [/(^|\.)usps\.com$|uspsinformeddelivery\.com$/, 'USPS'], [/(^|\.)fedex\.com$/, 'FedEx'],
    [/(^|\.)dhl\.com$/, 'DHL'], [/(^|\.)ontrac\.com$/, 'OnTrac'], [/(^|\.)lasership\.com$/, 'LaserShip'],
  ];
  // Senders that sell food or send receipts for subscriptions, not packages.
  const FOOD = /(^|\.)(doordash|ubereats|grubhub|postmates|seamless|caviar|toasttab|chipotle|culvers|fiveguys|chick-fil-a|dominos|papajohns|pizzahut|starbucks|mcdonalds|panera|wendys|subway|tacobell|kfc|olo|ordertogo|slicelife|waitr|gopuff)\./;
  const DIGITAL = /(^|\.)(apple|microsoft|netflix|spotify|hulu|disneyplus|stripe|paypal|anthropic|openai|github|patreon|substack|dropbox|adobe|zoom|slack|audible|steampowered|playstation|xbox|nintendo|icloud|fitbod|peacocktv|max|youtube)\.com$|@email\.apple\.com|invoice\+statements/;
  const FOODISH = /\b(?:coffee|caf[eé]|pizza|pizzeria|burgers?|tacos?|grill|kitchen|bakery|bagels?|deli|bbq|barbecue|sushi|restaurant|diner|bistro|eatery|taproom|tavern|brewery|chicken|wings|noodles?|ramen|thai|tandoor|cantina|pho|poke|donuts?|doughnuts?|ice cream|smoothie|juice|steakhouse|sandwich(?:es)?|subs)\b/i;
  const GENERIC_NAMES = /^(no[-_ ]?reply|noreply|do[-_ ]?not[-_ ]?reply|orders?|support|help|info|customer ?service|notifications?|shipping|service|mail|email|team|store|sales|hello|contact|admin|billing|receipts?|updates?|alerts?)$/i;
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const RANK = { cancelled: 0, ordered: 1, shipped: 2, pickup: 3, out: 3, delivered: 4, pickedup: 4 };
  const STATUS_NAMES = { ordered: 'Ordered', shipped: 'Shipped', out: 'Out for delivery', pickup: 'Ready for pickup', delivered: 'Delivered', pickedup: 'Picked up', cancelled: 'Canceled' };
  const KINDS = ['package', 'pickup', 'food', 'digital', 'other'];

  // ---------------------------------------------------------------------
  // Text helpers
  // ---------------------------------------------------------------------
  const pad = n => String(n).padStart(2, '0');
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rarr: '→',
    middot: '·', bull: '•', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', eacute: 'é', copy: '©', reg: '®', trade: '™' };
  const decodeEntities = s => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch { return m; } }
    return ENT[e.toLowerCase()] ?? m;
  });

  // HTML to plain text with the line breaks a reader would see: block ends
  // and <br> become new lines, table cells become spaced columns.
  function htmlToText(html) {
    return decodeEntities(String(html || '').replace(/\r\n?/g, '\n')
      .replace(/<(script|style|head|title)[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|table|section|article|header|footer|blockquote)\s*>/gi, '\n')
      .replace(/<\/t[dh]\s*>/gi, '  ')
      .replace(/<[^>]+>/g, ' '))
      .replace(/[   ]/g, ' ')
      .replace(/[​-‍﻿͏­]/g, '')
      .replace(/[ \t\f\v\r]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Every JSON-LD block in the HTML, parsed. Broken blocks are skipped.
  function jsonLdBlocks(html) {
    const out = [];
    const re = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
    let m;
    while ((m = re.exec(String(html || '')))) {
      const raw = m[1].trim().replace(/^<!--|-->$/g, '');
      try { out.push(JSON.parse(raw)); } catch { try { out.push(JSON.parse(decodeEntities(raw))); } catch {} }
    }
    return out;
  }

  // Microdata (itemscope/itemprop) turned into the same shape as JSON-LD.
  // Needs a parsed document, so only runs in the browser.
  function microdata(doc) {
    if (!doc || !doc.querySelectorAll) return [];
    const read = scope => {
      const o = { '@type': String(scope.getAttribute('itemtype') || '').split('/').pop() };
      const walk = el => {
        for (const c of el.children) {
          const prop = c.getAttribute('itemprop');
          if (prop) {
            const v = c.hasAttribute('itemscope') ? read(c)
              : c.getAttribute('content') ?? c.getAttribute('datetime') ?? c.getAttribute('href') ?? c.getAttribute('src') ?? c.textContent.trim();
            for (const p of prop.split(/\s+/)) o[p] = o[p] === undefined ? v : [].concat(o[p], v);
          }
          if (!c.hasAttribute('itemscope')) walk(c);
        }
      };
      walk(scope);
      return o;
    };
    return [...doc.querySelectorAll('[itemscope][itemtype]')].filter(el => !el.hasAttribute('itemprop')).map(read);
  }

  // ---------------------------------------------------------------------
  // Dates
  // ---------------------------------------------------------------------
  const ymd = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);
  const validDay = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100 && new Date(y, m - 1, d).getDate() === d;
  const localYmd = ms => { const d = new Date(ms); return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
  const addDays = (date, n) => { const d = new Date(date + 'T12:00'); d.setDate(d.getDate() + n); return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
  // A date with no year: the one on or after the email (a little before is allowed).
  function guessYear(m, d, ref) {
    const r = ref ? new Date(ref) : new Date();
    let y = r.getFullYear();
    if (new Date(y, m - 1, d) < new Date(r.getTime() - 45 * 864e5)) y++;
    return y;
  }
  const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
  const DATE_RES = [
    [/\b(20\d\d)-(\d\d)-(\d\d)\b/g, m => [+m[1], +m[2], +m[3]]],
    // Oct 1, 2026 / October 1st 2026 / Thu, Oct 1
    [new RegExp('\\b' + MON + '\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d\\d))?\\b', 'gi'), m => [m[3] ? +m[3] : null, MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2]]],
    // 1 Oct 2026 / 1st October
    [new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+' + MON + '(?:,?\\s+(20\\d\\d))?\\b', 'gi'), m => [m[3] ? +m[3] : null, MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, +m[1]]],
    // 10/01/2026 or 10/01/26 (US order unless the first number can't be a month)
    [/\b(\d{1,2})\/(\d{1,2})\/(20\d\d|\d\d)\b/g, m => { let a = +m[1], b = +m[2]; const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; if (a > 12 && b <= 12) [a, b] = [b, a]; return [y, a, b]; }],
  ];
  // Every date in the text, in order, as {i, end, date:'YYYY-MM-DD'}.
  function findDates(text, ref) {
    const out = [];
    for (const [re, fn] of DATE_RES) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        let [y, mo, d] = fn(m);
        if (!mo) continue;
        if (y == null) y = guessYear(mo, d, ref);
        if (!validDay(y, mo, d)) continue;
        if (out.some(o => m.index < o.end && m.index + m[0].length > o.i)) continue;
        out.push({ i: m.index, end: m.index + m[0].length, date: ymd(y, mo, d) });
      }
    }
    return out.sort((a, b) => a.i - b.i);
  }
  // The next date on or after `ref` that falls on this weekday ("Saturday").
  function nextWeekday(name, ref) {
    const w = WEEKDAYS.indexOf(String(name).slice(0, 3).toLowerCase());
    if (w < 0) return '';
    const d = new Date(ref); d.setHours(12, 0, 0, 0);
    while (d.getDay() !== w) d.setDate(d.getDate() + 1);
    return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  // The first date in a short stretch of words: a written date, "today", "tomorrow", or a weekday.
  function dateIn(s, ref) {
    s = String(s || '');
    const d = findDates(s, ref)[0];
    const day = /\b(today|tonight|tomorrow|(?:mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?)\b/i.exec(s);
    if (d && (!day || d.i <= day.index + 12)) return d.date;
    if (!day) return '';
    const w = day[1].toLowerCase();
    if (w === 'today' || w === 'tonight') return localYmd(ref);
    if (w === 'tomorrow') return addDays(localYmd(ref), 1);
    return nextWeekday(w, ref);
  }

  // ---------------------------------------------------------------------
  // Identity: the same order seen twice (two emails, or two phones) gets
  // the same id, so it is never listed twice.
  // ---------------------------------------------------------------------
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  const keyOf = s => String(s || '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '');
  const normTrack = s => String(s || '').toUpperCase().replace(/[\s-]+/g, '');
  const normNo = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  function idFor(f) {
    if (f.orderNo) return 'o-' + hash(keyOf(f.store) + '|' + normNo(f.orderNo));
    if (f.tracking) return 't-' + hash(normTrack(f.tracking));
    return 'm-' + hash((f.source && (f.source.threadId || f.source.msgId)) || (keyOf(f.store) + '|' + (f.total || '') + '|' + (f.steps && Object.values(f.steps)[0])));
  }

  // ---------------------------------------------------------------------
  // The sender, and the store
  // ---------------------------------------------------------------------
  const PERSONAL = /(^|\.)(gmail|googlemail|yahoo|icloud|me|mac|outlook|hotmail|live|aol|msn|proton|protonmail|duck)\.com$|(^|\.)(me|mac)\.com$/;
  // "Name <a@b.com>", "a@b.com", and DuckDuckGo's relays ("info_at_store.com_you@duck.com").
  function senderInfo(from) {
    const s = String(from || '');
    const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(s);
    let name = m ? m[1].trim() : '', email = (m ? m[2] : s).trim().toLowerCase();
    const relay = /^(.+?)_at_([a-z0-9.-]+\.[a-z]+)_[^_@]+@duck\.com$/.exec(email);
    if (relay) email = relay[1].replace(/_/g, '.') + '@' + relay[2];
    const domain = email.includes('@') ? email.split('@').pop() : '';
    return { name, email, domain, relayed: !!relay };
  }
  // The sender of a forwarded email, from the forwarded header in its body.
  function forwardedFrom(text) {
    const m = /(?:forwarded message|original message)[\s\S]{0,300}?\bFrom:\s*([^\n]+)/i.exec(String(text || '').slice(0, 3000));
    return m ? m[1].trim() : '';
  }
  const titleCase = s => s.toLowerCase().replace(/(^|[\s&-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
  function cleanName(n) {
    n = String(n || '').replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
    n = n.replace(/\s*[|·•–—-]\s*(?:orders?|order (?:updates?|confirmation)|customer (?:service|care)|support|notifications?|shipping|receipts?|team|online)\s*$/i, '')
      .replace(/\s+(?:orders?|order (?:updates?|confirmation|status)|customer (?:service|care)|support|notifications?|shipping|receipts?|team|no[- ]?reply|noreply|info)$/i, '').trim();
    if (!n || GENERIC_NAMES.test(n) || /@/.test(n) || n.length > 40) return '';
    if (n === n.toUpperCase() && /[A-Z]{4,}/.test(n)) n = titleCase(n);
    return n;
  }
  // From the sender's domain: "orders.culvers.com" -> "Culvers".
  function nameFromDomain(domain) {
    const parts = String(domain || '').split('.').filter(Boolean);
    if (parts.length < 2) return '';
    const sld = /^(co|com|org|net|ac|gov)$/.test(parts[parts.length - 2]) && parts.length > 2 ? parts[parts.length - 3] : parts[parts.length - 2];
    if (!sld || sld.length < 3) return '';
    return sld[0].toUpperCase() + sld.slice(1);
  }
  // A store named in the words: "Your Force of Nature order has shipped", "Your recent order on X".
  function nameFromWords(subject, text) {
    const pats = [
      [subject, /^your\s+(?:recent\s+)?([A-Z][\w&’'.-]*(?:\s+[A-Za-z&’'.-]+){0,3}?)\s+order\b/],
      [text, /\border\s+(?:from|with|at|on)\s+([A-Z][\w&’'.-]*(?:\s+(?:[A-Z][\w&’'.-]*|of|the|and|&)){0,3})(?=\s+(?:has|is|was|will|ha)|[.,!:\n])/],
      [subject, /\border\s+(?:from|with|at)\s+([A-Z][\w&’'.-]*(?:\s+(?:[A-Z][\w&’'.-]*|of|the|and|&)){0,3})\s*$/],
    ];
    for (const [src, re] of pats) {
      const m = re.exec(String(src || '').replace(/^(?:fwd?|re):\s*/i, ''));
      if (m) { const n = cleanName(m[1]); if (n && !/^(?:recent|online|new|latest|amazon order|apple)$/i.test(n)) return n; }
    }
    return '';
  }
  function shipperName(text) {
    let m = /(?:^|\n)\s*(?:From|Shipper|Shipped by|Sold by|Sender)\s*:\s*([^\n]{2,50})/i.exec(text);
    if (!m) m = /\n\s*([A-Z0-9][A-Za-z0-9 &.’'-]{2,40})\n+\s*Tracking Number:/.exec(text);
    if (!m) return '';
    const n = cleanName(m[1].replace(/\s{2,}.*/, ''));
    return n && !/^(ups|usps|fedex|dhl|ontrac|lasership|tom allison)$/i.test(n) && !/\d{3,}/.test(n) ? n : '';
  }
  function storeOf(sender, subject, text, isCarrier) {
    if (isCarrier) return shipperName(text);
    for (const [re, name] of STORES) if (name && re.test(sender.domain)) return name;
    return cleanName(sender.name) || nameFromWords(subject, text) || nameFromDomain(sender.domain);
  }
  const carrierOfDomain = d => { for (const [re, c] of CARRIER_DOMAINS) if (re.test(d)) return c; return ''; };

  // ---------------------------------------------------------------------
  // Money, order numbers
  // ---------------------------------------------------------------------
  const MONEY = '(CA\\$|C\\$|US\\$|\\$|€|£)\\s?(\\d{1,3}(?:,\\d{3})+(?:\\.\\d\\d)?|\\d+(?:\\.\\d\\d)?)';
  const curOf = s => /CA\$|C\$/.test(s) ? 'CAD' : s === '€' ? 'EUR' : s === '£' ? 'GBP' : 'USD';
  const num = s => parseFloat(String(s).replace(/,/g, ''));
  function findTotal(text) {
    const labels = ['order total', 'grand total', 'payment authorization', 'total charged(?: to)?', 'amount charged', 'amount paid', 'total paid', 'total due', 'amount due', 'total amount', 'payment total', 'total'];
    for (const l of labels) {
      const re = new RegExp('(?:^|[^a-z])' + l + '\\s*(?:\\([^)]{0,30}\\))?\\s*[:|]?\\s*(?:USD\\s*)?' + MONEY, 'i');
      const m = re.exec(text);
      if (m) return { total: num(m[2]), cur: curOf(m[1]) };
    }
    // "Grand Total:\n64.23 USD": the currency after the number, no symbol
    for (const l of labels) {
      const m = new RegExp('(?:^|[^a-z])' + l + '\\s*:?\\s*(\\d{1,3}(?:,\\d{3})*\\.\\d\\d|\\d+\\.\\d\\d)\\s*(USD|CAD|EUR|GBP)\\b', 'i').exec(text);
      if (m) return { total: num(m[1]), cur: m[2].toUpperCase() };
    }
    const sub = new RegExp('subtotal\\s*[:|]?\\s*' + MONEY, 'i').exec(text), tax = new RegExp('(?:^|[^a-z])tax\\s*[:|]?\\s*' + MONEY, 'i').exec(text);
    if (sub && tax) return { total: Math.round((num(sub[2]) + num(tax[2])) * 100) / 100, cur: curOf(sub[1]) };
    return null;
  }
  const NO_RES = [
    /\border\s*(?:number|no\.?|num\.?|#|id|ref(?:erence)?)\s*[:#-]?\s*#?\s*([A-Z0-9][A-Z0-9-]{3,28})(?![A-Za-z0-9-])/gi,
    /\b(\d{3}-\d{7}-\d{7})\b/g,
    /#\s?([A-Z]{1,4}-?\d{5,12})\b/g,
    /\border\s+([A-Z]{0,3}\d{6,}[A-Z0-9-]*)\b/gi,
    /\bconfirmation\s*(?:number|no\.?|#)\s*:?\s*([A-Z0-9][A-Z0-9-]{4,24})\b/gi,
    /\b(?:receipt|invoice)\s*(?:number|no\.?|#)\s*:?\s*([A-Z0-9][A-Z0-9-]{3,28})(?![A-Za-z0-9-])/gi,
  ];
  function findOrderNo(text) {
    for (const re of NO_RES) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        const c = m[1];
        if (/\d/.test(c) && c.length >= 4 && !/^(?:20\d\d|\d{1,2})$/.test(c) && !/^\d{3}-\d{3}-\d{4}$/.test(c)) return c;
      }
    }
    return '';
  }

  // ---------------------------------------------------------------------
  // Carriers and tracking
  // ---------------------------------------------------------------------
  const CARRIER_RE = /\b(UPS|USPS|FedEx|Fedex|FEDEX|DHL|OnTrac|LaserShip|Veho|U\.?S\.? Postal Service|United States Postal Service|Amazon Logistics|Amazon Shipping)\b/;
  const carrierName = s => {
    s = String(s || '').toLowerCase();
    return /^ups\b/.test(s) ? 'UPS' : /usps|postal/.test(s) ? 'USPS' : /fedex/.test(s) ? 'FedEx' : /^dhl/.test(s) ? 'DHL' : /ontrac/.test(s) ? 'OnTrac'
      : /lasership/.test(s) ? 'LaserShip' : /veho/.test(s) ? 'Veho' : /amazon/.test(s) ? 'Amazon Logistics' : '';
  };
  // Tracking number formats that identify their carrier by themselves.
  const STRONG = [
    ['UPS', /\b(1Z[0-9A-Z]{16})\b/],
    ['USPS', /\b(9[2-5]\d{2}(?: ?\d{4}){4}(?: ?\d{2})?)\b/],
    ['USPS', /\b([A-Z]{2}\d{9}US)\b/],
    ['Amazon Logistics', /\b(TBA\d{10,13})\b/],
    ['DHL', /\b(JD\d{18})\b/],
    ['LaserShip', /\b(1LS\d{12,14})\b/],
  ];
  function trackingIn(text, carrierHint) {
    for (const [c, re] of STRONG) {
      const m = re.exec(text);
      if (m) return { tracking: m[1].replace(/\s+/g, ''), carrier: c };
    }
    // A number under a "Tracking number" label: any carrier, so the store's own too.
    const lab = /tracking\s*(?:number|no\.?|#|id|code)\s*:?\s*/gi;
    let m;
    while ((m = lab.exec(text))) {
      const t = /\b([A-Z0-9][A-Z0-9-]{7,29})\b/g, win = text.slice(lab.lastIndex, lab.lastIndex + 100);
      let c;
      while ((c = t.exec(win))) {
        const d = (c[1].match(/\d/g) || []).length;
        if (d >= 6 && !/^\d{3}-\d{3}-\d{4}$/.test(c[1]) && !/^20\d\d-/.test(c[1])) {
          const before = /(UPS|USPS|FedEx|Fedex|FEDEX|DHL|OnTrac|LaserShip|Veho)\s+$/.exec(text.slice(Math.max(0, m.index - 14), m.index));
          return { tracking: c[1], carrier: carrierName(before ? before[1] : '') || carrierHint || '' };
        }
      }
    }
    // 12 and 15 digits are FedEx's only when FedEx is in the email.
    if (carrierHint === 'FedEx') { const f = /(?:track\w*|fedex)[^\n]{0,50}?\b(96\d{20}|\d{15}|\d{12})\b/i.exec(text); if (f) return { tracking: f[1], carrier: 'FedEx' }; }
    return null;
  }
  // Where a number is found in a link (carriers' own emails and many stores').
  function trackingInLinks(html) {
    const m = /[?&](?:tracknum|trackingnumber|tracking_number|trknbr|tracknumbers|tlabels1|qtc_tlabels1|tracking-id|trackingnumbers)=([A-Za-z0-9]{8,35})/i.exec(String(html || '').replace(/&amp;/g, '&'));
    return m ? m[1] : '';
  }
  function carrierIn(text, trackingCarrier) {
    const lab = /(?:carrier|provider|shipped\s+(?:via|with)|shipping\s+(?:method|carrier|service)|delivery\s+carrier|courier|delivered\s+by|fulfilled\s+by|sent\s+(?:via|with))\s*:?\s*(?:\n|\s)*(UPS|USPS|FedEx|Fedex|FEDEX|DHL|OnTrac|LaserShip|Veho|Amazon(?: Logistics| Shipping)?|U\.?S\.? Postal Service|United States Postal Service)\b/i.exec(text);
    if (lab) return carrierName(lab[1]);
    if (trackingCarrier) return trackingCarrier;
    const m = CARRIER_RE.exec(text.slice(0, 4000));
    return m ? carrierName(m[1]) : '';
  }
  function trackUrl(carrier, n) {
    n = encodeURIComponent(String(n || '').replace(/\s+/g, ''));
    if (!n) return '';
    switch (carrier) {
      case 'UPS': return 'https://www.ups.com/track?tracknum=' + n;
      case 'USPS': return 'https://tools.usps.com/go/TrackConfirmAction_input?qtc_tLabels1=' + n;
      case 'FedEx': return 'https://www.fedex.com/fedextrack/?trknbr=' + n;
      case 'DHL': return 'https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=' + n;
      case 'OnTrac': return 'https://www.ontrac.com/tracking?number=' + n;
      default: return '';
    }
  }

  // ---------------------------------------------------------------------
  // Where is the order? From the subject first, then the top of the email.
  // ---------------------------------------------------------------------
  const R = {
    cancelled: /\b(?:cancel(?:l?ed|lation)|has been cancel)/i,
    // "delivered", but not "out for delivery" or "will be delivered"
    delivered: /\b(?:was delivered|has been delivered|been delivered|we(?:'|’)ve delivered|delivered[!.:]?|delivery notification|package (?:was )?delivered|left at)\b/i,
    notDelivered: /out for delivery|will be delivered|to be delivered|not delivered|delivery (?:attempt|exception|rescheduled)|when (?:it(?:'|’)s|your .{0,20} is) delivered|once (?:it(?:'|’)s|your .{0,20} is) delivered|if (?:it(?:'|’)s|your .{0,20} is) delivered/i,
    out: /out for delivery|arriving today|delivery today|delivered today|(?:\d|one|two|three) stops? away|on (?:its|the) way to you today|scheduled for delivery today/i,
    pickup: /ready (?:for|to) (?:be )?(?:pick ?-?up|collect)|ready for curbside|available (?:now )?(?:for|through|until) (?:pick ?-?up|\w+,? \w+)|pick it up (?:by|before|until)|your order(?:'|’)?s? ready|order is ready|ready at the store/i,
    // "we'll tell you when your order is ready for pickup" is a promise, not the news
    notPickup: /(?:when|once|until|if|after|as soon as)\s+(?:your|the)\s+(?:order|items?)\s+(?:is|are)\s+ready/i,
    pickedUp: /thanks? for picking up|you picked up|order (?:was |has been )?picked up by you/i,
    shipped: /\b(?:has shipped|have shipped|shipped[!.:]?|on (?:its|the) way|on the way|in transit|ship notification|shipping confirmation|shipping update|shipment|dispatched|is on its way|label created|packed and picked up|your package|tracking (?:number|information|details))\b/i,
    ordered: /\b(?:order (?:confirm\w*|received|placed|submitted|details|summary)|order(?:ing)? receipt|thanks? (?:you )?for (?:your )?(?:\w+ )?(?:order|shopping|purchase)|thank you for (?:your )?(?:\w+ )?(?:order|purchase|shopping)|we(?:'|’)?(?:ve)? received your order|your order(?:'|’)?s? (?:confirmed|received|is confirmed|has been (?:received|placed))|order (?:has been |was )?(?:received|placed|confirmed)|(?:is|are) confirmed|^ordered \d+ items?|getting your order|getting it ready|here(?:'|’)s your order|your (?:receipt|purchase|invoice)|receipt from|order with)\b/i,
    issue: /\b(?:unavailable|out of stock|backorder\w*|delayed?|can(?:'|’)?t (?:fulfill|ship)|problem with your order|issue with your order|order updates?|action required|payment (?:failed|declined)|couldn(?:'|’)?t be)\b/i,
    partial: /part of your order|some of your (?:items|order|packages?)|one of your (?:items|packages)|a package from your order|\b\d of \d (?:items|packages)\b|partial(?:ly)?/i,
    promo: /\d+\s?% off|\bsale\b|\bdeals?\b|coupon|free shipping (?:on|when)|rewards?\b|how was your|rate your|feedback|survey|review (?:your|this)|we(?:'|’)d love|newsletter|just for you|save \$|\bearn\b|re-?activate|you(?:'|’)re invited|restock|back in stock|price drop|your cart|left in your cart|wish ?list|recommend/i,
  };
  function statusOf(subject, head) {
    const t = String(subject || '');
    const test = s => {
      if (R.cancelled.test(s)) return 'cancelled';
      if (R.pickedUp.test(s)) return 'pickedup';
      if (R.out.test(s)) return 'out';
      if (R.delivered.test(s) && !R.notDelivered.test(s)) return 'delivered';
      if (R.pickup.test(s) && !R.notPickup.test(s)) return 'pickup';
      if (R.shipped.test(s)) return 'shipped';
      if (R.ordered.test(s)) return 'ordered';
      return '';
    };
    // A progress bar listing every stage (Ordered Shipped Out for delivery Delivered) says nothing about which.
    const h = String(head || '').replace(/ordered\s+shipped\s+out for delivery\s+delivered/gi, ' ').slice(0, 500);
    return test(t) || test(h) || '';
  }

  // ---------------------------------------------------------------------
  // Items
  // ---------------------------------------------------------------------
  const LABELISH = /^(?:est(?:imated)?|available|ready|all|by|item|items|qty|quantity|price|total|subtotal|order|tracking|ship|shipping|delivery|deliver|estimated|status|view|track|manage|your|you|thanks|thank|hi|hello|hey|dear|product|description|details|summary|payment|billing|sku|model|seller|sold|unit|click|see|get|download|need|questions|contact|copyright|©|special|basic|arriving|arrives|pickup|pick|store|internet|tax|discount|savings?|visit|learn|shop|sign|log|help|return|we|we’ll|we'll|will|is|are|please|note|check|review|paid|free|just|text|call|email|share|follow|app|add|if|this|that)\b/i;
  const junkName = s => !s || s.length < 4 || s.length > 160 || !/[A-Za-z]{3}/.test(s) || /^[$€£\d#(@[]/.test(s) || /^\W*(?:item\.\w+|product\s*name|\{\{.*\}\})\W*$/i.test(s) || /^https?:/i.test(s) || /@|\bhttps?:|\.com\b/i.test(s) && s.length < 40;
  const looksLikeName = s => !junkName(s) && !LABELISH.test(s) && (s.split(/\s+/).length >= 3 || (s.split(/\s+/).length === 2 && /[a-z]/.test(s))) && !(/[.!?]$/.test(s) && s.length > 60);
  function cleanItem(s) {
    return String(s || '').replace(/[*_#>]+/g, ' ').replace(/\[|\]/g, '').replace(/\s*\|\s*/g, ' | ').replace(/\s+/g, ' ').replace(/\s*[-–—|]+\s*$/, '').trim().slice(0, 200);
  }
  const ANCHOR = /^(?:qty|quantity)\b|^x\s?\d+$|^\d+\s?[x×]$|^price:|^item id:|^sku\b|^store sku|^model\s?#|^item\s?#|^unit price|^\$[\d.,]+\s?\/\s?ea/i;
  const QTY = /^(?:qty|quantity)\s*:?\s*(\d+)|^x\s?(\d+)$|^(\d+)\s?[x×]$/i;
  const PRICEISH = /^\$|^[\d\s$.,/-]+$|from savings|^(?:each|ea|free)$/i;
  function itemsFromText(text) {
    const lines = text.split('\n').map(l => l.replace(/\s{2,}/g, '  ').trim()).filter(Boolean);
    const out = [], seen = new Set();
    const add = (name, qty, price) => {
      name = cleanItem(name);
      const k = name.toLowerCase();
      if (junkName(name) || seen.has(k) || out.length >= 8) return;
      seen.add(k); out.push({ name, ...(qty > 1 ? { qty } : {}), ...(price ? { price } : {}) });
    };
    // "Qty: 12", "x2", or a row of cells: "<unit price>  12.00  <item total>"
    const qtyAt = i => {
      const m = QTY.exec(lines[i] || '') || QTY.exec(lines[i + 1] || '');
      if (m) return +(m[1] || m[2] || m[3]);
      const row = /\$[\d,.]+\s+(\d{1,3})(?:\.0+)?\s+\$[\d,.]+/.exec(lines[i] || '');
      return row ? +row[1] : 1;
    };
    // WooCommerce-style order tables: "Product Quantity Price <name> 1 $28.75"
    const woo = /Product\s+Quantity\s+Price\s+([\s\S]+?)\s+(\d{1,3})\s+\$\s?([\d,]+\.\d\d)/.exec(text);
    if (woo) add(woo[1].split(/\n|\*[A-Za-z ]+:\*/)[0], +woo[2], num(woo[3]));
    if (out.length) return out;
    // The line above "Qty:", "Price:", "SKU #", "Model #:" and friends is the item
    for (let i = 1; i < lines.length; i++) {
      if (!ANCHOR.test(lines[i].split('  ')[0])) continue;
      for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
        const l = lines[j].split('  ')[0];
        if (ANCHOR.test(l) || PRICEISH.test(l)) continue;
        if (looksLikeName(l)) {
          // a short brand line over the name ("Home Decorators Collection" / "Wayne Canyon Oak ...")
          const above = j > 0 ? lines[j - 1].split('  ')[0] : '';
          add(above && above.length <= 40 && !/[\d?!:.]/.test(above) && above.split(/\s+/).every(w => /^[A-Z&]/.test(w)) && looksLikeName(above) && !ANCHOR.test(above) && !l.startsWith(above) ? above + ' ' + l : l, qtyAt(i));
        }
        break;
      }
    }
    if (out.length) return out;
    // After an "Items" style heading: names that have a price or quantity just below them
    for (let i = 0; i < lines.length && !out.length; i++) {
      if (!/^(?:items?(?: ordered| in (?:this|your) (?:order|shipment|package))?|your (?:items?|order)|order (?:details|summary)|what(?:'|’)s coming\??|product details|package contents|items? shipped)\s*:?$/i.test(lines[i])) continue;
      for (let j = i + 1; j < Math.min(lines.length, i + 14); j++) {
        const l = lines[j].split('  ')[0];
        if (/^(?:sub ?total|total|shipping|delivery|tax|payment|order summary|billing|what you should know|additional items|questions|need help|follow us)\b/i.test(l)) break;
        if (!looksLikeName(l) || /\b(?:we(?:'|’)ll|your order|please|thank|let you know|will be|ship to|deliver to|sold by|address)\b/i.test(l)) continue;
        const near = lines.slice(j + 1, j + 4).join(' ');
        if (/\$\s?\d|\bqty\b|\bquantity\b|\bx\s?\d\b/i.test(near)) add(l, qtyAt(j + 1));
      }
    }
    return out;
  }
  // "Ordered: “Name”", "Shipped: Name", "OUT FOR DELIVERY: Name", "Your order’s confirmed for Name"
  function itemFromSubject(subject) {
    const s = String(subject || '').replace(/^(?:fwd?|re):\s*/i, '');
    let m = /^ordered\s+\d+\s+items?\s*:\s*["“”]?(.+?)["“”]?$/i.exec(s)
      || /^(?:ordered|shipped|delivered|out for delivery|arriving[^:]*|now arriving|order confirmed|your order(?:'|’)?s? (?:confirmed|shipped|delivered))\s*(?:for|:)\s*["“”]?(.+?)["“”]?$/i.exec(s)
      || /^(?:out for delivery|delivered|shipped|ordered|arriving)\s*:\s*(.+)$/i.exec(s);
    if (!m) return '';
    const n = cleanItem(m[1].replace(/[“”"]/g, ''));
    return junkName(n) || /^(?:your|a|an|the)\b.{0,12}$/i.test(n) ? '' : n;
  }

  // ---------------------------------------------------------------------
  // schema.org
  // ---------------------------------------------------------------------
  const typeOf = o => String(o && o['@type'] || '').replace(/^.*[/#]/, '');
  const str = v => v == null ? '' : typeof v === 'object' ? String(v.name || v['@id'] || '') : String(v).trim();
  function flatten(x, out = []) {
    if (Array.isArray(x)) x.forEach(v => flatten(v, out));
    else if (x && typeof x === 'object') { out.push(x); if (x['@graph']) flatten(x['@graph'], out); }
    return out;
  }
  const SCHEMA_STATUS = { orderdelivered: 'delivered', orderintransit: 'shipped', orderprocessing: 'ordered', orderpaymentdue: 'ordered', orderpickupavailable: 'pickup', ordercancelled: 'cancelled', orderproblem: 'ordered', orderreturned: 'cancelled' };
  // What the structured data says: {orderNo, store, items, status, tracking, carrier, trackUrl, eta, etaEnd, orderDate, total, cur}
  function fromSchema(objs) {
    const r = { items: [] };
    for (const o of flatten(objs)) {
      const t = typeOf(o);
      if (t === 'Order') {
        r.orderNo = r.orderNo || str(o.orderNumber);
        r.store = r.store || str(o.seller) || str(o.merchant);
        r.orderDate = r.orderDate || str(o.orderDate).slice(0, 10);
        const st = SCHEMA_STATUS[typeOf({ '@type': str(o.orderStatus) }).toLowerCase()]; if (st) r.status = r.status || st;
        [].concat(o.acceptedOffer || o.orderedItem || []).forEach(x => { const it = x && (x.itemOffered || x); const n = str(it && it.name); if (n) r.items.push({ name: n, ...(+x.eligibleQuantity && +x.eligibleQuantity.value > 1 ? { qty: +x.eligibleQuantity.value } : {}) }); });
        if (o.price != null && !isNaN(num(o.price))) { r.total = num(o.price); r.cur = str(o.priceCurrency) || 'USD'; }
        if (o.url && !r.link) r.link = str(o.url);
      }
      if (t === 'ParcelDelivery') {
        r.tracking = r.tracking || str(o.trackingNumber);
        r.trackUrl = r.trackUrl || (/^https?:\/\//i.test(str(o.trackingUrl)) ? str(o.trackingUrl) : '');   // only a web link, whatever an email says
        r.carrier = r.carrier || carrierName(str(o.carrier || o.provider));
        r.eta = r.eta || str(o.expectedArrivalFrom || o.expectedArrivalUntil).slice(0, 10);
        r.etaEnd = r.etaEnd || str(o.expectedArrivalUntil).slice(0, 10);
        const ord = o.partOfOrder; if (ord && typeof ord === 'object') { r.orderNo = r.orderNo || str(ord.orderNumber); r.store = r.store || str(ord.seller); }
        [].concat(o.itemShipped || []).forEach(x => { const n = str(x && (x.name || x.itemOffered)); if (n) r.items.push({ name: n }); });
      }
    }
    if (r.etaEnd && r.etaEnd === r.eta) delete r.etaEnd;
    return r;
  }

  // ---------------------------------------------------------------------
  // Kind: a package, a pickup, food, a digital receipt, or something else
  // ---------------------------------------------------------------------
  function kindOf({ domain, from, subject, head, status, tracking, storeName = '' }) {
    const all = (subject + ' ' + head).toLowerCase();
    if (FOOD.test(domain + '.') || (!tracking && (/\b(?:restaurant|carry-?out|take-?out|estimated pickup)\b/i.test(head.slice(0, 800)) || FOODISH.test(subject + ' ' + storeName)))) return 'food';
    const shipped = !!tracking || status === 'shipped' || status === 'out' || status === 'delivered';
    if (!shipped && (DIGITAL.test(domain) || DIGITAL.test(String(from).toLowerCase()) || (/your receipt from|subscription|renews|renewal|invoice\b/i.test(subject) && !/ship|deliver|pickup|pick up/i.test(all)))) return 'digital';
    if (/e-?tickets?|your tickets|admission|library|boarding/i.test(all) && !tracking) return 'other';
    if (!tracking && (status === 'pickup' || status === 'pickedup' || /curbside|store pickup|in-store pickup|pick up in store|order pickup|drive up|bring a photo id|ready for pick ?up|pick it up/i.test(all))) return 'pickup';
    return 'package';
  }

  // ---------------------------------------------------------------------
  // One email -> what it says about an order
  // ---------------------------------------------------------------------
  // msg: {html, text, subject, from, date (ms), id, threadId, doc?}
  // Returns {orders: [fact], skip: reason}
  function parseEmail(msg) {
    const subject = String(msg.subject || '').replace(/\s+/g, ' ').trim();
    const html = String(msg.html || '');
    const plain = (msg.text && msg.text.trim()) ? String(msg.text) : '';
    const fromHtml = html ? htmlToText(html) : '';
    // Some stores' plain part is just "view this email in your browser": read the HTML then.
    const text = fromHtml && fromHtml.length > plain.length * 1.2 ? fromHtml : (plain || fromHtml);
    const ref = msg.date || Date.now();
    let sender = senderInfo(msg.from);
    if (PERSONAL.test(sender.domain) && /^(?:fwd?):/i.test(subject)) { const f = forwardedFrom(text); if (f) sender = senderInfo(f); }
    const carrierSender = carrierOfDomain(sender.domain);
    const subj = subject.replace(/^(?:(?:fwd?|re):\s*)+/i, '');
    const ld = [...jsonLdBlocks(html), ...(msg.doc ? microdata(msg.doc) : [])];
    const sc = ld.length ? fromSchema(ld) : { items: [] };
    const hay = subj + '\n' + text;

    let status = statusOf(subj, text) || sc.status || '';
    const orderNo = sc.orderNo || findOrderNo(hay);
    const trk = (sc.tracking ? { tracking: sc.tracking, carrier: sc.carrier } : null) || trackingIn(text, carrierSender || carrierIn(text, '')) || (() => { const l = trackingInLinks(html); return l ? { tracking: l, carrier: '' } : null; })();
    const carrier = (trk && trk.carrier) || carrierSender || carrierIn(text, '') || '';
    const issue = R.issue.test(subj) && (status === 'ordered' || !status) ? (/unavailable|out of stock/i.test(hay.slice(0, 1500)) ? 'An item is unavailable' : /delay/i.test(subj) ? 'Delayed' : 'The store says there’s an update') : '';
    if (!status && issue) status = 'ordered';
    if (!status && trk) status = 'shipped';
    const found = findTotal(text) || (sc.total ? { total: sc.total, cur: sc.cur } : null);
    // Whole Foods orders come from Amazon's address, but they are Whole Foods' (a store, with its own pickup)
    let store = sc.store || storeOf(sender, subj, text, !!carrierSender);
    if (store === 'Amazon' && /whole foods/i.test(subj + '\n' + text.slice(0, 300))) store = 'Whole Foods Market';
    const kind = kindOf({ domain: sender.domain, from: msg.from, subject: subj, head: text.slice(0, 1500), status, tracking: trk && trk.tracking, storeName: store });

    // Is this about a purchase at all? Offers, surveys and the like are not.
    if (!status) return { orders: [], skip: 'not an order email' };
    if (R.promo.test(subj) && !orderNo && !trk && !found) return { orders: [], skip: 'promotion' };
    if (!orderNo && !trk && !(store && found)) return { orders: [], skip: 'no order number, tracking number or total' };

    const items = sc.items.length ? sc.items : itemsFromText(text);
    if (!items.length) { const n = itemFromSubject(subj); if (n) items.push({ name: n }); }
    const day = localYmd(ref);
    const odm = /(?:order(?:ed)?\s*(?:date|placed)|date\s*(?:of order|ordered)|placed on|ordered on)\s*:?\s*([^\n]{3,40})/i.exec(text);
    const orderDate = sc.orderDate || (odm && (findDates(odm[1], ref)[0] || {}).date) || '';
    const partial = R.partial.test(subj + ' ' + text.slice(0, 600)) && (status === 'delivered');
    if (partial) status = 'out';

    let eta = sc.eta || '', etaEnd = sc.etaEnd || '';
    if (!eta && status !== 'delivered' && status !== 'cancelled') {
      const re = /(?:(?:estimated|scheduled|expected|anticipated|promised)\s*(?:delivery|arrival)(?:\s*(?:date|window))?|arriving(?:\s*(?:on|by))?|arrives(?:\s*(?:on|by))?|est\.?\s*arrival|deliver(?:y|ed)?\s*(?:by|on)|get it by|due (?:by|on)|arrival date)\s*:?\s*/gi;
      let m;
      while ((m = re.exec(text)) && !eta) {
        const win = text.slice(re.lastIndex, re.lastIndex + 70).split('\n').slice(0, 3).join(' ');
        const ds = findDates(win, ref);
        if (ds.length && ds[0].i < 40) {
          eta = ds[0].date;
          if (ds[1] && /^\s*(?:[-–—]|to|through)\s*(?:[A-Za-z]{3,9},?\s*)?$/i.test(win.slice(ds[0].end, ds[1].i))) etaEnd = ds[1].date;
        } else { const d = dateIn(win.slice(0, 40), ref); if (d && /\b(today|tomorrow|mon|tue|wed|thu|fri|sat|sun)/i.test(win.slice(0, 30))) eta = d; }
      }
      if (!eta && /arriving today|out for delivery|delivery today/i.test(subj)) eta = day;
      if (!eta) { const sd = dateIn((/(?:arriving|arrives|delivery by)\s+(?:on\s+)?([^!\n]{3,30})/i.exec(subj) || [])[1] || '', ref); if (sd) eta = sd; }
    }
    // A pickup booked for a time: "Pickup Time: Tuesday, October 13, 2026, 4:00 PM - 5:00 PM"
    if (!eta && kind === 'pickup' && status === 'ordered') {
      const pm = /pick-?up (?:time|date|window|slot)\s*:?\s*([^\n]{3,60})/i.exec(text);
      const pd = pm && findDates(pm[1], ref)[0];
      if (pd) eta = pd.date;
    }
    let deliveredOn = '';
    if (status === 'delivered') {
      const m = /deliver(?:y|ed)[ \t]*(?:date|on)?[ \t]*:?[ \t]*([^\n]{3,40})/i.exec(text);
      deliveredOn = (m && findDates(m[1], ref)[0] && findDates(m[1], ref)[0].date) || day;
    }
    let pickupBy = '';
    if (status === 'pickup' || kind === 'pickup') {
      const m = /(?:pick(?:ed)?\s*it\s*up|pick\s*up|pickup|collect|available|hold|held|ready)[^.\n]{0,60}?\b(?:by|before|until|through|thru|till|expires?(?: on)?)\s+([^\n.]{3,40})/i.exec(subj + '\n' + text);
      if (m) pickupBy = dateIn(m[1], ref);
    }

    const steps = {};
    if (status === 'delivered') steps.delivered = deliveredOn;
    else if (status && status !== 'cancelled') steps[status] = status === 'ordered' && orderDate ? orderDate : day;
    if (orderDate && status !== 'cancelled') steps.ordered = steps.ordered || orderDate;

    const f = {
      store, storeKey: keyOf(store), orderNo, orderDate: orderDate || (status === 'ordered' ? day : ''),
      items, total: found ? found.total : null, cur: found ? found.cur : '',
      status, kind, carrier, tracking: trk ? trk.tracking : '', trackUrl: sc.trackUrl || trackUrl(carrier, trk && trk.tracking),
      eta, etaEnd, deliveredOn, pickupBy, steps, issue, partial,
      source: { msgId: msg.id || '', threadId: msg.threadId || '', subject: subject.slice(0, 200), from: String(msg.from || '').slice(0, 200), date: ref },
    };
    if (f.total == null) delete f.total;
    if (!f.cur) delete f.cur;
    f.guess = !!issue || !store || (!orderNo && !trk) || (kind === 'other');
    f.id = idFor(f);
    return { orders: [f], skip: '' };
  }

  // Text pasted by hand (a forwarded confirmation, say).
  const parseText = (text, ref) => parseEmail({ text, subject: '', from: '', date: ref || Date.now() });

  // ---------------------------------------------------------------------
  // Folding a fact into the orders
  // ---------------------------------------------------------------------
  const rank = s => (s in RANK ? RANK[s] : 0);
  const sameTrack = (a, b) => { a = normTrack(a); b = normTrack(b); return !!a && !!b && (a === b || (Math.min(a.length, b.length) >= 12 && (a.endsWith(b) || b.endsWith(a)))); };
  const sameNo = (a, b) => normNo(a) === normNo(b);
  // Stores named a little differently in different emails ("CurrentBody", "Currentbody Skin").
  const compat = (a, b, longNo) => (!a || !b) ? longNo : a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));
  const lastDay = o => [o.steps && Object.values(o.steps).sort().pop(), o.orderDate, o.source && o.source.date && localYmd(o.source.date)].filter(Boolean).sort().pop() || '';
  function findMatch(orders, f) {
    let m = orders.find(o => o.id === f.id);
    if (m) return m;
    if (f.tracking) { m = orders.find(o => o.tracking && sameTrack(o.tracking, f.tracking)); if (m) return m; }
    if (f.orderNo) {
      m = orders.find(o => o.orderNo && sameNo(o.orderNo, f.orderNo) && compat(o.storeKey, f.storeKey, normNo(f.orderNo).length >= 8));
      if (m) return m;
    }
    // A carrier's notice names only the shipper: it belongs to that shipper's newest order without tracking yet.
    if (!f.orderNo && f.tracking && f.storeKey) {
      const day = localYmd(f.source.date);
      const c = orders.filter(o => !o.tracking && o.status !== 'cancelled' && o.kind !== 'pickup' && o.storeKey && compat(o.storeKey, f.storeKey, false) && Math.abs(daysBetween(lastDay(o) || day, day)) <= 45)
        .sort((a, b) => lastDay(b).localeCompare(lastDay(a)));
      if (c[0]) return c[0];
    }
    return null;
  }
  const FIRST_WINS = ['store', 'storeKey', 'orderNo', 'orderDate'];
  const INFO_KEYS = ['store', 'storeKey', 'orderNo', 'orderDate', 'total', 'cur', 'carrier', 'tracking', 'trackUrl', 'eta', 'etaEnd', 'pickupBy'];
  // ctx: {graves, revive:Set, byHand}. Returns 'new', 'changed', 'same' or 'gone'.
  function upsert(orders, f, ctx = {}) {
    const graves = ctx.graves || {}, when = o => (o.source && o.source.date) || 0;
    if (graves['orders:' + f.id] && !(ctx.revive && ctx.revive.has(f.id))) return 'gone';
    const cur = findMatch(orders, f);
    if (!cur) {
      const o = { ...f, created: Date.now(), notes: '', locks: {} };
      delete o.deliveredOn; delete o.partial;
      orders.push(o);
      return 'new';
    }
    const locks = cur.locks || {};
    let changed = false;
    const set = (k, v) => { if (cur[k] !== v) { cur[k] = v; changed = true; } };
    const newer = (f.source ? f.source.date : 0) >= when(cur);
    if (f.status === 'cancelled') {
      if (cur.status !== 'cancelled') { set('status', 'cancelled'); }
      return changed ? 'changed' : 'same';
    }
    for (const k of INFO_KEYS) {
      if (locks[k] || f[k] == null || f[k] === '') continue;
      if (cur[k] == null || cur[k] === '' || (newer && cur[k] !== f[k] && !FIRST_WINS.includes(k))) set(k, f[k]);
    }
    // never let a late, lesser email undo the best carrier/tracking pair
    if (f.items && f.items.length && !locks.items) {
      cur.items = cur.items || [];
      for (const it of f.items) {
        const k = it.name.toLowerCase();
        // the same item named a little differently in two emails ("Brand Name" / "Name") is one item
        const m = cur.items.find(x => { const y = x.name.toLowerCase(); return y === k || (Math.min(y.length, k.length) >= 12 && (y.includes(k) || k.includes(y))); });
        if (!m) { if (cur.items.length < 12) { cur.items.push(it); changed = true; } }
        else {
          if (it.name.length > m.name.length) { m.name = it.name; changed = true; }
          if (it.qty && !m.qty) { m.qty = it.qty; changed = true; }
        }
      }
    }
    cur.steps = cur.steps || {};
    for (const [s, d] of Object.entries(f.steps || {})) if (d && (!cur.steps[s] || d < cur.steps[s])) { cur.steps[s] = d; changed = true; }
    if (!locks.status && cur.status !== 'cancelled' && rank(f.status) > rank(cur.status)) set('status', f.status);
    if (!locks.status && cur.status === f.status && f.status === 'pickup' && f.pickupBy) set('pickupBy', f.pickupBy);
    if (cur.status === 'delivered' || cur.status === 'pickedup') { if (cur.issue) { cur.issue = ''; changed = true; } }
    else if (f.issue && newer && cur.issue !== f.issue) set('issue', f.issue);
    // pickup or package, whichever the emails settle on
    if (!locks.kind) {
      if (cur.kind === 'package' && f.kind === 'pickup' && !cur.tracking && !f.tracking) set('kind', 'pickup');
      else if (cur.kind === 'pickup' && f.tracking) set('kind', 'package');
      else if (!cur.kind) set('kind', f.kind);
    }
    const guess = !!cur.issue || !!(cur.guess && f.guess);
    if (!!cur.guess !== guess) { cur.guess = guess; changed = true; }
    if (newer && f.source && (!cur.source || f.source.msgId !== cur.source.msgId)) { cur.source = f.source; changed = true; }
    return changed ? 'changed' : 'same';
  }

  const api = { parseEmail, parseText, upsert, findMatch, findTotal, findOrderNo, trackingIn, trackUrl, statusOf, itemsFromText, fromSchema, htmlToText, jsonLdBlocks, microdata,
    findDates, dateIn, senderInfo, storeOf, kindOf, idFor, hash, keyOf, addDays, daysBetween, localYmd, rank, STATUS_NAMES, KINDS, carrierName, lastDay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OrdersParse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
