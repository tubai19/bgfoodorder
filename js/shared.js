import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  serverTimestamp,  // Add this import
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getMessaging, 
  getToken, 
  onMessage 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyBuBmCQvvNVFsH2x6XGrHXrgZyULB1_qH8",
  authDomain: "bakeandgrill-44c25.firebaseapp.com",
  projectId: "bakeandgrill-44c25",
  storageBucket: "bakeandgrill-44c25.appspot.com",
  messagingSenderId: "713279633359",
  appId: "1:713279633359:web:ba6bcd411b1b6be7b904ba"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messaging = getMessaging(app);

// Notification utility with improved error handling
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

// Price formatting with currency symbol
function formatPrice(amount) {
  return '₹' + amount.toFixed(0);
}

// Cart management with validation
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

// Request notification permission
async function requestNotificationPermission(phoneNumber) {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, { 
        vapidKey: 'BGF2rBiAxvlRiqHmvDYEH7_OXxWLl0zIv9IS-2Ky9letx3l4bOyQXRF901lfKw0P7fQIREHaER4QKe4eY34g1AY' 
      });
      
      if (token) {
        // Use modular v9 syntax
        await setDoc(doc(db, 'fcmTokens', token), {
          token,
          phoneNumber,
          createdAt: serverTimestamp()  // Use imported serverTimestamp
        });
      }
      return token;
    }
  } catch (error) {
    console.error('Notification permission error:', error);
    return null;
  }
}

// Handle incoming messages
onMessage(messaging, (payload) => {
  console.log('Message received:', payload);
  showNotification(payload.notification?.body || 'You have a new update');
});

// Initialize cart count on page load
document.addEventListener('DOMContentLoaded', updateCartCount);

export { 
  db,
  messaging,
  getToken,
  showNotification, 
  formatPrice, 
  cart, 
  saveCart, 
  updateCartCount,
  requestNotificationPermission
};