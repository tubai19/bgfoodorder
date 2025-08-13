import { db, showNotification, updateCartCount } from './shared.js';

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
  // First check local time as fallback
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours + minutes / 60;
  
  const shopStatusBanner = document.getElementById('shopStatusBanner');
  const shopStatusText = document.getElementById('shopStatusText');
  
  // Then check Firebase for actual status
  const settingsRef = doc(db, 'settings', 'shop');
  onSnapshot(settingsRef, (doc) => {
    if (doc.exists()) {
      const settings = doc.data();
      const isOpen = settings.isOpen;
      const openingTime = parseTime(settings.openingTime);
      const closingTime = parseTime(settings.closingTime);
      
      if (shopStatusBanner && shopStatusText) {
        if (isOpen && currentTime >= openingTime && currentTime < closingTime) {
          shopStatusText.textContent = `Shop: Open (${settings.openingTime}-${settings.closingTime})`;
          shopStatusBanner.classList.add('open');
          shopStatusBanner.classList.remove('closed');
        } else {
          shopStatusText.textContent = `Shop: Closed (Opens at ${settings.openingTime})`;
          shopStatusBanner.classList.add('closed');
          shopStatusBanner.classList.remove('open');
        }
      }
    }
  });
}

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + minutes / 60;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initCommon);