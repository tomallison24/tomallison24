// Offline shell for the News app. Everything same-origin loads network-first
// so a new deploy (and fresh headlines) show up on the next open; the cache
// is only the fallback when offline. Story images come from the publishers
// and are left to the browser's own cache.
const CACHE = 'news-v33';
const SHELL = ['./', 'index.html', 'sport-catalog.json', 'leagues.json', 'manifest.webmanifest?v=3', 'icon.svg?v=3', 'icon-180.png?v=3', 'icon-512.png?v=3', '../home/slide.js', '../home/welcome.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('news-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // The page adds ?t= to the data URL to dodge HTTP caches; store it under
  // one key so the offline copy is always the latest.
  const key = /\/data\/(news|scores)\.json$/.test(url.pathname) ? url.pathname : e.request;
  // no-cache: always check with the server (GitHub Pages lets browsers reuse
  // files for 10 minutes), so an update shows on the next open, not later.
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
        return res;
      })
      .catch(() => caches.match(key).then(r => r || caches.match('index.html')))
  );
});
