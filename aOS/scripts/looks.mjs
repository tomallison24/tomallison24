// The looks that are drawn from Vintage: Layers (a still sky by the time of day, frosted glass over it) and Tron (light cycles, as in the car's Tron mode: red light on a black grid). Each keeps Vintage's flat shapes and repaints them: every colour in a page's Vintage block
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
  layers: {
    // Pearl (its id stays 'layers', the look it replaced, so phones that had Layers open in Pearl): light in the dust.
    // By day, cream with carbon ink; at night, near-black blue with cool white light. The accents keep Vintage's roles in
    // the AllisonOS colours (sea glass, mist, shell, sand) at Vintage's lightness, quieter by day, glowing at night.
    name: 'Pearl',
    light: {
      neutral: { L: [[0.2, 0.17], [0.27, 0.235], [0.55, 0.5], [0.94, 0.948], [0.97, 0.982], [1, 0.995]], h: L => (L > 0.6 ? 82 : 255), C: L => (L > 0.6 ? 0.012 : 0.008) },
      orange: { h: 24, C: 0.7, dL: 0 }, mustard: { h: 78, C: 0.6, dL: 0 }, olive: { h: 262, C: 0.9, dL: 0 },
      teal: { h: 178, C: 0.75, dL: 0 }, blue: { h: 262, C: 0.8, dL: 0 }, pink: { h: 352, C: 0.7, dL: 0 },
    },
    dark: {
      neutral: { L: [[0.2, 0.1], [0.245, 0.13], [0.29, 0.185], [0.36, 0.245], [0.6, 0.62], [0.94, 0.935], [1, 1]], h: 258, C: L => (L < 0.5 ? 0.028 : 0.006 + 0.012 * (1 - L)) },
      orange: { h: 24, C: 0.75, dL: 0.07 }, mustard: { h: 80, C: 0.7, dL: 0.05 }, olive: { h: 262, C: 1.0, dL: 0.12 },
      teal: { h: 178, C: 0.75, dL: 0.09 }, blue: { h: 262, C: 0.85, dL: 0.1 }, pink: { h: 352, C: 0.7, dL: 0.06 },
    },
    font: '-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",system-ui,sans-serif',
    display: '"Unbounded","Avenir Next","Helvetica Neue",system-ui,sans-serif',
    ground: ['#F7F3EC', '#02050C'],
  },
  // Night Drive's palette: not a look any more (Layers replaced it), but Tron's icon grounds take their hue from its dark one
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
  grid: {
    name: 'Tron',
    light: {   // the grid by day, as a car's screen in light mode: clean white and grey, red light
      neutral: { L: [[0.2, 0.17], [0.27, 0.22], [0.55, 0.5], [0.94, 0.965], [0.97, 0.99], [1, 1]], h: 255, C: L => 0.003 + 0.012 * (1 - L) },
      orange: { h: 27, C: 1.55, dL: -0.03 }, mustard: { h: 31, C: 1.45, dL: -0.08 }, olive: { h: 255, C: 0.3, dL: -0.02 },
      teal: { h: 25, C: 1.7, dL: -0.02 }, blue: { h: 255, C: 0.45, dL: 0 }, pink: { h: 20, C: 1.3, dL: 0 },
    },
    dark: {    // the grid at night (Tron: Ares, as in the car): black, red light, white
      neutral: { L: [[0.2, 0.1], [0.245, 0.125], [0.29, 0.165], [0.36, 0.22], [0.6, 0.64], [0.94, 0.95], [1, 1]], h: 255, C: L => (L < 0.5 ? 0.006 : 0.003 + 0.01 * (1 - L)) },
      orange: { h: 27, C: 2.4, dL: 0.02 }, mustard: { h: 29, C: 2.2, dL: 0 }, olive: { h: 255, C: 0.3, dL: 0.16 },
      teal: { h: 25, C: 2.1, dL: 0.1 }, blue: { h: 255, C: 0.5, dL: 0.12 }, pink: { h: 20, C: 1.5, dL: 0.06 },
    },
    font: '"Exo 2","Avenir Next","Helvetica Neue",system-ui,sans-serif',
    display: '"Orbitron","Exo 2","Avenir Next",system-ui,sans-serif',
    ground: ['#F3F4F5', '#08090B'],
  },
  material: {
    // Material: Google's Material 3 Expressive, as the Google Home app wears it. Grounds and inks are Google's own static
    // scheme (surface container #F0F4F9 with white cards by day; #131314 with #1E1F20 cards at night); the accent is its
    // blue (primary #0B57D0 / #A8C7FA). The other families keep their roles in Google's colours, as Home gives each a
    // meaning: yellow (a light that's on), orange-red (heating), green, violet and pink.
    name: 'Material',
    light: {
      neutral: { L: [[0.2, 0.2], [0.27, 0.235], [0.55, 0.5], [0.92, 0.945], [0.94, 0.965], [0.97, 1], [1, 1]], h: 255, C: L => (L > 0.6 ? Math.min(0.012, (1 - L) * 0.25) : 0.003) },
      orange: { h: 38, C: 1.1, dL: 0 }, mustard: { h: 88, C: 1.05, dL: 0.03 }, olive: { h: 150, C: 1.25, dL: 0 },
      teal: { h: 262, C: 2.3, dL: 0 }, blue: { h: 292, C: 1.1, dL: 0 }, pink: { h: 355, C: 1.0, dL: 0 },
    },
    dark: {
      neutral: { L: [[0.2, 0.15], [0.245, 0.185], [0.29, 0.24], [0.335, 0.285], [0.36, 0.31], [0.6, 0.62], [0.94, 0.915], [1, 1]], h: 255, C: L => (L < 0.5 ? 0.004 : 0.003) },
      orange: { h: 40, C: 0.95, dL: 0.05 }, mustard: { h: 88, C: 0.9, dL: 0.04 }, olive: { h: 150, C: 1.1, dL: 0.06 },
      teal: { h: 258, C: 1.05, dL: 0.07 }, blue: { h: 292, C: 1.0, dL: 0.06 }, pink: { h: 355, C: 0.9, dL: 0.05 },
    },
    font: '"Google Sans Flex","Google Sans","Roboto",system-ui,-apple-system,sans-serif',
    display: '"Google Sans Flex","Google Sans","Roboto",system-ui,-apple-system,sans-serif',
    ground: ['#F0F4F9', '#131314'],
  },
};

export function mapRgb(look, rgb, dark) {
  const P = LOOKS[look][dark ? 'dark' : 'light'];
  const [L, C, h] = toLch(rgb);
  if (C < 0.045) {   // a neutral (tinted a little toward the family when it carries some colour)
    const n = P.neutral, L2 = interp(n.L, L);
    return fromLch(L2, n.C(L2), typeof n.h === 'function' ? n.h(L2) : n.h);
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
const BARS = /width='62' height='6'/;   // the three little bars' svg (teal, mustard, orange) under Vintage's titles

export function lookBlock(look, css) {
  const L = LOOKS[look];
  const paint = (decl, dark) => {
    const k = decl.indexOf(':'); if (k < 0) return null;
    const prop = decl.slice(0, k).trim(), val = decl.slice(k + 1).trim();
    if (/^font-family$/i.test(prop) || /^--[\w-]*font[\w-]*$/i.test(prop)) return VFONT.test(val) ? `${prop}:${L.font}${/!important/.test(val) ? ' !important' : ''}` : null;
    if (/^font$/i.test(prop) && VFONT.test(val)) return `${prop}:${val.replace(/(["']?Futura[\s\S]*)$/, L.font)}`;
    if ((look === 'layers' || look === 'material') && BARS.test(val)) return `${prop}:none`;   // Vintage's three little bars under a title: Pearl has its light strip instead
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
// .atoms b) and, for Tron, its fonts (in ../home/fonts, so they work offline once seen).
const HEADS = ':is(.title,.head h1,.top h1,header h1,.masthead h1,.hx-title,.sheethead h2,.ptitle)';
const SHAPE = n => `:root :is(.ambient i,.aurora b,.atoms b):nth-child(${n})`;
const BAND = ':is(.ambient,.aurora,.atoms)';
const darkBoth = body => `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${body}}}\n:root[data-theme="dark"]{${body}}\n`;
const svgUrl = svg => `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/%20/g, ' ').replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2F/g, '/')}")`;

// The bar colours by the time of day (data-tod on <html>, home/design.js). Layers had a sky for each; Pearl, which replaced it,
// has one ground all day, so every time of day is the same: the top of the page by day and at night.
const PEARL_DAY = ['radial-gradient(110% 60% at 50% 0%,#FFFDF9 0%,#F4EEE3 55%,#E9E1D3 100%)', 'rgba(255,253,246,0)', 'rgba(255,253,246,0)', '#F7F3EC'];
const PEARL_NIGHT = ['radial-gradient(110% 50% at 50% 100%,#081631 0%,#040A1A 45%,#000206 100%)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', '#02050C'];
export const SKIES = {
  light: { morning: PEARL_DAY, afternoon: PEARL_DAY, evening: PEARL_DAY, night: PEARL_DAY },
  dark: { morning: PEARL_NIGHT, afternoon: PEARL_NIGHT, evening: PEARL_NIGHT, night: PEARL_NIGHT },
};
const skyVars = ([plate, g1, g2, top]) => `--ly-plate:${plate};--ly-g1:${g1};--ly-g2:${g2};--ly-top:${top}`;

// the games keep their own look in Pearl (the owner's call): the rulebook below leaves them out
const GAMES = ['sparkle', 'junction'];
export function signature(look, app) {
  if (look === 'layers') {
    const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
    return `/* Pearl (id 'layers'): light in the dust. By day a cream ground and carbon hairlines; at night near-black blue and
   cool white light. Titles in Unbounded Light (SIL Open Font License, ../home/fonts), glowing a little at night. Vintage's
   disc, dot and pill go: the light and the dust (../home/pearl.js, drawn behind everything) are the only shapes. */
@font-face{font-family:"Unbounded";font-style:normal;font-weight:200;font-display:swap;src:url("../home/fonts/unbounded-200-latin.woff2") format("woff2");unicode-range:${LAT}}
@font-face{font-family:"Unbounded";font-style:normal;font-weight:500;font-display:swap;src:url("../home/fonts/unbounded-500-latin.woff2") format("woff2");unicode-range:${LAT}}   /* Medium: the section titles set into their line of light (../home/pearl.js) */
${HEADS}{font-family:${LOOKS.layers.display};font-style:normal;font-weight:200;letter-spacing:-.025em;font-size-adjust:.43}   /* Unbounded is wide: a little smaller, so titles fit as they did */
:root{--pl-ground:${PEARL_DAY[0]};--pl-top:${PEARL_DAY[3]};--pl-line:#1E2126;--pl-glow:rgba(255,255,255,.9);--pl-ring:0 0 0 1.2px #1E2126,0 10px 22px -14px rgba(70,56,32,.55);--pl-fab:#FFFDF8}
${darkBoth(`--pl-ground:${PEARL_NIGHT[0]};--pl-top:${PEARL_NIGHT[3]};--pl-line:#F2FAFF;--pl-glow:rgba(150,205,255,.55);--pl-ring:inset 0 0 0 1.2px rgba(242,250,255,.85),0 0 18px -2px rgba(150,200,255,.55);--pl-fab:#0A1220`)}:root{background:var(--pl-ground);background-color:var(--pl-top);min-height:100%}
:root :is(body,#app.app){background:transparent}
${SHAPE(1)},${SHAPE(2)},${SHAPE(3)},:root .aos-sky-cap{display:none}
${darkBoth('--pl-title-glow:0 0 22px rgba(160,205,255,.32)')}${HEADS}{text-shadow:var(--pl-title-glow,none)}
:is(.fab,.okbtn){box-shadow:var(--pl-ring);background:var(--pl-fab) !important;color:var(--pl-line) !important}   /* the main button: a ring of light on glass, not a fill */
:is(.fab,.okbtn) svg{stroke:currentColor}
/* loading, drawn in light: a placeholder is only its own faint outline, a line of light running round it */
@property --pl-a{syntax:"<angle>";inherits:false;initial-value:0deg}
:is(.skel,.skeleton){background:none !important;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--pl-line) 14%,transparent) !important;animation:none !important;position:relative}
:is(.skel,.skeleton)::after{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;background:conic-gradient(from var(--pl-a),transparent 0 70%,color-mix(in srgb,var(--pl-line) 60%,transparent) 90%,var(--pl-line) 96%,transparent 97%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;filter:var(--pl-trace-glow,none);animation:pl-trace 2.8s linear infinite;animation-delay:calc(var(--i,0) * -.35s)}
${darkBoth('--pl-trace-glow:drop-shadow(0 0 3px rgba(150,205,255,.8))')}@keyframes pl-trace{to{--pl-a:360deg}}
@media (prefers-reduced-motion:reduce){:is(.skel,.skeleton)::after{animation:none;opacity:.4}}
` + (GAMES.includes(app) ? '' : `/* ---- the rulebook, for every app but the games (GAMES, kept game style): light, not surfaces (decided with the owner) ----
   No cards, boxes, pills or bars: their grounds and edges go, and things sit on Pearl's ground, parted by hairlines.
   Picked means brighter: a ring, a little thicker, never a fill. The main button is a ring of light, the others a
   hairline, a destructive one a red hairline. Fields and chips are faint rings, brighter while in use. No shadows.
   Sheets keep their own solid ground (--sheet), and the bars and floating buttons along the bottom are solid too (--pl-frost,
   --pl-fab): over the page, anything see-through let what scrolled behind them show through. html:root outranks the Vintage block's dark rules. */
html:root[data-look="layers"]{--pl-faint:color-mix(in srgb,var(--pl-line) 20%,transparent);--pl-hairline:color-mix(in srgb,var(--pl-line) 12%,transparent);--pl-pick:inset 0 0 0 1.6px var(--pl-line);
  --tile:transparent;--tile-edge:transparent;--glass:transparent;--glass-2:transparent;--fill:transparent;--seg-thumb:transparent;
  --lg-bg:transparent;--lg-rim:0 0 #0000;--bar-solid:var(--pl-frost);--bar-top:var(--pl-frost);--bar-bottom:var(--pl-frost);--bar-rim:transparent;
  --pl-frost:var(--pl-top);
  --lift:transparent;--lift-strong:transparent;--hi:transparent;--gb-shine:linear-gradient(transparent,transparent);--gb-edge:var(--pl-faint);
  --cta:color-mix(in srgb,var(--pl-line) 4%,transparent);--cta-ink:var(--pl-line);--hair:var(--pl-hairline);--hair-2:var(--pl-hairline);
  --mc-card:transparent;--mc-card-2:transparent;--mc-edge:transparent;--lgs-field:transparent;--icon:var(--pl-line);--pl-surface:#FBF8F2}
${darkBoth('--pl-pick-glow:0 0 10px -1px rgba(150,205,255,.7);--pl-in-glow:0 0 14px -3px rgba(150,205,255,.55)').replace(/:root/g, 'html:root[data-look="layers"]')}html:root[data-look="layers"]{--pl-pick-glow:0 0 #0000;--pl-in-glow:0 0 #0000}
${darkBoth('--pl-surface:#050B18').replace(/:root/g, 'html:root[data-look="layers"]')}/* the one solid surface: sheets, menus and the toasts over the page, on Pearl's own ground so their words stay readable;
   the floating pickers that open from a bar (News, Drinks, Fitness, Money and School's topic or view menu, News' pill
   menu, Podcasts' tags) too, with a faint ring round them: they took the cleared card colour and were see-through */
html:root[data-look="layers"] :is(.sheet,.dmenu,.menu,.popover,.toast,.st-sheet,.viewmenu,.pmenu,.tagmenu){background:var(--pl-surface) !important}
html:root[data-look="layers"] :is(.viewmenu,.pmenu,.tagmenu){-webkit-backdrop-filter:none !important;backdrop-filter:none !important;box-shadow:inset 0 0 0 1px var(--pl-faint),0 18px 40px -18px rgba(0,0,0,.55) !important}
/* everything else that floats over the page or a map took a cleared colour too and went see-through: on the same solid
   ground, with a faint ring (the Updated pill; Podcasts' player bar; Mail's selection bar and toast; Places' map hint;
   Calendar's time while dragging; the caption on aOS's stories; Weather's radar bar) */
html:root[data-look="layers"] :is(.updpill,.mbar,#selbar,#toast,.maphint,.dragtime,.story .foot,.rd-bar,.rd-note.small){background:var(--pl-surface) !important;color:var(--text) !important;-webkit-backdrop-filter:none !important;backdrop-filter:none !important;box-shadow:inset 0 0 0 1px var(--pl-faint) !important}
/* ...and the round buttons that float (aOS's back and close over a page, Places' map buttons, Weather's radar zoom and
   play), on the floating buttons' solid ground; Podcasts' show header, once scrolled, a solid bar like the others */
html:root[data-look="layers"] :is(.page > .back,.page > .close,.mapbtns .iconbtn,.rd-zoom button,.rd-play){background:var(--pl-fab) !important;color:var(--pl-line) !important;-webkit-backdrop-filter:none !important;backdrop-filter:none !important;box-shadow:inset 0 0 0 1px var(--pl-faint) !important}
html:root[data-look="layers"] .pushhead::before{background:var(--pl-frost) !important}
html:root[data-look="layers"] :is(.seg,.segmented,.modes,.rgroup,.card,.empty,.notice,.group,.sum,.kpis,.addbox,.stats,.chartcard,.lead,.list,.box){-webkit-backdrop-filter:none;backdrop-filter:none}
/* picked: a ring, a little thicker, glowing at night (the sliding thumb, or the button itself where nothing slides) */
html:root[data-look="layers"] .slthumb{background:transparent !important;box-shadow:var(--pl-pick),var(--pl-pick-glow) !important}
html:root[data-look="layers"] :is(.seg:not(.slides) button[aria-pressed="true"],.seg button[aria-checked="true"],.tabs:not(.slides) .tab[aria-selected="true"],.chip.on,.chip.pill.on,.pillbtn[aria-pressed="true"],.frow .unit button[aria-pressed="true"]){background:transparent !important;color:var(--pl-line) !important;box-shadow:var(--pl-pick),var(--pl-pick-glow) !important}
html:root[data-look="layers"] :is(.seg,.slides) :is(button,.tab)[aria-pressed="true"],html:root[data-look="layers"] :is(.tabs) .tab[aria-selected="true"]{color:var(--pl-line)}
/* a selector whose buttons are themselves the .seg (News's News | Scores | Table, its topics): the chosen one in light, not
   Vintage's ink for its mustard thumb (dark on the night ground); its own ring where no thumb slides under it */
html:root[data-look="layers"] .seg[aria-selected="true"]{color:var(--pl-line) !important}
html:root[data-look="layers"] :not(.slides) > .seg[aria-selected="true"]{background:transparent !important;box-shadow:var(--pl-pick),var(--pl-pick-glow) !important}
/* bars that float over the page (tab bars, the dock): frosted Pearl ground so what scrolls under them can't show through, no outline */
html:root[data-look="layers"] :is(.tabbar,.tabs,.dock,.vbar,.tagbtn){box-shadow:none}
html:root[data-look="layers"] .tagbtn{background:var(--pl-frost) !important;color:var(--pl-line) !important;box-shadow:inset 0 0 0 1px var(--pl-faint) !important;-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}
/* chips and the choices in a row: each a faint ring, its words in the page's ink */
html:root[data-look="layers"] :is(.chip,.fchip,.opt,.pillbtn,.morebtn){background:transparent;color:var(--text);box-shadow:inset 0 0 0 1px var(--pl-faint)}
/* buttons: the main one a ring of light; the rest a hairline; destructive a red hairline */
html:root[data-look="layers"] :is(.btn.main,.btn.cta,.btn.primary,.ctabtn,.send,.banner button,.round.go,.mini.go,.bizacts button:first-child){background:var(--cta) !important;color:var(--pl-line) !important;box-shadow:var(--pl-ring) !important}
html:root[data-look="layers"] .btn:not(.main):not(.cta):not(.primary):not(.danger):not(.warn){background:transparent;color:var(--pl-line);box-shadow:inset 0 0 0 1px var(--pl-faint)}
html:root[data-look="layers"] :is(.btn.danger,.btn.warn){background:transparent;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--danger,#C0443A) 70%,transparent)}
/* fields: a faint ring, brighter and a little thicker while you type; a search box is the ring, its input inside isn't */
html:root[data-look="layers"] :is(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="hidden"]):not([type="file"]),textarea,select):not(.search *):not(.sbox *):not(.askipsy *):not(.st-field){background:transparent;box-shadow:inset 0 0 0 1px var(--pl-faint)}
html:root[data-look="layers"] :is(input,textarea,select):not(.search *):not(.sbox *):not(.askipsy *):focus{box-shadow:var(--pl-pick),var(--pl-in-glow);outline:none}
html:root[data-look="layers"] :is(.search,.sbox,.askipsy,.st-field){background:transparent !important;box-shadow:inset 0 0 0 1px var(--pl-faint) !important}
html:root[data-look="layers"] :is(.search,.sbox,.askipsy):focus-within,html:root[data-look="layers"] .st-field:focus{box-shadow:var(--pl-pick),var(--pl-in-glow) !important}
html:root[data-look="layers"] :is(.search,.sbox,.askipsy) :is(input,textarea){box-shadow:none;background:transparent}
/* bars an app draws over the page itself (a view picker, a dock of views, a tab bar in a dock): frosted ground, a faint ring;
   its icons rings, the picked one's thumb the pick ring */
html:root[data-look="layers"] :is(.vbar,.vtop)::before{background:var(--pl-frost) !important;box-shadow:inset 0 0 0 1px var(--pl-faint) !important;-webkit-backdrop-filter:blur(18px) !important;backdrop-filter:blur(18px) !important}
html:root[data-look="layers"] .dock>.tabs{background:var(--pl-frost);box-shadow:inset 0 0 0 1px var(--pl-faint);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}
html:root[data-look="layers"] :is(.vbar,.vtop)>button,html:root[data-look="layers"] .vbar .vb-chev svg{color:var(--pl-line) !important}
html:root[data-look="layers"] :is(.vbar .vb-ic,.vtop .vt-ic){background:transparent !important;color:var(--pl-line) !important;box-shadow:inset 0 0 0 1px var(--pl-faint)}
html:root[data-look="layers"] :is(.tabs,.seg,.slides) :is(.tab,button) svg{color:var(--muted)}
html:root[data-look="layers"] :is(.tabs,.seg,.slides) :is(.tab[aria-selected="true"],button[aria-pressed="true"],button[aria-selected="true"]) svg{color:var(--pl-line) !important}
html:root[data-look="layers"] .vt-thumb{background:transparent !important;box-shadow:var(--pl-pick),var(--pl-pick-glow) !important}
/* a banner: no ground, a faint ring */
html:root[data-look="layers"] .banner{background:transparent !important;box-shadow:inset 0 0 0 1px var(--pl-faint) !important}
/* today, in a calendar or a list of days: its number in a ring of light, the brightest thing there; no tinted cell */
html:root[data-look="layers"] :is(.mday.today .n,.drow.today .dn b,.tghead .dh.today b,.ygrid .today){background:transparent !important;color:var(--pl-line) !important;box-shadow:var(--pl-pick),var(--pl-pick-glow) !important}
html:root[data-look="layers"] .mday.today{background:transparent}
/* blocks one under another (what were cards: an email, a trip, an order, a group of rows) parted by a very thin, discreet
   hairline of light that fades at its ends, drawn half way across the gap between them (border-image: nothing moves) */
html:root[data-look="layers"]{--pl-sep:color-mix(in srgb,var(--pl-line) 24%,transparent)}
html:root[data-look="layers"] :is(.card,.rgroup,.group,.box,.obox,.ocard,.tripwrap,.trip,.tcard,.upcard,.lead,.chartcard,.kpis,.sum,.notice,.stats,.tl,.addbox,.wstrip,.dg,.lroom,.agw) + :is(.card,.rgroup,.group,.box,.obox,.ocard,.tripwrap,.trip,.tcard,.upcard,.lead,.chartcard,.kpis,.sum,.notice,.stats,.tl,.addbox,.wstrip,.dg,.lroom,.agw),html:root[data-look="layers"] ul.list.pills > li + li,html:root[data-look="layers"] .grid .col > .sw + .sw{border-image:linear-gradient(90deg,transparent,var(--pl-sep) 14%,var(--pl-sep) 86%,transparent) 1 / 1px 0 0 0 / var(--pl-sep-out,6px) 0 0 0 !important}
html:root[data-look="layers"] ul.list.pills > li,html:root[data-look="layers"] .grid .col > .sw{--pl-sep-out:5px}
/* and a section: the same hairline above each section's title (or the block that starts with one), across the gap from
   what came before it; not above the first thing on a screen */
html:root[data-look="layers"] :is(.sechead,.sect,.group,.daylbl,.evhead,.mhead,.vsec-h):not(:first-child),html:root[data-look="layers"] :is(div,section,li):has(> :is(.sechead,.vsec-h):first-child):not(:first-child){border-image:linear-gradient(90deg,transparent,var(--pl-sep) 14%,var(--pl-sep) 86%,transparent) 1 / 1px 0 0 0 / var(--pl-sec-out,9px) 0 0 0 !important}
/* sections, drawn by ../home/pearl.js (which finds them and measures into these): each section's title set into a
   bright line of light, a stub before it; the hairline above it goes. One pseudo-element of the title paints it */
html:root[data-look="layers"] :is([data-pl-sec],[data-pl-wrap]):not(#pl-none){border-image:none !important}
html:root[data-look="layers"] [data-pl-pos]{position:relative}
html:root[data-look="layers"] [data-pl-shift]{padding-left:var(--pl-pad) !important}
html:root[data-look="layers"] [data-pl-draw="b"]::before,html:root[data-look="layers"] [data-pl-draw="a"]::after{content:"" !important;display:block !important;position:absolute !important;inset:auto !important;left:var(--pl-x) !important;top:var(--pl-y) !important;width:var(--pl-w) !important;height:var(--pl-h) !important;margin:0 !important;padding:0 !important;border:0 !important;border-radius:0 !important;background:var(--pl-bg) !important;box-shadow:none !important;opacity:1 !important;transform:none !important;filter:none !important;-webkit-mask:none !important;mask:none !important;animation:none !important;transition:none !important;pointer-events:none !important;z-index:1 !important}
${darkBoth('--pl-sec-glow:0 0 8px rgba(150,205,255,.75),0 0 20px rgba(150,205,255,.45)').replace(/:root/g, 'html:root[data-look="layers"]')}html:root[data-look="layers"]{--pl-sec-glow:0 0 #0000}
html:root[data-look="layers"] [data-pl-title]{font-family:${LOOKS.layers.display} !important;font-weight:500 !important;font-size:15px !important;letter-spacing:.14em !important;font-size-adjust:none;color:var(--pl-line) !important;text-shadow:var(--pl-sec-glow) !important;opacity:1 !important}
html:root[data-look="layers"] :is([data-pl-title="fit"],[data-pl-title="sub"]){font-size:12.5px !important;letter-spacing:.08em !important}
/* a text button (Edit, Done) in the light's own colour, not an accent */
html:root[data-look="layers"] .textbtn:not(.danger){color:var(--pl-line)}
`);
  }
  if (look === 'grid') {
    const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
    const face = (fam, w, file, range) => `@font-face{font-family:"${fam}";font-style:normal;font-weight:${w};font-display:swap;src:url("../home/fonts/${file}.woff2") format("woff2");unicode-range:${range}}`;
    return `/* Tron: light cycles, after the Tron: Ares mode in Tesla's cars - dark only, as the car's screen goes, with red
   only for what's lit: a red light trail that runs around the screen behind everything (it shows in the margins, never
   over a card or an icon), a light racing along it, a faint grid floor under the title, and a glow on what's lit.
   Orbitron headings, Exo 2 for the rest (SIL Open Font License, ../home/fonts). Vintage's disc,
   dot and pill behind the title go: the car's screen is calm. */
${face('Orbitron', 700, 'orbitron-700-latin', LAT)}
${face('Exo 2', '400 700', 'exo-2-latin', LAT)}
@property --tr-a{syntax:'<angle>';inherits:false;initial-value:0deg}
${HEADS}{font-family:${LOOKS.grid.display};font-weight:700;letter-spacing:.02em;font-size-adjust:.5}
:root{--tr-line:#FF2A2A;--tr-hot:#E9EDF1;--tr-glow:1;--tr-grid:rgba(255,42,42,.16);color-scheme:dark}
${SHAPE(1)},${SHAPE(2)},${SHAPE(3)}{display:none}
${BAND}::after{content:'';position:absolute;left:-30%;right:-30%;top:62%;height:110px;pointer-events:none;
  background:linear-gradient(90deg,var(--tr-grid) 1px,transparent 1px) 50% 0/24px 100%,linear-gradient(var(--tr-grid) 1px,transparent 1px) 0 0/100% 14px;
  transform:perspective(140px) rotateX(58deg);transform-origin:top;-webkit-mask-image:linear-gradient(#000,transparent);mask-image:linear-gradient(#000,transparent)}
:root :is(body,#app.app){background:transparent}   /* the page's ground is <html>'s, so the trail (behind everything) shows */
:root::before,:root::after{content:'';position:fixed;inset:max(3px,env(safe-area-inset-top)) 4px 4px 4px;z-index:-1;pointer-events:none;border-radius:30px 30px var(--tr-foot) var(--tr-foot);--tr-foot:max(30px,calc(env(safe-area-inset-bottom) + 14px))}
:root::before{box-shadow:inset 0 0 0 1.5px rgba(255,42,42,.32),inset 0 0 14px rgba(255,42,42,.12),0 0 10px rgba(255,42,42,.18)}
:root::after{padding:2px;background:conic-gradient(from var(--tr-a),transparent 0 78%,rgba(255,42,42,.35) 90%,#FF2A2A 97%,#FFE1E1 98.4%,transparent 98.6%);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);
  filter:drop-shadow(0 0 4px #FF2A2A);animation:trRun 7s linear infinite}
@keyframes trRun{to{--tr-a:360deg}}
@media (prefers-reduced-motion:reduce){:root::after{animation:none;opacity:0}}
:is(.fab,.okbtn){box-shadow:0 0 calc(var(--tr-glow) * 16px) color-mix(in srgb,var(--tr-line) 70%,transparent)}
`;
  }
  if (look === 'material') return material(app);
  return '';
}

// ---- Material (Material 3 Expressive, as Google Home wears it) ----
// Google's static scheme as tokens (--md-*), then the app's own tokens pointed at them, then the components every app
// shares (cards, buttons, the FAB, chips, the selectors, bars, sheets, menus, fields) in Material's shapes: fully round
// buttons that square off a little while pressed, tonal cards with no edge or shadow, a secondary-container pill under
// what is picked. Sparkle Kingdom keeps its own style (the owner's call): it takes the colours and the type only.
const MATERIAL_OWN = ['sparkle'];
function material(app) {
  const M = 'html:root[data-look="material"]';
  const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  const dark = body => darkBoth(body).replace(/:root/g, M);
  const F = LOOKS.material.font;
  const LIGHT = '--md-primary:#0B57D0;--md-on-primary:#FFFFFF;--md-primary-container:#D3E3FD;--md-on-primary-container:#041E49;--md-secondary-container:#C2E7FF;--md-on-secondary-container:#001D35;'
    + '--md-ground:#F0F4F9;--md-surface:#FFFFFF;--md-low:#F8FAFD;--md-container:#E9EEF6;--md-highest:#DDE3EA;--md-sheet:#F0F4F9;--md-sheet-card:#FFFFFF;'
    + '--md-on-surface:#1F1F1F;--md-on-surface-variant:#444746;--md-outline:#747775;--md-outline-variant:#C4C7C5;--md-error:#B3261E;--md-error-container:#F9DEDC;'
    + '--md-inverse-surface:#303030;--md-inverse-on-surface:#F2F2F2;--md-scrim:rgba(0,0,0,.32);'
    + '--md-elev1:0 1px 2px rgba(0,0,0,.3),0 1px 3px 1px rgba(0,0,0,.15);--md-elev2:0 1px 2px rgba(0,0,0,.3),0 2px 6px 2px rgba(0,0,0,.15);--md-elev3:0 1px 3px rgba(0,0,0,.3),0 4px 8px 3px rgba(0,0,0,.15)';
  const DARK = '--md-primary:#A8C7FA;--md-on-primary:#062E6F;--md-primary-container:#0842A0;--md-on-primary-container:#D3E3FD;--md-secondary-container:#004A77;--md-on-secondary-container:#C2E7FF;'
    + '--md-ground:#131314;--md-surface:#1E1F20;--md-low:#1B1B1B;--md-container:#282A2C;--md-highest:#333537;--md-sheet:#1E1F20;--md-sheet-card:#282A2C;'
    + '--md-on-surface:#E3E3E3;--md-on-surface-variant:#C4C7C5;--md-outline:#8E918F;--md-outline-variant:#444746;--md-error:#F2B8B5;--md-error-container:#8C1D18;'
    + '--md-inverse-surface:#E3E3E3;--md-inverse-on-surface:#303030;--md-scrim:rgba(0,0,0,.5)';
  const head = `/* Material: Google's Material 3 Expressive, as the Google Home app wears it. Google Sans Flex for every word (SIL
   Open Font License, ../home/fonts); Google's static colour scheme as --md-* tokens. Vintage's disc, dot and pill behind
   the title go, and the three little bars under it. */
@font-face{font-family:"Google Sans Flex";font-style:normal;font-weight:100 1000;font-display:swap;src:url("../home/fonts/google-sans-flex-latin.woff2") format("woff2");unicode-range:${LAT}}
${M}{${LIGHT}}
${dark(DARK)}${HEADS}{font-family:${LOOKS.material.display};font-style:normal;font-weight:500;letter-spacing:-.015em}
${M} body{font-family:${F}}
${SHAPE(1)},${SHAPE(2)},${SHAPE(3)},:root .aos-sky-cap{display:none}
`;
  if (MATERIAL_OWN.includes(app)) return head;
  const PICKED = `${M} :is(.seg:not(.slides) button[aria-pressed="true"],.seg button[aria-checked="true"],.tabs:not(.slides) .tab[aria-selected="true"],.chip.on,.chip[aria-pressed="true"],.chip[aria-selected="true"],.fchip[aria-pressed="true"],.opt[aria-checked="true"],.opt[aria-pressed="true"],.pillbtn[aria-pressed="true"],.frow .unit button[aria-pressed="true"]),${M} :not(.slides) > .seg[aria-selected="true"]`;
  const CARDS = ':is(.card,.rgroup,.group,.box,.obox,.ocard,.trip,.tcard,.upcard,.lead,.chartcard,.kpis,.sum,.notice,.stats,.addbox,.banner)';
  return head + `/* ---- the rulebook, the same in every app (Sparkle Kingdom aside) ---- */
${M}{--bg:var(--md-ground);--accent:var(--md-primary);--accent-text:var(--md-primary);--accent-ink:var(--md-primary);--on-accent:var(--md-on-primary);--icon:var(--md-primary);
  --cta:var(--md-primary);--cta-ink:var(--md-on-primary);--seg-thumb:var(--md-secondary-container);--sel-ink:var(--md-on-secondary-container);--mc-on-mustard:var(--md-on-secondary-container);
  --mc-card:var(--md-surface);--mc-card-2:var(--md-container);--glass:var(--md-surface);--glass-2:var(--md-container);--tile:var(--md-surface);--pill:var(--md-container);
  --mc-edge:transparent;--gb-edge:transparent;--tile-edge:transparent;--bar-rim:transparent;--lg-rim:0 0 #0000;--lgs-edge:transparent;--lgs-rim:transparent;--gb-shadow:none;
  --hair:var(--md-outline-variant);--hair-2:color-mix(in srgb,var(--md-outline-variant) 55%,transparent);--fill:color-mix(in srgb,var(--md-on-surface) 8%,transparent);
  --sheet:var(--md-sheet);--toast:var(--md-inverse-surface);--scrim:var(--md-scrim);--lgs-scrim:var(--md-scrim);--grab:color-mix(in srgb,var(--md-on-surface-variant) 40%,transparent);--ring:var(--md-outline);
  --bar-top:var(--md-ground);--bar-bottom:var(--md-ground);--bar-solid:var(--md-ground);--lg-bg:var(--md-container);--lgs-top:var(--md-sheet);--lgs-bottom:var(--md-sheet);--lgs-field:var(--md-container);
  --danger:var(--md-error);--danger-text:var(--md-error);--danger-ink:var(--md-error);
  --md-state:color-mix(in srgb,var(--md-on-surface) 10%,transparent);--md-ease:cubic-bezier(.2,0,0,1)}
/* no capitals or tracking anywhere: Material's labels are sentence case (the Special Edition badge aside) */
${M} body :where(*):not(.se){text-transform:none !important;letter-spacing:normal !important}
/* a sheet is one step up, so what sits on it is a step up again */
${M} :is(.sheet,.st-sheet){--mc-card:var(--md-sheet-card);--glass:var(--md-sheet-card);--tile:var(--md-sheet-card)}
/* section titles: Material's label, in the primary colour, as Android's Settings has them; no capitals or tracking */
${M} :is(.sechead,.label,.sect,.vsec-h){font-size:14px;font-weight:500;letter-spacing:.006em;text-transform:none;color:var(--md-primary)}
${M} :is(.sechead,.label) span{letter-spacing:0}
/* cards: a tonal surface, 20 round (large increased), no edge, no shadow */
${M} ${CARDS}{border-radius:20px;border-color:transparent;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none}
${M} :is(.sheet,.st-sheet) ${CARDS}{border-radius:16px}
/* buttons: fully round; while pressed the corners square off a little (Expressive's shape change). Filled is the
   primary; the quiet one outlined; a destructive one outlined in the error colour */
${M} :is(.btn,.ctabtn,.okbtn,.send,.textbtn,.banner button){border-radius:999px;font-weight:500;letter-spacing:.006em;text-transform:none;transition:border-radius .2s var(--md-ease),background-color .2s,transform .18s}
${M} :is(.btn,.ctabtn,.okbtn):active{border-radius:14px;filter:none}
${M} .btn.quiet:not(.danger){background:transparent;color:var(--md-primary);box-shadow:inset 0 0 0 1px var(--md-outline-variant)}
${M} :is(.btn.danger,.btn.warn,.btn.quiet.danger){background:transparent;color:var(--md-error);box-shadow:inset 0 0 0 1px var(--md-outline-variant)}
${M} .textbtn:not(.danger){color:var(--md-primary)}
${M} .empty > .btn{display:flex;width:fit-content;margin-left:auto;margin-right:auto}
/* the floating action button: a rounded square in the primary container, lifted */
${M} .fab{border-radius:16px;background:var(--md-primary-container) !important;color:var(--md-on-primary-container) !important;box-shadow:var(--md-elev3) !important;transition:border-radius .2s var(--md-ease),transform .18s}
${M} .fab.small{border-radius:12px}
${M} .fab:active{border-radius:28px}
${M} .fab svg{stroke:currentColor}
/* icon buttons: no container; a state layer while pressed */
${M} .iconbtn{background:transparent;box-shadow:none;color:var(--md-on-surface-variant)}
${M} .iconbtn:active{background:var(--md-state);color:var(--md-on-surface)}
${M} .iconbtn[aria-pressed="true"]{background:var(--md-secondary-container);color:var(--md-on-secondary-container)}
/* search: a full pill in a higher surface, no edge */
${M} :is(.search,.sbox,.askipsy){background:var(--md-container) !important;box-shadow:none !important;border-color:transparent !important;border-radius:999px}
${M} :is(.search,.sbox,.askipsy):focus-within{box-shadow:inset 0 0 0 2px var(--md-primary) !important}
/* chips: 8 round with a thin outline; picked, the secondary container and no outline */
${M} :is(.chip,.fchip,.opt,.pillbtn,.morebtn){border-radius:8px;background:transparent;color:var(--md-on-surface-variant);font-weight:500;box-shadow:inset 0 0 0 1px var(--md-outline-variant);border-color:transparent}
/* picked: the secondary container under it (the sliding thumb, or the button itself where nothing slides) */
${M} :is(.slthumb,.vt-thumb){background:var(--md-secondary-container) !important;box-shadow:none !important;border-radius:999px}
${PICKED}{background:var(--md-secondary-container) !important;color:var(--md-on-secondary-container) !important;box-shadow:none !important}
${M} :is(.seg,.slides,.tabs) :is(button,.tab)[aria-pressed="true"],${M} :is(.seg,.slides,.tabs) :is(button,.tab)[aria-selected="true"],${M} :is(.seg,.slides,.tabs) :is(button,.tab)[aria-checked="true"],${M} .seg[aria-selected="true"]{color:var(--md-on-secondary-container) !important}
${M} :is(.tabs,.seg,.slides) :is(.tab[aria-selected="true"],button[aria-pressed="true"],button[aria-selected="true"]) svg{color:var(--md-on-secondary-container) !important}
/* the selectors: a tonal track, fully round */
${M} :is(.seg,.segmented,.modes):not(button){background:var(--md-container);border-color:transparent;box-shadow:none;border-radius:24px}
${M} :is(.seg,.segmented,.modes) > button{border-radius:20px}
/* bars that float over the page (tab bars, a dock's tabs, a view picker): Expressive's floating toolbar, a pill in a
   higher surface, lifted */
${M} :is(.tabs,.tabbar,.dock > .tabs){background:var(--md-container) !important;box-shadow:var(--md-elev2) !important;-webkit-backdrop-filter:none;backdrop-filter:none;border-color:transparent}
${M} .tabs:has(> .seg){background:transparent !important;box-shadow:none !important}   /* a strip of tabs in the header (Meals), not a floating bar */
${M} .tabs :is(button,.tab){font-weight:500}
${M} .tabs :is(button,.tab):not([aria-selected="true"]):not([aria-pressed="true"]){color:var(--md-on-surface-variant) !important}
${M} .tagbtn{background:var(--md-container) !important;color:var(--md-on-surface) !important;box-shadow:var(--md-elev2) !important;font-weight:500}
${M} .tagbtn .tb-ic{background:var(--md-secondary-container) !important;color:var(--md-on-secondary-container) !important}
${M} .tagbtn .tb-chev{color:var(--md-on-surface-variant) !important}
${M} :is(.vbar,.vtop)::before{background:var(--md-container) !important;box-shadow:var(--md-elev2) !important;-webkit-backdrop-filter:none !important;backdrop-filter:none !important}
${M} :is(.vbar,.vtop) > button{color:var(--md-on-surface) !important;text-transform:none;letter-spacing:.006em;font-weight:500}
${M} :is(.vbar .vb-ic,.vtop .vt-ic){background:var(--md-secondary-container) !important;color:var(--md-on-secondary-container) !important}
${M} .vbar .vb-chev svg{color:var(--md-on-surface-variant) !important}
/* sheets: 28 round at the top, a short handle; menus 16 round, lifted; the toast is a snackbar on the inverse surface */
${M} .sheet:not(.page){border-radius:28px 28px 0 0;box-shadow:none;background:var(--md-sheet) !important}
${M} .sheet.page::before{display:none}
${M} .grab{width:32px;height:4px}
${M} :is(.dmenu,.menu,.popover,.viewmenu,.pmenu,.tagmenu){border-radius:16px;background:var(--md-low) !important;box-shadow:var(--md-elev2) !important;-webkit-backdrop-filter:none !important;backdrop-filter:none !important}
${M} :is(.dmenu,.menu,.popover,.viewmenu,.pmenu,.tagmenu) button{border-radius:12px}
${M} :is(.viewmenu,.pmenu) .ic{background:var(--md-secondary-container) !important;color:var(--md-on-secondary-container) !important}
${M} :is(.toast,#toast){background:var(--md-inverse-surface) !important;color:var(--md-inverse-on-surface) !important;border-radius:12px;box-shadow:var(--md-elev3) !important}
/* fields: outlined, 4 round as Material's text fields; the outline thicker and primary while you type */
${M} :is(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="hidden"]):not([type="file"]),textarea,select):not(.search *):not(.sbox *):not(.askipsy *):not(.st-field){border-radius:4px;box-shadow:inset 0 0 0 1px var(--md-outline);border-color:transparent;background:transparent}
${M} :is(input,textarea,select):not(.search *):not(.sbox *):not(.askipsy *):focus{box-shadow:inset 0 0 0 2px var(--md-primary);outline:none}
${M} :is(.search,.sbox,.askipsy) :is(input,textarea){box-shadow:none;background:transparent}
/* today, in a calendar or a list of days: its number on the primary */
${M} :is(.mday.today .n,.drow.today .dn b,.tghead .dh.today b,.ygrid .today){background:var(--md-primary) !important;color:var(--md-on-primary) !important;box-shadow:none !important}
@media (prefers-reduced-motion:reduce){${M} :is(.btn,.ctabtn,.okbtn,.fab){transition:none}}
`;
}
