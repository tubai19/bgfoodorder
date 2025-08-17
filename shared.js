import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  limit,
  addDoc,
  GeoPoint
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getMessaging, 
  getToken, 
  onMessage,
  isSupported,
  deleteToken
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";
import { 
  getFunctions, 
  httpsCallable 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyBuBmCQvvNVFsH2x6XGrHXrgZyULB1_qH8",
  authDomain: "bakeandgrill-44c25.firebaseapp.com",
  projectId: "bakeandgrill-44c25",
  storageBucket: "bakeandgrill-44c25.appspot.com",
  messagingSenderId: "713279633359",
  appId: "1:713279633359:web:ba6bcd411b1b6be7b904ba",
  measurementId: "G-SLG2R88J72"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app);
const VAPID_KEY = "BGF2rBiAxvlRiqHmvDYEH7_OXxWLl0zIv9IS-2Ky9letx3l4bOyQXRF901lfKw0P7fQIREHaER4QKe4eY34g1AY";
let messaging;

(async () => {
  if (await isSupported()) {
    messaging = getMessaging(app);
    setupMessageHandling();
  }
})();

// PWA Installation
let deferredPrompt;

function setupMessageHandling() {
  onMessage(messaging, (payload) => {
    console.log('Message received:', payload);
    const notification = payload.notification;
    const data = payload.data || {};
    showNotification(notification?.body || 'New update', data.type || 'info');
    
    if (data.type === 'status_update') {
      playNotificationSound();
    }
  });
}

function playNotificationSound() {
  const sound = new Audio('https://assets.mixkit.co/active_storage/sfx/989/989-preview.mp3');
  sound.volume = 0.3;
  sound.play().catch(e => console.log('Sound playback prevented:', e));
}

function showNotification(message, type = 'success') {
  try {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    if (!notification || !notificationText) return;
    
    notificationText.textContent = message;
    notification.className = `mobile-notification show ${type}`;
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  } catch (error) {
    console.error('Notification error:', error);
  }
}

function formatPrice(amount) {
  return '₹' + amount.toFixed(0);
}

let cart = JSON.parse(localStorage.getItem('cart')) || [];

function saveCart() {
  try {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
  } catch (error) {
    console.error('Error saving cart:', error);
    showNotification('Failed to save cart. Please try again.', 'error');
  }
}

function updateCartCount() {
  try {
    const count = cart.reduce((total, item) => total + (item.quantity || 1), 0);
    document.querySelectorAll('.cart-badge, .cart-count').forEach(el => {
      el.textContent = count > 99 ? '99+' : count;
    });
  } catch (error) {
    console.error('Error updating cart count:', error);
  }
}

function validateOrder(cart, orderType) {
  const errors = [];
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  if (subtotal < 200) {
    errors.push(`Minimum order value is ₹200 (Current: ₹${subtotal})`);
  }
  
  if (orderType === 'Delivery') {
    const hasCombos = cart.some(item => item.category === 'Combos');
    if (hasCombos) {
      errors.push('Combos are not available for delivery');
    }
  }
  
  return errors;
}

async function requestNotificationPermission(phoneNumber, preferences = {}) {
  try {
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      
      if (token) {
        await setDoc(doc(db, 'fcmTokens', token), {
          token,
          phoneNumber,
          preferences: {
            statusUpdates: true,
            specialOffers: true,
            ...preferences
          },
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp()
        });
        return token;
      }
    }
    return null;
  } catch (error) {
    console.error('Notification permission error:', error);
    return null;
  }
}

async function updateNotificationPreferences(phoneNumber, preferences) {
  try {
    const tokensQuery = query(
      collection(db, 'fcmTokens'),
      where('phoneNumber', '==', phoneNumber)
    );
    const querySnapshot = await getDocs(tokensQuery);
    
    const batch = writeBatch(db);
    querySnapshot.forEach(doc => {
      batch.update(doc.ref, { preferences });
    });
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error updating preferences:', error);
    return false;
  }
}

async function getNotificationPreferences(phoneNumber) {
  try {
    const tokensQuery = query(
      collection(db, 'fcmTokens'),
      where('phoneNumber', '==', phoneNumber),
      limit(1)
    );
    const querySnapshot = await getDocs(tokensQuery);
    
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data().preferences || {
        statusUpdates: true,
        specialOffers: true
      };
    }
    return {
      statusUpdates: true,
      specialOffers: true
    };
  } catch (error) {
    console.error('Error getting preferences:', error);
    return {
      statusUpdates: true,
      specialOffers: true
    };
  }
}

async function sendOrderNotification(orderId, phoneNumber, title, body) {
  try {
    console.log(`Attempting to send notification for order ${orderId} to ${phoneNumber}`);
    
    // Get user's FCM tokens
    const tokensQuery = query(
      collection(db, 'fcmTokens'),
      where('phoneNumber', '==', phoneNumber),
      where('preferences.statusUpdates', '==', true)
    );
    const tokensSnapshot = await getDocs(tokensQuery);
    
    if (!tokensSnapshot.empty) {
      const tokens = tokensSnapshot.docs.map(doc => doc.data().token);
      
      // Call Cloud Function directly
      const sendNotification = httpsCallable(functions, 'sendNotification');
      await sendNotification({
        tokens,
        title,
        body,
        data: {
          orderId,
          click_action: `https://${window.location.hostname}/checkout.html?orderId=${orderId}`
        }
      });
    }

    // Save notification to database
    await addDoc(collection(db, 'notifications'), {
      title,
      body,
      phoneNumber,
      timestamp: serverTimestamp(),
      orderId,
      type: 'status_update',
      read: false
    });

    console.log('Notification sent and saved successfully');
    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    showNotification('Failed to send notification', 'error');
    return false;
  }
}

export { 
  db,
  messaging,
  showNotification, 
  formatPrice, 
  cart, 
  saveCart, 
  updateCartCount,
  validateOrder,
  requestNotificationPermission,
  updateNotificationPreferences,
  getNotificationPreferences,
  sendOrderNotification,
  serverTimestamp,
  GeoPoint,
  addDoc,
  collection,
  doc,
  setDoc
};