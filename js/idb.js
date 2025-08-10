// idb.js - IndexedDB wrapper for cart storage
function openDB(name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    
    request.onerror = (event) => {
      console.error('IDB error:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('cart')) {
        db.createObjectStore('cart');
      }
      if (!db.objectStoreNames.contains('pendingOrders')) {
        db.createObjectStore('pendingOrders', { keyPath: 'id' });
      }
    };
  });
}

export async function getCartFromIDB() {
  try {
    const db = await openDB('cartStore', 1);
    return await new Promise((resolve) => {
      const tx = db.transaction('cart', 'readonly');
      const store = tx.objectStore('cart');
      const request = store.get('current');
      request.onsuccess = () => resolve(request.result || []);
    });
  } catch (error) {
    console.error('IDB get error:', error);
    return [];
  }
}

export async function saveCartToIDB(items) {
  try {
    const db = await openDB('cartStore', 1);
    await new Promise((resolve, reject) => {
      const tx = db.transaction('cart', 'readwrite');
      const store = tx.objectStore('cart');
      const request = store.put(items, 'current');
      request.onsuccess = resolve;
      request.onerror = reject;
    });
  } catch (error) {
    console.error('IDB save error:', error);
    throw error;
  }
}