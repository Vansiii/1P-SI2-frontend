import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';

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
 * Notification API service.
 *
 * Realtime processing is centralized in NotificationRealtimeService to avoid
 * duplicate listeners and duplicated toasts/badges.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/notifications`;

  private readonly notificationsSubject = new BehaviorSubject<Notification[]>([]);

  public readonly notifications$: Observable<Notification[]> =
    this.notificationsSubject.asObservable();

  public readonly unreadCount$: Observable<number> = this.notifications$.pipe(
    map(notifications => notifications.filter(n => !n.is_read).length)
  );

  constructor() {}

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

  markAsRead(notificationId: number): Observable<Notification> {
    return this.http
      .patch<ApiResponse<Notification>>(`${this.apiUrl}/${notificationId}/read`, {})
      .pipe(map(response => response.data));
  }

  markAllAsRead(): Observable<void> {
    return this.http
      .patch<ApiResponse<void>>(`${this.apiUrl}/read-all`, {})
      .pipe(map(() => undefined));
  }
}
