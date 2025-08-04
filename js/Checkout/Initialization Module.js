import { AppState, initApp, saveCartToStorage } from '../main.js';
import { updateCheckoutDisplay, showOrHideLocationBlock } from './display.js';
import { handleLocationSharing, showManualLocationFields } from './location.js';
import { confirmOrder } from './order.js';
import { showOrderHistory, clearOrderHistory } from './history.js';
import { requestNotificationPermission } from './notifications.js';

export function initCheckoutPage() {
  // Initialize the app
  initApp();
  
  // Load cart from storage
  updateCheckoutDisplay();
  
  // Set up order type toggle
  const orderTypeRadios = document.querySelectorAll('input[name="orderType"]');
  orderTypeRadios.forEach(radio => {
    radio.addEventListener('change', showOrHideLocationBlock);
  });
  
  // Set up location sharing
  const deliveryShareLocationBtn = document.getElementById('deliveryShareLocationBtn');
  if (deliveryShareLocationBtn) {
    deliveryShareLocationBtn.addEventListener('click', handleLocationSharing);
  }
  
  // Set up manual location entry
  const deliveryShowManualLocBtn = document.getElementById('deliveryShowManualLocBtn');
  if (deliveryShowManualLocBtn) {
    deliveryShowManualLocBtn.addEventListener('click', showManualLocationFields);
  }
  
  // Set up place order button
  const placeOrderBtn = document.getElementById('placeOrderBtn');
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', confirmOrder);
  }
  
  // Set up order history
  const viewOrderHistoryBtn = document.getElementById('viewOrderHistoryBtn');
  if (viewOrderHistoryBtn) {
    viewOrderHistoryBtn.addEventListener('click', showOrderHistory);
  }
  
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', clearOrderHistory);
  }
  
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener('click', () => {
      document.getElementById('orderHistoryModal').style.display = 'none';
    });
  }
  
  // Request notification permission when phone number is entered
  const phoneNumber = document.getElementById('phoneNumber');
  if (phoneNumber) {
    phoneNumber.addEventListener('change', function() {
      if (this.value && this.value.length === 10) {
        localStorage.setItem('userPhone', this.value);
        requestNotificationPermission();
      }
    });
  }
  
  // Initial state
  showOrHideLocationBlock();
}