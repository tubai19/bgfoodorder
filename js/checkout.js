// Import necessary functions from main.js
import { 
  AppState,
  db,
  initApp,
  saveCartToStorage,
  calculateHaversineDistance,
  calculateDeliveryChargeByDistance,
  serverTimestamp,
  GeoPoint,
  collection,
  addDoc,
  doc,
  getDoc
} from './main.js';

// Configuration constants
const CONFIG = {
  WHATSAPP_NUMBER: '918240266267',
  OPENROUTE_SERVICE_API_KEY: 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6Ijg5OWE3ZmRmYzhkODRmYmE5MmEzOGU5MDEzMTEyYjIzIiwiaCI6Im11cm11cjY0In0',
  NOMINATIM_ENDPOINT: 'https://nominatim.openstreetmap.org/search',
  OPENROUTE_SERVICE_ENDPOINT: 'https://api.openrouteservice.org/v2/directions/driving-car',
  MAX_ORDER_HISTORY: 50,
  MAP_TILE_PROVIDER: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  MAP_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  FALLBACK_DISTANCE_CALCULATION_TIMEOUT: 3000,
  RESTAURANT_LOCATION: {
    lat: 22.3908,
    lng: 88.2189
  },
  DELIVERY_CHARGES: [
    { min: 0, max: 4, charge: 0 },
    { min: 4, max: 6, charge: 20 },
    { min: 6, max: 8, charge: 30 }
  ],
  MAX_DELIVERY_DISTANCE: 8,
  MIN_DELIVERY_ORDER: 200,
  FREE_DELIVERY_THRESHOLD: 500,
  VALID_COUPONS: {
    'WELCOME10': { type: 'percentage', value: 10, minOrder: 0 },
    'BAKE20': { type: 'fixed', value: 20, minOrder: 100 },
    'GRILL25': { type: 'percentage', value: 25, minOrder: 300 },
    'FREESHIP': { type: 'free_delivery', minOrder: 0 }
  },
  FCM_TOKEN_COLLECTION: 'customerTokens'
};

// Checkout page variables
let map;
let marker;
let locationObj = null;
let usingManualLoc = false;
let deliveryDistance = null;
let watchPositionId = null;
let distanceCalculationCache = {};
let offlineOrderQueue = [];
let isProcessingOfflineQueue = false;
let appliedCoupon = null;
let currentFCMToken = null;

// DOM elements
const elements = {
  placeOrderBtn: document.getElementById('placeOrderBtn'),
  customerName: document.getElementById('customerName'),
  phoneNumber: document.getElementById('phoneNumber'),
  orderNotes: document.getElementById('orderNotes'),
  mobileLiveTotal: document.getElementById('mobileLiveTotal'),
  deliveryChargeDisplay: document.getElementById('deliveryChargeDisplay'),
  distanceText: document.getElementById('distanceText'),
  discountDisplay: document.getElementById('discountDisplay'),
  locationChoiceBlock: document.getElementById('locationChoiceBlock'),
  deliveryShareLocationBtn: document.getElementById('deliveryShareLocationBtn'),
  deliveryShowManualLocBtn: document.getElementById('deliveryShowManualLocBtn'),
  currentLocStatusMsg: document.getElementById('currentLocStatusMsg'),
  manualLocationFields: document.getElementById('manualLocationFields'),
  manualDeliveryAddress: document.getElementById('manualDeliveryAddress'),
  orderTypeRadios: document.querySelectorAll('input[name="orderType"]'),
  totalItemsDisplay: document.getElementById('totalItems'),
  totalAmountDisplay: document.getElementById('totalAmount'),
  checkoutItemsList: document.getElementById('checkoutItemsList'),
  clearCartBtn: document.getElementById('clearCartBtn'),
  loadingIndicator: document.getElementById('loadingIndicator'),
  loadingMessage: document.getElementById('loadingMessage'),
  orderConfirmationModal: document.getElementById('orderConfirmationModal'),
  orderConfirmationSummary: document.getElementById('orderConfirmationSummary'),
  confirmOrderBtn: document.getElementById('confirmOrderBtn'),
  cancelOrderBtn: document.getElementById('cancelOrderBtn'),
  notification: document.getElementById('notification'),
  notificationText: document.getElementById('notificationText'),
  addressMap: document.getElementById('addressMap'),
  couponCode: document.getElementById('couponCode'),
  applyCouponBtn: document.getElementById('applyCouponBtn'),
  couponMessage: document.getElementById('couponMessage'),
  notificationPermissionBtn: document.getElementById('notificationPermissionBtn'),
  notificationStatus: document.getElementById('notificationStatus')
};

// Initialize the checkout page
document.addEventListener('DOMContentLoaded', async function() {
  try {
    await initApp();
    setupEventListeners();
    updateCheckoutDisplay();
    loadOfflineOrdersQueue();
    handleOrderTypeChange();
    initMap();
    checkNotificationPermission();
    initializeFirebaseMessaging();
  } catch (error) {
    console.error('Initialization error:', error);
    showNotification('Failed to initialize. Please refresh the page.');
  }
});

/* ========== FIREBASE MESSAGING (NOTIFICATIONS) ========== */
async function initializeFirebaseMessaging() {
  try {
    if (!firebase.messaging.isSupported()) {
      console.log('Firebase Messaging not supported');
      return;
    }

    const messaging = firebase.messaging();
    
    // Request notification permission
    await messaging.requestPermission();
    
    // Get FCM token
    currentFCMToken = await messaging.getToken();
    console.log('FCM Token:', currentFCMToken);
    
    // Listen for token refresh
    messaging.onTokenRefresh(async () => {
      currentFCMToken = await messaging.getToken();
      console.log('FCM Token refreshed:', currentFCMToken);
      await registerCustomerToken();
    });
    
    // Handle incoming messages
    messaging.onMessage((payload) => {
      console.log('Message received:', payload);
      showNotification(payload.notification?.body || 'New update from Bake & Grill');
    });
    
    // Register the token if we have a phone number
    if (elements.phoneNumber.value && /^\d{10}$/.test(elements.phoneNumber.value)) {
      await registerCustomerToken();
    }
    
  } catch (error) {
    console.error('Firebase Messaging error:', error);
  }
}

async function registerCustomerToken() {
  if (!currentFCMToken || !elements.phoneNumber.value || !/^\d{10}$/.test(elements.phoneNumber.value)) {
    return;
  }
  
  try {
    const phoneNumber = sanitizeInput(elements.phoneNumber.value);
    const tokenRef = doc(db, CONFIG.FCM_TOKEN_COLLECTION, phoneNumber);
    
    await setDoc(tokenRef, {
      token: currentFCMToken,
      phoneNumber: phoneNumber,
      timestamp: serverTimestamp(),
      name: elements.customerName.value ? sanitizeInput(elements.customerName.value) : null
    }, { merge: true });
    
    console.log('FCM token registered for customer:', phoneNumber);
  } catch (error) {
    console.error('Error registering FCM token:', error);
  }
}

function checkNotificationPermission() {
  if (!('Notification' in window)) {
    if (elements.notificationPermissionBtn) {
      elements.notificationPermissionBtn.style.display = 'none';
    }
    return;
  }
  
  if (Notification.permission === 'granted') {
    if (elements.notificationPermissionBtn) {
      elements.notificationPermissionBtn.style.display = 'none';
    }
    if (elements.notificationStatus) {
      elements.notificationStatus.textContent = 'Notifications enabled';
      elements.notificationStatus.className = 'notification-status enabled';
    }
  } else {
    if (elements.notificationStatus) {
      elements.notificationStatus.textContent = 'Notifications disabled';
      elements.notificationStatus.className = 'notification-status disabled';
    }
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showNotification('Notifications not supported in this browser');
    return;
  }
  
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      showNotification('Notifications enabled! You will receive order updates.');
      if (elements.notificationPermissionBtn) {
        elements.notificationPermissionBtn.style.display = 'none';
      }
      if (elements.notificationStatus) {
        elements.notificationStatus.textContent = 'Notifications enabled';
        elements.notificationStatus.className = 'notification-status enabled';
      }
      
      // Initialize messaging if permission granted
      await initializeFirebaseMessaging();
    } else {
      if (elements.notificationStatus) {
        elements.notificationStatus.textContent = 'Notifications blocked';
        elements.notificationStatus.className = 'notification-status disabled';
      }
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
}

/* ========== MAP FUNCTIONS ========== */
function initMap() {
  if (!elements.addressMap) return;

  map = L.map('addressMap').setView([CONFIG.RESTAURANT_LOCATION.lat, CONFIG.RESTAURANT_LOCATION.lng], 13);
  
  L.tileLayer(CONFIG.MAP_TILE_PROVIDER, {
    attribution: CONFIG.MAP_ATTRIBUTION,
    maxZoom: 19
  }).addTo(map);

  // Add restaurant marker
  L.marker([CONFIG.RESTAURANT_LOCATION.lat, CONFIG.RESTAURANT_LOCATION.lng])
    .addTo(map)
    .bindPopup('Bake & Grill')
    .openPopup();

  // Initialize draggable marker
  marker = L.marker([CONFIG.RESTAURANT_LOCATION.lat, CONFIG.RESTAURANT_LOCATION.lng], {
    draggable: true
  }).addTo(map);

  marker.on('dragend', updateLocationFromMarker);
  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    updateLocationFromMarker();
  });
}

function updateLocationFromMarker() {
  if (!marker) return;
  const latlng = marker.getLatLng();
  locationObj = { lat: latlng.lat, lng: latlng.lng };
  calculateDeliveryDetails();
}

/* ========== DELIVERY CALCULATION ========== */
async function calculateDeliveryDetails() {
  if (!locationObj) return;

  try {
    showLoading(true, 'Calculating distance...');
    
    deliveryDistance = await calculateRoadDistance(
      CONFIG.RESTAURANT_LOCATION.lat,
      CONFIG.RESTAURANT_LOCATION.lng,
      locationObj.lat,
      locationObj.lng
    );

    const deliveryCharge = calculateDeliveryChargeByDistance(deliveryDistance);
    
    elements.distanceText.textContent = `${deliveryDistance.toFixed(1)} km from restaurant`;
    elements.deliveryChargeDisplay.textContent = `Delivery Charge: ₹${deliveryCharge}`;
    
    updateCheckoutDisplay();
    showLoading(false);
  } catch (error) {
    console.error('Error calculating delivery details:', error);
    showLoading(false);
    showNotification('Error calculating distance. Please try again.');
  }
}

function calculateDeliveryChargeByDistance(distance) {
  const subtotal = AppState.selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  if (subtotal >= CONFIG.FREE_DELIVERY_THRESHOLD) return 0;
  if (appliedCoupon?.type === 'free_delivery') return 0;

  for (const range of CONFIG.DELIVERY_CHARGES) {
    if (distance >= range.min && distance < range.max) {
      return range.charge;
    }
  }
  return null;
}

function calculateDiscount(subtotal) {
  if (!appliedCoupon) return 0;
  if (subtotal < appliedCoupon.minOrder) return 0;

  if (appliedCoupon.type === 'percentage') {
    return (subtotal * appliedCoupon.value) / 100;
  } else if (appliedCoupon.type === 'fixed') {
    return Math.min(appliedCoupon.value, subtotal);
  }
  return 0;
}

/* ========== ORDER PROCESSING ========== */
async function confirmOrder() {
  try {
    if ('vibrate' in navigator) navigator.vibrate(50);
    showLoading(true, 'Processing your order...');
    
    const isShopOpen = await checkShopStatus();
    if (!isShopOpen) {
      showLoading(false);
      alert("Sorry, the shop is currently closed. Please try again later.");
      return;
    }
    
    const orderData = await prepareOrderData();
    if (!orderData) {
      showLoading(false);
      return;
    }
    
    if (!navigator.onLine) {
      const saved = await saveOrderToOfflineQueue(orderData);
      showLoading(false);
      
      if (saved) {
        showNotification('Order saved offline. Will submit when back online.');
        AppState.selectedItems = [];
        saveCartToStorage();
        updateCheckoutDisplay();
      }
      return;
    }
    
    showOrderConfirmationModal(orderData);
    showLoading(false);
  } catch (error) {
    showLoading(false);
    console.error("Error confirming order:", error);
    showNotification("There was an error processing your order. Please try again.");
  }
}

async function prepareOrderData() {
  const name = sanitizeInput(elements.customerName.value.trim());
  const phone = sanitizeInput(elements.phoneNumber.value.trim());
  const notes = sanitizeInput(elements.orderNotes.value.trim());
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  const subtotal = AppState.selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Validation
  if (!orderType) {
    alert("Please select an order type (Delivery or Pickup).");
    return null;
  }

  if (orderType === 'Delivery' && subtotal < CONFIG.MIN_DELIVERY_ORDER) {
    alert(`Minimum order for delivery is ₹${CONFIG.MIN_DELIVERY_ORDER}. Please add more items or choose pickup.`);
    return null;
  }

  if (!name || !phone) {
    alert("Please enter your name and phone number.");
    return null;
  }

  if (!/^\d{10}$/.test(phone)) {
    alert("Please enter a valid 10-digit phone number.");
    return null;
  }

  if (orderType === 'Delivery') {
    if (!locationObj) {
      alert("Location is required for delivery. Please share your location or enter your address manually.");
      if (elements.locationChoiceBlock) {
        elements.locationChoiceBlock.scrollIntoView({ behavior: 'smooth' });
      }
      return null;
    }
    
    if (usingManualLoc && !elements.manualDeliveryAddress.value.trim()) {
      alert("Please enter your complete delivery address.");
      if (elements.manualDeliveryAddress) elements.manualDeliveryAddress.focus();
      return null;
    }
    
    if (!deliveryDistance) {
      alert("We couldn't determine your distance from the restaurant. Please check your location and try again.");
      return null;
    }
    
    if (deliveryDistance > CONFIG.MAX_DELIVERY_DISTANCE) {
      alert(`Your location is ${deliveryDistance.toFixed(1)}km away (beyond our ${CONFIG.MAX_DELIVERY_DISTANCE}km delivery range). Please choose pickup or visit our restaurant.`);
      return null;
    }
  }

  let deliveryCharge = 0;
  if (orderType === 'Delivery') {
    deliveryCharge = subtotal >= CONFIG.FREE_DELIVERY_THRESHOLD ? 0 : calculateDeliveryChargeByDistance(deliveryDistance);
  }
  
  const discount = calculateDiscount(subtotal);
  const total = subtotal + deliveryCharge - discount;

  const orderData = {
    customerName: name,
    phoneNumber: phone,
    orderType: orderType,
    items: [...AppState.selectedItems],
    subtotal: subtotal,
    deliveryCharge: deliveryCharge,
    discount: discount,
    total: total,
    status: "Pending",
    timestamp: serverTimestamp(),
    notes: notes,
    isOffline: !navigator.onLine
  };

  // Add coupon info if applied
  if (appliedCoupon) {
    orderData.couponCode = elements.couponCode.value.trim().toUpperCase();
    orderData.couponType = appliedCoupon.type;
    orderData.couponValue = appliedCoupon.value || null;
  }

  if (orderType === 'Delivery') {
    if (usingManualLoc) {
      orderData.deliveryAddress = sanitizeInput(elements.manualDeliveryAddress.value);
      if (locationObj) {
        orderData.deliveryLocation = new GeoPoint(locationObj.lat, locationObj.lng);
      }
    } else if (locationObj) {
      orderData.deliveryLocation = new GeoPoint(locationObj.lat, locationObj.lng);
    }
    orderData.deliveryDistance = deliveryDistance;
  }

  return orderData;
}

function showOrderConfirmationModal(orderData) {
  if (!elements.orderConfirmationModal || !elements.orderConfirmationSummary) return;
  
  let summaryHTML = `
    <div class="order-summary-section">
      <h3>Order Summary</h3>
      <p><strong>Name:</strong> ${orderData.customerName}</p>
      <p><strong>Phone:</strong> ${orderData.phoneNumber}</p>
      <p><strong>Order Type:</strong> ${orderData.orderType}</p>
      ${orderData.orderType === 'Delivery' ? `
        <p><strong>Delivery Distance:</strong> ${orderData.deliveryDistance ? orderData.deliveryDistance.toFixed(1)+'km' : 'Unknown'}</p>
        ${orderData.deliveryAddress ? `<p><strong>Delivery Address:</strong> ${orderData.deliveryAddress}</p>` : ''}
        ${orderData.deliveryLocation ? `<p><strong>Location:</strong> <a href="https://www.google.com/maps?q=${orderData.deliveryLocation.latitude},${orderData.deliveryLocation.longitude}" target="_blank">View on Map</a></p>` : ''}
      ` : ''}
      ${orderData.notes ? `<p><strong>Notes:</strong> ${orderData.notes}</p>` : ''}
      ${orderData.couponCode ? `<p><strong>Coupon Code:</strong> ${orderData.couponCode}</p>` : ''}
    </div>
    
    <div class="order-summary-section">
      <h3>Order Items</h3>
      <ul class="order-items-list">
  `;
  
  orderData.items.forEach(item => {
    summaryHTML += `
      <li>
        <span class="item-name">${sanitizeInput(item.name)} (${sanitizeInput(item.variant)})</span>
        <span class="item-quantity">x ${item.quantity}</span>
        <span class="item-price">₹${item.price * item.quantity}</span>
      </li>
    `;
  });
  
  summaryHTML += `
      </ul>
    </div>
    
    <div class="order-summary-section total-section">
      <p><strong>Subtotal:</strong> ₹${orderData.subtotal}</p>
      ${orderData.deliveryCharge > 0 ? `<p><strong>Delivery Charge:</strong> ₹${orderData.deliveryCharge}</p>` : ''}
      ${orderData.orderType === 'Delivery' && orderData.deliveryCharge === 0 ? `<p><strong>Delivery Charge:</strong> Free</p>` : ''}
      ${orderData.discount > 0 ? `<p><strong>Discount:</strong> -₹${orderData.discount.toFixed(2)}</p>` : ''}
      <p class="grand-total"><strong>Total Amount:</strong> ₹${orderData.total.toFixed(2)}</p>
    </div>
  `;
  
  elements.orderConfirmationSummary.innerHTML = summaryHTML;
  elements.orderConfirmationModal.style.display = 'block';
  elements.orderConfirmationModal.setAttribute('aria-hidden', 'false');
  
  if (elements.confirmOrderBtn) elements.confirmOrderBtn.focus();
}

async function processOrderConfirmation() {
  try {
    showLoading(true, 'Placing your order...');
    
    const orderData = await prepareOrderData();
    if (!orderData) {
      showLoading(false);
      return;
    }

    const docRef = await addDoc(collection(db, 'orders'), orderData);
    orderData.id = docRef.id;
    
    // Clear cart and reset form
    AppState.selectedItems = [];
    saveCartToStorage();
    elements.customerName.value = '';
    elements.phoneNumber.value = '';
    elements.orderNotes.value = '';
    locationObj = null;
    deliveryDistance = null;
    appliedCoupon = null;
    elements.couponCode.value = '';
    elements.couponMessage.textContent = '';
    elements.couponMessage.className = 'coupon-message';
    
    closeOrderModal();
    showNotification('Order placed successfully!');
    
    // Send WhatsApp message
    sendWhatsAppOrder(orderData);
    
    // Save to history
    saveOrderToHistory(orderData);
    
    // Register customer token if available
    if (currentFCMToken && orderData.phoneNumber) {
      await registerCustomerToken();
    }
    
    updateCheckoutDisplay();
  } catch (error) {
    console.error("Order error:", error);
    showNotification("Failed to place order. Please try again.");
  } finally {
    showLoading(false);
  }
}

function closeOrderModal() {
  if (elements.orderConfirmationModal) {
    elements.orderConfirmationModal.style.display = 'none';
    elements.orderConfirmationModal.setAttribute('aria-hidden', 'true');
  }
}

/* ========== OFFLINE ORDER HANDLING ========== */
async function saveOrderToOfflineQueue(orderData) {
  try {
    offlineOrderQueue.push({
      ...orderData,
      isOffline: true,
      timestamp: new Date().getTime()
    });
    
    localStorage.setItem('offlineOrdersQueue', JSON.stringify(offlineOrderQueue));
    return true;
  } catch (error) {
    console.error('Error saving to offline queue:', error);
    return false;
  }
}

function loadOfflineOrdersQueue() {
  try {
    const queue = localStorage.getItem('offlineOrdersQueue');
    if (queue) {
      offlineOrderQueue = JSON.parse(queue);
    }
  } catch (error) {
    console.error('Error loading offline orders queue:', error);
  }
}

async function processOfflineOrdersQueue() {
  if (isProcessingOfflineQueue || offlineOrderQueue.length === 0) return;
  
  isProcessingOfflineQueue = true;
  showLoading(true, 'Submitting offline orders...');
  
  try {
    const successfulOrders = [];
    
    for (const order of offlineOrderQueue) {
      try {
        const orderToSubmit = {
          ...order,
          timestamp: serverTimestamp(),
          isOffline: false
        };
        
        await addDoc(collection(db, 'orders'), orderToSubmit);
        successfulOrders.push(order);
      } catch (error) {
        console.error('Error submitting offline order:', error);
      }
    }
    
    if (successfulOrders.length > 0) {
      offlineOrderQueue = offlineOrderQueue.filter(order => 
        !successfulOrders.some(completed => completed.timestamp === order.timestamp)
      );
      
      localStorage.setItem('offlineOrdersQueue', JSON.stringify(offlineOrderQueue));
      showNotification(`${successfulOrders.length} offline order(s) submitted successfully!`);
    }
  } catch (error) {
    console.error('Error processing offline orders queue:', error);
  } finally {
    isProcessingOfflineQueue = false;
    showLoading(false);
  }
}

function saveOrderToHistory(orderData) {
  try {
    const orders = JSON.parse(localStorage.getItem('bakeAndGrillOrders')) || [];
    orders.unshift({
      ...orderData,
      timestamp: orderData.timestamp?.toDate?.()?.toISOString?.() || new Date().toISOString()
    });
    
    if (orders.length > CONFIG.MAX_ORDER_HISTORY) {
      orders.length = CONFIG.MAX_ORDER_HISTORY;
    }
    
    localStorage.setItem('bakeAndGrillOrders', JSON.stringify(orders));
  } catch (error) {
    console.error('Error saving order to history:', error);
  }
}

/* ========== WHATSAPP INTEGRATION ========== */
function sendWhatsAppOrder(orderData) {
  try {
    const message = generateWhatsAppMessage(orderData);
    const encodedMessage = encodeURIComponent(message);
    
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      window.location.href = `whatsapp://send?phone=${CONFIG.WHATSAPP_NUMBER}&text=${encodedMessage}`;
    } else {
      window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodedMessage}`, '_blank');
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }
}

function generateWhatsAppMessage(orderData) {
  let message = `*New Order for Bake & Grill*\n\n`;
  message += `*Customer Name:* ${orderData.customerName}\n`;
  message += `*Phone:* ${orderData.phoneNumber}\n`;
  message += `*Order Type:* ${orderData.orderType}\n\n`;
  
  if (orderData.orderType === 'Delivery') {
    if (orderData.deliveryAddress) {
      message += `*Delivery Address:* ${orderData.deliveryAddress}\n`;
    }
    message += `*Delivery Distance:* ${orderData.deliveryDistance ? orderData.deliveryDistance.toFixed(1)+'km' : 'Unknown'}\n`;
    
    if (orderData.deliveryLocation) {
      const lat = orderData.deliveryLocation.latitude;
      const lng = orderData.deliveryLocation.longitude;
      message += `*Location:* https://www.google.com/maps?q=${lat},${lng}\n`;
    }
  }
  
  if (orderData.couponCode) {
    message += `*Coupon Code:* ${orderData.couponCode}\n`;
  }
  
  message += `\n*Order Items:*\n`;
  orderData.items.forEach((item, index) => {
    message += `${index + 1}. ${item.name} (${item.variant}) x ${item.quantity} - ₹${item.price * item.quantity}\n`;
  });
  
  message += `\n*Subtotal:* ₹${orderData.subtotal}\n`;
  if (orderData.deliveryCharge > 0) {
    message += `*Delivery Charge:* ₹${orderData.deliveryCharge}\n`;
  } else if (orderData.orderType === 'Delivery') {
    message += `*Delivery Charge:* Free\n`;
  }
  if (orderData.discount > 0) {
    message += `*Discount:* -₹${orderData.discount.toFixed(2)}\n`;
  }
  message += `*Total Amount:* ₹${orderData.total.toFixed(2)}\n\n`;
  message += `Please confirm this order. Thank you!`;
  
  return message;
}

/* ========== SHOP STATUS ========== */
async function checkShopStatus() {
  try {
    const statusRef = doc(db, 'publicStatus', 'current');
    const docSnap = await getDoc(statusRef);
    return docSnap.exists() ? docSnap.data().isShopOpen !== false : true;
  } catch (error) {
    console.error("Error checking shop status:", error);
    return true;
  }
}

/* ========== UI UPDATES ========== */
function updateCheckoutDisplay() {
  if (!elements.checkoutItemsList || !elements.totalItemsDisplay || !elements.totalAmountDisplay) return;
  
  // Clear existing items
  elements.checkoutItemsList.innerHTML = '';
  
  if (AppState.selectedItems.length === 0) {
    elements.checkoutItemsList.innerHTML = '<li class="empty-cart">Your cart is empty</li>';
    elements.totalItemsDisplay.textContent = '0 items';
    elements.totalAmountDisplay.textContent = 'Total: ₹0';
    elements.placeOrderBtn.disabled = true;
    elements.discountDisplay.textContent = '';
    return;
  }
  
  // Add items to list
  AppState.selectedItems.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'checkout-item';
    li.innerHTML = `
      <div class="checkout-item-info">
        <span class="checkout-item-name">${sanitizeInput(item.name)} (${sanitizeInput(item.variant)})</span>
        <span class="checkout-item-price">₹${item.price * item.quantity}</span>
      </div>
      <div class="checkout-item-actions">
        <span class="checkout-item-quantity">${item.quantity}</span>
        <button class="checkout-item-remove" data-index="${index}">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    elements.checkoutItemsList.appendChild(li);
  });
  
  // Calculate totals
  const itemCount = AppState.selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = AppState.selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  let deliveryCharge = 0;
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  
  if (orderType === 'Delivery' && deliveryDistance) {
    if (deliveryDistance > CONFIG.MAX_DELIVERY_DISTANCE) {
      elements.deliveryChargeDisplay.textContent = `Delivery not available beyond ${CONFIG.MAX_DELIVERY_DISTANCE}km`;
      elements.distanceText.textContent = `${deliveryDistance.toFixed(1)} km (out of range)`;
      elements.placeOrderBtn.disabled = true;
      return;
    }
    
    deliveryCharge = calculateDeliveryChargeByDistance(deliveryDistance);
  }
  
  const discount = calculateDiscount(subtotal);
  const total = subtotal + deliveryCharge - discount;
  
  if (discount > 0) {
    elements.discountDisplay.textContent = `Discount: -₹${discount.toFixed(2)}`;
    elements.discountDisplay.style.display = 'block';
  } else {
    elements.discountDisplay.textContent = '';
    elements.discountDisplay.style.display = 'none';
  }
  
  elements.totalItemsDisplay.textContent = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
  elements.totalAmountDisplay.textContent = `Total: ₹${total.toFixed(2)}`;
  
  elements.placeOrderBtn.disabled = !(
    AppState.selectedItems.length > 0 &&
    elements.customerName.value.trim() &&
    elements.phoneNumber.value.trim() && 
    (/^\d{10}$/.test(elements.phoneNumber.value)) &&
    (orderType !== 'Delivery' || (
      locationObj && 
      deliveryDistance && 
      deliveryDistance <= CONFIG.MAX_DELIVERY_DISTANCE &&
      subtotal >= CONFIG.MIN_DELIVERY_ORDER
    ))
  );
  
  if (elements.mobileLiveTotal) {
    elements.mobileLiveTotal.querySelector('.total-items').textContent = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
    elements.mobileLiveTotal.querySelector('.total-amount').textContent = `Total: ₹${total.toFixed(2)}`;
  }
}

/* ========== EVENT HANDLERS ========== */
function setupEventListeners() {
  // Order type toggle
  elements.orderTypeRadios.forEach(radio => {
    radio.addEventListener('change', handleOrderTypeChange);
  });
  
  // Location sharing
  elements.deliveryShareLocationBtn?.addEventListener('click', handleLocationSharing);
  
  // Manual location entry
  elements.deliveryShowManualLocBtn?.addEventListener('click', showManualLocationFields);
  
  // Place order button
  elements.placeOrderBtn?.addEventListener('click', confirmOrder);
  
  // Phone number validation
  elements.phoneNumber?.addEventListener('change', function() {
    if (this.value && this.value.length === 10) {
      localStorage.setItem('userPhone', sanitizeInput(this.value));
      requestNotificationPermission();
    }
  });
  
  // Clear cart button
  elements.clearCartBtn?.addEventListener('click', function() {
    if (AppState.selectedItems.length > 0 && confirm('Are you sure you want to clear your cart?')) {
      AppState.selectedItems = [];
      saveCartToStorage();
      updateCheckoutDisplay();
      showNotification('Cart cleared');
    }
  });
  
  // Item remove buttons
  elements.checkoutItemsList?.addEventListener('click', function(e) {
    if (e.target.closest('.checkout-item-remove')) {
      const index = e.target.closest('.checkout-item-remove').dataset.index;
      const item = AppState.selectedItems[index];
      AppState.selectedItems.splice(index, 1);
      saveCartToStorage();
      updateCheckoutDisplay();
      showNotification(`${sanitizeInput(item.name)} removed from cart`);
    }
  });
  
  // Modal buttons
  elements.confirmOrderBtn?.addEventListener('click', processOrderConfirmation);
  elements.cancelOrderBtn?.addEventListener('click', closeOrderModal);
  
  // Online/offline detection
  window.addEventListener('online', handleOnlineStatusChange);
  window.addEventListener('offline', handleOnlineStatusChange);
  
  // Address input for Nominatim search
  elements.manualDeliveryAddress?.addEventListener('input', debounce(handleAddressInput, 500));
  
  // Coupon code application
  elements.applyCouponBtn?.addEventListener('click', applyCoupon);
  elements.couponCode?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      applyCoupon();
    }
  });
  
  // Notification permission button
  elements.notificationPermissionBtn?.addEventListener('click', requestNotificationPermission);
}

function handleOrderTypeChange() {
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  
  if (orderType === 'Delivery') {
    elements.locationChoiceBlock.style.display = 'block';
    elements.deliveryChargeDisplay.style.display = 'block';
    elements.distanceText.style.display = 'block';
    
    if (usingManualLoc) {
      elements.manualLocationFields.style.display = 'block';
    }
    
    if (locationObj) {
      calculateDeliveryDetails();
    }
  } else {
    elements.locationChoiceBlock.style.display = 'none';
    elements.manualLocationFields.style.display = 'none';
    elements.deliveryChargeDisplay.style.display = 'none';
    elements.distanceText.style.display = 'none';
    elements.deliveryChargeDisplay.textContent = '';
    elements.distanceText.textContent = '';
  }
  
  updateCheckoutDisplay();
}

function handleLocationSharing() {
  if (!navigator.geolocation) {
    showNotification('Geolocation is not supported by your browser');
    return;
  }
  
  showLoading(true, 'Getting your location...');
  elements.currentLocStatusMsg.textContent = 'Getting your location...';
  
  if (watchPositionId) {
    navigator.geolocation.clearWatch(watchPositionId);
  }
  
  watchPositionId = navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      locationObj = { lat, lng };
      usingManualLoc = false;
      
      map.setView([lat, lng], 17);
      marker.setLatLng([lat, lng]);
      
      calculateDeliveryDetails();
      
      elements.currentLocStatusMsg.textContent = 'Location shared successfully!';
      showLoading(false);
    },
    (error) => {
      console.error('Geolocation error:', error);
      elements.currentLocStatusMsg.textContent = 'Error getting location. Please try again or enter manually.';
      showLoading(false);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function showManualLocationFields() {
  usingManualLoc = true;
  elements.manualLocationFields.style.display = 'block';
  elements.currentLocStatusMsg.textContent = 'Enter your address below';
  
  if (!map) {
    initMap();
  }
}

async function handleAddressInput() {
  const query = elements.manualDeliveryAddress.value.trim();
  if (query.length < 3) return;

  try {
    showLoading(true, 'Searching for address...');
    
    const response = await fetch(
      `${CONFIG.NOMINATIM_ENDPOINT}?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`
    );
    
    if (!response.ok) {
      throw new Error(`Nominatim API responded with status ${response.status}`);
    }
    
    const results = await response.json();
    if (results.length === 0) {
      showLoading(false);
      showNotification('No locations found');
      return;
    }
    
    const firstResult = results[0];
    const location = {
      lat: parseFloat(firstResult.lat),
      lng: parseFloat(firstResult.lon)
    };
    
    map.setView([location.lat, location.lng], 17);
    marker.setLatLng([location.lat, location.lng]);
    
    locationObj = { lat: location.lat, lng: location.lng };
    
    if (firstResult.display_name) {
      elements.manualDeliveryAddress.value = firstResult.display_name;
    }
    
    calculateDeliveryDetails();
    
    showNotification('Location found!');
    showLoading(false);
  } catch (error) {
    console.error("Error in Nominatim API call:", error);
    showLoading(false);
    showNotification('Error finding location. Please try again.');
  }
}

async function calculateRoadDistance(originLat, originLng, destLat, destLng) {
  const cacheKey = `${originLat},${originLng},${destLat},${destLng}`;
  
  if (distanceCalculationCache[cacheKey]) {
    return distanceCalculationCache[cacheKey];
  }
  
  try {
    const distance = await Promise.race([
      calculateRoadDistanceFromAPI(originLat, originLng, destLat, destLng),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error('Distance calculation timeout')),
        CONFIG.FALLBACK_DISTANCE_CALCULATION_TIMEOUT
      ))
    ]);
    
    distanceCalculationCache[cacheKey] = distance;
    return distance;
  } catch (error) {
    console.error("Error calculating road distance:", error);
    return calculateHaversineDistance(originLat, originLng, destLat, destLng);
  }
}

async function calculateRoadDistanceFromAPI(originLat, originLng, destLat, destLng) {
  try {
    const response = await fetch(
      `${CONFIG.OPENROUTE_SERVICE_ENDPOINT}?api_key=${CONFIG.OPENROUTE_SERVICE_API_KEY}&start=${originLng},${originLat}&end=${destLng},${destLat}`
    );
    
    if (!response.ok) {
      throw new Error(`OpenRouteService API responded with status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.routes?.length > 0) {
      return data.routes[0].summary.distance / 1000;
    } else {
      throw new Error('No routes found in OpenRouteService response');
    }
  } catch (error) {
    console.error("Error in OpenRouteService API call:", error);
    throw error;
  }
}

function applyCoupon() {
  const code = elements.couponCode.value.trim().toUpperCase();
  
  if (!code) {
    elements.couponMessage.textContent = 'Please enter a coupon code';
    elements.couponMessage.className = 'coupon-message error';
    return;
  }
  
  if (!CONFIG.VALID_COUPONS[code]) {
    elements.couponMessage.textContent = 'Invalid coupon code';
    elements.couponMessage.className = 'coupon-message error';
    return;
  }
  
  const subtotal = AppState.selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  if (subtotal < CONFIG.VALID_COUPONS[code].minOrder) {
    elements.couponMessage.textContent = `Minimum order of ₹${CONFIG.VALID_COUPONS[code].minOrder} required for this coupon`;
    elements.couponMessage.className = 'coupon-message error';
    return;
  }
  
  appliedCoupon = CONFIG.VALID_COUPONS[code];
  elements.couponMessage.textContent = 'Coupon applied successfully!';
  elements.couponMessage.className = 'coupon-message success';
  
  updateCheckoutDisplay();
}

function handleOnlineStatusChange() {
  if (navigator.onLine) {
    processOfflineOrdersQueue();
  }
  updateCheckoutDisplay();
}

function showLoading(show, message = '') {
  if (elements.loadingIndicator) {
    elements.loadingIndicator.style.display = show ? 'flex' : 'none';
  }
  if (elements.loadingMessage && message) {
    elements.loadingMessage.textContent = message;
  }
}

function showNotification(message, duration = 3000) {
  if (!elements.notification || !elements.notificationText) return;
  
  elements.notificationText.textContent = message;
  elements.notification.style.display = 'block';
  elements.notification.setAttribute('aria-hidden', 'false');
  
  setTimeout(() => {
    elements.notification.style.display = 'none';
    elements.notification.setAttribute('aria-hidden', 'true');
  }, duration);
}

function sanitizeInput(input) {
  if (!input) return '';
  return input.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Cleanup event listeners when page unloads
window.addEventListener('beforeunload', function() {
  if (watchPositionId) navigator.geolocation.clearWatch(watchPositionId);
  window.removeEventListener('online', handleOnlineStatusChange);
  window.removeEventListener('offline', handleOnlineStatusChange);
});