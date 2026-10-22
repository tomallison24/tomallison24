// home/index.html: the old launcher icon's notice (its own file: the site's CSP header allows no inline scripts).
const u = new URL('../aOS/', location.href).href;
document.getElementById('addr').textContent = u;
const b = document.getElementById('copy');
b.onclick = async () => { try { await navigator.clipboard.writeText(u); b.textContent = 'Copied'; } catch { b.textContent = 'Press and hold the address to copy it'; } setTimeout(() => { b.textContent = 'Copy the address'; }, 2500); };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
