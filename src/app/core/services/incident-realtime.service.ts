import { Injectable, inject, DestroyRef, signal } from '@angular/core';
import { EventDispatcherService } from './event-dispatcher.service';
import { 
  RealtimeEvent,
  IncidentCreatedEventData,
  IncidentAssignedEventData,
  IncidentAssignmentAcceptedEventData,
  IncidentAssignmentRejectedEventData,
  IncidentAssignmentTimeoutEventData,
  IncidentStatusChangedEventData,
  IncidentCancelledEventData
} from '../models/realtime-events.models';
import { Subject } from 'rxjs';

/**
 * Incident update notification
 */
export interface IncidentUpdate {
  incidentId: number;
  updateType: 'created' | 'assigned' | 'status_changed' | 'cancelled' | 'completed';
  message: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  data?: any;
}

/**
 * Incident Real-Time Service
 * 
 * Handles real-time updates for incident management.
 * Processes incident events and provides notifications for UI updates.
 */
@Injectable({
  providedIn: 'root'
})
export class IncidentRealtimeService {
  private readonly eventDispatcher = inject(EventDispatcherService);
  private readonly destroyRef = inject(DestroyRef);

  // Incident updates stream
  private readonly incidentUpdatesSubject = new Subject<IncidentUpdate>();
  readonly incidentUpdates$ = this.incidentUpdatesSubject.asObservable();

  // Toast notifications stream
  private readonly toastNotificationsSubject = new Subject<IncidentUpdate>();
  readonly toastNotifications$ = this.toastNotificationsSubject.asObservable();

  // Active incidents signal
  readonly activeIncidents = signal<Map<number, any>>(new Map());
  
  // Recent updates signal
  readonly recentUpdates = signal<IncidentUpdate[]>([]);

  private unsubscribers: (() => void)[] = [];

  constructor() {
    this.setupEventHandlers();

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  /**
   * Setup event handlers for all incident events
   */
  private setupEventHandlers(): void {
    // Subscribe to all incident events
    const incidentEventTypes = [
      'incident.created',
      'incident.assigned',
      'incident.assignment_accepted',
      'incident.assignment_rejected',
      'incident.assignment_timeout',
      'incident.status_changed',
      'incident.technician_on_way',
      'incident.technician_arrived',
      'incident.work_started',
      'incident.work_completed',
      'incident.cancelled',
      'incident.photos_uploaded',
      'incident.analysis_started',
      'incident.analysis_completed',
      'incident.analysis_failed'
    ];

    const unsubscribe = this.eventDispatcher.subscribeMultiple(
      incidentEventTypes,
      (event) => this.handleIncidentEvent(event)
    );

    this.unsubscribers.push(unsubscribe);

    console.log('✅ IncidentRealtimeService: Event handlers setup complete');
  }

  /**
   * Handle incident event
   */
  private handleIncidentEvent(event: RealtimeEvent): void {
    console.log('📨 Processing incident event:', event.type, event);

    try {
      switch (event.type) {
        case 'incident.created':
        case 'incident_created':
          this.handleIncidentCreated(event as RealtimeEvent<IncidentCreatedEventData>);
          break;
        case 'incident.assigned':
        case 'incident_assigned':
          this.handleIncidentAssigned(event as RealtimeEvent<IncidentAssignedEventData>);
          break;
        case 'incident.assignment_accepted':
        case 'incident_assignment_accepted':
          this.handleAssignmentAccepted(event as RealtimeEvent<IncidentAssignmentAcceptedEventData>);
          break;
        case 'incident.assignment_rejected':
        case 'incident_assignment_rejected':
          this.handleAssignmentRejected(event as RealtimeEvent<IncidentAssignmentRejectedEventData>);
          break;
        case 'incident.assignment_timeout':
        case 'incident_assignment_timeout':
          this.handleAssignmentTimeout(event as RealtimeEvent<IncidentAssignmentTimeoutEventData>);
          break;
        case 'incident.status_changed':
        case 'incident_status_changed':
        case 'incident_status_change':
          this.handleStatusChanged(event as RealtimeEvent<IncidentStatusChangedEventData>);
          break;
        case 'incident.technician_on_way':
        case 'incident_technician_on_way':
          this.handleTechnicianOnWay(event as RealtimeEvent<any>);
          break;
        case 'incident.technician_arrived':
        case 'incident_technician_arrived':
          this.handleTechnicianArrived(event as RealtimeEvent<any>);
          break;
        case 'incident.work_started':
        case 'incident_work_started':
          this.handleWorkStarted(event as RealtimeEvent<any>);
          break;
        case 'incident.work_completed':
        case 'incident_work_completed':
          this.handleWorkCompleted(event as RealtimeEvent<any>);
          break;
        case 'incident.cancelled':
        case 'incident_cancelled':
          this.handleIncidentCancelled(event as RealtimeEvent<IncidentCancelledEventData>);
          break;
        case 'evidence_image_uploaded':
        case 'evidence_uploaded':
          this.handlePhotosUploaded(event as RealtimeEvent<any>);
          break;
        default:
          console.warn('⚠️ Unknown incident event type:', event.type);
      }
    } catch (error) {
      console.error('❌ Error handling incident event:', error, event);
    }
  }

  /**
   * Handle incident created event
   */
  private handleIncidentCreated(event: RealtimeEvent<IncidentCreatedEventData>): void {
    try {
      // ✅ Handle both formats: with data field or root-level properties
      const data = event.data || (event as any);
      
      // Validate required fields - check incident object first
      const incident = data.incident;
      if (!incident || !incident.id) {
        console.error('❌ Invalid incident.created event: missing incident or incident.id', event);
        return;
      }
      
      const incidentId = incident.id;
      
      const update: IncidentUpdate = {
        incidentId: incidentId,
        updateType: 'created',
        message: `Nuevo incidente creado: ${incident.descripcion || 'Sin descripción'}`,
        priority: event.priority || 'medium',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      this.showToast(update);
      
      // Add to active incidents
      this.activeIncidents.update(incidents => {
        const newMap = new Map(incidents);
        newMap.set(incidentId, {
          id: incidentId,
          status: 'pending',
          description: incident.descripcion,
          location: incident.ubicacion,
          createdAt: incident.created_at
        });
        return newMap;
      });
    } catch (error) {
      console.error('❌ Error handling incident.created event:', error, event);
    }
  }

  /**
   * Handle incident assigned event
   */
  private handleIncidentAssigned(event: RealtimeEvent<IncidentAssignedEventData>): void {
    try {
      // ✅ Handle both formats: with data field or root-level properties
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid incident.assigned event: missing incident_id', event);
        return;
      }
      
      const update: IncidentUpdate = {
        incidentId: data.incident_id,
        updateType: 'assigned',
        message: `Incidente #${data.incident_id} asignado al taller`,
        priority: event.priority || 'high',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      this.showToast(update);

      // Update incident status
      this.updateIncidentStatus(data.incident_id, 'assigned');
    } catch (error) {
      console.error('❌ Error handling incident.assigned event:', error, event);
    }
  }

  /**
   * Handle assignment accepted event
   */
  private handleAssignmentAccepted(event: RealtimeEvent<IncidentAssignmentAcceptedEventData>): void {
    try {
      // ✅ Handle both formats: with data field or root-level properties
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid assignment_accepted event: missing incident_id', event);
        return;
      }
      
      const update: IncidentUpdate = {
        incidentId: data.incident_id,
        updateType: 'status_changed',
        message: `Incidente #${data.incident_id} aceptado por el taller`,
        priority: event.priority || 'high',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      this.showToast(update);

      // Update incident status
      this.updateIncidentStatus(data.incident_id, 'accepted');
    } catch (error) {
      console.error('❌ Error handling assignment_accepted event:', error, event);
    }
  }

  /**
   * Handle assignment rejected event
   */
  private handleAssignmentRejected(event: RealtimeEvent<IncidentAssignmentRejectedEventData>): void {
    try {
      // ✅ Handle both formats: with data field or root-level properties
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid assignment_rejected event: missing incident_id', event);
        return;
      }
      
      const update: IncidentUpdate = {
        incidentId: data.incident_id,
        updateType: 'status_changed',
        message: `Incidente #${data.incident_id} rechazado: ${data.rejection_reason || 'Sin razón especificada'}`,
        priority: 'high',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      this.showToast(update);

      // Update incident status
      this.updateIncidentStatus(data.incident_id, 'rejected');
    } catch (error) {
      console.error('❌ Error handling assignment_rejected event:', error, event);
    }
  }

  /**
   * Handle status changed event
   */
  private handleStatusChanged(event: RealtimeEvent<IncidentStatusChangedEventData>): void {
    try {
      // ✅ Handle both formats: with data field or root-level properties
      const data = event.data || (event as any);
      
      // Validate required fields
      if (!data.incident_id || !data.new_status) {
        console.error('❌ Invalid status_changed event: missing required fields', event);
        return;
      }
      
      const statusMessages: Record<string, string> = {
        'pending': 'Pendiente',
        'assigned': 'Asignado',
        'accepted': 'Aceptado',
        'rejected': 'Rechazado',
        'on_way': 'En camino',
        'arrived': 'Técnico llegó',
        'in_progress': 'En progreso',
        'completed': 'Completado',
        'cancelled': 'Cancelado',
        'sin_taller_disponible': 'Sin taller disponible'
      };

      // ✅ Si el incidente pasa a "sin_taller_disponible", removerlo del mapa de incidentes activos
      // Solo el admin debe ver estos incidentes
      if (data.new_status === 'sin_taller_disponible') {
        console.log(`🚫 Incidente ${data.incident_id} pasó a sin_taller_disponible - removiendo de incidentes activos`);
        
        // ✅ NUEVO: Emitir notificación antes de remover
        const update: IncidentUpdate = {
          incidentId: data.incident_id,
          updateType: 'status_changed',
          message: `Incidente #${data.incident_id}: No hay talleres disponibles en el área`,
          priority: 'high',
          timestamp: event.timestamp,
          data: data
        };
        
        this.emitUpdate(update);
        this.showToast(update);
        
        this.activeIncidents.update(incidents => {
          const newMap = new Map(incidents);
          newMap.delete(data.incident_id);
          return newMap;
        });
        return;
      }

      const oldStatusLabel = statusMessages[data.old_status] || data.old_status;
      const newStatusLabel = statusMessages[data.new_status] || data.new_status;

      const update: IncidentUpdate = {
        incidentId: data.incident_id,
        updateType: 'status_changed',
        message: `Incidente #${data.incident_id}: ${oldStatusLabel} → ${newStatusLabel}`,
        priority: event.priority || 'medium',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      
      // Show toast for important status changes
      if (['completed', 'cancelled', 'rejected'].includes(data.new_status)) {
        this.showToast(update);
      }

      // Update incident status
      this.updateIncidentStatus(data.incident_id, data.new_status);
    } catch (error) {
      console.error('❌ Error handling status_changed event:', error, event);
    }
  }

  /**
   * Handle technician on way event
   */
  private handleTechnicianOnWay(event: RealtimeEvent<any>): void {
    try {
      // ✅ Handle both formats: with data field or root-level properties
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid technician_on_way event: missing incident_id', event);
        return;
      }
      
      const update: IncidentUpdate = {
        incidentId: data.incident_id,
        updateType: 'status_changed',
        message: `Técnico en camino al incidente #${data.incident_id}`,
        priority: event.priority || 'medium',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      this.showToast(update);

      // Update incident status
      this.updateIncidentStatus(data.incident_id, 'on_way');
    } catch (error) {
      console.error('❌ Error handling technician_on_way event:', error, event);
    }
  }

  /**
   * Handle technician arrived event
   */
  private handleTechnicianArrived(event: RealtimeEvent<any>): void {
    try {
      // ✅ Handle both formats: with data field or root-level properties
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid technician_arrived event: missing incident_id', event);
        return;
      }
      
      const update: IncidentUpdate = {
        incidentId: data.incident_id,
        updateType: 'status_changed',
        message: `Técnico llegó al incidente #${data.incident_id}`,
        priority: event.priority || 'medium',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      this.showToast(update);

      // Update incident status
      this.updateIncidentStatus(data.incident_id, 'arrived');
    } catch (error) {
      console.error('❌ Error handling technician_arrived event:', error, event);
    }
  }

  /**
   * Handle work completed event
   */
  private handleWorkCompleted(event: RealtimeEvent<any>): void {
    try {
      // ✅ Handle both formats: with data field or root-level properties
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid work_completed event: missing incident_id', event);
        return;
      }
      
      const update: IncidentUpdate = {
        incidentId: data.incident_id,
        updateType: 'completed',
        message: `Trabajo completado en incidente #${data.incident_id}`,
        priority: event.priority || 'medium',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      this.showToast(update);

      // Update incident status
      this.updateIncidentStatus(data.incident_id, 'completed');
    } catch (error) {
      console.error('❌ Error handling work_completed event:', error, event);
    }
  }

  /**
   * Handle incident cancelled event
   */
  private handleIncidentCancelled(event: RealtimeEvent<IncidentCancelledEventData>): void {
    try {
      // ✅ Handle both formats: with data field or root-level properties
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid incident.cancelled event: missing incident_id', event);
        return;
      }
      
      const update: IncidentUpdate = {
        incidentId: data.incident_id,
        updateType: 'cancelled',
        message: `Incidente #${data.incident_id} cancelado: ${data.cancellation_reason || 'Sin razón'}`,
        priority: 'high',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      this.showToast(update);

      // Update incident status
      this.updateIncidentStatus(data.incident_id, 'cancelled');
    } catch (error) {
      console.error('❌ Error handling incident.cancelled event:', error, event);
    }
  }

  /**
   * Emit incident update
   */
  private emitUpdate(update: IncidentUpdate): void {
    this.incidentUpdatesSubject.next(update);

    // Add to recent updates
    this.recentUpdates.update(updates => {
      const newUpdates = [update, ...updates].slice(0, 50); // Keep last 50 updates
      return newUpdates;
    });
  }

  /**
   * Show toast notification for critical updates
   */
  private showToast(update: IncidentUpdate): void {
    this.toastNotificationsSubject.next(update);
  }

  /**
   * Update incident status in active incidents map
   */
  private updateIncidentStatus(incidentId: number, status: string): void {
    this.activeIncidents.update(incidents => {
      const newMap = new Map(incidents);
      const incident = newMap.get(incidentId);
      if (incident) {
        newMap.set(incidentId, { ...incident, status });
      }
      return newMap;
    });
  }

  /**
   * Get incident by ID
   */
  getIncident(incidentId: number): any | undefined {
    return this.activeIncidents().get(incidentId);
  }

  /**
   * Clear recent updates
   */
  clearRecentUpdates(): void {
    this.recentUpdates.set([]);
  }

  /**
   * Handle assignment timeout event
   */
  private handleAssignmentTimeout(event: RealtimeEvent<IncidentAssignmentTimeoutEventData>): void {
    try {
      // ✅ Handle both formats: with data field or root-level properties
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid assignment_timeout event: missing incident_id', event);
        return;
      }
      
      const update: IncidentUpdate = {
        incidentId: data.incident_id,
        updateType: 'status_changed',
        message: `Timeout de asignación para incidente #${data.incident_id}`,
        priority: event.priority || 'high',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      this.showToast(update);

      // Update incident status
      this.updateIncidentStatus(data.incident_id, 'timeout');
    } catch (error) {
      console.error('❌ Error handling assignment_timeout event:', error, event);
    }
  }

  /**
   * Handle work started event
   */
  private handleWorkStarted(event: RealtimeEvent<any>): void {
    try {
      // ✅ Handle both formats: with data field or root-level properties
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid work_started event: missing incident_id', event);
        return;
      }
      
      const update: IncidentUpdate = {
        incidentId: data.incident_id,
        updateType: 'status_changed',
        message: `Trabajo iniciado en incidente #${data.incident_id}`,
        priority: event.priority || 'medium',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);

      // Update incident status
      this.updateIncidentStatus(data.incident_id, 'in_progress');
    } catch (error) {
      console.error('❌ Error handling work_started event:', error, event);
    }
  }

  /**
   * Handle photos uploaded event
   */
  private handlePhotosUploaded(event: RealtimeEvent<any>): void {
    try {
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid photos_uploaded event: missing incident_id', event);
        return;
      }
      
      const photoCount = data.photo_urls?.length || 0;
      const update: IncidentUpdate = {
        incidentId: data.incident_id,
        updateType: 'status_changed',
        message: `${photoCount} foto(s) subida(s) al incidente #${data.incident_id}`,
        priority: event.priority || 'low',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      
      // Update incident with new photos
      this.activeIncidents.update(incidents => {
        const newMap = new Map(incidents);
        const incident = newMap.get(data.incident_id);
        if (incident) {
          newMap.set(data.incident_id, { 
            ...incident, 
            photos: data.photo_urls 
          });
        }
        return newMap;
      });
    } catch (error) {
      console.error('❌ Error handling photos_uploaded event:', error, event);
    }
  }

  /**
   * Handle analysis started event
   */
  private handleAnalysisStarted(event: RealtimeEvent<any>): void {
    try {
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid analysis_started event: missing incident_id', event);
        return;
      }
      
      const update: IncidentUpdate = {
        incidentId: data.incident_id,
        updateType: 'status_changed',
        message: `Analizando incidente #${data.incident_id} con IA...`,
        priority: event.priority || 'medium',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      this.showToast(update);
      
      // Update incident with analyzing status
      this.activeIncidents.update(incidents => {
        const newMap = new Map(incidents);
        const incident = newMap.get(data.incident_id);
        if (incident) {
          newMap.set(data.incident_id, { 
            ...incident, 
            analyzing: true,
            analysis_id: data.analysis_id
          });
        }
        return newMap;
      });
    } catch (error) {
      console.error('❌ Error handling analysis_started event:', error, event);
    }
  }

  /**
   * Handle analysis completed event
   */
  private handleAnalysisCompleted(event: RealtimeEvent<any>): void {
    try {
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid analysis_completed event: missing incident_id', event);
        return;
      }
      
      const update: IncidentUpdate = {
        incidentId: data.incident_id,
        updateType: 'status_changed',
        message: `Análisis IA completado para incidente #${data.incident_id}: ${data.diagnosis}`,
        priority: event.priority || 'high',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      this.showToast(update);
      
      // Update incident with analysis results
      this.activeIncidents.update(incidents => {
        const newMap = new Map(incidents);
        const incident = newMap.get(data.incident_id);
        if (incident) {
          newMap.set(data.incident_id, { 
            ...incident, 
            analyzing: false,
            analysis: {
              diagnosis: data.diagnosis,
              severity: data.severity,
              recommendations: data.recommendations
            }
          });
        }
        return newMap;
      });
    } catch (error) {
      console.error('❌ Error handling analysis_completed event:', error, event);
    }
  }

  /**
   * Handle analysis failed event
   */
  private handleAnalysisFailed(event: RealtimeEvent<any>): void {
    try {
      const data = event.data || (event as any);
      
      if (!data.incident_id) {
        console.error('❌ Invalid analysis_failed event: missing incident_id', event);
        return;
      }
      
      const update: IncidentUpdate = {
        incidentId: data.incident_id,
        updateType: 'status_changed',
        message: `Error en análisis IA del incidente #${data.incident_id}: ${data.error}`,
        priority: 'high',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
      this.showToast(update);
      
      // Update incident with error status
      this.activeIncidents.update(incidents => {
        const newMap = new Map(incidents);
        const incident = newMap.get(data.incident_id);
        if (incident) {
          newMap.set(data.incident_id, { 
            ...incident, 
            analyzing: false,
            analysis_error: data.error
          });
        }
        return newMap;
      });
    } catch (error) {
      console.error('❌ Error handling analysis_failed event:', error, event);
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    
    this.incidentUpdatesSubject.complete();
    this.toastNotificationsSubject.complete();

    console.log('🧹 IncidentRealtimeService cleaned up');
  }
}
