import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RouteRequest {
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
}

export interface RouteGeometry {
  type: string;
  coordinates: [number, number][];
}

export interface RouteResponse {
  distance_km: number;
  duration_minutes: number;
  geometry: RouteGeometry;
  steps?: any[];
  source?: string;
}

export interface ETARequest {
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  current_speed_kmh?: number;
}

export interface ETAResponse {
  distance_km: number;
  duration_minutes: number;
  eta_formatted: string;
  arrival_time: string;
}

@Injectable({
  providedIn: 'root'
})
export class RoutingService {
  private baseUrl = `${environment.apiUrl}/routing`;

  constructor(private http: HttpClient) {}

  /**
   * Calculate route between two points
   */
  calculateRoute(request: RouteRequest): Observable<RouteResponse> {
    return this.http.post<RouteResponse>(
      `${this.baseUrl}/calculate-route`,
      request
    );
  }

  /**
   * Calculate ETA between two points
   */
  calculateETA(request: ETARequest): Observable<ETAResponse> {
    return this.http.post<ETAResponse>(
      `${this.baseUrl}/calculate-eta`,
      request
    );
  }

  /**
   * Reverse geocode coordinates to address
   */
  reverseGeocode(lat: number, lng: number): Observable<{ data: any }> {
    return this.http.post<{ data: any }>(
      `${this.baseUrl}/reverse-geocode`,
      { lat, lng }
    );
  }

  /**
   * Geocode address to coordinates
   */
  geocode(address: string): Observable<{ data: any }> {
    return this.http.post<{ data: any }>(
      `${this.baseUrl}/geocode`,
      { address }
    );
  }

  /**
   * Search nearby places
   */
  searchNearby(lat: number, lng: number, query: string, radius = 5000): Observable<{ data: any[] }> {
    return this.http.post<{ data: any[] }>(
      `${this.baseUrl}/search-nearby`,
      { lat, lng, query, radius }
    );
  }
}
