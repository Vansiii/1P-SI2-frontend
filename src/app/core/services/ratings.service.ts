import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RatingCreate {
  rating: number;
  comment?: string;
}

export interface RatingResponse {
  id: number;
  incident_id: number;
  client_id: number;
  workshop_id: number;
  technician_id: number | null;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class RatingsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/v1/ratings`;

  /**
   * Create a rating for an incident
   */
  createRating(incidentId: number, data: RatingCreate): Observable<ApiResponse<RatingResponse>> {
    return this.http.post<ApiResponse<RatingResponse>>(
      `${this.apiUrl}/incidents/${incidentId}`,
      data
    );
  }

  /**
   * Get rating for a specific incident
   */
  getIncidentRating(incidentId: number): Observable<ApiResponse<RatingResponse | null>> {
    return this.http.get<ApiResponse<RatingResponse | null>>(
      `${this.apiUrl}/incidents/${incidentId}`
    );
  }

  /**
   * Check if incident can be rated
   */
  canRateIncident(incidentStatus: string): boolean {
    return incidentStatus === 'resuelto';
  }
}
