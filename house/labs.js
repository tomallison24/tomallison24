// LABS: ideas tried out live before they replace anything. Each one here is
// wired to the real device, so it can be used, not only looked at; the view
// is left out of the drop-down while it has no ideas.
//
// Today: the Favorites automation pills, four ways, more Liquid Glass. Glass
// only reads with something behind it to bend, and Favorites is dark, so
// each pill brings its own light: a blurred glow of the automation's colour
// sits behind the pane (faint at rest, full when lit), and the pane - a
// light tint, a strong blur, a bright top rim and a softer lower one, as a
// lens has - diffuses it. Taps are the real ones (favorites.js runs them).
//   A · Clear  - clear capsules, a glass ring for the icon; lit, the ring
//                fills white and the colour blooms behind
//   B · Bead   - the icon in a glass sphere with a highlight, tinted with
//                the colour; lit, the sphere glows
//   C · Tint   - each pane faintly tinted its colour, the rim too; lit, the
//                tint and the rim deepen
//   D · Control - Control Center tiles, three across, icon over name; lit,
//                the tile turns white glass with a dark icon
'use strict';
const LAB_IDEAS = [
  { id: 'a', name: 'A · Clear', note: 'Clear glass capsules with a glass ring for the icon. Lit, the ring fills white and its colour blooms behind the glass.' },
  { id: 'b', name: 'B · Bead', note: 'The icon in a tinted glass bead with a highlight. Lit, the bead glows.' },
  { id: 'c', name: 'C · Tint', note: 'Each pane faintly tinted with its colour, rim and all. Lit, the colour deepens.' },
  { id: 'd', name: 'D · Control', note: 'Control Center tiles, three across. Lit, the tile turns white glass.' },
];
// Each automation's colour: night indigo, evening amber, morning gold, the
// bug grey, the sitter rose, the Hatch green.
const LAB_ACC = { goodnight: '150,160,255', evening: '255,176,110', awake: '255,214,120', bug: '190,194,204', sitter: '255,150,190', hatch: '120,220,150' };

family({
  id: 'labs', name: 'Automation pills', group: 'Labs', order: 1,
  mount(el) {
    el.innerHTML = `<p class="tnote lab-intro">Ideas for the Favorites automation pills, in Liquid Glass. They are live: a tap runs the automation.</p>`
      + LAB_IDEAS.map(i => `<div class="lab-idea"><div class="lab-h"><b>${i.name}</b><span>${i.note}</span></div>
        <div class="la la-${i.id}" data-dv="labs:${i.id}"></div></div>`).join('');
  },
  pill(i, a, s) {
    const name = s.lit && a.onName ? a.onName : a.name, c = LAB_ACC[a.id] || '255,255,255';
    const wait = tWaiting(s.d, 'lit') || tWaiting(s.d, 'on');
    return `<div class="lw${s.lit ? ' lit' : ''}" style="--c:${c}"><i class="lw-glow"></i>
      <button class="lp-g${s.lit ? ' lit' : ''}${wait ? ' wait' : ''}" data-a="auto" data-v="${a.id}" aria-pressed="${s.lit}"${s.dis ? ' disabled' : ''}>
        <span class="lg-ic">${svg(s.lit && i !== 'd' ? 'check' : a.icon, i === 'd' ? 24 : 20)}</span><span class="lg-n">${esc(name)}</span></button></div>`;
  },
  render() {
    const fav = famOf('fav');
    for (const i of LAB_IDEAS) put(this.el.querySelector(`[data-dv="labs:${i.id}"]`), FAV_AUTOS.map(a => this.pill(i.id, a, fav.autoState(a))).join(''));
    this.sum = LAB_IDEAS.length + ' ideas';
  },
  // A tap is the Favorites pill's own.
  act(id, a, b) { if (a === 'auto') return famOf('fav').act('autos', a, b); },
  sheet() { return null; },
});
