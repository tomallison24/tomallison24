import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const root = process.cwd(), apps = ['orders','travel','meals','calendar','notes','news','fitness'];
const server = http.createServer((req,res) => {
  let name = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if (name.endsWith('/')) name += 'index.html';
  const file = path.resolve(root,'.' + name);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  const html = name.endsWith('.html');
  res.setHeader('Content-Type',html ? 'text/html' : name.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
  let content = fs.readFileSync(file);
  if (html) content = content.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'');
  res.end(content);
});
await new Promise(r => server.listen(0,'127.0.0.1',r));
const base = 'http://127.0.0.1:' + server.address().port, browser = await chromium.launch();
let tested = 0;
try {
  for (const width of [375,390,768]) for (const design of ['glass','vintage']) for (const scheme of ['light','dark']) {
    const ctx = await browser.newContext({viewport:{width,height:844},colorScheme:scheme,serviceWorkers:'block'});
    await ctx.route(u => !u.href.startsWith(base),route => route.abort());
    for (const app of apps) {
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror',e => errors.push(e.message));
      await page.goto(base + '/' + app + '/');
      await page.evaluate(({app,design}) => {
        document.documentElement.dataset.look = design;
        const style = document.getElementById('vintage'); if (style) style.media = design === 'vintage' ? 'all' : 'not all';
        localStorage.setItem('ipsy.' + app + '.ok','yes');
        localStorage.setItem('aos.helper','{"who":"fox","name":""}');
      },{app,design});
      await page.addScriptTag({url:base + '/home/ipsy.js'});
      await page.evaluate(app => {
        const selectors = {calendar:'.dockr .ipsyslot',notes:'.dock > .ipsyslot',travel:'#ipsySlot',meals:'.dock > span',fitness:'.dock > .ipsyslot'};
        if (app === 'fitness') document.querySelector('.dock > .ipsyslot').hidden = false;   // off until turned on in Settings (fitness/app.js)
        window.AllisonOS.ipsy.mount({app,name:app,endpoint:'../' + app + '/api/ipsy',headers:{},intro:'Visual test',placeholder:'Ask Ipsy',suggestions:[],consent:'Visual test only; nothing is sent.',label:()=>'',tools:{},context:()=> 'Visual test',slot:selectors[app] ? document.querySelector(selectors[app]) : null});
      },app);
      const label = [app,width,design,scheme].join('/');
      const rect = await page.locator('.ipsy-btn').boundingBox();
      assert.equal(Math.round(rect.width),app === 'calendar' ? 64 : 78,label + ': width');
      assert.equal(Math.round(rect.height),app === 'calendar' ? 64 : 78,label + ': height');
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width && rect.y >= 0 && rect.y + rect.height <= 844,label + ': viewport');
      if (app === 'calendar') {
        const tabs = await page.locator('.dock .tabs').boundingBox(), fab = await page.locator('#fab').boundingBox();
        assert.ok(rect.x >= tabs.x + tabs.width + 2,label + ': clear of tabs');
        assert.ok(rect.x + rect.width <= fab.x,label + ': clear of new event');
      }
      if (['notes','travel','fitness'].includes(app)) {
        const slot = await page.locator(app === 'travel' ? '#ipsySlot' : '.dock > .ipsyslot').boundingBox();
        assert.ok(slot.width >= rect.width && slot.height >= rect.height,label + ': slot fits');
      }
      assert.ok((await page.locator('.ipsy-btn .h-bob').evaluate(e=>getComputedStyle(e).animationName)).includes('ipsyBob'),label + ': bobs at rest');
      assert.ok((await page.locator('.ipsy-btn .h-lids').evaluate(e=>getComputedStyle(e).animationName)).includes('ipsyBlink'),label + ': blinks');
      for (const [mood,sel,anim] of [['talk','.h-mouth','ipsyJaw'],['read','.h-eyes','ipsyRead'],['scan','.h-eyes','ipsyDart'],['write','.h-rigR','ipsyScribble'],['done','.h-hop','ipsyHop'],['think','.h-bubble','ipsyBubble']]) {
        await page.locator('.ipsy-btn .ipsy-host').evaluate((e,m)=>e.dataset.mood=m,mood);
        assert.ok((await page.locator('.ipsy-btn ' + sel).first().evaluate(e=>getComputedStyle(e).animationName)).includes(anim),label + ': ' + mood);
      }
      const specsOff = await page.waitForFunction(() => getComputedStyle(document.querySelector('.ipsy-btn .h-specs')).opacity === '0', null, { timeout: 3000 }).then(() => true, () => false);   // they fade off (a transition): waited for
      assert.ok(specsOff,label + ': glasses off but for scanning');
      await page.locator('.ipsy-btn .ipsy-host').evaluate(e=>e.dataset.mood='idle');
      await page.emulateMedia({reducedMotion:'reduce'});
      for (const selector of ['.h-bob','.h-lids','.h-shadow']) assert.equal(await page.locator('.ipsy-btn ' + selector).evaluate(e=>getComputedStyle(e).animationName),'none',label + ': reduced motion ' + selector);
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.evaluate(() => { Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'}); document.dispatchEvent(new Event('visibilitychange')); });
      assert.equal(await page.locator('.ipsy-btn .h-bob').evaluate(e=>getComputedStyle(e).animationPlayState),'paused',label + ': background pause');
      await page.evaluate(() => { Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'}); document.dispatchEvent(new Event('visibilitychange')); });
      await page.click('.ipsy-btn');
      await page.waitForFunction(() => Math.abs(document.querySelector('.ipsy-speaker').getBoundingClientRect().width - document.querySelector('.ipsy-btn').getBoundingClientRect().width) < 1);
      const speaker = await page.locator('.ipsy-speaker').boundingBox();
      assert.equal(Math.round(speaker.width),Math.round(rect.width),label + ': open chat character fits');
      assert.deepEqual(errors,[],label + ': script errors');
      tested++; await page.close();
    }
    await ctx.close();
  }
  console.log('Ipsy presence: ' + tested + ' app/size/design/theme combinations passed.');
} finally { await browser.close(); await new Promise(r=>server.close(r)); }
