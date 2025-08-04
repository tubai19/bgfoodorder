import { AppState, saveCartToStorage, showNotification } from '../main.js';
import { generatePDFBill } from '../utils/pdf.js';

export function showOrderHistory() {
  const orders = JSON.parse(localStorage.getItem('bakeAndGrillOrders')) || [];
  const orderHistoryList = document.getElementById('orderHistoryList');
  
  if (orderHistoryList) {
    if (orders.length === 0) {
      orderHistoryList.innerHTML = '<div class="no-orders">No orders found in your history.</div>';
    } else {
      orderHistoryList.innerHTML = '';
      
      orders.forEach((order, index) => {
        const orderElement = document.createElement('div');
        orderElement.className = 'order-history-item';
        
        orderElement.innerHTML = `
          <div class="order-history-header">
            <span class="order-number">Order #${index + 1}</span>
            <span class="order-date">${new Date(order.timestamp).toLocaleString()}</span>
            <span class="order-total">₹${order.total}</span>
          </div>
          <div class="order-history-details">
            <div><strong>Name:</strong> ${order.customerName}</div>
            <div><strong>Phone:</strong> ${order.phoneNumber}</div>
            <div><strong>Type:</strong> ${order.orderType}</div>
            ${order.orderType === 'Delivery' ? `<div><strong>Distance:</strong> ${order.deliveryDistance ? order.deliveryDistance.toFixed(1)+'km' : 'Unknown'}</div>` : ''}
            <div class="order-items">
              <strong>Items:</strong>
              <ul>
                ${order.items.map(item => `<li>${item.name} (${item.variant}) x ${item.quantity} - ₹${item.price * item.quantity}</li>`).join('')}
              </ul>
            </div>
          </div>
          <div class="order-history-actions">
            <button class="reorder-btn" data-index="${index}"><i class="fas fa-redo"></i> Reorder</button>
            <button class="download-btn" data-index="${index}"><i class="fas fa-file-pdf"></i> Download</button>
          </div>
        `;
        
        orderHistoryList.appendChild(orderElement);
      });
      
      document.querySelectorAll('.reorder-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          reorderFromHistory(parseInt(this.dataset.index));
        });
      });
      
      document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          downloadOrderFromHistory(parseInt(this.dataset.index));
        });
      });
    }
  }
  
  document.getElementById('orderHistoryModal').style.display = 'block';
}

export function clearOrderHistory() {
  if (confirm('Are you sure you want to clear your entire order history?')) {
    localStorage.removeItem('bakeAndGrillOrders');
    showOrderHistory();
    showNotification('Order history cleared');
  }
}

export function reorderFromHistory(orderIndex) {
  const orders = JSON.parse(localStorage.getItem('bakeAndGrillOrders')) || [];
  if (orderIndex >= 0 && orderIndex < orders.length) {
    const order = orders[orderIndex];
    AppState.selectedItems.length = 0;
    order.items.forEach(item => {
      AppState.selectedItems.push({
        name: item.name,
        variant: item.variant,
        price: item.price,
        quantity: item.quantity
      });
    });
    
    document.getElementById('customerName').value = order.customerName;
    document.getElementById('phoneNumber').value = order.phoneNumber;
    document.querySelector(`input[name="orderType"][value="${order.orderType}"]`).checked = true;
    
    saveCartToStorage();
    updateCheckoutDisplay();
    showNotification('Order loaded from history');
  }
}

export function downloadOrderFromHistory(orderIndex) {
  const orders = JSON.parse(localStorage.getItem('bakeAndGrillOrders')) || [];
  if (orderIndex >= 0 && orderIndex < orders.length) {
    generatePDFBill(orders[orderIndex]);
  }
}