// Firebase Configuration
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
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const analytics = firebase.analytics();
const functions = firebase.functions();
const VAPID_KEY = "BGF2rBiAxvlRiqHmvDYEH7_OXxWLl0zIv9IS-2Ky9letx3l4bOyQXRF901lfKw0P7fQIREHaER4QKe4eY34g1AY";
let messaging;

// Initialize messaging if supported
(async () => {
  if (firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
    setupMessageHandling();
  }
})();

// DOM Elements
const elements = {
  currentTime: document.getElementById('currentTime'),
  logoutBtn: document.getElementById('logoutBtn'),
  navItems: document.querySelectorAll('.sidebar li'),
  contentSections: document.querySelectorAll('.content-section'),
  orderFilter: document.getElementById('orderFilter'),
  orderSearch: document.getElementById('orderSearch'),
  ordersListContainer: document.getElementById('ordersListContainer'),
  loadMoreOrdersBtn: document.getElementById('loadMoreOrders'),
  notificationForm: document.getElementById('notificationForm'),
  notificationTitle: document.getElementById('notificationTitle'),
  notificationBody: document.getElementById('notificationBody'),
  notificationType: document.getElementById('notificationType'),
  fcmStatus: document.getElementById('fcmStatus'),
  settingsForm: document.getElementById('settingsForm'),
  shopStatusToggle: document.getElementById('shopStatusToggle'),
  shopStatusText: document.getElementById('shopStatusText'),
  openingTime: document.getElementById('openingTime'),
  closingTime: document.getElementById('closingTime'),
  deliveryRadius: document.getElementById('deliveryRadius'),
  minDeliveryOrder: document.getElementById('minDeliveryOrder'),
  chargeUnder4km: document.getElementById('chargeUnder4km'),
  charge4to6km: document.getElementById('charge4to6km'),
  charge6to8km: document.getElementById('charge6to8km'),
  freeDeliveryThreshold: document.getElementById('freeDeliveryThreshold'),
  todayOrders: document.getElementById('todayOrders'),
  todayRevenue: document.getElementById('todayRevenue'),
  activeUsers: document.getElementById('activeUsers'),
  notificationReach: document.getElementById('notificationReach'),
  orderDetailModal: document.getElementById('orderDetailModal'),
  orderDetailContent: document.getElementById('orderDetailContent'),
  closeModalButtons: document.querySelectorAll('.close-modal, .cancel-btn'),
  notificationsList: document.getElementById('notificationsList'),
  defaultStatusUpdates: document.getElementById('defaultStatusUpdates'),
  defaultSpecialOffers: document.getElementById('defaultSpecialOffers'),
  savePreferencesBtn: document.getElementById('savePreferencesBtn'),
  sendNotificationBtn: document.getElementById('sendNotificationBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  lastNotificationTime: document.getElementById('lastNotificationTime'),
  testNotificationBtn: document.getElementById('testNotificationBtn')
};

// Global State
const state = {
  currentUser: null,
  orders: [],
  notifications: [],
  salesChart: null,
  fcmToken: null,
  lastOrderId: null,
  debounceTimer: null,
  lastVisibleOrder: null,
  hasMoreOrders: true,
  defaultPreferences: {
    statusUpdates: true,
    specialOffers: true
  },
  lastNotificationSent: null
};

// Order status mapping
const ORDER_STATUS = {
  pending: { text: 'Pending', color: '#ff9800' },
  preparing: { text: 'Preparing', color: '#2196f3' },
  delivering: { text: 'Out for Delivery', color: '#4caf50' },
  completed: { text: 'Completed', color: '#8bc34a' },
  cancelled: { text: 'Cancelled', color: '#f44336' }
};

// ====================== UTILITY FUNCTIONS ======================
function setLoading(element, isLoading) {
  if (isLoading) {
    element.disabled = true;
    const spinner = element.querySelector('.fa-spinner') || document.createElement('i');
    spinner.className = 'fas fa-spinner fa-spin';
    if (!element.querySelector('.fa-spinner')) {
      element.insertBefore(spinner, element.firstChild);
    }
  } else {
    element.disabled = false;
    const spinner = element.querySelector('.fa-spinner');
    if (spinner) spinner.remove();
  }
}

function showLoadingOverlay(show) {
  elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

async function safeFirebaseOperation(operation) {
  try {
    return await operation();
  } catch (error) {
    console.error('Firebase operation failed:', error);
    showNotification(`Operation failed: ${error.message}`, 'error');
    logAdminAction('firebase_error', { error: error.message });
    return null;
  }
}

function debounce(func, wait, immediate) {
  let timeout;
  return function() {
    const context = this, args = arguments;
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

// ====================== UI FUNCTIONS ======================
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

function showModal(modal) {
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function hideModal(modal) {
  modal.style.display = 'none';
  document.body.style.overflow = 'auto';
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

// ====================== ORDER FUNCTIONS ======================
function renderOrderCard(order) {
  const orderCard = document.createElement('div');
  orderCard.className = 'order-card';
  orderCard.innerHTML = `
    <div class="order-header">
      <h3>Order #${order.id || ''}</h3>
      <span class="order-status" style="background-color: ${ORDER_STATUS[order.status]?.color || '#999'}">
        ${ORDER_STATUS[order.status]?.text || order.status}
      </span>
    </div>
    <div class="order-details">
      <p><strong>Customer:</strong> ${order.customerName}</p>
      <p><strong>Phone:</strong> ${order.phoneNumber}</p>
      <p><strong>Total:</strong> ₹${order.total?.toFixed(2) || '0.00'}</p>
      <p><strong>Time:</strong> ${order.timestamp?.toDate().toLocaleString() || 'Just now'}</p>
    </div>
    <div class="order-actions">
      ${order.status === 'pending' ? `
        <button class="btn primary-btn action-btn" data-action="preparing" data-order="${order.id}">
          <i class="fas fa-utensils"></i> Preparing
        </button>
      ` : ''}
      ${order.status === 'preparing' ? `
        <button class="btn success-btn action-btn" data-action="delivering" data-order="${order.id}">
          <i class="fas fa-truck"></i> Out for Delivery
        </button>
      ` : ''}
      ${order.status === 'delivering' ? `
        <button class="btn success-btn action-btn" data-action="completed" data-order="${order.id}">
          <i class="fas fa-check"></i> Delivered
        </button>
      ` : ''}
      ${order.status !== 'completed' && order.status !== 'cancelled' ? `
        <button class="btn danger-btn action-btn" data-action="cancelled" data-order="${order.id}">
          <i class="fas fa-times"></i> Cancel
        </button>
      ` : ''}
      <button class="btn info-btn action-btn" data-action="details" data-order="${order.id}">
        <i class="fas fa-eye"></i> Details
      </button>
    </div>
  `;
  
  // Add resend notification button
  if (order.status !== 'completed' && order.status !== 'cancelled') {
    const resendBtn = document.createElement('button');
    resendBtn.className = 'btn info-btn';
    resendBtn.innerHTML = '<i class="fas fa-bell"></i> Resend Notification';
    resendBtn.addEventListener('click', () => resendOrderNotification(order.id));
    orderCard.querySelector('.order-actions').appendChild(resendBtn);
  }
  
  elements.ordersListContainer.appendChild(orderCard);
  
  // Add event listeners to action buttons
  orderCard.querySelectorAll('.action-btn').forEach(button => {
    button.addEventListener('click', async (e) => {
      const action = e.currentTarget.dataset.action;
      const orderId = e.currentTarget.dataset.order;
      
      if (action === 'details') {
        showOrderDetails(orderId);
      } else {
        await updateOrderStatus(orderId, action);
      }
    });
  });
}

async function resendOrderNotification(orderId) {
  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await safeFirebaseOperation(() => orderRef.get());
  
  if (!orderSnap || !orderSnap.exists) {
    showNotification('Order not found', 'error');
    return;
  }
  
  const order = orderSnap.data();
  const statusMessages = {
    pending: 'Order received and being processed',
    preparing: 'Your order is being prepared',
    delivering: 'Your order is out for delivery',
    completed: 'Your order has been delivered'
  };

  try {
    const token = await getAdminToken();
    if (!token) return;

    await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        phoneNumber: order.phoneNumber,
        title: 'Order Update',
        body: `Order #${orderId}: ${statusMessages[order.status]}`,
        data: {
          type: 'status_update',
          orderId: orderId,
          click_action: `https://${window.location.hostname}/order-status.html?orderId=${orderId}`
        }
      })
    });

    showNotification('Notification resent successfully');
    logAdminAction('notification_resent', { orderId, status: order.status });
  } catch (error) {
    showNotification('Failed to resend notification', 'error');
    console.error('Resend failed:', error);
    logAdminAction('notification_resend_error', { orderId, error: error.message });
  }
}

function filterOrders() {
  const statusFilter = elements.orderFilter.value;
  const searchTerm = elements.orderSearch.value.toLowerCase();
  
  let filteredOrders = state.orders;
  
  if (statusFilter !== 'all') {
    filteredOrders = filteredOrders.filter(order => order.status === statusFilter);
  }
  
  if (searchTerm) {
    filteredOrders = filteredOrders.filter(order => 
      order.customerName.toLowerCase().includes(searchTerm) || 
      order.phoneNumber.includes(searchTerm) ||
      (order.id && order.id.toLowerCase().includes(searchTerm))
    );
  }
  
  renderOrders(filteredOrders);
}

function renderOrders(orders) {
  elements.ordersListContainer.innerHTML = '';
  
  if (orders.length === 0) {
    elements.ordersListContainer.innerHTML = '<div class="no-orders">No orders found</div>';
    return;
  }
  
  orders.forEach(order => renderOrderCard(order));
}

function showOrderDetails(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;
  
  let itemsHtml = '';
  if (order.items && order.items.length > 0) {
    itemsHtml = order.items.map(item => `
      <li>
        ${item.quantity}x ${item.name}${item.variant ? ` (${item.variant})` : ''}
        <span>₹${(item.price * item.quantity).toFixed(2)}</span>
      </li>
    `).join('');
  }
  
  elements.orderDetailContent.innerHTML = `
    <div class="order-detail-section">
      <h4>Order Information</h4>
      <p><strong>Order ID:</strong> ${order.id}</p>
      <p><strong>Status:</strong> <span style="color: ${ORDER_STATUS[order.status]?.color || '#999'}">
        ${ORDER_STATUS[order.status]?.text || order.status}
      </span></p>
      <p><strong>Order Type:</strong> ${order.orderType || 'Delivery'}</p>
      <p><strong>Order Time:</strong> ${order.timestamp?.toDate().toLocaleString() || 'Unknown'}</p>
    </div>
    
    <div class="order-detail-section">
      <h4>Customer Details</h4>
      <p><strong>Name:</strong> ${order.customerName}</p>
      <p><strong>Phone:</strong> ${order.phoneNumber}</p>
      ${order.orderType === 'Delivery' ? `
        <p><strong>Delivery Address:</strong> ${order.deliveryAddress || 'Not specified'}</p>
        <p><strong>Distance:</strong> ${order.distance ? order.distance.toFixed(1) + ' km' : 'Not calculated'}</p>
      ` : ''}
    </div>
    
    <div class="order-detail-section">
      <h4>Order Items</h4>
      <ul class="order-items">
        ${itemsHtml || '<li>No items found</li>'}
      </ul>
    </div>
    
    <div class="order-detail-section">
      <h4>Payment Summary</h4>
      <p><strong>Subtotal:</strong> ₹${order.subtotal?.toFixed(2) || '0.00'}</p>
      ${order.orderType === 'Delivery' ? `
        <p><strong>Delivery Charge:</strong> ₹${order.deliveryCharge?.toFixed(2) || '0.00'}</p>
      ` : ''}
      <p><strong>Total:</strong> ₹${order.total?.toFixed(2) || '0.00'}</p>
    </div>
    
    ${order.notes ? `
      <div class="order-detail-section">
        <h4>Special Instructions</h4>
        <p>${order.notes}</p>
      </div>
    ` : ''}
  `;
  
  showModal(elements.orderDetailModal);
}

async function loadMoreOrders() {
  if (!state.hasMoreOrders) return;
  
  setLoading(elements.loadMoreOrdersBtn, true);
  
  let ordersQuery = db.collection('orders')
    .orderBy('timestamp', 'desc')
    .limit(10);
    
  if (state.lastVisibleOrder) {
    ordersQuery = ordersQuery.startAfter(state.lastVisibleOrder);
  }

  const snapshot = await safeFirebaseOperation(() => ordersQuery.get());
  if (!snapshot || snapshot.empty) {
    state.hasMoreOrders = false;
    elements.loadMoreOrdersBtn.style.display = 'none';
    setLoading(elements.loadMoreOrdersBtn, false);
    return;
  }
  
  state.lastVisibleOrder = snapshot.docs[snapshot.docs.length-1];
  
  snapshot.forEach(doc => {
    const order = doc.data();
    order.id = doc.id;
    state.orders.push(order);
    renderOrderCard(order);
  });
  
  setLoading(elements.loadMoreOrdersBtn, false);
  elements.loadMoreOrdersBtn.style.display = 'block';
}

// ====================== DATA FUNCTIONS ======================
function setupRealtimeListeners() {
  // Orders listener
  const ordersQuery = db.collection('orders')
    .orderBy('timestamp', 'desc')
    .limit(10);
  
  ordersQuery.onSnapshot((snapshot) => {
    state.orders = [];
    state.lastVisibleOrder = null;
    state.hasMoreOrders = true;
    elements.ordersListContainer.innerHTML = '';

    if (snapshot.empty) {
      elements.ordersListContainer.innerHTML = '<div class="no-orders">No orders found</div>';
      elements.loadMoreOrdersBtn.style.display = 'none';
      return;
    }

    // Check for new orders
    if (snapshot.docs.length > 0) {
      const latestOrder = snapshot.docs[0];
      if (state.lastOrderId !== latestOrder.id) {
        if (state.lastOrderId !== null) {
          playNotificationSound();
          showNotification('New order received!');
          logAdminAction('new_order_received', { orderId: latestOrder.id });
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
    
    state.lastVisibleOrder = snapshot.docs[snapshot.docs.length-1];
    elements.loadMoreOrdersBtn.style.display = snapshot.size >= 10 ? 'block' : 'none';
  }, error => {
    console.error("Orders listener error:", error);
    elements.ordersListContainer.innerHTML = '<div class="error">Failed to load orders</div>';
    logAdminAction('orders_listener_error', { error: error.message });
  });

  // Settings listener
  db.collection('settings').doc('shop').onSnapshot((docSnapshot) => {
    if (docSnapshot.exists) {
      const settings = docSnapshot.data();
      elements.shopStatusToggle.checked = settings.isOpen || false;
      elements.shopStatusText.textContent = settings.isOpen ? 'Open' : 'Closed';
      elements.openingTime.value = settings.openingTime || '10:00';
      elements.closingTime.value = settings.closingTime || '22:00';
      elements.deliveryRadius.value = settings.deliveryRadius || 8;
      elements.minDeliveryOrder.value = settings.minDeliveryOrder || 200;
      elements.chargeUnder4km.value = settings.deliveryCharges?.under4km || 0;
      elements.charge4to6km.value = settings.deliveryCharges?.between4and6km || 20;
      elements.charge6to8km.value = settings.deliveryCharges?.between6and8km || 30;
      elements.freeDeliveryThreshold.value = settings.deliveryCharges?.freeThreshold || 500;
    }
  });

  // Active users count
  db.collection('fcmTokens').onSnapshot((snapshot) => {
    elements.activeUsers.textContent = snapshot.size;
    calculateNotificationReach();
  });

  // Last notification sent time
  db.collection('notifications')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .onSnapshot(snapshot => {
      if (!snapshot.empty) {
        const lastNotification = snapshot.docs[0].data();
        state.lastNotificationSent = lastNotification.timestamp;
        updateLastNotificationTime();
      }
    });
}

function updateLastNotificationTime() {
  if (state.lastNotificationSent) {
    const lastSent = state.lastNotificationSent.toDate();
    const now = new Date();
    const diffMinutes = Math.floor((now - lastSent) / (1000 * 60));
    
    let timeText;
    if (diffMinutes < 1) {
      timeText = 'Just now';
    } else if (diffMinutes < 60) {
      timeText = `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      timeText = `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else {
      timeText = lastSent.toLocaleString();
    }
    
    if (elements.lastNotificationTime) {
      elements.lastNotificationTime.textContent = timeText;
    }
  } else {
    if (elements.lastNotificationTime) {
      elements.lastNotificationTime.textContent = 'No notifications sent yet';
    }
  }
}

async function loadDashboardData() {
  // Today's orders count
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const ordersQuery = db.collection('orders')
    .where('timestamp', '>=', today);
  
  const snapshot = await safeFirebaseOperation(() => ordersQuery.get());
  if (!snapshot) return;
  
  elements.todayOrders.textContent = snapshot.size;
  
  // Calculate today's revenue
  let revenue = 0;
  snapshot.forEach(doc => {
    revenue += doc.data().total || 0;
  });
  elements.todayRevenue.textContent = `₹${revenue.toFixed(2)}`;
  logAdminAction('dashboard_data_loaded', { orderCount: snapshot.size, revenue });

  calculateNotificationReach();
  updateLastNotificationTime();
}

async function calculateNotificationReach() {
  const tokensSnapshot = await safeFirebaseOperation(() => 
    db.collection('fcmTokens').get()
  );
  if (!tokensSnapshot) return;
  
  const totalUsers = tokensSnapshot.size;
  if (totalUsers === 0) {
    elements.notificationReach.textContent = '0%';
    return;
  }
  
  const activeQuery = db.collection('fcmTokens')
    .where('preferences.specialOffers', '==', true);
  
  const activeSnapshot = await safeFirebaseOperation(() => activeQuery.get());
  if (!activeSnapshot) return;
  
  const reach = (activeSnapshot.size / totalUsers * 100).toFixed(0);
  elements.notificationReach.textContent = `${reach}%`;
}

async function loadDefaultPreferences() {
  const docRef = db.collection('settings').doc('notificationPreferences');
  const docSnap = await safeFirebaseOperation(() => docRef.get());
  
  if (docSnap && docSnap.exists) {
    state.defaultPreferences = docSnap.data();
    elements.defaultStatusUpdates.checked = state.defaultPreferences.statusUpdates !== false;
    elements.defaultSpecialOffers.checked = state.defaultPreferences.specialOffers !== false;
  }
}

async function loadNotifications() {
  elements.notificationsList.innerHTML = '<div class="loading">Loading notifications...</div>';
  
  const notificationsQuery = db.collection('notifications')
    .orderBy('timestamp', 'desc')
    .limit(20);
  
  const snapshot = await safeFirebaseOperation(() => notificationsQuery.get());
  if (!snapshot) return;
  
  state.notifications = [];
  elements.notificationsList.innerHTML = '';
  
  if (snapshot.empty) {
    elements.notificationsList.innerHTML = '<div class="no-notifications">No notifications found</div>';
    return;
  }
  
  snapshot.forEach(doc => {
    const notification = doc.data();
    notification.id = doc.id;
    state.notifications.push(notification);
    renderNotification(notification);
  });
}

function renderNotification(notification) {
  const notificationElement = document.createElement('div');
  notificationElement.className = 'notification-item';
  notificationElement.innerHTML = `
    <h4>${notification.title}</h4>
    <p>${notification.body}</p>
    <div class="notification-meta">
      <span><i class="fas fa-clock"></i> ${notification.timestamp?.toDate().toLocaleString() || 'Just now'}</span>
      <span><i class="fas fa-tag"></i> ${notification.type || 'general'}</span>
    </div>
  `;
  elements.notificationsList.appendChild(notificationElement);
}

// ====================== NOTIFICATION FUNCTIONS ======================
function setupMessageHandling() {
  firebase.messaging().onMessage((payload) => {
    showNotification(payload.notification?.body || 'New message');
    playNotificationSound();
  });
}

async function initializeMessaging() {
  try {
    if (!messaging) {
      elements.fcmStatus.textContent = 'Not supported in this browser';
      return;
    }
    
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
    logAdminAction('messaging_init_error', { error: error.message });
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
    logAdminAction('token_save_error', { error: error.message });
  }
}

async function getAdminToken() {
  try {
    if (!auth.currentUser) {
      throw new Error('No authenticated user');
    }
    
    const token = await auth.currentUser.getIdToken();
    if (!token) {
      throw new Error('Failed to get ID token');
    }
    return token;
    
  } catch (error) {
    console.error('Error getting admin token:', error);
    logAdminAction('admin_token_fetch_error', { error: error.message });
    showNotification('Failed to authenticate. Please refresh the page.', 'error');
    return null;
  }
}

async function sendNotification(e) {
  e.preventDefault();
  
  const title = elements.notificationTitle.value.trim();
  const body = elements.notificationBody.value.trim();
  const type = elements.notificationType.value;
  
  if (!title || !body) {
    showNotification('Please enter both title and message', 'error');
    return;
  }
  
  showLoadingOverlay(true);
  setLoading(elements.sendNotificationBtn, true);
  
  try {
    const token = await getAdminToken();
    if (!token) {
      showNotification('Authentication failed. Please try again.', 'error');
      return;
    }

    await safeFirebaseOperation(() => 
      db.collection('adminNotifications').add({
        title,
        body,
        type,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        sentBy: state.currentUser.email
      })
    );
    
    const tokensSnapshot = await safeFirebaseOperation(() => 
      db.collection('fcmTokens').get()
    );
    
    if (!tokensSnapshot) return;
    
    const batch = db.batch();
    let notificationCount = 0;
    
    tokensSnapshot.forEach(doc => {
      const userPrefs = doc.data().preferences || state.defaultPreferences;
      const shouldSend = type === 'status_update' ? userPrefs.statusUpdates !== false : 
                       type === 'promotion' ? userPrefs.specialOffers !== false : true;
      
      if (shouldSend) {
        notificationCount++;
        const notificationRef = db.collection('notifications').doc();
        batch.set(notificationRef, {
          title,
          body,
          type,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          phoneNumber: doc.data().phoneNumber,
          sentBy: state.currentUser.email
        });
        
        fetch('/api/send-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            phoneNumber: doc.data().phoneNumber,
            title,
            body,
            data: {
              type,
              click_action: `https://${window.location.hostname}`
            }
          })
        }).catch(error => {
          console.error('Error sending notification:', error);
          logAdminAction('fcm_send_error', { 
            phoneNumber: doc.data().phoneNumber, 
            error: error.message 
          });
        });
      }
    });
    
    await safeFirebaseOperation(() => batch.commit());
    
    showNotification(`Notification sent to ${notificationCount} users!`);
    elements.notificationForm.reset();
    loadNotifications();
    logAdminAction('notification_sent', { 
      type, 
      recipientCount: notificationCount 
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    showNotification('Failed to send notification', 'error');
    logAdminAction('notification_send_error', { error: error.message });
  } finally {
    showLoadingOverlay(false);
    setLoading(elements.sendNotificationBtn, false);
  }
}

async function sendTestNotification() {
  const phoneNumber = prompt("Enter customer phone number for test:");
  if (!phoneNumber) return;

  try {
    const token = await getAdminToken();
    if (!token) return;

    await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        phoneNumber: phoneNumber,
        title: 'Test Notification',
        body: 'This is a test notification from Bake & Grill',
        data: {
          type: 'test',
          click_action: `https://${window.location.hostname}`
        }
      })
    });

    showNotification('Test notification sent');
    logAdminAction('test_notification_sent', { phoneNumber });
  } catch (error) {
    showNotification('Failed to send test notification', 'error');
    console.error('Test failed:', error);
    logAdminAction('test_notification_error', { error: error.message });
  }
}

// ====================== ORDER MANAGEMENT FUNCTIONS ======================
async function updateOrderStatus(orderId, newStatus) {
  const actionButton = document.querySelector(`[data-order="${orderId}"][data-action="${newStatus}"]`);
  setLoading(actionButton, true);
  
  try {
    const orderRef = db.collection('orders').doc(orderId);
    await orderRef.update({
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) return;

    const order = orderDoc.data();
    if (!order.phoneNumber) return;

    let notificationTitle, notificationBody;
    
    switch(newStatus) {
      case 'preparing':
        notificationTitle = 'Order Update';
        notificationBody = `Your order #${orderId} is now being prepared`;
        break;
      case 'delivering':
        notificationTitle = 'Order Update';
        notificationBody = `Your order #${orderId} is out for delivery`;
        break;
      case 'completed':
        notificationTitle = 'Order Delivered';
        notificationBody = `Your order #${orderId} has been delivered. Enjoy your meal!`;
        break;
      case 'cancelled':
        notificationTitle = 'Order Cancelled';
        notificationBody = `Your order #${orderId} has been cancelled`;
        break;
    }

    if (notificationTitle && notificationBody) {
      const token = await getAdminToken();
      if (!token) return;

      await db.collection('notifications').add({
        title: notificationTitle,
        body: notificationBody,
        phoneNumber: order.phoneNumber,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        orderId: orderId,
        type: 'status_update',
        read: false
      });

      const tokensQuery = db.collection('fcmTokens')
        .where('phoneNumber', '==', order.phoneNumber)
        .where('preferences.statusUpdates', '==', true);
      const tokensSnapshot = await tokensQuery.get();
      
      if (!tokensSnapshot.empty) {
        const tokens = tokensSnapshot.docs.map(doc => doc.data().token);
        
        await fetch('/api/send-notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: notificationTitle,
            body: notificationBody,
            type: 'status_update',
            tokens,
            data: {
              orderId,
              status: newStatus,
              click_action: `https://${window.location.hostname}/order-status.html?orderId=${orderId}`
            }
          })
        });
      }
    }

    showNotification('Order status updated successfully');
    logAdminAction('order_status_updated', { orderId, newStatus });
  } catch (error) {
    console.error('Error updating order status:', error);
    showNotification('Failed to update order status', 'error');
    logAdminAction('order_status_update_error', { orderId, error: error.message });
  } finally {
    const button = document.querySelector(`[data-order="${orderId}"][data-action="${newStatus}"]`);
    if (button) setLoading(button, false);
  }
}

// ====================== SETTINGS FUNCTIONS ======================
async function saveSettings(e) {
  e.preventDefault();
  
  const settings = {
    isOpen: elements.shopStatusToggle.checked,
    openingTime: elements.openingTime.value,
    closingTime: elements.closingTime.value,
    deliveryRadius: parseInt(elements.deliveryRadius.value),
    minDeliveryOrder: parseInt(elements.minDeliveryOrder.value),
    deliveryCharges: {
      under4km: parseInt(elements.chargeUnder4km.value),
      between4and6km: parseInt(elements.charge4to6km.value),
      between6and8km: parseInt(elements.charge6to8km.value),
      freeThreshold: parseInt(elements.freeDeliveryThreshold.value)
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  showLoadingOverlay(true);
  setLoading(elements.saveSettingsBtn, true);
  
  try {
    await db.collection('settings').doc('shop').set(settings, { merge: true });
    
    const statusMessage = settings.isOpen 
      ? `We're now open! (${settings.openingTime}-${settings.closingTime})` 
      : `We're currently closed. Opens at ${settings.openingTime}`;
    
    await db.collection('notifications').add({
      title: 'Shop Status Update',
      body: statusMessage,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      type: 'shop_status'
    });
    
    showNotification('Settings saved successfully');
    logAdminAction('settings_updated', { settings });
  } catch (error) {
    console.error('Error saving settings:', error);
    showNotification('Failed to save settings', 'error');
    logAdminAction('settings_update_error', { error: error.message });
  } finally {
    showLoadingOverlay(false);
    setLoading(elements.saveSettingsBtn, false);
  }
}

async function saveDefaultPreferences() {
  const preferences = {
    statusUpdates: elements.defaultStatusUpdates.checked,
    specialOffers: elements.defaultSpecialOffers.checked,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  setLoading(elements.savePreferencesBtn, true);
  
  try {
    await db.collection('settings').doc('notificationPreferences').set(preferences);
    
    showNotification('Default preferences saved');
    state.defaultPreferences = preferences;
    logAdminAction('preferences_updated', { preferences });
  } catch (error) {
    console.error("Error saving preferences:", error);
    showNotification('Failed to save preferences', 'error');
    logAdminAction('preferences_update_error', { error: error.message });
  } finally {
    setLoading(elements.savePreferencesBtn, false);
  }
}

// ====================== AUDIT LOGGING ======================
async function logAdminAction(action, details = {}) {
  try {
    await db.collection('adminAuditLogs').add({
      action,
      details,
      admin: state.currentUser?.email || 'unknown',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      ipAddress: await fetch('https://api.ipify.org?format=json')
        .then(r => r.json())
        .then(data => data.ip)
        .catch(() => 'unknown')
    });
    
    firebase.analytics().logEvent(`admin_${action}`, details);
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
}

// ====================== EVENT LISTENERS ======================
function setupEventListeners() {
  // Navigation
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      showSection(section);
      elements.navItems.forEach(navItem => navItem.classList.remove('active'));
      item.classList.add('active');
      
      if (section === 'notifications') {
        loadNotifications();
      }
    });
  });

  // Order filter
  elements.orderFilter.addEventListener('change', filterOrders);
  elements.orderSearch.addEventListener('input', debounce(filterOrders, 300));

  // Load more orders
  elements.loadMoreOrdersBtn.addEventListener('click', loadMoreOrders);

  // Notification form
  elements.notificationForm.addEventListener('submit', sendNotification);

  // Settings form
  elements.settingsForm.addEventListener('submit', saveSettings);

  // Save preferences
  elements.savePreferencesBtn.addEventListener('click', saveDefaultPreferences);

  // Logout button
  elements.logoutBtn.addEventListener('click', handleLogout);

  // Shop status toggle
  elements.shopStatusToggle.addEventListener('change', function() {
    elements.shopStatusText.textContent = this.checked ? 'Open' : 'Closed';
  });

  // Modal controls
  elements.closeModalButtons.forEach(button => {
    button.addEventListener('click', () => {
      hideModal(elements.orderDetailModal);
    });
  });

  // Click outside modal to close
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      hideModal(elements.orderDetailModal);
    }
  });

  // Test notification button
  if (elements.testNotificationBtn) {
    elements.testNotificationBtn.addEventListener('click', sendTestNotification);
  }
}

// ====================== AUTH FUNCTIONS ======================
async function handleLogout() {
  showLoadingOverlay(true);
  
  try {
    if (state.fcmToken) {
      try {
        await messaging.deleteToken(state.fcmToken);
        await db.collection('adminTokens').doc(state.currentUser.uid).delete();
      } catch (error) {
        console.error('Error removing token:', error);
        logAdminAction('token_removal_error', { error: error.message });
      }
    }
    
    await auth.signOut();
    logAdminAction('logout');
    window.location.href = '/admin-login.html';
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Logout failed', 'error');
    logAdminAction('logout_error', { error: error.message });
  } finally {
    showLoadingOverlay(false);
  }
}

// ====================== INITIALIZATION ======================
function checkCompatibility() {
  if (!('serviceWorker' in navigator)) {
    showNotification('Some features may not work in your browser. Please update.', 'warning');
  }
  if (!window.Notification) {
    elements.fcmStatus.textContent = 'Notifications not supported';
  }
}

function renderNotificationStatus() {
  const statusSection = document.createElement('div');
  statusSection.className = 'notification-status-card';
  statusSection.innerHTML = `
    <h3><i class="fas fa-bell"></i> Notification System</h3>
    <p>FCM Status: <span id="fcmStatus">Active</span></p>
    <p>Last Notification: <span id="lastNotificationTime">Loading...</span></p>
    <button id="testNotificationBtn" class="btn">
      <i class="fas fa-paper-plane"></i> Send Test Notification
    </button>
  `;
  document.getElementById('dashboardSection').appendChild(statusSection);

  document.getElementById('testNotificationBtn').addEventListener('click', sendTestNotification);
}

document.addEventListener('DOMContentLoaded', async function() {
  checkCompatibility();
  
  auth.onAuthStateChanged(user => {
    if (user && user.email === "suvradeep.pal93@gmail.com") {
      state.currentUser = user;
      setupRealtimeListeners();
      loadDashboardData();
      loadDefaultPreferences();
      initializeMessaging();
      updateCurrentTime();
      setInterval(updateCurrentTime, 1000);
      renderNotificationStatus();
      logAdminAction('login');
    } else {
      window.location.href = '/admin-login.html';
    }
  });

  setupEventListeners();
});