"use strict";

// School's reading of the school's emails: pure functions, no page, so they can be tested in Node
// (school/scripts/sort-test.mjs); app.js reads Gmail and draws the result.
//
// The school writes through ParentSquare, and every email comes from parentsquare.com:
//   a daily digest    many posts, each "N. Title / Posted by <who> on <when> in <groups> / text / link"
//   one post          "<who> posted in <group> / Title / text / link"
//   an update         "<who> sent an update about <title> / text"
//   an event          "Upcoming Event: <title>, on <day> at <time>", "Reminder to RSVP for: <title>",
//                     "Reminder: You RSVP'd YES for: <title>"
//   a sign-up         "Reminder that <who> shared a sign up in <group> / <title> / still needs N items"
//   a message         "<who> replied to your conversation." / "<who> sent you a message."
//   a receipt         "Payment Receipt for <what>" ... "Total: $37.00"
//   a report          "<child>: T1 Report Card", "<child>: Term 1 Progress Report"
//   a newsletter      "<school> Tiger Times 10/25/2026" (any long newsletter: its dates list is read)
// readEmail() turns one email into items (a digest into one item a post); everything after that
// (whose it is, which section, the next school day) is worked out from the items and the person's
// settings when the page draws, so changing a setting never needs Gmail read again.
(function (root) {
  const DAY = 864e5;
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
  const MONTH_RE = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?';
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const noon = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (s, n) => { const d = noon(s); d.setDate(d.getDate() + n); return ymd(d); };
  const dow = s => noon(s).getDay();
  const between = (a, b) => Math.round((noon(b) - noon(a)) / DAY);

  // ---------------------------------------------------------------------
  // Text: an email's HTML as plain text, and the bits of Markdown and HTML a text part carries
  // ---------------------------------------------------------------------
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', bull: '•', middot: '·', darr: '↓' };
  const decode = s => String(s || '').replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m;
  });
  function htmlToText(html) {
    return decode(String(html || '').replace(/\r\n?/g, '\n')
      .replace(/<(script|style|head|title)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi, (m, u) => ' ![](' + u + ') ')
      .replace(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, u, t) => { const w = t.replace(/<[^>]+>/g, '').trim(); return w ? '[' + w + '](' + u + ')' : u; })
      .replace(/<hr\b[^>]*>/gi, '\n-----\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(/<\/(p|div|tr|li|h[1-6]|table|ul|ol|blockquote|section)>/gi, '\n')
      .replace(/<(p|div|tr|h[1-6]|table|ul|ol|blockquote|section)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ''))
      .replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
      .replace(/^- *\n+/gm, '- ').replace(/(^- [^\n]*)\n\n(?=- )/gm, '$1\n').replace(/(^- [^\n]*)\n\n(?=- )/gm, '$1\n');   // a list's items, one under another
  }
  // What a post says, readable: links and pictures taken out (kept on the side), emphasis marks gone.
  function clean(text) {
    const links = [], images = [];
    let t = decode(String(text || '')).replace(/\r\n?/g, '\n');
    t = t.replace(/!\[[^\]]*\]\((\S+?)\)/g, (m, u) => { images.push(u); return ''; });
    t = t.replace(/\[([^\]]+)\]\((\S+?)\)/g, (m, w, u) => { const word = w.replace(/\*\*|__/g, '').trim(); links.push({ t: word, u }); return word; });
    t = t.replace(/\*\*|__|\\(?=[*_>#-])/g, '').replace(/<\/?u>/g, '').replace(/^#{1,6}\s*/gm, '')
      .replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\|\s*$/gm, '').replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    for (const m of t.matchAll(/https?:\/\/[^\s)<>"]+/g)) if (!links.some(l => l.u === m[0])) links.push({ t: '', u: m[0] });
    return { text: t, links, images };
  }
  const FOOTER = /\n\s*(You received this email because|Please do not reply to this email|Stay involved with your child)[\s\S]*$/i;
  const VIEW = /\s*(To see the post(?: and (?:comment|pay|sign up))?, please visit the following link:|To view this post, please click the following link:|View Event|View or Reply in App:|View Document|There (?:is|are) \d+ attachments? with this post)[\s\S]*$/i;
  const linkIn = (s, re) => { const m = re.exec(s); return m ? m[1].replace(/[)\].,]+$/, '') : ''; };
  const POST_LINK = /(?:following link:|View Event|View or Reply in App:|View Document)\s*\[?(https:\/\/[^\s\]()]+)/i;

  // ---------------------------------------------------------------------
  // Dates in words: "Friday, Oct 30", "October 29th", "November 16–20", "Nov 9 - 20",
  // "December 21 - January 1", "10/30/2026", "tomorrow", with the year worked out from when it was sent
  // ---------------------------------------------------------------------
  function yearFor(m, d, ref) {
    const r = new Date(ref);
    let best = null;
    for (const y of [r.getFullYear() - 1, r.getFullYear(), r.getFullYear() + 1]) {
      const at = new Date(y, m, d, 12); if (at.getMonth() !== m) continue;
      const diff = (at - r) / DAY; if (diff < -150 || diff > 300) continue;
      if (!best || Math.abs(diff) < Math.abs(best.diff)) best = { y, diff };
    }
    return best ? best.y : null;
  }
  const mkDay = (m, d, ref, y) => { const yy = y || yearFor(m, d, ref); if (yy == null) return null; const at = new Date(yy, m, d, 12); return at.getMonth() === m && at.getDate() === d ? ymd(at) : null; };
  const TIME = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\b\.?/i;
  const timeOf = s => { const m = TIME.exec(s || ''); if (!m) return ''; let h = +m[1] % 12; if (/p/i.test(m[3])) h += 12; return pad(h) + ':' + (m[2] || '00'); };
  function parseDates(text, ref, { relative = true } = {}) {
    const out = [], seen = new Set(), s = String(text || '');
    const push = (d, end, at) => { if (!d || seen.has(d + (end || ''))) return; seen.add(d + (end || '')); out.push({ d, end: end && end > d ? end : '', time: '', at }); };
    const re = new RegExp('\\b' + MONTH_RE + '\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s*(20\\d\\d))?(?:\\s*(?:[–—-]|to|through|thru)\\s*(?:' + MONTH_RE + '\\s+)?(\\d{1,2})(?!(?:st|nd|rd|th)?\\s*(?:(?:[–-]|to|and|&)\\s*\\d{1,2}(?:st|nd|rd|th)?\\s*)?grade)(?:st|nd|rd|th)?\\b(?:,?\\s*(20\\d\\d))?)?', 'gi');   // "Nov 4 – 3rd grade …" is Nov 4, not a range
    for (const m of s.matchAll(re)) {
      const mo = MON[m[1].toLowerCase().slice(0, m[1].toLowerCase().startsWith('sept') ? 4 : 3)], d1 = +m[2];
      if (mo == null || d1 < 1 || d1 > 31) continue;
      const year = m[3] ? +m[3] : null, start = mkDay(mo, d1, ref, year); if (!start) continue;
      let end = '';
      if (m[5]) {
        const mo2 = m[4] ? MON[m[4].toLowerCase().slice(0, m[4].toLowerCase().startsWith('sept') ? 4 : 3)] : mo, d2 = +m[5];
        if (mo2 != null && d2 >= 1 && d2 <= 31) { let y2 = noon(start).getFullYear(); if (mo2 < mo) y2++; end = mkDay(mo2, d2, ref, m[6] ? +m[6] : y2) || ''; }
        if (end && between(start, end) > 60) end = '';
      }
      push(start, end, m.index);
    }
    for (const m of s.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d\d)\b/g)) push(mkDay(+m[1] - 1, +m[2], ref, +m[3]), '', m.index);
    if (relative && !out.length) {
      const day = ymd(new Date(ref));
      const r = /\b(tomorrow|today|tonight|this (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i.exec(s);
      if (r) {
        const w = r[1].toLowerCase();
        if (w === 'tomorrow') push(addDays(day, 1), '', r.index);
        else if (w.startsWith('this ')) { const want = WEEKDAYS.findIndex(x => x.toLowerCase() === w.slice(5)); let x = day; for (let i = 0; i < 7 && dow(x) !== want; i++) x = addDays(x, 1); push(x, '', r.index); }
        else push(day, '', r.index);
      }
    }
    // a time said near a date ("Friday, Sep 11, 4:00 PM", "at 6:00 PM") goes with it
    for (const o of out) { const t = timeOf(s.slice(o.at, o.at + 60)); if (t) o.time = t; delete o.at; }
    return out.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  }

  // ---------------------------------------------------------------------
  // Grades: "Kindergarten" is 0; which grades a post or a group names
  // ---------------------------------------------------------------------
  // Pre-K (and TK, preschool) is -1: not Kindergarten, though "Pre-Kindergarten" has the word in it.
  // "Middle school" is 6 to 8. A post or a line that names no grade names none (it's kept for everyone).
  const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8 };
  const PREK = /\b(?:pre[- ]?k(?:inder(?:garten)?)?|t-?k|transitional kindergarten|pre[- ]?school(?:ers?)?)\b/i, PREK_ALL = new RegExp(PREK.source, 'gi');
  function gradesIn(s) {
    const g = new Set();
    let t = String(s || '');
    const range = (a, b) => { for (let i = Math.min(a, b); i <= Math.max(a, b) && i <= 12; i++) g.add(i); };
    if (PREK.test(t)) { g.add(-1); t = t.replace(PREK_ALL, ' '); }
    for (const m of t.matchAll(/\bK\s*[–-]\s*(\d{1,2})\b/g)) range(0, +m[1]);
    for (const m of t.matchAll(/\bK\s*(?:\/|&|and)\s*(\d{1,2})(?:st|nd|rd|th)?\b/g)) { g.add(0); g.add(+m[1]); }
    if (/\bkinder(?:gart(?:en|ner|ener))?s?\b/i.test(t) || /\b[Gg]rades?\s+K\b|\bK\s+(?:students|families|parents|class(?:es|rooms?)?|teachers|friends|kids|scholars)\b/.test(t)) g.add(0);
    if (/\bmiddle[- ]school(?:ers?)?\b/i.test(t)) range(6, 8);
    for (const m of t.matchAll(/\bgrades?\s*(\d{1,2})(?:\s*(?:[–-]|to)\s*(\d{1,2}))?/gi)) m[2] ? range(+m[1], +m[2]) : g.add(+m[1]);
    for (const m of t.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)\s*(?:[–-]|to)\s*(\d{1,2})(?:st|nd|rd|th)\b/gi)) range(+m[1], +m[2]);
    for (const m of t.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)\b(?!\s*(?:of|day|annual|place|percentile))/gi)) {
      const after = t.slice(m.index + m[0].length, m.index + m[0].length + 40);
      if (/^\s*(?:,|and|&|-|–|\/|grade|graders)/i.test(after) || /grade/i.test(after)) g.add(+m[1]);
    }
    for (const [w, n] of Object.entries(ORD)) if (new RegExp('\\b' + w + '[- ]grade', 'i').test(t)) g.add(n);
    return g;
  }
  // Whether something naming these grades is for this grade: yes when it names none, or no grade is known.
  const forGrade = (named, grade) => grade == null || !named.size || named.has(grade);
  // The dates a post gives for this grade: "Picture day: Kindergarten Nov 3, 1st grade Nov 4" keeps Nov 3. A
  // date said only on lines that name other grades is left out; one said anywhere else is kept.
  function datesFor(x, grade) {
    const ds = x.dates || [];
    if (grade == null || ds.length < 2 || !gradesIn(x.body || '').size) return ds;
    const theirs = new Set(), ours = new Set();
    for (const line of String(x.body || '').split(/\n|[.!?;]\s+/)) {
      const on = parseDates(line, x.at); if (!on.length) continue;
      const to = forGrade(gradesIn(line), grade) ? ours : theirs;
      for (const d of on) to.add(d.d);
    }
    return ds.filter(d => !theirs.has(d.d) || ours.has(d.d));
  }
  const isGradeGroup = name => /^(kindergarten|\d{1,2}(st|nd|rd|th) grade|grade \d{1,2})$/i.test(String(name).trim());
  const gradeOfGroup = name => { const s = String(name).trim(); if (/^kindergarten$/i.test(s)) return 0; const m = /(\d{1,2})/.exec(s); return m ? +m[1] : null; };

  // ---------------------------------------------------------------------
  // What a post is
  // ---------------------------------------------------------------------
  const NOSCHOOL = /\bno school\b|\bno classes\b|relief friday|\b(?:school|building) (?:will be |is )?closed\b|\b(?:fall|winter|spring|thanksgiving) break\b|\bteacher work ?day\b/i;
  const WEAR = /\bwear\b|\bdress[- ]?up\b|\bdress as\b|\bcostume|\bpajama|\bspirit (?:day|week)\b|\bcrazy (?:hair|sock)|\bcharacter (?:day|dress)|\buniform\b/i;
  const ASK = /\bsign[- ]?ups?\b|\bregistration\b|\bregister\b|\brsvp\b|\bvolunteers?\b|\bpermission slip\b/i;
  const FORM = /forms\.gle\/|docs\.google\.com\/forms|signupgenius\.com/i;
  const PAYASK = /\bclick here to pay\b|\bpay via parentsquare\b|\bpayment link\b|\bto see the post and pay\b/i;
  const EVENTWORD = /\bnight\b|\bday\b|\bshowcase\b|\bfair\b|\bfestival\b|\bparade\b|\bconcert\b|\bperformance\b|\bcelebration\b|\btrunk or treat\b|\bmeeting\b|\bpictures?\b|\bfield trip\b|\bbook fair\b|\bconference/i;
  function kindOf(title, body, groups) {
    const head = title + ' ' + body.slice(0, 160);
    if (groups.some(g => /club|crew/i.test(g)) && /\bno\b[^.!?\n]{0,40}\bclub\b|\bclub\b[^.!?\n]{0,20}\bcancel/i.test(head)) return 'clubOff';
    if (NOSCHOOL.test(title)) return 'noschool';
    if (WEAR.test(title)) return 'wear';
    if (/\bsurvey\b/i.test(title)) return 'survey';
    if (ASK.test(title) || (FORM.test(body) && /\b(sign|fill out|register|form)\b/i.test(body.slice(0, 600)))) return 'form';
    if (PAYASK.test(body) && !/receipt/i.test(title)) return 'pay';
    if (/newsletter|tiger times/i.test(title)) return 'newsletter';
    if (NOSCHOOL.test(body.slice(0, 300))) return 'noschool';
    if (EVENTWORD.test(title)) return 'event';
    return 'post';
  }

  // ---------------------------------------------------------------------
  // One email -> items
  // ---------------------------------------------------------------------
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const HEAD = /(?:^|\n)[ \t]*(?:\d+\.[ \t]*)?([^\n]+?)[ \t]*\n(?:[ \t]*\n)*[ \t]*Posted by ([^\n]+?) on ((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z]{2,8} \d{1,2}(?:, \d{4})? at \d{1,2}:\d{2} ?[AP]M) in ([^\n]+)/g;
  function postedAt(when, ref) {
    const m = /([A-Z][a-z]{2,8}) (\d{1,2})(?:, (\d{4}))? at (\d{1,2}):(\d{2}) ?([AP])M/.exec(when);
    if (!m) return ref;
    const mo = MON[m[1].toLowerCase().slice(0, m[1].toLowerCase().startsWith('sept') ? 4 : 3)]; if (mo == null) return ref;
    const day = mkDay(mo, +m[2], ref, m[3] ? +m[3] : null); if (!day) return ref;
    const d = noon(day); d.setHours((+m[4] % 12) + (m[6] === 'P' ? 12 : 0), +m[5], 0, 0);
    return d.getTime();
  }
  const groupsOf = s => String(s || '').split(/\s*,\s*/).map(x => x.trim()).filter(Boolean);
  function item(base, o) {
    const c = clean(o.body || '');
    const body = c.text.replace(VIEW, '').replace(FOOTER, '').trim();
    const groups = o.groups || [];
    const title = clean(o.title || '').text.replace(/\s+/g, ' ').trim().slice(0, 200) || 'From school';
    const x = {
      id: base.id + (o.n != null ? ':' + o.n : ''), msg: base.id, thread: base.threadId || base.id,
      at: o.at || base.date, kind: o.kind || kindOf(title, body + '\n' + c.links.map(l => l.u).join(' '), groups), title, body: body.slice(0, o.long ? 24000 : 6000),
      author: (o.author || '').trim().slice(0, 80), groups, school: base.school || '',
      url: o.url || linkIn(o.body || '', POST_LINK) || '', image: c.images[0] || '',
      links: c.links.filter(l => !/parentsquare\.com\/(schools\/\d+\/unsubscribe|users\/\d+\/chats)/.test(l.u)).slice(0, 12),
    };
    // a post with no words of its own but a picture is a picture newsletter (Claude reads its dates later, in PR 2)
    x.picture = !!x.image && body.replace(/\s+/g, '').length < 40;
    const dates = parseDates(title + '\n' + body, x.at);
    if (o.date) dates.unshift(o.date);
    x.dates = dates.filter((d, i, a) => a.findIndex(y => y.d === d.d && y.end === d.end) === i).slice(0, 12);
    for (const k of ['rsvp', 'amount', 'child', 'events', 'needs']) if (o[k] != null) x[k] = o[k];
    return x;
  }
  function readEmail(m) {
    const base = { id: m.id, threadId: m.threadId, date: +m.date || Date.now() };
    const subject = decode(m.subject || '').trim();
    let text = m.text ? decode(m.text) : htmlToText(m.html || '');
    text = text.replace(/\r\n?/g, '\n');
    const sch = /ParentSquare user in ([^.\n]+)\./.exec(text); base.school = sch ? sch[1].trim() : '';
    const sentOn = /\s+on [A-Z][a-z]+day, [A-Z][a-z]{2,8} \d{1,2} at \d{1,2}:\d{2} ?[ap]m$/i;
    const subjDate = s => { const m2 = / on ([A-Z][a-z]+day, [A-Z][a-z]{2,8} \d{1,2})(?: at (\d{1,2}:\d{2} ?[ap]m))?/i.exec(s); if (!m2) return null; const p = parseDates(m2[1], base.date, { relative: false })[0]; if (p && m2[2]) p.time = timeOf(m2[2]); return p || null; };
    let r;
    // a digest: one item a post
    if (/\bDigest:/i.test(subject) || /Daily digest created for/i.test(text)) {
      const out = [], heads = [...text.matchAll(HEAD)];
      heads.forEach((h, i) => {
        const from = h.index + h[0].length, to = i + 1 < heads.length ? heads[i + 1].index : text.length;
        const chunk = text.slice(from, to).replace(/\n-{5,}\s*$/, '');
        out.push(item(base, { n: i, title: h[1].replace(/^\d+\.\s*/, ''), author: h[2], at: postedAt(h[3], base.date), groups: groupsOf(h[4]), body: chunk }));
      });
      return out;
    }
    if (/payment receipt/i.test(subject)) {
      const amt = /Total(?: with Fee)?:\s*\$([\d,]+\.\d\d)/i.exec(text.replace(/Total:\s*\$[\d,.]+\s*\n\s*Service Fee[\s\S]*?(Total with Fee)/i, '$1'));
      return [item(base, { kind: 'paid', title: subject.replace(/^payment receipt for\s*(payment for\s*)?/i, '') || 'A payment', body: '', amount: amt ? amt[1] : '' })];
    }
    if ((r = /^(.{1,60}?):\s*(.*(?:report card|progress report).*)$/i.exec(subject))) {
      return [item(base, { kind: 'report', title: r[2], child: r[1], body: text.replace(/^.*?(Please see)/is, '$1') })];
    }
    if ((r = /^Upcoming Event:\s*(.+)$/i.exec(subject))) {
      const t = r[1].replace(sentOn, '').replace(/,\s*$/, '').trim();
      return [item(base, { kind: 'event', title: t, date: subjDate(r[1]), body: text.replace(/^\s*Coming up on:[^\n]*\n(\s*Coming up on:[^\n]*\n)?/i, '') })];
    }
    if ((r = /^Reminder to RSVP for:\s*(.+)$/i.exec(subject))) {
      return [item(base, { kind: 'rsvp', title: r[1].replace(sentOn, '').trim(), date: subjDate(r[1]), body: text })];
    }
    if ((r = /^Reminder: You RSVP'?d (\w+) for:\s*(.+)$/i.exec(subject))) {
      return [item(base, { kind: 'event', rsvp: r[1].toLowerCase(), title: r[2].replace(sentOn, '').replace(/,\s*$/, '').trim(), date: subjDate(r[2]), body: text })];
    }
    if ((r = /Reminder that (.+?) shared a sign ?up in ([^\n]+)\n+\s*([^\n]+)/i.exec(text))) {
      const needs = /still needs (\d+) items?/i.exec(text);
      return [item(base, { kind: 'signup', title: r[3], author: r[1], groups: groupsOf(r[2]), needs: needs ? +needs[1] : null, body: text.slice(r.index + r[0].length) })];
    }
    if ((r = /^\s*(.+?) (replied to your conversation|sent you a message)\.\s*\n/i.exec(text))) {
      const msg = text.slice(r.index + r[0].length).replace(/\n\s*Previous Message:[\s\S]*$/i, '');
      const first = clean(msg).text.replace(VIEW, '').replace(FOOTER, '').trim();
      return [item(base, { kind: 'message', title: first.split('\n')[0].slice(0, 90) || 'A message', author: r[1], body: msg, url: linkIn(text, /View or Reply in App:\s*(https:\/\/\S+)/i) })];
    }
    if ((r = /^\s*(.+?) sent an update (?:in ([^\n]+?) )?about:?\s*([^\n]+)\n/i.exec(text))) {
      return [item(base, { title: r[3], author: r[1], groups: r[2] ? groupsOf(r[2]) : [], body: text.slice(r.index + r[0].length).replace(/\[[A-Z][a-z]+day, [^\]]+\][\s\S]*$/, '') })];
    }
    if ((r = /^\s*(.+?) (?:posted|created an event) in ([^\n]+)\n+\s*([^\n]+)\n/i.exec(text))) {
      return [item(base, { title: r[3], author: r[1], groups: groupsOf(r[2]), body: text.slice(r.index + r[0].length) })];
    }
    // a long newsletter (Tiger Times): its Upcoming Events list, and the rest as it is
    const isNews = /newsletter|times\b|bulletin|update/i.test(subject);   // kept whole (24,000 letters): each event's own section is read from it
    const x = item(base, { title: subject.replace(/\s*\d{1,2}\/\d{1,2}\/20\d\d\s*$/, '') || 'From school', body: text, kind: isNews ? 'newsletter' : undefined, long: isNews });
    if (x.kind === 'newsletter') { x.events = eventsList(text, base.date); x.dates = []; x.evv = 2; }
    return [x];
  }
  // A newsletter's list of dates: lines that start with a date ("October 27–29 👻 – Boo Buddies"), or
  // "Winter Break: December 21 - January 1".
  const DATE_LEAD = new RegExp('^' + MONTH_RE + '\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s*(?:[–—-]|to)\\s*(?:' + MONTH_RE + '\\s+)?\\d{1,2}(?!(?:st|nd|rd|th)?\\s*(?:(?:[–-]|to|and|&)\\s*\\d{1,2}(?:st|nd|rd|th)?\\s*)?grade)(?:st|nd|rd|th)?)?(?:,?\\s*20\\d\\d)?', 'i');
  // Each date keeps the grades it's for (g): the ones its own line names, else the ones a short heading
  // over it names ("**5th Grade**", until the next heading or paragraph); none when nothing says.
  function eventsList(text, ref) {
    const out = [], t = clean(text).text;
    let ctx = [];
    for (const line of t.split('\n')) {
      const s = line.replace(/^[\s\-•*]+/, '').trim(); if (!s) continue;
      if (s.length > 220) { ctx = []; continue; }
      let what = '', ds = [];
      const lead = new RegExp('^' + MONTH_RE + '\\s+\\d', 'i');
      if (lead.test(s)) { ds = parseDates(s, ref, { relative: false }); what = s.replace(DATE_LEAD, '').replace(/^[^\p{L}\p{N}]+/u, ''); }
      else { const m = /^([A-Z][\w' ]{2,40}?):\s*(.+)$/.exec(s); if (m && new RegExp('^' + MONTH_RE + '\\s+\\d', 'i').test(m[2])) { ds = parseDates(m[2], ref, { relative: false }); what = m[1]; } }
      if (!ds.length || !what || what === s) { ctx = s.length <= 80 ? [...gradesIn(s)] : []; continue; }
      what = what.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/^\s*[–—-]\s*/, '').replace(/\s+/g, ' ').trim();
      if (!what) continue;
      const own = [...gradesIn(what)], g = own.length ? own : ctx;
      out.push(Object.assign({ d: ds[0].d, end: ds[0].end, time: timeOf(what), what: what.slice(0, 140) }, g.length ? { g } : {}));
    }
    return out.filter((e, i, a) => a.findIndex(y => y.d === e.d && norm(y.what) === norm(e.what)) === i);
  }


  // Who the child is: what Settings > Your child and After school say, and what the emails say for the
  // rest (detect). app.js and aOS Home (aOS/home-find.js) both ask this.
  function child(items, prefs) {
    const d = detect(items), p = prefs || {}, set = v => v != null && v !== '';
    return {
      name: p.name || '', grade: set(p.grade) ? +p.grade : d.grade, teacher: p.teacher || d.teacher || '',
      homeroom: set(p.homeroom) ? p.homeroom : d.homeroom, school: d.school,
      ends: p.ends || '15:15', pickupBy: p.pickupBy || '15:40', lane: p.lane || '',
      care: p.care === 'on', careUntil: p.careUntil || '18:00',
      clubs: Object.fromEntries([1, 2, 3, 4, 5].map(i => [i, p['club' + i] ? { name: p['club' + i], until: p.clubUntil || '15:50' } : null])),
    };
  }

  // ---------------------------------------------------------------------
  // Whose it is: her class, her grade, the whole school, or someone else's
  // ---------------------------------------------------------------------
  // detect: what the emails say about the child, for Settings to start from (ParentSquare only
  // sends a family the posts of its own groups, so a homeroom group or a grade group on its own is hers).
  function detect(items) {
    const count = (list, key) => { const c = {}; for (const k of list) c[k] = (c[k] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1]).map(e => e[0])[0] || ''; };
    const groups = items.flatMap(x => x.groups || []);
    const homeroom = count(groups.filter(g => /^homeroom/i.test(g)));
    const solo = items.filter(x => (x.groups || []).filter(isGradeGroup).length === 1).map(x => x.groups.find(isGradeGroup));
    const g = solo.length ? gradeOfGroup(count(solo)) : null;
    const teacher = homeroom ? count(items.filter(x => (x.groups || []).includes(homeroom) && x.author).map(x => x.author)) : '';
    const school = count(items.map(x => x.school).filter(Boolean));
    return { homeroom, grade: g, teacher, school };
  }
  function audience(x, me) {
    if (x.kind === 'message') return 'class';
    if (x.kind === 'report' || x.kind === 'paid') return 'record';
    const groups = x.groups || [], grade = me.grade == null || me.grade === '' ? null : +me.grade;
    if (me.homeroom && groups.includes(me.homeroom)) return 'class';
    if (groups.some(g => /club|crew|\blab\b|team/i.test(g) && !isGradeGroup(g))) return 'class';
    const gg = groups.filter(isGradeGroup).map(gradeOfGroup);
    const named = gradesIn(x.title + '\n' + String(x.body || '').slice(0, 400));
    if (gg.length === 1 && gg[0] === grade && !(named.size && !named.has(grade))) return 'class';
    if (gg.length && grade != null && !gg.includes(grade)) return 'other';
    if (grade != null && named.size && !named.has(grade)) return 'other';
    if (gg.length || (grade != null && named.has(grade))) return 'grade';
    return 'school';
  }

  // ---------------------------------------------------------------------
  // School days, and the day the top card is about
  // ---------------------------------------------------------------------
  const OFF_WORDS = /\bno school\b|\bbreak\b|relief friday|\bclosed\b|\bno classes\b|teacher work ?day/i;
  function daysOff(items, grade = null) {
    const off = new Map();
    const add = (d, end, why) => { let x = d; for (let i = 0; i < 40; i++) { if (!off.has(x)) off.set(x, why); if (!end || x >= end) break; x = addDays(x, 1); } };
    for (const x of items) {
      if (x.kind === 'noschool') {
        // "No school Friday, Sep 4 or Monday, Sep 7": each date said; a one-day reminder's own date if none
        const why = shortWhy(x.title);
        for (const d of x.dates || []) add(d.d, d.end, why);
      }
      for (const e of eventsOf(x)) if (OFF_WORDS.test(e.what) && forGrade(gradesOfEvent(e), grade)) add(e.d, e.end, shortWhy(e.what));
    }
    return off;
  }
  const shortWhy = s => String(s).replace(/\(?\bno school\b\)?/ig, '').replace(new RegExp('\\b' + MONTH_RE + '\\s+\\d{1,2}(?:st|nd|rd|th)?\\b', 'gi'), '').replace(/^[\s\-–—:·,!]+|[\s\-–—:·,!]+$/g, '').replace(/\s+/g, ' ').slice(0, 60) || 'No school';
  // A newsletter's dates; one read before they kept their grades (evv 2) is read again from its words, once
  const relisted = new Map();
  function eventsOf(x) {
    if (x.kind !== 'newsletter' || x.evv === 2 || !x.body) return x.events || [];
    const key = x.id + '|' + x.body.length;
    if (!relisted.has(key)) relisted.set(key, eventsList(x.body, x.at));
    return relisted.get(key);
  }
  const gradesOfEvent = e => e.g ? new Set(e.g) : gradesIn(e.what);
  const isSchoolDay = (d, off) => dow(d) > 0 && dow(d) < 6 && !off.has(d);
  const mins = hhmm => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  // The day the top card is about: today until school is out, then the next school day; and the days
  // off on the way to it.
  function focusDay(now, off, me) {
    const today = ymd(now), end = mins(me.ends || '15:15');
    let d = today;
    if (!isSchoolDay(d, off) || now.getHours() * 60 + now.getMinutes() >= end) { d = addDays(d, 1); for (let i = 0; i < 40 && !isSchoolDay(d, off); i++) d = addDays(d, 1); }
    const gaps = [];
    for (let x = today === d ? d : addDays(today, now.getHours() * 60 + now.getMinutes() >= end || !isSchoolDay(today, off) ? 1 : 0); x < d; x = addDays(x, 1)) {
      if (dow(x) === 0 || dow(x) === 6 || !off.has(x)) continue;
      const why = off.get(x), last = gaps[gaps.length - 1];
      if (last && last.why === why && (between(last.end, x) === 1 || (between(last.end, x) <= 3 && dow(x) === 1))) last.end = x;
      else gaps.push({ d: x, end: x, why });
    }
    const label = d === today ? 'Today' : d === addDays(today, 1) ? 'Tomorrow' : WEEKDAYS[dow(d)];
    return { d, label, gaps };
  }
  // The pickup line for a day: the club on that weekday (Settings) or the usual carpool.
  const clock = hhmm => { let [h, m] = String(hhmm).split(':').map(Number); const pm = h >= 12; h = h % 12 || 12; return h + ':' + pad(m || 0) + (pm ? ' pm' : ' am'); };
  // With after-school care (Settings > After school), pickup is any time until care ends, after that day's club.
  function pickup(d, me) {
    const club = (me.clubs || {})[dow(d)];
    const lane = me.lane ? ', ' + me.lane : '';
    const care = me.care ? 'after-school care until ' + clock(me.careUntil || '18:00') : '';
    if (club && club.name) return { club: club.name, care: !!care, text: club.name + ' until ' + clock(club.until || '15:50') + (club.room ? ', ' + club.room : '') + (care ? ', then ' + care + '. Pickup by ' + clock(me.careUntil || '18:00') + '.' : '. Pickup at ' + clock(club.until || '15:50') + '.') };
    if (care) return { club: '', care: true, text: 'After-school care until ' + clock(me.careUntil || '18:00') + '. Pickup by ' + clock(me.careUntil || '18:00') + '.' };
    return { club: '', text: 'Pickup ' + clock(me.ends || '15:15') + (me.pickupBy ? '–' + clock(me.pickupBy).replace(/ pm$/, ' pm') : '') + lane + '.' };
  }


  // The weather at a time of a school day, from Open-Meteo's hourly forecast (app.js fetches it): the hour
  // it falls in. hourly: { time: ['2026-10-29T07:00', ...], temperature_2m, precipitation_probability, weather_code }.
  const WX_WORDS = c => c === 0 ? 'clear' : c <= 2 ? (c === 1 ? 'mostly clear' : 'partly cloudy') : c === 3 ? 'cloudy' : c <= 48 ? 'fog' : c <= 67 ? (c >= 56 && c <= 57 || c >= 66 ? 'freezing rain' : 'rain') : c <= 77 ? 'snow' : c <= 82 ? 'showers' : c <= 86 ? 'snow showers' : 'thunderstorms';
  function wxAt(hourly, d, hhmm, f = true) {
    if (!hourly || !Array.isArray(hourly.time)) return null;
    const i = hourly.time.indexOf(d + 'T' + String(hhmm).slice(0, 2) + ':00'); if (i < 0) return null;
    const c = (hourly.temperature_2m || [])[i], code = (hourly.weather_code || [])[i], pop = (hourly.precipitation_probability || [])[i];
    if (!Number.isFinite(c)) return null;
    const words = Number.isFinite(code) ? WX_WORDS(code) : '';
    const wet = Number.isFinite(pop) && pop >= 30 && !/rain|showers|snow|thunder/.test(words) ? pop + '% rain' : Number.isFinite(pop) && pop >= 30 ? words + ', ' + pop + '%' : words;
    return { t: Math.round(f ? c * 9 / 5 + 32 : c), text: Math.round(f ? c * 9 / 5 + 32 : c) + '°' + (wet ? ', ' + wet : ''), wet: Number.isFinite(pop) && pop >= 30 };
  }

  // ---------------------------------------------------------------------
  // The sections
  // ---------------------------------------------------------------------
  const onDay = (dates, d) => (dates || []).some(x => x.d === d || (x.end && x.d <= d && d <= x.end));
  const firstFrom = (dates, from) => (dates || []).find(x => (x.end || x.d) >= from);
  const ASKING = { signup: 1, rsvp: 1, form: 1, survey: 1, pay: 1 };
  const DATED = { noschool: 1, wear: 1, event: 1, clubOff: 1, rsvp: 1, form: 1, signup: 1, post: 1, pay: 1 };
  function sections(items, { now = new Date(), me = {}, done = {}, moved = {} } = {}) {
    const today = ymd(now), soon = addDays(today, 14);
    const all = items.map(x => Object.assign({}, x, { aud: moved[x.id] || audience(x, me) }));
    const mine = all.filter(x => x.aud !== 'other');
    const grade = me.grade == null || me.grade === '' ? null : +me.grade;
    const off = daysOff(mine, grade);
    const focus = focusDay(now, off, me);
    // RSVPs already answered (a "You RSVP'd" email for the same event) leave Needs you
    const answered = new Set(all.filter(x => x.rsvp).map(x => norm(x.title)));
    const needs = mine.filter(x => ASKING[x.kind] && !done[x.id] && !answered.has(norm(x.title)) && x.aud !== 'record')
      .map(x => ({ x, due: firstFrom(x.dates, today) }))
      .filter(({ x, due }) => due ? true : now - x.at < 21 * DAY)
      .filter(({ x, due }) => !(x.dates || []).length || due)
      .filter((o, i, a) => a.findIndex(y => norm(y.x.title) === norm(o.x.title)) === i)
      .sort((a, b) => (a.due ? a.due.d : '9') < (b.due ? b.due.d : '9') ? -1 : (a.due ? a.due.d : '9') > (b.due ? b.due.d : '9') ? 1 : b.x.at - a.x.at)
      .map(({ x, due }) => Object.assign(x, { due: due ? due.d : '' }));
    // dated things: posts' own dates, and the newsletters' lists
    const dated = [];
    for (const x of mine) {
      if (x.aud === 'record' || x.kind === 'message') continue;
      if (DATED[x.kind]) for (const d of datesFor(x, grade)) dated.push({ id: x.id, d: d.d, end: d.end, time: d.time, title: x.title, kind: x.kind });
      for (const e of eventsOf(x)) if (forGrade(gradesOfEvent(e), grade)) dated.push({ id: x.id, d: e.d, end: e.end, time: e.time, title: e.what, kind: OFF_WORDS.test(e.what) ? 'noschool' : WEAR.test(e.what) ? 'wear' : 'event', from: x.title });
    }
    const uniq = list => list.filter((e, i, a) => a.findIndex(y => y.d === e.d && norm(y.title) === norm(e.title)) === i);
    const coming = uniq(dated.filter(e => (e.end || e.d) >= today && e.d <= soon && e.kind !== 'post' || (e.kind === 'post' && e.d >= today && e.d <= soon && !/newsletter/i.test(e.title))))
      .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : (a.time || '99') < (b.time || '99') ? -1 : 1));
    const year = uniq(dated.filter(e => (e.end || e.d) >= today)).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
    // the top card: what's on that day, the days off on the way, and pickup
    const onFocus = uniq(dated.filter(e => onDay([e], focus.d) && e.kind !== 'noschool'));
    const top = { d: focus.d, label: focus.label, gaps: focus.gaps, lines: onFocus, pickup: pickup(focus.d, me) };
    const byNew = (a, b) => b.at - a.at;
    const cls = mine.filter(x => x.aud === 'class').sort(byNew);
    const rest = all.filter(x => x.aud !== 'class' && x.aud !== 'record').sort(byNew);
    const records = all.filter(x => x.kind === 'report').sort(byNew);
    const paid = all.filter(x => x.kind === 'paid').sort(byNew);
    return { today, top, needs, coming, year, cls, rest, records, paid, off };
  }

  // What Calendar shows (its School layer): days off, events and what's due, for the child; no links
  // with sign-in tokens in them.
  function calendarItems(items, opts) {
    const s = sections(items, Object.assign({}, opts, { now: new Date(Date.now() - 30 * DAY) }));
    const out = [];
    for (const [d, why] of s.off) out.push({ id: 'off|' + d, date: d, title: 'No school · ' + why, kind: 'off' });
    for (const e of s.year) if (e.kind !== 'noschool') out.push({ id: 'ev|' + e.id + '|' + e.d, date: e.d, end: e.end || undefined, time: e.time || undefined, title: e.title.slice(0, 120), kind: e.kind, item: e.id });
    for (const x of s.needs) if (x.due) out.push({ id: 'due|' + x.id, date: x.due, title: 'Due: ' + x.title.slice(0, 110), kind: 'due', item: x.id });
    return out.filter((e, i, a) => a.findIndex(y => y.date === e.date && norm(y.title) === norm(e.title)) === i).slice(0, 400);
  }


  // The school's other sites, from the links its emails carry (the newest of each): grades, the lunch
  // menu, reading minutes and the rest. Found, never typed in, so nothing about a school is in this code.
  const SITES = [
    ['campus', 'Infinite Campus', 'Grades and attendance.', /infinite ?campus|\/campus\/portal/i],
    ['menu', 'Lunch menu', 'What’s for lunch at school.', /nutrislice\.com/i],
    ['reading', 'Beanstack', 'Reading minutes.', /beanstack/i],
    ['clever', 'Clever', 'Her school apps.', /clever\.com/i],
    ['calendar', 'Academic calendar', 'The school year’s dates.', /academic[ -]calendar/i],
    ['carpool', 'Carpool plan', 'Lanes and times.', /carpool plan/i],
    ['uniform', 'Uniform order', 'School uniforms.', /uniform[ -]order/i],
    ['supplies', 'School supply list', 'What to bring.', /supply[ -]lists?/i],
    ['ps', 'ParentSquare', 'Every post, and replies.', /parentsquare\.com\/schools\/\d+\/feeds/i],
  ];
  function sites(items) {
    const found = {};
    for (const x of [...items].sort((a, b) => a.at - b.at))
      for (const l of x.links || []) for (const [k, name, sub, re] of SITES)
        if ((re.test(l.t) || re.test(l.u)) && /^https:\/\//.test(l.u) && !/unsubscribe/i.test(l.u)) found[k] = { k, name, sub, u: l.u };
    return SITES.map(s => found[s[0]]).filter(Boolean);
  }


  // ---------------------------------------------------------------------
  // The part of a long email about one thing on it: a newsletter's section on "STEAM Identity Day", not
  // the whole newsletter. The paragraph that shares the most of the thing's words (and its date), its
  // heading just above it, and what follows up to the next heading; never the newsletter's list of dates
  // when a section says more. -> { text, start, end } (where it is in the body), or null when nothing fits.
  // ---------------------------------------------------------------------
  const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'your', 'our', 'are', 'will', 'this', 'that', 'you', 'all', 'day', 'days', 'event', 'events', 'school', 'no', 'not', 'due', 'grade', 'grades']);
  const wordsOf = s => [...new Set(String(s || '').toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) || [])]
    .filter(w => w.length > 2 && !STOP.has(w) && !MON[w.slice(0, 3)] && !/^(mon|tue|wed|thu|fri|sat|sun)/.test(w) && !/^\d+(st|nd|rd|th)?$/.test(w));
  const isHeading = b => b.length <= 110 && !/\n/.test(b.trim()) && !/[.,:;?]$/.test(b.trim()) && !/^[-•*]\s/.test(b.trim());
  function excerpt(body, title, d) {
    const text = String(body || ''); if (text.length < 400) return null;
    const want = wordsOf(title); if (!want.length) return null;
    const blocks = []; const re = /[^\n](?:[\s\S]*?)(?=\n\s*\n|$)/g; let m;
    while ((m = re.exec(text))) blocks.push({ t: m[0], start: m.index, end: m.index + m[0].length });
    const dateRe = d ? new RegExp('\\b' + MONTH_RE + '\\s+' + (+d.slice(8)) + '(?:st|nd|rd|th)?\\b', 'i') : null;
    const lead = new RegExp('^[\\s\\-•*]*(?:[A-Z][\\w\' ]{1,40}:\\s*)?' + MONTH_RE + '\\s+\\d', 'i');
    const MONTH_LINE = new RegExp('^\\s*' + MONTH_RE + '\\s*$', 'i');
    const isList = t => { const ls = t.split('\n').filter(l => l.trim()); return MONTH_LINE.test(ls[0] || '') || ls.filter(l => lead.test(l) || /^\s*[-•*]\s/.test(l)).length >= Math.min(2, ls.length); };
    // Sections are scored on the words that are in some section (a word only the list has says nothing about
    // which section), a rare one (Check-In) counting for more than a common one (testing); a section needs
    // half the thing's words (two at least), or its date, to count. The list of dates gives the thing's own line, kept in
    // case no section says more.
    const has = (w, t) => new RegExp('\\b' + w).test(t);
    const low = blocks.map(b => b.t.toLowerCase()), listy = blocks.map(b => isList(b.t));
    const wantS = want.filter(w => low.some((t, i) => !listy[i] && has(w, t)));
    const weight = Object.fromEntries(wantS.map(w => [w, 1 / Math.max(1, low.filter((t, i) => !listy[i] && has(w, t)).length)]));
    const all = wantS.reduce((n, w) => n + weight[w], 0) || 1;
    let best = -1, top = 0, inList = null;
    blocks.forEach((b, i) => {
      if (listy[i]) {
        let off = b.start;
        for (const l of b.t.split('\n')) {
          const lh = want.filter(w => has(w, l.toLowerCase())).length / want.length;
          if (lh >= 0.5 && (!inList || lh > inList.h)) { const lo = text.indexOf(l, off); inList = { h: lh, start: lo, end: lo + l.length }; }
          off += l.length + 1;
        }
        return;
      }
      const hitW = wantS.filter(w => has(w, low[i]));
      if (!hitW.length) return;
      const dated = !!(dateRe && dateRe.test(b.t));
      if (!((hitW.length * 2 >= want.length && hitW.length >= Math.min(2, want.length)) || dated)) return;   // one shared word ("break") isn't enough
      const score = 0.5 * hitW.length / wantS.length + 0.5 * hitW.reduce((n, w) => n + weight[w], 0) / all + (dated ? 0.25 : 0) + (isHeading(b.t) ? 0.1 : 0);
      if (score > top + 1e-9) { top = score; best = i; }
    });
    if (best < 0 || top < 0.5) return inList ? { text: text.slice(inList.start, inList.end).replace(/^[\s\-•*]+/, '').trim(), start: inList.start, end: inList.end } : null;
    // start at its heading (the block itself, or a short line just above it), then on to the next heading or list
    let a = best;
    if (!isHeading(blocks[a].t) && a > 0 && isHeading(blocks[a - 1].t) && !MONTH_LINE.test(blocks[a - 1].t)) a--;
    const more = i => i < blocks.length && !isHeading(blocks[i].t) && !isList(blocks[i].t);
    let z = a, len = blocks[a].t.length;
    if (isHeading(blocks[a].t) && a + 1 < blocks.length && !isList(blocks[a + 1].t)) { z = a + 1; len += blocks[z].t.length; }
    while (more(z + 1) && len + blocks[z + 1].t.length < 1800) { z++; len += blocks[z].t.length; }
    const start = blocks[a].start, end = blocks[z].end;
    return { text: text.slice(start, end).trim(), start, end };
  }

  root.SchoolSort = { ymd, noon, addDays, dow, between, decode, htmlToText, clean, parseDates, timeOf, clock, gradesIn, kindOf, readEmail, eventsList, detect, child, audience, daysOff, isSchoolDay, focusDay, pickup, wxAt, sections, calendarItems, sites, excerpt, WEEKDAYS, MONTHS };
})(typeof window !== 'undefined' ? window : globalThis);
