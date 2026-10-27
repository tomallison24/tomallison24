"use strict";

// Ipsy's tools in Weather, for Ipsy in aOS (Weather has no chat of its own). Claude asks for them by
// name through functions/aOS/api/ipsy.js (server/ipsy-weather.js describes them to it); aOS opens
// Weather out of sight and runs them here, against the same places and forecasts as the app.
// They only read and show: nothing here changes a place or a setting (units are Ipsy's settings tool,
// weather.units).
//
//   window.WeatherIpsy(app) -> { tools, label }, which app.js offers to aOS as AllisonOS.ipsyTools
//   app: the app's own pieces (weather/app.js passes them): S, keyOf, fetchBase, saveCache, soonLine,
//        getJSON, pickPlace, setView
//
// A forecast less than 20 minutes old comes from the app's own cache; an older one, or a city that
// isn't one of the person's places, is fetched the way the app does (data.js fetchBase: NWS, else
// Open-Meteo). Numbers come in the person's units (S.units), times in the place's own time zone.
window.WeatherIpsy = function (app) {
  const { S, keyOf } = app;
  const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);
  const fail = msg => { throw new Error(msg); };
  const FRESH = 20 * 60 * 1000;
  const VIEWS = ['now', 'feels', 'humidity', 'wind', 'radar'];

  // ---- units: the forecast is kept in °F, mph and inches (data.js); metric is °C, km/h and mm ----
  const metric = () => S.units === 'metric';
  const num = v => typeof v === 'number' && Number.isFinite(v);
  const temp = f => num(f) ? Math.round(metric() ? (f - 32) * 5 / 9 : f) : null;
  const wind = m => num(m) ? Math.round(metric() ? m * 1.609344 : m) : null;
  const precip = (b, r) => !num(r) ? null : b.rKind === 'pop' ? Math.round(r) + '%' : metric() ? (r * 25.4).toFixed(1) + ' mm' : r.toFixed(2) + ' in';
  const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const from = d => num(d) ? POINTS[Math.round(((d % 360) + 360) % 360 / 22.5) % 16] : null;
  // a moment as the place's own local "YYYY-MM-DDTHH:MM" (or day "YYYY-MM-DD")
  function local(ms, tz, day) {
    const d = new Date(ms); if (isNaN(d)) return null;
    let p; try { p = new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d); }
    catch { p = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d); }
    const g = t => (p.find(x => x.type === t) || {}).value;
    return g('year') + '-' + g('month') + '-' + g('day') + (day ? '' : 'T' + g('hour') + ':' + g('minute'));
  }

  // ---- the person's places: where they are, their next trip (from Travel), their saved cities ----
  function places() {
    const out = [];
    if (S.here) out.push({ id: 'here', name: S.here.name || 'My Location', kind: 'where you are', lat: S.here.lat, lon: S.here.lon });
    if (S.trip) out.push({ id: 'trip', name: S.trip.name, sub: S.trip.sub || '', kind: 'your next trip' + (S.trip.from ? ', ' + S.trip.from + (S.trip.to && S.trip.to !== S.trip.from ? ' to ' + S.trip.to : '') : ''), lat: S.trip.lat, lon: S.trip.lon });
    S.places.forEach((p, i) => out.push({ id: 'p' + i, name: p.name, sub: p.sub || '', kind: 'saved', lat: p.lat, lon: p.lon }));
    return out;
  }
  // a place by id, by one of the person's own place names, or else any city, looked up as the app's search does
  async function placeFor(q) {
    const w = clip(q, 80);
    if (!w) fail('Say which place: an id from get_places, or a city.');
    const mine = places(), lw = w.toLowerCase();
    const hit = mine.find(p => p.id === w) || mine.find(p => p.name.toLowerCase() === lw) || mine.find(p => (p.name + ', ' + (p.sub || '')).toLowerCase().startsWith(lw));
    if (hit) return hit;
    let j = null;
    try { j = await app.getJSON('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(w.split(',')[0].trim()) + '&count=8&language=en&format=json', { headers: {} }); }
    catch { fail('Couldn\'t look up ' + w + ' just now (no connection?).'); }
    const list = ((j && j.results) || []).filter(r => Number.isFinite(+r.latitude) && Number.isFinite(+r.longitude) && r.name);
    const rest = w.split(',').slice(1).join(',').trim().toLowerCase();
    const r = (rest && list.find(x => [x.admin1, x.country, x.country_code].some(v => v && v.toLowerCase() === rest))) || list[0];
    if (!r) fail('No place called ' + w + ' was found.');
    return { id: '', name: r.name, sub: [r.admin1, r.country].filter(Boolean).join(', '), kind: 'looked up', lat: +r.latitude, lon: +r.longitude };
  }
  // its forecast: the app's own if fresh, else fetched (and kept, for one of the person's places)
  async function forecastOf(p) {
    const key = keyOf(p), c = S.cache[key];
    if (c && c.v === 3 && Date.now() - c.fetchedAt < FRESH) return c;
    let base;
    try { base = await app.fetchBase(p.lat, p.lon); }
    catch { if (c) return c; fail('The forecast for ' + p.name + ' didn\'t load just now (no connection?).'); }
    const data = Object.assign(base, { fetchedAt: Date.now(), key });
    if (p.id) { S.cache[key] = data; app.saveCache(); }
    return data;
  }

  const tools = {
    async get_places() {
      const list = places();
      return { content: { units: metric() ? 'metric (°C, km/h)' : 'US (°F, mph)', on_screen: S.loc ? S.loc.name : null,
        places: list.map(p => { const c = S.cache[keyOf(p)]; return { id: p.id, name: p.name, ...(p.sub ? { region: p.sub } : {}), kind: p.kind, ...(c && c.cur ? { now: temp(c.cur.tF), condition: c.cur.c } : {}) }; }) } };
    },
    async get_forecast(q) {
      const p = await placeFor(q.place), b = await forecastOf(p), tz = b.tz;
      const hours = Math.max(0, Math.min(48, Number.isInteger(q.hours) ? q.hours : 12)), days = Math.max(0, Math.min(7, Number.isInteger(q.days) ? q.days : 7));
      const now = Date.now(), cur = b.cur || {};
      return { content: {
        place: p.name + (p.sub ? ', ' + p.sub : ''), ...(p.id ? { id: p.id } : {}), source: b.src, as_of: local(b.fetchedAt, tz), time_zone: tz || null,
        units: metric() ? { temperature: '°C', wind: 'km/h' } : { temperature: '°F', wind: 'mph' },
        precipitation_means: b.rKind === 'pop' ? 'chance of rain or snow' : 'amount expected',
        now: { condition: cur.c || null, temperature: temp(cur.tF), feels_like: temp(cur.fF), humidity: num(cur.hum) ? Math.round(cur.hum) + '%' : null, wind: wind(cur.mph), wind_from: from(cur.deg) },
        rain_soon: app.soonLine(b, now / 1000) || null,
        hourly: (b.hourly || []).filter(h => h.t * 1000 > now - 3600e3).slice(0, hours).map(h => ({ time: local(h.t * 1000, tz), condition: h.c, temperature: temp(h.pF), feels_like: temp(h.fF), precipitation: precip(b, h.r), wind: wind(h.mph) })),
        daily: (b.daily || []).slice(0, days).map(d => ({ date: local(d.t * 1000, tz, true), condition: d.c, high: temp(d.hF), low: temp(d.lF), precipitation: precip(b, d.r), ...(d.dt ? { day: clip(d.dt, 600) } : {}), ...(d.nt ? { night: clip(d.nt, 600) } : {}) })),
        alerts: (b.alerts || []).map(a => ({ event: clip(a.event, 120), severity: a.severity || null, headline: clip(a.headline, 300), ...(a.ends ? { ends: local(Date.parse(a.ends), tz) } : {}), what: clip(a.desc, 800), ...(a.instr ? { what_to_do: clip(a.instr, 500) } : {}) })),
        ...(b.note ? { note: b.note } : {}),
      } };
    },
    // the place, and a view of its timeline, on Weather's screen: aOS brings Weather to the front
    async show_place(q) {
      const p = await placeFor(q.place);
      if (!p.id) fail(p.name + ' isn\'t one of their places, so Weather can\'t show it. They can add it with Weather\'s search.');
      if (q.view) { if (!VIEWS.includes(q.view)) fail('view is one of ' + VIEWS.join(', ') + '.'); app.setView(q.view); }
      app.pickPlace(p.id);
      try { if (window.top !== window && window.top.aosHomeTab) window.top.aosHomeTab.show('weather'); } catch {}
      return { content: { shown: p.name, ...(q.view ? { view: q.view } : {}), note: 'Weather is open on it behind the chat; closing the chat shows it.' } };
    },
  };

  const LABELS = {
    get_places: () => 'Looking at your places', get_forecast: i => 'Checking the forecast' + (i.place && !/^(here|trip|p\d+)$/.test(i.place) ? ' for ' + clip(i.place, 30) : ''),
    show_place: () => 'Opening the forecast',
  };
  return { tools, label: (name, input) => (LABELS[name] ? LABELS[name](input || {}) : '') };
};
