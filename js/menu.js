import { cart, saveCart, updateCartCount, showNotification, formatPrice } from './shared.js';

// DOM Elements
const elements = {
  menuContainer: document.getElementById('menuContainer'),
  tabs: document.getElementById('tabs'),
  searchInput: document.getElementById('searchInput'),
  mobileCartBtn: document.getElementById('mobileCartBtn'),
  mobileCartDrawer: document.getElementById('mobileCartDrawer'),
  cartItems: document.getElementById('cartItems'),
  cartTotal: document.getElementById('cartTotal'),
  mobileCheckoutBtn: document.getElementById('mobileCheckoutBtn'),
  mobileClearCartBtn: document.getElementById('mobileClearCartBtn'),
  closeCartBtn: document.getElementById('closeCartBtn'),
  cartOverlay: document.getElementById('cartOverlay')
};

// Menu Data
let menuData = {};
const categoryIcons = {
  'Veg-Pizzas': '🍕',
  'Paneer-Specials': '🧀',
  'Non-Veg-Pizzas': '🍗',
  'Burgers': '🍔',
  'Sandwiches': '🥪',
  'Quick-Bites': '🍟',
  'Dips': '🥫',
  'Combos': '🎁'
};

// Initialize Menu
async function initMenu() {
  try {
    const response = await fetch('menu.json');
    if (!response.ok) throw new Error('Network response was not ok');
    
    const data = await response.json();
    menuData = data.menu;
    
    renderCategories();
    renderMenuItems();
    setupEventListeners();
  } catch (error) {
    console.error('Error loading menu:', error);
    showNotification('Failed to load menu. Please try again.', 'error');
  }
}

// Render Category Tabs
function renderCategories() {
  elements.tabs.innerHTML = '';
  Object.keys(menuData).forEach(category => {
    const categoryId = category.replace(/\s+/g, '-');
    const tab = document.createElement('button');
    tab.className = 'mobile-category-tab';
    tab.textContent = `${categoryIcons[categoryId] || '🍽'} ${category}`;
    tab.dataset.category = categoryId;
    tab.addEventListener('click', () => {
      document.querySelector('.mobile-category-tab.active')?.classList.remove('active');
      tab.classList.add('active');
      renderMenuItems(categoryId);
    });
    elements.tabs.appendChild(tab);
  });
  
  if (elements.tabs.firstChild) {
    elements.tabs.firstChild.classList.add('active');
  }
}

// Render Menu Items
function renderMenuItems(category = null) {
  const activeCategory = category || document.querySelector('.mobile-category-tab.active')?.dataset.category;
  if (!activeCategory) return;

  const categoryName = activeCategory.replace(/-/g, ' ');
  const searchTerm = elements.searchInput.value.toLowerCase();
  const items = menuData[categoryName]?.filter(item => 
    item.name.toLowerCase().includes(searchTerm)
  ) || [];

  elements.menuContainer.innerHTML = items.length > 0 ? '' : '<p class="no-results">No items found</p>';

  items.forEach(item => {
    const itemElement = document.createElement('div');
    itemElement.className = 'menu-item';
    itemElement.dataset.id = `${activeCategory}-${item.name.replace(/\s+/g, '-').toLowerCase()}`;
    
    let variantsHTML = '';
    if (item.variants && Object.keys(item.variants).length > 0) {
      variantsHTML = `
        <div class="variant-options">
          ${Object.entries(item.variants).map(([variant, price]) => `
            <label class="variant-option">
              <input type="radio" name="${item.name.replace(/\s+/g, '-')}" value="${price}" 
                     data-variant="${variant}"
                     ${Object.keys(item.variants)[0] === variant ? 'checked' : ''}>
              <span>${variant} - ${formatPrice(price)}</span>
            </label>
          `).join('')}
        </div>
      `;
    }

    itemElement.innerHTML = `
      <div class="item-header">
        <h3>${item.name}</h3>
        ${item.nameBn ? `<p class="item-name-bn">${item.nameBn}</p>` : ''}
      </div>
      ${item.desc ? `<p class="item-desc">${item.desc}</p>` : ''}
      ${variantsHTML}
      <button class="add-to-cart" data-item='${JSON.stringify(item)}'>Add to Cart</button>
    `;
    elements.menuContainer.appendChild(itemElement);
  });
}

// Add Item to Cart
function addItemToCart(item, menuItemElement) {
  const selectedVariant = menuItemElement.querySelector('.variant-option input:checked');
  const variantName = selectedVariant ? selectedVariant.dataset.variant : Object.keys(item.variants)[0];
  const price = selectedVariant ? parseFloat(selectedVariant.value) : item.price;

  const existingItemIndex = cart.findIndex(i => 
    i.id === menuItemElement.dataset.id && 
    i.variant === variantName
  );

  if (existingItemIndex >= 0) {
    cart[existingItemIndex].quantity++;
  } else {
    cart.push({
      id: menuItemElement.dataset.id,
      name: item.name,
      price: price,
      variant: variantName,
      quantity: 1
    });
  }

  saveCart();
  updateCartCount();
  showNotification(`${item.name} (${variantName}) added to cart`);
}

// Render Cart
function renderCart() {
  elements.cartItems.innerHTML = cart.length > 0 ? '' : '<li class="empty-cart">Your cart is empty</li>';
  
  cart.forEach((item, index) => {
    const cartItem = document.createElement('li');
    cartItem.className = 'cart-item';
    cartItem.innerHTML = `
      <div class="cart-item-details">
        <h4 class="cart-item-name">${item.name}${item.variant ? ` (${item.variant})` : ''}</h4>
        <div class="cart-item-details">
          <div class="quantity-controls">
            <button class="decrease-quantity" data-index="${index}">−</button>
            <span>${item.quantity}</span>
            <button class="increase-quantity" data-index="${index}">+</button>
          </div>
          <span class="cart-item-price">${formatPrice(item.price * item.quantity)}</span>
        </div>
      </div>
      <button class="cart-item-remove" data-index="${index}">×</button>
    `;
    elements.cartItems.appendChild(cartItem);
  });

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  elements.cartTotal.textContent = `Total: ${formatPrice(total)}`;
}

// Event Listeners
function setupEventListeners() {
  // Search functionality
  elements.searchInput.addEventListener('input', () => {
    const activeTab = document.querySelector('.mobile-category-tab.active');
    renderMenuItems(activeTab?.dataset.category);
  });

  // Cart button click - open drawer
  elements.mobileCartBtn.addEventListener('click', () => {
    console.log('Cart button clicked'); // Debugging
    renderCart();
    elements.mobileCartDrawer.classList.add('open');
    elements.cartOverlay.classList.add('active');
  });

  // Close cart button
  elements.closeCartBtn.addEventListener('click', () => {
    elements.mobileCartDrawer.classList.remove('open');
    elements.cartOverlay.classList.remove('active');
  });

  // Overlay click - close cart
  elements.cartOverlay.addEventListener('click', () => {
    elements.mobileCartDrawer.classList.remove('open');
    elements.cartOverlay.classList.remove('active');
  });

  // Add to cart button clicks
  elements.menuContainer.addEventListener('click', e => {
    if (e.target.classList.contains('add-to-cart')) {
      e.preventDefault();
      e.stopPropagation();
      const menuItem = e.target.closest('.menu-item');
      const item = JSON.parse(e.target.dataset.item);
      addItemToCart(item, menuItem);
    }
  });

  // Cart item interactions
  elements.cartItems.addEventListener('click', e => {
    if (!e.target.dataset.index) return;
    const index = parseInt(e.target.dataset.index);
    
    if (e.target.classList.contains('cart-item-remove')) {
      cart.splice(index, 1);
      saveCart();
      updateCartCount();
      renderCart();
      showNotification('Item removed from cart');
    } else if (e.target.classList.contains('increase-quantity')) {
      cart[index].quantity++;
      saveCart();
      updateCartCount();
      renderCart();
    } else if (e.target.classList.contains('decrease-quantity')) {
      if (cart[index].quantity > 1) {
        cart[index].quantity--;
      } else {
        cart.splice(index, 1);
      }
      saveCart();
      updateCartCount();
      renderCart();
    }
  });

  // Clear cart button
  elements.mobileClearCartBtn.addEventListener('click', () => {
    if (cart.length === 0) return;
    
    if (confirm('Are you sure you want to clear your cart?')) {
      cart.length = 0;
      saveCart();
      updateCartCount();
      renderCart();
      showNotification('Cart cleared');
    }
  });

  // Checkout button
  elements.mobileCheckoutBtn.addEventListener('click', () => {
    if (cart.length > 0) {
      window.location.href = 'checkout.html';
    } else {
      showNotification('Your cart is empty');
    }
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', initMenu);