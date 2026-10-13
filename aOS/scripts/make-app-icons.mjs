// Draws aOS/icons/<app>-512.png from aOS/icons/<app>.svg: the mid-century (Retro) icons aOS shows for the
// apps that have no Vintage design of their own (Notes, Podcasts, Places, Meals), by rendering each SVG in
// headless Chromium so the SVG stays the single source. The apps' own icons are not touched.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node aOS/scripts/make-app-icons.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const browser = await chromium.launch();
for (const f of readdirSync(DIR).filter(f => f.endsWith('.svg'))) {
  const svg = readFileSync(path.join(DIR, f), 'utf8');
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.setContent('<style>html,body{margin:0}svg{display:block;width:512px;height:512px}</style>' + svg);
  await page.screenshot({ path: path.join(DIR, f.replace(/\.svg$/, '-512.png')) });
  await page.close();
  console.log('Wrote', f.replace(/\.svg$/, '-512.png'));
}
await browser.close();
