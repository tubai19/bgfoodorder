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

// Initialize Firebase Messaging if supported
(async function() {
  if (await isMessagingSupported()) {
    messaging = getMessaging(app);
  }
})();

const DEFAULT_STATUS = {
  isShopOpen: true,
  isDeliveryAvailable: true
};

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
  currentStatus: {...DEFAULT_STATUS},
  currentFCMToken: null
};

// Get FCM token
async function getFCMToken() {
  if (!messaging) return null;
  
  try {
    const currentToken = await getToken(messaging, {
      vapidKey: 'BGF2rBiAxvlRiqHmvDYEH7_OXxWLl0zIv9IS-2Ky9letx3l4bOyQXRF901lfKw0P7fQIREHaER4QKe4eY34g1AY' // Replace with your VAPID key
    });
    
    if (currentToken) {
      AppState.currentFCMToken = currentToken;
      return currentToken;
    }
    
    console.log('No registration token available. Request permission to generate one.');
    return null;
  } catch (err) {
    console.error('An error occurred while retrieving token:', err);
    return null;
  }
}

// Set up message handler
function setupMessageHandler() {
  if (!messaging) return;
  
  onMessage(messaging, (payload) => {
    console.log('Message received:', payload);
    showNotification(payload.notification?.body || 'New update from Bake & Grill');
  });
}

// Register customer token in Firestore
async function registerCustomerToken(phoneNumber, customerName = null) {
  if (!AppState.currentFCMToken || !phoneNumber) return;
  
  try {
    const tokenRef = doc(db, 'customerTokens', phoneNumber);
    
    await setDoc(tokenRef, {
      token: AppState.currentFCMToken,
      phoneNumber: phoneNumber,
      timestamp: serverTimestamp(),
      name: customerName,
      lastActive: serverTimestamp()
    }, { merge: true });
    
    console.log('FCM token registered for customer:', phoneNumber);
  } catch (error) {
    console.error('Error registering FCM token:', error);
  }
}

function getCartFromStorage() {
  try {
    const cartData = localStorage.getItem('cartItems');
    return cartData ? JSON.parse(cartData) : [];
  } catch (e) {
    console.error('Error parsing cart data', e);
    return [];
  }
}

AppState.selectedItems = getCartFromStorage();

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

function updateCartBadge() {
  if (!AppState.domElements.cartBadge) return;
  const itemCount = AppState.selectedItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  AppState.domElements.cartBadge.textContent = itemCount > 0 ? itemCount : '';
}

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

function saveCartToStorage() {
  try {
    localStorage.setItem('cartItems', JSON.stringify(AppState.selectedItems));
    updateCartBadge();
  } catch (error) {
    console.error('Error saving cart to storage:', error);
  }
}

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
    
    const status = docSnap.exists() ? { ...DEFAULT_STATUS, ...docSnap.data() } : DEFAULT_STATUS;
    AppState.currentStatus = status;

    const isShopOpen = status.isShopOpen !== false;
    const isDeliveryAvailable = status.isDeliveryAvailable !== false && isShopOpen;

    shopStatusText.textContent = isShopOpen ? 'Shop: Open' : 'Shop: Closed';
    deliveryStatusText.textContent = isDeliveryAvailable ? 'Delivery: Available' : 'Delivery: Unavailable';

    shopStatusBanner.className = isShopOpen ? 'status-item open' : 'status-item closed';
    deliveryStatusBanner.className = isDeliveryAvailable ? 'status-item open' : 'status-item closed';
  } catch (error) {
    console.error("Error updating status:", error);
    shopStatusText.textContent = 'Shop: Status Unknown';
    deliveryStatusText.textContent = 'Delivery: Status Unknown';
  }
}

function setupStatusListener() {
  try {
    const statusRef = doc(db, 'publicStatus', 'current');
    return onSnapshot(statusRef, (docSnap) => {
      if (docSnap.exists()) updateStatusDisplay();
    });
  } catch (error) {
    console.error("Error setting up status listener:", error);
    return null;
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
  if (orderType === "Delivery") {
    return AppState.MENU_CATEGORIES[category]?.availableForDelivery !== false;
  }
  return true;
}

// Check notification permission status
function checkNotificationPermission() {
  if (!('Notification' in window)) {
    if (AppState.domElements.notificationPermissionBtn) {
      AppState.domElements.notificationPermissionBtn.style.display = 'none';
    }
    return;
  }
  
  if (Notification.permission === 'granted') {
    if (AppState.domElements.notificationPermissionBtn) {
      AppState.domElements.notificationPermissionBtn.style.display = 'none';
    }
    if (AppState.domElements.notificationStatus) {
      AppState.domElements.notificationStatus.textContent = 'Notifications enabled';
      AppState.domElements.notificationStatus.className = 'notification-status enabled';
    }
  } else {
    if (AppState.domElements.notificationStatus) {
      AppState.domElements.notificationStatus.textContent = 'Notifications disabled';
      AppState.domElements.notificationStatus.className = 'notification-status disabled';
    }
  }
}

// Request notification permission
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showNotification('Notifications not supported in this browser');
    return;
  }
  
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      showNotification('Notifications enabled! You will receive order updates.');
      if (AppState.domElements.notificationPermissionBtn) {
        AppState.domElements.notificationPermissionBtn.style.display = 'none';
      }
      if (AppState.domElements.notificationStatus) {
        AppState.domElements.notificationStatus.textContent = 'Notifications enabled';
        AppState.domElements.notificationStatus.className = 'notification-status enabled';
      }
      
      // Get FCM token after permission is granted
      await getFCMToken();
    } else {
      if (AppState.domElements.notificationStatus) {
        AppState.domElements.notificationStatus.textContent = 'Notifications blocked';
        AppState.domElements.notificationStatus.className = 'notification-status disabled';
      }
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
}

async function initApp() {
  try {
    initDOMElements();
    document.body.addEventListener('touchstart', function() {}, { passive: true });
    updateCartBadge();
    await updateStatusDisplay();
    setupStatusListener();
    checkNotificationPermission();
    
    // Initialize messaging if supported
    if (await isMessagingSupported()) {
      setupMessageHandler();
      
      // Get FCM token if permission already granted
      if (Notification.permission === 'granted') {
        await getFCMToken();
      }
    }
    
    // Set up notification permission button if exists
    if (AppState.domElements.notificationPermissionBtn) {
      AppState.domElements.notificationPermissionBtn.addEventListener('click', requestNotificationPermission);
    }
  } catch (error) {
    console.error('Error initializing application:', error);
  }
}

export { 
  db,
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
  requestNotificationPermission
};