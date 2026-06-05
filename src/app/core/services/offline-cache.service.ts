import { Injectable } from '@angular/core';

interface CacheStore {
  name: string;
  version: number;
}

@Injectable({ providedIn: 'root' })
export class OfflineCacheService {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'mecanicoya_offline';
  private readonly DB_VERSION = 2;

  private readonly STORES: CacheStore[] = [
    { name: 'incidents', version: 1 },
    { name: 'profile', version: 1 },
    { name: 'vehicles', version: 1 },
    { name: 'workshops', version: 1 },
    { name: 'notifications', version: 1 },
    { name: 'evidence_pending', version: 1 },
    { name: 'api_cache', version: 1 },
  ];

  async init(): Promise<void> {
    if (!('indexedDB' in window)) {
      console.warn('[OfflineCache] IndexedDB not available');
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        for (const store of this.STORES) {
          if (!db.objectStoreNames.contains(store.name)) {
            db.createObjectStore(store.name, { keyPath: 'id' });
          }
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        console.log('[OfflineCache] IndexedDB initialized');
        resolve();
      };

      request.onerror = (event) => {
        console.error('[OfflineCache] IndexedDB error:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  async get<T>(storeName: string, id: string): Promise<T | null> {
    if (!this.db) await this.init();
    if (!this.db) return null;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result?.data ?? null);
      request.onerror = () => resolve(null);
    });
  }

  async put(storeName: string, id: string, data: unknown): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put({ id, data, updatedAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    return new Promise((resolve) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () =>
        resolve((request.result as any[]).map((item) => item.data));
      request.onerror = () => resolve([]);
    });
  }

  async remove(storeName: string, id: string): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
    });
  }

  async clearStore(storeName: string): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
    });
  }

  async clearAll(): Promise<void> {
    for (const store of this.STORES) {
      await this.clearStore(store.name);
    }
  }
}
