// In Tron, aOS's screen trail (the red light running round the screen's edge: the :root::after of its <style id="grid">)
// now and then sends a shot to an app's icon: from where its light is, a light cycle's path (straight, with right-angle
// turns) to one of the nearest icons, then once round the icon's own trail (its Tron icon has the same line,
// aOS/scripts/make-looks.mjs: 26/512 in from the edge, corners rounded at 94/512), dying out as it goes. One at a time,
// every 4 to 10 seconds, and only on aOS's own screens (not over an open app or a sheet), with the page in view and
// motion allowed. Drawn on one canvas over the page, under the bar; it never takes a tap.
//   window.aosTronShots: fire() (one now, if it can), running() (a shot is on screen)
'use strict';
(() => {
  if (window.aosTronShots) return;
  const root = document.documentElement;
  const RED = '255,42,42', HOT = '255,227,224';
  const SPEED = 1.15, TAIL = 90, LOOP_MS = 900, WAIT = [4000, 10000];   // px per ms on the way; ms round the icon
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let cv = null, ctx = null, shot = null, timer = 0, last = null;

  const on = () => root.getAttribute('data-look') === 'grid' && !still.matches && !document.hidden
    && !document.querySelector('#appwin[aria-hidden="false"], .page.on');   // an app, or a sheet (Account, an app's page), open

  function canvas() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true'); cv.id = 'tronshots';
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:15;pointer-events:none';
    document.body.appendChild(cv);
    ctx = cv.getContext('2d');
    size(); addEventListener('resize', size);
  }
  function size() {
    if (!cv) return;
    const k = Math.min(3, devicePixelRatio || 1);
    cv.width = Math.round(innerWidth * k); cv.height = Math.round(innerHeight * k);
    ctx.setTransform(k, 0, 0, k, 0, 0);
  }

  // where the trail's light is now: the conic gradient's bright part (97 to 98.4% round from --tr-a), on the edge it runs on
  function head() {
    const cs = getComputedStyle(root, '::after');
    const top = parseFloat(cs.top) || 4, left = parseFloat(cs.left) || 4;
    const right = parseFloat(cs.right) || 4, bottom = parseFloat(cs.bottom) || 4;
    const box = { l: left, t: top, r: innerWidth - right, b: innerHeight - bottom };
    let a = null;
    try {
      const run = document.getAnimations().find(x => x.animationName === 'trRun' && x.effect && x.effect.pseudoElement === '::after');
      if (run && run.currentTime != null) { const d = run.effect.getTiming().duration || 7000; a = (run.currentTime % d) / d * 360; }
    } catch {}
    if (a == null) a = Math.random() * 360;
    const th = (a + 0.977 * 360) * Math.PI / 180, dx = Math.sin(th), dy = -Math.cos(th);   // 0deg is up, clockwise
    const cx = (box.l + box.r) / 2, cy = (box.t + box.b) / 2, hw = (box.r - box.l) / 2, hh = (box.b - box.t) / 2;
    const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    const x = cx + dx * t, y = cy + dy * t;
    const side = Math.abs(dx) * hh > Math.abs(dy) * hw ? (dx < 0 ? 'l' : 'r') : (dy < 0 ? 't' : 'b');
    return { x, y, side };
  }

  // the app icons on screen now (each app's own icon-*.png; in Tron, icon-grid-*), fully in view and clear of the bar
  const ICON = /\/icon(?:-[a-z]+)?-\d+\.png/;
  function icons() {
    const tab = document.querySelector('.tab:not([hidden])') || document;
    const bar = document.querySelector('.bar'), floor = bar ? bar.getBoundingClientRect().top - 6 : innerHeight - 90;
    return [...tab.querySelectorAll('img')].filter(img => ICON.test(img.getAttribute('src') || '')).map(img => ({ img, r: img.getBoundingClientRect() }))
      .filter(({ r }) => r.width >= 28 && r.top >= 40 && r.left >= 8 && r.right <= innerWidth - 8 && r.bottom <= floor);
  }

  // an icon's trail as points, clockwise, starting nearest p
  function ring(r, p) {
    const w = r.width, ins = w * 26 / 512, rad = w * 94 / 512;
    const x0 = r.left + ins, y0 = r.top + ins, x1 = r.right - ins, y1 = r.bottom - ins;
    const pts = [], arc = (cx, cy, a0) => { for (let i = 0; i <= 8; i++) { const a = (a0 + i * 90 / 8) * Math.PI / 180; pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]); } };
    arc(x1 - rad, y0 + rad, -90); arc(x1 - rad, y1 - rad, 0); arc(x0 + rad, y1 - rad, 90); arc(x0 + rad, y0 + rad, 180);
    let k = 0, best = Infinity;
    pts.forEach(([x, y], i) => { const d = (x - p[0]) ** 2 + (y - p[1]) ** 2; if (d < best) { best = d; k = i; } });
    return pts.slice(k).concat(pts.slice(0, k + 1));
  }

  // from the trail's light to the icon: out from the edge, one turn, in to the side of the icon facing it
  function route(h, r) {
    const w = r.width, ins = w * 26 / 512, mid = [(r.left + r.right) / 2, (r.top + r.bottom) / 2], gap = 14;
    let e, pts;
    if (h.side === 'l' || h.side === 'r') {
      const fromLeft = h.side === 'l' ? h.x < r.left : h.x < mid[0];
      e = [fromLeft ? r.left + ins : r.right - ins, mid[1]];
      const mx = e[0] + (fromLeft ? -gap : gap);
      pts = [[h.x, h.y], [mx, h.y], [mx, e[1]], e];
    } else {
      const fromTop = h.side === 't' ? h.y < r.top : h.y < mid[1];
      e = [mid[0], fromTop ? r.top + ins : r.bottom - ins];
      const my = e[1] + (fromTop ? -gap : gap);
      pts = [[h.x, h.y], [h.x, my], [e[0], my], e];
    }
    return { pts, e };
  }

  const lens = pts => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return L; };
  const at = (pts, L, s) => {   // the point s along a polyline
    if (s <= 0) return pts[0];
    for (let i = 1; i < pts.length; i++) if (L[i] >= s) { const f = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]; }
    return pts[pts.length - 1];
  };
  // the stretch a..b of a polyline, as points
  const piece = (pts, L, a, b) => { const out = [at(pts, L, a)]; for (let i = 1; i < pts.length; i++) if (L[i] > a && L[i] < b) out.push(pts[i]); out.push(at(pts, L, b)); return out; };

  function fire() {
    if (shot || !on()) return false;
    const list = icons(); if (!list.length) return false;
    const h = head();
    // one of the three nearest icons (not the last one shot at, when there's another), so the paths stay short
    const near = list.map(o => ({ ...o, d: Math.hypot((o.r.left + o.r.right) / 2 - h.x, (o.r.top + o.r.bottom) / 2 - h.y) }))
      .sort((a, b) => a.d - b.d).filter(o => o.img !== last || list.length === 1).slice(0, 3);
    const pick = near[Math.floor(Math.random() * near.length)]; if (!pick) return false;
    last = pick.img;
    canvas();
    const way = route(h, pick.r), wl = lens(way.pts), loop = ring(pick.r, way.e), ll = lens(loop);
    shot = { way: way.pts, wl, loop, ll, top: pick.r.top, img: pick.img, t0: performance.now(), wayMs: wl[wl.length - 1] / SPEED };
    requestAnimationFrame(draw);
    return true;
  }

  function line(pts, alpha, width) {
    if (pts.length < 2 || alpha <= 0) return;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = `rgba(${RED},${alpha})`; ctx.lineWidth = width; ctx.stroke();
  }
  function draw() {
    if (!shot) return;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (!on() || Math.abs(shot.img.getBoundingClientRect().top - shot.top) > 2) return end();   // scrolled, or something opened over it
    const t = performance.now() - shot.t0;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = `rgb(${RED})`; ctx.shadowBlur = 10;
    let tip, k = 1;
    if (t < shot.wayMs) {   // on the way: a bright head and a tail that fades behind it
      const s = t * SPEED, Lw = shot.wl;
      for (let i = 0; i < 6; i++) line(piece(shot.way, Lw, Math.max(0, s - TAIL * (1 - i / 6)), Math.max(0, s - TAIL * (1 - (i + 1) / 6))), (i + 1) / 6, 2);
      tip = at(shot.way, Lw, s);
    } else {   // round the icon once, dying out
      const f = Math.min(1, (t - shot.wayMs) / LOOP_MS), Ll = shot.ll, total = Ll[Ll.length - 1];
      const s = f * total, fade = Math.pow(1 - f, 1.4);
      line(piece(shot.loop, Ll, Math.max(0, s - total * 0.55), s), 0.5 * fade, 2);
      line(piece(shot.loop, Ll, Math.max(0, s - TAIL * 0.6), s), fade, 2.4);
      tip = at(shot.loop, Ll, s); k = fade;
      if (f >= 1) return end();
    }
    ctx.shadowBlur = 14; ctx.fillStyle = `rgba(${HOT},${k})`;
    ctx.beginPath(); ctx.arc(tip[0], tip[1], 2.2, 0, Math.PI * 2); ctx.fill();
    requestAnimationFrame(draw);
  }
  function end() {
    shot = null;
    if (ctx) ctx.clearRect(0, 0, innerWidth, innerHeight);
    plan();
  }

  function plan() {
    clearTimeout(timer);
    timer = setTimeout(() => { fire(); if (!shot) plan(); }, WAIT[0] + Math.random() * (WAIT[1] - WAIT[0]));
  }
  // the first a little after aOS opens (after Tron's intro)
  timer = setTimeout(plan, 2500);
  document.addEventListener('visibilitychange', () => { if (document.hidden && shot) end(); });

  window.aosTronShots = { fire, running: () => !!shot };
})();
