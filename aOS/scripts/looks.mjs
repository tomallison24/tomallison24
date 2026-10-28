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
    name: 'Layers',
    // the AllisonOS colours under a still sky: cool mist neutrals, the four families moved to sea glass, mist
    // blue, shell and sand at Vintage's own lightness (so contrast stays as Vintage had it)
    light: {
      neutral: { L: [[0.2, 0.17], [0.27, 0.215], [0.55, 0.5], [0.94, 0.958], [0.97, 0.988], [1, 1]], h: 255, C: L => 0.004 + 0.022 * (1 - L) },
      orange: { h: 24, C: 0.85, dL: 0 }, mustard: { h: 78, C: 0.72, dL: 0 }, olive: { h: 262, C: 1.05, dL: 0 },
      teal: { h: 178, C: 0.9, dL: 0 }, blue: { h: 262, C: 0.9, dL: 0 }, pink: { h: 352, C: 0.8, dL: 0 },
    },
    dark: {
      neutral: { L: [[0.2, 0.15], [0.245, 0.185], [0.29, 0.235], [0.36, 0.29], [0.6, 0.62], [0.94, 0.945], [1, 1]], h: 255, C: L => (L < 0.5 ? 0.016 : 0.006 + 0.02 * (1 - L)) },
      orange: { h: 24, C: 0.85, dL: 0.03 }, mustard: { h: 80, C: 0.75, dL: 0.02 }, olive: { h: 262, C: 1.1, dL: 0.06 },
      teal: { h: 178, C: 0.9, dL: 0.03 }, blue: { h: 262, C: 0.9, dL: 0.04 }, pink: { h: 352, C: 0.8, dL: 0.03 },
    },
    font: '-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",system-ui,sans-serif',
    display: '-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",system-ui,sans-serif',
    ground: ['#EEF1F5', '#10141A'],
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
const BARS = /width='62' height='6'/;   // the three little bars' svg (teal, mustard, orange) under Vintage's titles

export function lookBlock(look, css) {
  const L = LOOKS[look];
  const paint = (decl, dark) => {
    const k = decl.indexOf(':'); if (k < 0) return null;
    const prop = decl.slice(0, k).trim(), val = decl.slice(k + 1).trim();
    if (/^font-family$/i.test(prop) || /^--[\w-]*font[\w-]*$/i.test(prop)) return VFONT.test(val) ? `${prop}:${L.font}${/!important/.test(val) ? ' !important' : ''}` : null;
    if (/^font$/i.test(prop) && VFONT.test(val)) return `${prop}:${val.replace(/(["']?Futura[\s\S]*)$/, L.font)}`;
    if (look === 'layers' && BARS.test(val)) return `${prop}:none`;   // Vintage's three little bars under a title: Layers has the sky instead
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

// Layers' skies, by the time of day (data-tod on <html>, home/design.js), in each mode: the plate's gradient and two
// still glows low down. Light skies stay light at night so the page's dark ink still reads on them; Dark's are deep.
export const SKIES = {
  light: {
    morning:   ['linear-gradient(160deg,#F4DCCB 0%,#F0E0C4 45%,#CFD8EC 100%)', 'rgba(236,196,160,.55)', 'rgba(170,188,226,.5)', '#F4DCCB'],
    afternoon: ['linear-gradient(150deg,#B9DCD2 0%,#C6D1E7 40%,#EAD0CE 75%,#EEDFC4 100%)', 'rgba(150,200,186,.6)', 'rgba(226,182,178,.5)', '#B9DCD2'],
    evening:   ['linear-gradient(160deg,#EDCDC9 0%,#DCCCE5 50%,#CFD5EE 100%)', 'rgba(222,176,172,.55)', 'rgba(184,170,220,.5)', '#EDCDC9'],
    night:     ['linear-gradient(160deg,#D2D7EE 0%,#CFCFEC 55%,#DCD0E3 100%)', 'rgba(150,160,210,.5)', 'rgba(190,160,200,.42)', '#D2D7EE'],
  },
  dark: {
    morning:   ['linear-gradient(160deg,#42302A 0%,#3B3424 45%,#263049 100%)', 'rgba(90,74,48,.8)', 'rgba(42,58,102,.7)', '#42302A'],
    afternoon: ['linear-gradient(150deg,#1F3B35 0%,#252F48 40%,#3F2D2C 75%,#3C3424 100%)', 'rgba(46,90,80,.8)', 'rgba(90,60,58,.7)', '#1F3B35'],
    evening:   ['linear-gradient(160deg,#3F2B2E 0%,#33294A 50%,#222C4A 100%)', 'rgba(74,48,96,.8)', 'rgba(42,58,102,.7)', '#3F2B2E'],
    night:     ['linear-gradient(160deg,#0F1426 0%,#191A33 55%,#241A2C 100%)', 'rgba(42,58,102,.6)', 'rgba(74,48,96,.5)', '#0F1426'],
  },
};
const skyVars = ([plate, g1, g2, top]) => `--ly-plate:${plate};--ly-g1:${g1};--ly-g2:${g2};--ly-top:${top}`;

export function signature(look) {
  if (look === 'layers') {
    const L = SKIES.light, D = SKIES.dark, TODS = Object.keys(L);
    const darkTod = t => `@media (prefers-color-scheme:dark){:root:not([data-theme="light"])[data-tod="${t}"]{${skyVars(D[t])}}}\n:root[data-theme="dark"][data-tod="${t}"]{${skyVars(D[t])}}\n`;
    return `/* Layers: a still sky behind the page, its colours by the time of day (data-tod, set by home/design.js when the
   page opens and when you come back; it never animates), clear behind the title and frosted from there down, as a
   dock of glass over it. Vintage's disc, dot and pill go: the sky is the one shape. System type, bold headings. */
${HEADS}{font-family:${LOOKS.layers.display};font-style:normal;font-weight:700;letter-spacing:-.02em}
:root{--ly-band:calc(env(safe-area-inset-top) + 150px);--ly-veil:rgba(244,246,249,.82);--ly-lift:0 1px 2px rgba(16,24,40,.08),0 10px 22px -12px rgba(16,24,40,.4);${skyVars(L.afternoon)}}
${TODS.filter(t => t !== 'afternoon').map(t => `:root[data-tod="${t}"]{${skyVars(L[t])}}`).join('\n')}
${darkBoth(`--ly-veil:rgba(16,20,26,.78);--ly-lift:0 1px 2px rgba(0,0,0,.3),0 10px 22px -12px rgba(0,0,0,.7);${skyVars(D.afternoon)}`)}${TODS.filter(t => t !== 'afternoon').map(darkTod).join('')}:root{background:linear-gradient(to bottom,transparent 0,transparent var(--ly-band),var(--ly-veil) calc(var(--ly-band) + 110px)),radial-gradient(75% 45% at 8% 94%,var(--ly-g1),transparent 72%),radial-gradient(65% 40% at 96% 70%,var(--ly-g2),transparent 72%),var(--ly-plate);background-color:var(--ly-top);min-height:100%}   /* the colour: the sky's top, as the bars take it */
:root :is(body,#app.app){background:transparent}
${SHAPE(1)},${SHAPE(2)},${SHAPE(3)},:root .aos-sky-cap{display:none}   /* and no fade under a solid status bar: the sky runs on up into it */
:is(.fab,.okbtn){box-shadow:var(--ly-lift)}
`;
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
  return '';
}
