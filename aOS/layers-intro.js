// Layers' intro, Skylight: when aOS opens in the Layers look (data-look="layers", set by look.js), the sky comes up -
// the time of day's own (sunrise, sea glass, dusk or night: the --ly-* colours of Layers' block, by data-tod), a soft
// light rising in it - then a pane of frosted glass slides up from the bottom, as the dock does on every page, and
// "aOS" comes up over the sky with "Good morning", "Good afternoon" (from noon) or "Good evening" (from 6pm); then the
// glass settles and "aOS" glides up into the small "aOS" at the top of the page (.head .mark), so the intro hands over
// with nothing jumping. As Tide and Sunrise (glass-intro.js, vintage-intro.js): only aOS (the apps open inside it,
// straight to themselves), once a launch (sessionStorage aos.layers.shown), Skip ends it, a hard stop ends it whatever
// happens, and with Reduce Motion it's a short fade.
//
// The sound is made here (Web Audio): a warm chord breathing in, the air of a still morning, under a few glass notes as
// the pane lands. As with Tide, it plays only where the phone lets a page start sound before a tap. Account >
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
    // the glass: three soft notes as the pane lands, each with a faint bright partial
    const note = (fr, at) => {
      for (const [k, p, l] of [[1, 0.1, 1.4], [3.01, 0.025, 0.5]]) {
        const o = a.createOscillator(), e = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(fr * k, at);
        e.gain.setValueAtTime(0.0001, at); e.gain.exponentialRampToValueAtTime(p, at + 0.006); e.gain.exponentialRampToValueAtTime(0.0001, at + l);
        o.connect(e); e.connect(out); o.start(at); o.stop(at + l + 0.05);
      }
    };
    [880, 1108.73, 1318.51].forEach((fr, i) => note(fr, t + 0.95 + i * 0.14));
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
#layersIntro{--li-light:rgba(255,255,255,.55)}
@media (prefers-color-scheme:dark){html:not([data-theme="light"]) #layersIntro{--li-light:rgba(255,255,255,.16)}}
html[data-theme="dark"] #layersIntro{--li-light:rgba(255,255,255,.16)}
#layersIntro .li-light{position:absolute;right:-18vw;top:4%;width:78vw;height:78vw;border-radius:50%;background:radial-gradient(circle,var(--li-light),transparent 68%);animation:liRise 2.2s .15s cubic-bezier(.2,.8,.2,1) both}
#layersIntro .li-glass{position:absolute;left:0;right:0;bottom:0;height:52%;border-radius:32px 32px 0 0;background:var(--ly-veil,rgba(244,246,249,.82));-webkit-backdrop-filter:blur(24px) saturate(150%);backdrop-filter:blur(24px) saturate(150%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 -12px 30px -18px rgba(16,24,40,.35);animation:liUp 1s .55s cubic-bezier(.2,.85,.25,1) both;transition:transform .6s cubic-bezier(.6,0,.3,1),opacity .5s ease}
#layersIntro.home .li-glass{transform:translateY(30%);opacity:0}
#layersIntro .li-front{position:absolute;top:0;bottom:0;left:50%;width:min(100vw,52vh);transform:translateX(-50%);container-type:inline-size;pointer-events:none}
#layersIntro .li-words{position:absolute;top:24%;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:3cqw}
#layersIntro .li-name{transform-origin:left center;font-size:24cqw;font-weight:800;letter-spacing:-.03em;line-height:1;white-space:nowrap;color:var(--text,#12161C);
  animation:liIn .8s .95s cubic-bezier(.2,.8,.2,1) both;transition:transform .65s cubic-bezier(.6,0,.3,1),opacity .3s ease}
#layersIntro .li-hi{font-size:4.4cqw;font-weight:600;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;color:var(--muted,rgba(18,22,28,.64));animation:liIn .5s 1.45s ease both;transition:opacity .25s}
#layersIntro.home .li-name{animation:none;transform:var(--to,none)}
#layersIntro.home .li-hi,#layersIntro.home.lost .li-name{opacity:0}
#layersIntro .li-skip{position:absolute;top:max(14px,env(safe-area-inset-top));right:16px;min-width:64px;height:44px;padding:0 14px;border:0;border-radius:22px;background:var(--ly-veil,rgba(255,255,255,.78));
  box-shadow:inset 0 0 0 1px rgba(127,127,127,.18);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:inherit;font:600 15px -apple-system,BlinkMacSystemFont,system-ui,sans-serif}
#layersIntro.home .li-skip{opacity:0;transition:opacity .2s}
@keyframes liFade{from{opacity:0}}
@keyframes liRise{from{opacity:0;transform:translateY(16vh) scale(.85)}}
@keyframes liUp{from{transform:translateY(100%)}}
@keyframes liIn{from{opacity:0;transform:translateY(5cqw)}}
@keyframes liGone{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){#layersIntro .li-light,#layersIntro .li-glass,#layersIntro .li-front *{animation:liFade .5s .1s ease both}
  #layersIntro .li-name{transition:opacity .3s ease}#layersIntro.home .li-name{transform:none;opacity:0}#layersIntro.home .li-glass{transform:none}}`;

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
    el.innerHTML = '<div class="li-sky" aria-hidden="true"></div><b class="li-light" aria-hidden="true"></b><b class="li-glass" aria-hidden="true"></b>'
      + '<div class="li-front" aria-hidden="true"><div class="li-words"><div class="li-name" translate="no">aOS</div><div class="li-hi"></div></div></div>'
      + '<button type="button" class="li-skip"></button>';
    el.querySelector('.li-hi').textContent = greeting();
    el.querySelector('.li-skip').textContent = 'Skip';
    root.appendChild(el);   // on <html>, so it covers aOS from its very first paint (the body may not be there yet)
    // played again from Account (a dialog): in the top layer, over it. Not as aOS opens (as tron-intro.js says).
    if (force) { el.setAttribute('popover', 'manual'); try { el.showPopover(); } catch {} }
    // Its way out comes first, before anything that could fail (as tron-intro.js): Skip, the clock, and a hard stop.
    let played = false; const end = performance.now() + (still() ? 1600 : 3000);
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
