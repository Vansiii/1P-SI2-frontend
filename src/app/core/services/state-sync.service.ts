import { Injectable, inject, DestroyRef, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WebSocketService } from './websocket.service';
import { environment } from '../../../environments/environment';
import { Subject, firstValueFrom } from 'rxjs';

/**
 * State cache entry
 */
interface StateCacheEntry<T> {
  data: T;
  timestamp: string;
  version: number;
  ttl: number; // Time to live in milliseconds
}

/**
 * Optimistic update
 */
interface OptimisticUpdate<T> {
  id: string;
  entityType: string;
  entityId: string | number;
  originalState: T;
  newState: T;
  timestamp: string;
  applied: boolean;
}

/**
 * State conflict
 */
interface StateConflict<T> {
  entityType: string;
  entityId: string | number;
  localState: T;
  serverState: T;
  timestamp: string;
  resolved: boolean;
}

/**
 * Sync status
 */
export type SyncStatus = 'synced' | 'syncing' | 'conflict' | 'error';

/**
 * State Synchronization Service
 * 
 * Manages state synchronization between frontend and backend.
 * Provides caching, optimistic updates, conflict resolution, and state versioning.
 */
@Injectable({
  providedIn: 'root'
})
export class StateSyncService {
  private readonly http = inject(HttpClient);
  private readonly webSocketService = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  // State cache
  private readonly stateCache = new Map<string, StateCacheEntry<any>>();
  private readonly defaultTTL = 300000; // 5 minutes

  // Optimistic updates
  private readonly optimisticUpdates = new Map<string, OptimisticUpdate<any>>();

  // State conflicts
  private readonly conflicts: StateConflict<any>[] = [];

  // Sync status signal
  readonly syncStatus = signal<SyncStatus>('synced');

  // Conflict stream
  private readonly conflictSubject = new Subject<StateConflict<any>>();
  readonly conflict$ = this.conflictSubject.asObservable();

  // Sync event stream
  private readonly syncEventSubject = new Subject<{ type: string; data: any }>();
  readonly syncEvent$ = this.syncEventSubject.asObservable();

  constructor() {
    this.setupConnectionMonitoring();

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  /**
   * Setup connection monitoring
   */
  private setupConnectionMonitoring(): void {
    this.webSocketService.connectionStatus$.subscribe(status => {
      if (status === 'connected') {
        this.handleReconnection();
      }
    });
  }

  /**
   * Handle reconnection - reconcile state
   */
  private async handleReconnection(): Promise<void> {
    console.log('🔄 Reconciling state after reconnection');
    this.syncStatus.set('syncing');

    try {
      // Validate cached state
      await this.validateCachedState();

      // Apply pending optimistic updates
      await this.applyPendingUpdates();

      this.syncStatus.set('synced');
      console.log('✅ State reconciliation complete');
    } catch (error) {
      console.error('❌ State reconciliation failed:', error);
      this.syncStatus.set('error');
    }
  }

  /**
   * Get cached state
   */
  getCachedState<T>(key: string): T | null {
    const entry = this.stateCache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    const entryTime = new Date(entry.timestamp).getTime();
    
    if (now - entryTime > entry.ttl) {
      console.log('⏰ Cache expired for key:', key);
      this.stateCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached state
   */
  setCachedState<T>(
    key: string,
    data: T,
    ttl: number = this.defaultTTL,
    version = 1
  ): void {
    const entry: StateCacheEntry<T> = {
      data,
      timestamp: new Date().toISOString(),
      version,
      ttl
    };

    this.stateCache.set(key, entry);
    console.log('💾 State cached:', key);
  }

  /**
   * Invalidate cache entry
   */
  invalidateCache(key: string): void {
    this.stateCache.delete(key);
    console.log('🗑️ Cache invalidated:', key);
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.stateCache.clear();
    console.log('🧹 All cache cleared');
  }

  /**
   * Apply optimistic update
   */
  applyOptimisticUpdate<T>(
    entityType: string,
    entityId: string | number,
    originalState: T,
    newState: T
  ): string {
    const updateId = this.generateUpdateId();

    const update: OptimisticUpdate<T> = {
      id: updateId,
      entityType,
      entityId,
      originalState,
      newState,
      timestamp: new Date().toISOString(),
      applied: true
    };

    this.optimisticUpdates.set(updateId, update);

    // Update cache with optimistic state
    const cacheKey = `${entityType}_${entityId}`;
    this.setCachedState(cacheKey, newState);

    console.log('⚡ Optimistic update applied:', updateId);

    return updateId;
  }

  /**
   * Confirm optimistic update
   */
  confirmOptimisticUpdate(updateId: string): void {
    const update = this.optimisticUpdates.get(updateId);
    
    if (update) {
      this.optimisticUpdates.delete(updateId);
      console.log('✅ Optimistic update confirmed:', updateId);
      
      this.syncEventSubject.next({
        type: 'update_confirmed',
        data: { updateId, entityType: update.entityType, entityId: update.entityId }
      });
    }
  }

  /**
   * Rollback optimistic update
   */
  rollbackOptimisticUpdate(updateId: string): void {
    const update = this.optimisticUpdates.get(updateId);
    
    if (update) {
      // Restore original state in cache
      const cacheKey = `${update.entityType}_${update.entityId}`;
      this.setCachedState(cacheKey, update.originalState);

      this.optimisticUpdates.delete(updateId);
      console.log('↩️ Optimistic update rolled back:', updateId);

      this.syncEventSubject.next({
        type: 'update_rolled_back',
        data: { updateId, entityType: update.entityType, entityId: update.entityId }
      });
    }
  }

  /**
   * Detect state conflict
   */
  detectConflict<T>(
    entityType: string,
    entityId: string | number,
    localState: T,
    serverState: T
  ): boolean {
    // Simple conflict detection - compare JSON strings
    const localJson = JSON.stringify(localState);
    const serverJson = JSON.stringify(serverState);

    if (localJson !== serverJson) {
      const conflict: StateConflict<T> = {
        entityType,
        entityId,
        localState,
        serverState,
        timestamp: new Date().toISOString(),
        resolved: false
      };

      this.conflicts.push(conflict);
      this.conflictSubject.next(conflict);
      this.syncStatus.set('conflict');

      console.warn('⚠️ State conflict detected:', conflict);
      return true;
    }

    return false;
  }

  /**
   * Resolve conflict - use server state
   */
  resolveConflictWithServer<T>(
    entityType: string,
    entityId: string | number
  ): void {
    const conflict = this.conflicts.find(
      c => c.entityType === entityType && c.entityId === entityId && !c.resolved
    );

    if (conflict) {
      // Update cache with server state
      const cacheKey = `${entityType}_${entityId}`;
      this.setCachedState(cacheKey, conflict.serverState);

      conflict.resolved = true;
      console.log('✅ Conflict resolved with server state:', entityType, entityId);

      this.checkSyncStatus();
    }
  }

  /**
   * Resolve conflict - use local state
   */
  resolveConflictWithLocal<T>(
    entityType: string,
    entityId: string | number
  ): void {
    const conflict = this.conflicts.find(
      c => c.entityType === entityType && c.entityId === entityId && !c.resolved
    );

    if (conflict) {
      // Keep local state in cache
      conflict.resolved = true;
      console.log('✅ Conflict resolved with local state:', entityType, entityId);

      this.checkSyncStatus();
    }
  }

  /**
   * Check sync status
   */
  private checkSyncStatus(): void {
    const unresolvedConflicts = this.conflicts.filter(c => !c.resolved);
    
    if (unresolvedConflicts.length === 0) {
      this.syncStatus.set('synced');
    }
  }

  /**
   * Validate cached state against server
   */
  private async validateCachedState(): Promise<void> {
    const validationPromises: Promise<void>[] = [];

    this.stateCache.forEach((entry, key) => {
      const [entityType, entityId] = key.split('_');
      
      const promise = this.fetchServerState(entityType, entityId)
        .then(serverState => {
          if (serverState) {
            this.detectConflict(entityType, entityId, entry.data, serverState);
          }
        })
        .catch(error => {
          console.error(`❌ Failed to validate state for ${key}:`, error);
        });

      validationPromises.push(promise);
    });

    await Promise.all(validationPromises);
  }

  /**
   * Fetch server state
   */
  private async fetchServerState(
    entityType: string,
    entityId: string | number
  ): Promise<any> {
    try {
      const url = `${environment.apiUrl}/${entityType}/${entityId}`;
      const response = await firstValueFrom(this.http.get<any>(url));
      return response.data || response;
    } catch (error) {
      console.error(`❌ Failed to fetch server state for ${entityType}/${entityId}:`, error);
      return null;
    }
  }

  /**
   * Apply pending optimistic updates
   */
  private async applyPendingUpdates(): Promise<void> {
    const pendingUpdates = Array.from(this.optimisticUpdates.values());

    for (const update of pendingUpdates) {
      try {
        // Attempt to sync with server
        await this.syncUpdateWithServer(update);
        this.confirmOptimisticUpdate(update.id);
      } catch (error) {
        console.error('❌ Failed to apply pending update:', update.id, error);
        this.rollbackOptimisticUpdate(update.id);
      }
    }
  }

  /**
   * Sync update with server
   */
  private async syncUpdateWithServer(update: OptimisticUpdate<any>): Promise<void> {
    const url = `${environment.apiUrl}/${update.entityType}/${update.entityId}`;
    await firstValueFrom(this.http.patch(url, update.newState));
  }

  /**
   * Get state version
   */
  getStateVersion(key: string): number | null {
    const entry = this.stateCache.get(key);
    return entry?.version || null;
  }

  /**
   * Increment state version
   */
  incrementStateVersion(key: string): void {
    const entry = this.stateCache.get(key);
    if (entry) {
      entry.version++;
      console.log(`📈 State version incremented for ${key}: v${entry.version}`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics() {
    return {
      size: this.stateCache.size,
      optimisticUpdates: this.optimisticUpdates.size,
      conflicts: this.conflicts.filter(c => !c.resolved).length,
      syncStatus: this.syncStatus()
    };
  }

  /**
   * Get all conflicts
   */
  getConflicts(): StateConflict<any>[] {
    return this.conflicts.filter(c => !c.resolved);
  }

  /**
   * Generate unique update ID
   */
  private generateUpdateId(): string {
    return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stateCache.clear();
    this.optimisticUpdates.clear();
    this.conflicts.length = 0;

    this.conflictSubject.complete();
    this.syncEventSubject.complete();

    console.log('🧹 StateSyncService cleaned up');
  }
}
