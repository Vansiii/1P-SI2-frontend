import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { PasswordInputComponent } from '../../../shared/ui/password-input/password-input';
import { extractErrorMessage } from '../../../core/utils/error-handler.util';

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
          this.setErrorMessage(extractErrorMessage(error, 'Hubo un error al intentar cambiar la contraseña.'));
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
