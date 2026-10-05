// AIR PURIFIERS: the Signal dashboard's DY1 rotor card (ha-config,
// views_signal/climate.yaml, the dz_* anchors) in this app's layout. Same
// rules: ten curved glass blades lit up to the speed (1-10 is percentage /
// 10), turning faster with it; the room temperature in the hub; heating when
// the climate side is in Heat and says it is heating, "warm" when in Heat
// and idle. The girls' units steer the air Focus / Diffuse (the climate's
// fan mode) and have an air-sensitivity select; the M&D unit points it Front
// / Back (the fan's direction) and has PM2.5, PM10 and NO2 instead. Air
// quality is the worst of its sensors' bands. Manual is the preset `Normal`.
// The id prefixes are uneven (olivias_dyson_*, md_dyson_*): the registry's.
'use strict';
const DYSONS = [
  { id: 'sofia', name: "Sofia's Dyson", fan: 'fan.sofias_dyson', clim: 'climate.sofias_dyson', temp: 'sensor.sofias_dyson_temperature', rh: 'sensor.sofias_dyson_humidity',
    aq: [['AQI', 'sensor.sofias_dyson_air_quality_index', 'idx'], ['VOC', 'sensor.sofias_dyson_volatile_organic_compounds_index', 'idx']],
    night: 'switch.sofias_dyson_night_mode', prevNight: 'input_boolean.sofia_s_dyson_previous_night', sense: 'switch.sofias_dyson_continuous_monitoring',
    sens: 'select.sofias_dyson_air_quality', filter: 'sensor.sofias_dyson_filter_life_percent', reset: 'button.sofias_dyson_reset_filter_life',
    runtime: 'sensor.sofias_dyson_runtime_today', tilt: 'binary_sensor.sofias_dyson_tilt', heated: 'sensor.sofias_dyson_heated_today', boost: 'input_boolean.signal_dyson_sofia_boost', flow: 'focus',
    skies: { off: grad('#19191E', '#23232B', '#34343F'), fan: grad('#1D1B24', '#2A2735', '#433E56'), heating: grad('#221C21', '#32282D', '#4F3F42'), warm: grad('#1F1B1F', '#2B2629', '#423A3F') },
    acc: { off: '196,194,210', fan: '190,182,222', heating: '222,190,184', warm: '208,192,196' } },
  { id: 'olivia', name: "Olivia's Dyson", fan: 'fan.olivia_s_bedroom_olivias_dyson', clim: 'climate.olivia_s_bedroom_olivias_dyson', temp: 'sensor.olivia_s_bedroom_olivias_dyson_temperature', rh: 'sensor.olivia_s_bedroom_olivias_dyson_humidity',
    aq: [['AQI', 'sensor.olivia_s_bedroom_olivias_dyson_air_quality_index', 'idx'], ['VOC', 'sensor.olivia_s_bedroom_olivias_dyson_volatile_organic_compounds_index', 'idx']],
    night: 'switch.olivia_s_bedroom_olivias_dyson_night_mode', prevNight: 'input_boolean.olivia_s_dyson_previous_night', sense: 'switch.olivia_s_bedroom_olivias_dyson_continuous_monitoring',
    sens: 'select.olivia_s_bedroom_olivias_dyson_air_quality', filter: 'sensor.olivias_dyson_filter_life_percent', reset: 'button.olivia_s_bedroom_olivias_dyson_reset_filter_life',
    runtime: 'sensor.olivias_dyson_runtime_today', tilt: 'binary_sensor.olivia_s_bedroom_olivias_dyson_tilt', heated: 'sensor.olivias_dyson_heated_today', boost: 'input_boolean.signal_dyson_olivia_boost', flow: 'focus',
    skies: { off: grad('#191A1D', '#23252A', '#34373E'), fan: grad('#1A1E24', '#252C36', '#3C4757'), heating: grad('#221D1D', '#332A29', '#504442'), warm: grad('#1E1C1D', '#2A2728', '#413C3E') },
    acc: { off: '196,200,210', fan: '176,196,224', heating: '224,192,178', warm: '206,194,196' } },
  { id: 'md', name: 'M&D Dyson', fan: 'fan.m_d_dyson', clim: 'climate.m_d_dyson', temp: 'sensor.m_d_dyson_temperature', rh: 'sensor.m_d_dyson_humidity',
    aq: [['PM2.5', 'sensor.m_d_dyson_pm_2_5', 'pm25'], ['PM10', 'sensor.m_d_dyson_pm_10', 'pm10'], ['NO₂', 'sensor.m_d_dyson_nitrogen_dioxide_index', 'idx'], ['VOC', 'sensor.m_d_dyson_volatile_organic_compounds_index', 'idx']],
    night: 'switch.m_d_dyson_night_mode', sense: 'switch.m_d_dyson_continuous_monitoring',
    filter: 'sensor.m_d_dyson_hepa_filter_life', filterName: 'HEPA filter', carbon: 'sensor.m_d_dyson_carbon_filter_life',
    runtime: 'sensor.md_dyson_runtime_today', heated: 'sensor.md_dyson_heated_today', boost: 'input_boolean.signal_dyson_md_boost', flow: 'dir',
    skies: { off: grad('#191A19', '#232523', '#343734'), fan: grad('#1A1F1C', '#262E29', '#3D4A42'), heating: grad('#211E1A', '#312B25', '#4E453A'), warm: grad('#1E1C1A', '#2A2724', '#413C37') },
    acc: { off: '196,202,198', fan: '184,208,192', heating: '224,198,168', warm: '208,198,184' } },
];
// Air quality: each sensor's band, the worst one shown. 0-10 indices: 3/6/8.
const AQ_CUT = { idx: [3, 6, 8], pm25: [12, 35.4, 55.4], pm10: [54, 154, 254] };
const AQ_WORD = ['Good', 'Fair', 'Poor', 'Very poor'], AQ_RGB = ['160,214,180', '236,214,150', '240,180,140', '236,160,164'];
const DY_SENS = [['Off', 'Off'], ['Good', 'Low'], ['Default', 'Std'], ['Sensitive', 'High'], ['Very Sensitive', 'Max']];
const aqBand = (kind, v) => isNaN(v) ? -1 : AQ_CUT[kind].findIndex(c => v <= c) < 0 ? 3 : AQ_CUT[kind].findIndex(c => v <= c);

family({
  id: 'dyson', name: 'Air Purifiers', icon: 'purifier', group: 'Climate', order: 3,

  read(y) {
    const d = dv('dyson', y.id, y.name), f = st(y.fan), F = f ? f.attributes : {}, c = st(y.clim), C = c ? c.attributes : {};
    const offline = gone(y.fan);
    const on = !offline && held(d, 'power', f.state) === 'on';
    const pct = held(d, 'pct', F.percentage);
    const spd = on ? Math.max(1, Math.min(10, Math.round((pct || 0) / 10))) : 0;
    const hv = c && !gone(y.clim) ? held(d, 'hvac', c.state) : null;
    const tgt = held(d, 'temperature', C.temperature);
    const mood = offline ? 'offline' : hv === 'heat' && C.hvac_action === 'heating' ? 'heating' : hv === 'heat' ? 'warm' : on ? 'fan' : 'off';
    const bands = y.aq.map(([k, id, kind]) => [k, num(id), aqBand(kind, num(id))]);
    const worst = Math.max(-1, ...bands.map(b => b[2]));
    const nightOn = held(d, 'night', val(y.night)) === 'on';
    return { d, F, C, offline, on, pct, spd, hv, tgt, mood, bands, worst,
      auto: held(d, 'preset', F.preset_mode) === 'Auto', osc: !!held(d, 'osc', F.oscillating),
      flow: y.flow === 'dir' ? held(d, 'flow', F.direction) : held(d, 'flow', C.fan_mode),
      night: !on && y.prevNight && st(y.prevNight) ? isOn(y.prevNight) : nightOn,
      sense: held(d, 'sense', val(y.sense)) === 'on', sens: y.sens ? held(d, 'sens', val(y.sens)) : null,
      temp: num(y.temp), rh: num(y.rh), boost: isOn(y.boost), tilt: y.tilt ? isOn(y.tilt) : false };
  },
  acc(y, r) { return y.acc[r.mood] || (r.mood === 'offline' ? '190,194,204' : y.acc.off); },
  title(y, r) {
    if (r.offline) return offWord(y.fan);
    const n = v => v == null ? '--' : Math.round(v);
    if (r.tilt) return 'Tilted';
    return r.mood === 'heating' ? `Heating to ${n(r.tgt)}°` : r.mood === 'warm' ? `Holding ${n(r.tgt)}°`
      : r.mood === 'fan' ? (r.boost ? `Air Boost · Fan ${r.spd}` : `Fan ${r.spd}${r.auto ? ' · Auto' : ''}`) : 'Off';
  },
  sub(y, r) {
    if (r.offline) return 'The unit is not reachable';
    return [r.worst >= 0 ? 'Air ' + AQ_WORD[r.worst] : '', isNaN(r.rh) ? '' : Math.round(r.rh) + '% RH', r.mood === 'fan' || r.mood === 'off' ? '' : 'Fan ' + r.spd].filter(Boolean).join(' · ');
  },
  // The rotor: ten curved glass blades, lit up to the speed, turning faster
  // with it (a turn every max(2.5, 26 - 2.3 x speed) seconds), the frosted
  // hub with the room in it; a soft swirl behind, blade edges hot while heating.
  rotor(y, r, size) {
    const a = this.acc(y, r), hot = r.mood === 'heating';
    let bl = '';
    for (let i = 0; i < 10; i++) {
      const lit = i < r.spd;
      bl += `<path transform="rotate(${i * 36} 100 100)" d="M100 64 C117 52 125 31 113 8 C103 23 95 43 100 64 Z" fill="rgba(${lit ? a : '255,255,255'},${lit ? 0.5 : 0.07})" stroke="${hot && lit ? 'rgba(246,170,112,0.95)' : `rgba(255,255,255,${lit ? 0.6 : 0.2})`}" stroke-width="${size === 'lg' ? 1 : 1.6}"/>`;
    }
    const dur = r.spd ? Math.max(2.5, 26 - r.spd * 2.3).toFixed(1) + 's' : '0s';
    const t = isNaN(r.temp) ? (gone(y.temp) && !r.offline ? '…' : '--') : Math.round(r.temp);
    return `<div class="rotor ${size}${r.spd ? ' spin' : ''}${r.osc && r.spd ? ' osc' : ''}" style="--a:${a};--dur:${dur}">
      ${r.spd ? '<i class="swirl"></i>' : ''}<svg viewBox="0 0 200 200" aria-hidden="true"><g class="rot">${bl}</g></svg>
      <div class="hub"><em>ROOM</em><b>${t}<span>°</span></b></div></div>`;
  },
  fx(y, r, top) {
    const a = this.acc(y, r);
    const fx = r.mood === 'heating' ? { pool: 'breathe', poolA: 0.16, embers: 6 } : r.mood === 'warm' ? { pool: 'breathe', poolA: 0.12 }
      : r.mood === 'fan' ? { air: Math.min(9, 2 + Math.round(r.spd / 1.5)), pool: 'drift', poolA: 0.08 } : {};
    if (r.worst >= 1 && !r.offline) fx.motes = 4 + r.worst * 3;
    return skyHTML(y.skies[r.mood] || y.skies.off, a, { ...fx, seed: 41 }, top);
  },
  speedStep(y, r, bare) {
    return stepHTML('SPEED', r.on ? r.spd + (r.auto ? ' · Auto' : '') : 'Off', r.spd * 10, { bare, a: 'spd', dis: r.offline, atMin: r.spd <= 1, atMax: r.spd >= 10 });
  },

  mount(el) {
    el.innerHTML = DYSONS.map(y => cardHTML('dyson:' + y.id, `
      <div class="dg-top"><div data-r="hero"></div><div class="dg-info" data-r="info"></div></div>
      <div class="dg-ctl"><div data-r="pwr"></div><i class="hair"></i><div class="dg-tgt" data-r="tgt"></div></div>`)).join('');
  },
  render() {
    let n = 0, heat = 0;
    for (const y of DYSONS) {
      const card = this.el.querySelector(`[data-dv="dyson:${y.id}"]`), r = this.read(y), R = k => card.querySelector(`[data-r="${k}"]`), a = this.acc(y, r);
      if (r.on) n++; if (r.mood === 'heating') heat++;
      put(R('fx'), this.fx(y, r, 60));
      put(R('hero'), this.rotor(y, r, 'sm'));
      const chip = r.worst >= 0 ? `<div class="alerts"><span class="alert aq" style="--aq:${AQ_RGB[r.worst]}"><i></i>Air ${AQ_WORD[r.worst]}</span></div>` : '';
      put(R('info'), infoHTML2(y.name, this.title(y, r), this.sub(y, r).replace(/^Air [^·]+· ?/, ''), r.offline ? '' : chip));
      put(R('pwr'), pwrBtn(r.on, a, (r.on ? 'Turn off' : 'Turn on') + ' ' + y.name, { dis: r.offline, wait: tWaiting(r.d, 'power') }));
      put(R('tgt'), this.speedStep(y, r, true));
      card.classList.toggle('offline', r.offline);
      shadow(card, a);
    }
    this.sum = [n ? n + ' running' : '', heat ? heat + ' heating' : ''].filter(Boolean).join(' · ') || 'Off';
  },
  sheet(id) {
    const y = DYSONS.find(x => x.id === id), r = this.read(y), a = this.acc(y, r), tint = r.mood === 'off' ? '48,209,88' : a;
    const words = { heating: 'Heat · Active', warm: 'Heat · Holding', fan: r.boost ? 'Air Boost' : `Fan ${r.spd}${r.auto ? ' · Auto' : ''}`, off: 'Off', offline: 'Offline' };
    const C = r.C, modes = ['off', 'cool', 'heat'].filter(m => !Array.isArray(C.hvac_modes) || C.hvac_modes.includes(m));
    const lo = Number.isFinite(C.min_temp) ? C.min_temp : 34, hi = Number.isFinite(C.max_temp) ? C.max_temp : 98;
    const aqTiles = r.bands.map(([k, v, b]) => [`<span class="aqk">${b >= 0 ? `<i style="background:rgb(${AQ_RGB[b]})"></i>` : ''}${k}</span>`, isNaN(v) ? '—' : nf(v, v % 1 ? 1 : 0)]);
    const fl = num(y.filter), armedReset = isArmed('dyreset' + id);
    return {
      title: y.name, accent: a, fx: this.fx(y, r, 150), pill: pillHTML2(r.tilt ? 'Tilted' : words[r.mood]),
      parts: [
        ['hero', `<div class="uhero">${this.rotor(y, r, 'lg')}<div class="dg-title">${this.title(y, r)}</div><div class="dg-sub">${this.sub(y, r)}</div></div>`],
        ['spd', lbl('SPEED') + segHTML('rail', Array.from({ length: 10 }, (_, i) => [i + 1, i + 1]), r.on ? r.spd : null, { cls: 'rail', dis: r.offline, wait: tWaiting(r.d, 'pct') })],
        ['power', grp(swRow('power', 'Power', 'power', r.on, tint, { dis: r.offline, wait: tWaiting(r.d, 'power') }), true)],
        r.hv != null ? ['mode', lbl('MODE') + segHTML('hvac', modes.map(m => [m, { off: 'Off', cool: 'Cool', heat: 'Heat' }[m]]), r.hv, { dis: r.offline, wait: tWaiting(r.d, 'hvac') })] : null,
        r.hv === 'heat' ? ['heat', stepHTML('HEAT TO', r.tgt == null ? '--' : Math.round(r.tgt) + '°', r.tgt == null ? 0 : (r.tgt - lo) / (hi - lo) * 100, { a: 'hstep', cls: 'pad', dis: r.offline, atMin: r.tgt <= lo, atMax: r.tgt >= hi })] : null,
        ['preset', lbl('CONTROL') + segHTML('preset', [['Auto', 'Auto'], ['Normal', 'Manual']], r.auto ? 'Auto' : 'Normal', { dis: r.offline || !r.on, wait: tWaiting(r.d, 'preset') })],
        ['flow', lbl('AIRFLOW') + (y.flow === 'dir'
          ? segHTML('flow', [['forward', 'Front'], ['reverse', 'Back']], r.flow, { dis: r.offline || !r.on, wait: tWaiting(r.d, 'flow') })
          : segHTML('flow', [['focus', 'Focus'], ['diffuse', 'Diffuse']], r.flow, { dis: r.offline || gone(y.clim), wait: tWaiting(r.d, 'flow') }))],
        ['feat', lbl('FEATURES') + grp(swRow('osc', 'Swing', 'swing', r.osc, a, { dis: r.offline || !r.on, wait: tWaiting(r.d, 'osc') })
          + swRow('night', 'Night mode', 'night', r.night, a, { dis: gone(y.night), wait: tWaiting(r.d, 'night'), sub: !r.on && y.prevNight ? 'As it will be when it turns on' : '' })
          + swRow('sense', 'Sensing', 'eye', r.sense, a, { dis: gone(y.sense), wait: tWaiting(r.d, 'sense'), sub: 'Keeps reading the air while off' }))],
        y.sens ? ['sens', lbl('AIR SENSITIVITY') + segHTML('sens', DY_SENS, r.sens, { dis: gone(y.sens), wait: tWaiting(r.d, 'sens') })] : null,
        ['aq', lbl('AIR QUALITY' + (r.worst >= 0 ? ' · ' + AQ_WORD[r.worst].toUpperCase() : '')) + grp(statsHTML(aqTiles))],
        (() => {
          const w = dysonW(y), heat = num(y.heated), run = num(y.runtime);
          // Home Assistant's own daily meter for this unit; before it exists, the same sum from today's hours.
          const today = estToday(y.id) ?? (isNaN(heat) ? null : heat * 1.5 + Math.max(0, (isNaN(run) ? 0 : run) - heat) * 0.006);
          return energyPart([['NOW', fmtW(w)], ['TODAY', fmtKwh(today)]], true, '1,500 W while the element heats, 6 W while only the fan runs (measured at a low speed).');
        })(),
        ['read', lbl('READINGS') + grp(
          readRow('filter', y.filterName || 'Filter', isNaN(fl) ? '—' : Math.round(fl) + '%', fl <= 10 ? 'due' : '')
          + (y.carbon ? readRow('filter', 'Carbon filter', isNaN(num(y.carbon)) ? '—' : Math.round(num(y.carbon)) + '%') : '')
          + (y.tilt ? readRow('tilt', 'Position', r.tilt ? 'Tilted' : 'Upright', r.tilt ? 'due' : '') : '')
          + readRow('timer', 'Running today', hm(num(y.runtime)))
          + readRow('fire', 'Heating today', hm(num(y.heated)))
          + (y.reset ? actRow('reset', armedReset ? 'Tap again to reset the filter to 100%' : 'Reset filter life', 'filter', { warn: armedReset, dis: unav(y.reset) }) : ''))],
      ],
    };
  },
  act(id, a, b) {
    const y = DYSONS.find(x => x.id === id), r = this.read(y), d = r.d;
    const send = (f, dom, svc, data, v) => { tset(d, f, v); render(); return tsend(d, dom, svc, data, [f]); };
    if (a === 'power') return send('power', 'fan', r.on ? 'turn_off' : 'turn_on', { entity_id: y.fan }, r.on ? 'off' : 'on');
    if (a === 'spd' || a === 'rail') {
      const s = a === 'rail' ? Number(b.dataset.v) : Math.max(1, Math.min(10, (r.on ? r.spd : 0) + Number(b.dataset.v)));
      if (r.on && s === r.spd) return;
      tset(d, 'pct', s * 10); tset(d, 'power', 'on'); render();
      return later('dy' + id, () => tsend(d, 'fan', 'set_percentage', { entity_id: y.fan, percentage: this.read(y).pct }, ['pct', 'power']), a === 'rail' ? 0 : 600);
    }
    if (a === 'hvac') { if (r.hv !== b.dataset.v) send('hvac', 'climate', 'set_hvac_mode', { entity_id: y.clim, hvac_mode: b.dataset.v }, b.dataset.v); return; }
    if (a === 'hstep') {
      const base = r.tgt == null ? 70 : Math.round(r.tgt);
      tset(d, 'temperature', base + Number(b.dataset.v)); render();
      return later('dyh' + id, () => tsend(d, 'climate', 'set_temperature', { entity_id: y.clim, temperature: Math.round(this.read(y).tgt) }, ['temperature']));
    }
    if (a === 'preset') { if ((r.auto ? 'Auto' : 'Normal') !== b.dataset.v) send('preset', 'fan', 'set_preset_mode', { entity_id: y.fan, preset_mode: b.dataset.v }, b.dataset.v); return; }
    if (a === 'flow') {
      if (r.flow === b.dataset.v) return;
      return y.flow === 'dir' ? send('flow', 'fan', 'set_direction', { entity_id: y.fan, direction: b.dataset.v }, b.dataset.v)
        : send('flow', 'climate', 'set_fan_mode', { entity_id: y.clim, fan_mode: b.dataset.v }, b.dataset.v);
    }
    if (a === 'osc') return send('osc', 'fan', 'oscillate', { entity_id: y.fan, oscillating: !r.osc }, !r.osc);
    if (a === 'night') return send('night', 'switch', 'toggle', { entity_id: y.night }, val(y.night) === 'on' ? 'off' : 'on');
    if (a === 'sense') return send('sense', 'switch', 'toggle', { entity_id: y.sense }, r.sense ? 'off' : 'on');
    if (a === 'sens') { if (r.sens !== b.dataset.v) send('sens', 'select', 'select_option', { entity_id: y.sens, option: b.dataset.v }, b.dataset.v); return; }
    if (a === 'reset') { if (twice('dyreset' + id)) { fire(y.name, 'button', 'press', { entity_id: y.reset }); toast(`${y.name}: filter life reset`); } }
  },

  samples: e => ({
    'fan.sofias_dyson': e('on', { percentage: 40, percentage_step: 10, preset_mode: 'Auto', preset_modes: ['Auto', 'Normal'], oscillating: true }),
    'climate.sofias_dyson': e('cool', { hvac_modes: ['off', 'cool', 'heat'], hvac_action: 'idle', current_temperature: 71, temperature: 70, fan_mode: 'diffuse', fan_modes: ['focus', 'diffuse'], min_temp: 34, max_temp: 98 }),
    'sensor.sofias_dyson_temperature': e(71, { unit_of_measurement: '°F' }), 'sensor.sofias_dyson_humidity': e(44, { unit_of_measurement: '%' }),
    'sensor.sofias_dyson_air_quality_index': e(2), 'sensor.sofias_dyson_volatile_organic_compounds_index': e(4),
    'switch.sofias_dyson_night_mode': e('off'), 'input_boolean.sofia_s_dyson_previous_night': e('off'), 'switch.sofias_dyson_continuous_monitoring': e('on'),
    'select.sofias_dyson_air_quality': e('Default', { options: DY_SENS.map(x => x[0]) }), 'sensor.sofias_dyson_filter_life_percent': e(62, { unit_of_measurement: '%' }),
    'button.sofias_dyson_reset_filter_life': e('unknown'), 'sensor.sofias_dyson_runtime_today': e(3.4), 'binary_sensor.sofias_dyson_tilt': e('off'),
    'sensor.sofias_dyson_heated_today': e(0), 'input_boolean.signal_dyson_sofia_boost': e('off'),
    'fan.olivia_s_bedroom_olivias_dyson': e('on', { percentage: 30, percentage_step: 10, preset_mode: 'Normal', preset_modes: ['Auto', 'Normal'], oscillating: false }),
    'climate.olivia_s_bedroom_olivias_dyson': e('heat', { hvac_modes: ['off', 'cool', 'heat'], hvac_action: 'heating', current_temperature: 67, temperature: 72, fan_mode: 'focus', fan_modes: ['focus', 'diffuse'], min_temp: 34, max_temp: 98 }),
    'sensor.olivia_s_bedroom_olivias_dyson_temperature': e(67, { unit_of_measurement: '°F' }), 'sensor.olivia_s_bedroom_olivias_dyson_humidity': e(39, { unit_of_measurement: '%' }),
    'sensor.olivia_s_bedroom_olivias_dyson_air_quality_index': e(1), 'sensor.olivia_s_bedroom_olivias_dyson_volatile_organic_compounds_index': e(2),
    'switch.olivia_s_bedroom_olivias_dyson_night_mode': e('on'), 'input_boolean.olivia_s_dyson_previous_night': e('on'), 'switch.olivia_s_bedroom_olivias_dyson_continuous_monitoring': e('on'),
    'select.olivia_s_bedroom_olivias_dyson_air_quality': e('Sensitive', { options: DY_SENS.map(x => x[0]) }), 'sensor.olivias_dyson_filter_life_percent': e(8, { unit_of_measurement: '%' }),
    'button.olivia_s_bedroom_olivias_dyson_reset_filter_life': e('unknown'), 'sensor.olivias_dyson_runtime_today': e(6.2), 'binary_sensor.olivia_s_bedroom_olivias_dyson_tilt': e('off'),
    'sensor.olivias_dyson_heated_today': e(2.1), 'input_boolean.signal_dyson_olivia_boost': e('off'),
    'fan.m_d_dyson': e('off', { percentage: 50, percentage_step: 10, preset_mode: 'Normal', preset_modes: ['Auto', 'Normal'], oscillating: false, direction: 'forward' }),
    'climate.m_d_dyson': e('off', { hvac_modes: ['off', 'cool', 'heat'], hvac_action: 'off', current_temperature: 69, temperature: 70, min_temp: 34, max_temp: 98 }),
    'sensor.m_d_dyson_temperature': e(69, { unit_of_measurement: '°F' }), 'sensor.m_d_dyson_humidity': e(47, { unit_of_measurement: '%' }),
    'sensor.m_d_dyson_pm_2_5': e(14, { unit_of_measurement: 'µg/m³' }), 'sensor.m_d_dyson_pm_10': e(18, { unit_of_measurement: 'µg/m³' }),
    'sensor.m_d_dyson_nitrogen_dioxide_index': e(1), 'sensor.m_d_dyson_volatile_organic_compounds_index': e(3),
    'switch.m_d_dyson_night_mode': e('off'), 'switch.m_d_dyson_continuous_monitoring': e('off'),
    'sensor.m_d_dyson_hepa_filter_life': e(71, { unit_of_measurement: '%' }), 'sensor.m_d_dyson_carbon_filter_life': e(55, { unit_of_measurement: '%' }),
    'sensor.md_dyson_runtime_today': e(0.5), 'sensor.md_dyson_heated_today': e(0), 'input_boolean.signal_dyson_md_boost': e('off'),
  }),
  // The climate side runs the fan: in the preview, Heat or Cool turns it on.
  preview(domain, service, d) {
    const y = DYSONS.find(x => x.clim === d.entity_id); if (!y || service !== 'set_hvac_mode') return false;
    const C = st(y.clim).attributes, cur = num(y.temp);
    patchEnt(y.clim, d.hvac_mode, { hvac_action: d.hvac_mode === 'heat' ? (cur < C.temperature ? 'heating' : 'idle') : d.hvac_mode === 'off' ? 'off' : 'idle' });
    if (d.hvac_mode !== 'off') patchEnt(y.fan, 'on');
    return true;
  },
});
