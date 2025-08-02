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

// Install - Cache core assets with error handling
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CUSTOMER_CACHE)
      .then(cache => {
        return Promise.all(
          CORE_ASSETS.map(asset => {
            return cache.add(asset).catch(err => {
              console.log(`Failed to cache ${asset}:`, err);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
      .catch(err => {
        console.log('Service worker installation failed:', err);
      })
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
  
  // Skip non-GET requests and unsupported schemes
  if (request.method !== 'GET' || 
      request.url.startsWith('chrome-extension://') || 
      request.url.includes('extension') || 
      !(request.url.startsWith('http') || request.url.startsWith('https'))) {
    return;
  }
  
  // Network-first for API calls
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Only cache successful API responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CUSTOMER_CACHE)
              .then(cache => cache.put(request, clone))
              .catch(err => console.log('Failed to cache API response:', err));
          }
          return response;
        })
        .catch(() => {
          // Return cached response if available
          return caches.match(request).then(response => {
            return response || new Response('{"error":"Network unavailable"}', {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Cache-first for assets
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        // Return cached response if available
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise fetch from network
        return fetch(request)
          .then(response => {
            // Cache new assets if valid
            if (response.ok && !request.url.includes('sockjs')) {
              const clone = response.clone();
              caches.open(CUSTOMER_CACHE)
                .then(cache => cache.put(request, clone))
                .catch(err => console.log('Failed to cache asset:', err));
            }
            return response;
          })
          .catch(() => {
            // Fallback for pages
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/fallback.html');
            }
            // Return empty response for other failed requests
            return new Response('', { status: 404, statusText: 'Not Found' });
          });
      })
  );
});

// Push Notifications - Customer order updates
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data?.json() || {};
  } catch (e) {
    payload = {};
  }
  
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
  const urlToOpen = event.notification.data?.url || '/orders';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Focus existing order tab if open
      const orderClient = clientList.find(c => c.url.includes(urlToOpen));
      if (orderClient) {
        return orderClient.navigate(urlToOpen)
               .then(client => client.focus());
      }
      // Otherwise open new order page
      return clients.openWindow(urlToOpen);
    })
  );
});

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    console.log('Background sync for orders');
    // Implement your background sync logic here
  }
});

// Periodic sync for updates
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-cache') {
    console.log('Periodic sync for cache updates');
    // Implement your periodic update logic here
  }
});