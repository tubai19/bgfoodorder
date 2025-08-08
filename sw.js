// sw.js - Combined PWA + Firebase Messaging
// Version: 1.0.0
const VERSION = '1.0.0';
const CACHE_NAME = `bake-and-grill-${VERSION}`;
const API_CACHE_NAME = `${CACHE_NAME}-api`;
const OFFLINE_URL = 'offline.html';

// Precached URLs for app shell
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
  '/images/android-chrome-192x192.png',
  '/images/android-chrome-512x512.png'
];

try {
  // Firebase imports (using latest compatible version)
  importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js');

  // Firebase configuration
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
  const displayedNotifications = new Set();

  // Install event - cache app shell
  self.addEventListener('install', event => {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => {
          console.log('ServiceWorker: Caching app shell');
          return cache.addAll(PRECACHE_URLS.map(url => 
            new Request(url, { 
              cache: 'reload', 
              credentials: 'same-origin' 
            })
          ).catch(error => {
            console.error('ServiceWorker: Cache addAll error:', error);
            return Promise.resolve();
          });
        })
        .then(() => {
          console.log('ServiceWorker: Skip waiting');
          return self.skipWaiting();
        })
    );
  });

  // Activate event - clean old caches
  self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME, API_CACHE_NAME];
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
      ).then(() => {
        console.log('ServiceWorker: Claiming clients');
        return self.clients.claim();
      })
    );
  });

  // Fetch event - network first with cache fallback
  self.addEventListener('fetch', event => {
    // Skip non-GET requests and cross-origin requests
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
      return;
    }

    // Handle navigation requests separately
    if (event.request.mode === 'navigate') {
      event.respondWith(
        fetch(event.request)
          .catch(() => caches.match(OFFLINE_URL))
      );
      return;
    }

    // API requests handling
    if (event.request.url.includes('/api/')) {
      event.respondWith(
        networkFirstThenCache(event.request, API_CACHE_NAME)
      );
      return;
    }

    // Static assets handling
    event.respondWith(
      cacheFirstThenNetwork(event.request)
    );
  });

  // Network first strategy for API calls
  async function networkFirstThenCache(request, cacheName) {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(cacheName);
        await cache.put(request, networkResponse.clone());
        return networkResponse;
      }
      throw new Error('Network response not OK');
    } catch (error) {
      const cachedResponse = await caches.match(request);
      return cachedResponse || Response.error();
    }
  }

  // Cache first strategy for static assets
  async function cacheFirstThenNetwork(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      // Special handling for images
      if (request.headers.get('accept').includes('image')) {
        return new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
          '<rect width="100" height="100" fill="#eee"/>' +
          '<text x="50" y="50" font-family="Arial" font-size="10" ' +
          'text-anchor="middle" fill="#aaa">Image not available offline</text>' +
          '</svg>', 
          { headers: { 'Content-Type': 'image/svg+xml' } }
        );
      }
      return Response.error();
    }
  }

  // Firebase Background Message Handling
  messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Received background message:', payload);

    // Create unique notification ID
    const notificationId = payload.data?.orderId 
      ? `${payload.data.orderId}-${payload.data.status || Date.now()}` 
      : `notification-${Date.now()}`;

    // Prevent duplicate notifications
    if (displayedNotifications.has(notificationId)) {
      console.log('Duplicate notification ignored');
      return;
    }
    displayedNotifications.add(notificationId);
    if (displayedNotifications.size > 100) displayedNotifications.clear();

    // Notification content with fallbacks
    const notificationTitle = payload.notification?.title || 
      payload.data?.title || 'Order Update';
    
    const notificationBody = payload.notification?.body || 
      payload.data?.body || 'Your order status has changed';

    const notificationOptions = {
      body: notificationBody,
      icon: '/images/android-chrome-192x192.png',
      badge: '/images/android-chrome-192x192.png',
      data: {
        url: payload.data?.url || '/',
        orderId: payload.data?.orderId,
        status: payload.data?.status,
        ...payload.data
      },
      tag: notificationId,
      vibrate: [200, 100, 200]
    };

    // Show notification
    return self.registration.showNotification(notificationTitle, notificationOptions)
      .catch(error => {
        console.error('Failed to show notification:', error);
      });
  });

  // Notification click handler
  self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    const targetUrl = event.notification.data?.url || '/';
    const promiseChain = clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(windowClients => {
      let matchingClient = null;

      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        if (windowClient.url === targetUrl) {
          matchingClient = windowClient;
          break;
        }
      }

      if (matchingClient) {
        return matchingClient.focus();
      } else {
        return clients.openWindow(targetUrl);
      }
    });

    event.waitUntil(promiseChain);
  });

  // Handle push subscription changes
  self.addEventListener('pushsubscriptionchange', event => {
    event.waitUntil(
      Promise.all([
        messaging.getToken(),
        registration.pushManager.subscribe(event.oldSubscription.options)
      ]).then(results => {
        const newToken = results[0];
        const newSubscription = results[1];
        // Send new token to server if needed
        console.log('Push subscription renewed:', newToken);
      })
    );
  });

} catch (error) {
  console.error('Service Worker initialization failed:', error);
}