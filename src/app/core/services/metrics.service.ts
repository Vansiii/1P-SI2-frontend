import { Injectable, inject, DestroyRef } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface IncidentReport {
  id: number;
  client_id: number;
  taller_id: number | null;
  estado_actual: string;
  created_at: string;
  categoria_ia?: string;
  direccion_referencia?: string;
  [key: string]: unknown;
}

export interface FinancialReport {
  summary: {
    total_collected: number;
    total_commission: number;
    total_workshop_net: number;
    transaction_count: number;
    total_withdrawn: number;
  };
  period: {
    start: string;
    end: string;
  };
}

export interface PerformanceReport {
  workshop_id: number;
  name: string;
  total_incidents: number;
  avg_response_min: number;
  avg_resolution_min: number;
}

// Nuevas interfaces para KPIs del taller
export interface KPIAssignmentTime {
  promedio_minutos: number;
  total_incidentes: number;
}

export interface KPIArrivalTime {
  promedio_minutos: number;
  total_con_llegada: number;
}

export interface KPIByType {
  tipo: string;
  total: number;
  porcentaje: number;
}

export interface KPIEfficiencyRanking {
  workshop_id: number;
  workshop_name: string;
  total_incidentes: number;
  resueltos: number;
  avg_respuesta_min: number;
  avg_resolucion_min: number;
  tasa_resolucion_pct: number;
  score_eficiencia: number;
}

export interface KPIHotspot {
  latitud: number;
  longitud: number;
  total: number;
  categorias: string;
}

export interface KPICancelMotivo {
  motivo: string;
  total: number;
}

export interface KPICancelledAnalysis {
  total_cancelados: number;
  total_no_atendidos: number;
  tasa_cancelacion_pct: number;
  motivos: KPICancelMotivo[];
}

export interface KPISLA {
  total_evaluables: number;
  dentro_de_sla: number;
  fuera_de_sla: number;
  cumplimiento_sla_pct: number;
  tiempo_promedio_real_min: number;
  tiempo_esperado_promedio_min: number;
  brecha_min: number;
}

export interface WorkshopKPIDashboard {
  workshop_id: number;
  periodo: { desde: string; hasta: string };
  kpi_asignacion: KPIAssignmentTime;
  kpi_llegada: KPIArrivalTime;
  kpi_tipos: KPIByType[];
  kpi_cancelados: KPICancelledAnalysis;
  kpi_sla: KPISLA;
  kpi_zonas: KPIHotspot[];
}

// Voice command interfaces
export interface VoiceCommandResult {
  action: string;
  type: string | null;
  filters: Record<string, string>;
  confidence: number;
  response_text: string;
}

export interface VoiceProcessResult {
  texto_transcrito: string;
  comando: VoiceCommandResult;
}

// Client report interfaces
export interface ClientReportSummary {
  total_incidentes: number;
  total_gastado: number;
  total_vehiculos: number;
  incidentes_activos: number;
  rating_promedio: number | null;
}

export interface SpendingByMonth {
  mes: string;
  total: number;
  cantidad: number;
}

export interface ClientSpendingReport {
  total_gastado: number;
  total_transacciones: number;
  por_mes: SpendingByMonth[];
}

export interface VehicleServiceEntry {
  incidente_id: number;
  fecha: string;
  categoria: string | null;
  estado: string;
  costo: number | null;
  taller_nombre: string | null;
}

export interface VehicleHistoryReport {
  vehiculo_id: number;
  matricula: string;
  total_servicios: number;
  servicios: VehicleServiceEntry[];
}

@Injectable({
  providedIn: 'root'
})
export class MetricsService {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  private baseUrl = `${environment.apiBaseUrl}/stats`;

  /** Get dashboard metrics for system admin */
  getSystemMetrics(start?: string, end?: string): Observable<{ 
    incidents: { total: number }; 
    resources: { active_workshops: number }; 
    performance: { assignment_success_rate: number } 
  }> {
    let params = new HttpParams();
    if (start) params = params.set('start_date', start);
    if (end) params = params.set('end_date', end);
    return this.http.get<{ data: { 
      incidents: { total: number }; 
      resources: { active_workshops: number }; 
      performance: { assignment_success_rate: number } 
    } }>(`${this.baseUrl}/system`, { params }).pipe(map(res => res.data));
  }

  /** Get dashboard metrics for a workshop */
  getWorkshopMetrics(workshopId: number, start?: string, end?: string): Observable<{ total_incidents: number; total_revenue: number; avg_response_time: number }> {
    let params = new HttpParams();
    if (start) params = params.set('start_date', start);
    if (end) params = params.set('end_date', end);
    return this.http.get<{ data: { total_incidents: number; total_revenue: number; avg_response_time: number } }>(`${this.baseUrl}/workshops/${workshopId}`, { params }).pipe(map(res => res.data));
  }

  /** Get incident report */
  getIncidentReport(start: string, end: string, categoryId?: number, status?: string, workshopId?: number): Observable<IncidentReport[]> {
    let params = new HttpParams().set('start_date', start).set('end_date', end);
    if (categoryId) params = params.set('category_id', categoryId);
    if (status) params = params.set('status', status);
    if (workshopId) params = params.set('workshop_id', workshopId);
    
    return this.http.get<{ data: IncidentReport[] }>(`${this.baseUrl}/summary/incidents`, { params }).pipe(map(res => res.data));
  }

  /** Get financial report */
  getFinancialReport(start: string, end: string, workshopId?: number): Observable<FinancialReport> {
    let params = new HttpParams().set('start_date', start).set('end_date', end);
    if (workshopId) params = params.set('workshop_id', workshopId);
    
    return this.http.get<{ data: FinancialReport }>(`${this.baseUrl}/summary/financial`, { params }).pipe(map(res => res.data));
  }

  /** Get performance report */
  getPerformanceReport(start?: string, end?: string, workshopId?: number): Observable<PerformanceReport[]> {
    let params = new HttpParams();
    if (start) params = params.set('start_date', start);
    if (end) params = params.set('end_date', end);
    if (workshopId) params = params.set('workshop_id', workshopId);
    
    return this.http.get<{ data: PerformanceReport[] }>(`${this.baseUrl}/summary/performance`, { params }).pipe(map(res => res.data));
  }

  /** Export report to PDF or Excel */
  exportReport(type: 'incident' | 'financial' | 'performance', format: 'pdf' | 'excel', start: string, end: string, workshopId?: number): void {
    let params = new HttpParams()
      .set('report_type', type)
      .set('start_date', start)
      .set('end_date', end);
    
    if (workshopId) params = params.set('workshop_id', workshopId);

    const url = `${this.baseUrl}/summary/download/${format}`;
    
    this.http.get(url, { params, responseType: 'blob' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (blob) => {
        const fileName = `report_${type}_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(objectUrl);
      },
      error: (err) => console.error('Export failed:', err)
    });
  }

  // Legacy methods restored for existing dashboard
  getIncidentsByCategory(start?: string, end?: string): Observable<{ categories: { category_name: string; count: number }[] }> {
    let params = new HttpParams();
    if (start) params = params.set('start_date', start);
    if (end) params = params.set('end_date', end);
    return this.http.get<{ data: { categories: { category_name: string; count: number }[] } }>(`${this.baseUrl}/summary/categories`, { params }).pipe(map(res => res.data));
  }

  getResponseTimeSeries(days = 30): Observable<{ date: string; value: number }[]> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<{ data: { date: string; value: number }[] }>(`${this.baseUrl}/timeline/response-time`, { params }).pipe(map(res => res.data));
  }

  getTechnicianPerformance(workshopId: number, days = 30): Observable<{ technician_name: string; performance_score: number }[]> {
    const params = new HttpParams()
      .set('workshop_id', workshopId.toString())
      .set('days', days.toString());
    return this.http.get<{ data: { technician_name: string; performance_score: number }[] }>(`${this.baseUrl}/timeline/technician-performance`, { params }).pipe(map(res => res.data));
  }

  /** Obtener dashboard unificado de KPIs del taller */
  getWorkshopKPIDashboard(workshopId: number, startDate?: string, endDate?: string): Observable<WorkshopKPIDashboard> {
    let params = new HttpParams();
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);
    return this.http.get<{ data: WorkshopKPIDashboard }>(
      `${this.baseUrl}/workshop/${workshopId}/kpis/dashboard`, { params }
    ).pipe(map(res => res.data));
  }

  /** Obtener ranking de eficiencia de talleres */
  getEfficiencyRanking(startDate?: string, endDate?: string): Observable<KPIEfficiencyRanking[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);
    return this.http.get<{ data: KPIEfficiencyRanking[] }>(
      `${this.baseUrl}/workshop/kpis/efficiency-ranking`, { params }
    ).pipe(map(res => res.data));
  }

  /** Obtener hotspots/zonas críticas (global admin o por taller) */
  getHotspots(workshopId?: number, startDate?: string, endDate?: string): Observable<KPIHotspot[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);
    const endpoint = workshopId
      ? `${this.baseUrl}/workshop/${workshopId}/kpis/hotspots`
      : `${this.baseUrl}/workshop/kpis/hotspots`;
    return this.http.get<{ data: KPIHotspot[] }>(endpoint, { params }).pipe(map(res => res.data));
  }

  // ---- Voice commands ----

  /** Enviar comando de texto para interpretación */
  sendVoiceCommand(texto: string): Observable<VoiceProcessResult> {
    return this.http.post<{ data: VoiceProcessResult }>(
      `${environment.apiBaseUrl}/voice/command`, { texto }
    ).pipe(map(res => res.data));
  }

  /** Enviar audio para pipeline completo (transcripción + interpretación) */
  sendVoiceReport(audioBase64: string, mimeType = 'audio/webm'): Observable<VoiceProcessResult> {
    return this.http.post<{ data: VoiceProcessResult }>(
      `${environment.apiBaseUrl}/voice/report`, { audio_base64: audioBase64, mime_type: mimeType }
    ).pipe(map(res => res.data));
  }

  // ---- Client reports ----

  /** Obtener resumen del cliente */
  getClientSummary(): Observable<ClientReportSummary> {
    return this.http.get<{ data: ClientReportSummary }>(
      `${environment.apiBaseUrl}/client/reports/summary`
    ).pipe(map(res => res.data));
  }

  /** Obtener reporte de gastos del cliente */
  getClientSpending(startDate?: string, endDate?: string): Observable<ClientSpendingReport> {
    let params = new HttpParams();
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);
    return this.http.get<{ data: ClientSpendingReport }>(
      `${environment.apiBaseUrl}/client/reports/spending`, { params }
    ).pipe(map(res => res.data));
  }

  /** Obtener historial de un vehículo */
  getVehicleHistory(vehiculoId: number): Observable<VehicleHistoryReport> {
    return this.http.get<{ data: VehicleHistoryReport }>(
      `${environment.apiBaseUrl}/client/reports/vehicle/${vehiculoId}/history`
    ).pipe(map(res => res.data));
  }
}
