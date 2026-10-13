// AllisonOS weather data: the forecast and the current conditions for a place,
// from the National Weather Service (Open-Meteo outside the US or when it is
// down). Weather's own; Home loads it too (../weather/data.js) for its weather
// pill, so the two always read alike. Everything is on WXD; nothing else is
// global. The /points lookups are cached in localStorage as wx.pts, which both
// apps share (one origin).
'use strict';
const WXD = (() => {
const store = {
  get(k, d) { try { const v = localStorage.getItem('wx.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('wx.' + k, JSON.stringify(v)); } catch (e) {} }
};
const inUS = (lat, lon) => lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66;

// ===========================================================================
// DATA. The National Weather Service is the source for any US location:
// its forecast is the official one, edited by the local forecast office,
// and it carries the official watches and warnings. Open-Meteo is the
// fallback, outside the US (where /points 404s) or when api.weather.gov is
// down, so the app never goes blank.
//
// Both sources are normalised to one BASE shape, always in US units, and
// cached as that:
//   { src, lat, lon, tz, place,
//     cur:    { tF, fF (feels like), hum, mph, deg, c },
//     hourly: [{ t, c, pF, r, fF, hum, mph, deg }],  next 24 hours from this one
//     v:      2 (older caches lack feels-like, humidity and wind per hour and are refetched)
//     daily:  [{ t, c, hF, lF, r }],    7 days from today
//     rKind:  'pop' (chance, %) | 'in' (amount, inches),
//     alerts: [{ event, severity, headline, ends, desc }] }
// model() turns BASE into what the card templates read, doing the unit
// conversion and the day/night maths at render time, so a unit switch or a
// sunset never needs a fetch.
// ===========================================================================


// ---- Condition strings (HA's vocabulary, which the card speaks) ----

// WMO weather code (Open-Meteo) -> HA condition. Day/night is applied later.
function wmo(code) {
  if (code <= 1) return 'sunny';
  if (code === 2) return 'partlycloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code === 65 || code === 82) return 'pouring';
  if ([56, 57, 66, 67].includes(code)) return 'snowy-rainy';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snowy';
  if (code >= 95) return 'lightning-rainy';
  if (code >= 51 && code <= 81) return 'rainy';
  return 'cloudy';
}

// NWS: the icon URL carries a condition code (".../land/day/tsra_sct,40?..."),
// which is more regular than the prose; the short forecast text is the
// fallback when there is no icon, and decides "heavy" rain.
const NWS_CODES = {
  skc: 'sunny', few: 'sunny', sct: 'partlycloudy', bkn: 'cloudy', ovc: 'cloudy',
  wind_skc: 'windy', wind_few: 'windy', wind_sct: 'windy-variant', wind_bkn: 'windy-variant', wind_ovc: 'windy-variant',
  snow: 'snowy', blizzard: 'snowy', rain_snow: 'snowy-rainy', rain_sleet: 'snowy-rainy', snow_sleet: 'snowy-rainy',
  fzra: 'snowy-rainy', rain_fzra: 'snowy-rainy', snow_fzra: 'snowy-rainy', sleet: 'snowy-rainy',
  rain: 'rainy', rain_showers: 'rainy', rain_showers_hi: 'rainy',
  tsra: 'lightning-rainy', tsra_sct: 'lightning-rainy', tsra_hi: 'lightning-rainy',
  tornado: 'exceptional', hurricane: 'exceptional', tropical_storm: 'exceptional',
  dust: 'fog', smoke: 'fog', haze: 'fog', fog: 'fog', hot: 'sunny', cold: 'sunny'
};
function nwsText(s) {
  s = (s || '').toLowerCase();
  if (/tornado|hurricane|tropical storm/.test(s)) return 'exceptional';
  if (/thunder|t-storm|tstorm/.test(s)) return 'lightning-rainy';
  if (/sleet|freezing|ice pellet|wintry mix/.test(s)) return 'snowy-rainy';
  if (/snow|flurr|blizzard/.test(s)) return /rain/.test(s) ? 'snowy-rainy' : 'snowy';
  if (/hail/.test(s)) return 'hail';
  if (/heavy rain|downpour/.test(s)) return 'pouring';
  if (/rain|shower|drizzle/.test(s)) return 'rainy';
  if (/fog|haze|smoke|mist|dust/.test(s)) return 'fog';
  if (/wind|breez|blustery|gust/.test(s)) return 'windy';
  if (/mostly cloudy|overcast|^cloudy|considerable cloud/.test(s)) return 'cloudy';
  if (/partly|mostly sunny|mostly clear|few clouds|increasing clouds|decreasing clouds/.test(s)) {
    return /mostly (sunny|clear)|few clouds/.test(s) ? 'sunny' : 'partlycloudy';
  }
  if (/sunny|clear|fair|hot|cold/.test(s)) return 'sunny';
  if (/cloud/.test(s)) return 'cloudy';
  return 'cloudy';
}
function nwsCondition(icon, text) {
  const m = /\/icons\/land\/(?:day|night)\/([a-z_]+)/.exec(icon || '');
  let c = (m && NWS_CODES[m[1]]) || nwsText(text);
  if (c === 'rainy' && /heavy/i.test(text || '')) c = 'pouring';
  return c;
}


// ---- NWS ----
const SEV = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3 };
// Every request gives up after 15 seconds (headers and body), so a dead connection
// (common when iOS wakes the app) cannot leave the app waiting forever.
async function getJSON(url, opts) {
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 15000);
  try {
    const r = await fetch(url, Object.assign({ headers: { Accept: 'application/geo+json' } }, opts, { signal: ac.signal }));
    if (!r.ok) { const e = new Error(`${new URL(url, location.href).hostname} ${r.status}`); e.status = r.status; throw e; }
    return await r.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`${new URL(url, location.href).hostname} did not answer`);
    throw e;
  } finally { clearTimeout(timer); }
}
const dirDeg = d => ({ N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5 })[d];
const mphOf = s => { const m = /(\d+)(?:\s*to\s*(\d+))?/.exec(s || ''); return m ? +(m[2] || m[1]) : null; };
const cToF = c => c * 9 / 5 + 32;
// "Feels like", the NWS way: wind chill when it is 50F or colder and breezy,
// heat index (the Rothfusz regression, with its two adjustments) from 80F up,
// otherwise just the air temperature. T in F, RH in %, W in mph.
function feelsF(T, RH, W) {
  if (T == null) return null;
  if (T <= 50 && W != null && W > 3) {
    const v = Math.pow(W, 0.16);
    return Math.round(35.74 + 0.6215 * T - 35.75 * v + 0.4275 * T * v);
  }
  if (T >= 80 && RH != null) {
    let hi = 0.5 * (T + 61 + (T - 68) * 1.2 + RH * 0.094);
    if ((hi + T) / 2 >= 80) {
      hi = -42.379 + 2.04901523 * T + 10.14333127 * RH - 0.22475541 * T * RH - 0.00683783 * T * T - 0.05481717 * RH * RH
        + 0.00122874 * T * T * RH + 0.00085282 * T * RH * RH - 0.00000199 * T * T * RH * RH;
      if (RH < 13 && T <= 112) hi -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
      else if (RH > 85 && T <= 87) hi += ((RH - 85) / 10) * ((87 - T) / 5);
    }
    return Math.round(hi);
  }
  return Math.round(T);
}
const ymd = (t, tz) => new Date(t * 1000).toLocaleDateString('en-CA', { timeZone: tz });
const kmBetween = (a, b, c, d) => {
  const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};
// The forecast temperature at any moment: hourly values joined in a straight line, so 3:40 is
// most of the way from 3:00's to 4:00's. A moment just before the first hour takes that hour.
const tempAt = (list, t) => {
  if (!list || !list.length || t < list[0].t - 7200) return null;
  if (t < list[0].t) return list[0].pF;
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i], b = list[i + 1];
    if (a.t <= t && t < b.t) return a.pF + (b.pF - a.pF) * (t - a.t) / (b.t - a.t);
  }
  return null;
};

async function fromNWS(lat, lon, retried) {
  // /points is the only lookup that turns a position into a forecast office
  // grid; it hardly ever changes, so it is cached per location.
  const pk = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const pts = store.get('pts', {});
  let pt = pts[pk];
  if (pt && pt.pv !== 2) pt = null;                    // saved before stations had a distance: look again
  const cachedPt = !!pt;
  if (!pt) {
    const p = (await getJSON(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`)).properties;
    const st = await getJSON(p.observationStations).catch(() => null);
    const rl = p.relativeLocation && p.relativeLocation.properties;
    // The nearest station by actual distance (of the few NWS lists first), and the hourly
    // forecast for the station's own spot, so its reading can be checked against what NWS
    // expected there.
    const fs = (st && st.features) || [];
    const near = fs.slice(0, 6).filter(f => f.geometry && Array.isArray(f.geometry.coordinates))
      .map(f => ({ id: f.properties.stationIdentifier, name: f.properties.name || null, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }))
      .map(s => Object.assign(s, { km: kmBetween(lat, lon, s.lat, s.lon) }))
      .sort((a, b) => a.km - b.km)[0] || null;
    let sHourly = null;
    if (near && near.km < 1.5) sHourly = p.forecastHourly;   // same grid square as the place
    else if (near) {
      try { sHourly = (await getJSON(`https://api.weather.gov/points/${near.lat.toFixed(4)},${near.lon.toFixed(4)}`)).properties.forecastHourly || null; }
      catch (e) { /* no correction then; the forecast for the place stands */ }
    }
    pt = {
      key: pk, forecast: p.forecast, hourly: p.forecastHourly, tz: p.timeZone,
      station: near ? near.id : (fs[0] ? fs[0].properties.stationIdentifier : null),
      sName: near ? near.name : null, sKm: near ? Math.round(near.km * 10) / 10 : null, sHourly,
      city: rl ? rl.city : null, pv: 2
    };
    pts[pk] = pt;
    const ks = Object.keys(pts);
    for (const k of ks.slice(0, Math.max(0, ks.length - 24))) delete pts[k];
    store.set('pts', pts);
  }
  let fc, hr, obs, al, sh;
  try {
  [fc, hr, obs, al, sh] = await Promise.all([
    getJSON(pt.forecast),
    getJSON(pt.hourly),
    pt.station ? getJSON(`https://api.weather.gov/stations/${pt.station}/observations/latest`).catch(() => null) : null,
    getJSON(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`).catch(() => null),
    pt.sHourly && pt.sHourly !== pt.hourly ? getJSON(pt.sHourly).catch(() => null) : null
  ]);
  } catch (e) {
    // The office or grid behind a cached lookup can change; look the place up afresh, once.
    if (cachedPt && !retried && (e.status === 404 || e.status === 301)) { delete pts[pk]; store.set('pts', pts); return fromNWS(lat, lon, true); }
    throw e;
  }
  const now = Date.now() / 1000, tz = pt.tz;
  const HA = hr.properties.periods.map(p => ({
    t: Date.parse(p.startTime) / 1000,
    c: nwsCondition(p.icon, p.shortForecast),
    pF: p.temperatureUnit === 'C' ? Math.round(cToF(p.temperature)) : p.temperature,
    r: (p.probabilityOfPrecipitation && p.probabilityOfPrecipitation.value) || 0,
    hum: p.relativeHumidity ? p.relativeHumidity.value : null,
    mph: mphOf(p.windSpeed), deg: dirDeg(p.windDirection)
  }));
  const HP = HA.filter(p => p.t > now - 3600);
  if (!HP.length) throw new Error('NWS hourly forecast is empty');

  // Current temperature: the NWS forecast for this exact spot at this minute, corrected by
  // the nearest station's latest reading - by how far that reading is from what NWS
  // expected at the station itself, so the station being warmer or cooler as a place
  // isn't copied over. Only a station within 25 km that reported in the last 90 minutes
  // counts, and the correction is held to 8°F either way (a bad sensor shouldn't run the
  // screen). Without one, the forecast for the spot stands. Station values are metric.
  const h0 = HP[0];
  const o = obs && obs.properties;
  const oF = o && o.temperature && o.temperature.value != null ? cToF(o.temperature.value) : null;
  const oAt = o ? Date.parse(o.timestamp) / 1000 : NaN;
  const usable = oF != null && now - oAt < 90 * 60 && pt.sKm != null && pt.sKm <= 25;
  const fHere = tempAt(HA, now) ?? h0.pF;
  const SA = pt.sHourly === pt.hourly ? HA
    : sh && sh.properties && sh.properties.periods ? sh.properties.periods.map(p => ({ t: Date.parse(p.startTime) / 1000, pF: p.temperatureUnit === 'C' ? cToF(p.temperature) : p.temperature })) : null;
  const fThere = usable ? tempAt(SA, oAt) : null;
  let tF = fHere, how = { kind: 'forecast' };
  if (usable && fThere != null) {
    const adj = Math.max(-8, Math.min(8, oF - fThere));
    tF = fHere + adj;
    how = { kind: 'corrected', st: pt.station, name: pt.sName, km: pt.sKm, at: oAt, adj: Math.round(adj * 10) / 10 };
  } else if (usable && pt.sKm <= 5) {
    tF = oF;                                           // close enough to stand in for the spot
    how = { kind: 'station', st: pt.station, name: pt.sName, km: pt.sKm, at: oAt };
  }
  // Humidity, wind and the sky: measured when the station counts, else this hour's forecast.
  const cur = usable ? {
    tF,
    hum: o.relativeHumidity && o.relativeHumidity.value != null ? o.relativeHumidity.value : h0.hum,
    mph: o.windSpeed && o.windSpeed.value != null ? o.windSpeed.value / 1.609344 : h0.mph,
    deg: o.windDirection && o.windDirection.value != null ? o.windDirection.value : h0.deg,
    c: o.textDescription ? nwsCondition(o.icon, o.textDescription) : h0.c, how
  } : { tF, hum: h0.hum, mph: h0.mph, deg: h0.deg, c: h0.c, how };
  cur.fF = feelsF(cur.tF, cur.hum, cur.mph);

  // Days: NWS's own 12-hour periods, a day's high paired with that night's
  // low, the way weather.gov prints its 7-day. After about 6pm the first
  // period is already "Tonight" and today's forecast high is gone, so today's
  // high becomes the highest temperature the station actually recorded today.
  const P = fc.properties.periods.map(p => ({
    t: Date.parse(p.startTime) / 1000, day: p.isDaytime,
    temp: p.temperatureUnit === 'C' ? Math.round(cToF(p.temperature)) : p.temperature,
    c: nwsCondition(p.icon, p.shortForecast),
    r: (p.probabilityOfPrecipitation && p.probabilityOfPrecipitation.value) || 0,
    tx: typeof p.detailedForecast === 'string' ? p.detailedForecast.slice(0, 600) : ''
  }));
  const byDate = {};
  for (const p of P) {
    const k = ymd(p.t, tz);
    const d = byDate[k] || (byDate[k] = { t: p.t, key: k });
    if (p.day) { d.hF = p.temp; d.c = p.c; d.r = p.r; d.t = p.t; d.dt = p.tx; }
    else { d.lF = p.temp; d.cn = p.c; d.r = Math.max(d.r || 0, p.r); d.nt = p.tx; }
  }
  const today = ymd(now, tz);
  const days = Object.values(byDate).sort((a, b) => a.t - b.t).filter(d => d.key >= today);
  if (days[0] && days[0].key === today && days[0].hF == null) {
    let hi = cur.tF;
    if (pt.station && (pt.sKm == null || pt.sKm <= 25)) {
      try {
        const start = new Date(Date.now() - 86400000).toISOString();
        const list = await getJSON(`https://api.weather.gov/stations/${pt.station}/observations?start=${encodeURIComponent(start)}`);
        for (const f of list.features || []) {
          const v = f.properties.temperature && f.properties.temperature.value;
          if (v != null && ymd(Date.parse(f.properties.timestamp) / 1000, tz) === today) hi = Math.max(hi, cToF(v));
        }
      } catch (e) { /* keep the current reading as the floor */ }
    }
    days[0].hF = Math.round(hi);
    days[0].c = days[0].cn;
  }
  const daily = days.filter(d => d.hF != null && d.lF != null).slice(0, 7)
    .map(d => ({ t: d.t, c: d.c || d.cn, hF: d.hF, lF: d.lF, r: d.r || 0, dt: d.dt || '', nt: d.nt || '' }));
  // The last day often has a high but no night yet; use the hourly low for it.
  const last = days[days.length - 1];
  if (daily.length < 7 && last && last.hF != null && last.lF == null) {
    const hs = HP.filter(h => ymd(h.t, tz) === last.key).map(h => h.pF);
    if (hs.length) daily.push({ t: last.t, c: last.c, hF: last.hF, lF: Math.min.apply(null, hs), r: last.r || 0, dt: last.dt || '', nt: '' });
  }

  const alerts = ((al && al.features) || []).map(f => f.properties)
    .filter(a => a.status === 'Actual' && a.messageType !== 'Cancel')
    .map(a => ({ event: a.event, severity: a.severity, headline: a.headline, ends: a.ends || a.expires, desc: a.description, instr: a.instruction }))
    .sort((a, b) => (SEV[a.severity] ?? 4) - (SEV[b.severity] ?? 4))      // most severe first, so a Tornado Warning is never the one cut
    .slice(0, 6);

  return {
    src: 'NWS', lat, lon, tz, place: pt.city, rKind: 'pop', cur,
    hourly: HP.slice(0, 168).map(h => ({ t: h.t, c: h.c, pF: h.pF, r: h.r, fF: feelsF(h.pF, h.hum, h.mph), hum: h.hum, mph: h.mph, deg: h.deg })),
    daily, alerts, v: 3
  };
}

// ---- Open-Meteo (fallback) ----
async function fromOpenMeteo(lat, lon) {
  const om = await getJSON('https://api.open-meteo.com/v1/forecast'
    + `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`
    + '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,apparent_temperature'
    + '&hourly=temperature_2m,weather_code,precipitation,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum'
    + '&timezone=auto&timeformat=unixtime&forecast_days=8'
    + '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch');
  const cur = om.current, H = om.hourly, D = om.daily;
  const now = Date.now() / 1000;
  const r2 = x => Math.round((x || 0) * 100) / 100;
  let c = wmo(cur.weather_code);
  // WMO has no wind code; a strong sustained wind under a dry sky is `windy`.
  if (cur.wind_speed_10m >= 25 && cur.weather_code <= 3) c = 'windy';
  const hourly = [];
  for (let i = 0; i < H.time.length && hourly.length < 168; i++) {
    if (H.time[i] > now - 3600) hourly.push({ t: H.time[i], c: wmo(H.weather_code[i]), pF: Math.round(H.temperature_2m[i]), r: r2(H.precipitation[i]),
      fF: H.apparent_temperature ? Math.round(H.apparent_temperature[i]) : null, hum: H.relative_humidity_2m ? H.relative_humidity_2m[i] : null,
      mph: H.wind_speed_10m ? Math.round(H.wind_speed_10m[i]) : null, deg: H.wind_direction_10m ? H.wind_direction_10m[i] : null });
  }
  const ti = Math.max(0, D.time.findIndex((t, i) => t <= now && (D.time[i + 1] == null || D.time[i + 1] > now)));
  const daily = [];
  for (let i = ti; i < D.time.length && daily.length < 7; i++) {
    daily.push({ t: D.time[i], c: wmo(D.weather_code[i]), hF: Math.round(D.temperature_2m_max[i]), lF: Math.round(D.temperature_2m_min[i]), r: r2(D.precipitation_sum[i]) });
  }
  return {
    src: 'Open-Meteo', lat, lon, tz: om.timezone, place: null, rKind: 'in',
    cur: { tF: cur.temperature_2m, hum: cur.relative_humidity_2m, mph: cur.wind_speed_10m, deg: cur.wind_direction_10m, c,
      fF: cur.apparent_temperature != null ? Math.round(cur.apparent_temperature) : feelsF(cur.temperature_2m, cur.relative_humidity_2m, cur.wind_speed_10m) },
    hourly, daily, alerts: [], v: 3
  };
}

// ---- Rain starting or stopping (continental US) ----
// Open-Meteo's 15-minute precipitation, which over North America is NOAA's HRRR model (1 km,
// run every hour), for the next six hours. Each value is the total for the 15 minutes before
// its time, so a slot is kept as [its start, 0 dry / 1 rain / 2 snow]. Snowfall is in cm; 7 cm
// of snow is about 10 mm of water, so a slot is snow when snow makes up at least half of it.
async function fromNowcast(lat, lon) {
  const om = await getJSON('https://api.open-meteo.com/v1/forecast'
    + `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`
    + '&minutely_15=precipitation,snowfall&past_minutely_15=1&forecast_minutely_15=24&timeformat=unixtime&timezone=auto');
  const M = om.minutely_15;
  if (!M || !Array.isArray(M.time) || !Array.isArray(M.precipitation)) throw new Error('No 15-minute forecast');
  return M.time.map((t, i) => {
    const mm = M.precipitation[i] || 0, snow = ((M.snowfall && M.snowfall[i]) || 0) * 10 / 7;
    return [t - 900, mm < 0.1 ? 0 : snow >= mm / 2 ? 2 : 1];
  });
}


// One place's forecast: the NWS, or Open-Meteo when that fails.
async function fetchBase(lat, lon) {
  let base, nwsErr = null;
  const soon = inUS(lat, lon) ? fromNowcast(lat, lon).catch(() => null) : null;   // no line rather than no forecast
  try { base = await fromNWS(lat, lon); }
  catch (e) { nwsErr = e; base = await fromOpenMeteo(lat, lon); }
  if (nwsErr && nwsErr.status !== 404) base.note = 'NWS unavailable';
  const s = await soon;
  if (s) base.soon = s;
  return base;
}


return { SEV, getJSON, dirDeg, mphOf, cToF, feelsF, ymd, kmBetween, tempAt, wmo, nwsCondition, inUS, fromNWS, fromOpenMeteo, fromNowcast, fetchBase };
})();
