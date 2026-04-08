# Seguridad y Validaciones - Frontend Angular

## Resumen Ejecutivo

El frontend de Angular implementa un sistema completo de seguridad y validaciones que incluye:

✅ **Guards de rutas** para control de acceso  
✅ **Interceptor HTTP** para gestión automática de tokens JWT  
✅ **Validaciones de formularios** con feedback en tiempo real  
✅ **Bloqueo temporal de cuenta** tras intentos fallidos  
✅ **Persistencia de sesión** entre recargas de página  
✅ **Manejo robusto de errores** del backend  

## Estado de Implementación

### ✅ Completamente Implementado

#### Guards de Rutas

- **Auth Guard** (`auth.guard.ts`): Protege rutas privadas
  - Redirige a `/auth` si no hay sesión activa
  - Permite acceso a `/dashboard` con token válido

- **Public Only Guard** (`public-only.guard.ts`): Protege rutas públicas
  - Redirige a `/dashboard` si ya hay sesión activa
  - Previene acceso a login/registro con sesión activa

#### Interceptor HTTP

- **Auth Interceptor** (`auth.interceptor.ts`): Gestión automática de tokens
  - Agrega header `Authorization: Bearer <token>` a todas las peticiones
  - Solo agrega el header si existe un token
  - Logging de errores HTTP para debugging

#### Servicio de Autenticación

- **Auth Service** (`auth.service.ts`): Gestión completa de autenticación
  - Login con email/password
  - Registro de talleres
  - Logout con revocación de token
  - Restauración de sesión al cargar la app
  - Gestión de 2FA
  - Recuperación de contraseña
  - Estado reactivo con Angular Signals

#### Validaciones de Formularios

**Login:**
- Email: requerido, formato válido
- Password: requerido, mínimo 8 caracteres
- Bloqueo temporal tras 5 intentos fallidos
- Contador visual de tiempo de bloqueo

**Registro de Taller:**
- Nombre y apellido: requeridos, mínimo 2 caracteres
- Teléfono: requerido, 7-20 caracteres
- Email: requerido, formato válido
- Nombre del taller: requerido, mínimo 3 caracteres
- Nombre del propietario: requerido, mínimo 3 caracteres
- Password: requerido, mínimo 8 caracteres
- Confirmación de password: debe coincidir
- Ubicación: coordenadas requeridas (mapa interactivo)
- Radio de cobertura: 1-100 km

#### Componentes UI

- **Password Input**: Campo de contraseña con toggle de visibilidad
- **Location Picker**: Selector de ubicación con mapa interactivo

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    App Component                         │
│              (Restaura sesión al iniciar)                │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────┐         ┌──────────────┐
│  Auth Guard   │         │ Public Only  │
│               │         │    Guard     │
└───────┬───────┘         └──────┬───────┘
        │                        │
        ▼                        ▼
┌───────────────────────────────────────┐
│         Auth Service                  │
│  (Gestión de tokens y estado)         │
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│      Auth Interceptor                 │
│  (Agrega token a peticiones HTTP)     │
└───────────────────────────────────────┘
```

## Flujo de Autenticación

### 1. Usuario No Autenticado

```
Usuario → /dashboard → Auth Guard → ❌ → Redirige a /auth
```

### 2. Login Exitoso

```
Usuario → Ingresa credenciales → Validación frontend → 
POST /auth/login → Backend valida → Tokens guardados → 
Redirige a /dashboard → Auth Guard → ✅ → Acceso permitido
```

### 3. Sesión Persistente

```
Usuario recarga página → App Component → restoreSession() → 
GET /auth/me → Backend valida token → Usuario restaurado → 
Sesión activa
```

### 4. Logout

```
Usuario → Cerrar sesión → POST /auth/logout → 
Tokens revocados → localStorage limpiado → 
Redirige a /auth
```

## Documentación Disponible

### 📄 VALIDACIONES_FRONTEND.md
Documentación completa de todas las validaciones implementadas:
- Guards de rutas (auth.guard, public-only.guard)
- Validaciones de formularios (login, registro)
- Componentes UI reutilizables
- Manejo de errores
- Sistema de bloqueo de cuenta

### 📄 TESTING_VALIDACIONES.md
Guía completa de testing con 31 casos de prueba:
- Pruebas de guards de rutas
- Pruebas de validaciones de login
- Pruebas de validaciones de registro
- Pruebas de componentes UI
- Pruebas de flujos completos
- Pruebas de accesibilidad
- Checklist de validaciones

### 📄 ARQUITECTURA_SEGURIDAD.md
Documentación técnica de la arquitectura de seguridad:
- Componentes de seguridad
- Flujos de seguridad detallados
- Almacenamiento de tokens
- Protección contra ataques
- Mejores prácticas
- Configuración de producción
- Monitoreo y auditoría

## Cómo Probar

### Inicio Rápido

1. **Inicia el backend:**
```bash
cd 1P-SI2-backend
uvicorn app.main:app --reload
```

2. **Inicia el frontend:**
```bash
cd 1P-SI2-frontend
ng serve
```

3. **Abre el navegador:**
```
http://localhost:4200
```

### Pruebas Básicas

**Test 1: Guard de autenticación**
- Intenta acceder a `http://localhost:4200/dashboard` sin sesión
- Deberías ser redirigido a `/auth`

**Test 2: Validaciones de login**
- Intenta enviar el formulario vacío
- Deberías ver mensajes de error en cada campo

**Test 3: Login exitoso**
- Ingresa credenciales válidas
- Deberías ser redirigido a `/dashboard`

**Test 4: Persistencia de sesión**
- Estando autenticado, recarga la página (F5)
- Deberías permanecer autenticado

**Test 5: Bloqueo de cuenta**
- Intenta iniciar sesión con credenciales incorrectas 5 veces
- Deberías ver un contador de bloqueo temporal

## Seguridad en Producción

### Checklist

- [ ] HTTPS habilitado
- [ ] Variables de entorno configuradas
- [ ] CSP headers en backend
- [ ] CORS configurado correctamente
- [ ] Rate limiting activo
- [ ] Logging de eventos de seguridad
- [ ] Monitoreo de intentos de acceso
- [ ] Tokens con expiración apropiada

### Variables de Entorno

```typescript
// environments/environment.prod.ts
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.tudominio.com',
};
```

## Características de Seguridad

### 1. Autenticación JWT

- Tokens almacenados en localStorage
- Access token y refresh token
- Expiración automática
- Revocación en logout

### 2. Guards de Rutas

- Control de acceso a nivel de navegación
- Redirección automática según estado de autenticación
- Prevención de acceso no autorizado

### 3. Interceptor HTTP

- Gestión automática de tokens
- Header Authorization en todas las peticiones
- Logging de errores

### 4. Validaciones de Frontend

- Feedback inmediato al usuario
- Prevención de envío de datos inválidos
- Mensajes de error claros y específicos

### 5. Bloqueo de Cuenta

- Protección contra brute force
- Bloqueo temporal tras intentos fallidos
- Contador visual de tiempo restante
- Persistencia entre recargas

### 6. Manejo de Errores

- Extracción robusta de mensajes del backend
- Manejo de múltiples formatos de error
- Alertas visuales con roles ARIA

### 7. Persistencia de Sesión

- Restauración automática al cargar la app
- Validación de token con el backend
- Limpieza automática en caso de error

## Mejores Prácticas Implementadas

✅ **Functional Guards**: Uso de `CanActivateFn` (Angular moderno)  
✅ **Signals**: Reactividad con Angular Signals  
✅ **Standalone Components**: Arquitectura modular  
✅ **Inyección de Dependencias**: Código testeable  
✅ **Separación de Responsabilidades**: Cada componente tiene un propósito claro  
✅ **Validación Progresiva**: Errores solo después de touch  
✅ **Accesibilidad**: Roles ARIA, labels, navegación por teclado  
✅ **Feedback Visual**: Estados de carga, spinners, mensajes claros  

## Limitaciones Conocidas

### Frontend

- Las validaciones de frontend son para UX, no para seguridad
- El backend siempre debe validar todos los datos
- Los tokens en localStorage son vulnerables a XSS

### Mitigaciones

- Angular sanitiza automáticamente los templates
- Validaciones autoritativas en el backend
- CSP headers para prevenir XSS
- HTTPS obligatorio en producción

## Próximos Pasos

### Mejoras Sugeridas

1. **Refresh Token Automático**
   - Renovar access token antes de que expire
   - Mejorar UX sin interrupciones

2. **Captcha**
   - Agregar después de múltiples intentos fallidos
   - Prevenir ataques automatizados

3. **Notificaciones de Seguridad**
   - Email al detectar login sospechoso
   - Notificación de cambios de contraseña

4. **Tests Automatizados**
   - Unit tests para guards y servicios
   - E2E tests para flujos completos

5. **Monitoreo Avanzado**
   - Dashboard de eventos de seguridad
   - Alertas en tiempo real

## Soporte

### Documentación

- `VALIDACIONES_FRONTEND.md`: Validaciones completas
- `TESTING_VALIDACIONES.md`: Guía de testing
- `ARQUITECTURA_SEGURIDAD.md`: Arquitectura técnica

### Código

- `src/app/core/guards/`: Guards de rutas
- `src/app/core/interceptors/`: Interceptores HTTP
- `src/app/core/services/`: Servicios de autenticación
- `src/app/features/auth/`: Componentes de autenticación

## Conclusión

El sistema de seguridad y validaciones está completamente implementado y funcional. Proporciona:

- **Seguridad**: Múltiples capas de protección
- **UX**: Validaciones inmediatas con feedback claro
- **Robustez**: Manejo completo de errores
- **Mantenibilidad**: Código limpio y bien documentado

El frontend está listo para producción con las configuraciones apropiadas de entorno y seguridad.
