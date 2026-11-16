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
  for (const name of ['--pl-frost', '--pl-fab']) {
    const vals = [...m[1].matchAll(new RegExp(name + ':([^;}]+)', 'g'))].map(x => x[1].trim());
    for (const v of vals) assert.ok(solid(v), `${dir}: Pearl's ${name} is see-through: ${v}`);
  }
}
assert.ok(pages >= 15, 'Pearl blocks found: ' + pages);
console.log('ok - Pearl\'s bars and floating buttons are solid in ' + pages + ' pages');
