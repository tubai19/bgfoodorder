// sw.js
const CACHE_NAME = 'bake-and-grill-v4';
const OFFLINE_URL = 'offline.html';
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
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseToCache));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background push notifications with proper JSON parsing
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data?.json();
  } catch (e) {
    // Fallback for non-JSON payload
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
      data
    })
  );
});