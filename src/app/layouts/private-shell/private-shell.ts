import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsDropdownComponent } from '../../core/components/notifications-dropdown/notifications-dropdown';
import { IncidentsService } from '../../core/services/incidents.service';
import { VoiceCommandButtonComponent, VoiceCommandOutput } from '../../shared/components/voice-command-button/voice-command-button';

@Component({
  selector: 'app-private-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NotificationsDropdownComponent, VoiceCommandButtonComponent],
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
    if (rawType === 'admin' || rawType === 'administrator') return 'Administrador';
    return 'Usuario';
  });

  readonly isAdmin = computed(() => {
    const userType = this.user()?.user_type ?? '';
    return userType === 'admin' || userType === 'administrator';
  });

  readonly isWorkshop = computed(() => {
    const userType = this.user()?.user_type ?? '';
    return userType === 'workshop';
  });

  readonly isClient = computed(() => {
    const userType = this.user()?.user_type ?? '';
    return userType === 'client';
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
        setTimeout(() => {
          this.isLoggingOut.set(false);
        }, 500);
      },
      error: () => {
        this.isLoggingOut.set(false);
      }
    });
  }

  onVoiceCommand(result: VoiceCommandOutput): void {
    const { action, type } = result.comando;
    const text = (result.texto_transcrito || '').toLowerCase();

    // If user says "exportar/descargar" → go to reports page
    if (text.includes('exportar') || text.includes('descargar') || text.includes('reporte')) {
      if (this.isWorkshop()) {
        this.router.navigate(['/workshop/reports']);
      } else if (this.isAdmin()) {
        this.router.navigate(['/admin/reports']);
      }
      return;
    }

    if (action === 'report') {
      if (this.isWorkshop()) {
        if (type === 'kpi' || type === 'financial' || type === 'sla' || type === 'cancelled' || type === 'hotspots' || type === 'efficiency') {
          this.router.navigate(['/workshop/reports']);
        } else if (type === 'technicians') {
          this.router.navigate(['/workshop/technicians']);
        } else {
          this.router.navigate(['/workshop/reports']);
        }
      } else if (this.isAdmin()) {
        if (type === 'system' || type === 'efficiency' || type === 'hotspots') {
          this.router.navigate(['/admin/monitoring']);
        } else if (type === 'audit') {
          this.router.navigate(['/admin/audit-logs']);
        } else if (type === 'subscriptions') {
          this.router.navigate(['/admin/subscriptions']);
        } else if (type === 'financial') {
          this.router.navigate(['/admin/reports']);
        } else {
          this.router.navigate(['/admin/monitoring']);
        }
      }
    }
  }
}
