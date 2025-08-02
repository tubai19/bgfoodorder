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

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Sound notification for new orders
const newOrderSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
newOrderSound.volume = 0.5;
let lastOrderId = null;

// Admin configuration
const ADMIN_EMAIL = "suvradeep.pal93@gmail.com";

// DOM Elements
const elements = {
  // Auth elements
  loginScreen: document.getElementById('loginScreen'),
  adminDashboard: document.getElementById('adminDashboard'),
  loginForm: document.getElementById('loginForm'),
  loginError: document.getElementById('loginError'),
  logoutBtn: document.getElementById('logoutBtn'),
  currentTime: document.getElementById('currentTime'),
  
  // Navigation
  navItems: document.querySelectorAll('.sidebar li'),
  contentSections: document.querySelectorAll('.content-section'),
  
  // Orders
  orderFilter: document.getElementById('orderFilter'),
  orderSearch: document.getElementById('orderSearch'),
  ordersListContainer: document.getElementById('ordersListContainer'),
  
  // Menu
  addCategoryBtn: document.getElementById('addCategoryBtn'),
  menuCategoriesContainer: document.getElementById('menuCategoriesContainer'),
  
  // Settings
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  shopOpenToggle: document.getElementById('shopOpenToggle'),
  deliveryOpenToggle: document.getElementById('deliveryOpenToggle'),
  shopStatusText: document.getElementById('shopStatusText'),
  deliveryStatusText: document.getElementById('deliveryStatusText'),
  openingTimeInput: document.getElementById('openingTime'),
  closingTimeInput: document.getElementById('closingTime'),
  deliveryRadiusInput: document.getElementById('deliveryRadius'),
  minDeliveryOrderInput: document.getElementById('minDeliveryOrder'),
  charge04kmInput: document.getElementById('charge04km'),
  charge46kmInput: document.getElementById('charge46km'),
  charge68kmInput: document.getElementById('charge68km'),
  freeDeliveryAboveInput: document.getElementById('freeDeliveryAbove'),
  
  // Modals
  addCategoryModal: document.getElementById('addCategoryModal'),
  menuItemModal: document.getElementById('menuItemModal'),
  confirmationModal: document.getElementById('confirmationModal'),
  closeModalButtons: document.querySelectorAll('.close-modal, .cancel-btn'),
  
  // Menu Item Form
  categoryNameInput: document.getElementById('categoryName'),
  categoryIconInput: document.getElementById('categoryIcon'),
  itemNameInput: document.getElementById('itemName'),
  itemNameBnInput: document.getElementById('itemNameBn'),
  itemDescInput: document.getElementById('itemDesc'),
  variantsContainer: document.getElementById('variantsContainer'),
  addVariantBtn: document.getElementById('addVariantBtn'),
  saveMenuItemBtn: document.getElementById('saveMenuItemBtn'),
  currentCategoryIdInput: document.getElementById('currentCategoryId'),
  currentItemIdInput: document.getElementById('currentItemId'),
  confirmAddCategoryBtn: document.getElementById('confirmAddCategoryBtn'),
  confirmActionBtn: document.getElementById('confirmActionBtn'),
  confirmationTitle: document.getElementById('confirmationTitle'),
  confirmationMessage: document.getElementById('confirmationMessage')
};

// Default Settings
const defaultSettings = {
  isShopOpen: true,
  isDeliveryAvailable: true,
  openingTime: "16:00",
  closingTime: "22:00",
  deliveryRadius: 8,
  minDeliveryOrder: 200,
  charge04km: 0,
  charge46km: 20,
  charge68km: 30,
  freeDeliveryAbove: 500
};

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
  if (elements.loginForm) {
    elements.loginForm.addEventListener('submit', handleLogin);
  }

  // Logout button
  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', handleLogout);
  }

  // Navigation menu
  if (elements.navItems) {
    elements.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        showSection(section);
        elements.navItems.forEach(navItem => navItem.classList.remove('active'));
        item.classList.add('active');
        
        if (section === 'analytics') {
          loadAnalyticsData();
        }
      });
    });
  }

  // Order filter
  if (elements.orderFilter && elements.orderSearch) {
    elements.orderFilter.addEventListener('change', filterOrders);
    elements.orderSearch.addEventListener('input', filterOrders);
  }

  // Menu management
  if (elements.addCategoryBtn) {
    elements.addCategoryBtn.addEventListener('click', () => showModal(elements.addCategoryModal));
  }
  if (elements.confirmAddCategoryBtn) {
    elements.confirmAddCategoryBtn.addEventListener('click', addNewCategory);
  }
  if (elements.addVariantBtn) {
    elements.addVariantBtn.addEventListener('click', addVariantRow);
  }
  if (elements.saveMenuItemBtn) {
    elements.saveMenuItemBtn.addEventListener('click', saveMenuItem);
  }

  // Settings
  if (elements.saveSettingsBtn) {
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
  }
  
  // Shop status toggle
  if (elements.shopOpenToggle) {
    elements.shopOpenToggle.addEventListener('change', function() {
      elements.shopStatusText.textContent = this.checked ? 'Open' : 'Closed';
    });
  }

  // Delivery status toggle
  if (elements.deliveryOpenToggle) {
    elements.deliveryOpenToggle.addEventListener('change', function() {
      elements.deliveryStatusText.textContent = this.checked ? 'Available' : 'Unavailable';
    });
  }

  // Modal controls
  if (elements.closeModalButtons) {
    elements.closeModalButtons.forEach(button => {
      button.addEventListener('click', () => {
        hideModal(elements.addCategoryModal);
        hideModal(elements.menuItemModal);
        hideModal(elements.confirmationModal);
        hideModal(document.getElementById('orderDetailModal'));
      });
    });
  }

  // Click outside modal to close
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      hideModal(elements.addCategoryModal);
      hideModal(elements.menuItemModal);
      hideModal(elements.confirmationModal);
      hideModal(document.getElementById('orderDetailModal'));
    }
  });

  // Confirm action button
  if (elements.confirmActionBtn) {
    elements.confirmActionBtn.addEventListener('click', () => {
      hideModal(elements.confirmationModal);
      
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
  if (elements.loginScreen) elements.loginScreen.style.display = 'flex';
  if (elements.adminDashboard) elements.adminDashboard.style.display = 'none';
  document.getElementById('adminEmail').value = '';
  document.getElementById('adminPassword').value = '';
  if (elements.loginError) elements.loginError.textContent = '';
}

function showAdminDashboard() {
  if (elements.loginScreen) elements.loginScreen.style.display = 'none';
  if (elements.adminDashboard) elements.adminDashboard.style.display = 'block';
}

function showSection(sectionId) {
  if (elements.contentSections) {
    elements.contentSections.forEach(section => {
      section.style.display = 'none';
    });
    const targetSection = document.getElementById(`${sectionId}Section`);
    if (targetSection) targetSection.style.display = 'block';
  }
}

function updateCurrentTime() {
  const now = new Date();
  if (elements.currentTime) {
    elements.currentTime.textContent = now.toLocaleString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

function showError(message) {
  if (elements.loginError) {
    elements.loginError.textContent = message;
    setTimeout(() => {
      if (elements.loginError) elements.loginError.textContent = '';
    }, 5000);
  }
}

function showModal(modal) {
  if (modal) modal.style.display = 'block';
}

function hideModal(modal) {
  if (modal) modal.style.display = 'none';
}

function showConfirmation(title, message, action, data = null) {
  currentAction = action;
  actionData = data;
  if (elements.confirmationTitle) elements.confirmationTitle.textContent = title;
  if (elements.confirmationMessage) elements.confirmationMessage.textContent = message;
  showModal(elements.confirmationModal);
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
      if (!elements.ordersListContainer) return;
      
      elements.ordersListContainer.innerHTML = '';
      
      if (snapshot.empty) {
        elements.ordersListContainer.innerHTML = '<div class="no-orders">No orders found</div>';
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
      if (elements.ordersListContainer) {
        elements.ordersListContainer.innerHTML = '<div class="error">Failed to load orders</div>';
      }
    });

  // Real-time menu listener
  db.collection('menu').onSnapshot(snapshot => {
    menuData = {};
    if (!elements.menuCategoriesContainer) return;
    
    elements.menuCategoriesContainer.innerHTML = '';
    
    if (snapshot.empty) {
      elements.menuCategoriesContainer.innerHTML = '<div class="no-categories">No menu categories found</div>';
      return;
    }
    
    snapshot.forEach(doc => {
      const category = {
        id: doc.id,
        name: doc.id,
        items: doc.data().items
      };
      menuData[category.id] = category;
      renderCategoryCard(category);
    });
  }, error => {
    console.error("Menu listener error:", error);
    if (elements.menuCategoriesContainer) {
      elements.menuCategoriesContainer.innerHTML = '<div class="error">Failed to load menu</div>';
    }
  });
}

// Data Loading Functions
async function loadSettings() {
  try {
    const doc = await db.collection('publicStatus').doc('current').get();
    
    if (doc.exists) {
      settingsData = doc.data();
      updateSettingsForm(settingsData);
    } else {
      // Initialize default settings
      settingsData = defaultSettings;
      await db.collection('publicStatus').doc('current').set(settingsData);
      updateSettingsForm(settingsData);
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

function updateSettingsForm(settings) {
  if (!elements.shopOpenToggle) return;
  
  try {
    elements.shopOpenToggle.checked = settings.isShopOpen !== false;
    elements.shopStatusText.textContent = elements.shopOpenToggle.checked ? 'Open' : 'Closed';
    
    elements.deliveryOpenToggle.checked = settings.isDeliveryAvailable !== false;
    elements.deliveryStatusText.textContent = elements.deliveryOpenToggle.checked ? 'Available' : 'Unavailable';
    
    if (settings.openingTime) elements.openingTimeInput.value = settings.openingTime;
    if (settings.closingTime) elements.closingTimeInput.value = settings.closingTime;
    if (settings.deliveryRadius) elements.deliveryRadiusInput.value = settings.deliveryRadius;
    if (settings.minDeliveryOrder) elements.minDeliveryOrderInput.value = settings.minDeliveryOrder;
    if (settings.charge04km) elements.charge04kmInput.value = settings.charge04km;
    if (settings.charge46km) elements.charge46kmInput.value = settings.charge46km;
    if (settings.charge68km) elements.charge68kmInput.value = settings.charge68km;
    if (settings.freeDeliveryAbove) elements.freeDeliveryAboveInput.value = settings.freeDeliveryAbove;
  } catch (error) {
    console.error("Error updating settings form:", error);
  }
}

async function saveSettings() {
  const settings = {
    isShopOpen: elements.shopOpenToggle.checked,
    isDeliveryAvailable: elements.deliveryOpenToggle.checked,
    openingTime: elements.openingTimeInput.value,
    closingTime: elements.closingTimeInput.value,
    deliveryRadius: Number(elements.deliveryRadiusInput.value),
    minDeliveryOrder: Number(elements.minDeliveryOrderInput.value),
    charge04km: Number(elements.charge04kmInput.value),
    charge46km: Number(elements.charge46kmInput.value),
    charge68km: Number(elements.charge68kmInput.value),
    freeDeliveryAbove: Number(elements.freeDeliveryAboveInput.value),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  try {
    await db.collection('publicStatus').doc('current').set(settings, { merge: true });
    showError('Settings saved successfully');
  } catch (error) {
    console.error("Error saving settings:", error);
    showError('Failed to save settings');
  }
}

// WhatsApp Integration
async function sendWhatsAppUpdate(order) {
  if (!order.phoneNumber) {
    showError('Customer phone number not available');
    return;
  }

  const formattedPhone = order.phoneNumber.startsWith('+') ? 
    order.phoneNumber.replace(/\D/g, '') : 
    `91${order.phoneNumber.replace(/\D/g, '')}`;

  let message = `*Order Update from Bake & Grill*\n\n`;
  message += `*Order ID:* ${order.id.substring(0, 6)}\n`;
  message += `*Status:* ${order.status}\n\n`;
  message += `*Items:*\n`;
  order.items.forEach(item => {
    message += `- ${item.name} (${item.variant}) x ${item.quantity} = ₹${item.price * item.quantity}\n`;
  });
  message += `\n*Total:* ₹${order.total}\n\n`;
  message += `Thank you for your order!`;

  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
}

// Order Status Update Function
async function updateOrderStatus(data) {
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
    
    const orderData = orderDoc.data();
    const statusHistory = orderData.statusHistory || [];
    
    // Create new status entry
    const newStatusEntry = {
      status: data.status,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      changedBy: auth.currentUser.email
    };

    // Add cancellation reason if needed
    if (data.status === 'cancelled') {
      const reason = prompt('Please enter cancellation reason:');
      if (reason) {
        newStatusEntry.cancellationReason = reason;
      }
    }

    // Update order document
    await orderRef.update({
      status: data.status,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      statusHistory: firebase.firestore.FieldValue.arrayUnion(newStatusEntry)
    });

    // Send notification to customer
    await sendOrderNotification(data.orderId, data.status, orderData.phoneNumber);
    
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

// Notification Function
async function sendOrderNotification(orderId, newStatus, phoneNumber) {
  try {
    if (!phoneNumber) {
      console.log("No phone number, skipping notification");
      return;
    }

    // Create notification document
    await db.collection('notifications').add({
      orderId,
      status: newStatus,
      phoneNumber,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      read: false
    });

    // Send WhatsApp message
    const formattedPhone = phoneNumber.startsWith('+') ? 
      phoneNumber.replace(/\D/g, '') : 
      `91${phoneNumber.replace(/\D/g, '')}`;

    const statusText = {
      pending: "is pending",
      preparing: "is being prepared",
      delivering: "is out for delivery",
      completed: "has been completed",
      cancelled: "has been cancelled"
    }[newStatus] || "status has been updated";

    const message = `Your order #${orderId.substring(0, 6)} ${statusText}. Thank you for choosing Bake & Grill!`;
    const encodedMessage = encodeURIComponent(message);
    
    window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
    
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}

// Analytics Functions
async function loadAnalyticsData() {
  try {
    // Destroy existing charts if they exist
    if (dailySalesChart) {
      dailySalesChart.destroy();
    }
    if (topItemsChart) {
      topItemsChart.destroy();
    }
    
    // Get orders for the selected time period
    const timePeriod = document.getElementById('timePeriod').value;
    let startDate, endDate = new Date();
    
    switch(timePeriod) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'custom':
        startDate = new Date(document.getElementById('startDate').value);
        endDate = new Date(document.getElementById('endDate').value);
        break;
    }
    
    const ordersSnapshot = await db.collection('orders')
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate)
      .get();
    
    // Calculate analytics
    const orders = [];
    let totalSales = 0;
    let itemCounts = {};
    
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      orders.push(order);
      totalSales += order.total || 0;
      
      // Count items
      order.items.forEach(item => {
        if (!itemCounts[item.name]) {
          itemCounts[item.name] = 0;
        }
        itemCounts[item.name] += item.quantity;
      });
    });
    
    // Update summary cards
    document.getElementById('totalSalesAmount').textContent = `₹${totalSales.toFixed(2)}`;
    document.getElementById('totalOrdersCount').textContent = orders.length;
    document.getElementById('averageOrderAmount').textContent = orders.length > 0 ? 
      `₹${(totalSales / orders.length).toFixed(2)}` : '₹0.00';
    
    // Prepare data for charts
    const days = [];
    const salesByDay = [];
    const date = new Date(startDate);
    
    while (date <= endDate) {
      const dayStr = date.toLocaleDateString('en-IN', { weekday: 'short' });
      days.push(dayStr);
      
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayOrders = orders.filter(order => {
        const orderDate = order.timestamp?.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
        return orderDate >= dayStart && orderDate <= dayEnd;
      });
      
      const dayTotal = dayOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      salesByDay.push(dayTotal);
      
      date.setDate(date.getDate() + 1);
    }
    
    // Top items data
    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    const topItemNames = topItems.map(item => item[0]);
    const topItemCounts = topItems.map(item => item[1]);
    
    // Create charts
    const dailySalesCtx = document.getElementById('salesTrendChart').getContext('2d');
    dailySalesChart = new Chart(dailySalesCtx, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Daily Sales (₹)',
          data: salesByDay,
          backgroundColor: 'rgba(230, 57, 70, 0.7)',
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
        labels: topItemNames,
        datasets: [{
          label: 'Top Items',
          data: topItemCounts,
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
  if (!elements.ordersListContainer) return;
  
  const orderCard = document.createElement('div');
  orderCard.className = 'order-card';
  orderCard.dataset.orderId = order.id;
  
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
  
  // Create order card HTML
  orderCard.innerHTML = `
    <div class="order-header">
      <span class="order-id">#${order.id.substring(0, 6)}</span>
      <span class="order-status ${statusInfo.class}">${statusInfo.text}</span>
      <span class="order-time">${formatOrderDate(orderDate)}</span>
    </div>
    <div class="order-body">
      <div class="customer-info">
        <span><i class="fas fa-user"></i> ${order.customerName || 'Customer'}</span>
        <span><i class="fas fa-phone"></i> <a href="tel:+91${phoneNumber.replace(/\D/g, '')}">${formattedPhone}</a></span>
        <span><i class="fas fa-${order.orderType === 'Delivery' ? 'truck' : 'walking'}"></i> ${order.orderType} ${order.deliveryDistance ? `(${order.deliveryDistance.toFixed(1)}km)` : ''}</span>
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
      <button class="btn whatsapp-btn" data-order-id="${order.id}"><i class="fab fa-whatsapp"></i> Contact</button>
      <button class="btn details-btn" data-order-id="${order.id}"><i class="fas fa-info-circle"></i> Details</button>
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
        if (action === 'cancelled') {
          showConfirmation(
            'Confirm Cancellation',
            'Are you sure you want to cancel this order?',
            'updateOrderStatus',
            { orderId, status: action }
          );
        } else {
          updateOrderStatus({ orderId, status: action });
        }
      } else if (e.target.closest('.whatsapp-btn')) {
        sendWhatsAppUpdate(order);
      } else if (e.target.closest('.details-btn')) {
        showOrderDetails(order);
      }
    });
  });
  
  elements.ordersListContainer.appendChild(orderCard);
}

function showOrderDetails(order) {
  const modal = document.getElementById('orderDetailModal');
  if (!modal) return;
  
  // Set order details
  document.getElementById('orderId').textContent = order.id.substring(0, 6);
  document.getElementById('customerName').textContent = order.customerName || 'N/A';
  document.getElementById('customerPhone').textContent = order.phoneNumber || 'N/A';
  document.getElementById('orderType').textContent = order.orderType || 'N/A';
  
  // Set delivery info if applicable
  const deliveryInfo = document.getElementById('deliveryInfo');
  if (order.orderType === 'Delivery') {
    deliveryInfo.style.display = 'block';
    document.getElementById('customerAddress').textContent = order.deliveryAddress || 'N/A';
    document.getElementById('deliveryDistance').textContent = order.deliveryDistance ? `${order.deliveryDistance.toFixed(1)} km` : 'N/A';
  } else {
    deliveryInfo.style.display = 'none';
  }
  
  // Set order items
  const orderItemsList = document.getElementById('orderItemsList');
  orderItemsList.innerHTML = '';
  order.items.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.variant}</td>
      <td>${item.quantity}</td>
      <td>₹${item.price * item.quantity}</td>
    `;
    orderItemsList.appendChild(row);
  });
  
  // Set order summary
  document.getElementById('orderSubtotal').textContent = `₹${order.subtotal || 0}`;
  document.getElementById('orderDeliveryFee').textContent = order.deliveryCharge ? `₹${order.deliveryCharge}` : 'Free';
  document.getElementById('orderTotal').textContent = `₹${order.total || 0}`;
  
  // Set current status
  const statusSelect = document.getElementById('orderStatusSelect');
  statusSelect.value = order.status || 'pending';
  
  // Add event listeners
  document.getElementById('updateStatusBtn').onclick = () => {
    updateOrderStatus({
      orderId: order.id,
      status: statusSelect.value
    });
    hideModal(modal);
  };
  
  document.getElementById('whatsappCustomerBtn').onclick = () => {
    sendWhatsAppUpdate(order);
  };
  
  // Show status history
  const statusHistoryContainer = document.getElementById('statusHistoryContainer');
  statusHistoryContainer.innerHTML = '<h5>Status History</h5>';
  
  if (order.statusHistory && order.statusHistory.length > 0) {
    order.statusHistory.forEach(status => {
      const statusEntry = document.createElement('div');
      statusEntry.className = 'status-history-entry';
      
      const statusDate = status.timestamp?.toDate ? status.timestamp.toDate() : new Date(status.timestamp);
      
      statusEntry.innerHTML = `
        <span class="status-badge ${status.status.toLowerCase()}">${status.status}</span>
        <span class="status-date">${statusDate.toLocaleString()}</span>
      `;
      
      statusHistoryContainer.appendChild(statusEntry);
    });
  } else {
    statusHistoryContainer.innerHTML += '<p>No status history available</p>';
  }
  
  showModal(modal);
}

function renderCategoryCard(category) {
  if (!elements.menuCategoriesContainer) return;
  
  const categoryCard = document.createElement('div');
  categoryCard.className = 'category-card';
  categoryCard.dataset.categoryId = category.id;
  
  categoryCard.innerHTML = `
    <div class="category-header">
      <h3>${category.name}</h3>
      <div class="category-actions">
        <button class="btn add-item-btn" data-action="addMenuItem" data-category-id="${category.id}"><i class="fas fa-plus"></i> Add Item</button>
      </div>
    </div>
    <div class="category-items" id="category-items-${category.id}">
      ${category.items.map(item => `
        <div class="menu-item" data-item-id="${item.name}">
          <div class="item-info">
            <h4>${item.name}</h4>
            ${item.nameBn ? `<p class="item-name-bn">${item.nameBn}</p>` : ''}
            ${item.desc ? `<p>${item.desc}</p>` : ''}
            <div class="item-variants">
              ${Object.entries(item.variants).map(([variant, price]) => 
                `<span>${variant}: ₹${price}</span>`
              ).join('')}
            </div>
          </div>
          <div class="item-actions">
            <button class="btn edit-btn" data-action="editMenuItem" data-category-id="${category.id}" data-item-name="${item.name}"><i class="fas fa-edit"></i></button>
            <button class="btn delete-btn" data-action="deleteMenuItem" data-category-id="${category.id}" data-item-name="${item.name}"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  
  // Add event listeners to action buttons
  const buttons = categoryCard.querySelectorAll('.btn');
  buttons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = e.target.closest('button').dataset.action;
      const categoryId = e.target.closest('button').dataset.categoryId;
      const itemName = e.target.closest('button').dataset.itemName;
      
      if (action === 'addMenuItem') {
        showAddMenuItemModal(categoryId);
      } else if (action === 'editMenuItem') {
        showEditMenuItemModal(categoryId, itemName);
      } else if (action === 'deleteMenuItem') {
        showConfirmation(
          'Delete Menu Item',
          `Are you sure you want to delete "${itemName}"?`,
          'deleteMenuItem',
          { categoryId, itemName }
        );
      }
    });
  });
  
  elements.menuCategoriesContainer.appendChild(categoryCard);
}

function showAddMenuItemModal(categoryId) {
  if (!elements.currentCategoryIdInput) return;
  
  elements.currentCategoryIdInput.value = categoryId;
  elements.currentItemIdInput.value = '';
  elements.itemNameInput.value = '';
  elements.itemNameBnInput.value = '';
  elements.itemDescInput.value = '';
  elements.variantsContainer.innerHTML = '';
  addVariantRow(); // Add one empty variant by default
  
  document.getElementById('menuItemModalTitle').textContent = 'Add Menu Item';
  showModal(elements.menuItemModal);
}

function showEditMenuItemModal(categoryId, itemName) {
  const category = menuData[categoryId];
  if (!category) return;
  
  const item = category.items.find(i => i.name === itemName);
  if (!item) return;
  
  elements.currentCategoryIdInput.value = categoryId;
  elements.currentItemIdInput.value = itemName;
  elements.itemNameInput.value = item.name;
  elements.itemNameBnInput.value = item.nameBn || '';
  elements.itemDescInput.value = item.desc || '';
  elements.variantsContainer.innerHTML = '';
  
  // Add variants
  if (item.variants) {
    Object.entries(item.variants).forEach(([name, price]) => {
      addVariantRow(name, price);
    });
  } else {
    addVariantRow(); // Add one empty variant by default
  }
  
  document.getElementById('menuItemModalTitle').textContent = 'Edit Menu Item';
  showModal(elements.menuItemModal);
}

function addVariantRow(name = '', price = '') {
  if (!elements.variantsContainer) return;
  
  const variantRow = document.createElement('div');
  variantRow.className = 'variant-row';
  
  variantRow.innerHTML = `
    <input type="text" placeholder="Variant name" class="variant-name" value="${name}">
    <input type="number" placeholder="Price" class="variant-price" value="${price}">
    <button class="btn remove-variant-btn"><i class="fas fa-times"></i></button>
  `;
  
  const removeBtn = variantRow.querySelector('.remove-variant-btn');
  removeBtn.addEventListener('click', () => {
    if (elements.variantsContainer.children.length > 1) {
      variantRow.remove();
    }
  });
  
  elements.variantsContainer.appendChild(variantRow);
}

// Data Manipulation Functions
async function addNewCategory() {
  if (!elements.categoryNameInput) return;
  
  const name = elements.categoryNameInput.value.trim();
  const icon = elements.categoryIconInput.value.trim();
  
  if (!name) {
    showError('Category name is required');
    return;
  }
  
  try {
    // Add new category to menu collection
    await db.collection('menu').doc(name).set({
      items: [],
      icon
    });
    
    showError('Category added successfully');
    hideModal(elements.addCategoryModal);
  } catch (error) {
    console.error("Error saving category:", error);
    showError('Failed to save category');
  }
}

async function saveMenuItem() {
  if (!elements.itemNameInput || !elements.currentCategoryIdInput) return;
  
  const name = elements.itemNameInput.value.trim();
  const nameBn = elements.itemNameBnInput.value.trim();
  const desc = elements.itemDescInput.value.trim();
  const categoryId = elements.currentCategoryIdInput.value;
  const itemId = elements.currentItemIdInput.value;
  
  if (!name || !categoryId) {
    showError('Item name and category are required');
    return;
  }
  
  // Collect variants
  const variants = {};
  const variantRows = elements.variantsContainer.querySelectorAll('.variant-row');
  
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
      name,
      variants,
      desc: desc || null,
      nameBn: nameBn || null
    };
    
    // Get current category data
    const categoryRef = db.collection('menu').doc(categoryId);
    const categoryDoc = await categoryRef.get();
    
    if (!categoryDoc.exists) {
      throw new Error('Category not found');
    }
    
    const categoryData = categoryDoc.data();
    let items = categoryData.items || [];
    
    if (itemId) {
      // Update existing item
      items = items.map(item => item.name === itemId ? itemData : item);
    } else {
      // Add new item
      items.push(itemData);
    }
    
    // Update category with new items
    await categoryRef.update({ items });
    
    showError('Menu item saved successfully');
    hideModal(elements.menuItemModal);
  } catch (error) {
    console.error("Error saving menu item:", error);
    showError('Failed to save menu item');
  }
}

async function deleteMenuItem(data) {
  try {
    const categoryRef = db.collection('menu').doc(data.categoryId);
    const categoryDoc = await categoryRef.get();
    
    if (!categoryDoc.exists) {
      throw new Error('Category not found');
    }
    
    const categoryData = categoryDoc.data();
    const items = (categoryData.items || []).filter(item => item.name !== data.itemName);
    
    await categoryRef.update({ items });
    
    showError('Menu item deleted successfully');
  } catch (error) {
    console.error("Error deleting menu item:", error);
    showError('Failed to delete menu item');
  }
}

// Helper Functions
function filterOrders() {
  if (!elements.orderFilter || !elements.orderSearch || !elements.ordersListContainer) return;
  
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