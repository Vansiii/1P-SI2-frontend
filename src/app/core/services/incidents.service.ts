import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';

export interface Incident {
  id: number;
  cliente_id: number;
  vehiculo_id: number;
  taller_id: number | null;
  tecnico_id: number | null;
  estado_actual: string;
  estado_label: string;
  descripcion: string;
  latitud: number;
  longitud: number;
  direccion_referencia: string | null;
  categoria_ia: string | null;
  prioridad_ia: string | null;
  prioridad_label: string;
  created_at: string;
  updated_at: string;
  cliente?: {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  vehiculo?: {
    id: number;
    marca: string;
    modelo: string;
    anio: number;
    placa: string;
  };
}

export type IncidentAiAnalysisStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface IncidentAiAnalysis {
  id: number;
  incident_id: number;
  status: IncidentAiAnalysisStatus;
  model_name: string;
  prompt_version: string;
  request_hash: string;
  attempt_number: number;
  category: string | null;
  priority: string | null;
  summary: string | null;
  is_ambiguous: boolean;
  confidence: number | null;
  findings: string[];
  missing_data: string[];
  workshop_recommendation: string | null;
  error_code: string | null;
  error_message: string | null;
  latency_ms: number | null;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class IncidentsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/incidentes`;

  /**
   * Obtiene todos los incidentes del usuario actual
   */
  getIncidents(): Observable<Incident[]> {
    return this.http.get<ApiResponse<Incident[]>>(this.apiUrl).pipe(
      map(response => response.data)
    );
  }

  /**
   * Obtiene los incidentes pendientes de asignación (para talleres)
   */
  getPendingIncidents(): Observable<Incident[]> {
    return this.http.get<ApiResponse<Incident[]>>(`${this.apiUrl}/pendientes/asignacion`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Obtiene el detalle de un incidente específico
   */
  getIncidentDetail(id: number): Observable<Incident> {
    return this.http.get<ApiResponse<Incident>>(`${this.apiUrl}/${id}`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Acepta un incidente (para talleres)
   */
  acceptIncident(id: number): Observable<Incident> {
    return this.http.post<ApiResponse<Incident>>(`${this.apiUrl}/${id}/aceptar`, {}).pipe(
      map(response => response.data)
    );
  }

  /**
   * Rechaza un incidente (para talleres)
   */
  rejectIncident(id: number, motivo: string): Observable<Incident> {
    return this.http.post<ApiResponse<Incident>>(`${this.apiUrl}/${id}/rechazar`, { motivo }).pipe(
      map(response => response.data)
    );
  }

  /**
   * Actualiza el estado de un incidente
   */
  updateIncidentStatus(id: number, estado: string): Observable<Incident> {
    return this.http.patch<ApiResponse<Incident>>(`${this.apiUrl}/${id}/estado`, { estado }).pipe(
      map(response => response.data)
    );
  }

  /**
   * Gets latest UC10 AI analysis for one incident.
   */
  getLatestIncidentAiAnalysis(id: number): Observable<IncidentAiAnalysis> {
    return this.http.get<ApiResponse<IncidentAiAnalysis>>(`${this.apiUrl}/${id}/analisis-ia`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Gets UC10 AI analysis history for one incident.
   */
  getIncidentAiAnalysisHistory(id: number): Observable<IncidentAiAnalysis[]> {
    return this.http.get<ApiResponse<IncidentAiAnalysis[]>>(`${this.apiUrl}/${id}/analisis-ia/historial`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Triggers UC10 AI processing (manual/admin endpoint).
   */
  processIncidentWithAi(id: number): Observable<IncidentAiAnalysis> {
    return this.http.post<ApiResponse<IncidentAiAnalysis>>(`${this.apiUrl}/${id}/procesar-ia`, {}).pipe(
      map(response => response.data)
    );
  }

  /**
   * Triggers UC10 AI reprocessing (manual/admin endpoint).
   */
  reprocessIncidentWithAi(id: number): Observable<IncidentAiAnalysis> {
    return this.http.post<ApiResponse<IncidentAiAnalysis>>(`${this.apiUrl}/${id}/reprocesar-ia`, {}).pipe(
      map(response => response.data)
    );
  }
}
