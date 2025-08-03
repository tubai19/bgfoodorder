// customer-sw.js - Optimized Service Worker for Customer App
const CUSTOMER_CACHE = 'customer-cache-v3';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/firebase-init.js',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/fallback.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

// Install - Cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CUSTOMER_CACHE)
      .then(cache => {
        console.log('Caching core assets');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('Service Worker installed');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('Cache addAll failed:', err);
      })
  );
}); .catch(err => {
        console.error('Cache addAll failed:', err);
      })
  );
});

// Activate - Clean old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CUSTOMER_CACHE];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch - Network first with cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and chrome-extension URLs
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Skip Firebase requests
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic.com')) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Try network first
        const networkResponse = await fetch(event.request);
        
        // If valid response, cache it
        if (networkResponse && networkResponse.status === 200) {
          const cache = await caches.open(CUSTOMER_CACHE);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        // Network failed, try cache
        console.log('Network failed, falling back to cache for:', event.request.url);
        const cachedResponse = await caches.match(event.request);
        
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Fallback for pages
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/fallback.html');
        }
        
        // Return empty response for images if not in cache
        if (event.request.headers.get('accept').includes('image')) {
          return new Response('<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"></svg>', {
            headers: { 'Content-Type': 'image/svg+xml' }
          });
        }
        
        return new Response('Offline', { 
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })()
  );
});

// Push Notifications
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data?.json() || {};
  } catch (e) {
    payload = {
      title: 'Order Update',
      body: event.data?.text() || 'Your order status has changed'
    };
  }

  const title = payload.title || 'Order Update';
  const options = {
    body: payload.body || 'Your order status has changed',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge.png',
    data: { 
      url: payload.url || '/',
      orderId: payload.orderId || null
    },
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  const orderId = event.notification.data?.orderId;
  const finalUrl = orderId ? `${urlToOpen}?orderId=${orderId}` : urlToOpen;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Check if there's already a window open
      const orderClient = clientList.find(c => 
        c.url.includes(urlToOpen) || c.url.includes('orderId=')
      );
      
      if (orderClient) {
        return orderClient.focus().then(() => {
          if (orderId && orderClient.url.includes('orderId=')) {
            return orderClient.postMessage({
              type: 'NAVIGATE_TO_ORDER',
              orderId: orderId
            });
          }
        });
      }
      
      // Otherwise open a new window
      return clients.openWindow(finalUrl);
    })
  );
});

// Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(
      (async () => {
        const cache = await caches.open('sync-orders');
        const requests = await cache.keys();
        
        return Promise.all(
          requests.map(async request => {
            try {
              const response = await fetch(request);
              if (response.ok) {
                await cache.delete(request);
                return response;
              }
            } catch (error) {
              console.error('Sync failed for:', request.url, error);
            }
          })
        );
      })()
    );
  }
});