# Validaciones de Frontend y Guards de Rutas

## Resumen

El frontend de Angular implementa validaciones completas en formularios y guards de rutas para proteger el acceso a recursos autenticados. Las validaciones de frontend mejoran la UX al proporcionar feedback inmediato, mientras que el backend mantiene la validación autoritativa.

## Guards de Rutas Implementados

### 1. Auth Guard (`auth.guard.ts`)

Protege rutas que requieren autenticación.

```typescript
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth']);
};
```

**Uso en rutas:**
```typescript
{
  path: 'dashboard',
  canActivate: [authGuard],
  component: PrivateShellComponent,
  children: [...]
}
```

**Comportamiento:**
- Verifica si existe un token de acceso válido
- Si está autenticado: permite el acceso
- Si no está autenticado: redirige a `/auth`

### 2. Public Only Guard (`public-only.guard.ts`)

Previene que usuarios autenticados accedan a páginas públicas (login/registro).

```typescript
export const publicOnlyGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
```

**Uso en rutas:**
```typescript
{
  path: 'auth',
  canActivate: [publicOnlyGuard],
  children: [...]
}
```

**Comportamiento:**
- Verifica si el usuario NO está autenticado
- Si no está autenticado: permite el acceso
- Si está autenticado: redirige a `/dashboard`

## Validaciones de Formularios

### Formulario de Login

**Campos validados:**

| Campo | Validaciones | Mensaje de Error |
|-------|-------------|------------------|
| `email` | `required`, `email` | "Ingresa un correo electrónico válido." |
| `password` | `required`, `minLength(8)` | "La contraseña debe tener al menos 8 caracteres." |

**Características adicionales:**
- Bloqueo temporal de cuenta tras múltiples intentos fallidos
- Contador visual de tiempo de bloqueo
- Persistencia del estado de bloqueo en localStorage
- Manejo de respuestas 2FA

### Formulario de Registro de Taller

**Campos validados:**

| Campo | Validaciones | Mensaje de Error |
|-------|-------------|------------------|
| `first_name` | `required`, `minLength(2)`, `maxLength(60)` | "Obligatorio, mínimo 2 caracteres." |
| `last_name` | `required`, `minLength(2)`, `maxLength(60)` | "Obligatorio, mínimo 2 caracteres." |
| `phone` | `required`, `minLength(7)`, `maxLength(20)` | "Obligatorio, entre 7 y 20 caracteres." |
| `email` | `required`, `email` | "Formato incorrecto." |
| `workshop_name` | `required`, `minLength(3)`, `maxLength(120)` | "Obligatorio, mínimo 3 caracteres." |
| `owner_name` | `required`, `minLength(3)`, `maxLength(120)` | "Obligatorio, mínimo 3 caracteres." |
| `address` | `maxLength(255)` | - |
| `password` | `required`, `minLength(8)` | "Debes usar al menos 8 caracteres." |
| `confirmPassword` | `required`, custom match | "Debes confirmar tu contraseña." / "Las contraseñas no coinciden" |
| `latitude` | `required` | "Debes seleccionar la ubicación del taller en el mapa." |
| `longitude` | `required` | "Debes seleccionar la ubicación del taller en el mapa." |
| `coverage_radius_km` | `required`, `min(1)`, `max(100)` | "Debe estar entre 1 y 100 km." |

**Validación personalizada:**
```typescript
// Validación de coincidencia de contraseñas
const password = this.workshopRegisterForm.value.password;
const confirmPassword = this.workshopRegisterForm.value.confirmPassword;

if (password !== confirmPassword) {
  this.errorMessage.set('Las contraseñas no coinciden');
  return;
}
```

## Componentes de UI Reutilizables

### Password Input Component

Componente standalone para entrada de contraseñas con toggle de visibilidad:

```typescript
<app-password-input
  inputId="login-password"
  formControlName="password"
  autocomplete="current-password"
  placeholder="Tu clave de acceso"
  [error]="loginForm.controls.password.touched ? loginForm.controls.password.invalid : false"
></app-password-input>
```

**Características:**
- Toggle para mostrar/ocultar contraseña
- Indicador visual de error
- Integración con Reactive Forms
- Accesibilidad completa

### Location Picker Component

Componente para selección de ubicación geográfica:

```typescript
<app-location-picker 
  [initialLocation]="selectedLocation() || { lat: -17.3935, lng: -66.1570 }"
  (locationSelected)="onLocationSelected($event)"
/>
```

**Características:**
- Mapa interactivo
- Detección de ubicación actual
- Geocodificación inversa para obtener dirección
- Validación de coordenadas

## Manejo de Errores

### Extracción de Errores del Backend

El componente implementa un método robusto para extraer mensajes de error:

```typescript
private extractAuthError(
  error: unknown,
  fallbackMessage: string
): { message: string; lockoutUntilIso?: string; retryAfterSeconds?: number }
```

**Estructura de errores soportada:**
- `error.error.error.message` (estructura actual del backend)
- `error.error.detail` (estructura legacy)
- `error.message` (errores HTTP genéricos)
- Códigos de error específicos: `ACCOUNT_LOCKED`
- Detalles de bloqueo: `lockout_until`, `retry_after`

### Mensajes de Alerta

**Tipos de alertas:**

1. **Error** (rojo): Errores de validación o autenticación
2. **Info** (azul): Mensajes informativos (ej: "Se requiere 2FA")
3. **Lockout** (amarillo): Cuenta bloqueada temporalmente

```html
@if (errorMessage() && !isLoginLocked()) {
  <div class="alert-banner" role="alert">
    <p>{{ errorMessage() }}</p>
  </div>
}

@if (isLoginLocked()) {
  <div class="alert-banner lockout" role="status">
    <p>Cuenta bloqueada temporalmente. Podrás intentar de nuevo en {{ lockoutTimerLabel() }}.</p>
  </div>
}
```

## Sistema de Bloqueo de Cuenta

### Características

- **Detección automática**: El backend envía `lockout_until` o `retry_after`
- **Persistencia**: Estado guardado en localStorage
- **Contador visual**: Muestra tiempo restante en formato MM:SS
- **Deshabilitación de botón**: Previene intentos durante el bloqueo
- **Auto-limpieza**: Remueve el bloqueo cuando expira

### Implementación

```typescript
// Activar bloqueo
private activateLockout(lockoutUntilIso: string): void {
  this.lockoutUntilIso.set(lockoutUntilIso);
  localStorage.setItem(LOGIN_LOCKOUT_UNTIL_KEY, lockoutUntilIso);
  this.startLockoutTimer();
}

// Timer de actualización
private startLockoutTimer(): void {
  this.lockoutIntervalId = setInterval(() => {
    this.refreshRemainingLockoutSeconds();
  }, 1000);
}

// Formato de tiempo
private formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
```

## Flujo de Autenticación

### Login Normal

1. Usuario ingresa credenciales
2. Validación de frontend (email, password)
3. Envío al backend
4. Si exitoso: redirige a `/dashboard`
5. Si falla: muestra mensaje de error

### Login con 2FA

1. Usuario ingresa credenciales
2. Backend responde con `requires_2fa: true`
3. Frontend muestra mensaje informativo
4. Redirige a `/auth/2fa` con email en query params
5. Usuario ingresa código OTP
6. Si exitoso: redirige a `/dashboard`

### Registro de Taller

1. Usuario completa formulario
2. Validación de todos los campos
3. Validación de coincidencia de contraseñas
4. Validación de ubicación en mapa
5. Envío al backend
6. Si exitoso: sesión iniciada automáticamente, redirige a `/dashboard`

## Mejores Prácticas Implementadas

### 1. Validación Progresiva

- Los errores solo se muestran después de que el usuario toca el campo
- Uso de `touched` para evitar errores prematuros

```typescript
@if (loginForm.controls.email.touched && loginForm.controls.email.invalid) {
  <span class="field-error">Ingresa un correo electrónico válido.</span>
}
```

### 2. Feedback Visual

- Estados de carga con spinners
- Deshabilitación de botones durante submit
- Mensajes de error contextuales
- Indicadores de progreso

### 3. Accesibilidad

- Roles ARIA apropiados (`role="alert"`, `role="status"`)
- Labels asociados a inputs
- Navegación por teclado
- Mensajes descriptivos

### 4. Seguridad

- Autocomplete apropiado (`current-password`, `new-password`)
- Validación de longitud mínima de contraseña
- Confirmación de contraseña en registro
- Bloqueo temporal tras intentos fallidos

### 5. UX Mejorada

- Mensajes de error claros y específicos
- Hints informativos en campos complejos
- Detección automática de ubicación
- Persistencia de estado de bloqueo

## Rutas Protegidas

### Rutas Públicas (sin autenticación)

- `/` - Home
- `/auth` - Login/Registro
- `/auth/forgot-password` - Recuperación de contraseña
- `/auth/reset-password` - Reseteo de contraseña
- `/auth/2fa` - Verificación 2FA

### Rutas Privadas (requieren autenticación)

- `/dashboard` - Dashboard principal
- `/dashboard/profile` - Perfil de usuario

## Testing

### Casos de Prueba Recomendados

**Auth Guard:**
- ✓ Permite acceso con token válido
- ✓ Redirige a `/auth` sin token
- ✓ Redirige a `/auth` con token expirado

**Public Only Guard:**
- ✓ Permite acceso sin autenticación
- ✓ Redirige a `/dashboard` con sesión activa

**Validaciones de Login:**
- ✓ Email requerido y formato válido
- ✓ Password mínimo 8 caracteres
- ✓ Muestra errores solo después de touch
- ✓ Deshabilita submit durante carga
- ✓ Maneja bloqueo de cuenta correctamente

**Validaciones de Registro:**
- ✓ Todos los campos requeridos validados
- ✓ Contraseñas coinciden
- ✓ Ubicación seleccionada en mapa
- ✓ Radio de cobertura en rango válido

## Conclusión

El sistema de validaciones y guards implementado proporciona:

1. **Seguridad**: Guards previenen acceso no autorizado
2. **UX mejorada**: Validaciones inmediatas con feedback claro
3. **Robustez**: Manejo completo de errores del backend
4. **Accesibilidad**: Cumple con estándares ARIA
5. **Mantenibilidad**: Código limpio y bien estructurado

Las validaciones de frontend complementan (no reemplazan) las validaciones del backend, proporcionando una experiencia de usuario fluida mientras se mantiene la seguridad en el servidor.
