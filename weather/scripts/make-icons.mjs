// Draws weather/icon-512.png and weather/icon-180.png in the style of Apple's
// own icons: a full-bleed gradient and a simple white glyph, with the phone
// rounding the corners itself. A clear sky, from a pale azure at the top to
// a deeper blue at the bottom, a plain sun disc and one soft cloud in front
// of it: nothing else. Rendered at 1024 and boxed down, so edges stay smooth
// without any image library.
//
//   node weather/scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const N = 1024;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..');

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
// The sky, top to bottom: azure to a deeper blue.
const TOP = [86, 176, 255], BOTTOM = [22, 104, 226];
const sky = y => { const t = y / N; return [mix(TOP[0], BOTTOM[0], t), mix(TOP[1], BOTTOM[1], t), mix(TOP[2], BOTTOM[2], t)]; };

// A plain sun, up and to the left; a warm white so it reads as the sun and
// not a second cloud.
const SUN = { cx: 416, cy: 408, r: 176 };
const SUN_INK = [255, 228, 150];

// The cloud, low and to the right, in front of the sun: three domes on a
// rounded base.
const CLOUD = {
  base: { cx: 616, cy: 664, hw: 262, hh: 74, r: 74 },
  domes: [[520, 616, 108], [640, 572, 142], [764, 640, 96]],
};
function cloud(x, y) {
  let d = roundedRect(x, y, CLOUD.base.cx, CLOUD.base.cy, CLOUD.base.hw, CLOUD.base.hh, CLOUD.base.r);
  for (const [cx, cy, r] of CLOUD.domes) d = Math.min(d, circle(x, y, cx, cy, r));
  return d;
}

function pixel(x, y) {
  let [r, g, b] = sky(y);

  // A soft glow around the sun, so it sits in the sky rather than on it.
  const glow = 0.28 * 0.5 * erfc((circle(x, y, SUN.cx, SUN.cy, SUN.r) - 10) / (70 * Math.SQRT2));
  r = mix(r, 255, glow); g = mix(g, 240, glow); b = mix(b, 200, glow);

  // The sun.
  const sun = aa(circle(x, y, SUN.cx, SUN.cy, SUN.r), 1.8);
  if (sun > 0) { r = mix(r, SUN_INK[0], sun); g = mix(g, SUN_INK[1], sun); b = mix(b, SUN_INK[2], sun); }

  // The cloud's shadow, on the sky and on the sun, as if lit from above.
  const sh = 0.30 * 0.5 * erfc(cloud(x, y - 26) / (30 * Math.SQRT2));
  r = mix(r, 14, sh); g = mix(g, 60, sh); b = mix(b, 150, sh);

  // The cloud: plain white.
  const ink = aa(cloud(x, y), 1.8);
  if (ink > 0) { r = mix(r, 255, ink); g = mix(g, 255, ink); b = mix(b, 255, ink); }

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
