// Layers' intro, Skylight: when aOS opens in the Layers look (data-look="layers", set by look.js), the sun (the moon
// from 6pm) rises into the top right of the time of day's sky (the --ly-* colours of Layers' block, by data-tod), and a
// cloud of hundreds of tiny dots, the agents, in the apps' group colours, swoops in from the bottom left like a flock
// of birds. Each dot has a place: they come together into Home's sixteen line drawings, drawn in dots, and the
// drawings into a house - its ground first, then the walls, then the roof up to its peak. A warm light comes on inside,
// with a family standing in it (the people solid, the agents dots). "aOS" bounces in letter by letter with "Good
// morning", "Good afternoon" (from noon) or "Good evening" (from 6pm); then the house fades and "aOS" glides up into
// the small "aOS" at the top of the page (.head .mark), so the intro hands over with nothing jumping. As Tide and
// Sunrise (glass-intro.js, vintage-intro.js): only aOS (the apps open inside it, straight to themselves), once a launch
// (sessionStorage aos.layers.shown), Skip ends it, a hard stop ends it whatever happens, and with Reduce Motion it's a
// short fade of the finished house.
//
// The sound is made here (Web Audio): a warm chord breathing in, a whoosh of air as the flock swoops in, a note
// climbing as the house goes up, and a sparkle as the light comes on. As with Tide, it plays only where the phone lets a page start sound before a tap. Account >
// Appearance > Skylight intro: Sound (the default), Silent, or Off (localStorage aos.layers.intro).
//
// Browser tests (navigator.webdriver) don't get the intro unless they pick Sound or Silent themselves: many open aOS
// in Layers, and it would cover every page they open for three seconds.
//
// Colours come from the page (Layers' --ly-* and --text, --muted on <html>), so they follow Light or Dark and the time of day;
// the dots take Home's group colours, light or dark.
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
    // the whoosh: noise through a band that sweeps up as the flock swoops in
    const len = 0.9, buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = a.createBufferSource(), bp = a.createBiquadFilter(), w = a.createGain();
    n.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(260, t + 0.15); bp.frequency.exponentialRampToValueAtTime(2600, t + 0.75);
    w.gain.setValueAtTime(0.0001, t + 0.15); w.gain.exponentialRampToValueAtTime(0.09, t + 0.45); w.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    n.connect(bp); bp.connect(w); w.connect(out); n.start(t + 0.15); n.stop(t + 0.15 + len);
    // the glass notes: climbing as the house goes up (ground, walls, roof, peak), each with a faint bright partial; then a
    // sparkle as the light comes on inside
    const note = (fr, at, p = 0.1, l = 1.2) => {
      for (const [k, q, ll] of [[1, p, l], [3.01, p * 0.25, l * 0.4]]) {
        const o = a.createOscillator(), e = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(fr * k, at);
        e.gain.setValueAtTime(0.0001, at); e.gain.exponentialRampToValueAtTime(q, at + 0.006); e.gain.exponentialRampToValueAtTime(0.0001, at + ll);
        o.connect(e); e.connect(out); o.start(at); o.stop(at + ll + 0.05);
      }
    };
    [587.33, 739.99, 880, 1174.66].forEach((fr, i) => note(fr, t + 1.05 + i * 0.2));
    [1760, 2217.46, 2637.02].forEach((fr, i) => note(fr, t + 1.95 + i * 0.05, 0.045, 1.6));
    return true;
  }

  // ---- the screen ----
  // The words, the sun and the house are on a phone-shaped stage in the middle (sizes in cqw, its width), so on a wider
  // screen they stay a phone's picture; the sky reaches to the edges.
  const CSS = `
#layersIntro{position:fixed;inset:0;z-index:2147483000;margin:0;border:0;padding:0;width:auto;height:auto;max-width:none;max-height:none;background:transparent;color:var(--text,#12161C);overflow:hidden;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",system-ui,sans-serif;-webkit-user-select:none;user-select:none;touch-action:manipulation;transition:opacity .5s ease}
#layersIntro{animation:liGone .4s 7s forwards}
#layersIntro::backdrop{background:transparent}
#layersIntro.out{opacity:0;pointer-events:none}
#layersIntro .li-sky{position:absolute;inset:0;background:radial-gradient(75% 45% at 8% 94%,var(--ly-g1,rgba(150,200,186,.6)),transparent 72%),radial-gradient(65% 40% at 96% 70%,var(--ly-g2,rgba(226,182,178,.5)),transparent 72%),var(--ly-plate,linear-gradient(150deg,#B9DCD2,#C6D1E7 40%,#EAD0CE 75%,#EEDFC4));
  background-color:var(--ly-top,#B9DCD2);transition:opacity .5s ease}   /* there from the first paint: it is the page's own sky */
#layersIntro.home .li-sky{opacity:0}
#layersIntro{--li-light:rgba(255,255,255,.55);--li-sun:#FFF6DF;--li-glow:rgba(255,226,170,.75);--li-ring:rgba(255,240,205,.25)}
@media (prefers-color-scheme:dark){html:not([data-theme="light"]) #layersIntro{--li-light:rgba(255,255,255,.16);--li-glow:rgba(255,214,150,.45);--li-ring:rgba(255,240,205,.12)}}
html[data-theme="dark"] #layersIntro{--li-light:rgba(255,255,255,.16);--li-glow:rgba(255,214,150,.45);--li-ring:rgba(255,240,205,.12)}
#layersIntro .li-light{position:absolute;right:-18vw;top:2%;width:78vw;height:78vw;border-radius:50%;background:radial-gradient(circle,var(--li-light),transparent 68%);animation:liRise 2.2s .15s cubic-bezier(.2,.8,.2,1) both}
#layersIntro .li-swarm{position:absolute;inset:0;width:100%;height:100%;transition:opacity .45s ease}
#layersIntro.home .li-swarm,#layersIntro.home .li-sun,#layersIntro.home .li-light{opacity:0;transition:opacity .45s ease}
#layersIntro .li-front{position:absolute;top:0;bottom:0;left:50%;width:min(100vw,52vh);transform:translateX(-50%);container-type:inline-size;pointer-events:none}
/* the sun (the moon from 6pm), high in the top right, under Skip */
#layersIntro .li-sun{position:absolute;right:12cqw;top:calc(max(14px,env(safe-area-inset-top)) + 64px);width:13cqw;height:13cqw;max-width:72px;max-height:72px;border-radius:50%;
  background:radial-gradient(circle at 40% 38%,#fff,var(--li-sun) 60%);box-shadow:0 0 0 1.4cqw var(--li-ring),0 0 12cqw 3cqw var(--li-glow);animation:liSun 1.4s .1s cubic-bezier(.2,.8,.2,1) both}
#layersIntro[data-tod="evening"] .li-sun,#layersIntro[data-tod="night"] .li-sun{background:#F1F2F8;box-shadow:inset -3.4cqw -1.3cqw 0 0 rgba(160,170,210,.75),0 0 10cqw 2cqw rgba(200,210,255,.35)}
#layersIntro .li-words{position:absolute;top:19%;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:3cqw}
#layersIntro .li-name{transform-origin:left center;font-size:24cqw;font-weight:800;letter-spacing:-.03em;line-height:1;white-space:nowrap;color:var(--text,#12161C);transition:transform .65s cubic-bezier(.6,0,.3,1),opacity .3s ease}
#layersIntro .li-name span{display:inline-block;animation:liBounce .7s calc(2s + var(--n) * .09s) cubic-bezier(.3,1.7,.5,1) both}
#layersIntro .li-hi{font-size:4.4cqw;font-weight:600;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;color:var(--muted,rgba(18,22,28,.64));animation:liIn .5s 2.4s ease both;transition:opacity .25s}
#layersIntro.home .li-name{transform:var(--to,none)}
#layersIntro.home .li-name span{animation:none}
#layersIntro.home .li-hi,#layersIntro.home.lost .li-name{opacity:0}
#layersIntro .li-skip{position:absolute;top:max(14px,env(safe-area-inset-top));right:16px;min-width:64px;height:44px;padding:0 14px;border:0;border-radius:22px;background:var(--ly-veil,rgba(255,255,255,.78));
  box-shadow:inset 0 0 0 1px rgba(127,127,127,.18);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:inherit;font:600 15px -apple-system,BlinkMacSystemFont,system-ui,sans-serif}
#layersIntro.home .li-skip{opacity:0;transition:opacity .2s}
@keyframes liFade{from{opacity:0}}
@keyframes liSun{from{opacity:0;transform:translateY(8cqw)}}
@keyframes liBounce{from{opacity:0;transform:translateY(-14cqw) scale(.9)}}
@keyframes liRise{from{opacity:0;transform:translateY(16vh) scale(.85)}}
@keyframes liIn{from{opacity:0;transform:translateY(5cqw)}}
@keyframes liGone{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){#layersIntro .li-light,#layersIntro .li-sun,#layersIntro .li-front *,#layersIntro .li-swarm{animation:liFade .5s .1s ease both}
  #layersIntro .li-name{transition:opacity .3s ease}#layersIntro.home .li-name{transform:none;opacity:0}}`;

  // Home's sixteen in its order, by group (Family, Every day, Out and about, You, Games), and each group's colour
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

  // each drawing as dots: a point every 2 units along its strokes (in its 24 x 24 box), centred on 0; worked out once.
  // If the phone can't measure them, each drawing is one dot, and the house still goes up.
  let dots = null;
  function drawingsAsDots() {
    if (dots) return dots;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;visibility:hidden';
    root.appendChild(svg);
    dots = GLYPHS.map(src => {
      try {
        svg.innerHTML = src; const pts = [];
        for (const e of svg.children) {
          const len = e.getTotalLength(), n = Math.max(2, Math.round(len / 2)), closed = e.tagName !== 'path' || /z\s*$/i.test(e.getAttribute('d'));
          for (let j = 0; j < (closed ? n : n + 1); j++) { const q = e.getPointAtLength(j * len / n); pts.push([q.x / 24 - 0.5, q.y / 24 - 0.5]); }
        }
        return pts.length ? pts : [[0, 0]];
      } catch { return [[0, 0]]; }
    });
    svg.remove(); return dots;
  }

  // The swarm, on a canvas: the flock follows a leader that swoops in from the bottom left and wheels round the middle
  // (each dot keeps its place in a turning, breathing cloud round it, as a murmuration does), then a spring takes each
  // dot home, the lower ones first. Stepped at 60 a second whatever the screen's rate, so it plays the same at 120Hz.
  function swarm(cv, still) {
    const x = cv.getContext('2d'); if (!x) return () => {};
    const sw = innerWidth, sh = innerHeight, W = Math.min(sw, sh * 0.52), H = sh, L0x = (sw - W) / 2, dpr = Math.min(devicePixelRatio || 1, 3), dk = dark();
    cv.width = Math.round(sw * dpr); cv.height = Math.round(sh * dpr); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the house: the drawings along its outline, the walls from the ground up, then the roof from each wall to the peak
    // (rank: how far up the house a drawing sits, so the flock builds it in that order)
    const cx = L0x + W / 2, gy = H * 0.71, hw = W * 0.3, wall = W * 0.31, peak = W * 0.28, step = W * 0.098, size = W * 0.084, top = gy - wall;
    const icons = [], seen = [];
    for (const [[x0, y0], [x1, y1]] of [[[cx - hw, gy], [cx - hw, top]], [[cx + hw, gy], [cx + hw, top]], [[cx - hw, top], [cx, top - peak]], [[cx + hw, top], [cx, top - peak]]]) {
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let j = 0; j <= n; j++) {
        const px = x0 + (x1 - x0) * j / n, py = y0 + (y1 - y0) * j / n;
        if (seen.some(([a, b]) => Math.hypot(a - px, b - py) < step * 0.6)) continue;   // the corners only once
        seen.push([px, py]); icons.push({ x: px, y: py, g: icons.length % 16, rank: (gy - py) / (wall + peak) });
      }
    }
    const outline = [[cx - hw, gy], [cx - hw, top], [cx, top - peak], [cx + hw, top], [cx + hw, gy]];
    let seed = 7; const R = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;   // the same flock every time
    const leader = s => { const u = Math.min(s / 1.05, 1), e = 1 - (1 - u) * (1 - u);
      return { x: L0x + W * (-0.2 + 0.72 * e + 0.1 * Math.sin(s * 2.6)), y: H * (1.02 - 0.5 * e + 0.05 * Math.cos(s * 3.1)) }; };
    const start = leader(0), P = [];
    const add = (tx, ty, col, delay) => {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * W * 0.22, ox = Math.cos(a) * rr * 1.3, oy = Math.sin(a) * rr * 0.8;   // its place in the cloud: wider across than tall
      P.push({ tx, ty, col, ox, oy, px: start.x + ox, py: start.y + oy, vx: 0, vy: 0, seed: R() * 100, delay, tw: 0.7 + R() * 0.6, g: 0 });
    };
    const D = drawingsAsDots();
    for (const ic of icons) { const col = TINT[APPS[ic.g]][dk ? 1 : 0], late = R() * 0.08; for (const [u, v] of D[ic.g]) add(ic.x + u * size, ic.y + v * size, col, ic.rank * 0.7 + late + R() * 0.14); }
    // the ground the house stands on: a row of dots in every group's colour, the first to land
    const kinds = Object.keys(TINT), nG = Math.round(0.84 / 0.0105);
    for (let j = 0; j <= nG; j++) add(cx - W * 0.42 + j * W * 0.84 / nG, gy + W * 0.06, TINT[kinds[j % kinds.length]][dk ? 1 : 0], Math.abs(j / nG - 0.5) * 0.3 + R() * 0.1);
    const ink = getComputedStyle(root).getPropertyValue('--text').trim() || (dk ? '#EEF4F2' : '#10181A'), r0 = W * 0.0032;

    const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t), dt = 1 / 60;
    function stepAt(s) {
      const L = leader(s), L2 = leader(s + dt), Lvx = (L2.x - L.x) / dt, Lvy = (L2.y - L.y) / dt, turn = s * 1.3, c = Math.cos(turn), n = Math.sin(turn);
      for (const p of P) {
        const g = ease((s - 1 - p.delay * 0.6) / 0.9);   // 0: flocking, 1: home
        const br = 0.75 + 0.25 * Math.sin(s * 2.2 + p.seed), ox = (p.ox * c - p.oy * n) * br, oy = (p.ox * n + p.oy * c) * br;
        let ax = (Lvx + (L.x + ox - p.px) * 5 + Math.sin(s * 3 + p.seed) * W * 0.15 - p.vx) * 7, ay = (Lvy + (L.y + oy - p.py) * 5 + Math.cos(s * 2.7 + p.seed) * W * 0.15 - p.vy) * 7;
        ax = ax * (1 - g) + ((p.tx - p.px) * 60 - p.vx * 11) * g; ay = ay * (1 - g) + ((p.ty - p.py) * 60 - p.vy * 11) * g;
        const damp = g > 0.9 ? 0.86 : 0.985; p.vx = (p.vx + ax * dt) * damp; p.vy = (p.vy + ay * dt) * damp;
        const sp = Math.hypot(p.vx, p.vy), max = W * 1.6; if (sp > max) { p.vx *= max / sp; p.vy *= max / sp; }
        p.px += p.vx * dt; p.py += p.vy * dt;
        if (s > 2.3) { p.px += (p.tx - p.px) * 0.3; p.py += (p.ty - p.py) * 0.3; }
        p.g = g;
      }
    }
    // the warm light inside the house, and the family standing in it: two grown-ups and two children
    function shelter(s) {
      const g = ease((s - 1.85) / 0.5); if (g <= 0) return;
      x.save(); x.beginPath(); outline.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.clip();
      const grd = x.createRadialGradient(cx, gy - W * 0.12, 0, cx, gy - W * 0.12, W * 0.42);
      grd.addColorStop(0, dk ? 'rgba(255,214,150,.42)' : 'rgba(255,222,160,.75)'); grd.addColorStop(1, dk ? 'rgba(255,214,150,.08)' : 'rgba(255,236,200,.2)');
      x.globalAlpha = g; x.fillStyle = grd; x.fillRect(0, 0, sw, sh); x.restore();
      x.save(); x.globalAlpha = g * (dk ? 0.92 : 0.82); x.fillStyle = ink;
      for (const [dx, k] of [[-0.15, 1], [-0.05, 0.68], [0.05, 0.78], [0.15, 0.95]]) {
        const px = cx + dx * W, h = W * 0.19 * k, head = W * 0.031 * (k > 0.9 ? 1 : 0.9), rise = (1 - g) * W * 0.03, bw = W * 0.07 * (k > 0.9 ? 1 : 0.85), tp = gy - h + head * 2.25 - rise;
        x.beginPath(); x.arc(px, gy - h + head - rise, head, 0, Math.PI * 2); x.fill();
        x.beginPath(); if (x.roundRect) x.roundRect(px - bw / 2, tp, bw, gy - tp, [bw / 2, bw / 2, 0, 0]); else x.rect(px - bw / 2, tp, bw, gy - tp); x.fill();
      }
      x.restore();
    }
    function draw(s) {
      x.clearRect(0, 0, sw, sh); shelter(s);
      for (const p of P) {
        const fly = 1 - p.g, r = r0 * (1 + 0.5 * fly) * p.tw ** fly;
        x.fillStyle = p.col;
        if (fly > 0.05) { x.globalAlpha = 0.22 * fly; x.beginPath(); x.arc(p.px, p.py, r * 2.4, 0, Math.PI * 2); x.fill(); }   // a soft glow while flying
        x.globalAlpha = 0.55 + 0.45 * p.g; x.beginPath(); x.arc(p.px, p.py, r, 0, Math.PI * 2); x.fill();
      }
      x.globalAlpha = 1;
    }
    // Reduce Motion: the finished house, still
    if (still) { for (const p of P) { p.px = p.tx; p.py = p.ty; p.g = 1; } draw(3); return () => {}; }
    let raf = 0, t0 = 0, sim = 0, done = false;
    const frame = now => {
      if (done) return; if (!t0) t0 = now;
      const s = Math.min((now - t0) / 1000, 4);
      for (let k = 0; sim < s && k < 8; k++) stepAt(sim += dt);   // at most 8 steps a frame: a stalled phone catches up gently
      draw(sim);
      if (s < 4) raf = requestAnimationFrame(frame);
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
    el.dataset.tod = root.dataset.tod || 'afternoon';
    el.innerHTML = '<div class="li-sky" aria-hidden="true"></div><b class="li-light" aria-hidden="true"></b><canvas class="li-swarm" aria-hidden="true"></canvas>'
      + '<div class="li-front" aria-hidden="true"><b class="li-sun"></b><div class="li-words"><div class="li-name" translate="no">' + [...'aOS'].map((c, i) => `<span style="--n:${i}">${c}</span>`).join('') + '</div><div class="li-hi"></div></div></div>'
      + '<button type="button" class="li-skip"></button>';
    el.querySelector('.li-hi').textContent = greeting();
    el.querySelector('.li-skip').textContent = 'Skip';
    root.appendChild(el);   // on <html>, so it covers aOS from its very first paint (the body may not be there yet)
    // played again from Account (a dialog): in the top layer, over it. Not as aOS opens (as tron-intro.js says).
    if (force) { el.setAttribute('popover', 'manual'); try { el.showPopover(); } catch {} }
    // Its way out comes first, before anything that could fail (as tron-intro.js): Skip, the clock, and a hard stop.
    let played = false, stop = () => {}; const end = performance.now() + (still() ? 1600 : 3500);
    const remove = (e, after) => setTimeout(() => { stop(); try { e.hidePopover(); } catch {} e.remove(); st.remove(); }, after);
    const close = () => { if (!el) return; const e = el; el = null; e.classList.add('out'); remove(e, 520); };
    // the end: the house fades, and "aOS" glides up into the small "aOS" at the top of the page on show, then it's gone
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
    try { stop = swarm(el.querySelector('.li-swarm'), still()); } catch {}
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
