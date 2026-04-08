import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { LocationPickerComponent } from './location-picker/location-picker';
import { PasswordInputComponent } from '../../shared/ui/password-input/password-input';

const LOGIN_LOCKOUT_UNTIL_KEY = 'auth_login_lockout_until';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LocationPickerComponent, PasswordInputComponent],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPageComponent implements OnInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = signal<'login' | 'register'>('login');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly infoMessage = signal<string | null>(null);

  private errorMessageTimeout?: ReturnType<typeof setTimeout>;
  private infoMessageTimeout?: ReturnType<typeof setTimeout>;
  readonly selectedLocation = signal<{ lat: number; lng: number } | null>(null);
  readonly detectedAddress = signal<string>('');
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly lockoutUntilIso = signal<string | null>(null);
  readonly lockoutRemainingSeconds = signal(0);
  readonly isLoginLocked = computed(() => this.lockoutRemainingSeconds() > 0);
  readonly lockoutTimerLabel = computed(() => this.formatDuration(this.lockoutRemainingSeconds()));

  private lockoutIntervalId: ReturnType<typeof setInterval> | null = null;

  readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly workshopRegisterForm = this.formBuilder.nonNullable.group({
    first_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    last_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    phone: ['', [Validators.required, Validators.minLength(7), Validators.maxLength(20)]],
    workshop_name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    owner_name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    address: ['', [Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
    latitude: [0, [Validators.required]],
    longitude: [0, [Validators.required]],
    coverage_radius_km: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
  });

  ngOnInit(): void {
    this.restoreLockoutState();
  }

  ngOnDestroy(): void {
    this.stopLockoutTimer();
  }

  setMode(nextMode: 'login' | 'register'): void {
    this.mode.set(nextMode);
    this.clearAllMessages();
  }

  private clearAllMessages(): void {
    if (this.errorMessageTimeout) clearTimeout(this.errorMessageTimeout);
    if (this.infoMessageTimeout) clearTimeout(this.infoMessageTimeout);
    this.errorMessage.set(null);
    this.infoMessage.set(null);
  }

  private setErrorMessage(message: string): void {
    if (this.errorMessageTimeout) clearTimeout(this.errorMessageTimeout);
    this.errorMessage.set(message);
    this.errorMessageTimeout = setTimeout(() => {
      this.errorMessage.set(null);
    }, 5000);
  }

  private setInfoMessage(message: string): void {
    if (this.infoMessageTimeout) clearTimeout(this.infoMessageTimeout);
    this.infoMessage.set(message);
    this.infoMessageTimeout = setTimeout(() => {
      this.infoMessage.set(null);
    }, 5000);
  }

  onLocationSelected(event: { lat: number; lng: number; address: string }): void {
    this.selectedLocation.set({ lat: event.lat, lng: event.lng });
    this.detectedAddress.set(event.address);
    this.workshopRegisterForm.patchValue({
      latitude: event.lat,
      longitude: event.lng,
      address: event.address,
    });
  }

  useCurrentLocation(): void {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          this.onLocationSelected({ lat, lng, address: '' });
          this.setInfoMessage('Ubicación actual detectada correctamente');
        },
        (error) => {
          this.setErrorMessage('No se pudo obtener tu ubicación actual');
        }
      );
    } else {
      this.setErrorMessage('Tu navegador no soporta geolocalización');
    }
  }

  submitLogin(): void {
    if (this.isLoginLocked()) {
      this.setErrorMessage(`Cuenta temporalmente bloqueada. Intenta nuevamente en ${this.lockoutTimerLabel()}.`);
      return;
    }

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.isSubmitting.set(true);

    this.authService
      .login(this.loginForm.getRawValue())
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (result) => {
          this.clearLockoutState();

          if (result.requires_2fa) {
            this.setInfoMessage(result.message);
            this.router.navigate(['/auth/2fa'], { queryParams: { email: result.email } });
            return;
          }

          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          const parsedError = this.extractAuthError(error, 'No se pudo iniciar sesion.');

          if (parsedError.lockoutUntilIso) {
            this.activateLockout(parsedError.lockoutUntilIso);
            this.errorMessage.set(null);
          } else if (typeof parsedError.retryAfterSeconds === 'number' && parsedError.retryAfterSeconds > 0) {
            const lockoutUntil = new Date(Date.now() + parsedError.retryAfterSeconds * 1000).toISOString();
            this.activateLockout(lockoutUntil);
            this.errorMessage.set(null);
          } else {
            this.setErrorMessage(parsedError.message);
          }
        },
      });
  }

  submitRegister(): void {
    if (this.workshopRegisterForm.invalid) {
      this.workshopRegisterForm.markAllAsTouched();
      return;
    }

    // Validate password match
    const password = this.workshopRegisterForm.value.password;
    const confirmPassword = this.workshopRegisterForm.value.confirmPassword;
    
    if (password !== confirmPassword) {
      this.setErrorMessage('Las contraseñas no coinciden');
      return;
    }

    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.isSubmitting.set(true);

    const { confirmPassword: _, ...workshopPayload } = this.workshopRegisterForm.getRawValue();
    this.authService
      .registerWorkshop(workshopPayload as any)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          this.setErrorMessage(this.extractAuthError(error, 'No se pudo registrar el taller.').message);
        },
      });
  }

  private extractAuthError(
    error: unknown,
    fallbackMessage: string
  ): { message: string; lockoutUntilIso?: string; retryAfterSeconds?: number } {
    // Handle HttpErrorResponse
    if (error && typeof error === 'object' && 'error' in error) {
      const httpError = error as any;

      // Try to get message from error.error.error.message (backend structure)
      if (httpError.error && typeof httpError.error === 'object') {
        const backendError = httpError.error.error;
        if (backendError && typeof backendError === 'object') {
          const errorCode = typeof backendError.code === 'string' ? backendError.code : undefined;
          const details = backendError.details as Record<string, unknown> | undefined;
          const lockoutUntil = typeof details?.['lockout_until'] === 'string' ? details['lockout_until'] : undefined;
          const retryAfter =
            typeof details?.['retry_after'] === 'number'
              ? details['retry_after']
              : typeof details?.['remaining_seconds'] === 'number'
                ? details['remaining_seconds']
                : undefined;

          if (errorCode === 'ACCOUNT_LOCKED') {
            return {
              message: 'Tu cuenta está bloqueada temporalmente por seguridad.',
              lockoutUntilIso: lockoutUntil,
              retryAfterSeconds: retryAfter,
            };
          }

          if (typeof backendError.message === 'string') {
            return {
              message: backendError.message,
              lockoutUntilIso: lockoutUntil,
              retryAfterSeconds: retryAfter,
            };
          }
        }
        
        // Try error.error.message
        if (typeof httpError.error.message === 'string') {
          return { message: httpError.error.message };
        }
      }
      
      // Try to get from error.error.detail (old structure)
      if (httpError.error && typeof httpError.error.detail !== 'undefined') {
        const detail = httpError.error.detail;
        if (typeof detail === 'string') {
          return { message: detail };
        }
        if (detail && typeof detail === 'object' && 'message' in detail) {
          const detailMessage = (detail as any).message;
          if (typeof detailMessage === 'string') {
            return { message: detailMessage };
          }
        }
      }
      
      // Try error.message
      if (typeof httpError.message === 'string' && httpError.message !== 'Http failure response for (unknown url): 0 Unknown Error') {
        return { message: httpError.message };
      }
    }

    return { message: fallbackMessage };
  }

  private activateLockout(lockoutUntilIso: string): void {
    const lockoutUntil = new Date(lockoutUntilIso);
    if (Number.isNaN(lockoutUntil.getTime())) {
      return;
    }

    if (lockoutUntil.getTime() <= Date.now()) {
      this.clearLockoutState();
      return;
    }

    this.lockoutUntilIso.set(lockoutUntil.toISOString());
    localStorage.setItem(LOGIN_LOCKOUT_UNTIL_KEY, lockoutUntil.toISOString());
    this.refreshRemainingLockoutSeconds();
    this.startLockoutTimer();
  }

  private restoreLockoutState(): void {
    const storedLockoutUntil = localStorage.getItem(LOGIN_LOCKOUT_UNTIL_KEY);
    if (!storedLockoutUntil) {
      return;
    }

    this.activateLockout(storedLockoutUntil);
  }

  private refreshRemainingLockoutSeconds(): void {
    const untilIso = this.lockoutUntilIso();
    if (!untilIso) {
      this.lockoutRemainingSeconds.set(0);
      return;
    }

    const until = new Date(untilIso).getTime();
    const remainingSeconds = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    this.lockoutRemainingSeconds.set(remainingSeconds);

    if (remainingSeconds === 0) {
      this.clearLockoutState();
    }
  }

  private startLockoutTimer(): void {
    this.stopLockoutTimer();
    this.lockoutIntervalId = setInterval(() => {
      this.refreshRemainingLockoutSeconds();
    }, 1000);
  }

  private stopLockoutTimer(): void {
    if (!this.lockoutIntervalId) {
      return;
    }

    clearInterval(this.lockoutIntervalId);
    this.lockoutIntervalId = null;
  }

  private clearLockoutState(): void {
    this.stopLockoutTimer();
    this.lockoutUntilIso.set(null);
    this.lockoutRemainingSeconds.set(0);
    localStorage.removeItem(LOGIN_LOCKOUT_UNTIL_KEY);
  }

  private formatDuration(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
}
