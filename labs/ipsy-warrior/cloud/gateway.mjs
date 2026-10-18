import {response} from './store.mjs';
export function createGateway({kv,sessionUser}){
 return async({request,params,env})=>{
  try{
   if([].concat(params?.route||[]).join('/')!=='pet'||request.headers.get('X-Games')!=='1')return response({error:'not-found'},404);
   if(!['GET','POST'].includes(request.method))return response({error:'method'},405);
   const origin=request.headers.get('Origin');
   if(origin&&origin!==new URL(request.url).origin)return response({error:'origin'},403);
   if(new URL(request.url).search)return response({error:'query-not-supported'},400);
   const db=kv(env);if(!db||!(await db.get('owner')))return response({error:'accounts-off'},503);
   const me=await sessionUser(db,request);if(!me)return response({error:'signin'},401);
   const ns=env.GAMES_SAVES;if(!ns||typeof ns.idFromName!=='function'||typeof ns.get!=='function')return response({error:'game-storage-off'},503);
   const stub=ns.get(ns.idFromName(me.id));
   const headers={'X-Game-Owner':me.id};if(request.headers.has('Content-Type'))headers['Content-Type']=request.headers.get('Content-Type');
   return await stub.fetch(new Request('https://ipsy.internal/pet',{method:request.method,headers,body:request.method==='POST'?request.body:undefined,duplex:'half'}));
  }catch{return response({error:'server'},500);}
 };
}
