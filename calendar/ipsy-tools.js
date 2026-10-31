"use strict";

// Ipsy's tools in Calendar (in both its designs). Claude asks for them by name through
// functions/calendar/api (IPSY_CLIENT_TOOLS describes them to it); they run here, on the phone,
// against the same events the app has loaded and through the same calls to the app's server, and
// what they return goes back to Claude.
//
//   window.CalendarIpsy(app) -> the options for AllisonOS.ipsy.mount (tools, label, context, words)
//   app: the app's own pieces (calendar/app.js passes them): I (ical.js), TZ, st, settings, LAYER,
//        eventsOn, matches, refresh, rebuild, render, goTo, writeEvent, writeItem, deleteFile,
//        written, formFrom, ymd, dayMs, addDays, today, fmtTime, longDate, medDate, wxFor,
//        busyPill, toast, errText, calendarName, screen
//
// The Family calendar is the whole family's, so changes are held to these rules:
// - Reading is free: what the app shows (the Family calendar and the layers that are on, but not
//   Drinks, which is health data the app keeps off its own storage).
// - Every change asks first: confirm() shows exactly what will happen (title, day, start and end,
//   all day or not, repeat, calendar, and for a change before -> after), and nothing is written
//   until Yes is tapped. No: nothing changes, and Claude is told so.
// - One event per change (no bulk tools), and at most MAX_ASKS changes asked about in one question
//   (counted here; the count starts again when a question is sent, which is when context() runs).
// - Repeating events are read only: no change or delete of a series or one occurrence of it.
// - Only the Family calendar is written, and only through the app's own calls (writeEvent,
//   writeItem, deleteFile: PUT and DELETE with If-Match), so a change made elsewhere first is
//   caught (412, 'changed') and reported, never written over. Undo goes through the same calls.
// - Private events (the Private switch in an event, on every phone) and private items in the layers (a
//   private note or booking) are hidden: left out of everything Ipsy reads, and Family ones can't be
//   changed. free_time still counts a private event's time as busy, as "Private", and nothing more.
// - Gmail: emails behind private Travel bookings are left out (Travel's layer names them), and Gmail can
//   be turned off for Ipsy altogether (Settings > AI helper > Ipsy can search Gmail).
window.CalendarIpsy = function (app) {
  const I = app.I, TZ = app.TZ, st = app.st;
  const MIN = 60e3, D = 864e5;
  const MAX_ASKS = 5;
  const pad = n => String(n).padStart(2, '0');
  // Text from the calendar on one line (a title can't add lines to a Yes/No card), no ** marks.
  const line = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\s]+/g, ' ').replace(/\*\*/g, '').trim().slice(0, n);
  const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);
  const fail = msg => { throw new Error(msg); };
  const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const AT_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;
  const isDay = s => { const m = DAY_RE.exec(s || ''); if (!m) return false; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]; };
  // 'YYYY-MM-DDTHH:MM' (or with a space) in the phone's zone -> ms
  function atMs(s) {
    const m = AT_RE.exec(String(s || '').trim());
    if (!m || !isDay(m[1] + '-' + m[2] + '-' + m[3]) || +m[4] > 23 || +m[5] > 59) return NaN;
    return I.zonedToUtc({ y: +m[1], m: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: 0 }, TZ);
  }
  const hm = ms => { const w = I.utcToZoned(ms, TZ); return pad(w.h) + ':' + pad(w.mi); };
  const wallStr = ms => app.ymd(ms) + ' ' + hm(ms);
  const calName = () => app.calendarName();
  const KIND_KEY = { family: 'family', holiday: 'holidays', note: 'notes', travel: 'travel', mail: 'mail', fitness: 'fitness', meals: 'meals', orders: 'orders', school: 'school', news: 'news' };
  const fileOf = id => String(id || '').split('|')[0];

  // ---- what Ipsy may read: the Family calendar and the layers that are on (never Drinks) ----
  const readable = () => st.occ.filter(x => KIND_KEY[x.kind] && !app.isPrivate(x));
  const loaded = () => st.win ? { from: app.ymd(st.win.from), to: app.ymd(st.win.to - 1) } : null;
  const calOf = x => x.kind === 'family' ? calName() : app.LAYER[x.kind].name;
  const idOf = x => x.kind === 'family' ? x.name : x.id;
  const isRepeating = x => !!(x.o && x.o.recurring);
  function brief(x) {
    const b = { id: idOf(x), calendar: calOf(x), title: x.title };
    if (x.allDay) { b.all_day = true; b.start = x.startDate; b.end = app.addDays(x.endDate, -1); }
    else { b.start = wallStr(x.start); b.end = wallStr(x.end); }
    const where = x.kind === 'family' ? x.o.location : x.sub;
    if (where) b[x.kind === 'family' ? 'location' : 'detail'] = clip(where, 160);
    if (x.kind !== 'family') b.read_only = 'from ' + app.LAYER[x.kind].name;
    else if (isRepeating(x)) { b.repeats = true; b.read_only = 'repeating'; }
    if (x.done) b.done = true;
    return b;
  }
  // Waits for the events to be loaded (or checked again, at most every 20 seconds, as the app does).
  async function fresh() { try { await app.refresh(); } catch {} }
  // Moves the calendar to a day when it isn't in the window the app has loaded, so it loads there.
  async function cover(from, to) {
    const w = st.win;
    if (w && app.dayMs(from) >= w.from && app.dayMs(app.addDays(to, 1)) <= w.to) return true;
    app.goTo(from);
    try { await app.refresh({ force: true }); } catch {}
    const v = st.win;
    return !!(v && app.dayMs(from) >= v.from && app.dayMs(app.addDays(to, 1)) <= v.to);
  }
  const overlaps = (x, a, b) => x.allDay ? (x.startDate < b && x.endDate > a) : (x.end > app.dayMs(a) && x.start < app.dayMs(b)) || (x.start === x.end && x.start >= app.dayMs(a) && x.start < app.dayMs(b));

  // ---- the words on a Yes/No card ----
  const dayWords = s => app.longDate(s);
  function whenLines(f) {
    // f: {allDay, start, end} (ms; all-day end is the day after the last)
    if (f.allDay) {
      const first = app.ymd(f.start), last = app.addDays(app.ymd(f.end), -1);
      return { day: last > first ? app.medDate(first) + ' to ' + app.medDate(last) : dayWords(first), start: 'All day', end: 'All day', allDay: 'Yes' };
    }
    const d1 = app.ymd(f.start), d2 = app.ymd(f.end);
    return { day: dayWords(d1), start: app.fmtTime(f.start), end: d2 === d1 ? app.fmtTime(f.end) : app.medDate(d2) + ', ' + app.fmtTime(f.end), allDay: 'No' };
  }
  const RULES = { never: '', daily: 'FREQ=DAILY', weekly: 'FREQ=WEEKLY', every_2_weeks: 'FREQ=WEEKLY;INTERVAL=2', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' };
  function repeatWords(f) {
    if (!f.rule) return 'Never';
    const p = I.utcToZoned(f.start, TZ);
    let s = I.ruleText(f.rule, Object.assign({ kind: 'date', h: 0, mi: 0, s: 0 }, p, { wd: I.wallParts(Date.UTC(p.y, p.m - 1, p.d)).wd }));
    if (f.ruleEnd && f.ruleEnd.type === 'date') s += ', until ' + app.medDate(f.ruleEnd.date);
    return s;
  }
  const where = () => calName() + ' (iCloud, shared with the family)';
  function card(head, f, before) {
    const now = whenLines(f), was = before ? whenLines(before) : null;
    const row = (label, a, b) => '- ' + label + ': ' + (b != null && b !== a ? line(b, 120) + ' → ' + line(a, 120) : line(a, 120));
    const out = ['**' + head + '**',
      row('Title', f.title || 'New Event', before && (before.title || 'New Event')),
      row('Day', now.day, was && was.day),
      row('Start', now.start, was && was.start),
      row('End', now.end, was && was.end),
      row('All day', now.allDay, was && was.allDay),
      row('Repeat', repeatWords(f), before && repeatWords(before)),
      '- Calendar: ' + where()];
    if (f.location || (before && before.location)) out.push(row('Place', f.location || '(none)', before && (before.location || '(none)')));
    if (f.notes || (before && before.notes)) out.push(row('Notes', f.notes ? line(f.notes, 100) : '(none)', before && (before.notes ? line(before.notes, 100) : '(none)')));
    return out.join('\n');
  }

  // ---- the rules for a change ----
  let asked = 0;   // changes asked about in this question
  function canAsk() {
    if (asked >= MAX_ASKS) return 'That would be more than ' + MAX_ASKS + ' changes in one question, so Ipsy didn’t ask and nothing more was changed. Tell the person which changes are left and ask them to ask again for those.';
    if (st.api !== 'ok') return 'The Family calendar can’t be reached right now (' + app.errText({ code: st.api === 'off' ? 'unavailable' : st.api === 'unconfigured' ? 'no-account' : st.apiError || 'unreachable' }) + '), so nothing can be changed.';
    return '';
  }
  // The Family event behind an id, if Ipsy may change it; else why not.
  function target(id) {
    const name = fileOf(id);
    const item = st.items.get(name);
    if (!item) {
      const x = readable().find(o => o.id === id || idOf(o) === id);
      if (x && x.kind !== 'family') return { why: 'That is from ' + app.LAYER[x.kind].name + ', not the Family calendar. Ipsy can only change Family events; change it in ' + app.LAYER[x.kind].name + '.' };
      return { why: 'There is no Family event with id ' + line(id, 80) + ' loaded. Use find_events to get its id.' };
    }
    const comps = I.children(item.cal, 'VEVENT');
    const x = st.occ.find(o => o.kind === 'family' && o.name === name);
    if (x && app.isPrivate(x)) return { why: 'There is no Family event with id ' + line(id, 80) + ' loaded. Use find_events to get its id.' };
    if (comps.length !== 1 || (x && isRepeating(x)) || comps.some(c => I.prop(c, 'RRULE') || I.props(c, 'RDATE').length || I.prop(c, 'RECURRENCE-ID')))
      return { why: 'That is a repeating event. Ipsy doesn’t change or delete repeating events, or one occurrence of them: the person can do it in the app (tap the event, then Edit or Delete Event), where it asks whether they mean this event only, all future events or all events. Nothing was changed.' };
    if (!x) return { why: 'That event isn’t in the days the app has loaded. Use find_events with its dates first.' };
    if (!item.etag) { app.refresh({ force: true }); return { why: 'The app hasn’t yet learned this event’s version from iCloud, so it can’t check nobody else changed it. It is checking now: try again in a moment.' }; }
    return { x, item, name };
  }
  const why = e => e && e.code === 'changed'
    ? 'Someone changed it elsewhere first (on a phone or in iCloud), so nothing was written over. The app has loaded the latest version.'
    : app.errText(e);
  const NO = { declined: true, note: 'The person said no, so nothing was changed. Don’t ask again unless they ask for it.' };

  // Form fields from what Claude gave: {allDay, start, end} in ms (all-day end: the day after the last).
  function times(q, base) {
    const allDay = q.all_day != null ? !!q.all_day : base ? base.allDay : false;
    let start, end;
    if (allDay) {
      const s1 = q.start != null ? String(q.start).trim().slice(0, 10) : base ? app.ymd(base.start) : '';
      if (!isDay(s1)) fail('start must be a day, YYYY-MM-DD, for an all-day event.');
      // Without an end: the days it had (a change), else one day.
      const bFirst = base && app.ymd(base.start), bLast = base && (base.allDay ? app.addDays(app.ymd(base.end), -1) : app.ymd(Math.max(base.start, base.end - 1)));
      let last = q.end != null ? String(q.end).trim().slice(0, 10) : null;
      if (last == null) last = !base ? s1 : q.start == null ? bLast : app.addDays(s1, Math.round((app.dayMs(bLast) - app.dayMs(bFirst)) / D));
      if (!isDay(last) || last < s1) fail('end must be the last day, YYYY-MM-DD, on or after start.');
      if (app.dayMs(last) - app.dayMs(s1) > 62 * D) fail('An all-day event Ipsy adds can be at most two months long.');
      start = app.dayMs(s1); end = app.dayMs(app.addDays(last, 1));
    } else {
      if (q.start == null && (!base || base.allDay)) fail('Give start (YYYY-MM-DDTHH:MM) for an event with times.');
      start = q.start != null ? atMs(q.start) : base.start;
      if (isNaN(start)) fail('start must be YYYY-MM-DDTHH:MM, in the phone’s time zone.');
      end = q.end != null ? atMs(q.end) : base && !base.allDay ? start + (base.end - base.start) : start + app.settings.duration * MIN;
      if (isNaN(end)) fail('end must be YYYY-MM-DDTHH:MM, in the phone’s time zone.');
      if (end <= start) fail('end must be after start.');
      if (end - start > 7 * D) fail('An event with times Ipsy adds can be at most a week long.');
    }
    if (Math.abs(start - Date.now()) > 5 * 366 * D) fail('That date is more than five years away.');
    return { allDay, start, end };
  }

  // Gmail: off for Ipsy (Settings), and the emails behind private Travel bookings (from Travel's layer).
  const PV = window.AllisonOS && window.AllisonOS.ipsy && window.AllisonOS.ipsy.privacy;
  const gmailOn = () => !PV || PV.gmail('calendar');
  const guard = () => {
    const data = app.layerData('allison-travel-v1', 'travel'), list = data && Array.isArray(data.bookings) ? data.bookings : [];
    return PV ? PV.guard(list.filter(b => b && b.private).map(b => ({ msgId: b.msgId, threadId: b.threadId, words: [b.conf, b.airlineCode && b.flightNo ? b.airlineCode + b.flightNo : ''] }))) : { hides: () => false };
  };
  const gmailModule = import(new URL('../calendar/ipsy-gmail.js', location.href).href);
  gmailModule.then(m => m.mount()).catch(() => {});
  const tools = {
    async search_gmail(q, ctx) {
      if (!gmailOn()) fail(PV.gmailOff('Calendar'));
      const r = await (await gmailModule).tools.search_gmail(q, ctx), c = r && r.content;
      if (!c || !Array.isArray(c.emails)) return r;
      const g = guard(), emails = c.emails.filter(m => !g.hides({ id: m.message_id, threadId: m.thread_id, subject: m.subject, from: m.from, snippet: m.snippet })), hidden = c.emails.length - emails.length;
      return { ...r, content: { ...c, emails, shown: emails.length, ...(hidden ? { privateEmailsNotShown: hidden } : {}) } };
    },
    async read_email(q, ctx) {
      if (!gmailOn()) fail(PV.gmailOff('Calendar'));
      const r = await (await gmailModule).tools.read_email(q, ctx), c = r && r.content;
      if (c && c.message_id && guard().hides({ id: c.message_id, threadId: c.thread_id, subject: c.subject, from: c.from, snippet: c.snippet }, c.text))
        fail('That email is about something the person marked Private, so Ipsy can’t read it.');
      return r;
    },
    async find_events(q) {
      await fresh();
      const words = line(q.query, 200).toLowerCase().split(/\s+/).filter(Boolean);
      let from = isDay(q.from) ? q.from : null, to = isDay(q.to) ? q.to : null;
      const all = !from && !to && words.length && st.win;   // words alone: everything loaded
      if (all) { from = loaded().from; to = loaded().to; }
      from = from || app.today(); to = to || app.addDays(from, 13);
      if (to < from) fail('to is before from.');
      if (!all && app.dayMs(to) - app.dayMs(from) > 400 * D) fail('Ask for at most about a year at a time.');
      const ok = await cover(from, to);
      const cals = Array.isArray(q.calendars) ? q.calendars.filter(c => Object.values(KIND_KEY).includes(c)) : [];
      const limit = Math.max(1, Math.min(200, Number.isInteger(q.limit) ? q.limit : 60));
      const end = app.addDays(to, 1);
      const list = readable().filter(x => overlaps(x, from, end) && (!cals.length || cals.includes(KIND_KEY[x.kind])) && (!words.length || app.matches(x, words)));
      const priv = st.occ.filter(x => KIND_KEY[x.kind] && app.isPrivate(x) && overlaps(x, from, end)).length;
      const out = { from, to, found: list.length, shown: Math.min(limit, list.length), events: list.slice(0, limit).map(brief), ...(priv ? { privateEventsNotShown: priv } : {}) };
      if (!ok) out.note = 'Only ' + (loaded() ? loaded().from + ' to ' + loaded().to : 'what was seen last') + ' could be loaded' + (st.offline ? ' (the phone is offline)' : '') + '; events outside that aren’t here.';
      else if (st.offline) out.note = 'The phone is offline: these are the events last seen.';
      const wx = {};
      for (let d = from, n = 0; d <= to && n < 16; d = app.addDays(d, 1), n++) { const w = app.wxFor(d); if (w) wx[d] = w.words + ', ' + w.hi + ' / ' + w.lo; }
      if (Object.keys(wx).length) out.weather = wx;
      return { content: out };
    },

    async get_event(q) {
      await fresh();
      const id = String(q.id || ''), name = fileOf(id);
      let all = readable().filter(x => idOf(x) === id || x.id === id || (x.kind === 'family' && x.name === name));
      if (!all.length) fail('Nothing with id ' + line(id, 80) + ' is loaded. Use find_events first.');
      if (isDay(q.date)) { const on = all.filter(x => overlaps(x, q.date, app.addDays(q.date, 1))); if (on.length) all = on; }
      const x = all.find(o => o.end >= Date.now()) || all[all.length - 1];
      const b = brief(x);
      if (x.kind === 'family') {
        const o = x.o;
        if (o.description) b.notes = clip(o.description, 4000);
        if (o.url) b.url = clip(o.url, 300);
        if (isRepeating(x)) {
          const rr = I.prop(o.master, 'RRULE');
          b.repeat = rr ? I.ruleText(rr.value, I.dateProp(o.master, 'DTSTART'), u => app.medDate(u.y + '-' + pad(u.m) + '-' + pad(u.d))) : 'on set dates';
          if (o.comp !== o.master) b.changed_on_its_own = true;
          b.occurrences_loaded = all.length;
        }
        if (o.alarms.length) b.alerts = o.alarms.map(a => a.at != null ? 'at ' + wallStr(a.at) : a.minutes === 0 ? 'at the start' : Math.abs(a.minutes) + ' minutes ' + (a.minutes < 0 ? 'before' : 'after') + (a.related === 'end' ? ' the end' : ''));
        if (o.travel) b.travel_minutes = o.travel;
        if (o.transp === 'TRANSPARENT') b.shown_as = 'free';
        if (o.organizer) b.organizer = line(o.organizer.name || o.organizer.email, 80);
        if (o.attendees.length) b.invited = o.attendees.slice(0, 30).map(a => line(a.name || a.email, 80) + (a.status && a.status !== 'NEEDS-ACTION' ? ' (' + a.status.toLowerCase() + ')' : ''));
      } else if (x.notes) b.notes = clip(x.notes, 2000);
      return { content: { event: b } };
    },

    async free_time(q) {
      await fresh();
      const from = isDay(q.from) ? q.from : app.today(), to = isDay(q.to) ? q.to : app.addDays(from, 6);
      if (to < from) fail('to is before from.');
      if (app.dayMs(to) - app.dayMs(from) > 62 * D) fail('Ask for at most two months at a time.');
      const tm = (s, d) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim()); if (!m) return d; const v = +m[1] * 60 + +m[2]; return v >= 0 && v <= 1440 && +m[2] < 60 ? v : d; };
      const early = tm(q.earliest, 8 * 60), late = tm(q.latest, 21 * 60), min = Math.max(5, Math.min(1440, Number.isInteger(q.min_minutes) ? q.min_minutes : 60));
      if (late <= early) fail('latest must be after earliest.');
      const ok = await cover(from, to);
      const busyOf = x => !x.allDay && ((x.kind === 'family' && x.o.transp !== 'TRANSPARENT') || x.kind === 'travel');
      const days = [];
      for (let d = from; d <= to; d = app.addDays(d, 1)) {
        const p = { y: +d.slice(0, 4), m: +d.slice(5, 7), d: +d.slice(8, 10) };
        const at = mins => mins >= 1440 ? app.dayMs(app.addDays(d, 1)) : I.zonedToUtc(Object.assign({}, p, { h: Math.floor(mins / 60), mi: mins % 60, s: 0 }), TZ);
        const a = at(early), b = at(late);
        const on = app.eventsOn(d).filter(x => KIND_KEY[x.kind]);
        const busy = on.filter(busyOf).map(x => [Math.max(a, x.start), Math.min(b, x.end)]).filter(([s, e]) => e > s).sort((u, v) => u[0] - v[0]);
        const free = []; let t = a;
        for (const [s, e] of busy) { if (s - t >= min * MIN) free.push([t, s]); t = Math.max(t, e); }
        if (b - t >= min * MIN) free.push([t, b]);
        const row = { date: d, weekday: new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }), free: free.map(([s, e]) => ({ from: hm(s), to: e >= app.dayMs(app.addDays(d, 1)) ? '24:00' : hm(e), minutes: Math.round((e - s) / MIN) })) };
        const taken = on.filter(busyOf).filter(x => x.end > a && x.start < b).map(x => hm(x.start) + '-' + hm(x.end) + ' ' + (app.isPrivate(x) ? 'Private' : line(x.title, 60)));
        if (taken.length) row.busy = taken;
        const allDay = on.filter(x => x.allDay && !app.isPrivate(x)).map(x => line(x.title, 60) + ' (' + calOf(x) + ')');
        if (allDay.length) row.all_day = allDay;
        days.push(row);
      }
      const out = { earliest: pad(Math.floor(early / 60)) + ':' + pad(early % 60), latest: late >= 1440 ? '24:00' : pad(Math.floor(late / 60)) + ':' + pad(late % 60), min_minutes: min,
        counted_as_busy: 'Family events with times (not ones shown as free) and Travel flights and car pick-ups; all-day items are listed but don’t block time. "Private" is something the person keeps private: only its time is shown', days };
      if (!ok) out.note = 'Only ' + (loaded() ? loaded().from + ' to ' + loaded().to : 'what was seen last') + ' could be loaded; days outside that look free but may not be.';
      return { content: out };
    },

    async create_event(q, { confirm }) {
      const no = canAsk(); if (no) return { content: no, error: true };
      const title = line(q.title, 200); if (!title) fail('A new event needs a title.');
      const t = times(q, null);
      const f = app.formFrom(null, t.start);
      Object.assign(f, { title, allDay: t.allDay, start: t.start, end: t.end, location: line(q.location, 200), notes: clip(q.notes, 2000), tz: TZ });
      if (t.allDay) f.alarms = app.settings.alertAllDay ? [app.settings.alertAllDay] : [];
      const rep = q.repeat || 'never';
      if (!(rep in RULES)) fail('repeat must be one of: ' + Object.keys(RULES).join(', ') + '.');
      f.rule = RULES[rep];
      if (f.rule && q.repeat_until != null) {
        if (!isDay(q.repeat_until) || app.dayMs(q.repeat_until) < app.dayMs(app.ymd(t.start))) fail('repeat_until must be a day, YYYY-MM-DD, on or after the start.');
        f.ruleEnd = { type: 'date', date: q.repeat_until };
      } else f.ruleEnd = { type: 'never' };
      asked++;
      if (!(await confirm(card('Add this event?', f), { yes: 'Yes, add it', no: 'No' }))) return { content: NO };
      if (st.api !== 'ok') return { content: canAsk() || 'The Family calendar can’t be reached right now; nothing was added.', error: true };
      app.busyPill('Saving');
      let name;
      try { name = await app.writeEvent(null, f, 'all'); }
      catch (e) { app.busyPill(''); app.rebuild(); app.render(); return { content: 'Not added: ' + why(e), error: true }; }
      app.written('Saved');
      const w = whenLines(f);
      return { content: { added: { id: name, calendar: calName(), title, ...(f.allDay ? { all_day: true, start: app.ymd(f.start), end: app.addDays(app.ymd(f.end), -1) } : { start: wallStr(f.start), end: wallStr(f.end) }), repeat: repeatWords(f) } },
        change: { text: 'Added “' + title + '” on ' + w.day + (f.allDay ? '' : ', ' + w.start), undo: undoable(() => unCreate(name, title)) } };
    },

    async update_event(q, { confirm }) {
      const no = canAsk(); if (no) return { content: no, error: true };
      const tg = target(q.id); if (tg.why) return { content: tg.why, error: true };
      const { x, item, name } = tg;
      const before = app.formFrom(x);
      const f = Object.assign({}, before);
      if (q.title != null) { f.title = line(q.title, 200); if (!f.title) fail('The title can’t be empty.'); }
      if (q.location != null) f.location = line(q.location, 200);
      if (q.notes != null) f.notes = clip(q.notes, 2000);
      if (q.start != null || q.end != null || q.all_day != null) {
        const t = times(q, before);
        Object.assign(f, t);
        if (t.allDay !== before.allDay) { f.alarms = t.allDay ? (app.settings.alertAllDay ? [app.settings.alertAllDay] : []) : (app.settings.alertTimed ? [app.settings.alertTimed] : []); f.tz = TZ; }
      }
      const same = ['title', 'location', 'notes', 'allDay', 'start', 'end'].every(k => f[k] === before[k]);
      if (same) return { content: { unchanged: true, note: 'It already says that, so nothing was asked or changed.' } };
      asked++;
      if (!(await confirm(card('Change this event?', f, before), { yes: 'Yes, change it', no: 'No' }))) return { content: NO };
      const now = target(q.id);   // as it is now: something may have moved while the card waited
      if (now.why) return { content: 'Not changed: ' + now.why, error: true };
      if (now.item.etag !== item.etag) { app.refresh({ force: true }); return { content: 'Not changed: ' + why({ code: 'changed' }), error: true }; }
      const old = { ics: item.ics, etag: item.etag };
      app.busyPill('Saving');
      try { await app.writeEvent(now.x, f, 'all'); }
      catch (e) {
        st.items.set(name, { etag: old.etag, ics: old.ics, cal: I.parse(old.ics) });   // the write didn't happen: the copy here goes back too
        app.busyPill(''); app.rebuild(); app.render();
        if (e && e.code === 'changed') app.refresh({ force: true });
        return { content: 'Not changed: ' + why(e), error: true };
      }
      app.written('Saved');
      const what = [['title', 'title'], ['start', 'time'], ['end', 'time'], ['allDay', 'all day'], ['location', 'place'], ['notes', 'notes']].filter(([k]) => f[k] !== before[k]).map(([, w]) => w);
      return { content: { changed: [...new Set(what)], event: { id: name, title: f.title, ...(f.allDay ? { all_day: true, start: app.ymd(f.start), end: app.addDays(app.ymd(f.end), -1) } : { start: wallStr(f.start), end: wallStr(f.end) }) } },
        change: { text: 'Changed ' + [...new Set(what)].join(', ') + ' of “' + (f.title || 'New Event') + '”', undo: undoable(() => unChange(name, old.ics, f.title || 'New Event')) } };
    },

    async delete_event(q, { confirm }) {
      const no = canAsk(); if (no) return { content: no, error: true };
      const tg = target(q.id); if (tg.why) return { content: tg.why, error: true };
      const { x, item, name } = tg;
      const f = app.formFrom(x);
      asked++;
      if (!(await confirm(card('Delete this event?', f), { yes: 'Yes, delete it', no: 'No' }))) return { content: NO };
      const now = target(q.id);
      if (now.why) return { content: 'Not deleted: ' + now.why, error: true };
      if (now.item.etag !== item.etag) { app.refresh({ force: true }); return { content: 'Not deleted: ' + why({ code: 'changed' }), error: true }; }
      const old = item.ics, title = x.title;
      app.busyPill('Deleting');
      try { await app.deleteFile(name, item.etag); }
      catch (e) { app.busyPill(''); if (e && e.code === 'changed') app.refresh({ force: true }); return { content: 'Not deleted: ' + why(e), error: true }; }
      app.written('Deleted');
      const w = whenLines(f);
      return { content: { deleted: { id: name, title } }, change: { text: 'Deleted “' + title + '” (' + w.day + (f.allDay ? '' : ', ' + w.start) + ')', undo: undoable(() => unDelete(name, old, title)) } };
    },

    async show_day(q) {
      if (!isDay(q.date)) fail('date must be YYYY-MM-DD.');
      const view = ['day', 'week', 'month', 'list'].includes(q.view) ? q.view : 'day';
      app.goTo(q.date, view);
      return { content: { shown: q.date, view, note: 'It is on the screen behind the chat; closing the chat shows it.' } };
    },
  };

  // ---- Undo: through the same calls, never over a change made since ----
  // The chat calls an undo without waiting for it, so what can be checked at once is checked first
  // (an error here shows in the chat); what goes wrong talking to iCloud shows in the app's toast.
  function undoable(run) {
    return () => {
      if (st.api !== 'ok') throw new Error('the Family calendar can’t be reached right now');
      const p = run();
      p.catch(e => app.toast('Couldn’t undo: ' + (e && e.code ? why(e) : (e && e.message) || e), null, 7000));
      return p;
    };
  }
  // The version iCloud has now (its etag), learned again if the app doesn't know it yet.
  async function current(name) {
    let it = st.items.get(name);
    if (it && !it.etag) { await app.refresh({ force: true }); it = st.items.get(name); }
    return it;
  }
  async function unCreate(name, title) {
    const it = await current(name);
    if (!it) throw new Error('“' + title + '” is already gone');
    if (!it.etag) throw new Error('the app can’t yet check nobody changed “' + title + '”; try again in a moment');
    app.busyPill('Deleting');
    try { await app.deleteFile(name, it.etag); } catch (e) { app.busyPill(''); if (e && e.code === 'changed') app.refresh({ force: true }); throw e; }
    app.written('Deleted');
  }
  async function unChange(name, ics, title) {
    const it = await current(name);
    if (!it) throw new Error('“' + title + '” has been deleted since');
    if (!it.etag) throw new Error('the app can’t yet check nobody changed “' + title + '”; try again in a moment');
    const cal = I.parse(ics), ev = I.children(cal, 'VEVENT')[0], now = I.children(it.cal, 'VEVENT')[0];
    if (ev) {   // the old event, as a newer version than the change (so phones take it)
      const seq = Math.max(parseInt(I.text(ev, 'SEQUENCE'), 10) || 0, now ? parseInt(I.text(now, 'SEQUENCE'), 10) || 0 : 0);
      I.setProp(ev, 'SEQUENCE', String(seq + 1)); I.setProp(ev, 'DTSTAMP', I.stamp()); I.setProp(ev, 'LAST-MODIFIED', I.stamp());
    }
    app.busyPill('Saving');
    try { await app.writeItem(name, cal, it.etag); } catch (e) { app.busyPill(''); if (e && e.code === 'changed') app.refresh({ force: true }); throw e; }
    app.written('Saved');
  }
  async function unDelete(name, ics, title) {
    if (st.items.has(name)) throw new Error('“' + title + '” is back already');
    app.busyPill('Saving');
    // No etag: iCloud is asked to write it only if no event of that name exists (If-None-Match).
    try { await app.writeItem(name, I.parse(ics), null); } catch (e) { app.busyPill(''); if (e && e.code === 'changed') app.refresh({ force: true }); throw e; }
    app.written('Saved');
  }

  const LABELS = {
    find_events: i => i.query ? 'Searching the calendar: ' + line(i.query, 50) : 'Looking at the calendar', get_event: () => 'Reading an event',
    free_time: () => 'Looking for free time', create_event: () => 'Adding an event', update_event: () => 'Changing an event', delete_event: () => 'Deleting an event',
    show_day: () => 'Opening the day',
    search_gmail: () => 'Searching Gmail', read_email: () => 'Reading an email',
  };
  const ON = { holiday: 'holidays', note: 'notes', travel: 'travel', mail: 'mail', fitness: 'fitness', meals: 'meals', orders: 'orders', school: 'school', news: 'news' };

  return {
    tools,
    label: (name, input) => (LABELS[name] || (() => ''))(input || {}),
    // Runs once as each question is sent (home/ipsy.js), so the count of changes starts again here.
    context() {
      asked = 0;
      const layers = Object.entries(ON).filter(([, k]) => app.settings.layers[k]).map(([kind]) => app.LAYER[kind].name);
      const l = loaded();
      return 'Calendar shows the ' + calName() + ' calendar (iCloud, shared with the family)' + (layers.length ? ' and these layers: ' + layers.join(', ') : '') + '. '
        + (l ? 'Loaded: ' + l.from + ' to ' + l.to + '. ' : '') + 'The phone’s time zone: ' + TZ + '. On screen: ' + app.screen() + '.'
        + (st.api !== 'ok' && st.api !== 'checking' ? ' The Family calendar can’t be reached right now, so nothing can be changed.' : '')
        + (st.offline ? ' The phone is offline.' : '') + (gmailOn() ? '' : ' Gmail is turned off for Ipsy here (Settings).');
    },
    intro: 'Hi, I’m Ipsy! Ask me what’s on, or to add or move an event.',
    placeholder: 'Ask Ipsy about the calendar',
    suggestions: ['What’s on this week?', 'Find us a free evening next week', 'Find appointment emails in Gmail', 'What can you change here?'],
    consent: 'Your question and the events Ipsy reads go to Claude, by Anthropic, through the family server. It asks before every change (each shows with Undo), and never sees Private events.',
  };
};
