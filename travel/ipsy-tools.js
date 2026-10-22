"use strict";

// Ipsy's tools in Travel (in both its designs). Claude asks for them by name through
// functions/travel/api (IPSY_CLIENT_TOOLS describes them to it); they run here, on the phone,
// against the same bookings, the same Gmail sign-in and the same flight look-ups as the app, and
// what they return goes back to Claude. Every change comes back with an undo for the chat's Undo.
//
//   window.TravelIpsy(app) -> the options for AllisonOS.ipsy.mount (tools, label, context, words)
//   app: the app's own pieces (travel/app.js passes them): bookings, groupTrips, checkList, tripById, startOf,
//        endOf, isPast, titleOf, fillText, liveView, liveWindow, checkField, checkEdit, applyEdits, editText,
//        EDIT_FIELDS, EDIT_NEEDED, EDIT_LABEL, render, openTrip, openBooking, flightData, keepLive, boardData, allowance,
//        gmail, bodies, header, getToken, AuthError, P (parse.js), screen
//
// Changes follow the app's own rules: every one is checked by checkEdit (the booking is here, the
// field belongs to its kind, the value has the right shape) and made by applyEdits, as the booking
// sheet makes them: what is changed is the person's own (a later email won't overwrite it), a
// deleted booking stays deleted, and everything goes through save(), so the Sheet and the Family
// calendar follow. Deleting asks first, in the chat.
//
// Private bookings (the Private pill on a booking, or on a whole trip) are hidden from Ipsy: they
// are left out of everything it reads and it can't change them; a trip with some private bookings
// is shown with the others only, named and dated by them, and can't be renamed. Their emails are
// left out of what Ipsy finds or reads in Gmail (the email a booking came from, its thread, and any
// email that names its confirmation or flight number). Gmail can also be turned off for Ipsy
// altogether (Settings, Ipsy).
window.TravelIpsy = function (app) {
  const P = app.P;
  const ymd = s => typeof s === 'string' && /^20\d\d-\d\d-\d\d$/.test(s) && !isNaN(Date.parse(s + 'T12:00:00Z'));
  const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);
  const plural = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
  const FLIGHT = /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/;
  const PV = window.AllisonOS && window.AllisonOS.ipsy && window.AllisonOS.ipsy.privacy;
  const seen = b => !b.private;                       // private bookings stay out of Ipsy's sight
  const byId = id => app.bookings.find(b => b.id === id && seen(b));
  const privCount = () => app.bookings.filter(b => !seen(b)).length;
  // A trip as Ipsy sees it: its bookings that aren't private, named and dated by them (null: all private).
  function view(g) {
    if (!g) return null;
    const items = g.items.filter(seen), hidden = g.items.length - items.length;
    if (!hidden) return g;
    if (!items.length) return null;
    const starts = items.map(app.startOf).filter(Boolean).sort(), ends = items.map(b => app.endOf(b) || app.startOf(b)).filter(Boolean).sort();
    return { ...g, items, live: g.live.filter(seen), name: app.autoName({ items }), start: starts[0] || g.start, end: ends[ends.length - 1] || g.end, hidden };
  }
  const trips = () => app.groupTrips().map(view).filter(Boolean);
  const tripById = id => view(app.tripById(id));
  const checkList = () => app.checkList().filter(seen);
  const fail = msg => { throw new Error(msg); };
  // Leaves out what says nothing (empty, null, false), so what goes to Claude stays short.
  const compact = v => {
    if (Array.isArray(v)) return v.map(compact);
    if (!v || typeof v !== 'object') return v;
    const o = {};
    for (const [k, x] of Object.entries(v)) { const c = compact(x); if (c !== '' && c != null && c !== false && !(c && typeof c === 'object' && !Array.isArray(c) && !Object.keys(c).length)) o[k] = c; }
    return o;
  };

  // ---- how a trip and a booking are shown to Claude ----
  const kindOf = b => b.ride ? 'ride' : b.type;
  // Why a booking may be off, as the app marks it ("To check"); nothing for one that is fine or in the past.
  const why = b => !app.startOf(b) ? 'no date yet' : !b.guess || app.isPast(b) ? ''
    : b.filled ? 'filled in ' + app.fillText(b) : b.fromCal ? 'made from an event in the calendar' : 'read from the words of an email';
  const place = b => b.type === 'hotel' ? b.city || b.address : b.type === 'car' ? b.pickupPlace || b.city : b.type === 'other' ? b.place : '';
  function line(b) {
    const s = app.startOf(b), e = app.endOf(b), lv = app.liveView(b);
    return compact({ id: b.id, kind: kindOf(b), what: app.titleOf(b), where: place(b), start: s || 'no date', end: e && e !== s ? e : '',
      conf: b.conf, status: b.status === 'cancelled' ? 'cancelled' : '', check: why(b), live: lv ? lv.text : '' });
  }
  function trip(g) {
    return { id: g.id, name: g.name, from: g.start.slice(0, 10), to: g.end.slice(0, 10), when: g.past ? 'past' : g.startT <= Date.now() ? 'under way' : 'upcoming', bookings: g.items.map(line) };
  }
  function full(b) {
    const { updated, created, source, calSig, calUid, filled, guess, shadow, ...rest } = b;
    const f = { ...rest, kind: kindOf(b) };
    const g = app.startOf(b) && tripById(b.id);
    if (g) f.trip = { id: g.id, name: g.name };
    f.check = why(b);
    if (calSig || calUid) f.inFamilyCalendar = true;
    if (source && source.msgId) f.email = { message_id: source.msgId, subject: source.subject || '', from: source.from || '', date: source.date ? new Date(source.date).toISOString().slice(0, 10) : '' };
    if (created) f.addedOn = new Date(created).toISOString().slice(0, 10);
    const lv = app.liveView(b);
    if (lv) f.live = { status: lv.text, terminal: lv.terminal, gate: lv.gate, arrivalTerminal: lv.arrTerminal, arrivalGate: lv.arrGate, belt: lv.belt, checked: new Date(lv.at).toISOString() };
    return compact(f);
  }
  const words = b => [b.name, b.title, b.company, b.city, b.address, b.place, b.pickupPlace, b.dropPlace, b.from, b.to, b.fromName, b.toName, b.airline,
    b.airlineCode && b.flightNo ? b.airlineCode + b.flightNo + ' ' + b.airlineCode + ' ' + b.flightNo : b.flightNo, b.conf, b.notes, b.traveller, b.carClass].join(' ').toLowerCase();

  // ---- changes: each checked by the app (checkEdit), made by it (applyEdits) ----
  const made = (ops, text) => { const r = app.applyEdits(ops); return { r, change: { text, undo: r.undo } } };
  const fieldsOf = kind => Object.keys(app.EDIT_FIELDS[kind] || {});
  const range = g => g.start.slice(0, 10) === g.end.slice(0, 10) ? g.start.slice(0, 10) : g.start.slice(0, 10) + ' to ' + g.end.slice(0, 10);
  const tripWords = g => '**' + g.name + '** (' + range(g) + ', ' + plural(g.items.length, 'booking') + ')';

  // ---- Gmail ----
  const gmailOn = () => !PV || PV.gmail('travel');
  async function mail(path, params) {
    if (!gmailOn()) fail(PV.gmailOff('Travel'));
    if (!app.getToken()) fail('Gmail isn’t connected in Travel on this phone. The person can connect it in Settings (the gear), Connect Gmail.');
    try { return await app.gmail(path, params); }
    catch (e) { if (e instanceof app.AuthError) fail('Gmail’s sign-in has run out on this phone. The person can sign in again in Settings (the gear), Connect Gmail.'); throw e; }
  }
  const head = (m, n) => app.header(m, n.toLowerCase());
  const day = ms => { const d = new Date(+ms); return isNaN(d) ? '' : d.toISOString().slice(0, 10); };
  const madeFrom = id => app.bookings.filter(b => seen(b) && b.source && b.source.msgId === id).map(b => b.id);
  // The emails behind private bookings, which Ipsy doesn't get either.
  const guard = () => PV ? PV.guard(app.bookings.filter(b => !seen(b)).map(b => ({ msgId: b.source && b.source.msgId, threadId: b.source && b.source.threadId,
    words: [b.conf, b.airlineCode && b.flightNo ? b.airlineCode + b.flightNo : ''] }))) : { hides: () => false };

  // ---- live flights: the app's own calls (travel/api/flight and find), counted in its monthly allowances ----
  const LIVE_ERRORS = { limit: 'The flight data service’s monthly allowance is used up.', 'key-refused': 'The flight data service refused the key.',
    unreachable: 'Couldn’t reach the flight data service. Try again in a minute.', 'bad-request': 'The flight data service didn’t take that flight or day.' };
  const NO_SERVER = 'Live flight data isn’t available here right now: no connection, or this copy of the site has no flight service.';
  const NO_KEY = 'Live flight data isn’t set up on this copy of the site (it needs the flight data key; Travel README, “Live flight status”).';

  const tools = {
    async find_trips(q) {
      const when = ['upcoming', 'past', 'check', 'all'].includes(q.when) ? q.when : 'upcoming';
      const want = clip(q.query, 200).toLowerCase().split(/\s+/).filter(Boolean);
      const hit = text => want.every(w => text.includes(w));
      const limit = Math.max(1, Math.min(60, Number.isInteger(q.limit) ? q.limit : 20));
      if (when === 'check') {
        const list = checkList().filter(b => !want.length || hit(words(b)));
        return { content: { found: list.length, bookings: list.slice(0, limit * 3).map(line) } };
      }
      let groups = trips();
      if (when === 'upcoming') groups = groups.filter(g => !g.past);
      if (when === 'past') groups = groups.filter(g => g.past).reverse();
      groups = groups.filter(g => (!ymd(q.from) || g.end.slice(0, 10) >= q.from) && (!ymd(q.to) || g.start.slice(0, 10) <= q.to)
        && (!want.length || hit(g.name.toLowerCase() + ' ' + g.items.map(words).join(' '))));
      const toCheck = checkList().length, priv = privCount();
      return { content: { found: groups.length, shown: Math.min(limit, groups.length), trips: groups.slice(0, limit).map(trip),
        ...(toCheck && when !== 'past' ? { to_check: toCheck + (toCheck === 1 ? ' booking needs' : ' bookings need') + ' a look (find_trips with when: check)' } : {}),
        ...(priv ? { privateBookingsNotShown: priv } : {}) } };
    },

    async get_bookings(q) {
      const ids = (Array.isArray(q.ids) ? q.ids : []).slice(0, 20);
      return { content: { bookings: ids.map(id => { const b = byId(id); return b ? full(b) : { id, missing: 'No booking with this id (private bookings can’t be read).' }; }) } };
    },

    async update_booking(q) {
      const b = byId(q.id); if (!b) fail('No booking with id ' + q.id + '.');
      const ops = [], bad = [];
      for (const [field, value] of Object.entries(q.changes && typeof q.changes === 'object' ? q.changes : {})) {
        const o = app.checkEdit({ op: 'set', id: b.id, field, value: value == null ? '' : String(value) });
        if (o) ops.push(o); else bad.push(field);
      }
      if (q.status) { const o = app.checkEdit({ op: 'status', id: b.id, value: q.status }); if (o) ops.push(o); else bad.push('status'); }
      if (q.checked === true) ops.push({ op: 'check', id: b.id });
      const real = ops.filter(o => o.op === 'set' ? String(b[o.field] || '') !== o.value : o.op === 'status' ? (b.status || 'confirmed') !== o.value : (b.guess || !b.checked || b.filled));
      const skipped = bad.length ? { skipped: bad, why: 'Not a field of a ' + b.type + ', the wrong shape, or one it can’t be without. Fields for a ' + b.type + ': ' + fieldsOf(b.type).join(', ') + '.' } : {};
      if (!real.length) {
        if (bad.length && !ops.length) fail('Nothing changed. ' + skipped.why + ' Skipped: ' + bad.join(', ') + '.');
        return { content: { booking: line(b), changed: [], note: 'It already says that.', ...skipped } };
      }
      // One line for the chat: a single change as the app words it, several as what each is now.
      const title = app.titleOf(b), one = real.length === 1 ? app.editText(real[0]) : '';
      const r = app.applyEdits(real), now = byId(b.id) || b;
      const shown = v => String(v).length > 10 ? String(v).replace('T', ' ') : v;
      const text = one || 'Changed ' + title + ': ' + real.map(o => o.op === 'set' ? app.EDIT_LABEL[o.field] + (now[o.field] ? ' ' + shown(now[o.field]) : ' cleared')
        : o.op === 'status' ? (o.value === 'cancelled' ? 'marked canceled' : 'brought back') : 'marked checked').join(', ');
      return { content: { booking: line(now), changed: real.map(o => o.op === 'set' ? o.field : o.op === 'status' ? 'status' : 'checked'), ...skipped }, change: { text, undo: r.undo } };
    },

    async add_booking(q) {
      const kind = q.kind;
      if (!app.EDIT_FIELDS[kind]) fail('kind is flight, hotel, car or other.');
      const pairs = Object.entries(q.fields && typeof q.fields === 'object' ? q.fields : {}).map(([field, value]) => ({ field, value: value == null ? '' : String(value) }));
      const o = app.checkEdit({ op: 'add', kind, pairs });
      if (!o) {
        const bad = pairs.filter(p => !app.checkField(kind, p.field, p.value)).map(p => p.field);
        const missing = app.EDIT_NEEDED[kind].filter(k => !pairs.some(p => p.field === k && String(p.value).trim()));
        fail('Not added. ' + (bad.length ? 'These aren’t valid for a ' + kind + ': ' + bad.join(', ') + ' (fields: ' + fieldsOf(kind).join(', ') + '). ' : '') + (missing.length ? 'It needs: ' + missing.join(', ') + '.' : ''));
      }
      const { r, change } = made([o], app.editText(o));
      const nb = byId(r.added[0]);
      return { content: { booking: nb ? line(nb) : null }, change };
    },

    // Asked first, in the chat: a deleted booking doesn't come back from its email.
    async delete_bookings(q, { confirm }) {
      const ids = [...new Set(Array.isArray(q.ids) ? q.ids : [])];
      const found = ids.filter(byId), missing = ids.filter(id => !byId(id));
      if (!found.length) fail('None of those bookings are here.');
      const names = found.map(id => app.titleOf(byId(id)));
      // every booking of a trip is the whole trip: said as the trip
      const whole = trips().filter(g => !g.hidden && g.items.every(b => found.includes(b.id)));
      const what = whole.length ? 'Delete ' + (whole.length === 1 ? 'the whole trip ' + tripWords(whole[0]) : whole.length + ' whole trips: ' + whole.map(tripWords).join(', '))
        + (found.length > whole.reduce((n, g) => n + g.items.length, 0) ? ', and other bookings' : '')
        : 'Delete ' + (found.length === 1 ? names[0] : found.length + ' bookings: ' + names.slice(0, 5).join(', ') + (found.length > 5 ? ' and ' + (found.length - 5) + ' more' : ''));
      if (!(await confirm(what + '? It won’t come back from the emails.', { yes: 'Delete', no: 'Keep it' })))
        return { content: { deleted: [], declined: true, note: 'The person said no, so nothing was deleted.' } };
      const ops = found.map(id => ({ op: 'delete', id }));
      const { change } = made(ops, found.length === 1 ? app.editText(ops[0]) : 'Deleted ' + found.length + ' bookings (' + names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '') + ')');
      return { content: { deleted: found, ...(missing.length ? { missing } : {}) }, change };
    },

    async delete_trip(q, { confirm }) {
      const g = tripById(q.trip_id); if (!g) fail('No trip with id ' + q.trip_id + '.');
      const list = g.items.map(b => '- ' + app.titleOf(b)).join('\n');
      if (!(await confirm('Delete the whole trip ' + tripWords(g) + '?\n' + list + '\nIt won’t come back from the emails.', { yes: 'Delete the trip', no: 'Keep it' })))
        return { content: { deleted: [], note: 'The person said no, so nothing was deleted.' } };
      const ids = g.items.map(b => b.id);
      const { change } = made(ids.map(id => ({ op: 'delete', id })), 'Deleted the trip ' + g.name + ' (' + plural(ids.length, 'booking') + ')');
      return { content: { deleted: ids, trip: g.name, ...(g.hidden ? { note: 'Its private bookings are still there: Ipsy can’t see or delete them.' } : {}) }, change };
    },

    async move_booking(q) {
      const b = byId(q.id); if (!b) fail('No booking with id ' + q.id + '.');
      if (!app.startOf(b)) fail('This booking has no date yet, so it is in no trip. Give it its date first (update_booking).');
      if (q.own_trip) {
        const o = app.checkEdit({ op: 'detach', id: b.id });
        const { change } = made([o], app.editText(o));
        const g = tripById(b.id);
        return { content: { booking: b.id, trip: g ? { id: g.id, name: g.name } : null }, change };
      }
      const w = q.with && byId(q.with);
      if (!w) fail('Say which trip: with is a booking id in that trip, or the trip\'s id. Or own_trip: true for a trip of its own.');
      const to = tripById(w.id); if (!to) fail('That booking has no date, so it is in no trip.');
      const from = tripById(b.id);
      if (from && from.id === to.id) return { content: { booking: b.id, trip: { id: to.id, name: to.name }, note: 'It is already in that trip.' } };
      const o = app.checkEdit({ op: 'join', id: b.id, with: w.id }); if (!o) fail('Couldn’t move it there.');
      const { change } = made([o], 'Put ' + app.titleOf(b) + ' in the trip ' + to.name);
      const g = tripById(b.id);
      return { content: { booking: b.id, trip: g ? { id: g.id, name: g.name } : null }, change };
    },

    async rename_trip(q) {
      const g = tripById(q.trip_id); if (!g) fail('No trip with id ' + q.trip_id + '.');
      if (g.hidden) fail('This trip has bookings the person marked Private, so Ipsy can’t rename it. They can rename it on the trip’s page.');
      const o = app.checkEdit({ op: 'rename', id: g.id, name: q.name }, new Set([g.id]));
      if (!o) fail('A trip’s name is 2 to 60 characters.');
      if (o.name === g.name) return { content: { trip: { id: g.id, name: g.name }, note: 'It is already called that.' } };
      const { change } = made([o], app.editText(o));
      return { content: { trip: { id: g.id, name: o.name } }, change };
    },

    async show_trip(q) {
      const b = q.booking_id ? byId(q.booking_id) : null;
      if (q.booking_id && !b) fail('No booking with id ' + q.booking_id + '.');
      const g = tripById(q.trip_id || (b && app.startOf(b) ? b.id : '') || '');
      if (!g && !b) fail('No trip with id ' + q.trip_id + '.');
      if (g) app.openTrip(g.id);
      if (b) app.openBooking(b.id);
      return { content: { shown: compact({ trip: g ? g.id : '', booking: b ? b.id : '' }), note: 'It is open behind the chat; closing the chat shows it.' } };
    },

    async flight_status(q) {
      let b = null, no, date;
      if (q.booking_id) {
        b = byId(q.booking_id); if (!b) fail('No booking with id ' + q.booking_id + '.');
        if (b.type !== 'flight') fail('That booking isn’t a flight.');
        if (!b.airlineCode || !b.flightNo) fail('This flight has no flight number in the app yet. Find it (find_flight, or the web), then ask with flight and date.');
        no = b.airlineCode + b.flightNo; date = String(b.dep || '').slice(0, 10);
        if (!ymd(date)) fail('This flight has no date in the app yet. Ask with flight and date.');
      } else { no = clip(q.flight, 12).toUpperCase().replace(/[\s-]+/g, ''); date = q.date; }
      if (!FLIGHT.test(no)) fail('Give the flight as the airline’s 2-character code and the number, like UA1234.');
      if (!ymd(date)) fail('Give the day it leaves, as YYYY-MM-DD.');
      if (app.allowance.flight() <= 0) fail('This phone has used up its live flight look-ups for this month. They start again on the 1st.');
      let d; try { d = await app.flightData(no, date); } catch { fail(NO_SERVER); }
      if (d.error === 'no-key') fail(NO_KEY);
      app.allowance.countFlight();
      if (d.error) fail(LIVE_ERRORS[d.error] || 'Couldn’t get the status just now (' + clip(d.error, 40) + ').');
      // a booking's own flight, close to take-off: the app shows what came back too
      if (b && app.liveWindow(b)) { app.keepLive(b, d); app.render(); }
      const legs = (d.legs || []).filter(l => !l.cargo).map(compact);
      return { content: { flight: no, date, ...(b ? { booking_id: b.id } : {}), found: legs.length > 0, legs,
        note: legs.length ? 'From AeroDataBox. Each time is given local to its airport (local) and in UTC (utc); revised and predicted are the latest word.' : 'The flight data has no ' + no + ' leaving on ' + date + '. Check the number and the day.' } };
    },

    async find_flight(q) {
      const airline = clip(q.airline, 3).toUpperCase(), from = clip(q.from, 4).toUpperCase(), to = clip(q.to, 4).toUpperCase(), date = q.date, time = clip(q.time, 5);
      if (!/^[A-Z0-9]{2}$/.test(airline)) fail('airline is the 2-character code, like F9.');
      if (!/^[A-Z]{3}$/.test(from) || (to && !/^[A-Z]{3}$/.test(to))) fail('from (and to) are 3-letter airport codes.');
      if (!ymd(date)) fail('date is YYYY-MM-DD.');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail('time is HH:MM, 24-hour, local time.');
      if (app.allowance.board() <= 0) fail('This phone has used up its departure board look-ups for this month. Try the web instead.');
      let d; try { d = await app.boardData({ airline, from, ...(to ? { to } : {}), date, time }); } catch { fail(NO_SERVER); }
      if (!d || d.error === 'no-key') fail(NO_KEY);
      app.allowance.countBoard();
      if (d.error) fail(LIVE_ERRORS[d.error] || 'Couldn’t read the board just now (' + clip(d.error, 40) + ').');
      const flights = (d.candidates || []).map(c => compact({ flight: airline + c.number, to: c.to, departs: c.local }));
      return { content: { found: flights.length, flights,
        note: flights.length === 1 ? 'One flight fits. Confirm it with flight_status.' : flights.length ? 'More than one fits: narrow it down (where it goes, the time), or check each with flight_status.' : 'Nothing on the board fits. Try the web.' } };
    },

    async search_gmail(q) {
      const query = clip(q.query, 300); if (!query) fail('Give a Gmail search.');
      const max = Math.max(1, Math.min(25, Number.isInteger(q.max) ? q.max : 10));
      const r = await mail('/messages', { q: query + ' -in:chats', maxResults: max });
      const ids = (r && r.messages || []).slice(0, max), g = guard();
      const emails = [];
      let hidden = 0;
      for (const m of ids) {
        if (g.hides(m)) { hidden++; continue; }
        const msg = await mail('/messages/' + m.id, { format: 'metadata' });
        if (g.hides(msg)) { hidden++; continue; }
        const bs = madeFrom(m.id);
        emails.push({ message_id: m.id, from: head(msg, 'From'), subject: head(msg, 'Subject'), date: day(msg.internalDate), snippet: clip(msg.snippet, 200), ...(bs.length ? { bookings: bs } : {}) });
      }
      return { content: { found: emails.length, ...(r && r.resultSizeEstimate > emails.length + hidden ? { more: true } : {}), emails, ...(hidden ? { privateEmailsNotShown: hidden } : {}) } };
    },

    // Links are shown as their site only: an email's links can carry one-tap actions (check in,
    // cancel, change a seat) that a page fetch would set off, so Claude never gets the address.
    async read_email(q) {
      const id = clip(q.message_id, 40); if (!/^[0-9a-zA-Z_-]+$/.test(id)) fail('That isn’t a message id.');
      const msg = await mail('/messages/' + id, { format: 'full' });
      const { html, text } = app.bodies(msg.payload);
      const fromHtml = html ? P.htmlToText(html) : '';
      const body = (fromHtml && fromHtml.length > text.length * 1.2 ? fromHtml : (text || fromHtml))
        .replace(/https?:\/\/([^\s/?#]+)\S*/g, (u, host) => '[link to ' + host.replace(/^www\./, '') + ']').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      if (guard().hides(msg, body)) fail('That email is about a booking the person marked Private, so Ipsy can’t read it.');
      const bs = madeFrom(id);
      return { content: { message_id: id, from: head(msg, 'From'), to: head(msg, 'To'), subject: head(msg, 'Subject'), date: day(msg.internalDate),
        ...(bs.length ? { bookings: bs } : {}), text: body.slice(0, 20000) + (body.length > 20000 ? '\n[the rest of the email is cut off]' : '') } };
    },
  };

  const LABELS = {
    find_trips: () => 'Looking through your trips', get_bookings: () => 'Reading the details',
    update_booking: () => 'Updating a booking', add_booking: () => 'Adding a booking',
    delete_bookings: i => 'Deleting ' + ((i.ids || []).length === 1 ? 'a booking' : 'bookings'), delete_trip: () => 'Deleting a trip',
    move_booking: () => 'Moving a booking', rename_trip: () => 'Renaming a trip', show_trip: () => 'Opening the trip',
    flight_status: i => 'Checking ' + (i.flight ? clip(i.flight, 12).toUpperCase() : 'the flight') + ' live', find_flight: () => 'Looking at the departure board',
    search_gmail: i => 'Searching Gmail' + (i.query ? ': ' + clip(i.query, 60) : ''), read_email: () => 'Reading an email',
  };

  return {
    tools,
    label: (name, input) => (LABELS[name] || (() => ''))(input || {}),
    context() {
      const groups = trips(), up = groups.filter(g => !g.past), next = up[0], check = checkList().length, priv = privCount();
      return 'Travel has ' + plural(app.bookings.filter(seen).length, 'booking') + ' in ' + plural(groups.length, 'trip') + (priv ? ' (plus ' + priv + ' private ' + (priv === 1 ? 'one' : 'ones') + ' you can’t see)' : '') + ': ' + up.length + ' coming up'
        + (next ? ' (the next: ' + next.name + ', ' + range(next) + ')' : '') + (check ? ', ' + check + ' to check' : '') + '. '
        + 'On screen: ' + app.screen() + '.' + (!gmailOn() ? ' Gmail is turned off for Ipsy here (Settings, Ipsy).' : app.getToken() ? '' : ' Gmail isn’t connected right now.');
    },
    intro: 'Hi, I’m Ipsy! I can tell you about your trips, fix or add a booking, check any flight live (delays, gates, where it is), find a flight number, look through your Gmail, or look something up on the web.',
    placeholder: 'Ask Ipsy about your trips',
    suggestions: ['When’s my next flight? Is it on time?', 'What’s on my next trip?', 'Is anything on my trips not confirmed?', 'Check Gmail for bookings I’m missing'],
    consent: 'Ipsy runs on Claude, by Anthropic: what you ask, and the bookings and emails it reads, go there through the family server (flight look-ups go to AeroDataBox). Each change shows here with Undo, and it asks before deleting.',
  };
};
