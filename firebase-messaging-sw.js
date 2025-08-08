// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js');

// Initialize Firebase
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

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message', payload);
  
  // Create unique notification ID to prevent duplicates
  const notificationId = payload.data?.orderId 
    ? `${payload.data.orderId}-${payload.data.status || Date.now()}`
    : `notification-${Date.now()}`;

  if (displayedNotifications.has(notificationId)) {
    console.log('Duplicate notification ignored');
    return;
  }
  displayedNotifications.add(notificationId);
  if (displayedNotifications.size > 100) displayedNotifications.clear();

  const notificationTitle = payload.notification?.title || 'Order Update';
  const notificationBody = payload.notification?.body || 'Your order status has changed';

  const notificationOptions = {
    body: notificationBody,
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    tag: notificationId
  };

  return self.registration.showNotification(notificationTitle, notificationOptions)
    .catch(err => console.error('Failed to show notification:', err));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Push subscription change handler
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    Promise.all([
      messaging.getToken(),
      registration.pushManager.subscribe(event.oldSubscription.options)
    ]).then(([token, newSubscription]) => {
      console.log('Push subscription renewed:', token);
      return fetch('/api/update-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          oldToken: event.oldSubscription.endpoint,
          newToken: token
        })
      });
    })
  );
});