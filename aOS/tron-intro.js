// Tron's intro, as the car's Tron mode greets you: when aOS opens in the Tron look (data-look="grid", set by
// look.js just before this), a short screen - a Light Cycle streaks across a red grid, "aOS" lights up in
// Orbitron, "Greetings, programs." - with its own sound, then it fades into aOS. Only aOS: the apps open
// inside it, straight to themselves. Once a launch (sessionStorage aos.tron.shown), not on every reload.
//
// The sound is made here (Web Audio): a low swell, the cycle's whoosh, a hit as the name locks in, a quick
// rising arpeggio and a chord, played as the intro starts, with nothing to tap (a phone that won't let a page
// start sound by itself, before any tap, shows the intro without it). Account > Appearance > Tron intro: Sound
// (the default), Silent, or Off (localStorage aos.tron.intro = 'sound' | 'silent' | 'off'). Skip ends it.
// With Reduce Motion it's a short fade, no streak or flicker.
//
// window.aosTronIntro: { show({ force }) } (Account's "Play" plays it again), play() the sound on its own.
'use strict';
(() => {
  const root = document.documentElement, KEY = 'aos.tron.intro', SHOWN = 'aos.tron.shown';
  const mode = () => { try { const m = localStorage.getItem(KEY); return m === 'silent' || m === 'off' ? m : 'sound'; } catch { return 'sound'; } };
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = s => (window.aosLang ? aosLang.t(s) : s);

  // ---- the sound ----
  let ctx = null;
  const audio = () => { try { return ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)()); } catch { return null; } };
  function play() {
    const a = audio(); if (!a || a.state !== 'running') return false;
    const t = a.currentTime + 0.02, out = a.createGain(), comp = a.createDynamicsCompressor();
    out.gain.value = 0.22; out.connect(comp); comp.connect(a.destination);
    const env = (g, at, peak, rise, fall) => { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + rise); g.gain.exponentialRampToValueAtTime(0.0001, at + rise + fall); };
    const osc = (type, f, at, len, peak, rise, to) => {
      const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, at);
      if (to) o.frequency.exponentialRampToValueAtTime(to, at + len);
      env(g, at, peak, rise, len - rise); o.connect(g); g.connect(to === undefined ? lp : out); o.start(at); o.stop(at + len + 0.05); return o;
    };
    // a low swell, opening up
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(140, t); lp.frequency.exponentialRampToValueAtTime(1400, t + 1.3); lp.connect(out);
    for (const f of [55, 55.7, 110.3]) osc('sawtooth', f, t, 2.5, 0.35, 0.7);
    // the Light Cycle going by: noise through a sweeping band
    const len = 1.1, buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = a.createBufferSource(), bp = a.createBiquadFilter(), ng = a.createGain();
    n.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(300, t + 0.25); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.95);
    env(ng, t + 0.25, 0.7, 0.45, 0.6); n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t + 0.25); n.stop(t + 0.25 + len);
    // the hit, as the name locks in
    osc('sine', 95, t + 1.0, 0.7, 1.2, 0.01, 38);
    // a quick arpeggio up (D minor), then the chord
    [293.66, 349.23, 440, 587.33].forEach((f, i) => osc('square', f, t + 1.05 + i * 0.085, 0.22, 0.12, 0.005));
    for (const f of [146.83, 220, 349.23, 293.66 * 1.003]) osc('sawtooth', f, t + 1.4, 1.5, 0.08, 0.12);
    return true;
  }

  // ---- the screen ----
  const CSS = `
#tronIntro{position:fixed;inset:0;z-index:2147483000;margin:0;border:0;padding:0;width:auto;height:auto;max-width:none;max-height:none;background:#030304;color:#F1F3F5;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;
  font-family:"Exo 2","Avenir Next",system-ui,sans-serif;transition:opacity .5s ease;-webkit-user-select:none;user-select:none;touch-action:manipulation}
#tronIntro.out{opacity:0;pointer-events:none}
#tronIntro::backdrop{background:transparent}
#tronIntro .ti-floor{position:absolute;left:-60%;right:-60%;bottom:0;height:46%;transform-origin:bottom;transform:perspective(220px) rotateX(58deg);
  background:linear-gradient(90deg,rgba(255,42,42,.55) 1.5px,transparent 1.5px) 50% 0/46px 100%,linear-gradient(rgba(255,42,42,.55) 1.5px,transparent 1.5px) 0 0/100% 30px;
  -webkit-mask-image:linear-gradient(transparent,#000 35%);mask-image:linear-gradient(transparent,#000 35%);animation:tiFloor 2.4s cubic-bezier(.2,.7,.2,1) both}
#tronIntro .ti-road{position:absolute;left:0;right:0;top:61%;height:3px}
#tronIntro .ti-trail{position:absolute;left:0;top:0;height:3px;width:100%;transform-origin:left;transform:scaleX(0);
  background:linear-gradient(90deg,transparent,rgba(255,42,42,.45) 35%,#FF2A2A 85%,#FFD9D9);box-shadow:0 0 12px #FF2A2A,0 0 26px rgba(255,42,42,.6);animation:tiTrail .9s .25s cubic-bezier(.5,0,.2,1) forwards,tiFade .6s 1.5s ease forwards}
#tronIntro .ti-cycle{position:absolute;top:-9px;left:0;width:34px;height:20px;border-radius:10px;background:#0B0B0D;box-shadow:inset 0 0 0 2.5px #FF2A2A,0 0 14px #FF2A2A;
  transform:translateX(-60px);animation:tiCycle .9s .25s cubic-bezier(.5,0,.2,1) forwards}
#tronIntro .ti-name{position:relative;font:700 74px/1 Orbitron,"Exo 2",system-ui,sans-serif;letter-spacing:.06em;color:#FF2A2A;opacity:0;
  text-shadow:0 0 10px #FF2A2A,0 0 30px rgba(255,42,42,.7);animation:tiName 1s .95s steps(1,end) forwards;margin-top:-6vh}
#tronIntro .ti-line{width:0;height:2px;margin-top:16px;background:#FF2A2A;box-shadow:0 0 10px #FF2A2A;animation:tiLine .5s 1.2s ease-out forwards}
#tronIntro .ti-hi{margin-top:14px;font-size:14px;letter-spacing:.18em;text-transform:uppercase;color:#A3A8B0;opacity:0;animation:tiIn .5s 1.4s ease forwards}
#tronIntro .ti-skip{position:absolute;top:max(14px,env(safe-area-inset-top));right:16px;min-width:64px;height:44px;padding:0 14px;border:0;border-radius:22px;background:rgba(255,255,255,.08);color:#C9CDD2;font:600 15px "Exo 2",system-ui,sans-serif}
@keyframes tiFloor{from{transform:perspective(220px) rotateX(84deg) translateY(30%);opacity:0}to{transform:perspective(220px) rotateX(58deg);opacity:1}}
@keyframes tiTrail{to{transform:scaleX(1)}} @keyframes tiFade{to{opacity:.25}}
@keyframes tiCycle{to{transform:translateX(calc(100vw + 40px))}}
@keyframes tiName{0%{opacity:0}12%{opacity:1}20%{opacity:.2}30%{opacity:1}38%{opacity:.5}46%,100%{opacity:1}}
@keyframes tiLine{to{width:min(220px,60vw)}} @keyframes tiIn{to{opacity:1}}
@media (prefers-reduced-motion:reduce){#tronIntro .ti-floor,#tronIntro .ti-trail,#tronIntro .ti-cycle{animation:none}#tronIntro .ti-cycle,#tronIntro .ti-trail{display:none}
  #tronIntro .ti-name{animation:tiIn .5s .1s ease forwards}#tronIntro .ti-line{animation:tiLine .01s .3s forwards}#tronIntro .ti-hi{animation:tiIn .5s .3s ease forwards}}`;

  let el = null;
  function show({ force = false } = {}) {
    if (el) return;
    const m = mode();
    if (!force) {
      if (root.getAttribute('data-look') !== 'grid' || m === 'off' || window.top !== window) return;
      try { if (sessionStorage.getItem(SHOWN)) return; sessionStorage.setItem(SHOWN, '1'); } catch {}
    }
    const st = document.createElement('style'); st.id = 'tronIntroCss'; st.textContent = CSS; document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'tronIntro'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'aOS');
    el.innerHTML = '<div class="ti-floor" aria-hidden="true"></div><div class="ti-road" aria-hidden="true"><div class="ti-trail"></div><div class="ti-cycle"></div></div>'
      + '<div class="ti-name" translate="no">aOS</div><div class="ti-line" aria-hidden="true"></div><div class="ti-hi"></div>'
      + '<button type="button" class="ti-skip"></button>';
    el.querySelector('.ti-hi').textContent = T('Greetings, programs.');
    el.querySelector('.ti-skip').textContent = T('Skip');
    el.setAttribute('popover', 'manual');
    root.appendChild(el);   // on <html>, so it covers aOS from its very first paint (the body may not be there yet)
    try { el.showPopover(); } catch {}   // and in the top layer, over Account (a dialog) when it's played again from there
    let played = false, end = performance.now() + (still() ? 1600 : 2700);
    const tryPlay = () => { if (played || m !== 'sound') return; if (play()) { played = true; el.dataset.sound = 'playing'; end = Math.max(end, performance.now() + 1900); } };
    if (m === 'sound') {
      const a = audio();
      if (a) { if (a.state === 'running') tryPlay(); else a.resume().then(tryPlay, () => {}); }
    }
    const close = () => { if (!el) return; const e = el; el = null; e.classList.add('out'); setTimeout(() => { try { e.hidePopover(); } catch {} e.remove(); st.remove(); }, 520); };
    el.querySelector('.ti-skip').addEventListener('click', close);
    const tick = () => { if (!el) return; if (performance.now() >= end) close(); else setTimeout(tick, 120); };
    setTimeout(tick, 400);
  }
  window.aosTronIntro = { show, play: () => { const a = audio(); if (a && a.state !== 'running') a.resume().then(play, () => {}); else play(); } };
  show();
})();
