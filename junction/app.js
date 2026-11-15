"use strict";

// Junction: a traffic game, in one canvas with the aOS frame around it (index.html says what's where).
//
// - The roads: up to five crossroads along a main road (A, then B, C, D and E as you buy them), each with a
//   left, an ahead and a right lane in and out on every road; traffic keeps right. Cars come in at the ends of
//   the roads, pick a turn at each junction, and only enter a junction's box when there's room on the far side.
// - The clock runs through the day: quiet nights, a build-up to each rush hour (about 7:00 to 9:30 and 16:15 to
//   19:00), a peak, then a slow easing. Surges send a burst of traffic down one road. Dusk, night and dawn are
//   drawn over the map, with street lamps, headlights and tail lights.
// - Coins: each car that leaves pays more the higher your level and the more of your junctions it went through,
//   and less the longer it waited; a bus pays three times. A road that backs up off the map costs coins, and
//   traffic stops growing until the jams clear, so there's no losing.
// - Spend them (the Upgrades sheet): lights, turn arrows, smart sensors, right turn on red, turn lanes, new
//   junctions, and city-wide upgrades. Lights run on their own; tapping a phase takes over for a while.
// - Saved on this phone only: junction.save.v4 (coins, the clock, the junctions and upgrades), and
//   junction.view, junction.daylen and junction.hold (Settings).

// Refuse to run inside another site's frame; this same site may (aOS opens it in one).
if (window.top !== window.self && (() => { try { return window.top.location.origin !== location.origin; } catch { return true; } })()) {
  document.body.textContent = 'Junction can’t be opened inside another page.';
  throw new Error('Junction refuses to run inside a frame');
}

(() => {
  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');

  // ---------- constants ----------
  // World units. Every road has three lanes each way; traffic keeps right.
  const LW = 15, BOX = 45, CAR = 20, GAP = 6, SPACING = 340;
  const VMAX = 95, VTURN = 50, ACC = 70, DEC = 150;
  const APS = ['N', 'E', 'S', 'W'], TURNS = ['L', 'S', 'R'], SLOTS = ['L', 'S', 'R'];
  const HEAD = { N: [0, 1], E: [-1, 0], S: [0, -1], W: [1, 0] }; // direction of travel for cars coming FROM each side
  const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const AXIS = { N: 'NS', S: 'NS', E: 'EW', W: 'EW' };
  const SLOT_OFF = { L: 0.5 * LW, S: 1.5 * LW, R: 2.5 * LW }; // from the centre line towards the kerb
  const NAMES = { N: 'north', E: 'east', S: 'south', W: 'west' };
  const VIEWS = { close: 300, normal: 390, wide: 520 };
  // traffic through the day: quiet nights, a build-up to each rush hour, a peak lasting a few hours, then a slow easing
  const PROFILE = [[0, .22], [5, .22], [6, .55], [7, 1.8], [9.5, 1.8], [11, .8], [15, .8], [16.2, 1.8], [19, 1.8], [20.5, .7], [22.5, .32], [24, .22]];
  function demandAt(h) {
    for (let i = 1; i < PROFILE.length; i++) {
      const [h0, v0] = PROFILE[i - 1], [h1, v1] = PROFILE[i];
      if (h <= h1) { const t = (h - h0) / (h1 - h0); return v0 + (v1 - v0) * (0.5 - 0.5 * Math.cos(Math.PI * t)); }
    }
    return PROFILE[0][1];
  }
  const PERIODS = [[0, 'Night'], [5, 'Early morning'], [6, 'Morning rush building'], [7, 'Morning rush hour'], [9.5, 'Rush hour easing'],
    [11, 'Midday'], [15, 'Evening rush building'], [16.2, 'Evening rush hour'], [19, 'Rush hour easing'], [20.5, 'Evening'], [22.5, 'Night']];
  const periodAt = h => { let p = PERIODS[0][1]; for (const [t, n] of PERIODS) if (h >= t) p = n; return p; };
  const PERIOD_NEWS = { 'Morning rush building': 'Morning rush is building', 'Morning rush hour': 'Morning rush hour: peak traffic until about 9:30',
    'Rush hour easing': 'Rush hour is easing off', 'Evening rush building': 'Evening rush is building',
    'Evening rush hour': 'Evening rush hour: peak traffic until about 19:00', 'Night': 'Night: the roads go quiet' };
  const darkAt = h => h < 5 || h > 20.5 ? 1 : h < 7 ? (7 - h) / 2 : h > 18.5 ? (h - 18.5) / 2 : 0;
  const warmAt = h => Math.max(0, 1 - Math.abs(h - 6.3) / 1.2, 1 - Math.abs(h - 19.4) / 1.3);
  const fmtClock = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  const leftOf = h => [h[1], -h[0]];
  const kerbOf = h => [-h[1], h[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const sideOf = h => h[0] > 0.5 ? 'E' : h[0] < -0.5 ? 'W' : h[1] > 0.5 ? 'S' : 'N';

  // ---------- junction geometry (the same at every junction, relative to its centre) ----------
  const GEO = {};
  for (const ap of APS) for (const slot of SLOTS) for (const turn of TURNS) {
    const h = HEAD[ap], Lt = leftOf(h), K = kerbOf(h);
    const h2 = turn === 'S' ? h : turn === 'L' ? Lt : [-Lt[0], -Lt[1]];
    const K2 = kerbOf(h2), off = SLOT_OFF[slot], exitOff = turn === 'S' ? off : SLOT_OFF[turn];
    const entry = [-h[0] * BOX + K[0] * off, -h[1] * BOX + K[1] * off];
    const exit = [h2[0] * BOX + K2[0] * exitOff, h2[1] * BOX + K2[1] * exitOff];
    const dx = [exit[0] - entry[0], exit[1] - entry[1]];
    const f = turn === 'S' ? 0.4 : 0.55;
    const k1 = Math.abs(dot(dx, h)) * f, k2 = Math.abs(dot(dx, h2)) * f;
    const c1 = [entry[0] + h[0] * k1, entry[1] + h[1] * k1], c2 = [exit[0] - h2[0] * k2, exit[1] - h2[1] * k2];
    const box = [], N = 28;
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      box.push([u * u * u * entry[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * exit[0],
                u * u * u * entry[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * exit[1]]);
    }
    const cum = [0];
    for (let i = 1; i < box.length; i++) cum.push(cum[i - 1] + Math.hypot(box[i][0] - box[i - 1][0], box[i][1] - box[i - 1][1]));
    const key = ap + slot + turn;
    GEO[key] = { key, ap, slot, turn, h, h2, entry, exit, box, cum, blen: cum[cum.length - 1], exitSide: sideOf(h2), exitOff };
  }
  const GKEYS = Object.keys(GEO);
  const CONF = {}; // movements that cross or merge inside a junction
  for (const a of GKEYS) {
    CONF[a] = {};
    for (const b of GKEYS) {
      let c = false;
      if (GEO[a].ap !== GEO[b].ap) {
        outer: for (const p of GEO[a].box) for (const q of GEO[b].box) if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 12) { c = true; break outer; }
      }
      CONF[a][b] = c;
    }
  }

  // ---------- upgrades ----------
  const UPG = [
    { id: 'lights', name: 'Traffic lights', desc: 'Replace the stop signs. They run on an automatic timer, and you can take over any time.', cost: 100 },
    { id: 'filters', name: 'Turn arrows', desc: 'Adds left and right arrow phases, so turning traffic gets its own green.', cost: 160, needs: 'lights' },
    { id: 'smart', name: 'Smart sensors', desc: 'Auto lights watch the queues: they skip empty phases and give busy roads longer greens.', cost: 300, needs: 'lights' },
    { id: 'rtor', name: 'Right turn on red', desc: 'Right turners may go on red once they have stopped and nothing is coming.', cost: 90, needs: 'lights' },
    { id: 'lanesNS', name: 'Turn lanes, N–S road', desc: 'Opens separate left and right turn lanes on both N–S approaches.', cost: 220 },
    { id: 'lanesEW', name: 'Turn lanes, E–W road', desc: 'Opens separate left and right turn lanes on both E–W approaches.', cost: 220 },
  ];
  const SITE_DEF = { A: 0, B: 1, C: -1, D: 2, E: -2 }; // place along the main road, in junction spacings from A
  const SITE_COST = { B: 400, C: 700, D: 1100, E: 1600 };
  const SITE_ORDER = ['A', 'B', 'C', 'D', 'E'], BUY_ORDER = ['B', 'C', 'D', 'E'];
  const CITY = [
    { id: 'radio', name: 'Traffic radio', desc: 'Surges are announced 20 seconds ahead, and drivers spread out, so each surge is smaller.', cost: 500 },
    { id: 'speed', name: 'Higher speed limit', desc: 'Raises the limit on every road by about 15%, so each green clears more cars.', cost: 650 },
    { id: 'wave', name: 'Green wave', desc: 'Auto lights along the main road hold green for groups of cars arriving from the next junction.', cost: 950 },
    { id: 'charge', name: 'Congestion charge', desc: 'Every car pays 25% more coins.', cost: 1300 },
  ];

  // ---------- game state ----------
  let G = null, view = 'normal', speed = 1, hold = 20, dayMin = 16, paused = false, MAIN = 'EW', EXT = { hx: 800, hy: 400 };
  try { const d = +localStorage.getItem('junction.daylen'); if ([10, 16, 24].includes(d)) dayMin = d; } catch (e) {}
  try { const v = localStorage.getItem('junction.view'); if (VIEWS[v]) view = v; } catch (e) {}
  try { const h = localStorage.getItem('junction.hold'); if (h != null && [0, 10, 20, 40].includes(+h)) hold = +h; } catch (e) {}

  function newSite(id, off) {
    return { id, off, cx: 0, cy: 0, active: id === 'A', up: {}, ctrl: { phase: 0, target: null, stage: 'G', t: 0 }, manualUntil: -1,
      lanes: {}, res: {}, mv: {}, sides: [] };
  }
  function newGame(save) {
    G = { T: 0, progress: 0, stalled: false, city: {}, warn: null, coins: 80, earned: 0, cleared: 0, lost: 0, level: 1, cars: [], sites: [], sources: [], id: 0, selected: 'A',
      surge: null, nextSurge: 70, rate: 0, net: 0, rateT: 0, flowAvg: 1, flash: 0, saveT: 0, demo: false, clock: 10, day: 1, period: null };
    G.sites.push(newSite('A', 0));
    if (save) {
      for (const id of BUY_ORDER) if (save.sites && save.sites[id] && save.sites[id].active) G.sites.push(newSite(id, SITE_DEF[id] * SPACING));
      G.city = save.city || {};
      Object.assign(G, { T: save.T || 0, progress: save.progress ?? save.T ?? 0, coins: save.coins || 0, cleared: save.cleared || 0, lost: save.lost || 0, clock: save.clock ?? 10, day: save.day || 1 });
      G.nextSurge = G.T + 40;
      for (const s of G.sites) { const ss = save.sites && save.sites[s.id]; if (ss) { s.active = !!ss.active; s.up = ss.up || {}; } }
      G.level = levelAt(G.progress);
    }
    syncSites();
    MAIN = null;
    buildWorld();
  }
  const levelAt = p => 1 + Math.floor(p / 90); // traffic grows with progress, which only builds while traffic flows
  const site = id => G.sites.find(s => s.id === id);
  const nextForSale = () => BUY_ORDER.find(id => !(site(id) && site(id).active));
  function syncSites() { // the map holds every open junction, plus the next one for sale
    const next = nextForSale();
    if (next && !site(next)) G.sites.push(newSite(next, SITE_DEF[next] * SPACING));
  }
  const mainSides = () => MAIN === 'EW' ? ['E', 'W'] : ['N', 'S'];
  const crossSides = () => MAIN === 'EW' ? ['N', 'S'] : ['E', 'W'];
  const sideSign = X => (X === 'E' || X === 'S') ? 1 : -1;
  function neighbor(s, X) {
    if (!mainSides().includes(X)) return null;
    return G.sites.find(o => o.off === s.off + sideSign(X) * SPACING) || null;
  }

  // Lay the network out along the screen's longer side, and size every road to reach just past the screen edge.
  function buildWorld() {
    const r = cv.getBoundingClientRect(), w = Math.max(r.width, 1), h = Math.max(r.height, 1);
    if (!MAIN) MAIN = w >= h ? 'EW' : 'NS';
    const short = Math.min(w, h), crossPx = MAIN === 'EW' ? h : w, mainPx = MAIN === 'EW' ? w : h;
    let cross = VIEWS[view] * Math.min(1, Math.max(0.6, short / 640));
    let main = cross * mainPx / crossPx;
    const minMain = Math.max(...G.sites.map(s => Math.abs(s.off))) + 230;
    if (main < minMain) { cross *= minMain / main; main = minMain; }
    EXT = MAIN === 'EW' ? { hx: main, hy: cross } : { hx: cross, hy: main };
    const mainLen = main + 30, crossLen = cross + 30;
    for (const s of G.sites) {
      s.cx = MAIN === 'EW' ? s.off : 0; s.cy = MAIN === 'EW' ? 0 : s.off;
      s.sides = s.active ? APS.slice() : mainSides();
      const len = {};
      for (const X of APS) {
        len[X] = neighbor(s, X) ? SPACING - 2 * BOX : mainSides().includes(X) ? mainLen - Math.abs(s.off) - BOX : crossLen - BOX;
      }
      s.len = len;
      for (const ap of APS) for (const slot of SLOTS) { const lk = ap + slot; s.lanes[lk] = s.lanes[lk] || []; s.res[lk] = s.res[lk] || 0; }
      const old = s.mv; s.mv = {};
      for (const k of GKEYS) {
        const g = GEO[k], Lin = len[g.ap], Lout = len[g.exitSide];
        s.mv[k] = { g, key: k, Lin, dStop: Lin, dBoxEnd: Lin + g.blen, len: Lin + g.blen + Lout, cx: s.cx, cy: s.cy,
          exitKey: s.id + g.exitSide + g.exitOff, next: neighbor(s, g.exitSide) };
      }
      // keep cars where they are relative to the stop line when road lengths change (window resized)
      for (const lk in s.lanes) for (const car of s.lanes[lk]) {
        const prev = old[car.key];
        car.mv = s.mv[car.key];
        if (prev) car.d += car.mv.dStop - prev.dStop;
      }
    }
    G.sources = [];
    for (const s of G.sites) for (const X of s.sides) if (!neighbor(s, X)) {
      const prev = (G.sourcesPrev || []).find(o => o.site === s && o.ap === X);
      G.sources.push(prev || { site: s, ap: X, main: mainSides().includes(X), pending: 0, nextAt: G.T + Math.random() * 2, jamT: 0, queued: null });
    }
    G.sourcesPrev = G.sources;
    resize();
  }

  // ---------- positions ----------
  function posAt(m, d) {
    const g = m.g;
    if (d < m.dStop) {
      const t = d - m.dStop;
      return [m.cx + g.entry[0] + g.h[0] * t, m.cy + g.entry[1] + g.h[1] * t, Math.atan2(g.h[1], g.h[0])];
    }
    if (d > m.dBoxEnd) {
      const t = d - m.dBoxEnd;
      return [m.cx + g.exit[0] + g.h2[0] * t, m.cy + g.exit[1] + g.h2[1] * t, Math.atan2(g.h2[1], g.h2[0])];
    }
    const s = d - m.dStop, c = g.cum;
    let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (c[mid] <= s) lo = mid; else hi = mid; }
    const a = g.box[lo], b = g.box[hi], seg = c[hi] - c[lo], t = seg ? (s - c[lo]) / seg : 0;
    return [m.cx + a[0] + (b[0] - a[0]) * t, m.cy + a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
  }

  // ---------- traffic demand ----------
  function sourceRate(src) {
    const unit = 0.075 + 0.008 * (G.level - 1);
    let r = unit * demandAt(G.clock) * (src.main ? 1.7 : 1);
    if (G.surge && G.surge.src === src) r *= G.city.radio ? 2.5 : 3.5;
    return r;
  }
  function pickTurn(s, ap) {
    if (!s.active) return 'S';
    const r = Math.random();
    return AXIS[ap] === MAIN ? (r < 0.18 ? 'L' : r < 0.82 ? 'S' : 'R') : (r < 0.3 ? 'L' : r < 0.7 ? 'S' : 'R');
  }
  function laneFor(s, ap, turn, cur) {
    if (!s.active) return cur || 'S';
    return s.up['lanes' + AXIS[ap]] ? turn : 'S';
  }
  // ---------- vehicles ----------
  // Each kind of vehicle is drawn once per colour onto a small offscreen canvas at 4× detail, then stamped onto the map.
  const VEH = {
    sedan: { len: 20, w: 10, wt: 32 }, hatch: { len: 17, w: 9.6, wt: 20 }, suv: { len: 21, w: 10.6, wt: 15 },
    pickup: { len: 22, w: 10.4, wt: 8 }, van: { len: 22, w: 10.6, wt: 8 }, taxi: { len: 20, w: 10, wt: 6 },
    truck: { len: 28, w: 11, wt: 7 }, bus: { len: 34, w: 11.4, wt: 4 },
  };
  const VTYPES = Object.entries(VEH).map(([k, v]) => [k, v.wt]);
  const PAINT = [['#eef0f1', 18], ['#b8bec4', 15], ['#6a727a', 12], ['#24282c', 14], ['#263c62', 8], ['#2f6db5', 6], ['#b3262c', 8],
    ['#721e25', 4], ['#2e5944', 4], ['#c7b38a', 5], ['#d6772b', 3], ['#5a3e6d', 2]];
  const BUS_PAINT = [['#d23a2f', 3], ['#2a6fb5', 3], ['#e9b415', 2], ['#2f8f5b', 2]];
  const pickW = list => { let t = list.reduce((a, x) => a + x[1], 0) * Math.random(); for (const x of list) if ((t -= x[1]) < 0) return x[0]; return list[0][0]; };
  function shade(hex, f) { // f > 0 lightens towards white, f < 0 darkens towards black
    const n = parseInt(hex.slice(1), 16), t = f < 0 ? 0 : 255, p = Math.abs(f);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (t - v) * p));
    return `rgb(${c.join(',')})`;
  }
  const SPR = new Map(), SS = 4;
  function sprite(type, paint) {
    const key = type + paint;
    let sp = SPR.get(key);
    if (sp) return sp;
    const v = VEH[type], pad = 2, c = document.createElement('canvas');
    c.width = Math.ceil((v.len + pad * 2) * SS); c.height = Math.ceil((v.w + pad * 2) * SS);
    const g = c.getContext('2d');
    g.scale(SS, SS); g.translate(pad + v.len / 2, pad + v.w / 2);
    drawVehicle(g, type, paint, v.len, v.w);
    sp = { c, ox: pad + v.len / 2, oy: pad + v.w / 2, w: v.len + pad * 2, h: v.w + pad * 2 };
    SPR.set(key, sp);
    return sp;
  }
  function drawVehicle(g, type, paint, L, W) { // front of the vehicle points to +x
    const hw = W / 2, fx = L / 2, rx = -L / 2;
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const poly = pts => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); };
    const ln = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    const bodyFill = col => { // rounded body: darker at the sides, a soft highlight down the middle
      const gr = g.createLinearGradient(0, -hw, 0, hw);
      gr.addColorStop(0, shade(col, -0.32)); gr.addColorStop(0.2, shade(col, 0.02)); gr.addColorStop(0.5, shade(col, 0.18));
      gr.addColorStop(0.8, shade(col, 0.02)); gr.addColorStop(1, shade(col, -0.32));
      return gr;
    };
    const glassFill = (x0, x1) => { const gr = g.createLinearGradient(x0, -hw, x1, hw); gr.addColorStop(0, '#4a6378'); gr.addColorStop(0.45, '#1c2833'); gr.addColorStop(1, '#121a22'); return gr; };
    const roofFill = col => { const gr = g.createLinearGradient(0, -hw, 0, hw); gr.addColorStop(0, shade(col, -0.05)); gr.addColorStop(0.5, shade(col, 0.24)); gr.addColorStop(1, shade(col, -0.05)); return gr; };
    // tyres peek out under the body
    const axle = Math.min(5, L * 0.22);
    g.fillStyle = '#0c0e0f';
    const axles = type === 'bus' ? [fx - 6, rx + 7] : type === 'truck' ? [fx - 4.5, rx + 4, rx + 8.5] : [fx - axle, rx + axle];
    for (const ax of axles) { g.fillRect(ax - 2.1, -hw - 0.5, 4.2, 1.5); g.fillRect(ax - 2.1, hw - 1, 4.2, 1.5); }
    let wsF = fx - 5.2; // front edge of the windscreen, for the mirrors
    if (type === 'truck') {
      const boxEnd = fx - 8.6;
      const bf = g.createLinearGradient(0, -hw, 0, hw); bf.addColorStop(0, '#c9c8c0'); bf.addColorStop(0.5, '#f4f3ee'); bf.addColorStop(1, '#c9c8c0');
      rr(rx, -hw, boxEnd - rx, W, 0.8); g.fillStyle = bf; g.fill(); g.strokeStyle = '#9d9b92'; g.lineWidth = 0.3; g.stroke();
      g.strokeStyle = '#d6d4cb'; g.lineWidth = 0.35; for (let x = rx + 3.5; x < boxEnd - 1; x += 3.5) ln(x, -hw + 0.6, x, hw - 0.6);
      rr(fx - 8, -hw + 0.5, 8, W - 1, 1.8); g.fillStyle = bodyFill(paint); g.fill(); g.strokeStyle = shade(paint, -0.45); g.lineWidth = 0.3; g.stroke();
      wsF = fx - 2.2;
      poly([[wsF, -hw + 1.2], [wsF, hw - 1.2], [wsF - 2, hw - 1.8], [wsF - 2, -hw + 1.8]]); g.fillStyle = glassFill(wsF - 2, wsF); g.fill();
      rr(fx - 7.6, -hw + 1.6, 3.2, W - 3.2, 0.8); g.fillStyle = roofFill(paint); g.fill();
    } else if (type === 'bus') {
      rr(rx, -hw, L, W, 2); g.fillStyle = bodyFill(paint); g.fill(); g.strokeStyle = shade(paint, -0.45); g.lineWidth = 0.3; g.stroke();
      g.fillStyle = glassFill(rx, fx); g.fillRect(rx + 1.6, -hw + 0.15, L - 5.4, 0.9); g.fillRect(rx + 1.6, hw - 1.05, L - 5.4, 0.9);
      rr(rx + 1, -hw + 1.3, L - 4.6, W - 2.6, 1); g.fillStyle = shade(paint, 0.55); g.fill();
      rr(rx + L * 0.32, -2.5, 6, 5, 0.7); g.fillStyle = '#cdd2d6'; g.fill(); g.strokeStyle = '#9aa0a5'; g.lineWidth = 0.3; g.stroke();
      g.fillStyle = '#b9bec2'; g.fillRect(rx + L * 0.68, -1.4, 2.4, 2.8); g.fillRect(rx + 3, -1.4, 2.4, 2.8);
      wsF = fx - 1;
      poly([[wsF, -hw + 0.8], [wsF, hw - 0.8], [wsF - 2.4, hw - 1.3], [wsF - 2.4, -hw + 1.3]]); g.fillStyle = glassFill(wsF - 2.4, wsF); g.fill();
    } else {
      rr(rx, -hw, L, W, type === 'suv' || type === 'van' ? 2.1 : 2.8); g.fillStyle = bodyFill(paint); g.fill();
      g.strokeStyle = shade(paint, -0.45); g.lineWidth = 0.3; g.stroke();
      // windscreen, roof and rear window, by body style
      const P = { sedan: [5.2, 3, 5, 2.4], taxi: [5.2, 3, 5, 2.4], hatch: [4.4, 2.8, 2.4, 1.3], suv: [4.6, 2.8, 2.2, 1.2], van: [2.6, 2.4, 0.8, 0], pickup: [5, 2.6, 0, 0] }[type];
      wsF = fx - P[0];
      const wsB = wsF - P[1];
      const roofB = type === 'pickup' ? wsB - 4.6 : rx + P[2];
      poly([[wsF, -hw + 1.1], [wsF, hw - 1.1], [wsB, hw - 1.7], [wsB, -hw + 1.7]]); g.fillStyle = glassFill(wsB, wsF); g.fill();
      rr(roofB, -hw + 1.7, wsB - roofB, W - 3.4, 1.3); g.fillStyle = roofFill(paint); g.fill();
      g.fillStyle = glassFill(roofB, wsB); g.fillRect(roofB + 0.4, -hw + 0.85, wsB - roofB - 0.8, 0.8); g.fillRect(roofB + 0.4, hw - 1.65, wsB - roofB - 0.8, 0.8);
      if (P[3] > 0) { poly([[roofB, -hw + 1.7], [roofB, hw - 1.7], [roofB - P[3], hw - 1.2], [roofB - P[3], -hw + 1.2]]); g.fillStyle = glassFill(roofB - P[3], roofB); g.fill(); }
      if (type === 'pickup') { // open load bed
        poly([[roofB, -hw + 1.7], [roofB, hw - 1.7], [roofB - 0.9, hw - 1.4], [roofB - 0.9, -hw + 1.4]]); g.fillStyle = glassFill(roofB - 1, roofB); g.fill();
        rr(rx + 0.8, -hw + 1, roofB - 1.4 - rx - 0.8, W - 2, 0.6); g.fillStyle = '#2b2e30'; g.fill();
        g.strokeStyle = '#3c4044'; g.lineWidth = 0.3; for (let y = -hw + 2.4; y < hw - 1.5; y += 1.6) ln(rx + 1.4, y, roofB - 2, y);
      }
      if (type === 'van') { g.strokeStyle = shade(paint, -0.12); g.lineWidth = 0.3; for (let x = rx + 3; x < wsB - 1; x += 3) ln(x, -hw + 2, x, hw - 2); }
      if (type === 'suv') { g.strokeStyle = '#2a2d30'; g.lineWidth = 0.5; ln(roofB + 0.6, -hw + 2.3, wsB - 0.6, -hw + 2.3); ln(roofB + 0.6, hw - 2.3, wsB - 0.6, hw - 2.3); }
      if (type === 'taxi') { rr(-1.7, -2.3, 3.4, 4.6, 0.6); g.fillStyle = '#fff4c2'; g.fill(); g.strokeStyle = '#3a3a3a'; g.lineWidth = 0.3; g.stroke(); }
      // creases on the bonnet
      g.strokeStyle = shade(paint, -0.18); g.lineWidth = 0.25;
      ln(fx - 1, -hw + 2.6, wsF + 0.3, -hw + 2.2); ln(fx - 1, hw - 2.6, wsF + 0.3, hw - 2.2);
    }
    // headlights, tail lights, door mirrors
    g.fillStyle = '#fff4cf';
    rr(fx - 1.3, -hw + 0.9, 1.1, 2.1, 0.4); g.fill(); rr(fx - 1.3, hw - 3, 1.1, 2.1, 0.4); g.fill();
    g.fillStyle = '#7a1517';
    g.fillRect(rx, -hw + 0.9, 0.7, 2); g.fillRect(rx, hw - 2.9, 0.7, 2);
    g.fillStyle = type === 'truck' ? '#2b2e30' : shade(paint, -0.3);
    rr(wsF - 1.2, -hw - 0.9, 1.3, 1.1, 0.3); g.fill(); rr(wsF - 1.2, hw - 0.2, 1.3, 1.1, 0.3); g.fill();
  }
  function newVehicle() {
    const type = pickW(VTYPES);
    const paint = type === 'taxi' ? '#f2c21b' : type === 'bus' ? pickW(BUS_PAINT) : pickW(PAINT);
    return { type, paint, len: VEH[type].len, acc: type === 'bus' || type === 'truck' ? 0.6 : 1 };
  }
  function trySpawn(src) {
    const s = src.site;
    if (!src.queued) {
      const turn = pickTurn(s, src.ap);
      src.queued = { turn, slot: s.active ? laneFor(s, src.ap, turn) : SLOTS[(Math.random() * 3) | 0] };
    }
    const { turn, slot } = src.queued, lk = src.ap + slot, lane = s.lanes[lk], last = lane[lane.length - 1];
    if (last && last.d - last.len < GAP + 2) return false;
    const key = lk + turn;
    const car = { id: ++G.id, site: s, ap: src.ap, slot, turn, key, lk, mv: s.mv[key], d: 0, v: last ? Math.min(VMAX, last.v) : VMAX * 0.9,
      committed: false, wait: 0, readyAt: null, brake: false, shift: 0, next: null, passed: 0, ...newVehicle() };
    lane.push(car); G.cars.push(car);
    src.queued = null;
    return true;
  }

  // ---------- signals ----------
  const PH = [{ ax: 'NS', f: false }, { ax: 'NS', f: true }, { ax: 'EW', f: false }, { ax: 'EW', f: true }];
  const AMBER = 2, ALLRED = 0.8, REDAMBER = 1;
  const hasLights = s => s.active && s.up.lights;
  const phasesOf = s => s.up.filters ? [0, 1, 2, 3] : [0, 2];
  function signal(s, ap) {
    const c = s.ctrl, ax = AXIS[ap], out = { main: 'R', arrow: null };
    if (c.stage === 'G' || c.stage === 'A') {
      const cur = PH[c.phase];
      if (cur.ax === ax) { if (cur.f) out.arrow = c.stage; else out.main = c.stage; }
    } else if (c.stage === 'RA') {
      const t = PH[c.target];
      if (t.ax === ax && !t.f) out.main = 'RA';
    }
    return out;
  }
  function request(s, p) {
    const c = s.ctrl;
    if (c.stage === 'G' && p === c.phase) { c.target = null; return; }
    c.target = p;
    if (c.stage === 'G') { c.stage = 'A'; c.t = 0; }
  }
  function demand(s, p) {
    let n = 0;
    const reach = G.city.wave && !PH[p].f && PH[p].ax === MAIN ? 330 : 190; // a green wave looks further up the main road
    for (const ap of s.sides) {
      if (AXIS[ap] !== PH[p].ax) continue;
      for (const slot of SLOTS) for (const car of s.lanes[ap + slot]) {
        if (car.committed || car.mv.dStop - car.d > reach) continue;
        if (PH[p].f && car.turn === 'S') continue;
        n++;
      }
    }
    return n;
  }
  function platoon(s) { // cars on the main road about to arrive at speed
    for (const ap of mainSides()) for (const slot of SLOTS) for (const car of s.lanes[ap + slot]) {
      if (!car.committed && car.mv.dStop - car.d < 140 && car.v > 30) return true;
    }
    return false;
  }
  function updateCtrl(s, dt) {
    if (!hasLights(s)) return;
    const c = s.ctrl;
    c.t += dt;
    const manual = s.manualUntil === Infinity || G.T < s.manualUntil;
    if (!manual && c.stage === 'G') {
      const ph = phasesOf(s);
      if (!ph.includes(c.phase)) request(s, 0);
      else if (s.up.smart) {
        if (c.t >= 4) {
          const cur = demand(s, c.phase);
          let best = -1, bestD = 0;
          for (const p of ph) if (p !== c.phase) { const d = demand(s, p) * (PH[p].f ? 1.3 : 1); if (d > bestD) { bestD = d; best = p; } }
          if (best >= 0 && (cur === 0 || c.t > 32 || (c.t > 8 + cur * 1.3 && bestD > cur))) request(s, best);
        }
      } else if (c.t >= (PH[c.phase].f ? 5 : 11) && !(G.city.wave && !PH[c.phase].f && PH[c.phase].ax === MAIN && c.t < 19 && platoon(s))) {
        request(s, ph[(ph.indexOf(c.phase) + 1) % ph.length]);
      }
    }
    if (c.stage === 'A' && c.t >= AMBER) { c.stage = 'AR'; c.t = 0; }
    else if (c.stage === 'AR' && c.t >= ALLRED) {
      if (!PH[c.target].f) { c.stage = 'RA'; c.t = 0; } else { c.phase = c.target; c.target = null; c.stage = 'G'; c.t = 0; }
    } else if (c.stage === 'RA' && c.t >= REDAMBER) { c.phase = c.target; c.target = null; c.stage = 'G'; c.t = 0; }
  }

  // ---------- right of way ----------
  const canStop = (car, dist) => dist > car.v * car.v / (2 * DEC) - 1;
  function boxClear(s, car) {
    for (const lk in s.lanes) for (const o of s.lanes[lk]) {
      if (o.committed && o.d - o.len < o.mv.dBoxEnd + 2 && CONF[car.key][o.key]) return false;
    }
    return true;
  }
  function headOf(s, lk) { for (const o of s.lanes[lk]) if (!o.committed) return o; return null; }
  function oncoming(s, car, goes) { // a permissive left turner yields to oncoming traffic that is about to go
    for (const slot of SLOTS) {
      const o = headOf(s, OPP[car.ap] + slot);
      if (o && o.turn !== 'L' && CONF[car.key][o.key] && (o.mv.dStop - o.d) < 110 && goes(o)) return true;
    }
    return false;
  }
  function lightGoes(s, o) {
    const sg = signal(s, o.ap);
    if (sg.main === 'G') return true;
    if (sg.arrow === 'G' && o.turn !== 'S') return true;
    if (sg.main === 'A') return !canStop(o, o.mv.dStop - 3 - o.d);
    return false;
  }
  function permitted(s, car, dist) {
    if (!s.active) return true; // a plain stretch of road
    if (!s.up.lights) { // all-way stop: stop, then go in order of arrival
      if (car.readyAt == null || G.T - car.readyAt < 1.1) return false;
      for (const ap of s.sides) for (const slot of SLOTS) {
        const o = headOf(s, ap + slot);
        if (o && o !== car && o.readyAt != null && o.readyAt < car.readyAt && CONF[car.key][o.key]) return false;
      }
      return boxClear(s, car);
    }
    const sg = signal(s, car.ap), goes = o => lightGoes(s, o);
    if (sg.main === 'G') {
      if (car.turn === 'L' && oncoming(s, car, goes)) return false;
      return boxClear(s, car);
    }
    if (sg.arrow === 'G' && car.turn !== 'S') return boxClear(s, car);
    if (sg.main === 'A' || (sg.arrow === 'A' && car.turn !== 'S')) {
      if (car.turn === 'L' && dist < 6) return !oncoming(s, car, goes) && boxClear(s, car);
      if (!canStop(car, dist)) return boxClear(s, car);
    }
    if (s.up.rtor && car.turn === 'R' && sg.arrow !== 'A' && car.readyAt != null && G.T - car.readyAt > 0.8) {
      const side = car.mv.g.exitSide;
      for (const ap of s.sides) for (const slot of SLOTS) {
        const o = headOf(s, ap + slot);
        if (!o || o === car) continue;
        if ((CONF[car.key][o.key] || o.mv.g.exitSide === side) && (o.mv.dStop - o.d) < 170 && goes(o)) return false;
      }
      for (const lk in s.lanes) for (const o of s.lanes[lk]) if (o.committed && o.d - o.len < o.mv.dBoxEnd + 2 && o.mv.g.exitSide === side) return false;
      return boxClear(s, car);
    }
    return false;
  }
  // where a car goes after this junction, and whether there is room for it there (don't block the box)
  function planNext(car) {
    const n = car.mv.next;
    if (!n) return null;
    if (!car.next) {
      const ap = OPP[car.mv.g.exitSide], turn = pickTurn(n, ap);
      const cur = car.turn === 'S' ? car.slot : car.turn; // the lane it comes out in
      const slot = laneFor(n, ap, turn, cur);
      car.next = { site: n, ap, turn, slot, lk: ap + slot };
    }
    return car.next;
  }
  function roomAhead(car) {
    const nx = planNext(car);
    if (!nx) return true;
    const lane = nx.site.lanes[nx.lk], tail = lane[lane.length - 1];
    const space = tail ? tail.d - tail.len : Infinity;
    return space >= nx.site.res[nx.lk] + car.len + GAP + 4; // res: road length already promised to cars on their way in
  }

  // ---------- simulation ----------
  function updateCar(s, car, lane, i, isHead, dt) {
    const m = car.mv;
    let lim = Infinity;
    for (let j = i - 1; j >= 0; j--) {
      const o = lane[j];
      if (o.key === car.key || o.d - o.len < m.dStop + 14) { lim = Math.min(lim, o.d - o.len - GAP); break; }
    }
    if (car.committed && car.next) {
      const nl = car.next.site.lanes[car.next.lk], tail = nl[nl.length - 1];
      if (tail) lim = Math.min(lim, m.dBoxEnd + tail.d - tail.len - GAP);
    } else if (car.committed && car.d > m.dStop - 4) {
      const pf = posAt(m, car.d), h2 = m.g.h2, mc = pf[0] * h2[0] + pf[1] * h2[1];
      for (const lk in s.lanes) for (const o of s.lanes[lk]) {
        if (o === car || o.key === car.key || o.mv.exitKey !== m.exitKey || o.d < o.mv.dBoxEnd) continue;
        const po = posAt(o.mv, o.d), oc = po[0] * h2[0] + po[1] * h2[1];
        if (oc > mc) lim = Math.min(lim, car.d + (oc - o.len - GAP - mc));
      }
    }
    if (!car.committed) {
      const stopAt = m.dStop - 3, dist = stopAt - car.d;
      if (isHead) {
        if (car.readyAt == null && dist < 4 && car.v < 4) car.readyAt = G.T;
        if (dist <= car.v * car.v / (2 * DEC) + 6 && permitted(s, car, dist) && roomAhead(car)) {
          car.committed = true;
          if (car.next) car.next.site.res[car.next.lk] += car.len + GAP;
        }
      }
      if (!car.committed) {
        lim = Math.min(lim, stopAt);
        if (car.v < 8) car.wait += dt;
      }
    }
    const vmax = G.city.speed ? 110 : VMAX;
    let vcap = vmax;
    if (car.turn !== 'S') {
      if (car.d < m.dStop) vcap = VTURN + (vmax - VTURN) * Math.min(1, Math.max(0, (m.dStop - car.d) / 70));
      else if (car.d - car.len < m.dBoxEnd) vcap = VTURN;
    }
    const want = Math.min(vcap, Math.sqrt(2 * DEC * Math.max(0, lim - car.d)));
    const prev = car.v;
    car.v = want > car.v ? Math.min(want, car.v + ACC * car.acc * dt) : want;
    car.brake = car.v < prev - 0.3 || car.v < 2;
    const nd = car.d + car.v * dt;
    car.d = lim === Infinity ? nd : Math.max(car.d, Math.min(nd, lim));
  }

  function moveOn(car) { // hand a car from one junction to the next
    const s = car.site, nx = car.next, lane = s.lanes[car.lk];
    lane.splice(lane.indexOf(car), 1);
    nx.site.res[nx.lk] = Math.max(0, nx.site.res[nx.lk] - car.len - GAP);
    const fromOff = car.mv.g.exitOff, over = car.d - car.mv.dBoxEnd;
    if (s.active) car.passed++;
    Object.assign(car, { site: nx.site, ap: nx.ap, turn: nx.turn, slot: nx.slot, lk: nx.lk, key: nx.lk + nx.turn, committed: false, readyAt: null, next: null });
    car.mv = nx.site.mv[car.key];
    car.d = over;
    car.shift = fromOff - SLOT_OFF[car.slot];
    nx.site.lanes[nx.lk].push(car);
  }

  function addCoins(n) { const before = G.coins; G.coins = Math.max(0, G.coins + n); G.net += G.coins - before; if (n > 0) G.earned += n; }
  function step(dt) {
    G.T += dt;
    G.clock += dt * 24 / (dayMin * 60);
    if (G.clock >= 24) { G.clock -= 24; G.day++; }
    const per = periodAt(G.clock);
    if (per !== G.period) { if (G.period && !G.demo && PERIOD_NEWS[per]) toast(PERIOD_NEWS[per]); G.period = per; }
    const jammed = G.sources.some(s => s.jamT > 2);
    const stalled = jammed || G.flowAvg < 0.55;
    if (stalled !== G.stalled) { G.stalled = stalled; if (!G.demo && stalled && G.T > 20) toast('Traffic growth paused until the jams clear'); }
    if (!stalled) G.progress += dt;
    const lvl = levelAt(G.progress);
    if (lvl !== G.level) { G.level = lvl; if (!G.demo) toast(`Level ${lvl}: more traffic, more coins per car`); }
    const mult = 1 + 0.12 * (G.level - 1);
    // surges
    if (G.surge && G.T > G.surge.until) G.surge = null;
    if (G.warn && G.T >= G.warn.at) {
      G.surge = { src: G.warn.src, until: G.T + 25 }; G.warn = null;
      if (!G.demo) toast(`Surge: heavy traffic from the ${NAMES[G.surge.src.ap]} into junction ${G.surge.src.site.id}`);
    }
    if (!G.surge && !G.warn && G.T > G.nextSurge && G.sources.length && demandAt(G.clock) > 0.6) {
      const src = G.sources[(Math.random() * G.sources.length) | 0];
      G.nextSurge = G.T + 55 + Math.random() * 45;
      if (G.city.radio) {
        G.warn = { src, at: G.T + 20 };
        if (!G.demo) toast(`Traffic radio: a surge from the ${NAMES[src.ap]} into junction ${src.site.id} in about 20 seconds`);
      } else {
        G.surge = { src, until: G.T + 25 };
        if (!G.demo) toast(`Surge: heavy traffic from the ${NAMES[src.ap]} into junction ${src.site.id}`);
      }
    }
    for (const s of G.sites) updateCtrl(s, dt);
    // arrivals; a road that backs up off the map costs coins
    for (const src of G.sources) {
      if (Math.random() < sourceRate(src) * dt) src.pending++;
      if (src.pending > 0 && trySpawn(src)) src.pending--;
      if (src.pending > 0) src.jamT += dt; else src.jamT = 0;
      if (src.jamT > 2) addCoins(-0.3 * mult * dt);
      if (src.pending > 6) { src.pending = 6; G.lost++; addCoins(-0.5 * mult); G.flash = 0.4; }
    }
    // cars
    for (const s of G.sites) {
      const keys = Object.keys(s.lanes), start = (G.T * 30 | 0) % keys.length;
      for (let n = 0; n < keys.length; n++) {
        const lane = s.lanes[keys[(start + n) % keys.length]];
        let head = true;
        for (let i = 0; i < lane.length; i++) {
          const car = lane[i];
          updateCar(s, car, lane, i, head && !car.committed, dt);
          if (!car.committed) head = false;
        }
      }
    }
    for (let i = G.cars.length - 1; i >= 0; i--) {
      const car = G.cars[i];
      if (car.next && car.d >= car.mv.dBoxEnd) moveOn(car);
      else if (!car.next && car.d - car.len > car.mv.len) {
        G.cars.splice(i, 1);
        const lane = car.site.lanes[car.lk]; lane.splice(lane.indexOf(car), 1);
        if (car.site.active) car.passed++;
        const flow = Math.min(1, Math.max(0.2, 1 - car.wait / 40));
        G.flowAvg = G.flowAvg * 0.95 + flow * 0.05;
        addCoins(mult * Math.max(1, car.passed) * flow * (car.type === 'bus' ? 3 : 1) * (G.city.charge ? 1.25 : 1)); // a bus carries more people
        G.cleared++;
      }
    }
    G.flash = Math.max(0, G.flash - dt);
    G.rateT += dt;
    if (G.rateT >= 3) { const r = G.net / G.rateT * 60; G.rate = G.rate * 0.6 + r * 0.4; G.net = 0; G.rateT = 0; } // income, not counting purchases
    G.saveT += dt; if (G.saveT > 5) { G.saveT = 0; save(); }
  }

  function save() {
    if (G.demo) return;
    const sites = {};
    for (const s of G.sites) sites[s.id] = { active: s.active, up: s.up };
    try { localStorage.setItem('junction.save.v4', JSON.stringify({ T: G.T, progress: G.progress, city: G.city, clock: G.clock, day: G.day, coins: G.coins, cleared: G.cleared, lost: G.lost, sites })); } catch (e) {}
  }
  function loadSave() { try { return JSON.parse(localStorage.getItem('junction.save.v4') || 'null'); } catch (e) { return null; } }

  // ---------- buying ----------
  function canBuy(s, u) {
    if (s.up[u.id]) return { ok: false, why: 'owned' };
    if (u.needs && !s.up[u.needs]) return { ok: false, why: 'Needs traffic lights' };
    if (G.coins < u.cost) return { ok: false, why: 'cost' };
    return { ok: true };
  }
  function buy(siteId, upId) {
    const s = site(siteId), u = UPG.find(x => x.id === upId);
    if (!s || !s.active || !u || !canBuy(s, u).ok) return false;
    G.coins -= u.cost; s.up[u.id] = true;
    if (u.id === 'lights') { s.ctrl = { phase: 0, target: null, stage: 'G', t: 0 }; s.manualUntil = -1; }
    save(); renderPanel();
    return () => { if (!s.up[u.id]) return; delete s.up[u.id]; G.coins += u.cost; save(); renderPanel(); };   // Undo: the coins back
  }
  function buySite(id) {
    const s = site(id);
    if (!s || s.active || id !== nextForSale() || G.coins < SITE_COST[id]) return false;
    G.coins -= SITE_COST[id]; s.active = true; s.up = { lights: true }; s.ctrl = { phase: 0, target: null, stage: 'G', t: 0 }; s.manualUntil = -1;
    syncSites(); buildWorld(); fitView();
    save(); selectSite(id); return true;
  }

  function buyCity(id) {
    const u = CITY.find(x => x.id === id);
    if (!u || G.city[id] || G.coins < u.cost) return false;
    G.coins -= u.cost; G.city[id] = true;
    save();
    return () => { if (!G.city[id]) return; delete G.city[id]; G.coins += u.cost; save(); };   // Undo: the coins back
  }

  // ---------- drawing ----------
  let P = {}, SC = 1;
  const cam = { z: 1, x: 0, y: 0 }; // zoom and pan on top of the fit-everything view
  function clampCam() {
    cam.z = Math.min(4, Math.max(1, cam.z));
    const mx = EXT.hx * (1 - 1 / cam.z), my = EXT.hy * (1 - 1 / cam.z);
    cam.x = Math.min(mx, Math.max(-mx, cam.x)); cam.y = Math.min(my, Math.max(-my, cam.y));
    const fit = document.getElementById('b-fit'); if (fit) fit.hidden = cam.z < 1.02;
  }
  function fitView() { cam.z = 1; cam.x = 0; cam.y = 0; clampCam(); }
  function toWorld(clientX, clientY) {
    const r = cv.getBoundingClientRect(), dpr = cv.width / r.width, z = SC * cam.z;
    return [((clientX - r.left) * dpr - cv.width / 2) / z + cam.x, ((clientY - r.top) * dpr - cv.height / 2) / z + cam.y];
  }
  function readPalette() {
    const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
    // the map is lit by the game clock, so its colours are the daytime ones; darkness is drawn over them
    P = { grass: '#7f9a68', kerb: '#c9c6bb', asphalt: '#4a4e52', paint: '#f4f2ea', box: '#f2c230',
      red: '#e0362e', amber: '#f2a900', go: '#19c060', sign: '#00703c', night: false };
  }
  function resize() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
  }
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const at = (s, dir, dist, lat, off) => [s.cx + dir[0] * dist + lat[0] * off, s.cy + dir[1] * dist + lat[1] * off];
  function armQuad(s, ap, d1, d2, a, b) {
    const h = HEAD[ap], L = kerbOf(h);
    const p = [at(s, h, -d1, L, a), at(s, h, -d1, L, b), at(s, h, -d2, L, b), at(s, h, -d2, L, a)];
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath();
  }
  function armLine(s, ap, d1, d2, lat) { const h = HEAD[ap], L = kerbOf(h), a = at(s, h, -d1, L, lat), b = at(s, h, -d2, L, lat); line(a[0], a[1], b[0], b[1]); }
  function inLane(s, ap, dist, lat, fn) {
    const h = HEAD[ap], L = kerbOf(h), p = at(s, h, -dist, L, lat);
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(Math.atan2(h[0], -h[1])); fn(); ctx.restore();
  }
  const FAR = 3000;

  function drawRoads() {
    ctx.globalAlpha = P.night ? 0.08 : 0.12; ctx.fillStyle = '#000';
    for (let i = 0; i < 900; i++) { const x = (i * 137.5) % 3000 - 1500, y = (i * 211.3) % 3000 - 1500; ctx.fillRect(x, y, 2, 2); }
    ctx.globalAlpha = 1;
    const A = site('A'), ms = mainSides();
    // main road, then cross roads at open junctions
    ctx.fillStyle = P.kerb;
    for (const X of ms) { armQuad(A, X, -1, FAR, -3 * LW - 7, 3 * LW + 7); ctx.fill(); }
    for (const s of G.sites) if (s.active) {
      for (const X of crossSides()) { armQuad(s, X, BOX - 2, FAR, -3 * LW - 7, 3 * LW + 7); ctx.fill(); }
      ctx.fillRect(s.cx - BOX - 7, s.cy - BOX - 7, (BOX + 7) * 2, (BOX + 7) * 2);
    }
    ctx.fillStyle = P.asphalt;
    for (const X of ms) { armQuad(A, X, -1, FAR, -3 * LW, 3 * LW); ctx.fill(); }
    for (const s of G.sites) if (s.active) {
      for (const X of crossSides()) { armQuad(s, X, BOX - 2, FAR, -3 * LW, 3 * LW); ctx.fill(); }
      ctx.fillRect(s.cx - BOX, s.cy - BOX, BOX * 2, BOX * 2);
    }
    for (const s of G.sites) {
      for (const X of s.sides) {
        const L = s.len[X] + BOX, nb = neighbor(s, X), start = s.active ? BOX + 6 : 0;
        // centre line and lane lines: the inbound half always, the outbound half where no other junction draws it
        ctx.strokeStyle = P.box; ctx.lineWidth = 1.6;
        armLine(s, X, start, L, 1.6); if (!nb) armLine(s, X, start, L, -1.6);
        ctx.strokeStyle = P.paint; ctx.lineWidth = 1.4; ctx.setLineDash([9, 9]);
        armLine(s, X, start, L, LW); armLine(s, X, start, L, 2 * LW);
        if (!nb) { armLine(s, X, start, L, -LW); armLine(s, X, start, L, -2 * LW); }
        ctx.setLineDash([]);
      }
      if (!s.active) { // plain road straight through an unbought site
        for (const X of ms) {
          ctx.strokeStyle = P.box; ctx.lineWidth = 1.6; armLine(s, X, 0, BOX, 1.6); armLine(s, X, 0, BOX, -1.6);
          ctx.strokeStyle = P.paint; ctx.lineWidth = 1.4; ctx.setLineDash([9, 9]);
          for (const lat of [LW, 2 * LW, -LW, -2 * LW]) armLine(s, X, 0, BOX, lat);
          ctx.setLineDash([]);
        }
        continue;
      }
      // closed turn lanes (not bought yet), lane arrows, stop lines
      for (const X of s.sides) {
        const open = !!s.up['lanes' + AXIS[X]];
        if (!open) {
          ctx.save();
          for (const [a, b] of [[0, LW], [2 * LW, 3 * LW]]) { armQuad(s, X, BOX + 4, BOX + 150, a + 1, b - 1); ctx.save(); ctx.clip();
            ctx.strokeStyle = P.paint; ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
            const h = HEAD[X], K = kerbOf(h);
            for (let d = BOX; d < BOX + 170; d += 9) { const p1 = at(s, h, -d, K, a), p2 = at(s, h, -(d + 14), K, b); line(p1[0], p1[1], p2[0], p2[1]); }
            ctx.restore(); }
          ctx.restore();
        }
        ctx.strokeStyle = P.paint; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const slot of open ? SLOTS : ['S']) for (const dist of [BOX + 40, BOX + 165]) {
          inLane(s, X, dist, SLOT_OFF[slot], () => {
            ctx.beginPath();
            const turns = open ? [slot] : TURNS;
            for (const t of turns) {
              if (t === 'S') { ctx.moveTo(0, 9); ctx.lineTo(0, -8); ctx.moveTo(-3.5, -4); ctx.lineTo(0, -8); ctx.lineTo(3.5, -4); }
              else { const sx = t === 'L' ? -1 : 1; ctx.moveTo(-sx * 2 * (open ? 1 : 0), 9); ctx.lineTo(-sx * 2 * (open ? 1 : 0), -3); ctx.lineTo(sx * 5, -3); ctx.moveTo(sx * 1.5, -6.5); ctx.lineTo(sx * 5, -3); ctx.lineTo(sx * 1.5, 0.5); }
            }
            ctx.stroke();
          });
        }
        ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
        ctx.strokeStyle = P.paint; ctx.fillStyle = P.paint; ctx.lineWidth = s.up.lights ? 3 : 4;
        const h = HEAD[X], K = kerbOf(h), a = at(s, h, -(BOX + 4), K, 1), b = at(s, h, -(BOX + 4), K, 3 * LW - 1);
        line(a[0], a[1], b[0], b[1]);
        if (!s.up.lights) inLane(s, X, BOX + 20, 1.5 * LW, () => { ctx.font = '800 11px Overpass, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('STOP', 0, 0); });
      }
      // box junction
      ctx.save();
      ctx.beginPath(); ctx.rect(s.cx - BOX + 2, s.cy - BOX + 2, (BOX - 2) * 2, (BOX - 2) * 2); ctx.clip();
      ctx.strokeStyle = P.box; ctx.globalAlpha = P.night ? 0.4 : 0.6; ctx.lineWidth = 1.5;
      for (let k = -2 * BOX; k <= 2 * BOX; k += 15) { line(s.cx + k - BOX, s.cy - BOX, s.cx + k + BOX, s.cy + BOX); line(s.cx + k + BOX, s.cy - BOX, s.cx + k - BOX, s.cy + BOX); }
      ctx.restore();
      ctx.strokeStyle = P.box; ctx.globalAlpha = P.night ? 0.6 : 0.9; ctx.lineWidth = 2;
      ctx.strokeRect(s.cx - BOX + 2, s.cy - BOX + 2, (BOX - 2) * 2, (BOX - 2) * 2);
      ctx.globalAlpha = 1;
    }
  }

  function drawMarkers() {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const s of G.sites) {
      if (!s.active) { // for sale
        const avail = true;
        ctx.setLineDash([7, 6]); ctx.strokeStyle = P.paint; ctx.lineWidth = 2; ctx.globalAlpha = avail ? 0.8 : 0.35;
        ctx.strokeRect(s.cx - BOX - 10, s.cy - BOX - 10, (BOX + 10) * 2, (BOX + 10) * 2); ctx.setLineDash([]);
        const [x, y] = MAIN === 'EW' ? [s.cx, s.cy - BOX - 40] : [s.cx + BOX + 75, s.cy];
        ctx.fillStyle = P.sign; roundRect(x - 62, y - 15, 124, 30, 6); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '800 12px Overpass, Arial, sans-serif';
        ctx.fillText(avail ? `+ Junction ${s.id} · ${SITE_COST[s.id]}` : `Junction ${s.id} · after B`, x, y + 1);
        ctx.globalAlpha = 1;
        continue;
      }
      // junction name plate
      const [nx, ny] = [s.cx - BOX - 72, s.cy - BOX - 72];
      ctx.fillStyle = P.sign; roundRect(nx - 13, ny - 12, 26, 24, 4); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '900 14px Overpass, Arial, sans-serif'; ctx.fillText(s.id, nx, ny + 1);
      if (G.selected === s.id) {
        ctx.strokeStyle = P.amber; ctx.lineWidth = 3; ctx.setLineDash([10, 7]);
        ctx.beginPath(); ctx.arc(s.cx, s.cy, BOX + 46, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    for (const src of G.sources) {
      const s = src.site, h = HEAD[src.ap], K = kerbOf(h), lim = (AXIS[src.ap] === 'NS' ? EXT.hy : EXT.hx) - Math.abs(dot([s.cx, s.cy], h)) - 40;
      const [x, y] = at(s, h, -lim, K, 1.5 * LW);
      if (src.jamT > 2) {
        ctx.globalAlpha = 0.6 + 0.4 * pulse; ctx.fillStyle = P.red; roundRect(x - 26, y - 11, 52, 22, 5); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff'; ctx.font = '900 11px Overpass, Arial, sans-serif'; ctx.fillText('JAM', x, y + 1);
      } else if (G.surge && G.surge.src === src) {
        ctx.globalAlpha = 0.6 + 0.4 * pulse; ctx.fillStyle = P.amber; roundRect(x - 32, y - 11, 64, 22, 5); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = '#1b1b1b'; ctx.font = '900 11px Overpass, Arial, sans-serif'; ctx.fillText('SURGE', x, y + 1);
      }
    }
  }

  function drawFurniture() {
    for (const s of G.sites) {
      if (!s.active) continue;
      for (const ap of APS) {
        const h = HEAD[ap], [x, y] = at(s, h, -78, kerbOf(h), 80);
        if (s.up.lights) drawHead(x, y, signal(s, ap), s.up.filters);
        else drawStopSign(x, y);
      }
    }
  }
  function drawHead(x, y, sg, arrows) {
    const dim = P.night ? '#202421' : '#2a2f2b';
    ctx.fillStyle = '#121513'; roundRect(x - 9, y - 28, 18, 46, 4); ctx.fill();
    ctx.strokeStyle = '#f2f2ee'; ctx.lineWidth = 1.2; ctx.stroke();
    const lamp = (cy, on, col) => {
      ctx.beginPath(); ctx.arc(x, cy, 5.2, 0, Math.PI * 2); ctx.fillStyle = on ? col : dim; ctx.fill();
      if (on) { ctx.save(); ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x, cy, 10, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    };
    lamp(y - 19, sg.main === 'R' || sg.main === 'RA', P.red);
    lamp(y - 5, sg.main === 'A' || sg.main === 'RA', P.amber);
    lamp(y + 9, sg.main === 'G', P.go);
    if (!arrows) return;
    const col = sg.arrow === 'G' ? P.go : sg.arrow === 'A' ? P.amber : dim;
    for (const side of [-1, 1]) {
      const bx = side > 0 ? x + 10 : x - 26;
      ctx.fillStyle = '#121513'; roundRect(bx, y + 1, 16, 16, 3); ctx.fill(); ctx.strokeStyle = '#f2f2ee'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      const cx = bx + 8, tip = cx + side * 5;
      line(cx - side * 5, y + 9, tip, y + 9); line(tip - side * 4, y + 5, tip, y + 9); line(tip - side * 4, y + 13, tip, y + 9);
      ctx.lineCap = 'butt';
    }
  }
  function drawStopSign(x, y) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; ctx.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); }
    ctx.closePath(); ctx.fillStyle = P.red; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '900 7.5px Overpass, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('STOP', x, y + 0.5);
  }

  function carPose(car) {
    const m = car.mv, p = posAt(m, car.d - car.len / 2);
    if (car.shift && car.d < 90 + car.len) { // still changing lanes after the last junction
      const k = kerbOf(m.g.h), f = car.shift * Math.max(0, 1 - (car.d - car.len / 2) / 90);
      p[0] += k[0] * f; p[1] += k[1] * f;
    }
    return p;
  }
  // dusk, night and dawn: darken the map, then add street lights, headlights and tail lights on top
  function drawLighting() {
    const h = G.clock, dk = darkAt(h), warm = warmAt(h);
    if (warm > 0) { ctx.fillStyle = `rgba(255,128,48,${0.17 * warm})`; ctx.fillRect(-4000, -4000, 8000, 8000); }
    if (dk <= 0) return;
    ctx.fillStyle = `rgba(8,14,36,${0.64 * dk})`; ctx.fillRect(-4000, -4000, 8000, 8000);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const lamp = (x, y, r, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,196,120,${a})`); g.addColorStop(1, 'rgba(255,196,120,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    };
    const u = MAIN === 'EW' ? [1, 0] : [0, 1], n = [-u[1], u[0]], reach = Math.max(EXT.hx, EXT.hy);
    for (let t = -Math.ceil(reach / 170) * 170 + 85; t < reach; t += 170) for (const sd of [-1, 1]) {
      lamp(u[0] * t + n[0] * sd * 62, u[1] * t + n[1] * sd * 62, 75, 0.2 * dk);
    }
    for (const s of G.sites) if (s.active) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lamp(s.cx + sx * 62, s.cy + sy * 62, 95, 0.26 * dk);
    for (const car of G.cars) {
      const p = carPose(car), hl = car.len / 2;
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(p[2]);
      const g = ctx.createRadialGradient(hl + 2, 0, 1, hl + 24, 0, 34);
      g.addColorStop(0, `rgba(255,236,180,${0.42 * dk})`); g.addColorStop(1, 'rgba(255,236,180,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(hl, -4); ctx.lineTo(hl + 44, -14); ctx.lineTo(hl + 44, 14); ctx.lineTo(hl, 4); ctx.fill();
      ctx.fillStyle = `rgba(255,${car.brake ? 40 : 30},20,${(car.brake ? 0.9 : 0.5) * dk})`;
      ctx.fillRect(-hl - 1.5, -4.8, 2.5, 2.8); ctx.fillRect(-hl - 1.5, 2, 2.5, 2.8);
      ctx.restore();
    }
    ctx.restore();
  }
  function drawCars() {
    const blink = Math.floor(G.T * 2.6) % 2 === 0;
    for (const car of G.cars) {
      const m = car.mv, p = carPose(car), sp = sprite(car.type, car.paint), hl = car.len / 2, hw = VEH[car.type].w / 2;
      ctx.save(); ctx.translate(p[0] + 1.3, p[1] + 1.8); ctx.rotate(p[2]); // shadow, cast down and to the right
      ctx.fillStyle = 'rgba(0,0,0,.26)'; roundRect(-hl, -hw, car.len, hw * 2, 3); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(p[2]);
      ctx.drawImage(sp.c, -sp.ox, -sp.oy, sp.w, sp.h);
      if (car.brake) {
        ctx.fillStyle = '#ff3b30'; ctx.fillRect(-hl - 0.3, -hw + 0.8, 1.1, 2.2); ctx.fillRect(-hl - 0.3, hw - 3, 1.1, 2.2);
        ctx.globalAlpha = 0.3; ctx.fillRect(-hl - 2.6, -hw + 0.2, 2.4, 3.4); ctx.fillRect(-hl - 2.6, hw - 3.6, 2.4, 3.4); ctx.globalAlpha = 1;
      }
      if (car.turn !== 'S' && blink && car.d > m.dStop - 140 && car.d - car.len < m.dBoxEnd) {
        const sy = car.turn === 'L' ? -1 : 1;
        ctx.fillStyle = '#ffb000';
        ctx.fillRect(hl - 2, sy > 0 ? hw - 1.6 : -hw - 0.2, 2.2, 1.8); ctx.fillRect(-hl - 0.2, sy > 0 ? hw - 1.6 : -hw - 0.2, 2.2, 1.8);
        ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(hl - 1, sy * hw, 2.6, 0, Math.PI * 2); ctx.arc(-hl + 1, sy * hw, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      ctx.restore();
      if (car.wait > 25 && !car.committed) { // a small roof marker on drivers who have waited a long time
        ctx.fillStyle = car.wait > 45 ? P.red : P.amber; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.arc(p[0], p[1], 1.9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = P.grass; ctx.fillRect(0, 0, cv.width, cv.height);
    SC = Math.min(cv.width / (2 * EXT.hx), cv.height / (2 * EXT.hy));
    clampCam();
    const z = SC * cam.z;
    ctx.setTransform(z, 0, 0, z, cv.width / 2 - cam.x * z, cv.height / 2 - cam.y * z);
    drawRoads(); drawCars(); drawLighting(); drawFurniture(); drawMarkers();
  }

  // ---------- the frame: stats, the chosen junction, the shop, Settings ----------
  const $ = id => document.getElementById(id);
  const S = window.AllisonOS && AllisonOS.settings;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const startCard = $('startCard');
  const playing = () => startCard.hidden;

  // the toast: what just happened, at the bottom above the junction's panel, with Undo where it can be taken back
  let toastTimer = 0;
  function toast(msg, undo, ms) {
    $('toastMsg').textContent = msg;
    $('toastAct').hidden = !undo;
    $('toastAct').onclick = () => { if (undo) undo(); $('toast').hidden = true; if (paused) toast('Paused', null, Infinity); };
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    if (ms !== Infinity) toastTimer = setTimeout(() => { $('toast').hidden = true; if (paused && playing()) toast('Paused', null, Infinity); }, ms || 4000);
  }
  function placeToast() { const d = document.querySelector('.dock'); if (d) $('toast').style.bottom = (innerHeight - d.getBoundingClientRect().top + 10) + 'px'; }

  function setPaused(p) {
    paused = p;
    $('pauseIcon').setAttribute('d', p ? 'M8 5.6v12.8a.8.8 0 0 0 1.2.7l10-6.4a.8.8 0 0 0 0-1.4l-10-6.4A.8.8 0 0 0 8 5.6z' : 'M8 5v14M16 5v14');
    $('bPause').setAttribute('aria-label', p ? 'Resume' : 'Pause');
    if (p && playing()) toast('Paused', null, Infinity); else if (!p) $('toast').hidden = true;
  }

  // ---- sheets (as in Improve): open, close, drag down, Escape; the game pauses while one is open ----
  const focusStack = [];
  let pausedBySheet = false;
  const anyOpen = () => [...document.querySelectorAll('.sheetwrap')].some(w => !w.hidden);
  function openSheet(id) {
    focusStack.push(document.activeElement); $(id).hidden = false;
    if (!paused && playing()) { pausedBySheet = true; setPaused(true); $('toast').hidden = true; }
  }
  function closeSheet(id) {
    $(id).hidden = true;
    const f = focusStack.pop(); if (f && f.focus && document.contains(f)) f.focus({ preventScroll: true });
    if (!anyOpen() && pausedBySheet) { pausedBySheet = false; setPaused(false); }
  }
  document.querySelectorAll('.sheetwrap').forEach(w => w.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(w.id); }));
  document.querySelectorAll('.sheetwrap').forEach(w => {   // drag a sheet down by its handle or title bar to close it
    const sheet = w.querySelector('.sheet'), scrim = w.querySelector('.scrim');
    let y0 = null, dy = 0, drag = false;
    const start = (y, t) => { y0 = t.closest('.grab, .sheethead') && !t.closest('button') ? y : null; dy = 0; drag = false; };
    const move = (y, e) => { if (y0 === null) return; dy = y - y0; if (!drag) { if (dy < 8) return; drag = true; sheet.classList.add('dragging'); }
      if (e.cancelable) e.preventDefault(); const d = Math.max(0, dy); sheet.style.transform = 'translateY(' + d + 'px)'; scrim.style.opacity = String(Math.max(0, 1 - d / sheet.offsetHeight)); };
    const end = () => { if (y0 === null) return; y0 = null; if (!drag) return; sheet.classList.remove('dragging');
      const done = dy > 110; sheet.style.transform = ''; scrim.style.opacity = ''; if (done) closeSheet(w.id); };
    sheet.addEventListener('touchstart', e => { if (e.touches.length === 1) start(e.touches[0].clientY, e.target); }, { passive: true });
    sheet.addEventListener('touchmove', e => move(e.touches[0].clientY, e), { passive: false });
    sheet.addEventListener('touchend', end); sheet.addEventListener('touchcancel', end);
  });
  if (window.visualViewport) {
    const vv = window.visualViewport, root = document.documentElement.style;
    const fit = () => { root.setProperty('--vvh', vv.height + 'px'); root.setProperty('--vvt', vv.offsetTop + 'px'); };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
  }

  // ---- the shop: the chosen junction's upgrades, the road network and the city ----
  let shopSite = 'A';
  const coins = n => n.toLocaleString('en-US') + ' coins';
  function renderShop() {
    if (!S) return;
    const open = G.sites.filter(s => s.active).map(s => s.id);
    if (!open.includes(shopSite)) shopSite = 'A';
    const s = site(shopSite);
    const row = (kind, id, u, owned, why) => owned ? S.info({ title: u.name, sub: u.desc, value: 'Owned' })
      : S.action({ id: kind + '-' + id, icon: 'plus', title: u.name, sub: u.desc, value: why || coins(u.cost), disabled: !!why || G.coins < u.cost, data: { kind, up: id } });
    const next = nextForSale();
    $('shopBody').innerHTML =
      S.section('', S.info({ id: 'shopCoins', title: 'You have ' + coins(Math.floor(G.coins)) }))
      + S.section('Junction ' + s.id, [
        open.length > 1 ? S.select({ id: 'shopPick', title: 'Junction', options: open.map(id => [id, 'Junction ' + id]), value: s.id }) : '',
        ...UPG.map(u => { const c = canBuy(s, u); return row('up', u.id, u, c.why === 'owned', c.why && c.why !== 'cost' && c.why !== 'owned' ? c.why : ''); }),
      ])
      + S.section('Road network', BUY_ORDER.map(id => {
        const t = site(id), k = SITE_DEF[id], prev = BUY_ORDER[BUY_ORDER.indexOf(id) - 1];
        const dir = k > 0 ? (MAIN === 'EW' ? 'east' : 'south') : (MAIN === 'EW' ? 'west' : 'north');
        const u = { name: 'Junction ' + id, desc: 'A new crossroads ' + (Math.abs(k) === 1 ? 'next to A' : 'beyond ' + (k > 0 ? 'B' : 'C')) + ', to the ' + dir + '. It opens with timed lights.', cost: SITE_COST[id] };
        return t && t.active ? S.info({ title: u.name, sub: u.desc, value: 'Open' }) : row('site', id, u, false, id !== next ? 'Open ' + prev + ' first' : '');
      }), { hint: 'A new junction adds side roads with more traffic, and every car that passes through it earns more.' })
      + S.section('City-wide', CITY.map(u => row('city', u.id, u, !!G.city[u.id])));
  }
  $('shopBody').addEventListener('change', e => { if (e.target.id === 'shopPick') { shopSite = e.target.value; selectSite(shopSite); renderShop(); } });
  $('shopBody').addEventListener('click', async e => {
    const b = e.target.closest('[data-kind]'); if (!b || b.disabled) return;
    const { kind, up } = b.dataset;
    if (kind === 'up') { const undo = buy(shopSite, up); if (undo) { const u = UPG.find(x => x.id === up); toast(`Junction ${shopSite}: ${u.name[0].toLowerCase() + u.name.slice(1)} added.`, () => { undo(); renderShop(); renderPanel(); }); } }
    else if (kind === 'city') { const undo = buyCity(up); if (undo) toast(`${CITY.find(x => x.id === up).name} is in place.`, () => { undo(); renderShop(); }); }
    else if (kind === 'site') {
      if (!await S.ask({ title: `Open junction ${up}?`, text: `It costs ${coins(SITE_COST[up])}, and a junction can't be closed again.`, yes: 'Open it' })) return;
      if (buySite(up)) { shopSite = up; toast(`Junction ${up} is open, with timed lights.`); }
    }
    renderShop(); renderPanel();
  });

  // ---- Settings: Design, the game's own, your data ----
  function renderMore() {
    if (!S) return;
    $('moreBody').innerHTML = (window.aosDesign ? S.section('Design', S.raw(aosDesign.picker(), { id: 'moreDesign' })) : '')
      + S.section('Game', [
        S.choice({ id: 'stView', title: 'View', sub: 'Wide shows longer roads, so more cars can queue.', options: [['close', 'Close'], ['normal', 'Normal'], ['wide', 'Wide']], value: view }),
        S.choice({ id: 'stSpeed', title: 'Game speed', options: [['1', '×1'], ['2', '×2'], ['3', '×3']], value: String(speed) }),
        S.choice({ id: 'stDay', title: 'Length of a day', sub: 'Real minutes for a whole day, rush hours and all.', options: [['10', '10 min'], ['16', '16 min'], ['24', '24 min']], value: String(dayMin) }),
        S.select({ id: 'stHold', title: 'Manual override', sub: 'How long the lights stay yours after you tap a phase.', options: [['10', '10 seconds'], ['20', '20 seconds'], ['40', '40 seconds'], ['0', 'Until you say']], value: String(hold) }),
      ], { value: VIEW_NAMES[view] })
      + S.section('Your data', [
        S.info({ title: 'Saved on this phone', sub: 'Your coins, upgrades and junctions save as you play.' }),
        S.danger({ id: 'stReset', title: 'Start a new game', sub: 'Wipes your coins, upgrades and junctions.' }),
      ]);
  }
  const VIEW_NAMES = { close: 'Close', normal: 'Normal', wide: 'Wide' };
  if (window.aosDesign) aosDesign.bind($('moreBody'));   // Design: the four looks, at once (../home/design.js)
  $('moreBody').addEventListener('click', e => {
    const v = S.pick(e);
    if (v != null) {
      const id = e.target.closest('[role="radiogroup"]').id;
      if (id === 'stView') { view = v; store('junction.view', v); buildWorld(); fitView(); }
      if (id === 'stSpeed') speed = +v;
      if (id === 'stDay') { dayMin = +v; store('junction.daylen', v); }
      return;
    }
    const r = e.target.closest('#stReset');
    if (r && S.armed(r, 'Tap again to wipe your game')) {
      try { localStorage.removeItem('junction.save.v4'); } catch (er) {}
      closeSheet('moreSheet'); startGame(null); toast('A new game, from 10:00 on day 1.');
    }
  });
  $('moreBody').addEventListener('change', e => { if (e.target.id === 'stHold') { hold = +e.target.value; store('junction.hold', String(hold)); } });
  $('moreBtn').addEventListener('click', () => { renderMore(); openSheet('moreSheet'); });
  $('jShop').addEventListener('click', () => { shopSite = G.selected; renderShop(); openSheet('shopSheet'); });

  // ---- the chosen junction's panel ----
  function selectSite(id) { G.selected = id; shopSite = id; renderPanel(); }
  function renderPanel() {
    const s = site(G.selected) || site('A'), lights = !!s.up.lights;
    $('jName').textContent = 'Junction ' + s.id;
    $('jCtrl').textContent = lights ? (s.up.smart ? 'Smart lights' : 'Timed lights') : 'Stop signs';
    $('jPhases').hidden = !lights;
    $('ph1').hidden = $('ph3').hidden = !s.up.filters;
    $('jPhases').classList.toggle('two', lights && !s.up.filters);
    $('jMode').hidden = !lights;
    const has = UPG.filter(u => s.up[u.id] && u.id !== 'lights').map(u => u.name[0].toLowerCase() + u.name.slice(1));
    $('jNote').textContent = (lights ? 'Tap a phase to take over the lights.' : `Cars stop, then go in the order they came. Traffic lights are ${coins(UPG[0].cost)} in Upgrades.`)
      + (has.length ? ' Has ' + has.join(', ') + '.' : '');
    updatePanelLive(); placeToast();
  }
  function updatePanelLive() {
    const s = site(G.selected); if (!s || !s.up.lights) return;
    const manual = s.manualUntil === Infinity || G.T < s.manualUntil, m = $('jMode');
    m.className = 'tagp ' + (manual ? 'manual' : 'auto');
    m.textContent = manual ? (s.manualUntil === Infinity ? 'Manual' : `Manual · auto in ${Math.ceil(s.manualUntil - G.T)}s`) : 'Auto';
    $('jAuto').hidden = !manual;
    for (let i = 0; i < 4; i++) { const el = $('ph' + i); el.classList.toggle('on', s.ctrl.stage === 'G' && s.ctrl.phase === i); el.classList.toggle('next', s.ctrl.target === i); }
  }
  function takeOver(p) {
    const s = site(G.selected);
    if (!s || !s.up.lights || !phasesOf(s).includes(p) || !playing()) return;
    s.manualUntil = hold ? G.T + hold : Infinity;
    request(s, p); updatePanelLive();
  }
  function backToAuto() { const s = site(G.selected); if (s) s.manualUntil = -1; updatePanelLive(); }
  for (const b of document.querySelectorAll('.phase')) b.addEventListener('click', () => takeOver(+b.dataset.p));
  $('jAuto').addEventListener('click', backToAuto);

  // ---- the stats along the top ----
  const SUN = 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2zM11 20h2v3h-2zM1 11h3v2H1zM20 11h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zM16.3 17.7l1.4-1.4 2.1 2.1-1.4 1.4zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1z';
  const MOON = 'M15.5 2.5A9.5 9.5 0 1 0 21.5 16 7.5 7.5 0 0 1 15.5 2.5z';
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  function paintDaybar() { // traffic through the day, calm green to rush-hour red
    const stops = [];
    for (let h = 0; h <= 24; h += 0.5) {
      const t = Math.min(1, Math.max(0, (demandAt(h) - 0.22) / (1.8 - 0.22)));
      const c = t < 0.5 ? mix([111, 165, 120], [232, 162, 0], t * 2) : mix([232, 162, 0], [200, 50, 43], (t - 0.5) * 2);
      stops.push(`rgb(${c.join(',')}) ${(h / 24 * 100).toFixed(1)}%`);
    }
    $('daybar').style.background = `linear-gradient(90deg, ${stops.join(',')})`;
  }
  function updateHUD() {
    $('sCoins').textContent = Math.floor(G.coins).toLocaleString('en-US');
    const r = Math.round(G.rate), re = $('sRate');
    re.textContent = `${r >= 0 ? '+' : '−'}${Math.abs(r)}/min`; re.className = 'small' + (r > 0 ? ' up' : r < 0 ? ' down' : '');
    $('coinsBox').classList.toggle('flash', G.flash > 0);
    $('sCars').textContent = G.cleared.toLocaleString('en-US');
    $('sFlow').textContent = Math.round(G.flowAvg * 100) + '%';
    $('sLevel').textContent = G.level; $('sDay').textContent = G.day;
    $('sClock').textContent = fmtClock(G.clock);
    const per = periodAt(G.clock), pe = $('sPeriod');
    pe.textContent = per; pe.className = 'small' + (/rush hour/.test(per) ? ' rush' : /building|easing/.test(per) ? ' build' : '');
    $('dayMark').style.left = (G.clock / 24 * 100) + '%';
    $('skyIcon').setAttribute('d', darkAt(G.clock) > 0.5 ? MOON : SUN);
    updatePanelLive();
    if (!$('shopSheet').hidden) { const c = $('shopCoins'); if (c) c.querySelector('.st-title').textContent = 'You have ' + coins(Math.floor(G.coins)); }
  }

  // ---- starting ----
  function startGame(saveData) {
    newGame(saveData);
    startCard.hidden = true; setPaused(false); fitView();
    selectSite('A');
  }
  $('bNew').addEventListener('click', () => startGame(null));
  $('bContinue').addEventListener('click', () => startGame(loadSave()));

  // ---- the map: drag to move, pinch or scroll to zoom, tap a junction ----
  const ptrs = new Map();
  let drag = null, pinch = null;
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z, w: toWorld((a.x + b.x) / 2, (a.y + b.y) / 2) }; if (drag) drag.moved = true; }
  });
  cv.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = cv.getBoundingClientRect(), dpr = cv.width / r.width;
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      cam.z = pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d); clampCam();
      const z = SC * cam.z; cam.x = pinch.w[0] - ((mx - r.left) * dpr - cv.width / 2) / z; cam.y = pinch.w[1] - ((my - r.top) * dpr - cv.height / 2) / z; clampCam();
    } else if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 6) drag.moved = true;
      if (drag.moved && cam.z > 1.02) { const z = SC * cam.z; cam.x = drag.cx - dx * dpr / z; cam.y = drag.cy - dy * dpr / z; clampCam(); }
    }
  });
  const endPtr = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0) { if (drag && !drag.moved && e.type === 'pointerup') tapAt(e.clientX, e.clientY); drag = null; }
  };
  cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const w = toWorld(e.clientX, e.clientY), r = cv.getBoundingClientRect(), dpr = cv.width / r.width;
    cam.z *= Math.exp(-e.deltaY * 0.0015); clampCam();
    const z = SC * cam.z; cam.x = w[0] - ((e.clientX - r.left) * dpr - cv.width / 2) / z; cam.y = w[1] - ((e.clientY - r.top) * dpr - cv.height / 2) / z; clampCam();
  }, { passive: false });
  function tapAt(x, y) {
    if (!playing()) return;
    const [wx, wy] = toWorld(x, y);
    let best = null, bd = 140;
    for (const s of G.sites) { const d = Math.hypot(wx - s.cx, wy - s.cy); if (d < bd) { bd = d; best = s; } }
    if (!best) return;
    if (best.active) selectSite(best.id);
    else { shopSite = G.selected; renderShop(); openSheet('shopSheet'); }
  }
  $('bFit').addEventListener('click', fitView);
  $('bPause').addEventListener('click', () => { if (!playing()) return; pausedBySheet = false; setPaused(!paused); });
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => toast('Full screen isn’t available here.'));
  }
  $('bFull').addEventListener('click', toggleFull);
  if (!document.fullscreenEnabled) $('bFull').hidden = true;
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { const w = [...document.querySelectorAll('.sheetwrap')].reverse().find(x => !x.hidden); if (w) closeSheet(w.id); return; }
    if (anyOpen() || !playing()) return;
    if (['1', '2', '3', '4'].includes(k)) takeOver(+k - 1);
    else if (k === 'a') backToAuto();
    else if (k === 'j') { const open = G.sites.filter(s => s.active).map(s => s.id); selectSite(open[(open.indexOf(G.selected) + 1) % open.length]); }
    else if (k === 'u') $('jShop').click();
    else if (k === 'p') $('bPause').click();
    else if (k === '0') fitView();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && playing()) save(); });

  // ---------- the loop ----------
  let last = performance.now(), uiTimer = 0, shopTimer = 0;
  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    if (!paused && !document.hidden) for (let i = 0; i < speed; i++) step(dt);
    draw();
    uiTimer += dt; if (uiTimer > 0.15) { uiTimer = 0; updateHUD(); }
    shopTimer += dt; if (shopTimer > 0.8 && !$('shopSheet').hidden && !$('shopBody').contains(document.activeElement)) { shopTimer = 0; renderShop(); }
    requestAnimationFrame(frame);
  }
  let resizeTimer = 0;
  addEventListener('resize', () => { resize(); placeToast(); clearTimeout(resizeTimer); resizeTimer = setTimeout(() => G && buildWorld(), 150); });

  readPalette(); resize();
  // a working junction sits behind the start card
  newGame(null);
  G.demo = true;
  for (let i = 0; i < 300; i++) step(1 / 30);
  G.coins = 80; G.T = 0; G.progress = 0; G.level = 1; G.clock = 10; G.period = null;
  paintDaybar(); selectSite('A');
  const sv = loadSave();
  if (sv) {
    $('bContinue').hidden = false; $('saveLine').hidden = false;
    const n = Object.values(sv.sites || {}).filter(x => x.active).length;
    $('saveLine').textContent = `Your game: ${Math.floor(sv.coins || 0).toLocaleString('en-US')} coins, ${n} junction${n === 1 ? '' : 's'}, day ${sv.day || 1} at ${fmtClock(sv.clock ?? 10)}.`;
    $('bNew').classList.remove('cta');
  }
  draw(); updateHUD();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // For the tests (junction/scripts/app-test.mjs) only.
  window.__junction = { step: dt => step(dt), state: () => G, buy, buySite, buyCity, takeOver, selectSite, startGame, site, cam, CONF, renderShop };
})();
