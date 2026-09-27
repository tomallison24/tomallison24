// Loads the Mail app against a fake Gmail and checks:
//  1. attachments that could run code (HTML, SVG) can't be opened as pages
//     in the app's origin, and can't read the stored token if they were;
//  2. the page has a Content Security Policy, and nothing the app itself
//     does is blocked by it (list, reading, images on Show, attachments,
//     one-click unsubscribe).
// Needs Playwright with Chromium (npm i -g playwright); runs from anywhere:
//   node mail/scripts/security-test.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream');
  r.end(fs.readFileSync(f));
}).listen(8931);

const b64u = s => Buffer.from(s).toString('base64url');
const PNG = fs.readFileSync(path.join(ROOT, 'mail/icon-180.png'));
const EVIL = '<script>document.title="STOLE:"+localStorage.getItem("mail.token")</script><p>hi</p>';
const FILES = {
  a1: { name: 'invoice.html', type: 'text/html', data: b64u(EVIL) },
  a2: { name: 'logo.svg', type: 'image/svg+xml', data: b64u('<svg xmlns="http://www.w3.org/2000/svg"><script>document.title="STOLE:"+localStorage.getItem("mail.token")</script></svg>') },
  a3: { name: 'photo.png', type: 'image/png', data: PNG.toString('base64url') },
  a4: { name: 'scan.pdf', type: 'application/pdf', data: b64u('%PDF-1.1\n%%EOF') },
  a5: { name: 'sneaky.png', type: 'IMAGE/PNG; name=x', data: PNG.toString('base64url') },
};
const H = (name, value) => ({ name, value });
const headers = [
  H('From', 'News <news@shop.example>'), H('Subject', 'Hello'), H('Date', new Date().toUTCString()),
  H('Content-Type', 'multipart/mixed'),
  H('Authentication-Results', 'mx.google.com; dkim=pass header.i=@shop.example; dmarc=pass header.from=shop.example'),
  H('List-Unsubscribe', '<https://unsub.shop.example/u/1>'), H('List-Unsubscribe-Post', 'List-Unsubscribe=One-Click'),
];
const html = '<p>Body text</p><img id="px" src="https://img.shop.example/pixel.png" width="1" height="1">';
const full = {
  id: 't1', historyId: '5', messages: [{
    id: 'm1', threadId: 't1', labelIds: ['INBOX', 'UNREAD'], internalDate: String(Date.now()), snippet: 'Body text',
    payload: { mimeType: 'multipart/mixed', headers, parts: [
      { mimeType: 'text/html', headers: [H('Content-Type', 'text/html; charset=utf-8')], body: { data: b64u(html), size: html.length } },
      ...Object.entries(FILES).map(([id, f]) => ({ mimeType: f.type, filename: f.name, headers: [], body: { attachmentId: id, size: 100 } })),
    ] },
  }],
};

let failures = 0;
const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) failures++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ serviceWorkers: 'allow' });
const seen = { unsub: null, pixel: 0 };
await ctx.route('https://gmail.googleapis.com/**', route => {
  const u = new URL(route.request().url()), p = u.pathname.replace('/gmail/v1/users/me', '');
  const json = o => route.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
  if (p === '/profile') return json({ emailAddress: 'me@example.com' });
  if (p === '/labels') return json({ labels: [{ id: 'INBOX', name: 'INBOX', type: 'system' }] });
  if (p.startsWith('/labels/')) return json({ id: 'INBOX', threadsUnread: 0 });
  if (p === '/settings/filters') return json({ filter: [] });
  if (p === '/threads') return json(/older_than|Remind/.test(u.searchParams.get('q') || '') ? {} : { threads: [{ id: 't1', historyId: '5' }] });
  if (p === '/threads/t1') return json(full);
  const att = /^\/messages\/m1\/attachments\/(\w+)$/.exec(p);
  if (att) return json({ data: FILES[att[1]].data });
  return json({});
});
await ctx.route('https://unsub.shop.example/**', route => { seen.unsub = route.request(); route.fulfill({ status: 200, body: 'ok' }); });
await ctx.route('https://img.shop.example/**', route => { seen.pixel++; route.fulfill({ contentType: 'image/png', body: PNG }); });

const page = await ctx.newPage();
const blocked = [];
// The email frame's own policy ("img-src data:") blocking images before Show is
// the feature, not a failure.
const watchCsp = p => p.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t) && !/directive: "img-src data:"/.test(t)) blocked.push(t); });
watchCsp(page);
page.on('pageerror', e => { blocked.push('pageerror: ' + e.message); });
await page.addInitScript(() => {
  if (!localStorage.getItem('mail.token')) localStorage.setItem('mail.token', JSON.stringify({ t: 'SECRET-TOKEN', exp: Date.now() + 3600e3,
    scope: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic' }));
  localStorage.setItem('mail.swept', String(Date.now()));
});
await page.goto('http://localhost:8931/mail/');

const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '');
check(/script-src 'self'(;|$)/.test(csp) && !/script-src[^;]*unsafe/.test(csp), 'page has a CSP that only runs the app\'s own script: ' + (csp || '(none)'));

const sw = await page.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active, () => false));
check(sw, 'the offline service worker still registers');

await page.click('li[data-id="t1"] button[data-act="read"]', { timeout: 10000 });
await page.waitForSelector('iframe.rframe');
await page.waitForTimeout(500);
const frame = page.frames().find(f => f.url() === 'about:srcdoc');
check(!!frame && /Body text/.test(await frame.content()), 'the email renders in its sandboxed frame');
check(seen.pixel === 0, 'remote images stay off until Show');

// Show images
const show = await page.$('[data-act="images"], [data-act="show-images"]');
if (show) { await show.click(); await page.waitForTimeout(800); }
check(!!show && seen.pixel > 0, 'tapping Show loads remote images');

async function openAtt(name) {
  await page.click(`button.fchip[aria-label="Open ${name}"]`);
  await page.waitForSelector('#sheet .btn[data-act="file-share"], #sheet .cnote-bad', { timeout: 5000 });
  const r = await page.evaluate(() => ({
    open: document.querySelector('#sheet a.btn[target="_blank"]')?.getAttribute('href') || null,
    preview: !!document.querySelector('#sheet img.fprev'),
    type: window.__lastBlobType,
  }));
  return r;
}
await page.evaluate(() => { const C = URL.createObjectURL; URL.createObjectURL = b => { window.__lastBlobType = b.type; return C(b); }; });

for (const name of ['invoice.html', 'logo.svg']) {
  const r = await openAtt(name);
  check(!r.open, `${name}: no Open button`);
  check(!/html|svg|xml/i.test(r.type || ''), `${name}: kept as a download, not a page (blob type ${r.type})`);
  // Even if someone did open it, it must not run in the app's origin with access to the token.
  const [pop] = await Promise.all([ctx.waitForEvent('page'), page.evaluate(() => window.open(document.querySelector('#sheet') && URL.createObjectURL(new Blob([
    '<script>document.title="STOLE:"+localStorage.getItem("mail.token")<\/script>'], { type: 'text/html' })), '_blank'))]);
  await pop.waitForLoadState(); await pop.waitForTimeout(300);
  check(!/STOLE/.test(await pop.title()), `${name}: forced open as HTML, its script still can't run (CSP inherited)`);
  await pop.close();
  await page.click('#sheet [data-act="sheet-close"].btn');
  await page.waitForTimeout(400);
}
for (const name of ['photo.png', 'sneaky.png']) {
  const r = await openAtt(name);
  check(!!r.open && r.preview && r.type === 'image/png', `${name}: preview and Open still work (blob type ${r.type})`);
  await page.click('#sheet [data-act="sheet-close"].btn'); await page.waitForTimeout(400);
}
{
  const r = await openAtt('scan.pdf');
  if (r.open) {
    const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('#sheet a.btn[target="_blank"]')]);
    watchCsp(pop); await pop.waitForTimeout(1200); await pop.close().catch(() => {});
  }
  check(!!r.open && r.type === 'application/pdf', `scan.pdf: Open still works (blob type ${r.type})`);
  await page.click('#sheet [data-act="sheet-close"].btn'); await page.waitForTimeout(400);
}

// One-click unsubscribe still goes out, without cookies or referrer.
await page.click('[data-act="unsub"]');
await page.click('[data-act="unsub-go"]');
await page.waitForTimeout(800);
check(!!seen.unsub && seen.unsub.method() === 'POST' && seen.unsub.postData() === 'List-Unsubscribe=One-Click', 'one-click unsubscribe is sent');
if (seen.unsub) {
  const h = await seen.unsub.allHeaders();
  check(!h.cookie && !h.referer, 'unsubscribe carries no cookie or referrer');
}

// A walk through the rest of the app, so the policy is seen not to block it.
let sent = null;
await ctx.route('https://gmail.googleapis.com/upload/**', route => { sent = route.request(); route.fulfill({ contentType: 'application/json', body: '{"id":"s1","threadId":"t9"}' }); });
await page.goBack(); await page.waitForTimeout(700);
for (const sel of ['[data-view="rules"]', '[data-view="marketing"]', '[data-view="inbox"]', '#gear', '#gear', '#find']) {
  await page.click(sel); await page.waitForTimeout(400);
}
await page.fill('#q', 'invoice'); await page.press('#q', 'Enter'); await page.waitForTimeout(700);
await page.click('#fab');
await page.fill('#c-to', 'friend@example.com'); await page.fill('#c-subj', 'Hi'); await page.fill('#c-body', 'Hello');
await page.setInputFiles('#c-pick', { name: 'pic.png', mimeType: 'image/png', buffer: PNG });
await page.waitForTimeout(500);
await page.click('[data-act="compose-send"]');
await page.waitForTimeout(7000);
check(!!sent && /Content-Disposition: attachment/i.test(sent.postData() || ''), 'compose with an attachment still sends');

check(blocked.length === 0, 'nothing the app does is blocked by the CSP' + (blocked.length ? ':\n  ' + blocked.join('\n  ') : ''));
await browser.close(); srv.close();
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
