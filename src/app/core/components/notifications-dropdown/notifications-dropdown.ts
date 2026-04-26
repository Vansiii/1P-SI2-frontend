import { Component, computed, inject, signal, effect, HostListener, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IncidentsService, type LegacyIncident } from '../../services/incidents.service';
import { AuthService } from '../../services/auth.service';
import { NotificationRealtimeService } from '../../services/notification-realtime.service';

@Component({
  selector: 'app-notifications-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications-dropdown.html',
  styleUrl: './notifications-dropdown.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationsDropdownComponent {
  private readonly incidentsService = inject(IncidentsService);
  private readonly authService = inject(AuthService);
  private readonly notificationRealtimeService = inject(NotificationRealtimeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isOpen = signal(false);
  readonly incidents = signal<LegacyIncident[]>([]);
  readonly loading = signal(false);
  readonly showNotificationAnimation = signal(false);
  
  // Toast notification state
  readonly showToast = signal(false);
  readonly toastNotification = signal<{ title: string; body: string } | null>(null);

  readonly user = this.authService.user;
  readonly isWorkshop = computed(() => this.user()?.user_type === 'workshop');
  readonly isAdmin = computed(() => this.user()?.user_type === 'admin');

  // Use real-time notification count
  readonly notificationCount = computed(() => this.notificationRealtimeService.unreadCount());

  readonly displayedIncidents = computed(() => {
    const incidents = this.incidents();
    if (this.isAdmin()) {
      return incidents.filter(i => i.estado_actual === 'sin_taller_disponible').slice(0, 5);
    } else if (this.isWorkshop()) {
      const workshopId = this.user()?.id;
      return incidents.filter(i => 
        i.estado_actual === 'pendiente' || 
        (i.taller_id === workshopId && ['asignado', 'en_proceso'].includes(i.estado_actual))
      ).slice(0, 5);
    }
    return [];
  });

  constructor() {
    // Subscribe to real-time notifications
    this.notificationRealtimeService.notificationReceived$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(notification => {
        console.log('🔔 New notification received in dropdown:', notification);
        
        // Show animation
        this.triggerNotificationAnimation();
        
        // Reload incidents to get updated data
        this.loadCompleteNotificationData();
      });

    // Cargar datos completos inicialmente
    this.loadCompleteNotificationData();
    
    // Suscribirse a cambios del servicio de incidentes
    // Usar un flag para evitar bucles infinitos
    let isUpdating = false;
    
    this.incidentsService.incidents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(incidents => {
        if (isUpdating) return;
        
        // Detectar cambios en el contador para recargar datos completos
        const currentCount = this.incidents().length;
        let expectedCount = 0;
        
        if (this.isAdmin()) {
          expectedCount = incidents.filter(i => i.estado_actual === 'sin_taller_disponible').length;
        } else if (this.isWorkshop()) {
          const workshopId = this.user()?.id;
          expectedCount = incidents.filter(i => 
            i.estado_actual === 'pendiente' || 
            (i.taller_id === workshopId && ['asignado', 'en_proceso'].includes(i.estado_actual))
          ).length;
        }
        
        // Si el contador cambió, recargar datos completos
        if (expectedCount !== currentCount && expectedCount > 0) {
          console.log(`🔔 Count changed: ${currentCount} → ${expectedCount}, reloading complete data`);
          isUpdating = true;
          this.loadCompleteNotificationData();
          // Reset flag después de un delay
          setTimeout(() => {
            isUpdating = false;
          }, 1000);
        }
      });
  }

  /**
   * Trigger notification animation
   */
  private triggerNotificationAnimation(): void {
    this.showNotificationAnimation.set(true);
    
    // Reset animation after 2 seconds
    setTimeout(() => {
      this.showNotificationAnimation.set(false);
    }, 2000);
    
    // Show toast notification
    this.showToastNotification('Nueva Notificación', 'Tienes una nueva solicitud de servicio');
  }
  
  /**
   * Show toast notification
   */
  private showToastNotification(title: string, body: string): void {
    // Set toast content
    this.toastNotification.set({ title, body });
    
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
  }

  /**
   * Cargar datos completos para notificaciones
   */
  private loadCompleteNotificationData(): void {
    if (this.isAdmin()) {
      // Admin: usar endpoint específico para incidentes sin taller
      this.incidentsService.getUnassignedIncidents()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (incidents) => {
            this.incidents.set(incidents);
            console.log('✅ Admin notifications loaded with complete data:', incidents.length);
          },
          error: (error) => {
            console.error('❌ Error loading admin notifications:', error);
            this.incidents.set([]);
          }
        });
    } else if (this.isWorkshop()) {
      // Workshop: usar endpoint específico para incidentes pendientes
      this.incidentsService.getPendingIncidents()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (incidents) => {
            this.incidents.set(incidents);
            console.log('✅ Workshop notifications loaded with complete data:', incidents.length);
          },
          error: (error) => {
            console.error('❌ Error loading workshop notifications:', error);
            this.incidents.set([]);
          }
        });
    } else {
      this.incidents.set([]);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Si el dropdown está abierto y el clic fue fuera del componente, cerrarlo
    if (this.isOpen()) {
      const target = event.target as HTMLElement;
      const clickedInside = target.closest('.notifications-wrapper');
      
      if (!clickedInside) {
        this.close();
      }
    }
  }

  toggle(): void {
    this.isOpen.update(state => !state);
  }

  close(): void {
    this.isOpen.set(false);
  }

  loadIncidents(): void {
    // Recargar datos completos
    this.loading.set(true);
    this.loadCompleteNotificationData();
    
    setTimeout(() => {
      this.loading.set(false);
    }, 500);
  }

  navigateToIncident(incident: LegacyIncident): void {
    // Cerrar dropdown primero
    this.close();
    
    // Navegar después de un pequeño delay
    setTimeout(() => {
      if (this.isAdmin()) {
        this.router.navigate(['/admin/incident', incident.id]);
      } else {
        this.router.navigate(['/workshop/incidents'], { 
          queryParams: { incidentId: incident.id } 
        });
      }
    }, 100);
  }

  viewAll(): void {
    // Cerrar dropdown primero
    this.close();
    
    // Navegar después de un pequeño delay
    setTimeout(() => {
      if (this.isAdmin()) {
        this.router.navigate(['/admin/unassigned-incidents']);
      } else {
        this.router.navigate(['/workshop/incidents']);
      }
    }, 100);
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMs < 0) return 'Ahora';
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  getStatusColor(estado: string): string {
    const colors: Record<string, string> = {
      'pendiente': '#f59e0b',
      'asignado': '#3b82f6',
      'en_proceso': '#1e40af',
      'resuelto': '#10b981',
      'cancelado': '#6b7280',
      'sin_taller_disponible': '#ef4444'
    };
    return colors[estado] || '#6b7280';
  }
}
