import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CancellationRequest {
  id: number;
  incident_id: number;
  requested_by: string;
  requested_by_user_id: number;
  reason: string;
  status: string;
  response_by_user_id?: number;
  response_message?: string;
  responded_at?: string;
  created_at: string;
  expires_at: string;
}

export interface CancellationRequestCreate {
  reason: string;
}

export interface CancellationResponse {
  accept: boolean;
  response_message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CancellationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/cancellation`;

  /**
   * Solicitar cancelación mutua de un incidente
   */
  requestCancellation(incidentId: number, request: CancellationRequestCreate): Observable<CancellationRequest> {
    return this.http.post<CancellationRequest>(`${this.apiUrl}/incidents/${incidentId}/request`, request);
  }

  /**
   * Responder a una solicitud de cancelación
   */
  respondToCancellation(requestId: number, response: CancellationResponse): Observable<CancellationRequest> {
    return this.http.post<CancellationRequest>(`${this.apiUrl}/requests/${requestId}/respond`, response);
  }

  /**
   * Obtener solicitud de cancelación pendiente para un incidente
   */
  getPendingCancellation(incidentId: number): Observable<CancellationRequest | null> {
    return this.http.get<CancellationRequest | null>(`${this.apiUrl}/incidents/${incidentId}/pending`);
  }
}