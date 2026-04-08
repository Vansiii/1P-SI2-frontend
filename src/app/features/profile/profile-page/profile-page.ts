import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AppUserProfile } from '../../../core/models/auth.models';
import { AuthService } from '../../../core/services/auth.service';
import { LocationPickerComponent } from '../../auth/location-picker/location-picker';
import { PasswordInputComponent } from '../../../shared/ui/password-input/password-input';

function matchingPasswordsValidator(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;

  if (newPassword === confirmPassword) {
    return null;
  }

  return { passwordsMismatch: true };
}

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule, RouterLink, LocationPickerComponent, PasswordInputComponent],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly user = this.authService.user;
  readonly isLoading = signal(false);
  readonly isSavingProfile = signal(false);
  readonly isWorkingSecurity = signal(false);

  readonly profileError = signal<string | null>(null);
  readonly profileSuccess = signal<string | null>(null);
  readonly securityError = signal<string | null>(null);
  readonly securitySuccess = signal<string | null>(null);

  private profileErrorTimeout?: ReturnType<typeof setTimeout>;
  private profileSuccessTimeout?: ReturnType<typeof setTimeout>;
  private securityErrorTimeout?: ReturnType<typeof setTimeout>;
  private securitySuccessTimeout?: ReturnType<typeof setTimeout>;
  readonly pending2FASetup = signal(false);
  readonly selectedLocation = signal<{ lat: number; lng: number } | null>(null);
  readonly detectedAddress = signal<string>('');

  readonly displayName = computed(() => {
    const currentUser = this.user();
    if (!currentUser) {
      return 'Cuenta';
    }

    return this.resolveDisplayName(currentUser);
  });

  readonly userTypeLabel = computed(() => {
    const userType = this.resolveUserType(this.user());
    switch (userType) {
      case 'workshop':
        return 'Taller';
      case 'client':
        return 'Cliente';
      case 'technician':
        return 'Tecnico';
      case 'admin':
      case 'administrator':
        return 'Administrador';
      default:
        return 'Usuario';
    }
  });

  readonly isWorkshop = computed(() => this.resolveUserType(this.user()) === 'workshop');
  readonly isClient = computed(() => this.resolveUserType(this.user()) === 'client');
  readonly isTechnician = computed(() => this.resolveUserType(this.user()) === 'technician');
  readonly isMfaEnabled = computed(() => {
    const currentUser = this.user();
    return Boolean(currentUser?.mfa_enabled ?? currentUser?.two_factor_enabled ?? false);
  });

  readonly profileForm = this.formBuilder.nonNullable.group({
    direccion: ['', [Validators.maxLength(255)]],
    workshop_name: ['', [Validators.maxLength(120)]],
    owner_name: ['', [Validators.maxLength(120)]],
    latitude: [null as number | null, [Validators.min(-90), Validators.max(90)]],
    longitude: [null as number | null, [Validators.min(-180), Validators.max(180)]],
    coverage_radius_km: [null as number | null, [Validators.min(1), Validators.max(100)]],
    current_latitude: [null as number | null, [Validators.min(-90), Validators.max(90)]],
    current_longitude: [null as number | null, [Validators.min(-180), Validators.max(180)]],
    is_available: [false],
  });

  readonly passwordForm = this.formBuilder.nonNullable.group(
    {
      currentPassword: ['', [Validators.required, Validators.minLength(8)]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
    },
    { validators: matchingPasswordsValidator }
  );

  readonly twoFactorVerifyForm = this.formBuilder.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]],
  });

  readonly disable2FAForm = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly deleteAccountForm = this.formBuilder.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmation: ['', [Validators.required]],
  });

  readonly activeTab = signal<'profile'|'password'|'twofa'|'sessions'|'edit'>('profile');
  readonly navigationSource = signal<string | null>(null);

  setActiveTab(tab: 'profile'|'password'|'twofa'|'sessions'|'edit'): void {
    this.activeTab.set(tab);
    // Clear errors and success messages when tab changes
    this.clearAllMessages();
  }

  private clearAllMessages(): void {
    // Clear all timeouts
    if (this.profileErrorTimeout) clearTimeout(this.profileErrorTimeout);
    if (this.profileSuccessTimeout) clearTimeout(this.profileSuccessTimeout);
    if (this.securityErrorTimeout) clearTimeout(this.securityErrorTimeout);
    if (this.securitySuccessTimeout) clearTimeout(this.securitySuccessTimeout);

    // Clear all messages
    this.profileError.set(null);
    this.profileSuccess.set(null);
    this.securityError.set(null);
    this.securitySuccess.set(null);
  }

  private setProfileError(message: string): void {
    if (this.profileErrorTimeout) clearTimeout(this.profileErrorTimeout);
    this.profileError.set(message);
    this.profileErrorTimeout = setTimeout(() => {
      this.profileError.set(null);
    }, 5000);
  }

  private setProfileSuccess(message: string): void {
    if (this.profileSuccessTimeout) clearTimeout(this.profileSuccessTimeout);
    this.profileSuccess.set(message);
    this.profileSuccessTimeout = setTimeout(() => {
      this.profileSuccess.set(null);
    }, 5000);
  }

  private setSecurityError(message: string): void {
    if (this.securityErrorTimeout) clearTimeout(this.securityErrorTimeout);
    this.securityError.set(message);
    this.securityErrorTimeout = setTimeout(() => {
      this.securityError.set(null);
    }, 5000);
  }

  private setSecuritySuccess(message: string): void {
    if (this.securitySuccessTimeout) clearTimeout(this.securitySuccessTimeout);
    this.securitySuccess.set(message);
    this.securitySuccessTimeout = setTimeout(() => {
      this.securitySuccess.set(null);
    }, 5000);
  }

  goBack(): void {
    // Si venimos del navbar, volver al dashboard
    if (this.navigationSource() === 'navbar') {
      this.router.navigate(['/dashboard']);
    } else {
      // Si no, volver al perfil
      this.setActiveTab('profile');
    }
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  onLocationSelected(event: { lat: number; lng: number; address: string }): void {
    this.selectedLocation.set({ lat: event.lat, lng: event.lng });
    this.detectedAddress.set(event.address);
    this.profileForm.patchValue({
      latitude: event.lat,
      longitude: event.lng,
      direccion: event.address,
    });
  }

  ngOnInit(): void {
    // Detectar el origen de la navegación desde query params
    this.route.queryParams.subscribe((params) => {
      if (params['from']) {
        this.navigationSource.set(params['from']);
      }
    });

    this.route.fragment.subscribe((fragment) => {
      if (fragment === 'password') {
        this.setActiveTab('password');
      } else if (fragment === 'twofa') {
        this.setActiveTab('twofa');
      } else if (fragment === 'security') {
        this.setActiveTab('sessions');
      } else if (fragment === 'edit') {
        this.setActiveTab('edit');
      } else {
        this.setActiveTab('profile'); // Default to profile if no valid fragment
      }
    });

    if (this.user()) {
      this.patchProfileForm(this.user()!);
    }
    
    // Always refresh to get the latest DB state (like 2FA enabled, etc.)
    this.refreshCurrentUser();
  }

  saveProfile(): void {
    const currentUser = this.user();
    if (!currentUser) {
      this.setProfileError('No hay sesión activa para actualizar el perfil.');
      return;
    }

    this.profileError.set(null);
    this.profileSuccess.set(null);

    const payload = this.buildProfilePayload();
    if (Object.keys(payload).length === 0) {
      this.setProfileError('No se detectaron cambios para actualizar.');
      return;
    }

    this.isSavingProfile.set(true);
    this.authService
      .updateProfile(payload)
      .pipe(finalize(() => this.isSavingProfile.set(false)))
      .subscribe({
        next: (updatedProfile) => {
          this.patchProfileForm(updatedProfile);
          this.setProfileSuccess('Perfil actualizado correctamente.');
        },
        error: (error) => {
          this.setProfileError(this.extractErrorMessage(error, 'No se pudo actualizar el perfil.'));
        },
      });
  }

  submitPasswordChange(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.securityError.set(null);
    this.securitySuccess.set(null);
    this.isWorkingSecurity.set(true);

    const formValue = this.passwordForm.getRawValue();
    this.authService
      .changePassword(formValue.currentPassword, formValue.newPassword)
      .pipe(finalize(() => this.isWorkingSecurity.set(false)))
      .subscribe({
        next: (response) => {
          this.passwordForm.reset();
          this.setSecuritySuccess(response.message);
        },
        error: (error) => {
          this.setSecurityError(this.extractErrorMessage(error, 'No se pudo cambiar la contraseña.'));
        },
      });
  }

  enable2FA(): void {
    this.securityError.set(null);
    this.securitySuccess.set(null);
    this.isWorkingSecurity.set(true);

    this.authService
      .enable2FA()
      .pipe(finalize(() => this.isWorkingSecurity.set(false)))
      .subscribe({
        next: () => {
          this.pending2FASetup.set(true);
          this.setSecuritySuccess('Se envió un código OTP a tu correo. Ingresa el código para activar 2FA.');
        },
        error: (error) => {
          this.setSecurityError(this.extractErrorMessage(error, 'No se pudo iniciar la activación de 2FA.'));
        },
      });
  }

  verify2FASetup(): void {
    if (this.twoFactorVerifyForm.invalid) {
      this.twoFactorVerifyForm.markAllAsTouched();
      return;
    }

    this.securityError.set(null);
    this.securitySuccess.set(null);
    this.isWorkingSecurity.set(true);

    this.authService
      .verify2FASetup(this.twoFactorVerifyForm.getRawValue().code)
      .pipe(finalize(() => this.isWorkingSecurity.set(false)))
      .subscribe({
        next: () => {
          this.pending2FASetup.set(false);
          this.twoFactorVerifyForm.reset();
          this.setSecuritySuccess('2FA activado correctamente.');
          this.refreshCurrentUser();
        },
        error: (error) => {
          this.setSecurityError(this.extractErrorMessage(error, 'No se pudo verificar el código OTP.'));
        },
      });
  }

  disable2FA(): void {
    if (this.disable2FAForm.invalid) {
      this.disable2FAForm.markAllAsTouched();
      return;
    }

    this.securityError.set(null);
    this.securitySuccess.set(null);
    this.isWorkingSecurity.set(true);

    this.authService
      .disable2FA(this.disable2FAForm.getRawValue().password)
      .pipe(finalize(() => this.isWorkingSecurity.set(false)))
      .subscribe({
        next: (response) => {
          this.pending2FASetup.set(false);
          this.disable2FAForm.reset();
          this.setSecuritySuccess(response.message);
          this.refreshCurrentUser();
        },
        error: (error) => {
          this.setSecurityError(this.extractErrorMessage(error, 'No se pudo desactivar 2FA.'));
        },
      });
  }

  revokeAllSessions(): void {
    this.securityError.set(null);
    this.securitySuccess.set(null);
    this.isWorkingSecurity.set(true);

    this.authService
      .revokeAllSessions()
      .pipe(finalize(() => this.isWorkingSecurity.set(false)))
      .subscribe({
        next: (response) => {
          this.setSecuritySuccess(response.message);
        },
        error: (error) => {
          this.setSecurityError(this.extractErrorMessage(error, 'No se pudieron revocar las sesiones.'));
        },
      });
  }

  logout(): void {
    this.authService.logout().subscribe();
  }

  deleteAccount(): void {
    if (this.deleteAccountForm.invalid) {
      this.deleteAccountForm.markAllAsTouched();
      return;
    }

    if (this.deleteAccountForm.getRawValue().confirmation.trim().toUpperCase() !== 'ELIMINAR') {
      this.setSecurityError('Debes escribir ELIMINAR para confirmar la desactivación de tu cuenta.');
      return;
    }

    this.securityError.set(null);
    this.securitySuccess.set(null);
    this.isWorkingSecurity.set(true);

    this.authService
      .deleteAccount(this.deleteAccountForm.getRawValue().currentPassword)
      .pipe(finalize(() => this.isWorkingSecurity.set(false)))
      .subscribe({
        error: (error) => {
          this.setSecurityError(this.extractErrorMessage(error, 'No se pudo desactivar la cuenta.'));
        },
      });
  }

  private refreshCurrentUser(): void {
    this.isLoading.set(true);
    this.authService
      .fetchCurrentUser()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (profile) => {
          console.log('Profile data received:', profile); // Debug
          this.patchProfileForm(profile);
        },
        error: (error) => {
          this.setProfileError(this.extractErrorMessage(error, 'No se pudo cargar el perfil actual.'));
        },
      });
  }

  private patchProfileForm(profile: AppUserProfile): void {
    this.profileForm.patchValue({
      direccion: profile.direccion ?? '',
      workshop_name: profile.workshop_name ?? '',
      owner_name: profile.owner_name ?? '',
      latitude: profile.latitude ?? null,
      longitude: profile.longitude ?? null,
      coverage_radius_km: profile.coverage_radius_km ?? null,
      current_latitude: profile.current_latitude ?? null,
      current_longitude: profile.current_longitude ?? null,
      is_available: profile.is_available ?? false,
    });

    // Set initial location for map
    if (profile.latitude && profile.longitude) {
      this.selectedLocation.set({ lat: profile.latitude, lng: profile.longitude });
    }
    
    // Set detected address if available
    if (profile.direccion) {
      this.detectedAddress.set(profile.direccion);
    }
  }

  private buildProfilePayload(): {
    direccion?: string;
    workshop_name?: string;
    owner_name?: string;
    latitude?: number;
    longitude?: number;
    coverage_radius_km?: number;
    current_latitude?: number;
    current_longitude?: number;
    is_available?: boolean;
  } {
    const profileData = this.profileForm.getRawValue();
    const payload: {
      direccion?: string;
      workshop_name?: string;
      owner_name?: string;
      latitude?: number;
      longitude?: number;
      coverage_radius_km?: number;
      current_latitude?: number;
      current_longitude?: number;
      is_available?: boolean;
    } = {};

    if (this.isClient() && profileData.direccion.trim()) {
      payload.direccion = profileData.direccion.trim();
    }

    if (this.isWorkshop()) {
      if (profileData.workshop_name.trim()) payload.workshop_name = profileData.workshop_name.trim();
      if (profileData.owner_name.trim()) payload.owner_name = profileData.owner_name.trim();
      if (profileData.direccion.trim()) payload.direccion = profileData.direccion.trim();
      if (typeof profileData.latitude === 'number') payload.latitude = profileData.latitude;
      if (typeof profileData.longitude === 'number') payload.longitude = profileData.longitude;
      if (typeof profileData.coverage_radius_km === 'number') {
        payload.coverage_radius_km = profileData.coverage_radius_km;
      }
    }

    if (this.isTechnician()) {
      if (typeof profileData.current_latitude === 'number') {
        payload.current_latitude = profileData.current_latitude;
      }
      if (typeof profileData.current_longitude === 'number') {
        payload.current_longitude = profileData.current_longitude;
      }
      payload.is_available = Boolean(profileData.is_available);
    }

    return payload;
  }

  private resolveDisplayName(profile: AppUserProfile): string {
    const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();

    if (profile.workshop_name) {
      return profile.workshop_name;
    }

    if (fullName.length > 0) {
      return fullName;
    }

    return profile.owner_name ?? profile.email;
  }

  private resolveUserType(profile: AppUserProfile | null): string {
    if (!profile) {
      return '';
    }

    return profile.user_type || profile.role || '';
  }

  private extractErrorMessage(error: unknown, fallbackMessage: string): string {
    const maybeHttpError = error as {
      error?: {
        error?: {
          message?: string;
        };
        detail?: unknown;
      };
    };

    // Try to get message from error.error.error.message (backend structure)
    const backendError = maybeHttpError.error?.error;
    if (backendError && typeof backendError.message === 'string') {
      return backendError.message;
    }

    const detail = maybeHttpError.error?.detail;
    if (typeof detail === 'string') {
      return detail;
    }

    if (detail && typeof detail === 'object') {
      const detailMessage = (detail as { message?: unknown }).message;
      if (typeof detailMessage === 'string') {
        return detailMessage;
      }
    }

    return fallbackMessage;
  }
}
