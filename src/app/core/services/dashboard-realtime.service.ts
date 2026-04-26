import { Injectable, inject, DestroyRef, signal, computed } from '@angular/core';
import { EventDispatcherService } from './event-dispatcher.service';
import { 
  RealtimeEvent,
  IncidentStatus
} from '../models/realtime-events.models';
import { Subject } from 'rxjs';

/**
 * Dashboard metrics interface
 */
export interface DashboardMetrics {
  activeIncidents: number;
  pendingIncidents: number;
  completedToday: number;
  activeTechnicians: number;
  averageResponseTime: number;
  updatedAt: string;
}

/**
 * Incident count by status
 */
export interface IncidentCountByStatus {
  total: number;
  byStatus: Record<IncidentStatus, number>;
  changedAt: string;
}

/**
 * Active technicians info
 */
export interface ActiveTechniciansInfo {
  activeCount: number;
  technicianIds: number[];
  changedAt: string;
}

/**
 * Dashboard alert
 */
export interface DashboardAlert {
  id: string;
  type: 'sla_breach' | 'high_load' | 'system_error';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  triggeredAt: string;
  acknowledged: boolean;
}

/**
 * Dashboard Real-Time Service
 * 
 * Handles real-time updates for dashboard metrics and monitoring.
 * Provides live data for charts, counters, and system health indicators.
 */
@Injectable({
  providedIn: 'root'
})
export class DashboardRealtimeService {
  private readonly eventDispatcher = inject(EventDispatcherService);
  private readonly destroyRef = inject(DestroyRef);

  // Dashboard metrics signal
  readonly metrics = signal<DashboardMetrics>({
    activeIncidents: 0,
    pendingIncidents: 0,
    completedToday: 0,
    activeTechnicians: 0,
    averageResponseTime: 0,
    updatedAt: new Date().toISOString()
  });

  // Incident counts signal
  readonly incidentCounts = signal<IncidentCountByStatus>({
    total: 0,
    byStatus: {
      pendiente: 0,
      asignado: 0,
      aceptado: 0,
      en_camino: 0,
      en_proceso: 0,
      resuelto: 0,
      cancelado: 0,
      sin_taller_disponible: 0
    },
    changedAt: new Date().toISOString()
  });

  // Active technicians signal
  readonly activeTechnicians = signal<ActiveTechniciansInfo>({
    activeCount: 0,
    technicianIds: [],
    changedAt: new Date().toISOString()
  });

  // Alerts signal
  readonly alerts = signal<DashboardAlert[]>([]);

  // Computed signals
  readonly hasUnacknowledgedAlerts = computed(() => {
    return this.alerts().some(alert => !alert.acknowledged);
  });

  readonly criticalAlertsCount = computed(() => {
    return this.alerts().filter(alert => alert.severity === 'critical' && !alert.acknowledged).length;
  });

  // Metrics update stream
  private readonly metricsUpdateSubject = new Subject<DashboardMetrics>();
  readonly metricsUpdate$ = this.metricsUpdateSubject.asObservable();

  // Alert stream
  private readonly alertSubject = new Subject<DashboardAlert>();
  readonly alert$ = this.alertSubject.asObservable();

  private unsubscribers: (() => void)[] = [];

  constructor() {
    this.setupEventHandlers();

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  /**
   * Setup event handlers for all dashboard events
   */
  private setupEventHandlers(): void {
    const dashboardEventTypes = [
      'dashboard.metrics_updated',
      'dashboard.incident_count_changed',
      'dashboard.active_technicians_changed',
      'dashboard.alert_triggered'
    ];

    const unsubscribe = this.eventDispatcher.subscribeMultiple(
      dashboardEventTypes,
      (event) => this.handleDashboardEvent(event)
    );

    this.unsubscribers.push(unsubscribe);

    console.log('✅ DashboardRealtimeService: Event handlers setup complete');
  }

  /**
   * Handle dashboard event
   */
  private handleDashboardEvent(event: RealtimeEvent): void {
    console.log('📊 Processing dashboard event:', event.type, event);

    switch (event.type) {
      case 'dashboard.metrics_updated':
        this.handleMetricsUpdated(event as RealtimeEvent<any>);
        break;
      case 'dashboard.incident_count_changed':
        this.handleIncidentCountChanged(event as RealtimeEvent<any>);
        break;
      case 'dashboard.active_technicians_changed':
        this.handleActiveTechniciansChanged(event as RealtimeEvent<any>);
        break;
      case 'dashboard.alert_triggered':
        this.handleAlertTriggered(event as RealtimeEvent<any>);
        break;
    }
  }

  /**
   * Handle metrics updated event
   */
  private handleMetricsUpdated(event: RealtimeEvent<any>): void {
    const data = event.data || (event as any);
    const newMetrics: DashboardMetrics = {
      activeIncidents: data.active_incidents,
      pendingIncidents: data.pending_incidents,
      completedToday: data.completed_today,
      activeTechnicians: data.active_technicians,
      averageResponseTime: data.average_response_time,
      updatedAt: data.updated_at || event.timestamp
    };

    this.metrics.set(newMetrics);
    this.metricsUpdateSubject.next(newMetrics);

    console.log('📊 Dashboard metrics updated:', newMetrics);
  }

  /**
   * Handle incident count changed event
   */
  private handleIncidentCountChanged(event: RealtimeEvent<any>): void {
    const data = event.data || (event as any);
    // Asegurar que todos los estados estén presentes con valores por defecto
    const byStatus: Record<IncidentStatus, number> = {
      pendiente: data.by_status?.pendiente ?? 0,
      asignado: data.by_status?.asignado ?? 0,
      aceptado: data.by_status?.aceptado ?? 0,
      en_camino: data.by_status?.en_camino ?? 0,
      en_proceso: data.by_status?.en_proceso ?? 0,
      resuelto: data.by_status?.resuelto ?? 0,
      cancelado: data.by_status?.cancelado ?? 0,
      sin_taller_disponible: data.by_status?.sin_taller_disponible ?? 0
    };

    const newCounts: IncidentCountByStatus = {
      total: data.total_count,
      byStatus,
      changedAt: data.changed_at
    };

    this.incidentCounts.set(newCounts);

    console.log('📊 Incident counts updated:', newCounts);
  }

  /**
   * Handle active technicians changed event
   */
  private handleActiveTechniciansChanged(event: RealtimeEvent<any>): void {
    const data = event.data || (event as any);
    const newInfo: ActiveTechniciansInfo = {
      activeCount: data.active_count,
      technicianIds: data.technician_ids,
      changedAt: data.changed_at
    };

    this.activeTechnicians.set(newInfo);

    console.log('📊 Active technicians updated:', newInfo);
  }

  /**
   * Handle alert triggered event
   */
  private handleAlertTriggered(event: RealtimeEvent<any>): void {
    const data = event.data || (event as any);
    const alert: DashboardAlert = {
      id: data.alert_id,
      type: data.alert_type,
      message: data.message,
      severity: data.severity,
      triggeredAt: data.triggered_at,
      acknowledged: false
    };

    // Add alert to list
    this.alerts.update(alerts => [...alerts, alert]);

    // Emit alert
    this.alertSubject.next(alert);

    console.log('🚨 Dashboard alert triggered:', alert);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    this.alerts.update(alerts => 
      alerts.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      )
    );

    console.log('✅ Alert acknowledged:', alertId);
  }

  /**
   * Dismiss alert
   */
  dismissAlert(alertId: string): void {
    this.alerts.update(alerts => 
      alerts.filter(alert => alert.id !== alertId)
    );

    console.log('🗑️ Alert dismissed:', alertId);
  }

  /**
   * Clear all acknowledged alerts
   */
  clearAcknowledgedAlerts(): void {
    this.alerts.update(alerts => 
      alerts.filter(alert => !alert.acknowledged)
    );

    console.log('🧹 Acknowledged alerts cleared');
  }

  /**
   * Get incident count for specific status
   */
  getIncidentCountByStatus(status: IncidentStatus): number {
    return this.incidentCounts().byStatus[status] || 0;
  }

  /**
   * Get status distribution percentages
   */
  getStatusDistribution(): Record<IncidentStatus, number> {
    const counts = this.incidentCounts();
    const total = counts.total;

    if (total === 0) {
      return counts.byStatus;
    }

    const distribution: any = {};
    Object.entries(counts.byStatus).forEach(([status, count]) => {
      distribution[status] = Math.round((count / total) * 100);
    });

    return distribution;
  }

  /**
   * Get system health status
   */
  getSystemHealth(): 'healthy' | 'warning' | 'critical' {
    const criticalAlerts = this.criticalAlertsCount();
    const unacknowledged = this.hasUnacknowledgedAlerts();

    if (criticalAlerts > 0) {
      return 'critical';
    }

    if (unacknowledged) {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * Get response time status
   */
  getResponseTimeStatus(): 'good' | 'acceptable' | 'poor' {
    const avgTime = this.metrics().averageResponseTime;

    if (avgTime < 300) { // Less than 5 minutes
      return 'good';
    }

    if (avgTime < 600) { // Less than 10 minutes
      return 'acceptable';
    }

    return 'poor';
  }

  /**
   * Reset metrics (for testing or manual refresh)
   */
  resetMetrics(): void {
    this.metrics.set({
      activeIncidents: 0,
      pendingIncidents: 0,
      completedToday: 0,
      activeTechnicians: 0,
      averageResponseTime: 0,
      updatedAt: new Date().toISOString()
    });

    console.log('🔄 Dashboard metrics reset');
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    this.metricsUpdateSubject.complete();
    this.alertSubject.complete();

    console.log('🧹 DashboardRealtimeService cleaned up');
  }
}
