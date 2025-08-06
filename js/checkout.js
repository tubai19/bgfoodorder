// Import necessary functions from main.js
import { 
  AppState,
  db,
  initApp,
  showNotification,
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
  OPENROUTE_SERVICE_API_KEY: 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6Ijg5OWE3ZmRmYzhkODRmYmE5MmEzOGU5MDEzMTEyYjIzIiwiaCI6Im11cm11cjY0In0', // Your OpenRouteService API key
  NOMINATIM_ENDPOINT: 'https://nominatim.openstreetmap.org/search',
  OPENROUTE_SERVICE_ENDPOINT: 'https://api.openrouteservice.org/v2/directions/driving-car',
  MAX_ORDER_HISTORY: 50,
  MAP_TILE_PROVIDER: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  MAP_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  FALLBACK_DISTANCE_CALCULATION_TIMEOUT: 3000,
  RESTAURANT_LOCATION: {
    lat: 22.3908, // Replace with your restaurant's latitude
    lng: 88.2189  // Replace with your restaurant's longitude
  }
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

// DOM elements
const placeOrderBtn = document.getElementById('placeOrderBtn');
const customerName = document.getElementById('customerName');
const phoneNumber = document.getElementById('phoneNumber');
const orderNotes = document.getElementById('orderNotes');
const mobileLiveTotal = document.getElementById('mobileLiveTotal');
const deliveryChargeDisplay = document.getElementById('deliveryChargeDisplay');
const distanceText = document.getElementById('distanceText');
const locationChoiceBlock = document.getElementById('locationChoiceBlock');
const deliveryShareLocationBtn = document.getElementById('deliveryShareLocationBtn');
const deliveryShowManualLocBtn = document.getElementById('deliveryShowManualLocBtn');
const currentLocStatusMsg = document.getElementById('currentLocStatusMsg');
const manualLocationFields = document.getElementById('manualLocationFields');
const manualDeliveryAddress = document.getElementById('manualDeliveryAddress');
const orderTypeRadios = document.querySelectorAll('input[name="orderType"]');
const totalItemsDisplay = document.getElementById('totalItems');
const totalAmountDisplay = document.getElementById('totalAmount');
const checkoutItemsList = document.getElementById('checkoutItemsList');
const clearCartBtn = document.getElementById('clearCartBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const loadingMessage = document.getElementById('loadingMessage');
const orderConfirmationModal = document.getElementById('orderConfirmationModal');
const orderConfirmationSummary = document.getElementById('orderConfirmationSummary');
const confirmOrderBtn = document.getElementById('confirmOrderBtn');
const cancelOrderBtn = document.getElementById('cancelOrderBtn');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notificationText');
const addressMap = document.getElementById('addressMap');

// Initialize the checkout page
document.addEventListener('DOMContentLoaded', async function() {
  try {
    await initApp();
    setupEventListeners();
    updateCheckoutDisplay();
    loadOfflineOrdersQueue();
    handleOrderTypeChange();
    initMap();
  } catch (error) {
    console.error('Initialization error:', error);
    showNotification('Failed to initialize. Please refresh the page.');
  }
});

// Initialize Leaflet map
function initMap() {
  if (!addressMap) return;

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

  marker.on('dragend', function() {
    updateLocationFromMarker();
  });

  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    updateLocationFromMarker();
  });
}

// Update location from marker position
function updateLocationFromMarker() {
  if (!marker) return;
  
  const latlng = marker.getLatLng();
  locationObj = { lat: latlng.lat, lng: latlng.lng };
  calculateDeliveryDetails();
}

// Calculate delivery distance and charges
async function calculateDeliveryDetails() {
  if (!locationObj) return;

  try {
    showLoading(true, 'Calculating distance...');
    
    // Calculate road distance with fallback to haversine
    deliveryDistance = await calculateRoadDistance(
      CONFIG.RESTAURANT_LOCATION.lat,
      CONFIG.RESTAURANT_LOCATION.lng,
      locationObj.lat,
      locationObj.lng
    );

    const deliveryCharge = calculateDeliveryChargeByDistance(deliveryDistance);
    
    // Update UI
    distanceText.textContent = `${deliveryDistance.toFixed(1)} km from restaurant`;
    deliveryChargeDisplay.textContent = `Delivery Charge: ₹${deliveryCharge}`;
    
    // Enable place order button if all conditions are met
    placeOrderBtn.disabled = false;
    
    showLoading(false);
  } catch (error) {
    console.error('Error calculating delivery details:', error);
    showLoading(false);
    showNotification('Error calculating distance. Please try again.');
  }
}

function setupEventListeners() {
  // Order type toggle
  orderTypeRadios.forEach(radio => {
    radio.addEventListener('change', handleOrderTypeChange);
  });
  
  // Location sharing
  deliveryShareLocationBtn?.addEventListener('click', handleLocationSharing);
  
  // Manual location entry
  deliveryShowManualLocBtn?.addEventListener('click', showManualLocationFields);
  
  // Place order button
  placeOrderBtn?.addEventListener('click', confirmOrder);
  
  // Phone number validation
  phoneNumber?.addEventListener('change', function() {
    if (this.value && this.value.length === 10) {
      localStorage.setItem('userPhone', sanitizeInput(this.value));
      requestNotificationPermission();
    }
  });
  
  // Clear cart button
  clearCartBtn?.addEventListener('click', function() {
    if (AppState.selectedItems.length > 0 && confirm('Are you sure you want to clear your cart?')) {
      AppState.selectedItems = [];
      saveCartToStorage();
      updateCheckoutDisplay();
      showNotification('Cart cleared');
    }
  });
  
  // Item remove buttons
  checkoutItemsList?.addEventListener('click', function(e) {
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
  confirmOrderBtn?.addEventListener('click', processOrderConfirmation);
  cancelOrderBtn?.addEventListener('click', closeOrderModal);
  
  // Online/offline detection
  window.addEventListener('online', handleOnlineStatusChange);
  window.addEventListener('offline', handleOnlineStatusChange);
  
  // Address input for Nominatim search
  manualDeliveryAddress?.addEventListener('input', debounce(handleAddressInput, 500));
}

// Handle order type change (Delivery/Pickup)
function handleOrderTypeChange() {
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  
  if (orderType === 'Delivery') {
    locationChoiceBlock.style.display = 'block';
    deliveryChargeDisplay.style.display = 'block';
    distanceText.style.display = 'block';
    
    // Initialize manual location fields if needed
    if (usingManualLoc) {
      manualLocationFields.style.display = 'block';
    }
    
    // Update delivery info if location is already set
    if (locationObj) {
      calculateDeliveryDetails();
    }
  } else {
    locationChoiceBlock.style.display = 'none';
    manualLocationFields.style.display = 'none';
    deliveryChargeDisplay.style.display = 'none';
    distanceText.style.display = 'none';
    deliveryChargeDisplay.textContent = '';
    distanceText.textContent = '';
  }
  
  updateCheckoutDisplay();
}

// Handle location sharing
function handleLocationSharing() {
  if (!navigator.geolocation) {
    showNotification('Geolocation is not supported by your browser');
    return;
  }
  
  showLoading(true, 'Getting your location...');
  currentLocStatusMsg.textContent = 'Getting your location...';
  
  // Stop any previous watch
  if (watchPositionId) {
    navigator.geolocation.clearWatch(watchPositionId);
  }
  
  watchPositionId = navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      locationObj = { lat, lng };
      usingManualLoc = false;
      
      // Update map and marker
      map.setView([lat, lng], 17);
      marker.setLatLng([lat, lng]);
      
      // Calculate distance
      calculateDeliveryDetails();
      
      currentLocStatusMsg.textContent = 'Location shared successfully!';
      showLoading(false);
    },
    (error) => {
      console.error('Geolocation error:', error);
      currentLocStatusMsg.textContent = 'Error getting location. Please try again or enter manually.';
      showLoading(false);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// Show manual location fields
function showManualLocationFields() {
  usingManualLoc = true;
  manualLocationFields.style.display = 'block';
  currentLocStatusMsg.textContent = 'Enter your address below';
  
  // Initialize map if not already done
  if (!map) {
    initMap();
  }
}

// Handle address input with Nominatim
async function handleAddressInput() {
  const query = manualDeliveryAddress.value.trim();
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
    
    // Take the first result
    const firstResult = results[0];
    const location = {
      lat: parseFloat(firstResult.lat),
      lng: parseFloat(firstResult.lon)
    };
    
    // Update map and marker
    map.setView([location.lat, location.lng], 17);
    marker.setLatLng([location.lat, location.lng]);
    
    locationObj = { lat: location.lat, lng: location.lng };
    
    // Update address field with full formatted address if available
    if (firstResult.display_name) {
      manualDeliveryAddress.value = firstResult.display_name;
    }
    
    // Calculate distance
    calculateDeliveryDetails();
    
    showNotification('Location found!');
    showLoading(false);
  } catch (error) {
    console.error("Error in Nominatim API call:", error);
    showLoading(false);
    showNotification('Error finding location. Please try again.');
  }
}

// Calculate road distance using OpenRouteService API with caching and fallback
async function calculateRoadDistance(originLat, originLng, destLat, destLng) {
  const cacheKey = `${originLat},${originLng},${destLat},${destLng}`;
  
  // Check cache first
  if (distanceCalculationCache[cacheKey]) {
    return distanceCalculationCache[cacheKey];
  }
  
  // Use Promise.race to implement timeout
  try {
    const distance = await Promise.race([
      calculateRoadDistanceFromAPI(originLat, originLng, destLat, destLng),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error('Distance calculation timeout')),
        CONFIG.FALLBACK_DISTANCE_CALCULATION_TIMEOUT
      ))
    ]);
    
    // Cache the result
    distanceCalculationCache[cacheKey] = distance;
    return distance;
  } catch (error) {
    console.error("Error calculating road distance:", error);
    // Fallback to haversine distance
    return calculateHaversineDistance(originLat, originLng, destLat, destLng);
  }
}

// Actual API call to OpenRouteService
async function calculateRoadDistanceFromAPI(originLat, originLng, destLat, destLng) {
  try {
    const response = await fetch(
      `${CONFIG.OPENROUTE_SERVICE_ENDPOINT}?api_key=${CONFIG.OPENROUTE_SERVICE_API_KEY}&start=${originLng},${originLat}&end=${destLng},${destLat}`
    );
    
    if (!response.ok) {
      throw new Error(`OpenRouteService API responded with status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].summary.distance / 1000; // Convert meters to kilometers
    } else {
      throw new Error('No routes found in OpenRouteService response');
    }
  } catch (error) {
    console.error("Error in OpenRouteService API call:", error);
    throw error;
  }
}

// Update checkout display with cart items and totals
function updateCheckoutDisplay() {
  if (!checkoutItemsList || !totalItemsDisplay || !totalAmountDisplay) return;
  
  // Clear existing items
  checkoutItemsList.innerHTML = '';
  
  if (AppState.selectedItems.length === 0) {
    checkoutItemsList.innerHTML = '<li class="empty-cart">Your cart is empty</li>';
    totalItemsDisplay.textContent = '0 items';
    totalAmountDisplay.textContent = 'Total: ₹0';
    placeOrderBtn.disabled = true;
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
    checkoutItemsList.appendChild(li);
  });
  
  // Calculate totals
  const itemCount = AppState.selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = AppState.selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  let deliveryCharge = 0;
  if (document.querySelector('input[name="orderType"]:checked')?.value === 'Delivery' && deliveryDistance) {
    deliveryCharge = subtotal >= 500 ? 0 : calculateDeliveryChargeByDistance(deliveryDistance);
  }
  
  const total = subtotal + deliveryCharge;
  
  // Update display
  totalItemsDisplay.textContent = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
  totalAmountDisplay.textContent = `Total: ₹${total}`;
  
  // Enable/disable place order button based on conditions
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  placeOrderBtn.disabled = !(
    AppState.selectedItems.length > 0 &&
    customerName.value.trim() &&
    phoneNumber.value.trim() && 
    (/^\d{10}$/.test(phoneNumber.value)) &&
    (orderType !== 'Delivery' || (locationObj && deliveryDistance))
  );
  
  // Update mobile live total
  if (mobileLiveTotal) {
    mobileLiveTotal.querySelector('.total-items').textContent = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
    mobileLiveTotal.querySelector('.total-amount').textContent = `Total: ₹${total}`;
  }
}

// Show loading indicator
function showLoading(show, message = '') {
  if (!loadingIndicator || !loadingMessage) return;
  
  if (show) {
    loadingIndicator.style.display = 'flex';
    loadingMessage.textContent = message;
  } else {
    loadingIndicator.style.display = 'none';
    loadingMessage.textContent = '';
  }
}

// Prepare order data for submission
async function prepareOrderData() {
  const name = sanitizeInput(customerName.value.trim());
  const phone = sanitizeInput(phoneNumber.value.trim());
  const notes = sanitizeInput(orderNotes.value.trim());
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  const subtotal = AppState.selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Validation
  if (!orderType) {
    alert("Please select an order type (Delivery or Pickup).");
    return null;
  }

  if (orderType === 'Delivery' && subtotal < AppState.MIN_DELIVERY_ORDER) {
    alert(`Minimum order for delivery is ₹${AppState.MIN_DELIVERY_ORDER}. Please add more items or choose pickup.`);
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
      if (locationChoiceBlock) {
        locationChoiceBlock.scrollIntoView({ behavior: 'smooth' });
      }
      return null;
    }
    
    if (usingManualLoc && !manualDeliveryAddress.value.trim()) {
      alert("Please enter your complete delivery address.");
      if (manualDeliveryAddress) manualDeliveryAddress.focus();
      return null;
    }
    
    if (!deliveryDistance) {
      alert("We couldn't determine your distance from the restaurant. Please check your location and try again.");
      return null;
    }
    
    if (deliveryDistance > AppState.MAX_DELIVERY_DISTANCE) {
      alert(`Your location is ${deliveryDistance.toFixed(1)}km away (beyond our ${AppState.MAX_DELIVERY_DISTANCE}km delivery range). Please choose pickup or visit our restaurant.`);
      return null;
    }
  }

  let deliveryCharge = 0;
  if (orderType === 'Delivery') {
    deliveryCharge = subtotal >= 500 ? 0 : calculateDeliveryChargeByDistance(deliveryDistance);
  }
  const total = subtotal + deliveryCharge;

  const orderData = {
    customerName: name,
    phoneNumber: phone,
    orderType: orderType,
    items: [...AppState.selectedItems],
    subtotal: subtotal,
    deliveryCharge: deliveryCharge,
    total: total,
    status: "Pending",
    timestamp: serverTimestamp(),
    notes: notes,
    isOffline: !navigator.onLine
  };

  if (orderType === 'Delivery') {
    if (usingManualLoc) {
      orderData.deliveryAddress = sanitizeInput(manualDeliveryAddress.value);
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

// Confirm order
async function confirmOrder() {
  try {
    // Add haptic feedback if available
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(50);
      } catch (vibrationError) {
        console.warn('Vibration API error:', vibrationError);
      }
    }
    
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
    
    // Check if offline
    if (!navigator.onLine) {
      const saved = await saveOrderToOfflineQueue(orderData);
      showLoading(false);
      
      if (saved) {
        showNotification('Order saved offline. Will submit when back online.');
        AppState.selectedItems = [];
        saveCartToStorage();
        updateCheckoutDisplay();
      } else {
        showNotification('Failed to save order offline. Please try again when online.');
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

// Show order confirmation modal
function showOrderConfirmationModal(orderData) {
  if (!orderConfirmationModal || !orderConfirmationSummary) return;
  
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
      <p class="grand-total"><strong>Total Amount:</strong> ₹${orderData.total}</p>
    </div>
  `;
  
  orderConfirmationSummary.innerHTML = summaryHTML;
  orderConfirmationModal.style.display = 'block';
  orderConfirmationModal.setAttribute('aria-hidden', 'false');
  
  if (confirmOrderBtn) confirmOrderBtn.focus();
}

// Process order confirmation
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
    customerName.value = '';
    phoneNumber.value = '';
    orderNotes.value = '';
    locationObj = null;
    deliveryDistance = null;
    
    closeOrderModal();
    showNotification('Order placed successfully!');
    
    // Send WhatsApp message
    sendWhatsAppOrder(orderData);
    
    // Save to history
    saveOrderToHistory(orderData);
    
    updateCheckoutDisplay();
  } catch (error) {
    console.error("Order error:", error);
    showNotification("Failed to place order. Please try again.");
  } finally {
    showLoading(false);
  }
}

// Close order modal
function closeOrderModal() {
  if (orderConfirmationModal) {
    orderConfirmationModal.style.display = 'none';
    orderConfirmationModal.setAttribute('aria-hidden', 'true');
  }
}

// Save order to offline queue
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

// Load offline orders queue
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

// Process offline orders queue when online
async function processOfflineOrdersQueue() {
  if (isProcessingOfflineQueue || offlineOrderQueue.length === 0) return;
  
  isProcessingOfflineQueue = true;
  showLoading(true, 'Submitting offline orders...');
  
  try {
    const successfulOrders = [];
    
    for (const order of offlineOrderQueue) {
      try {
        // Convert timestamp back to serverTimestamp if needed
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
    
    // Remove successfully submitted orders from queue
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

// Save order to history
function saveOrderToHistory(orderData) {
  try {
    const orders = JSON.parse(localStorage.getItem('bakeAndGrillOrders')) || [];
    orders.unshift({
      ...orderData,
      timestamp: orderData.timestamp?.toDate?.()?.toISOString?.() || new Date().toISOString()
    });
    
    // Limit history size
    if (orders.length > CONFIG.MAX_ORDER_HISTORY) {
      orders.length = CONFIG.MAX_ORDER_HISTORY;
    }
    
    localStorage.setItem('bakeAndGrillOrders', JSON.stringify(orders));
  } catch (error) {
    console.error('Error saving order to history:', error);
  }
}

// Send order via WhatsApp
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

// Generate WhatsApp message
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
  message += `*Total Amount:* ₹${orderData.total}\n\n`;
  message += `Please confirm this order. Thank you!`;
  
  return message;
}

// Check shop status
async function checkShopStatus() {
  try {
    const statusRef = doc(db, 'publicStatus', 'current');
    const docSnap = await getDoc(statusRef);
    return docSnap.exists() ? docSnap.data().isShopOpen !== false : true;
  } catch (error) {
    console.error("Error checking shop status:", error);
    return true; // Default to open if there's an error
  }
}

// Show notification
function showNotification(message) {
  if (!notification || !notificationText) return;
  
  notificationText.textContent = message;
  notification.style.display = 'flex';
  
  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

// Sanitize input to prevent XSS
function sanitizeInput(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Request notification permission
function requestNotificationPermission() {
  if ('Notification' in window) {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('Notification permission granted');
      }
    });
  }
}

// Handle online/offline status changes
function handleOnlineStatusChange() {
  if (navigator.onLine) {
    processOfflineOrdersQueue();
  }
  updateCheckoutDisplay();
}

// Cleanup event listeners when page unloads
window.addEventListener('beforeunload', function() {
  if (watchPositionId) {
    navigator.geolocation.clearWatch(watchPositionId);
  }
  
  window.removeEventListener('online', handleOnlineStatusChange);
  window.removeEventListener('offline', handleOnlineStatusChange);
});