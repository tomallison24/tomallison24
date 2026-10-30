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

// ---- Layers' pebbles: every app's icon inside aOS and its own screens, in Layers ----
// The drawing from the app's icon.svg (its own colour, named in the icon's note: "own colour (#…) on a pale tint of it
// (#…)"), in white, without the tile and the Vintage marks, cropped to a square round it so every app's is the same size;
// and the pebble's gradient: the app's colour (aOS/app.js, ROOM_HUE) lighter at the top left, down to its own, dark
// enough for the white drawing. Written twice: aOS/glyphs.js (Layers' grid on aOS Home, aOS/home-tab.js) and
// <app>/icon-pebble.svg (every other place an app's icon shows in Layers: aOS/app.js, home-tab.js, home/welcome.js).
// The drawing is 40% of the pebble. Each keeps a hash of what it was made from, so --check needs no browser.
{
  const { createHash } = await import('crypto');
  const file = path.join(ROOT, 'aOS/glyphs.js');
  // the pebble: a soft superellipse with a little wobble, like sea glass, in a 512 box
  const PEBBLE = 'M' + Array.from({ length: 72 }, (_, i) => { const t = i / 72 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), r = 1 + .035 * Math.sin(2 * t + .7) + .02 * Math.sin(3 * t + 2.1);
    return [Math.round(256 + 240 * r * Math.sign(c) * Math.abs(c) ** (2 / 2.6)), Math.round(256 + 240 * r * Math.sign(s) * Math.abs(s) ** (2 / 2.6))].join(' '); }).join('L') + 'Z';
  const HUE = Function('return ' + /const ROOM_HUE = (\{[^}]*\})/.exec(readFileSync(path.join(ROOT, 'aOS/app.js'), 'utf8'))[1])();
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mixc = (a, b, k) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * k).toString(16).padStart(2, '0')).join('').toUpperCase();
  const lum = h => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  let was = {};
  try { was = JSON.parse(/window\.aosGlyphs = (\{[\s\S]*?\});\n/.exec(readFileSync(file, 'utf8'))[1]); } catch {}
  const out = {}, todo = [];
  for (const app of icons.filter(a => HUE[a])) {
    const raw = readFileSync(path.join(ROOT, app, 'icon.svg'), 'utf8'), m = /own colour \((#[0-9A-F]{6})\)[^#]*\((#[0-9A-F]{6})\)/i.exec(raw);
    if (!m) { stale.push(`${app}/icon.svg (its note doesn't name its own colour and tint)`); continue; }
    const [, deep, pale] = m, s = raw.replace(/<!--[\s\S]*?-->/g, '');
    const defs = (/<defs>([\s\S]*?)<\/defs>/.exec(s) || ['', ''])[1].trim();
    const body = s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<defs>[\s\S]*?<\/defs>/, '')
      .replace(`<rect width="512" height="512" fill="${pale}"/>`, '').replace(/<circle cx="424" cy="88" r="44"[^>]*\/>/, '')
      .replace(/<rect[^>]*rotate\(-18 90 444\)"\/>/, '').replace(/\s+/g, ' ').trim();
    const white = t => t.split(deep).join('#FFFFFF').split(deep.toLowerCase()).join('#FFFFFF')
      .replace(/id="([^"]+)"/g, `id="g-${app}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#g-${app}-$1)`);
    const mid = '#' + HUE[app].split(',').map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
    let top = mixc(mid, '#FFFFFF', .12);
    while ((1.05) / (lum(mixc(top, deep, .5)) + .05) < 3) top = mixc(top, deep, .2);   // the white drawing reads on the middle of it
    const h = createHash('sha1').update([defs, body, deep, top].join('|')).digest('hex').slice(0, 12);
    out[app] = { h, top, end: deep, defs: white(defs), body: white(body) };
    if (!was[app] || was[app].h !== h) todo.push(app);
  }
  const final = {};
  for (const app of Object.keys(out)) if (!todo.includes(app)) final[app] = was[app];
  if (todo.length && !check) {
    const { createRequire } = await import('module');
    const { execSync } = await import('child_process');
    const require = createRequire(execSync('npm root -g').toString().trim() + '/');
    const { chromium } = require('playwright');
    const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 512, height: 512 } });
    for (const app of todo) {
      const o = out[app];
      // the drawing's own box: drawn alone, and its pixels scanned
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><defs>${o.defs}</defs>${o.body}</svg>`;
      const [x0, y0, x1, y1] = await page.evaluate(async svg => {
        const img = new Image(); img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); await img.decode();
        const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, 512, 512).data; let a = 512, b = 512, e = 0, f = 0;
        for (let y = 0; y < 512; y++) for (let i = 0; i < 512; i++) if (d[(y * 512 + i) * 4 + 3] > 40) { if (i < a) a = i; if (i > e) e = i; if (y < b) b = y; if (y > f) f = y; }
        return [a, b, e + 1, f + 1];
      }, svg);
      const size = Math.max(x1 - x0, y1 - y0);
      final[app] = { h: o.h, top: o.top, end: o.end, vb: `${Math.round((x0 + x1 - size) / 2)} ${Math.round((y0 + y1 - size) / 2)} ${size} ${size}`, defs: o.defs, body: o.body };
    }
    await browser.close();
  }
  if (todo.length) stale.push('aOS/glyphs.js' + ` (${todo.join(', ')})`);
  if (!todo.length || !check) {
    const ordered = Object.fromEntries(Object.keys(out).map(a => [a, final[a]]));
    const text = `// Made by aOS/scripts/make-looks.mjs from each app's icon.svg - don't edit by hand.\n`
      + `// Layers' pebbles (aOS/home-tab.js, pebble): each app's drawing in white, cropped to a square round it (vb), and its\n`
      + `// pebble's gradient, top left to bottom right; aosPebble is the pebble's outline in a 512 box. h: a hash of what it was made from.\n`
      + `window.aosPebble = '${PEBBLE}';\n`
      + `window.aosGlyphs = ${JSON.stringify(ordered, null, 1)};\n`;
    if (!existsSync(file) || readFileSync(file, 'utf8') !== text) { if (!todo.length) stale.push('aOS/glyphs.js'); if (!check) writeFileSync(file, text); }
    // each app's pebble as an icon of its own: the pebble a little inside the box, with a soft shadow under it
    for (const [app, g] of Object.entries(ordered)) {
      const [vx, vy, vs] = g.vb.split(' ').map(Number), w = 512 * .92 * .4, at = 256 - w / 2;
      const peb = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">\n`
        + `  <!-- Made by aOS/scripts/make-looks.mjs from icon.svg - don't edit by hand. Layers' pebble: the app's colour, lighter at the top left, its drawing in white at 40% of it. ${g.h} -->\n`
        + `  <defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g.top}"/><stop offset="1" stop-color="${g.end}"/></linearGradient>`
        + `<radialGradient id="w" cx=".2" cy=".12" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
        + `<filter id="s" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#101828" flood-opacity=".22"/></filter></defs>\n`
        + `  <g transform="translate(256 256) scale(.92) translate(-256 -256)"><path d="${PEBBLE}" fill="url(#p)" filter="url(#s)"/><path d="${PEBBLE}" fill="url(#w)"/></g>\n`
        + `  <svg x="${at.toFixed(2)}" y="${at.toFixed(2)}" width="${w.toFixed(2)}" height="${w.toFixed(2)}" viewBox="${vx} ${vy} ${vs} ${vs}">${g.defs ? `<defs>${g.defs}</defs>` : ''}${g.body}</svg>\n</svg>\n`;
      const f = path.join(ROOT, app, 'icon-pebble.svg');
      if (!existsSync(f) || readFileSync(f, 'utf8') !== peb) { stale.push(`${app}/icon-pebble.svg`); if (!check) writeFileSync(f, peb); }
    }
  }
}

if (check) {
  if (stale.length) { console.log('Out of date (run node aOS/scripts/make-looks.mjs):\n  ' + stale.join('\n  ')); process.exit(1); }
  console.log('Looks up to date: ' + pages.length + ' pages, ' + icons.length + ' icons');
} else console.log(stale.length ? 'Wrote:\n  ' + stale.join('\n  ') : 'Nothing to do');
