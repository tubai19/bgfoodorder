// Import Firebase SDK
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

// Firebase configuration (consider using environment variables in production)
const firebaseConfig = {
  apiKey: "AIzaSyBuBmCQvvNVFsH2x6XGrHXrgZyULB1_qH8",
  authDomain: "bakeandgrill-44c25.firebaseapp.com",
  projectId: "bakeandgrill-44c25",
  storageBucket: "bakeandgrill-44c25.appspot.com",
  messagingSenderId: "713279633359",
  appId: "1:713279633359:web:ba6bcd411b1b6be7b904ba",
  measurementId: "G-SLG2R88J72"
};

// VAPID public key for push notifications
const VAPID_PUBLIC_KEY = 'BGF2rBiAxvlRiqHmvDYEH7_OXxWLl0zIv9IS-2Ky9letx3l4bOyQXRF901lfKw0P7fQIREHaER4QKe4eY34g1AY';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Default status values
const DEFAULT_STATUS = {
  isShopOpen: true,
  isDeliveryAvailable: true
};

// Shared application state
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
  currentStatus: {...DEFAULT_STATUS}
};

// Helper function to safely parse localStorage data
function getCartFromStorage() {
  try {
    const cartData = localStorage.getItem('cartItems');
    if (!cartData) return [];
    const parsed = JSON.parse(cartData);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error parsing cart data', e);
    return [];
  }
}

// Initialize cart from localStorage
AppState.selectedItems = getCartFromStorage();

// Register Service Worker with configurable path
async function registerServiceWorker(swPath = '/sw.js') {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(swPath, {
      scope: '/',
      type: 'module'
    });
    
    console.log('Service Worker registered with scope:', registration.scope);
    
    // Check for updates periodically
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('New Service Worker version found:', newWorker);
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            console.log('New content available; please refresh.');
            showNotification('New version available! Refresh to update.');
          } else {
            console.log('Content is now available offline!');
          }
        }
      });
    });
    
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

// Check for Service Worker updates
async function checkForUpdates() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    console.log('Checked for Service Worker updates');
  } catch (err) {
    console.error('Error checking for updates:', err);
  }
}

// Convert VAPID key for push notifications
function urlBase64ToUint8Array(base64String) {
  if (!base64String || typeof base64String !== 'string') {
    throw new Error('Invalid base64 string provided');
  }

  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Save push subscription to Firestore
async function savePushSubscription(subscription) {
  if (!subscription) {
    console.error('No subscription provided');
    return false;
  }

  try {
    const userPhone = getCurrentUserPhone();
    if (!userPhone) {
      console.warn('No user phone number available to save subscription');
      return false;
    }

    const subscriptionData = {
      token: subscription,
      phoneNumber: userPhone,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent
    };

    await setDoc(doc(db, 'fcmTokens', userPhone), subscriptionData);
    console.log('Push subscription saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return false;
  }
}

// Unified push notification subscription function
async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported');
    return false;
  }

  if (!('PushManager' in window)) {
    console.warn('Push notifications not supported');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();
    
    if (existingSubscription) {
      console.log('Already subscribed to push notifications');
      return true;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    
    console.log('Push subscription successful');
    return await savePushSubscription(subscription);
  } catch (error) {
    console.error('Push subscription failed:', error);
    return false;
  }
}

// Request notification permission
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted');
      return await subscribeToPushNotifications();
    }
    console.log('Notification permission denied');
    return false;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

// Get current user's phone number from localStorage
function getCurrentUserPhone() {
  const phone = localStorage.getItem('userPhone');
  return phone && typeof phone === 'string' ? phone : null;
}

// Get category icon with validation
function getCategoryIcon(category) {
  if (!category || typeof category !== 'string') return "🍽";
  return AppState.MENU_CATEGORIES[category]?.icon || "🍽";
}

// Check if category is available for order type
function isCategoryAvailableForOrderType(category, orderType) {
  if (!category || !orderType) return false;
  if (orderType === "Delivery") {
    return AppState.MENU_CATEGORIES[category]?.availableForDelivery !== false;
  }
  return true;
}

// Initialize DOM elements with validation
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
    statusBanner: document.getElementById('statusBanner'),
    deliveryHeader: document.querySelector('.delivery-header'),
    deliveryContent: document.querySelector('.delivery-content')
  };

  // Only assign elements that exist
  Object.keys(elements).forEach(key => {
    if (elements[key]) {
      AppState.domElements[key] = elements[key];
    }
  });
}

// Update cart badge
function updateCartBadge() {
  if (!AppState.domElements.cartBadge) return;
  
  const itemCount = AppState.selectedItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  AppState.domElements.cartBadge.textContent = itemCount > 0 ? itemCount : '';
}

// Show notification with validation
function showNotification(message) {
  if (!message || typeof message !== 'string') return;
  
  const { notification, notificationText } = AppState.domElements;
  if (!notification || !notificationText) {
    console.warn('Notification elements not found');
    return;
  }
  
  notificationText.textContent = message;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Save cart to localStorage
function saveCartToStorage() {
  try {
    localStorage.setItem('cartItems', JSON.stringify(AppState.selectedItems));
    updateCartBadge();
  } catch (error) {
    console.error('Error saving cart to storage:', error);
  }
}

// Update status display with improved error handling
async function updateStatusDisplay() {
  const { 
    shopStatusText, 
    deliveryStatusText, 
    shopStatusBanner, 
    deliveryStatusBanner, 
    statusBanner 
  } = AppState.domElements;

  if (!shopStatusText || !deliveryStatusText || !shopStatusBanner || !deliveryStatusBanner) {
    return;
  }

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

    // Update order type radio buttons
    const orderTypeRadios = document.querySelectorAll('input[name="orderType"]');
    if (orderTypeRadios.length) {
      orderTypeRadios.forEach(radio => {
        radio.disabled = !isShopOpen;
        
        if (radio.value === "Delivery") {
          radio.disabled = !isDeliveryAvailable;
          if (!isDeliveryAvailable && radio.checked) {
            const pickupRadio = document.querySelector('input[name="orderType"][value="Pickup"]');
            if (pickupRadio) pickupRadio.checked = true;
          }
        }
      });
    }

    if (statusBanner) {
      statusBanner.classList.toggle('shop-closed', !isShopOpen);
    }
  } catch (error) {
    console.error("Error updating status display:", error);
    // Fallback to default status
    shopStatusText.textContent = 'Shop: Status Unknown';
    deliveryStatusText.textContent = 'Delivery: Status Unknown';
  }
}

// Set up real-time listener for status changes
function setupStatusListener() {
  try {
    const statusRef = doc(db, 'publicStatus', 'current');
    return onSnapshot(statusRef, (docSnap) => {
      if (docSnap.exists()) {
        updateStatusDisplay();
      }
    });
  } catch (error) {
    console.error("Error setting up status listener:", error);
    return null;
  }
}

// Toggle delivery info accordion
function setupDeliveryInfoAccordion() {
  const { deliveryHeader, deliveryContent } = AppState.domElements;
  if (!deliveryHeader || !deliveryContent) return;

  deliveryHeader.addEventListener('click', function() {
    const icon = this.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-chevron-down');
      icon.classList.toggle('fa-chevron-up');
    }
    deliveryContent.classList.toggle('active');
  });
}

// Calculate distance using Haversine formula
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  // Validate coordinates
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || 
      typeof lat2 !== 'number' || typeof lon2 !== 'number') {
    console.error('Invalid coordinates provided');
    return null;
  }

  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calculate delivery charge by distance
function calculateDeliveryChargeByDistance(distance) {
  if (typeof distance !== 'number' || distance <= 0) return null;
  if (distance > AppState.MAX_DELIVERY_DISTANCE) return null;
  if (distance <= 4) return 0;
  if (distance <= 6) return 20;
  if (distance <= 8) return 30;
  return null;
}

// Calculate estimated delivery time
function calculateDeliveryTime(distanceKm) {
  if (typeof distanceKm !== 'number' || distanceKm <= 0) return "Unknown";
  const preparationTime = 20;
  const travelTimePerKm = 8;
  const travelTime = Math.round(distanceKm * travelTimePerKm);
  return `${preparationTime + travelTime} min (${preparationTime} min prep + ${travelTime} min travel)`;
}

// Initialize the application
async function initApp() {
  try {
    initDOMElements();
    
    // Add passive touch event listener
    document.body.addEventListener('touchstart', function() {}, { passive: true });
    
    updateCartBadge();
    await updateStatusDisplay();
    setupStatusListener();
    setupDeliveryInfoAccordion();
    
    // Register Service Worker
    await registerServiceWorker();
    
    // Check for updates every hour
    setInterval(checkForUpdates, 60 * 60 * 1000);
    
    // Request notification permission if user phone exists
    if (getCurrentUserPhone()) {
      await requestNotificationPermission();
    }
  } catch (error) {
    console.error('Error initializing application:', error);
  }
}

// Export what's needed
export { 
  db,
  AppState,
  initApp,
  updateCartBadge,
  showNotification,
  saveCartToStorage,
  calculateHaversineDistance,
  calculateDeliveryChargeByDistance,
  calculateDeliveryTime,
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  GeoPoint,
  requestNotificationPermission,
  subscribeToPushNotifications,
  getCurrentUserPhone,
  getCategoryIcon,
  isCategoryAvailableForOrderType,
  registerServiceWorker
};