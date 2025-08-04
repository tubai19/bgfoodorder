import { AppState } from '../main.js';

export function calculateDeliveryChargeByDistance(distance) {
  if (distance <= 2) return 20;
  if (distance <= 5) return 30;
  if (distance <= 8) return 50;
  if (distance <= AppState.MAX_DELIVERY_DISTANCE) return 80;
  return null; // Beyond delivery range
}