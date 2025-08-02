// admin-sw.js - Optimized for Admin Dashboard (Notification Focused)
const ADMIN_CACHE = 'admin-cache-v1';
const ADMIN_ASSETS = [
  '/admin.html',
  '/admin-styles.css',
  '/admin-script.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install - Cache essential admin assets with error handling
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ADMIN_CACHE)
      .then(cache => {
        return Promise.all(
          ADMIN_ASSETS.map(asset => {
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

// Activate - Clean old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== ADMIN_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Push Notifications - Robust handling for order updates
self.addEventListener('push', (event) => {
  const payload = event.data?.json() || {};
  const title = payload.title || 'Order Update';
  const options = {
    body: payload.body || 'Order status changed',
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/badge.png',
    data: payload.data || { url: '/admin/orders' }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click - Smart client handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Focus existing admin tab if open
      const adminClient = clientList.find(c => c.url.includes('/admin'));
      if (adminClient) {
        return adminClient.focus();
      }
      // Otherwise open new admin page
      return clients.openWindow(event.notification.data?.url || '/admin');
    })
  );
});

// Fetch - Network-first strategy for admin
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses for API calls
        if (event.request.url.includes('/api/') && response.ok) {
          const clone = response.clone();
          caches.open(ADMIN_CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});