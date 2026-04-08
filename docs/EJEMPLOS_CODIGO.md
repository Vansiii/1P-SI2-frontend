# Ejemplos de Código - Seguridad y Validaciones

## Tabla de Contenidos

1. [Crear un Guard Personalizado](#crear-un-guard-personalizado)
2. [Usar el Auth Service](#usar-el-auth-service)
3. [Crear Validaciones Personalizadas](#crear-validaciones-personalizadas)
4. [Proteger Rutas](#proteger-rutas)
5. [Manejar Errores de Autenticación](#manejar-errores-de-autenticación)
6. [Crear un Interceptor Personalizado](#crear-un-interceptor-personalizado)
7. [Implementar Validaciones Asíncronas](#implementar-validaciones-asíncronas)

## Crear un Guard Personalizado

### Guard para Verificar Rol de Usuario

```typescript
// src/app/core/guards/role.guard.ts
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const user = authService.user();
    
    if (!user) {
      return router.createUrlTree(['/auth']);
    }

    if (allowedRoles.includes(user.user_type)) {
      return true;
    }

    // Usuario autenticado pero sin permisos
    return router.createUrlTree(['/unauthorized']);
  };
};
```

**Uso en rutas:**

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['WORKSHOP_OWNER'])],
    loadComponent: () => import('./features/admin/admin-page').then(m => m.AdminPage)
  }
];
```

### Guard para Verificar Email Verificado

```typescript
// src/app/core/guards/email-verified.guard.ts
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const emailVerifiedGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.user();
  
  if (!user) {
    return router.createUrlTree(['/auth']);
  }

  if (user.email_verified) {
    return true;
  }

  return router.createUrlTree(['/verify-email']);
};
```

## Usar el Auth Service

### En un Componente

```typescript
// src/app/features/profile/profile-page.ts
import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  template: `
    <div class="profile-container">
      @if (user(); as user) {
        <h1>Perfil de {{ user.first_name }} {{ user.last_name }}</h1>
        <p>Email: {{ user.email }}</p>
        <p>Tipo: {{ user.user_type }}</p>
        
        <button (click)="logout()" [disabled]="isLoggingOut()">
          @if (isLoggingOut()) {
            Cerrando sesión...
          } @else {
            Cerrar sesión
          }
        </button>
      }
    </div>
  `
})
export class ProfilePage {
  private readonly authService = inject(AuthService);
  
  readonly user = this.authService.user;
  readonly isLoggingOut = signal(false);

  logout(): void {
    this.isLoggingOut.set(true);
    
    this.authService.logout()
      .pipe(finalize(() => this.isLoggingOut.set(false)))
      .subscribe({
        error: (error) => {
          console.error('Error al cerrar sesión:', error);
        }
      });
  }
}
```

### Verificar Autenticación en un Componente

```typescript
// src/app/features/home/home-page.ts
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  template: `
    <div class="home-container">
      <h1>Bienvenido</h1>
      
      @if (isAuthenticated()) {
        <p>Hola, {{ userName() }}!</p>
        <button (click)="goToDashboard()">Ir al Dashboard</button>
      } @else {
        <p>Por favor, inicia sesión para continuar.</p>
        <button (click)="goToLogin()">Iniciar Sesión</button>
      }
    </div>
  `
})
export class HomePage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  
  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly userName = computed(() => {
    const user = this.authService.user();
    return user ? `${user.first_name} ${user.last_name}` : '';
  });

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  goToLogin(): void {
    this.router.navigate(['/auth']);
  }
}
```

## Crear Validaciones Personalizadas

### Validador de Contraseña Fuerte

```typescript
// src/app/core/validators/password.validators.ts
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class PasswordValidators {
  static strong(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;

      if (!value) {
        return null;
      }

      const hasUpperCase = /[A-Z]/.test(value);
      const hasLowerCase = /[a-z]/.test(value);
      const hasNumeric = /[0-9]/.test(value);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
      const isLengthValid = value.length >= 8;

      const passwordValid = hasUpperCase && hasLowerCase && hasNumeric && hasSpecialChar && isLengthValid;

      return !passwordValid ? {
        strongPassword: {
          hasUpperCase,
          hasLowerCase,
          hasNumeric,
          hasSpecialChar,
          isLengthValid
        }
      } : null;
    };
  }

  static match(controlName: string, matchingControlName: string): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      const control = formGroup.get(controlName);
      const matchingControl = formGroup.get(matchingControlName);

      if (!control || !matchingControl) {
        return null;
      }

      if (matchingControl.errors && !matchingControl.errors['passwordMismatch']) {
        return null;
      }

      if (control.value !== matchingControl.value) {
        matchingControl.setErrors({ passwordMismatch: true });
        return { passwordMismatch: true };
      } else {
        matchingControl.setErrors(null);
        return null;
      }
    };
  }
}
```

**Uso en formulario:**

```typescript
// En tu componente
this.form = this.formBuilder.group({
  password: ['', [Validators.required, PasswordValidators.strong()]],
  confirmPassword: ['', [Validators.required]]
}, {
  validators: PasswordValidators.match('password', 'confirmPassword')
});
```

**Template con mensajes de error:**

```html
<div class="form-group">
  <label for="password">Contraseña</label>
  <input id="password" type="password" formControlName="password" />
  
  @if (form.controls.password.touched && form.controls.password.errors) {
    @if (form.controls.password.errors['required']) {
      <span class="error">La contraseña es requerida.</span>
    }
    @if (form.controls.password.errors['strongPassword']; as errors) {
      <div class="error-list">
        <p>La contraseña debe contener:</p>
        <ul>
          <li [class.valid]="errors.isLengthValid">Al menos 8 caracteres</li>
          <li [class.valid]="errors.hasUpperCase">Una letra mayúscula</li>
          <li [class.valid]="errors.hasLowerCase">Una letra minúscula</li>
          <li [class.valid]="errors.hasNumeric">Un número</li>
          <li [class.valid]="errors.hasSpecialChar">Un carácter especial</li>
        </ul>
      </div>
    }
  }
</div>
```

### Validador de Email Único

```typescript
// src/app/core/validators/email.validators.ts
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { map, catchError, debounceTime, switchMap } from 'rxjs/operators';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export class EmailValidators {
  static uniqueEmail(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) {
        return of(null);
      }

      const httpClient = inject(HttpClient);

      return of(control.value).pipe(
        debounceTime(500),
        switchMap(email => 
          httpClient.get<{ exists: boolean }>(`${environment.apiBaseUrl}/auth/check-email`, {
            params: { email }
          })
        ),
        map(response => response.exists ? { emailTaken: true } : null),
        catchError(() => of(null))
      );
    };
  }
}
```

**Uso:**

```typescript
this.form = this.formBuilder.group({
  email: ['', 
    [Validators.required, Validators.email],
    [EmailValidators.uniqueEmail()]  // Validador asíncrono
  ]
});
```

## Proteger Rutas

### Configuración Completa de Rutas

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { publicOnlyGuard } from './core/guards/public-only.guard';
import { roleGuard } from './core/guards/role.guard';
import { emailVerifiedGuard } from './core/guards/email-verified.guard';

export const routes: Routes = [
  // Rutas públicas
  {
    path: '',
    component: HomePageComponent,
  },
  
  // Rutas de autenticación (solo para no autenticados)
  {
    path: 'auth',
    canActivate: [publicOnlyGuard],
    children: [
      { path: '', component: AuthPageComponent },
      { path: 'forgot-password', component: ForgotPasswordComponent },
      { path: 'reset-password', component: ResetPasswordComponent },
    ]
  },
  
  // Rutas privadas (requieren autenticación)
  {
    path: 'dashboard',
    canActivate: [authGuard],
    component: PrivateShellComponent,
    children: [
      { path: '', component: DashboardPageComponent },
      { path: 'profile', component: ProfilePageComponent },
    ]
  },
  
  // Rutas con verificación de email
  {
    path: 'settings',
    canActivate: [authGuard, emailVerifiedGuard],
    loadComponent: () => import('./features/settings/settings-page').then(m => m.SettingsPage)
  },
  
  // Rutas solo para administradores
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['WORKSHOP_OWNER'])],
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.adminRoutes)
  },
  
  // Página de no autorizado
  {
    path: 'unauthorized',
    loadComponent: () => import('./features/unauthorized/unauthorized-page').then(m => m.UnauthorizedPage)
  },
  
  // Redirección por defecto
  {
    path: '**',
    redirectTo: '',
  },
];
```

### Guards con Parámetros de Ruta

```typescript
// src/app/core/guards/resource-owner.guard.ts
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const resourceOwnerGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.user();
  const resourceOwnerId = route.paramMap.get('userId');

  if (!user) {
    return router.createUrlTree(['/auth']);
  }

  // Verificar si el usuario es el dueño del recurso
  if (user.id.toString() === resourceOwnerId) {
    return true;
  }

  return router.createUrlTree(['/unauthorized']);
};
```

**Uso:**

```typescript
{
  path: 'user/:userId/edit',
  canActivate: [authGuard, resourceOwnerGuard],
  component: UserEditComponent
}
```

## Manejar Errores de Autenticación

### Servicio de Manejo de Errores

```typescript
// src/app/core/services/error-handler.service.ts
import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

export interface ParsedError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class ErrorHandlerService {
  parseAuthError(error: unknown, fallbackMessage: string): ParsedError {
    if (error instanceof HttpErrorResponse) {
      // Estructura del backend actual
      if (error.error?.error) {
        const backendError = error.error.error;
        return {
          message: backendError.message || fallbackMessage,
          code: backendError.code,
          details: backendError.details
        };
      }

      // Estructura legacy
      if (error.error?.detail) {
        const detail = error.error.detail;
        if (typeof detail === 'string') {
          return { message: detail };
        }
        if (detail && typeof detail === 'object' && 'message' in detail) {
          return { message: (detail as any).message };
        }
      }

      // Error HTTP genérico
      if (error.status === 0) {
        return { message: 'No se pudo conectar con el servidor. Verifica tu conexión.' };
      }

      if (error.status === 401) {
        return { message: 'Credenciales inválidas o sesión expirada.' };
      }

      if (error.status === 403) {
        return { message: 'No tienes permisos para realizar esta acción.' };
      }

      if (error.status === 500) {
        return { message: 'Error interno del servidor. Intenta nuevamente más tarde.' };
      }
    }

    return { message: fallbackMessage };
  }

  getErrorMessage(error: ParsedError): string {
    return error.message;
  }

  hasErrorCode(error: ParsedError, code: string): boolean {
    return error.code === code;
  }
}
```

**Uso en componente:**

```typescript
import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';

@Component({
  selector: 'app-login',
  template: `
    @if (errorMessage()) {
      <div class="alert alert-error">{{ errorMessage() }}</div>
    }
    
    <form (ngSubmit)="login()">
      <!-- form fields -->
    </form>
  `
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly errorHandler = inject(ErrorHandlerService);
  
  readonly errorMessage = signal<string | null>(null);

  login(): void {
    this.authService.login(this.form.value).subscribe({
      next: () => {
        // Success
      },
      error: (error) => {
        const parsedError = this.errorHandler.parseAuthError(
          error,
          'No se pudo iniciar sesión.'
        );
        
        if (this.errorHandler.hasErrorCode(parsedError, 'ACCOUNT_LOCKED')) {
          // Manejar bloqueo de cuenta
          this.handleAccountLocked(parsedError.details);
        } else {
          this.errorMessage.set(parsedError.message);
        }
      }
    });
  }

  private handleAccountLocked(details?: Record<string, unknown>): void {
    // Lógica de bloqueo
  }
}
```

## Crear un Interceptor Personalizado

### Interceptor de Refresh Token

```typescript
// src/app/core/interceptors/refresh-token.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const refreshTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si el error es 401 y no es la ruta de login/refresh
      if (error.status === 401 && !request.url.includes('/auth/login') && !request.url.includes('/auth/refresh')) {
        // Intentar refrescar el token
        return authService.refreshAccessToken().pipe(
          switchMap(() => {
            // Reintentar la petición original con el nuevo token
            const accessToken = authService.getAccessToken();
            const clonedRequest = request.clone({
              setHeaders: {
                Authorization: `Bearer ${accessToken}`
              }
            });
            return next(clonedRequest);
          }),
          catchError((refreshError) => {
            // Si falla el refresh, cerrar sesión
            authService.logout();
            return throwError(() => refreshError);
          })
        );
      }

      return throwError(() => error);
    })
  );
};
```

**Registro:**

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        refreshTokenInterceptor  // Agregar después del auth interceptor
      ])
    ),
  ],
};
```

### Interceptor de Logging

```typescript
// src/app/core/interceptors/logging.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { tap } from 'rxjs';

export const loggingInterceptor: HttpInterceptorFn = (request, next) => {
  const startTime = Date.now();

  return next(request).pipe(
    tap({
      next: (event) => {
        if (event.type === 4) {  // HttpResponse
          const duration = Date.now() - startTime;
          console.log(`✅ ${request.method} ${request.url} - ${duration}ms`);
        }
      },
      error: (error) => {
        const duration = Date.now() - startTime;
        console.error(`❌ ${request.method} ${request.url} - ${duration}ms`, error);
      }
    })
  );
};
```

## Implementar Validaciones Asíncronas

### Validador de Username Disponible

```typescript
// src/app/core/validators/username.validators.ts
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, of, timer } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export class UsernameValidators {
  static available(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) {
        return of(null);
      }

      const httpClient = inject(HttpClient);

      // Debounce de 500ms
      return timer(500).pipe(
        switchMap(() => 
          httpClient.get<{ available: boolean }>(
            `${environment.apiBaseUrl}/auth/check-username`,
            { params: { username: control.value } }
          )
        ),
        map(response => response.available ? null : { usernameTaken: true }),
        catchError(() => of(null))
      );
    };
  }
}
```

**Template con indicador de carga:**

```html
<div class="form-group">
  <label for="username">Nombre de usuario</label>
  <div class="input-wrapper">
    <input 
      id="username" 
      type="text" 
      formControlName="username"
      [class.validating]="form.controls.username.pending"
    />
    @if (form.controls.username.pending) {
      <span class="spinner"></span>
    }
  </div>
  
  @if (form.controls.username.touched && form.controls.username.errors) {
    @if (form.controls.username.errors['required']) {
      <span class="error">El nombre de usuario es requerido.</span>
    }
    @if (form.controls.username.errors['usernameTaken']) {
      <span class="error">Este nombre de usuario ya está en uso.</span>
    }
  }
  
  @if (form.controls.username.valid && form.controls.username.touched) {
    <span class="success">✓ Nombre de usuario disponible</span>
  }
</div>
```

## Conclusión

Estos ejemplos cubren los casos de uso más comunes para implementar seguridad y validaciones en Angular. Puedes adaptarlos según las necesidades específicas de tu aplicación.

### Recursos Adicionales

- [Angular Forms Documentation](https://angular.io/guide/forms)
- [Angular Router Guards](https://angular.io/guide/router#preventing-unauthorized-access)
- [Angular HTTP Interceptors](https://angular.io/guide/http-interceptor-use-cases)
- [Reactive Forms Validation](https://angular.io/guide/form-validation)
