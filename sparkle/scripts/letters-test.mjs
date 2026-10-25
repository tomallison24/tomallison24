// Sparkle's letters (sparkle/letters.js), in Node: every character the game
// shows has a glyph whose path is well formed, svg() escapes its label, and
// unknown characters are gaps, never errors.
//   node sparkle/scripts/letters-test.mjs
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const src = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'letters.js'), 'utf8');
vm.runInThisContext(src);   // it sets globalThis.SparkleLetters, as window.SparkleLetters in the page
const S = globalThis.SparkleLetters;

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

const LOWER = 'abcdefghijklmnopqrstuvwxyz', UPPER = LOWER.toUpperCase(), DIGITS = '0123456789';
const PUNCT = ['.', ',', '?', '!', "'", '"', '-', '+', '=', '×', '÷', ':', '(', ')', '_'];
const ALL = [...LOWER, ...UPPER, ...DIGITS, ...PUNCT];

// A path: only M L A commands (and the rest SVG allows), each followed by finite numbers.
const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
function checkPath(d, what) {
  assert.ok(typeof d === 'string' && d.length, what + ': empty path');
  assert.ok(/^[Mm]/.test(d), what + ': must start with M');
  assert.ok(!/NaN|Infinity|undefined/.test(d), what + ': ' + d);
  const parts = d.match(/[A-Za-z][^A-Za-z]*/g);
  assert.equal(parts.join(''), d, what + ': stray text before a command');
  for (const p of parts) {
    const cmd = p[0].toUpperCase(), rest = p.slice(1);
    assert.ok(cmd in ARGS, what + ': bad command ' + p[0]);
    assert.ok(/^[\s,0-9.eE+-]*$/.test(rest), what + ': bad numbers in ' + p);
    const nums = (rest.match(NUM) || []).map(Number);
    nums.forEach(v => assert.ok(Number.isFinite(v), what + ': ' + p));
    if (cmd === 'Z') assert.equal(nums.length, 0, what + ': ' + p);
    else assert.ok(nums.length >= ARGS[cmd] && nums.length % ARGS[cmd] === 0, what + ': wrong count in ' + p);
    if (cmd === 'A') for (let i = 0; i < nums.length; i += 7) {
      assert.ok(nums[i] > 0 && nums[i + 1] > 0, what + ': arc radius in ' + p);
      assert.ok([0, 1].includes(nums[i + 3]) && [0, 1].includes(nums[i + 4]), what + ': arc flags in ' + p);
    }
  }
}
// The points a path's ink runs through, arcs sampled along their length (the
// SVG spec's endpoint-to-centre conversion), so a circle's bottom counts.
function points(d) {
  const out = [];
  let x = 0, y = 0;
  for (const p of d.match(/[A-Za-z][^A-Za-z]*/g) || []) {
    const v = (p.slice(1).match(NUM) || []).map(Number);
    if (p[0] === 'M' || p[0] === 'L') [x, y] = v, out.push([x, y]);
    else if (p[0] === 'A') {
      let [rx, ry, , fa, fs, x2, y2] = v;
      const x1p = (x - x2) / 2, y1p = (y - y2) / 2;
      const lam = x1p ** 2 / rx ** 2 + y1p ** 2 / ry ** 2;
      if (lam > 1) rx *= Math.sqrt(lam), ry *= Math.sqrt(lam);
      const num = Math.max(0, rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p);
      const k = (fa === fs ? -1 : 1) * Math.sqrt(num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p));
      const cx = k * rx * y1p / ry + (x + x2) / 2, cy = -k * ry * x1p / rx + (y + y2) / 2;
      let dt = Math.atan2((y2 - cy) / ry, (x2 - cx) / rx) - Math.atan2((y - cy) / ry, (x - cx) / rx);
      if (fs && dt < 0) dt += 2 * Math.PI;
      if (!fs && dt > 0) dt -= 2 * Math.PI;
      const t0 = Math.atan2((y - cy) / ry, (x - cx) / rx);
      for (let i = 1; i <= 24; i++) out.push([cx + rx * Math.cos(t0 + dt * i / 24), cy + ry * Math.sin(t0 + dt * i / 24)]);
      [x, y] = [x2, y2];
    }
  }
  return out;
}
const ys = d => points(d).map(p => p[1]);

test('every letter, digit and mark the game shows has a glyph', () => {
  for (const ch of ALL) {
    assert.ok(S.has(ch), 'missing ' + ch);
    const g = S.glyph(ch);
    checkPath(g.d, JSON.stringify(ch));
    assert.ok(Number.isFinite(g.w) && g.w > 0, ch + ': advance ' + g.w);
    for (const y of ys(g.d)) assert.ok(y >= 0 && y <= 114, ch + ': y ' + y + ' outside the box');
  }
});

test('space is a gap with a width and no ink', () => {
  assert.ok(S.has(' '));
  assert.deepEqual(S.glyph(' ').d, '');
  assert.ok(S.glyph(' ').w > 0);
});

test('letters sit on the baseline and hang to the descender line', () => {
  const low = ch => Math.max(...ys(S.glyph(ch).d));
  for (const ch of 'acehiklmnorstuvwxz' + UPPER.replace(/[QJ]/g, '')) assert.ok(Math.abs(low(ch) - 80) < 0.6, ch + ' bottom ' + low(ch));
  for (const ch of 'gjpqy') assert.ok(Math.abs(low(ch) - 108) < 0.6, ch + ' bottom ' + low(ch));
});

test('the lowercase circle fills the x-height and touches its stick', () => {
  const o = points(S.glyph('o').d), top = Math.min(...o.map(p => p[1])), bot = Math.max(...o.map(p => p[1]));
  assert.ok(Math.abs(top - 40) < 0.3 && Math.abs(bot - 80) < 0.3, top + '..' + bot);
  const w = Math.max(...o.map(p => p[0])) - Math.min(...o.map(p => p[0]));
  assert.ok(Math.abs(w - 40) < 0.3, 'a true circle: ' + w + ' wide');
  for (const ch of 'adgq') {
    const pts = points(S.glyph(ch).d), stickX = Math.max(...pts.map(p => p[0]));
    const ring = pts.filter(p => p[1] > 45 && p[1] < 75 && p[0] < stickX - 1);
    assert.ok(stickX - Math.max(...ring.map(p => p[0])) < 3, ch + ': the circle reaches its stick');
  }
});

test('wide letters are wider than narrow ones', () => {
  const w = ch => S.glyph(ch).w;
  assert.ok(w('m') > w('o') && w('o') > w('l') && w('w') > w('v') && w('i') < w('n'));
});

test('path() places the glyphs side by side', () => {
  const p = S.path('cat');
  checkPath(p.d, 'cat');
  assert.equal(p.w, S.glyph('c').w + S.glyph('a').w + S.glyph('t').w);
  assert.equal(S.path('cat', { tracking: 5 }).w, p.w + 10, 'tracking goes between letters');
  const moved = S.path('ab', { x: 100 });
  assert.equal(moved.w, S.path('ab').w, 'w is the width, not where it ends');
  assert.ok(Math.abs(points(moved.d)[0][0] - points(S.path('ab').d)[0][0] - 100) < 0.01, 'x moves it');
  assert.deepEqual(S.path(''), { d: '', w: 0 });
});

test('measure() grows with the size and with the text', () => {
  const a = S.measure('cat'), b = S.measure('cat', { size: 200 });
  assert.ok(a > 0 && Math.abs(b - 2 * a) < 1e-9, a + ' ' + b);
  assert.ok(Math.abs(a - S.path('cat').w * 100 / 114) < 1e-9, 'size is the height of the 114-unit box');
  assert.ok(S.measure('cats') > a);
  assert.ok(S.measure('cat', { tracking: 10 }) > a);
});

test('svg() is a whole <svg> with the stroke settings', () => {
  const s = S.svg('Sun', { size: 114, stroke: 7, color: '#f00', cls: 'word' });
  assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 [\d.]+ 114" width="[\d.]+" height="114" class="word" role="img" aria-label="Sun" fill="none" stroke="#f00" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="[^"]+"\/><\/svg>$/);
  assert.match(S.svg('a'), /height="64"/);
  assert.match(S.svg('a'), /stroke="currentColor" stroke-width="9"/);
});

test('svg() escapes its label', () => {
  const s = S.svg('a', { label: `<b>"Tom" & 'Al'</b>` });
  assert.ok(s.includes('aria-label="&lt;b&gt;&quot;Tom&quot; &amp; &#39;Al&#39;&lt;/b&gt;"'), s);
  assert.ok(S.svg('<&>').includes('aria-label="&lt;&amp;&gt;"'));
});

test('unknown characters are a space-wide gap, never an error', () => {
  for (const t of ['日本', '😀a', '#@%', '\n', '\t', null, undefined, 42]) {
    assert.doesNotThrow(() => { S.svg(t); S.path(t); S.measure(t); }, String(t));
  }
  assert.equal(S.glyph('😀'), null);
  assert.equal(S.has('#'), false);
  assert.equal(S.path('a😀b').w, S.path('a b').w);
  assert.equal(S.path('a😀b').d, S.path('a b').d);
});

test('each: true wraps every glyph so one can be coloured', () => {
  const s = S.svg('c t', { each: true });
  assert.match(s, /<g data-i="0"><path d="M[^"]+"\/><\/g><g data-i="2"><path d="M[^"]+"\/><\/g><\/svg>$/);
});

console.log(n + ' tests passed');
