import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, doc, setDoc, getDoc, updateDoc, 
  query, where, getDocs, writeBatch, serverTimestamp, 
  onSnapshot, limit, addDoc, GeoPoint
} from "firebase/firestore";
import { 
  getMessaging, getToken, onMessage, isSupported, deleteToken 
} from "firebase/messaging";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseConfig, VAPID_KEY } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app);
let messaging;

// Initialize Firebase Messaging if supported
const initializeMessaging = async () => {
  if (await isSupported()) {
    messaging = getMessaging(app);
    setupMessageHandling();
  }
};
initializeMessaging();

// Message handling
function setupMessageHandling() {
  if (!messaging) return;
  
  onMessage(messaging, (payload) => {
    console.log('Message received:', payload);
    showNotification(
      payload.notification?.title || 'Order Update',
      payload.notification?.body || 'Your order status has changed',
      payload.data?.type || 'info'
    );
    
    if (payload.data?.type === 'status_update') {
      playNotificationSound();
    }
  });
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

function playNotificationSound() {
  const sound = new Audio('https://assets.mixkit.co/active_storage/sfx/989/989-preview.mp3');
  sound.volume = 0.3;
  sound.play().catch(e => console.log('Sound playback prevented:', e));
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

// Order validation
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

// Notification management
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
    
    const tokensQuery = query(
      collection(db, 'fcmTokens'),
      where('phoneNumber', '==', phoneNumber),
      where('preferences.statusUpdates', '==', true)
    );
    const tokensSnapshot = await getDocs(tokensQuery);
    
    if (tokensSnapshot.empty) {
      console.log('No active tokens found for user with status updates enabled');
      await logNotificationStatus(orderId, phoneNumber, "failed", "No active tokens");
      return false;
    }

    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);
    
    const sendNotification = httpsCallable(functions, 'sendNotification');
    await sendNotification({
      tokens,
      title,
      body,
      data: {
        orderId,
        type: 'status_update',
        click_action: `${window.location.origin}/order-status.html?orderId=${orderId}`
      }
    });

    await logNotificationStatus(orderId, phoneNumber, "sent");
    
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
    await logNotificationStatus(orderId, phoneNumber, "failed", error.message);
    return false;
  }
}

async function logNotificationStatus(orderId, phoneNumber, status, error = "") {
  try {
    await addDoc(collection(db, 'notificationLogs'), {
      orderId,
      phoneNumber,
      status,
      error,
      timestamp: serverTimestamp()
    });
  } catch (logError) {
    console.error('Failed to log notification status:', logError);
  }
}

async function sendOrderUpdateWithFallback(orderId, phoneNumber, message) {
  const pushSent = await sendOrderNotification(
    orderId, 
    phoneNumber, 
    "Order Update", 
    message
  );
  
  if (!pushSent) {
    try {
      await httpsCallable(functions, 'sendSMS')({
        phoneNumber,
        message: `[Bake & Grill] ${message}`
      });
      console.log('Sent SMS fallback notification');
    } catch (smsError) {
      console.error('SMS fallback failed:', smsError);
    }
  }
}

// PWA Features
function initPwaFeatures() {
  let deferredPrompt;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installContainer = document.getElementById('installContainer');
    if (installContainer) {
      installContainer.style.display = 'block';
    }
  });

  const installButton = document.getElementById('installButton');
  if (installButton) {
    installButton.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      deferredPrompt = null;
      const installContainer = document.getElementById('installContainer');
      if (installContainer) {
        installContainer.style.display = 'none';
      }
    });
  }

  const dismissInstall = document.getElementById('dismissInstall');
  if (dismissInstall) {
    dismissInstall.addEventListener('click', () => {
      const installContainer = document.getElementById('installContainer');
      if (installContainer) {
        installContainer.style.display = 'none';
      }
    });
  }

  const isIos = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
  };

  const isInStandaloneMode = () => 
    ('standalone' in window.navigator) && (window.navigator.standalone);

  if (isIos() && !isInStandaloneMode()) {
    const iosInstallGuide = document.getElementById('iosInstallGuide');
    if (iosInstallGuide) {
      iosInstallGuide.style.display = 'block';
    }

    const closeIosGuide = document.getElementById('closeIosGuide');
    if (closeIosGuide) {
      closeIosGuide.addEventListener('click', () => {
        iosInstallGuide.style.display = 'none';
      });
    }
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
  sendOrderUpdateWithFallback,
  serverTimestamp,
  GeoPoint,
  addDoc,
  collection,
  doc,
  setDoc,
  initPwaFeatures
};