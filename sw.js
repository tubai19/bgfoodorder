// customer-sw.js - Optimized for Customer App (Offline-First PWA)
const CUSTOMER_CACHE = 'customer-cache-v2';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/menu.json',
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
          if (![CUSTOMER_CACHE].includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - Cache-first with network fallback
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Network-first for API calls
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful API responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CUSTOMER_CACHE)
              .then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for assets
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        return cachedResponse || fetch(request)
          .then(response => {
            // Cache new assets
            if (response.ok && !request.url.includes('sockjs')) {
              const clone = response.clone();
              caches.open(CUSTOMER_CACHE)
                .then(cache => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => {
            // Fallback for pages
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/fallback.html');
            }
          });
      })
  );
});

// Push Notifications - Customer order updates
self.addEventListener('push', (event) => {
  const payload = event.data?.json() || {};
  const title = payload.title || 'Your Order Update';
  const options = {
    body: payload.body || 'Your order status has changed',
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/badge.png',
    data: payload.data || { url: '/orders' }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click - Open relevant order page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Focus existing order tab if open
      const orderClient = clientList.find(c => c.url.includes('/orders'));
      if (orderClient) {
        return orderClient.navigate(event.notification.data?.url)
               .then(client => client.focus());
      }
      // Otherwise open new order page
      return clients.openWindow(event.notification.data?.url || '/orders');
    })
  );
});