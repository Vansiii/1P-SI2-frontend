import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnInit {
  private readonly authService = inject(AuthService);

  readonly user = this.authService.user;
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly displayName = computed(() => {
    const currentUser = this.user();
    if (!currentUser) {
      return 'Usuario';
    }

    if (currentUser.workshop_name) {
      return currentUser.workshop_name;
    }

    const fullName = `${currentUser.first_name ?? ''} ${currentUser.last_name ?? ''}`.trim();
    if (fullName.length > 0) {
      return fullName;
    }

    return currentUser.email;
  });

  readonly userTypeLabel = computed(() => {
    const currentType = this.user()?.user_type ?? '';
    if (currentType === 'workshop') return 'Taller';
    if (currentType === 'client') return 'Cliente';
    if (currentType === 'technician') return 'Tecnico';
    if (currentType === 'administrator' || currentType === 'admin') return 'Administrador';
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

  readonly twoFactorStatus = computed(() => {
    const currentUser = this.user();
    return Boolean(currentUser?.two_factor_enabled ?? currentUser?.mfa_enabled);
  });

  ngOnInit(): void {
    if (this.user()) {
      return;
    }

    this.isLoading.set(true);
    this.authService
      .fetchCurrentUser()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        error: () => {
          this.errorMessage.set('No fue posible cargar la sesion actual. Inicia sesion nuevamente.');
        },
      });
  }

  logout(): void {
    this.authService.logout().subscribe();
  }
}
