// HEATERS: the Signal dashboard's HT1 "Ember" card (ha-config,
// views_signal/climate.yaml, the ht_* anchors) in this app's layout. Same
// rules: the units have no room thermometer, so the hero is the target
// ("HEAT TO"); heating means drawing over 20 W (the climate entity never
// says), otherwise on is "holding"; seven glass fins fill 88% on High, 52% on
// Low, 18% while holding. Level is a select: '2' is High, anything else Low.
// The target is 50-86 and moves by 1.
'use strict';
const HEATERS = [
  { id: 'of', name: 'Office Heater', ent: 'climate.office_heater', power: 'sensor.office_heater_power', level: 'select.office_heater_temperature_level',
    lock: 'switch.office_heater_child_lock', light: 'light.office_heater_backlight', heated: 'sensor.office_heater_heated_today', energy: 'sensor.office_heater_daily_energy',
    skies: { off: grad('#19191C', '#23232A', '#34343D'), holding: grad('#1F1B1A', '#2B2523', '#413632'), heating: grad('#221A17', '#36251F', '#5A3A2D'), offline: grad('#18181A', '#202024', '#2C2C31') },
    acc: { off: '196,198,206', holding: '226,190,164', heating: '255,174,122', offline: '180,182,190' } },
  { id: 'md', name: 'M&D Heater', ent: 'climate.mum_dad_heater', power: 'sensor.mum_dad_heater_power', level: 'select.mum_dad_heater_temperature_level',
    lock: 'switch.mum_dad_heater_child_lock', light: 'light.mum_dad_heater_backlight', heated: 'sensor.md_heater_heated_today', energy: 'sensor.md_heater_daily_energy',
    skies: { off: grad('#1A191B', '#242328', '#36343B'), holding: grad('#1F1A1C', '#2B2426', '#413437'), heating: grad('#221819', '#362224', '#5A3438'), offline: grad('#18181A', '#202024', '#2C2C31') },
    acc: { off: '198,196,204', holding: '224,184,178', heating: '250,160,146', offline: '180,182,190' } },
];
const HT_LO = 50, HT_HI = 86;

const heaters = family({
  id: 'heat', name: 'Heaters', icon: 'heater', group: 'Climate', order: 2,

  read(h) {
    const d = dv('heat', h.id, h.name), e = st(h.ent), A = e ? e.attributes : {};
    const offline = gone(h.ent);
    const s = offline ? 'unavailable' : held(d, 'mode', e.state);
    const w = num(h.power);
    const high = held(d, 'level', val(h.level)) === '2';
    const tgt = held(d, 'temperature', A.temperature);
    const mood = offline ? 'offline' : s === 'off' ? 'off' : w > 20 ? 'heating' : 'holding';
    return { d, e, s, w, high, tgt, mood, offline, on: !offline && s !== 'off', lock: held(d, 'lock', val(h.lock)) === 'on', back: held(d, 'light', val(h.light)) === 'on' };
  },
  title(h, r) {
    if (r.offline) return offWord(h.ent);
    return r.mood === 'off' ? 'Off' : r.mood === 'heating' ? `Heating · ${Math.round(r.w)} W` : 'Holding at target';
  },
  // Seven fins, filled to the level; the target in front of them.
  fins(h, r, size) {
    const a = h.acc[r.mood], fill = r.mood === 'heating' ? (r.high ? 88 : 52) : r.mood === 'holding' ? 18 : 0;
    let f = '';
    for (let i = 0; i < 7; i++) f += `<i style="--f:${fill}%;--d:${(i * 0.18).toFixed(2)}s"></i>`;
    return `<div class="fins ${size}${r.mood === 'heating' ? ' hot' : ''}" style="--a:${a}">
      <div class="fin-row">${f}</div>
      <div class="glass"><div class="dg-num">${r.tgt == null ? '--' : Math.round(r.tgt)}<span>°</span></div><div class="dg-lbl">HEAT TO</div></div></div>`;
  },
  fx(h, r, top) {
    const a = h.acc[r.mood];
    const fx = r.mood === 'heating' ? { pool: 'breathe', poolA: 0.16, embers: r.high ? 8 : 4 } : r.mood === 'holding' ? { pool: 'breathe', poolA: 0.10 } : {};
    return skyHTML(h.skies[r.mood] || h.skies.off, a, fx, top);
  },
  step(h, r, bare) {
    const v = r.tgt;
    return stepHTML('TARGET', v == null ? '--' : Math.round(v) + '°', v == null ? 0 : (v - HT_LO) / (HT_HI - HT_LO) * 100,
      { bare, dis: !r.on, atMin: v != null && v <= HT_LO, atMax: v != null && v >= HT_HI });
  },

  mount(el) {
    el.innerHTML = HEATERS.map(h => cardHTML('heat:' + h.id, `
      <div class="dg-top"><div data-r="hero"></div><div class="dg-info" data-r="info"></div></div>
      <div class="dg-ctl"><div data-r="pwr"></div><i class="hair"></i><div class="dg-tgt" data-r="tgt"></div></div>`)).join('');
  },
  render() {
    let n = 0;
    for (const h of HEATERS) {
      const card = this.el.querySelector(`[data-dv="heat:${h.id}"]`), r = this.read(h), R = k => card.querySelector(`[data-r="${k}"]`);
      if (r.mood === 'heating') n++;
      put(R('fx'), this.fx(h, r, 60));
      put(R('hero'), this.fins(h, r, 'sm'));
      put(R('info'), infoHTML2(h.name, this.title(h, r), r.offline ? 'The heater is not reachable' : [r.high ? 'High' : 'Low', r.lock ? 'Locked' : ''].filter(Boolean).join(' · ')));
      put(R('pwr'), pwrBtn(r.on, h.acc[r.mood], (r.on ? 'Turn off' : 'Turn on') + ' the ' + h.name, { dis: r.offline, wait: tWaiting(r.d, 'mode') }));
      put(R('tgt'), this.step(h, r, true));
      card.classList.toggle('offline', r.offline);
      shadow(card, h.acc[r.mood]);
    }
    this.sum = n ? n + ' heating' : HEATERS.some(h => this.read(h).on) ? 'Holding' : 'Off';
  },
  sheet(id) {
    const h = HEATERS.find(x => x.id === id), r = this.read(h), a = h.acc[r.mood];
    const pill = r.offline ? 'Offline' : r.mood === 'off' ? 'Off' : r.mood === 'heating' ? 'Heat · Active' : 'Heat · Holding';
    return {
      title: h.name, accent: a, fx: this.fx(h, r, 150),
      pill: pillHTML2(pill + (r.lock ? ' · ' + svg('lock', 12).replace('<svg', '<svg style="display:inline;vertical-align:-1px"') : '')),
      parts: [
        ['hero', `<div class="uhero">${this.fins(h, r, 'lg')}<div class="dg-title">${this.title(h, r)}</div><div class="dg-sub">${r.offline ? 'The heater is not reachable' : (r.high ? 'High' : 'Low') + ' · it has no thermometer, so it heats to the target by its own sensor'}</div></div>`],
        ['tgt', this.step(h, r)],
        ['power', grp(swRow('power', 'Power', 'power', r.on, a === h.acc.off ? '48,209,88' : a, { dis: r.offline, wait: tWaiting(r.d, 'mode') }), true)],
        ['level', lbl('LEVEL') + segHTML('level', [['1', 'Low'], ['2', 'High']], r.high ? '2' : '1', { dis: r.offline || gone(h.level), wait: tWaiting(r.d, 'level') })],
        ['feat', lbl('FEATURES') + grp(swRow('lock', 'Child lock', r.lock ? 'lock' : 'lockOpen', r.lock, a, { dis: gone(h.lock), wait: tWaiting(r.d, 'lock') })
          + swRow('light', 'Backlight', 'lightbulb', r.back, a, { dis: gone(h.light), wait: tWaiting(r.d, 'light') }))],
        ['read', lbl('READINGS') + grp(statsHTML([['NOW', watts(h.power)], ['HEATED TODAY', hm(num(h.heated))], ['TODAY', kwh(h.energy)]]))],
      ],
    };
  },
  act(id, a, b) {
    const h = HEATERS.find(x => x.id === id), r = this.read(h), d = r.d;
    if (a === 'power') { const m = r.on ? 'off' : 'heat'; tset(d, 'mode', m); render(); return tsend(d, 'climate', 'set_hvac_mode', { entity_id: h.ent, hvac_mode: m }, ['mode']); }
    if (a === 'step') {
      const base = r.tgt == null ? 69 : Math.round(r.tgt), v = Math.max(HT_LO, Math.min(HT_HI, base + Number(b.dataset.v)));
      if (v === base) return;
      tset(d, 'temperature', v); render();
      return later('heat' + id, () => tsend(d, 'climate', 'set_temperature', { entity_id: h.ent, temperature: Math.round(this.read(h).tgt) }, ['temperature']));
    }
    if (a === 'level') { if ((r.high ? '2' : '1') === b.dataset.v) return; tset(d, 'level', b.dataset.v); render(); return tsend(d, 'select', 'select_option', { entity_id: h.level, option: b.dataset.v }, ['level']); }
    if (a === 'lock') { tset(d, 'lock', r.lock ? 'off' : 'on'); render(); return tsend(d, 'switch', 'toggle', { entity_id: h.lock }, ['lock']); }
    if (a === 'light') { tset(d, 'light', r.back ? 'off' : 'on'); render(); return tsend(d, 'light', 'toggle', { entity_id: h.light }, ['light']); }
  },

  samples: e => ({
    'climate.office_heater': e('heat', { hvac_modes: ['off', 'heat'], temperature: 70, min_temp: 50, max_temp: 86 }),
    'sensor.office_heater_power': e(1460, { unit_of_measurement: 'W' }),
    'select.office_heater_temperature_level': e('2', { options: ['1', '2'] }),
    'switch.office_heater_child_lock': e('on'), 'light.office_heater_backlight': e('on', { brightness: 255 }),
    'sensor.office_heater_heated_today': e(1.6, { unit_of_measurement: 'h' }), 'sensor.office_heater_daily_energy': e(2.31, { unit_of_measurement: 'kWh' }),
    'climate.mum_dad_heater': e('off', { hvac_modes: ['off', 'heat'], temperature: 66, min_temp: 50, max_temp: 86 }),
    'sensor.mum_dad_heater_power': e(0.4, { unit_of_measurement: 'W' }),
    'select.mum_dad_heater_temperature_level': e('1', { options: ['1', '2'] }),
    'switch.mum_dad_heater_child_lock': e('off'), 'light.mum_dad_heater_backlight': e('off'),
    'sensor.md_heater_heated_today': e(0.4, { unit_of_measurement: 'h' }), 'sensor.md_heater_daily_energy': e(0.52, { unit_of_measurement: 'kWh' }),
  }),
  // In the preview the plug follows the heater: about 1450 W on High, 750 on Low.
  preview(domain, service, d) {
    const h = HEATERS.find(x => x.ent === d.entity_id || x.level === d.entity_id); if (!h) return false;
    if (service === 'set_hvac_mode') patchEnt(h.ent, d.hvac_mode);
    else if (service === 'select_option') patchEnt(h.level, d.option);
    else if (service === 'set_temperature') patchEnt(h.ent, null, { temperature: d.temperature });
    else return false;
    patchEnt(h.power, val(h.ent) === 'off' ? 0.4 : val(h.level) === '2' ? 1460 : 750);
    return true;
  },
});
