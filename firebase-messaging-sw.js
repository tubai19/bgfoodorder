importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

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
  
  const notificationTitle = payload.notification?.title || 'Order Update';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new order update',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge.png',
    data: payload.data || {}
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  let url = '/';
  if (event.notification.data) {
    if (event.notification.data.orderId) {
      url = `/checkout.html?orderId=${event.notification.data.orderId}`;
    } else if (event.notification.data.click_action) {
      url = event.notification.data.click_action;
    }
  }

  event.waitUntil(
    clients.matchAll({type: 'window'}).then((windowClients) => {
      // Focus on existing tab if it exists
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new tab if none exists
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});