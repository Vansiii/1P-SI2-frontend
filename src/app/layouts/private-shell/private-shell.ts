import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsPanelComponent } from '../../core/components/notifications-panel/notifications-panel';
import { IncidentsService } from '../../core/services/incidents.service';

@Component({
  selector: 'app-private-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NotificationsPanelComponent],
  templateUrl: './private-shell.html',
  styleUrl: './private-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivateShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly incidentsService = inject(IncidentsService);

  readonly user = this.authService.user;
  readonly sidebarOpen = signal(false);
  readonly profileMenuOpen = signal(false);
  readonly notificationsOpen = signal(false);
  readonly isLoggingOut = signal(false);
  readonly notificationCount = signal(0);

  constructor() {
    // Cargar contador inicial de notificaciones para talleres
    effect(() => {
      if (this.isWorkshop()) {
        this.loadNotificationCount();
      }
    }, { allowSignalWrites: true });
  }

  private loadNotificationCount(): void {
    this.incidentsService.getPendingIncidents().subscribe({
      next: (response) => {
        const data = response.data || [];
        const pendingCount = data.filter(i => i.estado_actual === 'pendiente').length;
        this.notificationCount.set(pendingCount);
      },
      error: (err) => {
        console.error('Error loading notification count:', err);
        this.notificationCount.set(0);
      }
    });
  }

  readonly displayName = computed(() => {
    const currentUser = this.user();
    if (!currentUser) {
      return 'Operador';
    }

    if (currentUser.workshop_name) {
      return currentUser.workshop_name;
    }

    const candidate = `${currentUser.first_name ?? ''} ${currentUser.last_name ?? ''}`.trim();
    return candidate || currentUser.email;
  });

  readonly roleLabel = computed(() => {
    const rawType = this.user()?.user_type ?? '';
    if (rawType === 'workshop') return 'Taller';
    if (rawType === 'client') return 'Cliente';
    if (rawType === 'technician') return 'Tecnico';
    if (rawType === 'administrator' || rawType === 'admin') return 'Administrador';
    return 'Usuario';
  });

  readonly isAdmin = computed(() => {
    const userType = this.user()?.user_type ?? '';
    return userType === 'administrator' || userType === 'admin';
  });

  readonly isWorkshop = computed(() => {
    const userType = this.user()?.user_type ?? '';
    return userType === 'workshop';
  });

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  toggleProfileMenu(): void {
    this.notificationsOpen.set(false);
    this.profileMenuOpen.set(!this.profileMenuOpen());
  }

  toggleNotifications(): void {
    this.profileMenuOpen.set(false);
    this.notificationsOpen.set(!this.notificationsOpen());
  }

  closeNotifications(): void {
    this.notificationsOpen.set(false);
  }

  onNotificationCountChange(count: number): void {
    this.notificationCount.set(count);
  }

  openProfileSection(fragment: string): void {
    this.profileMenuOpen.set(false);
    this.router.navigate(['/profile'], { 
      fragment,
      queryParams: { from: 'navbar' }
    });
  }

  logout(): void {
    this.profileMenuOpen.set(false);
    this.isLoggingOut.set(true);
    
    this.authService.logout().subscribe({
      complete: () => {
        // El servicio ya redirige, pero mantenemos el estado de carga
        // hasta que la navegación complete
        setTimeout(() => {
          this.isLoggingOut.set(false);
        }, 500);
      },
      error: () => {
        // En caso de error, también quitamos el loading
        this.isLoggingOut.set(false);
      }
    });
  }
}
