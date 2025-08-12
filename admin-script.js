// Firebase Configuration (should be moved to environment variables in production)
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
let messaging;
const VAPID_KEY = "BGF2rBiAxvlRiqHmvDYEH7_OXxWLl0zIv9IS-2Ky9letx3l4bOyQXRF901lfKw0P7fQIREHaER4QKe4eY34g1AY";

// DOM Elements
const elements = {
  currentTime: document.getElementById('currentTime'),
  logoutBtn: document.getElementById('logoutBtn'),
  navItems: document.querySelectorAll('.sidebar li'),
  contentSections: document.querySelectorAll('.content-section'),
  orderFilter: document.getElementById('orderFilter'),
  orderSearch: document.getElementById('orderSearch'),
  ordersListContainer: document.getElementById('ordersListContainer'),
  notificationForm: document.getElementById('notificationForm'),
  notificationTitle: document.getElementById('notificationTitle'),
  notificationBody: document.getElementById('notificationBody'),
  fcmStatus: document.getElementById('fcmStatus'),
  settingsForm: document.getElementById('settingsForm'),
  shopStatusToggle: document.getElementById('shopStatusToggle'),
  shopStatusText: document.getElementById('shopStatusText'),
  openingTime: document.getElementById('openingTime'),
  closingTime: document.getElementById('closingTime'),
  todayOrders: document.getElementById('todayOrders'),
  todayRevenue: document.getElementById('todayRevenue'),
  activeUsers: document.getElementById('activeUsers'),
  orderDetailModal: document.getElementById('orderDetailModal'),
  orderDetailContent: document.getElementById('orderDetailContent'),
  closeModalButtons: document.querySelectorAll('.close-modal, .cancel-btn'),
  timePeriod: document.getElementById('timePeriod')
};

// Global State
const state = {
  currentUser: null,
  orders: [],
  salesChart: null,
  topItemsChart: null,
  fcmToken: null,
  lastOrderId: null,
  debounceTimer: null
};

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
  // Check authentication state
  auth.onAuthStateChanged(user => {
    if (user && user.email === "suvradeep.pal93@gmail.com") {
      state.currentUser = user;
      setupRealtimeListeners();
      loadDashboardData();
      initializeMessaging();
      updateCurrentTime();
      setInterval(updateCurrentTime, 1000);
    } else {
      window.location.href = '/admin-login.html';
    }
  });

  // Setup event listeners
  setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
  // Navigation
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      showSection(section);
      elements.navItems.forEach(navItem => navItem.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // Order filter
  if (elements.orderFilter && elements.orderSearch) {
    elements.orderFilter.addEventListener('change', filterOrders);
    elements.orderSearch.addEventListener('input', () => {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(filterOrders, 300);
    });
  }

  // Notification form
  if (elements.notificationForm) {
    elements.notificationForm.addEventListener('submit', sendNotification);
  }

  // Settings form
  if (elements.settingsForm) {
    elements.settingsForm.addEventListener('submit', saveSettings);
  }

  // Logout button
  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', handleLogout);
  }

  // Shop status toggle
  if (elements.shopStatusToggle) {
    elements.shopStatusToggle.addEventListener('change', function() {
      elements.shopStatusText.textContent = this.checked ? 'Open' : 'Closed';
    });
  }

  // Modal controls
  if (elements.closeModalButtons) {
    elements.closeModalButtons.forEach(button => {
      button.addEventListener('click', () => {
        hideModal(elements.orderDetailModal);
      });
    });
  }

  // Time period selector for analytics
  if (elements.timePeriod) {
    elements.timePeriod.addEventListener('change', loadAnalyticsData);
  }

  // Click outside modal to close
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      hideModal(elements.orderDetailModal);
    }
  });
}

// UI Functions
function showSection(sectionId) {
  elements.contentSections.forEach(section => {
    section.style.display = 'none';
  });
  document.getElementById(`${sectionId}Section`).style.display = 'block';

  // Load data when section is shown
  if (sectionId === 'analytics') {
    loadAnalyticsData();
  }
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

function showModal(modal) {
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function hideModal(modal) {
  modal.style.display = 'none';
  document.body.style.overflow = 'auto';
}

// Data Functions
function setupRealtimeListeners() {
  // Orders listener
  db.collection('orders')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .onSnapshot(snapshot => {
      state.orders = [];
      elements.ordersListContainer.innerHTML = '';

      if (snapshot.empty) {
        elements.ordersListContainer.innerHTML = '<div class="no-orders">No orders found</div>';
        return;
      }

      // Check for new orders
      if (snapshot.docs.length > 0) {
        const latestOrder = snapshot.docs[0];
        if (state.lastOrderId !== latestOrder.id) {
          if (state.lastOrderId !== null) {
            playNotificationSound();
            showNotification('New order received!');
          }
          state.lastOrderId = latestOrder.id;
        }
      }

      snapshot.forEach(doc => {
        const order = doc.data();
        order.id = doc.id;
        state.orders.push(order);
        renderOrderCard(order);
      });
    }, error => {
      console.error("Orders listener error:", error);
      elements.ordersListContainer.innerHTML = '<div class="error">Failed to load orders</div>';
    });

  // Settings listener
  db.collection('settings').doc('shop')
    .onSnapshot(doc => {
      if (doc.exists) {
        const settings = doc.data();
        elements.shopStatusToggle.checked = settings.isOpen || false;
        elements.shopStatusText.textContent = settings.isOpen ? 'Open' : 'Closed';
        elements.openingTime.value = settings.openingTime || '10:00';
        elements.closingTime.value = settings.closingTime || '22:00';
      }
    });
}

function loadDashboardData() {
  // Today's orders count
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  db.collection('orders')
    .where('timestamp', '>=', today)
    .get()
    .then(snapshot => {
      elements.todayOrders.textContent = snapshot.size;
      
      // Calculate today's revenue
      let revenue = 0;
      snapshot.forEach(doc => {
        revenue += doc.data().total || 0;
      });
      elements.todayRevenue.textContent = `₹${revenue.toFixed(2)}`;
    })
    .catch(error => {
      console.error("Error loading dashboard data:", error);
      showNotification('Failed to load dashboard data', 'error');
    });

  // Active users count
  db.collection('fcmTokens')
    .get()
    .then(snapshot => {
      elements.activeUsers.textContent = snapshot.size;
    })
    .catch(error => {
      console.error("Error loading active users:", error);
    });
}

function loadAnalyticsData() {
  // Destroy existing charts if they exist
  if (state.salesChart) {
    state.salesChart.destroy();
  }
  if (state.topItemsChart) {
    state.topItemsChart.destroy();
  }

  // Get data for the selected time period
  const timePeriod = elements.timePeriod.value;
  let startDate = new Date();
  
  switch(timePeriod) {
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    default: // today
      startDate.setHours(0, 0, 0, 0);
  }

  db.collection('orders')
    .where('timestamp', '>=', startDate)
    .get()
    .then(snapshot => {
      const orders = [];
      let itemCounts = {};
      
      snapshot.forEach(doc => {
        const order = doc.data();
        orders.push(order);
        
        // Count items
        order.items.forEach(item => {
          if (!itemCounts[item.name]) {
            itemCounts[item.name] = 0;
          }
          itemCounts[item.name] += item.quantity;
        });
      });

      // Prepare data for sales trend chart
      const days = [];
      const salesByDay = [];
      const date = new Date(startDate);
      const today = new Date();
      
      while (date <= today) {
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
      createSalesChart(days, salesByDay);
      createTopItemsChart(topItemNames, topItemCounts);
    })
    .catch(error => {
      console.error("Error loading analytics data:", error);
      showNotification('Failed to load analytics data', 'error');
    });
}

function createSalesChart(labels, data) {
  const salesCtx = document.getElementById('salesTrendChart').getContext('2d');
  state.salesChart = new Chart(salesCtx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Daily Sales (₹)',
        data: data,
        borderColor: 'rgba(230, 57, 70, 1)',
        backgroundColor: 'rgba(230, 57, 70, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function createTopItemsChart(labels, data) {
  const itemsCtx = document.getElementById('topItemsChart').getContext('2d');
  state.topItemsChart = new Chart(itemsCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Items Sold',
        data: data,
        backgroundColor: 'rgba(42, 157, 143, 0.8)',
        borderColor: 'rgba(42, 157, 143, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function filterOrders() {
  const statusFilter = elements.orderFilter.value;
  const searchTerm = elements.orderSearch.value.toLowerCase();
  
  const filteredOrders = state.orders.filter(order => {
    const statusMatch = statusFilter === 'all' || order.status === statusFilter;
    const searchMatch = !searchTerm || 
      (order.customerName && order.customerName.toLowerCase().includes(searchTerm)) || 
      order.id.toLowerCase().includes(searchTerm);
    
    return statusMatch && searchMatch;
  });

  elements.ordersListContainer.innerHTML = '';
  
  if (filteredOrders.length === 0) {
    elements.ordersListContainer.innerHTML = '<div class="no-orders">No orders match your criteria</div>';
    return;
  }

  filteredOrders.forEach(order => renderOrderCard(order));
}

// Rendering Functions
function renderOrderCard(order) {
  const orderCard = document.createElement('div');
  orderCard.className = 'order-card';
  orderCard.dataset.orderId = order.id;
  
  // Highlight new orders
  if (order.id === state.lastOrderId) {
    orderCard.classList.add('new-order');
    setTimeout(() => {
      orderCard.classList.remove('new-order');
    }, 5000);
  }
  
  // Status info
  const statusInfo = getStatusInfo(order.status);
  
  // Format date and phone
  const orderDate = order.timestamp?.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
  const phoneNumber = order.phoneNumber || 'N/A';
  
  orderCard.innerHTML = `
    <div class="order-header">
      <span class="order-id">#${order.id.substring(0, 6)}</span>
      <span class="order-status ${statusInfo.class}">${statusInfo.text}</span>
      <span class="order-time">${orderDate.toLocaleTimeString()}</span>
    </div>
    <div class="order-body">
      <div class="customer-info">
        <span><i class="fas fa-user"></i> ${order.customerName || 'Customer'}</span>
        <span><i class="fas fa-phone"></i> ${phoneNumber}</span>
        <span><i class="fas fa-${order.orderType === 'Delivery' ? 'truck' : 'walking'}"></i> ${order.orderType}</span>
      </div>
      <div class="order-items">
        ${order.items.map((item, index) => `
          <div class="order-item">
            <span>${index + 1}. ${item.name} (${item.variant}) x ${item.quantity}</span>
            <span>₹${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
      <div class="order-total">
        <span>Total: ₹${order.total.toFixed(2)}</span>
      </div>
    </div>
    <div class="order-footer">
      <button class="btn details-btn" data-order-id="${order.id}"><i class="fas fa-info-circle"></i> Details</button>
      <select class="status-select" data-order-id="${order.id}">
        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
        <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
        <option value="delivering" ${order.status === 'delivering' ? 'selected' : ''}>Out for Delivery</option>
        <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
      </select>
    </div>
  `;
  
  // Add click event for details
  orderCard.querySelector('.details-btn').addEventListener('click', () => {
    showOrderDetails(order);
  });
  
  // Add event listener for status change
  orderCard.querySelector('.status-select').addEventListener('change', (e) => {
    updateOrderStatus(e.target.dataset.orderId, e.target.value);
  });
  
  elements.ordersListContainer.appendChild(orderCard);
}

function showOrderDetails(order) {
  const orderDate = order.timestamp?.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
  
  elements.orderDetailContent.innerHTML = `
    <div class="order-detail-section">
      <h4>Order Information</h4>
      <div class="detail-grid">
        <div><strong>Order ID:</strong> ${order.id}</div>
        <div><strong>Date:</strong> ${orderDate.toLocaleString()}</div>
        <div><strong>Status:</strong> <span class="status-badge ${order.status}">${order.status}</span></div>
        <div><strong>Type:</strong> ${order.orderType}</div>
      </div>
    </div>
    
    <div class="order-detail-section">
      <h4>Customer Information</h4>
      <div class="detail-grid">
        <div><strong>Name:</strong> ${order.customerName || 'N/A'}</div>
        <div><strong>Phone:</strong> ${order.phoneNumber || 'N/A'}</div>
        ${order.orderType === 'Delivery' ? `
          <div><strong>Address:</strong> ${order.deliveryAddress || 'N/A'}</div>
          <div><strong>Distance:</strong> ${order.deliveryDistance ? order.deliveryDistance + ' km' : 'N/A'}</div>
        ` : ''}
      </div>
    </div>
    
    <div class="order-detail-section">
      <h4>Order Items</h4>
      <table class="order-items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Variant</th>
            <th>Qty</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.variant}</td>
              <td>${item.quantity}</td>
              <td>₹${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="order-detail-section">
      <h4>Order Summary</h4>
      <div class="summary-grid">
        <div><strong>Subtotal:</strong> ₹${order.subtotal.toFixed(2)}</div>
        ${order.deliveryCharge ? `<div><strong>Delivery Fee:</strong> ₹${order.deliveryCharge.toFixed(2)}</div>` : ''}
        <div><strong>Total:</strong> ₹${order.total.toFixed(2)}</div>
      </div>
    </div>
    
    <div class="order-actions">
      <button class="btn cancel-order-btn" data-order-id="${order.id}">
        <i class="fas fa-times"></i> Cancel Order
      </button>
      <button class="btn print-order-btn" data-order-id="${order.id}">
        <i class="fas fa-print"></i> Print Receipt
      </button>
    </div>
  `;
  
  // Add event listener for cancel order button
  const cancelBtn = elements.orderDetailContent.querySelector('.cancel-order-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to cancel this order?')) {
        updateOrderStatus(order.id, 'cancelled');
        hideModal(elements.orderDetailModal);
      }
    });
  }
  
  showModal(elements.orderDetailModal);
}

// Notification Functions
async function initializeMessaging() {
  try {
    if (!firebase.messaging.isSupported()) {
      elements.fcmStatus.textContent = 'Not supported in this browser';
      return;
    }
    
    messaging = firebase.messaging();
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      elements.fcmStatus.textContent = 'Notifications blocked';
      return;
    }
    
    const token = await messaging.getToken({
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready
    });
    
    if (token) {
      state.fcmToken = token;
      elements.fcmStatus.textContent = 'Ready to send notifications';
      await saveAdminToken(token);
    } else {
      elements.fcmStatus.textContent = 'No token available';
    }
  } catch (error) {
    console.error('Messaging error:', error);
    elements.fcmStatus.textContent = 'Error initializing';
  }
}

async function saveAdminToken(token) {
  try {
    await db.collection('adminTokens').doc(state.currentUser.uid).set({
      token,
      email: state.currentUser.email,
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving token:', error);
  }
}

async function sendNotification(e) {
  e.preventDefault();
  
  const title = elements.notificationTitle.value.trim();
  const body = elements.notificationBody.value.trim();
  
  if (!title || !body) {
    alert('Please enter both title and message');
    return;
  }
  
  try {
    // Send to all admin devices
    await db.collection('adminNotifications').add({
      title,
      body,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      sentBy: state.currentUser.email
    });
    
    // Send to all users
    await db.collection('notifications').add({
      title,
      body,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    alert('Notification sent successfully!');
    elements.notificationForm.reset();
  } catch (error) {
    console.error('Error sending notification:', error);
    alert('Failed to send notification');
  }
}

// Order Management Functions
async function updateOrderStatus(orderId, newStatus) {
  try {
    await db.collection('orders').doc(orderId).update({
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Send notification to customer if status changed to something other than pending
    if (newStatus !== 'pending') {
      const order = state.orders.find(o => o.id === orderId);
      if (order) {
        await sendStatusNotification(order.phoneNumber, newStatus);
      }
    }
    
    showNotification('Order status updated successfully');
  } catch (error) {
    console.error('Error updating order status:', error);
    showNotification('Failed to update order status', 'error');
  }
}

async function sendStatusNotification(phoneNumber, status) {
  try {
    const statusMessages = {
      'preparing': 'Your order is now being prepared',
      'delivering': 'Your order is out for delivery',
      'completed': 'Your order has been completed. Thank you!',
      'cancelled': 'Your order has been cancelled. Contact support for details.'
    };
    
    if (statusMessages[status]) {
      await db.collection('notifications').add({
        title: 'Order Update',
        body: statusMessages[status],
        phoneNumber,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error sending status notification:', error);
  }
}

// Settings Functions
async function saveSettings(e) {
  e.preventDefault();
  
  const settings = {
    isOpen: elements.shopStatusToggle.checked,
    openingTime: elements.openingTime.value,
    closingTime: elements.closingTime.value,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  try {
    await db.collection('settings').doc('shop').set(settings, { merge: true });
    showNotification('Settings saved successfully');
  } catch (error) {
    console.error('Error saving settings:', error);
    showNotification('Failed to save settings', 'error');
  }
}

// Helper Functions
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

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function playNotificationSound() {
  const sound = new Audio('https://assets.mixkit.co/active_storage/sfx/989/989-preview.mp3');
  sound.volume = 0.3;
  sound.play().catch(e => console.log('Sound playback prevented:', e));
}

async function handleLogout() {
  try {
    await auth.signOut();
    window.location.href = '/admin-login.html';
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Logout failed', 'error');
  }
}