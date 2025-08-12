import { 
  db, 
  cart, 
  saveCart, 
  updateCartCount, 
  showNotification, 
  formatPrice, 
  requestNotificationPermission 
} from './shared.js';

// Import Firebase v9 modular functions
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
const MIN_DELIVERY_ORDER = 200;
const SHOP_PHONE = '918240266267';
const SHOP_NAME = 'Bake & Grill';
const SHOP_ADDRESS = '123 Main Street, Kolkata, West Bengal';

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
  paymentMethodRadios: document.querySelectorAll('input[name="paymentMethod"]')
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
      ...(orderType === 'Delivery' && {
        deliveryAddress: elements.manualDeliveryAddress.value || 'Current location',
        deliveryDistance
      })
    });

    // Request notification permission after order
    await requestNotificationPermission(phoneNumber);
    
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
    elements.deliveryDistanceDisplay.style.display = 'none';
    elements.deliveryChargeDisplay.textContent = '';
  } else {
    if (userLocation) {
      elements.deliveryDistanceDisplay.style.display = 'block';
      calculateDeliveryCharge();
    }
  }
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
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'Cash on Delivery';
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + deliveryCharge;

  const orderId = await saveOrderToFirestore();
  if (!orderId) return;

  // Enhanced WhatsApp message with better formatting
  let whatsappMessage = `*🍕 NEW ORDER - ${SHOP_NAME.toUpperCase()} 🍕*%0A%0A`;
  
  // Order header
  whatsappMessage += `📋 *Order #${orderId.substring(0, 6).toUpperCase()}*%0A`;
  whatsappMessage += `⏰ ${new Date().toLocaleString()}%0A%0A`;
  
  // Customer details
  whatsappMessage += `👤 *Customer Details*%0A`;
  whatsappMessage += `▸ Name: ${elements.customerName.value}%0A`;
  whatsappMessage += `▸ Phone: ${elements.phoneNumber.value}%0A`;
  whatsappMessage += `▸ Order Type: ${orderType}%0A`;
  whatsappMessage += `▸ Payment: ${paymentMethod}%0A`;
  
  if (orderType === 'Delivery') {
    whatsappMessage += `▸ Address: ${elements.manualDeliveryAddress.value || 'Current location'}%0A`;
    whatsappMessage += `▸ Distance: ${deliveryDistance.toFixed(1)} km%0A`;
    
    // Add delivery estimate
    const estimate = deliveryDistance <= 4 ? '30-45 mins' : 
                     deliveryDistance <= 6 ? '45-60 mins' : '60-75 mins';
    whatsappMessage += `▸ Estimated Delivery: ${estimate}%0A`;
  }
  whatsappMessage += `%0A`;
  
  // Order items
  whatsappMessage += `🛒 *Order Items* (${cart.length})%0A`;
  cart.forEach(item => {
    whatsappMessage += `▸ ${item.name}${item.variant ? ` (${item.variant})` : ''} x${item.quantity} - ${formatPrice(item.price * item.quantity)}%0A`;
  });
  whatsappMessage += `%0A`;
  
  // Pricing summary
  whatsappMessage += `💰 *Order Summary*%0A`;
  whatsappMessage += `▸ Subtotal: ${formatPrice(subtotal)}%0A`;
  if (orderType === 'Delivery') {
    whatsappMessage += `▸ Delivery Charge: ${formatPrice(deliveryCharge)}%0A`;
  }
  whatsappMessage += `*▸ TOTAL: ${formatPrice(total)}*%0A%0A`;
  
  // Special instructions
  if (elements.orderNotes.value.trim()) {
    whatsappMessage += `📝 *Special Instructions*%0A${elements.orderNotes.value}%0A%0A`;
  }

  // Combo notice if applicable
  const hasCombo = cart.some(item => item.category === 'Combos');
  if (hasCombo && orderType === 'Delivery') {
    whatsappMessage += `⚠️ *Note:* Combo items must be picked up from our location.%0A%0A`;
  }

  // Closing message
  whatsappMessage += `Thank you for your order!%0A`;
  whatsappMessage += `For any changes, please call ${SHOP_PHONE}%0A%0A`;
  whatsappMessage += `📍 *${SHOP_NAME}*%0A`;
  whatsappMessage += `${SHOP_ADDRESS}`;

  // Save to history
  saveOrderToHistory();

  // Open WhatsApp
  const whatsappUrl = `https://wa.me/${SHOP_PHONE}?text=${whatsappMessage}`;
  window.open(whatsappUrl, '_blank');

  // Clear cart and redirect
  cart.length = 0;
  saveCart();
  elements.orderConfirmationModal.style.display = 'none';
  showNotification('Order placed successfully! Thank you for your order. We will contact you shortly.');
  setTimeout(() => window.location.href = 'index.html', 3000);
}

function saveOrderToHistory() {
  const orders = JSON.parse(localStorage.getItem('orderHistory')) || [];
  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'Cash on Delivery';
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
    paymentMethod,
    items: [...cart],
    subtotal: subtotal,
    deliveryCharge: orderType === 'Delivery' ? deliveryCharge : 0,
    total: total,
    status: 'pending'
  };

  orders.unshift(newOrder);
  localStorage.setItem('orderHistory', JSON.stringify(orders));
}

function loadOrderHistory() {
  const phoneNumber = elements.phoneNumber.value;
  if (!phoneNumber) return;

  // First check localStorage
  const orders = JSON.parse(localStorage.getItem('orderHistory')) || [];
  
  if (orders.length === 0) {
    elements.orderHistoryList.innerHTML = '<p class="no-orders">No past orders found</p>';
  } else {
    renderOrderHistory(orders);
  }
  
  // Then listen for Firestore updates
  const q = query(
    collection(db, 'orders'),
    where('phoneNumber', '==', phoneNumber),
    orderBy('timestamp', 'desc')
  );
  
  onSnapshot(q, (snapshot) => {
    const firestoreOrders = [];
    snapshot.forEach(doc => {
      const order = doc.data();
      order.id = doc.id;
      firestoreOrders.push(order);
    });
    
    renderOrderHistory(firestoreOrders);
    localStorage.setItem('orderHistory', JSON.stringify(firestoreOrders));
  });
}

function renderOrderHistory(orders) {
  elements.orderHistoryList.innerHTML = orders.map(order => `
    <div class="order-history-item" data-order-id="${order.id}">
      <div class="order-history-header">
        <span class="order-number">Order #${order.id.substring(0, 6)}</span>
        <span class="order-date">${new Date(order.timestamp?.toDate?.() || order.timestamp).toLocaleString()}</span>
      </div>
      <div class="order-history-details">
        <div><strong>Status:</strong> <span class="status-${order.status}">${order.status}</span></div>
        <div><strong>Type:</strong> ${order.orderType}</div>
        <div><strong>Payment:</strong> ${order.paymentMethod || 'Cash on Delivery'}</div>
        ${order.orderType === 'Delivery' ? `<div><strong>Distance:</strong> ${order.deliveryDistance?.toFixed(1) || 'N/A'} km</div>` : ''}
        <div class="order-total"><strong>Total:</strong> ${formatPrice(order.total)}</div>
      </div>
      <div class="order-items">
        <ul>
          ${order.items.slice(0, 3).map(item => `
            <li>${item.name}${item.variant ? ` (${item.variant})` : ''} x${item.quantity}</li>
          `).join('')}
          ${order.items.length > 3 ? `<li>+${order.items.length - 3} more items</li>` : ''}
        </ul>
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', initCheckout);