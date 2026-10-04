// Draws places/icon-512.png and places/icon-180.png in the style of the
// other AllisonOS icons: a full-bleed diagonal gradient (light top left, deep
// bottom right) with a white glyph and a soft shadow below it. The phone
// rounds the corners itself. Places: a folded paper map on a green from lime
// through emerald to deep teal (a colour no other AllisonOS icon uses), a
// dashed route winding across it, and a coral pin with a white star in its
// head (the star for your ratings). Rendered at 1024 and boxed down, so edges
// stay smooth without any image library.
//
//   node places/scripts/make-icons.mjs [output folder]
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const N = 1024;
const OUT = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..');

// --- geometry ---------------------------------------------------------------
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;
const aa = (d, w = 1.6) => clamp01(0.5 - d / w);          // smooth 1 -> 0 across an edge
const circle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;

// Signed distance to any simple polygon (negative inside).
function polygon(x, y, pts) {
  let d = Infinity, inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j], [bx, by] = pts[i];
    const ex = bx - ax, ey = by - ay, wx = x - ax, wy = y - ay;
    const t = clamp01((wx * ex + wy * ey) / (ex * ex + ey * ey));
    d = Math.min(d, Math.hypot(wx - ex * t, wy - ey * t));
    if ((ay > y) !== (by > y) && x < ax + (y - ay) / (by - ay) * ex) inside = !inside;
  }
  return inside ? -d : d;
}

function erfc(z) {                                           // Abramowitz-Stegun 7.1.26, for blurred edges
  const s = z < 0 ? -1 : 1, a = Math.abs(z), t = 1 / (1 + 0.3275911 * a);
  const e = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-a * a);
  return s > 0 ? e : 2 - e;
}
const soft = (d, r) => 0.5 * erfc(d / (r * Math.SQRT2));    // a blurred shape: 1 inside, 0 outside

// --- scene ------------------------------------------------------------------
const STOPS = [[0, [196, 240, 96]], [0.5, [34, 178, 120]], [1, [8, 92, 104]]];   // lime, emerald, deep teal
function sky(x, y) {
  const u = x / N - 0.2, v = y / N, t = clamp01((u * 0.6 + v) / 1.36);
  const k = t < STOPS[1][0] ? 0 : 1, [t0, c0] = STOPS[k], [t1, c1] = STOPS[k + 1];
  const f = (t - t0) / (t1 - t0);
  return [mix(c0[0], c1[0], f), mix(c0[1], c1[1], f), mix(c0[2], c1[2], f)];
}

// The folded map: three panels, the middle one folded back (a touch darker).
const PANELS = [
  [[214, 330], [404, 268], [404, 742], [214, 804]],
  [[404, 268], [620, 330], [620, 804], [404, 742]],
  [[620, 330], [810, 268], [810, 742], [620, 804]],
];
const mapShape = (x, y) => Math.min(...PANELS.map(p => polygon(x, y, p)));

// The route: a smooth curve across the map, drawn as dashes.
const ROUTE = (() => {
  const P = [[270, 700], [360, 560], [470, 700], [560, 560], [600, 500]];     // through these, then up into the pin
  const pts = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < 40; k++) {                        // Catmull-Rom
      const t = k / 40, t2 = t * t, t3 = t2 * t;
      const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
      pts.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  pts.push(P[P.length - 1]);
  let s = 0; const len = [0];
  for (let i = 1; i < pts.length; i++) { s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); len.push(s); }
  return { pts, len };
})();
function route(x, y) {                                       // distance to the dashes
  let best = Infinity;
  const { pts, len } = ROUTE;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], ex = bx - ax, ey = by - ay;
    const t = clamp01(((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey));
    const along = len[i - 1] + t * (len[i] - len[i - 1]);
    if (Math.floor(along / 46) % 2) continue;               // the gaps
    best = Math.min(best, Math.hypot(x - ax - ex * t, y - ay - ey * t));
  }
  return best - 14;
}

// The pin: a round head running down to a point, with a five-pointed star in it.
const PIN = { cx: 640, cy: 360, r: 128, tipY: 600 };
function pin(x, y) {
  const a = Math.asin(PIN.r / (PIN.tipY - PIN.cy)), tx = PIN.r * Math.cos(a), ty = PIN.r * Math.sin(a);
  const tail = polygon(x, y, [[PIN.cx - tx, PIN.cy + ty], [PIN.cx, PIN.tipY], [PIN.cx + tx, PIN.cy + ty]]);
  return Math.min(circle(x, y, PIN.cx, PIN.cy, PIN.r), tail);
}
const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 30 : 72, a = -Math.PI / 2 + i * Math.PI / 5;
  return [PIN.cx + r * Math.cos(a), PIN.cy + 4 + r * Math.sin(a)];
});

function pixel(x, y) {
  let [r, g, b] = sky(x, y);
  const paint = (a, c) => { if (a > 0) { r = mix(r, c[0], a); g = mix(g, c[1], a); b = mix(b, c[2], a); } };

  paint(0.30 * soft(mapShape(x, y - 30), 34), [6, 50, 46]);       // the map's shadow
  const panel = PANELS.findIndex(p => polygon(x, y, p) <= 0.8);
  const m = aa(mapShape(x, y), 1.8);
  paint(m, panel === 1 ? [222, 240, 230] : [255, 255, 255]);      // paper; the folded-back panel a touch darker
  paint(m * aa(route(x, y), 1.8), [30, 160, 110]);                // the dashed route, in the icon's green
  paint(0.32 * soft(circle(x, y, PIN.cx, PIN.tipY + 6, 40), 18), [6, 50, 46]);   // where the pin touches down
  paint(0.30 * soft(pin(x, y - 24), 26), [6, 50, 46]);            // the pin's shadow
  const p = aa(pin(x, y), 1.8);
  const t = clamp01((y - (PIN.cy - PIN.r)) / (PIN.tipY - PIN.cy + PIN.r));
  paint(p, [mix(255, 236, t), mix(112, 66, t), mix(92, 70, t)]);  // coral, deeper towards the tip
  paint(p * aa(polygon(x, y, STAR), 1.8), [255, 255, 255]);       // the star
  return [r, g, b];
}

// --- write ------------------------------------------------------------------
const full = new Float32Array(N * N * 3);
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const [r, g, b] = pixel(x + 0.5, y + 0.5), i = (y * N + x) * 3;
    full[i] = r; full[i + 1] = g; full[i + 2] = b;
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
};

function write(size, path) {
  const step = N / size;                                         // may be fractional
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    let p = y * (size * 3 + 1) + 1;                              // leave filter byte 0
    const y0 = Math.floor(y * step), y1 = Math.min(N, Math.floor((y + 1) * step));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * step), x1 = Math.min(N, Math.floor((x + 1) * step));
      const acc = [0, 0, 0];
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * N + sx) * 3;
          acc[0] += full[i]; acc[1] += full[i + 1]; acc[2] += full[i + 2];
          n++;
        }
      }
      for (let c = 0; c < 3; c++) raw[p++] = Math.round(clamp01(acc[c] / n / 255) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;                                      // 8-bit, truecolour
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
  console.log('wrote', path, size + 'x' + size);
}

write(512, join(OUT, 'icon-512.png'));
write(180, join(OUT, 'icon-180.png'));
