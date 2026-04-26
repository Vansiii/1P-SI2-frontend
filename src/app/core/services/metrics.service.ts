import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SystemMetrics {
  total_incidents: number;
  active_incidents: number;
  resolved_incidents: number;
  avg_response_time_minutes: number;
  avg_resolution_time_minutes: number;
  resolution_rate: number;
  active_technicians: number;
  active_workshops: number;
  total_distance_km: number;
  assignment_success_rate: number;
}

export interface WorkshopMetrics {
  workshop_id: number;
  workshop_name: string;
  total_incidents: number;
  resolved_incidents: number;
  avg_response_time_minutes: number;
  avg_resolution_time_minutes: number;
  resolution_rate: number;
  active_technicians: number;
  avg_rating: number;
}

export interface TechnicianMetrics {
  technician_id: number;
  technician_name: string;
  total_incidents: number;
  resolved_incidents: number;
  avg_response_time_minutes: number;
  avg_resolution_time_minutes: number;
  total_distance_km: number;
  avg_rating: number;
  acceptance_rate: number;
}

export interface CategoryMetrics {
  category_id: number;
  category_name: string;
  count: number;
  percentage: number;
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}

export interface TechnicianPerformance {
  technician_id: number;
  technician_name: string;
  total_incidents: number;
  resolved_incidents: number;
  avg_resolution_minutes: number;
  avg_rating: number;
  resolution_rate: number;
}

@Injectable({
  providedIn: 'root'
})
export class MetricsService {
  private baseUrl = `${environment.apiUrl}/api/v1/metrics`;
  private timeSeriesUrl = `${environment.apiUrl}/api/v1/metrics/timeseries`;

  constructor(private http: HttpClient) {}

  /**
   * Get system-wide metrics
   */
  getSystemMetrics(): Observable<{ data: SystemMetrics }> {
    return this.http.get<{ data: SystemMetrics }>(`${this.baseUrl}/system`);
  }

  /**
   * Get metrics for a specific workshop
   */
  getWorkshopMetrics(workshopId: number): Observable<{ data: WorkshopMetrics }> {
    return this.http.get<{ data: WorkshopMetrics }>(`${this.baseUrl}/workshops/${workshopId}`);
  }

  /**
   * Get metrics for a specific technician
   */
  getTechnicianMetrics(technicianId: number): Observable<{ data: TechnicianMetrics }> {
    return this.http.get<{ data: TechnicianMetrics }>(`${this.baseUrl}/technicians/${technicianId}`);
  }

  /**
   * Get incidents grouped by category
   */
  getIncidentsByCategory(): Observable<{ data: CategoryMetrics[] }> {
    return this.http.get<{ data: CategoryMetrics[] }>(`${this.baseUrl}/incidents/by-category`);
  }

  /**
   * Get response time time series
   */
  getResponseTimeSeries(days: number = 30, workshopId?: number): Observable<{ data: TimeSeriesDataPoint[] }> {
    let params = `?days=${days}`;
    if (workshopId) params += `&workshop_id=${workshopId}`;
    return this.http.get<{ data: TimeSeriesDataPoint[] }>(`${this.timeSeriesUrl}/response-time${params}`);
  }

  /**
   * Get resolution time time series
   */
  getResolutionTimeSeries(days: number = 30, workshopId?: number): Observable<{ data: TimeSeriesDataPoint[] }> {
    let params = `?days=${days}`;
    if (workshopId) params += `&workshop_id=${workshopId}`;
    return this.http.get<{ data: TimeSeriesDataPoint[] }>(`${this.timeSeriesUrl}/resolution-time${params}`);
  }

  /**
   * Get incidents count time series
   */
  getIncidentsCountSeries(days: number = 30, workshopId?: number, status?: string): Observable<{ data: TimeSeriesDataPoint[] }> {
    let params = `?days=${days}`;
    if (workshopId) params += `&workshop_id=${workshopId}`;
    if (status) params += `&status=${status}`;
    return this.http.get<{ data: TimeSeriesDataPoint[] }>(`${this.timeSeriesUrl}/incidents-count${params}`);
  }

  /**
   * Get technician performance
   */
  getTechnicianPerformance(workshopId: number, days: number = 30, limit: number = 10): Observable<{ data: TechnicianPerformance[] }> {
    return this.http.get<{ data: TechnicianPerformance[] }>(
      `${this.timeSeriesUrl}/technician-performance?workshop_id=${workshopId}&days=${days}&limit=${limit}`
    );
  }

  /**
   * Get hourly distribution
   */
  getHourlyDistribution(days: number = 30, workshopId?: number): Observable<{ data: any[] }> {
    let params = `?days=${days}`;
    if (workshopId) params += `&workshop_id=${workshopId}`;
    return this.http.get<{ data: any[] }>(`${this.timeSeriesUrl}/hourly-distribution${params}`);
  }
}
