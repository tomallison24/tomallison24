'use strict';

// Ipsy's tools in Home, for Ipsy in aOS (Home has no chat of its own). Claude asks for them by name
// through functions/aOS/api/ipsy.js (server/ipsy-house.js describes them to it); aOS opens Home out of
// sight and runs them here, on this phone's own Home Assistant connection (HA, with the token kept on
// the phone: nothing about it goes to Claude). Offered to aOS as AllisonOS.ipsyTools, last of Home's
// scripts, so it reads the app's own device lists and states by name (THERMOS, L_ALL, PLAYERS, ents…).
//
// Only the devices on Home's own cards, in three groups, by what they are (never by what Claude says):
//   Just do it, with Undo: lights, thermostats, air purifiers, dehumidifiers, speakers and the TVs, vacuums
//   Ask first (Yes / No in the chat): heaters, the blinds, an automation on or off
//   Never: the alarm, cameras and the doorbell, locks. Ipsy can say how they are, never change them;
//          open_home opens Home for the person to do it.
// Nothing works in Home's preview (no Home Assistant on this phone yet): Ipsy says so.
(() => {
  const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);
  const fail = msg => { throw new Error(msg); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const E = id => ents[id] || null;                 // ents is replaced on every update: read it each time
  const A = id => (E(id) && E(id).attributes) || {};
  const S = id => (E(id) ? E(id).state : 'missing');
  const offline = id => ['missing', 'unavailable'].includes(S(id));
  const int = v => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
  const call = (domain, service, data) => HA.send({ type: 'call_service', domain, service, service_data: data });
  const GROUP = { do: 'yes, with Undo', ask: 'asks the person first', never: 'no: open Home to do it' };

  // ---- every device on Home's cards: { id (its entity), name, kind, group, room?, ...its own } ----
  function devices() {
    const out = [];
    for (const l of Object.values(L_ALL)) out.push({ id: l.id, name: l.name, kind: 'light', group: 'do', room: (L_ROOMS.find(r => r.id === l.room) || {}).name, dim: l.kind !== 'onoff' });
    for (const t of THERMOS) out.push({ id: t.ent, name: t.name, kind: 'thermostat', group: 'do', t });
    for (const d of DYSONS) out.push({ id: d.fan, name: d.name, kind: 'air purifier', group: 'do', d });
    for (const u of UNITS) out.push({ id: u.hum, name: u.name + ' Dehumidifier', kind: 'dehumidifier', group: 'do', u });
    for (const p of PLAYERS) out.push({ id: p.ent, name: p.name, kind: p.kind === 'atv' || p.kind === 'tv' ? 'tv' : 'speaker', group: 'do' });
    for (const v of VACS) out.push({ id: v.ent, name: v.name, kind: 'vacuum', group: 'do', v });
    for (const h of HEATERS) out.push({ id: h.ent, name: h.name, kind: 'heater', group: 'ask', h });
    for (const b of BLINDS) out.push({ id: b.helper, name: b.id === 'all' ? b.name : b.name + ' Office Blind', kind: 'blind', group: 'ask', b });
    out.push({ id: BLINK, name: 'Blink alarm', kind: 'alarm', group: 'never' });
    for (const c of BLINKS) out.push({ id: c.cam, name: c.name + ' camera', kind: 'camera', group: 'never', c });
    out.push({ id: DOORBELL.cam, name: DOORBELL.name + ' doorbell', kind: 'camera', group: 'never' });
    out.push({ id: DEPART, name: 'Blinds departure lock', kind: 'lock', group: 'never' });
    return out;
  }
  const automations = () => (mode === 'live' ? Object.keys(ents).filter(id => id.startsWith('automation.')) : [])
    .map(id => ({ id, name: clip(A(id).friendly_name || id.slice(11).replace(/_/g, ' '), 80), kind: 'automation', group: 'ask' }));
  const find = id => devices().find(d => d.id === id) || automations().find(d => d.id === id) || null;
  // Home Assistant, live on this phone: waits for Home to start and connect (aOS may have just opened it)
  async function live() {
    for (let i = 0; i < 40 && !ready; i++) await sleep(250);
    if (mode !== 'live') fail('Home isn\'t connected to Home Assistant on this phone (it shows its preview), so Ipsy can\'t see or change the house. They can connect it in Home\'s Settings.');
    for (let i = 0; i < 100 && !(HA.status === 'live' && Object.keys(ents).length); i++) await sleep(200);
    if (!(HA.status === 'live' && Object.keys(ents).length)) fail('Home couldn\'t reach Home Assistant just now. Try again in a minute.');
  }

  // ---- how a device is, in a line of facts ----
  const pct255 = b => (typeof b === 'number' ? Math.max(1, Math.round(b / 2.55)) : null);
  function stateOf(x) {
    const id = x.id, a = A(id);
    if (offline(id)) return { state: 'offline' };
    switch (x.kind) {
      case 'light': return { state: S(id), ...(S(id) === 'on' && x.dim ? { brightness: pct255(a.brightness) } : {}) };
      case 'thermostat': return { mode: S(id), modes: x.t.modes.map(([m, l]) => m + ' (' + l + ')'), now: int(a.current_temperature), ...(a.temperature != null ? { target: a.temperature } : {}),
        ...(a.target_temp_low != null ? { heat_to: a.target_temp_low, cool_to: a.target_temp_high } : {}), ...(a.hvac_action ? { doing: a.hvac_action } : {}), ...(a.preset_mode && a.preset_mode !== 'none' ? { preset: a.preset_mode } : {}),
        ...(x.t.fans ? { fan: a.fan_mode } : {}), ...(E(AWAY_FLAG) && S(AWAY_FLAG) === 'on' && x.t.kind === 'nest' ? { away: 'the house is on Away (Eco): Home Assistant holds the Eco setpoints until someone is home' } : {}) };
      case 'air purifier': return { state: S(id), ...(S(id) === 'on' ? { speed: a.percentage ? Math.round(a.percentage / 10) : null, control: a.preset_mode === 'Auto' ? 'auto' : 'manual' } : {}),
        ...(x.d.temp && E(x.d.temp) ? { room_temperature: int(+S(x.d.temp)) } : {}) };
      case 'dehumidifier': return { state: S(id), target_humidity: a.humidity != null ? a.humidity + '%' : null, mode: a.mode || null, modes: x.u.modes,
        ...(x.u.rh && E(x.u.rh) ? { room_humidity: S(x.u.rh) + '%' } : {}), ...(x.u.tank && S(x.u.tank) === 'on' ? { tank: 'full: empty it' } : {}) };
      case 'speaker': case 'tv': return { state: S(id), ...(a.volume_level != null ? { volume: Math.round(a.volume_level * 100) } : {}), ...(a.is_volume_muted ? { muted: true } : {}),
        ...(a.media_title ? { playing: clip([a.media_artist, a.media_title].filter(Boolean).join(' - '), 120) } : {}), ...(a.source ? { source: clip(a.source, 60) } : {}) };
      case 'vacuum': return { state: S(id), ...(x.v.battery && E(x.v.battery) ? { battery: S(x.v.battery) + '%' } : {}) };
      case 'heater': return { state: S(id) === 'off' ? 'off' : 'on', ...(a.temperature != null ? { target: a.temperature } : {}), ...(a.current_temperature != null ? { now: int(a.current_temperature) } : {}) };
      case 'blind': { const c = A(x.b.cover); return { open: c.current_position != null ? c.current_position + '%' : S(x.b.cover), ...(S(DEPART) === 'locked' ? { note: 'departure mode is on, so the blinds won\'t move' } : {}) }; }
      case 'automation': return { state: S(id), ...(a.last_triggered ? { last_ran: a.last_triggered } : {}) };
      case 'alarm': return { state: S(id) };
      case 'camera': return { ...(x.c && E(x.c.sw) ? { motion_detection: S(x.c.sw) } : { state: S(id) }) };
      case 'lock': return { state: S(id) };
    }
    return { state: S(id) };
  }
  const brief = x => ({ id: x.id, name: x.name, kind: x.kind, ...(x.room ? { room: x.room } : {}), ...stateOf(x), ipsy_can_change: GROUP[x.group] });

  // ---- a change and its Undo: the device as it was, put back the same way ----
  async function lightTo(id, on, bri) { return on ? call('light', 'turn_on', { entity_id: id, ...(bri ? { brightness_pct: bri } : {}) }) : call('light', 'turn_off', { entity_id: id }); }
  function undoOf(x) {
    const id = x.id, was = S(id), a = { ...A(id) };
    switch (x.kind) {
      case 'light': return () => lightTo(id, was === 'on', x.dim ? pct255(a.brightness) : null);
      case 'thermostat': return async () => { await call('climate', 'set_hvac_mode', { entity_id: id, hvac_mode: was });
        if (a.target_temp_low != null && was === 'heat_cool') await call('climate', 'set_temperature', { entity_id: id, target_temp_low: a.target_temp_low, target_temp_high: a.target_temp_high });
        else if (a.temperature != null && was !== 'off') await call('climate', 'set_temperature', { entity_id: id, temperature: a.temperature }); };
      case 'air purifier': return async () => { if (was !== 'on') return call('fan', 'turn_off', { entity_id: id });
        await call('fan', 'turn_on', { entity_id: id }); if (a.preset_mode === 'Auto') await call('fan', 'set_preset_mode', { entity_id: id, preset_mode: 'Auto' }); else if (a.percentage) await call('fan', 'set_percentage', { entity_id: id, percentage: a.percentage }); };
      case 'dehumidifier': return async () => { await call('humidifier', was === 'on' ? 'turn_on' : 'turn_off', { entity_id: id });
        if (was === 'on' && a.humidity != null) await call('humidifier', 'set_humidity', { entity_id: id, humidity: a.humidity }); };
      case 'speaker': case 'tv': return async () => {
        if (was === 'off') return call('media_player', 'turn_off', { entity_id: id });
        if (a.volume_level != null) await call('media_player', 'volume_set', { entity_id: id, volume_level: a.volume_level });
        if (a.is_volume_muted != null) await call('media_player', 'volume_mute', { entity_id: id, is_volume_muted: a.is_volume_muted });
        if (was === 'playing' && S(id) !== 'playing') await call('media_player', 'media_play', { entity_id: id });
        if (was === 'paused' && S(id) === 'playing') await call('media_player', 'media_pause', { entity_id: id }); };
      case 'heater': return async () => { await call('climate', 'set_hvac_mode', { entity_id: id, hvac_mode: was === 'off' ? 'off' : 'heat' });
        if (a.temperature != null && was !== 'off') await call('climate', 'set_temperature', { entity_id: id, temperature: a.temperature }); };
      case 'blind': { const v = +S(id); return Number.isFinite(v) ? () => call('input_number', 'set_value', { entity_id: id, value: v }) : null; }
      case 'automation': return () => call('automation', was === 'off' ? 'turn_off' : 'turn_on', { entity_id: id });
    }
    return null;   // a vacuum: started is undone by sending it home, which is its own action
  }

  const between = (v, lo, hi, what) => { const n = Number(v); if (!Number.isFinite(n) || n < lo || n > hi) fail(what + ' is ' + lo + ' to ' + hi + '.'); return n; };
  // what each kind can do: action -> [what it says, the call, then the question (the ask-first kinds) or,
  // for a vacuum's start, its own Undo (sent home)], or a function giving that, for one with a value
  const ACTIONS = {
    light: (x, q) => ({
      on: ['Turned on ' + x.name, () => lightTo(x.id, true)], off: ['Turned off ' + x.name, () => lightTo(x.id, false)],
      brightness: () => { if (!x.dim) fail(x.name + ' only turns on and off.'); const v = Math.round(between(q.value, 1, 100, 'Brightness')); return [x.name + ' to ' + v + '%', () => lightTo(x.id, true, v)]; } }),
    thermostat: (x, q) => {
      const t = x.t, a = A(x.id), on = S(x.id) !== 'off';
      const lo = typeof a.min_temp === 'number' ? a.min_temp : T_LO, hi = typeof a.max_temp === 'number' ? a.max_temp : T_HI;
      const modeOf = v => { const w = String(v || '').toLowerCase(), m = t.modes.find(([k, l]) => k === w || l.toLowerCase() === w); if (!m) fail(t.name + '\'s modes are ' + t.modes.map(([k, l]) => l).join(', ') + '.'); return m; };
      let last = null; try { last = localStorage.getItem('house.tlast.' + t.id); } catch {}
      const back = t.modes.find(([k]) => k === last) || t.modes[0];
      return {
        on: ['Turned on ' + t.name + ' (' + back[1] + ')', () => call('climate', 'set_hvac_mode', { entity_id: x.id, hvac_mode: back[0] })],
        off: ['Turned off ' + t.name, () => call('climate', 'set_hvac_mode', { entity_id: x.id, hvac_mode: 'off' })],
        mode: () => { const m = modeOf(q.value); return [t.name + ' to ' + m[1], () => call('climate', 'set_hvac_mode', { entity_id: x.id, hvac_mode: m[0] })]; },
        temperature: () => {
          if (!on) fail(t.name + ' is off: turn it on (or pick a mode) first.');
          if (a.preset_mode === 'eco') fail(t.name + ' is on Eco, which holds its own setpoints: a new temperature would be ignored. Say so; they can turn Eco off in Home.');
          if (S(x.id) === 'heat_cool') {
            const l = Math.round(between(q.low, lo, hi, 'The heat-to temperature')), h = Math.round(between(q.high, lo, hi, 'The cool-to temperature'));
            if (h - l < T_GAP) fail('In Auto, cool-to must be at least ' + T_GAP + '° above heat-to.');
            return [t.name + ' to ' + l + '–' + h + '°', () => call('climate', 'set_temperature', { entity_id: x.id, target_temp_low: l, target_temp_high: h })];
          }
          const v = Math.round(between(q.value, lo, hi, 'The temperature'));
          return [t.name + ' to ' + v + '°', () => call('climate', 'set_temperature', { entity_id: x.id, temperature: v })];
        } };
    },
    'air purifier': (x, q) => ({
      on: ['Turned on ' + x.name, () => call('fan', 'turn_on', { entity_id: x.id })], off: ['Turned off ' + x.name, () => call('fan', 'turn_off', { entity_id: x.id })],
      auto: [x.name + ' on Auto', () => call('fan', 'set_preset_mode', { entity_id: x.id, preset_mode: 'Auto' })],
      speed: () => { const v = Math.round(between(q.value, 1, 10, 'Speed')); return [x.name + ' to speed ' + v, () => call('fan', 'set_percentage', { entity_id: x.id, percentage: v * 10 })]; } }),
    dehumidifier: (x, q) => ({
      on: ['Turned on the ' + x.name, () => call('humidifier', 'turn_on', { entity_id: x.id })], off: ['Turned off the ' + x.name, () => call('humidifier', 'turn_off', { entity_id: x.id })],
      humidity: () => { const v = Math.round(between(q.value, T_MIN, T_MAX, 'Target humidity') / T_STEP) * T_STEP; return ['The ' + x.name + ' to ' + v + '%', () => call('humidifier', 'set_humidity', { entity_id: x.id, humidity: v })]; },
      mode: () => { const m = x.u.modes.find(k => k.toLowerCase() === String(q.value || '').toLowerCase()); if (!m) fail('Its modes are ' + x.u.modes.join(', ') + '.'); return ['The ' + x.name + ' to ' + m, () => call('humidifier', 'set_mode', { entity_id: x.id, mode: m })]; } }),
    speaker: (x, q) => {
      const mp = s => () => call('media_player', s, { entity_id: x.id });
      return {
        play: ['Playing on ' + x.name, mp('media_play')], pause: ['Paused ' + x.name, mp('media_pause')], next: ['Next on ' + x.name, mp('media_next_track')], previous: ['Back on ' + x.name, mp('media_previous_track')],
        on: ['Turned on ' + x.name, mp('turn_on')], off: ['Turned off ' + x.name, mp('turn_off')],
        mute: ['Muted ' + x.name, () => call('media_player', 'volume_mute', { entity_id: x.id, is_volume_muted: true })], unmute: ['Unmuted ' + x.name, () => call('media_player', 'volume_mute', { entity_id: x.id, is_volume_muted: false })],
        volume: () => { const v = Math.round(between(q.value, 0, 100, 'Volume')); return [x.name + ' volume to ' + v, () => call('media_player', 'volume_set', { entity_id: x.id, volume_level: v / 100 })]; } };
    },
    vacuum: x => {
      const cleaning = S(x.id) === 'cleaning';   // its start and pause are one script that toggles: sent only when it does what was asked
      return {
        start: () => { if (cleaning) fail(x.name + ' is already cleaning.'); return ['Started ' + x.name, () => call('script', 'turn_on', { entity_id: x.v.toggle }), () => call('vacuum', 'return_to_base', { entity_id: x.id })]; },
        pause: () => { if (!cleaning) fail(x.name + ' isn\'t cleaning.'); return ['Paused ' + x.name, () => call('script', 'turn_on', { entity_id: x.v.toggle })]; },
        dock: ['Sent ' + x.name + ' home', () => call('vacuum', 'return_to_base', { entity_id: x.id })] };
    },
    heater: (x, q) => ({
      on: ['Turned on the ' + x.name, () => call('climate', 'set_hvac_mode', { entity_id: x.id, hvac_mode: 'heat' }), 'Turn on the ' + x.name + '?'],
      off: ['Turned off the ' + x.name, () => call('climate', 'set_hvac_mode', { entity_id: x.id, hvac_mode: 'off' }), 'Turn off the ' + x.name + '?'],
      temperature: () => { const v = Math.round(between(q.value, 50, 86, 'The heater\'s temperature')); return ['The ' + x.name + ' to ' + v + '°', () => call('climate', 'set_temperature', { entity_id: x.id, temperature: v }), 'Set the ' + x.name + ' to ' + v + '°?']; } }),
    blind: (x, q) => ({
      position: () => {
        if (S(DEPART) === 'locked') fail('Departure mode is on, so the blinds won\'t move. It\'s turned off at the Velux gateway.');
        const v = Math.round(between(q.value, 0, 100, 'How open') / 25) * 25;
        return [x.name + ' to ' + v + '% open', () => call('input_number', 'set_value', { entity_id: x.id, value: v }), (v ? 'Open the ' + x.name + ' to ' + v + '%' : 'Close the ' + x.name) + '?'];
      } }),
    automation: x => ({
      on: ['Turned on the automation ' + x.name, () => call('automation', 'turn_on', { entity_id: x.id }), 'Turn on the automation “' + x.name + '”?'],
      off: ['Turned off the automation ' + x.name, () => call('automation', 'turn_off', { entity_id: x.id }), 'Turn off the automation “' + x.name + '”? It won\'t run until it\'s turned back on.'] }),
  };
  ACTIONS.tv = ACTIONS.speaker;

  const tools = {
    async list_devices(q) {
      await live();
      const kind = clip(q.kind, 30).toLowerCase(), room = clip(q.room, 40).toLowerCase();
      if (kind === 'automation') return { content: { automations: automations().map(brief), note: 'Turning one on or off asks the person first.' } };
      const list = devices().filter(x => (!kind || x.kind === kind) && (!room || (x.room || x.name).toLowerCase().includes(room)));
      return { content: { devices: list.map(brief), ...(kind ? {} : { automations: automations().length + ' (list_devices with kind "automation")' }) } };
    },
    async control(q) {
      await live();
      const x = find(clip(q.id, 120));
      if (!x) fail('No device with that id on Home\'s cards. list_devices shows them.');
      if (x.group === 'never') fail('Ipsy never changes the alarm, cameras, the doorbell or locks. Say so; open_home opens Home for them to do it themselves.');
      if (offline(x.id)) fail(x.name + ' is offline in Home Assistant right now.');
      const all = ACTIONS[x.kind](x, q), act = clip(q.action, 20).toLowerCase(), a = all[act];
      if (!a) fail(x.name + ' (' + x.kind + ') can do: ' + Object.keys(all).join(', ') + '.');
      const [said, send, ask, alsoUndo] = typeof a === 'function' ? a() : a;
      const askText = x.group === 'ask' ? (typeof ask === 'string' ? ask : said + '?') : null;
      if (askText && !(q && (await q.__confirm(askText)))) return { content: { changed: false, note: 'They said no, so nothing changed.' } };
      const undo = x.kind === 'vacuum' ? (typeof ask === 'function' ? ask : null) : undoOf(x);
      try { await send(); } catch (e) { fail(x.name + ': ' + (e && e.message ? e.message : 'Home Assistant said no.')); }
      return { content: { changed: true, did: said, note: 'Home Assistant has it; the device can take a few seconds to follow.' }, change: { text: said, ...(undo ? { undo: () => undo() } : {}) } };
    },
    // Home, on screen: for anything Ipsy may not change (the alarm, cameras, locks), or to look
    async open_home() {
      try { if (window.top !== window && window.top.aosHomeTab) window.top.aosHomeTab.show('house'); } catch {}
      return { content: { shown: true, note: 'Home is open behind the chat; closing the chat shows it.' } };
    },
  };
  // the chat's Yes / No (from aOS's chat, ctx.confirm), handed to control as q.__confirm
  const withAsk = fn => (input, ctx) => fn({ ...(input || {}), __confirm: text => (ctx && ctx.confirm ? ctx.confirm(text, { yes: 'Yes, do it', no: 'No' }) : Promise.resolve(false)) }, ctx);
  tools.control = withAsk(tools.control);

  const LABELS = {
    list_devices: i => (i.kind === 'automation' ? 'Looking at the automations' : 'Looking around the house'),
    control: i => { const x = find(i.id); return x ? 'Changing ' + x.name : 'Changing something in the house'; },
    open_home: () => 'Opening Home',
  };
  (window.AllisonOS = window.AllisonOS || {}).ipsyTools = { app: 'house', name: 'Home', tools, label: (name, input) => (LABELS[name] ? LABELS[name](input || {}) : '') };
})();
