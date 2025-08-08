// sw.js - Bake and Grill PWA with Firebase Messaging
// Version: 1.0.4 - Enhanced error handling and debugging
const VERSION = '1.0.4';
const CACHE_NAME = `bake-and-grill-${VERSION}`;
const OFFLINE_URL = '/offline.html';

// Precached URLs - Only essential files
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/css/styles.css',
  '/js/main.js',
  '/images/android-chrome-192x192.png'
];

// Firebase Configuration
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBuBmCQvvNVFsH2x6XGrHXrgZyULB1_qH8",
  authDomain: "bakeandgrill-44c25.firebaseapp.com",
  projectId: "bakeandgrill-44c25",
  storageBucket: "bakeandgrill-44c25.appspot.com",
  messagingSenderId: "713279633359",
  appId: "1:713279633359:web:ba6bcd411b1b6be7b904ba",
  measurementId: "G-SLG2R88J72"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

// Enhanced Background Message Handler
messaging.setBackgroundMessageHandler((payload) => {
  console.log('[Firebase] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'New Order';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new order!',
    icon: '/images/android-chrome-192x192.png',
    data: payload.data || {}
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Improved Install Event with Error Logging
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing version:', VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching essential files');
        return Promise.all(
          PRECACHE_URLS.map((url) => {
            return fetch(url, { cache: 'no-store' })
              .then((response) => {
                if (!response.ok) {
                  throw new Error(`Failed to fetch ${url}: ${response.status}`);
                }
                return cache.put(url, response);
              })
              .catch((error) => {
                console.warn(`[Service Worker] Failed to cache ${url}:`, error);
                // Skip failing files rather than failing entire install
              });
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting phase');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// Activate Event with Cache Cleanup
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating version:', VERSION);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch Event with Improved Offline Support
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Skip non-GET requests and chrome-extension URLs
  if (event.request.method !== 'GET' || requestUrl.protocol === 'chrome-extension:') {
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

  // Handle other requests
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if available
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise fetch from network
        return fetch(event.request)
          .then((response) => {
            // Cache successful responses
            if (response && response.ok) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(event.request, responseToCache))
                .catch((error) => {
                  console.warn('[Service Worker] Failed to cache response:', error);
                });
            }
            return response;
          })
          .catch((error) => {
            console.warn('[Service Worker] Network request failed:', error);
          });
      })
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received');
  event.notification.close();
  
  const urlToOpen = event.notification.data.url || '/admin';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
