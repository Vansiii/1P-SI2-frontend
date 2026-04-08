# Arquitectura de Seguridad - Frontend Angular

## Visión General

El frontend implementa múltiples capas de seguridad para proteger la aplicación y los datos del usuario. La seguridad se implementa en tres niveles principales:

1. **Guards de Rutas**: Control de acceso a nivel de navegación
2. **Interceptores HTTP**: Gestión automática de autenticación
3. **Validaciones de Formularios**: Prevención de datos inválidos

## Diagrama de Flujo de Autenticación

```
┌─────────────────────────────────────────────────────────────┐
│                    Usuario No Autenticado                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   Intenta acceder a    │
         │   /dashboard           │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │   Auth Guard           │
         │   isAuthenticated()?   │
         └────────┬───────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼ NO              ▼ SI
    ┌─────────┐      ┌──────────┐
    │ Redirige│      │ Permite  │
    │ a /auth │      │ acceso   │
    └─────────┘      └──────────┘
         │                 │
         ▼                 ▼
    ┌─────────┐      ┌──────────┐
    │ Login/  │      │ Dashboard│
    │ Registro│      │          │
    └─────────┘      └──────────┘
         │
         ▼
    ┌─────────────────┐
    │ Ingresa         │
    │ credenciales    │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Validación      │
    │ Frontend        │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ HTTP POST       │
    │ /auth/login     │
    └────────┬────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼ 2FA             ▼ Success
┌─────────┐      ┌──────────────┐
│ Redirige│      │ Guarda tokens│
│ a /2fa  │      │ en localStorage
└─────────┘      └──────┬───────┘
                        │
                        ▼
                 ┌──────────────┐
                 │ Redirige a   │
                 │ /dashboard   │
                 └──────────────┘
```

## Componentes de Seguridad

### 1. Auth Service

**Ubicación**: `src/app/core/services/auth.service.ts`

**Responsabilidades**:
- Gestión de tokens JWT (access y refresh)
- Persistencia de sesión en localStorage
- Estado de autenticación reactivo con signals
- Operaciones de login, registro, logout
- Gestión de 2FA
- Recuperación de contraseña

**Signals principales**:
```typescript
private readonly accessTokenSignal = signal<string | null>(null);
private readonly refreshTokenSignal = signal<string | null>(null);
private readonly userSignal = signal<AppUserProfile | null>(null);

// Computed signals
readonly isAuthenticated = computed(() => this.accessTokenSignal() !== null);
readonly user = this.userSignal.asReadonly();
```

**Métodos clave**:
- `login()`: Autenticación con email/password
- `register()`: Registro de nuevos talleres
- `logout()`: Cierre de sesión y limpieza
- `restoreSession()`: Restauración de sesión al cargar la app
- `getAccessToken()`: Obtención del token para interceptor

### 2. Auth Guard

**Ubicación**: `src/app/core/guards/auth.guard.ts`

**Tipo**: Functional Guard (`CanActivateFn`)

**Lógica**:
```typescript
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;  // Permite acceso
  }

  return router.createUrlTree(['/auth']);  // Redirige a login
};
```

**Rutas protegidas**:
- `/dashboard` y todas sus rutas hijas
- `/dashboard/profile`

### 3. Public Only Guard

**Ubicación**: `src/app/core/guards/public-only.guard.ts`

**Tipo**: Functional Guard (`CanActivateFn`)

**Lógica**:
```typescript
export const publicOnlyGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;  // Permite acceso
  }

  return router.createUrlTree(['/dashboard']);  // Redirige a dashboard
};
```

**Rutas protegidas**:
- `/auth` (login/registro)
- `/auth/forgot-password`
- `/auth/reset-password`
- `/auth/2fa`

### 4. Auth Interceptor

**Ubicación**: `src/app/core/interceptors/auth.interceptor.ts`

**Tipo**: Functional Interceptor (`HttpInterceptorFn`)

**Lógica**:
```typescript
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const accessToken = authService.getAccessToken();

  if (!accessToken) {
    return next(request);  // Sin token, continúa sin modificar
  }

  // Clona la request y agrega el header Authorization
  const authorizedRequest = request.clone({
    setHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return next(authorizedRequest);
};
```

**Características**:
- Agrega automáticamente el token JWT a todas las peticiones HTTP
- Solo agrega el header si existe un token
- Logging de errores HTTP para debugging

**Registro**:
```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

## Flujos de Seguridad

### Flujo de Login

```
1. Usuario ingresa credenciales
   ↓
2. Validación de frontend (email, password)
   ↓
3. POST /auth/login (sin token)
   ↓
4. Backend valida credenciales
   ↓
5. Backend responde con tokens o challenge 2FA
   ↓
6. Frontend guarda tokens en localStorage
   ↓
7. AuthService actualiza signals
   ↓
8. Router redirige a /dashboard
   ↓
9. Auth Guard permite acceso
```

### Flujo de Petición Autenticada

```
1. Componente hace petición HTTP
   ↓
2. Auth Interceptor intercepta la petición
   ↓
3. Obtiene token de AuthService
   ↓
4. Clona request y agrega header Authorization
   ↓
5. Envía petición modificada al backend
   ↓
6. Backend valida token JWT
   ↓
7. Backend responde con datos
   ↓
8. Componente recibe respuesta
```

### Flujo de Logout

```
1. Usuario hace clic en "Cerrar sesión"
   ↓
2. AuthService.logout() se ejecuta
   ↓
3. POST /auth/logout (con token)
   ↓
4. Backend revoca el token
   ↓
5. Frontend limpia localStorage
   ↓
6. AuthService resetea signals
   ↓
7. Router redirige a /auth
   ↓
8. Public Only Guard permite acceso
```

### Flujo de Restauración de Sesión

```
1. Usuario recarga la página
   ↓
2. App Component se inicializa
   ↓
3. AuthService.restoreSession() se ejecuta
   ↓
4. Lee token de localStorage
   ↓
5. GET /auth/me (con token)
   ↓
6. Backend valida token y responde con perfil
   ↓
7. AuthService actualiza userSignal
   ↓
8. Usuario permanece autenticado
```

## Almacenamiento de Tokens

### LocalStorage

**Keys utilizadas**:
- `workshop_access_token`: Token JWT de acceso
- `workshop_refresh_token`: Token JWT de refresco
- `auth_login_lockout_until`: Timestamp de bloqueo de cuenta

**Ventajas**:
- Persistencia entre sesiones
- Fácil acceso desde cualquier parte de la app
- No expira al cerrar el navegador

**Consideraciones de seguridad**:
- Vulnerable a XSS (Cross-Site Scripting)
- Mitigación: Sanitización de inputs, CSP headers
- No almacenar datos sensibles adicionales

### Alternativas consideradas

**SessionStorage**:
- ❌ Se pierde al cerrar la pestaña
- ✓ Más seguro que localStorage

**Cookies HttpOnly**:
- ✓ Inmune a XSS
- ❌ Requiere configuración backend adicional
- ❌ Problemas con CORS

**In-Memory Storage**:
- ✓ Más seguro
- ❌ Se pierde al recargar la página
- ❌ Mala UX

## Validaciones de Seguridad

### Validaciones de Frontend

**Propósito**: Mejorar UX, no reemplazar validaciones de backend

**Validaciones implementadas**:

1. **Email**:
   - Formato válido (regex)
   - Campo requerido

2. **Password**:
   - Longitud mínima: 8 caracteres
   - Campo requerido
   - Confirmación en registro

3. **Datos personales**:
   - Longitudes mínimas/máximas
   - Campos requeridos
   - Formatos específicos (teléfono)

4. **Ubicación**:
   - Coordenadas válidas
   - Radio de cobertura en rango

### Validaciones de Backend

**Propósito**: Seguridad autoritativa, prevención de ataques

**Validaciones implementadas** (referencia):
- Formato y unicidad de email
- Complejidad de contraseña
- Rate limiting de intentos de login
- Validación de tokens JWT
- Sanitización de inputs
- Prevención de SQL injection

## Protección contra Ataques

### 1. Cross-Site Scripting (XSS)

**Mitigaciones**:
- Angular sanitiza automáticamente templates
- No usar `innerHTML` con datos no confiables
- CSP headers en el backend
- Validación de inputs

### 2. Cross-Site Request Forgery (CSRF)

**Mitigaciones**:
- Tokens JWT en headers (no en cookies)
- SameSite cookie attribute (si se usan cookies)
- Validación de origen en backend

### 3. Brute Force

**Mitigaciones**:
- Rate limiting en backend
- Bloqueo temporal de cuenta (frontend + backend)
- Captcha después de múltiples intentos (futuro)

### 4. Token Theft

**Mitigaciones**:
- Tokens con expiración corta
- Refresh tokens para renovación
- Revocación de tokens en logout
- HTTPS obligatorio en producción

### 5. Man-in-the-Middle (MITM)

**Mitigaciones**:
- HTTPS obligatorio
- HSTS headers
- Certificate pinning (móvil)

## Mejores Prácticas Implementadas

### 1. Principio de Menor Privilegio

- Guards específicos para cada tipo de ruta
- Validación de permisos en backend
- Tokens con claims específicos

### 2. Defensa en Profundidad

- Múltiples capas de seguridad
- Validaciones frontend + backend
- Guards + interceptores + validaciones

### 3. Fail Secure

- En caso de error, denegar acceso
- Logout automático en errores de autenticación
- Limpieza de sesión en errores

### 4. Separación de Responsabilidades

- AuthService: Gestión de estado
- Guards: Control de acceso
- Interceptor: Gestión de tokens
- Componentes: UI y validaciones

### 5. Código Limpio y Mantenible

- Functional guards (Angular moderno)
- Signals para reactividad
- Inyección de dependencias
- Código testeable

## Configuración de Producción

### Variables de Entorno

```typescript
// environments/environment.prod.ts
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.tudominio.com',
  enableDebugLogs: false,
};
```

### Checklist de Seguridad

- [ ] HTTPS habilitado
- [ ] CSP headers configurados
- [ ] CORS configurado correctamente
- [ ] Tokens con expiración apropiada
- [ ] Rate limiting activo
- [ ] Logging de eventos de seguridad
- [ ] Monitoreo de intentos de acceso
- [ ] Backup de datos
- [ ] Plan de respuesta a incidentes

## Monitoreo y Auditoría

### Eventos a Monitorear

1. **Intentos de login fallidos**
   - Múltiples intentos desde misma IP
   - Intentos con emails no existentes
   - Patrones de ataque automatizado

2. **Accesos exitosos**
   - Login desde ubicaciones inusuales
   - Login en horarios inusuales
   - Múltiples sesiones simultáneas

3. **Operaciones sensibles**
   - Cambios de contraseña
   - Habilitación/deshabilitación de 2FA
   - Eliminación de cuenta
   - Revocación de sesiones

### Logging

```typescript
// Ejemplo de logging en interceptor
tap({
  error: (error) => {
    if (error instanceof HttpErrorResponse) {
      console.log('🔴 HTTP Error:', {
        status: error.status,
        url: error.url,
        timestamp: new Date().toISOString(),
      });
    }
  }
})
```

## Testing de Seguridad

### Tests Unitarios

```typescript
describe('AuthGuard', () => {
  it('should redirect to /auth when not authenticated', () => {
    // Test implementation
  });

  it('should allow access when authenticated', () => {
    // Test implementation
  });
});
```

### Tests E2E

```typescript
describe('Authentication Flow', () => {
  it('should prevent access to protected routes', () => {
    cy.visit('/dashboard');
    cy.url().should('include', '/auth');
  });

  it('should allow access after login', () => {
    cy.login('user@example.com', 'password123');
    cy.visit('/dashboard');
    cy.url().should('include', '/dashboard');
  });
});
```

### Penetration Testing

- Intentos de bypass de guards
- Manipulación de tokens
- Inyección de código
- Fuzzing de inputs

## Roadmap de Seguridad

### Corto Plazo

- [ ] Implementar refresh token automático
- [ ] Agregar logging más detallado
- [ ] Tests de seguridad automatizados

### Mediano Plazo

- [ ] Implementar Captcha
- [ ] Agregar fingerprinting de dispositivos
- [ ] Notificaciones de login sospechoso

### Largo Plazo

- [ ] Implementar WebAuthn/FIDO2
- [ ] Biometría en móvil
- [ ] Análisis de comportamiento con ML

## Recursos Adicionales

### Documentación

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Angular Security Guide](https://angular.io/guide/security)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

### Herramientas

- OWASP ZAP (penetration testing)
- Burp Suite (security testing)
- SonarQube (code analysis)
- npm audit (dependency vulnerabilities)

## Conclusión

La arquitectura de seguridad implementada proporciona múltiples capas de protección:

1. **Guards** previenen acceso no autorizado a rutas
2. **Interceptores** gestionan automáticamente la autenticación
3. **Validaciones** previenen datos inválidos
4. **Tokens JWT** proporcionan autenticación stateless
5. **Bloqueo de cuenta** previene brute force

Esta arquitectura sigue las mejores prácticas de la industria y proporciona una base sólida para una aplicación segura en producción.
