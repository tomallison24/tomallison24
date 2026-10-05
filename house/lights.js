// LIGHTS: the Signal dashboard's Lights view (ha-config,
// views_signal/lights.yaml) - the LP1 "Halo" pill per light, rooms as fold
// bars, and the whole-house On | Off pill - in this app's layout. Same rules:
//   - every light shares one warm colour (255,224,178), whatever its own:
//     the dashboard tinted each by its rgb_color; this keeps the view as one
//   - the halo round the badge grows with the brightness (k = .35 + .65 x it)
//   - preset chips 1 / 25 / 50 / 75 / 100, lit within 2% (25 reads back 25.1)
//   - the Fireplace socket is on / off only
//   - the room's disc turns the whole room off if anything in it is on, else on
//   - All lights leaves out the outdoor lights, the garage and the heaters'
//     backlights, as the dashboard's list does
//   - the TV strip has the dashboard's swatches; White sends `white` at the
//     current brightness (so it doesn't jump to full), Custom runs
//     script.signal_tv_strip_custom_color (the last colour held 3 s that was
//     not a preset, kept in input_text.signal_tv_strip_custom_hs)
// The groups are helpers in Home Assistant, so a group's members are read from
// its entity_id attribute, falling back to the dashboard's drawer lists.
'use strict';
const L_ROOMS = [
  { id: 'living', name: 'Living Room', icon: 'sofa', lights: [
    ['light.floor_lamps', 'Floor Lamps', ['light.floor_lamp_1', 'light.floor_lamp_2']],
    ['light.morocco', 'Morocco', ['light.morocco_1', 'light.morocco_2', 'light.morocco_3']],
    ['light.living_room_fireplace_lights_socket', 'Fireplace', null, 'onoff'],
    ['light.spotlight', 'Spotlight']] },
  { id: 'lounge', name: 'Lounge', icon: 'tv', lights: [
    ['light.cocktail_main', 'Cocktail Lights', ['light.cocktail_main_1', 'light.cocktail_main_2']],
    ['light.tv_lamps', 'TV Lamps', ['light.tv_lamp_1', 'light.tv_lamp_2']],
    ['light.tian_hao_rgbdeng_dai_kong_zhi_qi_wifi', 'TV Strip', null, 'strip'],
    ['light.bar_main_light_1', 'Bar Main Light'],
    ['light.side_lamps', 'Side Lamps', ['light.side_lamp_1', 'light.side_lamp_2']]] },
  { id: 'kitchen', name: 'Kitchen', icon: 'kitchen', lights: [
    ['light.kitchen', 'Kitchen Lights', ['light.kitchen_1', 'light.kitchen_2', 'light.kitchen_3']],
    ['light.kitchen_fan', 'Kitchen Fan Lights', ['light.kitchen_fan_1', 'light.kitchen_fan_2', 'light.kitchen_fan_3']]] },
  { id: 'sofia', name: "Sofia's Bedroom", icon: 'bed', lights: [['light.sofias_lamp', "Sofia's Lamp"]] },
  { id: 'md', name: 'M&D Bedroom', icon: 'bed', lights: [['light.master_bedroom', 'Bedroom Lamps', ['light.tom_lamp', 'light.elena_lamp']]] },
  { id: 'outdoor', name: 'Outdoor', icon: 'outdoor', lights: [
    ['light.outdoor_front', 'Outdoor Front', ['light.outdoor_front_1', 'light.outdoor_front_2']],
    ['light.garage_door', 'Garage Door Light'],
    ['light.outdoor_deck', 'Outdoor Deck']] },
];
const L_HOUSE = ['light.side_lamps', 'light.floor_lamps', 'light.morocco', 'light.spotlight', 'light.living_room_fireplace_lights_socket', 'light.cocktail_main',
  'light.tv_lamps', 'light.bar_main_light_1', 'light.kitchen', 'light.kitchen_fan', 'light.master_bedroom', 'light.sofias_lamp', 'light.tian_hao_rgbdeng_dai_kong_zhi_qi_wifi'];
const L_NAMES = { 'light.tom_lamp': "Tom's Lamp", 'light.elena_lamp': "Elena's Lamp" };
const L_ALL = {};
for (const r of L_ROOMS) for (const [id, name, members, kind] of r.lights) L_ALL[id] = { id, name, members, kind, room: r.id };
const L_SWATCH = [['white', 'White', '255,255,255', null], ['warm', 'Warm White', '255,217,168', [30, 25]], ['red', 'Red', '255,59,48', [0, 100]],
  ['green', 'Green', '52,199,89', [120, 100]], ['blue', 'Blue', '59,130,246', [220, 100]], ['purple', 'Purple', '168,85,247', [280, 100]]];
const L_STRIP = 'light.tian_hao_rgbdeng_dai_kong_zhi_qi_wifi', L_CUSTOM = 'input_text.signal_tv_strip_custom_hs';
const L_TINT = '255,224,178';
const lfold = () => store.get('lfold') || [];

family({
  id: 'lights', name: 'Lights', icon: 'lightbulb', group: 'Lights', order: 1,

  read(id) {
    const L = L_ALL[id] || { id, name: L_NAMES[id] || id }, d = dv('lights', id, L.name), s = st(id), A = s ? s.attributes : {};
    const offline = gone(id);
    const on = !offline && held(d, 'power', s.state) === 'on';
    const raw = A.brightness != null ? Math.round(A.brightness / 2.55) : null;
    const bri = on ? held(d, 'bri', raw == null ? 100 : raw) : 0;
    // One warm colour for every light (its icon, glow and slider), the room switches' too, so the view reads as one;
    // a light's own colour still shows where it matters, in the TV strip's swatches.
    const pc = L_TINT;
    return { L, d, A, offline, on, bri, raw, pc, hs: A.hs_color, onoff: L.kind === 'onoff' || (Array.isArray(A.supported_color_modes) && A.supported_color_modes.join() === 'onoff') };
  },
  readout(r) { return r.offline ? 'Offline' : r.onoff ? (r.on ? 'On' : 'Off') : r.on ? (r.raw == null && !tWaiting(r.d, 'bri') ? 'On' : Math.round(r.bri) + '%') : 'Off'; },
  members(L) { const a = attr(L.id, 'entity_id'); return Array.isArray(a) && a.length ? a.filter(m => m !== L.id) : L.members || []; },
  // The halo: centred on the badge, stronger with the brightness.
  halo(r, cx = '36px') {
    if (!r.on) return '';
    const k = 0.35 + 0.65 * (r.onoff ? 1 : r.bri / 100);
    return `<i class="lp-halo" style="background:radial-gradient(380px circle at ${cx} 50%, rgba(${r.pc},${(0.46 * k).toFixed(3)}) 0%, rgba(${r.pc},${(0.16 * k).toFixed(3)}) 30%, rgba(${r.pc},0) 62%)"></i>`;
  },
  badge(r, size = 40) {
    const k = 0.35 + 0.65 * (r.onoff ? 1 : r.bri / 100);
    const st2 = !r.on ? '' : size > 50 ? `background:linear-gradient(160deg, rgba(${r.pc},1), rgba(${r.pc},0.72));color:#1A1A1C;box-shadow:0 0 ${(8 + 14 * k).toFixed(0)}px rgba(${r.pc},${(0.45 * k).toFixed(2)}), inset 0 0.5px 0 rgba(255,255,255,0.6)`
      : `background:rgb(${r.pc});color:#1A1A1C;box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.7)`;
    return `<button class="lp-badge${tWaiting(r.d, 'power') ? ' wait' : ''}" data-a="toggle" style="width:${size}px;height:${size}px;${st2}" aria-pressed="${r.on}" aria-label="${r.on ? 'Turn off' : 'Turn on'} ${esc(r.L.name)}"${r.offline ? ' disabled' : ''}>${svg(r.on ? 'lightbulb' : 'lightbulbOff', size > 50 ? 30 : 22)}</button>`;
  },
  pill(id) {
    const r = this.read(id);
    return `${this.badge(r)}<div class="lp-mid"><div class="lp-row"><span class="lp-name">${esc(r.L.name)}</span><span class="lp-val">${this.readout(r)}</span></div>
      ${r.onoff ? '' : sliderHTML('bri', r.bri, 1, 100, 1, { tint: r.pc, cls: 'thin', unit: '%', aria: r.L.name + ' brightness', dis: r.offline })}</div>`;
  },
  roomBar(R) {
    const on = R.lights.filter(([id]) => this.read(id).on).length, n = R.lights.length, folded = lfold().includes(R.id);
    const line = on ? (n === 1 ? 'On' : `${on} of ${n} on`) : n === 1 ? 'Off' : 'All off';
    return `<button class="rb-mid" data-a="fold" aria-expanded="${!folded}" aria-label="${folded ? 'Show' : 'Hide'} the ${esc(R.name)}'s lights"><span class="rb-name">${esc(R.name)}</span><span class="rb-line">${line}</span><span class="rb-chev${folded ? '' : ' open'}">${svg('chev', 18)}</span></button>
      <button class="rb-disc${on ? ' on' : ''}" data-a="room" aria-label="${on ? 'Turn off' : 'Turn on'} the ${esc(R.name)}">${svg(on ? 'lightbulb' : 'lightbulbOff', 20)}</button>`;
  },
  house() {
    const anyOn = L_HOUSE.some(id => this.read(id).on);
    return `<button class="hs-half${anyOn ? ' lit' : ''}" data-a="houseOn">${svg('lightbulb', 20)}All on</button><i class="hs-hair"></i><button class="hs-half${!anyOn ? ' lit off' : ''}" data-a="houseOff">${svg('lightbulbOff', 20)}All off</button>`;
  },

  mount(el) {
    el.innerHTML = `<div class="hsplit" data-dv="lights:house"></div>` + L_ROOMS.map(R => `
      <div class="lroom" data-room="${R.id}">
        <div class="rbar" data-dv="lights:room/${R.id}"></div>
        <div class="lpills">${R.lights.map(([id]) => `<div class="lpw"><i class="lglow"></i><article class="lp dvc" data-dv="lights:${id}"></article></div>`).join('')}</div>
      </div>`).join('');
  },
  render() {
    for (const h of cardsOf('lights:house')) put(h, this.house());
    let n = 0;
    for (const R of L_ROOMS) {
      const box = this.el.querySelector(`[data-room="${R.id}"]`), folded = lfold().includes(R.id);
      put(box.querySelector('.rbar'), this.roomBar(R));
      box.classList.toggle('folded', folded);
      box.classList.toggle('lit', R.lights.some(([id]) => this.read(id).on));
      for (const [id] of R.lights) if (this.read(id).on) n++;
    }
    // Every pane, here and on Favorites (Tom's and Elena's lamps).
    for (const p of document.querySelectorAll('.lp[data-dv^="lights:light."]')) this.paint(p, p.dataset.dv.slice(7));
    this.sum = n ? n + ' on' : 'All off';
  },
  // One light's pane: the pill, and its glow behind the pane (the pane's
  // sibling in its .lpw wrapper).
  paint(p, id) {
    const r = this.read(id);
    put(p, this.pill(id));
    p.classList.toggle('on', r.on); p.classList.toggle('offline', r.offline); p.classList.toggle('onoff', r.onoff);
    // The light comes from the bulb: brightest at the icon, fading with the
    // distance from it (about as light does, the square of it), behind the
    // faint pane. A brighter light reaches further.
    const k = 0.35 + 0.65 * (r.onoff ? 1 : r.bri / 100), glow = p.previousElementSibling;
    const reach = Math.round(150 + 230 * k), c = a => `rgba(${r.pc},${(a * k).toFixed(3)})`;
    glow.style.background = `radial-gradient(circle ${reach}px at 34px 50%, ${c(0.62)} 0%, ${c(0.46)} 9%, ${c(0.28)} 22%, ${c(0.14)} 40%, ${c(0.05)} 66%, ${c(0)} 100%)`;
    glow.style.opacity = r.on ? 1 : 0;
  },

  sheet(id) {
    const r = this.read(id), L = r.L, ms = this.members(L), tint = r.on ? r.pc : '48,209,88';
    const memberRows = ms.map(m => {
      const q = this.read(m), nm = L_NAMES[m] || (attr(m, 'friendly_name') || m.replace(/^light\./, '').replace(/_/g, ' ')).replace(/^\w/, c => c.toUpperCase());
      return `<div class="mrow" data-m="${m}">${swRow('mtoggle', esc(nm), q.on ? 'lightbulb' : 'lightbulbOff', q.on, q.on ? q.pc : '48,209,88', { v: m, dis: q.offline, wait: tWaiting(q.d, 'power') })}
        ${q.onoff ? '' : sliderHTML('mbri', q.bri, 1, 100, 1, { v: m, tint: q.pc, cls: 'thin', unit: '%', aria: nm + ' brightness', dis: q.offline })}</div>`;
    }).join('');
    return {
      title: L.name, accent: r.on ? r.pc : '190,194,204', pill: pillHTML2(this.readout(r), r.on ? r.pc : ''),
      fx: skyHTML(r.on ? grad('#1C1B1A', '#272523', '#3A3633') : grad('#17181A', '#212326', '#33363B'), r.pc, r.on ? { pool: 'breathe', poolA: 0.08 + 0.12 * r.bri / 100 } : {}, 150),
      parts: [
        ['hero', `<div class="uhero lphero">${this.halo(r, '50%')}${this.badge(r, 120)}<div class="dg-title">${r.offline ? offWord(id) : r.on ? (r.onoff ? 'On' : Math.round(r.bri) + '%') : 'Off'}</div></div>`],
        r.onoff ? null : ['bri', sliderHTML('bri', r.bri, 1, 100, 1, { label: 'BRIGHTNESS', shown: r.on ? Math.round(r.bri) + '%' : 'Off', unit: '%', tint: r.pc, dis: r.offline })
          + chipsHTML('chip', [[1, '1%'], [25, '25%'], [50, '50%'], [75, '75%'], [100, '100%']], r.on ? r.bri : null, { near: 2, dis: r.offline })],
        ['power', grp(swRow('toggle', 'Power', 'power', r.on, tint, { dis: r.offline, wait: tWaiting(r.d, 'power') }), true)],
        L.kind === 'strip' ? ['colour', lbl('COLOUR') + this.swatches(r)] : null,
        ms.length ? ['members', lbl('LIGHTS IN THIS GROUP') + `<div class="group">${memberRows}</div>`] : null,
      ],
    };
  },
  // The TV strip's swatches: lit within 12 degrees of hue and 15 of
  // saturation (Tuya rounds what it reports); White by its colour mode.
  stripNow(r) {
    if (!r.on) return null;
    if (r.A.color_mode === 'white') return 'white';
    const hs = r.hs; if (!hs) return null;
    const near = p => { const dh = Math.abs(hs[0] - p[0]) % 360; return Math.min(dh, 360 - dh) <= 12 && Math.abs(hs[1] - p[1]) <= 15; };
    const sw = L_SWATCH.find(s => s[3] && near(s[3]));
    if (sw) return sw[0];
    const c = this.custom(); return c && near(c) ? 'custom' : 'other';
  },
  custom() { const v = val(L_CUSTOM); const m = v && /^\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*$/.exec(v); return m ? [Number(m[1]), Number(m[2])] : null; },
  swatches(r) {
    const now = this.stripNow(r), c = this.custom();
    const one = (k, name, rgb, dashed) => `<button class="swatch${now === k ? ' on' : now ? ' dim' : ''}${dashed ? ' dashed' : ''}" data-a="swatch" data-v="${k}" aria-pressed="${now === k}" aria-label="${name}" style="${rgb ? `--c:${rgb}` : ''}"${r.offline || (k === 'custom' && !c) ? ' disabled' : ''}><i></i><span>${name}</span></button>`;
    return `<div class="swatches nodrag">${L_SWATCH.map(([k, n, rgb]) => one(k, n, rgb)).join('')}${one('custom', 'Custom', c ? hsToRgb(c[0], c[1]).join(',') : '', !c)}</div>
      <p class="tnote">${now === 'other' ? 'Showing a colour set elsewhere. ' : ''}Custom is the last colour you held for 3 seconds that is not one of these.</p>`;
  },

  setPower(id, on, data = {}) {
    const r = this.read(id);
    tset(r.d, 'power', on ? 'on' : 'off');
    if (data.brightness_pct != null) tset(r.d, 'bri', data.brightness_pct);
    render();
    return tsend(r.d, 'light', on ? 'turn_on' : 'turn_off', { entity_id: id, ...data }, data.brightness_pct != null ? ['power', 'bri'] : ['power']);
  },
  setMany(list, on) {
    for (const id of list) tset(this.read(id).d, 'power', on ? 'on' : 'off');
    render();
    const name = list.length > 3 ? 'Lights' : this.read(list[0]).L.name;
    return fire(name, 'light', on ? 'turn_on' : 'turn_off', { entity_id: list });
  },
  act(id, a, b) {
    if (id === 'house') return this.setMany(L_HOUSE, a === 'houseOn');
    if (id.startsWith('room/')) {
      const R = L_ROOMS.find(x => x.id === id.slice(5)), list = R.lights.map(x => x[0]);
      if (a === 'room') return this.setMany(list, !list.some(x => this.read(x).on));
      if (a === 'fold') { const f = lfold(); store.set('lfold', f.includes(R.id) ? f.filter(x => x !== R.id) : [...f, R.id]); return render(); }
      return;
    }
    const r = this.read(id);
    if (a === 'toggle') return this.setPower(id, !r.on);
    if (a === 'chip') return this.setPower(id, true, { brightness_pct: Number(b.dataset.v) });
    if (a === 'mtoggle') return this.setPower(b.dataset.v, !this.read(b.dataset.v).on);
    if (a === 'swatch') {
      const k = b.dataset.v, sw = L_SWATCH.find(s => s[0] === k);
      if (k === 'custom') return fire('TV Strip', 'script', 'turn_on', { entity_id: 'script.signal_tv_strip_custom_color' });
      tset(r.d, 'power', 'on'); render();
      return tsend(r.d, 'light', 'turn_on', k === 'white' ? { entity_id: id, white: r.A.brightness || 255 } : { entity_id: id, hs_color: sw[3] }, ['power']);
    }
  },
  slide(id, a, v, el) {
    if (a === 'bri') return this.setPower(id, true, { brightness_pct: v });
    if (a === 'mbri') return this.setPower(el.dataset.v, true, { brightness_pct: v });
  },

  samples: e => {
    const L = (state, bri, rgb, extra = {}) => e(state, { brightness: state === 'on' ? Math.round(bri * 2.55) : null, rgb_color: state === 'on' ? rgb : null, ...extra });
    const warm = [255, 206, 166], amber = null;
    const grp = (ids, extra) => ({ entity_id: ids, ...extra });
    return {
      'light.floor_lamps': L('on', 62, warm, grp(['light.floor_lamp_1', 'light.floor_lamp_2'])), 'light.floor_lamp_1': L('on', 62, warm), 'light.floor_lamp_2': L('on', 62, warm),
      'light.morocco': L('on', 40, [255, 120, 90], grp(['light.morocco_1', 'light.morocco_2', 'light.morocco_3'], { hs_color: [9, 65] })),
      'light.morocco_1': L('on', 40, [255, 120, 90]), 'light.morocco_2': L('on', 40, [255, 120, 90]), 'light.morocco_3': L('off', 0, null),
      'light.living_room_fireplace_lights_socket': e('on', { supported_color_modes: ['onoff'], color_mode: 'onoff' }),
      'light.spotlight': L('off', 0, warm),
      'light.cocktail_main': L('on', 75, [180, 140, 255], grp(['light.cocktail_main_1', 'light.cocktail_main_2'], { hs_color: [260, 45] })),
      'light.cocktail_main_1': L('on', 75, [180, 140, 255]), 'light.cocktail_main_2': L('on', 75, [180, 140, 255]),
      'light.tv_lamps': L('off', 0, amber, grp(['light.tv_lamp_1', 'light.tv_lamp_2'])), 'light.tv_lamp_1': L('off', 0, amber), 'light.tv_lamp_2': L('off', 0, amber),
      [L_STRIP]: L('on', 50, [59, 130, 246], { hs_color: [220, 100], color_mode: 'hs', supported_color_modes: ['hs', 'white'] }),
      [L_CUSTOM]: e('330,70'),
      'light.bar_main_light_1': L('off', 0, amber),
      'light.side_lamps': L('on', 25, warm, grp(['light.side_lamp_1', 'light.side_lamp_2'])), 'light.side_lamp_1': L('on', 25, warm), 'light.side_lamp_2': L('on', 25, warm),
      'light.kitchen': L('on', 100, [255, 236, 210], grp(['light.kitchen_1', 'light.kitchen_2', 'light.kitchen_3'])),
      'light.kitchen_1': L('on', 100, [255, 236, 210]), 'light.kitchen_2': L('on', 100, [255, 236, 210]), 'light.kitchen_3': L('on', 100, [255, 236, 210]),
      'light.kitchen_fan': L('off', 0, warm, grp(['light.kitchen_fan_1', 'light.kitchen_fan_2', 'light.kitchen_fan_3'])),
      'light.kitchen_fan_1': L('off', 0, warm), 'light.kitchen_fan_2': L('off', 0, warm), 'light.kitchen_fan_3': L('off', 0, warm),
      'light.sofias_lamp': L('on', 18, [255, 190, 140]),
      'light.master_bedroom': L('off', 0, amber, grp(['light.tom_lamp', 'light.elena_lamp'])), 'light.tom_lamp': L('off', 0, amber), 'light.elena_lamp': L('off', 0, amber),
      'light.outdoor_front': L('on', 80, warm, grp(['light.outdoor_front_1', 'light.outdoor_front_2'])), 'light.outdoor_front_1': L('on', 80, warm), 'light.outdoor_front_2': L('on', 80, warm),
      'light.garage_door': L('off', 0, amber), 'light.outdoor_deck': L('off', 0, warm),
    };
  },
  preview(domain, service, d) {
    if (domain === 'script' && d.entity_id === 'script.signal_tv_strip_custom_color') {
      const c = this.custom(); if (c) patchEnt(L_STRIP, 'on', { hs_color: c, rgb_color: hsToRgb(c[0], c[1]), color_mode: 'hs', brightness: attr(L_STRIP, 'brightness') || 128 });
      return true;
    }
    return false;
  },
});
