// In Tron, aOS's screen trail (the red light running round the screen's edge: the :root::after of its <style id="grid">)
// now and then sends a shot to a box on aOS Home: a section of apps (Family, Every day...) or the Weather or Calendar
// widget. From where its light is, a light cycle's path (straight, with right-angle turns) to one of the nearest boxes,
// then once round the box's edge, dying out as it goes. One at a time, every 4 to 10 seconds, and only on aOS's own
// screens (not over an open app or a sheet), with the page in view and motion allowed. Drawn on one canvas over the
// page, under the bar; it never takes a tap.
//   window.aosTronShots: fire() (one now, if it can), running() (a shot is on screen)
'use strict';
(() => {
  if (window.aosTronShots) return;
  const root = document.documentElement;
  const RED = '255,42,42', HOT = '255,227,224';
  const SPEED = 1.15, TAIL = 90, LOOP = [900, 1800], WAIT = [4000, 10000];   // px per ms; ms round a box, at least and at most
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

  // the boxes it can go to: Home's sections and its two widgets (in Thumb arc, the two glance cards and the list), on
  // screen now, fully in view and clear of the bar
  const BOXES = '.wid, .hcat, .hglance > button, .hgroup';
  function boxes() {
    const tab = document.querySelector('.tab:not([hidden])') || document;
    const bar = document.querySelector('.bar'), floor = bar ? bar.getBoundingClientRect().top - 6 : innerHeight - 90;
    return [...tab.querySelectorAll(BOXES)].map(el => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width >= 40 && r.height >= 30 && r.top >= 40 && r.left >= 4 && r.right <= innerWidth - 4 && r.bottom <= floor);
  }
  const corner = (el, r) => Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, r.width / 2, r.height / 2);

  // a box's edge as points, clockwise, starting nearest p
  function ring(r, rad, p) {
    const x0 = r.left + 0.75, y0 = r.top + 0.75, x1 = r.right - 0.75, y1 = r.bottom - 0.75, R = Math.max(0, rad - 0.75);
    const pts = [], arc = (cx, cy, a0) => { for (let i = 0; i <= 10; i++) { const a = (a0 + i * 9) * Math.PI / 180; pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); } };
    arc(x1 - R, y0 + R, -90); arc(x1 - R, y1 - R, 0); arc(x0 + R, y1 - R, 90); arc(x0 + R, y0 + R, 180);
    let k = 0, best = Infinity;
    pts.forEach(([x, y], i) => { const d = (x - p[0]) ** 2 + (y - p[1]) ** 2; if (d < best) { best = d; k = i; } });
    return pts.slice(k).concat(pts.slice(0, k + 1));
  }

  // from the trail's light to the box: straight in to the side facing it when it's level with it; else out from the
  // edge halfway, one turn, and in
  function route(h, r, rad) {
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    let e, pts;
    if (h.side === 'l' || h.side === 'r') {
      const fromLeft = h.side === 'l';
      e = [fromLeft ? r.left : r.right, clamp(h.y, r.top + rad, r.bottom - rad)];
      const mx = (h.x + e[0]) / 2;
      pts = Math.abs(e[1] - h.y) < 1 ? [[h.x, h.y], e] : [[h.x, h.y], [mx, h.y], [mx, e[1]], e];
    } else {
      const fromTop = h.side === 't';
      e = [clamp(h.x, r.left + rad, r.right - rad), fromTop ? r.top : r.bottom];
      const my = (h.y + e[1]) / 2;
      pts = Math.abs(e[0] - h.x) < 1 ? [[h.x, h.y], e] : [[h.x, h.y], [h.x, my], [e[0], my], e];
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
    const list = boxes(); if (!list.length) return false;
    const h = head();
    // one of the two nearest boxes (not the last one shot at, when there's another), so the paths stay short
    const gapTo = r => Math.hypot(Math.max(r.left - h.x, 0, h.x - r.right), Math.max(r.top - h.y, 0, h.y - r.bottom));
    const near = list.map(o => ({ ...o, d: gapTo(o.r) })).sort((a, b) => a.d - b.d).filter(o => o.el !== last || list.length === 1).slice(0, 2);
    const pick = near[Math.floor(Math.random() * near.length)]; if (!pick) return false;
    last = pick.el;
    canvas();
    const rad = corner(pick.el, pick.r), way = route(h, pick.r, rad), wl = lens(way.pts), loop = ring(pick.r, rad, way.e), ll = lens(loop);
    const loopMs = Math.max(LOOP[0], Math.min(LOOP[1], ll[ll.length - 1] / SPEED));
    shot = { way: way.pts, wl, loop, ll, loopMs, top: pick.r.top, el: pick.el, t0: performance.now(), wayMs: wl[wl.length - 1] / SPEED };
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
    if (!on() || !shot.el.isConnected || Math.abs(shot.el.getBoundingClientRect().top - shot.top) > 2) return end();   // scrolled, or something opened over it
    const t = performance.now() - shot.t0;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = `rgb(${RED})`; ctx.shadowBlur = 10;
    let tip, k = 1;
    if (t < shot.wayMs) {   // on the way: a bright head and a tail that fades behind it
      const s = t * SPEED, Lw = shot.wl;
      for (let i = 0; i < 6; i++) line(piece(shot.way, Lw, Math.max(0, s - TAIL * (1 - i / 6)), Math.max(0, s - TAIL * (1 - (i + 1) / 6))), (i + 1) / 6, 2);
      tip = at(shot.way, Lw, s);
    } else {   // round the box once, dying out
      const f = Math.min(1, (t - shot.wayMs) / shot.loopMs), Ll = shot.ll, total = Ll[Ll.length - 1];
      const s = f * total, fade = Math.pow(1 - f, 1.4);
      line(piece(shot.loop, Ll, Math.max(0, s - Math.min(total * 0.5, 280)), s), 0.45 * fade, 2);
      line(piece(shot.loop, Ll, Math.max(0, s - TAIL * 1.2), s), fade, 2.4);
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
