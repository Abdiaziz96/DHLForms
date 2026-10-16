/*
 * Gatehouse service worker.
 *
 * Purpose is narrow and worth being honest about: survive a dead spot in the
 * yard. A driver at the far end of the site often has one bar of signal, and
 * losing a completed form because the page reloaded is not acceptable.
 *
 * It is deliberately NOT a background sync implementation. iOS Safari does not
 * support Background Sync, so there is no point pretending: queued submissions
 * drain when the app is open and online, which is what `SyncQueue` does.
 *
 * Caching strategy:
 *   - App shell and static assets: stale-while-revalidate.
 *   - Everything under /api: never cached. Records must be live or not at all.
 */

const CACHE = 'gatehouse-v1';
const SHELL = ['/', '/staff', '/visitor', '/safety', '/map'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
