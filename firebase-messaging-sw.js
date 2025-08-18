importScripts('https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.1/firebase-messaging.js');

const firebaseConfig = {
  apiKey: "AIzaSyBuBmCQvvNVFsH2x6XGrHXrgZyULB1_qH8",
  authDomain: "bakeandgrill-44c25.firebaseapp.com",
  projectId: "bakeandgrill-44c25",
  storageBucket: "bakeandgrill-44c25.appspot.com",
  messagingSenderId: "713279633359",
  appId: "1:713279633359:web:ba6bcd411b1b6be7b904ba"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  // Customize notification
  const notificationTitle = payload.notification?.title || 'Order Update';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new order update',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge.png',
    data: payload.data || {},
    vibrate: [200, 100, 200] // Vibration pattern
  };

  // Show notification
  return self.registration.showNotification(notificationTitle, notificationOptions)
    .catch(err => {
      console.error('Failed to show notification:', err);
    });
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Determine URL to open
  let url = '/';
  if (event.notification.data) {
    if (event.notification.data.orderId) {
      url = `/order-status.html?orderId=${event.notification.data.orderId}`;
    } else if (event.notification.data.click_action) {
      url = event.notification.data.click_action;
    }
  }

  // Focus existing tab or open new one
  event.waitUntil(
    clients.matchAll({type: 'window'}).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});