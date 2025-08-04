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
const VAPID_PUBLIC_KEY = 'BLx9QJYV5Q3L9Z7X8Y6W2T1U4R5E6D7F8G9H0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5I6J7K8L9M0N1O2P3Q4R5S6T7U8V9W0X1Y2Z3';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Shared application state
const AppState = {
  selectedItems: JSON.parse(localStorage.getItem('cartItems')) || [],
  RESTAURANT_LOCATION: { lat: 22.3908, lng: 88.2189 },
  MAX_DELIVERY_DISTANCE: 8,
  MIN_DELIVERY_ORDER: 200,
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

// Initialize cart badge
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

// Check shop status
function checkShopStatus() {
  const statusRef = doc(db, 'publicStatus', 'current');
  return getDoc(statusRef)
    .then(docSnap => docSnap.exists() ? docSnap.data().isShopOpen !== false : true)
    .catch(error => {
      console.error("Error checking shop status:", error);
      return true;
    });
}

// Check delivery status
function checkDeliveryStatus() {
  const statusRef = doc(db, 'publicStatus', 'current');
  return getDoc(statusRef)
    .then(docSnap => docSnap.exists() ? docSnap.data().isDeliveryAvailable !== false : true)
    .catch(error => {
      console.error("Error checking delivery status:", error);
      return true;
    });
}

// Update status display
async function updateStatusDisplay() {
  try {
    const { 
      shopStatusText, 
      deliveryStatusText, 
      shopStatusBanner, 
      deliveryStatusBanner, 
      statusBanner 
    } = AppState.domElements;

    if (!shopStatusText || !deliveryStatusText || !shopStatusBanner || !deliveryStatusBanner) return;

    const statusRef = doc(db, 'publicStatus', 'current');
    const docSnap = await getDoc(statusRef);
    
    if (!docSnap.exists()) {
      console.log("No status document found");
      return;
    }

    const status = docSnap.data();
    const isShopOpen = status.isShopOpen !== false;
    const isDeliveryAvailable = status.isDeliveryAvailable !== false;

    shopStatusText.textContent = isShopOpen ? 'Shop: Open' : 'Shop: Closed';
    deliveryStatusText.textContent = isDeliveryAvailable ? 'Delivery: Available' : 'Delivery: Unavailable';

    shopStatusBanner.className = isShopOpen ? 'status-item open' : 'status-item closed';
    deliveryStatusBanner.className = isDeliveryAvailable ? 'status-item open' : 'status-item closed';

    if (!isShopOpen) {
      document.querySelectorAll('input[name="orderType"]').forEach(radio => radio.disabled = true);
      if (statusBanner) statusBanner.classList.add('shop-closed');
    } else {
      document.querySelectorAll('input[name="orderType"]').forEach(radio => radio.disabled = false);
      if (statusBanner) statusBanner.classList.remove('shop-closed');
      
      const deliveryRadio = document.querySelector('input[name="orderType"][value="Delivery"]');
      if (deliveryRadio) {
        deliveryRadio.disabled = !isDeliveryAvailable;
        if (!isDeliveryAvailable && deliveryRadio.checked) {
          document.querySelector('input[name="orderType"][value="Pickup"]').checked = true;
        }
      }
    }
  } catch (error) {
    console.error("Error updating status display:", error);
  }
}

// Set up real-time listener for status changes
function setupStatusListener() {
  const statusRef = doc(db, 'publicStatus', 'current');
  onSnapshot(statusRef, (docSnap) => {
    if (docSnap.exists()) {
      updateStatusDisplay();
    }
  });
}

// Toggle delivery info accordion
function setupDeliveryInfoAccordion() {
  if (AppState.domElements.deliveryHeader && AppState.domElements.deliveryContent) {
    AppState.domElements.deliveryHeader.addEventListener('click', function() {
      this.querySelector('i').classList.toggle('fa-chevron-down');
      this.querySelector('i').classList.toggle('fa-chevron-up');
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

// Calculate estimated delivery time
function calculateDeliveryTime(distanceKm) {
  if (!distanceKm) return "Unknown";
  const preparationTime = 20;
  const travelTimePerKm = 8;
  const travelTime = Math.round(distanceKm * travelTimePerKm);
  return `${preparationTime + travelTime} min (${preparationTime} min prep + ${travelTime} min travel)`;
}

// Convert VAPID key for push notifications
function urlBase64ToUint8Array(base64String) {
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
  try {
    const userPhone = getCurrentUserPhone();
    if (!userPhone) {
      console.log('No user phone number available to save subscription');
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

// Get current user's phone number from localStorage
function getCurrentUserPhone() {
  return localStorage.getItem('userPhone') || null;
}

// Subscribe to push notifications
async function subscribeToPushNotifications() {  // Added opening curly brace here
  if (!('serviceWorker' in navigator)) {  // Added missing parenthesis here
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
    
    console.log('Push subscription successful:', subscription);
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
    } else {
      console.log('Notification permission denied');
      return false;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

// Initialize the application
function initApp() {
  initDOMElements();
  document.body.addEventListener('touchstart', function() {}, { passive: true });
  updateCartBadge();
  updateStatusDisplay();
  setupStatusListener();
  setupDeliveryInfoAccordion();
  
  if (AppState.domElements.mobileCartBtn) {
    AppState.domElements.mobileCartBtn.addEventListener('click', function() {
      window.location.href = 'checkout.html';
    });
  }

  // Request notification permission on page load
  // Only request if user is logged in (has phone number)
  if (getCurrentUserPhone()) {
    requestNotificationPermission();
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
  getCurrentUserPhone
};