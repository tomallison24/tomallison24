// LABS: thermostat ideas, round two - the Living Room, wired to the real
// thermostat. The ruler on the cards now asked too much of the eye (ticks,
// lenses, tags, a band); these keep only what is needed, with space round
// it. Each is a plain glass pane, no sky. Controls are the card's own
// (data-th + tminus / tplus / power / teco / open, so the card's rules hold:
// Auto keeps Heat and Cool 3° apart, taps add up into one call):
//   A · Quiet    the room as one big thin number; the targets as two slim
//                glass capsules, − value +
//   B · Target   the target is the hero ("68–74°"), a soft chevron above and
//                below each number; the room is a small line
//   C · Line     one hairline from cold to warm with a dot for each target,
//                dragged; the room a small tick. No ticks, no numbers on it
//   D · Tile     as the Home app: name, what it's doing and the target; tap
//                for the popup, two small round − + for Auto's range
'use strict';
const TL_IDEAS = [
  { id: 'a', name: 'A · Quiet', note: 'The room as one big thin number. The targets as two slim glass capsules.' },
  { id: 'b', name: 'B · Target', note: 'The target is the hero, a soft chevron above and below each number to change it.' },
  { id: 'c', name: 'C · Line', note: 'One hairline, a dot for each target to drag, the room a small tick. Nothing else.' },
  { id: 'd', name: 'D · Tile', note: 'As the Home app: name, what it is doing and the target. Tap it for everything else.' },
];
const TL_T = () => THERMOS.find(t => t.id === 'lr');
// What each idea needs: the room, a word, the targets, and Eco / Off.
function tlRead() {
  const t = TL_T(), r = tread(t), n = v => v == null ? '--' : Math.round(v);
  const wo = st('weather.forecast_home'), out = wo && Number(wo.attributes.temperature);
  return { t, r, n, sets: tSets(t, r), word: tWord(t, r), out: Number.isFinite(out) ? Math.round(out) : null,
    acc: T_ACC[r.mood] || T_ACC.idle, on: !r.offline && r.s !== 'off' };
}
const tlPower = L => `<button class="tl-pwr${L.on ? ' on' : ''}${tWaiting(L.t, 'mode') ? ' wait' : ''}" data-a="power" style="--a:${L.acc}" aria-label="${L.on ? 'Turn off' : 'Turn on'}"${L.r.offline ? ' disabled' : ''}>${svg('power', 18)}</button>`;
const tlEco = L => `<button class="tl-eco${tWaiting(L.t, 'preset') ? ' wait' : ''}" data-a="teco" data-v="none">${svg('leaf', 14)}Exit Eco</button>`;
const tlSub = L => [L.word, L.out != null ? L.out + '° outside' : ''].filter(Boolean).join(' · ');
// A target's steppers are off where it can't go (its range, Eco).
const tlDis = (L, v, d) => L.r.eco || v == null || (d < 0 ? v <= L.r.min : v >= L.r.max);
const TL_DRAW = {
  a(L) {
    const caps = L.r.eco ? `<div class="tl-row">${tlEco(L)}</div>` : L.sets.length ? `<div class="tl-row">${L.sets.map(([f, label, v, rgb]) => `<div class="tl-cap">
        <button data-a="tminus" data-f="${f}" aria-label="Lower ${label}"${tlDis(L, v, -1) ? ' disabled' : ''}>${svg('minus', 16)}</button>
        <span><small style="color:rgb(${rgb})">${label}</small><b>${L.n(v)}°</b></span>
        <button data-a="tplus" data-f="${f}" aria-label="Raise ${label}"${tlDis(L, v, 1) ? ' disabled' : ''}>${svg('plus', 16)}</button></div>`).join('')}</div>` : '';
    return `<div class="tl-head"><span class="tl-name">${L.t.name}</span>${tlPower(L)}</div>
      <div class="tl-big">${L.n(L.r.cur)}<span>°</span></div><div class="tl-sub">${tlSub(L)}</div>${caps}`;
  },
  b(L) {
    const num = ([f, label, v, rgb]) => `<div class="tl-tg">
        <button class="tl-chev" data-a="tplus" data-f="${f}" aria-label="Raise ${label}"${tlDis(L, v, 1) ? ' disabled' : ''}>${svg('chevUp', 20)}</button>
        <b style="--c:${rgb}">${L.n(v)}<span>°</span></b>
        <button class="tl-chev" data-a="tminus" data-f="${f}" aria-label="Lower ${label}"${tlDis(L, v, -1) ? ' disabled' : ''}>${svg('chev', 20)}</button>
        <small>${label}</small></div>`;
    const body = !L.sets.length ? `<div class="tl-big tl-off">${L.r.s === 'fan_only' ? 'Fan' : 'Off'}</div>`
      : `<div class="tl-tgs">${L.sets.map(num).join('<i class="tl-dash">–</i>')}</div>`;
    return `<div class="tl-head"><span class="tl-name">${L.t.name}<em>${L.n(L.r.cur)}° inside</em></span>${tlPower(L)}</div>
      ${body}<div class="tl-sub tl-mid">${tlSub(L)}</div>${L.r.eco ? `<div class="tl-row tl-mid">${tlEco(L)}</div>` : ''}`;
  },
  c(L) {
    // The line runs over a window round the targets and the room.
    const vals = L.sets.map(x => x[2] == null ? 70 : x[2]).concat(L.r.cur != null ? [L.r.cur] : []);
    const lo = Math.min(...vals, 70) - 6, hi = Math.max(...vals, 70) + 6, pc = v => ((v - lo) / (hi - lo) * 100).toFixed(2);
    const dots = L.sets.map(([f, label, v, rgb]) => `<i class="tl-dot" data-f="${f}" data-v="${Math.round(v)}" style="left:${pc(v)}%;--c:${rgb}" role="slider" aria-label="${label}" aria-valuenow="${Math.round(v)}"></i>`).join('');
    const vals2 = L.sets.map(([f, label, v, rgb]) => `<span data-f="${f}"><small style="color:rgb(${rgb})">${label}</small> <b>${L.n(v)}°</b></span>`).join('');
    return `<div class="tl-head"><span class="tl-name">${L.t.name}</span><span class="tl-room">${L.n(L.r.cur)}°</span>${tlPower(L)}</div>
      <div class="tl-vals">${L.sets.length ? vals2 : `<span><b>${L.r.s === 'fan_only' ? 'Fan' : 'Off'}</b></span>`}</div>
      ${L.sets.length ? `<div class="tl-line${L.r.eco ? ' locked' : ''}" data-lo="${lo}" data-hi="${hi}"><i class="tl-hair"></i>${L.r.cur != null ? `<i class="tl-now" style="left:${pc(L.r.cur)}%"></i>` : ''}${dots}</div>` : ''}
      <div class="tl-sub">${tlSub(L)}</div>${L.r.eco ? `<div class="tl-row">${tlEco(L)}</div>` : ''}`;
  },
  d(L) {
    const tgt = L.sets.length ? L.sets.map(x => L.n(x[2])).join('–') + '°' : L.r.s === 'fan_only' ? 'Fan' : 'Off';
    const ic = L.r.act === 'heating' ? 'fire' : L.r.act === 'cooling' ? 'snow' : L.r.eco ? 'leaf' : 'thermostat';
    const step = L.sets.length && !L.r.eco ? `<div class="tl-mini">${L.sets.map(([f, label, v, rgb]) => `<span><small style="color:rgb(${rgb})">${label}</small><button data-a="tminus" data-f="${f}" aria-label="Lower ${label}"${tlDis(L, v, -1) ? ' disabled' : ''}>${svg('minus', 14)}</button><button data-a="tplus" data-f="${f}" aria-label="Raise ${label}"${tlDis(L, v, 1) ? ' disabled' : ''}>${svg('plus', 14)}</button></span>`).join('')}</div>` : '';
    return `<button class="tl-tile" data-a="open" aria-label="All of the ${L.t.name}'s controls">
        <span class="tl-ic" style="--a:${L.acc}">${svg(ic, 22)}</span>
        <span class="tl-k"><b>${L.t.name}</b><small>${L.word} · ${L.n(L.r.cur)}° inside</small></span>
        <span class="tl-t">${tgt}</span></button>${step}`;
  },
};
// C's dots: drag along the line in whole degrees (3° apart in Auto); one
// change on letting go, as the card's taps send it.
let tlDrag = null, tlDragged = 0;
document.addEventListener('pointerdown', e => {
  const dot = e.target.closest && e.target.closest('.tl-dot'); if (!dot) return;
  const line = dot.parentElement; if (line.classList.contains('locked')) return;
  const box = line.getBoundingClientRect(), other = [...line.querySelectorAll('.tl-dot')].find(d => d !== dot);
  tlDrag = { dot, line, box, lo: Number(line.dataset.lo), hi: Number(line.dataset.hi), f: dot.dataset.f, from: Number(dot.dataset.v), v: Number(dot.dataset.v), other: other ? Number(other.dataset.v) : null, id: e.pointerId };
  rangeHeld = line; dot.classList.add('drag');
  try { line.setPointerCapture(e.pointerId); } catch {}
  e.preventDefault();
});
document.addEventListener('pointermove', e => {
  const D = tlDrag; if (!D || e.pointerId !== D.id) return;
  const r = tread(TL_T());
  let v = Math.round(D.lo + (e.clientX - D.box.left) / D.box.width * (D.hi - D.lo));
  v = Math.max(Math.ceil(D.lo), Math.min(Math.floor(D.hi), Math.max(r.min, Math.min(r.max, v))));
  if (D.other != null) v = D.f === 'target_temp_low' ? Math.min(v, D.other - T_GAP) : Math.max(v, D.other + T_GAP);
  if (v === D.v) return;
  D.v = v; D.dot.style.left = ((v - D.lo) / (D.hi - D.lo) * 100).toFixed(2) + '%';
  const lab = D.line.parentElement.querySelector(`.tl-vals [data-f="${D.f}"] b`); if (lab) lab.textContent = v + '°';
});
function tlDrop(e, keep) {
  const D = tlDrag; if (!D || e.pointerId !== D.id) return;
  tlDrag = null; rangeHeld = null; tlDragged = Date.now(); D.dot.classList.remove('drag');
  last.delete(D.line.closest('[data-th]'));
  if (keep && D.v !== D.from) tStep(TL_T(), D.f, D.v - D.from);
  render();
}
document.addEventListener('pointerup', e => tlDrop(e, true));
document.addEventListener('pointercancel', e => tlDrop(e, false));
document.addEventListener('click', e => { if (Date.now() - tlDragged < 400 && e.target.closest && e.target.closest('.tl-line')) { e.stopPropagation(); tlDragged = 0; } }, true);

family({
  id: 'tlab', name: 'Thermostat ideas', group: 'Labs', order: 0,
  mount(el) {
    el.innerHTML = `<p class="tnote lab-intro">A fresh, simpler round for the thermostat card, on the Living Room. They are live: they work the real thermostat.</p>`
      + TL_IDEAS.map(i => `<div class="tl-idea"><div class="lab-sh">${i.name}</div><p class="tl-note">${i.note}</p>
        <article class="tl tl-${i.id}" data-th="lr"></article></div>`).join('');
  },
  render() {
    const L = tlRead();
    for (const i of TL_IDEAS) {
      const el = this.el.querySelector(`.tl-${i.id}`);
      put(el, TL_DRAW[i.id](L));
      el.style.setProperty('--a', L.acc);
      el.classList.toggle('offline', L.r.offline);
    }
    this.sum = TL_IDEAS.length + ' ideas';
  },
  sheet() { return null; },
});
