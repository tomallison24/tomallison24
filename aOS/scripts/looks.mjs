// The looks that are drawn from Vintage: Night Drive (neon) and Folk (Gzhel by day, Khokhloma by
// night). Each keeps Vintage's flat shapes and repaints them: every colour in a page's Vintage block
// is moved to the same role in the look's palette (the cream ground to the look's ground, the walnut
// ink to its ink, mustard, teal, burnt orange and olive to its four accents), in the OKLCH colour
// space so lightness, and with it contrast, stays as Vintage had it. Used by make-looks.mjs (the
// page blocks and the icons) and check-apps.mjs (that they're up to date).
//
//   mapColor(look, css colour, dark?) -> css colour      dark: the rule only applies in Dark mode
//   lookBlock(look, vintage block css) -> the look's css (only the declarations that carry a colour
//     or Vintage's font, under the same selectors and media, so it wins by coming later)
'use strict';

// ---- sRGB <-> OKLCH ----
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function toLch([r, g, b]) {
  [r, g, b] = [r, g, b].map(v => lin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}
function fromLchRaw(L, C, h) {
  const A = C * Math.cos((h * Math.PI) / 180), B = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
function fromLch(L, C, h) {   // the nearest colour in sRGB: chroma comes down until it fits
  L = Math.min(1, Math.max(0, L));
  let rgb = fromLchRaw(L, C, h);
  for (let i = 0; i < 40 && rgb.some(v => v < -0.0005 || v > 1.0005); i++) { C *= 0.92; rgb = fromLchRaw(L, C, h); }
  return rgb.map(v => Math.round(Math.min(1, Math.max(0, gam(Math.min(1, Math.max(0, v))))) * 255));
}
const hex2 = n => n.toString(16).padStart(2, '0').toUpperCase();

// ---- The palettes ----
// A colour is a neutral (Vintage's creams and walnuts) or one of the accent families, by its hue.
// Each look says, per mode, what a neutral becomes (hue and chroma, lightness through anchors) and
// where each family goes (hue, chroma scale, lightness shift).
const FAMILY = h => (h < 50 || h >= 345 ? 'orange' : h < 100 ? 'mustard' : h < 150 ? 'olive' : h < 245 ? 'teal' : h < 300 ? 'blue' : 'pink');
const interp = (pts, x) => {   // piecewise linear through [[x, y]...]
  if (x <= pts[0][0]) return pts[0][1] + (x - pts[0][0]);
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0); }
  const [xa, ya] = pts[pts.length - 1]; return ya + (x - xa);
};
// Vintage's own anchors (OKLCH lightness): walnut ground .245, walnut card .29, ink .27, cream ground .94, card .97
export const LOOKS = {
  neon: {
    name: 'Night Drive',
    light: {
      neutral: { L: [[0.2, 0.17], [0.27, 0.22], [0.55, 0.5], [0.94, 0.962], [0.97, 0.985], [1, 1]], h: 300, C: L => 0.012 + 0.09 * (1 - L) },
      orange: { h: 354, C: 1.25, dL: 0 }, mustard: { h: 62, C: 1.1, dL: 0.02 }, olive: { h: 292, C: 1.4, dL: 0 },
      teal: { h: 222, C: 1.1, dL: 0.02 }, blue: { h: 285, C: 1.1, dL: 0 }, pink: { h: 345, C: 1.1, dL: 0 },
    },
    dark: {
      neutral: { L: [[0.2, 0.15], [0.245, 0.175], [0.29, 0.215], [0.36, 0.27], [0.6, 0.62], [0.94, 0.95], [1, 1]], h: 300, C: L => (L < 0.5 ? 0.05 : 0.01 + 0.05 * (1 - L)) },
      orange: { h: 354, C: 1.4, dL: 0.06 }, mustard: { h: 62, C: 1.2, dL: 0.04 }, olive: { h: 292, C: 1.6, dL: 0.08 },
      teal: { h: 210, C: 1.3, dL: 0.06 }, blue: { h: 285, C: 1.2, dL: 0.04 }, pink: { h: 350, C: 1.3, dL: 0.04 },
    },
    font: '"Avenir Next","Avenir","Saira",system-ui,sans-serif',
    display: '"Avenir Next Condensed","Avenir Next","Arial Narrow",system-ui,sans-serif',
    ground: ['#F6F0FF', '#120B1F'],
  },
  folk: {
    name: 'Folk',
    light: {   // Gzhel: cobalt on porcelain
      neutral: { L: [[0.2, 0.2], [0.27, 0.25], [0.55, 0.47], [0.94, 0.972], [0.97, 0.99], [1, 1]], h: 266, C: L => 0.008 + 0.11 * (1 - L) ** 1.6 },
      orange: { h: 29, C: 1.15, dL: -0.02 }, mustard: { h: 78, C: 1.0, dL: -0.03 }, olive: { h: 135, C: 0.95, dL: -0.02 },
      teal: { h: 266, C: 1.7, dL: -0.08 }, blue: { h: 266, C: 1.2, dL: -0.03 }, pink: { h: 15, C: 1.1, dL: 0 },
    },
    dark: {    // Khokhloma: cinnabar and gold on black lacquer
      neutral: { L: [[0.2, 0.13], [0.245, 0.155], [0.29, 0.195], [0.36, 0.25], [0.6, 0.66], [0.94, 0.93], [1, 0.98]], h: 70, C: L => (L < 0.5 ? 0.012 : 0.02 + 0.07 * (1 - L)) },
      orange: { h: 30, C: 1.2, dL: -0.04 }, mustard: { h: 80, C: 1.05, dL: 0.02 }, olive: { h: 128, C: 0.9, dL: 0 },
      teal: { h: 82, C: 1.35, dL: 0.03 }, blue: { h: 82, C: 1.0, dL: 0.04 }, pink: { h: 25, C: 1.1, dL: 0 },
    },
    font: '"PT Sans","Avenir Next","Helvetica Neue",system-ui,sans-serif',
    display: '"Yeseva One","Georgia","Times New Roman",serif',
    ground: ['#F5F7FB', '#0D0B0A'],
  },
};

export function mapRgb(look, rgb, dark) {
  const P = LOOKS[look][dark ? 'dark' : 'light'];
  const [L, C, h] = toLch(rgb);
  if (C < 0.045) {   // a neutral (tinted a little toward the family when it carries some colour)
    const n = P.neutral, L2 = interp(n.L, L);
    return fromLch(L2, n.C(L2), n.h);
  }
  const f = P[FAMILY(h)];
  return fromLch(L + f.dL, C * f.C, f.h);
}

const NUM = '[-+]?(?:\\d*\\.\\d+|\\d+)';
const COLOR = new RegExp(`(?<!url\\()#[0-9a-fA-F]{3,8}\\b|rgba?\\(\\s*${NUM}%?\\s*[ ,]\\s*${NUM}%?\\s*[ ,]\\s*${NUM}%?\\s*(?:[,/]\\s*${NUM}%?\\s*)?\\)`, 'g');
const URLHEX = /%23([0-9a-fA-F]{6})\b/g;   // a colour inside a data: url (an inline svg)
export const hasColor = s => { COLOR.lastIndex = 0; URLHEX.lastIndex = 0; return COLOR.test(s) || URLHEX.test(s); };
export function mapColor(look, s, dark) {
  s = s.replace(URLHEX, (_, h) => '%23' + mapColor(look, '#' + h, dark).slice(1));
  return s.replace(COLOR, c => {
    let rgb, a = null;
    if (c[0] === '#') {
      let x = c.slice(1);
      if (![3, 4, 6, 8].includes(x.length)) return c;
      if (x.length <= 4) x = [...x].map(ch => ch + ch).join('');
      rgb = [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16));
      if (x.length === 8) a = parseInt(x.slice(6, 8), 16);
      const [r, g, b] = mapRgb(look, rgb, dark);
      return '#' + hex2(r) + hex2(g) + hex2(b) + (a == null ? '' : hex2(a));
    }
    const nums = c.match(new RegExp(NUM + '%?', 'g'));
    rgb = nums.slice(0, 3).map(v => (v.endsWith('%') ? parseFloat(v) * 2.55 : parseFloat(v)));
    a = nums[3];
    const [r, g, b] = mapRgb(look, rgb, dark);
    return a == null ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
  });
}

// ---- The css: rules in, the look's overrides out ----
// A small reader: comments dropped, @media/@supports kept as nesting, @keyframes kept whole (repainted).
function parse(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  function block() {
    const out = [];
    while (i < css.length) {
      const close = css.indexOf('}', i), open = css.indexOf('{', i);
      if (open === -1 || (close !== -1 && close < open)) { i = close === -1 ? css.length : close + 1; return out; }
      let head = css.slice(i, open).trim(); i = open + 1;
      head = head.replace(/^@(import|charset)[^;]*;\s*/, '');
      if (/^@(media|supports|container|layer)\b/.test(head)) out.push({ at: head, kids: block() });
      else if (/^@(-webkit-)?keyframes\b/.test(head)) { const s = i; let d = 1; while (i < css.length && d) { if (css[i] === '{') d++; else if (css[i] === '}') d--; i++; } out.push({ raw: head, body: css.slice(s, i - 1) }); }
      else { const s = i; let d = 1; while (i < css.length && d) { if (css[i] === '{') d++; else if (css[i] === '}') d--; i++; } out.push({ sel: head, body: css.slice(s, i - 1) }); }
    }
    return out;
  }
  return block();
}
// declarations split on ; outside parentheses and strings
function decls(body) {
  const out = []; let d = 0, q = null, s = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (q) { if (c === q && body[i - 1] !== '\\') q = null; continue; }
    if (c === '"' || c === "'") q = c; else if (c === '(') d++; else if (c === ')') d--;
    else if (c === ';' && !d) { out.push(body.slice(s, i)); s = i + 1; }
  }
  out.push(body.slice(s));
  return out.map(x => x.trim()).filter(Boolean);
}
const DARK_MEDIA = /prefers-color-scheme\s*:\s*dark/, LIGHT_MEDIA = /prefers-color-scheme\s*:\s*light/;
const DARK_SEL = /\[data-theme=["']?dark|data-sky-tone=["']?dark/, LIGHT_SEL = /\[data-theme=["']?light|data-sky-tone=["']?light/;
const VFONT = /Futura/;

export function lookBlock(look, css) {
  const L = LOOKS[look];
  const paint = (decl, dark) => {
    const k = decl.indexOf(':'); if (k < 0) return null;
    const prop = decl.slice(0, k).trim(), val = decl.slice(k + 1).trim();
    if (/^font-family$/i.test(prop) || /^--[\w-]*font[\w-]*$/i.test(prop)) return VFONT.test(val) ? `${prop}:${L.font}${/!important/.test(val) ? ' !important' : ''}` : null;
    if (/^font$/i.test(prop) && VFONT.test(val)) return `${prop}:${val.replace(/(["']?Futura[\s\S]*)$/, L.font)}`;
    return hasColor(val) ? `${prop}:${mapColor(look, val, dark)}` : null;
  };
  // Light or Dark: a rule in a prefers-color-scheme block, or for [data-theme], is that mode's; any other follows
  // the page's own default (most pages are light first; Mail is dark first: its bare :root ground is walnut)
  const tree = parse(css);
  const rootBg = tree.find(n => n.sel != null && /^:root$/.test(n.sel.trim()) && /--(bg|mc-ground)\s*:/.test(n.body));
  const bgHex = rootBg && (/--(?:bg|mc-ground)\s*:\s*(#[0-9a-fA-F]{6})/.exec(rootBg.body) || [])[1];
  const pageDark = !!bgHex && toLch([1, 3, 5].map(i => parseInt(bgHex.slice(i, i + 2), 16)))[0] < 0.5;
  const emit = (nodes, mode) => {
    let out = '';
    for (const n of nodes) {
      if (n.at) { const inner = emit(n.kids, DARK_MEDIA.test(n.at) ? 'dark' : LIGHT_MEDIA.test(n.at) ? 'light' : mode); if (inner) out += `${n.at}{\n${inner}}\n`; }
      else if (n.raw) { if (hasColor(n.body)) out += `${n.raw}{${mapColor(look, n.body, (mode || (pageDark ? 'dark' : 'light')) === 'dark')}}\n`; }
      else if (n.sel != null) {
        // a selector list that mixes light and dark parts is split, so each part gets its own palette
        const parts = n.sel.split(/,(?![^(]*\))/).map(s => s.trim());
        const modeOf = p => { p = p.replace(/:not\([^)]*\)/g, ''); return DARK_SEL.test(p) ? 'dark' : LIGHT_SEL.test(p) ? 'light' : mode || (pageDark ? 'dark' : 'light'); };
        for (const m of ['light', 'dark']) {
          const g = parts.filter(p => modeOf(p) === m);
          if (!g.length) continue;
          const ds = decls(n.body).map(d => paint(d, m === 'dark')).filter(Boolean);
          if (ds.length) out += `${g.join(',')}{${ds.join(';')}}\n`;
        }
      }
    }
    return out;
  };
  return emit(tree, null);
}

// ---- Each look's own touches, the same in every page (after the repainted Vintage rules) ----
// The headings, the shapes behind the title (Vintage's disc, dot and pill: .ambient i, .aurora b,
// .atoms b) and, for Folk, its fonts (in ../home/fonts, so they work offline once seen).
const HEADS = ':is(.title,.head h1,.top h1,header h1,.masthead h1,.hx-title,.sheethead h2,.ptitle)';
const SHAPE = n => `:root :is(.ambient i,.aurora b,.atoms b):nth-child(${n})`;
const BAND = ':is(.ambient,.aurora,.atoms)';
const darkBoth = body => `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${body}}}\n:root[data-theme="dark"]{${body}}\n`;
const svgUrl = svg => `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/%20/g, ' ').replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2F/g, '/')}")`;
// six petals and a heart: the Gzhel and Khokhloma flower, as a mask (the colour comes from the background)
const ROSETTE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-50 -50 100 100'><g>${[0, 60, 120, 180, 240, 300].map(a => `<ellipse rx='12' ry='21' cy='-26' transform='rotate(${a})'/>`).join('')}</g><circle r='11'/></svg>`;

export function signature(look) {
  if (look === 'neon') return `/* Night Drive: heavy italic condensed headings, a striped sunset for the disc, a neon ring and tube, a grid under them */
${HEADS}{font-family:${LOOKS.neon.display};font-style:italic;font-weight:800;letter-spacing:-.01em}
:root{--nd-sun:linear-gradient(#FFC75A,#FF8A4C 42%,#FF3D9A 78%);--nd-ring:#0A8AA6;--nd-tube:#C21E78;--nd-glow:0;--nd-grid:rgba(194,30,120,.22)}
${darkBoth('--nd-ring:#22D3EE;--nd-tube:#FF3D9A;--nd-glow:1;--nd-grid:rgba(255,61,154,.30)')}
${SHAPE(1)}{background:repeating-linear-gradient(to bottom,transparent 0 9px,var(--bg) 9px 13px) 0 100%/100% 46% no-repeat,var(--nd-sun);opacity:1}
${SHAPE(2)}{background:transparent;box-shadow:inset 0 0 0 4px var(--nd-ring),0 0 calc(var(--nd-glow) * 16px) var(--nd-ring)}
${SHAPE(3)}{background:var(--nd-tube);box-shadow:0 0 calc(var(--nd-glow) * 18px) var(--nd-tube)}
${BAND}::after{content:'';position:absolute;left:-30%;right:-30%;top:62%;height:110px;pointer-events:none;
  background:linear-gradient(90deg,var(--nd-grid) 1px,transparent 1px) 50% 0/28px 100%,linear-gradient(var(--nd-grid) 1px,transparent 1px) 0 0/100% 16px;
  transform:perspective(140px) rotateX(58deg);transform-origin:top;-webkit-mask-image:linear-gradient(#000,transparent);mask-image:linear-gradient(#000,transparent)}
:is(.fab,.okbtn){box-shadow:0 0 calc(var(--nd-glow) * 18px) color-mix(in srgb,var(--nd-tube) 70%,transparent)}
`;
  if (look === 'folk') {
    const face = (fam, w, sub, range) => `@font-face{font-family:"${fam}";font-style:normal;font-weight:${w};font-display:swap;src:url("../home/fonts/${fam.toLowerCase().replace(/ /g, '-')}-${w}-${sub}.woff2") format("woff2");unicode-range:${range}}`;
    const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
    const CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
    return `/* Folk: Gzhel by day (cobalt on porcelain), Khokhloma by night (cinnabar and gold on black lacquer).
   PT Sans and Yeseva One, both made for Cyrillic (SIL Open Font License, ../home/fonts). */
${['PT Sans:400', 'PT Sans:700', 'Yeseva One:400'].map(f => { const [fam, w] = f.split(':'); return face(fam, w, 'latin', LAT) + '\n' + face(fam, w, 'cyrillic', CYR); }).join('\n')}
${HEADS}{font-family:${LOOKS.folk.display};font-weight:400;letter-spacing:0}
:root{--fk-flower:#1C3F94;--fk-berry:#4E74C7;--fk-leaf:#8FA8DE;--fk-heart:#F5F7FB;--fk-scarf:#1C3F94;--fk-dot:#FFFFFF;--fk-petal:#8FA8DE}
${darkBoth('--fk-flower:#C7261C;--fk-berry:#D9A630;--fk-leaf:#B88A24;--fk-heart:#D9A630;--fk-scarf:#C7261C;--fk-dot:#F6E7C6;--fk-petal:#D9A630')}
${SHAPE(1)}{background:radial-gradient(circle,var(--fk-heart) 0 9%,var(--fk-flower) 9.5%);-webkit-mask:${svgUrl(ROSETTE)} center/contain no-repeat;mask:${svgUrl(ROSETTE)} center/contain no-repeat;border-radius:0;opacity:1}
${SHAPE(2)}{background:radial-gradient(circle at 34% 32%,rgba(255,255,255,.55) 0 12%,transparent 13%),var(--fk-berry)}
${SHAPE(3)}{background:var(--fk-leaf);border-radius:100% 0}
`;
  }
  return '';
}
