// AROUND THE HOUSE: the Signal dashboard's All Devices view (ha-config,
// views_signal/all_devices.yaml) without the dehumidifiers - vacuums, the
// office blinds, Olivia's Hatch, the printer - and the energy tiles from every
// view, in this app's layout.
'use strict';

// ---------------------------------------------------------------------------
// VACUUMS: the SG2 Shark card (sg_*) - a 270-degree battery arc, the moods
// and skies - and the Ecovacs ("John"). The Shark's suction is deliberately
// crossed, as on the dashboard: its 'eco' runs HARDER than 'normal' (checked
// on the machine), so Eco sends 'normal' and Normal sends 'eco'. Start / Pause
// is script.toggle_*_clean (the Shark has no turn on / off). Which room
// button is which room is not known; they are named as the Shark names them.
// The Ecovacs integration is not signing in at the moment, so its entities
// are all unavailable; its stop and dock are by convention, untested.
const VACS = [
  { id: 'shark', name: 'Shark', ent: 'vacuum.shark', battery: 'sensor.shark_battery', wifi: 'sensor.shark_wifi_signal', err: 'sensor.shark_error_status',
    charging: 'binary_sensor.shark_charging', error: 'binary_sensor.shark_error', mode: 'select.shark_clean_mode', toggle: 'script.toggle_shark_clean', locate: true,
    rooms: [['button.shark_clean_room', 'Room'], ['button.shark_clean_room_1', 'Room 1'], ['button.shark_clean_room_2', 'Room 2']] },
  { id: 'john', name: 'Ecovacs', ent: 'vacuum.john', battery: 'sensor.john_battery', wifi: 'sensor.john_wi_fi_rssi', err: 'sensor.john_error', toggle: 'script.toggle_ecovacs_clean',
    relocate: 'button.john_relocate', selects: [['select.john_water_flow_level', 'WATER FLOW'], ['select.john_active_map', 'MAP']],
    switches: [['switch.john_advanced_mode', 'Advanced mode'], ['switch.john_carpet_auto_boost_suction', 'Carpet boost'], ['switch.john_clean_preference', 'Clean preference'], ['switch.john_continuous_cleaning', 'Continuous cleaning'], ['switch.john_true_detect', 'TrueDetect']],
    mop: 'binary_sensor.john_mop_attached', map: 'image.john_map', life: [['filter', 'Filter'], ['main_brush', 'Main brush'], ['side_brush', 'Side brush'], ['unit_care', 'Unit care']] },
];
const V_SKY = { cleaning: grad('#221F2C', '#36324A', '#5A5470'), returning: grad('#201E2A', '#312E42', '#4E4963'), paused: grad('#1C1C22', '#2A2A33', '#42424E'),
  charging: grad('#1A2224', '#293938', '#48625D'), error: grad('#241D20', '#3C2C31', '#614A50'), docked: grad('#1A1B20', '#26272F', '#3B3D47'), off: grad('#121316', '#202227', '#34373F') };
const V_ACC = { cleaning: '207,195,242', returning: '189,178,230', paused: '169,166,191', charging: '168,224,204', error: '240,179,187', docked: '195,198,214', off: '154,160,166' };
const V_WORD = { cleaning: 'Cleaning', returning: 'Heading home', paused: 'Paused', charging: 'Charging', error: 'Needs attention', docked: 'Docked', off: 'Offline' };

family({
  id: 'vac', name: 'Vacuums', icon: 'vacuum', group: 'Around the house', order: 1,
  read(v) {
    const d = dv('vac', v.id, v.name), s = st(v.ent), A = s ? s.attributes : {}, offline = gone(v.ent);
    const state = offline ? 'unavailable' : held(d, 'state', s.state);
    const mood = offline ? 'off' : state === 'error' || isOn(v.error) ? 'error' : ['cleaning', 'returning', 'paused'].includes(state) ? state : isOn(v.charging) ? 'charging' : 'docked';
    return { d, A, state, mood, offline, bat: num(v.battery), fan: held(d, 'fan', A.fan_speed), cmode: v.mode ? held(d, 'cmode', val(v.mode)) : null };
  },
  arc(v, r, size) {
    const a = V_ACC[r.mood], R = 80, C = 100, pct = isNaN(r.bat) ? 0 : Math.max(0, Math.min(100, r.bat));
    const pt = deg => { const t = deg * Math.PI / 180; return (C + R * Math.cos(t)).toFixed(2) + ' ' + (C + R * Math.sin(t)).toFixed(2); };
    const arc = (d1, d2) => `M ${pt(d1)} A ${R} ${R} 0 ${d2 - d1 > 180 ? 1 : 0} 1 ${pt(d2)}`;
    const end = 135 + 270 * pct / 100, w = size === 'lg' ? 7 : 11;
    return `<div class="varc ${size}" style="--a:${a}"><svg viewBox="0 0 200 200" aria-hidden="true"><path d="${arc(135, 405)}" stroke="rgba(255,255,255,0.16)" stroke-width="${w}" stroke-linecap="round" fill="none"/>
      ${pct ? `<path d="${arc(135, Math.max(136, end))}" stroke="rgb(${a})" stroke-width="${w}" stroke-linecap="round" fill="none"${r.mood === 'charging' ? ' class="t-flow" stroke-dasharray="6 6"' : ''}/>` : ''}</svg>
      <div class="num"><em>BATTERY</em><b>${isNaN(r.bat) ? '--' : Math.round(r.bat)}<span>%</span></b></div>${size === 'lg' ? `<i class="vbot">${svg('vacuum', 26)}</i>` : ''}</div>`;
  },
  sub(v, r) {
    if (r.offline) return v.id === 'john' ? 'Its integration is not signing in' : 'Not reachable';
    if (r.mood === 'error') return esc(val(v.err) && val(v.err) !== 'unknown' ? val(v.err) : 'Check the vacuum');
    const suction = v.id === 'shark' ? { normal: 'Eco', eco: 'Normal', max: 'Max' }[r.fan] : r.fan;
    const wifi = num(v.wifi);
    return [suction ? esc(suction) + ' suction' : '', r.cmode ? esc(r.cmode) : '', isNaN(wifi) ? '' : 'Wi-Fi ' + Math.round(wifi) + ' dBm'].filter(Boolean).join(' · ');
  },
  mount(el) {
    el.innerHTML = VACS.map(v => cardHTML('vac:' + v.id, `
      <div class="dg-top"><div data-r="hero"></div><div class="dg-info" data-r="info"></div></div>
      <div class="dg-ctl" data-r="ctl"></div>`)).join('');
  },
  render() {
    let busy = 0;
    for (const v of VACS) {
      const card = this.el.querySelector(`[data-dv="vac:${v.id}"]`), r = this.read(v), R = k => card.querySelector(`[data-r="${k}"]`), a = V_ACC[r.mood];
      if (r.mood === 'cleaning' || r.mood === 'returning') busy++;
      put(R('fx'), skyHTML(V_SKY[r.mood], a, r.mood === 'cleaning' ? { air: 5, pool: 'drift' } : r.mood === 'charging' ? { pool: 'breathe', poolA: 0.12 } : r.mood === 'error' ? { pool: 'pulse', poolA: 0.2 } : {}));
      put(R('hero'), this.arc(v, r, 'sm'));
      put(R('info'), infoHTML2(v.name, r.offline ? offWord(v.ent) : V_WORD[r.mood], this.sub(v, r)));
      const go = r.mood === 'cleaning';
      put(R('ctl'), pwrBtn(go, a, go ? 'Pause' : r.mood === 'paused' ? 'Resume' : 'Start', { a: 'go', icon: go ? 'pause' : 'play', dis: r.offline, wait: tWaiting(r.d, 'state') })
        + `<button class="ghost" data-a="dock"${r.offline || ['docked', 'charging', 'returning'].includes(r.mood) ? ' disabled' : ''}>${svg('dock', 18)}Dock</button>`);
      card.classList.toggle('offline', r.offline);
      shadow(card, a);
    }
    this.sum = busy ? busy + ' busy' : VACS.some(v => this.read(v).mood === 'error') ? 'Needs attention' : 'Docked';
  },
  sheet(id) {
    const v = VACS.find(x => x.id === id), r = this.read(v), a = V_ACC[r.mood], dis = r.offline, go = r.mood === 'cleaning';
    const sel = ([sid, label]) => { const o = attr(sid, 'options'); return Array.isArray(o) && o.length ? lbl(label) + segHTML('sel', o.map(x => [x, esc(x)]), held(r.d, sid, val(sid)), { dis: gone(sid) }).replace(/data-a="sel"/g, `data-a="sel" data-s="${sid}"`) : ''; };
    return {
      title: v.name, accent: a, pill: pillHTML2(r.offline ? 'Offline' : V_WORD[r.mood]),
      fx: skyHTML(V_SKY[r.mood], a, r.mood === 'cleaning' ? { air: 6, pool: 'drift' } : {}, 150),
      parts: [
        ['hero', `<div class="uhero">${this.arc(v, r, 'lg')}<div class="dg-title">${r.offline ? offWord(v.ent) : V_WORD[r.mood]}</div><div class="dg-sub">${this.sub(v, r)}</div></div>`],
        ['acts', `<div class="tiles four nodrag">
          <button class="tile${go ? ' on' : ''}" data-a="go"${dis ? ' disabled' : ''}>${svg(go ? 'pause' : 'play', 20)}${go ? 'Pause' : r.mood === 'paused' ? 'Resume' : 'Start'}</button>
          <button class="tile" data-a="dock"${dis ? ' disabled' : ''}>${svg('dock', 20)}Dock</button>
          <button class="tile" data-a="stop"${dis ? ' disabled' : ''}>${svg('stop', 20)}Stop</button>
          ${v.locate ? `<button class="tile" data-a="locate"${dis ? ' disabled' : ''}>${svg('locate', 20)}Find</button>` : `<button class="tile" data-a="relocate"${dis || unav(v.relocate) ? ' disabled' : ''}>${svg('locate', 20)}Relocate</button>`}</div>`],
        v.id === 'shark' ? ['suction', lbl('SUCTION') + segHTML('fan', [['normal', 'Eco'], ['eco', 'Normal'], ['max', 'Max']], r.fan, { dis, wait: tWaiting(r.d, 'fan') })] : null,
        v.mode ? ['mode', lbl('MODE') + segHTML('cmode', [['Normal', 'Normal'], ['Matrix', 'Matrix']], r.cmode, { dis: gone(v.mode), wait: tWaiting(r.d, 'cmode') })] : null,
        v.rooms ? ['rooms', lbl('CLEAN A ROOM') + `<div class="tiles nodrag">${v.rooms.map(([b, n]) => `<button class="tile" data-a="room" data-v="${b}"${unav(b) ? ' disabled' : ''}>${svg('room', 18)}${n}</button>`).join('')}</div>`] : null,
        ...(v.selects || []).map(s => [s[0], sel(s)]),
        v.switches ? ['sw', lbl('SETTINGS') + grp(v.switches.map(([sid, n]) => swRow('sw', n, 'tune', held(r.d, sid, val(sid)) === 'on', a, { v: sid, dis: gone(sid), wait: tWaiting(r.d, sid) })).join(''))] : null,
        v.map && haPic(attr(v.map, 'entity_picture')) ? ['map', lbl('MAP') + `<div class="vmap"><img src="${esc(haPic(attr(v.map, 'entity_picture'), (st(v.map) || {}).lu))}" alt="The vacuum's map"></div>`] : null,
        ['read', lbl('READINGS') + grp(readRow('battery', 'Battery', isNaN(r.bat) ? '—' : Math.round(r.bat) + '%' + (isOn(v.charging) ? ' · Charging' : ''))
          + readRow('wifi', 'Wi-Fi', isNaN(num(v.wifi)) ? '—' : Math.round(num(v.wifi)) + ' dBm')
          + (v.mop ? readRow('mop', 'Mop', gone(v.mop) ? '—' : isOn(v.mop) ? 'Attached' : 'Not attached') : '')
          + readRow('alert', 'Error', esc(val(v.err) && !gone(v.err) ? val(v.err) : 'None')))],
        v.life ? ['life', lbl('PARTS') + grp(v.life.map(([k, n]) => {
          const pct = num(`sensor.${v.id}_${k}_lifespan`), arm = isArmed('vl' + k);
          return actRow('life', arm ? `Tap again to reset the ${n.toLowerCase()}` : n, 'brush', { v: k, warn: arm, dis: unav(`button.${v.id}_reset_${k}_lifespan`), right: isNaN(pct) ? '—' : Math.round(pct) + '%' });
        }).join(''))] : null,
      ],
    };
  },
  act(id, a, b) {
    const v = VACS.find(x => x.id === id), r = this.read(v), d = r.d;
    if (a === 'go') { tset(d, 'state', r.mood === 'cleaning' ? 'paused' : 'cleaning'); render(); return tsend(d, 'script', 'turn_on', { entity_id: v.toggle }, ['state']); }
    if (a === 'dock') { tset(d, 'state', 'returning'); render(); return tsend(d, 'vacuum', 'return_to_base', { entity_id: v.ent }, ['state']); }
    if (a === 'stop') return fire(v.name, 'vacuum', 'stop', { entity_id: v.ent });
    if (a === 'locate') { toast('Shark: playing its sound'); return fire(v.name, 'vacuum', 'locate', { entity_id: v.ent }); }
    if (a === 'relocate') return fire(v.name, 'button', 'press', { entity_id: v.relocate });
    if (a === 'fan') { if (r.fan !== b.dataset.v) { tset(d, 'fan', b.dataset.v); render(); tsend(d, 'vacuum', 'set_fan_speed', { entity_id: v.ent, fan_speed: b.dataset.v }, ['fan']); } return; }
    if (a === 'cmode') { if (r.cmode !== b.dataset.v) { tset(d, 'cmode', b.dataset.v); render(); tsend(d, 'select', 'select_option', { entity_id: v.mode, option: b.dataset.v }, ['cmode']); } return; }
    if (a === 'room') { toast(`${v.name}: cleaning ${b.textContent.trim()}`); return fire(v.name, 'button', 'press', { entity_id: b.dataset.v }); }
    if (a === 'sel') { const sid = b.dataset.s; tset(d, sid, b.dataset.v); render(); return tsend(d, 'select', 'select_option', { entity_id: sid, option: b.dataset.v }, [sid]); }
    if (a === 'sw') { const sid = b.dataset.v; tset(d, sid, val(sid) === 'on' ? 'off' : 'on'); render(); return tsend(d, 'switch', 'toggle', { entity_id: sid }, [sid]); }
    if (a === 'life') { const k = b.dataset.v; if (twice('vl' + k)) fire(v.name, 'button', 'press', { entity_id: `button.${v.id}_reset_${k}_lifespan` }); }
  },
  samples: e => ({
    'vacuum.shark': e('docked', { fan_speed: 'normal', fan_speed_list: ['eco', 'normal', 'max'] }), 'sensor.shark_battery': e(86, { unit_of_measurement: '%' }),
    'sensor.shark_wifi_signal': e(-58, { unit_of_measurement: 'dBm' }), 'sensor.shark_error_status': e('No error'), 'binary_sensor.shark_charging': e('on'), 'binary_sensor.shark_error': e('off'),
    'select.shark_clean_mode': e('Normal', { options: ['Normal', 'Matrix'] }), 'button.shark_clean_room': e('unknown'), 'button.shark_clean_room_1': e('unknown'), 'button.shark_clean_room_2': e('unknown'),
    'vacuum.john': e('unavailable'), 'sensor.john_battery': e('unavailable'), 'sensor.john_error': e('unavailable'),
  }),
  preview(domain, service, d) {
    if (domain !== 'script' || service !== 'turn_on') return false;
    const v = VACS.find(x => x.toggle === d.entity_id); if (!v) return false;
    patchEnt(v.ent, val(v.ent) === 'cleaning' ? 'paused' : 'cleaning');
    if (v.charging) patchEnt(v.charging, 'off');
    return true;
  },
});

// ---------------------------------------------------------------------------
// BLINDS: the office VELUX blinds. As on the dashboard, a tap sets the
// blind's target helper (input_number.<blind>_target), not the cover: the
// VELUX cloud is slow, and automations push the target to the blinds and
// write it back when they move by themselves. Departure mode (a VELUX lock)
// stops them moving at all. Guest mode skips the 08:30 open and the sunset
// close (they catch up when it goes off).
const BLINDS = [
  { id: 'all', name: 'Office Blinds', cover: 'cover.office_blinds', helper: 'input_number.office_blinds_target' },
  { id: 'left', name: 'Left', cover: 'cover.office_left_blind', helper: 'input_number.office_left_blind_target' },
  { id: 'right', name: 'Right', cover: 'cover.office_right_blind', helper: 'input_number.office_right_blind_target' },
];
const DEPART = 'lock.velux_gateway_departure_mode', GUEST = 'input_boolean.guest_mode', B_ACC = '129,201,149';

family({
  id: 'blinds', name: 'Blinds', icon: 'blinds', group: 'Around the house', order: 2,
  read(b) {
    const d = dv('blinds', b.id, b.name), s = st(b.cover), A = s ? s.attributes : {};
    const pos = A.current_position, tgt = held(d, 'pos', num(b.helper));
    return { d, pos: pos == null ? null : Number(pos), tgt: isNaN(tgt) ? null : tgt, moving: s && (s.state === 'opening' || s.state === 'closing'), offline: gone(b.cover) };
  },
  shade(r, size) {
    const p = r.pos == null ? 0 : r.pos;
    let pleats = ''; for (let i = 1; i < 10; i++) pleats += `<i style="top:${i * 10}%"></i>`;
    return `<div class="shade ${size}${r.moving ? ' moving' : ''}"><div class="pane"></div><div class="cloth" style="height:${100 - p}%">${pleats}<b></b></div><div class="mull"></div></div>`;
  },
  words(r) { return r.offline ? 'Unavailable' : r.moving && r.tgt != null ? `Moving to ${Math.round(r.tgt)}%` : r.pos == null ? '—' : r.pos <= 0 ? 'Closed' : r.pos >= 100 ? 'Open' : `Open ${Math.round(r.pos)}%`; },
  chips(b, r) { return chipsHTML('pos', [[0, 'Closed'], [25, '25'], [50, '50'], [75, '75'], [100, 'Open']], r.tgt, { near: 2, dis: r.offline || gone(b.helper) }); },
  mount(el) {
    el.innerHTML = `<div data-r="banner"></div>` + cardHTML('blinds:all', `
      <div class="dg-top"><div data-r="hero"></div><div class="dg-info" data-r="info"></div></div><div data-r="chips"></div>`);
  },
  render() {
    const b = BLINDS[0], r = this.read(b), card = this.el.querySelector('[data-dv="blinds:all"]'), R = k => card.querySelector(`[data-r="${k}"]`);
    const sides = BLINDS.slice(1).map(x => { const q = this.read(x); return x.name + ' ' + (q.pos == null ? '—' : Math.round(q.pos) + '%'); }).join(' · ');
    const locked = val(DEPART) === 'locked';
    put(this.el.querySelector('[data-r="banner"]'), locked ? `<div class="warnbar">${svg('lock', 18)}Departure mode - the blinds will not move</div>` : '');
    put(R('fx'), skyHTML(grad('#171C19', '#202A23', '#324236'), B_ACC, r.pos > 0 ? { pool: 'drift', poolA: 0.06 + 0.1 * r.pos / 100, poolRgb: '255,236,200' } : {}));
    put(R('hero'), this.shade(r, 'sm'));
    put(R('info'), infoHTML2(b.name, this.words(r), sides, isOn(GUEST) ? `<div class="alerts"><span class="alert guest">${svg('guest', 13)}Guest mode</span></div>` : ''));
    put(R('chips'), this.chips(b, r));
    card.classList.toggle('offline', r.offline);
    shadow(card, B_ACC);
    this.sum = r.offline ? 'Unavailable' : this.words(r);
  },
  sheet() {
    const r = this.read(BLINDS[0]), guest = held(dv('blinds', 'guest', 'Guest mode'), 'g', val(GUEST)) === 'on';
    const side = b => { const q = this.read(b); return `<div class="bside">${sliderHTML('pos', q.tgt ?? q.pos ?? 0, 0, 100, 1, { v: b.id, label: b.name.toUpperCase(), shown: this.words(q), unit: '%', tint: B_ACC, dis: q.offline || gone(b.helper) })}
      ${this.chips(b, q).replace(/data-a="pos"/g, `data-a="pos" data-b="${b.id}"`)}</div>`; };
    return {
      title: 'Office Blinds', accent: B_ACC, pill: pillHTML2(this.words(r)),
      fx: skyHTML(grad('#171C19', '#202A23', '#324236'), B_ACC, {}, 150),
      parts: [
        ['hero', `<div class="uhero">${this.shade(r, 'lg')}<div class="dg-title">${this.words(r)}</div></div>`],
        val(DEPART) === 'locked' ? ['dep', `<div class="warnbar">${svg('lock', 18)}Departure mode - the blinds will not move</div>`] : null,
        ['all', side(BLINDS[0])],
        ['sides', lbl('EACH BLIND') + BLINDS.slice(1).map(side).join('')],
        ['guest', grp(swRow('guest', 'Guest mode', 'guest', guest, '250,144,62', { wait: tWaiting(dv('blinds', 'guest', 'Guest mode'), 'g'), dis: gone(GUEST) }), true)
          + '<p class="tnote">Guest mode skips the 08:30 open and the sunset close; they catch up when it goes off.</p>'],
      ],
    };
  },
  setPos(b, v) { const r = this.read(b); tset(r.d, 'pos', v); render(); return tsend(r.d, 'input_number', 'set_value', { entity_id: b.helper, value: v }, ['pos']); },
  act(id, a, el) {
    if (a === 'pos') return this.setPos(BLINDS.find(x => x.id === (el.dataset.b || id)), Number(el.dataset.v));
    if (a === 'guest') { const g = dv('blinds', 'guest', 'Guest mode'); tset(g, 'g', isOn(GUEST) ? 'off' : 'on'); render(); return tsend(g, 'input_boolean', 'toggle', { entity_id: GUEST }, ['g']); }
  },
  slide(id, a, v, el) { if (a === 'pos') return this.setPos(BLINDS.find(x => x.id === el.dataset.v), v); },
  samples: e => ({
    'cover.office_blinds': e('open', { current_position: 50 }), 'cover.office_left_blind': e('open', { current_position: 50 }), 'cover.office_right_blind': e('open', { current_position: 50 }),
    'input_number.office_blinds_target': e(50, { min: 0, max: 100, step: 1 }), 'input_number.office_left_blind_target': e(50, { min: 0, max: 100, step: 1 }), 'input_number.office_right_blind_target': e(50, { min: 0, max: 100, step: 1 }),
    [DEPART]: e('unlocked'), [GUEST]: e('off'),
  }),
  // The automations, as the preview's: a target moves its blind (both, for the pair).
  preview(domain, service, d) {
    const b = BLINDS.find(x => x.helper === d.entity_id); if (!b || service !== 'set_value') return false;
    const list = b.id === 'all' ? BLINDS : [b];
    for (const x of list) { patchEnt(x.helper, d.value); patchEnt(x.cover, d.value > 0 ? 'open' : 'closed', { current_position: d.value }); }
    if (b.id !== 'all') { const avg = Math.round((num(BLINDS[1].helper) + num(BLINDS[2].helper)) / 2); patchEnt(BLINDS[0].cover, avg > 0 ? 'open' : 'closed', { current_position: avg }); patchEnt(BLINDS[0].helper, avg); }
    return true;
  },
});

// ---------------------------------------------------------------------------
// NURSERY: Olivia's Hatch, the HG1 card (hg_*). Same rules:
//   - sound on is select_sound_mode, never media_play (which replays 'NONE')
//   - off stops the whole device (media_stop)
//   - volume moves in 5s; taps add up into one call 0.6 s after the last
//   - Morning is script.hatch_bedtime with light: green (the Hatch's own
//     Morning favourite leaves the light off when Home Assistant starts it);
//     lit when the lamp is within 40 of that green (90,200,120)
//   - the clock's Off only turns it off when it is on: on the Rest 2nd gen
//     turning the clock off is a toggle (XOR) and would turn it back on.
//     The dashboard's own Off button does not check this; this one does.
const HATCH = { ent: 'media_player.olivias_hatch_media_player', light: 'light.olivias_hatch_light', clock: 'light.olivias_hatch_clock', lock: 'switch.olivias_hatch_toddler_lock',
  wifi: 'binary_sensor.olivias_hatch_wifi', bed: 'scene.olivia_s_bedroom_olivias_hatch_white_noise_2', script: 'script.hatch_bedtime' };
const H_SKY = { night: grad('#1A1B24', '#262838', '#3D4056'), light: grad('#1D1B20', '#2A272E', '#423D47'), sound: grad('#191B22', '#242833', '#394050'), off: grad('#17181C', '#212329', '#33363E'), offline: grad('#121316', '#1C1D21', '#2C2E34') };
const H_ACC = { night: '196,190,226', light: '214,200,196', sound: '176,188,222', off: '190,194,204', offline: '154,160,166' };
const H_COLOURS = [[255, 60, 30], [255, 122, 89], [255, 183, 3], [90, 200, 120], [78, 161, 255], [155, 140, 255], [255, 255, 255]];
const niceSound = s => !s || s === 'NONE' ? 'No sound' : String(s).replace(/([a-z])([A-Z0-9])/g, '$1 $2');

family({
  id: 'nursery', name: 'Nursery', icon: 'baby', group: 'Around the house', order: 3,
  read() {
    const d = dv('nursery', 'hatch', "Olivia's Hatch"), s = st(HATCH.ent), A = s ? s.attributes : {}, L = st(HATCH.light), LA = L ? L.attributes : {};
    const offline = gone(HATCH.ent) || val(HATCH.wifi) === 'off';
    const lit = held(d, 'light', L ? L.state : 'off') === 'on', playing = held(d, 'snd', s ? (s.state === 'playing' ? 'on' : 'off') : 'off') === 'on';
    const bri = lit ? held(d, 'bri', LA.brightness != null ? Math.round(LA.brightness / 2.55) : 0) : 0;
    const rgb = LA.rgb_color ? LA.rgb_color.join(',') : '255,196,140';
    const vol = held(d, 'vol', A.volume_level != null ? Math.round(A.volume_level * 100) : 0);
    const mood = offline ? 'offline' : lit && playing ? 'night' : lit ? 'light' : playing ? 'sound' : 'off';
    const C = st(HATCH.clock), ck = C && C.state === 'on' ? Math.round((C.attributes.brightness || 0) / 2.55) : 0;
    return { d, A, LA, offline, lit, playing, bri, rgb, vol, mood, ck, sound: A.sound_mode };
  },
  title(r) { return r.offline ? (gone(HATCH.ent) ? offWord(HATCH.ent) : 'Offline') : r.playing ? niceSound(r.sound) : r.lit ? 'Night light' : 'Resting'; },
  sub(r) { return r.offline ? 'The Hatch is not reachable' : (r.lit ? `Light ${r.bri}%` : 'Light off') + ' · ' + (r.playing ? `Volume ${r.vol}%` : 'Sound off'); },
  // The lamp behind frosted glass, sound rings round it, a clock capsule.
  lamp(r, size) {
    const b = r.lit ? Math.max(0.08, r.bri / 100) : 0, t = r.rgb;
    let rings = '';
    const dur = 6 - r.vol / 100 * 2;
    if (r.playing) for (let i = 0; i < 3; i++) rings += `<i class="hring" style="animation-duration:${dur.toFixed(1)}s;animation-delay:-${(i * dur / 3).toFixed(2)}s;border-color:rgba(255,255,255,${(0.12 + r.vol / 100 * 0.22).toFixed(2)})"></i>`;
    const glyph = { night: 'night', light: 'lightbulb', sound: 'sound', off: 'night', offline: 'wifi' }[r.mood];
    return `<div class="hlamp ${size}">${rings}<div class="hbulb" style="background:${r.lit ? `radial-gradient(circle, rgba(${t},${(0.55 + b * 0.45).toFixed(2)}) 0%, rgba(${t},${(0.3 + b * 0.35).toFixed(2)}) 46%, rgba(${t},0) 72%)` : 'radial-gradient(circle, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 70%)'}"></div>
      <div class="glass">${svg(glyph, size === 'lg' ? 40 : 28)}${r.ck ? `<span class="hclk">${svg('clock', 12)}</span>` : ''}</div></div>`;
  },
  fx(r, top) { return skyHTML(H_SKY[r.mood], H_ACC[r.mood], { stars: r.mood === 'night' || r.mood === 'sound' ? 14 : 0, pool: r.lit && top > 100 ? 'breathe' : '', poolRgb: r.rgb, poolA: 0.1 + 0.12 * r.bri / 100, seed: 7 }, top); },
  volStep(r, bare) { return stepHTML('VOLUME', r.vol + '%', r.vol, { bare, a: 'vol', dis: r.offline, atMin: r.vol <= 0, atMax: r.vol >= 100 }); },
  mount(el) {
    el.innerHTML = cardHTML('nursery:hatch', `
      <div class="dg-top"><div data-r="hero"></div><div class="dg-info" data-r="info"></div></div>
      <div class="dg-ctl"><div data-r="btns" class="hbtns"></div><i class="hair"></i><div class="dg-tgt" data-r="vol"></div></div>`);
  },
  render() {
    const r = this.read(), card = this.el.querySelector('[data-dv="nursery:hatch"]'), R = k => card.querySelector(`[data-r="${k}"]`), a = r.lit ? r.rgb : H_ACC[r.mood];
    put(R('fx'), this.fx(r, 60));
    put(R('hero'), this.lamp(r, 'sm'));
    put(R('info'), infoHTML2("Olivia's Hatch", this.title(r), this.sub(r)));
    put(R('btns'), pwrBtn(r.lit, r.rgb, r.lit ? 'Light off' : 'Light on', { a: 'light', icon: 'lightbulb', dis: r.offline, wait: tWaiting(r.d, 'light') })
      + pwrBtn(r.playing, H_ACC.sound, r.playing ? 'Stop the sound' : 'Play the sound', { a: 'snd', icon: 'sound', dis: r.offline, wait: tWaiting(r.d, 'snd') }));
    put(R('vol'), this.volStep(r, true));
    card.classList.toggle('offline', r.offline);
    shadow(card, a);
    this.sum = r.offline ? 'Offline' : { night: 'Light · Sound', light: 'Night light', sound: niceSound(r.sound), off: 'Off' }[r.mood];
  },
  sheet() {
    const r = this.read(), dis = r.offline, a = r.lit ? r.rgb : H_ACC[r.mood];
    const list = r.A.sound_mode_list || [], fav = attr(HATCH.bed, 'hatch_favorite_id');
    const bedOn = fav != null && r.A.current_favorite === fav;
    const c = r.LA.rgb_color, morningOn = r.lit && c && Math.abs(c[0] - 90) + Math.abs(c[1] - 200) + Math.abs(c[2] - 120) <= 40;
    const near = x => c && Math.abs(c[0] - x[0]) + Math.abs(c[1] - x[1]) + Math.abs(c[2] - x[2]) <= 40;
    const lock = held(r.d, 'lock', val(HATCH.lock)) === 'on';
    return {
      title: "Olivia's Hatch", accent: a, fx: this.fx(r, 150), pill: pillHTML2({ night: 'Light · Sound', light: 'Light · On', sound: 'Sound · On', off: 'Off', offline: 'Offline' }[r.mood], r.lit ? r.rgb : ''),
      parts: [
        ['hero', `<div class="uhero">${this.lamp(r, 'lg')}<div class="dg-title">${this.title(r)}</div><div class="dg-sub">${this.sub(r)}</div></div>`],
        ['vol', this.volStep(r)],
        ['main', grp(swRow('light', 'Light', 'lightbulb', r.lit, r.lit ? r.rgb : '48,209,88', { dis, wait: tWaiting(r.d, 'light') })
          + swRow('snd', 'Sound', 'sound', r.playing, H_ACC.sound, { dis, wait: tWaiting(r.d, 'snd') }), true)],
        ['sound', lbl('SOUND') + `<div class="sndrow"><button class="disc" data-a="sndstep" data-v="-1" aria-label="Previous sound"${dis || !list.length ? ' disabled' : ''}>${svg('prev', 20)}</button>
          <b>${esc(niceSound(r.sound))}</b><button class="disc" data-a="sndstep" data-v="1" aria-label="Next sound"${dis || !list.length ? ' disabled' : ''}>${svg('next', 20)}</button></div>`],
        ['favs', `<div class="tiles two nodrag"><button class="tile${bedOn ? ' on' : ''}" data-a="bedtime"${dis || !st(HATCH.bed) ? ' disabled' : ''}>${svg('night', 20)}Bedtime</button>
          <button class="tile${morningOn ? ' on' : ''}" data-a="morning"${dis ? ' disabled' : ''}>${svg('sun', 20)}Morning</button></div>`],
        ['bri', lbl('BRIGHTNESS') + segHTML('bseg', Array.from({ length: 10 }, (_, i) => [i + 1, i + 1]), r.lit ? Math.max(1, Math.min(10, Math.round(r.bri / 10))) : null, { cls: 'rail', dis })],
        ['colour', lbl('COLOR') + `<div class="swatches nodrag">${H_COLOURS.map((x, i) => `<button class="swatch${near(x) && r.lit ? ' on' : r.lit ? ' dim' : ''}" data-a="colour" data-v="${i}" style="--c:${x.join(',')}" aria-label="Color ${i + 1}"${dis ? ' disabled' : ''}><i></i></button>`).join('')}</div>`],
        ['clock', lbl('CLOCK') + segHTML('clock', [[0, 'Off'], [10, 'Dim'], [40, 'Mid'], [100, 'Bright']], r.ck === 0 ? 0 : r.ck < 25 ? 10 : r.ck < 70 ? 40 : 100, { dis: dis || gone(HATCH.clock) })],
        ['more', grp(swRow('lock', 'Toddler lock', lock ? 'lock' : 'lockOpen', lock, a, { dis: gone(HATCH.lock), wait: tWaiting(r.d, 'lock') })
          + readRow('wifi', 'Wi-Fi', val(HATCH.wifi) === 'on' ? 'Connected' : val(HATCH.wifi) === 'off' ? 'Offline' : '—'), true)],
      ],
    };
  },
  act(id, a, b) {
    const r = this.read(), d = r.d;
    if (a === 'light') { tset(d, 'light', r.lit ? 'off' : 'on'); render(); return tsend(d, 'light', 'toggle', { entity_id: HATCH.light }, ['light']); }
    if (a === 'snd') {
      tset(d, 'snd', r.playing ? 'off' : 'on'); render();
      return r.playing ? tsend(d, 'media_player', 'media_stop', { entity_id: HATCH.ent }, ['snd'])
        : tsend(d, 'media_player', 'select_sound_mode', { entity_id: HATCH.ent, sound_mode: r.sound && r.sound !== 'NONE' ? r.sound : 'WhiteNoise' }, ['snd']);
    }
    if (a === 'vol') {
      const v = Math.max(0, Math.min(100, Math.round(r.vol / 5) * 5 + Number(b.dataset.v) * 5));
      tset(d, 'vol', v); render();
      return later('hatchvol', () => tsend(d, 'media_player', 'volume_set', { entity_id: HATCH.ent, volume_level: this.read().vol / 100 }, ['vol']));
    }
    if (a === 'sndstep') {
      const list = r.A.sound_mode_list || []; if (!list.length) return;
      const i = list.indexOf(r.sound), next = list[(i + Number(b.dataset.v) + list.length) % list.length];
      tset(d, 'snd', 'on'); render();
      return tsend(d, 'media_player', 'select_sound_mode', { entity_id: HATCH.ent, sound_mode: next }, ['snd']);
    }
    if (a === 'bedtime') return fire("Olivia's Hatch", 'scene', 'turn_on', { entity_id: HATCH.bed });
    if (a === 'morning') return fire("Olivia's Hatch", 'script', 'turn_on', { entity_id: HATCH.script, variables: { light: 'green' } });
    if (a === 'bseg') { const p = Number(b.dataset.v) * 10; tset(d, 'light', 'on'); tset(d, 'bri', p); render(); return tsend(d, 'light', 'turn_on', { entity_id: HATCH.light, brightness_pct: p }, ['light', 'bri']); }
    if (a === 'colour') { tset(d, 'light', 'on'); render(); return tsend(d, 'light', 'turn_on', { entity_id: HATCH.light, rgb_color: H_COLOURS[Number(b.dataset.v)] }, ['light']); }
    if (a === 'clock') {
      const p = Number(b.dataset.v);
      if (p === 0) return val(HATCH.clock) === 'on' ? fire("Olivia's Hatch", 'light', 'turn_off', { entity_id: HATCH.clock }) : undefined;   // a toggle on this model: only when on
      return fire("Olivia's Hatch", 'light', 'turn_on', { entity_id: HATCH.clock, brightness_pct: p });
    }
    if (a === 'lock') { tset(d, 'lock', val(HATCH.lock) === 'on' ? 'off' : 'on'); render(); return tsend(d, 'switch', 'toggle', { entity_id: HATCH.lock }, ['lock']); }
  },
  samples: e => ({
    [HATCH.ent]: e('playing', { sound_mode: 'WhiteNoise', sound_mode_list: ['WhiteNoise', 'Ocean', 'Rain', 'Wind', 'Dryer', 'Fan', 'Lullaby'], volume_level: 0.3, current_favorite: 'fav-bed', current: 'routine' }),
    [HATCH.light]: e('on', { brightness: 26, rgb_color: [255, 122, 89] }), [HATCH.clock]: e('off'),
    [HATCH.lock]: e('off'), [HATCH.wifi]: e('on'), [HATCH.bed]: e('2026-10-04T19:00:00', { hatch_favorite_id: 'fav-bed' }),
  }),
  preview(domain, service, d) {
    if (domain === 'scene' && d.entity_id === HATCH.bed) { patchEnt(HATCH.ent, 'playing', { sound_mode: 'WhiteNoise', volume_level: 0.3, current_favorite: 'fav-bed' }); patchEnt(HATCH.light, 'off', { brightness: null, rgb_color: null }); return true; }
    if (domain === 'script' && d.entity_id === HATCH.script) { patchEnt(HATCH.ent, 'playing', { sound_mode: 'WhiteNoise', volume_level: 0.3, current_favorite: null }); patchEnt(HATCH.light, 'on', { brightness: 77, rgb_color: [90, 200, 120] }); patchEnt(HATCH.clock, 'off'); return true; }
    if (d.entity_id === HATCH.ent && service === 'media_stop') { patchEnt(HATCH.ent, 'idle', { current_favorite: null }); patchEnt(HATCH.light, 'off', { brightness: null, rgb_color: null }); return true; }
    return false;
  },
});

// ---------------------------------------------------------------------------
// PRINTER: the office Brother. It is a colour laser; "ink" is the
// integration's word for toner. 20% and under is low.
const TONERS = [['Black', 'black', '200,203,208'], ['Cyan', 'cyan', '34,184,207'], ['Magenta', 'magenta', '224,90,156'], ['Yellow', 'yellow', '232,185,59']];
const PRN = 'sensor.office_office_printer_status';
family({
  id: 'printer', name: 'Printer', icon: 'printer', group: 'Around the house', order: 4,
  mount(el) { el.innerHTML = cardHTML('printer:prn', '<div class="prn" data-r="body"></div>', 'flat'); },
  render() {
    const card = this.el.querySelector('[data-dv="printer:prn"]'), s = val(PRN), off = gone(PRN);
    const t = TONERS.map(([n, k, c]) => { const id = `sensor.office_office_printer_${k}_ink_remaining`, v = num(id); return { n, c, v, na: gone(id) }; });
    const low = t.filter(x => !x.na && x.v <= 20).sort((a, b) => a.v - b.v);
    put(card.querySelector('[data-r="fx"]'), skyHTML(grad('#17181A', '#212326', '#33363B'), '190,194,204', {}));
    put(card.querySelector('[data-r="body"]'), `<div class="dg-top"><span class="shield" style="--a:${low.length ? low[0].c : '190,194,204'}">${svg('printer', 28)}</span>
      <div class="dg-info"><div class="dg-name">Office Printer</div><div class="dg-title">${off ? offWord(PRN) : esc(String(s).replace(/^\w/, c => c.toUpperCase()))}</div>
      <div class="dg-sub">${low.length ? low.map(x => x.n).join(', ') + ' toner low' : 'Toner OK'}</div></div></div>
      <div class="toners">${t.map(x => `<div class="toner${x.na ? ' na' : ''}${!x.na && x.v <= 20 ? ' low' : ''}" style="--c:${x.c}"><span>${x.n}</span><i><b style="width:${x.na ? 0 : Math.max(2, Math.min(100, x.v))}%"></b></i><em>${x.na ? '—' : Math.round(x.v) + '%'}</em></div>`).join('')}</div>`);
    shadow(card, low.length ? low[0].c : '190,194,204');
    this.sum = off ? 'Offline' : low.length ? low.map(x => x.n).join(', ') + ' low' : String(s).replace(/^\w/, c => c.toUpperCase());
  },
  sheet() { return null; },
  act() {},
  samples: e => ({ [PRN]: e('idle'), 'sensor.office_office_printer_black_ink_remaining': e(64, { unit_of_measurement: '%' }), 'sensor.office_office_printer_cyan_ink_remaining': e(41, { unit_of_measurement: '%' }),
    'sensor.office_office_printer_magenta_ink_remaining': e(17, { unit_of_measurement: '%' }), 'sensor.office_office_printer_yellow_ink_remaining': e(55, { unit_of_measurement: '%' }) }),
});

// ---------------------------------------------------------------------------
// ENERGY: the tiles from every view of the dashboard. Only the two Tapo plugs
// and the heaters are metered; the rest are Home Assistant estimates (lights
// by bulb and brightness, the ACs from nameplate figures, the Dysons at
// 1500 W while heating) at $0.13/kWh. Total is lighting + climate + fans and
// dehumidifiers, not the whole house, and leaves out the $30 base charge.
// Dyson heating is a share of Fans & Dehumidifiers, not added to it. The
// Cube's plug still has its old m_d_dyson ids.
const EN = [
  { id: 'total', name: 'Total', icon: 'lightning', p: 'sensor.estimated_total_power', d: 'sensor.total_daily_energy', m: 'sensor.total_monthly_energy', c: 'sensor.estimated_total_cost_this_month', acc: '255,214,10' },
  { id: 'light', name: 'Lighting', icon: 'lightbulb', p: 'sensor.estimated_lighting_power', d: 'sensor.lighting_daily_energy', m: 'sensor.lighting_monthly_energy', c: 'sensor.estimated_lighting_cost_this_month', acc: '245,166,35' },
  { id: 'climate', name: 'Climate', icon: 'thermostat', p: 'sensor.estimated_climate_power', d: 'sensor.climate_daily_energy', m: 'sensor.climate_monthly_energy', c: 'sensor.estimated_climate_cost_this_month', acc: '255,179,138' },
  { id: 'fans', name: 'Fans & Dehumidifiers', icon: 'fan', p: 'sensor.estimated_fan_dehumidifier_power', d: 'sensor.fan_dehumidifier_daily_energy', m: 'sensor.fan_dehumidifier_monthly_energy', c: 'sensor.estimated_fan_dehumidifier_cost_this_month', acc: '142,227,214' },
  { id: 'dyheat', name: 'Dyson heating', note: 'part of Fans & Dehumidifiers', icon: 'fire', p: 'sensor.dyson_heating_power', d: 'sensor.dyson_heating_daily_energy', m: 'sensor.dyson_heating_monthly_energy', c: 'sensor.dyson_heating_cost_this_month', acc: '246,170,112' },
  { id: 'tv', name: 'TV', note: 'not in the total', icon: 'tv', p: 'sensor.estimated_tv_power', d: 'sensor.tv_daily_energy', m: 'sensor.tv_monthly_energy', c: 'sensor.estimated_tv_cost_this_month', acc: '170,188,230' },
  { id: 'up', name: 'Upstairs Dehumidifier', note: 'plug', icon: 'plug', p: 'sensor.upstairs_dehumidifier_current_consumption', d: 'sensor.upstairs_dehumidifier_today_s_consumption', m: 'sensor.upstairs_dehumidifier_this_month_s_consumption', acc: '79,195,247' },
  { id: 'cube', name: 'Cube Dehumidifier', note: 'plug', icon: 'plug', p: 'sensor.m_d_dyson_current_consumption', d: 'sensor.m_d_dyson_today_s_consumption', m: 'sensor.m_d_dyson_this_month_s_consumption', acc: '255,183,77' },
];
family({
  id: 'energy', name: 'Energy', icon: 'lightning', group: 'Around the house', order: 5,
  mount(el) {
    el.innerHTML = EN.map(x => `<article class="en${x.id === 'total' ? ' big' : ''}" data-en="${x.id}"></article>`).join('')
      + '<p class="tnote">Estimates, apart from the two plugs and the heaters. Total is lighting, climate, and fans & dehumidifiers - not the whole house, and without the $30 base charge.</p>';
  },
  render() {
    const total = num(EN[0].p);
    for (const x of EN) {
      const w = num(x.p), share = x.id !== 'total' && total > 0 && !isNaN(w) && !/plug|total/.test(x.note || '') ? Math.min(100, w / total * 100) : null;
      put(this.el.querySelector(`[data-en="${x.id}"]`), `<div class="en-top"><span class="en-ic" style="--a:${x.acc}">${svg(x.icon, 18)}</span><span class="en-name">${x.name}${x.note ? `<small>${x.note}</small>` : ''}</span>
        <b class="en-now${!isNaN(w) && w < 1 ? ' idle' : ''}">${watts(x.p)}</b></div>
        ${share != null ? `<i class="en-bar"><b style="width:${share.toFixed(1)}%;background:rgb(${x.acc})"></b></i>` : ''}
        ${statsHTML([['TODAY', kwh(x.d)], ['MONTH', kwh(x.m, 1)], ...(x.c ? [['COST', money(x.c)]] : [])])}`);
    }
    this.sum = isNaN(total) ? '—' : Math.round(total) + ' W now';
  },
  samples: e => {
    const v = (p, d, m, c) => [p, d, m, c];
    const rows = { total: v(1980, 14.2, 268, 34.8), light: v(118, 1.9, 41, 5.3), climate: v(1610, 9.8, 172, 22.4), fans: v(252, 2.5, 55, 7.1), dyheat: v(150, 1.1, 22, 2.9), tv: v(96, 0.8, 19, 2.5) };
    const out = {};
    for (const x of EN) if (rows[x.id]) { const [p, d, m, c] = rows[x.id]; Object.assign(out, { [x.p]: e(p, { unit_of_measurement: 'W' }), [x.d]: e(d), [x.m]: e(m), [x.c]: e(c) }); }
    return out;
  },
});
