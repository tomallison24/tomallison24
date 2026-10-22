// labs/one/notes/index.html (its own file: the site's CSP header allows no inline scripts).
let p = null; try { p = JSON.parse(localStorage.getItem('lab.one') || 'null'); } catch {}
document.getElementById('who').innerHTML = p ? '<span class="ok">Ready for ' + p.name.replace(/[<&>"]/g, '') + '</span>' : 'Not set up yet';
document.getElementById('what').textContent = p ? 'No sign-in, no set-up: this app read the hub\'s storage.' : 'Go back to aOS and set up once.';
