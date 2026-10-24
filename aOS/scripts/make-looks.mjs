// Writes the Night Drive and Folk looks of every page and icon from its Vintage one (aOS/scripts/looks.mjs
// says how a colour moves). Run it after changing a page's <style id="vintage"> block or an icon.svg:
//
//   node aOS/scripts/make-looks.mjs            the <style id="neon"> and <style id="folk"> blocks, right
//                                               after each page's Vintage block; icon-neon.svg and
//                                               icon-folk.svg beside each icon.svg, and their 180 and 512
//                                               pngs (needs Playwright with Chromium: npm i -g playwright)
//   node aOS/scripts/make-looks.mjs --check     only says what is out of date (check-apps.mjs runs it), exit 1 if any
//
// The blocks are generated: don't edit them by hand, change the Vintage block (or looks.mjs) and run this.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { lookBlock, signature, mapColor, LOOKS } from './looks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NEW = ['neon', 'folk'];
const check = process.argv.includes('--check');
const pages = readdirSync(ROOT, { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(path.join(ROOT, d.name, 'index.html')))
  .map(d => d.name).filter(d => /^<style id="vintage">/m.test(readFileSync(path.join(ROOT, d, 'index.html'), 'utf8')));
const stale = [];

// ---- the page blocks ----
const VSTART = /^<style id="vintage">\n/m;
for (const app of pages) {
  const file = path.join(ROOT, app, 'index.html');
  const html = readFileSync(file, 'utf8');
  const s = html.search(VSTART), e = html.indexOf('</style>', s) + '</style>'.length;
  const vintage = html.slice(s, e).replace(VSTART, '').replace(/<\/style>$/, '');
  let rest = html.slice(e);
  for (const look of NEW) rest = rest.replace(new RegExp(`^\\n?<style id="${look}"[^>]*>[\\s\\S]*?</style>`), '');   // the old ones, regenerated
  const blocks = NEW.map(look => `\n<style id="${look}" media="not all">\n/* ${LOOKS[look].name}: generated from the Vintage block above by aOS/scripts/make-looks.mjs - don't edit by hand */\n${lookBlock(look, vintage)}${signature(look)}</style>`).join('');
  const out = html.slice(0, e) + blocks + rest;
  if (out !== html) { stale.push(`${app}/index.html`); if (!check) writeFileSync(file, out); }
}

// ---- the icons ----
// Night Drive: a deep neon-tinted ground in the app's own hue, a striped sunset for the disc, a magenta tube.
// Folk: the Gzhel palette, and the disc becomes a six-petalled flower. Masks (black and white) are left as they are.
const SIZE = /viewBox="0 0 (\d+) (\d+)"/;
function iconFor(look, svg) {
  const masks = [];
  svg = svg.replace(/<mask[\s\S]*?<\/mask>/g, m => { masks.push(m); return `\u0000${masks.length - 1}\u0000`; });
  svg = svg.replace(/<!--[\s\S]*?-->/, `<!-- ${LOOKS[look].name}: generated from icon.svg by aOS/scripts/make-looks.mjs - don't edit by hand -->`);
  const full = (SIZE.exec(svg) || [, '512'])[1];
  const bgRe = new RegExp(`<rect width="${full}" height="${full}" fill="(#[0-9A-Fa-f]{3,6})"`);
  const bg = (bgRe.exec(svg) || [])[1];
  let defs = '';
  svg = svg.replace(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="(#[0-9A-Fa-f]{6})"\/>/g, (m, cx, cy, r, fill) => {
    if (+r < 90) return m;   // the big disc only
    [cx, cy, r] = [+cx, +cy, +r];
    if (look === 'neon') {
      defs += `<linearGradient id="nds" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC75A"/><stop offset=".45" stop-color="#FF8A4C"/><stop offset=".85" stop-color="#FF3D9A"/></linearGradient><clipPath id="ndc"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`;
      const bars = [0.12, 0.3, 0.46, 0.6, 0.72, 0.84].map((y, i) => `<rect x="${cx - r}" y="${(cy + r * y).toFixed(1)}" width="${2 * r}" height="${(r * (0.04 + i * 0.012)).toFixed(1)}" fill="@BG@"/>`).join('');
      return `<g clip-path="url(#ndc)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#nds)"/>${bars}</g>`;
    }
    const petal = a => `<ellipse cx="${cx}" cy="${(cy - r * 0.52).toFixed(1)}" rx="${(r * 0.25).toFixed(1)}" ry="${(r * 0.44).toFixed(1)}" transform="rotate(${a} ${cx} ${cy})" fill="${mapColor('folk', fill, false)}"/>`;
    return `<g>${[0, 60, 120, 180, 240, 300].map(petal).join('')}<circle cx="${cx}" cy="${cy}" r="${(r * 0.24).toFixed(1)}" fill="#C7261C"/><circle cx="${cx}" cy="${cy}" r="${(r * 0.1).toFixed(1)}" fill="#F5F7FB"/></g>`;
  });
  // every other colour (the masks are out of the way)
  svg = svg.replace(/(fill|stroke|stop-color)="(#[0-9A-Fa-f]{3,8})"/g, (m, k, c) => {
    if (look === 'neon' && c === bg) return m;
    return `${k}="${mapColor(look, c, false)}"`;
  });
  if (look === 'neon' && bg) {   // the ground: the app's hue, deep, under the sunset
    const deep = deepen(mapColor('neon', bg, true));
    svg = svg.split(`fill="${bg}"`).join(`fill="${deep}"`).split('@BG@').join(deep);
    svg = svg.replace(/(<rect[^>]*rx="(\d+)"[^>]*fill=")(#[0-9A-F]{6})("[^>]*transform="rotate[^"]*")/, (m, a, rx, c, b) => `${a}#FF3D9A${b}`);
  }
  svg = svg.split('@BG@').join('#120B1F');
  if (defs) svg = /<defs>/.test(svg) ? svg.replace('<defs>', '<defs>' + defs) : svg.replace(/(<svg[^>]*>)/, `$1<defs>${defs}</defs>`);
  return svg.replace(/\u0000(\d+)\u0000/g, (_, i) => masks[+i]);
}
// a colour taken down to a deep ground, keeping its hue (for Night Drive's icon grounds)
function deepen(hex) {
  const n = parseInt(hex.slice(1), 16), rgb = [n >> 16, (n >> 8) & 255, n & 255];
  const k = 0.32 / Math.max(0.32, (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255);
  return '#' + rgb.map(v => Math.round(v * k * 0.55).toString(16).padStart(2, '0')).join('').toUpperCase();
}

const icons = pages.filter(app => existsSync(path.join(ROOT, app, 'icon.svg')));
const pngs = [];
for (const app of icons) {
  const src = readFileSync(path.join(ROOT, app, 'icon.svg'), 'utf8');
  for (const look of NEW) {
    const f = path.join(ROOT, app, `icon-${look}.svg`), out = iconFor(look, src);
    const was = existsSync(f) ? readFileSync(f, 'utf8') : null;
    const noPng = !existsSync(path.join(ROOT, app, `icon-${look}-512.png`)) || !existsSync(path.join(ROOT, app, `icon-${look}-180.png`));
    if (was !== out || noPng) { stale.push(`${app}/icon-${look}.svg`); if (!check) { writeFileSync(f, out); pngs.push([app, look, out]); } }
  }
}
if (!check && pngs.length) {
  const { createRequire } = await import('module');
  const { execSync } = await import('child_process');
  const require = createRequire(execSync('npm root -g').toString().trim() + '/');
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  for (const [app, look, svg] of pngs) for (const px of [512, 180]) {
    const page = await browser.newPage({ viewport: { width: px, height: px } });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${px}px;height:${px}px}</style>` + svg);
    await page.screenshot({ path: path.join(ROOT, app, `icon-${look}-${px}.png`) });
    await page.close();
  }
  await browser.close();
}

if (check) {
  if (stale.length) { console.log('Out of date (run node aOS/scripts/make-looks.mjs):\n  ' + stale.join('\n  ')); process.exit(1); }
  console.log('Looks up to date: ' + pages.length + ' pages, ' + icons.length + ' icons');
} else console.log(stale.length ? 'Wrote:\n  ' + stale.join('\n  ') : 'Nothing to do');
