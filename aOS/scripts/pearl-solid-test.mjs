// Pearl's bars and floating buttons along the bottom are solid, in every app (aOS/scripts/looks.mjs, --pl-frost and
// --pl-fab, written into each app's <style id="layers"> by make-looks): see-through, what scrolled behind them showed
// through and ran into them (the owner saw it in every app). Plain Node: reads each page's Pearl block.
//   node aOS/scripts/pearl-solid-test.mjs [repo root]
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
// a colour with no see-through in it: #rgb/#rrggbb, a var() (checked where it's set), rgb() or rgba(…, 1)
const solid = v => /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v) || /^var\(--[a-z-]+\)$/.test(v) || /^rgb\(/.test(v) || /^rgba\([^)]*,\s*1(\.0+)?\)$/.test(v);
let pages = 0;
for (const dir of fs.readdirSync(ROOT)) {
  const f = path.join(ROOT, dir, 'index.html');
  if (!fs.existsSync(f)) continue;
  const html = fs.readFileSync(f, 'utf8');
  const m = /<style id="layers"[^>]*>([\s\S]*?)<\/style>/.exec(html);
  if (!m) continue;
  pages++;
  // the menus that float over the page (a topic or view picker, a pill's menu, the tags) sit on the solid surface
  // (only where the rulebook clears the card colours: Clock and the games keep their own grounds)
  const surf = /:is\(([^)]*)\)\{background:var\(--pl-surface\) !important\}/.exec(m[1]);
  if (/--mc-card:transparent/.test(m[1])) assert.ok(surf, dir + ': no solid surface rule in Pearl');
  if (surf) for (const menu of ['.viewmenu', '.pmenu', '.tagmenu', '.dmenu', '.menu']) assert.ok(surf[1].split(',').includes(menu), `${dir}: Pearl's ${menu} is see-through (not on --pl-surface)`);
  // and everything else that floats over the page or a map (found by going through every app and page): the Updated
  // pill, Podcasts' player bar, Mail's selection bar and toast, Places' map hint, Calendar's drag time, aOS's story
  // captions, Weather's radar bar; the floating round buttons; Podcasts' show header
  if (surf) {
    const all = [...m[1].matchAll(/:is\(([^)]*(?:\([^)]*\)[^)]*)*)\)\{background:var\(--pl-(surface|fab)\) !important/g)].map(x => x[1].split(','));
    const on = sel => all.some(l => l.includes(sel));
    for (const sel of ['.updpill', '.mbar', '#selbar', '#toast', '.maphint', '.dragtime', '.story .foot', '.rd-bar', '.page > .back', '.page > .close', '.mapbtns .iconbtn', '.rd-zoom button', '.rd-play'])
      assert.ok(on(sel), `${dir}: Pearl's ${sel} is see-through (no solid ground)`);
    assert.ok(/\.pushhead::before\{background:var\(--pl-frost\) !important\}/.test(m[1]), dir + ': Podcasts\' show header is see-through in Pearl');
  }
  for (const name of ['--pl-frost', '--pl-fab']) {
    const vals = [...m[1].matchAll(new RegExp(name + ':([^;}]+)', 'g'))].map(x => x[1].trim());
    for (const v of vals) assert.ok(solid(v), `${dir}: Pearl's ${name} is see-through: ${v}`);
  }
}
assert.ok(pages >= 15, 'Pearl blocks found: ' + pages);
console.log('ok - Pearl\'s bars, floating buttons and floating menus are solid in ' + pages + ' pages');
