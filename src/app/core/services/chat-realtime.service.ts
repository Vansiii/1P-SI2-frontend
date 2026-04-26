import { Injectable, inject, DestroyRef, signal } from '@angular/core';
import { EventDispatcherService } from './event-dispatcher.service';
import { 
  RealtimeEvent
} from '../models/realtime-events.models';
import { Subject } from 'rxjs';

/**
 * Chat update notification
 */
export interface ChatUpdate {
  incidentId: number;
  updateType: 'typing' | 'stopped_typing' | 'delivered' | 'read' | 'file_uploaded';
  message: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  data?: any;
}

/**
 * Typing indicator
 */
export interface TypingIndicator {
  incidentId: number;
  userId: number;
  userName: string;
  isTyping: boolean;
}

/**
 * Chat Real-Time Service
 * 
 * Handles real-time updates for chat functionality.
 * Processes chat events and provides notifications for UI updates.
 */
@Injectable({
  providedIn: 'root'
})
export class ChatRealtimeService {
  private readonly eventDispatcher = inject(EventDispatcherService);
  private readonly destroyRef = inject(DestroyRef);

  // Chat updates stream
  private readonly chatUpdatesSubject = new Subject<ChatUpdate>();
  readonly chatUpdates$ = this.chatUpdatesSubject.asObservable();

  // Typing indicators signal
  readonly typingIndicators = signal<Map<string, TypingIndicator>>(new Map());

  // Message delivery status signal
  readonly messageDeliveryStatus = signal<Map<number, 'sent' | 'delivered' | 'read'>>(new Map());

  private unsubscribers: (() => void)[] = [];

  constructor() {
    this.setupEventHandlers();

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  /**
   * Setup event handlers for all chat events
   */
  private setupEventHandlers(): void {
    const chatEventTypes = [
      'chat.user_typing',
      'chat.user_stopped_typing',
      'chat.message_delivered',
      'chat.message_read',
      'chat.file_uploaded'
    ];

    const unsubscribe = this.eventDispatcher.subscribeMultiple(
      chatEventTypes,
      (event) => this.handleChatEvent(event)
    );

    this.unsubscribers.push(unsubscribe);

    console.log('✅ ChatRealtimeService: Event handlers setup complete');
  }

  /**
   * Handle chat event
   */
  private handleChatEvent(event: RealtimeEvent): void {
    console.log('📨 Processing chat event:', event.type, event);

    try {
      switch (event.type) {
        case 'chat.user_typing':
        case 'user_typing':
          this.handleUserTyping(event as RealtimeEvent<any>);
          break;
        case 'chat.user_stopped_typing':
        case 'user_stopped_typing':
          this.handleUserStoppedTyping(event as RealtimeEvent<any>);
          break;
        case 'chat.message_delivered':
          this.handleMessageDelivered(event as RealtimeEvent<any>);
          break;
        case 'chat.message_read':
        case 'message_read':
          this.handleMessageRead(event as RealtimeEvent<any>);
          break;
        case 'chat.file_uploaded':
          this.handleFileUploaded(event as RealtimeEvent<any>);
          break;
        case 'chat.message_sent':
        case 'new_message':
        case 'new_chat_message':
          this.handleMessageDelivered(event as RealtimeEvent<any>);
          break;
        default:
          console.warn('⚠️ Unknown chat event type:', event.type);
      }
    } catch (error) {
      console.error('❌ Error handling chat event:', error, event);
    }
  }

  /**
   * Handle user typing event
   */
  private handleUserTyping(event: RealtimeEvent<any>): void {
    try {
      const data = event.data || (event as any);
      
      if (!data.incident_id || !data.user_id) {
        console.error('❌ Invalid user_typing event: missing required fields', event);
        return;
      }
      
      const key = `${data.incident_id}-${data.user_id}`;
      const indicator: TypingIndicator = {
        incidentId: data.incident_id,
        userId: data.user_id,
        userName: data.user_name || 'Usuario',
        isTyping: true
      };

      // Add typing indicator
      this.typingIndicators.update(indicators => {
        const newMap = new Map(indicators);
        newMap.set(key, indicator);
        return newMap;
      });

      const update: ChatUpdate = {
        incidentId: data.incident_id,
        updateType: 'typing',
        message: `${indicator.userName} está escribiendo...`,
        priority: 'low',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
    } catch (error) {
      console.error('❌ Error handling user_typing event:', error, event);
    }
  }

  /**
   * Handle user stopped typing event
   */
  private handleUserStoppedTyping(event: RealtimeEvent<any>): void {
    try {
      const data = event.data || (event as any);
      
      if (!data.incident_id || !data.user_id) {
        console.error('❌ Invalid user_stopped_typing event: missing required fields', event);
        return;
      }
      
      const key = `${data.incident_id}-${data.user_id}`;

      // Remove typing indicator
      this.typingIndicators.update(indicators => {
        const newMap = new Map(indicators);
        newMap.delete(key);
        return newMap;
      });

      const update: ChatUpdate = {
        incidentId: data.incident_id,
        updateType: 'stopped_typing',
        message: 'Usuario dejó de escribir',
        priority: 'low',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
    } catch (error) {
      console.error('❌ Error handling user_stopped_typing event:', error, event);
    }
  }

  /**
   * Handle message delivered event
   */
  private handleMessageDelivered(event: RealtimeEvent<any>): void {
    try {
      const data = event.data || (event as any);
      
      if (!data.message_id) {
        console.error('❌ Invalid message_delivered event: missing message_id', event);
        return;
      }
      
      // Update message delivery status
      this.messageDeliveryStatus.update(statuses => {
        const newMap = new Map(statuses);
        newMap.set(data.message_id, 'delivered');
        return newMap;
      });

      const update: ChatUpdate = {
        incidentId: data.incident_id,
        updateType: 'delivered',
        message: `Mensaje #${data.message_id} entregado`,
        priority: 'low',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
    } catch (error) {
      console.error('❌ Error handling message_delivered event:', error, event);
    }
  }

  /**
   * Handle message read event
   */
  private handleMessageRead(event: RealtimeEvent<any>): void {
    try {
      const data = event.data || (event as any);
      
      if (!data.message_id) {
        console.error('❌ Invalid message_read event: missing message_id', event);
        return;
      }
      
      // Update message delivery status
      this.messageDeliveryStatus.update(statuses => {
        const newMap = new Map(statuses);
        newMap.set(data.message_id, 'read');
        return newMap;
      });

      const update: ChatUpdate = {
        incidentId: data.incident_id,
        updateType: 'read',
        message: `Mensaje #${data.message_id} leído`,
        priority: 'low',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
    } catch (error) {
      console.error('❌ Error handling message_read event:', error, event);
    }
  }

  /**
   * Handle file uploaded event
   */
  private handleFileUploaded(event: RealtimeEvent<any>): void {
    try {
      const data = event.data || (event as any);
      
      if (!data.message_id || !data.incident_id) {
        console.error('❌ Invalid file_uploaded event: missing required fields', event);
        return;
      }
      
      const update: ChatUpdate = {
        incidentId: data.incident_id,
        updateType: 'file_uploaded',
        message: `Archivo subido: ${data.file_name} (${this.formatFileSize(data.file_size)})`,
        priority: 'medium',
        timestamp: event.timestamp,
        data: data
      };

      this.emitUpdate(update);
    } catch (error) {
      console.error('❌ Error handling file_uploaded event:', error, event);
    }
  }

  /**
   * Emit chat update
   */
  private emitUpdate(update: ChatUpdate): void {
    this.chatUpdatesSubject.next(update);
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Get typing indicators for an incident
   */
  getTypingIndicatorsForIncident(incidentId: number): TypingIndicator[] {
    const indicators = this.typingIndicators();
    return Array.from(indicators.values()).filter(
      indicator => indicator.incidentId === incidentId && indicator.isTyping
    );
  }

  /**
   * Get message delivery status
   */
  getMessageStatus(messageId: number): 'sent' | 'delivered' | 'read' | undefined {
    return this.messageDeliveryStatus().get(messageId);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    
    this.chatUpdatesSubject.complete();

    console.log('🧹 ChatRealtimeService cleaned up');
  }
}
