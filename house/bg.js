// BACKGROUNDS: what moves behind the glass. Glass only reads with something
// behind it to bend; these are slow, minimal and nearly colourless, so the
// page stays calm. One is shown at a time, chosen in Settings → Customization
// and kept on this phone (house.bg); Bubbles until another is picked.
//   Bubbles        a few soft glass orbs drifting, bouncing off the screen's edges
//   Constellation  faint points drifting, joined by hairlines when near
//   Ripples        rings opening slowly from random points, as rain on still water
//   Aurora         two soft ribbons of light swaying across the top
//   Beach          the blurred dusk beach (an SVG in index.html)
//   None           just the page's colour
// Under it all, the page's own colour (house.tone). By default it follows
// the temperature outside (Temperature): Google Home's grey at 72.5°F, eased
// toward a faint blue at 60°F and a faint red at 85°F (held beyond them) -
// the same reading as the weather pill, rechecked every 30 s. Or a fixed one:
//   Slate, Navy, Sage, Dusk (mauve), Sand (taupe), Graphite, Black
// Each tone has a pale twin for light mode, which follows the phone's
// Appearance setting (and switches live with it); the drawings swap their
// light-on-dark for faint ink on light.
// All but Beach are drawn on one canvas at about 30 frames a second, paused
// while the app is hidden; with reduced motion they are drawn once, still.
'use strict';
const BG_IDEAS = [
  { id: 'bubbles', name: 'Bubbles', note: 'Small, very faint glass bubbles drift slowly and bounce off the edges of the screen.' },
  { id: 'stars', name: 'Constellation', note: 'Faint points drift, joined by hairlines when they come near each other.' },
  { id: 'ripples', name: 'Ripples', note: 'Rings open slowly from random points and fade, like rain on still water.' },
  { id: 'aurora', name: 'Aurora', note: 'Two soft ribbons of light sway slowly across the top of the screen.' },
  { id: 'beach', name: 'Beach', note: 'The blurred dusk beach, dimmed.' },
  { id: 'none', name: 'None', note: 'Just the colour, nothing moving.' },
];
const BG_TONES = [   // hex in dark mode, lite in light mode; Temperature works its own out
  { id: 'temp', name: 'Temperature', temp: true },
  { id: 'slate', name: 'Slate', hex: '#1A212B', lite: '#E6EBF1' }, { id: 'navy', name: 'Navy', hex: '#151C2C', lite: '#E2E8F4' },
  { id: 'sage', name: 'Sage', hex: '#18221F', lite: '#E4EDE7' }, { id: 'dusk', name: 'Dusk', hex: '#211C27', lite: '#ECE6F0' },
  { id: 'sand', name: 'Sand', hex: '#221F1B', lite: '#F2ECE4' }, { id: 'graphite', name: 'Graphite', hex: '#1C1D21', lite: '#E9EAED' },
  { id: 'black', name: 'Black', hex: '#0A0A0C', lite: '#F5F5F7' },
];
const BG = {
  id: null, c: null, x: null, w: 0, h: 0, dpr: 1, t0: 0, last: 0, raf: 0, s: null,
  still: matchMedia('(prefers-reduced-motion: reduce)').matches,
  // Light or dark as chosen in the app (Light, Dark or Automatic, home.settings.theme,
  // applied as data-theme by welcome.js), else the phone's own setting. Read
  // from storage too: this runs before the deferred welcome.js sets data-theme.
  get light() {
    let t = document.documentElement.dataset.theme;
    if (t !== 'light' && t !== 'dark') try { t = (JSON.parse(localStorage.getItem('home.settings')) || {}).theme; } catch { t = null; }
    if (t === 'light' || t === 'dark') return t === 'light';
    return matchMedia('(prefers-color-scheme: light)').matches;
  },
  // a colour for each mode: light-on-dark, or ink on light
  ink(dark, lite) { return this.light ? lite : dark; },
  pick() { const v = store.get('bg'); return BG_IDEAS.some(i => i.id === v) ? v : 'bubbles'; },
  set(id) { store.set('bg', id); this.start(id); },
  tone() { const v = store.get('tone'); return BG_TONES.find(t => t.id === v) || BG_TONES[0]; },
  setTone(id) { store.set('tone', id); this.paintTone(); },
  // The page's colour, and the phone's bar over it.
  paintTone() {
    const t = this.tone(), c = t.temp ? this.tempColour(this.outsideF()) : this.light ? t.lite : t.hex;
    if (c === this.painted) return;
    this.painted = c;
    document.documentElement.style.setProperty('--bg', c);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = c;
  },
  // Temperature: cold, Google Home's grey, warm - at 60, 72.5 and 85°F - for each mode.
  T_LO: 60, T_HI: 85,
  TEMP: { dark: ['#1A2130', '#202124', '#291E20'], lite: ['#E4EBF5', '#F1F3F4', '#F6E8E7'] },
  tempColour(f) {
    const [cold, grey, warm] = this.TEMP[this.light ? 'lite' : 'dark'];
    if (!Number.isFinite(f)) return grey;
    const mid = (this.T_LO + this.T_HI) / 2, half = (this.T_HI - this.T_LO) / 2;
    const k = Math.max(-1, Math.min(1, (f - mid) / half));
    const a = k < 0 ? cold : warm, w = Math.abs(k);
    const ch = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
    return '#' + [0, 1, 2].map(i => Math.round(ch(grey, i) + (ch(a, i) - ch(grey, i)) * w).toString(16).padStart(2, '0')).join('').toUpperCase();
  },
  // Outside, in °F: the weather pill's reading (WXNOW, favorites.js), else Home Assistant's.
  outsideF() {
    if (typeof WXNOW !== 'undefined' && mode === 'live' && WXNOW.age() < 3 * 3600000) return WXNOW.d.tF;
    const w = st('weather.forecast_home'), t = w ? Number(w.attributes.temperature) : NaN;
    if (!Number.isFinite(t)) return null;
    return /C/.test(w.attributes.temperature_unit || '') ? t * 9 / 5 + 32 : t;
  },
  swatch(t) {
    if (!t.temp) return this.light ? t.lite : t.hex;
    const [c, m, w] = this.TEMP[this.light ? 'lite' : 'dark'];
    return `linear-gradient(135deg, ${c}, ${m} 50%, ${w})`;
  },
  start(id = this.pick()) {
    this.id = id;
    const box = document.querySelector('.bgfx'); box.dataset.bg = id;
    if (!this.c) { this.c = document.createElement('canvas'); box.prepend(this.c); this.x = this.c.getContext('2d'); addEventListener('resize', () => this.size()); }
    this.c.hidden = id === 'beach' || id === 'none';
    this.size(); this.s = null;
    cancelAnimationFrame(this.raf);
    if (!this.c.hidden) { this.t0 = performance.now(); this.last = 0; this.raf = requestAnimationFrame(t => this.frame(t)); }
  },
  size() {
    if (!this.c) return;
    this.dpr = Math.min(2, devicePixelRatio || 1); this.w = innerWidth; this.h = innerHeight;
    this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr);
    this.x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.still && this.s) this.draw(0, 0);
  },
  frame(t) {
    if (this.c.hidden) return;
    if (document.hidden) { this.raf = requestAnimationFrame(n => this.frame(n)); this.last = 0; return; }
    const dt = this.last ? Math.min(0.1, (t - this.last) / 1000) : 0;
    if (!this.last || t - this.last >= 33) { this.last = t; this.draw((t - this.t0) / 1000, dt); }
    if (!this.still) this.raf = requestAnimationFrame(n => this.frame(n));
  },
  rnd: (a, b) => a + Math.random() * (b - a),
  draw(time, dt) {
    const g = this.x, W = this.w, H = this.h;
    g.clearRect(0, 0, W, H);
    this[this.id](g, W, H, time, dt);
  },

  // Bubbles: 9 small orbs, 14-48 px, 4-10 px a second, bouncing off the edges.
  bubbles(g, W, H, time, dt) {
    if (!this.s) this.s = Array.from({ length: 9 }, (_, i) => { const r = this.rnd(14, 48), a = this.rnd(0, 6.28), v = this.rnd(4, 10);
      return { r, x: this.rnd(r, W - r), y: this.rnd(r, H - r), vx: Math.cos(a) * v, vy: Math.sin(a) * v, hue: i % 3 }; });
    for (const b of this.s) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); } if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); } if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy); }
      const tint = (this.light ? ['70,100,150', '50,125,120', '110,90,150'] : ['200,220,255', '190,240,235', '230,220,255'])[b.hue];
      // the body: brighter toward the rim, as a soap bubble
      const body = g.createRadialGradient(b.x, b.y, b.r * 0.2, b.x, b.y, b.r);
      body.addColorStop(0, `rgba(${tint},0.006)`); body.addColorStop(0.75, `rgba(${tint},0.02)`); body.addColorStop(1, `rgba(${tint},0.05)`);
      g.fillStyle = body; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.2832); g.fill();
      g.strokeStyle = this.ink('rgba(255,255,255,0.045)', 'rgba(40,60,90,0.045)'); g.lineWidth = 0.75; g.stroke();
      // a highlight up and to the left
      const hx = b.x - b.r * 0.42, hy = b.y - b.r * 0.42, hl = g.createRadialGradient(hx, hy, 0, hx, hy, b.r * 0.32);
      hl.addColorStop(0, this.ink('rgba(255,255,255,0.07)', 'rgba(255,255,255,0.3)')); hl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = hl; g.beginPath(); g.arc(hx, hy, b.r * 0.32, 0, 6.2832); g.fill();
    }
  },
  // Constellation: a point per ~9000 px², joined within 110 px.
  stars(g, W, H, time, dt) {
    if (!this.s) this.s = Array.from({ length: Math.round(Math.min(70, W * H / 9000)) }, () => { const a = this.rnd(0, 6.28), v = this.rnd(3, 8);
      return { x: this.rnd(0, W), y: this.rnd(0, H), vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: this.rnd(0.8, 1.6) }; });
    const P = this.s, R = 110;
    for (const p of P) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; }
    g.lineWidth = 0.6;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d = Math.hypot(dx, dy);
      if (d < R) { g.strokeStyle = `rgba(${this.ink('200,215,255', '60,80,130')},${(0.16 * (1 - d / R)).toFixed(3)})`; g.beginPath(); g.moveTo(P[i].x, P[i].y); g.lineTo(P[j].x, P[j].y); g.stroke(); }
    }
    g.fillStyle = this.ink('rgba(220,230,255,0.45)', 'rgba(50,65,110,0.32)');
    for (const p of P) { g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.2832); g.fill(); }
  },
  // Ripples: a new one every ~2.6 s, opening to 170 px over 9 s.
  ripples(g, W, H, time) {
    if (!this.s) this.s = { list: [], next: 0 };
    const S = this.s;
    if (time >= S.next) { S.list.push({ x: this.rnd(0.1, 0.9) * W, y: this.rnd(0.1, 0.9) * H, t: time }); S.next = time + this.rnd(1.8, 3.4); }
    S.list = S.list.filter(r => time - r.t < 9);
    for (const r of S.list) {
      const k = (time - r.t) / 9;
      for (const off of [0, 0.18, 0.36]) {
        const kk = k - off; if (kk <= 0) continue;
        const rad = 170 * Math.sqrt(kk), a = 0.16 * (1 - kk) * (1 - off);
        g.strokeStyle = `rgba(${this.ink('200,225,255', '60,90,140')},${a.toFixed(3)})`; g.lineWidth = 1;
        g.beginPath(); g.ellipse(r.x, r.y, rad, rad * 0.62, 0, 0, 6.2832); g.stroke();
      }
    }
  },
  // Aurora: two soft ribbons swaying, light added to light. Each is a stack
  // of thin strokes whose brightness falls off away from its middle, so it
  // has no edge (a canvas blur filter isn't on every iPhone).
  aurora(g, W, H, time) {
    // light added to light in dark mode; on a pale page, a soft wash of colour
    g.globalCompositeOperation = this.light ? 'source-over' : 'lighter'; g.lineCap = 'round'; g.lineWidth = 12;
    const L = this.light;
    const ribbon = (y0, amp, len, sp, ph, rgb, a) => {
      for (let k = -12; k <= 12; k++) {
        const off = k * 4.5, fall = Math.exp(-(k * k) / 32);
        g.beginPath();
        for (let x = -20; x <= W + 20; x += 12) {
          const y = y0 + off + Math.sin(x / len + time * sp + ph) * amp + Math.sin(x / (len * 0.37) - time * sp * 1.6) * amp * 0.25 + Math.sin(x / (len * 0.6) + time * sp * 0.7 + k * 0.08) * off * 0.3;
          x === -20 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.strokeStyle = `rgba(${rgb},${(a * fall).toFixed(4)})`; g.stroke();
      }
    };
    ribbon(H * 0.17, H * 0.05, W * 0.55, 0.12, 0, L ? '40,170,150' : '110,220,200', L ? 0.035 : 0.045);
    ribbon(H * 0.27, H * 0.06, W * 0.7, -0.09, 2, L ? '90,110,230' : '140,160,255', L ? 0.03 : 0.04);
    g.globalCompositeOperation = 'source-over';
  },
};
document.addEventListener('visibilitychange', () => { if (!document.hidden && BG.still && BG.c && !BG.c.hidden) BG.draw(0, 0); });
// Temperature is now the default; a phone that had a colour picked moves to it once, as asked.
if (store.get('toneV') !== 2) { store.set('tone', 'temp'); store.set('toneV', 2); }
BG.paintTone();
BG.start();
setInterval(() => BG.paintTone(), 30000);   // the reading moves; the colour follows (eased by the page's .5s transition)
// The phone switched between light and dark: the colour, and a still drawing redrawn.
BG.scheme = matchMedia('(prefers-color-scheme: light)');   // kept, so its listener lives as long as the page
BG.repaint = () => { BG.painted = null; BG.paintTone(); if (BG.still && BG.c && !BG.c.hidden) BG.draw(0, 0); };
BG.scheme.addEventListener('change', BG.repaint);
addEventListener('aos:theme', BG.repaint);   // Light, Dark or Automatic chosen in the app

// Settings → Customization → Background: a popup with the colours and the
// movements; a tap puts it behind the whole app at once.
const BG_FAM = family({
  id: 'custom', name: 'Customization', noSection: true,
  label() { return BG.tone().name + ' · ' + BG_IDEAS.find(i => i.id === BG.id).name; },
  sheet(id) {
    if (id !== 'bg') return null;
    const on = BG.id, tn = BG.tone();
    return {
      title: 'Background', accent: '190,194,204', pill: pillHTML2(this.label()),
      fx: '',
      parts: [
        ['tone', lbl('COLOUR') + `<div class="tones">${BG_TONES.map(t => `<button class="tone${t.id === tn.id ? ' on' : ''}" data-a="tone" data-v="${t.id}" aria-pressed="${t.id === tn.id}" style="--t:${BG.swatch(t)}">
            <i></i><span>${t.name}</span></button>`).join('')}</div>`],
        ['move', lbl('MOVEMENT') + `<div class="bglist">${BG_IDEAS.map(i => `<button class="bgopt${i.id === on ? ' on' : ''}" data-a="bg" data-v="${i.id}" aria-pressed="${i.id === on}">
            <span class="k"><b>${i.name}</b><small>${i.note}</small></span><span class="bg-tick">${svg(i.id === on ? 'check' : 'play', 18)}</span></button>`).join('')}</div>`],
        ['note', '<p class="tnote">Kept on this phone. Movement stops while the app is in the background, and stays still with Reduce Motion.</p>'],
      ],
    };
  },
  act(id, a, b) {
    if (a === 'bg') BG.set(b.dataset.v);
    if (a === 'tone') BG.setTone(b.dataset.v);
    const v = $('custBgV'); if (v) v.textContent = this.label();
    render();
  },
});
// Its row in Settings: the palette, the current pick, a chevron; it opens
// the popup (in place of the settings sheet).
(() => {
  const b = $('custBg'); if (!b) return;
  $('custBgIc').innerHTML = svg('palette', 18); $('custBgChev').innerHTML = svg('chevR', 16);
  $('custBgV').textContent = BG_FAM.label();
  b.addEventListener('click', () => openDev(BG_FAM, 'bg'));
})();
