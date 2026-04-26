import { Injectable, inject, DestroyRef, signal } from '@angular/core';
import { EventDispatcherService } from './event-dispatcher.service';
import { 
  RealtimeEvent
} from '../models/realtime-events.models';
import { Subject } from 'rxjs';

/**
 * Cancellation update notification
 */
export interface CancellationUpdate {
  incidentId: number;
  updateType: 'requested' | 'approved' | 'rejected';
  message: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  data?: any;
}

/**
 * Cancellation request status
 */
export interface CancellationRequest {
  incidentId: number;
  requestedBy: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  resolvedAt?: string;
}

/**
 * Cancellation Real-Time Service
 * 
 * Handles real-time updates for incident cancellation requests.
 * Processes cancellation events and provides notifications for UI updates.
 */
@Injectable({
  providedIn: 'root'
})
export class CancellationRealtimeService {
  private readonly eventDispatcher = inject(EventDispatcherService);
  private readonly destroyRef = inject(DestroyRef);

  // Cancellation updates stream
  private readonly cancellationUpdatesSubject = new Subject<CancellationUpdate>();
  readonly cancellationUpdates$ = this.cancellationUpdatesSubject.asObservable();

  // Toast notifications stream
  private readonly toastNotificationsSubject = new Subject<CancellationUpdate>();
  readonly toastNotifications$ = this.toastNotificationsSubject.asObservable();

  // Active cancellation requests signal
  readonly cancellationRequests = signal<Map<number, CancellationRequest>>(new Map());

  private unsubscribers: (() => void)[] = [];

  constructor() {
    this.setupEventHandlers();

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  /**
   * Setup event handlers for all cancellation events
   */
  private setupEventHandlers(): void {
    const cancellationEventTypes = [
      'cancellation.requested',
      'cancellation.approved',
      'cancellation.rejected'
    ];

    const unsubscribe = this.eventDispatcher.subscribeMultiple(
      cancellationEventTypes,
      (event) => this.handleCancellationEvent(event)
    );

    this.unsubscribers.push(unsubscribe);

    console.log('✅ CancellationRealtimeService: Event handlers setup complete');
  }

  /**
   * Handle cancellation event
   */
  private handleCancellationEvent(event: RealtimeEvent): void {
    console.log('📨 Processing cancellation event:', event.type, event);

    try {
      switch (event.type) {
        case 'cancellation.requested':
          this.handleCancellationRequested(event);
          break;
        case 'cancellation.approved':
          this.handleCancellationApproved(event);
          break;
        case 'cancellation.rejected':
          this.handleCancellationRejected(event);
          break;
        default:
          console.warn('⚠️ Unknown cancellation event type:', event.type);
      }
    } catch (error) {
      console.error('❌ Error handling cancellation event:', error, event);
    }
  }

  /**
   * Handle cancellation requested event
   */
  private handleCancellationRequested(event: RealtimeEvent): void {
    try {
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid cancellation.requested event: missing incident_id', event);
        return;
      }
      
      const request: CancellationRequest = {
        incidentId: data.incident_id,
        requestedBy: data.requested_by,
        reason: data.reason,
        status: 'pending',
        requestedAt: data.requested_at
      };

      // Add cancellation request
      this.cancellationRequests.update(requests => {
        const newMap = new Map(requests);
        newMap.set(data.incident_id, request);
        return newMap;
      });

      const update: CancellationUpdate = {
        incidentId: data.incident_id,
        updateType: 'requested',
        message: `Solicitud de cancelación para incidente #${data.incident_id}: ${data.reason}`,
        priority: event.priority || 'high',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      this.showToast(update);
    } catch (error) {
      console.error('❌ Error handling cancellation.requested event:', error, event);
    }
  }

  /**
   * Handle cancellation approved event
   */
  private handleCancellationApproved(event: RealtimeEvent): void {
    try {
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid cancellation.approved event: missing incident_id', event);
        return;
      }
      
      // Update cancellation request status
      this.cancellationRequests.update(requests => {
        const newMap = new Map(requests);
        const request = newMap.get(data.incident_id);
        if (request) {
          newMap.set(data.incident_id, {
            ...request,
            status: 'approved',
            resolvedAt: data.approved_at
          });
        }
        return newMap;
      });

      const update: CancellationUpdate = {
        incidentId: data.incident_id,
        updateType: 'approved',
        message: `Cancelación aprobada para incidente #${data.incident_id}`,
        priority: 'high',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      this.showToast(update);
    } catch (error) {
      console.error('❌ Error handling cancellation.approved event:', error, event);
    }
  }

  /**
   * Handle cancellation rejected event
   */
  private handleCancellationRejected(event: RealtimeEvent): void {
    try {
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid cancellation.rejected event: missing incident_id', event);
        return;
      }
      
      // Update cancellation request status
      this.cancellationRequests.update(requests => {
        const newMap = new Map(requests);
        const request = newMap.get(data.incident_id);
        if (request) {
          newMap.set(data.incident_id, {
            ...request,
            status: 'rejected',
            resolvedAt: data.rejected_at
          });
        }
        return newMap;
      });

      const update: CancellationUpdate = {
        incidentId: data.incident_id,
        updateType: 'rejected',
        message: `Cancelación rechazada para incidente #${data.incident_id}: ${data.reason || 'Sin razón especificada'}`,
        priority: 'high',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      this.showToast(update);
    } catch (error) {
      console.error('❌ Error handling cancellation.rejected event:', error, event);
    }
  }

  /**
   * Emit cancellation update
   */
  private emitUpdate(update: CancellationUpdate): void {
    this.cancellationUpdatesSubject.next(update);
  }

  /**
   * Show toast notification
   */
  private showToast(update: CancellationUpdate): void {
    this.toastNotificationsSubject.next(update);
  }

  /**
   * Get cancellation request for an incident
   */
  getCancellationRequest(incidentId: number): CancellationRequest | undefined {
    return this.cancellationRequests().get(incidentId);
  }

  /**
   * Check if incident has pending cancellation request
   */
  hasPendingCancellation(incidentId: number): boolean {
    const request = this.cancellationRequests().get(incidentId);
    return request?.status === 'pending';
  }

  /**
   * Clear cancellation request
   */
  clearCancellationRequest(incidentId: number): void {
    this.cancellationRequests.update(requests => {
      const newMap = new Map(requests);
      newMap.delete(incidentId);
      return newMap;
    });
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    
    this.cancellationUpdatesSubject.complete();
    this.toastNotificationsSubject.complete();

    console.log('🧹 CancellationRealtimeService cleaned up');
  }
}
