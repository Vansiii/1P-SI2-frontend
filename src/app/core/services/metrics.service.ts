import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface IncidentReport {
  id: number;
  client_id: number;
  taller_id: number | null;
  estado_actual: string;
  created_at: string;
  categoria_ia?: string;
  [key: string]: any;
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

@Injectable({
  providedIn: 'root'
})
export class MetricsService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/metrics`;

  /** Get dashboard metrics for system admin */
  getSystemMetrics(start?: string, end?: string): Observable<any> {
    let params = new HttpParams();
    if (start) params = params.set('start_date', start);
    if (end) params = params.set('end_date', end);
    return this.http.get<any>(`${this.baseUrl}/system`, { params }).pipe(map(res => res.data));
  }

  /** Get dashboard metrics for a workshop */
  getWorkshopMetrics(workshopId: number, start?: string, end?: string): Observable<any> {
    let params = new HttpParams();
    if (start) params = params.set('start_date', start);
    if (end) params = params.set('end_date', end);
    return this.http.get<any>(`${this.baseUrl}/workshops/${workshopId}`, { params }).pipe(map(res => res.data));
  }

  /** Get incident report */
  getIncidentReport(start: string, end: string, categoryId?: number, status?: string, workshopId?: number): Observable<IncidentReport[]> {
    let params = new HttpParams().set('start_date', start).set('end_date', end);
    if (categoryId) params = params.set('category_id', categoryId);
    if (status) params = params.set('status', status);
    if (workshopId) params = params.set('workshop_id', workshopId);
    
    return this.http.get<any>(`${this.baseUrl}/reports/incidents`, { params }).pipe(map(res => res.data));
  }

  /** Get financial report */
  getFinancialReport(start: string, end: string, workshopId?: number): Observable<FinancialReport> {
    let params = new HttpParams().set('start_date', start).set('end_date', end);
    if (workshopId) params = params.set('workshop_id', workshopId);
    
    return this.http.get<any>(`${this.baseUrl}/reports/financial`, { params }).pipe(map(res => res.data));
  }

  /** Get performance report */
  getPerformanceReport(start?: string, end?: string, workshopId?: number): Observable<PerformanceReport[]> {
    let params = new HttpParams();
    if (start) params = params.set('start_date', start);
    if (end) params = params.set('end_date', end);
    if (workshopId) params = params.set('workshop_id', workshopId);
    
    return this.http.get<any>(`${this.baseUrl}/reports/performance`, { params }).pipe(map(res => res.data));
  }

  /** Export report to PDF or Excel */
  exportReport(type: 'incident' | 'financial' | 'performance', format: 'pdf' | 'excel', start: string, end: string, workshopId?: number): void {
    let params = new HttpParams()
      .set('report_type', type)
      .set('start_date', start)
      .set('end_date', end);
    
    if (workshopId) params = params.set('workshop_id', workshopId);

    const url = `${this.baseUrl}/reports/export/${format}`;
    
    this.http.get(url, { params, responseType: 'blob' }).subscribe({
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
  getIncidentsByCategory(start?: string, end?: string): Observable<any> {
    let params = new HttpParams();
    if (start) params = params.set('start_date', start);
    if (end) params = params.set('end_date', end);
    return this.http.get<any>(`${this.baseUrl}/incidents/by-category`, { params }).pipe(map(res => res.data));
  }

  getResponseTimeSeries(days: number = 30): Observable<any> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<any>(`${this.baseUrl}/timeseries/response-time`, { params });
  }

  getTechnicianPerformance(workshopId: number, days: number = 30): Observable<any> {
    const params = new HttpParams()
      .set('workshop_id', workshopId.toString())
      .set('days', days.toString());
    return this.http.get<any>(`${this.baseUrl}/timeseries/technician-performance`, { params });
  }
}
