import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import {
  Cotizacion,
  CotizacionListItem,
  SolicitarCotizacionRequest,
  ResponderCotizacionRequest,
} from '../models/cotizacion.model';

@Injectable({ providedIn: 'root' })
export class CotizacionesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}`;

  readonly cotizaciones = signal<CotizacionListItem[]>([]);
  readonly selectedCotizacion = signal<Cotizacion | null>(null);
  readonly loading = signal(false);

  solicitarCotizacion(request: SolicitarCotizacionRequest): Observable<Cotizacion> {
    return this.http
      .post<ApiResponse<Cotizacion>>(`${this.apiUrl}/cotizaciones/solicitar`, request)
      .pipe(map((r) => r.data));
  }

  getCotizacionesCliente(estado?: string): Observable<CotizacionListItem[]> {
    let params = new HttpParams();
    if (estado) {
      params = params.set('estado', estado);
    }
    return this.http
      .get<ApiResponse<CotizacionListItem[]>>(`${this.apiUrl}/cotizaciones/`, { params })
      .pipe(map((r) => r.data));
  }

  getCotizacionDetalle(id: number): Observable<Cotizacion> {
    return this.http
      .get<ApiResponse<Cotizacion>>(`${this.apiUrl}/cotizaciones/${id}`)
      .pipe(map((r) => r.data));
  }

  getCotizacionesTaller(): Observable<CotizacionListItem[]> {
    return this.http
      .get<ApiResponse<CotizacionListItem[]>>(`${this.apiUrl}/workshop/cotizaciones/`)
      .pipe(map((r) => r.data));
  }

  getCotizacionTallerDetalle(id: number): Observable<Cotizacion> {
    return this.http
      .get<ApiResponse<Cotizacion>>(`${this.apiUrl}/workshop/cotizaciones/${id}`)
      .pipe(map((r) => r.data));
  }

  responderCotizacion(id: number, request: ResponderCotizacionRequest): Observable<Record<string, unknown>> {
    return this.http
      .post<ApiResponse<Record<string, unknown>>>(`${this.apiUrl}/workshop/cotizaciones/${id}/responder`, request)
      .pipe(map((r) => r.data));
  }

  seleccionarTaller(cotizacionId: number, respuestaId: number): Observable<Record<string, unknown>> {
    return this.http
      .post<ApiResponse<Record<string, unknown>>>(`${this.apiUrl}/cotizaciones/${cotizacionId}/seleccionar-taller`, {
        cotizacion_respuesta_id: respuestaId,
      })
      .pipe(map((r) => r.data));
  }

  cancelarCotizacion(id: number): Observable<Record<string, unknown>> {
    return this.http
      .patch<ApiResponse<Record<string, unknown>>>(`${this.apiUrl}/cotizaciones/${id}/cancelar`, {})
      .pipe(map((r) => r.data));
  }
}
