import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsDropdownComponent } from '../../core/components/notifications-dropdown/notifications-dropdown';
import { IncidentsService } from '../../core/services/incidents.service';

@Component({
  selector: 'app-private-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NotificationsDropdownComponent],
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
  readonly isLoggingOut = signal(false);

  constructor() {
    // El nuevo componente de notificaciones maneja su propia lógica
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
    if (rawType === 'admin') return 'Administrador';
    return 'Usuario';
  });

  readonly isAdmin = computed(() => {
    const userType = this.user()?.user_type ?? '';
    return userType === 'admin';
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
    this.profileMenuOpen.set(!this.profileMenuOpen());
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
