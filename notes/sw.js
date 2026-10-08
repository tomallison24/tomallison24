// Offline shell for the Notes app. Same-origin files load network-first so a
// new deploy shows up on the next open; the cache is only the fallback when
// offline. Notes themselves live in localStorage, never in this cache.
const CACHE = 'notes-v44';
const SHELL = ['./', 'index.html', 'manifest.webmanifest?v=4', 'icon.svg', 'icon-180.png?v=4', 'icon-512.png?v=4', '../home/slide.js', '../home/welcome.js', 'aisles.js', '../home/account.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('notes-') && k !== CACHE).map(k => caches.delete(k))))
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
      .catch(() => caches.match(e.request, {ignoreSearch: url.pathname.endsWith('/') || url.pathname.endsWith('index.html')})
        .then(r => r || caches.match('index.html')))
  );
});

// A reminder or nudge, pushed by the notification server (notes/push). iOS
// requires every push to show a notification, so one is always shown.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || 'Notes', {
    body: d.body || '', tag: d.tag || 'notes', icon: 'icon-180.png?v=4', data: { open: d.open || null },
  }).catch(() => {}));
});

// Tapping it opens that reminder or note: in the open app if there is one,
// otherwise by starting the app with ?open=.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const open = e.notification.data?.open || null;
  const url = new URL(open ? './?open=' + encodeURIComponent(open) : './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list[0];
    if (c) { if (open) c.postMessage({ open }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
