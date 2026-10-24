// What aOS Home reads from the apps, on this phone: every app is on this same site, so inside aOS they
// share one storage, and Home can read what each app keeps without opening it. Nothing is sent anywhere.
//
//   aosFind.weather()  -> { temp: '64°', text: 'Sunny', hilo: 'H 70° L 52°', place } or null
//                        from Weather's own cache (wx.*)
//   aosFind.refreshWeather() -> true once a new forecast is in: fetched with Weather's own code
//                        (../weather/data.js) for Weather's place, when its last one is over 10 minutes
//                        old (as Weather does), and kept in Weather's cache, so Weather opens with it too
//   aosFind.next()     -> { when: '4:00 PM', title, then: '6:30 PM · Dinner', where } or null
//                        the next thing on the Family calendar, today or tomorrow (Calendar's .ics,
//                        turned into occurrences by ../calendar/ical.js, as Calendar does)
//   aosFind.search(q)  -> [{ app, title, sub, at }]: what's in the apps (the Ipsy bar's "In your
//                        apps"), best first; at: where to open the app ('?open=note:…'), when it has one
//
// Each app's data is read only from its main key (never its log or graves: Orders' log keeps hidden
// orders too). What an app keeps out of its own search stays out here: hidden orders (gifts), the
// kinds of order switched off, notes in the Trash, cancelled bookings and events.
'use strict';
(() => {
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = ms => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const day = ms => new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const dayOf = s => { const [y, m, d] = String(s).split('-').map(Number); return y ? new Date(y, m - 1, d) : null; };

  // ---- Weather: the place on screen in Weather (its last GPS fix, else the first saved city) ----
  const WORDS = { sunny: 'Sunny', 'clear-night': 'Clear', partlycloudy: 'Partly cloudy', cloudy: 'Cloudy', rainy: 'Rain', pouring: 'Heavy rain', snowy: 'Snow', 'snowy-rainy': 'Sleet',
    fog: 'Fog', hail: 'Hail', lightning: 'Thunderstorms', 'lightning-rainy': 'Thunderstorms', windy: 'Windy', 'windy-variant': 'Windy', exceptional: 'Severe weather' };   // weather/app.js, V.words
  const keyOf = p => p.lat.toFixed(3) + ',' + p.lon.toFixed(3);   // weather/app.js, keyOf
  const ok = b => b && b.cur && Array.isArray(b.daily) && Number.isFinite(b.cur.tF);
  const okPlace = p => p && Number.isFinite(p.lat) && Number.isFinite(p.lon);
  let fetching = null;
  function refreshWeather() {
    if (fetching) return fetching;
    if (typeof WXD === 'undefined' || !navigator.onLine) return Promise.resolve(false);
    const here = get('wx.here'), places = get('wx.places'), p = okPlace(here) ? here : Array.isArray(places) && okPlace(places[0]) ? places[0] : null;
    if (!p) return Promise.resolve(false);   // Weather hasn't found a place yet: it asks for one, aOS doesn't
    const k = keyOf(p), was = (get('wx.cache') || {})[k];
    if (ok(was) && Date.now() - (was.fetchedAt || 0) < 10 * 60e3) return Promise.resolve(false);
    return (fetching = WXD.fetchBase(p.lat, p.lon).then(base => {
      if (!ok(base) || !Array.isArray(base.hourly)) return false;
      const cache = get('wx.cache'), all = cache && typeof cache === 'object' && !Array.isArray(cache) ? cache : {};
      if (all[k] && all[k].fetchedAt > Date.now() - 60e3) return false;   // Weather got one meanwhile
      all[k] = Object.assign(base, { fetchedAt: Date.now(), key: k });   // as weather/app.js keeps it
      localStorage.setItem('wx.cache', JSON.stringify(all));
      return true;
    }).catch(() => false).finally(() => { fetching = null; }));
  }
  function weather() {
    const cache = get('wx.cache'); if (!cache || typeof cache !== 'object') return null;
    const here = get('wx.here'), places = get('wx.places'), at = p => okPlace(p) ? cache[keyOf(p)] : null;
    const b = [at(here), at(Array.isArray(places) && places[0])].find(ok) || Object.values(cache).find(ok);
    if (!b) return null;
    const metric = get('wx.units') === 'metric', deg = f => Math.round(metric ? (f - 32) * 5 / 9 : f) + '°';
    const tz = b.tz || undefined, inTz = t => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(t)); } catch { return ymd(new Date(t)); } };
    const today = inTz(Date.now()), d = b.daily.find(x => x && Number.isFinite(x.t) && inTz(x.t * 1000) >= today);
    const hour = new Date().getHours(), night = hour < 6 || hour >= 20;
    let text = WORDS[night && b.cur.c === 'sunny' ? 'clear-night' : b.cur.c] || '';
    const age = Date.now() - (b.fetchedAt || 0);
    if (age > 3 * 3600e3) text = (text ? text + ', ' : '') + 'as of ' + (age > 20 * 3600e3 ? day(b.fetchedAt) : time(b.fetchedAt));
    return { temp: deg(b.cur.tF), text, hilo: d && Number.isFinite(d.hF) && Number.isFinite(d.lF) ? `H ${deg(d.hF)} L ${deg(d.lF)}` : '', place: (b === at(here) && here.name) || b.place || '' };
  }

  // ---- Calendar: the Family calendar's events, as Calendar keeps them (allison-calendar-v1-items) ----
  let cals = null, calsAt = null;
  function calendars() {
    const c = get('allison-calendar-v1-items'), I = window.AllisonICal;
    if (!c || !Array.isArray(c.items) || !I) return null;
    if (calsAt !== c.at || !cals) {
      cals = { win: c.win || {}, list: c.items.map(it => { try { return { name: it.name, cal: I.parse(it.ics) }; } catch { return null; } }).filter(Boolean) };
      calsAt = c.at; occCache = {};
    }
    return cals;
  }
  let occCache = {};
  function occurrences(from, to) {
    const C = calendars(); if (!C) return [];
    from = Math.max(from, C.win.from || from); to = Math.min(to, C.win.to || to);   // iCloud only sent what's in its window
    const k = from + ':' + to; if (occCache[k]) return occCache[k];
    const I = window.AllisonICal, tz = I.localTz(), out = [];
    for (const { cal } of C.list) { try { for (const o of I.expand(cal, from, to, tz)) if (o.status !== 'CANCELLED') out.push(o); } catch {} }
    out.sort((a, b) => a.start - b.start);
    return (occCache = { [k]: out })[k];
  }
  const titleOf = o => (o.summary || '').trim() || 'New Event';   // calendar/app.js
  function next() {
    const now = Date.now(), t = new Date(); t.setHours(0, 0, 0, 0);
    const today = t.getTime(), tomorrow = today + 864e5, after = tomorrow + 864e5;
    const all = occurrences(today, after).filter(o => o.end > now || (o.allDay && o.endDate > ymd(new Date())));
    const timed = all.filter(o => !o.allDay), o = timed[0] || all[0];
    if (!o) return null;
    const when = o.allDay ? (o.startDate <= ymd(new Date()) ? 'Today' : 'Tomorrow')
      : o.start <= now ? 'Now, until ' + time(o.end) : (o.start >= tomorrow ? 'Tomorrow ' : '') + time(o.start);
    const n = timed.find(x => x !== o && x.start >= (o.allDay ? now : o.start) && x.start < (o.start >= tomorrow ? after : tomorrow));
    return { when, title: titleOf(o), then: n ? `${time(n.start)} · ${titleOf(n)}` : '', where: (o.location || '').split('\n')[0] };
  }

  // ---- what's in the apps ----
  // each app: its things as { title, also (more words to match), sub, at, when (for the order, soonest first) }
  const has = (s, q) => String(s || '').toLowerCase().includes(q);
  const SOURCES = {
    calendar(q) {
      const now = Date.now(), seen = new Set(), out = [], all = occurrences(now - 60 * 864e5, now + 365 * 864e5);
      for (const o of [...all.filter(o => o.end >= now), ...all.filter(o => o.end < now).reverse()]) {   // a repeating event once: its next time, else its last
        const id = o.uid || titleOf(o) + o.start;
        if (!has(titleOf(o) + ' ' + (o.location || ''), q) || seen.has(id)) continue;
        seen.add(id);
        out.push({ title: titleOf(o), also: o.location, sub: day(o.start) + (o.allDay ? '' : ' · ' + time(o.start)), at: `?date=${o.startDate}&view=day`, when: o.end < now ? 1e15 - o.start : o.start });
      }
      return out;
    },
    notes(q) {
      const d = get('allison-notes-v1'); if (!d) return [];
      const notes = (d.notes || []).filter(n => n && !n.deletedAt).map(n => ({ title: n.title || String(n.body || '').split('\n')[0].slice(0, 60) || 'Note', also: n.body + ' ' + (n.tags || []).join(' '), sub: n.archived ? 'Archived note' : 'Note', at: `?open=note:${n.id}`, when: -(n.updated || 0) }));
      const todos = (d.todos || []).filter(x => x && !x.done).map(x => ({ title: x.title || 'Reminder', also: x.notes, sub: 'Reminder' + (x.date ? ' · ' + day(dayOf(x.date)) : ''), at: `?open=todo:${x.id}`, when: -(x.updated || 0) }));
      return [...notes, ...todos];
    },
    travel(q) {
      const d = get('allison-travel-v1'); if (!d) return [];
      return (d.bookings || []).filter(b => b && b.status !== 'cancelled').map(b => {
        const start = b.depIso || b.checkIn || b.pickupIso || b.start || '', t = Date.parse(start) || 0;
        const title = b.type === 'flight' ? [b.airline, b.flightNo].filter(Boolean).join(' ') + (b.from || b.to ? ` ${b.from || ''} → ${b.to || ''}` : '')
          : b.type === 'hotel' ? b.name : b.type === 'car' ? [b.company, b.carClass].filter(Boolean).join(' ') : b.title;
        return { title: (title || '').trim() || 'Booking', also: [b.fromName, b.toName, b.city, b.address, b.place, b.conf].join(' '), sub: (b.type === 'other' ? 'Booking' : b.type[0].toUpperCase() + b.type.slice(1)) + (t ? ' · ' + day(t) : ''), when: t > Date.now() ? t : 1e15 - t };
      });
    },
    orders(q) {
      const d = get('allison-orders-v1'); if (!d) return [];
      const kinds = { package: true, pickup: true, food: false, digital: false, other: false, ...(d.kinds || {}), package: true };   // orders/app.js: the kinds switched off aren't shown
      return (d.orders || []).filter(o => o && !o.hide && kinds[o.kind || 'package'] !== false).map(o => {
        const items = (o.items || []).map(i => i && i.name).filter(Boolean);
        return { title: items[0] ? items[0] + (items.length > 1 ? ` and ${items.length - 1} more` : '') : o.store || 'Order', also: [o.store, ...items, o.orderNo, o.tracking].join(' '), sub: [o.store, o.status].filter(Boolean).join(' · '), when: -(Date.parse(o.orderDate) || o.updated || 0) };
      });
    },
    meals(q) {
      const d = get('allison-meals-v2'), p = d && d.plan; if (!p || !Array.isArray(p.meals)) return [];
      return p.meals.filter(m => m && m.title).map(m => { const date = p.dates && p.dates[(m.day || 1) - 1];
        return { title: m.title, also: [m.cuisine, ...(m.ingredients || []).map(i => i && i.item)].join(' '), sub: date ? 'Dinner · ' + day(dayOf(date)) : 'Dinner', when: date || '' }; });
    },
    places(q) {
      const d = get('allison-places-v1'); if (!Array.isArray(d)) return [];
      return d.filter(p => p && p.name).map(p => ({ title: p.name, also: [p.city, p.address, p.category, p.notes, ...(p.tags || [])].join(' '), sub: [p.city, p.status === 'been' ? 'Been' : 'Want to go'].filter(Boolean).join(' · '), when: -(p.updated || 0) }));
    },
    podcasts(q) {
      const d = get('allison-podcasts-v1'); if (!d) return [];
      return (d.follows || []).filter(f => f && f.title).map(f => ({ title: f.title, also: [f.author, f.genre].join(' '), sub: f.author || 'Show', at: f.feed ? '?feed=' + encodeURIComponent(f.feed) : '', when: -(f.at || 0) }));
    },
  };
  function search(q, { known = () => true, per = 3, max = 8 } = {}) {
    q = String(q || '').trim().toLowerCase(); if (q.length < 2) return [];
    const out = [];
    for (const [app, src] of Object.entries(SOURCES)) {
      if (!known(app)) continue;
      let list = []; try { list = src(q); } catch {}
      const rank = r => { const t = r.title.toLowerCase(); return t.startsWith(q) ? 0 : t.split(/[^a-z0-9]+/).some(w => w.startsWith(q)) ? 1 : t.includes(q) ? 2 : has(r.also, q) ? 3 : 9; };
      const hits = list.map(r => ({ ...r, app, rank: rank(r) })).filter(r => r.rank < 9).sort((a, b) => a.rank - b.rank || (a.when < b.when ? -1 : a.when > b.when ? 1 : 0)).slice(0, per);
      out.push(...hits);
    }
    return out.sort((a, b) => a.rank - b.rank).slice(0, max).map(({ app, title, sub, at }) => ({ app, title, sub, at: at || '' }));
  }

  window.aosFind = { weather, refreshWeather, next, search };
})();
