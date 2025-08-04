let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  // Show the install button
  showInstallPromotion();
});

function showInstallPromotion() {
  const prompt = document.createElement('div');
  prompt.className = 'install-prompt';
  prompt.innerHTML = `
    <i class="fas fa-download"></i>
    <span>Install Bake & Grill App</span>
    <button id="installButton">Install</button>
    <button id="dismissButton">&times;</button>
  `;
  document.body.appendChild(prompt);
  
  document.getElementById('installButton').addEventListener('click', () => {
    prompt.style.display = 'none';
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      deferredPrompt = null;
    });
  });
  
  document.getElementById('dismissButton').addEventListener('click', () => {
    prompt.style.display = 'none';
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