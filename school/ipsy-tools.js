"use strict";

// Ipsy's tools in School, for Ipsy in aOS (School has no chat of its own, as Weather and Home). Claude asks
// for them by name through functions/aOS/api/ipsy.js (server/ipsy-school.js describes them to it); aOS opens
// School out of sight and runs them here, against the same posts and settings as the page (sort.js).
// They read, and mark an ask done (with Undo); nothing else changes. Report cards stay out (only their
// subject and date), and no ParentSquare link goes out (its links carry a sign-in token).
//
//   window.SchoolIpsy(app) -> { tools, label }, which app.js offers to aOS as AllisonOS.ipsyTools
//   app: the page's own pieces (school/app.js passes them): P (sort.js), items(), me(), done(), moved(),
//        setDone(id, on), weatherLine(day, me), openItem(id)
window.SchoolIpsy = function (app) {
  const { P } = app;
  const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);
  const fail = msg => { throw new Error(msg); };
  const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const sections = now => P.sections(app.items(), { now: now || new Date(), me: app.me(), done: app.done(), moved: app.moved() });
  const WHOSE = { class: 'her class (homeroom, grade, clubs, or a message to the parent)', grade: 'her grade and others', school: 'the whole school', other: 'another grade', record: 'a record' };
  const brief = x => ({ id: x.id, title: clip(x.title, 200), kind: x.kind, from: clip(x.author, 80) || null, posted: P.ymd(new Date(x.at)), whose: WHOSE[app.moved()[x.id] || P.audience(x, app.me())] || null });
  const dateOf = d => ({ date: d.d, ...(d.end ? { until: d.end } : {}), ...(d.time ? { time: d.time } : {}) });
  const need = () => { if (!app.items().length) fail('School has no posts yet: it reads the school\'s ParentSquare emails once Gmail is connected in its Settings.'); };

  const tools = {
    // the school day the top card is about, or any day asked for
    async get_school_day(q) {
      need();
      const s = sections();
      let d = s.top.d, label = s.top.label;
      if (q && q.date) { if (!isDay(q.date)) fail('date is YYYY-MM-DD.'); d = q.date; label = null; }
      const off = s.off.get(d), wd = P.dow(d) > 0 && P.dow(d) < 6;
      const on = s.year.filter(e => e.d === d || (e.end && e.d <= d && d <= e.end)).filter(e => e.kind !== 'noschool');
      const m = app.me(), wx = app.weatherLine(d, m);
      return { content: {
        date: d, ...(label ? { shown_as: label } : {}), weekday: P.WEEKDAYS[P.dow(d)],
        school: !wd ? 'no (weekend)' : off ? 'no: ' + off : 'yes',
        ...(d === s.top.d ? { days_off_before_it: s.top.gaps.map(g => ({ from: g.d, to: g.end, why: g.why })) } : {}),
        on_that_day: on.slice(0, 20).map(e => ({ id: e.id, title: clip(e.title, 200), kind: e.kind, ...(e.time ? { time: e.time } : {}), ...(e.from ? { from: clip(e.from, 80) } : {}) })),
        ...(wd && !off ? { pickup: P.pickup(d, m).text } : {}),
        ...(wx ? { weather: wx } : {}),
        child: { ...(m.name ? { name: m.name } : {}), ...(m.grade != null ? { grade: m.grade === 0 ? 'Kindergarten' : m.grade } : {}), ...(m.teacher ? { teacher: m.teacher } : {}) },
      } };
    },
    // what needs a parent, soonest due first
    async get_needs() {
      need();
      const s = sections();
      return { content: { needs: s.needs.slice(0, 30).map(x => ({ ...brief(x), ...(x.due ? { due: x.due } : {}) })),
        note: 'Sign-ups, RSVPs, forms, surveys and payments for her, not yet marked done. They are answered in ParentSquare (open_post shows it in School).' } };
    },
    // dated things between two days (the next two weeks by default)
    async get_coming_up(q) {
      need();
      const today = P.ymd(new Date()), from = q && isDay(q.from) ? q.from : today, to = q && isDay(q.to) ? q.to : P.addDays(from, 14);
      if (to < from) fail('to is on or after from.');
      if (P.between(from, to) > 400) fail('At most about a year at once.');
      const s = sections(new Date(P.noon(from).getTime() - 864e5 * 1));
      const all = s.year.concat([...s.off].map(([d, why]) => ({ d, end: '', title: 'No school: ' + why, kind: 'noschool' })));
      const list = all.filter(e => (e.end || e.d) >= from && e.d <= to).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
        .filter((e, i, a) => a.findIndex(y => y.d === e.d && y.title === e.title) === i);
      return { content: { from, to, dates: list.slice(0, 80).map(e => ({ ...dateOf(e), title: clip(e.title, 200), kind: e.kind, ...(e.id ? { id: e.id } : {}) })) } };
    },
    // posts by words, newest first
    async find_posts(q) {
      need();
      const w = clip(q && q.query, 80).toLowerCase(); if (w.length < 2) fail('Give a word or two to look for.');
      const limit = Math.max(1, Math.min(25, Number.isInteger(q.limit) ? q.limit : 10));
      const hits = app.items().filter(x => x.kind !== 'report' && (x.title + ' ' + (x.author || '') + ' ' + (x.groups || []).join(' ') + ' ' + (x.body || '')).toLowerCase().includes(w))
        .sort((a, b) => b.at - a.at);
      return { content: { query: w, found: hits.length, posts: hits.slice(0, limit).map(x => ({ ...brief(x), excerpt: clip(String(x.body || '').replace(/\s+/g, ' '), 300) })) } };
    },
    // one post in full
    async read_post(q) {
      const x = app.items().find(i => i.id === (q && q.id)); if (!x) fail('No post with that id: find_posts, get_needs or get_coming_up give ids.');
      if (x.kind === 'report') return { content: { ...brief(x), note: 'A report card or progress report: School keeps only its subject and date. The document is in ParentSquare.' } };
      return { content: { ...brief(x), groups: (x.groups || []).map(g => clip(g, 80)), text: clip(x.body, 4000), dates: (x.dates || []).map(dateOf),
        ...(x.events ? { newsletter_dates: x.events.slice(0, 60).map(e => ({ ...dateOf(e), what: clip(e.what, 140) })) } : {}),
        ...(x.picture ? { note: 'This post is a picture (a newsletter as an image): School can\'t read its words yet.' } : {}),
        done: !!app.done()[x.id] } };
    },
    // an ask marked done, or not done again: with Undo in the chat
    async mark_done(q) {
      const x = app.items().find(i => i.id === (q && q.id)); if (!x) fail('No post with that id.');
      const on = !(q && q.done === false), was = !!app.done()[x.id];
      if (was === on) return { content: { id: x.id, title: x.title, done: on, note: 'Already ' + (on ? 'done' : 'not done') + '.' } };
      app.setDone(x.id, on, true);
      return { content: { id: x.id, title: x.title, done: on }, change: { text: (on ? 'Marked done: ' : 'Not done: ') + clip(x.title, 80), undo: () => app.setDone(x.id, was, true) } };
    },
    // the post on School's screen, behind the chat
    async open_post(q) {
      const x = app.items().find(i => i.id === (q && q.id)); if (!x) fail('No post with that id.');
      app.openItem(x.id);
      try { if (window.top !== window && window.top.aosHomeTab) window.top.aosHomeTab.show('school'); } catch {}
      return { content: { shown: clip(x.title, 120), note: 'School is open on it behind the chat, with Open in ParentSquare to reply, RSVP, sign up or pay.' } };
    },
  };

  const LABELS = {
    get_school_day: () => 'Looking at the school day', get_needs: () => 'Checking what needs you', get_coming_up: () => 'Looking at what’s coming up',
    find_posts: i => 'Looking through school posts' + (i.query ? ' for “' + clip(i.query, 24) + '”' : ''), read_post: () => 'Reading a school post',
    mark_done: i => (i.done === false ? 'Marking it not done' : 'Marking it done'), open_post: () => 'Opening the post in School',
  };
  return { tools, label: (name, input) => (LABELS[name] ? LABELS[name](input || {}) : '') };
};
