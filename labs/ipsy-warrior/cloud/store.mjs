const fail=(status,error)=>{throw Object.assign(new Error(error),{status});};
export const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Referrer-Policy':'no-referrer'}});
export async function readCommand(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))fail(415,'json-required');
 const reader=request.body?.getReader();if(!reader)fail(400,'bad-json');
 let size=0;const chunks=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();fail(413,'too-big');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}
 let b;try{b=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail(400,'bad-json');}
 const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
 if(!exact(b,['id','revision','action'])||typeof b.id!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(b.id)||!Number.isSafeInteger(b.revision)||b.revision<0)fail(400,'bad-command');
 const a=b.action;
 if(!a||typeof a.type!=='string')fail(400,'bad-action');
 const fields={create:[],delete:[],hatch:[],care:['kind'],train:['stat'],buy:['id'],equip:['id'],investigate:['place'],schedule:['at'],'battle-start':[],'battle-move':['move'],'practice-start':[],'practice-shot':['hit']};
 if(!Object.hasOwn(fields,a.type)||!exact(a,['type',...fields[a.type]]))fail(400,'bad-action');
 for(const k of fields[a.type])if(k==='hit'?typeof a[k]!=='boolean':k==='at'?!Number.isSafeInteger(a[k]):typeof a[k]!=='string'||a[k].length>80)fail(400,'bad-action');
 return {id:b.id,revision:b.revision,action:Object.fromEntries(['type',...fields[a.type]].map(k=>[k,a[k]]))};
}
export function createStore(storage,{createGame,act,validSave,now=Date.now}){
 const view=r=>({ok:true,revision:r.revision,state:r.pet,updatedAt:r.updatedAt});
 return async(owner,request)=>{
  try{
   if(typeof owner!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(owner))fail(403,'owner-required');
   if(new URL(request.url).pathname!=='/pet')fail(404,'not-found');
   if(!['GET','POST'].includes(request.method))fail(405,'method');
   if(typeof storage?.transaction!=='function')fail(503,'transactional-storage-required');
   const b=request.method==='POST'?await readCommand(request):null;
   const result=await storage.transaction(async tx=>{
    const r=await tx.get('pet')||{v:1,owner,revision:0,pet:null,updatedAt:0,history:[]};
    if(r.owner!==owner)fail(403,'wrong-owner');
    if(r.v!==1||!Number.isSafeInteger(r.revision)||r.revision<0||!Array.isArray(r.history))fail(500,'invalid-record');
    if(r.pet!==null&&!validSave(r.pet))fail(500,'invalid-record');
    if(!b)return {body:view(r),status:200};
    const fingerprint=JSON.stringify({revision:b.revision,action:b.action}),prior=r.history.find(x=>x.id===b.id);
    if(prior){if(prior.fingerprint!==fingerprint)fail(409,'id-reused');return {body:{...view(r),duplicate:true},status:200};}
    if(b.revision!==r.revision)return {body:{...view(r),error:'conflict',ok:false},status:409};
    if(r.revision===Number.MAX_SAFE_INTEGER)fail(409,'revision-exhausted');
    let pet;
    if(b.action.type==='create'){if(r.pet)fail(409,'pet-exists');pet=createGame(now(),'standard');}
    else if(b.action.type==='delete'){if(!r.pet)fail(404,'no-pet');pet=null;}
    else{if(!r.pet)fail(404,'no-pet');try{pet=act(r.pet,b.action,now());}catch{fail(422,'game-rule');}}
    if(pet!==null&&!validSave(pet))fail(500,'invalid-game-state');
    const next={v:1,owner,revision:r.revision+1,pet,updatedAt:now(),history:[...r.history,{id:b.id,fingerprint}].slice(-128)};
    await tx.put('pet',next);return {body:{...view(next),duplicate:false},status:200};
   });
   return response(result.body,result.status);
  }catch(e){return response({ok:false,error:e.status?e.message:'server'},e.status||500);}
 };
}
