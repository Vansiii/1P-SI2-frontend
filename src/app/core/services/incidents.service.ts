import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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

export interface IncidentResponse {
  success: boolean;
  data: Incident[];
  message?: string;
}

export interface IncidentDetailResponse {
  success: boolean;
  data: Incident;
  message?: string;
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
  getIncidents(): Observable<IncidentResponse> {
    return this.http.get<IncidentResponse>(this.apiUrl);
  }

  /**
   * Obtiene los incidentes pendientes de asignación (para talleres)
   */
  getPendingIncidents(): Observable<IncidentResponse> {
    return this.http.get<IncidentResponse>(`${this.apiUrl}/pendientes/asignacion`);
  }

  /**
   * Obtiene el detalle de un incidente específico
   */
  getIncidentDetail(id: number): Observable<IncidentDetailResponse> {
    return this.http.get<IncidentDetailResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Acepta un incidente (para talleres)
   */
  acceptIncident(id: number): Observable<IncidentDetailResponse> {
    return this.http.post<IncidentDetailResponse>(`${this.apiUrl}/${id}/aceptar`, {});
  }

  /**
   * Rechaza un incidente (para talleres)
   */
  rejectIncident(id: number, motivo: string): Observable<IncidentDetailResponse> {
    return this.http.post<IncidentDetailResponse>(`${this.apiUrl}/${id}/rechazar`, { motivo });
  }

  /**
   * Actualiza el estado de un incidente
   */
  updateIncidentStatus(id: number, estado: string): Observable<IncidentDetailResponse> {
    return this.http.patch<IncidentDetailResponse>(`${this.apiUrl}/${id}/estado`, { estado });
  }
}
