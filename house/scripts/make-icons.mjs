// Draws house/icon-512.png and house/icon-180.png in the style of the other
// AllisonOS icons: a full-bleed diagonal gradient (light top left, deep bottom
// right), one white glyph with a soft shadow below it. The glyph is the DG1
// dehumidifier card's hero: a frosted glass tank with water up to a wavy line.
// The gradient runs from the Cube's sea-glass to the Upstairs unit's mist
// blue. Rendered at 1024 and boxed down, so edges stay smooth without any
// image library.
//
//   node house/scripts/make-icons.mjs [output folder]
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
// Gradient stops, top left to bottom right: sea-glass, teal-blue, mist indigo.
const STOPS = [[0, [126, 214, 196]], [0.5, [52, 138, 168]], [1, [56, 74, 150]]];
function sky(x, y) {
  const u = x / N - 0.2, v = y / N, t = clamp01((u * 0.6 + v) / 1.36);
  const k = t < STOPS[1][0] ? 0 : 1, [t0, c0] = STOPS[k], [t1, c1] = STOPS[k + 1];
  const f = (t - t0) / (t1 - t0);
  return [mix(c0[0], c1[0], f), mix(c0[1], c1[1], f), mix(c0[2], c1[2], f)];
}

// The tank: a squircle-ish rounded square, as on the card (148px, 44px radius).
const TANK = { cx: 512, cy: 500, h: 300, r: 90 };
const tank = (x, y) => roundedRect(x, y, TANK.cx, TANK.cy, TANK.h, TANK.h, TANK.r);
// The water line: two periods of a gentle sine across the tank.
const surface = x => 560 + 22 * Math.sin((x - TANK.cx + TANK.h) / (TANK.h * 2) * Math.PI * 4);

function pixel(x, y) {
  let [r, g, b] = sky(x, y);

  // The tank's shadow, soft and low, as if lit from above.
  const sh = 0.30 * 0.5 * erfc((tank(x, y - 34)) / (40 * Math.SQRT2));
  r = mix(r, 14, sh); g = mix(g, 40, sh); b = mix(b, 70, sh);

  const inside = aa(tank(x, y), 1.8);
  if (inside > 0) {
    // Frosted glass: a translucent white pane, brighter toward the top left.
    const lit = clamp01(1 - ((x - 212) + (y - 200)) / 900);
    const glass = (0.20 + 0.16 * lit) * inside;
    r = mix(r, 255, glass); g = mix(g, 255, glass); b = mix(b, 255, glass);
    // The water: solid white below the wavy line.
    const water = aa(surface(x) - y, 2) * inside;
    r = mix(r, 255, water); g = mix(g, 255, water); b = mix(b, 255, water);
  }
  // The rim: a thin bright edge round the glass.
  const rim = aa(Math.abs(tank(x, y) + 5) - 5, 1.6) * 0.55;
  r = mix(r, 255, rim); g = mix(g, 255, rim); b = mix(b, 255, rim);

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
