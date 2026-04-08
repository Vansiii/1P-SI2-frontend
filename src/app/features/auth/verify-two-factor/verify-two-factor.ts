import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { OtpInputComponent } from '../../../shared/ui/otp-input/otp-input';

interface TwoFactorChallengeState {

  email: string;
  otpExpiresAt: number;
  resendAvailableAt: number;
  attemptsExhausted?: boolean;
}

const TWO_FACTOR_CHALLENGE_KEY = 'two_factor_challenge_state';

@Component({
  selector: 'app-verify-two-factor',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, OtpInputComponent],
  templateUrl: './verify-two-factor.html',
  styleUrls: ['./verify-two-factor.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyTwoFactor {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private cooldownTimerId: ReturnType<typeof setInterval> | null = null;

  readonly isSubmitting = signal(false);
  readonly isResending = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly infoMessage = signal<string | null>(null);

  private errorMessageTimeout?: ReturnType<typeof setTimeout>;
  private infoMessageTimeout?: ReturnType<typeof setTimeout>;
  readonly email = signal('');
  readonly resendCooldown = signal(0);
  readonly otpExpiresIn = signal(300);
  readonly attemptsExhausted = signal(false);
  readonly canResend = computed(() => this.resendCooldown() === 0 && (this.isOtpExpired() || this.attemptsExhausted()));
  readonly isOtpExpired = computed(() => this.otpExpiresIn() <= 0);
  readonly canVerify = computed(() => !this.isOtpExpired() && !this.attemptsExhausted());
  readonly otpTimeLabel = computed(() => {
    const remaining = Math.max(this.otpExpiresIn(), 0);
    const minutes = Math.floor(remaining / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (remaining % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  });
  private otpTimerId: ReturnType<typeof setInterval> | null = null;

  readonly verifyForm = this.formBuilder.nonNullable.group({
    twoFaCode: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]],
  });

  ngOnInit(): void {
    this.verifyForm.controls.twoFaCode.valueChanges.subscribe((value) => {
      const sanitizedValue = this.normalizeOtpCode(value);
      if (value !== sanitizedValue) {
        this.verifyForm.controls.twoFaCode.setValue(sanitizedValue, { emitEvent: false });
      }
    });

    const emailParam = this.route.snapshot.queryParams['email'];
    const persistedState = this.getChallengeState();

    if (typeof emailParam === 'string' && emailParam.length > 0) {
      this.email.set(emailParam);

      if (!persistedState || persistedState.email !== emailParam) {
        this.initializeChallengeState(emailParam);
      } else {
        this.restoreChallengeState(persistedState);
      }
      return;
    }

    if (persistedState?.email) {
      this.email.set(persistedState.email);
      this.restoreChallengeState(persistedState);
      return;
    }

    this.setErrorMessage('No se detectó el correo para validar el OTP. Vuelve a iniciar sesión.');
  }

  ngOnDestroy(): void {
    if (this.cooldownTimerId) {
      clearInterval(this.cooldownTimerId);
      this.cooldownTimerId = null;
    }

    if (this.otpTimerId) {
      clearInterval(this.otpTimerId);
      this.otpTimerId = null;
    }
  }

  submitVerify(): void {
    if (this.verifyForm.invalid) {
      this.verifyForm.markAllAsTouched();
      return;
    }

    if (!this.email()) {
      this.setErrorMessage('No encontramos el correo de verificación. Inicia sesión nuevamente.');
      return;
    }

    if (this.isOtpExpired()) {
      this.setErrorMessage('El código ha expirado. Solicita uno nuevo');
      return;
    }

    if (this.attemptsExhausted()) {
      this.setErrorMessage('Has agotado los intentos. El código fue bloqueado, solicita uno nuevo');
      return;
    }

    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.isSubmitting.set(true);

    const { twoFaCode } = this.verifyForm.getRawValue();
    const normalizedCode = this.normalizeOtpCode(twoFaCode);

    this.authService
      .verify2FALogin(normalizedCode, this.email())
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.clearChallengeState();
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          const { message, isAttemptsExhausted } = this.extractErrorMessage(error, 'Código 2FA incorrecto o inválido.');
          
          if (isAttemptsExhausted) {
            this.attemptsExhausted.set(true);
            this.updateChallengeState({ attemptsExhausted: true });
            this.setErrorMessage('Has agotado los intentos. El código fue bloqueado, solicita uno nuevo');
          } else {
            this.setErrorMessage(message);
          }
        },
      });
  }

  resendCode(): void {
    if (!this.canResend() || !this.email()) {
      return;
    }

    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.isResending.set(true);

    this.authService
      .resend2FACode(this.email())
      .pipe(finalize(() => this.isResending.set(false)))
      .subscribe({
        next: (response) => {
          // Resetear el estado de intentos agotados
          this.attemptsExhausted.set(false);
          this.updateChallengeState({ attemptsExhausted: false });
          this.verifyForm.controls.twoFaCode.setValue('');
          this.verifyForm.controls.twoFaCode.markAsUntouched();
          
          this.setInfoMessage(response.message || 'Se envió un nuevo código a tu correo.');
          this.startResendCooldown(60);
          this.startOtpTimer(300);
        },
        error: (error) => {
          const { message } = this.extractErrorMessage(error, 'No se pudo reenviar el código OTP.');
          this.setErrorMessage(message);
        },
      });
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

  private startResendCooldown(totalSeconds: number): void {
    const resendAvailableAt = Date.now() + totalSeconds * 1000;
    this.updateChallengeState({ resendAvailableAt });

    this.startResendCooldownFromTimestamp(resendAvailableAt);
  }

  private startResendCooldownFromTimestamp(resendAvailableAt: number): void {
    if (this.cooldownTimerId) {
      clearInterval(this.cooldownTimerId);
    }

    this.resendCooldown.set(this.getRemainingSeconds(resendAvailableAt));

    if (this.resendCooldown() === 0) {
      this.updateChallengeState({ resendAvailableAt: Date.now() });
      return;
    }

    this.cooldownTimerId = setInterval(() => {
      const remaining = this.getRemainingSeconds(resendAvailableAt);
      if (remaining <= 0) {
        this.resendCooldown.set(0);
        this.updateChallengeState({ resendAvailableAt: Date.now() });
        if (this.cooldownTimerId) {
          clearInterval(this.cooldownTimerId);
          this.cooldownTimerId = null;
        }
        return;
      }

      this.resendCooldown.set(remaining);
    }, 1000);
  }

  private extractErrorMessage(error: unknown, fallbackMessage: string): { message: string; isAttemptsExhausted: boolean } {
    const maybeHttpError = error as {
      status?: number;
      error?: {
        message?: string;
        error?: {
          message?: string;
          code?: string;
          details?: {
            remaining_attempts?: number;
          };
        };
        detail?: unknown;
      } | string;
    };

    let message = fallbackMessage;
    let isAttemptsExhausted = false;

    if (typeof maybeHttpError.error === 'string' && maybeHttpError.error.trim().length > 0) {
      message = maybeHttpError.error;
    } else if (maybeHttpError.error && typeof maybeHttpError.error === 'object') {
      // Try error.error.message first
      if (typeof maybeHttpError.error.message === 'string' && maybeHttpError.error.message.trim().length > 0) {
        message = maybeHttpError.error.message;
      }

      // Try error.error.error.message (backend structure)
      const backendError = maybeHttpError.error.error;
      if (backendError && typeof backendError.message === 'string') {
        message = backendError.message;
        
        // Check if it's a rate limit error (attempts exhausted)
        if (backendError.code === 'RATE_LIMIT_EXCEEDED' || 
            message.includes('agotado') || 
            message.includes('bloqueado')) {
          isAttemptsExhausted = true;
        }
      }

      // Check for remaining attempts in details
      if (backendError && typeof backendError.details?.remaining_attempts === 'number') {
        const remaining = backendError.details.remaining_attempts;
        message = `Código incorrecto. Te quedan ${remaining} intentos`;
        
        if (remaining === 0) {
          isAttemptsExhausted = true;
        }
      }

      // Try error.error.detail
      const detail = maybeHttpError.error.detail;
      if (typeof detail === 'string' && !message) {
        message = detail;
      } else if (detail && typeof detail === 'object') {
        if (Array.isArray(detail) && detail.length > 0) {
          const firstItem = detail[0] as { msg?: unknown };
          if (typeof firstItem?.msg === 'string' && !message) {
            message = firstItem.msg;
          }
        }

        const detailMessage = (detail as { message?: unknown }).message;
        if (typeof detailMessage === 'string' && !message) {
          message = detailMessage;
        }
      }
    }

    if (maybeHttpError.status === 0) {
      message = 'No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose.';
    }

    // Additional check for attempts exhausted in message
    if (message.includes('agotado') || message.includes('bloqueado') || message.includes('Demasiados intentos')) {
      isAttemptsExhausted = true;
    }

    return { message, isAttemptsExhausted };
  }

  private normalizeOtpCode(value: string): string {
    return value.replace(/\D/g, '').slice(0, 6);
  }

  private startOtpTimer(totalSeconds: number): void {
    const otpExpiresAt = Date.now() + totalSeconds * 1000;
    this.updateChallengeState({ otpExpiresAt });

    this.startOtpTimerFromTimestamp(otpExpiresAt);
  }

  private startOtpTimerFromTimestamp(otpExpiresAt: number): void {
    if (this.otpTimerId) {
      clearInterval(this.otpTimerId);
    }

    this.otpExpiresIn.set(this.getRemainingSeconds(otpExpiresAt));

    if (this.otpExpiresIn() === 0) {
      return;
    }

    this.otpTimerId = setInterval(() => {
      const remaining = this.getRemainingSeconds(otpExpiresAt);
      if (remaining <= 0) {
        this.otpExpiresIn.set(0);
        if (this.otpTimerId) {
          clearInterval(this.otpTimerId);
          this.otpTimerId = null;
        }
        return;
      }

      this.otpExpiresIn.set(remaining);
    }, 1000);
  }

  private initializeChallengeState(email: string): void {
    const challengeState: TwoFactorChallengeState = {
      email,
      otpExpiresAt: Date.now() + 300 * 1000,
      resendAvailableAt: Date.now(),
      attemptsExhausted: false,
    };

    this.setChallengeState(challengeState);
    this.restoreChallengeState(challengeState);
  }

  private restoreChallengeState(challengeState: TwoFactorChallengeState): void {
    this.startOtpTimerFromTimestamp(challengeState.otpExpiresAt);
    this.startResendCooldownFromTimestamp(challengeState.resendAvailableAt);
    
    if (challengeState.attemptsExhausted) {
      this.attemptsExhausted.set(true);
    }
  }

  private getRemainingSeconds(timestampMs: number): number {
    return Math.max(0, Math.ceil((timestampMs - Date.now()) / 1000));
  }

  private getChallengeState(): TwoFactorChallengeState | null {
    try {
      const rawState = localStorage.getItem(TWO_FACTOR_CHALLENGE_KEY);
      if (!rawState) {
        return null;
      }

      const parsedState = JSON.parse(rawState) as Partial<TwoFactorChallengeState>;
      if (
        typeof parsedState.email !== 'string' ||
        typeof parsedState.otpExpiresAt !== 'number' ||
        typeof parsedState.resendAvailableAt !== 'number'
      ) {
        localStorage.removeItem(TWO_FACTOR_CHALLENGE_KEY);
        return null;
      }

      return parsedState as TwoFactorChallengeState;
    } catch {
      localStorage.removeItem(TWO_FACTOR_CHALLENGE_KEY);
      return null;
    }
  }

  private setChallengeState(challengeState: TwoFactorChallengeState): void {
    localStorage.setItem(TWO_FACTOR_CHALLENGE_KEY, JSON.stringify(challengeState));
  }

  private updateChallengeState(partialState: Partial<TwoFactorChallengeState>): void {
    const currentState = this.getChallengeState();
    if (!currentState) {
      return;
    }

    this.setChallengeState({
      ...currentState,
      ...partialState,
    });
  }

  private clearChallengeState(): void {
    localStorage.removeItem(TWO_FACTOR_CHALLENGE_KEY);
  }
}
