// Offline shell for Home (the Home Assistant app). Network-first so a new deploy shows on the next
// open; the cache is only the fallback when offline. Home Assistant itself is
// a WebSocket on another origin, which a service worker never sees.
const CACHE = 'house-v52';
const SHELL = ['./', 'index.html', 'devices.css', 'devices.js', 'heaters.js', 'dysons.js', 'lights.js', 'media.js', 'security.js', 'around.js', 'energy.js', 'schedule.js', 'favorites.js', 'bg.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png', '../home/back.js', '../home/slide.js', '../home/welcome.js', '../weather/data.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('house-') && k !== CACHE).map(k => caches.delete(k))))
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
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
