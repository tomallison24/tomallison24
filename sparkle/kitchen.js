'use strict';

// The castle kitchen, drawn in code as SVG, for the Unicorn Bakery (counting and early sums with
// Pebble the dragon) and Pattern Parade (finish the pattern). The look matches art.js and rooms.js:
// soft rounded shapes, a deep plum outline (never black), flat pastel colour with one gentle
// highlight, and twinkles. No words, letters or numbers anywhere (dots are fine: a sack of ten
// shows its ten dots).
//
//   SparkleKitchen.scene(opt)        the kitchen, <svg viewBox="0 0 400 300" slice>: a tiled wall, a
//                                    window, shelves of jars and copper pots, and a long wooden
//                                    counter along the bottom third (its top at y 200; the middle,
//                                    x 90 to 310, is left clear for the bowl). opt.label: aria-label
//   SparkleKitchen.bowl(opt)         the mixing bowl from the front, open at the top,
//                                    <svg viewBox="0 0 200 120">; opt.mix: batter swirled inside
//                                    (and a wooden spoon)
//   SparkleKitchen.ing(id)           one ingredient, <svg viewBox="0 0 60 60"> (ING lists the ids)
//   SparkleKitchen.oven(opt)         the friendly oven, <svg viewBox="0 0 160 170">; opt.on: the
//                                    window glows warm orange with a treat inside (opt.treat, a
//                                    treat id; a cupcake when it's missing)
//   SparkleKitchen.treat(id)         a baked treat, <svg viewBox="0 0 100 100"> (TREATS lists the ids)
//   SparkleKitchen.plate(opt)        an empty plate seen a little from above, <svg viewBox="0 0 120 50">;
//                                    opt.color: the rim's dots, a COLORS name (pink when missing)
//   SparkleKitchen.sack()            a sack of ten: a little flour sack with ten dots in two rows
//                                    of five, <svg viewBox="0 0 80 90">
//   SparkleKitchen.shape(id, color)  a Pattern Parade piece, <svg viewBox="0 0 60 60">; id from
//                                    SHAPES, color from COLORS. shapeInner(id, color) is the same
//                                    piece as markup without the <svg> (60 by 60 units)
//   SparkleKitchen.float(id, color)  a parade float on little wheels carrying that piece,
//                                    <svg viewBox="0 0 90 110">. float() with no id is the empty one:
//                                    a sparkly spot waiting for the answer. The first argument may
//                                    instead be a piece's inner markup (60 by 60 units, such as
//                                    shapeInner's), drawn as it is. Floats in a row touch hitches.
//   SparkleKitchen.ING / TREATS / SHAPES   { id: name } (names for aria-labels and the voice)
//   SparkleKitchen.COLORS            { pink, lilac, mint, gold, sky, coral: hex }
//
// Gradients and clip paths get their own ids (uid) so many pictures can share a page.
(function (root) {
  let n = 0;
  const uid = p => `sk${p}${++n}`;
  const INK = '#4B2E6F';
  const C = {
    pink: '#FF8FC7', blush: '#FFB3DA', rose: '#FF5FA8', lilac: '#B79BFF', lav: '#D9CCFF', mint: '#7FE0C7', sky: '#8FD3FF',
    gold: '#FFC94A', amber: '#F5A623', cream: '#FFF6E9', white: '#FFFFFF', peach: '#FFC7A8', coral: '#FF8A7A', berry: '#C04B9A', teal: '#4FC3B8',
    wood: '#E9B872', woodD: '#C98B5E', woodL: '#F6D6A2', copper: '#F0A274', copperD: '#D27B53', pastry: '#F5C783', pastryD: '#E0A35E', choc: '#9A5B34',
  };

  // Outline widths are multiplied by K: 1 normally, more when a picture is shrunk into another
  // (the treat in the oven), so the outline looks the same thickness everywhere.
  let K = 1;
  const f = v => +(+v).toFixed(1);
  const sw = w => `stroke="${INK}" stroke-width="${f(w * K)}" stroke-linejoin="round" stroke-linecap="round"`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const svg = (vb, body, label, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${extra} ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${body}</svg>`;
  const shade = (hex, k) => { const v = parseInt(hex.slice(1), 16); const r = v >> 16, g = (v >> 8) & 255, b = v & 255;
    const h = x => Math.max(0, Math.min(255, Math.round(k < 0 ? x * (1 + k) : x + (255 - x) * k)));
    return '#' + [h(r), h(g), h(b)].map(x => x.toString(16).padStart(2, '0')).join(''); };

  // ---- small pieces ----
  const starPts = (x, y, r, inner = 0.48, pts = 5) => { const p = []; for (let i = 0; i < pts * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / pts, rr = i % 2 ? r * inner : r; p.push(`${f(x + Math.cos(a) * rr)},${f(y + Math.sin(a) * rr)}`); } return p.join(' '); };
  const star = (x, y, r, fill = C.gold, extra = '', inner = 0.48) => `<polygon points="${starPts(x, y, r, inner)}" fill="${fill}" ${extra}/>`;
  const twinkle = (x, y, r, fill = '#fff') => `<path d="M${f(x)} ${f(y - r)}Q${f(x + r * 0.18)} ${f(y - r * 0.18)} ${f(x + r)} ${f(y)}Q${f(x + r * 0.18)} ${f(y + r * 0.18)} ${f(x)} ${f(y + r)}Q${f(x - r * 0.18)} ${f(y + r * 0.18)} ${f(x - r)} ${f(y)}Q${f(x - r * 0.18)} ${f(y - r * 0.18)} ${f(x)} ${f(y - r)}Z" fill="${fill}"/>`;
  const heartD = (x, y, s) => `M${f(x)} ${f(y + s * 0.9)}C${f(x - s * 1.4)} ${f(y - s * 0.1)} ${f(x - s * 0.7)} ${f(y - s * 1.1)} ${f(x)} ${f(y - s * 0.35)}C${f(x + s * 0.7)} ${f(y - s * 1.1)} ${f(x + s * 1.4)} ${f(y - s * 0.1)} ${f(x)} ${f(y + s * 0.9)}Z`;
  const heart = (x, y, s, fill = C.rose, extra = '') => `<path d="${heartD(x, y, s)}" fill="${fill}" ${extra}/>`;
  const shadow = (cx, cy, rx, ry = rx * 0.13) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${INK}" opacity=".13"/>`;
  // the soft highlight on a shape
  const hl = (d, w = 3) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${f(w * (K > 1 ? (1 + K) / 2 : 1))}" stroke-linecap="round" opacity=".7"/>`;
  // a coloured line with an outline (handles, stems, rods)
  const bar = (d, col, w) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f(w + 3 * K)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  // shapes merged under one outline (clouds, puffs): [x, y, r] circles and [x, y, w, h, rx] rects
  const blob = (shapes, fill, g = 1.5) => {
    const one = (s, d, col) => s.length === 3 ? `<circle cx="${f(s[0])}" cy="${f(s[1])}" r="${f(s[2] + d)}" fill="${col}"/>`
      : `<rect x="${f(s[0] - d)}" y="${f(s[1] - d)}" width="${f(s[2] + 2 * d)}" height="${f(s[3] + 2 * d)}" rx="${f((s[4] || 0) + d)}" fill="${col}"/>`;
    return shapes.map(s => one(s, g * K, INK)).join('') + shapes.map(s => one(s, 0, fill)).join('');
  };
  const sprinkle = (x, y, a, col, len = 6, w = 2.6) => { const dx = Math.cos(a * Math.PI / 180) * len / 2, dy = Math.sin(a * Math.PI / 180) * len / 2;
    return `<path d="M${f(x - dx)} ${f(y - dy)}L${f(x + dx)} ${f(y + dy)}" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round"/>`; };
  const SPR = [C.gold, C.mint, C.sky, C.lilac, '#fff', C.rose];
  const rng = seed => { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
  const scaled = (x, y, s, body) => `<g transform="translate(${f(x)} ${f(y)}) scale(${+s.toFixed(4)})">${body}</g>`;

  // ======================================================================================
  // ---- ingredients (60 by 60) ----
  const ING = {
    strawberry: 'Strawberry', blueberry: 'Blueberry', cherry: 'Cherry', egg: 'Egg', butter: 'Butter', sugar: 'Sugar cube',
    chocolate: 'Chocolate', banana: 'Banana slice', lemon: 'Lemon slice', sprinkles: 'Sprinkles', flour: 'Flour', milk: 'Milk',
    apple: 'Apple', carrot: 'Carrot', marshmallow: 'Marshmallow',
  };
  const ING_ART = {
    strawberry: () => `<path d="M30 55C17 50 8 37 9 26C10 17 20 14 30 18C40 14 50 17 51 26C52 37 43 50 30 55Z" fill="#FF6584" ${sw(3)}/>`
      + [[20, 27], [30, 26], [40, 27], [25, 36], [35, 36], [30, 45], [17, 37], [43, 37]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.6" ry="2.3" fill="#FFF0A8"/>`).join('')
      + `<path d="M30 21L19 17L25 14.5L22 8.5L30 12.5L38 8.5L35 14.5L41 17Z" fill="#7FD98F" ${sw(2.5)}/>` + bar('M30 12C30 9 31 6 33 4', '#5DBB73', 2.5)
      + hl('M14 30Q14 24 19 22', 3),
    blueberry: () => `<circle cx="30" cy="32" r="21" fill="#7C8BF2" ${sw(3)}/><ellipse cx="38" cy="40" rx="9" ry="7" fill="#9AA6FF" opacity=".7"/>`
      + `<polygon points="${starPts(30, 19, 7, 0.45)}" fill="#535CC2" ${sw(2)}/><circle cx="30" cy="19" r="1.8" fill="#3E4596"/>`
      + hl('M15 30Q16 22 22 18', 3.4) + `<circle cx="16" cy="37" r="2" fill="#fff" opacity=".7"/>`,
    cherry: () => `<path d="M28 26C29 18 33 11 41 5" fill="none" stroke="${INK}" stroke-width="${f(6 * K)}" stroke-linecap="round"/><path d="M28 26C29 18 33 11 41 5" fill="none" stroke="#5DBB73" stroke-width="${f(3)}" stroke-linecap="round"/>`
      + `<path d="M40 6C46 2 54 5 55 10C49 13 43 12 40 6Z" fill="#7FD98F" ${sw(2.5)}/>`
      + `<path d="M28 26C20 21 9 25 9 37C9 48 19 56 29 55C39 56 49 48 48 37C48 25 37 21 28 26Z" fill="#EE4A72" ${sw(3)}/>`
      + hl('M15 36Q15 30 20 28', 3.4) + `<circle cx="17" cy="42" r="1.8" fill="#fff" opacity=".7"/>`,
    egg: () => `<path d="M30 5C42 5 50 24 50 36C50 48 41 56 30 56C19 56 10 48 10 36C10 24 18 5 30 5Z" fill="#FFF3E2" ${sw(3)}/>`
      + `<path d="M38 50C44 46 47 40 47 34" fill="none" stroke="#F3DCC0" stroke-width="5" stroke-linecap="round"/>`
      + `<circle cx="36" cy="22" r="1.4" fill="#E9CBA6"/><circle cx="24" cy="44" r="1.2" fill="#E9CBA6"/><circle cx="40" cy="38" r="1.2" fill="#E9CBA6"/>`
      + hl('M18 30Q20 18 26 13', 3.4),
    butter: () => `<ellipse cx="30" cy="51" rx="24" ry="4" fill="${INK}" opacity=".12"/>`
      + `<path d="M6 28L18 15H54L44 28Z" fill="#FFF3B5" ${sw(3)}/><path d="M44 28L54 15V36L44 49Z" fill="#F8D25C" ${sw(3)}/><rect x="6" y="28" width="38" height="21" rx="2" fill="#FFE37A" ${sw(3)}/>`
      + `<path d="M22 22Q27 18 31 22T40 22" fill="none" stroke="#F8D25C" stroke-width="2.6" stroke-linecap="round"/>` + hl('M11 34V43', 3),
    sugar: () => `<ellipse cx="30" cy="54" rx="22" ry="3.5" fill="${INK}" opacity=".12"/>`
      + `<path d="M9 24L21 12H51L39 24Z" fill="#FFFFFF" ${sw(3)}/><path d="M39 24L51 12V42L39 54Z" fill="#E1D8FA" ${sw(3)}/><rect x="9" y="24" width="30" height="30" rx="2" fill="#F4F0FF" ${sw(3)}/>`
      + [[15, 31], [24, 36], [32, 30], [17, 44], [30, 46], [45, 30], [46, 42], [28, 17], [40, 16]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="${C.lilac}" opacity=".6"/>`).join('')
      + hl('M14 30V46', 3) + twinkle(52, 8, 5, C.gold),
    chocolate: () => `<rect x="7" y="8" width="46" height="46" rx="6" fill="#8E5232" ${sw(3)}/>`
      + [[12, 13], [32, 13], [12, 33], [32, 33]].map(([x, y]) => `<rect x="${x}" y="${y}" width="16" height="16" rx="3" fill="#AE6D45"/><path d="M${x + 3} ${y + 13}V${y + 3}H${x + 13}" fill="none" stroke="#C98B5E" stroke-width="2.4" stroke-linecap="round"/>`).join('')
      + hl('M11 16V30', 2.6),
    banana: () => `<ellipse cx="30" cy="33" rx="23" ry="22" fill="#FFE27A" ${sw(3)}/><ellipse cx="30" cy="31" rx="19.5" ry="18.5" fill="#FFF6CF"/>`
      + `<ellipse cx="30" cy="31" rx="8" ry="7.5" fill="#FFEDB0"/>`
      + [0, 72, 144, 216, 288].map(a => `<ellipse cx="${f(30 + 6 * Math.cos((a - 90) * Math.PI / 180))}" cy="${f(31 + 6 * Math.sin((a - 90) * Math.PI / 180))}" rx="1.6" ry="2.2" transform="rotate(${a} ${f(30 + 6 * Math.cos((a - 90) * Math.PI / 180))} ${f(31 + 6 * Math.sin((a - 90) * Math.PI / 180))})" fill="#B88A4A"/>`).join('')
      + hl('M15 26Q17 19 23 16', 3),
    lemon: () => `<circle cx="30" cy="32" r="23" fill="#FFD23F" ${sw(3)}/><circle cx="30" cy="32" r="19" fill="#FFFBE8"/>`
      + Array.from({ length: 8 }, (_, k) => { const a0 = (k * 45 + 4) * Math.PI / 180, a1 = (k * 45 + 41) * Math.PI / 180, r = 16.5;
        return `<path d="M${f(30 + 2.4 * Math.cos((a0 + a1) / 2))} ${f(32 + 2.4 * Math.sin((a0 + a1) / 2))}L${f(30 + r * Math.cos(a0))} ${f(32 + r * Math.sin(a0))}A${r} ${r} 0 0 1 ${f(30 + r * Math.cos(a1))} ${f(32 + r * Math.sin(a1))}Z" fill="#FFE660" stroke="#FFE660" stroke-width="1.2" stroke-linejoin="round"/>`; }).join('')
      + `<circle cx="30" cy="32" r="2.4" fill="#FFFBE8"/>` + hl('M13 26Q15 18 22 14', 3),
    sprinkles: () => `<ellipse cx="30" cy="52" rx="25" ry="4" fill="${INK}" opacity=".12"/>`
      + `<path d="M5 51C8 38 17 24 30 22C43 24 52 38 55 51Z" fill="#FFE1EF" ${sw(3)}/>`
      + (() => { const r = rng(7); let s = ''; for (let i = 0; i < 34; i++) { const y = 28 + r() * 19, half = (y - 22) * 0.9, x = 30 + (r() * 2 - 1) * half; s += sprinkle(x, y, r() * 180, [C.rose, C.gold, '#5FD3B5', '#6FB8F5', '#9C7CF5'][i % 5], 6, 2.8); } return s; })()
      + sprinkle(18, 12, 40, C.rose, 6, 2.8) + sprinkle(30, 8, 120, '#6FB8F5', 6, 2.8) + sprinkle(42, 13, 70, C.gold, 6, 2.8),
    flour: () => bar('M44 40L56 31', '#B2A1F0', 6)
      + `<path d="M5 36C7 22 17 15 26 15C35 15 45 22 47 36Z" fill="#FFFFFF" ${sw(3)}/>`
      + `<path d="M6 36H46C46 48 38 55 26 55C14 55 6 48 6 36Z" fill="${C.lilac}" ${sw(3)}/><path d="M6 36H46" ${sw(3)}/>`
      + `<path d="M12 43Q16 49 22 50" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>`
      + [[18, 27], [26, 22], [34, 28], [24, 31]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#E6DCF5"/>`).join('')
      + `<circle cx="14" cy="9" r="2.6" fill="#fff" ${sw(1.5)}/><circle cx="38" cy="7" r="2" fill="#fff" ${sw(1.5)}/>` + twinkle(50, 14, 4.5, C.gold),
    milk: () => `<path d="M23 15V19C23 22 12 25 12 33V51C12 54 14 56 17 56H43C46 56 48 54 48 51V33C48 25 37 22 37 19V15Z" fill="#FFFFFF" ${sw(3)}/>`
      + `<rect x="20" y="5" width="20" height="11" rx="3.5" fill="${C.sky}" ${sw(3)}/><path d="M24 8.5V12.5M30 8.5V12.5M36 8.5V12.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>`
      + `<rect x="15" y="34" width="30" height="15" rx="4" fill="#DFF1FF"/>` + heart(30, 41, 5.5, C.pink, sw(2))
      + hl('M17 32V50', 3),
    apple: () => `<path d="M30 17C20 11 8 16 8 32C8 46 18 57 27 55C29 54.5 31 54.5 33 55C42 57 52 46 52 32C52 16 40 11 30 17Z" fill="#9BE07F" ${sw(3)}/>`
      + bar('M30 18C30 13 31 9 33 6', C.choc, 2.6) + `<path d="M33 12C37 5 45 4 49 7C45 13 38 14 33 12Z" fill="${C.teal}" ${sw(2.4)}/>`
      + `<ellipse cx="40" cy="44" rx="7" ry="6" fill="#B9EE9E" opacity=".8"/>` + hl('M14 30Q15 22 21 19', 3.4),
    carrot: () => `<g transform="rotate(35 30 31)">`
      + [[-28, C.teal], [0, '#5DBB73'], [28, C.teal]].map(([a, c]) => `<ellipse cx="30" cy="9" rx="4" ry="9" transform="rotate(${a} 30 17)" fill="${c}" ${sw(2.4)}/>`).join('')
      + `<path d="M19 19C19 14 41 14 41 19C41 30 35 46 30 57C25 46 19 30 19 19Z" fill="#FFA048" ${sw(3)}/>`
      + `<path d="M22 27H28M33 34H38M24 40H29M31 47H34" stroke="#E5762A" stroke-width="2.4" stroke-linecap="round"/>` + hl('M23 22Q23 32 26 40', 2.8) + `</g>`,
    marshmallow: () => `<ellipse cx="30" cy="52" rx="22" ry="4" fill="${INK}" opacity=".12"/>`
      + `<path d="M11 21V43C11 49 20 53 30 53C40 53 49 49 49 43V21Z" fill="#FFD2E8" ${sw(3)}/><ellipse cx="30" cy="21" rx="19" ry="8" fill="#FFF3F9" ${sw(3)}/>`
      + `<path d="M15 28V42" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".7"/><ellipse cx="25" cy="19" rx="6" ry="2" fill="#fff"/>`,
  };
  function ing(id) {
    if (!ING_ART[id]) return '';
    K = 1; return svg('0 0 60 60', ING_ART[id](), ING[id]);
  }

  // ======================================================================================
  // ---- treats (100 by 100) ----
  const TREATS = { cupcake: 'Rainbow cupcake', cookie: 'Star cookie', pie: 'Berry pie', muffin: 'Blueberry muffin', donut: 'Pink donut', cake: 'Strawberry cake', carrotcake: 'Carrot cake', tart: 'Lemon tart' };
  const pleats = (xs, y0, y1, col = '#fff') => xs.map(([a, b]) => `<path d="M${a} ${y0}L${b} ${y1}" stroke="${col}" stroke-width="${f(3)}" stroke-linecap="round" opacity=".55"/>`).join('');
  const smallBerry = (x, y, s) => `<path d="M${f(x)} ${f(y + 13 * s)}C${f(x - 10 * s)} ${f(y + 9 * s)} ${f(x - 12 * s)} ${f(y - 2 * s)} ${f(x - 8 * s)} ${f(y - 5 * s)}C${f(x - 5 * s)} ${f(y - 8 * s)} ${f(x - 2 * s)} ${f(y - 7 * s)} ${f(x)} ${f(y - 5 * s)}C${f(x + 2 * s)} ${f(y - 7 * s)} ${f(x + 5 * s)} ${f(y - 8 * s)} ${f(x + 8 * s)} ${f(y - 5 * s)}C${f(x + 12 * s)} ${f(y - 2 * s)} ${f(x + 10 * s)} ${f(y + 9 * s)} ${f(x)} ${f(y + 13 * s)}Z" fill="#FF6584" ${sw(3)}/>`
    + [[-4, 0], [4, 0], [0, 5], [-3, 8], [3, 8]].map(([u, v]) => `<ellipse cx="${f(x + u * s)}" cy="${f(y + v * s)}" rx="${f(1.1 * s)}" ry="${f(1.6 * s)}" fill="#FFF0A8"/>`).join('')
    + `<path d="M${f(x)} ${f(y - 4 * s)}L${f(x - 8 * s)} ${f(y - 8 * s)}L${f(x - 3 * s)} ${f(y - 9 * s)}L${f(x)} ${f(y - 14 * s)}L${f(x + 3 * s)} ${f(y - 9 * s)}L${f(x + 8 * s)} ${f(y - 8 * s)}Z" fill="#7FD98F" ${sw(2.2)}/>`;
  const TREAT_ART = {
    cupcake: () => shadow(50, 93, 26, 3.5)
      + `<path d="M23 60H77L69 92H31Z" fill="${C.pink}" ${sw(3.5)}/>` + pleats([[33, 35], [41, 43], [50, 50], [59, 57], [67, 65]].map(([a, b]) => [a, b]), 63, 89)
      + `<rect x="15" y="49" width="70" height="17" rx="8.5" fill="${C.lilac}" ${sw(3.5)}/>`
      + `<rect x="21" y="37" width="58" height="16" rx="8" fill="${C.sky}" ${sw(3.5)}/>`
      + `<rect x="28" y="26" width="44" height="15" rx="7.5" fill="${C.mint}" ${sw(3.5)}/>`
      + `<rect x="35" y="16" width="30" height="14" rx="7" fill="${C.gold}" ${sw(3.5)}/>`
      + hl('M21 56Q22 53 26 53', 3) + hl('M27 44Q28 41 31 41', 3) + hl('M34 33Q35 30 38 30', 3) + hl('M41 22Q42 20 45 20', 2.6)
      + bar('M52 12C52 8 55 5 58 3', '#5DBB73', 2.4) + `<circle cx="51" cy="12" r="6.5" fill="#EE4A72" ${sw(3)}/><circle cx="49" cy="10" r="1.8" fill="#fff" opacity=".8"/>`
      + twinkle(86, 30, 5, C.gold) + twinkle(13, 36, 3.5, C.gold),
    cookie: () => shadow(50, 94, 34, 4)
      + `<polygon points="${starPts(50, 54, 43, 0.52)}" fill="#EFB060" ${sw(4.5)}/>`
      + `<polygon points="${starPts(50, 54, 33, 0.52)}" fill="#FFC4E1" stroke="#FFC4E1" stroke-width="${f(5)}" stroke-linejoin="round"/>`
      + `<polygon points="${starPts(50, 54, 33, 0.52)}" fill="none" stroke="#fff" stroke-width="${f(2.2)}" stroke-dasharray="1 5" stroke-linecap="round" stroke-linejoin="round"/>`
      + [[50, 34, 20], [37, 52, 120], [62, 50, 60], [44, 66, 160], [58, 66, 30], [50, 52, 90]].map(([x, y, a], i) => sprinkle(x, y, a, [C.gold, '#5FD3B5', '#6FB8F5', '#9C7CF5', C.rose, '#fff'][i], 6, 3)).join('')
      + hl('M33 41L42 41', 3) + twinkle(88, 22, 5, C.gold),
    pie: () => { const cl = uid('pie');
      return shadow(50, 90, 40, 4) + `<defs><clipPath id="${cl}"><ellipse cx="50" cy="50" rx="33" ry="13"/></clipPath></defs>`
        + `<path d="M8 51H92L84 82Q83 87 77 87H23Q17 87 16 82Z" fill="${C.sky}" ${sw(3.5)}/>`
        + [22, 34, 46, 58, 70, 80].map((x, i) => `<path d="M${x - (i < 3 ? 2 : 0)} 60L${x - (i < 3 ? 0 : 2) + 1} 82" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".55"/>`).join('')
        + `<ellipse cx="50" cy="50" rx="44" ry="20" fill="${C.pastry}" ${sw(3.5)}/><ellipse cx="50" cy="50" rx="44" ry="20" fill="none" stroke="${C.pastryD}" stroke-width="2.4" stroke-dasharray="1 6.5" stroke-linecap="round" transform="translate(50 50) scale(.9) translate(-50 -50)"/>`
        + `<ellipse cx="50" cy="50" rx="33" ry="13" fill="${C.berry}" ${sw(2.6)}/>`
        + `<g clip-path="url(#${cl})">${[20, 36, 52, 68, 84].map(x => `<circle cx="${x - 8}" cy="${48 + (x % 3)}" r="3" fill="#7C5CC4"/>`).join('')}`
        + [30, 48, 66].map(x => `<path d="M${x} 32L${x + 8} 68" stroke="${INK}" stroke-width="${f(5.5 + 2.4 * K)}"/><path d="M${x} 32L${x + 8} 68" stroke="${C.pastry}" stroke-width="5.5"/>`).join('')
        + [45, 55].map(y => `<path d="M10 ${y}H90" stroke="${INK}" stroke-width="${f(5 + 2.4 * K)}"/><path d="M10 ${y}H90" stroke="${C.pastry}" stroke-width="5"/>`).join('') + `</g>`
        + `<ellipse cx="50" cy="50" rx="33" ry="13" fill="none" ${sw(2.6)}/>`
        + hl('M16 44Q22 36 34 33', 3) + twinkle(86, 24, 5, C.gold) + twinkle(14, 26, 3.5, C.gold); },
    muffin: () => shadow(50, 93, 26, 3.5)
      + `<path d="M24 60H76L69 92H31Z" fill="${C.mint}" ${sw(3.5)}/>` + pleats([[33, 36], [42, 44], [50, 50], [58, 56], [67, 64]], 63, 89)
      + `<path d="M15 60C10 52 16 43 24 43C24 28 37 19 50 21C63 19 76 28 76 43C84 43 90 52 85 60C80 67 20 67 15 60Z" fill="#E9A65A" ${sw(3.5)}/>`
      + `<path d="M28 40C30 32 38 27 46 27" fill="none" stroke="#F6C98C" stroke-width="5" stroke-linecap="round"/>`
      + [[38, 40], [56, 33], [64, 50], [30, 55], [48, 55], [72, 42]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#6F7DE8" ${sw(2.2)}/><circle cx="${x - 1.5}" cy="${y - 1.5}" r="1.3" fill="#fff" opacity=".7"/>`).join('')
      + [[46, 44], [60, 42], [36, 50], [22, 50], [78, 54]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#fff" opacity=".85"/>`).join('')
      + twinkle(86, 26, 5, C.gold),
    donut: () => { const ring = (cx, cy, rx, ry, hx, hy, hrx, hry) => `M${f(cx - rx)} ${f(cy)}A${rx} ${ry} 0 1 0 ${f(cx + rx)} ${f(cy)}A${rx} ${ry} 0 1 0 ${f(cx - rx)} ${f(cy)}ZM${f(hx - hrx)} ${f(hy)}A${hrx} ${hry} 0 1 1 ${f(hx + hrx)} ${f(hy)}A${hrx} ${hry} 0 1 1 ${f(hx - hrx)} ${f(hy)}Z`;
      // the frosting: a soft wavy ring with a few drips
      let fr = ''; const N = 14;
      for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, r = i % 2 ? 1 : 0.93, x = 50 + Math.cos(a) * 37 * r, y = 49 + Math.sin(a) * 27 * r;
        fr += i === 0 ? `M${f(x)} ${f(y)}` : `Q${f(50 + Math.cos(a - Math.PI / N) * 37 * 1.06)} ${f(49 + Math.sin(a - Math.PI / N) * 27 * 1.06)} ${f(x)} ${f(y)}`; }
      fr += `ZM37 49A13 9 0 1 1 63 49A13 9 0 1 1 37 49Z`;
      const r = rng(11); let spr = '';
      for (let i = 0; i < 22; i++) { const a = r() * Math.PI * 2, d = 0.5 + r() * 0.36; spr += sprinkle(50 + Math.cos(a) * 33 * d, 49 + Math.sin(a) * 24 * d, r() * 180, SPR[i % SPR.length], 6, 2.8); }
      return shadow(50, 92, 38, 4.5) + `<path d="${ring(50, 55, 43, 33, 50, 51, 13, 9)}" fill="#EFB060" fill-rule="evenodd" ${sw(3.5)}/>`
        + `<path d="${fr}" fill="${C.pink}" fill-rule="evenodd" ${sw(3)}/>`
        + `<path d="M38 50A12 6 0 0 1 62 50A12 8.5 0 0 0 38 50Z" fill="#D9934A"/>` + spr
        + hl('M20 40Q26 30 38 27', 3.4) + twinkle(88, 18, 5, C.gold); },
    cake: () => shadow(50, 93, 40, 3.5)
      + `<ellipse cx="50" cy="85" rx="42" ry="8" fill="#fff" ${sw(3)}/>`
      + `<path d="M17 44V78A33 9 0 0 0 83 78V44Z" fill="#FFE9C2" ${sw(3.5)}/>`
      + `<path d="M17 60A33 9 0 0 0 83 60V67A33 9 0 0 1 17 67Z" fill="${C.pink}" stroke="${INK}" stroke-width="${f(2 * K)}" stroke-linejoin="round"/>`
      + `<path d="M17 44C17 36 83 36 83 44V51C83 54 80 54 79 53V57A3 3 0 0 1 73 57V54C68 55 62 56 58 56V62A3.2 3.2 0 0 1 51.6 62V56C45 56 39 55 34 54V58A3 3 0 0 1 28 58V53C22 53 17 52 17 49Z" fill="${C.blush}" ${sw(3)}/>`
      + `<ellipse cx="50" cy="42" rx="31" ry="7.5" fill="#FFCCE5"/>` + [[28, 42], [40, 46], [60, 46], [72, 42]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#fff" ${sw(1.6)}/>`).join('')
      + smallBerry(50, 30, 1.05) + hl('M22 66V74', 3) + twinkle(88, 22, 5, C.gold) + twinkle(14, 30, 3.5, C.gold),
    carrotcake: () => shadow(50, 93, 40, 3.5)
      + `<ellipse cx="50" cy="85" rx="44" ry="8" fill="#fff" ${sw(3)}/>`
      + `<path d="M8 54L90 44V76L8 84Z" fill="#E59A52" ${sw(3.5)}/>`
      + `<path d="M8 66L90 58V64L8 72Z" fill="#FFF6E9" stroke="${INK}" stroke-width="${f(1.8 * K)}" stroke-linejoin="round"/>`
      + [[22, 60], [40, 57], [64, 54], [78, 51], [30, 78], [50, 75], [72, 72], [16, 77]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="#B8692E"/>`).join('')
      + `<path d="M8 54L62 30L90 44Z" fill="#FFF6E9" ${sw(3.5)}/><path d="M8 54L90 44V48L8 58Z" fill="#FFF6E9" stroke="${INK}" stroke-width="${f(1.8 * K)}" stroke-linejoin="round"/>`
      + `<path d="M8 54L90 44" ${sw(3.5)}/>`
      + `<path d="M58 38C58 33 66 31 68 36C70 40 62 42 58 38Z" fill="#fff" ${sw(2.2)}/>`
      + `<g transform="rotate(-62 52 37)"><path d="M47 33C47 31 57 31 57 33C57 37 54 43 52 47C50 43 47 37 47 33Z" fill="#FFA048" ${sw(2.4)}/><path d="M52 31L49 25M52 31L55 25M52 31V24" stroke="#5DBB73" stroke-width="${f(2.6)}" stroke-linecap="round"/></g>`
      + hl('M22 50L40 42', 3) + twinkle(86, 24, 5, C.gold),
    tart: () => shadow(50, 88, 40, 4)
      + `<path d="M10 48V62A40 17 0 0 0 90 62V48Z" fill="${C.pastryD}" ${sw(3.5)}/>`
      + Array.from({ length: 11 }, (_, i) => { const x = 14 + i * 7.2, y = 62 + 17 * Math.sqrt(Math.max(0, 1 - ((x - 50) / 40) ** 2)); return `<path d="M${f(x)} ${f(y - 14)}V${f(y - 2)}" stroke="${C.pastry}" stroke-width="3" stroke-linecap="round"/>`; }).join('')
      + `<ellipse cx="50" cy="48" rx="40" ry="17" fill="${C.pastry}" ${sw(3.5)}/>`
      + `<ellipse cx="50" cy="48" rx="31" ry="11.5" fill="#FFE45C" ${sw(2.6)}/><ellipse cx="44" cy="46" rx="16" ry="4.5" fill="#FFF09A"/>`
      + `<path d="M36 42C36 34 41 30 44 26C47 30 52 34 52 42C50 46 38 46 36 42Z" fill="#fff" ${sw(2.4)}/>`
      + `<path d="M59 44C59 38 63 35 65 32C67 35 71 38 71 44C69 47 61 47 59 44Z" fill="#fff" ${sw(2.4)}/>`
      + `<path d="M20 50C20 44 24 41 26 38C28 41 32 44 32 50C30 53 22 53 20 50Z" fill="#fff" ${sw(2.4)}/>`
      + `<path d="M55 54A9 9 0 0 1 73 54Z" fill="#FFD23F" ${sw(2.2)}/><path d="M57.5 53A6.5 6.5 0 0 1 70.5 53Z" fill="#FFF3A0"/><path d="M64 53L60 48M64 53V46.5M64 53L68 48" stroke="#FFD23F" stroke-width="1.2"/>`
      + `<path d="M74 44C78 38 85 38 87 41C83 45 78 46 74 44Z" fill="${C.mint}" ${sw(2.2)}/>`
      + hl('M15 46Q20 38 32 35', 3) + twinkle(86, 22, 5, C.gold) + twinkle(14, 28, 3.5, C.gold),
  };
  function treat(id) {
    if (!TREAT_ART[id]) return '';
    K = 1; return svg('0 0 100 100', TREAT_ART[id](), TREATS[id]);
  }

  // ======================================================================================
  // ---- the mixing bowl (200 by 120) ----
  function bowl(opt = {}) {
    K = 1;
    const body = 'M8 26C8 72 44 106 100 106C156 106 192 72 192 26Z', cl = uid('bowl'), inner = uid('in');
    let mix = '';
    if (opt.mix) {
      mix = `<g clip-path="url(#${inner})"><rect x="0" y="0" width="200" height="60" fill="#FFE6BF"/></g>`
        + `<path d="M22 28C30 16 60 10 100 10C140 10 170 16 178 28" fill="#FFE6BF" ${sw(3)}/><path d="M24 29H176" stroke="#FFE6BF" stroke-width="5"/>`
        + `<path d="M58 22C70 14 100 13 112 19C122 24 108 30 96 27C88 25 92 20 100 20" fill="none" stroke="${C.pink}" stroke-width="4" stroke-linecap="round"/>`
        + `<path d="M126 24C136 18 150 18 158 23" fill="none" stroke="${C.pink}" stroke-width="3.4" stroke-linecap="round"/><path d="M40 26C46 21 54 19 62 20" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`
        + bar('M128 18L164 2', C.wood, 7);
    }
    const dots = [];
    for (let i = 0; i < 9; i++) { const x = 30 + i * 17.5, y = 74 + Math.abs(i - 4) * -1.6 + (i % 2) * 8; if (Math.abs(x - 100) < 82) dots.push(`<circle cx="${f(x)}" cy="${f(y)}" r="3.6" fill="#fff" opacity=".9"/>`); }
    const b = `<defs><clipPath id="${cl}"><path d="${body}"/></clipPath><clipPath id="${inner}"><ellipse cx="100" cy="27" rx="82" ry="10.5"/></clipPath></defs>`
      + shadow(100, 112, 66, 6)
      + `<rect x="70" y="98" width="60" height="13" rx="6" fill="#6FB8E8" ${sw(3.5)}/>`
      + `<path d="${body}" fill="#A8DCFF" ${sw(4)}/>`
      + `<g clip-path="url(#${cl})"><path d="M0 46Q100 60 200 46V58Q100 72 0 58Z" fill="${C.pink}"/>${[24, 52, 80, 120, 148, 176].map((x, i) => heart(x, 51 + (Math.abs(x - 100) < 40 ? 4 : Math.abs(x - 100) < 60 ? 2.5 : 0), 3.6, '#fff')).join('')}${dots.join('')}</g>`
      + `<path d="M0 46Q100 60 200 46M0 58Q100 72 0 58M0 58Q100 72 200 58" fill="none" stroke="${INK}" stroke-width="2" opacity=".35" clip-path="url(#${cl})"/>`
      + hl('M22 44Q28 70 48 86', 4.5)
      + `<ellipse cx="100" cy="26" rx="92" ry="16" fill="#D3EEFF" ${sw(4)}/>`
      + `<ellipse cx="100" cy="27" rx="82" ry="10.5" fill="#7DBDE8" ${sw(3)}/>`
      + `<path d="M24 30Q100 44 176 30" fill="none" stroke="#9FD0F2" stroke-width="5" stroke-linecap="round" clip-path="url(#${inner})"/>`
      + mix + twinkle(182, 60, 6, C.gold) + twinkle(16, 70, 4);
    return svg('0 0 200 120', b, opt.mix ? 'Mixing bowl full of batter' : 'Mixing bowl');
  }

  // ======================================================================================
  // ---- the oven (160 by 170) ----
  function oven(opt = {}) {
    K = 1;
    const on = !!opt.on, g = uid('glow'), cl = uid('win');
    const bodyD = 'M12 160V72C12 36 42 12 80 12C118 12 148 36 148 72V160Z';
    let win = '';
    if (on) {
      const tid = TREAT_ART[opt.treat] ? opt.treat : 'cupcake', s = 0.52;
      K = 0.8 / s; const t = TREAT_ART[tid](); K = 1;
      win = `<rect x="34" y="92" width="92" height="54" rx="12" fill="url(#${g})"/>`
        + `<g clip-path="url(#${cl})">${[[50, 104], [110, 108], [62, 132], [100, 98]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#FFF6C8" opacity=".9"/>`).join('')}`
        + scaled(80 - 50 * s, 146 - 94 * s, s, t)
        + `<path d="M44 112q3 -5 0 -10M116 112q3 -5 0 -10" fill="none" stroke="#FFF1B8" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></g>`
        + `<path d="M44 100L56 100" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>`;
    } else {
      win = `<rect x="34" y="92" width="92" height="54" rx="12" fill="#7C6BAE"/>`
        + `<g clip-path="url(#${cl})"><path d="M50 92L34 112V124L62 92ZM78 92L42 146H54L90 92Z" fill="#fff" opacity=".22"/></g>`
        + `<rect x="46" y="134" width="68" height="5" rx="2.5" fill="#6A5A9C"/><path d="M50 136H110" stroke="#9888C8" stroke-width="1.6" stroke-dasharray="3 4"/>`;
    }
    const b = `<defs><radialGradient id="${g}" cx=".5" cy=".62" r=".72"><stop offset="0" stop-color="#FFF4C2"/><stop offset=".45" stop-color="#FFC266"/><stop offset="1" stop-color="#FF8F45"/></radialGradient>
      <clipPath id="${cl}"><rect x="34" y="92" width="92" height="54" rx="12"/></clipPath></defs>`
      + shadow(80, 165, 68, 5)
      + `<rect x="24" y="152" width="20" height="13" rx="5" fill="${C.berry}" ${sw(3.5)}/><rect x="116" y="152" width="20" height="13" rx="5" fill="${C.berry}" ${sw(3.5)}/>`
      + `<path d="${bodyD}" fill="${C.blush}" ${sw(4)}/>`
      + hl('M22 70C22 46 38 28 58 22', 4)
      // the face on the top panel: two dial eyes, a smile and rosy cheeks
      + [56, 104].map(x => `<circle cx="${x}" cy="46" r="11" fill="#fff" ${sw(3)}/><circle cx="${x + 1}" cy="47" r="5.5" fill="${INK}"/><circle cx="${x + 3}" cy="44.5" r="2" fill="#fff"/>`).join('')
      + `<path d="M70 60Q80 68 90 60" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`
      + `<ellipse cx="40" cy="60" rx="6" ry="3.6" fill="${C.rose}" opacity=".45"/><ellipse cx="120" cy="60" rx="6" ry="3.6" fill="${C.rose}" opacity=".45"/>`
      + heart(80, 24, 5, C.rose, sw(2))
      // the door
      + `<rect x="22" y="72" width="116" height="82" rx="16" fill="${C.pink}" ${sw(3.5)}/>`
      + bar('M58 81H102', C.gold, 5)
      + win + `<rect x="34" y="92" width="92" height="54" rx="12" fill="none" ${sw(3)}/>`
      + (on ? `<rect x="31" y="89" width="98" height="60" rx="14" fill="none" stroke="#FFB45C" stroke-width="2.4" opacity=".7"/>` + twinkle(144, 16, 7, C.gold) + twinkle(16, 28, 5, C.gold) + twinkle(150, 96, 4.5, '#FFE9A8') : '')
      + twinkle(132, 136, 3.2);
    return svg('0 0 160 170', b, on ? 'Oven baking' : 'Oven');
  }

  // ======================================================================================
  // ---- a plate (120 by 50) and a sack of ten (80 by 90) ----
  function plate(opt = {}) {
    K = 1;
    const col = COLORS[opt.color] || COLORS.pink;
    let dots = '';
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; dots += `<circle cx="${f(60 + Math.cos(a) * 48)}" cy="${f(25 + Math.sin(a) * 15.2)}" r="2.6" fill="${col}"/>`; }
    const b = shadow(60, 42, 50, 6)
      + `<ellipse cx="60" cy="27" rx="56" ry="19" fill="#E6DEF7" ${sw(3)}/>`
      + `<ellipse cx="60" cy="25" rx="56" ry="18" fill="#fff" ${sw(3)}/>` + dots
      + `<ellipse cx="60" cy="26" rx="38" ry="10.5" fill="#F5F1FF" stroke="#D9CCFF" stroke-width="2"/>`
      + hl('M18 20Q26 12 42 10', 3);
    return svg('0 0 120 50', b, 'Plate');
  }
  function sack() {
    K = 1;
    const dots = [0, 1].map(r => [0, 1, 2, 3, 4].map(c => `<circle cx="${22 + c * 9}" cy="${55 + r * 12}" r="3.8" fill="${C.rose}" ${sw(1.4)}/>`).join('')).join('');
    const b = shadow(40, 87, 30, 3.5)
      + `<path d="M28 20C26 13 30 5 35 9C38 3 43 3 46 9C51 5 55 13 52 20Z" fill="#FFF6E9" ${sw(3)}/>`
      + `<path d="M27 22C15 30 8 48 9 66C10 80 18 86 40 86C62 86 70 80 71 66C72 48 65 30 53 22Z" fill="#FCE9CF" ${sw(3.5)}/>`
      + `<path d="M17 38C14 46 13 56 14 64" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".7"/>`
      + `<rect x="15" y="47" width="50" height="28" rx="8" fill="#fff" ${sw(2.6)}/>` + dots
      + `<rect x="25" y="17" width="30" height="7" rx="3.5" fill="${C.pink}" ${sw(2.6)}/>`
      + `<path d="M40 20C34 13 27 15 30 20C32 23 36 21 40 20C44 21 48 23 50 20C53 15 46 13 40 20Z" fill="${C.pink}" ${sw(2.4)}/>`
      + `<circle cx="18" cy="12" r="2.4" fill="#fff" ${sw(1.4)}/><circle cx="62" cy="10" r="1.8" fill="#fff" ${sw(1.4)}/>` + twinkle(66, 36, 4.5, C.gold);
    return svg('0 0 80 90', b, 'A sack of ten');
  }

  // ======================================================================================
  // ---- Pattern Parade pieces (60 by 60) ----
  const COLORS = { pink: '#FF7DC0', lilac: '#A98CFF', mint: '#5FDDB4', gold: '#FFC93A', sky: '#6CC4FF', coral: '#FF8A5C' };
  const SHAPES = { star: 'Star', heart: 'Heart', moon: 'Moon', flower: 'Flower', gem: 'Gem', cloud: 'Cloud', circle: 'Circle', square: 'Square', triangle: 'Triangle', crown: 'Crown', drop: 'Drop', leaf: 'Leaf' };
  const SHAPE_ART = {
    star: c => `<polygon points="${starPts(30, 32, 26, 0.5)}" fill="${c}" ${sw(3)}/>` + hl('M22 24L27 18', 3),
    heart: c => `<path d="${heartD(30, 30, 24)}" fill="${c}" ${sw(3)}/>` + hl('M11 24Q12 15 20 13', 3.2),
    moon: c => `<path d="M45 11.5A24 24 0 1 0 45 50.5A21 21 0 0 1 45 11.5Z" fill="${c}" ${sw(3)}/>` + hl('M13 26Q15 17 22 13', 3.2),
    flower: c => [0, 72, 144, 216, 288].map(a => `<circle cx="${f(30 + 14.5 * Math.cos((a - 90) * Math.PI / 180))}" cy="${f(31 + 14.5 * Math.sin((a - 90) * Math.PI / 180))}" r="11" fill="${c}" ${sw(3)}/>`).join('')
      + `<circle cx="30" cy="31" r="8" fill="#FFF6E9" ${sw(3)}/>` + hl('M26 13Q28 10 32 10', 2.6),
    gem: c => `<path d="M6 22L17 9H43L54 22L30 54Z" fill="${c}" ${sw(3)}/><path d="M17 9L23 22L30 54L37 22L43 9" fill="none" stroke="${INK}" stroke-width="${f(1.8)}" stroke-linejoin="round" opacity=".45"/>`
      + `<path d="M6 22H54" stroke="${INK}" stroke-width="${f(2)}" opacity=".5"/><path d="M17 9L23 22H6Z" fill="#fff" opacity=".45"/><path d="M37 22H54L30 54Z" fill="${INK}" opacity=".12"/>`,
    cloud: c => blob([[19, 34, 11], [31, 25, 14], [43, 32, 11], [10, 33, 36, 16, 8]], c, 2) + hl('M22 21Q26 15 32 15', 3),
    circle: c => `<circle cx="30" cy="31" r="24" fill="${c}" ${sw(3)}/>` + hl('M13 27Q15 16 25 12', 3.2),
    square: c => `<rect x="8" y="9" width="44" height="44" rx="7" fill="${c}" ${sw(3)}/>` + hl('M14 26V17Q14 15 16 15H25', 3),
    triangle: c => `<path d="M30 7L55 51H5Z" fill="${c}" ${sw(3)}/>` + hl('M24 22L19 31', 3),
    crown: c => `<path d="M7 49L5 18L18 30L30 10L42 30L55 18L53 49Z" fill="${c}" ${sw(3)}/><path d="M8 41H52" stroke="${INK}" stroke-width="${f(2)}" opacity=".4"/>`
      + `<circle cx="5" cy="17" r="3.4" fill="#fff" ${sw(2)}/><circle cx="30" cy="9" r="3.4" fill="#fff" ${sw(2)}/><circle cx="55" cy="17" r="3.4" fill="#fff" ${sw(2)}/><circle cx="30" cy="34" r="4" fill="#fff" opacity=".85"/>`,
    drop: c => `<path d="M30 5C37 18 49 29 49 39A19 18 0 0 1 11 39C11 29 23 18 30 5Z" fill="${c}" ${sw(3)}/>` + hl('M17 39Q17 32 22 27', 3.2),
    leaf: c => `<path d="M8 52C5 28 22 9 53 8C55 36 37 54 8 52Z" fill="${c}" ${sw(3)}/><path d="M8 52C20 40 32 28 44 17" fill="none" stroke="${INK}" stroke-width="${f(2.2)}" stroke-linecap="round" opacity=".5"/>`
      + `<path d="M22 38L20 27M31 30L30 19M28 33L39 34M19 41L29 43" stroke="${INK}" stroke-width="${f(1.6)}" stroke-linecap="round" opacity=".35"/>` + hl('M16 33Q19 21 30 15', 3),
  };
  function shapeInner(id, color) { K = 1; const art = SHAPE_ART[id]; return art ? art(COLORS[color] || color || COLORS.pink) : ''; }
  function shape(id, color) {
    if (!SHAPE_ART[id]) return '';
    return svg('0 0 60 60', shapeInner(id, color), `${color && COLORS[color] ? color + ' ' : ''}${SHAPES[id].toLowerCase()}`);
  }

  // ---- a parade float (90 by 110) ----
  function float(a, color) {
    K = 1;
    let top, label;
    if (typeof a === 'string' && a.trim().startsWith('<')) { top = a; label = 'Parade float'; }
    else if (a && SHAPE_ART[a]) { top = shapeInner(a, color); label = `Parade float with a ${color && COLORS[color] ? color + ' ' : ''}${SHAPES[a].toLowerCase()}`; }
    if (top) top = scaled(15, 9, 1, top);
    else {
      label = 'Empty parade float';
      top = `<ellipse cx="45" cy="36" rx="30" ry="29" fill="#fff" opacity=".7"/><ellipse cx="45" cy="36" rx="30" ry="29" fill="none" stroke="${C.lilac}" stroke-width="3" stroke-dasharray="5 6" stroke-linecap="round"/>`
        + twinkle(45, 34, 11, C.gold) + twinkle(29, 22, 5.5, C.pink) + twinkle(62, 50, 6, C.lilac) + twinkle(60, 19, 4, C.mint) + twinkle(28, 50, 3.5, C.sky)
        + `<circle cx="36" cy="40" r="1.8" fill="${C.gold}"/><circle cx="56" cy="32" r="1.6" fill="${C.pink}"/>`;
    }
    let scal = 'M8 78H82V88'; for (let i = 0; i < 6; i++) scal += `q${f(-74 / 12)} 7 ${f(-74 / 6)} 0`; scal += 'Z';
    const b = shadow(45, 106, 38, 3.5)
      + bar('M1 82H8M82 82H89', C.gold, 4)
      + `<path d="${scal}" fill="${C.lilac}" ${sw(3)}/>` + [20, 32, 45, 58, 70].map(x => `<circle cx="${x}" cy="84" r="2" fill="#fff" opacity=".85"/>`).join('')
      + `<rect x="5" y="68" width="80" height="11" rx="5.5" fill="${C.gold}" ${sw(3)}/>` + hl('M11 72H30', 2.6)
      + [24, 66].map(x => `<circle cx="${x}" cy="97" r="10" fill="${C.pink}" ${sw(3)}/><path d="M${x - 6} 97H${x + 6}M${x} 91V103" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/><circle cx="${x}" cy="97" r="3.4" fill="${C.gold}" ${sw(2)}/>`).join('')
      + top;
    return svg('0 0 90 110', b, label);
  }

  // ======================================================================================
  // ---- the kitchen (400 by 300) ----
  const jar = (x, y, w, h, fill, lid, bits) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="#EAF6FF" ${sw(3)}/>`
    + `<rect x="${x + 4}" y="${y + h * 0.36}" width="${w - 8}" height="${h * 0.64 - 4}" rx="4" fill="${fill}"/>${bits || ''}`
    + `<rect x="${x - 2}" y="${y - 7}" width="${w + 4}" height="9" rx="4" fill="${lid}" ${sw(2.6)}/><circle cx="${x + w / 2}" cy="${y - 9}" r="3.2" fill="${lid}" ${sw(2)}/>`
    + hl(`M${x + 5} ${y + 6}V${y + h * 0.36}`, 2.6);
  const pot = (x, y, w, h) => `${bar(`M${x - 6} ${y + 8}H${x}M${x + w} ${y + 8}H${x + w + 6}`, C.copperD, 4)}`
    + `<path d="M${x} ${y}H${x + w}V${y + h - 8}Q${x + w} ${y + h} ${x + w - 8} ${y + h}H${x + 8}Q${x} ${y + h} ${x} ${y + h - 8}Z" fill="${C.copper}" ${sw(3)}/>`
    + `<rect x="${x - 3}" y="${y - 6}" width="${w + 6}" height="8" rx="4" fill="${C.copperD}" ${sw(2.6)}/>` + hl(`M${x + 6} ${y + 6}V${y + h - 8}`, 3);
  function scene(opt = {}) {
    K = 1;
    const clip = uid('kc'), tiles = uid('tile'), sky = uid('sky'), fsh = uid('fsh');
    const flags = []; const fc = [C.pink, C.gold, C.mint, C.sky, C.lilac];
    for (let i = 0; i < 9; i++) { const x = 136 + i * 16, y = 18 + Math.sin(i / 8 * Math.PI) * 10;
      flags.push(`<path d="M${x} ${f(y)}L${x + 14} ${f(y + 1 + Math.cos(i / 8 * Math.PI) * -2.5)}L${x + 7} ${f(y + 15)}Z" fill="${fc[i % 5]}" ${sw(2)}/>`); }
    const b = `<defs><clipPath id="${clip}"><rect width="400" height="300"/></clipPath>
      <pattern id="${tiles}" patternUnits="userSpaceOnUse" width="56" height="56"><rect width="56" height="56" fill="#FFFBF6"/>
        <rect x="1.5" y="1.5" width="25" height="25" rx="4" fill="#E8F7F2"/><rect x="29.5" y="1.5" width="25" height="25" rx="4" fill="#EDF9F4"/>
        <rect x="1.5" y="29.5" width="25" height="25" rx="4" fill="#EDF9F4"/><rect x="29.5" y="29.5" width="25" height="25" rx="4" fill="#E8F7F2"/>
        <path d="${heartD(42, 15, 3)}" fill="#FFDCEB"/></pattern>
      <linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A8DDFF"/><stop offset="1" stop-color="#E4F5FF"/></linearGradient>
      <linearGradient id="${fsh}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${INK}" stop-opacity=".14"/><stop offset="1" stop-color="${INK}" stop-opacity="0"/></linearGradient></defs>
      <g clip-path="url(#${clip})"><rect width="400" height="210" fill="url(#${tiles})"/>`
      // the window, with a scalloped pink valance and a flowerpot on the sill
      + `<path d="M26 156V78A46 46 0 0 1 118 78V156Z" fill="${C.cream}" ${sw(3)}/><path d="M34 150V78A38 38 0 0 1 110 78V150Z" fill="url(#${sky})"/>`
      + `<circle cx="92" cy="74" r="12" fill="#FFE07A"/>` + blob([[54, 108, 8], [64, 102, 10], [74, 108, 7], [48, 108, 22, 8, 4]], '#fff', 0).replace(/fill="#4B2E6F"/g, 'fill="#fff"')
      + twinkle(52, 72, 4.5) + twinkle(96, 128, 3.5)
      + bar('M72 41V150M34 112H110', C.cream, 4)
      + `<path d="M34 150V78A38 38 0 0 1 110 78V150Z" fill="none" ${sw(2)}/>`
      + `<path d="M38 56C46 44 58 40 72 40C86 40 98 44 106 56C102 62 96 60 94 56C90 62 84 62 83 56C79 62 75 62 72 57C69 62 65 62 61 56C60 62 54 62 50 56C48 60 42 62 38 56Z" fill="${C.pink}" ${sw(2.6)}/>`
      + `<path d="M48 50C54 46 62 44 70 44" fill="none" stroke="${C.blush}" stroke-width="3" stroke-linecap="round"/>`
      + `<rect x="18" y="150" width="108" height="10" rx="4" fill="${C.cream}" ${sw(3)}/>`
      + `<path d="M84 136H102L99 151H87Z" fill="${C.coral}" ${sw(2.4)}/><path d="M93 136C91 128 92 122 96 118M93 136C93 128 89 124 86 122" fill="none" stroke="${C.teal}" stroke-width="2.5" stroke-linecap="round"/>`
      + `<circle cx="96" cy="117" r="4.5" fill="${C.pink}" ${sw(1.8)}/><circle cx="86" cy="121" r="3.8" fill="${C.gold}" ${sw(1.8)}/>`
      // bunting across the middle of the wall, high up
      + `<path d="M130 18Q200 34 276 18" fill="none" stroke="${INK}" stroke-width="2"/>` + flags.join('')
      // the shelves: jars on top, copper pots below
      + `<rect x="280" y="80" width="112" height="8" rx="3" fill="${C.wood}" ${sw(3)}/><rect x="280" y="146" width="112" height="8" rx="3" fill="${C.wood}" ${sw(3)}/>`
      + [292, 380].map(x => `<path d="M${x} 88V100L${x - 8 * (x < 300 ? -1 : 1)} 88Z" fill="${C.woodD}" ${sw(2)}/><path d="M${x} 154V166L${x - 8 * (x < 300 ? -1 : 1)} 154Z" fill="${C.woodD}" ${sw(2)}/>`).join('')
      + jar(290, 50, 26, 30, C.pink, C.lilac, [[297, 68], [305, 64], [309, 72], [299, 74]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" opacity=".8"/>`).join(''))
      + jar(324, 40, 30, 40, '#FFE07A', C.mint, [[331, 62], [345, 66], [337, 72]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.2" fill="#F2B266" ${sw(1.2)}/>`).join(''))
      + jar(362, 52, 22, 28, C.mint, C.pink, '')
      + pot(296, 120, 34, 26) + pot(348, 126, 28, 20)
      + twinkle(270, 60, 4, C.gold) + twinkle(388, 110, 3.5)
      // a hanging ladle and whisk beside the window
      + bar('M136 46H178', C.woodD, 4) + bar('M146 46V80', C.copperD, 3) + `<path d="M138 80A8 8 0 0 0 154 80Z" fill="${C.copper}" ${sw(2.4)}/>`
      + bar('M168 46V62', '#B2A1F0', 3.4) + `<path d="M168 62C160 70 160 84 168 88C176 84 176 70 168 62ZM168 62V88" fill="none" ${sw(2)}/>`
      // the counter: a wooden top, then pastel cupboards
      + `<rect y="208" width="400" height="30" fill="url(#${fsh})"/>`
      + `<rect x="-4" y="198" width="408" height="15" fill="${C.woodL}" ${sw(3)}/><path d="M0 203H400" stroke="#FCE6C2" stroke-width="2"/>`
      + `<rect x="-4" y="213" width="408" height="12" fill="${C.wood}" ${sw(3)}/>`
      + `<rect x="-4" y="225" width="408" height="80" fill="#E3D9FF" ${sw(3)}/>`
      + [6, 104, 202, 300].map(x => `<rect x="${x}" y="234" width="92" height="60" rx="10" fill="#EEE7FF" ${sw(2.5)}/><rect x="${x + 8}" y="242" width="76" height="44" rx="7" fill="none" stroke="#D3C6FA" stroke-width="2.4"/>`).join('')
      + [92, 110, 288, 306].map(x => `<circle cx="${x}" cy="${x === 306 ? 260 : 264}" r="4.5" fill="${C.gold}" ${sw(2)}/>`).join('')
      + `<path d="M298 268H314V296H298Z" fill="${C.mint}" ${sw(2.4)}/><path d="M298 276H314M298 284H314" stroke="#fff" stroke-width="2.4"/><path d="M302 268V264C302 261 310 261 310 264V268" fill="none" ${sw(2)}/>`
      // on the counter, at the ends: a flour canister and rolling pin, a cookie jar and a plant
      + `<rect x="14" y="160" width="40" height="44" rx="9" fill="#fff" ${sw(3)}/><rect x="11" y="152" width="46" height="11" rx="5" fill="${C.lilac}" ${sw(2.6)}/><circle cx="34" cy="150" r="4" fill="${C.lilac}" ${sw(2)}/>`
      + heart(34, 182, 7, C.pink, sw(2)) + hl('M20 168V196', 3)
      + bar('M58 202H64', C.woodD, 3.5) + `<rect x="64" y="194" width="24" height="10" rx="5" fill="${C.woodL}" ${sw(2.4)}/>` + bar('M88 199H94', C.woodD, 3.5)
      + `<path d="M334 170C334 160 384 160 384 170V196C384 204 334 204 334 196Z" fill="#FFE3F1" ${sw(3)}/><rect x="330" y="160" width="58" height="10" rx="5" fill="${C.pink}" ${sw(2.6)}/><circle cx="359" cy="157" r="4.5" fill="${C.pink}" ${sw(2)}/>`
      + [[348, 184], [366, 180], [358, 192]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#EFB060" ${sw(1.8)}/><circle cx="${x - 1}" cy="${y}" r="1.2" fill="${C.choc}"/>`).join('') + hl('M340 172V194', 3)
      + `<path d="M304 186H324L321 204H307Z" fill="${C.sky}" ${sw(2.4)}/>` + [[-30, 10], [0, 12], [30, 10]].map(([a, l]) => `<ellipse cx="314" cy="${186 - l / 2 - 2}" rx="4" ry="${l / 2 + 2}" transform="rotate(${a} 314 186)" fill="${C.mint}" ${sw(1.8)}/>`).join('')
      + twinkle(232, 66, 4.5, C.gold) + twinkle(250, 120, 3) + twinkle(160, 150, 3.5, '#fff') + `</g>`;
    return svg('0 0 400 300', b, opt.label || 'The castle kitchen', 'preserveAspectRatio="xMidYMid slice"');
  }

  root.SparkleKitchen = { scene, bowl, ing, oven, treat, plate, sack, shape, shapeInner, float, ING, TREATS, SHAPES, COLORS };
})(typeof window !== 'undefined' ? window : globalThis);
