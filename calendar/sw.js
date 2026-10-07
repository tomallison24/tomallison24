// Offline shell for the Calendar app. Same-origin files load network-first, so
// a new deploy shows up on the next open and the cache is only the fallback.
// iCloud (through calendar/api/), Gmail and the weather are never cached here:
// a cached answer would be a stale calendar. The events themselves are kept by
// the app in localStorage for reading offline.
const CACHE = 'calendar-v18';
const SHELL = ['./', 'index.html', 'app.js', 'ical.js', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-512.png', '../home/slide.js', '../home/welcome.js', '../home/account.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('calendar-') && k !== CACHE).map(k => caches.delete(k))))
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
      .catch(() => caches.match(e.request, { ignoreSearch: url.pathname.endsWith('/') || url.pathname.endsWith('index.html') })
        .then(r => r || caches.match('index.html')))
  );
});
