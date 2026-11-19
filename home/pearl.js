// Pearl's light and dust: the part of the Pearl look that a style sheet can't draw. Pearl replaced Layers and keeps its
// id, 'layers' (data-look on <html>, design.<app>, aos.look), so phones that had Layers open in Pearl. Loaded by
// home/design.js (every app), aOS/look.js (aOS) and clock/design.js once Pearl is the look; it draws only while it is.
//
//   - Dust, behind everything (a canvas fixed under the page; the page's ground is <html>'s, so it shows through):
//     motes at many depths, sharp in the middle and soft near and far, drifting slowly. The ones in focus are pulled into
//     the nearest light (the strip under the title, the lit edges of boxes, the apps' icons). Close in, a mote in open
//     space is handed to the light's canvas, over the page, so you see it fall the last of the way, faster as it goes,
//     and be taken in: the line brightens a moment where it lands, or the icon glows;
//     new ones fade in, slowly, far from the light. When Weather's last forecast here (wx.cache) is rain or snow, the
//     dust falls as rain or drifts down as snow.
//   - Light, over the page (a second canvas, never in the way of a tap): a strip under the title with a beam gliding
//     slowly back and forth along it, and a hairline on the top edge of each box (a card, a group, a field: anything
//     with a ground and rounded corners), brightest where the eyes rest on a phone, 38% of the way down the screen,
//     fading above and below it, so the box you scroll to lights up. Hidden wherever something is over it (a sheet,
//     a bar): it's only drawn where the box's own edge is what you'd see.
//   - Depth: as you scroll, the dust moves with it at its own depth, near motes more than far ones, so the screen
//     has depth behind it. A sheet opening sends one beam of light along its top edge, which then stays a faint
//     hairline while it's open.
//   - Pull to refresh (aOS Home's #hpull, Mail's .ptr: they still keep the pull, their arrow is hidden here): a hairline
//     draws itself out from the middle as you pull, the dust drawn into it; let go, and a beam glides along it while it
//     loads, then it flares softly as it's done.
//   - Night (the phone or aOS in dark): cool white light on near-black. Day: carbon lines on cream, a white gleam for
//     the beam.
//   - It pauses while the page isn't on screen (hidden, an app's frame put away, aOS Home under an open app) and,
//     with Reduce Motion, holds still: the dust doesn't move, the beam rests in the middle, the edges simply change.
// window.aosPearl: pause(), resume() (aOS uses them for its intro), running().
'use strict';
(() => {
  if (window.aosPearl) return;
  const root = document.documentElement, TAU = Math.PI * 2;
  const on = () => root.dataset.look === 'layers';
  const reduceQ = matchMedia('(prefers-reduced-motion: reduce)'), darkQ = matchMedia('(prefers-color-scheme: dark)');
  const reduce = () => reduceQ.matches;
  const night = () => root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && darkQ.matches);
  const isAOS = /\/aOS\//.test(location.pathname);
  const EYE = 0.38;   // where eyes rest on a phone, from the top (eye-tracking on phones puts the median gaze about here)
  let held = false;

  // ---- the two canvases ----
  const mk = (z) => { const c = document.createElement('canvas'); c.setAttribute('aria-hidden', 'true'); c.dataset.pearl = '';
    c.style.cssText = `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:${z};display:none`; return c; };
  const dustC = mk(-1), lightC = mk(2147483000), dx = dustC.getContext('2d'), lx = lightC.getContext('2d');
  let W = 0, H = 0, D = 1;
  function size() {
    D = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    for (const c of [dustC, lightC]) { c.width = Math.round(W * D); c.height = Math.round(H * D); }
    target = Math.round(Math.max(30, Math.min(isAOS ? 170 : 90, W * H / (isAOS ? 2400 : 4200))));
  }

  // ---- dust sprites: five levels of focus, in light (night) and carbon (day) ----
  const sprite = (level, rgb) => {
    const s = 64, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
    const core = [0.22, 0.14, 0.08, 0.04, 0.02][level], gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(core, `rgba(${rgb},.88)`); gr.addColorStop(Math.min(0.9, core * 2.6 + 0.08), `rgba(${rgb},.2)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, s, s); return c;
  };
  const SPR = { night: [0, 1, 2, 3, 4].map(l => sprite(l, '232,244,255')), day: [0, 1, 2, 3, 4].map(l => sprite(l, '30,33,38')) };

  // ---- the weather here, from Weather's own cache (as aOS/home-find.js reads it) ----
  let wx = null, wxAt = 0;
  function readWx() {
    wxAt = Date.now(); wx = null;
    try {
      const cache = JSON.parse(localStorage.getItem('wx.cache') || 'null'), here = JSON.parse(localStorage.getItem('wx.here') || 'null');
      if (!cache || typeof cache !== 'object') return;
      const key = here && Number.isFinite(here.lat) ? here.lat.toFixed(3) + ',' + here.lon.toFixed(3) : null;
      const b = (key && cache[key]) || Object.values(cache).find(x => x && x.cur);
      if (!b || !b.cur || Date.now() - (b.fetchedAt || 0) > 3 * 3600e3) return;
      const c = String(b.cur.c || '');
      wx = /snow/.test(c) ? 'snow' : /rain|pour|hail/.test(c) ? 'rain' : null;
    } catch {}
  }

  // ---- the dust ----
  let motes = [], pulses = [], target = 60, falling = 0, taken = 0, lastFall = 0;
  const mote = (initial) => {
    let x, y, n = 0;
    do { x = Math.random() * W; y = Math.random() * H; n++; } while (!initial && n < 6 && lights.some(a => near(a, x, y)[2] < 70));
    return { x, y, z: Math.random(), vx: 0, vy: 0, ph: Math.random() * TAU, tw: 0.4 + Math.random() * 1.6, life: initial ? 1 : 0, grow: 1 / (4 + Math.random() * 3.5), die: 0, tx: 0, ty: 0 };
  };
  const near = (a, x, y) => { const px = Math.max(a.x0, Math.min(a.x1, x)); return [px, a.y, Math.hypot(px - x, a.y - y)]; };
  const ptr = { x: 0, y: 0, vx: 0, vy: 0, on: false };
  const move = e => { const t = e.touches ? e.touches[0] : e; if (!t) return; if (ptr.on) { ptr.vx = (t.clientX - ptr.x) * 0.5; ptr.vy = (t.clientY - ptr.y) * 0.5; } ptr.x = t.clientX; ptr.y = t.clientY; ptr.on = true; };
  addEventListener('pointermove', move, { passive: true }); addEventListener('touchmove', move, { passive: true });
  addEventListener('touchend', () => { ptr.on = false; }, { passive: true }); addEventListener('pointerleave', () => { ptr.on = false; });

  function stepDust(T, dt) {
    const step = dt * 60;
    if (par) { for (const m of motes) if (!m.fall && !m.die) m.y -= par * (0.04 + 0.42 * m.z * m.z); par = 0; }   // near motes (big, z near 1) move most
    falling = 0; for (const m of motes) if (m.fall) falling++;
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      if (m.die > 0) { m.die += dt / 0.5; if (m.die >= 1) motes.splice(i, 1); continue; }
      if (m.fall) {   // the last of the way into its light, faster as it goes, then taken in
        const f = m.fall, a = lights.find(l => l.key === f.key);
        if (!a) { m.fall = null; falling--; m.die = 0.001; continue; }   // its light scrolled away or went: it fades where it is
        f.t += dt;
        const u = Math.min(1, f.t / f.dur), e = u * u * (2.2 - 1.2 * u), [px, py] = a.icon ? [a.x0, a.y] : near(a, f.x0, f.y0);
        const nx = -(py - f.y0), ny = px - f.x0, nl = Math.hypot(nx, ny) || 1, arc = Math.sin(Math.PI * e) * 10 * f.bend;
        m.x = f.x0 + (px - f.x0) * e + nx / nl * arc; m.y = f.y0 + (py - f.y0) * e + ny / nl * arc;
        if (u >= 1) { pulses.push({ key: f.key, x: px, y: py, t: 0, icon: !!a.icon, r: a.r || 0 }); taken++; falling--; motes.splice(i, 1); }
        continue;
      }
      if (m.life < 1) m.life = Math.min(1, m.life + dt * m.grow);
      if (wx) {   // rain falls, snow drifts down; neither is drawn into the light
        const fall = wx === 'rain' ? 1.5 + m.z * 2.4 : 0.22 + m.z * 0.42, sway = wx === 'snow' ? Math.sin(T * 0.55 + m.ph) * 0.28 : -0.14;
        m.vx += (sway - m.vx) * 0.05; m.vy += (fall - m.vy) * 0.05; m.x += m.vx * step; m.y += m.vy * step;
        if (m.y > H + 30) { m.y = -30; m.x = Math.random() * W; } if (m.x < -30) m.x = W + 30; if (m.x > W + 30) m.x = -30;
        continue;
      }
      const fx = Math.sin(m.y * 0.005 + T * 0.1 + m.ph) * 0.065 + 0.02, fy = Math.cos(m.x * 0.004 - T * 0.08 + m.ph) * 0.05 - 0.028;
      let ax = 0, ay = 0;
      const focus = Math.abs(m.z - 0.45), pull = Math.max(0, 1 - focus * 2.4) * m.life;
      if (pull > 0 && lights.length) {
        let best = null, ba = null;
        for (const a of lights) { const n = near(a, m.x, m.y); if (!best || n[2] < best[2]) { best = n; ba = a; } }
        const [px, py, d] = best;
        // close in, in open space (not under a card, where it couldn't be seen): it falls the rest of the way, over the page
        if (d < (ba.icon ? 58 : 46) && pull > 0.3 && falling < 1 && T - (m.chk || 0) > 2 && T - lastFall > 1.6) {
          m.chk = T;
          if (Math.random() < 0.4 && open(m.x, m.y)) { lastFall = T; m.fall = { key: ba.key, t: 0, dur: 1.5 + Math.random() * 1.1, x0: m.x, y0: m.y, bend: (Math.random() - 0.5) * 2 }; falling++; continue; }
        }
        // gravity: gentle far off, stronger near the light, nothing beyond about 240px
        const g = (0.002 + 0.22 / (d + 16)) * pull * Math.max(0, Math.min(1, (240 - d) / 140)) * (ba.w || 1);
        ax = (px - m.x) / d * g; ay = (py - m.y) / d * g;
      }
      m.vx += (fx * (0.4 + m.z) - m.vx) * 0.02 + ax; m.vy += (fy * (0.4 + m.z) - m.vy) * 0.02 + ay;
      if (ptr.on) { const ddx = m.x - ptr.x, ddy = m.y - ptr.y, d2 = ddx * ddx + ddy * ddy; if (d2 < 9000) { const k = (1 - d2 / 9000) * 0.06; m.vx += ptr.vx * k + ddx * 0.0006; m.vy += ptr.vy * k + ddy * 0.0006; } }
      m.x += m.vx * step; m.y += m.vy * step;
      if (m.x < -30) m.x = W + 30; if (m.x > W + 30) m.x = -30; if (m.y < -30) m.y = H + 30; if (m.y > H + 30) m.y = -30;
    }
    const alive = motes.reduce((n, m) => n + (m.die || m.fall ? 0 : 1), 0);
    if (alive < target && Math.random() < Math.min(0.5, (target - alive) * 0.02) * step) motes.push(mote(false));
    if (alive > target + 10) motes.length = target;
    for (let i = pulses.length - 1; i >= 0; i--) { pulses[i].t += dt; if (pulses[i].t > 1.4) pulses.splice(i, 1); }
    if (ptr.on) { ptr.vx *= 0.9; ptr.vy *= 0.9; }
  }
  function drawDust(T) {
    const day = !night(), spr = SPR[day ? 'day' : 'night'];
    dx.setTransform(D, 0, 0, D, 0, 0); dx.clearRect(0, 0, W, H);
    dx.globalCompositeOperation = day ? 'source-over' : 'lighter';
    for (const m of motes) {
      if (m.fall) continue;   // drawn over the page, on the light's canvas (drawFalls)
      const focus = Math.abs(m.z - 0.45), level = Math.min(4, Math.floor(focus * 9));
      const size = (1.4 + m.z * m.z * 9) * (1 + level * 0.5) * (m.die ? 1 - m.die * 0.75 : 0.4 + 0.6 * m.life);
      let a = (0.1 + 0.3 * (1 - focus)) * (0.65 + 0.35 * Math.sin(T * m.tw * 0.45 + m.ph));
      if (focus < 0.45 && lights.length) { let d = 1e9; for (const l of lights) d = Math.min(d, near(l, m.x, m.y)[2]); a += Math.exp(-d / 26) * 0.5; }
      if (ptr.on) a += Math.max(0, 1 - Math.hypot(m.x - ptr.x, m.y - ptr.y) / 90) * 0.3;
      a *= m.die ? 1 + m.die * 1.2 : m.life;
      if (wx === 'rain' && !m.die) { const ln = 5 + m.z * 13; dx.globalAlpha = 1; dx.strokeStyle = day ? `rgba(40,44,50,${Math.min(1, a * 0.45)})` : `rgba(195,228,255,${Math.min(1, a * 0.7)})`; dx.lineWidth = 0.5 + m.z * 0.7; dx.beginPath(); dx.moveTo(m.x - ln * 0.1, m.y - ln); dx.lineTo(m.x, m.y); dx.stroke(); continue; }
      dx.globalAlpha = Math.min(1, a * (day ? 0.62 : 1)); dx.drawImage(spr[m.die ? 0 : level], m.x - size, m.y - size, size * 2, size * 2);
    }
    dx.globalAlpha = 1;
    dx.globalCompositeOperation = 'source-over';
  }
  // ---- pull to refresh: read from the page's own indicator (its opacity is how far it's pulled; .spin, loading) ----
  const PULLS = '#hpull,.ptr', pullSt = new WeakMap();
  if (!document.getElementById('pl-pull-css')) document.head.insertAdjacentHTML('beforeend', '<style id="pl-pull-css">html[data-look="layers"] :is(#hpull,.ptr){background:none!important;border:0!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}html[data-look="layers"] :is(#hpull,.ptr) svg{visibility:hidden}</style>');
  function drawPulls(T, dt, day, still) {
    for (const el of document.querySelectorAll(PULLS)) {
      let st = pullSt.get(el); if (!st) pullSt.set(el, st = { spun: false, t: 0, flare: 0, k: 0 });
      const spin = el.classList.contains('spin'), want = spin ? 1 : Math.max(0, Math.min(1, parseFloat(getComputedStyle(el).opacity) || 0));
      st.k += (want - st.k) * (still ? 1 : Math.min(1, dt * 14));
      if (spin) { st.spun = true; st.t += dt; } else if (st.spun) { st.spun = false; st.t = 0; st.flare = 1; }
      st.flare = Math.max(0, st.flare - dt / 1.1);
      const k = st.k, f = still ? 0 : Math.sin(Math.PI * Math.min(1, (1 - st.flare) * 1.6)) * (st.flare > 0 ? 1 : 0);
      if (k < 0.02 && st.flare <= 0) continue;
      const r = el.getBoundingClientRect(), y = r.top + r.height / 2, cx = W / 2, full = W / 2 - 24;
      const hw = spin || st.flare > 0 ? full : full * (1 - (1 - k) ** 2), alpha = spin ? 0.6 : st.flare > 0 ? 0.6 * st.flare : 0.25 + 0.6 * k;
      const c = day ? '30,33,38' : '242,250,255';
      let g = lx.createLinearGradient(cx - hw, 0, cx + hw, 0);
      g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.5, `rgba(${c},${Math.min(1, alpha + f * 0.4).toFixed(3)})`); g.addColorStop(1, `rgba(${c},0)`);
      lx.save(); if (!day) { lx.shadowColor = `rgba(150,205,255,${(0.7 + f * 0.3).toFixed(2)})`; lx.shadowBlur = 8 + f * 16; }
      lx.fillStyle = g; lx.fillRect(cx - hw, y - 0.7, hw * 2, 1.4 + f * 1.2); lx.restore();
      if (spin && !still) {   // loading: a beam gliding back and forth along it
        const bx = cx + hw * 0.92 * Math.sin(st.t * 2.2), bw = 34;
        g = lx.createLinearGradient(bx - bw, 0, bx + bw, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, day ? 'rgba(30,33,38,.85)' : 'rgba(250,253,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        lx.save(); if (!day) { lx.shadowColor = 'rgba(170,215,255,.95)'; lx.shadowBlur = 12; } lx.fillStyle = g; lx.fillRect(bx - bw, y - 1, bw * 2, 2); lx.restore();
      }
      lights.push({ key: el, x0: cx - hw * 0.7, x1: cx + hw * 0.7, y, w: 1.4 });   // the dust is drawn into it
    }
  }
  // ---- sheets: one beam along the top edge as a sheet opens, then a faint hairline while it's open ----
  const SHEETS = '.sheet,[role="dialog"],.hsheet,.ipsy-panel';
  let sheets = [];
  function drawSheets(T, dt, frame, day, still) {
    if (frame % 3 === 0) {
      const now = [];
      for (const el of document.querySelectorAll(SHEETS)) {
        if (el.closest('[data-pearl-skip]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width < W * 0.5 || r.height < 120 || r.top > H - 60 || r.bottom < 60) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || +cs.opacity < 0.4 || cs.display === 'none') continue;
        if (sheets.some(s => s.el.contains(el) && s.el !== el)) continue;
        now.push(sheets.find(s => s.el === el) || { el, t: still ? 9 : 0 });
      }
      sheets = now.filter(s => !now.some(o => o !== s && o.el.contains(s.el)));   // the outermost sheet only
    }
    const c = day ? '30,33,38' : '255,255,255';
    for (const s of sheets) {
      if (!s.el.isConnected) continue;
      s.t += dt;
      const r = s.el.getBoundingClientRect(), rad = Math.min(28, parseFloat(getComputedStyle(s.el).borderTopLeftRadius) || 0), x0 = r.left + rad * 0.8, x1 = r.right - rad * 0.8, y = r.top + 0.8, len = x1 - x0;
      if (len < 40 || y > H || y < -2) continue;
      // the hairline it keeps, fading in as the beam passes
      const keep = Math.min(1, s.t / 1.4) * 0.45;
      let g = lx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.5, `rgba(${c},${(day ? 0.55 : 0.75) * keep})`); g.addColorStop(1, `rgba(${c},0)`);
      lx.fillStyle = g; lx.fillRect(x0, y - 0.5, len, 1);
      // the beam: once along the edge, left to right, slowing as it goes
      const u = s.t / 1.3;
      if (u < 1) {
        const e = 1 - (1 - u) ** 2.2, bx = x0 + len * e, bw = len * 0.22, a = Math.sin(Math.PI * Math.min(1, u * 1.15));
        g = lx.createLinearGradient(bx - bw, 0, bx + bw, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, day ? `rgba(30,33,38,${0.7 * a})` : `rgba(250,253,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        lx.save(); if (!day) { lx.shadowColor = `rgba(170,215,255,${0.9 * a})`; lx.shadowBlur = 12; }
        lx.fillStyle = g; lx.fillRect(Math.max(x0, bx - bw), y - 0.9, Math.min(x1, bx + bw) - Math.max(x0, bx - bw), 1.8); lx.restore();
      }
    }
  }
  // the motes falling into their light, and where each was taken in: over the page, on the light's canvas
  function drawFalls(T) {
    const day = !night(), spr = SPR[day ? 'day' : 'night'];
    lx.globalCompositeOperation = day ? 'source-over' : 'lighter';
    for (const m of motes) {
      if (!m.fall) continue;
      const f = m.fall, u = Math.min(1, f.t / f.dur), size = (2.6 + m.z * 4) * (1 - u * 0.5);
      // a faint tail behind it, longer as it speeds up
      if (f.lx != null && u > 0.15) {
        const tx = m.x + (f.lx - m.x) * 5, ty = m.y + (f.ly - m.y) * 5, g = lx.createLinearGradient(tx, ty, m.x, m.y), c = day ? '30,33,38' : '220,238,255';
        g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(1, `rgba(${c},${(day ? 0.2 : 0.28) * u})`);
        lx.strokeStyle = g; lx.lineWidth = day ? 0.8 : 1; lx.lineCap = 'round'; lx.beginPath(); lx.moveTo(tx, ty); lx.lineTo(m.x, m.y); lx.stroke();
      }
      f.lx = m.x; f.ly = m.y;
      lx.globalAlpha = Math.min(1, (0.4 + 0.4 * u) * (day ? 0.7 : 0.9));
      lx.drawImage(spr[0], m.x - size, m.y - size, size * 2, size * 2);
    }
    lx.globalAlpha = 1;
    for (const p of pulses) {
      const a = lights.find(l => l.key === p.key); if (a) { p.y = a.y; if (a.icon) p.x = a.x0; }   // stays with its light as you scroll
      const u = p.t / 1.4, k = Math.sin(Math.PI * Math.min(1, u * 2.5)) * (1 - u) ** 1.5;   // up quickly, then slowly away
      if (k <= 0.002) continue;
      if (p.icon) {   // the icon glows a moment
        const r = p.r * (0.7 + 0.5 * u), g = lx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, day ? `rgba(255,255,255,${0.5 * k})` : `rgba(210,235,255,${0.22 * k})`); g.addColorStop(1, 'rgba(210,235,255,0)');
        lx.fillStyle = g; lx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        if (day) { lx.beginPath(); lx.arc(p.x, p.y, p.r * (0.45 + 0.25 * u), 0, TAU); lx.strokeStyle = `rgba(30,33,38,${0.12 * k})`; lx.lineWidth = 0.8; lx.stroke(); }
      } else {   // the line brightens where it landed, spreading a little along it
        const w = 18 + 60 * u, c = day ? '30,33,38' : '255,255,255', g = lx.createLinearGradient(p.x - w, 0, p.x + w, 0);
        g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.5, `rgba(${c},${(day ? 0.45 : 0.55) * k})`); g.addColorStop(1, `rgba(${c},0)`);
        lx.fillStyle = g; lx.fillRect(p.x - w, p.y - 0.8, w * 2, 1.6);
        const r = 7 + 6 * u, h = lx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        h.addColorStop(0, day ? `rgba(255,255,255,${0.45 * k})` : `rgba(190,225,255,${0.2 * k})`); h.addColorStop(1, 'rgba(190,225,255,0)');
        lx.fillStyle = h; lx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      }
    }
    lx.globalCompositeOperation = 'source-over';
  }

  // ---- what's lit: the strip under the title, and the top edges of boxes ----
  const HEADS = '.title,.head h1,.top h1,header h1,.masthead h1,.hx-title,.ptitle';
  const ICONS = '.orb.pebble,img[src*="icon-pebble"],img[src*="icon-layers"]';
  let boxes = [], icons = [], hairs = [], strip = null, lights = [], scanAt = 0;
  // open space: what's at the point is the page itself, not a box or an icon (a mote under a card can't be seen)
  const open = (x, y) => { if (x < 0 || y < 0 || x > W || y > H) return false; const e = document.elementFromPoint(x, y);
    return !e || !(boxes.some(b => b.el.contains(e)) || icons.some(i => i.el.contains(e)) || e.closest('[role="dialog"],[aria-modal="true"],.sheet,.scrim,.ipsy-wrap')); };
  // a box: a ground of its own and rounded corners, most of the screen's width, not fixed (bars, sheets, toasts are)
  function scan() {
    scanAt = performance.now();
    const out = [], seen = new Set();
    for (const el of document.body.querySelectorAll('div,section,article,li,a,button,form,details,label,nav')) {
      if (el.dataset.pearl != null || el.closest('[data-pearl-skip]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < W * 0.42 || r.height < 34 || r.height > H * 0.8 || r.bottom < -240 || r.top > H + 480) continue;
      const cs = getComputedStyle(el), rad = parseFloat(cs.borderTopLeftRadius) || 0;
      if (rad < 12 || cs.position === 'fixed' || cs.visibility === 'hidden' || +cs.opacity < 0.5) continue;
      if (/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) && cs.backgroundImage === 'none') continue;
      const keep = boxes.find(b => b.el === el);
      out.push(keep || { el, rad, lb: 0.1, seen: false });
      seen.add(el);
      if (out.length >= 48) break;
    }
    boxes = out;
    // the apps' icons: aOS Home's pebbles, and every Pearl icon on the page (search, the store, an app's own screens)
    icons = [];
    for (const el of document.body.querySelectorAll(ICONS)) {
      const r = el.getBoundingClientRect();
      if (r.width < 22 || r.width > 140 || r.bottom < -240 || r.top > H + 480 || el.closest('[data-pearl-skip]')) continue;
      icons.push(icons.find(i => i.el === el) || { el });
      if (icons.length >= 40) break;
    }
    // a page's own hairlines (data-pl-line: Weather's, between its parts with no cards): lit like the boxes' edges
    hairs = [...document.querySelectorAll('[data-pl-line]')].slice(0, 12).map(el => hairs.find(h => h.el === el) || { el, lb: 0.1 });
    // the title's strip: under the title's own header, if it sits near the top
    strip = null;
    const t = [...document.querySelectorAll(HEADS)].find(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.bottom > 0 && r.top < H * 0.4 && getComputedStyle(e).visibility !== 'hidden'; });
    if (t) {
      let a = t.closest('.head,.top,header,.masthead,.hd') || t;
      if (a.getBoundingClientRect().height > H * 0.4) a = t;
      strip = { el: a, beam: 0.5 };
    }
  }
  // what you'd see at a point: the box itself (or what's in it), not something over it
  const shows = (el, x, y) => { if (x < 0 || y < 0 || x > W || y > H) return false; const top = document.elementFromPoint(x, y); return !!top && (top === el || el.contains(top)); };

  function drawLight(T, dt, frame) {
    const day = !night(), still = reduce();
    lx.setTransform(D, 0, 0, D, 0, 0); lx.clearRect(0, 0, W, H);
    lights = [];
    const eye = H * EYE;
    lx.globalCompositeOperation = day ? 'source-over' : 'lighter';
    for (const b of boxes) {
      if (!b.el.isConnected) continue;
      const r = b.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > H || r.width === 0) { b.vis = false; continue; }
      if (frame % 4 === 0 || b.vis == null) b.vis = shows(b.el, r.left + r.width / 2, r.top + 3);
      const want = 0.1 + 0.9 * Math.exp(-(((r.top - eye) / 85) ** 2));
      b.lb += (want - b.lb) * (still ? 1 : Math.min(1, dt * 2.6));
      if (!b.vis) continue;
      const x0 = r.left + Math.min(b.rad, r.width * 0.12), x1 = r.right - Math.min(b.rad, r.width * 0.12), y = r.top + 1, cx = (x0 + x1) / 2, hw = (x1 - x0) / 2;
      let g = lx.createLinearGradient(x0, 0, x1, 0);
      const c = day ? '30,33,38' : '255,255,255';
      g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.5, `rgba(${c},${(day ? 0.85 : 1) * b.lb})`); g.addColorStop(1, `rgba(${c},0)`);
      lx.fillStyle = g; lx.fillRect(x0, y, x1 - x0, day ? 1.2 : 1.4);
      // the light spilling just inside, under the edge
      lx.save(); lx.translate(cx, y); lx.scale(1, 34 / hw);
      g = lx.createRadialGradient(0, 0, 0, 0, 0, hw);
      g.addColorStop(0, day ? `rgba(255,255,255,${0.75 * b.lb})` : `rgba(150,205,255,${0.26 * b.lb})`); g.addColorStop(0.45, day ? `rgba(255,255,255,${0.25 * b.lb})` : `rgba(150,205,255,${0.07 * b.lb})`); g.addColorStop(1, 'rgba(150,205,255,0)');
      lx.fillStyle = g; lx.fillRect(-hw, 0, hw * 2, hw); lx.restore();
      lights.push({ key: b.el, x0: cx - hw * 0.6, x1: cx + hw * 0.6, y, w: 0.25 + b.lb * 1.1 });
    }
    // the strip: a quiet line, and a beam that glides slowly back and forth along it
    if (strip && strip.el.isConnected) {
      const r = strip.el.getBoundingClientRect(), y = r.bottom + 7, x0 = Math.max(8, r.left + 4), x1 = Math.min(W - 8, Math.max(r.right, W - r.left) - 4);
      if (frame % 4 === 0 || strip.vis == null) strip.vis = !covered((x0 + x1) / 2, y);
      if (y > 0 && y < H * 0.5 && strip.vis) {
        const len = x1 - x0, bx = x0 + len * (still ? 0.5 : 0.5 + 0.46 * Math.sin(T * 0.24)), bw = len * 0.3;
        let g = lx.createLinearGradient(x0, 0, x1, 0);
        const base = day ? '30,33,38' : '235,246,255';
        g.addColorStop(0, `rgba(${base},0)`); g.addColorStop(0.12, `rgba(${base},${day ? 0.32 : 0.28})`); g.addColorStop(0.88, `rgba(${base},${day ? 0.32 : 0.28})`); g.addColorStop(1, `rgba(${base},0)`);
        lx.fillStyle = g; lx.fillRect(x0, y - 0.5, len, 1);
        g = lx.createLinearGradient(bx - bw, 0, bx + bw, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, day ? 'rgba(255,255,255,.95)' : 'rgba(250,253,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        lx.save(); lx.shadowColor = day ? 'rgba(255,255,255,.9)' : 'rgba(170,215,255,.95)'; lx.shadowBlur = day ? 6 : 12;
        lx.fillStyle = g; lx.fillRect(Math.max(x0, bx - bw), y - 0.9, Math.min(x1, bx + bw) - Math.max(x0, bx - bw), 1.8); lx.restore();
        lights.push({ key: strip.el, x0: x0 + len * 0.12, x1: x1 - len * 0.12, y, w: 1.3 });
      }
    }
    // a page's own hairlines: brightest where your eyes rest, as the boxes' edges are
    for (const hr of hairs) {
      if (!hr.el.isConnected) continue;
      const r = hr.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > H || !r.width) continue;
      if (frame % 4 === 0 || hr.vis == null) hr.vis = !hidden(hr.el, r.left + r.width / 2, r.top + r.height / 2);
      if (!hr.vis) continue;   // a sheet or a dialog over it
      const want = 0.12 + 0.88 * Math.exp(-(((r.top - eye) / 95) ** 2));
      hr.lb += (want - hr.lb) * (still ? 1 : Math.min(1, dt * 2.6));
      const y = r.top + r.height / 2, cx = r.left + r.width / 2, hw = r.width / 2, c = day ? '30,33,38' : '255,255,255';
      let g = lx.createLinearGradient(r.left, 0, r.right, 0);
      g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.5, `rgba(${c},${(day ? 0.75 : 0.95) * hr.lb})`); g.addColorStop(1, `rgba(${c},0)`);
      lx.fillStyle = g; lx.fillRect(r.left, y - 0.6, r.width, day ? 1.1 : 1.3);
      if (!day) { lx.save(); lx.translate(cx, y); lx.scale(1, 10 / hw); g = lx.createRadialGradient(0, 0, 0, 0, 0, hw);
        g.addColorStop(0, `rgba(150,205,255,${0.3 * hr.lb})`); g.addColorStop(1, 'rgba(150,205,255,0)'); lx.fillStyle = g; lx.fillRect(-hw, -hw, hw * 2, hw * 2); lx.restore(); }
      lights.push({ key: hr.el, x0: cx - hw * 0.5, x1: cx + hw * 0.5, y, w: 0.3 + hr.lb });
    }
    // each icon: a point of light at its middle, pulling a little less than the lines
    for (const i of icons) {
      if (!i.el.isConnected) continue;
      const r = i.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (r.bottom < 0 || r.top > H || !r.width) { i.vis = false; continue; }
      if (frame % 4 === 0 || i.vis == null) i.vis = shows(i.el, cx, cy);
      if (i.vis) lights.push({ key: i.el, icon: true, x0: cx, x1: cx, y: cy, r: r.width * 0.62, w: 0.8 });
    }
    drawSheets(T, dt, frame, day, still);
    drawPulls(T, dt, day, still);
    drawFalls(T);
    lx.globalCompositeOperation = 'source-over';
  }
  // a hairline on the page: hidden while a sheet or a dialog (anything it isn't inside) is over it
  const hidden = (el, x, y) => { if (y < 0 || y > H) return true; const e = document.elementFromPoint(x, y); return !!e && !!e.closest(SHEETS + ',[aria-modal="true"],.scrim') && !e.closest(SHEETS + ',[aria-modal="true"],.scrim').contains(el); };
  // the strip sits on the page itself: hidden while a sheet or a dialog is over it
  const covered = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && !!e.closest('[role="dialog"],[aria-modal="true"],.sheet,.scrim') && !strip.el.contains(e); };

  // ---- sections: each section's title set into a bright line of light ----
  // Pearl clears the cards' grounds, and the same faint hairline parted two cards and two sections, so you couldn't tell
  // where a section began (the owner: Home's Favorites, where the thermostats end and the lights begin). So each section's
  // title sits in light: a short stub, the title, then a bright line to the edge (or to what sits beside the title: a
  // count, a button). The cards keep their hairlines and stay where the app put them (a rail with a dot at each card was
  // tried and taken out: too busy). A title moves right to sit after its stub; a group's own title inside it (an aisle of
  // a shopping list) stays put with a line after it, a size smaller, as is a title that would wrap; titles are Unbounded,
  // glowing a little at night. It's one pseudo-element of the title (its ::before, or ::after when the app uses ::before;
  // else of the section around it), painted from backgrounds this measures into custom properties (the rules are Pearl's,
  // aOS/scripts/looks.mjs: data-pl-*): so it scrolls with the page, in a sheet as anywhere, and nothing is added to the
  // page. Measured again when the page changes (a section added or folded, a font loaded), never while you scroll. An app
  // can mark its own titles with data-pl-head, and keep a part of a page out of it with data-pl-norail.
  const marks = (() => {
    const HEADS = '.sechead,.sect,.daylbl,.dayhead,.mhead,.vsec-h,.group > h2:first-child,p.label:has(+ .rgroup),[data-pl-head]';   // (Places' lists; Drinks' Analysis; Calendar's .evhead heads an event, not a section)
    const CARDS = '.card,.rgroup,.group,.box,.obox,.ocard,.tripwrap,.trip,.tcard,.upcard,.lead,.chartcard,.kpis,.sum,.notice,.stats,.tl,.addbox,.wstrip,.dg,.lroom,.agw,.lpw,[data-pl-card]';
    const ATTRS = ['data-pl-sec', 'data-pl-wrap', 'data-pl-title', 'data-pl-draw', 'data-pl-pos', 'data-pl-shift'];
    const VARS = ['--pl-x', '--pl-y', '--pl-w', '--pl-h', '--pl-bg', '--pl-pad'];
    const STUB = 14, GAP = 10, EDGE = 12;   // the stub, and its gap to the title; the stub in from the column's edge
    const pad = new WeakMap(), watched = new WeakSet();
    let live = new Set(), pending = 0, lastPass = 0, ro = null, mo = null, started = false;
    const n1 = v => Math.round(v * 10) / 10;
    const attr = (el, k, v) => { if (v == null) { if (el.hasAttribute(k)) el.removeAttribute(k); } else if (el.getAttribute(k) !== v) el.setAttribute(k, v); };
    const prop = (el, k, v) => { if (v == null) { if (el.style.getPropertyValue(k)) el.style.removeProperty(k); } else if (el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v); };
    const shift = el => el.hasAttribute('data-pl-shift') ? (parseFloat(getComputedStyle(el).paddingLeft) || 0) - (pad.get(el) || 0) : 0;
    const scopeOf = el => el.closest('[role="dialog"],[aria-modal="true"],dialog,.sheet,.st-sheet') || document.body;
    // the first words in it that are on screen (a title's own text)
    const words = el => {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), r = document.createRange();
      for (let t = w.nextNode(), n = 0; t && n < 40; t = w.nextNode(), n++) {
        if (!t.textContent.trim()) continue;
        r.selectNodeContents(t); const b = r.getBoundingClientRect();
        if (b.width && b.height) return { node: t, r: b };
      }
      return null;
    };
    const lines = node => { const rg = document.createRange(); rg.selectNodeContents(node); return new Set([...rg.getClientRects()].filter(b => b.width).map(b => Math.round(b.top))).size; };
    // a pseudo-element the app doesn't use, to draw with
    const slot = el => {
      const had = el.getAttribute('data-pl-draw'); if (had) return had;
      for (const [k, p] of [['b', '::before'], ['a', '::after']]) { const c = getComputedStyle(el, p).content; if (c === 'none' || c === 'normal') return k; }
      return null;
    };
    // it can hold the drawing: nothing clipped at its edges, and made a containing block without moving anything in it
    const host = el => {
      const cs = getComputedStyle(el);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') return false;
      if (cs.position !== 'static' || el.hasAttribute('data-pl-pos')) return true;
      let n = 0;
      for (const d of el.querySelectorAll('*')) { if (++n > 400 || getComputedStyle(d).position === 'absolute') return false; }
      return true;
    };
    // the left edge of what the drawing would be cut at: the nearest box around it that clips (or its sheet, or the screen)
    const clipLeft = el => {
      let x = 0;
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX !== 'visible' || a === document.body || cs.position === 'fixed') x = Math.max(x, a.getBoundingClientRect().left + (parseFloat(cs.borderLeftWidth) || 0));
        if (cs.position === 'fixed') break;
      }
      return x;
    };
    const drawer = x => {   // the title; else the section around it (News's: its title holds a menu that can't move)
      for (const el of [x.head, x.wrap || x.head.parentElement]) { if (!el || el === document.body) continue; const s = slot(el); if (s && host(el)) return { el, s }; }
      return null;
    };

    function pass() {
      pending = 0; lastPass = performance.now();
      if (!on() || !document.body) return;
      const VW = innerWidth, secs = [];
      // 1. the titles on the page
      for (const el of document.body.querySelectorAll(HEADS)) {
        if (el.closest('[data-pearl-skip],[data-pl-norail],[hidden],[aria-hidden="true"],button,summary,a,[role="menu"],.menu,.dmenu,.pmenu,.viewmenu,.tagmenu')) continue;   // a sender, a link, a menu's label
        const r = el.getBoundingClientRect();
        if (r.width < VW * 0.42 || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
        let h = el, hr = r;
        if (el.querySelector(CARDS)) {   // a section holding its title and its cards (News's .sect): the title is its first part
          h = el.firstElementChild; if (!h || h.matches(CARDS)) continue;
          hr = h.getBoundingClientRect(); if (hr.width < VW * 0.42 || !hr.height) continue;
        }
        const t = words(h); if (!t) continue;
        const x = { head: h, wrap: h !== el ? el : null, hr, t, sub: !!(el.parentElement && el.parentElement.closest(CARDS)), scope: scopeOf(el) };
        x.d = drawer(x); if (x.d) secs.push(x);
      }
      // 2. where the stubs start: the same in from the edge for every title in a sheet (or on the page)
      const edgeAt = new Map();
      for (const x of secs) edgeAt.set(x.scope, Math.min(edgeAt.has(x.scope) ? edgeAt.get(x.scope) : Infinity, x.hr.left));
      const now = new Set(), mark = (el, k, v) => { attr(el, k, v); now.add(el); };
      const shiftTo = (el, by) => {   // move its content right by `by` (from where the app put it)
        if (!pad.has(el) || !el.hasAttribute('data-pl-shift')) pad.set(el, parseFloat(getComputedStyle(el).paddingLeft) || 0);
        if (by > 0.5) { mark(el, 'data-pl-shift', ''); prop(el, '--pl-pad', n1(pad.get(el) + by) + 'px'); }
        else { attr(el, 'data-pl-shift', null); prop(el, '--pl-pad', null); }
      };
      for (const x of secs) {
        x.at = Math.max(clipLeft(x.d.el), edgeAt.get(x.scope)) + EDGE;
        mark(x.d.el, 'data-pl-draw', x.d.s);
        if (getComputedStyle(x.d.el).position === 'static' || x.d.el.hasAttribute('data-pl-pos')) mark(x.d.el, 'data-pl-pos', '');
        mark(x.head, 'data-pl-sec', '');
        const te = x.t.node.parentElement; if (te) mark(te, 'data-pl-title', x.sub ? 'sub' : te.getAttribute('data-pl-title') === 'fit' ? 'fit' : '');
        x.te = te;
        const p = x.wrap || x.head.parentElement; if (p && p.firstElementChild === x.head && p !== document.body) mark(p, 'data-pl-wrap', '');
        shiftTo(x.head, x.sub ? 0 : x.at + STUB + GAP - (x.t.r.left - shift(x.head)));   // a group's own title stays where the app put it
      }
      // a title that no longer fits on one line in Unbounded: a size smaller (tried once, then kept)
      let refit = false;
      for (const x of secs) if (x.te && x.te.getAttribute('data-pl-title') === '') {
        const t = words(x.head); if (t && lines(t.node) > 1) { attr(x.te, 'data-pl-title', 'fit'); refit = true; }
      }
      if (refit) document.body.offsetWidth;
      // 3. measure again (titles moved, fonts changed) and paint
      for (const x of secs) {
        const t = words(x.head); if (!t) continue;
        const rg = document.createRange(); rg.selectNodeContents(t.node); t.r = rg.getClientRects()[0] || t.r;   // its first line
        const D = x.d.el, dr = D.getBoundingClientRect(), dcs = getComputedStyle(D);
        const ox = dr.left + (parseFloat(dcs.borderLeftWidth) || 0), oy = dr.top + (parseFloat(dcs.borderTopWidth) || 0);
        const hr = x.head.getBoundingClientRect(), hcs = getComputedStyle(x.head), y = n1(t.r.top + t.r.height / 2);
        let end = hr.right - (parseFloat(hcs.paddingRight) || 0);
        for (const e of x.head.querySelectorAll('*')) {   // what sits beside the title (a count, a button): the line stops short of it
          if (e.contains(t.node)) continue;
          const b = e.getBoundingClientRect(); if (b.width && b.height && b.left > t.r.right + 2 && b.bottom > t.r.top && b.top < t.r.bottom) end = Math.min(end, b.left - GAP);
        }
        const L = [], C = 'var(--pl-line)', G = 'var(--pl-glow)';
        let x0 = Infinity, x1 = -Infinity;
        const line = (a, b, fade) => {   // a bright line with its glow, from a to b
          if (b - a < 4) return;
          L.push([`linear-gradient(90deg,${C},${C} ${fade ? 86 : 100}%,${fade ? 'color-mix(in srgb,var(--pl-line) 45%,transparent)' : C})`, a, 7.5, b - a, 3]);
          L.push([`linear-gradient(transparent,${G},transparent)`, a, 0, b - a, 18]);
          x0 = Math.min(x0, a); x1 = Math.max(x1, b);
        };
        if (!x.sub && t.r.left - GAP - x.at >= 4) line(x.at, t.r.left - GAP, false);   // the stub
        if (end - (t.r.right + 12) >= 24) line(t.r.right + 12, end, true);
        if (!L.length) { for (const k of ['--pl-x', '--pl-y', '--pl-w', '--pl-h', '--pl-bg']) prop(D, k, null); continue; }
        prop(D, '--pl-x', n1(x0 - ox) + 'px'); prop(D, '--pl-y', n1(y - 9 - oy) + 'px');
        prop(D, '--pl-w', n1(x1 - x0) + 'px'); prop(D, '--pl-h', '18px');
        prop(D, '--pl-bg', L.map(([img, lx, ly, w, h]) => `${img} ${n1(lx - x0)}px ${ly}px/${n1(w)}px ${h}px no-repeat`).join(','));
        for (const e of [D, x.head]) if (ro && !watched.has(e)) { watched.add(e); ro.observe(e); }
      }
      // 4. what was marked before and isn't now: back as the app drew it
      for (const el of live) if (!now.has(el)) {
        for (const k of ATTRS) el.removeAttribute(k);
        for (const k of VARS) el.style.removeProperty(k);
      }
      for (const el of now) if (!el.hasAttribute('data-pl-draw')) for (const k of ['--pl-x', '--pl-y', '--pl-w', '--pl-h', '--pl-bg']) el.style.removeProperty(k);
      live = now;
    }
    const schedule = () => {
      if (pending || !on()) return;
      pending = setTimeout(() => requestAnimationFrame(pass), Math.max(16, 160 - (performance.now() - lastPass)));
    };
    const start = () => {
      if (!started && document.body) {
        started = true;
        ro = new ResizeObserver(schedule); ro.observe(document.body);
        mo = new MutationObserver(ms => { if (ms.some(m => [...m.addedNodes, ...m.removedNodes].some(n => n.nodeType === 1 && !(n.dataset && n.dataset.pearl != null)))) schedule(); });
        mo.observe(document.body, { childList: true, subtree: true });
        addEventListener('resize', schedule);
        for (const ev of ['transitionend', 'animationend', 'toggle']) document.addEventListener(ev, schedule, true);
        if (document.fonts) { document.fonts.addEventListener('loadingdone', schedule); document.fonts.ready.then(schedule); }
      }
      schedule();
    };
    return { start, pass, stats: () => [...live].filter(e => e.hasAttribute('data-pl-draw')).length };
  })();

  // ---- the clock ----
  let raf = 0, last = 0, frame = 0, running = false;
  const away = () => document.hidden || held || !on()
    || (isAOS && document.body && document.body.classList.contains('in-app'))
    || (() => { try { return !!(window.frameElement && window.frameElement.closest('[hidden]')); } catch { return false; } })();
  function tick(now) {
    raf = 0;
    if (away()) return stop();
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    if (now - last < 30 && last) { raf = requestAnimationFrame(tick); return; }   // about 30 frames a second is plenty for something this slow
    last = now; frame++;
    const T = now / 1000;
    if (innerWidth !== W || innerHeight !== H) size();
    if (now - scanAt > 1500) scan();
    if (Date.now() - wxAt > 60e3) readWx();
    if (!reduce()) stepDust(T, dt); else par = 0;
    drawDust(T); drawLight(T, dt, frame);
    raf = requestAnimationFrame(tick);
  }
  function start() {
    if (running || away() || !document.body) return;
    running = true;
    if (!dustC.isConnected) document.body.prepend(dustC);
    if (!lightC.isConnected) document.body.append(lightC);
    dustC.style.display = lightC.style.display = 'block';
    size(); readWx(); scan(); marks.start();
    if (motes.length < target * 0.5) motes = Array.from({ length: target }, () => mote(true));
    last = 0; raf = requestAnimationFrame(tick);
  }
  function stop() {
    running = false; if (raf) cancelAnimationFrame(raf); raf = 0;
    dustC.style.display = lightC.style.display = 'none';
  }
  const check = () => (away() ? stop() : start());
  new MutationObserver(check).observe(root, { attributes: true, attributeFilter: ['data-look', 'data-theme'] });
  document.addEventListener('visibilitychange', check);
  addEventListener('pageshow', check); addEventListener('focus', check);
  // depth: how far the page (or whatever scrolled) moved since the last frame; each mote moves with it by its depth
  let par = 0;
  const lastTop = new WeakMap();
  addEventListener('scroll', e => {
    scanAt = 0;
    const el = e.target === document ? document.scrollingElement : e.target;
    if (!el || el.scrollTop == null) return;
    const y = el.scrollTop, was = lastTop.get(el); lastTop.set(el, y);
    if (was != null && Math.abs(y - was) < 400) par += y - was;   // not a jump (a new page, a reset)
  }, { passive: true, capture: true });
  setInterval(check, 1500);   // an app's frame shown or put away, aOS Home covered or uncovered
  window.aosPearl = { pause: () => { held = true; stop(); }, resume: () => { held = false; check(); }, running: () => running, sections: () => { marks.pass(); return marks.stats(); },
    stats: () => ({ sheets: sheets.length, motes: motes.length, lights: lights.length, icons: lights.filter(l => l.icon).length, falling, taken, falls: motes.filter(m => m.fall).map(m => [Math.round(m.x), Math.round(m.y), +(m.fall.t / m.fall.dur).toFixed(2), m.fall.key && m.fall.key.className && String(m.fall.key.className.baseVal ?? m.fall.key.className)]) }) };   // for the tests
  if (document.body) check(); else addEventListener('DOMContentLoaded', check);
})();
