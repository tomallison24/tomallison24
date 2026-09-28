// Offline shell for the Home app. Everything same-origin loads network-first
// so a new deploy shows up on the next open; the cache is only the fallback
// when offline. The other apps' icons are same-origin too, so they are kept
// the same way. Open-Meteo is cross-origin and left to the page, which keeps
// its own last reading in localStorage.
const CACHE = 'home-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('home-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // The page adds ?t= to the News data URL to dodge HTTP caches; store it
  // under one key so the offline copy is always the latest.
  const key = /\/data\/news\.json$/.test(url.pathname) ? url.pathname : e.request;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
        return res;
      })
      .catch(() => caches.match(key).then(r => r || caches.match('index.html')))
  );
});
