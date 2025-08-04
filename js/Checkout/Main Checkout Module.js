// Import necessary modules
import { initCheckoutPage } from './checkout/init.js';
import { AppState } from './main.js';

// Initialize the checkout page
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('checkout.html')) {
    // Initialize global state if needed
    AppState.locationObj = null;
    AppState.usingManualLoc = false;
    AppState.deliveryDistance = null;
    
    initCheckoutPage();
  }
});