// FAVORITES: the Signal dashboard's landing view (ha-config,
// views_signal/favorites.yaml) - and this app's, which always opens here.
// What is on the dashboard's, in its order:
//   - Now Playing: a Sonos that is playing (one card per group, its leader's)
//   - Running Now: every device that is doing something, as chips; a tap
//     takes you to it and opens its popup
//   - Automations: Goodnight, Evening Lights, Mom's Awake, Report a Bug,
//     Babysitter, Hatch Green, as Liquid Glass tiles three across (Labs'
//     design D): each tile carries a glow of its colour behind the glass,
//     faint at rest; lit, the tile turns white glass and the glow comes up
//     full. A routine's tile is lit by its
//     acknowledgement helper (input_boolean.signal_*_ack), which its script
//     holds on for 3 s; the tap runs the routine's script with
//     script.turn_on, which returns at once. Babysitter is a mode: the pill
//     is the input_boolean itself and stays lit while it is armed. Hatch
//     Green is script.hatch_bedtime with the green light, lit while it runs.
//     Report a Bug fills the same helpers as the dashboard's form and runs
//     script.log_bug, which appends it to bug_log.md.
//   - Weather: a glass pill over the automations - the condition, the
//     temperature outside (weather.forecast_home) - that opens the AllisonOS
//     Weather app (../weather/, a plain link, as the launcher's own)
//   - Thermostats: Living Room and Office (the Windmill is left out, as on
//     the dashboard)
//   - Cameras: the living room Blink and the doorbell
//   - Lights: All on / All off, and Tom's and Elena's lamps
// The device cards are the same cards as in their own views (the families
// paint every copy), so they look and work the same in both places.
'use strict';
const FAV_AUTOS = [
  { id: 'goodnight', name: 'Goodnight', icon: 'night', acc: '150,160,255', script: 'script.goodnight', ack: 'input_boolean.signal_goodnight_ack' },
  { id: 'evening', name: 'Evening Lights', icon: 'sunset', acc: '255,176,110', script: 'script.evening_lights', ack: 'input_boolean.signal_evening_lights_ack' },
  { id: 'awake', name: "Mom's Awake", icon: 'sun', acc: '255,214,120', script: 'script.moms_awake', ack: 'input_boolean.signal_moms_awake_ack' },
  { id: 'bug', name: 'Report a Bug', icon: 'bug', acc: '190,194,204', form: true },
  { id: 'sitter', name: 'Babysitter', onName: 'Sitter armed', icon: 'child', acc: '255,150,190', toggle: 'input_boolean.babysitter_mode' },
  { id: 'hatch', name: 'Hatch Green', icon: 'nightBulb', acc: '120,220,150', script: 'script.hatch_bedtime', ack: 'script.hatch_bedtime', vars: { light: 'green' } },
];
const FAV_THERMOS = ['lr', 'of'], FAV_CAMS = ['living_room', 'door'], FAV_LAMPS = ['light.tom_lamp', 'light.elena_lamp'];
const famOf = id => FAMILIES.find(f => f.id === id);
// The weather pill: Home Assistant's condition as the Weather app shows it -
// its icon (the night's after sunset), its name, and a glow of its colour.
const FAV_WX = {
  sunny: ['sun', 'Sunny', '255,214,120'], 'clear-night': ['night', 'Clear', '150,160,255'], partlycloudy: ['wxPartly', 'Partly Cloudy', '160,200,255'],
  cloudy: ['wxCloudy', 'Cloudy', '170,182,198'], rainy: ['wxRainy', 'Rain', '120,170,255'], pouring: ['wxPouring', 'Heavy Rain', '110,150,255'],
  snowy: ['wxSnowy', 'Snow', '215,232,255'], 'snowy-rainy': ['wxSleet', 'Sleet', '180,210,255'], fog: ['wxFog', 'Fog', '180,186,196'],
  hail: ['wxHail', 'Hail', '190,215,255'], lightning: ['wxStorm', 'Thunderstorms', '170,150,255'], 'lightning-rainy': ['wxStormRain', 'Thunderstorms', '170,150,255'],
  windy: ['wxWindy', 'Windy', '170,220,210'], 'windy-variant': ['wxWindy', 'Windy', '170,220,210'], exceptional: ['alert', 'Weather alert', '255,170,120'],
};
function favWeather() {
  const w = st('weather.forecast_home');
  if (!w || w.state === 'unavailable' || w.state === 'unknown') return { html: `<span class="wx-ic">${svg('wxCloudy', 26)}</span><span class="wx-t"><b>--°</b><small>Weather</small></span><span class="wx-go">${svg('chevR', 18)}</span>`, c: '170,182,198' };
  const night = val('sun.sun') === 'below_horizon';
  let [ic, word, c] = FAV_WX[w.state] || ['wxCloudy', w.state.replace(/-/g, ' ').replace(/^\w/, x => x.toUpperCase()), '170,182,198'];
  if (night && w.state === 'partlycloudy') ic = 'wxNightPartly';
  if (night && w.state === 'sunny') { ic = 'night'; word = 'Clear'; c = '150,160,255'; }
  const t = Number(w.attributes.temperature), u = w.attributes.temperature_unit || '°';
  return { c, html: `<span class="wx-ic">${svg(ic, 26)}</span><span class="wx-t"><b>${Number.isFinite(t) ? Math.round(t) + (u.includes('C') ? '°C' : '°') : '--°'}</b><small>${esc(word)}</small></span><span class="wx-go">Weather${svg('chevR', 18)}</span>` };
}

family({
  id: 'fav', name: 'Favorites', icon: 'star', group: 'Favorites', order: 1,
  sev: 'Medium', run: [],

  mount(el) {
    const cams = famOf('cams');
    el.classList.add('favs');
    el.innerHTML = `
      <div class="fnp" data-r="np"></div>
      <div class="runpanel" data-r="run" hidden></div>
      <div class="vsec-h"><span>Automations</span></div>
      <div class="agw wxw" data-r="wxw"><i class="ag-glow"></i><a class="wxpill" data-r="wx" href="../weather/" aria-label="Open Weather"></a></div>
      <div class="autos" data-dv="fav:autos"></div>
      <div class="vsec-h"><span>Thermostats</span></div>
      <div class="fcards">${THERMOS.filter(t => FAV_THERMOS.includes(t.id)).map(tCardHTML).join('')}</div>
      <div class="vsec-h"><span>Cameras</span></div>
      <div class="fcards">${FAV_CAMS.map(c => cams.shell(c)).join('')}</div>
      <div class="vsec-h"><span>Lights</span></div>
      <div class="hsplit" data-dv="lights:house"></div>
      <div class="lpills">${FAV_LAMPS.map(id => `<div class="lpw"><i class="lglow"></i><article class="lp dvc" data-dv="lights:${id}"></article></div>`).join('')}</div>`;
  },

  // What is running, from each family's own reading of it.
  running() {
    const out = [], heat = famOf('heat'), dy = famOf('dyson'), vac = famOf('vac');
    for (const t of THERMOS) {
      const r = tread(t);
      if (!r.offline && (r.act === 'heating' || r.act === 'cooling' || r.mood === 'fan'))
        out.push({ name: t.name, word: r.act === 'heating' ? 'Heating' : r.act === 'cooling' ? 'Cooling' : 'Fan', rgb: T_ACC[r.mood], view: 'climate', open: () => openThermo(t.id) });
    }
    for (const h of HEATERS) { const r = heat.read(h); if (r.mood === 'heating') out.push({ name: h.name, word: 'Heating', rgb: h.acc.heating, view: 'climate', open: () => openDev(heat, h.id) }); }
    for (const y of DYSONS) { const r = dy.read(y); if (r.on) out.push({ name: y.name, word: r.mood === 'heating' ? 'Heating' : 'Fan ' + r.spd, rgb: dy.acc(y, r), view: 'climate', open: () => openDev(dy, y.id) }); }
    for (const u of UNITS) { const r = read(u); if (r.on) out.push({ name: u.name, word: r.mood === 'drying' ? 'Drying' : r.mood === 'full' ? 'Tank full' : 'Holding', rgb: u.accents[r.mood] || u.accents.holding, view: 'climate', open: () => openUnit(u.id) }); }
    for (const v of VACS) { const r = vac.read(v); if (r.mood === 'cleaning' || r.mood === 'returning') out.push({ name: v.name, word: V_WORD[r.mood], rgb: V_ACC[r.mood], view: 'around', open: () => openDev(vac, v.id) }); }
    return out;
  },
  autoState(a) {
    const d = dv('fav', a.id, a.name);
    if (a.toggle) return { d, lit: held(d, 'on', val(a.toggle)) === 'on', dis: gone(a.toggle) };
    if (a.ack) return { d, lit: held(d, 'lit', val(a.ack)) === 'on', dis: !st(a.script) || val(a.script) === 'unavailable' };
    return { d, lit: false, dis: false };
  },

  render() {
    // Now Playing: one card per playing group, its leader's.
    const sp = famOf('speakers');
    const playing = SPEAKERS.filter(p => { const r = sp.read(p); return r.playing && !r.tv && r.group[0] === p.ent; }).slice(0, 2);
    const np = this.el.querySelector('[data-r="np"]');
    put(np, playing.map(p => sp.shell(p)).join(''));
    for (const card of np.querySelectorAll('.dvc')) sp.paint(card, SPEAKERS.find(p => card.dataset.dv === 'speakers:' + p.id));

    this.run = this.running();
    const run = this.el.querySelector('[data-r="run"]');
    run.hidden = !this.run.length;
    put(run, `<div class="run-h"><i></i>RUNNING NOW<span>${this.run.length}</span></div><div class="runchips">${this.run.map((x, i) =>
      `<button class="runchip" data-a="go" data-v="${i}" style="--a:${x.rgb}"><i></i><b>${esc(x.name)}</b><span>${esc(x.word)}</span></button>`).join('')}</div>`);
    run.dataset.dv = 'fav:run';

    const wx = favWeather();
    put(this.el.querySelector('[data-r="wx"]'), wx.html);
    this.el.querySelector('[data-r="wxw"]').style.setProperty('--c', wx.c);
    put(this.el.querySelector('.autos'), FAV_AUTOS.map(a => {
      const s = this.autoState(a), name = s.lit && a.onName ? a.onName : a.name;
      return `<div class="agw${s.lit ? ' lit' : ''}" style="--c:${a.acc}"><i class="ag-glow"></i>
        <button class="ag${s.lit ? ' lit' : ''}${tWaiting(s.d, 'lit') || tWaiting(s.d, 'on') ? ' wait' : ''}" data-a="auto" data-v="${a.id}" aria-pressed="${s.lit}"${s.dis ? ' disabled' : ''}>
        <span class="ag-disc">${svg(a.icon, 24)}</span><span class="ag-name">${esc(name)}</span></button></div>`;
    }).join(''));
    this.sum = this.run.length ? this.run.length + ' running' : playing.length ? 'Music playing' : 'Nothing running';
  },

  sheet(id) {
    if (id !== 'bug') return null;
    const ack = isOn('input_boolean.signal_bug_logged_ack');
    return {
      title: 'Report a Bug', accent: '190,194,204', pill: ack ? pillHTML2('Logged', '48,209,88') : '',
      fx: skyHTML(grad('#17181A', '#212326', '#33363B'), '190,194,204', {}, 150),
      parts: [
        // Never redrawn (its HTML never changes), so what is typed stays put.
        ['form', `<div class="bugform nodrag">
          <label class="field"><span>Title</span><input id="bugTitle" maxlength="80" placeholder="What's wrong" autocomplete="off"></label>
          <label class="field"><span>Description</span><textarea id="bugDesc" maxlength="255" rows="4" placeholder="What happened, and where"></textarea></label></div>`],
        ['sev', lbl('SEVERITY') + segHTML('sev', [['Low', 'Low'], ['Medium', 'Medium'], ['High', 'High']], this.sev)],
        ['go', `<div class="camacts"><button class="ghost big" data-a="logbug">${svg(ack ? 'check' : 'bug', 18)}${ack ? 'Logged' : 'Log bug'}</button></div>
          <p class="tnote">Added to bug_log.md in the Home Assistant config, as the dashboard's Report a Bug does.</p>`],
      ],
    };
  },
  act(id, a, b) {
    if (a === 'go') { const x = this.run[Number(b.dataset.v)]; if (x) { goView(x.view); x.open(); } return; }
    if (a === 'auto') {
      const au = FAV_AUTOS.find(x => x.id === b.dataset.v), s = this.autoState(au);
      if (au.form) return openDev(this, 'bug');
      if (au.toggle) { tset(s.d, 'on', s.lit ? 'off' : 'on'); render(); return tsend(s.d, 'input_boolean', 'toggle', { entity_id: au.toggle }, ['on']); }
      tset(s.d, 'lit', 'on'); render();
      return tsend(s.d, 'script', 'turn_on', { entity_id: au.script, ...(au.vars ? { variables: au.vars } : {}) }, ['lit']);
    }
    if (a === 'sev') { this.sev = b.dataset.v; return render(); }
    if (a === 'logbug') return this.logBug();
  },
  // The dashboard's form, field by field, then its script.
  async logBug() {
    const t = $('bugTitle'), dsc = $('bugDesc'), title = t.value.trim(), desc = dsc.value.trim();
    if (!title) { toast('Give the bug a title first.'); t.focus(); return; }
    if (mode === 'preview') { toast('Preview: nothing was written.'); t.value = ''; dsc.value = ''; this.sev = 'Medium'; return render(); }
    try {
      const svc = (domain, service, service_data) => HA.send({ type: 'call_service', domain, service, service_data });
      await svc('input_text', 'set_value', { entity_id: 'input_text.bug_title', value: title.slice(0, 80) });
      await svc('input_text', 'set_value', { entity_id: 'input_text.bug_description', value: desc.slice(0, 255) });
      await svc('input_select', 'select_option', { entity_id: 'input_select.bug_severity', option: this.sev });
      await svc('script', 'turn_on', { entity_id: 'script.log_bug' });
      t.value = ''; dsc.value = ''; this.sev = 'Medium';
      toast('Bug logged.');
      render();
    } catch (e) { toast('Report a Bug: ' + e.message); }
  },

  samples: e => ({
    'input_boolean.signal_goodnight_ack': e('off'), 'input_boolean.signal_evening_lights_ack': e('off'), 'input_boolean.signal_moms_awake_ack': e('off'),
    'input_boolean.signal_bug_logged_ack': e('off'), 'input_boolean.babysitter_mode': e('off'),
    'script.goodnight': e('off'), 'script.evening_lights': e('off'), 'script.moms_awake': e('off'), 'script.hatch_bedtime': e('off'), 'script.log_bug': e('off'),
  }),
  // A routine's script, as the preview's: its helper lit for 3 s.
  preview(domain, service, d) {
    if (domain !== 'script' || service !== 'turn_on') return false;
    const a = FAV_AUTOS.find(x => x.script === d.entity_id); if (!a) return false;
    patchEnt(a.ack, 'on'); setTimeout(() => { patchEnt(a.ack, 'off'); render(); }, 3000);
    return a.id !== 'hatch';   // the Hatch's own preview does the rest
  },
});

// What each view says in the drop-down: what is running or needs you, not
// every section's line run together.
{
  const V = id => VIEWS.find(v => v.id === id), fav = famOf('fav'), sumOf = id => famOf(id).sum;
  V('fav').sum = () => fav.sum;
  V('climate').sum = () => { const n = fav.running().filter(x => x.view === 'climate').length; return n ? n + ' running' : ''; };
  V('lights').sum = () => sumOf('lights');
  V('media').sum = () => [sumOf('speakers') !== 'Quiet' ? sumOf('speakers') : '', sumOf('tv') !== 'Off' ? 'TV on' : ''].filter(Boolean).join(' · ');
  V('security').sum = () => sumOf('cams');
  V('around').sum = () => [/busy|attention/.test(sumOf('vac')) ? (sumOf('vac') === 'Needs attention' ? 'Vacuum needs attention' : 'Vacuum running') : '',
    / low$/.test(sumOf('printer')) ? 'Toner low' : '', isOn('lock.velux_gateway_departure_mode') || val('lock.velux_gateway_departure_mode') === 'locked' ? 'Blinds locked' : ''].filter(Boolean).slice(0, 2).join(' · ');
}
