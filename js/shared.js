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
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getMessaging, 
  getToken, 
  onMessage,
  isSupported,
  deleteToken
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

// PWA Installation
let deferredPrompt;

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone ||
         document.referrer.includes('android-app://');
}

function showIosInstallPrompt() {
  if (isAppInstalled() || localStorage.getItem('iosInstallDismissed')) return;
  
  const iosGuide = document.getElementById('iosInstallGuide');
  if (iosGuide) {
    iosGuide.style.display = 'flex';
    
    document.getElementById('closeIosGuide')?.addEventListener('click', () => {
      iosGuide.style.display = 'none';
      localStorage.setItem('iosInstallDismissed', 'true');
    });
  }
}

function setupInstallPromotion() {
  const installContainer = document.getElementById('installContainer');
  if (!installContainer) return;
  
  if (!isIos() && deferredPrompt) {
    installContainer.style.display = 'flex';
    
    document.getElementById('installButton')?.addEventListener('click', () => {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(choiceResult => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted install');
        }
        installContainer.style.display = 'none';
        deferredPrompt = null;
      });
    });
    
    document.getElementById('dismissInstall')?.addEventListener('click', () => {
      installContainer.style.display = 'none';
    });
  }
  
  if (isIos()) {
    showIosInstallPrompt();
  }
}

function initPwaFeatures() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registered');
        
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New content available - please refresh');
            }
          });
        });
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  }
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setupInstallPromotion();
  });
  
  window.addEventListener('appinstalled', () => {
    console.log('App was installed');
    const installContainer = document.getElementById('installContainer');
    if (installContainer) installContainer.style.display = 'none';
  });
  
  setupInstallPromotion();
}

// Notification functions
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
      const preferences = doc.data().preferences || {};
      if (data.type === 'order_update' && !preferences.statusUpdates) return;
      if (data.type === 'promotion' && !preferences.specialOffers) return;
      
      tokens.push(doc.data().token);
    });

    if (tokens.length === 0) return false;
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

async function sendFCMNotification(phoneNumber, title, body, data = {}) {
  try {
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAccessToken()}`
      },
      body: JSON.stringify({
        phoneNumber,
        title,
        body,
        data
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending FCM:', error);
    return false;
  }
}

async function getAccessToken() {
  try {
    const response = await fetch('/api/get-fcm-token');
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

if (messaging) {
  onMessage(messaging, (payload) => {
    console.log('Message received:', payload);
    const notification = payload.notification;
    const data = payload.data || {};
    showNotification(notification?.body || 'New update', data.type || 'info');
  });
}

document.addEventListener('DOMContentLoaded', updateCartCount);

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
  sendNotificationToUser,
  updateNotificationPreferences,
  getNotificationPreferences,
  initPwaFeatures,
  isAppInstalled,
  sendFCMNotification,
  getAccessToken
};