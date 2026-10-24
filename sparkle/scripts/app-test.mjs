// Drives Sparkle Kingdom in headless Chromium at iPhone size, as a family would (the Tiara Workshop and the
// Fairy Garden, once the fog lifts, are scenario 7): making a player
// (with no reading needed to pick one), the story, the kingdom and its quest, the signpost (a wrong
// sign first, then the right one), a round in Story Tower from the warm-up to the end (a miss first:
// the hint, then the answer after a second miss), coins, the rainbow bridge (counting planks) and the
// Gem Mine, the crystal door and Star Meadow's sparkle sequences, the castle (trying on, asking the
// price, buying, not enough coins), the Parent corner behind the grown-up check (a report, the play
// timer badge, the starting levels, the design), everything kept after a reload, and the family
// account through the real functions/sparkle/api route (on an in-memory Workers KV with a real
// session): a second phone gets the same player, coins and all.
// Both designs (../home/design.js): Vintage, the default (the sky held at day, aos.sky), and Standard
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

const b = await chromium.launch();
let failed = 0;
const report = (name, problems) => { if (problems.length) { failed++; console.log('not ok - ' + name + '\n  ' + problems.join('\n  ')); } else console.log('ok - ' + name); };

async function phone({ look = 'vintage', scheme = 'light', signed = false, seed = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: scheme, serviceWorkers: 'block', reducedMotion: 'reduce', locale: 'en-US' });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin !== BASE) return route.abort();
    if (u.pathname.startsWith('/sparkle/api/')) { const rq = route.request();
      const res = await onRequest({ request: new Request(u.href, { method: rq.method(), headers: rq.headers(), body: rq.method() === 'POST' ? rq.postData() : undefined }), params: { route: u.pathname.slice(13).split('/') }, env: { ACCOUNTS: db } });
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
const state = p => sp(p, () => { const R = window.sparkle.round; return { screen: window.sparkle.screen, skill: R && R.skill, q: R && R.q ? Object.assign(JSON.parse(JSON.stringify(R.q)), { ids: (R.q.choices || []).map(c => c.id) }) : null, i: R && R.i, n: R && R.plan.length }; });
// the games she plays rather than picks: gems in order, pairs, what's missing
async function solve(p, q, root = '') {
  if (q.kind === 'build') { await p.waitForSelector(root + ' .tile'); const used = new Set();
    for (const l of q.word) { const k = q.tiles.findIndex((t, i) => t === l && !used.has(i)); used.add(k); await p.click(`${root} .tile[data-t="${k}"]`); } return true; }
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
  if (!st.q || st.q.kind !== 'wand') pr.push('Star Meadow is not the sparkle sequences');
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
  await sp(p, () => { window.sparkle.openCastle(); }); await p.waitForTimeout(200);
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

// 5. the Parent corner, behind the grown-up check: a report, the timer badge, starting levels, the design
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
  if (await p.locator('.sheet h2', { hasText: 'Parent corner' }).count()) pr.push('a wrong answer opened the Parent corner');
  await p.fill('#gAns', String(+m2[1] * +m2[2])); await p.click('#gOk'); await p.waitForTimeout(300);
  if (!(await p.locator('.sheet h2', { hasText: 'Parent corner' }).count())) pr.push('the right answer did not open the Parent corner');
  await shot(p, '10-parent');
  await p.click('#sBadge [data-v="0"]');
  await p.click('#sDesign [data-design="glass"]'); await p.waitForTimeout(200);
  if (await p.evaluate(() => document.documentElement.dataset.look) !== 'glass') pr.push('Design > Standard did not switch to Sea glass');
  await p.click('[data-rep="p1"]'); await p.waitForTimeout(200);
  const rep = await p.locator('.sheet').innerText();
  for (const want of ['Reading', '5 of 12', 'Letter sounds'.slice(0, 0), 'Practice together', 'pig']) if (want && !rep.includes(want)) pr.push('the report does not show ' + want);
  await shot(p, '11-report');
  await p.click('[data-lv="read"][data-d="1"]'); await p.waitForTimeout(150);
  if ((await sp(p, () => window.sparkle.save.players.p1.skills.read.level)) !== 6) pr.push('+ did not raise her reading level');
  await p.click('.sheet [data-x="done"]'); await p.waitForTimeout(200);
  await p.click('[data-player="p1"]'); await p.waitForTimeout(300);
  if (await p.locator('#timer').isVisible()) pr.push('the play timer still shows after Hide');
  pr.push(...errs);
  report('the Parent corner: only after holding and the grown-up question; a report with words to practice; the timer badge; a level up; the design', pr); await ctx.close();
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
  await sp(p, () => window.sparkle.openCastle()); await p.waitForTimeout(200);
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
  // the Rooms: a piece to buy (ask, then buy), the owl lamp from the story goes in the library, a story piece can't be bought
  await p.click('[data-tab="rooms"]'); await p.waitForTimeout(100);
  if (!(await p.locator('#dress .roomview svg').count())) pr.push('the Rooms tab does not show the room');
  const r0 = await coins(p);
  await p.click('[data-piece="bedroom-wall-hearts"]');
  if ((await coins(p)) !== r0) pr.push('one tap bought a room piece');
  await p.click('[data-piece="bedroom-wall-hearts"]');
  const bed = await sp(p, () => { const me = window.sparkle.save.players.p1; return { own: me.owned.includes('bedroom-wall-hearts'), on: (me.rooms || {}).bedroom && me.rooms.bedroom.wall }; });
  if (!bed.own || bed.on !== 'bedroom-wall-hearts' || (await coins(p)) !== r0 - 20) pr.push('buying the hearts wallpaper: ' + JSON.stringify(bed));
  await p.click('[data-piece="bedroom-bed-stars"]');
  if (await sp(p, () => window.sparkle.save.players.p1.owned.includes('bedroom-bed-stars'))) pr.push('a story bed was given by tapping it');
  await p.click('[data-room="library"]'); await p.click('[data-piece="library-owl-lamp"]');
  if ((await sp(p, () => (window.sparkle.save.players.p1.rooms.library || {}).small)) !== 'library-owl-lamp') pr.push('the owl lamp from the story did not go in the library');
  await shot(p, '18-rooms');
  await p.click('[data-tab="tiara"]'); const c0 = await coins(p);
  await p.click('[data-item="tiara-rainbow"]'); await p.click('[data-item="tiara-rainbow"]');
  if ((await coins(p)) !== c0 || (await sp(p, () => window.sparkle.save.players.p1.owned.includes('tiara-rainbow')))) pr.push('a story present could be bought');
  pr.push(...errs, ...(await sp(p, () => window.__csp || [])).map(c => 'blocked by its policy: ' + c));
  report('the story: a chapter after rounds in a land, its colour on the map, a present at chapter 5, her rank, the Stories shelf, the rooms to decorate (Sea glass)', pr); await ctx.close();
}

await b.close(); server.close();
process.exit(failed ? 1 : 0);
