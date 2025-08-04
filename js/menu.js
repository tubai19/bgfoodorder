import { 
  db,
  AppState,
  initApp,
  updateCartBadge,
  showNotification,
  saveCartToStorage,
  collection,
  getDocs
} from './main.js';

// Menu-specific DOM elements
const MenuElements = {
  tabsDiv: null,
  container: null,
  searchInput: null,
  mobileCartDrawer: null,
  closeCartBtn: null,
  mobileClearCartBtn: null,
  cartList: null,
  cartTotal: null,
  quantityFooter: null,
  quantityItemName: null,
  quantityVariantPrice: null,
  quantityDisplay: null,
  cancelBtn: null,
  addToCartBtn: null,
  minusBtn: null,
  plusBtn: null
};

// Menu data and category icons
const fullMenu = {};
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

// Current item being modified
let currentItem = null;
let currentVariant = null;
let currentPrice = null;
let currentQuantity = 1;

// Initialize menu DOM elements
function initMenuDOMElements() {
  MenuElements.tabsDiv = document.getElementById("tabs");
  MenuElements.container = document.getElementById("menuContainer");
  MenuElements.searchInput = document.getElementById("searchInput");
  MenuElements.mobileCartDrawer = document.getElementById("mobileCartDrawer");
  MenuElements.closeCartBtn = document.getElementById("closeCartBtn");
  MenuElements.mobileClearCartBtn = document.getElementById("mobileClearCartBtn");
  MenuElements.cartList = document.getElementById("cartItems");
  MenuElements.cartTotal = document.getElementById("cartTotal");
  
  // Quantity footer elements
  MenuElements.quantityFooter = document.getElementById('quantityFooter');
  MenuElements.quantityItemName = document.getElementById('quantityItemName');
  MenuElements.quantityVariantPrice = document.getElementById('quantityVariantPrice');
  MenuElements.quantityDisplay = document.querySelector('.quantity-footer .quantity');
  MenuElements.cancelBtn = document.querySelector('.quantity-footer .cancel-btn');
  MenuElements.addToCartBtn = document.querySelector('.quantity-footer .add-to-cart-btn');
  MenuElements.minusBtn = document.querySelector('.quantity-footer .minus');
  MenuElements.plusBtn = document.querySelector('.quantity-footer .plus');
  
  // Initialize event listeners
  MenuElements.cancelBtn.addEventListener('click', hideQuantityFooter);
  MenuElements.addToCartBtn.addEventListener('click', addFromFooter);
  MenuElements.minusBtn.addEventListener('click', decreaseQuantity);
  MenuElements.plusBtn.addEventListener('click', increaseQuantity);
}

// Load menu from Firestore with proper error handling
async function loadMenuFromFirestore() {
  try {
    const menuCollection = collection(db, "menu");
    const snapshot = await getDocs(menuCollection);
    
    // Clear existing menu data
    Object.keys(fullMenu).forEach(key => delete fullMenu[key]);
    
    // Process each document
    snapshot.forEach(doc => {
      try {
        if (doc.exists()) {
          fullMenu[doc.id] = doc.data().items;
        }
      } catch (docError) {
        console.error(`Error processing document ${doc.id}:`, docError);
      }
    });
    
    initializeTabs();
  } catch (error) {
    console.error("Error loading menu:", error);
    showNotification("Failed to load menu. Please refresh the page.");
  }
}

// Initialize category tabs
function initializeTabs() {
  if (!MenuElements.tabsDiv) return;
  
  MenuElements.tabsDiv.innerHTML = '';
  
  Object.keys(fullMenu).forEach(category => {
    const tabBtn = document.createElement("button");
    tabBtn.textContent = `${categoryIcons[category] || "🍽"} ${category}`;
    tabBtn.dataset.category = category;
    tabBtn.addEventListener('click', () => {
      if (MenuElements.searchInput) MenuElements.searchInput.value = '';
      renderCategory(category);
      MenuElements.container.scrollIntoView({ behavior: 'smooth' });
      document.querySelectorAll('#tabs button').forEach(btn => btn.classList.remove('active'));
      tabBtn.classList.add('active');
    });
    MenuElements.tabsDiv.appendChild(tabBtn);
  });
  
  const firstCategory = Object.keys(fullMenu)[0];
  if (firstCategory) {
    MenuElements.tabsDiv.querySelector('button').classList.add('active');
    renderCategory(firstCategory);
  }
}

// Render menu items for a category
function renderCategory(category, searchTerm = '') {
  if (!MenuElements.container || !fullMenu[category]) return;
  
  MenuElements.container.innerHTML = "";
  
  const section = document.createElement("div");
  section.className = "menu-category";
  section.id = category.replace(/\s+/g, '-');
  section.innerHTML = `<h3>${categoryIcons[category] || "🍽"} ${category}</h3>`;
  MenuElements.container.appendChild(section);

  const filteredItems = fullMenu[category].filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (item.name && item.name.toLowerCase().includes(term)) || 
      (item.desc && item.desc.toLowerCase().includes(term))
    );
  });

  if (filteredItems.length === 0) {
    MenuElements.container.innerHTML = '<div class="no-results">No items found matching your search.</div>';
    return;
  }

  const itemsContainer = document.createElement("div");
  itemsContainer.className = "menu-items";
  MenuElements.container.appendChild(itemsContainer);

  filteredItems.forEach(item => {
    try {
      createMenuItem(item, itemsContainer, category);
    } catch (itemError) {
      console.error("Error creating menu item:", itemError);
    }
  });
}

// Create a single menu item element
function createMenuItem(item, container, category) {
  if (!item || !item.name || !item.variants) {
    console.warn("Invalid menu item:", item);
    return;
  }

  const itemDiv = document.createElement("div");
  itemDiv.className = "menu-item";
  
  if (category === "Combos" && document.querySelector('input[name="orderType"]:checked')?.value === "Delivery") {
    itemDiv.classList.add("disabled-item");
    const overlay = document.createElement("div");
    overlay.className = "disabled-overlay";
    overlay.textContent = "Combos not available for delivery";
    itemDiv.appendChild(overlay);
  }

  const itemDetails = document.createElement("div");
  itemDetails.className = "menu-item-details";
  
  // Item name
  const title = document.createElement("div");
  title.className = "menu-item-name";
  title.textContent = item.name;
  
  // Bengali name if available
  if (item.nameBn) {
    const bn = document.createElement("div");
    bn.className = "menu-item-name-bn";
    bn.textContent = item.nameBn;
    itemDetails.appendChild(bn);
  }
  
  // Description
  if (item.desc) {
    const desc = document.createElement("div");
    desc.className = "menu-item-desc";
    desc.textContent = item.desc;
    itemDetails.appendChild(desc);
  }
  
  // Variants
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
    if (index === 0) input.checked = true;
    
    const label = document.createElement("label");
    label.htmlFor = input.id;
    label.textContent = `${variant} - ₹${price}`;
    label.style.cursor = "pointer";
    
    variantOption.appendChild(input);
    variantOption.appendChild(label);
    variantDiv.appendChild(variantOption);
  });
  
  // Price display
  const priceDiv = document.createElement("div");
  priceDiv.className = "menu-item-price";
  priceDiv.textContent = `₹${Object.values(item.variants)[0]}`;
  
  // Add to cart button
  const addBtn = document.createElement("button");
  addBtn.className = "add-to-cart";
  addBtn.innerHTML = '<i class="fas fa-cart-plus"></i> Add';
  addBtn.addEventListener('click', () => {
    showQuantityFooter(item);
  });

  // Assemble item
  itemDetails.appendChild(title);
  itemDetails.appendChild(variantDiv);
  itemDetails.appendChild(priceDiv);
  itemDetails.appendChild(addBtn);
  
  itemDiv.appendChild(itemDetails);
  container.appendChild(itemDiv);
  
  // Update price when variant changes
  variantDiv.querySelectorAll('input[name^="variant-"]').forEach(input => {
    input.addEventListener('change', () => {
      priceDiv.textContent = `₹${input.dataset.price}`;
    });
  });
}

// Quantity footer functions
function showQuantityFooter(item) {
  const selectedVariantInput = document.querySelector(
    `input[name="variant-${item.name.replace(/\s+/g, '-')}"]:checked`
  );
  
  if (!selectedVariantInput) return;
  
  currentItem = item;
  currentVariant = selectedVariantInput.value;
  currentPrice = parseInt(selectedVariantInput.dataset.price);
  currentQuantity = 1;
  
  MenuElements.quantityItemName.textContent = item.name;
  MenuElements.quantityVariantPrice.textContent = `${currentVariant} - ₹${currentPrice}`;
  MenuElements.quantityDisplay.textContent = currentQuantity;
  
  MenuElements.quantityFooter.classList.add('active');
}

function hideQuantityFooter() {
  MenuElements.quantityFooter.classList.remove('active');
}

function increaseQuantity() {
  currentQuantity++;
  MenuElements.quantityDisplay.textContent = currentQuantity;
  if ('vibrate' in navigator) navigator.vibrate(10);
}

function decreaseQuantity() {
  if (currentQuantity > 1) {
    currentQuantity--;
    MenuElements.quantityDisplay.textContent = currentQuantity;
    if ('vibrate' in navigator) navigator.vibrate(10);
  }
}

function addFromFooter() {
  if (currentItem) {
    addToOrder(currentItem.name, currentVariant, currentPrice, currentQuantity);
    hideQuantityFooter();
    showNotification(`${currentQuantity > 1 ? currentQuantity + 'x ' : ''}${currentItem.name} (${currentVariant}) added to cart!`);
    if ('vibrate' in navigator) navigator.vibrate(30);
  }
}

// Add item to order with validation
function addToOrder(name, variant, price, quantity = 1) {
  if (!name || !variant || !price || !quantity) {
    console.error("Invalid item data:", {name, variant, price, quantity});
    return;
  }

  try {
    const existingItemIndex = AppState.selectedItems.findIndex(
      item => item.name === name && item.variant === variant
    );
    
    if (existingItemIndex !== -1) {
      AppState.selectedItems[existingItemIndex].quantity += quantity;
    } else {
      AppState.selectedItems.push({ name, variant, price, quantity });
    }
    
    updateCart();
    saveCartToStorage();
  } catch (error) {
    console.error("Error adding to order:", error);
    showNotification("Failed to add item to cart");
  }
}

// Update cart display with validation
function updateCart() {
  if (!MenuElements.cartList || !MenuElements.cartTotal) return;
  
  try {
    MenuElements.cartList.innerHTML = "";
    const subtotal = AppState.selectedItems.reduce((sum, item) => {
      return sum + (item.price * (item.quantity || 1));
    }, 0);
    
    AppState.selectedItems.forEach((item, index) => {
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
        AppState.selectedItems.splice(index, 1);
        updateCart();
        showNotification("Item removed from cart");
        saveCartToStorage();
      });
      
      controlsDiv.appendChild(removeBtn);
      li.appendChild(nameSpan);
      li.appendChild(priceSpan);
      li.appendChild(controlsDiv);
      MenuElements.cartList.appendChild(li);
    });

    MenuElements.cartTotal.textContent = `Total: ₹${subtotal}`;
    updateCartBadge();
    
    if (MenuElements.mobileClearCartBtn) {
      MenuElements.mobileClearCartBtn.disabled = AppState.selectedItems.length === 0;
    }
  } catch (error) {
    console.error("Error updating cart:", error);
    showNotification("Error updating cart display");
  }
}

// Initialize the menu page
function initMenuPage() {
  try {
    initMenuDOMElements();
    updateCart();
    loadMenuFromFirestore();
    
    if (MenuElements.closeCartBtn) {
      MenuElements.closeCartBtn.addEventListener('click', () => {
        MenuElements.mobileCartDrawer.classList.remove('active');
      });
    }
    
    if (MenuElements.mobileClearCartBtn) {
      MenuElements.mobileClearCartBtn.addEventListener('click', () => {
        if (AppState.selectedItems.length > 0 && confirm('Are you sure you want to clear your cart?')) {
          AppState.selectedItems.length = 0;
          updateCart();
          showNotification('Cart cleared');
          saveCartToStorage();
          if ('vibrate' in navigator) navigator.vibrate(50);
        }
      });
    }
    
    if (MenuElements.searchInput) {
      MenuElements.searchInput.addEventListener('input', (e) => {
        const activeTab = document.querySelector('#tabs button.active');
        if (activeTab) renderCategory(activeTab.dataset.category, e.target.value);
      });
    }
  } catch (error) {
    console.error("Error initializing menu page:", error);
    showNotification("Failed to initialize menu");
  }
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
  try {
    initApp();
    initMenuPage();
  } catch (error) {
    console.error("Failed to initialize application:", error);
    showNotification("Failed to load application");
  }
});