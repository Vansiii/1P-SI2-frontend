import { Injectable, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private messaging: Messaging | null = null;
  private currentToken: string | null = null;
  private ready = false;
  private foregroundListenerRegistered = false;
  private readonly processedPushKeys = new Set<string>();
  private readonly pushKeyTimestamps = new Map<string, number>();
  private readonly PUSH_KEY_TTL_MS = 5 * 60 * 1000;
  private readonly PUSH_KEYS_MAX = 1000;

  readonly latestNotification = signal<any | null>(null);
  readonly notificationCount = signal<number>(0);
  readonly isReady = signal<boolean>(false);
  readonly permissionStatus = signal<NotificationPermission>('default');

  private async registerServiceWorker(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported in this browser');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js',
        {
          scope: '/',
          updateViaCache: 'none'
        }
      );

      console.log('Service Worker registered:', registration.scope);
      await navigator.serviceWorker.ready;
      console.log('Service Worker ready');

      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  async initialize(): Promise<boolean> {
    try {
      if (!this.isSupported()) {
        console.warn('Push notifications not supported in this browser');
        return false;
      }

      const swRegistered = await this.registerServiceWorker();
      if (!swRegistered) {
        console.error('Service Worker registration failed - cannot initialize Firebase');
        return false;
      }

      if (!environment.firebase) {
        console.warn('Firebase configuration not found in environment');
        return false;
      }

      const firebaseConfig = environment.firebase;
      const app = initializeApp(firebaseConfig);
      this.messaging = getMessaging(app);
      console.log('Firebase Messaging initialized');

      const token = await this.requestPermission();

      if (token) {
        this.ready = true;
        this.isReady.set(true);
        this.setupForegroundListener();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      return false;
    }
  }

  private async requestPermission(): Promise<string | null> {
    if (!this.messaging) {
      console.warn('Firebase Messaging not initialized');
      return null;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permissionStatus.set(permission);

      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        return null;
      }

      const token = await getToken(this.messaging, {
        vapidKey: environment.firebaseVapidKey || ''
      });

      if (token) {
        this.currentToken = token;
        return token;
      }

      console.warn('No FCM token available');
      return null;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  private setupForegroundListener(): void {
    if (!this.messaging || this.foregroundListenerRegistered) {
      return;
    }
    this.foregroundListenerRegistered = true;

    onMessage(this.messaging, (payload) => {
      console.log('Foreground message received:', payload);

      const dedupKeys = this.buildPushDedupKeys(payload);
      if (this.isDuplicatePush(dedupKeys)) {
        console.log('Skipping duplicate foreground push:', dedupKeys);
        return;
      }

      this.latestNotification.set(payload);
      this.notificationCount.update(count => count + 1);
      this.showForegroundBrowserNotification(payload);
    });
  }

  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  isServiceReady(): boolean {
    return this.ready;
  }

  getPermissionStatus(): NotificationPermission {
    return this.permissionStatus();
  }

  clearNotificationCount(): void {
    this.notificationCount.set(0);
  }

  getToken(): string | null {
    return this.currentToken;
  }

  private async showForegroundBrowserNotification(payload: any): Promise<void> {
    const eventType = payload?.data?.event_type || payload?.data?.type;
    if (!eventType || !['chat.message_sent', 'chat_message'].includes(eventType)) {
      return;
    }

    const title = payload?.notification?.title;
    const body = payload?.notification?.body;
    if (!title || Notification.permission !== 'granted') {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-72x72.png',
        tag: payload?.data?.event_id || payload?.data?.message_id || `chat-${payload?.data?.incident_id || 'message'}`,
        requireInteraction: true,
        data: payload?.data || {},
      });
    } catch (error) {
      console.warn('Could not display foreground browser notification:', error);
    }
  }

  private buildPushDedupKeys(payload: any): string[] {
    const data = payload?.data || {};
    const eventId = data.event_id || data.eventId;
    const notificationId = data.notification_id || data.notificationId;
    const eventType = data.event_type || data.eventType || '';
    const incidentId = data.incident_id || '';
    const title = payload?.notification?.title || '';
    const body = payload?.notification?.body || '';
    const semanticKey = `semantic:${eventType}:${incidentId}:${title}:${body}`;

    const keys = [semanticKey];
    if (eventId) keys.unshift(`event:${eventId}`);
    if (notificationId) keys.unshift(`notification:${notificationId}`);

    if (keys.length === 1) {
      const createdAt = data.created_at || payload?.sentTime || '';
      keys.push(`fallback:${createdAt}:${title}:${body}`);
    }

    return keys;
  }

  private isDuplicatePush(keys: string[]): boolean {
    const now = Date.now();
    this.cleanupExpiredPushKeys(now);

    if (keys.some(key => this.processedPushKeys.has(key))) {
      return true;
    }

    for (const key of keys) {
      this.processedPushKeys.add(key);
      this.pushKeyTimestamps.set(key, now);
    }

    if (this.processedPushKeys.size > this.PUSH_KEYS_MAX) {
      const oldest = [...this.pushKeyTimestamps.entries()].sort((a, b) => a[1] - b[1])[0];
      if (oldest) {
        this.processedPushKeys.delete(oldest[0]);
        this.pushKeyTimestamps.delete(oldest[0]);
      }
    }

    return false;
  }

  private cleanupExpiredPushKeys(now: number): void {
    for (const [key, timestamp] of this.pushKeyTimestamps.entries()) {
      if (now - timestamp > this.PUSH_KEY_TTL_MS) {
        this.pushKeyTimestamps.delete(key);
        this.processedPushKeys.delete(key);
      }
    }
  }
}
