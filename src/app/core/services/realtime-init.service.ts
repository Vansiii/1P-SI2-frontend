import { Injectable, inject, DestroyRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { WebSocketService } from './websocket.service';
import { EventDispatcherService } from './event-dispatcher.service';
import { IncidentRealtimeService } from './incident-realtime.service';
import { ChatRealtimeService } from './chat-realtime.service';
import { DashboardRealtimeService } from './dashboard-realtime.service';
import { TrackingRealtimeService } from './tracking-realtime.service';
import { RealtimeErrorHandlerService } from './realtime-error-handler.service';
import { StateSyncService } from './state-sync.service';
import { AuthService } from './auth.service';

/**
 * Real-Time Initialization Service
 * 
 * Initializes and wires all real-time services with the existing application.
 * Manages WebSocket connections based on user authentication and routing.
 */
@Injectable({
  providedIn: 'root'
})
export class RealtimeInitService {
  private readonly webSocketService = inject(WebSocketService);
  private readonly eventDispatcher = inject(EventDispatcherService);
  private readonly incidentRealtime = inject(IncidentRealtimeService);
  private readonly chatRealtime = inject(ChatRealtimeService);
  private readonly dashboardRealtime = inject(DashboardRealtimeService);
  private readonly trackingRealtime = inject(TrackingRealtimeService);
  private readonly errorHandler = inject(RealtimeErrorHandlerService);
  private readonly stateSync = inject(StateSyncService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private isInitialized = false;

  /**
   * Initialize real-time services
   */
  initialize(): void {
    if (this.isInitialized) {
      console.log('⚠️ Real-time services already initialized');
      return;
    }

    console.log('🚀 Initializing real-time services...');

    // Setup authentication monitoring
    this.setupAuthMonitoring();

    // Setup routing monitoring
    this.setupRoutingMonitoring();

    // Setup error handling
    this.setupErrorHandling();

    this.isInitialized = true;
    console.log('✅ Real-time services initialized');

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  /**
   * Setup authentication monitoring
   */
  private setupAuthMonitoring(): void {
    // Connect WebSocket when user is authenticated
    if (this.authService.isAuthenticated()) {
      this.connectWebSocket();
    }

    // Monitor authentication changes
    // Note: This assumes AuthService has an observable for auth state changes
    // Adjust based on actual AuthService implementation
  }

  /**
   * Setup routing monitoring
   */
  private setupRoutingMonitoring(): void {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd)
      )
      .subscribe((event: NavigationEnd) => {
        this.handleRouteChange(event.url);
      });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // Subscribe to error handler user feedback
    this.errorHandler.userFeedback$.subscribe(feedback => {
      // This could be wired to a toast notification service
      console.log(`📢 User feedback: [${feedback.type}] ${feedback.message}`);
    });

    // Subscribe to recovery actions
    this.errorHandler.recoveryAction$.subscribe(strategy => {
      console.log('🔧 Recovery strategy suggested:', strategy.type);
      
      // Auto-execute reconnection strategies
      if (strategy.type === 'reconnect' && strategy.action) {
        strategy.action();
      }
    });
  }

  /**
   * Handle route change
   */
  private handleRouteChange(url: string): void {
    console.log('🔀 Route changed:', url);

    // Extract incident ID from URL if present
    const incidentMatch = url.match(/\/incidents\/(\d+)/);
    if (incidentMatch) {
      const incidentId = parseInt(incidentMatch[1], 10);
      this.handleIncidentRoute(incidentId);
    }

    // Handle chat routes
    const chatMatch = url.match(/\/chat\/(\d+)/);
    if (chatMatch) {
      const incidentId = parseInt(chatMatch[1], 10);
      this.handleChatRoute(incidentId);
    }

    // Handle tracking routes
    const trackingMatch = url.match(/\/tracking\/(\d+)/);
    if (trackingMatch) {
      const incidentId = parseInt(trackingMatch[1], 10);
      this.handleTrackingRoute(incidentId);
    }

    // Handle dashboard route
    if (url.includes('/dashboard')) {
      this.handleDashboardRoute();
    }
  }

  /**
   * Handle incident route
   */
  private handleIncidentRoute(incidentId: number): void {
    console.log('📋 Incident route:', incidentId);
    
    // Join incident room for real-time updates
    this.webSocketService.joinIncidentRoom(incidentId);
  }

  /**
   * Handle chat route
   */
  private handleChatRoute(incidentId: number): void {
    console.log('💬 Chat route:', incidentId);
    
    // TODO: Implement setActiveChat method in ChatRealtimeService
    // this.chatRealtime.setActiveChat(incidentId);
    
    // Join incident room
    this.webSocketService.joinIncidentRoom(incidentId);
  }

  /**
   * Handle tracking route
   */
  private handleTrackingRoute(incidentId: number): void {
    console.log('📍 Tracking route:', incidentId);
    
    // TODO: Implement setActiveTracking method in TrackingRealtimeService
    // this.trackingRealtime.setActiveTracking(incidentId);
    
    // Join incident room
    this.webSocketService.joinIncidentRoom(incidentId);
  }

  /**
   * Handle dashboard route
   */
  private handleDashboardRoute(): void {
    console.log('📊 Dashboard route');
    
    // Dashboard metrics are automatically updated via event dispatcher
    // No specific action needed here
  }

  /**
   * Connect WebSocket
   */
  private connectWebSocket(): void {
    if (!this.authService.isAuthenticated()) {
      console.log('⚠️ Cannot connect WebSocket: User not authenticated');
      return;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      console.log('⚠️ Cannot connect WebSocket: No current user');
      return;
    }

    console.log('🔌 Connecting WebSocket for user:', currentUser.id);
    this.webSocketService.connect();
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    console.log('🔌 Disconnecting WebSocket');
    this.webSocketService.disconnect();
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.webSocketService.isConnected(),
      connectionState: this.webSocketService.connectionState(),
      syncStatus: this.stateSync.syncStatus(),
      errorStatus: this.errorHandler.connectionStatus()
    };
  }

  /**
   * Get service statistics
   */
  getStatistics() {
    return {
      events: this.eventDispatcher.getMetrics(),
      cache: this.stateSync.getCacheStatistics(),
      errors: this.errorHandler.getErrorStatistics()
    };
  }

  /**
   * Manual reconnection
   */
  reconnect(): void {
    console.log('🔄 Manual reconnection requested');
    this.errorHandler.manualReconnect();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    console.log('🧹 Cleaning up real-time services');
    this.disconnectWebSocket();
    this.isInitialized = false;
  }
}
