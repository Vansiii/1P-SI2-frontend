import { Injectable, inject, DestroyRef, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { 
  RealtimeEvent
} from '../models/realtime-events.models';

// Connection state types
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

// Connection configuration interface
export interface ConnectionConfig {
  endpoint: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  queueMaxSize: number;
}

// Connection state interface
export interface ConnectionState {
  status: ConnectionStatus;
  lastConnected?: Date;
  reconnectAttempts: number;
  error?: string;
  latency?: number;
}

// Legacy WebSocket message interface (for backward compatibility)
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: string;
  version?: string;
}

// Constants for event deduplication and reconnection
const MAX_PROCESSED_EVENTS = 1000;
const MAX_RECONNECT_ATTEMPTS = 10;
const MAX_RECONNECT_DELAY_MS = 30000; // 30 seconds

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  // Dependency injection
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  // Connection state signals (Angular 21.2)
  readonly connectionState = signal<ConnectionStatus>('disconnected');
  readonly isConnectedSignal = computed(() => this.connectionState() === 'connected');
  
  /**
   * Connection status signal for monitoring
   * Requirement 7.6: Add connectionStatus signal<boolean> for connection monitoring
   */
  readonly connectionStatus = computed<boolean>(() => this.connectionState() === 'connected');
  
  readonly lastError = signal<string | null>(null);
  private reconnectAttemptsSignal = signal<number>(0);

  // Event streams
  private readonly eventSubject = new Subject<RealtimeEvent>();
  readonly events$ = this.eventSubject.asObservable();

  // Legacy message stream (for backward compatibility)
  private messagesSubject = new Subject<RealtimeEvent>();
  public messages$ = this.messagesSubject.asObservable();

  // Legacy connection status (for backward compatibility)
  private connectionStatusSubject = new BehaviorSubject<ConnectionStatus>('disconnected');
  public connectionStatus$: Observable<ConnectionStatus> = this.connectionStatusSubject.asObservable();

  // Connection management
  private socket?: WebSocket;
  private reconnectTimer?: any;
  private heartbeatInterval?: any;
  private maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;
  private heartbeatIntervalMs = 30000; // 30 seconds
  private isConnecting = false;
  private currentIncidentId?: number;
  private lastEventTimestamp?: string;
  private lastConnectAttempt = 0;
  private minConnectInterval = 1000; // Minimum 1 second between connection attempts

  // Event queue for disconnection periods
  private eventQueue: RealtimeEvent[] = [];
  private readonly queueMaxSize = 1000;

  /**
   * Event deduplication with Set<string> for processed event IDs
   * Requirement 2.9, 7.9: Add event deduplication with processedEventIds Set<string>
   */
  private processedEventIds = new Set<string>();
  private readonly MAX_PROCESSED_EVENTS = MAX_PROCESSED_EVENTS;
  
  private eventCache = new Map<string, RealtimeEvent>();
  private readonly eventCacheTTL = 3600000; // 1 hour in milliseconds

  constructor() {
    // Auto-cleanup on service destruction
    this.destroyRef.onDestroy(() => {
      console.log('🧹 WebSocketService: Cleaning up resources');
      this.cleanup();
    });
  }

  /**
   * Subscribe to specific event types with automatic completion
   * @param eventType The event type to listen for
   * @returns Observable that emits events of the specified type and completes when service is destroyed
   */
  on<T = any>(eventType: string): Observable<T> {
    return this.messages$.pipe(
      filter(message => message.type === eventType),
      map(message => message.data as T)
    );
  }

  /**
   * Subscribe to RealTime events with automatic completion
   * @param eventType The RealTime event type to listen for
   * @returns Observable that emits RealTime events of the specified type
   */
  onRealTimeEvent<T = any>(eventType: string): Observable<T> {
    return this.events$.pipe(
      filter(event => event.type === eventType),
      map(event => event.data as T)
    );
  }

  /**
   * Connect to WebSocket server with JWT authentication
   * Requirement 7.1: Implement connect() method with WebSocket URL from environment + auth token
   * Requirement 7.2: Add openObserver and closeObserver for connection lifecycle
   * @param incidentId Optional incident ID to join specific room
   */
  async connect(incidentId?: number): Promise<void> {
    // Prevent rapid reconnection attempts
    const now = Date.now();
    if (now - this.lastConnectAttempt < this.minConnectInterval) {
      console.log('⏳ Throttling WebSocket connection attempt (too soon)');
      return;
    }
    this.lastConnectAttempt = now;

    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    this.currentIncidentId = incidentId;
    this.isConnecting = true;
    this.updateConnectionState('connecting');

    try {
      // Get valid JWT token (with automatic refresh if needed)
      const token = await this.getValidToken();
      
      if (!token) {
        throw new Error('No access token available');
      }

      const currentUser = this.authService.currentUser();
      if (!currentUser) {
        throw new Error('No current user available');
      }

      // Build WebSocket URL from environment
      const wsUrl = environment.wsUrl || environment.apiBaseUrl.replace('http', 'ws');
      const url = incidentId
        ? `${wsUrl}/ws/incidents/${incidentId}?token=${token}`
        : `${wsUrl}/ws/tracking/${currentUser.id}?token=${token}`;

      console.log('🔌 Attempting WebSocket connection...');
      console.log('📍 URL:', url.replace(/token=[^&]+/, 'token=***'));
      console.log('👤 User:', currentUser.id, currentUser.user_type);

      this.socket = new WebSocket(url);

      // OpenObserver: Handle connection open
      this.socket.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        console.log('📍 WebSocket URL:', url.replace(/token=[^&]+/, 'token=***'));
        console.log('👤 User ID:', currentUser.id);
        this.isConnecting = false;
        this.reconnectAttemptsSignal.set(0);
        this.updateConnectionState('connected');

        // Start heartbeat mechanism
        this.startHeartbeat();

        // Process queued events
        this.processQueuedEvents();

        // Wait a moment before sending initial ping to ensure connection is fully established
        setTimeout(() => {
          if (this.socket?.readyState === WebSocket.OPEN) {
            this.send({ type: 'ping' });
          }
        }, 500);
      };

      // Handle incoming messages
      this.socket.onmessage = (event) => {
        try {
          const rawMessage: any = JSON.parse(event.data);
          
          // Filter out heartbeat messages (ping/pong) from logging and processing
          const messageType = rawMessage.event_type || rawMessage.type;
          if (messageType === 'ping' || messageType === 'pong') {
            // Silently handle heartbeat messages without logging
            return;
          }
          
          // Log estructurado para debugging (only for non-heartbeat messages)
          console.group(`📨 WebSocket Event: ${messageType}`);
          console.log('Timestamp:', new Date().toISOString());
          console.log('Event Type:', messageType);
          console.log('Payload:', rawMessage.payload || rawMessage.data);
          console.groupEnd();
          
          // Process message with validation and deduplication
          this.handleMessage(rawMessage);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      this.socket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        console.error('❌ WebSocket readyState:', this.socket?.readyState);
        console.error('❌ User:', currentUser.id, currentUser.user_type);
        this.isConnecting = false;
        this.updateConnectionState('error', 'WebSocket connection error');
      };

      // CloseObserver: Handle connection close
      this.socket.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        console.log('🔌 Close event details:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          url: url.replace(/token=[^&]+/, 'token=***'),  // ✅ CORRECCIÓN: Agregar URL para debugging
          user: currentUser.id,
          userType: currentUser.user_type
        });
        this.isConnecting = false;
        this.socket = undefined;
        this.stopHeartbeat();

        // Handle authentication errors (code 1008 = policy violation, often auth failure)
        if (event.code === 1008 || event.reason?.includes('auth')) {
          console.error('🔐 Authentication failed, attempting token refresh');
          this.handleAuthenticationFailure();
          return;
        }

        // Attempt reconnection if not a normal closure
        if (event.code !== 1000 && this.reconnectAttemptsSignal() < this.maxReconnectAttempts) {
          this.handleReconnect();
        } else if (event.code !== 1000) {
          // Max retries exceeded — mark as disconnected
          this.updateConnectionState('disconnected', 'Max reconnection attempts exceeded');
        } else {
          this.updateConnectionState('disconnected');
        }
      };
    } catch (error) {
      console.error('❌ Error creating WebSocket:', error);
      this.isConnecting = false;
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to create WebSocket connection';
      this.updateConnectionState('error', errorMessage);
      
      // If authentication error, don't retry automatically
      if (errorMessage.includes('token') || errorMessage.includes('auth')) {
        this.handleAuthenticationFailure();
      }
    }
  }

  /**
   * Get valid JWT token with automatic refresh if needed
   */
  private async getValidToken(): Promise<string | null> {
    let token = this.authService.getAccessToken();
    
    if (!token) {
      console.error('❌ No access token available');
      return null;
    }

    // Check if token is expired or about to expire
    if (this.isTokenExpired(token)) {
      console.log('🔄 Token expired, attempting refresh...');
      
      try {
        // Attempt to refresh token
        const refreshToken = this.authService.getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Call refresh endpoint
        const response = await this.http.post<any>(
          `${environment.apiUrl}/tokens/refresh`,
          { refresh_token: refreshToken }
        ).toPromise();

        // Extraer tokens de la respuesta (mismo patrón que auth.interceptor.ts)
        const newAccessToken = response?.data?.tokens?.access_token || response?.data?.access_token || response?.access_token;
        const newRefreshToken = response?.data?.tokens?.refresh_token || response?.data?.refresh_token || response?.refresh_token;

        if (newAccessToken) {
          // Actualizar tokens en AuthService (actualiza signals y localStorage)
          this.authService.updateTokens(newAccessToken, newRefreshToken || refreshToken);
          token = newAccessToken;
          console.log('✅ Token refreshed and saved successfully');
        } else {
          console.error('❌ Invalid refresh response - no access token in response:', response);
          throw new Error('Invalid refresh response');
        }
      } catch (error) {
        console.error('❌ Token refresh failed:', error);
        return null;
      }
    }

    return token;
  }

  /**
   * Handle incoming WebSocket message with validation, deduplication, and emission
   * Requirement 7.2: Implement handleMessage(message) with validation, deduplication, and emission
   * @param message Raw message from WebSocket
   */
  private handleMessage(message: any): void {
    try {
      // Validate event structure
      if (!this.isValidEvent(message)) {
        console.warn('⚠️ Invalid event structure, skipping:', message);
        return;
      }

      // Create event ID for deduplication
      const eventId = this.createEventId(message);
      
      // Check if already processed (deduplication)
      if (this.processedEventIds.has(eventId)) {
        console.log('⏭️ Skipping duplicate event:', eventId);
        return;
      }

      // Mark as processed
      this.addProcessedEvent(eventId);

      // Transform to RealtimeEvent format and emit
      let realtimeEvent: RealtimeEvent;
      
      // Check if it's a RealTimeEvent format (has event_type and payload)
      if (message.event_type && message.payload) {
        realtimeEvent = {
          type: message.event_type,
          data: message.payload,
          timestamp: message.timestamp || new Date().toISOString(),
          version: message.version || '1.0'
        };
      }
      // Check if it's a RealTimeEvent format WITHOUT payload (event_type but no payload)
      else if (message.event_type) {
        realtimeEvent = {
          type: message.event_type,
          data: message, // Use the entire message as data
          timestamp: message.timestamp || new Date().toISOString(),
          version: message.version || '1.0'
        };
      }
      // Handle legacy WebSocketMessage format
      else if (message.type) {
        realtimeEvent = {
          type: message.type,
          data: message.data,
          timestamp: message.timestamp || new Date().toISOString(),
          version: message.version || '1.0'
        };
      } else {
        console.warn('⚠️ Unknown message format:', message);
        return;
      }

      // Track last event timestamp
      if (realtimeEvent.timestamp) {
        this.lastEventTimestamp = realtimeEvent.timestamp;
        localStorage.setItem('last_event_timestamp', realtimeEvent.timestamp);
      }

      // Emit to subscribers
      this.messagesSubject.next(realtimeEvent);
      
      console.log('✅ Event processed and emitted:', eventId);
    } catch (error) {
      console.error('❌ Error handling WebSocket message:', error);
    }
  }

  /**
   * Validate event structure
   * Requirement 7.2: Implement isValidEvent(message) checking type and data fields
   * @param message Message to validate
   * @returns true if valid, false otherwise
   */
  private isValidEvent(message: any): boolean {
    if (!message || typeof message !== 'object') {
      return false;
    }

    // Filter out heartbeat messages (ping/pong)
    const messageType = message.event_type || message.type;
    if (messageType === 'ping' || messageType === 'pong') {
      return false; // Don't process heartbeat messages as events
    }

    // Check for event_type (new format) or type (legacy format)
    const hasType = typeof message.event_type === 'string' || typeof message.type === 'string';
    
    // Check for data field (payload or data or embedded in root)
    const hasData = message.payload !== undefined || message.data !== undefined || message.event_type !== undefined;
    
    return hasType && hasData;
  }

  /**
   * Create unique event ID for deduplication
   * Requirement 7.2: Implement createEventId(message) using type-incidentId-timestamp pattern
   * @param message Message to create ID from
   * @returns Unique event ID
   */
  private createEventId(message: any): string {
    const type = message.event_type || message.type || 'unknown';
    const timestamp = message.timestamp || Date.now().toString();
    
    // Extract incident_id from payload, data, or root level
    let incidentId = '';
    if (message.payload?.incident_id) {
      incidentId = message.payload.incident_id;
    } else if (message.data?.incident_id) {
      incidentId = message.data.incident_id;
    } else if (message.incident_id) {
      incidentId = message.incident_id;
    } else if (message.payload?.incident?.id) {
      incidentId = message.payload.incident.id;
    } else if (message.data?.incident?.id) {
      incidentId = message.data.incident.id;
    }
    
    return `${type}-${incidentId}-${timestamp}`;
  }

  /**
   * Add event to processed set with size limit
   * Requirement 7.2: Implement addProcessedEvent(eventId) with size limit (MAX_PROCESSED_EVENTS = 1000)
   * @param eventId Event ID to mark as processed
   */
  private addProcessedEvent(eventId: string): void {
    this.processedEventIds.add(eventId);
    
    // Limit set size to prevent memory leak
    if (this.processedEventIds.size > this.MAX_PROCESSED_EVENTS) {
      // Remove oldest entry (first item in Set)
      const firstItem = this.processedEventIds.values().next().value;
      if (firstItem) {
        this.processedEventIds.delete(firstItem);
      }
    }
  }

  /**
   * Check if JWT token is expired or about to expire (within 5 minutes)
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      // Return true if expired or expiring within 5 minutes
      return expirationTime - now < fiveMinutes;
    } catch (error) {
      console.error('❌ Error parsing token:', error);
      return true; // Treat as expired if can't parse
    }
  }

  /**
   * Handle authentication failure
   */
  private handleAuthenticationFailure(): void {
    console.error('🔐 Authentication failure detected');
    this.updateConnectionState('error', 'Authentication failed');
    
    // Clear reconnection attempts
    this.reconnectAttemptsSignal.set(this.maxReconnectAttempts);
    
    // Optionally redirect to login or show user feedback
    // This could be handled by a global error handler or notification service
  }

  /**
   * Disconnect from WebSocket server
   * Requirement 7.2: Add disconnect() method
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = undefined;
    }

    this.reconnectAttemptsSignal.set(0);
    this.currentIncidentId = undefined;
    this.updateConnectionState('disconnected');
  }

  /**
   * Send a message through WebSocket
   * Requirement 7.2: Add send(message) method
   */
  send(message: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message);
    }
  }

  /**
   * Clear processed events cache for testing
   * Requirement 7.2: Add clearCache() method for testing
   */
  clearCache(): void {
    this.processedEventIds.clear();
    this.eventCache.clear();
    console.log('🧹 Event cache cleared');
  }

  /**
   * Join an incident room
   */
  joinIncidentRoom(incidentId: number): void {
    this.send({
      type: 'join_incident',
      incident_id: incidentId
    });
  }

  /**
   * Leave an incident room
   */
  leaveIncidentRoom(incidentId: number): void {
    this.send({
      type: 'leave_incident',
      incident_id: incidentId
    });
  }

  /**
   * Send location update
   */
  sendLocationUpdate(latitude: number, longitude: number): void {
    this.send({
      type: 'location_update',
      data: {
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Recover missed events from server
   */
  private recoverMissedEvents(): void {
    const lastTimestamp = localStorage.getItem('last_event_timestamp');
    
    if (!lastTimestamp) {
      console.log('No last event timestamp found, skipping missed events recovery');
      return;
    }

    console.log(`🔄 Recovering missed events since ${lastTimestamp}`);

    const params: any = { since: lastTimestamp };
    if (this.currentIncidentId) {
      params.incident_id = this.currentIncidentId;
    }

    this.http.get<any>(`${environment.apiUrl}/events/missed`, { params })
      .subscribe({
        next: (response) => {
          const events = response.events || [];
          console.log(`✅ Recovered ${events.length} missed events`);
          
          // Process each missed event
          events.forEach((event: WebSocketMessage) => {
            // Transform to RealtimeEvent format
            const realtimeEvent: RealtimeEvent = {
              type: event.type as RealtimeEvent['type'],
              data: event.data,
              timestamp: event.timestamp || new Date().toISOString(),
              version: event.version || '1.0'
            };
            this.messagesSubject.next(realtimeEvent);
          });

          // Update last event timestamp
          if (response.until) {
            this.lastEventTimestamp = response.until;
            localStorage.setItem('last_event_timestamp', response.until);
          }
        },
        error: (error) => {
          console.error('❌ Error recovering missed events:', error);
        }
      });
  }

  /**
   * Schedule reconnection attempt with exponential backoff
   * Requirement 7.2: Implement handleReconnect() with exponential backoff (max 30s delay, max 10 attempts)
   */
  private handleReconnect(): void {
    const currentAttempts = this.reconnectAttemptsSignal() + 1;
    this.reconnectAttemptsSignal.set(currentAttempts);
    
    // Check if max attempts reached
    if (currentAttempts >= this.maxReconnectAttempts) {
      console.warn('⚠️ Max WebSocket reconnect attempts reached. Giving up.');
      this.updateConnectionState('disconnected', 'Max reconnection attempts exceeded');
      return;
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(1000 * Math.pow(2, currentAttempts - 1), MAX_RECONNECT_DELAY_MS);

    console.log(`⏰ Scheduling WebSocket reconnect attempt ${currentAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    this.updateConnectionState('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      console.log(`🔄 Attempting WebSocket reconnect (${currentAttempts}/${this.maxReconnectAttempts})`);
      this.connect(this.currentIncidentId);
    }, delay);
  }

  /**
   * Update connection state and emit to observers
   */
  private updateConnectionState(status: ConnectionStatus, error?: string): void {
    this.connectionState.set(status);
    this.connectionStatusSubject.next(status);
    
    if (error) {
      this.lastError.set(error);
      console.error('❌ WebSocket error:', error);
    } else if (status === 'connected') {
      this.lastError.set(null);
    }
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', timestamp: new Date().toISOString() });
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  /**
   * Handle incoming real-time event with deduplication
   * Uses RxJS retry and retryWhen operators for automatic reconnection
   */
  private handleIncomingEvent(event: RealtimeEvent): void {
    // 1. Deduplication check (already done in handleMessage, but double-check for safety)
    const eventId = this.createEventId(event);
    if (this.processedEventIds.has(eventId)) {
      console.log('⏭️ Skipping duplicate event (handleIncomingEvent):', eventId);
      return;
    }

    // 2. Cache event with TTL
    this.eventCache.set(eventId, event);

    // 3. Emit event to subscribers (already done in handleMessage via messagesSubject)
    this.eventSubject.next(event);

    // 4. Cleanup old events periodically
    this.cleanupExpiredEvents();
  }

  /**
   * Cleanup expired events from cache
   */
  private cleanupExpiredEvents(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    this.eventCache.forEach((event, id) => {
      const eventTime = new Date(event.timestamp).getTime();
      if (now - eventTime > this.eventCacheTTL) {
        expiredIds.push(id);
      }
    });

    expiredIds.forEach(id => {
      this.eventCache.delete(id);
      this.processedEventIds.delete(id);
    });

    if (expiredIds.length > 0) {
      console.log(`🧹 Cleaned up ${expiredIds.length} expired events`);
    }
  }

  /**
   * Process queued events after reconnection
   */
  private processQueuedEvents(): void {
    if (this.eventQueue.length === 0) {
      return;
    }

    console.log(`📤 Processing ${this.eventQueue.length} queued events`);
    
    const events = [...this.eventQueue];
    this.eventQueue = [];

    events.forEach(event => {
      this.handleIncomingEvent(event);
    });

    // Recover any missed events from server
    this.recoverMissedEvents();
  }

  /**
   * Queue event during disconnection
   */
  private queueEvent(event: RealtimeEvent): void {
    if (this.eventQueue.length >= this.queueMaxSize) {
      console.warn('⚠️ Event queue full, dropping oldest event');
      this.eventQueue.shift();
    }
    this.eventQueue.push(event);
  }

  /**
   * Check if message is a real-time event
   */
  private isRealTimeEvent(message: WebSocketMessage): boolean {
    return !!(
      message.type &&
      (message.type.includes('.') || message.type === 'event') &&
      message.data
    );
  }

  /**
   * Transform WebSocket message to RealtimeEvent format
   */
  private transformToRealtimeEvent(message: WebSocketMessage): RealtimeEvent {
    return {
      type: message.type as RealtimeEvent['type'],
      data: message.data,
      timestamp: message.timestamp || new Date().toISOString(),
      version: message.version || '1.0'
    };
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.socket) {
      this.socket.close(1000, 'Service destroyed');
      this.socket = undefined;
    }

    this.eventSubject.complete();
    this.messagesSubject.complete();
    this.connectionStatusSubject.complete();
    
    this.processedEventIds.clear();
    this.eventCache.clear();
    this.eventQueue = [];
  }

  /**
   * Get last reconnect delay for testing
   */
  getLastReconnectDelay(): number {
    const attempts = this.reconnectAttemptsSignal();
    return Math.min(1000 * Math.pow(2, attempts - 1), 60000);
  }
  
  /**
   * Get reconnect attempts count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttemptsSignal();
  }

  /**
   * Get processed events for testing
   */
  getProcessedEvents(): RealtimeEvent[] {
    return Array.from(this.eventCache.values());
  }
}
