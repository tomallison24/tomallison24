// labs/aos-home: the whole Home app in the aOS look, on the sample house (data.js). Every view of the real app
// (Favorites, Climate, Lights, Media, Security, Around the house, Automations), every family's card and popup,
// Energy, Activity, Report a Bug and Settings. Taps change the sample; nothing reaches Home Assistant.
//
// How it's wired: render() draws the view and any open sheet from HOUSE. Buttons say what they do in data-
// attributes, handled once on the page: data-tab / data-go (views), data-open="kind:id" (a popup),
// data-set="path" + data-v, data-tog="path", data-step="path" + data-d (change HOUSE at that path, then
// data-then runs a hook), data-act="name" (ACT[name]); a range: data-range="path" or data-ract="name";
// a volume meter: data-meter="speaker id".
'use strict';
(() => {
  const H = HOUSE, $ = id => document.getElementById(id), root = document.documentElement;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const at = path => path.split('.').reduce((o, k) => o == null ? o : o[k], H);
  const setAt = (path, v) => { const ks = path.split('.'), last = ks.pop(), o = ks.reduce((o, k) => o[k], H); o[last] = v; };
  const parse = v => v === 'true' ? true : v === 'false' ? false : v === 'null' ? null : /^-?\d+(\.\d+)?$/.test(v) ? +v : v;

  // ---- The look: Light or dark and the glass, kept on this phone ----
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const look = { theme: get('labs.aoslook.theme', 'auto'), glass: +get('labs.aoslook.glass', 50) };
  function applyLook() {
    root.dataset.theme = look.theme === 'auto' ? (mq.matches ? 'dark' : 'light') : look.theme;
    root.style.setProperty('--t', look.glass / 100);
    document.querySelector('meta[name=theme-color]').content = root.dataset.theme === 'dark' ? '#000000' : '#F2F2F7';
  }
  mq.addEventListener('change', () => { applyLook(); });
  applyLook();

  // ---- Small words ----
  const fmtT = hm => { const [h, m] = hm.split(':').map(Number), ap = h < 12 ? 'AM' : 'PM', h12 = h % 12 || 12; return m ? `${h12}:${String(m).padStart(2, '0')} ${ap}` : `${h12} ${ap}`; };
  const agoW = t => { const m = Math.round((Date.now() - t) / 60e3); return m < 1 ? 'Just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
  const clockW = t => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const hm = mins => `${Math.floor(mins / 60)}h ${mins % 60}m`;
  const W = w => w >= 1000 ? (w / 1000).toFixed(2) + ' kW' : Math.round(w) + ' W';
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  let tt;
  const toast = t => { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2000); };
  const log = (what, did, k = 'routine', by = 'You') => { H.activity.unshift({ t: Date.now(), what, did, k, by }); H.activity.length = Math.min(H.activity.length, 30); };

  // ---- Shared parts ----
  const sw = (on, attrs, label) => `<button class="sw" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" ${attrs}></button>`;
  const seg = (path, opts, cur, extra = '') => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-set="${path}" data-v="${esc(v)}" ${extra} aria-pressed="${String(v) === String(cur)}">${l}</button>`).join('')}</div>`;
  const segAct = (act, id, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-act="${act}" data-id="${id}" data-v="${esc(v)}" aria-pressed="${String(v) === String(cur)}">${l}</button>`).join('')}</div>`;
  const row = o => `<${o.btn ? `button ${o.btn}` : 'div'} class="row${o.icon ? ' ic' : ''}${o.cls ? ' ' + o.cls : ''}">${o.icon ? `<span class="ri" style="--c:${o.c || 'var(--ink3)'}">${ic(o.icon, 18, 2)}</span>` : ''}`
    + `<span class="grow"><b>${o.title}</b>${o.sub ? `<span>${o.sub}</span>` : ''}</span>${o.v != null ? `<span class="v${o.warn ? ' warn' : ''}">${o.v}</span>` : ''}${o.right || ''}${o.chev ? `<span class="chev">${ic('right', 13, 2.6)}</span>` : ''}</${o.btn ? 'button' : 'div'}>`;
  const group = rows => `<div class="group">${rows.join('')}</div>`;
  const lbl = t => `<div class="lbl">${t}</div>`;
  const rng = (attrs, v, min, max, c, cls = '') => `<input type="range" ${attrs} min="${min}" max="${max}" value="${v}" class="${cls}" style="--p:${((v - min) / (max - min) * 100).toFixed(1)}%;--rc:${c || 'var(--blue)'}">`;
  const pwr = (on, attrs, c, label) => `<button class="pwr${on ? ' on' : ''}" style="--c:${c}" ${attrs} aria-label="${esc(label)}" aria-pressed="${!!on}">${ic('power', 22, 2.2)}</button>`;
  const stepper = (path, v, d, unit, extra = '') => `<span class="step"><button data-step="${path}" data-d="${-d}" ${extra} aria-label="Lower">−</button><b>${v}${unit}</b><button data-step="${path}" data-d="${d}" ${extra} aria-label="Raise">+</button></span>`;
  const presets = (act, id, b, on) => `<div class="presets">${[[1, ic('moon', 16, 2), 'Night, 1%'], [25, '25%'], [50, '50%'], [75, '75%'], [100, ic('sun', 16, 2), 'Full, 100%']]
    .map(([v, l, a]) => `<button data-act="${act}" data-id="${id}" data-v="${v}" aria-label="${a || l}" aria-pressed="${!!on && b === v}">${l}</button>`).join('')}</div>`;
  const STEPS = {   // the limits of every stepper, by the end of its path
    heat: [50, 90], cool: [50, 90], target: [50, 86], heatTo: [50, 99], speed: [1, 10], vol: [0, 100], bass: [-10, 10], treble: [-10, 10], sub: [-15, 15] };

  // ---- Climate: what each device is doing ----
  const OUT = () => H.weather.t;
  function tSt(id) {
    const t = H.thermos[id], m = t.mode, away = H.away && t.kind === 'nest' && m !== 'off', eco = t.kind === 'nest' && (t.eco || away) && m !== 'off';
    let act = 'idle';
    if (m === 'off') act = 'off';
    else if (t.kind === 'windmill') act = m === 'fan_only' ? 'fan' : t.inside > t.cool ? 'cooling' : 'idle';
    else {
      const lo = eco ? (away ? 64 : 62) : t.heat, hi = eco ? (away ? 80 : 82) : t.cool;
      if ((m === 'heat' || m === 'heat_cool') && t.inside < lo) act = 'heating';
      else if ((m === 'cool' || m === 'heat_cool') && t.inside > hi) act = 'cooling';
    }
    const c = { heating: 'var(--orange)', cooling: 'var(--blue)', fan: 'var(--teal)', idle: 'var(--ink2)', off: 'var(--ink3)' }[act];
    const to = act === 'heating' ? (eco ? (away ? 64 : 62) : t.heat) : (eco && t.kind === 'nest' ? (away ? 80 : 82) : t.cool);
    const word = act === 'off' ? 'Off' : act === 'fan' ? 'Fan only' : act === 'heating' ? `Heating to ${to}°` : act === 'cooling' ? `Cooling to ${to}°` : eco ? (away ? 'Away · Eco' : `Eco · 62–82°`) : 'Idle';
    return { t, act, c, word, eco, away, working: act === 'heating' || act === 'cooling' || act === 'fan' };
  }
  function sched(t) {
    if (!t.sched) return null;
    const now = new Date(), mins = now.getHours() * 60 + now.getMinutes(), S = t.sched.steps.map(([h, s]) => ({ h, s, m: +h.slice(0, 2) * 60 + +h.slice(3) }));
    let cur = S.length - 1; S.forEach((x, i) => { if (x.m <= mins) cur = i; });
    const next = (cur + 1) % S.length, inM = (S[next].m - mins + 1440) % 1440;
    return { S, cur, next, inW: inM < 60 ? `in ${inM} min` : `in ${Math.round(inM / 60)} h` };
  }
  const hSt = id => { const h = H.heaters[id]; return { h, act: !h.on ? 'off' : h.draw > 20 ? 'heating' : 'holding', word: !h.on ? 'Off' : h.draw > 20 ? `Heating · ${W(h.draw)}` : `Holding at ${h.target}°` }; };
  const AQ_CUT = { AQI: [3, 6, 8], VOC: [3, 6, 8], 'NO₂': [3, 6, 8], 'PM2.5': [12, 35.4, 55.4], PM10: [54, 154, 254] }, AQ_W = ['Good', 'Fair', 'Poor', 'Very poor'], AQ_C = ['var(--green)', 'var(--yellow)', 'var(--orange)', 'var(--red)'];
  const aqBand = (k, v) => (AQ_CUT[k] || [3, 6, 8]).filter(c => v > c).length;
  const dySt = id => { const d = H.dysons[id], worst = Math.max(...d.aq.map(([k, v]) => aqBand(k, v)));
    const heating = d.on && d.mode === 'heat' && d.temp < d.heatTo;
    return { d, worst, heating, word: !d.on ? 'Off' : heating ? `Heating to ${d.heatTo}°` : d.mode === 'heat' ? `Warm · holding ${d.heatTo}°` : d.auto ? 'Auto' : `Fan · speed ${d.speed}`, working: d.on }; };
  const deSt = id => { const u = H.dehum[id]; const act = !u.on ? 'off' : u.full ? 'full' : u.rh > u.target ? 'drying' : 'holding';
    return { u, act, word: { off: 'Off', full: 'Tank full · stopped', drying: `Drying to ${u.target}%`, holding: `Holding · ${u.target}%` }[act], working: act === 'drying' }; };

  // ---- Lights ----
  const allLights = () => H.lights.flatMap((r, ri) => r.lights.map((l, li) => ({ r, ri, l, li })));
  const STRIP = [['white', 'White', '255,255,255'], ['warm', 'Warm White', '255,217,168'], ['red', 'Red', '255,59,48'], ['green', 'Green', '52,199,89'], ['blue', 'Blue', '59,130,246'], ['purple', 'Purple', '168,85,247']];
  const lrgb = l => l.kind === 'strip' ? (STRIP.find(s => s[0] === l.sw) || STRIP[1])[2] : '255,181,71';
  const lightWord = l => !l.on ? 'Off' : l.kind === 'onoff' ? 'On' : `${l.b}%`;
  function syncSplit(l) { if (!l.split) return; const on = Object.values(l.split).filter(x => x.on); l.on = on.length > 0; if (on.length) l.b = Math.round(on.reduce((a, x) => a + x.b, 0) / on.length); }
  function lightOn(l, on) { l.on = on; if (on && !l.b && l.kind !== 'onoff') l.b = 50; if (l.split) for (const k in l.split) l.split[k].on = on; }
  function lightB(l, b) { l.b = b; l.on = b > 0; if (l.split) for (const k in l.split) { l.split[k].b = b; l.split[k].on = b > 0; } }
  const roomOn = r => r.lights.filter(l => l.on).length;
  const LAMPS = [['tom', "Tom's Lamp"], ['elena', "Elena's Lamp"]];
  const lampOf = who => H.lights[4].lights[0].split[who];

  // ---- Media ----
  const SP = H.speakers;
  const groupOf = id => [id, ...(SP[id].group || [])];
  const spWord = s => s.state === 'playing' ? 'Playing' : s.state === 'paused' ? 'Paused' : s.state === 'tv' ? 'Playing the TV' : 'Idle';
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const meter = (id, v, c, big) => `<div class="meter${big ? ' big' : ''}" data-meter="${id}" role="slider" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}" tabindex="0" style="--c:${c || 'var(--ink)'}">${
    Array.from({ length: 20 }, (_, k) => `<i class="${(k + 1) * 5 <= Math.round(v / 5) * 5 && v > 0 ? 'on' : ''}" style="--h:${(k / 19).toFixed(2)};--k:${k}"></i>`).join('')}</div>`;

  // ---- Energy: what the real app estimates ----
  function energy() {
    const L = allLights().filter(x => x.l.on).reduce((a, { l }) => a + (l.kind === 'onoff' ? 10 * 2 : (l.kind === 'strip' ? 12 : 10 * (l.members ? l.members.length : 1)) * l.b / 100), 0);
    const AC = { lr: 2710, of: 2060, wm: 730 }, ac = Object.keys(H.thermos).reduce((a, id) => a + (tSt(id).act === 'cooling' ? AC[id] : 0), 0);
    const ht = Object.values(H.heaters).reduce((a, h) => a + h.draw, 0);
    const dy = Object.keys(H.dysons).reduce((a, id) => { const s = dySt(id); return a + (s.heating ? 1500 : s.d.on ? 6 : 0); }, 0);
    const de = Object.values(H.dehum).reduce((a, u) => a + (u.on ? u.now : 1), 0);
    const tv = H.tvs.tv.on ? 120 : 0.5;
    const hrs = new Date().getHours() + 1, day = new Date().getDate();
    const mk = (now, base) => ({ now, today: base * hrs / 24 + now * .3 / 1000, month: base * (day - .5) + now * .3 / 1000 });
    const E = { light: mk(L, 2.4), climate: mk(ac + ht, 9.5), fans: mk(dy + de, 5.8), dyheat: mk(dy > 100 ? dy - 6 : 0, 2.2), tv: mk(tv, 0.6),
      up: mk(H.dehum.up.on ? H.dehum.up.now : 1, 1.4), cube: mk(H.dehum.cube.on ? H.dehum.cube.now : 1, 2.1) };
    E.total = { now: E.light.now + E.climate.now + E.fans.now, today: E.light.today + E.climate.today + E.fans.today, month: E.light.month + E.climate.month + E.fans.month };
    return E;
  }
  const EN_ROWS = [['total', 'Total', 'bolt', 'var(--yellow)'], ['light', 'Lighting', 'bulb', 'var(--amber)'], ['climate', 'Climate', 'thermo', 'var(--orange)'], ['fans', 'Fans & Dehumidifiers', 'fan', 'var(--teal)'],
    ['dyheat', 'Dyson heating', 'flame', 'var(--red)', 'part of Fans & Dehumidifiers'], ['tv', 'TV', 'tv', 'var(--indigo)', 'not in the total'], ['up', 'Upstairs Dehumidifier', 'plug', 'var(--mint)', 'plug'], ['cube', 'Cube Dehumidifier', 'plug', 'var(--mint)', 'plug']];
  const enPill = (key, label) => { const e = energy()[key]; return `<button class="energy tap" data-open="energy:${key}" aria-label="${label} energy"><span class="bolt">${ic('bolt', 20)}</span>`
    + `<span class="cols"><span><b>${W(e.now)}</b><span>now</span></span><span><b>${e.today.toFixed(1)} kWh</b><span>today</span></span><span><b>$${(e.month * EN_RATE).toFixed(2)}</b><span>${e.month.toFixed(0)} kWh · month</span></span></span></button>`; };

  // ---- Security ----
  const camSt = c => !H.security.armed ? 'OFF' : c.motion ? 'ACTIVE' : 'STANDBY';
  const pauseLeft = id => { const p = H.security.pauses[id]; return p && p.until > Date.now() ? Math.ceil((p.until - Date.now()) / 60e3) : 0; };
  const PAUSES = [[30, '30 min'], [60, '1 hour'], [120, '2 hours'], [240, '4 hours']];

  // ---- Automations: Home's own copy of them ----
  const AUTOS = typeof HA_AUTOS === 'object' ? Object.entries(HA_AUTOS).map(([id, a]) => ({ id, ...a })) : [];
  const AU_G = [['routine', 'Routines', 'house', 'var(--indigo)', /goodnight|mom's awake|babysitter|^away\b|^home\b/i], ['nursery', 'Nursery', 'baby', 'var(--pink)', /hatch|nursery/i],
    ['security', 'Security', 'shield', 'var(--red)', /blink|camera|motion|alarm/i], ['climate', 'Climate', 'thermo', 'var(--orange)', /dyson|heater|thermostat|dehumid|hvac|windmill/i],
    ['blinds', 'Blinds', 'blinds', 'var(--teal)', /blind/i], ['lights', 'Lights', 'bulb', 'var(--amber)', /light|lamp|strip/i], ['media', 'Media', 'speaker', 'var(--indigo)', /sonos|move\b|\btv\b/i],
    ['helpers', 'Behind the scenes', 'apps', 'var(--ink3)', /.*/]];
  const auGroup = a => AU_G.find(g => g[4].test(a.alias || ''))[0];
  const auOn = a => !H.autosOff[a.id];
  const pretty = e => { const [d, n] = String(e).split('.'); if (!n) return e; const w = n.replace(/_/g, ' ').replace(/\b(\w)/g, c => c.toUpperCase()); return d === 'input_boolean' || d === 'input_number' || d === 'input_text' ? w + ' (helper)' : w; };
  const ents = (x, out = new Set()) => { if (!x || typeof x !== 'object') return out; if (Array.isArray(x)) { x.forEach(v => ents(v, out)); return out; }
    for (const [k, v] of Object.entries(x)) { if (k === 'entity_id') [].concat(v).forEach(e => typeof e === 'string' && /^\w+\.\w+$/.test(e) && out.add(e)); else ents(v, out); } return out; };
  function trigW(t) {
    const k = t.trigger || t.platform, off = o => !o ? '' : (String(o).startsWith('-') ? ` ${String(o).slice(1)} before` : ` ${o} after`);
    if (k === 'time') return [].concat(t.at).map(a => /^\d\d:\d\d/.test(a) ? 'At ' + fmtT(a.slice(0, 5)) : 'At the time in ' + pretty(a)).join(', ');
    if (k === 'sun') return `${off(t.offset) ? off(t.offset).trim().replace(/^(\S+)/, '$1') + ' ' : 'At '}${t.event}`.replace(/^ /, '');
    if (k === 'state') return `When ${[].concat(t.entity_id).map(pretty).join(' or ')}${t.to != null ? ` turns ${t.to}` : ' changes'}${t.for ? ' for a while' : ''}`;
    if (k === 'numeric_state') return `When ${[].concat(t.entity_id).map(pretty).join(' or ')} goes ${t.above != null ? 'above ' + t.above : ''}${t.below != null ? 'below ' + t.below : ''}`;
    if (k === 'homeassistant') return `When Home Assistant ${t.event === 'start' ? 'starts' : t.event}`;
    if (k === 'event') return `On ${String(t.event_type).replace(/_/g, ' ')}`;
    if (k === 'zone') return `When someone ${t.event === 'enter' ? 'arrives at' : 'leaves'} ${pretty(t.zone)}`;
    if (k === 'time_pattern') return 'On a repeating timer';
    if (k === 'template') return 'When a condition becomes true';
    return k ? k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : 'Something happens';
  }
  const lastRan = a => { let h = 0; for (const c of a.id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return Date.now() - (h % 2880) * 60e3; };

  // ---- Running now (Favorites) ----
  function running() {
    const out = [];
    for (const id in H.thermos) { const s = tSt(id); if (s.working) out.push([s.t.name, s.word, 'thermo:' + id, true]); }
    for (const id in H.heaters) { const s = hSt(id); if (s.act !== 'off') out.push([s.h.name, s.act === 'heating' ? 'Heating' : 'Holding', 'heater:' + id, s.act === 'heating']); }
    for (const id in H.dysons) { const s = dySt(id); if (s.d.on) out.push([s.d.name, s.heating ? 'Heating' : 'Fan', 'dyson:' + id, true]); }
    for (const id in H.dehum) { const s = deSt(id); if (s.act !== 'off') out.push([s.u.name + ' dehumidifier', s.act === 'drying' ? 'Drying' : s.act === 'full' ? 'Tank full' : 'Holding', 'dehum:' + id, s.act === 'drying']); }
    for (const id in SP) if (SP[id].state === 'playing' && !SP[id].inGroup) out.push([SP[id].name, 'Playing', 'speaker:' + id, true]);
    if (H.vacs.shark.state === 'cleaning') out.push(['Shark', 'Cleaning', 'vac:shark', true]);
    return out;
  }

  // ============ The views ============
  const VIEWS = {
    fav: { name: 'Favorites', icon: 'star', tab: true },
    climate: { name: 'Climate', icon: 'thermo', tab: true },
    lights: { name: 'Lights', icon: 'bulb', tab: true },
    media: { name: 'Media', icon: 'speaker', tab: true },
    more: { name: 'More', icon: 'more', tab: true },
    security: { name: 'Security', icon: 'shield', parent: 'more' },
    around: { name: 'Around the house', icon: 'house', parent: 'more' },
    autos: { name: 'Automations', icon: 'sync', parent: 'more' },
  };
  const UI = { view: 'fav', rooms: new Set(), sheet: null, armed: {} };

  function summary(v) {
    if (v === 'fav') { const r = running(); return H.away ? 'Away · ' + plural(r.length, 'thing') + ' running' : r.length ? `${plural(r.length, 'thing')} running` : 'Nothing running'; }
    if (v === 'climate') { const h = Object.keys(H.thermos).map(tSt).filter(s => s.act === 'heating').length, c = Object.keys(H.thermos).map(tSt).filter(s => s.act === 'cooling').length;
      const d = Object.keys(H.dehum).map(deSt).filter(s => s.act === 'drying').length; return [h && `${h} heating`, c && `${c} cooling`, d && `${d} drying`].filter(Boolean).join(' · ') || 'All idle'; }
    if (v === 'lights') { const n = allLights().filter(x => x.l.on).length; return n ? `${plural(n, 'light')} on` : 'All off'; }
    if (v === 'media') { const p = Object.values(SP).filter(s => s.state === 'playing' && !s.inGroup).length; return [p && `${p} playing`, H.tvs.tv.on && 'TV on'].filter(Boolean).join(' · ') || 'Quiet'; }
    if (v === 'more') return 'Security, around the house and automations';
    if (v === 'security') return (H.security.armed ? 'Armed' : 'Disarmed') + (H.security.motionAlert ? ' · Motion inside' : '');
    if (v === 'around') { const low = H.printer.toners.some(t => t[1] <= 20); return [`Shark ${H.vacs.shark.state === 'cleaning' ? 'cleaning' : 'docked'}`, low && 'Toner low'].filter(Boolean).join(' · '); }
    if (v === 'autos') { const off = AUTOS.filter(a => !auOn(a)).length; return `${AUTOS.length} automations · ${off ? off + ' off' : 'all on'}`; }
    return '';
  }

  // ---- Favorites ----
  const ROUTINES = [['goodnight', 'Goodnight', 'moon', 'var(--indigo)'], ['evening', 'Evening Lights', 'sunset', 'var(--orange)'], ['awake', "Mom's Awake", 'sun', 'var(--yellow)'],
    ['bug', 'Report a Bug', 'bug', 'var(--ink2)'], ['sitter', 'Babysitter', 'child', 'var(--pink)'], ['hatch', 'Hatch Green', 'bulbF', 'var(--green)']];
  function vFav() {
    const r = running(), last = H.activity[0], ypl = pauseLeft('yard');
    let h = '';
    if (H.away) h += `<div class="pill away" style="margin-bottom:10px"><span class="ic">${ic('leaf', 22)}</span><span class="tx"><b>Away from the house</b><span>Thermostats in Eco · since ${clockW(H.ecoSince)}</span></span></div>`;
    h += enPill('total', 'House');
    h += `<h3 class="sh">Running now <small>${r.length || 'Nothing'}</small></h3>`;
    h += r.length ? `<div class="hscroll">${r.map(([n, w, o, on]) => `<button class="chip tap" data-open="${o}"><span class="dot${on ? '' : ' idle'}"></span>${esc(n)} <span class="muted" style="font-weight:500">${w}</span></button>`).join('')}</div>`
      : `<p class="note" style="margin-top:0">Nothing is running right now.</p>`;
    h += `<div class="stack" style="margin-top:14px">`
      + `<button class="pill tap" style="--c:var(--blue)" data-act="weather"><span class="ic">${ic(H.weather.icon, 22)}</span><span class="tx"><b>${H.weather.t}° · ${H.weather.cond}</b><span>H:${H.weather.hi}° L:${H.weather.lo}° · Home</span></span><span class="chev">${ic('right', 14, 2.6)}</span></button>`
      + `<button class="pill tap" style="--c:var(--purple)" data-open="activity:"><span class="ic">${ic('clock', 22)}</span><span class="tx"><b>${esc(last.what)} · ${esc(last.did)}</b><span>${agoW(last.t)} · ${last.by}</span></span><span class="chev">${ic('right', 14, 2.6)}</span></button></div>`;
    h += `<h3 class="sh">Automations</h3><div class="row3">${ROUTINES.map(([id, n, icn, c]) => {
      const lit = id === 'sitter' ? H.sitter : H.routines[id] > Date.now();
      return `<button class="routine tap${lit ? ' lit' : ''}" style="--c:${c}" data-act="routine" data-id="${id}" aria-pressed="${lit}"><span class="ic">${ic(icn, 20)}</span>${id === 'sitter' && lit ? 'Sitter armed' : n}</button>`; }).join('')}</div>`;
    h += `<div class="card" style="margin-top:10px"><div class="hd"><span class="badge${ypl ? '' : ' on'}" style="--c:var(--green)">${ic('cctv', 21)}</span><span class="nm"><b>Yard camera</b><span>${!H.security.armed ? 'System disarmed' : ypl ? `Paused · ${ypl} min left` : 'Watching for motion'}</span></span></div>`
      + `<div style="margin-top:12px">${segAct('pause', 'yard', PAUSES.map(([m, l]) => [m, l.replace(' hours', ' h').replace(' hour', ' h')]), H.security.pauses.yard && ypl ? H.security.pauses.yard.m : '')}</div></div>`;
    h += `<h3 class="sh">Thermostats</h3><div class="stack">${['lr', 'of'].map(thermoCard).join('')}</div>`;
    h += `<h3 class="sh">Lights <small>${allLights().filter(x => x.l.on).length} on</small></h3><div class="row2"><button class="btn grey" style="margin:0" data-act="allLights" data-v="1">All on</button><button class="btn grey" style="margin:0" data-act="allLights" data-v="0">All off</button></div>`;
    h += `<div class="stack" style="margin-top:10px">${LAMPS.map(([who, n]) => { const L = lampOf(who);
      return `<div class="light${L.on ? ' on' : ''}" style="--b:${L.b};background-color:var(--card)"><div class="hd"><button class="badge${L.on ? ' on' : ''}" data-act="lamp" data-id="${who}" aria-label="${n}" aria-pressed="${L.on}">${ic('bulbF', 21)}</button>`
        + `<span class="nm"><b>${n}</b><span>${L.on ? L.b + '%' : 'Off'}</span></span></div>${rng(`data-ract="lampB" data-id="${who}" aria-label="${n} brightness"`, L.on ? L.b : 0, 0, 100, 'var(--amber)')}${presets('lampP', who, L.b, L.on)}</div>`; }).join('')}</div>`;
    return h;
  }

  // ---- Climate ----
  function thermoCard(id) {
    const s = tSt(id), t = s.t, sc = sched(t), arrow = sc ? `${fmtT(sc.S[sc.next].h)} → ${sc.S[sc.next].s}` : t.kind === 'windmill' && t.follow ? 'Follows the Office' : 'No schedule';
    const tgt = (k, v, c, l) => `<div class="tgt" style="--c:${c}"><button data-step="thermos.${id}.${k}" data-d="1" data-then="tgap" data-id="${id}" aria-label="Raise ${l}">${ic('up', 20, 2.4)}</button><span class="n">${v}°</span><button data-step="thermos.${id}.${k}" data-d="-1" data-then="tgap" data-id="${id}" aria-label="Lower ${l}">${ic('down', 20, 2.4)}</button><span class="l">${l}</span></div>`;
    let mid;
    if (t.mode === 'off') mid = '<div class="offword">Off</div>';
    else if (t.mode === 'fan_only') mid = '<div class="offword">Fan</div>';
    else if (s.eco && !s.away) mid = `<div class="targets"><div class="tgt"><span class="n" style="color:var(--green)">62°</span><span class="l">ECO LOW</span></div><span class="tdash">–</span><div class="tgt"><span class="n" style="color:var(--green)">82°</span><span class="l">ECO HIGH</span></div></div><button class="btn grey" style="height:40px;font-size:15px" data-act="exitEco" data-id="${id}">Exit Eco</button>`;
    else if (s.away) mid = `<div class="targets">${tgt('heat', 64, 'var(--green)', 'ECO LOW')}<span class="tdash">–</span>${tgt('cool', 80, 'var(--green)', 'ECO HIGH')}</div>`;
    else if (t.mode === 'heat') mid = `<div class="targets">${tgt('heat', t.heat, 'var(--orange)', 'HEAT')}</div>`;
    else if (t.mode === 'heat_cool') mid = `<div class="targets">${tgt('heat', t.heat, 'var(--orange)', 'HEAT')}<span class="tdash">–</span>${tgt('cool', t.cool, 'var(--blue)', 'COOL')}</div>`;
    else mid = `<div class="targets">${tgt('cool', t.cool, 'var(--blue)', t.mode === 'auto' ? 'ECO' : 'COOL')}</div>`;
    return `<div class="card therm tap" data-open="thermo:${id}"><div class="hd">${pwr(t.mode !== 'off', `data-act="tpower" data-id="${id}"`, s.c === 'var(--ink2)' ? 'var(--green)' : s.c, t.name + ' power')}`
      + `<span class="nm"><b>${t.name}</b><span>${s.away ? 'Away · ' : ''}${arrow}</span></span><span class="inside"><b>${t.inside}°</b><span>INSIDE</span></span></div>${mid}`
      + `<div class="foot"><span style="color:${s.c};font-weight:600">${s.working ? '<span class="dot"></span>' : ''}${s.word}</span><span>${ic('cloud', 16)}${OUT()}° outside</span></div></div>`;
  }
  function heaterCard(id) {
    const s = hSt(id), h = s.h;
    return `<div class="card tap" data-open="heater:${id}"><div class="hd">${pwr(h.on, `data-tog="heaters.${id}.on" data-then="heater" data-id="${id}"`, 'var(--orange)', h.name + ' power')}`
      + `<span class="nm"><b>${h.name}</b><span style="${s.act === 'heating' ? 'color:var(--orange)' : ''}">${s.word}</span></span>${stepper(`heaters.${id}.target`, h.target, 1, '°')}</div>`
      + `<div class="chips" style="margin-top:12px"><span class="chip">${h.watts}</span><span class="chip">${h.mode[0].toUpperCase() + h.mode.slice(1)}</span><span class="chip">${ic('timer', 16)}${h.countdown ? `Off in ${h.countdown} h` : 'No countdown'}</span>${h.lock ? `<span class="chip">${ic('lock', 16)}Locked</span>` : ''}</div></div>`;
  }
  function dysonCard(id) {
    const s = dySt(id), d = s.d;
    return `<div class="card tap" data-open="dyson:${id}"><div class="hd">${pwr(d.on, `data-tog="dysons.${id}.on" data-id="${id}"`, s.heating ? 'var(--orange)' : 'var(--teal)', d.name + ' power')}`
      + `<span class="nm"><b>${d.name}</b><span>${s.word} · Air ${AQ_W[s.worst].toLowerCase()}</span></span><span class="inside"><b>${d.temp}°</b><span>ROOM</span></span></div>`
      + `<div class="meter" style="margin-top:14px;height:22px;--c:${s.heating ? 'var(--orange)' : 'var(--teal)'}" aria-hidden="true">${Array.from({ length: 10 }, (_, k) => `<i class="${d.on && k < d.speed ? 'on' : ''}" style="--h:${(k / 9).toFixed(2)}"></i>`).join('')}</div>`
      + `<div class="seek" style="margin-top:4px"><span>${d.auto ? 'Auto' : 'Speed ' + d.speed}</span><span>${d.rh}% humidity</span></div></div>`;
  }
  function dehumCard(id) {
    const s = deSt(id), u = s.u;
    return `<div class="card tap" data-open="dehum:${id}"><div class="hd">${pwr(u.on, `data-tog="dehum.${id}.on"`, 'var(--teal)', u.name + ' power')}`
      + `<span class="nm"><b>${u.name}</b><span style="${s.act === 'full' ? 'color:var(--red)' : ''}">${s.word}</span></span><span class="inside"><b>${u.rh}%</b><span>ROOM</span></span></div>`
      + `<div class="hd" style="margin-top:12px"><span class="nm"><span>Target</span></span>${stepper(`dehum.${id}.target`, u.target, 5, '%')}</div>`
      + (u.full || u.filterDue ? `<div class="chips" style="margin-top:10px">${u.full ? `<button class="chip lit" style="--c:var(--red)" data-act="emptied" data-id="${id}">${ic('drop', 16)}Empty the tank</button>` : ''}${u.filterDue ? `<span class="chip lit" style="--c:var(--orange)">${ic('filter', 16)}Replace filter</span>` : ''}</div>` : '') + '</div>';
  }
  function vClimate() {
    return enPill('climate', 'Climate')
      + `<h3 class="sh">Thermostats</h3><div class="stack">${Object.keys(H.thermos).map(thermoCard).join('')}</div>`
      + `<h3 class="sh">Heaters <small>${Object.keys(H.heaters).map(hSt).filter(s => s.act !== 'off').length} on</small></h3><div class="stack">${Object.keys(H.heaters).map(heaterCard).join('')}</div>`
      + `<h3 class="sh">Air purifiers <small>${Object.values(H.dysons).filter(d => d.on).length} running</small></h3><div class="stack">${Object.keys(H.dysons).map(dysonCard).join('')}</div>`
      + `<h3 class="sh">Dehumidifiers</h3><div class="stack">${Object.keys(H.dehum).map(dehumCard).join('')}</div>`;
  }

  // ---- Lights ----
  function lightPane(ri, li, inSheet) {
    const l = H.lights[ri].lights[li], id = `${ri}.${li}`;
    let h = `<div class="light${l.on ? ' on' : ''}" style="--b:${l.b || 0};--lc:rgb(${lrgb(l)});--lrgb:${lrgb(l)}"><div class="hd"><button class="badge${l.on ? ' on' : ''}" data-act="light" data-id="${id}" aria-label="${esc(l.name)}" aria-pressed="${l.on}">${ic(l.kind === 'strip' ? 'tv' : 'bulbF', 21)}</button>`
      + `<button class="nm" ${inSheet ? '' : `data-open="light:${id}"`}><b>${esc(l.name)}</b><span>${lightWord(l)}${l.members ? ` · ${l.members.length} lamps` : ''}</span></button>${l.kind === 'onoff' ? sw(l.on, `data-act="light" data-id="${id}"`, l.name) : ''}</div>`;
    if (l.kind !== 'onoff') h += rng(`data-ract="lightB" data-id="${id}" aria-label="${esc(l.name)} brightness"`, l.on ? l.b : 0, 0, 100, `rgb(${lrgb(l)})`) + presets('lightP', id, l.b, l.on);
    if (l.kind === 'strip') h += `<div class="swatches">${STRIP.map(([k, n, c]) => `<button data-act="strip" data-id="${id}" data-v="${k}" style="--s:${c}" aria-label="${n}" aria-pressed="${l.sw === k}"></button>`).join('')}</div>`;
    return h + '</div>';
  }
  function vLights() {
    let h = enPill('light', 'Lighting') + `<div class="row2" style="margin-top:10px"><button class="btn grey" style="margin:0" data-act="allLights" data-v="1">All on</button><button class="btn grey" style="margin:0" data-act="allLights" data-v="0">All off</button></div>`;
    h += `<h3 class="sh">Rooms</h3>`;
    h += H.lights.map((r, ri) => {
      const n = roomOn(r), open = UI.rooms.has(r.id), dims = r.lights.filter(l => l.kind !== 'onoff'), on = dims.filter(l => l.on), avg = on.length ? Math.round(on.reduce((a, l) => a + l.b, 0) / on.length) : 0;
      return `<div class="room${open ? ' open' : ''}"><div class="rh"><span class="badge${n ? ' on' : ''}" style="--c:var(--amber)">${ic(r.icon, 21)}</span><button class="nm" data-act="room" data-id="${r.id}" aria-expanded="${open}"><b>${esc(r.name)}</b><span>${n ? `${n} of ${r.lights.length} on` : 'All off'}</span></button>`
        + `${pwr(n > 0, `data-act="roomPower" data-id="${ri}"`, 'var(--amber)', r.name + ' lights')}<button class="caret" data-act="room" data-id="${r.id}" aria-label="Open ${esc(r.name)}">${ic('right', 14, 2.6)}</button></div>`
        + `<div class="lights">${dims.length >= 2 ? `<div class="light${on.length ? ' on' : ''}" style="--b:${avg}"><div class="hd"><span class="badge${on.length ? ' on' : ''}">${ic('sun', 21)}</span><span class="nm"><b>All lights</b><span>${on.length ? `${on.length} of ${dims.length} · ${avg}%` : 'Off'}</span></span></div>`
          + rng(`data-ract="roomB" data-id="${ri}" aria-label="All ${esc(r.name)} lights"`, avg, 0, 100, 'var(--amber)') + presets('roomP', ri, avg, on.length === dims.length) + '</div>' : ''}${r.lights.map((_, li) => lightPane(ri, li)).join('')}</div></div>`;
    }).join('');
    return h;
  }

  // ---- Media ----
  function speakerCard(id) {
    const s = SP[id], g = groupOf(id), gv = Math.max(...g.map(k => SP[k].vol)), playing = s.state === 'playing' || s.state === 'tv';
    if (s.state === 'idle') return `<div class="card tap" data-open="speaker:${id}" style="padding:12px 14px"><div class="hd"><span class="cover sm" style="--art:${s.nest ? 'linear-gradient(135deg,#9AA8B5,#5E6B78)' : 'linear-gradient(135deg,#8193BC,#6FA597)'}"></span>`
      + `<span class="nm"><b>${s.name}</b><span>Idle${s.battery != null ? ` · ${s.battery}% battery` : ''}</span></span><button class="circ" style="background:var(--fill);width:40px;height:40px" data-act="playIdle" data-id="${id}" aria-label="Play on ${s.name}">${ic('play', 20)}</button></div>`
      + `<div class="hd" style="margin-top:10px;gap:10px">${ic('vol', 16)}${meter(id, s.vol)}<span class="vlabel">${s.vol}</span></div></div>`;
    return `<div class="card tap${s.state === 'playing' ? ' playing' : ''}" data-open="speaker:${id}"><div class="hd"><span class="cover" style="--art:${s.art}"></span><span class="nm"><b>${esc(s.title)}</b><span>${esc(s.artist)}</span>`
      + `<span>${g.map(k => SP[k].name).join(' + ')} · ${spWord(s)}</span></span><span class="mctl">${s.state !== 'tv' ? `<button class="pp" data-act="pp" data-id="${id}" aria-label="${s.state === 'playing' ? 'Pause' : 'Play'}">${ic(s.state === 'playing' ? 'pause' : 'play', 22)}</button>` : ''}</span></div>`
      + `<div class="hd" style="margin-top:12px;gap:10px">${s.state !== 'tv' ? `<button data-act="next" data-id="${id}" aria-label="Next" style="color:var(--ink2)">${ic('next', 22)}</button>` : ic('tv', 18)}${meter(id, gv)}<span class="vlabel">${gv}</span></div>`
      + (g.length > 1 ? g.map(k => `<div class="hd" style="margin-top:6px;gap:10px"><span class="small muted" style="width:62px">${SP[k].name}</span>${meter(k, SP[k].vol, 'var(--ink2)')}<span class="vlabel">${SP[k].vol}</span></div>`).join('') : '') + '</div>';
  }
  function vMedia() {
    const lead = Object.keys(SP).filter(id => !SP[id].inGroup);
    const full = lead.filter(id => SP[id].state !== 'idle'), slim = lead.filter(id => SP[id].state === 'idle');
    const A = H.tvs.atv, T = H.tvs.tv;
    return enPill('tv', 'TV')
      + `<h3 class="sh">Speakers <small>${summary('media')}</small></h3><div class="stack">${full.map(speakerCard).join('')}${slim.map(speakerCard).join('')}</div>`
      + `<h3 class="sh">TV</h3><div class="stack">`
      + `<div class="card tap" data-open="atv:"><div class="hd"><span class="cover sm" style="--art:linear-gradient(135deg,#2B2D33,#55585F)"></span><span class="nm"><b>Apple TV</b><span>${A.on ? 'Playing · ' + A.app : 'Off'}</span></span>${pwr(A.on, 'data-tog="tvs.atv.on"', 'var(--indigo)', 'Apple TV power')}</div>`
      + `<div class="hscroll" style="margin-top:12px">${A.apps.map(a => `<button class="chip${A.app === a && A.on ? ' lit' : ''}" style="--c:var(--indigo)" data-set="tvs.atv.app" data-v="${esc(a)}" data-then="atvOn">${esc(a)}</button>`).join('')}</div></div>`
      + `<div class="card tap" data-open="lgtv:"><div class="hd"><span class="cover sm" style="--art:linear-gradient(135deg,#202A44,#3F5582)"></span><span class="nm"><b>Living Room TV</b><span>${T.on ? 'On · ' + T.source : 'Off'}</span></span>${pwr(T.on, 'data-tog="tvs.tv.on"', 'var(--indigo)', 'TV power')}</div></div></div>`;
  }

  // ---- More ----
  function vMore() {
    const L = [['security', 'shield', 'var(--red)'], ['around', 'house', 'var(--teal)'], ['autos', 'sync', 'var(--indigo)']];
    return group(L.map(([v, icn, c]) => row({ btn: `data-go="${v}"`, icon: icn, c, title: VIEWS[v].name, sub: summary(v), chev: true })))
      + lbl('This test page') + group([row({ btn: 'data-open="settings:"', icon: 'gear', c: 'var(--ink3)', title: 'Settings', chev: true }), row({ btn: 'data-act="toLabs"', icon: 'grid', c: 'var(--blue)', title: 'Back to Labs', chev: true })]);
  }

  // ---- Security ----
  function camTile(c) {
    const st = camSt(c), pl = pauseLeft(c.id), busy = UI.armed['snap:' + c.id];
    return `<button class="cam tap${busy ? ' busy' : ''}" style="--still:${c.still}" data-open="cam:${c.id}" aria-label="${c.name} camera"><span class="tl"><span class="tag${st === 'ACTIVE' ? ' act' : ''}">${pl ? 'PAUSED' : st}</span>${c.batt ? '<span class="tag" style="background:rgba(255,69,58,.85)">LOW BATTERY</span>' : ''}</span>`
      + (busy ? '<span class="spin"><i></i></span>' : '') + `<span class="bl"><b>${c.name}</b><span>${agoW(c.shot)}</span></span></button>`;
  }
  function vSecurity() {
    const S = H.security, D = S.door;
    let h = `<button class="arm tap${S.armed ? ' on' : ''}" data-act="arm"><span class="shield">${ic(S.armed ? 'shieldOk' : 'shield', 28)}</span><span class="nm" style="flex:1"><b style="font-size:19px;display:block">${S.armed ? 'Armed' : 'Disarmed'}</b><span class="muted small">Blink system · tap to ${S.armed ? 'disarm' : 'arm'}</span></span></button>`;
    if (S.motionAlert) h += `<button class="alert tap" style="margin-top:10px" data-set="security.motionAlert" data-v="false" data-then="silenced">${ic('motion', 22)}<span style="flex:1"><b style="display:block;font-size:16px">Motion in the house</b><span class="small muted">Living Room camera · tap to silence</span></span></button>`;
    h += `<h3 class="sh">Front door</h3><button class="cam tap" style="--still:linear-gradient(170deg,#6A7480,#39414B 60%,#22272D)" data-open="door:"><span class="tl"><span class="tag">DOORBELL</span></span><span class="bl"><b>Front Door</b><span>Rang ${agoW(D.chime).toLowerCase()} · motion ${agoW(D.motion).toLowerCase()}</span></span></button>`;
    h += `<h3 class="sh">Cameras</h3><div class="row2">${S.cams.map(camTile).join('')}</div>`;
    const yl = pauseLeft('yard');
    h += `<div class="card" style="margin-top:10px"><div class="hd"><span class="nm"><b>Pause the Yard's motion</b><span>${yl ? `${yl} min left` : 'Not paused'}</span></span></div><div style="margin-top:10px">${segAct('pause', 'yard', PAUSES.map(([m, l]) => [m, l.replace(' hours', ' h').replace(' hour', ' h')]), yl ? S.pauses.yard.m : '')}</div></div>`;
    return h;
  }

  // ---- Around the house ----
  function vAround() {
    const V = H.vacs.shark, B = H.blinds, N = H.hatch, E = energy();
    const ring = (p, c) => `<span class="batt"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="none" stroke="var(--fill)" stroke-width="7"/><circle cx="32" cy="32" r="27" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(169.6 * p / 100).toFixed(1)} 169.6"/></svg><b>${p}%</b></span>`;
    const vw = { cleaning: 'Cleaning', returning: 'Heading home', paused: 'Paused', docked: 'Docked · charged', charging: 'Charging' }[V.state];
    let h = `<h3 class="sh" style="margin-top:6px">Vacuums</h3><div class="stack"><div class="card tap" data-open="vac:shark"><div class="hd">${ring(V.battery, V.battery < 25 ? 'var(--red)' : 'var(--green)')}<span class="nm"><b>Shark</b><span${V.state === 'cleaning' ? ' style="color:var(--green)"' : ''}>${vw}</span></span></div>`
      + `<div class="btns" style="margin-top:12px"><button class="btn${V.state === 'cleaning' ? ' grey' : ''}" data-act="vac" data-v="${V.state === 'cleaning' ? 'pause' : 'start'}">${V.state === 'cleaning' ? 'Pause' : 'Start'}</button><button class="btn grey" data-act="vac" data-v="dock">Dock</button></div></div>`
      + `<div class="card" style="opacity:.7"><div class="hd"><span class="badge">${ic('vacuum', 21)}</span><span class="nm"><b>Ecovacs</b><span>Unavailable · its integration isn't signing in</span></span></div></div></div>`;
    h += `<h3 class="sh">Blinds <small>${B.all === 0 ? 'Closed' : B.all === 100 ? 'Open' : B.all + '% open'}</small></h3><div class="card tap" data-open="blinds:"><div class="row2"><div class="blind" style="--o:${B.left}"><i></i></div><div class="blind" style="--o:${B.right}"><i></i></div></div>`
      + `<div style="margin-top:12px">${segAct('blinds', 'all', [[0, 'Closed'], [25, '25%'], [50, '50%'], [75, '75%'], [100, 'Open']], B.left === B.right ? B.all : '')}</div>${B.guest ? '<p class="note">Guest mode: the automations leave the blinds alone.</p>' : ''}</div>`;
    const hc = H.hatchColors[N.color][1];
    h += `<h3 class="sh">Nursery</h3><div class="card tap" data-open="hatch:"><div class="hd"><span class="hatch${N.light ? ' on' : ''}" style="--hc:${hc}">${N.clock ? `<b style="font-size:13px;color:${N.light ? '#fff' : 'var(--ink2)'}">${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/ [AP]M/, '')}</b>` : ''}</span>`
      + `<span class="nm"><b>Olivia's Hatch</b><span>${N.light ? `Light ${N.b}%` : 'Light off'} · ${N.sound ? `${N.soundName} ${N.vol}%` : 'Sound off'}</span></span></div>`
      + `<div class="btns" style="margin-top:12px"><button class="btn${N.light ? '' : ' grey'}" data-tog="hatch.light">${N.light ? 'Light on' : 'Light off'}</button><button class="btn${N.sound ? '' : ' grey'}" data-tog="hatch.sound">${N.sound ? 'Sound on' : 'Sound off'}</button></div></div>`;
    h += `<h3 class="sh">Printer <small>${H.printer.state}</small></h3><div class="card">${H.printer.toners.map(([n, v, c]) => `<div class="toner${v <= 20 ? ' low' : ''}" style="--tc:${c}"><span>${n}</span><span class="bar2"><i style="width:${v}%"></i></span><b>${v}%</b></div>`).join('')}${H.printer.toners.some(t => t[1] <= 20) ? '<p class="note">Magenta is low: 20% and under.</p>' : ''}</div>`;
    h += `<h3 class="sh">Energy</h3><div class="group">${EN_ROWS.map(([k, n, icn, c, note]) => row({ btn: `data-open="energy:${k}"`, icon: icn, c, title: n, sub: note ? `${note} · ${E[k].today.toFixed(1)} kWh today` : `${E[k].today.toFixed(1)} kWh today · $${(E[k].month * EN_RATE).toFixed(2)} this month`, v: W(E[k].now), chev: true })).join('')}</div>`;
    return h;
  }

  // ---- Automations ----
  function vAutos() {
    let h = `<p class="note" style="margin-top:0">Every Home Assistant automation, from Home's own copy. A switch turns one off here only; nothing runs from this page.</p>`;
    for (const [g, n, icn, c] of AU_G) {
      const L = AUTOS.filter(a => auGroup(a) === g).sort((a, b) => a.alias.localeCompare(b.alias));
      if (!L.length) continue;
      h += lbl(`${n} · ${L.length}`) + group(L.map(a => `<div class="row ic au-row"><span class="ri" style="--c:${c}">${ic(icn, 18, 2)}</span>`
        + `<button class="grow" data-open="auto:${esc(a.id)}"><b>${esc(a.alias)}</b>${auOn(a) ? '' : '<span>Off</span>'}</button>${sw(auOn(a), `data-act="auto" data-id="${esc(a.id)}"`, a.alias)}</div>`));
    }
    if (!AUTOS.length) h += '<p class="note">Home\'s copy of the automations didn\'t load.</p>';
    return h;
  }

  // ============ Popups ============
  function sThermo(id) {
    const s = tSt(id), t = s.t, sc = sched(t);
    let h = `<div class="hero"><div class="what" style="--c:${s.c}">${s.word}</div><div class="small muted">${t.inside}° inside${t.hum != null ? ` · ${t.hum}% humidity` : ''} · ${OUT()}° outside</div></div>`;
    const big = (k, v, c, l) => `<div class="big-step" style="--c:${c}"><button data-step="thermos.${id}.${k}" data-d="-1" data-then="tgap" data-id="${id}" aria-label="Lower ${l}">−</button><div class="n">${v}°<small>${l}</small></div><button data-step="thermos.${id}.${k}" data-d="1" data-then="tgap" data-id="${id}" aria-label="Raise ${l}">+</button></div>`;
    if (t.mode === 'heat' && !s.eco) h += big('heat', t.heat, 'var(--orange)', 'HEAT');
    else if (t.mode === 'cool' && !s.eco) h += big('cool', t.cool, 'var(--blue)', 'COOL');
    else if (t.mode === 'auto') h += big('cool', t.cool, 'var(--blue)', 'ECO');
    else if (t.mode === 'heat_cool' && !s.eco) h += big('heat', t.heat, 'var(--orange)', 'HEAT') + big('cool', t.cool, 'var(--blue)', 'COOL');
    else if (s.eco) h += `<div class="big-step" style="--c:var(--green)"><div class="n">${s.away ? 64 : 62}°<small>ECO LOW</small></div><div class="n">${s.away ? 80 : 82}°<small>ECO HIGH</small></div></div>`
      + `<p class="note" style="text-align:center">${s.away ? "Everyone's out, so Home Assistant holds the Nests in Eco until someone is home." : 'The Eco temperatures are set in the Nest app.'}</p>`;
    h += lbl('Control') + group([row({ title: 'Power', right: sw(t.mode !== 'off', `data-act="tpower" data-id="${id}"`, 'Power') }),
      ...(t.kind === 'nest' ? [row({ title: 'Eco', sub: 'The Nest\'s own Eco', right: sw(t.eco, `data-tog="thermos.${id}.eco"`, 'Eco') }), row({ title: 'Fan', sub: t.fan ? 'On' : 'Auto', right: sw(t.fan, `data-tog="thermos.${id}.fan"`, 'Fan') })] : [])]);
    h += lbl('Mode') + seg(`thermos.${id}.mode`, t.modes, t.mode, `data-then="tmode" data-id="${id}"`);
    if (t.kind === 'windmill') h += lbl('Fan') + seg(`thermos.${id}.fanSpeed`, t.fans.map(f => [f, f]), t.fanSpeed)
      + lbl('Sync') + group([row({ title: 'Follow the Office', sub: '3° under its target, off with it', right: sw(t.follow, `data-act="auto" data-id="1784768589409" data-mirror="thermos.wm.follow"`, 'Follow the Office') })]);
    if (sc) h += lbl('Schedule') + group([row({ title: t.sched.name, sub: t.sched.days, right: sw(t.sched.on, `data-tog="thermos.${id}.sched.on"`, 'Schedule on') }),
      ...sc.S.map((x, i) => row({ cls: i === sc.cur && t.sched.on ? 'now' : '', title: fmtT(x.h), sub: i === sc.cur && t.sched.on ? 'Now' : i === sc.next && t.sched.on ? `Next · ${sc.inW}` : '', v: x.s }))]);
    else h += lbl('Schedule') + group([row({ title: t.kind === 'windmill' ? 'No schedule' : 'No schedule', sub: t.kind === 'windmill' ? 'It follows the Office instead' : "A schedule kept in the Nest app isn't visible here" })]);
    h += lbl('Readings') + group([t.kind === 'windmill' ? row({ icon: 'snow', c: 'var(--blue)', title: 'Compressor', v: t.mode === 'off' ? 'Off' : s.act === 'cooling' ? 'Cooling' : 'Resting' }) : row({ icon: 'hum', c: 'var(--teal)', title: 'Humidity', v: t.hum + '%' }),
      row({ icon: 'timer', c: 'var(--indigo)', title: 'Running today', v: hm(t.runtime) }), row({ icon: 'cloud', c: 'var(--blue)', title: 'Outside', v: OUT() + '°' })]);
    const ac = { lr: 2710, of: 2060, wm: 730 }[id];
    h += lbl('Energy · estimated') + group([row({ title: 'Now', v: s.act === 'cooling' ? W(ac) : '0 W' }), row({ title: 'Today', v: (ac * t.runtime / 60 / 1000 * .4).toFixed(1) + ' kWh' })])
      + `<p class="note">Heating isn't counted: the Living Room's is gas.</p>`;
    return h;
  }
  function sHeater(id) {
    const s = hSt(id), h = s.h;
    return `<div class="hero"><div class="what" style="--c:${s.act === 'heating' ? 'var(--orange)' : 'var(--ink2)'}">${s.word}</div></div>`
      + `<div class="big-step" style="--c:var(--orange)"><button data-step="heaters.${id}.target" data-d="-1" aria-label="Lower">−</button><div class="n">${h.target}°<small>TARGET</small></div><button data-step="heaters.${id}.target" data-d="1" aria-label="Raise">+</button></div>`
      + group([row({ title: 'Power', right: sw(h.on, `data-tog="heaters.${id}.on" data-then="heater" data-id="${id}"`, 'Power') })])
      + lbl('Wattage') + seg(`heaters.${id}.watts`, [['750 W', '750 W'], ['1500 W', '1500 W']], h.watts, `data-then="heater" data-id="${id}"`)
      + lbl('Mode') + seg(`heaters.${id}.mode`, [['eco', 'Eco'], ['comfort', 'Comfort'], ['boost', 'Boost']], h.mode)
      + lbl('Countdown') + seg(`heaters.${id}.countdown`, [[1, '1 h'], [2, '2 h'], [4, '4 h'], [8, '8 h'], [0, 'None']], h.countdown)
      + `<p class="note">Home Assistant turns the heater off when the countdown ends.</p>`
      + lbl('Settings') + group([row({ icon: 'lock', c: 'var(--ink3)', title: 'Child lock', right: sw(h.lock, `data-tog="heaters.${id}.lock"`, 'Child lock') }), row({ icon: 'sun', c: 'var(--amber)', title: 'Backlight', right: sw(h.backlight, `data-tog="heaters.${id}.backlight"`, 'Backlight') })])
      + lbl('Today · metered') + group([row({ title: 'Power now', v: W(h.draw) }), row({ title: 'Heated today', v: hm(h.hours) }), row({ title: 'Energy today', v: h.kwh.toFixed(1) + ' kWh' })]);
  }
  function sDyson(id) {
    const s = dySt(id), d = s.d;
    let h = `<div class="hero"><div class="what" style="--c:${s.heating ? 'var(--orange)' : d.on ? 'var(--teal)' : 'var(--ink2)'}">${s.word}</div><div class="small muted">${d.temp}° · ${d.rh}% humidity · Air ${AQ_W[s.worst].toLowerCase()}</div></div>`;
    h += `<div class="big-step" style="--c:var(--teal)"><button data-step="dysons.${id}.speed" data-d="-1" data-then="dyManual" data-id="${id}" aria-label="Slower">−</button><div class="n">${d.auto ? 'A' : d.speed}<small>${d.auto ? 'AUTO' : 'SPEED'}</small></div><button data-step="dysons.${id}.speed" data-d="1" data-then="dyManual" data-id="${id}" aria-label="Faster">+</button></div>`;
    h += group([row({ title: 'Power', right: sw(d.on, `data-tog="dysons.${id}.on"`, 'Power') }), row({ title: 'Auto', sub: 'Speed follows the air', right: sw(d.auto, `data-tog="dysons.${id}.auto"`, 'Auto') })]);
    h += lbl('Mode') + seg(`dysons.${id}.mode`, [['off', 'Off'], ['cool', 'Cool'], ['heat', 'Heat']], d.mode);
    if (d.mode === 'heat') h += `<div class="big-step" style="--c:var(--orange);margin-top:14px"><button data-step="dysons.${id}.heatTo" data-d="-1" aria-label="Lower">−</button><div class="n" style="font-size:48px">${d.heatTo}°<small>HEAT TO</small></div><button data-step="dysons.${id}.heatTo" data-d="1" aria-label="Raise">+</button></div>`;
    h += lbl('Airflow') + seg(`dysons.${id}.flow`, d.flows.map(f => [f, f]), d.flow);
    h += lbl('Settings') + group([row({ title: 'Swing', right: sw(d.swing, `data-tog="dysons.${id}.swing"`, 'Swing') }), row({ title: 'Night mode', right: sw(d.night, `data-tog="dysons.${id}.night"`, 'Night') }), row({ title: 'Sensing', sub: 'Watches the air while off', right: sw(d.sensing, `data-tog="dysons.${id}.sensing"`, 'Sensing') })]);
    if (d.sens) h += lbl('Air sensitivity') + seg(`dysons.${id}.sens`, [['Off', 'Off'], ['Good', 'Low'], ['Default', 'Std'], ['Sensitive', 'High'], ['Very Sensitive', 'Max']], d.sens);
    h += lbl('Air quality') + group(d.aq.map(([k, v]) => { const b = aqBand(k, v); return row({ title: k, v: `<span style="color:${AQ_C[b]}">${AQ_W[b]}</span> · ${v}` }); }));
    h += lbl('Filter') + group([row({ title: d.carbon != null ? 'HEPA filter' : 'Filter', v: d.filter + '%', warn: d.filter < 10 }), ...(d.carbon != null ? [row({ title: 'Carbon filter', v: d.carbon + '%' })] : []),
      row({ btn: `data-act="dyReset" data-id="${id}"`, cls: 'danger', title: UI.armed['dy:' + id] ? 'Tap again to reset' : 'Reset filter life' })]);
    h += lbl('Today') + group([row({ title: 'Running', v: hm(d.runtime) }), row({ title: 'Heating', v: hm(d.heated) }), row({ title: 'Power now · estimated', v: s.heating ? '1.50 kW' : d.on ? '6 W' : '0 W' })]);
    return h;
  }
  function sDehum(id) {
    const s = deSt(id), u = s.u;
    let h = `<div class="hero"><div class="what" style="--c:${s.act === 'drying' ? 'var(--teal)' : s.act === 'full' ? 'var(--red)' : 'var(--ink2)'}">${s.word}</div><div class="small muted">${u.room} · ${u.rh}% humidity · ${u.temp}°</div></div>`;
    h += `<div class="tank" style="--l:${u.level}"><i></i><b>${u.full ? 'Full' : u.rh + '%'}</b></div>`;
    h += `<div class="big-step" style="--c:var(--teal)"><button data-step="dehum.${id}.target" data-d="-5" aria-label="Lower">−</button><div class="n">${u.target}%<small>TARGET</small></div><button data-step="dehum.${id}.target" data-d="5" aria-label="Raise">+</button></div>`;
    h += group([row({ title: 'Power', right: sw(u.on, `data-tog="dehum.${id}.on"`, 'Power') })]);
    h += lbl('Fan') + seg(`dehum.${id}.fan`, u.fans.map(f => [f, f]), u.fan) + lbl('Mode') + seg(`dehum.${id}.mode`, u.modes.map(f => [f, f]), u.mode);
    h += lbl('Readings') + group([row({ icon: 'thermo', c: 'var(--orange)', title: 'Temperature', v: u.temp + '°' }), row({ icon: 'drop', c: 'var(--teal)', title: 'Water tank', v: u.full ? 'Full' : u.level + '%', warn: u.full }),
      row({ icon: 'filter', c: 'var(--ink3)', title: 'Filter', v: u.filterDue ? 'Replace' : 'OK', warn: u.filterDue })]);
    if (u.full) h += `<button class="btn grey" data-act="emptied" data-id="${id}">I've emptied it</button>`;
    h += lbl('Features') + group([...(u.ion != null ? [row({ title: 'Ion', right: sw(u.ion, `data-tog="dehum.${id}.ion"`, 'Ion') })] : []), ...(u.pump != null ? [row({ title: 'Pump', right: sw(u.pump, `data-tog="dehum.${id}.pump"`, 'Pump') })] : []),
      row({ title: 'Beep', right: sw(u.beep, `data-tog="dehum.${id}.beep"`, 'Beep') })]);
    h += lbl('Energy · metered') + group([row({ title: 'Now', v: W(u.on ? u.now : 1) }), row({ title: 'Today', v: u.today.toFixed(1) + ' kWh' }), row({ title: 'This month', v: u.month.toFixed(1) + ' kWh' })]);
    return h;
  }
  function sLight(id) {
    const [ri, li] = id.split('.').map(Number), l = H.lights[ri].lights[li];
    let h = lightPane(ri, li, true);
    if (l.kind !== 'onoff') h += lbl('Brightness') + rng(`data-ract="lightB" data-id="${id}" aria-label="Brightness"`, l.on ? l.b : 0, 0, 100, `rgb(${lrgb(l)})`, 'fat');
    if (l.split) h += lbl('Lamps') + group(LAMPS.map(([who, n]) => { const L = l.split[who]; return row({ title: n, sub: L.on ? L.b + '%' : 'Off', right: sw(L.on, `data-act="lamp" data-id="${who}"`, n) }); }));
    else if (l.members) h += lbl('Lamps in the group') + group(l.members.map(m => row({ title: esc(m), v: lightWord(l) })));
    h += lbl('Energy · estimated') + group([row({ title: 'Now', v: l.on ? W(l.kind === 'strip' ? 12 * l.b / 100 : 10 * (l.members ? l.members.length : 1) * (l.kind === 'onoff' ? 2 : l.b / 100)) : '0 W' })]);
    return h;
  }
  function sSpeaker(id) {
    const s = SP[id], lead = s.inGroup ? SP[s.inGroup] : s, L = s.inGroup || id;
    let h = '';
    if (lead.state !== 'idle') {
      h += `<div class="cover xl" style="--art:${lead.art}"></div><div class="hero"><b style="font-size:20px">${esc(lead.title)}</b><div class="muted">${esc(lead.artist)}${lead.album ? ' · ' + esc(lead.album) : ''}</div></div>`;
      if (lead.len) h += rng(`data-range="speakers.${L}.pos" aria-label="Position"`, Math.round(lead.pos), 0, lead.len, 'var(--ink)') + `<div class="seek"><span data-pos="${L}">${mmss(lead.pos)}</span><span>-${mmss(lead.len - lead.pos)}</span></div>`
        + `<div class="transport"><button data-act="seek" data-id="${L}" data-v="-15" aria-label="Back 15 seconds">${ic('back15', 28)}</button><button data-act="prev" data-id="${L}" aria-label="Previous">${ic('prev', 30)}</button>`
        + `<button class="pp" data-act="pp" data-id="${L}" aria-label="${lead.state === 'playing' ? 'Pause' : 'Play'}">${ic(lead.state === 'playing' ? 'pause' : 'play', 36)}</button><button data-act="next" data-id="${L}" aria-label="Next">${ic('next', 30)}</button><button data-act="seek" data-id="${L}" data-v="15" aria-label="Forward 15 seconds">${ic('fwd15', 28)}</button></div>`;
    } else h += `<div class="hero"><div class="what">Idle${s.battery != null ? ` · ${s.battery}% battery` : ''}</div></div><button class="btn" data-act="playIdle" data-id="${id}">Play something</button>`;
    h += lbl('Volume') + `<div class="hd${lead.state === 'playing' ? ' playing' : ''}" style="gap:12px"><button data-tog="speakers.${id}.mute" aria-label="Mute" style="color:var(--ink2)">${ic(s.mute ? 'mute' : 'vol', 22)}</button>${meter(id, s.mute ? 0 : s.vol, null, true)}<span class="vlabel">${s.vol}</span></div>`
      + `<div class="presets">${[10, 25, 50, 75].map(v => `<button data-set="speakers.${id}.vol" data-v="${v}" aria-pressed="${s.vol === v}">${v}</button>`).join('')}</div>`;
    if (s.nest) return h + `<p class="note">The Nest Mini plays from Google; it isn't a Sonos, so there's nothing more to set.</p>`;
    h += lbl('Play') + group([row({ icon: 'shuffle', c: 'var(--blue)', title: 'Shuffle', right: sw(s.shuffle, `data-tog="speakers.${id}.shuffle"`, 'Shuffle') }), row({ icon: 'repeat', c: 'var(--blue)', title: 'Repeat', v: s.repeat === 'off' ? 'Off' : s.repeat === 'all' ? 'All' : 'One', btn: `data-act="repeat" data-id="${id}"` }),
      row({ title: 'Crossfade', right: sw(s.crossfade, `data-tog="speakers.${id}.crossfade"`, 'Crossfade') }), row({ title: 'Loudness', right: sw(s.loud, `data-tog="speakers.${id}.loud"`, 'Loudness') })]);
    h += lbl('Favorites') + group(H.favs.map(f => row({ btn: `data-act="fav" data-id="${id}" data-v="${esc(f)}"`, title: esc(f), right: `<span style="color:var(--blue)">${ic('play2', 18, 2)}</span>` })));
    h += lbl('Sleep timer') + seg(`speakers.${id}.sleep`, [[0, 'Off'], [15, '15 min'], [30, '30 min'], [60, '1 hour']], s.sleep);
    h += lbl('Tone') + `<div class="group" style="padding:6px 16px">${[['bass', 'Bass'], ['treble', 'Treble']].map(([k, n]) => `<div class="hd" style="min-height:48px"><span style="width:60px">${n}</span>${rng(`data-range="speakers.${id}.${k}" aria-label="${n}"`, s[k], -10, 10, 'var(--blue)')}<span class="vlabel" data-out="speakers.${id}.${k}">${s[k] > 0 ? '+' : ''}${s[k]}</span></div>`).join('')}</div>`;
    if (s.ht) h += lbl('Home theatre') + group([row({ title: 'Night sound', right: sw(s.night, `data-tog="speakers.${id}.night"`, 'Night sound') }), row({ title: 'Speech enhancement', right: sw(s.speech, `data-tog="speakers.${id}.speech"`, 'Speech') }),
      row({ title: 'Sub level', right: stepper(`speakers.${id}.sub`, s.sub, 1, '') })]);
    if (s.battery != null) h += lbl('Battery') + group([row({ title: 'Battery', v: s.battery + '%' }), row({ title: 'On its base', v: s.charging ? 'Charging' : 'No' })]);
    const others = Object.keys(SP).filter(k => k !== L && !SP[k].nest && !SP[k].ht);
    h += lbl('Group with') + group(others.map(k => row({ title: SP[k].name, sub: SP[k].inGroup === L ? 'In this group' : spWord(SP[k]), right: sw(SP[k].inGroup === L, `data-act="group" data-id="${L}" data-v="${k}"`, SP[k].name) })))
      + `<div class="btns" style="margin-top:10px"><button class="btn grey" data-act="party" data-id="${L}">House party</button><button class="btn grey" data-act="handoff" data-id="${L}">${UI.armed['ho:' + L] ? 'Tap again' : 'Hand off'}</button></div>`
      + `<p class="note">Hand off moves the music to the Move: tap twice.</p>`;
    return h;
  }
  function sATV() {
    const A = H.tvs.atv;
    return group([row({ title: 'Power', right: sw(A.on, 'data-tog="tvs.atv.on"', 'Power') })]) + lbl('Apps') + `<div class="apps">${A.apps.map(a => `<button data-set="tvs.atv.app" data-v="${esc(a)}" data-then="atvOn" style="${A.app === a && A.on ? 'background:var(--indigo);color:#fff' : ''}">${esc(a)}</button>`).join('')}</div>`
      + lbl('Remote') + `<div class="transport"><button data-act="toast" data-v="Back" aria-label="Back">${ic('left', 26)}</button><button class="pp" data-act="toast" data-v="Play / pause" aria-label="Play or pause">${ic('play', 34)}</button><button data-act="toast" data-v="Home" aria-label="Home">${ic('tv', 26)}</button></div>`;
  }
  function sLG() {
    const T = H.tvs.tv;
    return group([row({ title: 'Power', right: sw(T.on, 'data-tog="tvs.tv.on"', 'Power') })]) + lbl('Source') + seg('tvs.tv.source', T.sources.map(x => [x, x]), T.source)
      + lbl('Volume') + `<div class="group" style="padding:10px 16px"><div class="hd">${stepper('tvs.tv.vol', T.vol, 1, '')}</div></div>`
      + lbl('Energy · estimated') + group([row({ title: 'Now', v: T.on ? '120 W' : '0.5 W' })]);
  }
  function sCam(id) {
    const c = H.security.cams.find(x => x.id === id), pl = pauseLeft(id), busy = UI.armed['snap:' + id];
    return `<div class="cam${busy ? ' busy' : ''}" style="--still:${c.still}"><span class="tl"><span class="tag${camSt(c) === 'ACTIVE' ? ' act' : ''}">${camSt(c)}</span></span>${busy ? '<span class="spin"><i></i></span>' : ''}<span class="bl"><b>${c.name}</b><span>${agoW(c.shot)}</span></span></div>`
      + `<button class="btn" data-act="snap" data-id="${id}" ${busy ? 'disabled' : ''}>${busy ? 'Taking a snapshot…' : 'Snapshot'}</button><p class="note">Blink sends stills, not video: a new one takes a few seconds.</p>`
      + lbl('Motion') + group([row({ title: 'Motion detection', right: sw(c.motion, `data-tog="security.cams.${H.security.cams.indexOf(c)}.motion"`, 'Motion detection') }),
        row({ title: 'Pause motion detection', v: pl ? `${pl} min left` : '' })]) + `<div style="margin-top:10px">${segAct('pause', id, PAUSES, pl ? H.security.pauses[id].m : '')}</div>`
      + lbl('Camera') + group([row({ title: 'State', v: camSt(c) }), row({ title: 'Last still', v: agoW(c.shot) }), row({ title: 'Battery', v: c.batt ? 'Low' : 'OK', warn: c.batt })]);
  }
  function sDoor() {
    const D = H.security.door;
    return `<div class="cam" style="--still:linear-gradient(170deg,#6A7480,#39414B 60%,#22272D)"><span class="tl"><span class="tag${D.live ? ' live' : ''}">${D.live ? 'LIVE' : 'DOORBELL'}</span></span><span class="bl"><b>Front Door</b><span>${D.live ? new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : 'Last still'}</span></span></div>`
      + `<button class="btn${D.live ? ' grey' : ''}" data-tog="security.door.live">${D.live ? 'Stop live view' : 'Live view'}</button><p class="note">In this test page the live view is a stand-in picture.</p>`
      + lbl('Recent') + group([row({ icon: 'bell', c: 'var(--orange)', title: 'Doorbell rang', v: agoW(D.chime) }), row({ icon: 'motion', c: 'var(--blue)', title: 'Motion', v: agoW(D.motion) })]);
  }
  function sVac() {
    const V = H.vacs.shark;
    return `<div class="hero"><div class="what" style="--c:${V.state === 'cleaning' ? 'var(--green)' : 'var(--ink2)'}">${{ cleaning: 'Cleaning', returning: 'Heading home', paused: 'Paused', docked: 'Docked · charged' }[V.state]}</div><div class="small muted">${V.battery}% battery</div></div>`
      + `<div class="btns" style="margin-top:10px"><button class="btn" data-act="vac" data-v="${V.state === 'cleaning' ? 'pause' : 'start'}">${V.state === 'cleaning' ? 'Pause' : 'Start'}</button><button class="btn grey" data-act="vac" data-v="dock">Dock</button></div>`
      + `<div class="btns" style="margin-top:8px"><button class="btn grey" data-act="vac" data-v="stop">Stop</button><button class="btn grey" data-act="vac" data-v="find">Find</button></div>`
      + lbl('Suction') + seg('vacs.shark.suction', [['Eco', 'Eco'], ['Normal', 'Normal'], ['Max', 'Max']], V.suction) + `<p class="note">The Shark's own Eco runs harder, so Eco here sends Normal, as the dashboard does.</p>`
      + lbl('Clean mode') + seg('vacs.shark.clean', [['Normal', 'Normal'], ['Matrix', 'Matrix']], V.clean)
      + lbl('Rooms') + `<div class="btns">${['Room', 'Room 1', 'Room 2'].map(r => `<button class="btn grey" data-act="vac" data-v="room" data-r="${r}">${r}</button>`).join('')}</div><p class="note">Which room is which isn't known yet.</p>`
      + lbl('Signal') + group([row({ title: 'Wi-Fi', v: V.wifi + ' dBm' })]);
  }
  function sBlinds() {
    const B = H.blinds;
    return `<div class="row2"><div class="blind" style="--o:${B.left}"><i></i></div><div class="blind" style="--o:${B.right}"><i></i></div></div>`
      + lbl('Both') + segAct('blinds', 'all', [[0, 'Closed'], [25, '25%'], [50, '50%'], [75, '75%'], [100, 'Open']], B.left === B.right ? B.all : '')
      + `<div class="group" style="padding:6px 16px;margin-top:14px">${[['left', 'Left'], ['right', 'Right']].map(([k, n]) => `<div class="hd" style="min-height:52px"><span style="width:44px">${n}</span>${rng(`data-range="blinds.${k}" data-then="blindsAll" aria-label="${n} blind"`, B[k], 0, 100, 'var(--teal)')}<span class="vlabel" data-out="blinds.${k}">${B[k]}</span></div>`).join('')}</div>`
      + `<p class="note">Taps set the blinds' targets; the automations move them, as on the dashboard.</p>`
      + lbl('Modes') + group([row({ title: 'Guest mode', sub: 'The automations leave the blinds alone', right: sw(B.guest, 'data-tog="blinds.guest"', 'Guest mode') })])
      + (B.departure ? '<p class="note" style="color:var(--red)">The VELUX gateway is in departure mode: the blinds won\'t move.</p>' : '');
  }
  function sHatch() {
    const N = H.hatch;
    return lbl('Light') + group([row({ title: 'Light', right: sw(N.light, 'data-tog="hatch.light"', 'Light') })])
      + `<div class="group" style="padding:6px 16px;margin-top:10px"><div class="hd" style="min-height:48px">${ic('sun', 18)}${rng('data-range="hatch.b" aria-label="Brightness"', N.b, 0, 100, `rgb(${H.hatchColors[N.color][1]})`)}<span class="vlabel" data-out="hatch.b">${N.b}</span></div></div>`
      + `<div class="swatches">${H.hatchColors.map(([n, c], i) => `<button data-set="hatch.color" data-v="${i}" style="--s:${c}" aria-label="${n}" aria-pressed="${N.color === i}"></button>`).join('')}</div>`
      + lbl('Sound') + group([row({ title: 'Sound', right: sw(N.sound, 'data-tog="hatch.sound"', 'Sound') }), row({ title: 'Volume', right: stepper('hatch.vol', N.vol, 5, '%') })])
      + `<div class="chips" style="margin-top:10px">${H.hatchSounds.map(x => `<button class="chip${N.soundName === x ? ' lit' : ''}" data-set="hatch.soundName" data-v="${x}">${x}</button>`).join('')}</div>`
      + lbl('Routines') + `<div class="btns"><button class="btn" style="background:var(--indigo)" data-act="hatchR" data-v="bed">Bedtime</button><button class="btn" style="background:var(--green)" data-act="hatchR" data-v="morning">Morning</button></div>`
      + lbl('Settings') + group([row({ title: 'Clock', right: sw(N.clock, 'data-tog="hatch.clock"', 'Clock') }), row({ title: 'Toddler lock', right: sw(N.lock, 'data-tog="hatch.lock"', 'Toddler lock') })]);
  }
  function sEnergy(key) {
    const E = energy(), e = E[key], name = (EN_ROWS.find(x => x[0] === key) || [, 'Energy'])[1];
    const dev = [];
    if (key === 'total' || key === 'light') allLights().filter(x => x.l.on).forEach(({ l }) => dev.push([l.name, l.kind === 'strip' ? 12 * l.b / 100 : l.kind === 'onoff' ? 20 : 10 * (l.members ? l.members.length : 1) * l.b / 100]));
    if (key === 'total' || key === 'climate') { for (const id in H.thermos) { const s = tSt(id); if (s.act === 'cooling') dev.push([s.t.name + ' AC', { lr: 2710, of: 2060, wm: 730 }[id]]); } for (const id in H.heaters) if (H.heaters[id].draw) dev.push([H.heaters[id].name, H.heaters[id].draw]); }
    if (key === 'total' || key === 'fans' || key === 'dyheat') for (const id in H.dysons) { const s = dySt(id); if (s.d.on) dev.push([s.d.name, s.heating ? 1500 : key === 'dyheat' ? 0 : 6]); }
    if (key === 'total' || key === 'fans' || key === 'up' || key === 'cube') for (const id in H.dehum) if ((key !== 'up' || id === 'up') && (key !== 'cube' || id === 'cube')) dev.push([H.dehum[id].name + ' dehumidifier', H.dehum[id].on ? H.dehum[id].now : 1]);
    if (key === 'tv') dev.push(['Living Room TV', H.tvs.tv.on ? 120 : 0.5]);
    return `<div class="hero"><div class="n" style="font-size:52px;font-weight:200;letter-spacing:-.03em">${W(e.now)}</div><div class="muted">${name} · now</div></div>`
      + group([row({ title: 'Today', v: e.today.toFixed(1) + ' kWh' }), row({ title: 'This month', v: e.month.toFixed(0) + ' kWh' }), row({ title: 'Cost this month', v: '$' + (e.month * EN_RATE).toFixed(2), sub: 'At $0.13 a kWh' })])
      + lbl('Each device now') + (dev.length ? group(dev.filter(d => d[1] > 0).sort((a, b) => b[1] - a[1]).map(([n, w]) => row({ title: esc(n), v: W(w) }))) : '<p class="note">Nothing drawing power right now.</p>')
      + `<p class="note">${key === 'total' ? 'Total is lighting, climate, and fans & dehumidifiers, not the whole house.' : 'Lights are estimated at 10 W a bulb by brightness; plugs and heaters are metered.'} Sample numbers.</p>`;
  }
  function sActivity() {
    const K = { lights: ['bulbF', 'var(--amber)'], security: ['motion', 'var(--red)'], routine: ['play2', 'var(--indigo)'], covers: ['blinds', 'var(--teal)'], presence: ['house', 'var(--green)'], climate: ['thermo', 'var(--orange)'], vacuum: ['vacuum', 'var(--mint)'] };
    return group(H.activity.slice(0, 10).map(x => { const [i, c] = K[x.k] || ['clock', 'var(--ink3)']; return row({ icon: i, c, title: `${esc(x.what)}`, sub: `${esc(x.did)} · ${x.by}`, v: clockW(x.t) }); }))
      + '<p class="note">The last 10 from the house\'s activity log, newest first.</p>';
  }
  function sBug() {
    return `<p class="note" style="margin-top:0">What went wrong? It goes into the house's bug log.</p><textarea id="bugText" placeholder="What happened, and where"></textarea><button class="btn" data-act="sendBug">Send</button>`;
  }
  function sAuto(id) {
    const a = AUTOS.find(x => x.id === id); if (!a) return '';
    const trig = [].concat(a.triggers || a.trigger || []), cond = [].concat(a.conditions || a.condition || []), act = [].concat(a.actions || a.action || []);
    const ctl = [...ents(act)], watch = [...ents(trig), ...ents(cond)].filter(e => !ctl.includes(e)), first = (a.description || '').split(/(?<=\.)\s/)[0];
    const scripts = [...new Set(JSON.stringify(act).match(/script\.[a-z0-9_]+/g) || [])];
    return group([row({ title: 'On', sub: auOn(a) ? 'Runs when its time comes' : "Won't run until it's switched back on", right: sw(auOn(a), `data-act="auto" data-id="${esc(id)}"`, 'On') }), row({ title: 'Last ran', v: agoW(lastRan(a)) + ' · sample' })])
      + (first ? lbl('What it does') + `<div class="group" style="padding:14px 16px;font-size:15px;line-height:1.4">${esc(first)}</div>` : '')
      + (trig.length ? lbl('Runs') + group(trig.map(t => row({ icon: 'clock', c: 'var(--indigo)', title: esc(trigW(t)) }))) : '')
      + (cond.length ? lbl('Only if') + group([row({ title: `${plural(cond.length, 'condition')} must hold` })]) : '')
      + (ctl.length ? lbl('Controls') + group(ctl.slice(0, 14).map(e => row({ title: esc(pretty(e)), sub: e.split('.')[0].replace(/_/g, ' ') }))) : '')
      + (watch.length ? lbl('Watches') + group(watch.slice(0, 14).map(e => row({ title: esc(pretty(e)), sub: e.split('.')[0].replace(/_/g, ' ') }))) : '')
      + (scripts.length ? lbl('Starts') + group(scripts.map(s => row({ title: esc(pretty(s)) }))) : '')
      + (a.description && a.description !== first ? lbl('Description') + `<div class="group" style="padding:14px 16px;font-size:14px;line-height:1.45;color:var(--ink2)">${esc(a.description)}</div>` : '');
  }
  function sSettings() {
    return `<div class="preview"><i></i>Preview · sample data. This test page doesn't reach Home Assistant.</div>`
      + lbl('Home Assistant') + group([row({ icon: 'house', c: 'var(--teal)', title: 'Status', v: 'Preview' }), row({ btn: 'data-act="toast" data-v="Connecting is in the real Home app"', icon: 'link', c: 'var(--blue)', title: 'Connect', chev: true })])
      + lbl('Appearance') + `<div class="seg" role="group">${[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<button data-act="theme" data-v="${v}" aria-pressed="${look.theme === v}">${l}</button>`).join('')}</div>`
      + lbl('Glass') + `<div class="group" style="padding:6px 16px"><div class="hd" style="min-height:52px"><span class="small muted">Clear</span>${rng('data-ract="glass" aria-label="Glass, clear to tinted"', look.glass, 0, 100, 'var(--blue)')}<span class="small muted">Tinted</span></div></div>`
      + `<p class="note">Every pane follows it.</p>`
      + lbl('Try') + group([row({ icon: 'leaf', c: 'var(--green)', title: "Everyone's away", sub: 'Shows the Away pill and the Nests in Eco', right: sw(H.away, 'data-tog="away" data-then="away"', "Everyone's away") }),
        row({ btn: 'data-act="reset"', icon: 'sync', c: 'var(--ink3)', title: 'Start the sample again' })])
      + lbl('Security') + group([row({ btn: 'data-act="toast" data-v="Not in this test page"', icon: 'key', c: 'var(--ink3)', title: 'Settings PIN', chev: true }), row({ btn: 'data-act="toast" data-v="Not in this test page"', icon: 'share', c: 'var(--blue)', title: 'Share Home', chev: true }),
        row({ btn: 'data-act="toast" data-v="Not in this test page"', icon: 'phone', c: 'var(--green)', title: 'Devices with access', chev: true })])
      + `<p class="note">Home in the aOS look · Labs. The real Home app is unchanged.</p>`;
  }
  const SHEETS = {
    thermo: [id => H.thermos[id].name, sThermo], heater: [id => H.heaters[id].name, sHeater], dyson: [id => H.dysons[id].name, sDyson], dehum: [id => H.dehum[id].name + ' dehumidifier', sDehum],
    light: [id => { const [r, l] = id.split('.'); return H.lights[r].lights[l].name; }, sLight], speaker: [id => SP[id].name, sSpeaker], atv: [() => 'Apple TV', sATV], lgtv: [() => 'Living Room TV', sLG],
    cam: [id => H.security.cams.find(c => c.id === id).name, sCam], door: [() => 'Front Door', sDoor], vac: [() => 'Shark', sVac], blinds: [() => 'Office Blinds', sBlinds], hatch: [() => "Olivia's Hatch", sHatch],
    energy: [k => (EN_ROWS.find(x => x[0] === k) || [, 'Energy'])[1] + ' energy', sEnergy], activity: [() => 'Activity', sActivity], bug: [() => 'Report a Bug', sBug],
    auto: [id => (AUTOS.find(a => a.id === id) || {}).alias || 'Automation', sAuto], settings: [() => 'Settings', sSettings],
  };

  // ============ Drawing ============
  const scroller = $('scroll');
  function render() {
    const v = VIEWS[UI.view];
    $('title').textContent = v.name; $('mini').textContent = v.name; $('sum').textContent = summary(UI.view);
    $('back').innerHTML = ic('left', 22, 2.4) + (v.parent ? 'More' : 'Labs');
    $('back').setAttribute('aria-label', v.parent ? 'Back to More' : 'Back to Labs');
    $('view').innerHTML = { fav: vFav, climate: vClimate, lights: vLights, media: vMedia, more: vMore, security: vSecurity, around: vAround, autos: vAutos }[UI.view]();
    const tab = v.parent || UI.view;
    $('tabs').innerHTML = Object.entries(VIEWS).filter(([, x]) => x.tab).map(([id, x]) => `<button role="tab" data-tab="${id}" aria-selected="${id === tab}">${ic(id === tab && id === 'fav' ? 'star' : id === 'fav' ? 'starO' : x.icon, 25)}${x.name}</button>`).join('');
    if (UI.sheet) drawSheet();
  }
  function drawSheet() {
    const [kind, id] = UI.sheet, S = SHEETS[kind], body = $('shBody'), top = body.scrollTop;
    $('shTitle').textContent = S[0](id); body.innerHTML = S[1](id); body.scrollTop = top;
    $('shLeft').classList.toggle('ghost', true);
  }
  function openSheet(kind, id) { UI.sheet = [kind, id]; $('shBody').scrollTop = 0; drawSheet(); $('scrim').classList.add('open'); $('sheet').classList.add('open'); }
  function closeSheet() { $('scrim').classList.remove('open'); $('sheet').classList.remove('open'); UI.sheet = null; render(); }
  function go(view) { if (UI.view === 'lights' && view !== 'lights') UI.rooms.clear(); UI.view = view; render(); scroller.scrollTop = 0; $('bar').classList.remove('solid'); }

  $('gear').innerHTML = ic('dots', 22); $('shDone').innerHTML = ic('check', 20, 2.6); $('shLeft').innerHTML = ic('left', 20, 2.4);
  scroller.addEventListener('scroll', () => $('bar').classList.toggle('solid', scroller.scrollTop > 36), { passive: true });

  // ============ What the buttons do ============
  const HOOK = {
    tgap(el) { const t = H.thermos[el.dataset.id]; if (t.mode === 'heat_cool' && t.cool - t.heat < 3) { if (el.dataset.step.endsWith('heat')) t.cool = Math.min(90, t.heat + 3); else t.heat = Math.max(50, t.cool - 3); } t.eco = false; },
    tmode(el) { const t = H.thermos[el.dataset.id]; if (t.mode !== 'off') t.last = t.mode; log(t.name, 'Mode ' + t.modes.find(m => m[0] === t.mode)[1], 'climate'); },
    heater(el) { const h = H.heaters[el.dataset.id]; h.draw = h.on ? (h.watts === '1500 W' ? 1480 : 740) : 0; },
    dyManual(el) { H.dysons[el.dataset.id].auto = false; H.dysons[el.dataset.id].on = true; },
    atvOn() { H.tvs.atv.on = true; },
    silenced() { toast('Alert silenced'); },
    away() { if (H.away) H.ecoSince = Date.now(); log('House', H.away ? 'Away · Eco on' : 'Someone home', 'presence', 'Auto'); },
    blindsAll() { const B = H.blinds; B.all = Math.round((B.left + B.right) / 2); },
  };
  const ACT = {
    tpower(el) { const t = H.thermos[el.dataset.id]; if (t.mode === 'off') t.mode = t.last || t.modes[0][0]; else { t.last = t.mode; t.mode = 'off'; } },
    exitEco(el) { H.thermos[el.dataset.id].eco = false; },
    emptied(el) { const u = H.dehum[el.dataset.id]; u.full = false; u.level = 0; toast('Tank marked as emptied'); },
    routine(el) {
      const id = el.dataset.id;
      if (id === 'bug') return openSheet('bug', '');
      if (id === 'sitter') { H.sitter = !H.sitter; log('Babysitter', H.sitter ? 'Armed' : 'Off', 'routine'); return; }
      const n = ROUTINES.find(r => r[0] === id)[1]; H.routines[id] = Date.now() + 3000; log(n, 'Ran', 'routine'); toast(n + ' · running');
      if (id === 'goodnight') allLights().forEach(({ l }) => { if (!/Outdoor|Garage/.test(l.name)) lightOn(l, false); });
      if (id === 'evening') ['floor', 'side', 'ofront'].forEach(k => allLights().filter(x => x.l.id === k).forEach(({ l }) => { lightOn(l, true); l.b = 40; }));
      if (id === 'hatch') { H.hatch.light = true; H.hatch.color = 3; }
      setTimeout(render, 3100);
    },
    weather() { toast('Opens Weather in aOS'); },
    allLights(el) { const on = el.dataset.v === '1'; allLights().forEach(({ l }) => { if (on && /Outdoor|Garage/.test(l.name)) return; lightOn(l, on); }); log('All lights', on ? 'On' : 'Off', 'lights'); },
    lamp(el) { const L = lampOf(el.dataset.id); L.on = !L.on; if (L.on && !L.b) L.b = 50; syncSplit(H.lights[4].lights[0]); },
    lampP(el) { const L = lampOf(el.dataset.id); L.b = +el.dataset.v; L.on = true; syncSplit(H.lights[4].lights[0]); },
    light(el) { const [r, i] = el.dataset.id.split('.'), l = H.lights[r].lights[i]; lightOn(l, !l.on); },
    lightP(el) { const [r, i] = el.dataset.id.split('.'); lightB(H.lights[r].lights[i], +el.dataset.v); },
    strip(el) { const [r, i] = el.dataset.id.split('.'), l = H.lights[r].lights[i]; l.sw = el.dataset.v; lightOn(l, true); },
    room(el) { const id = el.dataset.id; UI.rooms.has(id) ? UI.rooms.delete(id) : UI.rooms.add(id); },
    roomPower(el) { const r = H.lights[el.dataset.id], on = roomOn(r) === 0; r.lights.forEach(l => lightOn(l, on)); },
    roomP(el) { H.lights[el.dataset.id].lights.forEach(l => { if (l.kind !== 'onoff') lightB(l, +el.dataset.v); }); },
    pp(el) { const s = SP[el.dataset.id], to = s.state === 'playing' ? 'paused' : 'playing'; groupOf(el.dataset.id).forEach(k => SP[k].state = to); },
    next(el) { const s = SP[el.dataset.id]; const i = (H.favs.indexOf(s.title) + 1) % H.favs.length; s.title = H.favs[i]; s.pos = 0; s.state = 'playing'; },
    prev(el) { const s = SP[el.dataset.id]; s.pos = 0; },
    seek(el) { const s = SP[el.dataset.id]; s.pos = clamp(s.pos + +el.dataset.v, 0, s.len - 1); },
    repeat(el) { const s = SP[el.dataset.id]; s.repeat = { off: 'all', all: 'one', one: 'off' }[s.repeat]; },
    fav(el) { const s = SP[el.dataset.id]; const L = s.inGroup ? SP[s.inGroup] : s; Object.assign(L, { title: el.dataset.v, artist: 'Sonos favorite', album: '', state: 'playing', pos: 0, len: L.len || 240, art: L.art || 'linear-gradient(135deg,#8193BC,#BE918F)' }); toast('Playing ' + el.dataset.v); },
    playIdle(el) { const s = SP[el.dataset.id]; Object.assign(s, { state: 'playing', title: H.favs[0], artist: 'Sonos favorite', album: '', pos: 0, len: 238, art: 'linear-gradient(135deg,#BC9C68,#6FA597)' }); },
    group(el) { const L = el.dataset.id, k = el.dataset.v, s = SP[k], g = SP[L].group || (SP[L].group = []);
      if (s.inGroup === L) { delete s.inGroup; g.splice(g.indexOf(k), 1); s.state = 'idle'; } else { s.inGroup = L; g.push(k); s.state = SP[L].state; } },
    party(el) { const L = el.dataset.id; Object.keys(SP).filter(k => k !== L && !SP[k].nest && !SP[k].ht).forEach(k => { if (SP[k].inGroup !== L) ACT.group({ dataset: { id: L, v: k } }); }); toast('House party: every speaker'); },
    handoff(el) { const k = 'ho:' + el.dataset.id; if (!UI.armed[k]) { UI.armed[k] = 1; setTimeout(() => { delete UI.armed[k]; render(); }, 3000); return; }
      delete UI.armed[k]; const from = SP[el.dataset.id], to = SP.mv; Object.assign(to, { state: 'playing', title: from.title, artist: from.artist, album: from.album, art: from.art, pos: from.pos, len: from.len }); from.state = 'paused'; toast('Handed off to the Move'); },
    arm() { H.security.armed = !H.security.armed; log('Blink', H.security.armed ? 'Armed' : 'Disarmed', 'security'); },
    pause(el) { const id = el.dataset.id, m = +el.dataset.v; H.security.pauses[id] = { m, until: Date.now() + m * 60e3 }; toast(`Motion paused for ${PAUSES.find(p => p[0] === m)[1]}`); },
    snap(el) { const id = el.dataset.id, k = 'snap:' + id; if (UI.armed[k]) return; UI.armed[k] = 1; setTimeout(() => { delete UI.armed[k]; H.security.cams.find(c => c.id === id).shot = Date.now(); render(); }, 2500); },
    vac(el) { const V = H.vacs.shark, v = el.dataset.v;
      if (v === 'start' || v === 'room') { V.state = 'cleaning'; if (v === 'room') toast('Cleaning ' + el.dataset.r); } else if (v === 'pause') V.state = 'paused'; else if (v === 'dock' || v === 'stop') { V.state = 'docked'; }
      else if (v === 'find') toast('The Shark is beeping'); },
    blinds(el) { const B = H.blinds, v = +el.dataset.v; B.all = B.left = B.right = v; log('Office Blinds', v === 0 ? 'Closed' : v === 100 ? 'Opened' : v + '%', 'covers'); },
    hatchR(el) { const N = H.hatch; if (el.dataset.v === 'bed') Object.assign(N, { light: true, color: 0, b: 15, sound: true, soundName: 'Ocean' }); else Object.assign(N, { light: true, color: 3, b: 40 }); toast(el.dataset.v === 'bed' ? 'Bedtime' : 'Morning: the green light'); },
    auto(el) { const id = el.dataset.id; H.autosOff[id] = !H.autosOff[id]; if (el.dataset.mirror) setAt(el.dataset.mirror, !H.autosOff[id]); },
    dyReset(el) { const k = 'dy:' + el.dataset.id; if (!UI.armed[k]) { UI.armed[k] = 1; setTimeout(() => { delete UI.armed[k]; render(); }, 3000); return; } delete UI.armed[k]; H.dysons[el.dataset.id].filter = 100; toast('Filter life reset'); },
    sendBug() { const t = ($('bugText') || {}).value || ''; if (!t.trim()) return toast('Say what went wrong first'); log('Bug report', t.trim().slice(0, 40), 'routine'); closeSheet(); toast('Logged. Thank you'); },
    theme(el) { look.theme = el.dataset.v; put('labs.aoslook.theme', look.theme); applyLook(); },
    reset() { location.reload(); },
    toLabs() { location.href = '../'; },
    toast(el) { toast(el.dataset.v); },
  };
  const RACT = {
    lightB(el, v) { const [r, i] = el.dataset.id.split('.'); lightB(H.lights[r].lights[i], v); },
    roomB(el, v) { H.lights[el.dataset.id].lights.forEach(l => { if (l.kind !== 'onoff') lightB(l, v); }); },
    lampB(el, v) { const L = lampOf(el.dataset.id); L.b = v; L.on = v > 0; syncSplit(H.lights[4].lights[0]); },
    glass(el, v) { look.glass = v; put('labs.aoslook.glass', v); applyLook(); },
  };

  document.addEventListener('click', e => {
    if (e.target.closest('input, textarea, .meter[data-meter]')) return;
    const el = e.target.closest('[data-tab],[data-go],[data-set],[data-tog],[data-step],[data-act],[data-open]');
    if (!el || el.disabled) return;
    const d = el.dataset;
    if (d.tab) return go(d.tab);
    if (d.go) return go(d.go);
    if (d.open != null && !d.act && !d.set && !d.tog && !d.step) { const [k, id] = d.open.split(':'); return openSheet(k, id); }
    if (d.set) setAt(d.set, parse(d.v));
    else if (d.tog) setAt(d.tog, !at(d.tog));
    else if (d.step) { const k = d.step.split('.').pop(), [lo, hi] = STEPS[k] || (k === 'target' && d.step.startsWith('dehum') ? [35, 85] : [0, 100]); setAt(d.step, clamp(at(d.step) + +d.d, d.step.startsWith('dehum') ? 35 : lo, d.step.startsWith('dehum') ? 85 : hi)); }
    else if (d.act && ACT[d.act]) ACT[d.act](el);
    if (d.then && HOOK[d.then]) HOOK[d.then](el);
    render();
  });
  $('shDone').onclick = closeSheet; $('scrim').onclick = closeSheet;
  $('back').onclick = () => { const v = VIEWS[UI.view]; if (v.parent) go(v.parent); else location.href = '../'; };
  $('gear').onclick = () => openSheet('settings', '');
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && UI.sheet) closeSheet(); });

  // Ranges: the number moves with your finger; the page redraws when you let go
  document.addEventListener('input', e => {
    const el = e.target; if (el.type !== 'range') return;
    const v = +el.value, min = +el.min, max = +el.max;
    el.style.setProperty('--p', ((v - min) / (max - min) * 100).toFixed(1) + '%');
    if (el.dataset.range) { setAt(el.dataset.range, v); document.querySelectorAll(`[data-out="${el.dataset.range}"]`).forEach(o => o.textContent = (/bass|treble/.test(el.dataset.range) && v > 0 ? '+' : '') + v);
      if (el.dataset.range.endsWith('.pos')) document.querySelectorAll(`[data-pos="${el.dataset.range.split('.')[1]}"]`).forEach(o => o.textContent = mmss(v)); }
    if (el.dataset.ract && RACT[el.dataset.ract]) RACT[el.dataset.ract](el, v);
    if (el.dataset.then && HOOK[el.dataset.then]) HOOK[el.dataset.then](el);
    const n = el.closest('.light'); if (n) { const s = n.querySelector('.nm span'); if (s && el.dataset.ract !== 'glass') s.textContent = v ? v + '%' : 'Off'; }
  });
  document.addEventListener('change', e => { if (e.target.type === 'range' && e.target.dataset.ract !== 'glass') render(); });

  // Volume meters: tap a bar, or drag across; off the left end is silent
  let drag = null;
  const meterSet = (m, x) => { const r = m.getBoundingClientRect(), v = x < r.left ? 0 : clamp(Math.ceil((x - r.left) / r.width * 20) * 5, 5, 100), id = m.dataset.meter;
    const s = SP[id], g = groupOf(id), lead = !s.inGroup && g.length > 1 && !m.closest('.sheet');
    if (lead) { const top = Math.max(...g.map(k => SP[k].vol)), d = v - top; g.forEach(k => SP[k].vol = clamp(SP[k].vol + d, 0, 100)); } else { s.vol = v; s.mute = false; }
    m.querySelectorAll('i').forEach((b, k) => b.classList.toggle('on', (k + 1) * 5 <= v));
    const lab = m.parentNode.querySelector('.vlabel'); if (lab) lab.textContent = v; };
  document.addEventListener('pointerdown', e => { const m = e.target.closest('.meter[data-meter]'); if (!m) return; drag = m; m.setPointerCapture(e.pointerId); meterSet(m, e.clientX); e.preventDefault(); });
  document.addEventListener('pointermove', e => { if (drag) meterSet(drag, e.clientX); });
  document.addEventListener('pointerup', () => { if (drag) { drag = null; render(); } });
  document.addEventListener('keydown', e => { const m = e.target.closest && e.target.closest('.meter[data-meter]'); if (!m || !/Arrow(Left|Right)/.test(e.key)) return;
    const s = SP[m.dataset.meter]; s.vol = clamp(s.vol + (e.key === 'ArrowRight' ? 5 : -5), 0, 100); render(); });

  // Pull a sheet down by its top to close it
  { let y0 = null; const sh = $('sheet');
    sh.addEventListener('touchstart', e => { y0 = $('shBody').scrollTop <= 0 && e.touches[0].clientY - sh.getBoundingClientRect().top < 80 ? e.touches[0].clientY : null; }, { passive: true });
    sh.addEventListener('touchend', e => { if (y0 != null && e.changedTouches[0].clientY - y0 > 70) closeSheet(); y0 = null; }); }

  // The music plays on: positions move once a second (without redrawing what you might be holding)
  setInterval(() => {
    for (const id in SP) { const s = SP[id]; if (s.state === 'playing' && s.len) { s.pos += 1; if (s.pos >= s.len) { s.pos = 0; ACT.next({ dataset: { id } }); } document.querySelectorAll(`[data-pos="${id}"]`).forEach(o => o.textContent = mmss(s.pos)); } }
  }, 1000);

  const hv = location.hash.slice(1);
  if (VIEWS[hv]) UI.view = hv;
  render();
})();
