// AllisonOS welcome: a brand moment, then a short tour, the first time anyone
// opens an AllisonOS app on this device (once overall, not once per app).
//
// Every app loads this from the launcher's folder, as it does back.js and
// slide.js. It draws its own overlay (all its styles are scoped to
// #aos-welcome), follows light and dark mode, and is plain fades with Reduce
// Motion. A tap on Skip (or Get started at the end) closes it.
//
//   AllisonOS.welcome.play('A' | 'B' | 'C')   play one design now (the lab page)
//
// Three designs to choose from (welcome-lab.html plays each):
//   A  Glass bloom   the launcher's colour fields drift in, a glass tile forms
//                    round the AllisonOS icon, the name rises letter by letter;
//                    the tour is a floating glass card you swipe through
//   B  Constellation every app's icon drifts in from the edges into a ring that
//                    turns and gathers into the name; the tour is full-screen
//                    pages with story-style progress bars that move on their own
//   C  Quiet type    the name is drawn on with a hairline under it, nothing
//                    else; the tour is one glass panel whose words and line
//                    drawings change in place
//
// iPhone: an app added to the Home Screen on its own keeps its own storage, so
// "first time" is per install there; apps opened from the launcher share it.
(() => {
  'use strict';
  const AOS = window.AllisonOS = window.AllisonOS || {};
  const here = (document.currentScript && document.currentScript.src) || location.href;
  const icon = id => new URL(`../${id}/icon-512.png`, here).href;
  const APPS = ['mail', 'calendar', 'news', 'weather', 'notes', 'podcasts', 'travel', 'places', 'fitness', 'house'];
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, still() ? Math.min(ms, 250) : ms));

  // ---- the tour: AllisonOS as a whole ----
  const TOUR = [
    { k: 'apps', t: 'Everything in one place', d: 'Mail, Calendar, News, Weather, Notes, Podcasts, Travel, Places, Fitness and Home, side by side.' },
    { k: 'swipe', t: 'Swipe up to come home', d: 'In an app opened from the AllisonOS home screen, swipe up from just above the bottom edge to come back to it. Press and hold the home screen for Settings.' },
    { k: 'theme', t: 'Looks like your phone', d: 'Light and dark follow your iPhone, with Liquid Glass throughout.' },
    { k: 'private', t: 'Yours alone', d: 'What you set up stays on this phone.' },
  ];
  const LINE = {   // simple line drawings for design C (and the small art in A)
    apps: '<rect x="8" y="8" width="18" height="18" rx="5"/><rect x="38" y="8" width="18" height="18" rx="5"/><rect x="8" y="38" width="18" height="18" rx="5"/><rect x="38" y="38" width="18" height="18" rx="5"/>',
    swipe: '<rect x="18" y="4" width="28" height="56" rx="7"/><path d="M26 52h12"/><path d="M32 40V18M24 26l8-8 8 8"/>',
    theme: '<circle cx="32" cy="32" r="22"/><path d="M32 10a22 22 0 0 1 0 44z" fill="currentColor"/>',
    private: '<rect x="14" y="28" width="36" height="28" rx="6"/><path d="M22 28v-8a10 10 0 0 1 20 0v8"/><circle cx="32" cy="42" r="3" fill="currentColor"/>',
  };
  const lineSvg = k => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LINE[k]}</svg>`;
  const iconsArt = n => `<div class="w-mini">${APPS.slice(0, n).map(a => `<img src="${icon(a)}" alt="">`).join('')}</div>`;
  // The art above each tour page, for A and B.
  const art = k => k === 'apps' ? iconsArt(10)
    : k === 'swipe' ? '<div class="w-phone"><i class="w-bar"></i><i class="w-arrow"></i></div>'
    : k === 'theme' ? '<div class="w-moon"><i></i></div>'
    : `<div class="w-line">${lineSvg('private')}</div>`;

  const CSS = `
#aos-welcome { position: fixed; inset: 0; z-index: 2147483000; overflow: hidden; display: flex; flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; -webkit-font-smoothing: antialiased;
  --w-bg: #0F1116; --w-text: #fff; --w-muted: rgba(235,235,245,.62); --w-glass: rgba(255,255,255,.10); --w-edge: rgba(255,255,255,.22); --w-dot: rgba(255,255,255,.3);
  background: var(--w-bg); color: var(--w-text); opacity: 0; transition: opacity .5s; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
@media (prefers-color-scheme: light) { #aos-welcome { --w-bg: #F2F4F8; --w-text: #0B0B0F; --w-muted: rgba(60,60,67,.62); --w-glass: rgba(255,255,255,.55); --w-edge: rgba(255,255,255,.9); --w-dot: rgba(0,0,0,.18); } }
#aos-welcome.in { opacity: 1; }
#aos-welcome.out { opacity: 0; transition: opacity .6s; }
#aos-welcome * { box-sizing: border-box; }
#aos-welcome button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
#aos-welcome .w-skip { position: absolute; top: calc(env(safe-area-inset-top) + 14px); right: 18px; z-index: 5; font-size: 15px; font-weight: 600; color: var(--w-muted); padding: 8px 10px; }
#aos-welcome .w-stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
#aos-welcome .w-word { display: flex; font-size: 40px; font-weight: 700; letter-spacing: -0.8px; }
#aos-welcome .w-word span { display: inline-block; opacity: 0; transform: translateY(14px); transition: opacity .6s, transform .8s cubic-bezier(.2,.8,.2,1); }
#aos-welcome .w-word.on span { opacity: 1; transform: none; }
#aos-welcome .w-hello { font-size: 15px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--w-muted); opacity: 0; transition: opacity .8s; margin-bottom: 10px; }
#aos-welcome .w-hello.on { opacity: 1; }
#aos-welcome .w-btn { display: block; width: 100%; height: 52px; border-radius: 999px; font-size: 17px; font-weight: 600; color: #fff; background: #0A84FF; box-shadow: inset 0 0 0 1px rgba(255,255,255,.25), inset 0 1px 1px rgba(255,255,255,.5); }
#aos-welcome .w-dots { display: flex; justify-content: center; gap: 7px; margin: 18px 0; }
#aos-welcome .w-dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--w-dot); transition: background .3s, width .3s; }
#aos-welcome .w-dots i.on { background: var(--w-text); width: 18px; border-radius: 4px; }
#aos-welcome .w-page h2 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.4px; }
#aos-welcome .w-page p { margin: 8px 0 0; font-size: 16px; line-height: 1.4; color: var(--w-muted); }
/* art */
#aos-welcome .w-mini { display: grid; grid-template-columns: repeat(5, 44px); gap: 12px; justify-content: center; }
#aos-welcome .w-mini img { width: 44px; height: 44px; border-radius: 11px; box-shadow: 0 4px 12px rgba(0,0,0,.18); }
#aos-welcome .w-phone { position: relative; width: 84px; height: 150px; border-radius: 22px; margin: 0 auto; box-shadow: inset 0 0 0 2px var(--w-text); opacity: .9; }
#aos-welcome .w-bar { position: absolute; left: 50%; bottom: 10px; width: 34px; height: 4px; margin-left: -17px; border-radius: 2px; background: var(--w-text); }
#aos-welcome .w-arrow { position: absolute; left: 50%; bottom: 24px; width: 14px; height: 14px; margin-left: -7px; border-left: 2px solid #0A84FF; border-top: 2px solid #0A84FF; transform: rotate(45deg); animation: w-up 1.6s ease-in-out infinite; }
@keyframes w-up { 0% { bottom: 22px; opacity: 0; } 30% { opacity: 1; } 100% { bottom: 96px; opacity: 0; } }
#aos-welcome .w-moon { width: 110px; height: 110px; border-radius: 50%; margin: 0 auto; background: linear-gradient(90deg, #F2F4F8 50%, #15171C 50%); box-shadow: inset 0 0 0 1.5px var(--w-edge), 0 10px 30px rgba(0,0,0,.2); animation: w-turn 6s ease-in-out infinite alternate; }
@keyframes w-turn { to { transform: rotate(180deg); } }
#aos-welcome .w-line svg { width: 96px; height: 96px; margin: 0 auto; display: block; }
#aos-welcome .w-art { height: 170px; display: flex; align-items: center; justify-content: center; }

/* ---- A: glass bloom ---- */
#aos-welcome .a-blob { position: absolute; width: 70vmax; height: 70vmax; border-radius: 50%; filter: blur(60px); opacity: 0; transition: opacity 1.6s; }
#aos-welcome.a-on .a-blob { opacity: .55; }
#aos-welcome .a-blob:nth-child(1) { background: rgb(96,150,255); left: -30vmax; top: -25vmax; animation: a-drift1 18s ease-in-out infinite alternate; }
#aos-welcome .a-blob:nth-child(2) { background: rgb(255,158,118); right: -35vmax; top: 10vh; animation: a-drift2 22s ease-in-out infinite alternate; }
#aos-welcome .a-blob:nth-child(3) { background: rgb(168,138,255); left: -20vmax; bottom: -35vmax; animation: a-drift1 20s ease-in-out infinite alternate-reverse; }
#aos-welcome .a-blob:nth-child(4) { background: rgb(96,208,178); right: -25vmax; bottom: -30vmax; animation: a-drift2 16s ease-in-out infinite alternate-reverse; }
@keyframes a-drift1 { to { transform: translate(12vw, 8vh) scale(1.1); } }
@keyframes a-drift2 { to { transform: translate(-10vw, -6vh) scale(.92); } }
#aos-welcome .a-tile { width: 132px; height: 132px; border-radius: 32px; padding: 14px; margin-bottom: 26px; opacity: 0; transform: scale(.7); filter: blur(12px);
  background: linear-gradient(180deg, rgba(255,255,255,.28), rgba(255,255,255,.08)); -webkit-backdrop-filter: blur(24px) saturate(180%); backdrop-filter: blur(24px) saturate(180%);
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.6), inset 0 1px 1px rgba(255,255,255,.7), 0 20px 50px -10px rgba(0,0,0,.35);
  transition: opacity 1s, transform 1.2s cubic-bezier(.2,.8,.2,1), filter 1.2s; }
#aos-welcome .a-tile.on { opacity: 1; transform: none; filter: none; }
#aos-welcome .a-tile img { width: 100%; height: 100%; border-radius: 22px; display: block; }
#aos-welcome .a-brand { transition: transform .9s cubic-bezier(.2,.8,.2,1), opacity .6s; }
#aos-welcome .a-brand.up { transform: translateY(-28vh) scale(.62); opacity: .0; }
#aos-welcome .a-card { position: absolute; left: 16px; right: 16px; bottom: calc(env(safe-area-inset-bottom) + 16px); border-radius: 34px; padding: 26px 22px 22px; overflow: hidden;
  background: var(--w-glass); -webkit-backdrop-filter: blur(30px) saturate(180%); backdrop-filter: blur(30px) saturate(180%);
  box-shadow: inset 0 0 0 .5px var(--w-edge), inset 0 1px 1px rgba(255,255,255,.5), 0 24px 60px -16px rgba(0,0,0,.35);
  transform: translateY(110%); transition: transform .8s cubic-bezier(.2,.8,.2,1); touch-action: pan-y; }
#aos-welcome .a-card.on { transform: none; }
#aos-welcome .a-clip { overflow: hidden; margin: 0 -2px; }
#aos-welcome .a-card .w-page p { color: var(--w-text); opacity: .78; }
#aos-welcome .a-track { display: flex; transition: transform .45s cubic-bezier(.2,.8,.2,1); }
#aos-welcome .a-track .w-page { flex: 0 0 100%; text-align: center; padding: 0 4px; }

/* ---- B: constellation ---- */
#aos-welcome .b-icon { position: absolute; left: 50%; top: 45%; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 13px; opacity: 0;
  box-shadow: 0 6px 18px rgba(0,0,0,.25); transition: transform 1.4s cubic-bezier(.2,.8,.2,1), opacity .9s; }
#aos-welcome .b-ring { position: absolute; inset: 0; }
#aos-welcome .b-word .w-word { font-size: 34px; }
#aos-welcome .b-word { position: absolute; left: 0; right: 0; top: 45%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; }
#aos-welcome .b-bars { position: absolute; top: calc(env(safe-area-inset-top) + 12px); left: 16px; right: 80px; display: flex; gap: 5px; opacity: 0; transition: opacity .5s; }
#aos-welcome .b-bars.on { opacity: 1; }
#aos-welcome .b-bars i { flex: 1; height: 3px; border-radius: 2px; background: var(--w-dot); overflow: hidden; }
#aos-welcome .b-bars i b { display: block; height: 100%; width: 0; background: var(--w-text); }
#aos-welcome .b-pages { position: absolute; inset: 0; }
#aos-welcome .b-page { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 0 30px 120px; opacity: 0; transform: translateX(30px); transition: opacity .5s, transform .6s cubic-bezier(.2,.8,.2,1); pointer-events: none; }
#aos-welcome .b-page.on { opacity: 1; transform: none; }
#aos-welcome .b-page.gone { transform: translateX(-30px); }
#aos-welcome .b-page h2 { font-size: 32px; }
#aos-welcome .b-page .w-art { justify-content: flex-start; margin-bottom: 26px; }
#aos-welcome .b-page .w-mini, #aos-welcome .b-page .w-phone, #aos-welcome .b-page .w-moon, #aos-welcome .b-page .w-line svg { margin: 0; }
#aos-welcome .b-foot { position: absolute; left: 24px; right: 24px; bottom: calc(env(safe-area-inset-bottom) + 24px); opacity: 0; transition: opacity .4s; }
#aos-welcome .b-foot.on { opacity: 1; }
#aos-welcome .b-hint { text-align: center; font-size: 13px; color: var(--w-muted); }

/* ---- C: quiet type ---- */
#aos-welcome .c-word { position: relative; font-size: 44px; font-weight: 600; letter-spacing: -1px; clip-path: inset(0 100% 0 0); transition: clip-path 1.6s cubic-bezier(.65,0,.35,1); }
#aos-welcome .c-word.on { clip-path: inset(0 0 0 0); }
#aos-welcome .c-rule { height: 1px; width: 0; background: var(--w-text); opacity: .5; margin-top: 14px; transition: width 1.4s cubic-bezier(.65,0,.35,1) .5s; }
#aos-welcome .c-rule.on { width: 220px; }
#aos-welcome .c-sub { margin-top: 14px; font-size: 15px; color: var(--w-muted); opacity: 0; transition: opacity .8s; }
#aos-welcome .c-sub.on { opacity: 1; }
#aos-welcome .c-brand { transition: transform .9s cubic-bezier(.2,.8,.2,1); }
#aos-welcome .c-brand.up { transform: translateY(-26vh); }
#aos-welcome .c-panel { position: absolute; left: 16px; right: 16px; bottom: calc(env(safe-area-inset-bottom) + 16px); border-radius: 34px; padding: 28px 24px 22px; text-align: center;
  background: var(--w-glass); -webkit-backdrop-filter: blur(30px) saturate(180%); backdrop-filter: blur(30px) saturate(180%);
  box-shadow: inset 0 0 0 .5px var(--w-edge), 0 24px 60px -16px rgba(0,0,0,.3); opacity: 0; transform: translateY(24px); transition: opacity .6s, transform .7s cubic-bezier(.2,.8,.2,1); }
#aos-welcome .c-panel.on { opacity: 1; transform: none; }
#aos-welcome .c-body { transition: opacity .3s; }
#aos-welcome .c-body.fade { opacity: 0; }
#aos-welcome .c-art svg { width: 64px; height: 64px; display: block; margin: 0 auto 16px; }
#aos-welcome .c-art path, #aos-welcome .c-art rect, #aos-welcome .c-art circle { stroke-dasharray: 260; stroke-dashoffset: 260; animation: c-draw 1.4s cubic-bezier(.65,0,.35,1) forwards; }
@keyframes c-draw { to { stroke-dashoffset: 0; } }
#aos-welcome .c-btns { display: flex; gap: 10px; margin-top: 22px; }
#aos-welcome .c-btns .w-btn { flex: 1; }
#aos-welcome .c-btns .c-back { flex: 0 0 52px; height: 52px; border-radius: 50%; background: var(--w-dot); color: var(--w-text); font-size: 22px; }
#aos-welcome .c-btns .c-back[hidden] { display: none; }

@media (prefers-reduced-motion: reduce) {
  #aos-welcome *, #aos-welcome *::before, #aos-welcome *::after { animation: none !important; transition-duration: .2s !important; transition-delay: 0s !important; }
  #aos-welcome .c-art path, #aos-welcome .c-art rect, #aos-welcome .c-art circle { stroke-dashoffset: 0; }
}`;

  let open = null;
  function mount(cls) {
    if (!document.getElementById('aos-welcome-css')) {
      const st = document.createElement('style'); st.id = 'aos-welcome-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const el = document.createElement('div');
    el.id = 'aos-welcome'; el.className = cls; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Welcome to AllisonOS');
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    return el;
  }
  function closer(el, resolve) {
    let done = false;
    return () => {
      if (done) return; done = true;
      el.classList.add('out');
      setTimeout(() => { el.remove(); open = null; resolve(); }, 650);
    };
  }
  const word = s => `<div class="w-word">${[...s].map((c, i) => `<span style="transition-delay:${(i * 0.06).toFixed(2)}s">${c}</span>`).join('')}</div>`;
  // Drag the tour sideways (A): a flick or a drag past a fifth of the width turns the page.
  function swiper(area, go) {
    let x0 = null, y0 = 0, t0 = 0;
    area.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); });
    area.addEventListener('pointerup', e => {
      if (x0 == null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0, fast = Date.now() - t0 < 300;
      x0 = null;
      if (Math.abs(dx) > Math.abs(dy) && (Math.abs(dx) > area.clientWidth / 5 || (fast && Math.abs(dx) > 30))) go(dx < 0 ? 1 : -1);
    });
  }

  // ---- A: glass bloom ----
  async function playA(el, close) {
    el.innerHTML = `<div class="a-blob"></div><div class="a-blob"></div><div class="a-blob"></div><div class="a-blob"></div>
      <button class="w-skip" type="button">Skip</button>
      <div class="w-stage"><div class="a-brand"><div style="display:flex;flex-direction:column;align-items:center">
        <div class="a-tile"><img src="${new URL('icon-512.png', here).href}" alt=""></div>
        <div class="w-hello">Welcome to</div>${word('AllisonOS')}</div></div></div>
      <div class="a-card"><div class="a-clip"><div class="a-track">${TOUR.map(p => `<div class="w-page"><div class="w-art">${art(p.k)}</div><h2>${p.t}</h2><p>${p.d}</p></div>`).join('')}</div></div>
        <div class="w-dots">${TOUR.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
        <button class="w-btn" type="button">Continue</button></div>`;
    el.querySelector('.w-skip').onclick = close;
    const q = s => el.querySelector(s);
    await wait(150); el.classList.add('a-on');
    await wait(500); q('.a-tile').classList.add('on');
    await wait(700); q('.w-hello').classList.add('on');
    await wait(250); q('.w-word').classList.add('on');
    await wait(1900); q('.a-brand').classList.add('up');
    await wait(300); q('.a-card').classList.add('on');
    let i = 0;
    const go = d => {
      if (i + d >= TOUR.length) return close();
      i = Math.max(0, i + d);
      q('.a-track').style.transform = `translateX(${-100 * i}%)`;
      el.querySelectorAll('.w-dots i').forEach((x, j) => x.classList.toggle('on', j === i));
      q('.a-card .w-btn').textContent = i === TOUR.length - 1 ? 'Get started' : 'Continue';
    };
    q('.a-card .w-btn').onclick = () => go(1);
    swiper(q('.a-card'), go);
  }

  // ---- B: constellation ----
  async function playB(el, close) {
    const n = APPS.length, R = Math.min(innerWidth * 0.42, innerHeight * 0.3);
    const place = (im, k, turn) => { const a = -Math.PI / 2 + k * 2 * Math.PI / n + turn; im.style.transform = `translate(${(Math.cos(a) * R).toFixed(1)}px, ${(Math.sin(a) * R).toFixed(1)}px)`; };
    el.innerHTML = `<button class="w-skip" type="button">Skip</button>
      <div class="b-ring">${APPS.map(a => `<img class="b-icon" src="${icon(a)}" alt="">`).join('')}</div>
      <div class="b-word"><div class="w-hello">Welcome to</div>${word('AllisonOS')}</div>
      <div class="b-bars">${TOUR.map(() => '<i><b></b></i>').join('')}</div>
      <div class="b-pages">${TOUR.map(p => `<div class="b-page w-page"><div class="w-art">${art(p.k)}</div><h2>${p.t}</h2><p>${p.d}</p></div>`).join('')}</div>
      <div class="b-foot"><button class="w-btn" type="button">Get started</button></div>`;
    el.querySelector('.w-skip').onclick = close;
    const q = s => el.querySelector(s), icons = [...el.querySelectorAll('.b-icon')];
    // scattered off the edges, then each glides into its place on the ring
    icons.forEach((im, k) => { const a = Math.random() * 6.28, d = Math.max(innerWidth, innerHeight) * 0.75; im.style.transform = `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(.6) rotate(${(Math.random() * 60 - 30).toFixed(0)}deg)`; });
    await wait(200);
    icons.forEach((im, k) => { im.style.transitionDelay = (k * 0.07).toFixed(2) + 's'; im.style.opacity = 1; place(im, k, 0); });
    await wait(1900);
    icons.forEach((im, k) => { im.style.transitionDelay = '0s'; im.style.transition = 'transform 1.8s cubic-bezier(.4,0,.2,1), opacity .9s'; place(im, k, 0.6); });   // the ring turns a little
    await wait(500); q('.w-hello').classList.add('on'); q('.w-word').classList.add('on');
    await wait(1700);
    icons.forEach((im, k) => { im.style.transitionDelay = (k * 0.03).toFixed(2) + 's'; im.style.transform = 'scale(.2)'; im.style.opacity = 0; });
    q('.b-word').style.transition = 'opacity .6s'; q('.b-word').style.opacity = 0;
    await wait(800);
    // the tour: story pages that move on their own after 4.5 s; tap the right two thirds for next, the left third for back
    q('.b-bars').classList.add('on');
    const pages = [...el.querySelectorAll('.b-page')], bars = [...el.querySelectorAll('.b-bars b')];
    let i = -1, timer = 0;
    const show = j => {
      clearTimeout(timer);
      i = Math.max(0, Math.min(TOUR.length - 1, j));
      pages.forEach((p, k) => { p.classList.toggle('on', k === i); p.classList.toggle('gone', k < i); });
      bars.forEach((b, k) => { b.style.transition = 'none'; b.style.width = k < i ? '100%' : '0'; });
      const last = i === TOUR.length - 1;
      q('.b-foot').classList.toggle('on', last);
      requestAnimationFrame(() => { const b = bars[i]; b.style.transition = still() ? 'none' : 'width 4.5s linear'; b.style.width = '100%'; });
      if (!last) timer = setTimeout(() => show(i + 1), 4500);
    };
    el.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      show(e.clientX < innerWidth / 3 ? i - 1 : i + 1);
    });
    q('.b-foot .w-btn').onclick = () => { clearTimeout(timer); close(); };
    show(0);
  }

  // ---- C: quiet type ----
  async function playC(el, close) {
    el.innerHTML = `<button class="w-skip" type="button">Skip</button>
      <div class="w-stage"><div class="c-brand" style="display:flex;flex-direction:column;align-items:center">
        <div class="c-word">AllisonOS</div><div class="c-rule"></div><div class="c-sub">Welcome</div></div></div>
      <div class="c-panel"><div class="c-body"></div><div class="w-dots">${TOUR.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
        <div class="c-btns"><button class="c-back" type="button" aria-label="Back" hidden>‹</button><button class="w-btn" type="button">Continue</button></div></div>`;
    el.querySelector('.w-skip').onclick = close;
    const q = s => el.querySelector(s);
    await wait(300); q('.c-word').classList.add('on'); q('.c-rule').classList.add('on');
    await wait(1700); q('.c-sub').classList.add('on');
    await wait(1400); q('.c-brand').classList.add('up');
    let i = 0;
    const body = q('.c-body');
    const draw = () => { body.innerHTML = `<div class="c-art">${lineSvg(TOUR[i].k)}</div><div class="w-page"><h2>${TOUR[i].t}</h2><p>${TOUR[i].d}</p></div>`; };
    const go = async d => {
      if (i + d >= TOUR.length) return close();
      if (i + d < 0) return;
      body.classList.add('fade'); await wait(260);
      i += d; draw(); body.classList.remove('fade');
      el.querySelectorAll('.w-dots i').forEach((x, j) => x.classList.toggle('on', j === i));
      q('.c-back').hidden = i === 0;
      q('.c-btns .w-btn').textContent = i === TOUR.length - 1 ? 'Get started' : 'Continue';
    };
    draw();
    await wait(200); q('.c-panel').classList.add('on');
    q('.c-btns .w-btn').onclick = () => go(1);
    q('.c-back').onclick = () => go(-1);
    swiper(q('.c-panel'), go);
  }

  AOS.welcome = {
    designs: { A: 'Glass bloom', B: 'Constellation', C: 'Quiet type' },
    // Play a design now; resolves when it closes.
    play(design = 'A') {
      if (open) return open;
      open = new Promise(resolve => {
        const el = mount('d-' + design.toLowerCase()), close = closer(el, resolve);
        ({ A: playA, B: playB, C: playC }[design] || playA)(el, close);
      });
      return open;
    },
  };
})();
