// Draws weather/icon-512.png and weather/icon-180.png in the style of the
// other AllisonOS icons: a full-bleed diagonal gradient (light top left, deep
// bottom right), one white glyph with a soft shadow below it, and a faint
// translucent echo of the glyph behind, as Podcasts and Calendar have. The
// phone rounds the corners itself. "Day": a sky from cyan through azure to
// indigo, a warm sun peeking out from behind a white cloud, and a smaller
// pale cloud drifting behind. "Night" is the same picture with a crescent
// moon on the Home colours. Rendered at 1024 and boxed down, so edges stay
// smooth without any image library.
//
//   node weather/scripts/make-icons.mjs [day|night] [output folder]
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const N = 1024;
const VARIANT = process.argv[2] === 'night' ? 'night' : 'day';
const OUT = process.argv[3] || join(dirname(fileURLToPath(import.meta.url)), '..');

// --- geometry ---------------------------------------------------------------
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;
// Smooth 1 -> 0 across the edge, so nothing shows a staircase.
const aa = (d, w = 1.6) => clamp01(0.5 - d / w);

const circle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;

function roundedRect(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - (hw - r), qy = Math.abs(y - cy) - (hh - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

// Complementary error function (Abramowitz-Stegun 7.1.26), for a blurred edge.
function erfc(z) {
  const s = z < 0 ? -1 : 1, a = Math.abs(z), t = 1 / (1 + 0.3275911 * a);
  const e = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-a * a);
  return s > 0 ? e : 2 - e;
}

// --- scene ------------------------------------------------------------------
// Gradient stops, top left to bottom right.
const STOPS = VARIANT === 'night'
  ? [[0, [46, 107, 255]], [0.55, [154, 91, 255]], [1, [24, 195, 165]]]      // Home's blue, violet, teal
  : [[0, [112, 224, 255]], [0.5, [44, 124, 255]], [1, [96, 70, 238]]];      // cyan, azure, indigo
function sky(x, y) {
  const u = x / N - 0.2, v = y / N, t = clamp01((u * 0.6 + v) / 1.36);
  const k = t < STOPS[1][0] ? 0 : 1, [t0, c0] = STOPS[k], [t1, c1] = STOPS[k + 1];
  const f = (t - t0) / (t1 - t0);
  return [mix(c0[0], c1[0], f), mix(c0[1], c1[1], f), mix(c0[2], c1[2], f)];
}

// One cloud: three domes on a rounded base, drawn around (616, 664) and then
// moved to (ox, oy) and scaled by s.
function cloud(x, y, ox = 0, oy = 0, s = 1) {
  const lx = (x - 616 - ox) / s + 616, ly = (y - 664 - oy) / s + 664;
  let d = roundedRect(lx, ly, 616, 664, 262, 74, 74);
  for (const [cx, cy, r] of [[520, 616, 108], [640, 572, 142], [764, 640, 96]]) d = Math.min(d, circle(lx, ly, cx, cy, r));
  return d * s;
}
const FRONT = [-30, 34, 1];          // ox, oy, scale
const BACK = [128, -330, 0.5];       // the small pale one, up and to the right

// The sun (day) or crescent moon (night), up and to the left of the cloud.
const SUN = { cx: 384, cy: 414, r: 172 };
function body(x, y) {
  const d = circle(x, y, SUN.cx, SUN.cy, SUN.r);
  return VARIANT === 'night' ? Math.max(d, -circle(x, y, SUN.cx + 78, SUN.cy - 56, SUN.r * 0.86)) : d;
}

function pixel(x, y) {
  let [r, g, b] = sky(x, y);

  // The small cloud behind: translucent white.
  const back = aa(cloud(x, y, ...BACK), 1.8) * 0.30;
  r = mix(r, 255, back); g = mix(g, 255, back); b = mix(b, 255, back);

  // A soft glow around the sun or moon.
  const glow = 0.30 * 0.5 * erfc((circle(x, y, SUN.cx, SUN.cy, SUN.r) - 6) / (80 * Math.SQRT2));
  r = mix(r, 255, glow); g = mix(g, 238, glow); b = mix(b, 200, glow);

  // The sun: amber at the top left to coral at the bottom right. The moon: pale gold.
  const t = clamp01(((x - SUN.cx) + (y - SUN.cy)) / (SUN.r * 2.4) + 0.5);
  const ink = VARIANT === 'night' ? [255, 238, 190]
    : [mix(255, 255, t), mix(222, 132, t), mix(110, 92, t)];
  const sun = aa(body(x, y), 1.8);
  if (sun > 0) { r = mix(r, ink[0], sun); g = mix(g, ink[1], sun); b = mix(b, ink[2], sun); }

  // The front cloud's shadow, on the sky and on the sun, as if lit from above.
  const sh = 0.34 * 0.5 * erfc(cloud(x, y - 26, ...FRONT) / (30 * Math.SQRT2));
  r = mix(r, 22, sh); g = mix(g, 28, sh); b = mix(b, 120, sh);

  // The front cloud: white, a touch cooler at the bottom edge.
  const c = aa(cloud(x, y, ...FRONT), 1.8);
  if (c > 0) {
    const cool = clamp01((y - 640) / 200) * 0.10;
    r = mix(r, 255 - 255 * cool * 0.5, c); g = mix(g, 255 - 255 * cool * 0.25, c); b = mix(b, 255, c);
  }

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
