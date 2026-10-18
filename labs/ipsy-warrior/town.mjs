import {createGame,act,stage,stats,scale,currentFoe,tell,SHOP,FOES,NEEDS,validSave} from './engine.mjs';
if(window.top!==window.self)throw new Error('Open this game directly.');
const $=s=>document.querySelector(s),root=$('#app'),sheet=$('#sheet'),body=$('#body');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const B=(t,a='')=>`<button type="button" ${a}>${t}</button>`;
const PREFIX='ipsy.warrior.lab.v1.';
let s=null,key='',player='',place='',timer=null,notice=null,revision=0;
try{document.documentElement.dataset.look=localStorage.getItem(PREFIX+'look')||'vintage';}catch{}
function say(t){$('#status').textContent=t;clearTimeout(notice);notice=setTimeout(()=>$('#status').textContent='',5000);}
function portrait(cls='pet'){
 const egg=stage(s)==='Egg',young=!['Egg','Baby'].includes(stage(s));
 return `<svg class="${cls}" viewBox="0 0 200 200" role="img" aria-label="Ipsy ${esc(stage(s))}"><g class="bob">${egg?'<ellipse class="cell" cx="100" cy="100" rx="44" ry="60"/><path d="M60 100l20 12 20-15 20 15 20-12" fill="none" stroke="var(--roof)" stroke-width="6"/>':'<circle class="cell" cx="100" cy="100" r="55"/><circle cx="128" cy="76" r="12" fill="white" opacity=".35"/><ellipse cx="85" cy="98" rx="6" ry="8" fill="#1E2A2C"/><ellipse cx="115" cy="98" rx="6" ry="8" fill="#1E2A2C"/><path d="M92 117q8 9 16 0" fill="none" stroke="#1E2A2C" stroke-width="3"/><ellipse cx="72" cy="115" rx="7" ry="4" fill="var(--roof)"/><ellipse cx="128" cy="115" rx="7" ry="4" fill="var(--roof)"/>'}${young?'<path d="M143 146l27-65m-26 37l23 10" stroke="var(--accent)" stroke-width="8"/><path d="M34 120l22-9 22 9-5 28-17 13-17-13Z" fill="var(--roof)" stroke="var(--accent)" stroke-width="2"/>':''}</g></svg>`;
}
function needs(){return `<div class="needs">${NEEDS.map(k=>`<label>${k} · ${Math.round(s.needs[k])}<progress aria-label="${k}" max="100" value="${s.needs[k]}"></progress></label>`).join('')}</div>`;}
function fightcard(){
 if(s.wins===3)return '<h3>City champion!</h3><p>You completed the first championship.</p>';
 const f=currentFoe(s),ready=s.fight&&Date.now()>=s.fight.at;
 return `<h3>${esc(f.name)} · ${f.reward} coin prize</h3><p>${s.fight?ready?'The crowd is ready. Enter whenever you are.':esc(new Date(s.fight.at).toLocaleString('en-US')):esc(f.title)+' · Book your preparation window.'}</p>`;
}
function start(){
 s=null;clearTimeout(timer);if(sheet.open)sheet.close();
 root.innerHTML=`<small>aOS development lab · not deployed as an app</small><h1>Ipsy Warrior Town</h1><p>Raise your companion. Train your warrior. Prepare for the arena.</p><div class="card"><label>Local player name<input id="player" maxlength="30" autocomplete="off"></label><label>New-pet pace<select id="pace"><option value="playtest">Playtest · 60× time</option><option value="standard">Standard · real time</option></select></label>${B('Open your Ipsy','id="start" class="primary"')}</div><p><small>Names open separate saves in this browser only. These are not private aOS accounts. Use the same name to return to your pet; cloud sync is not connected.</small></p>`;
}
function render(){
 if(!s)return;
 root.innerHTML=`<header class="row"><div><small>${esc(player)}’s adventure</small><h1>Warrior Town</h1></div>${B('Settings','data-open="settings"')}</header><div class="row"><span>${esc(stage(s))} · Bond ${s.bond}</span><span>${s.coins} coins · ${s.wins}/3 wins</span></div>${s.mode==='playtest'?'<p><small>60× playtest pace · first growth: 5 seconds plus three care actions.</small></p>':''}<section class="map" aria-label="Town map">${[['home','Ipsy’s house','⌂'],['store','Upgrade store','⚒'],['park','Park','♣'],['gym','Training gym','★'],['board','Noticeboard','☷'],['arena','City arena','⚑']].map(([id,name,glyph])=>B(`<svg viewBox="0 0 100 85" aria-hidden="true"><rect x="15" y="30" width="70" height="50" rx="5" fill="var(--path)" stroke="var(--accent)" stroke-width="2"/><path d="M8 32L50 5l42 27Z" fill="var(--roof)"/><text x="50" y="64" text-anchor="middle" font-size="30" fill="var(--ink)">${glyph}</text></svg><span>${name}</span>`,`class="place" data-open="${id}"`)).join('')}<div class="town-pet">${portrait('')}</div></section><section class="card">${fightcard()}${B('Prepare / enter','data-open="board"')}</section><section class="card">${needs()}</section><p><small>${esc(s.journal[0])}</small></p><p><small>Local prototype · progress stays in this browser.</small></p>`;
}
function intel(){const f=currentFoe(s),known=s.intel[f.id]||[];return `<h3>Opponent journal · ${known.length}/3 clues</h3>${f.clues.map(c=>`<p>${known.includes(c.place)?esc(c.text):'Undiscovered · '+esc(c.place==='board'?'noticeboard':c.place)}</p>`).join('')}`;}
function clue(p){const known=s.intel[currentFoe(s).id]||[];return s.wins===3?'':B(known.includes(p)?'Clue discovered':'Investigate opponent',`data-clue="${p}" ${known.includes(p)?'disabled':''}`);}
function open(p){
 if(s.battle&&!['arena','settings'].includes(p))p='arena';
 if(s.practice&&!['practice','settings'].includes(p))p='practice';
 place=p;draw();if(!sheet.open)sheet.showModal();
}
function draw(){
 clearTimeout(timer);
 const titles={home:'Ipsy’s house',store:'Upgrade store',park:'Park',gym:'Training gym',board:'Noticeboard',arena:'City arena',practice:'Target practice',settings:'Settings'};
 $('#title').textContent=titles[place];
 if(place==='home')body.innerHTML=portrait()+`<p>${esc(stage(s))} · Bond ${s.bond}</p>`+(s.hatchedAt===null?B('Hatch Ipsy','data-act="hatch" class="primary"'):needs()+`<div class="actions">${[['feed','Feed'],['pet','Pet'],['rest','Rest & recover'],['wash','Wash']].map(([k,t])=>B(t,`data-care="${k}"`)).join('')}</div><p><small>Care is free. Each activity earns bond once per game hour. Young warrior: 3 bonding moments and 5 game minutes. Adult: 2 game days, bond 20, and an arena win.</small></p><details><summary>Adventure journal</summary><ul class="log">${s.journal.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></details>`);
 if(place==='store')body.innerHTML=`<p>${s.coins} coins · Equipment is permanent.</p>`+SHOP.map(i=>`<div class="card row"><div>${esc(i.name)}<br><small>${esc(i.slot)}${i.type?' · '+i.type:''} ${['attack','defense','health','speed'].filter(k=>i[k]).map(k=>`+${i[k]} ${k}`).join(' ')}</small></div>${B(s.equipment[i.slot]===i.id?'Equipped':s.owned.includes(i.id)?'Equip':i.cost+' coins',`data-item="${i.id}" ${s.equipment[i.slot]===i.id?'disabled':''}`)}</div>`).join('');
 if(place==='park')body.innerHTML=`<p>Play for coins, then ask a spectator about your opponent.</p><div class="card"><h3>Target practice</h3><p>10 targets. Earn 5 coins plus 3 per hit.</p>${B('Play target practice','data-act="practice-start" class="primary"')}</div>${clue('park')}${intel()}`;
 if(place==='gym'){
 const st=stats(s);body.innerHTML=`<p>Energy ${Math.round(s.needs.energy)} · ${s.coins} coins</p>`+['attack','defense','health','speed'].map(k=>`<div class="card row"><div>${k}: ${st[k]}<br><small>Training ${s.training[k]}/${3+s.wins*2}</small></div>${B((15+s.training[k]*10)+' coins',`data-train="${k}" ${s.training[k]>=3+s.wins*2?'disabled':''}`)}</div>`).join('')+`<p><small>Each session uses 8 energy. Win fights to raise training caps.</small></p>${clue('gym')}${intel()}`;
 }
 if(place==='board')body.innerHTML=fightcard()+(s.wins===3?'':s.fight?`<p>The crowd waits if you are late.</p>${B('Visit arena','data-open="arena" class="primary"')}`:`<p>Choose time to prepare before the fight.</p><div class="actions">${B(s.mode==='playtest'?'In 10 seconds':'In 10 minutes','data-book="600000"')}${B(s.mode==='playtest'?'In 1 minute':'In 1 hour','data-book="3600000"')}</div>`)+clue('board')+intel();
 if(place==='arena'){
 const b=s.battle;
 body.innerHTML=b?`<p>Turn ${b.turn} · ${esc(b.stats.type)} weapon</p><div class="fighters"><div>${portrait()}Ipsy<progress aria-label="Ipsy health" max="${b.maxHp}" value="${b.hp}"></progress>${b.hp}/${b.maxHp} HP</div><div><div class="monster">${FOES[b.foe].icon}</div>${esc(FOES[b.foe].name)}<progress aria-label="Opponent health" max="${FOES[b.foe].hp}" value="${b.enemyHp}"></progress>${b.enemyHp}/${FOES[b.foe].hp} HP</div></div><p class="intent">${esc(tell(s))}</p><div class="actions">${B('Attack','data-move="attack" class="primary"')}${B(b.cooldown?'Power strike ('+b.cooldown+')':'Power strike',`data-move="skill" ${b.cooldown?'disabled':''}`)}${B('Defend','data-move="defend"')}${B('Recover ('+b.potion+')',`data-move="potion" ${!b.potion?'disabled':''}`)}${B('Withdraw','data-move="retreat"')}</div><p><small>Block a heavy attack to create a counterattack opening. Defend and recovery resolve before incoming damage.</small></p><ol class="log" aria-live="polite">${b.log.map(t=>`<li>${esc(t)}</li>`).join('')}</ol>`:fightcard()+`<p>No coins or equipment are lost on defeat. Rest and book a rematch.</p>${B('Refresh fight status','data-open="arena"')}${s.fight?B('Enter fight',`data-act="battle-start" class="primary" ${Date.now()<s.fight.at?'disabled':''}`):B('Book a fight','data-open="board"')}`;
 }
 if(place==='practice'){
 const q=s.practice;if(!q){body.innerHTML=`<h3>Practice complete</h3><p>${esc(s.journal[0])}</p>${B('Play again','data-act="practice-start"')}`;return;}
 body.innerHTML=`<p>Target ${q.round+1}/10 · ${q.hits} hits</p><div class="targetfield" id="field"><button class="target" id="target" aria-label="Hit target" style="left:${10+(q.round*37)%65}%;top:${8+(q.round*29)%62}%">◎</button></div><p><small>2.2 seconds per target. Tap outside to miss, or focus the target and press Enter.</small></p>`;
 timer=setTimeout(()=>send({type:'practice-shot',hit:false}),Math.max(0,q.deadline-Date.now()));
 }
 if(place==='settings')body.innerHTML=`<h3>Design</h3><div class="actions">${B('Vintage','data-look="vintage"')}${B('Sea glass','data-look="glass"')}</div><p><small>Light/dark and reduced motion follow your device.</small></p><h3>Local save</h3><p>${esc(player)} · ${s.mode==='playtest'?'60× playtest':'standard'} pace</p><p>Local save slots are not private accounts. No cloud sync is connected.</p><div class="actions">${B('Switch local player','id="switch"')}${B('Export backup','id="export"')}</div>`;
}
function send(a){
 try{
  const saved=JSON.parse(localStorage.getItem(key)||'null');
  if(saved&&saved.revision!==revision){s=saved.state;revision=saved.revision;say('Another tab changed this pet. Loaded its latest save.');render();draw();return;}
  const next=act(s,a),record={revision:revision+1,state:next};
  localStorage.setItem(key,JSON.stringify(record));s=next;revision=record.revision;
  if(a.type==='practice-start')place='practice';render();if(sheet.open)draw();
 }catch(e){say(e.message||'Could not save. Export a backup before closing.');}
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');
 if(e.target.closest('#field')&&!b?.matches('#target')){send({type:'practice-shot',hit:false});return;}
 if(!b)return;
 if(b.id==='start'){
  player=$('#player').value.trim().slice(0,30);if(!player){say('Enter a local player name.');return;}
  key=PREFIX+'pet.'+encodeURIComponent(player.toLowerCase());
  try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&!validSave(saved.state))throw new Error('This save is invalid. It has not been overwritten.');
   s=saved?.state||createGame(Date.now(),$('#pace').value);revision=saved?.revision||0;
   if(!saved)localStorage.setItem(key,JSON.stringify({revision,state:s}));render();open(s.battle?'arena':s.practice?'practice':'home');
  }catch(err){s=null;say(err.message);}return;
 }
 if(b.id==='close'){clearTimeout(timer);sheet.close();return;}
 if(b.dataset.open){open(b.dataset.open);return;}
 if(b.dataset.act){send({type:b.dataset.act});return;}
 if(b.dataset.care){send({type:'care',kind:b.dataset.care});return;}
 if(b.dataset.train){send({type:'train',stat:b.dataset.train});return;}
 if(b.dataset.item){send({type:s.owned.includes(b.dataset.item)?'equip':'buy',id:b.dataset.item});return;}
 if(b.dataset.clue){send({type:'investigate',place:b.dataset.clue});return;}
 if(b.dataset.book){send({type:'schedule',at:Date.now()+Number(b.dataset.book)/scale(s)});return;}
 if(b.dataset.move){send({type:'battle-move',move:b.dataset.move});return;}
 if(b.id==='target'){send({type:'practice-shot',hit:true});if(e.detail===0)$('#target')?.focus();return;}
 if(b.dataset.look){document.documentElement.dataset.look=b.dataset.look;try{localStorage.setItem(PREFIX+'look',b.dataset.look);}catch{say('Design preference could not be saved.');}return;}
 if(b.id==='switch'){start();return;}
 if(b.id==='export'){
  const blob=new Blob([JSON.stringify({format:'ipsy-warrior-lab',player,state:s},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ipsy-warrior-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
});
sheet.addEventListener('cancel',()=>clearTimeout(timer));
setInterval(()=>{if(s&&!sheet.open&&document.visibilityState==='visible'){s=act(s,{type:'tick'});render();}},5000);
start();
