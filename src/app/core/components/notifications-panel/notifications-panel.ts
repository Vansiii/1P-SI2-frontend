import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, output, signal, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IncidentsService, type LegacyIncident } from '../../services/incidents.service';
import { AuthService } from '../../services/auth.service';
import { NotificationRealtimeService } from '../../services/notification-realtime.service';

@Component({
  selector: 'app-notifications-panel',
  imports: [RouterLink, ScrollingModule],
  templateUrl: './notifications-panel.html',
  styleUrl: './notifications-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPanelComponent implements OnDestroy {
  private readonly incidentsService = inject(IncidentsService);
  private readonly authService = inject(AuthService);
  private readonly notificationRealtimeService = inject(NotificationRealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private timeRefreshInterval: any = null;

  readonly close = output<void>();
  readonly countChange = output<number>();

  readonly incidents = signal<LegacyIncident[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly timeTick = signal(Date.now());

  readonly user = this.authService.user;
  readonly isWorkshop = computed(() => this.user()?.user_type === 'workshop');
  readonly isAdmin = computed(() => this.user()?.user_type === 'admin');
  readonly shouldShowNotifications = computed(() => this.isWorkshop() || this.isAdmin());

  // Use real-time notification count
  readonly unreadCount = computed(() => this.notificationRealtimeService.unreadCount());
  
  // Animation state
  readonly showToast = signal(false);
  readonly toastNotification = signal<{ title: string; body: string } | null>(null);

  constructor() {
    // Subscribe to real-time notifications
    this.notificationRealtimeService.notificationReceived$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(notification => {
        console.log('🔔 New notification received in panel:', notification);
        
        // Show animation or toast notification
        this.showNotificationAnimation(notification);
        
        // Reload incidents to get updated data
        this.loadIncidents();
      });

    // Subscribe to badge updates
    this.notificationRealtimeService.badgeUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(badge => {
        console.log('🔔 Badge updated in panel:', badge);
        this.countChange.emit(badge.unreadCount);
      });

    // Suscribirse a actualizaciones en tiempo real del servicio de incidentes
    // IMPORTANTE: Usar setTimeout para evitar que se ejecute inmediatamente al abrir el panel
    effect(() => {
      if (this.shouldShowNotifications()) {
        // Esperar un tick para evitar conflictos con el evento de clic
        setTimeout(() => {
          // Suscribirse al observable de incidentes del servicio
          this.incidentsService.incidents$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(incidents => {
              // Filtrar según el tipo de usuario
              let filteredIncidents: LegacyIncident[] = [];
            
            if (this.isAdmin()) {
              // Administradores ven incidentes sin taller disponible
              filteredIncidents = incidents.filter(i => i.estado_actual === 'sin_taller_disponible');
            } else if (this.isWorkshop()) {
              // Talleres ven incidentes pendientes y asignados a ellos
              const currentUser = this.user();
              const workshopId = currentUser?.id;
              filteredIncidents = incidents.filter(i => 
                i.estado_actual === 'pendiente' || 
                (i.taller_id === workshopId && ['asignado', 'en_proceso'].includes(i.estado_actual))
              );
            }
            
            this.incidents.set(filteredIncidents);
            this.loading.set(false);
            
            // Emitir el conteo actualizado
            this.countChange.emit(filteredIncidents.length);
          });
          
          // Cargar incidentes inicialmente
          this.incidentsService.loadIncidents();
        }, 0); // Cerrar setTimeout
      }
    }, { allowSignalWrites: true });

    // Actualizar tiempos relativos cada 10 segundos (más frecuente para mejor sincronización)
    this.timeRefreshInterval = setInterval(() => {
      this.timeTick.set(Date.now());
    }, 10_000); // 10 segundos en lugar de 60
  }

  ngOnDestroy(): void {
    if (this.timeRefreshInterval) {
      clearInterval(this.timeRefreshInterval);
    }
  }

  /**
   * Show notification animation
   */
  private showNotificationAnimation(notification: any): void {
    // Set toast content
    this.toastNotification.set({
      title: notification.title || 'Nueva Notificación',
      body: notification.body || 'Tienes una nueva notificación'
    });
    
    // Show toast
    this.showToast.set(true);
    
    // Hide toast after 4 seconds
    setTimeout(() => {
      this.showToast.set(false);
      
      // Clear toast content after animation
      setTimeout(() => {
        this.toastNotification.set(null);
      }, 300);
    }, 4000);
    
    console.log('🎬 Notification toast shown:', notification.title);
  }

  loadIncidents(): void {
    this.loading.set(true);
    this.error.set(null);

    // Administradores ven incidentes sin taller, talleres ven pendientes
    const observable = this.isAdmin() 
      ? this.incidentsService.getUnassignedIncidents()
      : this.incidentsService.getPendingIncidents();

    observable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.incidents.set(data);
          this.loading.set(false);
          // Emitir el conteo de pendientes/sin taller
          const count = this.isAdmin()
            ? data.filter((i: LegacyIncident) => i.estado_actual === 'sin_taller_disponible').length
            : data.filter((i: LegacyIncident) => i.estado_actual === 'pendiente').length;
          this.countChange.emit(count);
        },
        error: (err) => {
          console.error('Error loading incidents:', err);
          this.error.set('Error al cargar notificaciones');
          this.loading.set(false);
          this.countChange.emit(0);
        }
      });
  }

  getStatusColor(estado: string): string {
    switch (estado) {
      case 'pendiente':
        return '#f59e0b';
      case 'asignado':
        return '#3b82f6';
      case 'en_proceso':
        return '#1e40af';
      case 'resuelto':
        return '#10b981';
      case 'cancelado':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  }

  getPriorityColor(prioridad: string | null): string {
    switch (prioridad) {
      case 'alta':
        return '#ef4444';
      case 'media':
        return '#f59e0b';
      case 'baja':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  }

  formatTimeAgo(dateString: string, _tick = this.timeTick()): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Manejar diferencias de sincronización de reloj (si el timestamp es del futuro)
    if (diffMs < 0) {
      return 'Hace un momento';
    }

    // Mostrar segundos para eventos muy recientes
    if (diffSecs < 60) {
      if (diffSecs < 5) return 'Hace un momento';
      return `Hace ${diffSecs} seg`;
    }
    
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  /**
   * ✅ TrackBy function for virtual scroll optimization
   * Helps Angular identify which items changed
   */
  trackByIncidentId(index: number, incident: LegacyIncident): number {
    return incident.id;
  }
}
