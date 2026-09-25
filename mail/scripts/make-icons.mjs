// Draws mail/icon-512.png and mail/icon-180.png: the News icon's family look
// (dark background, soft colour blobs, a frosted glass panel) with an
// envelope instead of headlines. Rendered at 1024 and boxed down, so the
// edges stay smooth without any image library.
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
// Colour blobs behind the glass, in the News icon's palette.
const BLOBS = [
  { x: 0.14, y: 0.12, r: 0.54, c: [90, 120, 255], a: 0.62 },   // blue, top left
  { x: 0.90, y: 0.24, r: 0.52, c: [255, 126, 60], a: 0.58 },   // orange, top right
  { x: 0.84, y: 0.88, r: 0.58, c: [150, 90, 255], a: 0.62 },   // purple, bottom right
  { x: 0.10, y: 0.92, r: 0.52, c: [40, 190, 160], a: 0.50 },   // teal, bottom left
];

function pixel(x, y) {
  const u = x / N, v = y / N;
  let r = 10, g = 11, b = 14;                                   // #0A0B0E

  for (const bl of BLOBS) {
    const d = Math.hypot(u - bl.x, v - bl.y) / bl.r;
    const f = Math.pow(Math.max(0, 1 - d), 2.2) * bl.a;          // soft falloff
    r = mix(r, bl.c[0], f); g = mix(g, bl.c[1], f); b = mix(b, bl.c[2], f);
  }

  // Frosted glass panel.
  const panel = roundedRect(x, y, N / 2, N / 2, 344, 344, 98);
  const inside = aa(panel, 2.0);
  if (inside > 0) {
    const lift = 0.15 * inside;                                  // milky fill
    r = mix(r, 255, lift); g = mix(g, 255, lift); b = mix(b, 255, lift);
    const edge = aa(Math.abs(panel + 2.5) - 2.5, 2.0) * 0.30;     // inner hairline
    r = mix(r, 255, edge); g = mix(g, 255, edge); b = mix(b, 255, edge);
  }

  // Envelope: one solid white shape with the flap notched out of it, the way
  // the News icon draws its headlines as solid bars rather than outlines.
  const pane = [r, g, b];
  const cx = N / 2, cy = N / 2 + 4, hw = 208, hh = 150;
  const ink = aa(roundedRect(x, y, cx, cy, hw, hh, 34), 1.8);
  if (ink > 0) { r = mix(r, 255, ink); g = mix(g, 255, ink); b = mix(b, 255, ink); }

  const apex = cy + 22, top = cy - hh - 6, inset = 16, notch = 30;
  const flap = Math.min(
    segment(x, y, cx - hw + inset, top, cx, apex),
    segment(x, y, cx + hw - inset, top, cx, apex),
  ) - notch / 2;
  const cut = Math.min(aa(flap, 1.8), ink);          // only ever cuts the envelope
  if (cut > 0) { r = mix(r, pane[0], cut); g = mix(g, pane[1], cut); b = mix(b, pane[2], cut); }

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
