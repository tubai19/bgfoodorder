import { db, cart, saveCart, updateCartCount, showNotification, formatPrice } from './shared.js';

// Constants
const SHOP_LOCATION = { lat: 22.3908, lng: 88.2189 };
const DELIVERY_RADIUS = 8;
const DELIVERY_CHARGES = {
  under4km: 0,
  between4and6km: 20,
  between6and8km: 30
};
const MIN_DELIVERY_ORDER = 200;

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
  orderHistoryList: document.getElementById('orderHistoryList')
};

// Variables
let map;
let marker;
let userLocation = null;
let deliveryDistance = null;
let deliveryCharge = 0;

// =======================
// Firestore Save Function
// =======================
async function saveOrderToFirestore() {
  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + deliveryCharge;

  try {
    const orderRef = await db.collection('orders').add({
      customerName: elements.customerName.value,
      phoneNumber: elements.phoneNumber.value,
      orderType,
      items: [...cart],
      subtotal,
      deliveryCharge: orderType === 'Delivery' ? deliveryCharge : 0,
      total,
      status: 'pending',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      ...(orderType === 'Delivery' && {
        deliveryAddress: elements.manualDeliveryAddress.value || 'Current location',
        deliveryDistance
      })
    });
    return orderRef.id;
  } catch (error) {
    console.error('Error saving order:', error);
    showNotification('Failed to save order. Please try again.', 'error');
    return null;
  }
}

// =======================
// Checkout Initialisation
// =======================
function initCheckout() {
  if (!elements.orderForm) return;

  if (cart.length === 0) {
    showNotification('Your cart is empty. Redirecting to menu...');
    setTimeout(() => window.location.href = 'menu.html', 2000);
    return;
  }

  updateOrderTotal();
  setupEventListeners();
  loadOrderHistory();
}

function updateOrderTotal() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  if (elements.mobileLiveTotal) {
    elements.mobileLiveTotal.textContent = `💰 Total Bill: ${formatPrice(subtotal)}`;
  }
}

function setupEventListeners() {
  elements.orderTypeRadios.forEach(radio => {
    radio.addEventListener('change', handleOrderTypeChange);
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

// =======================
// Order Type / Location
// =======================
function handleOrderTypeChange() {
  const orderType = document.querySelector('input[name="orderType"]:checked').value;

  if (orderType === 'Pickup') {
    deliveryDistanceDisplay.style.display = 'none';
    deliveryChargeDisplay.textContent = '';
  } else {
    if (userLocation) {
      deliveryDistanceDisplay.style.display = 'block';
      calculateDeliveryCharge();
    }
  }
}

function handleShareLocation() {
  currentLocStatusMsg.textContent = 'Getting your location...';
  currentLocStatusMsg.style.color = '#333';

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
          currentLocStatusMsg.textContent = 'Delivery not available to your location (beyond 8km). Please choose pickup.';
          currentLocStatusMsg.style.color = 'red';
          document.querySelector('input[value="Delivery"]').disabled = true;
          document.querySelector('input[value="Pickup"]').checked = true;
          deliveryDistanceDisplay.style.display = 'none';
        } else {
          currentLocStatusMsg.textContent = 'Location found!';
          currentLocStatusMsg.style.color = 'green';
          distanceText.textContent = `Distance: ${deliveryDistance.toFixed(1)} km`;
          deliveryDistanceDisplay.style.display = 'block';
          calculateDeliveryCharge();
        }

        deliveryShowManualLocBtn.style.display = 'block';
      },
      error => {
        console.error('Error getting location:', error);
        currentLocStatusMsg.textContent = 'Could not get your location. Please enter manually.';
        currentLocStatusMsg.style.color = 'red';
        deliveryShowManualLocBtn.style.display = 'block';
      }
    );
  } else {
    currentLocStatusMsg.textContent = 'Geolocation is not supported by your browser. Please enter manually.';
    currentLocStatusMsg.style.color = 'red';
    deliveryShowManualLocBtn.style.display = 'block';
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
        manualDeliveryAddress.value = name;
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
      manualDeliveryAddress.value = address;
    })
    .catch(error => {
      console.error('Reverse geocoding error:', error);
      manualDeliveryAddress.value = 'Selected location';
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
    currentLocStatusMsg.textContent = 'Delivery not available to your location (beyond 8km). Please choose pickup.';
    currentLocStatusMsg.style.color = 'red';
    document.querySelector('input[value="Delivery"]').disabled = true;
    document.querySelector('input[value="Pickup"]').checked = true;
    deliveryDistanceDisplay.style.display = 'none';
  } else {
    currentLocStatusMsg.textContent = 'Location set!';
    currentLocStatusMsg.style.color = 'green';
    distanceText.textContent = `Distance: ${deliveryDistance.toFixed(1)} km`;
    deliveryDistanceDisplay.style.display = 'block';
    calculateDeliveryCharge();
  }
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
    deliveryChargeDisplay.textContent = '';
    return;
  }

  if (!deliveryDistance) return;

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (subtotal >= 500) {
    deliveryCharge = 0;
    deliveryChargeDisplay.textContent = '🎉 Free delivery (order above ₹500)';
    deliveryChargeDisplay.style.color = 'green';
    return;
  }

  if (deliveryDistance <= 4) {
    deliveryCharge = DELIVERY_CHARGES.under4km;
    deliveryChargeDisplay.textContent = '🚚 Free delivery (within 4km)';
    deliveryChargeDisplay.style.color = 'green';
  } else if (deliveryDistance <= 6) {
    deliveryCharge = DELIVERY_CHARGES.between4and6km;
    deliveryChargeDisplay.textContent = `Delivery charge: ₹${deliveryCharge}`;
    deliveryChargeDisplay.style.color = 'orange';
  } else if (deliveryDistance <= 8) {
    deliveryCharge = DELIVERY_CHARGES.between6and8km;
    deliveryChargeDisplay.textContent = `Delivery charge: ₹${deliveryCharge}`;
    deliveryChargeDisplay.style.color = 'orange';
  } else {
    deliveryCharge = 0;
    deliveryChargeDisplay.textContent = 'Delivery not available beyond 8km';
    deliveryChargeDisplay.style.color = 'red';
  }
}

// =======================
// Order Handling
// =======================
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
      ${orderType === 'Delivery' ? `<p><strong>Delivery Address:</strong> ${elements.manualDeliveryAddress.value || 'Current location'}</p>` : ''}
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
  `;

  elements.orderConfirmationSummary.innerHTML = summaryHTML;
  elements.orderConfirmationModal.style.display = 'block';
}

async function confirmOrder() {
  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + deliveryCharge;

  const orderId = await saveOrderToFirestore();
  if (!orderId) return;

  let orderDetails = `*New Order from Bake & Grill*%0A%0A`;
  orderDetails += `*Order ID:* ${orderId}%0A`;
  orderDetails += `*Name:* ${elements.customerName.value}%0A`;
  orderDetails += `*Phone:* ${elements.phoneNumber.value}%0A`;
  orderDetails += `*Order Type:* ${orderType}%0A`;

  if (orderType === 'Delivery') {
    orderDetails += `*Delivery Address:* ${elements.manualDeliveryAddress.value || 'Current location'}%0A`;
    orderDetails += `*Distance:* ${deliveryDistance.toFixed(1)} km%0A`;
  }

  orderDetails += `%0A*Order Items:*%0A`;
  cart.forEach(item => {
    orderDetails += `- ${item.name}${item.variant ? ` (${item.variant})` : ''} x${item.quantity} - ${formatPrice(item.price * item.quantity)}%0A`;
  });

  orderDetails += `%0A*Subtotal:* ${formatPrice(subtotal)}%0A`;
  if (orderType === 'Delivery') {
    orderDetails += `*Delivery Charge:* ${formatPrice(deliveryCharge)}%0A`;
  }
  orderDetails += `*Total:* ${formatPrice(total)}%0A%0A`;

  if (elements.orderNotes.value.trim()) {
    orderDetails += `*Special Instructions:*%0A${elements.orderNotes.value}%0A%0A`;
  }

  const hasCombo = cart.some(item => item.category === 'Combos');
  if (hasCombo) {
    orderDetails += `Note: Combo items must be picked up from our location.%0A%0A`;
  }

  orderDetails += `Thank you for your order! We'll confirm shortly. For any changes, call 8240266267`;

  saveOrderToHistory();

  const whatsappUrl = `https://wa.me/918240266267?text=${orderDetails}`;
  window.open(whatsappUrl, '_blank');

  cart.length = 0;
  saveCart();

  elements.orderConfirmationModal.style.display = 'none';

  showNotification('Order placed successfully! Thank you for your order. We will contact you shortly.');
  setTimeout(() => window.location.href = 'index.html', 3000);
}

function saveOrderToHistory() {
  const orders = JSON.parse(localStorage.getItem('orderHistory')) || [];
  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + deliveryCharge;

  const newOrder = {
    id: Date.now(),
    date: new Date().toLocaleString(),
    customer: {
      name: elements.customerName.value,
      phone: elements.phoneNumber.value
    },
    type: orderType,
    items: [...cart],
    subtotal: subtotal,
    deliveryCharge: orderType === 'Delivery' ?
