import { AppState } from '../main.js';

export async function calculateRoadDistance(originLat, originLng, destLat, destLng) {
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`
    );
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].distance / 1000;
    } else {
      return calculateHaversineDistance(originLat, originLng, destLat, destLng);
    }
  } catch (error) {
    console.error("Error calculating road distance:", error);
    return calculateHaversineDistance(originLat, originLng, destLat, destLng);
  }
}

export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}