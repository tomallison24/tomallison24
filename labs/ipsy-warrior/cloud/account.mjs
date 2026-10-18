import {createClient} from './client.mjs';
if(window.top!==window.self)throw new Error('Open this test directly.');
function boot(){
 const root=document.querySelector('#account-app'),account=window.AllisonOS?.account;
 if(!account){root.textContent='The aOS account helper could not load. No game data was changed.';return;}
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const needs=['fullness','happiness','energy','cleanliness'];
 const valid=s=>s&&s.v===1&&s.mode==='standard'&&Number.isFinite(s.coins)&&Number.isFinite(s.bond)&&(s.hatchedAt===null||Number.isFinite(s.hatchedAt))&&needs.every(k=>Number.isFinite(s.needs?.[k])&&s.needs[k]>=20&&s.needs[k]<=100);
 const storage={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v),removeItem:k=>localStorage.removeItem(k)};
 let signing=false,message='';
 try{document.documentElement.dataset.look=localStorage.getItem('ipsy.warrior.lab.v1.look')||'vintage';}catch{}
 const client=createClient({account,storage,validate:valid,onChange:render});
 const button=(text,id,disabled=false)=>`<button type="button" id="${id}" ${disabled?'disabled':''}>${text}</button>`;
 const words={'game-storage-off':'Cloud saves are not configured. No local fallback pet was created.','accounts-off':'Family accounts are not set up for this server.',signin:'Sign in again. A pending action will not be replayed under another person.',conflict:'Another device changed Ipsy. The latest state is loaded; your action was not automatically repeated.',network:'The connection was interrupted. An earlier action may already have reached the server.','pending-storage':'The retry journal could not be read or updated. New actions are blocked.','game-rule':'That action was rejected by the game. Refresh before continuing.','invalid-response':'The server returned an invalid response.','stale-response':'An older response was rejected.'};
 function render(){
  const x=client.snapshot(),pet=x.data?.state,locked=x.busy||signing||x.pending||x.status!=='ready';
  root.innerHTML=`<h1>Ipsy account connection test</h1><p>This opt-in lab tests account saves. It is not the full town interface and does not migrate local pets.</p><p id="connection" role="status" aria-live="polite">${esc(message||words[x.error]||x.error||x.status)}</p><div class="actions">${button(signing?'Signing in…':'Sign in with aOS','signin',signing||x.busy)}${button('Refresh my account pet','refresh',!x.owner||x.busy||signing||x.status==='blocked')}${button('Sign out of aOS here','signout',!x.owner||signing)}</div>${x.owner?`<p>Signed-in session: ${esc(account.user()?.name||x.owner)}</p>`:''}${x.pending?`<section class="card"><h2>Unresolved action</h2><p>New actions are blocked. Retry sends the identical command; it does not create a second action.</p>${button('Retry the pending action','retry',x.busy||signing)}</section>`:''}${x.status==='empty'&&!x.pending?`<section class="card"><h2>No account pet yet</h2><p>Creating an egg starts a new account pet at standard pace. Your local test pets remain untouched.</p>${button('Create my account egg','create',x.busy||signing)}</section>`:''}${pet?`<section class="card" id="pet"><h2>Your account Ipsy</h2><p id="pet-summary">${pet.hatchedAt===null?'Egg':'Hatched'} · ${pet.coins} coins · Bond ${pet.bond} · Revision ${x.data.revision}</p>${needs.map(k=>`<label>${k}: ${Math.round(pet.needs[k])}<progress aria-label="${k}" max="100" value="${pet.needs[k]}"></progress></label>`).join('')}<div class="actions">${pet.hatchedAt===null?button('Hatch Ipsy','hatch',locked):[['feed','Feed'],['pet','Pet'],['rest','Rest & recover'],['wash','Wash']].map(([id,text])=>button(text,id,locked)).join('')}</div><p>Only server-confirmed changes are shown. Offline play and full-town account controls are not connected in this screen.</p></section>`:''}<p><a href="./">Return to the separate local town</a></p><p>No cloud resources are provisioned by opening this page.</p>`;
 }
 root.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;message='';
  if(b.id==='signin'){
   signing=true;render();try{await account.signIn();await client.load();}catch{message='Sign-in was canceled or unavailable. No new game action was sent.';}finally{signing=false;render();}return;
  }
  if(b.id==='signout'){account.signOut();client.identityChanged();return;}
  if(b.id==='refresh'){await client.load();return;}
  if(b.id==='retry'){await client.retry();return;}
  if(b.id==='create'){await client.send({type:'create'});return;}
  if(b.id==='hatch'){await client.send({type:'hatch'});return;}
  if(['feed','pet','rest','wash'].includes(b.id))await client.send({type:'care',kind:b.id});
 });
 addEventListener('aos:account',()=>{message='';client.identityChanged();});
 addEventListener('storage',e=>{if(e.key==='aos.session'){message='';client.identityChanged();}});
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
