"use strict";

// iCalendar for the Calendar app: reading and writing the .ics text iCloud
// keeps for each event (RFC 5545), working out when a repeating event
// happens, and time zones.
//
// - parse(text) turns an .ics file into a small tree: {name, props, children},
//   where each prop is {name, params, value}. serialize(tree) writes it back
//   out, folded at 75 characters with CRLF line ends, so an event read from
//   iCloud and written back keeps everything the app doesn't understand
//   (Apple's own X- properties, attendees, attachments).
// - expand(vcalendar, from, to, tz) lists every occurrence of every event in
//   the file between two moments: single events, repeating ones (RRULE with
//   DAILY, WEEKLY, MONTHLY and YEARLY, INTERVAL, COUNT, UNTIL, BYDAY,
//   BYMONTHDAY, BYMONTH, BYSETPOS and WKST), extra dates (RDATE), skipped
//   dates (EXDATE) and changed occurrences (RECURRENCE-ID).
// - Time zones come from the browser's own Intl tables, so no zone list is
//   shipped: zonedToUtc and utcToZoned convert between a wall time in a zone
//   and a moment, and vtimezone(zone) writes the VTIMEZONE block iCloud
//   expects next to a DTSTART;TZID=... line.
//
// Used by app.js in the browser (window.AllisonICal) and by
// scripts/ical-test.mjs in Node (globalThis.AllisonICal).
(function (root) {
  const WD = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];      // RFC weekday order: Monday first
  const DAY = 86400e3;
  const pad = (n, w = 2) => String(Math.abs(n)).padStart(w, '0');

  // -------------------------------------------------------------------
  // Text <-> tree
  // -------------------------------------------------------------------
  const unfold = text => String(text || '').replace(/(?:\r\n|\n|\r)[ \t]/g, '').split(/\r\n|\n|\r/);

  // Splits on a separator, ignoring any inside double quotes.
  function splitQ(s, sep) {
    const out = []; let cur = '', q = false;
    for (const ch of s) {
      if (ch === '"') { q = !q; cur += ch; }
      else if (ch === sep && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }

  function parseLine(line) {
    let i = 0, q = false;
    for (; i < line.length; i++) { const ch = line[i]; if (ch === '"') q = !q; else if (ch === ':' && !q) break; }
    if (i >= line.length) return null;
    const parts = splitQ(line.slice(0, i), ';');
    const name = parts[0].trim().toUpperCase();
    if (!name) return null;
    const params = {};
    for (const p of parts.slice(1)) {
      const eq = p.indexOf('=');
      if (eq < 0) continue;
      const vals = splitQ(p.slice(eq + 1), ',').map(v => v.replace(/^"(.*)"$/, '$1'));
      params[p.slice(0, eq).toUpperCase()] = vals.length === 1 ? vals[0] : vals;
    }
    return { name, params, value: line.slice(i + 1) };
  }

  // Every top-level component in the text (usually one VCALENDAR).
  function parseAll(text) {
    const top = { name: 'ROOT', props: [], children: [] };
    const stack = [top];
    for (const line of unfold(text)) {
      if (!line) continue;
      const p = parseLine(line);
      if (!p) continue;
      if (p.name === 'BEGIN') { const c = { name: p.value.trim().toUpperCase(), props: [], children: [] }; stack[stack.length - 1].children.push(c); stack.push(c); }
      else if (p.name === 'END') { if (stack.length > 1) stack.pop(); }
      else stack[stack.length - 1].props.push(p);
    }
    return top.children;
  }
  function parse(text) {
    const all = parseAll(text);
    return all.find(c => c.name === 'VCALENDAR') || all[0] || component('VCALENDAR');
  }

  const component = (name, props = []) => ({ name, props: props.map(([n, v, p]) => ({ name: n, params: p || {}, value: v })), children: [] });

  function fold(line) {
    const out = [];
    while (line.length > 74) { out.push(line.slice(0, 74)); line = ' ' + line.slice(74); }
    out.push(line);
    return out.join('\r\n');
  }
  function serializeProp(p) {
    let head = p.name;
    for (const [k, v] of Object.entries(p.params || {})) {
      const vals = (Array.isArray(v) ? v : [v]).map(x => /[;:,]/.test(x) && !/^".*"$/.test(x) ? '"' + x + '"' : x);
      head += ';' + k + '=' + vals.join(',');
    }
    return fold(head + ':' + String(p.value == null ? '' : p.value).replace(/\r?\n/g, '\\n'));
  }
  function serializeComp(c, out) {
    out.push('BEGIN:' + c.name);
    for (const p of c.props) out.push(serializeProp(p));
    for (const ch of c.children) serializeComp(ch, out);
    out.push('END:' + c.name);
  }
  function serialize(c) { const out = []; serializeComp(c, out); return out.join('\r\n') + '\r\n'; }

  // Props by name
  const prop = (c, name) => c.props.find(p => p.name === name) || null;
  const props = (c, name) => c.props.filter(p => p.name === name);
  const escText = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/[;,]/g, m => '\\' + m).replace(/\r\n|\r|\n/g, '\\n');   // a lone \r is a line break too
  const unescText = s => String(s == null ? '' : s).replace(/\\([\\;,nN])/g, (m, c) => c === 'n' || c === 'N' ? '\n' : c);
  const text = (c, name) => { const p = prop(c, name); return p ? unescText(p.value) : ''; };
  function setProp(c, name, value, params) {
    const i = c.props.findIndex(p => p.name === name);
    const np = { name, params: params || {}, value };
    if (i < 0) c.props.push(np); else c.props[i] = np;
    return np;
  }
  const setText = (c, name, value, params) => value == null || value === '' ? delProp(c, name) : setProp(c, name, escText(value), params);
  function delProp(c, name) { c.props = c.props.filter(p => p.name !== name); }
  const children = (c, name) => c.children.filter(x => x.name === name);

  // -------------------------------------------------------------------
  // Dates and times
  // -------------------------------------------------------------------
  // A wall time: {y, m, d, h, mi, s}. 'wall ms' is Date.UTC of those parts,
  // a number that steps by days, weeks and months without any zone getting
  // in the way; it becomes a real moment only at the end, with zonedToUtc.
  const wallMs = w => Date.UTC(w.y, w.m - 1, w.d, w.h || 0, w.mi || 0, w.s || 0);
  function wallParts(ms) {
    const d = new Date(ms);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), wd: (d.getUTCDay() + 6) % 7 };
  }
  const dayOf = ms => Math.floor(ms / DAY) * DAY;
  const wdOf = ms => (new Date(ms).getUTCDay() + 6) % 7;
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

  // 'YYYYMMDD' or 'YYYYMMDDTHHMMSS[Z]' -> {kind, y, m, d, h, mi, s, utc, tzid}
  function parseDateValue(v, params) {
    const s = String(v || '').trim();
    let m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
    if (m || (params && params.VALUE === 'DATE' && (m = /^(\d{4})(\d{2})(\d{2})/.exec(s)))) return { kind: 'date', y: +m[1], m: +m[2], d: +m[3], h: 0, mi: 0, s: 0 };
    m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(s);
    if (!m) return null;
    const tz = params && params.TZID ? String(params.TZID) : null;
    return { kind: 'datetime', y: +m[1], m: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +(m[6] || 0), utc: !!m[7], tzid: m[7] ? null : tz };
  }
  const dateProp = (c, name) => { const p = prop(c, name); return p ? parseDateValue(p.value, p.params) : null; };
  const fmtWall = w => w.y + pad(w.m) + pad(w.d) + 'T' + pad(w.h) + pad(w.mi) + pad(w.s);
  const fmtDate = w => w.y + pad(w.m) + pad(w.d);
  // A date or date-time as the value and params it is written with.
  function dateValue(dt) {
    if (dt.kind === 'date') return { value: fmtDate(dt), params: { VALUE: 'DATE' } };
    if (dt.utc) return { value: fmtWall(dt) + 'Z', params: {} };
    return { value: fmtWall(dt), params: dt.tzid ? { TZID: dt.tzid } : {} };
  }
  const setDate = (c, name, dt) => { const v = dateValue(dt); return setProp(c, name, v.value, v.params); };
  const utcParts = ms => { const d = new Date(ms); return { kind: 'datetime', y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), utc: true, tzid: null }; };

  // ---- zones, from the browser's own tables ----
  const dtfs = new Map();
  function dtf(tz) {
    let f = dtfs.get(tz);
    if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); dtfs.set(tz, f); }
    return f;
  }
  const validTz = tz => { if (!tz) return false; if (dtfs.has(tz)) return true; try { dtf(tz); return true; } catch { return false; } };
  function utcToZoned(ms, tz) {
    const o = {};
    for (const p of dtf(tz).formatToParts(new Date(ms))) o[p.type] = p.value;
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
  }
  // The zone's offset from UTC at a moment, in ms (east positive).
  function offsetAt(ms, tz) { const w = utcToZoned(ms, tz); return wallMs(w) - Math.floor(ms / 1000) * 1000; }
  // A wall time in a zone -> the moment. Inside a spring-forward gap the
  // later offset is used; in an autumn repeat, the first (daylight) time.
  function zonedToUtc(w, tz) {
    const guess = wallMs(w);
    const off1 = offsetAt(guess, tz);
    let ms = guess - off1;
    const off2 = offsetAt(ms, tz);
    if (off2 !== off1) { const ms2 = guess - off2; if (offsetAt(ms2, tz) === off2) ms = Math.min(ms, ms2); }
    return ms;
  }
  const localTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };

  // Names Windows and old Outlook exports use, so their events land at the
  // right hour rather than floating.
  const TZ_ALIASES = {
    'eastern standard time': 'America/New_York', 'eastern daylight time': 'America/New_York', 'us/eastern': 'America/New_York', 'est': 'America/New_York', 'edt': 'America/New_York',
    'central standard time': 'America/Chicago', 'us/central': 'America/Chicago', 'cst': 'America/Chicago', 'cdt': 'America/Chicago',
    'mountain standard time': 'America/Denver', 'us/mountain': 'America/Denver', 'mst': 'America/Denver', 'mdt': 'America/Denver',
    'us mountain standard time': 'America/Phoenix', 'us/arizona': 'America/Phoenix',
    'pacific standard time': 'America/Los_Angeles', 'us/pacific': 'America/Los_Angeles', 'pst': 'America/Los_Angeles', 'pdt': 'America/Los_Angeles',
    'alaskan standard time': 'America/Anchorage', 'hawaiian standard time': 'Pacific/Honolulu',
    'gmt standard time': 'Europe/London', 'greenwich mean time': 'Europe/London', 'bst': 'Europe/London', 'gmt': 'Europe/London',
    'w. europe standard time': 'Europe/Berlin', 'central europe standard time': 'Europe/Budapest', 'central european standard time': 'Europe/Warsaw',
    'romance standard time': 'Europe/Paris', 'cet': 'Europe/Paris', 'cest': 'Europe/Paris', 'e. europe standard time': 'Europe/Bucharest', 'fle standard time': 'Europe/Helsinki',
    'aus eastern standard time': 'Australia/Sydney', 'tokyo standard time': 'Asia/Tokyo', 'china standard time': 'Asia/Shanghai', 'india standard time': 'Asia/Kolkata',
    'utc': 'UTC', 'z': 'UTC', 'etc/utc': 'UTC', 'etc/gmt': 'UTC',
  };
  // The zone a TZID means: the name itself, an alias, a VTIMEZONE in the same
  // file that names its zone (X-LIC-LOCATION), a name buried in a path
  // (/freeassociation.sourceforge.net/America/Denver), or nothing.
  function resolveTz(tzid, vcal) {
    if (!tzid) return null;
    if (validTz(tzid)) return tzid;
    const low = tzid.toLowerCase();
    if (TZ_ALIASES[low]) return TZ_ALIASES[low];
    if (vcal) for (const z of children(vcal, 'VTIMEZONE')) {
      if (text(z, 'TZID') !== tzid) continue;
      const loc = text(z, 'X-LIC-LOCATION');
      if (validTz(loc)) return loc;
      // No name: work out the offset from the STANDARD block and use a zone with it.
      const std = children(z, 'STANDARD')[0] || children(z, 'DAYLIGHT')[0];
      const off = std && text(std, 'TZOFFSETTO');
      if (off) return { fixed: parseOffset(off) };
    }
    const m = /((?:Africa|America|Antarctica|Asia|Atlantic|Australia|Europe|Indian|Pacific|Etc)\/[A-Za-z_\-+0-9\/]+)/.exec(tzid);
    if (m && validTz(m[1])) return m[1];
    return null;
  }
  const parseOffset = s => { const m = /^([+-])(\d{2})(\d{2})(\d{2})?$/.exec(s.trim()); return m ? (m[1] === '-' ? -1 : 1) * ((+m[2] * 60 + +m[3]) * 60 + (+(m[4] || 0))) * 1000 : 0; };
  const fmtOffset = ms => { const s = Math.round(ms / 1000), a = Math.abs(s); return (s < 0 ? '-' : '+') + pad(Math.floor(a / 3600)) + pad(Math.floor(a / 60) % 60); };

  // A parsed date/time -> the moment, given the file (for odd TZIDs) and the
  // zone used for floating and all-day values.
  function toMs(dt, vcal, tz) {
    if (!dt) return NaN;
    if (dt.kind === 'datetime' && dt.utc) return wallMs(dt);
    if (dt.kind === 'datetime' && dt.tzid) {
      const z = resolveTz(dt.tzid, vcal);
      if (z && typeof z === 'object') return wallMs(dt) - z.fixed;
      if (z) return zonedToUtc(dt, z);
    }
    return zonedToUtc(dt, tz);
  }

  // ---- durations: P1DT2H30M ----
  function parseDuration(s) {
    const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(s || '').trim());
    if (!m) return null;
    const ms = ((+(m[2] || 0) * 7 + +(m[3] || 0)) * 86400 + +(m[4] || 0) * 3600 + +(m[5] || 0) * 60 + +(m[6] || 0)) * 1000;
    return m[1] === '-' ? -ms : ms;
  }
  function fmtDuration(ms) {
    const neg = ms < 0; let s = Math.round(Math.abs(ms) / 1000);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const mi = Math.floor(s / 60); s -= mi * 60;
    let out = (neg ? '-' : '') + 'P';
    if (d && !h && !mi && !s) return out + d + 'D';
    if (d) out += d + 'D';
    out += 'T';
    if (h) out += h + 'H';
    if (mi || (!h && !s)) out += mi + 'M';
    if (s) out += s + 'S';
    return out;
  }

  // -------------------------------------------------------------------
  // Repeat rules
  // -------------------------------------------------------------------
  function parseRRule(s) {
    const r = { FREQ: '', INTERVAL: 1, WKST: 0 };
    for (const part of String(s || '').split(';')) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const k = part.slice(0, eq).toUpperCase(), v = part.slice(eq + 1);
      if (k === 'FREQ') r.FREQ = v.toUpperCase();
      else if (k === 'INTERVAL') r.INTERVAL = Math.max(1, parseInt(v, 10) || 1);
      else if (k === 'COUNT') r.COUNT = Math.max(1, parseInt(v, 10) || 1);
      else if (k === 'UNTIL') r.UNTIL = parseDateValue(v);
      else if (k === 'WKST') r.WKST = Math.max(0, WD.indexOf(v.toUpperCase()));
      else if (k === 'BYDAY') r.BYDAY = v.split(',').map(d => { const m = /^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/i.exec(d.trim()); return m ? { n: m[1] ? parseInt(m[1], 10) : 0, day: WD.indexOf(m[2].toUpperCase()) } : null; }).filter(Boolean);
      else if (['BYMONTHDAY', 'BYMONTH', 'BYSETPOS', 'BYYEARDAY', 'BYWEEKNO', 'BYHOUR', 'BYMINUTE'].includes(k)) r[k] = v.split(',').map(Number).filter(n => !isNaN(n));
    }
    return r;
  }
  function fmtRRule(r) {
    const parts = ['FREQ=' + r.FREQ];
    if (r.INTERVAL && r.INTERVAL !== 1) parts.push('INTERVAL=' + r.INTERVAL);
    if (r.COUNT) parts.push('COUNT=' + r.COUNT);
    if (r.UNTIL) parts.push('UNTIL=' + dateValue(r.UNTIL).value);
    if (r.BYDAY && r.BYDAY.length) parts.push('BYDAY=' + r.BYDAY.map(b => (b.n ? b.n : '') + WD[b.day]).join(','));
    if (r.BYMONTHDAY && r.BYMONTHDAY.length) parts.push('BYMONTHDAY=' + r.BYMONTHDAY.join(','));
    if (r.BYMONTH && r.BYMONTH.length) parts.push('BYMONTH=' + r.BYMONTH.join(','));
    if (r.BYSETPOS && r.BYSETPOS.length) parts.push('BYSETPOS=' + r.BYSETPOS.join(','));
    if (r.WKST) parts.push('WKST=' + WD[r.WKST]);
    return parts.join(';');
  }

  // The days of one month that a MONTHLY or YEARLY rule picks.
  function monthDays(y, m, rule, start) {
    const n = daysInMonth(y, m), first = Date.UTC(y, m - 1, 1);
    let days = [];
    if (rule.BYDAY && rule.BYDAY.length) {
      const seen = {}, total = {};
      for (let d = 1; d <= n; d++) total[wdOf(first + (d - 1) * DAY)] = (total[wdOf(first + (d - 1) * DAY)] || 0) + 1;
      for (let d = 1; d <= n; d++) {
        const ms = first + (d - 1) * DAY, wd = wdOf(ms);
        seen[wd] = (seen[wd] || 0) + 1;
        for (const b of rule.BYDAY) {
          if (b.day !== wd) continue;
          if (b.n === 0 || (b.n > 0 && seen[wd] === b.n) || (b.n < 0 && seen[wd] === total[wd] + b.n + 1)) { days.push(ms); break; }
        }
      }
      if (rule.BYMONTHDAY && rule.BYMONTHDAY.length) { const want = new Set(rule.BYMONTHDAY.map(x => x > 0 ? x : n + x + 1)); days = days.filter(ms => want.has(wallParts(ms).d)); }
    } else if (rule.BYMONTHDAY && rule.BYMONTHDAY.length) {
      for (const x of rule.BYMONTHDAY) { const d = x > 0 ? x : n + x + 1; if (d >= 1 && d <= n) days.push(first + (d - 1) * DAY); }
    } else if (start.d <= n) days.push(first + (start.d - 1) * DAY);
    return days;
  }
  function setPos(days, pos) {
    const out = [];
    for (const p of pos) { const i = p > 0 ? p - 1 : days.length + p; if (days[i] != null) out.push(days[i]); }
    return out.sort((a, b) => a - b);
  }
  const addMonths = (y, m, k) => { const t = (y * 12 + (m - 1)) + k; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; };

  // Every wall time the rule produces from DTSTART on, in order. `from` (a
  // wall ms) lets it skip straight to the period holding that moment when
  // there is no COUNT to keep.
  function* ruleTimes(rule, startWall, from) {
    const S = wallParts(startWall);
    const timeMs = ((S.h * 60 + S.mi) * 60 + S.s) * 1000;
    const startDay = dayOf(startWall);
    const iv = rule.INTERVAL || 1;
    const inMonth = ms => !rule.BYMONTH || !rule.BYMONTH.length || rule.BYMONTH.includes(wallParts(ms).m);
    const dailyOk = ms => {
      if (!inMonth(ms)) return false;
      const w = wallParts(ms);
      if (rule.BYDAY && rule.BYDAY.length && !rule.BYDAY.some(b => b.day === w.wd)) return false;
      if (rule.BYMONTHDAY && rule.BYMONTHDAY.length) { const n = daysInMonth(w.y, w.m); if (!rule.BYMONTHDAY.some(x => (x > 0 ? x : n + x + 1) === w.d)) return false; }
      return true;
    };
    let k = 0;
    if (from != null && !rule.COUNT && from > startWall) {
      const gap = from - startWall;
      if (rule.FREQ === 'DAILY') k = Math.max(0, Math.floor(gap / (iv * DAY)) - 1);
      else if (rule.FREQ === 'WEEKLY') k = Math.max(0, Math.floor(gap / (iv * 7 * DAY)) - 1);
      else if (rule.FREQ === 'MONTHLY') { const F = wallParts(from); k = Math.max(0, Math.floor(((F.y * 12 + F.m) - (S.y * 12 + S.m)) / iv) - 1); }
      else if (rule.FREQ === 'YEARLY') k = Math.max(0, Math.floor((wallParts(from).y - S.y) / iv) - 1);
    }
    const weekStart = ms => { const w = wdOf(ms), wk = rule.WKST || 0; return dayOf(ms) - ((w - wk + 7) % 7) * DAY; };
    for (let guard = 0; guard < 200000; guard++, k++) {
      let days = [];
      if (rule.FREQ === 'DAILY') { const d = startDay + k * iv * DAY; if (dailyOk(d)) days = [d]; }
      else if (rule.FREQ === 'WEEKLY') {
        const ws = weekStart(startDay) + k * iv * 7 * DAY;
        const set = rule.BYDAY && rule.BYDAY.length ? rule.BYDAY.map(b => b.day) : [S.wd];
        for (let i = 0; i < 7; i++) { const d = ws + i * DAY; if (set.includes(wdOf(d)) && inMonth(d)) days.push(d); }
      } else if (rule.FREQ === 'MONTHLY') {
        const { y, m } = addMonths(S.y, S.m, k * iv);
        if (rule.BYMONTH && rule.BYMONTH.length && !rule.BYMONTH.includes(m)) continue;
        days = monthDays(y, m, rule, S);
      } else if (rule.FREQ === 'YEARLY') {
        const y = S.y + k * iv;
        for (const m of (rule.BYMONTH && rule.BYMONTH.length ? rule.BYMONTH : [S.m])) days.push(...monthDays(y, m, rule, S));
        days.sort((a, b) => a - b);
      } else return;
      if (rule.BYSETPOS && rule.BYSETPOS.length) days = setPos(days, rule.BYSETPOS);
      for (const d of days) yield d + timeMs;
    }
  }

  // -------------------------------------------------------------------
  // Occurrences of every event in a VCALENDAR between two moments
  // -------------------------------------------------------------------
  // Each occurrence: {uid, start, end (ms), allDay, startDate, endDate
  // ('YYYY-MM-DD', end exclusive for all-day), tzid, recurring, rid (the
  // RECURRENCE-ID this occurrence would carry), master, comp (the VEVENT
  // that describes it: an override or the master), summary, location,
  // description, url, transp, status, alarms, attendees, organizer, travel}.
  function expand(vcal, from, to, tz) {
    tz = tz || localTz();
    const out = [];
    const events = children(vcal, 'VEVENT');
    const overrides = new Map();
    for (const e of events) {
      const rid = dateProp(e, 'RECURRENCE-ID');
      if (!rid) continue;
      const uid = text(e, 'UID');
      if (!overrides.has(uid)) overrides.set(uid, []);
      overrides.get(uid).push({ comp: e, at: toMs(rid, vcal, tz) });
    }
    const dateKey = (dt, ms) => dt && dt.kind === 'date' ? dt.y + '-' + pad(dt.m) + '-' + pad(dt.d) : (() => { const w = utcToZoned(ms, tz); return w.y + '-' + pad(w.m) + '-' + pad(w.d); })();
    for (const e of events) {
      if (prop(e, 'RECURRENCE-ID')) continue;
      const uid = text(e, 'UID');
      const ds = dateProp(e, 'DTSTART');
      if (!ds) continue;
      const allDay = ds.kind === 'date';
      const startMs = toMs(ds, vcal, tz);
      if (isNaN(startMs)) continue;
      const de = dateProp(e, 'DTEND'), dur = prop(e, 'DURATION');
      let length = de ? toMs(de, vcal, tz) - startMs : dur ? parseDuration(dur.value) || 0 : allDay ? DAY : 0;
      if (length < 0) length = 0;
      const wallLength = allDay ? Math.max(1, Math.round(length / DAY)) : 0;
      const info = describe(e, vcal, tz);
      const overs = overrides.get(uid) || [];
      const replaced = new Set(overs.map(o => o.at));
      const mk = (ms, wall, comp) => {
        let s = ms, len = length, dsHere = ds;
        if (comp !== e) {
          const d2 = dateProp(comp, 'DTSTART'); const e2 = dateProp(comp, 'DTEND'); const du2 = prop(comp, 'DURATION');
          if (d2) { s = toMs(d2, vcal, tz); dsHere = d2; len = e2 ? toMs(e2, vcal, tz) - s : du2 ? parseDuration(du2.value) || 0 : d2.kind === 'date' ? DAY : length; if (len < 0) len = 0; }
        }
        const isAllDay = dsHere.kind === 'date';
        const end = s + len;
        if (!(end > from && s < to) && !(len === 0 && s >= from && s < to)) return null;
        const o = Object.assign({}, comp === e ? info : describe(comp, vcal, tz), {
          uid, start: s, end, allDay: isAllDay, tzid: dsHere.tzid || (dsHere.utc ? 'UTC' : null), master: e, comp, recurring: !!(prop(e, 'RRULE') || props(e, 'RDATE').length),
          rid: wall ? Object.assign({}, ds, wallParts(wall), { kind: ds.kind }) : null,
        });
        if (isAllDay) {
          const sw = utcToZoned(s, tz);
          o.startDate = sw.y + '-' + pad(sw.m) + '-' + pad(sw.d);
          const n = comp === e ? wallLength : Math.max(1, Math.round(len / DAY));
          const ew = wallParts(wallMs(sw) + n * DAY);
          o.endDate = ew.y + '-' + pad(ew.m) + '-' + pad(ew.d);
        } else { o.startDate = dateKey(null, s); o.endDate = dateKey(null, Math.max(s, end - 1)); }
        return o;
      };
      const rr = prop(e, 'RRULE');
      const rdates = props(e, 'RDATE').flatMap(p => String(p.value).split(',').map(v => parseDateValue(v.split('/')[0], p.params)).filter(Boolean));
      const exdates = new Set(props(e, 'EXDATE').flatMap(p => String(p.value).split(',').map(v => parseDateValue(v, p.params)).filter(Boolean)).map(d => toMs(d, vcal, tz)));
      if (!rr && !rdates.length) { const o = mk(startMs, null, e); if (o) out.push(o); continue; }
      // The wall clock of DTSTART: repeats step in that clock, then each
      // one becomes a moment in the event's own zone.
      const zone = ds.tzid ? resolveTz(ds.tzid, vcal) : null;
      const wallOf = ms => ds.utc ? ms : (zone && typeof zone === 'object') ? ms + zone.fixed : wallMs(utcToZoned(ms, zone || tz));
      const msOf = wall => ds.utc ? wall : (zone && typeof zone === 'object') ? wall - zone.fixed : allDay ? zonedToUtc(wallParts(wall), tz) : zonedToUtc(wallParts(wall), zone || tz);
      const startWall = wallMs(ds);
      const rule = rr ? parseRRule(rr.value) : null;
      const until = rule && rule.UNTIL ? (rule.UNTIL.kind === 'date' ? zonedToUtc(Object.assign({}, rule.UNTIL, { h: 23, mi: 59, s: 59 }), zone || tz) : toMs(rule.UNTIL, vcal, zone || tz)) : Infinity;
      const seen = new Set();
      let count = 0;
      const take = (wall, fromRule) => {
        const ms = msOf(wall);
        if (fromRule && ms > until) return false;
        if (seen.has(ms)) return true;
        seen.add(ms);
        if (fromRule) count++;
        if (exdates.has(ms) || replaced.has(ms)) return true;
        const o = mk(ms, wall, e); if (o) out.push(o);
        return true;
      };
      if (rule && rule.FREQ) {
        take(startWall, true);
        const fromWall = wallOf(from) - length - DAY;
        for (const wall of ruleTimes(rule, startWall, fromWall)) {
          if (wall <= startWall) continue;
          if (rule.COUNT && count >= rule.COUNT) break;
          if (!take(wall, true)) break;
          if (msOf(wall) >= to) break;
        }
      } else take(startWall, false);
      for (const rd of rdates) take(wallMs(rd), false);
      for (const ov of overs) { const o = mk(ov.at, wallOf(ov.at), ov.comp); if (o) out.push(o); }
    }
    out.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    return out;
  }

  // The parts of a VEVENT the app shows.
  function describe(e, vcal, tz) {
    const alarms = children(e, 'VALARM').map(a => {
      const t = prop(a, 'TRIGGER');
      if (!t) return null;
      const rel = t.params && t.params.RELATED === 'END' ? 'end' : 'start';
      if (t.params && t.params.VALUE === 'DATE-TIME' || /^\d{8}T/.test(t.value)) return { at: toMs(parseDateValue(t.value, t.params), vcal, tz), comp: a };
      const d = parseDuration(t.value);
      return d == null ? null : { minutes: Math.round(d / 60000), related: rel, comp: a };
    }).filter(Boolean);
    const attendees = props(e, 'ATTENDEE').map(p => ({ email: String(p.value).replace(/^mailto:/i, ''), name: p.params.CN || '', status: p.params.PARTSTAT || '', role: p.params.ROLE || '' }));
    const org = prop(e, 'ORGANIZER');
    const trav = prop(e, 'X-APPLE-TRAVEL-DURATION');
    return {
      summary: text(e, 'SUMMARY'), location: text(e, 'LOCATION'), description: text(e, 'DESCRIPTION'), url: text(e, 'URL'),
      transp: (text(e, 'TRANSP') || 'OPAQUE').toUpperCase(), status: (text(e, 'STATUS') || '').toUpperCase(),
      alarms, attendees, organizer: org ? { email: String(org.value).replace(/^mailto:/i, ''), name: org.params.CN || '' } : null,
      travel: trav ? Math.round((parseDuration(trav.value) || 0) / 60000) : 0,
    };
  }

  // -------------------------------------------------------------------
  // VTIMEZONE for a zone, from the browser's tables
  // -------------------------------------------------------------------
  function tzName(tz, ms) {
    try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date(ms)).find(p => p.type === 'timeZoneName').value; } catch { return ''; }
  }
  function vtimezone(tz, year) {
    year = year || new Date().getUTCFullYear();
    const z = component('VTIMEZONE', [['TZID', tz]]);
    const jan = offsetAt(Date.UTC(year, 0, 1, 12), tz), jul = offsetAt(Date.UTC(year, 6, 1, 12), tz);
    const block = (kind, from, to, wall, rule, nameAt) => {
      const b = component(kind, [['DTSTART', fmtWall(wall)], ['TZOFFSETFROM', fmtOffset(from)], ['TZOFFSETTO', fmtOffset(to)]]);
      if (rule) b.props.push({ name: 'RRULE', params: {}, value: rule });
      const n = tzName(tz, nameAt); if (n) b.props.push({ name: 'TZNAME', params: {}, value: n });
      return b;
    };
    if (jan === jul) { z.children.push(block('STANDARD', jan, jan, { y: 1970, m: 1, d: 1, h: 0, mi: 0, s: 0 }, null, Date.UTC(year, 0, 1, 12))); return z; }
    // Find each change of offset in the year, to the minute.
    const trans = [];
    let prev = offsetAt(Date.UTC(year, 0, 1, 0), tz);
    for (let d = 1; d <= 366; d++) {
      const t = Date.UTC(year, 0, d + 1, 0);
      if (t > Date.UTC(year + 1, 0, 1)) break;
      const o = offsetAt(t, tz);
      if (o === prev) continue;
      let lo = t - DAY, hi = t;
      while (hi - lo > 60000) { const mid = lo + Math.floor((hi - lo) / 2 / 60000) * 60000; if (offsetAt(mid, tz) === prev) lo = mid; else hi = mid; }
      trans.push({ at: hi, from: prev, to: o }); prev = o;
    }
    for (const t of trans) {
      const wall = wallParts(t.at + t.from);                      // the clock time at which the change happens
      const n = daysInMonth(wall.y, wall.m);
      const nth = Math.ceil(wall.d / 7), last = wall.d + 7 > n;
      const rule = 'FREQ=YEARLY;BYMONTH=' + wall.m + ';BYDAY=' + (last ? '-1' : nth) + WD[wall.wd];
      z.children.push(block(t.to > t.from ? 'DAYLIGHT' : 'STANDARD', t.from, t.to, wall, rule, t.at + 3600e3));
    }
    return z;
  }
  // Adds a VTIMEZONE for every TZID the events use and none is there for.
  function ensureTimezones(vcal, year) {
    const have = new Set(children(vcal, 'VTIMEZONE').map(z => text(z, 'TZID')));
    const need = new Set();
    for (const e of children(vcal, 'VEVENT')) for (const p of e.props) if (p.params && p.params.TZID && !have.has(p.params.TZID) && validTz(p.params.TZID)) need.add(p.params.TZID);
    const zones = [...need].map(tz => vtimezone(tz, year));
    if (zones.length) vcal.children.unshift(...zones);
    return vcal;
  }

  // -------------------------------------------------------------------
  // Words for a rule: "Every 2 weeks on Monday and Wednesday"
  // -------------------------------------------------------------------
  const DAYNAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const ORD = n => ({ 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', '-1': 'last', '-2': 'second to last' })[n] || (n + 'th');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const list = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const dayOrd = d => d + (d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th');
  function ruleText(rule, start, fmtDay) {
    if (typeof rule === 'string') rule = parseRRule(rule);
    if (!rule || !rule.FREQ) return '';
    const iv = rule.INTERVAL || 1;
    const unit = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[rule.FREQ] || 'time';
    let s = iv === 1 ? 'Every ' + unit : 'Every ' + iv + ' ' + unit + 's';
    const byday = rule.BYDAY || [];
    if (rule.FREQ === 'WEEKLY') {
      const days = byday.length ? byday.map(b => b.day) : (start ? [start.wd != null ? start.wd : wdOf(wallMs(start))] : []);
      const sorted = [...new Set(days)].sort((a, b) => a - b);
      if (sorted.length === 7) s = iv === 1 ? 'Every day' : s + ' on every day';
      else if (sorted.join() === '0,1,2,3,4' && iv === 1) s = 'Every weekday';
      else if (sorted.length) s += ' on ' + list(sorted.map(d => DAYNAMES[d]));
    } else if (rule.FREQ === 'MONTHLY') {
      if (byday.length) s += ' on the ' + list(byday.map(b => (b.n ? ORD(b.n) + ' ' : '') + DAYNAMES[b.day]));
      else if (rule.BYMONTHDAY && rule.BYMONTHDAY.length) s += ' on the ' + list(rule.BYMONTHDAY.map(d => d < 0 ? (d === -1 ? 'last day' : ORD(d) + ' day') : dayOrd(d)));
      else if (start) s += ' on the ' + dayOrd(start.d);
    } else if (rule.FREQ === 'YEARLY') {
      const months = rule.BYMONTH && rule.BYMONTH.length ? rule.BYMONTH : start ? [start.m] : [];
      if (byday.length) s += ' on the ' + list(byday.map(b => (b.n ? ORD(b.n) + ' ' : '') + DAYNAMES[b.day])) + (months.length ? ' of ' + list(months.map(m => MONTHS[m - 1])) : '');
      else if (start && months.length === 1) s += ' on ' + start.d + ' ' + MONTHS[months[0] - 1];
      else if (months.length) s += ' in ' + list(months.map(m => MONTHS[m - 1]));
    } else if (rule.FREQ === 'DAILY' && byday.length) s += ' on ' + list(byday.map(b => DAYNAMES[b.day]));
    if (rule.COUNT) s += ', ' + rule.COUNT + ' time' + (rule.COUNT === 1 ? '' : 's');
    else if (rule.UNTIL) s += ', until ' + (fmtDay ? fmtDay(rule.UNTIL) : rule.UNTIL.d + ' ' + MONTHS[rule.UNTIL.m - 1] + ' ' + rule.UNTIL.y);
    return s;
  }

  const uid = () => {
    const hex = n => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
    return hex(8) + '-' + hex(4) + '-4' + hex(3) + '-' + hex(4) + '-' + hex(12);
  };
  const stamp = ms => fmtWall(utcParts(ms == null ? Date.now() : ms)) + 'Z';

  const api = {
    WD, DAY, DAYNAMES, MONTHS,
    parse, parseAll, serialize, component, prop, props, text, setProp, setText, delProp, children, escText, unescText,
    parseDateValue, dateValue, setDate, dateProp, fmtWall, fmtDate, utcParts, wallMs, wallParts,
    validTz, resolveTz, utcToZoned, zonedToUtc, offsetAt, localTz, toMs, parseDuration, fmtDuration,
    parseRRule, fmtRRule, ruleTimes, expand, describe, vtimezone, ensureTimezones, ruleText, uid, stamp,
  };
  root.AllisonICal = api;
})(typeof window !== 'undefined' ? window : globalThis);
