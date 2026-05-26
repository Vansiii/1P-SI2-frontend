import { ChangeDetectionStrategy, Component, inject, OnInit, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { PushTokenService } from './core/services/push-token.service';
import { WebSocketService } from './core/services/websocket.service';
import { RealtimeInitService } from './core/services/realtime-init.service';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { ConnectionStatusComponent } from './shared/components/connection-status';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent, ConnectionStatusComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly pushService = inject(PushNotificationService);
  private readonly pushTokenService = inject(PushTokenService);
  private readonly wsService = inject(WebSocketService);
  private readonly realtimeInit = inject(RealtimeInitService);
  private readonly PUSH_DEVICE_ID_KEY = 'mecanicoya_web_device_id';
  private readonly PUSH_REGISTERED_KEY = 'mecanicoya_push_registered_key';
  constructor() {
    // Effect para reaccionar a cambios en el estado de autenticación
    effect(() => {
      const currentUser = this.authService.currentUser();
      if (currentUser && this.pushService.isReady()) {
        this.registerPushToken();
      }
      
      // 🔌 Conectar WebSocket cuando el usuario está autenticado
      if (currentUser) {
        this.connectWebSocket();
      } else {
        this.disconnectWebSocket();
      }
    });

    // Effect para escuchar notificaciones recibidas
    effect(() => {
      const notification = this.pushService.latestNotification();
      if (notification) {
        console.log('🔔 Notification received:', notification);
        
        // Aquí puedes agregar lógica adicional como:
        // - Actualizar contador de notificaciones
        // - Mostrar toast/snackbar
        // - Actualizar datos en tiempo real
      }
    });
  }

  async ngOnInit() {
    // 🔐 Restore session FIRST
    console.log('🚀 App ngOnInit - Restoring session...');
    this.authService.restoreSession();
    
    // 🚀 Inicializar servicios en tiempo real
    this.realtimeInit.initialize();
    
    // Inicializar notificaciones push
    await this.initializePushNotifications();
    
    // Escuchar mensajes del Service Worker
    this.setupServiceWorkerListener();
  }

  /**
   * Inicializar notificaciones push
   */
  private async initializePushNotifications() {
    try {
      console.log('🔔 Initializing push notifications...');
      const initialized = await this.pushService.initialize();
      
      if (initialized) {
        console.log('✅ Push notifications ready');
        
        // Si ya hay usuario logueado, registrar token
        const currentUser = this.authService.currentUser();
        if (currentUser && this.pushService.isReady()) {
          await this.registerPushToken();
        }
      } else {
        console.warn('⚠️ Push notifications could not be initialized');
      }
    } catch (error) {
      console.error('❌ Error initializing push notifications:', error);
    }
  }

  /**
   * Registrar token FCM en el backend
   */
  private async registerPushToken() {
    const token = this.pushService.getToken();
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return;
    }

    const registerKey = `${currentUser.id}:web:${token ?? ''}`;
    if (token && localStorage.getItem(this.PUSH_REGISTERED_KEY) === registerKey) {
      return;
    }
    if (!token) {
      console.warn('⚠️ No FCM token available to register');
      return;
    }

    try {
      await this.pushTokenService.registerToken({
        token,
        platform: 'web',
        device_id: this.getOrCreateWebDeviceId()
      });
      localStorage.setItem(this.PUSH_REGISTERED_KEY, registerKey);
      
      console.log('📱 Push token registered successfully');
    } catch (error) {
      console.error('❌ Error registering push token:', error);
    }
  }

  private getOrCreateWebDeviceId(): string {
    const existing = localStorage.getItem(this.PUSH_DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }

    const created = `web-${crypto.randomUUID()}`;
    localStorage.setItem(this.PUSH_DEVICE_ID_KEY, created);
    return created;
  }

  /**
   * Escuchar mensajes del Service Worker (clicks en notificaciones)
   * Solo enfoca la ventana — NO navega automáticamente.
   */
  private setupServiceWorkerListener() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
          console.log('🖱️ Notification clicked (ignored — no auto-navigation)');
          window.focus();
        }
      });
    }
  }

  /**
   * Conectar WebSocket para actualizaciones en tiempo real
   */
  private connectWebSocket() {
    if (!this.wsService.isConnected()) {
      console.log('🔌 Connecting WebSocket for real-time updates...');
      this.wsService.connect();
    }
  }

  /**
   * Desconectar WebSocket
   */
  private disconnectWebSocket() {
    if (this.wsService.isConnected()) {
      console.log('🔌 Disconnecting WebSocket...');
      this.wsService.disconnect();
    }
  }
}
