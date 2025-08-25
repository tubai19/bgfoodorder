// Firebase initialization
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

const db = firebase.firestore();
const auth = firebase.auth();

// Initialize AdminNotifications
let adminNotifications;
if (firebase.messaging.isSupported()) {
  adminNotifications = new AdminNotifications(db, auth);
}

class AdminPanel {
  constructor() {
    this.currentUser = null;
    this.orders = [];
    this.inventory = [];
    this.salesChart = null;
    this.currentOrderPage = 0;
    this.ordersPerPage = 10;
    this.hasMoreOrders = true;
    
    this.init();
  }

  async init() {
    await this.checkAuth();
    this.setupEventListeners();
    this.updateCurrentTime();
    setInterval(() => this.updateCurrentTime(), 1000);
    
    // Load initial data
    this.loadDashboardData();
    this.loadOrders();
    this.loadInventory();
    this.loadNotifications();
    this.loadSettings();
  }

  async checkAuth() {
    return new Promise((resolve) => {
      auth.onAuthStateChanged(async (user) => {
        if (user && user.email === "suvradeep.pal93@gmail.com") {
          this.currentUser = user;
          resolve(true);
        } else {
          window.location.href = 'admin-login.html';
          resolve(false);
        }
      });
    });
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.sidebar li').forEach(item => {
      item.addEventListener('click', (e) => {
        const section = e.currentTarget.getAttribute('data-section');
        this.showSection(section);
      });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
      auth.signOut().then(() => {
        window.location.href = 'admin-login.html';
      });
    });

    // Order filtering
    document.getElementById('orderFilter').addEventListener('change', () => {
      this.filterOrders();
    });

    document.getElementById('orderSearch').addEventListener('input', () => {
      this.filterOrders();
    });

    // Inventory filtering
    document.getElementById('categoryFilter').addEventListener('change', () => {
      this.filterInventory();
    });

    document.getElementById('stockFilter').addEventListener('change', () => {
      this.filterInventory();
    });

    document.getElementById('inventorySearch').addEventListener('input', () => {
      this.filterInventory();
    });

    // Load more orders
    document.getElementById('loadMoreOrders').addEventListener('click', () => {
      this.loadMoreOrders();
    });

    // Add item button
    document.getElementById('addItemBtn').addEventListener('click', () => {
      this.openAddItemModal();
    });

    // Save item
    document.getElementById('saveItemBtn').addEventListener('click', () => {
      this.saveItem();
    });

    // Save stock adjustment
    document.getElementById('saveAdjustmentBtn').addEventListener('click', () => {
      this.saveStockAdjustment();
    });

    // Notification form
    document.getElementById('notificationForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendNotification();
    });

    // Test notification
    document.getElementById('testNotificationBtn').addEventListener('click', () => {
      this.sendTestNotification();
    });

    // Settings form
    document.getElementById('settingsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });

    // Modal close buttons
    document.querySelectorAll('.close-modal, .cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeModals();
      });
    });

    // Password visibility toggle
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
      togglePassword.addEventListener('click', function() {
        const passwordInput = document.getElementById('password');
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.classList.toggle('fa-eye-slash');
      });
    }
  }

  showSection(section) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(sec => {
      sec.style.display = 'none';
    });

    // Show selected section
    document.getElementById(`${section}Section`).style.display = 'block';

    // Update active nav item
    document.querySelectorAll('.sidebar li').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');

    // Load section-specific data
    if (section === 'orders') {
      this.loadOrders();
    } else if (section === 'inventory') {
      this.loadInventory();
    } else if (section === 'notifications') {
      this.loadNotifications();
    } else if (section === 'dashboard') {
      this.loadDashboardData();
    }
  }

  updateCurrentTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleString();
  }

  async loadDashboardData() {
    try {
      // Load today's orders
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      
      const ordersSnapshot = await db.collection('orders')
        .where('createdAt', '>=', todayStart)
        .where('createdAt', '<=', todayEnd)
        .get();
      
      const todayOrders = ordersSnapshot.size;
      const todayRevenue = ordersSnapshot.docs.reduce((total, doc) => {
        return total + (doc.data().totalAmount || 0);
      }, 0);
      
      document.getElementById('todayOrders').textContent = todayOrders;
      document.getElementById('todayRevenue').textContent = `₹${todayRevenue.toFixed(2)}`;
      
      // Load active users (users who placed orders today)
      const activeUsers = new Set();
      ordersSnapshot.docs.forEach(doc => {
        if (doc.data().phoneNumber) {
          activeUsers.add(doc.data().phoneNumber);
        }
      });
      
      document.getElementById('activeUsers').textContent = activeUsers.size;
      
      // Load inventory summary
      const inventorySnapshot = await db.collection('inventory').get();
      const totalItems = inventorySnapshot.size;
      
      let lowStockItems = 0;
      let outOfStockItems = 0;
      let totalInventoryValue = 0;
      
      inventorySnapshot.docs.forEach(doc => {
        const item = doc.data();
        const currentStock = item.currentStock || 0;
        const minStock = item.minStock || 0;
        const cost = item.cost || 0;
        
        totalInventoryValue += currentStock * cost;
        
        if (currentStock === 0) {
          outOfStockItems++;
        } else if (currentStock <= minStock) {
          lowStockItems++;
        }
      });
      
      document.getElementById('totalItems').textContent = totalItems;
      document.getElementById('lowStockItems').textContent = lowStockItems;
      document.getElementById('outOfStockItems').textContent = outOfStockItems;
      document.getElementById('totalInventoryValue').textContent = `₹${totalInventoryValue.toFixed(2)}`;
      
      // Initialize sales chart if not already initialized
      if (!this.salesChart) {
        this.initSalesChart();
      }
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }

  initSalesChart() {
    const ctx = document.getElementById('salesChart').getContext('2d');
    this.salesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          label: 'Daily Sales (₹)',
          data: [1200, 1900, 1500, 2100, 2500, 2200, 1800],
          borderColor: '#e63946',
          tension: 0.1,
          fill: true,
          backgroundColor: 'rgba(230, 57, 70, 0.1)'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  async loadOrders() {
    try {
      this.showLoading('ordersListContainer');
      
      // Reset pagination
      this.currentOrderPage = 0;
      this.hasMoreOrders = true;
      
      const ordersQuery = db.collection('orders')
        .orderBy('createdAt', 'desc')
        .limit(this.ordersPerPage);
      
      const snapshot = await ordersQuery.get();
      
      this.orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      this.displayOrders(this.orders);
      
      // Show/hide load more button
      document.getElementById('loadMoreOrders').style.display = 
        snapshot.size === this.ordersPerPage ? 'block' : 'none';
        
    } catch (error) {
      console.error('Error loading orders:', error);
      this.showError('ordersListContainer', 'Failed to load orders');
    }
  }

  async loadMoreOrders() {
    try {
      const loadMoreBtn = document.getElementById('loadMoreOrders');
      loadMoreBtn.disabled = true;
      loadMoreBtn.querySelector('.loading-spinner').style.display = 'inline-block';
      
      this.currentOrderPage++;
      const lastOrder = this.orders[this.orders.length - 1];
      
      const ordersQuery = db.collection('orders')
        .orderBy('createdAt', 'desc')
        .startAfter(lastOrder.createdAt)
        .limit(this.ordersPerPage);
      
      const snapshot = await ordersQuery.get();
      
      if (snapshot.empty) {
        this.hasMoreOrders = false;
        loadMoreBtn.style.display = 'none';
        return;
      }
      
      const newOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      this.orders = [...this.orders, ...newOrders];
      this.displayOrders(this.orders);
      
      loadMoreBtn.disabled = false;
      loadMoreBtn.querySelector('.loading-spinner').style.display = 'none';
      
      if (snapshot.size < this.ordersPerPage) {
        this.hasMoreOrders = false;
        loadMoreBtn.style.display = 'none';
      }
      
    } catch (error) {
      console.error('Error loading more orders:', error);
      const loadMoreBtn = document.getElementById('loadMoreOrders');
      loadMoreBtn.disabled = false;
      loadMoreBtn.querySelector('.loading-spinner').style.display = 'none';
    }
  }

  displayOrders(orders) {
    const container = document.getElementById('ordersListContainer');
    
    if (orders.length === 0) {
      container.innerHTML = '<div class="empty-state">No orders found</div>';
      return;
    }
    
    // Apply filters
    const statusFilter = document.getElementById('orderFilter').value;
    const searchTerm = document.getElementById('orderSearch').value.toLowerCase();
    
    const filteredOrders = orders.filter(order => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesSearch = !searchTerm || 
        order.id.toLowerCase().includes(searchTerm) ||
        (order.phoneNumber && order.phoneNumber.includes(searchTerm)) ||
        (order.customerName && order.customerName.toLowerCase().includes(searchTerm));
      
      return matchesStatus && matchesSearch;
    });
    
    if (filteredOrders.length === 0) {
      container.innerHTML = '<div class="empty-state">No orders match your filters</div>';
      return;
    }
    
    container.innerHTML = filteredOrders.map(order => `
      <div class="order-card" data-order-id="${order.id}">
        <div class="order-header">
          <span class="order-id">#${order.id.substring(0, 8)}</span>
          <span class="order-status ${order.status}">${this.formatStatus(order.status)}</span>
        </div>
        <div class="order-details">
          <div class="customer-info">
            <i class="fas fa-user"></i>
            <span>${order.customerName || 'Guest'}</span>
            <i class="fas fa-phone"></i>
            <span>${order.phoneNumber || 'N/A'}</span>
          </div>
          <div class="order-info">
            <div class="order-items">
              ${order.items ? order.items.slice(0, 2).map(item => 
                `${item.quantity}x ${item.name}`
              ).join(', ') : 'No items'}
              ${order.items && order.items.length > 2 ? `+${order.items.length - 2} more` : ''}
            </div>
            <div class="order-total">₹${order.totalAmount?.toFixed(2) || '0.00'}</div>
          </div>
          <div class="order-footer">
            <span class="order-time">${this.formatDate(order.createdAt?.toDate())}</span>
            <button class="btn secondary-btn view-order-btn">View Details</button>
          </div>
        </div>
      </div>
    `).join('');
    
    // Add event listeners to view buttons
    container.querySelectorAll('.view-order-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderCard = e.target.closest('.order-card');
        const orderId = orderCard.getAttribute('data-order-id');
        this.viewOrderDetails(orderId);
      });
    });
  }

  filterOrders() {
    this.displayOrders(this.orders);
  }

  async viewOrderDetails(orderId) {
    try {
      this.showLoadingOverlay();
      
      const orderDoc = await db.collection('orders').doc(orderId).get();
      
      if (!orderDoc.exists) {
        alert('Order not found');
        this.hideLoadingOverlay();
        return;
      }
      
      const order = orderDoc.data();
      
      // Format order details for modal
      const orderDetails = `
        <div class="order-detail-header">
          <h4>Order #${orderId.substring(0, 8)}</h4>
          <span class="order-status-badge ${order.status}">${this.formatStatus(order.status)}</span>
        </div>
        
        <div class="order-detail-section">
          <h5>Customer Information</h5>
          <p><strong>Name:</strong> ${order.customerName || 'Guest'}</p>
          <p><strong>Phone:</strong> ${order.phoneNumber || 'N/A'}</p>
          <p><strong>Address:</strong> ${order.deliveryAddress || 'N/A'}</p>
        </div>
        
        <div class="order-detail-section">
          <h5>Order Items</h5>
          <table class="order-items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items ? order.items.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.quantity}</td>
                  <td>₹${item.price?.toFixed(2)}</td>
                  <td>₹${(item.quantity * item.price)?.toFixed(2)}</td>
                </tr>
              `).join('') : ''}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3"><strong>Subtotal</strong></td>
                <td><strong>₹${order.subtotal?.toFixed(2) || '0.00'}</strong></td>
              </tr>
              <tr>
                <td colspan="3"><strong>Delivery Charge</strong></td>
                <td><strong>₹${order.deliveryCharge?.toFixed(2) || '0.00'}</strong></td>
              </tr>
              <tr>
                <td colspan="3"><strong>Total Amount</strong></td>
                <td><strong>₹${order.totalAmount?.toFixed(2) || '0.00'}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <div class="order-detail-section">
          <h5>Order Timeline</h5>
          <p><strong>Placed:</strong> ${this.formatDateTime(order.createdAt?.toDate())}</p>
          ${order.completedAt ? `<p><strong>Completed:</strong> ${this.formatDateTime(order.completedAt.toDate())}</p>` : ''}
        </div>
        
        ${order.status === 'pending' || order.status === 'preparing' ? `
        <div class="order-detail-actions">
          <h5>Update Status</h5>
          <div class="status-buttons">
            ${order.status === 'pending' ? `
              <button class="btn primary-btn" data-action="preparing">Mark as Preparing</button>
            ` : ''}
            ${order.status === 'preparing' ? `
              <button class="btn primary-btn" data-action="delivering">Mark as Out for Delivery</button>
            ` : ''}
            <button class="btn danger-btn" data-action="cancelled">Cancel Order</button>
          </div>
        </div>
        ` : ''}
      `;
      
      document.getElementById('orderDetailContent').innerHTML = orderDetails;
      document.getElementById('orderDetailModal').style.display = 'block';
      
      // Add event listeners to status buttons
      document.querySelectorAll('.status-buttons button').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const action = e.target.getAttribute('data-action');
          this.updateOrderStatus(orderId, action);
        });
      });
      
      this.hideLoadingOverlay();
      
    } catch (error) {
      console.error('Error loading order details:', error);
      this.hideLoadingOverlay();
      alert('Failed to load order details');
    }
  }

  async updateOrderStatus(orderId, status) {
    try {
      this.showLoadingOverlay();
      
      const updateData = {
        status,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      if (status === 'completed') {
        updateData.completedAt = firebase.firestore.FieldValue.serverTimestamp();
      }
      
      await db.collection('orders').doc(orderId).update(updateData);
      
      // Update local orders array
      const orderIndex = this.orders.findIndex(o => o.id === orderId);
      if (orderIndex !== -1) {
        this.orders[orderIndex].status = status;
        if (status === 'completed') {
          this.orders[orderIndex].completedAt = new Date();
        }
      }
      
      // Refresh orders display
      this.displayOrders(this.orders);
      
      // Close modal
      this.closeModals();
      
      this.hideLoadingOverlay();
      
      // Show success message
      this.showNotification('Order status updated successfully');
      
      // Send notification to customer if status changed to preparing or delivering
      if (status === 'preparing' || status === 'delivering') {
        const orderDoc = await db.collection('orders').doc(orderId).get();
        const order = orderDoc.data();
        
        if (order.phoneNumber && adminNotifications) {
          let message = '';
          if (status === 'preparing') {
            message = `Your order #${orderId.substring(0, 8)} is now being prepared.`;
          } else if (status === 'delivering') {
            message = `Your order #${orderId.substring(0, 8)} is out for delivery!`;
          }
          
          adminNotifications.sendNotificationToUser(
            order.phoneNumber,
            'Order Status Update',
            message,
            { orderId, type: 'status_update' }
          );
        }
      }
      
    } catch (error) {
      console.error('Error updating order status:', error);
      this.hideLoadingOverlay();
      alert('Failed to update order status');
    }
  }

  async loadInventory() {
    try {
      this.showLoading('inventoryGrid');
      
      const snapshot = await db.collection('inventory').get();
      this.inventory = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      this.displayInventory(this.inventory);
      
    } catch (error) {
      console.error('Error loading inventory:', error);
      this.showError('inventoryGrid', 'Failed to load inventory');
    }
  }

  displayInventory(inventory) {
    const container = document.getElementById('inventoryGrid');
    
    if (inventory.length === 0) {
      container.innerHTML = '<div class="empty-state">No inventory items found</div>';
      return;
    }
    
    // Apply filters
    const categoryFilter = document.getElementById('categoryFilter').value;
    const stockFilter = document.getElementById('stockFilter').value;
    const searchTerm = document.getElementById('inventorySearch').value.toLowerCase();
    
    const filteredInventory = inventory.filter(item => {
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      
      let matchesStock = true;
      if (stockFilter === 'low') {
        matchesStock = item.currentStock > 0 && item.currentStock <= item.minStock;
      } else if (stockFilter === 'out') {
        matchesStock = item.currentStock === 0;
      }
      
      const matchesSearch = !searchTerm || 
        item.name.toLowerCase().includes(searchTerm) ||
        (item.description && item.description.toLowerCase().includes(searchTerm));
      
      return matchesCategory && matchesStock && matchesSearch;
    });
    
    if (filteredInventory.length === 0) {
      container.innerHTML = '<div class="empty-state">No items match your filters</div>';
      return;
    }
    
    container.innerHTML = filteredInventory.map(item => `
      <div class="inventory-item" data-item-id="${item.id}">
        <div class="inventory-item-header">
          <h4>${item.name}</h4>
          <span class="item-category ${item.category}">${this.formatCategory(item.category)}</span>
        </div>
        
        <div class="inventory-item-details">
          <div class="stock-info">
            <div class="stock-level">
              <span class="label">Stock:</span>
              <span class="value ${item.currentStock === 0 ? 'out-of-stock' : item.currentStock <= item.minStock ? 'low-stock' : ''}">
                ${item.currentStock} ${item.unit || ''}
              </span>
            </div>
            <div class="min-stock">
              <span class="label">Min:</span>
              <span class="value">${item.minStock} ${item.unit || ''}</span>
            </div>
          </div>
          
          <div class="price-info">
            <div class="cost">
              <span class="label">Cost:</span>
              <span class="value">₹${item.cost?.toFixed(2)}</span>
            </div>
            <div class="price">
              <span class="label">Price:</span>
              <span class="value">₹${item.price?.toFixed(2)}</span>
            </div>
          </div>
          
          ${item.description ? `
            <div class="item-description">
              <p>${item.description}</p>
            </div>
          ` : ''}
        </div>
        
        <div class="inventory-item-actions">
          <button class="btn secondary-btn adjust-stock-btn">Adjust Stock</button>
          <button class="btn secondary-btn edit-item-btn">Edit</button>
        </div>
        
        <div class="inventory-item-status ${item.active ? 'active' : 'inactive'}">
          ${item.active ? 'Active' : 'Inactive'}
        </div>
      </div>
    `).join('');
    
    // Add event listeners to action buttons
    container.querySelectorAll('.adjust-stock-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemCard = e.target.closest('.inventory-item');
        const itemId = itemCard.getAttribute('data-item-id');
        this.openStockModal(itemId);
      });
    });
    
    container.querySelectorAll('.edit-item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemCard = e.target.closest('.inventory-item');
        const itemId = itemCard.getAttribute('data-item-id');
        this.openEditItemModal(itemId);
      });
    });
  }

  filterInventory() {
    this.displayInventory(this.inventory);
  }

  openAddItemModal() {
    document.getElementById('itemModalTitle').textContent = 'Add Inventory Item';
    document.getElementById('itemForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('itemActive').checked = true;
    document.getElementById('addItemModal').style.display = 'block';
  }

  openEditItemModal(itemId) {
    const item = this.inventory.find(i => i.id === itemId);
    
    if (!item) {
      alert('Item not found');
      return;
    }
    
    document.getElementById('itemModalTitle').textContent = 'Edit Inventory Item';
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemName').value = item.name || '';
    document.getElementById('itemCategory').value = item.category || 'baked';
    document.getElementById('itemPrice').value = item.price || 0;
    document.getElementById('itemCost').value = item.cost || 0;
    document.getElementById('itemStock').value = item.currentStock || 0;
    document.getElementById('minStock').value = item.minStock || 0;
    document.getElementById('itemUnit').value = item.unit || '';
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('itemActive').checked = item.active !== false;
    
    document.getElementById('addItemModal').style.display = 'block';
  }

  async saveItem() {
    try {
      const form = document.getElementById('itemForm');
      
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      
      this.showLoadingOverlay();
      
      const itemData = {
        name: document.getElementById('itemName').value,
        category: document.getElementById('itemCategory').value,
        price: parseFloat(document.getElementById('itemPrice').value),
        cost: parseFloat(document.getElementById('itemCost').value),
        currentStock: parseInt(document.getElementById('itemStock').value),
        minStock: parseInt(document.getElementById('minStock').value),
        unit: document.getElementById('itemUnit').value,
        description: document.getElementById('itemDescription').value,
        active: document.getElementById('itemActive').checked,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      const itemId = document.getElementById('itemId').value;
      
      if (itemId) {
        // Update existing item
        await db.collection('inventory').doc(itemId).update(itemData);
        
        // Update local inventory array
        const itemIndex = this.inventory.findIndex(i => i.id === itemId);
        if (itemIndex !== -1) {
          this.inventory[itemIndex] = { ...this.inventory[itemIndex], ...itemData };
        }
        
        this.showNotification('Item updated successfully');
      } else {
        // Add new item
        itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const docRef = await db.collection('inventory').add(itemData);
        
        // Add to local inventory array
        this.inventory.push({
          id: docRef.id,
          ...itemData
        });
        
        this.showNotification('Item added successfully');
      }
      
      // Refresh inventory display
      this.displayInventory(this.inventory);
      
      // Close modal
      this.closeModals();
      
      this.hideLoadingOverlay();
      
    } catch (error) {
      console.error('Error saving item:', error);
      this.hideLoadingOverlay();
      alert('Failed to save item');
    }
  }

  openStockModal(itemId) {
    const item = this.inventory.find(i => i.id === itemId);
    
    if (!item) {
      alert('Item not found');
      return;
    }
    
    document.getElementById('adjustItemId').value = item.id;
    document.getElementById('adjustItemName').value = item.name;
    document.getElementById('stockForm').reset();
    document.getElementById('stockModal').style.display = 'block';
  }

  async saveStockAdjustment() {
    try {
      const form = document.getElementById('stockForm');
      
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      
      this.showLoadingOverlay();
      
      const itemId = document.getElementById('adjustItemId').value;
      const adjustmentType = document.getElementById('adjustmentType').value;
      const quantity = parseInt(document.getElementById('adjustmentQuantity').value);
      const reason = document.getElementById('adjustmentReason').value;
      const notes = document.getElementById('adjustmentNotes').value;
      
      const itemDoc = await db.collection('inventory').doc(itemId).get();
      
      if (!itemDoc.exists) {
        alert('Item not found');
        this.hideLoadingOverlay();
        return;
      }
      
      const item = itemDoc.data();
      let newStock = item.currentStock || 0;
      
      switch (adjustmentType) {
        case 'add':
          newStock += quantity;
          break;
        case 'remove':
          newStock = Math.max(0, newStock - quantity);
          break;
        case 'set':
          newStock = quantity;
          break;
      }
      
      // Update inventory
      await db.collection('inventory').doc(itemId).update({
        currentStock: newStock,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Record adjustment in history
      await db.collection('inventoryHistory').add({
        itemId,
        itemName: item.name,
        adjustmentType,
        quantity,
        previousStock: item.currentStock || 0,
        newStock,
        reason,
        notes,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        adjustedBy: this.currentUser.email
      });
      
      // Update local inventory array
      const itemIndex = this.inventory.findIndex(i => i.id === itemId);
      if (itemIndex !== -1) {
        this.inventory[itemIndex].currentStock = newStock;
      }
      
      // Refresh inventory display
      this.displayInventory(this.inventory);
      
      // Close modal
      this.closeModals();
      
      this.hideLoadingOverlay();
      
      this.showNotification('Stock adjusted successfully');
      
    } catch (error) {
      console.error('Error adjusting stock:', error);
      this.hideLoadingOverlay();
      alert('Failed to adjust stock');
    }
  }

  async loadNotifications() {
    try {
      this.showLoading('notificationsList');
      
      const snapshot = await db.collection('notifications')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();
      
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      this.displayNotifications(notifications);
      
    } catch (error) {
      console.error('Error loading notifications:', error);
      this.showError('notificationsList', 'Failed to load notifications');
    }
  }

  displayNotifications(notifications) {
    const container = document.getElementById('notificationsList');
    
    if (notifications.length === 0) {
      container.innerHTML = '<div class="empty-state">No notifications sent yet</div>';
      return;
    }
    
    container.innerHTML = notifications.map(notif => `
      <div class="notification-item">
        <div class="notification-header">
          <span class="notification-title">${notif.title}</span>
          <span class="notification-type ${notif.type}">${this.formatNotificationType(notif.type)}</span>
        </div>
        <div class="notification-body">
          <p>${notif.body}</p>
        </div>
        <div class="notification-footer">
          <span class="notification-time">${this.formatDateTime(notif.timestamp?.toDate())}</span>
          <span class="notification-target">To: ${notif.phoneNumber || 'All Users'}</span>
        </div>
      </div>
    `).join('');
  }

  async sendNotification() {
    try {
      const title = document.getElementById('notificationTitle').value;
      const body = document.getElementById('notificationBody').value;
      const type = document.getElementById('notificationType').value;
      
      if (!title || !body) {
        alert('Please enter both title and message');
        return;
      }
      
      this.showLoadingOverlay();
      
      let successCount = 0;
      
      if (adminNotifications) {
        successCount = await adminNotifications.sendBroadcastNotification(title, body, type);
      } else {
        // Fallback: just save to database without sending
        const notificationRef = db.collection('notifications').doc();
        await notificationRef.set({
          title,
          body,
          type,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        successCount = 1; // At least saved to database
      }
      
      // Clear form
      document.getElementById('notificationForm').reset();
      
      // Reload notifications
      this.loadNotifications();
      
      this.hideLoadingOverlay();
      
      this.showNotification(`Notification sent to ${successCount} users`);
      
    } catch (error) {
      console.error('Error sending notification:', error);
      this.hideLoadingOverlay();
      alert('Failed to send notification');
    }
  }

  async sendTestNotification() {
    try {
      if (!adminNotifications) {
        alert('Notifications not supported in this browser');
        return;
      }
      
      this.showLoadingOverlay();
      
      // Send test notification to admin's own phone number if available
      const testPhone = "+1234567890"; // Replace with actual test number
      
      const success = await adminNotifications.sendNotificationToUser(
        testPhone,
        'Test Notification',
        'This is a test notification from the Bake & Grill admin panel',
        { type: 'test' }
      );
      
      this.hideLoadingOverlay();
      
      if (success) {
        this.showNotification('Test notification sent successfully');
      } else {
        alert('No devices found for test notification');
      }
      
    } catch (error) {
      console.error('Error sending test notification:', error);
      this.hideLoadingOverlay();
      alert('Failed to send test notification');
    }
  }

  async loadSettings() {
    try {
      const doc = await db.collection('settings').doc('shop').get();
      
      if (doc.exists) {
        const settings = doc.data();
        
        // Populate form fields
        document.getElementById('shopStatusToggle').checked = settings.shopOpen || false;
        document.getElementById('shopStatusText').textContent = settings.shopOpen ? 'Open' : 'Closed';
        
        if (settings.businessHours) {
          document.getElementById('openingTime').value = settings.businessHours.open || '09:00';
          document.getElementById('closingTime').value = settings.businessHours.close || '21:00';
        }
        
        document.getElementById('deliveryRadius').value = settings.deliveryRadius || 8;
        document.getElementById('minDeliveryOrder').value = settings.minDeliveryOrder || 200;
        
        if (settings.deliveryCharges) {
          document.getElementById('chargeUnder4km').value = settings.deliveryCharges.under4km || 0;
          document.getElementById('charge4to6km').value = settings.deliveryCharges.from4to6km || 20;
          document.getElementById('charge6to8km').value = settings.deliveryCharges.from6to8km || 30;
          document.getElementById('freeDeliveryThreshold').value = settings.freeDeliveryThreshold || 500;
        }
      }
      
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async saveSettings() {
    try {
      this.showLoadingOverlay();
      
      const settings = {
        shopOpen: document.getElementById('shopStatusToggle').checked,
        businessHours: {
          open: document.getElementById('openingTime').value,
          close: document.getElementById('closingTime').value
        },
        deliveryRadius: parseInt(document.getElementById('deliveryRadius').value),
        minDeliveryOrder: parseInt(document.getElementById('minDeliveryOrder').value),
        deliveryCharges: {
          under4km: parseInt(document.getElementById('chargeUnder4km').value),
          from4to6km: parseInt(document.getElementById('charge4to6km').value),
          from6to8km: parseInt(document.getElementById('charge6to8km').value)
        },
        freeDeliveryThreshold: parseInt(document.getElementById('freeDeliveryThreshold').value),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      await db.collection('settings').doc('shop').set(settings, { merge: true });
      
      // Update shop status text
      document.getElementById('shopStatusText').textContent = settings.shopOpen ? 'Open' : 'Closed';
      
      this.hideLoadingOverlay();
      
      this.showNotification('Settings saved successfully');
      
    } catch (error) {
      console.error('Error saving settings:', error);
      this.hideLoadingOverlay();
      alert('Failed to save settings');
    }
  }

  closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.style.display = 'none';
    });
  }

  showLoading(elementId) {
    const element = document.getElementById(elementId);
    element.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
  }

  showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> ${message}</div>`;
  }

  showLoadingOverlay() {
    document.getElementById('loadingOverlay').style.display = 'flex';
  }

  hideLoadingOverlay() {
    document.getElementById('loadingOverlay').style.display = 'none';
  }

  showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }

  formatStatus(status) {
    const statusMap = {
      'pending': 'Pending',
      'preparing': 'Preparing',
      'delivering': 'Out for Delivery',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    
    return statusMap[status] || status;
  }

  formatCategory(category) {
    const categoryMap = {
      'baked': 'Baked Goods',
      'grilled': 'Grilled Items',
      'beverage': 'Beverages',
      'snack': 'Snacks'
    };
    
    return categoryMap[category] || category;
  }

  formatNotificationType(type) {
    const typeMap = {
      'promotion': 'Promotion',
      'update': 'Update',
      'alert': 'Alert',
      'info': 'Information'
    };
    
    return typeMap[type] || type;
  }

  formatDate(date) {
    if (!date) return 'N/A';
    
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatDateTime(date) {
    if (!date) return 'N/A';
    
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AdminPanel();
});