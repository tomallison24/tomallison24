"use strict";

// Calendar: the iCloud Family calendar, with the everyday parts of iOS
// Calendar and Google Calendar.
//
// - Events come from iCloud through calendar/api (a Cloudflare Pages
//   Function holding the Apple ID and app-specific password). The phone
//   keeps the .ics text of every event it last saw, so the app opens at once
//   and can be read offline; ical.js turns that text into occurrences.
// - Day, Week, Month, Year and List views, search, a sheet for each event,
//   an editor with repeats, alerts, travel time and time zones; edits and
//   deletions of one occurrence, all future ones or the whole series; drag
//   an event in Day or Week to move it, or its bottom edge to resize it.
// - Layers alongside the Family calendar: US holidays (worked out here),
//   Notes' reminders and nudges, Travel's trips, Mail's Remind Me days,
//   Fitness's workouts (they share this phone's storage when opened from
//   AllisonOS Home), and the weather (Open-Meteo, as in the Weather app).

// Refuse to run inside another page's frame (see Mail's app.js for why).
if (window.top !== window.self) {
  document.body.textContent = 'Calendar can’t be opened inside another page.';
  throw new Error('Calendar refuses to run inside a frame');
}

(function () {
  const I = window.AllisonICal;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del: k => { try { localStorage.removeItem(k); } catch {} },
    json: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
  };
  const pad = n => String(n).padStart(2, '0');
  const plural = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
  const MIN = 60e3, H = 3600e3, D = 24 * H;
  const KEY = 'allison-calendar-v1';
  const K = { settings: KEY + '-settings', items: KEY + '-items', view: KEY + '-view', mail: KEY + '-mail', wx: KEY + '-wx', loc: KEY + '-loc', version: KEY + '-version' };
  const API = new URL('api/', location.href).href;
  const TZ = I.localTz();
  const PRODID = '-//Allison OS//Calendar//EN';
  const REFRESH_MS = 3 * MIN;

  const ICON = {
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.2 2"/></svg>',
    map: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.6-5.6-6.6-11a6.6 6.6 0 0 1 13.2 0c0 5.4-6.6 11-6.6 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M6.2 16.4V11a5.8 5.8 0 0 1 11.6 0v5.4l1.4 1.8H4.8z"/><path d="M10 20.2a2.2 2.2 0 0 0 4 0"/></svg>',
    repeat: '<svg viewBox="0 0 24 24"><path d="M4.4 10.4V9a3.6 3.6 0 0 1 3.6-3.6h11"/><path d="M16.2 2.6l2.8 2.8-2.8 2.8"/><path d="M19.6 13.6V15a3.6 3.6 0 0 1-3.6 3.6H5"/><path d="M7.8 21.4L5 18.6l2.8-2.8"/></svg>',
    car: '<svg viewBox="0 0 24 24"><path d="M4 15.8v-3.2l1.8-4.5a2.4 2.4 0 0 1 2.2-1.5h8a2.4 2.4 0 0 1 2.2 1.5l1.8 4.5v3.2a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 15.8z"/><path d="M4 12.6h16"/><path d="M6.6 17.2v1.6M17.4 17.2v1.6"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10.2 13.8a3.9 3.9 0 0 0 5.5 0l3.2-3.2a3.9 3.9 0 0 0-5.5-5.5l-1.1 1.1"/><path d="M13.8 10.2a3.9 3.9 0 0 0-5.5 0l-3.2 3.2a3.9 3.9 0 0 0 5.5 5.5l1.1-1.1"/></svg>',
    notes: '<svg viewBox="0 0 24 24"><rect x="4.2" y="3.6" width="15.6" height="16.8" rx="3.2"/><path d="M8 9h8M8 12.6h8M8 16.2h5"/></svg>',
    people: '<svg viewBox="0 0 24 24"><circle cx="9.4" cy="8.4" r="3.4"/><path d="M3.6 19.4a5.8 5.8 0 0 1 11.6 0"/><path d="M15.4 5.4a3.4 3.4 0 0 1 0 6"/><path d="M17.2 14a5.8 5.8 0 0 1 3.4 5.4"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3.4" y="4.6" width="17.2" height="16" rx="3.2"/><path d="M3.4 9.6h17.2M8 2.8v3.6M16 2.8v3.6"/></svg>',
    chevL: '<svg viewBox="0 0 24 24" class="b"><path d="M14.6 5.4L8.4 11.3a1 1 0 0 0 0 1.4l6.2 5.9"/></svg>',
    chevR: '<svg viewBox="0 0 24 24" class="b"><path d="M9.4 5.4l6.2 5.9a1 1 0 0 1 0 1.4l-6.2 5.9"/></svg>',
    chevD: '<svg viewBox="0 0 24 24" class="b"><path d="M6 9.4l5.3 5.2a1 1 0 0 0 1.4 0L18 9.4"/></svg>',
    go: '<svg viewBox="0 0 24 24" class="b"><path d="M9.4 5.4l6.2 5.9a1 1 0 0 1 0 1.4l-6.2 5.9"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M13.6 4h6.4v6.4"/><path d="M20 4l-9 9"/><path d="M17.6 13.6v3.6a2.8 2.8 0 0 1-2.8 2.8H6.8A2.8 2.8 0 0 1 4 17.2V9.2a2.8 2.8 0 0 1 2.8-2.8h3.6"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M20 11.2a8 8 0 0 0-14.6-4.4L4 8.4"/><path d="M4 3.8v4.6h4.6"/><path d="M4 12.8a8 8 0 0 0 14.6 4.4l1.4-1.6"/><path d="M20 20.2v-4.6h-4.6"/></svg>',
    busy: '<svg viewBox="0 0 24 24"><rect x="3.4" y="4.6" width="17.2" height="16" rx="3.2"/><path d="M3.4 9.6h17.2M8 2.8v3.6M16 2.8v3.6"/><path d="M7.5 15.5l9-2"/></svg>',
    tick: '<svg viewBox="0 0 24 24" class="b"><path d="M4.6 12.8l4.3 4.3a.7.7 0 0 0 1 0L19.4 7.6"/></svg>',
    close: '<svg viewBox="0 0 24 24" class="b"><path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"/></svg>',
    plane: '<svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>',
    hotel: '<svg viewBox="0 0 24 24"><path d="M3.2 19.6V6.4"/><path d="M3.2 15.2h17.6v4.4"/><path d="M20.8 15.2v-3.4a3 3 0 0 0-3-3h-6.6v6.4"/><circle cx="7.4" cy="11.4" r="2"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="2.8" y="5" width="18.4" height="14" rx="3.4"/><path d="M3.6 7.4l7.2 5a2 2 0 0 0 2.4 0l7.2-5"/></svg>',
    dumbbell: '<svg viewBox="0 0 24 24"><path d="M8.4 12h7.2"/><rect x="5" y="7.4" width="3.4" height="9.2" rx="1.2"/><rect x="15.6" y="7.4" width="3.4" height="9.2" rx="1.2"/><path d="M5 10H3.6a.6.6 0 0 0-.6.6v2.8a.6.6 0 0 0 .6.6H5M19 10h1.4a.6.6 0 0 1 .6.6v2.8a.6.6 0 0 1-.6.6H19"/></svg>',
    glass: '<svg viewBox="0 0 24 24"><path d="M7.2 3.6h9.6c.4 3.8.3 6.2-.6 7.8-.9 1.6-2.4 2.6-4.2 2.6s-3.3-1-4.2-2.6c-.9-1.6-1-4-.6-7.8z"/><path d="M12 14v6.2M8.6 20.4h6.8"/></svg>',
    flag: '<svg viewBox="0 0 24 24"><path d="M5.5 21V4.2"/><path d="M5.5 4.6c3.6-1.8 6.2 1.6 9.8-.2v9.2c-3.6 1.8-6.2-1.6-9.8.2"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>',
    cloudSun: '<svg viewBox="0 0 24 24"><path d="M7 18.5h9.5a3.5 3.5 0 0 0 .5-7 5 5 0 0 0-9.6-1.3A4.2 4.2 0 0 0 7 18.5z"/><path d="M15.5 6.2a3 3 0 0 1 3.6 3.9M17 3v1.4M21 7.2h1.4M19.9 4.3l1-1"/></svg>',
    cloud: '<svg viewBox="0 0 24 24"><path d="M7 19h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6-1.4A4.7 4.7 0 0 0 7 19z"/></svg>',
    rain: '<svg viewBox="0 0 24 24"><path d="M7 15.5h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6-1.4A4.7 4.7 0 0 0 7 15.5z"/><path d="M8.5 18.2l-.8 2.2M12 18.2l-.8 2.2M15.5 18.2l-.8 2.2"/></svg>',
    snow: '<svg viewBox="0 0 24 24"><path d="M7 15h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6-1.4A4.7 4.7 0 0 0 7 15z"/><path d="M8 18.4v.1M12 19.6v.1M16 18.4v.1M10 21.2v.1M14 21.2v.1"/></svg>',
    storm: '<svg viewBox="0 0 24 24"><path d="M7 14.5h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6-1.4A4.7 4.7 0 0 0 7 14.5z"/><path d="M12.6 14l-2 4h3l-2 4"/></svg>',
    fog: '<svg viewBox="0 0 24 24"><path d="M7 13.5h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6-1.4A4.7 4.7 0 0 0 7 13.5z"/><path d="M6 17h12M8 20.4h8"/></svg>',
  };

  // ---------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------
  const settings = Object.assign({
    weekStart: 0, clock: 'auto', units: 'auto', dayStart: 7, duration: 60, alertTimed: '-PT15M', alertAllDay: '-PT15H',
    layers: { holidays: true, notes: true, travel: true, mail: true, fitness: true, weather: true, drinks: false },
  }, ls.json(K.settings, {}));
  settings.layers = Object.assign({ holidays: true, notes: true, travel: true, mail: true, fitness: true, weather: true, drinks: false }, settings.layers || {});
  // Weeks start on Sunday, the US way. Settings saved before that kept Monday only as the
  // old default; unless the week start was picked here (weekStartPicked), it moves to Sunday.
  if (!settings.weekStartPicked && settings.weekStart !== 0) { settings.weekStart = 0; try { if (ls.json(K.settings, null)) ls.set(K.settings, JSON.stringify(settings)); } catch {} }
  const saveSettings = () => ls.set(K.settings, JSON.stringify(settings));

  // Clock: the phone's own, or forced.
  const localeIs12h = (() => { try { return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).formatToParts(new Date()).some(p => p.type === 'dayPeriod'); } catch { return true; } })();
  const is12h = () => settings.clock === '12' ? true : settings.clock === '24' ? false : localeIs12h;
  const useF = () => settings.units === 'f' ? true : settings.units === 'c' ? false : /^en-(US|BZ|BS|KY|PW|FM|MH)/i.test(navigator.language || 'en-US') || navigator.language === 'en';

  // ---------------------------------------------------------------------
  // Dates. 'YYYY-MM-DD' strings are the coin of the app; the zone is the
  // phone's.
  // ---------------------------------------------------------------------
  const ymdOf = w => w.y + '-' + pad(w.m) + '-' + pad(w.d);
  const ymd = ms => ymdOf(I.utcToZoned(ms, TZ));
  const today = () => ymd(Date.now());
  const partsOf = s => ({ y: +s.slice(0, 4), m: +s.slice(5, 7), d: +s.slice(8, 10) });
  const dayMs = s => { const p = partsOf(s); return I.zonedToUtc({ y: p.y, m: p.m, d: p.d, h: 0, mi: 0, s: 0 }, TZ); };  // midnight, this zone
  const noon = s => new Date(s + 'T12:00:00');                                                                       // a Date for formatting
  const addDays = (s, n) => ymdOf(I.wallParts(I.wallMs(Object.assign(partsOf(s), { h: 12 })) + n * D));
  const wdMon = s => I.wallParts(I.wallMs(Object.assign(partsOf(s), { h: 12 }))).wd;                                 // 0 = Monday
  const weekStartOf = s => addDays(s, -((wdMon(s) - (settings.weekStart === 0 ? 6 : 0) + 7) % 7));
  const monthStart = s => s.slice(0, 8) + '01';
  const addMonths = (s, n) => { const p = partsOf(s); const t = p.y * 12 + p.m - 1 + n; return Math.floor(t / 12) + '-' + pad((t % 12 + 12) % 12 + 1) + '-01'; };
  const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const fmt = (d, o) => d.toLocaleDateString('en-US', o);
  const fmtTime = ms => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: is12h(), timeZone: TZ }).replace(/\s?(AM|PM)/i, m => m.trim().toLowerCase() === 'am' ? ' AM' : ' PM');
  const fmtHour = h => is12h() ? (h % 12 || 12) + (h < 12 ? ' AM' : ' PM') : pad(h) + ':00';
  const MONTHS = I.MONTHS, DAYNAMES = I.DAYNAMES;
  const shortDay = s => fmt(noon(s), { weekday: 'short' });
  const longDate = s => fmt(noon(s), { weekday: 'long', day: 'numeric', month: 'long', year: partsOf(s).y === partsOf(today()).y ? undefined : 'numeric' });
  const medDate = s => fmt(noon(s), { weekday: 'short', day: 'numeric', month: 'short', year: partsOf(s).y === partsOf(today()).y ? undefined : 'numeric' });

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const st = {
    view: ls.get(K.view, 'month'), sel: today(), search: '', searching: false,
    api: 'checking', calendar: null, apiError: '', calendars: null, apiDetail: null,
    items: new Map(),             // file name -> {etag, ics, cal}
    win: null,                    // {from, to} ms loaded from iCloud
    occ: [],                      // occurrences in the window (Family + layers)
    lastRefresh: 0, refreshing: false, offline: false,
    wx: ls.json(K.wx, null), mail: ls.json(K.mail, null), mailState: 'idle', drinks: null, drinksState: 'idle', layers: null, layersState: 'idle',
  };
  if (!['day', 'week', 'month', 'year', 'list'].includes(st.view)) st.view = 'month';
  const q = new URLSearchParams(location.search);
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.get('date') || '')) { st.sel = q.get('date'); st.view = ['day', 'week', 'month', 'year', 'list'].includes(q.get('view')) ? q.get('view') : 'day'; }
  const LAYER = {
    family: { name: 'Family', color: 'var(--cal)' },
    holiday: { name: 'US Holidays', color: 'var(--hol)', sub: 'Worked out on this phone: federal holidays and the usual observances' },
    note: { name: 'Notes', color: 'var(--nt)', sub: 'Reminders with a date, and notes with a nudge' },
    travel: { name: 'Travel', color: 'var(--tr)', sub: 'Flights, hotels and rental cars from Travel' },
    mail: { name: 'Mail', color: 'var(--ml)', sub: 'Remind Me days from Mail' },
    fitness: { name: 'Fitness', color: 'var(--fit)', sub: 'The workouts logged in Fitness, one a day' },
    drinks: { name: 'Drinks', color: 'var(--drk)', sub: 'Your own standard drinks and alcohol-free days, from your account. Only you see them.' },
    weather: { name: 'Weather', color: 'var(--accent)', sub: 'A forecast line on each day, from Open-Meteo' },
  };
  const calColor = () => st.calendar && /^#[0-9a-f]{6}$/i.test(st.calendar.color || '') ? st.calendar.color : 'var(--cal)';

  // ---------------------------------------------------------------------
  // The iCloud function
  // ---------------------------------------------------------------------
  async function api(path, opts = {}) {
    let res;
    try {
      const init = { method: opts.method || 'GET', body: opts.body, cache: 'no-store', headers: Object.assign({ 'X-Calendar': '1' }, opts.headers || {}) };
      res = await (window.AllisonOS && AllisonOS.account ? AllisonOS.account.fetch(API + path, init) : fetch(API + path, init));   // signed in (home/account.js), once accounts are on
    } catch { throw Object.assign(new Error('offline'), { code: 'offline' }); }
    let data = null;
    const ctype = res.headers.get('Content-Type') || '';
    let raw = '';
    try { raw = await res.text(); data = JSON.parse(raw); }
    catch {
      // Not the function's JSON: a 404 page (the GitHub Pages copy, or the
      // function missing from the deploy), a Cloudflare error page, or a
      // sign-in page. Keep what came back so Settings can say which.
      st.apiDetail = { path, status: res.status, ctype: ctype.split(';')[0].trim(), text: raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) };
      throw Object.assign(new Error('unavailable'), { code: 'unavailable', status: res.status });
    }
    if (!res.ok) throw Object.assign(new Error(data && data.error || 'http-' + res.status), { code: data && data.error || 'http-' + res.status, status: res.status, data });
    return data;
  }
  const API_ERRORS = {
    auth: 'iCloud refused the Apple ID or the app-specific password. Make a new app-specific password and update the ICLOUD_APP_PASSWORD secret.',
    'no-calendar': 'No calendar of that name in the account.',
    'no-account': 'The iCloud secrets are not set on this copy of the site yet (Calendar README, “Set up”).',
    unreachable: 'Couldn’t reach iCloud just now.',
    'bad-host': 'iCloud sent the request somewhere unexpected, so it was stopped.',
    changed: 'That event was changed elsewhere in the meantime; it has been reloaded.',
    offline: 'You’re offline. Showing the events last seen.',
    unavailable: 'The iCloud connection isn’t answering on this copy of the site.',
  };
  const errText = e => API_ERRORS[e && e.code] || (e && /^upstream-/.test(e.code) ? 'iCloud answered with an error (' + e.code.slice(9) + ').' : 'Something went wrong talking to iCloud.');

  async function ping() {
    try {
      const d = await api('ping');
      if (!d.configured) { st.api = 'unconfigured'; return; }
      if (d.error) { st.api = 'error'; st.apiError = d.error; st.calendars = d.calendars || null; return; }
      st.api = 'ok'; st.calendar = d.calendar || null; st.apiError = '';
    } catch (e) {
      st.api = e.code === 'offline' ? 'offline' : 'off';
      // A JSON answer with an error the app doesn't know (the function ran, but said no).
      if (e.code !== 'offline' && e.code !== 'unavailable') st.apiDetail = { path: 'ping', status: e.status || 0, ctype: 'json', text: e.code };
    }
  }

  // The window of events kept on the phone: three months back, a year on
  // from the month being looked at, moved when the user looks further.
  function wantedWindow() {
    const m = monthStart(st.sel);
    return { from: dayMs(addMonths(m, -3)), to: dayMs(addMonths(m, 13)) };
  }
  const stampZ = ms => I.fmtWall(I.utcParts(ms)) + 'Z';

  function loadCache() {
    const c = ls.json(K.items, null);
    if (!c || !Array.isArray(c.items)) return;
    st.win = c.win || null; st.lastRefresh = c.at || 0;
    for (const it of c.items) try { st.items.set(it.name, { etag: it.etag, ics: it.ics, cal: I.parse(it.ics) }); } catch {}
  }
  function saveCache() {
    ls.set(K.items, JSON.stringify({ win: st.win, at: st.lastRefresh, items: [...st.items].map(([name, it]) => ({ name, etag: it.etag, ics: it.ics })) }));
  }

  let refreshPromise = null;
  function refresh({ loud = false, force = false } = {}) {
    if (refreshPromise) return refreshPromise;
    if (st.api !== 'ok' && st.api !== 'checking') return Promise.resolve(false);
    const win = wantedWindow();
    const same = st.win && st.win.from <= win.from && st.win.to >= win.to;
    if (!force && same && Date.now() - st.lastRefresh < 20e3) return Promise.resolve(false);
    const w = same ? st.win : win;
    refreshPromise = (async () => {
      st.refreshing = true;
      if (loud) busyPill('Updating');
      try {
        const d = await api('events?start=' + stampZ(w.from) + '&end=' + stampZ(w.to));
        const next = new Map();
        for (const it of d.items) {
          const had = st.items.get(it.name);
          next.set(it.name, had && had.etag === it.etag && had.ics === it.ics ? had : { etag: it.etag, ics: it.ics, cal: I.parse(it.ics) });
        }
        st.items = next; st.win = w; st.lastRefresh = Date.now(); st.offline = false;
        if (d.calendar) st.calendar = d.calendar;
        st.api = 'ok';
        saveCache(); rebuild(); render();
        if (loud) pillDone('Up to date');
        return true;
      } catch (e) {
        if (e.code === 'offline') st.offline = true;
        else if (e.code === 'unavailable') st.api = 'off';
        else if (e.code === 'no-account') st.api = 'unconfigured';
        else { st.api = 'error'; st.apiError = e.code; st.calendars = e.data && e.data.calendars || null; }
        if (loud) { busyPill(''); toast(errText(e), null, 6000); } else busyPill('');
        render();
        return false;
      } finally { st.refreshing = false; refreshPromise = null; }
    })();
    return refreshPromise;
  }

  // ---------------------------------------------------------------------
  // Occurrences: the Family calendar and the layers, one shape
  //   {id, kind, color, title, sub, start, end, allDay, startDate, endDate,
  //    o (ical occurrence), name (file), link, done}
  // ---------------------------------------------------------------------
  function rebuild() {
    const w = st.win || wantedWindow();
    const out = [];
    for (const [name, it] of st.items) {
      let occs = [];
      try { occs = I.expand(it.cal, w.from, w.to, TZ); } catch {}
      for (const o of occs) {
        if (o.status === 'CANCELLED') continue;
        out.push({ id: name + '|' + o.start, kind: 'family', color: calColor(), title: o.summary || 'New Event', sub: o.location, start: o.start, end: o.end, allDay: o.allDay, startDate: o.startDate, endDate: o.endDate, o, name });
      }
    }
    if (settings.layers.holidays) out.push(...holidayItems(w));
    if (settings.layers.notes) out.push(...noteItems(w));
    if (settings.layers.travel) out.push(...travelItems(w));
    if (settings.layers.fitness) out.push(...fitnessItems(w));
    if (settings.layers.drinks) out.push(...drinksItems(w));
    if (settings.layers.mail && st.mail && Array.isArray(st.mail.items)) out.push(...st.mail.items.filter(x => x.start >= w.from - 31 * D && x.start < w.to).map(x => Object.assign({}, x, { color: LAYER.mail.color })));
    out.sort((a, b) => (b.allDay - a.allDay) || a.start - b.start || (b.end - b.start) - (a.end - a.start));
    st.occ = out;
  }
  const allDayItem = (kind, id, title, startDate, endDate, extra) => Object.assign({ id, kind, color: LAYER[kind].color, title, sub: '', allDay: true, startDate, endDate: endDate || addDays(startDate, 1), start: dayMs(startDate), end: dayMs(endDate || addDays(startDate, 1)) }, extra || {});
  const timedItem = (kind, id, title, start, end, extra) => Object.assign({ id, kind, color: LAYER[kind].color, title, sub: '', allDay: false, start, end, startDate: ymd(start), endDate: ymd(Math.max(start, end - 1)) }, extra || {});

  // Which occurrences touch a day, all-day ones first.
  function eventsOn(day) {
    const s = dayMs(day), e = dayMs(addDays(day, 1));
    return st.occ.filter(x => x.allDay ? (x.startDate <= day && x.endDate > day) : (x.end > s && x.start < e) || (x.start === x.end && x.start >= s && x.start < e));
  }
  const matches = (x, qs) => { const t = (x.title + ' ' + (x.sub || '') + ' ' + (x.o ? x.o.description + ' ' + x.o.url : '')).toLowerCase(); return qs.every(w => t.includes(w)); };

  // ---- US holidays, worked out rather than fetched ----
  const nthWeekday = (y, m, wd, n) => { const first = I.wallParts(Date.UTC(y, m - 1, 1)).wd; let d = 1 + ((wd - first + 7) % 7) + (n - 1) * 7; if (n < 0) { const last = daysIn(y, m); const lw = I.wallParts(Date.UTC(y, m - 1, last)).wd; d = last - ((lw - wd + 7) % 7) + (n + 1) * 7; } return y + '-' + pad(m) + '-' + pad(d); };
  function easter(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return y + '-' + pad(mo) + '-' + pad(da); }
  // A federal holiday on a weekend is observed on the nearest weekday.
  const observed = s => { const wd = wdMon(s); return wd === 5 ? addDays(s, -1) : wd === 6 ? addDays(s, 1) : s; };
  function usHolidays(y) {
    const fixed = (m, d, name, fed) => { const s = y + '-' + pad(m) + '-' + pad(d); const out = [{ s, name }]; if (fed) { const o = observed(s); if (o !== s) out.push({ s: o, name: name + ' (observed)' }); } return out; };
    return [
      ...fixed(1, 1, 'New Year’s Day', true), { s: nthWeekday(y, 1, 0, 3), name: 'Martin Luther King Jr. Day' }, ...fixed(2, 14, 'Valentine’s Day'),
      { s: nthWeekday(y, 2, 0, 3), name: 'Presidents’ Day' }, ...fixed(3, 17, 'St. Patrick’s Day'), { s: addDays(easter(y), -2), name: 'Good Friday' }, { s: easter(y), name: 'Easter' },
      { s: nthWeekday(y, 5, 6, 2), name: 'Mother’s Day' }, { s: nthWeekday(y, 5, 0, -1), name: 'Memorial Day' }, ...fixed(6, 19, 'Juneteenth', true), { s: nthWeekday(y, 6, 6, 3), name: 'Father’s Day' },
      ...fixed(7, 4, 'Independence Day', true), { s: nthWeekday(y, 9, 0, 1), name: 'Labor Day' }, { s: nthWeekday(y, 10, 0, 2), name: 'Columbus Day' }, ...fixed(10, 31, 'Halloween'),
      ...fixed(11, 11, 'Veterans Day', true), { s: nthWeekday(y, 11, 3, 4), name: 'Thanksgiving' }, { s: addDays(nthWeekday(y, 11, 3, 4), 1), name: 'Black Friday' },
      ...fixed(12, 24, 'Christmas Eve'), ...fixed(12, 25, 'Christmas Day', true), ...fixed(12, 31, 'New Year’s Eve'),
      { s: nthWeekday(y, 3, 6, 2), name: 'Daylight Saving Time begins' }, { s: nthWeekday(y, 11, 6, 1), name: 'Daylight Saving Time ends' },
    ];
  }
  function holidayItems(w) {
    const out = [];
    for (let y = I.utcToZoned(w.from, TZ).y; y <= I.utcToZoned(w.to, TZ).y; y++) for (const h of usHolidays(y)) {
      const ms = dayMs(h.s); if (ms < w.from - 31 * D || ms >= w.to) continue;
      out.push(allDayItem('holiday', 'hol|' + h.s + '|' + h.name, h.name, h.s, null, { sub: 'US Holidays' }));
    }
    return out;
  }

  // ---- Notes, Travel, Fitness and Mail: from your own family account ----
  // On an iPhone each Home Screen app keeps its own storage, so Calendar can't read
  // theirs. Each keeps a copy of just what Calendar shows in your family account
  // (AllisonOS.layer in home/welcome.js; functions/aOS/api, GET layer), read here.
  // Where this browser does share their storage (a computer), that comes first.
  async function loadLayers(force) {
    if (!['notes', 'travel', 'fitness', 'mail'].some(k => settings.layers[k])) return;
    const acct = window.AllisonOS && AllisonOS.account, tok = acct && acct.token();
    if (!tok) { st.layersState = 'signin'; mailFromLayer(); return; }
    if (!force && st.layers && Date.now() - st.layers.at < 5 * MIN) return;
    try {
      const r = await fetch('../aOS/api/layer', { headers: { Authorization: 'Bearer ' + tok }, cache: 'no-store' });
      if (r.status === 401) { st.layersState = 'signin'; return; }
      if (r.status === 503 || r.status === 404) { st.layersState = 'off'; return; }
      if (!r.ok) throw new Error('layer-' + r.status);
      st.layers = Object.assign({ at: Date.now() }, (await r.json()).layers || {}); st.layersState = 'ok';
      mailFromLayer(); rebuild(); render();
    } catch { st.layersState = 'error'; }
  }
  const layerData = (key, app) => ls.json(key, null) || (st.layers && st.layers[app] && st.layers[app].data) || null;
  // Mail's Remind Me days: from Gmail itself where this browser has Mail's sign-in, else Mail's copy.
  function mailFromLayer() {
    if (mailToken()) return;
    const L = st.layers && st.layers.mail;
    if (!L || !L.data || !Array.isArray(L.data.items)) { st.mailState = st.layersState === 'signin' ? 'signin' : st.layersState === 'ok' ? 'no-copy' : st.mailState; return; }
    st.mail = { at: L.at, items: L.data.items.filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(x.date || '')).map(x => allDayItem('mail', 'mail|' + x.id, 'Remind: ' + (x.subject || '(no subject)'), x.date, null, { sub: x.from ? 'From ' + x.from : 'Mail', link: '../mail/?thread=' + encodeURIComponent(x.id) })) };
    st.mailState = 'ok';
  }
  const layerNote = k => {
    if (ls.json({ note: 'allison-notes-v1', travel: 'allison-travel-v1', fitness: 'allison-fitness-v1' }[k], null)) return LAYER[k].sub;   // this browser has it
    if (st.layersState === 'signin') return 'Sign in to your family account first: open aOS.';
    if (st.layersState === 'off') return 'Family accounts aren’t switched on yet.';
    if (st.layersState === 'ok' && !st.layers[k === 'note' ? 'notes' : k]) return 'If you use ' + LAYER[k].name + ', open it once, signed in, and it shows here';
    return LAYER[k].sub;
  };

  // ---- Notes: reminders with a date, and notes with a nudge ----
  function noteItems(w) {
    const data = layerData('allison-notes-v1', 'notes');
    if (!data) return [];
    const out = [], lists = new Map((data.lists || []).map(l => [l.id, l]));
    for (const t of data.todos || []) {
      if (!t || !t.date || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
      const list = lists.get(t.list), color = list && /^#[0-9a-f]{6}$/i.test(list.color || '') ? list.color : LAYER.note.color;
      const extra = { sub: (list ? list.name : 'Reminder') + (t.done ? ' · done' : ''), color, link: '../notes/', done: !!t.done, notes: t.notes || '', flagged: !!t.flagged };
      if (t.time && /^\d{2}:\d{2}$/.test(t.time)) {
        const [h, mi] = t.time.split(':').map(Number);
        const s = I.zonedToUtc(Object.assign(partsOf(t.date), { h, mi, s: 0 }), TZ);
        if (s >= w.from - D && s < w.to) out.push(timedItem('note', 'todo|' + t.id, t.title || 'Reminder', s, s + 30 * MIN, extra));
      } else if (dayMs(t.date) >= w.from - D && dayMs(t.date) < w.to) out.push(allDayItem('note', 'todo|' + t.id, t.title || 'Reminder', t.date, null, extra));
    }
    for (const n of data.notes || []) {
      if (!n || !n.reminder || n.deletedAt || n.archived) continue;
      const ms = new Date(n.reminder).getTime();
      if (isNaN(ms) || ms < w.from - D || ms >= w.to) continue;
      const hasTime = /T\d{2}:\d{2}/.test(String(n.reminder)) && !/T00:00(:00)?$/.test(String(n.reminder));
      const title = (n.title || (n.body || '').split('\n')[0] || 'Note').slice(0, 120);
      if (hasTime) out.push(timedItem('note', 'nudge|' + n.id, title, ms, ms + 30 * MIN, { sub: 'Nudge', link: '../notes/', notes: n.body || '' }));
      else out.push(allDayItem('note', 'nudge|' + n.id, title, ymd(ms), null, { sub: 'Nudge', link: '../notes/', notes: n.body || '' }));
    }
    return out;
  }

  // ---- Travel: flights, hotels and rental cars ----
  function travelItems(w) {
    const data = layerData('allison-travel-v1', 'travel');
    if (!data || !Array.isArray(data.bookings)) return [];
    const out = [];
    const at = (local, iso) => { const t = Date.parse(iso || ''); if (!isNaN(t)) return t; if (!local) return NaN; const p = partsOf(local); const hm = local.length >= 16 ? local.slice(11, 16).split(':').map(Number) : [12, 0]; return I.zonedToUtc({ y: p.y, m: p.m, d: p.d, h: hm[0], mi: hm[1], s: 0 }, TZ); };
    const inWin = ms => !isNaN(ms) && ms >= w.from - D && ms < w.to;
    for (const b of data.bookings) {
      if (!b || b.status === 'cancelled') continue;
      const desc = [b.conf ? 'Confirmation ' + b.conf : '', b.notes || ''].filter(Boolean).join('\n');
      if (b.type === 'flight' && b.dep) {
        const s = at(b.dep, b.depIso), e = at(b.arr, b.arrIso);
        if (!inWin(s)) continue;
        const name = ((b.airlineCode || '') + ' ' + (b.flightNo || '')).trim() || b.airline || 'Flight';
        out.push(timedItem('travel', 'trv|' + b.id, name + ' ' + (b.from || '') + ' → ' + (b.to || ''), s, isNaN(e) || e <= s ? s + 2 * H : e, { sub: [b.fromName, b.toName].filter(Boolean).join(' → ') || 'Flight', link: '../travel/', notes: desc, icon: 'plane' }));
      } else if (b.type === 'hotel' && b.checkIn) {
        const out2 = b.checkOut && b.checkOut > b.checkIn ? b.checkOut : addDays(b.checkIn, 1);
        if (dayMs(out2) < w.from - D || dayMs(b.checkIn) >= w.to) continue;
        out.push(allDayItem('travel', 'trv|' + b.id, b.name || 'Hotel', b.checkIn, out2, { sub: b.address || b.city || 'Hotel', link: '../travel/', notes: desc, icon: 'hotel' }));
      } else if (b.type === 'car' && b.pickup) {
        const s = at(b.pickup, b.pickupIso);
        if (inWin(s)) out.push(timedItem('travel', 'trv|' + b.id + '|pu', 'Pick up · ' + (b.company && b.company !== 'Car hire' ? b.company : 'Rental car'), s, s + 30 * MIN, { sub: b.pickupPlace || '', link: '../travel/', notes: desc, icon: 'car' }));
        if (b.dropoff) { const e = at(b.dropoff, b.dropoffIso); if (inWin(e)) out.push(timedItem('travel', 'trv|' + b.id + '|dr', 'Return · ' + (b.company && b.company !== 'Car hire' ? b.company : 'Rental car'), e, e + 30 * MIN, { sub: b.dropPlace || b.pickupPlace || '', link: '../travel/', notes: desc, icon: 'car' })); }
      } else if (b.start) {
        const s = at(b.start), e = at(b.end);
        if (inWin(s)) out.push(timedItem('travel', 'trv|' + b.id, b.title || 'Booking', s, isNaN(e) || e <= s ? s + H : e, { sub: b.place || '', link: '../travel/', notes: desc }));
      }
    }
    return out;
  }

  // ---- Fitness: each day's workout, as one all-day item ----
  function fitnessItems(w) {
    const data = layerData('allison-fitness-v1', 'fitness');
    if (!data || !Array.isArray(data.logs)) return [];
    const GROUPS = { chest: 'Chest', back: 'Back', lowerback: 'Lower back', shoulders: 'Shoulders', arms: 'Arms', core: 'Core', legs: 'Legs', glutes: 'Glutes', cardio: 'Cardio' };
    const days = new Map();
    for (const x of data.logs) {
      if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(x.date || '') || typeof x.exercise !== 'string') continue;
      if (dayMs(x.date) < w.from - D || dayMs(x.date) >= w.to) continue;
      if (!days.has(x.date)) days.set(x.date, []);
      days.get(x.date).push(x);
    }
    const out = [];
    for (const [date, logs] of days) {
      const groups = [...new Set(logs.map(x => GROUPS[x.group] || 'Other'))];
      const lift = logs.filter(x => !x.cardio), sets = lift.reduce((a, x) => a + (+x.sets || 0), 0);
      const mins = logs.reduce((a, x) => a + (x.cardio ? +x.mins || 0 : 0), 0);
      const secs = n => n < 60 ? n + ' s' : Math.floor(n / 60) + ' min' + (n % 60 ? ' ' + n % 60 + ' s' : '');
      const line = x => x.cardio ? (+x.mins || 0) + ' min' + (+x.dist > 0 ? ' · ' + (+x.dist).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + (x.unit || 'mi') : '')
        : x.sets + ' × ' + (x.timed ? secs(+x.reps) : x.reps) + ' · ' + (+x.weight ? (+x.weight).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' lb' : 'Bodyweight');
      const notes = logs.map(x => x.exercise + ': ' + line(x)).join('\n');
      const sub = [lift.length ? plural(lift.length, 'exercise') + ' · ' + plural(sets, 'set') : '', mins ? mins + ' min cardio' : ''].filter(Boolean).join(' · ');
      out.push(allDayItem('fitness', 'fit|' + date, 'Workout · ' + groups.join(', '), date, null, { sub, link: '../fitness/?date=' + date, notes, icon: 'dumbbell' }));
    }
    return out;
  }

  // ---- Drinks: each day's standard drinks, or alcohol-free ----
  // Read from your own family account (functions/drinks/api), so it works even
  // though Drinks keeps its own storage on an iPhone. Health data: kept in
  // memory only, never in this app's storage, and never copied to the Family
  // calendar (the event sheet offers no copy for it). Off until you turn it on.
  async function loadDrinks(force) {
    if (!settings.layers.drinks) return;
    const acct = window.AllisonOS && AllisonOS.account, tok = acct && acct.token();
    if (!tok) { st.drinksState = 'signin'; return; }
    if (!force && st.drinks && Date.now() - st.drinks.at < 10 * MIN) return;
    const today = ymd(Date.now());
    st.drinksState = 'loading';
    try {
      const r = await fetch('../drinks/api/summary?from=' + addDays(today, -365) + '&to=' + today, { headers: { 'X-Drinks': '1', Authorization: 'Bearer ' + tok }, cache: 'no-store' });
      if (r.status === 401) { st.drinksState = 'signin'; return; }
      if (r.status === 503 || r.status === 404) { st.drinksState = 'off'; return; }
      if (!r.ok) throw new Error('drinks-' + r.status);
      const j = await r.json();
      st.drinks = { at: Date.now(), days: j.days || {} }; st.drinksState = 'ok';
      rebuild(); render();
    } catch { st.drinksState = 'error'; }
  }
  function drinksItems(w) {
    if (!st.drinks) return [];
    const out = [], f1 = n => (Math.round(n * 10) / 10).toLocaleString('en-GB', { maximumFractionDigits: 1 });
    for (const [date, d] of Object.entries(st.drinks.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || dayMs(date) < w.from - D || dayMs(date) >= w.to) continue;
      if (typeof d.sd === 'number') out.push(allDayItem('drinks', 'drk|' + date, 'Drinks · ' + f1(d.sd) + ' standard', date, null, { sub: plural(+d.n || 0, 'drink'), link: '../drinks/?date=' + date }));
      else if (d.status === 'af') out.push(allDayItem('drinks', 'drk|' + date, 'Alcohol-free', date, null, { link: '../drinks/?date=' + date }));
    }
    return out;
  }

  // ---- Mail: Remind Me days, read with Mail's own Gmail sign-in ----
  const mailToken = () => { try { const o = JSON.parse(ls.get('mail.token', 'null')); return o && o.t && o.exp > Date.now() ? o.t : null; } catch { return null; } };
  async function loadMail(force) {
    if (!settings.layers.mail) return;
    const tok = mailToken();
    if (!tok) { mailFromLayer(); return; }
    if (!force && st.mail && Date.now() - st.mail.at < 30 * MIN) { st.mailState = 'ok'; return; }
    st.mailState = 'loading';
    try {
      const g = async path => { const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + path, { headers: { Authorization: 'Bearer ' + tok } }); if (!r.ok) throw new Error('gmail-' + r.status); return r.json(); };
      const labels = (await g('labels')).labels || [];
      const remind = labels.map(l => ({ l, m: /^Remind (\d{4}-\d{2}-\d{2})$/i.exec(l.name || '') })).filter(x => x.m).slice(0, 40);
      const items = [];
      for (const { l, m } of remind) {
        const th = (await g('threads?maxResults=20&labelIds=' + encodeURIComponent(l.id))).threads || [];
        for (const t of th.slice(0, 20)) {
          const d = await g('threads/' + t.id + '?format=metadata&metadataHeaders=Subject&metadataHeaders=From');
          const msg = (d.messages || [])[0] || {}, hs = (msg.payload || {}).headers || [];
          const subj = (hs.find(h => h.name.toLowerCase() === 'subject') || {}).value || '(no subject)';
          const from = ((hs.find(h => h.name.toLowerCase() === 'from') || {}).value || '').replace(/\s*<.*>$/, '').replace(/^"|"$/g, '');
          items.push(allDayItem('mail', 'mail|' + t.id, 'Remind: ' + subj, m[1], null, { sub: from ? 'From ' + from : 'Mail', link: '../mail/?thread=' + encodeURIComponent(t.id) }));
        }
      }
      st.mail = { at: Date.now(), items }; ls.set(K.mail, JSON.stringify(st.mail)); st.mailState = 'ok';
      rebuild(); render();
    } catch (e) { st.mailState = /gmail-401/.test(e.message) ? 'no-token' : 'error'; }
  }

  // ---- Weather: a line per day, from Open-Meteo ----
  const WX = c => c === 0 ? ['sun', 'Clear'] : c <= 2 ? ['cloudSun', c === 1 ? 'Mostly clear' : 'Partly cloudy'] : c === 3 ? ['cloud', 'Overcast'] : c <= 48 ? ['fog', 'Fog'] : c <= 67 ? ['rain', c >= 56 && c <= 57 || c >= 66 ? 'Freezing rain' : 'Rain'] : c <= 77 ? ['snow', 'Snow'] : c <= 82 ? ['rain', 'Showers'] : c <= 86 ? ['snow', 'Snow showers'] : ['storm', 'Thunderstorm'];
  function wxFor(day) {
    if (!settings.layers.weather || !st.wx || !st.wx.days) return null;
    const d = st.wx.days[day]; if (!d) return null;
    const f = useF();
    const t = v => Math.round(f ? v * 9 / 5 + 32 : v) + '°';
    const [icon, words] = WX(d.code);
    return { icon, words, hi: t(d.hi), lo: t(d.lo) };
  }
  async function loadWeather(force) {
    if (!settings.layers.weather) return;
    if (!force && st.wx && Date.now() - st.wx.at < 3 * H) return;
    let loc = ls.json(K.loc, null);
    if (!loc) {
      // The Weather app's saved place, if it left one in this storage.
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k.startsWith('wx.')) continue; const v = JSON.parse(localStorage.getItem(k)); const o = v && typeof v === 'object' ? v : null; if (o && isFinite(o.lat) && isFinite(o.lon)) { loc = { lat: +o.lat, lon: +o.lon }; break; } if (o && isFinite(o.latitude) && isFinite(o.longitude)) { loc = { lat: +o.latitude, lon: +o.longitude }; break; } } } catch {}
    }
    if (!loc && navigator.geolocation) {
      try { const p = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, maximumAge: 6 * H })); loc = { lat: p.coords.latitude, lon: p.coords.longitude }; }
      catch { st.wx = { at: Date.now(), days: null, denied: true }; return; }
    }
    if (!loc) return;
    ls.set(K.loc, JSON.stringify(loc));
    try {
      const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat.toFixed(3) + '&longitude=' + loc.lon.toFixed(3) + '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=' + encodeURIComponent(TZ) + '&forecast_days=16');
      const j = await r.json();
      const days = {};
      (j.daily && j.daily.time || []).forEach((t, i) => { days[t] = { code: j.daily.weather_code[i], hi: j.daily.temperature_2m_max[i], lo: j.daily.temperature_2m_min[i] }; });
      st.wx = { at: Date.now(), days }; ls.set(K.wx, JSON.stringify(st.wx)); render();
    } catch {}
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------
  const main = $('main');
  // Switches with a sliding glass thumb: the shared AllisonOS one (home/slide.js).
  const slide = window.AllisonOS.slide;
  const tabBar = document.querySelector('.tabs');
  const slideTabs = jump => slide(tabBar, tabBar.querySelector('.tab[aria-selected="true"]'), 'tabs', { jump });
  window.addEventListener('resize', () => slideTabs(true));
  let lastView = null;
  function render() {
    for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.dataset.view === st.view && !st.searching));
    slideTabs();
    const sameView = lastView === st.view; lastView = st.searching ? null : st.view;
    $('todayBtn').hidden = st.searching;
    if (st.searching) { renderSearch(); return; }
    const p = partsOf(st.sel);
    const t = $('title'), sub = $('titleSub');
    // The big title is one word wide: the month (or the weekday in Day, the
    // year in Year); the rest goes on the small line under it.
    if (st.view === 'year') { t.firstChild.textContent = String(p.y); sub.textContent = ''; }
    else if (st.view === 'day') { t.firstChild.textContent = fmt(noon(st.sel), { weekday: 'long' }); sub.textContent = fmt(noon(st.sel), { day: 'numeric', month: 'long', year: 'numeric' }); }
    else if (st.view === 'week') { const ws = weekStartOf(st.sel), we = addDays(ws, 6); t.firstChild.textContent = MONTHS[p.m - 1]; sub.textContent = fmt(noon(ws), { day: 'numeric', month: 'short' }) + ' – ' + fmt(noon(we), { day: 'numeric', month: 'short', year: 'numeric' }); }
    else { t.firstChild.textContent = MONTHS[p.m - 1]; sub.textContent = st.view === 'list' ? 'Coming up from ' + medDate(listFrom || st.sel) : String(p.y); }
    $('titleBtn').disabled = st.view === 'year';
    main.innerHTML = notice() + ({ day: renderDay, week: renderWeek, month: renderMonth, year: renderYear, list: renderList }[st.view])();
    // The week strip keeps still (no fade in) when only the chosen day moved,
    // so its thumb can be seen sliding.
    const strip = main.querySelector('.strip');
    if (strip) { if (sameView && slide.last('strip') && slide.last('strip').group === strip.dataset.week) strip.classList.add('keep'); slide(strip, strip.querySelector('[aria-selected="true"]'), 'strip', { group: strip.dataset.week, target: b => b.querySelector('b') }); }
    afterRender();
    animateIn(main);
  }
  function notice() {
    if (st.api === 'ok' || st.api === 'checking') return '';
    const words = st.api === 'off' ? offWords()
      : st.api === 'unconfigured' ? 'The Family calendar isn’t connected yet: add the ICLOUD_APPLE_ID and ICLOUD_APP_PASSWORD secrets (Calendar README, “Set up”).'
      : st.api === 'offline' ? 'Offline. Showing the events last seen.'
      : errText({ code: st.apiError }) + (st.calendars && st.calendars.length ? ' Calendars there: ' + st.calendars.join(', ') + '.' : '');
    return '<div class="notice glass"><span>' + esc(words) + '</span><button class="textbtn" type="button" data-act="retry">Retry</button></div>';
  }
  // Why the function didn't answer: the GitHub Pages copy has no functions
  // at all; on Cloudflare, the status and page that came back say what's up.
  function offWords() {
    const d = st.apiDetail;
    if (/github\.io$/i.test(location.hostname)) return 'This is the GitHub Pages copy of the site (' + location.hostname + '), which has no iCloud connection. Open Calendar from the Cloudflare address for the Family calendar; the layers still show here.';
    let w = 'The iCloud connection isn’t answering at ' + location.hostname + '/calendar/api/.';
    if (d && d.ctype === 'json') return w + ' The function is running but answered with the error “' + d.text + '” (' + d.status + ')' + (d.text === 'not-found' ? ', which means the request reached it without the app’s own header, or a route it doesn’t know' : '') + '.';
    if (d) w += ' It answered ' + d.status + (d.ctype ? ' (' + d.ctype + ')' : '') + (d.text ? ': “' + d.text + '”' : '') + '.';
    w += d && d.status === 404 ? ' A 404 here means the Pages Functions bundle on Cloudflare doesn’t include calendar/api yet: run the News workflow on the default branch and check its “Publish to Cloudflare Pages” step uploads the Functions bundle.'
      : d && d.status >= 500 ? ' An error like this means the function itself failed on Cloudflare; the text above is Cloudflare’s own page.'
      : ' The layers still show here.';
    return w;
  }
  const wxLine = (day, small) => { const w = wxFor(day); return w ? '<span class="wx" title="' + esc(w.words) + '">' + ICON[w.icon] + (small ? esc(w.hi) : esc(w.hi) + ' / ' + esc(w.lo)) + '</span>' : ''; };
  const kindColor = x => 'style="--c:' + esc(x.color) + '"';

  // ---- Month ----
  function renderMonth() {
    const p = partsOf(st.sel), first = monthStart(st.sel), n = daysIn(p.y, p.m);
    const start = weekStartOf(first);
    const rows = Math.ceil((wdMon(first) - (settings.weekStart === 0 ? 6 : 0) + 7) % 7 / 7 + n / 7) >= 6 ? 6 : Math.ceil((((wdMon(first) - (settings.weekStart === 0 ? 6 : 0) + 7) % 7) + n) / 7);
    let cells = '';
    const tod = today();
    for (let i = 0; i < rows * 7; i++) {
      const day = addDays(start, i), out = day.slice(0, 7) !== st.sel.slice(0, 7);
      const evs = eventsOn(day), max = 3;
      const shown = evs.slice(0, evs.length > max ? max - 1 : max);
      cells += '<button class="mday' + (out ? ' out' : '') + (day === tod ? ' today' : '') + (day === st.sel ? ' sel' : '') + '" type="button" data-day="' + day + '" aria-label="' + esc(longDate(day)) + (evs.length ? ', ' + plural(evs.length, 'event') : '') + '">'
        + '<span class="n">' + +day.slice(8) + '</span>'
        + shown.map(x => '<span class="mev' + (x.allDay ? '' : ' timed') + (x.done ? ' done' : '') + '" ' + kindColor(x) + '>' + esc(x.title) + '</span>').join('')
        + (evs.length > max ? '<span class="mev more">+' + (evs.length - shown.length) + '</span>' : '')
        + '</button>';
    }
    const wk = weekHead();
    return '<div class="navrow"><button class="iconbtn glass" type="button" data-act="prev" aria-label="Previous month">' + ICON.chevL + '</button><span class="lbl">' + esc(MONTHS[p.m - 1] + ' ' + p.y) + '</span><button class="iconbtn glass" type="button" data-act="next" aria-label="Next month">' + ICON.chevR + '</button></div>'
      + '<div class="wkhead">' + wk + '</div><div class="mgrid glass" id="mgrid" data-swipe="month">' + cells + '</div>'
      + dayList(st.sel);
  }
  function weekHead() {
    const ws = weekStartOf(today());
    let h = '';
    for (let i = 0; i < 7; i++) { const d = addDays(ws, i), wd = wdMon(d); h += '<span' + (wd >= 5 ? ' class="we"' : '') + '>' + esc(shortDay(d).slice(0, 1)) + '</span>'; }
    return h;
  }
  function dayList(day) {
    const evs = eventsOn(day);
    const head = '<div class="dayhead' + (day === today() ? ' today' : '') + '"><b>' + esc(day === today() ? 'Today' : fmt(noon(day), { weekday: 'long' })) + '</b><span>' + esc(fmt(noon(day), { day: 'numeric', month: 'long', year: 'numeric' })) + '</span>' + wxLine(day) + '</div>';
    if (!evs.length) return head + '<div class="empty glass"><strong>Nothing on</strong>Tap + to add an event.</div>';
    return head + '<div class="rgroup glass">' + evs.map(evRow).join('') + '</div>';
  }
  function evRow(x, opts = {}) {
    const now = Date.now();
    const tm = x.allDay ? 'all-day' + (x.endDate > addDays(x.startDate, 1) ? '<small>' + esc(fmt(noon(x.startDate), { day: 'numeric', month: 'short' }) + ' – ' + fmt(noon(addDays(x.endDate, -1)), { day: 'numeric', month: 'short' })) + '</small>' : '')
      : esc(fmtTime(x.start)) + '<small>' + esc(x.end > x.start ? fmtTime(x.end) : '') + '</small>';
    const sub = x.sub ? '<span class="s">' + (x.kind === 'family' ? ICON.map : x.kind === 'note' ? ICON.notes : x.kind === 'travel' ? ICON[x.icon || 'plane'] : x.kind === 'mail' ? ICON.mail : x.kind === 'fitness' ? ICON.dumbbell : x.kind === 'drinks' ? ICON.glass : ICON.flag) + '<span>' + esc(x.sub) + '</span></span>' : '';
    return '<button class="evrow' + (x.end < now && !opts.noPast ? ' past' : '') + (x.done ? ' done' : '') + '" type="button" data-ev="' + esc(x.id) + '" ' + kindColor(x) + '><span class="tm">' + tm + '</span><span class="bd"><span class="t">' + esc(x.title) + '</span>' + sub + '</span></button>';
  }

  // ---- Week and Day: the time grid ----
  function renderWeek() {
    const ws = weekStartOf(st.sel);
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    return '<div class="navrow"><button class="iconbtn glass" type="button" data-act="prev" aria-label="Previous week">' + ICON.chevL + '</button><span class="lbl">' + esc(fmt(noon(ws), { day: 'numeric', month: 'short' }) + ' – ' + fmt(noon(addDays(ws, 6)), { day: 'numeric', month: 'short', year: 'numeric' })) + '</span><button class="iconbtn glass" type="button" data-act="next" aria-label="Next week">' + ICON.chevR + '</button></div>'
      + timeGrid(days);
  }
  function renderDay() {
    const ws = weekStartOf(st.sel);
    let strip = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i), has = eventsOn(d).length > 0;
      strip += '<button type="button" data-day="' + d + '" class="' + (d === today() ? 'today' : '') + '" aria-selected="' + (d === st.sel) + '" aria-label="' + esc(longDate(d)) + '"><span>' + esc(shortDay(d).slice(0, 1)) + '</span><b>' + +d.slice(8) + '</b><i class="' + (has ? '' : 'none') + '"></i></button>';
    }
    return '<div class="strip glass" data-swipe="week" data-week="' + ws + '">' + strip + '</div>' + timeGrid([st.sel]);
  }
  function timeGrid(days) {
    const tod = today(), one = days.length === 1;
    document.documentElement.style.setProperty('--cols', days.length);
    let head = '<div class="gl"></div>', allday = '<div class="gl">all-day</div>', cols = '';
    let anyAllDay = false;
    for (const d of days) {
      const w = wxFor(d);
      head += '<div class="dh' + (d === tod ? ' today' : '') + (d === st.sel ? ' sel' : '') + '" data-day="' + d + '"><span>' + esc(one ? fmt(noon(d), { weekday: 'long' }) : shortDay(d)) + '</span>' + (one ? '' : '<b>' + +d.slice(8) + '</b>') + (w ? '<span class="wx" title="' + esc(w.words) + '">' + ICON[w.icon] + esc(one ? w.words + ' ' + w.hi + ' / ' + w.lo : w.hi) + '</span>' : '') + '</div>';
      const evs = eventsOn(d), ad = evs.filter(x => x.allDay), timed = evs.filter(x => !x.allDay);
      if (ad.length) anyAllDay = true;
      allday += '<div class="ad">' + ad.map(x => '<button class="mev' + (x.done ? ' done' : '') + '" type="button" data-ev="' + esc(x.id) + '" ' + kindColor(x) + '>' + esc(x.title) + '</button>').join('') + '</div>';
      // Overlapping events share the width.
      const laid = layout(timed.map(x => ({ x, s: Math.max(x.start, dayMs(d)), e: Math.min(Math.max(x.end, x.start + 15 * MIN), dayMs(addDays(d, 1))) })));
      let col = '';
      for (const l of laid) {
        const top = (l.s - dayMs(d)) / H, hgt = Math.max(0.25, (l.e - l.s) / H);
        const width = 100 / l.n, left = l.c * width;
        col += '<button class="tev' + (hgt < 0.6 ? ' short' : '') + (l.x.end < Date.now() ? ' past' : '') + '" type="button" data-ev="' + esc(l.x.id) + '" ' + 'style="--c:' + esc(l.x.color) + ';top:calc(var(--hour) * ' + top.toFixed(4) + ');height:calc(var(--hour) * ' + hgt.toFixed(4) + ' - 2px);left:calc(' + left.toFixed(2) + '% + 1px);width:calc(' + width.toFixed(2) + '% - 3px)" aria-label="' + esc(l.x.title + ', ' + fmtTime(l.x.start)) + '"><b>' + esc(l.x.title) + '</b><span>' + esc(l.x.sub || (fmtTime(l.x.start) + ' – ' + fmtTime(l.x.end))) + '</span>' + (l.x.kind === 'family' ? '<span class="rs" aria-hidden="true"></span>' : '') + '</button>';
      }
      cols += '<div class="col' + (d === tod ? ' today' : '') + '" data-day="' + d + '">' + col + '</div>';
    }
    let gut = '';
    for (let h = 1; h < 24; h++) gut += '<span style="top:calc(var(--hour) * ' + h + ')">' + esc(fmtHour(h)) + '</span>';
    return '<div class="timeview glass" id="timeview" data-swipe="' + (one ? 'day' : 'week') + '" data-cols="' + days.length + '"><div class="tghead">' + head + (anyAllDay ? '<div class="allday">' + allday + '</div>' : '') + '</div>'
      + '<div class="tgbody" id="tgbody"><div class="tgin" id="tgin"><div class="gut">' + gut + '</div>' + cols + '</div></div></div>';
  }
  // Column packing for events that overlap: {x, s, e} -> {x, s, e, c, n}
  function layout(list) {
    list.sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s));
    const groups = []; let g = null, end = -Infinity;
    for (const it of list) {
      if (!g || it.s >= end) { g = { items: [], cols: [] }; groups.push(g); end = it.e; } else end = Math.max(end, it.e);
      g.items.push(it);
    }
    const out = [];
    for (const grp of groups) {
      for (const it of grp.items) { let c = 0; while (grp.cols[c] && grp.cols[c].some(o => o.e > it.s && o.s < it.e)) c++; (grp.cols[c] = grp.cols[c] || []).push(it); it.c = c; }
      for (const it of grp.items) { it.n = grp.cols.length; out.push(it); }
    }
    return out;
  }
  function afterRender() {
    const tv = $('timeview');
    if (tv) {
      const fit = () => { const top = tv.getBoundingClientRect().top; const dock = 100 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0); tv.style.setProperty('--tv-h', Math.max(280, window.innerHeight - top - dock) + 'px'); };
      fit();
      const body = $('tgbody'), hour = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour')) || 56;
      const days = [...tv.querySelectorAll('.col')].map(c => c.dataset.day);
      const nowIn = days.indexOf(today());
      if (nowIn >= 0) { placeNow(); }
      const first = eventsOn(st.sel).filter(x => !x.allDay)[0];
      const startH = nowIn >= 0 && days.length === 1 ? Math.max(0, I.utcToZoned(Date.now(), TZ).h - 1.5) : first ? Math.max(0, I.utcToZoned(first.start, TZ).h - 0.5) : settings.dayStart;
      body.scrollTop = startH * hour;
      wireDrag(tv);
    }
  }
  function placeNow() {
    const tv = $('timeview'); if (!tv) return;
    tv.querySelectorAll('.nowline,.nowlbl').forEach(e => e.remove());
    const col = tv.querySelector('.col[data-day="' + today() + '"]'); if (!col) return;
    const w = I.utcToZoned(Date.now(), TZ), y = 'calc(var(--hour) * ' + ((w.h + w.mi / 60).toFixed(4)) + ')';
    col.insertAdjacentHTML('beforeend', '<div class="nowline" style="top:' + y + '"></div>');
    $('tgin').insertAdjacentHTML('afterbegin', '<span class="nowlbl" style="top:' + y + '">' + esc(fmtTime(Date.now())) + '</span>');
  }

  // ---- Year ----
  function renderYear() {
    const y = partsOf(st.sel).y, tod = today();
    const has = new Set(st.occ.map(x => x.startDate));
    let h = '';
    for (let m = 1; m <= 12; m++) {
      const first = y + '-' + pad(m) + '-01', n = daysIn(y, m), lead = (wdMon(first) - (settings.weekStart === 0 ? 6 : 0) + 7) % 7;
      let g = '';
      for (let i = 0; i < lead; i++) g += '<span></span>';
      for (let d = 1; d <= n; d++) { const s = y + '-' + pad(m) + '-' + pad(d); g += '<span class="' + (s === tod ? 'today ' : '') + (has.has(s) ? 'has' : '') + '">' + d + '</span>'; }
      h += '<button class="ymon glass' + (tod.slice(0, 7) === y + '-' + pad(m) ? ' cur' : '') + '" type="button" data-month="' + first + '"><h4>' + esc(MONTHS[m - 1]) + '</h4><div class="ygrid">' + g + '</div></button>';
    }
    return '<div class="navrow"><button class="iconbtn glass" type="button" data-act="prev" aria-label="Previous year">' + ICON.chevL + '</button><span class="lbl">' + y + '</span><button class="iconbtn glass" type="button" data-act="next" aria-label="Next year">' + ICON.chevR + '</button></div><div class="year">' + h + '</div>';
  }

  // ---- List ----
  let listFrom = null;
  function renderList() {
    const from = listFrom || st.sel;
    const days = new Map();
    for (const x of st.occ) {
      const first = x.allDay ? x.startDate : ymd(x.start);
      const last = x.allDay ? addDays(x.endDate, -1) : ymd(Math.max(x.start, x.end - 1));
      for (let d = first < from ? from : first; d <= last && d <= addDays(first, 60); d = addDays(d, 1)) { if (!days.has(d)) days.set(d, []); days.get(d).push(x); }
    }
    const keys = [...days.keys()].filter(d => d >= from).sort().slice(0, 120);
    const w = st.win || wantedWindow();
    let h = '<div class="navrow"><button class="textbtn" type="button" data-act="earlier">Earlier</button><span class="lbl">' + esc('From ' + medDate(from)) + '</span><button class="textbtn" type="button" data-act="fromToday">Today</button></div>';
    if (!keys.length) h += '<div class="empty glass"><strong>Nothing coming up</strong>Nothing between ' + esc(medDate(from)) + ' and ' + esc(medDate(ymd(w.to - 1))) + '.</div>';
    for (const d of keys) {
      const evs = days.get(d).sort((a, b) => (b.allDay - a.allDay) || a.start - b.start);
      h += '<div class="lsec"><div class="dayhead' + (d === today() ? ' today' : '') + '"><b>' + esc(d === today() ? 'Today' : d === addDays(today(), 1) ? 'Tomorrow' : fmt(noon(d), { weekday: 'long' })) + '</b><span>' + esc(fmt(noon(d), { day: 'numeric', month: 'long', year: partsOf(d).y === partsOf(today()).y ? undefined : 'numeric' })) + '</span>' + wxLine(d) + '</div><div class="rgroup glass">' + evs.map(x => evRow(x, { noPast: true })).join('') + '</div></div>';
    }
    h += '<p class="hint" style="text-align:center">Events loaded up to ' + esc(medDate(ymd(w.to - 1))) + '. Look at a later month to load more.</p>';
    return h;
  }

  // ---- Search ----
  function renderSearch() {
    $('title').firstChild.textContent = 'Search'; $('titleSub').textContent = '';
    const qs = st.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!qs.length) { main.innerHTML = '<div class="empty glass"><strong>Search events</strong>Titles, places and notes of everything loaded.</div>'; return; }
    const hits = st.occ.filter(x => matches(x, qs)).sort((a, b) => a.start - b.start).slice(0, 200);
    if (!hits.length) { main.innerHTML = '<div class="empty glass"><strong>No matches</strong>Nothing loaded matches “' + esc(st.search) + '”.</div>'; return; }
    const days = new Map();
    for (const x of hits) { const d = x.allDay ? x.startDate : ymd(x.start); if (!days.has(d)) days.set(d, []); days.get(d).push(x); }
    let h = '<p class="resulthead">' + plural(hits.length, 'match') + (hits.length === 200 ? ' (first 200)' : '') + '</p>';
    for (const [d, evs] of days) h += '<div class="lsec"><div class="dayhead"><b>' + esc(fmt(noon(d), { weekday: 'long' })) + '</b><span>' + esc(fmt(noon(d), { day: 'numeric', month: 'long', year: 'numeric' })) + '</span></div><div class="rgroup glass">' + evs.map(x => evRow(x, { noPast: true })).join('') + '</div></div>';
    main.innerHTML = h;
  }

  // ---------------------------------------------------------------------
  // Moving around
  // ---------------------------------------------------------------------
  function setView(v) { st.view = v; ls.set(K.view, v); listFrom = null; render(); refresh(); }
  function goTo(day, view) { st.sel = day; if (view) setView(view); else { render(); refresh(); } }
  function step(n) {
    if (st.view === 'day') goTo(addDays(st.sel, n));
    else if (st.view === 'week') goTo(addDays(st.sel, 7 * n));
    else if (st.view === 'month') { const m = addMonths(monthStart(st.sel), n); goTo(m === monthStart(today()) ? today() : m); }
    else if (st.view === 'year') { const p = partsOf(st.sel); goTo((p.y + n) + st.sel.slice(4)); }
  }
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => { closeSearch(); setView(b.dataset.view); });
  $('todayBtn').onclick = () => { listFrom = null; goTo(today()); };
  $('titleBtn').onclick = () => { if (st.view !== 'year') setView('year'); };
  main.addEventListener('click', e => {
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'prev') step(-1); else if (a === 'next') step(1);
      else if (a === 'retry') { st.api = 'checking'; render(); ping().then(() => { render(); refresh({ loud: true, force: true }); }); }
      else if (a === 'earlier') { listFrom = addMonths(monthStart(listFrom || st.sel), -1); render(); }
      else if (a === 'fromToday') { listFrom = null; st.sel = today(); render(); }
      return;
    }
    const ev = e.target.closest('[data-ev]');
    if (ev) { if (ev.classList.contains('tev') && ev.dataset.dragged) { delete ev.dataset.dragged; return; } const x = st.occ.find(o => o.id === ev.dataset.ev); if (x) openEvent(x); return; }
    const mday = e.target.closest('.mday');
    if (mday) { const d = mday.dataset.day; if (d === st.sel) { setView('day'); } else { st.sel = d; render(); } return; }
    const sd = e.target.closest('.strip button[data-day], .dh[data-day]');
    if (sd) { st.sel = sd.dataset.day; if (st.view === 'week') setView('day'); else render(); return; }
    const ym = e.target.closest('.ymon');
    if (ym) { const d = ym.dataset.month; st.sel = d === monthStart(today()) ? today() : d; setView('month'); return; }
    const col = e.target.closest('.col');
    if (col && !e.target.closest('.tev')) {
      // A tap on empty time starts a new event there, as in Google Calendar.
      const r = col.getBoundingClientRect(), hour = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour')) || 56;
      const hrs = Math.floor(((e.clientY - r.top) / hour) * 2) / 2;
      const p = partsOf(col.dataset.day);
      openEditor({ start: I.zonedToUtc({ y: p.y, m: p.m, d: p.d, h: Math.floor(hrs), mi: (hrs % 1) * 60, s: 0 }, TZ) });
    }
  });
  // Swipe left or right on the month grid, the week strip or the time grid.
  (function () {
    let s = null;
    main.addEventListener('touchstart', e => { const el = e.target.closest('[data-swipe]'); s = el && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, kind: el.dataset.swipe, t: Date.now() } : null; }, { passive: true });
    main.addEventListener('touchend', e => {
      if (!s) return;
      const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y, took = Date.now() - s.t;
      const k = s.kind; s = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || took > 800) return;
      if (dragging) return;
      const n = dx < 0 ? 1 : -1;
      if (k === 'month') step(n); else if (k === 'week') goTo(addDays(st.sel, 7 * n)); else goTo(addDays(st.sel, n));
    }, { passive: true });
  })();

  // ---- search ----
  $('searchBtn').onclick = () => { if (st.searching) closeSearch(); else { st.searching = true; $('searchBar').hidden = false; $('searchBtn').setAttribute('aria-pressed', 'true'); render(); setTimeout(() => $('searchIn').focus(), 50); } };
  function closeSearch() { if (!st.searching) return; st.searching = false; st.search = ''; $('searchIn').value = ''; $('searchBar').hidden = true; $('searchClear').hidden = true; $('searchBtn').setAttribute('aria-pressed', 'false'); render(); }
  $('searchIn').addEventListener('input', () => { st.search = $('searchIn').value; $('searchClear').hidden = !st.search; render(); });
  $('searchClear').onclick = () => { $('searchIn').value = ''; st.search = ''; $('searchClear').hidden = true; render(); $('searchIn').focus(); };
  $('searchIn').addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });

  // ---------------------------------------------------------------------
  // Drag an event to move it, or its bottom edge to resize it (Day, Week)
  // ---------------------------------------------------------------------
  let dragging = false;
  function wireDrag(tv) {
    const hour = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour')) || 56;
    let d = null, timer = null;
    const snap = ms => Math.round(ms / (15 * MIN)) * 15 * MIN;
    const begin = (el, mode, x0, y0) => {
      const id = el.dataset.ev, occ = st.occ.find(o => o.id === id);
      if (!occ || occ.kind !== 'family') return;
      d = { el, occ, mode, x0, y0, start: occ.start, end: occ.end, ns: occ.start, ne: occ.end, col: el.parentElement, moved: false };
      dragging = true; el.classList.add('drag');
      const lbl = document.createElement('span'); lbl.className = 'dragtime'; $('tgin').appendChild(lbl); d.lbl = lbl;
      update(x0, y0);
    };
    const update = (x, y) => {
      if (!d) return;
      const dy = (y - d.y0) / hour() * H;
      if (Math.abs(y - d.y0) > 4 || Math.abs(x - d.x0) > 4) d.moved = true;
      if (d.mode === 'resize') { d.ne = Math.max(d.start + 15 * MIN, snap(d.end + dy)); }
      else {
        let dayShift = 0;
        const cols = [...tv.querySelectorAll('.col')];
        if (cols.length > 1) { const w = d.col.getBoundingClientRect().width; dayShift = Math.round((x - d.x0) / w); }
        const ms = snap(d.start + dy) + dayShift * D;
        d.ns = ms; d.ne = ms + (d.end - d.start);
        if (dayShift !== d.shift) { d.shift = dayShift; const idx = cols.indexOf(d.col) + dayShift; const target = cols[Math.max(0, Math.min(cols.length - 1, idx))]; if (target && target !== d.el.parentElement) target.appendChild(d.el); }
      }
      const dayStart = dayMs(d.el.parentElement.dataset.day);
      const top = (d.ns - dayStart) / H, hgt = Math.max(0.25, (d.ne - d.ns) / H);
      d.el.style.top = 'calc(var(--hour) * ' + top.toFixed(4) + ')'; d.el.style.height = 'calc(var(--hour) * ' + hgt.toFixed(4) + ' - 2px)';
      d.lbl.textContent = fmtTime(d.mode === 'resize' ? d.ne : d.ns);
      d.lbl.style.top = 'calc(var(--hour) * ' + (d.mode === 'resize' ? top + hgt : top).toFixed(4) + ')';
    };
    const finish = async () => {
      if (!d) return;
      const x = d; d = null; dragging = false;
      x.el.classList.remove('drag'); x.lbl.remove();
      if (!x.moved || (x.ns === x.start && x.ne === x.end)) { render(); return; }
      x.el.dataset.dragged = '1';
      await moveOccurrence(x.occ, x.ns, x.ne);
    };
    tv.addEventListener('touchstart', e => {
      const el = e.target.closest('.tev'); if (!el || e.touches.length !== 1 || !el.querySelector('.rs')) return;
      const t = e.touches[0], mode = e.target.closest('.rs') ? 'resize' : 'move';
      const x0 = t.clientX, y0 = t.clientY;
      clearTimeout(timer);
      timer = setTimeout(() => { begin(el, mode, x0, y0); if (navigator.vibrate) try { navigator.vibrate(10); } catch {} }, 380);
      const cancel = () => { clearTimeout(timer); };
      el.addEventListener('touchmove', function mv(ev) { const tt = ev.touches[0]; if (!d && (Math.abs(tt.clientX - x0) > 8 || Math.abs(tt.clientY - y0) > 8)) { cancel(); el.removeEventListener('touchmove', mv); } }, { passive: true });
      el.addEventListener('touchend', cancel, { once: true }); el.addEventListener('touchcancel', cancel, { once: true });
    }, { passive: true });
    tv.addEventListener('touchmove', e => { if (!d) return; if (e.cancelable) e.preventDefault(); const t = e.touches[0]; update(t.clientX, t.clientY); }, { passive: false });
    tv.addEventListener('touchend', () => { clearTimeout(timer); if (d) finish(); }, { passive: true });
    tv.addEventListener('touchcancel', () => { clearTimeout(timer); if (d) finish(); }, { passive: true });
    tv.addEventListener('mousedown', e => {
      const el = e.target.closest('.tev'); if (!el || e.button !== 0 || !el.querySelector('.rs')) return;
      const mode = e.target.closest('.rs') ? 'resize' : 'move', x0 = e.clientX, y0 = e.clientY;
      let started = false;
      const mv = ev => { if (!started) { if (Math.abs(ev.clientX - x0) < 5 && Math.abs(ev.clientY - y0) < 5) return; started = true; begin(el, mode, x0, y0); } update(ev.clientX, ev.clientY); };
      const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); if (started) finish(); };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    });
  }
  async function moveOccurrence(x, ns, ne) {
    const o = x.o;
    let scope = 'all';
    if (o.recurring) {
      scope = await pick('This is a repeating event', 'Move only this occurrence, or every occurrence from here on?', [['this', 'Only this event'], ['future', 'All future events']]);
      if (!scope) { render(); return; }
    }
    const f = formFrom(x); f.start = ns; f.end = ne;
    await saveEvent(x, f, scope);
  }

  // ---------------------------------------------------------------------
  // Sheets, toast, pills (as in Notes and Travel)
  // ---------------------------------------------------------------------
  const focusStack = [];
  const lockPage = () => document.documentElement.classList.toggle('locked', [...document.querySelectorAll('.sheetwrap')].some(w => !w.hidden));
  function openSheet(id) { focusStack.push(document.activeElement); $(id).hidden = false; lockPage(); }
  function closeSheet(id) { $(id).hidden = true; lockPage(); const f = focusStack.pop(); if (f && f.focus && document.contains(f)) f.focus(); }
  const closers = { edSheet: () => cancelEditor(), pickSheet: () => resolvePick(null) };
  const closeWrap = w => (closers[w.id] || (() => closeSheet(w.id)))();
  document.querySelectorAll('.sheetwrap').forEach(w => w.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeWrap(w); }));
  if (window.visualViewport) {
    const vv = window.visualViewport, root = document.documentElement.style;
    const fit = () => { root.setProperty('--vvh', vv.height + 'px'); root.setProperty('--vvt', vv.offsetTop + 'px'); };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
  }
  document.addEventListener('focusin', e => { const el = e.target; if (el.matches && el.matches('input, textarea, select') && el.closest('.sheetbody')) setTimeout(() => el.scrollIntoView({ block: 'nearest' }), 350); });
  document.querySelectorAll('.sheetwrap').forEach(w => {
    const sheet = w.querySelector('.sheet'), scrim = w.querySelector('.scrim');
    let y0 = null, t0 = 0, dy = 0, drag = false, suppress = false;
    const reset = () => { sheet.classList.remove('dragging', 'settling'); sheet.style.transform = ''; scrim.style.opacity = ''; };
    const start = (y, target) => { if (!target.closest('.grab, .sheethead') || target.closest('button')) { y0 = null; return; } y0 = y; t0 = Date.now(); dy = 0; drag = false; };
    const move = (y, e) => {
      if (y0 === null) return;
      dy = y - y0;
      if (!drag) { if (dy < 8) return; drag = true; sheet.classList.add('dragging'); }
      if (e.cancelable) e.preventDefault();
      const dd = Math.max(0, dy);
      sheet.style.transform = 'translateY(' + dd + 'px)'; scrim.style.opacity = String(Math.max(0, 1 - dd / sheet.offsetHeight));
    };
    const end = () => {
      if (y0 === null) return;
      y0 = null;
      if (!drag) return;
      suppress = true; setTimeout(() => { suppress = false; }, 50);
      const fast = dy / Math.max(1, Date.now() - t0) > 0.5;
      sheet.classList.remove('dragging'); sheet.classList.add('settling');
      if (dy > 110 || (fast && dy > 30)) { sheet.style.transform = 'translateY(100%)'; scrim.style.opacity = '0'; setTimeout(() => { closeWrap(w); reset(); }, 260); }
      else { sheet.style.transform = ''; scrim.style.opacity = ''; setTimeout(reset, 300); }
    };
    sheet.addEventListener('touchstart', e => { if (e.touches.length === 1) start(e.touches[0].clientY, e.target); }, { passive: true });
    sheet.addEventListener('touchmove', e => move(e.touches[0].clientY, e), { passive: false });
    sheet.addEventListener('touchend', end); sheet.addEventListener('touchcancel', end);
    sheet.addEventListener('mousedown', e => { if (e.button === 0) start(e.clientY, e.target); });
    window.addEventListener('mousemove', e => move(e.clientY, e)); window.addEventListener('mouseup', end);
    sheet.addEventListener('click', e => { if (suppress) { e.stopPropagation(); e.preventDefault(); } }, true);
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.sheetwrap')].reverse().find(w => !w.hidden);
    if (open) closeWrap(open); else if (st.searching) closeSearch();
  });
  let toastTimer;
  function toast(msg, undo, ms) {
    $('toastMsg').textContent = msg;
    $('toastAct').hidden = !undo;
    $('toastAct').textContent = undo && undo.label || 'Undo';
    $('toastAct').onclick = () => { (undo.action || undo)(); $('toast').hidden = true; };
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, ms || 4000);
  }
  function animateIn(el) { el.classList.add('enter'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('enter'), 900); }
  let pillAt = 0, pillTimer = null;
  function busyPill(text) {
    const p = $('syncPill');
    if (text) { clearTimeout(pillTimer); if (p.hidden) pillAt = Date.now(); p.classList.remove('out', 'done'); p.hidden = false; $('syncPillTxt').textContent = text; return; }
    if (p.hidden || p.classList.contains('out')) return;
    clearTimeout(pillTimer);
    pillTimer = setTimeout(() => { p.classList.add('out'); pillTimer = setTimeout(() => { p.hidden = true; p.classList.remove('out', 'done'); }, 450); }, Math.max(0, 900 - (Date.now() - pillAt)));
  }
  function pillDone(text) {
    const p = $('syncPill');
    if (p.hidden) return;
    clearTimeout(pillTimer);
    p.classList.add('done'); $('syncPillTxt').textContent = text;
    pillTimer = setTimeout(() => { p.classList.add('out'); pillTimer = setTimeout(() => { p.hidden = true; p.classList.remove('out', 'done'); }, 450); }, 1300);
  }
  // A choice sheet: resolves to the chosen key, or null.
  let pickResolve = null;
  function pick(title, hint, rows) {
    return new Promise(res => {
      pickResolve = res;
      $('pkLbl').textContent = title; $('pkHint').textContent = hint || ''; $('pkHint').hidden = !hint;
      $('pkRows').innerHTML = rows.map(([k, label, cls]) => '<button class="pickrow' + (cls ? ' ' + cls : '') + '" type="button" data-pick="' + esc(k) + '">' + esc(label) + '</button>').join('');
      openSheet('pickSheet');
    });
  }
  function resolvePick(v) { closeSheet('pickSheet'); const r = pickResolve; pickResolve = null; if (r) r(v); }
  $('pkRows').addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (b) resolvePick(b.dataset.pick); });

  // ---------------------------------------------------------------------
  // One event
  // ---------------------------------------------------------------------
  let shown = null;
  const alarmWords = (a, allDay) => {
    if (a.at != null) return 'At ' + medDate(ymd(a.at)) + ', ' + fmtTime(a.at);
    const m = a.minutes;
    if (allDay) { if (m >= 0 && m < 1440) return 'On the day at ' + fmtTime(dayMs('2000-01-01') + m * MIN); const before = -m; const days = Math.ceil(before / 1440); const at = (days * 1440 - before) % 1440; return (days === 7 ? '1 week' : plural(days, 'day')) + ' before at ' + fmtTime(dayMs('2000-01-01') + at * MIN); }
    if (m === 0) return 'At time of event';
    const b = Math.abs(m), rel = a.related === 'end' ? ' the end' : '';
    const w = b % 10080 === 0 ? plural(b / 10080, 'week') : b % 1440 === 0 ? plural(b / 1440, 'day') : b % 60 === 0 ? plural(b / 60, 'hour') : plural(b, 'minute');
    return w + (m < 0 ? ' before' : ' after') + rel;
  };
  function whenWords(x) {
    if (x.allDay) {
      const days = Math.round((dayMs(x.endDate) - dayMs(x.startDate)) / D);
      return days <= 1 ? '<b>' + esc(longDate(x.startDate)) + '</b><br>All day' : '<b>' + esc(medDate(x.startDate)) + ' – ' + esc(medDate(addDays(x.endDate, -1))) + '</b><br>' + plural(days, 'day');
    }
    const sameDay = ymd(x.start) === ymd(Math.max(x.start, x.end - 1));
    if (sameDay) return '<b>' + esc(longDate(ymd(x.start))) + '</b><br>' + esc(fmtTime(x.start) + (x.end > x.start ? ' – ' + fmtTime(x.end) : ''));
    return '<b>' + esc(medDate(ymd(x.start)) + ', ' + fmtTime(x.start)) + '</b><br>to ' + esc(medDate(ymd(x.end)) + ', ' + fmtTime(x.end));
  }
  function openEvent(x) {
    shown = x;
    const o = x.o, fam = x.kind === 'family';
    const rows = [];
    const kv = (icon, body, extra) => '<div class="kvrow"><span class="ic">' + ICON[icon] + '</span><span class="v">' + body + '</span>' + (extra || '') + '</div>';
    if (fam) {
      if (o.recurring) { const rr = I.prop(o.master, 'RRULE'); rows.push(kv('repeat', esc(rr ? I.ruleText(rr.value, I.dateProp(o.master, 'DTSTART'), u => medDate(ymdOf(u))) : 'Repeats on set dates') + (x.o.comp !== x.o.master ? '<small>This occurrence was changed on its own</small>' : ''))); }
      if (o.location) rows.push('<a class="kvrow" href="https://maps.apple.com/?q=' + encodeURIComponent(o.location) + '" target="_blank" rel="noopener"><span class="ic">' + ICON.map + '</span><span class="v">' + esc(o.location) + '<small>Open in Maps</small></span><span class="go">' + ICON.ext + '</span></a>');
      if (o.travel) rows.push(kv('car', esc(o.travel >= 60 ? (o.travel / 60) + ' h' : o.travel + ' min') + ' travel time'));
      if (o.alarms.length) rows.push(kv('bell', o.alarms.map(a => esc(alarmWords(a, x.allDay))).join('<br>')));
      if (o.transp === 'TRANSPARENT') rows.push(kv('busy', 'Shown as free'));
      if (o.url) rows.push('<a class="kvrow" href="' + esc(/^https?:/i.test(o.url) ? o.url : '#') + '" target="_blank" rel="noopener"><span class="ic">' + ICON.link + '</span><span class="v">' + esc(o.url) + '</span><span class="go">' + ICON.ext + '</span></a>');
      if (o.attendees.length || o.organizer) rows.push(kv('people', (o.organizer ? '<span class="att"><i></i>' + esc(o.organizer.name || o.organizer.email) + ' <small>organizer</small></span>' : '') + o.attendees.map(a => '<span class="att ' + (a.status === 'ACCEPTED' ? 'yes' : a.status === 'DECLINED' ? 'no' : '') + '"><i></i>' + esc(a.name || a.email) + (a.status && a.status !== 'NEEDS-ACTION' ? ' <small>' + esc(a.status.toLowerCase()) + '</small>' : '') + '</span>').join('')));
      if (o.description) rows.push(kv('notes', esc(o.description)));
    } else {
      if (x.sub) rows.push(kv(x.kind === 'note' ? 'notes' : x.kind === 'travel' ? (x.icon || 'plane') : x.kind === 'mail' ? 'mail' : x.kind === 'fitness' ? 'dumbbell' : x.kind === 'drinks' ? 'glass' : 'flag', esc(x.sub)));
      if (x.notes) rows.push(kv('notes', esc(x.notes)));
    }
    const cn = fam ? (st.calendar && st.calendar.name || 'Family') : LAYER[x.kind].name;
    $('evBody').innerHTML = '<div class="evhead" style="--c:' + esc(x.color) + '"><span class="cn"><i></i>' + esc(cn) + '</span><h3' + (x.done ? ' class="done"' : '') + '>' + esc(x.title) + '</h3><p class="when">' + whenWords(x) + '</p></div>'
      + (rows.length ? '<div class="rgroup glass">' + rows.join('') + '</div>' : '')
      + (fam ? '<div class="actrow"><button class="btn quiet danger" type="button" id="evDelete">Delete Event</button></div>'
        : '<div class="rgroup glass">' + (x.link ? '<a class="rowbtn" href="' + esc(x.link) + '"><span class="ic">' + ICON.ext + '</span><span>Open in ' + esc(LAYER[x.kind].name) + '<span class="sub">' + esc(x.kind === 'holiday' ? '' : 'Where it comes from') + '</span></span></a>' : '') + (x.kind !== 'family' && x.kind !== 'drinks' && st.api === 'ok' ? '<button class="rowbtn" type="button" id="evCopy"><span class="ic">' + ICON.cal + '</span><span>Add to the Family calendar<span class="sub">A copy, as an event of its own</span></span></button>' : '') + '</div>');
    $('evActs').innerHTML = (fam && st.api === 'ok' ? '<button class="textbtn" type="button" id="evEdit">Edit</button>' : '') + '<button class="iconbtn" type="button" data-close aria-label="Done">' + ICON.close + '</button>';
    openSheet('evSheet');
    const del = $('evDelete'); if (del) del.onclick = () => deleteEvent(x);
    const ed = $('evEdit'); if (ed) ed.onclick = () => { closeSheet('evSheet'); openEditor({ occ: x }); };
    const cp = $('evCopy'); if (cp) cp.onclick = () => { closeSheet('evSheet'); openEditor({ copyOf: x }); };
  }

  // ---------------------------------------------------------------------
  // The editor
  // ---------------------------------------------------------------------
  const ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'America/Sao_Paulo',
    'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Paris', 'Europe/Madrid', 'Europe/Berlin', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Zurich', 'Europe/Stockholm', 'Europe/Athens', 'Europe/Istanbul',
    'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney', 'Australia/Perth', 'Pacific/Auckland', 'UTC'];
  const ALERTS_TIMED = [['', 'None'], ['PT0M', 'At time of event'], ['-PT5M', '5 minutes before'], ['-PT10M', '10 minutes before'], ['-PT15M', '15 minutes before'], ['-PT30M', '30 minutes before'], ['-PT1H', '1 hour before'], ['-PT2H', '2 hours before'], ['-P1D', '1 day before'], ['-P2D', '2 days before'], ['-P1W', '1 week before']];
  const ALERTS_ALLDAY = [['', 'None'], ['PT9H', 'On day of event (9 AM)'], ['-PT15H', '1 day before (9 AM)'], ['-P1DT15H', '2 days before (9 AM)'], ['-P6DT15H', '1 week before']];
  const TRAVEL = [[0, 'None'], [5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour'], [90, '1 hour, 30 minutes'], [120, '2 hours']];
  const REPEATS = [['', 'Never'], ['FREQ=DAILY', 'Every Day'], ['FREQ=WEEKLY', 'Every Week'], ['FREQ=WEEKLY;INTERVAL=2', 'Every 2 Weeks'], ['FREQ=MONTHLY', 'Every Month'], ['FREQ=YEARLY', 'Every Year'], ['custom', 'Custom…']];
  const DUR = [[15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1.5 hours'], [120, '2 hours']];

  let ed = null;   // {f, occ, copyOf, isNew}
  const rruleOf = occ => { const p = occ && occ.o && I.prop(occ.o.master, 'RRULE'); return p ? p.value : ''; };
  // The form's fields from an occurrence (or blank at a time).
  function formFrom(x, at) {
    if (x) {
      const o = x.o || {};
      const alarms = (o.alarms || []).filter(a => a.minutes != null).map(a => I.fmtDuration(a.minutes * MIN)).slice(0, 2);
      let rule = x.kind === 'family' ? rruleOf(x) : '';
      // A rule with COUNT or UNTIL gets its end from the form's own end fields.
      const r = rule ? I.parseRRule(rule) : null;
      return { title: x.title === 'New Event' ? '' : x.title, location: x.kind === 'family' ? o.location : (x.kind === 'travel' ? x.sub : ''), allDay: !!x.allDay,
        start: x.start, end: x.allDay ? Math.max(x.start + D, x.end) : Math.max(x.start + 15 * MIN, x.end), tz: (x.kind === 'family' && o.tzid && o.tzid !== 'UTC' && I.validTz(o.tzid)) ? o.tzid : TZ,
        rule: r ? I.fmtRRule(Object.assign({}, r, { COUNT: undefined, UNTIL: undefined })) : '', ruleEnd: r && r.COUNT ? { type: 'count', count: r.COUNT } : r && r.UNTIL ? { type: 'date', date: ymdOf(r.UNTIL) } : { type: 'never' },
        alarms, travel: o.travel || 0, transp: o.transp === 'TRANSPARENT' ? 'TRANSPARENT' : 'OPAQUE', url: o.url || '', notes: x.kind === 'family' ? (o.description || '') : (x.notes || '') };
    }
    const base = at != null ? at : (() => { const w = I.utcToZoned(Date.now(), TZ); const p = partsOf(st.sel); return I.zonedToUtc({ y: p.y, m: p.m, d: p.d, h: Math.min(23, w.h + 1), mi: 0, s: 0 }, TZ); })();
    return { title: '', location: '', allDay: false, start: base, end: base + settings.duration * MIN, tz: TZ, rule: '', ruleEnd: { type: 'never' }, alarms: settings.alertTimed ? [settings.alertTimed] : [], travel: 0, transp: 'OPAQUE', url: '', notes: '' };
  }
  function openEditor({ occ, copyOf, start } = {}) {
    const f = occ ? formFrom(occ) : copyOf ? Object.assign(formFrom(copyOf), { rule: '', ruleEnd: { type: 'never' }, alarms: copyOf.allDay ? (settings.alertAllDay ? [settings.alertAllDay] : []) : (settings.alertTimed ? [settings.alertTimed] : []) }) : formFrom(null, start);
    ed = { f, occ: occ || null, isNew: !occ, custom: f.rule && !REPEATS.some(r => r[0] === f.rule) };
    $('edLbl').textContent = occ ? 'Edit Event' : 'New Event';
    $('edSave').setAttribute('aria-label', occ ? 'Done' : 'Add');
    renderEditor();
    openSheet('edSheet');
    if (!occ) setTimeout(() => { const t = $('edTitle'); if (t) t.focus(); }, 350);
  }
  function cancelEditor() { ed = null; closeSheet('edSheet'); }
  $('edCancel').onclick = cancelEditor;
  const wallIn = (ms, tz) => { const w = I.utcToZoned(ms, tz); return w.y + '-' + pad(w.m) + '-' + pad(w.d) + 'T' + pad(w.h) + ':' + pad(w.mi); };
  const fromInput = (v, tz) => { const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(v || ''); if (!m) return NaN; return I.zonedToUtc({ y: +m[1], m: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: 0 }, tz); };
  const opt = (list, val, fmtV) => list.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(fmtV ? fmtV(l) : l) + '</option>').join('');
  function renderEditor() {
    const f = ed.f, body = $('edBody');
    const rz = f.tz, zones = [...new Set([TZ, f.tz, ...ZONES])].filter(I.validTz);
    const startV = f.allDay ? ymd(f.start) : wallIn(f.start, rz), endV = f.allDay ? ymd(Math.max(f.start, f.end - 1)) : wallIn(f.end, rz);
    const alerts = f.allDay ? ALERTS_ALLDAY : ALERTS_TIMED;
    const repeatSel = ed.custom ? 'custom' : (REPEATS.some(r => r[0] === f.rule) ? f.rule : 'custom');
    const r = f.rule ? I.parseRRule(f.rule) : null;
    const sw = I.utcToZoned(f.start, rz), swd = I.wallParts(I.wallMs(sw)).wd, nth = Math.ceil(sw.d / 7), lastOfKind = sw.d + 7 > daysIn(sw.y, sw.m);
    const zoneLabel = z => { try { const parts = new Intl.DateTimeFormat('en-US', { timeZone: z, timeZoneName: 'short' }).formatToParts(new Date(f.start)); const n = (parts.find(p => p.type === 'timeZoneName') || {}).value || ''; return z.replace(/_/g, ' ').replace(/^.*\//, '') + (n ? ' (' + n + ')' : ''); } catch { return z; } };
    body.innerHTML = ''
      + '<div class="rgroup glass"><div class="frow big"><input class="txt" id="edTitle" placeholder="Title" value="' + esc(f.title) + '" autocomplete="off" enterkeyhint="next"></div>'
      + '<div class="frow"><span class="ic">' + ICON.map + '</span><input class="txt" id="edLoc" placeholder="Location" value="' + esc(f.location) + '" autocomplete="off"></div></div>'
      + '<div class="rgroup glass">'
      + '<div class="frow"><span class="ic">' + ICON.clock + '</span><label for="edAllDay">All-day</label><button class="switch" id="edAllDay" type="button" role="switch" aria-checked="' + f.allDay + '" aria-label="All-day"></button></div>'
      + '<div class="frow"><label for="edStart">Starts</label><input id="edStart" type="' + (f.allDay ? 'date' : 'datetime-local') + '" value="' + startV + '"></div>'
      + '<div class="frow"><label for="edEnd">Ends</label><input id="edEnd" type="' + (f.allDay ? 'date' : 'datetime-local') + '" value="' + endV + '"></div>'
      + (f.allDay ? '' : '<div class="frow"><label for="edTz">Time Zone</label><select id="edTz">' + opt(zones.map(z => [z, z]), f.tz, zoneLabel) + '</select></div>')
      + '<div class="frow"><span class="ic">' + ICON.repeat + '</span><label for="edRepeat">Repeat</label><select id="edRepeat">' + opt(REPEATS, repeatSel) + '</select></div>'
      + (repeatSel === 'custom' ? ''
        + '<div class="frow sub"><label for="edFreq">Frequency</label><select id="edFreq">' + opt([['DAILY', 'Daily'], ['WEEKLY', 'Weekly'], ['MONTHLY', 'Monthly'], ['YEARLY', 'Yearly']], r ? r.FREQ : 'WEEKLY') + '</select></div>'
        + '<div class="frow sub"><label for="edInterval">Every</label><input id="edInterval" type="number" min="1" max="99" inputmode="numeric" value="' + (r ? r.INTERVAL : 1) + '"><span class="l" style="flex:none;color:var(--muted)" id="edIntervalUnit">' + esc({ DAILY: 'days', WEEKLY: 'weeks', MONTHLY: 'months', YEARLY: 'years' }[r ? r.FREQ : 'WEEKLY']) + '</span></div>'
        + (r && r.FREQ === 'WEEKLY' ? '<div class="frow sub"><span class="l">On</span><span class="wdays" id="edWdays">' + [0, 1, 2, 3, 4, 5, 6].map(i => settings.weekStart === 0 ? (i + 6) % 7 : i).map(d => '<button type="button" data-wd="' + d + '" aria-pressed="' + ((r.BYDAY && r.BYDAY.length ? r.BYDAY.some(b => b.day === d) : d === swd)) + '" aria-label="' + esc(DAYNAMES[d]) + '">' + esc(DAYNAMES[d].slice(0, 1)) + '</button>').join('') + '</span></div>' : '')
        + (r && r.FREQ === 'MONTHLY' ? '<div class="frow sub"><label for="edMonthly">On</label><select id="edMonthly">' + opt([['day', 'Day ' + sw.d], ['nth', 'The ' + (lastOfKind && nth >= 4 ? 'last' : ['first', 'second', 'third', 'fourth', 'fifth'][nth - 1]) + ' ' + DAYNAMES[swd]]], r.BYDAY && r.BYDAY.length ? 'nth' : 'day') + '</select></div>' : '')
        : '')
      + (f.rule ? '<div class="frow' + (repeatSel === 'custom' ? ' sub' : '') + '"><label for="edRuleEnd">End Repeat</label><select id="edRuleEnd">' + opt([['never', 'Never'], ['date', 'On Date'], ['count', 'After…']], f.ruleEnd.type) + '</select></div>'
        + (f.ruleEnd.type === 'date' ? '<div class="frow sub"><label for="edUntil">Until</label><input id="edUntil" type="date" value="' + esc(f.ruleEnd.date || ymd(f.start + 90 * D)) + '"></div>' : '')
        + (f.ruleEnd.type === 'count' ? '<div class="frow sub"><label for="edCount">Times</label><input id="edCount" type="number" min="1" max="999" inputmode="numeric" value="' + (f.ruleEnd.count || 10) + '"></div>' : '') : '')
      + (f.allDay ? '' : '<div class="frow"><span class="ic">' + ICON.car + '</span><label for="edTravel">Travel Time</label><select id="edTravel">' + opt(TRAVEL, f.travel) + '</select></div>')
      + '</div>'
      + '<div class="rgroup glass">'
      + '<div class="frow"><span class="ic">' + ICON.bell + '</span><label for="edAlert1">Alert</label><select id="edAlert1">' + opt(alerts.concat(f.alarms[0] && !alerts.some(a => a[0] === f.alarms[0]) ? [[f.alarms[0], alarmWords({ minutes: I.parseDuration(f.alarms[0]) / MIN }, f.allDay)]] : []), f.alarms[0] || '') + '</select></div>'
      + (f.alarms[0] ? '<div class="frow sub"><label for="edAlert2">Second Alert</label><select id="edAlert2">' + opt(alerts.concat(f.alarms[1] && !alerts.some(a => a[0] === f.alarms[1]) ? [[f.alarms[1], alarmWords({ minutes: I.parseDuration(f.alarms[1]) / MIN }, f.allDay)]] : []), f.alarms[1] || '') + '</select></div>' : '')
      + '<div class="frow"><span class="ic">' + ICON.busy + '</span><label for="edTransp">Show As</label><select id="edTransp">' + opt([['OPAQUE', 'Busy'], ['TRANSPARENT', 'Free']], f.transp) + '</select></div>'
      + '</div>'
      + '<div class="rgroup glass"><div class="frow"><span class="ic">' + ICON.link + '</span><input class="txt" id="edUrl" type="url" inputmode="url" placeholder="URL" value="' + esc(f.url) + '" autocomplete="off" autocapitalize="off"></div>'
      + '<div class="frow"><span class="ic">' + ICON.notes + '</span><textarea id="edNotes" placeholder="Notes">' + esc(f.notes) + '</textarea></div></div>'
      + (ed.occ ? '<button class="btn quiet danger" type="button" id="edDelete">Delete Event</button>' : '')
      + '<p class="hint">Saved to the ' + esc(st.calendar && st.calendar.name || 'Family') + ' calendar in iCloud, so it shows on every phone with it, and the phone’s own Calendar does the alerting.</p>';
    wireEditor();
  }
  function wireEditor() {
    const f = ed.f, on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    on('edTitle', 'input', e => { f.title = e.target.value; });
    on('edLoc', 'input', e => { f.location = e.target.value; });
    on('edUrl', 'input', e => { f.url = e.target.value.trim(); });
    on('edNotes', 'input', e => { f.notes = e.target.value; });
    on('edAllDay', 'click', () => {
      f.allDay = !f.allDay;
      if (f.allDay) { f.start = dayMs(ymd(f.start)); f.end = Math.max(f.start + D, dayMs(addDays(ymd(Math.max(f.start, f.end - 1)), 1))); f.alarms = settings.alertAllDay ? [settings.alertAllDay] : []; f.travel = 0; }
      else { const w = I.utcToZoned(Date.now(), TZ); const p = partsOf(ymd(f.start)); f.start = I.zonedToUtc({ y: p.y, m: p.m, d: p.d, h: Math.min(23, w.h + 1), mi: 0, s: 0 }, TZ); f.end = f.start + settings.duration * MIN; f.alarms = settings.alertTimed ? [settings.alertTimed] : []; }
      renderEditor();
    });
    on('edStart', 'change', e => { const v = fromInput(e.target.value, f.allDay ? TZ : f.tz); if (isNaN(v)) return; const len = f.end - f.start; f.start = v; f.end = v + Math.max(f.allDay ? D : 0, len); renderEditor(); });
    on('edEnd', 'change', e => { let v = fromInput(e.target.value, f.allDay ? TZ : f.tz); if (isNaN(v)) return; if (f.allDay) v += D; if (v <= f.start) v = f.start + (f.allDay ? D : 15 * MIN); f.end = v; renderEditor(); });
    on('edTz', 'change', e => { const z = e.target.value; if (!I.validTz(z)) return; const ws = I.utcToZoned(f.start, f.tz), we = I.utcToZoned(f.end, f.tz); f.tz = z; f.start = I.zonedToUtc(ws, z); f.end = I.zonedToUtc(we, z); renderEditor(); });
    on('edRepeat', 'change', e => {
      const v = e.target.value;
      ed.custom = v === 'custom';
      if (v === 'custom') { const r = f.rule ? I.parseRRule(f.rule) : { FREQ: 'WEEKLY', INTERVAL: 1 }; f.rule = I.fmtRRule(Object.assign(r, { COUNT: undefined, UNTIL: undefined })); }
      else { f.rule = v; f.ruleEnd = f.ruleEnd.type ? f.ruleEnd : { type: 'never' }; }
      if (!f.rule) f.ruleEnd = { type: 'never' };
      renderEditor();
    });
    const custom = () => {
      const r = f.rule ? I.parseRRule(f.rule) : { FREQ: 'WEEKLY', INTERVAL: 1 };
      const freq = $('edFreq') ? $('edFreq').value : r.FREQ;
      const out = { FREQ: freq, INTERVAL: Math.max(1, Math.min(99, parseInt($('edInterval') && $('edInterval').value, 10) || 1)) };
      if (freq === 'WEEKLY') { const days = [...document.querySelectorAll('#edWdays [aria-pressed="true"]')].map(b => ({ n: 0, day: +b.dataset.wd })); if (days.length) out.BYDAY = days; }
      if (freq === 'MONTHLY' && $('edMonthly') && $('edMonthly').value === 'nth') { const sw = I.utcToZoned(f.start, f.tz); const nth = Math.ceil(sw.d / 7), last = sw.d + 7 > daysIn(sw.y, sw.m); out.BYDAY = [{ n: last && nth >= 4 ? -1 : nth, day: I.wallParts(I.wallMs(sw)).wd }]; }
      f.rule = I.fmtRRule(out);
      renderEditor();
    };
    on('edFreq', 'change', custom); on('edInterval', 'change', custom); on('edMonthly', 'change', custom);
    const wd = $('edWdays'); if (wd) wd.addEventListener('click', e => { const b = e.target.closest('[data-wd]'); if (!b) return; b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); if (!wd.querySelector('[aria-pressed="true"]')) b.setAttribute('aria-pressed', 'true'); custom(); });
    on('edRuleEnd', 'change', e => { const t = e.target.value; f.ruleEnd = t === 'date' ? { type: 'date', date: f.ruleEnd.date || ymd(f.start + 90 * D) } : t === 'count' ? { type: 'count', count: f.ruleEnd.count || 10 } : { type: 'never' }; renderEditor(); });
    on('edUntil', 'change', e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) f.ruleEnd.date = e.target.value; });
    on('edCount', 'change', e => { f.ruleEnd.count = Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 1)); });
    on('edTravel', 'change', e => { f.travel = +e.target.value || 0; });
    on('edAlert1', 'change', e => { const v = e.target.value; f.alarms = v ? [v].concat(f.alarms.slice(1).filter(a => a !== v)) : []; renderEditor(); });
    on('edAlert2', 'change', e => { const v = e.target.value; f.alarms = v && v !== f.alarms[0] ? [f.alarms[0], v] : [f.alarms[0]]; renderEditor(); });
    on('edTransp', 'change', e => { f.transp = e.target.value; });
    on('edDelete', 'click', () => { const x = ed.occ; cancelEditor(); deleteEvent(x); });
  }
  $('edSave').onclick = async () => {
    if (!ed) return;
    const f = ed.f;
    if (!f.title.trim()) { f.title = 'New Event'; }
    if (f.end <= f.start) f.end = f.start + (f.allDay ? D : 15 * MIN);
    const x = ed.occ;
    let scope = 'all';
    if (x && x.o.recurring) {
      const changedRule = f.rule !== (function () { const r = I.parseRRule(rruleOf(x)); return I.fmtRRule(Object.assign({}, r, { COUNT: undefined, UNTIL: undefined })); })();
      if (changedRule) scope = await pick('This is a repeating event', 'The repeat itself changed, so the change applies from here on or to the whole series.', [['future', 'All future events'], ['all', 'All events']]);
      else scope = await pick('This is a repeating event', 'Save the changes for this occurrence only, for every occurrence from here on, or for all of them?', [['this', 'Only this event'], ['future', 'All future events'], ['all', 'All events']]);
      if (!scope) return;
    }
    $('edSave').disabled = true;
    try { await saveEvent(x, f, scope); ed = null; closeSheet('edSheet'); }
    finally { $('edSave').disabled = false; }
  };

  // ---------------------------------------------------------------------
  // Writing events
  // ---------------------------------------------------------------------
  const wallDt = (ms, tz) => Object.assign({ kind: 'datetime', utc: false, tzid: tz === 'UTC' ? null : tz }, I.utcToZoned(ms, tz), tz === 'UTC' ? { utc: true } : {});
  const dateDt = ms => Object.assign({ kind: 'date' }, partsOf(ymd(ms)), { h: 0, mi: 0, s: 0 });
  // The form's fields onto a VEVENT. `times` false leaves DTSTART/DTEND alone.
  function applyForm(ev, f, { times = true, rule = true } = {}) {
    I.setText(ev, 'SUMMARY', f.title.trim() || 'New Event');
    I.setText(ev, 'LOCATION', f.location.trim());
    I.setText(ev, 'DESCRIPTION', f.notes.trim());
    I.setText(ev, 'URL', f.url.trim());
    I.setProp(ev, 'TRANSP', f.transp);
    I.delProp(ev, 'DURATION');
    if (times) {
      if (f.allDay) { I.setDate(ev, 'DTSTART', dateDt(f.start)); I.setDate(ev, 'DTEND', dateDt(Math.max(f.start + D, f.end))); }
      else { I.setDate(ev, 'DTSTART', wallDt(f.start, f.tz)); I.setDate(ev, 'DTEND', wallDt(f.end, f.tz)); }
    }
    if (rule) {
      if (f.rule) {
        const r = I.parseRRule(f.rule);
        delete r.COUNT; delete r.UNTIL;
        if (f.ruleEnd.type === 'count') r.COUNT = f.ruleEnd.count || 10;
        else if (f.ruleEnd.type === 'date' && f.ruleEnd.date) r.UNTIL = f.allDay ? Object.assign({ kind: 'date' }, partsOf(f.ruleEnd.date), { h: 0, mi: 0, s: 0 }) : I.utcParts(I.zonedToUtc(Object.assign(partsOf(f.ruleEnd.date), { h: 23, mi: 59, s: 59 }), f.tz));
        I.setProp(ev, 'RRULE', I.fmtRRule(r));
      } else { I.delProp(ev, 'RRULE'); I.delProp(ev, 'RDATE'); I.delProp(ev, 'EXDATE'); }
    }
    if (f.allDay || !f.travel) I.delProp(ev, 'X-APPLE-TRAVEL-DURATION'); else I.setProp(ev, 'X-APPLE-TRAVEL-DURATION', I.fmtDuration(f.travel * MIN), { VALUE: 'DURATION' });
    ev.children = ev.children.filter(c => c.name !== 'VALARM');
    for (const a of f.alarms.filter(Boolean)) {
      const al = I.component('VALARM', [['ACTION', 'DISPLAY'], ['DESCRIPTION', 'Reminder'], ['TRIGGER', a], ['X-WR-ALARMUID', I.uid()], ['UID', I.uid()]]);
      ev.children.push(al);
    }
    I.setProp(ev, 'DTSTAMP', I.stamp()); I.setProp(ev, 'LAST-MODIFIED', I.stamp());
    I.setProp(ev, 'SEQUENCE', String((parseInt(I.text(ev, 'SEQUENCE'), 10) || 0) + 1));
  }
  const newCalendar = () => I.component('VCALENDAR', [['VERSION', '2.0'], ['PRODID', PRODID], ['CALSCALE', 'GREGORIAN']]);
  function newEvent(uid) { return I.component('VEVENT', [['UID', uid], ['CREATED', I.stamp()], ['SEQUENCE', '0'], ['STATUS', 'CONFIRMED']]); }
  const master = x => x.o.master;
  const isFirst = x => { const ds = I.dateProp(master(x), 'DTSTART'); return ds && I.toMs(ds, x.o && st.items.get(x.name) && st.items.get(x.name).cal, TZ) === (x.o.rid ? I.toMs(x.o.rid, st.items.get(x.name).cal, TZ) : x.start); };
  // The UTC moment just before an occurrence, for UNTIL when splitting a series.
  const untilBefore = (x, allDay) => allDay ? Object.assign({ kind: 'date' }, partsOf(addDays(x.o.rid ? ymdOf(x.o.rid) : x.startDate, -1)), { h: 0, mi: 0, s: 0 }) : I.utcParts((x.o.rid ? I.toMs(x.o.rid, st.items.get(x.name).cal, TZ) : x.start) - 1000);

  async function writeItem(name, cal, etag, { overwrite = false } = {}) {
    I.ensureTimezones(cal, new Date().getFullYear());
    const ics = I.serialize(cal);
    const headers = {};
    if (etag) headers['If-Match'] = etag;
    const res = await api('event?name=' + encodeURIComponent(name) + (overwrite || (etag === '' && st.items.has(name)) ? '&overwrite=1' : ''), { method: 'PUT', body: ics, headers });
    st.items.set(name, { etag: res.etag || '', ics, cal });
    return res;
  }
  async function saveEvent(x, f, scope) {
    if (st.api !== 'ok') { toast(errText({ code: st.api === 'off' ? 'unavailable' : st.api === 'unconfigured' ? 'no-account' : st.apiError || 'unreachable' }), null, 6000); return; }
    busyPill('Saving');
    try {
      if (!x) {
        const uid = I.uid(), cal = newCalendar(), ev = newEvent(uid);
        applyForm(ev, f); cal.children.push(ev);
        await writeItem(uid + '.ics', cal, null);
      } else {
        const item = st.items.get(x.name); if (!item) throw Object.assign(new Error('gone'), { code: 'changed' });
        const cal = item.cal, m = master(x);
        if (!x.o.recurring || scope === 'all') {
          if (x.o.recurring) {
            // Shift the series by as much as this occurrence moved; keep its dates otherwise.
            const delta = f.start - x.start, ms = I.toMs(I.dateProp(m, 'DTSTART'), cal, TZ);
            const f2 = Object.assign({}, f, { start: ms + delta, end: ms + delta + (f.end - f.start) });
            applyForm(m, f2);
          } else applyForm(m, f);
          await writeItem(x.name, cal, item.etag);
        } else if (scope === 'this') {
          let ov = x.o.comp !== m ? x.o.comp : null;
          if (!ov) {
            ov = I.component('VEVENT', []);
            for (const p of m.props) if (!['RRULE', 'RDATE', 'EXDATE', 'DTSTART', 'DTEND', 'DURATION', 'CREATED', 'SEQUENCE'].includes(p.name)) ov.props.push({ name: p.name, params: Object.assign({}, p.params), value: p.value });
            I.setDate(ov, 'RECURRENCE-ID', x.o.rid);
            ov.props.push({ name: 'CREATED', params: {}, value: I.stamp() }, { name: 'SEQUENCE', params: {}, value: '0' });
            for (const c of m.children) if (c.name === 'VALARM') ov.children.push(JSON.parse(JSON.stringify(c)));
            cal.children.push(ov);
          }
          applyForm(ov, f, { rule: false });
          await writeItem(x.name, cal, item.etag);
        } else if (scope === 'future') {
          if (isFirst(x)) { applyForm(m, f); await writeItem(x.name, cal, item.etag); }
          else {
            const uid = I.uid(), cal2 = newCalendar(), ev = newEvent(uid);
            for (const p of m.props) if (!['UID', 'DTSTART', 'DTEND', 'DURATION', 'CREATED', 'SEQUENCE', 'RECURRENCE-ID', 'EXDATE', 'RDATE'].includes(p.name)) ev.props.push({ name: p.name, params: Object.assign({}, p.params), value: p.value });
            applyForm(ev, f); cal2.children.push(ev);
            // Changed occurrences from here on move to the new series; the old one ends before this occurrence.
            const cut = x.o.rid ? I.toMs(x.o.rid, cal, TZ) : x.start;
            const rule = I.parseRRule(I.prop(m, 'RRULE') ? I.prop(m, 'RRULE').value : 'FREQ=DAILY');
            delete rule.COUNT; rule.UNTIL = untilBefore(x, x.allDay);
            I.setProp(m, 'RRULE', I.fmtRRule(rule));
            cal.children = cal.children.filter(c => c.name !== 'VEVENT' || c === m || I.toMs(I.dateProp(c, 'RECURRENCE-ID'), cal, TZ) < cut);
            for (const p of I.props(m, 'EXDATE')) { /* keep: dates before the cut still matter, later ones are harmless */ }
            I.setProp(m, 'DTSTAMP', I.stamp()); I.setProp(m, 'LAST-MODIFIED', I.stamp()); I.setProp(m, 'SEQUENCE', String((parseInt(I.text(m, 'SEQUENCE'), 10) || 0) + 1));
            await writeItem(uid + '.ics', cal2, null);
            await writeItem(x.name, cal, item.etag);
          }
        }
      }
      st.lastRefresh = 0; saveCache(); rebuild(); render();
      pillDone('Saved');
      setTimeout(() => refresh({ force: true }), 1200);
    } catch (e) {
      busyPill('');
      toast(errText(e), null, 6000);
      if (e.code === 'changed') refresh({ force: true });
    }
  }
  async function deleteEvent(x) {
    if (x.kind !== 'family') return;
    let scope = 'all';
    if (x.o.recurring) {
      scope = await pick('Delete this repeating event', 'Delete only this occurrence, every occurrence from here on, or the whole series?', [['this', 'Delete This Event Only', 'danger'], ['future', 'Delete All Future Events', 'danger'], ['all', 'Delete All Events', 'danger']]);
      if (!scope) return;
    } else {
      const ok = await pick('Delete “' + x.title + '”?', '', [['all', 'Delete Event', 'danger']]);
      if (!ok) return;
    }
    if (!$('evSheet').hidden) closeSheet('evSheet');
    const item = st.items.get(x.name); if (!item) return;
    const before = item.ics;
    busyPill('Deleting');
    try {
      if (scope === 'all' || (scope === 'future' && isFirst(x))) {
        await api('event?name=' + encodeURIComponent(x.name), { method: 'DELETE', headers: item.etag ? { 'If-Match': item.etag } : {} });
        st.items.delete(x.name);
        st.lastRefresh = 0; saveCache(); rebuild(); render(); pillDone('Deleted');
        toast('Deleted “' + x.title + '”', { label: 'Undo', action: async () => { try { await writeItem(x.name, I.parse(before), null, { overwrite: true }); rebuild(); render(); saveCache(); } catch (e) { toast(errText(e)); } } }, 6000);
        return;
      }
      const cal = item.cal, m = master(x);
      if (scope === 'this') {
        if (x.o.comp !== m) cal.children = cal.children.filter(c => c !== x.o.comp);
        const ds = I.dateProp(m, 'DTSTART');
        const ex = ds.kind === 'date' ? Object.assign({ kind: 'date' }, partsOf(x.startDate), { h: 0, mi: 0, s: 0 }) : x.o.rid;
        const v = I.dateValue(ex);
        m.props.push({ name: 'EXDATE', params: v.params, value: v.value });
      } else {
        const cut = x.o.rid ? I.toMs(x.o.rid, cal, TZ) : x.start;
        const rule = I.parseRRule(I.prop(m, 'RRULE') ? I.prop(m, 'RRULE').value : 'FREQ=DAILY');
        delete rule.COUNT; rule.UNTIL = untilBefore(x, x.allDay);
        I.setProp(m, 'RRULE', I.fmtRRule(rule));
        cal.children = cal.children.filter(c => c.name !== 'VEVENT' || c === m || I.toMs(I.dateProp(c, 'RECURRENCE-ID'), cal, TZ) < cut);
      }
      I.setProp(m, 'DTSTAMP', I.stamp()); I.setProp(m, 'LAST-MODIFIED', I.stamp()); I.setProp(m, 'SEQUENCE', String((parseInt(I.text(m, 'SEQUENCE'), 10) || 0) + 1));
      await writeItem(x.name, cal, item.etag);
      st.lastRefresh = 0; saveCache(); rebuild(); render(); pillDone('Deleted');
      toast(scope === 'this' ? 'Removed this occurrence' : 'Removed it from here on', { label: 'Undo', action: async () => { try { await writeItem(x.name, I.parse(before), null, { overwrite: true }); rebuild(); render(); saveCache(); } catch (e) { toast(errText(e)); } } }, 6000);
      setTimeout(() => refresh({ force: true }), 1200);
    } catch (e) { busyPill(''); toast(errText(e), null, 6000); if (e.code === 'changed') refresh({ force: true }); }
  }
  $('fab').onclick = () => { if (st.api !== 'ok') { toast(errText({ code: st.api === 'off' ? 'unavailable' : st.api === 'unconfigured' ? 'no-account' : st.apiError || 'unreachable' }), null, 6000); return; } openEditor({}); };

  // ---------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------
  function renderSettings() {
    const status = st.api === 'ok' ? { cls: 'ok', text: '<b>Connected</b> to the ' + esc(st.calendar && st.calendar.name || 'Family') + ' calendar in iCloud.' + (st.lastRefresh ? ' Last checked ' + esc(ago(st.lastRefresh)) + '.' : '') }
      : st.api === 'checking' ? { cls: '', text: 'Checking…' }
      : st.api === 'off' ? { cls: 'bad', text: esc(offWords()) }
      : st.api === 'unconfigured' ? { cls: 'bad', text: 'Not set up yet: add the ICLOUD_APPLE_ID and ICLOUD_APP_PASSWORD secrets, then run the News workflow (Calendar README, “Set up”).' }
      : st.api === 'offline' ? { cls: 'bad', text: 'Offline. Showing the events last seen' + (st.lastRefresh ? ', ' + esc(ago(st.lastRefresh)) : '') + '.' }
      : { cls: 'bad', text: esc(errText({ code: st.apiError })) + (st.calendars && st.calendars.length ? ' Calendars there: ' + esc(st.calendars.join(', ')) + '.' : '') };
    const sw = (id, on, disabled) => '<button class="switch" type="button" role="switch" data-layer="' + id + '" aria-checked="' + on + '"' + (disabled ? ' disabled' : '') + '></button>';
    const seg = (id, opts, val) => '<div class="seg small ' + (opts.length === 2 ? 'two' : 'three') + '" role="radiogroup">' + opts.map(([v, l]) => '<button type="button" data-set="' + id + '" data-val="' + esc(v) + '" aria-pressed="' + (String(val) === String(v)) + '">' + esc(l) + '</button>').join('') + '</div>';
    const mailNote = !settings.layers.mail ? '' : st.mailState === 'signin' ? 'Sign in to your family account first: open aOS.' : st.mailState === 'no-copy' || st.mailState === 'no-token' ? 'If you use Mail, open it once, signed in, and its reminders show here' : st.mailState === 'error' ? 'Couldn’t read Gmail just now.' : st.mailState === 'loading' ? 'Reading…' : (st.mail ? plural(st.mail.items.length, 'reminder') : '');
    const drinksNote = !settings.layers.drinks ? LAYER.drinks.sub : st.drinksState === 'signin' ? 'Sign in to your family account first: open Drinks or aOS.' : st.drinksState === 'off' ? 'Family accounts aren’t switched on yet.' : st.drinksState === 'error' ? 'Couldn’t read your log just now.' : st.drinksState === 'loading' ? 'Reading…' : LAYER.drinks.sub;
    const wxNote = !settings.layers.weather ? '' : st.wx && st.wx.denied ? 'Location was refused; allow it for this site to see the forecast.' : st.wx && st.wx.days ? 'Forecast for the next 16 days' : 'Fetching…';
    $('stBody').innerHTML = ''
      + '<p class="label">iCloud</p><div class="rgroup glass"><div class="status ' + status.cls + '"><i></i><span>' + status.text + '</span></div>'
      + '<button class="rowbtn" type="button" id="stRefresh"><span class="ic">' + ICON.refresh + '</span><span>Check for changes now<span class="sub">Also happens when the app opens and every few minutes while it is open</span></span></button>'
      + (st.api === 'error' || st.api === 'ok' ? '<button class="rowbtn" type="button" id="stForget"><span class="ic">' + ICON.cal + '</span><span>Look up the calendar again<span class="sub">If the Family calendar was renamed or moved</span></span></button>' : '') + '</div>'
      + '<p class="label">Calendars</p><div class="rgroup glass">'
      + '<div class="lrow" style="--c:' + esc(calColor()) + '"><i></i><span class="l">' + esc(st.calendar && st.calendar.name || 'Family') + '<small>iCloud, shared with the family</small></span>' + sw('family', true, true) + '</div>'
      + ['holiday', 'note', 'travel', 'mail', 'fitness', 'drinks', 'weather'].map(k => { const key = { holiday: 'holidays', note: 'notes', travel: 'travel', mail: 'mail', fitness: 'fitness', drinks: 'drinks', weather: 'weather' }[k]; const note = k === 'mail' ? mailNote : k === 'weather' ? wxNote : k === 'drinks' ? drinksNote : k === 'holiday' ? LAYER[k].sub : layerNote(k); return '<div class="lrow" style="--c:' + LAYER[k].color + '"><i></i><span class="l">' + esc(LAYER[k].name) + '<small>' + esc(note) + '</small></span>' + sw(key, settings.layers[key]) + '</div>'; }).join('')
      + '</div><p class="hint">Every layer is optional: use the apps you want, and switch off the ones you don’t. Notes, Travel, Mail and Fitness each keep a copy of what they show here in your own family account (each signed in once), so they appear even though every app on an iPhone keeps its own storage. Only you see yours.</p>'
      + '<p class="label">Display</p><div class="rgroup glass">'
      + '<div class="frow"><span class="l">Week starts on</span>' + seg('weekStart', [[0, 'Sunday'], [1, 'Monday']], settings.weekStart) + '</div>'
      + '<div class="frow"><span class="l">Time</span>' + seg('clock', [['auto', 'Auto'], ['12', '12-hour'], ['24', '24-hour']], settings.clock) + '</div>'
      + '<div class="frow"><span class="l">Temperature</span>' + seg('units', [['auto', 'Auto'], ['f', '°F'], ['c', '°C']], settings.units) + '</div>'
      + '<div class="frow"><label for="stDayStart">Day view opens at</label><select id="stDayStart">' + opt(Array.from({ length: 24 }, (_, h) => [h, fmtHour(h)]), settings.dayStart) + '</select></div>'
      + '</div>'
      + '<p class="label">New events</p><div class="rgroup glass">'
      + '<div class="frow"><label for="stDur">Length</label><select id="stDur">' + opt(DUR, settings.duration) + '</select></div>'
      + '<div class="frow"><label for="stAlert">Alert</label><select id="stAlert">' + opt(ALERTS_TIMED, settings.alertTimed) + '</select></div>'
      + '<div class="frow"><label for="stAlertAD">All-day alert</label><select id="stAlertAD">' + opt(ALERTS_ALLDAY, settings.alertAllDay) + '</select></div>'
      + '</div>'
      + '<p class="hint">Events are read from and written to iCloud through this site’s own small server piece, which holds the Apple ID and app-specific password so they never reach a phone. The phone keeps a copy of the events it last saw; nothing else is stored or sent anywhere.</p>';
    $('stRefresh').onclick = () => { closeSheet('setSheet'); st.api = st.api === 'ok' ? 'ok' : 'checking'; ping().then(() => { render(); refresh({ loud: true, force: true }); loadLayers(true).then(() => loadMail(true)); loadDrinks(true); loadWeather(true); }); };
    const fg = $('stForget'); if (fg) fg.onclick = async () => { try { await api('forget', { method: 'POST' }); } catch {} closeSheet('setSheet'); st.api = 'checking'; render(); await ping(); render(); refresh({ loud: true, force: true }); };
    slideSegs();
    $('stDayStart').onchange = e => { settings.dayStart = +e.target.value; saveSettings(); };
    $('stDur').onchange = e => { settings.duration = +e.target.value; saveSettings(); };
    $('stAlert').onchange = e => { settings.alertTimed = e.target.value; saveSettings(); };
    $('stAlertAD').onchange = e => { settings.alertAllDay = e.target.value; saveSettings(); };
  }
  $('stBody').addEventListener('click', e => {
    const sw = e.target.closest('[data-layer]');
    if (sw && !sw.disabled) {
      const k = sw.dataset.layer; settings.layers[k] = !settings.layers[k]; saveSettings();
      if (['notes', 'travel', 'fitness', 'mail'].includes(k) && settings.layers[k]) loadLayers(true).then(() => { if (k === 'mail') return loadMail(true); }).then(() => renderSettings());
      if (k === 'drinks') { if (settings.layers.drinks) loadDrinks(true).then(() => renderSettings()); else st.drinks = null; }
      if (k === 'weather' && settings.layers.weather) loadWeather(true);
      rebuild(); render(); renderSettings(); return;
    }
    const b = e.target.closest('[data-set]');
    if (b) { const k = b.dataset.set; settings[k] = k === 'weekStart' ? +b.dataset.val : b.dataset.val; if (k === 'weekStart') settings.weekStartPicked = true; saveSettings(); render(); renderSettings(); }
  });
  const slideSegs = () => $('stBody').querySelectorAll('.seg').forEach(g => slide(g, g.querySelector('[aria-pressed="true"]'), 'seg:' + g.querySelector('[data-set]').dataset.set));
  $('setBtn').onclick = () => { renderSettings(); openSheet('setSheet'); slideSegs(); };
  const ago = t => { const m = Math.round((Date.now() - t) / MIN); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };

  // ---------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------
  const sab = document.createElement('div'); sab.style.cssText = 'position:fixed;bottom:0;left:0;width:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden'; document.body.appendChild(sab);
  document.documentElement.style.setProperty('--sab', sab.offsetHeight + 'px');
  loadCache();
  rebuild();
  render();
  ping().then(() => { render(); refresh({ loud: st.items.size === 0, force: true }); });
  loadLayers(false).then(() => loadMail(false)); loadDrinks(false); loadWeather(false);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { refresh(); loadLayers(false).then(() => loadMail(false)); loadDrinks(false); loadWeather(false); if (st.view === 'day' || st.view === 'week') placeNow(); } });
  setInterval(() => { if (document.visibilityState !== 'visible') return; if (Date.now() - st.lastRefresh > REFRESH_MS) refresh(); if (st.view === 'day' || st.view === 'week') placeNow(); }, MIN);
  window.addEventListener('resize', () => { const tv = $('timeview'); if (tv) afterRender(); });
  // "Updated" pill, once, when a new version arrives (as in Notes and Travel).
  (function () {
    const src = [...document.querySelectorAll('style')].map(e => e.textContent).join('') + String(document.scripts.length);
    let h = 2166136261;
    for (let i = 0; i < src.length; i++) { h ^= src.charCodeAt(i); h = Math.imul(h, 16777619); }
    const ver = (h >>> 0).toString(36) + (window.CALENDAR_BUILD || ''), VK = K.version;
    const prev = ls.get(VK, null);
    ls.set(VK, ver);
    if (!prev || prev === ver) return;
    const pill = $('updPill'); pill.hidden = false;
    setTimeout(() => { pill.classList.add('out'); setTimeout(() => { pill.hidden = true; pill.classList.remove('out'); }, 450); }, 5000);
  })();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // For the tests (calendar/scripts/app-test.mjs) only.
  window.__calendar = { st, settings, render, refresh, rebuild, goTo, setView, openEvent, openEditor, eventsOn, usHolidays, saveEvent, deleteEvent, formFrom };
})();
