'use strict';

// The unicorn's stable and the princess's castle, drawn in code as SVG, in the same look as art.js
// and rooms.js: soft rounded shapes, a deep plum outline (never black), flat pastel colour with one
// gentle highlight, and twinkles. No words, letters or numbers anywhere.
//
//   SparkleStableArt.scene(opt)    the inside of her stable, <svg viewBox="0 0 400 300">: plank walls,
//                                  a big arched window (opt.night: moon and stars), hay bales, a hook
//                                  with a horseshoe, a water trough on the right, a straw bed in the
//                                  middle, and a lantern on the left wall (opt.lantern: lit, with a
//                                  warm glow). The middle of the floor stays clear: the app stands the
//                                  unicorn over the straw bed, hooves at about y 262, centred at x 200,
//                                  about 190 wide.
//   SparkleStableArt.prop(id, opt) one thing alone for a tray button, <svg viewBox="0 0 100 100">:
//                                  food (oats, apple, carrot, sugar, clover), care (sponge, brush,
//                                  bucket, towel), toys (ball, bubbles, ribbon, kite) and the lantern
//                                  (opt.on: lit). PROPS lists them by group.
//   SparkleStableArt.need(kind, size)  a small round icon for a need (food, clean, fun, rest),
//                                  <svg viewBox="0 0 40 40">, to sit beside its meter
//   SparkleStableArt.bubble(size)  one see-through soap bubble, <svg viewBox="0 0 40 40">
//   SparkleStableArt.castle(opt)   her castle as a cut-away dollhouse, <svg viewBox="0 0 400 560">: the
//                                  castle from the map with its front wall off, so you see into each
//                                  room, and a little barn on its side for the unicorn. Each room is a
//                                  <g data-go="ID" class="croom"> ending in a transparent <rect
//                                  class="hit">; opt.night: a starry sky and lit windows.
//   SparkleStableArt.CASTLE_ROOMS  [{ id, x, y, w, h }] each room's box in the castle's viewBox (the
//                                  same as its hit rect), to place a label or a glow
//
// Gradients, patterns and clip paths get their own ids (uid) so many pictures can share a page.
(function (root) {
  let n = 0;
  const uid = p => `ss${p}${++n}`;
  const INK = '#4B2E6F';
  const C = {
    pink: '#FF8FC7', blush: '#FFB3DA', rose: '#FF5FA8', lilac: '#B79BFF', lav: '#D9CCFF', mint: '#7FE0C7', sky: '#8FD3FF',
    gold: '#FFC94A', amber: '#F5A623', cream: '#FFF6E9', white: '#FFFFFF', peach: '#FFC7A8', coral: '#FF8A7A', berry: '#C04B9A', teal: '#4FC3B8',
    wood: '#E9B872', woodD: '#C98B5E', woodL: '#F3CF98', hay: '#FFD978', hayD: '#E9AE3C', hayL: '#FFF0B8', water: '#9ED8FF', silver: '#D9CCFF', apple: '#FF6B7E', leaf: '#6FD39A',
  };
  const NIGHT = '#2A2F6B';

  const f = v => +(+v).toFixed(1);
  const sw = w => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const O = sw(3), T = sw(2), H = sw(1.5);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const svg = (vb, body, label = '', extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${extra} ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${body}</svg>`;
  const shade = (hex, k) => { const v = parseInt(hex.slice(1), 16); const r = v >> 16, g = (v >> 8) & 255, b = v & 255;
    const h = x => Math.max(0, Math.min(255, Math.round(k < 0 ? x * (1 + k) : x + (255 - x) * k)));
    return '#' + [h(r), h(g), h(b)].map(x => x.toString(16).padStart(2, '0')).join(''); };

  // ---- small pieces ----
  const star = (x, y, r, fill = C.gold, extra = '') => {
    const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.48 : r; p.push(`${f(x + Math.cos(a) * rr)},${f(y + Math.sin(a) * rr)}`); }
    return `<polygon points="${p.join(' ')}" fill="${fill}" ${extra}/>`;
  };
  const twinkle = (x, y, r, fill = '#fff') => `<path d="M${f(x)} ${f(y - r)}Q${f(x + r * 0.18)} ${f(y - r * 0.18)} ${f(x + r)} ${f(y)}Q${f(x + r * 0.18)} ${f(y + r * 0.18)} ${f(x)} ${f(y + r)}Q${f(x - r * 0.18)} ${f(y + r * 0.18)} ${f(x - r)} ${f(y)}Q${f(x - r * 0.18)} ${f(y - r * 0.18)} ${f(x)} ${f(y - r)}Z" fill="${fill}"/>`;
  const heart = (x, y, s, fill = C.rose, extra = '') => `<path d="M${f(x)} ${f(y + s * 0.9)}C${f(x - s * 1.4)} ${f(y - s * 0.1)} ${f(x - s * 0.7)} ${f(y - s * 1.1)} ${f(x)} ${f(y - s * 0.35)}C${f(x + s * 0.7)} ${f(y - s * 1.1)} ${f(x + s * 1.4)} ${f(y - s * 0.1)} ${f(x)} ${f(y + s * 0.9)}Z" fill="${fill}" ${extra}/>`;
  // a crescent moon, horns to the right
  const moon = (x, y, r, fill = C.gold, extra = '') => { const a = x + r * 0.55, h = r * 0.93;
    return `<path d="M${f(a)} ${f(y - h)}A${f(r)} ${f(r)} 0 1 0 ${f(a)} ${f(y + h)}A${f(h)} ${f(h)} 0 0 1 ${f(a)} ${f(y - h)}Z" fill="${fill}" ${extra}/>`; };
  const shadow = (cx, cy, rx) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(rx * 0.14)}" fill="${INK}" opacity=".13"/>`;
  const hl = (d, w = 3) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" opacity=".65"/>`;
  // a coloured line with an outline (handles, chains, stems, bands)
  const bar = (d, col, w, ow = 3) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f(w + ow)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  // circles merged under one outline (clouds, foam, straw mounds): [x, y, r] or [x, y, rx, ry]
  const blob = (shapes, fill, ow = 3, stroke = INK) => {
    const one = (s, g, col) => s.length === 3 ? `<circle cx="${f(s[0])}" cy="${f(s[1])}" r="${f(s[2] + g)}" fill="${col}"/>` : `<ellipse cx="${f(s[0])}" cy="${f(s[1])}" rx="${f(s[2] + g)}" ry="${f(s[3] + g)}" fill="${col}"/>`;
    return shapes.map(s => one(s, ow / 2, stroke)).join('') + shapes.map(s => one(s, 0, fill)).join('');
  };
  const rng = seed => { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
  const cloudShape = (x, y, s, fill = '#fff', extra = '') => `<path d="M${f(x - 30 * s)} ${f(y + 10 * s)}C${f(x - 42 * s)} ${f(y + 10 * s)} ${f(x - 42 * s)} ${f(y - 6 * s)} ${f(x - 28 * s)} ${f(y - 6 * s)}C${f(x - 26 * s)} ${f(y - 20 * s)} ${f(x - 6 * s)} ${f(y - 22 * s)} ${f(x)} ${f(y - 12 * s)}C${f(x + 8 * s)} ${f(y - 24 * s)} ${f(x + 30 * s)} ${f(y - 18 * s)} ${f(x + 28 * s)} ${f(y - 4 * s)}C${f(x + 42 * s)} ${f(y - 4 * s)} ${f(x + 42 * s)} ${f(y + 10 * s)} ${f(x + 30 * s)} ${f(y + 10 * s)}Z" fill="${fill}" ${extra}/>`;
  // straw: short strokes scattered in a box (x, y, w, h), n of them
  const straw = (x, y, w, h, nn, seed, cols = [C.hayD, C.hayL], width = 2) => { const r = rng(seed); let s = '';
    for (let i = 0; i < nn; i++) { const px = x + r() * w, py = y + r() * h, a = (r() - 0.5) * 1.6, l = 5 + r() * 6;
      s += `<path d="M${f(px)} ${f(py)}l${f(Math.cos(a) * l)} ${f(Math.sin(a) * l)}" stroke="${cols[i % cols.length]}" stroke-width="${width}" stroke-linecap="round"/>`; }
    return s; };

  // ---- the floor in perspective (as in rooms.js) ----
  const persp = (t, r) => t / (r - t * (r - 1));
  const fp = (q, s, d) => { const bx = q.bl[0] + (q.br[0] - q.bl[0]) * s, by = q.bl[1] + (q.br[1] - q.bl[1]) * s;
    const fx = q.fl[0] + (q.fr[0] - q.fl[0]) * s, fy = q.fl[1] + (q.fr[1] - q.fl[1]) * s; return [bx + (fx - bx) * d, by + (fy - by) * d]; };
  const pt = p => `${f(p[0])} ${f(p[1])}`;
  const quadD = q => `M${pt(q.bl)}L${pt(q.br)}L${pt(q.fr)}L${pt(q.fl)}Z`;
  const ratio = q => (q.fr[0] - q.fl[0]) / (q.br[0] - q.bl[0]);
  function planks(q, base, seam, cols = 9, rows = 5, w = 1.6) {
    const r = ratio(q); let out = `<path d="${quadD(q)}" fill="${base}"/>`;
    for (let i = 1; i < cols; i++) out += `<path d="M${pt(fp(q, i / cols, 0))}L${pt(fp(q, i / cols, 1))}" stroke="${seam}" stroke-width="${w}"/>`;
    for (let j = 1; j < rows; j++) { const d = persp(j / rows, r);
      for (let i = 0; i < cols; i++) if ((i * 2 + j) % 3 === 0) out += `<path d="M${pt(fp(q, i / cols, d))}L${pt(fp(q, (i + 1) / cols, d))}" stroke="${seam}" stroke-width="${w}"/>`; }
    return out;
  }
  function checks(q, cols, rows, a, b) {
    const r = ratio(q); let out = `<path d="${quadD(q)}" fill="${a}"/>`;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if ((i + j) % 2) {
      const d0 = persp(j / rows, r), d1 = persp((j + 1) / rows, r);
      out += `<path d="M${pt(fp(q, i / cols, d0))}L${pt(fp(q, (i + 1) / cols, d0))}L${pt(fp(q, (i + 1) / cols, d1))}L${pt(fp(q, i / cols, d1))}Z" fill="${b}" stroke="${b}" stroke-width=".6"/>`; }
    return out;
  }

  // ---- shared things (scene and props) ----
  // a hay bale: a rounded block of straw tied with two pink twine bands
  function bale(x, y, w, h, seed, ow = 3) {
    const s = `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(Math.min(10, h * 0.25))}" fill="${C.hay}" ${sw(ow)}/>`
      + straw(x + 5, y + 6, w - 14, h - 14, Math.round(w * h / 90), seed, [C.hayD, C.hayL, C.hayD])
      + hl(`M${f(x + 8)} ${f(y + 5)}H${f(x + w * 0.45)}`, 2.5)
      + [0.28, 0.72].map(t => `<path d="M${f(x + w * t)} ${f(y + 1)}V${f(y + h - 1)}" stroke="${INK}" stroke-width="${f(3 + ow)}"/><path d="M${f(x + w * t)} ${f(y + 1)}V${f(y + h - 1)}" stroke="${C.rose}" stroke-width="3"/>`).join('');
    return s;
  }
  // a lantern: ring, cap, glass, base; lit has a flame and a halo
  function lantern(x, y, s, lit, ow = 3) {   // (x, y): the top of the ring; about 52 tall at s = 1
    const P = (u, v) => `${f(x + u * s)} ${f(y + v * s)}`, glass = lit ? '#FFE58A' : '#EEE9FA';
    let g = '';
    if (lit) { const id = uid('lh'); g += `<defs><radialGradient id="${id}"><stop offset="0" stop-color="#FFE9A0" stop-opacity=".9"/><stop offset=".5" stop-color="${C.gold}" stop-opacity=".35"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient></defs>
      <circle cx="${f(x)}" cy="${f(y + 30 * s)}" r="${f(34 * s)}" fill="url(#${id})"/>`; }
    g += `<circle cx="${f(x)}" cy="${f(y + 3 * s)}" r="${f(4 * s)}" fill="none" stroke="${INK}" stroke-width="${f(ow + 2.5)}"/><circle cx="${f(x)}" cy="${f(y + 3 * s)}" r="${f(4 * s)}" fill="none" stroke="${C.gold}" stroke-width="2.5"/>`
      + `<path d="M${P(-10, 13)}L${P(-5, 7)}H${f(x + 5 * s)}L${P(10, 13)}Z" fill="${C.lilac}" ${sw(ow)}/>`
      + `<rect x="${f(x - 11 * s)}" y="${f(y + 13 * s)}" width="${f(22 * s)}" height="${f(28 * s)}" rx="${f(5 * s)}" fill="${glass}" ${sw(ow)}/>`;
    if (lit) g += `<path d="M${P(0, 20)}C${P(5, 26)} ${P(5, 33)} ${P(0, 34)}C${P(-5, 33)} ${P(-5, 26)} ${P(0, 20)}Z" fill="#FF9F43"/><path d="M${P(0, 25)}C${P(2.6, 28)} ${P(2.6, 32)} ${P(0, 32.5)}C${P(-2.6, 32)} ${P(-2.6, 28)} ${P(0, 25)}Z" fill="#FFF6C8"/>`;
    else g += `<rect x="${f(x - 3.5 * s)}" y="${f(y + 26 * s)}" width="${f(7 * s)}" height="${f(12 * s)}" rx="${f(1.5 * s)}" fill="#fff" ${sw(ow * 0.6)}/><path d="M${P(0, 26)}V${P(0, 23).split(' ')[1]}" stroke="${INK}" stroke-width="${f(ow * 0.6)}" stroke-linecap="round"/>`;
    g += `<path d="M${P(0, 13)}V${P(0, 41).split(' ')[1]}M${P(-11, 27)}H${f(x + 11 * s)}" stroke="${INK}" stroke-width="${f(ow * 0.5)}" opacity=".35"/>`
      + `<rect x="${f(x - 13 * s)}" y="${f(y + 40 * s)}" width="${f(26 * s)}" height="${f(7 * s)}" rx="${f(3 * s)}" fill="${C.lilac}" ${sw(ow)}/>`
      + hl(`M${P(-6, 18)}V${P(-6, 25).split(' ')[1]}`, 2.2);
    return g;
  }
  // a horseshoe, open side down, top of the curve at (x, y)
  const horseshoe = (x, y, s = 1, ow = 3) => bar(`M${f(x - 12 * s)} ${f(y + 30 * s)}V${f(y + 14 * s)}Q${f(x - 12 * s)} ${f(y)} ${f(x)} ${f(y)}Q${f(x + 12 * s)} ${f(y)} ${f(x + 12 * s)} ${f(y + 14 * s)}V${f(y + 30 * s)}`, C.silver, 8 * s, ow)
    + [[-12, 24], [-11, 10], [11, 10], [12, 24]].map(([u, v]) => `<circle cx="${f(x + u * s)}" cy="${f(y + v * s)}" r="${f(1.4 * s)}" fill="#fff"/>`).join('');

  // ---- the stable ----
  function scene(opt = {}) {
    const night = !!opt.night, lit = !!opt.lantern;
    const clip = uid('clip'), sky = uid('sky'), fsh = uid('fsh'), glow = uid('glow'), win = uid('win');
    const wallA = '#F2C690', wallB = '#EBBA80', seam = '#CF9A63';
    let wall = `<rect width="400" height="196" fill="${wallA}"/>`;
    for (let i = 0; i < 10; i++) { if (i % 2) wall += `<rect x="${i * 40}" width="40" height="196" fill="${wallB}"/>`; if (i) wall += `<path d="M${i * 40} 0V150" stroke="${seam}" stroke-width="2"/>`; }
    wall += [[22, 44], [96, 130], [252, 70], [372, 120], [300, 118], [62, 24]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4.5" ry="2.6" fill="none" stroke="${seam}" stroke-width="1.8"/>`).join('');
    // a lower band of boards across the wall, under a rail
    wall += `<rect y="152" width="400" height="44" fill="#E2AC72"/><path d="M0 166H400M0 180H400" stroke="${seam}" stroke-width="1.8"/>`
      + [40, 130, 210, 300, 360].map((x, i) => `<path d="M${x} ${i % 2 ? 152 : 166}V${i % 2 ? 166 : 180}" stroke="${seam}" stroke-width="1.8"/>`).join('')
      + `<rect x="-4" y="146" width="408" height="8" rx="3" fill="${C.wood}" ${T}/>`;
    // the big arched window
    const glass = 'M120 146V82A42 42 0 0 1 204 82V146Z';
    const view = night
      ? `<rect x="110" y="30" width="104" height="120" fill="url(#${sky})"/>${moon(180, 68, 13, '#FFF3D1')}${twinkle(138, 64, 4.5)}${twinkle(158, 94, 3, C.gold)}${twinkle(194, 104, 3.5)}${twinkle(132, 110, 2.5)}${twinkle(164, 50, 2.5, C.gold)}
         <path d="M120 150V128Q146 112 168 126Q186 116 204 124V150Z" fill="#3D6E5E"/><path d="M120 150V138Q160 128 204 140V150Z" fill="#4C8A70"/>`
      : `<rect x="110" y="30" width="104" height="120" fill="url(#${sky})"/>
         ${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M${f(184 + 15 * Math.cos(a * Math.PI / 180))} ${f(64 + 15 * Math.sin(a * Math.PI / 180))}L${f(184 + 20 * Math.cos(a * Math.PI / 180))} ${f(64 + 20 * Math.sin(a * Math.PI / 180))}" stroke="${C.gold}" stroke-width="3" stroke-linecap="round"/>`).join('')}
         <circle cx="184" cy="64" r="11" fill="${C.gold}" ${T}/>${cloudShape(144, 98, 0.62)}${twinkle(132, 62, 3.5)}
         <path d="M120 150V128Q146 112 168 126Q186 116 204 124V150Z" fill="#A8E6A0"/><path d="M120 150V138Q160 128 204 140V150Z" fill="#8FDE96"/>
         ${[[138, 136, C.pink], [176, 134, C.gold], [192, 140, C.lilac]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${c}"/>`).join('')}`;
    const windowArt = `<path d="M112 152V82A50 50 0 0 1 212 82V152Z" fill="${C.wood}" ${O}/>
      <clipPath id="${win}"><path d="${glass}"/></clipPath><g clip-path="url(#${win})">${view}</g><path d="${glass}" fill="none" ${T}/>
      ${bar('M162 40V146M120 102H204', C.wood, 4, 2.5)}
      ${hl('M118 96Q118 54 152 42', 2.5)}
      <rect x="104" y="144" width="116" height="10" rx="4" fill="${C.woodD}" ${O}/>
      <path d="M116 154H208L204 172H120Z" fill="${C.pink}" ${O}/>${heart(162, 163, 4.2, '#fff')}
      ${[[124, 152, C.rose], [136, 150, C.gold], [188, 150, C.lilac], [200, 152, C.rose]].map(([x, y, c]) => `<path d="M${x} ${y + 3}V${y - 3}" stroke="${C.leaf}" stroke-width="2.5"/>${[0, 72, 144, 216, 288].map(a => `<circle cx="${f(x + 3.6 * Math.cos(a * Math.PI / 180))}" cy="${f(y - 5 + 3.6 * Math.sin(a * Math.PI / 180))}" r="2.8" fill="${c}" ${sw(1.2)}/>`).join('')}<circle cx="${x}" cy="${y - 5}" r="1.8" fill="${C.cream}"/>`).join('')}`;
    // the floor: planks, a shadow under the wall, straw scattered, the soft straw bed in the middle
    const q = { bl: [0, 194], br: [400, 194], fl: [-170, 300], fr: [570, 300] };
    const floor = planks(q, '#E3B07A', '#C78E58') + `<rect y="193" width="400" height="34" fill="url(#${fsh})"/>` + straw(10, 204, 380, 90, 46, 7, [C.hayD, '#F6D58A']);
    const mound = [[200, 266, 118, 22], [142, 258, 52, 14], [258, 258, 52, 14], [200, 254, 74, 14]];
    const bed = `<ellipse cx="200" cy="274" rx="124" ry="16" fill="${INK}" opacity=".12"/>`
      + straw(76, 246, 248, 34, 30, 3, [C.hayD], 2.5)
      + blob(mound, C.hay, 3)
      + `<ellipse cx="200" cy="260" rx="84" ry="10" fill="${C.hayL}" opacity=".7"/>`
      + straw(96, 248, 208, 28, 46, 11, [C.hayD, C.hayL, '#F2BE52'])
      + hl('M128 250Q160 242 196 244', 2.5);
    // left: the lantern on its chain, and the hay bales
    const hay = bale(14, 166, 80, 44, 21) + bale(2, 208, 104, 56, 5) + straw(0, 258, 120, 12, 12, 17, [C.hayD, C.hay], 2.5)
      + `<path d="M6 264Q20 252 34 264Q48 254 62 264Z" fill="${C.hay}" ${T}/>`;
    // right: the hook with its horseshoe, the bunting, the water trough
    const hook = `<circle cx="344" cy="52" r="5" fill="${C.woodD}" ${T}/>` + horseshoe(344, 62, 1.15) + bar('M344 52V64Q344 70 350 69', C.gold, 3.5, 2.5) + twinkle(372, 66, 6, '#fff') + twinkle(318, 98, 4, C.gold);
    const flags = [C.pink, C.mint, C.gold, C.lilac, C.sky, C.rose, C.mint];
    const bunt = `<path d="M228 16Q314 44 404 16" fill="none" stroke="${INK}" stroke-width="2"/>` + flags.map((c, i) => { const t = (i + 0.5) / flags.length, x = 228 + 176 * t, y = 16 + 2 * t * (1 - t) * 28;
      return `<path d="M${f(x - 9)} ${f(y)}L${f(x + 9)} ${f(y)}L${f(x)} ${f(y + 17)}Z" fill="${c}" ${sw(2)}/>`; }).join('');
    const trough = `${shadow(347, 270, 54)}<path d="M312 254V272M382 254V272" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M312 254V272M382 254V272" stroke="${C.woodD}" stroke-width="6" stroke-linecap="round"/>
      <rect x="298" y="206" width="98" height="14" rx="6" fill="${C.woodD}" ${O}/>
      <ellipse cx="347" cy="215" rx="44" ry="5.5" fill="${C.water}"/><path d="M318 214Q328 211 338 214M352 216Q362 213 372 216" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      <path d="M296 214H398L392 258H302Z" fill="${C.wood}" ${O}/><path d="M300 236H395" stroke="${C.woodD}" stroke-width="2"/>
      ${[316, 378].map(x => `<path d="M${x} 216V256" stroke="${INK}" stroke-width="9"/><path d="M${x} 216V256" stroke="${C.lilac}" stroke-width="5"/>`).join('')}
      ${heart(347, 236, 6, C.pink, T)}${hl('M304 222H338', 2.5)}`;
    const lamp = `<path d="M52 12V40" stroke="${INK}" stroke-width="2.5" stroke-dasharray="4 3"/>` + lantern(52, 40, 1, lit);
    const body = `<defs><clipPath id="${clip}"><rect width="400" height="300" rx="18"/></clipPath>
      <linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1">${night ? `<stop offset="0" stop-color="#1F2257"/><stop offset="1" stop-color="#4A4A9C"/>` : `<stop offset="0" stop-color="#9FD8FF"/><stop offset="1" stop-color="#E4F5FF"/>`}</linearGradient>
      <linearGradient id="${fsh}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${INK}" stop-opacity=".16"/><stop offset="1" stop-color="${INK}" stop-opacity="0"/></linearGradient>
      <radialGradient id="${glow}" cx="52" cy="66" r="220" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFE29A" stop-opacity="${night ? 0.62 : 0.4}"/><stop offset=".45" stop-color="#FFC94A" stop-opacity="${night ? 0.26 : 0.16}"/><stop offset="1" stop-color="#FFC94A" stop-opacity="0"/></radialGradient></defs>
      <g clip-path="url(#${clip})">${wall}${windowArt}${floor}
      <rect x="-4" y="190" width="408" height="6" fill="${C.woodD}" ${T}/>
      ${bed}${hay}${hook}${bunt}${trough}
      <rect x="-4" y="-4" width="408" height="18" fill="${C.woodD}" ${O}/><path d="M0 8H400" stroke="#DDA574" stroke-width="2.5"/>
      ${night ? `<rect width="400" height="300" fill="${NIGHT}" opacity="${lit ? 0.3 : 0.4}"/>` : ''}
      ${lit ? `<rect width="400" height="300" fill="url(#${glow})"/>` : ''}
      ${lamp}</g>
      <rect x="1.5" y="1.5" width="397" height="297" rx="17" fill="none" ${O}/>`;
    return svg('0 0 400 300', body, opt.label || (night ? 'The stable at night' : 'The stable'), 'class="stable"');
  }

  // ---- props for the tray ----
  const PROPS = { food: ['oats', 'apple', 'carrot', 'sugar', 'clover'], care: ['sponge', 'brush', 'bucket', 'towel'], toys: ['ball', 'bubbles', 'ribbon', 'kite'], light: ['lantern'] };
  const NAMES = { oats: 'A bucket of oats', apple: 'An apple', carrot: 'A carrot', sugar: 'Sugar cubes', clover: 'Clover', sponge: 'A sponge', brush: 'A mane brush', bucket: 'A bucket of water', towel: 'A fluffy towel',
    ball: 'A ball', bubbles: 'Bubbles', ribbon: 'A ribbon wand', kite: 'A kite', lantern: 'A lantern' };
  const bub = (x, y, r) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#EAF7FF" fill-opacity=".55" stroke="${INK}" stroke-width="1.6" stroke-opacity=".7"/><path d="M${f(x - r * 0.55)} ${f(y - r * 0.1)}A${f(r * 0.6)} ${f(r * 0.6)} 0 0 1 ${f(x - r * 0.05)} ${f(y - r * 0.6)}" fill="none" stroke="#fff" stroke-width="${f(Math.max(1.4, r * 0.22))}" stroke-linecap="round"/>`;
  const clover3 = (x, y, s, rot = 0) => `<g transform="rotate(${rot} ${x} ${y})">${[0, 120, 240].map(a => `<g transform="rotate(${a} ${x} ${y})">${heart(x, y - 7.2 * s, 6.4 * s, C.leaf, T).replace('<path', `<path transform="rotate(180 ${x} ${f(y - 7.2 * s)})"`)}</g>`).join('')}<circle cx="${x}" cy="${y}" r="${f(1.8 * s)}" fill="#4FB57A"/></g>`;
  const PROP = {
    oats: () => `${shadow(50, 90, 32)}${bar('M22 46C22 12 78 12 78 46', C.lilac, 4)}
      ${blob([[50, 44, 28, 12], [38, 38, 12], [56, 36, 13], [66, 42, 10]], '#F3DDA6')}
      ${[[34, 36, 20], [46, 30, -30], [58, 34, 40], [66, 40, -10], [42, 44, 60], [54, 44, -50], [28, 44, 10], [72, 46, 30], [50, 38, 0]].map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="2.4" transform="rotate(${a} ${x} ${y})" fill="#FFF6DA" ${sw(1.2)}/>`).join('')}
      <path d="M18 46H82L74 88H26Z" fill="${C.wood}" ${O}/>
      <path d="M38 48L36 86M62 48L64 86" stroke="${C.woodD}" stroke-width="2"/>
      ${bar('M20 56H80M25 78H75', C.lilac, 4)}${hl('M28 64V74', 3)}${twinkle(86, 20, 6, C.gold)}`,
    apple: () => `${shadow(50, 91, 30)}<path d="M50 30C32 16 12 30 15 54C18 78 36 94 50 86C64 94 82 78 85 54C88 30 68 16 50 30Z" fill="${C.apple}" ${O}/>
      ${bar('M50 30C50 22 52 16 56 12', '#A86B45', 4)}<path d="M55 20C62 8 78 10 80 14C74 24 62 24 55 20Z" fill="${C.leaf}" ${O}/><path d="M58 19Q68 15 76 15" fill="none" stroke="#4FB57A" stroke-width="1.8" stroke-linecap="round"/>
      ${hl('M26 46Q28 34 38 30', 4)}<ellipse cx="34" cy="62" rx="5" ry="3" fill="#fff" opacity=".35"/>${twinkle(84, 30, 6, C.gold)}`,
    carrot: () => `${shadow(46, 91, 26)}<g transform="rotate(38 50 50)">
      <path d="M50 28C40 14 34 8 32 2C42 6 48 14 50 24C52 12 58 4 66 2C62 10 56 18 52 28Z" fill="${C.leaf}" ${T}/><path d="M50 26C48 14 50 6 50 0" stroke="${C.leaf}" stroke-width="5" stroke-linecap="round"/><path d="M50 26C48 14 50 6 50 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".0"/>
      <path d="M36 32Q50 22 64 32Q62 64 50 98Q38 64 36 32Z" fill="#FFA24C" ${O}/>
      <path d="M40 44H48M54 56H61M42 66H48M52 78H57" stroke="#E07A2A" stroke-width="2.4" stroke-linecap="round"/>${hl('M42 34Q44 52 47 68', 3)}</g>${twinkle(84, 22, 6, C.gold)}`,
    sugar: () => { const cube = (x, y, s) => { const P = (u, v) => `${f(x + u * s)} ${f(y + v * s)}`;
        return `<path d="M${P(0, -10)}L${P(14, -3)}L${P(0, 4)}L${P(-14, -3)}Z" fill="#fff" ${T}/><path d="M${P(-14, -3)}L${P(0, 4)}V${P(0, 22).split(' ')[1]}L${P(-14, 15)}Z" fill="#F1ECFF" ${T}/><path d="M${P(14, -3)}L${P(0, 4)}V${P(0, 22).split(' ')[1]}L${P(14, 15)}Z" fill="${C.lav}" ${T}/>`
          + [[-8, 6], [-5, 12], [6, 8], [9, 14], [-2, -4], [4, -2]].map(([u, v]) => `<circle cx="${f(x + u * s)}" cy="${f(y + v * s)}" r="${f(0.9 * s)}" fill="${C.lilac}" opacity=".6"/>`).join(''); };
      return `${shadow(50, 88, 36)}${cube(32, 62, 1.25)}${cube(68, 62, 1.25)}${cube(50, 38, 1.25)}${twinkle(80, 22, 7, C.gold)}${twinkle(20, 30, 5, C.sky)}${twinkle(86, 46, 4, '#fff')}`; },
    clover: () => `${shadow(50, 92, 22)}${bar('M50 90Q46 70 30 46M50 90Q50 64 50 36M50 90Q56 70 72 50', C.leaf, 3.5, 2.5)}
      ${clover3(28, 40, 1.15, -20)}${clover3(72, 46, 1.1, 20)}
      <path d="M50 36" />${[[-7, -2], [7, -2], [-5, -10], [5, -10], [0, -16], [0, -5], [-9, -9], [9, -9]].map(([u, v]) => `<ellipse cx="${50 + u}" cy="${28 + v}" rx="4.2" ry="6" transform="rotate(${u * 4} ${50 + u} ${28 + v})" fill="${u ? C.pink : C.blush}" ${sw(1.6)}/>`).join('')}
      <path d="M44 84Q50 78 56 84" fill="none"/><path d="M50 80C38 72 34 84 42 86C46 86 50 82 50 80C50 82 54 86 58 86C66 84 62 72 50 80Z" fill="${C.rose}" ${T}/><circle cx="50" cy="81" r="3" fill="${C.rose}" ${T}/>${twinkle(86, 20, 5, C.gold)}`,
    sponge: () => `${shadow(46, 88, 32)}<g transform="rotate(-12 46 62)"><rect x="14" y="44" width="64" height="38" rx="12" fill="${C.pink}" ${O}/><path d="M18 58H74" stroke="${C.rose}" stroke-width="2" opacity=".5"/>
      ${[[26, 54, 3.2], [40, 64, 2.6], [56, 54, 3.4], [66, 70, 2.8], [30, 72, 2.4], [50, 74, 2]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${f(r * 0.8)}" fill="${C.rose}" opacity=".7"/>`).join('')}${hl('M22 50H52', 3)}</g>
      ${blob([[30, 40, 9], [42, 36, 10], [54, 40, 8], [22, 46, 6]], '#fff', 2.5, C.lav)}${bub(72, 26, 10)}${bub(86, 46, 6)}${bub(62, 12, 5)}`,
    brush: () => `${shadow(50, 90, 30)}<g transform="rotate(-35 50 50)">${bar('M50 60V94', C.pink, 12)}${heart(50, 80, 4, '#fff')}
      <ellipse cx="50" cy="36" rx="25" ry="31" fill="${C.pink}" ${O}/><ellipse cx="50" cy="36" rx="18" ry="24" fill="#fff" ${T}/>
      ${[[-9, -14], [0, -16], [9, -14], [-12, -4], [-4, -6], [4, -6], [12, -4], [-12, 6], [-4, 4], [4, 4], [12, 6], [-8, 14], [0, 15], [8, 14]].map(([u, v]) => `<circle cx="${50 + u}" cy="${36 + v}" r="2.6" fill="${C.lilac}" ${sw(1.1)}/>`).join('')}
      ${hl('M32 24Q36 12 46 8', 3)}</g>${twinkle(84, 74, 6, C.gold)}`,
    bucket: () => `${shadow(50, 90, 32)}${bar('M20 40C20 8 80 8 80 40', '#A9B4E8', 4)}
      <ellipse cx="50" cy="40" rx="31" ry="8" fill="#B8C7F5" ${O}/><ellipse cx="50" cy="41" rx="26" ry="5.5" fill="${C.water}"/><path d="M36 41Q44 38 52 41" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      <path d="M19 40Q24 60 28 86H72Q76 60 81 40Q66 50 50 50Q34 50 19 40Z" fill="${C.sky}" ${O}/>
      ${bar('M24 62Q50 70 76 62', '#fff', 3.5, 2.5)}${hl('M28 54L32 78', 3)}
      <path d="M62 30C56 22 58 16 62 10C66 16 68 22 62 30Z" fill="${C.water}" ${T}/><path d="M40 26C36 21 37 17 40 13C43 17 44 21 40 26Z" fill="${C.water}" ${T}/>${twinkle(84, 20, 5, '#fff')}`,
    towel: () => `${shadow(50, 88, 38)}<rect x="14" y="58" width="72" height="26" rx="9" fill="${C.mint}" ${O}/><path d="M18 70H82" stroke="#fff" stroke-width="3" stroke-dasharray="1 6" stroke-linecap="round"/>
      <path d="M18 28H82Q90 28 90 38V44Q90 54 80 54H20Q10 54 10 44V38Q10 28 18 28Z" fill="${C.pink}" ${O}/>
      <path d="M10 48Q30 58 90 48V54Q90 62 80 62H20Q10 62 10 54Z" fill="${C.blush}" ${O}/>
      ${bar('M28 28V62', '#fff', 4, 2)}${bar('M38 28V62', C.lilac, 3, 2)}${hl('M18 34H50', 3)}
      ${[[16, 28], [30, 27], [46, 27], [62, 27], [78, 28]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#fff"/>`).join('')}${heart(68, 44, 5, '#fff')}${twinkle(86, 16, 6, C.gold)}`,
    ball: () => { const cl = uid('ball');
      return `${shadow(50, 90, 30)}<defs><clipPath id="${cl}"><circle cx="50" cy="50" r="36"/></clipPath></defs><circle cx="50" cy="50" r="36" fill="#fff"/>
      <g clip-path="url(#${cl})"><path d="M14 30Q50 10 86 30V14H14Z" fill="${C.pink}"/><path d="M14 46Q50 26 86 46V36Q50 16 14 36Z" fill="${C.gold}"/><path d="M14 64Q50 44 86 64V54Q50 34 14 54Z" fill="${C.sky}"/><path d="M14 82Q50 62 86 82V96H14Z" fill="${C.mint}"/>
      <path d="M14 30Q50 10 86 30M14 36Q50 16 86 36M14 46Q50 26 86 46M14 54Q50 34 86 54M14 64Q50 44 86 64M14 82Q50 62 86 82" fill="none" stroke="${INK}" stroke-width="1.6" opacity=".5"/></g>
      <circle cx="50" cy="50" r="36" fill="none" ${O}/>${hl('M24 40Q28 26 40 20', 4)}${star(66, 68, 5, '#fff')}${twinkle(88, 16, 6, C.gold)}`; },
    bubbles: () => `${bar('M20 92L44 50', C.lilac, 6)}<circle cx="52" cy="36" r="15" fill="#EAF7FF" fill-opacity=".6"/><circle cx="52" cy="36" r="15" fill="none" stroke="${INK}" stroke-width="9"/><circle cx="52" cy="36" r="15" fill="none" stroke="${C.pink}" stroke-width="5"/>
      ${bub(80, 22, 11)}${bub(80, 54, 7)}${bub(64, 70, 5)}${bub(30, 18, 6)}${twinkle(90, 82, 5, C.gold)}${star(20, 92, 5, C.gold, T)}`,
    ribbon: () => `${bar('M70 72C92 52 92 22 70 18C50 14 36 34 50 46C62 56 80 44 74 32C70 24 58 26 58 34', C.rose, 7)}
      ${bar('M18 92L40 46', C.lilac, 6)}${star(41, 43, 9, C.gold, T)}${bar('M70 72C66 80 60 86 52 88', C.rose, 7)}<path d="M70 72C66 80 60 86 52 88" fill="none" stroke="${C.pink}" stroke-width="2" stroke-linecap="round"/>
      <path d="M78 24C86 30 86 44 78 54" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>${twinkle(90, 76, 6, C.gold)}${twinkle(20, 30, 5, C.pink)}`,
    kite: () => `<path d="M52 72C60 80 52 86 62 90C70 94 74 90 84 96" fill="none" stroke="${INK}" stroke-width="2"/>
      ${[[58, 82, -30], [72, 92, 10]].map(([x, y, a]) => `<g transform="rotate(${a} ${x} ${y})"><path d="M${x} ${y}l-7 -5v10Z M${x} ${y}l7 -5v10Z" fill="${C.pink}" ${sw(1.6)}/></g>`).join('')}
      <path d="M50 6L78 38L50 74L22 38Z" fill="${C.pink}" ${O}/><path d="M50 6L78 38H50Z" fill="${C.gold}"/><path d="M50 74L22 38H50Z" fill="${C.sky}"/><path d="M50 6L22 38H50Z" fill="${C.lilac}"/><path d="M50 74L78 38H50Z" fill="${C.mint}"/>
      <path d="M50 6L78 38L50 74L22 38Z" fill="none" ${O}/><path d="M50 8V72M24 38H76" stroke="${INK}" stroke-width="2.5"/>${heart(50, 39, 4.5, '#fff')}${hl('M30 34L46 16', 3)}${twinkle(84, 14, 6, C.gold)}`,
    lantern: o => `${shadow(50, 92, 22)}${lantern(50, 6, 1.6, !!o.on)}${o.on ? twinkle(82, 22, 6, C.gold) + twinkle(18, 60, 4, '#fff') : ''}`,
  };
  function prop(id, opt = {}) {
    const p = PROP[id]; if (!p) return '';
    return svg('0 0 100 100', p(opt), opt.label || NAMES[id], 'class="prop"');
  }

  // ---- the needs' little icons ----
  const NEED = {
    food: ['#FFE0EA', () => `<path d="M20 16C13 10 6 15 7.5 23C9 31 15 35 20 32C25 35 31 31 32.5 23C34 15 27 10 20 16Z" fill="${C.apple}" ${H}/>${bar('M20 16Q20 11 22.5 8.5', '#A86B45', 1.8, 1.4)}<path d="M22 12C25 6 31 7 32 9C29 13 25 13 22 12Z" fill="${C.leaf}" ${sw(1.2)}/>${hl('M11 21Q12 16 16 15', 1.8)}`],
    clean: ['#DDF1FF', () => `<path d="M17 7C17 7 7 18 7 25C7 31 11.5 34 17 34C22.5 34 27 31 27 25C27 18 17 7 17 7Z" fill="${C.sky}" ${H}/>${hl('M12 24Q12 19 15 16', 2)}${bub(28.5, 14, 5.5)}${bub(30, 26, 3)}`],
    fun: ['#FFF0C2', () => { const cl = uid('nb'); return `<defs><clipPath id="${cl}"><circle cx="20" cy="20" r="12"/></clipPath></defs><circle cx="20" cy="20" r="12" fill="#fff"/><g clip-path="url(#${cl})"><path d="M8 15Q20 8 32 15V6H8Z" fill="${C.pink}"/><path d="M8 24Q20 17 32 24V19Q20 12 8 19Z" fill="${C.sky}"/><path d="M8 32Q20 25 32 32V36H8Z" fill="${C.mint}"/></g><circle cx="20" cy="20" r="12" fill="none" ${H}/>${hl('M12 17Q13 12 17 10', 1.8)}${twinkle(32, 8, 3.5, C.gold)}`; }],
    rest: ['#E6DCFF', () => `${moon(18, 21, 11, C.gold, H)}${star(29, 12, 4, '#fff', sw(1))}<circle cx="31" cy="25" r="1.4" fill="#fff"/>`],
  };
  function need(kind, size = 40) {
    const nd = NEED[kind]; if (!nd) return '';
    return svg('0 0 40 40', `<circle cx="20" cy="20" r="18" fill="${nd[0]}" ${T}/>${nd[1]()}`, '', `width="${size}" height="${size}" class="need"`);
  }

  // ---- a soap bubble ----
  function bubble(size = 40) {
    const g = uid('bub');
    return svg('0 0 40 40', `<defs><radialGradient id="${g}" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".7" stop-color="#E4F4FF" stop-opacity=".35"/><stop offset=".88" stop-color="#E6D6FF" stop-opacity=".7"/><stop offset="1" stop-color="#FFD6EE" stop-opacity=".85"/></radialGradient></defs>
      <circle cx="20" cy="20" r="17" fill="url(#${g})" stroke="${C.lilac}" stroke-width="1.6" stroke-opacity=".8"/>
      <path d="M9 17A12 12 0 0 1 17 9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="27" cy="29" r="2" fill="#fff" opacity=".8"/><path d="M30 12A12 12 0 0 1 32 18" fill="none" stroke="#FFE29A" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`, '', `width="${size}" height="${size}" class="bubble"`);
  }

  // ---- the castle, a cut-away dollhouse ----
  // each room's box (its walls and all) in the castle's 400 x 560 viewBox, and where its inside is drawn
  const CASTLE_ROOMS = [
    { id: 'bedroom', x: 104, y: 114, w: 104, h: 92 },
    { id: 'library', x: 30, y: 216, w: 126, h: 94 },
    { id: 'wardrobe', x: 156, y: 216, w: 126, h: 94 },
    { id: 'ballroom', x: 30, y: 310, w: 252, h: 96 },
    { id: 'kitchen', x: 30, y: 406, w: 252, h: 100 },
    { id: 'stable', x: 288, y: 362, w: 110, h: 148 },
  ];
  const INSIDE = { bedroom: [112, 122, 88, 80], library: [36, 222, 116, 84], wardrobe: [160, 222, 116, 84], ballroom: [36, 314, 240, 88], kitchen: [36, 410, 240, 90], stable: [298, 420, 84, 82] };
  // the rooms' insides, each in its own box from (0, 0)
  const sky2 = (night, x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${night ? '#2F3474' : '#C4E8FF'}"/>` + (night ? twinkle(x + w * 0.3, y + h * 0.35, 2.4) + twinkle(x + w * 0.7, y + h * 0.65, 1.8, C.gold) : `<circle cx="${x + w * 0.35}" cy="${y + h * 0.62}" r="${f(w * 0.16)}" fill="#fff"/><circle cx="${x + w * 0.55}" cy="${y + h * 0.58}" r="${f(w * 0.2)}" fill="#fff"/>`);
  const ROOM = {
    bedroom: (w, h, night) => `<rect width="${w}" height="${h}" fill="#E6DCFF"/>${[[50, 10], [78, 24], [62, 36], [8, 56], [44, 50]].map(([x, y], i) => i % 2 ? `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff"/>` : star(x, y, 3, C.gold)).join('')}
      <rect y="66" width="${w}" height="${h - 66}" fill="#F6D9B6"/><path d="M0 72H${w}" stroke="#E4B98C" stroke-width="1.2"/>
      <path d="M10 46V26A12 12 0 0 1 34 26V46Z" fill="${C.cream}" ${H}/>${`<clipPath id="BWIN"><path d="M13 44V26A9 9 0 0 1 31 26V44Z"/></clipPath>`}<g clip-path="url(#BWIN)">${sky2(night, 10, 14, 24, 32)}</g><path d="M22 17V44M13 32H31" stroke="${C.cream}" stroke-width="2"/>
      <path d="M6 14H18C16 28 14 38 16 46H6Z" fill="${C.pink}" ${sw(1.2)}/><path d="M38 14H26C28 28 30 38 28 46H38Z" fill="${C.pink}" ${sw(1.2)}/><rect x="4" y="12" width="36" height="3" rx="1.5" fill="${C.gold}" ${sw(1)}/>
      <ellipse cx="30" cy="73" rx="22" ry="4.5" fill="${C.lilac}" ${sw(1.2)}/><ellipse cx="30" cy="73" rx="13" ry="2.6" fill="${C.pink}"/>
      <path d="M72 70V36A8 8 0 0 1 88 36V70Z" fill="${C.pink}" ${H}/>${heart(80, 42, 3.4, '#fff')}
      <rect x="44" y="52" width="38" height="10" rx="4" fill="#fff" ${H}/><ellipse cx="74" cy="51" rx="7" ry="4" fill="#fff" ${H}/>
      <path d="M44 56H68Q70 56 70 58V66H46Q44 66 44 64Z" fill="${C.pink}" ${H}/>${heart(56, 61, 2.4, '#fff')}
      <path d="M40 72V50A4 4 0 0 1 48 50V72Z" fill="${C.pink}" ${H}/>`,
    library: (w, h, night) => `<rect width="${w}" height="${h}" fill="#FFF6E9"/>${Array.from({ length: 9 }, (_, i) => `<rect x="${i * 14}" width="7" height="${h}" fill="#C9F1E5"/>`).join('')}
      <rect y="70" width="${w}" height="${h - 70}" fill="${C.wood}"/><path d="M0 76H${w}M30 70V76M80 76V84" stroke="${C.woodD}" stroke-width="1.2"/>
      <rect x="6" y="8" width="46" height="66" rx="3" fill="${C.woodD}" ${H}/><rect x="10" y="12" width="38" height="58" fill="#B87A50"/>
      ${[26, 44, 62].map(y => `<rect x="8" y="${y}" width="42" height="3" fill="${C.wood}" ${sw(1)}/>`).join('')}
      ${[12, 30, 48].map((y, r) => Array.from({ length: 7 }, (_, i) => { const hh = 11 + ((i * 5 + r * 3) % 4), c = [C.rose, C.sky, C.gold, C.mint, C.lilac, C.coral, C.pink][(i + r * 2) % 7];
        return `<rect x="${11 + i * 5.2}" y="${y + 14 - hh}" width="4.4" height="${hh}" rx="1" fill="${c}" ${sw(0.8)}/>`; }).join('')).join('')}
      <circle cx="80" cy="24" r="13" fill="${C.cream}" ${H}/><clipPath id="LWIN"><circle cx="80" cy="24" r="10"/></clipPath><g clip-path="url(#LWIN)">${sky2(night, 70, 14, 20, 20)}</g><path d="M80 14V34M70 24H90" stroke="${C.cream}" stroke-width="2"/>
      <ellipse cx="86" cy="78" rx="24" ry="4" fill="${C.mint}" ${sw(1.2)}/>
      <rect x="68" y="42" width="36" height="26" rx="8" fill="${C.pink}" ${H}/>${heart(86, 52, 3, '#fff')}
      <rect x="70" y="60" width="32" height="10" rx="3" fill="${C.blush}" ${H}/>
      <rect x="62" y="54" width="10" height="20" rx="4" fill="${C.pink}" ${H}/><rect x="100" y="54" width="10" height="20" rx="4" fill="${C.pink}" ${H}/>
      <path d="M68 74V78M104 74V78" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
    wardrobe: (w, h, night) => `<rect width="${w}" height="${h}" fill="#FFD4E9"/>${[[86, 12], [104, 30], [12, 68], [104, 58], [84, 40]].map(([x, y], i) => i % 2 ? `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff"/>` : heart(x, y, 2.6, '#fff')).join('')}
      <rect y="70" width="${w}" height="${h - 70}" fill="#F6D9B6"/><path d="M0 76H${w}" stroke="#E4B98C" stroke-width="1.2"/>
      <ellipse cx="42" cy="78" rx="30" ry="4" fill="${C.lav}" ${sw(1.2)}/>
      <path d="M4 14L12 16V70L4 72Z" fill="#CDB8FF" ${H}/><path d="M80 14L72 16V70L80 72Z" fill="#CDB8FF" ${H}/><circle cx="9" cy="44" r="1.6" fill="${C.gold}"/><circle cx="75" cy="44" r="1.6" fill="${C.gold}"/>
      <path d="M12 74V14Q12 4 42 4Q72 4 72 14V74Z" fill="${C.lilac}" ${H}/><rect x="16" y="14" width="52" height="54" rx="2" fill="#8E73D9"/>${heart(42, 9, 2.8, C.gold)}
      <path d="M17 20H67" stroke="${C.gold}" stroke-width="2" stroke-linecap="round"/>
      ${[[26, C.pink], [42, C.mint], [58, C.gold]].map(([x, c]) => `<path d="M${x} 20v3" stroke="#fff" stroke-width="1.2"/><path d="M${x - 4} 24H${x + 4}L${x + 3} 34L${x + 8} 62H${x - 8}L${x - 3} 34Z" fill="${c}" ${sw(1.1)}/><path d="M${x - 7} 56H${x + 7}" stroke="#fff" stroke-width="1.4" opacity=".8"/>`).join('')}
      <rect x="12" y="68" width="60" height="6" rx="2" fill="${C.lilac}" ${sw(1.2)}/>
      <path d="M92 74L96 64L100 74" fill="none" stroke="${C.gold}" stroke-width="2.4" stroke-linecap="round"/>
      <ellipse cx="96" cy="38" rx="13" ry="23" fill="${C.gold}" ${H}/><ellipse cx="96" cy="38" rx="9" ry="18.5" fill="#CFEAFF"/><path d="M91 30Q92 24 96 22" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>${twinkle(100, 46, 2.6)}
      ${heart(96, 13, 3.2, C.rose, sw(1))}`,
    ballroom: (w, h, night) => { const pat = uid('lat'), q = { bl: [0, 64], br: [w, 64], fl: [-70, h], fr: [w + 70, h] };
      return `<defs><pattern id="${pat}" patternUnits="userSpaceOnUse" width="18" height="18"><rect width="18" height="18" fill="#FFF1D4"/><path d="M9 0L18 9L9 18L0 9Z" fill="none" stroke="#F2C35A" stroke-width="1.1"/><circle cx="9" cy="9" r="1.4" fill="${C.gold}"/></pattern></defs>
      <rect width="${w}" height="${h}" fill="url(#${pat})"/>
      ${checks(q, 14, 3, '#FFF6E9', '#D9CCFF')}<rect y="61" width="${w}" height="4" fill="${C.gold}" ${sw(1.2)}/>
      ${[[40, 70], [120, 76], [196, 72], [80, 82], [164, 84]].map(([x, y], i) => `<path d="M${x - 8} ${y + 4}L${x + 6} ${y - 4}" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>${i % 2 ? '' : twinkle(x + 10, y, 3)}`).join('')}
      ${[16, 194].map(x => `<path d="M${x} 60V24A15 15 0 0 1 ${x + 30} 24V60Z" fill="${C.gold}" ${H}/><path d="M${x + 4} 60V25A11 11 0 0 1 ${x + 26} 25V60Z" fill="${night ? '#2F3474' : '#E9DDFF'}"/>${night ? twinkle(x + 12, 30, 2.4) + twinkle(x + 20, 44, 1.8, C.gold) : `<circle cx="${x + 18}" cy="30" r="5" fill="#fff" opacity=".8"/>`}<path d="M${x + 15} 13V60M${x + 4} 38H${x + 26}" stroke="${C.gold}" stroke-width="1.8"/>
        <path d="M${x - 6} 8H${x + 8}C${x + 6} 30 ${x + 4} 48 ${x + 6} 62H${x - 6}Z" fill="${C.rose}" ${sw(1.2)}/><path d="M${x + 36} 8H${x + 22}C${x + 24} 30 ${x + 26} 48 ${x + 24} 62H${x + 36}Z" fill="${C.rose}" ${sw(1.2)}/>`).join('')}
      <path d="M120 0V14" stroke="${INK}" stroke-width="1.6"/>
      <path d="M92 20Q94 32 120 32Q146 32 148 20M104 18Q106 28 120 28Q134 28 136 18" fill="none" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/><path d="M92 20Q94 32 120 32Q146 32 148 20M104 18Q106 28 120 28Q134 28 136 18" fill="none" stroke="${C.gold}" stroke-width="2.4" stroke-linecap="round"/>
      <ellipse cx="120" cy="22" rx="7" ry="9" fill="${C.gold}" ${H}/>
      ${[92, 104, 136, 148].map(x => `<rect x="${x - 2.4}" y="${x === 92 || x === 148 ? 12 : 10}" width="4.8" height="8" rx="1" fill="${C.cream}" ${sw(1)}/><path d="M${x} ${x === 92 || x === 148 ? 11 : 9}c2 -2 1 -5 0 -6c-1 1 -2 4 0 6Z" fill="#FF9F43"/>`).join('')}
      ${[[98, 34], [112, 38], [128, 38], [142, 34], [120, 40]].map(([x, y]) => `<path d="M${x} ${y - 4}V${y - 1}" stroke="${INK}" stroke-width=".9"/><path d="M${x} ${y - 1}l2.4 3.6l-2.4 3.6l-2.4 -3.6Z" fill="${C.sky}" ${sw(0.9)}/>`).join('')}
      ${twinkle(84, 30, 3.2)}${twinkle(156, 28, 3.2, C.gold)}${twinkle(120, 50, 2.6)}`; },
    kitchen: (w, h, night) => `<rect width="${w}" height="${h}" fill="${C.cream}"/>
      ${Array.from({ length: 24 }, (_, i) => Array.from({ length: 4 }, (_, j) => `<rect x="${i * 10}" y="${34 + j * 10}" width="10" height="10" fill="${(i + j) % 2 ? '#DDF5EC' : '#C9F1E5'}"/>`).join('')).join('')}
      <path d="M0 34H${w}" stroke="${C.mint}" stroke-width="2"/>
      ${checks({ bl: [0, 76], br: [w, 76], fl: [-40, h], fr: [w + 40, h] }, 20, 2, '#fff', '#FFD4E9')}
      <path d="M8 10H64L60 0H12Z" fill="${C.mint}" ${H}/>
      <rect x="10" y="34" width="52" height="44" rx="5" fill="${C.pink}" ${H}/><rect x="8" y="30" width="56" height="6" rx="2" fill="${C.berry}" ${sw(1.2)}/>
      ${[20, 30, 42, 52].map(x => `<circle cx="${x}" cy="41" r="2" fill="#fff" ${sw(0.9)}/>`).join('')}
      <rect x="17" y="48" width="38" height="24" rx="4" fill="${night ? '#FFD36B' : '#FFE9A6'}" ${H}/><path d="M22 52H50" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/><rect x="24" y="45" width="24" height="3" rx="1.5" fill="${C.cream}" ${sw(1)}/>
      <path d="M22 30V20H44V30Z" fill="${C.mint}" ${H}/><rect x="20" y="18" width="26" height="4" rx="2" fill="${C.teal}" ${sw(1)}/><circle cx="33" cy="16" r="2" fill="${C.teal}" ${sw(1)}/>
      <path d="M28 12Q24 8 28 4M38 12Q42 8 38 4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M28 12Q24 8 28 4M38 12Q42 8 38 4" fill="none" stroke="${C.lilac}" stroke-width="1" stroke-linecap="round" opacity=".6"/>
      <rect x="92" y="58" width="80" height="6" rx="2" fill="${C.wood}" ${H}/><path d="M92 64H172V68Q166 72 160 68Q154 72 148 68Q142 72 136 68Q130 72 124 68Q118 72 112 68Q106 72 100 68Q94 72 92 68Z" fill="${C.blush}" ${sw(1.2)}/>
      <path d="M100 68V82M164 68V82" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M100 68V82M164 68V82" stroke="${C.wood}" stroke-width="2.4" stroke-linecap="round"/>
      <ellipse cx="132" cy="57" rx="24" ry="3" fill="#fff" ${sw(1.2)}/>
      <rect x="114" y="42" width="36" height="14" rx="3" fill="${C.pink}" ${H}/><rect x="120" y="30" width="24" height="13" rx="3" fill="${C.cream}" ${H}/>
      <path d="M120 34Q123 38 126 34Q129 38 132 34Q135 38 138 34Q141 38 144 34" fill="none" stroke="${C.pink}" stroke-width="2.4" stroke-linecap="round"/><path d="M116 48H148" stroke="#fff" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round"/>
      <rect x="130.5" y="21" width="3" height="9" rx="1" fill="${C.sky}" ${sw(0.9)}/><path d="M132 20c2.4 -2 1.4 -6 0 -7c-1.4 1 -2.4 5 0 7Z" fill="#FF9F43"/>${twinkle(150, 24, 2.6, C.gold)}
      <path d="M184 12H236" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      ${[[194, 7, C.amber], [212, 9, C.gold], [228, 6, C.amber]].map(([x, r, c]) => `<path d="M${x} 12V16" stroke="${INK}" stroke-width="1.2"/><path d="M${x - r} 17H${x + r}Q${x + r} ${17 + r * 1.3} ${x} ${17 + r * 1.3}Q${x - r} ${17 + r * 1.3} ${x - r} 17Z" fill="${c}" ${sw(1.2)}/><path d="M${x - r * 0.5} 20Q${x - r * 0.4} ${17 + r} ${x} ${17 + r * 1.1}" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`).join('')}
      <rect x="182" y="52" width="54" height="4" rx="1.5" fill="${C.wood}" ${sw(1.2)}/>
      ${[[190, C.pink], [204, C.lilac], [218, C.mint], [230, C.gold]].map(([x, c], i) => `<rect x="${x - 5}" y="${40 + (i % 2) * 2}" width="10" height="${12 - (i % 2) * 2}" rx="3" fill="${c}" ${sw(1.1)}/><rect x="${x - 4}" y="${37 + (i % 2) * 2}" width="8" height="3" rx="1" fill="#fff" ${sw(0.9)}/>`).join('')}`,
    stable: (w, h, night) => `<rect width="${w}" height="${h}" fill="#F2C690"/>${Array.from({ length: 7 }, (_, i) => `${i % 2 ? `<rect x="${i * 12}" width="12" height="${h}" fill="#EBBA80"/>` : ''}<path d="M${i * 12} 0V${h}" stroke="#CF9A63" stroke-width="1"/>`).join('')}
      <path d="M48 70V24H78V70" fill="#3E2A66" ${H}/><g>${sky2(night, 51, 27, 24, 20)}</g>
      <rect x="50" y="47" width="26" height="23" fill="${C.wood}" ${sw(1.2)}/><path d="M50 47L76 70M76 47L50 70" stroke="${C.woodD}" stroke-width="2.4"/><rect x="50" y="47" width="26" height="23" fill="none" ${sw(1.2)}/>
      <path d="M76 24L83 21V44L76 47Z" fill="${C.woodL}" ${sw(1.2)}/><path d="M46 24H80" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M46 24H80" stroke="${C.woodD}" stroke-width="2.6" stroke-linecap="round"/>
      ${horseshoe(63, 8, 0.36, 1.4)}
      <rect y="68" width="${w}" height="${h - 68}" fill="${C.hay}"/>${straw(2, 70, w - 4, h - 72, 18, 5, [C.hayD, C.hayL], 1.4)}
      ${bale(4, 50, 34, 20, 9, 1.4)}<path d="M2 70Q12 64 22 70Q30 66 40 70Z" fill="${C.hay}" ${sw(1.2)}/>
      <path d="M18 0V10" stroke="${INK}" stroke-width="1.2" stroke-dasharray="2 2"/>${lantern(18, 10, 0.5, night, 1.4)}`,
  };

  function castle(opt = {}) {
    const night = !!opt.night;
    const sky = uid('csky'), shine = uid('cin');
    const clipIds = {};
    // the sky, clouds or stars, faraway hills
    let s = `<defs><linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1">${night
      ? '<stop offset="0" stop-color="#1F2257"/><stop offset=".6" stop-color="#3A3F8F"/><stop offset="1" stop-color="#6A5AA8"/>'
      : '<stop offset="0" stop-color="#FFD9EE"/><stop offset=".45" stop-color="#E6DBFF"/><stop offset="1" stop-color="#CBEBFF"/>'}</linearGradient>
      <linearGradient id="${shine}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${INK}" stop-opacity=".18"/><stop offset="1" stop-color="${INK}" stop-opacity="0"/></linearGradient>`;
    for (const r of CASTLE_ROOMS) { const [, , w, h] = INSIDE[r.id], id = uid('cr'); clipIds[r.id] = id; s += `<clipPath id="${id}"><rect width="${w}" height="${h}"/></clipPath>`; }
    s += `</defs><rect width="400" height="560" fill="url(#${sky})"/>`;
    if (night) s += `${moon(50, 56, 22, '#FFF3D1')}` + [[110, 30], [350, 40], [330, 120], [26, 140], [372, 210], [240, 24], [92, 96], [380, 300], [14, 260], [300, 80]].map(([x, y], i) => `<g class="tw" style="animation-delay:${(i % 5) * 0.4}s">${twinkle(x, y, i % 3 ? 4 : 7, i % 2 ? C.gold : '#fff')}</g>`).join('');
    else s += cloudShape(44, 62, 1, '#fff', 'opacity=".95"') + cloudShape(340, 108, 0.85, '#fff', 'opacity=".95"') + cloudShape(370, 250, 0.6, '#fff', 'opacity=".9"') + twinkle(300, 40, 7) + twinkle(30, 170, 6, C.gold) + twinkle(250, 14, 5);
    s += `<path d="M-10 500C40 450 110 470 150 488C210 452 300 450 410 478V560H-10Z" fill="${night ? '#5B5196' : '#D2C4F7'}" opacity=".8"/>`;
    // towers in the map's colours: blush walls, lilac cone roofs, rose flags, sky (night: lit) windows
    const winC = night ? '#FFE58A' : C.sky;
    const flag = (x, y) => `<path d="M${x} ${y}V${y - 24}" stroke="${INK}" stroke-width="3"/><path d="M${x} ${y - 24}l20 6l-20 7Z" fill="${C.rose}" ${T}/>`;
    const turret = (cx) => `<rect x="${cx - 22}" y="150" width="44" height="70" fill="${C.blush}" ${O}/><path d="M${cx - 30} 150L${cx} 98L${cx + 30} 150Z" fill="${C.lilac}" ${O}/>${flag(cx, 98)}
      <rect x="${cx - 7}" y="166" width="14" height="22" rx="7" fill="${winC}" ${T}/>${hl(`M${cx - 14} 158V178`, 2.5)}`;
    s += turret(36) + turret(276);
    // battlements between the towers
    s += [62, 80, 214, 232].map(x => `<rect x="${x}" y="200" width="12" height="16" fill="${C.pink}" ${T}/>`).join('');
    // the barn on the right, at ground level
    s += `<path d="M282 418L340 366L398 418Z" fill="${C.lilac}" ${O}/><path d="M296 412L340 374L384 412" fill="none" stroke="${C.lav}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="340" cy="398" r="9" fill="${C.cream}" ${T}/>${heart(340, 398, 4.2, C.rose)}${star(340, 354, 8, C.gold, T)}
      <rect x="290" y="414" width="100" height="98" fill="${C.blush}" ${O}/>`;
    // the keep and the bedroom tower
    s += `<rect x="104" y="114" width="104" height="104" fill="${C.blush}" ${O}/><path d="M94 116L156 38L218 116Z" fill="${C.lilac}" ${O}/>${flag(156, 38)}${hl('M110 108L150 58', 3)}
      <circle cx="156" cy="84" r="9" fill="${winC}" ${T}/>${star(206, 30, 9, C.gold, T)}
      <rect x="26" y="214" width="260" height="298" fill="${C.pink}" ${O}/>
      <rect x="26" y="500" width="260" height="12" fill="#E3D3F5" ${T}/><path d="M60 500V512M110 500V512M160 500V512M210 500V512M260 500V512" stroke="${INK}" stroke-width="1.5" opacity=".4"/>`;
    // each room: its inside, an inner shadow at the top, its outline, and a hit rect
    for (const r of CASTLE_ROOMS) {
      const [x, y, w, h] = INSIDE[r.id];
      s += `<g data-go="${r.id}" class="croom"><g transform="translate(${x} ${y})"><g clip-path="url(#${clipIds[r.id]})">${ROOM[r.id](w, h, night).replace(/BWIN|LWIN/g, m => clipIds[r.id] + m)}
        <rect width="${w}" height="16" fill="url(#${shine})"/>${night ? `<rect width="${w}" height="${h}" fill="#FFC94A" opacity=".08"/>` : ''}</g>
        <rect width="${w}" height="${h}" fill="none" ${T}/></g>
        <rect class="hit" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="transparent"/></g>`;
    }
    // the ground in front, with bushes and flowers
    const bush = (x, y, k, c = '#8FDE96') => `<path d="M${x - 26 * k} ${y}C${x - 34 * k} ${y - 20 * k} ${x - 14 * k} ${y - 30 * k} ${x - 6 * k} ${y - 20 * k}C${x} ${y - 36 * k} ${x + 24 * k} ${y - 30 * k} ${x + 18 * k} ${y - 14 * k}C${x + 34 * k} ${y - 14 * k} ${x + 32 * k} ${y} ${x + 22 * k} ${y}Z" fill="${c}" ${T}/>`;
    const flower = (x, y, c) => [0, 72, 144, 216, 288].map(a => `<circle cx="${f(x + 4.5 * Math.cos(a * Math.PI / 180))}" cy="${f(y + 4.5 * Math.sin(a * Math.PI / 180))}" r="3.6" fill="${c}" ${sw(1.4)}/>`).join('') + `<circle cx="${x}" cy="${y}" r="2.6" fill="${C.gold}"/>`;
    s += `<path d="M-10 512Q200 504 410 512V570H-10Z" fill="${night ? '#6FAE7E' : '#B8EFA8'}" ${O}/><path d="M10 526Q200 518 390 526" fill="none" stroke="${night ? '#5E9A6D' : '#9EDC8E'}" stroke-width="5" stroke-linecap="round"/>
      ${bush(14, 512, 0.75)}${bush(392, 512, 0.6, '#A7E8A0')}${flower(60, 540, C.rose)}${flower(150, 548, C.gold)}${flower(244, 538, C.lilac)}${flower(330, 546, C.pink)}${flower(110, 530, C.sky)}${twinkle(200, 540, 5, '#fff')}`;
    return svg('0 0 400 560', s, opt.label || 'Your castle', 'class="castle"');
  }

  root.SparkleStableArt = { scene, prop, need, bubble, castle, CASTLE_ROOMS, PROPS, NAMES };
})(typeof window !== 'undefined' ? window : globalThis);
