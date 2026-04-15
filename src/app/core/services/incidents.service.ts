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
}
