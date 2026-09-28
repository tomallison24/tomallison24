// Swipe up from the bottom of an app to come back to the AllisonOS Home
// screen, as the iPhone's own swipe up returns to its home screen. Each app
// loads this file; it does nothing unless the app was opened from Home, which
// leaves a note in sessionStorage (kept for as long as this window lives), so
// an app opened from its own icon is unchanged.
//
// The gesture starts in the band just above the phone's own home indicator
// (the safe area plus 44px), where the apps keep padding rather than
// controls, and needs a clear upward move; anything sideways is left to the
// app. The phone's own swipe, from the very edge, still goes to the phone's
// home screen as before.
(() => {
  'use strict';
  let home = null;
  try { home = sessionStorage.getItem('allisonos.home'); } catch {}
  if (!home) return;

  // The safe area's height, read from CSS since script can't see env().
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;bottom:0;left:0;width:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden';
  document.documentElement.appendChild(probe);
  const band = () => probe.offsetHeight + 44;

  let start = null, going = false;

  function go() {
    if (going) return;
    going = true;
    const s = document.documentElement.style;
    s.transformOrigin = '50% 100%';
    s.transition = 'transform .18s ease-in, opacity .18s ease-in';
    s.transform = 'scale(.94)';
    s.opacity = '0';
    setTimeout(() => { location.href = home; }, 150);
  }

  addEventListener('touchstart', e => {
    const t = e.touches[0];
    start = (e.touches.length === 1 && t.clientY >= innerHeight - band())
      ? { x: t.clientX, y: t.clientY, on: false } : null;
  }, { passive: true });

  addEventListener('touchmove', e => {
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y;
    if (!start.on) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > -dy) { start = null; return; }   // sideways: the app's
      if (-dy < 12) return;
      start.on = true;
    }
    if (e.cancelable) e.preventDefault();                                     // ours now, not a scroll
    if (-dy > 90) { start = null; go(); }
  }, { passive: false });

  const end = () => { start = null; };
  addEventListener('touchend', end, { passive: true });
  addEventListener('touchcancel', end, { passive: true });

  // Coming back to the app (the phone's back gesture from Home): undo the fade.
  addEventListener('pageshow', () => {
    const s = document.documentElement.style;
    s.transform = ''; s.opacity = ''; s.transition = '';
    going = false;
  });
})();
