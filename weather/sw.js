// Offline shell for the Weather app. Pages load network-first so a new
// deploy shows up on the next open; the cache is the fallback when offline.
// Forecast requests are never cached here - the page keeps the last one in
// localStorage and labels it with its time.
const CACHE = 'weather-v68';
// slide.js is Home's, shared by every app (the switches' sliding thumb); design.js too (Vintage or
// Standard). Not sky.js: Weather draws its own Vintage sky, from the forecast. The glass icons carry
// the page's own ?v=, which design.js keeps when it swaps the icon.
const SHELL = ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'icon-180.png?v=6', 'icon-512.png?v=6', 'icon-glass-180.png?v=6', 'icon-glass-512.png?v=6', '../home/slide.js', '../home/settings.js', '../home/account.js', '../home/welcome.js', 'data.js', '../home/design.js', '../home/names.js', 'ipsy-tools.js'];

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
  // never /…/api/: account answers (who you are, the family) aren't kept on the phone
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
