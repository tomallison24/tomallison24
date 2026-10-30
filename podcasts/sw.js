// Offline shell for the Podcasts app. Same-origin files load network-first so
// a new deploy shows up on the next open; the cache is only the fallback when
// offline. Feeds (../podcasts/api/) are never cached here: the app keeps each show's
// episodes itself. Episodes and artwork come from the podcasts' own servers
// and are left to the browser.
const CACHE = 'podcasts-v37';
const SHELL = ['./', 'index.html', 'app.js?v=podcasts-v37', 'manifest.webmanifest?v=1', 'icon.svg?v=2', 'icon-glass.svg?v=1', 'icon-180.png?v=4', 'icon-512.png?v=4', 'icon-glass-180.png?v=4', 'icon-glass-512.png?v=4', '../home/slide.js', '../home/settings.js', '../home/account.js', '../home/sheet.js', '../home/welcome.js', '../home/design.js', '../home/sky.js', '../home/names.js'];

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
  // The script of a release (app.js?v=, as its page names it) from this copy first: a page and its script always
  // come as a pair, even when the page is the offline copy (app.js's PAGE says why).
  if (url.pathname.endsWith('/app.js') && url.searchParams.get('v') === CACHE) {
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; }))));
    return;
  }
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
