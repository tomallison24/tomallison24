// Pearl's intro, Ignition (Pearl replaced Layers and keeps its id, 'layers', and this file's name): when aOS opens in
// Pearl (data-look="layers", set by look.js), dust drifts in out of the dark from all round, slowly at first and then
// pulled faster, and gathers into a rounded square, the pebble, as a line of light: each mote lights its own piece of the
// line where it lands. When the line is whole it flares (a bloom where its ends meet, a long streak of light, a ring
// through the dust) and "aOS" settles in under it, all in under four seconds; then "aOS" glides up into the small "aOS" at
// the top of the page (.head .mark), so the intro hands over with nothing jumping. Night is near-black blue with cool
// white light; Day (the phone or aOS in light) is cream with a carbon line. As the other intros (glass-intro.js,
// vintage-intro.js, tron-intro.js): only aOS (the apps open inside it, straight to themselves), once a launch
// (sessionStorage aos.layers.shown), Skip ends it, a hard stop ends it whatever happens, and with Reduce Motion it's a
// short fade of the finished mark.
//
// The sound is made here (Web Audio): a low swell and a few rising notes with an echo as the line flares. It plays only
// where the phone lets a page start sound before a tap. Account > Appearance > Ignition intro: Sound (the default),
// Silent, or Off (localStorage aos.layers.intro).
//
// Browser tests (navigator.webdriver) don't get the intro unless they pick Sound or Silent themselves: many open aOS
// in Pearl, and it would cover every page they open for a few seconds.
//
// window.aosLayersIntro: { show({ force }) } (Account's "Play the intro" plays it again), greeting(), play().
'use strict';
(() => {
  const root = document.documentElement, KEY = 'aos.layers.intro', SHOWN = 'aos.layers.shown', TAU = Math.PI * 2;
  const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const mode = () => { const m = stored(); return m === 'silent' || m === 'off' ? m : 'sound'; };
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Day or night, as the page will be: welcome.js sets data-theme only after this runs (it's loaded later), so it's
  // worked out here the way welcome.js's effective() does it. Light or Dark as picked in Appearance; System in Pearl
  // follows the sun where you are (Weather's place); else the phone. Going by the phone alone drew the cream day intro
  // over a page about to turn dark (Appearance Dark on a phone in light mode), and iOS kept that cream in the status bar.
  const sunNight = () => {   // as welcome.js's sunNight (NOAA's low-precision formulas): below -0.83 degrees the sun has set
    let p = null;
    try { p = JSON.parse(localStorage.getItem('wx.here')); if (!p || !Number.isFinite(p.lat)) p = (JSON.parse(localStorage.getItem('wx.places')) || [])[0]; } catch {}
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
    const rad = Math.PI / 180, d = (Date.now() / 86400000) - 10957.5, g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = (18.697374558 + 24.06570982441908 * d) % 24, ha = ((gmst * 15 + p.lon) * rad) - ra;
    return Math.asin(Math.sin(p.lat * rad) * Math.sin(dec) + Math.cos(p.lat * rad) * Math.cos(dec) * Math.cos(ha)) / rad < -0.83;
  };
  const night = () => {
    if (root.dataset.theme) return root.dataset.theme === 'dark';
    let t = 'auto'; try { t = (JSON.parse(localStorage.getItem('home.settings')) || {}).theme || 'auto'; } catch {}
    if (t === 'dark' || t === 'light') return t === 'dark';
    const n = sunNight(); if (n != null) return n;
    return matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const greeting = (d = new Date()) => d.getHours() < 12 ? 'Good morning' : d.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  // ---- the sound: a low swell, then rising notes with an echo, as the line flares ----
  let ctx = null;
  const audio = () => { try { return ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)()); } catch { return null; } };
  function play(at = 0) {
    const a = audio(); if (!a || a.state !== 'running') return false;
    const now = a.currentTime + at, out = a.createGain(), lp = a.createBiquadFilter(), dl = a.createDelay(), fb = a.createGain();
    out.gain.value = 0.0001; out.gain.exponentialRampToValueAtTime(0.16, now + 0.9); out.gain.exponentialRampToValueAtTime(0.0001, now + 6.5);
    lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.4; dl.delayTime.value = 0.31; fb.gain.value = 0.38; dl.connect(fb); fb.connect(dl);
    out.connect(lp); lp.connect(a.destination); lp.connect(dl); dl.connect(a.destination);
    for (const [fq, type, t, vol] of [[65.4, 'sine', 0, 0.5], [261.6, 'sine', 0.05, 0.22], [392, 'sine', 0.25, 0.18], [523.3, 'triangle', 0.45, 0.1], [659.3, 'sine', 0.7, 0.1], [987.8, 'sine', 1, 0.05]]) {
      const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = fq;
      g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(vol, now + t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, now + t + 6);
      o.connect(g); g.connect(out); o.start(now + t); o.stop(now + t + 6.5);
    }
    return true;
  }

  const CSS = `
#layersIntro{position:fixed;inset:0;z-index:2147483646;margin:0;padding:0;border:0;width:100%;height:100%;max-width:none;max-height:none;overflow:hidden;
  background:radial-gradient(80% 75% at 50% 42%,#061129 0%,#03091A 34%,#01040C 64%,#000103 100%);transition:opacity .5s ease}
#layersIntro.day{background:radial-gradient(85% 80% at 50% 36%,#FFFDF8 0%,#F6F0E6 50%,#E6DDCD 100%)}
#layersIntro canvas{position:absolute;inset:0;width:100%;height:100%}
#layersIntro .li-name{position:absolute;left:0;right:0;margin:0 auto;width:max-content;font:200 clamp(34px,11vw,52px)/1 "Unbounded","Avenir Next","Helvetica Neue",sans-serif;letter-spacing:-.02em;color:#ECF6FF;
  text-shadow:0 0 20px rgba(150,205,255,.75);opacity:0;transition:transform .55s cubic-bezier(.3,.7,.2,1),opacity .5s ease;transform-origin:left center}
#layersIntro.day .li-name{color:#1E2126;text-shadow:0 1px 0 rgba(255,255,255,.9)}
#layersIntro .li-hi{position:absolute;left:0;right:0;text-align:center;font:500 15px/1.3 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;color:rgba(220,235,250,.7);opacity:0;transition:opacity .5s ease}
#layersIntro.day .li-hi{color:rgba(30,33,38,.6)}
#layersIntro .li-skip{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:calc(env(safe-area-inset-bottom) + 18px);font:600 14px/1 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  padding:10px 16px;border-radius:999px;border:0;background:rgba(10,18,32,.6);color:#E8F0F6;box-shadow:inset 0 0 0 1px rgba(220,240,255,.22)}
#layersIntro.day .li-skip{background:rgba(255,253,248,.8);color:#1E2126;box-shadow:inset 0 0 0 1px rgba(30,33,38,.16)}
#layersIntro.home .li-name{transform:var(--to,none)}
#layersIntro.home canvas,#layersIntro.home .li-hi,#layersIntro.home .li-skip{opacity:0;transition:opacity .45s ease}
#layersIntro.lost .li-name{opacity:0 !important}
#layersIntro.out{opacity:0}
@media (prefers-reduced-motion:reduce){#layersIntro .li-name,#layersIntro{transition:opacity .4s ease}}
`;

  // ---- the gathering: dust, the mark lit piece by piece, the flare ----
  function ignite(c, el, calm) {
    const x = c.getContext('2d', { willReadFrequently: false }), day = !night(), D = Math.min(2, devicePixelRatio || 1);
    let w = 0, h = 0;
    const fit = () => { w = c.clientWidth || innerWidth; h = c.clientHeight || innerHeight; c.width = Math.round(w * D); c.height = Math.round(h * D); };
    fit();
    const cx = w / 2, cy = h * 0.4, R = Math.min(w, h) * 0.2;
    const len4 = (a, b) => Math.sqrt(Math.sqrt(a ** 4 + b ** 4));
    const sq = a => { const p = Math.cos(a), q = Math.sin(a), k = 1 / len4(p, q); return [p * k, q * k]; };
    const NB = 180, lit = new Float32Array(NB), bin = a => Math.floor((((a % TAU) + TAU) % TAU) / TAU * NB) % NB;
    const rgb = day ? '30,33,38' : '232,244,255';
    // the air: dust that just drifts, at many depths
    const air = Array.from({ length: Math.round(w * h / 2200) }, () => ({ x: Math.random() * w, y: Math.random() * h, z: Math.random(), ph: Math.random() * TAU }));
    // the dust that gathers: each mote has a place on the line and a time to arrive
    const movers = Array.from({ length: 200 }, (_, i) => {
      const a = (i + Math.random() * 0.9) / 200 * TAU, [qx, qy] = sq(a), sa = Math.random() * TAU, sr = R * (1.6 + Math.random() * 2.4);
      return { a, tx: cx + qx * R, ty: cy + qy * R, sx: cx + Math.cos(sa) * sr * Math.max(1, w / h), sy: cy + Math.sin(sa) * sr * 0.9,
        t1: 0.1 + Math.random() * 0.5, t2: 1.1 + Math.random() * 1.1, z: 0.3 + Math.random() * 0.3, bend: (Math.random() - 0.5) * R * 1.2, done: false };
    });
    if (calm) lit.fill(1);
    const dot = (px, py, r, al) => { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(${rgb},${al})`); g.addColorStop(0.35, `rgba(${rgb},${al * 0.5})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); };
    const line = (pts, b, glow) => {
      x.save(); x.lineCap = x.lineJoin = 'round';
      const path = () => { x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); };
      if (day) { path(); x.strokeStyle = `rgba(30,33,38,${0.08 * b})`; x.lineWidth = 6; x.stroke(); path(); x.strokeStyle = `rgba(28,31,36,${Math.min(1, 0.4 + 0.6 * b)})`; x.lineWidth = 1.5; x.stroke(); }
      else {
        x.globalCompositeOperation = 'lighter';
        if (glow) { path(); x.strokeStyle = `rgba(150,205,255,${0.05 * b})`; x.lineWidth = 18; x.shadowColor = `rgba(150,205,255,${0.6 * b})`; x.shadowBlur = 40; x.stroke(); x.shadowBlur = 0; }
        path(); x.strokeStyle = `rgba(150,205,255,${0.14 * b})`; x.lineWidth = 6; x.stroke();
        path(); x.strokeStyle = `rgba(245,251,255,${Math.min(1, b)})`; x.lineWidth = 1.6; x.stroke();
      }
      x.restore();
    };
    const outline = (k = 1) => Array.from({ length: 241 }, (_, i) => { const [qx, qy] = sq(-Math.PI / 2 + i / 240 * TAU); return [cx + qx * R * k, cy + qy * R * k]; });
    // the name under the mark
    const name = el.querySelector('.li-name'), hi = el.querySelector('.li-hi');
    name.style.top = (cy + R * 1.55) + 'px'; hi.style.top = (cy + R * 1.55 + 58) + 'px';
    let raf = 0, done = false, t0 = 0, last = 0, flared = false;
    const frame = now => {
      if (done) return;
      if (!t0) t0 = last = now;
      const t = calm ? 9 : (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
      x.setTransform(D, 0, 0, D, 0, 0); x.clearRect(0, 0, w, h);
      const formed = t >= 2.4, since = t - 2.4, flare = since > 0 && !calm ? Math.exp(-since * 1.5) * Math.min(1, since * 8) : 0;
      if (t > 2.05) for (let i = 0; i < NB; i++) lit[i] += (1 - lit[i]) * Math.min(1, dt * 5);
      let avg = 0; for (let i = 0; i < NB; i++) avg += lit[i]; avg /= NB;
      // a soft glow behind the mark, as much as has gathered
      if (avg > 0.01) { const g = x.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 3); g.addColorStop(0, day ? `rgba(255,255,255,${0.55 * avg})` : `rgba(110,160,255,${0.12 * avg * (1 + flare)})`); g.addColorStop(1, day ? 'rgba(255,255,255,0)' : 'rgba(90,140,230,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
      x.globalCompositeOperation = day ? 'source-over' : 'lighter';
      for (const m of air) {
        if (!calm) { m.x += (Math.sin(m.y * 0.005 + t * 0.4 + m.ph) * 0.05 + 0.02) * dt * 60; m.y += (Math.cos(m.x * 0.004 - t * 0.3 + m.ph) * 0.04 - 0.02) * dt * 60; }
        if (flare > 0.05) { const ddx = m.x - cx, ddy = m.y - cy, d = Math.hypot(ddx, ddy) || 1; m.x += ddx / d * flare * 1.4; m.y += ddy / d * flare * 1.4; }
        const f = Math.abs(m.z - 0.45), r = (1.2 + m.z * m.z * 7) * (1 + f * 3);
        dot(m.x, m.y, r, (0.08 + 0.22 * (1 - f)) * (day ? 0.6 : 1));
      }
      if (!formed && !calm) for (const m of movers) {
        if (m.done || t < m.t1) continue;
        const u = Math.max(0, Math.min(1, (t - m.t1) / (m.t2 - m.t1))), e = u * u * (1.6 - 0.6 * u);
        if (u >= 1) { m.done = true; const b0 = bin(m.a); for (let k = -4; k <= 4; k++) { const bi = (b0 + k + NB) % NB; lit[bi] = Math.min(1, lit[bi] + 0.26 * Math.exp(-k * k / 6)); } continue; }
        const ddx = m.tx - m.sx, ddy = m.ty - m.sy, dl = Math.hypot(ddx, ddy) || 1;
        const at = q => { const bend = Math.sin(Math.PI * q) * (1 - q) * m.bend; return [m.sx + ddx * q - ddy / dl * bend, m.sy + ddy * q + ddx / dl * bend]; };
        const al = Math.min(1, (t - m.t1) / 0.4) * (0.45 + 0.55 * e) * (day ? 0.8 : 1), r = 1.8 + m.z * 2.4;
        for (let k = 3; k >= 1; k--) { const [px, py] = at(Math.max(0, e - k * 0.03)); dot(px, py, r * 0.8, al * 0.16 / k); }
        const [px, py] = at(e); dot(px, py, r, al);
      }
      x.globalCompositeOperation = 'source-over';
      // the line: lit where dust has landed, whole once it's formed
      if (formed || calm) line(outline(), 1 + flare * 1.6, true);
      else for (let s = 0; s < 48; s++) {
        const a0 = -Math.PI / 2 + s / 48 * TAU; let lv = 0; for (let k = 0; k < 4; k++) lv += lit[bin(a0 + (k + 0.5) / 4 / 48 * TAU)]; lv /= 4;
        if (lv < 0.03) continue;
        line(Array.from({ length: 9 }, (_, k) => { const [qx, qy] = sq(a0 + k / 8 / 48 * TAU); return [cx + qx * R, cy + qy * R]; }), lv * 0.95, false);
      }
      // the flare where the ends meet: a bloom, a long streak, and a ring out through the dust
      if (flare > 0.01) {
        const fy = cy + R; x.save(); x.globalCompositeOperation = day ? 'source-over' : 'lighter';
        let g = x.createRadialGradient(cx, fy, 0, cx, fy, R * 1.8); g.addColorStop(0, `rgba(255,255,255,${0.75 * flare})`); g.addColorStop(0.15, `rgba(190,225,255,${0.4 * flare})`); g.addColorStop(1, 'rgba(120,170,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
        g = x.createLinearGradient(cx - w * 0.45, 0, cx + w * 0.45, 0); g.addColorStop(0, 'rgba(160,210,255,0)'); g.addColorStop(0.5, `rgba(235,247,255,${0.9 * flare})`); g.addColorStop(1, 'rgba(160,210,255,0)');
        x.fillStyle = g; x.fillRect(cx - w * 0.45, fy - 1.2, w * 0.9, 2.4);
        x.beginPath(); outline(1 + since * 1.05).forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
        x.strokeStyle = day ? `rgba(30,33,38,${0.22 * flare})` : `rgba(190,225,255,${0.35 * flare})`; x.lineWidth = 1.2; x.stroke(); x.restore();
        if (!flared) { flared = true; el.dispatchEvent(new Event('flare')); }
      }
      if (t > 2.7 || calm) { name.style.opacity = 1; hi.style.opacity = 1; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { done = true; cancelAnimationFrame(raf); };
  }

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
    if (!night()) el.classList.add('day');
    el.innerHTML = '<canvas class="li-swarm" aria-hidden="true"></canvas><div class="li-name" translate="no" aria-hidden="true">aOS</div><div class="li-hi" aria-hidden="true"></div><button type="button" class="li-skip"></button>';
    el.querySelector('.li-hi').textContent = greeting();
    el.querySelector('.li-skip').textContent = 'Skip';
    root.appendChild(el);   // on <html>, so it covers aOS from its very first paint (the body may not be there yet)
    // played again from Account (a dialog): in the top layer, over it. Not as aOS opens (as tron-intro.js says).
    if (force) { el.setAttribute('popover', 'manual'); try { el.showPopover(); } catch {} }
    try { window.aosPearl && aosPearl.pause(); } catch {}
    // Its way out comes first, before anything that could fail (as tron-intro.js): Skip, the clock, and a hard stop.
    let played = false, stop = () => {}; const end = performance.now() + (still() ? 1600 : 4000);
    const remove = (e, after) => setTimeout(() => { stop(); try { e.hidePopover(); } catch {} e.remove(); st.remove(); try { window.aosPearl && aosPearl.resume(); } catch {} }, after);
    const close = () => { if (!el) return; const e = el; el = null; e.classList.add('out'); remove(e, 520); };
    // the end: "aOS" glides up into the small "aOS" at the top of the page on show, then it's gone
    const home = () => {
      if (!el) return; const e = el; el = null;
      const name = e.querySelector('.li-name'), mark = !force && [...document.querySelectorAll('.tab:not([hidden]) .head .mark')].find(x => x.getBoundingClientRect().width > 0);
      let d = null; if (mark) { const r = document.createRange(); r.selectNodeContents(mark); d = r.getBoundingClientRect(); }
      // "aOS" is as wide as its words: scaled from its left edge onto the mark's words (a Range: the mark is a whole-width block)
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
    try { stop = ignite(el.querySelector('canvas'), el, still()); } catch {}
    // the sound, as tron-intro.js: only while the intro is up, and as aOS opens, only where the phone could start it
    const tapped = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    const tryPlay = () => { if (played || m !== 'sound' || !el) return; try { if (play()) { played = true; el.dataset.sound = 'playing'; } } catch {} };
    if (m === 'sound' && (force || tapped)) {
      try { const a = audio(); if (a) { if (a.state === 'running') tryPlay(); else a.resume().then(tryPlay, () => {}); } } catch {}
    }
  }
  window.aosLayersIntro = { show, greeting, play: () => { const a = audio(); if (a && a.state !== 'running') a.resume().then(() => play(), () => {}); else play(); } };
  show();
})();
