import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { AdminMonitoringService } from '../../../core/services/admin-monitoring.service';
import { AdminRealtimeService } from '../../../core/services/admin-realtime.service';
import { FormatTimePipe } from '../../../shared/pipes/format-time.pipe';
import type { MonitoringTab } from '../../../core/models/admin-monitoring.models';

@Component({
  selector: 'app-system-monitoring',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxChartsModule, FormatTimePipe],
  templateUrl: './system-monitoring.html',
  styleUrl: './system-monitoring.css'
})
export class SystemMonitoringComponent implements OnInit, OnDestroy {
  readonly monitoringService = inject(AdminMonitoringService);
  private readonly realtimeService = inject(AdminRealtimeService);
  private readonly router = inject(Router);

  // Expose service signals
  readonly currentTab = this.monitoringService.currentTab;
  readonly metrics = this.monitoringService.metrics;
  readonly incidents = this.monitoringService.incidents;
  readonly workshops = this.monitoringService.workshops;
  readonly charts = this.monitoringService.charts;
  readonly isLoading = this.monitoringService.isLoading;
  readonly hasError = this.monitoringService.hasError;
  readonly errorMessage = this.monitoringService.errorMessage;
  readonly lastUpdate = this.monitoringService.lastUpdate;
  readonly filters = this.monitoringService.filters;

  // Local UI state
  readonly searchTerm = signal('');
  readonly selectedStatus = signal<string | null>(null);
  readonly selectedPriority = signal<string | null>(null);
  readonly selectedCategory = signal<string | null>(null);

  // Computed signals
  readonly filteredIncidents = computed(() => {
    const incidentsData = this.incidents();
    if (!incidentsData) return [];
    
    let filtered = incidentsData.incidents;
    const search = this.searchTerm().toLowerCase();
    
    if (search) {
      filtered = filtered.filter(inc => 
        inc.id.toString().includes(search) ||
        inc.descripcion?.toLowerCase().includes(search) ||
        inc.direccion_referencia?.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  });

  constructor() {
    // Initialize realtime service
    this.realtimeService.initialize();
    
    // Subscribe to realtime updates
    effect(() => {
      // This effect will run when component is initialized
      // The realtimeService is already subscribed in its constructor
    });
  }

  async ngOnInit() {
    try {
      // Load initial data
      await this.monitoringService.loadInitialData();
      
      // Realtime service is already subscribed in its constructor
      console.log('✅ System monitoring initialized with realtime updates');
    } catch (error) {
      console.error('Error initializing system monitoring:', error);
    }

  }

  ngOnDestroy() {
    // No periodic timers: updates are driven by realtime events only.
  }

  // Tab navigation
  setTab(tab: MonitoringTab) {
    this.monitoringService.setCurrentTab(tab);
  }

  // Refresh actions
  async refreshAll() {
    try {
      await this.monitoringService.refreshAll();
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }

  async refreshMetrics() {
    try {
      await this.monitoringService.loadMetrics();
    } catch (error) {
      console.error('Error refreshing metrics:', error);
    }
  }

  async refreshIncidents() {
    try {
      await this.monitoringService.loadIncidents();
    } catch (error) {
      console.error('Error refreshing incidents:', error);
    }
  }

  async refreshWorkshops() {
    try {
      await this.monitoringService.loadWorkshops();
    } catch (error) {
      console.error('Error refreshing workshops:', error);
    }
  }

  // Filter actions
  async applyFilters() {
    try {
      await this.monitoringService.updateFilters({
        estado: this.selectedStatus() || undefined,
        prioridad_ia: this.selectedPriority() || undefined,
        categoria_ia: this.selectedCategory() || undefined,
        search: this.searchTerm() || undefined
      });
    } catch (error) {
      console.error('Error applying filters:', error);
    }
  }

  async clearFilters() {
    this.searchTerm.set('');
    this.selectedStatus.set(null);
    this.selectedPriority.set(null);
    this.selectedCategory.set(null);
    
    try {
      await this.monitoringService.clearFilters();
    } catch (error) {
      console.error('Error clearing filters:', error);
    }
  }

  // Navigation
  viewIncidentDetail(incidentId: number) {
    if (!Number.isFinite(incidentId) || incidentId <= 0) {
      console.warn('Ignoring invalid admin incident id from monitoring view:', incidentId);
      return;
    }
    this.router.navigate(['/admin/incident', incidentId]);
  }

  // Utility methods
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  }

  getStatusLabel(status: string): string {
    const normalized = this.normalizeStatus(status);
    const labels: Record<string, string> = {
      'pendiente': 'Pendiente',
      'asignado': 'Asignado',
      'aceptado': 'Aceptado',
      'en_proceso': 'En Proceso',
      'en_camino': 'En Camino',
      'en_sitio': 'En Sitio',
      'resuelto': 'Resuelto',
      'cancelado': 'Cancelado',
      'sin_taller_disponible': 'Sin Taller'
    };
    return labels[normalized] || normalized;
  }

  getStatusColor(status: string): string {
    const normalized = this.normalizeStatus(status);
    const colors: Record<string, string> = {
      'pendiente': 'warning',
      'asignado': 'info',
      'aceptado': 'success',
      'en_proceso': 'orange',
      'en_camino': 'purple',
      'en_sitio': 'success',
      'resuelto': 'success',
      'cancelado': 'danger',
      'sin_taller_disponible': 'danger'
    };
    return colors[normalized] || 'secondary';
  }

  private normalizeStatus(statusRaw: string | null | undefined): string {
    const status = String(statusRaw || '').trim().toLowerCase();
    const map: Record<string, string> = {
      pending: 'pendiente',
      pendiente: 'pendiente',
      assigned: 'asignado',
      asignado: 'asignado',
      accepted: 'aceptado',
      aceptado: 'aceptado',
      in_progress: 'en_proceso',
      en_proceso: 'en_proceso',
      on_way: 'en_camino',
      en_camino: 'en_camino',
      resolved: 'resuelto',
      resuelto: 'resuelto',
      cancelled: 'cancelado',
      cancelado: 'cancelado',
      no_workshop_available: 'sin_taller_disponible',
      sin_taller_disponible: 'sin_taller_disponible',
      sin_taller_asignado: 'sin_taller_disponible',
      'sin taller disponible': 'sin_taller_disponible',
      'sin taller asignado': 'sin_taller_disponible',
    };
    return map[status] || status || 'pendiente';
  }

  getPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      'alta': 'Alta',
      'media': 'Media',
      'baja': 'Baja'
    };
    return labels[priority] || priority;
  }

  getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      'alta': 'danger',
      'media': 'warning',
      'baja': 'info'
    };
    return colors[priority] || 'secondary';
  }

  getAvailabilityLabel(status: string): string {
    const labels: Record<string, string> = {
      'available': 'Disponible',
      'busy': 'Ocupado',
      'offline': 'Fuera de línea',
      'out_of_service': 'Fuera de servicio'
    };
    return labels[status] || status;
  }

  getAvailabilityColor(status: string): string {
    const colors: Record<string, string> = {
      'available': 'success',
      'busy': 'warning',
      'offline': 'secondary',
      'out_of_service': 'danger'
    };
    return colors[status] || 'secondary';
  }

  truncate(text: string | null | undefined, length: number): string {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  // ============================================================================
  // Chart Configuration
  // ============================================================================

  // Chart options
  readonly chartColorScheme: any = {
    domain: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
  };

  readonly chartView: [number, number] = [700, 400];
  readonly chartShowXAxis = true;
  readonly chartShowYAxis = true;
  readonly chartGradient = false;
  readonly chartShowLegend = true;
  readonly chartShowXAxisLabel = true;
  readonly chartShowYAxisLabel = true;
  readonly chartXAxisLabel = 'Categoría';
  readonly chartYAxisLabel = 'Cantidad';
  readonly chartShowLabels = true;
  readonly chartIsDoughnut = false;
  readonly chartLegendPosition: any = 'below';

  // Computed chart data
  readonly incidentsByStatusChartData = computed(() => {
    const chartsData = this.charts();
    if (!chartsData || !chartsData.incidents_by_status) return [];
    
    return chartsData.incidents_by_status.map(item => ({
      name: this.getStatusLabel(item.name),
      value: item.value
    }));
  });

  readonly incidentsByCategoryChartData = computed(() => {
    const chartsData = this.charts();
    if (!chartsData || !chartsData.incidents_by_category) return [];
    
    return chartsData.incidents_by_category.map(item => ({
      name: item.name || 'Sin categoría',
      value: item.value
    }));
  });

  readonly incidentsByPriorityChartData = computed(() => {
    const chartsData = this.charts();
    if (!chartsData || !chartsData.incidents_by_priority) return [];
    
    return chartsData.incidents_by_priority.map(item => ({
      name: this.getPriorityLabel(item.name),
      value: item.value
    }));
  });

  readonly workshopsByStatusChartData = computed(() => {
    const chartsData = this.charts();
    if (!chartsData || !chartsData.workshops_by_status) return [];
    
    return chartsData.workshops_by_status.map(item => ({
      name: this.getAvailabilityLabel(item.name),
      value: item.value
    }));
  });

  readonly incidentsTimelineChartData = computed(() => {
    const chartsData = this.charts();
    if (!chartsData || !chartsData.incidents_timeline) return [];
    
    return chartsData.incidents_timeline.map(item => ({
      name: item.name,
      series: item.series
    }));
  });

  // Chart event handlers
  onChartSelect(event: any) {
    console.log('Chart item selected:', event);
  }

  onChartActivate(event: any) {
    console.log('Chart item activated:', event);
  }

  onChartDeactivate(event: any) {
    console.log('Chart item deactivated:', event);
  }
}
