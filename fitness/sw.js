// Offline shell for the Fitness app. Same-origin files load network-first, so
// a new deploy shows up on the next open and the cache is only the fallback.
// The log itself never passes through here: it lives in this phone's storage.
const CACHE = 'fitness-v13';
const SHELL = ['./', 'index.html', 'app.js', 'analysis.js', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-512.png', '../home/slide.js', '../home/welcome.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('fitness-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// cache: 'no-cache' asks the server every time (see mail/sw.js for why).
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(
    fetch(new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }))
      .then(res => res.redirected && e.request.mode === 'navigate' ? Response.redirect(res.url, 302) : res)
      .then(res => {
        if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: url.pathname.endsWith('/') || url.pathname.endsWith('index.html') })
        .then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
