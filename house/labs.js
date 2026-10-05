// LABS: ideas tried out live before they replace anything. Each one here is
// wired to the real device, so it can be used, not only looked at.
//
// The Living Room thermostat, three ways without the orb - ultra clean,
// Liquid Glass: a pane of frosted glass with its mood's light behind it
// (heating amber, cooling blue, idle lavender, off grey), so the glass has
// something to diffuse. Same rules as the card (core's tread / tStep /
// tPower): Auto keeps Heat and Cool 3° apart and sends both, taps add up
// into one call, Power remembers the mode, Eco shows the Eco temperatures.
//   A · Numeral  - the room as one thin number; the targets as glass capsules
//   B · Track    - a glass tube 50-90°: the comfort band, the room as a mark
//   C · Control  - Control Center: tall capsules filled to each target;
//                  tap the top half to raise it, the bottom half to lower it
//   D · Drum     - iOS picker wheels, the chosen number in a glass lens;
//                  tap a number above or below to go to it
//   E · Split    - two glass halves, warm Heat and cool Cool, the room in a
//                  lozenge at the seam; the half at work glows
//   F · Ruler    - the camera's exposure dial: a tick ruler slides under a
//                  fixed lens, the room a dot on it; tap left or right
'use strict';
const LAB_T = () => THERMOS.find(t => t.id === 'lr');
const LAB_IDEAS = [
  { id: 'a', name: 'A · Numeral', note: 'The room as one thin number. The targets as glass capsules.' },
  { id: 'b', name: 'B · Track', note: 'One glass tube from 50° to 90°: the comfort band, the room as a mark.' },
  { id: 'c', name: 'C · Control', note: 'Control Center: capsules filled to each target. Tap the top half to raise, the bottom to lower.' },
  { id: 'd', name: 'D · Drum', note: 'Picker wheels, the target in a glass lens. Tap a number above or below to go to it.' },
  { id: 'e', name: 'E · Split', note: 'Two glass halves, warm and cool, the room at the seam. The half at work glows.' },
  { id: 'f', name: 'F · Ruler', note: 'The camera\'s exposure dial: the ruler slides under a fixed lens. Tap left or right of it.' },
];
// One reading for all three: what to show, in as few words as possible.
function labRead() {
  const t = LAB_T(), r = tread(t), n = v => v == null ? '--' : Math.round(v);
  const word = tWord(t, r), acc = T_ACC[r.mood] || T_ACC.idle;
  const wo = st('weather.forecast_home'), out = wo && Number(wo.attributes.temperature);
  // The targets the controls step: Auto has two, Heat / Cool one, Off none.
  const sets = r.offline || r.s === 'off' || r.s === 'fan_only' ? []
    : r.range ? [['target_temp_low', 'Heat', r.lo, '255,179,138'], ['target_temp_high', 'Cool', r.hi, '156,210,255']]
    : [['temperature', r.s === 'cool' ? 'Cool' : 'Heat', r.temp, r.s === 'cool' ? '156,210,255' : '255,179,138']];
  return { t, r, n, word, acc, out: Number.isFinite(out) ? Math.round(out) : null, sets, locked: r.eco || r.offline };
}
const labPwr = L => `<button class="lab-pwr${L.r.s !== 'off' && !L.r.offline ? ' on' : ''}${tWaiting(L.t, 'mode') ? ' wait' : ''}" data-a="power" style="--a:${L.acc}" aria-label="Power"${L.r.offline ? ' disabled' : ''}>${svg('power', 18)}</button>`;
const labHead = L => `<header class="lab-h"><span class="lab-name">${L.t.name}</span>${labPwr(L)}</header>`;
const labOff = L => L.r.s === 'off' ? 'Off' : L.r.s === 'fan_only' ? 'Fan only' : L.r.offline ? tWord(L.t, L.r) : '';
// A glass capsule: − value +, for one target.
function labCapsule(L, [f, label, v, rgb]) {
  const dis = L.locked || v == null;
  return `<div class="lab-cap" style="--c:${rgb}">
    <button class="lab-step" data-a="step" data-f="${f}" data-v="-1" aria-label="Lower ${label}"${dis || v <= L.r.min ? ' disabled' : ''}>${svg('minus', 18)}</button>
    <div class="lab-cap-v"><small>${label}</small><b>${L.n(v)}°</b></div>
    <button class="lab-step" data-a="step" data-f="${f}" data-v="1" aria-label="Raise ${label}"${dis || v >= L.r.max ? ' disabled' : ''}>${svg('plus', 18)}</button></div>`;
}

const labNone = L => `<div class="lab-cap idle"><div class="lab-cap-v"><b>${labOff(L)}</b></div></div>`;
const LAB_DRAW = {
  // A · Numeral
  a(L) {
    const sub = [L.word, L.out != null ? `${L.out}° outside` : ''].filter(Boolean).join(' · ');
    return `${labHead(L)}
      <div class="lab-a-num">${L.n(L.r.cur)}<span>°</span></div>
      <div class="lab-sub">${sub}${L.r.eco ? ' · Eco' : ''}</div>
      <div class="lab-caps">${L.sets.length ? L.sets.map(s => labCapsule(L, s)).join('') : `<div class="lab-cap idle"><div class="lab-cap-v"><b>${labOff(L)}</b></div></div>`}</div>`;
  },
  // B · Track
  b(L) {
    const lo = L.r.min || 50, hi = L.r.max || 90, pct = v => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
    let band = '', beads = '';
    if (L.sets.length === 2) {
      const [a, b] = L.sets;
      band = `<i class="lab-band" style="left:${pct(a[2])}%;width:${pct(b[2]) - pct(a[2])}%;background:linear-gradient(90deg, rgba(${a[3]},0.75), rgba(${b[3]},0.75))"></i>`;
    } else if (L.sets.length === 1) {
      const [s] = L.sets, x = pct(s[2]);
      band = s[1] === 'Cool' ? `<i class="lab-band" style="left:${x}%;right:0;background:linear-gradient(90deg, rgba(${s[3]},0.75), rgba(${s[3]},0.15))"></i>`
        : `<i class="lab-band" style="left:0;width:${x}%;background:linear-gradient(90deg, rgba(${s[3]},0.15), rgba(${s[3]},0.75))"></i>`;
    }
    for (const s of L.sets) beads += `<i class="lab-bead" style="left:${pct(s[2])}%;--c:${s[3]}"><em>${L.n(s[2])}°</em></i>`;
    const ticks = [60, 70, 80].map(v => `<i class="lab-tick" style="left:${pct(v)}%"><em>${v}</em></i>`).join('');
    const cur = L.r.cur != null ? `<i class="lab-now" style="left:${pct(L.r.cur)}%"></i>` : '';
    return `${labHead(L)}
      <div class="lab-b-top"><div class="lab-b-num">${L.n(L.r.cur)}<span>°</span></div>
        <div class="lab-b-word"><b>${L.word}</b><small>${L.out != null ? L.out + '° outside' : ''}</small></div></div>
      <div class="lab-track">${ticks}${band}${cur}${beads}</div>
      <div class="lab-caps slim">${L.sets.length ? L.sets.map(s => labCapsule(L, s)).join('') : `<div class="lab-cap idle"><div class="lab-cap-v"><b>${labOff(L)}</b></div></div>`}</div>`;
  },
  // C · Control (Control Center capsules)
  c(L) {
    const lo = L.r.min || 50, hi = L.r.max || 90;
    const fill = v => v == null ? 0 : Math.max(6, Math.min(100, (v - lo) / (hi - lo) * 100));
    const caps = L.sets.map(([f, label, v, rgb]) => `<div class="lab-cc${L.locked ? ' dis' : ''}" style="--c:${rgb};--f:${fill(v)}%">
        <i class="lab-cc-fill"></i>
        <button class="lab-cc-up" data-a="step" data-f="${f}" data-v="1" aria-label="Raise ${label}"${L.locked || v >= L.r.max ? ' disabled' : ''}>${svg('chevUp', 18)}</button>
        <button class="lab-cc-dn" data-a="step" data-f="${f}" data-v="-1" aria-label="Lower ${label}"${L.locked || v <= L.r.min ? ' disabled' : ''}>${svg('chev', 18)}</button>
        <div class="lab-cc-v"><b>${L.n(v)}°</b><small>${label}</small></div></div>`).join('');
    return `<div class="lab-c-grid${L.sets.length === 1 ? ' one' : ''}${!L.sets.length ? ' none' : ''}">
      <div class="lab-c-room">
        <span class="lab-name">${L.t.name}</span>
        <div class="lab-c-num">${L.n(L.r.cur)}<span>°</span></div>
        <div class="lab-sub">${L.word}${L.out != null ? `<br>${L.out}° outside` : ''}</div>
        ${labPwr(L)}
      </div>${caps || `<div class="lab-cc idle"><div class="lab-cc-v"><b>${labOff(L)}</b></div></div>`}</div>`;
  },
  // D · Drum: a wheel per target, higher numbers above, as a thermometer reads
  d(L) {
    const wheel = ([f, label, v, rgb]) => {
      const rows = [2, 1, 0, -1, -2].map(k => {
        const x = v == null ? null : Math.round(v) + k, ok = x != null && x >= L.r.min && x <= L.r.max;
        return k === 0 ? `<div class="lab-dr-sel">${L.n(x)}°</div>`
          : `<button class="lab-dr-n d${Math.abs(k)}" data-a="step" data-f="${f}" data-v="${k}"${L.locked || !ok ? ' disabled' : ''}>${ok ? x : ''}</button>`;
      }).join('');
      return `<div class="lab-dr" style="--c:${rgb}"><small>${label}</small><div class="lab-dr-w"><i class="lab-dr-lens"></i>${rows}</div></div>`;
    };
    return `${labHead(L)}<div class="lab-sub lab-d-sub">${L.n(L.r.cur)}° inside · ${L.word}${L.out != null ? ` · ${L.out}° outside` : ''}</div>
      <div class="lab-drums">${L.sets.length ? L.sets.map(wheel).join('') : labNone(L)}</div>`;
  },
  // E · Split: warm half, cool half, the room at the seam
  e(L) {
    const half = ([f, label, v, rgb]) => {
      const busy = (label === 'Heat' && L.r.act === 'heating') || (label === 'Cool' && L.r.act === 'cooling');
      return `<div class="lab-half${busy ? ' busy' : ''}" style="--c:${rgb}">
        <small>${label}${busy ? ` · ${label === 'Heat' ? 'heating' : 'cooling'}` : ''}</small><b>${L.n(v)}<span>°</span></b>
        <div class="lab-half-b"><button class="lab-step" data-a="step" data-f="${f}" data-v="-1" aria-label="Lower ${label}"${L.locked || v <= L.r.min ? ' disabled' : ''}>${svg('minus', 18)}</button>
        <button class="lab-step" data-a="step" data-f="${f}" data-v="1" aria-label="Raise ${label}"${L.locked || v >= L.r.max ? ' disabled' : ''}>${svg('plus', 18)}</button></div></div>`;
    };
    return `<div class="lab-e-h"><span class="lab-name">${L.t.name}</span>${labPwr(L)}</div>
      <div class="lab-split${L.sets.length === 1 ? ' one' : ''}">${L.sets.length ? L.sets.map(half).join('') : labNone(L)}
        <div class="lab-seam"><b>${L.n(L.r.cur)}°</b><small>inside</small></div></div>
      <div class="lab-sub lab-e-sub">${L.word}${L.out != null ? ` · ${L.out}° outside` : ''}</div>`;
  },
  // F · Ruler: the ticks slide, the lens stays
  f(L) {
    const ruler = ([f, label, v, rgb]) => {
      const c = v == null ? 70 : Math.round(v), PX = 14;   // px a degree
      let ticks = '';
      for (let x = c - 12; x <= c + 12; x++) {
        const big = x % 5 === 0;
        ticks += `<i class="lab-rt${big ? ' big' : ''}" style="left:calc(50% + ${(x - c) * PX}px)">${big ? `<em>${x}</em>` : ''}</i>`;
      }
      const cur = L.r.cur != null && Math.abs(L.r.cur - c) <= 12 ? `<i class="lab-rnow" style="left:calc(50% + ${((L.r.cur - c) * PX).toFixed(1)}px)"></i>` : '';
      return `<div class="lab-ru" style="--c:${rgb}"><div class="lab-ru-v"><small>${label}</small><b>${L.n(v)}°</b></div>
        <div class="lab-ruler">${ticks}${cur}<i class="lab-lens"></i>
          <button class="lab-ru-l" data-a="step" data-f="${f}" data-v="-1" aria-label="Lower ${label}"${L.locked || v <= L.r.min ? ' disabled' : ''}>${svg('minus', 14)}</button>
          <button class="lab-ru-r" data-a="step" data-f="${f}" data-v="1" aria-label="Raise ${label}"${L.locked || v >= L.r.max ? ' disabled' : ''}>${svg('plus', 14)}</button></div></div>`;
    };
    return `${labHead(L)}<div class="lab-sub lab-f-sub">${L.n(L.r.cur)}° inside · ${L.word}${L.out != null ? ` · ${L.out}° outside` : ''}</div>
      ${L.sets.length ? L.sets.map(ruler).join('') : `<div class="lab-caps">${labNone(L)}</div>`}`;
  },
};

family({
  id: 'labs', name: 'Living Room thermostat', group: 'Labs', order: 1,
  mount(el) {
    el.innerHTML = `<p class="tnote lab-intro">Ideas for the Living Room thermostat without the orb. They are live: they work the real thermostat.</p>`
      + LAB_IDEAS.map(i => `<div class="lab-idea"><div class="lab-cap-h"><b>${i.name}</b><span>${i.note}</span></div>
        <div class="lab-wrap"><i class="lab-glow"></i><article class="lab lab-${i.id}" data-dv="labs:${i.id}"></article></div></div>`).join('');
  },
  render() {
    const L = labRead();
    for (const i of LAB_IDEAS) {
      const el = this.el.querySelector(`[data-dv="labs:${i.id}"]`);
      put(el, LAB_DRAW[i.id](L));
      el.classList.toggle('offline', L.r.offline);
      const glow = el.previousElementSibling;
      glow.style.background = `radial-gradient(60% 70% at 30% 35%, rgba(${L.acc},${L.r.mood === 'off' || L.r.offline ? 0.18 : 0.55}), rgba(${L.acc},0) 70%), radial-gradient(50% 60% at 85% 80%, rgba(${L.acc},0.25), rgba(${L.acc},0) 70%)`;
    }
    this.sum = LAB_IDEAS.length + ' ideas';
  },
  act(id, a, b) {
    const t = LAB_T();
    if (a === 'power') return tPower(t);
    if (a === 'step') return tStep(t, b.dataset.f, Number(b.dataset.v));
  },
  sheet() { return null; },
});
