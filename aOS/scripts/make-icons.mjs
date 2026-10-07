// Draws aOS/icon-512.png and aOS/icon-180.png: "aOS" in white with a
// superscript 1, on the AllisonOS pastels (sea glass, mist, shell, sand), with a
// soft glossy light from the top. Full-bleed: the phone rounds the corners.
// The picture is HTML, photographed by headless Chromium.
//
//   CHROMIUM=/path/to/chrome node aOS/scripts/make-icons.mjs
// (needs playwright-core where node can find it)
import { chromium } from 'playwright-core';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = `<!doctype html><html><body style="margin:0">
<div style="width:1024px;height:1024px;position:relative;overflow:hidden;
  background:linear-gradient(135deg,#78AE9F 0%,#8C9DC6 36%,#C4958F 68%,#C9A671 100%);
  font-family:-apple-system,'SF Pro Display','Helvetica Neue',Arial,sans-serif">
  <div style="position:absolute;inset:0;background:radial-gradient(120% 70% at 30% -10%,rgba(255,255,255,.55),rgba(255,255,255,0) 60%)"></div>
  <div style="position:absolute;inset:0;background:radial-gradient(90% 60% at 90% 110%,rgba(169,211,199,.5),rgba(169,211,199,0) 60%)"></div>
  <div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-54%);text-align:center;color:#fff;font-weight:800;font-size:330px;letter-spacing:-12px;
    text-shadow:0 18px 48px rgba(30,45,60,.26)">aOS<sup style="font-size:150px;letter-spacing:0;position:relative;top:-24px;margin-left:6px">1</sup></div>
</div></body></html>`;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
await p.setContent(html);
for (const [n, s] of [[512, 0.5], [180, 180 / 1024]]) {
  const q = await b.newPage({ viewport: { width: n, height: n }, deviceScaleFactor: 1 });
  await q.setContent(`<body style="margin:0"><div style="width:1024px;height:1024px;transform:scale(${s});transform-origin:0 0">${html.replace(/^.*<body style="margin:0">/s, '').replace(/<\/body>.*$/s, '')}</div></body>`);
  await q.screenshot({ path: join(OUT, `icon-${n}.png`), clip: { x: 0, y: 0, width: n, height: n } });
}
await b.close();
console.log('aos icons written');
