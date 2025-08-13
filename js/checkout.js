import { 
  db, 
  cart, 
  saveCart, 
  updateCartCount, 
  showNotification, 
  formatPrice, 
  requestNotificationPermission,
  sendNotificationToUser,
  updateNotificationPreferences,
  getNotificationPreferences
} from './shared.js';

import { 
  collection, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Constants
const SHOP_LOCATION = { lat: 22.3908, lng: 88.2189 };
const DELIVERY_RADIUS = 8;
const DELIVERY_CHARGES = {
  under4km: 0,
  between4and6km: 20,
  between6and8km: 30
};
const DELIVERY_TIME_ESTIMATES = {
  under4km: '30-45 minutes',
  between4and6km: '45-60 minutes',
  between6and8km: '60-75 minutes',
  pickup: '20-30 minutes'
};
const MIN_DELIVERY_ORDER = 200;
const SHOP_PHONE = '918240266267';
const SHOP_NAME = 'Bake & Grill';
const SHOP_ADDRESS = 'Sanjua,Bakhrahat,West Bengal 743377';

// DOM Elements
const elements = {
  orderForm: document.getElementById('orderForm'),
  mobileLiveTotal: document.getElementById('mobileLiveTotal'),
  customerName: document.getElementById('customerName'),
  phoneNumber: document.getElementById('phoneNumber'),
  deliveryShareLocationBtn: document.getElementById('deliveryShareLocationBtn'),
  deliveryShowManualLocBtn: document.getElementById('deliveryShowManualLocBtn'),
  manualLocationFields: document.getElementById('manualLocationFields'),
  manualDeliveryAddress: document.getElementById('manualDeliveryAddress'),
  addressMap: document.getElementById('addressMap'),
  orderTypeRadios: document.querySelectorAll('input[name="orderType"]'),
  deliveryChargeDisplay: document.getElementById('deliveryChargeDisplay'),
  deliveryDistanceDisplay: document.getElementById('deliveryDistanceDisplay'),
  distanceText: document.getElementById('distanceText'),
  currentLocStatusMsg: document.getElementById('currentLocStatusMsg'),
  orderNotes: document.getElementById('orderNotes'),
  placeOrderBtn: document.getElementById('placeOrderBtn'),
  orderConfirmationModal: document.getElementById('orderConfirmationModal'),
  orderConfirmationSummary: document.getElementById('orderConfirmationSummary'),
  confirmOrderBtn: document.getElementById('confirmOrderBtn'),
  cancelOrderBtn: document.getElementById('cancelOrderBtn'),
  closeModal: document.querySelector('.close-modal'),
  orderHistoryList: document.getElementById('orderHistoryList'),
  paymentMethodRadios: document.querySelectorAll('input[name="paymentMethod"]'),
  deliveryTimeEstimate: document.getElementById('deliveryTimeEstimate'),
  timeEstimateText: document.getElementById('timeEstimateText'),
  notifyStatus: document.getElementById('notifyStatus'),
  notifyOffers: document.getElementById('notifyOffers')
};

// Variables
let map;
let marker;
let userLocation = null;
let deliveryDistance = null;
let deliveryCharge = 0;

// Helper Functions
function getDeliveryEstimate() {
  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  
  if (orderType === 'Pickup') {
    return DELIVERY_TIME_ESTIMATES.pickup;
  }

  if (!deliveryDistance) return 'Time estimate unavailable';

  if (deliveryDistance <= 4) {
    return DELIVERY_TIME_ESTIMATES.under4km;
  } else if (deliveryDistance <= 6) {
    return DELIVERY_TIME_ESTIMATES.between4and6km;
  } else {
    return DELIVERY_TIME_ESTIMATES.between6and8km;
  }
}

function updateDeliveryInfoDisplay() {
  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  
  if (orderType === 'Delivery') {
    elements.timeEstimateText.textContent = `Estimated delivery: ${getDeliveryEstimate()}`;
    elements.deliveryTimeEstimate.style.display = 'block';
  } else {
    elements.timeEstimateText.textContent = `Estimated pickup: ${getDeliveryEstimate()}`;
    elements.deliveryTimeEstimate.style.display = 'block';
  }
}

function generateOSMUrl(location) {
  if (!location) return 'Location not shared';
  return `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}` +
    `#map=16/${location.lat}/${location.lng}&layers=N`;
}

// Main Functions
async function saveOrderToFirestore() {
  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'Cash on Delivery';
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + deliveryCharge;
  const phoneNumber = elements.phoneNumber.value;

  try {
    const orderRef = await addDoc(collection(db, 'orders'), {
      customerName: elements.customerName.value,
      phoneNumber,
      orderType,
      paymentMethod,
      items: [...cart],
      subtotal,
      deliveryCharge: orderType === 'Delivery' ? deliveryCharge : 0,
      total,
      status: 'pending',
      timestamp: serverTimestamp(),
      notificationPreferences: {
        statusUpdates: elements.notifyStatus.checked,
        specialOffers: elements.notifyOffers.checked
      },
      ...(orderType === 'Delivery' && {
        deliveryAddress: elements.manualDeliveryAddress.value || 'Current location',
        deliveryDistance,
        estimatedTime: getDeliveryEstimate(),
        location: userLocation
      })
    });

    return orderRef.id;
  } catch (error) {
    console.error('Error saving order:', error);
    showNotification('Failed to save order. Please try again.', 'error');
    return null;
  }
}

// Checkout Initialisation
async function initCheckout() {
  if (!elements.orderForm) return;

  if (cart.length === 0) {
    showNotification('Your cart is empty. Redirecting to menu...');
    setTimeout(() => window.location.href = 'menu.html', 2000);
    return;
  }

  updateOrderTotal();
  setupEventListeners();
  loadOrderHistory();

  // Load notification preferences if phone number exists
  if (elements.phoneNumber.value) {
    const preferences = await getNotificationPreferences(elements.phoneNumber.value);
    elements.notifyStatus.checked = preferences.statusUpdates;
    elements.notifyOffers.checked = preferences.specialOffers;
  }
}

function updateOrderTotal() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  if (elements.mobileLiveTotal) {
    elements.mobileLiveTotal.textContent = `💰 Total Bill: ${formatPrice(subtotal)}`;
  }
}

function setupEventListeners() {
  elements.orderTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      handleOrderTypeChange();
      updateDeliveryInfoDisplay();
    });
  });

  if (elements.deliveryShareLocationBtn) {
    elements.deliveryShareLocationBtn.addEventListener('click', handleShareLocation);
  }

  if (elements.deliveryShowManualLocBtn) {
    elements.deliveryShowManualLocBtn.addEventListener('click', () => {
      elements.manualLocationFields.style.display = 'block';
      elements.deliveryShowManualLocBtn.style.display = 'none';
      initMap();
    });
  }

  if (elements.placeOrderBtn) {
    elements.placeOrderBtn.addEventListener('click', handlePlaceOrder);
  }

  if (elements.confirmOrderBtn) {
    elements.confirmOrderBtn.addEventListener('click', confirmOrder);
  }

  if (elements.cancelOrderBtn) {
    elements.cancelOrderBtn.addEventListener('click', () => {
      elements.orderConfirmationModal.style.display = 'none';
    });
  }

  if (elements.closeModal) {
    elements.closeModal.addEventListener('click', () => {
      elements.orderConfirmationModal.style.display = 'none';
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === elements.orderConfirmationModal) {
      elements.orderConfirmationModal.style.display = 'none';
    }
  });
}

// Order Type / Location
function handleOrderTypeChange() {
  const orderType = document.querySelector('input[name="orderType"]:checked').value;

  if (orderType === 'Pickup') {
    elements.deliveryDistanceDisplay.style.display = 'none';
    elements.deliveryChargeDisplay.textContent = '';
  } else {
    if (userLocation) {
      elements.deliveryDistanceDisplay.style.display = 'block';
      calculateDeliveryCharge();
    }
  }
  updateDeliveryInfoDisplay();
}

function handleShareLocation() {
  elements.currentLocStatusMsg.textContent = 'Getting your location...';
  elements.currentLocStatusMsg.style.color = '#333';

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        deliveryDistance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          SHOP_LOCATION.lat,
          SHOP_LOCATION.lng
        );

        if (deliveryDistance > DELIVERY_RADIUS) {
          elements.currentLocStatusMsg.textContent = 'Delivery not available to your location (beyond 8km). Please choose pickup.';
          elements.currentLocStatusMsg.style.color = 'red';
          document.querySelector('input[value="Delivery"]').disabled = true;
          document.querySelector('input[value="Pickup"]').checked = true;
          elements.deliveryDistanceDisplay.style.display = 'none';
        } else {
          elements.currentLocStatusMsg.textContent = 'Location found!';
          elements.currentLocStatusMsg.style.color = 'green';
          elements.distanceText.textContent = `Distance: ${deliveryDistance.toFixed(1)} km`;
          elements.deliveryDistanceDisplay.style.display = 'block';
          calculateDeliveryCharge();
        }

        elements.deliveryShowManualLocBtn.style.display = 'block';
        updateDeliveryInfoDisplay();
      },
      error => {
        console.error('Error getting location:', error);
        elements.currentLocStatusMsg.textContent = 'Could not get your location. Please enter manually.';
        elements.currentLocStatusMsg.style.color = 'red';
        elements.deliveryShowManualLocBtn.style.display = 'block';
      }
    );
  } else {
    elements.currentLocStatusMsg.textContent = 'Geolocation is not supported by your browser. Please enter manually.';
    elements.currentLocStatusMsg.style.color = 'red';
    elements.deliveryShowManualLocBtn.style.display = 'block';
  }
}

function initMap() {
  if (!map) {
    map = L.map('addressMap').setView([SHOP_LOCATION.lat, SHOP_LOCATION.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    L.marker([SHOP_LOCATION.lat, SHOP_LOCATION.lng], {
      icon: L.divIcon({ className: 'customer-marker', html: '🏠 Shop' })
    }).addTo(map);

    L.Control.geocoder({
      defaultMarkGeocode: false,
      position: 'topright'
    })
      .on('markgeocode', function (e) {
        const { center, name } = e.geocode;
        elements.manualDeliveryAddress.value = name;
        userLocation = { lat: center.lat, lng: center.lng };
        updateMapMarker();
        calculateDistanceAndCharge();
      })
      .addTo(map);

    map.on('click', function (e) {
      userLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
      updateMapMarker();
      reverseGeocode(e.latlng.lat, e.latlng.lng);
      calculateDistanceAndCharge();
    });
  }
}

function updateMapMarker() {
  if (marker) {
    map.removeLayer(marker);
  }
  marker = L.marker([userLocation.lat, userLocation.lng], {
    icon: L.divIcon({ className: 'customer-marker', html: '📍 You' })
  }).addTo(map);
  map.setView([userLocation.lat, userLocation.lng], 15);
}

function reverseGeocode(lat, lng) {
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
    .then(response => response.json())
    .then(data => {
      const address = data.display_name || 'Selected location';
      elements.manualDeliveryAddress.value = address;
    })
    .catch(error => {
      console.error('Reverse geocoding error:', error);
      elements.manualDeliveryAddress.value = 'Selected location';
    });
}

function calculateDistanceAndCharge() {
  deliveryDistance = calculateDistance(
    userLocation.lat,
    userLocation.lng,
    SHOP_LOCATION.lat,
    SHOP_LOCATION.lng
  );

  if (deliveryDistance > DELIVERY_RADIUS) {
    elements.currentLocStatusMsg.textContent = 'Delivery not available to your location (beyond 8km). Please choose pickup.';
    elements.currentLocStatusMsg.style.color = 'red';
    document.querySelector('input[value="Delivery"]').disabled = true;
    document.querySelector('input[value="Pickup"]').checked = true;
    elements.deliveryDistanceDisplay.style.display = 'none';
  } else {
    elements.currentLocStatusMsg.textContent = 'Location set!';
    elements.currentLocStatusMsg.style.color = 'green';
    elements.distanceText.textContent = `Distance: ${deliveryDistance.toFixed(1)} km`;
    elements.deliveryDistanceDisplay.style.display = 'block';
    calculateDeliveryCharge();
  }
  updateDeliveryInfoDisplay();
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateDeliveryCharge() {
  const orderType = document.querySelector('input[name="orderType"]:checked').value;

  if (orderType === 'Pickup') {
    deliveryCharge = 0;
    elements.deliveryChargeDisplay.textContent = '';
    return;
  }

  if (!deliveryDistance) return;

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (subtotal >= 500) {
    deliveryCharge = 0;
    elements.deliveryChargeDisplay.textContent = '🎉 Free delivery (order above ₹500)';
    elements.deliveryChargeDisplay.style.color = 'green';
    return;
  }

  if (deliveryDistance <= 4) {
    deliveryCharge = DELIVERY_CHARGES.under4km;
    elements.deliveryChargeDisplay.textContent = '🚚 Free delivery (within 4km)';
    elements.deliveryChargeDisplay.style.color = 'green';
  } else if (deliveryDistance <= 6) {
    deliveryCharge = DELIVERY_CHARGES.between4and6km;
    elements.deliveryChargeDisplay.textContent = `Delivery charge: ₹${deliveryCharge}`;
    elements.deliveryChargeDisplay.style.color = 'orange';
  } else if (deliveryDistance <= 8) {
    deliveryCharge = DELIVERY_CHARGES.between6and8km;
    elements.deliveryChargeDisplay.textContent = `Delivery charge: ₹${deliveryCharge}`;
    elements.deliveryChargeDisplay.style.color = 'orange';
  } else {
    deliveryCharge = 0;
    elements.deliveryChargeDisplay.textContent = 'Delivery not available beyond 8km';
    elements.deliveryChargeDisplay.style.color = 'red';
  }
}

// Order Handling
function handlePlaceOrder(e) {
  e.preventDefault();

  if (!elements.customerName.value.trim()) {
    showNotification('Please enter your name');
    return;
  }

  if (!elements.phoneNumber.value.trim() || !/^\d{10}$/.test(elements.phoneNumber.value)) {
    showNotification('Please enter a valid 10-digit phone number');
    return;
  }

  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (orderType === 'Delivery') {
    const hasCombo = cart.some(item => item.category === 'Combos');
    if (hasCombo) {
      showNotification('Combos are not available for delivery. Please choose pickup or remove combo items.');
      return;
    }

    if (subtotal < MIN_DELIVERY_ORDER) {
      showNotification(`Minimum order amount for delivery is ₹${MIN_DELIVERY_ORDER}`);
      return;
    }

    if (!userLocation) {
      showNotification('Please set your delivery location');
      return;
    }
  }

  const total = subtotal + deliveryCharge;

  let summaryHTML = `
    <div class="order-summary-item">
      <h3>Customer Details</h3>
      <p><strong>Name:</strong> ${elements.customerName.value}</p>
      <p><strong>Phone:</strong> ${elements.phoneNumber.value}</p>
      <p><strong>Order Type:</strong> ${orderType}</p>
      ${orderType === 'Delivery' ? `
        <p><strong>Delivery Address:</strong> ${elements.manualDeliveryAddress.value || 'Current location'}</p>
        <p><strong>Estimated Time:</strong> ${getDeliveryEstimate()}</p>
      ` : ''}
    </div>
    <div class="order-summary-item">
      <h3>Order Items</h3>
      <ul class="order-items">
        ${cart.map(item => `
          <li>${item.name}${item.variant ? ` (${item.variant})` : ''} x${item.quantity} - ${formatPrice(item.price * item.quantity)}</li>
        `).join('')}
      </ul>
    </div>
    <div class="order-summary-item">
      <p><strong>Subtotal:</strong> ${formatPrice(subtotal)}</p>
      ${orderType === 'Delivery' ? `<p><strong>Delivery Charge:</strong> ${formatPrice(deliveryCharge)}</p>` : ''}
      <p class="order-total"><strong>Total:</strong> ${formatPrice(total)}</p>
    </div>
    <div class="order-summary-item">
      <p><strong>Notification Preferences:</strong></p>
      <p>Order updates: ${elements.notifyStatus.checked ? '✅ Enabled' : '❌ Disabled'}</p>
      <p>Special offers: ${elements.notifyOffers.checked ? '✅ Enabled' : '❌ Disabled'}</p>
    </div>
  `;

  elements.orderConfirmationSummary.innerHTML = summaryHTML;
  elements.orderConfirmationModal.style.display = 'block';
}

async function confirmOrder() {
  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'Cash on Delivery';
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + deliveryCharge;

  // Save notification preferences
  const preferences = {
    statusUpdates: elements.notifyStatus.checked,
    specialOffers: elements.notifyOffers.checked
  };
  
  await updateNotificationPreferences(elements.phoneNumber.value, preferences);

  const orderId = await saveOrderToFirestore();
  if (!orderId) return;

  // Request notification permission with preferences
  await requestNotificationPermission(elements.phoneNumber.value, preferences);

  // Send initial confirmation notification
  await sendNotificationToUser(
    elements.phoneNumber.value,
    'Order Confirmed',
    `Your order #${orderId.substring(0, 6)} has been received`,
    {
      orderId,
      type: 'order_confirmation'
    }
  );

  // Build WhatsApp message
  let whatsappMessage = `*🍕 NEW ORDER - ${SHOP_NAME.toUpperCase()}*%0A%0A` +
    `📋 *Order #${orderId.substring(0, 6).toUpperCase()}*%0A` +
    `⏰ ${new Date().toLocaleTimeString()}, ${new Date().toLocaleDateString()}%0A%0A` +
    `👤 *Customer Details*%0A` +
    `▸ Name: ${elements.customerName.value}%0A` +
    `▸ Phone: https://wa.me/${elements.phoneNumber.value}%0A` +
    `▸ Order Type: ${orderType}%0A` +
    `▸ Estimated Time: ${getDeliveryEstimate()}%0A` +
    `▸ Payment: ${paymentMethod}%0A`;

  if (orderType === 'Delivery') {
    whatsappMessage += `▸ Address: ${elements.manualDeliveryAddress.value || 'Current location'}%0A` +
      `▸ Distance: ${deliveryDistance.toFixed(1)} km%0A` +
      `▸ Delivery Charge: ${formatPrice(deliveryCharge)}%0A` +
      `%0A📍 *Location Map*%0A${generateOSMUrl(userLocation)}%0A%0A`;
  }

  whatsappMessage += `%0A🛒 *Order Items*%0A` +
    `${cart.map(item => `▸ ${item.name}${item.variant ? ` (${item.variant})` : ''} x${item.quantity} - ${formatPrice(item.price * item.quantity)}`).join('%0A')}` +
    `%0A%0A💰 *Order Summary*%0A` +
    `▸ Subtotal: ${formatPrice(subtotal)}%0A` +
    (orderType === 'Delivery' ? `▸ Delivery Charge: ${formatPrice(deliveryCharge)}%0A` : '') +
    `*▸ TOTAL: ${formatPrice(total)}*%0A%0A` +
    (elements.orderNotes.value.trim() ? `📝 *Special Instructions*%0A${elements.orderNotes.value}%0A%0A` : '') +
    `Thank you!%0AFor any changes, please call ${918240266267}`;

  // Create a hidden link and click it to ensure WhatsApp opens
  const whatsappLink = document.createElement('a');
  whatsappLink.href = `https://wa.me/${918240266267}?text=${whatsappMessage}`;
  whatsappLink.target = '_blank';
  whatsappLink.style.display = 'none';
  document.body.appendChild(whatsappLink);
  whatsappLink.click();
  
  // Check if WhatsApp opened successfully
  setTimeout(() => {
    if (!window.open(whatsappLink.href, '_blank')) {
      showNotification('Please allow pop-ups to share order details via WhatsApp', 'error');
      // Fallback - show the WhatsApp link as a clickable button
      elements.orderConfirmationSummary.innerHTML += `
        <div class="whatsapp-fallback">
          <p>Could not open WhatsApp automatically. Please click below:</p>
          <a href="${whatsappLink.href}" target="_blank" class="mobile-order-btn">
            <i class="fab fa-whatsapp"></i> Share Order via WhatsApp
          </a>
        </div>
      `;
      elements.orderConfirmationModal.style.display = 'block';
    }
    document.body.removeChild(whatsappLink);
  }, 500);

  // Clear cart and redirect
  cart.length = 0;
  saveCart();
  elements.orderConfirmationModal.style.display = 'none';
  showNotification('Order placed successfully! Please check WhatsApp for confirmation.');
  setTimeout(() => window.location.href = 'index.html', 3000);
}

// Initialize checkout
document.addEventListener('DOMContentLoaded', initCheckout);