import { 
  AppState, 
  db, 
  serverTimestamp, 
  GeoPoint, 
  collection, 
  addDoc, 
  doc, 
  getDoc,
  showNotification
} from '../main.js';
import { saveOrderForLater } from '../utils/offline.js';
import { generateWhatsAppMessage } from '../utils/messaging.js';
import { generatePDFBill } from '../utils/pdf.js';
import { prepareOrderData } from './order-data.js';

export async function confirmOrder() {
  try {
    if ('vibrate' in navigator) navigator.vibrate(50);
    
    if (!navigator.onLine) {
      const orderData = await prepareOrderData();
      if (!orderData) return;
      
      const saved = await saveOrderForLater(orderData);
      if (saved) {
        showNotification('Order saved offline. Will submit when back online.');
        AppState.selectedItems.length = 0;
        saveCartToStorage();
        updateCheckoutDisplay();
      } else {
        showNotification('Failed to save order offline. Please try again when online.');
      }
      return;
    }
    
    const isShopOpen = await checkShopStatus();
    if (!isShopOpen) {
      alert("Sorry, the shop is currently closed. Please try again later.");
      return;
    }
    
    const orderData = await prepareOrderData();
    if (!orderData) return;
    
    showOrderConfirmationModal(orderData);
  } catch (error) {
    console.error("Error confirming order:", error);
    showNotification("There was an error processing your order. Please try again.");
  }
}

export function showOrderConfirmationModal(orderData) {
  const modal = document.getElementById('orderConfirmationModal');
  const orderSummary = document.getElementById('orderConfirmationSummary');
  
  if (!modal || !orderSummary) return;
  
  let summaryHTML = `
    <div class="order-summary-section">
      <h3>Order Summary</h3>
      <p><strong>Name:</strong> ${orderData.customerName}</p>
      <p><strong>Phone:</strong> ${orderData.phoneNumber}</p>
      <p><strong>Order Type:</strong> ${orderData.orderType}</p>
      ${orderData.orderType === 'Delivery' ? `
        <p><strong>Delivery Distance:</strong> ${orderData.deliveryDistance ? orderData.deliveryDistance.toFixed(1)+'km' : 'Unknown'}</p>
        ${orderData.deliveryAddress ? `<p><strong>Delivery Address:</strong> ${orderData.deliveryAddress}</p>` : ''}
      ` : ''}
      ${orderData.notes ? `<p><strong>Notes:</strong> ${orderData.notes}</p>` : ''}
    </div>
    
    <div class="order-summary-section">
      <h3>Order Items</h3>
      <ul class="order-items-list">
  `;
  
  orderData.items.forEach(item => {
    summaryHTML += `
      <li>
        <span class="item-name">${item.name} (${item.variant})</span>
        <span class="item-quantity">x ${item.quantity}</span>
        <span class="item-price">₹${item.price * item.quantity}</span>
      </li>
    `;
  });
  
  summaryHTML += `
      </ul>
    </div>
    
    <div class="order-summary-section total-section">
      <p><strong>Subtotal:</strong> ₹${orderData.subtotal}</p>
      ${orderData.deliveryCharge > 0 ? `<p><strong>Delivery Charge:</strong> ₹${orderData.deliveryCharge}</p>` : ''}
      ${orderData.orderType === 'Delivery' && orderData.deliveryCharge === 0 ? `<p><strong>Delivery Charge:</strong> Free</p>` : ''}
      <p class="grand-total"><strong>Total Amount:</strong> ₹${orderData.total}</p>
    </div>
  `;
  
  orderSummary.innerHTML = summaryHTML;
  
  document.getElementById('confirmOrderBtn').onclick = async function() {
    try {
      const docRef = await addDoc(collection(db, 'orders'), orderData);
      orderData.id = docRef.id;
      saveOrderToHistory(orderData);
      sendWhatsAppOrder(orderData);
      
      AppState.selectedItems.length = 0;
      saveCartToStorage();
      
      modal.style.display = 'none';
      showNotification('Order placed successfully!');
      
      // Reset form
      document.getElementById('customerName').value = '';
      document.getElementById('phoneNumber').value = '';
      document.getElementById('orderNotes').value = '';
      AppState.locationObj = null;
      AppState.deliveryDistance = null;
      updateCheckoutDisplay();
    } catch (error) {
      console.error("Error saving order:", error);
      alert("There was an error processing your order. Please try again.");
    }
  };
  
  document.getElementById('cancelOrderBtn').onclick = function() {
    modal.style.display = 'none';
  };
  
  modal.style.display = 'block';
}

async function checkShopStatus() {
  try {
    const statusRef = doc(db, 'publicStatus', 'current');
    const docSnap = await getDoc(statusRef);
    return docSnap.exists() ? docSnap.data().isShopOpen !== false : true;
  } catch (error) {
    console.error("Error checking shop status:", error);
    return true;
  }
}

function saveOrderToHistory(orderData) {
  const orders = JSON.parse(localStorage.getItem('bakeAndGrillOrders')) || [];
  orders.unshift({
    ...orderData,
    timestamp: orderData.timestamp?.toDate?.()?.toISOString?.() || new Date().toISOString()
  });
  if (orders.length > 50) orders.pop();
  localStorage.setItem('bakeAndGrillOrders', JSON.stringify(orders));
}

function sendWhatsAppOrder(orderData) {
  const message = generateWhatsAppMessage(orderData);
  
  if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    window.location.href = `whatsapp://send?phone=918240266267&text=${encodeURIComponent(message)}`;
  } else {
    window.open(`https://wa.me/918240266267?text=${encodeURIComponent(message)}`, '_blank');
  }
}