const { jsPDF } = window.jspdf;
    
const RESTAURANT_LOCATION = {
  lat: 22.3908,
  lng: 88.2189
};
const MAX_DELIVERY_DISTANCE = 8; // 8km maximum delivery distance
const MIN_DELIVERY_ORDER = 200;

const selectedItems = [];
const tabsDiv = document.getElementById("tabs");
const container = document.getElementById("menuContainer");
const totalBill = document.getElementById("liveTotal");
const cartList = document.getElementById("cartItems");
const searchInput = document.getElementById("searchInput");
const deliveryChargeDisplay = document.getElementById("deliveryChargeDisplay");
const locationStatus = document.getElementById("locationStatus");
const deliveryAddressContainer = document.getElementById("deliveryAddressContainer");
const locationPrompt = document.getElementById("locationPrompt");
const shareLocationBtn = document.getElementById("shareLocationBtn");
const locationDetails = document.getElementById("locationDetails");
const refreshLocationBtn = document.getElementById("refreshLocationBtn");
const toggleManualLocation = document.getElementById("toggleManualLocation");
const locationAccuracyWarning = document.getElementById("locationAccuracyWarning");
const quickLocationBtn = document.getElementById("quickLocationBtn");
const quickLocationStatus = document.getElementById("quickLocationStatus");
const deliveryRestriction = document.getElementById("deliveryRestriction");
let currentCategory = null;
let deliveryDistance = null;
let isLocationFetching = false;
let userLocation = null;
let watchId = null;
let isManualLocation = false;

document.addEventListener('DOMContentLoaded', function() {
  initializeTabs();
  setupEventListeners();
  
  // Show location prompt if delivery is selected by default
  if (document.querySelector('input[name="orderType"]:checked').value === 'Delivery') {
    showLocationPrompt();
  }
});

function setupEventListeners() {
  // Order type radio button change handler
  document.querySelectorAll('input[name="orderType"]').forEach(radio => {
    radio.addEventListener('change', function() {
      const isDelivery = this.value === 'Delivery';
      deliveryAddressContainer.style.display = isDelivery ? 'block' : 'none';
      deliveryChargeDisplay.style.display = 'none';
      locationStatus.style.display = 'none';
      deliveryRestriction.style.display = 'none';
      
      if (isDelivery) {
        showLocationPrompt();
      } else {
        stopLocationTracking();
        deliveryDistance = null;
      }
      
      // Re-render current category to update disabled state
      if (currentCategory) {
        renderCategory(currentCategory, searchInput.value);
      }
      updateCart();
    });
  });

  // Quick location button click handler
  quickLocationBtn.addEventListener('click', function() {
    getQuickLocation();
  });

  // Share location button click handler
  shareLocationBtn.addEventListener('click', function() {
    startLocationTracking();
  });

  // Refresh location button click handler
  refreshLocationBtn.addEventListener('click', function() {
    stopLocationTracking();
    startLocationTracking();
  });

  // Manual location toggle handler
  toggleManualLocation.addEventListener('click', function() {
    const manualContainer = document.getElementById('manualLocationContainer');
    isManualLocation = !isManualLocation;
    
    if (isManualLocation) {
      manualContainer.style.display = 'block';
      this.textContent = 'Use automatic location detection';
      stopLocationTracking();
      document.getElementById('locationText').textContent = 'Using manual address entry';
      document.getElementById('locationMapLink').innerHTML = '';
      document.getElementById('deliveryEstimate').textContent = 'Distance will be estimated from address';
    } else {
      manualContainer.style.display = 'none';
      this.textContent = 'Or enter address manually';
      startLocationTracking();
    }
  });
  
  // Save manual address handler
  document.getElementById('saveManualLocation').addEventListener('click', function() {
    const address = document.getElementById('manualAddress').value.trim();
    if (!address) {
      alert('Please enter your address');
      return;
    }
    
    // In a real app, you would geocode this address to get coordinates
    // For this example, we'll just use a fake distance
    deliveryDistance = 3 + Math.random() * 5; // Random distance between 3-8km
    
    document.getElementById('locationText').textContent = `📍 Manual address saved`;
    document.getElementById('locationMapLink').innerHTML = 
      `<div style="color: var(--primary-color);">${address}</div>`;
    
    const estimatedTime = calculateDeliveryTime(deliveryDistance);
    document.getElementById('deliveryEstimate').innerHTML = 
      `📏 Estimated Distance: <strong>${deliveryDistance.toFixed(1)}km</strong> | 
       ⏳ Est. Delivery: <strong>${estimatedTime}</strong>`;
    
    updateCart();
    checkDeliveryRestriction();
  });
}

function checkDeliveryRestriction() {
  if (!deliveryDistance) {
    deliveryRestriction.style.display = 'none';
    return;
  }
  
  if (deliveryDistance > MAX_DELIVERY_DISTANCE) {
    deliveryRestriction.style.display = 'block';
  } else {
    deliveryRestriction.style.display = 'none';
  }
}

function getQuickLocation() {
  quickLocationStatus.style.display = 'block';
  quickLocationStatus.className = 'location-loading';
  quickLocationStatus.textContent = "Detecting your location...";
  
  if (!navigator.geolocation) {
    quickLocationStatus.className = 'location-error';
    quickLocationStatus.textContent = "Geolocation is not supported by your browser.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      userLocation = { lat: userLat, lng: userLng };
      
      document.getElementById('deliveryLatitude').value = userLat;
      document.getElementById('deliveryLongitude').value = userLng;
      
      calculateRoadDistance(userLat, userLng, (distance) => {
        deliveryDistance = distance;
        quickLocationStatus.className = 'location-success';
        quickLocationStatus.innerHTML = `📍 Location shared successfully! Distance: ${distance.toFixed(1)}km`;
        
        // Update the main location display if delivery address container is visible
        if (document.querySelector('input[name="orderType"]:checked').value === 'Delivery') {
          updateLocationDisplay(userLat, userLng, deliveryDistance);
          hideLocationPrompt();
        }
        
        updateCart();
        checkDeliveryRestriction();
      });
    },
    (error) => {
      quickLocationStatus.className = 'location-error';
      switch(error.code) {
        case error.PERMISSION_DENIED:
          quickLocationStatus.textContent = "Location access was denied. Please enable it in your browser settings.";
          break;
        case error.POSITION_UNAVAILABLE:
          quickLocationStatus.textContent = "Location information is unavailable.";
          break;
        case error.TIMEOUT:
          quickLocationStatus.textContent = "The request to get location timed out.";
          break;
        default:
          quickLocationStatus.textContent = "An unknown error occurred while getting location.";
      }
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function calculateRoadDistance(originLat, originLng, callback) {
  const origin = `${originLng},${originLat}`;
  const destination = `${RESTAURANT_LOCATION.lng},${RESTAURANT_LOCATION.lat}`;
  
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin};${destination}?overview=false`);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const distanceKm = data.routes[0].distance / 1000;
      callback(distanceKm);
    } else {
      // Fallback to haversine if OSRM fails
      const distance = calculateHaversineDistance(
        originLat, originLng,
        RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng
      );
      callback(distance);
    }
  } catch (error) {
    console.error("Error calculating road distance:", error);
    // Fallback to haversine if API fails
    const distance = calculateHaversineDistance(
      originLat, originLng,
      RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng
    );
    callback(distance);
  }
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function showLocationPrompt() {
  locationPrompt.style.display = 'flex';
  locationDetails.style.display = 'none';
  refreshLocationBtn.style.display = 'none';
  toggleManualLocation.style.display = 'none';
  document.getElementById('manualLocationContainer').style.display = 'none';
}

function hideLocationPrompt() {
  locationPrompt.style.display = 'none';
  locationDetails.style.display = 'block';
  refreshLocationBtn.style.display = 'block';
  toggleManualLocation.style.display = 'block';
}

function initializeTabs() {
  for (const category in fullMenu) {
    const tabBtn = document.createElement("button");
    tabBtn.textContent = category;
    tabBtn.onclick = () => {
      searchInput.value = '';
      renderCategory(category);
      document.getElementById("menuContainer").scrollIntoView({ behavior: 'smooth' });
    };
    tabsDiv.appendChild(tabBtn);
  }
  const firstCategory = Object.keys(fullMenu)[0];
  if (firstCategory) renderCategory(firstCategory);
}

function startLocationTracking() {
  if (isLocationFetching) return;
  
  isLocationFetching = true;
  locationStatus.style.display = 'block';
  locationStatus.className = 'location-loading';
  locationStatus.textContent = "Calculating road distance from restaurant...";
  
  if (!navigator.geolocation) {
    locationStatus.className = 'location-error';
    locationStatus.textContent = "Geolocation is not supported by your browser.";
    isLocationFetching = false;
    return;
  }

  hideLocationPrompt();
  
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      userLocation = { lat: userLat, lng: userLng };
      
      document.getElementById('deliveryLatitude').value = userLat;
      document.getElementById('deliveryLongitude').value = userLng;
      
      calculateRoadDistance(userLat, userLng, (distance) => {
        deliveryDistance = distance;
        
        updateLocationDisplay(userLat, userLng, deliveryDistance);
        locationStatus.className = 'location-success';
        locationStatus.innerHTML = `Location tracking active (road distance calculated)`;
        isLocationFetching = false;
        updateCart();
        checkDeliveryRestriction();
        
        if (position.coords.accuracy > 100) {
          locationAccuracyWarning.style.display = 'flex';
        } else {
          locationAccuracyWarning.style.display = 'none';
        }
      });
    },
    (error) => {
      locationStatus.className = 'location-error';
      switch(error.code) {
        case error.PERMISSION_DENIED:
          locationStatus.textContent = "Location access was denied. Please enable it.";
          showLocationPrompt();
          break;
        case error.POSITION_UNAVAILABLE:
          locationStatus.textContent = "Location information is unavailable.";
          showLocationPrompt();
          break;
        case error.TIMEOUT:
          locationStatus.textContent = "The request to get location timed out.";
          showLocationPrompt();
          break;
        default:
          locationStatus.textContent = "An unknown error occurred.";
          showLocationPrompt();
      }
      isLocationFetching = false;
    },
    { 
      enableHighAccuracy: true, 
      timeout: 10000, 
      maximumAge: 0 
    }
  );
}

function updateLocationDisplay(lat, lng, distance) {
  document.getElementById('locationText').textContent = `📍 Your location detected`;
  document.getElementById('locationMapLink').innerHTML = 
    `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="color: var(--primary-color);">
       View on Google Maps
     </a>`;
  
  const estimatedTime = calculateDeliveryTime(distance);
  document.getElementById('deliveryEstimate').innerHTML = 
    `📏 Road Distance: <strong>${distance.toFixed(1)}km</strong> | 
     ⏳ Est. Delivery: <strong>${estimatedTime}</strong>`;
}

function stopLocationTracking() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

function renderCategory(category, searchTerm = '') {
  container.innerHTML = "";
  currentCategory = category;
  
  const section = document.createElement("div");
  section.className = "category";
  section.innerHTML = `<span style="font-size: 1.5rem; margin-right: 0.5rem;">${categoryIcons[category] || "🍽"}</span>${category}`;
  container.appendChild(section);

  const filteredItems = fullMenu[category].filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.name.toLowerCase().includes(term) ||
      (item.nameBn && item.nameBn.includes(term)) ||
      item.desc.toLowerCase().includes(term)
    );
  });

  if (filteredItems.length === 0) {
    const noResults = document.createElement("div");
    noResults.className = "no-results";
    noResults.textContent = "No items found matching your search.";
    container.appendChild(noResults);
    return;
  }

  filteredItems.forEach((item) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "item";
    
    // Add disabled class if combo and delivery
    if (category === "Combos" && document.querySelector('input[name="orderType"]:checked').value === "Delivery") {
      itemDiv.classList.add("disabled-item");
      itemDiv.title = "Combos not available for delivery";
    }

    const title = document.createElement("h3");
    title.textContent = item.name;

    const bn = document.createElement("small");
    bn.textContent = item.nameBn || "";

    const desc = document.createElement("p");
    desc.className = "desc";
    desc.textContent = item.desc || "";

    const variantDiv = document.createElement("div");
    variantDiv.className = "variants";
    for (const [variant, price] of Object.entries(item.variants)) {
      const label = document.createElement("label");
      label.textContent = `${variant} ₹${price}`;
      
      // Disable click if combo and delivery
      if (category === "Combos" && document.querySelector('input[name="orderType"]:checked').value === "Delivery") {
        label.style.opacity = "0.6";
        label.style.cursor = "not-allowed";
        label.title = "Combos not available for delivery";
      } else {
        label.onclick = () => addToOrder(item.name, variant, price);
      }
      
      variantDiv.appendChild(label);
    }

    itemDiv.appendChild(title);
    itemDiv.appendChild(bn);
    itemDiv.appendChild(desc);
    itemDiv.appendChild(variantDiv);
    container.appendChild(itemDiv);
  });
}

searchInput.addEventListener('input', (e) => {
  if (currentCategory) {
    renderCategory(currentCategory, e.target.value);
  }
});

function addToOrder(name, variant, price) {
  selectedItems.push({ name, variant, price });
  updateCart();
  
  const itemAdded = document.createElement("div");
  itemAdded.textContent = `Added ${name} (${variant}) to cart!`;
  itemAdded.style.position = "fixed";
  itemAdded.style.bottom = "20px";
  itemAdded.style.right = "20px";
  itemAdded.style.backgroundColor = "#4CAF50";
  itemAdded.style.color = "white";
  itemAdded.style.padding = "10px 20px";
  itemAdded.style.borderRadius = "5px";
  itemAdded.style.zIndex = "1000";
  itemAdded.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
  document.body.appendChild(itemAdded);
  
  setTimeout(() => {
    itemAdded.style.transition = "opacity 0.5s";
    itemAdded.style.opacity = "0";
    setTimeout(() => itemAdded.remove(), 500);
  }, 2000);
}

function updateCart() {
  cartList.innerHTML = "";
  const subtotal = selectedItems.reduce((sum, item) => sum + item.price, 0);
  
  let deliveryCharge = 0;
  let deliveryMessage = "";
  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  
  if (orderType === 'Delivery') {
    const result = calculateDeliveryCharge(subtotal, deliveryDistance);
    deliveryCharge = result.charge || 0;
    deliveryMessage = result.message;
    
    if (deliveryCharge !== null) {
      const estimatedTime = calculateDeliveryTime(deliveryDistance);
      deliveryMessage += ` | ⏳ Est. Delivery: ${estimatedTime}`;
      deliveryChargeDisplay.textContent = deliveryMessage;
      deliveryChargeDisplay.style.display = 'block';
    } else {
      deliveryChargeDisplay.textContent = deliveryMessage;
      deliveryChargeDisplay.style.color = 'var(--error-color)';
      deliveryChargeDisplay.style.display = 'block';
    }
  }

  const total = subtotal + (deliveryCharge || 0);
  
  selectedItems.forEach((item, index) => {
    const li = document.createElement("li");
    li.textContent = `${index + 1}. ${item.name} (${item.variant}) - ₹${item.price}`;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.className = "remove-btn";
    removeBtn.onclick = () => {
      selectedItems.splice(index, 1);
      updateCart();
    };
    li.appendChild(removeBtn);
    cartList.appendChild(li);
  });

  let billText = `Subtotal: ₹${subtotal}`;
  if (deliveryCharge > 0) {
    billText += ` + Delivery: ₹${deliveryCharge}`;
  } else if (orderType === 'Delivery' && deliveryCharge === 0) {
    billText += ` + Delivery: Free`;
  }
  billText += ` = Total: ₹${total}`;
  
  if (orderType === 'Delivery' && deliveryCharge === null) {
    billText += " (Delivery not available)";
  }
  
  totalBill.innerHTML = billText;
}

function calculateDeliveryTime(distanceKm) {
  if (!distanceKm) return "Unknown";
  const preparationTime = 20; // 20 minutes food preparation
  const travelTimePerKm = 8;  // 8 minutes per km travel
  const travelTime = Math.round(distanceKm * travelTimePerKm);
  const totalTime = preparationTime + travelTime;
  
  return `${totalTime} minutes (${preparationTime} min prep + ${travelTime} min travel)`;
}

function calculateDeliveryCharge(total, distance) {
  if (!distance) return { charge: null, message: "Please share your location to calculate delivery" };
  if (distance > MAX_DELIVERY_DISTANCE) return { charge: null, message: "⚠️ Delivery not available beyond 8km" };
  if (total >= 500) return { charge: 0, message: "🎉 Free delivery (order above ₹500)" };
  if (distance <= 4) return { charge: 0, message: "Free delivery (within 4km)" };
  if (distance <= 6) return { charge: 20, message: `Delivery charge: ₹20 (${distance.toFixed(1)}km)` };
  if (distance <= 8) return { charge: 30, message: `Delivery charge: ₹30 (${distance.toFixed(1)}km)` };
  return { charge: null, message: "⚠️ Delivery not available beyond 8km" };
}

function confirmOrder() {
  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("phoneNumber").value.trim();
  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  const subtotal = selectedItems.reduce((sum, item) => sum + item.price, 0);
  
  // Check if any combo items are in cart for delivery
  if (orderType === "Delivery") {
    const hasCombos = selectedItems.some(item => {
      return Object.keys(fullMenu).some(category => {
        return category === "Combos" && 
               fullMenu[category].some(combo => combo.name === item.name);
      });
    });
    
    if (hasCombos) {
      alert("Combos are not available for delivery. Please remove combo items or choose pickup.");
      return;
    }
  }

  if (orderType === 'Delivery' && subtotal < MIN_DELIVERY_ORDER) {
    alert(`Minimum order for delivery is ₹${MIN_DELIVERY_ORDER}. Please add more items or choose pickup.`);
    return;
  }

  if (!name || !phone) {
    alert("Please enter your name and phone number.");
    return;
  }

  if (!/^\d{10}$/.test(phone)) {
    alert("Please enter a valid 10-digit phone number.");
    return;
  }

  // Check if location is required and available
  if (orderType === 'Delivery') {
    if (!userLocation && !isManualLocation) {
      alert("Please share your location or enter your address to proceed with delivery.");
      showLocationPrompt();
      document.getElementById('deliveryAddressContainer').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    
    if (!deliveryDistance) {
      alert("We couldn't determine your distance from the restaurant. Please check your location settings and try again.");
      return;
    }
    
    if (deliveryDistance > MAX_DELIVERY_DISTANCE) {
      alert(`Your location is ${deliveryDistance.toFixed(1)}km away (beyond our 8km delivery range). Please choose pickup or visit our restaurant.`);
      return;
    }
  }

  let deliveryCharge = 0;
  let deliveryMessage = "";
  if (orderType === 'Delivery') {
    const result = calculateDeliveryCharge(subtotal, deliveryDistance);
    deliveryCharge = result.charge || 0;
    deliveryMessage = result.message;
  }
  const total = subtotal + deliveryCharge;

  // Prepare order data for Firebase
  const orderData = {
    customerName: name,
    phoneNumber: phone,
    orderType: orderType,
    items: selectedItems,
    subtotal: subtotal,
    deliveryCharge: deliveryCharge,
    total: total,
    status: "Pending",
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  // Add delivery location if applicable
  if (orderType === 'Delivery') {
    if (isManualLocation) {
      orderData.deliveryAddress = document.getElementById('manualAddress').value;
    } else if (userLocation) {
      orderData.deliveryLocation = {
        lat: userLocation.lat,
        lng: userLocation.lng
      };
    }
    orderData.deliveryDistance = deliveryDistance;
  }

  let confirmationHTML = `
    <div class="order-summary-item"><strong>Customer:</strong> ${name}</div>
    <div class="order-summary-item"><strong>Phone:</strong> ${phone}</div>
    <div class="order-summary-item"><strong>Order Type:</strong> ${orderType}</div>`;
  
  if (orderType === 'Delivery') {
    const estimatedTime = calculateDeliveryTime(deliveryDistance);
    if (isManualLocation) {
      const address = document.getElementById('manualAddress').value;
      confirmationHTML += `
        <div class="order-summary-item"><strong>Address:</strong> ${address}</div>
        <div class="order-summary-item"><strong>Estimated Distance:</strong> ${deliveryDistance ? deliveryDistance.toFixed(1)+'km' : 'Unknown'}</div>`;
    } else if (userLocation) {
      const mapsLink = `https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}`;
      confirmationHTML += `
        <div class="order-summary-item"><strong>Location:</strong> <a href="${mapsLink}" target="_blank">View on Map</a></div>
        <div class="order-summary-item"><strong>Distance:</strong> ${deliveryDistance ? deliveryDistance.toFixed(1)+'km' : 'Unknown'}</div>`;
    }
    confirmationHTML += `
      <div class="order-summary-item"><strong>Estimated Delivery:</strong> ${estimatedTime}</div>`;
  }
  
  confirmationHTML += `<div class="order-summary-item"><strong>Items:</strong></div>`;
  
  selectedItems.forEach((item, index) => {
    confirmationHTML += `
      <div class="order-summary-item">
        ${index + 1}. ${item.name} (${item.variant}) - ₹${item.price}
      </div>`;
  });
  
  confirmationHTML += `
    <div class="order-summary-item"><strong>Subtotal:</strong> ₹${subtotal}</div>`;
  
  if (deliveryCharge > 0) {
    confirmationHTML += `
      <div class="order-summary-item"><strong>Delivery Charge:</strong> ₹${deliveryCharge}</div>`;
  } else if (orderType === 'Delivery') {
    confirmationHTML += `
      <div class="order-summary-item"><strong>Delivery Charge:</strong> Free</div>`;
  }
  
  confirmationHTML += `
    <div class="order-summary-item" style="font-weight:bold; color:var(--primary-color); border-bottom:none;">
      <strong>Total Amount:</strong> ₹${total}
    </div>`;
  
  document.getElementById("orderConfirmationDetails").innerHTML = confirmationHTML;
  const modal = document.getElementById("orderConfirmationModal");
  modal.style.display = "block";
  
  document.querySelector(".close-modal").onclick = function() {
    modal.style.display = "none";
  }
  
  document.getElementById("cancelOrderBtn").onclick = function() {
    modal.style.display = "none";
  }
  
  document.getElementById("confirmOrderBtn").onclick = function() {
    // Save to Firebase before sending WhatsApp
    db.collection("orders").add(orderData)
      .then((docRef) => {
        console.log("Order saved with ID: ", docRef.id);
        modal.style.display = "none";
        sendWhatsAppOrder(name, phone, orderType, subtotal, deliveryCharge, total);
      })
      .catch((error) => {
        console.error("Error adding order: ", error);
        alert("There was an error saving your order. Please try again.");
      });
  }
  
  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  }
}

function generatePDFBill(orderDetails) {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text('Bake & Grill', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text('Delicious food delivered to your doorstep', 105, 28, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setTextColor(214, 40, 40);
  doc.text('ORDER RECEIPT', 105, 40, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text(`Order #: ${Math.floor(100000 + Math.random() * 900000)}`, 15, 50);
  doc.text(`Date: ${new Date().toLocaleString()}`, 15, 58);
  doc.text(`Customer: ${orderDetails.name}`, 15, 66);
  doc.text(`Phone: ${orderDetails.phone}`, 15, 74);
  doc.text(`Order Type: ${orderDetails.orderType}`, 15, 82);
  
  if (orderDetails.orderType === 'Delivery') {
    if (orderDetails.userLocation) {
      doc.text(`Location: ${orderDetails.userLocation.lat}, ${orderDetails.userLocation.lng}`, 15, 90);
    }
    doc.text(`Distance: ${orderDetails.distance}`, 15, 98);
    doc.text(`Est. Delivery: ${calculateDeliveryTime(orderDetails.distance)}`, 15, 106);
  }
  
  doc.autoTable({
    startY: 120,
    head: [['#', 'Item', 'Variant', 'Price (₹)']],
    body: orderDetails.items.map((item, index) => [
      index + 1,
      item.name,
      item.variant,
      item.price
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: [214, 40, 40],
      textColor: [255, 255, 255]
    }
  });
  
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.text(`Subtotal: ₹${orderDetails.subtotal}`, 140, finalY);
  
  if (orderDetails.deliveryCharge > 0) {
    doc.text(`Delivery Charge: ₹${orderDetails.deliveryCharge}`, 140, finalY + 8);
  } else if (orderDetails.orderType === 'Delivery') {
    doc.text(`Delivery Charge: Free`, 140, finalY + 8);
  }
  
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`Total Amount: ₹${orderDetails.total}`, 140, finalY + 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your order!', 105, 280, { align: 'center' });
  doc.text('For any queries, contact: +91 8240266267', 105, 285, { align: 'center' });
  
  doc.save(`BakeAndGrill_Order_${orderDetails.name}.pdf`);
}

function sendWhatsAppOrder(name, phone, orderType, subtotal, deliveryCharge, total) {
  let orderDetails = "";
  selectedItems.forEach((item, index) => {
    orderDetails += `${index + 1}. ${item.name} (${item.variant}) - ₹${item.price}\n`;
  });

  orderDetails += `\nSubtotal: ₹${subtotal}`;
  if (deliveryCharge > 0) {
    orderDetails += `\nDelivery Charge: ₹${deliveryCharge}`;
  } else if (orderType === 'Delivery') {
    orderDetails += `\nDelivery Charge: Free`;
  }
  orderDetails += `\nTotal: ₹${total}`;

  if (orderType === "Delivery") {
    if (isManualLocation) {
      const address = document.getElementById('manualAddress').value;
      orderDetails += `\n\n📍 Delivery Address:\n${address}`;
      orderDetails += `\n📏 Estimated Distance: ${deliveryDistance.toFixed(1)}km`;
    } else if (userLocation) {
      const mapsLink = `https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}`;
      orderDetails += `\n\n📍 Delivery Location:\n${mapsLink}`;
      orderDetails += `\n📏 Distance: ${deliveryDistance.toFixed(1)}km`;
    }
    
    const estimatedTime = calculateDeliveryTime(deliveryDistance);
    const travelTime = Math.round(deliveryDistance * 8);
    orderDetails += `\n⏳ Estimated Delivery: ${estimatedTime}`;
    orderDetails += `\n   (20 min preparation + ${travelTime} min travel)`;
  }

  const message = `🍽 *New ${orderType} Order from Bake & Grill*\n\n👤 Name: ${name}\n📞 Phone: ${phone}\n\n📦 Order Details:\n${orderDetails}`;
  const whatsappURL = `https://wa.me/918240266267?text=${encodeURIComponent(message)}`;
  window.open(whatsappURL, '_blank');
  
  const pdfOrderDetails = {
    name,
    phone,
    orderType,
    userLocation,
    distance: deliveryDistance ? deliveryDistance.toFixed(1)+'km' : 'Unknown',
    items: selectedItems,
    subtotal,
    deliveryCharge,
    total
  };
  
  document.getElementById('downloadBillBtn').style.display = 'block';
  document.getElementById('downloadBillBtn').onclick = function() {
    generatePDFBill(pdfOrderDetails);
  };
  
  selectedItems.length = 0;
  updateCart();
  document.getElementById("customerName").value = "";
  document.getElementById("phoneNumber").value = "";
}