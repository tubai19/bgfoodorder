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
  deliveryShareLocationBtn: document.getElementById('deliveryShareLocationBtn'),
  currentLocStatusMsg: document.getElementById('currentLocStatusMsg'),
  deliveryDistanceDisplay: document.getElementById('deliveryDistanceDisplay'),
  distanceText: document.getElementById('distanceText'),
  deliveryTimeEstimate: document.getElementById('deliveryTimeEstimate'),
  timeEstimateText: document.getElementById('timeEstimateText'),
  notifyStatus: document.getElementById('notifyStatus'),
  notifyOffers: document.getElementById('notifyOffers'),
  notificationStatus: document.getElementById('notificationStatus')
};

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
    validateAndPlaceOrder();
  });

  elements.orderTypeRadios.forEach(radio => {
    radio.addEventListener('change', updateOrderSummary);
  });

  elements.deliveryShareLocationBtn.addEventListener('click', shareCurrentLocation);
  
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

function validateAndPlaceOrder() {
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

  // Save order and send WhatsApp message directly
  saveOrderToDatabase().then(orderId => {
    if (orderId) {
      currentOrderId = orderId;
      sendWhatsAppMessage(orderId, 'customer');
      completeOrderProcess();
    } else {
      showNotification('Failed to create order. Please try again.', 'error');
    }
  });
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

function sendWhatsAppMessage(orderId, recipientType) {
  const orderType = getOrderType();
  const totals = calculateTotal();
  const distance = orderType === 'Delivery' ? calculateDistance(
    shopLocation.lat, shopLocation.lng,
    userLocation.lat, userLocation.lng
  ) : 0;
  
  // Construct the order status URL
  const orderStatusUrl = `${window.location.origin}/order-status.html?orderId=${orderId}`;
  
  const messageParts = [
    `*${recipientType === 'customer' ? 'NEW ORDER - BG Pizzo' : 'YOUR ORDER CONFIRMATION - BG Pizzo'}*`,
    ``,
    `*Order ID:* #${orderId}`,
    `*Customer Name:* ${elements.customerName.value}`,
    `*Phone:* ${elements.phoneNumber.value}`,
    `*Order Type:* ${orderType}`,
    `*Track your order:* ${orderStatusUrl}`
  ];

  if (orderType === 'Delivery') {
    const mapsLink = `https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}`;
    
    messageParts.push(
      `*Delivery Location:* ${mapsLink}`,
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
      messageParts.push(`  🚚 Free delivery on combos`);
    }
  });
  
  messageParts.push(
    ``,
    `*Subtotal:* ${formatPrice(totals.subtotal)}`,
    `*Delivery Charge:* ${formatPrice(totals.deliveryCharge)}`,
    `*Grand Total:* ${formatPrice(totals.grandTotal)}`,
    ``
  );
  
  if (elements.orderNotes.value) {
    messageParts.push(`*Order Notes:* ${elements.orderNotes.value}`);
  }
  
  if (recipientType === 'customer') {
    messageParts.push(
      ``,
      `Thank you for your order! We'll notify you when your order status changes.`
    );
  } else {
    messageParts.push(
      ``,
      `Please confirm this order by replying to this message.`
    );
  }
  
  const message = encodeURIComponent(messageParts.join('\n'));
  
  // Use different WhatsApp numbers based on recipient
  const whatsappNumber = recipientType === 'customer' ? '918240266267' : '918240266267';
  
  // Open WhatsApp with the message
  window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
}

async function saveOrderToDatabase() {
  const orderType = getOrderType();
  const totals = calculateTotal();
  const distance = orderType === 'Delivery' ? calculateDistance(
    shopLocation.lat, shopLocation.lng,
    userLocation.lat, userLocation.lng
  ) : 0;

  const orderData = {
    customerName: elements.customerName.value,
    phoneNumber: elements.phoneNumber.value,
    orderType: orderType,
    items: cart.map(item => ({
      name: item.name,
      variant: item.variant || '',
      quantity: item.quantity,
      price: item.price
    })),
    subtotal: totals.subtotal,
    deliveryCharge: totals.deliveryCharge,
    grandTotal: totals.grandTotal,
    notes: elements.orderNotes.value || '',
    status: 'pending',
    createdAt: serverTimestamp(),
    notifyStatus: elements.notifyStatus?.checked || false,
    notifyOffers: elements.notifyOffers?.checked || false
  };

  if (orderType === 'Delivery') {
    orderData.deliveryLocation = new GeoPoint(userLocation.lat, userLocation.lng);
    orderData.distance = distance;
    orderData.estimatedTime = basePrepTime + Math.round(distance * minutesPerKm);
  }

  try {
    const docRef = await addDoc(collection(db, "orders"), orderData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding order: ", error);
    return null;
  }
}

function completeOrderProcess() {
  // Clear the cart
  cart.length = 0;
  saveCart();
  updateCartCount();
  
  // Show success message
  showNotification('Order placed successfully! Check WhatsApp for confirmation.', 'success');
  
  // Redirect to order status page
  setTimeout(() => {
    window.location.href = `order-status.html?orderId=${currentOrderId}`;
  }, 3000);
}