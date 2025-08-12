import { showNotification, updateCartCount } from './shared.js';

// Common functionality across all pages
function initCommon() {
  // Update cart count on all pages
  updateCartCount();
  
  // Setup mobile cart button if it exists
  const mobileCartBtn = document.getElementById('mobileCartBtn');
  if (mobileCartBtn) {
    mobileCartBtn.addEventListener('click', () => {
      const cartDrawer = document.getElementById('mobileCartDrawer');
      if (cartDrawer) {
        cartDrawer.classList.add('open');
        document.getElementById('cartOverlay').classList.add('active');
      }
    });
  }
  
  // Setup notification close
  const notification = document.getElementById('notification');
  if (notification) {
    notification.addEventListener('click', () => {
      notification.classList.remove('show');
    });
  }
  
  // Check if shop is open
  checkShopStatus();
  
  // Close cart drawer when overlay clicked
  const cartOverlay = document.getElementById('cartOverlay');
  if (cartOverlay) {
    cartOverlay.addEventListener('click', () => {
      document.getElementById('mobileCartDrawer').classList.remove('open');
      cartOverlay.classList.remove('active');
    });
  }
}

// Check shop status with improved time handling
function checkShopStatus() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours + minutes / 60;
  
  const shopOpenTime = 16; // 4 PM
  const shopCloseTime = 22; // 10 PM
  
  const shopStatusBanner = document.getElementById('shopStatusBanner');
  const shopStatusText = document.getElementById('shopStatusText');
  const deliveryStatusText = document.getElementById('deliveryStatusText');
  
  if (shopStatusBanner && shopStatusText) {
    if (currentTime >= shopOpenTime && currentTime < shopCloseTime) {
      shopStatusText.textContent = 'Shop: Open (4PM-10PM)';
      shopStatusBanner.classList.add('open');
      shopStatusBanner.classList.remove('closed');
    } else {
      shopStatusText.textContent = 'Shop: Closed (Opens at 4PM)';
      shopStatusBanner.classList.add('closed');
      shopStatusBanner.classList.remove('open');
    }
  }
  
  if (deliveryStatusText) {
    deliveryStatusText.textContent = 'Delivery: Available (8km radius)';
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initCommon);