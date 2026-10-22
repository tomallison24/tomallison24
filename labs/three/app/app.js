// labs/three/app/index.html (its own file: the site's CSP header allows no inline scripts).
const m = new URLSearchParams(location.search).get('m') || '?', $ = id => document.getElementById(id);
$('m').textContent = m.toUpperCase();
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
$('how').textContent = `Opened ${window.opener ? 'by a script (it has an opener)' : 'with no opener'}, ${history.length} page(s) in this window's history, ${standalone ? 'calls itself standalone' : 'not standalone'}.`;
const note = t => { $('log').textContent += t + '\n'; };
$('close').onclick = () => { window.close(); setTimeout(() => note('Close tapped: still here (window.close() did nothing).'), 400); };
// A, C and D: close itself on the way out
if (m !== 'b') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') window.close(); else note('Back again: closing on the way out did nothing.'); });
