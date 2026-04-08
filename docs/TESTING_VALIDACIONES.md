# Guía de Testing - Validaciones y Guards

## Cómo Probar las Validaciones de Frontend

### Preparación

1. Asegúrate de que el backend esté corriendo:
```bash
cd 1P-SI2-backend
uvicorn app.main:app --reload
```

2. Inicia el servidor de desarrollo de Angular:
```bash
cd 1P-SI2-frontend
ng serve
```

3. Abre el navegador en `http://localhost:4200`

## Pruebas de Guards de Rutas

### Test 1: Auth Guard - Acceso sin autenticación

**Objetivo**: Verificar que usuarios no autenticados no puedan acceder a rutas protegidas.

**Pasos**:
1. Asegúrate de no tener sesión activa (cierra sesión si es necesario)
2. Intenta acceder directamente a `http://localhost:4200/dashboard`
3. **Resultado esperado**: Deberías ser redirigido a `/auth`

### Test 2: Auth Guard - Acceso con autenticación

**Objetivo**: Verificar que usuarios autenticados puedan acceder a rutas protegidas.

**Pasos**:
1. Inicia sesión con credenciales válidas
2. Navega a `http://localhost:4200/dashboard`
3. **Resultado esperado**: Deberías ver el dashboard sin redirección

### Test 3: Public Only Guard - Usuario autenticado

**Objetivo**: Verificar que usuarios autenticados no puedan acceder a páginas de login.

**Pasos**:
1. Inicia sesión con credenciales válidas
2. Intenta acceder a `http://localhost:4200/auth`
3. **Resultado esperado**: Deberías ser redirigido a `/dashboard`

### Test 4: Public Only Guard - Usuario no autenticado

**Objetivo**: Verificar que usuarios no autenticados puedan acceder a páginas públicas.

**Pasos**:
1. Asegúrate de no tener sesión activa
2. Navega a `http://localhost:4200/auth`
3. **Resultado esperado**: Deberías ver la página de login/registro

## Pruebas de Validaciones de Login

### Test 5: Email requerido

**Pasos**:
1. Ve a la página de login
2. Deja el campo de email vacío
3. Haz clic en el campo de password (para activar el touch)
4. Vuelve a hacer clic en el campo de email
5. **Resultado esperado**: Mensaje "Ingresa un correo electrónico válido."

### Test 6: Email con formato inválido

**Pasos**:
1. Ingresa un email sin formato válido (ej: "usuario@")
2. Haz clic fuera del campo
3. **Resultado esperado**: Mensaje "Ingresa un correo electrónico válido."

### Test 7: Password mínimo 8 caracteres

**Pasos**:
1. Ingresa una contraseña de menos de 8 caracteres (ej: "1234567")
2. Haz clic fuera del campo
3. **Resultado esperado**: Mensaje "La contraseña debe tener al menos 8 caracteres."

### Test 8: Login con credenciales inválidas

**Pasos**:
1. Ingresa un email válido pero credenciales incorrectas
2. Haz clic en "Ingresar"
3. **Resultado esperado**: Banner de error con mensaje del backend

### Test 9: Bloqueo de cuenta

**Pasos**:
1. Intenta iniciar sesión con credenciales incorrectas 5 veces consecutivas
2. **Resultado esperado**: 
   - Banner amarillo indicando bloqueo temporal
   - Contador de tiempo en formato MM:SS
   - Botón "Ingresar" deshabilitado
   - Estado persistente (recarga la página y el bloqueo debe seguir activo)

### Test 10: Login exitoso

**Pasos**:
1. Ingresa credenciales válidas
2. Haz clic en "Ingresar"
3. **Resultado esperado**: 
   - Botón muestra "Verificando..." con spinner
   - Redirección a `/dashboard`
   - Token guardado en localStorage

## Pruebas de Validaciones de Registro

### Test 11: Campos requeridos

**Pasos**:
1. Ve a la pestaña "Crear cuenta"
2. Intenta enviar el formulario sin llenar ningún campo
3. Haz clic en cada campo y luego fuera de él
4. **Resultado esperado**: Mensajes de error bajo cada campo requerido

### Test 12: Validación de nombre y apellido

**Pasos**:
1. Ingresa solo 1 carácter en "Nombre"
2. Haz clic fuera del campo
3. **Resultado esperado**: "Obligatorio, mínimo 2 caracteres."
4. Repite con "Apellido"

### Test 13: Validación de teléfono

**Pasos**:
1. Ingresa menos de 7 caracteres en "Teléfono"
2. Haz clic fuera del campo
3. **Resultado esperado**: "Obligatorio, entre 7 y 20 caracteres."

### Test 14: Validación de email en registro

**Pasos**:
1. Ingresa un email sin formato válido
2. Haz clic fuera del campo
3. **Resultado esperado**: "Formato incorrecto."

### Test 15: Validación de contraseñas no coinciden

**Pasos**:
1. Ingresa "password123" en el campo "Contraseña"
2. Ingresa "password456" en "Confirmar contraseña"
3. Haz clic en "Crear cuenta"
4. **Resultado esperado**: Banner de error "Las contraseñas no coinciden"

### Test 16: Validación de contraseñas coinciden

**Pasos**:
1. Ingresa "password123" en ambos campos de contraseña
2. Completa el resto del formulario
3. **Resultado esperado**: No debe haber error de coincidencia

### Test 17: Validación de radio de cobertura

**Pasos**:
1. Ingresa "0" en "Radio de cobertura"
2. Haz clic fuera del campo
3. **Resultado esperado**: "Debe estar entre 1 y 100 km."
4. Prueba con "101"
5. **Resultado esperado**: Mismo mensaje de error

### Test 18: Validación de ubicación en mapa

**Pasos**:
1. No selecciones ninguna ubicación en el mapa
2. Intenta enviar el formulario
3. **Resultado esperado**: "Debes seleccionar la ubicación del taller en el mapa."

### Test 19: Selección de ubicación en mapa

**Pasos**:
1. Haz clic en cualquier punto del mapa
2. **Resultado esperado**: 
   - Marcador se mueve a esa posición
   - Campos `latitude` y `longitude` se actualizan
   - Campo `address` se llena automáticamente (si hay geocodificación)

### Test 20: Detección de ubicación actual

**Pasos**:
1. Haz clic en "Centrar en mi ubicación" (si existe el botón)
2. Acepta el permiso de ubicación del navegador
3. **Resultado esperado**: 
   - Mapa se centra en tu ubicación actual
   - Marcador se coloca en tu posición
   - Mensaje informativo: "Ubicación actual detectada correctamente"

### Test 21: Registro exitoso

**Pasos**:
1. Completa todos los campos correctamente
2. Selecciona una ubicación en el mapa
3. Haz clic en "Crear cuenta"
4. **Resultado esperado**: 
   - Botón muestra "Configurando cuenta..." con spinner
   - Redirección a `/dashboard`
   - Sesión iniciada automáticamente

## Pruebas de Componentes UI

### Test 22: Password Input - Toggle de visibilidad

**Pasos**:
1. Ingresa una contraseña en cualquier campo de password
2. Haz clic en el icono de ojo
3. **Resultado esperado**: La contraseña se muestra en texto plano
4. Haz clic nuevamente
5. **Resultado esperado**: La contraseña vuelve a estar oculta

### Test 23: Password Input - Estado de error

**Pasos**:
1. Ingresa una contraseña de menos de 8 caracteres
2. Haz clic fuera del campo
3. **Resultado esperado**: 
   - Borde del input cambia a color de error (rojo)
   - Mensaje de error visible debajo

## Pruebas de Flujo Completo

### Test 24: Flujo de Login con 2FA

**Requisito**: Cuenta con 2FA habilitado

**Pasos**:
1. Inicia sesión con credenciales de cuenta con 2FA
2. **Resultado esperado**: 
   - Banner azul informativo: "Se requiere verificación 2FA..."
   - Redirección a `/auth/2fa`
3. Ingresa el código OTP correcto
4. **Resultado esperado**: Redirección a `/dashboard`

### Test 25: Flujo de Recuperación de Contraseña

**Pasos**:
1. En la página de login, haz clic en "¿Olvidaste tu contraseña?"
2. **Resultado esperado**: Redirección a `/auth/forgot-password`
3. Ingresa un email válido
4. Haz clic en "Enviar enlace"
5. **Resultado esperado**: Mensaje de confirmación

### Test 26: Persistencia de Sesión

**Pasos**:
1. Inicia sesión correctamente
2. Recarga la página (F5)
3. **Resultado esperado**: 
   - Sesión se mantiene activa
   - Usuario sigue en `/dashboard`
   - No hay redirección a `/auth`

### Test 27: Cierre de Sesión

**Pasos**:
1. Estando autenticado, cierra sesión
2. **Resultado esperado**: 
   - Redirección a `/auth`
   - Token removido de localStorage
   - Intento de acceder a `/dashboard` redirige a `/auth`

## Pruebas de Accesibilidad

### Test 28: Navegación por teclado

**Pasos**:
1. Usa la tecla Tab para navegar por el formulario
2. **Resultado esperado**: 
   - Todos los campos son accesibles
   - Orden lógico de navegación
   - Indicador visual de foco

### Test 29: Lectores de pantalla

**Pasos**:
1. Activa un lector de pantalla (NVDA, JAWS, VoiceOver)
2. Navega por el formulario
3. **Resultado esperado**: 
   - Labels correctamente asociados
   - Mensajes de error anunciados
   - Roles ARIA apropiados

## Pruebas de Rendimiento

### Test 30: Tiempo de respuesta de validaciones

**Pasos**:
1. Ingresa datos en un campo
2. Haz clic fuera del campo
3. **Resultado esperado**: 
   - Validación instantánea (< 100ms)
   - Sin lag perceptible

### Test 31: Carga de página

**Pasos**:
1. Abre las DevTools (F12)
2. Ve a la pestaña Network
3. Recarga la página
4. **Resultado esperado**: 
   - Página carga en < 2 segundos
   - Recursos optimizados

## Checklist de Validaciones

### Login
- [ ] Email requerido
- [ ] Email formato válido
- [ ] Password requerido
- [ ] Password mínimo 8 caracteres
- [ ] Errores solo después de touch
- [ ] Submit deshabilitado durante carga
- [ ] Bloqueo de cuenta funcional
- [ ] Contador de bloqueo visible
- [ ] Persistencia de bloqueo
- [ ] Manejo de respuesta 2FA

### Registro
- [ ] Todos los campos requeridos validados
- [ ] Longitudes mínimas/máximas respetadas
- [ ] Email formato válido
- [ ] Contraseñas coinciden
- [ ] Ubicación seleccionada
- [ ] Radio de cobertura en rango
- [ ] Submit deshabilitado durante carga
- [ ] Registro exitoso inicia sesión

### Guards
- [ ] Auth guard bloquea acceso sin token
- [ ] Auth guard permite acceso con token
- [ ] Public only guard redirige autenticados
- [ ] Public only guard permite no autenticados

### UI Components
- [ ] Password toggle funciona
- [ ] Location picker funciona
- [ ] Mensajes de error visibles
- [ ] Estados de carga visibles
- [ ] Accesibilidad completa

## Herramientas de Testing

### Testing Manual
- Chrome DevTools
- Firefox Developer Tools
- Lighthouse (auditoría de accesibilidad)

### Testing Automatizado (futuro)
```bash
# Unit tests
ng test

# E2E tests
ng e2e
```

### Validación de Accesibilidad
- axe DevTools
- WAVE Browser Extension
- Lectores de pantalla (NVDA, JAWS, VoiceOver)

## Reportar Problemas

Si encuentras algún problema durante las pruebas:

1. Anota el número de test
2. Describe el comportamiento esperado vs. el actual
3. Incluye capturas de pantalla si es posible
4. Verifica la consola del navegador para errores
5. Revisa la pestaña Network para errores de API

## Conclusión

Esta guía cubre todos los aspectos de las validaciones de frontend y guards de rutas. Ejecuta estos tests regularmente para asegurar que las validaciones funcionen correctamente y proporcionen una buena experiencia de usuario.
