// Settings' dropdowns (home/settings.js, DESIGN.md rule 4): every labelled section put into the sheet named Settings
// is folded as it arrives:
//   - a <details> row with the section's name and a chevron, closed until tapped; its id and data-* kept, its rows
//     the same elements (a listener on one still works);
//   - how it stands on its row (S.section's value), and Design's row says the look, following a change;
//   - open at first only when the app asks (open: true); one tapped open stays open when the sheet is drawn again;
//   - S.reveal(id) opens the one a row is in;
//   - sections in another sheet (an order, a booking) stay as they are;
//   - under a browser test they start open (so the apps' tests reach their rows), unless aos.settings.folds is
//     'closed', as the design check sets it.
//   node home/scripts/settings-folds-test.mjs [repo root]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const PAGE = `<!doctype html><meta charset="utf-8"><title>Settings</title><body>
<script>window.aosDesign = { looks: [{ id: 'vintage', name: 'Vintage' }, { id: 'glass', name: 'Standard' }, { id: 'grid', name: 'Tron Special Edition' }], look: 'vintage', get() { return this.look; } };</script>
<script src="/home/settings.js"></script>
<div role="dialog" aria-labelledby="stT"><h2 id="stT">Settings</h2><div id="body"></div></div>
<div role="dialog" aria-labelledby="bkT"><h2 id="bkT">Booking</h2><div id="other"></div></div>
<script>
  const S = AllisonOS.settings;
  window.draw = () => {
    document.getElementById('body').innerHTML = S.section('Design', S.raw('<div class="aos-design" role="radiogroup" aria-label="Design"></div>'))
      + S.section('Trips', S.toggle({ id: 'tAuto', title: 'Find trips by themselves', on: true }), { id: 'tripsSec', value: '3 trips' })
      + S.section('Connected accounts', S.action({ id: 'gIn', icon: 'mail', title: 'Connect Gmail' }), { open: true })
      + S.section('Your data', S.action({ id: 'exportBtn', icon: 'upload', title: 'Back up everything' }))
      + S.section('', S.info({ id: 'note', title: 'A row with no section name' }));
  };
  draw();
  document.getElementById('other').innerHTML = S.section('Dates', S.info({ id: 'when', title: 'Fri 6 Nov' }));
  window.tapped = 0; document.getElementById('exportBtn').addEventListener('click', () => tapped++);
</script>`;
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/settings.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': 'text/javascript' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;
const browser = await chromium.launch();
let failed = 0;
const check = (name, problems) => { if (problems.length) { failed++; console.log('not ok - ' + name + '\n  ' + problems.join('\n  ')); } else console.log('ok - ' + name); };

async function open(closed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (closed) await ctx.addInitScript(() => localStorage.setItem('aos.settings.folds', 'closed'));
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/settings.html');
  return { ctx, page, errors };
}
const state = page => page.evaluate(() => ({
  settings: [...document.querySelectorAll('#body > .st-sec')].map(x => ({ tag: x.tagName, label: (x.querySelector(':scope > .st-lbl') || {}).textContent || '', open: x.open, id: x.id, value: (x.querySelector(':scope > summary') || { dataset: {} }).dataset.value || '' })),
  other: [...document.querySelectorAll('#other > .st-sec')].map(x => x.tagName),
}));

{
  const { ctx, page, errors } = await open(true);
  let s = await state(page);
  const p = [];
  const by = l => s.settings.find(x => x.label === l) || {};
  if (s.settings.filter(x => x.label).some(x => x.tag !== 'DETAILS')) p.push('a named section isn\'t a dropdown: ' + JSON.stringify(s.settings));
  if (by('').tag !== 'SECTION') p.push('a section with no name is folded');
  if (by('Design').open || by('Trips').open || by('Your data').open) p.push('a dropdown is open at first: ' + JSON.stringify(s.settings));
  if (!by('Connected accounts').open) p.push('open: true doesn\'t open it at first');
  if (by('Design').value !== 'Vintage') p.push('Design\'s row doesn\'t say the look: ' + by('Design').value);
  if (by('Trips').value !== '3 trips' || by('Trips').id !== 'tripsSec') p.push('value or id not kept: ' + JSON.stringify(by('Trips')));
  if (JSON.stringify(s.other) !== '["SECTION"]') p.push('a section in another sheet was folded: ' + s.other);
  if (!(await page.isHidden('#exportBtn'))) p.push('a row in a closed dropdown is on screen');
  check('Settings opens as a list of closed dropdowns: Design says the look, a section says how it stands, other sheets untouched', p);

  const q = [];
  await page.click('summary:has-text("Your data")');
  if (!(await page.isVisible('#exportBtn'))) q.push('tapping the row doesn\'t open it');
  await page.click('#exportBtn');
  if (await page.evaluate(() => tapped) !== 1) q.push('a listener on a row inside no longer works');
  await page.evaluate(() => draw());
  s = await state(page);
  if (!by('Your data').open) q.push('drawn again, the one tapped open closed');
  if (by('Trips').open) q.push('drawn again, another opened');
  check('tapped open: its rows work, and it stays open when the sheet is drawn again', q);

  const r = [];
  await page.evaluate(() => { aosDesign.look = 'grid'; dispatchEvent(new CustomEvent('aos:design', { detail: 'grid' })); });
  s = await state(page);
  if (by('Design').value !== 'Tron') r.push('Design\'s row doesn\'t follow the look: ' + by('Design').value);
  await page.evaluate(() => AllisonOS.settings.reveal('tAuto'));
  await page.click('summary:has-text("Your data")');   // closed again, for the reveal below
  if (!(await page.isVisible('#tAuto'))) r.push('S.reveal doesn\'t open the dropdown its row is in');
  // called as the sheet is drawn, before the folding (as an app does right after drawing Settings)
  await page.evaluate(() => { draw(); AllisonOS.settings.reveal('exportBtn'); });
  await page.waitForTimeout(50);
  if (!(await page.isVisible('#exportBtn'))) r.push('S.reveal right after drawing doesn\'t open its dropdown');
  check('Design\'s row follows a new look, and S.reveal opens the dropdown a row is in, even right after drawing', r);
  if (errors.length) check('no script errors', errors);
  await ctx.close();
}
{
  const { ctx, page } = await open(false);
  const s = await state(page);
  check('under a browser test, without aos.settings.folds = closed, the dropdowns start open (the apps\' tests reach their rows)',
    s.settings.filter(x => x.label).every(x => x.tag === 'DETAILS' && x.open) ? [] : [JSON.stringify(s.settings)]);
  await ctx.close();
}
await browser.close(); server.close();
if (failed) process.exit(1);
console.log('all passed');
