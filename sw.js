// sw.js - Service Worker for Bake & Grill PWA

const CACHE_NAME = 'bake-and-grill-v3';
const OFFLINE_CACHE = 'offline-content-v2';
const RUNTIME_CACHE = 'runtime-cache-v2';
const OFFLINE_URL = 'offline.html';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/menu.html',
  '/checkout.html',
  '/offline.html',
  '/css/styles.css',
  '/js/main.js',
  '/js/menu.js',
  '/js/checkout.js',
  '/favicon.ico',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js'
];

// Install event - Cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('All resources cached');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('Cache installation failed:', err);
      })
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME, OFFLINE_CACHE, RUNTIME_CACHE];
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
    })
    .then(() => self.clients.claim())
  );
});

// Fetch event - Network first with cache fallback
self.addEventListener('fetch', event => {
  // Skip cross-origin requests and non-GET requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle API requests differently
  if (event.request.url.includes('/api/') || event.request.url.includes('firestore.googleapis.com')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Return empty response for failed API requests when offline
          return new Response(JSON.stringify({}), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // For HTML pages, try network first, then cache, then offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the page if it's successful
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE)
            .then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(response => response || caches.match(OFFLINE_URL));
        })
    );
    return;
  }

  // For other resources (CSS, JS, images), cache first with network fallback
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if found
        if (cachedResponse) {
          return cachedResponse;
        }

        // No cache match, fetch from network
        return fetch(event.request)
          .then(response => {
            // Don't cache opaque responses
            if (!response || response.status !== 200 || response.type === 'opaque') {
              return response;
            }

            // Cache the successful response
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE)
              .then(cache => cache.put(event.request, responseToCache));

            return response;
          })
          .catch(err => {
            console.error('Fetch failed; returning offline page:', err);
            // For images, return a placeholder if offline
            if (event.request.headers.get('accept').includes('image')) {
              return new Response(
                '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f5f5f5"/><text x="50%" y="50%" font-family="Arial" font-size="16" fill="#333" text-anchor="middle">Image not available offline</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
          });
      })
  );
});

// Background sync for failed requests
self.addEventListener('sync', event => {
  if (event.tag === 'sync-orders') {
    console.log('Background sync triggered');
    event.waitUntil(syncOrders());
  }
});

// Push notification event listener
self.addEventListener('push', event => {
  const data = event.data.json();
  const title = data.title || 'Bake & Grill';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const urlToOpen = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(windowClients => {
      // Check if there's already a window/tab open with the target URL
      const matchingClient = windowClients.find(client => 
        client.url === urlToOpen && 'focus' in client
      );

      if (matchingClient) {
        return matchingClient.focus();
      } else {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Function to sync orders when back online
function syncOrders() {
  return new Promise((resolve, reject) => {
    // Get all offline orders from IndexedDB
    const request = indexedDB.open('offlineOrders', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction('orders', 'readwrite');
      const store = transaction.objectStore('orders');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const orders = getAllRequest.result;
        if (orders.length === 0) {
          resolve('No offline orders to sync');
          return;
        }
        
        // Process each order
        const syncPromises = orders.map(order => {
          return fetch('https://bakeandgrill.com/api/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(order)
          })
          .then(response => {
            if (response.ok) {
              // Remove from IndexedDB if successful
              const deleteRequest = store.delete(order.timestamp);
              return new Promise(resolve => {
                deleteRequest.onsuccess = resolve;
              });
            }
            return Promise.reject('Failed to sync order');
          });
        });
        
        Promise.all(syncPromises)
          .then(() => {
            resolve(`${orders.length} orders synced successfully`);
          })
          .catch(error => {
            console.error('Error syncing orders:', error);
            reject('Some orders failed to sync');
          });
      };
      
      getAllRequest.onerror = () => {
        reject('Failed to retrieve offline orders');
      };
    };
    
    request.onerror = () => {
      reject('Failed to open IndexedDB');
    };
  });
}

// Function to handle periodic background sync
function handlePeriodicSync() {
  if ('periodicSync' in self.registration) {
    self.registration.periodicSync.register('update-content', {
      minInterval: 12 * 60 * 60 * 1000 // 12 hours
    }).then(() => {
      console.log('Periodic sync registered');
    }).catch(err => {
      console.error('Periodic sync registration failed:', err);
    });
  }
}

// Listen for message events from the page
self.addEventListener('message', event => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_NEW_RESOURCES') {
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(event.data.payload))
      .then(() => {
        event.source.postMessage({
          type: 'CACHE_COMPLETE',
          payload: event.data.payload
        });
      });
  }
});
