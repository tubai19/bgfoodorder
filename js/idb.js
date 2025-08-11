// idb.js - Universal IndexedDB wrapper with improved error handling
(function(global) {
  'use strict';

  const DB_NAME = 'bakeAndGrillDB';
  const DB_VERSION = 4; // Incremented version
  const STORES = {
    CART: 'cart',
    PENDING_ORDERS: 'pendingOrders',
    ERROR_LOGS: 'errorLogs',
    MENU_CACHE: 'menuCache'
  };

  class IDBWrapper {
    constructor() {
      this.db = null;
      this.isSupported = this.checkIDBSupport();
    }

    checkIDBSupport() {
      try {
        if (!('indexedDB' in window)) return false;
        // Test opening a dummy database to verify support
        const testDB = indexedDB.open('testDB');
        testDB.onerror = () => false;
        return true;
      } catch (e) {
        return false;
      }
    }

    async init() {
      if (!this.isSupported) {
        throw new Error('IndexedDB not supported in this browser');
      }
      
      if (this.db) return this.db;
      
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
          console.error('IDB Error:', event.target.error);
          // Try to delete and recreate if there's a version error
          if (event.target.error.name === 'VersionError') {
            console.log('Attempting to recreate database...');
            indexedDB.deleteDatabase(DB_NAME)
              .then(() => this.init().then(resolve).catch(reject))
              .catch(reject);
          } else {
            reject(event.target.error);
          }
        };

        request.onblocked = (event) => {
          console.error('IDB Blocked:', event);
          reject(new Error('Database access blocked'));
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          
          // Handle database closure
          this.db.onerror = (event) => {
            console.error('Database error:', event.target.error);
          };
          
          this.db.onversionchange = () => {
            this.db.close();
            console.log('Database is outdated, closing connection');
          };
          
          resolve(this.db);
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          try {
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
            if (!db.objectStoreNames.contains(STORES.MENU_CACHE)) {
              db.createObjectStore(STORES.MENU_CACHE);
            }
          } catch (e) {
            console.error('Upgrade error:', e);
            reject(e);
          }
        };
      });
    }

    async getCart() {
      try {
        await this.init();
        return this._get(STORES.CART, 'current');
      } catch (error) {
        console.error('Failed to get cart from IDB:', error);
        return [];
      }
    }

    async saveCart(items) {
      try {
        await this.init();
        return this._put(STORES.CART, 'current', items);
      } catch (error) {
        console.error('Failed to save cart to IDB:', error);
        throw error;
      }
    }

    async getMenu() {
      try {
        await this.init();
        return this._get(STORES.MENU_CACHE, 'fullMenu');
      } catch (error) {
        console.error('Failed to get menu from IDB:', error);
        return null;
      }
    }

    async saveMenu(menuData) {
      try {
        await this.init();
        return this._put(STORES.MENU_CACHE, 'fullMenu', menuData);
      } catch (error) {
        console.error('Failed to save menu to IDB:', error);
        throw error;
      }
    }

    async logError(error) {
      try {
        await this.init();
        return this._add(STORES.ERROR_LOGS, error);
      } catch (error) {
        console.error('Failed to log error to IDB:', error);
        throw error;
      }
    }

    async clearDatabase() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = resolve;
        request.onerror = reject;
        request.onblocked = () => reject(new Error('Database deletion blocked'));
      });
    }

    async _get(storeName, key) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = (event) => reject(event.target.error);
      });
    }

    async _put(storeName, key, value) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(value, key);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
      });
    }

    async _add(storeName, value) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.add(value);
        
        request.onsuccess = () => resolve(request.result);
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