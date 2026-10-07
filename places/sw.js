// Offline shell for the Places app. Same-origin files load network-first so a
// new deploy shows up on the next open; the cache is only the fallback when
// offline. Your places live in localStorage, never in this cache, and search,
// place details and map tiles (other sites) are never cached here.
const CACHE = 'places-v15';
// slide.js and back.js are Home's, shared by every app.
const SHELL = ['./', 'index.html', 'app.js', 'parse.js', 'manifest.webmanifest?v=2', 'icon-180.png?v=2', 'icon-512.png?v=2', 'vendor/leaflet.js', 'vendor/leaflet.css', '../home/slide.js', '../home/welcome.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('places-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: url.pathname.endsWith('/') || url.pathname.endsWith('index.html') })
        .then(r => r || caches.match('index.html')))
  );
});
