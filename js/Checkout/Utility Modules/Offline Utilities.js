export async function saveOrderForLater(orderData) {
  try {
    const db = await openDB('offlineOrders', 1, {
      upgrade(db) {
        db.createObjectStore('orders', { keyPath: 'timestamp' });
      }
    });
    
    const orderWithTimestamp = {
      ...orderData,
      timestamp: new Date().getTime()
    };
    
    await db.add('orders', orderWithTimestamp);
    return true;
  } catch (error) {
    console.error('Error saving offline order:', error);
    return false;
  }
}

async function openDB(name, version, upgradeCallback) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      upgradeCallback(event.target.result, event.oldVersion, event.newVersion);
    };
  });
}