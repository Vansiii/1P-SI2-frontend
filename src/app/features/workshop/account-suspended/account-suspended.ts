import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-account-suspended',
  standalone: true,
  imports: [],
  template: `
    <main class="auth-layout">
      <section class="form-panel">
        <div class="form-container" style="text-align:center;max-width:520px;">
          <div style="font-size:3rem;margin-bottom:1rem;">&#128683;</div>
          <h2 class="auth-title" style="margin-bottom:0.75rem;">Cuenta suspendida</h2>
          <p style="color:#64748b;font-size:0.9375rem;line-height:1.6;margin-bottom:1.5rem;">
            Tu cuenta ha sido suspendida. Esto puede deberse a un problema con tu suscripcion
            o a una decision administrativa. Contacta al administrador del sistema para resolverlo.
          </p>
          <div class="alert-banner" style="margin-bottom:1.5rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;flex-shrink:0;">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <p style="margin:0;">Tu suscripcion puede estar vencida o haber sido suspendida.</p>
          </div>
          <button type="button" class="submit-btn" (click)="logout()" style="width:auto;padding:0 2rem;display:inline-flex;align-items:center;justify-content:center;">
            Cerrar sesion
          </button>
        </div>
      </section>
    </main>
  `,
  styles: [`
    :host { display:block; min-height:100dvh; background:var(--base-bg); }
    .auth-layout { display:flex; align-items:center; justify-content:center; min-height:100dvh; padding:2rem; }
    .form-panel { flex:1; display:flex; align-items:center; justify-content:center; }
    .form-container { background:white; border:1px solid rgba(234,88,12,0.1); border-radius:20px; padding:2.5rem; box-shadow:0 8px 32px rgba(0,0,0,0.08); }
    .auth-title { font-size:1.5rem; font-weight:800; color:#0f172a; }
    .alert-banner { display:flex; align-items:center; gap:0.75rem; padding:1rem 1.25rem; border-radius:12px; font-size:0.875rem; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; }
    .submit-btn { background:linear-gradient(135deg,#ea580c 0%,#f97316 100%); color:white; border:none; border-radius:10px; font-weight:700; cursor:pointer; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSuspendedComponent {
  private readonly authService = inject(AuthService);

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.authService.clearSessionAndRedirect();
    });
  }
}
