import { cart, saveCart, updateCartCount, showNotification, formatPrice, validateOrder } from './shared.js';

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
  geocodingLoading: document.getElementById('geocodingLoading')
};

let map;
let marker;
let userLocation = null;
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
  document.querySelector('.close-modal').addEventListener('click', closeConfirmationModal);
  window.addEventListener('click', (e) => {
    if (e.target === elements.orderConfirmationModal) {
      closeConfirmationModal();
    }
  });
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

function calculateDistance(lat1, lon1, lat2, lon2) {
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

function updateDistanceAndTime() {
  if (!userLocation) return;
  
  const distance = calculateDistance(
    shopLocation.lat, shopLocation.lng,
    userLocation.lat, userLocation.lng
  );
  
  const deliveryTimeMinutes = Math.round(distance * minutesPerKm);
  const totalTimeMinutes = basePrepTime + deliveryTimeMinutes;
  
  elements.distanceText.textContent = `Distance: ${distance.toFixed(1)} km`;
  
  if (distance > 8) {
    elements.timeEstimateText.textContent = `Delivery not available (beyond 8 km)`;
    elements.placeOrderBtn.disabled = true;
    elements.placeOrderBtn.title = "Delivery not available beyond 8 km";
  } else {
    elements.timeEstimateText.textContent = `Estimated time: ${totalTimeMinutes} min (${basePrepTime} min prep + ${deliveryTimeMinutes} min delivery)`;
    elements.placeOrderBtn.disabled = false;
    elements.placeOrderBtn.title = "";
  }

  elements.deliveryDistanceDisplay.style.display = "block";
  elements.deliveryTimeEstimate.style.display = "block";
}

function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this, args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

function closeConfirmationModal() {
  elements.orderConfirmationModal.style.display = 'none';
}

function confirmOrder() {
  const orderType = getOrderType();
  const totals = calculateTotal();
  const distance = calculateDistance(
    shopLocation.lat, shopLocation.lng,
    userLocation.lat, userLocation.lng
  );
  
  // Generate a random 6-digit order number
  const orderNumber = Math.floor(100000 + Math.random() * 900000);
  
  let message = `*NEW ORDER - BAKE & GRILL*%0A%0A`;
  message += `*Order ID:* #${orderNumber}%0A`;
  message += `*Customer Name:* ${elements.customerName.value}%0A`;
  message += `*Phone:* ${elements.phoneNumber.value}%0A`;
  message += `*Order Type:* ${orderType}%0A`;
  
  if (orderType === 'Delivery') {
    message += `*Delivery Address:* ${elements.manualDeliveryAddress.value || 'Current Location'}%0A`;
    message += `*Distance:* ${distance.toFixed(1)} km%0A`;
    
    if (totals.subtotal > freeDeliveryThreshold) {
      message += `*Delivery Charge:* Free (order above ₹${freeDeliveryThreshold})%0A`;
    } else if (distance <= 4) {
      message += `*Delivery Charge:* Free (0-4 km)%0A`;
    } else if (distance <= 6) {
      message += `*Delivery Charge:* ₹20 (4-6 km)%0A`;
    } else if (distance <= 8) {
      message += `*Delivery Charge:* ₹30 (6-8 km)%0A`;
    }
    
    message += `*Estimated Time:* ${basePrepTime + Math.round(distance * minutesPerKm)} minutes%0A`;
  }
  
  message += `%0A*ORDER ITEMS:*%0A`;
  cart.forEach(item => {
    message += `- ${item.quantity}x ${item.name}${item.variant ? ` (${item.variant})` : ''} - ${formatPrice(item.price * item.quantity)}%0A`;
    if (orderType === 'Delivery' && item.category === 'Combos') {
      message += `  (PICKUP ONLY - NOT INCLUDED IN DELIVERY)%0A`;
    }
  });
  
  message += `%0A*SUBTOTAL:* ${formatPrice(totals.subtotal)}%0A`;
  if (orderType === 'Delivery') {
    message += `*DELIVERY CHARGE:* ${formatPrice(totals.deliveryCharge)}%0A`;
  }
  message += `*TOTAL AMOUNT:* ${formatPrice(totals.grandTotal)}%0A%0A`;
  
  if (elements.orderNotes.value) {
    message += `*SPECIAL INSTRUCTIONS:*%0A${elements.orderNotes.value}%0A%0A`;
  }
  
  message += `*Order Time:* ${new Date().toLocaleString()}`;

  const whatsappUrl = `https://wa.me/918240266267?text=${message}`;
  window.open(whatsappUrl, '_blank');
  
  closeConfirmationModal();
  showNotification('Order shared via WhatsApp!');
  
  cart.length = 0;
  saveCart();
  updateCartCount();
}