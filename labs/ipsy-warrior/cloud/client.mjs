const PREFIX='ipsy.warrior.account.pending.';
export function createClient({account,transport=fetch,storage,validate,uuid=()=>crypto.randomUUID(),endpoint='/games/api/pet',timeoutMs=12000,onChange=()=>{}}){
 let owner=null,token=null,epoch=0,data=null,pending=null,busy=false,status='signed-out',error=null,controller=null;
 const copy=x=>x===null?null:structuredClone(x),key=()=>PREFIX+encodeURIComponent(owner);
 const emit=()=>onChange();
 function identity(){
  const user=account.user(),id=user&&typeof user.id==='string'?user.id:null,t=account.token();
  const next=id&&t?id:null,nextToken=next?t:null;
  if(next===owner&&nextToken===token)return;
  controller?.abort();epoch++;owner=next;token=nextToken;data=null;pending=null;busy=false;error=null;status=owner?'idle':'signed-out';
  if(!owner)return;
  try{
   const raw=storage.getItem(key());if(!raw)return;
   const r=JSON.parse(raw),c=r.command;
   if(r.v!==1||r.owner!==owner||!c||typeof c.id!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(c.id)||!Number.isSafeInteger(c.revision)||c.revision<0||!c.action||typeof c.action.type!=='string'||new TextEncoder().encode(JSON.stringify(c)).length>2048)throw Error();
   pending=c;status='pending';
  }catch{status='blocked';error='pending-storage';}
 }
 const snapshot=()=>{identity();return {owner,status,error,busy,pending:!!pending,data:copy(data)};};
 function adopt(body){
  if(!body||!Number.isSafeInteger(body.revision)||body.revision<0||!Number.isFinite(body.updatedAt)||!(body.state===null||validate(body.state)))throw Error('invalid-response');
  if(data&&body.revision<data.revision)throw Error('stale-response');
  data={revision:body.revision,state:copy(body.state),updatedAt:body.updatedAt};
 }
 function clearPending(){
  try{storage.removeItem(key());pending=null;return true;}
  catch{status='pending';error='pending-storage';return false;}
 }
 async function request(command){
  identity();if(!owner||busy||status==='blocked')return false;
  const id=owner,t=token,g=epoch;busy=true;error=null;status=command?'saving':'loading';controller=new AbortController();emit();
  const aborter=controller,timer=setTimeout(()=>aborter.abort(),timeoutMs);
  const current=()=>{identity();return g===epoch&&owner===id&&token===t;};
  try{
   const r=await transport(endpoint,{method:command?'POST':'GET',headers:{Authorization:'Bearer '+t,'X-Games':'1',...(command?{'Content-Type':'application/json'}:{})},body:command?JSON.stringify(command):undefined,cache:'no-store',credentials:'same-origin',redirect:'error',signal:aborter.signal});
   if(!current())return false;
   const body=await r.json();if(!current())return false;
   if(r.ok){
    if(body.ok!==true)throw Error('invalid-response');adopt(body);
    if(command&&!clearPending())return false;
    status=pending?'pending':data.state===null?'empty':'ready';return true;
   }
   error=typeof body.error==='string'?body.error:'http-'+r.status;
   if(r.status===401){data=null;status='signin';return false;}
   if(r.status===409&&body.error==='conflict'){
    adopt(body);if(command&&!clearPending())return false;
    status='ready';if(data.state===null)status='empty';return false;
   }
   if(command&&[400,403,404,409,415,422].includes(r.status)&&!clearPending())return false;
   status=pending?'pending':r.status===503?'unavailable':'error';return false;
  }catch(e){
   if(current()){error=e.message==='invalid-response'||e.message==='stale-response'?e.message:'network';status=pending?'pending':'error';}
   return false;
  }finally{clearTimeout(timer);if(current()){busy=false;controller=null;emit();}}
 }
 return {
  snapshot,
  identityChanged(){identity();emit();},
  async load(){identity();if(status==='blocked'||busy||!owner)return false;return request(null);},
  async send(action){
   identity();if(!owner||busy||pending||!data||!['ready','empty'].includes(status))return false;
   try{
    const c={id:uuid(),revision:data.revision,action:structuredClone(action)};
    if(typeof c.id!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(c.id)||new TextEncoder().encode(JSON.stringify(c)).length>2048)throw Error();
    storage.setItem(key(),JSON.stringify({v:1,owner,command:c}));pending=c;
   }catch{status='blocked';error='pending-storage';emit();return false;}
   return request(pending);
  },
  async retry(){identity();if(!owner||busy||!pending||status==='blocked')return false;return request(copy(pending));}
 };
}
