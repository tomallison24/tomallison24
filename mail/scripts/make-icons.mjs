// Draws mail/icon-512.png and mail/icon-180.png in the style of Apple's own
// icons: a full-bleed gradient and a simple white glyph, with iOS rounding the
// corners itself. "Sunrise": a white envelope with a pink flap on a warm
// peach -> pink -> purple sky, so it reads as its own app beside the built-in
// (blue) Mail. Rendered at 1024 and boxed down, so edges stay smooth without
// any image library.
//
//   node mail/scripts/make-icons.mjs
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

function roundedRect(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - (hw - r), qy = Math.abs(y - cy) - (hh - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function segment(x, y, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, wx = x - ax, wy = y - ay;
  const t = clamp01((wx * vx + wy * vy) / (vx * vx + vy * vy));
  return Math.hypot(wx - vx * t, wy - vy * t);
}

// --- scene ------------------------------------------------------------------
// Gradient stops, top left to bottom right: peach, pink, purple.
const STOPS = [[0, [255, 193, 116]], [0.5, [255, 111, 145]], [1, [177, 75, 255]]];
function sky(x, y) {
  // Along the line (0.2, 0) -> (0.8, 1) in unit square coordinates.
  const u = x / N - 0.2, v = y / N, t = clamp01((u * 0.6 + v) / 1.36);
  const k = t < 0.5 ? 0 : 1, [t0, c0] = STOPS[k], [t1, c1] = STOPS[k + 1];
  const f = (t - t0) / (t1 - t0);
  return [mix(c0[0], c1[0], f), mix(c0[1], c1[1], f), mix(c0[2], c1[2], f)];
}

// Complementary error function (Abramowitz-Stegun 7.1.26), for a blurred edge.
function erfc(z) {
  const s = z < 0 ? -1 : 1, a = Math.abs(z), t = 1 / (1 + 0.3275911 * a);
  const e = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-a * a);
  return s > 0 ? e : 2 - e;
}

// The envelope fills about two thirds of the width, like Apple's own glyphs.
const ENV = { cx: 512, cy: 518, hw: 342, hh: 239, r: 80 };
const FLAP = { l: [234, 335], apex: [512, 555], rt: [790, 335], w: 18 };

function pixel(x, y) {
  let [r, g, b] = sky(x, y);

  // Soft plum shadow below the envelope, as if lit from above.
  const sd = roundedRect(x, y - 30, ENV.cx, ENV.cy, ENV.hw, ENV.hh, ENV.r);
  const sh = 0.38 * 0.5 * erfc(sd / (34 * Math.SQRT2));
  r = mix(r, 107, sh); g = mix(g, 18, sh); b = mix(b, 64, sh);

  // Envelope: plain white.
  const ink = aa(roundedRect(x, y, ENV.cx, ENV.cy, ENV.hw, ENV.hh, ENV.r), 1.8);
  if (ink > 0) { r = mix(r, 255, ink); g = mix(g, 255, ink); b = mix(b, 255, ink); }

  // Flap: a rounded pink stroke.
  const flap = Math.min(
    segment(x, y, ...FLAP.l, ...FLAP.apex),
    segment(x, y, ...FLAP.rt, ...FLAP.apex),
  ) - FLAP.w;
  const pink = aa(flap, 1.8);
  if (pink > 0) { r = mix(r, 255, pink); g = mix(g, 143, pink); b = mix(b, 174, pink); }

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
