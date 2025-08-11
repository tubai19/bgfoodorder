const CACHE_VERSION = 'v4';
const CACHE_NAME = `bake-grill-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';
const CACHEABLE_ASSETS = [
  '/',
  '/index.html',
  '/menu.html',
  '/checkout.html',
  '/offline.html',
  '/css/styles.css',
  '/css/fontawesome.min.css',
  '/js/main.js',
  '/js/menu.js',
  '/js/checkout.js',
  '/js/idb.js',
  '/favicon.png',
  '/manifest.json'
];

// Install - Cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching core assets');
        return Promise.all(
          CACHEABLE_ASSETS.map(url => {
            return fetch(url)
              .then(response => {
                if (response.ok) return cache.put(url, response);
              })
              .catch(err => {
                console.error(`Failed to cache ${url}`, err);
              });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - Network first with cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET and external requests
  if (event.request.method !== 'GET' || 
      !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // API requests - Network only
  if (event.request.url.includes('/api/')) {
    return event.respondWith(fetch(event.request));
  }

  // Navigation requests - Network first with offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Static assets - Cache first with network fallback
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        return cachedResponse || fetch(event.request)
          .then(networkResponse => {
            // Cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => {
            // If both fail, show offline page for HTML requests
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'submit-order') {
    console.log('[SW] Background sync triggered for orders');
    event.waitUntil(retryFailedOrders());
  }
});

async function retryFailedOrders() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match('/api/pending-orders');
    if (!response) {
      console.log('[SW] No pending orders found');
      return;
    }

    const pendingOrders = await response.json();
    if (!pendingOrders || !pendingOrders.length) {
      console.log('[SW] No orders to sync');
      return;
    }

    const results = await Promise.allSettled(
      pendingOrders.map(order => {
        return fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order)
        }).then(result => {
          if (result.ok) {
            return { status: 'success', order };
          }
          return { status: 'failed', order };
        });
      })
    );

    // Filter out successfully synced orders
    const successfulOrders = results
      .filter(r => r.value?.status === 'success')
      .map(r => r.value.order);

    if (successfulOrders.length > 0) {
      console.log(`[SW] Successfully synced ${successfulOrders.length} orders`);
      
      // Update pending orders by removing successful ones
      const updatedPendingOrders = pendingOrders.filter(order => 
        !successfulOrders.some(so => so.id === order.id)
      );
      
      // Update pending orders cache
      await cache.put(
        '/api/pending-orders',
        new Response(JSON.stringify(updatedPendingOrders))
      );
    }
  } catch (err) {
    console.error('[SW] Sync error:', err);
  }
}

// Push Notifications
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data?.json();
  } catch (e) {
    payload = { notification: { title: 'Bake & Grill', body: 'You have a new update' } };
  }

  const title = payload.notification?.title || 'Bake & Grill';
  const options = {
    body: payload.notification?.body || 'You have a new update',
    icon: payload.notification?.icon || '/icons/icon-192x192.png',
    data: payload.data || {}
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Focus on existing tab if open
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new tab if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});