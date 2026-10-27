// labs/tron-icons: Tron icon styles, each made from an app's own Vintage icon.svg (as aOS/scripts/make-looks.mjs
// makes today's Tron icon), so a style picked here can become the generator's. Every Vintage icon is the same
// four layers: the ground (a full-size rect), a big disc (a circle, r 90 or more), a pill (a rotated rounded
// rect) and the cream drawing on top (cut out with masks). Each style redraws those four.
// Trail frame was picked: it's Tron's icon now (make-looks.mjs), and Identity disc is how they were before.
//   window.tronStyles = [{ id, name, about, make(svgText, ground) }]   ground: the Tron ground for that app
'use strict';
(() => {
  const RED = '#FF2A2A', HOT = '#FFE3E0', NS = 'http://www.w3.org/2000/svg';

  // the four layers of a Vintage icon
  function layers(svgText) {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml'), svg = doc.documentElement;
    const kids = [...svg.children];
    const defs = kids.filter(k => k.localName === 'defs').map(k => k.innerHTML).join('');
    const rest = kids.filter(k => k.localName !== 'defs');
    const isGround = k => k.localName === 'rect' && k.getAttribute('width') === '512' && k.getAttribute('height') === '512' && !k.getAttribute('mask');
    const isDisc = k => k.localName === 'circle' && +k.getAttribute('r') >= 90;
    const isPill = k => k.localName === 'rect' && /rotate/.test(k.getAttribute('transform') || '');
    const disc = rest.find(isDisc), pill = rest.find(isPill);
    const art = rest.filter(k => !isGround(k) && k !== disc && k !== pill);
    const d = disc ? { cx: +disc.getAttribute('cx'), cy: +disc.getAttribute('cy'), r: +disc.getAttribute('r') } : null;
    const p = pill ? ['x', 'y', 'width', 'height', 'rx', 'transform'].reduce((o, a) => (o[a] = pill.getAttribute(a), o), {}) : null;
    return { defs, disc: d, pill: p, art: art.map(k => k.outerHTML).join('') };
  }
  const pillEl = (p, extra) => p ? `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" rx="${p.rx}" transform="${p.transform}" ${extra}/>` : '';
  const wrap = (body, defs) => `<svg xmlns="${NS}" viewBox="0 0 512 512" width="512" height="512"><defs>${defs}</defs>${body}</svg>`;
  // ids are per style and per icon: several icons sit on one page
  let n = 0;

  // the drawing's edge as a lit line: a red tube with a white-hot core and a glow (from its shape, masks and all)
  const edge = (id, w, glow) => `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="512" height="512" color-interpolation-filters="sRGB">
    <feMorphology in="SourceAlpha" operator="erode" radius="${w}" result="in"/>
    <feComposite in="SourceAlpha" in2="in" operator="out" result="ring"/>
    <feFlood flood-color="${RED}"/><feComposite in2="ring" operator="in" result="red"/>
    <feMorphology in="SourceAlpha" operator="erode" radius="${(w * 0.3).toFixed(1)}" result="a"/>
    <feMorphology in="SourceAlpha" operator="erode" radius="${(w * 0.7).toFixed(1)}" result="b"/>
    <feComposite in="a" in2="b" operator="out" result="c"/>
    <feFlood flood-color="${HOT}"/><feComposite in2="c" operator="in" result="core"/>
    <feGaussianBlur in="red" stdDeviation="${glow}" result="glow"/>
    <feMerge><feMergeNode in="glow"/><feMergeNode in="glow"/><feMergeNode in="red"/><feMergeNode in="core"/></feMerge>
  </filter>`;
  const glowF = (id, sd) => `<filter id="${id}" filterUnits="userSpaceOnUse" x="-40" y="-40" width="592" height="592"><feGaussianBlur in="SourceGraphic" stdDeviation="${sd}" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  // the grid: a flat one, or a floor in perspective (the vanishing point at y0)
  const flatGrid = (op) => { let s = ''; for (let i = 32; i < 512; i += 32) s += `<path d="M${i} 0V512M0 ${i}H512"/>`; return `<g stroke="${RED}" stroke-opacity="${op}" stroke-width="1.5">${s}</g>`; };
  const floor = (y0, id) => {
    let s = '';
    for (let i = -8; i <= 8; i++) s += `<path d="M256 ${y0}L${256 + i * 90} 512"/>`;
    for (let k = 1; k <= 7; k++) { const y = y0 + (512 - y0) * Math.pow(k / 7, 1.9); s += `<path d="M0 ${y.toFixed(1)}H512"/>`; }
    return `<linearGradient id="${id}f" x1="0" y1="${y0}" x2="0" y2="512" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>
      <mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect y="${y0}" width="512" height="${512 - y0}" fill="url(#${id}f)"/></mask>|<g mask="url(#${id}m)" stroke="${RED}" stroke-opacity=".9" stroke-width="3">${s}</g>`;
  };
  const rings = (d, w = 1) => d ? `<circle cx="${d.cx}" cy="${d.cy}" r="${(d.r * 0.9).toFixed(1)}" fill="none" stroke="${RED}" stroke-width="${(d.r * 0.12 * w).toFixed(1)}"/><circle cx="${d.cx}" cy="${d.cy}" r="${(d.r * 0.52).toFixed(1)}" fill="none" stroke="${RED}" stroke-width="${(d.r * 0.07 * w).toFixed(1)}"/><circle cx="${d.cx}" cy="${d.cy}" r="${(d.r * 0.12).toFixed(1)}" fill="${RED}"/>` : '';

  const styles = [
    { id: 'today', name: 'Identity disc', about: 'Tron’s icons before Trail frame: the drawing in white on near-black, the sun an identity disc, the pill a red bar.',
      make(svg, ground) {
        const L = layers(svg);
        return wrap(`<rect width="512" height="512" fill="${ground || '#07090B'}"/>${rings(L.disc)}${pillEl(L.pill, `fill="${RED}"`)}<g>${L.art.replace(/(fill|stroke)="#FBF5E9"/gi, (m, k) => `${k}="#F6F7F9"`)}</g>`, L.defs);
      } },

    { id: 'lines', name: 'Light lines',
      about: 'Only light: the drawing traced as a glowing red line on black, over a faint grid. The disc and the pill become thin rings and a light trail.',
      make(svg) {
        const L = layers(svg), id = 'l' + (++n);
        const disc = L.disc ? `<circle cx="${L.disc.cx}" cy="${L.disc.cy}" r="${(L.disc.r * 0.82).toFixed(1)}" fill="none" stroke="${RED}" stroke-opacity=".7" stroke-width="7" filter="url(#${id}g)"/>` : '';
        return wrap(`<rect width="512" height="512" fill="#030405"/>${flatGrid(0.13)}${disc}${pillEl(L.pill, `fill="none" stroke="${RED}" stroke-opacity=".7" stroke-width="7" filter="url(#${id}g)"`)}<g filter="url(#${id}e)">${L.art}</g>`,
          L.defs + edge(id + 'e', 9, 10) + glowF(id + 'g', 6));
      } },

    { id: 'edges', name: 'Lit edges',
      about: 'Like the light cycles: the drawing a dark solid with a red edge lit up, standing on a grid floor that runs off to the horizon.',
      make(svg, ground) {
        const L = layers(svg), id = 'e' + (++n), [fdefs, fl] = floor(250, id).split('|');
        return wrap(`<rect width="512" height="512" fill="${ground || '#07090B'}"/>${fl}${rings(L.disc, 0.8)}${pillEl(L.pill, `fill="${RED}" filter="url(#${id}g)"`)}
          <g fill="#15181C">${L.art.replace(/(fill|stroke)="#FBF5E9"/gi, (m, k) => `${k}="#15181C"`)}</g><g filter="url(#${id}e)">${L.art}</g>`,
          L.defs + fdefs + edge(id + 'e', 6, 7) + glowF(id + 'g', 7));
      } },

    { id: 'ares', name: 'Ares red',
      about: 'After Tron: Ares: the drawing lit solid red with a white-hot edge, glowing out of black. The disc and the pill drop back to faint white lines.',
      make(svg) {
        const L = layers(svg), id = 'a' + (++n);
        const disc = L.disc ? `<circle cx="${L.disc.cx}" cy="${L.disc.cy}" r="${(L.disc.r * 0.85).toFixed(1)}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="5"/>` : '';
        const solid = `<filter id="${id}s" filterUnits="userSpaceOnUse" x="-40" y="-40" width="592" height="592" color-interpolation-filters="sRGB">
          <feFlood flood-color="${RED}"/><feComposite in2="SourceAlpha" operator="in" result="red"/>
          <feMorphology in="SourceAlpha" operator="erode" radius="3" result="e"/><feComposite in="SourceAlpha" in2="e" operator="out" result="ring"/>
          <feFlood flood-color="${HOT}"/><feComposite in2="ring" operator="in" result="hot"/>
          <feGaussianBlur in="red" stdDeviation="16" result="glow"/>
          <feMerge><feMergeNode in="glow"/><feMergeNode in="red"/><feMergeNode in="hot"/></feMerge></filter>`;
        return wrap(`<rect width="512" height="512" fill="#050405"/><circle cx="256" cy="290" r="260" fill="url(#${id}v)"/>${disc}${pillEl(L.pill, `fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="5"`)}<g filter="url(#${id}s)">${L.art}</g>`,
          L.defs + solid + `<radialGradient id="${id}v" gradientUnits="userSpaceOnUse" cx="256" cy="290" r="260"><stop offset="0" stop-color="${RED}" stop-opacity=".16"/><stop offset="1" stop-color="${RED}" stop-opacity="0"/></radialGradient>`);
      } },

    { id: 'trail', name: 'Trail frame',
      about: 'Picked, and now Tron’s icons: the screen’s light trail on every icon, a red trail around the edge with its light at the top right. The drawing stays white; the disc and pill go, so it’s calm. On aOS Home the screen’s trail sends a shot round one now and then.',
      make(svg, ground) {
        const L = layers(svg), id = 't' + (++n);
        // the trail: just inside the corners the phone rounds off; its light at the top right
        const path = 'M120 26H392A94 94 0 0 1 486 120V392A94 94 0 0 1 392 486H120A94 94 0 0 1 26 392V120A94 94 0 0 1 120 26Z';
        const len = 4 * 272 + 2 * Math.PI * 94;
        return wrap(`<rect width="512" height="512" fill="${ground || '#07090B'}"/>
          <path d="${path}" fill="none" stroke="${RED}" stroke-width="8" filter="url(#${id}g)"/>
          <path d="${path}" fill="none" stroke="${HOT}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(len * 0.1).toFixed(0)} ${len.toFixed(0)}" stroke-dashoffset="${(-len * 0.15).toFixed(0)}" filter="url(#${id}g)"/>
          <g>${L.art.replace(/(fill|stroke)="#FBF5E9"/gi, (m, k) => `${k}="#F6F7F9"`)}</g>`,
          L.defs + glowF(id + 'g', 6));
      } },
  ];
  window.tronStyles = styles;
})();
