// sw.js - Service Worker with Firebase Messaging (ES Module)
const VERSION = '1.0.4';
const CACHE_NAME = `bake-and-grill-${VERSION}`;
const API_CACHE_NAME = `${CACHE_NAME}-api`;
const OFFLINE_URL = 'offline.html';
const CACHE_TIMEOUT = 5000;

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

// Import Firebase as ES modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js';
import { getMessaging } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js';

const firebaseApp = initializeApp({
  apiKey: "AIzaSyBuBmCQvvNVFsH2x6XGrHXrgZyULB1_qH8",
  authDomain: "bakeandgrill-44c25.firebaseapp.com",
  projectId: "bakeandgrill-44c25",
  storageBucket: "bakeandgrill-44c25.appspot.com",
  messagingSenderId: "713279633359",
  appId: "1:713279633359:web:ba6bcd411b1b6be7b904ba",
  measurementId: "G-SLG2R88J72"
});

const messaging = getMessaging(firebaseApp);
const displayedNotifications = new Set();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Received background message:', payload);
  handlePushNotification(payload);
});

// Install event - cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('ServiceWorker: Caching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('ServiceWorker: Installation failed:', error);
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME, API_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (!cacheWhitelist.includes(name)) {
            console.log('ServiceWorker: Deleting old cache', name);
            return caches.delete(name);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch event handler
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // API requests
  if (event.request.url.includes('/api/')) {
    event.respondWith(networkFirstThenCache(event.request, API_CACHE_NAME));
    return;
  }

  // Static assets
  event.respondWith(cacheFirstThenNetwork(event.request));
});

// Cache strategies
async function cacheFirstThenNetwork(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) return cachedResponse;
    
    const networkResponse = await fetchWithTimeout(request);
    if (networkResponse?.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse || caches.match(OFFLINE_URL);
  } catch (error) {
    return caches.match(OFFLINE_URL);
  }
}

async function networkFirstThenCache(request, cacheName = API_CACHE_NAME) {
  try {
    const networkResponse = await fetchWithTimeout(request);
    if (networkResponse?.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    return cachedResponse || (request.url.includes('/api/') 
      ? new Response(JSON.stringify({ error: 'You are offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
      : caches.match(OFFLINE_URL));
  }
}

async function fetchWithTimeout(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CACHE_TIMEOUT);
  
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Notification handlers
function handlePushNotification(payload) {
  const notificationId = payload.data?.orderId 
    ? `${payload.data.orderId}-${payload.data.status || Date.now()}` 
    : `notification-${Date.now()}`;

  if (displayedNotifications.has(notificationId)) return;
  displayedNotifications.add(notificationId);
  if (displayedNotifications.size > 100) displayedNotifications.clear();

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

  return self.registration.showNotification(notificationTitle, notificationOptions)
    .catch((error) => console.error('Failed to show notification:', error));
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const matchingClient = windowClients.find((client) => client.url === targetUrl);
        return matchingClient ? matchingClient.focus() : clients.openWindow(targetUrl);
      })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    messaging.getToken()
      .then((newToken) => {
        console.log('Push subscription renewed:', newToken);
        return fetch('/api/update-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldToken: event.oldSubscription.endpoint,
            newToken: newToken
          })
        });
      })
      .catch((error) => console.error('Error renewing push subscription:', error))
  );
});