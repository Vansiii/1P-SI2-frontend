import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard-page',
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnInit {
  private readonly authService = inject(AuthService);

  readonly user = this.authService.user;
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

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
