// Ipsy: the AllisonOS helper you chat with. A little stem cell that changes into other cells
// as it works, in the look of the app it's in: the design picked in its Settings (../home/design.js,
// data-look on <html>: Vintage or Sea glass), following a change at once (aos:design, aos:look).
//
//   <script src="../home/ipsy.js"></script>     (before the app's script)
//   AllisonOS.ipsy.mount({
//     app: 'orders',                      // its own storage: ipsy.<app>.*
//     endpoint: '../orders/api/ipsy',     // the app's server route: adds Ipsy's instructions and
//     headers: { 'X-Orders': '1' },       //   tools, asks Claude, hands back the answer as it is
//     slot: element,                      // where its button goes (else the bottom left corner)
//     intro, placeholder, suggestions,    // the words on an empty chat
//     consent,                            // what is sent where, shown once before the first question
//     context: () => 'On screen: …',      // added to every question, with today's date
//     tools: { name: async (input, { confirm }) => ({ content, change: { text, undo } }) },
//                                         // confirm(text, { yes, no }): asks in the chat first (a card with
//                                         //   Yes / No) and resolves true or false; nothing runs until tapped
//     label: (name, input) => 'Looking at your orders',   // what Ipsy says it's doing
//   })   -> { open, close, busy, hint(text, onTap), ask(text, opt), note(text), change(text, undo), working(on), prompt(text) }
//          for work the app does with Ipsy by itself (Orders checks its "To check" orders)
//
// Tapped, Ipsy's chat pops out of it as a speech bubble (not a page): the bubble rises from
// above its head, tail pointing at it, and shrinks back into it when put away.
// The chat lives on the phone (localStorage ipsy.<app>.chat). Each step sends the whole
// conversation to the app's route; when Claude asks for one of the app's tools, it runs here (the
// data lives here) and its result goes back with the next step. Web search and web pages run at
// Anthropic and come back in the same answer. Every change a tool makes shows in the chat with Undo.
//
// The conversation is kept exactly as Claude returned it (thinking and web results included) and
// only ever added to: the API checks that earlier turns weren't changed.
//
// Moods: idle (a stem cell), listening (the box has focus), thinking (waiting for Claude: a nerve
// cell, sparks at its tips), working (running a tool: a white blood cell, on the hunt), talking
// (the answer appearing). Reduce Motion holds it still; each mood is still a pose.
(() => {
  'use strict';
  const AOS = window.AllisonOS = window.AllisonOS || {};
  if (AOS.ipsy) return;
  const me = document.currentScript;
  // The look: fixed by data-look on this script, else the page's (data-look on <html>), and kept in step with it.
  const FIXED = me && me.dataset.look;
  const LOOK = () => (FIXED || document.documentElement.dataset.look) === 'vintage' ? 'vintage' : 'glass';
  const followers = new Set();                       // elements that wear the page's look
  const wear = el => { const l = LOOK(); el.classList.toggle('ipsy-vintage', l === 'vintage'); el.classList.toggle('ipsy-glass', l !== 'vintage'); };
  const follow = el => { followers.add(el); wear(el); };
  for (const ev of ['aos:design', 'aos:look']) addEventListener(ev, () => followers.forEach(wear));
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del: k => { try { localStorage.removeItem(k); } catch {} },
  };
  const f1 = n => n.toFixed(1);
  const MAX_STEPS = 24;                 // model calls for one question, at most
  const MAX_CHAT = 950 * 1024;          // a conversation bigger than this is full (the route takes 1 MB)
  const MAX_RESULT = 40000;             // characters of one tool result

  // ---------------------------------------------------------------------------
  // The cell: one outline, a radius for each angle, so any cell type morphs into any other
  // ---------------------------------------------------------------------------
  const N = 56, DEG = Math.PI / 180, TAU = 2 * Math.PI;
  const G = (th, c, w) => { const d = Math.atan2(Math.sin(th - c), Math.cos(th - c)); return Math.exp(-((d / w) ** 2)); };
  const ell = (th, a, b, n = 2) => a * b / Math.pow(Math.pow(Math.abs(b * Math.cos(th)), n) + Math.pow(Math.abs(a * Math.sin(th)), n), 1 / n);
  const DEND = [-160, -115, -65, 150, 30], AMP = [34, 40, 36, 30, 62];
  const FORMS = {
    stem: () => 55,
    neuron: th => 42 + DEND.reduce((s, a, i) => s + AMP[i] * G(th, a * DEG, i === 4 ? 0.14 : 0.17), 0),
    wbc: th => 54 + 4.5 * Math.sin(8 * th) + 2.5 * Math.sin(13 * th + 1),
    rbc: th => ell(th, 70, 42),                                             // the rest, for showing off (aOS's Meet Ipsy)
    muscle: th => ell(th, 88, 32, 1.5),
    heart: th => ell(th, 70, 46, 4) + 14 * G(th, 160 * DEG, 0.2) + 12 * G(th, -20 * DEG, 0.2),
  };
  const MOOD_FORM = { idle: 'stem', listen: 'stem', think: 'neuron', work: 'wbc', talk: 'stem' };
  const TARGET = {};
  for (const k in FORMS) TARGET[k] = Array.from({ length: N }, (_, i) => FORMS[k](i * TAU / N));
  const TIP = DEND.map(a => Math.round((((a * DEG) % TAU) + TAU) % TAU / (TAU / N)) % N);

  function cellSvg() {
    return '<svg class="ipsy-cell" viewBox="0 0 200 200" aria-hidden="true" focusable="false" data-form="stem">'
      + '<ellipse class="i-shadow" cx="100" cy="188" rx="46" ry="6"/>'
      + '<g class="i-bob"><g class="i-rings"><circle class="i-ring" cx="100" cy="108" r="70"/><circle class="i-ring i-r2" cx="100" cy="108" r="70"/></g>'
      + '<g class="i-body-g"><path class="i-body" d="' + smooth(TARGET.stem.map((r, i) => pt(r, i, 1))) + '"/>'
      + '<circle class="i-nucleus" cx="128" cy="82" r="13"/>'
      + '<ellipse class="i-gloss" cx="72" cy="82" rx="11" ry="6" transform="rotate(-34 72 82)"/>'
      + '<g class="i-sparks">' + '<circle class="i-spark" cx="100" cy="108" r="5"/>'.repeat(5) + '</g>'
      + '<g class="i-look"><g class="i-eyes"><ellipse class="i-eye" cx="86" cy="104" rx="6" ry="8.5"/><ellipse class="i-eye" cx="114" cy="104" rx="6" ry="8.5"/></g></g>'
      + '<ellipse class="i-cheek" cx="72" cy="120" rx="7" ry="4"/><ellipse class="i-cheek" cx="128" cy="120" rx="7" ry="4"/>'
      + '<path class="i-smile" d="M93 120Q100 127 107 120"/><ellipse class="i-mouth" cx="100" cy="123" rx="6" ry="5"/>'
      + '</g></g></svg>';
  }
  const pt = (r, i, s) => { const th = i * TAU / N; return [100 + r * s * Math.cos(th), 108 + r * s * Math.sin(th)]; };
  function smooth(p) {
    const n = p.length; let d = 'M' + f1(p[0][0]) + ' ' + f1(p[0][1]);
    for (let i = 0; i < n; i++) {
      const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n], e = p[(i + 2) % n];
      d += 'C' + f1(b[0] + (c[0] - a[0]) / 6) + ' ' + f1(b[1] + (c[1] - a[1]) / 6) + ' ' + f1(c[0] - (e[0] - b[0]) / 6) + ' ' + f1(c[1] - (e[1] - b[1]) / 6) + ' ' + f1(c[0]) + ' ' + f1(c[1]);
    }
    return d + 'Z';
  }
  // Each drawn cell keeps its own outline; it eases toward its mood's form. The loop runs only
  // while something is moving (a morph, or the chat open), so a cell at rest costs nothing.
  const cells = new Set();
  let raf = 0, lastT = 0;
  function addCell(host) {
    host.innerHTML = cellSvg();
    const c = { host, svg: host.firstChild, cur: TARGET.stem.slice(), mood: 'idle', form: '', live: false };
    c.path = c.svg.querySelector('.i-body'); c.sparks = [...c.svg.querySelectorAll('.i-spark')];
    cells.add(c); place(c, 0, 0);
    return c;
  }
  const formOf = c => c.form || MOOD_FORM[c.mood];
  function setMood(c, mood) {
    c.mood = mood; c.host.dataset.mood = mood; c.svg.dataset.form = formOf(c);
    kick();
  }
  function place(c, dt, t) {
    const form = formOf(c), tgt = TARGET[form], k = still() || !dt ? 1 : Math.min(1, dt * 6);
    const wob = still() || !c.live ? 0 : c.mood === 'listen' ? 2.6 : 1.6;
    let moving = false;
    const p = t % 1, beating = form === 'heart' && !still();                    // a heart cell beats: lub, dub
    const beat = beating ? 1 + 0.06 * (Math.exp(-(((p - 0.05) / 0.05) ** 2)) + 0.6 * Math.exp(-(((p - 0.3) / 0.05) ** 2))) : 1;
    const pts = c.cur.map((r, i) => {
      const nr = r + (tgt[i] - r) * k;
      if (Math.abs(tgt[i] - nr) > 0.05) moving = true;
      c.cur[i] = nr;
      const th = i * TAU / N;
      return pt(nr + wob * Math.sin(3 * th + t * 2.2) + wob * 0.6 * Math.sin(5 * th - t * 1.7), i, beat);
    });
    c.path.setAttribute('d', smooth(pts));
    c.sparks.forEach((s, i) => { s.setAttribute('cx', f1(pts[TIP[i]][0])); s.setAttribute('cy', f1(pts[TIP[i]][1])); });
    return moving || beating || (c.live && !still());
  }
  function kick() { if (!raf) { lastT = 0; raf = requestAnimationFrame(frame); } }
  function frame(now) {
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016; lastT = now;
    let more = false;
    cells.forEach(c => { if (!c.host.isConnected) cells.delete(c); else if (place(c, dt, now / 1000)) more = true; });
    raf = more && document.visibilityState === 'visible' ? requestAnimationFrame(frame) : 0;
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick(); });

  // ---------------------------------------------------------------------------
  // The look: the app's own tokens, so it's Sea glass or Vintage, light or dark, as the app is
  // ---------------------------------------------------------------------------
  const CSS = `
.ipsy-hint{position:fixed;z-index:6;max-width:min(260px,calc(100vw - 110px));padding:9px 13px;border-radius:18px 18px 18px 6px;font-size:14px;font-weight:600;line-height:1.3;
  cursor:pointer;border:0;text-align:left;font-family:inherit;animation:ipsyPop .4s cubic-bezier(.2,1.3,.35,1) both;transform-origin:0 100%}
.ipsy-glass.ipsy-hint{background:var(--sheet,rgba(248,250,249,.95));color:var(--text,#10181A);box-shadow:0 8px 24px rgba(0,0,0,.18),inset 0 0 0 1px rgba(255,255,255,.5);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}
.ipsy-vintage.ipsy-hint{background:var(--mc-card,#FBF5E9);color:var(--mc-ink,#2B2522);box-shadow:0 0 0 2.5px var(--mc-mustard,#E3A72F),0 8px 20px rgba(43,37,34,.2)}
.ipsy-hint.out{animation:ipsyShrink .2s ease-in both}
.ipsy-btn{position:relative;width:62px;height:62px;padding:0;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.ipsy-btn:focus-visible{outline:2px solid var(--accent,#3B7366);outline-offset:2px;border-radius:50%}
.ipsy-btn .ipsy-host{width:100%;height:100%}
.ipsy-btn:active .ipsy-host{transform:scale(.92)}
:where(.ipsy-host){position:relative;display:block}
.ipsy-cell{width:100%;height:100%;display:block;overflow:visible;stroke:none}
.ipsy-cell *{stroke:none}
.ipsy-glass .ipsy-cell{filter:drop-shadow(0 6px 12px rgba(129,147,188,.35))}
.ipsy-cell .i-shadow{fill:rgba(16,24,26,.13)}
.ipsy-glass .i-body{fill:url(#ipsyGlass);stroke:rgba(255,255,255,.85);stroke-width:1.5}
.ipsy-vintage .i-body{fill:var(--mc-mustard,#E3A72F);transition:fill .5s}
.ipsy-vintage .ipsy-cell[data-form="neuron"] .i-body{fill:var(--mc-teal,#1F6F6B)}
.ipsy-vintage .ipsy-cell[data-form="wbc"] .i-body{fill:var(--mc-card,#FBF5E9);stroke:var(--mc-on-mustard,#2B2522);stroke-width:2.5}
.ipsy-vintage .ipsy-cell[data-form="rbc"] .i-body,.ipsy-vintage .ipsy-cell[data-form="heart"] .i-body{fill:var(--mc-orange,#D8572A)}
.ipsy-vintage .ipsy-cell[data-form="muscle"] .i-body{fill:var(--mc-olive,#7E8C34)}
.ipsy-vintage .ipsy-cell[data-form="rbc"] .i-cheek,.ipsy-vintage .ipsy-cell[data-form="heart"] .i-cheek{fill:var(--mc-mustard,#E3A72F)}
.ipsy-cell[data-form="muscle"] .i-gloss{opacity:0}
.i-nucleus{fill:#fff;opacity:.35;stroke:rgba(255,255,255,.85);stroke-width:1.5;transition:opacity .5s}
.ipsy-vintage .i-nucleus{fill:var(--mc-on-mustard,#2B2522);opacity:.12;stroke:none}
.ipsy-cell:not([data-form="stem"]) .i-nucleus{opacity:0}
.i-gloss{fill:#fff;opacity:.6;transition:opacity .4s}
.ipsy-vintage .i-gloss,.ipsy-cell[data-form="neuron"] .i-gloss{opacity:0}
.i-spark{fill:#E9D6B4;stroke:rgba(255,255,255,.85);stroke-width:1;opacity:0;transition:opacity .4s}
.ipsy-vintage .i-spark{fill:var(--mc-mustard,#E3A72F);stroke:none}
.ipsy-cell[data-form="neuron"] .i-spark{opacity:1;animation:ipsyFlash .5s steps(2) infinite}
.i-spark:nth-child(2){animation-delay:.1s}.i-spark:nth-child(3){animation-delay:.2s}.i-spark:nth-child(4){animation-delay:.3s}.i-spark:nth-child(5){animation-delay:.4s}
.i-eye{fill:#1E2A2C}
.ipsy-vintage .i-eye,.ipsy-vintage .i-mouth{fill:var(--mc-on-mustard,#2B2522)}
.ipsy-vintage .ipsy-cell[data-form="neuron"] .i-eye,.ipsy-vintage .ipsy-cell[data-form="neuron"] .i-mouth{fill:#FBF5E9}
.i-cheek{fill:rgba(214,140,134,.55)}
.ipsy-vintage .i-cheek{fill:var(--mc-orange,#D8572A)}
.ipsy-vintage .ipsy-cell[data-form="neuron"] .i-cheek{fill:var(--mc-mustard,#E3A72F)}
.i-smile{fill:none;stroke:#1E2A2C;stroke-width:3.2;stroke-linecap:round}
.ipsy-vintage .i-smile{stroke:var(--mc-on-mustard,#2B2522)}
.ipsy-vintage .ipsy-cell[data-form="neuron"] .i-smile{stroke:#FBF5E9}
.i-mouth{fill:#1E2A2C;opacity:0;transform-box:fill-box;transform-origin:center}
.i-ring{fill:none;stroke:rgba(129,147,188,.6);stroke-width:2;opacity:0;transform-box:fill-box;transform-origin:center}
.ipsy-vintage .i-ring{stroke:var(--mc-teal,#1F6F6B);stroke-width:3}
.i-bob{animation:ipsyBob 3.2s ease-in-out infinite}
.i-shadow{transform-box:fill-box;transform-origin:center;animation:ipsyShade 3.2s ease-in-out infinite}
.i-eyes{transform-box:fill-box;transform-origin:center;animation:ipsyBlink 4.8s infinite}
.i-look,.i-body-g{transform-box:fill-box;transition:transform .45s cubic-bezier(.3,1.4,.5,1)}
.i-body-g{transform-origin:50% 100%}
.i-look{transform-origin:center}
[data-mood="listen"] .i-body-g{transform:rotate(-6deg)}
[data-mood="listen"] .i-look{transform:scale(1.15)}
[data-mood="listen"] .i-ring{animation:ipsyRing 1.8s ease-out infinite}
[data-mood="listen"] .i-r2{animation-delay:.9s}
[data-mood="think"] .i-look,[data-mood="work"] .i-look{transform:translate(5px,-6px)}
[data-mood="think"] .i-bob{animation-duration:4.4s}
[data-mood="work"] .i-bob{animation-duration:1.6s}
[data-mood="talk"] .i-body-g{animation:ipsySquash .34s ease-in-out infinite alternate}
[data-mood="talk"] .i-smile{opacity:0}
[data-mood="talk"] .i-mouth{opacity:1;animation:ipsyJaw .22s ease-in-out infinite alternate}
@keyframes ipsyBob{50%{transform:translateY(-7px)}}
@keyframes ipsyShade{50%{transform:scaleX(.84);opacity:.7}}
@keyframes ipsyBlink{0%,91%,97%,100%{transform:scaleY(1)}94%{transform:scaleY(.1)}}
@keyframes ipsyRing{0%{transform:scale(.82);opacity:.7}100%{transform:scale(1.22);opacity:0}}
@keyframes ipsySquash{to{transform:scale(1.035,.965)}}
@keyframes ipsyJaw{from{transform:scaleY(.3)}to{transform:scaleY(1)}}
@keyframes ipsyFlash{50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){.ipsy-host *,.ipsy-wrap *{animation:none!important;transition:none!important}[data-mood="listen"] .i-ring{opacity:.5}}

.ipsy-wrap{position:fixed;inset:0;z-index:60}
.ipsy-wrap[hidden]{display:none}
.ipsy-scrim{position:absolute;inset:0;background:rgba(0,0,0,.22);animation:ipsyFade .3s both}
.ipsy-closing .ipsy-scrim{animation:ipsyFadeOut .22s ease-in both}
/* Ipsy itself, over the dark, where its button is (lifted above the keyboard); a tap puts the bubble away */
.ipsy-speaker{position:fixed;padding:0;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transform:translateY(calc(-1 * var(--ipsy-kb,0px)));transition:transform .25s}
/* the chat: a speech bubble that pops out of Ipsy, its tail pointing back at it */
.ipsy-bubble{position:fixed;left:var(--bx,12px);bottom:calc(var(--by,96px) + var(--ipsy-kb,0px));width:var(--bw,360px);max-height:var(--bh,520px);display:flex;flex-direction:column;
  color:var(--text,#10181A);border-radius:26px;padding:10px 12px 12px;transform-origin:var(--tail,40px) calc(100% + 16px);animation:ipsyPop .46s cubic-bezier(.2,1.3,.35,1) both}
.ipsy-closing .ipsy-bubble{animation:ipsyShrink .22s ease-in both}
.ipsy-bubble::after{content:"";position:absolute;bottom:-8px;left:calc(var(--tail,40px) - 9px);width:18px;height:18px;transform:rotate(45deg);border-radius:0 0 5px 0}
.ipsy-glass .ipsy-bubble{background:var(--sheet,rgba(248,250,249,.94));-webkit-backdrop-filter:blur(26px) saturate(1.6);backdrop-filter:blur(26px) saturate(1.6);box-shadow:0 18px 50px rgba(0,0,0,.24),inset 0 0 0 1px rgba(255,255,255,.45)}
.ipsy-glass .ipsy-bubble::after{background:var(--sheet,rgba(248,250,249,.94))}
.ipsy-vintage .ipsy-bubble{background:var(--mc-card,#FBF5E9);box-shadow:0 0 0 3px var(--mc-mustard,#E3A72F),0 16px 34px rgba(43,37,34,.26)}
.ipsy-vintage .ipsy-bubble::after{background:var(--mc-card,#FBF5E9);box-shadow:3px 3px 0 0 var(--mc-mustard,#E3A72F)}
@keyframes ipsyPop{from{opacity:0;transform:scale(.12)}60%{opacity:1}}
@keyframes ipsyShrink{to{opacity:0;transform:scale(.12)}}
@keyframes ipsyFadeOut{to{opacity:0}}
.ipsy-head{display:flex;align-items:center;gap:8px;min-height:38px;padding:0 0 0 4px}
.ipsy-head h2{flex:1;margin:0;font-size:17px;font-weight:700}
.ipsy-head h2 small{display:block;font-size:12px;font-weight:500;color:var(--muted,rgba(16,24,26,.64))}
.ipsy-x,.ipsy-new{height:34px;border:0;border-radius:999px;padding:0 12px;font:inherit;font-size:14px;font-weight:600;color:var(--accent-text,var(--accent,#3B7366));background:var(--glass,rgba(127,127,127,.12));cursor:pointer}
.ipsy-vintage .ipsy-x,.ipsy-vintage .ipsy-new{background:transparent;box-shadow:inset 0 0 0 2px var(--mc-edge,rgba(43,37,34,.14));color:var(--mc-teal,#1F6F6B)}
.ipsy-x{width:34px;padding:0;font-size:18px;line-height:1}
.ipsy-x:focus-visible,.ipsy-new:focus-visible,.ipsy-send:focus-visible,.ipsy-chip:focus-visible,.ipsy-undo:focus-visible{outline:2px solid var(--accent,#3B7366);outline-offset:2px}
.ipsy-log{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:8px;padding:14px 2px 10px;overscroll-behavior:contain}
.ipsy-msg{max-width:86%;padding:9px 13px;border-radius:18px;font-size:15px;line-height:1.42;overflow-wrap:anywhere;white-space:pre-wrap}
.ipsy-msg ul{margin:4px 0;padding-left:18px;white-space:normal}
.ipsy-msg a{color:inherit}
.ipsy-me{align-self:flex-end;border-bottom-right-radius:6px;background:var(--accent,#3B7366);color:var(--on-accent,#fff)}
.ipsy-vintage .ipsy-me{background:var(--mc-teal,#1F6F6B);color:#FBF5E9}
.ipsy-it{align-self:flex-start;border-bottom-left-radius:6px;background:var(--glass-2,rgba(255,255,255,.86));border:1px solid var(--hair,rgba(16,24,26,.08))}
.ipsy-vintage .ipsy-it{background:var(--mc-card-2,#F0E5D0);border:0}
.ipsy-src{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:6px;font-size:12px;white-space:normal}
.ipsy-src a{color:var(--muted,rgba(16,24,26,.64))}
.ipsy-act{align-self:flex-start;font-size:13px;color:var(--muted,rgba(16,24,26,.64));padding:0 6px;display:flex;gap:6px;align-items:center}
.ipsy-act::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.6}
.ipsy-change{align-self:stretch;display:flex;align-items:center;gap:10px;font-size:13.5px;padding:8px 10px 8px 12px;border-radius:14px;
  background:color-mix(in srgb,var(--accent,#3B7366) 12%,transparent);border:1px solid color-mix(in srgb,var(--accent,#3B7366) 30%,transparent)}
.ipsy-vintage .ipsy-change{background:color-mix(in srgb,var(--mc-mustard,#E3A72F) 22%,transparent);border-color:var(--mc-mustard,#E3A72F)}
.ipsy-change span{flex:1;min-width:0}
.ipsy-undo{border:0;background:none;font:inherit;font-weight:700;color:var(--accent-text,var(--accent,#3B7366));padding:6px 4px;cursor:pointer}
.ipsy-vintage .ipsy-undo{color:var(--mc-teal,#1F6F6B)}
.ipsy-change.undone{opacity:.6}.ipsy-change.undone span{text-decoration:line-through}
.ipsy-ask{align-self:stretch;display:grid;gap:10px;font-size:14.5px;line-height:1.4;padding:12px 12px 12px 14px;border-radius:16px;
  background:color-mix(in srgb,var(--accent,#3B7366) 9%,transparent);border:1.5px solid color-mix(in srgb,var(--accent,#3B7366) 45%,transparent)}
.ipsy-vintage .ipsy-ask{background:color-mix(in srgb,var(--mc-teal,#1F6F6B) 10%,transparent);border-color:var(--mc-teal,#1F6F6B)}
.ipsy-ask b{font-weight:700}
.ipsy-ask .ipsy-ans{display:flex;gap:8px;flex-wrap:wrap}
.ipsy-ask button{min-height:40px;padding:0 16px;border-radius:999px;font:inherit;font-weight:700;cursor:pointer;border:1.5px solid var(--accent,#3B7366);background:transparent;color:var(--accent-text,var(--accent,#3B7366))}
.ipsy-ask button[data-ans="yes"]{background:var(--accent,#3B7366);color:var(--on-accent,#fff)}
.ipsy-vintage .ipsy-ask button{border-color:var(--mc-teal,#1F6F6B);color:var(--mc-teal,#1F6F6B)}
.ipsy-vintage .ipsy-ask button[data-ans="yes"]{background:var(--mc-teal,#1F6F6B);color:#FBF5E9}
.ipsy-ask small{color:var(--muted,rgba(16,24,26,.64));font-size:13px}
.ipsy-err{align-self:stretch;font-size:14px;padding:10px 12px;border-radius:14px;color:var(--danger-ink,#AE2117);background:color-mix(in srgb,var(--danger,#E5281D) 10%,transparent)}
.ipsy-empty{margin:auto 0 6px;display:grid;gap:12px;font-size:15px;line-height:1.45}
.ipsy-empty p{margin:0;color:var(--muted,rgba(16,24,26,.64))}
.ipsy-chips{display:flex;flex-wrap:wrap;gap:8px}
.ipsy-chip{border:1px solid var(--hair,rgba(16,24,26,.1));background:var(--glass,rgba(255,255,255,.6));color:var(--text,#10181A);font:inherit;font-size:14px;padding:8px 12px;border-radius:999px;cursor:pointer;text-align:left}
.ipsy-vintage .ipsy-chip{background:transparent;border:2px solid var(--mc-mustard,#E3A72F)}
.ipsy-consent{display:grid;gap:10px;padding:12px 14px;border-radius:16px;background:var(--glass,rgba(255,255,255,.6));border:1px solid var(--hair,rgba(16,24,26,.08));font-size:14px;line-height:1.45}
.ipsy-vintage .ipsy-consent{background:var(--mc-card-2,#F0E5D0);border:0}
.ipsy-consent p{margin:0;color:var(--text,#10181A)}
.ipsy-form{display:flex;gap:8px;align-items:flex-end;padding-top:6px}
.ipsy-in{flex:1;min-width:0;resize:none;max-height:120px;min-height:44px;padding:11px 14px;border-radius:22px;font:inherit;font-size:16px;line-height:1.35;color:var(--text,#10181A);
  background:var(--glass-2,rgba(255,255,255,.86));border:1px solid var(--hair,rgba(16,24,26,.1))}
.ipsy-vintage .ipsy-in{background:var(--mc-card-2,#F0E5D0);border:2px solid var(--mc-edge,rgba(43,37,34,.14))}
.ipsy-in:focus{outline:2px solid var(--accent,#3B7366);outline-offset:1px}
.ipsy-send{width:44px;height:44px;flex:none;border:0;border-radius:50%;background:var(--cta,var(--accent,#3B7366));color:var(--cta-ink,#10181A);font-size:20px;font-weight:700;cursor:pointer}
.ipsy-vintage .ipsy-send{background:var(--cta,#C24C28);color:var(--cta-ink,#FFF8EC)}
.ipsy-send:disabled{opacity:.45;cursor:default}
.ipsy-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes ipsyUp{from{transform:translateY(100%)}}
@keyframes ipsyFade{from{opacity:0}}
`;
  let styled = false;
  function addStyle() {
    if (styled) return; styled = true;
    const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
    const defs = document.createElement('div');
    defs.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs><linearGradient id="ipsyGlass" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="#A9D3C7"/><stop offset=".45" stop-color="#B9C6E0"/><stop offset=".8" stop-color="#E3C5C3"/><stop offset="1" stop-color="#E9D6B4"/></linearGradient></defs></svg>';
    document.body.appendChild(defs.firstChild);
  }

  // ---------------------------------------------------------------------------
  // Words: Ipsy's replies, as text with **bold**, "- " lists and plain links
  // ---------------------------------------------------------------------------
  function rich(text) {
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/https?:\/\/[^\s<>()"]+[^\s<>()".,;:!?']/g, u => '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40) + (u.length > 48 ? '…' : '') + '</a>');
    const out = []; let list = null;
    String(text).trim().split('\n').forEach(line => {
      const m = /^\s*[-•*]\s+(.*)$/.exec(line);
      if (m) { if (!list) { list = []; out.push(list); } list.push(inline(m[1])); }
      else { list = null; out.push(inline(line)); }
    });
    return out.map(x => Array.isArray(x) ? '<ul>' + x.map(i => '<li>' + i + '</li>').join('') + '</ul>' : x).join('\n').replace(/\n?(<ul>)/g, '$1').replace(/(<\/ul>)\n?/g, '$1');
  }
  const ERRORS = {
    signin: 'Sign in with Face ID to chat with Ipsy.', 'accounts-off': 'Family sign-in isn’t switched on yet, so Ipsy can’t be used.',
    'no-ai': 'Ipsy isn’t set up yet: the owner needs to add the AI key.', limit: 'That’s a lot of questions for one day. Ipsy will be back tomorrow.',
    'ai-key': 'Anthropic didn’t accept the key. The owner can check it.', 'ai-busy': 'Claude is busy. Try again in a minute.',
    'ai-unreachable': 'Couldn’t reach Claude. Try again in a minute.', offline: 'No connection. Try again when you’re online.',
    'too-long': 'This chat is full. Tap New chat to keep going.', full: 'This chat is full. Tap New chat to keep going.',
    refused: 'Ipsy can’t help with that one.', steps: 'That took more steps than Ipsy is allowed for one question. Ask again with a little more detail.',
  };

  // ---------------------------------------------------------------------------
  // mount: the button, the chat bubble and the loop, for one app
  // ---------------------------------------------------------------------------
  function mount(o) {
    addStyle();
    const K = { chat: 'ipsy.' + o.app + '.chat', ok: 'ipsy.' + o.app + '.ok' };
    let messages = [], view = [], busy = false, undos = new Map();
    const asks = new Map();               // questions waiting on a Yes or No: id -> resolve
    try { const saved = JSON.parse(ls.get(K.chat, 'null')); if (saved && Array.isArray(saved.messages) && Array.isArray(saved.view)) { messages = saved.messages; view = saved.view; } } catch {}

    // The button
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'ipsy-btn'; follow(btn); btn.setAttribute('aria-label', 'Ask Ipsy'); btn.setAttribute('aria-haspopup', 'dialog');
    btn.innerHTML = '<span class="ipsy-host"></span>';
    if (o.slot) { o.slot.textContent = ''; o.slot.appendChild(btn); }
    else { btn.style.cssText = 'position:fixed;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:5'; document.body.appendChild(btn); }
    const btnCell = addCell(btn.firstChild);

    // The chat: a bubble that pops out of Ipsy
    const wrap = document.createElement('div');
    wrap.className = 'ipsy-wrap'; follow(wrap); wrap.hidden = true;
    wrap.innerHTML = '<div class="ipsy-scrim" data-close></div>'
      + '<button class="ipsy-speaker ipsy-host" type="button" aria-label="Put Ipsy away" data-close></button>'
      + '<section class="ipsy-bubble" role="dialog" aria-modal="true" aria-labelledby="ipsyTitle">'
      + '<div class="ipsy-head"><h2 id="ipsyTitle">Ipsy<small id="ipsyStatus">Your ' + esc(o.name || 'aOS') + ' helper</small></h2>'
      + '<button class="ipsy-new" type="button" id="ipsyNew">New chat</button><button class="ipsy-x" type="button" aria-label="Close" data-close>×</button></div>'
      + '<div class="ipsy-log" id="ipsyLog" aria-live="polite"></div>'
      + '<form class="ipsy-form" id="ipsyForm"><label class="ipsy-sr" for="ipsyIn">Message Ipsy</label>'
      + '<textarea class="ipsy-in" id="ipsyIn" rows="1" enterkeyhint="send" placeholder="' + esc(o.placeholder || 'Ask Ipsy') + '"></textarea>'
      + '<button class="ipsy-send" id="ipsySend" type="submit" aria-label="Send">↑</button></form></section>';
    document.body.appendChild(wrap);
    const $ = id => wrap.querySelector('#' + id);
    const log = $('ipsyLog'), input = $('ipsyIn'), sendBtn = $('ipsySend'), status = $('ipsyStatus');
    const speaker = wrap.querySelector('.ipsy-speaker'), peek = addCell(speaker);
    const mood = m => { setMood(peek, m); setMood(btnCell, m === 'listen' ? 'idle' : m); };
    const say = s => { status.textContent = s || 'Your ' + (o.name || 'aOS') + ' helper'; };

    // Where the bubble goes: Ipsy stands in for its button (the same cell, in the same place, over the
    // dark), and the bubble rises from just above its head, its tail pointing down at it.
    const vv = window.visualViewport;
    function place() {
      const r = btn.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
      const kb = vv ? Math.max(0, H - vv.height - vv.offsetTop) : 0;
      const box = r.width ? r : { left: 12, top: H - 90, width: 62, height: 62 };
      Object.assign(speaker.style, { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px' });
      const w = Math.min(380, W - 24), cx = box.left + box.width / 2;
      const left = Math.max(12, Math.min(cx - 44, W - w - 12)), by = H - box.top + 2;
      wrap.style.setProperty('--ipsy-kb', kb + 'px');
      wrap.style.setProperty('--bx', left + 'px'); wrap.style.setProperty('--by', by + 'px'); wrap.style.setProperty('--bw', w + 'px');
      wrap.style.setProperty('--bh', Math.max(220, Math.min(560, (H - kb) * 0.68, H - by - kb - 64)) + 'px');   // it grows with the chat, up to about two thirds of the screen
      wrap.style.setProperty('--tail', Math.max(22, Math.min(w - 22, cx - left)) + 'px');
    }
    let lastFocus = null, shut = 0;
    function open() {
      clearTimeout(shut); wrap.classList.remove('ipsy-closing');
      lastFocus = document.activeElement;
      place(); btn.style.visibility = 'hidden';
      wrap.hidden = false; document.documentElement.classList.add('locked');
      peek.live = true; mood(busy ? peek.mood : 'idle'); draw();
      setTimeout(() => { if (ls.get(K.ok, '')) input.focus(); }, 350);
    }
    function close() {
      if (wrap.hidden || wrap.classList.contains('ipsy-closing')) return;
      input.blur(); wrap.classList.add('ipsy-closing');
      const done = () => {
        wrap.hidden = true; wrap.classList.remove('ipsy-closing'); btn.style.visibility = '';
        peek.live = false; kick();
        if (![...document.querySelectorAll('.sheetwrap, .sheet-wrap')].some(w => !w.hidden)) document.documentElement.classList.remove('locked');   // an app's own sheet still open keeps the page dimmed
        if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
      };
      if (still()) done(); else shut = setTimeout(done, 220);
    }
    btn.addEventListener('click', open);
    wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !wrap.hidden) close(); });
    input.addEventListener('focus', () => { if (!busy) mood('listen'); });
    input.addEventListener('blur', () => { if (!busy) mood('idle'); });
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); } });
    $('ipsyForm').addEventListener('submit', e => { e.preventDefault(); submit(); });
    $('ipsyNew').addEventListener('click', () => { if (busy || asks.size) return; messages = []; view = []; undos = new Map(); persist(); draw(); input.focus(); });
    // The keyboard, a turned phone: Ipsy and its bubble move up above the keyboard, and fit the screen.
    const refit = () => { if (!wrap.hidden) place(); };
    if (vv) { vv.addEventListener('resize', refit); vv.addEventListener('scroll', refit); }
    window.addEventListener('resize', refit);

    // What's in the chat, drawn from `view` (what the person saw), not from the raw messages.
    function draw() {
      const ok = !!ls.get(K.ok, '');
      let h = '';
      if (!view.length) {
        h = '<div class="ipsy-empty"><p>' + esc(o.intro || 'Hi! Ask me anything.') + '</p>'
          + (ok ? '<div class="ipsy-chips">' + (o.suggestions || []).map(s => '<button class="ipsy-chip" type="button" data-ask="' + esc(s) + '">' + esc(s) + '</button>').join('') + '</div>'
            : '<div class="ipsy-consent"><p>' + esc(o.consent || '') + '</p><button class="ipsy-chip" type="button" id="ipsyOk">OK, let’s go</button></div>') + '</div>';
      }
      h += view.map(item).join('');
      log.innerHTML = h;
      input.disabled = !ok; sendBtn.disabled = !ok || busy;
      log.scrollTop = log.scrollHeight;
    }
    function item(v, i) {
      if (v.t === 'me') return '<div class="ipsy-msg ipsy-me">' + esc(v.text) + '</div>';
      if (v.t === 'it') return '<div class="ipsy-msg ipsy-it">' + rich(v.text) + (v.src && v.src.length ? '<div class="ipsy-src">' + v.src.map(s => '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title || s.url) + '</a>').join('') + '</div>' : '') + '</div>';
      if (v.t === 'act') return '<div class="ipsy-act">' + esc(v.text) + '</div>';
      if (v.t === 'change') return '<div class="ipsy-change' + (v.undone ? ' undone' : '') + '"><span>' + esc(v.text) + '</span>' + (!v.undone && undos.has(v.id) ? '<button class="ipsy-undo" type="button" data-undo="' + esc(v.id) + '">Undo</button>' : '') + '</div>';
      if (v.t === 'err') return '<div class="ipsy-err" role="alert">' + esc(v.text) + '</div>';
      if (v.t === 'ask') return '<div class="ipsy-ask" role="group" aria-label="Ipsy is asking first"><span>' + rich(v.text) + '</span>'
        + (v.state === 'yes' ? '<small>You said yes.</small>' : v.state === 'no' ? '<small>You said no, so nothing changed.</small>'
          : asks.has(v.id) ? '<div class="ipsy-ans"><button type="button" data-ans="yes" data-q="' + esc(v.id) + '">' + esc(v.yes) + '</button><button type="button" data-ans="no" data-q="' + esc(v.id) + '">' + esc(v.no) + '</button></div>'
          : '<small>Not answered, so nothing changed.</small>') + '</div>';
      return '';
    }
    log.addEventListener('click', e => {
      const ans = e.target.closest('[data-ans]');
      if (ans) {
        const id = ans.dataset.q, done = asks.get(id), v = view.find(x => x.id === id);
        if (!done || !v) return;
        asks.delete(id); v.state = ans.dataset.ans; persist(); draw(); done(v.state === 'yes'); return;
      }
      const ask = e.target.closest('[data-ask]'); if (ask) { input.value = ask.dataset.ask; submit(); return; }
      if (e.target.closest('#ipsyOk')) { ls.set(K.ok, '1'); draw(); input.focus(); return; }
      const u = e.target.closest('[data-undo]');
      if (u) {
        const fn = undos.get(u.dataset.undo), v = view.find(x => x.id === u.dataset.undo);
        if (!fn || !v) return;
        try { fn(); v.undone = true; undos.delete(v.id); add({ t: 'act', text: 'Undone: ' + v.text }); }
        catch (err) { add({ t: 'err', text: 'Couldn’t undo that: ' + (err && err.message || err) }); }
        persist(); draw();
      }
    });
    function add(v) { view.push(v); if (!wrap.hidden) { log.insertAdjacentHTML('beforeend', item(v)); log.scrollTop = log.scrollHeight; } }
    function persist() {
      // A chat too big to keep is kept on screen only (the phone's storage is shared by every app).
      const s = JSON.stringify({ messages, view: view.map(v => v.t === 'change' ? { ...v } : v) });
      if (s.length > 1.5e6 || !ls.set(K.chat, s)) ls.del(K.chat);
    }

    // One step: the conversation to the app's route, Claude's answer back.
    async function step() {
      const body = JSON.stringify({ messages });
      if (body.length > MAX_CHAT) throw Object.assign(new Error('full'), { code: 'full' });
      const opts = { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(o.headers || {}) }, body };
      const acct = AOS.account;
      let r;
      try { r = acct ? await acct.fetch(o.endpoint, opts) : await fetch(o.endpoint, opts); }
      catch { throw Object.assign(new Error('offline'), { code: 'offline' }); }
      let j = null; try { j = await r.json(); } catch {}
      if (!r.ok || !j) throw Object.assign(new Error((j && (j.why || j.error)) || 'http-' + r.status), { code: (j && j.error) || (r.status === 404 ? 'no-ai' : 'server'), why: j && j.why });
      return j;
    }
    // A tool that changes something the person should approve first (Calendar's events) asks here:
    // a card in the chat with exactly what will change, and Yes / No buttons. Nothing happens until a
    // button is tapped; the tool gets true for Yes, false for No.
    function confirm(text, opt = {}) {
      const id = 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      return new Promise(resolve => {
        asks.set(id, resolve);
        if (wrap.hidden) open();
        add({ t: 'ask', id, text: String(text), yes: opt.yes || 'Yes, do it', no: opt.no || 'No' });
        mood('listen'); say('Waiting for your answer…');
      }).then(ok => { mood('work'); say('Working…'); return ok; });
    }
    async function runTool(u) {
      const fn = o.tools && o.tools[u.name];
      if (!fn) return { type: 'tool_result', tool_use_id: u.id, is_error: true, content: 'No such tool here.' };
      try {
        const res = await fn(u.input || {}, { confirm }) || {};
        if (res.change && res.change.text) {
          const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          if (typeof res.change.undo === 'function') undos.set(id, res.change.undo);
          add({ t: 'change', id, text: res.change.text });
        }
        let text = typeof res.content === 'string' ? res.content : JSON.stringify(res.content == null ? { ok: true } : res.content);
        if (text.length > MAX_RESULT) text = text.slice(0, MAX_RESULT) + '\n[cut off here: ask for less at a time]';
        return { type: 'tool_result', tool_use_id: u.id, content: text, ...(res.error ? { is_error: true } : {}) };
      } catch (err) {
        return { type: 'tool_result', tool_use_id: u.id, is_error: true, content: String(err && err.message || err).slice(0, 500) };
      }
    }
    // Claude's words, with the web pages it cited.
    function words(content) {
      const text = content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
      const src = [], seen = new Set();
      content.forEach(b => (b.type === 'text' && Array.isArray(b.citations) ? b.citations : []).forEach(c => {
        if (c && c.url && /^https?:/.test(c.url) && !seen.has(c.url) && src.length < 4) { seen.add(c.url); src.push({ url: c.url, title: String(c.title || '').slice(0, 60) }); }
      }));
      return { text, src };
    }
    async function reveal(v) {
      // The answer appears a little at a time while Ipsy talks.
      // The chat keeps the whole answer from the start; only the bubble on screen fills in, and
      // if the chat is redrawn meanwhile (an Undo tapped, the chat closed) it simply shows it all.
      mood('talk');
      if (still() || wrap.hidden || v.text.length < 2) { add(v); return; }
      view.push(v);
      log.insertAdjacentHTML('beforeend', item({ ...v, text: '', src: [] }));
      const el = log.lastElementChild;
      for (let i = 0; i < v.text.length && el.isConnected; i += 3) {
        el.innerHTML = rich(v.text.slice(0, i + 3));
        log.scrollTop = log.scrollHeight;
        await new Promise(r => setTimeout(r, 12));
      }
      if (el.isConnected) { el.outerHTML = item(v); log.scrollTop = log.scrollHeight; }
    }
    const today = () => {
      const d = new Date(), p = n => String(n).padStart(2, '0');
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ' (' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ')';
    };
    const ACT_WEB = { web_search: i => 'Searching the web' + (i && i.query ? ': ' + i.query : ''), web_fetch: i => 'Reading ' + (i && i.url ? String(i.url).replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : 'a web page') };

    async function submit() {
      const text = input.value.trim();
      if (!text || busy || !ls.get(K.ok, '')) return;
      input.value = ''; input.style.height = '';
      busy = true; sendBtn.disabled = true;
      const mark = messages.length;          // where this question starts, to go back to if it fails
      let ctx = ''; try { ctx = o.context ? o.context() : ''; } catch {}
      messages.push({ role: 'user', content: [{ type: 'text', text: '[From the app: today is ' + today() + '.' + (ctx ? ' ' + ctx : '') + ']' }, { type: 'text', text }] });
      add({ t: 'me', text });
      let failed = null;
      try {
        for (let n = 0; ; n++) {
          if (n >= MAX_STEPS) throw Object.assign(new Error('steps'), { code: 'steps' });
          mood('think'); say('Thinking…');
          const res = await step();
          if (res.stop_reason === 'refusal') throw Object.assign(new Error('refused'), { code: 'refused' });
          const content = Array.isArray(res.content) ? res.content : [];
          if (!content.length) throw Object.assign(new Error('empty'), { code: 'server' });
          messages.push({ role: 'assistant', content });
          content.forEach(b => { if (b.type === 'server_tool_use' && ACT_WEB[b.name]) add({ t: 'act', text: ACT_WEB[b.name](b.input) }); });
          const w = words(content);
          const uses = content.filter(b => b.type === 'tool_use');
          if (w.text) await reveal({ t: 'it', text: w.text, src: w.src });
          if (res.stop_reason === 'pause_turn') continue;                    // Anthropic paused a long search: carry on
          if (res.stop_reason === 'tool_use' && uses.length) {
            mood('work');
            uses.forEach(u => { const l = o.label ? o.label(u.name, u.input || {}) : ''; if (l) add({ t: 'act', text: l }); });
            say('Working…');
            const results = [];
            for (const u of uses) results.push(await runTool(u));          // one at a time: they share the app's data
            messages.push({ role: 'user', content: results });
            persist();
            continue;
          }
          if (res.stop_reason === 'max_tokens' && !w.text) throw Object.assign(new Error('server'), { code: 'server' });
          break;
        }
      } catch (e) {
        failed = e;
        if (!e.code) console.warn('Ipsy:', e);         // a fault here, not an answer that said no
      }
      if (failed) {
        // Back to before the question: the changes its tools made stay (each with its Undo),
        // and the conversation stays one Claude can carry on from.
        messages.length = mark;
        const code = failed.code || 'server';
        add({ t: 'err', text: ERRORS[code] || ('Something went wrong' + (failed.why ? ': ' + failed.why : '') + '. Try again in a minute.') });
        if (code === 'full') { /* nothing more to say */ }
      }
      busy = false; persist(); mood(document.activeElement === input ? 'listen' : 'idle'); say(''); draw();
    }

    // ---- For the app: Ipsy doing things by itself (Orders and Travel check their "To check" items) ----
    let hintEl = null, hintTimer = 0;
    function hint(text, onTap, ms = 9000) {
      // A small speech bubble beside Ipsy's button, while the chat is closed; a tap opens the chat (or onTap).
      if (!wrap.hidden && !wrap.classList.contains('ipsy-closing')) return;   // the chat is open: it's said there
      if (hintEl) hintEl.remove();
      clearTimeout(hintTimer);
      const r = btn.getBoundingClientRect(); if (!r.width) return;   // (still laid out while the chat is open: only hidden)
      const el = hintEl = document.createElement('button');
      el.type = 'button'; el.className = 'ipsy-hint'; follow(el); el.textContent = text;
      el.style.left = (r.right - 4) + 'px'; el.style.bottom = (window.innerHeight - r.top - 6) + 'px';
      el.addEventListener('click', () => { gone(); (onTap || open)(); });
      document.body.appendChild(el);
      const gone = () => { if (el !== hintEl) return; hintEl = null; el.classList.add('out'); setTimeout(() => el.remove(), still() ? 0 : 200); };
      hintTimer = setTimeout(gone, ms);
      setMood(btnCell, 'talk'); setTimeout(() => { if (!busy) setMood(btnCell, 'idle'); }, 1400);
    }
    return {
      open, close, get busy() { return busy; },
      hint,
      ask: (text, opt) => confirm(text, opt).then(ok => { if (!busy) { mood(document.activeElement === input ? 'listen' : 'idle'); say(''); } return ok; }),
      // A line in the chat, or a change with its Undo, from work the app did with Ipsy outside a question.
      note: text => { add({ t: 'act', text }); persist(); },
      change: (text, undo) => {
        const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        if (typeof undo === 'function') undos.set(id, undo);
        add({ t: 'change', id, text }); persist();
      },
      // Ipsy at work in its corner (its button's mood) while the app does something for it.
      working: on => { if (!busy) setMood(btnCell, on ? 'work' : 'idle'); },
      // Open the chat and ask a question, as if typed (an app's "Ask Ipsy about this" button).
      prompt: text => { open(); if (busy || !ls.get(K.ok, '')) { input.value = text; return; } input.value = text; submit(); },
    };
  }

  // A character on its own, for a page that only shows Ipsy (aOS's Meet Ipsy card and page):
  //   const c = AllisonOS.ipsy.character(host, { look: 'vintage', mood: 'idle', form: 'heart', live: true })
  //   c.mood('think'); c.form('rbc'); c.look('glass')
  // form: stem, neuron, wbc, rbc, muscle or heart ('' follows the mood); live: a gentle wobble.
  function character(host, o = {}) {
    addStyle();
    host.classList.add('ipsy-host');
    const setLook = l => { host.classList.toggle('ipsy-vintage', l === 'vintage'); host.classList.toggle('ipsy-glass', l !== 'vintage'); };
    if (o.look) setLook(o.look); else follow(host);
    const c = addCell(host);
    c.live = !!o.live; c.form = FORMS[o.form] ? o.form : '';
    setMood(c, o.mood || 'idle');
    return {
      mood: m => setMood(c, m),
      form: f => { c.form = FORMS[f] ? f : ''; setMood(c, c.mood); },
      look: setLook,
      live: on => { c.live = !!on; kick(); },
    };
  }

  AOS.ipsy = { mount, character, forms: Object.keys(FORMS), look: LOOK };   // look(): 'vintage' | 'glass'
})();
