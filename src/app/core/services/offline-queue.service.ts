import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConnectivityService } from './connectivity.service';
import { SyncStatusService } from './sync-status.service';

export interface QueueOperation {
  id: string;
  client_operation_id: string;
  type: string;
  endpoint: string;
  method: string;
  body: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

export interface SyncResult {
  client_operation_id: string;
  id?: string;
  status: string;
  success: boolean;
  status_code?: number;
  error?: string;
  data?: Record<string, unknown>;
  conflict_code?: string;
  message?: string;
  retryable?: boolean;
  server_entity_id?: number;
}

export interface SyncResponse {
  total: number;
  successful: number;
  failed: number;
  conflicts?: number;
  results: SyncResult[];
}

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly http = inject(HttpClient);
  private readonly connectivity = inject(ConnectivityService);
  private readonly syncStatus = inject(SyncStatusService);

  private readonly STORAGE_KEY = 'offline_queue';
  private readonly MAX_QUEUE = 50;
  private readonly MAX_AGE_DAYS = 7;
  private isProcessing = false;

  readonly queueSize = signal(0);

  private _connectSub: any;

  constructor() {
    this._connectSub = this.connectivity.onlineChange$.subscribe((online) => {
      if (online) {
        this.isProcessing = false;
        void this.processQueue();
      }
    });

    window.addEventListener('online', () => {
      this.isProcessing = false;
      void this.processQueue();
    });

    void this._refreshSize();
    setTimeout(() => { if (navigator.onLine) void this.processQueue(); }, 500);
  }

  async add(
    operation: Omit<QueueOperation, 'id' | 'client_operation_id' | 'timestamp' | 'retries'>
  ): Promise<string> {
    const queue = await this._load();
    if (queue.length >= this.MAX_QUEUE) queue.shift();

    const op: QueueOperation = {
      ...operation,
      id: this._generateId(),
      client_operation_id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0,
    };
    queue.push(op);

    const ok = this._save(queue);
    if (ok) {
      this.syncStatus.setPending(queue.length);
      this.queueSize.set(queue.length);
      console.log(`[OfflineQueue] Queued: ${operation.type} (${queue.length}/${this.MAX_QUEUE})`);
    } else {
      console.error('[OfflineQueue] FAILED to save operation — storage may be full');
    }
    return op.client_operation_id;
  }

  async getQueue(): Promise<QueueOperation[]> {
    return this._load();
  }

  async clear(): Promise<void> {
    try { localStorage.removeItem(this.STORAGE_KEY); } catch { /* ignore */ }
    this.queueSize.set(0);
    this.syncStatus.setPending(0);
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('[OfflineQueue] Already processing, skipping');
      return;
    }
    if (!this.connectivity.online) {
      console.log('[OfflineQueue] Offline, skipping');
      return;
    }

    const queue = await this._load();
    if (queue.length === 0) {
      this.queueSize.set(0);
      this.syncStatus.setPending(0);
      return;
    }

    this.isProcessing = true;
    this.syncStatus.setSyncing(true);
    console.log(`[OfflineQueue] Processing ${queue.length} operations...`);

    try {
      const response = await firstValueFrom(
        this.http.post<SyncResponse>(`${environment.apiUrl}/sync/batch`, {
          client_request_id: crypto.randomUUID(),
          app_platform: 'web',
          app_version: environment.appVersion,
          operations: queue.map((op) => ({
            id: op.id,
            client_operation_id: op.client_operation_id,
            type: op.type,
            endpoint: op.endpoint,
            method: op.method,
            body: op.body,
            timestamp: op.timestamp,
            retries: op.retries,
          })),
        })
      );

      console.log(`[OfflineQueue] Server response: ok=${response.successful} fail=${response.failed} conflicts=${response.conflicts ?? 0}`);

      const failedIds = new Set(
        response.results
          .filter((r) => !r.success && r.retryable !== false)
          .map((r) => r.client_operation_id)
      );

      const discarded = response.results.filter((r) => !r.success && r.retryable === false);
      if (discarded.length > 0) {
        console.log(`[OfflineQueue] Discarding ${discarded.length} non-retryable operations:`,
          discarded.map((r) => ({ id: r.client_operation_id, code: r.conflict_code, msg: r.message })));
      }

      const remaining = queue
        .filter((op) => failedIds.has(op.client_operation_id))
        .map((op) => ({ ...op, retries: op.retries + 1 }));

      this._save(remaining);
      this.queueSize.set(remaining.length);
      this.syncStatus.setPending(remaining.length);
      this.syncStatus.setSyncComplete(response.successful);

      const conflictCount = response.conflicts ?? response.results.filter(
        (r) => r.conflict_code != null
      ).length;
      if (conflictCount > 0) {
        this.syncStatus.setConflictDetected(conflictCount);
      }
    } catch (err) {
      console.error('[OfflineQueue] Batch request failed:', err);
      const retried = queue.map((op) => ({ ...op, retries: op.retries + 1 }));
      this._save(retried);
      this.syncStatus.setSyncFailed('No se pudo sincronizar. Se reintentara al recuperar conexion.');
    } finally {
      this.isProcessing = false;
      this.queueSize.set((await this._load()).length);
    }
  }

  isOnline(): boolean {
    return this.connectivity.online;
  }

  // ── helpers ──

  private async _load(): Promise<QueueOperation[]> {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        console.warn('[OfflineQueue] Corrupt data, resetting');
        localStorage.removeItem(this.STORAGE_KEY);
        return [];
      }
      const maxAge = Date.now() - this.MAX_AGE_DAYS * 86400000;
      return (parsed as QueueOperation[]).filter((op) => op.timestamp > maxAge);
    } catch (err) {
      console.error('[OfflineQueue] Load error, resetting:', err);
      try { localStorage.removeItem(this.STORAGE_KEY); } catch { /* ignore */ }
      return [];
    }
  }

  private _save(queue: QueueOperation[]): boolean {
    try {
      const json = JSON.stringify(queue);
      localStorage.setItem(this.STORAGE_KEY, json);
      return true;
    } catch (err) {
      console.error('[OfflineQueue] Save failed (quota/storage error):', err);
      return false;
    }
  }

  private async _refreshSize(): Promise<void> {
    this.queueSize.set((await this._load()).length);
  }

  private _generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}
