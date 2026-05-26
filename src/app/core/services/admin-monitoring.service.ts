/**
 * Admin Monitoring Service
 * 
 * Service for admin monitoring dashboard.
 * Handles data fetching, state management, and real-time updates.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SystemMetrics,
  IncidentsResponse,
  IncidentBasic,
  WorkshopsResponse,
  ChartData,
  IncidentFilters,
  MonitoringState,
  MonitoringTab
} from '../models/admin-monitoring.models';
import { ApiResponse } from '../models/api.models';

@Injectable({
  providedIn: 'root'
})
export class AdminMonitoringService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/monitoring`;

  // ============================================================================
  // State Signals
  // ============================================================================

  // Current tab
  readonly currentTab = signal<MonitoringTab>('overview');

  // Metrics
  readonly metrics = signal<SystemMetrics | null>(null);
  readonly metricsLoading = signal(false);
  readonly metricsError = signal<string | null>(null);

  // Incidents
  readonly incidents = signal<IncidentsResponse | null>(null);
  readonly incidentsLoading = signal(false);
  readonly incidentsError = signal<string | null>(null);

  // Workshops
  readonly workshops = signal<WorkshopsResponse | null>(null);
  readonly workshopsLoading = signal(false);
  readonly workshopsError = signal<string | null>(null);

  // Charts
  readonly charts = signal<ChartData | null>(null);
  readonly chartsLoading = signal(false);
  readonly chartsError = signal<string | null>(null);

  // Filters
  readonly filters = signal<IncidentFilters>({
    limit: 100,
    offset: 0
  });

  // Last update timestamp
  readonly lastUpdate = signal<Date | null>(null);

  // ============================================================================
  // Computed Signals
  // ============================================================================

  readonly isLoading = computed(() => 
    this.metricsLoading() || 
    this.incidentsLoading() || 
    this.workshopsLoading() || 
    this.chartsLoading()
  );

  readonly hasError = computed(() => 
    this.metricsError() !== null || 
    this.incidentsError() !== null || 
    this.workshopsError() !== null || 
    this.chartsError() !== null
  );

  readonly errorMessage = computed(() => {
    return this.metricsError() || 
           this.incidentsError() || 
           this.workshopsError() || 
           this.chartsError();
  });

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Load all initial data for the dashboard
   */
  async loadInitialData(): Promise<void> {
    try {
      await Promise.all([
        this.loadMetrics(),
        this.loadIncidents(),
        this.loadWorkshops(),
        this.loadCharts()
      ]);
      this.lastUpdate.set(new Date());
    } catch (error) {
      console.error('Error loading initial data:', error);
      throw error;
    }
  }

  /**
   * Load system metrics
   */
  async loadMetrics(): Promise<void> {
    this.metricsLoading.set(true);
    this.metricsError.set(null);

    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/summary`)
      );

      if (response.data) {
        this.metrics.set(this.syncMetricFields(response.data));
      } else {
        throw new Error(response.message || 'Error loading metrics');
      }
    } catch (error: any) {
      console.error('Error loading metrics:', error);
      this.metricsError.set(error.error?.message || 'Error al cargar métricas del sistema');
      throw error;
    } finally {
      this.metricsLoading.set(false);
    }
  }

  /**
   * Load incidents with current filters
   */
  async loadIncidents(): Promise<void> {
    this.incidentsLoading.set(true);
    this.incidentsError.set(null);

    try {
      const currentFilters = this.filters();
      let params = new HttpParams();

      if (currentFilters.estado) {
        params = params.set('estado', currentFilters.estado);
      }
      if (currentFilters.prioridad_ia) {
        params = params.set('prioridad_ia', currentFilters.prioridad_ia);
      }
      if (currentFilters.categoria_ia) {
        params = params.set('categoria_ia', currentFilters.categoria_ia);
      }
      if (currentFilters.search) {
        params = params.set('search', currentFilters.search);
      }
      if (currentFilters.limit) {
        params = params.set('limit', currentFilters.limit.toString());
      }
      if (currentFilters.offset) {
        params = params.set('offset', currentFilters.offset.toString());
      }

      const response = await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/incidents`, { params })
      );

      if (response.data) {
        this.incidents.set(response.data);
      } else {
        throw new Error(response.message || 'Error loading incidents');
      }
    } catch (error: any) {
      console.error('Error loading incidents:', error);
      this.incidentsError.set(error.error?.message || 'Error al cargar incidentes');
      throw error;
    } finally {
      this.incidentsLoading.set(false);
    }
  }

  /**
   * Load workshops with status
   */
  async loadWorkshops(): Promise<void> {
    this.workshopsLoading.set(true);
    this.workshopsError.set(null);

    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/workshops`)
      );

      if (response.data) {
        this.workshops.set(response.data);
      } else {
        throw new Error(response.message || 'Error loading workshops');
      }
    } catch (error: any) {
      console.error('Error loading workshops:', error);
      this.workshopsError.set(error.error?.message || 'Error al cargar talleres');
      throw error;
    } finally {
      this.workshopsLoading.set(false);
    }
  }

  /**
   * Load chart data
   */
  async loadCharts(): Promise<void> {
    this.chartsLoading.set(true);
    this.chartsError.set(null);

    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/charts`)
      );

      if (response.data) {
        this.charts.set(response.data);
      } else {
        throw new Error(response.message || 'Error loading charts');
      }
    } catch (error: any) {
      console.error('Error loading charts:', error);
      this.chartsError.set(error.error?.message || 'Error al cargar gráficos');
      throw error;
    } finally {
      this.chartsLoading.set(false);
    }
  }

  /**
   * Refresh all data
   */
  async refreshAll(): Promise<void> {
    await this.loadInitialData();
  }

  /**
   * Update filters and reload incidents
   */
  async updateFilters(newFilters: Partial<IncidentFilters>): Promise<void> {
    this.filters.update(current => ({ ...current, ...newFilters }));
    await this.loadIncidents();
  }

  /**
   * Clear filters and reload incidents
   */
  async clearFilters(): Promise<void> {
    this.filters.set({ limit: 100, offset: 0 });
    await this.loadIncidents();
  }

  /**
   * Change current tab
   */
  setCurrentTab(tab: MonitoringTab): void {
    this.currentTab.set(tab);
  }

  /**
   * Update metrics from realtime event
   */
  updateMetricsFromEvent(metrics: Partial<SystemMetrics> & Record<string, any>): void {
    const current = this.metrics();

    // Some realtime emitters publish a compact dashboard payload
    // (e.g. completed_today) that doesn't include full admin metrics.
    // If we don't have a base snapshot yet, skip to avoid zeroing cards.
    const looksLikeCompactPayload =
      metrics &&
      typeof metrics.total_incidents === 'number' &&
      typeof metrics.active_incidents === 'number' &&
      !metrics.status_counts &&
      metrics.pending_incidents === undefined &&
      metrics.assigned_incidents === undefined &&
      metrics.in_progress_incidents === undefined &&
      metrics.unassigned_incidents === undefined;

    if (!current && looksLikeCompactPayload) {
      return;
    }

    // Compact dashboard payload comes from a different summary source and can
    // desynchronize admin cards if it overwrites detailed counters.
    // Keep admin counters stable and only patch safe fields.
    if (current && looksLikeCompactPayload) {
      const compactMerged: SystemMetrics = {
        ...current,
        resolved_today: metrics.resolved_today ?? metrics['completed_today'] ?? current.resolved_today,
        active_technicians: metrics.active_technicians ?? current.active_technicians,
        updated_at: metrics.updated_at ?? new Date().toISOString(),
      };
      this.metrics.set(this.syncMetricFields(compactMerged));
      this.lastUpdate.set(new Date());
      return;
    }

    const merged: SystemMetrics = this.syncMetricFields({
      ...(current || {} as SystemMetrics),
      ...metrics,
      // Backend compact dashboard event uses completed_today.
      resolved_today: metrics.resolved_today ?? metrics['completed_today'] ?? current?.resolved_today ?? 0,
      updated_at: metrics.updated_at ?? new Date().toISOString(),
      // Preserve status counts unless the event explicitly sends new ones.
      status_counts: metrics.status_counts ?? current?.status_counts,
    } as SystemMetrics);

    this.metrics.set(merged);
    this.lastUpdate.set(new Date());
  }

  updateStatusCounts(status: string, count: number): void {
    const current = this.metrics();
    if (!current) return;
    const normalizedStatus = this.normalizeIncidentStatus(status);
    const statusCounts = this.ensureStatusCountsFromMetrics(current);
    statusCounts[normalizedStatus] = count;
    const updated = {
      ...current,
      status_counts: statusCounts,
      updated_at: new Date().toISOString()
    };
    this.metrics.set(this.syncMetricFields(updated));
    this.lastUpdate.set(new Date());
  }

  updateTechnicianCounts(data: { active_count?: number; available_count?: number; on_duty_count?: number }): void {
    const current = this.metrics();
    if (!current) return;
    this.metrics.set({
      ...current,
      active_technicians: data.active_count ?? current.active_technicians,
      available_technicians: data.available_count ?? current.available_technicians,
      on_duty_technicians: data.on_duty_count ?? current.on_duty_technicians,
      updated_at: new Date().toISOString()
    });
    this.lastUpdate.set(new Date());
  }

  addAlert(alert: any): void {
    const current = this.metrics();
    if (!current) return;
    const alerts = current.alerts || [];
    this.metrics.set({
      ...current,
      alerts: [alert, ...alerts].slice(0, 20),
      updated_at: new Date().toISOString()
    });
    this.lastUpdate.set(new Date());
  }

  incrementIncidentCount(status: string): void {
    const current = this.metrics();
    if (!current) return;
    const statusCounts = this.ensureStatusCountsFromMetrics(current);
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    const updated = {
      ...current,
      status_counts: statusCounts,
      total_incidents: (current.total_incidents || 0) + 1,
      updated_at: new Date().toISOString()
    };
    this.metrics.set(this.syncMetricFields(updated));
    this.lastUpdate.set(new Date());
  }

  private ensureStatusCountsFromMetrics(current: SystemMetrics): Record<string, number> {
    if (current.status_counts && Object.keys(current.status_counts).length > 0) {
      return { ...current.status_counts };
    }
    return {
      pendiente: current.pending_incidents ?? 0,
      asignado: current.assigned_incidents ?? 0,
      // IMPORTANT: "aceptado" is part of in-progress lifecycle, not assigned.
      // Initializing it from assigned_incidents inflates "En Proceso" counters.
      aceptado: 0,
      en_camino: 0,
      en_proceso: current.in_progress_incidents ?? 0,
      en_sitio: 0,
      sin_taller_disponible: current.unassigned_incidents ?? 0,
      resuelto: current.resolved_today ?? 0,
      completado: 0,
      cancelado: 0,
    };
  }

  shiftIncidentCount(oldStatus: string, newStatus: string): void {
    const current = this.metrics();
    if (!current || !oldStatus || !newStatus) return;
    const normalizedOldStatus = this.normalizeIncidentStatus(oldStatus);
    const normalizedNewStatus = this.normalizeIncidentStatus(newStatus);
    const statusCounts = this.ensureStatusCountsFromMetrics(current);
    if (normalizedOldStatus !== 'unknown') {
      statusCounts[normalizedOldStatus] = Math.max(0, (statusCounts[normalizedOldStatus] || 0) - 1);
    }
    statusCounts[normalizedNewStatus] = (statusCounts[normalizedNewStatus] || 0) + 1;
    const updated = {
      ...current,
      status_counts: statusCounts,
      updated_at: new Date().toISOString()
    };
    this.metrics.set(this.syncMetricFields(updated));
    this.lastUpdate.set(new Date());
  }

  incrementStatusOnly(status: string): void {
    const current = this.metrics();
    if (!current) return;
    const normalizedStatus = this.normalizeIncidentStatus(status);
    const statusCounts = this.ensureStatusCountsFromMetrics(current);
    statusCounts[normalizedStatus] = (statusCounts[normalizedStatus] || 0) + 1;
    const updated = {
      ...current,
      status_counts: statusCounts,
      updated_at: new Date().toISOString()
    };
    this.metrics.set(this.syncMetricFields(updated));
    this.lastUpdate.set(new Date());
  }

  /**
   * Update a single incident from realtime event
   */
  updateIncidentFromEvent(incidentId: number, updates: any): void {
    const normalizedIncidentId = Number(incidentId);
    if (!Number.isFinite(normalizedIncidentId) || normalizedIncidentId <= 0) return;

    const currentIncidents = this.incidents();
    if (!currentIncidents) return;

    let changedOldStatus: string | undefined;
    let changedNewStatus: string | undefined;
    const normalizedUpdates = {
      ...updates,
      ...(updates?.estado_actual ? { estado_actual: this.normalizeIncidentStatus(updates.estado_actual) } : {}),
    };

    const updatedIncidents = currentIncidents.incidents.map(incident => {
      if (Number(incident.id) === normalizedIncidentId) {
        changedOldStatus = this.normalizeIncidentStatus(incident.estado_actual);
        changedNewStatus = this.normalizeIncidentStatus(normalizedUpdates?.estado_actual || incident.estado_actual);
        return { ...incident, ...normalizedUpdates };
      }
      return incident;
    });

    this.incidents.set({
      ...currentIncidents,
      incidents: updatedIncidents
    });

    if (changedOldStatus && changedNewStatus && changedOldStatus !== changedNewStatus) {
      // Keep incidents.by_status in sync for list/filters.
      // Metrics are updated from authoritative dashboard events
      // (dashboard.incident_count_changed / dashboard.metrics_updated)
      // to avoid double counting.
      this.updateIncidentsByStatus(changedOldStatus, changedNewStatus);
    }
  }

  /**
   * Add a new incident from realtime event
   */
  addIncidentFromEvent(incident: any): void {
    const currentIncidents = this.incidents();
    if (!currentIncidents) return;

    const normalized = this.normalizeIncidentEventPayload(incident);
    const exists = currentIncidents.incidents.some(item => item.id === normalized.id);
    const nextIncidents = exists
      ? currentIncidents.incidents.map(item =>
          item.id === normalized.id
            ? {
                ...item,
                ...normalized,
                created_at: item.created_at || normalized.created_at,
              }
            : item
        )
      : [normalized, ...currentIncidents.incidents];

    this.incidents.set({
      ...currentIncidents,
      incidents: nextIncidents,
      total: exists ? currentIncidents.total : currentIncidents.total + 1
    });

    if (!exists) {
      // Keep incidents.by_status in sync for list/filters only.
      // Do not mutate metrics counters here; dashboard events are authoritative.
      this.updateIncidentsByStatus(undefined, normalized.estado_actual || 'pendiente');
    }
  }

  /**
   * Remove an incident from realtime event
   */
  removeIncidentFromEvent(incidentId: number): void {
    const currentIncidents = this.incidents();
    if (!currentIncidents) return;

    const filteredIncidents = currentIncidents.incidents.filter(
      incident => incident.id !== incidentId
    );

    this.incidents.set({
      ...currentIncidents,
      incidents: filteredIncidents,
      total: currentIncidents.total - 1
    });
  }

  /**
   * Update a workshop from realtime event
   */
  updateWorkshopFromEvent(workshopId: number, updates: any): void {
    const currentWorkshops = this.workshops();
    if (!currentWorkshops) return;

    const updatedWorkshops = currentWorkshops.workshops.map(workshop => {
      if (workshop.id === workshopId) {
        return { ...workshop, ...updates };
      }
      return workshop;
    });

    this.workshops.set({
      ...currentWorkshops,
      workshops: updatedWorkshops
    });
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.metricsError.set(null);
    this.incidentsError.set(null);
    this.workshopsError.set(null);
    this.chartsError.set(null);
  }

  updateIncidentStatusFromEvent(
    incidentId: number,
    newStatus: string,
    oldStatus?: string
  ): void {
    const normalizedIncidentId = Number(incidentId);
    if (!Number.isFinite(normalizedIncidentId) || normalizedIncidentId <= 0) return;

    const currentIncidents = this.incidents();
    if (!currentIncidents) return;

    const currentIncident = currentIncidents.incidents.find(item => Number(item.id) === normalizedIncidentId);
    const previousStatus = oldStatus || currentIncident?.estado_actual;
    const normalizedStatus = this.normalizeIncidentStatus(newStatus);

    this.updateIncidentFromEvent(normalizedIncidentId, {
      estado_actual: normalizedStatus,
      updated_at: new Date().toISOString()
    });

    if (!currentIncident && previousStatus && previousStatus !== normalizedStatus) {
      // Incident may be outside current page/filter.
      // Avoid local metric drift from partial data; rely on dashboard count events.
      this.updateIncidentsByStatus(previousStatus, normalizedStatus);
    }
  }

  private normalizeIncidentEventPayload(payload: any): IncidentBasic {
    const source = payload?.incident || payload;
    const incidentId = source?.id ?? source?.incident_id;
    const location = source?.location || {};
    const normalizedStatus = this.normalizeIncidentStatus(source?.estado_actual || source?.estado || 'pendiente');

    return {
      id: incidentId,
      descripcion: source?.descripcion || source?.description || 'Sin descripción',
      estado_actual: normalizedStatus,
      latitud: source?.latitud ?? source?.latitude ?? location?.latitude ?? null,
      longitud: source?.longitud ?? source?.longitude ?? location?.longitude ?? null,
      direccion_referencia: source?.direccion_referencia ?? location?.address ?? null,
      created_at: source?.created_at || payload?.timestamp || new Date().toISOString(),
      updated_at: source?.updated_at || payload?.timestamp || new Date().toISOString(),
      cliente_id: source?.cliente_id ?? source?.client_id ?? 0,
      vehiculo_id: source?.vehiculo_id ?? source?.vehicle_id ?? 0,
      taller_id: source?.taller_id ?? source?.workshop_id ?? null,
      tecnico_id: source?.tecnico_id ?? source?.technician_id ?? null,
      cliente: source?.cliente,
      vehiculo: source?.vehiculo,
      taller: source?.taller,
      tecnico: source?.tecnico,
    };
  }

  private normalizeIncidentStatus(statusRaw: string | null | undefined): string {
    const status = String(statusRaw || '').trim().toLowerCase();
    const map: Record<string, string> = {
      pending: 'pendiente',
      pendiente: 'pendiente',
      assigned: 'asignado',
      asignado: 'asignado',
      accepted: 'aceptado',
      aceptado: 'aceptado',
      on_way: 'en_camino',
      en_camino: 'en_camino',
      'en camino': 'en_camino',
      in_progress: 'en_proceso',
      en_proceso: 'en_proceso',
      'en proceso': 'en_proceso',
      en_progreso: 'en_proceso',
      inprocess: 'en_proceso',
      onsite: 'en_sitio',
      on_site: 'en_sitio',
      en_sitio: 'en_sitio',
      'en sitio': 'en_sitio',
      resolved: 'resuelto',
      completed: 'completado',
      resuelto: 'resuelto',
      completado: 'completado',
      cancelled: 'cancelado',
      cancelado: 'cancelado',
      no_workshop_available: 'sin_taller_disponible',
      sin_taller_disponible: 'sin_taller_disponible',
      sin_taller: 'sin_taller_disponible',
      'sin taller': 'sin_taller_disponible',
      sin_taller_asignado: 'sin_taller_disponible',
      'sin taller disponible': 'sin_taller_disponible',
      'sin taller asignado': 'sin_taller_disponible',
    };
    return map[status] || status || 'pendiente';
  }

  private updateIncidentsByStatus(oldStatus: string | undefined, newStatus: string): void {
    const currentIncidents = this.incidents();
    if (!currentIncidents) return;

    const byStatus = { ...currentIncidents.by_status } as any;
    const normalizedOldStatus = oldStatus ? this.normalizeIncidentStatus(oldStatus) : undefined;
    const normalizedNewStatus = this.normalizeIncidentStatus(newStatus);
    if (normalizedOldStatus && byStatus[normalizedOldStatus] !== undefined) {
      byStatus[normalizedOldStatus] = Math.max(0, (byStatus[normalizedOldStatus] || 0) - 1);
    }
    byStatus[normalizedNewStatus] = (byStatus[normalizedNewStatus] || 0) + 1;

    this.incidents.set({
      ...currentIncidents,
      by_status: byStatus
    });
  }

  private syncMetricFields(metrics: SystemMetrics): SystemMetrics {
    const rawCounts = (metrics.status_counts || (metrics as any).by_status || {}) as Record<string, number>;
    const statusCounts: Record<string, number> = {};
    Object.entries(rawCounts).forEach(([status, value]) => {
      statusCounts[this.normalizeIncidentStatus(status)] = value || 0;
    });

    const canonicalStatuses = new Set([
      'pendiente',
      'asignado',
      'aceptado',
      'en_camino',
      'en_proceso',
      'en_sitio',
      'sin_taller_disponible',
      'resuelto',
      'completado',
      'cancelado',
    ]);
    const canonicalCounts = Object.fromEntries(
      Object.entries(statusCounts).filter(([status]) => canonicalStatuses.has(status))
    ) as Record<string, number>;
    const hasCanonicalStatusCounts = Object.keys(canonicalCounts).length > 0;

    const hasKey = (key: string) => key in canonicalCounts;
    const pending = hasKey('pendiente') ? canonicalCounts['pendiente'] : (metrics.pending_incidents ?? 0);
    const assigned = hasKey('asignado') ? canonicalCounts['asignado'] : (metrics.assigned_incidents ?? 0);
    const hasInProgressKeys =
      hasKey('en_proceso') || hasKey('en_camino') || hasKey('en_sitio') || hasKey('aceptado');
    const inProgress = hasInProgressKeys
      ? ((canonicalCounts['en_proceso'] || 0)
        + (canonicalCounts['en_camino'] || 0)
        + (canonicalCounts['en_sitio'] || 0)
        + (canonicalCounts['aceptado'] || 0))
      : (metrics.in_progress_incidents ?? 0);
    const unassigned = hasKey('sin_taller_disponible') ? canonicalCounts['sin_taller_disponible'] : (metrics.unassigned_incidents ?? 0);
    const activeFromStatus = pending + assigned + inProgress + unassigned;
    const active = hasCanonicalStatusCounts ? activeFromStatus : (metrics.active_incidents ?? 0);
    const statusTotal = Object.values(canonicalCounts).reduce((acc, value) => acc + (value || 0), 0);

    return {
      ...metrics,
      status_counts: hasCanonicalStatusCounts ? statusCounts : metrics.status_counts,
      pending_incidents: pending,
      assigned_incidents: assigned,
      in_progress_incidents: inProgress,
      unassigned_incidents: unassigned,
      active_incidents: active,
      total_incidents: Math.max(metrics.total_incidents || 0, statusTotal)
    };
  }
}
