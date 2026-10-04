// Draws places/icon-512.png and places/icon-180.png in the style of the
// other AllisonOS icons: a full-bleed diagonal gradient (light top left, deep
// bottom right), one white glyph with a soft shadow below it, and a faint
// translucent echo of the glyph behind. The phone rounds the corners itself.
// Places: a sunset from apricot through coral to violet, a white map pin with
// a hole through it, and a smaller pale pin behind, up and to the left.
// Rendered at 1024 and boxed down, so edges stay smooth without any image
// library.
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
// Smooth 1 -> 0 across the edge, so nothing shows a staircase.
const aa = (d, w = 1.6) => clamp01(0.5 - d / w);
const circle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;

// Signed distance to a convex polygon (points clockwise or anticlockwise).
function polygon(x, y, pts) {
  let d = Infinity, inside = true;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
    const ex = bx - ax, ey = by - ay, wx = x - ax, wy = y - ay;
    const t = clamp01((wx * ex + wy * ey) / (ex * ex + ey * ey));
    d = Math.min(d, Math.hypot(wx - ex * t, wy - ey * t));
    if (ex * wy - ey * wx > 0) inside = false;
  }
  return inside ? -d : d;
}

// Complementary error function (Abramowitz-Stegun 7.1.26), for a blurred edge.
function erfc(z) {
  const s = z < 0 ? -1 : 1, a = Math.abs(z), t = 1 / (1 + 0.3275911 * a);
  const e = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-a * a);
  return s > 0 ? e : 2 - e;
}

// --- scene ------------------------------------------------------------------
const STOPS = [[0, [255, 196, 120]], [0.5, [255, 92, 118]], [1, [132, 72, 230]]];   // apricot, coral, violet
function sky(x, y) {
  const u = x / N - 0.2, v = y / N, t = clamp01((u * 0.6 + v) / 1.36);
  const k = t < STOPS[1][0] ? 0 : 1, [t0, c0] = STOPS[k], [t1, c1] = STOPS[k + 1];
  const f = (t - t0) / (t1 - t0);
  return [mix(c0[0], c1[0], f), mix(c0[1], c1[1], f), mix(c0[2], c1[2], f)];
}

// A map pin: a round head (centre 512,430, radius 200) running down to a point
// at (512,830) along the tangents, with a round hole in the head. Moved to
// (ox, oy) and scaled by s.
function pin(x, y, ox = 0, oy = 0, s = 1) {
  const lx = (x - 512 - ox) / s + 512, ly = (y - 512 - oy) / s + 512;
  const head = circle(lx, ly, 512, 430, 200);
  const tail = polygon(lx, ly, [[338.8, 530], [512, 830], [685.2, 530]]);
  const body = Math.min(head, tail);
  return Math.max(body, -circle(lx, ly, 512, 430, 80)) * s;
}
const FRONT = [0, 30, 1];
const BACK = [-250, -250, 0.42];

function pixel(x, y) {
  let [r, g, b] = sky(x, y);
  const back = aa(pin(x, y, ...BACK), 1.8) * 0.30;               // the small pale pin behind
  r = mix(r, 255, back); g = mix(g, 255, back); b = mix(b, 255, back);
  const sh = 0.34 * 0.5 * erfc(pin(x, y - 26, ...FRONT) / (30 * Math.SQRT2));   // its shadow, lit from above
  r = mix(r, 70, sh); g = mix(g, 20, sh); b = mix(b, 90, sh);
  const p = aa(pin(x, y, ...FRONT), 1.8);                         // the pin: white
  if (p > 0) { r = mix(r, 255, p); g = mix(g, 255, p); b = mix(b, 255, p); }
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
