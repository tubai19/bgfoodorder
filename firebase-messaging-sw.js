// Import the Firebase SDKs
importScripts('https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.0/firebase-messaging-compat.js');

console.log('[Service Worker] Firebase Messaging SW started');

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBuBmCQvvNVFsH2x6XGrHXrgZyULB1_qH8",
  authDomain: "bakeandgrill-44c25.firebaseapp.com",
  projectId: "bakeandgrill-44c25",
  storageBucket: "bakeandgrill-44c25.appspot.com",
  messagingSenderId: "713279633359",
  appId: "1:713279633359:web:ba6bcd411b1b6be7b904ba",
  measurementId: "G-SLG2R88J72"
};

try {
  // Initialize Firebase
  const app = firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging(app);

  console.log('[Service Worker] Firebase initialized');

  // Background message handler
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Received background message', payload);
    
    // Customize notification
    const notificationTitle = payload.notification?.title || 'Order Update';
    const notificationOptions = {
      body: payload.notification?.body || 'Your order status has changed',
      icon: '/images/icons/icon-192x192.png',
      image: '/images/logo.png',
      data: payload.data,
      badge: '/images/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      actions: [
        {
          action: 'view_order',
          title: 'View Order'
        }
      ]
    };

    // Show notification
    return self.registration.showNotification(notificationTitle, notificationOptions);
  });

  console.log('[Service Worker] Background handler registered');

} catch (e) {
  console.error('[Service Worker] Initialization error:', e);
}

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  event.notification.close();
  
  const orderId = event.notification.data?.orderId;
  let url = '/';
  
  if (event.action === 'view_order' && orderId) {
    url = `/order-details.html?id=${orderId}`;
  } else if (orderId) {
    url = `/orders.html?highlight=${orderId}`;
  }

  // Focus/open the appropriate page
  event.waitUntil(
    clients.matchAll({type: 'window'}).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Notification close handler
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});