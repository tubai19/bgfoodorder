// customer-sw.js - Optimized for Customer App (Offline-First PWA)
const CUSTOMER_CACHE = 'customer-cache-v2';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/fallback.html'
];

// Install - Cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CUSTOMER_CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CUSTOMER_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - Cache-first with network fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if available
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then(response => {
            // Cache new assets if valid
            if (response.ok) {
              const clone = response.clone();
              caches.open(CUSTOMER_CACHE).then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            // Fallback for pages
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/fallback.html');
            }
            return new Response('', { status: 404 });
          });
      })
  );
});

// Push Notifications
self.addEventListener('push', (event) => {
  const payload = event.data?.json() || {};
  const title = payload.title || 'Order Update';
  const options = {
    body: payload.body || 'Your order status has changed',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge.png',
    data: { url: '/orders' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/orders';
  
  event.waitUntil(
    clients.matchAll({type: 'window'})
      .then(clientList => {
        const orderClient = clientList.find(c => c.url.includes(urlToOpen));
        if (orderClient) {
          return orderClient.focus();
        }
        return clients.openWindow(urlToOpen);
      })
  );
});