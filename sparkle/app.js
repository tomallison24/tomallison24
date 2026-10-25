'use strict';

// Sparkle Kingdom's screens: who's playing (the frame), the kingdom she explores, a round in a land,
// the end of a round, her castle (dress up and the Royal Boutique), and the Parent corner.
//
// Saved on this phone (localStorage sparkle.v1: { v, players, gone, settings, settingsAt }), and,
// once a grown-up has signed in to the family account here, in that account too (../sparkle/api/
// save), so each player's progress follows them to any family phone: merged with the account's copy
// at the end of a round and when the game is put away (engine.js merge), never once per answer
// (the free plan's storage writes are scarce). It never asks a child to sign in: a grown-up does,
// in the Parent corner. The play timer counts only time she's actually playing (a tap in the last
// minute); a session ends after 5 minutes with no taps.
(() => {
  const E = window.SparkleEngine, C = window.SparkleContent, A = window.SparkleArt, W = window.SparkleWorld, V = window.SparkleVoice, L = window.SparkleLetters, Ch = window.SparkleChapters, RM = window.SparkleRooms;
  const K = window.SparkleKitchen, Care = window.SparkleCare, ST = window.SparkleStableArt, BR = window.SparkleBedroom;
  const $ = id => document.getElementById(id), esc = A.esc;
  const KEY = 'sparkle.v1', DEV = 'sparkle.device', API = new URL('../sparkle/api/', location.href).href;
  // the lands (a place in the kingdom -> its skill: the Fairy Garden picks one of its three memory games)
  // (Star Meadow takes turns between Wand Sparkle and Pattern Parade; the Unicorn Bakery is in the castle's kitchen)
  const LAND = { tower: 'read', mine: 'math', meadow: 'meadow', garden: 'garden', workshop: 'spell' };
  const LAND_OF = { read: 'tower', math: 'mine', wand: 'meadow', pattern: 'meadow', spell: 'workshop', match: 'garden', missing: 'garden', recall: 'garden' };
  const GARDEN = ['match', 'missing', 'recall'], MEADOW = ['wand', 'pattern'];
  // a skill's land, for the Parent corner's switches, the story's chapters and the play time by land
  const landKey = skill => GARDEN.includes(skill) || skill === 'garden' ? 'garden' : MEADOW.includes(skill) || skill === 'meadow' ? 'wand' : skill === 'bake' ? 'castle' : skill;
  const HOST = { read: ['owl', 'Professor Hoot'], math: ['dragon', 'Pebble'], wand: ['narrator', 'your unicorn'], pattern: ['narrator', 'your unicorn'], spell: ['gemma', 'Gemma'], match: ['bloom', 'Bloom'], missing: ['bloom', 'Bloom'], recall: ['bloom', 'Bloom'], bake: ['dragon', 'Pebble'] };
  // the rounds that take longer have fewer questions, and a shorter warm-up
  const ROUND_LEN = { match: 2, missing: 5, recall: 5, bake: 5 }, WARM_LEN = { match: 3, missing: 4, recall: 4, bake: 4 };
  // the Grey Fog lifts from a land after this many rounds in all
  const UNFOG = { garden: 2, workshop: 4 };
  const LAND_NAME = { garden: 'the Fairy Garden', workshop: 'the Tiara Workshop' };
  const SKILL_NAME = { read: 'Reading', spell: 'Spelling', math: 'Math', wand: 'Wand Sparkle', match: 'Flower Match', missing: "What's Missing", recall: 'Story Recall', pattern: 'Pattern Parade', bake: 'Unicorn Bakery' };
  const DEFAULTS = { focus: 'more', off: [], rate: 0.9, sfx: true, badge: true, natural: true, start: {} };
  const NO = () => {};

  // ---- this phone, the save ----
  let device; try { device = localStorage.getItem(DEV); if (!device) { device = 'd' + Math.random().toString(36).slice(2, 10); localStorage.setItem(DEV, device); } } catch { device = 'd0'; }
  function load() {
    let s = null; try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
    if (!s || typeof s !== 'object' || !s.players) s = { v: 1, players: {}, gone: {}, settings: {}, settingsAt: 0 };
    s.settings = Object.assign({}, DEFAULTS, s.settings || {});
    return s;
  }
  let save = load(), me = null;
  const set = () => save.settings;
  let saveJob = 0;
  function persist(now) {
    if (me) me.updated = Date.now();
    clearTimeout(saveJob);
    const write = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} };
    if (now) write(); else saveJob = setTimeout(write, 1500);
  }
  const today = () => E.today();
  V.rate = set().rate; V.sounds = set().sfx;

  // ---- little helpers ----
  const words = (text, size = 30, cls = '') => String(text).split(/\s+/).filter(Boolean).map(w => `<span class="w ${cls}">${L.svg(w, { size, stroke: 9 })}</span>`).join('');
  const ltr = (text, size = 40, opt = {}) => L.svg(text, Object.assign({ size, stroke: 9 }, opt));
  const ICON = {
    home: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"><path d="M7 33V17l5 3V9l8 5l8-5v11l5-3v16z"/><path d="M17 33v-7a3 3 0 0 1 6 0v7"/></svg>',
    back: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"><path d="M24 9L13 20l11 11"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    drum: '<svg viewBox="0 0 48 48" fill="none" stroke="#4B2E6F" stroke-width="3" stroke-linejoin="round"><ellipse cx="24" cy="18" rx="16" ry="6" fill="#fff"/><path d="M8 18v14c0 3 7 6 16 6s16-3 16-6V18" fill="#FFC94A"/><path d="M8 18l8 18M24 24v14M40 18l-8 18"/></svg>',
    go: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"><path d="M10 20h20M21 11l9 9l-9 9"/></svg>',
    how: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 15a5 5 0 1 1 7 4.6c-1.3.6-2 1.8-2 3.2V24"/><circle cx="20" cy="30" r="1.2" fill="currentColor"/></svg>',
    again: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"><path d="M30 14a12 12 0 1 0 2 10"/><path d="M31 6v8h-8"/></svg>',
  };
  const host = (skill, cls = '') => skill === 'read' ? A.owl({ cls }) : skill === 'math' ? A.dragon({ cls }) : skill === 'spell' ? A.fairy('gemma', { cls })
    : skill === 'wand' ? A.unicorn(me ? stageOf(me) : 0, me ? wearing(me) : {}, { mood: 'happy', cls }) : A.fairy('bloom', { cls });
  // a word's picture: drawn (pics-*.js, SparklePics), or the phone's emoji where there's no drawing yet
  const PICS = () => window.SparklePics || {};
  const picture = (id, cls = 'pic') => { const f = PICS()[id]; return f ? A.svg('0 0 100 100', f(A.uid), C.word(id), cls) : `<span class="emo" role="img" aria-label="${esc(C.word(id))}">${esc(C.PIC[id] || '')}</span>`; };
  function toast(text, ms = 2200) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = text; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
  function burst(x, y, n = 10) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const b = document.createElement('div'); b.className = 'stars-burst';
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 90;
      b.insertAdjacentHTML('beforeend', `<i class="fly" style="left:${x - 15}px;top:${y - 15}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px">${A.svg('0 0 30 30', A.star(15, 15, 13, ['#FFC94A', '#FF8FC7', '#B79BFF', '#7FE0C7'][i % 4]))}</i>`); }
    document.body.appendChild(b); setTimeout(() => b.remove(), 1100);
  }
  const centerOf = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let lastTap = Date.now();
  addEventListener('pointerdown', () => { lastTap = Date.now(); V.unlock(); }, { capture: true });

  // ---- screens ----
  const SCREENS = ['picker', 'world', 'round', 'reward', 'castle', 'intro', 'chapter', 'home', 'stable', 'bedroom'];
  let screen = 'picker';
  function show(id) {
    screen = id;
    for (const s of SCREENS) $(s).hidden = s !== id;
    document.documentElement.classList.toggle('locked', id !== 'picker');
    document.querySelector('.ambient').hidden = id !== 'picker';
    session.land = id === 'round' ? round && landKey(round.skill) : ['castle', 'home', 'stable', 'bedroom'].includes(id) ? 'castle' : 'world';
    if (id !== 'stable') stableStop();
  }

  // ---- players ----
  const players = () => Object.values(save.players).sort((a, b) => a.created - b.created);
  const uidOf = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const stageOf = p => { const n = (p.stickers || []).length; return n >= 25 ? 4 : n >= 15 ? 3 : n >= 8 ? 2 : n >= 3 ? 1 : 0; };
  const owns = (p, id) => (p.owned || []).includes(id) || Object.values(A.STARTER).includes(id) || (RM.ITEMS[id] && RM.STARTER[RM.ITEMS[id].room][RM.ITEMS[id].slot] === id);
  const wearing = p => Object.assign({}, A.STARTER, p.wearing || {});
  // her rank: every skill's highest level added up (7 to 55), and never lower than she's been
  const RANKS = ['Little Princess', 'Princess', 'Royal Princess', 'Princess of Sparkle Kingdom'], RANK_AT = [0, 20, 32, 45];
  // (the seven skills she started with: the newer games don't move the ranks' bar)
  const RANK_SKILLS = ['read', 'math', 'wand', 'spell', 'match', 'missing', 'recall'];
  const levelSum = p => RANK_SKILLS.reduce((a, k) => { const s = (p.skills || {})[k]; return a + (s ? Math.max(s.best || 0, s.level) : 1); }, 0);
  const rankOf = p => Math.max(p.rank || 0, RANK_AT.filter(n => levelSum(p) >= n).length - 1);
  const rankChip = p => `<span class="rank">${A.icon('tiara', 26)}<span>${RANKS[rankOf(p)]}</span></span>`;
  const cap = t => t[0].toUpperCase() + t.slice(1);
  const tr = s => window.aosLang ? aosLang.t(s) : s;   // a dialog's words, in Russian when aOS is (home/lang.js)
  const giftChapter = id => Ch.LANDS.flatMap(l => Ch.CHAPTERS[l]).find(c => c.gift === id);
  function paintPicker() {
    const ps = players();
    $('players').innerHTML = ps.map(p => `<button type="button" class="pcard" data-player="${esc(p.id)}" aria-label="Play as ${esc(p.name)}">
        <span class="face">${A.princess(p.look, wearing(p), { head: true })}</span><span class="nm" translate="no">${ltr(p.name, 40, { color: 'currentColor' })}</span></button>`).join('')
      + `<button type="button" class="pcard add" data-add aria-label="Add a player"><span class="plus" aria-hidden="true">+</span><b>${ps.length ? 'Add a player' : 'Make your princess'}</b></button>`;
  }
  $('players').addEventListener('click', e => {
    const c = e.target.closest('[data-player]'); if (c) return choose(save.players[c.dataset.player]);
    if (e.target.closest('[data-add]')) { if (!players().length) creator(); else grownUp(() => creator()); }
  });
  function choose(p) {
    if (!p) return;
    me = p; V.unlock();
    if (!me.introSeen) return intro();
    enterWorld(true);
  }

  // ---- the story, once per player ----
  function intro() {
    show('intro');
    const lines = [`Once upon a time, in Sparkle Kingdom, a gentle Grey Fog drifted in and took the colours away.`, `Only a princess who loves to learn can bring them back. That's you, ${me.name}!`, `Ride your unicorn, read the signs, count the gems, and the colours will come back.`];
    $('introIn').innerHTML = `<div class="intro-art"><span class="pr">${A.princess(me.look, wearing(me), { mood: 'happy' })}</span><span class="un dance">${A.unicorn(0, wearing(me), { mood: 'happy' })}</span></div>
      <div class="story" id="storyText"></div><button type="button" class="big pink" id="introGo">${ICON.go}<span>Let's go!</span></button>`;
    let i = 0; const next = () => { $('storyText').textContent = lines[i]; V.say([lines[i]], { who: 'narrator' }); };
    next();
    $('introGo').onclick = () => { V.sfx('sparkle'); i++; if (i < lines.length) return next(); me.introSeen = true; persist(true); enterWorld(true); };
  }

  // ---- the kingdom ----
  const session = { open: {}, secs: 0, land: 'world', recent: [] };
  function quest() {
    const d = today();
    if (!me.quest || me.quest.day !== d) {
      const off = set().off || [], open = me.world.open || {};
      const pool = ['mine', 'meadow', 'tower', 'garden', 'workshop'].filter(x => !off.includes(landKey(LAND[x])) && (!W.NODES[x].fog || open[W.NODES[x].fog]));
      const r = E.rng(E.dayNum(d) * 7 + me.created % 997);
      const others = pool.filter(x => x !== 'tower');
      const stops = set().focus === 'most' || !others.length ? ['tower', others.length ? r.pick(others) : 'tower', 'tower'] : ['tower', r.pick(others), r.pick(pool)];
      me.quest = { day: d, stops, done: [false, false, false], gift: false };
    }
    return me.quest;
  }
  // after the quest: back to Story Tower once she's played other lands a while (Parent corner > Favor reading)
  const nextStop = () => { const q = quest(); const i = q.done.indexOf(false); if (i >= 0) return q.stops[i];
    const n = { normal: 3, more: 2, most: 1 }[set().focus] || 2, last = session.recent.slice(-n);
    return last.length === n && last.every(s => s !== 'read') ? 'tower' : null; };
  const STOP_ICON = { tower: 'book', mine: 'gem', meadow: 'star', garden: 'flower', workshop: 'tiara' };
  function paintHud() {
    $('coins').innerHTML = A.coin(34) + `<span>${E.coins(me)}</span>`;
    $('coins').setAttribute('aria-label', E.coins(me) + ' coins');
    $('timer').hidden = !set().badge;
    $('timer').innerHTML = ICON.clock + `<span>${Math.floor(session.secs / 60)} min</span>`;
    $('meBtn').innerHTML = A.princess(me.look, wearing(me), { head: true });
    const want = Care.want(petNow());   // her unicorn needs her: the castle button says what
    $('castleBtn').innerHTML = ICON.home + (want && ST ? `<span class="nb" aria-hidden="true">${ST.need(want, 26)}</span>` : '');
    $('castleBtn').setAttribute('aria-label', want ? 'Your castle: your unicorn needs you' : 'Your castle');
    const q = quest(), nx = nextStop();
    $('quest').innerHTML = q.stops.map((s, i) => `<span class="qstop ${q.done[i] ? 'done' : ''} ${s === nx && !q.done[i] && q.done.indexOf(false) === i ? 'next' : ''}" aria-hidden="true">${A.icon(STOP_ICON[s], 30)}</span>`).join('')
      + `<span class="qt">${q.done.every(Boolean) ? 'Quest done! Play anywhere.' : "Today's quest"}</span>`;
  }
  function paintMap() {
    const nx = nextStop();
    $('mapIn').innerHTML = W.kingdom({ at: me.world.at, stars: me.world.stars, critters: me.world.critters, open: session.open, quest: nx, unfog: me.world.open || {},
        colour: Object.fromEntries(Ch.LANDS.map(l => [l, Ch.colour((me.chapters || {})[l])])) })
      + `<div id="rider" aria-hidden="true"><div class="wrap"><span class="un">${A.unicorn(stageOf(me), wearing(me), { mood: Care.mood(petNow()) === 'sad' ? 'sad' : 'happy', dirt: Care.dirt(me.pet) })}</span><span class="pr">${A.princess(me.look, wearing(me), { head: true })}</span></div></div>`;
    place(W.NODES[me.world.at] || W.NODES.castle);
  }
  function place(n) {
    const r = $('rider'); if (!r) return;
    r.style.left = (n.x / W.W * 100) + '%'; r.style.top = (n.y / W.H * 100) + '%';
  }
  function centre(n, smooth = true) {
    const m = $('map'), box = $('mapIn').getBoundingClientRect();
    const x = n.x / W.W * box.width - m.clientWidth / 2, y = n.y / W.H * box.height - m.clientHeight * 0.55;
    m.scrollTo({ left: Math.max(0, x), top: Math.max(0, y), behavior: smooth && !reduce() ? 'smooth' : 'auto' });
  }
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // greet: she's just picked her princess, so the storyteller says hello and where to go; back from a
  // game, the castle or a chapter, the kingdom is quiet (the quest at the bottom still shows the way)
  function enterWorld(greet) {
    show('world'); paintHud(); paintMap();
    requestAnimationFrame(() => centre(W.NODES[me.world.at] || W.NODES.castle, false));
    if (greet === true) {
      const nx = nextStop();
      const GO = { tower: "Let's visit Story Tower.", mine: "Let's go to the Gem Mine.", meadow: "Let's go to Star Meadow.", garden: "Let's go to the Fairy Garden.", workshop: "Let's go to the Tiara Workshop." };
      const w = Care.want(petNow());
      V.say([nx ? `Hi ${me.name}! ${GO[nx]} Tap where you want to go.` : `Hi ${me.name}! Where shall we go?`, ...(w ? [WANT_SAY[w]] : [])], { who: 'narrator' });
    }
    sync();
  }
  // where a tap on the map lands, in the kingdom's units
  const toWorld = e => { const b = $('mapIn').getBoundingClientRect(); return [(e.clientX - b.left) / b.width * W.W, (e.clientY - b.top) / b.height * W.H]; };
  let busy = false;
  $('mapIn').addEventListener('click', async e => {
    if (busy) return;
    const st = e.target.closest('[data-star]');
    if (st) { const id = st.dataset.star; if (!me.world.stars.includes(id)) { me.world.stars.push(id); E.earn(me, device, 2); persist(); V.sfx('sparkle'); burst(e.clientX, e.clientY, 12); st.remove(); toast('You found a star! +2'); paintHud(); V.say(['You found a hidden star!']); } return; }
    const cr = e.target.closest('[data-critter]');
    if (cr) { const c = W.CRITTERS.find(x => x.id === cr.dataset.critter); if (c && !me.world.critters.includes(c.id)) { me.world.critters.push(c.id); persist(); V.sfx('sparkle'); burst(e.clientX, e.clientY); cr.remove(); toast('A new friend for your book!'); V.say([`You found ${c.name}! It's in your treasure book now.`]); } return; }
    const fog = e.target.closest('[data-fog]');
    if (fog) { V.say([`The Grey Fog still covers ${LAND_NAME[fog.dataset.fog]}. Keep learning, and it will lift!`]); return; }
    const pl = e.target.closest('.place');
    let to = null;
    if (pl) {
      const k = ['castle', 'tower', 'mine', 'door', 'signpost', 'garden', 'workshop', 'flowergate', 'gemdoor'].find(c => pl.classList.contains(c));
      const land = { garden: 'garden', flowergate: 'garden', workshop: 'workshop', gemdoor: 'workshop' }[k];
      if (land && !(me.world.open || {})[land]) { V.say([`The Grey Fog still covers ${LAND_NAME[land]}. Keep learning, and it will lift!`]); return; }
      to = { castle: 'castle', tower: 'tower', mine: 'mine', door: 'meadow', signpost: 'sign', garden: 'garden', flowergate: 'garden', workshop: 'workshop', gemdoor: 'workshop' }[k];
    }
    if (!to) { const [x, y] = toWorld(e); to = W.nearest(x, y, me.world.open || {}); }
    if ((set().off || []).includes(landKey(LAND[to]))) { V.say(["That land is resting today."]); return; }
    await travel(to);
  });
  $('quest').addEventListener('click', () => { const nx = nextStop(); if (nx && !busy) travel(nx); });
  $('castleBtn').addEventListener('click', () => { if (!busy) travel('castle'); });
  $('meBtn').addEventListener('click', () => { if (busy) return; V.stop(); persist(true); sync(); me = null; paintPicker(); show('picker'); });

  async function travel(to) {
    busy = true;
    if (me.pet && me.pet.asleep) Care.wake(petNow());   // off on an adventure: her unicorn wakes up
    try {
      const path = W.route(me.world.at, to, me.world.open || {});
      if (!path) return;
      // walked in one smooth glide up to each gate that's still shut, and on from it once it opens
      let run = [path[0]];
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i], g = W.gateOn(a, b);
        if (g && !session.open[g]) {
          await walk(run.map(n => W.NODES[n])); me.world.at = a; run = [a];
          const ok = await gate(g);
          if (!ok) return;
          session.open[g] = true;
          if (g === 'bridge') { paintMap(); place(W.NODES[a]); }
        }
        run.push(b);
      }
      await walk(run.map(n => W.NODES[n])); me.world.at = path[path.length - 1];
      persist();
      if (to === 'castle' && path.length >= 1) return openCastle();
      if (LAND[to]) return startRound(LAND[to]);
    } finally { busy = false; }
  }
  // the princess and her unicorn glide along the curved paths: sampled, followed at an even pace that eases in
  // and out, moved by a transform (no layout or repaint a frame), the view following every frame
  const easeSine = t => (1 - Math.cos(Math.PI * t)) / 2;
  function walk(nodes) {
    return new Promise(done => {
      const r = $('rider'), m = $('map'), box = $('mapIn'), end = nodes[nodes.length - 1];
      if (!r || nodes.length < 2) return done();
      if (reduce()) { r.classList.toggle('flip', end.x < nodes[0].x); place(end); centre(end, false); return done(); }
      const pts = [nodes[0]];
      for (let i = 1; i < nodes.length; i++) {
        const p = nodes[i - 1], q = nodes[i], mx = (p.x + q.x) / 2 + (q.y - p.y) * 0.12, my = (p.y + q.y) / 2 - (q.x - p.x) * 0.12;
        for (let k = 1; k <= 24; k++) { const t = k / 24, u = 1 - t; pts.push({ x: u * u * p.x + 2 * u * t * mx + t * t * q.x, y: u * u * p.y + 2 * u * t * my + t * t * q.y }); }
      }
      const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      const total = len[len.length - 1] || 1, dur = Math.max(600, total * 2.4);
      const sx = box.clientWidth / W.W, sy = box.clientHeight / W.H, s0 = nodes[0];
      let i = 1, vx = m.scrollLeft, vy = m.scrollTop;
      const at = d => { while (i < len.length - 1 && len[i] < d) i++; const f = Math.min(1, Math.max(0, (d - len[i - 1]) / ((len[i] - len[i - 1]) || 1)));
        return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f, dx: pts[i].x - pts[i - 1].x }; };
      r.classList.add('walk'); V.sfx('whoosh');
      const t0 = performance.now();
      const step = now => {
        const t = Math.min(1, (now - t0) / dur), p = at(easeSine(t) * total);
        if (Math.abs(p.dx) > 0.5) r.classList.toggle('flip', p.dx < 0);
        r.style.transform = `translate3d(${(p.x - s0.x) * sx}px, ${(p.y - s0.y) * sy}px, 0)`;
        // the view eases after her (kept in fractions of a pixel, so it never stalls)
        vx += (Math.max(0, p.x * sx - m.clientWidth / 2) - vx) * 0.12; vy += (Math.max(0, p.y * sy - m.clientHeight * 0.55) - vy) * 0.12;
        m.scrollLeft = vx; m.scrollTop = vy;
        if (t < 1) return requestAnimationFrame(step);
        r.style.transform = ''; place(end); r.classList.remove('walk'); centre(end); done();
      };
      requestAnimationFrame(step);
    });
  }

  // ---- the gates on the paths: a signpost, the rainbow bridge, the crystal door ----
  function overlay(html) {
    const g = document.createElement('div'); g.className = 'gatebox'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-label', 'A puzzle on the path');
    g.innerHTML = `<div class="gpanel">${html}</div>`; $('world').appendChild(g); return g;
  }
  const levels = () => Object.fromEntries(Object.entries(me.skills || {}).map(([k, s]) => [k, s.level]));
  async function gate(kind) {
    const r = E.rng(Date.now() & 0xffff);
    const q = C.gate(kind, levels(), r);
    session.gateQ = q;
    if (kind === 'door') return await wandGate(q);
    if (kind === 'tiara') {   // the gem door: spell the password
      const g = overlay(`<div class="ask"><span class="host">${A.fairy('gemma')}</span><div class="bubble">${words('Spell the password!')}</div></div><div class="show" id="gbuild"></div><div id="gtiles"></div>`);
      V.say(q.say, { who: 'gemma' });
      await buildPlay(g.querySelector('#gbuild'), g.querySelector('#gtiles'), q, { who: 'gemma' });
      await V.say(['The door opens!'], { who: 'gemma' }); g.remove(); return true;
    }
    if (kind === 'bridge') {
      const g = overlay(`<div class="ask"><span class="host">${A.dragon()}</span><div class="bubble">${words('Fix the bridge!')}</div></div>
        <div class="bridge"><div class="planks" id="planks">${Array.from({ length: q.n }, () => '<i></i>').join('')}</div><button type="button" class="big" id="plankBtn">+ Plank</button></div>`);
      V.say(q.say, { who: 'dragon' });
      let k = 0;
      return await new Promise(done => {
        g.querySelector('#plankBtn').onclick = e => {
          const ps = g.querySelectorAll('#planks i'); if (k >= ps.length) return;
          ps[k].classList.add('on'); k++; V.sfx('plank'); V.say([String(k)], { who: 'dragon' });
          if (k === ps.length) { setTimeout(async () => { V.sfx('fanfare'); burst(...centerOf(g.querySelector('#planks')), 14); await V.say(q.tell, { who: 'dragon' }); g.remove(); done(true); }, 500); }
        };
      });
    }
    // a signpost (two signs, one is right), or the flower gate (two pictures, one rhymes)
    const flower = kind === 'flower', who = flower ? 'bloom' : 'owl';
    const g = overlay(`<div class="ask"><span class="host">${flower ? A.fairy('bloom') : A.owl()}</span><div class="bubble" id="gbub"></div></div>
      ${flower ? `<div class="show" style="min-height:120px;flex:none"><span class="bigpic small">${picture(q.show)}</span></div>` : ''}
      <div class="signs">${q.signs.map(s => `<button type="button" class="choice ${flower ? 'pic' : ''}" data-sign="${esc(s)}" aria-label="${esc(flower ? C.word(s) : s)}">${flower ? picture(s) : ltr(s, 70)}</button>`).join('')}</div>`);
    g.querySelector('#gbub').innerHTML = words(q.say.map(p => typeof p === 'string' ? p : p.snd || '').join(' '));
    V.say(q.say, { who });
    let tries = 0;
    return await new Promise(done => {
      g.addEventListener('click', async e => {
        const b = e.target.closest('[data-sign]'); if (!b) return;
        if (b.dataset.sign === q.answer) { b.classList.add('right'); V.sfx('right'); burst(...centerOf(b)); await wait(700); g.remove(); done(true); return; }
        tries++; b.classList.add('wrong'); V.sfx('again');
        if (tries === 1) V.say(q.hint, { who });
        else { const ok = g.querySelector(`[data-sign="${CSS.escape(q.answer)}"]`); ok.classList.add('hint'); V.say(q.tell, { who }); }
      });
    });
  }
  async function wandGate(q) {
    const g = overlay(`<div class="ask"><span class="host">${A.fairy('bloom')}</span><div class="bubble">${words('Open the crystal door!')}</div></div><div id="gwand"></div>`);
    const score = await wandPlay(g.querySelector('#gwand'), q, { who: 'bloom' });
    g.remove(); return score >= 0;
  }

  // ---- a round ----
  let round = null;
  const DOTS = n => Array.from({ length: n }, () => '<i></i>').join('');
  function startRound(skill) {
    V.stop();
    // the Fairy Garden: the memory game she's played least
    // the Fairy Garden and Star Meadow: the game she's played least there
    const least = list => { const n = k => (me.skills[k] || {}).answers || 0; return list.slice().sort((a, b) => n(a) - n(b) || Math.random() - 0.5)[0]; };
    if (skill === 'garden') skill = least(GARDEN);
    if (skill === 'meadow') skill = least(MEADOW);
    const sk = me.skills[skill] = me.skills[skill] || E.newSkill(Math.max(1, Math.min(C.LADDERS[skill], (set().start || {})[skill] || 1)));
    const r = E.rng((Date.now() ^ (me.rounds * 2654435761)) >>> 0);
    let plan;
    if (!sk.placed) { sk.warm = sk.warm && !sk.warm.done ? sk.warm : E.warmStart(sk.level); plan = Array.from({ length: WARM_LEN[skill] || E.TUNE.warmMax }, () => ({ warm: true })); }
    else plan = E.plan(sk, C.LADDERS[skill], E.dueFor(me.review, today(), skill + '/'), r, ROUND_LEN[skill]);
    round = { skill, sk, r, plan, i: 0, got: 0, coins: 0, hints: 0, kept: 0, longest: 0, start: Date.now(), moved: [], level0: sk.level, wasPlaced: sk.placed };
    show('round');
    $('roundBd').innerHTML = skill === 'bake' && K ? K.scene() : W.backdrop(landKey(skill));
    $('roundBack').innerHTML = ICON.back; $('howBtn').innerHTML = ICON.how;
    paintRoundCoins();
    const level = sk.placed ? sk.level : sk.warm.level;
    if (!(me.demos || {})[skill + ':' + level]) demo(level); else nextQuestion();
  }
  const paintRoundCoins = () => { $('roundCoins').innerHTML = A.coin(34) + `<span>${E.coins(me)}</span>`; };
  $('roundBack').addEventListener('click', () => { V.stop(); demoClear(); round = null; persist(true); enterWorld(); });
  $('howBtn').addEventListener('click', () => { const R = round; if (!R || R.demo) return; V.stop(); demo(R.q ? R.q.level : R.sk.level); });

  function nextQuestion() {
    const R = round; if (!R || screen !== 'round') return;
    if (R.i >= R.plan.length || (R.sk.warm && R.sk.warm.done && !R.sk.placed)) return endRound();
    const p = R.plan[R.i];
    const level = p.warm ? R.sk.warm.level : p.level;
    R.sk.tries = R.sk.tries || {};
    const q = C.make(R.skill, level, R.r, { tries: R.sk.tries[level] || 0, words: metWords(R.skill) }, p.review ? p.review.slice(R.skill.length + 1) : null);
    if (p.review && q.key !== p.review.slice(R.skill.length + 1)) { delete me.review[p.review]; p.review = null; }   // one that can't come back as itself any more
    R.q = q; R.p = p;
    draw(R, q);
  }
  // spelling practises the words she has met in Story Tower
  const metWords = skill => skill === 'spell' ? Object.keys(me.known || {}).concat(Object.keys(me.review || {})).filter(k => k.startsWith('read/w:')).map(k => k.slice(7)) : [];
  // a question on the stage, and its game started (a demo's sample too)
  function draw(R, q) {
    const [who] = HOST[R.skill];
    const dots = R.demo ? '<div class="dots demorow"></div>' : `<div class="dots" aria-label="Question ${R.i + 1} of ${R.plan.length}">${R.plan.map((_, k) => `<i class="${k < R.i ? 'on' : k === R.i ? 'now' : ''}"></i>`).join('')}</div>`;
    // what she hears, shown as words too (each lights up as it's said)
    const toks = [];
    q.say.forEach((part, k) => {
      if (typeof part !== 'string') { toks.push({ k, w: part.snd || ('-' + part.rime), c: 0, snd: true }); return; }
      let c = 0; for (const w of part.split(/\s+/).filter(Boolean)) { const at = part.indexOf(w, c); toks.push({ k, w, c: at }); c = at + w.length; }
    });
    const bub = toks.map(t => `<span class="w${t.snd ? ' snd' : ''}" data-k="${t.k}" data-c="${t.c}">${L.svg(t.w, { size: 30, stroke: t.snd ? 11 : 9, color: t.snd ? '#FF5FA8' : 'currentColor' })}</span>`).join('');
    $('stage').className = 'stage k-' + q.kind;
    $('stage').innerHTML = `${dots}<div class="ask"><button type="button" class="host" id="hostBtn" aria-label="Say it again">${host(R.skill)}</button><div class="bubble" id="bubble" aria-label="${esc(q.say.map(p => typeof p === 'string' ? p : p.snd || p.rime).join(' '))}">${bub}</div></div>
      ${PLAY[q.kind] ? '<div class="show" id="show"></div><div id="choices"></div>' : `<div class="show" id="show">${showHtml(q)}</div><div class="choices ${q.choices.length === 2 ? 'two' : q.choices.length >= 4 ? 'four' : ''}" id="choices">${q.choices.map(choiceHtml).join('')}</div>`}`;
    if (!PLAY[q.kind] && !$('show').innerHTML.trim()) $('stage').classList.add('noshow');   // only heard: the answers take the room
    $('hostBtn').onclick = () => ask(q);
    if (q.kind === 'syll') $('show').insertAdjacentHTML('beforeend', `<button type="button" class="drum" id="drum" aria-label="Tap the drum">${ICON.drum}</button>`);
    if ($('drum')) drum($('drum'));
    R.tries = 0;
    // the games she plays rather than picks: the wand, spelling with gems, Flower Match, What's Missing
    if (PLAY[q.kind]) { const go = () => PLAY[q.kind]($('show'), q, { who, choices: $('choices') }).then(score => { if (round === R && R.q === q) answered(score); });
      if (q.kind === 'missing' || q.kind === 'match' || q.kind === 'bake') { R.asked = q.kind === 'bake' ? ask(q) : V.say(q.say, { who }); go(); } else (R.asked = ask(q)).then(go); return; }
    R.asked = ask(q);
  }
  // the drum: a beat for every tap however fast, on the finger going down, each one bouncing it and lighting
  // a dot above it, so she sees every part counted; the dots clear when she stops for a moment
  function drum(el) {
    let beats = 0, idle = null, downAt = 0;
    const beat = () => {
      V.sfx('drum'); beats = Math.min(beats + 1, 6);
      el.querySelector('.beats').innerHTML = '<i></i>'.repeat(beats);
      el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
      clearTimeout(idle); idle = setTimeout(() => { beats = 0; el.querySelector('.beats').innerHTML = ''; }, 2500);
    };
    el.insertAdjacentHTML('beforeend', '<span class="beats" aria-hidden="true"></span>');
    el.addEventListener('pointerdown', () => { downAt = Date.now(); beat(); });
    el.onclick = () => { if (Date.now() - downAt > 700) beat(); };   // the demo's hand, or a keyboard
  }
  function ask(q) {
    const [who] = HOST[round.skill];
    const b = $('hostBtn'); if (b) b.classList.add('talk');
    // light the word being said: part k's first word as it starts, then each word the phone reports
    const lit = (k, c) => { const all = [...document.querySelectorAll('#bubble .w')], mine = all.filter(w => +w.dataset.k === k);
      const on = c === undefined ? mine[0] : mine.filter(w => +w.dataset.c <= c).pop();
      for (const w of all) w.classList.toggle('lit', w === on); };
    return V.say(q.say, { who, onPart: k => lit(k), onWord: (k, c) => lit(k, c) }).then(() => { if (b) b.classList.remove('talk'); for (const w of document.querySelectorAll('#bubble .w')) w.classList.remove('lit'); });
  }
  function gemRow(n, color, cls = '') { return Array.from({ length: n }, () => `<span class="${cls}">${A.gem(color, 44)}</span>`).join(''); }
  function showHtml(q) {
    const s = q.show, parts = [];
    if (q.text) { const long = q.text.length > 9; parts.push(`<div class="read ${long ? 'long' : ''}" aria-label="${esc(q.text)}">${long ? q.text.split(' ').map(w => ltr(w, 52)).join('') : ltr(q.text, 84)}</div>`); }
    if (q.story) parts.push(`<span class="storybook">${A.icon('book', 150)}</span>`);   // Story Recall: she listens; the book is the picture
    if (!s) return parts.join('');
    if (s.type === 'pic') parts.unshift(`<span class="bigpic">${picture(s.w)}</span>`);
    if (s.type === 'gems') parts.push(`<div class="gems" id="gems">${gemRow(s.n, '#FF8FC7')}</div>`);
    if (s.type === 'on') parts.push(`<div style="display:flex;align-items:center;gap:14px"><div class="tens"><span class="bag" style="width:70px;background:#FF8FC7">${s.a}</span></div><div class="gems" id="gems">${gemRow(s.b, '#8FD3FF')}</div></div>`);
    if (s.type === 'add') parts.push(`<div class="gems" id="gems" ${s.hidden ? 'hidden' : ''}>${gemRow(s.a, '#FF8FC7')}${gemRow(s.b, '#8FD3FF')}</div>`);
    if (s.type === 'take') parts.push(`<div class="gems" id="gems" ${s.hidden ? 'hidden' : ''}>${gemRow(s.a - s.b, '#B79BFF')}${gemRow(s.b, '#B79BFF', 'gone')}</div>`);
    if (s.type === 'frame') parts.push(`<div class="frame10" id="frame">${Array.from({ length: 10 }, (_, k) => `<i>${k < s.n ? A.gem('#7FE0C7', 42) : ''}</i>`).join('')}</div>`);
    if (s.type === 'tens') parts.push(`<div class="tens">${Array.from({ length: s.t }, () => '<span class="bag">10</span>').join('')}</div>`);
    if (s.type === 'carts') parts.push('');
    // Pattern Parade: the floats in a row, an empty sparkly one where the answer goes
    if (s.type === 'parade') parts.push(`<div class="parade" aria-label="${esc(s.seq.map(x => x ? C.pieceName(x) : 'an empty float').join(', '))}">${s.seq.map(x => `<span class="fl ${x ? '' : 'gap'}">${floatSvg(x)}</span>`).join('')}</div>`);
    if (s.type === 'grow') parts.push(`<div class="parade grow">${s.counts.concat([null]).map(n => `<span class="grp ${n ? '' : 'gap'}">${n ? Array.from({ length: n }, () => shapeSvg(s.piece)).join('') : floatSvg(null)}</span>`).join('')}</div>`);
    return parts.join('');
  }
  // a Pattern Parade piece ('star.pink') and its float (kitchen.js draws them)
  const shapeSvg = id => { const [sh, hu] = id.split('.'); return K ? K.shape(sh, hu) : A.svg('0 0 60 60', A.star(30, 30, 26, '#FFC94A')); };
  const floatSvg = id => K ? (id ? K.float(...id.split('.')) : K.float()) : id ? shapeSvg(id) : '';
  function choiceHtml(c) {
    const inner = c.kind === 'pic' ? picture(c.id) : c.kind === 'shape' ? shapeSvg(c.v)
      : c.kind === 'many' ? `<span class="many">${Array.from({ length: c.n }, () => shapeSvg(c.v)).join('')}</span>`
      : c.kind === 'cart' ? `<span class="cart" style="max-width:none;min-height:120px;background:none;box-shadow:none">${Array.from({ length: c.v }, () => A.gem('#FFC94A', 30)).join('')}</span>`
      : ltr(c.v, c.kind === 'word' ? 60 : 70);
    return `<button type="button" class="choice ${c.kind}" data-c="${esc(c.id)}" aria-label="${esc(c.label)}">${inner}</button>`;
  }
  $('stage').addEventListener('click', async e => {
    const b = e.target.closest('.choice'); const R = round;
    if (!b || !R || !R.q || R.q.kind === 'wand' || R.lock || b.classList.contains('dim')) return;
    const q = R.q, right = b.dataset.c === q.answer;
    if (right) {
      R.lock = true; b.classList.add('right'); V.stop(); V.sfx('right'); burst(...centerOf(b));
      if (R.tries > 0) R.kept++;
      await wait(650); R.lock = false;
      return answered(R.tries === 0 ? 1 : R.tries === 1 ? 0.5 : 0);
    }
    R.tries++; b.classList.add('wrong', 'dim'); V.sfx('again'); R.hints++;
    const [who] = HOST[R.skill];
    if (R.tries === 1) { hintShow(q); V.say(q.hint || [], { who }); }
    else { const ok = document.querySelector(`.choice[data-c="${CSS.escape(q.answer)}"]`); if (ok) ok.classList.add('hint');
      for (const c of document.querySelectorAll('.choice')) if (c !== ok) c.classList.add('dim'); V.say(q.tell || [], { who }); }
  });
  async function hintShow(q) {
    if (q.hintShow === 'reveal') { const g = $('gems'); if (g) g.hidden = false; }
    if (q.hintShow === 'count' || q.hintShow === 'reveal') { const gs = [...document.querySelectorAll('#gems > span:not(.gone)')]; for (let k = 0; k < gs.length; k++) { gs[k].classList.add('lit'); V.sfx('note', k); await wait(380); } }
    if (q.hintShow === 'empty') for (const i of document.querySelectorAll('#frame i')) if (!i.innerHTML) i.classList.add('lit');
    if (typeof q.hintShow === 'string' && q.choices.some(c => c.id === q.hintShow) && q.hintShow !== q.answer) {}
  }
  function answered(score) {
    const R = round; if (!R) return;
    if (R.demo) return demoDone(R);
    const q = R.q, p = R.p, day = today(), sk = R.sk, max = C.LADDERS[R.skill];
    if (score > 0) { const coins = E.TUNE.coinRight; E.earn(me, device, coins); R.coins += coins; V.sfx('coin'); paintRoundCoins(); }
    if (score === 1) R.got++;
    E.logAnswer(me, device, day, R.skill, score === 1);
    sk.tries = sk.tries || {}; sk.tries[q.level] = (sk.tries[q.level] || 0) + 1;
    if (p.warm) {
      E.warmStep(sk.warm, score === 1, max); sk.answers++;
      if (sk.warm.done) { sk.level = sk.warm.place; sk.best = Math.max(sk.best || 1, sk.level); sk.placed = true; R.placed = true; }
    } else {
      const move = E.record(sk, score, max, !p.review);
      if (move === 1) { R.moved.push(sk.level); me.stickers = me.stickers || []; me.stickers.push(R.skill + ':' + sk.level + ':' + Date.now().toString(36)); }
    }
    // review: the words, sounds and facts that can come back as themselves (content.js fromKey)
    if (q.key && C.reviewable(q.key)) E.remember(me.review, me.known, R.skill + '/' + q.key, score === 1, day, !p.review && !p.warm && q.level >= R.level0);
    me.levels = me.levels || {}; (me.levels[day] = me.levels[day] || {})[R.skill] = sk.level;
    if (q.kind === 'wand' && score === 1) R.longest = Math.max(R.longest, q.seq.length);
    if (q.kind === 'bake' && score > 0) { R.baked = (R.baked || 0) + 1; R.treat = q.treat; }
    persist();
    R.i++;
    nextQuestion();
  }

  // ---- how to play: before a round whose game (a skill's level) is new to her, and from the ? button ----
  // Her friend says what to do, then a hand plays one sample question on the real stage while she watches
  // (her taps are held back; Skip ends it), then it's her turn. A sample's answer counts for nothing.
  const HOW = q => q.story ? 'Listen to a little story, then answer a question about it.'
    : { pick: 'Listen to the question, then tap the right answer. You can tap me to hear it again.',
      syll: 'Listen to the word, and tap the drum for each part. Then tap how many parts it has.',
      build: 'Listen to the word, then tap the letter gems in order to spell it.',
      wand: q.back ? 'Watch the sparkles light up. Then tap them backwards, from the last one to the first!' : 'Watch the sparkles light up, then tap them in the same order.',
      match: 'Tap two flowers to peek under them. Remember what you saw, and find the two that match!',
      bake: q.mode === 'share' ? 'Tap a plate to put a cookie on it. Share them so every plate has the same, then tap Done.'
        : 'Tap the things the recipe needs to put them in the bowl. Tap one in the bowl to take it out. Then tap Bake!',
      missing: `Look carefully at everything on the tray. A cloud will hide it, and ${(q.answers || []).length > 1 ? 'two things' : 'one thing'} will go away. Tap what's missing!` }[q.kind] || 'Watch me first!';
  const HAND = '<svg viewBox="0 0 64 72" aria-hidden="true"><path d="M24 6c4 0 7 3 7 7v20l3-1c3-1 6 0 7 3l1 2c3-1 6 0 7 3l1 1c3-1 6 1 7 4l1 9c1 9-4 16-12 18H33c-6 0-10-3-13-8L10 47c-2-3-1-6 2-8c3-1 6 0 8 2l-3-28c0-4 3-7 7-7Z" fill="#fff" stroke="#4B2E6F" stroke-width="4" stroke-linejoin="round"/><path d="M35 40v10M45 42v8M54 45v6" stroke="#4B2E6F" stroke-width="3" stroke-linecap="round"/></svg>';
  function demoClear() { for (const id of ['demoVeil', 'hand']) { const el = $(id); if (el) el.remove(); } }
  const waitFor = async (ok, ms = 15000) => { const t = Date.now(); while (!ok()) { if (Date.now() - t > ms) return false; await wait(120); } return true; };
  async function demo(level) {
    const R = round; if (!R) return;
    const run = R.demoRun = {}, live = () => round === R && R.demoRun === run;
    R.demo = true;
    const [who, name] = HOST[R.skill];
    const q = C.make(R.skill, level, E.rng((Date.now() * 7) >>> 0), { tries: 0, words: metWords(R.skill) });
    if (q.kind === 'match') q.swap = false;
    if (q.kind === 'missing') q.look = Math.min(q.look, 2500);
    demoClear();
    $('round').insertAdjacentHTML('beforeend', `<div class="demoveil" id="demoVeil"><div class="demotag" id="demoTag">${A.icon('sparkle', 26)}<span>Watch how to play!</span></div><button type="button" class="demoskip" id="demoSkip">Skip</button>
      <div class="howcard" id="howCard"><span class="hh">${host(R.skill)}</span><b>${esc(SKILL_NAME[R.skill])}</b><span>${esc(HOW(q))}</span></div></div><div class="hand" id="hand" hidden>${HAND}</div>`);
    $('demoSkip').onclick = () => { V.stop(); demoDone(R); };
    $('stage').innerHTML = '';
    await V.say([HOW(q) + ' Watch me first!'], { who });
    if (!live()) return;
    $('howCard').remove();
    R.q = q; R.p = { demo: true };
    draw(R, q);
    const hand = $('hand'); hand.hidden = false;
    const tap = async el => { if (!live() || !el) return;
      const r = el.getBoundingClientRect(); hand.style.left = (r.left + r.width / 2) + 'px'; hand.style.top = (r.top + r.height / 2) + 'px';
      await wait(reduce() ? 250 : 700); if (!live()) return;
      hand.classList.add('tap'); await wait(160); if (live()) el.click(); await wait(260); hand.classList.remove('tap'); };
    const show = $('show'), ch = $('choices'), sel = (box, s) => box && box.querySelector(s);
    if (q.kind === 'build') {
      if (!await waitFor(() => !live() || ch.onclick)) return;
      const used = new Set();
      for (const l of q.word) { const k = q.tiles.findIndex((t, i) => t === l && !used.has(i)); used.add(k); await tap(sel(ch, `.tile[data-t="${k}"]`)); await wait(250); }
    } else if (q.kind === 'match') {
      if (!await waitFor(() => !live() || show.onclick)) return;
      // a peek that doesn't match (they turn back), then the pair
      const a = 0, mate = q.cards.findIndex((c, k) => k !== a && c.pair === q.cards[a].pair), other = q.cards.findIndex((c, k) => k !== a && c.pair !== q.cards[a].pair);
      await tap(sel(show, `.card[data-k="${a}"]`)); await tap(sel(show, `.card[data-k="${other}"]`)); await wait(1300);
      await tap(sel(show, `.card[data-k="${a}"]`)); await tap(sel(show, `.card[data-k="${mate}"]`)); await wait(900);
      if (live()) demoDone(R);
    } else if (q.kind === 'missing') {
      if (!await waitFor(() => !live() || ch.onclick)) return;
      for (const id of q.answers) await tap(sel(ch, `.choice[data-c="${CSS.escape(id)}"]`));
    } else if (q.kind === 'bake') {
      await R.asked; if (!await waitFor(() => !live() || ch.onclick)) return;
      if (q.mode === 'share') { for (let k = 0; k < q.n; k++) await tap(sel(show, `.plate[data-plate="${k % q.plates}"]`)); }
      else for (const [id, n] of Object.entries(q.need)) {
        const have = (q.start || {})[id] || 0;
        if (q.sack && n >= 10) { await tap(sel(ch, '[data-sack]')); }
        for (let k = have + (q.sack && n >= 10 ? 10 : 0); k < n; k++) await tap(sel(ch, `[data-add="${id}"]`));
        for (let k = n; k < have; k++) await tap(sel(show, `[data-out="${id}"]`));
      }
      await tap($('bakeBtn'));
    } else if (q.kind === 'wand') {
      if (!await waitFor(() => !live() || (show.onclick && show.style.pointerEvents === ''))) return;
      for (const k of q.back ? q.seq.slice().reverse() : q.seq) await tap(sel(show, `button[data-k="${k}"]`));
    } else {
      await R.asked; if (!live()) return;
      if (q.kind === 'syll') for (let k = 0; k < q.parts.length; k++) { await tap($('drum')); await wait(200); }
      await tap(sel(ch, `.choice[data-c="${CSS.escape(q.answer)}"]`));
    }
  }
  async function demoDone(R) {
    if (R.demo !== true) return;
    R.demo = 'ending'; R.demoRun = null; R.q = null;
    const level = R.sk.placed ? R.sk.level : R.sk.warm.level;
    me.demos = me.demos || {}; me.demos[R.skill + ':' + level] = 1; persist();
    const hand = $('hand'); if (hand) hand.remove();
    const tag = $('demoTag'); if (tag) tag.innerHTML = `${A.icon('star', 26)}<span>Your turn!</span>`;
    const skip = $('demoSkip'); if (skip) skip.remove();
    await V.say(["Now it's your turn!"], { who: HOST[R.skill][0] });
    demoClear();
    if (round !== R || R.demo !== 'ending') return;
    R.demo = false;
    if (screen === 'round') nextQuestion();
  }

  // ---- the games she plays rather than picks; each resolves with her score (1, 0.5 or 0) ----
  const PLAY = { wand: (box, q, opt) => wandPlay(box, q, opt), build: (box, q, opt) => buildPlay(box, opt.choices, q, opt), match: (box, q, opt) => matchPlay(box, q, opt), missing: (box, q, opt) => missingPlay(box, opt.choices, q, opt),
    bake: (box, q, opt) => bakePlay(box, opt.choices, q, opt) };
  const scoreOf = misses => misses === 0 ? 1 : misses === 1 ? 0.5 : 0;

  // spelling with gems: tap the letters in order; a wrong gem shakes, the next sound is said, then the gem glows
  function buildPlay(box, tilesBox, q, opt = {}) {
    box.innerHTML = `${q.show ? `<span class="bigpic small">${picture(q.show.w)}</span>` : ''}<div class="slots" role="group" aria-label="The word">${[...q.word].map(() => '<i></i>').join('')}</div>`;
    tilesBox.className = 'tiles';
    tilesBox.innerHTML = q.tiles.map((l, k) => `<button type="button" class="tile" data-t="${k}" aria-label="${esc(l)}" style="--c:${['#FF8FC7', '#B79BFF', '#7FE0C7', '#8FD3FF', '#FFC94A', '#FF8A7A'][k % 6]}">${ltr(l, 58)}</button>`).join('');
    const slots = [...box.querySelectorAll('.slots i')];
    let at = 0, misses = 0;
    return new Promise(done => {
      tilesBox.onclick = async e => {
        const b = e.target.closest('.tile'); if (!b || b.disabled) return;
        const l = q.tiles[+b.dataset.t], want = q.word[at];
        if (l === want) {
          b.disabled = true; b.classList.add('used'); slots[at].innerHTML = ltr(l, 58); slots[at].classList.add('on'); at++;
          for (const t of tilesBox.querySelectorAll('.tile.hint')) t.classList.remove('hint');
          V.say([{ snd: l }], { who: opt.who });
          if (at === q.word.length) { tilesBox.onclick = null; V.sfx('right'); burst(...centerOf(box), 12); await wait(500); await V.say(q.tell || [], { who: opt.who }); done(scoreOf(misses)); }
          return;
        }
        misses++; b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong'); V.sfx('again');
        if (misses === 1) V.say(['Listen:', { snd: want }], { who: opt.who });
        else { const t = [...tilesBox.querySelectorAll('.tile:not(.used)')].find(x => q.tiles[+x.dataset.t] === want); if (t) t.classList.add('hint'); V.say([{ snd: want }], { who: opt.who }); }
      };
    });
  }

  // the Unicorn Bakery: tap things into the bowl (and tap one in the bowl to take it out), then Bake. Each one
  // put in is counted out loud. A first wrong bake counts what's there with her; a second says the recipe.
  // Sharing: tap a plate to put a cookie on it, then Done. A right bake goes in the oven and is a treat for the stables.
  function bakePlay(box, pantryBox, q, opt = {}) {
    const ING = id => K ? K.ing(id) : esc(id), say = (t, o) => V.say(t, Object.assign({ who: opt.who }, o));
    const bowl = Object.assign({}, q.start || {}), plates = Array.from({ length: q.plates || 0 }, () => 0);
    let tray = q.n || 0, sacks = 0, misses = 0, lock = false;
    const count = id => (bowl[id] || 0) + (q.sack && id === Object.keys(q.need)[0] ? sacks * 10 : 0);
    const card = () => {
      if (q.mode === 'share') return '';
      if (q.groups) { const id = Object.keys(q.need)[0]; return `<div class="recipe">${q.groups.map(n => `<span class="grp">${Array.from({ length: n }, () => `<i>${ING(id)}</i>`).join('')}</span>`).join('<b>+</b>')}</div>`; }
      if (q.level === 4 || q.level === 6) return '';
      return `<div class="recipe">${Object.entries(q.need).map(([id, n]) => `<span class="need"><i>${ING(id)}</i>${ltr(String(n), 44)}</span>`).join('')}</div>`;
    };
    const paint = () => {
      if (q.mode === 'share') {
        box.innerHTML = `<div class="bake share"><div class="tray">${Array.from({ length: tray }, () => `<i>${K ? K.treat('cookie') : ''}</i>`).join('')}</div>
          <div class="plates">${plates.map((n, i) => `<button type="button" class="plate" data-plate="${i}" aria-label="Plate ${i + 1}, ${n} cookies"><span class="on">${Array.from({ length: n }, () => `<i data-back="${i}">${K ? K.treat('cookie') : ''}</i>`).join('')}</span>${K ? K.plate({ color: ['pink', 'sky', 'mint'][i] }) : ''}</button>`).join('')}</div></div>`;
        return;
      }
      const inside = Object.keys(bowl).flatMap(id => Array.from({ length: bowl[id] }, () => id));
      box.innerHTML = `<div class="bake">${card()}<div class="bowlbox"><div class="inbowl ${q.frame ? 'frame' : ''}" id="inBowl" aria-label="In the bowl: ${esc(Object.keys(q.need).concat(Object.keys(bowl)).filter((x, i, a) => a.indexOf(x) === i).map(id => C.many(count(id), id)).join(', '))}">
        ${Array.from({ length: sacks }, () => `<button type="button" class="it sack" data-out="sack" aria-label="A sack of ten">${K ? K.sack() : '10'}</button>`).join('')}
        ${inside.map(id => `<button type="button" class="it" data-out="${id}" aria-label="${esc(C.ING_SAY[id][0])}">${ING(id)}</button>`).join('')}
        ${q.frame ? Array.from({ length: Math.max(0, 10 - inside.length) }, () => '<span class="it empty"></span>').join('') : ''}</div><span class="bowl">${K ? K.bowl() : ''}</span></div></div>`;
    };
    pantryBox.className = 'pantry';
    pantryBox.innerHTML = (q.mode === 'share' ? '' : q.pantry.map(id => `<button type="button" class="add" data-add="${id}" aria-label="Add a ${esc(C.ING_SAY[id][0])}">${ING(id)}</button>`).join('')
      + (q.sack ? `<button type="button" class="add" data-sack aria-label="Add a sack of ten">${K ? K.sack() : '10'}</button>` : ''))
      + `<button type="button" class="big pink bakebtn" id="bakeBtn">${K ? `<span class="ov">${K.oven()}</span>` : ''}<span>${q.mode === 'share' ? 'Done' : 'Bake'}</span></button>`;
    paint();
    const right = () => q.mode === 'share' ? !tray && plates.every(n => n === plates[0])
      : Object.keys(q.need).every(id => count(id) === q.need[id]) && Object.keys(bowl).every(id => q.need[id] !== undefined || !bowl[id]);
    return new Promise(done => {
      const tapAt = async e => {
        if (lock) return;
        const add = e.target.closest('[data-add]'), sk = e.target.closest('[data-sack]'), out = e.target.closest('[data-out]'), pl = e.target.closest('[data-plate]'), back = e.target.closest('[data-back]');
        if (back) { const i = +back.dataset.back; if (plates[i] > 0) { plates[i]--; tray++; V.sfx('pop'); paint(); } return; }
        if (pl) { const i = +pl.dataset.plate; if (!tray) { V.sfx('again'); return; } tray--; plates[i]++; V.sfx('pop'); paint(); say([String(plates[i])]); return; }
        if (add) { const id = add.dataset.add; if (count(id) >= 20) return; bowl[id] = (bowl[id] || 0) + 1; V.sfx('pop'); paint(); say([String(count(id))]); return; }
        if (sk) { if (sacks >= 1) { V.sfx('again'); return; } sacks++; V.sfx('plank'); paint(); say([String(count(Object.keys(q.need)[0]))]); return; }
        if (out) { const id = out.dataset.out; if (id === 'sack') sacks = Math.max(0, sacks - 1); else if (bowl[id]) bowl[id]--; V.sfx('whoosh'); paint();
          const left = id === 'sack' ? Object.keys(q.need)[0] : id; say([String(count(left))]); return; }
        if (!e.target.closest('#bakeBtn')) return;
        lock = true;
        if (right()) {
          pantryBox.onclick = box.onclick = null; V.stop(); V.sfx('right');
          const b = $('bakeBtn'); if (b) b.classList.add('baking');
          if (K && q.mode !== 'share') { const ov = b && b.querySelector('.ov'); if (ov) ov.innerHTML = K.oven({ on: true, treat: q.treat }); }
          await wait(900); burst(...centerOf(box), 14);
          if (q.mode !== 'share') box.innerHTML = `<div class="bake done"><span class="treatpic">${K ? K.treat(q.treat) : ''}</span></div>`;
          await say([q.mode === 'share' ? 'Fair shares for everyone!' : 'Yum! It smells wonderful!']);
          done(scoreOf(misses)); return;
        }
        misses++; V.sfx('again'); lock = false;
        if (misses === 1) {
          if (q.mode === 'share') { await say([tray ? `There are still ${tray} cookies to share.` : `Let's count each plate: ${plates.join(', ')}. Are they the same?`]); return; }
          const id = Object.keys(q.need).find(k => count(k) !== q.need[k]) || Object.keys(bowl).find(k => bowl[k] && q.need[k] === undefined);
          const n = count(id); await say([`Let's count the ${C.ING_SAY[id][1]}. ${n ? Array.from({ length: n }, (_, k) => k + 1).join(', ') + '.' : 'There are none yet.'} Do you need more, or fewer?`]);
        } else { await say(q.tell); const c = box.querySelector('.recipe'); if (!c && q.mode !== 'share') { box.insertAdjacentHTML('afterbegin', `<div class="recipe">${Object.entries(q.need).map(([id, n]) => `<span class="need"><i>${ING(id)}</i>${ltr(String(n), 44)}</span>`).join('')}</div>`); } }
      };
      box.onclick = tapAt; pantryBox.onclick = tapAt;
    });
  }

  // Flower Match: flip two at a time; matched pairs stay. A swap level: the fairy swaps two face-down cards, where she can see
  function cardFace(f) {
    if (f.kind === 'pic') return picture(f.w);
    if (f.kind === 'dots') return `<span class="dots6">${Array.from({ length: f.n }, () => '<i></i>').join('')}</span>`;
    return ltr(f.v, 56);
  }
  function matchPlay(box, q, opt = {}) {
    box.classList.add('cardsbox');
    // sideways on a big screen (index.html): more across than down
    const n = q.cards.length, wide = [2, 3, 4, 5, 6, 7, 8].map(c => [c, Math.abs(c / Math.ceil(n / c) - 1.6) + (c * Math.ceil(n / c) - n) * 0.3]).sort((a, b) => a[1] - b[1])[0][0];
    box.innerHTML = `<div class="cards" style="grid-template-columns:repeat(${q.cols},1fr);--wide:${wide}">${q.cards.map((c, k) => `<button type="button" class="card" data-k="${k}" aria-label="A flower card"><span class="back">${A.icon('flower', 40)}</span><span class="face">${cardFace(c.face)}</span></button>`).join('')}</div>`;
    const btns = [...box.querySelectorAll('.card')];
    let open = [], flips = 0, found = 0, swapped = !q.swap, lock = false;
    const faceLabel = c => c.face.kind === 'pic' ? C.word(c.face.w) : c.face.kind === 'dots' ? c.face.n + ' dots' : c.face.v;
    async function swap() {
      const down = btns.filter(b => !b.classList.contains('up') && !b.classList.contains('done'));
      if (down.length < 2) return;
      const [a, b] = [down[0], down[down.length - 1]];
      lock = true; a.classList.add('swap'); b.classList.add('swap');
      await V.say(['Bloom swapped two cards! Watch!'], { who: 'bloom' }); await wait(700);
      const ka = +a.dataset.k, kb = +b.dataset.k; [q.cards[ka], q.cards[kb]] = [q.cards[kb], q.cards[ka]];
      a.querySelector('.face').innerHTML = cardFace(q.cards[ka].face); b.querySelector('.face').innerHTML = cardFace(q.cards[kb].face);
      a.classList.remove('swap'); b.classList.remove('swap'); lock = false;
    }
    return new Promise(done => {
      box.onclick = async e => {
        const b = e.target.closest('.card'); if (!b || lock || b.classList.contains('up') || b.classList.contains('done')) return;
        const c = q.cards[+b.dataset.k];
        b.classList.add('up'); b.setAttribute('aria-label', faceLabel(c)); flips++; V.sfx('pop'); open.push(b);
        if (q.learn || c.face.kind === 'pic') V.say([c.face.kind === 'letter' ? { snd: c.face.v } : faceLabel(c)], { who: opt.who });
        if (open.length < 2) return;
        lock = true;
        const [x, y] = open; open = [];
        if (q.cards[+x.dataset.k].pair === q.cards[+y.dataset.k].pair) {
          await wait(350); x.classList.add('done'); y.classList.add('done'); V.sfx('right'); found++; lock = false;
          if (found === q.pairs) { box.onclick = null; burst(...centerOf(box), 16); await wait(400); box.classList.remove('cardsbox'); done(flips <= q.pairs * 3 ? 1 : flips <= q.pairs * 4.5 ? 0.5 : 0); return; }
          if (!swapped && found >= 1) { swapped = true; await swap(); }
          return;
        }
        await wait(900); x.classList.remove('up'); y.classList.remove('up'); x.setAttribute('aria-label', 'A flower card'); y.setAttribute('aria-label', 'A flower card'); lock = false;
      };
    });
  }

  // What's Missing: look at the tray, a cloud covers it, then find what's gone (two things on the hardest levels)
  async function missingPlay(box, choicesBox, q, opt = {}) {
    const tray = items => `<div class="tray">${items.map(w => `<span class="titem">${picture(w)}</span>`).join('')}</div>`;
    box.innerHTML = tray(q.items);
    choicesBox.className = 'choices'; choicesBox.innerHTML = '';
    await wait(q.look);
    box.insertAdjacentHTML('beforeend', `<div class="cover">${A.cloud(260)}</div>`); V.sfx('whoosh');
    await wait(1300);
    box.innerHTML = tray(q.left);
    await V.say(q.ask, { who: opt.who });
    choicesBox.className = 'choices' + (q.choices.length >= 4 ? ' four' : '');
    choicesBox.innerHTML = q.choices.map(c => `<button type="button" class="choice pic" data-c="${esc(c.id)}" aria-label="${esc(c.label)}">${picture(c.id)}</button>`).join('');
    let misses = 0; const got = new Set();
    return new Promise(done => {
      choicesBox.onclick = async e => {
        const b = e.target.closest('.choice'); if (!b || b.classList.contains('dim') || b.classList.contains('right')) return;
        const id = b.dataset.c;
        if (q.answers.includes(id)) { b.classList.add('right'); got.add(id); V.sfx('right');
          if (got.size === q.answers.length) { choicesBox.onclick = null; burst(...centerOf(b)); box.innerHTML = tray(q.items); await wait(700); done(scoreOf(misses)); }
          return; }
        misses++; b.classList.add('wrong', 'dim'); V.sfx('again');
        if (misses === 1) V.say(q.hint, { who: opt.who });
        else { for (const a of q.answers) { const ok = choicesBox.querySelector(`[data-c="${CSS.escape(a)}"]`); if (ok && !got.has(a)) ok.classList.add('hint'); } V.say(q.tell, { who: opt.who }); }
      };
    });
  }

  // the wand's sparkle sequence: watch, then tap it back (backwards on some levels)
  const WAND_COLORS = ['#FF8FC7', '#FFC94A', '#7FE0C7', '#8FD3FF', '#B79BFF', '#FF8A7A', '#FFB257', '#7FE0A0', '#D9CCFF'];
  async function wandPlay(box, q, opt = {}) {
    box.innerHTML = `<div class="wand" style="grid-template-columns:repeat(3,1fr)">${Array.from({ length: q.grid }, (_, k) => `<button type="button" data-k="${k}" style="background:${WAND_COLORS[k]}" aria-label="Sparkle ${k + 1}">${A.svg('0 0 40 40', A.star(20, 20, 16, '#fff', 'opacity=".85"'))}</button>`).join('')}</div>`;
    const btns = [...box.querySelectorAll('button')], speed = Math.max(380, 760 - q.seq.length * 40);
    const flash = async (k, ms) => { btns[k].classList.add('lit'); V.sfx('note', k); await wait(ms * 0.7); btns[k].classList.remove('lit'); await wait(ms * 0.3); };
    const play = async ms => { box.style.pointerEvents = 'none'; await wait(400); for (const k of q.seq) await flash(k, ms); box.style.pointerEvents = ''; };
    const want = q.back ? q.seq.slice().reverse() : q.seq;
    let tries = 0;
    for (;;) {
      await play(tries === 2 ? speed * 1.5 : speed);
      if (tries === 2) { await V.say(['Your turn. You can do it!'], { who: opt.who }); }
      const ok = await new Promise(done => {
        let i = 0;
        box.onclick = e => { const b = e.target.closest('button'); if (!b) return; const k = +b.dataset.k;
          b.classList.add('lit'); V.sfx('note', k); setTimeout(() => b.classList.remove('lit'), 220);
          if (k !== want[i]) { box.onclick = null; done(false); return; }
          i++; if (i === want.length) { box.onclick = null; done(true); } };
      });
      if (ok) { V.sfx('right'); burst(...centerOf(box), 14); await wait(500); return tries === 0 ? 1 : tries === 1 ? 0.5 : 0; }
      tries++; V.sfx('again');
      if (tries === 1) await V.say(['Oops! Watch again.'], { who: opt.who });
      else if (tries === 2) await V.say(['Watch slowly this time.'], { who: opt.who });
      else { if (opt.who === 'gemma' && q.gate) { await V.say(['The door opens for trying so hard!'], { who: opt.who }); return 0; } return 0; }
    }
  }

  // ---- the end of a round ----
  function praise(R) {
    if (R.placed && !R.wasPlaced) return 'Great job! Now I know just where to start.';
    if (R.kept > 0) return 'You kept trying and got it!';
    if (R.skill === 'read') return R.got >= R.plan.length - 1 ? 'You sounded out every word!' : 'You worked so hard on your reading!';
    if (R.skill === 'math') return 'You counted so carefully!';
    if (R.skill === 'wand' && R.longest) return `You remembered ${R.longest} sparkles!`;
    if (R.skill === 'spell') return R.got >= R.plan.length - 1 ? 'You spelled every word!' : 'You listened for every sound!';
    if (R.skill === 'match') return 'What a great memory! You found every pair.';
    if (R.skill === 'missing') return 'Such sharp eyes!';
    if (R.skill === 'recall') return 'You listened so carefully!';
    if (R.skill === 'pattern') return 'You found every pattern in the parade!';
    if (R.skill === 'bake') return 'What a wonderful baker you are!';
    return 'You worked so hard!';
  }
  async function endRound() {
    const R = round; if (!R) return;
    round = null;
    const stageBefore = stageOf(me);
    E.earn(me, device, E.TUNE.coinRound); R.coins += E.TUNE.coinRound;
    me.rounds = (me.rounds || 0) + 1; session.recent.push(R.skill);
    const land = landKey(R.skill); E.finished(me, device, land);
    const chapter = Ch.CHAPTERS[land] ? Ch.next(land, E.roundsIn(me, land), (me.chapters || {})[land] || 0) : null;
    // her unicorn comes home from the land a little tired and muddy (the stables); the bakery's treats go to its pantry
    const pet = petNow();
    if (R.skill === 'bake') { if (R.baked) Care.bake(pet, R.treat || 'cupcake', R.baked); } else Care.adventure(pet, land);
    const rankWas = me.rank || 0; me.rank = rankOf(me); const promoted = me.rank > rankWas;
    // the Grey Fog lifts from a land after enough rounds in all
    me.world.open = me.world.open || {};
    const lifted = Object.keys(UNFOG).filter(l => !me.world.open[l] && me.rounds >= UNFOG[l]);
    for (const l of lifted) me.world.open[l] = Date.now();
    const q = quest(), stop = LAND_OF[R.skill], idx = q.stops.findIndex((s, k) => s === stop && !q.done[k]);
    if (idx >= 0) q.done[idx] = true;
    const questDone = q.done.every(Boolean) && !q.gift;
    if (questDone) q.gift = true;
    const lucky = R.r() < 1 / E.TUNE.giftEvery;
    const gifts = (questDone ? 1 : 0) + (lucky ? 1 : 0) + (R.readStar ? 1 : 0);
    E.trim(me, today());
    persist(true);
    const grew = stageOf(me) > stageBefore;
    show('reward');
    $('rewardBd').innerHTML = R.skill === 'bake' && K ? K.scene() : W.backdrop(landKey(R.skill));
    const msg = praise(R);
    $('rewardIn').innerHTML = `<div class="cheer dash"><div class="dance">${A.unicorn(stageOf(me), wearing(me), { mood: 'happy' })}</div></div>
      <div class="praise">${esc(msg)}</div>
      <div class="earn">${A.coin(46)}<span>+${R.coins}</span></div>
      ${R.skill === 'bake' && R.baked ? `<div class="praise note"><span class="treatpic">${K.treat(R.treat)}</span><span>${R.baked} ${R.baked === 1 ? 'treat' : 'treats'} for your unicorn! Find ${R.baked === 1 ? 'it' : 'them'} in the stables.</span></div>` : ''}
      ${R.moved.length ? `<div class="praise note">${A.icon('star', 26)}<span>New sticker! You're ready for harder ones.</span></div>` : ''}
      ${grew ? `<div class="praise note">${A.icon('unicorn', 26)}<span>Your unicorn grew!</span></div>` : ''}
      ${lifted.map(l => `<div class="praise note">${A.icon(l === 'garden' ? 'flower' : 'tiara', 26)}<span>The fog lifted! ${esc(LAND_NAME[l][0].toUpperCase() + LAND_NAME[l].slice(1))} is open.</span></div>`).join('')}
      ${promoted ? `<div class="praise note">${A.icon('tiara', 26)}<span>You are a ${esc(RANKS[me.rank])} now!</span></div>` : ''}
      ${gifts ? `<button type="button" class="giftbox" id="giftBtn" aria-label="Open your surprise">${A.gift()}</button>` : ''}
      ${chapter ? `<button type="button" class="chbook" id="chapterBtn">${A.icon('book', 44)}<span>New chapter!</span></button>` : ''}
      <div style="display:flex;gap:12px"><button type="button" class="big mint" id="againBtn" aria-label="Play again">${ICON.again}</button><button type="button" class="big pink" id="mapBtn">${ICON.go}<span>Kingdom</span></button></div>`;
    V.sfx('fanfare');
    V.say([msg, ...(R.skill === 'bake' && R.baked ? [`You baked ${R.baked} ${R.baked === 1 ? 'treat' : 'treats'} for your unicorn!`] : []), ...(R.moved.length ? ["You earned a sticker! You're ready for harder ones."] : []), ...(grew ? ['Look! Your unicorn grew!'] : []), ...(promoted ? [`Hooray! You are a ${RANKS[me.rank]} now!`] : []), ...(gifts ? ['And there is a surprise for you. Tap the present!'] : []), ...(chapter ? ['A new chapter of the story is ready. Tap the book!'] : []), ...(questDone ? ["You finished today's quest!"] : []), ...lifted.map(l => `Look! The Grey Fog is lifting. ${LAND_NAME[l][0].toUpperCase() + LAND_NAME[l].slice(1)} is open! Find it on the map.`)], { who: 'narrator' });
    $('againBtn').onclick = () => startRound(R.skill);
    $('mapBtn').onclick = () => enterWorld();
    if (R.skill === 'bake') { $('mapBtn').innerHTML = `${ICON.home}<span>Castle</span>`; $('mapBtn').onclick = () => openCastle(); }
    if ($('chapterBtn')) $('chapterBtn').onclick = () => { V.stop(); V.sfx('whoosh'); tell(chapter, R.skill); };
    if ($('giftBtn')) $('giftBtn').onclick = e => {
      const got = Array.from({ length: gifts }, () => surprise()), it = got.find(Boolean);
      burst(e.clientX, e.clientY, 16); V.sfx('sparkle');
      $('giftBtn').outerHTML = `<div class="reveal">${it ? giftArt(it) : A.coin(150)}</div>`;
      V.say([it ? `A ${giftName(it)} for you! Find it in your castle.` : 'Ten shiny coins for you!', ...(got.length > 1 ? ['And another surprise is waiting in your castle!'] : [])]);
      persist(true); };
    sync();
  }
  // ---- a chapter of the story: a page a line, told by the land's friend; the end brings colour (and the 5th and 10th a present) ----
  const giftName = id => (A.ITEMS[id] || bedDef(id) || RM.ITEMS[id] || { name: 'present' }).name.toLowerCase();
  const giftArt = id => A.ITEMS[id] ? A.itemCard(id, me.look) : bedDef(id) ? BR.piece(id) : RM.ITEMS[id] ? RM.piece(id) : A.gift();
  // skill: the round it came after (to play again), or none when it's read again from the castle's Stories
  function tell(ch, skill) {
    const replay = !skill, lines = ch.lines.map(t => Ch.line(t, me.name)), where = cap(Ch.LAND[ch.land]);
    show('chapter'); $('chapterBd').innerHTML = W.backdrop(ch.land); V.prefetch(lines, Ch.WHO[ch.land]);
    let i = 0;
    const page = () => {
      $('chapterIn').innerHTML = `<div class="chtitle"><small>${esc(where)} · Chapter ${ch.n}</small>${esc(ch.title)}</div>
        <div class="charts"><span class="pr">${A.princess(me.look, wearing(me), { mood: 'happy' })}</span><span class="hs dance">${host(ch.land)}</span></div>
        <div class="story" id="chLine">${esc(lines[i])}</div><div class="chpage" aria-hidden="true">${lines.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
        <button type="button" class="big pink" id="chNext">${ICON.go}<span>${i < lines.length - 1 ? 'Next' : 'The end'}</span></button>`;
      V.say([lines[i]], { who: Ch.WHO[ch.land] });
      $('chNext').onclick = () => { V.stop(); V.sfx('pop'); i++; if (i < lines.length) page(); else end(); };
    };
    const end = () => {
      const gift = !replay && ch.gift;
      if (!replay) {
        me.chapters = me.chapters || {}; me.chapters[ch.land] = Math.max(me.chapters[ch.land] || 0, ch.n);
        if (gift && !me.owned.includes(gift)) me.owned.push(gift);
        persist(true); sync();
      }
      const msg = replay ? 'The end!' : gift ? `A present for you: the ${giftName(gift)}! Find it in your castle.` : ch.n === 10 ? `${where} has all its colours back!` : `Look! ${where} has a little more colour now.`;
      $('chapterIn').innerHTML = `<div class="chtitle"><small>${esc(where)} · Chapter ${ch.n}</small>The end</div>
        ${gift ? `<div class="reveal">${giftArt(gift)}</div>` : `<div class="cheer"><div class="dance">${host(ch.land)}</div></div>`}
        <div class="praise">${esc(msg)}</div>
        <div style="display:flex;gap:12px">${replay ? `<button type="button" class="big pink" id="chBack">${ICON.back}<span>Castle</span></button>`
          : `<button type="button" class="big mint" id="chAgain" aria-label="Play again">${ICON.again}</button><button type="button" class="big pink" id="chMap">${ICON.go}<span>Kingdom</span></button>`}</div>`;
      V.sfx(gift || ch.n === 10 ? 'fanfare' : 'sparkle'); if (gift) burst(innerWidth / 2, innerHeight / 2.5, 18);
      V.say([msg], { who: 'narrator' });
      if (replay) $('chBack').onclick = () => { V.stop(); show('castle'); paintCastle(); };
      else { $('chAgain').onclick = () => { V.stop(); startRound(skill); }; $('chMap').onclick = () => { V.stop(); enterWorld(); }; }
    };
    page();
  }
  // a surprise: something she doesn't have yet (the cheapest first), else 10 coins
  function surprise() {
    const pool = [...Object.entries(A.ITEMS), ...Object.entries(RM.ITEMS).filter(([id]) => !BR.ITEMS[id] && !BR.WALLS[id]), ...Object.entries(BR.ITEMS), ...Object.entries(BR.WALLS), ...Object.entries(BR.FLOORS)];
    const want = pool.filter(([id, it]) => it.price > 0 && !it.gift && !owns(me, id) && !(me.owned || []).includes(id)).sort((a, b) => a[1].price - b[1].price);
    me.gifts = (me.gifts || 0) + 1;
    if (!want.length) { E.earn(me, device, 10); return null; }
    const pick = want[Math.floor(Math.random() * Math.min(4, want.length))][0];
    me.owned.push(pick); return pick;
  }

  // ---- her castle: dress up, the Royal Boutique, the treasure book ----
  const TABS = [['gown', 'Gowns'], ['tiara', 'Tiaras'], ['sparkle', 'Sparkles'], ['unicorn', 'Unicorn'], ['rooms', 'Rooms'], ['stories', 'Stories'], ['treasures', 'Treasures']];
  const TAB_KINDS = { gown: ['gown'], tiara: ['tiara'], sparkle: ['wand', 'shoes', 'cape', 'necklace'], unicorn: ['mane', 'saddle', 'horn'] };
  let tab = 'gown', asking = null, room = 'library';   // (the bedroom has its own screen now: openBedroom)
  const roomOf = (p, r) => Object.assign({}, RM.STARTER[r], ((p.rooms || {})[r]) || {});
  // the dressing room (and the library's and ballroom's rooms, the stories, the treasures): t the tab to open
  function openWardrobe(t, r) {
    V.stop(); show('castle'); $('castleBack').innerHTML = ICON.back;
    tab = t || 'gown'; asking = null; if (r) room = r;
    paintCastle();
    V.say([tab === 'rooms' ? `Decorate your ${RM.ROOMS[room].name.toLowerCase()}! Tap something to put it in.` : tab === 'stories' ? 'Tap a chapter to hear it again.'
      : `Try something on, ${me.name}, or buy something new in the boutique.`], { who: 'narrator' });
  }
  function paintCastle() {
    const w = wearing(me);
    $('castleCoins').innerHTML = A.coin(34) + `<span>${E.coins(me)}</span>`;
    $('castleRank').innerHTML = rankChip(me);
    $('dress').classList.toggle('inroom', tab === 'rooms');
    $('dress').innerHTML = tab === 'rooms' ? `<div class="roomview">${RM.draw(room, roomOf(me, room), { label: 'Your ' + RM.ROOMS[room].name.toLowerCase() })}<span class="pr">${A.princess(me.look, w, { mood: 'happy' })}</span></div>`
      : `<span class="pr">${A.princess(me.look, w, { mood: 'happy' })}</span><span class="un">${A.unicorn(stageOf(me), w, { mood: 'calm' })}</span>`;
    $('shelfTabs').innerHTML = TABS.map(([id, name]) => `<button type="button" data-tab="${id}" aria-pressed="${id === tab}">${name}</button>`).join('');
    if (tab === 'rooms') {
      const on = roomOf(me, room);
      $('items').innerHTML = `<div class="roompick" role="group" aria-label="Which room">${Object.entries(RM.ROOMS).filter(([id]) => id !== 'bedroom').map(([id, r]) => `<button type="button" data-room="${id}" aria-pressed="${id === room}">${esc(r.name)}</button>`).join('')}</div>`
        + Object.entries(RM.ROOMS[room].slots).map(([, ids]) => ids.map(id => { const it = RM.ITEMS[id], own = owns(me, id), placed = on[it.slot] === id;
          return `<button type="button" class="item r ${placed ? 'on' : ''} ${own ? '' : 'locked'} ${asking === id ? 'ask' : ''}" data-piece="${id}" aria-label="${esc(it.name)}${own ? (placed ? ', in your room' : '') : it.gift ? ', a present from the story' : ', ' + it.price + ' coins'}">
            <span class="pv">${RM.piece(id)}</span><span class="price">${own ? (placed ? '✓' : '') : it.gift ? A.icon('book', 24) : A.coin(24) + it.price}</span></button>`; }).join('')).join('');
      return;
    }
    if (tab === 'stories') {
      const seen = me.chapters || {}, total = Ch.LANDS.reduce((a, l) => a + (seen[l] || 0), 0);
      $('items').innerHTML = `<div class="stories"><span class="tt">Chapters heard: ${total} of ${Ch.LANDS.length * 10}</span>${Ch.LANDS.map(l => `<div><span class="tt">${esc(cap(Ch.LAND[l]))}: ${seen[l] || 0} of 10</span>
        <div class="chrow">${Ch.CHAPTERS[l].map(c => { const on = c.n <= (seen[l] || 0);
          return `<button type="button" class="${on ? '' : 'no'}" style="background:${STORY_COLOUR[l]}" ${on ? `data-chapter="${l}:${c.n}" aria-label="${esc(c.title)}"` : `disabled aria-label="Chapter ${c.n}, not yet"`}>${c.n}</button>`; }).join('')}</div></div>`).join('')}</div>`;
      return;
    }
    if (tab === 'treasures') {
      const found = new Set(me.world.stars || []), met = new Set(me.world.critters || []);
      $('items').innerHTML = `<div class="treasures" style="grid-column:1/-1">
        <div class="trow"><span class="tt">Stars found: ${found.size} of ${W.STARS.length}</span>${W.STARS.map(s => `<span class="tk ${found.has(s.id) ? '' : 'no'}">${A.svg('0 0 40 40', A.star(20, 20, 16, '#FFC94A', 'stroke="#4B2E6F" stroke-width="2.5" stroke-linejoin="round"'))}</span>`).join('')}</div>
        <div class="trow"><span class="tt">Friends found: ${met.size} of ${W.CRITTERS.length}</span>${W.CRITTERS.map(c => `<span class="tk crit ${met.has(c.id) ? '' : 'no'}" aria-label="${esc(met.has(c.id) ? c.name : 'not found yet')}">${A.svg(`${c.x - 30} ${c.y - 50} 60 60`, W.critter(c.id, c.x, c.y))}</span>`).join('')}</div>
        <div class="trow"><span class="tt">Stickers: ${(me.stickers || []).length}</span>${(me.stickers || []).slice(-24).map(s => `<span class="tk">${A.icon({ read: 'book', math: 'gem', wand: 'star', spell: 'tiara' }[s.split(':')[0]] || 'flower', 34)}</span>`).join('') || '<span class="tt" style="font-weight:600">Play rounds to earn stickers!</span>'}</div></div>`;
      return;
    }
    const kinds = TAB_KINDS[tab], list = Object.entries(A.ITEMS).filter(([, it]) => kinds.includes(it.kind)).sort((a, b) => (a[1].gift ? 999 : a[1].price) - (b[1].gift ? 999 : b[1].price));
    $('items').innerHTML = list.map(([id, it]) => { const own = owns(me, id), on = w[it.kind] === id, u = A.SLOTS[it.kind] === 'unicorn';
      return `<button type="button" class="item ${u ? 'u' : ''} ${on ? 'on' : ''} ${own ? '' : 'locked'} ${asking === id ? 'ask' : ''}" data-item="${id}" aria-label="${esc(it.name)}${own ? (on ? ', wearing' : '') : it.gift ? ', a present from the story' : ', ' + it.price + ' coins'}">
        <span class="pv">${A.itemCard(id, me.look)}</span><span class="price">${own ? (on ? '✓' : '') : it.gift ? A.icon('book', 24) : A.coin(24) + it.price}</span></button>`; }).join('');
  }
  const STORY_COLOUR = { read: '#BFE3FF', math: '#C9F7DF', wand: '#FFE9A8', garden: '#FFD3E6', spell: '#E3D6FF' };
  $('shelfTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; asking = null; V.sfx('pop'); paintCastle(); });
  $('items').addEventListener('click', e => {
    const rb = e.target.closest('[data-room]');
    if (rb) { room = rb.dataset.room; asking = null; V.sfx('pop'); paintCastle(); return; }
    const pc = e.target.closest('[data-piece]');
    if (pc) return pickPiece(pc);
    const c = e.target.closest('[data-chapter]');
    if (c) { const [l, n] = c.dataset.chapter.split(':'); V.stop(); V.sfx('whoosh'); return tell(Ch.CHAPTERS[l][n - 1], null); }
    const b = e.target.closest('[data-item]'); if (!b) return;
    const id = b.dataset.item, it = A.ITEMS[id];
    if (it.gift && !owns(me, id)) { const ch = giftChapter(id); V.sfx('pop'); V.say([`The ${it.name.toLowerCase()} is a present in the story of ${ch ? Ch.LAND[ch.land] : 'the kingdom'}. Keep playing there to find it!`]); return; }
    if (owns(me, id)) {
      me.wearing = me.wearing || {};
      const optional = !['gown', 'tiara', 'shoes', 'mane', 'horn'].includes(it.kind);
      if (wearing(me)[it.kind] === id && optional) delete me.wearing[it.kind]; else me.wearing[it.kind] = id;
      V.sfx('sparkle'); persist(); asking = null; paintCastle(); return;
    }
    if (asking !== id) { asking = id; V.sfx('pop'); paintCastle(); V.say([`The ${it.name.toLowerCase()} costs ${it.price} coins. Tap it again to buy it!`]); return; }
    if (!E.spend(me, device, it.price)) { const need = it.price - E.coins(me); V.sfx('again'); V.say([`You need ${need} more coins. Play a round to earn them!`]); return; }
    me.owned.push(id); me.wearing = me.wearing || {}; me.wearing[it.kind] = id; asking = null;
    V.sfx('fanfare'); burst(...centerOf(b), 16); V.say([`You bought the ${it.name.toLowerCase()}! It looks wonderful.`]);
    persist(true); paintCastle();
  });
  // a piece for a room: hers goes in the room; a story present says where to find it; else ask the price, then buy
  function pickPiece(b) {
    const id = b.dataset.piece, it = RM.ITEMS[id];
    const put = () => { me.rooms = me.rooms || {}; const r = me.rooms[it.room] = me.rooms[it.room] || {}; r[it.slot] = id; };
    if (owns(me, id)) { put(); V.sfx('sparkle'); persist(); asking = null; paintCastle(); return; }
    if (it.gift) { const ch = giftChapter(id); V.sfx('pop'); V.say([`The ${it.name.toLowerCase()} is a present in the story of ${ch ? Ch.LAND[ch.land] : 'the kingdom'}. Keep playing there to find it!`]); return; }
    if (asking !== id) { asking = id; V.sfx('pop'); paintCastle(); V.say([`The ${it.name.toLowerCase()} costs ${it.price} coins. Tap it again to buy it!`]); return; }
    if (!E.spend(me, device, it.price)) { V.sfx('again'); V.say([`You need ${it.price - E.coins(me)} more coins. Play a round to earn them!`]); return; }
    me.owned.push(id); put(); asking = null;
    V.sfx('fanfare'); burst(...centerOf(b), 16); V.say([`You bought the ${it.name.toLowerCase()}! Your ${RM.ROOMS[it.room].name.toLowerCase()} looks wonderful.`]);
    persist(true); paintCastle();
  }
  $('castleBack').addEventListener('click', () => { V.stop(); openCastle(); });

  // ---- her castle, cut away like a dollhouse: tap a room to go in ----
  const ROOM_NAME = { bedroom: 'Your bedroom', stable: 'The stables', kitchen: 'The kitchen: the Unicorn Bakery', wardrobe: 'The dressing room', library: 'The library', ballroom: 'The ballroom' };
  const WANT_SAY = { food: 'Your unicorn is hungry! Visit the stables.', clean: 'Your unicorn is all muddy! Visit the stables for a bath.', fun: 'Your unicorn wants to play! Visit the stables.', rest: 'Your unicorn is very sleepy. Visit the stables.' };
  const petNow = () => { me.pet = me.pet || Care.fresh(); return Care.tick(me.pet); };
  function openCastle() {
    V.stop(); show('home'); $('homeBack').innerHTML = ICON.back;
    $('homeCoins').innerHTML = A.coin(34) + `<span>${E.coins(me)}</span>`; $('homeRank').innerHTML = rankChip(me);
    const w = Care.want(petNow()); persist();
    $('cutaway').innerHTML = ST ? ST.castle({}) : '';
    for (const g of $('cutaway').querySelectorAll('[data-go]')) {
      g.setAttribute('role', 'button'); g.setAttribute('tabindex', '0'); g.setAttribute('aria-label', ROOM_NAME[g.dataset.go] || g.dataset.go);
      g.classList.toggle('want', g.dataset.go === 'stable' && !!w);
    }
    V.say([`Welcome home, ${me.name}! Tap a room to go in.`, ...(w ? [WANT_SAY[w]] : [])], { who: 'narrator' });
  }
  function goRoom(id) {
    V.sfx('pop');
    if (id === 'bedroom') return openBedroom();
    if (id === 'stable') return openStable();
    if (id === 'kitchen') { if ((set().off || []).includes('castle')) { V.say(['The kitchen is resting today.'], { who: 'narrator' }); return; } return startRound('bake'); }
    if (id === 'wardrobe') return openWardrobe('gown');
    if (id === 'library' || id === 'ballroom') return openWardrobe('rooms', id);
  }
  $('cutaway').addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) goRoom(g.dataset.go); });
  $('cutaway').addEventListener('keydown', e => { const g = e.target.closest('[data-go]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); goRoom(g.dataset.go); } });
  $('homeBack').addEventListener('click', () => { V.stop(); enterWorld(); });

  // ---- the stables: feed, wash, brush, play, bed (care.js keeps the needs) ----
  const FOOD_NAME = { oats: 'Oats', apple: 'Apple', carrot: 'Carrot', clover: 'Clover', sugar: 'Sugar cubes', cupcake: 'Cupcake', cookie: 'Star cookie', pie: 'Berry pie', muffin: 'Muffin',
    donut: 'Donut', cake: 'Little cake', carrotcake: 'Carrot cake', tart: 'Lemon tart', ball: 'Ball', bubbles: 'Bubble wand', ribbon: 'Ribbon wand', kite: 'Kite' };
  const CARE_TABS = [['food', 'Food', 'food'], ['wash', 'Wash', 'clean'], ['play', 'Play', 'fun'], ['sleep', 'Sleep', 'rest'], ['shop', 'Shop', null]];
  const WANT_TIP = { food: 'Your unicorn is hungry. Tap Food!', clean: 'Your unicorn is muddy. Tap Wash!', fun: 'Your unicorn wants to play. Tap Play!', rest: 'Your unicorn is sleepy. Tap Sleep!' };
  let careTab = 'food', tool = null, fx = { foam: 0, shine: false, eat: false }, stableT = 0, careAsk = null, patAt = 0;
  const thing = id => Care.FOODS[id] && Care.FOODS[id].treat && K ? K.treat(id) : ST ? ST.prop(id, {}) : esc(id);
  function stableStop() { clearInterval(stableT); stableT = 0; tool = null; }
  function openStable() {
    V.stop(); show('stable'); $('stableBack').innerHTML = ICON.back; careTab = 'food'; careAsk = null; fx = { foam: 0, shine: false, eat: false };
    const pet = petNow(); persist();
    paintStable();
    const m = Care.mood(pet), w = Care.want(pet);
    V.say([m === 'sleep' ? 'Shh... your unicorn is fast asleep.' : m === 'sad' ? `Oh no, your unicorn is sad. ${WANT_TIP[w]}` : m === 'happy' ? 'Your unicorn is so happy to see you!' : WANT_TIP[w]], { who: 'narrator' });
    // asleep while she watches: rest fills a little each second, and her unicorn wakes when it's full
    stableT = setInterval(() => { const p = petNow(); if (screen !== 'stable') return stableStop();
      if (p.asleep) { p.rest = Math.min(100, p.rest + 1); if (p.rest >= 100) { Care.wake(p); paintStable(); V.sfx('sparkle'); V.say(['Your unicorn is all rested! Good morning!'], { who: 'narrator' }); } else paintNeeds(); persist(); } }, 1000);
  }
  function uniSvg(pet) { return A.unicorn(stageOf(me), wearing(me), { mood: fx.eat ? 'eat' : Care.mood(pet) === 'calm' ? 'calm' : Care.mood(pet), dirt: Care.dirt(pet), foam: fx.foam, shine: fx.shine }); }
  function paintStable() {
    const pet = petNow(), w = Care.want(pet);
    $('stableCoins').innerHTML = A.coin(34) + `<span>${E.coins(me)}</span>`;
    $('stall').innerHTML = (ST ? ST.scene({ night: pet.asleep, lantern: pet.asleep }) : '')
      + `<div class="uni" id="uni" role="button" aria-label="Your unicorn">${uniSvg(pet)}</div><div class="fx" id="stallFx">${pet.asleep ? '<span class="zz" style="left:60%;top:30%">z</span><span class="zz" style="left:66%;top:22%;animation-delay:.8s">z</span>' : ''}</div>`
      + (w && !pet.asleep && ST ? `<span class="want" aria-hidden="true">${ST.need(w, 42)}</span>` : '');
    paintNeeds();
    $('careTabs').innerHTML = CARE_TABS.map(([id, name, need]) => `<button type="button" data-ct="${id}" aria-pressed="${id === careTab}">${need && ST ? ST.need(need, 22) : A.coin(22)} ${name}</button>`).join('');
    paintTray();
  }
  function paintNeeds() {
    const pet = me.pet;
    $('needs').innerHTML = Care.NEEDS.map(k => { const v = Math.round(pet[k]);
      return `<div class="need ${v < Care.TUNE.sad ? 'low' : v < Care.TUNE.calm ? 'mid' : ''}" aria-label="${{ food: 'Food', clean: 'Clean', fun: 'Fun', rest: 'Rest' }[k]}: ${v} of 100">${ST ? ST.need(k, 36) : ''}<span class="bar"><i style="width:${v}%"></i></span></div>`; }).join('');
  }
  function paintUni() { const u = $('uni'); if (u) u.innerHTML = uniSvg(me.pet); paintNeeds(); }
  function paintTray() {
    const pet = me.pet, btn = (id, extra = '', label = FOOD_NAME[id] || id, cls = '') => `<button type="button" class="ctool ${cls}" data-care="${id}" aria-label="${esc(label)}" ${extra}>${thing(id)}</button>`;
    let html = '';
    if (careTab === 'food') html = ['oats', 'apple'].map(id => btn(id)).join('') + Object.keys(Care.FOODS).filter(id => !Care.FOODS[id].free && pet.pantry[id] > 0)
      .map(id => btn(id, '', `${FOOD_NAME[id]}, ${pet.pantry[id]} left`).replace('</button>', `<span class="n">${pet.pantry[id]}</span></button>`)).join('')
      + (Object.keys(pet.pantry).length ? '' : `<span class="tt" style="grid-column:1/-1;font-weight:800">Bake treats in the kitchen, or buy some in the shop!</span>`);
    if (careTab === 'wash') html = ['sponge', 'brush'].map(id => btn(id, `aria-pressed="${tool === id}"`, { sponge: 'Sponge: rub your unicorn', brush: 'Brush: brush the mane' }[id])).join('') + btn('bucket', '', 'Rinse with water') + btn('towel', '', 'Dry with the towel');
    if (careTab === 'play') html = (pet.toys || ['ball']).map(id => btn(id)).join('');
    if (careTab === 'sleep') html = `<button type="button" class="ctool" data-care="lantern" aria-label="${pet.asleep ? 'Wake up' : 'Go to sleep'}">${ST ? ST.prop('lantern', { on: !pet.asleep }) : ''}</button>`;
    if (careTab === 'shop') html = Object.entries(Care.SHOP).map(([id, price]) => { const toy = !!Care.TOYS[id], have = toy && (pet.toys || []).includes(id);
      return `<button type="button" class="ctool ${have ? 'empty' : ''} ${careAsk === id ? 'ask' : ''}" data-buy="${id}" aria-label="${esc(FOOD_NAME[id])}${have ? ', yours' : ', ' + price + ' coins'}">${thing(id)}<span class="price">${have ? '✓' : A.coin(20) + price}</span></button>`; }).join('');
    $('careTray').innerHTML = html;
  }
  $('careTabs').addEventListener('click', e => { const b = e.target.closest('[data-ct]'); if (!b) return; careTab = b.dataset.ct; tool = null; careAsk = null; V.sfx('pop'); paintStable(); });
  const uniBox = () => $('uni').getBoundingClientRect();
  const spot = (fx_, html, x, y, ms) => { const f = document.createElement('span'); f.innerHTML = html; f.style.left = x + 'px'; f.style.top = y + 'px'; Object.assign(f, fx_); $('stallFx').appendChild(f); if (ms) setTimeout(() => f.remove(), ms); return f; };
  const stallXY = (cx, cy) => { const r = $('stall').getBoundingClientRect(); return [cx - r.left, cy - r.top]; };
  function hearts(n = 3) { const r = uniBox(); for (let i = 0; i < n; i++) { const [x, y] = stallXY(r.left + r.width * (0.3 + Math.random() * 0.5), r.top + r.height * 0.3); spot({ className: 'heart' }, A.svg('0 0 30 30', A.heart ? A.heart(15, 15, 11) : A.star(15, 15, 12)), x, y, 1300); } }
  function tired(pet) { if (pet.rest < 12) { V.say(['Your unicorn is too sleepy to play. Time for bed!'], { who: 'narrator' }); return true; }
    if (pet.food < 10) { V.say(['Your unicorn is too hungry to play. Feed your unicorn first!'], { who: 'narrator' }); return true; } return false; }
  $('careTray').addEventListener('click', async e => {
    const pet = petNow(), bb = e.target.closest('[data-buy]');
    if (bb) {
      const id = bb.dataset.buy, price = Care.SHOP[id];
      if (Care.TOYS[id] && (pet.toys || []).includes(id)) { V.say([`You have the ${FOOD_NAME[id].toLowerCase()}. Find it under Play!`]); return; }
      if (careAsk !== id) { careAsk = id; V.sfx('pop'); paintTray(); V.say([`The ${FOOD_NAME[id].toLowerCase()} costs ${price} ${price === 1 ? 'coin' : 'coins'}. Tap it again to buy it!`]); return; }
      if (!E.spend(me, device, price)) { V.sfx('again'); V.say([`You need ${price - E.coins(me)} more coins. Play a round to earn them!`]); return; }
      Care.buy(pet, id); careAsk = null; V.sfx('fanfare'); burst(...centerOf(bb), 12); persist(true); paintStable();
      V.say([`You bought ${Care.TOYS[id] ? 'the ' + FOOD_NAME[id].toLowerCase() + '! Find it under Play.' : 'a treat! Find it under Food.'}`]); return;
    }
    const b = e.target.closest('[data-care]'); if (!b) return;
    const id = b.dataset.care;
    if (id === 'lantern') { if (pet.asleep) { Care.wake(pet); V.sfx('sparkle'); V.say(['Good morning, unicorn!'], { who: 'narrator' }); } else { Care.sleep(pet); V.sfx('whoosh'); V.say(['Goodnight, unicorn. Sweet dreams!'], { who: 'narrator' }); }
      persist(); paintStable(); return; }
    if (pet.asleep) { V.say(['Shh... your unicorn is sleeping. Wake your unicorn up under Sleep.'], { who: 'narrator' }); return; }
    if (careTab === 'food') {
      if (pet.food >= 96) { const u = $('uni'); u.classList.remove('shake'); void u.offsetWidth; u.classList.add('shake'); V.sfx('again'); V.say(["Your unicorn is full! Maybe later."], { who: 'narrator' }); return; }
      if (!Care.feed(pet, id)) return;
      // the food flies to her mouth, then munch munch
      const [x0, y0] = stallXY(...centerOf(b)), r = uniBox(), [x1, y1] = stallXY(r.left + r.width * MOUTH[0], r.top + r.height * MOUTH[1]);
      const f = spot({ className: 'fly' }, thing(id), x0 - 35, y0 - 35); requestAnimationFrame(() => { f.style.transform = `translate(${x1 - x0}px,${y1 - y0}px) scale(.5)`; f.style.opacity = '0'; });
      setTimeout(() => f.remove(), 800);
      await wait(550); fx.eat = true; paintUni(); const u = $('uni'); u.classList.add('chew'); V.sfx('pop'); setTimeout(() => V.sfx('pop'), 300); setTimeout(() => V.sfx('pop'), 600);
      await wait(1300); fx.eat = false; u.classList.remove('chew'); hearts(Care.FOODS[id].treat ? 4 : 2); persist(); paintStable();
      if (Care.FOODS[id].treat) V.say(['Yum! Your unicorn loves it!'], { who: 'narrator' });
      return;
    }
    if (careTab === 'wash') {
      if (id === 'sponge' || id === 'brush') { tool = tool === id ? null : id; V.sfx('pop'); paintTray(); if (tool) V.say([id === 'sponge' ? 'Rub your unicorn with the sponge!' : 'Brush the mane!'], { who: 'narrator' }); return; }
      if (id === 'bucket') { if (fx.foam <= 0) { V.say(['Scrub with the sponge first!'], { who: 'narrator' }); return; }
        fx.foam = 0; fx.shine = true; Care.wash(pet, 10); V.sfx('whoosh'); V.sfx('sparkle'); hearts(3); persist(); paintStable(); V.say(['Splash! Sparkly clean!'], { who: 'narrator' }); setTimeout(() => { fx.shine = false; if (screen === 'stable') paintUni(); }, 3000); return; }
      if (id === 'towel') { if (fx.foam > 0) { V.say(['Rinse the bubbles off with the bucket first!'], { who: 'narrator' }); return; } fx.shine = true; V.sfx('sparkle'); paintUni(); setTimeout(() => { fx.shine = false; if (screen === 'stable') paintUni(); }, 2500); return; }
    }
    if (careTab === 'play') {
      if (tired(pet)) return;
      if (!Care.play(pet, id)) return;
      const u = $('uni'), r = $('stall').getBoundingClientRect();
      if (id === 'ball') { spot({ className: 'ball' }, thing('ball'), r.width * 0.2, r.height * 0.62, 1300); u.classList.remove('hop'); void u.offsetWidth; u.classList.add('hop'); V.sfx('pop'); V.say(['Wheee!'], { who: 'narrator' }); }
      if (id === 'bubbles') { for (let k = 0; k < 7; k++) setTimeout(() => { if (screen !== 'stable') return; const bub = spot({ className: 'bub' }, ST ? ST.bubble(46) : '', r.width * (0.1 + Math.random() * 0.8), r.height * 0.85, 4100); bub.dataset.pop = '1'; }, k * 300); V.say(['Pop the bubbles!'], { who: 'narrator' }); }
      if (id === 'ribbon') { u.classList.remove('dance'); void u.offsetWidth; u.classList.add('dance'); V.sfx('sparkle'); V.say(['Your unicorn is dancing!'], { who: 'narrator' }); }
      if (id === 'kite') { spot({ className: 'kite' }, thing('kite'), 0, r.height * 0.15, 2600); u.classList.remove('hop'); void u.offsetWidth; u.classList.add('hop'); V.sfx('whoosh'); V.say(['Look at the kite fly!'], { who: 'narrator' }); }
      setTimeout(() => u.classList.remove('hop', 'dance'), 1300);
      hearts(2); persist(); paintNeeds();
    }
  });
  // where her mouth is in the unicorn's picture (a share of its width and height), for food to fly to
  const MOUTH = [0.8, 0.42];
  // the sponge and the brush: rub across her (a tap scrubs a little too); a tap with nothing in hand is a pat
  let rub = null;
  $('stall').addEventListener('pointerdown', e => {
    const bub = e.target.closest('[data-pop]');
    if (bub) { bub.remove(); V.sfx('pop'); Care.pat(me.pet); paintNeeds(); persist(); return; }
    if (!e.target.closest('#uni')) return;
    const pet = petNow();
    if (pet.asleep) { V.say(['Shh... your unicorn is sleeping.'], { who: 'narrator' }); return; }
    if (!tool) { if (Date.now() - patAt > 900) { patAt = Date.now(); Care.pat(pet); hearts(2); V.sfx('sparkle'); paintNeeds(); persist(); } return; }
    rub = { x: e.clientX, y: e.clientY, d: 0, at: 0 };
    try { e.target.closest('#uni').setPointerCapture(e.pointerId); } catch {}
    scrub(e, 14);
  });
  $('stall').addEventListener('pointermove', e => { if (!rub) return; const d = Math.hypot(e.clientX - rub.x, e.clientY - rub.y); rub.x = e.clientX; rub.y = e.clientY; rub.d += d; if (rub.d > 14) { scrub(e, rub.d); rub.d = 0; } });
  for (const ev of ['pointerup', 'pointercancel']) $('stall').addEventListener(ev, () => { if (!rub) return; rub = null; const t = $('stallTool'); if (t) t.remove(); persist(); paintStable(); });
  function scrub(e, d) {
    const pet = me.pet, [x, y] = stallXY(e.clientX, e.clientY);
    let t = $('stallTool'); if (!t) { t = spot({ className: 'tool', id: 'stallTool' }, thing(tool), x, y); }
    t.style.left = x + 'px'; t.style.top = y + 'px';
    const k = Math.min(3, d / 14);
    if (tool === 'sponge') { const was = pet.clean; Care.wash(pet, 1.6 * k); fx.foam = Math.min(1, fx.foam + 0.035 * k); if (Math.random() < 0.15) V.sfx('pop');
      if (was < 100 && pet.clean >= 100) V.say(['All clean! Now rinse the bubbles off with the bucket.'], { who: 'narrator' }); }
    else { Care.brush(pet); if (Math.random() < 0.3) spot({ className: 'heart' }, A.svg('0 0 30 30', A.star(15, 15, 11, '#FFC94A')), x, y - 10, 1200); if (Math.random() < 0.15) V.sfx('sparkle'); }
    const now = Date.now(); if (now - (rub ? rub.at : 0) > 140) { if (rub) rub.at = now; paintUni(); }
  }
  $('stableBack').addEventListener('click', () => { V.stop(); persist(true); openCastle(); });

  // ---- her bedroom: tap things to play with them; Decorate to drag them anywhere, buy more, change the walls ----
  const ICON2 = {
    brush: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M27 6l7 7L19 28l-7-7z"/><path d="M12 21c-5 0-6 4-6 7s-1 5-2 6c5 0 13 0 14-7"/></svg>',
    done: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21l7 7l15-16"/></svg>',
    flip: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6v28"/><path d="M15 12L6 28h9zM25 12l9 16h-9z"/></svg>',
    away: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15h26v18H7z"/><path d="M5 9h30v6H5zM16 21h8"/></svg>',
  };
  const BED_TABS = [['mine', 'My things'], ['shop', 'Shop'], ['walls', 'Walls'], ['floors', 'Floors']];
  const BED_MAX = 30;
  let editing = false, bedTab = 'mine', bedAsk = null, sel = -1, bdrag = null;
  const bfx = { night: false, on: {}, px: 60, py: 288, flip: false };
  const bedDef = id => BR.ITEMS[id] || BR.WALLS[id] || BR.FLOORS[id];
  const bedOwns = id => (me.owned || []).includes(id) || (!!bedDef(id) && !bedDef(id).gift && !bedDef(id).price);
  // her bedroom, from the starter (or the pieces she had in the old fixed spots)
  function bedState() {
    if (me.bedroom && me.bedroom.items) return me.bedroom;
    const b = JSON.parse(JSON.stringify(BR.STARTER)), old = (me.rooms || {}).bedroom || {};
    if (old.wall && BR.WALLS[old.wall]) b.wall = old.wall;
    const swap = (slot, test) => { const id = old[slot]; if (!id || !BR.ITEMS[id]) return; const it = b.items.find(x => test(x.id)); if (it) it.id = id; else b.items.push({ id, x: 300, y: 280 }); };
    swap('big', id => id.startsWith('bedroom-bed')); swap('rug', id => id.startsWith('bedroom-rug')); swap('small', id => id === 'bedroom-lamp');
    return (me.bedroom = b);
  }
  function openBedroom() {
    V.stop(); show('bedroom'); editing = false; sel = -1; bedAsk = null; bfx.night = false; bfx.on = {};
    $('bedBack').innerHTML = ICON.back; paintBedroom();
    V.say([`Welcome to your bedroom, ${me.name}! Tap things to play with them. Tap the paintbrush to decorate.`], { who: 'narrator' });
  }
  const pct = (v, of) => (v / of * 100).toFixed(2) + '%';
  function boxOf(it) {
    const d = BR.ITEMS[it.id], top = d.place === 'wall' ? it.y - d.h / 2 : it.y - d.h;
    return { left: pct(it.x - d.w / 2, 400), top: pct(top, 300), width: pct(d.w, 400), height: pct(d.h, 300), z: d.place === 'rug' ? 2 : d.place === 'wall' ? 3 : 10 + Math.round(it.y) };
  }
  const lit = (it, i) => !!(it.on || bfx.on[i]);
  function itemHtml(it, i) {
    const d = BR.ITEMS[it.id], b = boxOf(it), sleeping = bfx.night && d.act === 'sleep' && i === bfx.bed;
    const art = BR.item(it.id, { on: sleeping || lit(it, i), sleeper: sleeping ? A.princess(me.look, wearing(me), { head: true, mood: 'calm' }) : undefined });
    const glow = d.act === 'light' && lit(it, i) ? `<span class="glow" style="left:${pct(it.x - d.w * 1.4, 400)};top:${pct((d.place === 'wall' ? it.y : it.y - d.h) - d.w * 1.2, 300)};width:${pct(d.w * 2.8, 400)};height:${pct(d.w * 2.8 * 4 / 3, 300)}"></span>` : '';
    return `<div class="bi ${it.flip ? 'flip' : ''} ${i === sel ? 'sel' : ''}" data-i="${i}" role="button" aria-label="${esc(d.name)}" style="left:${b.left};top:${b.top};width:${b.width};height:${b.height};z-index:${b.z}">${art}</div>${glow}`;
  }
  function paintBedroom() {
    const b = bedState(), box = $('broomIn');
    $('bedroom').classList.toggle('edit', editing);
    $('bedCoins').innerHTML = A.coin(34) + `<span>${E.coins(me)}</span>`;
    $('bedEdit').innerHTML = editing ? ICON2.done : ICON2.brush; $('bedEdit').setAttribute('aria-pressed', String(editing)); $('bedEdit').setAttribute('aria-label', editing ? 'Done decorating' : 'Decorate');
    const stars = b.items.some((it, i) => BR.ITEMS[it.id].act === 'stars' && lit(it, i));
    box.classList.toggle('dark', bfx.night); box.classList.toggle('stars', stars);
    const pr = bfx.night ? '' : `<div class="bpr ${bfx.flip ? 'flip' : ''}" id="bpr" role="button" aria-label="${esc(me.name)}" style="left:${pct(bfx.px, 400)};top:${pct(bfx.py - 112, 300)};height:37.3%;z-index:${10 + Math.round(bfx.py)}">${A.princess(me.look, wearing(me), { mood: 'happy' })}</div>`;
    box.innerHTML = BR.room(b.wall, b.floor, {}).replace('<svg', '<svg class="wallfloor"') + '<div class="starsky"></div>' + b.items.map(itemHtml).join('') + pr + '<div class="night" style="z-index:400"></div>'
      + (bfx.night && bfx.bed >= 0 && b.items[bfx.bed] ? (() => { const it = b.items[bfx.bed], d = BR.ITEMS[it.id], pl = d.pillow || { x: d.w * 0.25, y: d.h * 0.4 };
        return `<span class="zz" style="z-index:401;left:${pct(it.x - d.w / 2 + pl.x + 10, 400)};top:${pct(it.y - d.h + pl.y - 30, 300)}">z</span><span class="zz" style="z-index:401;animation-delay:.9s;left:${pct(it.x - d.w / 2 + pl.x + 26, 400)};top:${pct(it.y - d.h + pl.y - 44, 300)}">z</span>`; })() : '')
      + (editing && sel >= 0 && b.items[sel] ? selBar(b.items[sel]) : '');
    $('bedbar').innerHTML = editing ? '' : `<span class="tip">${bfx.night ? 'Tap anywhere to wake up!' : 'Tap things in your room!'}</span><button type="button" class="big mint" id="bedDeco">${ICON2.brush}<span>Decorate</span></button>`;
    if ($('bedDeco')) $('bedDeco').onclick = () => setEditing(true);
    $('bshelf').hidden = !editing;
    if (editing) paintBedShelf();
  }
  function selBar(it) {
    const d = BR.ITEMS[it.id], top = d.place === 'wall' ? it.y - d.h / 2 : it.y - d.h;
    return `<div class="selbar" style="left:${pct(Math.max(50, Math.min(350, it.x)), 400)};top:${pct(Math.max(56, top), 300)}"><button type="button" data-sb="flip" aria-label="Turn it around">${ICON2.flip}</button><button type="button" data-sb="away" aria-label="Put it away">${ICON2.away}</button></div>`;
  }
  function paintBedShelf() {
    const b = bedState(), placed = new Set(b.items.map(x => x.id));
    $('bedTabs').innerHTML = BED_TABS.map(([id, name]) => `<button type="button" data-bt="${id}" aria-pressed="${id === bedTab}">${name}</button>`).join('');
    const card = (id, what) => { const d = bedDef(id), own = bedOwns(id), on = what === 'wall' ? b.wall === id : what === 'floor' ? b.floor === id : placed.has(id);
      return `<button type="button" class="item ${on ? 'on' : ''} ${own ? '' : 'locked'} ${bedAsk === id ? 'ask' : ''}" data-bed="${id}" data-what="${what}" aria-label="${esc(d.name)}${own ? (on ? ', in your room' : '') : d.gift ? ', a present from the story' : ', ' + d.price + ' coins'}">
        <span class="pv">${BR.piece(id)}</span><span class="price">${own ? (on ? '✓' : '') : d.gift ? A.icon('book', 22) : A.coin(22) + d.price}</span></button>`; };
    const byPrice = (a, z) => (bedDef(a).gift ? 999 : bedDef(a).price) - (bedDef(z).gift ? 999 : bedDef(z).price);
    let ids;
    if (bedTab === 'mine') { ids = Object.keys(BR.ITEMS).filter(id => bedOwns(id) && !placed.has(id));
      $('bedItems').innerHTML = ids.map(id => card(id, 'item')).join('') || `<span class="tt" style="grid-column:1/-1;font-weight:800;padding:8px">Everything you have is in your room! Find more in the Shop.</span>`; return; }
    if (bedTab === 'shop') ids = Object.keys(BR.ITEMS).filter(id => !bedOwns(id)).sort(byPrice);
    if (bedTab === 'walls') ids = Object.keys(BR.WALLS).sort(byPrice);
    if (bedTab === 'floors') ids = Object.keys(BR.FLOORS).sort(byPrice);
    $('bedItems').innerHTML = ids.map(id => card(id, bedTab === 'walls' ? 'wall' : bedTab === 'floors' ? 'floor' : 'item')).join('');
  }
  function setEditing(on) { editing = on; sel = -1; bedAsk = null; bfx.night = false; V.sfx('pop'); paintBedroom();
    V.say([on ? 'Drag things to move them. Tap My things or the Shop to add more!' : 'Your room looks wonderful!'], { who: 'narrator' }); persist(); }
  $('bedEdit').addEventListener('click', () => setEditing(!editing));
  $('bedBack').addEventListener('click', () => { V.stop(); persist(true); openCastle(); });
  $('bedTabs').addEventListener('click', e => { const b = e.target.closest('[data-bt]'); if (!b) return; bedTab = b.dataset.bt; bedAsk = null; V.sfx('pop'); paintBedShelf(); });
  // a new thing goes where it fits: on the wall, on the floor in front of the bed, or a rug in the middle
  function placeNew(id) {
    const d = BR.ITEMS[id], b = bedState();
    if (b.items.length >= BED_MAX) { V.say(['Your room is full! Put something away first.'], { who: 'narrator' }); return false; }
    const x = 200 + (Math.random() - 0.5) * 120, y = d.place === 'wall' ? Math.max(d.h / 2 + 4, BR.FLOOR_Y - d.h / 2 - 30) : d.place === 'rug' ? 278 : 292;
    b.items.push(clampItem({ id, x, y })); sel = b.items.length - 1; return true;
  }
  function clampItem(it) {
    const d = BR.ITEMS[it.id], F = BR.FLOOR_Y;
    it.x = Math.max(d.w / 2, Math.min(400 - d.w / 2, it.x));
    if (d.place === 'wall') it.y = Math.max(d.h / 2 + 2, Math.min(F - d.h / 2 - 2, it.y)); else it.y = Math.max(Math.min(F + 14, 300), Math.min(300, it.y));
    return it;
  }
  $('bedItems').addEventListener('click', e => {
    const c = e.target.closest('[data-bed]'); if (!c) return;
    const id = c.dataset.bed, what = c.dataset.what, d = bedDef(id), b = bedState();
    const use = () => { if (what === 'wall') b.wall = id; else if (what === 'floor') b.floor = id; else if (!placeNew(id)) return false; return true; };
    if (bedOwns(id)) { if (what === 'item' && b.items.some(x => x.id === id)) { sel = b.items.findIndex(x => x.id === id); paintBedroom(); return; } if (use()) { V.sfx('sparkle'); persist(); paintBedroom(); } return; }
    if (d.gift) { const ch = giftChapter(id); V.sfx('pop'); V.say([`The ${d.name.toLowerCase()} is a present in the story of ${ch ? Ch.LAND[ch.land] : 'the kingdom'}. Keep playing there to find it!`]); return; }
    if (bedAsk !== id) { bedAsk = id; V.sfx('pop'); paintBedShelf(); V.say([`The ${d.name.toLowerCase()} costs ${d.price} coins. Tap it again to buy it!`]); return; }
    if (!E.spend(me, device, d.price)) { V.sfx('again'); V.say([`You need ${d.price - E.coins(me)} more coins. Play a round to earn them!`]); return; }
    me.owned.push(id); bedAsk = null; use();
    V.sfx('fanfare'); burst(...centerOf(c), 16); V.say([`You bought the ${d.name.toLowerCase()}! ${what === 'item' ? 'Drag it where you like.' : 'Your room looks wonderful.'}`]);
    persist(true); paintBedroom();
  });
  // decorating: drag a thing to move it; the bar above it turns it around or puts it away
  $('broomIn').addEventListener('pointerdown', e => {
    if (!editing) return;
    const sb = e.target.closest('[data-sb]');
    if (sb) { const b = bedState(), it = b.items[sel]; if (!it) return;
      if (sb.dataset.sb === 'flip') it.flip = !it.flip; else { b.items.splice(sel, 1); sel = -1; V.say(['Put away! Find it in My things.'], { who: 'narrator' }); }
      V.sfx('pop'); persist(); paintBedroom(); return; }
    const el = e.target.closest('.bi');
    if (!el) { if (sel >= 0) { sel = -1; paintBedroom(); } return; }
    const i = +el.dataset.i, it = bedState().items[i], r = $('broomIn').getBoundingClientRect();
    if (sel !== i) { sel = i; paintBedroom(); }
    bdrag = { i, sx: e.clientX, sy: e.clientY, x0: it.x, y0: it.y, kx: 400 / r.width, ky: 300 / r.height };
    try { $('broomIn').setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });
  $('broomIn').addEventListener('pointermove', e => {
    if (!bdrag) return;
    const b = bedState(), it = b.items[bdrag.i];
    it.x = bdrag.x0 + (e.clientX - bdrag.sx) * bdrag.kx; it.y = bdrag.y0 + (e.clientY - bdrag.sy) * bdrag.ky; clampItem(it);
    const el = $('broomIn').querySelector(`.bi[data-i="${bdrag.i}"]`), bx = boxOf(it);
    if (el) { el.style.left = bx.left; el.style.top = bx.top; el.style.zIndex = bx.z; }
    const bar = $('broomIn').querySelector('.selbar'); if (bar) bar.remove();
  });
  for (const ev of ['pointerup', 'pointercancel']) $('broomIn').addEventListener(ev, () => { if (!bdrag) return; bdrag = null; persist(); paintBedroom(); });
  // playing: tap a thing and it does what it does; tap the floor and she walks there
  $('broomIn').addEventListener('click', e => {
    if (editing) return;
    if (bfx.night) return wakeUp();
    const el = e.target.closest('.bi');
    if (el) return bedAct(+el.dataset.i, el);
    if (e.target.closest('#bpr')) { const p = $('bpr'); p.classList.remove('twirl'); void p.offsetWidth; p.classList.add('twirl'); V.sfx('sparkle'); burst(e.clientX, e.clientY, 8); return; }
    const r = $('broomIn').getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 400, y = (e.clientY - r.top) / r.height * 300;
    if (y < BR.FLOOR_Y) return;
    bfx.flip = x < bfx.px; bfx.px = Math.max(30, Math.min(370, x)); bfx.py = Math.max(BR.FLOOR_Y + 30, Math.min(298, y));
    const p = $('bpr'); if (p) { p.classList.toggle('flip', bfx.flip); p.style.left = pct(bfx.px, 400); p.style.top = pct(bfx.py - 112, 300); p.style.zIndex = 10 + Math.round(bfx.py); }
  });
  const TUNE_BOX = [0, 2, 4, 5, 4, 2, 0, 4, 7];
  async function bedAct(i, el) {
    const b = bedState(), it = b.items[i], d = BR.ITEMS[it.id];
    const anim = cls => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 1900); };
    const toggle = () => { it.on = !it.on; persist(); paintBedroom(); };
    const blink = ms => { bfx.on[i] = true; paintBedroom(); setTimeout(() => { delete bfx.on[i]; if (screen === 'bedroom') paintBedroom(); }, ms); };
    const r = el.getBoundingClientRect();
    if (d.act === 'sleep') return goToSleep(i);
    if (d.act === 'light') { V.sfx('pop'); toggle(); return; }
    if (d.act === 'curtain') { V.sfx('whoosh'); toggle(); return; }
    if (d.act === 'grow') { V.sfx('sparkle'); burst(r.left + r.width / 2, r.top + r.height / 3, 8); toggle(); return; }
    if (d.act === 'stars') { V.sfx('sparkle'); toggle(); if (it.on) V.say(['Twinkle, twinkle!'], { who: 'narrator' }); return; }
    if (d.act === 'music') { blink(TUNE_BOX.length * 320 + 400); TUNE_BOX.forEach((n, k) => setTimeout(() => V.sfx('note', n), k * 320)); return; }
    if (d.act === 'chest') { blink(2600); V.sfx('pop'); burst(r.left + r.width / 2, r.top, 14); return; }
    if (d.act === 'swim') { blink(1500); V.sfx('pop'); return; }
    if (d.act === 'dress') { V.sfx('whoosh'); return openWardrobe('gown'); }
    if (d.act === 'books') { V.sfx('whoosh'); return openWardrobe('stories'); }
    if (d.act === 'squeak') { anim('hop'); V.sfx('pop'); setTimeout(() => V.sfx('pop'), 250); return; }
    if (d.act === 'rock') { anim('rock'); V.sfx('whoosh'); return; }
    anim('spark'); V.sfx('sparkle'); burst(r.left + r.width / 2, r.top + r.height / 2, 8);
  }
  function goToSleep(i) {
    bfx.night = true; bfx.bed = i; V.sfx('whoosh'); paintBedroom();
    TUNE_BOX.slice(0, 7).forEach((n, k) => setTimeout(() => { if (bfx.night && screen === 'bedroom') V.sfx('note', n); }, 600 + k * 520));
    V.say([`Goodnight, ${me.name}. Sweet dreams!`], { who: 'narrator' });
  }
  function wakeUp() { bfx.night = false; V.sfx('sparkle'); paintBedroom(); V.say([`Good morning, ${me.name}! What a lovely sleep.`], { who: 'narrator' }); }

  // ---- grown-ups: hold the button, then Face ID (or a grown-up question) ----
  let holdT = 0, holdStart = 0;
  const grownBtn = $('grownBtn');
  const holdEnd = () => { cancelAnimationFrame(holdT); grownBtn.querySelector('.fillbar').style.width = '0'; };
  grownBtn.addEventListener('pointerdown', e => {
    holdStart = performance.now();
    const tick = now => { const t = Math.min(1, (now - holdStart) / 2500); grownBtn.querySelector('.fillbar').style.width = t * 100 + '%';
      if (t >= 1) { holdEnd(); grownUp(() => parent()); } else holdT = requestAnimationFrame(tick); };
    holdT = requestAnimationFrame(tick);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) grownBtn.addEventListener(ev, holdEnd);
  grownBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); grownUp(() => parent()); } });

  async function grownUp(then) {
    const acct = window.AllisonOS && window.AllisonOS.account;
    if (acct && window.PublicKeyCredential) { try { await acct.signIn(); return then(); } catch {} }
    const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
    const s = sheet('For grown-ups', `<p class="note" style="margin-top:0">Face ID isn't available here, so a grown-up question instead.</p>
      <div class="group"><label class="row"><span class="grow">What is ${a} × ${b}?</span><input type="number" inputmode="numeric" id="gAns" aria-label="Answer"></label></div>
      <button type="button" class="cta" id="gOk">OK</button>`);
    const go = () => { if (+s.querySelector('#gAns').value === a * b) { s.close(); then(); } else { s.querySelector('#gAns').value = ''; s.querySelector('#gAns').placeholder = 'Try again'; } };
    s.querySelector('#gOk').onclick = go;
    s.querySelector('#gAns').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    setTimeout(() => s.querySelector('#gAns').focus(), 200);
  }

  // a sheet: role=dialog with its way out (Done) in its head
  function sheet(title, html, opt = {}) {
    const el = document.createElement('div');
    el.className = 'sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title);
    el.innerHTML = `<div class="panel"><div class="shead">${opt.back ? `<button type="button" class="sbtn" data-x="back" aria-label="Back">‹ Back</button>` : ''}<h2>${esc(title)}</h2><button type="button" class="sbtn" data-x="done" aria-label="Done">Done</button></div><div class="sbody">${html}</div></div>`;
    document.body.appendChild(el);
    el.close = () => { el.remove(); if (opt.onClose) opt.onClose(); };
    el.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (x) { if (x.dataset.x === 'back' && opt.back) { el.remove(); opt.back(); } else el.close(); } else if (e.target === el) el.close(); });
    return el;
  }

  // ---- a new player, or a player's look ----
  function creator(p) {
    const editing = !!p;
    const look = Object.assign({ skin: 's2', hair: 'brown', style: 'long' }, p ? p.look : {});
    let name = p ? p.name : '';
    const s = sheet(editing ? 'Edit ' + name : 'A new player', `<div class="preview" id="cPrev"></div>
      <div class="group"><label class="row"><span>Name</span><input type="text" id="cName" maxlength="14" autocomplete="off" autocapitalize="words" value="${esc(name)}" aria-label="Name"></label></div>
      <p class="label">Skin</p><div class="seg" id="cSkin">${Object.entries(A.SKIN).map(([k, v]) => `<button type="button" class="sw" data-v="${k}" aria-label="Skin ${k.slice(1)}"><span class="swatch" style="background:${v};display:block"></span></button>`).join('')}</div>
      <p class="label">Hair</p><div class="seg" id="cHair">${Object.entries(A.HAIR).map(([k, v]) => `<button type="button" class="sw" data-v="${k}" aria-label="${k} hair"><span class="swatch" style="background:${v};display:block"></span></button>`).join('')}</div>
      <p class="label">Hairstyle</p><div class="seg" id="cStyle">${A.STYLES.map(k => `<button type="button" data-v="${k}">${{ long: 'Long', curly: 'Curly', bun: 'Bun', braids: 'Braids', puffs: 'Puffs' }[k]}</button>`).join('')}</div>
      <button type="button" class="cta" id="cSave">${editing ? 'Save' : 'Make my princess'}</button>
      ${editing ? '<button type="button" class="sbtn" id="cDel" style="margin:18px auto 0;display:block;color:var(--danger-text)">Remove this player</button>' : ''}`);
    const paint = () => {
      s.querySelector('#cPrev').innerHTML = A.princess(look, p ? wearing(p) : A.STARTER, { mood: 'happy' });
      for (const [id, k] of [['cSkin', 'skin'], ['cHair', 'hair'], ['cStyle', 'style']]) for (const b of s.querySelectorAll(`#${id} button`)) b.setAttribute('aria-pressed', String(b.dataset.v === look[k]));
      s.querySelector('#cSave').disabled = !s.querySelector('#cName').value.trim();
    };
    for (const [id, k] of [['cSkin', 'skin'], ['cHair', 'hair'], ['cStyle', 'style']]) s.querySelector('#' + id).addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { look[k] = b.dataset.v; paint(); } });
    s.querySelector('#cName').addEventListener('input', paint);
    s.querySelector('#cSave').onclick = () => {
      name = s.querySelector('#cName').value.trim().slice(0, 14); if (!name) return;
      if (editing) { p.name = name; p.look = look; p.updated = Date.now(); }
      else { const np = E.newPlayer(uidOf(), name, look); save.players[np.id] = np; }
      persist(true); paintPicker(); s.close(); sync();
    };
    if (editing) s.querySelector('#cDel').onclick = () => {
      if (!confirm(tr(`Remove ${p.name}? Their progress, coins and treasures are deleted on every phone.`))) return;
      delete save.players[p.id]; save.gone[p.id] = Date.now(); persist(true); paintPicker(); s.close(); sync();
    };
    paint();
  }

  // ---- the Parent corner ----
  const mins = s => Math.round(s / 60);
  const minWord = s => { const m = mins(s); return m + (m === 1 ? ' minute' : ' minutes'); };
  function parent() {
    const ps = players(), acct = window.AllisonOS && window.AllisonOS.account, user = acct && acct.user();
    const st = set();
    const s = sheet('Parent corner', `
      <p class="label">Players</p><div class="group">${ps.map(p => { const t = E.playedOn(p, today()); return `<button type="button" class="row" data-rep="${esc(p.id)}"><span class="grow"><b>${esc(p.name)}</b><small>${mins(t)} min today · ${E.coins(p)} coins · reading level ${(p.skills.read || {}).level || '–'}</small></span><span class="val">›</span></button>`; }).join('') || '<div class="row"><span class="grow"><small>No players yet.</small></span></div>'}
        <button type="button" class="row" data-new><span class="grow" style="color:var(--accent-text);font-weight:600">Add a player</span></button></div>
      <p class="label">Learning</p><div class="group">
        <div class="row"><span class="grow">Favor reading<small>How strongly the quest and the map lean to Story Tower</small></span></div>
        <div class="row"><div class="seg" id="sFocus">${[['normal', 'Normal'], ['more', 'More'], ['most', 'Most']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${st.focus === v}">${n}</button>`).join('')}</div></div>
        <div class="row"><span class="grow">Lands open<small>Story Tower is always open</small></span></div>
        <div class="row"><div class="seg" id="sLands">${[['math', 'Gem Mine'], ['wand', 'Star Meadow'], ['garden', 'Fairy Garden'], ['spell', 'Tiara Workshop'], ['castle', 'Bakery']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${!(st.off || []).includes(v)}">${n}</button>`).join('')}</div></div></div>
      <p class="label">Voice and sound</p><div class="group">
        <div class="row"><span class="grow">Voice speed</span><div class="seg" id="sRate">${[[0.75, 'Slow'], [0.9, 'Normal'], [1.05, 'Quick']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${Math.abs(st.rate - v) < 0.01}">${n}</button>`).join('')}</div></div>
        <div class="row"><span class="grow">Sound effects</span><div class="seg" id="sSfx"><button type="button" data-v="1" aria-pressed="${!!st.sfx}">On</button><button type="button" data-v="0" aria-pressed="${!st.sfx}">Off</button></div></div>
        <div class="row"><span class="grow">Play timer on screen<small>Minutes played this session. The game never stops play: you're in charge of screen time.</small></span><div class="seg" id="sBadge"><button type="button" data-v="1" aria-pressed="${!!st.badge}">Show</button><button type="button" data-v="0" aria-pressed="${!st.badge}">Hide</button></div></div>
        <div class="row"><span class="grow">Natural voices<small>Each friend speaks in a real-sounding voice of their own, made by Google over the internet${token() ? '' : '. Sign in below to use them'}; otherwise the phone's voice</small></span><div class="seg" id="sNatural"><button type="button" data-v="1" aria-pressed="${st.natural !== false}">On</button><button type="button" data-v="0" aria-pressed="${st.natural === false}">Off</button></div></div>
        <button type="button" class="row" id="sVoices"><span class="grow">Hear the voices<small>The storyteller, Professor Hoot, Pebble, Gemma and Bloom</small></span><span class="val">▶</span></button>
        <button type="button" class="row" id="sTest"><span class="grow">Test the voice<small>Hear how this phone says some letter sounds</small></span><span class="val">▶</span></button></div>
      <p class="label">Letter sounds</p><div class="group"><div class="row"><span class="grow"><small>Phone voices say letter names well and letter sounds poorly. Record each sound once (tap a letter, say the sound, tap again): the game plays your voice instead. Say just the sound: "mmm" for m, "t" (short, no "uh") for t, "a" as in apple.</small></span></div>
        <div class="clips" id="clips"></div></div>
      <p class="label">Design</p><div class="group" id="sDesign">${window.aosDesign ? aosDesign.picker() : ''}</div>
      <p class="label">Family account</p><div class="group">${user ? `<div class="row"><span class="grow">Signed in as ${esc(user.name)}<small>Players and their progress follow you to every family phone signed in here.</small></span></div>`
        : `<button type="button" class="row" id="sSign"><span class="grow">Sign in with Face ID<small>Keep players and their progress on every family phone.</small></span><span class="val">›</span></button>`}</div>
      <p class="note">Sparkle Kingdom keeps everything on this phone and, signed in, in your family account. With natural voices on, the sentences the game says (a player's name among them) go to Google to be spoken; nothing else goes anywhere else.</p>`, { onClose: () => { V.rate = set().rate; V.sounds = set().sfx; save.settingsAt = Date.now(); persist(true); paintPicker(); sync(); } });
    const seg = (id, fn) => s.querySelector('#' + id).addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; fn(b.dataset.v, b); for (const x of s.querySelectorAll('#' + id + ' button')) x.setAttribute('aria-pressed', String(x === b)); save.settingsAt = Date.now(); persist(); });
    seg('sFocus', v => { st.focus = v; });
    s.querySelector('#sLands').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; const off = new Set(st.off || []); off.has(b.dataset.v) ? off.delete(b.dataset.v) : off.add(b.dataset.v); st.off = [...off]; b.setAttribute('aria-pressed', String(!off.has(b.dataset.v))); save.settingsAt = Date.now(); persist(); });
    seg('sRate', v => { st.rate = +v; V.rate = +v; });
    seg('sSfx', v => { st.sfx = v === '1'; V.sounds = st.sfx; });
    seg('sBadge', v => { st.badge = v === '1'; });
    seg('sNatural', v => { st.natural = v === '1'; V.natural = V.natural; });
    s.querySelector('#sVoices').onclick = async () => { V.unlock();
      for (const [who, line] of [['narrator', 'Once upon a time, in Sparkle Kingdom.'], ['owl', "Hoo hoo! I'm Professor Hoot."], ['dragon', "Hi! I'm Pebble. Let's count gems!"], ['gemma', "I'm Gemma. Let's spell a word!"], ['bloom', "I'm Bloom. Let's find the flowers!"]]) {
        if (!document.body.contains(s)) return; await V.say([line], { who }); } };
    s.querySelector('#sTest').onclick = () => V.say(['Here are some sounds.', { snd: 'm' }, { snd: 't' }, { snd: 'a' }, 'c, a, t, cat.']);
    if (window.aosDesign) aosDesign.bind(s.querySelector('#sDesign'));
    s.querySelector('[data-new]').onclick = () => { s.close(); creator(); };
    s.querySelectorAll('[data-rep]').forEach(b => b.onclick = () => { s.remove(); report(save.players[b.dataset.rep]); });
    const sign = s.querySelector('#sSign'); if (sign) sign.onclick = async () => { try { await acct.signIn(); s.close(); sync(true); parent(); } catch { toast('Sign-in did not finish'); } };
    paintClips(s.querySelector('#clips'));
    pullClips().then(() => paintClips(s.querySelector('#clips')));
  }
  let recording = null;
  function paintClips(box) {
    if (!box) return;
    box.innerHTML = C.LETTERS.slice().sort().map(l => { const has = V.clips.has(l), rec = recording && recording.l === l;
      return `<div class="clip ${has ? 'has' : ''} ${rec ? 'rec' : ''}"><button type="button" class="sbtn" data-rec="${l}" aria-label="${rec ? 'Stop recording ' + l : 'Record the sound of ' + l}"><b>${l}</b></button>
        <small>${rec ? 'tap to stop' : has ? '' : 'tap to record'}</small>${has && !rec ? `<button type="button" class="sbtn" data-play="${l}" aria-label="Play ${l}" style="min-height:30px;padding:0 10px">▶</button>` : ''}</div>`; }).join('');
    box.onclick = async e => {
      const pl = e.target.closest('[data-play]'); if (pl) { V.clips.play(pl.dataset.play); return; }
      const b = e.target.closest('[data-rec]'); if (!b) return; const l = b.dataset.rec;
      if (recording) { const r = recording; recording = null; const url = await r.rec.stop(); if (url) { V.clips.set(r.l, url); pushClips(); V.clips.play(r.l); } paintClips(box); if (r.l === l) return; }
      try { if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('no-mic'); recording = { l, rec: await V.clips.record() }; paintClips(box); }
      catch { recording = null; toast('The microphone isn’t available here'); }
    };
  }

  // a player's progress, for a grown-up
  function report(p) {
    const d = today(), skills = ['read', 'spell', 'math', 'wand', 'match', 'missing', 'recall', 'pattern', 'bake'];
    const levelOn = (sk, day) => { for (let i = 0; i < 60; i++) { const v = ((p.levels || {})[E.addDays(day, -i)] || {})[sk]; if (v) return v; } return null; };
    const rows = skills.filter(k => p.skills[k]).map(k => { const s = p.skills[k], max = C.LADDERS[k], was = levelOn(k, E.addDays(d, -7)), acc = E.accuracy(p, k, 7, d);
      return `<div class="row" style="display:block"><div class="bar"><span class="bn"><b>${SKILL_NAME[k]}</b></span><span class="bt"><i style="width:${s.level / max * 100}%"></i></span><span class="bv">${s.level} of ${max}</span></div>
        <small>${esc(C.LEVEL_NAMES[k][s.level - 1])}${s.placed ? '' : ' (still warming up)'} · ${was && was !== s.level ? (s.level > was ? `up ${s.level - was} this week` : `down ${was - s.level} this week`) : 'same as last week'} · ${acc.total ? Math.round(acc.share * 100) + '% right in 7 days (' + acc.total + ' answers)' : 'no answers this week'}</small></div>`; }).join('') || '<div class="row"><small>No rounds played yet.</small></div>';
    const keyName = key => { const k = key.slice(key.indexOf('/') + 1), v = k.slice(2); return { w: v, s: '/' + v + '/', h: '"' + v + '"', f: v.replace('-', ' − ').replace('+', ' + '), o: v, b: v, y: v, r: v, m: v, l: v, x: v, c: v, t: v }[k[0]] || v; };
    const known = Object.keys(p.known || {}), learning = Object.keys(p.review || {});
    const hard = learning.filter(k => (p.review[k].missed || 0) >= 2);
    const days = Array.from({ length: 30 }, (_, i) => E.playedOn(p, E.addDays(d, i - 29))), top = Math.max(60, ...days);
    const week = Array.from({ length: 7 }, (_, i) => E.playedOn(p, E.addDays(d, -i))).reduce((a, b) => a + b, 0);
    const lands = [['read', 'Story Tower'], ['spell', 'Tiara Workshop'], ['math', 'Gem Mine'], ['wand', 'Star Meadow'], ['garden', 'Fairy Garden'], ['world', 'Exploring'], ['castle', 'Castle']].map(([k, n]) => [n, E.playedIn(p, k)]);
    const landTop = Math.max(60, ...lands.map(x => x[1]));
    const s = sheet(p.name, `
      <p class="label">Skills</p><div class="group">${rows}</div>
      <p class="label">Play time</p><div class="group"><div class="row"><span class="grow">Today<small>${minWord(E.playedOn(p, d))}</small></span><span class="grow">This week<small>${minWord(week)}</small></span></div>
        <div class="row" style="display:block"><small>The last 30 days</small><div class="chart" aria-label="Minutes played each day, the last 30 days">${days.map(v => `<i style="height:${Math.max(2, v / top * 100)}%" title="${mins(v)} min"></i>`).join('')}</div></div>
        <div class="row" style="display:block"><div class="bars">${lands.map(([n, v]) => `<div class="bar"><span class="bn">${n}</span><span class="bt"><i style="width:${v / landTop * 100}%"></i></span><span class="bv">${mins(v)} min</span></div>`).join('')}</div></div></div>
      <p class="label">Words and sounds</p><div class="group">
        <div class="row"><span class="grow">Known<small>Right on 3 different days</small></span><span class="val">${known.length}</span></div>
        <div class="chips">${known.map(k => `<span>${esc(keyName(k))}</span>`).join('') || '<small style="color:var(--muted)">None yet</small>'}</div>
        <div class="row"><span class="grow">Learning<small>Coming back for review</small></span><span class="val">${learning.length}</span></div>
        <div class="chips">${learning.map(k => `<span class="${hard.includes(k) ? 'warn' : ''}">${esc(keyName(k))}</span>`).join('') || '<small style="color:var(--muted)">None right now</small>'}</div>
        ${hard.length ? `<div class="row"><span class="grow">Practice together<small>Missed on 2 or more days: try these with her at bedtime</small></span></div><div class="chips">${hard.map(k => `<span class="warn">${esc(keyName(k))}</span>`).join('')}</div>` : ''}</div>
      <p class="label">Starting levels</p><div class="group">${skills.map(k => `<div class="row"><span class="grow">${SKILL_NAME[k]}<small>${p.skills[k] ? 'Now ' + p.skills[k].level + ': ' + esc(C.LEVEL_NAMES[k][p.skills[k].level - 1]) : 'Not started: the warm-up finds her level'}</small></span>
          <div class="seg"><button type="button" data-lv="${k}" data-d="-1" aria-label="One level easier">−</button><button type="button" data-lv="${k}" data-d="1" aria-label="One level harder">+</button></div></div>`).join('')}</div>
      <p class="label">The story</p><div class="group"><div class="row"><span class="grow">${RANKS[rankOf(p)]}<small>Her rank: all her levels added up, ${levelSum(p)} of 55</small></span></div>
        ${Ch.LANDS.map(l => `<div class="row"><span class="grow">${esc(cap(Ch.LAND[l]))}<small>${E.roundsIn(p, l)} ${E.roundsIn(p, l) === 1 ? 'round' : 'rounds'} played there</small></span><span class="val">${(p.chapters || {})[l] || 0} of 10</span></div>`).join('')}</div>
      <p class="note">Coins: ${E.coins(p)}. Rounds played: ${p.rounds || 0}. Stickers: ${(p.stickers || []).length}.</p>
      <button type="button" class="cta" id="rEdit">Edit name and look</button>`, { back: () => parent() });
    s.addEventListener('click', e => {
      const b = e.target.closest('[data-lv]'); if (!b) return;
      const k = b.dataset.lv, max = C.LADDERS[k], sk = p.skills[k] = p.skills[k] || E.newSkill(1);
      sk.level = Math.max(1, Math.min(max, sk.level + +b.dataset.d)); sk.placed = true; sk.hist = []; sk.streak = 0; sk.misses = 0; sk.answers++;
      p.updated = Date.now(); persist(true); s.remove(); report(p);
    });
    s.querySelector('#rEdit').onclick = () => { s.remove(); creator(p); };
  }

  // ---- the play timer ----
  setInterval(() => {
    if (document.hidden || !me || screen === 'picker') return;
    const now = Date.now();
    if (now - lastTap > 5 * 60000) { session.secs = 0; return; }
    if (now - lastTap > 60000) return;
    session.secs++; E.played(me, device, today(), session.land || 'world', 1);
    if (session.secs % 15 === 0) persist();
    if (screen === 'world' && session.secs % 60 === 0) paintHud();
  }, 1000);

  // ---- the family account: players and letter sounds, merged with this phone's ----
  const token = () => { try { return (JSON.parse(localStorage.getItem('aos.session') || 'null') || {}).token || null; } catch { return null; } };
  const call = async (path, body) => {
    const t = token(); if (!t) return null;
    const r = await fetch(API + path, { method: body ? 'POST' : 'GET', cache: 'no-store', keepalive: !!body && JSON.stringify(body).length < 60000,
      headers: Object.assign({ 'X-Sparkle': '1', Authorization: 'Bearer ' + t }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch {}
    return { status: r.status, ok: r.ok, j };
  };
  // natural voices (voice.js), from this server, for a phone signed in to the family account
  V.natural = { ok: () => set().natural !== false && !!token(), headers: () => ({ 'X-Sparkle': '1', Authorization: 'Bearer ' + token() }),
    url: (who, text, r, snd) => API + 'speak?' + new URLSearchParams(Object.assign({ v: who, t: text, r: (Math.round(r * 20) / 20).toFixed(2) }, snd ? { s: snd } : {})) };
  let syncing = null, lastSent = '';
  function sync(force) {
    if (!token() || !navigator.onLine) return Promise.resolve();
    if (syncing) return syncing;
    syncing = (async () => {
      for (let tries = 0; tries < 2; tries++) {
        const got = await call('save'); if (!got || !got.ok) return;
        const theirs = got.j && got.j.save, merged = E.merge(save, theirs);
        merged.settings = Object.assign({}, DEFAULTS, merged.settings || {});
        const mine = me && me.id;
        save = merged; if (mine) me = save.players[mine] || null;
        persist(true);
        const out = JSON.stringify(stripLocal(save));
        if (theirs && out === JSON.stringify(stripLocal(theirs))) return;
        if (!force && out === lastSent) return;
        const put = await call('save', { save: stripLocal(save), rev: got.j.rev || 0 });
        if (put && put.ok) { lastSent = out; return; }
        if (!put || put.status !== 409) return;
      }
    })().catch(NO).finally(() => { syncing = null; if (me && screen === 'world') paintHud(); });
    return syncing;
  }
  const stripLocal = s => ({ v: 1, players: s.players, gone: s.gone || {}, settings: s.settings, settingsAt: s.settingsAt || 0 });
  async function pullClips() { try { const got = await call('clips'); if (got && got.ok && got.j && got.j.clips) { const mine = V.clips.all(); V.clips.load(Object.assign({}, got.j.clips, mine)); } } catch {} }
  let clipJob = 0;
  function pushClips() { clearTimeout(clipJob); clipJob = setTimeout(() => { call('clips', { clips: V.clips.all() }).catch(NO); }, 1500); }
  addEventListener('visibilitychange', () => { if (document.hidden) { persist(true); sync(); } });
  addEventListener('aos:account', e => { if (e.detail) sync(true); });

  // ---- start ----
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(NO);
  paintPicker();
  show('picker');
  sync().then(() => { if (screen === 'picker') paintPicker(); });
  window.sparkle = { get save() { return save; }, get me() { return me; }, get round() { return round; }, get screen() { return screen; }, get gate() { return session.gateQ; }, choose, startRound, travel, enterWorld, openCastle, openWardrobe, openStable, openBedroom, parent, report };   // for tests
})();
