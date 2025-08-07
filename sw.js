// sw.js - Combined PWA + Firebase Messaging

// Firebase imports
importScripts('https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.0/firebase-messaging-compat.js');

// Firebase config
firebase.initializeApp({
  apiKey: "AIzaSyBuBmCQvvNVFsH2x6XGrHXrgZyULB1_qH8",
  authDomain: "bakeandgrill-44c25.firebaseapp.com",
  projectId: "bakeandgrill-44c25",
  storageBucket: "bakeandgrill-44c25.appspot.com",
  messagingSenderId: "713279633359",
  appId: "1:713279633359:web:ba6bcd411b1b6be7b904ba",
  measurementId: "G-SLG2R88J72"
});

const messaging = firebase.messaging();
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
  '/js/leaflet.js',
  '/js/Control.Geocoder.js',
  '/js/jspdf.umd.min.js',
  '/js/jspdf.plugin.autotable.min.js',
  '/css/fontawesome.min.css',
  '/css/leaflet.css',
  '/webfonts/fa-solid-900.woff2',
  '/webfonts/fa-brands-400.woff2',
  '/image/android-chrome-192x192.png',
  '/image/android-chrome-512x512.png'
];

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('ServiceWorker: Caching app shell');
        return cache.addAll(PRECACHE_URLS.map(url => new Request(url, { cache: 'reload', credentials: 'same-origin' })))
          .catch(error => {
            console.error('ServiceWorker: Cache addAll error:', error);
            return Promise.resolve();
          });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(name => {
          if (!cacheWhitelist.includes(name)) {
            console.log('ServiceWorker: Deleting old cache', name);
            return caches.delete(name);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request).then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            return networkResponse;
          }

          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          return networkResponse;
        }).catch(error => {
          if (event.request.headers.get('accept').includes('image')) {
            return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#eee"/><text x="50" y="50" font-family="Arial" font-size="10" text-anchor="middle" fill="#aaa">Image not available offline</text></svg>', {
              headers: { 'Content-Type': 'image/svg+xml' }
            });
          }

          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match(OFFLINE_URL);
          }

          return new Response('Network error', { status: 408, statusText: 'Offline' });
        });
      })
  );
});

// Firebase Background Notification Handling
const displayedNotifications = new Set();

messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Background message received:', payload);

  const notificationId = payload.data?.orderId + payload.data?.status;
  if (displayedNotifications.has(notificationId)) {
    console.log('Duplicate notification ignored');
    return;
  }
  displayedNotifications.add(notificationId);
  if (displayedNotifications.size > 100) displayedNotifications.clear();

  const title = payload.notification?.title || 'Order Update';
  const options = {
    body: payload.notification?.body || 'Your order status has changed',
    icon: '/images/android-chrome-192x192.png',
    badge: '/images/android-chrome-192x192.png',
    data: {
      url: payload.data?.url || '/checkout.html',
      orderId: payload.data?.orderId,
      status: payload.data?.status
    },
    tag: notificationId
  };

  self.registration.showNotification(title, options);
});

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow(targetUrl);
    })
  );
});
