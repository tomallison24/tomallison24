// Offline shell for the Podcasts app. Same-origin files load network-first so
// a new deploy shows up on the next open; the cache is only the fallback when
// offline. Feeds (./api/) are never cached here: the app keeps each show's
// episodes itself. Episodes and artwork come from the podcasts' own servers
// and are left to the browser.
const CACHE = 'podcasts-v3';
const SHELL = ['./', 'index.html', 'manifest.webmanifest?v=1', 'icon.svg', 'icon-180.png?v=1', 'icon-512.png?v=1', '../home/slide.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('podcasts-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, {ignoreSearch: url.pathname.endsWith('/') || url.pathname.endsWith('index.html')})
        .then(r => r || caches.match('index.html')))
  );
});
