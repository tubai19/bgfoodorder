// Firebase configuration and initialization
const firebaseConfig = {
  apiKey: "AIzaSyBuBmCQvvNVFsH2x6XGrHXrgZyULB1_qH8",
  authDomain: "bakeandgrill-44c25.firebaseapp.com",
  projectId: "bakeandgrill-44c25",
  storageBucket: "bakeandgrill-44c25.appspot.com",
  messagingSenderId: "713279633359",
  appId: "1:713279633359:web:ba6bcd411b1b6be7b904ba",
  measurementId: "G-SLG2R88J72"
};

// Initialize Firebase
const firebaseApp = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Dynamic menu data loaded from Firestore
let fullMenu = {};

// Category icons mapping
const categoryIcons = {
  "Veg Pizzas": "🍕",
  "Paneer Specials": "🧀",
  "Non-Veg Pizzas": "🍗",
  "Burgers": "🍔",
  "Sandwiches": "🥪",
  "Quick Bites": "🍟",
  "Dips": "🥫",
  "Combos": "🎁"
};

// Restaurant location and delivery settings
const RESTAURANT_LOCATION = {
  lat: 22.3908,
  lng: 88.2189
};
const MAX_DELIVERY_DISTANCE = 8; // 8km maximum delivery distance
const MIN_DELIVERY_ORDER = 200;

// DOM elements
const selectedItems = [];
const tabsDiv = document.getElementById("tabs");
const container = document.getElementById("menuContainer");
const totalBill = document.getElementById("mobileLiveTotal");
const cartList = document.getElementById("cartItems");
const searchInput = document.getElementById("searchInput");
const deliveryChargeDisplay = document.getElementById("deliveryChargeDisplay");
const deliveryRestriction = document.getElementById("deliveryRestriction");
const notification = document.getElementById("notification");
const notificationText = document.getElementById("notificationText");
const mobileCartBtn = document.getElementById("mobileCartBtn");
const mobileCartDrawer = document.getElementById("mobileCartDrawer");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const viewOrderHistoryBtn = document.getElementById("viewOrderHistoryBtn");
const mobileClearCartBtn = document.getElementById("mobileClearCartBtn");
const mobileCheckoutBtn = document.getElementById("mobileCheckoutBtn");
const closeCartBtn = document.getElementById("closeCartBtn");
const statusBanner = document.getElementById("statusBanner");
const shopStatusBanner = document.getElementById("shopStatusBanner");
const deliveryStatusBanner = document.getElementById("deliveryStatusBanner");
const shopStatusText = document.getElementById("shopStatusText");
const deliveryStatusText = document.getElementById("deliveryStatusText");

// Location variables
let map;
let marker;
let locationObj = null;
let usingManualLoc = false;
let deliveryDistance = null;
let currentRating = 0;
let modalRating = 0;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
  // Add touch event listeners for better mobile interaction
  document.body.addEventListener('touchstart', function() {}, { passive: true });
  
  // Load menu and setup UI
  await loadMenuFromFirestore();
  setupMobileEventListeners();
  updateCart();
  setupRatingSystem();
  setupDeliveryAccordion();
  
  // Initialize status display and listener
  await updateStatusDisplay();
  setupStatusListener();
});

// Check shop status
function checkShopStatus() {
  return db.collection('publicStatus').doc('current').get()
    .then(doc => {
      if (doc.exists) {
        const status = doc.data();
        return status.isShopOpen !== false; // Default to open if not set
      }
      return true; // Default to open if no status exists
    })
    .catch(error => {
      console.error("Error checking shop status:", error);
      return true; // Default to open on error
    });
}

// Check delivery status
function checkDeliveryStatus() {
  return db.collection('publicStatus').doc('current').get()
    .then(doc => {
      if (doc.exists) {
        const status = doc.data();
        return status.isDeliveryAvailable !== false; // Default to available if not set
      }
      return true; // Default to available if no status exists
    })
    .catch(error => {
      console.error("Error checking delivery status:", error);
      return true; // Default to available on error
    });
}

// Update status display
async function updateStatusDisplay() {
  try {
    const [isShopOpen, isDeliveryAvailable] = await Promise.all([
      checkShopStatus(),
      checkDeliveryStatus()
    ]);

    // Update status text
    shopStatusText.textContent = isShopOpen ? 'Shop: Open' : 'Shop: Closed';
    deliveryStatusText.textContent = isDeliveryAvailable ? 'Delivery: Available' : 'Delivery: Unavailable';

    // Update styling
    shopStatusBanner.className = isShopOpen ? 'status-item open' : 'status-item closed';
    deliveryStatusBanner.className = isDeliveryAvailable ? 'status-item open' : 'status-item closed';

    // Disable order type options if shop is closed
    if (!isShopOpen) {
      document.querySelectorAll('input[name="orderType"]').forEach(radio => {
        radio.disabled = true;
      });
      statusBanner.classList.add('shop-closed');
    } else {
      document.querySelectorAll('input[name="orderType"]').forEach(radio => {
        radio.disabled = false;
      });
      statusBanner.classList.remove('shop-closed');
      
      // If delivery is closed, disable delivery option
      if (!isDeliveryAvailable) {
        document.querySelector('input[name="orderType"][value="Delivery"]').disabled = true;
        // Automatically switch to pickup if delivery was selected
        if (document.querySelector('input[name="orderType"]:checked').value === 'Delivery') {
          document.querySelector('input[name="orderType"][value="Pickup"]').checked = true;
          showOrHideLocationBlock();
        }
      } else {
        document.querySelector('input[name="orderType"][value="Delivery"]').disabled = false;
      }
    }
  } catch (error) {
    console.error("Error updating status display:", error);
  }
}

// Set up real-time listener for status changes
function setupStatusListener() {
  db.collection('publicStatus').doc('current').onSnapshot(doc => {
    if (doc.exists) {
      updateStatusDisplay();
    }
  });
}

// Load menu from Firestore
async function loadMenuFromFirestore() {
  try {
    const snapshot = await db.collection("menu").get();
    fullMenu = {};
    snapshot.forEach(doc => {
      fullMenu[doc.id] = doc.data().items;
    });
    console.log("✅ Menu loaded:", fullMenu);
    initializeTabs();
  } catch (error) {
    console.error("❌ Error loading menu:", error);
    showNotification("Failed to load menu. Please refresh the page.");
  }
}

// Initialize category tabs
function initializeTabs() {
  tabsDiv.innerHTML = '';
  
  for (const category in fullMenu) {
    const tabBtn = document.createElement("button");
    tabBtn.textContent = `${categoryIcons[category] || "🍽"} ${category}`;
    tabBtn.dataset.category = category;
    tabBtn.addEventListener('click', () => {
      searchInput.value = '';
      renderCategory(category);
      document.getElementById("menuContainer").scrollIntoView({ behavior: 'smooth' });
      
      document.querySelectorAll('#tabs button').forEach(btn => {
        btn.classList.remove('active');
      });
      tabBtn.classList.add('active');
    });
    tabsDiv.appendChild(tabBtn);
  }
  
  const firstCategory = Object.keys(fullMenu)[0];
  if (firstCategory) {
    tabsDiv.querySelector('button').classList.add('active');
    renderCategory(firstCategory);
  }
}

// Render menu items
function renderCategory(category, searchTerm = '') {
  container.innerHTML = "";
  
  const section = document.createElement("div");
  section.className = "menu-category";
  section.innerHTML = `<h3>${categoryIcons[category] || "🍽"} ${category}</h3>`;
  container.appendChild(section);

  const filteredItems = fullMenu[category].filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return item.name.toLowerCase().includes(term) || 
           (item.desc && item.desc.toLowerCase().includes(term));
  });

  if (filteredItems.length === 0) {
    container.innerHTML = '<div class="no-results">No items found matching your search.</div>';
    return;
  }

  const itemsContainer = document.createElement("div");
  itemsContainer.className = "menu-items";
  container.appendChild(itemsContainer);

  filteredItems.forEach((item) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "menu-item";
    
    if (category === "Combos" && document.querySelector('input[name="orderType"]:checked').value === "Delivery") {
      itemDiv.classList.add("disabled-item");
      const overlay = document.createElement("div");
      overlay.className = "disabled-overlay";
      overlay.textContent = "Combos not available for delivery";
      itemDiv.appendChild(overlay);
    }

    // Add distance display if location is available
    const orderType = document.querySelector('input[name="orderType"]:checked').value;
    if (locationObj && orderType === "Delivery") {
      const distanceDisplay = document.createElement("div");
      distanceDisplay.className = "distance-display";
      distanceDisplay.textContent = `${deliveryDistance ? deliveryDistance.toFixed(1)+'km' : '?'}`;
      itemDiv.appendChild(distanceDisplay);
    }

    const itemDetails = document.createElement("div");
    itemDetails.className = "menu-item-details";
    
    const title = document.createElement("div");
    title.className = "menu-item-name";
    title.textContent = item.name;
    
    if (item.nameBn) {
      const bn = document.createElement("div");
      bn.className = "menu-item-name-bn";
      bn.textContent = item.nameBn;
      itemDetails.appendChild(bn);
    }
    
    const desc = document.createElement("div");
    desc.className = "menu-item-desc";
    desc.textContent = item.desc || "";
    
    const variantDiv = document.createElement("div");
    variantDiv.className = "variant-selector";
    
    Object.entries(item.variants).forEach(([variant, price], index) => {
      const variantOption = document.createElement("div");
      variantOption.className = "variant-option";
      
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `variant-${item.name.replace(/\s+/g, '-')}`;
      input.id = `variant-${item.name.replace(/\s+/g, '-')}-${variant.replace(/\s+/g, '-')}`;
      input.value = variant;
      input.dataset.price = price;
      
      if (index === 0) {
        input.checked = true;
      }
      
      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.textContent = `${variant} - ₹${price}`;
      label.style.cursor = "pointer";
      
      variantOption.appendChild(input);
      variantOption.appendChild(label);
      variantDiv.appendChild(variantOption);
    });
    
    const priceDiv = document.createElement("div");
    priceDiv.className = "menu-item-price";
    priceDiv.textContent = `₹${Object.values(item.variants)[0]}`;
    
    const controlsDiv = document.createElement("div");
    controlsDiv.className = "menu-item-controls";
    
    const quantityDiv = document.createElement("div");
    quantityDiv.className = "quantity-control";
    
    const minusBtn = document.createElement("button");
    minusBtn.className = "quantity-btn minus";
    minusBtn.innerHTML = "−";
    minusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const quantitySpan = minusBtn.nextElementSibling;
      let quantity = parseInt(quantitySpan.textContent);
      if (quantity > 0) {
        quantitySpan.textContent = quantity - 1;
        if ('vibrate' in navigator) navigator.vibrate(10);
      }
    });
    
    const quantitySpan = document.createElement("span");
    quantitySpan.className = "quantity";
    quantitySpan.textContent = "0";
    
    const plusBtn = document.createElement("button");
    plusBtn.className = "quantity-btn plus";
    plusBtn.innerHTML = "+";
    plusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const quantitySpan = plusBtn.previousElementSibling;
      quantitySpan.textContent = parseInt(quantitySpan.textContent) + 1;
      if ('vibrate' in navigator) navigator.vibrate(10);
    });
    
    quantityDiv.appendChild(minusBtn);
    quantityDiv.appendChild(quantitySpan);
    quantityDiv.appendChild(plusBtn);
    
    const addBtn = document.createElement("button");
    addBtn.className = "add-to-cart";
    addBtn.innerHTML = '<i class="fas fa-cart-plus"></i> Add';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const quantity = parseInt(quantitySpan.textContent);
      if (quantity > 0) {
        const selectedVariant = variantDiv.querySelector('input[name^="variant-"]:checked');
        if (selectedVariant) {
          addToOrder(
            item.name,
            selectedVariant.value,
            parseInt(selectedVariant.dataset.price),
            quantity
          );
          quantitySpan.textContent = "0";
          if ('vibrate' in navigator) navigator.vibrate(20);
        }
      }
    });
    
    controlsDiv.appendChild(quantityDiv);
    controlsDiv.appendChild(addBtn);
    
    itemDetails.appendChild(title);
    if (item.desc) itemDetails.appendChild(desc);
    itemDetails.appendChild(variantDiv);
    itemDetails.appendChild(priceDiv);
    itemDetails.appendChild(controlsDiv);
    
    itemDiv.appendChild(itemDetails);
    itemsContainer.appendChild(itemDiv);
    
    variantDiv.querySelectorAll('input[name^="variant-"]').forEach(input => {
      input.addEventListener('change', () => {
        priceDiv.textContent = `₹${input.dataset.price}`;
      });
    });
  });
}

// Setup mobile event listeners
function setupMobileEventListeners() {
  // Mobile cart toggle
  mobileCartBtn.addEventListener('click', toggleMobileCart);
  closeCartBtn.addEventListener('click', toggleMobileCart);
  
  // Mobile clear cart
  mobileClearCartBtn.addEventListener('click', function() {
    if (selectedItems.length > 0 && confirm('Are you sure you want to clear your cart?')) {
      selectedItems.length = 0;
      updateCart();
      showNotification('Cart cleared');
      if ('vibrate' in navigator) navigator.vibrate(50);
    }
  });
  
  // Mobile checkout
  mobileCheckoutBtn.addEventListener('click', function() {
    if (selectedItems.length === 0) {
      showNotification('Your cart is empty');
      return;
    }
    toggleMobileCart();
    document.querySelector('.mobile-form-section').classList.add('visible');
    document.querySelector('.mobile-form-section').scrollIntoView({ behavior: 'smooth' });
  });
  
  // Overlay click to close cart
  document.querySelector('.overlay')?.addEventListener('click', toggleMobileCart);
  
  // For mandatory location on delivery
  const orderTypeRadios = document.querySelectorAll('input[name="orderType"]');
  const locationChoiceBlock = document.getElementById('locationChoiceBlock');
  const deliveryShareLocationBtn = document.getElementById('deliveryShareLocationBtn');
  const deliveryShowManualLocBtn = document.getElementById('deliveryShowManualLocBtn');
  const currentLocStatusMsg = document.getElementById('currentLocStatusMsg');
  const manualLocationFields = document.getElementById('manualLocationFields');
  const manualDeliveryAddress = document.getElementById('manualDeliveryAddress');

  function resetLocationChoiceBlock() {
    locationChoiceBlock.style.display = 'block';
    currentLocStatusMsg.textContent = '';
    deliveryShowManualLocBtn.style.display = 'none';
    manualLocationFields.style.display = 'none';
    manualDeliveryAddress.value = '';
    locationObj = null;
    usingManualLoc = false;
  }

  function showOrHideLocationBlock() {
    if (document.querySelector('input[name="orderType"]:checked').value === 'Delivery') {
      resetLocationChoiceBlock();
      locationChoiceBlock.style.display = 'block';
    } else {
      locationChoiceBlock.style.display = 'none';
      locationObj = null;
      usingManualLoc = false;
    }
    updateCart();
  }

  orderTypeRadios.forEach(radio => {
    radio.addEventListener('change', showOrHideLocationBlock);
  });

  // On initial load
  showOrHideLocationBlock();

  deliveryShareLocationBtn.onclick = function () {
    currentLocStatusMsg.style.color = "#333";
    currentLocStatusMsg.textContent = "Detecting your current location...";
    if (!navigator.geolocation) {
      currentLocStatusMsg.style.color = "#e63946";
      currentLocStatusMsg.textContent = "Geolocation is not supported by your browser.";
      deliveryShowManualLocBtn.style.display = 'block';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locationObj = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        currentLocStatusMsg.style.color = "#2a9d8f";
        currentLocStatusMsg.textContent = `Location received!`;
        deliveryShowManualLocBtn.style.display = 'none';
        manualLocationFields.style.display = 'none';
        usingManualLoc = false;
        
        // Calculate distance
        calculateRoadDistance(pos.coords.latitude, pos.coords.longitude, RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng)
          .then(distance => {
            deliveryDistance = distance;
            updateCart();
            checkDeliveryRestriction();
          });
      },
      (err) => {
        currentLocStatusMsg.style.color = "#e63946";
        currentLocStatusMsg.textContent = "Unable to get your location. Please allow location access or enter manually.";
        deliveryShowManualLocBtn.style.display = 'block';
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  deliveryShowManualLocBtn.onclick = function () {
    usingManualLoc = true;
    manualLocationFields.style.display = 'block';
    currentLocStatusMsg.textContent = '';
    
    // Initialize map if not already done
    if (!map) {
      initMap();
    } else {
      // Reset map view
      map.setView([RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng], 14);
      marker.setLatLng([RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng]);
    }
    
    // Focus on address field
    document.getElementById('manualDeliveryAddress').focus();
  };

  searchInput.addEventListener('input', (e) => {
    const activeTab = document.querySelector('#tabs button.active');
    if (activeTab) {
      renderCategory(activeTab.dataset.category, e.target.value);
    }
  });

  placeOrderBtn.addEventListener('click', confirmOrder);
  viewOrderHistoryBtn.addEventListener('click', showOrderHistory);
  
  document.getElementById('closeHistoryBtn').addEventListener('click', function() {
    document.getElementById('orderHistoryModal').style.display = 'none';
  });
  
  document.getElementById('clearHistoryBtn').addEventListener('click', clearOrderHistory);
  
  window.addEventListener('click', function(event) {
    if (event.target.classList.contains('mobile-modal')) {
      event.target.style.display = 'none';
    }
  });
}

// Toggle mobile cart drawer
function toggleMobileCart() {
  mobileCartDrawer.classList.toggle('active');
  document.body.style.overflow = mobileCartDrawer.classList.contains('active') ? 'hidden' : '';
  
  // Show order section when cart is opened
  if (mobileCartDrawer.classList.contains('active')) {
    document.querySelector('.mobile-form-section').classList.add('visible');
    document.querySelector('.mobile-footer').classList.add('with-form');
    document.querySelector('.mobile-form-section').scrollIntoView({ behavior: 'smooth' });
  } else {
    document.querySelector('.mobile-footer').classList.remove('with-form');
  }
  
  // Create or toggle overlay
  let overlay = document.querySelector('.overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'overlay';
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle('active');
}

// Initialize OpenStreetMap
function initMap() {
  // Initialize map centered on restaurant location
  map = L.map('addressMap').setView([RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng], 14);

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Add restaurant marker
  L.marker([RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng], {
    icon: L.divIcon({
      html: '<i class="fas fa-map-marker-alt" style="color: #e63946; font-size: 24px;"></i>',
      className: 'restaurant-marker'
    })
  }).addTo(map).bindPopup("Bake & Grill");

  // Add draggable marker for customer location
  marker = L.marker([RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng], {
    draggable: true,
    autoPan: true
  }).addTo(map);

  // Update location when marker is dragged or map is clicked
  function onMapClick(e) {
    marker.setLatLng(e.latlng);
    updateLocationFromMarker();
  }

  map.on('click', onMapClick);
  marker.on('dragend', updateLocationFromMarker);

  // Initialize search control
  const geocoder = L.Control.geocoder({
    defaultMarkGeocode: false,
    position: 'topright',
    placeholder: 'Search location...',
    errorMessage: 'Location not found',
    showResultIcons: true
  }).addTo(map);

  geocoder.on('markgeocode', function(e) {
    map.setView(e.geocode.center, 17);
    marker.setLatLng(e.geocode.center);
    updateLocationFromMarker();
  });
}

// Update location from marker
function updateLocationFromMarker() {
  const position = marker.getLatLng();
  locationObj = { lat: position.lat, lng: position.lng };
  
  // Use Nominatim for reverse geocoding
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}`)
    .then(response => response.json())
    .then(data => {
      if (data.display_name) {
        document.getElementById("manualDeliveryAddress").value = data.display_name;
      }
    })
    .catch(console.error);

  // Calculate distance
  calculateRoadDistance(position.lat, position.lng, RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng)
    .then(distance => {
      deliveryDistance = distance;
      updateCart();
      checkDeliveryRestriction();
    })
    .catch(error => {
      console.error("Error calculating distance:", error);
      deliveryDistance = calculateHaversineDistance(position.lat, position.lng, RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng);
      updateCart();
      checkDeliveryRestriction();
    });
}

// Setup rating system
function setupRatingSystem() {
  // Main widget rating
  const stars = document.querySelectorAll('.mobile-rating-widget .rating-stars i');
  const ratingFeedback = document.querySelector('.mobile-rating-widget .rating-feedback');
  const submitBtn = document.querySelector('.mobile-rating-widget .submit-rating');
  
  stars.forEach(star => {
    star.addEventListener('click', function() {
      currentRating = parseInt(this.dataset.rating);
      
      // Update stars display
      stars.forEach((s, index) => {
        s.classList.toggle('active', index < currentRating);
      });
      
      // Show feedback field for ratings < 4
      if (currentRating < 4) {
        ratingFeedback.style.display = 'block';
      } else {
        ratingFeedback.style.display = 'none';
        saveRating(currentRating);
      }
    });
  });
  
  submitBtn.addEventListener('click', function() {
    const comment = document.querySelector('.mobile-rating-widget .rating-comment').value;
    saveRating(currentRating, comment);
    document.querySelector('.mobile-rating-widget .rating-comment').value = '';
    ratingFeedback.style.display = 'none';
    showNotification('Thank you for your feedback!');
  });

  // Modal rating
  const modalStars = document.querySelectorAll('#orderConfirmationModal .rating-stars i');
  const modalFeedback = document.querySelector('#orderConfirmationModal .rating-feedback');
  
  modalStars.forEach(star => {
    star.addEventListener('click', function() {
      modalRating = parseInt(this.dataset.rating);
      
      // Update stars display
      modalStars.forEach((s, index) => {
        s.classList.toggle('active', index < modalRating);
      });
      
      // Show feedback field for ratings < 4
      if (modalRating < 4) {
        modalFeedback.style.display = 'block';
      } else {
        modalFeedback.style.display = 'none';
      }
    });
  });
}

// Save rating to Firestore
function saveRating(rating, comment = '') {
  if (!rating) return;
  
  const ratingData = {
    rating,
    comment,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    page: window.location.href,
    userAgent: navigator.userAgent
  };
  
  // Save to Firestore
  db.collection('ratings').add(ratingData)
    .then(() => console.log('Rating saved'))
    .catch(err => console.error('Error saving rating:', err));
}

// Setup delivery info accordion
function setupDeliveryAccordion() {
  const deliveryHeader = document.querySelector('.delivery-header');
  if (deliveryHeader) {
    deliveryHeader.addEventListener('click', function() {
      const content = this.nextElementSibling;
      content.classList.toggle('active');
      const icon = this.querySelector('i');
      icon.classList.toggle('fa-chevron-down');
      icon.classList.toggle('fa-chevron-up');
    });
  }
}

// Show notification
function showNotification(message) {
  notificationText.textContent = message;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Add item to order
function addToOrder(name, variant, price, quantity = 1) {
  const existingItemIndex = selectedItems.findIndex(
    item => item.name === name && item.variant === variant
  );
  
  if (existingItemIndex !== -1) {
    selectedItems[existingItemIndex].quantity += quantity;
  } else {
    selectedItems.push({ 
      name, 
      variant, 
      price, 
      quantity 
    });
  }
  
  updateCart();
  showNotification(`${quantity > 1 ? quantity + 'x ' : ''}${name} (${variant}) added to cart!`);
  
  if ('vibrate' in navigator) navigator.vibrate(30);
}

// Update cart display
function updateCart() {
  cartList.innerHTML = "";
  const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  let deliveryCharge = 0;
  let deliveryMessage = "";
  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  
  if (orderType === 'Delivery') {
    const result = calculateDeliveryCharge(subtotal, deliveryDistance);
    deliveryCharge = result.charge || 0;
    deliveryMessage = result.message;
    
    if (deliveryCharge !== null) {
      deliveryMessage += ` | ⏳ Est. Delivery: ${calculateDeliveryTime(deliveryDistance)}`;
      deliveryChargeDisplay.textContent = deliveryMessage;
      deliveryChargeDisplay.style.display = 'block';
    } else {
      deliveryChargeDisplay.textContent = deliveryMessage;
      deliveryChargeDisplay.style.color = 'var(--error-color)';
      deliveryChargeDisplay.style.display = 'block';
    }
  }

  const total = subtotal + (deliveryCharge || 0);
  
  // Update cart items list
  selectedItems.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "cart-item";
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "cart-item-name";
    nameSpan.textContent = `${item.name} (${item.variant}) x ${item.quantity}`;
    
    const priceSpan = document.createElement("span");
    priceSpan.className = "cart-item-price";
    priceSpan.textContent = `₹${item.price * item.quantity}`;
    
    const controlsDiv = document.createElement("div");
    controlsDiv.className = "cart-item-controls";
    
    const removeBtn = document.createElement("button");
    removeBtn.className = "cart-item-remove";
    removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
    removeBtn.addEventListener('click', () => {
      selectedItems.splice(index, 1);
      updateCart();
      showNotification("Item removed from cart");
    });
    
    controlsDiv.appendChild(removeBtn);
    li.appendChild(nameSpan);
    li.appendChild(priceSpan);
    li.appendChild(controlsDiv);
    cartList.appendChild(li);
  });

  // Update cart total
  let cartTotalText = `Subtotal: ₹${subtotal}`;
  if (deliveryCharge > 0) {
    cartTotalText += ` + Delivery: ₹${deliveryCharge}`;
  } else if (orderType === 'Delivery' && deliveryCharge === 0) {
    cartTotalText += ` + Delivery: Free`;
  }
  cartTotalText += ` = Total: ₹${total}`;
  
  if (orderType === 'Delivery' && deliveryCharge === null) {
    cartTotalText += " (Delivery not available)";
  }
  
  document.getElementById('cartTotal').textContent = cartTotalText;
  totalBill.innerHTML = cartTotalText;
  
  const itemCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('.cart-count, .cart-badge').forEach(el => {
    el.textContent = itemCount;
  });

  mobileClearCartBtn.style.display = itemCount > 0 ? 'block' : 'none';
  mobileCheckoutBtn.style.display = itemCount > 0 ? 'block' : 'none';
}

// Calculate delivery time estimate
function calculateDeliveryTime(distanceKm) {
  if (!distanceKm) return "Unknown";
  const preparationTime = 20;
  const travelTime = Math.round(distanceKm * 8);
  return `${preparationTime + travelTime} minutes (${preparationTime} min prep + ${travelTime} min travel)`;
}

// Calculate delivery charge
function calculateDeliveryCharge(total, distance) {
  if (!distance) return { charge: null, message: "Please share your location to calculate delivery" };
  if (distance > MAX_DELIVERY_DISTANCE) return { charge: null, message: "⚠️ Delivery not available beyond 8km" };
  if (total >= 500) return { charge: 0, message: "🎉 Free delivery (order above ₹500)" };
  if (distance <= 4) return { charge: 0, message: "Free delivery (within 4km)" };
  if (distance <= 6) return { charge: 20, message: `Delivery charge: ₹20 (${distance.toFixed(1)}km)` };
  if (distance <= 8) return { charge: 30, message: `Delivery charge: ₹30 (${distance.toFixed(1)}km)` };
  return { charge: null, message: "⚠️ Delivery not available beyond 8km" };
}

// Check delivery restriction
function checkDeliveryRestriction() {
  if (!deliveryDistance) {
    deliveryRestriction.style.display = 'none';
    return;
  }
  
  deliveryRestriction.style.display = deliveryDistance > MAX_DELIVERY_DISTANCE ? 'block' : 'none';
}

// Calculate road distance using OSRM API
async function calculateRoadDistance(originLat, originLng, destLat, destLng) {
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`
    );
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].distance / 1000;
    } else {
      return calculateHaversineDistance(originLat, originLng, destLat, destLng);
    }
  } catch (error) {
    console.error("Error calculating road distance:", error);
    return calculateHaversineDistance(originLat, originLng, destLat, destLng);
  }
}

// Calculate haversine distance
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Confirm order
async function confirmOrder() {
  if ('vibrate' in navigator) navigator.vibrate(50);
  
  // Check shop status first
  const isShopOpen = await checkShopStatus();
  if (!isShopOpen) {
    alert("Sorry, the shop is currently closed. Please try again later.");
    return;
  }
  
  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("phoneNumber").value.trim();
  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  if (orderType === "Delivery") {
    const hasCombos = selectedItems.some(item => {
      return Object.keys(fullMenu).some(category => {
        return category === "Combos" && fullMenu[category].some(combo => combo.name === item.name);
      });
    });
    
    if (hasCombos) {
      alert("Combos are not available for delivery. Please remove combo items or choose pickup.");
      return;
    }
  }

  if (orderType === 'Delivery' && subtotal < MIN_DELIVERY_ORDER) {
    alert(`Minimum order for delivery is ₹${MIN_DELIVERY_ORDER}. Please add more items or choose pickup.`);
    return;
  }

  if (!name || !phone) {
    alert("Please enter your name and phone number.");
    return;
  }

  if (!/^\d{10}$/.test(phone)) {
    alert("Please enter a valid 10-digit phone number.");
    return;
  }

  if (orderType === 'Delivery') {
    if (!locationObj && !usingManualLoc) {
      alert("Please share your location or enter your address to proceed with delivery.");
      document.getElementById('locationChoiceBlock').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    
    if (usingManualLoc && !document.getElementById('manualDeliveryAddress').value.trim()) {
      alert("Please enter your delivery address.");
      document.getElementById('manualDeliveryAddress').focus();
      return;
    }
    
    if (!deliveryDistance) {
      alert("We couldn't determine your distance from the restaurant. Please check your location settings and try again.");
      return;
    }
    
    if (deliveryDistance > MAX_DELIVERY_DISTANCE) {
      alert(`Your location is ${deliveryDistance.toFixed(1)}km away (beyond our 8km delivery range). Please choose pickup or visit our restaurant.`);
      return;
    }
  }

  let deliveryCharge = 0;
  if (orderType === 'Delivery') {
    const result = calculateDeliveryCharge(subtotal, deliveryDistance);
    deliveryCharge = result.charge || 0;
  }
  const total = subtotal + deliveryCharge;

  const orderData = {
    customerName: name,
    phoneNumber: phone,
    orderType: orderType,
    items: [...selectedItems],
    subtotal: subtotal,
    deliveryCharge: deliveryCharge,
    total: total,
    status: "Pending",
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (orderType === 'Delivery') {
    if (usingManualLoc) {
      orderData.deliveryAddress = document.getElementById('manualDeliveryAddress').value;
      if (locationObj) {
        orderData.deliveryLocation = new firebase.firestore.GeoPoint(locationObj.lat, locationObj.lng);
      }
    } else if (locationObj) {
      orderData.deliveryLocation = new firebase.firestore.GeoPoint(locationObj.lat, locationObj.lng);
    }
    orderData.deliveryDistance = deliveryDistance;
  }

  // Add rating if provided
  if (modalRating > 0) {
    const comment = document.querySelector('#orderConfirmationModal .rating-comment').value;
    orderData.rating = modalRating;
    if (comment) orderData.ratingComment = comment;
  }

  let confirmationHTML = `
    <div class="order-summary-item"><strong>Customer:</strong> ${name}</div>
    <div class="order-summary-item"><strong>Phone:</strong> ${phone}</div>
    <div class="order-summary-item"><strong>Order Type:</strong> ${orderType}</div>`;
  
  if (orderType === 'Delivery') {
    const estimatedTime = calculateDeliveryTime(deliveryDistance);
    if (usingManualLoc) {
      confirmationHTML += `
        <div class="order-summary-item"><strong>Address:</strong> ${orderData.deliveryAddress}</div>
        <div class="order-summary-item"><strong>Estimated Distance:</strong> ${deliveryDistance.toFixed(1)}km</div>`;
    } else if (locationObj) {
      confirmationHTML += `
        <div class="order-summary-item"><strong>Location:</strong> 
          <a href="https://www.openstreetmap.org/?mlat=${locationObj.lat}&mlon=${locationObj.lng}#map=16/${locationObj.lat}/${locationObj.lng}" target="_blank">View on Map</a>
        </div>
        <div class="order-summary-item"><strong>Distance:</strong> ${deliveryDistance.toFixed(1)}km</div>`;
    }
    confirmationHTML += `
      <div class="order-summary-item"><strong>Estimated Delivery:</strong> ${estimatedTime}</div>`;
  }
  
  confirmationHTML += `<div class="order-summary-item"><strong>Items:</strong></div>`;
  
  selectedItems.forEach((item, index) => {
    confirmationHTML += `
      <div class="order-summary-item">
        ${index + 1}. ${item.name} (${item.variant}) x ${item.quantity} - ₹${item.price * item.quantity}
      </div>`;
  });
  
  confirmationHTML += `
    <div class="order-summary-item"><strong>Subtotal:</strong> ₹${subtotal}</div>`;
  
  if (deliveryCharge > 0) {
    confirmationHTML += `
      <div class="order-summary-item"><strong>Delivery Charge:</strong> ₹${deliveryCharge}</div>`;
  } else if (orderType === 'Delivery') {
    confirmationHTML += `
      <div class="order-summary-item"><strong>Delivery Charge:</strong> Free</div>`;
  }
  
  confirmationHTML += `
    <div class="order-summary-item" style="font-weight:bold; color:var(--primary-purple); border-bottom:none;">
      <strong>Total Amount:</strong> ₹${total}
    </div>`;
  
  document.getElementById("orderConfirmationDetails").innerHTML = confirmationHTML;
  const modal = document.getElementById("orderConfirmationModal");
  modal.style.display = "block";
  
  document.querySelector(".close-modal").onclick = 
  document.getElementById("cancelOrderBtn").onclick = function() {
    modal.style.display = "none";
  };
  
  document.getElementById("confirmOrderBtn").onclick = function() {
    modal.style.display = "none";
    
    db.collection("orders").add(orderData)
      .then((docRef) => {
        console.log("Order saved with ID: ", docRef.id);
        orderData.id = docRef.id;
        saveOrderToHistory(orderData);
        sendWhatsAppOrder(name, phone, orderType, subtotal, deliveryCharge, total);
      })
      .catch((error) => {
        console.error("Error saving order: ", error);
        alert("There was an error saving your order. Please try again.");
      });
  };
}

// Save order to local storage history
function saveOrderToHistory(orderData) {
  const orders = JSON.parse(localStorage.getItem('bakeAndGrillOrders')) || [];
  orders.unshift({
    ...orderData,
    timestamp: orderData.timestamp?.toDate?.()?.toISOString?.() || new Date().toISOString()
  });
  if (orders.length > 50) orders.pop();
  localStorage.setItem('bakeAndGrillOrders', JSON.stringify(orders));
}

// Show order history
function showOrderHistory() {
  const orderHistoryModal = document.getElementById('orderHistoryModal');
  const orderHistoryList = document.getElementById('orderHistoryList');
  const orders = JSON.parse(localStorage.getItem('bakeAndGrillOrders')) || [];
  
  if (orders.length === 0) {
    orderHistoryList.innerHTML = '<div class="no-orders">No orders found in your history.</div>';
  } else {
    orderHistoryList.innerHTML = '';
    
    orders.forEach((order, index) => {
      const orderElement = document.createElement('div');
      orderElement.className = 'order-history-item';
      
      orderElement.innerHTML = `
        <div class="order-history-header">
          <span class="order-number">Order #${index + 1}</span>
          <span class="order-date">${new Date(order.timestamp).toLocaleString()}</span>
          <span class="order-total">₹${order.total}</span>
        </div>
        <div class="order-history-details">
          <div><strong>Name:</strong> ${order.customerName}</div>
          <div><strong>Phone:</strong> ${order.phoneNumber}</div>
          <div><strong>Type:</strong> ${order.orderType}</div>
          ${order.orderType === 'Delivery' ? `<div><strong>Distance:</strong> ${order.deliveryDistance ? order.deliveryDistance.toFixed(1)+'km' : 'Unknown'}</div>` : ''}
          <div class="order-items">
            <strong>Items:</strong>
            <ul>
              ${order.items.map(item => `<li>${item.name} (${item.variant}) x ${item.quantity} - ₹${item.price * item.quantity}</li>`).join('')}
            </ul>
          </div>
        </div>
        <div class="order-history-actions">
          <button class="reorder-btn" data-index="${index}"><i class="fas fa-redo"></i> Reorder</button>
          <button class="download-btn" data-index="${index}"><i class="fas fa-file-pdf"></i> Download</button>
        </div>
      `;
      
      orderHistoryList.appendChild(orderElement);
    });
    
    document.querySelectorAll('.reorder-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        reorderFromHistory(parseInt(this.dataset.index));
      });
    });
    
    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        downloadOrderFromHistory(parseInt(this.dataset.index));
      });
    });
  }
  
  orderHistoryModal.style.display = 'block';
}

// Clear order history
function clearOrderHistory() {
  if (confirm('Are you sure you want to clear your entire order history?')) {
    localStorage.removeItem('bakeAndGrillOrders');
    showOrderHistory();
    showNotification('Order history cleared');
  }
}

// Reorder from history
function reorderFromHistory(orderIndex) {
  const orders = JSON.parse(localStorage.getItem('bakeAndGrillOrders')) || [];
  if (orderIndex >= 0 && orderIndex < orders.length) {
    const order = orders[orderIndex];
    selectedItems.length = 0;
    order.items.forEach(item => {
      selectedItems.push({
        name: item.name,
        variant: item.variant,
        price: item.price,
        quantity: item.quantity
      });
    });
    
    document.getElementById('customerName').value = order.customerName;
    document.getElementById('phoneNumber').value = order.phoneNumber;
    document.querySelector(`input[name="orderType"][value="${order.orderType}"]`).checked = true;
    
    updateCart();
    document.getElementById('orderHistoryModal').style.display = 'none';
    document.querySelector('.mobile-form-section').classList.add('visible');
    document.querySelector('.mobile-form-section').scrollIntoView({ behavior: 'smooth' });
    showNotification('Order loaded from history');
  }
}

// Download PDF for order
function downloadOrderFromHistory(orderIndex) {
  const orders = JSON.parse(localStorage.getItem('bakeAndGrillOrders')) || [];
  if (orderIndex >= 0 && orderIndex < orders.length) {
    generatePDFBill(orders[orderIndex]);
  }
}

// Generate PDF bill
function generatePDFBill(orderDetails) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text('Bake & Grill', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text('Delicious food delivered to your doorstep', 105, 28, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setTextColor(157, 78, 223);
  doc.text('ORDER RECEIPT', 105, 40, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text(`Order #: ${orderDetails.id || Math.floor(100000 + Math.random() * 900000)}`, 15, 50);
  doc.text(`Date: ${new Date(orderDetails.timestamp).toLocaleString()}`, 15, 58);
  doc.text(`Customer: ${orderDetails.customerName}`, 15, 66);
  doc.text(`Phone: ${orderDetails.phoneNumber}`, 15, 74);
  doc.text(`Order Type: ${orderDetails.orderType}`, 15, 82);
  
  if (orderDetails.orderType === 'Delivery') {
    if (orderDetails.deliveryLocation) {
      doc.text(`Location: ${orderDetails.deliveryLocation.latitude}, ${orderDetails.deliveryLocation.longitude}`, 15, 90);
    } else if (orderDetails.deliveryAddress) {
      doc.text(`Address: ${orderDetails.deliveryAddress}`, 15, 90);
    }
    doc.text(`Distance: ${orderDetails.deliveryDistance ? orderDetails.deliveryDistance.toFixed(1)+'km' : 'Unknown'}`, 15, 98);
  }
  
  doc.autoTable({
    startY: 120,
    head: [['#', 'Item', 'Variant', 'Qty', 'Price (₹)']],
    body: orderDetails.items.map((item, index) => [
      index + 1,
      item.name,
      item.variant,
      item.quantity,
      item.price * item.quantity
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: [157, 78, 223],
      textColor: [255, 255, 255]
    }
  });
  
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.text(`Subtotal: ₹${orderDetails.subtotal}`, 140, finalY);
  
  if (orderDetails.deliveryCharge > 0) {
    doc.text(`Delivery Charge: ₹${orderDetails.deliveryCharge}`, 140, finalY + 8);
  } else if (orderDetails.orderType === 'Delivery') {
    doc.text(`Delivery Charge: Free`, 140, finalY + 8);
  }
  
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`Total Amount: ₹${orderDetails.total}`, 140, finalY + 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your order!', 105, 280, { align: 'center' });
  doc.text('For any queries, contact: +91 8240266267', 105, 285, { align: 'center' });
  
  doc.save(`BakeAndGrill_Order_${orderDetails.customerName}.pdf`);
}

// Send order via WhatsApp
function sendWhatsAppOrder(name, phone, orderType, subtotal, deliveryCharge, total) {
  const message = generateWhatsAppMessage(name, phone, orderType, subtotal, deliveryCharge, total);
  
  if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    window.location.href = `whatsapp://send?phone=918240266267&text=${encodeURIComponent(message)}`;
  } else {
    window.open(`https://wa.me/918240266267?text=${encodeURIComponent(message)}`, '_blank');
  }
  
  selectedItems.length = 0;
  updateCart();
  document.getElementById("customerName").value = "";
  document.getElementById("phoneNumber").value = "";
}

// Generate WhatsApp message
function generateWhatsAppMessage(name, phone, orderType, subtotal, deliveryCharge, total) {
  let message = `*New Order for Bake & Grill*\n\n`;
  message += `*Customer Name:* ${name}\n`;
  message += `*Phone:* ${phone}\n`;
  message += `*Order Type:* ${orderType}\n\n`;
  
  if (orderType === 'Delivery') {
    if (usingManualLoc) {
      message += `*Delivery Address:* ${document.getElementById('manualDeliveryAddress').value}\n`;
    }
    message += `*Delivery Distance:* ${deliveryDistance ? deliveryDistance.toFixed(1)+'km' : 'Unknown'}\n`;
  }
  
  message += `\n*Order Items:*\n`;
  selectedItems.forEach((item, index) => {
    message += `${index + 1}. ${item.name} (${item.variant}) x ${item.quantity} - ₹${item.price * item.quantity}\n`;
  });
  
  message += `\n*Subtotal:* ₹${subtotal}\n`;
  if (deliveryCharge > 0) {
    message += `*Delivery Charge:* ₹${deliveryCharge}\n`;
  } else if (orderType === 'Delivery') {
    message += `*Delivery Charge:* Free\n`;
  }
  message += `*Total Amount:* ₹${total}\n\n`;
  message += `Please confirm this order. Thank you!`;
  
  return message;
}