import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export type SyncEntityStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

@Injectable({ providedIn: 'root' })
export class SyncStatusService {
  readonly pendingCount = signal<number>(0);
  readonly isSyncing = signal<boolean>(false);
  readonly lastSyncAt = signal<string | null>(null);
  readonly lastError = signal<string | null>(null);
  readonly lastSuccessfulCount = signal<number>(0);

  readonly syncEvent$ = new Subject<{
    type: 'sync_start' | 'sync_complete' | 'sync_failed' | 'conflict_detected';
    data?: unknown;
  }>();

  private entityStatuses = new Map<string, SyncEntityStatus>();

  setPending(count: number): void {
    this.pendingCount.set(count);
    if (count > 0) {
      this.lastError.set(null);
      this.lastSyncAt.set(null);
    }
  }

  setSyncing(value: boolean): void {
    this.isSyncing.set(value);
    if (value) {
      this.lastError.set(null);
      this.syncEvent$.next({ type: 'sync_start' });
    }
  }

  setSyncComplete(successCount: number): void {
    this.isSyncing.set(false);
    this.lastSuccessfulCount.set(successCount);
    this.lastSyncAt.set(new Date().toISOString());
    this.lastError.set(null);
    this.syncEvent$.next({ type: 'sync_complete', data: { count: successCount } });
  }

  setSyncFailed(error: string): void {
    this.isSyncing.set(false);
    this.lastSuccessfulCount.set(0);
    this.lastError.set(error);
    this.syncEvent$.next({ type: 'sync_failed', data: { error } });
  }

  setConflictDetected(count: number): void {
    this.syncEvent$.next({ type: 'conflict_detected', data: { count } });
  }

  getEntityStatus(key: string): SyncEntityStatus {
    return this.entityStatuses.get(key) ?? 'synced';
  }

  setEntityStatus(key: string, status: SyncEntityStatus): void {
    this.entityStatuses.set(key, status);
  }

  isEntityPending(key: string): boolean {
    const status = this.entityStatuses.get(key);
    return status === 'pending' || status === 'syncing';
  }
}
