importScripts('https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBuBmCQvvNVFsH2x6XGrHXrgZyULB1_qH8",
  authDomain: "bakeandgrill-44c25.firebaseapp.com",
  projectId: "bakeandgrill-44c25",
  storageBucket: "bakeandgrill-44c25.appspot.com",
  messagingSenderId: "713279633359",
  appId: "1:713279633359:web:ba6bcd411b1b6be7b904ba",
  measurementId: "G-SLG2R88J72"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Track displayed notifications to prevent duplicates
const displayedNotifications = new Set();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Check for duplicate notification
  const notificationId = payload.data?.orderId + payload.data?.status;
  if (displayedNotifications.has(notificationId)) {
    console.log('Duplicate notification ignored');
    return;
  }
  
  displayedNotifications.add(notificationId);
  
  // Clean up old notifications from the set periodically
  if (displayedNotifications.size > 100) {
    displayedNotifications.clear();
  }

  const notificationTitle = payload.notification?.title || 'Order Update';
  const notificationOptions = {
    body: payload.notification?.body || 'Your order status has changed',
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    data: {
      url: payload.data?.url || '/checkout.html',
      orderId: payload.data?.orderId,
      status: payload.data?.status
    },
    tag: notificationId // Use tag to replace notifications for the same order
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Extract order ID from notification data
  const orderId = event.notification.data?.orderId;
  const url = orderId ? `/checkout.html?orderId=${orderId}` : '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow(url);
    })
  );
});