import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,sep,extname} from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=dirname(fileURLToPath(import.meta.url));
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const data=await readFile(file);
  res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.mjs':'text/javascript'})[extname(file)]||'application/octet-stream');
  res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({headless:true});
 for(const look of ['vintage','glass'])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme,reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(l=>localStorage.setItem('ipsy.warrior.lab.v1.look',l),look);
  await page.reload();
  await page.locator('#player').fill('Test warrior');await page.locator('#start').click();
  await page.locator('[data-act="hatch"]').click();
  for(const k of ['feed','pet','wash']){await page.locator(`[data-care="${k}"]`).click();if(k==='feed')await page.locator('[data-food="berries"]').click();}
  await page.locator('#close').click();await page.locator('.travel-menu summary').click();await page.locator('[data-open="park"]').click();
  await page.locator('[data-clue="park"]').click();await page.locator('[data-act="practice-start"]').click();
  for(let i=0;i<10;i++)await page.locator('#target').click();
  assert.equal(await page.getByText('Practice complete',{exact:true}).count(),1);
  await page.locator('#close').click();await page.locator('[data-open="store"]').click();
  await page.locator('[data-item="sword"]').click();assert.equal(await page.locator('[data-item="sword"]').textContent(),'Equipped');
  await page.evaluate(()=>{
   const key='ipsy.warrior.lab.v1.pet.test%20warrior',r=JSON.parse(localStorage.getItem(key));
   r.state.hatchedAt=Date.now()-10000;localStorage.setItem(key,JSON.stringify(r));
  });
  await page.reload();await page.locator('#player').fill('Test warrior');await page.locator('#start').click();
  await page.locator('#close').click();await page.locator('.travel-menu summary').click();await page.locator('.place[data-open="board"]').click();
  await page.locator('[data-clue="board"]').click();await page.locator('[data-book="600000"]').click();
  await page.evaluate(()=>{
   const key='ipsy.warrior.lab.v1.pet.test%20warrior',r=JSON.parse(localStorage.getItem(key));
   r.state.fight.at=Date.now()-1000;localStorage.setItem(key,JSON.stringify(r));
  });
  await page.reload();await page.locator('#player').fill('Test warrior');await page.locator('#start').click();
  await page.locator('#close').click();await page.locator('.travel-menu summary').click();await page.locator('.place[data-open="arena"]').click();
  await page.locator('[data-act="battle-start"]').click();
  for(let i=0;i<15&&await page.locator('[data-move="attack"]').count();i++){
   const intent=await page.locator('.intent').textContent(),skill=page.locator('[data-move="skill"]');
   await page.locator(intent.includes('coils')?'[data-move="defend"]':await skill.isEnabled()?'[data-move="skill"]':'[data-move="attack"]').click();
  }
  assert.ok((await page.locator('#app').textContent()).includes('Ironhide'));
  await page.locator('#close').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('[data-open="settings"]').click();await page.getByRole('button',{name:'Sea glass',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('data-look'),'glass');
  await page.locator('#switch').click();await page.locator('#player').fill('Second warrior');await page.locator('#start').click();
  assert.equal(await page.locator('[data-act="hatch"]').count(),1);
  assert.deepEqual(errors,[]);await context.close();console.log(`${look}/${theme}: passed`);
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
