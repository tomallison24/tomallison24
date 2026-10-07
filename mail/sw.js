// Offline shell for the Mail app. Same-origin files load network-first, so a
// new deploy shows up on the next open and the cache is only the fallback.
// Gmail itself is cross-origin and never touched here: a cached mailbox would
// be both stale and a copy of private mail sitting in a cache.
const CACHE = 'mail-v22';
const SHELL = ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png', '../home/slide.js', '../home/welcome.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('mail-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// cache: 'no-cache' asks the server every time (a quick "not modified" when
// nothing changed). Without it the phone's HTTP cache could hand back the old
// page for up to ten minutes after a deploy, so a change seemed not to land.
// A navigation's own Request can't take new options, so a fresh one is made
// from its URL. If that was redirected (.../mail to .../mail/), the browser is
// sent on to the new address, so the page's relative links resolve from there.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }))
      .then(res => res.redirected && e.request.mode === 'navigate' ? Response.redirect(res.url, 302) : res)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      // offline: the saved copy; the app's page only stands in for a page,
      // never for a script (it would fail as "Unexpected token '<'")
      .catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});

// New mail, pushed by the notification server (mail/push). iOS requires every
// push to show a notification, so one is always shown.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  const jobs = [self.registration.showNotification(d.title || 'Mail', {
    body: d.body || 'New mail', tag: d.tag || 'mail', icon: 'icon-180.png', data: { thread: d.thread || null },
  })];
  const nav = self.navigator;
  if (typeof d.badge === 'number' && nav?.setAppBadge) jobs.push(d.badge ? nav.setAppBadge(d.badge) : nav.clearAppBadge());
  e.waitUntil(Promise.all(jobs).catch(() => {}));
});

// Tapping it opens that conversation: in the open app if there is one,
// otherwise by starting the app with ?thread=.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const thread = e.notification.data?.thread || null;
  const url = new URL(thread ? './?thread=' + encodeURIComponent(thread) : './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list[0];
    if (c) { if (thread) c.postMessage({ open: thread }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
