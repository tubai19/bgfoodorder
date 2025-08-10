// ✅ main.js – Core App Logic

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyDxUR...", // 🔒 Truncated for security – replace with env var in production
  authDomain: "bake-and-grill.firebaseapp.com",
  projectId: "bake-and-grill",
  storageBucket: "bake-and-grill.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456",
  measurementId: "G-XXXXXXX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messaging = getMessaging(app);

// 🍕 Load Shop Status
export async function loadShopStatus() {
  try {
    const statusDoc = await getDoc(doc(db, 'status', 'shop'));
    const deliveryDoc = await getDoc(doc(db, 'status', 'delivery'));
    document.getElementById('shopStatusText').textContent = statusDoc.exists() ? `Shop: ${statusDoc.data().open ? 'Open' : 'Closed'}` : 'Shop: Unknown';
    document.getElementById('deliveryStatusText').textContent = deliveryDoc.exists() ? `Delivery: ${deliveryDoc.data().active ? 'Active' : 'Inactive'}` : 'Delivery: Unknown';
  } catch (err) {
    console.error('❌ Error loading shop status:', err);
  }
}

// 🔔 FCM Notification Setup
async function setupNotifications() {
  const permission = await Notification.requestPermission();
  const notificationStatus = document.getElementById('notificationStatus');

  if (permission === 'granted') {
    try {
      const vapidKey = "BGF2rBiAxvlRiqHmvDYEH7_OXxWLl0zIv9IS-2Ky9letx3l4bOyQXRF901lfKw0P7fQIREHaER4QKe4eY34g1AY";
      const token = await getToken(messaging, { vapidKey });
      console.log('✅ FCM Token:', token);
      notificationStatus.textContent = '✅';
    } catch (err) {
      console.error('❌ Unable to get token:', err);
      notificationStatus.textContent = '⚠️';
    }
  } else {
    notificationStatus.textContent = '🔕';
  }
}

onMessage(messaging, (payload) => {
  console.log('📥 Message received:', payload);
  const notification = document.getElementById('notification');
  const text = document.getElementById('notificationText');
  text.textContent = payload.notification?.body || 'New Notification';
  notification.classList.add('show');
  setTimeout(() => notification.classList.remove('show'), 4000);
});

// 🛒 Cart Functions
export function updateCartBadge() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
  });
}

// 🧠 Init
window.addEventListener('DOMContentLoaded', () => {
  loadShopStatus();
  updateCartBadge();

  const notifyBtn = document.getElementById('notificationPermissionBtn');
  if (notifyBtn) notifyBtn.addEventListener('click', setupNotifications);
});
