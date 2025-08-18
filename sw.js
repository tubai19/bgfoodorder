const CACHE_NAME = 'bake-and-grill-v5';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/menu.html',
  '/checkout.html',
  '/order-status.html',
  '/css/styles.css',
  '/js/main.js',
  '/js/menu.js',
  '/js/checkout.js',
  '/js/shared.js',
  '/menu.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/firebase-messaging-sw.js',
  OFFLINE_URL
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('Cache addAll error:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Skip non-http requests (like chrome-extension://)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if found
        if (cachedResponse) {
          return cachedResponse;
        }

        // For navigation requests, return offline page if fetch fails
        if (event.request.mode === 'navigate') {
          return fetch(event.request)
            .catch(() => caches.match(OFFLINE_URL));
        }

        // For all other requests, try network first
        return fetch(event.request)
          .then(response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response for caching
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache))
              .catch(err => console.error('Cache put error:', err));

            return response;
          })
          .catch(() => {
            // If fetch fails and this is an image request, return a placeholder
            if (event.request.headers.get('Accept').includes('image')) {
              return new Response(
                '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#eee"/><text x="50" y="50" font-family="Arial" font-size="10" text-anchor="middle" fill="#aaa">Image not available offline</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            return caches.match(OFFLINE_URL);
          });
      })
  );
});

self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data?.json();
  } catch (e) {
    payload = {
      notification: {
        title: 'New Update',
        body: event.data?.text() || 'You have a new notification'
      }
    };
  }

  const title = payload.notification?.title || 'New Update';
  const body = payload.notification?.body || 'You have a new notification';
  const data = payload.data || {};

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge.png',
      data
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});