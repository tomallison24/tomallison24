// Your helper dressed for the weather (home/ipsy.js, wearing()): from Weather's forecast kept on the phone (wx.cache),
// as aOS Home and every app draw it, at iPhone size:
//   - rain: an umbrella; chilly: a scarf; cold: a coat (and its sleeves) and a scarf; cold rain: all three; snow or a
//     freeze: a woolly hat too; a warm sunny day: a sun hat and sunglasses, but not after dark;
//   - no forecast, or one over 12 hours old: dressed as usual; an older one (2 hours): the hour for now;
//   - a new forecast from another app or frame (a storage event): dressed again at once;
//   - Tron: Ares keeps his suit, with an umbrella in the rain; the picker's helpers are as they are;
//   - turned off (aOS > Account > Your helper, or Ipsy's helper.dress_for_weather; aos.helper.weather): as usual, in
//     this page and in another app or frame at once; on again, dressed again.
//
//   node home/scripts/ipsy-weather-test.mjs [repo root]
import { createRequire } from 'module'; import { execSync } from 'child_process'; import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/'); const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || new URL('../..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, r)); const BASE = 'http://localhost:' + server.address().port;
const b = await chromium.launch();
let failed = 0;
const report = (name, problems) => { if (problems.length) { failed++; console.log('not ok - ' + name + '\n  ' + problems.join('\n  ')); } else console.log('ok - ' + name); };
// a forecast as Weather keeps it: one place, the one on screen (wx.here)
const HERE = { lat: 40.7128, lon: -74.006, name: 'Here' }, KEY = '40.713,-74.006';
const wx = (c, tF, o = {}) => JSON.stringify({ [KEY]: { cur: { tF, fF: tF, c }, daily: [], hourly: o.hourly || [], fetchedAt: o.at != null ? o.at : Date.now(), key: KEY } });
const at = h => { const d = new Date(); d.setHours(h, 0, 0, 0); return d; };   // today at h, on the phone's clock

async function blank(hour = 13) {   // a page on the site with Ipsy's script, and a helper drawn in it
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route('**/*', r => (new URL(r.request().url()).origin === BASE ? r.continue() : r.abort()));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.setFixedTime(at(hour));
  await p.goto(BASE + '/x.html');
  await p.evaluate(h => { localStorage.setItem('aos.helper', '{"who":"fox","name":""}'); localStorage.setItem('wx.here', JSON.stringify(h)); localStorage.removeItem('wx.cache'); }, HERE);
  await p.setContent('<html data-look="vintage"><body><div id="h" style="width:78px;height:78px"></div></body></html>');
  await p.addScriptTag({ url: BASE + '/home/ipsy.js' });
  await p.evaluate(() => AllisonOS.ipsy.character(document.getElementById('h'), {}));
  return { ctx, p, errs };
}
const dressAs = async (p, cache) => p.evaluate(c => { if (c == null) localStorage.removeItem('wx.cache'); else localStorage.setItem('wx.cache', c); AllisonOS.ipsy.refit();
  const s = document.querySelector('#h .ipsy-char'); return { wear: s.dataset.wear || '', who: s.dataset.who, limb: s.style.getPropertyValue('--limb').trim(), clip: !!s.querySelector('clipPath'), umb: !!s.querySelector('.h-umb'), hat: !!s.querySelector('.h-sunhat'), beanie: !!s.querySelector('.h-beanie') }; }, cache);

// 1. each kind of weather, by day
{
  const { ctx, p, errs } = await blank(13); const pr = [];
  const want = [['no forecast', null, ''], ['mild and cloudy', wx('partlycloudy', 64), ''], ['rain', wx('rainy', 62), 'umbrella'], ['chilly', wx('cloudy', 52), 'scarf'],
    ['cold', wx('cloudy', 40), 'coat scarf'], ['cold rain', wx('pouring', 41), 'umbrella coat scarf'], ['snow', wx('snowy', 30), 'coat scarf beanie'], ['a freeze', wx('sunny', 20), 'coat scarf beanie'],
    ['sleet', wx('snowy-rainy', 33), 'umbrella coat scarf beanie'], ['thunderstorms', wx('lightning-rainy', 75), 'umbrella'], ['warm and sunny', wx('sunny', 82), 'sunhat shades'], ['warm, cloudy', wx('cloudy', 82), '']];
  for (const [name, cache, wear] of want) {
    const got = await dressAs(p, cache);
    if (got.wear !== wear) pr.push(name + ': wore "' + got.wear + '", not "' + wear + '"');
    if (wear.includes('coat') && (!got.clip || got.limb !== '#2F4A6D')) pr.push(name + ': the coat (cut to the fox, its sleeves the coat\'s colour) was missing: ' + JSON.stringify(got));
    if (wear.includes('umbrella') !== got.umb || wear.includes('sunhat') !== got.hat || wear.includes('beanie') !== got.beanie) pr.push(name + ': drew the wrong things: ' + JSON.stringify(got));
  }
  // the forecast's age: two hours old, the hour for now (snow by then); thirteen hours old, nothing
  const hr = Math.floor(at(13).getTime() / 1000 / 3600) * 3600;
  let got = await dressAs(p, wx('sunny', 82, { at: at(11).getTime(), hourly: [{ t: hr - 3600, c: 'sunny', pF: 80, fF: 80 }, { t: hr, c: 'snowy', pF: 30, fF: 30 }] }));
  if (got.wear !== 'coat scarf beanie') pr.push('a 2-hour-old forecast did not use its hour for now: ' + got.wear);
  got = await dressAs(p, wx('rainy', 40, { at: at(13).getTime() - 13 * 3600e3 }));
  if (got.wear !== '') pr.push('a 13-hour-old forecast still dressed it: ' + got.wear);
  pr.push(...errs); report('each kind of weather: an umbrella, a scarf, a coat, a woolly hat, a sun hat and sunglasses; no forecast or an old one, as usual', pr); await ctx.close();
}

// 2. after dark, no sun hat; a new forecast from another app (a storage event) dresses it again at once
{
  const { ctx, p, errs } = await blank(22); const pr = [];
  if ((await dressAs(p, wx('sunny', 82))).wear !== '') pr.push('a sun hat at 10 PM');
  const other = await ctx.newPage(); await other.goto(BASE + '/x.html');
  await other.evaluate(c => localStorage.setItem('wx.cache', c), wx('rainy', 40));
  await p.waitForFunction(() => document.querySelector('#h .ipsy-char').dataset.wear === 'umbrella coat scarf', null, { timeout: 3000 }).catch(() => pr.push('a forecast from another page did not dress it'));
  // turned off in another app or frame: as usual at once, whatever the weather; on again, dressed again
  await other.evaluate(() => localStorage.setItem('aos.helper.weather', 'off'));
  await p.waitForFunction(() => !document.querySelector('#h .ipsy-char').dataset.wear, null, { timeout: 3000 }).catch(() => pr.push('turned off in another page, it stayed dressed'));
  if (await p.evaluate(() => AllisonOS.ipsy.dressing())) pr.push('dressing() still on');
  await p.evaluate(() => AllisonOS.ipsy.dress(true));
  if ((await p.evaluate(() => document.querySelector('#h .ipsy-char').dataset.wear || '')) !== 'umbrella coat scarf') pr.push('on again, it was not dressed again');
  pr.push(...errs); report('after dark no sun hat; a forecast from another app or frame dresses it at once; turned off there, as usual at once', pr); await ctx.close();
}

// 3. Tron: Ares keeps his suit, an umbrella in the rain; the picker's helpers as they are
{
  const { ctx, p, errs } = await blank(13); const pr = [];
  await p.evaluate(() => { document.documentElement.dataset.look = 'grid'; });
  await p.waitForFunction(() => document.querySelector('#h .ipsy-char').dataset.who === 'rider');
  let got = await dressAs(p, wx('pouring', 30));
  if (got.who !== 'rider' || got.wear !== 'umbrella' || got.clip || got.beanie) pr.push('Ares in cold rain: ' + JSON.stringify(got));
  got = await dressAs(p, wx('sunny', 85));
  if (got.wear !== '' || got.hat) pr.push('Ares in the sun: ' + JSON.stringify(got));
  await p.evaluate(() => { document.documentElement.dataset.look = 'vintage'; });
  await dressAs(p, wx('rainy', 40));
  const picker = await p.evaluate(() => { const d = document.createElement('div'); document.body.appendChild(d); AllisonOS.ipsy.picker(d, () => {}); const all = [...d.querySelectorAll('.ipsy-whobtn .ipsy-char')]; return { all: all.length, dressed: all.filter(s => s.dataset.wear).length }; });
  if (picker.all !== 7 || picker.dressed) pr.push('the picker: ' + JSON.stringify(picker));
  pr.push(...errs); report('Tron: Ares keeps his suit, with an umbrella in the rain; the picker\'s helpers as they are', pr); await ctx.close();
}

// 4. aOS Home: the helper in the Ipsy bar is dressed for the forecast Weather kept
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const user = { id: 'u1', name: 'Sarah', role: 'member', apps: {} };
  await ctx.addInitScript(([here, cache]) => { try { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('aos.sky', 'day'); localStorage.setItem('aos.helper', '{"who":"owl","name":"Hoot"}'); localStorage.setItem('wx.here', here); localStorage.setItem('wx.cache', cache);
    localStorage.setItem('aos.seen', JSON.stringify({ aos: '999' })); localStorage.setItem('aos.signin.asked', '1'); } catch {} }, [JSON.stringify(HERE), wx('rainy', 41)]);
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url()); if (u.origin !== BASE) return r.abort();
    if (!u.pathname.includes('/api/')) return r.continue();
    const route = u.pathname.slice(u.pathname.indexOf('/api/') + 5), J = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (route === 'state') return J({ storage: true, setup: true, user, plan: null });
    if (route === 'members') return J({ members: [user] });
    return J({}, 401);
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); const pr = [];
  await p.goto(BASE + '/aOS/');
  await p.waitForSelector('#ipsySlot .ipsy-char', { timeout: 15000 }).catch(() => {});
  const got = await p.evaluate(() => { const s = document.querySelector('#ipsySlot .ipsy-char'); return s ? { who: s.dataset.who, wear: s.dataset.wear || '' } : null; });
  if (!got || got.who !== 'owl' || got.wear !== 'umbrella coat scarf') pr.push('the Ipsy bar\'s helper: ' + JSON.stringify(got));
  // Account > Your helper: Dress for the weather, Off and On again
  const wear = () => p.evaluate(() => document.querySelector('#ipsySlot .ipsy-char').dataset.wear || '');
  await p.evaluate(() => aosAccount.open('helper')); await p.waitForTimeout(600);
  const off = p.locator('[data-hwx="off"]');
  if (!await off.isVisible().catch(() => false)) pr.push('no Dress for the weather in Account > Your helper');
  else {
    if (await p.locator('[data-hwx="on"]').getAttribute('aria-pressed') !== 'true') pr.push('Dress for the weather did not start On');
    await off.click(); await p.waitForTimeout(200);
    if (await wear() !== '' || await p.evaluate(() => localStorage.getItem('aos.helper.weather')) !== 'off' || await off.getAttribute('aria-pressed') !== 'true') pr.push('Off: still dressed, or not kept: ' + await wear());
    await p.locator('[data-hwx="on"]').click(); await p.waitForTimeout(200);
    if (await wear() !== 'umbrella coat scarf') pr.push('On again: ' + await wear());
  }
  pr.push(...errs); report('aOS Home: the helper in the Ipsy bar wears a coat, a scarf and an umbrella in cold rain; Account turns it off and on', pr); await ctx.close();
}

await b.close(); server.close();
process.exit(failed ? 1 : 0);
