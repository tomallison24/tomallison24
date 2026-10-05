// Home: what the device families share. Each family (heaters.js, dysons.js,
// lights.js, media.js, security.js, around.js, favorites.js) is loaded after
// index.html's script and calls family() once per section: the view it sits
// in (Favorites, Climate, Lights, Media, Security, Around the house), its
// cards, its popup, its sample states and how the preview answers its calls.
// A card can appear twice (in its own view and on Favorites): the families
// paint every copy, found by its data-dv.
//
// A card or popup is a host with data-dv="<view>:<device>"; a tap on one of
// its [data-a] controls goes to that family's act(); a tap anywhere else on a
// card opens the popup. The popup is one sheet (#devWrap) for every family:
// sheet(id) returns its title, pill, sky and parts, and each part is only
// redrawn when its HTML changes, as everywhere else in the app.
//
// Taps show at once and are held until Home Assistant reports them (or 20 s),
// with the thermostats' held()/tset()/tsend(): a device is { id, name }.
'use strict';

const VIEW_OF = { Favorites: 'fav', Climate: 'climate', Lights: 'lights', Media: 'media', Security: 'security', 'Around the house': 'around', Labs: 'labs' };
function family(f) {
  const el = document.createElement('section');
  el.className = 'units'; el.id = 'v-' + f.id; el.hidden = true;
  document.querySelector('main').appendChild(el);   // moved into its view by layoutViews()
  f.el = el; f.sum = f.sum || '';
  FAMILIES.push(f);
  if (!f.noSection) SECTIONS.push({ id: f.id, name: f.name, view: VIEW_OF[f.group], order: f.order, el: () => el, sum: () => f.sum });
  if (f.samples) SAMPLES.push(f.samples.bind(f));
  if (f.preview) PREVIEW.unshift(f.preview.bind(f));   // before the common answers below
  if (f.mount) f.mount(el);
  return f;
}

// ---- reading entities ----
const val = id => { const s = st(id); return s ? s.state : undefined; };
const attr = (id, k) => { const s = st(id); return s ? s.attributes[k] : undefined; };
const gone = id => { const s = st(id); return !s || s.state === 'unavailable' || s.state === 'unknown'; };
// A button or scene reads 'unknown' until first used: only missing or unavailable counts.
const unav = id => { const s = st(id); return !s || s.state === 'unavailable'; };
const devOf = {};   // the { id, name } a family's taps are held under
const dv = (f, id, name) => devOf[f + ':' + id] || (devOf[f + ':' + id] = { id: f + ':' + id, name });
// Why a device shows nothing: still connecting, not connected, no such entity, or unreachable.
function offWord(id) {
  const waitingHA = !st(id) && mode === 'live' && !Object.keys(ents).length;
  return waitingHA ? (HA.status === 'error' ? 'Not connected' : 'Connecting') : !st(id) ? 'Not found' : 'Unavailable';
}
const hm = h => { const m = Math.round(Number(h) * 60); return isNaN(m) ? '—' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; };
function ago(t) {   // t: seconds since 1970, or an ISO time
  const ms = typeof t === 'number' ? t * 1000 : Date.parse(t);
  if (!ms) return '—';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  return s < 60 ? 'Just now' : s < 3600 ? Math.floor(s / 60) + 'm ago' : s < 86400 ? Math.floor(s / 3600) + 'h ago' : Math.floor(s / 86400) + 'd ago';
}
const nf = (v, d = 0) => isNaN(v) ? '—' : Number(v).toFixed(d);
const watts = id => { const v = num(id); return isNaN(v) ? '—' : (v < 10 ? v.toFixed(1) : Math.round(v)) + ' W'; };
const kwh = (id, d = 2) => { const v = num(id); return isNaN(v) ? '—' : v.toFixed(d) + ' kWh'; };
const money = id => { const v = num(id); return isNaN(v) ? '—' : '$' + v.toFixed(2); };
const grad = (a, b, c) => `linear-gradient(160deg, ${a} 0%, ${b} 50%, ${c} 100%)`;
// A picture Home Assistant serves (a camera still, album art): its paths are
// on the Home Assistant address. Only that or https; nothing else is loaded.
function haPic(p, bust) {
  if (!p || mode !== 'live') return '';
  // and never one that could step out of url('...') or an attribute
  if (typeof p !== 'string' || /['"()\\\s<>]/.test(p)) return '';
  const u = /^\/[^/]/.test(p) ? saved().url + p : /^https:\/\//.test(p) ? p : '';
  return u && bust ? u + (u.includes('?') ? '&' : '?') + '_=' + encodeURIComponent(bust) : u;
}

// ---- pieces of HTML ----
const accentSw = (on, tint) => `<span class="sw${on ? ' on' : ''}" style="--tint:${tint}"></span>`;
function swRow(a, label, ic, on, tint, o = {}) {
  return `<button class="rowi${o.wait ? ' wait' : ''}" data-a="${a}"${o.v != null ? ` data-v="${esc(o.v)}"` : ''} role="switch" aria-checked="${!!on}"${o.dis ? ' disabled' : ''}>${icon(ic)}<span class="k">${label}${o.sub ? `<small>${o.sub}</small>` : ''}</span>${accentSw(on, tint)}</button>`;
}
const readRow = (ic, k, v, cls = '') => `<div class="rowi">${icon(ic)}<span class="k">${k}</span><span class="v ${cls}">${v}</span></div>`;
function actRow(a, label, ic, o = {}) {
  return `<button class="rowi${o.wait ? ' wait' : ''}${o.warn ? ' warnrow' : ''}" data-a="${a}"${o.v != null ? ` data-v="${esc(o.v)}"` : ''}${o.dis ? ' disabled' : ''}>${icon(ic)}<span class="k">${label}</span>${o.right != null ? `<span class="v">${o.right}</span>` : svg('chevR', 18)}</button>`;
}
function segHTML(a, opts, cur, o = {}) {
  return `<div class="seg${o.wait ? ' wait' : ''}${o.cls ? ' ' + o.cls : ''}">${opts.map(([v, l]) => `<button data-a="${a}" data-v="${esc(v)}" aria-pressed="${cur != null && String(cur) === String(v)}"${o.dis ? ' disabled' : ''}>${l}</button>`).join('')}</div>`;
}
const statsHTML = list => `<div class="stats" style="grid-template-columns:repeat(${list.length},1fr)">${list.map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join('')}</div>`;
const lbl = t => `<div class="glbl">${t}</div>`;
const grp = (inner, first) => inner ? `<div class="group${first ? ' first' : ''}">${inner}</div>` : '';
function pwrBtn(on, acc, label, o = {}) {
  const lit = on ? `background:rgba(${acc},0.85);box-shadow:0 0 14px rgba(${acc},0.5), inset 0 0.5px 0 rgba(255,255,255,0.6);color:#16171B;` : '';
  return `<button class="pwr${o.wait ? ' wait' : ''}" data-a="${o.a || 'power'}" style="${lit}" aria-pressed="${!!on}" aria-label="${label}"${o.dis ? ' disabled' : ''}>${svg(o.icon || 'power', 22)}</button>`;
}
// A stepper: the dehumidifiers' target, for any number.
function stepHTML(label, shown, pct, o = {}) {
  const inner = `<button class="disc" data-a="${o.a || 'step'}" data-v="-1" aria-label="Lower ${label.toLowerCase()}"${o.dis || o.atMin ? ' disabled' : ''}>${svg('minus', 20)}</button>
    <div class="tgt"><div class="tgt-row"><span>${label}</span><span>${shown}</span></div><div class="tgt-bar"><i style="width:${Math.max(0, Math.min(100, pct || 0))}%"></i></div></div>
    <button class="disc" data-a="${o.a || 'step'}" data-v="1" aria-label="Raise ${label.toLowerCase()}"${o.dis || o.atMax ? ' disabled' : ''}>${svg('plus', 20)}</button>`;
  return o.bare ? inner : `<div class="dg-tgt${o.cls ? ' ' + o.cls : ''}">${inner}</div>`;
}
// A glass slider. It sends when let go (change); while dragged its value
// shows at once and the region round it is left alone (rangeHeld).
function sliderHTML(a, v, min, max, step, o = {}) {
  const x = v == null || isNaN(v) ? min : v, pct = (x - min) / (max - min) * 100;
  return `<label class="gsl${o.cls ? ' ' + o.cls : ''}${o.dis ? ' dis' : ''}" style="--p:${pct.toFixed(1)}%;--tint:${o.tint || '255,255,255'}">
    ${o.label != null ? `<span class="gsl-top"><span>${o.label}</span><b data-shown>${o.shown != null ? o.shown : x}</b></span>` : ''}
    <input type="range" data-a="${a}"${o.v != null ? ` data-v="${esc(o.v)}"` : ''} min="${min}" max="${max}" step="${step}" value="${x}" aria-label="${esc(o.aria || o.label || a)}"${o.unit ? ` data-unit="${esc(o.unit)}"` : ''}${o.dis ? ' disabled' : ''}></label>`;
}
function chipsHTML(a, list, cur, o = {}) {
  return `<div class="chips${o.cls ? ' ' + o.cls : ''}">${list.map(([v, l]) => `<button class="chip2" data-a="${a}" data-v="${esc(v)}" aria-pressed="${cur != null && (o.near ? Math.abs(Number(cur) - Number(v)) <= o.near : String(cur) === String(v))}"${o.dis ? ' disabled' : ''}>${l}</button>`).join('')}</div>`;
}
function infoHTML2(name, title, sub, extra = '') {
  return `<button class="dg-name" data-a="open" aria-label="All of the ${esc(name)}'s controls">${esc(name)}${svg('chevR', 16)}</button>
    <div class="dg-title">${title}</div><div class="dg-sub">${sub}</div>${extra}`;
}
const pillHTML2 = (word, dot) => `<span class="dg-pill">${dot ? `<i style="background:rgb(${dot});box-shadow:0 0 6px rgba(${dot},0.8)"></i>` : ''}${word}</span>`;
// The card's frame: sky behind, then the family's own regions.
const cardsOf = key => document.querySelectorAll(`[data-dv="${key}"]:not(.sheet)`);   // not the popup, which carries its device's key too
const cardHTML = (key, inner, cls = '') => `<article class="dg dvc ${cls}" data-dv="${key}"><div class="dg-fx" data-r="fx"></div><div class="dg-in">${inner}</div></article>`;
function shadow(card, acc) { card.style.boxShadow = `0 18px 40px -16px rgba(${acc},0.26)`; }

// The sky: a gradient, and what is going on in it.
//   embers (heat), frost (cold), air (a fan), motes (rising), and a pool of
//   light that breathes, drifts or pulses.
function skyHTML(sky, acc, fx = {}, top = 60) {
  let seed = fx.seed || 23; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const pool = (rgb, a, cls) => `<div class="dg-pool ${cls}" style="top:${top}px;background:radial-gradient(circle, rgba(${rgb},${a}) 0%, rgba(${rgb},${(a * 0.35).toFixed(3)}) 38%, rgba(${rgb},0) 68%);"></div>`;
  let L = '';
  if (fx.pool) L += pool(fx.poolRgb || acc, fx.poolA || 0.14, 'dg-' + fx.pool);
  for (let i = 0; i < (fx.embers || 0); i++) { const du = 6 + rnd() * 6;
    L += `<i class="tc-ember" style="left:${(5 + rnd() * 90).toFixed(1)}%;background:rgba(255,${150 + Math.round(rnd() * 60)},110,0.85);box-shadow:0 0 5px rgba(255,140,90,0.8);animation-duration:${du.toFixed(1)}s;animation-delay:-${(rnd() * du).toFixed(1)}s;"></i>`; }
  for (let i = 0; i < (fx.air || 0); i++) { const du = 3.5 + rnd() * 3;
    L += `<i class="tc-air" style="top:${(12 + rnd() * 76).toFixed(1)}%;background:linear-gradient(90deg, rgba(${acc},0), rgba(${acc},0.5), rgba(${acc},0));animation-duration:${du.toFixed(1)}s;animation-delay:-${(rnd() * du).toFixed(1)}s;"></i>`; }
  for (let i = 0; i < (fx.motes || 0); i++) { const du = 7 + rnd() * 6;
    L += `<i class="dg-mote" style="left:${(6 + rnd() * 88).toFixed(1)}%;box-shadow:0 0 4px rgba(${acc},0.8);animation-duration:${du.toFixed(1)}s;animation-delay:-${(rnd() * du).toFixed(1)}s;"></i>`; }
  for (let i = 0; i < (fx.stars || 0); i++) {
    L += `<i class="dv-star" style="left:${(4 + rnd() * 92).toFixed(1)}%;top:${(4 + rnd() * 60).toFixed(1)}%;--so:${(0.3 + rnd() * 0.5).toFixed(2)};animation-duration:${(2 + rnd() * 3).toFixed(1)}s;"></i>`; }
  return `<div class="dg-sky" style="background:${sky};"></div>${fx.art ? `<div class="dv-art${fx.artPaused ? ' paused' : ''}" style="background-image:url('${esc(fx.art)}')"></div>` : ''}${L}<div class="dg-sheen"></div>`;
}

// ---- the popup ----
const dsheet = devWrap.querySelector('.sheet');
function openDev(f, id) {
  if (!f.sheet(id)) return;   // a card with nothing more to show
  openD = { f, id };
  dsheet.dataset.dv = f.id + ':' + id;
  const body = dsheet.querySelector('[data-s="body"]');
  body.dataset.keys = ''; body.scrollTop = 0;
  showSheet(devWrap);
  renderDev();
}
function renderDev() {
  const { f, id } = openD, o = f.sheet(id);
  if (!o) return;
  const S = n => dsheet.querySelector(`[data-s="${n}"]`), body = S('body');
  $('dTitle').textContent = o.title;
  put(S('pill'), o.pill || '');
  put(S('fx'), o.fx || '');
  const parts = o.parts.filter(Boolean), keys = parts.map(p => p[0]).join('|');
  if (body.dataset.keys !== keys) {
    if (rangeHeld && body.contains(rangeHeld)) return;
    body.innerHTML = parts.map(p => `<div data-p="${p[0]}"></div>`).join('');
    body.dataset.keys = keys;
  }
  for (const [k, html] of parts) put(body.querySelector(`[data-p="${k}"]`), html);
  dsheet.style.boxShadow = `inset 0 0 0 1px var(--lgs-edge), inset 0 1.5px 1px var(--lgs-rim), 0 24px 60px rgba(${o.accent || '190,194,204'},0.22), 0 2px 8px var(--lgs-lift)`;
  body.querySelectorAll('.seg').forEach((sg, i) => slide(sg, sg.querySelector('[aria-pressed="true"]'), 'dv-' + f.id + id + i));
}

// A picture that fails (an expired camera token) hides rather than showing a broken icon.
document.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.classList.add('broken'); }, true);

// ---- taps ----
document.addEventListener('click', e => {
  const host = e.target.closest('[data-dv]'); if (!host || !host.dataset.dv) return;
  const [fid, id] = host.dataset.dv.split(':');
  const f = FAMILIES.find(x => x.id === fid); if (!f) return;
  const b = e.target.closest('[data-a]');
  if (!b || !host.contains(b)) { if (host.classList.contains('dvc') && f.sheet && !e.target.closest('input, label.gsl')) openDev(f, id); return; }
  if (b.disabled || b.tagName === 'INPUT') return;
  if (b.dataset.a === 'open') return f.sheet && openDev(f, id);
  f.act(id, b.dataset.a, b, e);
});
// Sliders: the shown value follows the finger; the call goes on letting go.
const rangeOf = e => e.target.matches && e.target.matches('input[type="range"][data-a]') ? e.target : null;
for (const ev of ['pointerdown', 'touchstart']) document.addEventListener(ev, e => { const r = rangeOf(e); if (r) rangeHeld = r; }, { passive: true });
document.addEventListener('input', e => {
  const r = rangeOf(e); if (!r) return;
  rangeHeld = r;
  const box = r.closest('.gsl'), min = Number(r.min), max = Number(r.max), v = Number(r.value);
  box.style.setProperty('--p', ((v - min) / (max - min) * 100).toFixed(1) + '%');
  const sh = box.querySelector('[data-shown]'); if (sh) sh.textContent = v + (r.dataset.unit || '');
});
document.addEventListener('change', e => {
  const r = rangeOf(e); if (!r) return;
  rangeHeld = null;
  const host = r.closest('[data-dv]'); if (!host) return;
  const [fid, id] = host.dataset.dv.split(':'), f = FAMILIES.find(x => x.id === fid);
  if (f && f.slide) f.slide(id, r.dataset.a, Number(r.value), r);
  render();
});
for (const ev of ['pointerup', 'pointercancel', 'touchend', 'touchcancel']) document.addEventListener(ev, () => {
  // let go without a change (a tap on the thumb): stop holding the region
  setTimeout(() => { if (rangeHeld && document.activeElement !== rangeHeld) { rangeHeld = null; render(); } }, 400);
}, { passive: true });

// Taps that add up (a stepper, a volume): one call 600 ms after the last.
const stepTimers = {};
function later(key, fn, ms = 600) { clearTimeout(stepTimers[key]); stepTimers[key] = setTimeout(fn, ms); }
// A tap that must be made twice (a reset, a hand-off): the first arms it for 4 s.
const armed = {};
function twice(key) {
  if (armed[key] && Date.now() - armed[key] < 4000) { delete armed[key]; return true; }
  armed[key] = Date.now(); render(); setTimeout(render, 4100);
  return false;
}
const isArmed = key => armed[key] && Date.now() - armed[key] < 4000;
// A call with nothing to hold (a script, a button): send it, and say if it fails.
function fire(name, domain, service, data) {
  if (mode === 'preview') { previewCall(domain, service, data); return Promise.resolve(); }
  return HA.send({ type: 'call_service', domain, service, service_data: data }).catch(e => toast(`${name}: ${e.message}`));
}
function fireTarget(name, domain, service, target, data = {}) {
  if (mode === 'preview') { previewCall(domain, service, { ...data, ...target }); return Promise.resolve(); }
  return HA.send({ type: 'call_service', domain, service, service_data: data, target }).catch(e => toast(`${name}: ${e.message}`));
}

// ---- the preview: what Home Assistant would do with the common calls ----
function patchEnt(id, state, attrs) {
  const s = ents[id]; if (!s) return;
  ents = { ...ents, [id]: { ...s, state: state == null ? s.state : String(state), attributes: { ...s.attributes, ...attrs }, lc: state != null && String(state) !== s.state ? Date.now() / 1000 : s.lc } };
}
function hsToRgb(h, s) {
  const S = s / 100, f = n => { const k = (n + h / 60) % 6; return Math.round(255 * (1 - S * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return [f(5), f(3), f(1)];
}
PREVIEW.push((domain, service, d) => {
  const ids = [].concat(d.entity_id || []);
  if (domain === 'light') {
    for (const id of ids) {
      const s = ents[id]; if (!s) continue;
      const on = service === 'turn_on' || (service === 'toggle' && s.state !== 'on');
      const a = {};
      if (on) {
        a.brightness = d.brightness_pct != null ? Math.round(d.brightness_pct * 2.55) : d.white != null ? d.white : s.attributes.brightness || s.attributes._bri || 255;
        if (d.rgb_color) Object.assign(a, { rgb_color: d.rgb_color, hs_color: null });
        if (d.hs_color) Object.assign(a, { hs_color: d.hs_color, rgb_color: hsToRgb(...d.hs_color), color_mode: 'hs' });
        if (d.white != null) Object.assign(a, { hs_color: null, rgb_color: [255, 255, 255], color_mode: 'white' });
        if (!a.rgb_color && !s.attributes.rgb_color && s.attributes._rgb) a.rgb_color = s.attributes._rgb;
      } else Object.assign(a, { _bri: s.attributes.brightness || s.attributes._bri, _rgb: s.attributes.rgb_color || s.attributes._rgb, brightness: null, rgb_color: null });
      patchEnt(id, on ? 'on' : 'off', a);
      for (const m of s.attributes.entity_id || []) if (ents[m] && m !== id) {
        const ms = ents[m];
        patchEnt(m, on ? 'on' : 'off', on ? { brightness: a.brightness, ...(a.rgb_color ? { rgb_color: a.rgb_color } : {}) } : { _bri: ms.attributes.brightness, brightness: null });
      }
    }
    // A group is on while any of its lights is, as Home Assistant's are.
    for (const gid in ents) {
      const g = ents[gid], m = g.attributes.entity_id;
      if (!gid.startsWith('light.') || !Array.isArray(m) || !m.some(x => ids.includes(x))) continue;
      const lit = m.filter(x => ents[x] && ents[x].state === 'on');
      patchEnt(gid, lit.length ? 'on' : 'off', lit.length ? { brightness: ents[lit[0]].attributes.brightness } : { brightness: null });
    }
    return true;
  }
  const s = ents[ids[0]];
  if (!s) return false;
  const id = ids[0], A = s.attributes;
  if (domain === 'fan' && service === 'set_percentage') { patchEnt(id, d.percentage > 0 ? 'on' : 'off', { percentage: d.percentage }); return true; }
  if (domain === 'fan' && service === 'oscillate') { patchEnt(id, null, { oscillating: d.oscillating }); return true; }
  if (domain === 'fan' && service === 'set_direction') { patchEnt(id, null, { direction: d.direction }); return true; }
  if ((domain === 'select' || domain === 'input_select') && service === 'select_option') { patchEnt(id, d.option); return true; }
  if ((domain === 'number' || domain === 'input_number') && service === 'set_value') { patchEnt(id, d.value); return true; }
  if (domain === 'alarm_control_panel') { patchEnt(id, service === 'alarm_arm_away' ? 'armed_away' : 'disarmed'); return true; }
  if (domain === 'vacuum') {
    const to = { start: 'cleaning', pause: 'paused', return_to_base: 'returning', stop: 'idle' }[service];
    if (to) patchEnt(id, to);
    if (service === 'set_fan_speed') patchEnt(id, null, { fan_speed: d.fan_speed });
    return true;
  }
  if (domain === 'media_player') {
    const st0 = s.state;
    if (service === 'media_play_pause') patchEnt(id, st0 === 'playing' ? 'paused' : 'playing', { media_position: A.media_position, media_position_updated_at: new Date().toISOString() });
    else if (service === 'media_play') patchEnt(id, 'playing');
    else if (service === 'media_pause') patchEnt(id, 'paused');
    else if (service === 'media_stop') patchEnt(id, A.sound_mode_list ? 'idle' : 'idle');
    else if (service === 'volume_set') patchEnt(id, null, { volume_level: d.volume_level, is_volume_muted: false });
    else if (service === 'volume_mute') patchEnt(id, null, { is_volume_muted: d.is_volume_muted });
    else if (service === 'media_next_track' || service === 'media_previous_track') {
      const L = A._tracks || [[A.media_title, A.media_artist]], i = ((A._i || 0) + (service === 'media_next_track' ? 1 : L.length - 1)) % L.length;
      patchEnt(id, 'playing', { _i: i, media_title: L[i][0], media_artist: L[i][1], media_position: 0, media_position_updated_at: new Date().toISOString() });
    }
    else if (service === 'media_seek') patchEnt(id, null, { media_position: d.seek_position, media_position_updated_at: new Date().toISOString() });
    else if (service === 'select_source') patchEnt(id, st0 === 'off' ? 'on' : null, { source: d.source, app_name: d.source });
    else if (service === 'turn_on') patchEnt(id, 'on');
    else if (service === 'turn_off') patchEnt(id, 'off');
    else if (service === 'shuffle_set') patchEnt(id, null, { shuffle: d.shuffle });
    else if (service === 'repeat_set') patchEnt(id, null, { repeat: d.repeat });
    else if (service === 'select_sound_mode') patchEnt(id, 'playing', { sound_mode: d.sound_mode });
    else if (service === 'play_media') patchEnt(id, 'playing', { media_title: A._favs && A._favs[d.media_content_id] || 'Favourite', media_artist: '' });
    else if (service === 'join') {
      const lead = id, all = [lead, ...(d.group_members || []).filter(m => m !== lead)];
      const now = [...new Set([...(A.group_members || [lead]), ...all])];
      for (const m of now) patchEnt(m, null, { group_members: now });
    } else if (service === 'unjoin') {
      const g = (A.group_members || [id]).filter(m => m !== id);
      for (const m of g) patchEnt(m, null, { group_members: g });
      patchEnt(id, null, { group_members: [id] });
    } else return false;
    return true;
  }
  return false;
});
