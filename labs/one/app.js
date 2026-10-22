// labs/one/index.html (its own file: the site's CSP header allows no inline scripts).
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
document.getElementById('where').textContent = standalone ? 'Opened from your Home Screen.' : 'Add this page to your Home Screen first (Share, Add to Home Screen), then open it from there.';
const $ = id => document.getElementById(id);
const get = () => { try { return JSON.parse(localStorage.getItem('lab.one') || 'null'); } catch { return null; } };
const paint = () => { const p = get(); $('setup').classList.toggle('hide', !!p); $('done').classList.toggle('hide', !p); if (p) $('hello').textContent = `Set up as ${p.name}`; };
$('save').onclick = () => { const name = $('name').value.trim(); if (!name) return $('name').focus(); try { localStorage.setItem('lab.one', JSON.stringify({ name, at: Date.now() })); } catch {} paint(); };
$('reset').onclick = () => { try { localStorage.removeItem('lab.one'); } catch {} paint(); };
paint();
