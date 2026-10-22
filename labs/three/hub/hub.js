// labs/three/hub/index.html (its own file: the site's CSP header allows no inline scripts).
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
document.getElementById('where').textContent = standalone ? 'Opened from your Home Screen.' : 'Add this page to your Home Screen first (Share, Add to Home Screen), then open it from there.';
const KEY = 'lab.three.log', $ = id => document.getElementById(id);
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const log = line => { const l = read(); l.unshift(new Date().toLocaleTimeString() + '  ' + line); try { localStorage.setItem(KEY, JSON.stringify(l.slice(0, 30))); } catch {} paint(); };
const paint = () => { $('log').textContent = read().join('\n') || 'Nothing yet.'; };
$('clear').onclick = () => { try { localStorage.removeItem(KEY); } catch {} paint(); };

let win = null, which = '';
document.querySelectorAll('[data-open]').forEach(a => a.onclick = e => {
  e.preventDefault(); which = a.dataset.open;
  win = window.open('../app/?m=' + which, '_blank');
  log(`${which.toUpperCase()}: opened, ${win ? 'got a handle' : 'no handle (null)'}`);
});
// B: coming back, close what was opened
const back = why => {
  if (document.visibilityState !== 'visible') return;
  if (!win) return log(`back (${why}), nothing open from here`);
  let before = '?', after = '?';
  try { before = win.closed; } catch (e) { before = 'error'; }
  if (which === 'b') { try { win.close(); } catch (e) { log('B: close() threw ' + e.name); } }
  setTimeout(() => { try { after = win.closed; } catch (e) { after = 'error'; } log(`${which.toUpperCase()}: back (${why}), closed before ${before}, after ${after}`); if (after === true) win = null; }, 300);
};
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' ? log('left (hidden)') : back('visible'));
addEventListener('pageshow', e => { if (e.persisted) back('pageshow'); });
addEventListener('focus', () => back('focus'));
log(`started, ${standalone ? 'Home Screen' : 'browser'}`);
