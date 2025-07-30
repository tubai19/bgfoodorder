// ... (keep all your existing code until the button section) ...

// Initialize Place Order Button
const placeOrderBtn = document.getElementById('placeOrderBtn');

// Unified click/touch handler
async function handleOrderButton(e) {
  e.preventDefault();
  
  // Don't proceed if button is disabled
  if (placeOrderBtn.disabled) return;
  
  // Add active state
  placeOrderBtn.classList.add('active');
  placeOrderBtn.disabled = true;
  
  // Small vibration feedback if available
  if ('vibrate' in navigator) navigator.vibrate(20);
  
  try {
    await confirmOrder();
  } catch (error) {
    console.error("Order error:", error);
    showNotification("Error placing order. Please try again.");
  } finally {
    // Reset button state
    placeOrderBtn.classList.remove('active');
    placeOrderBtn.disabled = false;
  }
}

// Add event listeners
placeOrderBtn.addEventListener('click', handleOrderButton);
placeOrderBtn.addEventListener('touchend', handleOrderButton, { passive: true });

// Touch feedback
placeOrderBtn.addEventListener('touchstart', function() {
  if (!this.disabled) {
    this.classList.add('active');
  }
}, { passive: true });

placeOrderBtn.addEventListener('touchcancel', function() {
  this.classList.remove('active');
}, { passive: true });

// Update button state in your updateCart() function
function updateCart() {
  // ... (keep your existing cart update code) ...
  
  // Update button disabled state
  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  let isValidOrder = selectedItems.length > 0;
  
  if (orderType === 'Delivery') {
    isValidOrder = isValidOrder && 
      locationObj && 
      deliveryDistance <= RESTAURANT_SETTINGS.maxDeliveryDistance &&
      subtotal >= RESTAURANT_SETTINGS.minDeliveryOrder;
  }
  
  placeOrderBtn.disabled = !isValidOrder;
  
  // Add aria-label for accessibility
  placeOrderBtn.setAttribute('aria-label', 
    isValidOrder ? 'Place your order' : 'Add items to place order');
  
  // Add tooltip for disabled state
  if (placeOrderBtn.disabled) {
    if (selectedItems.length === 0) {
      placeOrderBtn.title = 'Add items to your cart first';
    } else if (orderType === 'Delivery' && (!locationObj || deliveryDistance > RESTAURANT_SETTINGS.maxDeliveryDistance)) {
      placeOrderBtn.title = 'Delivery not available to your location';
    } else if (orderType === 'Delivery' && subtotal < RESTAURANT_SETTINGS.minDeliveryOrder) {
      placeOrderBtn.title = `Minimum delivery order is ₹${RESTAURANT_SETTINGS.minDeliveryOrder}`;
    }
  } else {
    placeOrderBtn.removeAttribute('title');
  }
}

// ... (keep all your remaining existing code) ...

// Modify confirmOrder() to return a Promise
async function confirmOrder() {
  return new Promise(async (resolve, reject) => {
    try {
      // ... (keep your existing confirmOrder logic) ...
      
      // When order is successfully confirmed:
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}