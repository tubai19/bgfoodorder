import { cart, saveCart, updateCartCount, showNotification, formatPrice, validateOrder } from './shared.js';

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
  cartOverlay: document.getElementById('cartOverlay'),
  deliveryRestriction: document.getElementById('deliveryRestriction'),
  orderTypeRadios: document.querySelectorAll('input[name="orderType"]')
};

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
    const isCombo = activeCategory === 'Combos';
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
        <h3>${item.name}${isCombo ? '<span class="non-deliverable-tag">Pickup Only</span>' : ''}</h3>
        ${item.nameBn ? `<p class="item-name-bn">${item.nameBn}</p>` : ''}
      </div>
      ${item.desc ? `<p class="item-desc">${item.desc}</p>` : ''}
      ${variantsHTML}
      <button class="add-to-cart" data-item='${JSON.stringify({...item, category: activeCategory.replace(/-/g, ' ')})}'>
        Add to Cart ${isCombo ? '<i class="fas fa-store"></i>' : '<i class="fas fa-truck"></i>'}
      </button>
    `;
    elements.menuContainer.appendChild(itemElement);
  });
}

function addItemToCart(item, menuItemElement) {
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  if (orderType === 'Delivery' && item.category === 'Combos') {
    showNotification('Combos are not available for delivery. Please choose pickup.', 'error');
    return;
  }

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
      quantity: 1,
      category: item.category
    });
  }

  saveCart();
  updateCartCount();
  showNotification(`${item.name} (${variantName}) added to cart`);
}

function renderCart() {
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  const hasCombos = cart.some(item => item.category === 'Combos');
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  let warnings = '';
  
  if (orderType === 'Delivery' && hasCombos) {
    warnings += `<li class="cart-warning">
      <i class="fas fa-exclamation-triangle"></i> Combos not available for delivery
    </li>`;
  }
  
  if (subtotal < 200) {
    warnings += `<li class="cart-warning">
      <i class="fas fa-exclamation-triangle"></i> ₹${200-subtotal} more needed for checkout
    </li>`;
  }
  
  elements.cartItems.innerHTML = warnings + (cart.length > 0 ? '' : '<li class="empty-cart">Your cart is empty</li>');
  
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

function setupEventListeners() {
  elements.searchInput.addEventListener('input', () => {
    const activeTab = document.querySelector('.mobile-category-tab.active');
    renderMenuItems(activeTab?.dataset.category);
  });

  elements.mobileCartBtn.addEventListener('click', () => {
    renderCart();
    elements.mobileCartDrawer.classList.add('open');
    elements.cartOverlay.classList.add('active');
  });

  elements.closeCartBtn.addEventListener('click', () => {
    elements.mobileCartDrawer.classList.remove('open');
    elements.cartOverlay.classList.remove('active');
  });

  elements.cartOverlay.addEventListener('click', () => {
    elements.mobileCartDrawer.classList.remove('open');
    elements.cartOverlay.classList.remove('active');
  });

  elements.menuContainer.addEventListener('click', e => {
    if (e.target.classList.contains('add-to-cart')) {
      e.preventDefault();
      e.stopPropagation();
      const menuItem = e.target.closest('.menu-item');
      const item = JSON.parse(e.target.dataset.item);
      addItemToCart(item, menuItem);
    }
  });

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

  elements.mobileCheckoutBtn.addEventListener('click', (e) => {
    const orderType = document.querySelector('input[name="orderType"]:checked')?.value || 'Delivery';
    const errors = validateOrder(cart, orderType);
    
    if (errors.length > 0) {
      e.preventDefault();
      showNotification(errors[0], 'error');
      elements.mobileCheckoutBtn.classList.add('shake');
      setTimeout(() => {
        elements.mobileCheckoutBtn.classList.remove('shake');
      }, 500);
      return;
    }
    
    if (cart.length > 0) {
      window.location.href = 'checkout.html';
    } else {
      showNotification('Your cart is empty');
    }
  });

  elements.orderTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const hasCombos = cart.some(item => item.category === 'Combos');
      if (radio.value === 'Delivery' && hasCombos) {
        showNotification('Switch to pickup or remove combos for delivery', 'warning');
        elements.deliveryRestriction.style.display = 'block';
      } else {
        elements.deliveryRestriction.style.display = 'none';
      }
      renderCart();
    });
  });
}

document.addEventListener('DOMContentLoaded', initMenu);