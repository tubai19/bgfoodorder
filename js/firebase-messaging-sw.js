importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBuBmCQvvNVFsH2x6XGrHXrgZyULB1_qH8",
  authDomain: "bakeandgrill-44c25.firebaseapp.com",
  projectId: "bakeandgrill-44c25",
  storageBucket: "bakeandgrill-44c25.appspot.com",
  messagingSenderId: "713279633359",
  appId: "1:713279633359:web:ba6bcd411b1b6be7b904ba"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'Order Update';
  const notificationOptions = {
    body: payload.notification?.body || payload.data.body || 'New update',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge.png',
    data: payload.data || {},
    vibrate: [200, 100, 200]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  let url = '/';
  if (event.notification.data) {
    url = event.notification.data.click_action || 
          (event.notification.data.orderId ? 
           `/order-status.html?orderId=${event.notification.data.orderId}` : '/');
  }

  event.waitUntil(
    clients.matchAll({type: 'window'}).then((windowClients) => {
      const matchingClient = windowClients.find(client => client.url === url);
      if (matchingClient) return matchingClient.focus();
      return clients.openWindow(url);
    })
  );
});