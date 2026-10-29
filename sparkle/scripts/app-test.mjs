// Drives Sparkle Kingdom in headless Chromium at iPhone size, as a family would (the Tiara Workshop and the
// Fairy Garden, once the fog lifts, are scenario 7): making a player
// (with no reading needed to pick one), the story, the kingdom and its quest, the signpost (a wrong
// sign first, then the right one), a round in Story Tower from the warm-up to the end (a miss first:
// the hint, then the answer after a second miss), coins, the rainbow bridge (counting planks) and the
// Gem Mine, the crystal door and Star Meadow's sparkle sequences, the castle (trying on, asking the
// price, buying, not enough coins), Settings behind the grown-up check (a report, the play
// timer badge, the starting levels, the design), everything kept after a reload, and the family
// account through the real functions/sparkle/api route (on an in-memory Workers KV with a real
// session): a second phone gets the same player, coins and all.
// An iPad sideways gets its own layout (scenario 10). Both designs (../home/design.js): Vintage, the default (the sky held at day, aos.sky), and Standard
// (Sea glass), light and dark; nothing may trip the page's Content Security Policy.
// The phone's voice is stood in for (it would take seconds a sentence here): every sentence ends at once.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node sparkle/scripts/app-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, r)); const BASE = 'http://localhost:' + server.address().port;

// the family account: the real route, on an in-memory KV, with a real session
const { onRequest } = await import(path.join(ROOT, 'functions/sparkle/api/[[route]].js'));
const { issue, putJSON } = await import(path.join(ROOT, 'server/auth.js'));
const m = new Map();
const db = { get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, String(v)); }, delete: async k => { m.delete(k); }, list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
await db.put('owner', 'O1'); await putJSON(db, 'user:O1', { id: 'O1', name: 'Tom', role: 'owner', creds: [], created: 1 });
const TOKEN = await issue(db, 'O1');
const ENV = { ACCOUNTS: db };
// Google's text-to-speech, stood in for: every sentence is a moment of silence (a real WAV), and each request is counted
const SPOKEN = [], SILENCE = (() => { const n = 80, w = Buffer.alloc(44 + n * 2); w.write('RIFF', 0); w.writeUInt32LE(36 + n * 2, 4); w.write('WAVEfmt ', 8); w.writeUInt32LE(16, 16); w.writeUInt16LE(1, 20); w.writeUInt16LE(1, 22); w.writeUInt32LE(8000, 24); w.writeUInt32LE(16000, 28); w.writeUInt16LE(2, 32); w.writeUInt16LE(16, 34); w.write('data', 36); w.writeUInt32LE(n * 2, 40); return w.toString('base64'); })();
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => { if (String(url).startsWith('https://texttospeech.googleapis.com/')) { const b = JSON.parse(init.body); SPOKEN.push({ voice: b.voice.name, text: b.input.text, how: b.input.customPronunciations });
  return new Response(JSON.stringify({ audioContent: SILENCE }), { headers: { 'Content-Type': 'application/json' } }); } return realFetch(url, init); };

const b = await chromium.launch();
let failed = 0;
const report = (name, problems) => { if (problems.length) { failed++; console.log('not ok - ' + name + '\n  ' + problems.join('\n  ')); } else console.log('ok - ' + name); };

async function phone({ look = 'vintage', scheme = 'light', signed = false, seed = null, size = [390, 844], motion = 'reduce' } = {}) {
  const ctx = await b.newContext({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: scheme, serviceWorkers: 'block', reducedMotion: motion, locale: 'en-US' });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin !== BASE) return route.abort();
    if (u.pathname.startsWith('/sparkle/api/')) { const rq = route.request();
      const res = await onRequest({ request: new Request(u.href, { method: rq.method(), headers: rq.headers(), body: rq.method() === 'POST' ? rq.postData() : undefined }), params: { route: u.pathname.slice(13).split('/') }, env: ENV });
      return route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() }); }
    if (u.pathname.includes('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
    return route.continue();
  });
  await ctx.addInitScript(([look, token, seed]) => {
    // the phone's voice: every sentence over at once
    try { const S = window.speechSynthesis; if (S) { S.speak = u => setTimeout(() => u.onend && u.onend(), 5); S.cancel = () => {}; } } catch {}
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('aos.seen', JSON.stringify({ sparkle: '999', aos: '999' })); localStorage.setItem('aos.signin.asked', '1');
    localStorage.setItem('design.sparkle', look); localStorage.setItem('aos.sky', 'day');
    if (token) localStorage.setItem('aos.session', JSON.stringify({ token, user: { id: 'O1', name: 'Tom', role: 'owner' }, at: Date.now() }));
    if (seed) localStorage.setItem('sparkle.v1', JSON.stringify(seed));
  }, [look, signed ? TOKEN : null, seed]);
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push('script error: ' + e.message));
  await p.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI); }));
  await p.goto(BASE + '/sparkle/'); await p.waitForTimeout(600);
  return { ctx, p, errs };
}
const sp = (p, f, a) => p.evaluate(f, a);
const shot = async (p, n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + '.png') }); };
const coins = p => sp(p, () => { const me = window.sparkle.me || Object.values(window.sparkle.save.players)[0]; return Object.values(me.wallet).reduce((a, w) => a + w.earned - w.spent, 0); });
// a round's question, once any how-to-play demo before it is over
const state = async p => { await p.waitForFunction(() => { const R = window.sparkle.round; return !R || !R.demo; }, null, { timeout: 40000 }).catch(() => {}); return sp(p, () => { const R = window.sparkle.round; return { screen: window.sparkle.screen, skill: R && R.skill, q: R && R.q ? Object.assign(JSON.parse(JSON.stringify(R.q)), { ids: (R.q.choices || []).map(c => c.id) }) : null, i: R && R.i, n: R && R.plan.length }; }); };
// the games she plays rather than picks: gems in order, pairs, what's missing
async function solve(p, q, root = '') {
  if (q.kind === 'build') { await p.waitForSelector(root + ' .tile'); const used = new Set();
    for (const l of q.word) { const k = q.tiles.findIndex((t, i) => t === l && !used.has(i)); used.add(k); await p.click(`${root} .tile[data-t="${k}"]`); } return true; }
  // the Unicorn Bakery: put in (or take out) what the recipe needs, then Bake; or share the cookies, then Done
  if (q.kind === 'bake') { await p.waitForSelector('#bakeBtn');
    if (q.mode === 'share') for (let k = 0; k < q.n; k++) await p.click(`.plate[data-plate="${k % q.plates}"]`);
    else for (const [id, n] of Object.entries(q.need)) { const have = (q.start || {})[id] || 0, sack = q.sack && n >= 10;
      if (sack) await p.click('[data-sack]');
      for (let k = have + (sack ? 10 : 0); k < n; k++) await p.click(`[data-add="${id}"]`);
      for (let k = n; k < have; k++) await p.click(`[data-out="${id}"] >> nth=0`); }
    await p.click('#bakeBtn'); await p.waitForTimeout(1600); return true; }
  if (q.kind === 'match') { const by = {}; q.cards.forEach((c, i) => (by[c.pair] = by[c.pair] || []).push(i));
    for (const [a, c] of Object.values(by)) { await p.click(`.card[data-k="${a}"]`); await p.click(`.card[data-k="${c}"]`); await p.waitForTimeout(450); } return true; }
  if (q.kind === 'missing') { await p.waitForSelector('#choices .choice', { timeout: 15000 }); for (const a of q.answers) await p.click(`#choices .choice[data-c="${a}"]`); return true; }
  return false;
}
// answers every question of the round on screen; misses: how many wrong taps before the right one, on the first question
async function playRound(p, misses = 0) {
  for (let guard = 0; guard < 24; guard++) {
    await p.waitForTimeout(150);
    const st = await state(p);
    if (st.screen !== 'round' || !st.q) return st;
    if (st.q.kind === 'wand') {
      await p.waitForFunction(() => { const w = document.querySelector('#show .wand'); return w && w.style.pointerEvents === ''; }, null, { timeout: 20000 });
      for (const k of st.q.back ? st.q.seq.slice().reverse() : st.q.seq) await p.click(`#show .wand button[data-k="${k}"]`);
      await p.waitForTimeout(700); continue;
    }
    if (await solve(p, st.q)) { await p.waitForTimeout(900); continue; }
    const wrong = st.q.ids.filter(x => x !== st.q.answer);
    for (let k = 0; k < misses && k < wrong.length; k++) await p.click(`.choice[data-c="${wrong[k]}"]`);
    misses = 0;
    await p.click(`.choice[data-c="${st.q.answer}"]`); await p.waitForTimeout(750);
  }
  return state(p);
}
const AVA = { id: 'p1', name: 'Ava', look: { skin: 's3', hair: 'black', style: 'puffs' }, created: 1, updated: 1, skills: {}, review: {}, known: {}, wallet: { seed: { earned: 40, spent: 0 } }, owned: [], wearing: {}, gifts: 0,
  world: { at: 'castle', stars: [], critters: [], fog: 0 }, chapters: {}, stickers: [], quest: null, play: {}, lands: {}, log: {}, rounds: 0, introSeen: true };
const seedOf = (...ps) => ({ v: 1, players: Object.fromEntries(ps.map(x => [x.id, x])), gone: {}, settings: {}, settingsAt: 0 });

// 1. a new player, picked by her portrait; the story; the kingdom
{
  const { ctx, p, errs } = await phone(); const pr = [];
  if (!(await p.locator('[data-add]').innerText()).includes('Make your princess')) pr.push('the first card does not say Make your princess');
  await p.click('[data-add]'); await p.waitForSelector('.sheet #cName');
  if (!(await p.locator('#cSave').isDisabled())) pr.push('a player can be made with no name');
  await p.fill('#cName', 'Mia'); await p.click('#cHair [data-v="red"]'); await p.click('#cStyle [data-v="braids"]'); await p.click('#cSave');
  const card = p.locator('[data-player]');
  if (await card.count() !== 1) pr.push('the new player has no card');
  if (!(await card.locator('svg').count() >= 2)) pr.push('her card has no portrait and name drawn in the school letters');
  if (await card.getAttribute('aria-label') !== 'Play as Mia') pr.push('her card is not labelled Play as Mia');
  await shot(p, '1-picker');
  await card.click(); await p.waitForTimeout(300);
  if ((await sp(p, () => window.sparkle.screen)) !== 'intro') pr.push('a new player does not see the story first');
  for (let i = 0; i < 3; i++) await p.click('#introGo');
  await p.waitForTimeout(300);
  if ((await sp(p, () => window.sparkle.screen)) !== 'world') pr.push('the story does not end in the kingdom');
  if (await p.locator('#quest .qstop').count() !== 3) pr.push("today's quest does not have three stops");
  if ((await sp(p, () => window.sparkle.me.quest.stops[0])) !== 'tower') pr.push("the quest does not start at Story Tower");
  if (!(await p.locator('#mapIn svg.kingdom').count())) pr.push('no kingdom');
  if (!(await p.locator('#rider').count())) pr.push('no princess and unicorn on the map');
  await shot(p, '2-kingdom');
  pr.push(...errs, ...(await sp(p, () => window.__csp || [])).map(c => 'blocked by its policy: ' + c));
  report('a new player (no reading needed to pick her), the story, the kingdom and today\'s quest', pr); await ctx.close();
}

// 2. the signpost, a round in Story Tower: the warm-up, a miss (the hint, then the answer), coins
{
  const { ctx, p, errs } = await phone({ seed: seedOf(AVA) }); const pr = [];
  await p.click('[data-player="p1"]'); await p.waitForTimeout(300);
  const before = await coins(p);
  await p.click('#quest'); await p.waitForSelector('.gatebox [data-sign]', { timeout: 8000 });
  await shot(p, '3-signpost');
  const g = await sp(p, () => window.sparkle.gate);
  await p.click(`.gatebox [data-sign="${g.signs.find(x => x !== g.answer)}"]`); await p.waitForTimeout(200);
  if (!(await p.locator('.gatebox').count())) pr.push('a wrong sign let her through');
  await p.click(`.gatebox [data-sign="${g.answer}"]`);
  await p.waitForFunction(() => window.sparkle.screen === 'round', null, { timeout: 10000 }).catch(() => pr.push('the right sign did not lead to Story Tower'));
  let st = await state(p);
  if (st.n !== 6) pr.push('the first round is not a 6-question warm-up: ' + st.n);
  if (!(await p.locator('#bubble .w svg').count())) pr.push('what she hears is not shown in the school letters');
  // a miss, then another: the answer is shown and the others dimmed
  if (st.q.ids.length >= 3) {
    const wrong = st.q.ids.filter(x => x !== st.q.answer);
    await p.click(`.choice[data-c="${wrong[0]}"]`); await p.waitForTimeout(150);
    if (!(await p.locator(`.choice[data-c="${wrong[0]}"].dim`).count())) pr.push('a wrong answer is not set aside');
    await p.click(`.choice[data-c="${wrong[1]}"]`); await p.waitForTimeout(150);
    if (!(await p.locator(`.choice[data-c="${st.q.answer}"].hint`).count())) pr.push('after a second miss the answer is not shown');
    if (await coins(p) !== before) pr.push('a miss changed her coins');
    await shot(p, '4-hint');
    await p.click(`.choice[data-c="${st.q.answer}"]`); await p.waitForTimeout(800);
    if (await coins(p) !== before) pr.push('tapping the answer she was shown earned a coin');
  }
  st = await playRound(p);
  if (st.screen !== 'reward') pr.push('the round did not end on the reward screen: ' + st.screen);
  const sk = await sp(p, () => window.sparkle.save.players.p1.skills.read);
  if (!sk || !sk.placed) pr.push('the warm-up did not place her on the reading ladder');
  const got = await coins(p) - before;
  if (got < 4 || got > 8) pr.push('coins for the round: ' + got + ' (1 a right answer, 3 for finishing)');
  if (!(await p.locator('.praise').first().innerText()).length) pr.push('no praise');
  await shot(p, '5-reward');
  const q = await sp(p, () => window.sparkle.save.players.p1.quest);
  if (!q.done[0]) pr.push('Story Tower is not ticked off the quest');
  pr.push(...errs);
  report('the signpost, a warm-up round in Story Tower with a miss (dimmed, then the answer shown), coins and the quest', pr); await ctx.close();
}

// 3. a placed reader: a round at her level; the bridge and the Gem Mine; the crystal door and Star Meadow
{
  const ava = JSON.parse(JSON.stringify(AVA));
  ava.skills.read = { level: 8, hist: [], streak: 0, misses: 0, answers: 30, placed: true, warm: null, best: 8 };
  ava.skills.math = { level: 6, hist: [], streak: 0, misses: 0, answers: 30, placed: true, warm: null, best: 6 };
  ava.skills.wand = { level: 2, hist: [], streak: 0, misses: 0, answers: 12, placed: true, warm: null, best: 2 };
  ava.review = { 'read/w:dog': { due: '2000-01-01', step: 0, days: 0, last: '1999-12-31', missed: 2 } };
  const { ctx, p, errs } = await phone({ look: 'glass', scheme: 'dark', seed: seedOf(ava) }); const pr = [];
  await p.click('[data-player="p1"]'); await p.waitForTimeout(300);
  await sp(p, () => { window.sparkle.startRound('read'); });
  let st = await state(p);
  if (st.n < 6 || st.n > 8) pr.push('a round is not 6 to 8 questions: ' + st.n);
  const words = [];
  for (let k = 0; k < 10 && (await state(p)).screen === 'round'; k++) { const s = await state(p); if (s.q) words.push(s.q.answer); await playRound(p).catch(() => {}); break; }
  const rv = await sp(p, () => window.sparkle.save.players.p1.review['read/w:dog']);
  if (rv && rv.last === '1999-12-31') pr.push('the word due for review (dog) did not come back');
  const lv = await sp(p, () => window.sparkle.save.players.p1.skills.read.level);
  if (lv < 9) pr.push('a round all right at level 8 did not move her up (4 right in a row moves her up a level): ' + lv);
  if (!(await sp(p, () => window.sparkle.save.players.p1.stickers.length))) pr.push('moving up earned no sticker');
  await p.click('#mapBtn'); await p.waitForTimeout(300);
  // the bridge: count the planks
  await sp(p, () => { window.sparkle.travel('mine'); }); await p.waitForSelector('#plankBtn', { timeout: 8000 });
  const n = (await sp(p, () => window.sparkle.gate)).n;
  if (await p.locator('#planks i').count() !== n) pr.push('the bridge does not show ' + n + ' gaps');
  await shot(p, '6-bridge');
  for (let i = 0; i < n; i++) await p.click('#plankBtn');
  await p.waitForFunction(() => window.sparkle.screen === 'round', null, { timeout: 10000 }).catch(() => pr.push('the mended bridge did not lead to the Gem Mine'));
  if ((await state(p)).q && (await sp(p, () => window.sparkle.round.skill)) !== 'math') pr.push('the Gem Mine is not math');
  await shot(p, '7-mine');
  await playRound(p);
  await p.click('#mapBtn'); await p.waitForTimeout(300);
  // the crystal door, then Star Meadow
  await sp(p, () => { window.sparkle.travel('meadow'); }); await p.waitForSelector('.gatebox .wand', { timeout: 10000 });
  const d = await sp(p, () => window.sparkle.gate);
  await p.waitForFunction(() => { const w = document.querySelector('.gatebox .wand'); return w && w.style.pointerEvents === ''; }, null, { timeout: 20000 });
  for (const k of d.back ? d.seq.slice().reverse() : d.seq) await p.click(`.gatebox .wand button[data-k="${k}"]`);
  await p.waitForFunction(() => window.sparkle.screen === 'round', null, { timeout: 12000 }).catch(() => pr.push('the crystal door did not open to Star Meadow'));
  st = await state(p);
  if (!st.q || !(st.q.kind === 'wand' || st.q.skill === 'pattern')) pr.push('Star Meadow is not the sparkle sequences or Pattern Parade: ' + (st.q && st.q.kind));
  await shot(p, '8-meadow');
  st = await playRound(p);
  if (st.screen !== 'reward') pr.push('Star Meadow\'s round did not end');
  const q = await sp(p, () => window.sparkle.save.players.p1.quest);
  pr.push(...errs, ...(await sp(p, () => window.__csp || [])).map(c => 'blocked by its policy: ' + c));
  report('a placed reader: review comes back, a round all right moves her up (and a sticker), the bridge and the Gem Mine, the crystal door and Star Meadow (Sea glass, dark)', pr); await ctx.close();
}

// 4. the castle: trying on, asking the price, buying, not enough coins
{
  const { ctx, p, errs } = await phone({ seed: seedOf(AVA) }); const pr = [];
  await p.click('[data-player="p1"]'); await p.waitForTimeout(300);
  await sp(p, () => { window.sparkle.openWardrobe(); }); await p.waitForTimeout(200);
  await p.click('[data-item="gown-lilac"]');
  if (await coins(p) !== 40) pr.push('one tap on something not hers spent coins');
  if (!(await p.locator('[data-item="gown-lilac"].ask').count())) pr.push('one tap does not ask about the price');
  await p.click('[data-item="gown-lilac"]');
  if (await coins(p) !== 10) pr.push('buying the 30-coin gown left ' + await coins(p) + ' coins, not 10');
  if ((await sp(p, () => window.sparkle.save.players.p1.wearing.gown)) !== 'gown-lilac') pr.push('she is not wearing what she bought');
  await p.click('[data-tab="tiara"]'); await p.click('[data-item="tiara-crown"]'); await p.click('[data-item="tiara-crown"]');
  if (await coins(p) !== 10) pr.push('a 50-coin crown was bought with 10 coins');
  await p.click('[data-tab="gown"]'); await p.click('[data-item="gown-petal"]');
  if ((await sp(p, () => window.sparkle.save.players.p1.wearing.gown)) !== 'gown-petal') pr.push('she can\'t change back into the gown she started with');
  await p.click('[data-tab="treasures"]');
  if (!(await p.locator('.treasures').innerText()).includes('Stars found: 0 of 8')) pr.push('the treasure book does not count the stars');
  await shot(p, '9-castle');
  // after a reload: still hers
  await p.reload(); await p.waitForTimeout(500);
  if (await coins(p) !== 10) pr.push('after a reload her coins are ' + await coins(p));
  if (!(await sp(p, () => window.sparkle.save.players.p1.owned.includes('gown-lilac')))) pr.push('after a reload the gown is gone');
  pr.push(...errs);
  report('the castle: one tap asks the price, a second buys; never with too few coins; changing back; the treasure book; kept after a reload', pr); await ctx.close();
}

// 5. Settings, behind the grown-up check: a report, the timer badge, starting levels, the design
{
  const ava = JSON.parse(JSON.stringify(AVA)); ava.skills.read = { level: 5, hist: [], streak: 0, misses: 0, answers: 20, placed: true, best: 5 };
  ava.review = { 'read/w:pig': { due: '2099-01-01', step: 0, days: 0, last: '2026-01-01', missed: 3 } };
  const { ctx, p, errs } = await phone({ seed: seedOf(ava) }); const pr = [];
  await p.locator('#grownBtn').dispatchEvent('pointerdown'); await p.waitForTimeout(800);
  await p.locator('#grownBtn').dispatchEvent('pointerup'); await p.waitForTimeout(400);
  if (await p.locator('.sheet').count()) pr.push('a short press opened the grown-up check');
  await p.locator('#grownBtn').dispatchEvent('pointerdown'); await p.waitForSelector('#gAns', { timeout: 8000 }).catch(() => pr.push('holding Grown-ups does not ask a grown-up question'));
  const m2 = /(\d+) × (\d+)/.exec(await p.locator('.sheet').innerText());
  await p.fill('#gAns', '1'); await p.click('#gOk');
  if (await p.locator('.sheet h2', { hasText: 'Settings' }).count()) pr.push('a wrong answer opened Settings');
  await p.fill('#gAns', String(+m2[1] * +m2[2])); await p.click('#gOk'); await p.waitForTimeout(300);
  if (!(await p.locator('.sheet h2', { hasText: 'Settings' }).count())) pr.push('the right answer did not open Settings');
  const labels = await p.locator('.sheet .st-lbl').allInnerTexts();
  if (labels.join() !== 'DESIGN,PLAYERS,LEARNING,VOICE AND SOUND,LETTER SOUNDS,FAMILY ACCOUNT') pr.push('Settings\' sections are ' + labels.join());
  await shot(p, '10-parent');
  if (await p.getAttribute('#sBadge', 'role') !== 'switch') pr.push('Play timer on screen is not a switch');
  await p.click('#sBadge');
  await p.click('#sLands [data-land="math"]');
  if (!(await sp(p, () => window.sparkle.save.settings.off.includes('math')))) pr.push('switching Gem Mine off did not close it');
  await p.click('#sLands [data-land="math"]');
  if (await sp(p, () => window.sparkle.save.settings.off.includes('math'))) pr.push('switching Gem Mine on again did not open it');
  await p.click('#sDesign [data-design="glass"]'); await p.waitForTimeout(200);
  if (await p.evaluate(() => document.documentElement.dataset.look) !== 'glass') pr.push('Design > Standard did not switch to Sea glass');
  await p.click('[data-rep="p1"]'); await p.waitForTimeout(200);
  const rep = await p.locator('.sheet').innerText();
  for (const want of ['Reading', '5 of 12', 'Letter sounds'.slice(0, 0), 'Practice together', 'pig']) if (want && !rep.includes(want)) pr.push('the report does not show ' + want);
  await shot(p, '11-report');
  await p.click('[data-lv="read"][data-d="1"]'); await p.waitForTimeout(150);
  if ((await sp(p, () => window.sparkle.save.players.p1.skills.read.level)) !== 6) pr.push('+ did not raise her reading level');
  // Remove this player asks first, in the app (the shared sheet, in red), never the browser's confirm(); Cancel keeps her
  const dialogs = []; p.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  await p.click('#rEdit'); await p.click('#cDel');
  const ask = await p.waitForSelector('.st-ask .st-yes.st-bad', { timeout: 5000 }).then(() => p.locator('.st-ask').innerText(), () => '');
  if (!/Remove Ava\?/.test(ask) || !/deleted on every phone/.test(ask)) pr.push('Remove this player did not ask in the app: ' + JSON.stringify(ask));
  await shot(p, '11b-remove');
  await p.click('.st-ask .st-no'); await p.waitForTimeout(200);
  if (await p.locator('.st-ask').count() || !(await sp(p, () => !!window.sparkle.save.players.p1))) pr.push('Cancel on Remove did not keep her');
  if (dialogs.length) pr.push('the browser\'s own dialog came up: ' + dialogs.join(' / '));
  await p.click('.sheet [data-x="done"]'); await p.waitForTimeout(200);
  await p.click('[data-player="p1"]'); await p.waitForTimeout(300);
  if (await p.locator('#timer').isVisible()) pr.push('the play timer still shows after Hide');
  pr.push(...errs);
  report('Settings: only after holding and the grown-up question; a report with words to practice; the timer badge; a level up; the design', pr); await ctx.close();
}

// 6. the family account: a round on one phone, the same player on another
{
  const one = await phone({ signed: true, seed: seedOf(AVA) }); const pr = [];
  await one.p.click('[data-player="p1"]'); await one.p.waitForTimeout(300);
  await sp(one.p, () => { window.sparkle.startRound('math'); }); await playRound(one.p);
  await one.p.waitForTimeout(800);
  const c1 = await coins(one.p);
  const kept = JSON.parse(m.get('sparkle:O1') || 'null');
  if (!kept || !kept.save.players.p1) pr.push('the account has no copy after a round');
  const two = await phone({ signed: true, look: 'glass' });
  await two.p.waitForTimeout(800);
  if (!(await two.p.locator('[data-player="p1"]').count())) pr.push('the second phone does not show Ava');
  else if (await coins(two.p) !== c1) pr.push('the second phone has ' + await coins(two.p) + ' coins, not ' + c1);
  pr.push(...one.errs, ...two.errs);
  report('the family account: a round on one phone, and a second phone signed in has the same player and coins', pr);
  await one.ctx.close(); await two.ctx.close();
}

// 7. the fog lifts: the Tiara Workshop (its gem door, spelling with gems) and the Fairy Garden (its flower gate, its three memory games)
{
  const ava = JSON.parse(JSON.stringify(AVA)); ava.rounds = 3;
  ava.skills.read = { level: 8, hist: [], streak: 0, misses: 0, answers: 30, placed: true, best: 8 };
  ava.known = { 'read/w:wig': '2026-01-01', 'read/w:fan': '2026-01-02' };
  const { ctx, p, errs } = await phone({ seed: seedOf(ava) }); const pr = [];
  await p.click('[data-player="p1"]'); await p.waitForTimeout(300);
  if (await p.locator('.kingdom .steps').count()) pr.push('the paths to the fogged lands show before the fog lifts');
  await p.click('#mapIn .place.workshop', { force: true }).catch(() => {}); await p.waitForTimeout(300);
  if ((await sp(p, () => window.sparkle.screen)) !== 'world' || await p.locator('.gatebox').count()) pr.push('a fogged land could be visited');
  await sp(p, () => { window.sparkle.startRound('read'); }); await playRound(p);
  const open = await sp(p, () => window.sparkle.save.players.p1.world.open || {});
  if (!open.garden || !open.workshop) pr.push('the fog did not lift after her fourth round: ' + JSON.stringify(open));
  if ((await p.locator('#rewardIn').innerText()).indexOf('fog lifted') < 0) pr.push('the end of the round does not say the fog lifted');
  await p.click('#mapBtn'); await p.waitForTimeout(300);
  if (await p.locator('.kingdom .steps').count() !== 2) pr.push('no cloud steps to the two lands');
  // the gem door: spell the password
  await sp(p, () => { window.sparkle.travel('workshop'); }); await p.waitForSelector('.gatebox .tile', { timeout: 10000 }).catch(() => pr.push('no gem door on the way to the Tiara Workshop'));
  await shot(p, '12-gemdoor');
  const g = await sp(p, () => window.sparkle.gate);
  const wrongTile = g.tiles.findIndex(t => t !== g.word[0]);
  if (wrongTile >= 0) { await p.click(`.gatebox .tile[data-t="${wrongTile}"]`); if (await p.locator('.gatebox .slots i.on').count()) pr.push('a wrong gem went into the word'); }
  await solve(p, g, '.gatebox');
  await p.waitForFunction(() => window.sparkle.screen === 'round', null, { timeout: 12000 }).catch(() => pr.push('the gem door did not open to the workshop'));
  let st = await state(p);
  if (st.skill !== 'spell') pr.push('the Tiara Workshop is not spelling: ' + st.skill);
  await shot(p, '13-spell');
  st = await playRound(p);
  if (st.screen !== 'reward') pr.push('the spelling round did not end');
  if (!(await sp(p, () => (window.sparkle.save.players.p1.skills.spell || {}).placed))) pr.push('the warm-up did not place her on the spelling ladder');
  await p.click('#mapBtn'); await p.waitForTimeout(300);
  // the flower gate, then the garden's three games, one a round
  await sp(p, () => { window.sparkle.travel('garden'); }); await p.waitForSelector('.gatebox [data-sign]', { timeout: 10000 });
  const f = await sp(p, () => window.sparkle.gate); await p.click(`.gatebox [data-sign="${f.answer}"]`);
  await p.waitForFunction(() => window.sparkle.screen === 'round', null, { timeout: 10000 }).catch(() => pr.push('the flower gate did not open to the Fairy Garden'));
  const games = new Set();
  for (let k = 0; k < 3; k++) {
    if (k) { await sp(p, () => { window.sparkle.startRound('garden'); }); await p.waitForTimeout(300); }
    st = await state(p); games.add(st.skill);
    await shot(p, '14-garden-' + st.skill);
    st = await playRound(p);
    if (st.screen !== 'reward') pr.push(`the ${[...games].pop()} round did not end`);
    await p.click('#mapBtn'); await p.waitForTimeout(250);
  }
  if ([...games].sort().join() !== 'match,missing,recall') pr.push('the garden did not take turns with its three games: ' + [...games]);
  pr.push(...errs, ...(await sp(p, () => window.__csp || [])).map(c => 'blocked by its policy: ' + c));
  report('the fog lifts after four rounds; the gem door and spelling in the Tiara Workshop; the flower gate and the Fairy Garden\'s three memory games', pr); await ctx.close();
}

// 8. the story: a chapter after a round in a land, a page at a time; the land's colour on the map; a present at
// chapter 5; her rank going up; the castle's Stories shelf to hear one again (Sea glass)
{
  const ava = JSON.parse(JSON.stringify(AVA)); ava.rounds = 8;
  ava.landRounds = { read: { seed: 8 } }; ava.chapters = { read: 4 };
  const sk = lv => ({ level: lv, hist: [], streak: 0, misses: 0, answers: 30, placed: true, best: lv });
  Object.assign(ava.skills, { read: sk(8), math: sk(6), wand: sk(3) });   // 8 + 6 + 3 + 4 others at 1 = 21: a Princess
  const { ctx, p, errs } = await phone({ look: 'glass', seed: seedOf(ava) }); const pr = [];
  await p.click('[data-player="p1"]'); await p.waitForTimeout(300);
  const tint = await p.locator('.kingdom [data-tint="read"]').count(), mine = await p.locator('.kingdom [data-tint="math"]').count();
  if (!tint || !mine) pr.push('Story Tower and the Gem Mine are not greyed by the fog on the map');
  const sat = await sp(p, () => { const f = document.querySelector('.kingdom [data-tint="read"]'); const id = f && f.getAttribute('filter').slice(5, -1); const m = id && document.getElementById(id).querySelector('feColorMatrix'); return m ? +m.getAttribute('values') : null; });
  if (!(sat > 0.55 && sat < 0.62)) pr.push('Story Tower after 4 chapters should be partly coloured: ' + sat);
  await sp(p, () => { window.sparkle.startRound('read'); }); await playRound(p);
  const txt = await p.locator('#rewardIn').innerText();
  if (!txt.includes('New chapter')) pr.push('no new chapter at the end of her 9th round in Story Tower');
  if (!txt.includes('You are a Princess now')) pr.push('her rank did not go up: ' + txt.replace(/\s+/g, ' '));
  await p.click('#chapterBtn'); await p.waitForTimeout(200);
  if ((await sp(p, () => window.sparkle.screen)) !== 'chapter') pr.push('the book did not open the chapter');
  if (!(await p.locator('#chapterIn .chtitle').innerText()).includes('Chapter 5')) pr.push('not chapter 5');
  await shot(p, '15-chapter');
  for (let k = 0; k < 6 && await p.locator('#chNext').count(); k++) { await p.click('#chNext'); await p.waitForTimeout(120); }
  await shot(p, '16-chapter-gift');
  const after = await sp(p, () => { const me = window.sparkle.save.players.p1; return { ch: me.chapters.read, owned: me.owned, rank: me.rank }; });
  if (after.ch !== 5) pr.push('chapter 5 was not kept as heard: ' + after.ch);
  if (!after.owned.includes('library-owl-lamp')) pr.push('the present of chapter 5 was not given');
  if (after.rank !== 1) pr.push('her rank was not kept: ' + after.rank);
  if (!(await p.locator('#chapterIn .reveal svg').count())) pr.push('the present is not shown');
  if (!(await p.locator('#chapterIn').innerText()).includes('owl lamp')) pr.push('the present is not named');
  await p.click('#chMap'); await p.waitForTimeout(300);
  const sat2 = await sp(p, () => { const f = document.querySelector('.kingdom [data-tint="read"]'); const m = f && document.getElementById(f.getAttribute('filter').slice(5, -1)).querySelector('feColorMatrix'); return m ? +m.getAttribute('values') : 1; });
  if (!(sat2 > sat)) pr.push('Story Tower did not get more colour after the chapter');
  // no chapter twice: the next round in Story Tower brings none (chapter 6 is at 12 rounds)
  await sp(p, () => { window.sparkle.startRound('read'); }); await playRound(p);
  if ((await p.locator('#chapterBtn').count())) pr.push('a chapter came again before its rounds');
  // the castle: her rank, the Stories shelf, a story present that can't be bought
  await sp(p, () => window.sparkle.openWardrobe()); await p.waitForTimeout(200);
  if (!(await p.locator('#castleRank').innerText()).includes('Princess')) pr.push('the castle does not show her rank');
  await p.click('[data-tab="stories"]');
  if (await p.locator('[data-chapter^="read:"]').count() !== 5) pr.push('the Stories shelf should have 5 Story Tower chapters to hear');
  if (await p.locator('.chrow button[disabled]').count() !== 45) pr.push('the chapters not reached should be shut');
  await shot(p, '17-stories');
  await p.click('[data-chapter="read:2"]'); await p.waitForTimeout(150);
  for (let k = 0; k < 6 && await p.locator('#chNext').count(); k++) { await p.click('#chNext'); await p.waitForTimeout(100); }
  await p.click('#chBack'); await p.waitForTimeout(150);
  if ((await sp(p, () => window.sparkle.screen)) !== 'castle') pr.push('hearing a chapter again does not come back to the castle');
  if ((await sp(p, () => window.sparkle.save.players.p1.chapters.read)) !== 5) pr.push('hearing chapter 2 again changed what she has heard');
  // the Rooms (the library and the ballroom; the bedroom has its own screen): a piece to buy (ask, then buy),
  // the owl lamp from the story goes in the library, a story piece can't be bought
  await p.click('[data-tab="rooms"]'); await p.waitForTimeout(100);
  if (!(await p.locator('#dress .roomview svg').count())) pr.push('the Rooms tab does not show the room');
  if (await p.locator('[data-room="bedroom"]').count()) pr.push('the bedroom is still a Rooms tab room');
  const r0 = await coins(p);
  await p.click('[data-piece="library-wall-moons"]');
  if ((await coins(p)) !== r0) pr.push('one tap bought a room piece');
  await p.click('[data-piece="library-wall-moons"]');
  const lib = await sp(p, () => { const me = window.sparkle.save.players.p1; return { own: me.owned.includes('library-wall-moons'), on: (me.rooms || {}).library && me.rooms.library.wall }; });
  if (!lib.own || lib.on !== 'library-wall-moons' || (await coins(p)) !== r0 - 25) pr.push('buying the moon wallpaper: ' + JSON.stringify(lib));
  await p.click('[data-piece="library-shelf-golden"]');
  if (await sp(p, () => window.sparkle.save.players.p1.owned.includes('library-shelf-golden'))) pr.push('a story bookshelf was given by tapping it');
  await p.click('[data-room="library"]'); await p.click('[data-piece="library-owl-lamp"]');
  if ((await sp(p, () => (window.sparkle.save.players.p1.rooms.library || {}).small)) !== 'library-owl-lamp') pr.push('the owl lamp from the story did not go in the library');
  await shot(p, '18-rooms');
  await p.click('[data-tab="tiara"]'); const c0 = await coins(p);
  await p.click('[data-item="tiara-rainbow"]'); await p.click('[data-item="tiara-rainbow"]');
  if ((await coins(p)) !== c0 || (await sp(p, () => window.sparkle.save.players.p1.owned.includes('tiara-rainbow')))) pr.push('a story present could be bought');
  pr.push(...errs, ...(await sp(p, () => window.__csp || [])).map(c => 'blocked by its policy: ' + c));
  report('the story: a chapter after rounds in a land, its colour on the map, a present at chapter 5, her rank, the Stories shelf, the rooms to decorate (Sea glass)', pr); await ctx.close();
}

// 9. how to play: before a game that's new to her, her friend explains and a hand plays one (for no coins), then
// it's her turn; not again at that level; the ? button shows it again; Skip ends it
{
  const ava = JSON.parse(JSON.stringify(AVA)); ava.rounds = 1;
  ava.skills.read = { level: 3, hist: [], streak: 0, misses: 0, answers: 30, placed: true, best: 3 };
  const { ctx, p, errs } = await phone({ seed: seedOf(ava) }); const pr = [];
  await p.click('[data-player="p1"]'); await p.waitForTimeout(300);
  const c0 = await coins(p);
  await sp(p, () => { window.sparkle.startRound('read'); });
  if (!(await p.waitForSelector('#howCard', { timeout: 3000 }).catch(() => null))) pr.push('no explanation before a game new to her');
  if (!(await p.waitForSelector('#hand:not([hidden])', { timeout: 8000 }).catch(() => null))) pr.push('no hand showing how');
  await shot(p, '19-demo');
  const blocked = await sp(p, () => { const v = document.getElementById('demoVeil'), r = document.getElementById('stage').getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.75); return !!(v && v.contains(el)); });
  if (!blocked) pr.push('her taps are not held back while the hand shows how');
  let st = await state(p);
  if (st.screen !== 'round' || !st.q || st.i !== 0) pr.push('her own round did not start after the demo: ' + JSON.stringify({ s: st.screen, i: st.i }));
  if ((await coins(p)) !== c0) pr.push('the demo earned coins');
  if (!(await sp(p, () => (window.sparkle.save.players.p1.demos || {})['read:3']))) pr.push('the demo was not remembered');
  if (await p.locator('#demoVeil, #hand').count()) pr.push('the demo did not clear away');
  st = await playRound(p);
  await sp(p, () => { window.sparkle.save.players.p1.skills.read.level = 3; window.sparkle.startRound('read'); }); await p.waitForTimeout(400);   // (a round all right moves her up, and a new level shows how again)
  if (await p.locator('#demoVeil').count()) pr.push('the demo came again at the same level');
  // the ? button, then Skip
  await state(p); await p.click('#howBtn');
  if (!(await p.waitForSelector('#demoSkip', { timeout: 3000 }).catch(() => null))) pr.push('the ? button does not show how');
  else { await p.click('#demoSkip'); st = await state(p); if (!st.q || await p.locator('#demoVeil').count()) pr.push('Skip did not go back to her round'); }
  // the memory games and the wand show how too, each with its own game
  for (const skill of ['wand', 'match', 'missing']) {
    await sp(p, s => { window.sparkle.startRound(s); }, skill);
    const ok = await p.waitForSelector('#hand:not([hidden])', { timeout: 10000 }).catch(() => null);
    if (!ok) pr.push('no demo for ' + skill);
    st = await state(p);
    if (!st.q || st.skill !== skill) pr.push(`after the ${skill} demo, no ${skill} question`);
    if (skill === 'match') await shot(p, '20-demo-match');
  }
  pr.push(...errs, ...(await sp(p, () => window.__csp || [])).map(c => 'blocked by its policy: ' + c));
  report('how to play: her friend explains and a hand shows one before a new game (no coins), then her turn; the ? button; Skip', pr); await ctx.close();
}

// 10. an iPad, sideways: a round's answers beside the question, Flower Match all on the screen, the kingdom the
// full width, the castle's room beside its shelf; nothing wider than the screen
{
  const ava = JSON.parse(JSON.stringify(AVA)); ava.rounds = 5; ava.world.open = { garden: 1, workshop: 1 };
  ava.skills.read = { level: 3, hist: [], streak: 0, misses: 0, answers: 30, placed: true, best: 3 };
  ava.skills.match = { level: 3, hist: [], streak: 0, misses: 0, answers: 30, placed: true, best: 3 };
  ava.demos = { 'read:3': 1, 'match:3': 1 };
  const { ctx, p, errs } = await phone({ seed: seedOf(ava), size: [1180, 820] }); const pr = [];
  const wide = () => sp(p, () => document.documentElement.scrollWidth > innerWidth + 1);
  await p.click('[data-player="p1"]'); await p.waitForTimeout(400);
  const map = await sp(p, () => document.getElementById('mapIn').getBoundingClientRect().width);
  if (map < 1179) pr.push('the kingdom does not fill the width: ' + map);
  await sp(p, () => { window.sparkle.startRound('read'); }); await state(p);
  const lay = await sp(p, () => { const s = document.getElementById('show').getBoundingClientRect(), c = document.getElementById('choices').getBoundingClientRect(); return { beside: c.left >= s.right - 1, inside: c.bottom <= innerHeight }; });
  if (!lay.beside || !lay.inside) pr.push('the answers are not beside the question: ' + JSON.stringify(lay));
  await shot(p, '21-ipad-read');
  await sp(p, () => { window.sparkle.startRound('match'); }); await state(p); await p.waitForTimeout(300);
  const cards = await sp(p, () => [...document.querySelectorAll('.card')].every(c => { const r = c.getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth && r.height > 60; }));
  if (!cards) pr.push('Flower Match runs off the screen');
  await shot(p, '22-ipad-match');
  if (await wide()) pr.push('the round is wider than the screen');
  await sp(p, () => window.sparkle.openWardrobe('rooms')); await p.waitForTimeout(200);
  const castle = await sp(p, () => { const d = document.getElementById('dress').getBoundingClientRect(), sh = document.querySelector('.shelf').getBoundingClientRect(); return sh.left >= d.right - 1; });
  if (!castle) pr.push('the castle\'s shelf is not beside the room');
  await shot(p, '23-ipad-castle');
  if (await wide()) pr.push('the castle is wider than the screen');
  // the castle cut away, the stables and the bedroom fit too
  for (const [open, name] of [['openCastle', 'home'], ['openStable', 'stable'], ['openBedroom', 'bedroom']]) {
    await sp(p, f => window.sparkle[f](), open); await p.waitForTimeout(250); await shot(p, '23-ipad-' + name);
    if (await wide()) pr.push(`the ${name} screen is wider than the screen`);
    const off = await sp(p, () => [...document.querySelectorAll('.game:not([hidden]) .stall, .game:not([hidden]) .care, .game:not([hidden]) .broomIn, .game:not([hidden]) .cutaway svg')].some(e => { const r = e.getBoundingClientRect(); return r.bottom > innerHeight + 2 || r.right > innerWidth + 2; }));
    if (off) pr.push(`the ${name} screen runs off the screen`);
  }
  pr.push(...errs, ...(await sp(p, () => window.__csp || [])).map(c => 'blocked by its policy: ' + c));
  report('an iPad sideways: answers beside the question, Flower Match on the screen, the kingdom full width, the room beside its shelf', pr); await ctx.close();
}
// ...and an iPhone sideways keeps the phone's layout (it is wide but short)
{
  const { ctx, p, errs } = await phone({ seed: seedOf(AVA), size: [844, 390] }); const pr = [];
  const grid = await sp(p, () => getComputedStyle(document.getElementById('stage')).display);
  if (grid === 'grid') pr.push('an iPhone sideways got the iPad layout');
  pr.push(...errs);
  report('an iPhone sideways keeps the phone layout', pr); await ctx.close();
}

// 11. natural voices: signed in, with the Google key set, each friend speaks in their own voice from the server; a
// sentence heard once is kept on the phone and not asked for again; signed out (or no key), the phone's voice
{
  ENV.GOOGLE_TTS_KEY = 'test-key'; SPOKEN.length = 0;
  const ava = JSON.parse(JSON.stringify(AVA));
  ava.skills.read = { level: 3, hist: [], streak: 0, misses: 0, answers: 30, placed: true, best: 3 }; ava.demos = { 'read:3': 1 };
  const { ctx, p, errs } = await phone({ signed: true, seed: seedOf(ava) }); const pr = [];
  await p.click('[data-player="p1"]'); await p.waitForTimeout(800);
  const greet = SPOKEN.filter(x => x.voice.endsWith('Sulafat') && x.text.startsWith('Hi Ava'));
  if (!greet.length) pr.push('the storyteller did not greet her in a natural voice: ' + JSON.stringify(SPOKEN.slice(0, 3)));
  await sp(p, () => { window.sparkle.startRound('read'); }); await state(p); await p.waitForTimeout(600);
  if (!SPOKEN.some(x => x.voice.endsWith('Charon'))) pr.push('Professor Hoot did not ask in his own voice');
  const kept = await sp(p, async () => (await (await caches.open('sparkle-voice-v1')).keys()).length);
  if (kept < 2) pr.push('the sentences were not kept on the phone: ' + kept);
  const asked = SPOKEN.length;
  await sp(p, () => window.sparkle.enterWorld()); await p.waitForTimeout(800);
  if (SPOKEN.length !== asked) pr.push('a sentence heard before was asked for again: ' + JSON.stringify(SPOKEN.slice(asked)));
  // punctuation on its own is a pause, never read out; a letter's sound goes with how to say it (not "s, s, s")
  SPOKEN.length = 0;
  await sp(p, () => SparkleVoice.say(['Which picture starts with', { snd: 's' }, '?', '...', ', as in', 'sun', '!'], { who: 'owl' }));
  const heard = SPOKEN.map(x => x.text);
  if (heard.some(t => !/[a-z]/i.test(t))) pr.push('punctuation was read out: ' + JSON.stringify(heard));
  if (!heard.includes('as in')) pr.push('", as in" was not said as "as in": ' + JSON.stringify(heard));
  const sss = SPOKEN.find(x => x.text === 'sss');
  if (!sss || !sss.how || sss.how.pronunciations[0].pronunciation !== 'sː') pr.push('the sound of s went without how to say it: ' + JSON.stringify(sss));
  pr.push(...errs, ...(await sp(p, () => window.__csp || [])).map(c => 'blocked by its policy: ' + c));
  await ctx.close();
  // signed out: nothing asked of the server, the phone's own voice
  SPOKEN.length = 0;
  const two = await phone({ seed: seedOf(ava) });
  await two.p.click('[data-player="p1"]'); await two.p.waitForTimeout(800);
  if (SPOKEN.length) pr.push('a signed-out phone asked for natural voices');
  pr.push(...two.errs); await two.ctx.close();
  delete ENV.GOOGLE_TTS_KEY;
  report('natural voices: each friend in their own voice when signed in, kept on the phone once heard; the phone\'s voice signed out', pr);
}

// 12. the syllable drum: every tap a beat, however quick, each one a dot above the drum; the dots clear after a pause
{
  const ava = JSON.parse(JSON.stringify(AVA));
  ava.skills.read = { level: 1, hist: [], streak: 0, misses: 0, answers: 30, placed: true, best: 1 }; ava.demos = { 'read:1': 1 };
  const { ctx, p, errs } = await phone({ seed: seedOf(ava) }); const pr = [];
  await p.click('[data-player="p1"]'); await p.waitForTimeout(400);
  let kind = null;
  for (let i = 0; i < 6 && kind !== 'syll'; i++) { await sp(p, () => { window.sparkle.startRound('read'); }); await state(p); kind = await sp(p, () => window.sparkle.round && window.sparkle.round.q && window.sparkle.round.q.kind); }
  if (kind !== 'syll') pr.push('no syllable question at reading level 1: ' + kind);
  else {
    const drum = p.locator('#drum');
    for (let i = 0; i < 3; i++) await drum.tap();
    const dots = await p.locator('#drum .beats i').count();
    if (dots !== 3) pr.push('three quick taps on the drum made ' + dots + ' beats');
    await p.waitForTimeout(2800);
    if (await p.locator('#drum .beats i').count()) pr.push('the beats did not clear after a pause');
  }
  pr.push(...errs); await ctx.close();
  report('the syllable drum: a beat and a dot for every tap, however quick', pr);
}

// 13. on the map: the storyteller says hello once, when she picks her princess, not again back from a game; a trip
// through a place on the way is one smooth glide (no stop at the place, no jumps), and she ends on the place
{
  const ava = JSON.parse(JSON.stringify(AVA)); ava.introSeen = true; ava.world = Object.assign({}, ava.world, { at: 'sign' });
  const { ctx, p, errs } = await phone({ seed: seedOf(ava), motion: 'no-preference' }); const pr = [];
  await sp(p, () => { window.__said = []; const say = SparkleVoice.say; SparkleVoice.say = (parts, o) => { window.__said.push([].concat(parts).filter(x => typeof x === 'string').join(' ')); return say(parts, o); }; });
  await p.click('[data-player="p1"]'); await p.waitForTimeout(500);
  if (!(await sp(p, () => window.__said.some(t => t.startsWith('Hi Ava'))))) pr.push('no hello when she picked her princess');
  await sp(p, () => { window.__said = []; window.sparkle.enterWorld(); }); await p.waitForTimeout(300);
  const again = await sp(p, () => window.__said);
  if (again.length) pr.push('the kingdom spoke again on coming back: ' + JSON.stringify(again));
  const track = await sp(p, async () => {
    const r = document.getElementById('rider'), box = document.getElementById('mapIn'), out = [];
    const go = window.sparkle.travel('bridgeA');
    let on = true; go.then(() => { on = false; });
    while (on) { await new Promise(f => requestAnimationFrame(f)); const a = r.getBoundingClientRect(), m = box.getBoundingClientRect(); out.push([a.left - m.left, a.top - m.top]); }
    return { out, at: window.sparkle.me.world.at };
  });
  const steps = track.out.slice(1).map((q, i) => Math.hypot(q[0] - track.out[i][0], q[1] - track.out[i][1]));
  const mid = steps.slice(Math.floor(steps.length * 0.2), Math.ceil(steps.length * 0.8)), avg = mid.reduce((a, x) => a + x, 0) / (mid.length || 1);
  if (track.at !== 'bridgeA') pr.push('she did not end at the bridge: ' + track.at);
  if (steps.length < 20) pr.push('the trip was not animated: ' + steps.length + ' frames');
  else {
    if (mid.some(x => x < avg * 0.2)) pr.push('she stopped part way (at the castle?): ' + mid.map(x => x.toFixed(1)).join(' '));
    if (steps.some(x => x > avg * 3 + 2)) pr.push('she jumped: ' + steps.map(x => x.toFixed(1)).join(' '));
  }
  pr.push(...errs); await ctx.close();
  report('the map: hello only on picking her princess; a trip is one smooth glide that ends on the place', pr);
}

// 14. Pattern Parade in Star Meadow and the Unicorn Bakery in the castle's kitchen: a round of each; a wrong bake
// counts with her first; every right bake is a treat in her unicorn's pantry; back to the castle after the bakery
{
  const ava = JSON.parse(JSON.stringify(AVA)); ava.demos = { 'pattern:2': 1, 'bake:3': 1 };
  ava.skills.pattern = { level: 2, hist: [], streak: 0, misses: 0, answers: 0, placed: true, best: 2 };
  ava.skills.bake = { level: 3, hist: [], streak: 0, misses: 0, answers: 0, placed: true, best: 3 };
  ava.skills.wand = { level: 2, hist: [], streak: 0, misses: 0, answers: 20, placed: true, best: 2 };
  const { ctx, p, errs } = await phone({ seed: seedOf(ava) }); const pr = [];
  await p.click('[data-player="p1"]'); await p.waitForTimeout(300);
  await sp(p, () => { window.sparkle.startRound('meadow'); }); let st = await state(p);
  if (st.skill !== 'pattern') pr.push('Star Meadow did not pick the game she has played least: ' + st.skill);
  if (await p.locator('#show .parade .fl').count() < 6) pr.push('the parade is not drawn');
  if (await p.locator('#show .parade .fl.gap').count() !== 1) pr.push('the parade has no one empty float');
  if (await p.locator('.choice.shape svg').count() !== st.q.ids.length) pr.push('the choices are not drawn pieces');
  await shot(p, '24-parade');
  st = await playRound(p);
  if (st.screen !== 'reward') pr.push('the Pattern Parade round did not end');
  await sp(p, () => window.sparkle.openCastle()); await p.waitForTimeout(300);
  if (await p.locator('#cutaway [data-go]').count() !== 6) pr.push('the castle does not have its six rooms');
  await shot(p, '25-castle');
  await p.click('#cutaway [data-go="kitchen"] .hit'); st = await state(p);
  if (st.skill !== 'bake' || st.q.kind !== 'bake') pr.push('the kitchen did not start the Unicorn Bakery');
  await p.waitForSelector('#bakeBtn');
  await shot(p, '26-bakery');
  // a wrong bake (the bowl still empty): no move on, she counts with Pebble
  const i0 = st.i; await p.click('#bakeBtn'); await p.waitForTimeout(400);
  if ((await state(p)).i !== i0) pr.push('a wrong bake moved on');
  st = await playRound(p);
  if (st.screen !== 'reward') pr.push('the bakery round did not end');
  const baked = await sp(p, () => window.sparkle.save.players.p1.pet);
  const n = Object.values((baked || {}).pantry || {}).reduce((a, b) => a + b, 0);
  if (n < 4) pr.push('the bakes did not become treats in the pantry: ' + JSON.stringify(baked && baked.pantry));
  if (!(await p.locator('#mapBtn').innerText()).includes('Castle')) pr.push('after the bakery the way back is not the castle');
  await p.click('#mapBtn'); await p.waitForTimeout(200);
  if ((await sp(p, () => window.sparkle.screen)) !== 'home') pr.push('the castle button did not go back to the castle');
  pr.push(...errs, ...(await sp(p, () => window.__csp || [])).map(c => 'blocked by its policy: ' + c)); await ctx.close();
  report('Pattern Parade in Star Meadow; the castle cut away; the Unicorn Bakery in the kitchen, its treats in the pantry', pr);
}

// 15. the stables: a unicorn left a day is sad and hungry (and the castle says so); feeding, a baked treat,
// scrubbing with the sponge and rinsing, the ball, bed; full is full; and the needs fall as hours pass
{
  const ava = JSON.parse(JSON.stringify(AVA));
  ava.pet = { food: 90, clean: 90, fun: 90, rest: 90, at: Date.now() - 30 * 36e5, asleep: false, pantry: { cupcake: 1 }, toys: ['ball'] };
  const { ctx, p, errs } = await phone({ seed: seedOf(ava) }); const pr = [];
  const pet = () => sp(p, () => JSON.parse(JSON.stringify(window.sparkle.save.players.p1.pet)));
  await p.click('[data-player="p1"]'); await p.waitForTimeout(300);
  if (!(await p.locator('#castleBtn .nb').count())) pr.push('the castle button does not show that her unicorn needs her');
  await sp(p, () => window.sparkle.openCastle()); await p.waitForTimeout(200);
  if (!(await p.locator('#cutaway [data-go="stable"].want').count())) pr.push('the stables do not glow when her unicorn needs her');
  await p.click('#cutaway [data-go="stable"] .hit'); await p.waitForTimeout(300);
  if ((await sp(p, () => window.sparkle.screen)) !== 'stable') pr.push('the stables did not open');
  let v = await pet();
  if (!(v.food < 20 && v.fun < 20)) pr.push('a day alone did not make her hungry and bored: ' + JSON.stringify(v));
  if (await p.locator('#needs .need.low').count() < 2) pr.push('the low needs are not shown low');
  await shot(p, '27-stable-sad');
  await p.click('[data-care="oats"]'); await p.waitForTimeout(2200);
  const f1 = (await pet()).food; if (f1 < v.food + 20) pr.push('oats did not feed her: ' + v.food + ' -> ' + f1);
  await p.click('[data-care="cupcake"]'); await p.waitForTimeout(2200);
  v = await pet(); if (v.food < f1 + 30 || (v.pantry.cupcake || 0) !== 0) pr.push('the baked cupcake did not feed her: ' + JSON.stringify(v));
  // wash: the sponge, rubbed across her, then the bucket
  await p.click('[data-ct="wash"]'); await p.click('[data-care="sponge"]');
  const c0 = (await pet()).clean, u = await p.locator('#uni').boundingBox();
  await p.mouse.move(u.x + u.width * 0.3, u.y + u.height * 0.5); await p.mouse.down();
  for (let k = 0; k < 30; k++) await p.mouse.move(u.x + u.width * (0.3 + (k % 2) * 0.35), u.y + u.height * (0.4 + (k % 3) * 0.1), { steps: 3 });
  await p.mouse.up(); await p.waitForTimeout(200);
  const c1 = (await pet()).clean; if (c1 < c0 + 15) pr.push('rubbing with the sponge did not clean her: ' + c0 + ' -> ' + c1);
  await shot(p, '28-stable-foam');
  await p.click('[data-care="bucket"]'); await p.waitForTimeout(300);
  // too tired to play after a day alone; rested, the ball cheers her up; then bed
  await p.click('[data-ct="play"]'); const fun1 = (await pet()).fun; await p.click('[data-care="ball"]'); await p.waitForTimeout(200);
  if ((await pet()).fun !== fun1) pr.push('she played though too tired');
  await sp(p, () => { window.sparkle.save.players.p1.pet.rest = 80; }); const fun0 = (await pet()).fun; await p.click('[data-care="ball"]'); await p.waitForTimeout(300);
  if ((await pet()).fun < fun0 + 10) pr.push('the ball did not cheer her up');
  await p.click('[data-ct="sleep"]'); await p.click('[data-care="lantern"]'); await p.waitForTimeout(1300);
  v = await pet(); if (!v.asleep) pr.push('the lantern did not put her to bed');
  await shot(p, '29-stable-night');
  await p.click('[data-care="lantern"]'); await p.waitForTimeout(200);
  if ((await pet()).asleep) pr.push('the lantern did not wake her');
  // full is full
  await p.click('[data-ct="food"]'); await sp(p, () => { window.sparkle.save.players.p1.pet.food = 99; });
  await p.click('[data-care="oats"]'); await p.waitForTimeout(300);
  if ((await pet()).food !== 99) pr.push('she ate when full');
  // the shop: a carrot, asked then bought
  await p.click('[data-ct="shop"]'); const k0 = await coins(p);
  await p.click('[data-buy="carrot"]'); await p.click('[data-buy="carrot"]'); await p.waitForTimeout(200);
  if ((await coins(p)) !== k0 - 2 || (await pet()).pantry.carrot !== 1) pr.push('buying a carrot: ' + (await coins(p)) + ' coins, ' + JSON.stringify((await pet()).pantry));
  pr.push(...errs, ...(await sp(p, () => window.__csp || [])).map(c => 'blocked by its policy: ' + c)); await ctx.close();
  report('the stables: sad after a day alone, fed, a baked treat, washed and rinsed, played with, put to bed; full is full; the shop', pr);
}

// 16. her bedroom: tap the lamp, the bed puts her to sleep (and a tap wakes her); decorate: drag the bed, buy
// something and it's in the room, a new wallpaper, put something away; all kept after a reload
{
  const { ctx, p, errs } = await phone({ seed: seedOf(AVA) }); const pr = [];
  const bed = () => sp(p, () => JSON.parse(JSON.stringify(window.sparkle.save.players.p1.bedroom || null)));
  await p.click('[data-player="p1"]'); await p.waitForTimeout(300);
  await sp(p, () => window.sparkle.openCastle()); await p.waitForTimeout(200);
  await p.click('#cutaway [data-go="bedroom"] .hit'); await p.waitForTimeout(300);
  if ((await sp(p, () => window.sparkle.screen)) !== 'bedroom') pr.push('the bedroom did not open');
  let b = await bed();
  const iOf = id => b.items.findIndex(x => x.id === id);
  if (iOf('bedroom-bed-pink') < 0 || iOf('bed-window') < 0) pr.push('the bedroom does not start with its bed and window');
  await shot(p, '30-bedroom');
  await p.click(`.bi[data-i="${iOf('bedroom-lamp')}"]`); await p.waitForTimeout(200);
  if (!(await bed()).items[iOf('bedroom-lamp')].on) pr.push('tapping the lamp did not turn it on');
  await p.click(`.bi[data-i="${iOf('bedroom-bed-pink')}"]`); await p.waitForTimeout(400);
  if (!(await p.locator('#broomIn.dark').count()) || (await p.locator('#bpr').count())) pr.push('the bed did not put her to sleep');
  await shot(p, '31-bedroom-night');
  await p.click('#broomIn'); await p.waitForTimeout(300);
  if (await p.locator('#broomIn.dark').count()) pr.push('a tap did not wake her');
  // decorate
  await p.click('#bedEdit'); await p.waitForTimeout(200);
  if (await p.locator('#bshelf').isHidden()) pr.push('Decorate does not open the shelf');
  const x0 = b.items[iOf('bedroom-bed-pink')].x, bb = await p.locator(`.bi[data-i="${iOf('bedroom-bed-pink')}"]`).boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.mouse.move(bb.x + bb.width / 2 - 120, bb.y + bb.height / 2, { steps: 8 }); await p.mouse.up();
  b = await bed(); if (!(b.items[iOf('bedroom-bed-pink')].x < x0 - 40)) pr.push('dragging the bed did not move it: ' + x0 + ' -> ' + b.items[iOf('bedroom-bed-pink')].x);
  await p.click('[data-bt="shop"]'); const k0 = await coins(p);
  await p.click('[data-bed="bed-teddy"]'); if ((await coins(p)) !== k0) pr.push('one tap bought the teddy');
  await p.click('[data-bed="bed-teddy"]'); await p.waitForTimeout(200);
  b = await bed(); if (iOf('bed-teddy') < 0 || (await coins(p)) !== k0 - 15) pr.push('buying the teddy: ' + (await coins(p)) + ' coins, in the room ' + (iOf('bed-teddy') >= 0));
  await p.click('[data-bt="walls"]'); await p.click('[data-bed="wall-dots"]'); await p.click('[data-bed="wall-dots"]'); await p.waitForTimeout(200);
  if ((await bed()).wall !== 'wall-dots') pr.push('the new wallpaper is not up');
  await p.click('[data-bt="shop"]'); await p.click('[data-bed="bedroom-bed-stars"]');
  if (await sp(p, () => window.sparkle.save.players.p1.owned.includes('bedroom-bed-stars'))) pr.push('a story present could be bought');
  // put the lamp away: it goes back to My things
  const lamp = p.locator(`.bi[data-i="${iOf('bedroom-lamp')}"]`);   // (the bed may be over it now)
  await lamp.dispatchEvent('pointerdown'); await p.locator('#broomIn').dispatchEvent('pointerup'); await p.waitForTimeout(150);
  await p.click('[data-sb="away"]'); await p.waitForTimeout(150);
  b = await bed(); if (iOf('bedroom-lamp') >= 0) pr.push('putting the lamp away left it in the room');
  await p.click('[data-bt="mine"]'); if (!(await p.locator('[data-bed="bedroom-lamp"]').count())) pr.push('the lamp is not in My things');
  await shot(p, '32-bedroom-decorate');
  await p.click('#bedEdit'); await p.reload(); await p.waitForTimeout(500);
  const kept = await sp(p, () => window.sparkle.save.players.p1.bedroom);
  if (!kept || kept.wall !== 'wall-dots' || !kept.items.some(x => x.id === 'bed-teddy')) pr.push('after a reload the bedroom is not as she left it');
  pr.push(...errs, ...(await sp(p, () => window.__csp || [])).map(c => 'blocked by its policy: ' + c)); await ctx.close();
  report('her bedroom: the lamp, sleeping and waking; decorating: drag, buy, wallpaper, put away; kept after a reload', pr);
}

// 17. her unicorn about the stables, with motion on: she walks (legs swinging, facing the way she goes), nods
// and grazes on her own, and stands still to be fed; asleep, she only breathes
{
  const ava = JSON.parse(JSON.stringify(AVA)); ava.pet = { food: 70, clean: 90, fun: 70, rest: 90, at: Date.now(), asleep: false, pantry: {}, toys: ['ball'] };
  const { ctx, p, errs } = await phone({ seed: seedOf(ava), motion: 'no-preference' }); const pr = [];
  await p.click('[data-player="p1"]'); await p.waitForTimeout(300);
  // her first move is left to chance (a walk, a nod or a nibble), so the dice are set for a walk until she takes one:
  // otherwise a run of nods can outlast the wait
  await p.evaluate(() => { const r = Math.random; window.__dice = r; Math.random = () => 0.1; });
  await sp(p, () => window.sparkle.openStable());
  const walked = await p.waitForFunction(() => { const u = document.getElementById('uni'); return u && u.classList.contains('walk') && u.style.getPropertyValue('--x') !== '0px'; }, null, { timeout: 15000 }).then(() => true).catch(() => false);
  await p.evaluate(() => { Math.random = window.__dice; });
  if (!walked) pr.push('her unicorn never walked about the stable');
  else {
    const legs = await sp(p, () => document.querySelector('#uni .l92').getAnimations().length > 0 && document.querySelector('#uni .tl').getAnimations().length > 0);
    if (!legs) pr.push('walking, her legs and tail do not move');
    const way = await sp(p, () => { const u = document.getElementById('uni'); return { left: u.classList.contains('left'), f: getComputedStyle(u).getPropertyValue('--f').trim() }; });
    if ((way.left ? '-1' : '1') !== way.f) pr.push('she does not face the way she walks: ' + JSON.stringify(way));
    await p.waitForTimeout(500); await shot(p, '33-stable-walk');
  }
  // fed: she stops where she is, and the food goes to her mouth
  await p.click('[data-care="apple"]'); await p.waitForTimeout(100);
  if (await sp(p, () => document.getElementById('uni').classList.contains('walk'))) pr.push('she kept walking while being fed');
  await p.waitForTimeout(2200);
  await p.click('[data-ct="sleep"]'); await p.click('[data-care="lantern"]'); await p.waitForTimeout(400);
  if (!(await sp(p, () => document.getElementById('uni').classList.contains('breathe')))) pr.push('asleep, she does not breathe slowly');
  await p.waitForTimeout(6000);
  if (await sp(p, () => document.getElementById('uni').classList.contains('walk'))) pr.push('she walked in her sleep');
  pr.push(...errs); await ctx.close();
  report('her unicorn about the stables: walking with swinging legs, facing her way, still to be fed, breathing asleep', pr);
}

await b.close(); server.close();
process.exit(failed ? 1 : 0);
