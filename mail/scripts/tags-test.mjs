// Mail's tags kept out of the inbox (Manage Tags, a tag's Out of inbox / In inbox), in headless Chromium at iPhone size
// with a stand-in Gmail that keeps its labels, filters and messages:
//   - switched on: the tag's sender rule is made again to skip the inbox (Gmail can't change a filter), its mail in the
//     inbox leaves it, the tag goes in the mailbox menu, and its mail is still there when you pick the tag;
//   - another tag and other mail are untouched; an auto-tag's rule (a kind of mail, not a sender) has no switch;
//   - Undo puts it all back; switched off, new mail stays in the inbox again and nothing is moved.
// Needs Playwright with Chromium (npm i -g playwright):
//   node mail/scripts/tags-test.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream');
  r.end(fs.readFileSync(f));
});
await new Promise(res => server.listen(0, '127.0.0.1', res));
const BASE = 'http://localhost:' + server.address().port;

// A stand-in Gmail that keeps state: Monarch and Amazon tags, each with a sender rule, a Travel auto-tag (a search),
// and four conversations in the inbox.
const H = (name, value) => ({ name, value });
function makeGmail() {
  const g = {
    labels: [{ id: 'INBOX', name: 'INBOX', type: 'system' }, { id: 'Lmon', name: 'Monarch', type: 'user' }, { id: 'Lamz', name: 'Amazon', type: 'user' }, { id: 'Ltrv', name: 'Travel', type: 'user' }],
    filters: [
      { id: 'f1', criteria: { from: 'email.monarch.com' }, action: { addLabelIds: ['Lmon'] } },
      { id: 'f2', criteria: { from: 'amazon.com' }, action: { addLabelIds: ['Lamz'] } },
      { id: 'f3', criteria: { query: 'from:(united.com) subject:(itinerary)' }, action: { addLabelIds: ['Ltrv'] } },
    ],
    msgs: [
      { id: 'm1', threadId: 't1', labelIds: ['INBOX', 'Lmon'], from: 'Monarch <hello@email.monarch.com>', subject: 'Your weekly recap' },
      { id: 'm2', threadId: 't2', labelIds: ['INBOX', 'Lmon'], from: 'Monarch <hello@email.monarch.com>', subject: 'Budget alert' },
      { id: 'm3', threadId: 't3', labelIds: ['INBOX', 'Lamz'], from: 'Amazon <ship@amazon.com>', subject: 'Your order has shipped' },
      { id: 'm4', threadId: 't4', labelIds: ['INBOX'], from: 'Sam <sam@family.example>', subject: 'Dinner?' },
    ],
    n: 10,
  };
  g.handle = async route => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname.replace('/gmail/v1/users/me', ''), m = req.method();
    const json = o => route.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
    const body = () => JSON.parse(req.postData() || '{}');
    const has = (x, q, labels) => (!labels.length || labels.every(l => x.labelIds.includes(l))) && (!/in:inbox/.test(q) || x.labelIds.includes('INBOX'));
    if (p === '/profile') return json({ emailAddress: 'me@example.com' });
    if (p === '/labels') return json({ labels: g.labels });
    if (p.startsWith('/labels/')) { const id = p.slice(8); return json({ id, messagesTotal: g.msgs.filter(x => x.labelIds.includes(id)).length, threadsUnread: 0 }); }
    if (p === '/settings/filters' && m === 'GET') return json({ filter: g.filters });
    if (p === '/settings/filters' && m === 'POST') { const f = Object.assign({ id: 'f' + (++g.n) }, body()); g.filters.push(f); return json(f); }
    if (p.startsWith('/settings/filters/') && m === 'DELETE') { g.filters = g.filters.filter(f => f.id !== p.split('/').pop()); return route.fulfill({ status: 204, body: '' }); }
    if (p === '/messages/batchModify') {
      const b = body();
      for (const x of g.msgs.filter(x => b.ids.includes(x.id))) x.labelIds = [...new Set(x.labelIds.filter(l => !(b.removeLabelIds || []).includes(l)).concat(b.addLabelIds || []))];
      return route.fulfill({ status: 204, body: '' });
    }
    const q = u.searchParams.get('q') || '', labels = u.searchParams.getAll('labelIds');
    if (p === '/messages') return json({ messages: g.msgs.filter(x => has(x, q, labels)).map(x => ({ id: x.id, threadId: x.threadId })) });
    if (p === '/threads') {
      if (q && !/^in:inbox( -in:chats)?$/.test(q)) return json({});   // the background sorts: nothing
      const ts = [...new Set(g.msgs.filter(x => has(x, q || (labels.length ? '' : 'in:inbox'), labels)).map(x => x.threadId))];
      return json({ threads: ts.map(id => ({ id, historyId: '5' })) });
    }
    const t = /^\/threads\/(t\d)$/.exec(p);
    if (t) {
      const ms = g.msgs.filter(x => x.threadId === t[1]);
      return json({ id: t[1], historyId: '5', messages: ms.map((x, i) => ({ id: x.id, threadId: x.threadId, labelIds: x.labelIds, internalDate: String(Date.now() - (+x.id.slice(1)) * 3600e3), snippet: x.subject,
        payload: { mimeType: 'text/plain', headers: [H('From', x.from), H('Subject', x.subject), H('Date', new Date(Date.now() - i * 3600e3).toUTCString())], body: { size: 0 } } })) });
    }
    return json({});
  };
  return g;
}

const TOKEN = () => JSON.stringify({ t: 'TEST-TOKEN', exp: Date.now() + 3600e3, scope: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic' });
const browser = await chromium.launch();
let failed = 0;
const ok = (label, cond, extra) => { if (!cond) failed++; console.log((cond ? 'ok - ' : 'not ok - ') + label + (cond || !extra ? '' : '  ' + extra)); };

async function phone(g) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route(/^https?:\/\/(?!localhost)/, route => /^https:\/\/gmail\.googleapis\.com\//.test(route.request().url()) ? g.handle(route) : route.abort());
  await ctx.addInitScript(s => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, { 'aos.seen': JSON.stringify({ mail: '999' }), 'mail.token': TOKEN(), 'mail.token.ever': '1', 'mail.hint': 'me@example.com', 'mail.swept': String(Date.now()), 'mail.daysMonthly': '1', 'aos.signin.asked': '1', 'aos.sky': 'day' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
  await page.goto(BASE + '/mail/');
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}
const openTags = async page => { await page.click('#boxbtn'); await page.waitForTimeout(300); await page.click('#boxmenu [data-view="rules"]'); await page.waitForTimeout(900); };
const card = (page, name) => page.locator('.card', { has: page.locator('.tchip', { hasText: name }) });
const filterOf = (g, from) => g.filters.find(f => f.criteria.from === from);
const toastText = page => page.evaluate(() => (document.querySelector('#toast') || {}).textContent || '');

{
  const g = makeGmail();
  const { ctx, page, errs } = await phone(g);
  await openTags(page);
  ok('each tag with a sender rule has the switch, In inbox to start', await card(page, 'Monarch').locator('[data-act="tag-skip"]').getAttribute('aria-pressed') === 'false'
    && await card(page, 'Amazon').locator('[data-act="tag-skip"]').count() === 1);
  ok('an auto-tag (a search, not a sender) has no switch', await card(page, 'Travel').locator('[data-act="tag-skip"]').count() === 0);

  await card(page, 'Monarch').locator('[data-act="tag-skip"]').click();
  await page.waitForTimeout(1500);
  const f1 = filterOf(g, 'email.monarch.com');
  ok('switched on: Monarch\'s rule is made again to skip the inbox, still tagging Monarch', f1 && f1.id !== 'f1' && f1.action.removeLabelIds.includes('INBOX') && f1.action.addLabelIds.includes('Lmon'), JSON.stringify(g.filters));
  ok('its mail in the inbox leaves it, keeping the tag', g.msgs.filter(x => x.labelIds.includes('Lmon')).every(x => !x.labelIds.includes('INBOX') && x.labelIds.includes('Lmon')));
  ok('Amazon and other mail stay where they were', g.msgs.find(x => x.id === 'm3').labelIds.includes('INBOX') && g.msgs.find(x => x.id === 'm4').labelIds.includes('INBOX')
    && !filterOf(g, 'amazon.com').action.removeLabelIds);
  ok('the switch says Out of inbox, and the toast says where the mail is', await card(page, 'Monarch').locator('[data-act="tag-skip"]').getAttribute('aria-pressed') === 'true'
    && /Monarch is out of the inbox · 2 moved\. It’s in its tag\./.test(await toastText(page)), await toastText(page));

  if (process.env.SHOTS) {   // to look at: the two tags' cards, once the toast has gone
    await page.waitForTimeout(6000);
    await card(page, 'Amazon').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(process.env.SHOTS, 'mail-tags.png') });
  }
  await page.click('#boxbtn'); await page.waitForTimeout(300);
  ok('Monarch is in the mailbox menu', await page.locator('#boxmenu [data-act="chip"]', { hasText: 'Monarch' }).count() === 1);
  await page.locator('#boxmenu [data-act="chip"]', { hasText: 'Inbox' }).first().click(); await page.waitForTimeout(1200);
  const inbox = await page.$$eval('#list .row .subj, .list .subj, .pills .subj', els => els.map(e => e.textContent));
  ok('the inbox no longer shows Monarch\'s mail', !inbox.some(s => /recap|Budget/.test(s)) && inbox.some(s => /Dinner/.test(s)), inbox.join(' | '));
  await page.click('#boxbtn'); await page.waitForTimeout(300);
  await page.locator('#boxmenu [data-act="chip"]', { hasText: 'Monarch' }).click(); await page.waitForTimeout(1200);
  const tagged = await page.$$eval('.list .subj, .pills .subj', els => els.map(e => e.textContent));
  ok('picking the Monarch tag shows its mail', tagged.some(s => /recap/.test(s)) && tagged.some(s => /Budget/.test(s)), tagged.join(' | '));

  // Undo, from a fresh switch
  await openTags(page);
  await card(page, 'Amazon').locator('[data-act="tag-skip"]').click(); await page.waitForTimeout(1500);
  ok('Amazon out of the inbox too', !g.msgs.find(x => x.id === 'm3').labelIds.includes('INBOX') && filterOf(g, 'amazon.com').action.removeLabelIds.includes('INBOX'));
  await page.click('#toast button'); await page.waitForTimeout(1500);
  ok('Undo: Amazon\'s rule stays in the inbox again and its mail is back', g.msgs.find(x => x.id === 'm3').labelIds.includes('INBOX') && !(filterOf(g, 'amazon.com').action.removeLabelIds || []).includes('INBOX'), JSON.stringify(g.filters));

  // switched off: new mail stays in the inbox, nothing is moved back
  await openTags(page);
  await card(page, 'Monarch').locator('[data-act="tag-skip"]').click(); await page.waitForTimeout(1500);
  ok('switched off: Monarch\'s rule keeps mail in the inbox again; what\'s in the tag stays there', !(filterOf(g, 'email.monarch.com').action.removeLabelIds || []).includes('INBOX')
    && g.msgs.filter(x => x.labelIds.includes('Lmon')).every(x => !x.labelIds.includes('INBOX')));
  ok('one rule a sender, never two', g.filters.filter(f => f.criteria.from === 'email.monarch.com').length === 1 && g.filters.filter(f => f.criteria.from === 'amazon.com').length === 1);
  ok('no script errors', !errs.length, errs.join(' | '));
  await ctx.close();
}
await browser.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
