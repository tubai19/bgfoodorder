// Import Firebase Modular SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  onSnapshot, 
  collection,
  getDocs 
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js";
import { 
  getMessaging, 
  getToken, 
  onMessage, 
  isSupported 
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-messaging.js";

// Firebase configuration
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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let messaging = null;

// Check IndexedDB support before initializing messaging
async function checkAndInitializeMessaging() {
  try {
    // Test IndexedDB support first
    const testDB = indexedDB.open('testDB');
    await new Promise((resolve, reject) => {
      testDB.onsuccess = resolve;
      testDB.onerror = reject;
    });
    
    if (await isSupported()) {
      messaging = getMessaging(app);
      return messaging;
    }
    return null;
  } catch (error) {
    console.warn('IndexedDB not available, disabling Firebase Messaging:', error);
    return null;
  }
}

messaging = await checkAndInitializeMessaging();

// Application state
const AppState = {
  selectedItems: [],
  RESTAURANT_LOCATION: { lat: 22.3908, lng: 88.2189 },
  MAX_DELIVERY_DISTANCE: 8,
  MIN_DELIVERY_ORDER: 200,
  MENU_CATEGORIES: {
    "Veg Pizzas": { icon: "🍕", availableForDelivery: true },
    "Paneer Specials": { icon: "🧀", availableForDelivery: true },
    "Non-Veg Pizzas": { icon: "🍗", availableForDelivery: true },
    "Burgers": { icon: "🍔", availableForDelivery: true },
    "Sandwiches": { icon: "🥪", availableForDelivery: true },
    "Quick Bites": { icon: "🍟", availableForDelivery: true },
    "Dips": { icon: "🥫", availableForDelivery: true },
    "Combos": { icon: "🎁", availableForDelivery: false }
  },
  currentStatus: {
    isShopOpen: true,
    isDeliveryAvailable: true
  },
  currentFCMToken: null,
  FeatureFlags: {
    FCM_ENABLED: true,
    OFFLINE_MODE: true
  },
  domElements: {}
};

// Initialize DOM elements
function initDOMElements() {
  AppState.domElements = {
    notification: document.getElementById('notification'),
    notificationText: document.getElementById('notificationText'),
    mobileCartBtn: document.getElementById('mobileCartBtn'),
    cartBadge: document.querySelector('.cart-badge'),
    shopStatusText: document.getElementById('shopStatusText'),
    deliveryStatusText: document.getElementById('deliveryStatusText'),
    shopStatusBanner: document.getElementById('shopStatusBanner'),
    deliveryStatusBanner: document.getElementById('deliveryStatusBanner'),
    a11yNotification: document.getElementById('a11y-notification')
  };
}

// Firebase Messaging
async function initializeFirebaseMessaging() {
  if (!AppState.FeatureFlags.FCM_ENABLED || !messaging) return null;
  
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, {
      vapidKey: 'BGF2rBiAxvlRiqHmvDYEH7_OXxWLl0zIv9IS-2Ky9letx3l4bOyQXRF901lfKw0P7fQIREHaER4QKe4eY34g1AY'
    });

    if (token) {
      AppState.currentFCMToken = token;
      return token;
    }
    return null;
  } catch (error) {
    console.error('Messaging init error:', error);
    return null;
  }
}

function setupMessageHandler() {
  if (!AppState.FeatureFlags.FCM_ENABLED || !messaging) return;
  
  try {
    onMessage(messaging, (payload) => {
      const notificationText = payload.notification?.body || 'New update from Bake & Grill';
      showNotification(notificationText);
    });
  } catch (error) {
    console.error('Message handler error:', error);
  }
}

// Shop status
async function updateStatusDisplay() {
  const { shopStatusText, deliveryStatusText, shopStatusBanner, deliveryStatusBanner } = AppState.domElements;

  if (!shopStatusText || !deliveryStatusText) return;

  try {
    const docSnap = await getDoc(doc(db, 'publicStatus', 'current'));
    if (docSnap.exists()) {
      AppState.currentStatus = docSnap.data();
    }

    const isShopOpen = AppState.currentStatus.isShopOpen !== false;
    const isDeliveryAvailable = AppState.currentStatus.isDeliveryAvailable !== false && isShopOpen;

    shopStatusText.textContent = isShopOpen ? 
      `Shop: Open (${AppState.currentStatus.openingHours || '4PM-10PM'})` : 
      'Shop: Closed';
    
    deliveryStatusText.textContent = isDeliveryAvailable ? 
      `Delivery: Available (${AppState.currentStatus.deliveryRadius || '8km'} radius)` : 
      'Delivery: Unavailable';

    if (shopStatusBanner) {
      shopStatusBanner.className = isShopOpen ? 'status-item open' : 'status-item closed';
    }
    if (deliveryStatusBanner) {
      deliveryStatusBanner.className = isDeliveryAvailable ? 'status-item open' : 'status-item closed';
    }
  } catch (error) {
    console.error("Status update error:", error);
    if (shopStatusText) shopStatusText.textContent = 'Shop: Status Unknown';
    if (deliveryStatusText) deliveryStatusText.textContent = 'Delivery: Status Unknown';
  }
}

function setupStatusListener() {
  try {
    return onSnapshot(doc(db, 'publicStatus', 'current'), updateStatusDisplay);
  } catch (error) {
    console.error("Status listener error:", error);
    return null;
  }
}

async function getCartFromStorage() {
  try {
    if (AppState.FeatureFlags.OFFLINE_MODE && window.idb && window.idb.isSupported) {
      const cart = await idb.getCart();
      return cart || [];
    }
    return JSON.parse(localStorage.getItem('cartItems')) || [];
  } catch (error) {
    console.error('Cart load error:', error);
    return [];
  }
}

async function saveCartToStorage() {
  try {
    if (AppState.FeatureFlags.OFFLINE_MODE && window.idb && window.idb.isSupported) {
      await idb.saveCart(AppState.selectedItems);
    }
    localStorage.setItem('cartItems', JSON.stringify(AppState.selectedItems));
    updateCartBadge();
  } catch (error) {
    console.error('Cart save error:', error);
  }
}

function updateCartBadge() {
  if (!AppState.domElements.cartBadge) return;
  const itemCount = AppState.selectedItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  AppState.domElements.cartBadge.textContent = itemCount > 0 ? itemCount : '';
}

function showNotification(message) {
  if (!message) return;
  
  const { notification, notificationText, a11yNotification } = AppState.domElements;
  
  if (notification && notificationText) {
    notificationText.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => notification.style.display = 'none', 3000);
  }
  
  if (a11yNotification) {
    a11yNotification.textContent = message;
  }
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateDeliveryChargeByDistance(distance) {
  if (distance <= 4) return 0;
  if (distance <= 6) return 20;
  if (distance <= 8) return 30;
  return null;
}

function getCategoryIcon(category) {
  return AppState.MENU_CATEGORIES[category]?.icon || "🍽";
}

function isCategoryAvailableForOrderType(category, orderType) {
  return orderType !== "Delivery" || 
    AppState.MENU_CATEGORIES[category]?.availableForDelivery !== false;
}

async function initApp() {
  try {
    initDOMElements();
    AppState.selectedItems = await getCartFromStorage();
    updateCartBadge();
    
    await updateStatusDisplay();
    setupStatusListener();
    
    if (Notification.permission === 'granted') {
      await initializeFirebaseMessaging();
    }
    setupMessageHandler();

    window.addEventListener('error', (e) => {
      console.error('Global error:', e.error);
      showNotification('An error occurred');
      if (window.idb && window.idb.isSupported) {
        idb.logError({
          error: e.error?.toString(),
          timestamp: new Date().toISOString(),
          stack: e.error?.stack
        });
      }
    });
  } catch (error) {
    console.error('App init error:', error);
    if (window.idb && window.idb.isSupported) {
      idb.logError({
        error: error.toString(),
        timestamp: new Date().toISOString(),
        stack: error.stack
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', initApp);

// Export for menu.js
export {
  AppState,
  db,
  initApp,
  saveCartToStorage,
  showNotification,
  calculateHaversineDistance,
  calculateDeliveryChargeByDistance,
  getCategoryIcon,
  isCategoryAvailableForOrderType,
  getDocs,
  collection
};