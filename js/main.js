// main.js - Main application file for Bake & Grill

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

// VAPID public key for push notifications
const VAPID_PUBLIC_KEY = 'BGF2rBiAxvlRiqHmvDYEH7_OXxWLl0zIv9IS-2Ky9letx3l4bOyQXRF901lfKw0P7fQIREHaER4QKe4eY34g1AY';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Shared application state
const AppState = {
  selectedItems: JSON.parse(localStorage.getItem('cartItems')) || [],
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
  domElements: {
    notification: null,
    notificationText: null,
    mobileCartBtn: null,
    cartBadge: null,
    shopStatusText: null,
    deliveryStatusText: null,
    shopStatusBanner: null,
    deliveryStatusBanner: null,
    statusBanner: null,
    deliveryHeader: null,
    deliveryContent: null
  }
};

// Initialize DOM elements
function initDOMElements() {
  AppState.domElements.notification = document.getElementById('notification');
  AppState.domElements.notificationText = document.getElementById('notificationText');
  AppState.domElements.mobileCartBtn = document.getElementById('mobileCartBtn');
  AppState.domElements.cartBadge = document.querySelector('.cart-badge');
  AppState.domElements.shopStatusText = document.getElementById('shopStatusText');
  AppState.domElements.deliveryStatusText = document.getElementById('deliveryStatusText');
  AppState.domElements.shopStatusBanner = document.getElementById('shopStatusBanner');
  AppState.domElements.deliveryStatusBanner = document.getElementById('deliveryStatusBanner');
  AppState.domElements.statusBanner = document.getElementById('statusBanner');
  AppState.domElements.deliveryHeader = document.querySelector('.delivery-header');
  AppState.domElements.deliveryContent = document.querySelector('.delivery-content');
}

// Update cart badge
function updateCartBadge() {
  const itemCount = AppState.selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  if (AppState.domElements.cartBadge) {
    AppState.domElements.cartBadge.textContent = itemCount;
  }
}

// Show notification
function showNotification(message) {
  if (!AppState.domElements.notification || !AppState.domElements.notificationText) {
    console.warn('Notification elements not found');
    return;
  }
  
  AppState.domElements.notificationText.textContent = message;
  AppState.domElements.notification.classList.add('show');
  
  setTimeout(() => {
    AppState.domElements.notification.classList.remove('show');
  }, 3000);
}

// Save cart to localStorage
function saveCartToStorage() {
  localStorage.setItem('cartItems', JSON.stringify(AppState.selectedItems));
  updateCartBadge();
}

// Register Service Worker
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('Service Worker registered with scope:', registration.scope);
      
      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showNotification('New version available! Refresh to update.');
          }
        });
      });
      
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
}

// Check for Service Worker updates
async function checkForUpdates() {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  }
}

// Initialize push notifications
async function initializePushNotifications() {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) return true;
    
    const newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    
    return await savePushSubscription(newSubscription);
  } catch (error) {
    console.error('Push notification initialization failed:', error);
    return false;
  }
}

// Convert VAPID key for push notifications
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}

// Save push subscription to Firestore
async function savePushSubscription(subscription) {
  try {
    const userPhone = localStorage.getItem('userPhone');
    if (!userPhone) return false;

    await setDoc(doc(db, 'fcmTokens', userPhone), {
      token: subscription,
      phoneNumber: userPhone,
      timestamp: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return false;
  }
}

// Check shop status
async function checkShopStatus() {
  try {
    const docSnap = await getDoc(doc(db, 'publicStatus', 'current'));
    return docSnap.exists() ? docSnap.data().isShopOpen !== false : true;
  } catch (error) {
    console.error("Error checking shop status:", error);
    return true;
  }
}

// Update status display
async function updateStatusDisplay() {
  try {
    const docSnap = await getDoc(doc(db, 'publicStatus', 'current'));
    if (!docSnap.exists()) return;

    const status = docSnap.data();
    const isShopOpen = status.isShopOpen !== false;
    const isDeliveryAvailable = status.isDeliveryAvailable !== false;

    // Update UI elements
    if (AppState.domElements.shopStatusText) {
      AppState.domElements.shopStatusText.textContent = isShopOpen ? 'Shop: Open' : 'Shop: Closed';
      AppState.domElements.shopStatusBanner.className = isShopOpen ? 'status-item open' : 'status-item closed';
    }

    if (AppState.domElements.deliveryStatusText) {
      AppState.domElements.deliveryStatusText.textContent = isDeliveryAvailable ? 'Delivery: Available' : 'Delivery: Unavailable';
      AppState.domElements.deliveryStatusBanner.className = isDeliveryAvailable ? 'status-item open' : 'status-item closed';
    }

    // Update order type options
    document.querySelectorAll('input[name="orderType"]').forEach(radio => {
      radio.disabled = !isShopOpen;
    });

    const deliveryRadio = document.querySelector('input[name="orderType"][value="Delivery"]');
    if (deliveryRadio) {
      deliveryRadio.disabled = !isDeliveryAvailable;
      if (!isDeliveryAvailable && deliveryRadio.checked) {
        document.querySelector('input[name="orderType"][value="Pickup"]').checked = true;
      }
    }

  } catch (error) {
    console.error("Error updating status display:", error);
  }
}

// Set up real-time listener for status changes
function setupStatusListener() {
  onSnapshot(doc(db, 'publicStatus', 'current'), (docSnap) => {
    if (docSnap.exists()) updateStatusDisplay();
  });
}

// Toggle delivery info accordion
function setupDeliveryInfoAccordion() {
  if (AppState.domElements.deliveryHeader && AppState.domElements.deliveryContent) {
    AppState.domElements.deliveryHeader.addEventListener('click', function() {
      const icon = this.querySelector('i');
      icon.classList.toggle('fa-chevron-down');
      icon.classList.toggle('fa-chevron-up');
      AppState.domElements.deliveryContent.classList.toggle('active');
    });
  }
}

// Calculate distance using Haversine formula
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
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
  if (!distance || distance > AppState.MAX_DELIVERY_DISTANCE) return null;
  if (distance <= 4) return 0;
  if (distance <= 6) return 20;
  if (distance <= 8) return 30;
  return null;
}

// Get category icon
function getCategoryIcon(category) {
  return AppState.MENU_CATEGORIES[category]?.icon || "🍽";
}

// Check if category is available for order type
function isCategoryAvailableForOrderType(category, orderType) {
  return orderType !== "Delivery" || AppState.MENU_CATEGORIES[category]?.availableForDelivery !== false;
}

// Initialize the application
async function initApp() {
  initDOMElements();
  document.body.addEventListener('touchstart', () => {}, { passive: true });
  
  // Initialize UI state
  updateCartBadge();
  updateStatusDisplay();
  setupStatusListener();
  setupDeliveryInfoAccordion();
  
  // Register Service Worker
  await registerServiceWorker();
  
  // Check for updates periodically
  setInterval(checkForUpdates, 60 * 60 * 1000);
  
  // Initialize push notifications if user phone exists
  if (localStorage.getItem('userPhone')) {
    await initializePushNotifications();
  }
}

// PWA Installation Prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  const installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.style.display = 'block';
    installBtn.addEventListener('click', () => {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        deferredPrompt = null;
      });
    });
  }
});

window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  const installBtn = document.getElementById('installBtn');
  if (installBtn) installBtn.style.display = 'none';
});

// Check if app is running as PWA
function checkIsPWA() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone ||
         document.referrer.includes('android-app://');
}

// Add PWA mode class if needed
if (checkIsPWA()) {
  document.body.classList.add('pwa-mode');
}

window.matchMedia('(display-mode: standalone)').addEventListener('change', (evt) => {
  if (evt.matches) {
    document.body.classList.add('pwa-mode');
  } else {
    document.body.classList.remove('pwa-mode');
  }
});

// Enhanced offline detection
function updateOnlineStatus() {
  const offlineIndicator = document.querySelector('.offline-indicator');
  if (offlineIndicator) {
    offlineIndicator.style.display = navigator.onLine ? 'none' : 'block';
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// Export all necessary functions and variables
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
  getCategoryIcon,
  isCategoryAvailableForOrderType
};
