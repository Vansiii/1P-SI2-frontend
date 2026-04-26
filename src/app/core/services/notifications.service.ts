import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import { WebSocketService } from './websocket.service';

/**
 * In-app notification as stored in the database and returned by the API.
 */
export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  data_json?: string;
  is_read: boolean;
  created_at: string;
}

/**
 * Payload emitted by the backend for the `notification_created` event.
 */
interface NotificationCreatedPayload {
  notification_id: number;
  user_id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  timestamp: string;
}

/**
 * Payload emitted by the backend for the `notification_read` event.
 */
interface NotificationReadPayload {
  notification_id: number;
  user_id: number;
  is_read: boolean;
  timestamp: string;
}

/**
 * Payload emitted by the backend for the `notifications_all_read` event.
 */
interface NotificationsAllReadPayload {
  user_id: number;
  timestamp: string;
}

/**
 * Service that manages in-app notifications with real-time WebSocket updates.
 *
 * Validates: Requirements 9 (Notification System Real-Time Events)
 *
 * Responsibilities:
 * - Fetch notifications from the REST API on demand.
 * - Subscribe to `notification_created`, `notification_read`, and
 *   `notifications_all_read` WebSocket events and keep local state in sync.
 * - Expose reactive observables for components to consume.
 * - Emit a `toastNotification$` signal whenever a new notification arrives
 *   so a toast/banner component can display it.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebSocketService);
  private readonly apiUrl = `${environment.apiUrl}/notifications`;

  // ── State ──────────────────────────────────────────────────────────────────

  /** Master list of notifications, newest first. */
  private readonly notificationsSubject = new BehaviorSubject<Notification[]>([]);

  /**
   * Observable stream of the current notification list.
   * Components should subscribe to this for rendering the notification panel.
   */
  public readonly notifications$: Observable<Notification[]> =
    this.notificationsSubject.asObservable();

  /**
   * Derived count of unread notifications.
   * Drives the badge counter on the notification bell icon.
   */
  public readonly unreadCount$: Observable<number> = this.notifications$.pipe(
    map(notifications => notifications.filter(n => !n.is_read).length)
  );

  /**
   * Emits each time a new `notification_created` event arrives.
   * A toast/banner component should subscribe to this and display a popup.
   */
  public readonly toastNotification$ = new Subject<Notification>();

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  constructor() {
    this.subscribeToWebSocket();
  }

  // ── WebSocket event handlers ───────────────────────────────────────────────

  /**
   * Wire up all notification-related WebSocket event handlers.
   * Validates: Requirements 9
   */
  private subscribeToWebSocket(): void {
    this.wsService.messages$.subscribe(message => {
      switch (message.type) {
        case 'notification_created':
          this.handleNotificationCreated(message.data as NotificationCreatedPayload);
          break;
        case 'notification_read':
          this.handleNotificationRead(message.data as NotificationReadPayload);
          break;
        case 'notifications_all_read':
          this.handleNotificationsAllRead(message.data as NotificationsAllReadPayload);
          break;
      }
    });
  }

  /**
   * Prepend the new notification to the list and fire the toast subject.
   * Validates: Requirements 9.1, 9.5, 9.6, 9.8
   */
  private handleNotificationCreated(data: NotificationCreatedPayload): void {
    const notification: Notification = {
      id: data.notification_id,
      user_id: data.user_id,
      type: data.notification_type,
      title: data.title,
      message: data.message,
      is_read: data.is_read,
      created_at: data.timestamp,
    };

    // Prepend so the newest notification is always first
    this.notificationsSubject.next([notification, ...this.notificationsSubject.value]);

    // Signal toast/banner components
    this.toastNotification$.next(notification);

    console.log(`🔔 Notification received: [${notification.type}] ${notification.title}`);
  }

  /**
   * Flip `is_read` on the matching notification.
   * Validates: Requirements 9.2
   */
  private handleNotificationRead(data: NotificationReadPayload): void {
    const notifications = this.notificationsSubject.value;
    const index = notifications.findIndex(n => n.id === data.notification_id);

    if (index !== -1) {
      const updated = [...notifications];
      updated[index] = { ...updated[index], is_read: data.is_read };
      this.notificationsSubject.next(updated);
      console.log(`✅ Notification ${data.notification_id} marked as read`);
    }
  }

  /**
   * Set every notification to `is_read = true` and reset the badge to 0.
   * Validates: Requirements 9.3, 9.7
   */
  private handleNotificationsAllRead(_data: NotificationsAllReadPayload): void {
    const allRead = this.notificationsSubject.value.map(n => ({ ...n, is_read: true }));
    this.notificationsSubject.next(allRead);
    console.log('✅ All notifications marked as read');
  }

  // ── HTTP methods ───────────────────────────────────────────────────────────

  /**
   * Fetch the current user's notifications from the REST API and populate
   * the local BehaviorSubject.
   *
   * @param unreadOnly When true, only fetch unread notifications.
   */
  getNotifications(unreadOnly = false): Observable<Notification[]> {
    const params: Record<string, string> = unreadOnly ? { unread_only: 'true' } : {};
    return this.http
      .get<ApiResponse<Notification[]>>(this.apiUrl, { params })
      .pipe(
        map((response: ApiResponse<Notification[]>) => {
          this.notificationsSubject.next(response.data);
          return response.data;
        })
      );
  }

  /**
   * Mark a single notification as read via the REST API.
   * The WebSocket event will update local state automatically.
   *
   * @param notificationId ID of the notification to mark.
   */
  markAsRead(notificationId: number): Observable<Notification> {
    return this.http
      .patch<ApiResponse<Notification>>(`${this.apiUrl}/${notificationId}/read`, {})
      .pipe(map(response => response.data));
  }

  /**
   * Mark all notifications as read via the REST API.
   * The WebSocket event will update local state automatically.
   */
  markAllAsRead(): Observable<void> {
    return this.http
      .patch<ApiResponse<void>>(`${this.apiUrl}/read-all`, {})
      .pipe(map(() => undefined));
  }
}
