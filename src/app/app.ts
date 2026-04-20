import { ChangeDetectionStrategy, Component, inject, OnInit, effect } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { PushTokenService } from './core/services/push-token.service';
import { WebSocketService } from './core/services/websocket.service';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly pushService = inject(PushNotificationService);
  private readonly pushTokenService = inject(PushTokenService);
  private readonly wsService = inject(WebSocketService);
  private readonly router = inject(Router);

  constructor() {
    this.authService.restoreSession();
    
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
  }

  async ngOnInit() {
    // Inicializar notificaciones push
    await this.initializePushNotifications();
    
    // Escuchar notificaciones recibidas
    this.setupNotificationListener();
    
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
    if (!token) {
      console.warn('⚠️ No FCM token available to register');
      return;
    }

    try {
      await this.pushTokenService.registerToken({
        token: token,
        platform: 'web',
        device_id: `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      });
      
      console.log('📱 Push token registered successfully');
    } catch (error) {
      console.error('❌ Error registering push token:', error);
    }
  }

  /**
   * Escuchar notificaciones recibidas
   */
  private setupNotificationListener() {
    this.pushService.notification$.subscribe(notification => {
      console.log('🔔 Notification received:', notification);
      
      // Aquí puedes agregar lógica adicional como:
      // - Actualizar contador de notificaciones
      // - Mostrar toast/snackbar
      // - Actualizar datos en tiempo real
    });
  }

  /**
   * Escuchar mensajes del Service Worker (clicks en notificaciones)
   */
  private setupServiceWorkerListener() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
          console.log('🖱️ Notification clicked, navigating to:', event.data.clickAction);
          
          // Navegar a la ruta especificada
          const clickAction = event.data.clickAction || '/';
          this.router.navigateByUrl(clickAction);
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
