// main.js - Main application module
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { 
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { 
  getMessaging,
  getToken,
  onMessage,
  isSupported as isMessagingSupported
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging.js";

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
  domElements: {},
  currentStatus: {
    isShopOpen: true,
    isDeliveryAvailable: true
  },
  currentFCMToken: null
};

// Initialize DOM elements
function initDOMElements() {
  const elements = {
    notification: document.getElementById('notification'),
    notificationText: document.getElementById('notificationText'),
    mobileCartBtn: document.getElementById('mobileCartBtn'),
    cartBadge: document.querySelector('.cart-badge'),
    shopStatusText: document.getElementById('shopStatusText'),
    deliveryStatusText: document.getElementById('deliveryStatusText'),
    shopStatusBanner: document.getElementById('shopStatusBanner'),
    deliveryStatusBanner: document.getElementById('deliveryStatusBanner'),
    notificationPermissionBtn: document.getElementById('notificationPermissionBtn'),
    notificationStatus: document.getElementById('notificationStatus')
  };

  Object.keys(elements).forEach(key => {
    if (elements[key]) AppState.domElements[key] = elements[key];
  });
}

// Firebase Messaging
async function initializeFirebaseMessaging() {
  try {
    const isSupported = await isMessagingSupported();
    if (!isSupported) {
      console.log('Firebase Messaging not supported');
      return null;
    }

    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      console.error('No service worker registration');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: 'BGF2rBiAxvlRiqHmvDYEH7_OXxWLl0zIv9IS-2Ky9letx3l4bOyQXRF901lfKw0P7fQIREHaER4QKe4eY34g1AY',
      serviceWorkerRegistration: registration
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
  try {
    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      showNotification(payload.notification?.body || 'New update from Bake & Grill');
      if (payload.data?.type === 'statusUpdate') updateStatusDisplay();
    });
  } catch (error) {
    console.error('Message handler error:', error);
  }
}

async function registerCustomerToken(phoneNumber, customerName = null) {
  try {
    if (!AppState.currentFCMToken || !phoneNumber) return false;
    
    await setDoc(doc(db, 'customerTokens', phoneNumber), {
      token: AppState.currentFCMToken,
      phoneNumber,
      name: customerName,
      lastActive: serverTimestamp()
    }, { merge: true });
    
    return true;
  } catch (error) {
    console.error('Token registration error:', error);
    return false;
  }
}

// Notification permission
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showNotification('Notifications not supported');
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    const enabled = permission === 'granted';
    
    showNotification(enabled 
      ? 'Notifications enabled! You will receive order updates.'
      : 'Notifications blocked. You may miss important order updates.');
    
    updateNotificationUI(enabled);
    return enabled ? initializeFirebaseMessaging() : false;
  } catch (error) {
    console.error('Permission error:', error);
    return false;
  }
}

function updateNotificationUI(enabled) {
  const { notificationPermissionBtn, notificationStatus } = AppState.domElements;
  
  if (notificationPermissionBtn) {
    notificationPermissionBtn.style.display = enabled ? 'none' : 'block';
  }
  
  if (notificationStatus) {
    notificationStatus.textContent = enabled ? 'Notifications enabled' : 'Notifications disabled';
    notificationStatus.className = `notification-status ${enabled ? 'enabled' : 'disabled'}`;
  }
}

function checkNotificationPermission() {
  updateNotificationUI(Notification.permission === 'granted');
}

// Shop status management
async function updateStatusDisplay() {
  const { 
    shopStatusText, 
    deliveryStatusText,
    shopStatusBanner,
    deliveryStatusBanner
  } = AppState.domElements;

  if (!shopStatusText || !deliveryStatusText) return;

  try {
    const docSnap = await getDoc(doc(db, 'publicStatus', 'current'));
    if (docSnap.exists()) AppState.currentStatus = docSnap.data();

    const isShopOpen = AppState.currentStatus.isShopOpen !== false;
    const isDeliveryAvailable = AppState.currentStatus.isDeliveryAvailable !== false && isShopOpen;

    shopStatusText.textContent = isShopOpen ? 'Shop: Open' : 'Shop: Closed';
    deliveryStatusText.textContent = isDeliveryAvailable ? 'Delivery: Available' : 'Delivery: Unavailable';

    if (shopStatusBanner) {
      shopStatusBanner.className = isShopOpen ? 'status-item open' : 'status-item closed';
    }
    if (deliveryStatusBanner) {
      deliveryStatusBanner.className = isDeliveryAvailable ? 'status-item open' : 'status-item closed';
    }
  } catch (error) {
    console.error("Status update error:", error);
    shopStatusText.textContent = 'Shop: Status Unknown';
    deliveryStatusText.textContent = 'Delivery: Status Unknown';
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

// Cart management
function getCartFromStorage() {
  try {
    const cartData = localStorage.getItem('cartItems');
    return cartData ? JSON.parse(cartData) : [];
  } catch (e) {
    console.error('Cart parse error', e);
    return [];
  }
}

function saveCartToStorage() {
  try {
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

// UI Helpers
function showNotification(message) {
  if (!message) return;
  
  const { notification, notificationText } = AppState.domElements;
  if (!notification || !notificationText) return;
  
  notificationText.textContent = message;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Initialize Application
async function initApp() {
  try {
    initDOMElements();
    AppState.selectedItems = getCartFromStorage();
    updateCartBadge();
    
    document.body.addEventListener('touchstart', () => {}, { passive: true });
    
    await updateStatusDisplay();
    setupStatusListener();
    
    checkNotificationPermission();
    
    if (await isMessagingSupported()) {
      setupMessageHandler();
      if (Notification.permission === 'granted') {
        await initializeFirebaseMessaging();
      }
    }
    
    if (AppState.domElements.notificationPermissionBtn) {
      AppState.domElements.notificationPermissionBtn.addEventListener('click', requestNotificationPermission);
    }
  } catch (error) {
    console.error('App init error:', error);
  }
}

// Utility Functions
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

// Initialize the app
initApp();

// Export functions if needed by other modules
export { 
  db,
  app,
  AppState,
  saveCartToStorage,
  showNotification,
  calculateHaversineDistance,
  calculateDeliveryChargeByDistance,
  getCategoryIcon,
  isCategoryAvailableForOrderType,
  registerCustomerToken
};