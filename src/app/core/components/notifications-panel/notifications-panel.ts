import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IncidentsService, type Incident } from '../../services/incidents.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-notifications-panel',
  imports: [RouterLink],
  templateUrl: './notifications-panel.html',
  styleUrl: './notifications-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPanelComponent {
  private readonly incidentsService = inject(IncidentsService);
  private readonly authService = inject(AuthService);

  readonly close = output<void>();
  readonly countChange = output<number>();

  readonly incidents = signal<Incident[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly user = this.authService.user;
  readonly isWorkshop = computed(() => this.user()?.user_type === 'workshop');
  readonly isAdmin = computed(() => this.user()?.user_type === 'admin');
  readonly shouldShowNotifications = computed(() => this.isWorkshop() || this.isAdmin());

  readonly unreadCount = computed(() => {
    // Por ahora, todos los incidentes pendientes se consideran "no leídos"
    return this.incidents().filter(i => i.estado_actual === 'pendiente' || i.estado_actual === 'sin_taller_disponible').length;
  });

  constructor() {
    // Cargar incidentes al inicializar
    effect(() => {
      if (this.shouldShowNotifications()) {
        this.loadIncidents();
      }
    }, { allowSignalWrites: true });
  }

  loadIncidents(): void {
    this.loading.set(true);
    this.error.set(null);

    // Administradores ven incidentes sin taller, talleres ven pendientes
    const observable = this.isAdmin() 
      ? this.incidentsService.getUnassignedIncidents()
      : this.incidentsService.getPendingIncidents();

    observable.subscribe({
      next: (data) => {
        this.incidents.set(data);
        this.loading.set(false);
        // Emitir el conteo de pendientes/sin taller
        const count = this.isAdmin()
          ? data.filter((i: Incident) => i.estado_actual === 'sin_taller_disponible').length
          : data.filter((i: Incident) => i.estado_actual === 'pendiente').length;
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

  formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }
}
