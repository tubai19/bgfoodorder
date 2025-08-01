// optimization.js - Performance optimizations for Bake & Grill website

// 1. Load Deferred CSS
function loadDeferredStyles() {
  const addStylesNode = document.getElementById("deferred-styles");
  if (!addStylesNode) return;
  
  const replacement = document.createElement("div");
  replacement.innerHTML = addStylesNode.textContent;
  document.body.appendChild(replacement);
  addStylesNode.parentElement.removeChild(addStylesNode);
}

// 2. Lazy Loading for Images
function setupLazyLoading() {
  if ('IntersectionObserver' in window) {
    const lazyImages = [].slice.call(document.querySelectorAll('img.lazy'));
    
    const lazyImageObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          const lazyImage = entry.target;
          lazyImage.src = lazyImage.dataset.src;
          if (lazyImage.dataset.srcset) {
            lazyImage.srcset = lazyImage.dataset.srcset;
          }
          lazyImage.classList.remove('lazy');
          lazyImageObserver.unobserve(lazyImage);
        }
      });
    });

    lazyImages.forEach(function(lazyImage) {
      lazyImageObserver.observe(lazyImage);
    });
  }
}

// 3. Resource Preloading
function preloadCriticalResources() {
  const resources = [
    { href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css', as: 'style' },
    { href: 'styles.css', as: 'style' },
    { href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', as: 'style' },
    { href: 'script.js', as: 'script' }
  ];

  resources.forEach(resource => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = resource.as;
    link.href = resource.href;
    if (resource.as === 'style') {
      link.onload = "this.rel='stylesheet'";
    }
    document.head.appendChild(link);
  });
}

// 4. Passive Event Listeners
function setupPassiveEventListeners() {
  const passiveOptions = {
    passive: true,
    capture: false
  };

  const events = ['scroll', 'touchmove', 'touchstart', 'touchend', 'wheel'];
  
  events.forEach(event => {
    window.addEventListener(event, function() {}, passiveOptions);
  });
}

// 5. Lazy Load Heavy Libraries
function lazyLoadFirebase() {
  return new Promise((resolve) => {
    if (typeof firebase === 'undefined') {
      const firebaseScript = document.createElement('script');
      firebaseScript.src = 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js';
      firebaseScript.onload = () => {
        const firestoreScript = document.createElement('script');
        firestoreScript.src = 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore-compat.js';
        firestoreScript.onload = resolve;
        document.head.appendChild(firestoreScript);
      };
      document.head.appendChild(firebaseScript);
    } else {
      resolve();
    }
  });
}

function lazyLoadLeaflet() {
  return new Promise((resolve) => {
    if (typeof L === 'undefined') {
      const leafletScript = document.createElement('script');
      leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      leafletScript.onload = () => {
        const geocoderScript = document.createElement('script');
        geocoderScript.src = 'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.js';
        geocoderScript.onload = resolve;
        document.head.appendChild(geocoderScript);
      };
      document.head.appendChild(leafletScript);
    } else {
      resolve();
    }
  });
}

// 6. Connection-aware loading
function connectionAwareLoading() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  if (connection) {
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      // Load fewer resources for slow connections
      document.documentElement.classList.add('slow-connection');
    }
  }
}

// Initialize all optimizations
document.addEventListener('DOMContentLoaded', function() {
  // Load deferred CSS after first paint
  const raf = requestAnimationFrame || function(cb) { setTimeout(cb, 0); };
  raf(function() {
    raf(loadDeferredStyles);
  });

  setupLazyLoading();
  preloadCriticalResources();
  setupPassiveEventListeners();
  connectionAwareLoading();
  
  // Export lazy load functions for main script to use
  window.lazyLoadFirebase = lazyLoadFirebase;
  window.lazyLoadLeaflet = lazyLoadLeaflet;
});

// Web Vitals Monitoring (optional)
if (typeof window.ga === 'function') {
  const webVitals = import('https://unpkg.com/web-vitals?module');
  webVitals.then(({ getCLS, getFID, getLCP, getFCP, getTTFB }) => {
    getCLS(console.log);
    getFID(console.log);
    getLCP(console.log);
    getFCP(console.log);
    getTTFB(console.log);
  });
}