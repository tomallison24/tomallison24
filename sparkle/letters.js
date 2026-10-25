'use strict';

// Sparkle's letters: a stroke font drawn as SVG paths, in the ball-and-stick
// print US kindergartners learn to read and write. The phone's own font has a
// two-storey a and g that a 5-year-old may not know, and the app loads no web
// fonts, so every letter is drawn here from circles, sticks and arcs: a is a
// circle with a stick on its right, g the same stick hooked under the line,
// and b, d, p, q, o, c are all the same circle.
//
// Metrics, in em units (100 to the em), like lined school paper:
//   y = 6    cap line: capitals, ascenders (b d f h k l) and digits start here
//   y = 40   x-height line (dashed on the paper): a, o, n... start here
//   y = 80   baseline: every letter sits on it
//   y = 108  descender line: g j p q y hang down to it
// A line of text is the 114-unit box 0..114, so nothing clips. Strokes run
// along these lines (a pen's centre), 9 units wide by default, with round caps
// and joins; dots are tiny circles, so they show at any stroke width.
//
//   glyph(ch)          { d, w }: the letter's path, its left edge at x = 0, and
//                      its advance (sidebearings included); null if unknown
//   has(ch)            whether ch has a glyph (space does)
//   path(text, { x, tracking })   { d, w }: the whole text as one path, glyphs
//                      placed side by side from x; w is the text's width
//   measure(text, { size, tracking })   that width in px, where size is the px
//                      height of the whole 114-unit box (the same as svg())
//   svg(text, { size, color, stroke, tracking, label, cls, each })   an <svg>
//                      string size px tall; each: true wraps every glyph in
//                      <g data-i="n"> (n its index in the text) to colour one
//   metrics            { cap, xHeight, baseline, descender, box }: the lines,
//                      for drawing school paper behind the text
// tracking is extra space between letters, in em units. An unknown character
// is a gap as wide as a space; nothing throws.
(function (root) {
  const CAP = 6, XH = 40, BASE = 80, DESC = 108, BOX = 114;
  const MID = 60, R = 20;          // the lowercase circle: centre and radius
  const CMID = 43, CR = 37;        // the capital circle
  const SPACE = 30;
  // Sidebearings by the shape of a letter's side: a straight stick gets the
  // most room, a round side less, a slanted or open side least, so words come
  // out evenly spaced.
  const SIDE = { s: 12, o: 9, v: 4, p: 6 };
  const RAD = Math.PI / 180;

  const n = v => String(Math.round(v * 100) / 100);
  const pt = (x, y) => n(x) + ' ' + n(y);
  const M = (x, y) => 'M' + pt(x, y);
  const L = (x, y) => 'L' + pt(x, y);
  // Straight strokes through any number of points: line(x1, y1, x2, y2, ...).
  const line = (...p) => p.reduce((s, v, i) => i % 2 ? s : s + (i ? L : M)(v, p[i + 1]), '');
  const stick = (x, y1, y2) => M(x, y1) + L(x, y2);
  // An elliptical arc from angle a0 to a1, in degrees on the screen (0 right,
  // 90 down): a1 > a0 goes clockwise. Split into pieces of at most 120 degrees,
  // so no arc is ambiguous. move: false carries on from the pen.
  function arc(cx, cy, rx, ry, a0, a1, move = true) {
    const at = a => pt(cx + rx * Math.cos(a * RAD), cy + ry * Math.sin(a * RAD));
    const k = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 120 - 1e-9));
    let s = move ? 'M' + at(a0) : '';
    for (let i = 1; i <= k; i++) s += 'A' + n(rx) + ' ' + n(ry) + ' 0 0 ' + (a1 > a0 ? 1 : 0) + ' ' + at(a0 + (a1 - a0) * i / k);
    return s;
  }
  // A circle, drawn the way it is written: from about one o'clock, back round
  // to the left.
  const circle = (cx, cy, r, ry = r) => arc(cx, cy, r, ry, -60, -420);
  const dot = (x, y) => arc(x, y, 1.2, 1.2, 0, 360);
  // n, m, h's hump: up from the stick at x, over, and down to the baseline.
  const hump = (x, r, top = XH) => arc(x + r, top + r, r, r, 180, 360) + L(x + 2 * r, BASE);
  // A hook under the baseline for g and j: down the stick at x, then left.
  const hook = (x, top) => stick(x, top, DESC - 12) + arc(x - 12, DESC - 12, 12, 12, 0, 160, false);
  // s and S: two arcs, top bowl open on the right, bottom bowl on the left.
  const ess = (x, top, bot, rx) => {
    const ry = (bot - top) / 4, cx = x + rx;
    return arc(cx, top + ry, rx, ry, -32, -270) + arc(cx, bot - ry, rx, ry, -90, 148, false);
  };

  // ch: [ink width, left side, right side, x => path with its ink starting at x]
  const G = {
    a: [40, 'o', 's', x => circle(x + 20, MID, R) + stick(x + 40, XH, BASE)],
    b: [40, 's', 'o', x => stick(x, CAP, BASE) + circle(x + 20, MID, R)],
    c: [35, 'o', 'v', x => arc(x + 20, MID, R, R, -42, -318)],
    d: [40, 'o', 's', x => circle(x + 20, MID, R) + stick(x + 40, CAP, BASE)],
    e: [40, 'o', 'v', x => line(x, MID, x + 40, MID) + arc(x + 20, MID, R, R, 0, -318, false)],
    f: [30, 'p', 'v', x => line(x, XH, x + 24, XH) + stick(x + 11, BASE, 18) + arc(x + 23, 18, 12, 12, 180, 310, false)],
    g: [40, 'o', 's', x => circle(x + 20, MID, R) + hook(x + 40, XH)],
    h: [36, 's', 's', x => stick(x, CAP, BASE) + hump(x, 18)],
    i: [0, 's', 's', x => stick(x, XH, BASE) + dot(x, 22)],
    j: [12, 'v', 's', x => hook(x + 12, XH) + dot(x + 12, 22)],
    k: [30, 's', 'v', x => stick(x, CAP, BASE) + line(x + 30, XH, x + 1, MID, x + 30, BASE)],
    l: [0, 's', 's', x => stick(x, CAP, BASE)],
    m: [60, 's', 's', x => stick(x, XH, BASE) + hump(x, 15) + hump(x + 30, 15)],
    n: [36, 's', 's', x => stick(x, XH, BASE) + hump(x, 18)],
    o: [40, 'o', 'o', x => circle(x + 20, MID, R)],
    p: [40, 's', 'o', x => stick(x, XH, DESC) + circle(x + 20, MID, R)],
    q: [40, 'o', 's', x => circle(x + 20, MID, R) + stick(x + 40, XH, DESC)],
    r: [30, 's', 'v', x => stick(x, XH, BASE) + arc(x + 18, XH + 18, 18, 18, 180, 312)],
    s: [27, 'o', 'o', x => ess(x, XH, BASE, 13.5)],
    t: [24, 'p', 'p', x => stick(x + 12, 16, BASE) + line(x, XH, x + 24, XH)],
    u: [36, 's', 's', x => stick(x, XH, BASE - 18) + arc(x + 18, BASE - 18, 18, 18, 180, 0, false) + stick(x + 36, XH, BASE)],
    v: [36, 'v', 'v', x => line(x, XH, x + 18, BASE, x + 36, XH)],
    w: [54, 'v', 'v', x => line(x, XH, x + 13.5, BASE, x + 27, XH, x + 40.5, BASE, x + 54, XH)],
    x: [34, 'v', 'v', x => line(x, XH, x + 34, BASE) + line(x + 34, XH, x, BASE)],
    y: [36, 'v', 'v', x => line(x, XH, x + 18, BASE) + line(x + 36, XH, x + 36 - 18 * (DESC - XH) / (BASE - XH), DESC)],
    z: [32, 'o', 'o', x => line(x, XH, x + 32, XH, x, BASE, x + 32, BASE)],

    A: [54, 'v', 'v', x => line(x, BASE, x + 27, CAP, x + 54, BASE) + line(x + 9, 56, x + 45, 56)],
    B: [40, 's', 'o', x => stick(x, CAP, BASE) + M(x, CAP) + L(x + 20, CAP) + arc(x + 20, 23, 17, 17, -90, 90, false) + L(x, 40)
      + M(x, 40) + L(x + 20, 40) + arc(x + 20, 60, 20, 20, -90, 90, false) + L(x, BASE)],
    C: [63, 'o', 'v', x => arc(x + CR, CMID, CR, CR, -42, -318)],
    D: [45, 's', 'o', x => stick(x, CAP, BASE) + M(x, CAP) + L(x + 8, CAP) + arc(x + 8, CMID, CR, CR, -90, 90, false) + L(x, BASE)],
    E: [34, 's', 'p', x => line(x + 34, CAP, x, CAP, x, BASE, x + 34, BASE) + line(x, CMID, x + 28, CMID)],
    F: [34, 's', 'v', x => line(x + 34, CAP, x, CAP, x, BASE) + line(x, CMID, x + 28, CMID)],
    G: [74, 'o', 's', x => arc(x + CR, CMID, CR, CR, -42, -360) + L(x + CR + 10, CMID)],
    H: [44, 's', 's', x => stick(x, CAP, BASE) + stick(x + 44, CAP, BASE) + line(x, CMID, x + 44, CMID)],
    I: [28, 'p', 'p', x => stick(x + 14, CAP, BASE) + line(x, CAP, x + 28, CAP) + line(x, BASE, x + 28, BASE)],
    J: [34, 'o', 's', x => stick(x + 34, CAP, BASE - 17) + arc(x + 17, BASE - 17, 17, 17, 0, 165, false)],
    K: [40, 's', 'v', x => stick(x, CAP, BASE) + line(x + 40, CAP, x + 1, CMID, x + 40, BASE)],
    L: [34, 's', 'v', x => line(x, CAP, x, BASE, x + 34, BASE)],
    M: [56, 's', 's', x => line(x, BASE, x, CAP, x + 28, 62, x + 56, CAP, x + 56, BASE)],
    N: [44, 's', 's', x => line(x, BASE, x, CAP, x + 44, BASE, x + 44, CAP)],
    O: [74, 'o', 'o', x => circle(x + CR, CMID, CR)],
    P: [39, 's', 'o', x => stick(x, CAP, BASE) + M(x, CAP) + L(x + 20, CAP) + arc(x + 20, 24.5, 18.5, 18.5, -90, 90, false) + L(x, CMID)],
    Q: [80, 'o', 'v', x => circle(x + CR, CMID, CR) + line(x + 52, 58, x + 80, 86)],
    R: [40, 's', 'v', x => stick(x, CAP, BASE) + M(x, CAP) + L(x + 20, CAP) + arc(x + 20, 24.5, 18.5, 18.5, -90, 90, false) + L(x, CMID)
      + line(x + 16, CMID, x + 40, BASE)],
    S: [42, 'o', 'o', x => ess(x, CAP, BASE, 21)],
    T: [46, 'v', 'v', x => line(x, CAP, x + 46, CAP) + stick(x + 23, CAP, BASE)],
    U: [48, 's', 's', x => stick(x, CAP, BASE - 24) + arc(x + 24, BASE - 24, 24, 24, 180, 0, false) + stick(x + 48, CAP, BASE)],
    V: [54, 'v', 'v', x => line(x, CAP, x + 27, BASE, x + 54, CAP)],
    W: [72, 'v', 'v', x => line(x, CAP, x + 18, BASE, x + 36, CAP, x + 54, BASE, x + 72, CAP)],
    X: [46, 'v', 'v', x => line(x, CAP, x + 46, BASE) + line(x + 46, CAP, x, BASE)],
    Y: [48, 'v', 'v', x => line(x, CAP, x + 24, CMID, x + 48, CAP) + stick(x + 24, CMID, BASE)],
    Z: [42, 'o', 'o', x => line(x, CAP, x + 42, CAP, x, BASE, x + 42, BASE)],

    // Digits: as tall as capitals, each shape far from the others (6 and 9
    // differ in more than which way up; 1 has a flag, 7 a bar).
    0: [42, 'o', 'o', x => circle(x + 21, CMID, 21, CR)],
    1: [14, 'p', 's', x => line(x, 19, x + 14, CAP, x + 14, BASE)],
    2: [40, 'o', 'o', x => arc(x + 20, 25, 19, 19, 196, 392) + L(x, BASE) + L(x + 40, BASE)],
    3: [38, 'o', 'o', x => arc(x + 18, 23, 17, 17, 204, 450) + arc(x + 18, 60, 20, 20, 270, 516, false)],
    4: [44, 'p', 'o', x => line(x, CAP, x, 54, x + 44, 54) + stick(x + 32, CAP, BASE)],
    5: [42, 'o', 'o', x => { const cx = x + 20, cy = 57.5, r = 22.5, a = 216, sx = cx + r * Math.cos(a * RAD);
      return line(x + 38, CAP, sx, CAP, sx, cy + r * Math.sin(a * RAD)) + arc(cx, cy, r, r, a, 512, false); }],
    6: [42, 'o', 'o', x => { const cx = x + 21, r = 21, cy = BASE - r;
      // the stem comes down from the top right and runs into the circle's left side, tangent to it
      const sx = cx + 16, sy = 7, R2 = ((sx - (cx - r)) ** 2 + (sy - cy) ** 2) / (2 * (sx - (cx - r)));
      return M(sx, sy) + 'A' + n(R2) + ' ' + n(R2) + ' 0 0 0 ' + pt(cx - r, cy) + arc(cx, cy, r, r, 180, 540, false); }],
    7: [40, 'o', 'v', x => line(x, CAP, x + 40, CAP, x + 12, BASE)],
    8: [40, 'o', 'o', x => circle(x + 20, 23, 17) + circle(x + 20, 60, 20)],
    9: [42, 'o', 's', x => circle(x + 21, 27, 21) + stick(x + 42, 20, BASE)],

    '.': [0, 'p', 'p', x => dot(x, BASE)],
    ',': [5, 'p', 'p', x => line(x + 5, BASE - 3, x, 94)],
    '?': [32, 'o', 'o', x => arc(x + 16, 22, 16, 16, 196, 450) + L(x + 16, 56) + dot(x + 16, BASE)],
    '!': [0, 'p', 'p', x => stick(x, CAP, 56) + dot(x, BASE)],
    "'": [0, 'p', 'p', x => stick(x, CAP, 24)],
    '"': [12, 'p', 'p', x => stick(x, CAP, 24) + stick(x + 12, CAP, 24)],
    ':': [0, 'p', 'p', x => dot(x, 46) + dot(x, BASE)],
    ';': [5, 'p', 'p', x => dot(x + 5, 46) + line(x + 5, BASE - 3, x, 94)],
    '_': [36, 'o', 'o', x => line(x, BASE, x + 36, BASE)],
    '/': [32, 'v', 'v', x => line(x, BASE + 4, x + 32, CAP - 2)],
    '(': [14, 'p', 'p', x => M(x + 14, 2) + 'A70 70 0 0 0 ' + pt(x + 14, 104)],
    ')': [14, 'p', 'p', x => M(x, 2) + 'A70 70 0 0 1 ' + pt(x, 104)],
    // Maths: + - = × ÷ centred on the digits' middle, so 3 + 4 = 7 lines up. A
    // hyphen is drawn as a short minus, since Sparkle uses it for take-aways.
    '-': [26, 'o', 'o', x => line(x, 46, x + 26, 46)],
    '+': [34, 'o', 'o', x => line(x, 46, x + 34, 46) + stick(x + 17, 29, 63)],
    '−': [34, 'o', 'o', x => line(x, 46, x + 34, 46)],
    '=': [34, 'o', 'o', x => line(x, 35, x + 34, 35) + line(x, 57, x + 34, 57)],
    '×': [26, 'o', 'o', x => line(x, 33, x + 26, 59) + line(x + 26, 33, x, 59)],
    '÷': [34, 'o', 'o', x => line(x, 46, x + 34, 46) + dot(x + 17, 29) + dot(x + 17, 63)],
    '&': [46, 'o', 'o', x => line(x + 46, BASE, x + 9, 28) + arc(x + 18, 19, 13, 13, 135, 405, false)
      + L(x + 4, 47) + arc(x + 19, 61, 20, 19, 223, -32, false)],
  };
  const SAME = { '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-', '\u00a0': ' ' };

  const find = ch => { ch = SAME[ch] || ch; return Object.prototype.hasOwnProperty.call(G, ch) ? G[ch] : null; };
  // Capitals and digits are bigger, so they get a little more room.
  for (const k in G) if (/^[A-Z0-9]$/.test(k)) G[k].big = 3;
  const lsb = g => SIDE[g[1]] + (g.big || 0);
  const adv = g => lsb(g) + g[0] + SIDE[g[2]] + (g.big || 0);

  function glyph(ch) {
    if (ch === ' ' || SAME[ch] === ' ') return { d: '', w: SPACE };
    const g = find(ch);
    return g ? { d: g[3](lsb(g)), w: adv(g) } : null;
  }
  const has = ch => !!glyph(ch);

  // Each character's placed path (or '' for a space or unknown) and the width.
  function layout(text, x = 0, tracking = 0) {
    const out = [], chars = Array.from(String(text == null ? '' : text));
    let at = x;
    chars.forEach((ch, i) => {
      const g = find(ch);
      out.push(g ? g[3](at + lsb(g)) : '');
      at += (g ? adv(g) : SPACE) + (i < chars.length - 1 ? tracking : 0);
    });
    return { parts: out, w: at - x };
  }

  function path(text, { x = 0, tracking = 0 } = {}) {
    const { parts, w } = layout(text, x, tracking);
    return { d: parts.join(''), w };
  }

  const measure = (text, { size = 100, tracking = 0 } = {}) => layout(text, 0, tracking).w * size / BOX;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function svg(text, { size = 64, color = 'currentColor', stroke = 9, tracking = 0, label = text, cls = '', each = false } = {}) {
    const { parts, w } = layout(text, 0, tracking);
    const body = each
      ? parts.map((d, i) => d ? '<g data-i="' + i + '"><path d="' + d + '"/></g>' : '').join('')
      : '<path d="' + parts.join('') + '"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n(w) + ' ' + BOX + '" width="' + n(w * size / BOX)
      + '" height="' + n(size) + '"' + (cls ? ' class="' + esc(cls) + '"' : '') + ' role="img" aria-label="' + esc(label == null ? '' : label)
      + '" fill="none" stroke="' + esc(color) + '" stroke-width="' + n(+stroke || 0) + '" stroke-linecap="round" stroke-linejoin="round">'
      + body + '</svg>';
  }

  root.SparkleLetters = { glyph, has, measure, svg, path, metrics: { cap: CAP, xHeight: XH, baseline: BASE, descender: DESC, box: BOX } };
})(typeof window !== 'undefined' ? window : globalThis);
