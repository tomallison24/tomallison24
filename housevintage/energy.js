// ENERGY: how much each device is using, from Home Assistant's own figures
// (ha-config, configuration.yaml), in two places:
//   - each device's popup has an Energy section: what it draws now, and
//     today / this month where Home Assistant keeps a total for that device
//   - each view starts with a strip: its devices' power now, today and this
//     month, from Home Assistant's category totals; tap it for each device's
//     power now
// Only two kinds of number are shown, and each says which it is:
//   METERED - the two heaters (their own power sensors) and the two
//     dehumidifiers (the Tapo plugs; the Cube's still has m_d_dyson ids)
//   ESTIMATED - Home Assistant's formulas, copied here so a device's share can
//     be shown: lights 10 W a bulb (12 W the TV strip) scaled by brightness;
//     the ACs while cooling (Living Room 2710 W, Office 2060 W, Windmill
//     730 W; heating isn't counted - the Living Room's is gas); a Dyson 1500 W while its
//     element heats, else 6 W while the fan runs; the TV 120 W on, 0.5 W off.
// A device Home Assistant does not estimate (the speakers, cameras, vacuums,
// the Hatch, the printer, the outdoor lights) shows no figure at all.
//
// TODAY per device: Home Assistant keeps a daily meter for each estimated
// device (ha-config: sensor.est_<device>_daily_energy, added 2026-10-05) as
// well as for the metered ones; a popup shows it once that sensor exists.
// The Windmill counts while it is inferred to be cooling, here and (since the
// same change) in Home Assistant's climate total.
'use strict';
const KW = 0.13;   // $/kWh, Home Assistant's rate
const fmtW = w => w == null || isNaN(w) ? '—' : w >= 1000 ? String(Number((w / 1000).toFixed(w >= 10000 ? 0 : 2))) + ' kW' : (w < 10 ? Number(w.toFixed(1)) : Math.round(w)) + ' W';
const fmtKwh = (v, d = 2) => v == null || isNaN(v) ? '—' : v.toFixed(d) + ' kWh';

// ---- each device's power now ----
const EST_BULBS = new Set(['light.side_lamp_1', 'light.side_lamp_2', 'light.floor_lamp_1', 'light.floor_lamp_2', 'light.morocco_1', 'light.morocco_2', 'light.morocco_3',
  'light.spotlight', 'light.living_room_fireplace_lights_socket', 'light.cocktail_main_1', 'light.cocktail_main_2', 'light.tv_lamp_1', 'light.tv_lamp_2', 'light.bar_main_light_1',
  'light.kitchen_1', 'light.kitchen_2', 'light.kitchen_3', 'light.kitchen_fan_1', 'light.kitchen_fan_2', 'light.kitchen_fan_3', 'light.elena_lamp', 'light.tom_lamp', 'light.sofias_lamp']);
const EST_STRIP = 'light.tian_hao_rgbdeng_dai_kong_zhi_qi_wifi';
const bulbW = (id, rated) => { if (!isOn(id)) return 0; const b = attr(id, 'brightness'); return rated * (b != null ? b / 255 : 1); };
// A light: its bulbs (a group's members), or null if Home Assistant doesn't estimate it.
function lightW(id) {
  if (id === EST_STRIP) return bulbW(id, 12);
  if (EST_BULBS.has(id)) return bulbW(id, 10);
  const L = L_ALL[id], ms = L && L.members ? L.members.filter(m => EST_BULBS.has(m)) : [];
  return ms.length ? ms.reduce((s, m) => s + bulbW(m, 10), 0) : null;
}
const AC_W = { lr: 2710, of: 2060, wm: 730 };
// Each device's own daily meter in Home Assistant, where it has one.
const EST_KEY = { lr: 'living_room_ac', of: 'office_ac', wm: 'windmill_ac', sofia: 'sofias_dyson', olivia: 'olivias_dyson', md: 'md_dyson',
  'light.floor_lamps': 'floor_lamps', 'light.morocco': 'morocco', 'light.living_room_fireplace_lights_socket': 'fireplace', 'light.spotlight': 'spotlight',
  'light.cocktail_main': 'cocktail_lights', 'light.tv_lamps': 'tv_lamps', 'light.tian_hao_rgbdeng_dai_kong_zhi_qi_wifi': 'tv_strip', 'light.bar_main_light_1': 'bar_main_light',
  'light.side_lamps': 'side_lamps', 'light.kitchen': 'kitchen_lights', 'light.kitchen_fan': 'kitchen_fan_lights', 'light.sofias_lamp': 'sofias_lamp',
  'light.tom_lamp': 'toms_lamp', 'light.elena_lamp': 'elenas_lamp' };
// kWh today, or null where Home Assistant has no meter (yet). Bedroom Lamps is Tom's + Elena's.
function estToday(key) {
  if (key === 'light.master_bedroom') { const a = estToday('light.tom_lamp'), b = estToday('light.elena_lamp'); return a == null || b == null ? null : a + b; }
  const k = EST_KEY[key], id = k && 'sensor.est_' + k + '_daily_energy';
  return id && st(id) && !gone(id) ? num(id) : null;
}
const withToday = (stats, key) => { const t = estToday(key); return t == null ? stats : [...stats, ['TODAY', fmtKwh(t)]]; };
const thermoW = t => { const r = tread(t); return !r.offline && r.act === 'cooling' ? AC_W[t.id] : 0; };
function dysonW(y) {
  if (gone(y.fan) && gone(y.clim)) return null;
  return attr(y.clim, 'hvac_action') === 'heating' ? 1500 : isOn(y.fan) ? 6 : 0;
}
const TV_ENT = 'media_player.65_oled';
const tvW = () => gone(TV_ENT) && !st(TV_ENT) ? null : ['off', 'unavailable', 'unknown'].includes(val(TV_ENT)) ? 0.5 : 120;

// ---- the popup's Energy section ----
// stats: [label, value]; est: the numbers are estimates; note: a line under them.
function energyPart(stats, est, note) {
  return ['energy', `<div class="glbl">ENERGY${est ? ' · ESTIMATED' : ''}</div>` + grp(statsHTML(stats)) + (note ? `<p class="tnote">${note}</p>` : '')];
}
const thermoEnergyHTML = t => {
  const w = thermoW(t);
  return { stats: withToday([['NOW', fmtW(w)]], t.id), note: t.id === 'wm'
    ? 'About 730 W while it cools (8,000 BTU at a typical efficiency), counted while it is inferred to be cooling - it never says so itself.'
    : t.id === 'lr' ? '2,710 W while it cools, from the unit\'s nameplate. Heating is gas and isn\'t counted.'
    : '2,060 W while it cools: the outdoor unit\'s nameplate and an assumed 500 W blower. Heating isn\'t counted in Home Assistant\'s estimate.' };
};

// ---- the strips at the top of each view ----
// Each view's totals are Home Assistant's category sensors; its list is each
// device's power now.
const ESTRIP = {
  fav: { cats: [['sensor.estimated_total_power', 'sensor.total_daily_energy', 'sensor.total_monthly_energy']], what: 'Lighting, climate, fans and dehumidifiers, and the TV' },
  climate: { cats: [['sensor.estimated_climate_power', 'sensor.climate_daily_energy', 'sensor.climate_monthly_energy'],
    ['sensor.estimated_fan_dehumidifier_power', 'sensor.fan_dehumidifier_daily_energy', 'sensor.fan_dehumidifier_monthly_energy']], what: 'Thermostats, heaters, purifiers and dehumidifiers' },
  lights: { cats: [['sensor.estimated_lighting_power', 'sensor.lighting_daily_energy', 'sensor.lighting_monthly_energy']], what: 'Indoor lights (not outdoors or the garage)' },
  media: { cats: [['sensor.estimated_tv_power', 'sensor.tv_daily_energy', 'sensor.tv_monthly_energy']], what: 'The TV (the speakers and Apple TV aren\'t estimated)' },
};
function stripDevices(v) {
  const out = [], add = (name, w, tag = '') => { if (w != null) out.push({ name, w, tag }); };
  if (v === 'fav') {
    add('Lighting', num('sensor.estimated_lighting_power')); add('Climate', num('sensor.estimated_climate_power'));
    add('Fans & dehumidifiers', num('sensor.estimated_fan_dehumidifier_power')); add('TV', num('sensor.estimated_tv_power'));
  } else if (v === 'climate') {
    for (const t of THERMOS) add(t.id === 'wm' ? t.name : t.name + ' AC', thermoW(t), 'est.');
    for (const h of HEATERS) add(h.name, num(h.power), 'metered');
    for (const y of DYSONS) add(y.name, dysonW(y), 'est.');
    for (const u of UNITS) add(u.name + ' Dehumidifier', num(u.pw), 'metered');
  } else if (v === 'lights') {
    for (const id in L_ALL) add(L_ALL[id].name, lightW(id), 'est.');
  } else if (v === 'media') add('Living Room TV', tvW(), 'est.');
  return out.sort((a, b) => b.w - a.w);
}
const stripOpen = {};

family({
  id: 'energy-strips', name: 'Energy', noSection: true,
  render() {
    for (const v in ESTRIP) {
      // A strip at the top of each view that has estimated devices (the views are laid out at start).
      let el = document.querySelector(`.estrip[data-dv="energy-strips:${v}"]`);
      if (!el) { const box = $('g-' + v); if (!box) continue; box.insertAdjacentHTML('afterbegin', `<div class="estrip" data-dv="energy-strips:${v}"></div>`); el = box.firstElementChild; }
      const sum = i => ESTRIP[v].cats.reduce((s, c) => s + (num(c[i]) || 0), 0), any = ESTRIP[v].cats.some(c => !isNaN(num(c[0])));
      const now = any ? sum(0) : null, day = any ? sum(1) : null, month = any ? sum(2) : null, open = !!stripOpen[v];
      const list = open ? stripDevices(v) : [];
      el.classList.toggle('open', open);
      put(el, `<button class="es-row" data-a="toggle" aria-expanded="${open}">
          <span class="es-ic">${svg('lightning', 16)}</span>
          <span class="es-now"><b>${fmtW(now)}</b><small>now</small></span>
          <span class="es-st"><b>${fmtKwh(day, 1)}</b><small>today</small></span>
          <span class="es-st"><b>${fmtKwh(month, 0)}</b><small>${month != null ? '$' + (month * KW).toFixed(2) + ' month' : 'month'}</small></span>
          <span class="es-chev${open ? ' open' : ''}">${svg('chev', 16)}</span></button>
        ${open ? `<div class="es-list">${list.map(x => `<div class="es-item${x.w ? '' : ' idle'}"><span>${esc(x.name)}${x.tag ? `<em>${esc(x.tag)}</em>` : ''}</span><b>${fmtW(x.w)}</b></div>`).join('')}
          <p class="tnote">${ESTRIP[v].what}. Estimates except where metered, at $${KW.toFixed(2)}/kWh.</p></div>` : ''}`);
    }
  },
  act(id, a) { if (a === 'toggle') { stripOpen[id] = !stripOpen[id]; render(); } },
  // The preview's daily meters (kWh so far today).
  samples: e => Object.fromEntries(Object.entries({ floor_lamps: 0.31, morocco: 0.18, fireplace: 0.12, spotlight: 0.02, cocktail_lights: 0.22, tv_lamps: 0.09, tv_strip: 0.05,
    bar_main_light: 0, side_lamps: 0.06, kitchen_lights: 0.41, kitchen_fan_lights: 0.03, sofias_lamp: 0.04, toms_lamp: 0.07, elenas_lamp: 0.11,
    living_room_ac: 2.03, office_ac: 0, windmill_ac: 0.84, sofias_dyson: 0.04, olivias_dyson: 3.17, md_dyson: 0 })
    .map(([k, v]) => ['sensor.est_' + k + '_daily_energy', e(v, { unit_of_measurement: 'kWh' })])),
});
