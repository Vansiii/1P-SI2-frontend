import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { extractErrorMessage } from '../../../core/utils/error-handler.util';

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
          this.setErrorMessage(extractErrorMessage(error, 'Hubo un error al procesar tu solicitud.'));
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
}
