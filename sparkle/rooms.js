'use strict';

// Her castle's rooms, drawn in code as SVG: the bedroom, the library and the ballroom she decorates
// with the coins she earns. Each room has four slots (wall, big, rug, small); each slot has a
// starter piece she owns from the start, two pieces to buy in the Royal Boutique, and a story gift
// a friend gives her at the end of a chapter (never sold). The look matches art.js: soft rounded
// shapes, a deep plum outline (never black), flat pastel color with one gentle highlight, and
// twinkles. No words, letters or numbers anywhere.
//
// A room is a cut-away: the back wall (the wallpaper) over the top of the picture, with a window or
// an arched doorway that stays the same, and the floor below with the rug (in the ballroom, the
// whole dance floor). The big piece and the small piece stand on the floor to the right (the
// ballroom's chandelier hangs from the ceiling), so the left third of the floor stays clear for
// the princess.
//
//   SparkleRooms.ROOMS     { bedroom: { name, slots: { wall: [ids], big, rug, small } }, ... }
//                          (first id in each list = the starter; gifts listed last)
//   SparkleRooms.ITEMS     { id: { room, slot, name, price, gift?, from? } }
//   SparkleRooms.STARTER   { bedroom: { wall, big, rug, small }, ... }
//   SparkleRooms.draw(room, chosen, opt)   the whole room, <svg viewBox="0 0 400 300">; chosen is
//                          { slot: id }, a missing slot shows its starter; opt.label sets the
//                          aria-label
//   SparkleRooms.piece(id) one piece alone for a shop card, <svg viewBox="0 0 100 100">
//
// Gradients, patterns and clip paths get their own ids (uid) so many pictures can share a page.
(function (root) {
  let n = 0;
  const uid = p => `sr${p}${++n}`;
  const INK = '#4B2E6F';
  const C = {
    pink: '#FF8FC7', blush: '#FFB3DA', rose: '#FF5FA8', lilac: '#B79BFF', lav: '#D9CCFF', mint: '#7FE0C7', sky: '#8FD3FF',
    gold: '#FFC94A', amber: '#F5A623', cream: '#FFF6E9', white: '#FFFFFF', peach: '#FFC7A8', coral: '#FF8A7A', berry: '#C04B9A', teal: '#4FC3B8',
    wood: '#E9B872', woodD: '#C98B5E',
  };

  // Outline widths are multiplied by K: 1 in a room, more when a piece is shrunk onto a card, so
  // the outline looks the same thickness everywhere.
  let K = 1;
  const f = v => +(+v).toFixed(1);
  const sw = w => `stroke="${INK}" stroke-width="${f(w * K)}" stroke-linejoin="round" stroke-linecap="round"`;
  const O = () => sw(3), T = () => sw(2);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const svg = (vb, body, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${esc(label)}">${body}</svg>`;
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
  const shadow = (cx, cy, rx) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(rx * 0.13)}" fill="${INK}" opacity=".13"/>`;
  // the soft highlight on a shape
  const hl = (d, w = 3) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${f(w * (K > 1 ? (1 + K) / 2 : 1))}" stroke-linecap="round" opacity=".6"/>`;
  // a colored line with an outline (rods, arms, chains, stems)
  const bar = (d, col, w) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f(w + 3 * K)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  // shapes merged under one outline (clouds, puffs): [x, y, r] circles and [x, y, w, h, rx] rects
  const blob = (shapes, fill) => {
    const one = (s, g, col) => s.length === 3 ? `<circle cx="${f(s[0])}" cy="${f(s[1])}" r="${f(s[2] + g)}" fill="${col}"/>`
      : `<rect x="${f(s[0] - g)}" y="${f(s[1] - g)}" width="${f(s[2] + 2 * g)}" height="${f(s[3] + 2 * g)}" rx="${f((s[4] || 0) + g)}" fill="${col}"/>`;
    return shapes.map(s => one(s, 1.5 * K, INK)).join('') + shapes.map(s => one(s, 0, fill)).join('');
  };
  const flower = (x, y, r, col, mid = C.gold) => [0, 72, 144, 216, 288].map(a => `<circle cx="${f(x + r * 0.6 * Math.cos((a - 90) * Math.PI / 180))}" cy="${f(y + r * 0.6 * Math.sin((a - 90) * Math.PI / 180))}" r="${f(r * 0.52)}" fill="${col}" ${T()}/>`).join('') + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.4)}" fill="${mid}" ${T()}/>`;
  // a cut gem (as in art.js), top edge at y
  const gemAt = (x, y, s, col) => {
    const P = (u, v) => `${f(x + u * s)} ${f(y + v * s)}`;
    return `<path d="M${P(-12, 8)}L${P(-6, 0)}H${f(x + 6 * s)}L${P(12, 8)}L${P(0, 27)}Z" fill="${col}" ${T()}/><path d="M${P(-6, 0)}L${P(-3, 8)}H${f(x - 12 * s)}Z" fill="${shade(col, 0.5)}"/>
      <path d="M${P(-12, 8)}H${f(x + 12 * s)}M${P(-3, 8)}L${P(0, 27)}L${P(3, 8)}" fill="none" stroke="${INK}" stroke-width="${f(1.2 * K)}" opacity=".45"/>`;
  };
  const drop = (x, y, s = 1, col = '#E8F7FF') => `<path d="M${f(x)} ${f(y)}V${f(y + 5 * s)}" stroke="${INK}" stroke-width="${f(1.4 * K)}"/><path d="M${f(x)} ${f(y + 4 * s)}C${f(x + 5 * s)} ${f(y + 10 * s)} ${f(x + 5 * s)} ${f(y + 16 * s)} ${f(x)} ${f(y + 17 * s)}C${f(x - 5 * s)} ${f(y + 16 * s)} ${f(x - 5 * s)} ${f(y + 10 * s)} ${f(x)} ${f(y + 4 * s)}Z" fill="${col}" ${T()}/><path d="M${f(x - 1.5 * s)} ${f(y + 10 * s)}v${f(3 * s)}" stroke="#fff" stroke-width="${f(1.6 * s)}" stroke-linecap="round"/>`;
  const rng = seed => { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };

  // ---- the floor in perspective ----
  // A quad (back-left, back-right, front-left, front-right); fp gives the point s across and f deep.
  const ROOMQ = { bl: [0, 190], br: [400, 190], fl: [-170, 300], fr: [570, 300] };
  const ratio = q => (q.fr[0] - q.fl[0]) / (q.br[0] - q.bl[0]);
  const persp = (t, r) => t / (r - t * (r - 1));
  const fp = (q, s, d) => { const bx = q.bl[0] + (q.br[0] - q.bl[0]) * s, by = q.bl[1] + (q.br[1] - q.bl[1]) * s;
    const fx = q.fl[0] + (q.fr[0] - q.fl[0]) * s, fy = q.fl[1] + (q.fr[1] - q.fl[1]) * s; return [bx + (fx - bx) * d, by + (fy - by) * d]; };
  const pt = p => `${f(p[0])} ${f(p[1])}`;
  const quadD = q => `M${pt(q.bl)}L${pt(q.br)}L${pt(q.fr)}L${pt(q.fl)}Z`;
  // calls cell(i, j, [four corners], centre, width, height) for every tile
  function grid(q, cols, rows, cell) {
    const r = ratio(q); let out = '';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const d0 = persp(j / rows, r), d1 = persp((j + 1) / rows, r);
      const p = [fp(q, i / cols, d0), fp(q, (i + 1) / cols, d0), fp(q, (i + 1) / cols, d1), fp(q, i / cols, d1)];
      const cx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4, cy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4;
      out += cell(i, j, p, cx, cy, (p[1][0] - p[0][0] + p[2][0] - p[3][0]) / 2, p[3][1] - p[0][1]);
    }
    return out;
  }
  const cellD = p => `M${pt(p[0])}L${pt(p[1])}L${pt(p[2])}L${pt(p[3])}Z`;
  const tile = (p, fill) => `<path d="${cellD(p)}" fill="${fill}" stroke="${fill}" stroke-width=".8"/>`;
  function planks(q, base, seam) {
    const cols = 9, rows = 5, r = ratio(q); let out = `<path d="${quadD(q)}" fill="${base}"/>`;
    for (let i = 1; i < cols; i++) out += `<path d="M${pt(fp(q, i / cols, 0))}L${pt(fp(q, i / cols, 1))}" stroke="${seam}" stroke-width="1.6"/>`;
    for (let j = 1; j < rows; j++) { const d = persp(j / rows, r);
      for (let i = 0; i < cols; i++) if ((i * 2 + j) % 3 === 0) out += `<path d="M${pt(fp(q, i / cols, d))}L${pt(fp(q, (i + 1) / cols, d))}" stroke="${seam}" stroke-width="1.6"/>`; }
    return out;
  }

  // ---- wallpapers: a repeating tile (w by h) on a base color; cs is the scale on a shop card ----
  const thin = w => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const tinyCloud = (x, y) => `<circle cx="${x - 5}" cy="${y}" r="4.5" fill="#fff"/><circle cx="${x + 1}" cy="${y - 3}" r="5.5" fill="#fff"/><circle cx="${x + 7}" cy="${y}" r="4" fill="#fff"/><rect x="${x - 9}" y="${y}" width="19" height="4.5" rx="2.2" fill="#fff"/>`;
  const miniRainbow = (x, y) => [[15, C.pink], [10.5, C.gold], [6, C.mint]].map(([r, c]) => `<path d="M${x - r} ${y}A${r} ${r} 0 0 1 ${x + r} ${y}" fill="none" stroke="${c}" stroke-width="4.5"/>`).join('') + tinyCloud(x - 14, y) + tinyCloud(x + 14, y);
  const WALLS = {
    'bedroom-wall-stars': { base: '#E6DCFF', w: 60, h: 60, cs: 0.62, art: star(15, 17, 7.5, C.gold, thin(1.6)) + twinkle(45, 47, 6) + `<circle cx="45" cy="17" r="2" fill="#fff"/><circle cx="15" cy="47" r="2.2" fill="${C.lilac}"/>` },
    'bedroom-wall-hearts': { base: '#FFD4E9', w: 52, h: 52, cs: 0.64, art: heart(13, 14, 6.5, C.pink, thin(1.4)) + heart(39, 40, 5, '#fff') + `<circle cx="39" cy="14" r="2" fill="#fff"/><circle cx="13" cy="40" r="2" fill="${C.pink}"/>` },
    'bedroom-wall-rainbow': { base: '#DCF0FF', w: 100, h: 84, cs: 0.62, art: miniRainbow(26, 34) + miniRainbow(76, 76) + twinkle(76, 22, 4.5) + twinkle(26, 66, 3.5, C.gold) },
    'library-wall-stripes': { base: '#FFF6E9', w: 36, h: 36, cs: 0.9, art: `<rect width="18" height="36" fill="#C9F1E5"/><rect x="7.5" width="3" height="36" fill="#fff" opacity=".7"/><circle cx="27" cy="9" r="2" fill="#B5E6D6"/><circle cx="27" cy="27" r="2" fill="${C.pink}" opacity=".7"/>` },
    'library-wall-moons': { base: '#B6A6F2', w: 64, h: 64, cs: 0.62, art: moon(17, 20, 10, C.gold, thin(1.5)) + star(47, 48, 5.5, C.gold, thin(1.4)) + twinkle(48, 15, 4) + `<circle cx="16" cy="50" r="2" fill="#fff"/><circle cx="33" cy="33" r="1.6" fill="${C.lav}"/>` },
    'library-wall-leaves': { base: '#E3F6EA', w: 60, h: 80, cs: 0.7, art: `<path d="M18 0C28 26 8 54 18 80" fill="none" stroke="${C.teal}" stroke-width="2.5"/>`
      + [[28, 12, -25], [11, 33, 25], [22, 57, -25], [12, 76, 25], [12, -4, 25]].map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="7.5" ry="3.8" transform="rotate(${a} ${x} ${y})" fill="${C.mint}" ${thin(1.3)}/>`).join('')
      + [0, 72, 144, 216, 288].map(a => `<circle cx="${f(44 + 4.5 * Math.cos(a * Math.PI / 180))}" cy="${f(28 + 4.5 * Math.sin(a * Math.PI / 180))}" r="3.4" fill="${C.pink}"/>`).join('') + `<circle cx="44" cy="28" r="2.4" fill="${C.gold}"/>`
      + [0, 72, 144, 216, 288].map(a => `<circle cx="${f(44 + 3.5 * Math.cos(a * Math.PI / 180))}" cy="${f(66 + 3.5 * Math.sin(a * Math.PI / 180))}" r="2.6" fill="${C.lilac}"/>`).join('') + `<circle cx="44" cy="66" r="1.8" fill="#fff"/><circle cx="46" cy="47" r="1.6" fill="#fff"/>` },
    'ballroom-wall-gold': { base: '#FFF1D4', w: 44, h: 44, cs: 0.7, art: `<path d="M22 0L44 22L22 44L0 22Z" fill="none" stroke="#F2C35A" stroke-width="2"/>` + star(22, 22.5, 4.8, C.gold) + ['0 0', '44 0', '0 44', '44 44'].map(p => `<circle cx="${p.split(' ')[0]}" cy="${p.split(' ')[1]}" r="2.6" fill="${C.gold}"/>`).join('') },
    'ballroom-wall-swirls': { base: '#FFC8E3', w: 72, h: 60, cs: 0.6, art: `<path d="M6 30C6 12 30 8 32 22C33 30 24 33 20 27" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M42 40C44 58 66 58 66 46C66 38 58 37 56 43" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>`
      + `<circle cx="54" cy="16" r="2.5" fill="#fff"/>` + heart(18, 48, 3.8, C.pink) + `<circle cx="34" cy="50" r="1.6" fill="#fff"/>` },
    'ballroom-wall-mirrors': { base: '#DCCFFF', w: 88, h: 172, ox: 36, oy: 6, cs: 0.5, cox: 28, coy: 4, art: `<rect x="-1" width="2" height="172" fill="${C.lilac}" opacity=".6"/><rect x="87" width="2" height="172" fill="${C.lilac}" opacity=".6"/>`
      + `<ellipse cx="44" cy="92" rx="21" ry="33" fill="${C.gold}" ${thin(2)}/><ellipse cx="44" cy="92" rx="15.5" ry="27" fill="#CFEAFF" ${thin(1.6)}/><path d="M36 80Q37 72 44 69" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`
      + heart(44, 57, 5, C.rose, thin(1.4)) + twinkle(50, 106, 4) },
  };
  function pattern(id, wp, tx, ty, s) {
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${wp.w}" height="${wp.h}" patternTransform="translate(${f(tx)} ${f(ty)}) scale(${s})"><rect width="${wp.w}" height="${wp.h}" fill="${wp.base}"/>${wp.art}</pattern>`;
  }

  // ---- the window or doorway in each room (the same whatever she picks) ----
  const curtain = mirror => { const X = x => mirror ? 164 - x : x;
    return `<path d="M${X(26)} 30H${X(62)}C${X(60)} 62 ${X(54)} 92 ${X(60)} 112C${X(50)} 124 ${X(42)} 142 ${X(40)} 164C${X(32)} 124 ${X(28)} 74 ${X(26)} 30Z" fill="${C.pink}" ${O()}/>
      <path d="M${X(38)} 40C${X(38)} 70 ${X(40)} 96 ${X(46)} 116M${X(50)} 40C${X(50)} 66 ${X(48)} 90 ${X(52)} 110" fill="none" stroke="${C.blush}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${X(56)}" cy="112" r="5" fill="${C.gold}" ${T()}/>`; };
  const WINDOWS = {
    bedroom: () => `<path d="M44 148V82A38 38 0 0 1 120 82V148Z" fill="${C.cream}" ${O()}/>
      <path d="M51 141V82A31 31 0 0 1 113 82V141Z" fill="#C4E8FF"/>
      ${tinyCloud(70, 116)}${tinyCloud(100, 92)}${twinkle(68, 74, 5)}${twinkle(98, 124, 3.5)}
      ${bar('M82 52V141M51 104H113', C.cream, 4)}
      <rect x="38" y="141" width="88" height="10" rx="4" fill="${C.cream}" ${O()}/>
      ${curtain(false)}${curtain(true)}
      <rect x="20" y="24" width="124" height="7" rx="3.5" fill="${C.gold}" ${T()}/><circle cx="20" cy="27.5" r="6" fill="${C.gold}" ${T()}/><circle cx="144" cy="27.5" r="6" fill="${C.gold}" ${T()}/>`,
    library: () => `<circle cx="84" cy="88" r="48" fill="${C.cream}" ${O()}/><circle cx="84" cy="88" r="39" fill="#C4E8FF"/>
      ${tinyCloud(70, 104)}${tinyCloud(102, 78)}${twinkle(66, 70, 4.5)}
      ${bar('M84 49V127M45 88H123M56 60L112 116M112 60L56 116', C.cream, 3.5)}
      <circle cx="84" cy="88" r="14" fill="#C4E8FF" ${sw(3.2)}/><circle cx="84" cy="88" r="14" fill="none" stroke="${C.cream}" stroke-width="2"/>
      <circle cx="84" cy="88" r="39" fill="none" ${T()}/>
      ${star(84, 36, 9, C.gold, T())}
      <rect x="48" y="134" width="72" height="10" rx="4" fill="${C.wood}" ${O()}/>
      <path d="M96 120H112L109 134H99Z" fill="${C.coral}" ${T()}/>
      <path d="M104 120C98 112 98 104 102 100M104 120C110 112 114 108 116 104M104 120C104 112 106 106 108 102" fill="none" stroke="${C.teal}" stroke-width="2.5" stroke-linecap="round"/>
      <ellipse cx="101" cy="104" rx="4" ry="2.5" fill="${C.mint}" transform="rotate(-50 101 104)" ${sw(1.4)}/><ellipse cx="115" cy="106" rx="4" ry="2.5" fill="${C.mint}" transform="rotate(30 115 106)" ${sw(1.4)}/>`,
    ballroom: () => { const g = uid('dusk');
      return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9C8BEF"/><stop offset=".7" stop-color="#FFB3DA"/><stop offset="1" stop-color="#FFD6C2"/></linearGradient></defs>
      <path d="M28 191V88A54 54 0 0 1 136 88V191Z" fill="${C.gold}" ${O()}/>
      <path d="M38 191V88A44 44 0 0 1 126 88V191Z" fill="url(#${g})" ${T()}/>
      ${moon(98, 72, 11, C.cream)}${twinkle(60, 66, 4.5)}${twinkle(78, 98, 3)}${twinkle(110, 112, 3.5)}${twinkle(56, 120, 3)}
      ${[46, 56, 66, 76, 86, 96, 106, 116].map(x => bar(`M${x} 158V184`, '#fff', 3)).join('')}
      <rect x="38" y="152" width="88" height="7" rx="3" fill="#fff" ${T()}/>
      <rect x="38" y="184" width="88" height="7" fill="#fff" ${T()}/>
      ${heart(82, 40, 6, C.rose, T())}
      <path d="M18 26C40 30 54 40 60 56C46 70 32 64 24 54Z" fill="${C.rose}" ${O()}/><path d="M146 26C124 30 110 40 104 56C118 70 132 64 140 54Z" fill="${C.rose}" ${O()}/>
      <path d="M16 26H38C34 80 30 140 34 191H16Z" fill="${C.rose}" ${O()}/><path d="M148 26H126C130 80 134 140 130 191H148Z" fill="${C.rose}" ${O()}/>
      <path d="M26 40C25 90 23 140 25 186M138 40C139 90 141 140 139 186" fill="none" stroke="${C.pink}" stroke-width="3" stroke-linecap="round"/>
      <rect x="10" y="20" width="144" height="8" rx="4" fill="${C.gold}" ${T()}/>`; },
  };
  const TRIM = { bedroom: ['#fff', '#FFE3F1'], library: [C.wood, '#F3CF98'], ballroom: [C.gold, '#FFE08A'] };
  const FLOOR = { bedroom: ['#F6D9B6', '#E4B98C'], library: [C.wood, C.woodD] };

  // ---- rugs (bedroom and library): drawn in the ellipse (cx, cy, rx, ry), on the floor ----
  const map = (cx, cy, rx, ry) => (u, v) => `${f(cx + u * rx)} ${f(cy + v * ry)}`;
  const heartD = M => `M${M(0, 0.95)}C${M(-0.55, 0.6)} ${M(-1.05, 0.15)} ${M(-1, -0.35)}C${M(-0.95, -0.9)} ${M(-0.3, -1.02)} ${M(0, -0.55)}C${M(0.3, -1.02)} ${M(0.95, -0.9)} ${M(1, -0.35)}C${M(1.05, 0.15)} ${M(0.55, 0.6)} ${M(0, 0.95)}Z`;
  const ell = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" ${extra}/>`;
  const stitch = (cx, cy, rx, ry) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="none" stroke="#fff" stroke-width="${f(2 * Math.max(1, K * 0.8))}" stroke-dasharray="${f(5 * Math.max(1, K * 0.6))} ${f(5 * Math.max(1, K * 0.6))}" stroke-linecap="round" opacity=".85"/>`;
  const RUGS = {
    'bedroom-rug-round': (cx, cy, rx, ry) => ell(cx, cy, rx, ry, C.lilac, O()) + stitch(cx, cy, rx * 0.86, ry * 0.84) + ell(cx, cy, rx * 0.66, ry * 0.64, C.pink, T()) + ell(cx, cy, rx * 0.34, ry * 0.32, C.blush, T())
      + hl(`M${f(cx - rx * 0.55)} ${f(cy - ry * 0.42)}Q${f(cx - rx * 0.3)} ${f(cy - ry * 0.56)} ${f(cx - rx * 0.05)} ${f(cy - ry * 0.56)}`),
    'bedroom-rug-heart': (cx, cy, rx, ry) => { const M = map(cx, cy, rx, ry), I = map(cx, cy, rx * 0.72, ry * 0.72);
      return `<path d="${heartD(M)}" fill="${C.pink}" ${O()}/><path d="${heartD(map(cx, cy, rx * 0.86, ry * 0.86))}" fill="none" stroke="#fff" stroke-width="${f(2 * Math.max(1, K * 0.8))}" stroke-dasharray="${f(5 * Math.max(1, K * 0.6))} ${f(5 * Math.max(1, K * 0.6))}" stroke-linecap="round" opacity=".85"/>
        <path d="${heartD(I)}" fill="${C.blush}" ${T()}/>` + heart(cx, cy - ry * 0.1, Math.min(rx, ry * 2.2) * 0.13, '#fff') + hl(`M${M(-0.75, -0.45)}Q${M(-0.62, -0.75)} ${M(-0.35, -0.78)}`); },
    'bedroom-rug-flower': (cx, cy, rx, ry) => {
      const P = Array.from({ length: 8 }, (_, k) => { const a = k * Math.PI / 4 - Math.PI / 2; return [cx + Math.cos(a) * rx * 0.58, cy + Math.sin(a) * ry * 0.58]; });
      let s = P.map(([x, y]) => ell(x, y, rx * 0.42 + 1.5 * K, ry * 0.42 + 1.5 * K, INK)).join('') + P.map(([x, y], k) => ell(x, y, rx * 0.42, ry * 0.42, k % 2 ? C.blush : C.pink)).join('');
      s += P.map(([x, y]) => `<path d="M${f(cx + (x - cx) * 0.62)} ${f(cy + (y - cy) * 0.62)}L${f(cx + (x - cx) * 1.25)} ${f(cy + (y - cy) * 1.25)}" stroke="#fff" stroke-width="${f(2.4 * Math.max(1, K * 0.8))}" stroke-linecap="round" opacity=".7"/>`).join('');
      return s + ell(cx, cy, rx * 0.36, ry * 0.36, C.gold, O()) + ell(cx, cy, rx * 0.2, ry * 0.2, '#FFE9A0') + hl(`M${f(cx - rx * 0.26)} ${f(cy - ry * 0.18)}Q${f(cx - rx * 0.12)} ${f(cy - ry * 0.32)} ${f(cx + rx * 0.06)} ${f(cy - ry * 0.3)}`); },
    'bedroom-rug-garden': (cx, cy, rx, ry) => { const M = map(cx, cy, rx, ry); let s = '';
      for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; s += `<circle cx="${f(cx + Math.cos(a) * rx * 0.93)}" cy="${f(cy + Math.sin(a) * ry * 0.9)}" r="${f(ry * 0.2)}" fill="${C.pink}" ${T()}/>`; }
      s += ell(cx, cy, rx * 0.93, ry * 0.9, '#9BE6BE', O()) + ell(cx, cy, rx * 0.72, ry * 0.66, '#B9F0D2');
      for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; s += `<circle cx="${f(cx + Math.cos(a) * rx * 0.93)}" cy="${f(cy + Math.sin(a) * ry * 0.9)}" r="${f(ry * 0.08)}" fill="#fff"/>`; }
      const r = Math.min(rx, ry * 1.8) * 0.13;
      [[-0.45, -0.1, C.rose], [0, 0.25, C.gold], [0.45, -0.1, C.lilac], [-0.15, -0.38, C.sky], [0.22, -0.32, C.blush]].forEach(([u, v, c]) => {
        s += `<ellipse cx="${M(u - 0.06, v + 0.18).split(' ')[0]}" cy="${M(u - 0.06, v + 0.18).split(' ')[1]}" rx="${f(r * 0.8)}" ry="${f(r * 0.35)}" fill="${C.teal}"/>` + flower(+M(u, v).split(' ')[0], +M(u, v).split(' ')[1], r, c); });
      return s; },
    'library-rug-oval': (cx, cy, rx, ry) => { let fr = '';
      for (let k = -2; k <= 2; k++) { const v = k * 0.22, x = rx * Math.sqrt(1 - v * v);
        fr += bar(`M${f(cx - x + 2)} ${f(cy + v * ry)}h${f(-6 - 1.5 * K)}M${f(cx + x - 2)} ${f(cy + v * ry)}h${f(6 + 1.5 * K)}`, C.cream, 2.6); }
      return fr + ell(cx, cy, rx, ry, C.teal, O()) + ell(cx, cy, rx * 0.8, ry * 0.76, C.mint, T()) + stitch(cx, cy, rx * 0.62, ry * 0.58) + ell(cx, cy, rx * 0.4, ry * 0.36, '#C8F5E8', T()) + heart(cx, cy, Math.min(rx, ry * 2) * 0.1, C.pink)
        + hl(`M${f(cx - rx * 0.6)} ${f(cy - ry * 0.4)}Q${f(cx - rx * 0.35)} ${f(cy - ry * 0.62)} ${f(cx - rx * 0.05)} ${f(cy - ry * 0.64)}`); },
    'library-rug-alphabet': (cx, cy, rx, ry) => {
      const q = { bl: [cx - rx * 0.86, cy - ry], br: [cx + rx * 0.86, cy - ry], fl: [cx - rx, cy + ry], fr: [cx + rx, cy + ry] };
      const iq = { bl: fp(q, 0.06, 0.12), br: fp(q, 0.94, 0.12), fl: fp(q, 0.05, 0.88), fr: fp(q, 0.95, 0.88) };
      const cols = [C.pink, C.gold, C.mint, C.sky, C.lilac, C.coral];
      const shapes = (k, x, y, s, sq) => [
        `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}" fill="#fff" transform="translate(0 ${f(y)}) scale(1 ${f(sq)}) translate(0 ${f(-y)})"/>`,
        `<path d="M${f(x)} ${f(y - s * sq)}L${f(x + s)} ${f(y + s * sq)}H${f(x - s)}Z" fill="#fff"/>`,
        `<path d="M${f(x)} ${f(y - s * 1.1 * sq)}L${f(x + s * 1.1)} ${f(y)}L${f(x)} ${f(y + s * 1.1 * sq)}L${f(x - s * 1.1)} ${f(y)}Z" fill="#fff"/>`,
        `<path d="M${f(x - s * 0.9)} ${f(y - s * 0.9 * sq)}h${f(s * 1.8)}v${f(s * 1.8 * sq)}h${f(-s * 1.8)}Z" fill="#fff"/>`,
      ][k % 4];
      const cells = grid(iq, 5, 3, (i, j, p, x, y, w, h) => {
        const k = i + j * 2, inset = { bl: p[0], br: p[1], fr: p[2], fl: p[3] };
        const a = fp(inset, 0.08, 0.1), b = fp(inset, 0.92, 0.1), c = fp(inset, 0.92, 0.9), d = fp(inset, 0.08, 0.9);
        return `<path d="M${pt(a)}L${pt(b)}L${pt(c)}L${pt(d)}Z" fill="${cols[k % cols.length]}" ${sw(1.6)}/>` + shapes(i * 3 + j, x, y, w * 0.2, h / w); });
      return `<path d="${quadD(q)}" fill="${C.cream}" ${O()}/>${cells}` + hl(`M${pt(fp(q, 0.05, 0.05))}L${pt(fp(q, 0.3, 0.05))}`, 2.4); },
    'library-rug-starry': (cx, cy, rx, ry) => { const M = map(cx, cy, rx, ry); let s = ell(cx, cy, rx, ry, C.lilac, O()) + ell(cx, cy, rx * 0.86, ry * 0.82, '#5C4CC2', T());
      const r = Math.min(rx, ry * 2) * 0.08;
      [[-0.55, -0.1, 1], [-0.25, 0.4, 0.8], [0.35, -0.35, 0.9], [0.6, 0.2, 1.1], [-0.05, -0.45, 0.6], [0.15, 0.45, 0.6]].forEach(([u, v, k]) => { const [x, y] = M(u, v).split(' ').map(Number); s += star(x, y, r * k * 1.3, C.gold, T()); });
      [[-0.7, 0.3], [0.7, -0.3], [-0.35, -0.5]].forEach(([u, v]) => { const [x, y] = M(u, v).split(' ').map(Number); s += twinkle(x, y, r * 0.9); });
      return s + moon(cx, cy, r * 1.9, C.cream, T()) + hl(`M${f(cx - rx * 0.6)} ${f(cy - ry * 0.48)}Q${f(cx - rx * 0.35)} ${f(cy - ry * 0.68)} ${f(cx - rx * 0.05)} ${f(cy - ry * 0.7)}`, 2.4); },
  };

  // ---- the ballroom's dance floors: the whole floor, tiles in perspective ----
  const DANCE = {
    'ballroom-floor-checks': { edge: '#B49CFF', draw: q => grid(q, 10, 6, (i, j, p) => tile(p, (i + j) % 2 ? C.cream : '#CDBBFF')) },
    'ballroom-floor-hearts': { edge: C.pink, draw: q => grid(q, 10, 6, (i, j, p, x, y, w, h) => tile(p, (i + j) % 2 ? '#FFE3F1' : '#FFC4E1')
      + ((i + j) % 2 ? '' : `<path d="M0 .9C-1.4 -.1 -.7 -1.1 0 -.35C.7 -1.1 1.4 -.1 0 .9Z" fill="${C.rose}" transform="translate(${f(x)} ${f(y)}) scale(${f(w * 0.26)} ${f(h * 0.4)})"/>`)) },
    'ballroom-floor-rainbow': { edge: C.lilac, draw: q => { const cols = ['#FF9BC4', '#FFC27A', '#FFE47A', '#9BE8B0', '#8FD3FF', '#C3A8FF'];
      return grid(q, 12, 6, (i, j, p) => tile(p, j % 2 ? shade(cols[i % 6], 0.3) : cols[i % 6])); } },
    'ballroom-floor-crystal': { edge: '#9CC9F0', draw: q => grid(q, 10, 6, (i, j, p, x, y, w, h) => { const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return tile(p, (i + j) % 2 ? '#E6DEFF' : '#CFEDFF') + `<path d="M${pt(m(p[0], p[1]))}L${pt(m(p[1], p[2]))}L${pt(m(p[2], p[3]))}L${pt(m(p[3], p[0]))}Z" fill="#fff" opacity=".55"/>`
        + ((i * 7 + j * 3) % 5 === 0 ? twinkle(x, y, Math.min(w, h * 2) * 0.22) : ''); }) },
  };

  // ---- big and small pieces: drawn where they stand in the room (400 by 300) ----
  // bb is the box a shop card fits the piece into.
  const scallops = (x0, x1, y, k, depth = 9) => { const w = Math.abs(x1 - x0) / k; let s = ''; for (let i = 0; i < k; i++) s += `q${f(-w / 2)} ${depth} ${f(-w)} 0`; return s; };
  function bed(o) {
    const legs = o.legs || `<rect x="240" y="240" width="10" height="17" rx="3" fill="${o.FD}" ${T()}/><rect x="348" y="240" width="10" height="17" rx="3" fill="${o.FD}" ${T()}/>`;
    const rail = o.rail || `<rect x="232" y="224" width="134" height="20" rx="7" fill="${o.F}" ${O()}/>`;
    return shadow(306, 257, 92) + (o.behind || '') + o.head + legs + rail
      + `<rect x="236" y="196" width="126" height="32" rx="10" fill="#fff" ${O()}/>`
      + `<path d="M320 198C316 182 324 174 340 174C354 174 362 182 358 198Z" fill="${o.P}" ${O()}/>` + hl('M328 184Q332 179 339 178', 2.5)
      + `<path d="M230 236V200Q230 190 240 190H324Q334 190 334 200V236${scallops(334, 230, 236, 8)}Z" fill="${o.B}" ${O()}/>`
      + `<path d="M232 204H332" stroke="${o.BT}" stroke-width="5" opacity=".8"/>` + hl('M238 214Q238 200 250 198', 3) + (o.deco || '')
      + o.foot + (o.front || '');
  }
  const headboard = F => `<path d="M356 257V138C356 113 392 113 392 138V257Z" fill="${F}" ${O()}/>` + hl('M364 140Q364 125 373 122');
  const footboard = F => `<path d="M218 257V184C218 164 250 164 250 184V257Z" fill="${F}" ${O()}/>` + hl('M225 186Q225 174 234 172');
  const nightstand = () => `${shadow(178, 257, 34)}<rect x="154" y="244" width="8" height="13" rx="2" fill="${C.woodD}" ${T()}/><rect x="194" y="244" width="8" height="13" rx="2" fill="${C.woodD}" ${T()}/>
      <rect x="150" y="212" width="56" height="36" rx="6" fill="${C.cream}" ${O()}/><rect x="146" y="204" width="64" height="11" rx="4" fill="${C.wood}" ${O()}/>
      <path d="M156 229H200" stroke="${INK}" stroke-width="${f(1.6 * K)}" opacity=".35"/><circle cx="178" cy="236" r="3.5" fill="${C.gold}" ${T()}/>` + hl('M156 218H170', 2.5);
  // a bookcase's books between x0 and x1 standing on y, up to h tall
  function books(x0, x1, y, h, seed, cols) {
    const r = rng(seed); let x = x0 + 2, s = '';
    for (;;) { const w = 7 + Math.floor(r() * 5), hh = h * (0.66 + r() * 0.3), c = cols[Math.floor(r() * cols.length)];
      if (x + w > x1 - 2) break;
      s += `<rect x="${f(x)}" y="${f(y - hh)}" width="${w}" height="${f(hh)}" rx="1.5" fill="${c}" ${sw(1.8)}/><path d="M${f(x + 2)} ${f(y - hh + 5)}h${w - 4}M${f(x + 2)} ${f(y - 5)}h${w - 4}" stroke="#fff" stroke-width="1.6" opacity=".75"/>`;
      x += w; }
    if (x1 - x >= 10) { const hh = h * 0.8, c = cols[Math.floor(r() * cols.length)];
      s += `<rect x="${f(x + 1)}" y="${f(y - hh)}" width="8" height="${f(hh)}" rx="1.5" fill="${c}" transform="rotate(14 ${f(x + 1)} ${f(y)})" ${sw(1.8)}/>`; }
    return s;
  }
  const BOOKS = [C.pink, C.sky, C.mint, C.gold, C.lilac, C.coral, C.rose, C.teal];
  const SHELF_ROWS = [[66, 104], [112, 150], [158, 196], [204, 238]];
  function bookcase(o) {   // the shared middle of the library's shelves
    let s = '';
    SHELF_ROWS.forEach(([t, b], i) => {
      s += books(274, i === 1 ? 344 : i === 3 ? 352 : 374, b, b - t - 4, o.seed + i * 7, o.books);
      if (i < 3) s += `<rect x="270" y="${b}" width="108" height="7" rx="2" fill="${o.F}" ${T()}/>`;
    });
    // little treasures on two shelves
    s += `<circle cx="360" cy="138" r="10" fill="#CFEAFF" ${T()}/><path d="M352 148H368L366 152H354Z" fill="${C.gold}" ${T()}/>${twinkle(357, 134, 3)}`;
    s += `<path d="M358 238C356 226 364 222 368 226C372 222 380 226 377 238Z" fill="${C.mint}" ${T()}/><rect x="356" y="231" width="24" height="8" rx="3" fill="${C.coral}" ${T()}/>`;
    return s;
  }
  const chainTo = (y1) => `<ellipse cx="250" cy="13" rx="14" ry="5" fill="${C.gold}" ${T()}/>` + bar(`M250 14V${y1}`, C.gold, 3);

  const ART = {
    // ---------------- bedroom: the bed ----------------
    'bedroom-bed-pink': { bb: [200, 108, 398, 262], draw: () => bed({ F: C.pink, FD: '#E46FAE', B: C.blush, BT: '#fff', P: '#fff',
      head: headboard(C.pink) + heart(374, 146, 9, '#fff', T()), foot: footboard(C.pink) + heart(234, 194, 6, '#fff', T()),
      deco: [[254, 222], [284, 212], [314, 224]].map(([x, y]) => heart(x, y, 5, C.rose)).join('') }) },
    'bedroom-bed-canopy': { bb: [196, 30, 400, 262], draw: () => bed({ F: C.lilac, FD: '#9C7DF0', B: C.pink, BT: '#fff', P: C.cream,
      behind: `<rect x="218" y="56" width="9" height="201" rx="3" fill="${C.lilac}" ${T()}/><rect x="381" y="56" width="9" height="201" rx="3" fill="${C.lilac}" ${T()}/>`,
      head: headboard(C.lilac) + star(374, 146, 10, C.gold, T()), foot: footboard(C.lilac) + star(234, 194, 7, C.gold, T()),
      deco: [[254, 220], [282, 210], [312, 222]].map(([x, y]) => star(x, y, 5.5, '#fff')).join(''),
      front: `<path d="M212 58H244C238 90 228 120 224 150C230 170 234 190 232 206H212C210 182 212 166 218 150C214 120 212 90 212 58Z" fill="#FFD6EA" opacity=".85" ${T()}/>
        <path d="M396 58H364C370 90 380 120 384 150C378 170 374 190 376 206H396C398 182 396 166 390 150C394 120 396 90 396 58Z" fill="#FFD6EA" opacity=".85" ${T()}/>
        <path d="M222 82C220 104 220 126 221 146M386 82C388 104 388 126 387 146" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>
        <circle cx="221" cy="150" r="5" fill="${C.gold}" ${T()}/><circle cx="387" cy="150" r="5" fill="${C.gold}" ${T()}/>
        <path d="M210 44H398V60${scallops(398, 210, 60, 8, 12)}Z" fill="${C.pink}" ${O()}/>${hl('M220 50H266', 2.5)}
        ${[233, 257, 280, 304, 327, 351, 374].map(x => `<circle cx="${x}" cy="66" r="2.6" fill="${C.gold}"/>`).join('')}
        ${heart(304, 40, 8, C.rose, T())}${twinkle(236, 30, 6, C.gold)}${twinkle(372, 28, 5, C.gold)}` }) },
    'bedroom-bed-cloud': { bb: [200, 104, 398, 262], draw: () => { const W = '#F7FBFF';
      return bed({ F: W, FD: C.gold, B: C.sky, BT: '#fff', P: '#fff',
        head: blob([[356, 136, 36, 121, 10], [363, 140, 11], [376, 126, 15], [388, 140, 8]], W) + [[16, C.pink], [11.5, C.gold], [7, C.mint]].map(([r, c]) => `<path d="M${374 - r} 186A${r} ${r} 0 0 1 ${374 + r} 186" fill="none" stroke="${c}" stroke-width="4.5"/>`).join('') + hl('M366 132Q370 122 380 120'),
        legs: `<circle cx="248" cy="252" r="6" fill="${C.gold}" ${T()}/><circle cx="352" cy="252" r="6" fill="${C.gold}" ${T()}/>`,
        rail: blob([[232, 224, 134, 20, 9], [244, 244, 10], [266, 246, 11], [288, 245, 10], [310, 246, 11], [332, 245, 10], [354, 244, 10]], W),
        foot: blob([[218, 178, 32, 79, 8], [224, 180, 9], [236, 170, 12], [248, 180, 7]], W) + hl('M226 176Q230 166 240 164'),
        deco: `<path d="M251 218c-4 0-4-6 0-6c0-5 8-5 8 0c4 0 4 6 0 6Z" fill="#fff"/><path d="M291 208c-4 0-4-6 0-6c0-5 8-5 8 0c4 0 4 6 0 6Z" fill="#fff"/><path d="M308 226c-4 0-4-6 0-6c0-5 8-5 8 0c4 0 4 6 0 6Z" fill="#fff"/>`,
        front: twinkle(226, 150, 6, C.gold) + twinkle(396, 110, 4, C.gold) }); } },
    'bedroom-bed-stars': { bb: [200, 84, 398, 262], draw: () => bed({ F: '#9C8BEF', FD: '#7A6BDB', B: '#5C4CC2', BT: C.lilac, P: C.lav,
      head: headboard('#9C8BEF') + moon(372, 104, 17, C.gold, O()) + star(368, 160, 6, '#fff') + star(382, 182, 5, C.gold) + star(366, 206, 4, '#fff'),
      foot: footboard('#9C8BEF') + star(234, 164, 9, C.gold, T()) + star(234, 200, 5, '#fff'),
      deco: [[250, 220, 6], [274, 208, 5], [298, 224, 6.5], [320, 210, 5]].map(([x, y, r]) => star(x, y, r, C.gold)).join('') + twinkle(286, 228, 3.5) + twinkle(308, 200, 3),
      front: twinkle(394, 82, 5, C.gold) + twinkle(342, 98, 4, C.gold) }) },

    // ---------------- bedroom: by the bed ----------------
    'bedroom-lamp': { bb: [140, 134, 216, 262], draw: () => `<circle cx="178" cy="166" r="30" fill="#FFE9A0" opacity=".45"/>` + nightstand()
      + `<ellipse cx="178" cy="203" rx="11" ry="4" fill="${C.gold}" ${T()}/><rect x="175" y="180" width="6" height="22" fill="${C.gold}" ${T()}/>`
      + `<path d="M161 182L168 152H188L195 182${scallops(195, 161, 182, 4, 6)}Z" fill="${C.pink}" ${O()}/>` + hl('M170 158L166 176', 2.5) + heart(178, 167, 4.5, '#fff') },
    'bedroom-toybox': { bb: [138, 156, 218, 262], draw: () => shadow(178, 257, 36)
      + `<path d="M146 212L150 188L214 182L212 210Z" fill="#9C7DF0" ${O()}/>`
      + bar('M196 210L204 176', C.lav, 3) + star(205, 172, 9, C.gold, T())
      + `<circle cx="162" cy="198" r="5" fill="${C.peach}" ${T()}/><circle cx="182" cy="198" r="5" fill="${C.peach}" ${T()}/><circle cx="172" cy="206" r="12" fill="${C.peach}" ${T()}/>`
      + `<circle cx="167" cy="204" r="1.8" fill="${INK}"/><circle cx="177" cy="204" r="1.8" fill="${INK}"/><ellipse cx="172" cy="209" rx="3" ry="2" fill="${C.coral}"/>`
      + `<circle cx="194" cy="206" r="8" fill="${C.sky}" ${T()}/><path d="M186.5 204Q194 210 201.5 204" fill="none" stroke="#fff" stroke-width="2.5"/>`
      + `<rect x="146" y="210" width="66" height="46" rx="7" fill="${C.lilac}" ${O()}/><rect x="146" y="222" width="66" height="7" fill="${C.lav}" ${T()}/>`
      + heart(179, 241, 7, C.pink, T()) + hl('M153 236V246', 2.5) },
    'bedroom-petbed': { bb: [136, 190, 220, 262], draw: () => shadow(178, 257, 38)
      + ell(178, 246, 36, 12, C.rose, O()) + ell(178, 243, 27, 7, C.blush)
      + `<circle cx="154" cy="234" r="5" fill="${C.lilac}" ${T()}/><circle cx="150" cy="240" r="4.5" fill="${C.pink}" ${T()}/>`
      + ell(172, 236, 19, 10, '#fff', T())
      + `<ellipse cx="194" cy="226" rx="11" ry="10" fill="#fff" ${T()}/><ellipse cx="203" cy="230" rx="6" ry="4.5" fill="${C.blush}" ${T()}/>`
      + `<path d="M191 217L197 201L199 217Z" fill="${C.gold}" ${T()}/>`
      + `<circle cx="185" cy="218" r="5" fill="${C.pink}" ${T()}/><circle cx="181" cy="225" r="4.5" fill="${C.lilac}" ${T()}/><circle cx="182" cy="232" r="4" fill="${C.sky}" ${T()}/>`
      + `<path d="M190 225Q194 228 198 225" fill="none" stroke="${INK}" stroke-width="${f(2.2 * K)}" stroke-linecap="round"/><ellipse cx="197" cy="231" rx="3" ry="1.8" fill="${C.pink}" opacity=".7"/>`
      + hl('M160 233Q166 229 174 229', 2) + heart(206, 206, 4.5, C.rose) + twinkle(160, 214, 4.5, C.gold) },
    'bedroom-moon-lamp': { bb: [140, 128, 216, 262], draw: () => `<circle cx="178" cy="166" r="32" fill="#FFE9A0" opacity=".5"/>` + nightstand()
      + `<ellipse cx="178" cy="203" rx="11" ry="4" fill="${C.gold}" ${T()}/>` + bar('M178 202V186', C.gold, 3)
      + moon(178, 164, 22, '#FFE07A', O()) + `<path d="M170 162Q174 166 178 162" fill="none" stroke="${INK}" stroke-width="${f(2.2 * K)}" stroke-linecap="round"/><ellipse cx="172" cy="170" rx="3" ry="2" fill="${C.pink}" opacity=".7"/>`
      + `<path d="M190 144V150" stroke="${INK}" stroke-width="${f(1.4 * K)}"/>` + star(190, 155, 5, '#fff', T()) + twinkle(156, 144, 5) + twinkle(200, 186, 3.5) },

    // ---------------- library: the bookshelf ----------------
    'library-shelf-wood': { bb: [248, 34, 396, 262], draw: () => shadow(324, 256, 70)
      + `<rect x="262" y="56" width="124" height="198" rx="5" fill="${C.wood}" ${O()}/><rect x="270" y="64" width="108" height="176" rx="2" fill="${C.woodD}" ${T()}/>`
      + bookcase({ F: C.wood, books: BOOKS, seed: 11 }) + `<rect x="256" y="46" width="136" height="13" rx="5" fill="${C.wood}" ${O()}/>` + hl('M266 51H300', 2.5)
      + `<rect x="266" y="244" width="116" height="6" rx="2" fill="${C.woodD}" opacity=".5"/>`
      + `<path d="M292 46C284 34 288 26 294 30C296 22 306 24 304 34C308 32 312 38 304 46Z" fill="${C.mint}" ${T()}/><path d="M288 46H308L306 40H290Z" fill="${C.coral}" ${T()}/>` + star(364, 36, 8, C.gold, T()) },
    'library-shelf-rainbow': { bb: [248, 22, 396, 262], draw: () => {
      return shadow(324, 256, 70)
      + `<path d="M260 254V96A64 64 0 0 1 388 96V254Z" fill="#fff" ${O()}/>`
      + [[60, C.pink], [55, C.gold], [50, C.mint]].map(([r, c]) => `<path d="M${324 - r} 96A${r} ${r} 0 0 1 ${324 + r} 96" fill="none" stroke="${c}" stroke-width="5"/>`).join('')
      + `<path d="M270 240V104A54 54 0 0 1 378 104V240Z" fill="#FFD6EA" ${T()}/><rect x="270" y="112" width="108" height="38" fill="#FFEFB8"/><rect x="270" y="158" width="108" height="38" fill="#CFF5EA"/><rect x="270" y="204" width="108" height="36" fill="#D5EEFF"/>`
      + `<path d="M270 240V104A54 54 0 0 1 378 104V240Z" fill="none" ${T()}/>`
      + bookcase({ F: '#fff', books: [C.rose, C.amber, C.teal, '#5BB6F0', '#9C7DF0', C.coral], seed: 5 })
      + heart(324, 82, 9, C.rose, T()) + hl('M268 110Q270 70 300 52', 3) + twinkle(262, 40, 6, C.gold) + twinkle(388, 36, 5, C.gold); } },
    'library-shelf-castle': { bb: [242, 6, 400, 262], draw: () => { const P = '#FFC2DE';
      const tower = x => `<rect x="${x - 11}" y="62" width="22" height="194" rx="3" fill="${C.blush}" ${O()}/><path d="M${x - 15} 64L${x} 26L${x + 15} 64Z" fill="${C.lilac}" ${O()}/>`
        + bar(`M${x} 26V12`, C.gold, 2) + `<path d="M${x + 1} 12L${x + (x > 300 ? -13 : 13)} 16L${x + 1} 21Z" fill="${C.rose}" ${T()}/>`
        + `<path d="M${x - 5} 120V108A5 5 0 0 1 ${x + 5} 108V120Z" fill="${C.berry}" ${T()}/><path d="M${x - 5} 190V178A5 5 0 0 1 ${x + 5} 178V190Z" fill="${C.berry}" ${T()}/>`;
      return shadow(324, 256, 76)
        + `<path d="M268 254V58H280V48H294V58H310V48H324V58H338V48H352V58H368V48H380V58H380V254Z" fill="${P}" ${O()}/>`
        + `<rect x="276" y="66" width="96" height="174" rx="2" fill="${C.berry}" opacity=".35"/>`
        + `<path d="M276 240V66H372V240Z" fill="none" ${T()}/>`
        + (() => { let s = ''; SHELF_ROWS.forEach(([t, b], i) => { s += books(278, i === 1 ? 344 : i === 3 ? 350 : 370, b, b - t - 4, 31 + i * 5, [C.pink, C.sky, C.mint, C.gold, C.lilac, '#fff']);
          if (i < 3) s += `<rect x="274" y="${b}" width="100" height="7" rx="2" fill="${P}" ${T()}/>`; }); return s; })()
        + `<circle cx="360" cy="138" r="10" fill="#CFEAFF" ${T()}/><path d="M352 148H368L366 152H354Z" fill="${C.gold}" ${T()}/>${twinkle(357, 134, 3)}`
        + heart(362, 228, 7, C.rose, T())
        + tower(259) + tower(382) + hl('M254 72V96', 2.5) + `<path d="M318 254V244A6 6 0 0 1 330 244V254Z" fill="${C.berry}" ${T()}/>`; } },
    'library-shelf-golden': { bb: [248, 18, 396, 262], draw: () => shadow(324, 256, 70)
      + twinkle(254, 70, 7, C.gold) + twinkle(396, 120, 6, C.gold)
      + `<rect x="262" y="56" width="124" height="198" rx="5" fill="${C.gold}" ${O()}/><rect x="270" y="64" width="108" height="176" rx="2" fill="#7A5CC8" ${T()}/>`
      + bookcase({ F: C.gold, books: [C.rose, C.mint, C.sky, C.pink, '#fff', C.gold], seed: 23 })
      + `<rect x="256" y="46" width="136" height="13" rx="5" fill="${C.gold}" ${O()}/>`
      + `<path d="M296 46C298 32 312 28 324 36C336 28 350 32 352 46Z" fill="${C.gold}" ${O()}/>` + star(324, 26, 12, '#FFE07A', O())
      + `<circle cx="296" cy="40" r="3.5" fill="${C.rose}" ${T()}/><circle cx="352" cy="40" r="3.5" fill="${C.sky}" ${T()}/>` + hl('M266 51H300', 2.5) + hl('M267 80V120', 2.5)
      + twinkle(286, 90, 4) + twinkle(372, 176, 4) + twinkle(394, 44, 5, C.gold) },

    // ---------------- library: the reading corner ----------------
    'library-chair': { bb: [146, 150, 252, 262], draw: () => shadow(200, 257, 50)
      + `<rect x="164" y="244" width="8" height="13" rx="2" fill="${C.woodD}" ${T()}/><rect x="228" y="244" width="8" height="13" rx="2" fill="${C.woodD}" ${T()}/>`
      + `<path d="M166 226V178C166 156 234 156 234 178V226Z" fill="${C.rose}" ${O()}/>` + hl('M174 180Q176 166 190 164')
      + `<circle cx="186" cy="186" r="2.4" fill="${C.berry}"/><circle cx="214" cy="186" r="2.4" fill="${C.berry}"/><circle cx="200" cy="200" r="2.4" fill="${C.berry}"/>`
      + `<rect x="160" y="230" width="80" height="18" rx="6" fill="${C.rose}" ${O()}/>`
      + `<rect x="166" y="212" width="68" height="22" rx="9" fill="${C.pink}" ${O()}/>`
      + `<rect x="152" y="196" width="24" height="48" rx="11" fill="${C.pink}" ${O()}/><rect x="224" y="196" width="24" height="48" rx="11" fill="${C.pink}" ${O()}/>` + hl('M158 204V218', 2.5)
      + heart(200, 206, 10, C.cream, T()) },
    'library-beanbag': { bb: [148, 176, 252, 262], draw: () => shadow(200, 257, 48)
      + `<path d="M154 256C148 238 158 220 176 214C190 209 210 209 224 214C242 220 250 238 246 256Z" fill="${C.mint}" ${O()}/>` + hl('M162 240Q164 228 174 221')
      + `<path d="M176 219Q200 231 224 219M206 248Q222 246 236 238" fill="none" stroke="${C.teal}" stroke-width="2.5" stroke-linecap="round"/>`
      + `<path d="M174 210L178 224Q189 219 200 225Q211 219 222 224L226 210Z" fill="${C.sky}" ${T()}/>`
      + `<path d="M178 207Q189 199 200 206Q211 199 222 207L221 220Q211 213 200 221Q189 213 179 220Z" fill="#fff" ${T()}/><path d="M200 206V221" stroke="${INK}" stroke-width="${f(1.6 * K)}"/>`
      + `<path d="M184 208Q190 205 196 208M184 213Q190 210 196 213M204 208Q210 205 216 208M204 213Q210 210 216 213" fill="none" stroke="${C.lilac}" stroke-width="1.6" stroke-linecap="round"/>`
      + heart(200, 190, 6, C.rose) + twinkle(170, 196, 4.5, C.gold) + twinkle(234, 200, 3.5, C.gold) },
    'library-globe': { bb: [154, 136, 250, 262], draw: () => shadow(200, 257, 30)
      + bar('M200 230L180 256M200 230L220 256M200 226V256', C.woodD, 4)
      + `<ellipse cx="200" cy="228" rx="9" ry="4" fill="${C.gold}" ${T()}/>`
      + `<circle cx="200" cy="184" r="32" fill="${C.sky}" ${O()}/>`
      + `<path d="M182 168C190 160 202 164 200 172C198 180 186 178 184 186C182 194 174 190 172 182C170 176 176 172 182 168Z" fill="${C.mint}" ${T()}/>`
      + `<path d="M206 190C214 184 226 188 224 198C222 208 212 212 206 206C202 202 200 194 206 190Z" fill="${C.mint}" ${T()}/><path d="M212 160C218 158 224 162 222 168C218 170 212 166 212 160Z" fill="${C.mint}" ${T()}/>`
      + hl('M180 170Q184 160 194 156')
      + bar('M178 154A38 38 0 0 1 222 214', C.gold, 4.5) + `<circle cx="178" cy="154" r="4" fill="${C.gold}" ${T()}/><circle cx="222" cy="214" r="4" fill="${C.gold}" ${T()}/>`
      + twinkle(232, 150, 5, C.gold) },
    'library-owl-lamp': { bb: [154, 124, 250, 262], draw: () => `<circle cx="200" cy="180" r="38" fill="#FFE9A0" opacity=".45"/>` + shadow(200, 257, 22)
      + `<ellipse cx="200" cy="254" rx="18" ry="5" fill="${C.wood}" ${T()}/><rect x="196" y="216" width="8" height="38" fill="${C.wood}" ${T()}/>`
      + `<ellipse cx="200" cy="214" rx="32" ry="7" fill="${C.wood}" ${O()}/>`
      + `<path d="M182 160L178 144L192 154ZM218 160L222 144L208 154Z" fill="#A27BD8" ${T()}/>`
      + `<path d="M200 152C222 152 226 180 224 194C222 206 212 211 200 211C188 211 178 206 176 194C174 180 178 152 200 152Z" fill="#A27BD8" ${O()}/>`
      + `<ellipse cx="200" cy="194" rx="14" ry="14" fill="#FFE9A0" ${T()}/>`
      + `<path d="M194 188q3 3 6 0M200 194q3 3 6 0M194 200q3 3 6 0" fill="none" stroke="${C.amber}" stroke-width="2" stroke-linecap="round"/>`
      + `<circle cx="191" cy="172" r="8" fill="#fff" ${T()}/><circle cx="209" cy="172" r="8" fill="#fff" ${T()}/><circle cx="192" cy="173" r="4" fill="${INK}"/><circle cx="208" cy="173" r="4" fill="${INK}"/><circle cx="193.5" cy="171" r="1.5" fill="#fff"/><circle cx="209.5" cy="171" r="1.5" fill="#fff"/>`
      + `<path d="M196 180L200 186L204 180Z" fill="${C.amber}" ${T()}/>` + hl('M182 172Q182 162 190 158', 2.5)
      + `<path d="M192 211v4M208 211v4" stroke="${C.amber}" stroke-width="3" stroke-linecap="round"/>` + twinkle(230, 150, 5, C.gold) + twinkle(168, 160, 4, C.gold) },

    // ---------------- ballroom: the chandelier ----------------
    'ballroom-chandelier-crystal': { bb: [176, 4, 324, 128], draw: () => { const cups = [[196, 66], [222, 56], [278, 56], [304, 66]];
      return chainTo(46)
        + cups.map(([x, y]) => `<circle cx="${x}" cy="${y - 20}" r="9" fill="#FFE9A0" opacity=".6"/>`).join('')
        + bar('M244 76C226 90 198 86 196 66M246 72C238 76 224 70 222 56M256 76C274 90 302 86 304 66M254 72C262 76 276 70 278 56', C.gold, 4)
        + `<path d="M196 70Q223 96 250 86Q277 96 304 70" fill="none" stroke="${INK}" stroke-width="${f(1.2 * K)}"/><path d="M196 70Q223 96 250 86Q277 96 304 70" fill="none" stroke="#fff" stroke-width="${f(3.6 * Math.max(1, K * 0.7))}" stroke-dasharray="0.1 ${f(6 * Math.max(1, K * 0.7))}" stroke-linecap="round"/>`
        + cups.map(([x, y]) => `<rect x="${x - 3.5}" y="${y - 15}" width="7" height="14" rx="2" fill="${C.cream}" ${T()}/><path d="M${x} ${y - 27}C${x + 5} ${y - 21} ${x + 4} ${y - 17} ${x} ${y - 17}C${x - 4} ${y - 17} ${x - 5} ${y - 21} ${x} ${y - 27}Z" fill="${C.gold}" ${T()}/><ellipse cx="${x}" cy="${y}" rx="8" ry="3.5" fill="${C.gold}" ${T()}/>` + drop(x, y + 3, 0.9)).join('')
        + `<path d="M224 62Q250 102 276 62Z" fill="${C.gold}" ${O()}/><rect x="242" y="42" width="16" height="22" rx="6" fill="${C.gold}" ${O()}/>` + hl('M232 68Q238 78 246 80', 2.5)
        + drop(250, 82, 1.4, C.lav) + twinkle(186, 38, 5, C.gold) + twinkle(316, 40, 5, C.gold) + twinkle(262, 120, 4); } },
    'ballroom-chandelier-flowers': { bb: [176, 4, 324, 132], draw: () => { const yb = x => 66 + 14 * Math.sqrt(Math.max(0, 1 - ((x - 250) / 58) ** 2));
      const strands = [[206, 24, C.pink], [228, 36, C.gold], [250, 46, C.lilac], [272, 36, C.rose], [294, 24, C.sky]];
      return chainTo(28) + `<path d="M246 26L240 20L240 32ZM254 26L260 20L260 32Z" fill="${C.pink}" ${T()}/>`
        + bar('M192 66A58 14 0 0 1 308 66', C.teal, 5)
        + bar('M250 28L196 64M250 28L228 54M250 28L272 54M250 28L304 64', C.pink, 2)
        + strands.map(([x, l]) => bar(`M${x} ${f(yb(x))}V${f(yb(x) + l)}`, C.teal, 2.5)).join('')
        + strands.map(([x, l]) => `<ellipse cx="${x + 4}" cy="${f(yb(x) + l * 0.45)}" rx="4.5" ry="2.4" fill="${C.mint}" transform="rotate(-30 ${x + 4} ${f(yb(x) + l * 0.45)})" ${sw(1.4)}/>`).join('')
        + strands.map(([x, l, c]) => flower(x, yb(x) + l + 4, 8, c)).join('')
        + bar('M192 66A58 14 0 0 0 308 66', C.mint, 5)
        + [[196, C.pink], [214, C.gold], [234, C.lilac], [256, C.rose], [276, C.sky], [296, C.pink]].map(([x, c], i) => flower(x, yb(x) - 2 + (i % 2) * 2, 8.5, c)).join('')
        + twinkle(186, 40, 5, C.gold) + twinkle(316, 44, 5, C.gold) + twinkle(250, 128, 4, C.gold); } },
    'ballroom-chandelier-stars': { bb: [176, 4, 324, 132], draw: () => { const ys = [[206, 92, 9, C.pink], [226, 112, 10, C.gold], [274, 112, 10, C.sky], [294, 92, 9, C.lilac]];
      return chainTo(40) + bar('M198 52A52 11 0 0 1 302 52', C.gold, 4)
        + ys.map(([x, y]) => `<path d="M${x} ${f(52 + 11 * Math.sqrt(Math.max(0, 1 - ((x - 250) / 52) ** 2)))}V${y - 6}" stroke="${INK}" stroke-width="${f(1.4 * K)}"/>`).join('')
        + `<path d="M250 63V70" stroke="${INK}" stroke-width="${f(1.4 * K)}"/>`
        + bar('M198 52A52 11 0 0 0 302 52', C.gold, 4)
        + ys.map(([x, y, r, c]) => star(x, y, r * 1.4, c, T())).join('')
        + moon(250, 92, 22, '#FFE07A', O()) + `<path d="M242 90Q246 94 250 90" fill="none" stroke="${INK}" stroke-width="${f(2.2 * K)}" stroke-linecap="round"/><ellipse cx="244" cy="98" rx="3" ry="2" fill="${C.pink}" opacity=".7"/>`
        + [[210, 52], [236, 41], [264, 41], [290, 52]].map(([x, y]) => star(x, y, 4.5, '#fff')).join('')
        + twinkle(186, 72, 5, C.gold) + twinkle(316, 70, 5, C.gold) + twinkle(250, 126, 4.5) + twinkle(214, 118, 3.5); } },
    'ballroom-chandelier-gems': { bb: [176, 4, 324, 132], draw: () => { const yb = x => 74 + 12 * Math.sqrt(Math.max(0, 1 - ((x - 250) / 54) ** 2));
      const gs = [[204, 6, C.pink], [226, 12, C.sky], [274, 12, C.mint], [296, 6, C.lilac]];
      return chainTo(38) + bar('M196 74A54 12 0 0 1 304 74', C.gold, 4)
        + bar('M232 46L198 74M268 46L302 74M250 50V96', C.gold, 3)
        + `<ellipse cx="250" cy="44" rx="22" ry="6" fill="none" stroke="${INK}" stroke-width="${f(4 + 3 * K)}"/><ellipse cx="250" cy="44" rx="22" ry="6" fill="none" stroke="${C.gold}" stroke-width="4"/>`
        + gs.map(([x, l]) => `<path d="M${x} ${f(yb(x))}V${f(yb(x) + l)}" stroke="${INK}" stroke-width="${f(1.4 * K)}"/>`).join('')
        + bar('M196 74A54 12 0 0 0 304 74', C.gold, 4)
        + gs.map(([x, l, c]) => gemAt(x, yb(x) + l, 0.75, c)).join('') + gemAt(250, 94, 1.1, C.pink)
        + gemAt(250, 30, 0.5, C.gold) + [[214, 86], [286, 86], [240, 64], [260, 64]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${C.sky}" ${T()}/>`).join('')
        + twinkle(244, 100, 3.5) + twinkle(208, 98, 3) + twinkle(186, 46, 5, C.gold) + twinkle(316, 50, 5, C.gold) + twinkle(270, 128, 4, C.gold); } },

    // ---------------- ballroom: the small piece ----------------
    'ballroom-piano': { bb: [274, 116, 398, 262], draw: () => shadow(336, 257, 58)
      + `<rect x="292" y="238" width="10" height="19" rx="3" fill="${C.rose}" ${T()}/><rect x="370" y="238" width="10" height="19" rx="3" fill="${C.rose}" ${T()}/>`
      + `<rect x="288" y="158" width="96" height="84" rx="7" fill="${C.pink}" ${O()}/><rect x="282" y="150" width="108" height="12" rx="5" fill="${C.rose}" ${O()}/>`
      + `<rect x="298" y="168" width="76" height="26" rx="7" fill="${C.blush}" ${T()}/>`
      + `<path d="M318 170H354L352 192H320Z" fill="#fff" ${T()}/>`
      + [[326, 184], [338, 180], [348, 186]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="2.3" fill="${INK}"/><path d="M${x + 2.6} ${y}V${y - 9}" stroke="${INK}" stroke-width="1.6"/>`).join('')
      + `<rect x="280" y="204" width="112" height="14" rx="4" fill="${C.rose}" ${O()}/><rect x="286" y="198" width="100" height="9" rx="2" fill="#fff" ${T()}/>`
      + Array.from({ length: 13 }, (_, i) => `<path d="M${f(293.7 + i * 7.7)} 198V207" stroke="${INK}" stroke-width="1" opacity=".5"/>`).join('')
      + [0, 1, 3, 4, 5, 7, 8, 10, 11].map(i => `<rect x="${f(291.5 + i * 7.7)}" y="198" width="4.4" height="5" rx="1" fill="${INK}"/>`).join('')
      + `<rect x="298" y="222" width="76" height="16" rx="5" fill="${C.blush}" ${T()}/>` + heart(336, 230, 5, C.rose)
      + hl('M294 168V196', 3)
      + `<path d="M300 150C298 140 300 134 306 134C312 134 314 140 312 150Z" fill="${C.sky}" ${T()}/>` + flower(306, 126, 8, C.gold, C.rose)
      + `<g opacity=".9"><ellipse cx="362" cy="134" rx="4" ry="3" fill="${C.berry}"/><path d="M365.5 134V120L372 123" fill="none" stroke="${C.berry}" stroke-width="2" stroke-linecap="round"/></g>` + twinkle(384, 128, 4.5, C.gold) },
    'ballroom-harp': { bb: [284, 90, 396, 262], draw: () => {
      const ny = x => 112 + 10 * Math.sin((x - 304) / 76 * Math.PI * 2);
      const neck = Array.from({ length: 21 }, (_, i) => { const x = 304 + i * 3.8; return `${i ? 'L' : 'M'}${f(x)} ${f(ny(x))}`; }).join('');
      const strings = [];
      for (let x = 318; x <= 368; x += 6.5) { const yb = x < 344 ? 244 : 250 - 128 * (x - 344) / 36; strings.push(bar(`M${f(x)} ${f(ny(x) + 4)}V${f(yb)}`, [C.pink, C.lilac, C.sky][Math.round((x - 318) / 6.5) % 3], 2)); }
      return shadow(336, 257, 50)
        + strings.join('')
        + `<path d="M340 250L370 250L384 114L374 110Z" fill="${C.gold}" ${O()}/>` + heart(368, 210, 5, C.rose)
        + bar(neck, C.gold, 8)
        + `<rect x="298" y="112" width="12" height="136" rx="5" fill="${C.gold}" ${O()}/>` + hl('M302 124V200', 2.5)
        + `<rect x="292" y="244" width="94" height="13" rx="5" fill="${C.amber}" ${O()}/>`
        + `<circle cx="304" cy="106" r="7" fill="${C.gold}" ${O()}/>` + `<path d="M304 108L294 100L294 114ZM304 108L314 100L314 114Z" fill="${C.pink}" ${T()}/><circle cx="304" cy="108" r="3" fill="${C.rose}" ${T()}/>`
        + twinkle(332, 98, 5, C.gold) + twinkle(392, 150, 4.5, C.gold) + `<g opacity=".9"><ellipse cx="290" cy="150" rx="4" ry="3" fill="${C.berry}"/><path d="M293.5 150V136" stroke="${C.berry}" stroke-width="2" stroke-linecap="round"/></g>`; } },
    'ballroom-cake': { bb: [276, 96, 398, 262], draw: () => {
      const drip = (x0, x1, y, col, n) => { const w = (x1 - x0) / n; let d = `M${x0} ${y - 2}H${x1}V${y + 4}`; for (let i = n - 1; i >= 0; i--) { const xa = x0 + i * w; d += `Q${f(xa + w * 0.75)} ${y + (i % 2 ? 6 : 12)} ${f(xa + w / 2)} ${y + 4}Q${f(xa + w * 0.25)} ${y + 2} ${f(xa)} ${y + 4}`; } return `<path d="${d}Z" fill="${col}" ${T()}/>`; };
      const sprinkles = (x0, x1, y, seed) => { const r = rng(seed); let s = ''; for (let i = 0; i < 6; i++) { const x = x0 + 6 + r() * (x1 - x0 - 12), yy = y + r() * 10, a = r() * 180; s += `<rect x="${f(x)}" y="${f(yy)}" width="5" height="2" rx="1" fill="${[C.rose, C.sky, C.gold, C.mint][i % 4]}" transform="rotate(${f(a)} ${f(x)} ${f(yy)})"/>`; } return s; };
      return shadow(336, 257, 52)
        + `<path d="M288 214H384L390 250${scallops(390, 282, 250, 6, 8)}Z" fill="${C.blush}" ${O()}/>`
        + `<ellipse cx="336" cy="214" rx="50" ry="7" fill="${C.pink}" ${O()}/>` + hl('M294 222L291 240', 2.5)
        + `<ellipse cx="336" cy="210" rx="38" ry="5" fill="${C.gold}" ${T()}/>`
        + `<rect x="304" y="180" width="64" height="30" rx="5" fill="${C.cream}" ${O()}/>` + drip(304, 368, 182, C.pink, 6) + sprinkles(304, 368, 192, 3)
        + `<rect x="313" y="154" width="46" height="27" rx="5" fill="${C.pink}" ${O()}/>` + drip(313, 359, 156, '#fff', 4) + sprinkles(313, 359, 164, 9)
        + `<rect x="322" y="132" width="28" height="23" rx="5" fill="${C.lilac}" ${O()}/>` + drip(322, 350, 134, C.cream, 3)
        + hl('M309 188V202', 2.5)
        + [[328, C.sky], [336, C.pink], [344, C.mint]].map(([x, c]) => `<rect x="${x - 2.5}" y="118" width="5" height="14" rx="1.5" fill="${c}" ${T()}/><path d="M${x} 104C${x + 4.5} 109 ${x + 4} 114 ${x} 114C${x - 4} 114 ${x - 4.5} 109 ${x} 104Z" fill="${C.gold}" ${T()}/>`).join('')
        + heart(336, 168, 5, C.rose) + twinkle(304, 116, 5, C.gold) + twinkle(372, 126, 4.5, C.gold); } },
    'ballroom-dragon-plush': { bb: [280, 120, 396, 262], draw: () => { const b = C.mint;
      return shadow(336, 258, 48) + ell(336, 248, 46, 12, C.lilac, O()) + ell(336, 245, 36, 7, C.lav)
        + `<path d="M360 236C380 238 390 226 388 212C382 218 376 216 378 208C370 220 364 226 352 226Z" fill="${b}" ${O()}/>`
        + `<path d="M314 198C296 186 292 168 300 160C304 174 314 180 322 186ZM358 198C376 186 380 168 372 160C368 174 358 180 350 186Z" fill="${C.lilac}" ${O()}/>`
        + `<ellipse cx="336" cy="222" rx="28" ry="24" fill="${b}" ${O()}/><ellipse cx="336" cy="228" rx="17" ry="16" fill="#E8FFF7"/>`
        + `<path d="M336 210V244" stroke="${C.teal}" stroke-width="${f(1.6 * K)}" stroke-dasharray="3 3"/>`
        + `<ellipse cx="320" cy="244" rx="9" ry="6" fill="${b}" ${T()}/><ellipse cx="352" cy="244" rx="9" ry="6" fill="${b}" ${T()}/>`
        + `<path d="M318 154L314 138L326 148ZM354 154L358 138L346 148Z" fill="${C.gold}" ${T()}/>`
        + `<ellipse cx="336" cy="176" rx="30" ry="26" fill="${b}" ${O()}/>` + hl('M314 168Q316 156 328 152')
        + `<ellipse cx="324" cy="174" rx="6" ry="7" fill="${INK}"/><ellipse cx="348" cy="174" rx="6" ry="7" fill="${INK}"/><circle cx="326" cy="171" r="2.4" fill="#fff"/><circle cx="350" cy="171" r="2.4" fill="#fff"/>`
        + `<ellipse cx="336" cy="190" rx="12" ry="7" fill="#B8F2E2" ${T()}/><circle cx="332" cy="189" r="1.6" fill="${INK}"/><circle cx="340" cy="189" r="1.6" fill="${INK}"/>`
        + `<ellipse cx="315" cy="186" rx="5" ry="3" fill="${C.pink}" opacity=".7"/><ellipse cx="357" cy="186" rx="5" ry="3" fill="${C.pink}" opacity=".7"/>`
        + `<path d="M314 212C302 216 302 228 310 230M358 212C370 216 370 228 362 230" fill="none" stroke="${INK}" stroke-width="${f(9 + 3 * K)}" stroke-linecap="round"/><path d="M314 212C302 216 302 228 310 230M358 212C370 216 370 228 362 230" fill="none" stroke="${b}" stroke-width="9" stroke-linecap="round"/>`
        + gemAt(336, 218, 0.55, C.pink) + twinkle(300, 140, 5, C.gold) + twinkle(378, 150, 4, C.gold); } },
  };

  // ---- the catalogue ----
  const ROOMS = {
    bedroom: { name: 'Bedroom', slots: {
      wall: ['bedroom-wall-stars', 'bedroom-wall-hearts', 'bedroom-wall-rainbow'],
      big: ['bedroom-bed-pink', 'bedroom-bed-canopy', 'bedroom-bed-cloud', 'bedroom-bed-stars'],
      rug: ['bedroom-rug-round', 'bedroom-rug-heart', 'bedroom-rug-flower', 'bedroom-rug-garden'],
      small: ['bedroom-lamp', 'bedroom-toybox', 'bedroom-petbed', 'bedroom-moon-lamp'] } },
    library: { name: 'Library', slots: {
      wall: ['library-wall-stripes', 'library-wall-moons', 'library-wall-leaves'],
      big: ['library-shelf-wood', 'library-shelf-rainbow', 'library-shelf-castle', 'library-shelf-golden'],
      rug: ['library-rug-oval', 'library-rug-alphabet', 'library-rug-starry'],
      small: ['library-chair', 'library-beanbag', 'library-globe', 'library-owl-lamp'] } },
    ballroom: { name: 'Ballroom', slots: {
      wall: ['ballroom-wall-gold', 'ballroom-wall-swirls', 'ballroom-wall-mirrors'],
      big: ['ballroom-chandelier-crystal', 'ballroom-chandelier-flowers', 'ballroom-chandelier-stars', 'ballroom-chandelier-gems'],
      rug: ['ballroom-floor-checks', 'ballroom-floor-hearts', 'ballroom-floor-rainbow', 'ballroom-floor-crystal'],
      small: ['ballroom-piano', 'ballroom-harp', 'ballroom-cake', 'ballroom-dragon-plush'] } },
  };
  const it = (room, slot, name, price, extra) => Object.assign({ room, slot, name, price }, extra || {});
  const gift = (room, slot, name, from) => it(room, slot, name, 0, from ? { gift: true, from } : { gift: true });
  const ITEMS = {
    'bedroom-wall-stars': it('bedroom', 'wall', 'Twinkle star wallpaper', 0),
    'bedroom-wall-hearts': it('bedroom', 'wall', 'Sweetheart wallpaper', 20),
    'bedroom-wall-rainbow': it('bedroom', 'wall', 'Rainbow cloud wallpaper', 30),
    'bedroom-bed-pink': it('bedroom', 'big', 'Pink princess bed', 0),
    'bedroom-bed-canopy': it('bedroom', 'big', 'Canopy dream bed', 60),
    'bedroom-bed-cloud': it('bedroom', 'big', 'Fluffy cloud bed', 75),
    'bedroom-bed-stars': gift('bedroom', 'big', 'Starry night bed'),
    'bedroom-rug-round': it('bedroom', 'rug', 'Cozy round rug', 0),
    'bedroom-rug-heart': it('bedroom', 'rug', 'Sweetheart rug', 20),
    'bedroom-rug-flower': it('bedroom', 'rug', 'Flower petal rug', 25),
    'bedroom-rug-garden': gift('bedroom', 'rug', 'Flower garden rug', 'Bloom'),
    'bedroom-lamp': it('bedroom', 'small', 'Bedside lamp', 0),
    'bedroom-toybox': it('bedroom', 'small', 'Toy chest', 25),
    'bedroom-petbed': it('bedroom', 'small', 'Unicorn plush bed', 35),
    'bedroom-moon-lamp': gift('bedroom', 'small', 'Crescent moon lamp'),
    'library-wall-stripes': it('library', 'wall', 'Minty stripes', 0),
    'library-wall-moons': it('library', 'wall', 'Moon and star wallpaper', 25),
    'library-wall-leaves': it('library', 'wall', 'Leafy vine wallpaper', 25),
    'library-shelf-wood': it('library', 'big', 'Cozy bookshelf', 0),
    'library-shelf-rainbow': it('library', 'big', 'Rainbow bookshelf', 50),
    'library-shelf-castle': it('library', 'big', 'Castle bookshelf', 70),
    'library-shelf-golden': gift('library', 'big', 'Golden bookshelf', 'Professor Hoot'),
    'library-rug-oval': it('library', 'rug', 'Oval reading rug', 0),
    'library-rug-alphabet': it('library', 'rug', 'Building block rug', 20),
    'library-rug-starry': it('library', 'rug', 'Starry night rug', 30),
    'library-chair': it('library', 'small', 'Comfy armchair', 0),
    'library-beanbag': it('library', 'small', 'Squishy beanbag', 25),
    'library-globe': it('library', 'small', 'Spinning globe', 35),
    'library-owl-lamp': gift('library', 'small', 'Owl lamp'),
    'ballroom-wall-gold': it('ballroom', 'wall', 'Golden lattice wallpaper', 0),
    'ballroom-wall-swirls': it('ballroom', 'wall', 'Sugar swirl wallpaper', 25),
    'ballroom-wall-mirrors': it('ballroom', 'wall', 'Hall of mirrors', 30),
    'ballroom-chandelier-crystal': it('ballroom', 'big', 'Crystal chandelier', 0),
    'ballroom-chandelier-flowers': it('ballroom', 'big', 'Flower chandelier', 55),
    'ballroom-chandelier-stars': it('ballroom', 'big', 'Moon and stars chandelier', 75),
    'ballroom-chandelier-gems': gift('ballroom', 'big', 'Gem chandelier', 'Pebble the dragon'),
    'ballroom-floor-checks': it('ballroom', 'rug', 'Checkered dance floor', 0),
    'ballroom-floor-hearts': it('ballroom', 'rug', 'Heart dance floor', 25),
    'ballroom-floor-rainbow': it('ballroom', 'rug', 'Rainbow dance floor', 30),
    'ballroom-floor-crystal': gift('ballroom', 'rug', 'Crystal dance floor', 'Gemma'),
    'ballroom-piano': it('ballroom', 'small', 'Pink piano', 0),
    'ballroom-harp': it('ballroom', 'small', 'Golden harp', 35),
    'ballroom-cake': it('ballroom', 'small', 'Big party cake', 40),
    'ballroom-dragon-plush': gift('ballroom', 'small', 'Dragon plush'),
  };
  const STARTER = {};
  for (const r in ROOMS) { STARTER[r] = {}; for (const s in ROOMS[r].slots) STARTER[r][s] = ROOMS[r].slots[s][0]; }

  // ---- a whole room ----
  const RUG_AT = { bedroom: [236, 268, 104, 26], library: [226, 270, 100, 24] };
  function draw(room, chosen = {}, opt = {}) {
    const R = ROOMS[room]; if (!R) return '';
    K = 1;
    const pick = slot => { const id = chosen && chosen[slot]; return id && ITEMS[id] && ITEMS[id].room === room && ITEMS[id].slot === slot ? id : STARTER[room][slot]; };
    const ids = { wall: pick('wall'), big: pick('big'), rug: pick('rug'), small: pick('small') };
    const clip = uid('clip'), pat = uid('wall'), fsh = uid('fsh'), wp = WALLS[ids.wall], [trim, trimL] = TRIM[room];
    const floor = room === 'ballroom' ? DANCE[ids.rug].draw(ROOMQ) : planks(ROOMQ, FLOOR[room][0], FLOOR[room][1]);
    const body = `<defs><clipPath id="${clip}"><rect width="400" height="300" rx="18"/></clipPath>${pattern(pat, wp, wp.ox || 0, wp.oy || 0, 1)}
      <linearGradient id="${fsh}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${INK}" stop-opacity=".16"/><stop offset="1" stop-color="${INK}" stop-opacity="0"/></linearGradient></defs>
      <g clip-path="url(#${clip})"><rect width="400" height="192" fill="url(#${pat})"/>
      ${WINDOWS[room]()}
      ${floor}
      <rect y="191" width="400" height="40" fill="url(#${fsh})"/>
      ${room === 'ballroom' ? '' : RUGS[ids.rug](...RUG_AT[room])}
      <rect x="-4" y="-4" width="408" height="14" fill="${trim}" ${O()}/><path d="M0 6H400" stroke="${trimL}" stroke-width="2"/>
      <rect x="-4" y="179" width="408" height="13" fill="${trim}" ${O()}/><path d="M0 183H400" stroke="${trimL}" stroke-width="2"/>
      ${ART[ids.big].draw()}${ART[ids.small].draw()}</g>
      <rect x="1.5" y="1.5" width="397" height="297" rx="17" fill="none" ${O()}/>`;
    const label = opt.label || `${R.name} with the ${['wall', 'big', 'rug', 'small'].map(s => ITEMS[ids[s]].name.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1')}`;
    return svg('0 0 400 300', body, label);
  }

  // ---- one piece alone, for a shop card ----
  function piece(id) {
    const item = ITEMS[id]; if (!item) return '';
    let body = '';
    try {
      if (item.slot === 'wall') {
        K = 1; const wp = WALLS[id], p = uid('swatch'), s = wp.cs;
        body = `<defs>${pattern(p, wp, wp.cox != null ? wp.cox : 18, wp.coy != null ? wp.coy : 18, s)}</defs>
          <rect x="9" y="9" width="82" height="82" rx="12" fill="${TRIM[item.room][0] === '#fff' ? C.pink : TRIM[item.room][0]}" ${O()}/>
          <rect x="18" y="18" width="64" height="64" rx="5" fill="url(#${p})" ${T()}/>
          ${hl('M14 30V18Q14 14 18 14H30', 2.5)}${twinkle(88, 12, 7, C.gold)}`;
      } else if (item.slot === 'rug' && item.room !== 'ballroom') {
        K = 1; body = RUGS[id](50, 54, 43, 28) + twinkle(86, 20, 6, C.gold);
      } else if (item.slot === 'rug') {
        K = 1; const q = { bl: [20, 30], br: [80, 30], fl: [5, 76], fr: [95, 76] }, cl = uid('tile'), d = DANCE[id];
        body = `<defs><clipPath id="${cl}"><path d="${quadD(q)}"/></clipPath></defs>
          <path d="M5 76H95V84H5Z" fill="${d.edge}" ${O()}/>
          <g clip-path="url(#${cl})">${d.draw(q)}</g>
          <path d="${quadD(q)}" fill="none" ${O()}/>${twinkle(88, 18, 6, C.gold)}`;
      } else {
        const [x0, y0, x1, y1] = ART[id].bb, w = x1 - x0, h = y1 - y0, s = Math.min(84 / w, 84 / h);
        K = 0.95 / s;
        const tx = 50 - (x0 + w / 2) * s, ty = 50 - (y0 + h / 2) * s;
        body = `<g transform="translate(${f(tx)} ${f(ty)}) scale(${+s.toFixed(4)})">${ART[id].draw()}</g>`;
      }
    } finally { K = 1; }
    return svg('0 0 100 100', body, item.name);
  }

  root.SparkleRooms = { ROOMS, ITEMS, STARTER, draw, piece };
})(typeof window !== 'undefined' ? window : globalThis);
