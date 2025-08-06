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

const firebaseConfig = {
  apiKey: "AIzaSyBuBmCQvvNVFsH2x6XGrHXrgZyULB1_qH8",
  authDomain: "bakeandgrill-44c25.firebaseapp.com",
  projectId: "bakeandgrill-44c25",
  storageBucket: "bakeandgrill-44c25.appspot.com",
  messagingSenderId: "713279633359",
  appId: "1:713279633359:web:ba6bcd411b1b6be7b904ba",
  measurementId: "G-SLG2R88J72"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
    "Sandwiches": { icon: "🥪", availableForDelivery: true }
  },
  domElements: {},
  currentStatus: {...DEFAULT_STATUS}
};

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
    deliveryStatusBanner: document.getElementById('deliveryStatusBanner')
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

async function initApp() {
  try {
    initDOMElements();
    document.body.addEventListener('touchstart', function() {}, { passive: true });
    updateCartBadge();
    await updateStatusDisplay();
    setupStatusListener();
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
  getCategoryIcon,
  isCategoryAvailableForOrderType
};