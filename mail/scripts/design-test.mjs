// Mail's two designs (../home/design.js), in headless Chromium at iPhone size, with no network:
// every request off this machine is aborted, and Gmail is a stand-in answered in the test.
//  1. Vintage, the default, in the Retro look, light and dark (the sky held at day, aos.sky):
//     signed out (the Connect Gmail card) and with a mailbox (the list, the walnut pill, compose);
//  2. Standard (Sea glass): the Vintage block off, no sky, the Sea glass ground, icon and bar colour;
//  3. Settings > Design (the first section of the Settings sheet) switches both ways at once, keeps
//     the sheet open, is not part of the tick's save, and is kept across a reload;
//  4. the old Mail Vintage address (/mailvintage/, which the deploy serves from mail/): that app's
//     mailv.* data moves to mail.* once and shows in the app, what it had seen carries over, nothing
//     old is deleted; and on a phone that had both, Mail's own data is kept.
//  5. Manage Tags: each auto-tag's switch is the shared one (home/settings.js's S.sw), named for its tag,
//     in Vintage and Tron.
// Needs Playwright with Chromium (npm i -g playwright); runs from anywhere:
//   node mail/scripts/design-test.mjs
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
  p = p.replace(/^\/mailvintage\//, '/mail/');   // the old Mail Vintage address: the deploy copies mail/ there (news.yml)
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream');
  r.end(fs.readFileSync(f));
});
await new Promise(res => server.listen(0, '127.0.0.1', res));
const BASE = 'http://localhost:' + server.address().port;

// A stand-in Gmail: three conversations in the inbox, nothing else.
const H = (name, value) => ({ name, value });
const THREADS = ['t1', 't2', 't3'];
const thread = id => {
  const n = THREADS.indexOf(id) + 1;
  return { id, historyId: '5', messages: [{ id: 'm' + n, threadId: id, labelIds: n === 1 ? ['INBOX', 'UNREAD'] : ['INBOX'], internalDate: String(Date.now() - n * 3600e3), snippet: 'A short note, number ' + n,
    payload: { mimeType: 'text/plain', headers: [H('From', ['School <office@school.example>', 'Shop <news@shop.example>', 'Sam <sam@family.example>'][n - 1]), H('Subject', ['Trip on Friday', 'This week only', 'Dinner?'][n - 1]), H('Date', new Date(Date.now() - n * 3600e3).toUTCString())], body: { size: 0 } } }] };
};
async function gmail(route) {
  const u = new URL(route.request().url()), p = u.pathname.replace('/gmail/v1/users/me', '');
  const json = o => route.fulfill({ contentType: 'application/json', body: JSON.stringify(o) });
  if (p === '/profile') return json({ emailAddress: 'me@example.com' });
  if (p === '/labels') return json({ labels: [{ id: 'INBOX', name: 'INBOX', type: 'system' }] });
  if (p.startsWith('/labels/')) return json({ id: 'INBOX', threadsUnread: 1 });
  if (p === '/settings/filters') return json({ filter: [] });
  if (p === '/threads') return json(/^in:inbox -in:chats$/.test(u.searchParams.get('q') || '') ? { threads: THREADS.map(id => ({ id, historyId: '5' })) } : {});   // the inbox; nothing for the background sorts
  const t = /^\/threads\/(t\d)$/.exec(p);
  if (t) return json(thread(t[1]));
  return json({});
}

const TOKEN = () => JSON.stringify({ t: 'TEST-TOKEN', exp: Date.now() + 3600e3, scope: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic' });
const signedIn = p => ({ [p + 'token']: TOKEN(), [p + 'token.ever']: '1', [p + 'hint']: 'me@example.com', [p + 'swept']: String(Date.now()), [p + 'daysMonthly']: '1' });

const browser = await chromium.launch();
let failed = 0;
const ok = (label, cond, extra) => { if (!cond) failed++; console.log((cond ? 'ok - ' : 'not ok - ') + label + (cond || !extra ? '' : '  ' + extra)); };

async function phone(scheme = 'light', { design = null, seed = null, at = '/mail/', signed = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.route(/^https?:\/\/(?!localhost)/, route => /^https:\/\/gmail\.googleapis\.com\//.test(route.request().url()) ? gmail(route) : route.abort());
  const s = { 'aos.seen': JSON.stringify({ mail: '999' }), ...(signed ? signedIn('mail.') : {}), ...(seed || {}) };
  await ctx.addInitScript(([s, design]) => {
    if (sessionStorage.getItem('seeded')) return;   // a reload keeps what the app did
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    localStorage.setItem('aos.signin.asked', '1'); localStorage.setItem('aos.sky', 'day');
    if (design) localStorage.setItem('design.mail', design);
  }, [s, design]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
  await page.goto(BASE + at);
  await page.waitForTimeout(900);
  const q = (sel, props, pseudo) => page.$eval(sel, (e, [props, pseudo]) => { const c = getComputedStyle(e, pseudo || null); return props.map(p => c[p]); }, [props, pseudo]);
  return { ctx, page, errs, q };
}
const look = page => page.evaluate(() => document.documentElement.dataset.look);
const flat = v => v === 'none' || v === '';
const SHOTS = process.env.SHOTS;   // a folder: screenshots of each step, to look at
const shot = (page, name) => SHOTS ? page.screenshot({ path: path.join(SHOTS, name + '.png') }) : null;

{ // 1. Vintage, the default: the Retro look, light and dark
  for (const scheme of ['light', 'dark']) {
    const cream = scheme === 'light' ? 'rgb(251, 245, 233)' : 'rgb(50, 42, 37)', ground = scheme === 'light' ? 'rgb(241, 223, 187)' : 'rgb(74, 57, 30)';
    const teal = scheme === 'light' ? 'rgb(31, 111, 107)' : 'rgb(79, 179, 171)', orange = scheme === 'light' ? 'rgb(201, 80, 42)' : 'rgb(216, 87, 42)';
    { // signed out: the Connect Gmail card
      const { ctx, page, errs, q } = await phone(scheme);
      ok(scheme + ': Vintage by default (data-look, the Vintage styles on, the sky at day)', await page.evaluate(() => document.documentElement.dataset.look === 'vintage' && document.getElementById('vintage').media === 'all' && document.documentElement.dataset.sky === 'day'));
      ok(scheme + ': Futura', /Futura/.test((await q('body', ['fontFamily']))[0]));
      ok(scheme + ': the ground is the day sky over cream / walnut', (await q('html', ['backgroundColor']))[0] === ground, (await q('html', ['backgroundColor']))[0]);
      ok(scheme + ': a mustard sun, a teal dot and a burnt-orange pill behind the title', (await q('.aurora b:nth-child(1)', ['backgroundColor']))[0] === 'rgb(227, 167, 47)'
        && (await q('.aurora b:nth-child(2)', ['backgroundColor']))[0] === teal && (await q('.aurora b:nth-child(3)', ['backgroundColor']))[0] === 'rgb(216, 87, 42)');
      ok(scheme + ': the title is big, with the three little bars under it', (await q('header h1', ['fontSize']))[0] === '44px' && (await q('header h1', ['backgroundImage'], '::after'))[0].startsWith('url('));
      const [bg, shadow, backdrop, radius] = await q('.card.signin', ['backgroundColor', 'boxShadow', 'backdropFilter', 'borderRadius']);
      ok(scheme + ': the sign-in card is flat cream / walnut, 20px round', bg === cream && shadow === 'none' && flat(backdrop) && radius === '20px', [bg, shadow, backdrop, radius].join(' | '));
      ok(scheme + ': Connect Gmail is solid orange, the other buttons outlined', (await q('.signin [data-act="signin"]', ['backgroundColor']))[0] === orange && (await q('.signin .btn.ghost', ['boxShadow']))[0].includes('inset'));
      ok(scheme + ': the tag disc is mustard', (await q('.signin .hero', ['backgroundColor']))[0] === 'rgb(227, 167, 47)');
      ok(scheme + ': the Vintage icon, the status bar not translucent, the bar the sky\'s ground', /(^|\/)icon-180\.png/.test(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'))
        && (await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content')) === 'default'
        && (await page.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content')) === (scheme === 'light' ? '#F1DFBB' : '#4A391E'));
      await shot(page, 'vintage-signin-' + scheme);
      ok(scheme + ': signed out: no script errors', !errs.length, errs.join(' | '));
      await ctx.close();
    }
    { // a mailbox
      const { ctx, page, errs, q } = await phone(scheme, { signed: true });
      await page.waitForSelector('#screen li[data-id]', { timeout: 8000 });
      const [lbg, lshadow, lradius] = await q('#screen ul.list.pills > li', ['backgroundColor', 'boxShadow', 'borderRadius']);
      ok(scheme + ': a conversation is a flat cream / walnut card, 20px round', lbg === cream && lshadow === 'none' && lradius === '20px', [lbg, lshadow, lradius].join(' | '));
      ok(scheme + ': the mailbox pill is walnut, compose is solid orange', (await q('.vbar', ['backgroundColor'], '::before'))[0] === 'rgb(74, 52, 38)' && (await q('#fab', ['backgroundColor']))[0] === orange);
      ok(scheme + ': All | Unread has a mustard thumb on a cream pill', (await q('#seg', ['backgroundColor']))[0] === cream && (await q('#seg .slthumb', ['backgroundColor']))[0] === 'rgb(227, 167, 47)');
      ok(scheme + ': an unread dot is burnt orange', (await q('.who .dot', ['backgroundColor']))[0] === 'rgb(216, 87, 42)');
      await shot(page, 'vintage-inbox-' + scheme);
      await page.click('#gear'); await page.waitForTimeout(700);
      const [sbg, sradius, sfilter] = await q('#sheet .sheet', ['backgroundColor', 'borderRadius', 'backdropFilter']);
      ok(scheme + ': Settings is a flat cream / walnut panel', sbg === cream && sradius === '28px' && flat(sfilter), [sbg, sradius, sfilter].join(' | '));
      ok(scheme + ': Settings opens on Design, in a group of its own, with no note under it, then the sections in the standard order', await page.evaluate(() => {
        const b = document.getElementById('stBody'), first = b.firstElementChild;
        const order = [...b.children].map(s => s.querySelector('.st-lbl')?.textContent);
        return first.matches('section.st-sec') && first.querySelector('.st-lbl').textContent === 'Design' && !!first.querySelector('.st-group #stDesign .aos-design') && !first.querySelector('.st-hint')
          && JSON.stringify(order.filter(l => l !== 'Blocked senders')) === JSON.stringify(['Design', 'Inbox clean-up', 'Connected accounts', 'Notifications']);
      }));
      await shot(page, 'vintage-settings-' + scheme);
      ok(scheme + ': a mailbox: no script errors', !errs.length, errs.join(' | '));
      await ctx.close();
    }
  }
}

{ // 2. Standard: Sea glass, the Vintage block switched off, no sky; the icon and bar colour follow
  for (const scheme of ['light', 'dark']) {
    const { ctx, page, errs, q } = await phone(scheme, { design: 'glass', signed: true });
    await page.waitForSelector('#screen li[data-id]', { timeout: 8000 });
    ok(scheme + ' Standard: data-look is glass, the Vintage styles are off, no sky', await page.evaluate(() => document.documentElement.dataset.look === 'glass' && document.getElementById('vintage').media === 'not all' && !document.documentElement.hasAttribute('data-sky')));
    ok(scheme + ' Standard: the Sea glass ground and the system font', (await q('html', ['backgroundColor']))[0] === (scheme === 'light' ? 'rgb(238, 242, 240)' : 'rgb(13, 18, 19)') && !/Futura/.test((await q('body', ['fontFamily']))[0]), (await q('html', ['backgroundColor']))[0]);
    ok(scheme + ' Standard: glass, not cream: the list and the pill are not the Vintage colours', !['rgb(251, 245, 233)', 'rgb(50, 42, 37)'].includes((await q('#screen ul.list.pills > li', ['backgroundColor']))[0]) && (await q('.vbar', ['backgroundColor'], '::before'))[0] !== 'rgb(74, 52, 38)');
    ok(scheme + ' Standard: the aurora, not the atomic shapes', (await q('.aurora b:nth-child(4)', ['display']))[0] !== 'none' && (await q('header h1', ['fontSize']))[0] !== '44px');
    ok(scheme + ' Standard: the Sea glass icon, the status bar as Mail\'s (default), the Sea glass bar colour', /icon-glass-180\.png/.test(await page.getAttribute('link[rel="apple-touch-icon"]', 'href'))
      && (await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content')) === 'default'
      && (await page.getAttribute('meta[name="theme-color"][media*="' + scheme + '"]', 'content')) === (scheme === 'light' ? '#EEF2F0' : '#0D1213'));
    await shot(page, 'glass-inbox-' + scheme);
    await page.click('#gear'); await page.waitForTimeout(700);
    ok(scheme + ' Standard: Settings shows Standard picked', (await page.getAttribute('#stBody [data-design="glass"]', 'aria-checked')) === 'true');
    await shot(page, 'glass-settings-' + scheme);
    ok(scheme + ' Standard: no script errors', !errs.length, errs.join(' | '));
    await ctx.close();
  }
}

{ // 3. Settings > Design: Vintage, then Standard and back, at once, kept across a reload
  const { ctx, page, errs } = await phone('light', { signed: true });
  await page.waitForSelector('#screen li[data-id]', { timeout: 8000 });
  ok('Design: Vintage by default, with the Vintage icon', await look(page) === 'vintage' && !/glass/.test(await page.getAttribute('link[rel="apple-touch-icon"]', 'href')));
  await page.click('#gear'); await page.waitForTimeout(600);
  ok('Design: Settings shows Vintage picked', (await page.getAttribute('#stBody [data-design="vintage"]', 'aria-checked')) === 'true' && (await page.getAttribute('#stBody [data-design="glass"]', 'aria-checked')) === 'false');
  await page.fill('#lab', 'Offers');   // a change waiting for the tick
  await page.click('#stBody [data-design="glass"]'); await page.waitForTimeout(300);
  ok('Design: Standard at once, the sheet still open', await look(page) === 'glass' && (await page.getAttribute('#stBody [data-design="glass"]', 'aria-checked')) === 'true'
    && (await page.getAttribute('#stBody [data-design="vintage"]', 'aria-checked')) === 'false' && await page.isVisible('#sheet .sset'));
  ok('Design: the icon and the Vintage styles follow at once', /icon-glass-180\.png/.test(await page.getAttribute('link[rel="apple-touch-icon"]', 'href')) && await page.evaluate(() => document.getElementById('vintage').media === 'not all'));
  ok('Design: not part of the tick\'s save (what was typed waits, nothing saved)', (await page.inputValue('#lab')) === 'Offers' && (await page.evaluate(() => localStorage.getItem('mail.label'))) === null);
  ok('Design: All | Unread\'s thumb sits under the chosen half again', await page.evaluate(() => {
    const t = document.querySelector('#seg .slthumb'), on = document.querySelector('#seg [aria-checked="true"]');
    if (!t || !on) return false;
    const a = t.getBoundingClientRect(), b = on.getBoundingClientRect();
    return Math.abs(a.left - b.left) < 4 && Math.abs(a.width - b.width) < 4;
  }));
  await page.click('#sheet [data-act="sheet-close"]', { position: { x: 20, y: 20 } }); await page.waitForTimeout(500);
  await page.reload(); await page.waitForTimeout(900);
  ok('Design: Standard is kept', await look(page) === 'glass' && (await page.evaluate(() => localStorage.getItem('design.mail'))) === 'glass');
  await page.click('#gear'); await page.waitForTimeout(600);
  await page.click('#stBody [data-design="vintage"]'); await page.waitForTimeout(300);
  ok('Design: back to Vintage at once', await look(page) === 'vintage' && await page.evaluate(() => document.getElementById('vintage').media === 'all' && document.documentElement.dataset.sky === 'day'));
  await page.reload(); await page.waitForTimeout(900);
  ok('Design: back to Vintage, kept', await look(page) === 'vintage' && (await page.evaluate(() => localStorage.getItem('design.mail'))) === 'vintage');
  ok('Design: no script errors', !errs.length, errs.join(' | '));
  await ctx.close();
}

{ // 4. the old Mail Vintage app, on a phone that added it: its address opens Mail, with its data moved over once
  const seed = { 'aos.seen': JSON.stringify({ mailvintage: '1.3' }), ...signedIn('mailv.'), 'mailv.label': 'Deals', 'mailv.days': '7' };
  const { ctx, page, errs } = await phone('light', { seed, at: '/mailvintage/' });
  await page.waitForSelector('#screen li[data-id]', { timeout: 8000 });
  const got = await page.evaluate(() => ({ token: localStorage.getItem('mail.token'), label: localStorage.getItem('mail.label'), days: localStorage.getItem('mail.days'),
    seen: JSON.parse(localStorage.getItem('aos.seen') || '{}'), old: localStorage.getItem('mailv.label'), oldToken: localStorage.getItem('mailv.token'), look: document.documentElement.dataset.look }));
  ok('old address: Mail Vintage\'s data is now Mail\'s (signed in, its settings)', !!got.token && got.label === 'Deals' && got.days === '7', JSON.stringify(got));
  ok('old address: what it had seen carries over (no walkthrough again), and nothing old is deleted', got.seen.mail === '1.3' && got.old === 'Deals' && !!got.oldToken, JSON.stringify(got));
  ok('old address: in Vintage', got.look === 'vintage');
  await page.evaluate(() => document.getElementById('gear').click()); await page.waitForTimeout(600);   // (a click in the page: an update screen may be over it)
  ok('old address: the moved settings show in Settings', (await page.inputValue('#lab')) === 'Deals' && (await page.inputValue('#days')) === '7');
  ok('old address: Sign-in returns to the address it was opened at (registered for Mail Vintage)', /\/mailvintage\/$/.test(await page.evaluate(() => redirectUri())));
  // once only: a later change to the old keys is not copied again
  await page.evaluate(() => localStorage.setItem('mailv.label', 'Later'));
  await page.reload(); await page.waitForTimeout(900);
  ok('old address: moved once only', (await page.evaluate(() => localStorage.getItem('mail.label'))) === 'Deals');
  ok('old address: no script errors', !errs.length, errs.join(' | '));
  await ctx.close();
}
{ // a phone with both: Mail's own data is kept, the old app's is not copied over it
  const seed = { 'aos.seen': JSON.stringify({ mail: '999', mailvintage: '999' }), ...signedIn('mail.'), 'mail.label': 'Promos', ...signedIn('mailv.'), 'mailv.label': 'Deals', 'mailv.days': '7' };
  const { ctx, page, errs } = await phone('light', { seed, at: '/mailvintage/' });
  const got = await page.evaluate(() => ({ label: localStorage.getItem('mail.label'), days: localStorage.getItem('mail.days'), done: localStorage.getItem('design.mail.moved') }));
  ok('both: Mail\'s own data is kept', got.label === 'Promos' && got.days !== '7' && got.done === '1', JSON.stringify(got));
  ok('both: no script errors', !errs.length, errs.join(' | '));
  await ctx.close();
}

{ // 5. Manage Tags: each auto-tag's switch is the shared one (home/settings.js's S.sw), named for what it tags
  for (const design of ['vintage', 'grid']) {
    const { ctx, page, errs } = await phone('light', { design, signed: true });
    await page.waitForSelector('#screen li[data-id]', { timeout: 8000 });
    await page.click('#boxbtn'); await page.waitForTimeout(300);
    await page.click('#boxmenu [data-view="rules"]');
    await page.waitForSelector('#screen li[data-preset] [role="switch"]', { timeout: 8000 });
    const sw = await page.evaluate(() => [...document.querySelectorAll('#screen li[data-preset]')].map(li => {
      const b = li.querySelector('[role="switch"]');
      return { shared: b.matches('button.st-sw[data-act="preset-toggle"]'), label: b.getAttribute('aria-label'), name: li.dataset.preset, on: b.getAttribute('aria-checked'), w: b.offsetWidth };
    }));
    ok(design + ': auto-tags: every switch is the shared one, off, named "<tag> auto-tag"', sw.length > 0 && sw.every(x => x.shared && x.label === x.name + ' auto-tag' && x.on === 'false' && x.w === 48), JSON.stringify(sw));
    ok(design + ': auto-tags: no switch of Mail\'s own left', !(await page.$('.switch')));
    const busy = await page.evaluate(() => { presetBusy.add('Travel'); render(); const b = document.querySelector('#screen li[data-preset="Travel"] .st-sw'), r = { disabled: b.disabled, anim: getComputedStyle(b, '::after').animationName }; presetBusy.delete('Travel'); render(); return r; });
    ok(design + ': auto-tags: turning one on or off, its switch breathes and waits', busy.disabled && busy.anim === 'breathe', JSON.stringify(busy));
    await page.waitForTimeout(700); await shot(page, 'autotags-' + design);
    ok(design + ': auto-tags: no script errors', !errs.length, errs.join(' | '));
    await ctx.close();
  }
}

await browser.close(); server.close();
console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
