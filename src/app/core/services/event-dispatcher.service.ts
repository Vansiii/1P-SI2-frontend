import { Injectable, inject, DestroyRef, signal } from '@angular/core';
import { Subject, Observable, filter as rxjsFilter } from 'rxjs';
import { RealtimeEvent } from '../models/realtime-events.models';
import { WebSocketService } from './websocket.service';

/**
 * Event handler function type
 */
export type EventHandler = (event: RealtimeEvent) => void;

/**
 * Event subscription configuration
 */
export interface EventSubscription {
  eventType: string;
  handler: EventHandler;
}

/**
 * Event filter configuration
 */
export interface EventFilter {
  eventTypes?: string[];
  incidentId?: number;
  userId?: number;
}

/**
 * Event batch configuration
 */
export interface EventBatchConfig {
  maxSize: number;
  maxWaitMs: number;
}

/**
 * Event Dispatcher Service
 * 
 * Centralized service for routing real-time events to appropriate handlers.
 * Provides event subscription, filtering, priority handling, and batching capabilities.
 */
@Injectable({
  providedIn: 'root'
})
export class EventDispatcherService {
  private readonly webSocketService = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  // Event streams by type
  private readonly eventStreams = new Map<string, Subject<RealtimeEvent>>();
  
  // Event handlers registry
  private readonly handlers = new Map<string, Set<EventHandler>>();
  
  // Event history for debugging
  private readonly eventHistory: RealtimeEvent[] = [];
  private readonly maxHistorySize = 100;
  
  // Event batching
  private readonly eventBatches = new Map<string, RealtimeEvent[]>();
  private readonly batchTimers = new Map<string, any>();
  private readonly defaultBatchConfig: EventBatchConfig = {
    maxSize: 10,
    maxWaitMs: 100
  };

  // Event metrics
  readonly totalEventsProcessed = signal<number>(0);
  readonly eventsByType = signal<Record<string, number>>({});
  readonly lastEventTimestamp = signal<string | null>(null);

  constructor() {
    // Subscribe to WebSocket events
    this.webSocketService.events$.subscribe(event => {
      this.dispatchEvent(event);
    });

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  /**
   * Subscribe to specific event type
   */
  subscribe(eventType: string, handler: EventHandler): () => void {
    // Create stream if it doesn't exist
    if (!this.eventStreams.has(eventType)) {
      this.eventStreams.set(eventType, new Subject<RealtimeEvent>());
    }

    // Add handler to registry
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    console.log(`📝 Subscribed to event type: ${eventType}`);

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
      console.log(`🗑️ Unsubscribed from event type: ${eventType}`);
    };
  }

  /**
   * Subscribe to multiple event types
   */
  subscribeMultiple(eventTypes: string[], handler: EventHandler): () => void {
    const unsubscribers = eventTypes.map(type => this.subscribe(type, handler));
    
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }

  /**
   * Get observable for specific event type
   */
  getEventStream(eventType: string): Observable<RealtimeEvent> {
    if (!this.eventStreams.has(eventType)) {
      this.eventStreams.set(eventType, new Subject<RealtimeEvent>());
    }
    return this.eventStreams.get(eventType)!.asObservable();
  }

  /**
   * Get filtered event stream
   */
  getFilteredStream(eventFilter: EventFilter): Observable<RealtimeEvent> {
    return this.webSocketService.events$.pipe(
      rxjsFilter(event => this.matchesFilter(event, eventFilter))
    );
  }

  /**
   * Dispatch event to appropriate handlers
   */
  private dispatchEvent(event: RealtimeEvent): void {
    // Update metrics
    this.updateMetrics(event);

    // Add to history
    this.addToHistory(event);

    // Route event immediately (no priority-based batching in new model)
    this.routeEvent(event);
  }

  /**
   * Route event to handlers
   */
  private routeEvent(event: RealtimeEvent): void {
    // Emit to type-specific stream
    const stream = this.eventStreams.get(event.type);
    if (stream) {
      stream.next(event);
    }

    // Call registered handlers
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`❌ Error in event handler for ${event.type}:`, error);
        }
      });
    }

    // Route to category handlers (e.g., 'incident.*')
    const category = event.type.split('.')[0];
    const categoryHandlers = this.handlers.get(`${category}.*`);
    if (categoryHandlers) {
      categoryHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`❌ Error in category handler for ${category}.*:`, error);
        }
      });
    }

    console.log(`📨 Routed event: ${event.type}`);
  }

  /**
   * Batch event for performance optimization
   */
  private batchEvent(event: RealtimeEvent): void {
    const batchKey = event.type;

    // Initialize batch if needed
    if (!this.eventBatches.has(batchKey)) {
      this.eventBatches.set(batchKey, []);
    }

    // Add event to batch
    const batch = this.eventBatches.get(batchKey)!;
    batch.push(event);

    // Process batch if it reaches max size
    if (batch.length >= this.defaultBatchConfig.maxSize) {
      this.processBatch(batchKey);
      return;
    }

    // Set timer to process batch after max wait time
    if (!this.batchTimers.has(batchKey)) {
      const timer = setTimeout(() => {
        this.processBatch(batchKey);
      }, this.defaultBatchConfig.maxWaitMs);
      this.batchTimers.set(batchKey, timer);
    }
  }

  /**
   * Process batched events
   */
  private processBatch(batchKey: string): void {
    const batch = this.eventBatches.get(batchKey);
    if (!batch || batch.length === 0) {
      return;
    }

    // Clear timer
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }

    // Process all events in batch
    batch.forEach(event => this.routeEvent(event));

    // Clear batch
    this.eventBatches.set(batchKey, []);

    console.log(`📦 Processed batch of ${batch.length} events for ${batchKey}`);
  }

  /**
   * Check if event matches filter
   */
  private matchesFilter(event: RealtimeEvent, filter: EventFilter): boolean {
    // Check event types
    if (filter.eventTypes && !filter.eventTypes.includes(event.type)) {
      return false;
    }

    // Check incident ID (safely access data properties)
    if (filter.incidentId) {
      const data = event.data as any;
      if (!data.incident_id || data.incident_id !== filter.incidentId) {
        return false;
      }
    }

    // Check user ID (safely access data properties)
    if (filter.userId) {
      const data = event.data as any;
      const userId = data.user_id || data.sender_id || data.technician_id;
      if (!userId || userId !== filter.userId) {
        return false;
      }
    }

    return true;
  }

  /**
   * Update event metrics
   */
  private updateMetrics(event: RealtimeEvent): void {
    // Increment total count
    this.totalEventsProcessed.update(count => count + 1);

    // Update count by type
    this.eventsByType.update(byType => ({
      ...byType,
      [event.type]: (byType[event.type] || 0) + 1
    }));

    // Update last timestamp
    this.lastEventTimestamp.set(event.timestamp);
  }

  /**
   * Add event to history
   */
  private addToHistory(event: RealtimeEvent): void {
    this.eventHistory.push(event);

    // Trim history if it exceeds max size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Get event history
   */
  getEventHistory(limit?: number): RealtimeEvent[] {
    if (limit) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  /**
   * Get events by type from history
   */
  getEventsByType(eventType: string, limit?: number): RealtimeEvent[] {
    const filtered = this.eventHistory.filter(e => e.type === eventType);
    if (limit) {
      return filtered.slice(-limit);
    }
    return filtered;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory.length = 0;
    console.log('🧹 Event history cleared');
  }

  /**
   * Get event metrics
   */
  getMetrics() {
    return {
      totalProcessed: this.totalEventsProcessed(),
      byType: this.eventsByType(),
      lastTimestamp: this.lastEventTimestamp(),
      historySize: this.eventHistory.length
    };
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    // Clear all batch timers
    this.batchTimers.forEach(timer => clearTimeout(timer));
    this.batchTimers.clear();

    // Complete all streams
    this.eventStreams.forEach(stream => stream.complete());
    this.eventStreams.clear();

    // Clear handlers
    this.handlers.clear();

    // Clear batches
    this.eventBatches.clear();

    // Clear history
    this.eventHistory.length = 0;

    console.log('🧹 EventDispatcherService cleaned up');
  }
}
