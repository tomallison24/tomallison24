// Draws places/icon-512.png and places/icon-180.png from places/icon.svg (a white map pin on
// sage, one of the Sea glass tints), by rendering the SVG in headless
// Chromium, so icon.svg stays the single source of the picture.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node places/scripts/make-icons.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(path.join(DIR, 'icon.svg'), 'utf8');
const browser = await chromium.launch();
for (const n of [512, 180]) {
  const page = await browser.newPage({ viewport: { width: n, height: n } });
  await page.setContent('<style>html,body{margin:0}svg{display:block;width:' + n + 'px;height:' + n + 'px}</style>' + svg);
  await page.screenshot({ path: path.join(DIR, 'icon-' + n + '.png') });
  await page.close();
}
await browser.close();
console.log('Wrote icon-512.png and icon-180.png');
