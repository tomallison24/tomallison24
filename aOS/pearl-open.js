// Pearl (data-look 'layers', the look it replaced): an app opening from aOS Home powers on, and powers off as it closes.
//   - On (aosPearlOpen(from, win)): a spark at the app's icon; its outline lights up and grows out to the edge of the
//     screen as two points of light running round it, each with a fading tail, meeting at the bottom; the outline
//     flickers on as it catches, like a tube lighting; then the app's window powers up from a bright line across the
//     middle, opening top and bottom as an old screen does, and the light dies away. A little dust is carried out with it.
//   - Off (aosPearlClose(win)): the window folds back into a bright line across the middle, which fades.
// Drawn on a canvas of its own, over everything (home/pearl.js stops while an app is open); the window's reveal is its
// clip-path, set here frame by frame and cleared at the end (aOS/index.html's Pearl rules hold it open or shut after).
// Outside Pearl, or with Reduce Motion, nothing: the window simply shows (aOS/home-tab.js show()).
'use strict';
(() => {
  const root = document.documentElement, TAU = Math.PI * 2;
  const pearl = () => root.dataset.look === 'layers';
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const night = () => root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  let cv = null, cx = null, run = null, raf = 0;
  function canvas() {
    if (!cv) {
      cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483001';
      cx = cv.getContext('2d');
    }
    if (!cv.isConnected) document.body.append(cv);
    const d = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(innerWidth * d); cv.height = Math.round(innerHeight * d);
    cx.setTransform(d, 0, 0, d, 0, 0);
    return cx;
  }
  const ease = u => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
  const out3 = u => 1 - (1 - u) ** 3;
  const clamp = (u, a, b) => Math.max(0, Math.min(1, (u - a) / (b - a)));
  // points round a rounded rectangle, clockwise from the middle of its top edge
  function ring(x, y, w, h, r, n = 220) {
    r = Math.min(r, w / 2, h / 2);
    const segs = [[w / 2 - r, 'h'], [r, 'a', -Math.PI / 2], [h - 2 * r, 'v'], [r, 'a', 0], [w - 2 * r, 'h-'], [r, 'a', Math.PI / 2], [h - 2 * r, 'v-'], [r, 'a', Math.PI], [w / 2 - r, 'h']];
    const len = segs.reduce((s, g) => s + (g[1] === 'a' ? g[0] * Math.PI / 2 : g[0]), 0), pts = [];
    for (let i = 0; i <= n; i++) {
      let d = len * i / n, px = x + w / 2, py = y, k = 0;
      for (const g of segs) {
        const L = g[1] === 'a' ? g[0] * Math.PI / 2 : g[0];
        if (d <= L || k === segs.length - 1) {
          if (g[1] === 'h') { px = (k === 0 ? x + w / 2 : x + r) + d; py = y; }
          else if (g[1] === 'v') { px = x + w; py = y + r + d; }
          else if (g[1] === 'h-') { px = x + w - r - d; py = y + h; }
          else if (g[1] === 'v-') { px = x; py = y + h - r - d; }
          else { const cxr = [x + w - r, x + w - r, x + r, x + r][[1, 3, 5, 7].indexOf(k)], cyr = [y + r, y + h - r, y + h - r, y + r][[1, 3, 5, 7].indexOf(k)], a = g[2] + d / r; px = cxr + r * Math.cos(a); py = cyr + r * Math.sin(a); }
          break;
        }
        d -= L; k++;
      }
      pts.push([px, py]);
    }
    return pts;
  }
  function stroke(c, pts, from, to, alpha, lw, col, glow) {
    if (to <= from || alpha <= 0.002) return;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = lw;
    if (glow) { c.shadowColor = `rgba(150,205,255,${Math.min(1, alpha)})`; c.shadowBlur = 10; }
    c.strokeStyle = `rgba(${col},${Math.min(1, alpha).toFixed(3)})`;
    c.beginPath(); c.moveTo(pts[from][0], pts[from][1]); for (let i = from + 1; i <= to; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); c.restore();
  }
  // a run of light from the start of the ring to `head`, bright at the head and fading behind it, in short pieces
  function tail(c, pts, head, len, alpha, col, glow, back) {
    const n = pts.length - 1, step = 4;
    for (let i = 0; i < len; i += step) {
      const a = alpha * (1 - i / len) ** 1.6;
      const s0 = back ? n - head + i : head - i - step, s1 = back ? n - head + i + step : head - i;
      stroke(c, pts, Math.max(0, Math.min(n, s0)), Math.max(0, Math.min(n, s1)), a, i < 6 ? 2 : 1.3, col, glow && i < 30);
    }
  }
  function frame(now) {
    raf = 0; if (!run) return;
    const c = canvas(), W = innerWidth, H = innerHeight, t = (now - run.t0) / 1000, dark = night(), col = dark ? '242,250,255' : '30,33,38', glow = dark;
    c.clearRect(0, 0, W, H);
    if (run.kind === 'on') {
      const r = run.r, END = 1.75;
      // the outline: from the icon out to the edge of the screen (inset a little, the phone's own rounded corners)
      const g = ease(clamp(t, 0.14, 0.78)), x = r.left + (8 - r.left) * g, y = r.top + (8 - r.top) * g, w = r.width + (W - 16 - r.width) * g, h = r.height + (H - 16 - r.height) * g;
      const rad = 15 + (38 - 15) * g, pts = ring(x, y, w, h, rad), n = pts.length - 1, half = n / 2;
      // a spark at the top of the icon
      const sp = Math.sin(Math.PI * clamp(t, 0, 0.32));
      if (sp > 0) { const gr = c.createRadialGradient(pts[0][0], pts[0][1], 0, pts[0][0], pts[0][1], 16); gr.addColorStop(0, `rgba(${dark ? '255,255,255' : col},${0.95 * sp})`); gr.addColorStop(1, `rgba(${dark ? '160,210,255' : col},0)`); c.fillStyle = gr; c.fillRect(pts[0][0] - 16, pts[0][1] - 16, 32, 32); }
      // two points of light racing round, one each way, meeting at the bottom
      const p = out3(clamp(t, 0.12, 0.78)), head = Math.round(p * half), len = Math.max(10, Math.min(90, half * 0.45));
      if (t < 0.95) { tail(c, pts, head, len, 1, col, glow, false); tail(c, pts, head, len, 1, col, glow, true); }
      // it catches: a few quick flickers, then holds, then dies away
      const FL = [[0.74, 0.8, 0.95], [0.8, 0.84, 0.12], [0.84, 0.9, 0.9], [0.9, 0.93, 0.35], [0.93, 1.1, 0.85]];
      let on = 0; for (const [a, b, v] of FL) if (t >= a && t < b) on = v;
      if (t >= 1.1) on = 0.85 * (1 - clamp(t, 1.1, END));
      if (on > 0) stroke(c, pts, 0, n, on, 1.3, col, glow);
      // the window powers up from a line across the middle, opening top and bottom
      const v = out3(clamp(t, 0.86, 1.36)), gap = (1 - v) * 50;
      if (run.win) run.win.style.clipPath = t < 0.86 ? 'inset(50% 0 50% 0)' : `inset(${gap.toFixed(2)}% 0 ${gap.toFixed(2)}% 0)`;
      if (t >= 0.82 && t < 1.5) {
        const ya = H / 2 - (H / 2) * v, yb = H / 2 + (H / 2) * v, a = t < 0.86 ? clamp(t, 0.82, 0.86) : 1 - clamp(t, 1.0, 1.5);
        for (const yy of v < 0.002 ? [H / 2] : [ya, yb]) {
          const gr = c.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.5, `rgba(${col},${(0.95 * a).toFixed(3)})`); gr.addColorStop(1, `rgba(${col},0)`);
          c.save(); if (glow) { c.shadowColor = `rgba(170,215,255,${a})`; c.shadowBlur = 14; } c.fillStyle = gr; c.fillRect(0, yy - 1, W, 2); c.restore();
        }
      }
      // a little dust, carried out with the light
      for (const m of run.dust) {
        const k = out3(clamp(t, 0.1 + m.dl, 1.2 + m.dl)), mx = m.x + (m.tx - m.x) * k, my = m.y + (m.ty - m.y) * k, a = Math.sin(Math.PI * k) * (dark ? 0.7 : 0.45);
        if (a <= 0) continue; c.fillStyle = `rgba(${col},${a.toFixed(3)})`; c.beginPath(); c.arc(mx, my, m.s, 0, TAU); c.fill();
      }
      if (t >= END) return end();
    } else {
      // off: the window folds into a bright line across the middle, which fades
      const v = clamp(t, 0, 0.3), gap = out3(v) * 50;
      if (run.win) run.win.style.clipPath = `inset(${gap.toFixed(2)}% 0 ${gap.toFixed(2)}% 0)`;
      const a = t < 0.3 ? 0.4 + 0.6 * v : 1 - clamp(t, 0.3, 0.75), yy = H / 2, w = t < 0.3 ? W : W * (1 - clamp(t, 0.3, 0.75));
      const gr = c.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0); gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.5, `rgba(${col},${(0.95 * a).toFixed(3)})`); gr.addColorStop(1, `rgba(${col},0)`);
      c.save(); if (glow) { c.shadowColor = `rgba(170,215,255,${a})`; c.shadowBlur = 14; } c.fillStyle = gr; c.fillRect(W / 2 - w / 2, yy - 1, w, 2); c.restore();
      if (t >= 0.75) return end();
    }
    raf = requestAnimationFrame(frame);
  }
  function end() {
    if (run && run.win) run.win.style.clipPath = '';
    run = null; if (cv) { cx.clearRect(0, 0, cv.width, cv.height); cv.remove(); }
  }
  // the canvas goes up at once, with the window's clip: waiting for the first frame left a frame with the window shut and nothing drawn
  function start(r) { if (raf) cancelAnimationFrame(raf); if (run && run.win) run.win.style.clipPath = ''; run = r; canvas(); raf = requestAnimationFrame(frame); }
  window.aosPearlOpen = (from, win) => {
    if (!pearl() || still()) return false;
    let r = from && from.isConnected ? from.getBoundingClientRect() : null;
    if (!r || !r.width) r = { left: innerWidth / 2 - 30, top: innerHeight / 2 - 30, width: 60, height: 60 };   // opened from a search or a link: from the middle
    const cxm = r.left + r.width / 2, cym = r.top + r.height / 2;
    const dust = Array.from({ length: 28 }, () => { const a = Math.random() * TAU, d = 30 + Math.random() * Math.max(innerWidth, innerHeight) * 0.6;
      return { x: cxm + Math.cos(a) * 8, y: cym + Math.sin(a) * 8, tx: cxm + Math.cos(a) * d, ty: cym + Math.sin(a) * d, s: 0.6 + Math.random() * 1.2, dl: Math.random() * 0.2 }; });
    if (win) win.style.clipPath = 'inset(50% 0 50% 0)';
    start({ kind: 'on', t0: performance.now(), r: { left: r.left, top: r.top, width: r.width, height: r.height }, win, dust });
    return true;
  };
  window.aosPearlClose = win => {
    if (!pearl() || still()) return false;
    start({ kind: 'off', t0: performance.now(), win });
    return true;
  };
})();
