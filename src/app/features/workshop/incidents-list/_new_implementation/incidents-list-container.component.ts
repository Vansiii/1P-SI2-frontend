import { Component, ChangeDetectionStrategy, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { IncidentsStateService } from '../../../core/services/incidents-state.service';
import { IncidentsService } from '../../../core/services/incidents.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/services/auth.service';
import { IncidentFilter } from '../../../core/models/incident.model';
import { RealtimeEvent } from '../../../core/models/realtime-events.models';
import { FilterPanelComponent } from './components/filter-panel/filter-panel.component';
import { IncidentsGridComponent } from './components/incidents-grid/incidents-grid.component';
import { IncidentDetailComponent } from './components/incident-detail/incident-detail.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';

/**
 * IncidentsListContainerComponent (Smart Container)
 * 
 * Main container component that orchestrates the incidents list feature.
 * Manages state, real-time updates, and coordinates child components.
 * 
 * Features:
 * - Load and display incidents
 * - Filter incidents by status
 * - Real-time updates via WebSocket
 * - Timeout verification
 * - Connection monitoring
 * - Detail panel management
 * - Error handling
 * 
 * Requirements: 2.1-2.12, 3.4-3.7, 6.4-6.8, 7.7, 8.1, 8.8
 */
@Component({
  selector: 'app-incidents-list-container',
  standalone: true,
  imports: [
    CommonModule,
    FilterPanelComponent,
    IncidentsGridComponent,
    IncidentDetailComponent,
    LoadingSkeletonComponent
  ],
  templateUrl: './incidents-list-container.component.html',
  styleUrl: './incidents-list-container.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IncidentsListContainerComponent implements OnInit {
  // Injected services
  private incidentsStateService = inject(IncidentsStateService);
  private incidentsService = inject(IncidentsService);
  private webSocketService = inject(WebSocketService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  // Exposed signals from state service
  incidents = this.incidentsStateService.filteredIncidents;
  loading = this.incidentsStateService.loading;
  error = this.incidentsStateService.error;
  selectedIncident = this.incidentsStateService.selectedIncident;
  filterCounts = this.incidentsStateService.filterCounts;
  activeFilter = this.incidentsStateService.activeFilter;

  // Local signals
  isDetailOpen = signal<boolean>(false);
  wsConnected = signal<boolean>(true);

  ngOnInit(): void {
    this.loadIncidents();
    this.subscribeToRealtimeEvents();
    this.startTimeoutVerification();
    this.monitorWebSocketConnection();
  }

  /**
   * Load incidents from API
   */
  async loadIncidents(): Promise<void> {
    this.incidentsStateService.loading.set(true);
    this.incidentsStateService.error.set(null);

    try {
      const incidents = await this.incidentsService.getIncidentsNewModel();
      this.incidentsStateService.setIncidents(incidents);
    } catch (error) {
      console.error('Error loading incidents:', error);
      this.incidentsStateService.error.set('Error al cargar las solicitudes. Por favor, intenta de nuevo.');
    } finally {
      this.incidentsStateService.loading.set(false);
    }
  }

  /**
   * Handle filter change
   */
  onFilterChange(filter: IncidentFilter): void {
    this.incidentsStateService.setFilter(filter);
  }

  /**
   * Handle incident selection
   */
  onIncidentSelect(incidentId: number): void {
    this.incidentsStateService.selectIncident(incidentId);
    this.isDetailOpen.set(true);
  }

  /**
   * Handle detail panel close
   */
  onDetailClose(): void {
    this.isDetailOpen.set(false);
    this.incidentsStateService.selectIncident(null);
  }

  /**
   * Retry loading incidents
   */
  retryLoad(): void {
    this.incidentsStateService.error.set(null);
    this.loadIncidents();
  }

  /**
   * Subscribe to real-time events
   */
  private subscribeToRealtimeEvents(): void {
    this.webSocketService.messages$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: RealtimeEvent) => {
        this.handleRealtimeEvent(event);
      });
  }

  /**
   * Handle real-time event
   */
  private handleRealtimeEvent(event: RealtimeEvent): void {
    console.log('Received real-time event:', event.type, event.data);

    switch (event.type) {
      case 'incident.created':
        this.handleIncidentCreated(event);
        break;
      case 'incident.assigned':
        this.handleIncidentAssigned(event);
        break;
      case 'incident.status_changed':
        this.handleIncidentStatusChanged(event);
        break;
      case 'incident.assignment_accepted':
        this.handleIncidentAssignmentAccepted(event);
        break;
      case 'incident.assignment_rejected':
        this.handleIncidentAssignmentRejected(event);
        break;
      case 'incident.assignment_timeout':
        this.handleIncidentAssignmentTimeout(event);
        break;
      case 'incident.no_workshop_available':
        this.handleIncidentNoWorkshopAvailable(event);
        break;
      case 'incident.cancelled':
        this.handleIncidentCancelled(event);
        break;
      default:
        console.warn('Unhandled event type:', event.type);
    }
  }

  /**
   * Handle incident created event
   */
  private handleIncidentCreated(event: RealtimeEvent): void {
    if (event.data && 'incident' in event.data) {
      this.incidentsStateService.addIncident(event.data.incident);
    }
  }

  /**
   * Handle incident assigned event
   */
  private handleIncidentAssigned(event: RealtimeEvent): void {
    if (event.data && 'incident_id' in event.data && 'suggested_technician' in event.data) {
      this.incidentsStateService.updateIncident(event.data.incident_id, {
        estado: 'asignado',
        suggested_technician: event.data.suggested_technician,
        has_timeout: false
      });
    }
  }

  /**
   * Handle incident status changed event
   */
  private handleIncidentStatusChanged(event: RealtimeEvent): void {
    if (event.data && 'incident_id' in event.data && 'new_status' in event.data) {
      this.incidentsStateService.updateIncident(event.data.incident_id, {
        estado: event.data.new_status
      });
    }
  }

  /**
   * Handle incident assignment accepted event
   */
  private handleIncidentAssignmentAccepted(event: RealtimeEvent): void {
    if (event.data && 'incident_id' in event.data) {
      // Remove incident from list as it's been accepted by another workshop
      this.incidentsStateService.removeIncident(event.data.incident_id);
    }
  }

  /**
   * Handle incident assignment rejected event
   */
  private handleIncidentAssignmentRejected(event: RealtimeEvent): void {
    if (event.data && 'incident_id' in event.data && 'rejection_count' in event.data) {
      this.incidentsStateService.updateIncident(event.data.incident_id, {
        rejection_count: event.data.rejection_count
      });
    }
  }

  /**
   * Handle incident assignment timeout event
   */
  private handleIncidentAssignmentTimeout(event: RealtimeEvent): void {
    if (event.data && 'incident_id' in event.data) {
      this.incidentsStateService.updateIncident(event.data.incident_id, {
        has_timeout: true
      });
    }
  }

  /**
   * Handle incident no workshop available event
   */
  private handleIncidentNoWorkshopAvailable(event: RealtimeEvent): void {
    if (event.data && 'incident_id' in event.data) {
      // Remove incident from list as no workshop is available
      this.incidentsStateService.removeIncident(event.data.incident_id);
    }
  }

  /**
   * Handle incident cancelled event
   */
  private handleIncidentCancelled(event: RealtimeEvent): void {
    if (event.data && 'incident_id' in event.data) {
      this.incidentsStateService.updateIncident(event.data.incident_id, {
        estado: 'cancelado'
      });
    }
  }

  /**
   * Start timeout verification interval
   */
  private startTimeoutVerification(): void {
    interval(30000) // Every 30 seconds
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.incidentsStateService.verifyTimeouts();
      });
  }

  /**
   * Monitor WebSocket connection status
   */
  private monitorWebSocketConnection(): void {
    // Subscribe to connection status changes
    this.webSocketService.connectionStatus$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        this.wsConnected.set(status === 'connected');
      });
  }
}
