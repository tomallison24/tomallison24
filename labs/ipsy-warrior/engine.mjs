export const VERSION = 1;
export const NEEDS = ['fullness', 'happiness', 'energy', 'cleanliness'];
export const SHOP = [
  {id:'twig',name:'Practice sword',slot:'weapon',type:'slash',attack:0,cost:0},
  {id:'sword',name:'Leafblade',slot:'weapon',type:'slash',attack:3,cost:35},
  {id:'hammer',name:'Oak hammer',slot:'weapon',type:'blunt',attack:3,cost:35},
  {id:'wand',name:'Starlight wand',slot:'weapon',type:'magic',attack:3,cost:35},
  {id:'vest',name:'Padded vest',slot:'armor',defense:2,cost:30},
  {id:'plate',name:'Town guard armor',slot:'armor',defense:4,cost:70},
  {id:'heart',name:'Heart charm',slot:'charm',health:12,cost:30},
  {id:'swift',name:'Swift charm',slot:'charm',speed:2,cost:30}
];
export const FOES = [
  {id:'bramble',name:'Bramble',title:'The park challenger',icon:'🌿',hp:38,attack:9,defense:1,speed:2,weak:'slash',resist:'magic',pattern:['normal','heavy','normal'],reward:55,
   tells:{normal:'Bramble draws back a vine.',heavy:'Bramble coils both vines for a heavy lash.'},
   clues:[{place:'park',text:'The gardener says sharp blades cut through Bramble’s vines.'},{place:'gym',text:'Coach: coiled vines mean a heavy lash. Defend, then counter during recovery.'},{place:'board',text:'Scouting report: Bramble resists magic. Bring a slashing weapon.'}]},
  {id:'ironhide',name:'Ironhide',title:'The armored veteran',icon:'🛡️',hp:62,attack:13,defense:3,speed:2,weak:'blunt',resist:'slash',pattern:['normal','normal','heavy'],reward:85,
   tells:{normal:'Ironhide lowers one shoulder.',heavy:'Ironhide stamps twice. A heavy charge is coming.'},
   clues:[{place:'park',text:'A spectator says Ironhide stamps twice before charging.'},{place:'gym',text:'Coach: blunt weapons exploit Ironhide’s armor. Blocking a charge leaves an opening.'},{place:'board',text:'Scouting report: Ironhide resists slashing damage.'}]},
  {id:'wisp',name:'Volt Wisp',title:'The city championship',icon:'⚡',hp:82,attack:15,defense:2,speed:5,weak:'magic',resist:'blunt',pattern:['guard','normal','heavy'],reward:130,
   tells:{guard:'Volt Wisp surrounds itself with a barrier against physical attacks.',normal:'Volt Wisp gathers a small spark.',heavy:'Volt Wisp glows brightly. A heavy surge is coming.'},
   clues:[{place:'park',text:'The librarian says magic can pass through Volt Wisp’s physical barrier.'},{place:'gym',text:'Coach: Volt Wisp is vulnerable to magic and resistant to blunt attacks.'},{place:'board',text:'Scouting report: the bright glow signals a heavy surge. Defend to create a counterattack opening.'}]}
];
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const copy = x => structuredClone(x);
const fail = m => { throw new Error(m); };
export function createGame(now=Date.now(),mode='standard') {
 return {v:VERSION,mode:mode==='playtest'?'playtest':'standard',createdAt:now,lastAt:now,hatchedAt:null,
  needs:Object.fromEntries(NEEDS.map(k=>[k,85])),bond:0,careCount:0,lastCare:{},coins:20,
  xp:0,wins:0,training:{attack:0,defense:0,health:0,speed:0},owned:['twig'],equipment:{weapon:'twig',armor:null,charm:null},
  intel:{},fight:null,battle:null,practice:null,recoveryUntil:0,journal:['A new egg has arrived in town.']};
}
export const scale = s => s.mode==='playtest'?60:1;
export function stage(s,now=Date.now()) {
 if(s.hatchedAt===null)return 'Egg';
 const age=Math.max(0,now-s.hatchedAt)*scale(s);
 if(age>=2*86400000 && s.bond>=20 && s.wins>=1)return 'Adult warrior';
 if(age>=300000 && s.bond>=3 && s.careCount>=3)return 'Young warrior';
 return 'Baby';
}
export function evolve(s,now=Date.now()) {
 const n=copy(s),hours=Math.min(48,Math.max(0,now-s.lastAt)/3600000*scale(s));
 if(n.hatchedAt!==null) NEEDS.forEach((k,i)=>n.needs[k]=clamp(n.needs[k]-hours*[3,2,2.5,2][i],20,100));
 n.lastAt=Math.max(now,s.lastAt);return n;
}
export const currentFoe = s => FOES[Math.min(s.wins,FOES.length-1)];
export function stats(s) {
 const items=Object.values(s.equipment).map(id=>SHOP.find(x=>x.id===id)).filter(Boolean);
 const add=k=>items.reduce((n,x)=>n+(x[k]||0),0);
 return {health:48+s.training.health*5+add('health')+Math.floor(s.xp/50)*3,
  attack:9+s.training.attack*2+add('attack')+Math.floor(s.xp/50),
  defense:2+s.training.defense+add('defense'),speed:3+s.training.speed+add('speed'),
  type:(SHOP.find(x=>x.id===s.equipment.weapon)||SHOP[0]).type};
}
export const tell = s => s.battle ? FOES[s.battle.foe].tells[FOES[s.battle.foe].pattern[(s.battle.turn-1)%3]] : '';
function note(s,t){s.journal.unshift(t);s.journal=s.journal.slice(0,30);}
function requirePet(s){if(s.hatchedAt===null)fail('Hatch Ipsy at home first.');}
function available(s,practice=false){if(s.battle)fail('Finish the arena battle first.');if(s.practice&&!practice)fail('Finish target practice first.');}
export function act(state,action,now=Date.now()) {
 const s=evolve(state,now),a=action||{};
 if(a.type==='tick')return s;
 if(a.type==='hatch'){
  if(s.hatchedAt!==null)fail('Ipsy has already hatched.');
  s.hatchedAt=now;note(s,'Ipsy hatched! A little warrior’s story begins.');return s;
 }
 requirePet(s);
 if(a.type==='care'){
  available(s);const map={feed:'fullness',pet:'happiness',rest:'energy',wash:'cleanliness'};
  if(!Object.hasOwn(map,a.kind))fail('Unknown care action.');
  const k=map[a.kind];s.needs[k]=clamp(s.needs[k]+35,20,100);
  const last=s.lastCare[a.kind];
  if(last===undefined || (now-last)*scale(s)>=3600000){s.bond++;s.careCount++;s.lastCare[a.kind]=now;}
  if(a.kind==='rest')s.recoveryUntil=0;
  note(s,{feed:'Ipsy enjoyed a warm meal.',pet:'Ipsy leans into your hand.',rest:'Ipsy rested and recovered.',wash:'Ipsy is clean and comfortable.'}[a.kind]);return s;
 }
 if(a.type==='train'){
  available(s);if(!Object.hasOwn(s.training,a.stat))fail('Unknown training.');
  const level=s.training[a.stat],cost=15+level*10;
  if(level>=3+s.wins*2)fail('Win the next arena event to unlock more training.');
  if(s.needs.energy<30)fail('Ipsy needs rest before training.');
  if(s.coins<cost)fail('Earn more coins at the park.');
  s.coins-=cost;s.needs.energy-=8;s.training[a.stat]++;note(s,`${a.stat} training completed.`);return s;
 }
 if(a.type==='buy'||a.type==='equip'){
  available(s);const item=SHOP.find(x=>x.id===a.id);if(!item)fail('Unknown equipment.');
  if(!s.owned.includes(item.id)){
   if(a.type==='equip')fail('Buy that equipment first.');
   if(s.coins<item.cost)fail('Not enough coins. Try target practice.');
   s.coins-=item.cost;s.owned.push(item.id);
  }
  s.equipment[item.slot]=item.id;note(s,`${item.name} equipped.`);return s;
 }
 if(a.type==='investigate'){
  available(s);if(s.wins>=FOES.length)fail('You have completed the first championship.');
  const f=currentFoe(s),clue=f.clues.find(x=>x.place===a.place);if(!clue)fail('No clue here.');
  s.intel[f.id]||=[];if(!s.intel[f.id].includes(a.place)){s.intel[f.id].push(a.place);note(s,clue.text);}return s;
 }
 if(a.type==='schedule'){
  available(s);if(stage(s,now)==='Baby')fail('Complete three different care actions and give Ipsy five game minutes to grow.');
  if(s.wins>=FOES.length)fail('You are the city champion! The MVP campaign is complete.');
  if(s.fight)fail('Your fight is already booked.');
  if(!Number.isFinite(a.at) || a.at<now+1000 || a.at>now+7*86400000)fail('Choose a future time within seven days.');
  s.fight={foe:s.wins,at:a.at};note(s,`${currentFoe(s).name} fight booked. The crowd will wait for you.`);return s;
 }
 if(a.type==='battle-start'){
  available(s);if(!s.fight||now<s.fight.at)fail('Your scheduled fight is not ready yet.');
  if(now<s.recoveryUntil)fail('Rest at home before the rematch.');
  if(s.needs.energy<30 || s.needs.fullness<30)fail('Feed and rest Ipsy before entering.');
  const p=stats(s),bonus=NEEDS.every(k=>s.needs[k]>=65)?2:0;
  s.battle={foe:s.fight.foe,turn:1,hp:p.health,maxHp:p.health,enemyHp:FOES[s.fight.foe].hp,stats:{...p,attack:p.attack+bonus},
   cooldown:0,opening:false,potion:1,log:['The city gathers. The fight begins!',bonus?'Well cared for: +2 attack this fight.':'Ipsy enters the arena.']};return s;
 }
 if(a.type==='battle-move'){
  if(!s.battle)fail('There is no active battle.');
  const b=s.battle,f=FOES[b.foe],move=a.move;
  if(!['attack','skill','defend','potion','retreat'].includes(move))fail('Unknown battle action.');
  if(move==='skill'&&b.cooldown>0)fail('Power strike is cooling down.');
  if(move==='potion'&&!b.potion)fail('You already used your recovery item.');
  if(move==='retreat'){
   s.battle=null;s.fight=null;s.needs.energy=Math.max(20,s.needs.energy-10);note(s,'You withdrew safely. Book a rematch when ready.');return s;
  }
  const intent=f.pattern[(b.turn-1)%3],log=t=>{b.log.push(t);b.log=b.log.slice(-12);};
  const defended=move==='defend';let usedSkill=false;
  const win=()=>{
   s.coins+=f.reward;s.xp+=35+b.foe*20;s.wins++;s.bond+=3;s.needs.energy=Math.max(20,s.needs.energy-12);
   s.battle=null;s.fight=null;note(s,`Victory over ${f.name}! +${f.reward} coins. ${s.wins===FOES.length?'Ipsy is the city champion!':''}`);
  };
  const lose=()=>{
   s.battle=null;s.fight=null;s.needs.energy=Math.max(20,s.needs.energy-15);s.recoveryUntil=now+300000/scale(s);
   note(s,`${f.name} won this time. No coins or equipment lost. Rest and prepare for a rematch.`);
  };
  const player=()=>{
   if(move==='potion'){b.potion=0;const h=Math.min(20,b.maxHp-b.hp);b.hp+=h;log(`Recovery item restored ${h} health.`);return;}
   if(defended){log('Ipsy raises his guard.');return;}
   let multiplier=b.stats.type===f.weak?1.5:b.stats.type===f.resist?.65:1;
   if(intent==='guard'&&b.stats.type!=='magic')multiplier*=.45;
   if(b.opening)multiplier*=1.5;
   const damage=Math.max(1,Math.round((b.stats.attack*(move==='skill'?1.65:1)-f.defense)*multiplier));
   b.enemyHp=Math.max(0,b.enemyHp-damage);
   log(`${move==='skill'?'Power strike':'Attack'}: ${damage} damage${b.stats.type===f.weak?' — weakness exploited!':''}${b.opening?' — counterattack opening!':''}`);
   b.opening=false;if(move==='skill'){b.cooldown=3;usedSkill=true;}
  };
  const enemy=()=>{
   if(intent==='guard'){log(`${f.name} maintains a physical barrier.`);return;}
   const damage=Math.max(1,Math.round((f.attack*(intent==='heavy'?1.9:1)-b.stats.defense)*(defended?.35:1)));
   b.hp=Math.max(0,b.hp-damage);log(`${f.name} ${intent==='heavy'?'heavy attack':'attacks'}: ${damage} damage.`);
   if(defended&&intent==='heavy'){b.opening=true;log('The blocked heavy attack leaves an opening next turn!');}
  };
  if(defended||move==='potion'||b.stats.speed>=f.speed){player();if(b.enemyHp<=0){win();return s;}enemy();}
  else{enemy();if(b.hp<=0){lose();return s;}player();}
  if(b.enemyHp<=0){win();return s;}
  if(b.hp<=0){lose();return s;}
  if(b.cooldown>0&&!usedSkill)b.cooldown--;
  b.turn++;return s;
 }
 if(a.type==='practice-start'){
  available(s);s.practice={round:0,hits:0,deadline:now+2200};return s;
 }
 if(a.type==='practice-shot'){
  available(s,true);const p=s.practice;if(!p)fail('Start target practice first.');
  if(a.hit===true&&now<=p.deadline)p.hits++;
  p.round++;p.deadline=now+2200;
  if(p.round>=10){const reward=5+p.hits*3;s.coins+=reward;s.needs.happiness=Math.min(100,s.needs.happiness+8);note(s,`Target practice: ${p.hits}/10 hits. +${reward} coins.`);s.practice=null;}
  return s;
 }
 fail('Unknown action.');
}
export function validSave(s){
 try{
  return !!(s?.v===VERSION && ['standard','playtest'].includes(s.mode) && Number.isFinite(s.lastAt) && Number.isFinite(s.createdAt)
   && (s.hatchedAt===null||Number.isFinite(s.hatchedAt)) && Number.isFinite(s.bond) && s.bond>=0
   && Number.isFinite(s.careCount) && s.careCount>=0 && Number.isFinite(s.coins)&&s.coins>=0
   && Number.isInteger(s.wins)&&s.wins>=0&&s.wins<=FOES.length && Number.isFinite(s.xp)&&s.xp>=0
   && NEEDS.every(k=>Number.isFinite(s.needs[k])&&s.needs[k]>=20&&s.needs[k]<=100)
   && ['attack','defense','health','speed'].every(k=>Number.isInteger(s.training[k])&&s.training[k]>=0)
   && Array.isArray(s.owned)&&s.owned.every(id=>SHOP.some(i=>i.id===id))
   && ['weapon','armor','charm'].every(slot=>s.equipment[slot]===null || (s.owned.includes(s.equipment[slot])&&SHOP.some(i=>i.id===s.equipment[slot]&&i.slot===slot)))
   && s.equipment.weapon!==null && s.lastCare && typeof s.lastCare==='object' && !Array.isArray(s.lastCare)
   && Object.values(s.lastCare).every(x=>Number.isFinite(x)&&x>=0)
   && s.intel && typeof s.intel==='object' && !Array.isArray(s.intel)
   && Object.entries(s.intel).every(([id,places])=>FOES.some(f=>f.id===id)&&Array.isArray(places)&&places.every(p=>['park','gym','board'].includes(p)))
   && Number.isFinite(s.recoveryUntil)&&s.recoveryUntil>=0
   && Array.isArray(s.journal)&&s.journal.length<=30&&s.journal.every(x=>typeof x==='string'&&x.length<=500)
   && (!s.fight||(Number.isInteger(s.fight.foe)&&s.fight.foe===s.wins&&s.fight.foe<FOES.length&&Number.isFinite(s.fight.at)))
   && (!s.practice||(Number.isInteger(s.practice.round)&&s.practice.round>=0&&s.practice.round<10&&Number.isInteger(s.practice.hits)&&s.practice.hits>=0&&s.practice.hits<=s.practice.round&&Number.isFinite(s.practice.deadline)))
   && (!s.battle||(s.fight&&s.battle.foe===s.fight.foe&&Number.isInteger(s.battle.turn)&&s.battle.turn>0&&s.battle.hp>0&&s.battle.enemyHp>0&&Array.isArray(s.battle.log)&&Number.isFinite(s.battle.stats.attack)&&Number.isFinite(s.battle.stats.defense)&&Number.isFinite(s.battle.stats.speed)&&Number.isFinite(s.battle.hp)&&Number.isFinite(s.battle.maxHp)&&Number.isFinite(s.battle.enemyHp)&&Number.isFinite(s.battle.cooldown)&&[0,1].includes(s.battle.potion)&&['slash','blunt','magic'].includes(s.battle.stats.type)&&s.battle.log.every(x=>typeof x==='string'&&x.length<500))));
 }catch{return false;}
}
