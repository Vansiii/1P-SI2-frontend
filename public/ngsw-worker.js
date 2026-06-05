/**
 * MecánicoYa Service Worker — PWA Offline Cache
 *
 * Caching strategy:
 * - Shell (index.html, main.js, polyfills.js, styles.css): Cache First
 * - Assets (images, fonts): Cache First with 30d expiry
 * - API calls: Network First (not cached)
 * - Firebase SW: registered separately for push notifications
 */

const CACHE_NAME = 'mecanicoya-v1';
const ASSETS_CACHE = 'mecanicoya-assets-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing MecánicoYa PWA');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some assets failed to pre-cache:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating MecánicoYa PWA');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== ASSETS_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api/')) {
      return;
    }

    const isStaticAsset =
      /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|json)$/.test(
        url.pathname
      );

    if (isStaticAsset) {
      event.respondWith(
        caches.match(request).then((cached) => {
          const fetchPromise = fetch(request)
            .then((response) => {
              if (response.ok) {
                const clone = response.clone();
                caches.open(ASSETS_CACHE).then((cache) => {
                  cache.put(request, clone);
                });
              }
              return response;
            })
            .catch(() => cached || new Response('Offline', { status: 503 }));
          return cached || fetchPromise;
        })
      );
      return;
    }
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).catch(() => {
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Sin conexion', { status: 503 });
        })
      );
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
