import { Injectable, inject, DestroyRef, signal, computed } from '@angular/core';
import { EventDispatcherService } from './event-dispatcher.service';
import { 
  RealtimeEvent
} from '../models/realtime-events.models';
import { Subject } from 'rxjs';

/**
 * Notification data interface
 */
export interface Notification {
  id: number;
  userId: number;
  type: 'incident_created' | 'incident_assigned' | 'incident_status_changed' | 'message_received' | 'system_alert';
  title: string;
  body: string;
  data?: any;
  read: boolean;
  createdAt: string;
  readAt?: string;
}

/**
 * Badge count info
 */
export interface BadgeCount {
  unreadCount: number;
  totalCount: number;
  updatedAt: string;
}

/**
 * Notification Real-Time Service
 * 
 * Handles real-time updates for notifications.
 * Provides live notification feed and badge count updates.
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationRealtimeService {
  private readonly eventDispatcher = inject(EventDispatcherService);
  private readonly destroyRef = inject(DestroyRef);

  // Notifications signal
  readonly notifications = signal<Notification[]>([]);

  // Badge count signal
  readonly badgeCount = signal<BadgeCount>({
    unreadCount: 0,
    totalCount: 0,
    updatedAt: new Date().toISOString()
  });

  // Computed signals
  readonly hasUnreadNotifications = computed(() => {
    return this.badgeCount().unreadCount > 0;
  });

  readonly unreadCount = computed(() => {
    return this.badgeCount().unreadCount;
  });

  readonly recentNotifications = computed(() => {
    return this.notifications().slice(0, 10);
  });

  readonly unreadNotifications = computed(() => {
    return this.notifications().filter(n => !n.read);
  });

  // Notification received stream
  private readonly notificationReceivedSubject = new Subject<Notification>();
  readonly notificationReceived$ = this.notificationReceivedSubject.asObservable();

  // Badge updated stream
  private readonly badgeUpdatedSubject = new Subject<BadgeCount>();
  readonly badgeUpdated$ = this.badgeUpdatedSubject.asObservable();

  private unsubscribers: (() => void)[] = [];

  constructor() {
    this.setupEventHandlers();

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  /**
   * Setup event handlers for all notification events
   */
  private setupEventHandlers(): void {
    const notificationEventTypes = [
      'notification.received',
      'notification.badge_updated'
    ];

    const unsubscribe = this.eventDispatcher.subscribeMultiple(
      notificationEventTypes,
      (event) => this.handleNotificationEvent(event)
    );

    this.unsubscribers.push(unsubscribe);

    console.log('✅ NotificationRealtimeService: Event handlers setup complete');
  }

  /**
   * Handle notification event
   */
  private handleNotificationEvent(event: RealtimeEvent): void {
    console.log('🔔 Processing notification event:', event.type, event);

    try {
      switch (event.type) {
        case 'notification.received':
        case 'notification_created':
          this.handleNotificationReceived(event as RealtimeEvent<any>);
          break;
        case 'notification.badge_updated':
          this.handleBadgeUpdated(event as RealtimeEvent<any>);
          break;
        default:
          console.warn('⚠️ Unknown notification event type:', event.type);
      }
    } catch (error) {
      console.error('❌ Error handling notification event:', error, event);
    }
  }

  /**
   * Handle notification received event
   */
  private handleNotificationReceived(event: RealtimeEvent<any>): void {
    try {
      const data = event.data || (event as any);
      
      if (!data.notification_id) {
        console.error('❌ Invalid notification.received event: missing notification_id', event);
        return;
      }
      
      const notification: Notification = {
        id: data.notification_id,
        userId: data.user_id,
        type: data.type,
        title: data.title,
        body: data.body,
        data: data.data,
        read: false,
        createdAt: data.created_at || event.timestamp
      };

      // Add notification to the beginning of the list
      this.notifications.update(notifications => [notification, ...notifications]);

      // Emit notification
      this.notificationReceivedSubject.next(notification);

      // Update badge count
      this.badgeCount.update(badge => ({
        ...badge,
        unreadCount: badge.unreadCount + 1,
        totalCount: badge.totalCount + 1,
        updatedAt: event.timestamp
      }));

      console.log('🔔 New notification received:', notification);
    } catch (error) {
      console.error('❌ Error handling notification.received event:', error, event);
    }
  }

  /**
   * Handle badge updated event
   */
  private handleBadgeUpdated(event: RealtimeEvent<any>): void {
    try {
      const data = event.data || (event as any);
      
      const newBadgeCount: BadgeCount = {
        unreadCount: data.unread_count,
        totalCount: data.total_count,
        updatedAt: data.updated_at || event.timestamp
      };

      this.badgeCount.set(newBadgeCount);
      this.badgeUpdatedSubject.next(newBadgeCount);

      console.log('🔔 Badge count updated:', newBadgeCount);
    } catch (error) {
      console.error('❌ Error handling notification.badge_updated event:', error, event);
    }
  }

  /**
   * Mark notification as read (local only, should call API)
   */
  markAsRead(notificationId: number): void {
    this.notifications.update(notifications =>
      notifications.map(n =>
        n.id === notificationId
          ? { ...n, read: true, readAt: new Date().toISOString() }
          : n
      )
    );

    this.badgeCount.update(badge => ({
      ...badge,
      unreadCount: Math.max(0, badge.unreadCount - 1),
      updatedAt: new Date().toISOString()
    }));

    console.log('✅ Notification marked as read (local):', notificationId);
  }

  /**
   * Mark all notifications as read (local only, should call API)
   */
  markAllAsRead(): void {
    const now = new Date().toISOString();
    
    this.notifications.update(notifications =>
      notifications.map(n => ({ ...n, read: true, readAt: now }))
    );

    this.badgeCount.update(badge => ({
      ...badge,
      unreadCount: 0,
      updatedAt: now
    }));

    console.log('✅ All notifications marked as read (local)');
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this.notifications.set([]);
    this.badgeCount.set({
      unreadCount: 0,
      totalCount: 0,
      updatedAt: new Date().toISOString()
    });

    console.log('🗑️ All notifications cleared');
  }

  /**
   * Remove notification
   */
  removeNotification(notificationId: number): void {
    const notification = this.notifications().find(n => n.id === notificationId);
    
    this.notifications.update(notifications =>
      notifications.filter(n => n.id !== notificationId)
    );

    if (notification && !notification.read) {
      this.badgeCount.update(badge => ({
        ...badge,
        unreadCount: Math.max(0, badge.unreadCount - 1),
        totalCount: Math.max(0, badge.totalCount - 1),
        updatedAt: new Date().toISOString()
      }));
    } else if (notification) {
      this.badgeCount.update(badge => ({
        ...badge,
        totalCount: Math.max(0, badge.totalCount - 1),
        updatedAt: new Date().toISOString()
      }));
    }

    console.log('🗑️ Notification removed:', notificationId);
  }

  /**
   * Get notification by ID
   */
  getNotificationById(notificationId: number): Notification | undefined {
    return this.notifications().find(n => n.id === notificationId);
  }

  /**
   * Get notifications by type
   */
  getNotificationsByType(type: Notification['type']): Notification[] {
    return this.notifications().filter(n => n.type === type);
  }

  /**
   * Set initial notifications (from REST API)
   */
  setInitialNotifications(notifications: Notification[]): void {
    this.notifications.set(notifications);
    
    const unreadCount = notifications.filter(n => !n.read).length;
    this.badgeCount.set({
      unreadCount,
      totalCount: notifications.length,
      updatedAt: new Date().toISOString()
    });

    console.log('📋 Initial notifications loaded:', notifications.length);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    
    this.notificationReceivedSubject.complete();
    this.badgeUpdatedSubject.complete();

    console.log('🧹 NotificationRealtimeService cleaned up');
  }
}
