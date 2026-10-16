"use strict";

// Clock's sums, kept apart from the page so they can be tested in Node
// (clock/scripts/logic-test.mjs). The same file, byte for byte, is
// clockvintage/logic.js (clockvintage/scripts/same-reader-test.mjs checks it).
//
//   cities     a list of cities people look for, each with its time zone, and
//              a search over them and over every zone the phone knows
//   zones      the time in a zone, how far ahead or behind it is, its day
//   alarms     when an alarm next rings, its repeat in words, the sleep schedule
//   stopwatch  laps, the fastest and slowest
//   timers     durations and the time left, in words and digits
//   sounds     the alarm and timer sounds, made here as WAV files (no downloads)

(function (root) {
  const pad = n => String(n).padStart(2, '0');

  // ---------------------------------------------------------------------
  // Cities: [name, where, IANA time zone]. Searched by name and by where.
  // Any zone the phone knows that isn't here is offered too (by its own name).
  // ---------------------------------------------------------------------
  const CITIES = [
    // United States and Canada
    ['New York', 'New York, US', 'America/New_York'], ['Boston', 'Massachusetts, US', 'America/New_York'],
    ['Washington', 'D.C., US', 'America/New_York'], ['Philadelphia', 'Pennsylvania, US', 'America/New_York'],
    ['Atlanta', 'Georgia, US', 'America/New_York'], ['Miami', 'Florida, US', 'America/New_York'],
    ['Orlando', 'Florida, US', 'America/New_York'], ['Tampa', 'Florida, US', 'America/New_York'],
    ['West Palm Beach', 'Florida, US', 'America/New_York'], ['Charlotte', 'North Carolina, US', 'America/New_York'],
    ['Raleigh', 'North Carolina, US', 'America/New_York'], ['Pittsburgh', 'Pennsylvania, US', 'America/New_York'],
    ['Cleveland', 'Ohio, US', 'America/New_York'], ['Columbus', 'Ohio, US', 'America/New_York'],
    ['Detroit', 'Michigan, US', 'America/Detroit'], ['Baltimore', 'Maryland, US', 'America/New_York'],
    ['Richmond', 'Virginia, US', 'America/New_York'], ['Charleston', 'South Carolina, US', 'America/New_York'],
    ['Indianapolis', 'Indiana, US', 'America/Indiana/Indianapolis'], ['Louisville', 'Kentucky, US', 'America/Kentucky/Louisville'],
    ['Chicago', 'Illinois, US', 'America/Chicago'], ['Houston', 'Texas, US', 'America/Chicago'],
    ['Dallas', 'Texas, US', 'America/Chicago'], ['Austin', 'Texas, US', 'America/Chicago'],
    ['San Antonio', 'Texas, US', 'America/Chicago'], ['Nashville', 'Tennessee, US', 'America/Chicago'],
    ['Memphis', 'Tennessee, US', 'America/Chicago'], ['New Orleans', 'Louisiana, US', 'America/Chicago'],
    ['Minneapolis', 'Minnesota, US', 'America/Chicago'], ['St. Louis', 'Missouri, US', 'America/Chicago'],
    ['Kansas City', 'Missouri, US', 'America/Chicago'], ['Milwaukee', 'Wisconsin, US', 'America/Chicago'],
    ['Oklahoma City', 'Oklahoma, US', 'America/Chicago'], ['Omaha', 'Nebraska, US', 'America/Chicago'],
    ['Denver', 'Colorado, US', 'America/Denver'], ['Salt Lake City', 'Utah, US', 'America/Denver'],
    ['Albuquerque', 'New Mexico, US', 'America/Denver'], ['Boise', 'Idaho, US', 'America/Boise'],
    ['Phoenix', 'Arizona, US', 'America/Phoenix'], ['Las Vegas', 'Nevada, US', 'America/Los_Angeles'],
    ['Los Angeles', 'California, US', 'America/Los_Angeles'], ['San Francisco', 'California, US', 'America/Los_Angeles'],
    ['San Diego', 'California, US', 'America/Los_Angeles'], ['San Jose', 'California, US', 'America/Los_Angeles'],
    ['Cupertino', 'California, US', 'America/Los_Angeles'], ['Sacramento', 'California, US', 'America/Los_Angeles'],
    ['Seattle', 'Washington, US', 'America/Los_Angeles'], ['Portland', 'Oregon, US', 'America/Los_Angeles'],
    ['Anchorage', 'Alaska, US', 'America/Anchorage'], ['Honolulu', 'Hawaii, US', 'Pacific/Honolulu'],
    ['San Juan', 'Puerto Rico', 'America/Puerto_Rico'],
    ['Toronto', 'Canada', 'America/Toronto'], ['Montreal', 'Canada', 'America/Toronto'], ['Ottawa', 'Canada', 'America/Toronto'],
    ['Vancouver', 'Canada', 'America/Vancouver'], ['Calgary', 'Canada', 'America/Edmonton'], ['Edmonton', 'Canada', 'America/Edmonton'],
    ['Winnipeg', 'Canada', 'America/Winnipeg'], ['Halifax', 'Canada', 'America/Halifax'], ['St. John’s', 'Canada', 'America/St_Johns'],
    // Latin America and the Caribbean
    ['Mexico City', 'Mexico', 'America/Mexico_City'], ['Cancún', 'Mexico', 'America/Cancun'], ['Guadalajara', 'Mexico', 'America/Mexico_City'],
    ['Tijuana', 'Mexico', 'America/Tijuana'], ['Havana', 'Cuba', 'America/Havana'], ['Nassau', 'Bahamas', 'America/Nassau'],
    ['Kingston', 'Jamaica', 'America/Jamaica'], ['Santo Domingo', 'Dominican Republic', 'America/Santo_Domingo'],
    ['Panama City', 'Panama', 'America/Panama'], ['San José', 'Costa Rica', 'America/Costa_Rica'],
    ['Bogotá', 'Colombia', 'America/Bogota'], ['Lima', 'Peru', 'America/Lima'], ['Quito', 'Ecuador', 'America/Guayaquil'],
    ['Caracas', 'Venezuela', 'America/Caracas'], ['Santiago', 'Chile', 'America/Santiago'],
    ['Buenos Aires', 'Argentina', 'America/Argentina/Buenos_Aires'], ['Montevideo', 'Uruguay', 'America/Montevideo'],
    ['São Paulo', 'Brazil', 'America/Sao_Paulo'], ['Rio de Janeiro', 'Brazil', 'America/Sao_Paulo'],
    // Europe
    ['London', 'United Kingdom', 'Europe/London'], ['Manchester', 'United Kingdom', 'Europe/London'],
    ['Edinburgh', 'United Kingdom', 'Europe/London'], ['Glasgow', 'United Kingdom', 'Europe/London'],
    ['Cardiff', 'United Kingdom', 'Europe/London'], ['Belfast', 'United Kingdom', 'Europe/London'],
    ['Birmingham', 'United Kingdom', 'Europe/London'], ['Liverpool', 'United Kingdom', 'Europe/London'],
    ['Dublin', 'Ireland', 'Europe/Dublin'], ['Lisbon', 'Portugal', 'Europe/Lisbon'], ['Reykjavík', 'Iceland', 'Atlantic/Reykjavik'],
    ['Paris', 'France', 'Europe/Paris'], ['Nice', 'France', 'Europe/Paris'], ['Madrid', 'Spain', 'Europe/Madrid'],
    ['Barcelona', 'Spain', 'Europe/Madrid'], ['Rome', 'Italy', 'Europe/Rome'], ['Milan', 'Italy', 'Europe/Rome'],
    ['Venice', 'Italy', 'Europe/Rome'], ['Florence', 'Italy', 'Europe/Rome'], ['Berlin', 'Germany', 'Europe/Berlin'],
    ['Munich', 'Germany', 'Europe/Berlin'], ['Frankfurt', 'Germany', 'Europe/Berlin'], ['Hamburg', 'Germany', 'Europe/Berlin'],
    ['Amsterdam', 'Netherlands', 'Europe/Amsterdam'], ['Brussels', 'Belgium', 'Europe/Brussels'],
    ['Luxembourg', 'Luxembourg', 'Europe/Luxembourg'], ['Zurich', 'Switzerland', 'Europe/Zurich'],
    ['Geneva', 'Switzerland', 'Europe/Zurich'], ['Vienna', 'Austria', 'Europe/Vienna'], ['Prague', 'Czechia', 'Europe/Prague'],
    ['Budapest', 'Hungary', 'Europe/Budapest'], ['Warsaw', 'Poland', 'Europe/Warsaw'], ['Kraków', 'Poland', 'Europe/Warsaw'],
    ['Copenhagen', 'Denmark', 'Europe/Copenhagen'], ['Stockholm', 'Sweden', 'Europe/Stockholm'],
    ['Oslo', 'Norway', 'Europe/Oslo'], ['Helsinki', 'Finland', 'Europe/Helsinki'], ['Tallinn', 'Estonia', 'Europe/Tallinn'],
    ['Riga', 'Latvia', 'Europe/Riga'], ['Vilnius', 'Lithuania', 'Europe/Vilnius'], ['Athens', 'Greece', 'Europe/Athens'],
    ['Istanbul', 'Türkiye', 'Europe/Istanbul'], ['Bucharest', 'Romania', 'Europe/Bucharest'], ['Sofia', 'Bulgaria', 'Europe/Sofia'],
    ['Belgrade', 'Serbia', 'Europe/Belgrade'], ['Zagreb', 'Croatia', 'Europe/Zagreb'], ['Dubrovnik', 'Croatia', 'Europe/Zagreb'],
    ['Kyiv', 'Ukraine', 'Europe/Kyiv'], ['Moscow', 'Russia', 'Europe/Moscow'], ['Valletta', 'Malta', 'Europe/Malta'],
    // Africa and the Middle East
    ['Cairo', 'Egypt', 'Africa/Cairo'], ['Casablanca', 'Morocco', 'Africa/Casablanca'], ['Marrakesh', 'Morocco', 'Africa/Casablanca'],
    ['Lagos', 'Nigeria', 'Africa/Lagos'], ['Accra', 'Ghana', 'Africa/Accra'], ['Nairobi', 'Kenya', 'Africa/Nairobi'],
    ['Addis Ababa', 'Ethiopia', 'Africa/Addis_Ababa'], ['Johannesburg', 'South Africa', 'Africa/Johannesburg'],
    ['Cape Town', 'South Africa', 'Africa/Johannesburg'], ['Tunis', 'Tunisia', 'Africa/Tunis'],
    ['Dubai', 'United Arab Emirates', 'Asia/Dubai'], ['Abu Dhabi', 'United Arab Emirates', 'Asia/Dubai'],
    ['Doha', 'Qatar', 'Asia/Qatar'], ['Riyadh', 'Saudi Arabia', 'Asia/Riyadh'], ['Jerusalem', 'Israel', 'Asia/Jerusalem'],
    ['Tel Aviv', 'Israel', 'Asia/Jerusalem'], ['Amman', 'Jordan', 'Asia/Amman'], ['Beirut', 'Lebanon', 'Asia/Beirut'],
    ['Tehran', 'Iran', 'Asia/Tehran'], ['Kuwait City', 'Kuwait', 'Asia/Kuwait'], ['Muscat', 'Oman', 'Asia/Muscat'],
    // Asia
    ['Karachi', 'Pakistan', 'Asia/Karachi'], ['Mumbai', 'India', 'Asia/Kolkata'], ['New Delhi', 'India', 'Asia/Kolkata'],
    ['Bengaluru', 'India', 'Asia/Kolkata'], ['Kolkata', 'India', 'Asia/Kolkata'], ['Kathmandu', 'Nepal', 'Asia/Kathmandu'],
    ['Colombo', 'Sri Lanka', 'Asia/Colombo'], ['Dhaka', 'Bangladesh', 'Asia/Dhaka'], ['Malé', 'Maldives', 'Indian/Maldives'],
    ['Bangkok', 'Thailand', 'Asia/Bangkok'], ['Phuket', 'Thailand', 'Asia/Bangkok'], ['Hanoi', 'Vietnam', 'Asia/Bangkok'],
    ['Ho Chi Minh City', 'Vietnam', 'Asia/Ho_Chi_Minh'], ['Jakarta', 'Indonesia', 'Asia/Jakarta'], ['Bali', 'Indonesia', 'Asia/Makassar'],
    ['Kuala Lumpur', 'Malaysia', 'Asia/Kuala_Lumpur'], ['Singapore', 'Singapore', 'Asia/Singapore'],
    ['Manila', 'Philippines', 'Asia/Manila'], ['Hong Kong', 'China', 'Asia/Hong_Kong'], ['Beijing', 'China', 'Asia/Shanghai'],
    ['Shanghai', 'China', 'Asia/Shanghai'], ['Shenzhen', 'China', 'Asia/Shanghai'], ['Taipei', 'Taiwan', 'Asia/Taipei'],
    ['Seoul', 'South Korea', 'Asia/Seoul'], ['Tokyo', 'Japan', 'Asia/Tokyo'], ['Osaka', 'Japan', 'Asia/Tokyo'],
    ['Kyoto', 'Japan', 'Asia/Tokyo'],
    // Oceania
    ['Perth', 'Australia', 'Australia/Perth'], ['Darwin', 'Australia', 'Australia/Darwin'], ['Adelaide', 'Australia', 'Australia/Adelaide'],
    ['Brisbane', 'Australia', 'Australia/Brisbane'], ['Sydney', 'Australia', 'Australia/Sydney'], ['Melbourne', 'Australia', 'Australia/Melbourne'],
    ['Canberra', 'Australia', 'Australia/Sydney'], ['Hobart', 'Australia', 'Australia/Hobart'],
    ['Auckland', 'New Zealand', 'Pacific/Auckland'], ['Wellington', 'New Zealand', 'Pacific/Auckland'],
    ['Queenstown', 'New Zealand', 'Pacific/Auckland'], ['Fiji', 'Fiji', 'Pacific/Fiji'], ['Guam', 'Guam', 'Pacific/Guam'],
  ].map(([name, where, tz]) => ({ name, where, tz }));

  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  // A zone's own name, for zones not in CITIES: "America/Argentina/Cordoba" -> "Cordoba", "Argentina".
  const REGION = { America: 'Americas', Europe: 'Europe', Asia: 'Asia', Africa: 'Africa', Australia: 'Australia', Pacific: 'Pacific', Atlantic: 'Atlantic', Indian: 'Indian Ocean', Antarctica: 'Antarctica', Arctic: 'Arctic' };
  function zoneCity(tz) {
    const parts = String(tz).split('/');
    if (parts.length < 2 || !REGION[parts[0]]) return null;
    const name = parts[parts.length - 1].replace(/_/g, ' ');
    const where = parts.length > 2 ? parts[1].replace(/_/g, ' ') : REGION[parts[0]];
    return { name, where, tz };
  }
  let ALL = null;
  function allCities(zones) {
    if (ALL && !zones) return ALL;
    const list = CITIES.slice(), have = new Set(CITIES.map(c => fold(c.name)));
    let z = zones;
    if (!z) { try { z = Intl.supportedValuesOf('timeZone'); } catch { z = []; } }
    for (const tz of z) {
      const c = zoneCity(tz);
      if (c && !have.has(fold(c.name)) && validZone(tz)) { list.push(c); have.add(fold(c.name)); }
    }
    if (!zones) ALL = list;
    return list;
  }
  // Up to `max` cities matching what was typed: names that start with it first, then any word
  // of the name, then the country or state. Nothing typed: none (the sheet shows a hint).
  function searchCities(q, max = 60, list) {
    const f = fold(q);
    if (!f) return [];
    const L = list || allCities(), out = [[], [], []];
    for (const c of L) {
      const n = fold(c.name), w = fold(c.where);
      if (n.startsWith(f)) out[0].push(c);
      else if ((' ' + n).includes(' ' + f)) out[1].push(c);
      else if ((' ' + w).includes(' ' + f)) out[2].push(c);
    }
    const by = (a, b) => a.name.localeCompare(b.name, 'en-US');
    return [...out[0].sort(by), ...out[1].sort(by), ...out[2].sort(by)].slice(0, max);
  }

  // ---------------------------------------------------------------------
  // Time zones, through the phone's own Intl (it knows summer time everywhere).
  // ---------------------------------------------------------------------
  const FMT = new Map();
  function fmtFor(tz) {
    let f = FMT.get(tz);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' });
      FMT.set(tz, f);
    }
    return f;
  }
  function validZone(tz) { try { fmtFor(tz); return true; } catch { return false; } }
  const DOWS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  // The wall clock in a zone at a moment: { y, mo (1-12), d, h (0-23), mi, s, dow (0 = Sunday) }.
  function zoneParts(tz, t) {
    const p = {};
    for (const x of fmtFor(tz).formatToParts(new Date(t))) p[x.type] = x.value;
    return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second, dow: DOWS[p.weekday] };
  }
  // Minutes the zone is ahead of UTC at that moment (-300 for New York in winter).
  function zoneOffset(tz, t) {
    const z = zoneParts(tz, t), whole = Math.floor(t / 1000) * 1000;
    return Math.round((Date.UTC(z.y, z.mo - 1, z.d, z.h, z.mi, z.s) - whole) / 60000);
  }
  const localOffset = t => -new Date(t).getTimezoneOffset();
  // How a zone stands against here: { day: 'Today' | 'Tomorrow' | 'Yesterday', diff (minutes), text }.
  //   "Today, 5 hr ahead", "Tomorrow, 9½ hr ahead", "Today, 3 hr behind", "Today, same time"
  function zoneVs(tz, t) {
    const z = zoneParts(tz, t), here = new Date(t);
    const zd = Date.UTC(z.y, z.mo - 1, z.d), hd = Date.UTC(here.getFullYear(), here.getMonth(), here.getDate());
    const dd = Math.round((zd - hd) / 864e5);
    const day = dd > 0 ? 'Tomorrow' : dd < 0 ? 'Yesterday' : 'Today';
    const diff = zoneOffset(tz, t) - localOffset(t);
    return { day, diff, text: day + ', ' + diffText(diff) };
  }
  function diffText(diff) {
    if (!diff) return 'same time';
    const a = Math.abs(diff), h = Math.floor(a / 60), m = a % 60;
    const frac = m === 30 ? '½' : m === 45 ? '¾' : m === 15 ? '¼' : '';
    const num = m && !frac ? (h ? h + ' hr ' : '') + m + ' min' : (h || '') + frac + ' hr';
    return num + (diff > 0 ? ' ahead' : ' behind');
  }

  // ---------------------------------------------------------------------
  // Clock faces and digits
  // ---------------------------------------------------------------------
  // { time: '7:05' or '07:05', ap: 'AM' | 'PM' | '' } for an hour (0-23) and minute.
  function clockText(h, m, h24, s) {
    const sec = s == null ? '' : ':' + pad(s);
    if (h24) return { time: pad(h) + ':' + pad(m) + sec, ap: '' };
    return { time: (h % 12 || 12) + ':' + pad(m) + sec, ap: h < 12 ? 'AM' : 'PM' };
  }
  const clockLine = (h, m, h24) => { const c = clockText(h, m, h24); return c.time + (c.ap ? ' ' + c.ap : ''); };
  // The hands' angles in degrees, from 12 o'clock: { h, m, s }.
  function hands(h, m, s, ms = 0) {
    const sec = s + ms / 1000;
    return { h: ((h % 12) + m / 60 + sec / 3600) * 30, m: (m + sec / 60) * 6, s: sec * 6 };
  }

  // ---------------------------------------------------------------------
  // Alarms: { h, m, days: [0-6, Sunday first] (none: rings once), skip: a ring time to pass over }
  // ---------------------------------------------------------------------
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const cleanDays = days => [...new Set((days || []).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  // In words, as iOS says it: Never, Every day, Weekdays, Weekends, Every Monday, Mon Wed Fri.
  function repeatText(days) {
    const d = cleanDays(days), k = d.join('');
    if (!d.length) return 'Never';
    if (d.length === 7) return 'Every day';
    if (k === '12345') return 'Weekdays';
    if (k === '06') return 'Weekends';
    if (d.length === 1) return 'Every ' + DAY_LONG[d[0]];
    return d.map(i => DAY_SHORT[i]).join(' ');
  }
  // The next time (ms) an alarm rings after `now`, in the phone's own time (summer time included).
  // A time skipped over (skip, a ring time) is passed by.
  function nextRing(a, now) {
    const days = cleanDays(a.days), base = new Date(now);
    for (let i = 0; i < 16; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i, a.h, a.m, 0, 0);
      if (d.getHours() !== a.h) d.setHours(a.h, a.m);   // a time that summer time skips rings at the same hour once the clocks move
      const t = d.getTime();
      if (t <= now || (days.length && !days.includes(d.getDay())) || (a.skip && t === a.skip)) continue;
      return t;
    }
    return null;
  }
  // "7 hr 12 min", "45 min", "1 day 3 hr", "less than a minute"
  function untilText(ms) {
    const min = Math.ceil(Math.max(0, ms) / 60000);
    if (min < 1) return 'less than a minute';
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
    if (d) return d + (d === 1 ? ' day' : ' days') + (h ? ' ' + h + ' hr' : '');
    return (h ? h + ' hr' + (m ? ' ' : '') : '') + (m ? m + ' min' : '');
  }
  // The sleep schedule: { bed: {h, m}, wake: {h, m}, days: the wake-up days }.
  // Minutes asleep between bedtime and waking.
  const sleepMinutes = s => ((s.wake.h * 60 + s.wake.m) - (s.bed.h * 60 + s.bed.m) + 1440) % 1440 || 1440;
  // The days bedtime falls on: the evening before each wake-up day, unless bedtime is after
  // midnight (before the wake-up time on the clock), when it is the same day.
  function bedDays(s) {
    const days = cleanDays(s.days);
    const sameDay = s.bed.h * 60 + s.bed.m < s.wake.h * 60 + s.wake.m;
    return sameDay ? days : cleanDays(days.map(d => (d + 6) % 7));
  }
  function hoursText(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return (h ? h + ' hr' : '') + (h && m ? ' ' : '') + (m ? m + ' min' : '');
  }

  // ---------------------------------------------------------------------
  // Stopwatch and timers
  // ---------------------------------------------------------------------
  // 00:00.00 (minutes, seconds, hundredths); 1:02:03.45 past an hour.
  function swText(ms) {
    const cs = Math.floor(Math.max(0, ms) / 10), c = cs % 100, s = Math.floor(cs / 100) % 60, m = Math.floor(cs / 6000) % 60, h = Math.floor(cs / 360000);
    return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(s) + '.' + pad(c);
  }
  // The fastest and slowest of the finished laps (indexes), once there are two that differ.
  function lapMarks(laps) {
    if (!Array.isArray(laps) || laps.length < 2) return { best: -1, worst: -1 };
    let best = 0, worst = 0;
    laps.forEach((v, i) => { if (v < laps[best]) best = i; if (v > laps[worst]) worst = i; });
    if (laps[best] === laps[worst]) return { best: -1, worst: -1 };
    return { best, worst };
  }
  // Time left on a timer: 4:59, 1:00:00 (rounded up, so it reads 0:01 until the end).
  function leftText(ms) {
    const t = Math.ceil(Math.max(0, ms) / 1000), s = t % 60, m = Math.floor(t / 60) % 60, h = Math.floor(t / 3600);
    return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }
  // A length in words: "1 hr 30 min", "5 min", "45 sec", "2 min 30 sec".
  function durText(sec) {
    const t = Math.round(sec), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
    return [h && h + ' hr', m && m + ' min', s && s + ' sec'].filter(Boolean).join(' ') || '0 sec';
  }

  // ---------------------------------------------------------------------
  // Sounds: made here, so nothing is downloaded. Each is one loop, as a
  // 16-bit mono WAV. Named after the clocks and bells they sound like.
  // ---------------------------------------------------------------------
  const RATE = 22050;
  const SOUNDS = [
    { id: 'twinbell', name: 'Twin Bell', d: 'A wind-up alarm clock' },
    { id: 'telephone', name: 'Telephone', d: 'A desk phone’s bell' },
    { id: 'chimes', name: 'Chimes', d: 'A mantel clock’s quarter chime' },
    { id: 'marimba', name: 'Marimba', d: 'A bright little tune' },
    { id: 'beacon', name: 'Beacon', d: 'Three short beeps' },
    { id: 'sunrise', name: 'Sunrise', d: 'Soft and rising, for gentle mornings' },
  ];
  const soundName = id => (SOUNDS.find(s => s.id === id) || SOUNDS[0]).name;
  // A struck bell: a few partials that fade, louder ones first.
  const BELL = [[1, 1, 3.2], [2.76, .5, 5], [5.4, .25, 8], [8.93, .12, 11]];
  function strike(buf, at, f, gain, parts = BELL, len = 1.2) {
    const i0 = Math.floor(at * RATE), n = Math.min(buf.length - i0, Math.floor(len * RATE));
    for (let i = 0; i < n; i++) {
      const t = i / RATE, att = Math.min(1, t * 400);
      let v = 0;
      for (const [r, a, k] of parts) v += a * Math.exp(-t * k) * Math.sin(2 * Math.PI * f * r * t);
      buf[i0 + i] += v * gain * att;
    }
  }
  function tone(buf, at, f, len, gain, attack = .005) {
    const i0 = Math.floor(at * RATE), n = Math.min(buf.length - i0, Math.floor(len * RATE));
    for (let i = 0; i < n; i++) {
      const t = i / RATE, env = Math.min(1, t / attack, (len - t) / .01);
      buf[i0 + i] += gain * env * (Math.sin(2 * Math.PI * f * t) + .18 * Math.sin(6 * Math.PI * f * t));
    }
  }
  function samples(id) {
    const len = { twinbell: 2.2, telephone: 3.2, chimes: 4, marimba: 1.8, beacon: 1.4, sunrise: 3.2 }[id] || 2.2;
    const b = new Float32Array(Math.round(len * RATE));
    // the hammer between two bells, quick and bright
    const ring = (from, to, rate, f1, f2, g) => { let k = 0; for (let t = from; t < to; t += 1 / rate, k++) strike(b, t, k % 2 ? f2 : f1, g, [[1, 1, 30], [2.76, .45, 40], [5.4, .2, 55]], .25); };
    if (id === 'telephone') ring(0, 1.5, 20, 1180, 1410, .5);
    else if (id === 'chimes') [[659.25, 0], [523.25, .8], [587.33, 1.6], [392, 2.4]].forEach(([f, t]) => strike(b, t, f, .55, BELL, 1.6));
    else if (id === 'marimba') [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25].forEach((f, i) => strike(b, i * .14, f, .5, [[1, 1, 9], [4, .25, 22], [10, .06, 40]], .7));
    else if (id === 'beacon') [0, .2, .4].forEach(t => tone(b, t, 1046.5, .12, .45));
    else if (id === 'sunrise') [392, 493.88, 587.33, 783.99].forEach((f, i) => strike(b, i * .36, f, .42, [[1, 1, 1.8], [2, .3, 3], [3, .1, 5]], 2.4));
    else ring(0, 1.4, 16, 1250, 1580, .45);
    // keep it under full scale, and end in silence so the loop doesn't click
    let peak = 0; for (const v of b) peak = Math.max(peak, Math.abs(v));
    const k = peak > .9 ? .9 / peak : 1, fade = Math.floor(.02 * RATE);
    for (let i = 0; i < b.length; i++) b[i] *= k * Math.min(1, (b.length - 1 - i) / fade);
    return b;
  }
  // A WAV file (bytes) of a sound, or of `sec` seconds of silence when id is 'silence'.
  function wav(id, sec) {
    const s = id === 'silence' ? new Float32Array(Math.round((sec || .1) * RATE)) : samples(id);
    const out = new Uint8Array(44 + s.length * 2), dv = new DataView(out.buffer);
    const str = (o, t) => { for (let i = 0; i < t.length; i++) out[o + i] = t.charCodeAt(i); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + s.length * 2, true); str(8, 'WAVEfmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, RATE, true); dv.setUint32(28, RATE * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    str(36, 'data'); dv.setUint32(40, s.length * 2, true);
    for (let i = 0; i < s.length; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s[i])) * 32767, true);
    return out;
  }

  root.ClockLogic = {
    CITIES, allCities, searchCities, zoneCity, validZone, fold,
    zoneParts, zoneOffset, zoneVs, diffText,
    clockText, clockLine, hands,
    DAY_SHORT, DAY_LONG, cleanDays, repeatText, nextRing, untilText, sleepMinutes, bedDays, hoursText,
    swText, lapMarks, leftText, durText,
    RATE, SOUNDS, soundName, samples, wav,
  };
})(typeof window !== 'undefined' ? window : globalThis);
