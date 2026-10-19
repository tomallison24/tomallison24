// The town simulation is independent of rendering and of the saved game economy.
export const WORLD = {width:1600,height:1200};
export const LOCATIONS = [
 {id:'home',name:'Ipsy’s house',x:380,y:330,door:{x:380,y:410},color:'#bc7955'},
 {id:'store',name:'Upgrade store',x:1100,y:330,door:{x:1100,y:410},color:'#678b86'},
 {id:'gym',name:'Training gym',x:380,y:830,door:{x:380,y:910},color:'#b79857'},
 {id:'arena',name:'City arena',x:1100,y:850,door:{x:1100,y:930},color:'#9485a8'},
 {id:'park',name:'Park',x:1350,y:620,door:{x:1300,y:670},color:'#789877'},
 {id:'board',name:'Noticeboard',x:800,y:550,door:{x:800,y:600},color:'#b79857'}
];
const buildings=LOCATIONS.slice(0,4);
const CELL=40,COLS=WORLD.width/CELL,ROWS=WORLD.height/CELL;
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function walkable(x,y){
 return x>=80&&y>=100&&x<=1520&&y<=1120
  && !buildings.some(b=>x>b.x-128&&x<b.x+128&&y>b.y-135&&y<b.y+48)
  && !((x-800)**2/150**2+(y-290)**2/105**2<1);
}
// Four-way grid search avoids clipping corners of buildings and the pond.
export function pathTo(from,to){
 const cell=p=>({x:Math.floor(p.x/CELL),y:Math.floor(p.y/CELL)});
 const center=p=>({x:p.x*CELL+CELL/2,y:p.y*CELL+CELL/2});
 const start=cell(from),goal=cell(to),key=p=>p.y*COLS+p.x;
 if(!walkable(to.x,to.y)||!walkable(center(goal).x,center(goal).y))return [];
 const queue=[start],seen=new Map([[key(start),null]]);let found=false;
 for(let i=0;i<queue.length;i++){
  const p=queue[i];if(key(p)===key(goal)){found=true;break;}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const n={x:p.x+dx,y:p.y+dy},c=center(n);
   if(n.x<0||n.y<0||n.x>=COLS||n.y>=ROWS||seen.has(key(n))||!walkable(c.x,c.y))continue;
   seen.set(key(n),p);queue.push(n);
  }
 }
 if(!found)return [];
 const path=[];let p=goal;
 while(key(p)!==key(start)){path.unshift(center(p));p=seen.get(key(p));}
 path.push({...to});return path;
}
const starts=[{x:1300,y:710},{x:1040,y:450},{x:910,y:570},{x:500,y:900},{x:1050,y:690},{x:580,y:820},{x:650,y:380},{x:1150,y:480},{x:990,y:940},{x:470,y:470}];
const residents=[
 ['Moss','Gardener','#92b78a','park','A little care makes everything grow.'],
 ['Pip','Courier','#e4b574','store','Special delivery! Race you to the square?'],
 ['Lumi','Stargazer','#a6a5d0','board','Even little warriors have big dreams.'],
 ['Bramble','Challenger','#718e70','gym','Meet me in the arena when you’re ready!'],
 ['Nori','Baker','#d59d9a','store','Fresh berry buns. Best smell in town.'],
 ['Pebble','Coach','#86a9bc','gym','Train a little. Rest a little. Repeat.'],
 ['Fern','Explorer','#b4c184','park','There are butterflies by the pond today.'],
 ['Ember','Smith','#d68d6b','store','A good blade deserves a brave heart.'],
 ['Wisp','Dreamer','#b6a4c9','arena','Watch the heavy attack. Then counter!'],
 ['Bean','Neighbor','#dcc889','home','Ipsy! Come and say hello!']
];
export function createWorld(){
 return {time:0,player:{x:600,y:640,face:1,moving:false,path:[]},target:null,
  npcs:residents.map(([name,role,color,home,line],i)=>({name,role,color,home,line,x:starts[i].x,y:starts[i].y,face:1,path:[],wait:i*.6,trip:i,moving:false,bubble:'',bubbleUntil:0,greetAt:0}))};
}
export function moveTo(world,point){world.player.path=pathTo(world.player,point);return world.player.path.length>0;}
function follow(actor,dt,speed){
 const target=actor.path[0];actor.moving=false;if(!target)return;
 const d=distance(actor,target),step=Math.min(d,speed*dt);
 if(d<1){actor.path.shift();return;}
 const x=actor.x+(target.x-actor.x)/d*step,y=actor.y+(target.y-actor.y)/d*step;
 if(!walkable(x,y)){actor.path=[];return;}
 actor.face=target.x<actor.x?-1:1;actor.x=x;actor.y=y;actor.moving=true;
 if(d<=step+.1)actor.path.shift();
}
export function nearest(world){
 const candidates=[...LOCATIONS.map(l=>({kind:'place',id:l.id,name:l.name,...l.door})),...world.npcs.map((n,i)=>({kind:'npc',id:i,name:n.name,x:n.x,y:n.y}))];
 return candidates.filter(c=>distance(c,world.player)<100).sort((a,b)=>distance(a,world.player)-distance(b,world.player))[0]||null;
}
export function talk(world,index){
 const n=world.npcs[index];if(!n||distance(n,world.player)>110)return null;
 n.path=[];n.wait=5;n.face=world.player.x<n.x?-1:1;n.bubble=n.line;n.bubbleUntil=world.time+5;n.greetAt=world.time+20;return n;
}
export function stepWorld(world,dt,input={x:0,y:0}){
 dt=Math.min(.05,Math.max(0,dt));world.time+=dt;
 const p=world.player,magnitude=Math.hypot(input.x,input.y);
 if(magnitude){
  p.path=[];p.moving=false;const speed=185*dt/Math.max(1,magnitude),x=p.x+input.x*speed,y=p.y+input.y*speed;
  if(walkable(x,p.y)){p.moving=p.moving||x!==p.x;p.x=x;}
  if(walkable(p.x,y)){p.moving=p.moving||y!==p.y;p.y=y;}
  if(input.x)p.face=input.x<0?-1:1;
 }else follow(p,dt,185);
 world.npcs.forEach((n,i)=>{
  if(n.wait>0){n.wait-=dt;n.moving=false;}
  else if(!n.path.length){
   const stops=[LOCATIONS.find(l=>l.id===n.home).door,{x:640,y:600},{x:930,y:680},{x:800,y:430},{x:1320,y:710}];
   n.path=pathTo(n,stops[n.trip++%stops.length]);n.wait=2+(i%4);
  }else follow(n,dt,42+(i%3)*14);
  if(distance(n,p)<85&&world.time>n.greetAt){n.bubble=`Hello, Ipsy!`;n.bubbleUntil=world.time+3;n.greetAt=world.time+25;n.wait=2;}
  // Residents stop to greet each other as their routines cross.
  const friend=world.npcs.find((other,j)=>j<i&&distance(n,other)<45);
  if(friend&&world.time>n.greetAt){n.bubble=`Hi, ${friend.name}!`;n.bubbleUntil=world.time+3;n.greetAt=world.time+18;n.wait=2;}
 });
}
