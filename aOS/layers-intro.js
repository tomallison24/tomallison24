// Layers' intro, Skylight: when aOS opens in the Layers look (data-look="layers", set by look.js), a day goes by in a
// moment - a deep starry sky brightens into the time of day's own (sunrise, sea glass, dusk or night: the --ly-*
// colours of Layers' block, by data-tod) as the sun (the moon, after dusk) rises on an arc with its rays turning - then
// a pane of frosted glass springs up from the bottom, as the dock does on every page, a light sweeping across it, and
// the sixteen apps pop onto it row by row as Home's round buttons, in their groups' colours. "aOS" bounces in letter by
// letter with "Good morning", "Good afternoon" (from noon) or "Good evening" (from 6pm); then the glass settles and
// "aOS" glides up into the small "aOS" at the top of the page (.head .mark), so the intro hands over with nothing jumping. As Tide and Sunrise (glass-intro.js, vintage-intro.js): only aOS (the apps open inside it,
// straight to themselves), once a launch (sessionStorage aos.layers.shown), Skip ends it, a hard stop ends it whatever
// happens, and with Reduce Motion it's a short fade.
//
// The sound is made here (Web Audio): a warm chord breathing in, a whoosh of air as the glass springs up, a note
// climbing for each row of apps, and a sparkle as "aOS" lands. As with Tide, it plays only where the phone lets a page start sound before a tap. Account >
// Appearance > Skylight intro: Sound (the default), Silent, or Off (localStorage aos.layers.intro).
//
// Browser tests (navigator.webdriver) don't get the intro unless they pick Sound or Silent themselves: many open aOS
// in Layers, and it would cover every page they open for three seconds.
//
// Colours come from the page (Layers' --ly-* and --text, --muted on <html>), so they follow Light or Dark and the time of day.
//
// window.aosLayersIntro: { show({ force }) } (Account's "Play the intro" plays it again), greeting(), play().
'use strict';
(() => {
  const root = document.documentElement, KEY = 'aos.layers.intro', SHOWN = 'aos.layers.shown';
  const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const mode = () => { const m = stored(); return m === 'silent' || m === 'off' ? m : 'sound'; };
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const greeting = (d = new Date()) => d.getHours() < 12 ? 'Good morning' : d.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  // ---- the sound ----
  let ctx = null;
  const audio = () => { try { return ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)()); } catch { return null; } };
  function play() {
    const a = audio(); if (!a || a.state !== 'running') return false;
    const t = a.currentTime + 0.02, out = a.createGain(), comp = a.createDynamicsCompressor(), soft = a.createBiquadFilter();
    out.gain.value = 0.3; soft.type = 'lowpass'; soft.frequency.value = 2400; out.connect(soft); soft.connect(comp); comp.connect(a.destination);
    // the air: a chord (D, A, E, F#, a sky-open add9) breathing in slowly, each voice a sine and a quieter triangle an octave up
    for (const [fr, at] of [[146.83, 0], [220, 0.12], [329.63, 0.24], [369.99, 0.36]]) {
      for (const [type, k, peak] of [['sine', 1, 0.09], ['triangle', 2, 0.025]]) {
        const o = a.createOscillator(), e = a.createGain(); o.type = type; o.frequency.setValueAtTime(fr * k, t + at);
        e.gain.setValueAtTime(0.0001, t + at); e.gain.exponentialRampToValueAtTime(peak, t + at + 1.1); e.gain.exponentialRampToValueAtTime(0.0001, t + 3.1);
        o.connect(e); e.connect(out); o.start(t + at); o.stop(t + 3.2);
      }
    }
    // the whoosh: noise through a band that sweeps up as the glass rises
    const len = 0.9, buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = a.createBufferSource(), bp = a.createBiquadFilter(), w = a.createGain();
    n.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(260, t + 0.5); bp.frequency.exponentialRampToValueAtTime(2600, t + 1.1);
    w.gain.setValueAtTime(0.0001, t + 0.5); w.gain.exponentialRampToValueAtTime(0.09, t + 0.8); w.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
    n.connect(bp); bp.connect(w); w.connect(out); n.start(t + 0.5); n.stop(t + 0.5 + len);
    // the glass notes: one for each row of apps as it pops on, climbing, each with a faint bright partial; then a sparkle
    const note = (fr, at, p = 0.1, l = 1.2) => {
      for (const [k, q, ll] of [[1, p, l], [3.01, p * 0.25, l * 0.4]]) {
        const o = a.createOscillator(), e = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(fr * k, at);
        e.gain.setValueAtTime(0.0001, at); e.gain.exponentialRampToValueAtTime(q, at + 0.006); e.gain.exponentialRampToValueAtTime(0.0001, at + ll);
        o.connect(e); e.connect(out); o.start(at); o.stop(at + ll + 0.05);
      }
    };
    [587.33, 739.99, 880, 1174.66].forEach((fr, i) => note(fr, t + 1.15 + i * 0.16));
    [1760, 2217.46, 2637.02].forEach((fr, i) => note(fr, t + 1.9 + i * 0.05, 0.045, 1.6));
    return true;
  }

  // ---- the screen ----
  // The words are on a phone-shaped stage in the middle (sizes in cqw, its width), so on a wider screen they stay a
  // phone's picture; the sky and the glass reach to the edges.
  const CSS = `
#layersIntro{position:fixed;inset:0;z-index:2147483000;margin:0;border:0;padding:0;width:auto;height:auto;max-width:none;max-height:none;background:transparent;color:var(--text,#12161C);overflow:hidden;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",system-ui,sans-serif;-webkit-user-select:none;user-select:none;touch-action:manipulation;transition:opacity .5s ease}
#layersIntro{animation:liGone .4s 7s forwards}
#layersIntro::backdrop{background:transparent}
#layersIntro.out{opacity:0;pointer-events:none}
#layersIntro .li-sky{position:absolute;inset:0;background:radial-gradient(75% 45% at 8% 94%,var(--ly-g1,rgba(150,200,186,.6)),transparent 72%),radial-gradient(65% 40% at 96% 70%,var(--ly-g2,rgba(226,182,178,.5)),transparent 72%),var(--ly-plate,linear-gradient(150deg,#B9DCD2,#C6D1E7 40%,#EAD0CE 75%,#EEDFC4));
  background-color:var(--ly-top,#B9DCD2);transition:opacity .5s ease}   /* there from the first paint: it is the page's own sky */
#layersIntro.home .li-sky{opacity:0}
#layersIntro{--li-light:rgba(255,255,255,.55);--li-sun:#FFF6DF;--li-glow:rgba(255,226,170,.75);--li-orb-hi:#FFFFFF;--li-orb:#FDFDFE;--li-orb-edge:rgba(16,24,40,.08)}
@media (prefers-color-scheme:dark){html:not([data-theme="light"]) #layersIntro{--li-light:rgba(255,255,255,.16);--li-glow:rgba(255,214,150,.45);--li-orb-hi:#262C37;--li-orb:#1B2029;--li-orb-edge:rgba(255,255,255,.08)}}
html[data-theme="dark"] #layersIntro{--li-light:rgba(255,255,255,.16);--li-glow:rgba(255,214,150,.45);--li-orb-hi:#262C37;--li-orb:#1B2029;--li-orb-edge:rgba(255,255,255,.08)}
#layersIntro .li-dawn{position:absolute;inset:0;background:linear-gradient(170deg,#090D1E 0%,#141A38 55%,#2A2342 100%);animation:liDawn 1.15s .1s ease-in forwards}
#layersIntro[data-tod="night"] .li-dawn{animation-name:liDusk}
#layersIntro .li-stars{position:absolute;inset:0 0 40% 0;animation:liDawn 1.2s .25s ease-in forwards}
#layersIntro[data-tod="night"] .li-stars{animation:liTwinkle 1.6s ease-in-out infinite alternate}
#layersIntro .li-stars i{position:absolute;width:var(--s);height:var(--s);border-radius:50%;background:#fff;opacity:.85;box-shadow:0 0 6px rgba(255,255,255,.8)}
#layersIntro .li-light{position:absolute;right:-18vw;top:4%;width:78vw;height:78vw;border-radius:50%;background:radial-gradient(circle,var(--li-light),transparent 68%);animation:liRise 2.2s .15s cubic-bezier(.2,.8,.2,1) both}
#layersIntro .li-arc{position:absolute;left:8vw;top:64%;width:0;height:0;animation:liArcX 1.5s .1s cubic-bezier(.3,.1,.3,1) both}
#layersIntro .li-orbit{position:absolute;animation:liArcY 1.5s .1s cubic-bezier(.1,.7,.3,1) both}
#layersIntro .li-sun{position:absolute;left:-7vw;top:-7vw;width:14vw;height:14vw;max-width:72px;max-height:72px;border-radius:50%;background:radial-gradient(circle at 40% 38%,#fff,var(--li-sun) 60%);
  box-shadow:0 0 0 1.4vw rgba(255,240,205,.25),0 0 40px 12px var(--li-glow)}
#layersIntro[data-tod="evening"] .li-sun,#layersIntro[data-tod="night"] .li-sun{background:#F1F2F8;box-shadow:inset -3.2vw -1.2vw 0 0 rgba(160,170,210,.75),0 0 34px 8px rgba(200,210,255,.35)}
#layersIntro .li-rays{position:absolute;left:-36vw;top:-36vw;width:72vw;height:72vw;border-radius:50%;
  background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.22) 0 5deg,transparent 5deg 22deg);-webkit-mask:radial-gradient(circle,#000 18%,transparent 70%);mask:radial-gradient(circle,#000 18%,transparent 70%);
  animation:liRays 3.2s .5s linear both}
#layersIntro[data-tod="night"] .li-rays,#layersIntro[data-tod="evening"] .li-rays{opacity:.5}
#layersIntro .li-glass{position:absolute;left:0;right:0;bottom:0;height:52%;border-radius:32px 32px 0 0;overflow:hidden;background:var(--ly-veil,rgba(244,246,249,.82));-webkit-backdrop-filter:blur(24px) saturate(150%);backdrop-filter:blur(24px) saturate(150%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 -12px 30px -18px rgba(16,24,40,.35);animation:liSpring 1.05s .5s cubic-bezier(.3,1.35,.45,1) both;transition:transform .6s cubic-bezier(.6,0,.3,1),opacity .5s ease}
#layersIntro .li-glass::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.55) 48%,transparent 62%);transform:translateX(-120%);animation:liSheen 1.1s 1.05s ease-in-out forwards}
#layersIntro.home .li-glass{transform:translateY(30%);opacity:0}
#layersIntro .li-apps{position:absolute;left:50%;bottom:calc(6% + env(safe-area-inset-bottom));width:min(88vw,46vh);transform:translateX(-50%);display:grid;grid-template-columns:repeat(4,1fr);gap:3.2vw 0;justify-items:center;transition:opacity .35s ease}
#layersIntro.home .li-apps{opacity:0}
#layersIntro .li-apps i{display:grid;place-items:center;width:min(13vw,62px);aspect-ratio:1;border-radius:50%;color:var(--c);background:radial-gradient(circle at 50% 30%,var(--li-orb-hi),var(--li-orb) 70%);
  box-shadow:inset 0 0 0 1px var(--li-orb-edge),0 8px 16px -8px rgba(16,24,40,.45),inset 0 -.6vw 0 color-mix(in srgb,var(--c) 30%,transparent);
  animation:liPop .5s calc(1.12s + var(--n) * .045s) cubic-bezier(.3,1.6,.5,1) both}
#layersIntro .li-apps svg{width:44%;height:44%;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#layersIntro .li-front{position:absolute;top:0;bottom:0;left:50%;width:min(100vw,52vh);transform:translateX(-50%);container-type:inline-size;pointer-events:none}
#layersIntro .li-words{position:absolute;top:24%;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:3cqw}
#layersIntro .li-name{transform-origin:left center;font-size:24cqw;font-weight:800;letter-spacing:-.03em;line-height:1;white-space:nowrap;color:var(--text,#12161C);transition:transform .65s cubic-bezier(.6,0,.3,1),opacity .3s ease}
#layersIntro .li-name span{display:inline-block;animation:liBounce .7s calc(.95s + var(--n) * .09s) cubic-bezier(.3,1.7,.5,1) both}
#layersIntro .li-hi{font-size:4.4cqw;font-weight:600;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;color:var(--muted,rgba(18,22,28,.64));animation:liIn .5s 1.55s ease both;transition:opacity .25s}
#layersIntro.home .li-name{transform:var(--to,none)}
#layersIntro.home .li-name span{animation:none}
#layersIntro.home .li-hi,#layersIntro.home.lost .li-name{opacity:0}
#layersIntro.home .li-arc,#layersIntro.home .li-rays,#layersIntro.home .li-stars{opacity:0;transition:opacity .4s ease}
#layersIntro .li-skip{position:absolute;top:max(14px,env(safe-area-inset-top));right:16px;min-width:64px;height:44px;padding:0 14px;border:0;border-radius:22px;background:var(--ly-veil,rgba(255,255,255,.78));
  box-shadow:inset 0 0 0 1px rgba(127,127,127,.18);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:inherit;font:600 15px -apple-system,BlinkMacSystemFont,system-ui,sans-serif}
#layersIntro.home .li-skip{opacity:0;transition:opacity .2s}
@keyframes liFade{from{opacity:0}}
@keyframes liDawn{to{opacity:0}}
@keyframes liDusk{to{opacity:.35}}
@keyframes liTwinkle{to{opacity:.55}}
@keyframes liArcX{from{transform:translateX(0)}to{transform:translateX(70vw)}}
@keyframes liArcY{from{transform:translateY(0)}to{transform:translateY(-50vh)}}
@keyframes liRays{from{opacity:0;transform:rotate(0)}30%{opacity:1}to{opacity:.6;transform:rotate(40deg)}}
@keyframes liSpring{from{transform:translateY(100%)}}
@keyframes liSheen{to{transform:translateX(120%)}}
@keyframes liPop{from{opacity:0;transform:scale(.2) translateY(3vw)}}
@keyframes liBounce{from{opacity:0;transform:translateY(-14cqw) scale(.9)}}
@keyframes liRise{from{opacity:0;transform:translateY(16vh) scale(.85)}}
@keyframes liUp{from{transform:translateY(100%)}}
@keyframes liIn{from{opacity:0;transform:translateY(5cqw)}}
@keyframes liGone{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){#layersIntro .li-light,#layersIntro .li-glass,#layersIntro .li-front *,#layersIntro .li-apps i,#layersIntro .li-arc,#layersIntro .li-orbit{animation:liFade .5s .1s ease both}
  #layersIntro .li-dawn,#layersIntro .li-stars,#layersIntro .li-rays,#layersIntro .li-glass::after{display:none}
  #layersIntro .li-name{transition:opacity .3s ease}#layersIntro.home .li-name{transform:none;opacity:0}#layersIntro.home .li-glass{transform:none}}`;

  // Home's sixteen in its order, by group (Family, Every day, Out and about, You, Games), and each group's colour if the
  // page has none of its own yet
  const APPS = ['every', 'family', 'every', 'family', 'family', 'family', 'family', 'every', 'every', 'every', 'out', 'out', 'you', 'you', 'you', 'games'];
  // and their line drawings, as on Home's buttons (aOS/home-tab.js, GLYPH): Mail, Calendar, Weather, Home, Meals, Notes, Orders,
  // News, Clock, Podcasts, Travel, Places, Fitness, Drinks, Money, Sparkle Kingdom
  const GLYPHS = ['<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>', '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    '<path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 11.1 3.5 3.5 0 0 0 7 18z"/>', '<path d="M4 11l8-7 8 7v8.5a1.5 1.5 0 0 1-1.5 1.5H14v-6h-4v6H5.5A1.5 1.5 0 0 1 4 19.5z"/>',
    '<path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M9.5 8.5c0-1.5 1-2 1-3.5M13.5 8.5c0-1.5 1-2 1-3.5"/>', '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M9 11h6M9 15h6"/>',
    '<path d="M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5L12 11.5l8.5-4M12 11.5v9"/>', '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M7 9h10M7 12.5h10M7 16h6"/>',
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', '<rect x="9" y="3.5" width="6" height="10" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3"/>',
    '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5v-2A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2M3.5 13h17"/>', '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    '<path d="M3 12h4l2-5 4 10 2-5h6"/>', '<path d="M5 4.5h14L12 12zM12 12v7.5M8 19.5h8"/>', '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/>'];
  const TINT = { family: ['#2B7262', '#7FC6B4'], every: ['#3B5896', '#A3B6E0'], out: ['#9A5A52', '#E3A79F'], you: ['#806224', '#D9BE86'], games: ['#6B5B95', '#BBAEE0'] };   // light, dark
  const dark = () => root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  let el = null;
  function show({ force = false } = {}) {
    if (el) return;
    const m = mode();
    if (!force) {
      if (root.getAttribute('data-look') !== 'layers' || m === 'off' || window.top !== window) return;
      if (navigator.webdriver && !stored()) return;
      try { if (sessionStorage.getItem(SHOWN)) return; sessionStorage.setItem(SHOWN, '1'); } catch {}
    }
    const st = document.createElement('style'); st.id = 'layersIntroCss'; st.textContent = CSS; document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'layersIntro'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'aOS');
    el.dataset.tod = root.dataset.tod || 'afternoon';
    // the stars (scattered the same way each time), the apps in Home's order and their groups' colours (aOS/home-tab.js)
    const stars = Array.from({ length: 28 }, (_, i) => `<i style="left:${(i * 37.3) % 100}%;top:${(i * 53.7) % 100}%;--s:${1.2 + (i % 3) * 0.7}px"></i>`).join('');
    const apps = APPS.map((g, i) => `<i style="--c:${TINT[g][dark() ? 1 : 0]};--n:${i}"><svg viewBox="0 0 24 24">${GLYPHS[i]}</svg></i>`).join('');
    el.innerHTML = '<div class="li-sky" aria-hidden="true"></div><div class="li-dawn" aria-hidden="true"></div><div class="li-stars" aria-hidden="true">' + stars + '</div>'
      + '<b class="li-light" aria-hidden="true"></b><div class="li-arc" aria-hidden="true"><div class="li-orbit"><b class="li-rays"></b><b class="li-sun"></b></div></div>'
      + '<b class="li-glass" aria-hidden="true"></b><div class="li-apps" aria-hidden="true">' + apps + '</div>'
      + '<div class="li-front" aria-hidden="true"><div class="li-words"><div class="li-name" translate="no">' + [...'aOS'].map((c, i) => `<span style="--n:${i}">${c}</span>`).join('') + '</div><div class="li-hi"></div></div></div>'
      + '<button type="button" class="li-skip"></button>';
    el.querySelector('.li-hi').textContent = greeting();
    el.querySelector('.li-skip').textContent = 'Skip';
    root.appendChild(el);   // on <html>, so it covers aOS from its very first paint (the body may not be there yet)
    // played again from Account (a dialog): in the top layer, over it. Not as aOS opens (as tron-intro.js says).
    if (force) { el.setAttribute('popover', 'manual'); try { el.showPopover(); } catch {} }
    // Its way out comes first, before anything that could fail (as tron-intro.js): Skip, the clock, and a hard stop.
    let played = false; const end = performance.now() + (still() ? 1600 : 3200);
    const remove = (e, after) => setTimeout(() => { try { e.hidePopover(); } catch {} e.remove(); st.remove(); }, after);
    const close = () => { if (!el) return; const e = el; el = null; e.classList.add('out'); remove(e, 520); };
    // the end: the glass settles, and "aOS" glides up into the small "aOS" at the top of the page on show, then it's gone
    const home = () => {
      if (!el) return; const e = el; el = null;
      const name = e.querySelector('.li-name'), mark = !force && [...document.querySelectorAll('.tab:not([hidden]) .head .mark')].find(x => x.getBoundingClientRect().width > 0);
      // the mark is a whole-width block: its words' own box (a Range), and "aOS" scaled from its left edge onto them
      let d = null; if (mark) { const r = document.createRange(); r.selectNodeContents(mark); d = r.getBoundingClientRect(); }
      const s = name.getBoundingClientRect();
      if (d && d.width > 0 && d.bottom > 0 && d.top < innerHeight && s.width > 0) {
        const k = d.width / s.width;
        e.style.setProperty('--to', `translate(${(d.left - s.left).toFixed(1)}px, ${(d.top + d.height / 2 - (s.top + s.height / 2)).toFixed(1)}px) scale(${k.toFixed(3)})`);
      } else e.classList.add('lost');
      e.classList.add('home');
      setTimeout(() => e.classList.add('out'), 600);
      remove(e, 1150);
    };
    el.querySelector('.li-skip').addEventListener('click', close);
    const tick = () => { if (!el) return; if (performance.now() >= end) home(); else setTimeout(tick, 120); };
    setTimeout(tick, 400); setTimeout(close, 6000);
    // the sound, as tron-intro.js: only while the intro is up, and as aOS opens, only where the phone could start it
    const tapped = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    const tryPlay = () => { if (played || m !== 'sound' || !el) return; try { if (play()) { played = true; el.dataset.sound = 'playing'; } } catch {} };
    if (m === 'sound' && (force || tapped)) {
      try { const a = audio(); if (a) { if (a.state === 'running') tryPlay(); else a.resume().then(tryPlay, () => {}); } } catch {}
    }
  }
  window.aosLayersIntro = { show, greeting, play: () => { const a = audio(); if (a && a.state !== 'running') a.resume().then(play, () => {}); else play(); } };
  show();
})();
