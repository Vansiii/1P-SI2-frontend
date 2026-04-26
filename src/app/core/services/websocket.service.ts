import { Injectable, inject } from '@angular/core';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private readonly authService = inject(AuthService);
  
  private socket?: WebSocket;
  private messagesSubject = new Subject<WebSocketMessage>();
  private connectionStatusSubject = new BehaviorSubject<ConnectionStatus>('disconnected');
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private reconnectTimer?: any;
  private isConnecting = false;
  private currentIncidentId?: number;

  public messages$ = this.messagesSubject.asObservable();
  /** Emits the current WebSocket connection status */
  public connectionStatus$: Observable<ConnectionStatus> = this.connectionStatusSubject.asObservable();

  /**
   * Connect to WebSocket server
   * @param incidentId Optional incident ID to join specific room
   */
  connect(incidentId?: number): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    this.currentIncidentId = incidentId;
    this.isConnecting = true;

    const token = this.authService.getAccessToken();
    if (!token) {
      console.error('No access token available for WebSocket connection');
      this.isConnecting = false;
      return;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      console.error('No current user available for WebSocket connection');
      this.isConnecting = false;
      return;
    }

    // Build WebSocket URL
    const wsUrl = environment.wsUrl || environment.apiBaseUrl.replace('http', 'ws');
    const url = incidentId 
      ? `${wsUrl}/ws/incidents/${incidentId}?token=${token}`
      : `${wsUrl}/ws/tracking/${currentUser.id}?token=${token}`;

    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        console.log('📍 WebSocket URL:', url);
        console.log('👤 User ID:', currentUser.id);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.connectionStatusSubject.next('connected');
        
        // Send initial ping
        this.send({ type: 'ping' });
      };

      this.socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', message.type, message);
          this.messagesSubject.next(message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        this.isConnecting = false;
        this.socket = undefined;

        // Attempt reconnection if not a normal closure
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else if (event.code !== 1000) {
          // Max retries exceeded — mark as disconnected
          this.connectionStatusSubject.next('disconnected');
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect from WebSocket server
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

    this.reconnectAttempts = 0;
    this.currentIncidentId = undefined;
    this.connectionStatusSubject.next('disconnected');
  }

  /**
   * Send a message through WebSocket
   */
  send(message: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message);
    }
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
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(`Scheduling WebSocket reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    this.connectionStatusSubject.next('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn('Max WebSocket reconnect attempts reached. Giving up.');
        this.connectionStatusSubject.next('disconnected');
        return;
      }
      console.log(`Attempting WebSocket reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect(this.currentIncidentId);
    }, delay);
  }
}
