// sw.js - Unified Service Worker (PWA + FCM)

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

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

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message: ', payload);
  
  const notificationTitle = payload.notification?.title || 'New message from Bake & Grill';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new update',
    icon: payload.notification?.icon || '/icons/icon-192x192.png',
    data: payload.data || {}
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// PWA Caching Configuration
const CACHE_VERSION = 'v3';
const CACHE_NAME = `bake-grill-cache-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

const ASSETS = [
  '/',
  '/index.html',
  '/menu.html',
  '/checkout.html',
  '/css/styles.css',
  '/css/fontawesome.min.css',
  '/js/main.js',
  '/js/checkout.js',
  '/js/menu.js',
  '/js/idb.js',
  '/favicon.png',
  '/manifest.json',
  OFFLINE_URL
];

// Install event - Cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(
        keys.map((key) => 
          key !== CACHE_NAME ? caches.delete(key) : null
        )
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch event - Network first with cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Firebase-related requests
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('firebasestorage.googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseToCache));
        }
        return response;
      })
      .catch(() => {
        // Return cached version or offline page
        return caches.match(event.request)
          .then((response) => response || caches.match(OFFLINE_URL));
      })
  );
});

// Sync event - Handle background sync for failed orders
self.addEventListener('sync', (event) => {
  if (event.tag === 'submit-order') {
    event.waitUntil(retryFailedOrders());
  }
});

// Background sync handler
async function retryFailedOrders() {
  try {
    const db = await openDB('syncQueue', 1);
    const orders = await db.getAll('pendingOrders');
    
    for (const order of orders) {
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(order)
        });
        
        if (response.ok) {
          await db.delete('pendingOrders', order.id);
        }
      } catch (error) {
        console.error('Sync failed for order:', order.id, error);
      }
    }
  } catch (error) {
    console.error('Error accessing sync queue:', error);
  }
}

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Focus on existing tab if already open
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

// Helper function for IndexedDB
function openDB(name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    
    request.onerror = (event) => {
      reject('Database error: ' + event.target.errorCode);
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingOrders')) {
        db.createObjectStore('pendingOrders', { keyPath: 'id' });
      }
    };
  });
}