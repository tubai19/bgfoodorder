let deferredPrompt;

// Initialize the app when DOM is loaded
function initApp() {
  initDOMElements();
  document.body.addEventListener('touchstart', function() {}, { passive: true });
  updateCartBadge();
  updateStatusDisplay();
  setupStatusListener();
  setupDeliveryInfoAccordion();
  
  // Track PWA installation
  window.addEventListener('appinstalled', () => {
    console.log('PWA installed');
    if (window.gtag) {
      gtag('event', 'pwa_installed');
    }
    showNotification('Thank you for installing our app!');
  });

  // Check network status on load
  if (!navigator.onLine) {
    document.body.classList.add('offline');
    showNotification('You are offline. Some features may not work.');
  }
}

// PWA Installation Prompt
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  // Show the install button
  showInstallPromotion();
});

function showInstallPromotion() {
  // Only show if not already installed
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return;
  }

  const prompt = document.createElement('div');
  prompt.className = 'install-prompt';
  prompt.innerHTML = `
    <div class="install-prompt-content">
      <i class="fas fa-download"></i>
      <span>Install Bake & Grill App</span>
      <div class="install-prompt-buttons">
        <button id="installButton">Install</button>
        <button id="dismissButton">&times;</button>
      </div>
    </div>
  `;
  document.body.appendChild(prompt);
  
  document.getElementById('installButton').addEventListener('click', () => {
    prompt.style.display = 'none';
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        if (window.gtag) {
          gtag('event', 'pwa_install_accepted');
        }
      } else {
        console.log('User dismissed the install prompt');
      }
      deferredPrompt = null;
    });
  });
  
  document.getElementById('dismissButton').addEventListener('click', () => {
    prompt.style.display = 'none';
    if (window.gtag) {
      gtag('event', 'pwa_install_dismissed');
    }
  });
}

// Network status detection
window.addEventListener('online', () => {
  document.body.classList.remove('offline');
  showNotification('You are back online');
});

window.addEventListener('offline', () => {
  document.body.classList.add('offline');
  showNotification('You are offline. Some features may not work.');
});

// Show notification to user
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
    }, 500);
  }, 3000);
}

// Initialize DOM elements
function initDOMElements() {
  // Add any DOM element initialization code here
}

// Update cart badge
function updateCartBadge() {
  // Add cart badge update logic here
}

// Update status display
function updateStatusDisplay() {
  // Add status display update logic here
}

// Setup status listener
function setupStatusListener() {
  // Add status listener setup here
}

// Setup delivery info accordion
function setupDeliveryInfoAccordion() {
  // Add delivery info accordion setup here
}

// Initialize the app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);