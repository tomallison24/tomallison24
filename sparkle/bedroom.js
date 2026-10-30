'use strict';

// Her bedroom, drawn in code as SVG, as a room she decorates freely: an empty room (a wallpaper and
// a floor she picks) and the things she puts in it wherever she likes - beds, lamps, toys, rugs,
// pictures for the walls - bought with the coins she earns, or given by a friend at the end of a
// chapter (never sold). Tapping a thing makes it do something (act): a lamp lights up, the curtains
// close, the music box plays, the bed tucks her in. The look matches art.js and rooms.js: soft
// rounded shapes, a deep plum outline (never black), flat pastel colour with one gentle highlight,
// and twinkles. No words, letters or numbers anywhere.
//
// The room is 400 wide by 300 tall, seen from a little above: the back wall above FLOOR_Y (200),
// with a baseboard along its foot, and the floor a band below it. Things are drawn alone, each in
// its own w by h box (room units; she is about 110 tall), and placed over the room by the app:
//   place 'floor'  stands on the floor, its feet on the bottom edge of its box
//   place 'rug'    lies flat on the floor, always drawn under the others
//   place 'wall'   hangs on the wall
//
//   SparkleBedroom.FLOOR_Y   200
//   SparkleBedroom.WALLS     { id: { name, price, gift? } }   (wallpapers)
//   SparkleBedroom.FLOORS    { id: { name, price } }
//   SparkleBedroom.ITEMS     { id: { name, price, gift?, from?, place, w, h, act, pillow? } }
//                            act: what tapping it does (sleep, light, curtain, music, chest, dress,
//                            books, grow, squeak, swim, stars, rock, sparkle, none); a bed's pillow
//                            { x, y, s } is where her sleeping head goes, in the bed's own box: the
//                            face's centre, and s the width of A.princess(look, wear, { head: true })
//   SparkleBedroom.STARTER   { wall, floor, items: [{ id, x, y }] } x is the centre; y the bottom
//                            (floor and rug things) or the centre (wall things), in room units
//   SparkleBedroom.room(wallId, floorId, opt)   the empty room, <svg viewBox="0 0 400 300">;
//                            opt.night tints it for night time
//   SparkleBedroom.item(id, opt)   one thing alone filling its box, <svg viewBox="0 0 w h">;
//                            opt.on draws it doing its thing (lit, closed, open, playing, in bloom,
//                            tucked in), opt.sleeper (an svg, her head) sleeps in a bed that is on,
//                            opt.night tints it like the room at night (its light still shines)
//   SparkleBedroom.piece(id) a thing, wallpaper or floor on a square shop card, <svg viewBox="0 0 100 100">
//
// Gradients, patterns and filters get their own ids (uid) so many pictures can share a page.
(function (root) {
  let n = 0;
  const uid = p => `sb${p}${++n}`;
  const INK = '#4B2E6F';
  const C = {
    pink: '#FF8FC7', blush: '#FFB3DA', rose: '#FF5FA8', lilac: '#B79BFF', lav: '#D9CCFF', mint: '#7FE0C7', sky: '#8FD3FF',
    gold: '#FFC94A', amber: '#F5A623', cream: '#FFF6E9', white: '#FFFFFF', peach: '#FFC7A8', coral: '#FF8A7A', berry: '#C04B9A', teal: '#4FC3B8',
    wood: '#E9B872', woodD: '#C98B5E', violet: '#9C7DF0', glass: '#CFEAFF', warm: '#FFE9A0',
  };
  const FLOOR_Y = 200;

  // Outline widths are multiplied by K: 1 in the room, more when a thing is shrunk onto a card, so
  // the outline looks the same thickness everywhere.
  let K = 1;
  const f = v => +(+v).toFixed(1);
  const sw = w => `stroke="${INK}" stroke-width="${f(w * K)}" stroke-linejoin="round" stroke-linecap="round"`;
  const O = () => sw(3), T = () => sw(2), S = () => sw(1.5);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const shade = (hex, k) => { const v = parseInt(hex.slice(1), 16); const r = v >> 16, g = (v >> 8) & 255, b = v & 255;
    const h = x => Math.max(0, Math.min(255, Math.round(k < 0 ? x * (1 + k) : x + (255 - x) * k)));
    return '#' + [h(r), h(g), h(b)].map(x => x.toString(16).padStart(2, '0')).join(''); };

  // ---- light at night ----
  // At night a picture is drawn through a soft navy-lilac filter; whatever is passed to bright()
  // (a lamp's glow, a lit window) is drawn outside it, so it still shines. fit() groups are closed
  // and reopened around it, so bright() works inside them too.
  let NF = null; const OPEN = [];
  const nightDef = id => `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.36 0.08 0.10 0 0.03  0.07 0.29 0.13 0 0.04  0.12 0.12 0.56 0 0.13  0 0 0 1 0"/></filter>`;
  const bright = s => { if (!NF) return s;
    const tf = OPEN.join(' ');
    return '</g>'.repeat(OPEN.length + 1) + (tf ? `<g transform="${tf}">${s}</g>` : s) + `<g filter="url(#${NF})">` + OPEN.map(t => `<g transform="${t}">`).join(''); };
  // draws fn() (made in other units) scaled by s, so (x0, y0) lands on (0, 0); outlines stay the same width
  const fit = (x0, y0, s, fn) => { const t = `scale(${s}) translate(${-x0} ${-y0})`, k0 = K; OPEN.push(t); K = K / s;
    try { return `<g transform="${t}">${fn()}</g>`; } finally { K = k0; OPEN.pop(); } };
  const glow = (cx, cy, r, col = C.warm, op = 0.8) => { const g = uid('glow');
    return `<defs><radialGradient id="${g}"><stop offset="0" stop-color="${col}" stop-opacity="${op}"/><stop offset=".5" stop-color="${col}" stop-opacity="${f(op * 0.4)}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient></defs><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="url(#${g})"/>`; };

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
  // a coloured line with an outline (rods, poles, stems, strings)
  const bar = (d, col, w) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f(w + 3 * K)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const line = (d, col, w, op = 1) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"${op < 1 ? ` opacity="${op}"` : ''}/>`;
  // shapes merged under one outline (clouds, puffs): [x, y, r] circles and [x, y, w, h, rx] rects
  const blob = (shapes, fill) => {
    const one = (s, g, col) => s.length === 3 ? `<circle cx="${f(s[0])}" cy="${f(s[1])}" r="${f(s[2] + g)}" fill="${col}"/>`
      : `<rect x="${f(s[0] - g)}" y="${f(s[1] - g)}" width="${f(s[2] + 2 * g)}" height="${f(s[3] + 2 * g)}" rx="${f((s[4] || 0) + g)}" fill="${col}"/>`;
    return shapes.map(s => one(s, 1.5 * K, INK)).join('') + shapes.map(s => one(s, 0, fill)).join('');
  };
  const ell = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" ${extra}/>`;
  const flower = (x, y, r, col, mid = C.gold) => [0, 72, 144, 216, 288].map(a => `<circle cx="${f(x + r * 0.6 * Math.cos((a - 90) * Math.PI / 180))}" cy="${f(y + r * 0.6 * Math.sin((a - 90) * Math.PI / 180))}" r="${f(r * 0.52)}" fill="${col}" ${S()}/>`).join('') + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.4)}" fill="${mid}" ${S()}/>`;
  const note = (x, y, s = 1, col = C.berry) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(3 * s)}" ry="${f(2.3 * s)}" fill="${col}" transform="rotate(-20 ${f(x)} ${f(y)})"/><path d="M${f(x + 2.6 * s)} ${f(y - 0.5 * s)}V${f(y - 10 * s)}l${f(5 * s)} ${f(2.5 * s)}" fill="none" stroke="${col}" stroke-width="${f(1.8 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const happyEye = (x, y, s = 1) => `<path d="M${f(x - 2.4 * s)} ${f(y + 0.8 * s)}Q${f(x)} ${f(y - 2.2 * s)} ${f(x + 2.4 * s)} ${f(y + 0.8 * s)}" fill="none" stroke="${INK}" stroke-width="${f(1.7 * s * Math.max(1, K * 0.8))}" stroke-linecap="round"/>`;
  const sleepEye = (x, y, s = 1) => `<path d="M${f(x - 2.4 * s)} ${f(y - 0.6 * s)}Q${f(x)} ${f(y + 2 * s)} ${f(x + 2.4 * s)} ${f(y - 0.6 * s)}" fill="none" stroke="${INK}" stroke-width="${f(1.6 * s * Math.max(1, K * 0.8))}" stroke-linecap="round"/>`;
  const dotEye = (x, y, r = 1.7) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${INK}"/><circle cx="${f(x + r * 0.35)}" cy="${f(y - r * 0.4)}" r="${f(r * 0.38)}" fill="#fff"/>`;
  const blush = (x, y, r = 2.6) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(r * 0.62)}" fill="${C.pink}" opacity=".7"/>`;
  const rng = seed => { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
  const scallops = (x0, x1, y, k, depth = 9) => { const w = Math.abs(x1 - x0) / k; let s = ''; for (let i = 0; i < k; i++) s += `q${f(-w / 2)} ${depth} ${f(-w)} 0`; return s; };
  // a little unicorn head facing right, centred on (x, y); st is its outline
  const uniHead = (x, y, s, st, mane = [C.pink, C.lilac, C.sky]) => { const P = (u, v) => `${f(x + u * s)} ${f(y + v * s)}`;
    return `<path d="M${P(-6, 2)}L${P(-9, 17)}H${P(5, 17)}L${P(4, 6)}Z" fill="#fff" ${st}/>`
      + `<path d="M${P(-3, -6)}L${P(-5, -14)}L${P(1, -8)}Z" fill="#fff" ${st}/><path d="M${P(1, -8)}L${P(8, -19)}L${P(5, -6)}Z" fill="${C.gold}" ${st}/>`
      + `<path d="M${P(-7, -5)}C${P(0, -11)} ${P(11, -6)} ${P(12, 2)}C${P(13, 8)} ${P(6, 9)} ${P(2, 7)}C${P(-3, 5)} ${P(-8, 1)} ${P(-7, -5)}Z" fill="#fff" ${st}/>`
      + `<ellipse cx="${f(x + 8.5 * s)}" cy="${f(y + 4 * s)}" rx="${f(4.2 * s)}" ry="${f(3.4 * s)}" fill="${C.blush}"/>`
      + `<path d="M${P(-1, -1.5)}Q${P(1.5, -4.5)} ${P(4, -1.5)}" fill="none" stroke="${INK}" stroke-width="${f(1.5 * s)}" stroke-linecap="round"/>`
      + [[-7, -5, 4.5], [-9, 2, 4], [-9, 9, 3.6]].map(([u, v, r], i) => `<circle cx="${f(x + u * s)}" cy="${f(y + v * s)}" r="${f(r * s)}" fill="${mane[i]}" ${st}/>`).join(''); };

  // ---- the floor in perspective ----
  // A quad (back-left, back-right, front-left, front-right); fp gives the point s across and d deep.
  const FQ = { bl: [-20, FLOOR_Y], br: [420, FLOOR_Y], fl: [-190, 300], fr: [590, 300] };
  const ratio = q => (q.fr[0] - q.fl[0]) / (q.br[0] - q.bl[0]);
  const persp = (t, r) => t / (r - t * (r - 1));
  const fp = (q, s, d) => { const bx = q.bl[0] + (q.br[0] - q.bl[0]) * s, by = q.bl[1] + (q.br[1] - q.bl[1]) * s;
    const fx = q.fl[0] + (q.fr[0] - q.fl[0]) * s, fy = q.fl[1] + (q.fr[1] - q.fl[1]) * s; return [bx + (fx - bx) * d, by + (fy - by) * d]; };
  const pt = p => `${f(p[0])} ${f(p[1])}`;
  const quadD = q => `M${pt(q.bl)}L${pt(q.br)}L${pt(q.fr)}L${pt(q.fl)}Z`;
  // calls cell(i, j, [four corners], centre x, centre y, width, height) for every tile
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
  function gridLines(q, cols, rows, col, w) {
    const r = ratio(q); let out = '';
    for (let i = 1; i < cols; i++) out += `<path d="M${pt(fp(q, i / cols, 0))}L${pt(fp(q, i / cols, 1))}" stroke="${col}" stroke-width="${w}"/>`;
    for (let j = 1; j < rows; j++) { const d = persp(j / rows, r); out += `<path d="M${pt(fp(q, 0, d))}L${pt(fp(q, 1, d))}" stroke="${col}" stroke-width="${w}"/>`; }
    return out;
  }
  function planks(q, base, seam, cols = 11, colours) {
    const rows = 5, r = ratio(q); let out = `<path d="${quadD(q)}" fill="${base}"/>`;
    if (colours) out += grid(q, cols, 1, (i, j, p) => tile(p, colours[i % colours.length]));
    for (let i = 1; i < cols; i++) out += `<path d="M${pt(fp(q, i / cols, 0))}L${pt(fp(q, i / cols, 1))}" stroke="${seam}" stroke-width="1.6"/>`;
    for (let j = 1; j < rows; j++) { const d = persp(j / rows, r);
      for (let i = 0; i < cols; i++) if ((i * 2 + j) % 3 === 0) out += `<path d="M${pt(fp(q, i / cols, d))}L${pt(fp(q, (i + 1) / cols, d))}" stroke="${seam}" stroke-width="1.6"/>`; }
    return out;
  }
  const FLOOR_ART = {
    'floor-wood': { edge: C.wood, draw: q => planks(q, '#F6D9B6', '#E4B98C') },
    'floor-pink-tiles': { edge: C.pink, draw: q => grid(q, 10, 5, (i, j, p) => tile(p, (i + j) % 2 ? '#FFDDEE' : '#FFC6E2')) + gridLines(q, 10, 5, '#fff', 1.6)
      + grid(q, 10, 5, (i, j, p, x, y, w, h) => (i + j) % 2 ? '' : `<path d="M0 .9C-1.4 -.1 -.7 -1.1 0 -.35C.7 -1.1 1.4 -.1 0 .9Z" fill="#fff" opacity=".8" transform="translate(${f(x)} ${f(y)}) scale(${f(w * 0.12)} ${f(h * 0.2)})"/>`) },
    'floor-lilac-carpet': { edge: C.lilac, draw: q => `<path d="${quadD(q)}" fill="#D6C8FF"/>`
      + grid(q, 16, 6, (i, j, p, x, y, w, h) => (i + j) % 2 ? `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(w * 0.14)}" ry="${f(h * 0.14)}" fill="#E8E0FF"/>` : `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(w * 0.08)}" ry="${f(h * 0.08)}" fill="#C4B2FA"/>`) },
    'floor-checks': { edge: C.mint, draw: q => grid(q, 10, 5, (i, j, p) => tile(p, (i + j) % 2 ? C.cream : '#BDEEDD')) },
    'floor-clouds': { edge: C.sky, draw: q => `<path d="${quadD(q)}" fill="#C4E6FF"/>`
      + grid(q, 7, 3, (i, j, p, x, y, w, h) => (i + j) % 2 ? '' : `<g transform="translate(${f(x)} ${f(y)}) scale(${f(w / 40)} ${f(h / 40)})"><ellipse cx="-7" cy="2" rx="9" ry="7" fill="#fff"/><ellipse cx="5" cy="-2" rx="10" ry="9" fill="#fff"/><ellipse cx="14" cy="3" rx="7" ry="6" fill="#fff"/><rect x="-14" y="2" width="34" height="7" rx="3.5" fill="#fff"/></g>`)
      + grid(q, 7, 3, (i, j, p, x, y, w, h) => (i + j) % 2 && (i * 3 + j) % 4 === 1 ? twinkle(x, y, Math.min(w, h * 1.6) * 0.12, C.gold) : '') },
    'floor-stars': { edge: C.violet, draw: q => `<path d="${quadD(q)}" fill="#8C7CE6"/>`
      + grid(q, 9, 4, (i, j, p, x, y, w, h) => (i * 5 + j * 3) % 4 === 0 ? `<g transform="translate(${f(x)} ${f(y)}) scale(1 ${f(h / w * 1.4)})">${star(0, 0, w * 0.2, C.gold)}</g>` : (i * 5 + j * 3) % 4 === 2 ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f(w * 0.05)}" fill="#fff" opacity=".9"/>` : '') },
    'floor-rainbow': { edge: C.pink, draw: q => planks(q, '#fff', '#fff', 12, ['#FFC2DA', '#FFD8A8', '#FFF0A8', '#C8F0CF', '#BFE4FF', '#DCCBFF']) },
  };

  // ---- wallpapers: a repeating tile (w by h) on a base colour; cs is the scale on a shop card ----
  const thin = w => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const tinyCloud = (x, y, col = '#fff') => `<circle cx="${x - 5}" cy="${y}" r="4.5" fill="${col}"/><circle cx="${x + 1}" cy="${y - 3}" r="5.5" fill="${col}"/><circle cx="${x + 7}" cy="${y}" r="4" fill="${col}"/><rect x="${x - 9}" y="${y}" width="19" height="4.5" rx="2.2" fill="${col}"/>`;
  const miniRainbow = (x, y) => [[15, C.pink], [10.5, C.gold], [6, C.mint]].map(([r, c]) => `<path d="M${x - r} ${y}A${r} ${r} 0 0 1 ${x + r} ${y}" fill="none" stroke="${c}" stroke-width="4.5"/>`).join('') + tinyCloud(x - 14, y) + tinyCloud(x + 14, y);
  const butterfly = (x, y, s, c1, c2) => `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="-5.5" cy="-4" rx="6" ry="4.6" fill="${c1}" transform="rotate(-30 -5.5 -4)" ${thin(1.3)}/><ellipse cx="5.5" cy="-4" rx="6" ry="4.6" fill="${c1}" transform="rotate(30 5.5 -4)" ${thin(1.3)}/>
      <ellipse cx="-4" cy="4" rx="3.8" ry="3.2" fill="${c2}" ${thin(1.3)}/><ellipse cx="4" cy="4" rx="3.8" ry="3.2" fill="${c2}" ${thin(1.3)}/>
      <rect x="-1.3" y="-6" width="2.6" height="13" rx="1.3" fill="${INK}"/><path d="M-.8 -5.5Q-2.5 -9.5 -4.5 -10.5M.8 -5.5Q2.5 -9.5 4.5 -10.5" fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round"/>
      <circle cx="-6.5" cy="-4.5" r="1.5" fill="#fff"/><circle cx="6.5" cy="-4.5" r="1.5" fill="#fff"/></g>`;
  const toile = (() => { const L = 'stroke="#9C7DF0" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"', F = '#F1EAFF';
    return `<path d="M4 58Q30 63 58 58" fill="none" ${L}/>
      <rect x="10" y="28" width="9" height="30" fill="${F}" ${L}/><rect x="41" y="28" width="9" height="30" fill="${F}" ${L}/><rect x="17" y="36" width="26" height="22" fill="${F}" ${L}/>
      <rect x="25" y="22" width="10" height="16" fill="${F}" ${L}/>
      <path d="M8.5 29L14.5 17L20.5 29ZM39.5 29L45.5 17L51.5 29ZM23.5 23L30 10L36.5 23Z" fill="${C.lav}" ${L}/>
      <path d="M30 10V4L35.5 6L30 8" fill="${C.pink}" ${L}/>
      <path d="M26.5 58V51A3.5 3.5 0 0 1 33.5 51V58" fill="#fff" ${L}/><circle cx="14.5" cy="38" r="1.6" fill="#9C7DF0"/><circle cx="45.5" cy="38" r="1.6" fill="#9C7DF0"/><circle cx="30" cy="29" r="1.6" fill="#9C7DF0"/>
      <circle cx="74" cy="64" r="7" fill="${F}" ${L}/><path d="M74 71V78" ${L}/><circle cx="71" cy="62" r="1.4" fill="${C.pink}"/><circle cx="77" cy="66" r="1.4" fill="${C.pink}"/>
      <path d="M62 20q3 -3 6 0q3 -3 6 0M70 34q2.5 -2.5 5 0q2.5 -2.5 5 0" fill="none" ${L}/>` + heart(16, 76, 3.4, C.blush); })();
  const WALL_ART = {
    'bedroom-wall-stars': { base: '#E6DCFF', w: 60, h: 60, cs: 0.62, art: star(15, 17, 7.5, C.gold, thin(1.6)) + twinkle(45, 47, 6) + `<circle cx="45" cy="17" r="2" fill="#fff"/><circle cx="15" cy="47" r="2.2" fill="${C.lilac}"/>` },
    'bedroom-wall-hearts': { base: '#FFD4E9', w: 52, h: 52, cs: 0.64, art: heart(13, 14, 6.5, C.pink, thin(1.4)) + heart(39, 40, 5, '#fff') + `<circle cx="39" cy="14" r="2" fill="#fff"/><circle cx="13" cy="40" r="2" fill="${C.pink}"/>` },
    'bedroom-wall-rainbow': { base: '#DCF0FF', w: 100, h: 84, cs: 0.62, art: miniRainbow(26, 34) + miniRainbow(76, 76) + twinkle(76, 22, 4.5) + twinkle(26, 66, 3.5, C.gold) },
    'wall-dots': { base: '#FFE6D9', w: 36, h: 36, cs: 0.9, art: `<circle cx="9" cy="9" r="5.5" fill="#fff"/><circle cx="27" cy="27" r="5.5" fill="#FFB8D6"/><circle cx="27" cy="9" r="1.8" fill="${C.lilac}"/><circle cx="9" cy="27" r="1.8" fill="${C.gold}"/>` },
    'wall-stripes': { base: '#FFF0F7', w: 40, h: 40, cs: 0.8, art: `<rect width="20" height="40" fill="#FFD3E8"/><rect x="8.5" width="3" height="40" fill="#fff" opacity=".75"/>` + heart(30, 10, 3.4, C.pink) + `<circle cx="30" cy="30" r="1.8" fill="${C.lilac}"/>` },
    'wall-butterflies': { base: '#E3F6EC', w: 64, h: 64, cs: 0.62, art: butterfly(18, 20, 1, C.pink, C.blush) + butterfly(48, 50, 0.8, C.lilac, C.lav) + `<circle cx="50" cy="16" r="2" fill="#fff"/><circle cx="16" cy="50" r="2.2" fill="${C.mint}"/><circle cx="34" cy="34" r="1.5" fill="#fff"/>` },
    'wall-waves': { base: '#D6F0FF', w: 60, h: 44, cs: 0.75, art: `<path d="M0 12q7.5 -7 15 0t15 0t15 0t15 0" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M0 34q7.5 -7 15 0t15 0t15 0t15 0" fill="none" stroke="#A9DCFF" stroke-width="3.4" stroke-linecap="round"/>
      <circle cx="46" cy="23" r="2.2" fill="none" stroke="#fff" stroke-width="1.4"/><circle cx="51" cy="19.5" r="1.3" fill="#fff"/>
      <ellipse cx="16" cy="23" rx="4.6" ry="3" fill="${C.coral}" ${thin(1.2)}/><path d="M11.6 23L7.5 20V26Z" fill="${C.coral}" ${thin(1.2)}/><circle cx="18" cy="22.4" r=".9" fill="${INK}"/>` },
    'wall-toile': { base: '#FFF6E9', w: 90, h: 84, cs: 0.5, art: toile },
    'wall-unicorns': { base: '#FFE4F1', w: 72, h: 72, cs: 0.55, art: uniHead(22, 24, 0.95, thin(1.3)) + star(54, 54, 6, C.gold, thin(1.3)) + twinkle(54, 18, 4) + `<circle cx="20" cy="56" r="2.2" fill="${C.lilac}"/><circle cx="38" cy="40" r="1.6" fill="#fff"/>` },
  };
  function pattern(id, wp, tx, ty, s) {
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${wp.w}" height="${wp.h}" patternTransform="translate(${f(tx)} ${f(ty)}) scale(${s})"><rect width="${wp.w}" height="${wp.h}" fill="${wp.base}"/>${wp.art}</pattern>`;
  }

  // ---- rugs: drawn in the ellipse (cx, cy, rx, ry), lying on the floor ----
  const map = (cx, cy, rx, ry) => (u, v) => `${f(cx + u * rx)} ${f(cy + v * ry)}`;
  const at = (M, u, v) => M(u, v).split(' ').map(Number);
  const heartD = M => `M${M(0, 0.95)}C${M(-0.55, 0.6)} ${M(-1.05, 0.15)} ${M(-1, -0.35)}C${M(-0.95, -0.9)} ${M(-0.3, -1.02)} ${M(0, -0.55)}C${M(0.3, -1.02)} ${M(0.95, -0.9)} ${M(1, -0.35)}C${M(1.05, 0.15)} ${M(0.55, 0.6)} ${M(0, 0.95)}Z`;
  const dash = () => `stroke="#fff" stroke-width="${f(2 * Math.max(1, K * 0.8))}" stroke-dasharray="${f(5 * Math.max(1, K * 0.6))} ${f(5 * Math.max(1, K * 0.6))}" stroke-linecap="round" opacity=".85"`;
  const stitch = (cx, cy, rx, ry) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="none" ${dash()}/>`;
  const RUGS = {
    'bedroom-rug-round': (cx, cy, rx, ry) => ell(cx, cy, rx, ry, C.lilac, O()) + stitch(cx, cy, rx * 0.86, ry * 0.84) + ell(cx, cy, rx * 0.66, ry * 0.64, C.pink, T()) + ell(cx, cy, rx * 0.34, ry * 0.32, C.blush, T())
      + hl(`M${f(cx - rx * 0.55)} ${f(cy - ry * 0.42)}Q${f(cx - rx * 0.3)} ${f(cy - ry * 0.56)} ${f(cx - rx * 0.05)} ${f(cy - ry * 0.56)}`),
    'bedroom-rug-heart': (cx, cy, rx, ry) => { const M = map(cx, cy, rx, ry), I = map(cx, cy, rx * 0.72, ry * 0.72);
      return `<path d="${heartD(M)}" fill="${C.pink}" ${O()}/><path d="${heartD(map(cx, cy, rx * 0.86, ry * 0.86))}" fill="none" ${dash()}/>
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
        const [lx, ly] = at(M, u - 0.06, v + 0.18), [x, y] = at(M, u, v);
        s += `<ellipse cx="${lx}" cy="${ly}" rx="${f(r * 0.8)}" ry="${f(r * 0.35)}" fill="${C.teal}"/>` + flower(x, y, r, c); });
      return s; },
    'bed-rug-star': (cx, cy, rx, ry) => { const M = map(cx, cy, rx, ry);
      const starD = k => Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? 0.5 : 1) * k; return `${i ? 'L' : 'M'}${M(Math.cos(a) * rr, Math.sin(a) * rr * 1.06 + 0.06)}`; }).join('') + 'Z';
      return `<path d="${starD(1)}" fill="${C.gold}" ${O()}/><path d="${starD(0.8)}" fill="none" ${dash()}/><path d="${starD(0.56)}" fill="#FFE59A" ${T()}/>`
        + heart(cx, cy + ry * 0.06, Math.min(rx, ry * 2.2) * 0.1, C.rose) + hl(`M${M(-0.5, -0.14)}L${M(-0.24, -0.14)}`, 2.5); },
    'bed-rug-rainbow': (cx, cy, rx, ry) => {
      const bands = [[1, C.lilac], [0.82, C.sky], [0.64, C.mint], [0.47, C.gold], [0.3, C.pink]];
      return bands.map(([k, c], i) => ell(cx, cy, rx * k, ry * k, c, i ? T() : O())).join('') + stitch(cx, cy, rx * 0.91, ry * 0.9)
        + `<g transform="translate(${f(cx)} ${f(cy)}) scale(${f(rx / 70)} ${f(ry / 22)})">${tinyCloud(0, 1)}</g>`
        + hl(`M${f(cx - rx * 0.6)} ${f(cy - ry * 0.48)}Q${f(cx - rx * 0.35)} ${f(cy - ry * 0.68)} ${f(cx - rx * 0.05)} ${f(cy - ry * 0.7)}`, 2.4); },
  };

  // ---- beds: 150 wide, a side view with the headboard on the right and the pillow there ----
  // Drawn as if their bottom were at y 99; o.oy moves a taller bed down in its box. on: the covers
  // are pulled up; sleeper: her head, drawn on the pillow under them.
  const HEAD = { x: 106, y: 36, s: 46 };
  function placeSleeper(svgStr, x, y, s) {
    const m = /^\s*<svg\b[^>]*>/.exec(svgStr || ''); if (!m) return '';
    const h = s * 200 / 140;
    const open = m[0].replace(/\s(width|height|x|y|class|style)="[^"]*"/g, '')
      .replace(/<svg\b/, `<svg x="${f(x - s / 2)}" y="${f(y - 0.46 * h)}" width="${f(s)}" height="${f(h)}" overflow="visible"`);
    return open + svgStr.trim().slice(m[0].trim().length);
  }
  function bed(o, on, opt) {
    const oy = o.oy || 0, sleeper = on && opt && opt.sleeper;
    const legs = o.legs || `<rect x="30" y="84" width="8" height="15" rx="2.5" fill="${o.FD}" ${T()}/><rect x="110" y="84" width="8" height="15" rx="2.5" fill="${o.FD}" ${T()}/>`;
    const rail = o.rail || `<rect x="10" y="71" width="118" height="17" rx="6" fill="${o.F}" ${O()}/>`;
    let s = `<g transform="translate(0 ${oy})">` + shadow(76, 98, 70) + (o.behind || '') + o.head + legs + rail
      + `<rect x="14" y="48" width="112" height="28" rx="9" fill="#fff" ${O()}/>`
      + `<path d="M86 50C83 38 91 31 106 31C121 31 129 38 126 50Z" fill="${o.P}" ${O()}/>` + hl('M95 40Q99 35 107 34', 2.5);
    if (sleeper) s += placeSleeper(opt.sleeper, HEAD.x, HEAD.y, HEAD.s);
    if (!on) {
      s += `<path d="M6 80V54Q6 44 16 44H86Q96 44 96 54V80${scallops(96, 6, 80, 7, 8)}Z" fill="${o.B}" ${O()}/>`
        + `<path d="M8 50H94" stroke="${o.BT}" stroke-width="4.5" opacity=".8"/>` + hl('M13 60Q13 50 23 48', 3);
    } else if (sleeper) {
      s += `<path d="M6 82V50Q6 41 16 41H38C54 39 68 41 78 46C85 49 90 51 98 51H122Q129 51 129 58V82${scallops(129, 6, 82, 9, 8)}Z" fill="${o.B}" ${O()}/>`
        + `<path d="M76 46C84 50 90 52 98 52H123Q129 52 129 57V60H98C89 60 81 57 74 52Z" fill="${o.BT === '#fff' ? '#fff' : o.BT}" ${T()}/>` + hl('M13 58Q13 46 24 45', 3);
    } else {
      s += `<path d="M6 82V52Q6 44 16 44H121Q129 44 129 52V82${scallops(129, 6, 82, 9, 8)}Z" fill="${o.B}" ${O()}/>`
        + `<path d="M74 44H121Q129 44 129 50V53H74Z" fill="${o.BT}" ${T()}/>` + hl('M13 60Q13 50 23 48', 3);
    }
    s += o.deco(on) + o.foot + (o.front || '');
    return s + '</g>';
  }
  const headboard = F => `<path d="M121 99V30C121 10 147 10 147 30V99Z" fill="${F}" ${O()}/>` + hl('M127 32Q127 20 135 17');
  const footboard = F => `<path d="M3 99V55C3 41 27 41 27 55V99Z" fill="${F}" ${O()}/>` + hl('M8 56Q8 48 15 46');
  const decoAt = on => on ? [[24, 62], [48, 58], [72, 66], [100, 70]] : [[22, 64], [46, 58], [70, 66]];
  const BEDS = {
    'bedroom-bed-pink': (on, o) => bed({ F: C.pink, FD: '#E46FAE', B: C.blush, BT: '#fff', P: '#fff',
      head: headboard(C.pink) + heart(134, 28, 7, '#fff', T()), foot: footboard(C.pink) + heart(15, 54, 5, '#fff', T()),
      deco: on => decoAt(on).map(([x, y]) => heart(x, y, 4.5, C.rose)).join('') }, on, o),
    'bedroom-bed-canopy': (on, o) => bed({ oy: 58, F: C.lilac, FD: C.violet, B: C.pink, BT: '#fff', P: C.cream,
      behind: `<rect x="5" y="-44" width="7" height="143" rx="3" fill="${C.lilac}" ${T()}/><rect x="138" y="-44" width="7" height="143" rx="3" fill="${C.lilac}" ${T()}/>`,
      head: headboard(C.lilac) + star(134, 28, 8, C.gold, T()), foot: footboard(C.lilac) + star(15, 54, 5.5, C.gold, T()),
      deco: on => decoAt(on).map(([x, y]) => star(x, y, 5, '#fff')).join(''),
      front: `<path d="M1 -40H27C22 -14 14 8 11 30C15 44 17 58 16 70H1Z" fill="#FFD6EA" opacity=".88" ${T()}/>
        <path d="M149 -40H123C128 -14 136 8 139 30C135 44 133 58 134 70H149Z" fill="#FFD6EA" opacity=".88" ${T()}/>
        <path d="M8 -24C7 -6 7 12 8 26M142 -24C143 -6 143 12 142 26" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
        <circle cx="11" cy="32" r="4.5" fill="${C.gold}" ${T()}/><circle cx="139" cy="32" r="4.5" fill="${C.gold}" ${T()}/>
        <path d="M0 -50H150V-38${scallops(150, 0, -38, 7, 10)}Z" fill="${C.pink}" ${O()}/>${hl('M8 -45H42', 2.5)}
        ${[21, 43, 64, 86, 107, 129].map(x => `<circle cx="${x}" cy="-33" r="2.3" fill="${C.gold}"/>`).join('')}
        ${heart(75, -52, 7, C.rose, T())}${twinkle(16, -54, 5, C.gold)}${twinkle(136, -54, 4.5, C.gold)}` }, on, o),
    'bedroom-bed-cloud': (on, o) => { const W = '#F7FBFF';
      return bed({ oy: 6, F: W, FD: C.gold, B: C.sky, BT: '#fff', P: '#fff',
        head: blob([[121, 26, 26, 73, 10], [124, 26, 9], [136, 14, 12], [140, 25, 8], [145, 25, 6]], W) + [[11, C.pink], [8, C.gold], [5, C.mint]].map(([r, c]) => `<path d="M${134 - r} 64A${r} ${r} 0 0 1 ${134 + r} 64" fill="none" stroke="${c}" stroke-width="3.4"/>`).join('') + hl('M128 24Q131 14 139 11'),
        legs: `<circle cx="34" cy="93" r="5" fill="${C.gold}" ${T()}/><circle cx="114" cy="93" r="5" fill="${C.gold}" ${T()}/>`,
        rail: blob([[10, 71, 118, 17, 8], [20, 88, 8], [38, 89, 9], [57, 89, 8.5], [76, 89, 9], [95, 89, 8.5], [114, 88, 8]], W),
        foot: blob([[3, 50, 24, 49, 8], [6, 51, 7], [16, 42, 10], [25, 50, 6]], W) + hl('M9 48Q12 40 19 38'),
        deco: on => decoAt(on).map(([x, y]) => `<path d="M${x - 5} ${y + 3}c-4 0-4-6 0-6c0-5 8-5 8 0c4 0 4 6 0 6Z" fill="#fff"/>`).join(''),
        front: twinkle(4, 30, 5, C.gold) + twinkle(148, 6, 3.5, C.gold) }, on, o); },
    'bedroom-bed-stars': (on, o) => bed({ oy: 18, F: '#9C8BEF', FD: '#7A6BDB', B: '#5C4CC2', BT: C.lilac, P: C.lav,
      head: headboard('#9C8BEF') + moon(133, -2, 14, C.gold, O()) + star(131, 40, 5, '#fff') + star(140, 58, 4, C.gold) + star(130, 76, 3.5, '#fff'),
      foot: footboard('#9C8BEF') + star(15, 56, 6.5, C.gold, T()) + star(15, 76, 4, '#fff'),
      deco: on => decoAt(on).map(([x, y], i) => star(x, y, [5.5, 4.5, 6, 4.5][i], C.gold)).join('') + twinkle(58, 72, 3) + twinkle(34, 56, 2.6),
      front: twinkle(112, -10, 4.5, C.gold) + twinkle(4, 26, 4, C.gold) }, on, o),
  };

  // ---- the things by the bed from rooms.js, redrawn here (in rooms.js units, fitted by s 0.8) ----
  const nightstand = () => `${shadow(178, 257, 34)}<rect x="154" y="244" width="8" height="13" rx="2" fill="${C.woodD}" ${T()}/><rect x="194" y="244" width="8" height="13" rx="2" fill="${C.woodD}" ${T()}/>
      <rect x="150" y="212" width="56" height="36" rx="6" fill="${C.cream}" ${O()}/><rect x="146" y="204" width="64" height="11" rx="4" fill="${C.wood}" ${O()}/>
      <path d="M156 229H200" stroke="${INK}" stroke-width="${f(1.6 * K)}" opacity=".35"/><circle cx="178" cy="236" r="3.5" fill="${C.gold}" ${T()}/>` + hl('M156 218H170', 2.5);
  const rays = (cx, cy, r0, r1, angles, col = C.gold) => angles.map(a => { const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
    return line(`M${f(cx + c * r0)} ${f(cy + s * r0)}L${f(cx + c * r1)} ${f(cy + s * r1)}`, col, 3); }).join('');
  const OLD = {
    'bedroom-lamp': on => fit(144, 146, 0.8, () => (on ? bright(glow(178, 168, 58)) : '') + nightstand()
      + `<ellipse cx="178" cy="203" rx="11" ry="4" fill="${C.gold}" ${T()}/><rect x="175" y="180" width="6" height="22" fill="${C.gold}" ${T()}/>`
      + (on ? bright(`<path d="M161 182L168 152H188L195 182${scallops(195, 161, 182, 4, 6)}Z" fill="#FFE6F3" ${O()}/>` + hl('M170 158L166 176', 2.5) + heart(178, 167, 4.5, C.pink) + rays(178, 168, 26, 33, [-160, -125, -90, -55, -20]))
        : `<path d="M161 182L168 152H188L195 182${scallops(195, 161, 182, 4, 6)}Z" fill="${C.pink}" ${O()}/>` + hl('M170 158L166 176', 2.5) + heart(178, 167, 4.5, '#fff'))),
    'bedroom-moon-lamp': on => fit(140, 138, 0.8, () => (on ? bright(glow(178, 164, 62)) : '') + nightstand()
      + `<ellipse cx="178" cy="203" rx="11" ry="4" fill="${C.gold}" ${T()}/>` + bar('M178 202V186', C.gold, 3)
      + (on ? bright(moon(178, 164, 22, '#FFE07A', O()) + `<path d="M170 162Q174 166 178 162" fill="none" stroke="${INK}" stroke-width="${f(2.2 * K)}" stroke-linecap="round"/><ellipse cx="172" cy="170" rx="3" ry="2" fill="${C.pink}" opacity=".7"/>`
          + `<path d="M190 144V150" stroke="${INK}" stroke-width="${f(1.4 * K)}"/>` + star(190, 155, 5, '#fff', T()) + twinkle(152, 146, 5, '#FFF4C2') + twinkle(204, 184, 4, '#FFF4C2') + twinkle(206, 140, 3.5, '#FFF4C2'))
        : moon(178, 164, 22, '#F5E6B8', O()) + `<path d="M169 161Q173 165 177 161" fill="none" stroke="${INK}" stroke-width="${f(2.2 * K)}" stroke-linecap="round"/><ellipse cx="172" cy="170" rx="3" ry="2" fill="${C.pink}" opacity=".6"/>`
          + `<path d="M190 144V150" stroke="${INK}" stroke-width="${f(1.4 * K)}"/>` + star(190, 155, 5, C.lav, T()))),
    'bedroom-toybox': on => fit(140, 160, 0.8, () => shadow(178, 257, 36)
      + (on ? `<path d="M146 212L150 188L214 182L212 210Z" fill="${C.violet}" ${O()}/>` + bar('M196 210L204 176', C.lav, 3) + star(205, 172, 9, C.gold, T())
          + `<circle cx="162" cy="198" r="5" fill="${C.peach}" ${T()}/><circle cx="182" cy="198" r="5" fill="${C.peach}" ${T()}/><circle cx="172" cy="206" r="12" fill="${C.peach}" ${T()}/>`
          + `<circle cx="167" cy="204" r="1.8" fill="${INK}"/><circle cx="177" cy="204" r="1.8" fill="${INK}"/><ellipse cx="172" cy="209" rx="3" ry="2" fill="${C.coral}"/>`
          + `<circle cx="194" cy="206" r="8" fill="${C.sky}" ${T()}/><path d="M186.5 204Q194 210 201.5 204" fill="none" stroke="#fff" stroke-width="2.5"/>` + twinkle(150, 178, 5, C.gold) + twinkle(190, 168, 3.5, C.gold) : '')
      + `<rect x="146" y="210" width="66" height="46" rx="7" fill="${C.lilac}" ${O()}/><rect x="146" y="222" width="66" height="7" fill="${C.lav}" ${T()}/>`
      + (on ? '' : `<rect x="142" y="200" width="74" height="14" rx="5" fill="${C.violet}" ${O()}/>` + hl('M150 205H176', 2.5) + `<rect x="173" y="210" width="12" height="9" rx="3" fill="${C.gold}" ${T()}/>`)
      + heart(179, 241, 7, C.pink, T()) + hl('M153 236V246', 2.5)),
    'bedroom-petbed': on => fit(138, 192, 0.8, () => { const up = on ? -9 : 0;
      return (on ? shadow(178, 257, 30) : shadow(178, 257, 38)) + ell(178, 246, 36, 12, C.rose, O()) + ell(178, 243, 27, 7, C.blush)
        + `<g transform="translate(0 ${up})">`
        + `<circle cx="154" cy="234" r="5" fill="${C.lilac}" ${T()}/><circle cx="150" cy="240" r="4.5" fill="${C.pink}" ${T()}/>`
        + ell(172, 236, 19, 10, '#fff', T())
        + `<ellipse cx="194" cy="226" rx="11" ry="10" fill="#fff" ${T()}/><ellipse cx="203" cy="230" rx="6" ry="4.5" fill="${C.blush}" ${T()}/>`
        + `<path d="M191 217L197 201L199 217Z" fill="${C.gold}" ${T()}/>`
        + `<circle cx="185" cy="218" r="5" fill="${C.pink}" ${T()}/><circle cx="181" cy="225" r="4.5" fill="${C.lilac}" ${T()}/><circle cx="182" cy="232" r="4" fill="${C.sky}" ${T()}/>`
        + `<path d="M190 225Q194 228 198 225" fill="none" stroke="${INK}" stroke-width="${f(2.2 * K)}" stroke-linecap="round"/><ellipse cx="197" cy="231" rx="3" ry="1.8" fill="${C.pink}" opacity=".7"/>`
        + hl('M160 233Q166 229 174 229', 2) + '</g>'
        + (on ? heart(208, 204, 5, C.rose) + heart(150, 210, 4, C.pink) + twinkle(214, 222, 4, C.gold) + line('M164 254Q178 250 192 254', INK, 1.6 * K, 0.4) : heart(206, 206, 4.5, C.rose) + twinkle(160, 214, 4.5, C.gold)); }),
  };

  // ---- everything else, each in its own box (0..w, 0..h) ----
  const tied = (x, y) => `<circle cx="${f(x)}" cy="${f(y)}" r="3.6" fill="${C.gold}" ${T()}/>`;
  const ART = Object.assign({}, BEDS, OLD, {
    // a window with curtains: on, the curtains are closed
    'bed-window': (on, o) => { const night = o && o.night;
      const sky = night ? `<path d="M23 100V46A27 27 0 0 1 77 46V100Z" fill="#4C43A8"/>` + moon(58, 44, 9, '#FFF1B8') + star(34, 62, 3.2, C.gold) + star(64, 80, 2.6, '#fff') + twinkle(36, 88, 2.6, '#fff') + twinkle(70, 60, 2.2, C.gold) + twinkle(44, 40, 2, '#fff')
        : `<path d="M23 100V46A27 27 0 0 1 77 46V100Z" fill="#C4E8FF"/>` + tinyCloud(38, 82) + tinyCloud(62, 56) + twinkle(36, 52, 4) + twinkle(66, 88, 3) + `<circle cx="60" cy="74" r="2" fill="#fff"/>`;
      let s = `<path d="M16 106V46A34 34 0 0 1 84 46V106Z" fill="${C.cream}" ${O()}/>` + bright(sky)
        + bar('M50 13V100M23 68H77', C.cream, 3.5) + `<path d="M23 100V46A27 27 0 0 1 77 46V100Z" fill="none" ${T()}/>` + hl('M28 64Q28 40 44 31', 2.5)
        + `<rect x="10" y="100" width="80" height="9" rx="4" fill="${C.cream}" ${O()}/>`;
      if (!on) {
        const cur = m => { const X = x => m ? 100 - x : x;
          return `<path d="M${X(3)} 11H${X(31)}C${X(30)} 36 ${X(26)} 56 ${X(31)} 70C${X(23)} 80 ${X(16)} 96 ${X(14)} 114C${X(7)} 82 ${X(3)} 46 ${X(3)} 11Z" fill="${C.pink}" ${O()}/>`
            + line(`M${X(12)} 18C${X(12)} 40 ${X(14)} 58 ${X(20)} 72M${X(22)} 18C${X(22)} 38 ${X(21)} 54 ${X(25)} 66`, C.blush, 2.6) + tied(X(28), 70); };
        s += cur(false) + cur(true);
      } else {
        const panel = m => { const X = x => m ? 100 - x : x;
          return `<path d="M${X(2)} 11H${X(51)}C${X(49)} 44 ${X(51)} 80 ${X(50)} 112Q${X(42)} 117 ${X(34)} 112Q${X(26)} 117 ${X(18)} 112Q${X(10)} 117 ${X(4)} 112C${X(2)} 80 ${X(3)} 44 ${X(2)} 11Z" fill="${C.pink}" ${O()}/>`
            + line(`M${X(14)} 20V106M${X(27)} 20V108M${X(40)} 20V106`, C.blush, 2.6); };
        s += panel(false) + panel(true) + heart(50, 62, 5, C.rose, T());
      }
      return s + `<path d="M1 6H99V17${scallops(99, 1, 17, 6, 7)}Z" fill="${C.rose}" ${O()}/>` + [9, 25, 42, 58, 75, 91].map(x => `<circle cx="${x}" cy="21" r="1.8" fill="${C.gold}"/>`).join('')
        + `<rect x="-1" y="2" width="102" height="6" rx="3" fill="${C.gold}" ${T()}/>` + `<circle cx="-1" cy="5" r="4.2" fill="${C.gold}" ${T()}/><circle cx="101" cy="5" r="4.2" fill="${C.gold}" ${T()}/>`; },

    // a wardrobe: on, its doors open on her gowns
    'bed-wardrobe': on => {
      let s = shadow(39, 123, 36) + `<rect x="10" y="110" width="9" height="13" rx="3" fill="${C.gold}" ${T()}/><rect x="59" y="110" width="9" height="13" rx="3" fill="${C.gold}" ${T()}/>`
        + `<path d="M7 26C14 10 30 6 39 14C48 6 64 10 71 26Z" fill="${C.lilac}" ${O()}/>` + heart(39, 16, 5.5, C.rose, T())
        + `<rect x="4" y="22" width="70" height="92" rx="8" fill="${C.lilac}" ${O()}/>` + hl('M9 32V60', 3);
      if (!on) {
        s += [10, 40].map(x => `<rect x="${x}" y="29" width="28" height="78" rx="5" fill="${C.pink}" ${T()}/><path d="M${x + 4} 101V47A10 10 0 0 1 ${x + 24} 47V101Z" fill="${C.blush}" ${T()}/>` + heart(x + 14, 58, 4.5, '#fff')).join('')
          + `<circle cx="35" cy="72" r="2.8" fill="${C.gold}" ${T()}/><circle cx="43" cy="72" r="2.8" fill="${C.gold}" ${T()}/>`;
      } else {
        const gown = (x, c, t) => `<path d="M${x} 36v3l-6 4h12z" fill="none" stroke="${INK}" stroke-width="${f(1.4 * K)}" stroke-linejoin="round"/>`
          + `<path d="M${x - 5} 44H${x + 5}L${x + 4} 54L${x + 11} 92Q${x} 97 ${x - 11} 92L${x - 4} 54Z" fill="${c}" ${T()}/><path d="M${x - 10} 88Q${x} 93 ${x + 10} 88" fill="none" stroke="${t}" stroke-width="2.4" stroke-linecap="round"/>`;
        s += `<rect x="10" y="29" width="58" height="78" rx="4" fill="#7A5CC8" ${T()}/>` + bar('M13 37H65', C.gold, 2.5)
          + gown(23, C.pink, '#fff') + gown(39, C.mint, '#fff') + gown(55, C.gold, C.rose) + star(39, 64, 3, '#fff') + heart(23, 66, 2.6, '#fff')
          + `<path d="M10 29L0 33V103L10 107Z" fill="${C.pink}" ${T()}/><path d="M68 29L78 33V103L68 107Z" fill="${C.pink}" ${T()}/>`
          + twinkle(18, 104, 3.5, '#fff') + twinkle(62, 46, 3.5, '#fff') + twinkle(6, 18, 4, C.gold);
      }
      return s; },

    // a vanity with a heart mirror: on, the mirror sparkles
    'bed-vanity': on => shadow(36, 98, 32) + bar('M36 50V36', C.gold, 4)
      + heart(36, 24, 17, C.gold, O()) + heart(36, 24.5, 12.5, on ? '#E6F6FF' : C.glass, T()) + hl('M26 18Q28 13 33 14', 2.5)
      + (on ? twinkle(42, 20, 4.5) + twinkle(30, 30, 2.6) + twinkle(58, 8, 4.5, C.gold) + twinkle(12, 12, 3.5, C.gold) + heart(62, 34, 3, C.rose) + heart(8, 30, 2.6, C.pink) : '')
      + `<rect x="8" y="39" width="9" height="11" rx="3" fill="${C.lilac}" ${S()}/><circle cx="12.5" cy="37" r="2.6" fill="${C.mint}" ${S()}/>`
      + `<rect x="54" y="43" width="10" height="7" rx="2" fill="${C.mint}" ${S()}/><rect x="53" y="40" width="12" height="4" rx="2" fill="${C.rose}" ${S()}/>`
      + `<path d="M6 57H66L69 92${scallops(69, 3, 92, 6, 6)}L6 57Z" fill="${C.pink}" ${O()}/>` + line('M8 64Q36 70 64 64', '#fff', 2.4, 0.8)
      + heart(36, 78, 5.5, C.rose, T()) + hl('M10 70V84', 2.5)
      + `<rect x="2" y="50" width="68" height="8" rx="3.5" fill="#fff" ${O()}/>`,

    // a bookshelf: on, a storybook slides out, glowing
    'bed-bookshelf': on => { const cols = [C.pink, C.sky, C.mint, C.gold, C.lilac, C.coral, C.rose, C.teal];
      const books = (x0, x1, y, h, seed, skip) => { const r = rng(seed); let x = x0 + 1, s = '';
        for (;;) { const w = 5 + Math.floor(r() * 3), hh = h * (0.72 + r() * 0.26), c = cols[Math.floor(r() * cols.length)];
          if (x + w > x1 - 1) break;
          if (!(skip && skip(x))) s += `<rect x="${f(x)}" y="${f(y - hh)}" width="${w}" height="${f(hh)}" rx="1" fill="${c}" ${S()}/><path d="M${f(x + 1.5)} ${f(y - hh + 3.5)}h${w - 3}" stroke="#fff" stroke-width="1.2" opacity=".75"/>`;
          x += w; }
        return s; };
      return shadow(33, 105, 30) + `<rect x="5" y="16" width="56" height="88" rx="4" fill="${C.wood}" ${O()}/><rect x="10" y="21" width="46" height="78" rx="2" fill="${C.woodD}" ${T()}/>`
        + books(10, 44, 45, 22, 3) + `<circle cx="50" cy="39" r="5" fill="${C.glass}" ${S()}/><path d="M46 44H54L53 46H47Z" fill="${C.gold}" ${S()}/>`
        + `<rect x="8" y="45" width="50" height="5" rx="1.5" fill="${C.wood}" ${T()}/>`
        + books(10, 56, 72, 21, 17, on ? (x => x > 28 && x < 36) : null)
        + `<rect x="8" y="72" width="50" height="5" rx="1.5" fill="${C.wood}" ${T()}/>`
        + books(10, 46, 99, 21, 29) + heart(51, 92, 3.6, C.rose, S())
        + `<rect x="2" y="10" width="62" height="8" rx="3" fill="${C.wood}" ${O()}/>` + hl('M8 14H24', 2.2)
        + `<path d="M14 10C12 4 14 1 17 3C19 -1 23 1 22 5C25 4 26 8 22 10Z" fill="${C.mint}" ${S()}/>` + star(50, 4, 5.5, C.gold, S())
        + (on ? bright(glow(34, 58, 22, '#FFF4C2', 0.9)) + `<g transform="rotate(-18 33 60)"><rect x="29" y="47" width="8" height="24" rx="1.5" fill="${C.rose}" ${T()}/><path d="M30.5 52h5M30.5 66h5" stroke="#fff" stroke-width="1.4" opacity=".8"/></g>` + twinkle(22, 52, 3.5, C.gold) + twinkle(44, 60, 3, '#fff') + twinkle(36, 42, 2.6, C.gold) : ''); },

    // a music box with a ballerina: on, the lid opens and she twirls up
    'bed-musicbox': on => { let s = shadow(23, 68, 15)
        + `<ellipse cx="23" cy="66.5" rx="12" ry="3.4" fill="${C.wood}" ${T()}/><path d="M20 47H26L27.5 66H18.5Z" fill="${C.woodD}" ${T()}/>`
        + `<ellipse cx="23" cy="46" rx="20" ry="5" fill="${C.wood}" ${O()}/>`;
      if (on) s += `<path d="M9 30L4 12L40 9L37 30Z" fill="${C.rose}" ${O()}/><path d="M10 27L7 15L36 13L34 27Z" fill="${C.lav}" ${S()}/>` + twinkle(30, 18, 2.8);
      s += `<rect x="8" y="29" width="30" height="15" rx="3" fill="${C.pink}" ${O()}/><path d="M8 35H38" stroke="${C.blush}" stroke-width="2.4"/>` + heart(23, 37, 3.6, C.rose, S())
        + bar('M38 36H42', C.gold, 1.6) + `<circle cx="43" cy="36" r="2.4" fill="${C.gold}" ${S()}/>`;
      if (!on) s += `<rect x="6" y="23" width="34" height="8" rx="3" fill="${C.rose}" ${O()}/>` + hl('M10 26H22', 2) + `<circle cx="23" cy="22" r="2.4" fill="${C.gold}" ${S()}/>`;
      else s += `<ellipse cx="23" cy="29" rx="6" ry="1.8" fill="${C.gold}" ${S()}/>` + bar('M23 28V22', C.gold, 1.4)
        + line('M21.5 22V14M24.5 22V14', shade(C.peach, -0.1), 2.2)
        + `<path d="M15 17Q23 11 31 17Q23 20.5 15 17Z" fill="${C.blush}" ${S()}/><rect x="20.5" y="9" width="5" height="7" rx="2" fill="${C.pink}" ${S()}/>`
        + line('M21 10Q17 6 18 2M25 10Q29 6 28 2', shade(C.peach, -0.1), 2)
        + `<circle cx="23" cy="5.5" r="3.4" fill="${C.peach}" ${S()}/><circle cx="23" cy="1.6" r="1.8" fill="#E9A93F" ${S()}/>`
        + note(6, 16, 0.9) + note(40, 8, 0.8, C.violet) + twinkle(36, 22, 2.6, C.gold) + twinkle(10, 4, 2.6, C.gold);
      return s; },

    // a star nightlight: on, it glows and throws little stars on the walls
    'bed-nightlight': on => { let s = '';
      if (on) s += bright(glow(20, 22, 44, '#FFF0A0', 0.85)
        + [[-46, -18, 4], [-30, -44, 3.2], [-64, 8, 3.6], [62, -26, 4.2], [44, -50, 3], [76, 4, 3.4], [6, -56, 3.6], [-14, -30, 2.4], [56, 22, 2.4], [-40, 30, 2.4]].map(([x, y, r]) => star(20 + x, 22 + y, r, '#FFE68A', 'opacity=".9"')).join('')
        + twinkle(-6, 2, 3, '#FFF6CC') + twinkle(48, 0, 3, '#FFF6CC'));
      s += shadow(20, 52, 14) + `<ellipse cx="20" cy="49" rx="13" ry="4.2" fill="${C.lilac}" ${O()}/>` + bar('M20 46V36', C.lav, 3);
      const face = (on ? happyEye(14.5, 22) + happyEye(25.5, 22) : sleepEye(14.5, 22) + sleepEye(25.5, 22)) + `<path d="M17.5 27Q20 29.5 22.5 27" fill="none" stroke="${INK}" stroke-width="${f(1.5 * K)}" stroke-linecap="round"/>` + blush(11.5, 26, 2) + blush(28.5, 26, 2);
      const body = star(20, 23, 17, on ? '#FFE26A' : '#F3E6B4', O()) + face + hl('M13 13L17 9', 2.2);
      return s + (on ? bright(body) : body); },

    // a flower pot: on, it blooms
    'bed-plant': on => { let s = shadow(21, 64, 14);
      s += on ? bar('M21 42C21 30 20 20 21 12M21 40C17 34 13 30 10 24M21 38C26 32 30 28 33 22', C.teal, 2.4)
        : bar('M21 42C21 32 20 24 21 15', C.teal, 2.4);
      const leaf = (x, y, a, r = 7) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${f(r * 0.5)}" transform="rotate(${a} ${x} ${y})" fill="${C.mint}" ${S()}/><path d="M${f(x - r * 0.6 * Math.cos(a * Math.PI / 180))} ${f(y - r * 0.6 * Math.sin(a * Math.PI / 180))}L${f(x + r * 0.6 * Math.cos(a * Math.PI / 180))} ${f(y + r * 0.6 * Math.sin(a * Math.PI / 180))}" stroke="${C.teal}" stroke-width="1.2"/>`;
      s += leaf(13, 36, -30) + leaf(29, 34, 30) + leaf(15, 27, -40, 5.5) + leaf(27, 25, 35, 5.5);
      if (on) s += flower(21, 10, 9, C.pink) + flower(9, 22, 6.5, C.gold, C.rose) + flower(33, 20, 6.5, C.lilac) + twinkle(36, 6, 3.5, C.gold) + twinkle(5, 8, 3, C.gold) + heart(4, 34, 2.6, C.rose);
      else s += `<path d="M21 4C27 8 27 14 21 17C15 14 15 8 21 4Z" fill="${C.pink}" ${S()}/><path d="M16 14Q21 20 26 14L24 18H18Z" fill="${C.mint}" ${S()}/>`;
      return s + `<path d="M9 45H33L30.5 63H11.5Z" fill="${C.coral}" ${O()}/><rect x="6" y="40" width="30" height="7" rx="3" fill="${C.peach}" ${O()}/>` + heart(21, 53, 3.4, '#fff') + hl('M12 49L13.5 59', 2); },

    // a fishbowl on a little stand: on, the fish leaps, with bubbles
    'bed-fishbowl': on => { const fish = (x, y, a, s = 1) => `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})"><path d="M-6 0L-11 -4.5V4.5Z" fill="#FFA65C" ${S()}/><ellipse cx="0" cy="0" rx="7" ry="4.6" fill="#FFB86B" ${S()}/><path d="M-1 -4Q1 -8 4 -4" fill="#FFA65C" ${S()}/>${dotEye(3.4, -0.8, 1.2)}</g>`;
      let s = shadow(23, 78, 16) + `<ellipse cx="23" cy="75" rx="13" ry="3.5" fill="${C.lilac}" ${O()}/><path d="M19 52H27L29 73H17Z" fill="${C.lav}" ${T()}/>`
        + `<ellipse cx="23" cy="50" rx="19" ry="5" fill="#fff" ${O()}/>`
        + `<circle cx="23" cy="31" r="18" fill="#EAF7FF" ${O()}/>`
        + `<path d="M6.5 25A18 18 0 1 0 39.5 25Q35 23 31 25T23 25T15 25T6.5 25Z" fill="#A6DCFF"/>`
        + [[13, 45, C.pink], [18, 47, C.gold], [27, 47, C.lilac], [33, 45, C.mint]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${c}"/>`).join('')
        + line('M14 44C11 38 16 34 13 29M17 45C16 40 19 37 18 33', C.teal, 2.2);
      if (on) s += fish(31, 6, -35) + `<circle cx="20" cy="18" r="2" fill="#A6DCFF" ${S()}/><circle cx="38" cy="16" r="1.6" fill="#A6DCFF" ${S()}/><circle cx="25" cy="10" r="1.4" fill="#A6DCFF"/>`
        + [[26, 36, 2.4], [30, 30, 1.8], [22, 32, 1.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="1.3"/>`).join('') + twinkle(42, 4, 3, C.gold);
      else s += fish(26, 35, 0) + `<circle cx="34" cy="30" r="1.6" fill="none" stroke="#fff" stroke-width="1.3"/>`;
      return s + `<circle cx="23" cy="31" r="18" fill="none" ${O()}/><ellipse cx="23" cy="13.5" rx="10" ry="2.8" fill="#EAF7FF" ${T()}/>` + hl('M10 30Q10 21 16 17', 2.5); },

    // a teddy bear: on, it hops
    'bed-teddy': on => { const b = C.wood, d = shade(C.wood, -0.12), up = on ? -6 : 0;
      return (on ? shadow(20, 46, 11) : shadow(20, 46, 15)) + `<g transform="translate(0 ${up})">`
        + `<ellipse cx="8" cy="33" rx="4.5" ry="6" transform="rotate(25 8 33)" fill="${d}" ${T()}/><ellipse cx="32" cy="33" rx="4.5" ry="6" transform="rotate(-25 32 33)" fill="${d}" ${T()}/>`
        + `<ellipse cx="20" cy="35" rx="12" ry="10.5" fill="${b}" ${T()}/><ellipse cx="20" cy="37" rx="6.5" ry="6" fill="${C.cream}"/>`
        + `<ellipse cx="11" cy="43" rx="5.5" ry="4.2" fill="${b}" ${T()}/><ellipse cx="29" cy="43" rx="5.5" ry="4.2" fill="${b}" ${T()}/><circle cx="11" cy="43.5" r="2.2" fill="${C.peach}"/><circle cx="29" cy="43.5" r="2.2" fill="${C.peach}"/>`
        + `<circle cx="10.5" cy="9.5" r="4.6" fill="${b}" ${T()}/><circle cx="29.5" cy="9.5" r="4.6" fill="${b}" ${T()}/><circle cx="10.5" cy="9.5" r="2.2" fill="${C.peach}"/><circle cx="29.5" cy="9.5" r="2.2" fill="${C.peach}"/>`
        + `<circle cx="20" cy="17" r="10.5" fill="${b}" ${T()}/><ellipse cx="20" cy="21" rx="5" ry="3.8" fill="${C.cream}" ${S()}/><ellipse cx="20" cy="19.4" rx="2" ry="1.4" fill="${INK}"/>`
        + (on ? happyEye(15.5, 15.5, 0.8) + happyEye(24.5, 15.5, 0.8) : dotEye(15.5, 15.5, 1.6) + dotEye(24.5, 15.5, 1.6)) + blush(12.5, 20, 2) + blush(27.5, 20, 2)
        + `<path d="M20 27L14 24V30ZM20 27L26 24V30Z" fill="${C.pink}" ${S()}/><circle cx="20" cy="27" r="1.8" fill="${C.rose}" ${S()}/>` + hl('M13 11Q15 8 18 8', 1.8) + '</g>'
        + (on ? heart(4, 6, 3, C.rose) + heart(36, 4, 2.6, C.pink) + line('M12 50Q20 48 28 50', INK, 1.4 * K, 0.35) : ''); },

    // a bunny plush: on, it hops
    'bed-bunny': on => { const b = '#F4EEFF', up = on ? -6 : 0;
      return (on ? shadow(17, 54, 9) : shadow(17, 54, 12)) + `<g transform="translate(0 ${up})">`
        + `<ellipse cx="11.5" cy="12" rx="3.6" ry="9.5" transform="rotate(-12 11.5 12)" fill="${b}" ${T()}/><ellipse cx="22.5" cy="12" rx="3.6" ry="9.5" transform="rotate(12 22.5 12)" fill="${b}" ${T()}/>`
        + `<ellipse cx="11.5" cy="13" rx="1.6" ry="6" transform="rotate(-12 11.5 13)" fill="${C.blush}"/><ellipse cx="22.5" cy="13" rx="1.6" ry="6" transform="rotate(12 22.5 13)" fill="${C.blush}"/>`
        + `<ellipse cx="17" cy="42" rx="11" ry="10" fill="${b}" ${T()}/><ellipse cx="17" cy="44" rx="6" ry="5.5" fill="#fff"/>`
        + `<ellipse cx="10" cy="51" rx="5" ry="3.2" fill="${b}" ${T()}/><ellipse cx="24" cy="51" rx="5" ry="3.2" fill="${b}" ${T()}/>`
        + `<ellipse cx="8.5" cy="40" rx="3" ry="4.5" transform="rotate(20 8.5 40)" fill="${b}" ${S()}/><ellipse cx="25.5" cy="40" rx="3" ry="4.5" transform="rotate(-20 25.5 40)" fill="${b}" ${S()}/>`
        + `<circle cx="17" cy="27" r="9.5" fill="${b}" ${T()}/>` + (on ? happyEye(13, 26, 0.75) + happyEye(21, 26, 0.75) : dotEye(13, 26, 1.5) + dotEye(21, 26, 1.5))
        + `<path d="M15.5 29.5H18.5L17 31.2Z" fill="${C.rose}"/>` + blush(10.5, 30.5, 1.8) + blush(23.5, 30.5, 1.8) + heart(23, 5, 2.6, C.rose, S()) + '</g>'
        + (on ? twinkle(3, 20, 2.6, C.gold) + heart(31, 18, 2.4, C.pink) : ''); },

    // a rocking unicorn: on, it rocks
    'bed-rocking': on => { const g = `<g transform="rotate(${on ? -9 : 0} 40 64)">`;
      return shadow(40, 68, 34) + g
        + bar('M4 58Q40 76 76 58', C.rose, 5) + bar('M22 46L17 63M30 47L28 66M50 47L52 66M58 46L63 63', C.lav, 4)
        + `<path d="M17 40C6 38 3 48 7 56C9 50 12 48 14 50C14 46 16 44 19 44Z" fill="${C.pink}" ${T()}/>`
        + `<ellipse cx="38" cy="40" rx="22" ry="11" fill="#fff" ${O()}/>` + hl('M22 36Q26 31 34 30', 2.4)
        + `<path d="M28 31Q38 27 46 31L45 41Q37 44 29 41Z" fill="${C.pink}" ${T()}/>` + heart(37, 36, 2.8, '#fff')
        + `<path d="M50 38C52 28 54 22 58 18L66 26C61 29 58 34 57 42Z" fill="#fff" ${O()}/>`
        + `<path d="M55 16C61 9 72 12 74 20C76 27 70 31 65 30C61 29 57 26 55 22C53 19 53 17 55 16Z" fill="#fff" ${O()}/>`
        + `<ellipse cx="71" cy="25" rx="4.2" ry="3.4" fill="${C.blush}"/>` + happyEye(63, 19, 0.85)
        + `<path d="M57 14L55 6L61 11Z" fill="#fff" ${S()}/><path d="M61 11L68 1L66 13Z" fill="${C.gold}" ${T()}/>`
        + [[55, 13, 5, C.lilac], [51, 20, 5, C.pink], [50, 28, 4.5, C.sky], [51, 35, 4, C.lilac]].map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${T()}/>`).join('') + '</g>'
        + (on ? line('M4 50Q2 56 4 62M76 44Q79 50 77 56', INK, 1.6 * K, 0.4) + twinkle(10, 14, 3.5, C.gold) + heart(78, 8, 2.6, C.rose) : ''); },

    // pictures for the wall: on, they twinkle
    'bed-painting': on => `<rect x="2" y="3" width="56" height="45" rx="4" fill="${C.gold}" ${O()}/><rect x="8" y="9" width="44" height="33" rx="2" fill="#CFEAFF" ${T()}/>`
      + `<path d="M8 32Q20 26 34 31Q44 27 52 30V42H8Z" fill="${C.mint}"/>` + [[11, C.pink], [8.5, C.gold], [6, C.mint]].map(([r, c]) => `<path d="M${18 - r} 24A${r} ${r} 0 0 1 ${18 + r} 24" fill="none" stroke="${c}" stroke-width="2.4"/>`).join('')
      + uniHead(36, 26, 0.62, S()) + `<rect x="8" y="9" width="44" height="33" rx="2" fill="none" ${T()}/>`
      + hl('M6 12V8Q6 6 9 6H18', 2) + heart(30, 3, 3.6, C.rose, S())
      + (on ? twinkle(4, 4, 4, '#fff') + twinkle(56, 44, 4.5, '#fff') + twinkle(56, 6, 3, C.gold) + twinkle(3, 44, 3, C.gold) + twinkle(46, 14, 2.4) : ''),
    'bed-rainbow-pic': on => `<path d="M3 46V24A22 22 0 0 1 47 24V46Z" fill="${C.lilac}" ${O()}/><path d="M8 41V24A17 17 0 0 1 42 24V41Z" fill="${C.cream}" ${T()}/>`
      + [[13, C.pink], [10, C.gold], [7, C.mint], [4, C.sky]].map(([r, c]) => `<path d="M${25 - r} 37A${r} ${r} 0 0 1 ${25 + r} 37" fill="none" stroke="${c}" stroke-width="3"/>`).join('')
      + `<g transform="translate(13 36) scale(.62)">${tinyCloud(0, 0)}</g><g transform="translate(37 36) scale(.62)">${tinyCloud(0, 0)}</g>`
      + `<path d="M8 37A17 17 0 0 1 42 37" fill="none"/>` + `<path d="M8 41V24A17 17 0 0 1 42 24V41Z" fill="none" ${T()}/>` + hl('M7 30Q8 14 20 8', 2.2) + star(25, 12, 3.4, C.gold, S())
      + (on ? twinkle(4, 6, 4, C.gold) + twinkle(47, 8, 3.4) + twinkle(48, 40, 3, C.gold) + twinkle(14, 20, 2.4) : ''),
    'bed-garland': (on, o) => { const card = o && o.card, P = [[3, 5], [34, 26], [65, 8], [96, 26], [127, 5]];
      const q = (a, c, b, t) => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
      const pts = []; (card ? [[P[0], P[1], P[2]]] : [[P[0], P[1], P[2]], [P[2], P[3], P[4]]]).forEach(([a, c, b]) => [0.18, 0.39, 0.61, 0.82].forEach(t => pts.push(q(a, c, b, t))));
      const cols = [C.pink, C.rose, C.lilac, '#fff'];
      return line(card ? 'M3 5Q34 26 65 8' : 'M3 5Q34 26 65 8Q96 26 127 5', INK, 1.4 * K) + pts.map(([x, y], i) => line(`M${f(x)} ${f(y)}V${f(y + 4)}`, INK, 1.2 * K) + heart(x, y + 9, 5.2, cols[i % 4], S())).join('')
        + tied(3, 5) + (card ? '' : tied(127, 5)) + `<path d="M65 8L59 4V12ZM65 8L71 4V12Z" fill="${C.pink}" ${S()}/>` + tied(65, 8)
        + (on ? pts.filter((_, i) => i % 2).map(([x, y]) => twinkle(x + 7, y + 3, 3, C.gold)).join('') + twinkle(20, 30, 2.6) + twinkle(110, 30, 2.6) : ''); },
    // a wall clock with a moon face: on, the moon wakes up and the pendulum swings
    'bed-clock': on => `<g transform="rotate(${on ? 18 : 0} 23 40)">` + bar('M23 40V51', C.gold, 2) + `<circle cx="23" cy="53" r="4.6" fill="${C.gold}" ${T()}/></g>`
      + bar('M23 8V4', C.gold, 2) + star(23, 4, 4.5, C.gold, S())
      + `<circle cx="23" cy="26" r="18" fill="${C.lilac}" ${O()}/><circle cx="23" cy="26" r="14" fill="#FFF6D6" ${T()}/>`
      + Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<circle cx="${f(23 + Math.sin(a) * 11.4)}" cy="${f(26 - Math.cos(a) * 11.4)}" r="${i % 3 ? 0.9 : 1.4}" fill="${C.violet}"/>`; }).join('')
      + moon(19, 26, 8.5, C.gold, S()) + (on ? dotEye(17, 24, 1.2) : sleepEye(17, 24.5, 0.6)) + blush(16, 29, 1.6)
      + line('M23 26V18.5M23 26L28.5 28', INK, 1.6 * K) + `<circle cx="23" cy="26" r="1.6" fill="${C.rose}"/>` + hl('M10 22Q12 14 19 10', 2)
      + (on ? star(3, 12, 2.6, C.gold) + twinkle(43, 10, 3, C.gold) + twinkle(44, 40, 2.4, '#fff') + twinkle(3, 38, 2.4, '#fff') : ''),
    // fairy lights on a string: on, they shine
    'bed-fairylights': (on, o) => { const card = o && o.card, P = [[3, 4], [39, 22], [75, 6], [111, 22], [147, 4]];
      const q = (a, c, b, t) => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
      const pts = []; (card ? [[P[0], P[1], P[2]]] : [[P[0], P[1], P[2]], [P[2], P[3], P[4]]]).forEach(([a, c, b]) => [0.1, 0.3, 0.5, 0.7, 0.9].forEach(t => pts.push(q(a, c, b, t))));
      const cols = [C.pink, C.gold, C.mint, C.sky, C.lilac];
      const bulb = (x, y, c) => `<rect x="${f(x - 1.8)}" y="${f(y)}" width="3.6" height="3" rx="1" fill="${C.teal}" ${sw(1)}/><path d="M${f(x)} ${f(y + 2.5)}C${f(x + 4.2)} ${f(y + 5)} ${f(x + 4)} ${f(y + 11)} ${f(x)} ${f(y + 11)}C${f(x - 4)} ${f(y + 11)} ${f(x - 4.2)} ${f(y + 5)} ${f(x)} ${f(y + 2.5)}Z" fill="${c}" ${S()}/>`;
      const d = card ? 'M3 4Q39 22 75 6' : 'M3 4Q39 22 75 6Q111 22 147 4';
      let s = line(d, C.teal, 1.6) + line(d, INK, 0.8 * K, 0.6) + tied(3, 4) + (card ? '' : tied(147, 4)) + tied(75, 6);
      if (!on) return s + pts.map(([x, y], i) => bulb(x, y, shade(cols[i % 5], 0.5))).join('');
      return s + bright(pts.map(([x, y], i) => glow(x, y + 7, 13, cols[i % 5], 0.75)).join('') + pts.map(([x, y], i) => bulb(x, y, shade(cols[i % 5], 0.15)) + `<circle cx="${f(x - 1)}" cy="${f(y + 6)}" r="1.3" fill="#fff"/>`).join('')); },

    // a squishy beanbag: on, it squishes
    'bed-beanbag': on => shadow(30, 42, 27) + (on
      ? `<path d="M1 41C0 31 9 22 21 20C27 19 33 19 39 20C51 22 60 31 59 41Z" fill="${C.pink}" ${O()}/>` + line('M18 23Q30 30 42 23', C.blush, 2.4) + heart(30, 33, 5, '#fff') + hl('M8 34Q10 27 17 24', 2.5) + heart(10, 10, 3, C.rose) + heart(50, 8, 2.6, C.pink) + twinkle(30, 6, 3, C.gold)
      : `<path d="M4 41C0 28 8 16 20 12C26 10 34 10 40 12C52 16 60 28 56 41Z" fill="${C.pink}" ${O()}/>` + line('M18 15Q30 23 42 15M36 38Q46 36 52 30', C.blush, 2.4) + heart(30, 29, 5, '#fff') + hl('M10 32Q11 22 18 17', 2.5)),

    // a tea party table: on, the tea steams and twinkles
    'bed-teaparty': on => { const cup = (x, c) => `<ellipse cx="${x}" cy="31" rx="7" ry="2" fill="#fff" ${S()}/><path d="M${x + 4} 24Q${x + 8} 25 ${x + 4.5} 28.5" fill="none" stroke="${INK}" stroke-width="${f(1.5 * K)}"/><path d="M${x - 5} 23H${x + 5}L${x + 4} 29Q${x} 31 ${x - 4} 29Z" fill="${c}" ${S()}/>`;
      return shadow(37, 54, 34) + bar('M14 38L11 53M60 38L63 53', C.woodD, 3)
        + `<path d="M4 31H70L71 42${scallops(71, 3, 42, 7, 6)}L4 31Z" fill="${C.lilac}" ${O()}/>` + `<ellipse cx="37" cy="31" rx="33" ry="6.5" fill="${C.lav}" ${O()}/>`
        + [12, 24, 37, 50, 62].map(x => `<circle cx="${x}" cy="38" r="1.6" fill="#fff"/>`).join('')
        + cup(15, C.blush) + cup(59, C.mint)
        + `<path d="M28 20Q22 18 23 25Q24 29 29 27" fill="none" stroke="${INK}" stroke-width="${f(1.6 * K)}"/>` + `<path d="M45 23L52 16L54 17L48 27Z" fill="${C.pink}" ${S()}/>`
        + `<ellipse cx="37" cy="23" rx="10" ry="8" fill="${C.pink}" ${T()}/><ellipse cx="37" cy="15.5" rx="6" ry="2" fill="${C.rose}" ${S()}/><circle cx="37" cy="12.5" r="2" fill="${C.gold}" ${S()}/>` + heart(37, 23, 3, '#fff') + hl('M30 21Q31 17 34 16', 1.8)
        + (on ? line('M13 19Q11 15 14 12Q16 9 13 6M58 19Q56 15 59 12Q61 9 58 6M53 12Q51 8 54 5', '#fff', 2) + line('M13 19Q11 15 14 12Q16 9 13 6M58 19Q56 15 59 12Q61 9 58 6M53 12Q51 8 54 5', C.lilac, 0.8, 0.8)
          + twinkle(26, 6, 3.2, C.gold) + twinkle(68, 22, 3, C.gold) + heart(4, 20, 2.8, C.rose) : ''); },

    // a dollhouse: on, its windows light up
    'bed-dollhouse': on => { const win = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${on ? '#FFE07A' : C.glass}" ${S()}/>` + line(`M${x + w / 2} ${y}V${y + h}M${x} ${y + h / 2}H${x + w}`, '#fff', 1.4);
      const wins = win(14, 40, 11, 10) + win(41, 40, 11, 10) + win(13, 60, 11, 10) + `<circle cx="33" cy="25" r="5" fill="${on ? '#FFE07A' : C.glass}" ${S()}/>` + heart(33, 25.4, 2.4, on ? C.rose : '#fff');
      return shadow(33, 84, 30) + (on ? bright(glow(33, 50, 40, '#FFE9A0', 0.6)) : '')
        + `<rect x="45" y="11" width="7" height="16" rx="1.5" fill="${C.coral}" ${T()}/>`
        + `<rect x="8" y="33" width="50" height="43" fill="${C.blush}" ${O()}/>` + line('M8 55H58', INK, 1.4 * K, 0.4)
        + `<path d="M28 76V64A5 5 0 0 1 38 64V76Z" fill="${C.rose}" ${T()}/><circle cx="35.5" cy="70" r="1.2" fill="${C.gold}"/>` + `<path d="M41 61H52V70H41Z" fill="${C.mint}" ${S()}/>` + flower(46.5, 61, 3.4, C.pink)
        + `<path d="M2 37L33 8L64 37Z" fill="${C.lilac}" ${O()}/>` + line('M10 34L33 13L56 34', '#fff', 2, 0.6)
        + (on ? bright(wins) : wins) + `<rect x="4" y="75" width="58" height="8" rx="3" fill="${C.wood}" ${O()}/>` + hl('M12 40V50', 2) + star(33, 5, 3.4, C.gold, S()); },

    // a bunch of balloons: on, they sway
    'bed-balloons': on => { const B = [[23, 14, C.gold], [11, 30, C.pink], [35, 29, C.mint], [22, 44, C.lilac]];
      const g = `<g transform="rotate(${on ? 7 : 0} 23 96)">`;
      return shadow(23, 106, 12) + g + B.map(([x, y]) => line(`M${x} ${y + 13}Q${f((x + 23) / 2 + 3)} ${f((y + 95) / 2)} 23 95`, INK, 1.2 * K)).join('')
        + B.map(([x, y, c]) => `<path d="M${x} ${y + 12}l-2.5 3.5h5Z" fill="${c}" ${S()}/><ellipse cx="${x}" cy="${y}" rx="10" ry="12.5" fill="${c}" ${T()}/>` + hl(`M${x - 6} ${y - 3}Q${x - 5} ${y - 9} ${x - 1} ${y - 10}`, 2.2)).join('') + '</g>'
        + `<rect x="15" y="94" width="16" height="12" rx="3" fill="${C.sky}" ${T()}/><path d="M23 94V106" stroke="${C.pink}" stroke-width="2.6"/><path d="M23 94L17 89V98ZM23 94L29 89V98Z" fill="${C.pink}" ${S()}/>`
        + (on ? twinkle(4, 10, 3, C.gold) + twinkle(43, 44, 2.6, C.gold) + line('M42 20Q45 26 43 32', INK, 1.4 * K, 0.35) : ''); },

    // a reading tent: on, the lantern inside glows
    'bed-tent': on => { const inside = `<path d="M46 32Q37 62 27 92H65Q55 62 46 32Z" fill="${on ? '#FFDCA8' : '#7A5CC8'}"/>`
        + `<ellipse cx="46" cy="88" rx="15" ry="4.5" fill="${C.mint}" ${S()}/>` + bar('M46 34V46', C.gold, 1.2)
        + `<rect x="41.5" y="46" width="9" height="11" rx="2.5" fill="${on ? '#FFF1B8' : C.cream}" ${S()}/><rect x="40.5" y="44" width="11" height="3" rx="1.5" fill="${C.gold}" ${S()}/><rect x="40.5" y="56" width="11" height="3" rx="1.5" fill="${C.gold}" ${S()}/>`
        + (on ? `<path d="M45 49Q48 52 46 55Q43 52 45 49Z" fill="${C.amber}"/>` + glow(46, 52, 22, '#FFE07A', 0.8) + [[34, 70], [58, 72], [42, 64], [52, 62]].map(([x, y]) => twinkle(x, y, 2.4, '#FFF6CC')).join('') : '');
      return shadow(46, 96, 42) + bar('M33 12L46 24L59 12', C.woodD, 3)
        + `<path d="M46 18L4 94H88Z" fill="${C.pink}" ${O()}/>` + `<path d="M46 18L18 94H32L46 30ZM46 18L74 94H60L46 30Z" fill="${C.blush}"/>`
        + (on ? bright(inside) : inside)
        + `<path d="M46 30Q37 62 27 92Q22 78 30 66Q38 50 46 30ZM46 30Q55 62 65 92Q70 78 62 66Q54 50 46 30Z" fill="${C.rose}" ${T()}/>` + tied(31, 67) + tied(61, 67)
        + `<path d="M46 18L4 94H88Z" fill="none" ${O()}/>` + hl('M38 34L22 66', 2.5)
        + `<path d="M4 94H88" stroke="${INK}" stroke-width="${f(3 * K)}" stroke-linecap="round"/>` + star(46, 14, 6, C.gold, T())
        + [[14, 88, C.gold], [78, 88, C.mint]].map(([x, y, c]) => `<path d="M${x - 4} ${y - 4}H${x + 4}L${x} ${y + 3}Z" fill="${c}" ${S()}/>`).join(''); },

    // a drawing desk with crayons: on, her drawing twinkles
    'bed-desk': on => { const crayon = (x, y, a, c) => `<g transform="rotate(${a} ${x} ${y})"><rect x="${x - 1.8}" y="${y - 13}" width="3.6" height="13" fill="${c}" ${sw(1.1)}/><path d="M${x - 1.8} ${y - 13}L${x} ${y - 17}L${x + 1.8} ${y - 13}Z" fill="${c}" ${sw(1.1)}/></g>`;
      return shadow(38, 69, 34) + bar('M8 40V68M44 40V68', C.woodD, 3.4)
        + `<rect x="46" y="40" width="24" height="27" rx="3" fill="${C.cream}" ${O()}/>` + line('M49 53H67', INK, 1.3 * K, 0.35) + `<circle cx="58" cy="47" r="1.8" fill="${C.gold}" ${S()}/><circle cx="58" cy="60" r="1.8" fill="${C.gold}" ${S()}/>`
        + `<g transform="rotate(5 44 22)"><rect x="30" y="7" width="28" height="27" rx="1.5" fill="#fff" ${T()}/>`
        + (on ? heart(39, 16, 4.5, C.rose) + `<circle cx="51" cy="14" r="3.4" fill="${C.gold}"/>` + `<path d="M33 30Q44 22 55 30" fill="none" stroke="${C.mint}" stroke-width="2.6"/>` + star(48, 23, 3, C.lilac)
          : heart(39, 16, 4.5, C.pink) + `<circle cx="51" cy="14" r="3.4" fill="${C.gold}"/>` + `<path d="M33 30Q44 22 55 30" fill="none" stroke="${C.mint}" stroke-width="2.6"/>`) + '</g>'
        + crayon(12, 24, -14, C.rose) + crayon(15, 24, -3, C.gold) + crayon(18, 24, 8, C.mint) + crayon(21, 24, 18, C.lilac)
        + `<path d="M9 21H24L23 34H10Z" fill="${C.sky}" ${T()}/>` + heart(16.5, 27.5, 2.4, '#fff')
        + `<rect x="2" y="34" width="72" height="7" rx="3" fill="${C.wood}" ${O()}/>` + hl('M8 37H26', 2)
        + (on ? twinkle(62, 4, 3.6, C.gold) + twinkle(28, 6, 2.8, C.gold) + twinkle(60, 30, 2.6) : ''); },

    // a kitty curled in a basket: on, she sits up and purrs
    'bed-cat': on => { const c = '#FFCFA6', d = '#F7A96B';
      const front = `<path d="M3 27Q3 44 27 44Q51 44 51 27Q27 36 3 27Z" fill="${C.amber}" ${O()}/>` + line('M9 33Q27 41 45 33M7 38Q27 46 47 38', C.woodD, 1.4)
        + [12, 19, 27, 35, 42].map(x => line(`M${x} ${x < 27 ? 30 + (27 - x) * 0.05 : 30}V${x === 27 ? 43 : 41}`, C.woodD, 1.3)).join('') + hl('M8 32Q10 38 16 40', 2);
      let s = shadow(27, 44, 24) + `<ellipse cx="27" cy="27" rx="24" ry="6.5" fill="${C.woodD}" ${O()}/><ellipse cx="27" cy="27.5" rx="20" ry="4.5" fill="${C.pink}"/>`;
      if (!on) s += `<ellipse cx="25" cy="24" rx="15" ry="7.5" fill="${c}" ${T()}/>` + line('M18 19Q20 23 18 27M24 18Q26 22 24 27', d, 1.8)
        + `<path d="M31 14L32 7L37 12ZM40 12L44 7L44 15Z" fill="${c}" ${T()}/><circle cx="38" cy="19" r="7.5" fill="${c}" ${T()}/>`
        + sleepEye(35, 18.5, 0.6) + sleepEye(41, 18.5, 0.6) + `<path d="M37.2 21.6H38.8L38 22.6Z" fill="${C.rose}"/>` + blush(33.5, 22, 1.4) + blush(42.5, 22, 1.4)
        + front + bar('M8 30C2 26 6 18 12 22', c, 3.6);
      else s += `<path d="M9 28C2 22 6 12 12 16" fill="none" stroke="${INK}" stroke-width="${f(3.6 + 3 * K)}" stroke-linecap="round"/><path d="M9 28C2 22 6 12 12 16" fill="none" stroke="${c}" stroke-width="3.6" stroke-linecap="round"/>`
        + `<ellipse cx="27" cy="24" rx="10" ry="9" fill="${c}" ${T()}/><ellipse cx="27" cy="27" rx="5" ry="4.5" fill="#FFF1E2"/>`
        + `<path d="M19 9L20 0L26 5ZM35 9L34 0L28 5Z" fill="${c}" ${T()}/><path d="M20.5 6L21 2L24 4.5ZM33.5 6L33 2L30 4.5Z" fill="${C.blush}"/><circle cx="27" cy="11" r="8.5" fill="${c}" ${T()}/>`
        + line('M24 4Q27 6 30 4', d, 1.6) + dotEye(23.5, 10.5, 1.4) + dotEye(30.5, 10.5, 1.4) + `<path d="M26.2 13.4H27.8L27 14.4Z" fill="${C.rose}"/>` + line('M25 15.5Q27 17 29 15.5', INK, 1 * K) + blush(21, 14, 1.4) + blush(33, 14, 1.4)
        + front + `<ellipse cx="22" cy="29" rx="3.2" ry="2.2" fill="${c}" ${S()}/><ellipse cx="32" cy="29" rx="3.2" ry="2.2" fill="${c}" ${S()}/>` + heart(44, 6, 3, C.rose) + heart(8, 6, 2.4, C.pink);
      return s; },

    // a tall floor lamp: on, it shines
    'bed-floorlamp': on => { const shadeD = `M6 33L11 6H29L34 33${scallops(34, 6, 33, 5, 6)}Z`;
      const top = `<path d="${shadeD}" fill="${on ? '#FFE6F3' : C.pink}" ${O()}/>` + hl('M14 10L11 26', 2.2) + heart(20, 20, 4, on ? C.pink : '#fff')
        + [9, 15, 20, 25, 31].map(x => `<circle cx="${x}" cy="${x === 20 ? 40.5 : 39}" r="1.6" fill="${C.gold}"/>`).join('');
      return (on ? bright(glow(20, 24, 50) + `<path d="M8 38L-6 112H46L32 38Z" fill="#FFF0B8" opacity=".25"/>`) : '')
        + shadow(20, 117, 14) + `<ellipse cx="20" cy="113" rx="13" ry="4.4" fill="${C.gold}" ${O()}/>` + bar('M20 111V30', C.gold, 3)
        + heart(20, 72, 4, C.rose, S()) + (on ? bright(top + rays(20, 20, 22, 28, [-160, -120, -60, -20])) : top); },
  });
  for (const id in RUGS) ART[id] = (on, o, it) => RUGS[id](it.w / 2, it.h / 2, it.w / 2 - 3, it.h / 2 - 3);

  // ---- the catalogue ----
  const WALLS = {
    'bedroom-wall-stars': { name: 'Twinkle star wallpaper', price: 0 },
    'bedroom-wall-hearts': { name: 'Sweetheart wallpaper', price: 14 },
    'bedroom-wall-rainbow': { name: 'Rainbow cloud wallpaper', price: 21 },
    'wall-dots': { name: 'Polka dot wallpaper', price: 11 },
    'wall-stripes': { name: 'Candy stripe wallpaper', price: 14 },
    'wall-butterflies': { name: 'Butterfly wallpaper', price: 18 },
    'wall-waves': { name: 'Ocean wave wallpaper', price: 21 },
    'wall-toile': { name: 'Castle picture wallpaper', price: 25 },
    'wall-unicorns': { name: 'Unicorn wallpaper', price: 28 },
  };
  const FLOORS = {
    'floor-wood': { name: 'Honey wood floor', price: 0 },
    'floor-pink-tiles': { name: 'Pink heart tiles', price: 11 },
    'floor-lilac-carpet': { name: 'Lilac carpet', price: 14 },
    'floor-checks': { name: 'Minty checkerboard', price: 18 },
    'floor-clouds': { name: 'Cloud carpet', price: 21 },
    'floor-stars': { name: 'Starry carpet', price: 21 },
    'floor-rainbow': { name: 'Rainbow wood floor', price: 25 },
  };
  const it = (name, price, place, w, h, act, extra) => Object.assign({ name, price, place, w, h, act }, extra || {});
  const pillow = oy => ({ pillow: { x: HEAD.x, y: HEAD.y + oy, s: HEAD.s } });
  const ITEMS = {
    'bedroom-bed-pink': it('Pink princess bed', 0, 'floor', 150, 100, 'sleep', pillow(0)),
    'bedroom-bed-canopy': it('Canopy dream bed', 42, 'floor', 150, 158, 'sleep', pillow(58)),
    'bedroom-bed-cloud': it('Fluffy cloud bed', 53, 'floor', 150, 106, 'sleep', pillow(6)),
    'bedroom-bed-stars': it('Starry night bed', 0, 'floor', 150, 118, 'sleep', Object.assign({ gift: true }, pillow(18))),
    'bedroom-rug-round': it('Cozy round rug', 0, 'rug', 150, 40, 'none'),
    'bedroom-rug-heart': it('Sweetheart rug', 14, 'rug', 124, 46, 'none'),
    'bedroom-rug-flower': it('Flower petal rug', 18, 'rug', 140, 44, 'none'),
    'bedroom-rug-garden': it('Flower garden rug', 0, 'rug', 160, 46, 'none', { gift: true, from: 'Bloom' }),
    'bedroom-lamp': it('Bedside lamp', 0, 'floor', 54, 90, 'light'),
    'bedroom-toybox': it('Toy chest', 18, 'floor', 62, 79, 'chest'),
    'bedroom-petbed': it('Unicorn plush bed', 25, 'floor', 64, 53, 'squeak'),
    'bedroom-moon-lamp': it('Crescent moon lamp', 0, 'floor', 61, 96, 'light', { gift: true }),
    'bed-window': it('Window with curtains', 0, 'wall', 100, 118, 'curtain'),
    'bed-garland': it('Heart garland', 7, 'wall', 130, 38, 'sparkle'),
    'bed-balloons': it('Balloon bunch', 7, 'floor', 46, 108, 'rock'),
    'bed-plant': it('Flower pot', 8, 'floor', 42, 66, 'grow'),
    'bed-rainbow-pic': it('Rainbow picture', 8, 'wall', 50, 48, 'sparkle'),
    'bed-teddy': it('Teddy bear', 11, 'floor', 40, 48, 'squeak'),
    'bed-bunny': it('Bunny plush', 11, 'floor', 34, 56, 'squeak'),
    'bed-painting': it('Unicorn painting', 13, 'wall', 60, 50, 'sparkle'),
    'bed-beanbag': it('Squishy beanbag', 13, 'floor', 60, 44, 'squeak'),
    'bed-rug-star': it('Star rug', 13, 'rug', 130, 44, 'none'),
    'bed-nightlight': it('Star nightlight', 14, 'floor', 40, 54, 'stars'),
    'bed-clock': it('Moon clock', 14, 'wall', 46, 60, 'sparkle'),
    'bed-fairylights': it('Fairy lights', 15, 'wall', 150, 34, 'light'),
    'bed-rug-rainbow': it('Rainbow rug', 15, 'rug', 140, 42, 'none'),
    'bed-floorlamp': it('Tall flower lamp', 17, 'floor', 40, 118, 'light'),
    'bed-cat': it('Kitty in a basket', 18, 'floor', 54, 46, 'squeak'),
    'bed-teaparty': it('Tea party table', 20, 'floor', 74, 56, 'sparkle'),
    'bed-musicbox': it('Ballerina music box', 21, 'floor', 46, 70, 'music'),
    'bed-fishbowl': it('Goldfish bowl', 21, 'floor', 46, 80, 'swim'),
    'bed-desk': it('Drawing desk', 21, 'floor', 76, 70, 'sparkle'),
    'bed-bookshelf': it('Storybook shelf', 25, 'floor', 66, 106, 'books'),
    'bed-vanity': it('Heart mirror vanity', 28, 'floor', 72, 100, 'dress'),
    'bed-wardrobe': it('Princess wardrobe', 31, 'floor', 78, 126, 'dress'),
    'bed-rocking': it('Rocking unicorn', 35, 'floor', 80, 70, 'rock'),
    'bed-dollhouse': it('Dollhouse', 39, 'floor', 66, 86, 'light'),
    'bed-tent': it('Reading tent', 46, 'floor', 92, 98, 'light'),
  };
  const STARTER = { wall: 'bedroom-wall-stars', floor: 'floor-wood', items: [
    { id: 'bed-window', x: 196, y: 92 },
    { id: 'bedroom-rug-round', x: 196, y: 292 },
    { id: 'bedroom-lamp', x: 196, y: 246 },
    { id: 'bedroom-bed-pink', x: 312, y: 262 },
  ] };

  const svgOpen = (vb, label, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${extra} role="img" aria-label="${esc(label)}">`;

  // ---- the empty room ----
  function room(wallId, floorId, opt = {}) {
    K = 1;
    const wp = WALL_ART[wallId] || WALL_ART[STARTER.wall], fl = FLOOR_ART[floorId] || FLOOR_ART[STARTER.floor];
    const pat = uid('wall'), fsh = uid('fsh'), wsh = uid('wsh'), nf = uid('night'), night = !!opt.night;
    const body = `<defs>${pattern(pat, wp, 0, 0, 1)}
      <linearGradient id="${fsh}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${INK}" stop-opacity=".16"/><stop offset="1" stop-color="${INK}" stop-opacity="0"/></linearGradient>
      <linearGradient id="${wsh}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${INK}" stop-opacity="0"/><stop offset="1" stop-color="${INK}" stop-opacity=".08"/></linearGradient>
      ${night ? nightDef(nf) : ''}</defs>
      <g${night ? ` filter="url(#${nf})"` : ''}>
      <rect x="-200" y="-100" width="800" height="${FLOOR_Y + 100}" fill="url(#${pat})"/>
      <rect x="-200" y="120" width="800" height="${FLOOR_Y - 120}" fill="url(#${wsh})"/>
      <rect x="-200" y="${FLOOR_Y}" width="800" height="200" fill="${(FLOOR_ART[floorId] ? fl : FLOOR_ART['floor-wood']).edge}"/>
      ${fl.draw(FQ)}
      <rect x="-200" y="${FLOOR_Y}" width="800" height="34" fill="url(#${fsh})"/>
      <rect x="-200" y="-4" width="800" height="11" fill="#fff" ${O()}/><path d="M-200 4H600" stroke="#FFE3F1" stroke-width="2"/>
      <rect x="-200" y="${FLOOR_Y - 13}" width="800" height="13" fill="#fff" ${O()}/><path d="M-200 ${FLOOR_Y - 9}H600" stroke="#FFE3F1" stroke-width="2"/></g>`;
    return svgOpen('0 0 400 300', opt.label || 'The bedroom', 'preserveAspectRatio="xMidYMid slice"') + body + '</svg>';
  }

  // ---- one thing alone, filling its own box ----
  function item(id, opt = {}) {
    const I = ITEMS[id], art = ART[id]; if (!I || !art) return '';
    K = 1; OPEN.length = 0;
    const night = !!opt.night, nf = night ? uid('night') : null;
    let body;
    NF = nf;
    try { body = art(!!opt.on, opt, I); } finally { NF = null; OPEN.length = 0; }
    const inner = night ? `<defs>${nightDef(nf)}</defs><g filter="url(#${nf})">${body}</g>` : body;
    return svgOpen(`0 0 ${I.w} ${I.h}`, opt.label || I.name, 'preserveAspectRatio="xMidYMax meet" style="overflow:visible"') + inner + '</svg>';
  }

  // ---- a thing, wallpaper or floor on a square shop card ----
  // (the long strings show one swag, so their lights and hearts are big enough to see)
  const CARD_BOX = { 'bed-garland': [72, 38], 'bed-fairylights': [80, 34] };
  function piece(id) {
    let body = '', label = '';
    try {
      if (WALL_ART[id] && WALLS[id]) {
        K = 1; const wp = WALL_ART[id], p = uid('swatch'); label = WALLS[id].name;
        body = `<defs>${pattern(p, wp, 18, 18, wp.cs)}</defs>
          <rect x="9" y="9" width="82" height="82" rx="12" fill="${C.pink}" ${O()}/>
          <rect x="18" y="18" width="64" height="64" rx="5" fill="url(#${p})" ${T()}/>
          ${hl('M14 30V18Q14 14 18 14H30', 2.5)}${twinkle(88, 12, 7, C.gold)}`;
      } else if (FLOOR_ART[id] && FLOORS[id]) {
        K = 1; const q = { bl: [20, 30], br: [80, 30], fl: [5, 76], fr: [95, 76] }, cl = uid('tile'), d = FLOOR_ART[id]; label = FLOORS[id].name;
        body = `<defs><clipPath id="${cl}"><path d="${quadD(q)}"/></clipPath></defs>
          <path d="M5 76H95V84H5Z" fill="${d.edge}" ${O()}/>
          <g clip-path="url(#${cl})">${d.draw(q)}</g>
          <path d="${quadD(q)}" fill="none" ${O()}/>${twinkle(88, 18, 6, C.gold)}`;
      } else if (ITEMS[id] && ITEMS[id].place === 'rug') {
        K = 1; label = ITEMS[id].name; body = RUGS[id](50, 54, 43, 27) + twinkle(86, 20, 6, C.gold);
      } else if (ITEMS[id]) {
        const I = ITEMS[id], box = CARD_BOX[id] || [I.w, I.h], s = Math.min(84 / box[0], 84 / box[1]); label = I.name;
        K = 0.95 / s; OPEN.length = 0; NF = null;
        const tx = 50 - box[0] * s / 2, ty = 50 - box[1] * s / 2;
        body = `<g transform="translate(${f(tx)} ${f(ty)}) scale(${+s.toFixed(4)})">${ART[id](false, { card: true }, I)}</g>`;
      } else return '';
    } finally { K = 1; }
    return svgOpen('0 0 100 100', label) + body + '</svg>';
  }

  root.SparkleBedroom = { FLOOR_Y, WALLS, FLOORS, ITEMS, STARTER, room, item, piece };
})(typeof window !== 'undefined' ? window : globalThis);
