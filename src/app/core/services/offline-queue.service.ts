import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface QueueOperation {
  id: string;
  type: string;
  endpoint: string;
  method: string;
  body: Record<string, any>;
  timestamp: number;
  retries: number;
}

export interface SyncResult {
  id: string;
  success: boolean;
  status_code?: number;
  error?: string;
  data?: Record<string, any>;
}

export interface SyncResponse {
  total: number;
  successful: number;
  failed: number;
  results: SyncResult[];
}

@Injectable({
  providedIn: 'root'
})
export class OfflineQueueService {
  private readonly http = inject(HttpClient);
  private readonly STORAGE_KEY = 'offline_queue';
  private readonly MAX_QUEUE_SIZE = 50;
  private readonly MAX_AGE_DAYS = 7;
  private isProcessing = false;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.onOnline());
    window.addEventListener('offline', () => this.onOffline());

    // Process queue on startup if online
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  /**
   * Add operation to offline queue
   */
  async add(operation: Omit<QueueOperation, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    const queue = await this.getQueue();

    // Check queue size limit
    if (queue.length >= this.MAX_QUEUE_SIZE) {
      console.warn('⚠️ Offline queue is full, removing oldest operation');
      queue.shift();
    }

    // Create full operation
    const fullOperation: QueueOperation = {
      ...operation,
      id: this.generateId(),
      timestamp: Date.now(),
      retries: 0
    };

    queue.push(fullOperation);
    await this.saveQueue(queue);

    console.log('✅ Operation added to offline queue:', fullOperation.type);
  }

  /**
   * Get all queued operations
   */
  async getQueue(): Promise<QueueOperation[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return [];
      }

      const queue: QueueOperation[] = JSON.parse(stored);

      // Filter out expired operations
      const maxAge = Date.now() - (this.MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
      return queue.filter(op => op.timestamp > maxAge);
    } catch (error) {
      console.error('❌ Error reading offline queue:', error);
      return [];
    }
  }

  /**
   * Save queue to storage
   */
  private async saveQueue(queue: QueueOperation[]): Promise<void> {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('❌ Error saving offline queue:', error);
    }
  }

  /**
   * Remove operation from queue
   */
  async remove(operationId: string): Promise<void> {
    const queue = await this.getQueue();
    const filtered = queue.filter(op => op.id !== operationId);
    await this.saveQueue(filtered);
  }

  /**
   * Clear entire queue
   */
  async clear(): Promise<void> {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('🗑️ Offline queue cleared');
  }

  /**
   * Get queue size
   */
  async size(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }

  /**
   * Process queue when coming online
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('⏳ Queue processing already in progress');
      return;
    }

    if (!navigator.onLine) {
      console.log('📴 Offline, skipping queue processing');
      return;
    }

    const queue = await this.getQueue();
    if (queue.length === 0) {
      console.log('✅ Offline queue is empty');
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 Processing offline queue: ${queue.length} operations`);

    try {
      // Send batch to backend
      const response = await firstValueFrom(
        this.http.post<SyncResponse>(`${environment.apiUrl}/sync/batch`, {
          operations: queue
        })
      );

      console.log(
        `✅ Batch sync completed: ${response.successful} successful, ${response.failed} failed`
      );

      // Remove successful operations from queue
      const failedIds = response.results
        .filter(r => !r.success)
        .map(r => r.id);

      if (failedIds.length > 0) {
        // Keep only failed operations and increment retries
        const updatedQueue = queue
          .filter(op => failedIds.includes(op.id))
          .map(op => ({ ...op, retries: op.retries + 1 }));

        await this.saveQueue(updatedQueue);

        // Show notification for failed operations
        this.showNotification(
          '⚠️ Algunas operaciones no se pudieron sincronizar',
          `${failedIds.length} operaciones fallaron. Se reintentarán automáticamente.`
        );
      } else {
        // All successful, clear queue
        await this.clear();
        this.showNotification(
          '✅ Sincronización completa',
          `${response.successful} operaciones sincronizadas exitosamente.`
        );
      }

    } catch (error) {
      console.error('❌ Error processing offline queue:', error);

      // Increment retries for all operations
      const updatedQueue = queue.map(op => ({ ...op, retries: op.retries + 1 }));
      await this.saveQueue(updatedQueue);

      this.showNotification(
        '❌ Error de sincronización',
        'No se pudo sincronizar. Se reintentará automáticamente.'
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle online event
   */
  private onOnline(): void {
    console.log('🌐 Connection restored, processing queue...');
    this.showNotification('🌐 Conexión restaurada', 'Sincronizando operaciones pendientes...');
    this.processQueue();
  }

  /**
   * Handle offline event
   */
  private onOffline(): void {
    console.log('📴 Connection lost, operations will be queued');
    this.showNotification('📴 Sin conexión', 'Las operaciones se guardarán y sincronizarán automáticamente.');
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Show browser notification
   */
  private showNotification(title: string, body: string): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png'
      });
    }
  }

  /**
   * Queue operation helpers for common actions
   */

  async queueIncidentStatusUpdate(incidentId: number, estado: string, notes?: string): Promise<void> {
    await this.add({
      type: 'UPDATE_INCIDENT_STATUS',
      endpoint: `/api/v1/incident-states/${incidentId}/transition`,
      method: 'POST',
      body: { incident_id: incidentId, estado, notes }
    });
  }

  async queueChatMessage(incidentId: number, message: string, messageType = 'text'): Promise<void> {
    await this.add({
      type: 'SEND_CHAT_MESSAGE',
      endpoint: `/api/v1/chat/incidents/${incidentId}/messages`,
      method: 'POST',
      body: { incident_id: incidentId, message, message_type: messageType }
    });
  }

  async queueLocationUpdate(latitude: number, longitude: number, accuracy?: number): Promise<void> {
    await this.add({
      type: 'UPDATE_LOCATION',
      endpoint: `/api/v1/real-time/location`,
      method: 'POST',
      body: { latitude, longitude, accuracy }
    });
  }

  async queueTechnicianAssignment(incidentId: number, technicianId: number): Promise<void> {
    await this.add({
      type: 'ASSIGN_TECHNICIAN',
      endpoint: `/api/v1/real-time/assign`,
      method: 'POST',
      body: { incident_id: incidentId, technician_id: technicianId }
    });
  }

  async queueMarkArrived(incidentId: number): Promise<void> {
    await this.add({
      type: 'MARK_ARRIVED',
      endpoint: `/api/v1/real-time/arrived`,
      method: 'POST',
      body: { incident_id: incidentId }
    });
  }
}
