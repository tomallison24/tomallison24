// Drives Ipsy (home/ipsy.js with news/ipsy-tools.js) in News, in both its designs, light and dark, in
// headless Chromium, against made-up headlines, a stand-in ESPN (scores-fixture.mjs, the real Premier
// League table in fixtures/), a stand-in summaries route and a stand-in for Claude at /news/api/ipsy
// (no network, no keys). Checks: Ipsy floats bottom left and covers none of News' controls (the topic
// picker, Refresh, Settings, the Undo toast, the end of the list); asking once before the first
// question; the chat running the tools Claude asks for on the app's own data (finding a story,
// summarizing it through the summaries route, showing it in its list; a team's scores, the table, a
// match page opened behind the chat and kept dimmed when the chat closes; following teams, the one-tap
// team and Stem cells' filters), each change with an Undo that works; web searches and sources shown;
// the conversation only ever added to; a failed question taken back out; the chat kept when the app
// opens again; Ipsy changing with the design at once; no script errors and nothing blocked by the
// page's Content Security Policy. Screenshots go to the folder given as the second argument.
//
// Needs Playwright with Chromium (npm i -g playwright):
//   node news/scripts/ipsy-test.mjs [repo root] [screenshot dir]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { espnFor, snapshot } from './scores-fixture.mjs';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const SHOTS = process.argv[3] || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const HERE = path.dirname(new URL(import.meta.url).pathname);
const STANDINGS = fs.readFileSync(path.join(HERE, 'fixtures/espn-eng1-standings.json'), 'utf8');
const SUMMARY = fs.readFileSync(path.join(HERE, 'fixtures/espn-eng1-summary-live.json'), 'utf8');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;

// ---- made-up headlines (every story is invented), dated from now so any day works ----
const LIBRARY = 'https://news.example/uk/library-vote';
function newsJson() {
  const ago = h => new Date(Date.now() - h * 36e5).toISOString();
  const s = (id, topic, source, title, h, summary = '') => ({ id, topic, source, title, url: 'https://news.example/' + topic + '/' + id, published: ago(h), image: null, summary });
  return {
    generatedAt: ago(0.1),
    feeds: [{ source: 'BBC News', topic: 'uk', ok: true }, { source: 'Nature', topic: 'stemcells', ok: true }],
    topics: [{ id: 'uk', label: 'UK' }, { id: 'world', label: 'World' }, { id: 'sport', label: 'Sport' }, { id: 'stemcells', label: 'Stem cells', filters: true, newTag: true }],
    stories: [
      { ...s('u1', 'uk', 'BBC News', 'Council votes to reopen the library', 0.5, 'Councillors voted seven to two to reopen it after repairs.'), url: LIBRARY },
      s('u2', 'uk', 'The Guardian', 'Rail strike called off after late talks', 2),
      ...Array.from({ length: 12 }, (_, i) => s('u' + (i + 3), 'uk', i % 2 ? 'Sky News' : 'BBC News', 'A quieter story from around the country, number ' + (i + 1), 3 + i)),
      s('w1', 'world', 'NPR', 'Summit ends with a trade deal', 3),
      { ...s('s1', 'sport', 'BBC Sport', 'Liverpool edge a thriller at Anfield', 1), url: 'https://news.example/sport/football/s1' },
      { ...s('s2', 'sport', 'BBC Sport', 'Northampton name their side for Saturday', 2), url: 'https://news.example/sport/rugby-union/s2' },
      s('c1', 'stemcells', 'Nature', 'Organoids grown from stem cells repair a gut', 1),
      s('c2', 'stemcells', 'Cell Stem Cell', 'A faster iPSC protocol', 5),
    ],
  };
}

// ---- the stand-in for Claude: answers each step from where the conversation is ----
const resultOf = (msgs, name) => {
  for (let i = msgs.length - 1; i > 0; i--) {
    const m = msgs[i]; if (m.role !== 'user' || !Array.isArray(m.content)) continue;
    for (const r of m.content) if (r.type === 'tool_result') {
      const use = msgs[i - 1].content.find(b => b.type === 'tool_use' && b.id === r.tool_use_id);
      if (use && use.name === name) return { use, r, json: (() => { try { return JSON.parse(r.content); } catch { return null; } })() };
    }
  }
  return null;
};
let uid = 0;
const tu = (name, input) => ({ type: 'tool_use', id: 'toolu_' + (++uid), name, input });
const think = { type: 'thinking', thinking: '', signature: 'sig-' + 'x'.repeat(20) };
const said = (text, extra = []) => ({ json: { stop_reason: 'end_turn', content: [...extra, { type: 'text', text }] } });
function claude(msgs) {
  const qs = msgs.filter(m => m.role === 'user' && m.content.some(b => b.type === 'text' && !b.text.startsWith('[From the app')));
  const question = qs.length ? qs[qs.length - 1].content.filter(b => b.type === 'text' && !b.text.startsWith('[From the app')).map(b => b.text).join(' ') : '';
  const last = msgs[msgs.length - 1];
  const fresh = last.role === 'user' && last.content.some(b => b.type === 'text');
  if (/limit please/.test(question)) return { status: 429, json: { error: 'limit' } };
  if (/library/.test(question)) {
    if (fresh) return { json: { stop_reason: 'tool_use', content: [think, { type: 'text', text: 'Let me look.' }, tu('find_stories', { query: 'library vote' })] } };
    if (!resultOf(msgs, 'summarize_story')) {
      const id = resultOf(msgs, 'find_stories').json.stories[0].id;
      return { json: { stop_reason: 'tool_use', content: [tu('summarize_story', { id }), tu('show_story', { id })] } };
    }
    return { json: { stop_reason: 'end_turn', content: [
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'library reopening date' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result', url: 'https://council.example/library', title: 'Library news', encrypted_content: 'enc', page_age: null }] },
      { type: 'text', text: '**BBC News** reports the council voted to reopen the library. I searched the web too: it reopens in spring' },
      { type: 'text', text: ', and the work starts next month.', citations: [{ type: 'web_search_result_location', url: 'https://council.example/library', title: 'Library news', cited_text: 'spring', encrypted_index: 'x' }] },
    ] } };
  }
  if (/Liverpool/.test(question)) {
    if (fresh) return { json: { stop_reason: 'tool_use', content: [tu('sport_scores', { team: 'Liverpool' }), tu('league_table', { league: 'Premier League' })] } };
    if (!resultOf(msgs, 'show_sport')) {
      const g = resultOf(msgs, 'sport_scores').json.leagues.find(l => l.league === 'eng.1').today.find(x => x.state === 'live');
      return { json: { stop_reason: 'tool_use', content: [tu('show_sport', { game_id: g.id })] } };
    }
    return said('**Liverpool 2-1 Arsenal**, still going. The match page is open.');
  }
  if (/follow/.test(question)) {
    if (fresh) return { json: { stop_reason: 'tool_use', content: [tu('find_sport_options', { query: 'arsenal' })] } };
    if (!resultOf(msgs, 'set_sport_filters')) {
      const id = resultOf(msgs, 'find_sport_options').json.matches[0].id;
      return { json: { stop_reason: 'tool_use', content: [tu('set_sport_filters', { follow: [id, 'Lewis Hamilton'] }), tu('set_my_team', { team: 'Northampton' })] } };
    }
    return said('Done: you follow **Arsenal** and Lewis Hamilton, and Sport shows Northampton.');
  }
  if (/stem cells/.test(question)) {
    if (fresh) return { json: { stop_reason: 'tool_use', content: [tu('set_story_filters', { topic: 'Stem cells', sources: ['nature'], days: 7 })] } };
    return said('Stem cells now shows only Nature, from the last 7 days.');
  }
  return said('Hello!');
}

const browser = await chromium.launch();
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n  ', e.message.split('\n').slice(0, 8).join('\n   ')); } };
const texts = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
const stored = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k)), k);
const overlap = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
const rect = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });

async function open(design, scheme, store = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, serviceWorkers: 'block', timezoneId: 'America/New_York', locale: 'en-US' });
  const sent = [], summarized = [];
  const cors = { 'access-control-allow-origin': '*' };
  await ctx.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    if (/^site(\.web)?\.api\.espn\.com$/.test(u.hostname)) {
      const m = /sports\/(.+)\/(scoreboard|standings|summary)/.exec(u.pathname);
      if (m && m[2] === 'scoreboard') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(espnFor(m[1])) });
      if (m && m[2] === 'standings' && m[1] === 'soccer/eng.1') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: STANDINGS });
      if (m && m[2] === 'summary') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: SUMMARY });
      return route.fulfill({ status: 404, headers: cors, body: '{}' });
    }
    if (u.origin !== BASE) return route.abort('internetdisconnected');
    if (/\/data\/news\.json$/.test(u.pathname)) return route.fulfill({ json: newsJson() });
    if (/\/data\/scores\.json$/.test(u.pathname)) return route.fulfill({ json: snapshot() });
    if (u.pathname === '/news/api/summarize') {
      assert.equal(req.headers()['x-news'], '1');
      summarized.push(JSON.parse(req.postData()).url);
      return route.fulfill({ json: { title: 'Council votes to reopen the library', source: 'BBC News', summary: 'The council voted to reopen the library. It had been shut for repairs.', takeaways: ['Seven to two', 'Repairs first'], basis: 'article', truncated: false, cached: false } });
    }
    if (u.pathname === '/news/api/ipsy') {
      const raw = req.postData();
      assert.ok(raw.startsWith('{"messages":'), 'the phone sends exactly {"messages":[...]}');
      assert.equal(req.headers()['x-news'], '1');
      const msgs = JSON.parse(raw).messages;
      sent.push(msgs);
      const a = claude(msgs);
      return route.fulfill({ status: a.status || 200, json: a.json.content ? { id: 'msg_' + sent.length, type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', ...a.json } : a.json });
    }
    if (u.pathname.includes('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"off"}' });
    return route.continue();
  });
  await ctx.addInitScript(([design, store]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('aos.helper', '{"who":"mia","name":""}'); localStorage.setItem('aos.seen', JSON.stringify({ news: '999' }));
    localStorage.setItem('aos.sky', 'day');
    localStorage.setItem('design.news', design);
    for (const [k, v] of Object.entries(store)) localStorage.setItem(k, JSON.stringify(v));
  }, [design, store]);
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|404|429|503/.test(m.text())) problems.push(m.text()); });
  page.on('console', m => { if (m.type() === 'warning' && /Ipsy/.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', e => problems.push(String(e)));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { window.__csp = (window.__csp || []).concat(e.violatedDirective + ' ' + e.blockedURI); }));
  await page.goto(BASE + '/news/');
  await page.waitForSelector('.ipsy-btn');
  await page.waitForSelector('#feed .row, #feed .sect');
  return { ctx, page, sent, summarized, problems };
}

// ---- Ipsy covers none of News' controls, in each design, light and dark ----
for (const design of ['vintage', 'glass']) for (const scheme of ['light', 'dark']) {
  const tag = 'news (' + design + ', ' + scheme + ')';
  await step(tag + ': Ipsy floats bottom left, wearing the design, and covers no control', async () => {
    const { ctx, page, problems } = await open(design, scheme, { 'news.topic': 'sport', 'news.sport.mode': 'news', 'news.sport.picks': ['team:football:liverpool'] });
    assert.equal(await page.$eval('.ipsy-btn', (e, d) => e.classList.contains('ipsy-' + d), design), true);
    const me = await rect(page, '.ipsy-btn');
    assert.ok(me.left < 30 && me.bottom > 780, 'bottom left: ' + JSON.stringify(me));
    for (const sel of ['#viewBtn', '#refresh', '#setBtn', '.chip.pill']) assert.ok(!overlap(me, await rect(page, sel)), sel + ' is clear of Ipsy');
    // the Undo toast (Reset filters), over the topic picker
    await page.click('.chip.pill'); await page.click('[data-action="reset-picks"]');
    await page.waitForSelector('#toast:not([hidden])');
    assert.ok(!overlap(me, await rect(page, '#toast')), 'the Undo toast is clear of Ipsy');
    // the end of the longest list scrolls clear of it
    await page.click('#toast-undo');
    await page.click('#viewBtn'); await page.click('[data-topic="uk"]');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    for (const sel of ['#feed .row:last-of-type', '#feed .status']) assert.ok(!overlap(me, await rect(page, sel)), sel + ' scrolls clear of Ipsy');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, design + '-' + scheme + '-button.png') });
    // the chat's words read on its bubble: not the light fallbacks on a dark bubble
    await page.click('.ipsy-btn'); await page.waitForSelector('.ipsy-consent');
    const [ink, card] = await page.$eval('.ipsy-consent', e => [getComputedStyle(e.querySelector('p')).color, getComputedStyle(e).backgroundColor]);
    const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
    assert.ok(Math.abs(lum(ink) - lum(card)) > 0.4, 'the consent words read on their card: ' + ink + ' on ' + card);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, design + '-' + scheme + '-consent.png') });
    assert.deepEqual(problems, []);
    assert.equal(await page.evaluate(() => (window.__csp || []).join()), '');
    await ctx.close();
  });
}

// ---- the whole conversation, in two of them ----
for (const [design, scheme] of [['glass', 'light'], ['vintage', 'dark']]) {
  const tag = 'news (' + design + ', ' + scheme + ')';
  const { ctx, page, sent, summarized, problems } = await open(design, scheme);

  await step(tag + ': the chat asks once before the first question', async () => {
    await page.click('.ipsy-btn');
    await page.waitForSelector('.ipsy-bubble');
    assert.match(await page.textContent('.ipsy-consent'), /Anthropic.*Undo/);
    assert.equal(await page.$eval('#ipsyIn', e => e.disabled), true, 'nothing is sent before OK');
    await page.click('#ipsyOk');
    assert.equal(await page.$$eval('.ipsy-chip[data-ask]', e => e.length), 4);
    assert.equal(await page.evaluate(() => document.querySelector('.vbar') && getComputedStyle(document.querySelector('.vbar')).pointerEvents), 'none', 'the topic picker steps aside while the chat is open');
  });

  await step(tag + ': a story found in the headlines, summarized through the summaries route and shown in its list, with a web search', async () => {
    await page.fill('#ipsyIn', 'What happened with the library vote?');
    await page.press('#ipsyIn', 'Enter');
    await page.waitForFunction(() => /work starts next month/.test(document.querySelector('.ipsy-log').textContent) && !document.querySelector('.ipsy-send').disabled, null, { timeout: 15000 });
    const found = resultOf(sent[1], 'find_stories').json;
    assert.equal(found.found, 1); assert.equal(found.stories[0].title, 'Council votes to reopen the library'); assert.equal(found.stories[0].source, 'BBC News'); assert.equal(found.stories[0].topic, 'UK');
    const sum = resultOf(sent[2], 'summarize_story').json;
    assert.deepEqual(summarized, [LIBRARY], 'the summaries route, for the story’s own address');
    assert.equal(sum.summary, 'The council voted to reopen the library. It had been shut for repairs.'); assert.equal(sum.read, 'the whole article');
    assert.equal(resultOf(sent[2], 'show_story').json.tab, 'UK');
    assert.equal(await stored(page, 'news.topic'), 'uk', 'the UK tab is behind the chat');
    assert.equal(await page.$eval('.ipsy-spot', e => e.getAttribute('href')), LIBRARY, 'the story is marked');
    const acts = await texts(page, '.ipsy-act');
    for (const a of ['Looking through the headlines: library vote', 'Summarizing the story', 'Showing the story', 'Searching the web: library reopening date']) assert.ok(acts.includes(a), acts.join(' | '));
    assert.equal(await page.locator('.ipsy-it').last().locator('b').textContent(), 'BBC News');
    assert.deepEqual(await page.$$eval('.ipsy-src a', e => e.map(a => [a.textContent, a.href])), [['Library news', 'https://council.example/library']]);
    assert.equal(await page.$$eval('.ipsy-change', e => e.length), 0, 'reading changes nothing');
    assert.match(sent[0][0].content[0].text, /^\[From the app: today is \w+day, .* \(\d{4}-\d\d-\d\d\)\. News has 19 headlines, updated .*\. On screen: the Latest tab\.(?: You are this person’s helper[^\]]*)?\]$/);
    for (let i = 1; i < sent.length; i++) assert.deepEqual(sent[i].slice(0, sent[i - 1].length), sent[i - 1], 'step ' + i + ' changed an earlier message');
    assert.deepEqual(sent[1][1].content[0], think, 'thinking goes back unchanged');
  });
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, design + '-chat-' + scheme + '.png') });

  await step(tag + ': a team’s scores and the table from ESPN, and its match page opened behind the chat', async () => {
    const n0 = sent.length;
    await page.fill('#ipsyIn', 'How are Liverpool doing?');
    await page.click('#ipsySend');
    await page.waitForFunction(() => /match page is open/.test(document.querySelector('.ipsy-log').textContent), null, { timeout: 15000 });
    const st = sent.slice(n0);
    const sc = resultOf(st[1], 'sport_scores').json;
    assert.match(sc.source, /^ESPN/);
    const pl = sc.leagues.find(l => l.league === 'eng.1');
    assert.deepEqual(pl.today.map(g => [g.home, g.away, g.state, g.score || '']), [['Liverpool', 'Arsenal', 'live', '2-1']], 'only Liverpool’s games');
    assert.equal(pl.today[0].has_match_page, true); assert.equal(pl.today[0].watch_us, 'USA Network');
    assert.ok(pl.coming_up.every(g => /Liverpool/.test(g.home + g.away)) && pl.coming_up.length >= 1, 'Liverpool’s fixtures');
    assert.ok(sc.leagues.some(l => l.league === 'uefa.champions'), 'every league Liverpool play in');
    const tb = resultOf(st[1], 'league_table').json;
    assert.equal(tb.name, 'Premier League'); assert.deepEqual(tb.groups[0].columns.slice(0, 2), ['#', 'Team']);
    assert.equal(tb.groups[0].rows.length, 20); assert.equal(tb.groups[0].rows[0][1], 'Manchester City');
    assert.ok(await page.evaluate(() => !document.getElementById('match-sheet').hidden), 'the match page is open behind');
    assert.equal(await stored(page, 'news.topic'), 'sport');
    // put the chat away: the match page stays, the page behind it still dimmed and locked
    await page.click('.ipsy-speaker');
    await page.waitForFunction(() => document.querySelector('.ipsy-wrap').hidden);
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains('locked') && !document.getElementById('match-sheet').hidden));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, design + '-match-' + scheme + '.png') });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.documentElement.classList.contains('locked'));
  });

  await step(tag + ': following teams and the one-tap team, each with an Undo that works', async () => {
    await page.click('.ipsy-btn');
    await page.fill('#ipsyIn', 'Please follow Arsenal and Lewis Hamilton, and just Northampton for now');
    await page.click('#ipsySend');
    await page.waitForFunction(() => /Sport shows Northampton/.test(document.querySelector('.ipsy-log').textContent), null, { timeout: 15000 });
    assert.deepEqual(await stored(page, 'news.sport.picks'), ['team:football:arsenal', 'kw:Lewis Hamilton']);
    assert.equal(await stored(page, 'news.sport.quick'), 'team:rugby-union:northampton-saints');
    const ch = await texts(page, '.ipsy-change');
    assert.match(ch[0], /^Following Arsenal, Lewis Hamilton\s*Undo$/); assert.match(ch[1], /^Sport now shows only Northampton\s*Undo$/);
    await page.locator('.ipsy-change .ipsy-undo').last().click();
    assert.equal(await stored(page, 'news.sport.quick'), null, 'Undo turns the one-tap team off again');
    await page.locator('.ipsy-change .ipsy-undo').first().click();
    assert.deepEqual(await stored(page, 'news.sport.picks'), [], 'Undo stops following them');
    assert.equal(await page.$$eval('.ipsy-change.undone', e => e.length), 2);
  });

  await step(tag + ': Stem cells’ filters, with Undo', async () => {
    await page.fill('#ipsyIn', 'On stem cells, only Nature this week');
    await page.click('#ipsySend');
    await page.waitForFunction(() => /only Nature, from the last 7 days/.test(document.querySelector('.ipsy-log').textContent), null, { timeout: 15000 });
    assert.deepEqual(await stored(page, 'news.filters'), { stemcells: { sources: ['nature'], days: 7 } });
    assert.match((await texts(page, '.ipsy-change')).at(-1), /^Stem cells: 1 source, last 7 days\s*Undo$/);
    await page.locator('.ipsy-change .ipsy-undo').last().click();
    assert.deepEqual(await stored(page, 'news.filters'), { stemcells: { sources: [], days: 0 } });
  });

  await step(tag + ': a question that fails says so and is taken back out of the conversation', async () => {
    const len = sent[sent.length - 1].length + 1;
    await page.fill('#ipsyIn', 'limit please');
    await page.click('#ipsySend');
    await page.waitForSelector('.ipsy-err');
    await page.fill('#ipsyIn', 'hi');
    await page.click('#ipsySend');
    await page.waitForFunction(() => /Hello!/.test(document.querySelector('.ipsy-log').textContent));
    const last = sent[sent.length - 1];
    assert.equal(last.length, len + 1, 'the failed question is not in the next step');
    assert.ok(!JSON.stringify(last).includes('limit please'));
  });

  await step(tag + ': the chat is kept when the app opens again, and the design changes Ipsy at once', async () => {
    await page.reload();
    await page.waitForSelector('.ipsy-btn');
    await page.click('.ipsy-btn');
    assert.ok((await texts(page, '.ipsy-me')).includes('What happened with the library vote?'));
    assert.equal(await page.$$eval('.ipsy-undo', e => e.length), 0, 'no Undo after the app was closed');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.ipsy-wrap').hidden);
    const other = design === 'glass' ? 'vintage' : 'glass';
    await page.evaluate(d => window.aosDesign.set(d), other);
    assert.equal(await page.$eval('.ipsy-btn', (e, d) => e.classList.contains('ipsy-' + d), other), true);
    assert.equal(await page.$eval('.ipsy-wrap', (e, d) => e.classList.contains('ipsy-' + d), other), true);
  });

  await step(tag + ': no script errors and nothing blocked by the page policy', async () => {
    assert.deepEqual(problems, []);
    assert.equal(await page.evaluate(() => (window.__csp || []).join()), '');
  });
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
