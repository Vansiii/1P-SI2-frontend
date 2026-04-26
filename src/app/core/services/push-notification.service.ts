import { Injectable, inject } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging, MessagePayload } from 'firebase/messaging';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom, Subject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private http = inject(HttpClient);
  private firebaseApp: FirebaseApp | null = null;
  private messaging: Messaging | null = null;
  private currentToken: string | null = null;
  private ready = false;
  
  // Observable para notificaciones recibidas
  private notificationSubject = new Subject<MessagePayload>();
  public notification$ = this.notificationSubject.asObservable();

  constructor() {
    // No inicializar automáticamente, esperar a que se llame initialize()
  }

  /**
   * Inicializar Firebase y solicitar permisos
   */
  async initialize(): Promise<boolean> {
    try {
      // Verificar que la configuración de Firebase existe
      if (!environment.firebase) {
        console.warn('⚠️ Firebase no está configurado en environment');
        return false;
      }

      // Registrar el service worker para mensajes en background
      await this.registerServiceWorker();

      // Inicializar Firebase
      this.firebaseApp = initializeApp(environment.firebase);
      
      // Obtener instancia de messaging
      this.messaging = getMessaging(this.firebaseApp);
      
      console.log('✅ Firebase inicializado correctamente');

      // Solicitar permiso y obtener token
      const success = await this.requestPermissionAndGetToken();
      
      if (success) {
        this.ready = true;
        this.setupForegroundMessageListener();
      }
      
      return success;
    } catch (error) {
      console.error('❌ Error al inicializar Firebase:', error);
      return false;
    }
  }

  /**
   * Registrar el service worker de Firebase Messaging
   */
  private async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ Service Workers no soportados en este navegador');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js',
        { scope: '/' }
      );
      console.log('✅ Service Worker registrado:', registration.scope);
    } catch (error) {
      console.warn('⚠️ Error registrando Service Worker:', error);
      // No lanzar error — las notificaciones en foreground seguirán funcionando
    }
  }

  /**
   * Verificar si el servicio está listo
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Obtener el token actual
   */
  getToken(): string | null {
    return this.currentToken;
  }

  /**
   * Solicitar permiso para notificaciones y obtener token
   */
  private async requestPermissionAndGetToken(): Promise<boolean> {
    try {
      if (!this.messaging) {
        console.error('❌ Firebase Messaging no está inicializado');
        return false;
      }

      // Verificar si el navegador soporta notificaciones
      if (!('Notification' in window)) {
        console.warn('⚠️ Este navegador no soporta notificaciones');
        return false;
      }

      // Solicitar permiso
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        console.warn('⚠️ Permiso de notificaciones denegado');
        return false;
      }

      console.log('✅ Permiso de notificaciones concedido');

      // Obtener token FCM
      const token = await getToken(this.messaging, {
        vapidKey: environment.firebaseVapidKey
      });

      if (token) {
        console.log('✅ Token FCM obtenido:', token.substring(0, 20) + '...');
        this.currentToken = token;
        return true;
      } else {
        console.warn('⚠️ No se pudo obtener el token FCM');
        return false;
      }

    } catch (error) {
      console.error('❌ Error al solicitar permiso de notificaciones:', error);
      return false;
    }
  }

  /**
   * Configurar listener para mensajes en primer plano
   */
  private setupForegroundMessageListener(): void {
    if (!this.messaging) {
      return;
    }

    onMessage(this.messaging, (payload: MessagePayload) => {
      console.log('📬 Mensaje recibido en primer plano:', payload);

      // Emitir notificación a través del observable
      this.notificationSubject.next(payload);

      // Mostrar notificación del navegador
      if (payload.notification) {
        this.showNotification(
          payload.notification.title || 'Nueva notificación',
          payload.notification.body || '',
          payload.notification.image,
          payload.data
        );
      }
    });
  }

  /**
   * Mostrar notificación del navegador
   */
  private showNotification(
    title: string,
    body: string,
    icon?: string,
    data?: { [key: string]: string }
  ): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: body,
        icon: icon || '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-72x72.png',
        tag: 'mecanicoya-notification',
        requireInteraction: true,
        data: data
      });

      // Manejar clic en la notificación
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        
        // Navegar a la URL si está en los datos
        if (data && data['action_url']) {
          window.location.href = data['action_url'];
        }
        
        notification.close();
      };
    }
  }

  /**
   * Verificar si las notificaciones están habilitadas
   */
  isNotificationEnabled(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  /**
   * Obtener el estado del permiso de notificaciones
   */
  getNotificationPermission(): NotificationPermission {
    if ('Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  }
}
