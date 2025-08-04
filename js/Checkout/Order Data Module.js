import { AppState } from '../main.js';
import { calculateDeliveryChargeByDistance } from '../utils/delivery.js';

export async function prepareOrderData() {
  const customerName = document.getElementById('customerName');
  const phoneNumber = document.getElementById('phoneNumber');
  const orderNotes = document.getElementById('orderNotes');
  const manualDeliveryAddress = document.getElementById('manualDeliveryAddress');
  
  const name = customerName?.value.trim();
  const phone = phoneNumber?.value.trim();
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
  const subtotal = AppState.selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  if (orderType === "Delivery") {
    const hasCombos = AppState.selectedItems.some(item => {
      return Object.keys(fullMenu).some(category => {
        return category === "Combos" && fullMenu[category].some(combo => combo.name === item.name);
      });
    });
    
    if (hasCombos) {
      alert("Combos are not available for delivery. Please remove combo items or choose pickup.");
      return null;
    }
  }

  if (orderType === 'Delivery' && subtotal < AppState.MIN_DELIVERY_ORDER) {
    alert(`Minimum order for delivery is ₹${AppState.MIN_DELIVERY_ORDER}. Please add more items or choose pickup.`);
    return null;
  }

  if (!name || !phone) {
    alert("Please enter your name and phone number.");
    return null;
  }

  if (!/^\d{10}$/.test(phone)) {
    alert("Please enter a valid 10-digit phone number.");
    return null;
  }

  if (orderType === 'Delivery') {
    if (!AppState.locationObj && !AppState.usingManualLoc) {
      alert("Please share your location or enter your address to proceed with delivery.");
      document.getElementById('locationChoiceBlock').scrollIntoView({ behavior: 'smooth' });
      return null;
    }
    
    if (AppState.usingManualLoc && !manualDeliveryAddress?.value.trim()) {
      alert("Please enter your delivery address.");
      manualDeliveryAddress.focus();
      return null;
    }
    
    if (!AppState.deliveryDistance) {
      alert("We couldn't determine your distance from the restaurant. Please check your location settings and try again.");
      return null;
    }
    
    if (AppState.deliveryDistance > AppState.MAX_DELIVERY_DISTANCE) {
      alert(`Your location is ${AppState.deliveryDistance.toFixed(1)}km away (beyond our ${AppState.MAX_DELIVERY_DISTANCE}km delivery range). Please choose pickup or visit our restaurant.`);
      return null;
    }
  }

  let deliveryCharge = 0;
  if (orderType === 'Delivery') {
    const result = calculateDeliveryChargeByDistance(AppState.deliveryDistance);
    deliveryCharge = subtotal >= 500 ? 0 : (result || 0);
  }
  const total = subtotal + deliveryCharge;

  const orderData = {
    customerName: name,
    phoneNumber: phone,
    orderType: orderType,
    items: [...AppState.selectedItems],
    subtotal: subtotal,
    deliveryCharge: deliveryCharge,
    total: total,
    status: "Pending",
    timestamp: serverTimestamp(),
    notes: orderNotes?.value.trim(),
    isOffline: !navigator.onLine
  };

  if (orderType === 'Delivery') {
    if (AppState.usingManualLoc) {
      orderData.deliveryAddress = manualDeliveryAddress?.value;
      if (AppState.locationObj) {
        orderData.deliveryLocation = new GeoPoint(AppState.locationObj.lat, AppState.locationObj.lng);
      }
    } else if (AppState.locationObj) {
      orderData.deliveryLocation = new GeoPoint(AppState.locationObj.lat, AppState.locationObj.lng);
    }
    orderData.deliveryDistance = AppState.deliveryDistance;
  }

  const modalRating = document.querySelector('#orderConfirmationModal .star-rating input:checked')?.value;
  if (modalRating > 0) {
    const comment = document.querySelector('#orderConfirmationModal .rating-comment')?.value;
    orderData.rating = modalRating;
    if (comment) orderData.ratingComment = comment;
  }

  return orderData;
}