// Offline shell for the Weather app. Pages load network-first so a new
// deploy shows up on the next open; the cache is the fallback when offline.
// Forecast requests are never cached here - the page keeps the last one in
// localStorage and labels it with its time.
const CACHE = 'weather-v16';
// slide.js is Home's, shared by every app (the switches' sliding thumb).
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png?v=3', 'icon-512.png?v=3', '../home/slide.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('weather-') && k !== CACHE).map(k => caches.delete(k))))
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
