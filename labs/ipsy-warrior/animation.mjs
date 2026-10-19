import {stage,SHOP} from './engine.mjs';
export const FOODS=[
 {id:'berries',name:'Berry bowl',icon:'🫐',line:'One berry… two berries… a very happy Ipsy.'},
 {id:'apple',name:'Crunchy apple',icon:'🍎',line:'Crunch, crunch! Ipsy finishes his apple.'},
 {id:'soup',name:'Warm soup',icon:'🥣',line:'A little sip, a warm tummy, a happy sigh.'},
 {id:'carrot',name:'Garden carrot',icon:'🥕',line:'Nibble, nibble. Fresh from the town garden.'}
];
export function reactionFor(a,before,after,food){
 if(a.type==='hatch')return {pose:'hatch',title:'Hello, little Ipsy!',icon:'✦'};
 if(a.type==='care')return {
  feed:{pose:'feed',title:food?.line||'A delicious little meal.',icon:food?.icon||'🫐'},
  pet:{pose:'pet',title:'Ipsy leans into your hand. More, please!',icon:'♥'},
  wash:{pose:'wash',title:'Scrub, splash… squeaky clean!',icon:'🫧'},
  rest:{pose:'rest',title:'A soft pillow. A deep breath. Energy restored.',icon:'☾'}
 }[a.kind];
 if(a.type==='train')return {pose:'train',title:`A little stronger! ${a.stat} training complete.`,icon:a.stat==='speed'?'➜':'🏋'};
 if(a.type==='buy'||a.type==='equip')return {pose:'equip',title:`Trying on ${SHOP.find(i=>i.id===a.id)?.name||'new equipment'}!`,icon:'✦'};
 if(a.type==='investigate')return {pose:'read',title:'Ipsy studies a new clue. Aha!',icon:'📜'};
 if(a.type==='schedule')return {pose:'book',title:'One arena ticket. Let the preparations begin!',icon:'🎟'};
 if(a.type==='battle-start')return {pose:'ready',title:'Deep breath. Ipsy steps into the arena.',icon:'⚔'};
 if(a.type==='battle-move'){
  if(after.wins>before.wins)return {pose:'victory',title:'Victory! Ipsy jumps for joy.',icon:'🏆'};
  if(a.move==='retreat')return {pose:'retreat',title:'A safe retreat. Come back stronger.',icon:'➜'};
  if(!after.battle)return {pose:'hurt',title:'A brave try. Time for a rest and a rematch.',icon:'✧'};
  return {pose:{attack:'attack',skill:'skill',defend:'defend',potion:'drink'}[a.move],title:{attack:'Ipsy lunges forward!',skill:'A powerful, sweeping strike!',defend:'Shield up. Hold steady!',potion:'Glug, glug. Ready for another round.'}[a.move],icon:a.move==='potion'?'🧪':a.move==='defend'?'🛡':'✦'};
 }
 if(a.type==='practice-start')return {pose:'ready',title:'Eyes on the target. Ready, Ipsy?',icon:'◎'};
 if(a.type==='practice-shot')return {pose:a.hit?'victory':'ready',title:after.practice?a.hit?'Bullseye!':'Next one. You’ve got this.':after.journal[0],icon:a.hit?'✦':'◎'};
 return {pose:'idle',title:'',icon:''};
}
export function avatar(s,{pose='idle',icon=''}={}){
 const st=stage(s),egg=st==='Egg',young=st.includes('warrior');
 const weapon=s.equipment.weapon;
 // All strings interpolated here come from fixed game catalogs, never user input.
 return `<div class="action-art pose-${pose}" aria-hidden="true"><svg viewBox="0 0 360 210" focusable="false">
 <defs><radialGradient id="pet-glow" cx="35%" cy="25%" r="80%"><stop stop-color="#fff3c8"/><stop offset=".4" stop-color="var(--pet)"/><stop offset="1" stop-color="var(--pet-shadow,#ca943d)"/></radialGradient></defs>
 <ellipse cx="180" cy="180" rx="83" ry="12" fill="var(--accent)" opacity=".13"/>
 <rect class="sleep-pillow" x="125" y="159" width="110" height="29" rx="13" fill="#b7c8d9"/><g class="pet-body"><g class="pet-squish">
 ${egg?'<ellipse cx="180" cy="116" rx="42" ry="57" fill="url(#pet-glow)"/><path d="m139 119 20 10 20-15 20 15 20-10" stroke="var(--roof)" fill="none" stroke-width="4"/>':`
 <ellipse class="foot left-foot" cx="157" cy="173" rx="17" ry="8" fill="var(--pet-shadow,#ca943d)"/><ellipse class="foot right-foot" cx="204" cy="173" rx="17" ry="8" fill="var(--pet-shadow,#ca943d)"/>
 <ellipse cx="180" cy="119" rx="52" ry="54" fill="url(#pet-glow)"/><circle cx="149" cy="78" r="19" fill="var(--pet)"/><circle cx="210" cy="78" r="19" fill="var(--pet)"/>
 <ellipse class="left-hand" cx="129" cy="131" rx="14" ry="23" fill="var(--pet)"/><ellipse class="right-hand" cx="232" cy="131" rx="14" ry="23" fill="var(--pet)"/>
 ${s.equipment.armor?`<path d="M140 143q40 20 80 0v20q-40 17-80 0z" fill="${s.equipment.armor==='plate'?'#9cadb1':'#9b7754'}"/><circle cx="180" cy="158" r="5" fill="#f1ce80"/>`:''}
 <g class="eyes"><ellipse cx="163" cy="115" rx="6" ry="8" fill="#35443d"/><ellipse cx="199" cy="115" rx="6" ry="8" fill="#35443d"/><circle cx="165" cy="112" r="2" fill="#fff"/><circle cx="201" cy="112" r="2" fill="#fff"/></g>
 <path class="sleep-eyes" d="m155 115q8 8 16 0m20 0q8 8 16 0" stroke="#35443d" stroke-width="3" fill="none"/>
 <ellipse cx="147" cy="134" rx="9" ry="4" fill="#d78d76" opacity=".5"/><ellipse cx="216" cy="134" rx="9" ry="4" fill="#d78d76" opacity=".5"/>
 <path class="smile" d="M171 137q10 10 20 0" stroke="#5c4a34" stroke-width="3" stroke-linecap="round" fill="none"/><ellipse class="eating-mouth" cx="181" cy="141" rx="8" ry="7" fill="#5c4a34"/>
 ${young?'<path d="m141 76 39-15 40 15" stroke="var(--accent)" stroke-width="10" fill="none"/><path d="m217 76 24 15-23 10" fill="var(--accent)"/>':''}
 ${weapon!=='twig'?`<g class="held-weapon"><path d="m240 164 20-77" stroke="#806447" stroke-width="7"/>${weapon==='hammer'?'<rect x="244" y="77" width="40" height="21" rx="5" fill="#9cadb1"/>':weapon==='wand'?'<path d="m260 67 5 12 14 2-10 9 2 14-11-7-12 7 3-14-10-9 14-2z" fill="#c7b0e3"/>':'<path d="m254 108 16-53 5 18-13 39" fill="#dce7e6"/><path d="m247 106 23 7" stroke="#bd9b50" stroke-width="6"/>'}</g>`:''}
 `}</g></g>
 <g class="care-hand"><path d="M210 57v-19q0-8 6-8t6 8v7-16q0-8 6-8t6 8v15-10q0-8 6-8t6 8v16-8q0-8 6-8t6 8v24q0 24-20 24h-8q-12 0-18-12l-11-16q-4-8 3-11 5-2 12 8" fill="#e4bc91" stroke="#bd956c" stroke-width="2"/></g><g class="action-prop"><text x="262" y="146" text-anchor="middle" font-size="44">${icon}</text></g>
 <g class="crumbs" fill="#d49e52"><circle cx="185" cy="154" r="3"/><circle cx="202" cy="158" r="2"/><circle cx="170" cy="153" r="2"/></g>
 <g class="bubbles" fill="#e4f7ff" stroke="#97c4cc" stroke-width="1.5"><circle cx="132" cy="140" r="13"/><circle cx="212" cy="78" r="17"/><circle cx="246" cy="117" r="9"/><circle cx="158" cy="65" r="7"/><circle cx="200" cy="161" r="11"/></g>
 <g class="hearts" fill="#d98e8b"><text x="124" y="76" font-size="23">♥</text><text x="232" y="58" font-size="18">♥</text><text x="201" y="36" font-size="14">♥</text></g>
 <g class="sleep-z" fill="var(--accent)"><text x="230" y="90" font-size="18">z</text><text x="250" y="65" font-size="24">z</text><text x="272" y="37" font-size="30">z</text></g>
 <path class="strike" d="M239 55q92 52 16 115" fill="none" stroke="#f5cd75" stroke-width="12" stroke-linecap="round"/>
 <g class="sparkles" fill="#d6ad54"><path d="m104 80 4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/><path d="m271 54 4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/><path d="m265 165 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/></g>
 </svg></div>`;
}
export function opponentAvatar(id,reacting=false){
 const art=id==='bramble'?'<path d="M110 145q-45-50-20-65 14-9 21 16m68 49q45-50 20-65-14-9-21 16" stroke="#749a6c" stroke-width="12" fill="none"/><ellipse cx="145" cy="119" rx="39" ry="48" fill="#8aa878"/><path d="m119 82 2-39 23 28 24-27 1 39" fill="#618665"/><path d="m123 98 14 5m17 0 14-5" stroke="#384c39" stroke-width="4"/><circle cx="132" cy="113" r="4" fill="#304637"/><circle cx="158" cy="113" r="4" fill="#304637"/><path d="m134 139 11-4 11 4" stroke="#384c39" stroke-width="3" fill="none"/>':id==='ironhide'?'<path d="m103 76 24-20h36l24 20 8 78-24 19h-50l-26-19z" fill="#a5b2b6"/><path d="m105 90 41-10 39 10-6 27h-68z" fill="#687b82"/><path d="m120 102 15 3m21 0 15-3" stroke="#ffe3a1" stroke-width="4"/><path d="m103 130 42-11 42 11-9 22-33 12-32-12z" fill="#7d9096"/><path d="M145 58v108" stroke="#c6d0c8" stroke-width="3"/>':'<path d="M145 45q-58 24-38 79l-8 41 28-12 18 19 18-19 28 12-8-41q20-55-38-79" fill="#c0add8"/><path d="m145 65-13 36h16l-6 27 25-43h-18l8-20z" fill="#fff1c5"/><ellipse cx="128" cy="132" rx="5" ry="7" fill="#5e4e7a"/><ellipse cx="164" cy="132" rx="5" ry="7" fill="#5e4e7a"/>';
 return `<svg class="foe-art ${reacting?'foe-exchange':''}" viewBox="65 30 160 160" aria-hidden="true"><ellipse cx="145" cy="177" rx="44" ry="8" fill="var(--accent)" opacity=".12"/><g class="foe-body">${art}</g></svg>`;
}
