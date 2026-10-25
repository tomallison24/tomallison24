// Plays the newest release in home/welcome.js's log (RELEASES) as every phone
// that last saw the version before it would: aOS and each app opened from the
// Home Screen (an iPhone, the server offline), each with aos.seen at the old
// version. Checks each shows what aOS/RELEASING.md says it should:
//   minor (1.1): an app the release names (aOS too), the .1 rising in and
//                "What's new in <app>" with its highlights (or first notes), at
//                most three, then, with a tour, "Show me" walks through its new or
//                changed controls (only the stops it names, each one on screen);
//                an app it doesn't name, nothing
//   major (2):   aOS its cards (or highlights); every app "<app> is on aOS2"
//                with the release's highlights
//   silent:      nothing anywhere
// and that each marks the new version seen, with no script errors. Run before
// merging a release (.claude/skills/aos-minor-release, aos-major-release).
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node aOS/scripts/release-test.mjs [repo root]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const W = fs.readFileSync(path.join(ROOT, 'home/welcome.js'), 'utf8');
const RELEASES = Function('return ' + W.slice(W.indexOf('const RELEASES = [') + 17, W.indexOf('\n  ];', W.indexOf('const RELEASES = [')) + 4))();
const APPS = Function('return ' + /const APPS = (\[[^\]]*\])/.exec(W)[1])();
const NAMES = Function('return ' + /const NAMES = (\{[^}]*\})/.exec(W)[1])();
const major = v => +String(v).split('.')[0];
const entry = x => Array.isArray(x) ? { highlights: [], notes: x } : { highlights: (x && x.highlights) || [], notes: (x && x.notes) || [] };
const top3 = list => { const h = list.flatMap(x => entry(x).highlights); return (h.length ? h : list.flatMap(x => entry(x).notes)).slice(0, 3); };

const rel = RELEASES[0], prev = RELEASES.slice(1).find(r => !r.silent) || RELEASES[1];
if (!prev) { console.log('Only one release in the log: nothing to update from.'); process.exit(0); }
const kind = rel.silent ? 'silent' : major(rel.v) > major(prev.v) ? 'major' : 'minor';
console.log(`aOS${prev.v} -> aOS${rel.v} (${kind}): "${rel.title || ''}"`);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const norm = s => String(s).replace(/<[^>]+>/g, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

const browser = await chromium.launch();
let failed = 0;
for (const id of ['aos', ...APPS]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA });
  await ctx.route('**/*', route => { const u = new URL(route.request().url()); if (u.origin !== BASE) return route.abort('internetdisconnected'); if (u.pathname.includes('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }); route.continue(); });
  await ctx.addInitScript(([id, v]) => { Object.defineProperty(navigator, 'standalone', { get: () => true }); if (!sessionStorage.getItem('seeded')) { localStorage.setItem('aos.seen', JSON.stringify({ [id]: v })); localStorage.setItem('aos.signin.asked', '1'); sessionStorage.setItem('seeded', '1'); } }, [id, prev.v]);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + '/' + (id === 'aos' ? 'aOS' : id) + '/');
  // what it should say; nothing at all, if null
  let want = null;
  if (kind === 'major') want = id === 'aos' ? (rel.cards && rel.cards.length ? rel.cards.map(c => c.t || c.h).filter(Boolean).slice(0, 1) : top3([rel]).slice(0, 1)) : [`${NAMES[id]} is on aOS${rel.v}`, ...top3([rel])];
  if (kind === 'minor' && top3([(rel.apps || {})[id]].filter(Boolean)).length) want = [`What's new in ${NAMES[id]}`, ...top3([rel.apps[id]])];
  const tourStops = kind === 'minor' && rel.apps && rel.apps[id] && Array.isArray(rel.apps[id].tour) ? rel.apps[id].tour : [];
  const problems = [];
  if (want) {
    const ok = await page.waitForFunction(w => { const el = document.getElementById('aos-welcome'); if (!el) return false; const t = el.innerText.replace(/[’‘]/g, "'").replace(/\s+/g, ' '); return w.every(x => t.includes(x)); }, want.map(norm), { timeout: kind === 'major' && id === 'aos' ? 30000 : 12000 }).then(() => true).catch(() => false);
    if (!ok) { const t = await page.evaluate(() => (document.getElementById('aos-welcome') || {}).innerText || '(no screen)'); problems.push('should say: ' + want.map(norm).join(' | ') + '\n    says: ' + norm(t).slice(0, 300)); }
    // the new .x is drawn, not just there: its characters (clipped text) need a height of their own (aOS's sup has line-height 0)
    if (ok && kind === 'minor') {
      await page.waitForTimeout(2200);
      const flat = await page.evaluate(() => [...document.querySelectorAll('#aos-welcome .v-new i:not(.v-halo), #aos-welcome .h-new')].filter(e => e.getBoundingClientRect().height < 2).map(e => e.className || e.textContent));
      if (flat.length) problems.push('the new version number has no height, so it is not drawn: ' + flat.join(', '));
    }
    // The walkthrough: "Show me", then each stop that's on screen, by its own title, to Done.
    const shown = [];
    await page.waitForSelector('#aos-welcome .c-panel.on', { timeout: 5000 }).catch(() => {});   // its buttons work once the panel is in
    await page.waitForTimeout(300);
    if (tourStops.length && await page.evaluate(() => [...document.querySelectorAll('#aos-welcome .c-btns .w-btn')].some(b => b.textContent.trim() === 'Show me'))) {
      await page.click('#aos-welcome .c-btns .w-btn');
      for (let k = 0; k < tourStops.length + 2; k++) {
        const t = await page.waitForFunction(() => { const c = document.querySelector('#aos-welcome .s-card.on h3'); return c && c.textContent; }, null, { timeout: 5000 }).then(h => h.jsonValue()).catch(() => null);
        if (!t || shown.includes(t)) break;
        shown.push(t);
        await page.click('#aos-welcome .s-next');
        await page.waitForTimeout(900);
      }
      const titles = tourStops.map(x => x.t);
      if (!shown.length) problems.push('"Show me" showed none of its walkthrough');
      for (const t of shown) if (!titles.includes(t)) problems.push('walkthrough stop not in its tour: ' + t);
    }
    await page.evaluate(() => { const b = [...document.querySelectorAll('#aos-welcome button')].find(x => /^(Done|Skip)$/.test(x.textContent.trim())); if (b) b.click(); });
    await page.waitForTimeout(1500);
    if (await page.evaluate(() => !!document.getElementById('aos-welcome'))) problems.push('the screen didn\'t close');
    if (shown.length) console.log('    walkthrough: ' + shown.join(' › '));
  } else {
    await page.waitForTimeout(4000);
    if (await page.evaluate(() => !!document.getElementById('aos-welcome'))) problems.push('shows a screen, and should show nothing: ' + norm(await page.evaluate(() => document.getElementById('aos-welcome').innerText)).slice(0, 160));
  }
  const seen = await page.evaluate(id => (JSON.parse(localStorage.getItem('aos.seen') || '{}'))[id], id);
  if (seen !== rel.v) problems.push(`aos.seen.${id} is ${seen}, not ${rel.v}`);
  if (errs.length) problems.push('script errors: ' + errs.join(' | '));
  if (problems.length) { failed++; console.log('not ok - ' + id + '\n    ' + problems.join('\n    ')); }
  else console.log('ok - ' + id + (want ? ': ' + norm(want[0]) : ': nothing, as it should'));
  await ctx.close();
}
await browser.close(); server.close();
console.log(failed ? failed + ' failed' : 'all ' + (APPS.length + 1) + ' passed');
process.exit(failed ? 1 : 0);
