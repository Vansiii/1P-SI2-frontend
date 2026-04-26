import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WebSocketService } from './websocket.service';
import { IncidentsService } from './incidents.service';

export type ServiceStatus = 'started' | 'completed' | 'paused' | 'resumed';

export interface ServiceStatusEvent {
  service_id: number;
  incident_id: number;
  status: ServiceStatus | string;
  timestamp: string;
}

/**
 * ServicesService
 *
 * Subscribes to real-time service status WebSocket events and updates
 * service status indicators without requiring a page refresh.
 *
 * Handles: service_started, service_completed, service_paused, service_resumed
 * Requirements: REQ-13 (Service Status Real-Time Events)
 */
@Injectable({
  providedIn: 'root'
})
export class ServicesService {
  private readonly wsService = inject(WebSocketService);
  private readonly incidentsService = inject(IncidentsService);

  /** Current service status events keyed by incident_id */
  private serviceStatusSubject = new BehaviorSubject<Map<number, ServiceStatusEvent>>(new Map());
  public serviceStatus$ = this.serviceStatusSubject.asObservable();

  constructor() {
    this.subscribeToWebSocket();
  }

  /**
   * Subscribe to service status WebSocket events
   */
  private subscribeToWebSocket(): void {
    this.wsService.messages$.subscribe(message => {
      switch (message.type) {
        case 'service_started':
          this.handleServiceStarted(message.data);
          break;
        case 'service_completed':
          this.handleServiceCompleted(message.data);
          break;
        case 'service_paused':
          this.handleServicePaused(message.data);
          break;
        case 'service_resumed':
          this.handleServiceResumed(message.data);
          break;
      }
    });
  }

  /**
   * Get the current service status for a given incident
   */
  getServiceStatus(incidentId: number): ServiceStatusEvent | undefined {
    return this.serviceStatusSubject.value.get(incidentId);
  }

  /**
   * Update the internal service status map and emit the new state
   */
  private updateServiceStatus(event: ServiceStatusEvent): void {
    const current = new Map(this.serviceStatusSubject.value);
    current.set(event.incident_id, event);
    this.serviceStatusSubject.next(current);
  }

  /**
   * Handle service_started event
   * Emitted when a technician begins working on an incident (state → en_proceso)
   */
  private handleServiceStarted(data: any): void {
    console.log('🔧 Service started event received:', data);

    const event: ServiceStatusEvent = {
      service_id: data.service_id ?? data.incident_id,
      incident_id: data.incident_id,
      status: 'started',
      timestamp: data.timestamp || new Date().toISOString()
    };

    this.updateServiceStatus(event);

    // Update the parent incident's estado_actual in IncidentsService
    const incidents = (this.incidentsService as any).incidentsSubject?.value;
    if (incidents) {
      const index = incidents.findIndex((i: any) => i.id === data.incident_id);
      if (index !== -1) {
        incidents[index] = {
          ...incidents[index],
          estado_actual: 'en_proceso',
          updated_at: event.timestamp
        };
        (this.incidentsService as any).incidentsSubject.next([...incidents]);
        console.log(`✅ Incident ${data.incident_id} estado_actual updated to 'en_proceso'`);
      }
    }
  }

  /**
   * Handle service_completed event
   * Emitted when an incident is resolved (state → resuelto)
   */
  private handleServiceCompleted(data: any): void {
    console.log('✅ Service completed event received:', data);

    const event: ServiceStatusEvent = {
      service_id: data.service_id ?? data.incident_id,
      incident_id: data.incident_id,
      status: 'completed',
      timestamp: data.timestamp || new Date().toISOString()
    };

    this.updateServiceStatus(event);

    // Update the parent incident's estado_actual in IncidentsService
    const incidents = (this.incidentsService as any).incidentsSubject?.value;
    if (incidents) {
      const index = incidents.findIndex((i: any) => i.id === data.incident_id);
      if (index !== -1) {
        incidents[index] = {
          ...incidents[index],
          estado_actual: 'resuelto',
          updated_at: event.timestamp
        };
        (this.incidentsService as any).incidentsSubject.next([...incidents]);
        console.log(`✅ Incident ${data.incident_id} estado_actual updated to 'resuelto'`);
      }
    }
  }

  /**
   * Handle service_paused event
   * Emitted when a service is paused or cancelled (state → cancelado)
   */
  private handleServicePaused(data: any): void {
    console.log('⏸️ Service paused event received:', data);

    const event: ServiceStatusEvent = {
      service_id: data.service_id ?? data.incident_id,
      incident_id: data.incident_id,
      status: 'paused',
      timestamp: data.timestamp || new Date().toISOString()
    };

    this.updateServiceStatus(event);

    // Update the parent incident's estado_actual if applicable
    const incidents = (this.incidentsService as any).incidentsSubject?.value;
    if (incidents) {
      const index = incidents.findIndex((i: any) => i.id === data.incident_id);
      if (index !== -1) {
        const newStatus = data.status || incidents[index].estado_actual;
        incidents[index] = {
          ...incidents[index],
          estado_actual: newStatus,
          updated_at: event.timestamp
        };
        (this.incidentsService as any).incidentsSubject.next([...incidents]);
        console.log(`⏸️ Incident ${data.incident_id} service paused (estado: ${newStatus})`);
      }
    }
  }

  /**
   * Handle service_resumed event
   * Emitted when a paused service is resumed
   */
  private handleServiceResumed(data: any): void {
    console.log('▶️ Service resumed event received:', data);

    const event: ServiceStatusEvent = {
      service_id: data.service_id ?? data.incident_id,
      incident_id: data.incident_id,
      status: 'resumed',
      timestamp: data.timestamp || new Date().toISOString()
    };

    this.updateServiceStatus(event);

    // Update the parent incident's estado_actual if applicable
    const incidents = (this.incidentsService as any).incidentsSubject?.value;
    if (incidents) {
      const index = incidents.findIndex((i: any) => i.id === data.incident_id);
      if (index !== -1) {
        const newStatus = data.status || 'en_proceso';
        incidents[index] = {
          ...incidents[index],
          estado_actual: newStatus,
          updated_at: event.timestamp
        };
        (this.incidentsService as any).incidentsSubject.next([...incidents]);
        console.log(`▶️ Incident ${data.incident_id} service resumed (estado: ${newStatus})`);
      }
    }
  }
}
