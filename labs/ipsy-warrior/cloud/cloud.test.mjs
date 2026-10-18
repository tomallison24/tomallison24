import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,response} from './store.mjs';
import {createGateway} from './gateway.mjs';
// This fixture isolates the storage protocol, not the game engine or Cloudflare runtime.
const engine={createGame:(at,mode)=>({at,mode,coins:20,steps:[]}),act:(s,a)=>{if(a.kind==='invalid')throw Error('rule');return {...s,coins:s.coins+1,steps:[...s.steps,a.type]};},validSave:s=>s&&s.mode==='standard'&&Number.isFinite(s.coins)&&Array.isArray(s.steps)};
class AtomicStorage{
 data=new Map();tail=Promise.resolve();writes=0;fail=false;
 transaction(fn){
  const job=this.tail.then(async()=>{
   const draft=structuredClone(this.data);let n=0;
   const result=await fn({get:async k=>structuredClone(draft.get(k)),put:async(k,v)=>{if(this.fail)throw Error('sensitive-storage-detail');draft.set(k,structuredClone(v));n++;}});
   this.data=draft;this.writes+=n;return result;
  });this.tail=job.catch(()=>{});return job;
 }
}
const req=(b,method='POST',headers={})=>new Request('https://ipsy.internal/pet',{method,headers:{'Content-Type':'application/json',...headers},...(method==='GET'?{}:{body:JSON.stringify(b)})});
const command=(id='command-0001',revision=0,action={type:'create'})=>({id,revision,action});
function setup(){const db=new AtomicStorage();return {db,run:createStore(db,{...engine,now:()=>1700000000000})};}
async function create(x){const r=await x.run('alice',req(command()));assert.equal(r.status,200);return r.json();}
async function body(r){return {status:r.status,...await r.json()};}
test('empty reads write nothing',async()=>{const x=setup(),r=await body(await x.run('alice',req(null,'GET')));assert.equal(r.revision,0);assert.equal(r.state,null);assert.equal(x.db.writes,0);});
test('create forces standard pace and one pet',async()=>{const x=setup(),r=await create(x);assert.equal(r.state.mode,'standard');assert.equal(r.revision,1);assert.equal((await x.run('alice',req(command('command-0002',1)))).status,409);});
test('identical create retry does not write twice',async()=>{const x=setup();await create(x);const r=await body(await x.run('alice',req(command())));assert.equal(r.duplicate,true);assert.equal(r.revision,1);assert.equal(x.db.writes,1);});
test('concurrent first-device creates have exactly one winner',async()=>{const x=setup();const rs=await Promise.all(['command-0001','command-0002'].map(id=>x.run('alice',req(command(id)))));assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);assert.equal(x.db.writes,1);});
test('stale revision returns latest state without writing',async()=>{const x=setup();await create(x);const r=await body(await x.run('alice',req(command('command-0002',0,{type:'hatch'}))));assert.equal(r.status,409);assert.equal(r.error,'conflict');assert.equal(r.revision,1);assert.equal(x.db.writes,1);});
test('simultaneous commands from two devices cannot overwrite',async()=>{const x=setup();await create(x);const rs=await Promise.all(['command-0002','command-0003'].map(id=>x.run('alice',req(command(id,1,{type:'hatch'})))));assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);const r=await body(await x.run('alice',req(null,'GET')));assert.equal(r.state.coins,21);assert.equal(r.revision,2);});
test('action retry never applies reward twice',async()=>{const x=setup();await create(x);const b=command('command-0002',1,{type:'hatch'});await x.run('alice',req(b));const r=await body(await x.run('alice',req(b)));assert.equal(r.duplicate,true);assert.equal(r.state.coins,21);assert.equal(x.db.writes,2);});
test('same ID with different content is rejected',async()=>{const x=setup();await create(x);const r=await x.run('alice',req(command('command-0001',1,{type:'hatch'})));assert.equal(r.status,409);assert.equal(x.db.writes,1);});
test('retry returns current revision, not an old snapshot',async()=>{const x=setup();await create(x);const b=command('command-0002',1,{type:'hatch'});await x.run('alice',req(b));await x.run('alice',req(command('command-0003',2,{type:'care',kind:'feed'})));const r=await body(await x.run('alice',req(b)));assert.equal(r.revision,3);assert.equal(r.state.coins,22);});
test('delete retry and old create retry cannot resurrect pet',async()=>{const x=setup();await create(x);const b=command('command-0002',1,{type:'delete'});assert.equal((await x.run('alice',req(b))).status,200);const retry=await body(await x.run('alice',req(b)));assert.equal(retry.state,null);assert.equal(retry.revision,2);const old=await body(await x.run('alice',req(command())));assert.equal(old.state,null);assert.equal(x.db.writes,2);});
test('new pet after deletion keeps monotonic revision',async()=>{const x=setup();await create(x);await x.run('alice',req(command('command-0002',1,{type:'delete'})));const r=await body(await x.run('alice',req(command('command-0003',2))));assert.equal(r.revision,3);assert.equal(r.state.coins,20);});
test('wrong owner cannot read or mutate existing object',async()=>{const x=setup();await create(x);for(const r of [req(null,'GET'),req(command('command-0002',1,{type:'delete'}))])assert.equal((await x.run('bob',r)).status,403);assert.equal(x.db.writes,1);});
test('missing owner is refused',async()=>{const x=setup();assert.equal((await x.run(null,req(null,'GET'))).status,403);});
test('game-rule failures roll back without consuming revision',async()=>{const x=setup();await create(x);const r=await body(await x.run('alice',req(command('command-0002',1,{type:'care',kind:'invalid'}))));assert.equal(r.status,422);assert.equal(x.db.writes,1);assert.equal((await body(await x.run('alice',req(null,'GET')))).revision,1);});
test('raw snapshots, client clocks, playtest options and unknown actions are rejected',async()=>{for(const action of [{type:'create',mode:'playtest'},{type:'tick'},{type:'care',kind:'feed',now:0},{type:'save',state:{coins:999999}}]){const x=setup();assert.equal((await x.run('alice',req(command('command-0001',0,action)))).status,400);assert.equal(x.db.writes,0);}});
test('bad envelope, numeric IDs and fractional revisions are rejected',async()=>{for(const b of [{...command(),userId:'bob'},{...command(),id:12345678},{...command(),revision:.5},{...command(),revision:'0'},{...command(),action:null}]){const x=setup();assert.equal((await x.run('alice',req(b))).status,400);}});
test('oversized bodies are rejected before writing',async()=>{const x=setup(),r=new Request('https://ipsy.internal/pet',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(2049)});assert.equal((await x.run('alice',r)).status,413);assert.equal(x.db.writes,0);});
test('invalid JSON and content type are rejected',async()=>{const x=setup();assert.equal((await x.run('alice',new Request('https://ipsy.internal/pet',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'}))).status,400);assert.equal((await x.run('alice',req(command(),'POST',{'Content-Type':'text/plain'}))).status,415);});
test('no transactional adapter means no writes',async()=>{const run=createStore({},engine);assert.equal((await run('alice',req(command()))).status,503);});
test('storage failure is generic and rolls back',async()=>{const x=setup();x.db.fail=true;const r=await body(await x.run('alice',req(command())));assert.equal(r.status,500);assert.equal(r.error,'server');assert.equal(x.db.data.size,0);});
test('corrupt saved record is not returned',async()=>{const x=setup();x.db.data.set('pet',{v:1,owner:'alice',revision:0,history:[],pet:{coins:'bad'}});const r=await body(await x.run('alice',req(null,'GET')));assert.equal(r.status,500);assert.equal(r.state,undefined);});
function gateway(user={id:'alice'},binding=true,owner=true){
 const called=[];const ns={idFromName:id=>id,get:id=>({fetch:async request=>{called.push({id,owner:request.headers.get('X-Game-Owner')});return response({ok:true});}})};
 const env={ACCOUNTS:{get:async()=>owner?'owner':null},...(binding?{GAMES_SAVES:ns}:{})};
 const run=createGateway({kv:e=>e.ACCOUNTS,sessionUser:async()=>user});
 const call=(changes={})=>run({request:new Request('https://aos.test/games/api/pet',{headers:{'X-Games':'1',...changes.headers},...changes.init}),params:{route:['pet']},env});
 return {called,env,run,call};
}
test('gateway uses authenticated identity and replaces forged owner header',async()=>{const x=gateway();assert.equal((await x.call({headers:{'X-Game-Owner':'bob'}})).status,200);assert.deepEqual(x.called,[{id:'alice',owner:'alice'}]);});
test('gateway routes different verified users to different objects',async()=>{for(const id of ['alice','bob']){const x=gateway({id});await x.call();assert.equal(x.called[0].id,id);}});
test('signed-out and removed-session results cannot reach storage',async()=>{const x=gateway(null);assert.equal((await x.call()).status,401);assert.equal(x.called.length,0);});
test('missing setup or binding fails closed',async()=>{assert.equal((await gateway({id:'alice'},false).call()).status,503);assert.equal((await gateway({id:'alice'},true,false).call()).status,503);});
test('cross-origin request and user query are refused',async()=>{const x=gateway();assert.equal((await x.call({headers:{Origin:'https://evil.test'}})).status,403);const r=await x.run({request:new Request('https://aos.test/games/api/pet?user=bob',{headers:{'X-Games':'1'}}),params:{route:'pet'},env:x.env});assert.equal(r.status,400);assert.equal(x.called.length,0);});
test('unknown routes and unsupported methods do not reach storage',async()=>{const x=gateway();assert.equal((await x.run({request:new Request('https://aos.test/games/api/other',{headers:{'X-Games':'1'}}),params:{route:'other'},env:x.env})).status,404);assert.equal((await x.call({init:{method:'DELETE'}})).status,405);assert.equal(x.called.length,0);});
test('private replies disable caching and do not add CORS access',()=>{const r=response({ok:true});assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);});

import * as realEngine from '../engine.mjs';
import {IpsySave,default as publicWorker} from './worker.mjs';
test('real engine persists hatching and care using server time',async()=>{
 const db=new AtomicStorage();let now=1700000000000;const run=createStore(db,{...realEngine,now:()=>now});
 let revision=0,index=0;
 const send=async action=>{const r=await body(await run('alice',req(command('realgame-'+(++index),revision,action))));assert.equal(r.status,200);revision=r.revision;return r;};
 let r=await send({type:'create'});assert.equal(r.state.mode,'standard');assert.equal(r.state.hatchedAt,null);
 r=await send({type:'hatch'});assert.equal(r.state.hatchedAt,now);
 for(const kind of ['feed','pet','wash'])r=await send({type:'care',kind});
 now+=300000;assert.equal(realEngine.stage(r.state,now),'Young warrior');assert.equal(r.state.bond,3);
});
test('real engine enforces affordability and retries do not duplicate coin rewards',async()=>{
 const db=new AtomicStorage();const now=1700000000000;const run=createStore(db,{...realEngine,now:()=>now});let revision=0,index=0;
 const send=async action=>{const c=command('realcoin-'+(++index),revision,action),r=await body(await run('alice',req(c)));if(r.status===200)revision=r.revision;return {c,r};};
 await send({type:'create'});await send({type:'hatch'});
 assert.equal((await send({type:'buy',id:'sword'})).r.status,422);
 await send({type:'practice-start'});let last;
 for(let i=0;i<10;i++)last=await send({type:'practice-shot',hit:true});
 assert.equal(last.r.state.coins,55);
 const retry=await body(await run('alice',req(last.c)));assert.equal(retry.state.coins,55);assert.equal(retry.duplicate,true);
 const bought=await send({type:'buy',id:'sword'});assert.equal(bought.r.state.coins,20);assert.equal(bought.r.state.equipment.weapon,'sword');
});
test('worker class wires the real engine; public worker has no data endpoint',async()=>{
 const obj=new IpsySave({storage:new AtomicStorage()});const r=await body(await obj.fetch(req(command(),'POST',{'X-Game-Owner':'alice'})));
 assert.equal(r.status,200);assert.equal(r.state.coins,20);assert.equal(r.state.mode,'standard');assert.equal(publicWorker.fetch().status,404);
});

test('gateway forwards POST commands into an authenticated real-engine object',async()=>{
 const obj=new IpsySave({storage:new AtomicStorage()});
 const env={ACCOUNTS:{get:async()=> 'owner'},GAMES_SAVES:{idFromName:id=>id,get:()=>obj}};
 const run=createGateway({kv:e=>e.ACCOUNTS,sessionUser:async()=>({id:'alice'})});
 const request=new Request('https://aos.test/games/api/pet',{method:'POST',headers:{'X-Games':'1','Content-Type':'application/json'},body:JSON.stringify(command())});
 const r=await body(await run({request,params:{route:'pet'},env}));assert.equal(r.status,200);assert.equal(r.state.coins,20);
});
