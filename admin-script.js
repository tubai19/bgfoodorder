// Firebase configuration - Load from environment variables in production
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
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions();
const messaging = firebase.messaging.isSupported() ? firebase.messaging() : null;

// Admin configuration - Should be configured in Firebase in production
const ADMIN_EMAILS = [
  "suvradeep.pal93@gmail.com",
  // Add additional admin emails as needed
];

// DOM Elements
const elements = {
  // Auth elements
  loginScreen: document.getElementById('loginScreen'),
  adminDashboard: document.getElementById('adminDashboard'),
  loginForm: document.getElementById('loginForm'),
  loginError: document.getElementById('loginError'),
  logoutBtn: document.getElementById('logoutBtn'),
  
  // Navigation elements
  currentTime: document.getElementById('currentTime'),
  navItems: document.querySelectorAll('.sidebar li'),
  contentSections: document.querySelectorAll('.content-section'),
  
  // Order management
  orderFilter: document.getElementById('orderFilter'),
  orderSearch: document.getElementById('orderSearch'),
  ordersListContainer: document.getElementById('ordersListContainer'),
  
  // Menu management
  addCategoryBtn: document.getElementById('addCategoryBtn'),
  menuCategoriesContainer: document.getElementById('menuCategoriesContainer'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  
  // Modals
  modals: {
    addCategory: document.getElementById('addCategoryModal'),
    menuItem: document.getElementById('menuItemModal'),
    confirmation: document.getElementById('confirmationModal')
  },
  
  // Form elements
  inputs: {
    categoryName: document.getElementById('categoryName'),
    categoryIcon: document.getElementById('categoryIcon'),
    itemName: document.getElementById('itemName'),
    itemNameBn: document.getElementById('itemNameBn'),
    itemDesc: document.getElementById('itemDesc'),
    variantsContainer: document.getElementById('variantsContainer'),
    currentCategoryId: document.getElementById('currentCategoryId'),
    currentItemId: document.getElementById('currentItemId'),
    
    // Settings
    restaurantName: document.getElementById('restaurantName'),
    contactNumber: document.getElementById('contactNumber'),
    deliveryRadius: document.getElementById('deliveryRadius'),
    minDeliveryOrder: document.getElementById('minDeliveryOrder'),
    charge04km: document.getElementById('charge04km'),
    charge46km: document.getElementById('charge46km'),
    charge68km: document.getElementById('charge68km'),
    freeDeliveryAbove: document.getElementById('freeDeliveryAbove')
  },
  
  // Buttons
  buttons: {
    addVariant: document.getElementById('addVariantBtn'),
    saveMenuItem: document.getElementById('saveMenuItemBtn'),
    confirmAddCategory: document.getElementById('confirmAddCategoryBtn'),
    confirmAction: document.getElementById('confirmActionBtn')
  },
  
  // Confirmation modal
  confirmationTitle: document.getElementById('confirmationTitle'),
  confirmationMessage: document.getElementById('confirmationMessage')
};

// Global state
const state = {
  currentAction: null,
  actionData: null,
  menuData: {},
  settingsData: {},
  fcmToken: null,
  tokenExpiry: 0
};

// Initialize the admin interface
document.addEventListener('DOMContentLoaded', function() {
  // Check auth state with email verification
  auth.onAuthStateChanged(user => {
    if (user && ADMIN_EMAILS.includes(user.email)) {
      showAdminDashboard();
      setupRealtimeListeners();
      loadSettings();
      requestNotificationPermission();
    } else {
      showLoginScreen();
      if (user) auth.signOut(); // Log out if not admin
    }
  });

  updateCurrentTime();
  setInterval(updateCurrentTime, 1000);
  setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
  // Login form submission
  elements.loginForm.addEventListener('submit', handleLogin);

  // Logout button
  elements.logoutBtn.addEventListener('click', handleLogout);

  // Navigation menu
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      showSection(section);
      elements.navItems.forEach(navItem => navItem.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // Order filter
  elements.orderFilter.addEventListener('change', filterOrders);
  elements.orderSearch.addEventListener('input', filterOrders);

  // Menu management
  elements.addCategoryBtn.addEventListener('click', () => showModal(elements.modals.addCategory));
  elements.buttons.confirmAddCategory.addEventListener('click', addNewCategory);
  elements.buttons.addVariant.addEventListener('click', addVariantRow);
  elements.buttons.saveMenuItem.addEventListener('click', saveMenuItem);

  // Settings
  elements.saveSettingsBtn.addEventListener('click', saveSettings);

  // Modal controls
  document.querySelectorAll('.close-modal, .cancel-btn').forEach(button => {
    button.addEventListener('click', () => {
      Object.values(elements.modals).forEach(modal => hideModal(modal));
    });
  });

  // Click outside modal to close
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      Object.values(elements.modals).forEach(modal => hideModal(modal));
    }
  });

  // Confirmation action
  elements.buttons.confirmAction.addEventListener('click', confirmAction);
}

// Authentication functions
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('adminEmail').value;
  const password = document.getElementById('adminPassword').value;
  
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    if (ADMIN_EMAILS.includes(user.email)) {
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
  const errorMessages = {
    'auth/invalid-email': 'Invalid email address',
    'auth/user-disabled': 'Account disabled',
    'auth/user-not-found': 'Account not found',
    'auth/wrong-password': 'Incorrect password',
    'auth/too-many-requests': 'Too many attempts. Try again later',
    'auth/network-request-failed': 'Network error. Please check your connection',
    'default': 'Login failed. Please try again'
  };
  
  return errorMessages[errorCode] || errorMessages.default;
}

// UI Functions
function showLoginScreen() {
  elements.loginScreen.style.display = 'flex';
  elements.adminDashboard.style.display = 'none';
  document.getElementById('adminEmail').value = '';
  document.getElementById('adminPassword').value = '';
  elements.loginError.textContent = '';
}

function showAdminDashboard() {
  elements.loginScreen.style.display = 'none';
  elements.adminDashboard.style.display = 'block';
  showSection('orders'); // Default to orders section
}

function showSection(sectionId) {
  elements.contentSections.forEach(section => {
    section.style.display = 'none';
  });
  document.getElementById(`${sectionId}Section`).style.display = 'block';
}

function updateCurrentTime() {
  const now = new Date();
  elements.currentTime.textContent = now.toLocaleString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showError(message) {
  elements.loginError.textContent = message;
  setTimeout(() => elements.loginError.textContent = '', 5000);
}

function showModal(modal) {
  modal.style.display = 'block';
}

function hideModal(modal) {
  modal.style.display = 'none';
}

function showConfirmation(title, message, action, data = null) {
  state.currentAction = action;
  state.actionData = data;
  elements.confirmationTitle.textContent = title;
  elements.confirmationMessage.textContent = message;
  showModal(elements.modals.confirmation);
}

// Setup real-time Firestore listeners
function setupRealtimeListeners() {
  // Real-time orders listener
  db.collection('orders')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .onSnapshot(snapshot => {
      elements.ordersListContainer.innerHTML = '';
      
      if (snapshot.empty) {
        elements.ordersListContainer.innerHTML = '<div class="no-orders">No orders found</div>';
        return;
      }
      
      snapshot.forEach(doc => {
        const order = doc.data();
        order.id = doc.id;
        renderOrderCard(order);
      });
    }, error => {
      console.error("Orders listener error:", error);
      elements.ordersListContainer.innerHTML = '<div class="error">Failed to load orders</div>';
    });

  // Real-time menu listener
  db.collection('menuCategories').onSnapshot(snapshot => {
    state.menuData = {};
    elements.menuCategoriesContainer.innerHTML = '';
    
    if (snapshot.empty) {
      elements.menuCategoriesContainer.innerHTML = '<div class="no-categories">No menu categories found</div>';
      return;
    }
    
    snapshot.forEach(doc => {
      const category = doc.data();
      category.id = doc.id;
      state.menuData[category.id] = category;
      renderCategoryCard(category);
    });
  }, error => {
    console.error("Menu listener error:", error);
    elements.menuCategoriesContainer.innerHTML = '<div class="error">Failed to load menu</div>';
  });
}

// Data Loading Functions
async function loadSettings() {
  try {
    const doc = await db.collection('settings').doc('restaurantSettings').get();
    
    if (doc.exists) {
      state.settingsData = doc.data();
      updateSettingsForm(state.settingsData);
    } else {
      // Initialize default settings
      state.settingsData = {
        restaurantName: "Bake & Grill",
        contactNumber: "+918240266267",
        deliveryRadius: 8,
        minDeliveryOrder: 200,
        charge04km: 0,
        charge46km: 20,
        charge68km: 30,
        freeDeliveryAbove: 500,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('settings').doc('restaurantSettings').set(state.settingsData);
      updateSettingsForm(state.settingsData);
    }
  } catch (error) {
    console.error("Error loading settings:", error);
    showError('Failed to load settings');
  }
}

// Notification functions
async function requestNotificationPermission() {
  if (!messaging) return;
  
  try {
    await Notification.requestPermission();
    state.fcmToken = await messaging.getToken();
    
    if (state.fcmToken) {
      console.log("FCM Token:", state.fcmToken);
      // You might want to store this token in Firestore for the admin user
    }
  } catch (error) {
    console.error("Notification permission error:", error);
  }
}

async function sendStatusNotification(phoneNumber, orderId, status) {
  if (!isValidPhoneNumber(phoneNumber)) {
    console.error(`Invalid phone number format for order ${orderId}: ${phoneNumber}`);
    return false;
  }

  try {
    // First get the token for this phone number
    const tokenDoc = await db.collection('fcmTokens').doc(phoneNumber.trim()).get();
    
    if (!tokenDoc.exists) {
      console.warn(`No FCM token found for phone: ${phoneNumber}`);
      return false;
    }
    
    const tokenData = tokenDoc.data();
    const token = tokenData.token;
    
    if (!token) {
      console.warn(`Empty FCM token for phone: ${phoneNumber}`);
      return false;
    }

    // Status messages
    const statusMessages = {
      pending: 'Your order is pending confirmation',
      preparing: 'Your order is being prepared',
      delivering: 'Your order is out for delivery',
      completed: 'Your order has been delivered',
      cancelled: 'Your order has been cancelled'
    };

    // Send notification via Firebase Functions
    const sendNotification = functions.httpsCallable('sendOrderStatusNotification');
    const result = await sendNotification({
      token,
      orderId,
      status,
      phoneNumber: phoneNumber.trim(),
      message: statusMessages[status] || 'Your order status has been updated'
    });

    console.log("Notification sent successfully:", result);
    return true;
  } catch (error) {
    console.error('Notification send error:', error);
    showError(`Failed to send notification: ${error.message}`);
    return false;
  }
}

// Phone number validation
function isValidPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const trimmedPhone = phone.trim();
  return /^\+?[\d\s-]{10,15}$/.test(trimmedPhone);
}

// Order status management
async function updateOrderStatus(data) {
  const orderCard = document.querySelector(`.order-card[data-order-id="${data.orderId}"]`);
  if (orderCard) {
    orderCard.classList.add('updating');
  }

  try {
    const orderRef = db.collection("orders").doc(data.orderId);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      throw new Error('Order not found');
    }
    
    const orderData = orderDoc.data();
    const currentStatus = orderData.status.toLowerCase();
    
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
      }
    }
    
    // Perform updates
    await orderRef.update(updateData);
    await orderRef.update({
      statusHistory: firebase.firestore.FieldValue.arrayUnion({
        status: data.status,
        timestamp: new Date(),
        changedBy: auth.currentUser.email
      })
    });
    
    // Attempt notification if phone exists
    if (orderData.phoneNumber) {
      const notificationSent = await sendStatusNotification(orderData.phoneNumber, data.orderId, data.status);
      if (!notificationSent) {
        console.warn(`Notification failed for order ${data.orderId}`);
      }
    } else {
      console.warn(`Order ${data.orderId} has no phone number - status updated but no notification sent`);
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

// Rendering Functions
function renderOrderCard(order) {
  const orderCard = document.createElement('div');
  orderCard.className = 'order-card';
  orderCard.dataset.orderId = order.id;
  
  // Determine status class and text
  const statusInfo = getStatusInfo(order.status);
  
  // Format timestamp
  const orderDate = order.timestamp.toDate();
  const dateString = formatOrderDate(orderDate);
  
  // Create order card HTML
  orderCard.innerHTML = `
    <div class="order-header">
      <span class="order-id">#${order.id.substring(0, 8)}</span>
      <span class="order-status ${statusInfo.class}">${statusInfo.text}</span>
      <span class="order-time">${dateString}</span>
    </div>
    <div class="order-body">
      <div class="customer-info">
        <span><i class="fas fa-user"></i> ${order.customerName}</span>
        <span><i class="fas fa-phone"></i> ${order.phoneNumber || 'N/A'}</span>
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
        <span>Total: ₹${order.subtotal}</span>
        ${order.deliveryCharge > 0 ? `<span>Delivery: ₹${order.deliveryCharge}</span>` : ''}
        <span>Grand Total: ₹${order.total}</span>
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
    </div>
  `;
  
  // Add event listeners to action buttons
  const buttons = orderCard.querySelectorAll('.btn');
  buttons.forEach(button => {
    button.addEventListener('click', (e) => {
      const action = e.target.closest('button').dataset.action;
      const orderId = e.target.closest('button').dataset.orderId;
      showConfirmation(
        'Confirm Action',
        `Are you sure you want to mark this order as ${action}?`,
        'updateOrderStatus',
        { orderId, status: action }
      );
    });
  });
  
  elements.ordersListContainer.appendChild(orderCard);
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
  
  elements.menuCategoriesContainer.appendChild(categoryCard);
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
  elements.inputs.currentCategoryId.value = categoryId;
  elements.inputs.currentItemId.value = '';
  elements.inputs.itemName.value = '';
  elements.inputs.itemNameBn.value = '';
  elements.inputs.itemDesc.value = '';
  elements.inputs.variantsContainer.innerHTML = '';
  addVariantRow(); // Add one empty variant by default
  
  document.getElementById('menuItemModalTitle').textContent = 'Add Menu Item';
  showModal(elements.modals.menuItem);
}

function showEditMenuItemModal(itemId) {
  db.collection('menuItems').doc(itemId).get()
    .then(doc => {
      if (doc.exists) {
        const item = doc.data();
        elements.inputs.currentCategoryId.value = item.categoryId;
        elements.inputs.currentItemId.value = doc.id;
        elements.inputs.itemName.value = item.name;
        elements.inputs.itemNameBn.value = item.nameBn || '';
        elements.inputs.itemDesc.value = item.desc || '';
        elements.inputs.variantsContainer.innerHTML = '';
        
        // Add variants
        if (item.variants) {
          Object.entries(item.variants).forEach(([name, price]) => {
            addVariantRow(name, price);
          });
        } else {
          addVariantRow(); // Add one empty variant by default
        }
        
        document.getElementById('menuItemModalTitle').textContent = 'Edit Menu Item';
        showModal(elements.modals.menuItem);
      }
    })
    .catch(error => {
      console.error("Error loading menu item:", error);
      showError('Failed to load menu item');
    });
}

function showEditCategoryModal(categoryId) {
  const category = state.menuData[categoryId];
  if (!category) return;
  
  elements.inputs.categoryName.value = category.name;
  elements.inputs.categoryIcon.value = category.icon || '';
  
  state.currentAction = 'editCategory';
  state.actionData = { categoryId };
  
  document.querySelector('#addCategoryModal h3').textContent = 'Edit Category';
  document.getElementById('confirmAddCategoryBtn').textContent = 'Update Category';
  showModal(elements.modals.addCategory);
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
    if (elements.inputs.variantsContainer.children.length > 1) {
      variantRow.remove();
    }
  });
  
  elements.inputs.variantsContainer.appendChild(variantRow);
}

// Data Manipulation Functions
async function addNewCategory() {
  const name = elements.inputs.categoryName.value.trim();
  const icon = elements.inputs.categoryIcon.value.trim();
  
  if (!name) {
    showError('Category name is required');
    return;
  }
  
  try {
    if (state.currentAction === 'editCategory') {
      // Update existing category
      await db.collection('menuCategories').doc(state.actionData.categoryId).update({
        name,
        icon,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
    
    hideModal(elements.modals.addCategory);
    loadMenu();
  } catch (error) {
    console.error("Error saving category:", error);
    showError('Failed to save category');
  }
}

async function saveMenuItem() {
  const name = elements.inputs.itemName.value.trim();
  const nameBn = elements.inputs.itemNameBn.value.trim();
  const desc = elements.inputs.itemDesc.value.trim();
  const categoryId = elements.inputs.currentCategoryId.value;
  
  if (!name || !categoryId) {
    showError('Item name and category are required');
    return;
  }
  
  // Collect variants
  const variants = {};
  const variantRows = elements.inputs.variantsContainer.querySelectorAll('.variant-row');
  
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
    
    if (elements.inputs.currentItemId.value) {
      // Update existing item
      await db.collection('menuItems').doc(elements.inputs.currentItemId.value).update(itemData);
      showError('Menu item updated successfully');
    } else {
      // Add new item
      itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('menuItems').add(itemData);
      showError('Menu item added successfully');
    }
    
    hideModal(elements.modals.menuItem);
    loadMenu();
  } catch (error) {
    console.error("Error saving menu item:", error);
    showError('Failed to save menu item');
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

async function saveSettings() {
  const settings = {
    restaurantName: elements.inputs.restaurantName.value.trim(),
    contactNumber: elements.inputs.contactNumber.value.trim(),
    deliveryRadius: Number(elements.inputs.deliveryRadius.value),
    minDeliveryOrder: Number(elements.inputs.minDeliveryOrder.value),
    charge04km: Number(elements.inputs.charge04km.value),
    charge46km: Number(elements.inputs.charge46km.value),
    charge68km: Number(elements.inputs.charge68km.value),
    freeDeliveryAbove: Number(elements.inputs.freeDeliveryAbove.value),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  // Validate phone number
  if (!isValidPhoneNumber(settings.contactNumber)) {
    showError('Please enter a valid phone number');
    return;
  }
  
  try {
    await db.collection('settings').doc('restaurantSettings').set(settings, { merge: true });
    showError('Settings saved successfully');
  } catch (error) {
    console.error("Error saving settings:", error);
    showError('Failed to save settings');
  }
}

// Helper Functions
function filterOrders() {
  const statusFilter = elements.orderFilter.value;
  const searchTerm = elements.orderSearch.value.toLowerCase();
  
  const orderCards = elements.ordersListContainer.querySelectorAll('.order-card');
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
    elements.ordersListContainer.innerHTML = '<div class="no-orders">No orders match your criteria</div>';
  }
}

function updateSettingsForm(settings) {
  elements.inputs.restaurantName.value = settings.restaurantName || '';
  elements.inputs.contactNumber.value = settings.contactNumber || '';
  elements.inputs.deliveryRadius.value = settings.deliveryRadius || 8;
  elements.inputs.minDeliveryOrder.value = settings.minDeliveryOrder || 200;
  elements.inputs.charge04km.value = settings.charge04km || 0;
  elements.inputs.charge46km.value = settings.charge46km || 20;
  elements.inputs.charge68km.value = settings.charge68km || 30;
  elements.inputs.freeDeliveryAbove.value = settings.freeDeliveryAbove || 500;
}

function getStatusInfo(status) {
  const statusInfo = {
    pending: { class: 'pending', text: 'Pending' },
    preparing: { class: 'preparing', text: 'Preparing' },
    delivering: { class: 'delivering', text: 'Out for Delivery' },
    completed: { class: 'completed', text: 'Completed' },
    cancelled: { class: 'cancelled', text: 'Cancelled' },
    default: { class: '', text: status }
  };
  
  return statusInfo[status] || statusInfo.default;
}

function formatOrderDate(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return `Today, ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    return date.toLocaleString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

function loadMenu() {
  // This will trigger the real-time menu listener again
  db.collection('menuCategories').get().then(() => {
    console.log("Menu reloaded");
  });
}

// Confirm action handler
async function confirmAction() {
  if (!state.currentAction || !state.actionData) return;
  
  hideModal(elements.modals.confirmation);
  
  try {
    // Verify user is still authenticated and is admin
    const user = auth.currentUser;
    if (!user || !ADMIN_EMAILS.includes(user.email)) {
      showError('Session expired or permission denied. Please login again.');
      return;
    }

    switch(state.currentAction) {
      case 'updateOrderStatus':
        await updateOrderStatus(state.actionData);
        break;
      case 'deleteCategory':
        await deleteCategory(state.actionData);
        break;
      case 'deleteMenuItem':
        await deleteMenuItem(state.actionData);
        break;
      default:
        throw new Error('Unknown action');
    }
  } catch (error) {
    console.error("Action failed:", error);
    showError(`Action failed: ${error.message}`);
  } finally {
    state.currentAction = null;
    state.actionData = null;
  }
}