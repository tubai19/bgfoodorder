// idb.js - Universal IndexedDB wrapper
(function(global) {
  'use strict';

  const DB_NAME = 'bakeAndGrillDB';
  const DB_VERSION = 3;
  const STORES = {
    CART: 'cart',
    PENDING_ORDERS: 'pendingOrders',
    ERROR_LOGS: 'errorLogs'
  };

  class IDBWrapper {
    constructor() {
      this.db = null;
    }

    async init() {
      if (this.db) return this.db;
      
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
          console.error('IDB Error:', event.target.error);
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          resolve(this.db);
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORES.CART)) {
            db.createObjectStore(STORES.CART);
          }
          if (!db.objectStoreNames.contains(STORES.PENDING_ORDERS)) {
            const store = db.createObjectStore(STORES.PENDING_ORDERS, { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORES.ERROR_LOGS)) {
            db.createObjectStore(STORES.ERROR_LOGS, { autoIncrement: true });
          }
        };
      });
    }

    async getCart() {
      await this.init();
      return this._get(STORES.CART, 'current');
    }

    async saveCart(items) {
      await this.init();
      return this._put(STORES.CART, 'current', items);
    }

    async logError(error) {
      await this.init();
      return this._add(STORES.ERROR_LOGS, error);
    }

    async _get(storeName, key) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (event) => reject(event.target.error);
      });
    }

    async _put(storeName, key, value) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(value, key);
        
        request.onsuccess = resolve;
        request.onerror = (event) => reject(event.target.error);
      });
    }

    async _add(storeName, value) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.add(value);
        
        request.onsuccess = resolve;
        request.onerror = (event) => reject(event.target.error);
      });
    }
  }

  // Singleton instance
  const idb = new IDBWrapper();

  // Export based on environment
  if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
    module.exports = idb;
  } else if (typeof define === 'function' && define.amd) {
    define([], () => idb);
  } else {
    global.idb = idb;
  }
})(typeof self !== 'undefined' ? self : this);