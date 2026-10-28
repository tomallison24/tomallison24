// Sea glass's intro, Tide: when aOS opens in the Sea glass look (data-look="glass", set by look.js), the tide comes in -
// three waves in the sea glass colours (sea glass, mist, shell) roll up over the sand, five frosted pieces of sea
// glass wash in and settle, and "aOS" comes up in the pastel with its bar and "Good morning", "Good afternoon" (from
// noon) or "Good evening" (from 6pm) - then the water fades and "aOS" glides up into the small "aOS" at the top of the
// page (.head .mark), so the intro hands over with nothing jumping. Like Sunrise (vintage-intro.js): only aOS (the
// apps open inside it, straight to themselves), once a launch (sessionStorage aos.glass.shown), Skip ends it, a hard
// stop ends it whatever happens, and with Reduce Motion it's a short fade.
//
// The sound is made here (Web Audio): a wave washing in (soft filtered noise) under glass chimes going up. As with
// Sunrise, it plays only where the phone lets a page start sound before a tap. Account > Appearance > Tide intro:
// Sound (the default), Silent, or Off (localStorage aos.glass.intro = 'sound' | 'silent' | 'off').
//
// Browser tests (navigator.webdriver) don't get the intro unless they pick Sound or Silent themselves: many open aOS
// in Sea glass, and it would cover every page they open for three seconds.
//
// Colours come from the page (--bg, --pastel, --muted on <html>), so they follow Light or Dark.
//
// window.aosGlassIntro: { show({ force }) } (Account's "Play the intro" plays it again), greeting(), play().
'use strict';
(() => {
  const root = document.documentElement, KEY = 'aos.glass.intro', SHOWN = 'aos.glass.shown';
  const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const mode = () => { const m = stored(); return m === 'silent' || m === 'off' ? m : 'sound'; };
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const greeting = (d = new Date()) => d.getHours() < 12 ? 'Good morning' : d.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  // ---- the sound ----
  let ctx = null;
  const audio = () => { try { return ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)()); } catch { return null; } };
  function play() {
    const a = audio(); if (!a || a.state !== 'running') return false;
    const t = a.currentTime + 0.02, out = a.createGain(), comp = a.createDynamicsCompressor();
    out.gain.value = 0.3; out.connect(comp); comp.connect(a.destination);
    // the wave: two seconds of noise through a low filter that opens as it washes in and closes as it pulls back
    const len = 2.4, buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    n.buffer = buf; f.type = 'lowpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.9); f.frequency.exponentialRampToValueAtTime(400, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + len);
    // the glass: chimes up a pentatonic, each with a bright inharmonic partial, as the pieces settle
    const chime = (fr, at, peak) => {
      for (const [k, p, l] of [[1, peak, 1.6], [2.76, peak * 0.35, 0.6]]) {
        const o = a.createOscillator(), e = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(fr * k, at);
        e.gain.setValueAtTime(0.0001, at); e.gain.exponentialRampToValueAtTime(p, at + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, at + l);
        o.connect(e); e.connect(out); o.start(at); o.stop(at + l + 0.05);
      }
    };
    [587.33, 739.99, 880, 1108.73, 1318.51].forEach((fr, i) => chime(fr, t + 0.55 + i * 0.16, 0.13));
    return true;
  }

  // ---- the screen ----
  // The words are on a phone-shaped stage in the middle (sizes in cqw, its width), so on a wider screen they stay a
  // phone's picture; the water and the sand reach to the edges.
  const WAVE = '<svg viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30 Q100 0 200 30 T400 30 T600 30 T800 30 V60 H0Z"/></svg>';
  const CSS = `
#glassIntro{--w1:rgba(169,211,199,.75);--w2:rgba(185,198,224,.7);--w3:rgba(227,197,195,.7);--sandc:#EDE2CC;--pe:rgba(255,255,255,.55);
  position:fixed;inset:0;z-index:2147483000;margin:0;border:0;padding:0;width:auto;height:auto;max-width:none;max-height:none;background:transparent;color:var(--text,#10181A);overflow:hidden;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Inter",system-ui,sans-serif;-webkit-user-select:none;user-select:none;touch-action:manipulation;transition:opacity .5s ease}
#glassIntro{animation:giGone .4s 7s forwards}
#glassIntro::backdrop{background:transparent}
@media (prefers-color-scheme:dark){html:not([data-theme="light"]) #glassIntro{--w1:rgba(59,115,102,.7);--w2:rgba(78,95,134,.65);--w3:rgba(126,90,88,.6);--sandc:#2A2620;--pe:rgba(255,255,255,.18)}}
html[data-theme="dark"] #glassIntro{--w1:rgba(59,115,102,.7);--w2:rgba(78,95,134,.65);--w3:rgba(126,90,88,.6);--sandc:#2A2620;--pe:rgba(255,255,255,.18)}
#glassIntro.out{opacity:0;pointer-events:none}
#glassIntro .gi-scene{position:absolute;inset:0;background:var(--bg,#EEF2F0);transition:opacity .5s ease}
#glassIntro.home .gi-scene{opacity:0}
#glassIntro .gi-orb{position:absolute;border-radius:50%;filter:blur(30px);opacity:.55;animation:giFade 1.2s ease both,giDrift 9s ease-in-out infinite alternate}
#glassIntro .gi-orb:nth-child(1){left:-18vw;top:6%;width:70vw;height:70vw;background:#A9D3C7}
#glassIntro .gi-orb:nth-child(2){right:-22vw;top:20%;width:64vw;height:64vw;background:#B9C6E0;animation-delay:.15s,-3s}
#glassIntro .gi-orb:nth-child(3){left:20vw;top:-12%;width:50vw;height:50vw;background:#E3C5C3;opacity:.4;animation-delay:.3s,-6s}
#glassIntro .gi-sand{position:absolute;left:0;right:0;bottom:0;height:20%;background:var(--sandc);animation:giFade .6s ease both}
#glassIntro .gi-sea{position:absolute;left:0;right:0;bottom:12%;height:34%}
#glassIntro .gi-wave{position:absolute;left:0;right:0;bottom:0;overflow:hidden;animation:giIn 1.1s cubic-bezier(.2,.8,.2,1) both}
#glassIntro .gi-wave svg{display:block;width:200%;height:100%;animation:giRoll 6s linear infinite}
#glassIntro .gi-wave:nth-child(1){height:100%;animation-delay:.05s}#glassIntro .gi-wave:nth-child(1) svg{fill:var(--w2);animation-duration:9s;animation-direction:reverse}
#glassIntro .gi-wave:nth-child(2){height:78%;animation-delay:.18s}#glassIntro .gi-wave:nth-child(2) svg{fill:var(--w3);animation-duration:7s}
#glassIntro .gi-wave:nth-child(3){height:56%;animation-delay:.3s}#glassIntro .gi-wave:nth-child(3) svg{fill:var(--w1);animation-duration:5s;animation-direction:reverse}
#glassIntro .gi-stage{position:absolute;top:0;bottom:0;left:50%;width:min(100vw,52vh);transform:translateX(-50%);container-type:inline-size;pointer-events:none}
#glassIntro .gi-stage>*{position:absolute;display:block}
#glassIntro .gi-peb{bottom:6%;border-radius:58% 42% 55% 45%/50% 60% 40% 50%;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);
  box-shadow:inset 0 0 0 1px var(--pe),inset 2cqw 2cqw 3cqw rgba(255,255,255,.35),0 1.5cqw 3cqw rgba(16,24,26,.12);animation:giWash .9s cubic-bezier(.2,.9,.3,1.15) both,giBob 2.6s ease-in-out infinite alternate}
#glassIntro .gi-peb:nth-child(1){left:8cqw;width:15cqw;height:10cqw;background:linear-gradient(135deg,rgba(255,255,255,.6),rgba(111,165,151,.85));animation-delay:.55s,1.5s}
#glassIntro .gi-peb:nth-child(2){left:28cqw;bottom:4%;width:10cqw;height:8cqw;background:linear-gradient(135deg,rgba(255,255,255,.6),rgba(129,147,188,.85));animation-delay:.68s,1.7s;border-radius:45% 55% 40% 60%/60% 45% 55% 40%}
#glassIntro .gi-peb:nth-child(3){left:44cqw;bottom:7%;width:13cqw;height:9cqw;background:linear-gradient(135deg,rgba(255,255,255,.6),rgba(190,145,143,.85));animation-delay:.8s,1.6s}
#glassIntro .gi-peb:nth-child(4){left:63cqw;bottom:4.5%;width:9cqw;height:7cqw;background:linear-gradient(135deg,rgba(255,255,255,.6),rgba(188,156,104,.85));animation-delay:.92s,1.9s;border-radius:50% 50% 42% 58%/55% 50% 50% 45%}
#glassIntro .gi-peb:nth-child(5){left:77cqw;bottom:6.5%;width:14cqw;height:9.5cqw;background:linear-gradient(135deg,rgba(255,255,255,.6),rgba(111,165,151,.7));animation-delay:1.04s,1.8s}
#glassIntro .gi-front{position:absolute;top:0;bottom:0;left:50%;width:min(100vw,52vh);transform:translateX(-50%);container-type:inline-size;pointer-events:none}
#glassIntro .gi-words{position:absolute;top:30%;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:4cqw}
#glassIntro .gi-name{transform-origin:left center;font-size:24cqw;font-weight:800;letter-spacing:-.03em;line-height:1;white-space:nowrap;background:var(--pastel);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;
  animation:giUp .7s 1.15s cubic-bezier(.2,.8,.2,1) both;transition:transform .65s cubic-bezier(.6,0,.3,1),opacity .3s ease}
#glassIntro .gi-bar{width:16cqw;height:1.6cqw;border-radius:1cqw;background:var(--pastel);transform-origin:left;animation:giWipe .4s 1.55s ease-out both;transition:opacity .25s}
#glassIntro .gi-hi{font-size:4.4cqw;font-weight:600;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;color:var(--muted,rgba(16,24,26,.64));animation:giUp .5s 1.8s ease both;transition:opacity .25s}
#glassIntro.home .gi-name{animation:none;transform:var(--to,none)}
#glassIntro.home .gi-bar,#glassIntro.home .gi-hi,#glassIntro.home.lost .gi-name{opacity:0}
#glassIntro .gi-skip{position:absolute;top:max(14px,env(safe-area-inset-top));right:16px;min-width:64px;height:44px;padding:0 14px;border:0;border-radius:22px;background:var(--card,rgba(255,255,255,.78));
  box-shadow:inset 0 0 0 1px var(--edge,rgba(16,24,26,.08));-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:inherit;font:600 15px -apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif}
#glassIntro.home .gi-skip{opacity:0;transition:opacity .2s}
@keyframes giIn{from{transform:translateY(110%)}}
@keyframes giRoll{to{transform:translateX(-50%)}}
@keyframes giWash{from{opacity:0;transform:translate(-14cqw,18cqw) rotate(-35deg)}}
@keyframes giBob{to{transform:translateY(-.8cqw) rotate(2deg)}}
@keyframes giDrift{to{transform:translate(6vw,3vh) scale(1.08)}}
@keyframes giFade{from{opacity:0}}
@keyframes giUp{from{opacity:0;transform:translateY(6cqw)}} @keyframes giWipe{from{transform:scaleX(0)}}
@keyframes giGone{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){#glassIntro .gi-scene *,#glassIntro .gi-front *{animation:giFade .5s .1s ease both}
  #glassIntro .gi-name{transition:opacity .3s ease}#glassIntro.home .gi-name{transform:none;opacity:0}}`;

  let el = null;
  function show({ force = false } = {}) {
    if (el) return;
    const m = mode();
    if (!force) {
      if (root.getAttribute('data-look') !== 'glass' || m === 'off' || window.top !== window) return;
      if (navigator.webdriver && !stored()) return;
      try { if (sessionStorage.getItem(SHOWN)) return; sessionStorage.setItem(SHOWN, '1'); } catch {}
    }
    const st = document.createElement('style'); st.id = 'glassIntroCss'; st.textContent = CSS; document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'glassIntro'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'aOS');
    el.innerHTML = '<div class="gi-scene" aria-hidden="true"><b class="gi-orb"></b><b class="gi-orb"></b><b class="gi-orb"></b><b class="gi-sand"></b>'
      + `<div class="gi-sea"><div class="gi-wave">${WAVE}</div><div class="gi-wave">${WAVE}</div><div class="gi-wave">${WAVE}</div></div>`
      + '<div class="gi-stage"><b class="gi-peb"></b><b class="gi-peb"></b><b class="gi-peb"></b><b class="gi-peb"></b><b class="gi-peb"></b></div></div>'
      + '<div class="gi-front" aria-hidden="true"><div class="gi-words"><div class="gi-name" translate="no">aOS</div><b class="gi-bar"></b><div class="gi-hi"></div></div></div>'
      + '<button type="button" class="gi-skip"></button>';
    el.querySelector('.gi-hi').textContent = greeting();
    el.querySelector('.gi-skip').textContent = 'Skip';
    root.appendChild(el);   // on <html>, so it covers aOS from its very first paint (the body may not be there yet)
    // played again from Account (a dialog): in the top layer, over it. Not as aOS opens (as tron-intro.js says).
    if (force) { el.setAttribute('popover', 'manual'); try { el.showPopover(); } catch {} }
    // Its way out comes first, before anything that could fail (as tron-intro.js): Skip, the clock, and a hard stop.
    let played = false; const end = performance.now() + (still() ? 1600 : 3000);
    const remove = (e, after) => setTimeout(() => { try { e.hidePopover(); } catch {} e.remove(); st.remove(); }, after);
    const close = () => { if (!el) return; const e = el; el = null; e.classList.add('out'); remove(e, 520); };
    // the end: the water fades, and "aOS" glides up into the small "aOS" at the top of the page on show, then it's gone
    const home = () => {
      if (!el) return; const e = el; el = null;
      const name = e.querySelector('.gi-name'), mark = !force && [...document.querySelectorAll('.tab:not([hidden]) .head .mark')].find(x => x.getBoundingClientRect().width > 0);
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
    el.querySelector('.gi-skip').addEventListener('click', close);
    const tick = () => { if (!el) return; if (performance.now() >= end) home(); else setTimeout(tick, 120); };
    setTimeout(tick, 400); setTimeout(close, 6000);
    // the sound, as tron-intro.js: only while the intro is up, and as aOS opens, only where the phone could start it
    const tapped = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    const tryPlay = () => { if (played || m !== 'sound' || !el) return; try { if (play()) { played = true; el.dataset.sound = 'playing'; } } catch {} };
    if (m === 'sound' && (force || tapped)) {
      try { const a = audio(); if (a) { if (a.state === 'running') tryPlay(); else a.resume().then(tryPlay, () => {}); } } catch {}
    }
  }
  window.aosGlassIntro = { show, greeting, play: () => { const a = audio(); if (a && a.state !== 'running') a.resume().then(play, () => {}); else play(); } };
  show();
})();
