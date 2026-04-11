import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AppUserProfile,
  AuthTokenResponse,
  LoginRequest,
  LoginResult,
  RegisterWorkshopRequest,
  ProfileUpdateRequest,
} from '../models/auth.models';

const ACCESS_TOKEN_KEY = 'workshop_access_token';
const REFRESH_TOKEN_KEY = 'workshop_refresh_token';

interface LoginChallengePayload {
  message?: string;
  email?: string;
  requires_2fa?: boolean;
}

interface LoginChallengeResponse {
  detail?: LoginChallengePayload | string;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
  request_id?: string;
  timestamp?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly httpClient = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  private readonly accessTokenSignal = signal<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));
  private readonly refreshTokenSignal = signal<string | null>(localStorage.getItem(REFRESH_TOKEN_KEY));
  private readonly userSignal = signal<AppUserProfile | null>(null);

  readonly user = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.accessTokenSignal() !== null);

  restoreSession(): void {
    if (!this.accessTokenSignal()) {
      return;
    }

    this.fetchCurrentUser().subscribe({
      error: () => {
        this.clearSession();
      },
    });
  }

  registerWorkshop(registrationRequest: RegisterWorkshopRequest): Observable<AuthTokenResponse> {
    return this.httpClient
      .post<ApiResponse<{ user: AppUserProfile; tokens: Omit<AuthTokenResponse, 'user'> }>>(
        `${this.apiBaseUrl}/auth/register/workshop`,
        registrationRequest
      )
      .pipe(
        switchMap((response) => {
          const authResponse: AuthTokenResponse = {
            ...response.data.tokens,
            user: response.data.user,
          };
          this.persistSession(authResponse);
          
          // Fetch complete user profile to ensure all fields are loaded
          return this.fetchCurrentUser().pipe(
            map(() => authResponse)
          );
        })
      );
  }

  // Backwards-compatible alias for previous workshop-only registration.
  register(registrationRequest: RegisterWorkshopRequest): Observable<AuthTokenResponse> {
    return this.registerWorkshop(registrationRequest);
  }

  login(loginRequest: LoginRequest): Observable<LoginResult> {
    return this.httpClient
      .post<ApiResponse<{
        user?: AppUserProfile;
        tokens?: Omit<AuthTokenResponse, 'user'>;
        requires_2fa?: boolean;
        user_type?: string;
        message?: string;
      }>>(`${this.apiBaseUrl}/auth/login`, loginRequest)
      .pipe(
        switchMap((response) => {
          // Check if it's a 2FA challenge
          if (response.data.requires_2fa) {
            return of({
              requires_2fa: true,
              email: loginRequest.email,
              message: response.data.message ?? 'Se requiere verificacion 2FA para completar el ingreso.',
            } as const);
          }

          // Check if we have tokens in the response
          if (response.data.tokens && response.data.user) {
            const authResponse: AuthTokenResponse = {
              ...response.data.tokens,
              user: response.data.user,
            };
            this.persistSession(authResponse);
            
            // Fetch complete user profile to ensure all fields are loaded
            return this.fetchCurrentUser().pipe(
              map(() => ({
                requires_2fa: false,
                tokens: authResponse,
              } as const))
            );
          }

          throw new Error('Respuesta de autenticacion no reconocida.');
        })
      );
  }

  fetchCurrentUser(): Observable<AppUserProfile> {
    return this.httpClient
      .get<ApiResponse<AppUserProfile>>(`${this.apiBaseUrl}/auth/me`)
      .pipe(
        map(response => response.data),
        tap((userProfile) => this.userSignal.set(userProfile))
      );
  }

  requestPasswordReset(email: string): Observable<{ message: string }> {
    return this.httpClient.post<ApiResponse<{ message: string }>>(
      `${this.apiBaseUrl}/password/forgot`,
      { email }
    ).pipe(
      map((response) => ({
        message: response.data.message || response.message || 'Solicitud procesada correctamente'
      }))
    );
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.httpClient.post<ApiResponse<{ message: string }>>(
      `${this.apiBaseUrl}/password/reset`,
      { token, new_password: newPassword }
    ).pipe(
      map((response) => ({
        message: response.data.message || response.message || 'Contrasena actualizada correctamente'
      }))
    );
  }

  enable2FA(): Observable<{ message: string; email: string }> {
    return this.httpClient.post<ApiResponse<{ message: string; email: string }>>(
      `${this.apiBaseUrl}/2fa/enable`,
      {}
    ).pipe(
      map(response => response.data)
    );
  }

  verify2FASetup(code: string, secret = ''): Observable<{ message: string; two_factor_enabled: boolean }> {
    return this.httpClient.post<ApiResponse<{ message: string; two_factor_enabled: boolean }>>(
      `${this.apiBaseUrl}/2fa/verify`,
      { otp: code }
    ).pipe(
      map(response => response.data)
    );
  }

  verify2FALogin(code: string, email: string): Observable<AuthTokenResponse> {
    const normalizedCode = code.replace(/\D/g, '').slice(0, 6);
    return this.httpClient
      .post<ApiResponse<{ user: AppUserProfile; tokens: Omit<AuthTokenResponse, 'user'> }>>(`${this.apiBaseUrl}/auth/login/verify-2fa`, {
        email, 
        otp_code: normalizedCode 
      })
      .pipe(
        switchMap((response) => {
          const authResponse: AuthTokenResponse = {
            ...response.data.tokens,
            user: response.data.user,
          };
          this.persistSession(authResponse);
          
          // Fetch complete user profile to ensure all fields are loaded
          return this.fetchCurrentUser().pipe(
            map(() => authResponse)
          );
        })
      );
  }

  resend2FACode(email: string): Observable<{ message: string; email: string }> {
    return this.httpClient.post<ApiResponse<{ message: string; email: string }>>(
      `${this.apiBaseUrl}/2fa/resend`,
      { email }
    ).pipe(map((response) => response.data));
  }

  disable2FA(password: string): Observable<{ message: string }> {
    return this.httpClient.post<ApiResponse<{ message: string; two_factor_enabled: boolean }>>(
      `${this.apiBaseUrl}/2fa/disable`,
      { password }
    ).pipe(
      map((response) => ({ message: response.data.message || response.message || '2FA desactivado' }))
    );
  }

  updateProfile(profileUpdate: ProfileUpdateRequest): Observable<AppUserProfile> {
    return this.httpClient
      .patch<ApiResponse<Partial<AppUserProfile>>>(`${this.apiBaseUrl}/auth/me`, profileUpdate)
      .pipe(
        switchMap(() => this.fetchCurrentUser())
      );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.httpClient.post<ApiResponse<{ message: string }>>(
      `${this.apiBaseUrl}/password/change`,
      {
        current_password: currentPassword,
        new_password: newPassword,
      }
    ).pipe(
      map((response) => ({
        message: response.data.message || response.message || 'Contrasena actualizada correctamente',
      }))
    );
  }

  revokeAllSessions(): Observable<{ message: string }> {
    return this.httpClient
      .delete<ApiResponse<{ message: string; revoked_count: number }>>(`${this.apiBaseUrl}/sessions`)
      .pipe(
        map((response) => ({ 
          message: response.data.message || response.message || 'Sesiones revocadas correctamente' 
        }))
      );
  }

  deleteAccount(currentPassword: string): Observable<{ message: string }> {
    return this.httpClient
      .request<ApiResponse<{ deleted_at: string; message: string }>>('delete', `${this.apiBaseUrl}/auth/me`, {
        body: {
          password: currentPassword,
        },
      })
      .pipe(
        map((response) => ({
          message: response.data.message || response.message || 'Cuenta desactivada correctamente',
        })),
        tap(() => {
          this.clearSession();
          this.router.navigate(['/auth']);
        })
      );
  }

  logout(): Observable<void> {
    if (!this.accessTokenSignal()) {
      this.clearSession();
      this.router.navigate(['/auth']);
      return of(void 0);
    }

    return this.httpClient.post<ApiResponse<{ message: string }>>(`${this.apiBaseUrl}/auth/logout`, {}).pipe(
      catchError(() => of({ data: { message: 'Sesion cerrada localmente' }, message: 'Sesion cerrada localmente' })),
      tap(() => {
        this.clearSession();
        this.router.navigate(['/auth']);
      }),
      map(() => void 0),
    );
  }

  getAccessToken(): string | null {
    return this.accessTokenSignal();
  }

  getRefreshToken(): string | null {
    return this.refreshTokenSignal();
  }

  private persistSession(authResponse: AuthTokenResponse): void {
    this.accessTokenSignal.set(authResponse.access_token);
    this.refreshTokenSignal.set(authResponse.refresh_token);
    localStorage.setItem(ACCESS_TOKEN_KEY, authResponse.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, authResponse.refresh_token);
    this.userSignal.set(authResponse.user);
  }

  private clearSession(): void {
    this.accessTokenSignal.set(null);
    this.refreshTokenSignal.set(null);
    this.userSignal.set(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}
