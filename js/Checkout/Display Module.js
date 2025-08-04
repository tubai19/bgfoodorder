import { AppState } from '../main.js';
import { calculateDeliveryChargeByDistance } from '../utils/delivery.js';

export function updateCheckoutDisplay() {
  const itemCount = AppState.selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = AppState.selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let deliveryCharge = 0;
  
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  if (orderType === 'Delivery' && AppState.locationObj && AppState.deliveryDistance) {
    deliveryCharge = calculateDeliveryChargeByDistance(AppState.deliveryDistance);
    if (subtotal >= 500) deliveryCharge = 0;
  }
  
  const total = subtotal + deliveryCharge;
  
  // Update item count display
  const totalItemsDisplay = document.getElementById('totalItems');
  if (totalItemsDisplay) {
    const itemsText = itemCount === 1 ? '1 item' : `${itemCount} items`;
    totalItemsDisplay.textContent = itemsText;
  }
  
  // Update total amount display
  let totalText = `Total: ₹${total}`;
  if (deliveryCharge > 0) {
    totalText += ` (₹${subtotal} + ₹${deliveryCharge} delivery)`;
  } else if (orderType === 'Delivery' && deliveryCharge === 0) {
    totalText += ` (₹${subtotal} + Free delivery)`;
  }
  
  const totalAmountDisplay = document.getElementById('totalAmount');
  if (totalAmountDisplay) {
    totalAmountDisplay.textContent = totalText;
  }
  
  const mobileLiveTotal = document.getElementById('mobileLiveTotal');
  if (mobileLiveTotal) {
    mobileLiveTotal.innerHTML = `💰 Total Bill: ₹${total}`;
  }
  
  const deliveryChargeDisplay = document.getElementById('deliveryChargeDisplay');
  if (deliveryChargeDisplay) {
    if (orderType === 'Delivery') {
      if (AppState.deliveryDistance) {
        if (AppState.deliveryDistance > AppState.MAX_DELIVERY_DISTANCE) {
          deliveryChargeDisplay.textContent = `⚠️ Delivery not available (${AppState.deliveryDistance.toFixed(1)}km beyond ${AppState.MAX_DELIVERY_DISTANCE}km limit)`;
          deliveryChargeDisplay.style.color = 'var(--error-color)';
        } else {
          const chargeText = deliveryCharge === 0 ? 'Free delivery' : `Delivery charge: ₹${deliveryCharge}`;
          deliveryChargeDisplay.textContent = `${chargeText} | Distance: ${AppState.deliveryDistance.toFixed(1)}km`;
          deliveryChargeDisplay.style.color = 'var(--success-color)';
        }
      } else {
        deliveryChargeDisplay.textContent = 'Delivery charge will be calculated';
        deliveryChargeDisplay.style.color = 'var(--text-color)';
      }
      deliveryChargeDisplay.style.display = 'block';
    } else {
      deliveryChargeDisplay.style.display = 'none';
    }
  }
}

export function showOrHideLocationBlock() {
  const locationChoiceBlock = document.getElementById('locationChoiceBlock');
  if (!locationChoiceBlock) return;
  
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  if (orderType === 'Delivery') {
    locationChoiceBlock.style.display = 'block';
    const deliveryDistanceDisplay = document.getElementById('deliveryDistanceDisplay');
    if (deliveryDistanceDisplay) {
      deliveryDistanceDisplay.style.display = AppState.deliveryDistance ? 'block' : 'none';
    }
  } else {
    locationChoiceBlock.style.display = 'none';
    const deliveryDistanceDisplay = document.getElementById('deliveryDistanceDisplay');
    if (deliveryDistanceDisplay) {
      deliveryDistanceDisplay.style.display = 'none';
    }
  }
  updateCheckoutDisplay();
}

export function checkDeliveryRestriction() {
  const deliveryRestriction = document.getElementById('deliveryRestriction');
  if (!AppState.locationObj || !deliveryRestriction) return;
  
  deliveryRestriction.style.display = AppState.deliveryDistance > AppState.MAX_DELIVERY_DISTANCE ? 'block' : 'none';
}