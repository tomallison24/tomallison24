import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname,resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE_PATH||'playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://test').pathname,file=resolve(root,'.'+path);if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}const content=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript'})[extname(file)]||'text/plain');res.end(content);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const helper=`let current=null;window.AllisonOS={account:{user:()=>current?{id:current,name:current}:null,token:()=>current?'token-'+current:null,signIn:async()=>{window.accountTest.set('alice');},signOut:()=>window.accountTest.set(null)}};window.accountTest={set:id=>{current=id;dispatchEvent(new CustomEvent('aos:account'));}};`;
try{
 browser=await chromium.launch({headless:true});
 for(const look of ['vintage','glass'])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(l=>{localStorage.setItem('ipsy.warrior.lab.v1.look',l);localStorage.setItem('ipsy.warrior.lab.v1.pet.legacy','untouched');},look);
  await page.route('**/home/account.js',r=>r.fulfill({contentType:'text/javascript',body:helper}));
  let configured=false,drop=false,conflict=false,posts=[];const records=new Map(),receipts=new Set();
  await page.route('**/games/api/pet',async route=>{
   const req=route.request(),owner=req.headers().authorization?.replace('Bearer token-','');
   if(!configured){await route.fulfill({status:503,json:{error:'game-storage-off'}});return;}
   let record=records.get(owner)||{revision:0,state:null,updatedAt:100};
   if(req.method()==='POST'){
    const c=req.postDataJSON();posts.push(JSON.stringify(c));
    if(!receipts.has(owner+':'+c.id)){
     if(conflict){conflict=false;record={...record,revision:record.revision+2,state:{...record.state,bond:3}};records.set(owner,record);await route.fulfill({status:409,json:{ok:false,error:'conflict',...record}});return;}
     if(c.action.type==='create')record.state={v:1,mode:'standard',hatchedAt:null,coins:20,bond:0,needs:{fullness:85,happiness:85,energy:85,cleanliness:85}};
     if(c.action.type==='hatch')record.state.hatchedAt=Date.now();
     if(c.action.type==='care'){record.state.bond++;record.state.needs.fullness=100;}
     record.revision++;records.set(owner,record);receipts.add(owner+':'+c.id);
    }
    if(drop){drop=false;await route.abort();return;}
   }
   await route.fulfill({json:{ok:true,...record}});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/labs/ipsy-warrior/account-test.html`);
  await page.locator('#signin').click();await page.getByText('Cloud saves are not configured.',{exact:false}).waitFor();assert.equal(await page.locator('#create').count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('ipsy.warrior.lab.v1.pet.legacy')),'untouched');
  configured=true;await page.locator('#refresh').click();await page.locator('#create').click();await page.locator('#hatch').click();
  assert.ok((await page.locator('#pet-summary').textContent()).includes('Bond 0'));
  drop=true;await page.locator('#feed').click();await page.locator('#retry').waitFor();
  assert.ok((await page.locator('#pet-summary').textContent()).includes('Bond 0'));
  const original=posts.at(-1);await page.locator('#retry').click();await page.waitForFunction(()=>document.querySelector('#pet-summary')?.textContent.includes('Bond 1'));
  assert.equal(posts.at(-1),original);
  conflict=true;const count=posts.length;await page.locator('#pet').getByRole('button',{name:'Pet',exact:true}).click();
  await page.getByText('Another device changed Ipsy.',{exact:false}).waitFor();assert.equal(posts.length,count+1);
  assert.ok((await page.locator('#pet-summary').textContent()).includes('Bond 3'));
  await page.evaluate(()=>window.accountTest.set('bob'));assert.equal(await page.locator('#pet').count(),0);
  await page.locator('#refresh').click();await page.locator('#create').waitFor();assert.equal(await page.locator('#pet').count(),0);
  await page.locator('#signout').click();assert.equal(await page.locator('#create').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  await context.close();console.log(`${look}/${theme}: account flow passed`);
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
