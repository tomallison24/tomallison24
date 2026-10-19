import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,sep,extname} from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=dirname(fileURLToPath(import.meta.url));
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname,file=resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
 if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.mjs':'text/javascript'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch();
 for(const reducedMotion of ['no-preference','reduce']){
  const context=await browser.newContext({viewport:{width:1000,height:900},reducedMotion}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#player').fill('Animated Ipsy');await page.locator('#start').click();
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ipsy.warrior.lab.v1.pet.animated%20ipsy')));
  await page.locator('[data-act="hatch"]').click();assert.equal(await page.locator('#action-stage .pose-hatch').count(),1);
  // The tray is a choice, not a feeding command; canceling it must not change the save.
  const before=await save();await page.locator('[data-care="feed"]').click();assert.equal(await page.locator('[data-food]').count(),4);await page.locator('#food-back').click();assert.deepEqual(await save(),before);
  for(const food of ['berries','apple','soup','carrot']){
   const revision=(await save()).revision;
   await page.locator('[data-care="feed"]').click();await page.locator(`[data-food="${food}"]`).click();
   assert.equal(await page.locator('#action-stage .pose-feed').count(),1);assert.equal((await save()).revision,revision+1);
   const animation=await page.locator('#action-stage .action-prop').evaluate(el=>getComputedStyle(el).animationName);
   assert.equal(animation,reducedMotion==='reduce'?'none':'take-bite');
  }
  for(const [kind,pose] of [['pet','pet'],['wash','wash'],['rest','rest']]){
   await page.locator(`[data-care="${kind}"]`).click();assert.equal(await page.locator(`#action-stage .pose-${pose}`).count(),1);
  }
  // Completing an animation cannot issue a second care command.
  const revision=(await save()).revision;await page.waitForTimeout(900);assert.equal((await save()).revision,revision);
  const handle=await page.locator('#world').elementHandle();await page.locator('#close').click();
  // Tap the noticeboard front step and verify pathfinding opens the real game location.
  const bounds=await page.locator('#world').boundingBox();
  await page.mouse.click(bounds.x+bounds.width/2+200*.95,bounds.y+bounds.height/2-40*.95);
  await page.waitForFunction(()=>document.querySelector('#sheet').open&&document.querySelector('#title').textContent==='Noticeboard',{},{timeout:12000});
  await page.locator('[data-clue="board"]').click();assert.equal(await page.locator('#action-stage .pose-read').count(),1);
  assert.ok(await handle.evaluate(el=>el.isConnected),'state updates must preserve the mounted world');
  await page.locator('#close').click();await page.locator('#world').focus();
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(250);await page.keyboard.up('ArrowRight');
  assert.equal(await page.locator('#sheet').evaluate(el=>el.open),false);
  // A held touch joystick can be canceled without leaving Ipsy walking.
  const joy=await page.locator('#joystick').boundingBox();await page.mouse.move(joy.x+joy.width*.8,joy.y+joy.height*.5);await page.mouse.down();await page.waitForTimeout(120);await page.mouse.up();
  assert.equal(await page.locator('#joystick').evaluate(el=>el.style.getPropertyValue('--stick-x')),'0px');
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('[data-open="settings"]').click();await page.locator('#switch').click();assert.equal(await handle.evaluate(el=>el.isConnected),false);
  assert.deepEqual(errors,[]);await context.close();console.log(`living town, food choices, action reactions, navigation and cleanup (${reducedMotion}): passed`);
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
