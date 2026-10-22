// Offline shell for aOS. Same-origin requests load network-first, so a new
// deploy shows on the next open; the cache is only the fallback offline.
const CACHE = 'aos-v38';
const SHELL = ['./', 'index.html', 'app.js', 'home-tab.js', 'look.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png', '../home/sky.js', '../home/welcome.js', '../home/account.js', '../home/ipsy.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('aos-') && k !== CACHE).map(k => caches.delete(k))))
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

// Notifications from the owner (server/push.js): the push is encrypted for this
// phone and carries { title, body, url, tag }. A push must always show something.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'AllisonOS', {
    body: d.body || '', icon: 'icon-180.png', tag: d.tag || undefined, data: { url: d.url || './' },
  }));
});

// A tap opens aOS (or the page named), reusing a window that is already open.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  let to = new URL('./', self.registration.scope);
  try { const u = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope); if (u.origin === to.origin) to = u; } catch {}
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.split('#')[0] === to.href.split('#')[0] && 'focus' in c);
    if (!open) return self.clients.openWindow(to.href);   // the page reads the #hash it opens with
    if (to.hash) open.postMessage({ aosGo: to.hash });      // an open aOS goes there too
    return open.focus();
  }));
});
