/* Service Worker DJASSA - Cache PWA hors-ligne & Notifications push sécurisées */

const CACHE_NAME = 'djassa-shell-v1';
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
  '/djassa-icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return;

  // Network-first for HTML navigations so latest bundle is served when online, falling back to cache offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put('/', clone)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Cache-first for static assets under /assets/ and root icons
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => undefined);
          }
          return res;
        });
      })
    );
  }
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'DJASSA Admin • Alerte système',
    body: 'Un nouvel événement requiert votre attention dans le Centre de Notifications.',
    priority: 'information',
    category: 'securite',
    notificationId: ''
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        title: typeof parsed.title === 'string' ? parsed.title : payload.title,
        body: typeof parsed.body === 'string' ? parsed.body : payload.body,
        priority: typeof parsed.priority === 'string' ? parsed.priority : payload.priority,
        category: typeof parsed.category === 'string' ? parsed.category : payload.category,
        notificationId: typeof parsed.notificationId === 'string' ? parsed.notificationId : ''
      };
    } catch {
      // keep safe default payload
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.notificationId || `djassa-${payload.category}`,
      renotify: payload.priority === 'critique',
      requireInteraction: payload.priority === 'critique',
      data: {
        notificationId: payload.notificationId,
        url: '/'
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'djassa:open-notification',
            notificationId: event.notification.data && event.notification.data.notificationId
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
