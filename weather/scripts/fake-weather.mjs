// Made-up weather for Weather's browser test: the National Weather Service, Open-Meteo,
// BigDataCloud and the map-tile hosts, answered by Playwright's route interception with
// invented data in the shapes the real services send (no real place, no network). Used by
// scripts/app-test.mjs. Raleigh's coordinates are only a spot in the continental US, so the
// radar and the rain line are offered.
import zlib from 'node:zlib';

export const PLACE = { lat: 35.7796, lon: -78.6382, city: 'Raleigh' };

// ---- a tiny PNG writer, for the radar and map tiles ----
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => {
  const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};
export function png(w, h, pixel) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 4 + 1) + 1 + x * 4, p = pixel(x, y); raw[o] = p[0]; raw[o + 1] = p[1]; raw[o + 2] = p[2]; raw[o + 3] = p[3]; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const BASE_TILE = png(64, 64, (x, y) => (x % 32 === 0 || y % 32 === 0) ? [44, 50, 60, 255] : [22, 25, 31, 255]);
const RADAR_TILE = png(64, 64, (x, y) => {
  const d = Math.hypot(x - 28, y - 34);
  return d < 9 ? [220, 50, 40, 230] : d < 17 ? [240, 200, 40, 200] : d < 27 ? [60, 190, 90, 170] : [0, 0, 0, 0];
});

// ---- the forecast ----
// cond: an NWS icon code ('few' sunny, 'sct' partly, 'ovc' cloudy, 'rain', 'tsra', 'snow', 'fog', 'wind_sct')
// and its words; opts: { cond, alerts, rainSoon, directHrrr: false to refuse the model run's time the way IEM does for other sites,
// now: the time the page's clock is set to, in milliseconds (the test sets it from TEST_NOW) }
const WORDS = { few: 'Mostly Sunny', sct: 'Partly Cloudy', ovc: 'Cloudy', rain: 'Rain Showers', tsra: 'Thunderstorms', snow: 'Snow', fog: 'Fog', wind_sct: 'Windy' };
const day = (code, isDay) => `https://api.weather.gov/icons/land/${isDay ? 'day' : 'night'}/${code}?size=medium`;

export async function installWeather(ctx, opts = {}) {
  const cond = opts.cond || 'few', words = WORDS[cond] || 'Cloudy', wet = ['rain', 'tsra', 'snow'].includes(cond);
  const now = opts.now || Date.now(), hour0 = Math.floor(now / 3600e3) * 3600e3;
  const OFF = 4 * 3600e3;                                         // Raleigh in EDT: local = UTC - 4h
  const midnight = Math.floor((now - OFF) / 86400e3) * 86400e3 + OFF;   // local midnight, as UTC milliseconds
  const iso = ms => new Date(ms).toISOString();
  const temp = ms => Math.round(63 + 15 * Math.sin(((ms - OFF) / 3600e3 % 24 - 9) / 24 * 2 * Math.PI));
  const calls = { points: 0, forecast: 0, hourly: 0, nowcast: 0, radarTiles: 0, forecastTiles: 0, baseTiles: 0 };

  const hourly = Array.from({ length: 168 }, (_, i) => {
    const t = hour0 + i * 3600e3, h = ((t - OFF) / 3600e3) % 24, isDay = h >= 7 && h < 19;
    const code = i % 7 === 3 && !wet ? 'sct' : i % 9 === 5 && !wet ? 'rain_showers' : cond;
    return { number: i + 1, startTime: iso(t), endTime: iso(t + 3600e3), isDaytime: isDay, temperature: temp(t), temperatureUnit: 'F',
      probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: wet ? 40 + (i * 7) % 50 : (i % 9 === 5 ? 35 : (i * 5) % 12) },
      relativeHumidity: { unitCode: 'wmoUnit:percent', value: 48 + (i * 3) % 35 },
      windSpeed: (6 + (i * 2) % 12) + ' mph', windDirection: ['SW', 'W', 'WNW', 'NW', 'S'][i % 5],
      icon: day(code, isDay), shortForecast: WORDS[code] || (code === 'rain_showers' ? 'Rain Showers' : words) };
  });
  const periods = [];
  for (let d = 0; d < 7; d++) {
    for (const [isDay, hr] of [[true, 6], [false, 18]]) {
      const t = midnight + d * 86400e3 + hr * 3600e3;
      periods.push({ number: periods.length + 1, name: isDay ? (d ? 'Day ' + d : 'Today') : 'Night ' + d, startTime: iso(t), endTime: iso(t + 12 * 3600e3), isDaytime: isDay,
        temperature: isDay ? 78 + [0, 4, -3, -9, -12, -5, 2][d] : 58 + [0, 3, -4, -10, -13, -6, 1][d], temperatureUnit: 'F',
        probabilityOfPrecipitation: { value: wet || d === 2 ? 60 : d === 4 ? 25 : 0 }, icon: day(d === 2 ? 'rain' : d === 3 ? 'ovc' : cond, isDay),
        shortForecast: d === 2 ? 'Rain' : words,
        detailedForecast: `${words}, with a high near ${78 + [0, 4, -3, -9, -12, -5, 2][d]}. Light winds from the southwest around 8 mph. This is made-up text for a test.` });
    }
  }
  const alerts = opts.alerts ? [{ properties: { status: 'Actual', messageType: 'Alert', event: 'Wind Advisory', severity: 'Moderate', headline: 'Wind Advisory until 8 PM',
    ends: iso(now + 6 * 3600e3), description: 'Southwest winds 20 to 30 mph with gusts up to 45 mph expected. Made-up text for a test.', instruction: 'Secure outdoor objects.' } },
    { properties: { status: 'Actual', messageType: 'Alert', event: 'Flood Watch', severity: 'Severe', headline: 'Flood Watch', ends: iso(now + 30 * 3600e3), description: 'Heavy rain may cause flooding. Made-up text for a test.', instruction: '' } }] : [];

  await ctx.route('https://api.weather.gov/**', route => {
    const u = new URL(route.request().url()), p = u.pathname;
    const json = body => route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });
    if (p.startsWith('/points/')) { calls.points++; return json({ properties: { forecast: 'https://api.weather.gov/gridpoints/RAH/1,1/forecast', forecastHourly: 'https://api.weather.gov/gridpoints/RAH/1,1/forecast/hourly',
      observationStations: 'https://api.weather.gov/gridpoints/RAH/1,1/stations', timeZone: 'America/New_York', relativeLocation: { properties: { city: PLACE.city, state: 'NC' } } } }); }
    if (p.endsWith('/stations')) return json({ features: [{ geometry: { coordinates: [PLACE.lon + 0.02, PLACE.lat + 0.01] }, properties: { stationIdentifier: 'KRDU', name: 'Raleigh-Durham Airport' } }] });
    if (p.endsWith('/forecast/hourly')) { calls.hourly++; return json({ properties: { periods: hourly } }); }
    if (p.endsWith('/forecast')) { calls.forecast++; return json({ properties: { periods } }); }
    if (p.endsWith('/observations/latest')) return json({ properties: { timestamp: iso(now - 600e3), textDescription: words, icon: day(cond, hourly[0].isDaytime),
      temperature: { value: (hourly[0].temperature + 1 - 32) * 5 / 9 }, relativeHumidity: { value: 58 }, windSpeed: { value: 14 }, windDirection: { value: 225 } } });
    if (p.endsWith('/observations')) return json({ features: [{ properties: { timestamp: iso(now - 3600e3), temperature: { value: 24 } } }] });
    if (p.startsWith('/alerts/active')) return json({ features: alerts });
    return route.fulfill({ status: 404, json: {} });
  });
  await ctx.route('https://api.open-meteo.com/**', route => {
    calls.nowcast++;
    const t0 = Math.floor(now / 900e3) * 900;
    const time = Array.from({ length: 26 }, (_, i) => t0 - 900 + i * 900);
    return route.fulfill({ json: { minutely_15: { time, precipitation: time.map((_, i) => opts.rainSoon || wet ? (i < 4 ? 0.6 : i < 9 ? 0 : 0.4) : (i > 5 && i < 9 ? 0.5 : 0)), snowfall: time.map(() => 0) } } });
  });
  await ctx.route('https://api.bigdatacloud.net/**', route => route.fulfill({ json: { city: PLACE.city, principalSubdivision: 'North Carolina' } }));
  await ctx.route('https://geocoding-api.open-meteo.com/**', route => {
    const q = new URL(route.request().url()).searchParams.get('name') || '';
    return route.fulfill({ json: { results: [{ name: q + 'ville', admin1: 'Ohio', country: 'United States', latitude: 39.96, longitude: -82.99 }, { name: q + ' City', admin1: 'Kansas', country: 'United States', latitude: 39.1, longitude: -94.58 }] } });
  });
  await ctx.route('https://mesonet.agron.iastate.edu/**', route => {
    const u = route.request().url();
    if (u.endsWith('.json') && opts.directHrrr === false) return route.abort();   // IEM won't let a page on another site read it: the app asks its own site's helper instead
    if (u.endsWith('.json')) return route.fulfill({ json: { model_init_utc: new Date(Math.floor(now / 3600e3) * 3600e3).toISOString().slice(0, 16).replace(/[-T:]/g, '') }, headers: { 'access-control-allow-origin': '*' } });
    if (u.includes('hrrr::')) calls.forecastTiles++; else calls.radarTiles++;
    return route.fulfill({ body: RADAR_TILE, contentType: 'image/png' });
  });
  await ctx.route('https://*.basemaps.cartocdn.com/**', route => { calls.baseTiles++; return route.fulfill({ body: BASE_TILE, contentType: 'image/png' }); });
  await ctx.route('https://radar.weather.gov/**', route => route.fulfill({ status: 404, body: '' }));
  return calls;
}
