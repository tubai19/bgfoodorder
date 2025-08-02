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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Customize background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message', payload);
  
  const notificationTitle = payload.notification?.title || 'Order Update';
  const notificationOptions = {
    body: payload.notification?.body || 'Your order status has changed',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge.png',
    data: {
      url: '/orders',
      orderId: payload.data?.orderId
    },
    vibrate: [200, 100, 200]
  };

  // Show notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Add periodic sync for background updates
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-orders') {
    event.waitUntil(
      fetch('/api/check-orders')
        .then(response => response.json())
        .then(data => {
          if (data.updates && data.updates.length > 0) {
            data.updates.forEach(update => {
              self.registration.showNotification(
                `Order #${update.orderId} Update`,
                {
                  body: `Status changed to ${update.status}`,
                  icon: '/icons/icon-192x192.png',
                  data: { orderId: update.orderId }
                }
              );
            });
          }
        })
        .catch(err => console.error('Periodic sync error:', err))
    );
  }
});