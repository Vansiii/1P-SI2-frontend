import { ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-account-pending',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="auth-layout">
      <section class="form-panel">
        <div class="form-container" style="text-align:center;max-width:520px;">
          <div style="font-size:3rem;margin-bottom:1rem;">&#9203;</div>
          <h2 class="auth-title" style="margin-bottom:0.75rem;">Cuenta pendiente de aprobacion</h2>
          <p style="color:#64748b;font-size:0.9375rem;line-height:1.6;margin-bottom:1.5rem;">
            Tu taller ha sido registrado exitosamente y esta pendiente de revision por nuestro equipo.
            Puedes iniciar sesion y configurar tu perfil, pero las funcionalidades completas
            se activaran cuando un administrador apruebe tu cuenta.
          </p>
          <div class="helper-note" style="margin-bottom:1.5rem;">
            Normalmente el proceso de aprobacion toma menos de 24 horas.
            Recibiras un correo cuando tu cuenta sea activada.
          </div>
          <p style="color:#16a34a;font-size:0.8125rem;margin-bottom:1rem;" [hidden]="!isChecking">
            Verificando estado de tu cuenta...
          </p>
          <div style="display:flex;gap:0.75rem;justify-content:center;">
            <a routerLink="/profile" class="submit-btn" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;width:auto;padding:0 2rem;">
              Ir a mi perfil
            </a>
            <button type="button" class="btn-secondary" (click)="logout()" style="padding:0.75rem 1.5rem;">
              Cerrar sesion
            </button>
          </div>
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
    .helper-note { color:#64748b; font-size:0.875rem; padding:1rem; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; }
    .submit-btn { background:linear-gradient(135deg,#ea580c 0%,#f97316 100%); color:white; border:none; border-radius:10px; font-weight:700; cursor:pointer; }
    .btn-secondary { background:white; border:1px solid #d1d5db; border-radius:6px; font-size:0.875rem; color:#374151; cursor:pointer; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPendingComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private pollSubscription?: Subscription;
  isChecking = false;

  ngOnInit(): void {
    this.pollSubscription = interval(10000).subscribe(() => {
      this.isChecking = true;
      this.authService.fetchCurrentUser().subscribe({
        next: () => {
          this.isChecking = false;
          if (this.authService.tenantStatus() === 'active') {
            this.router.navigate(['/workshop/dashboard']);
          }
        },
        error: () => {
          this.isChecking = false;
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.authService.clearSessionAndRedirect();
    });
  }
}
