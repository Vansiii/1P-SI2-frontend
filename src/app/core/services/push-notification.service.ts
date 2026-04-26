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
  
  // Signals for reactive state
  readonly latestNotification = signal<any | null>(null);
  readonly notificationCount = signal<number>(0);
  readonly isReady = signal<boolean>(false);
  readonly permissionStatus = signal<NotificationPermission>('default');

  /**
   * Register Service Worker for background notifications
   */
  private async registerServiceWorker(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ Service Workers not supported in this browser');
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
      
      console.log('✅ Service Worker registered:', registration.scope);
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      console.log('✅ Service Worker ready');
      
      return true;
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
      return false;
    }
  }

  /**
   * Initialize Firebase Messaging
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if notifications are supported
      if (!this.isSupported()) {
        console.warn('⚠️ Push notifications not supported in this browser');
        return false;
      }

      // Register service worker FIRST (required for background notifications)
      const swRegistered = await this.registerServiceWorker();
      if (!swRegistered) {
        console.error('❌ Service Worker registration failed - cannot initialize Firebase');
        return false;
      }

      // Check if Firebase config exists
      if (!environment.firebase) {
        console.warn('⚠️ Firebase configuration not found in environment');
        return false;
      }

      // Initialize Firebase (TypeScript now knows firebase is defined)
      const firebaseConfig = environment.firebase;
      const app = initializeApp(firebaseConfig);
      this.messaging = getMessaging(app);
      console.log('✅ Firebase Messaging initialized');

      // Request permission and get token
      const token = await this.requestPermission();
      
      if (token) {
        this.ready = true;
        this.isReady.set(true);
        this.setupForegroundListener();
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Error initializing Firebase:', error);
      return false;
    }
  }

  /**
   * Request notification permission and get FCM token
   */
  private async requestPermission(): Promise<string | null> {
    if (!this.messaging) {
      console.warn('Firebase Messaging not initialized');
      return null;
    }

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      this.permissionStatus.set(permission);
      
      if (permission !== 'granted') {
        console.warn('⚠️ Notification permission denied');
        return null;
      }

      console.log('✅ Notification permission granted');

      // Get FCM token
      const token = await getToken(this.messaging, {
        vapidKey: environment.firebaseVapidKey || ''
      });

      if (token) {
        console.log('✅ FCM Token obtained:', token.substring(0, 20) + '...');
        this.currentToken = token;
        return token;
      } else {
        console.warn('⚠️ No FCM token available');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Setup foreground message listener
   */
  private setupForegroundListener(): void {
    if (!this.messaging) {
      return;
    }

    onMessage(this.messaging, (payload) => {
      console.log('📬 Foreground message received:', payload);
      
      // Update signals with new notification
      this.latestNotification.set(payload);
      this.notificationCount.update(count => count + 1);
      
      // Show notification in foreground
      if (payload.notification) {
        this.showNotification(
          payload.notification.title || 'MecánicoYa',
          payload.notification.body || '',
          payload.data
        );
      }
    });
  }

  /**
   * Show browser notification
   */
  private showNotification(title: string, body: string, data?: any): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        data,
        requireInteraction: true
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Navigate to click_action if provided
        if (data?.click_action) {
          window.location.href = data.click_action;
        }
      };
    }
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  /**
   * Check if service is ready
   */
  isServiceReady(): boolean {
    return this.ready;
  }

  /**
   * Get current notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    return this.permissionStatus();
  }

  /**
   * Clear notification count
   */
  clearNotificationCount(): void {
    this.notificationCount.set(0);
  }

  /**
   * Get current FCM token
   */
  getToken(): string | null {
    return this.currentToken;
  }
}
