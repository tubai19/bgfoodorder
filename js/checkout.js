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
  OSRM_ENDPOINT: 'https://router.project-osrm.org/route/v1/driving',
  MAX_ORDER_HISTORY: 50,
  MAP_TILE_PROVIDER: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  MAP_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  FALLBACK_DISTANCE_CALCULATION_TIMEOUT: 3000
};

// Checkout page variables
let map;
let marker;
let locationObj = null;
let usingManualLoc = false;
let deliveryDistance = null;
let modalRating = 0;
let watchPositionId = null;
let addressAutocomplete = null;
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
const deliveryDistanceDisplay = document.getElementById('deliveryDistanceDisplay');
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

// Initialize the checkout page
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('checkout.html')) {
    // Initialize the app
    initApp();
    
    // Load cart from storage
    updateCheckoutDisplay();
    
    // Load any queued offline orders
    loadOfflineOrdersQueue();
    
    // Set up order type toggle
    orderTypeRadios.forEach(radio => {
      radio.addEventListener('change', handleOrderTypeChange);
    });
    
    // Set up location sharing
    if (deliveryShareLocationBtn) {
      deliveryShareLocationBtn.addEventListener('click', handleLocationSharing);
    }
    
    // Set up manual location entry
    if (deliveryShowManualLocBtn) {
      deliveryShowManualLocBtn.addEventListener('click', showManualLocationFields);
    }
    
    // Set up place order button
    if (placeOrderBtn) {
      placeOrderBtn.addEventListener('click', confirmOrder);
    }
    
    // Request notification permission when phone number is entered
    if (phoneNumber) {
      phoneNumber.addEventListener('change', function() {
        if (this.value && this.value.length === 10) {
          localStorage.setItem('userPhone', sanitizeInput(this.value));
          requestNotificationPermission();
        }
      });
    }
    
    // Set up clear cart button
    if (clearCartBtn) {
      clearCartBtn.addEventListener('click', function() {
        if (AppState.selectedItems.length > 0 && confirm('Are you sure you want to clear your cart?')) {
          AppState.selectedItems = [];
          saveCartToStorage();
          updateCheckoutDisplay();
          showNotification('Cart cleared');
        }
      });
    }
    
    // Set up item remove buttons
    if (checkoutItemsList) {
      checkoutItemsList.addEventListener('click', function(e) {
        if (e.target.closest('.checkout-item-remove')) {
          const index = e.target.closest('.checkout-item-remove').dataset.index;
          const item = AppState.selectedItems[index];
          AppState.selectedItems.splice(index, 1);
          saveCartToStorage();
          updateCheckoutDisplay();
          showNotification(`${sanitizeInput(item.name)} removed from cart`);
        }
      });
    }
    
    // Initial state
    handleOrderTypeChange();
    
    // Set up online/offline detection
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
  }
});

// Handle online/offline status changes
function handleOnlineStatusChange() {
  if (navigator.onLine) {
    processOfflineOrdersQueue();
  }
  updateCheckoutDisplay();
}

// Sanitize input to prevent XSS
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Load offline orders queue from localStorage
function loadOfflineOrdersQueue() {
  try {
    const queue = JSON.parse(localStorage.getItem('offlineOrdersQueue') || '[]');
    offlineOrderQueue = Array.isArray(queue) ? queue : [];
  } catch (error) {
    console.error('Error loading offline orders queue:', error);
    offlineOrderQueue = [];
  }
}

// Process any queued offline orders
async function processOfflineOrdersQueue() {
  if (isProcessingOfflineQueue || offlineOrderQueue.length === 0) return;
  
  isProcessingOfflineQueue = true;
  showLoading(true, 'Submitting queued orders...');
  
  try {
    while (offlineOrderQueue.length > 0) {
      const orderData = offlineOrderQueue[0];
      try {
        const docRef = await addDoc(collection(db, 'orders'), orderData);
        orderData.id = docRef.id;
        saveOrderToHistory(orderData);
        offlineOrderQueue.shift();
        
        // Update localStorage
        localStorage.setItem('offlineOrdersQueue', JSON.stringify(offlineOrderQueue));
        
        showNotification(`Queued order submitted successfully!`);
      } catch (error) {
        console.error('Error submitting queued order:', error);
        break; // Stop processing if we hit an error
      }
    }
  } finally {
    isProcessingOfflineQueue = false;
    showLoading(false);
  }
}

// Show/hide loading indicator
function showLoading(show, message = '') {
  if (!loadingIndicator) return;
  
  if (show) {
    loadingIndicator.style.display = 'flex';
    if (message) {
      document.getElementById('loadingMessage').textContent = message;
    }
  } else {
    loadingIndicator.style.display = 'none';
  }
}

// Handle order type change
function handleOrderTypeChange() {
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  
  showOrHideLocationBlock();
  
  if (orderType === 'Delivery') {
    // Automatically request location when delivery is selected
    handleLocationSharing();
    
    // Start watching position if not already doing so
    if (!watchPositionId && navigator.geolocation) {
      startWatchingPosition();
    }
  } else {
    // Clean up location watcher if pickup is selected
    if (watchPositionId) {
      navigator.geolocation.clearWatch(watchPositionId);
      watchPositionId = null;
    }
    if (currentLocStatusMsg) {
      currentLocStatusMsg.textContent = '';
    }
  }
}

// Request notification permission
function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return;
  }
  
  if (Notification.permission === 'granted') {
    return;
  }
  
  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('Notification permission granted');
        showNotification('Thank you! You will receive order updates.');
      }
    });
  }
}

// Update checkout display with cart contents
function updateCheckoutDisplay() {
  const itemCount = AppState.selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = AppState.selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let deliveryCharge = 0;
  
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  if (orderType === 'Delivery' && locationObj && deliveryDistance) {
    deliveryCharge = calculateDeliveryChargeByDistance(deliveryDistance);
    if (subtotal >= 500) deliveryCharge = 0;
  }
  
  const total = subtotal + deliveryCharge;
  
  // Update item count display
  if (totalItemsDisplay) {
    const itemsText = itemCount === 1 ? '1 item' : `${itemCount} items`;
    totalItemsDisplay.textContent = itemsText;
  }
  
  // Update total amount display
  if (totalAmountDisplay) {
    totalAmountDisplay.textContent = `₹${total}`;
  }
  
  // Update mobile live total display
  if (mobileLiveTotal) {
    mobileLiveTotal.innerHTML = `
      <span class="total-items">${itemCount === 1 ? '1 item' : `${itemCount} items`}</span>
      <span class="total-amount">Total: ₹${total}</span>
    `;
  }
  
  // Update checkout items list
  if (checkoutItemsList) {
    checkoutItemsList.innerHTML = '';
    
    if (AppState.selectedItems.length === 0) {
      checkoutItemsList.innerHTML = '<li class="empty-cart">Your cart is empty</li>';
    } else {
      AppState.selectedItems.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'checkout-item';
        li.innerHTML = `
          <span class="checkout-item-name">${sanitizeInput(item.name)} (${sanitizeInput(item.variant)})</span>
          <div class="checkout-item-details">
            <span class="checkout-item-quantity">x${item.quantity}</span>
            <span class="checkout-item-price">₹${item.price * item.quantity}</span>
            <button class="checkout-item-remove" data-index="${index}" aria-label="Remove item">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `;
        checkoutItemsList.appendChild(li);
      });
    }
  }
  
  if (deliveryChargeDisplay) {
    if (orderType === 'Delivery') {
      if (deliveryDistance) {
        if (deliveryDistance > AppState.MAX_DELIVERY_DISTANCE) {
          deliveryChargeDisplay.textContent = `⚠️ Delivery not available (${deliveryDistance.toFixed(1)}km beyond ${AppState.MAX_DELIVERY_DISTANCE}km limit)`;
          deliveryChargeDisplay.style.color = 'var(--error-color)';
        } else {
          const chargeText = deliveryCharge === 0 ? 'Free delivery' : `Delivery charge: ₹${deliveryCharge}`;
          deliveryChargeDisplay.textContent = `${chargeText} | Distance: ${deliveryDistance.toFixed(1)}km`;
          deliveryChargeDisplay.style.color = 'var(--success-color)';
        }
      } else {
        deliveryChargeDisplay.textContent = 'Delivery charge will be calculated';
        deliveryChargeDisplay.style.color = 'var(--text-color)';
      }
      deliveryChargeDisplay.style.display = 'block';
    } else {
      deliveryChargeDisplay.style.display = 'none';
    }
  }
  
  // Disable place order button if cart is empty
  if (placeOrderBtn) {
    placeOrderBtn.disabled = AppState.selectedItems.length === 0;
  }
}

// Show/hide location block based on order type
function showOrHideLocationBlock() {
  if (!locationChoiceBlock) return;
  
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  if (orderType === 'Delivery') {
    locationChoiceBlock.style.display = 'block';
    if (deliveryDistanceDisplay) {
      deliveryDistanceDisplay.style.display = deliveryDistance ? 'block' : 'none';
    }
  } else {
    locationChoiceBlock.style.display = 'none';
    if (deliveryDistanceDisplay) {
      deliveryDistanceDisplay.style.display = 'none';
    }
  }
  updateCheckoutDisplay();
}

// Start watching position continuously
function startWatchingPosition() {
  if (!navigator.geolocation) return;
  
  watchPositionId = navigator.geolocation.watchPosition(
    (pos) => {
      // Only update if we're not using manual location
      if (!usingManualLoc) {
        locationObj = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (currentLocStatusMsg) {
          currentLocStatusMsg.style.color = "#2a9d8f";
          currentLocStatusMsg.textContent = `Live location tracking active`;
        }
        
        calculateRoadDistance(pos.coords.latitude, pos.coords.longitude, 
          AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng)
          .then(distance => {
            deliveryDistance = distance;
            if (distanceText) {
              distanceText.textContent = `Distance: ${distance.toFixed(1)} km`;
            }
            updateCheckoutDisplay();
          });
      }
    },
    (err) => {
      if (currentLocStatusMsg) {
        currentLocStatusMsg.style.color = "#e63946";
        currentLocStatusMsg.textContent = "Live location paused. Please ensure location access is enabled.";
      }
    },
    { 
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 5000
    }
  );
}

// Handle location sharing
function handleLocationSharing() {
  if (!navigator.geolocation) {
    if (currentLocStatusMsg) {
      currentLocStatusMsg.style.color = "#e63946";
      currentLocStatusMsg.textContent = "Geolocation is not supported by your browser. Please enter address manually.";
    }
    if (deliveryShowManualLocBtn) {
      deliveryShowManualLocBtn.style.display = 'block';
    }
    showManualLocationFields();
    return;
  }
  
  // Hide manual location if it was shown
  usingManualLoc = false;
  if (manualLocationFields) {
    manualLocationFields.style.display = 'none';
  }
  
  if (currentLocStatusMsg) {
    currentLocStatusMsg.style.color = "#333";
    currentLocStatusMsg.textContent = "Detecting your current location...";
  }
  if (distanceText) {
    distanceText.textContent = "Distance: Calculating...";
  }
  if (deliveryDistanceDisplay) {
    deliveryDistanceDisplay.style.display = 'block';
  }
  
  // Get immediate position first
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locationObj = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (currentLocStatusMsg) {
        currentLocStatusMsg.style.color = "#2a9d8f";
        currentLocStatusMsg.textContent = `Live location tracking active`;
      }
      if (deliveryShowManualLocBtn) {
        deliveryShowManualLocBtn.style.display = 'block';
      }
      
      // Calculate distance
      calculateRoadDistance(pos.coords.latitude, pos.coords.longitude, 
        AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng)
        .then(distance => {
          deliveryDistance = distance;
          if (distanceText) {
            distanceText.textContent = `Distance: ${distance.toFixed(1)} km`;
          }
          updateCheckoutDisplay();
        });
      
      // Start continuous watching if not already
      if (!watchPositionId) {
        startWatchingPosition();
      }
    },
    (err) => {
      if (currentLocStatusMsg) {
        currentLocStatusMsg.style.color = "#e63946";
        currentLocStatusMsg.textContent = "Unable to get your location. Please allow location access or enter manually.";
      }
      if (deliveryShowManualLocBtn) {
        deliveryShowManualLocBtn.style.display = 'block';
      }
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// Show manual location fields with enhanced UI
function showManualLocationFields() {
  usingManualLoc = true;
  if (manualLocationFields) {
    manualLocationFields.style.display = 'block';
  }
  if (currentLocStatusMsg) {
    currentLocStatusMsg.textContent = 'Using manual location entry';
    currentLocStatusMsg.style.color = '#333';
  }
  if (distanceText) {
    distanceText.textContent = "Distance: Calculating...";
  }
  if (deliveryDistanceDisplay) {
    deliveryDistanceDisplay.style.display = 'block';
  }
  
  // Stop live location tracking
  if (watchPositionId) {
    navigator.geolocation.clearWatch(watchPositionId);
    watchPositionId = null;
  }
  
  // Initialize map if not already done
  if (!map) {
    initMap();
  } else {
    // Reset map view
    map.setView([AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng], 14);
    if (marker) {
      marker.setLatLng([AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng]);
    }
  }
  
  // Initialize address autocomplete if Google Maps API is available
  if (window.google && window.google.maps) {
    initAddressAutocomplete();
  } else {
    console.warn('Google Maps API not loaded. Address autocomplete will not work.');
  }
  
  // Focus on address field
  if (manualDeliveryAddress) manualDeliveryAddress.focus();
}

// Initialize address autocomplete
function initAddressAutocomplete() {
  if (!manualDeliveryAddress || !window.google) return;
  
  // Clear previous autocomplete if any
  if (addressAutocomplete) {
    google.maps.event.clearInstanceListeners(manualDeliveryAddress);
  }
  
  addressAutocomplete = new google.maps.places.Autocomplete(manualDeliveryAddress, {
    types: ['geocode'],
    componentRestrictions: { country: 'in' },
    fields: ['address_components', 'geometry', 'name']
  });
  
  addressAutocomplete.addListener('place_changed', () => {
    const place = addressAutocomplete.getPlace();
    if (!place.geometry) {
      showNotification('Location not found. Please try again.');
      return;
    }
    
    const location = place.geometry.location;
    map.setView([location.lat(), location.lng()], 17);
    if (marker) {
      marker.setLatLng([location.lat(), location.lng()]);
    }
    
    locationObj = { lat: location.lat(), lng: location.lng() };
    updateLocationFromMarker();
    
    showNotification('Location found!');
  });
}

// Initialize map
function initMap() {
  try {
    if (!L) {
      throw new Error('Leaflet not loaded');
    }
    
    map = L.map('addressMap').setView([AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng], 14);

    L.tileLayer(CONFIG.MAP_TILE_PROVIDER, {
      attribution: CONFIG.MAP_ATTRIBUTION
    }).addTo(map);

    // Restaurant marker
    L.marker([AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng], {
      icon: L.divIcon({
        html: '<i class="fas fa-store" style="color: #e63946; font-size: 24px;"></i>',
        className: 'restaurant-marker'
      })
    }).addTo(map).bindPopup("Bake & Grill");

    // Customer marker
    marker = L.marker([AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng], {
      draggable: true,
      autoPan: true,
      icon: L.divIcon({
        html: '<i class="fas fa-map-marker-alt" style="color: #9d4edf; font-size: 32px;"></i>',
        className: 'customer-marker'
      })
    }).addTo(map);

    // Update location when marker is moved
    marker.on('dragend', function() {
      updateLocationFromMarker();
    });

    // Update location when map is clicked
    map.on('click', function(e) {
      marker.setLatLng(e.latlng);
      updateLocationFromMarker();
    });
  } catch (error) {
    console.error('Error initializing map:', error);
    if (manualLocationFields) {
      manualLocationFields.style.display = 'block';
    }
    if (document.getElementById('addressMap')) {
      document.getElementById('addressMap').style.display = 'none';
    }
    showNotification('Map initialization failed. Please enter address manually.');
  }
}

// Update location from marker
function updateLocationFromMarker() {
  const position = marker.getLatLng();
  locationObj = { lat: position.lat, lng: position.lng };
  
  if (distanceText) {
    distanceText.textContent = "Distance: Calculating...";
  }
  if (deliveryDistanceDisplay) {
    deliveryDistanceDisplay.style.display = 'block';
  }
  
  calculateRoadDistance(position.lat, position.lng, AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng)
    .then(distance => {
      deliveryDistance = distance;
      if (distanceText) {
        distanceText.textContent = `Distance: ${distance.toFixed(1)} km`;
      }
      updateCheckoutDisplay();
    })
    .catch(error => {
      console.error("Error calculating distance:", error);
      deliveryDistance = calculateHaversineDistance(position.lat, position.lng, AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng);
      if (distanceText) {
        distanceText.textContent = `Distance: ${deliveryDistance.toFixed(1)} km (straight line)`;
      }
      updateCheckoutDisplay();
    });
}

// Calculate road distance using OSRM API with caching and fallback
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

// Actual API call to OSRM
async function calculateRoadDistanceFromAPI(originLat, originLng, destLat, destLng) {
  try {
    const response = await fetch(
      `${CONFIG.OSRM_ENDPOINT}/${originLng},${originLat};${destLng},${destLat}?overview=false`
    );
    
    if (!response.ok) {
      throw new Error(`OSRM API responded with status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].distance / 1000;
    } else {
      throw new Error('No routes found in OSRM response');
    }
  } catch (error) {
    console.error("Error in OSRM API call:", error);
    throw error; // Re-throw to be caught by the calling function
  }
}

// Save order to offline queue
async function saveOrderToOfflineQueue(orderData) {
  try {
    // Add to in-memory queue
    offlineOrderQueue.push({
      ...orderData,
      isOffline: true,
      timestamp: new Date().getTime()
    });
    
    // Save to localStorage
    localStorage.setItem('offlineOrdersQueue', JSON.stringify(offlineOrderQueue));
    
    return true;
  } catch (error) {
    console.error('Error saving to offline queue:', error);
    return false;
  }
}

// Prepare order data for submission
async function prepareOrderData() {
  const name = sanitizeInput(customerName.value.trim());
  const phone = sanitizeInput(phoneNumber.value.trim());
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  const subtotal = AppState.selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
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
      document.getElementById('locationChoiceBlock').scrollIntoView({ behavior: 'smooth' });
      return null;
    }
    
    if (usingManualLoc && !manualDeliveryAddress.value.trim()) {
      alert("Please enter your complete delivery address.");
      manualDeliveryAddress.focus();
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
    const result = calculateDeliveryChargeByDistance(deliveryDistance);
    deliveryCharge = subtotal >= 500 ? 0 : (result || 0);
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
        // Clear cart only if save was successful
        AppState.selectedItems.length = 0;
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
  const modal = document.getElementById('orderConfirmationModal');
  const orderSummary = document.getElementById('orderConfirmationSummary');
  
  if (!modal || !orderSummary) return;
  
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
  
  orderSummary.innerHTML = summaryHTML;
  
  // Set focus on modal for accessibility
  modal.style.display = 'block';
  modal.setAttribute('aria-hidden', 'false');
  document.getElementById('confirmOrderBtn').focus();
  
  // Set up event listeners
  document.getElementById('confirmOrderBtn').onclick = async function() {
    try {
      showLoading(true, 'Placing your order...');
      const docRef = await addDoc(collection(db, 'orders'), orderData);
      orderData.id = docRef.id;
      saveOrderToHistory(orderData);
      sendWhatsAppOrder(orderData);
      
      AppState.selectedItems.length = 0;
      saveCartToStorage();
      
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      showLoading(false);
      showNotification('Order placed successfully!');
      
      // Reset form
      customerName.value = '';
      phoneNumber.value = '';
      locationObj = null;
      deliveryDistance = null;
      updateCheckoutDisplay();
    } catch (error) {
      showLoading(false);
      console.error("Error saving order:", error);
      alert("There was an error processing your order. Please try again.");
    }
  };
  
  document.getElementById('cancelOrderBtn').onclick = function() {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  };
  
  // Close modal when clicking outside
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  });
  
  // Close modal with ESC key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.style.display === 'block') {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  });
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
    
    // Add location link if coordinates are available
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

// Cleanup event listeners when page unloads
window.addEventListener('beforeunload', function() {
  if (watchPositionId) {
    navigator.geolocation.clearWatch(watchPositionId);
  }
  
  if (addressAutocomplete) {
    google.maps.event.clearInstanceListeners(manualDeliveryAddress);
  }
  
  window.removeEventListener('online', handleOnlineStatusChange);
  window.removeEventListener('offline', handleOnlineStatusChange);
});