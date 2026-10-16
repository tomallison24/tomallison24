// Draws Meals's Home Screen icons from their SVGs by rendering them in headless Chromium, so
// each SVG stays the single source of its picture:
//   icon.svg       -> icon-512.png, icon-180.png              Vintage (the default design): the
//                     mid-century icon
//   icon-glass.svg -> icon-glass-512.png, icon-glass-180.png  Standard: the Sea glass icon
// ../home/design.js puts the one for the design picked in Settings on the page (what iOS reads
// when the app is added to the Home Screen), as aOS's look.js does for aOS.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node meals/scripts/make-icons.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch();
for (const name of ['icon', 'icon-glass']) {
  const svg = readFileSync(path.join(DIR, name + '.svg'), 'utf8');
  for (const n of [512, 180]) {
    const page = await browser.newPage({ viewport: { width: n, height: n } });
    await page.setContent('<style>html,body{margin:0}svg{display:block;width:' + n + 'px;height:' + n + 'px}</style>' + svg);
    await page.screenshot({ path: path.join(DIR, name + '-' + n + '.png') });
    await page.close();
  }
}
await browser.close();
console.log('Wrote icon-512.png, icon-180.png, icon-glass-512.png and icon-glass-180.png');
