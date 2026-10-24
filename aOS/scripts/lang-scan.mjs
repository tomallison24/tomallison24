// Lists the English still on each page in Russian (../../home/lang.js): every text node and placeholder,
// aria-label, title or alt with Latin letters in it, shown or not (a sheet that isn't open is still in the
// page), outside translate="no" (what the family wrote, outside content). For whoever writes the word
// files (home/lang/ru/*.js), and lang-test.mjs uses it.
//
//   node aOS/scripts/lang-scan.mjs [app ...]          every app, or the ones named (aos for aOS)
//   node aOS/scripts/lang-scan.mjs --json [app ...]   the same as JSON: { app: [text, ...] }
//
// Names that stay as they are (aOS, Ipsy, Google, iPhone...) are not listed: KEEP below.
// Needs Playwright with Chromium (npm i -g playwright).
import { createRequire } from 'module'; import { execSync } from 'child_process'; import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/'); const { chromium } = require('playwright');
const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.css': 'text/css' };
const ALL = ['aos', 'calendar', 'clock', 'drinks', 'fitness', 'house', 'mail', 'meals', 'news', 'notes', 'orders', 'places', 'podcasts', 'travel', 'weather'];
// stays in Latin letters in Russian too: names of things and services, units
export const KEEP = /^(aOS|Allison|AllisonOS|Google|Gmail|iCloud|iPhone|iPad|iOS|Android|Safari|Chrome|Face ID|Touch ID|Home Assistant|Wi-?Fi|Sonos|Apple|Amazon|Walmart|Target|Costco|Kroger|Uber|Lyft|NWS|NOAA|Open-Meteo|OpenStreetMap|Leaflet|CARTO|RSS|PDF|CSV|URL|USB|AM|PM|kW|kWh|mph|km\/h|km|mi|ft|in|mm|cm|kg|lb|lbs|oz|ml|°F|°C|ID|OK|GPS|AI|Signal|Futura|English|Pro\+?|Plus|Siri|AirPlay|Bluetooth|HomeKit|Zigbee|Matter|Spotify|YouTube|Apple Podcasts|Fitbit|Strava|Gemini|Claude)$/;
const json = process.argv.includes('--json');
const want = process.argv.slice(2).filter(a => !a.startsWith('--'));
const apps = want.length ? want : ALL;

export async function scan(appsList, { root = ROOT, onPage } = {}) {
  const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(root, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
  await new Promise(r => server.listen(0, r)); const BASE = 'http://localhost:' + server.address().port;
  const b = await chromium.launch();
  const out = {};
  for (const id of appsList) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.route('**/*', r => { const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort(); if (u.pathname.includes('/api/')) return r.fulfill({ status: 401, contentType: 'application/json', body: '{}' }); r.continue(); });
    await ctx.addInitScript(id => { try { localStorage.setItem('aos.lang', 'ru'); localStorage.setItem('aos.seen', JSON.stringify({ [id]: '999' })); localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.sky', 'day'); sessionStorage.setItem('aos.later.' + id, '1'); } catch {} }, id);
    const p = await ctx.newPage();
    await p.goto(BASE + '/' + (id === 'aos' ? 'aOS' : id) + '/'); await p.waitForTimeout(1200);
    if (onPage) await onPage(id, p);
    out[id] = await p.evaluate(KEEP_SRC => {
      const KEEP = new RegExp(KEEP_SRC);
      const kept = el => !!el.closest('[translate="no"],[contenteditable="true"],[contenteditable=""],script,style,textarea,noscript,code,pre');
      // English: Latin letters left once the names that stay in Latin (KEEP) are taken out («Сила aOS» is Russian);
      // any text with Cyrillic in it is Russian (a device's name from Home Assistant can sit in it)
      const NAMES = new RegExp('(^|[^A-Za-z])(?:' + KEEP_SRC.slice(2, -2) + ')(?![A-Za-z])', 'g');
      const english = s => { s = s.replace(/\s+/g, ' ').trim(); if (!/[A-Za-z]{2}/.test(s) || KEEP.test(s) || /[\u0400-\u04FF]/.test(s) || !/[A-Za-z]{2}/.test(s.replace(NAMES, '$1'))) return null; return s; };
      const found = new Set();
      const w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.parentElement || kept(n.parentElement)) continue; const s = english(n.data); if (s) found.add(s); }
      for (const el of document.querySelectorAll('[placeholder],[aria-label],[title],[alt]')) { if (kept(el)) continue; for (const a of ['placeholder', 'aria-label', 'title', 'alt']) { const v = el.getAttribute(a); const s = v && english(v); if (s) found.add(s); } }
      const title = english(document.title || ''); if (title) found.add(title);
      return [...found];
    }, KEEP.source);
    await ctx.close();
  }
  await b.close(); server.close();
  return out;
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const out = await scan(apps);
  if (json) console.log(JSON.stringify(out, null, 1));
  else for (const id of apps) console.log(`== ${id}: ${out[id].length} still in English\n` + out[id].map(s => '  ' + s).join('\n'));
}
