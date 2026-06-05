/**
 * Admin Monitoring Models
 * 
 * TypeScript interfaces for admin monitoring dashboard.
 */

// ============================================================================
// System Metrics
// ============================================================================

export interface SystemMetrics {
  active_incidents: number;
  unassigned_incidents: number;
  pending_incidents: number;
  assigned_incidents: number;
  in_progress_incidents: number;
  resolved_today: number;
  total_incidents: number;
  available_workshops: number;
  busy_workshops: number;
  offline_workshops: number;
  active_technicians: number;
  available_technicians: number;
  on_duty_technicians: number;
  status_counts?: Record<string, number>;
  alerts?: any[];
  updated_at: string;
}

export interface TechnicianStatusChangedEvent extends AdminRealtimeEvent {
  event_type: 'technician.status_changed';
  payload: {
    technician_id: number;
    technician_name: string;
    workshop_id: number;
    old_status: string;
    new_status: string;
    active_count?: number;
    available_count?: number;
    on_duty_count?: number;
    incident_id?: number;
    changed_at: string;
  };
}

// ============================================================================
// Incidents
// ============================================================================

export interface IncidentsByStatus {
  [key: string]: number;
  pendiente: number;
  asignado: number;
  en_proceso: number;
  en_camino: number;
  en_sitio: number;
  resuelto: number;
  cancelado: number;
  sin_taller_disponible: number;
}

export interface IncidentBasic {
  id: number;
  descripcion: string;
  estado_actual: string;
  latitud: number | null;
  longitud: number | null;
  direccion_referencia: string | null;
  created_at: string;
  updated_at: string;
  cliente_id: number;
  vehiculo_id: number;
  taller_id: number | null;
  tecnico_id: number | null;
  cliente?: {
    id: number;
    nombre: string;
    apellido: string;
    email: string;
    telefono: string | null;
  };
  vehiculo?: {
    id: number;
    marca: string;
    modelo: string;
    anio: number;
    placa: string;
    color: string;
  };
  taller?: {
    id: number;
    workshop_name: string;
    address: string;
    phone: string | null;
  };
  tecnico?: {
    id: number;
    first_name: string;
    last_name: string;
    phone: string | null;
  };
}

export interface IncidentsResponse {
  incidents: IncidentBasic[];
  total: number;
  by_status: IncidentsByStatus;
}

// ============================================================================
// Workshops
// ============================================================================

export interface WorkshopsByStatus {
  available: number;
  busy: number;
  offline: number;
  out_of_service: number;
}

export interface WorkshopWithStatus {
  id: number;
  workshop_name: string;
  is_active?: boolean;
  is_available?: boolean;
  is_verified: boolean;
  address: string;
  coverage_radius_km: number;
  total_technicians: number;
  available_technicians: number;
  busy_technicians: number;
  active_incidents: number;
  availability_status: 'available' | 'busy' | 'offline' | 'out_of_service';
  updated_at: string;
}

export interface WorkshopsResponse {
  workshops: WorkshopWithStatus[];
  total: number;
  by_status: WorkshopsByStatus;
}

// ============================================================================
// Charts
// ============================================================================

export interface ChartDataPoint {
  name: string;
  value: number;
}

export interface TimelineDataPoint {
  name: string;
  series: {
    name: string;
    value: number;
  }[];
}

export interface ChartData {
  incidents_by_status: ChartDataPoint[];
  incidents_by_category: ChartDataPoint[];
  incidents_by_priority: ChartDataPoint[];
  workshops_by_status: ChartDataPoint[];
  incidents_timeline: TimelineDataPoint[];
}

// ============================================================================
// Filters
// ============================================================================

export interface IncidentFilters {
  estado?: string;
  prioridad_ia?: string;
  categoria_ia?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// State
// ============================================================================

export type MonitoringTab = 'overview' | 'incidents' | 'workshops' | 'charts';

export interface MonitoringState {
  currentTab: MonitoringTab;
  metrics: SystemMetrics | null;
  incidents: IncidentsResponse | null;
  workshops: WorkshopsResponse | null;
  charts: ChartData | null;
  filters: IncidentFilters;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

// ============================================================================
// Realtime Events
// ============================================================================

export interface AdminRealtimeEvent {
  event_type: string;
  payload?: any;
  timestamp: string;
  version?: string;
}

export interface DashboardMetricsUpdatedEvent extends AdminRealtimeEvent {
  event_type: 'dashboard.metrics_updated';
  payload: SystemMetrics;
}

export interface WorkshopAvailabilityChangedEvent extends AdminRealtimeEvent {
  event_type: 'workshop.availability_changed';
  payload: {
    workshop_id: number;
    workshop_name: string;
    old_status: string;
    new_status: string;
    available_technicians: number;
    busy_technicians: number;
    active_incidents: number;
    changed_at: string;
  };
}
