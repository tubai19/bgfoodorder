import { 
  cart, saveCart, updateCartCount, showNotification, formatPrice, validateOrder,
  requestNotificationPermission, updateNotificationPreferences, sendOrderNotification,
  serverTimestamp, GeoPoint, addDoc, collection, doc, setDoc, db,
  getNotificationPreferences, sendOrderUpdateWithFallback
} from './shared.js';

const elements = {
  placeOrderBtn: document.getElementById('placeOrderBtn'),
  orderForm: document.getElementById('orderForm'),
  customerName: document.getElementById('customerName'),
  phoneNumber: document.getElementById('phoneNumber'),
  orderNotes: document.getElementById('orderNotes'),
  orderTypeRadios: document.querySelectorAll('input[name="orderType"]'),
  deliveryChargeDisplay: document.getElementById('deliveryChargeDisplay'),
  mobileLiveTotal: document.getElementById('mobileLiveTotal'),
  confirmOrderBtn: document.getElementById('confirmOrderBtn'),
  orderConfirmationModal: document.getElementById('orderConfirmationModal'),
  orderConfirmationSummary: document.getElementById('orderConfirmationSummary'),
  cancelOrderBtn: document.getElementById('cancelOrderBtn'),
  deliveryShareLocationBtn: document.getElementById('deliveryShareLocationBtn'),
  manualLocationFields: document.getElementById('manualLocationFields'),
  deliveryShowManualLocBtn: document.getElementById('deliveryShowManualLocBtn'),
  manualDeliveryAddress: document.getElementById('manualDeliveryAddress'),
  addressMap: document.getElementById('addressMap'),
  currentLocStatusMsg: document.getElementById('currentLocStatusMsg'),
  deliveryDistanceDisplay: document.getElementById('deliveryDistanceDisplay'),
  distanceText: document.getElementById('distanceText'),
  deliveryTimeEstimate: document.getElementById('deliveryTimeEstimate'),
  timeEstimateText: document.getElementById('timeEstimateText'),
  geocodingLoading: document.getElementById('geocodingLoading'),
  notifyStatus: document.getElementById('notifyStatus'),
  notifyOffers: document.getElementById('notifyOffers'),
  notificationStatus: document.getElementById('notificationStatus'),
  whatsappOptionsModal: document.getElementById('whatsappOptionsModal'),
  whatsappShareModal: document.getElementById('whatsappShareModal'),
  whatsappShareMessage: document.getElementById('whatsappShareMessage'),
  whatsappShareBtn: document.getElementById('whatsappShareBtn'),
  whatsappShareLaterBtn: document.getElementById('whatsappShareLaterBtn')
};

let map;
let marker;
let userLocation = null;
let currentOrderId = null;
const shopLocation = { lat: 22.3908, lng: 88.2189 };
const freeDeliveryThreshold = 500;
const minimumOrderValue = 200;
const basePrepTime = 20;
const minutesPerKm = 8;
const deliveryZones = [
  { maxDistance: 4, charge: 0, label: "Free (0-4 km)" },
  { maxDistance: 6, charge: 20, label: "₹20 (4-6 km)" },
  { maxDistance: 8, charge: 30, label: "₹30 (6-8 km)" }
];

document.addEventListener('DOMContentLoaded', () => {
  const errors = validateOrder(cart, getOrderType());
  
  if (errors.length > 0) {
    const errorHtml = errors.map(e => `<li>${e}</li>`).join('');
    elements.orderForm.innerHTML = `
      <div class="order-errors">
        <h3>Cannot proceed with order:</h3>
        <ul>${errorHtml}</ul>
        <a href="menu.html" class="mobile-cta-btn">Back to Menu</a>
      </div>
    `;
    return;
  }
  
  setupNotificationPreferences();
  setupEventListeners();
  updateOrderSummary();
});

function getOrderType() {
  return document.querySelector('input[name="orderType"]:checked')?.value || 'Delivery';
}

function setupEventListeners() {
  elements.placeOrderBtn.addEventListener('click', (e) => {
    e.preventDefault();
    validateAndShowConfirmation();
  });

  elements.orderTypeRadios.forEach(radio => {
    radio.addEventListener('change', updateOrderSummary);
  });

  elements.deliveryShareLocationBtn.addEventListener('click', shareCurrentLocation);
  elements.deliveryShowManualLocBtn.addEventListener('click', showManualLocation);
  elements.manualDeliveryAddress.addEventListener('input', debounce(geocodeAddress, 500));
  elements.confirmOrderBtn.addEventListener('click', confirmOrder);
  elements.cancelOrderBtn.addEventListener('click', closeConfirmationModal);
  
  // WhatsApp sharing buttons
  elements.whatsappShareBtn.addEventListener('click', () => {
    shareOrderViaWhatsApp();
    elements.whatsappShareModal.style.display = 'none';
    completeOrderProcess();
  });
  
  elements.whatsappShareLaterBtn.addEventListener('click', () => {
    showNotification('Please share your order via WhatsApp to complete the process', 'warning');
  });
  
  document.querySelectorAll('.close-modal').forEach(closeBtn => {
    closeBtn.addEventListener('click', (e) => {
      const modal = e.target.closest('.mobile-modal');
      if (modal) modal.style.display = 'none';
    });
  });
  
  window.addEventListener('click', (e) => {
    if (e.target === elements.orderConfirmationModal) {
      closeConfirmationModal();
    }
    if (e.target === elements.whatsappShareModal) {
      // Don't allow closing the WhatsApp modal by clicking outside
      // Users must share the order to proceed
      showNotification('Please share your order via WhatsApp to complete your order', 'warning');
    }
  });

  if (elements.notifyStatus) {
    elements.notifyStatus.addEventListener('change', saveNotificationPreferences);
  }
  if (elements.notifyOffers) {
    elements.notifyOffers.addEventListener('change', saveNotificationPreferences);
  }
}

async function setupNotificationPreferences() {
  if (!elements.phoneNumber) return;
  
  const phone = elements.phoneNumber.value.trim();
  if (!phone) return;

  const prefs = await getNotificationPreferences(phone);
  if (elements.notifyStatus) elements.notifyStatus.checked = prefs.statusUpdates;
  if (elements.notifyOffers) elements.notifyOffers.checked = prefs.specialOffers;

  if ('Notification' in window && elements.notificationStatus) {
    if (Notification.permission === 'granted') {
      elements.notificationStatus.innerHTML = '<i class="fas fa-check-circle"></i> Notifications enabled';
    } else {
      elements.notificationStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Notifications disabled';
    }
  }
}

async function saveNotificationPreferences() {
  if (!elements.phoneNumber) return;
  
  const phone = elements.phoneNumber.value.trim();
  if (!phone) return;

  const prefs = {
    statusUpdates: elements.notifyStatus?.checked || false,
    specialOffers: elements.notifyOffers?.checked || false
  };
  
  await updateNotificationPreferences(phone, prefs);
  showNotification('Notification preferences saved');
}

function validateAndShowConfirmation() {
  if (cart.length === 0) {
    showNotification('Your cart is empty', 'error');
    return;
  }

  if (!elements.customerName.value.trim()) {
    showNotification('Please enter your name', 'error');
    return;
  }

  if (!elements.phoneNumber.value.trim() || !/^\d{10}$/.test(elements.phoneNumber.value)) {
    showNotification('Please enter a valid 10-digit phone number', 'error');
    return;
  }

  const orderType = getOrderType();
  const errors = validateOrder(cart, orderType);
  
  if (errors.length > 0) {
    showNotification(errors[0], 'error');
    return;
  }

  if (orderType === 'Delivery' && !userLocation) {
    showNotification('Please set your delivery location', 'error');
    return;
  }

  elements.orderConfirmationSummary.innerHTML = generateOrderSummary();
  elements.orderConfirmationModal.style.display = 'block';
}

function generateOrderSummary() {
  const orderType = getOrderType();
  const totals = calculateTotal();
  const subtotal = totals.subtotal;
  
  let summaryHTML = `
    <div class="summary-section">
      <h3>Order Details</h3>
      <ul class="summary-items">
        ${cart.map(item => `
          <li>
            ${item.quantity}x ${item.name}${item.variant ? ` (${item.variant})` : ''}
            <span>${formatPrice(item.price * item.quantity)}</span>
          </li>
        `).join('')}
      </ul>
    </div>
    
    <div class="summary-section">
      <h3>Customer Details</h3>
      <p><strong>Name:</strong> ${elements.customerName.value}</p>
      <p><strong>Phone:</strong> ${elements.phoneNumber.value}</p>
      <p><strong>Order Type:</strong> ${orderType}</p>
  `;

  if (orderType === 'Delivery') {
    summaryHTML += `
      <p><strong>Delivery Address:</strong> ${elements.manualDeliveryAddress.value || 'Current Location'}</p>
      <p><strong>Distance:</strong> ${elements.distanceText.textContent.replace('Distance: ', '')}</p>
      <p><strong>Estimated Time:</strong> ${elements.timeEstimateText.textContent.replace('Estimated time: ', '')}</p>
    `;
  }

  summaryHTML += `
    </div>
    
    <div class="summary-section">
      <h3>Payment Summary</h3>
      <p><strong>Subtotal:</strong> ${formatPrice(subtotal)}</p>
  `;

  if (orderType === 'Delivery') {
    summaryHTML += `
      <p><strong>Delivery Charge:</strong> ${formatPrice(totals.deliveryCharge)}</p>
      ${subtotal > freeDeliveryThreshold ? `<p><em>Free delivery applied (order above ₹${freeDeliveryThreshold})</em></p>` : ''}
    `;
  }

  summaryHTML += `
      <p class="summary-total"><strong>Total:</strong> ${formatPrice(totals.grandTotal)}</p>
    </div>
  `;

  if (elements.orderNotes.value) {
    summaryHTML += `
      <div class="summary-section">
        <h3>Special Instructions</h3>
        <p>${elements.orderNotes.value}</p>
      </div>
    `;
  }

  if (elements.notifyStatus || elements.notifyOffers) {
    summaryHTML += `
      <div class="summary-section">
        <h3>Notification Preferences</h3>
        <p><strong>Order Status Updates:</strong> ${elements.notifyStatus?.checked ? 'Yes' : 'No'}</p>
        <p><strong>Special Offers:</strong> ${elements.notifyOffers?.checked ? 'Yes' : 'No'}</p>
      </div>
    `;
  }

  return summaryHTML;
}

function calculateTotal() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const orderType = getOrderType();
  
  let deliveryCharge = 0;
  if (orderType === 'Delivery' && userLocation) {
    const distance = calculateDistance(
      shopLocation.lat, shopLocation.lng,
      userLocation.lat, userLocation.lng
    );
    
    if (distance > 6 && distance <= 8) {
      deliveryCharge = 30;
    } else if (distance > 4 && distance <= 6) {
      deliveryCharge = 20;
    }
    
    if (subtotal > freeDeliveryThreshold) {
      deliveryCharge = 0;
    }
  }

  const grandTotal = subtotal + deliveryCharge;
  return { subtotal, deliveryCharge, grandTotal };
}

function updateOrderSummary() {
  if (cart.length === 0) {
    elements.mobileLiveTotal.textContent = `💰 Total Bill: ₹0`;
    elements.deliveryChargeDisplay.textContent = '';
    return;
  }

  const totals = calculateTotal();
  const orderType = getOrderType();
  
  elements.mobileLiveTotal.textContent = `💰 Total Bill: ${formatPrice(totals.grandTotal)}`;
  
  if (orderType === 'Delivery') {
    if (userLocation) {
      const distance = calculateDistance(
        shopLocation.lat, shopLocation.lng,
        userLocation.lat, userLocation.lng
      );
      
      let deliveryMessage = '';
      if (totals.subtotal > freeDeliveryThreshold) {
        deliveryMessage = `Free delivery (order above ₹${freeDeliveryThreshold})`;
      } else if (distance <= 4) {
        deliveryMessage = 'Free delivery (within 4 km)';
      } else if (distance <= 6) {
        deliveryMessage = `Delivery Charge: ₹20 (4-6 km)`;
      } else if (distance <= 8) {
        deliveryMessage = `Delivery Charge: ₹30 (6-8 km)`;
      } else {
        deliveryMessage = 'Delivery not available (beyond 8 km)';
      }
      
      elements.deliveryChargeDisplay.innerHTML = `
        <i class="fas fa-truck"></i> ${deliveryMessage}
      `;
    } else {
      elements.deliveryChargeDisplay.innerHTML = `
        <i class="fas fa-truck"></i> Delivery charge will be calculated after location is set
      `;
    }
  } else {
    elements.deliveryChargeDisplay.textContent = '';
  }
}

async function shareCurrentLocation() {
  elements.currentLocStatusMsg.textContent = 'Getting your location...';
  elements.currentLocStatusMsg.style.color = '#333';
  
  if (navigator.geolocation) {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      
      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      elements.currentLocStatusMsg.textContent = 'Location received!';
      elements.currentLocStatusMsg.style.color = 'green';
      elements.deliveryShareLocationBtn.style.display = 'none';
      elements.deliveryShowManualLocBtn.style.display = 'inline-block';
      
      updateDistanceAndTime();
      updateOrderSummary();
    } catch (error) {
      handleLocationError(error);
    }
  } else {
    elements.currentLocStatusMsg.textContent = 'Geolocation is not supported by this browser.';
    elements.currentLocStatusMsg.style.color = 'red';
  }
}

function handleLocationError(error) {
  let errorMessage = 'Error getting location: ';
  switch(error.code) {
    case error.PERMISSION_DENIED:
      errorMessage += "You denied the request for geolocation.";
      break;
    case error.POSITION_UNAVAILABLE:
      errorMessage += "Location information is unavailable.";
      break;
    case error.TIMEOUT:
      errorMessage += "The request to get location timed out.";
      break;
    case error.UNKNOWN_ERROR:
      errorMessage += "An unknown error occurred.";
      break;
  }
  
  elements.currentLocStatusMsg.textContent = errorMessage;
  elements.currentLocStatusMsg.style.color = 'red';
}

function showManualLocation() {
  elements.deliveryShowManualLocBtn.style.display = 'none';
  elements.manualLocationFields.style.display = 'block';
  initMap();
}

function initMap() {
  if (map) return;
  
  map = L.map(elements.addressMap).setView([shopLocation.lat, shopLocation.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  
  map.on('click', (e) => {
    if (marker) map.removeLayer(marker);
    
    marker = L.marker(e.latlng).addTo(map)
      .bindPopup('Your delivery location')
      .openPopup();
    
    userLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
    reverseGeocode(e.latlng.lat, e.latlng.lng);
    updateDistanceAndTime();
    updateOrderSummary();
  });
  
  const geocoder = L.Control.geocoder({
    defaultMarkGeocode: false,
    position: 'topright'
  }).addTo(map);
  
  geocoder.on('markgeocode', (e) => {
    const { center, name } = e.geocode;
    if (marker) map.removeLayer(marker);
    
    marker = L.marker(center).addTo(map)
      .bindPopup(name)
      .openPopup();
    
    map.setView(center, 16);
    elements.manualDeliveryAddress.value = name;
    userLocation = { lat: center.lat, lng: center.lng };
    updateDistanceAndTime();
    updateOrderSummary();
  });
}

async function geocodeAddress() {
  const address = elements.manualDeliveryAddress.value;
  if (!address || address.length < 3) return;
  
  elements.geocodingLoading.style.display = 'block';
  
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
    const data = await response.json();
    
    elements.geocodingLoading.style.display = 'none';
    
    if (data && data.length > 0) {
      const firstResult = data[0];
      const lat = parseFloat(firstResult.lat);
      const lon = parseFloat(firstResult.lon);
      
      if (marker) map.removeLayer(marker);
      
      marker = L.marker([lat, lon]).addTo(map)
        .bindPopup(firstResult.display_name)
        .openPopup();
      
      map.setView([lat, lon], 16);
      userLocation = { lat, lng: lon };
      elements.manualDeliveryAddress.value = firstResult.display_name;
      updateDistanceAndTime();
      updateOrderSummary();
    }
  } catch (error) {
    elements.geocodingLoading.style.display = 'none';
    console.error('Geocoding error:', error);
  }
}

async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await response.json();
    
    if (data.display_name) {
      elements.manualDeliveryAddress.value = data.display_name;
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error);
  }
}

function updateDistanceAndTime() {
  if (!userLocation) return;
  
  const distance = calculateDistance(
    shopLocation.lat, shopLocation.lng,
    userLocation.lat, userLocation.lng
  );
  
  elements.distanceText.textContent = `Distance: ${distance.toFixed(1)} km`;
  
  const deliveryTime = calculateDeliveryTime(distance);
  elements.timeEstimateText.textContent = `Estimated time: ${deliveryTime} min`;
  
  elements.deliveryDistanceDisplay.style.display = 'block';
  elements.deliveryTimeEstimate.style.display = 'block';
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

function calculateDeliveryTime(distance) {
  const travelTime = distance * minutesPerKm;
  return Math.round(basePrepTime + travelTime);
}

function closeConfirmationModal() {
  elements.orderConfirmationModal.style.display = 'none';
}

async function confirmOrder() {
  const orderData = prepareOrderData();
  const orderId = await saveOrderToFirestore(orderData);
  
  if (orderId) {
    currentOrderId = orderId;
    await sendOrderUpdateWithFallback(orderData, orderId);
    showWhatsAppShareModal(orderData, orderId);
    closeConfirmationModal();
  } else {
    showNotification('Failed to place order. Please try again.', 'error');
  }
}

function prepareOrderData() {
  const orderType = getOrderType();
  const totals = calculateTotal();
  
  return {
    customerName: elements.customerName.value.trim(),
    phoneNumber: elements.phoneNumber.value.trim(),
    orderType: orderType,
    items: cart.map(item => ({
      name: item.name,
      variant: item.variant,
      quantity: item.quantity,
      price: item.price
    })),
    subtotal: totals.subtotal,
    deliveryCharge: totals.deliveryCharge,
    grandTotal: totals.grandTotal,
    notes: elements.orderNotes.value.trim(),
    status: 'pending',
    createdAt: serverTimestamp(),
    notifyStatus: elements.notifyStatus?.checked || false,
    notifyOffers: elements.notifyOffers?.checked || false,
    ...(orderType === 'Delivery' && {
      deliveryAddress: elements.manualDeliveryAddress.value || 'Current Location',
      location: new GeoPoint(userLocation.lat, userLocation.lng),
      estimatedDeliveryTime: calculateDeliveryTime(
        calculateDistance(
          shopLocation.lat, shopLocation.lng,
          userLocation.lat, userLocation.lng
        )
      )
    })
  };
}

async function saveOrderToFirestore(orderData) {
  try {
    const docRef = await addDoc(collection(db, 'orders'), orderData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving order:', error);
    return null;
  }
}

function showWhatsAppShareModal(orderData, orderId) {
  const orderSummary = generateWhatsAppMessage(orderData, orderId);
  elements.whatsappShareMessage.textContent = orderSummary;
  elements.whatsappShareModal.style.display = 'block';
}

function generateWhatsAppMessage(orderData, orderId) {
  const orderType = orderData.orderType;
  const totals = calculateTotal();
  
  let message = `New Order #${orderId}\n`;
  message += `Customer: ${orderData.customerName}\n`;
  message += `Phone: ${orderData.phoneNumber}\n`;
  message += `Order Type: ${orderType}\n\n`;
  message += `Items:\n`;
  
  orderData.items.forEach(item => {
    message += `${item.quantity}x ${item.name}`;
    if (item.variant) message += ` (${item.variant})`;
    message += ` - ₹${item.price * item.quantity}\n`;
  });
  
  message += `\nSubtotal: ₹${totals.subtotal}\n`;
  
  if (orderType === 'Delivery') {
    message += `Delivery Charge: ₹${totals.deliveryCharge}\n`;
  }
  
  message += `Total: ₹${totals.grandTotal}\n`;
  
  if (orderData.notes) {
    message += `\nNotes: ${orderData.notes}\n`;
  }
  
  if (orderType === 'Delivery') {
    message += `\nDelivery Address: ${orderData.deliveryAddress}\n`;
    message += `Estimated Delivery Time: ${orderData.estimatedDeliveryTime} minutes\n`;
  }
  
  return message;
}

function shareOrderViaWhatsApp() {
  const orderSummary = generateWhatsAppMessage(prepareOrderData(), currentOrderId);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(orderSummary)}`;
  window.open(whatsappUrl, '_blank');
  
  // Complete the order process after sharing
  completeOrderProcess();
}

function completeOrderProcess() {
  // Clear cart and redirect to thank you page
  cart.length = 0;
  saveCart();
  updateCartCount();
  
  showNotification('Order placed successfully!', 'success');
  
  setTimeout(() => {
    window.location.href = `thankyou.html?orderId=${currentOrderId}`;
  }, 1500);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export { calculateDistance, calculateDeliveryTime };