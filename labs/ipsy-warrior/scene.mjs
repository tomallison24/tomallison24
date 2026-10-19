import {WORLD,LOCATIONS,createWorld,stepWorld,moveTo,nearest,talk,distance} from './world.mjs';
import {stage} from './engine.mjs';
const TAU=Math.PI*2;
const ellipse=(c,x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);c.fill();};
const box=(c,x,y,w,h,r,color)=>{c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
const text=(c,t,x,y,size=14,color='#3b493c')=>{c.fillStyle=color;c.font=`600 ${size}px system-ui`;c.textAlign='center';c.fillText(t,x,y);};
function line(c,points,color,width){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
export function drawCreature(c,{x,y,color='#e7bb62',time=0,moving=false,face=1,egg=false,young=false,emotion='',equipment=null,seed=0,species=null}){
 const walk=moving?Math.sin(time*13):0,bob=moving?Math.abs(walk)*4:Math.sin(time*2+seed)*1.8;
 ellipse(c,x,y+2,25,9,'#263d3428');c.save();c.translate(x,y-bob);
 if(egg){ellipse(c,0,-24,22,29,'#f6e7bc');ellipse(c,-6,-35,5,8,'#ffffff90');line(c,[[-20,-20],[-10,-15],[0,-23],[10,-16],[20,-20]],'#c5a879',2);c.restore();return;}
 const hop=emotion==='joy'||emotion==='hatch'?Math.abs(Math.sin(time*9))*10:0;c.translate(0,-hop);
 const sleeping=emotion==='rest',eating=emotion==='feed',hurt=emotion==='hurt';
 ellipse(c,-12,-2+walk*3,10,5,'#6d665b');ellipse(c,12,-2-walk*3,10,5,'#6d665b');
 // Soft, overlapping cells give Ipsy a living, squishy silhouette.
 c.save();c.scale(1+Math.abs(walk)*.045,1-Math.abs(walk)*.03);
 const gradient=c.createRadialGradient(-12,-48,2,0,-26,44);gradient.addColorStop(0,'#fff2cc');gradient.addColorStop(.3,color);gradient.addColorStop(1,color);
 ellipse(c,0,-29,27,28,gradient);ellipse(c,-23,-29+walk*2,9,13,color);ellipse(c,23,-29-walk*2,9,13,color);
 if(species===0){ellipse(c,-14,-64,7,23,color);ellipse(c,14,-64,7,23,color);ellipse(c,-14,-67,3,12,'#e0b8a4');ellipse(c,14,-67,3,12,'#e0b8a4');}
 else if(species===1){line(c,[[-18,-48],[-23,-62],[-8,-50]],'#e3d9ad',5);line(c,[[18,-48],[23,-62],[8,-50]],'#e3d9ad',5);}
 else if(species===2){ellipse(c,-27,-41,15,7,color);ellipse(c,27,-41,15,7,color);ellipse(c,0,-57,8,7,'#f0cf94');}
 else{ellipse(c,-16,-51,10,10,color);ellipse(c,16,-51,10,10,color);}
 if(equipment?.armor)box(c,-20,-22,40,16,5,equipment.armor==='plate'?'#a9bbc0':'#997760');
 const blink=Math.sin(time*.8+seed)> .995,squint=sleeping||blink||emotion==='joy';
 if(squint){line(c,[[-12,-33],[-8,-31],[-4,-33]],'#35443d',2);line(c,[[5,-33],[9,-31],[13,-33]],'#35443d',2);}
 else{ellipse(c,-9+face*1.5,-34,3.4,hurt?2:4.4,'#35443d');ellipse(c,9+face*1.5,-34,3.4,hurt?2:4.4,'#35443d');ellipse(c,-8+face*1.5,-35,1,1,'white');ellipse(c,10+face*1.5,-35,1,1,'white');}
 ellipse(c,-17,-25,5,2.6,'#d8897280');ellipse(c,17,-25,5,2.6,'#d8897280');
 if(eating)ellipse(c,1,-24,4+Math.sin(time*17)*1.5,4,'#604b3b');else line(c,[[-4,-24],[0,-21],[5,-24]],'#534c3b',1.8);
 if(young){line(c,[[19,-50],[29,-57],[36,-48]],'#437b78',5);line(c,[[24,-53],[32,-43]],'#e5bb61',3);}
 if(equipment?.weapon&&equipment.weapon!=='twig'){
  const type=equipment.weapon;
  line(c,[[30,-8],[39,-43]],'#725d48',4);
  if(type==='hammer')box(c,30,-51,23,12,3,'#8b9c9a');
  else if(type==='wand'){ellipse(c,40,-48,7,7,'#cbb9e8');ellipse(c,40,-48,3,3,'#fff3cf');}
  else{line(c,[[36,-34],[44,-61]],'#dee9df',6);line(c,[[31,-34],[45,-30]],'#bd9b50',4);}
 }
 c.restore();
 if(sleeping)text(c,'z z',27,-62+Math.sin(time)*3,15,'#e7ebfa');
 if(emotion==='wash')for(let i=0;i<6;i++)ellipse(c,Math.sin(i*4+time)*29,-10-((time*18+i*13)%65),4+i%3,'#d9f3ffb0');
 if(['joy','pet','hatch'].includes(emotion))for(let i=0;i<3;i++)text(c,'♥',-28+i*27,-60-((time*15+i*8)%25),12,'#d78e88');
 c.restore();
}
function tree(c,x,y,size,t){
 ellipse(c,x+7,y+3,size*.8,size*.23,'#233e2920');box(c,x-5,y-size*.7,10,size*.75,4,'#806c50');
 const sway=Math.sin(t*.7+x)*1.5;
 ellipse(c,x+sway,y-size,size*.64,size*.72,'#5c8160');ellipse(c,x-size*.25+sway,y-size*1.2,size*.45,size*.48,'#7b9c6b');ellipse(c,x+size*.28+sway,y-size*.85,size*.4,size*.45,'#6e9163');ellipse(c,x-size*.2+sway,y-size*1.4,size*.2,size*.15,'#a2b78360');
}
function building(c,b,t,night){
 const x=b.x,y=b.y,w=b.id==='arena'?250:210,h=b.id==='arena'?110:100;
 ellipse(c,x+18,y+38,w*.64,25,'#253d3022');box(c,x-w/2,y-h,w,h+40,9,'#e7d9b9');box(c,x-w/2+8,y+17,w-16,22,3,'#baa785');
 for(const side of [-1,1]){box(c,x+side*67-16,y-60,32,36,5,'#666c58');box(c,x+side*67-12,y-56,24,28,2,night?'#ffda83':'#a1c3bf');line(c,[[x+side*67,y-56],[x+side*67,y-28]],'#e7d9b9',3);}
 box(c,x-23,y-28,46,67,12,'#675f4e');box(c,x-17,y-23,34,58,10,'#9a7d59');ellipse(c,x+10,y+12,2.5,2.5,'#e7cf8e');
 c.fillStyle=b.color;c.beginPath();c.moveTo(x-w/2-18,y-h+12);c.lineTo(x,y-h-65);c.lineTo(x+w/2+18,y-h+12);c.closePath();c.fill();line(c,[[x-w/2-14,y-h+12],[x+w/2+14,y-h+12]],'#485644',5);
 line(c,[[x,y-h-60],[x+w/2+12,y-h+9]],'#ffffff35',4);
 box(c,x+57,y-h-65,20,45,3,'#b5a58b');for(let i=0;i<3;i++){const u=(t*.35+i/3)%1;ellipse(c,x+67+Math.sin(t+i)*12*u,y-h-65-u*65,7+u*12,9+u*8,`rgba(241,235,215,${(1-u)*.35})`);}
 if(b.id==='store'){
  for(let i=0;i<8;i++)box(c,x-100+i*25,y-8,25,23,3,i%2?'#eee2c5':'#809a82');
  box(c,x-135,y+30,48,28,3,'#9a7d59');for(let i=0;i<6;i++)ellipse(c,x-128+i%3*14,y+30-Math.floor(i/3)*8,7,6,i%2?'#d39468':'#b9bf78');
 }
 if(b.id==='gym')for(const side of [-1,1]){line(c,[[x+side*148-16,y+45],[x+side*148+16,y+45]],'#646d64',5);box(c,x+side*148-19,y+32,10,26,3,'#748078');box(c,x+side*148+9,y+32,10,26,3,'#748078');}
 if(b.id==='arena')for(const side of [-1,1]){line(c,[[x+side*145,y+30],[x+side*145,y-110]],'#736b55',4);c.fillStyle='#b9a3bf';c.beginPath();c.moveTo(x+side*145,y-110);c.lineTo(x+side*145+35,y-103+Math.sin(t*2)*5);c.lineTo(x+side*145,y-74);c.fill();}
 box(c,x-83,y-h-8,166,27,6,'#faf0d8');text(c,b.name,x,y-h+11,13);
 // A readable, tappable front step.
 ellipse(c,b.door.x,b.door.y,30,12,'#f4e6bd');text(c,'⌃',b.door.x,b.door.y+5,18,'#6c795d');
}
export function mountTown({canvas,interact,caption,joystick,getPet,isPaused,onEnter,onSay}){
 const c=canvas.getContext('2d'),world=createWorld(),keys=new Set(),abort=new AbortController(),signal=abort.signal;
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),dark=matchMedia('(prefers-color-scheme: dark)');
 let width=0,height=0,zoom=1,raf=0,last=0,disposed=false,stick={x:0,y:0},stickPointer=null,action=null,reaction={name:'',until:0},current=null,lastLabel='';
 const camera={x:world.player.x,y:world.player.y};
 function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);zoom=width<600?.72:.95;}
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 function listen(target,event,fn){target.addEventListener(event,fn,{signal});}
 function clearInput(){keys.clear();stick={x:0,y:0};stickPointer=null;joystick.style.setProperty('--stick-x','0px');joystick.style.setProperty('--stick-y','0px');}
 function interactWith(target){
  if(!target||isPaused())return;
  if(target.kind==='place'){onEnter(target.id);return;}
  const n=talk(world,target.id);if(n){onSay(`${n.name}, ${n.role.toLowerCase()}: “${n.line}”`);reaction={name:'joy',until:world.time+2};}
 }
 listen(interact,'click',()=>interactWith(nearest(world)));
 listen(window,'keydown',e=>{
  if(isPaused()||e.target.closest('input,select,textarea,button,summary'))return;
  const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(k)){e.preventDefault();keys.add(k);action=null;}
  if(k==='e'&&!e.repeat)interactWith(nearest(world));
 });
 listen(window,'keyup',e=>keys.delete(e.key.toLowerCase()));listen(window,'blur',clearInput);listen(document,'visibilitychange',()=>{last=0;clearInput();});
 listen(canvas,'pointerdown',e=>{
  if(isPaused())return;canvas.focus({preventScroll:true});const r=canvas.getBoundingClientRect(),p={x:(e.clientX-r.left-width/2)/zoom+camera.x,y:(e.clientY-r.top-height/2)/zoom+camera.y};
  const npc=world.npcs.findIndex(n=>distance(n,p)<40);
  const b=LOCATIONS.find(l=>distance(l.door,p)<65||(Math.abs(p.x-l.x)<115&&p.y>l.y-150&&p.y<l.y+45));
  if(npc>=0){const n=world.npcs[npc];action={kind:'npc',id:npc};moveTo(world,{x:n.x,y:n.y+35});}
  else if(b){action={kind:'place',id:b.id};moveTo(world,b.door);}
  else{action=null;if(!moveTo(world,p))onSay('Try a path or an open patch of grass.');}
 });
 function stickMove(e){if(e.pointerId!==stickPointer)return;const r=joystick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,d=Math.max(1,Math.hypot(dx,dy)/35);stick={x:dx/d/35,y:dy/d/35};joystick.style.setProperty('--stick-x',`${stick.x*25}px`);joystick.style.setProperty('--stick-y',`${stick.y*25}px`);}
 listen(joystick,'pointerdown',e=>{if(isPaused())return;stickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);action=null;stickMove(e);});listen(joystick,'pointermove',stickMove);listen(joystick,'pointerup',clearInput);listen(joystick,'pointercancel',clearInput);listen(joystick,'lostpointercapture',clearInput);
 function ground(t,night,glass){
  c.fillStyle=night?'#364f48':glass?'#a6c2ac':'#b8c595';c.fillRect(0,0,WORLD.width,WORLD.height);
  // Dappled meadow, flowers and small stones are deterministic, so no visual noise per frame.
  for(let i=0;i<190;i++){
   const x=90+(i*137)%1430,y=100+(i*211)%1010;
   ellipse(c,x,y,18+(i%4)*8,5,night?'#9db58c10':'#edf1b41b');
   if(i%3===0){line(c,[[x,y],[x+2,y-5]],night?'#8a9d74':'#8eaa77',1.5);ellipse(c,x+2,y-6,2.5,2.5,i%2?'#e8dba6':'#cf9a9c');}
  }
  const roads=[[[380,410],[560,440],[1040,440],[1100,410]],[[560,440],[560,920],[1100,930]],[[1040,440],[1040,930]],[[560,640],[1300,670]],[[380,910],[560,920]],[[800,440],[800,780]]];
  for(const road of roads){line(c,road,night?'#82765a':'#c8b58b',70);line(c,road,night?'#9a8a67':'#e3d2a7',58);}
  ellipse(c,800,650,155,123,night?'#9b8c6e':'#eadcba');ellipse(c,800,650,140,110,night?'#a69779':'#efe3c7');
  for(let i=0;i<42;i++){const x=650+i%7*48,y=570+Math.floor(i/7)*29;if((x-800)**2/140**2+(y-650)**2/105**2<1)line(c,[[x,y],[x+22,y]],night?'#c1b49135':'#c7b58c55',1);}
  // Pond and its living surface.
  ellipse(c,800,290,158,112,'#8fa681');ellipse(c,800,290,145,100,night?'#507578':'#79b7b5');ellipse(c,790,280,126,85,night?'#587c7d':'#8dc5bd');
  for(let i=0;i<6;i++){const y=240+i*18,x=735+Math.sin(t*.7+i)*20;line(c,[[x,y],[x+50,y]],'#e4f4d34a',2);}
  for(let i=0;i<4;i++){ellipse(c,710+i*48,300+Math.sin(i)*30,12,5,'#779c73');ellipse(c,710+i*48,298+Math.sin(i)*30,3,2,'#e9c1ac');}
  // Fountain at the heart of the square.
  ellipse(c,800,695,45,21,'#a7a38b');ellipse(c,800,689,43,20,'#ddd4b4');ellipse(c,800,687,35,14,'#88bab6');box(c,792,653,16,30,6,'#dcd5bd');ellipse(c,800,650,23,9,'#e9e0c6');
  for(let i=0;i<8;i++){const a=i/8*TAU;c.strokeStyle='#d7f2e2b0';c.lineWidth=2;c.beginPath();c.moveTo(800,647);c.quadraticCurveTo(800+Math.cos(a)*23,625,800+Math.cos(a)*33,682+Math.sin(a)*9);c.stroke();}
  // Park picnic blankets and flower beds.
  box(c,1300,770,110,65,7,'#b5948f');for(let i=0;i<5;i++)line(c,[[1300+i*23,774],[1300+i*23,831]],'#e5d7b377',3);
  for(const [x,y] of [[630,430],[950,440],[600,820],[1250,570]]){box(c,x-28,y-12,56,24,6,'#806b53');for(let i=0;i<6;i++){ellipse(c,x-22+i*9,y-15,7,9,'#718e67');ellipse(c,x-22+i*9,y-21,4,4,i%2?'#dfb478':'#c88b94');}}
 }
 function draw(t){
  const dpr=canvas.width/width;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);
  const hour=new Date().getHours(),night=dark.matches||hour<6||hour>=20,glass=document.documentElement.dataset.look==='glass';
  c.save();c.translate(width/2-camera.x*zoom,height/2-camera.y*zoom);c.scale(zoom,zoom);ground(t,night,glass);
  const items=[];
  for(let i=0;i<36;i++){const side=i%4,x=side===0?140:side===1?1460:180+(i*137)%1220,y=side===2?130:side===3?1070:180+(i*193)%850;items.push({y,draw:()=>tree(c,x,y,45+i%4*8,t)});}
  for(const b of LOCATIONS.slice(0,4))items.push({y:b.y+42,draw:()=>building(c,b,t,night)});
  items.push({y:565,draw:()=>{box(c,755,490,90,66,5,'#90734d');box(c,764,497,72,47,3,'#efe0b7');line(c,[[767,550],[767,578]],'#705b40',7);line(c,[[833,550],[833,578]],'#705b40',7);text(c,'TOWN NEWS',800,517,10);text(c,'Arena • today',800,535,9);}});
  for(const [x,y] of [[600,510],[1000,760],[1190,550],[580,980]])items.push({y,draw:()=>{line(c,[[x,y],[x,y-80]],'#6d7057',5);box(c,x-9,y-95,18,22,4,night?'#ffe2a0':'#d4ccb0');if(night){const g=c.createRadialGradient(x,y-82,2,x,y-82,70);g.addColorStop(0,'#ffe1a044');g.addColorStop(1,'#ffe1a000');ellipse(c,x,y-82,70,70,g);}}});
  world.npcs.forEach((n,i)=>items.push({y:n.y,draw:()=>drawCreature(c,{...n,time:t,seed:i,color:n.color,species:i%4})}));
  const pet=getPet(),st=stage(pet),emotion=world.time<reaction.until?reaction.name:pet.needs.energy<35?'rest':'';
  items.push({y:world.player.y,draw:()=>{drawCreature(c,{...world.player,time:t,color:glass?'#a3cbb9':'#e5b95f',egg:st==='Egg',young:st.includes('warrior'),emotion,equipment:pet.equipment});text(c,'Ipsy',world.player.x,world.player.y+24,13,night?'#f5e5bc':'#4b5e45');}});
  items.sort((a,b)=>a.y-b.y).forEach(i=>i.draw());
  // Bunting above the square; butterflies, floating seeds and fireflies below it.
  line(c,[[590,470],[800,500],[1010,470]],'#81745c',2);
  for(let i=0;i<12;i++){const x=605+i*34,y=475+Math.sin(i/11*Math.PI)*25;c.fillStyle=['#bc8f83','#d9bf78','#81a99d'][i%3];c.beginPath();c.moveTo(x,y);c.lineTo(x+16,y);c.lineTo(x+8+Math.sin(t*2+i)*2,y+17);c.fill();}
  for(let i=0;i<12;i++){const x=670+Math.sin(t*.15+i*2)*480,y=580+Math.cos(t*.12+i)*360;ellipse(c,x,y,night?2:3+Math.sin(t*8+i)*2,2,night?'#f8eaaab0':'#f2d99f');if(!night)ellipse(c,x+5,y,3-Math.sin(t*8+i)*2,2,'#f5e2ae');}
  if(world.player.path.length){const dest=world.player.path.at(-1);c.strokeStyle='#fff5cb';c.lineWidth=2;c.beginPath();c.ellipse(dest.x,dest.y,14+Math.sin(t*3)*2,7,0,0,TAU);c.stroke();}
  for(const n of world.npcs){if(n.bubbleUntil>world.time){const w=Math.min(290,n.bubble.length*7+24);box(c,n.x-w/2,n.y-98,w,29,12,'#fff5df');text(c,n.bubble,n.x,n.y-78,12);}}
  c.restore();
  // Tiny town map stays fixed while the camera follows Ipsy.
  c.save();c.globalAlpha=.92;box(c,width-106,16,90,70,12,night?'#344c43':'#f8f0d6');for(const l of LOCATIONS)ellipse(c,width-100+l.x/WORLD.width*78,22+l.y/WORLD.height*56,3,3,l.color);ellipse(c,width-100+world.player.x/WORLD.width*78,22+world.player.y/WORLD.height*56,4,4,'#dc9c45');c.restore();
 }
 function frame(ms){
  if(disposed)return;const dt=last?Math.min((ms-last)/1000,.05):0;last=ms;
  if(!document.hidden){
   if(!isPaused()){
    const input={x:stick.x+Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),y:stick.y+Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))};
    stepWorld(world,dt,input);
    if(action&&!world.player.path.length){const a=action;action=null;const p=a.kind==='place'?LOCATIONS.find(l=>l.id===a.id).door:world.npcs[a.id];if(distance(p,world.player)<110)interactWith(a);}
   }else clearInput();
   const follow=motion.matches?1:Math.min(1,dt*7);camera.x+=(world.player.x-camera.x)*follow;camera.y+=(world.player.y-camera.y)*follow;
   camera.x=Math.max(width/zoom/2,Math.min(WORLD.width-width/zoom/2,camera.x));camera.y=Math.max(height/zoom/2,Math.min(WORLD.height-height/zoom/2,camera.y));
   current=nearest(world);const label=current?`${current.kind==='npc'?'Talk to':'Enter'} ${current.name}`:'Explore the town';
   if(label!==lastLabel){interact.textContent=label;interact.disabled=!current;caption.textContent=current?`${current.name} is nearby`:'Tap a path to walk · meet your neighbors';lastLabel=label;}
   draw(motion.matches?0:world.time);
  }
  raf=requestAnimationFrame(frame);
 }
 raf=requestAnimationFrame(frame);
 return {react(name){reaction={name,until:world.time+3};},dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();abort.abort();clearInput();}};
}
