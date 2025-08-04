// Service Worker for Bake & Grill PWA
const CACHE_NAME = 'bake-and-grill-v4';
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
  '/images/android-chrome-192x192.png',
  '/images/android-chrome-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

// Install event - precache static assets with error handling
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('ServiceWorker: Caching app shell');
        return cache.addAll(PRECACHE_URLS.map(url => new Request(url, { cache: 'reload', credentials: 'same-origin' })))
          .catch(error => {
            console.log('ServiceWorker: Cache addAll error:', error);
            // Even if some files fail to cache, we still want the SW to install
            return Promise.resolve();
          });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('ServiceWorker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache or network with fallback
self.addEventListener('fetch', event => {
  // Skip non-GET requests and cross-origin requests (except for CDN resources we use)
  const isCoreCdnRequest = [
    'cdnjs.cloudflare.com',
    'unpkg.com'
  ].some(domain => event.request.url.includes(domain));
  
  if (event.request.method !== 'GET' || 
      (!event.request.url.startsWith(self.location.origin) && !isCoreCdnRequest)) {
    return;
  }

  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // For all other requests
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found
        if (response) {
          return response;
        }
        
        // Otherwise fetch from network
        return fetch(event.request).then(response => {
          // Don't cache non-200 responses or opaque responses
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          
          // Clone the response for caching
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseToCache));
          
          return response;
        }).catch(error => {
          console.log('Fetch failed; returning offline page:', error);
          // If the request is for an image, return a placeholder
          if (event.request.headers.get('accept').includes('image')) {
            return new Response(
              '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">' +
              '<rect width="100" height="100" fill="#eee"/>' +
              '<text x="50" y="50" font-family="Arial" font-size="10" text-anchor="middle" fill="#aaa">Image not available offline</text>' +
              '</svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
          
          // For HTML requests, return offline page
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match(OFFLINE_URL);
          }
          
          return new Response('Network error', { status: 408, statusText: 'Offline' });
        });
      })
  );
});

// Push notification event listener
self.addEventListener('push', event => {
  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'Bake & Grill', body: 'You have a new notification' };
  }
  
  const title = data.title || 'Bake & Grill';
  const options = {
    body: data.body,
    icon: '/images/android-chrome-192x192.png',
    badge: '/images/android-chrome-192x192.png',
    vibrate: [200, 100, 200],
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
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow(event.notification.data.url);
    })
  );
});