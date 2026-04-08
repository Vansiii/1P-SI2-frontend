import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { PasswordInputComponent } from '../../../shared/ui/password-input/password-input';

function matchPasswords(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PasswordInputComponent],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPassword implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly token = signal<string | null>(null);

  private errorMessageTimeout?: ReturnType<typeof setTimeout>;
  private successMessageTimeout?: ReturnType<typeof setTimeout>;

  readonly resetForm = this.formBuilder.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: matchPasswords }
  );

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      if (params['token']) {
        this.token.set(params['token']);
      }
    });
  }

  submitReset(): void {
    const currentToken = this.token();
    if (!currentToken) {
      this.setErrorMessage('Token de seguridad no encontrado o caducado en la URL.');
      return;
    }

    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSubmitting.set(true);

    const { password } = this.resetForm.getRawValue();

    this.authService
      .resetPassword(currentToken, password)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.setSuccessMessage('Tu contraseña se ha restablecido satisfactoriamente.');
          this.resetForm.reset();
        },
        error: (error) => {
          this.setErrorMessage(this.extractErrorMessage(error, 'Hubo un error al intentar cambiar la contraseña.'));
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
