// Writes the Layers and Tron looks of every page and icon from its Vintage one (aOS/scripts/looks.mjs
// says how a colour moves). Run it after changing a page's <style id="vintage"> block or an icon.svg:
//
//   node aOS/scripts/make-looks.mjs            the <style id="layers"> and <style id="grid">
//                                               blocks, right after each page's Vintage block; icon-layers.svg
//                                               and icon-grid.svg beside each icon.svg, and their 180 and 512
//                                               pngs (needs Playwright with Chromium: npm i -g playwright)
//   node aOS/scripts/make-looks.mjs --check     only says what is out of date (check-apps.mjs runs it), exit 1 if any
//
// The blocks are generated: don't edit them by hand, change the Vintage block (or looks.mjs) and run this.
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { lookBlock, signature, mapColor, LOOKS } from './looks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NEW = ['layers', 'grid'];
const GONE = ['neon'];   // Night Drive, which Layers replaced: its old blocks and icons are taken out
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
  const OLD = new RegExp(`^\\n?<style id="(?:${[...NEW, ...GONE].join('|')})"[^>]*>[\\s\\S]*?</style>`);
  while (OLD.test(rest)) rest = rest.replace(OLD, '');   // the old ones, every copy, regenerated
  const blocks = NEW.map(look => `\n<style id="${look}" media="not all">\n/* ${LOOKS[look].name}: generated from the Vintage block above by aOS/scripts/make-looks.mjs - don't edit by hand */\n${lookBlock(look, vintage)}${signature(look)}</style>`).join('');
  const out = html.slice(0, e) + blocks + rest;
  if (out !== html) { stale.push(`${app}/index.html`); if (!check) writeFileSync(file, out); }
}

// ---- the shared Settings (the CSS in home/settings.js): its Vintage block, made again for Layers and Tron at its end ----
{
  const file = path.join(ROOT, 'home/settings.js');
  const css = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const v = /\/\* vintage: start \*\/\n([\s\S]*?)\/\* vintage: end \*\//.exec(css), G = /(\/\* generated: start \*\/\n)[\s\S]*?(\/\* generated: end \*\/)/;
  if (v && G.test(css)) {
    const gen = NEW.map(look => lookBlock(look, v[1]).replace(/data-look="vintage"/g, `data-look="${look}"`)).join('');
    const out = css.replace(G, (m, a, b) => a + gen + b);
    if (out !== css) { stale.push('home/settings.js'); if (!check) writeFileSync(file, out); }
  }
}

// ---- the icons ----
// Layers: an app's tinted tile (a pale ground with its drawing in the app's own colour, Vintage's small sun and pill as its
// mark) keeps its colours, as every app does in every look (aOS/app.js, ROOM_HUE): its ground lit from the top left, the
// mark gone. aOS's own icon: its ground in sea glass tones, lit from the top left; the disc a soft glow of light, the pill
// gone, the drawing white.
// Tron (Trail frame): a near-black ground with a hint of the app's own hue, the drawing in the night palette's light, and
// the screen's red light trail around the icon's edge, its light at the top right; the disc and the pill go, so it's calm.
// The trail runs just inside the corners the phone rounds off.
// Masks (black and white) are left as they are.
const SIZE = /viewBox="0 0 (\d+) (\d+)"/;
// Tron's trail on a 512 icon: 26 in from each edge, its corners rounded at 94
const TRAIL = 'M120 26H392A94 94 0 0 1 486 120V392A94 94 0 0 1 392 486H120A94 94 0 0 1 26 392V120A94 94 0 0 1 120 26Z';
function iconFor(look, svg) {
  const masks = [];
  svg = svg.replace(/<mask[\s\S]*?<\/mask>/g, m => { masks.push(m); return `\u0000${masks.length - 1}\u0000`; });
  svg = svg.replace(/<!--[\s\S]*?-->/, `<!-- ${LOOKS[look].name}: generated from icon.svg by aOS/scripts/make-looks.mjs - don't edit by hand -->`);
  const full = (SIZE.exec(svg) || [, '512'])[1];
  const bgRe = new RegExp(`<rect width="${full}" height="${full}" fill="(#[0-9A-Fa-f]{3,6})"`);
  const bg = (bgRe.exec(svg) || [])[1];
  let defs = '';
  const MARK = /[ \t]*<circle cx="424" cy="88" r="44" fill="#[0-9A-Fa-f]{6}"\/>\n?/, PILL = /[ \t]*<rect[^>]*rx="\d+"[^>]*transform="rotate[^"]*"\/>\n?/;
  if (look === 'layers' && bg && MARK.test(svg)) {   // a tinted tile
    svg = svg.replace(MARK, '').replace(PILL, '').replace(bgRe, m => m.replace(`fill="${bg}"`, 'fill="url(#lyg)"'));
    defs = `<linearGradient id="lyg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(bg, '#FFFFFF', 0.6)}"/><stop offset="1" stop-color="${bg}"/></linearGradient>`;
    svg = /<defs>/.test(svg) ? svg.replace('<defs>', '<defs>' + defs) : svg.replace(/(<svg[^>]*>)/, `$1<defs>${defs}</defs>`);
    return svg.replace(/\u0000(\d+)\u0000/g, (_, i) => masks[+i]);
  }
  if (look === 'grid' && bg && MARK.test(svg)) {   // Tron, from a tinted tile: no sun, and the drawing light as it always is in Tron
    svg = svg.replace(MARK, '').replace(/(fill|stroke)="(#[0-9A-Fa-f]{6})"/g, (m, k, c) => c === bg ? m : `${k}="#FBF5E9"`);
  }
  svg = svg.replace(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="(#[0-9A-Fa-f]{6})"\/>/g, (m, cx, cy, r, fill) => {
    if (+r < 90) return m;   // the big disc only
    [cx, cy, r] = [+cx, +cy, +r];
    if (look === 'grid') return '';
    if (look === 'layers') return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF" fill-opacity=".24"/>`;
    return m;
  });
  if (look === 'layers' && bg) {   // the ground: a gradient of the app's own colour, lighter at the top left; no pill
    const g = mapColor('layers', bg, false);
    defs += `<linearGradient id="lyg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(g, '#FFFFFF', 0.3)}"/><stop offset="1" stop-color="${g}"/></linearGradient>`;
    svg = svg.replace(bgRe, m => m.replace(`fill="${bg}"`, 'fill="url(#lyg)"'));
    svg = svg.replace(/[ \t]*<rect[^>]*rx="\d+"[^>]*transform="rotate[^"]*"\/>\n?/, '');
  }
  // every other colour (the masks are out of the way)
  svg = svg.replace(/(fill|stroke|stop-color)="(#[0-9A-Fa-f]{3,8})"/g, (m, k, c) => {
    if (look === 'grid' && c === bg) return m;
    return `${k}="${mapColor(look, c, look === 'grid')}"`;
  });
  if (look === 'grid' && bg) {   // the ground: all but black, a hint of the app's hue; no pill; the light trail round the edge
    const deep = deepen(mapColor('neon', bg, true), 0.2);
    svg = svg.split(`fill="${bg}"`).join(`fill="${deep}"`);
    svg = svg.replace(/[ \t]*<rect[^>]*rx="\d+"[^>]*transform="rotate[^"]*"\/>\n?/, '');
    svg = svg.replace(/\n[ \t]*(?=\n)/g, '');   // the lines the disc and the pill left
    const k = +full / 512, len = 4 * 272 + 2 * Math.PI * 94;
    defs += `<filter id="trg" filterUnits="userSpaceOnUse" x="-40" y="-40" width="592" height="592"><feGaussianBlur in="SourceGraphic" stdDeviation="6" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    svg = svg.replace(/<\/svg>\s*$/, `  <g transform="scale(${k})" fill="none" filter="url(#trg)"><path d="${TRAIL}" stroke="#FF2A2A" stroke-width="8"/><path d="${TRAIL}" stroke="#FFE3E0" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(len * 0.1).toFixed(0)} ${len.toFixed(0)}" stroke-dashoffset="${(-len * 0.15).toFixed(0)}"/></g>\n</svg>\n`);
  }
  svg = svg.split('@BG@').join('#120B1F');
  svg = svg.split('@CY@').join('#FF2A2A');
  if (defs) svg = /<defs>/.test(svg) ? svg.replace('<defs>', '<defs>' + defs) : svg.replace(/(<svg[^>]*>)/, `$1<defs>${defs}</defs>`);
  return svg.replace(/\u0000(\d+)\u0000/g, (_, i) => masks[+i]);
}
// a colour taken down to a deep ground, keeping its hue (for Tron's icon grounds)
function deepen(hex, f = 0.55) {
  const n = parseInt(hex.slice(1), 16), rgb = [n >> 16, (n >> 8) & 255, n & 255];
  const k = 0.32 / Math.max(0.32, (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255);
  return '#' + rgb.map(v => Math.round(v * k * f).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// two colours mixed (k of the second), for Layers' lit ground
function mix(a, b, k) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('').toUpperCase();
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
for (const app of icons) for (const look of GONE) for (const f of [`icon-${look}.svg`, `icon-${look}-180.png`, `icon-${look}-512.png`]) {
  const file = path.join(ROOT, app, f);
  if (existsSync(file)) { stale.push(`${app}/${f} (gone)`); if (!check) unlinkSync(file); }
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
