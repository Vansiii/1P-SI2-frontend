import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
  private readonly authService = inject(AuthService);

  readonly user = this.authService.user;
  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly homeActionLink = computed(() => (this.isAuthenticated() ? '/dashboard' : '/auth'));
  readonly homeActionText = computed(() =>
    this.isAuthenticated() ? 'Ir al panel privado' : 'Ingresar al sistema'
  );
}
