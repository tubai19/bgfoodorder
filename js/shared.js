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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getMessaging, 
  getToken, 
  onMessage,
  isSupported
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyBuBmCQvvNVFsH2x6XGrHXrgZyULB1_qH8",
  authDomain: "bakeandgrill-44c25.firebaseapp.com",
  projectId: "bakeandgrill-44c25",
  storageBucket: "bakeandgrill-44c25.appspot.com",
  messagingSenderId: "713279633359",
  appId: "1:713279633359:web:ba6bcd411b1b6be7b904ba"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let messaging;

(async () => {
  if (await isSupported()) {
    messaging = getMessaging(app);
  }
})();

// Notification utility
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

// Price formatting
function formatPrice(amount) {
  return '₹' + amount.toFixed(0);
}

// Cart management
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

// Notification functions
async function requestNotificationPermission(phoneNumber, preferences = {}) {
  try {
    if (!messaging) {
      console.log('Messaging not supported');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, { 
        vapidKey: 'BGF2rBiAxvlRiqHmvDYEH7_OXxWLl0zIv9IS-2Ky9letx3l4bOyQXRF901lfKw0P7fQIREHaER4QKe4eY34g1AY' 
      });
      
      if (token) {
        await setDoc(doc(db, 'fcmTokens', token), {
          token,
          phoneNumber,
          preferences: {
            statusUpdates: true,
            specialOffers: true,
            ...preferences
          },
          createdAt: serverTimestamp()
        });
      }
      return token;
    }
    return null;
  } catch (error) {
    console.error('Notification permission error:', error);
    return null;
  }
}

async function sendNotificationToUser(phoneNumber, title, body, data = {}) {
  try {
    const tokensRef = collection(db, 'fcmTokens');
    const q = query(tokensRef, where('phoneNumber', '==', phoneNumber));
    const querySnapshot = await getDocs(q);
    
    const tokens = [];
    querySnapshot.forEach((doc) => {
      // Check if user has opted in for this notification type
      const preferences = doc.data().preferences || {};
      if (data.type === 'order_update' && !preferences.statusUpdates) return;
      if (data.type === 'promotion' && !preferences.specialOffers) return;
      
      tokens.push(doc.data().token);
    });

    if (tokens.length === 0) return false;

    // In production, call a cloud function or backend API here
    console.log('Would send notification to:', tokens, 'with:', { title, body, data });
    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

async function updateNotificationPreferences(phoneNumber, preferences) {
  try {
    const tokensRef = collection(db, 'fcmTokens');
    const q = query(tokensRef, where('phoneNumber', '==', phoneNumber));
    const querySnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
      const docRef = doc.ref;
      batch.update(docRef, { preferences });
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
    const tokensRef = collection(db, 'fcmTokens');
    const q = query(tokensRef, where('phoneNumber', '==', phoneNumber), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return doc.data().preferences || {
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

// Handle incoming messages
if (messaging) {
  onMessage(messaging, (payload) => {
    console.log('Message received:', payload);
    const notification = payload.notification;
    const data = payload.data || {};
    
    showNotification(notification?.body || 'New update', data.type || 'info');
  });
}

// Initialize cart count
document.addEventListener('DOMContentLoaded', updateCartCount);

export { 
  db,
  messaging,
  showNotification, 
  formatPrice, 
  cart, 
  saveCart, 
  updateCartCount,
  requestNotificationPermission,
  sendNotificationToUser,
  updateNotificationPreferences,
  getNotificationPreferences
};