import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,act,stage,stats,scale,FOES,validSave,tell} from './engine.mjs';
const T=1700000000000;
function pet(mode='standard'){
 let s=act(createGame(T,mode),{type:'hatch'},T);
 for(const kind of ['feed','pet','wash'])s=act(s,{type:'care',kind},T);
 return act(s,{type:'tick'},T+300000/scale(s));
}
function ready(s=pet(),now=T+360000){
 return act(act(s,{type:'schedule',at:now},now-1000),{type:'battle-start'},now);
}
const move=(s,m)=>act(s,{type:'battle-move',move:m},T+360000);
test('hatch is explicit, immutable and single-use',()=>{
 const s=createGame(T);assert.ok(validSave(s));assert.equal(stage(s,T),'Egg');
 assert.throws(()=>act(s,{type:'train',stat:'attack'},T),/Hatch/);
 const h=act(s,{type:'hatch'},T);assert.equal(stage(h,T),'Baby');assert.equal(stage(s,T),'Egg');
 assert.throws(()=>act(h,{type:'hatch'},T),/already/);
});
test('growth requires time, care, bond and later a victory',()=>{
 const s=pet();assert.equal(stage(s,T+300000),'Young warrior');assert.equal(stage(s,T+1000),'Baby');
 assert.equal(stage({...s,bond:0},T+300000),'Baby');
 assert.equal(stage({...s,wins:1,bond:20},T+2*86400000),'Adult warrior');
 assert.equal(stage({...s,bond:20},T+2*86400000),'Young warrior');
 assert.equal(stage(pet('playtest'),T+5000),'Young warrior');
});
test('offline decay floors needs without removing possessions',()=>{
 const s=pet(),n=act(s,{type:'tick'},T+90*86400000);
 assert.ok(Object.values(n.needs).every(x=>x>=20&&x<=100));assert.equal(n.coins,s.coins);assert.deepEqual(n.owned,s.owned);
});
test('backward clock cannot increase needs',()=>{
 const s=pet(),n=act(s,{type:'tick'},T-1000);assert.equal(n.lastAt,s.lastAt);assert.deepEqual(n.needs,s.needs);
});
test('care is free and bond is rate-limited',()=>{
 let s=pet(),bond=s.bond,coins=s.coins;
 for(let i=0;i<10;i++)s=act(s,{type:'care',kind:'feed'},T+300000);
 assert.equal(s.bond,bond);assert.equal(s.coins,coins);assert.equal(s.needs.fullness,100);
 s=act(s,{type:'care',kind:'feed'},T+3600000);assert.equal(s.bond,bond+1);
 assert.throws(()=>act(s,{type:'care',kind:'constructor'},T+3600000),/Unknown/);
});
test('training charges coins, raises stats and obeys milestone cap',()=>{
 let s=pet();s.coins=1000;s=act(s,{type:'train',stat:'attack'},T+300000);
 assert.equal(s.coins,985);assert.equal(stats(s).attack,11);
 for(let i=0;i<2;i++)s=act(s,{type:'train',stat:'attack'},T+300000);
 assert.throws(()=>act(s,{type:'train',stat:'attack'},T+300000),/next arena/);
 assert.throws(()=>act(s,{type:'train',stat:'constructor'},T+300000),/Unknown/);
});
test('equipment charges once and changes damage type',()=>{
 let s=pet();assert.throws(()=>act(s,{type:'buy',id:'hammer'},T+300000),/coins/);
 s.coins=100;s=act(s,{type:'buy',id:'hammer'},T+300000);assert.equal(s.coins,65);assert.equal(stats(s).type,'blunt');
 s=act(s,{type:'buy',id:'hammer'},T+300000);assert.equal(s.coins,65);
 assert.throws(()=>act(s,{type:'equip',id:'wand'},T+300000),/Buy/);
});
test('clues are independent and idempotent',()=>{
 let s=pet();for(const place of ['park','gym','board'])s=act(s,{type:'investigate',place},T+300000);
 const n=s.journal.length;s=act(s,{type:'investigate',place:'park'},T+300000);
 assert.equal(s.intel.bramble.length,3);assert.equal(s.journal.length,n);
});
test('bookings validate time, wait for late players and cannot be overwritten',()=>{
 let s=pet();for(const at of [NaN,T,T+8*86400000])assert.throws(()=>act(s,{type:'schedule',at},T+300000),/future/);
 s=act(s,{type:'schedule',at:T+400000},T+300000);
 assert.throws(()=>act(s,{type:'schedule',at:T+500000},T+300000),/already/);
 assert.throws(()=>act(s,{type:'battle-start'},T+399999),/not ready/);
 for(const kind of ['feed','rest'])s=act(s,{type:'care',kind},T+86400000);
 assert.ok(act(s,{type:'battle-start'},T+86400000).battle);
});
test('good care grants a battle bonus',()=>{
 const s=pet();for(const k of Object.keys(s.needs))s.needs[k]=100;
 assert.equal(ready(s).battle.stats.attack,stats(s).attack+2);
});
test('blocking a heavy attack creates a counterattack opening',()=>{
 let s=ready();s.battle.enemyHp=100;s=move(s,'attack');assert.match(tell(s),/coils/);
 const hp=s.battle.hp;s=move(s,'defend');assert.ok(s.battle.opening);assert.ok(hp-s.battle.hp<FOES[0].attack);
 s=move(s,'attack');assert.ok(s.battle.log.some(x=>x.includes('counterattack opening')));
});
test('weakness and resistance affect damage',()=>{
 const a=ready(),b=ready();a.battle.stats.type='slash';b.battle.stats.type='magic';
 assert.ok(move(a,'attack').battle.enemyHp<move(b,'attack').battle.enemyHp);
});
test('power strike cooldown and single-use recovery are enforced',()=>{
 let s=move(ready(),'skill');assert.equal(s.battle.cooldown,3);assert.throws(()=>move(s,'skill'),/cooling/);
 s=move(s,'potion');assert.equal(s.battle.potion,0);assert.throws(()=>move(s,'potion'),/already used/);
});
test('battles block care and equipment changes',()=>{
 const s=ready();assert.throws(()=>act(s,{type:'care',kind:'rest'},T+360000),/battle/);
 assert.throws(()=>act(s,{type:'equip',id:'twig'},T+360000),/battle/);
});
test('defeat preserves coins and equipment; rest clears recovery',()=>{
 let s=ready();s.battle.hp=1;s.battle.stats.speed=0;const coins=s.coins,owned=s.owned;s=move(s,'attack');
 assert.equal(s.battle,null);assert.equal(s.fight,null);assert.equal(s.coins,coins);assert.deepEqual(s.owned,owned);
 assert.ok(s.recoveryUntil>T+360000);s=act(s,{type:'care',kind:'rest'},T+360000);assert.equal(s.recoveryUntil,0);
});
test('victory pays exactly once',()=>{
 let s=ready();s.battle.enemyHp=1;const coins=s.coins;s=move(s,'attack');
 assert.equal(s.wins,1);assert.equal(s.coins,coins+FOES[0].reward);assert.throws(()=>move(s,'attack'),/no active/);
});
test('target practice rewards score once and expired targets miss',()=>{
 let s=act(pet(),{type:'practice-start'},T+300000),coins=s.coins;
 assert.throws(()=>act(s,{type:'train',stat:'attack'},T+300000),/practice/);
 s=act(s,{type:'practice-shot',hit:true},T+303000);assert.equal(s.practice.hits,0);
 for(let i=0;i<9;i++)s=act(s,{type:'practice-shot',hit:true},T+303000);
 assert.equal(s.practice,null);assert.equal(s.coins,coins+32);
 assert.throws(()=>act(s,{type:'practice-shot',hit:true},T+303000),/Start/);
});
test('withdrawal preserves coins and requires a new booking',()=>{
 let s=ready();const coins=s.coins;s=move(s,'retreat');assert.equal(s.coins,coins);assert.equal(s.fight,null);assert.equal(s.battle,null);
});
test('earned coins, legal training and tactical moves complete the campaign',()=>{
 let s=pet(),now=T+400000;
 while(s.coins<500){s=act(s,{type:'practice-start'},now);for(let k=0;k<10;k++)s=act(s,{type:'practice-shot',hit:true},now);}
 for(let i=0;i<3;i++){
  for(const kind of ['feed','pet','rest','wash'])s=act(s,{type:'care',kind},now);
  for(const stat of ['attack','health','defense'])if(s.training[stat]<2)s=act(s,{type:'train',stat},now);
  for(const kind of ['feed','pet','rest','wash'])s=act(s,{type:'care',kind},now);
  for(const id of [['sword','vest'],['hammer','heart'],['wand']][i])s=act(s,{type:'buy',id},now);
  for(const place of ['park','gym','board'])s=act(s,{type:'investigate',place},now);
  s=act(s,{type:'schedule',at:now+1000},now);now+=1000;s=act(s,{type:'battle-start'},now);
  let turns=0;
  while(s.battle&&turns++<50){
   const b=s.battle,intent=FOES[i].pattern[(b.turn-1)%3];
   const m=intent==='heavy'?'defend':b.hp<25&&b.potion?'potion':b.cooldown===0?'skill':'attack';
   s=act(s,{type:'battle-move',move:m},now);assert.ok(validSave(s));
  }
  assert.equal(s.wins,i+1,JSON.stringify(s.journal));now+=1000;
 }
 assert.throws(()=>act(s,{type:'schedule',at:now+1000},now),/champion/);
});
test('invalid and incompatible saves are rejected',()=>{
 assert.equal(validSave(null),false);assert.equal(validSave({v:999}),false);
 const s=pet();assert.ok(validSave(s));s.needs.fullness=NaN;assert.equal(validSave(s),false);
});
test('malformed nested backup data is rejected',()=>{
 for(const change of [s=>s.intel.bramble={},s=>s.journal=[{}],s=>s.recoveryUntil='tomorrow',s=>s.lastCare=null]){
  const s=pet();change(s);assert.equal(validSave(s),false);
 }
});
