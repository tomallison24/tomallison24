// AllisonOS welcome: a brand moment, then a short tour, the first time anyone
// opens an AllisonOS app on this device - once overall, not once per app.
//
// Every app loads it from the launcher's folder, as it does back.js:
//   <script src="../home/welcome.js" data-auto defer></script>
// With data-auto it plays by itself unless this device has seen it
// (localStorage aos.welcomed, which every app on the site shares); without,
// it only waits to be asked (welcome-lab.html, the launcher's Replay).
//
//   AllisonOS.welcome.play()     play it now
//   AllisonOS.welcome.seen()     has this device seen it
//
// The design is Quiet type (C, picked in the Welcome Lab): "AllisonOS" drawn
// on in soft pastels with a hairline beneath it, "Welcome" and "Part of the
// Allison Corporation" under that. Then each letter flips over into an app's
// icon (the tenth, Home, rises from the hairline), the icons glide into a
// grid and float up, and the tour is one glass panel under them whose words
// and line drawings change in place. Opened in a browser rather than from the
// Home Screen, the tour ends with how to install AllisonOS: on iPhone the
// Share menu's Add to Home Screen, step by step (Safari has no install prompt
// a page can call, so it can't be done for you); where the browser offers one
// (Chrome on Android, desktop Chrome and Edge), an Install button instead.
// Two cards are part of setting up: Appearance (System, Light or Dark - the
// launcher's own Appearance setting, home.settings.theme) and, last, every app
// with a link to open it, so each one wanted can be added on its own.
//
// Appearance applies everywhere this script is loaded: it sets data-theme on
// the page (as the launcher does), which the apps with forced-theme styles
// follow (the launcher, Calendar, Fitness, News, Notes, Podcasts, Travel);
// the others follow the phone. Skip ends it at any point. It
// follows light and dark mode, and is plain fades with Reduce Motion. All its
// styles are scoped to #aos-welcome.
//
// iPhone: an app added to the Home Screen on its own keeps its own storage, so
// it plays once in each of those; apps opened from the launcher share one.
(() => {
  'use strict';
  const AOS = window.AllisonOS = window.AllisonOS || {};
  const me = document.currentScript;
  const KEY = 'aos.welcomed';
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, still() ? Math.min(ms, 250) : ms));

  // ---- the tour: AllisonOS as a whole ----
  const TOUR = [
    { k: 'apps', t: 'Everything in one place', d: 'Mail, Calendar, News, Weather, Notes, Podcasts, Travel, Places, Fitness and Home, side by side.' },
    { k: 'swipe', t: 'Swipe up to come home', d: 'In an app opened from the AllisonOS home screen, swipe up from just above the bottom edge to come back to it. Press and hold the home screen for Settings.' },
    { k: 'updates', t: 'Always up to date', d: 'Updates are pushed automatically, so you always have the latest of everything at your fingertips.' },
    { k: 'theme', t: 'Light or dark', d: 'Follow your iPhone, or keep AllisonOS always light or always dark. You can change it later in Settings.' },
    { k: 'private', t: 'Yours alone', d: 'What you set up stays on this phone.' },
    { k: 'install', t: 'Install AllisonOS', d: '' },   // only when opened in a browser (see steps())
    { k: 'pick', t: 'Choose your apps', d: 'Open any app and add it to your Home Screen on its own, or add the AllisonOS home screen to have them all behind one icon.' },
  ];
  const ABOUT = {
    mail: ['Mail', 'Gmail, sorted and tidied'], calendar: ['Calendar', 'The family calendar'], news: ['News', 'Headlines by topic'],
    weather: ['Weather', 'Forecast, radar and alerts'], notes: ['Notes', 'Notes and reminders'], podcasts: ['Podcasts', 'Up Next and your shows'],
    travel: ['Travel', 'Flights, hotels and cars'], places: ['Places', 'Where to go, where you\'ve been'], fitness: ['Fitness', 'A simple workout log'],
    house: ['Home', 'Home Assistant: the house'],
  };
  // ---- Appearance: the launcher's own setting, shared by every app on the site ----
  const THEMES = [['auto', 'System'], ['light', 'Light'], ['dark', 'Dark']];
  const readTheme = () => { try { const t = (JSON.parse(localStorage.getItem('home.settings')) || {}).theme; return ['light', 'dark'].includes(t) ? t : 'auto'; } catch { return 'auto'; } };
  function applyTheme(t) {
    const root = document.documentElement;
    if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  }
  function setTheme(t) {
    try { const s = JSON.parse(localStorage.getItem('home.settings')) || {}; s.theme = t; localStorage.setItem('home.settings', JSON.stringify(s)); } catch {}
    applyTheme(t);
    dispatchEvent(new CustomEvent('aos:theme', { detail: t }));   // the launcher, if this is it, updates its Settings
  }
  applyTheme(readTheme());   // every app, every time
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Chrome and Edge offer their own install prompt; keep it for the Install button.
  let installEvt = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  // The install card's body: the button, or the steps for an iPhone or iPad.
  function steps() {
    if (installEvt) return '<p>Add AllisonOS to this device, so it opens on its own like any other app.</p><button class="w-btn c-install" type="button">Install</button>';
    if (!ios) return '<p>Use your browser\'s <b>Install</b> or <b>Add to Home Screen</b> option, in its menu, to keep AllisonOS on this device like an app.</p>';
    return `<p>Add it to your Home Screen so it opens like an app, full screen:</p><ol class="c-steps">
      <li>In Safari, tap <b>•••</b> by the address bar, then <b>Share</b> <small>(on older iOS, tap Share <svg class="c-share" viewBox="0 0 16 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7H3.5v9.5h9V7H11M8 11.5V1.5M5 4.5l3-3 3 3"/></svg> straight away)</small></li>
      <li>Scroll down and tap <b>Add to Home Screen</b></li>
      <li>Leave <b>Open as Web App</b> on</li>
      <li>Tap <b>Add</b></li></ol>
      <p class="c-tip">Do it from the AllisonOS home screen and every app opens from that one icon. Chrome, Edge and Firefox have Add to Home Screen in their Share menu too.</p>`;
  }
  const LINE = {
    apps: '<rect x="8" y="8" width="18" height="18" rx="5"/><rect x="38" y="8" width="18" height="18" rx="5"/><rect x="8" y="38" width="18" height="18" rx="5"/><rect x="38" y="38" width="18" height="18" rx="5"/>',
    swipe: '<rect x="18" y="4" width="28" height="56" rx="7"/><path d="M26 52h12"/><path d="M32 40V18M24 26l8-8 8 8"/>',
    updates: '<path d="M50 30a18 18 0 0 1-31 13"/><path d="M14 34a18 18 0 0 1 31-13"/><path d="M45 11v10H35"/><path d="M19 53V43h10"/>',
    pick: '<rect x="8" y="8" width="18" height="18" rx="5"/><rect x="38" y="8" width="18" height="18" rx="5"/><rect x="8" y="38" width="18" height="18" rx="5"/><path d="M47 38v18M38 47h18"/>',
    install: '<rect x="12" y="12" width="40" height="40" rx="11"/><path d="M32 23v18M23 32h18"/>',
    theme: '<circle cx="32" cy="32" r="22"/><path d="M32 10a22 22 0 0 1 0 44z" fill="currentColor"/>',
    private: '<rect x="14" y="28" width="36" height="28" rx="6"/><path d="M22 28v-8a10 10 0 0 1 20 0v8"/><circle cx="32" cy="42" r="3" fill="currentColor"/>',
  };
  const APPS = ['mail', 'calendar', 'news', 'weather', 'notes', 'podcasts', 'travel', 'places', 'fitness', 'house'];
  const icon = id => new URL(`../${id}/icon-512.png`, (me && me.src) || location.href).href;
  const lineSvg = k => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LINE[k]}</svg>`;

  const CSS = `
#aos-welcome { position: fixed; inset: 0; z-index: 2147483000; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; -webkit-font-smoothing: antialiased;
  --w-bg: #0F1116; --w-text: #fff; --w-muted: rgba(235,235,245,.62); --w-glass: rgba(255,255,255,.08); --w-edge: rgba(255,255,255,.18); --w-dot: rgba(255,255,255,.28);
  /* the pastels: sky, lilac, rose, peach, mint */
  --w-pastel: linear-gradient(100deg, #9CC8FF 0%, #C3B1FF 26%, #FFB8CF 50%, #FFD2A8 74%, #A6EAD3 100%);
  background: var(--w-bg); color: var(--w-text); opacity: 0; transition: opacity .5s; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) #aos-welcome { --w-bg: #F2F4F8; --w-text: #0B0B0F; --w-muted: rgba(60,60,67,.62); --w-glass: rgba(255,255,255,.62); --w-edge: rgba(255,255,255,.9); --w-dot: rgba(0,0,0,.16);
  --w-pastel: linear-gradient(100deg, #6EA8F2 0%, #9C86EC 26%, #EC86AA 50%, #EDA766 74%, #5FC6A6 100%); } }
html[data-theme="light"] #aos-welcome { --w-bg: #F2F4F8; --w-text: #0B0B0F; --w-muted: rgba(60,60,67,.62); --w-glass: rgba(255,255,255,.62); --w-edge: rgba(255,255,255,.9); --w-dot: rgba(0,0,0,.16);
  --w-pastel: linear-gradient(100deg, #6EA8F2 0%, #9C86EC 26%, #EC86AA 50%, #EDA766 74%, #5FC6A6 100%); }
html[data-theme="dark"] #aos-welcome { --w-bg: #0F1116; --w-text: #fff; --w-muted: rgba(235,235,245,.62); --w-glass: rgba(255,255,255,.08); --w-edge: rgba(255,255,255,.18); --w-dot: rgba(255,255,255,.28);
  --w-pastel: linear-gradient(100deg, #9CC8FF 0%, #C3B1FF 26%, #FFB8CF 50%, #FFD2A8 74%, #A6EAD3 100%); }
#aos-welcome.in { opacity: 1; }
#aos-welcome.out { opacity: 0; transition: opacity .6s; }
#aos-welcome * { box-sizing: border-box; }
#aos-welcome button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
#aos-welcome .w-skip { position: absolute; top: calc(env(safe-area-inset-top) + 14px); right: 18px; z-index: 5; font-size: 15px; font-weight: 600; color: var(--w-muted); padding: 8px 10px; }
#aos-welcome .w-stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
#aos-welcome .c-brand { display: flex; flex-direction: column; align-items: center; }
/* the name: pastel ink, drawn on left to right, its colours drifting very slowly */
#aos-welcome .c-word { display: flex; font-size: 46px; font-weight: 700; letter-spacing: -1px; line-height: 1.15; padding: 0 2px; perspective: 600px;
  clip-path: inset(0 100% 0 0); transition: clip-path 1.6s cubic-bezier(.65,0,.35,1); }
#aos-welcome .c-word.on { clip-path: inset(-20px -20px -20px -20px); }
/* each letter carries its own slice of one gradient across the word (set from its position) */
#aos-welcome .c-word span { display: inline-block; background: var(--w-pastel); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent;
  transition: transform .5s cubic-bezier(.5,0,.75,0), opacity .5s; }
#aos-welcome .c-word span.flip { transform: rotateY(90deg) scale(.7); opacity: 0; }
#aos-welcome .c-fade { transition: opacity .45s !important; transition-delay: 0s !important; opacity: 0 !important; }
/* the icons the letters become */
#aos-welcome .c-fly { position: absolute; inset: 0; pointer-events: none; perspective: 700px; }
#aos-welcome .c-fly img { position: absolute; border-radius: 24%; box-shadow: 0 6px 18px rgba(0,0,0,.22); opacity: 0; transform: rotateY(-90deg) scale(.7);
  transition: transform .55s cubic-bezier(.25,1,.5,1), opacity .4s, left .9s cubic-bezier(.2,.8,.2,1), top .9s cubic-bezier(.2,.8,.2,1), width .9s cubic-bezier(.2,.8,.2,1), height .9s cubic-bezier(.2,.8,.2,1); }
#aos-welcome .c-fly img.on { opacity: 1; transform: none; }
#aos-welcome .c-fly { transition: opacity .4s; }
#aos-welcome.tall .c-fly { opacity: 0; }   /* the install steps and the app list need the room */
#aos-welcome .c-rule { height: 1.5px; width: 0; border-radius: 1px; background: var(--w-pastel); opacity: .8; margin-top: 14px; transition: width 1.4s cubic-bezier(.65,0,.35,1) .5s; }
#aos-welcome .c-rule.on { width: 220px; }
#aos-welcome .c-sub { margin-top: 14px; font-size: 17px; font-weight: 500; opacity: 0; transition: opacity .8s; }
#aos-welcome .c-corp { margin-top: 6px; font-size: 13px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--w-muted); opacity: 0; transition: opacity .8s .35s; }
#aos-welcome .c-sub.on, #aos-welcome .c-corp.on { opacity: 1; }
#aos-welcome .c-panel { position: absolute; left: 16px; right: 16px; bottom: calc(env(safe-area-inset-bottom) + 16px); max-width: 520px; margin: 0 auto; border-radius: 34px; padding: 28px 24px 22px; text-align: center;
  background: var(--w-glass); -webkit-backdrop-filter: blur(30px) saturate(180%); backdrop-filter: blur(30px) saturate(180%);
  box-shadow: inset 0 0 0 .5px var(--w-edge), 0 24px 60px -16px rgba(0,0,0,.3); opacity: 0; transform: translateY(24px); transition: opacity .6s, transform .7s cubic-bezier(.2,.8,.2,1); touch-action: pan-y; }
#aos-welcome .c-panel.on { opacity: 1; transform: none; }
#aos-welcome .c-body { transition: opacity .3s; }
#aos-welcome .c-body.fade { opacity: 0; }
#aos-welcome .c-art svg { width: 64px; height: 64px; display: block; margin: 0 auto 16px; }
#aos-welcome .c-art path, #aos-welcome .c-art rect, #aos-welcome .c-art circle { stroke-dasharray: 260; stroke-dashoffset: 260; animation: c-draw 1.4s cubic-bezier(.65,0,.35,1) forwards; }
@keyframes c-draw { to { stroke-dashoffset: 0; } }
#aos-welcome h2 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.4px; }
#aos-welcome p { margin: 8px 0 0; font-size: 16px; line-height: 1.4; color: var(--w-muted); }
#aos-welcome .c-steps { text-align: left; margin: 14px 0 0; padding: 0; list-style: none; counter-reset: s; }
#aos-welcome .c-steps li { position: relative; padding: 0 0 10px 36px; font-size: 15px; line-height: 1.35; counter-increment: s; }
#aos-welcome .c-steps li::before { content: counter(s); position: absolute; left: 0; top: -1px; width: 24px; height: 24px; border-radius: 50%; background: var(--w-dot); font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
#aos-welcome .c-steps small { color: var(--w-muted); font-size: 13px; }
#aos-welcome .c-share { display: inline-block; width: 12px; height: 14px; vertical-align: -2px; }
#aos-welcome .c-tip { font-size: 13px !important; margin-top: 4px !important; }
#aos-welcome .c-seg { display: flex; margin: 16px auto 0; max-width: 300px; padding: 3px; border-radius: 999px; background: var(--w-dot); }
#aos-welcome .c-seg button { flex: 1; height: 36px; border-radius: 999px; font-size: 15px; font-weight: 600; transition: background .25s, color .25s, box-shadow .25s; }
#aos-welcome .c-seg button[aria-pressed="true"] { background: var(--w-bg); box-shadow: 0 2px 8px rgba(0,0,0,.18), inset 0 0 0 .5px var(--w-edge); }
#aos-welcome .c-apps { margin: 12px -6px 0; max-height: min(44vh, 360px); overflow-y: auto; -webkit-overflow-scrolling: touch; text-align: left; }
#aos-welcome .c-app { display: flex; align-items: center; gap: 12px; padding: 7px 6px; border-radius: 14px; color: inherit; text-decoration: none; }
#aos-welcome .c-app:active { background: var(--w-dot); }
#aos-welcome .c-app img { width: 40px; height: 40px; border-radius: 10px; flex: none; }
#aos-welcome .c-app span { flex: 1; min-width: 0; }
#aos-welcome .c-app b { display: block; font-size: 16px; }
#aos-welcome .c-app small { display: block; font-size: 13px; color: var(--w-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#aos-welcome .c-app em { flex: none; font-style: normal; font-size: 14px; font-weight: 600; color: #0A84FF; }
#aos-welcome .c-install { display: block; width: 100%; margin-top: 16px; }
#aos-welcome .w-dots { display: flex; justify-content: center; gap: 7px; margin: 18px 0; }
#aos-welcome .w-dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--w-dot); transition: background .3s, width .3s; }
#aos-welcome .w-dots i.on { background: var(--w-text); width: 18px; border-radius: 4px; }
#aos-welcome .c-btns { display: flex; gap: 10px; }
#aos-welcome .w-btn { flex: 1; height: 52px; border-radius: 999px; font-size: 17px; font-weight: 600; color: #fff !important; background: #0A84FF !important; box-shadow: inset 0 0 0 1px rgba(255,255,255,.25), inset 0 1px 1px rgba(255,255,255,.5); }
#aos-welcome .c-back { flex: 0 0 52px; height: 52px; border-radius: 50%; background: var(--w-dot) !important; font-size: 22px; }
#aos-welcome .c-back[hidden] { display: none; }
@media (prefers-reduced-motion: reduce) {
  #aos-welcome *, #aos-welcome *::before, #aos-welcome *::after { animation: none !important; transition-duration: .2s !important; transition-delay: 0s !important; }
  #aos-welcome .c-art path, #aos-welcome .c-art rect, #aos-welcome .c-art circle { stroke-dashoffset: 0; }
}`;

  // A drag sideways on the panel turns the page: past a fifth of its width, or a quick flick.
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

  let open = null;
  function play() {
    if (open) return open;
    open = new Promise(resolve => {
      if (!document.getElementById('aos-welcome-css')) {
        const st = document.createElement('style'); st.id = 'aos-welcome-css'; st.textContent = CSS; document.head.appendChild(st);
      }
      const el = document.createElement('div');
      el.id = 'aos-welcome'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Welcome to AllisonOS');
      el.innerHTML = `<button class="w-skip" type="button">Skip</button>
        <div class="w-stage"><div class="c-brand">
          <div class="c-word">${[...'AllisonOS'].map(c => `<span>${c}</span>`).join('')}</div><div class="c-rule"></div>
          <div class="c-sub">Welcome</div><div class="c-corp">Part of the Allison Corporation</div></div></div>
        <div class="c-fly"></div>
        <div class="c-panel"><div class="c-body"></div><div class="w-dots">${TOUR.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
          <div class="c-btns"><button class="c-back" type="button" aria-label="Back" hidden>‹</button><button class="w-btn" type="button">Continue</button></div></div>`;
      document.body.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
      let done = false;
      const close = () => {
        if (done) return; done = true;
        try { localStorage.setItem(KEY, String(Date.now())); } catch {}
        el.classList.add('out');
        setTimeout(() => { el.remove(); open = null; resolve(); }, 650);
      };
      el.querySelector('.w-skip').onclick = close;
      run(el, close);
    });
    return open;
  }

  // Give each letter its slice of the one gradient, so the word reads as a single sweep.
  function paintLetters(word) {
    const W = word.getBoundingClientRect(), spans = [...word.children];
    for (const sp of spans) {
      const b = sp.getBoundingClientRect();
      sp.style.backgroundSize = `${W.width}px 100%`;
      sp.style.backgroundPosition = `${-(b.left - W.left)}px 0`;
    }
  }

  // Each letter flips over into an app's icon, the tenth rising from the hairline;
  // the row of icons then glides up into a 5 x 2 grid above the tour.
  async function lettersToApps(el) {
    const q = s => el.querySelector(s), fly = q('.c-fly'), box = el.getBoundingClientRect();
    const spans = [...q('.c-word').children], rule = q('.c-rule').getBoundingClientRect(), W = q('.c-word').getBoundingClientRect();
    const imgs = APPS.map(id => { const im = new Image(); im.src = icon(id); im.alt = ''; fly.appendChild(im); return im; });
    const at = (im, x, y, size) => { im.style.width = im.style.height = size + 'px'; im.style.left = (x - size / 2 - box.left) + 'px'; im.style.top = (y - size / 2 - box.top) + 'px'; };
    // evenly along the word, letter-sized, so the narrow letters don't pile up
    const step = W.width / spans.length, sz = Math.min(30, step - 3);
    spans.forEach((sp, k) => at(imgs[k], W.left + step * (k + 0.5), W.top + W.height / 2, sz));
    at(imgs[9], rule.left + rule.width / 2, rule.top, sz);
    for (const c of ['.c-rule', '.c-sub', '.c-corp']) q(c).classList.add('c-fade');
    if (still()) { spans.forEach(sp => sp.classList.add('flip')); imgs.forEach(im => im.classList.add('on')); }
    else for (let k = 0; k < spans.length; k++) {                  // left to right, one after another
      spans[k].classList.add('flip');
      setTimeout(() => imgs[k].classList.add('on'), 230);
      await wait(75);
    }
    await wait(650); imgs[9].classList.add('on');
    // the grid, where the word was
    const S = Math.min(56, (box.width - 32 - 4 * 14) / 5), G = 14, cols = 5;
    const grid = (cy) => imgs.forEach((im, k) => {
      const c = k % cols, rw = Math.floor(k / cols);
      at(im, box.left + box.width / 2 + (c - 2) * (S + G), cy + (rw - 0.5) * (S + G), S);
    });
    await wait(700); grid(box.top + Math.max(110, box.height * 0.2) + 20);   // and up, to sit above the tour
    await wait(500);
  }

  async function run(el, close) {
    const q = s => el.querySelector(s);
    paintLetters(q('.c-word'));
    APPS.forEach(id => { new Image().src = icon(id); });           // warm the icons up for the change
    await wait(300); q('.c-word').classList.add('on'); q('.c-rule').classList.add('on');
    await wait(1700); q('.c-sub').classList.add('on'); q('.c-corp').classList.add('on');
    await wait(1800); await lettersToApps(el);
    let i = 0;
    const T = TOUR.filter(t => t.k !== 'install' || !standalone());     // installed already: no install card
    el.querySelector('.w-dots').innerHTML = T.map((_, j) => `<i class="${j ? '' : 'on'}"></i>`).join('');
    const body = q('.c-body');
    const draw = () => {
      const t = T[i];
      el.classList.toggle('tall', t.k === 'install' || t.k === 'pick');
      const extra = t.k === 'theme' ? `<div class="c-seg" role="group" aria-label="Appearance">${THEMES.map(([v, n]) => `<button type="button" data-t="${v}" aria-pressed="${v === readTheme()}">${n}</button>`).join('')}</div>`
        : t.k === 'pick' ? `<div class="c-apps">${APPS.map(a => `<a class="c-app" href="${new URL(`../${a}/`, (me && me.src) || location.href).href}" target="_blank" rel="noopener"><img src="${icon(a)}" alt=""><span><b>${ABOUT[a][0]}</b><small>${ABOUT[a][1]}</small></span><em>Open</em></a>`).join('')}</div>` : '';
      body.innerHTML = `${t.k === 'apps' || t.k === 'pick' ? '' : `<div class="c-art">${lineSvg(t.k)}</div>`}<h2>${t.t}</h2>${t.k === 'install' ? steps() : `<p>${t.d}</p>`}${extra}`;   // the apps card has the real icons above it
      for (const b of body.querySelectorAll('.c-seg button')) b.onclick = () => { setTheme(b.dataset.t); body.querySelectorAll('.c-seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
      const b = body.querySelector('.c-install');
      if (b) b.onclick = async () => { const e = installEvt; installEvt = null; try { await e.prompt(); await e.userChoice; } catch {} draw(); };
    };
    const go = async d => {
      if (i + d >= T.length) return close();
      if (i + d < 0) return;
      body.classList.add('fade'); await wait(260);
      i += d; draw(); body.classList.remove('fade');
      el.querySelectorAll('.w-dots i').forEach((x, j) => x.classList.toggle('on', j === i));
      q('.c-back').hidden = i === 0;
      q('.c-btns .w-btn').textContent = i === T.length - 1 ? 'Get started' : 'Continue';
    };
    draw();
    await wait(200); q('.c-panel').classList.add('on');
    q('.c-btns .w-btn').onclick = () => go(1);
    q('.c-back').onclick = () => go(-1);
    swiper(q('.c-panel'), go);
  }

  const seen = () => { try { return !!localStorage.getItem(KEY); } catch { return true; } };   // no storage: never nag
  AOS.welcome = { play, seen };
  if (me && me.hasAttribute('data-auto') && !seen()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', play, { once: true }); else play();
  }
})();
