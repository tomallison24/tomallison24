// The sliding glass thumb of AllisonOS's switches: tab bars, segmented
// choices, a week strip. The options stay clear, and one thumb under them
// glides to the chosen one, stretching on the way (further for a longer
// trip), as iOS 26's do; an icon it lands on gives a small bounce. Every app
// loads this file before its own script and calls
//
//   AllisonOS.slide(box, chosen, key, { group, target, jump })
//
// after it marks the chosen option (and again after any re-render):
//   box     the switch; the thumb is a `.slthumb` span made inside it
//   chosen  the chosen option, or null to hide the thumb (e.g. while searching)
//   key     names the switch, so a thumb drawn afresh by a re-render still
//           slides from where the last one stood, and one redrawn mid-slide
//           carries on from where it was
//   group   when it changes (a new week in a strip), the thumb jumps
//   target  (chosen) => the element the thumb should cover, if not `chosen`
//   jump    place without moving (after a resize)
//
// The look is each app's own CSS: `.slides` on the box, `.slthumb` for the
// thumb, and the chosen option drawn without its own background.
(() => {
  'use strict';
  const slid = {}, MS = 560;
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function slide(box, chosen, key, { group = '', target, jump } = {}) {
    if (!box || !box.offsetWidth) return;   // hidden: nothing to measure yet
    let th = box.querySelector(':scope > .slthumb');
    const fresh = !th || !th.style.width;
    if (!th) { th = document.createElement('span'); th.className = 'slthumb'; th.setAttribute('aria-hidden', 'true'); box.prepend(th); }
    box.classList.add('slides');
    th.classList.toggle('off', !chosen);
    if (!chosen) return;
    th.classList.toggle('today', chosen.classList.contains('today'));
    const el = target ? target(chosen) : chosen;
    let x = 0, y = 0;
    for (let e = el; e && e !== box; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
    const to = { x, y, w: el.offsetWidth, h: el.offsetHeight, group }, last = slid[key], now = performance.now();
    const kf = p => ({ transform: 'translate(' + p.x + 'px,' + p.y + 'px)', width: p.w + 'px', height: p.h + 'px' });
    let move = null;
    if (!jump && last && last.group === group) {
      const hops = Math.hypot(to.x - last.x, to.y - last.y) / Math.max(1, to.w);
      if (last.x !== to.x || last.y !== to.y) {
        const cs = getComputedStyle(th);   // mid-slide, this is where it is now
        move = { from: fresh ? kf(last) : { transform: cs.transform, width: cs.width, height: cs.height }, t0: now, hops };
      } else if (fresh && last.move && now - last.move.t0 < MS) move = last.move;
    }
    if (th.getAnimations) for (const a of th.getAnimations()) if (!(window.CSSTransition && a instanceof CSSTransition)) a.cancel();
    Object.assign(th.style, kf(to));
    slid[key] = Object.assign(to, { move });
    if (!move || !th.animate || calm()) return;
    const at = now - move.t0;
    const sx = 1 + Math.min(0.36, 0.1 + move.hops * 0.07), sy = 1 - Math.min(0.14, 0.04 + move.hops * 0.025);
    th.animate([move.from, kf(to)], { duration: MS, easing: 'cubic-bezier(.3,1.25,.45,1)' }).currentTime = at;
    th.animate([{ scale: '1 1' }, { scale: sx + ' ' + sy, offset: 0.35 }, { scale: '1 1' }], { duration: MS, easing: 'cubic-bezier(.3,.7,.4,1)' }).currentTime = at;
    const ic = chosen.querySelector('svg');
    if (ic && !at) ic.animate([{ scale: '1' }, { scale: '1.18', offset: 0.5 }, { scale: '1' }], { duration: 380, delay: 200, easing: 'ease-out' });
  }

  // What was last placed for a switch (the Calendar's week strip checks its group).
  slide.last = key => slid[key];
  window.AllisonOS = Object.assign(window.AllisonOS || {}, { slide });
})();
