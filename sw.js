const CACHE_NAME = 'bake-and-grill-v2';
const VAPID_PUBLIC_KEY = 'BKTsteSYE7yggmmbvQnPzDt0wFuHADZxcJpR8hu_bGOE8RpyBx4AamyQ2TIyItS6uvwZ79EzBp1rWOpuT4KHHDY';
const OFFLINE_URL = '/offline.html';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/menu.html',
  '/checkout.html',
  '/css/styles.css',
  '/js/main.js',
  '/js/menu.js',
  '/js/checkout.js',
  '/android-chrome-192x192.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/offline.html'
];

// Install event - caching assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE)
          .catch((error) => {
            console.error('Failed to cache some assets:', error);
          });
      })
  );
  // Force the waiting service worker to become active
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Claim clients to ensure the new service worker takes control immediately
  event.waitUntil(self.clients.claim());
});

// Fetch event - network first, then cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(OFFLINE_URL);
        })
    );
  } else {
    // For other requests, try cache first, then network
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          // Return cached response if found
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Otherwise fetch from network
          return fetch(event.request)
            .then((response) => {
              // Check if we received a valid response
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }

              // Clone the response to cache it
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });

              return response;
            });
        })
    );
  }
});

// Push Notification Handling
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'New Update',
      body: 'You have new updates from Bake & Grill!',
      url: '/'
    };
  }

  const options = {
    body: data.body || 'You have new updates from Bake & Grill!',
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Bake & Grill', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Focus or open the appropriate URL
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});

// Background Sync for failed orders and notifications
self.addEventListener('sync', (event) => {
  console.log('Background sync event:', event.tag);
  
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  } else if (event.tag === 'sync-notifications') {
    event.waitUntil(syncFailedNotifications());
  }
});

// Sync pending orders
async function syncOrders() {
  // Implement your order synchronization logic here
  // This might involve checking IndexedDB for pending orders
  // and trying to send them to the server again
  console.log('Syncing pending orders...');
  
  // Example:
  // const pendingOrders = await getPendingOrdersFromIDB();
  // for (const order of pendingOrders) {
  //   await retryOrderSubmission(order);
  // }
}

// Sync failed notifications
async function syncFailedNotifications() {
  console.log('Syncing failed notifications...');
  
  // Get all current notifications
  const notifications = await self.registration.getNotifications();
  
  // Process any pending notifications
  // You might want to store failed notifications in IndexedDB
  // and retry them here
  
  // Example:
  // const failedNotifications = await getFailedNotificationsFromIDB();
  // for (const notification of failedNotifications) {
  //   await self.registration.showNotification(notification.title, notification.options);
  // }
}