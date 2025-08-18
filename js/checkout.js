import { 
  cart, saveCart, updateCartCount, showNotification, formatPrice, validateOrder,
  requestNotificationPermission, updateNotificationPreferences, sendOrderNotification,
  serverTimestamp, GeoPoint, addDoc, collection, doc, setDoc, db,
  getNotificationPreferences, sendOrderUpdateWithFallback,
  query, where, orderBy, limit, getDocs
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
  notificationStatus: document.getElementById('notificationStatus')
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
  document.querySelector('.close-modal').addEventListener('click', closeConfirmationModal);
  window.addEventListener('click', (e) => {
    if (e.target === elements.orderConfirmationModal) {
      closeConfirmationModal();
    }
  });

  if (elements.notifyStatus) {
    elements.notifyStatus.addEventListener('change', saveNotificationPreferences);
  }
  if (elements.notifyOffers) {
    elements.notifyOffers.addEventListener('change', saveNotificationPreferences);
  }

  // Add event listener for phone number input to load order history
  elements.phoneNumber.addEventListener('input', debounce(() => {
    if (elements.phoneNumber.value.trim().length === 10) {
      loadOrderHistory();
      setupNotificationPreferences();
    }
  }, 500));
}

async function loadOrderHistory() {
  const phone = elements.phoneNumber.value.trim();
  if (!phone) return;

  try {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, 
      where('phoneNumber', '==', phone),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    
    const querySnapshot = await getDocs(q);
    const orderHistoryList = document.getElementById('orderHistoryList');
    
    if (querySnapshot.empty) {
      orderHistoryList.innerHTML = '<p class="no-orders">No previous orders found</p>';
      return;
    }

    let html = '';
    querySnapshot.forEach((doc) => {
      const order = doc.data();
      const orderDate = order.timestamp?.toDate() || new Date();
      
      html += `
        <div class="mobile-order-item">
          <div class="order-header">
            <span class="order-id">#${order.id}</span>
            <span class="order-date">${orderDate.toLocaleDateString()}</span>
          </div>
          <div class="order-summary">
            ${order.items.slice(0, 2).map(item => 
              `${item.quantity}x ${item.name}${item.variant ? ` (${item.variant})` : ''}`
            ).join(', ')}
            ${order.items.length > 2 ? ` +${order.items.length - 2} more` : ''}
          </div>
          <div class="order-footer">
            <span class="order-total">${formatPrice(order.total)}</span>
            <span class="order-status ${order.status}">${order.status}</span>
          </div>
        </div>
      `;
    });

    orderHistoryList.innerHTML = html;
  } catch (error) {
    console.error('Error loading order history:', error);
    document.getElementById('orderHistoryList').innerHTML = 
      '<p class="error-message">Failed to load order history</p>';
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

function sendWhatsAppMessage(orderId) {
  const orderType = getOrderType();
  const totals = calculateTotal();
  const distance = orderType === 'Delivery' ? calculateDistance(
    shopLocation.lat, shopLocation.lng,
    userLocation.lat, userLocation.lng
  ) : 0;
  
  // Construct the order status URL
  const orderStatusUrl = `${window.location.origin}/order-status.html?orderId=${orderId}`;
  
  const messageParts = [
    `*NEW ORDER - BAKE & GRILL*`,
    ``,
    `*Order ID:* #${orderId}`,
    `*Customer Name:* ${elements.customerName.value}`,
    `*Phone:* ${elements.phoneNumber.value}`,
    `*Order Type:* ${orderType}`,
    `*Track your order:* ${orderStatusUrl}`
  ];

  if (orderType === 'Delivery') {
    const mapsLink = `https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}`;
    const address = elements.manualDeliveryAddress.value || 'Current Location';
    
    messageParts.push(
      `*Delivery Address:* ${address}`,
      `*Location:* ${mapsLink}`,
      `*Distance:* ${distance.toFixed(1)} km`
    );
    
    if (totals.subtotal > freeDeliveryThreshold) {
      messageParts.push(`*Delivery Charge:* Free (order above ₹${freeDeliveryThreshold})`);
    } else if (distance <= 4) {
      messageParts.push(`*Delivery Charge:* Free (0-4 km)`);
    } else if (distance <= 6) {
      messageParts.push(`*Delivery Charge:* ₹20 (4-6 km)`);
    } else if (distance <= 8) {
      messageParts.push(`*Delivery Charge:* ₹30 (6-8 km)`);
    }
    
    messageParts.push(`*Estimated Time:* ${basePrepTime + Math.round(distance * minutesPerKm)} minutes`);
  }
  
  messageParts.push(
    ``,
    `*ORDER ITEMS:*`
  );
  
  cart.forEach(item => {
    messageParts.push(`- ${item.quantity}x ${item.name}${item.variant ? ` (${item.variant})` : ''} - ${formatPrice(item.price * item.quantity)}`);
    if (orderType === 'Delivery' && item.category === 'Combos') {
      messageParts.push(`  (PICKUP ONLY - NOT INCLUDED IN DELIVERY)`);
    }
  });
  
  messageParts.push(
    ``,
    `*SUBTOTAL:* ${formatPrice(totals.subtotal)}`
  );
  
  if (orderType === 'Delivery') {
    messageParts.push(`*DELIVERY CHARGE:* ${formatPrice(totals.deliveryCharge)}`);
  }
  
  messageParts.push(
    `*TOTAL AMOUNT:* ${formatPrice(totals.grandTotal)}`,
    ``
  );
  
  if (elements.orderNotes.value) {
    messageParts.push(
      `*SPECIAL INSTRUCTIONS:*`,
      `${elements.orderNotes.value}`,
      ``
    );
  }

  if (elements.notifyStatus || elements.notifyOffers) {
    messageParts.push(
      `*NOTIFICATION PREFERENCES:*`,
      `Order Updates: ${elements.notifyStatus?.checked ? 'Yes' : 'No'}`,
      `Special Offers: ${elements.notifyOffers?.checked ? 'Yes' : 'No'}`,
      ``
    );
  }
  
  messageParts.push(
    `*Order Time:* ${new Date().toLocaleString()}`,
    ``,
    `Track your order status: ${orderStatusUrl}`
  );

  const encodedMessage = encodeURIComponent(messageParts.join('\n'));
  const whatsappUrl = `https://wa.me/918240266267?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
}

async function confirmOrder() {
  const orderType = getOrderType();
  const totals = calculateTotal();
  const distance = orderType === 'Delivery' ? calculateDistance(
    shopLocation.lat, shopLocation.lng,
    userLocation.lat, userLocation.lng
  ) : 0;
  
  const orderNumber = Math.floor(100000 + Math.random() * 900000);
  const orderId = `BG-${orderNumber}`;
  
  try {
    const orderRef = doc(collection(db, 'orders'), orderId);
    await setDoc(orderRef, {
      id: orderId,
      customerName: elements.customerName.value,
      phoneNumber: elements.phoneNumber.value,
      orderType: orderType,
      items: cart.map(item => ({
        name: item.name,
        variant: item.variant,
        price: item.price,
        quantity: item.quantity,
        category: item.category
      })),
      subtotal: totals.subtotal,
      deliveryCharge: orderType === 'Delivery' ? totals.deliveryCharge : 0,
      total: totals.grandTotal,
      status: 'pending',
      timestamp: serverTimestamp(),
      ...(orderType === 'Delivery' && userLocation && {
        deliveryAddress: elements.manualDeliveryAddress.value || 'Current Location',
        location: new GeoPoint(userLocation.lat, userLocation.lng),
        distance: distance
      }),
      notificationPreferences: {
        statusUpdates: elements.notifyStatus?.checked || false,
        specialOffers: elements.notifyOffers?.checked || false
      },
      specialInstructions: elements.orderNotes.value || ''
    });

    if (elements.notifyStatus?.checked) {
      try {
        if (Notification.permission !== 'granted') {
          await Notification.requestPermission();
        }

        await saveNotificationPreferences();
        await sendOrderUpdateWithFallback(
          orderId,
          elements.phoneNumber.value,
          `Your order #${orderId} has been received! Status: Preparing`
        );
      } catch (error) {
        console.error('Notification setup failed:', error);
      }
    }

    sendWhatsAppMessage(orderId);

    closeConfirmationModal();
    showNotification('Order placed successfully!');
    
    cart.length = 0;
    saveCart();
    updateCartCount();
    
    setTimeout(() => {
      window.location.href = `order-status.html?orderId=${orderId}`;
    }, 2000);
  } catch (error) {
    console.error('Error confirming order:', error);
    showNotification('Failed to place order. Please try again.', 'error');
  }
}