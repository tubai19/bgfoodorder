// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBuBmCQvvNVFsH2x6XGrHXrgZyULB1_qH8",
  authDomain: "bakeandgrill-44c25.firebaseapp.com",
  projectId: "bakeandgrill-44c25",
  storageBucket: "bakeandgrill-44c25.appspot.com",
  messagingSenderId: "713279633359",
  appId: "1:713279633359:web:ba6bcd411b1b6be7b904ba",
  measurementId: "G-SLG2R88J72"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Sound notification for new orders
const newOrderSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
newOrderSound.volume = 0.5;
let lastOrderId = null;

// Admin configuration
const ADMIN_EMAIL = "suvradeep.pal93@gmail.com";

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const adminDashboard = document.getElementById('adminDashboard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const currentTime = document.getElementById('currentTime');
const navItems = document.querySelectorAll('.sidebar li');
const contentSections = document.querySelectorAll('.content-section');
const orderFilter = document.getElementById('orderFilter');
const orderSearch = document.getElementById('orderSearch');
const ordersListContainer = document.getElementById('ordersListContainer');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const menuCategoriesContainer = document.getElementById('menuCategoriesContainer');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const shopOpenToggle = document.getElementById('shopOpenToggle');
const deliveryOpenToggle = document.getElementById('deliveryOpenToggle');
const applyAnalyticsBtn = document.getElementById('applyAnalyticsBtn');

// Modal elements
const addCategoryModal = document.getElementById('addCategoryModal');
const menuItemModal = document.getElementById('menuItemModal');
const confirmationModal = document.getElementById('confirmationModal');
const closeModalButtons = document.querySelectorAll('.close-modal, .cancel-btn');

// Form elements
const categoryNameInput = document.getElementById('categoryName');
const categoryIconInput = document.getElementById('categoryIcon');
const itemNameInput = document.getElementById('itemName');
const itemNameBnInput = document.getElementById('itemNameBn');
const itemDescInput = document.getElementById('itemDesc');
const variantsContainer = document.getElementById('variantsContainer');
const addVariantBtn = document.getElementById('addVariantBtn');
const saveMenuItemBtn = document.getElementById('saveMenuItemBtn');
const currentCategoryIdInput = document.getElementById('currentCategoryId');
const currentItemIdInput = document.getElementById('currentItemId');
const confirmAddCategoryBtn = document.getElementById('confirmAddCategoryBtn');
const confirmActionBtn = document.getElementById('confirmActionBtn');
const confirmationTitle = document.getElementById('confirmationTitle');
const confirmationMessage = document.getElementById('confirmationMessage');

// Settings form elements
const restaurantNameInput = document.getElementById('restaurantName');
const contactNumberInput = document.getElementById('contactNumber');
const deliveryRadiusInput = document.getElementById('deliveryRadius');
const minDeliveryOrderInput = document.getElementById('minDeliveryOrder');
const charge04kmInput = document.getElementById('charge04km');
const charge46kmInput = document.getElementById('charge46km');
const charge68kmInput = document.getElementById('charge68km');
const freeDeliveryAboveInput = document.getElementById('freeDeliveryAbove');

// Global variables
let currentAction = null;
let actionData = null;
let menuData = {};
let settingsData = {};
let dailySalesChart = null;
let topItemsChart = null;

// Initialize the admin interface
document.addEventListener('DOMContentLoaded', function() {
  // Check auth state
  auth.onAuthStateChanged(user => {
    if (user && user.email === ADMIN_EMAIL) {
      showAdminDashboard();
      setupRealtimeListeners();
      loadSettings();
    } else {
      showLoginScreen();
    }
  });

  updateCurrentTime();
  setInterval(updateCurrentTime, 1000);
  setupEventListeners();
});

function setupEventListeners() {
  // Login form submission
  loginForm.addEventListener('submit', handleLogin);

  // Logout button
  logoutBtn.addEventListener('click', handleLogout);

  // Navigation menu
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      showSection(section);
      navItems.forEach(navItem => navItem.classList.remove('active'));
      item.classList.add('active');
      
      // Initialize charts when analytics section is shown
      if (section === 'analytics') {
        loadAnalyticsData();
      }
    });
  });

  // Order filter
  orderFilter.addEventListener('change', filterOrders);
  orderSearch.addEventListener('input', filterOrders);

  // Menu management
  addCategoryBtn.addEventListener('click', () => showModal(addCategoryModal));
  confirmAddCategoryBtn.addEventListener('click', addNewCategory);
  addVariantBtn.addEventListener('click', addVariantRow);
  saveMenuItemBtn.addEventListener('click', saveMenuItem);

  // Settings
  saveSettingsBtn.addEventListener('click', saveSettings);
  
  if (shopOpenToggle) {
    shopOpenToggle.addEventListener('change', () => {
      console.log('Shop status changed:', shopOpenToggle.checked);
    });
  }

  if (deliveryOpenToggle) {
    deliveryOpenToggle.addEventListener('change', () => {
      console.log('Delivery status changed:', deliveryOpenToggle.checked);
    });
  }

  // Analytics
  if (applyAnalyticsBtn) {
    applyAnalyticsBtn.addEventListener('click', loadAnalyticsData);
  }

  // Modal controls
  closeModalButtons.forEach(button => {
    button.addEventListener('click', () => {
      hideModal(addCategoryModal);
      hideModal(menuItemModal);
      hideModal(confirmationModal);
    });
  });

  // Click outside modal to close
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      hideModal(addCategoryModal);
      hideModal(menuItemModal);
      hideModal(confirmationModal);
    }
  });

  // Confirm action button
  if (confirmActionBtn) {
    confirmActionBtn.addEventListener('click', () => {
      hideModal(confirmationModal);
      
      switch(currentAction) {
        case 'updateOrderStatus':
          updateOrderStatus(actionData);
          break;
        case 'deleteCategory':
          deleteCategory(actionData);
          break;
        case 'deleteMenuItem':
          deleteMenuItem(actionData);
          break;
      }
      
      currentAction = null;
      actionData = null;
    });
  }
}

// Authentication functions
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('adminEmail').value;
  const password = document.getElementById('adminPassword').value;
  
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    if (user.email === ADMIN_EMAIL) {
      showAdminDashboard();
      setupRealtimeListeners();
      loadSettings();
    } else {
      await auth.signOut();
      showError('Access restricted to admin only');
    }
  } catch (error) {
    console.error("Login error:", error);
    showError(getErrorMessage(error.code));
  }
}

async function handleLogout() {
  try {
    await auth.signOut();
    showLoginScreen();
  } catch (error) {
    console.error("Logout error:", error);
    showError('Logout failed. Please try again.');
  }
}

function getErrorMessage(errorCode) {
  switch(errorCode) {
    case 'auth/invalid-email': return 'Invalid email address';
    case 'auth/user-disabled': return 'Account disabled';
    case 'auth/user-not-found': return 'Account not found';
    case 'auth/wrong-password': return 'Incorrect password';
    case 'auth/too-many-requests': return 'Too many attempts. Try again later';
    default: return 'Login failed. Please try again';
  }
}

// UI Functions
function showLoginScreen() {
  loginScreen.style.display = 'flex';
  adminDashboard.style.display = 'none';
  document.getElementById('adminEmail').value = '';
  document.getElementById('adminPassword').value = '';
  loginError.textContent = '';
}

function showAdminDashboard() {
  loginScreen.style.display = 'none';
  adminDashboard.style.display = 'block';
}

function showSection(sectionId) {
  contentSections.forEach(section => {
    section.style.display = 'none';
  });
  document.getElementById(`${sectionId}Section`).style.display = 'block';
}

function updateCurrentTime() {
  const now = new Date();
  currentTime.textContent = now.toLocaleString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showError(message) {
  loginError.textContent = message;
  setTimeout(() => loginError.textContent = '', 5000);
}

function showModal(modal) {
  modal.style.display = 'block';
}

function hideModal(modal) {
  modal.style.display = 'none';
}

function showConfirmation(title, message, action, data = null) {
  if (!confirmationTitle || !confirmationMessage) {
    console.error("Confirmation modal elements not found");
    return;
  }
  
  currentAction = action;
  actionData = data;
  confirmationTitle.textContent = title;
  confirmationMessage.textContent = message;
  showModal(confirmationModal);
}

function playNewOrderSound() {
  newOrderSound.currentTime = 0;
  newOrderSound.play().catch(e => console.log("Sound playback prevented:", e));
}

// Setup real-time Firestore listeners
function setupRealtimeListeners() {
  // Real-time orders listener
  db.collection('orders')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .onSnapshot(snapshot => {
      ordersListContainer.innerHTML = '';
      
      if (snapshot.empty) {
        ordersListContainer.innerHTML = '<div class="no-orders">No orders found</div>';
        return;
      }
      
      // Check for new orders
      if (snapshot.docs.length > 0) {
        const latestOrder = snapshot.docs[0];
        if (lastOrderId !== latestOrder.id) {
          if (lastOrderId !== null) { // Don't play sound on first load
            playNewOrderSound();
          }
          lastOrderId = latestOrder.id;
        }
      }
      
      snapshot.forEach(doc => {
        const order = doc.data();
        order.id = doc.id;
        renderOrderCard(order);
      });
    }, error => {
      console.error("Orders listener error:", error);
      ordersListContainer.innerHTML = '<div class="error">Failed to load orders</div>';
    });

  // Real-time menu listener
  db.collection('menuCategories').onSnapshot(snapshot => {
    menuData = {};
    menuCategoriesContainer.innerHTML = '';
    
    if (snapshot.empty) {
      menuCategoriesContainer.innerHTML = '<div class="no-categories">No menu categories found</div>';
      return;
    }
    
    snapshot.forEach(doc => {
      const category = doc.data();
      category.id = doc.id;
      menuData[category.id] = category;
      renderCategoryCard(category);
    });
  }, error => {
    console.error("Menu listener error:", error);
    menuCategoriesContainer.innerHTML = '<div class="error">Failed to load menu</div>';
  });
}

// Data Loading Functions
async function loadSettings() {
  try {
    const doc = await db.collection('settings').doc('restaurantSettings').get();
    
    if (doc.exists) {
      settingsData = doc.data();
      updateSettingsForm(settingsData);
    } else {
      // Initialize default settings
      settingsData = {
        restaurantName: "Bake & Grill",
        contactNumber: "+918240266267",
        deliveryRadius: 8,
        minDeliveryOrder: 200,
        charge04km: 0,
        charge46km: 20,
        charge68km: 30,
        freeDeliveryAbove: 500,
        isShopOpen: true,
        isDeliveryAvailable: true
      };
      await db.collection('settings').doc('restaurantSettings').set(settingsData);
      updateSettingsForm(settingsData);
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

function updateSettingsForm(settings) {
  if (restaurantNameInput) restaurantNameInput.value = settings.restaurantName || 'Bake & Grill';
  if (contactNumberInput) contactNumberInput.value = settings.contactNumber || '+918240266267';
  if (deliveryRadiusInput) deliveryRadiusInput.value = settings.deliveryRadius || 8;
  if (minDeliveryOrderInput) minDeliveryOrderInput.value = settings.minDeliveryOrder || 200;
  if (charge04kmInput) charge04kmInput.value = settings.charge04km || 0;
  if (charge46kmInput) charge46kmInput.value = settings.charge46km || 20;
  if (charge68kmInput) charge68kmInput.value = settings.charge68km || 30;
  if (freeDeliveryAboveInput) freeDeliveryAboveInput.value = settings.freeDeliveryAbove || 500;
  if (shopOpenToggle) shopOpenToggle.checked = settings.isShopOpen !== false;
  if (deliveryOpenToggle) deliveryOpenToggle.checked = settings.isDeliveryAvailable !== false;
}

async function saveSettings() {
  const settings = {
    restaurantName: restaurantNameInput.value.trim(),
    contactNumber: contactNumberInput.value.trim(),
    deliveryRadius: Number(deliveryRadiusInput.value),
    minDeliveryOrder: Number(minDeliveryOrderInput.value),
    charge04km: Number(charge04kmInput.value),
    charge46km: Number(charge46kmInput.value),
    charge68km: Number(charge68kmInput.value),
    freeDeliveryAbove: Number(freeDeliveryAboveInput.value),
    isShopOpen: shopOpenToggle.checked,
    isDeliveryAvailable: deliveryOpenToggle.checked,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  try {
    await db.collection('settings').doc('restaurantSettings').set(settings, { merge: true });
    await db.collection('publicStatus').doc('current').set({
      isShopOpen: settings.isShopOpen,
      isDeliveryAvailable: settings.isDeliveryAvailable,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    showError('Settings saved successfully');
  } catch (error) {
    console.error("Error saving settings:", error);
    showError('Failed to save settings');
  }
}

// WhatsApp Integration
async function sendWhatsAppUpdate(order, isStatusUpdate = false) {
  if (!order.phoneNumber) {
    showError('Customer phone number not available');
    return;
  }

  const formattedPhone = order.phoneNumber.startsWith('+') ? 
    order.phoneNumber.replace(/\D/g, '') : 
    `91${order.phoneNumber.replace(/\D/g, '')}`;

  const statusTemplates = {
    preparing: `🛒 Order ${order.orderNumber ? '#' + order.orderNumber : ''}\n\n` +
               `👨‍🍳 We're preparing your order!\n` +
               `⏳ Ready in 20-30 minutes\n\n` +
               `Thank you for choosing Bake & Grill!`,
    delivering: `🛵 Order ${order.orderNumber ? '#' + order.orderNumber : ''}\n\n` +
                `🚀 Your order is out for delivery!\n` +
                `📱 Contact: +91 8240266267\n\n` +
                `Thank you for your patience!`,
    completed: `✅ Order ${order.orderNumber ? '#' + order.orderNumber : ''}\n\n` +
               `🎉 Order delivered successfully!\n\n` +
               `We hope you enjoyed your meal from Bake & Grill!`
  };

  const message = isStatusUpdate && statusTemplates[order.status.toLowerCase()] 
    ? statusTemplates[order.status.toLowerCase()]
    : `*Order Update*\n\n` +
      `Order: ${order.orderNumber ? '#' + order.orderNumber : ''}\n` +
      `Status: ${order.status}\n\n` +
      `*Items*\n${order.items.map(item => 
        `- ${item.name} (${item.variant}) x ${item.quantity} = ₹${item.price * item.quantity}`
      ).join('\n')}\n\n` +
      `*Total: ₹${order.total}*\n\n` +
      `Thank you for choosing Bake & Grill!`;

  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
}

// Analytics Functions
async function loadAnalyticsData() {
  try {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
      showError('Please select both start and end dates');
      return;
    }
    
    // Destroy existing charts if they exist
    if (dailySalesChart) {
      dailySalesChart.destroy();
    }
    if (topItemsChart) {
      topItemsChart.destroy();
    }
    
    // Here you would normally fetch data from Firestore
    // For now, we'll use mock data
    const dailySalesCtx = document.getElementById('dailySalesChart').getContext('2d');
    dailySalesChart = new Chart(dailySalesCtx, {
      type: 'bar',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          label: 'Daily Sales',
          data: [1200, 1900, 1500, 2000, 1800, 2500, 2200],
          backgroundColor: 'rgba(230, 57, 70, 0.5)',
          borderColor: 'rgba(230, 57, 70, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
    
    const topItemsCtx = document.getElementById('topItemsChart').getContext('2d');
    topItemsChart = new Chart(topItemsCtx, {
      type: 'pie',
      data: {
        labels: ['Burger', 'Pizza', 'Pasta', 'Salad', 'Drinks'],
        datasets: [{
          label: 'Top Items',
          data: [35, 25, 20, 10, 10],
          backgroundColor: [
            'rgba(230, 57, 70, 0.7)',
            'rgba(42, 157, 143, 0.7)',
            'rgba(233, 196, 106, 0.7)',
            'rgba(168, 218, 220, 0.7)',
            'rgba(29, 53, 87, 0.7)'
          ],
          borderWidth: 1
        }]
      }
    });
    
  } catch (error) {
    console.error("Error loading analytics:", error);
    showError('Failed to load analytics data');
  }
}

// Rendering Functions
function renderOrderCard(order) {
  const orderCard = document.createElement('div');
  orderCard.className = 'order-card';
  orderCard.dataset.orderId = order.id;
  orderCard.dataset.orderNumber = order.orderNumber || '';
  
  // Add new order notification class if this is the latest order
  if (order.id === lastOrderId) {
    orderCard.classList.add('new-order-notification');
    setTimeout(() => {
      orderCard.classList.remove('new-order-notification');
    }, 10000);
  }
  
  // Determine status class and text
  const statusInfo = getStatusInfo(order.status);
  
  // Format timestamp
  const orderDate = order.timestamp?.toDate ? order.timestamp.toDate() : new Date(order.timestamp || Date.now());
  const phoneNumber = order.phoneNumber || 'N/A';
  const formattedPhone = phoneNumber === 'N/A' ? 'N/A' : `+91 ${phoneNumber.slice(0, 5)} ${phoneNumber.slice(5)}`;
  const displayOrderNumber = order.orderNumber ? `#${order.orderNumber}` : `#${order.id.substring(0, 6)}`;
  
  // Create order card HTML
  orderCard.innerHTML = `
    <div class="order-header">
      <span class="order-id">${displayOrderNumber}</span>
      <span class="order-status ${statusInfo.class}">${statusInfo.text}</span>
      <span class="order-time">${formatOrderDate(orderDate)}</span>
    </div>
    <div class="order-body">
      <div class="customer-info">
        <span><i class="fas fa-user"></i> ${order.customerName || 'Customer'}</span>
        <span><i class="fas fa-phone"></i> <a href="tel:+91${phoneNumber.replace(/\D/g, '')}">${formattedPhone}</a></span>
        <span><i class="fas fa-${order.orderType === 'Delivery' ? 'truck' : 'walking'}"></i> ${order.orderType} ${order.deliveryDistance ? `(${order.deliveryDistance}km)` : ''}</span>
      </div>
      <div class="order-items">
        ${order.items.map((item, index) => `
          <div class="order-item">
            <span>${index + 1}. ${item.name} (${item.variant}) x ${item.quantity}</span>
            <span>₹${item.price * item.quantity}</span>
          </div>
        `).join('')}
      </div>
      <div class="order-total">
        <span>Subtotal: ₹${order.subtotal}</span>
        ${order.deliveryCharge > 0 ? `<span>Delivery: ₹${order.deliveryCharge}</span>` : ''}
        <span>Total: ₹${order.total}</span>
      </div>
    </div>
    <div class="order-footer">
      <button class="btn pending-btn ${order.status === 'pending' ? 'active' : ''}" data-action="pending" data-order-id="${order.id}"><i class="fas fa-clock"></i> Pending</button>
      <button class="btn preparing-btn ${order.status === 'preparing' ? 'active' : ''}" data-action="preparing" data-order-id="${order.id}"><i class="fas fa-utensils"></i> Preparing</button>
      ${order.orderType === 'Delivery' ? `
        <button class="btn delivering-btn ${order.status === 'delivering' ? 'active' : ''}" data-action="delivering" data-order-id="${order.id}"><i class="fas fa-motorcycle"></i> Out for Delivery</button>
      ` : ''}
      <button class="btn complete-btn ${order.status === 'completed' ? 'active' : ''}" data-action="completed" data-order-id="${order.id}"><i class="fas fa-check"></i> Complete</button>
      <button class="btn cancel-btn ${order.status === 'cancelled' ? 'active' : ''}" data-action="cancelled" data-order-id="${order.id}"><i class="fas fa-times"></i> Cancel</button>
      <button class="btn whatsapp-btn" data-order-id="${order.id}"><i class="fab fa-whatsapp"></i> Notify Customer</button>
      <button class="btn status-history-btn" data-order-id="${order.id}"><i class="fas fa-history"></i> Status History</button>
    </div>
  `;
  
  // Add event listeners to action buttons
  const buttons = orderCard.querySelectorAll('.btn');
  buttons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = e.target.closest('button').dataset.action;
      const orderId = e.target.closest('button').dataset.orderId;
      
      if (action) {
        // For preparing/delivering/completed, update status and open WhatsApp immediately
        if (['preparing', 'delivering', 'completed'].includes(action)) {
          updateOrderStatus({ orderId, status: action });
        } 
        // For other actions, show confirmation
        else {
          showConfirmation(
            'Confirm Action',
            `Are you sure you want to mark this order as ${action}?`,
            'updateOrderStatus',
            { orderId, status: action }
          );
        }
      } else if (e.target.closest('.whatsapp-btn')) {
        sendWhatsAppUpdate(order);
      } else if (e.target.closest('.status-history-btn')) {
        showStatusHistory(order.id, order.statusHistory || []);
      }
    });
  });
  
  ordersListContainer.appendChild(orderCard);
}

function showStatusHistory(orderId, history) {
  const modal = document.createElement('div');
  modal.className = 'modal status-history-modal';
  
  let historyHTML = '<h3>Order Status History</h3>';
  
  if (history.length === 0) {
    historyHTML += '<p>No status history available</p>';
  } else {
    historyHTML += '<ul class="status-history-list">';
    history.forEach(item => {
      const date = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
      historyHTML += `
        <li>
          <span class="status-badge ${item.status.toLowerCase()}">${item.status}</span>
          <span class="status-date">${date.toLocaleString()}</span>
          ${item.changedBy ? `<span class="status-changed-by">by ${item.changedBy}</span>` : ''}
          ${item.cancellationReason ? `<div class="cancellation-reason">Reason: ${item.cancellationReason}</div>` : ''}
        </li>
      `;
    });
    historyHTML += '</ul>';
  }
  
  modal.innerHTML = `
    <div class="modal-content">
      ${historyHTML}
      <button class="btn close-modal">Close</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.close-modal').addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function renderCategoryCard(category) {
  const categoryCard = document.createElement('div');
  categoryCard.className = 'category-card';
  categoryCard.dataset.categoryId = category.id;
  
  categoryCard.innerHTML = `
    <div class="category-header">
      <h3>${category.name}</h3>
      <div class="category-actions">
        <button class="btn edit-btn" data-action="editCategory" data-category-id="${category.id}"><i class="fas fa-edit"></i></button>
        <button class="btn delete-btn" data-action="deleteCategory" data-category-id="${category.id}"><i class="fas fa-trash"></i></button>
        <button class="btn add-item-btn" data-action="addMenuItem" data-category-id="${category.id}"><i class="fas fa-plus"></i> Add Item</button>
      </div>
    </div>
    <div class="category-items" id="category-items-${category.id}">
      <div class="loading">Loading items...</div>
    </div>
  `;
  
  // Add event listeners to action buttons
  const buttons = categoryCard.querySelectorAll('.btn');
  buttons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = e.target.closest('button').dataset.action;
      const categoryId = e.target.closest('button').dataset.categoryId;
      
      if (action === 'addMenuItem') {
        showAddMenuItemModal(categoryId);
      } else if (action === 'editCategory') {
        showEditCategoryModal(categoryId);
      } else if (action === 'deleteCategory') {
        showConfirmation(
          'Delete Category',
          'Are you sure you want to delete this category and all its items?',
          'deleteCategory',
          { categoryId }
        );
      }
    });
  });
  
  menuCategoriesContainer.appendChild(categoryCard);
  loadCategoryItems(category.id);
}

async function loadCategoryItems(categoryId) {
  try {
    const itemsContainer = document.getElementById(`category-items-${categoryId}`);
    itemsContainer.innerHTML = '<div class="loading">Loading items...</div>';
    
    const snapshot = await db.collection('menuItems')
      .where('categoryId', '==', categoryId)
      .get();
    
    if (snapshot.empty) {
      itemsContainer.innerHTML = '<div class="no-items">No items in this category</div>';
      return;
    }
    
    itemsContainer.innerHTML = '';
    snapshot.forEach(doc => {
      const item = doc.data();
      item.id = doc.id;
      renderMenuItem(item, itemsContainer);
    });
  } catch (error) {
    console.error("Error loading category items:", error);
    document.getElementById(`category-items-${categoryId}`).innerHTML = '<div class="error">Failed to load items</div>';
  }
}

function renderMenuItem(item, container) {
  const menuItem = document.createElement('div');
  menuItem.className = 'menu-item';
  menuItem.dataset.itemId = item.id;
  
  // Format variants
  const variantsHtml = Object.entries(item.variants || {})
    .map(([name, price]) => `<span>${name}: ₹${price}</span>`)
    .join('');
  
  menuItem.innerHTML = `
    <div class="item-info">
      <h4>${item.name}</h4>
      ${item.nameBn ? `<p class="item-name-bn">${item.nameBn}</p>` : ''}
      ${item.desc ? `<p>${item.desc}</p>` : ''}
      <div class="item-variants">${variantsHtml}</div>
    </div>
    <div class="item-actions">
      <button class="btn edit-btn" data-action="editMenuItem" data-item-id="${item.id}"><i class="fas fa-edit"></i></button>
      <button class="btn delete-btn" data-action="deleteMenuItem" data-item-id="${item.id}"><i class="fas fa-trash"></i></button>
    </div>
  `;
  
  // Add event listeners to action buttons
  const buttons = menuItem.querySelectorAll('.btn');
  buttons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = e.target.closest('button').dataset.action;
      const itemId = e.target.closest('button').dataset.itemId;
      
      if (action === 'editMenuItem') {
        showEditMenuItemModal(itemId);
      } else if (action === 'deleteMenuItem') {
        showConfirmation(
          'Delete Menu Item',
          'Are you sure you want to delete this menu item?',
          'deleteMenuItem',
          { itemId }
        );
      }
    });
  });
  
  container.appendChild(menuItem);
}

// Modal Functions
function showAddMenuItemModal(categoryId) {
  currentCategoryIdInput.value = categoryId;
  currentItemIdInput.value = '';
  itemNameInput.value = '';
  itemNameBnInput.value = '';
  itemDescInput.value = '';
  variantsContainer.innerHTML = '';
  addVariantRow(); // Add one empty variant by default
  
  document.getElementById('menuItemModalTitle').textContent = 'Add Menu Item';
  showModal(menuItemModal);
}

function showEditMenuItemModal(itemId) {
  db.collection('menuItems').doc(itemId).get()
    .then(doc => {
      if (doc.exists) {
        const item = doc.data();
        currentCategoryIdInput.value = item.categoryId;
        currentItemIdInput.value = doc.id;
        itemNameInput.value = item.name;
        itemNameBnInput.value = item.nameBn || '';
        itemDescInput.value = item.desc || '';
        variantsContainer.innerHTML = '';
        
        // Add variants
        if (item.variants) {
          Object.entries(item.variants).forEach(([name, price]) => {
            addVariantRow(name, price);
          });
        } else {
          addVariantRow(); // Add one empty variant by default
        }
        
        document.getElementById('menuItemModalTitle').textContent = 'Edit Menu Item';
        showModal(menuItemModal);
      }
    })
    .catch(error => {
      console.error("Error loading menu item:", error);
      showError('Failed to load menu item');
    });
}

function showEditCategoryModal(categoryId) {
  const category = menuData[categoryId];
  if (!category) return;
  
  categoryNameInput.value = category.name;
  categoryIconInput.value = category.icon || '';
  
  currentAction = 'editCategory';
  actionData = { categoryId };
  
  document.querySelector('#addCategoryModal h3').textContent = 'Edit Category';
  document.getElementById('confirmAddCategoryBtn').textContent = 'Update Category';
  showModal(addCategoryModal);
}

function addVariantRow(name = '', price = '') {
  const variantRow = document.createElement('div');
  variantRow.className = 'variant-row';
  
  variantRow.innerHTML = `
    <input type="text" placeholder="Variant name" class="variant-name" value="${name}">
    <input type="number" placeholder="Price" class="variant-price" value="${price}">
    <button class="btn remove-variant-btn"><i class="fas fa-times"></i></button>
  `;
  
  const removeBtn = variantRow.querySelector('.remove-variant-btn');
  removeBtn.addEventListener('click', () => {
    if (variantsContainer.children.length > 1) {
      variantRow.remove();
    }
  });
  
  variantsContainer.appendChild(variantRow);
}

// Data Manipulation Functions
async function addNewCategory() {
  const name = categoryNameInput.value.trim();
  const icon = categoryIconInput.value.trim();
  
  if (!name) {
    showError('Category name is required');
    return;
  }
  
  try {
    if (currentAction === 'editCategory') {
      // Update existing category
      await db.collection('menuCategories').doc(actionData.categoryId).update({
        name,
        icon
      });
      showError('Category updated successfully');
    } else {
      // Add new category
      await db.collection('menuCategories').add({
        name,
        icon,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showError('Category added successfully');
    }
    
    hideModal(addCategoryModal);
    loadMenu();
  } catch (error) {
    console.error("Error saving category:", error);
    showError('Failed to save category');
  }
}

async function saveMenuItem() {
  const name = itemNameInput.value.trim();
  const nameBn = itemNameBnInput.value.trim();
  const desc = itemDescInput.value.trim();
  const categoryId = currentCategoryIdInput.value;
  
  if (!name || !categoryId) {
    showError('Item name and category are required');
    return;
  }
  
  // Collect variants
  const variants = {};
  const variantRows = variantsContainer.querySelectorAll('.variant-row');
  
  variantRows.forEach(row => {
    const name = row.querySelector('.variant-name').value.trim();
    const price = row.querySelector('.variant-price').value.trim();
    
    if (name && price) {
      variants[name] = Number(price);
    }
  });
  
  if (Object.keys(variants).length === 0) {
    showError('At least one variant is required');
    return;
  }
  
  try {
    const itemData = {
      categoryId,
      name,
      variants,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (nameBn) itemData.nameBn = nameBn;
    if (desc) itemData.desc = desc;
    
    if (currentItemIdInput.value) {
      // Update existing item
      await db.collection('menuItems').doc(currentItemIdInput.value).update(itemData);
      showError('Menu item updated successfully');
    } else {
      // Add new item
      itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('menuItems').add(itemData);
      showError('Menu item added successfully');
    }
    
    hideModal(menuItemModal);
    loadMenu();
  } catch (error) {
    console.error("Error saving menu item:", error);
    showError('Failed to save menu item');
  }
}

async function updateOrderStatus(data) {
  console.log("Attempting to update status:", data);
  
  const orderCard = document.querySelector(`.order-card[data-order-id="${data.orderId}"]`);
  if (orderCard) {
    orderCard.classList.add('updating');
  }

  try {
    const orderRef = db.collection('orders').doc(data.orderId);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      throw new Error('Order not found');
    }
    
    const currentStatus = orderDoc.data().status.toLowerCase();
    console.log("Current status:", currentStatus);
    
    // Define valid status transitions
    const validTransitions = {
      pending: ['preparing', 'cancelled'],
      preparing: ['delivering', 'completed', 'cancelled'],
      delivering: ['completed'],
      completed: [],
      cancelled: []
    };
    
    // Check if the transition is valid
    if (validTransitions[currentStatus] && !validTransitions[currentStatus].includes(data.status)) {
      throw new Error(`Cannot change from ${currentStatus} to ${data.status}`);
    }
    
    // Create status history entry with client timestamp
    const newStatusEntry = {
      status: data.status,
      timestamp: new Date(),
      changedBy: auth.currentUser.email
    };

    // Prepare update data
    const updateData = {
      status: data.status,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Special case: if cancelling, add cancellation reason
    if (data.status === 'cancelled') {
      const reason = prompt('Please enter cancellation reason:');
      if (reason) {
        updateData.cancellationReason = reason;
        newStatusEntry.cancellationReason = reason;
      }
    }
    
    // Perform updates
    await orderRef.update(updateData);
    await orderRef.update({
      statusHistory: firebase.firestore.FieldValue.arrayUnion(newStatusEntry)
    });
    
    // Automatically send WhatsApp update
    const updatedOrder = (await orderRef.get()).data();
    if (['preparing', 'delivering', 'completed'].includes(data.status)) {
      sendWhatsAppUpdate(updatedOrder, true);
    }
    
    showError(`Order status updated to ${data.status}`);
  } catch (error) {
    console.error("Error updating order status:", error);
    showError(error.message || 'Failed to update order status');
  } finally {
    if (orderCard) {
      orderCard.classList.remove('updating');
    }
  }
}

async function deleteCategory(data) {
  try {
    // First delete all items in this category
    const itemsSnapshot = await db.collection('menuItems')
      .where('categoryId', '==', data.categoryId)
      .get();
    
    const batch = db.batch();
    itemsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Then delete the category
    batch.delete(db.collection('menuCategories').doc(data.categoryId));
    await batch.commit();
    
    showError('Category and its items deleted successfully');
    loadMenu();
  } catch (error) {
    console.error("Error deleting category:", error);
    showError('Failed to delete category');
  }
}

async function deleteMenuItem(data) {
  try {
    await db.collection('menuItems').doc(data.itemId).delete();
    showError('Menu item deleted successfully');
    loadMenu();
  } catch (error) {
    console.error("Error deleting menu item:", error);
    showError('Failed to delete menu item');
  }
}

// Helper Functions
function filterOrders() {
  const statusFilter = orderFilter.value;
  const searchTerm = orderSearch.value.toLowerCase();
  
  const orderCards = ordersListContainer.querySelectorAll('.order-card');
  let visibleCount = 0;
  
  orderCards.forEach(card => {
    const status = card.querySelector('.order-status').textContent.toLowerCase();
    const customerName = card.querySelector('.customer-info span:first-child').textContent.toLowerCase();
    const orderId = card.querySelector('.order-id').textContent.toLowerCase();
    
    const statusMatch = statusFilter === 'all' || status === statusFilter;
    const searchMatch = !searchTerm || 
      customerName.includes(searchTerm) || 
      orderId.includes(searchTerm);
    
    if (statusMatch && searchMatch) {
      card.style.display = 'block';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });
  
  if (visibleCount === 0) {
    ordersListContainer.innerHTML = '<div class="no-orders">No orders match your criteria</div>';
  }
}

function getStatusInfo(status) {
  switch(status) {
    case 'pending': return { class: 'pending', text: 'Pending' };
    case 'preparing': return { class: 'preparing', text: 'Preparing' };
    case 'delivering': return { class: 'delivering', text: 'Out for Delivery' };
    case 'completed': return { class: 'completed', text: 'Completed' };
    case 'cancelled': return { class: 'cancelled', text: 'Cancelled' };
    default: return { class: '', text: status };
  }
}

function formatOrderDate(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function loadMenu() {
  // This will trigger the real-time menu listener again
  db.collection('menuCategories').get().then(() => {
    console.log("Menu reloaded");
  });
}

/* ======================== */
/*    ORDER NUMBER SYSTEM   */
/* ======================== */

async function getNextOrderNumber() {
  const orderCountRef = db.collection('counters').doc('orders');
  try {
    return await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(orderCountRef);
      const newCount = (counterDoc.data()?.count || 1000) + 1;
      transaction.set(orderCountRef, { count: newCount }, { merge: true });
      return String(newCount).padStart(6, '0');
    });
  } catch (error) {
    console.error("Error getting order number:", error);
    return String(Date.now()).slice(-6);
  }
}