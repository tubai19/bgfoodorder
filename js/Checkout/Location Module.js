import L from 'leaflet';
import 'leaflet-control-geocoder';
import { AppState } from '../main.js';
import { calculateRoadDistance, calculateHaversineDistance } from '../utils/distance.js';
import { updateCheckoutDisplay, checkDeliveryRestriction } from './display.js';
import { showNotification } from '../main.js';

let map;
let marker;

export function handleLocationSharing() {
  const currentLocStatusMsg = document.getElementById('currentLocStatusMsg');
  const deliveryShowManualLocBtn = document.getElementById('deliveryShowManualLocBtn');
  const distanceText = document.getElementById('distanceText');
  
  if (!navigator.geolocation) {
    currentLocStatusMsg.style.color = "#e63946";
    currentLocStatusMsg.textContent = "Geolocation is not supported by your browser.";
    deliveryShowManualLocBtn.style.display = 'block';
    return;
  }
  
  currentLocStatusMsg.style.color = "#333";
  currentLocStatusMsg.textContent = "Detecting your current location...";
  distanceText.textContent = "Distance: Calculating...";
  document.getElementById('deliveryDistanceDisplay').style.display = 'block';
  
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      AppState.locationObj = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      currentLocStatusMsg.style.color = "#2a9d8f";
      currentLocStatusMsg.textContent = `Location received!`;
      deliveryShowManualLocBtn.style.display = 'none';
      document.getElementById('manualLocationFields').style.display = 'none';
      AppState.usingManualLoc = false;
      
      calculateRoadDistance(pos.coords.latitude, pos.coords.longitude, AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng)
        .then(distance => {
          AppState.deliveryDistance = distance;
          distanceText.textContent = `Distance: ${distance.toFixed(1)} km`;
          updateCheckoutDisplay();
          checkDeliveryRestriction();
        });
    },
    (err) => {
      currentLocStatusMsg.style.color = "#e63946";
      currentLocStatusMsg.textContent = "Unable to get your location. Please allow location access or enter manually.";
      deliveryShowManualLocBtn.style.display = 'block';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

export function showManualLocationFields() {
  AppState.usingManualLoc = true;
  const manualLocationFields = document.getElementById('manualLocationFields');
  manualLocationFields.style.display = 'block';
  document.getElementById('currentLocStatusMsg').textContent = '';
  document.getElementById('distanceText').textContent = "Distance: Calculating...";
  document.getElementById('deliveryDistanceDisplay').style.display = 'block';
  
  if (!map) {
    initMap();
  } else {
    map.setView([AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng], 14);
    marker.setLatLng([AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng]);
  }
  
  const manualDeliveryAddress = document.getElementById('manualDeliveryAddress');
  if (manualDeliveryAddress) manualDeliveryAddress.focus();
}

function initMap() {
  map = L.map('addressMap').setView([AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Restaurant marker
  L.marker([AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng], {
    icon: L.divIcon({
      html: '<i class="fas fa-store" style="color: #e63946; font-size: 24px;"></i>',
      className: 'restaurant-marker'
    })
  }).addTo(map).bindPopup("Bake & Grill");

  // Customer marker
  marker = L.marker([AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng], {
    draggable: true,
    autoPan: true,
    icon: L.divIcon({
      html: '<i class="fas fa-map-marker-alt" style="color: #9d4edf; font-size: 32px;"></i>',
      className: 'customer-marker'
    })
  }).addTo(map);

  const geocoder = L.Control.geocoder({
    defaultMarkGeocode: false,
    position: 'topright',
    placeholder: 'Search location...',
    errorMessage: 'Location not found',
    showResultIcons: true,
    collapsed: false,
    suggestTimeout: 250,
    queryMinLength: 3,
    geocodingQueryParams: {
      countrycodes: 'in',
      bounded: 1,
      viewbox: '88.0,22.2,88.5,22.6'
    }
  }).addTo(map);

  geocoder.on('markgeocode', function(e) {
    map.setView(e.geocode.center, 17);
    marker.setLatLng(e.geocode.center);
    updateLocationFromMarker();
    const manualDeliveryAddress = document.getElementById('manualDeliveryAddress');
    if (manualDeliveryAddress) manualDeliveryAddress.value = e.geocode.name;
    showNotification('Location found!');
  });

  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    updateLocationFromMarker();
  });

  marker.on('dragend', function() {
    updateLocationFromMarker();
  });

  const manualDeliveryAddress = document.getElementById('manualDeliveryAddress');
  if (manualDeliveryAddress) {
    manualDeliveryAddress.addEventListener('input', function() {
      const query = this.value.trim();
      if (query.length >= 3) {
        searchAddress(query);
      }
    });
  }
}

function updateLocationFromMarker() {
  const position = marker.getLatLng();
  AppState.locationObj = { lat: position.lat, lng: position.lng };
  
  document.getElementById('distanceText').textContent = "Distance: Calculating...";
  document.getElementById('deliveryDistanceDisplay').style.display = 'block';
  
  calculateRoadDistance(position.lat, position.lng, AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng)
    .then(distance => {
      AppState.deliveryDistance = distance;
      document.getElementById('distanceText').textContent = `Distance: ${distance.toFixed(1)} km`;
      updateCheckoutDisplay();
      checkDeliveryRestriction();
    })
    .catch(error => {
      console.error("Error calculating distance:", error);
      AppState.deliveryDistance = calculateHaversineDistance(position.lat, position.lng, AppState.RESTAURANT_LOCATION.lat, AppState.RESTAURANT_LOCATION.lng);
      document.getElementById('distanceText').textContent = `Distance: ${AppState.deliveryDistance.toFixed(1)} km (straight line)`;
      updateCheckoutDisplay();
      checkDeliveryRestriction();
    });
}

function searchAddress(query) {
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5`)
    .then(response => response.json())
    .then(data => {
      if (data.length > 0) {
        const firstResult = data[0];
        const lat = parseFloat(firstResult.lat);
        const lon = parseFloat(firstResult.lon);
        
        map.setView([lat, lon], 17);
        marker.setLatLng([lat, lon]);
        updateLocationFromMarker();
      }
    })
    .catch(error => {
      console.error("Error searching address:", error);
    });
}