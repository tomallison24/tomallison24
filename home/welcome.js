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
// Allison Corporation" under that; then the tour is one glass panel whose
// words and line drawings change in place. Skip ends it at any point. It
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
    { k: 'theme', t: 'Looks like your phone', d: 'Light and dark follow your iPhone, with Liquid Glass throughout.' },
    { k: 'private', t: 'Yours alone', d: 'What you set up stays on this phone.' },
  ];
  const LINE = {
    apps: '<rect x="8" y="8" width="18" height="18" rx="5"/><rect x="38" y="8" width="18" height="18" rx="5"/><rect x="8" y="38" width="18" height="18" rx="5"/><rect x="38" y="38" width="18" height="18" rx="5"/>',
    swipe: '<rect x="18" y="4" width="28" height="56" rx="7"/><path d="M26 52h12"/><path d="M32 40V18M24 26l8-8 8 8"/>',
    theme: '<circle cx="32" cy="32" r="22"/><path d="M32 10a22 22 0 0 1 0 44z" fill="currentColor"/>',
    private: '<rect x="14" y="28" width="36" height="28" rx="6"/><path d="M22 28v-8a10 10 0 0 1 20 0v8"/><circle cx="32" cy="42" r="3" fill="currentColor"/>',
  };
  const lineSvg = k => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LINE[k]}</svg>`;

  const CSS = `
#aos-welcome { position: fixed; inset: 0; z-index: 2147483000; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; -webkit-font-smoothing: antialiased;
  --w-bg: #0F1116; --w-text: #fff; --w-muted: rgba(235,235,245,.62); --w-glass: rgba(255,255,255,.08); --w-edge: rgba(255,255,255,.18); --w-dot: rgba(255,255,255,.28);
  /* the pastels: sky, lilac, rose, peach, mint */
  --w-pastel: linear-gradient(100deg, #9CC8FF 0%, #C3B1FF 26%, #FFB8CF 50%, #FFD2A8 74%, #A6EAD3 100%);
  background: var(--w-bg); color: var(--w-text); opacity: 0; transition: opacity .5s; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
@media (prefers-color-scheme: light) { #aos-welcome { --w-bg: #F2F4F8; --w-text: #0B0B0F; --w-muted: rgba(60,60,67,.62); --w-glass: rgba(255,255,255,.62); --w-edge: rgba(255,255,255,.9); --w-dot: rgba(0,0,0,.16);
  --w-pastel: linear-gradient(100deg, #6EA8F2 0%, #9C86EC 26%, #EC86AA 50%, #EDA766 74%, #5FC6A6 100%); } }
#aos-welcome.in { opacity: 1; }
#aos-welcome.out { opacity: 0; transition: opacity .6s; }
#aos-welcome * { box-sizing: border-box; }
#aos-welcome button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
#aos-welcome .w-skip { position: absolute; top: calc(env(safe-area-inset-top) + 14px); right: 18px; z-index: 5; font-size: 15px; font-weight: 600; color: var(--w-muted); padding: 8px 10px; }
#aos-welcome .w-stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
#aos-welcome .c-brand { display: flex; flex-direction: column; align-items: center; transition: transform .9s cubic-bezier(.2,.8,.2,1); }
#aos-welcome .c-brand.up { transform: translateY(-26vh); }
/* the name: pastel ink, drawn on left to right, its colours drifting very slowly */
#aos-welcome .c-word { font-size: 46px; font-weight: 700; letter-spacing: -1px; line-height: 1.15; padding: 0 2px;
  background: var(--w-pastel); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent;
  clip-path: inset(0 100% 0 0); transition: clip-path 1.6s cubic-bezier(.65,0,.35,1); animation: c-drift 9s ease-in-out infinite alternate; }
#aos-welcome .c-word.on { clip-path: inset(0 -4px 0 0); }
@keyframes c-drift { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }
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
          <div class="c-word">AllisonOS</div><div class="c-rule"></div>
          <div class="c-sub">Welcome</div><div class="c-corp">Part of the Allison Corporation</div></div></div>
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

  async function run(el, close) {
    const q = s => el.querySelector(s);
    await wait(300); q('.c-word').classList.add('on'); q('.c-rule').classList.add('on');
    await wait(1700); q('.c-sub').classList.add('on'); q('.c-corp').classList.add('on');
    await wait(1800); q('.c-brand').classList.add('up');
    let i = 0;
    const body = q('.c-body');
    const draw = () => { body.innerHTML = `<div class="c-art">${lineSvg(TOUR[i].k)}</div><h2>${TOUR[i].t}</h2><p>${TOUR[i].d}</p>`; };
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

  const seen = () => { try { return !!localStorage.getItem(KEY); } catch { return true; } };   // no storage: never nag
  AOS.welcome = { play, seen };
  if (me && me.hasAttribute('data-auto') && !seen()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', play, { once: true }); else play();
  }
})();
