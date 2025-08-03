// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot,
  serverTimestamp,
  GeoPoint
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js";
import { 
  getAuth 
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js";
import { 
  getMessaging, 
  getToken,
  onMessage,
  isSupported
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-messaging.js";

// Firebase configuration
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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let messaging = null;

(async () => {
  if (await isSupported()) {
    messaging = getMessaging(app);
  }
})();

// Global variables
let fullMenu = {};
let selectedItems = JSON.parse(localStorage.getItem('cartItems')) || [];
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
const RESTAURANT_LOCATION = { lat: 22.3908, lng: 88.2189 };
const MAX_DELIVERY_DISTANCE = 8;
const MIN_DELIVERY_ORDER = 200;
let locationObj = null;
let deliveryDistance = null;
let usingManualLoc = false;
let map = null;
let marker = null;
let modalRating = 0;

// Common functions
function updateCartBadge() {
  const itemCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent = itemCount;
  });
}

function showNotification(message) {
  const notification = document.getElementById('notification');
  const notificationText = document.getElementById('notificationText');
  
  if (notification && notificationText) {
    notificationText.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }
}

// Request notification permission
async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      return await getFCMToken();
    }
    console.log('Notification permission not granted.');
    return null;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
}

// Get FCM token
async function getFCMToken() {
  if (!messaging) {
    console.log('Messaging not supported');
    return null;
  }

  try {
    const currentToken = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' });
    if (currentToken) {
      console.log('FCM Token:', currentToken);
      await saveTokenToServer(currentToken);
      return currentToken;
    }
    console.log('No registration token available.');
    return null;
  } catch (err) {
    console.error('An error occurred while retrieving token:', err);
    return null;
  }
}

// Save token to server
async function saveTokenToServer(token) {
  try {
    const userId = auth.currentUser?.uid || 'anonymous';
    await setDoc(doc(db, 'fcmTokens', userId), {
      token: token,
      createdAt: serverTimestamp(),
      platform: navigator.platform,
      userAgent: navigator.userAgent
    }, { merge: true });
  } catch (error) {
    console.error('Error saving token:', error);
  }
}

// Setup messaging
function setupMessaging() {
  if (!messaging) return;
  
  onMessage(messaging, (payload) => {
    console.log('Message received. ', payload);
    showNotification(payload.notification.body);
    
    // Update UI if needed
    if (payload.data?.orderId && document.getElementById('ordersList')) {
      updateOrderStatusUI(payload.data.orderId, payload.data.status);
    }
  });
}

// Check shop status
async function checkShopStatus() {
  try {
    const docSnap = await getDoc(doc(db, 'publicStatus', 'current'));
    if (docSnap.exists()) {
      const status = docSnap.data();
      return status.isShopOpen !== false;
    }
    return true;
  } catch (error) {
    console.error("Error checking shop status:", error);
    return true;
  }
}

// Check delivery status
async function checkDeliveryStatus() {
  try {
    const docSnap = await getDoc(doc(db, 'publicStatus', 'current'));
    if (docSnap.exists()) {
      const status = docSnap.data();
      return status.isDeliveryAvailable !== false;
    }
    return true;
  } catch (error) {
    console.error("Error checking delivery status:", error);
    return true;
  }
}

// Update status display
async function updateStatusDisplay() {
  try {
    const docSnap = await getDoc(doc(db, 'publicStatus', 'current'));
    
    if (!docSnap.exists()) {
      console.log("No status document found");
      return;
    }

    const status = docSnap.data();
    const isShopOpen = status.isShopOpen !== false;
    const isDeliveryAvailable = status.isDeliveryAvailable !== false;

    const shopStatusText = document.getElementById('shopStatusText');
    const deliveryStatusText = document.getElementById('deliveryStatusText');
    const shopStatusBanner = document.getElementById('shopStatusBanner');
    const deliveryStatusBanner = document.getElementById('deliveryStatusBanner');
    const statusBanner = document.getElementById('statusBanner');

    if (shopStatusText) shopStatusText.textContent = isShopOpen ? 'Shop: Open' : 'Shop: Closed';
    if (deliveryStatusText) deliveryStatusText.textContent = isDeliveryAvailable ? 'Delivery: Available' : 'Delivery: Unavailable';

    if (shopStatusBanner) shopStatusBanner.className = isShopOpen ? 'status-item open' : 'status-item closed';
    if (deliveryStatusBanner) deliveryStatusBanner.className = isDeliveryAvailable ? 'status-item open' : 'status-item closed';

    if (statusBanner) {
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
        
        if (!isDeliveryAvailable) {
          const deliveryRadio = document.querySelector('input[name="orderType"][value="Delivery"]');
          if (deliveryRadio) {
            deliveryRadio.disabled = true;
            if (deliveryRadio.checked) {
              document.querySelector('input[name="orderType"][value="Pickup"]').checked = true;
              showOrHideLocationBlock();
            }
          }
        } else {
          const deliveryRadio = document.querySelector('input[name="orderType"][value="Delivery"]');
          if (deliveryRadio) deliveryRadio.disabled = false;
        }
      }
    }
  } catch (error) {
    console.error("Error updating status display:", error);
  }
}

// Set up real-time listener for status changes
function setupStatusListener() {
  onSnapshot(doc(db, 'publicStatus', 'current'), (doc) => {
    if (doc.exists()) {
      updateStatusDisplay();
    }
  });
}

// Load menu from Firestore
async function loadMenuFromFirestore() {
  try {
    const querySnapshot = await getDocs(collection(db, "menu"));
    fullMenu = {};
    querySnapshot.forEach(doc => {
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
  const tabsDiv = document.getElementById("tabs");
  if (!tabsDiv) return;
  
  tabsDiv.innerHTML = '';
  
  for (const category in fullMenu) {
    const tabBtn = document.createElement("button");
    tabBtn.textContent = `${categoryIcons[category] || "🍽"} ${category}`;
    tabBtn.dataset.category = category;
    tabBtn.addEventListener('click', () => {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = '';
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
  const container = document.getElementById("menuContainer");
  if (!container) return;
  
  container.innerHTML = "";
  
  const section = document.createElement("div");
  section.className = "menu-category";
  section.innerHTML = `<h3>${categoryIcons[category] || "🍽"} ${category}</h3>`;
  container.appendChild(section);

  if (!fullMenu[category]) {
    container.innerHTML = '<div class="no-results">No items found in this category.</div>';
    return;
  }

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
    
    if (category === "Combos" && document.querySelector('input[name="orderType"]:checked')?.value === "Delivery") {
      itemDiv.classList.add("disabled-item");
      const overlay = document.createElement("div");
      overlay.className = "disabled-overlay";
      overlay.textContent = "Combos not available for delivery";
      itemDiv.appendChild(overlay);
    }

    // Add distance display if location is available
    const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
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
  
  // Save to localStorage
  localStorage.setItem('cartItems', JSON.stringify(selectedItems));
  
  updateCartBadge();
  showNotification(`${quantity > 1 ? quantity + 'x ' : ''}${name} (${variant}) added to cart!`);
  
  if ('vibrate' in navigator) navigator.vibrate(30);
}

// Update cart display
function updateCartDisplay() {
  const cartList = document.getElementById("cartItems");
  const totalBill = document.getElementById("mobileLiveTotal");
  const cartTotal = document.getElementById("cartTotal");
  
  if (!cartList && !totalBill && !cartTotal) return;
  
  if (cartList) cartList.innerHTML = "";
  const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  let deliveryDetails = null;
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  
  if (orderType === 'Delivery' && locationObj) {
    const distance = deliveryDistance || 0;
    
    deliveryDetails = {
      distance: distance,
      isAvailable: distance <= MAX_DELIVERY_DISTANCE,
      charge: calculateDeliveryChargeByDistance(distance),
      timeEstimate: calculateDeliveryTime(distance)
    };
    
    if (deliveryDetails) {
      let deliveryMessage = "";
      
      if (deliveryDetails.isAvailable) {
        const finalCharge = subtotal >= 500 ? 0 : deliveryDetails.charge;
        
        deliveryMessage = finalCharge === 0 ? 
          "🎉 Free delivery" : 
          `Delivery charge: ₹${finalCharge} (${deliveryDetails.distance.toFixed(1)}km)`;
          
        deliveryMessage += ` | ⏳ Est. Delivery: ${deliveryDetails.timeEstimate}`;
        
        if (document.getElementById('deliveryChargeDisplay')) {
          document.getElementById('deliveryChargeDisplay').textContent = deliveryMessage;
          document.getElementById('deliveryChargeDisplay').style.color = 'var(--success-color)';
        }
      } else {
        deliveryMessage = `⚠️ Delivery not available (${deliveryDetails.distance.toFixed(1)}km beyond 8km limit)`;
        if (document.getElementById('deliveryChargeDisplay')) {
          document.getElementById('deliveryChargeDisplay').textContent = deliveryMessage;
          document.getElementById('deliveryChargeDisplay').style.color = 'var(--error-color)';
        }
      }
      
      if (document.getElementById('deliveryChargeDisplay')) {
        document.getElementById('deliveryChargeDisplay').style.display = 'block';
      }
    }
  }

  const deliveryCharge = deliveryDetails?.isAvailable ? 
    (subtotal >= 500 ? 0 : deliveryDetails.charge) : 
    0;
    
  const total = subtotal + (deliveryCharge || 0);
  
  if (cartList) {
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
        localStorage.setItem('cartItems', JSON.stringify(selectedItems));
        updateCartDisplay();
        updateCartBadge();
        showNotification("Item removed from cart");
      });
      
      controlsDiv.appendChild(removeBtn);
      li.appendChild(nameSpan);
      li.appendChild(priceSpan);
      li.appendChild(controlsDiv);
      cartList.appendChild(li);
    });
  }

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
  
  if (cartTotal) cartTotal.textContent = cartTotalText;
  if (totalBill) totalBill.innerHTML = cartTotalText;
  
  updateCartBadge();
}

// Calculate delivery charge by distance
function calculateDeliveryChargeByDistance(distance) {
  if (!distance || distance > MAX_DELIVERY_DISTANCE) return null;
  
  if (distance <= 4) return 0;
  if (distance <= 6) return 20;
  if (distance <= 8) return 30;
  return null;
}

// Calculate delivery time
function calculateDeliveryTime(distanceKm) {
  if (!distanceKm) return "Unknown";
  const preparationTime = 20;
  const travelTimePerKm = 8;
  const travelTime = Math.round(distanceKm * travelTimePerKm);
  return `${preparationTime + travelTime} min (${preparationTime} min prep + ${travelTime} min travel)`;
}

// Setup cart event listeners
function setupCartEventListeners() {
  const mobileClearCartBtn = document.getElementById('mobileClearCartBtn');
  const mobileCheckoutBtn = document.getElementById('mobileCheckoutBtn');
  
  if (mobileClearCartBtn) {
    mobileClearCartBtn.addEventListener('click', function() {
      if (selectedItems.length > 0 && confirm('Are you sure you want to clear your cart?')) {
        selectedItems.length = 0;
        localStorage.removeItem('cartItems');
        updateCartDisplay();
        updateCartBadge();
        showNotification('Cart cleared');
        if ('vibrate' in navigator) navigator.vibrate(50);
      }
    });
  }
  
  if (mobileCheckoutBtn) {
    mobileCheckoutBtn.addEventListener('click', function() {
      if (selectedItems.length === 0) {
        showNotification('Your cart is empty');
        return;
      }
      window.location.href = 'checkout.html';
    });
  }
}

// Setup checkout event listeners
function setupCheckoutEventListeners() {
  const placeOrderBtn = document.getElementById('placeOrderBtn');
  const orderTypeRadios = document.querySelectorAll('input[name="orderType"]');
  const deliveryShareLocationBtn = document.getElementById('deliveryShareLocationBtn');
  const deliveryShowManualLocBtn = document.getElementById('deliveryShowManualLocBtn');
  
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Visual feedback
      this.classList.add('active');
      if ('vibrate' in navigator) navigator.vibrate(20);
      
      try {
        await confirmOrder();
      } catch (error) {
        console.error('Order error:', error);
        showNotification('Error processing order. Please try again.');
      } finally {
        this.classList.remove('active');
      }
    });
  }
  
  if (orderTypeRadios) {
    orderTypeRadios.forEach(radio => {
      radio.addEventListener('change', showOrHideLocationBlock);
    });
  }
  
  if (deliveryShareLocationBtn) {
    deliveryShareLocationBtn.onclick = function () {
      const currentLocStatusMsg = document.getElementById('currentLocStatusMsg');
      const distanceText = document.getElementById('distanceText');
      const deliveryDistanceDisplay = document.getElementById('deliveryDistanceDisplay');
      
      currentLocStatusMsg.style.color = "#333";
      currentLocStatusMsg.textContent = "Detecting your current location...";
      distanceText.textContent = "Distance: Calculating...";
      deliveryDistanceDisplay.style.display = 'block';
      
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
          document.getElementById('manualLocationFields').style.display = 'none';
          usingManualLoc = false;
          
          // Calculate distance
          calculateRoadDistance(pos.coords.latitude, pos.coords.longitude, RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng)
            .then(distance => {
              deliveryDistance = distance;
              distanceText.textContent = `Distance: ${distance.toFixed(1)} km`;
              updateCartDisplay();
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
  }
  
  if (deliveryShowManualLocBtn) {
    deliveryShowManualLocBtn.onclick = function () {
      usingManualLoc = true;
      document.getElementById('manualLocationFields').style.display = 'block';
      document.getElementById('currentLocStatusMsg').textContent = '';
      document.getElementById('distanceText').textContent = "Distance: Calculating...";
      document.getElementById('deliveryDistanceDisplay').style.display = 'block';
      
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
  }
  
  // Search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const activeTab = document.querySelector('#tabs button.active');
      if (activeTab) {
        renderCategory(activeTab.dataset.category, e.target.value);
      }
    });
  }
}

// Show or hide location block based on order type
function showOrHideLocationBlock() {
  const locationChoiceBlock = document.getElementById('locationChoiceBlock');
  const deliveryDistanceDisplay = document.getElementById('deliveryDistanceDisplay');
  
  if (document.querySelector('input[name="orderType"]:checked').value === 'Delivery') {
    resetLocationChoiceBlock();
    locationChoiceBlock.style.display = 'block';
    deliveryDistanceDisplay.style.display = deliveryDistance ? 'block' : 'none';
  } else {
    locationChoiceBlock.style.display = 'none';
    deliveryDistanceDisplay.style.display = 'none';
    locationObj = null;
    usingManualLoc = false;
  }
  updateCartDisplay();
}

// Reset location choice block
function resetLocationChoiceBlock() {
  const locationChoiceBlock = document.getElementById('locationChoiceBlock');
  const currentLocStatusMsg = document.getElementById('currentLocStatusMsg');
  const deliveryShowManualLocBtn = document.getElementById('deliveryShowManualLocBtn');
  const manualLocationFields = document.getElementById('manualLocationFields');
  const manualDeliveryAddress = document.getElementById('manualDeliveryAddress');
  const deliveryDistanceDisplay = document.getElementById('deliveryDistanceDisplay');
  
  locationChoiceBlock.style.display = 'block';
  currentLocStatusMsg.textContent = '';
  deliveryShowManualLocBtn.style.display = 'none';
  manualLocationFields.style.display = 'none';
  manualDeliveryAddress.value = '';
  locationObj = null;
  usingManualLoc = false;
  deliveryDistanceDisplay.style.display = 'none';
}

// Initialize map
function initMap() {
  map = L.map('addressMap').setView([RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Restaurant marker
  L.marker([RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng], {
    icon: L.divIcon({
      html: '<i class="fas fa-store" style="color: #e63946; font-size: 24px;"></i>',
      className: 'restaurant-marker'
    })
  }).addTo(map).bindPopup("Bake & Grill");

  // Customer marker with improved styling
  marker = L.marker([RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng], {
    draggable: true,
    autoPan: true,
    icon: L.divIcon({
      html: '<i class="fas fa-map-marker-alt" style="color: #9d4edf; font-size: 32px;"></i>',
      className: 'customer-marker'
    })
  }).addTo(map);

  // Improved geocoder control
  const geocoder = L.Control.geocoder({
    defaultMarkGeocode: false,
    position: 'topright',
    placeholder: 'Search location...',
    errorMessage: 'Location not found',
    showResultIcons: true,
    collapsed: false,
    suggestTimeout: 250,
    queryMinLength: 3,
    geocodingQueryParams: {
      countrycodes: 'in', // Limit to India
      bounded: 1,
      viewbox: '88.0,22.2,88.5,22.6' // Bounding box around Kolkata area
    }
  }).addTo(map);

  // Handle geocode results with better user feedback
  geocoder.on('markgeocode', function(e) {
    map.setView(e.geocode.center, 17);
    marker.setLatLng(e.geocode.center);
    updateLocationFromMarker();
    document.getElementById("manualDeliveryAddress").value = e.geocode.name;
    showNotification('Location found!');
  });

  // Handle map clicks with animation
  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    updateLocationFromMarker();
    marker.setIcon(L.divIcon({
      html: '<i class="fas fa-map-marker-alt" style="color: #9d4edf; font-size: 32px; animation: bounce 0.5s;"></i>',
      className: 'customer-marker'
    }));
    setTimeout(() => {
      marker.setIcon(L.divIcon({
        html: '<i class="fas fa-map-marker-alt" style="color: #9d4edf; font-size: 32px;"></i>',
        className: 'customer-marker'
      }));
    }, 500);
  });

  // Handle marker drag with better visual feedback
  marker.on('dragstart', function() {
    this.setIcon(L.divIcon({
      html: '<i class="fas fa-map-marker-alt" style="color: #ff9e02; font-size: 32px;"></i>',
      className: 'customer-marker'
    }));
  });

  marker.on('dragend', function() {
    this.setIcon(L.divIcon({
      html: '<i class="fas fa-map-marker-alt" style="color: #9d4edf; font-size: 32px;"></i>',
      className: 'customer-marker'
    }));
    updateLocationFromMarker();
  });

  // Enhanced address search functionality with debouncing
  const addressInput = document.getElementById('manualDeliveryAddress');
  let geocodeTimeout;
  let lastQuery = '';
  
  addressInput.addEventListener('input', function() {
    clearTimeout(geocodeTimeout);
    const query = this.value.trim();
    
    if (query.length < 3 || query === lastQuery) {
      document.getElementById('geocodingLoading').style.display = 'none';
      return;
    }
    
    lastQuery = query;
    document.getElementById('geocodingLoading').style.display = 'block';
    
    geocodeTimeout = setTimeout(() => {
      searchAddress(query);
    }, 500);
  });

  // Add clear button functionality
  const clearSearchBtn = document.createElement('button');
  clearSearchBtn.innerHTML = '<i class="fas fa-times"></i>';
  clearSearchBtn.className = 'clear-search-btn';
  clearSearchBtn.style.display = 'none';
  clearSearchBtn.addEventListener('click', function() {
    addressInput.value = '';
    this.style.display = 'none';
    map.setView([RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng], 14);
    marker.setLatLng([RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng]);
    locationObj = null;
    document.getElementById('deliveryDistanceDisplay').style.display = 'none';
  });
  
  addressInput.parentNode.insertBefore(clearSearchBtn, addressInput.nextSibling);
  
  addressInput.addEventListener('input', function() {
    clearSearchBtn.style.display = this.value ? 'block' : 'none';
  });
}

// Improved address search function
function searchAddress(query) {
  // First check if the query is a complete address with comma separation
  if (query.includes(',')) {
    // If it looks like a complete address, try to geocode it directly
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=in`)
      .then(response => response.json())
      .then(data => {
        document.getElementById('geocodingLoading').style.display = 'none';
        if (data.length > 0) {
          const firstResult = data[0];
          const lat = parseFloat(firstResult.lat);
          const lon = parseFloat(firstResult.lon);
          
          map.setView([lat, lon], 17);
          marker.setLatLng([lat, lon]);
          updateLocationFromMarker();
          showNotification('Location found!');
        } else {
          // If no results, try a more general search
          searchGeneralLocation(query);
        }
      })
      .catch(error => {
        console.error('Geocoding error:', error);
        document.getElementById('geocodingLoading').style.display = 'none';
        searchGeneralLocation(query);
      });
  } else {
    // For partial queries, use the more general search
    searchGeneralLocation(query);
  }
}

// New function for general location search with suggestions
function searchGeneralLocation(query) {
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in&bounded=1&viewbox=88.0,22.2,88.5,22.6`)
    .then(response => response.json())
    .then(data => {
      document.getElementById('geocodingLoading').style.display = 'none';
      
      // Clear previous suggestions
      const oldSuggestions = document.querySelectorAll('.location-suggestion');
      oldSuggestions.forEach(el => el.remove());
      
      if (data.length === 0) {
        showNotification('No locations found. Try a different address.');
        return;
      }
      
      // If only one result, use it directly
      if (data.length === 1) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        map.setView([lat, lon], 17);
        marker.setLatLng([lat, lon]);
        updateLocationFromMarker();
        document.getElementById("manualDeliveryAddress").value = result.display_name;
        showNotification('Location found!');
        return;
      }
      
      // Create suggestion dropdown
      const suggestionsContainer = document.createElement('div');
      suggestionsContainer.className = 'location-suggestions';
      
      data.forEach(result => {
        const suggestion = document.createElement('div');
        suggestion.className = 'location-suggestion';
        suggestion.textContent = result.display_name;
        suggestion.addEventListener('click', () => {
          const lat = parseFloat(result.lat);
          const lon = parseFloat(result.lon);
          
          map.setView([lat, lon], 17);
          marker.setLatLng([lat, lon]);
          updateLocationFromMarker();
          document.getElementById("manualDeliveryAddress").value = result.display_name;
          suggestionsContainer.remove();
          showNotification('Location selected!');
        });
        
        suggestionsContainer.appendChild(suggestion);
      });
      
      document.getElementById('manualLocationFields').appendChild(suggestionsContainer);
    })
    .catch(error => {
      console.error('Geocoding error:', error);
      document.getElementById('geocodingLoading').style.display = 'none';
      showNotification('Error searching location. Please try again.');
    });
}

// Improved location update from marker function
function updateLocationFromMarker() {
  const position = marker.getLatLng();
  locationObj = { lat: position.lat, lng: position.lng };
  
  document.getElementById("distanceText").textContent = "Distance: Calculating...";
  document.getElementById("deliveryDistanceDisplay").style.display = 'block';
  document.getElementById('geocodingLoading').style.display = 'block';

  // Get address from coordinates with more detailed response
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}&zoom=18&addressdetails=1`)
    .then(response => response.json())
    .then(data => {
      document.getElementById('geocodingLoading').style.display = 'none';
      
      if (data.display_name) {
        let displayAddress = data.display_name;
        
        // Try to format the address more cleanly
        if (data.address) {
          const addr = data.address;
          displayAddress = [
            addr.road,
            addr.neighbourhood,
            addr.suburb,
            addr.village,
            addr.town,
            addr.city,
            addr.state,
            addr.postcode
          ].filter(Boolean).join(', ');
        }
        
        document.getElementById("manualDeliveryAddress").value = displayAddress;
      }
    })
    .catch(error => {
      console.error("Reverse geocoding error:", error);
      document.getElementById('geocodingLoading').style.display = 'none';
    });

  // Calculate road distance
  calculateRoadDistance(position.lat, position.lng, RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng)
    .then(distance => {
      deliveryDistance = distance;
      document.getElementById("distanceText").textContent = `Distance: ${distance.toFixed(1)} km`;
      updateCartDisplay();
    })
    .catch(error => {
      console.error("Error calculating distance:", error);
      // Fallback to straight-line distance if road distance fails
      deliveryDistance = calculateHaversineDistance(position.lat, position.lng, RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng);
      document.getElementById("distanceText").textContent = `Distance: ${deliveryDistance.toFixed(1)} km (straight line)`;
      updateCartDisplay();
    });
}

// Calculate road distance using OSRM API
async function calculateRoadDistance(originLat, originLng, destLat, destLng) {
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`
    );
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].distance / 1000; // Convert meters to kilometers
    } else {
      console.warn("OSRM returned no routes, falling back to haversine");
      return calculateHaversineDistance(originLat, originLng, destLat, destLng);
    }
  } catch (error) {
    console.error("Error calculating road distance:", error);
    return calculateHaversineDistance(originLat, originLng, destLat, destLng);
  }
}

// Haversine distance formula (straight-line distance)
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Confirm order
async function confirmOrder() {
  try {
    if ('vibrate' in navigator) navigator.vibrate(50);
    
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
      
      const distance = await calculateRoadDistance(
        locationObj.lat, 
        locationObj.lng,
        RESTAURANT_LOCATION.lat,
        RESTAURANT_LOCATION.lng
      );
      
      if (!distance) {
        alert("We couldn't determine your distance from the restaurant. Please check your location settings and try again.");
        return;
      }
      
      if (distance > MAX_DELIVERY_DISTANCE) {
        alert(`Your location is ${distance.toFixed(1)}km away (beyond our 8km delivery range). Please choose pickup or visit our restaurant.`);
        return;
      }
    }

    let deliveryCharge = 0;
    if (orderType === 'Delivery') {
      const distance = await calculateRoadDistance(
        locationObj.lat, 
        locationObj.lng,
        RESTAURANT_LOCATION.lat,
        RESTAURANT_LOCATION.lng
      );
      const result = calculateDeliveryChargeByDistance(distance);
      deliveryCharge = subtotal >= 500 ? 0 : (result || 0);
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
      timestamp: serverTimestamp()
    };

    if (orderType === 'Delivery') {
      if (usingManualLoc) {
        orderData.deliveryAddress = document.getElementById('manualDeliveryAddress').value;
        if (locationObj) {
          orderData.deliveryLocation = new GeoPoint(locationObj.lat, locationObj.lng);
        }
      } else if (locationObj) {
        orderData.deliveryLocation = new GeoPoint(locationObj.lat, locationObj.lng);
      }
      orderData.deliveryDistance = deliveryDistance;
    }

    if (modalRating > 0) {
      const comment = document.querySelector('#orderConfirmationModal .rating-comment').value;
      orderData.rating = modalRating;
      if (comment) orderData.ratingComment = comment;
    }

    showOrderConfirmationModal(orderData);
    
  } catch (error) {
    console.error("Error confirming order:", error);
    alert("There was an error processing your order. Please try again.");
  }
}

// Show order confirmation modal
function showOrderConfirmationModal(orderData) {
  const modal = document.getElementById('orderConfirmationModal');
  const orderSummary = document.getElementById('orderConfirmationSummary');
  
  if (!modal || !orderSummary) {
    console.error("Modal elements not found");
    return;
  }  
  let summaryHTML = `
    <div class="order-summary-section">
      <h3>Order Summary</h3>
      <p><strong>Name:</strong> ${orderData.customerName}</p>
      <p><strong>Phone:</strong> ${orderData.phoneNumber}</p>
      <p><strong>Order Type:</strong> ${orderData.orderType}</p>
      ${orderData.orderType === 'Delivery' ? `
        <p><strong>Delivery Distance:</strong> ${orderData.deliveryDistance ? orderData.deliveryDistance.toFixed(1)+'km' : 'Unknown'}</p>
        ${orderData.deliveryAddress ? `<p><strong>Delivery Address:</strong> ${orderData.deliveryAddress}</p>` : ''}
      ` : ''}
    </div>
    
    <div class="order-summary-section">
      <h3>Order Items</h3>
      <ul class="order-items-list">
  `;
  
  orderData.items.forEach(item => {
    summaryHTML += `
      <li>
        <span class="item-name">${item.name} (${item.variant})</span>
        <span class="item-quantity">x ${item.quantity}</span>
        <span class="item-price">₹${item.price * item.quantity}</span>
      </li>
    `;
  });
  
  summaryHTML += `
      </ul>
    </div>
    
    <div class="order-summary-section total-section">
      <p><strong>Subtotal:</strong> ₹${orderData.subtotal}</p>
      ${orderData.deliveryCharge > 0 ? `<p><strong>Delivery Charge:</strong> ₹${orderData.deliveryCharge}</p>` : ''}
      ${orderData.orderType === 'Delivery' && orderData.deliveryCharge === 0 ? `<p><strong>Delivery Charge:</strong> Free</p>` : ''}
      <p class="grand-total"><strong>Total Amount:</strong> ₹${orderData.total}</p>
    </div>
    
    <div class="rating-section">
      <h3>Rate Your Experience</h3>
      <div class="rating-stars">
        <i class="fas fa-star" data-rating="1"></i>
        <i class="fas fa-star" data-rating="2"></i>
        <i class="fas fa-star" data-rating="3"></i>
        <i class="fas fa-star" data-rating="4"></i>
        <i class="fas fa-star" data-rating="5"></i>
      </div>
      <div class="rating-feedback" style="display: none;">
        <textarea class="rating-comment" placeholder="What could we improve?"></textarea>
      </div>
    </div>
  `;
  
  orderSummary.innerHTML = summaryHTML;
  
  // Setup rating stars
  document.querySelectorAll('.rating-stars i').forEach(star => {
    star.addEventListener('click', function() {
      const rating = parseInt(this.dataset.rating);
      modalRating = rating;
      
      // Update stars display
      document.querySelectorAll('.rating-stars i').forEach((s, i) => {
        if (i < rating) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
      
      // Show feedback textarea for lower ratings
      const feedbackDiv = document.querySelector('.rating-feedback');
      if (rating < 4) {
        feedbackDiv.style.display = 'block';
      } else {
        feedbackDiv.style.display = 'none';
      }
    });
  });
  
  document.getElementById('confirmOrderBtn').onclick = function() {
    addDoc(collection(db, 'orders'), orderData)
      .then(docRef => {
        orderData.id = docRef.id;
        saveOrderToHistory(orderData);
        sendWhatsAppOrder(orderData);
        
        selectedItems.length = 0;
        localStorage.removeItem('cartItems');
        updateCartDisplay();
        updateCartBadge();
        
        document.getElementById('orderConfirmationModal').style.display = 'none';
        
        showNotification('Order placed successfully!');
        
        // Redirect to order history after a delay
        setTimeout(() => {
          window.location.href = 'order-history.html';
        }, 2000);
      })
      .catch(error => {
        console.error("Error saving order:", error);
        alert("There was an error processing your order. Please try again.");
      });
  };
  
  document.getElementById('cancelOrderBtn').onclick = function() {
    modal.style.display = 'none';
  };
  
  modal.style.display = 'block';
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
  const orderHistoryList = document.getElementById('orderHistoryList');
  if (!orderHistoryList) return;
  
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
}

// Setup order history event listeners
function setupOrderHistoryEventListeners() {
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', function() {
      if (confirm('Are you sure you want to clear your entire order history?')) {
        localStorage.removeItem('bakeAndGrillOrders');
        showOrderHistory();
        showNotification('Order history cleared');
      }
    });
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
    
    localStorage.setItem('cartItems', JSON.stringify(selectedItems));
    updateCartBadge();
    window.location.href = 'checkout.html';
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
function sendWhatsAppOrder(orderData) {
  const message = generateWhatsAppMessage(orderData);
  
  if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    window.location.href = `whatsapp://send?phone=918240266267&text=${encodeURIComponent(message)}`;
  } else {
    window.open(`https://wa.me/918240266267?text=${encodeURIComponent(message)}`, '_blank');
  }
}

// Generate WhatsApp message
function generateWhatsAppMessage(orderData) {
  let message = `*New Order for Bake & Grill*\n\n`;
  message += `*Customer Name:* ${orderData.customerName}\n`;
  message += `*Phone:* ${orderData.phoneNumber}\n`;
  message += `*Order Type:* ${orderData.orderType}\n\n`;
  
  if (orderData.orderType === 'Delivery') {
    if (orderData.deliveryAddress) {
      message += `*Delivery Address:* ${orderData.deliveryAddress}\n`;
    }
    message += `*Delivery Distance:* ${orderData.deliveryDistance ? orderData.deliveryDistance.toFixed(1)+'km' : 'Unknown'}\n`;
  }
  
  message += `\n*Order Items:*\n`;
  orderData.items.forEach((item, index) => {
    message += `${index + 1}. ${item.name} (${item.variant}) x ${item.quantity} - ₹${item.price * item.quantity}\n`;
  });
  
  message += `\n*Subtotal:* ₹${orderData.subtotal}\n`;
  if (orderData.deliveryCharge > 0) {
    message += `*Delivery Charge:* ₹${orderData.deliveryCharge}\n`;
  } else if (orderData.orderType === 'Delivery') {
    message += `*Delivery Charge:* Free\n`;
  }
  message += `*Total Amount:* ₹${orderData.total}\n\n`;
  message += `Please confirm this order. Thank you!`;
  
  return message;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope:', registration.scope);
        
        // Check for updates every hour
        setInterval(() => {
          registration.update().catch(err => {
            console.log('ServiceWorker update check failed:', err);
          });
        }, 60 * 60 * 1000);
      })
      .catch(error => {
        console.error('ServiceWorker registration failed:', error);
      });
  }
  
  // Set up passive event listeners for better scrolling performance
  document.body.addEventListener('touchstart', function() {}, { passive: true });
  
  // Update cart display
  updateCartBadge();
  
  // Check status on initial load
  updateStatusDisplay();
  setupStatusListener();
  
  // Request notification permission
  requestNotificationPermission();
  
  // Set up messaging
  setupMessaging();
  
  // Page-specific initializations
  if (document.getElementById('menuContainer')) {
    // Menu page
    loadMenuFromFirestore();
  }
  
  if (document.getElementById('cartItems')) {
    // Cart page
    updateCartDisplay();
    setupCartEventListeners();
  }
  
  if (document.getElementById('orderHistoryList')) {
    // Order history page
    showOrderHistory();
    setupOrderHistoryEventListeners();
  }
  
  if (document.getElementById('placeOrderBtn')) {
    // Checkout page
    updateCartDisplay();
    setupCheckoutEventListeners();
  }
});