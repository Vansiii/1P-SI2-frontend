import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WebSocketService } from './websocket.service';

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  recorded_at?: string;
}

export interface TechnicianLocation {
  technician_id: number;
  incident_id: number | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: string;
}

export interface TrackingSessionEvent {
  tracking_session_id: number;
  technician_id: number;
  incident_id: number;
  started_at: string;
  ended_at?: string;
  total_distance_km?: number;
  timestamp: string;
}

export interface TrackingSession {
  id: number;
  technician_id: number;
  incident_id: number | null;
  started_at: string;
  ended_at: string | null;
  arrived_at: string | null;
  is_active: boolean;
  total_distance_km: number | null;
}

export interface LocationHistory {
  id: number;
  technician_id: number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
  created_at: string;
}

export interface TrackingStatistics {
  total_sessions: number;
  active_sessions: number;
  completed_sessions: number;
  total_distance_km: number;
  average_distance_km: number;
  average_duration_minutes: number;
}

@Injectable({
  providedIn: 'root'
})
export class TrackingService {
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebSocketService);
  private readonly apiUrl = `${environment.apiUrl}/tracking`;

  // Reactive state: current technician location (null when no active tracking)
  private technicianLocationSubject = new BehaviorSubject<TechnicianLocation | null>(null);
  public technicianLocation$ = this.technicianLocationSubject.asObservable();

  // Reactive state: whether a tracking session is currently active
  private trackingActiveSubject = new BehaviorSubject<boolean>(false);
  public trackingActive$ = this.trackingActiveSubject.asObservable();

  // Reactive state: current tracking session metadata
  private trackingSessionSubject = new BehaviorSubject<TrackingSessionEvent | null>(null);
  public trackingSession$ = this.trackingSessionSubject.asObservable();

  constructor() {
    this.subscribeToWebSocket();
  }

  /**
   * Subscribe to WebSocket events for real-time location tracking updates.
   * Handles: location_update, tracking_started, tracking_ended
   */
  private subscribeToWebSocket(): void {
    this.wsService.messages$.subscribe(message => {
      switch (message.type) {
        case 'location_update':
          this.handleLocationUpdate(message.data);
          break;
        case 'tracking_started':
          this.handleTrackingStarted(message.data);
          break;
        case 'tracking_ended':
          this.handleTrackingEnded(message.data);
          break;
      }
    });
  }

  /**
   * Handle incoming location_update event.
   * Updates only the coordinates in the BehaviorSubject — no map re-render needed.
   * Payload: { technician_id, incident_id, latitude, longitude, accuracy, speed, heading, timestamp }
   */
  private handleLocationUpdate(data: any): void {
    const location: TechnicianLocation = {
      technician_id: data.technician_id,
      incident_id: data.incident_id ?? null,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy ?? null,
      speed: data.speed ?? null,
      heading: data.heading ?? null,
      timestamp: data.timestamp || new Date().toISOString()
    };

    this.technicianLocationSubject.next(location);
    console.log(`📍 Location update for technician ${data.technician_id}: [${data.latitude}, ${data.longitude}]`);
  }

  /**
   * Handle incoming tracking_started event.
   * Sets trackingActive to true and stores session metadata.
   * Payload: { tracking_session_id, technician_id, incident_id, started_at, timestamp }
   */
  private handleTrackingStarted(data: any): void {
    const session: TrackingSessionEvent = {
      tracking_session_id: data.tracking_session_id,
      technician_id: data.technician_id,
      incident_id: data.incident_id,
      started_at: data.started_at,
      timestamp: data.timestamp || new Date().toISOString()
    };

    this.trackingSessionSubject.next(session);
    this.trackingActiveSubject.next(true);
    console.log(`🚀 Tracking started for technician ${data.technician_id}, session ${data.tracking_session_id}`);
  }

  /**
   * Handle incoming tracking_ended event.
   * Sets trackingActive to false and clears location state.
   * Payload: { tracking_session_id, technician_id, incident_id, started_at, ended_at, total_distance_km, timestamp }
   */
  private handleTrackingEnded(data: any): void {
    const session: TrackingSessionEvent = {
      tracking_session_id: data.tracking_session_id,
      technician_id: data.technician_id,
      incident_id: data.incident_id,
      started_at: data.started_at,
      ended_at: data.ended_at,
      total_distance_km: data.total_distance_km,
      timestamp: data.timestamp || new Date().toISOString()
    };

    this.trackingSessionSubject.next(session);
    this.trackingActiveSubject.next(false);
    this.technicianLocationSubject.next(null);
    console.log(`🏁 Tracking ended for technician ${data.technician_id}, distance: ${data.total_distance_km} km`);
  }

  /**
   * Get the current technician location snapshot
   */
  getCurrentLocation(): TechnicianLocation | null {
    return this.technicianLocationSubject.value;
  }

  /**
   * Get whether tracking is currently active
   */
  isTrackingActive(): boolean {
    return this.trackingActiveSubject.value;
  }

  /**
   * Obtener historial de ubicaciones de una sesión
   */
  getSessionHistory(sessionId: number, limit?: number): Observable<LocationHistory[]> {
    let params = new HttpParams();
    if (limit) {
      params = params.set('limit', limit.toString());
    }

    return this.http.get<LocationHistory[]>(
      `${this.apiUrl}/sessions/${sessionId}/history`,
      { params }
    );
  }

  /**
   * Obtener historial de ubicaciones de un técnico
   */
  getTechnicianHistory(
    technicianId: number,
    startTime?: string,
    endTime?: string,
    limit = 100
  ): Observable<LocationHistory[]> {
    let params = new HttpParams().set('limit', limit.toString());
    
    if (startTime) {
      params = params.set('start_time', startTime);
    }
    if (endTime) {
      params = params.set('end_time', endTime);
    }

    return this.http.get<LocationHistory[]>(
      `${this.apiUrl}/technicians/${technicianId}/history`,
      { params }
    );
  }

  /**
   * Obtener sesiones de tracking de un incidente
   */
  getIncidentSessions(incidentId: number): Observable<TrackingSession[]> {
    return this.http.get<TrackingSession[]>(
      `${this.apiUrl}/incidents/${incidentId}/sessions`
    );
  }

  /**
   * Obtener estadísticas de tracking
   */
  getStatistics(
    technicianId?: number,
    startDate?: string,
    endDate?: string
  ): Observable<TrackingStatistics> {
    let params = new HttpParams();
    
    if (technicianId) {
      params = params.set('technician_id', technicianId.toString());
    }
    if (startDate) {
      params = params.set('start_date', startDate);
    }
    if (endDate) {
      params = params.set('end_date', endDate);
    }

    return this.http.get<TrackingStatistics>(
      `${this.apiUrl}/statistics`,
      { params }
    );
  }
}
