import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,stepWorld,walkable,pathTo,moveTo,LOCATIONS,distance,talk} from './world.mjs';
import {createGame,act} from './engine.mjs';
import {FOODS,reactionFor} from './animation.mjs';
test('every location can be reached without walking through buildings or the pond',()=>{
 for(const destination of LOCATIONS){
  const w=createWorld();assert.ok(moveTo(w,destination.door),destination.id);
  for(let i=0;i<2000&&w.player.path.length;i++){stepWorld(w,.05);assert.ok(walkable(w.player.x,w.player.y));}
  assert.ok(distance(w.player,destination.door)<1,destination.id);
 }
});
test('pathfinding routes around buildings rather than through them',()=>{
 const path=pathTo({x:380,y:180},{x:380,y:410});assert.ok(path.length);assert.ok(path.some(p=>Math.abs(p.x-380)>=128));
 assert.deepEqual(pathTo({x:600,y:640},{x:380,y:300}),[]);assert.deepEqual(pathTo({x:600,y:640},{x:800,y:290}),[]);
});
test('keyboard movement respects collision, bounds, diagonal speed and long-frame clamping',()=>{
 const w=createWorld();w.player.x=240;w.player.y=300;
 for(let i=0;i<20;i++)stepWorld(w,.05,{x:1,y:0});assert.ok(w.player.x<=252);
 const a=createWorld(),b=createWorld();stepWorld(a,.05,{x:1,y:0});stepWorld(b,.05,{x:1,y:1});assert.ok(Math.abs(distance(a.player,{x:600,y:640})-distance(b.player,{x:600,y:640}))<.01);
 const old={...a.player};stepWorld(a,60,{x:1,y:0});assert.ok(distance(a.player,old)<10);
});
test('all residents follow routines, remain on walkable ground, and can be greeted nearby',()=>{
 const w=createWorld(),before=w.npcs.map(n=>({x:n.x,y:n.y}));
 for(let i=0;i<1200;i++){stepWorld(w,.05);for(const n of w.npcs)assert.ok(walkable(n.x,n.y),n.name);}
 assert.ok(w.npcs.every((n,i)=>distance(n,before[i])>10));
 const n=w.npcs[0];w.player.x=n.x;w.player.y=n.y+40;assert.equal(talk(w,0).name,n.name);assert.equal(n.bubble,n.line);assert.equal(n.path.length,0);
 w.player.x=100;w.player.y=1100;assert.equal(talk(w,0),null);
});
test('food choice uses the existing feeding rule and produces a distinct presentation',()=>{
 const before=act(createGame(0),{type:'hatch'},0);
 const after=act(before,{type:'care',kind:'feed'},1);
 for(const food of FOODS){const r=reactionFor({type:'care',kind:'feed'},before,after,food);assert.equal(r.pose,'feed');assert.equal(r.icon,food.icon);assert.equal(r.title,food.line);}
 assert.equal(after.needs.fullness,100);assert.equal(after.bond,1);assert.equal(before.bond,0);
});
