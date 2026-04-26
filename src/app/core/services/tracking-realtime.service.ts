import { Injectable, inject, DestroyRef, signal } from '@angular/core';
import { EventDispatcherService } from './event-dispatcher.service';
import { 
  RealtimeEvent
} from '../models/realtime-events.models';
import { Subject } from 'rxjs';

/**
 * Technician location data
 */
export interface TechnicianLocation {
  technicianId: number;
  incidentId: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

/**
 * Tracking session data
 */
export interface TrackingSession {
  sessionId: number;
  incidentId: number;
  technicianId: number;
  startTime: string;
  endTime?: string;
  totalDistance?: number;
  status: 'active' | 'ended';
}

/**
 * Route update data
 */
export interface RouteUpdate {
  incidentId: number;
  technicianId: number;
  estimatedArrival: string;
  distanceRemaining: number;
  routePoints: { latitude: number; longitude: number }[];
  updatedAt: string;
}

/**
 * Tracking Real-Time Service
 * 
 * Handles real-time updates for technician tracking and location.
 * Provides live location updates, ETA calculations, and route information.
 */
@Injectable({
  providedIn: 'root'
})
export class TrackingRealtimeService {
  private readonly eventDispatcher = inject(EventDispatcherService);
  private readonly destroyRef = inject(DestroyRef);

  // Technician locations by incident ID
  readonly technicianLocations = signal<Map<number, TechnicianLocation>>(new Map());

  // Active tracking sessions by incident ID
  readonly trackingSessions = signal<Map<number, TrackingSession>>(new Map());

  // Route updates by incident ID
  readonly routeUpdates = signal<Map<number, RouteUpdate>>(new Map());

  // Location update stream
  private readonly locationUpdateSubject = new Subject<TechnicianLocation>();
  readonly locationUpdate$ = this.locationUpdateSubject.asObservable();

  // Session update stream
  private readonly sessionUpdateSubject = new Subject<TrackingSession>();
  readonly sessionUpdate$ = this.sessionUpdateSubject.asObservable();

  // Route update stream
  private readonly routeUpdateSubject = new Subject<RouteUpdate>();
  readonly routeUpdate$ = this.routeUpdateSubject.asObservable();

  private unsubscribers: (() => void)[] = [];

  constructor() {
    this.setupEventHandlers();

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  /**
   * Setup event handlers for all tracking events
   */
  private setupEventHandlers(): void {
    const trackingEventTypes = [
      'tracking.location_updated',
      'tracking.session_started',
      'tracking.session_ended',
      'tracking.route_updated'
    ];

    const unsubscribe = this.eventDispatcher.subscribeMultiple(
      trackingEventTypes,
      (event) => this.handleTrackingEvent(event)
    );

    this.unsubscribers.push(unsubscribe);

    console.log('✅ TrackingRealtimeService: Event handlers setup complete');
  }

  /**
   * Handle tracking event
   */
  private handleTrackingEvent(event: RealtimeEvent): void {
    console.log('📍 Processing tracking event:', event.type, event);

    try {
      switch (event.type) {
        case 'tracking.location_updated':
        case 'location_update':
          this.handleLocationUpdated(event);
          break;
        case 'tracking.session_started':
        case 'tracking_started':
          this.handleSessionStarted(event);
          break;
        case 'tracking.session_ended':
        case 'tracking_ended':
          this.handleSessionEnded(event);
          break;
        case 'tracking.route_updated':
          this.handleRouteUpdated(event);
          break;
        default:
          console.warn('⚠️ Unknown tracking event type:', event.type);
      }
    } catch (error) {
      console.error('❌ Error handling tracking event:', error, event);
    }
  }

  /**
   * Handle location updated event
   */
  private handleLocationUpdated(event: RealtimeEvent): void {
    try {
      const payload = event.data || event;
      
      if (!payload.incident_id || !payload.technician_id) {
        console.error('❌ Invalid location_updated event: missing required fields', event);
        return;
      }
      
      const location: TechnicianLocation = {
        technicianId: payload.technician_id,
        incidentId: payload.incident_id,
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy,
        heading: payload.heading,
        speed: payload.speed,
        timestamp: payload.timestamp || event.timestamp
      };

      // Update location for this incident
      this.technicianLocations.update(locations => {
        const newMap = new Map(locations);
        newMap.set(payload.incident_id, location);
        return newMap;
      });

      // Emit location update
      this.locationUpdateSubject.next(location);

      console.log('📍 Technician location updated:', location);
    } catch (error) {
      console.error('❌ Error handling location_updated event:', error, event);
    }
  }

  /**
   * Handle session started event
   */
  private handleSessionStarted(event: RealtimeEvent): void {
    try {
      const payload = event.data || event;
      
      if (!payload.incident_id || !payload.technician_id) {
        console.error('❌ Invalid session_started event: missing required fields', event);
        return;
      }
      
      const session: TrackingSession = {
        sessionId: payload.session_id,
        incidentId: payload.incident_id,
        technicianId: payload.technician_id,
        startTime: payload.start_time || event.timestamp,
        status: 'active'
      };

      // Add session for this incident
      this.trackingSessions.update(sessions => {
        const newMap = new Map(sessions);
        newMap.set(payload.incident_id, session);
        return newMap;
      });

      // Emit session update
      this.sessionUpdateSubject.next(session);

      console.log('🚀 Tracking session started:', session);
    } catch (error) {
      console.error('❌ Error handling session_started event:', error, event);
    }
  }

  /**
   * Handle session ended event
   */
  private handleSessionEnded(event: RealtimeEvent): void {
    try {
      const payload = event.data || event;
      
      if (!payload.incident_id) {
        console.error('❌ Invalid session_ended event: missing incident_id', event);
        return;
      }
      
      // Update session status
      this.trackingSessions.update(sessions => {
        const newMap = new Map(sessions);
        const session = newMap.get(payload.incident_id);
        
        if (session) {
          newMap.set(payload.incident_id, {
            ...session,
            endTime: payload.end_time || event.timestamp,
            totalDistance: payload.total_distance,
            status: 'ended'
          });
        }
        
        return newMap;
      });

      console.log('🏁 Tracking session ended for incident:', payload.incident_id);
    } catch (error) {
      console.error('❌ Error handling session_ended event:', error, event);
    }
  }

  /**
   * Handle route updated event
   */
  private handleRouteUpdated(event: RealtimeEvent): void {
    try {
      const payload = event.data || event;
      
      if (!payload.incident_id || !payload.technician_id) {
        console.error('❌ Invalid route_updated event: missing required fields', event);
        return;
      }
      
      const routeUpdate: RouteUpdate = {
        incidentId: payload.incident_id,
        technicianId: payload.technician_id,
        estimatedArrival: payload.estimated_arrival,
        distanceRemaining: payload.distance_remaining,
        routePoints: payload.route_points || [],
        updatedAt: payload.updated_at || event.timestamp
      };

      // Update route for this incident
      this.routeUpdates.update(routes => {
        const newMap = new Map(routes);
        newMap.set(payload.incident_id, routeUpdate);
        return newMap;
      });

      // Emit route update
      this.routeUpdateSubject.next(routeUpdate);

      console.log('🗺️ Route updated:', routeUpdate);
    } catch (error) {
      console.error('❌ Error handling route_updated event:', error, event);
    }
  }

  /**
   * Get technician location for incident
   */
  getTechnicianLocation(incidentId: number): TechnicianLocation | undefined {
    return this.technicianLocations().get(incidentId);
  }

  /**
   * Get tracking session for incident
   */
  getTrackingSession(incidentId: number): TrackingSession | undefined {
    return this.trackingSessions().get(incidentId);
  }

  /**
   * Get route update for incident
   */
  getRouteUpdate(incidentId: number): RouteUpdate | undefined {
    return this.routeUpdates().get(incidentId);
  }

  /**
   * Check if tracking is active for incident
   */
  isTrackingActive(incidentId: number): boolean {
    const session = this.trackingSessions().get(incidentId);
    return session?.status === 'active';
  }

  /**
   * Get ETA for incident
   */
  getETA(incidentId: number): string | undefined {
    const route = this.routeUpdates().get(incidentId);
    return route?.estimatedArrival;
  }

  /**
   * Get distance remaining for incident
   */
  getDistanceRemaining(incidentId: number): number | undefined {
    const route = this.routeUpdates().get(incidentId);
    return route?.distanceRemaining;
  }

  /**
   * Clear tracking data for incident
   */
  clearTrackingData(incidentId: number): void {
    this.technicianLocations.update(locations => {
      const newMap = new Map(locations);
      newMap.delete(incidentId);
      return newMap;
    });

    this.trackingSessions.update(sessions => {
      const newMap = new Map(sessions);
      newMap.delete(incidentId);
      return newMap;
    });

    this.routeUpdates.update(routes => {
      const newMap = new Map(routes);
      newMap.delete(incidentId);
      return newMap;
    });

    console.log('🧹 Tracking data cleared for incident:', incidentId);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    
    this.locationUpdateSubject.complete();
    this.sessionUpdateSubject.complete();
    this.routeUpdateSubject.complete();

    console.log('🧹 TrackingRealtimeService cleaned up');
  }
}
