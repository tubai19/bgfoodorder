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
  savePreferencesBtn: document.getElementById('savePreferencesBtn')
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
  defaultPreferences: {
    statusUpdates: true,
    specialOffers: true
  }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
  auth.onAuthStateChanged(user => {
    if (user && user.email === "suvradeep.pal93@gmail.com") {
      state.currentUser = user;
      setupRealtimeListeners();
      loadDashboardData();
      loadDefaultPreferences();
      initializeMessaging();
      updateCurrentTime();
      setInterval(updateCurrentTime, 1000);
    } else {
      window.location.href = '/admin-login.html';
    }
  });

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
      
      // Load section-specific data
      if (section === 'notifications') {
        loadNotifications();
      } else if (section === 'analytics') {
        loadAnalyticsData();
      }
    });
  });

  // Order filter
  elements.orderFilter.addEventListener('change', filterOrders);
  elements.orderSearch.addEventListener('input', () => {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(filterOrders, 300);
  });

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
}

// UI Functions
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
        elements.deliveryRadius.value = settings.deliveryRadius || 8;
        elements.minDeliveryOrder.value = settings.minDeliveryOrder || 200;
        elements.chargeUnder4km.value = settings.deliveryCharges?.under4km || 0;
        elements.charge4to6km.value = settings.deliveryCharges?.between4and6km || 20;
        elements.charge6to8km.value = settings.deliveryCharges?.between6and8km || 30;
        elements.freeDeliveryThreshold.value = settings.deliveryCharges?.freeThreshold || 500;
      }
    });

  // Active users count
  db.collection('fcmTokens')
    .onSnapshot(snapshot => {
      elements.activeUsers.textContent = snapshot.size;
      calculateNotificationReach();
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

  calculateNotificationReach();
}

function calculateNotificationReach() {
  db.collection('fcmTokens').get().then(snapshot => {
    const totalUsers = snapshot.size;
    if (totalUsers === 0) {
      elements.notificationReach.textContent = '0%';
      return;
    }
    
    db.collection('fcmTokens')
      .where('preferences.specialOffers', '==', true)
      .get()
      .then(activeSnapshot => {
        const reach = (activeSnapshot.size / totalUsers * 100).toFixed(0);
        elements.notificationReach.textContent = `${reach}%`;
      });
  });
}

function loadDefaultPreferences() {
  db.collection('settings').doc('notificationPreferences').get()
    .then(doc => {
      if (doc.exists) {
        state.defaultPreferences = doc.data();
        elements.defaultStatusUpdates.checked = state.defaultPreferences.statusUpdates !== false;
        elements.defaultSpecialOffers.checked = state.defaultPreferences.specialOffers !== false;
      }
    });
}

function saveDefaultPreferences() {
  const preferences = {
    statusUpdates: elements.defaultStatusUpdates.checked,
    specialOffers: elements.defaultSpecialOffers.checked,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  db.collection('settings').doc('notificationPreferences').set(preferences)
    .then(() => {
      showNotification('Default preferences saved');
      state.defaultPreferences = preferences;
    })
    .catch(error => {
      console.error("Error saving preferences:", error);
      showNotification('Failed to save preferences', 'error');
    });
}

function loadNotifications() {
  elements.notificationsList.innerHTML = '<div class="loading">Loading notifications...</div>';
  
  db.collection('notifications')
    .orderBy('timestamp', 'desc')
    .limit(20)
    .get()
    .then(snapshot => {
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
    })
    .catch(error => {
      console.error("Error loading notifications:", error);
      elements.notificationsList.innerHTML = '<div class="error">Failed to load notifications</div>';
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
      
      messaging.onMessage((payload) => {
        showNotification(payload.notification?.body || 'New message');
        playNotificationSound();
      });
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
  const type = elements.notificationType.value;
  
  if (!title || !body) {
    showNotification('Please enter both title and message', 'error');
    return;
  }
  
  try {
    // Save to admin notifications
    await db.collection('adminNotifications').add({
      title,
      body,
      type,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      sentBy: state.currentUser.email
    });
    
    // Send to users based on preferences
    const tokensSnapshot = await db.collection('fcmTokens').get();
    const batch = db.batch();
    
    tokensSnapshot.forEach(doc => {
      const userPrefs = doc.data().preferences || state.defaultPreferences;
      const shouldSend = type === 'status_update' ? userPrefs.statusUpdates !== false : 
                       type === 'promotion' ? userPrefs.specialOffers !== false : true;
      
      if (shouldSend) {
        const notificationRef = db.collection('notifications').doc();
        batch.set(notificationRef, {
          title,
          body,
          type,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          phoneNumber: doc.data().phoneNumber,
          sentBy: state.currentUser.email
        });
      }
    });
    
    await batch.commit();
    
    showNotification('Notification sent successfully!');
    elements.notificationForm.reset();
    loadNotifications();
  } catch (error) {
    console.error('Error sending notification:', error);
    showNotification('Failed to send notification', 'error');
  }
}

// Order Management Functions
async function updateOrderStatus(orderId, newStatus) {
  try {
    const orderRef = db.collection('orders').doc(orderId);
    await orderRef.update({
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    const orderDoc = await orderRef.get();
    const order = orderDoc.data();
    
    if (newStatus !== 'pending' && order.phoneNumber) {
      const statusMessages = {
        'preparing': 'Your order is now being prepared',
        'delivering': 'Your order is out for delivery',
        'completed': 'Your order has been completed. Thank you!',
        'cancelled': 'Your order has been cancelled. Contact support for details.'
      };
      
      if (statusMessages[newStatus]) {
        const prefs = await getNotificationPreferences(order.phoneNumber);
        
        if (prefs.statusUpdates !== false) {
          await db.collection('notifications').add({
            title: 'Order Update',
            body: statusMessages[newStatus],
            phoneNumber: order.phoneNumber,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            orderId: orderId,
            type: 'status_update'
          });
        }
      }
    }
    
    showNotification('Order status updated successfully');
  } catch (error) {
    console.error('Error updating order status:', error);
    showNotification('Failed to update order status', 'error');
  }
}

async function getNotificationPreferences(phoneNumber) {
  try {
    const querySnapshot = await db.collection('fcmTokens')
      .where('phoneNumber', '==', phoneNumber)
      .limit(1)
      .get();
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return doc.data().preferences || state.defaultPreferences;
    }
    return state.defaultPreferences;
  } catch (error) {
    console.error('Error getting preferences:', error);
    return state.defaultPreferences;
  }
}

// Settings Functions
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
  
  try {
    await db.collection('settings').doc('shop').set(settings, { merge: true });
    
    // Send shop status update
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
  } catch (error) {
    console.error('Error saving settings:', error);
    showNotification('Failed to save settings', 'error');
  }
}

// Helper Functions
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
    if (state.fcmToken) {
      try {
        await deleteToken(messaging, state.fcmToken);
        await db.collection('adminTokens').doc(state.currentUser.uid).delete();
      } catch (error) {
        console.error('Error removing token:', error);
      }
    }
    
    await auth.signOut();
    window.location.href = '/admin-login.html';
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Logout failed', 'error');
  }
}