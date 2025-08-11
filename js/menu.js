import { 
  db,
  AppState,
  initApp,
  updateCartBadge,
  showNotification,
  saveCartToStorage,
  collection,
  getDocs,
  getCategoryIcon,
  isCategoryAvailableForOrderType
} from './main.js';

// Initialize IDB wrapper
const idb = window.idb || {};

// Menu DOM elements
const MenuElements = {
  tabsDiv: document.getElementById("tabs"),
  container: document.getElementById("menuContainer"),
  searchInput: document.getElementById("searchInput"),
  mobileCartDrawer: document.getElementById("mobileCartDrawer"),
  closeCartBtn: document.getElementById("closeCartBtn"),
  mobileClearCartBtn: document.getElementById("mobileClearCartBtn"),
  cartList: document.getElementById("cartItems"),
  cartTotal: document.getElementById("cartTotalAmount"),
  quantityFooter: document.getElementById("quantityFooter"),
  quantityItemName: document.getElementById("quantityItemName"),
  quantityVariantPrice: document.getElementById("quantityVariantPrice"),
  quantityDisplay: document.querySelector('.quantity-controls .quantity'),
  cancelBtn: document.querySelector('.quantity-footer .cancel-btn'),
  addToCartBtn: document.querySelector('.quantity-footer .add-to-cart-btn'),
  minusBtn: document.querySelector('.quantity-footer .minus'),
  plusBtn: document.querySelector('.quantity-footer .plus')
};

// Menu data
const fullMenu = {};
let currentItem = null;
let currentVariant = null;
let currentPrice = null;
let currentQuantity = 1;

// Initialize menu
async function initMenuPage() {
  await initApp();
  setupEventListeners();
  await loadMenuFromFirestore();
  updateCart();
}

// Load menu from Firestore
async function loadMenuFromFirestore() {
  try {
    const menuCollection = collection(db, "menu");
    const snapshot = await getDocs(menuCollection);
    
    // Clear existing data
    Object.keys(fullMenu).forEach(key => delete fullMenu[key]);
    
    snapshot.forEach(doc => {
      if (doc.exists() && AppState.MENU_CATEGORIES[doc.id]) {
        fullMenu[doc.id] = doc.data().items;
      }
    });
    
    initializeTabs();
  } catch (error) {
    console.error("Menu load error:", error);
    showNotification("Failed to load menu. Please refresh.");
  }
}

// Initialize category tabs
function initializeTabs() {
  if (!MenuElements.tabsDiv) return;
  
  MenuElements.tabsDiv.innerHTML = '';
  
  Object.keys(fullMenu).forEach(category => {
    const tabBtn = document.createElement("button");
    tabBtn.innerHTML = `${getCategoryIcon(category)} ${category}`;
    tabBtn.dataset.category = category;
    tabBtn.addEventListener('click', () => {
      MenuElements.searchInput.value = '';
      renderCategory(category);
      document.querySelectorAll('#tabs button').forEach(btn => 
        btn.classList.remove('active'));
      tabBtn.classList.add('active');
    });
    MenuElements.tabsDiv.appendChild(tabBtn);
  });
  
  // Activate first tab
  const firstCategory = Object.keys(fullMenu)[0];
  if (firstCategory) {
    MenuElements.tabsDiv.querySelector('button').classList.add('active');
    renderCategory(firstCategory);
  }
}

// Render category items
function renderCategory(category, searchTerm = '') {
  if (!MenuElements.container || !fullMenu[category]) return;
  
  MenuElements.container.innerHTML = "";
  
  const section = document.createElement("div");
  section.className = "menu-category";
  section.id = category.replace(/\s+/g, '-');
  section.innerHTML = `<h3>${getCategoryIcon(category)} ${category}</h3>`;
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
    MenuElements.container.innerHTML = '<div class="no-results">No matching items found</div>';
    return;
  }

  const itemsContainer = document.createElement("div");
  itemsContainer.className = "menu-items";
  MenuElements.container.appendChild(itemsContainer);

  filteredItems.forEach(item => createMenuItem(item, itemsContainer, category));
}

// Create menu item element
function createMenuItem(item, container, category) {
  if (!item?.name || !item?.variants) return;

  const itemDiv = document.createElement("div");
  itemDiv.className = "menu-item";
  
  // Check availability
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  if (orderType && !isCategoryAvailableForOrderType(category, orderType)) {
    itemDiv.classList.add("disabled-item");
    const overlay = document.createElement("div");
    overlay.className = "disabled-overlay";
    overlay.textContent = `${category} not available for ${orderType}`;
    itemDiv.appendChild(overlay);
  }

  const itemDetails = document.createElement("div");
  itemDetails.className = "menu-item-details";
  
  // Item name
  const title = document.createElement("div");
  title.className = "menu-item-name";
  title.textContent = item.name;
  itemDetails.appendChild(title);
  
  // Bengali name if available
  if (item.nameBn) {
    const bnName = document.createElement("div");
    bnName.className = "menu-item-name-bn";
    bnName.textContent = item.nameBn;
    itemDetails.appendChild(bnName);
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
    
    variantOption.append(input, label);
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
  addBtn.addEventListener('click', () => showQuantityFooter(item));

  // Assemble item
  itemDetails.append(variantDiv, priceDiv, addBtn);
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
  currentPrice = parseFloat(selectedVariantInput.dataset.price);
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
    showNotification(`${currentQuantity > 1 ? currentQuantity + 'x ' : ''}${currentItem.name} added to cart!`);
    if ('vibrate' in navigator) navigator.vibrate(30);
  }
}

// Cart management
function addToOrder(name, variant, price, quantity = 1) {
  if (!name || !variant || !price || !quantity) return;

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
}

function updateCart() {
  if (!MenuElements.cartList) return;
  
  MenuElements.cartList.innerHTML = "";
  
  if (AppState.selectedItems.length === 0) {
    MenuElements.cartList.innerHTML = '<li class="empty-cart">Your cart is empty</li>';
    updateCartDisplays(0, 0);
    return;
  }
  
  let itemCount = 0;
  const subtotal = AppState.selectedItems.reduce((sum, item) => {
    itemCount += item.quantity || 1;
    return sum + (item.price * (item.quantity || 1));
  }, 0);
  
  AppState.selectedItems.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "cart-item";
    
    li.innerHTML = `
      <span class="cart-item-name">${item.name} (${item.variant}) x ${item.quantity}</span>
      <span class="cart-item-price">₹${item.price * item.quantity}</span>
      <button class="cart-item-remove" data-index="${index}">
        <i class="fas fa-trash"></i>
      </button>
    `;
    
    MenuElements.cartList.appendChild(li);
  });

  updateCartDisplays(itemCount, subtotal);
}

function updateCartDisplays(itemCount, subtotal) {
  // Update all cart displays
  if (MenuElements.cartTotal) {
    MenuElements.cartTotal.textContent = subtotal.toFixed(2);
  }
  
  const totalItemCount = document.getElementById('totalItemCount');
  const cartItemCount = document.getElementById('cartItemCount');
  
  if (totalItemCount) totalItemCount.textContent = itemCount;
  if (cartItemCount) cartItemCount.textContent = itemCount;
  
  const totalDisplay = document.querySelector('.mobile-total-display');
  if (totalDisplay) {
    totalDisplay.querySelector('.total-items').textContent = 
      `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
    totalDisplay.querySelector('.total-amount').textContent = `₹${subtotal.toFixed(2)}`;
  }

  updateCartBadge();
  
  if (MenuElements.mobileClearCartBtn) {
    MenuElements.mobileClearCartBtn.disabled = AppState.selectedItems.length === 0;
  }
  
  if (document.getElementById('mobileCheckoutBtn')) {
    document.getElementById('mobileCheckoutBtn').style.display = 
      AppState.selectedItems.length > 0 ? 'block' : 'none';
  }
}

// Event listeners
function setupEventListeners() {
  // Cart toggle
  const mobileCartBtn = document.getElementById('mobileCartBtn');
  if (mobileCartBtn) {
    mobileCartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      MenuElements.mobileCartDrawer.classList.toggle('active');
      document.getElementById('cartOverlay').classList.toggle('active');
    });
  }
  
  // Overlay click
  const cartOverlay = document.getElementById('cartOverlay');
  if (cartOverlay) {
    cartOverlay.addEventListener('click', () => {
      MenuElements.mobileCartDrawer.classList.remove('active');
      cartOverlay.classList.remove('active');
    });
  }
  
  // Close cart
  if (MenuElements.closeCartBtn) {
    MenuElements.closeCartBtn.addEventListener('click', () => {
      MenuElements.mobileCartDrawer.classList.remove('active');
      document.getElementById('cartOverlay').classList.remove('active');
    });
  }
  
  // Clear cart
  if (MenuElements.mobileClearCartBtn) {
    MenuElements.mobileClearCartBtn.addEventListener('click', () => {
      if (AppState.selectedItems.length > 0 && confirm('Clear your cart?')) {
        AppState.selectedItems = [];
        updateCart();
        showNotification('Cart cleared');
        saveCartToStorage();
      }
    });
  }
  
  // Search
  if (MenuElements.searchInput) {
    MenuElements.searchInput.addEventListener('input', (e) => {
      const activeTab = document.querySelector('#tabs button.active');
      if (activeTab) renderCategory(activeTab.dataset.category, e.target.value);
    });
  }

  // Order type change
  document.querySelectorAll('input[name="orderType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const activeTab = document.querySelector('#tabs button.active');
      if (activeTab) renderCategory(activeTab.dataset.category);
    });
  });
  
  // Quantity controls
  if (MenuElements.cancelBtn) MenuElements.cancelBtn.addEventListener('click', hideQuantityFooter);
  if (MenuElements.addToCartBtn) MenuElements.addToCartBtn.addEventListener('click', addFromFooter);
  if (MenuElements.minusBtn) MenuElements.minusBtn.addEventListener('click', decreaseQuantity);
  if (MenuElements.plusBtn) MenuElements.plusBtn.addEventListener('click', increaseQuantity);
}

// Initialize
document.addEventListener('DOMContentLoaded', initMenuPage);