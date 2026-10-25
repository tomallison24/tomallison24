// Settings that follow you between your devices: set up Weather's places on your iPhone and your iPad
// has them too. Everything else an app keeps stays on the device it was made on (shared things, like
// notes and trips, come from the family's account or Sheet already).
//
//   Weather: your places and units          Clock: world clocks, alarms, Bedtime, its settings, recent timers
//   Calendar: its settings (week start, clock, alerts, what it shows)
//   Mail: which Google account, and that Gmail is connected - never the sign-in itself: on a new device
//         Mail signs in to that account by itself as it opens (silently when Google knows the device,
//         else with one tap), and that one sign-in covers Travel and Orders, as everywhere
//   every app's design (Vintage, Sea glass)  aOS: its look, light or dark, Favorites, your helper (Ipsy) and its name
//
// Never a sign-in, a token (Gmail's included), Home Assistant's address, a cache, where you are now (Weather's GPS fix)
// or what's running (Clock's stopwatch and timers, an alarm's next ring: each device works its own out).
// The server keeps only these (functions/aOS/api, PREF_ITEM), each with when it last changed, per person.
//
// aOS runs it (aOS/home-tab.js: opening, coming back to aOS, back on Home from an app), and every app
// inside aOS shares aOS's storage, so one sync covers them all. How a device tells its own changes from
// another device's: aos.prefs.seen keeps each setting as it was at the last sync. Changed here since:
// it goes up (it wins: it's the device in your hand). Unchanged here, newer there: it comes down. A
// device that never synced (a new iPad) takes what's there, rather than sending its empty settings up;
// and a setting still as the app first had it (no places, Clock's own settings) never goes up from one,
// whichever device opens first: it doesn't count as set up.
'use strict';
(() => {
  const SEEN = 'aos.prefs.seen';
  const raw = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const drop = (o, keys) => { if (!o || typeof o !== 'object') return o; const c = { ...o }; for (const k of keys) delete c[k]; return c; };
  // what to sync: a whole key, or one field of a key's JSON (out: what of it travels; the rest stays here)
  const CLOCK = 'allison-clock-v1';
  const json = v => { try { return JSON.parse(v); } catch { return undefined; } };
  const ITEMS = [
    { id: 'wx.places', key: 'wx.places', app: 'weather' },
    { id: 'wx.units', key: 'wx.units', app: 'weather', blank: v => v === 'us' || v === '"us"' },
    { id: CLOCK + '#cities', key: CLOCK, field: 'cities', app: 'clock' },
    { id: CLOCK + '#alarms', key: CLOCK, field: 'alarms', app: 'clock', out: a => Array.isArray(a) ? a.map(x => drop(x, ['next', 'snoozeAt'])) : a },
    { id: CLOCK + '#sleep', key: CLOCK, field: 'sleep', app: 'clock', out: s => drop(s, ['next', 'bedNext', 'skip', 'snoozeAt']), blank: v => !(json(v) || {}).set },
    { id: CLOCK + '#set', key: CLOCK, field: 'set', app: 'clock', blank: v => { const s = json(v) || {}; return !s.h24 && !s.h24Picked && !s.secs && !s.analog && (!s.design || s.design === 'vintage') && !s.home; } },
    { id: CLOCK + '#tsound', key: CLOCK, field: 'tsound', app: 'clock', blank: v => v === '"twinbell"' },
    { id: CLOCK + '#recents', key: CLOCK, field: 'recents', app: 'clock' },
    { id: 'allison-calendar-v1-settings', key: 'allison-calendar-v1-settings', app: 'calendar' },
    // quiet: Mail reads these as it opens, so an open Mail isn't started again for them (it would go to Google)
    { id: 'mail.hint', key: 'mail.hint', app: 'mail', quiet: true },
    { id: 'mail.token.ever', key: 'mail.token.ever', app: 'mail', quiet: true },
    { id: 'aos.look', key: 'aos.look', app: 'aos' },
    { id: 'aos.lang', key: 'aos.lang', app: 'aos', blank: v => v === 'en' },
    { id: 'aos.home.picks', key: 'aos.home.picks', app: 'aos' },
    { id: 'aos.helper', key: 'aos.helper', app: 'aos' },   // your helper and its name (home/ipsy.js)
    { id: 'home.settings#theme', key: 'home.settings', field: 'theme', app: 'aos', blank: v => v === '"auto"' },
  ];
  // as the app first had it: nothing set up yet
  const blank = (it, v) => v == null || ['[]', '{}', '""', 'null'].includes(v) || !!(it.blank && it.blank(v));
  const items = apps => [...ITEMS, ...apps.map(id => ({ id: 'design.' + id, key: 'design.' + id, app: id }))];

  // a setting as text (null: none here), the same on every device for the same setting
  function read(it) {
    if (!it.field) return raw(it.key);
    let o; try { o = JSON.parse(raw(it.key)); } catch { return null; }
    if (!o || typeof o !== 'object' || Array.isArray(o) || !(it.field in o)) return null;
    return JSON.stringify(it.out ? it.out(o[it.field]) : o[it.field]);
  }
  function write(it, v) {
    try {
      if (!it.field) { if (v == null) localStorage.removeItem(it.key); else localStorage.setItem(it.key, v); return; }
      let o; try { o = JSON.parse(raw(it.key)); } catch {}
      if (!o || typeof o !== 'object' || Array.isArray(o)) o = {};
      if (v == null) delete o[it.field]; else o[it.field] = JSON.parse(v);
      localStorage.setItem(it.key, JSON.stringify(o));
    } catch {}
  }

  // o: { apps: [ids], account, wait: app => true while it's on screen (its settings come down later),
  //      ready: [apps] => a promise, once those apps can take their settings (open out of sight, they
  //      close first: an app can save what it has as it closes), applied: [apps whose settings came] => … }
  let running = null;
  function sync(o) { return running || (running = run(o).finally(() => { running = null; })); }
  async function run({ apps = [], account, wait = () => false, ready = async () => {}, applied = () => {} }) {
    if (!account || !account.token()) return false;
    let seen; try { seen = JSON.parse(raw(SEEN)) || {}; } catch { seen = {}; }
    const { prefs = {} } = await account.call('prefs');
    const up = {}, down = [], now = Date.now();
    for (const it of items(apps)) {
      const here = read(it), there = prefs[it.id], was = seen[it.id];
      if (!was) {   // never synced on this device: what's there wins (unless only this one is set up); else what's here goes up
        if (there && there.v === here) seen[it.id] = { h: here, at: there.at };
        else if (there && !(blank(it, there.v) && !blank(it, here))) down.push([it, there]);
        else if (!blank(it, here)) up[it.id] = { v: here, at: now };
      } else if (here !== was.h) up[it.id] = { v: here, at: now };   // changed here since the last sync
      else if (there && there.at > was.at && there.v !== here) down.push([it, there]);
      else if (there && there.at > was.at) seen[it.id] = { h: here, at: there.at };
    }
    // what's sent up first: the server may hold a newer one still, from another device, which comes down too
    if (Object.keys(up).length) {
      const r = await account.call('prefs', { set: up }), all = items(apps);
      for (const id of Object.keys(up)) {
        const kept = r.prefs && r.prefs[id]; if (!kept) continue;
        if (kept.v === up[id].v) seen[id] = { h: up[id].v, at: kept.at };
        else down.push([all.find(i => i.id === id), kept]);
      }
    }
    const take = down.filter(([it]) => it.quiet || !wait(it.app)), came = new Set(take.filter(([it]) => !it.quiet).map(([it]) => it.app));   // the app on screen: next time
    if (take.length) await ready([...came]);
    for (const [it, there] of take) { write(it, there.v); seen[it.id] = { h: read(it), at: there.at }; }
    try { localStorage.setItem(SEEN, JSON.stringify(seen)); } catch {}
    if (came.size) applied([...came]);
    return came.size > 0 || Object.keys(up).length > 0;
  }
  window.aosPrefs = { sync, items: () => ITEMS.map(i => i.id) };
})();
