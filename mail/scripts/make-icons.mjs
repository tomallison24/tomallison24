// Draws mail/icon-512.png and mail/icon-180.png in the style of Apple's own
// icons: a full-bleed gradient and a simple white glyph, with iOS rounding the
// corners itself. The envelope sits on an orange tag - the app files mail by
// tagging it - so it reads as its own app beside the built-in Mail. Rendered at
// 1024 and boxed down, so edges stay smooth without any image library.
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
// Signed distance to a convex or concave polygon (negative inside).
function polygon(x, y, pts) {
  let d = Infinity, inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j], [bx, by] = pts[i];
    d = Math.min(d, segment(x, y, ax, ay, bx, by));
    if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside ? -d : d;
}

// The tag: a luggage-tag pentagon with a punched hole, tilted, peeking out
// from behind the envelope's top right corner.
const TAG = { cx: 690, cy: 330, angle: 2.52, w: 190, h: 118, r: 22 };   // pointed end and hole up and out
function tagShape(x, y) {
  const c = Math.cos(-TAG.angle), sn = Math.sin(-TAG.angle);
  const dx = x - TAG.cx, dy = y - TAG.cy;
  const u = dx * c - dy * sn, v = dx * sn + dy * c;          // into the tag's own frame
  const { w, h } = TAG;
  const body = polygon(u, v, [[-w, 0], [-w + h, -h], [w, -h], [w, h], [-w + h, h]]) - TAG.r;
  const hole = Math.hypot(u + w - h * 0.95, v) - 24;
  return Math.max(body, -hole);
}

function pixel(x, y) {
  const v = y / N;
  // Apple-blue gradient, lighter at the top, as on the system apps.
  let r = mix(66, 10, v), g = mix(196, 104, v), b = mix(255, 242, v);

  // Envelope geometry.
  const cx = N / 2, cy = N / 2 + 40, hw = 300, hh = 206, rad = 44;
  const env = roundedRect(x, y, cx, cy, hw, hh, rad);

  // Soft shadow under everything, falling on the gradient.
  const shadowEnv = roundedRect(x, y - 22, cx, cy, hw, hh, rad);
  const sh = Math.exp(-Math.max(0, shadowEnv) / 38) * 0.22;
  r = mix(r, 0, sh); g = mix(g, 30, sh); b = mix(b, 90, sh);

  // Tag, behind the envelope.
  const tag = aa(tagShape(x, y), 1.8);
  if (tag > 0) {
    const t = clamp01((y - 150) / 380);
    r = mix(r, mix(255, 255, t), tag); g = mix(g, mix(176, 140, t), tag); b = mix(b, mix(56, 20, t), tag);
  }

  // Envelope: white with a whisper of cool grey toward the bottom.
  const ink = aa(env, 1.8);
  if (ink > 0) {
    const t = clamp01((y - (cy - hh)) / (2 * hh));
    r = mix(r, mix(255, 236, t), ink); g = mix(g, mix(255, 242, t), ink); b = mix(b, mix(255, 250, t), ink);
  }

  // Flap: a soft blue-grey crease, not a cut.
  const apex = cy + 26, top = cy - hh + 34, inset = 40;
  const flap = Math.min(
    segment(x, y, cx - hw + inset, top, cx, apex),
    segment(x, y, cx + hw - inset, top, cx, apex),
  ) - 11;
  const crease = Math.min(aa(flap, 1.8), ink);
  if (crease > 0) { r = mix(r, 168, crease); g = mix(g, 196, crease); b = mix(b, 236, crease); }

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
