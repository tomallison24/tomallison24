// Vintage's intro, Sunrise: when aOS opens in the Vintage look (data-look="vintage", set by look.js), the Vintage
// sky comes up over two flat hills - the sun (the moon and stars after sunset, home/sky.js's day and night) rises,
// "aOS" and the three bars come up on the teal hill with "Good morning", "Good afternoon" (from noon) or "Good
// evening" (after sunset) - then the hills fade and the sun glides up into the disc at the top of aOS (.atoms), so
// the intro hands over to the page with nothing jumping. Like Tron's (tron-intro.js): only aOS (the apps open inside
// it, straight to themselves), once a launch (sessionStorage aos.vintage.shown), Skip ends it, a hard stop ends it
// whatever happens, and with Reduce Motion it's a short fade.
//
// The sound is made here (Web Audio): a soft vibraphone arpeggio over a warm low note; at night, lower, with two high
// twinkles. As with Tron's, it plays only where the phone lets a page start sound before a tap (an iPhone opening
// aOS doesn't, so it isn't tried there). Account > Appearance > Sunrise intro: Sound (the default), Silent, or Off
// (localStorage aos.vintage.intro = 'sound' | 'silent' | 'off').
//
// Vintage is the look aOS opens in, so browser tests (navigator.webdriver) don't get the intro unless they pick
// Sound or Silent themselves: otherwise it would cover every page they open for three seconds.
//
// Colours come from the sky (--sky-ground, --sky-disc on <html>, set by sky.js just before this), so they follow Light
// or Dark even when welcome.js sets your choice a moment after the intro is up.
//
// window.aosVintageIntro: { show({ force }) } (Account's "Play the intro" plays it again), greeting(), play().
'use strict';
(() => {
  const root = document.documentElement, KEY = 'aos.vintage.intro', SHOWN = 'aos.vintage.shown';
  const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const mode = () => { const m = stored(); return m === 'silent' || m === 'off' ? m : 'sound'; };
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const night = () => root.getAttribute('data-sky') === 'night';
  // morning until noon (a night sky before dawn too), then afternoon until sunset, then evening
  const greeting = (d = new Date()) => d.getHours() < 12 ? 'Good morning' : night() ? 'Good evening' : 'Good afternoon';

  // ---- the sound ----
  let ctx = null;
  const audio = () => { try { return ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)()); } catch { return null; } };
  function play() {
    const a = audio(); if (!a || a.state !== 'running') return false;
    const t = a.currentTime + 0.02, out = a.createGain(), comp = a.createDynamicsCompressor(), dark = night();
    out.gain.value = 0.3; out.connect(comp); comp.connect(a.destination);
    const note = (type, f, at, len, peak, rise, trem) => {
      const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, at);
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + rise); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      if (trem) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = trem; lg.gain.value = peak * 0.35; l.connect(lg); lg.connect(g.gain); l.start(at); l.stop(at + len); }
      o.connect(g); g.connect(out); o.start(at); o.stop(at + len + 0.05);
    };
    // the vibraphone, up a major chord (by day) or a minor one (at night), each note with a slow tremolo
    const notes = dark ? [220, 261.63, 329.63, 440] : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => note('sine', f, t + 0.3 + i * 0.19, 1.8, 0.22, 0.006, 5.5));
    // a warm low note under it, swelling as the sun comes up
    note('triangle', notes[0] / 2, t + 0.1, 2.6, 0.12, 0.6);
    // the stars
    if (dark) [2093, 2637].forEach((f, i) => note('sine', f, t + 1.5 + i * 0.35, 0.5, 0.06, 0.005));
    return true;
  }

  // ---- the screen ----
  // The scene is a phone-shaped stage in the middle (sizes in cqw, its width), so on a wider screen it stays a
  // phone's picture; the hills reach to the edges.
  const CSS = `
#vintageIntro{--vg:var(--sky-ground,#F4ECDD);--vd:var(--sky-disc,#E3A72F);--hill:#1F6F6B;--hill2:#4A3426;--dot:#1F6F6B;--ink:#2B2522;
  position:fixed;inset:0;z-index:2147483000;margin:0;border:0;padding:0;width:auto;height:auto;max-width:none;max-height:none;background:transparent;color:var(--ink);overflow:hidden;
  font-family:"Futura","Futura-Medium","Avenir Next","Jost",system-ui,sans-serif;-webkit-user-select:none;user-select:none;touch-action:manipulation;transition:opacity .5s ease}
#vintageIntro{animation:viGone .4s 7s forwards}
#vintageIntro::backdrop{background:transparent}
html[data-sky-tone="dark"] #vintageIntro{--hill2:#B8452B;--dot:#4FB3AB;--ink:#F4ECDD}
html[data-sky="night"] #vintageIntro{--hill:#18504D;--hill2:#4A3426}
html[data-sky="night"][data-sky-tone="dark"] #vintageIntro{--hill:#133431}
#vintageIntro.out{opacity:0;pointer-events:none}
#vintageIntro .vi-scene{position:absolute;inset:0;background:var(--vg);transition:opacity .5s ease}
#vintageIntro.home .vi-scene{opacity:0}
#vintageIntro .vi-stage{position:absolute;top:0;bottom:0;left:50%;width:min(100vw,52vh);transform:translateX(-50%);container-type:inline-size}
#vintageIntro .vi-stage>*{position:absolute;display:block}
#vintageIntro .vi-hill2{top:52%;left:calc(-40cqw - 50vw);width:calc(120cqw + 50vw);height:120cqw;border-radius:50%;background:var(--hill2);animation:viRise 1s .05s cubic-bezier(.2,.8,.2,1) both}
#vintageIntro .vi-hill{top:57.4%;left:calc(-20cqw - 50vw);width:calc(170cqw + 100vw);height:140cqw;border-radius:50%;background:var(--hill);animation:viRise 1s cubic-bezier(.2,.8,.2,1) both}
#vintageIntro .vi-rays{top:calc(37.5% - 40cqw);left:10cqw;width:80cqw;height:80cqw;border-radius:50%;
  background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--vd) 55%,transparent) 0deg 7deg,transparent 7deg 22.5deg);
  -webkit-mask:radial-gradient(circle,transparent 0 34%,#000 35% 70%,transparent 71%);mask:radial-gradient(circle,transparent 0 34%,#000 35% 70%,transparent 71%);
  animation:viFade .6s 1s ease both,viSpin 14s 1s linear infinite}
html[data-sky="night"] #vintageIntro .vi-rays{display:none}
#vintageIntro .vi-dot{top:calc(37.5% - 5cqw);left:74cqw;width:11cqw;height:11cqw;border-radius:50%;background:var(--dot);animation:viPop .5s 1.05s cubic-bezier(.3,1.6,.5,1) both}
#vintageIntro .vi-pill{top:calc(37.5% - 15cqw);left:4cqw;width:22cqw;height:6.4cqw;border-radius:4cqw;background:#D8572A;transform:rotate(-18deg);animation:viPopR .5s 1.2s cubic-bezier(.3,1.6,.5,1) both}
#vintageIntro .vi-stars{inset:0;display:none}
html[data-sky="night"] #vintageIntro .vi-stars{display:block}
#vintageIntro .vi-stars i{position:absolute;width:1.6cqw;height:1.6cqw;border-radius:50%;background:#1F6F6B;animation:viTwinkle 1.4s ease-in-out infinite alternate both}
html[data-sky-tone="dark"] #vintageIntro .vi-stars i{background:#F4ECDD}
#vintageIntro .vi-stars i:nth-child(1){left:14%;top:14%}#vintageIntro .vi-stars i:nth-child(2){left:82%;top:20%;animation-delay:.5s}#vintageIntro .vi-stars i:nth-child(3){left:64%;top:10%;animation-delay:.9s}
#vintageIntro .vi-stars i:nth-child(4){left:22%;top:45%;animation-delay:.5s}#vintageIntro .vi-stars i:nth-child(5){left:88%;top:44%}#vintageIntro .vi-stars i:nth-child(6){left:40%;top:17%;width:1.1cqw;height:1.1cqw;animation-delay:.9s}
#vintageIntro .vi-words{top:64%;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:4cqw;color:#FFF8EC}
#vintageIntro .vi-name{font-size:21cqw;font-weight:600;letter-spacing:-.04em;line-height:1;white-space:nowrap;animation:viUp .6s 1.3s cubic-bezier(.2,.8,.2,1) both}
#vintageIntro .vi-bars{display:flex;gap:1.8cqw}
#vintageIntro .vi-bars i{display:block;height:2cqw;border-radius:1cqw;transform-origin:left;animation:viWipe .35s 1.65s ease-out both}
#vintageIntro .vi-bars i:nth-child(1){width:10cqw;background:#FFF8EC}#vintageIntro .vi-bars i:nth-child(2){width:5cqw;background:#E3A72F;animation-delay:1.75s}#vintageIntro .vi-bars i:nth-child(3){width:3cqw;background:#D8572A;animation-delay:1.85s}
#vintageIntro .vi-hi{font-size:4.4cqw;font-weight:500;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;opacity:.92;animation:viUp .5s 1.95s ease both}
#vintageIntro .vi-sun{position:absolute;left:50%;top:37.5%;width:calc(.46 * min(100vw,52vh));height:calc(.46 * min(100vw,52vh));margin:calc(-.23 * min(100vw,52vh)) 0 0 calc(-.23 * min(100vw,52vh));
  border-radius:50%;background:var(--vd);animation:viSunUp 1.1s .25s cubic-bezier(.2,.9,.25,1.05) both;transition:transform .65s cubic-bezier(.6,0,.3,1),opacity .3s ease}
#vintageIntro.home .vi-sun{animation:none;transform:var(--to,none)}
#vintageIntro.home.lost .vi-sun{opacity:0}
#vintageIntro .vi-skip{position:absolute;top:max(14px,env(safe-area-inset-top));right:16px;min-width:64px;height:44px;padding:0 14px;border:0;border-radius:22px;background:rgba(43,37,34,.09);color:var(--ink);font:600 15px "Futura","Avenir Next","Jost",system-ui,sans-serif}
html[data-sky-tone="dark"] #vintageIntro .vi-skip{background:rgba(244,236,221,.12)}
#vintageIntro.home .vi-skip{opacity:0;transition:opacity .2s}
@keyframes viRise{from{transform:translateY(70cqw)}}
@keyframes viSunUp{from{transform:translateY(calc(.8 * min(100vw,52vh)))}}
@keyframes viSpin{to{transform:rotate(360deg)}} @keyframes viFade{from{opacity:0}}
@keyframes viPop{from{transform:scale(0)}} @keyframes viPopR{from{transform:rotate(-18deg) scale(0)}}
@keyframes viUp{from{opacity:0;transform:translateY(6cqw)}} @keyframes viWipe{from{transform:scaleX(0)}}
@keyframes viTwinkle{from{opacity:.25;transform:scale(.6)}to{opacity:1;transform:scale(1.2)}}
@keyframes viGone{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){#vintageIntro .vi-stage>*,#vintageIntro .vi-stage *,#vintageIntro .vi-sun{animation:viFade .5s .1s ease both}
  #vintageIntro .vi-sun{transition:opacity .3s ease}#vintageIntro.home .vi-sun{transform:none;opacity:0}}`;

  let el = null;
  function show({ force = false } = {}) {
    if (el) return;
    const m = mode();
    if (!force) {
      if (root.getAttribute('data-look') !== 'vintage' || m === 'off' || window.top !== window) return;
      if (navigator.webdriver && !stored()) return;
      try { if (sessionStorage.getItem(SHOWN)) return; sessionStorage.setItem(SHOWN, '1'); } catch {}
    }
    const st = document.createElement('style'); st.id = 'vintageIntroCss'; st.textContent = CSS; document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'vintageIntro'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'aOS');
    el.innerHTML = '<div class="vi-scene" aria-hidden="true"><div class="vi-stage"><div class="vi-stars"><i></i><i></i><i></i><i></i><i></i><i></i></div>'
      + '<b class="vi-rays"></b><b class="vi-hill2"></b><b class="vi-hill"></b><b class="vi-dot"></b><b class="vi-pill"></b>'
      + '<div class="vi-words"><div class="vi-name" translate="no">aOS</div><div class="vi-bars"><i></i><i></i><i></i></div><div class="vi-hi"></div></div></div></div>'
      + '<b class="vi-sun" aria-hidden="true"></b><button type="button" class="vi-skip"></button>';
    const hi = el.querySelector('.vi-hi');
    hi.textContent = greeting();
    el.querySelector('.vi-skip').textContent = 'Skip';
    root.appendChild(el);   // on <html>, so it covers aOS from its very first paint (the body may not be there yet)
    // played again from Account (a dialog): in the top layer, over it. Not as aOS opens (as tron-intro.js says).
    if (force) { el.setAttribute('popover', 'manual'); try { el.showPopover(); } catch {} }
    // the sky can turn to night a moment later (sky.js, once it knows where the phone is): the greeting follows
    const sky = () => { if (el) hi.textContent = greeting(); };
    window.addEventListener('aos:sky', sky);
    // Its way out comes first, before anything that could fail (as tron-intro.js): Skip, the clock, and a hard stop.
    let played = false, end = performance.now() + (still() ? 1600 : 3000);
    const remove = (e, after) => setTimeout(() => { try { e.hidePopover(); } catch {} e.remove(); st.remove(); }, after);
    const close = () => { if (!el) return; const e = el; el = null; window.removeEventListener('aos:sky', sky); e.classList.add('out'); remove(e, 520); };
    // the end: the hills fade, and the sun goes up into aOS's disc (where there's one on the screen), then it's gone
    const home = () => {
      if (!el) return; const e = el; el = null; window.removeEventListener('aos:sky', sky);
      const sun = e.querySelector('.vi-sun'), disc = !force && document.querySelector('.atoms > b:first-child');
      const s = sun.getBoundingClientRect(), d = disc && disc.getBoundingClientRect();
      if (d && d.width > 0 && d.bottom > 0 && d.top < innerHeight && s.width > 0) {
        const k = d.width / s.width;
        e.style.setProperty('--to', `translate(${(d.left + d.width / 2 - (s.left + s.width / 2)).toFixed(1)}px, ${(d.top + d.height / 2 - (s.top + s.height / 2)).toFixed(1)}px) scale(${k.toFixed(3)})`);
      } else e.classList.add('lost');
      e.classList.add('home');
      setTimeout(() => e.classList.add('out'), 600);
      remove(e, 1150);
    };
    el.querySelector('.vi-skip').addEventListener('click', close);
    const tick = () => { if (!el) return; if (performance.now() >= end) home(); else setTimeout(tick, 120); };
    setTimeout(tick, 400); setTimeout(close, 6000);
    // the sound, as tron-intro.js: only while the intro is up, and as aOS opens, only where the phone could start it
    const tapped = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    const tryPlay = () => { if (played || m !== 'sound' || !el) return; try { if (play()) { played = true; el.dataset.sound = 'playing'; } } catch {} };
    if (m === 'sound' && (force || tapped)) {
      try { const a = audio(); if (a) { if (a.state === 'running') tryPlay(); else a.resume().then(tryPlay, () => {}); } } catch {}
    }
  }
  window.aosVintageIntro = { show, greeting, play: () => { const a = audio(); if (a && a.state !== 'running') a.resume().then(play, () => {}); else play(); } };
  show();
})();
