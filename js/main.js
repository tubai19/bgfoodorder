import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { 
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  GeoPoint,
  setDoc
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

// DOM Elements initialization
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

// FCM Token Management
async function getFCMToken() {
  try {
    const isSupported = await isMessagingSupported();
    if (!isSupported) {
      console.log('FCM not supported in this browser');
      return null;
    }
    
    if (!('serviceWorker' in navigator)) {
      console.error('Service workers are not supported');
      return null;
    }
    
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('Service Worker registered');
    
    const messaging = getMessaging(app);
    const currentToken = await getToken(messaging, {
      vapidKey: 'BGF2rBiAxvlRiqHmvDYEH7_OXxWLl0zIv9IS-2Ky9letx3l4bOyQXRF901lfKw0P7fQIREHaER4QKe4eY34g1AY',
      serviceWorkerRegistration: registration
    });
    
    if (currentToken) {
      AppState.currentFCMToken = currentToken;
      console.log('FCM Token:', currentToken);
      return currentToken;
    }
    
    console.log('No registration token available.');
    return null;
  } catch (err) {
    console.error('Error retrieving token:', err);
    return null;
  }
}

// Message Handling
function setupMessageHandler() {
  try {
    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      console.log('Foreground message:', payload);
      showNotification(payload.notification?.body || 'New update from Bake & Grill');
      
      // Handle specific message types
      if (payload.data?.type === 'statusUpdate') {
        updateStatusDisplay();
      }
    });
  } catch (error) {
    console.error('Error setting up message handler:', error);
  }
}

// Notification Permission
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showNotification('Notifications not supported');
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      showNotification('Notifications enabled!');
      updateNotificationUI(true);
      return await getFCMToken();
    } else {
      updateNotificationUI(false);
      return false;
    }
  } catch (error) {
    console.error('Error requesting permission:', error);
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
  if (!('Notification' in window)) {
    updateNotificationUI(false);
    return;
  }
  
  updateNotificationUI(Notification.permission === 'granted');
}

// Customer Token Registration
async function registerCustomerToken(phoneNumber, customerName = null) {
  if (!AppState.currentFCMToken || !phoneNumber) return false;
  
  try {
    const tokenRef = doc(db, 'customerTokens', phoneNumber);
    await setDoc(tokenRef, {
      token: AppState.currentFCMToken,
      phoneNumber,
      name: customerName,
      lastActive: serverTimestamp()
    }, { merge: true });
    
    console.log('Token registered for:', phoneNumber);
    return true;
  } catch (error) {
    console.error('Error registering token:', error);
    return false;
  }
}

// Shop Status Management
async function updateStatusDisplay() {
  const { 
    shopStatusText, 
    deliveryStatusText,
    shopStatusBanner,
    deliveryStatusBanner
  } = AppState.domElements;

  if (!shopStatusText || !deliveryStatusText) return;

  try {
    const statusRef = doc(db, 'publicStatus', 'current');
    const docSnap = await getDoc(statusRef);
    
    if (docSnap.exists()) {
      AppState.currentStatus = docSnap.data();
    }

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
    console.error("Error updating status:", error);
    shopStatusText.textContent = 'Shop: Status Unknown';
    deliveryStatusText.textContent = 'Delivery: Status Unknown';
  }
}

function setupStatusListener() {
  try {
    const statusRef = doc(db, 'publicStatus', 'current');
    return onSnapshot(statusRef, () => {
      updateStatusDisplay();
    });
  } catch (error) {
    console.error("Error setting up status listener:", error);
    return null;
  }
}

// Cart Management
function getCartFromStorage() {
  try {
    const cartData = localStorage.getItem('cartItems');
    return cartData ? JSON.parse(cartData) : [];
  } catch (e) {
    console.error('Error parsing cart data', e);
    return [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem('cartItems', JSON.stringify(AppState.selectedItems));
    updateCartBadge();
  } catch (error) {
    console.error('Error saving cart:', error);
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
    
    document.body.addEventListener('touchstart', function() {}, { passive: true });
    
    await updateStatusDisplay();
    setupStatusListener();
    
    checkNotificationPermission();
    
    if (await isMessagingSupported()) {
      setupMessageHandler();
      
      if (Notification.permission === 'granted') {
        await getFCMToken();
      }
    }
    
    if (AppState.domElements.notificationPermissionBtn) {
      AppState.domElements.notificationPermissionBtn.addEventListener('click', requestNotificationPermission);
    }
  } catch (error) {
    console.error('Error initializing app:', error);
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
  if (orderType === "Delivery") {
    return AppState.MENU_CATEGORIES[category]?.availableForDelivery !== false;
  }
  return true;
}

// Export all necessary functions
export { 
  db,
  app,
  AppState,
  initApp,
  updateCartBadge,
  showNotification,
  saveCartToStorage,
  calculateHaversineDistance,
  calculateDeliveryChargeByDistance,
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  GeoPoint,
  setDoc,
  getCategoryIcon,
  isCategoryAvailableForOrderType,
  getFCMToken,
  registerCustomerToken,
  requestNotificationPermission,
  // Add these messaging-related exports:
  getMessaging,
  getToken,
  onMessage,
  isMessagingSupported
};