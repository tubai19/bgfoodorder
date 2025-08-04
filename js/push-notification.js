document.addEventListener('DOMContentLoaded', () => {
  // Request notification permission
  if ('Notification' in window) {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('Notification permission granted');
        subscribeToPushNotifications();
      }
    });
  }

  // Check if the app is running as PWA
  if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('Running as PWA');
    document.body.classList.add('pwa-mode');
  }

  // Listen for changes in display mode
  window.matchMedia('(display-mode: standalone)').addEventListener('change', (evt) => {
    if (evt.matches) {
      document.body.classList.add('pwa-mode');
    } else {
      document.body.classList.remove('pwa-mode');
    }
  });
});

// Check for updates
function checkForUpdates() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.update().then(() => {
        console.log('Service Worker updated');
      });
    });
  }
}

// Check for updates every hour
setInterval(checkForUpdates, 60 * 60 * 1000);