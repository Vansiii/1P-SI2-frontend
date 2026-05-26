/**
 * Admin Realtime Service
 *
 * Handles real-time updates for all admin views: monitoring, workshops, withdrawals, etc.
 * Applies event payloads directly to state instead of re-fetching via HTTP.
 * Uses EventDispatcherService to avoid duplicate event processing with other realtime services.
 */
import { Injectable, inject, DestroyRef } from '@angular/core';
import { Subject } from 'rxjs';
import { EventDispatcherService } from './event-dispatcher.service';
import { AdminMonitoringService } from './admin-monitoring.service';
import { RealtimeEvent } from '../models/realtime-events.models';

export interface WorkshopRealtimeUpdate {
  type: 'availability_changed' | 'status_changed' | 'verified' | 'balance_updated';
  workshop_id: number;
  payload: any;
}

export interface TechnicianRealtimeUpdate {
  type: 'status_changed' | 'availability_changed' | 'location_updated' | 'assigned';
  technician_id: number;
  payload: any;
}

@Injectable({ providedIn: 'root' })
export class AdminRealtimeService {
  private readonly eventDispatcher = inject(EventDispatcherService);
  private readonly adminMonitoringService = inject(AdminMonitoringService);
  private readonly destroyRef = inject(DestroyRef);

  private isInitialized = false;
  private hasSubscribed = false;

  readonly workshopUpdates$ = new Subject<WorkshopRealtimeUpdate>();
  readonly technicianUpdates$ = new Subject<TechnicianRealtimeUpdate>();
  readonly withdrawalUpdates$ = new Subject<any>();
  readonly walletUpdates$ = new Subject<any>();
  readonly auditUpdates$ = new Subject<any>();

  constructor() {
    // Auto-initialize: subscribe to events immediately
    // The EventDispatcher starts routing as soon as WebSocket connects
    this.subscribeToEvents();
  }

  initialize(): void {
    if (this.isInitialized) { return; }
    console.log('AdminRealtimeService initializing via EventDispatcher');
    this.subscribeToEvents();
    this.isInitialized = true;
    console.log('AdminRealtimeService initialized via EventDispatcher');
  }

  private subscribeToEvents(): void {
    if (this.hasSubscribed) { return; }
    this.hasSubscribed = true;

    // Use EventDispatcherService instead of raw messages$ to avoid duplicate processing
    const dashboardEvents = [
      'dashboard.metrics_updated',
      'dashboard.incident_count_changed',
      'dashboard.active_technicians_changed',
      'dashboard.alert_triggered',
      'workshop.availability_changed',
      'workshop.verified',
      'workshop.updated',
      'technician.status_changed',
      'technician_status_update',
      'technician.availability_changed',
      'technician.location_updated',
      'incident.created',
      'incident_created',
      'incident.assigned',
      'incident_assigned',
      'incident.status_changed',
      'incident_status_change',
      'incident_status_changed',
      'incident.updated',
      'incident_updated',
      'incident.assignment_accepted',
      'incident_assignment_accepted',
      'incident.assignment_rejected',
      'incident_assignment_rejected',
      'incident.technician_on_way',
      'incident_technician_on_way',
      'incident.technician_arrived',
      'incident_technician_arrived',
      'incident.work_started',
      'incident_work_started',
      'incident.work_completed',
      'incident_work_completed',
      'incident.cancelled',
      'incident_cancelled',
      'incident.no_workshop_available',
      'incident_no_workshop_available',
      'payment.received',
      'wallet.balance_updated',
      'workshop.balance_updated',
      'withdrawal.created',
      'withdrawal.status_changed',
      'audit.log_created',
    ];

    const unsubscribe = this.eventDispatcher.subscribeMultiple(
      dashboardEvents,
      (event) => this.handleRealtimeEvent(event)
    );

    this.destroyRef.onDestroy(() => unsubscribe());

    console.log('AdminRealtimeService subscriptions established');
  }

  private handleRealtimeEvent(event: RealtimeEvent): void {
    const anyEvent = event as any;
    const eventType: string = anyEvent.type;
    const payload = anyEvent.data ?? anyEvent;
    const incidentId = Number(payload?.incident_id);
    const hasIncidentId = Number.isFinite(incidentId) && incidentId > 0;

    switch (eventType) {
      // ── Dashboard events ──
      case 'dashboard.metrics_updated':
        if (payload) this.adminMonitoringService.updateMetricsFromEvent(payload);
        this.scheduleChartsRefresh();
        break;
      case 'dashboard.incident_count_changed':
        if (payload) this.adminMonitoringService.updateStatusCounts(payload.status, payload.count);
        break;
      case 'dashboard.active_technicians_changed':
        if (payload) this.adminMonitoringService.updateTechnicianCounts(payload);
        break;
      case 'dashboard.alert_triggered':
        if (payload) this.adminMonitoringService.addAlert(payload);
        break;

      // ── Workshop events ──
      case 'workshop.availability_changed':
        if (payload?.workshop_id) {
          this.adminMonitoringService.updateWorkshopFromEvent(payload.workshop_id, {
            availability_status: payload.new_status,
            available_technicians: payload.available_technicians,
            busy_technicians: payload.busy_technicians,
            active_incidents: payload.active_incidents,
            updated_at: payload.changed_at
          });
          this.workshopUpdates$.next({
            type: 'availability_changed',
            workshop_id: payload.workshop_id,
            payload
          });
          this.scheduleWorkshopsRefresh();
          this.scheduleChartsRefresh();
        }
        break;
      case 'workshop.verified':
        this.workshopUpdates$.next({ type: 'verified', workshop_id: payload.workshop_id, payload });
        this.scheduleWorkshopsRefresh();
        this.scheduleChartsRefresh();
        break;
      case 'workshop.updated':
        this.workshopUpdates$.next({ type: 'status_changed', workshop_id: payload.workshop_id, payload });
        this.scheduleWorkshopsRefresh();
        this.scheduleChartsRefresh();
        break;

      // ── Technician events ──
      case 'technician.status_changed':
      case 'technician_status_update':
        if (payload) {
          this.adminMonitoringService.updateTechnicianCounts({
            active_count: payload.active_count,
            available_count: payload.available_count,
            on_duty_count: payload.on_duty_count
          });
          this.technicianUpdates$.next({
            type: 'status_changed',
            technician_id: payload.technician_id,
            payload
          });
          this.scheduleWorkshopsRefresh();
          this.scheduleChartsRefresh();
        }
        break;
      case 'technician.availability_changed':
        this.technicianUpdates$.next({ type: 'availability_changed', technician_id: payload.technician_id, payload });
        this.scheduleWorkshopsRefresh();
        break;
      case 'technician.location_updated':
        this.technicianUpdates$.next({ type: 'location_updated', technician_id: payload.technician_id, payload });
        break;

      // ── Incident events ──
      case 'incident.created':
      case 'incident_created':
        if (payload) {
          this.adminMonitoringService.addIncidentFromEvent(payload);
          this.scheduleWorkshopsRefresh();
          this.scheduleChartsRefresh();
        }
        break;
      case 'incident.status_changed':
      case 'incident_status_change':
      case 'incident_status_changed':
        if (hasIncidentId) {
          this.adminMonitoringService.updateIncidentStatusFromEvent(
            incidentId,
            payload?.new_status || payload?.estado_actual || 'pendiente',
            payload?.old_status || payload?.estado_anterior
          );
          this.scheduleMetricsRefresh();
          this.scheduleWorkshopsRefresh();
          this.scheduleChartsRefresh();
        }
        break;
      case 'incident.updated':
      case 'incident_updated':
        if (hasIncidentId) {
          const updatedFields = payload?.updated_fields || {};
          const rawNewStatus = updatedFields?.estado_actual || updatedFields?.estado || payload?.new_status;
          if (rawNewStatus) {
            this.adminMonitoringService.updateIncidentStatusFromEvent(
              incidentId,
              rawNewStatus,
              payload?.old_status || payload?.estado_anterior
            );
            this.scheduleMetricsRefresh();
            this.scheduleWorkshopsRefresh();
            this.scheduleChartsRefresh();
          } else {
            this.adminMonitoringService.updateIncidentFromEvent(incidentId, {
              ...updatedFields,
              updated_at: payload?.timestamp || new Date().toISOString()
            });
          }
        }
        break;
      case 'incident.assigned':
      case 'incident_assigned':
        if (hasIncidentId) {
          const statusFromEvent = this.extractIncidentStatus(payload);
          this.adminMonitoringService.updateIncidentFromEvent(incidentId, {
            taller_id: payload?.workshop_id ?? payload?.taller_id ?? null,
            ...(statusFromEvent ? { estado_actual: statusFromEvent } : {}),
            updated_at: payload?.timestamp || new Date().toISOString()
          });
        }
        break;
      case 'incident.assignment_accepted':
      case 'incident_assignment_accepted':
        if (hasIncidentId) {
          const statusFromEvent =
            this.extractIncidentStatus(payload) ||
            // Backend assignment_accepted event does not always include new_status.
            // Derive a safe status from technician assignment presence.
            (Number(payload?.technician_id) > 0 ? 'en_proceso' : 'asignado');

          this.adminMonitoringService.updateIncidentStatusFromEvent(
            incidentId,
            statusFromEvent,
            payload?.old_status || payload?.estado_anterior || 'pendiente'
          );
          this.scheduleMetricsRefresh();
          this.scheduleWorkshopsRefresh();
          this.scheduleChartsRefresh();
        }
        break;
      case 'incident.assignment_rejected':
      case 'incident_assignment_rejected':
        if (hasIncidentId) {
          const statusFromEvent = this.extractIncidentStatus(payload);
          if (statusFromEvent) {
            this.adminMonitoringService.updateIncidentStatusFromEvent(
              incidentId,
              statusFromEvent,
              payload?.old_status || payload?.estado_anterior
            );
            this.scheduleMetricsRefresh();
            this.scheduleWorkshopsRefresh();
            this.scheduleChartsRefresh();
          }
        }
        break;
      case 'incident.technician_on_way':
      case 'incident_technician_on_way':
        if (hasIncidentId) {
          this.adminMonitoringService.updateIncidentStatusFromEvent(
            incidentId,
            payload?.new_status || payload?.estado_actual || 'en_camino',
            payload?.old_status || payload?.estado_anterior
          );
          this.scheduleMetricsRefresh();
          this.scheduleWorkshopsRefresh();
          this.scheduleChartsRefresh();
        }
        break;
      case 'incident.technician_arrived':
      case 'incident_technician_arrived':
      case 'incident.work_started':
      case 'incident_work_started':
        if (hasIncidentId) {
          this.adminMonitoringService.updateIncidentStatusFromEvent(
            incidentId,
            payload?.new_status || payload?.estado_actual || 'en_proceso',
            payload?.old_status || payload?.estado_anterior
          );
          this.scheduleMetricsRefresh();
          this.scheduleWorkshopsRefresh();
          this.scheduleChartsRefresh();
        }
        break;
      case 'incident.work_completed':
      case 'incident_work_completed':
        if (hasIncidentId) {
          this.adminMonitoringService.updateIncidentStatusFromEvent(
            incidentId,
            payload?.new_status || payload?.estado_actual || 'resuelto',
            payload?.old_status || payload?.estado_anterior
          );
          this.scheduleMetricsRefresh();
          this.scheduleWorkshopsRefresh();
          this.scheduleChartsRefresh();
        }
        break;
      case 'incident.cancelled':
      case 'incident_cancelled':
        if (hasIncidentId) {
          this.adminMonitoringService.updateIncidentStatusFromEvent(
            incidentId,
            'cancelado',
            payload?.old_status
          );
          this.scheduleMetricsRefresh();
          this.scheduleWorkshopsRefresh();
          this.scheduleChartsRefresh();
        }
        break;
      case 'incident.no_workshop_available':
      case 'incident_no_workshop_available':
        if (hasIncidentId) {
          this.adminMonitoringService.updateIncidentStatusFromEvent(
            incidentId,
            'sin_taller_disponible',
            payload?.old_status
          );
          this.scheduleMetricsRefresh();
          this.scheduleWorkshopsRefresh();
          this.scheduleChartsRefresh();
        }
        break;

      // ── Wallet events ──
      case 'payment.received':
      case 'wallet.balance_updated':
      case 'workshop.balance_updated':
        this.walletUpdates$.next({ type: eventType, ...payload });
        break;

      // ── Withdrawal events ──
      case 'withdrawal.created':
      case 'withdrawal.status_changed':
        this.withdrawalUpdates$.next({ type: eventType, ...payload });
        break;

      // ── Audit events ──
      case 'audit.log_created':
      case 'audit_log_created':
        this.auditUpdates$.next({ type: eventType, ...payload });
        break;
    }
  }

  /**
   * Extract status from event payload without forcing assumptions.
   * Some events (e.g. incident.assigned) do not imply a final global state.
   */
  private extractIncidentStatus(payload: any): string | undefined {
    return (
      payload?.new_status ||
      payload?.status ||
      payload?.estado_actual ||
      payload?.updated_fields?.estado_actual ||
      payload?.updated_fields?.estado
    );
  }

  private scheduleMetricsRefresh(): void {
    // Disabled by design: no HTTP auto-refresh from realtime events.
    // Metrics must update only from event payloads or explicit user action.
  }

  private scheduleWorkshopsRefresh(): void {
    // Disabled by design: no HTTP auto-refresh from realtime events.
    // Workshops must update only from event payloads or explicit user action.
  }

  private scheduleChartsRefresh(): void {
    // Disabled by design: no HTTP auto-refresh from realtime events.
    // Charts must update only from event payloads or explicit user action.
  }

  destroy(): void {
    this.isInitialized = false;
  }
}
