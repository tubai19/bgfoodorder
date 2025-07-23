import { db } from './firebase-config.js';

export const saveOrder = async (orderData) => {
  try {
    const docRef = await db.collection("orders").add(orderData);
    return docRef.id;
  } catch (error) {
    console.error("Error saving order: ", error);
    throw error;
  }
};

export const getOrder = async (orderId) => {
  try {
    const doc = await db.collection("orders").doc(orderId).get();
    if (doc.exists) {
      return doc.data();
    } else {
      throw new Error("Order not found");
    }
  } catch (error) {
    console.error("Error getting order: ", error);
    throw error;
  }
};

export const updateOrderStatus = async (orderId, status) => {
  try {
    await db.collection("orders").doc(orderId).update({ status });
  } catch (error) {
    console.error("Error updating order status: ", error);
    throw error;
  }
};