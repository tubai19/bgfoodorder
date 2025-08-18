// main.js
import { initPwaFeatures, showNotification, updateCartCount } from './shared.js';

function initCommon() {
  updateCartCount();
  
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
  
  const notification = document.getElementById('notification');
  if (notification) {
    notification.addEventListener('click', () => {
      notification.classList.remove('show');
    });
  }
  
  checkShopStatus();
  
  const cartOverlay = document.getElementById('cartOverlay');
  if (cartOverlay) {
    cartOverlay.addEventListener('click', () => {
      document.getElementById('mobileCartDrawer').classList.remove('open');
      cartOverlay.classList.remove('active');
    });
  }
}

function checkShopStatus() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours + minutes / 60;
  
  const shopStatusBanner = document.getElementById('shopStatusBanner');
  const shopStatusText = document.getElementById('shopStatusText');
  
  if (shopStatusBanner && shopStatusText) {
    shopStatusText.textContent = `Shop: Open (4PM-10PM)`;
    shopStatusBanner.classList.add('open');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initCommon();
  initPwaFeatures();
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful');
        registration.update().then(() => {
          if (registration.waiting) {
            showNotification('New version available! Refresh to update.', 'info');
          }
        });
      })
      .catch(err => {
        console.error('ServiceWorker registration failed:', err);
      });
  }
});

navigator.serviceWorker?.addEventListener('controllerchange', () => {
  window.location.reload();
});