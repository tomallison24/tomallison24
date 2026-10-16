// Offline shell for the News app. Everything same-origin loads network-first
// so a new deploy (and fresh headlines) show up on the next open; the cache
// is only the fallback when offline. Story images come from the publishers
// and are left to the browser's own cache. The same file runs at the old News
// Vintage address too (the deploy copies news/ there), so the sport lists are
// named from News' side, as app.js asks for them.
const CACHE = 'news-v55';
const SHELL = ['./', 'index.html', 'app.js', '../news/sport-catalog.json', '../news/leagues.json', 'manifest.webmanifest?v=3', 'icon.svg?v=4', 'icon-glass.svg?v=1', 'icon-180.png?v=5', 'icon-512.png?v=5', 'icon-glass-180.png?v=5', 'icon-glass-512.png?v=5', '../home/slide.js', '../home/account.js', '../home/welcome.js', '../home/design.js', '../home/sky.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  // newsvintage-: the old News Vintage app's, whose address now runs this same file
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => (k.startsWith('news-') || k.startsWith('newsvintage-')) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // never /…/api/: account answers (who you are, the family) aren't kept on the phone
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  // The page adds ?t= to the data URL to dodge HTTP caches; store it under
  // one key so the offline copy is always the latest.
  const key = /\/data\/(news|scores)\.json$/.test(url.pathname) ? url.pathname : e.request;
  // no-cache: always check with the server (GitHub Pages lets browsers reuse
  // files for 10 minutes), so an update shows on the next open, not later.
  e.respondWith(
    // A page load goes as itself (fetch(e.request)), so a redirect - Cloudflare Access
    // asking to sign in again - reaches the browser instead of failing to the old copy.
    (e.request.mode === 'navigate' ? fetch(e.request) : fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }))
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
        return res;
      })
      .catch(() => caches.match(key).then(r => r || caches.match('index.html')))
  );
});
