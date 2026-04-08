import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPassword {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  private errorMessageTimeout?: ReturnType<typeof setTimeout>;
  private successMessageTimeout?: ReturnType<typeof setTimeout>;

  readonly forgotForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submitForgot(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    const { email } = this.forgotForm.getRawValue();

    this.authService
      .requestPasswordReset(email)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (response) => {
          // Extract message from backend response
          const message = (response as any)?.data?.message || (response as any)?.message || 'Se ha enviado un enlace de recuperación a tu correo electrónico.';
          this.setSuccessMessage(message);
          this.forgotForm.reset();
        },
        error: (error) => {
          this.setErrorMessage(this.extractErrorMessage(error, 'Hubo un error al procesar tu solicitud.'));
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

  private setSuccessMessage(message: string): void {
    if (this.successMessageTimeout) clearTimeout(this.successMessageTimeout);
    this.successMessage.set(message);
    this.successMessageTimeout = setTimeout(() => {
      this.successMessage.set(null);
    }, 5000);
  }

  private extractErrorMessage(error: unknown, fallbackMessage: string): string {
    // Handle HttpErrorResponse
    if (error && typeof error === 'object' && 'error' in error) {
      const httpError = error as any;
      
      // Try to get message from error.error.error.message (backend structure)
      if (httpError.error && typeof httpError.error === 'object') {
        const backendError = httpError.error.error;
        if (backendError && typeof backendError.message === 'string') {
          return backendError.message;
        }
        
        // Try error.error.message
        if (typeof httpError.error.message === 'string') {
          return httpError.error.message;
        }
      }
      
      // Try to get from error.error.detail (old structure)
      if (httpError.error && typeof httpError.error.detail !== 'undefined') {
        const detail = httpError.error.detail;
        if (typeof detail === 'string') {
          return detail;
        }
        if (detail && typeof detail === 'object' && 'message' in detail) {
          const detailMessage = (detail as any).message;
          if (typeof detailMessage === 'string') {
            return detailMessage;
          }
        }
      }
      
      // Try error.message
      if (typeof httpError.message === 'string' && httpError.message !== 'Http failure response for (unknown url): 0 Unknown Error') {
        return httpError.message;
      }
    }

    return fallbackMessage;
  }
}
