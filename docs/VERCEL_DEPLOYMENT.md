# 🚀 Guía de Despliegue en Vercel

Esta guía te ayudará a desplegar el frontend de MecánicoYa en Vercel.

## 📋 Pre-requisitos

- Cuenta en [Vercel](https://vercel.com/)
- Backend desplegado en Railway (o cualquier servidor)
- Credenciales de Firebase (para push notifications)
- Repositorio en GitHub

## 🚀 Pasos de Despliegue

### 1. Preparar el Repositorio

Asegúrate de que tu código esté en GitHub:

```bash
git add .
git commit -m "feat: prepare frontend for Vercel deployment"
git push origin main
```

### 2. Crear Proyecto en Vercel

1. Ve a [Vercel](https://vercel.com/) e inicia sesión
2. Click en "Add New..." > "Project"
3. Importa tu repositorio de GitHub
4. Selecciona el repositorio `1P-SI2-frontend`

### 3. Configurar el Proyecto

Vercel detectará automáticamente que es un proyecto Angular.

**Framework Preset:** Angular  
**Build Command:** `npm run build`  
**Output Directory:** `dist/frontend/browser`  
**Install Command:** `npm install`

### 4. Configurar Variables de Entorno

Ve a **Settings > Environment Variables** y agrega las siguientes variables:

#### 🌐 API Configuration

```env
NG_APP_API_BASE_URL=https://tu-backend.railway.app/api/v1
```

**⚠️ IMPORTANTE:** Reemplaza `tu-backend.railway.app` con la URL real de tu backend en Railway.

#### 🔔 Firebase Configuration

```env
NG_APP_FIREBASE_API_KEY=AIzaSyArXp5QM9rMvyHFeGGlcQXnswACa3kEcQw
NG_APP_FIREBASE_AUTH_DOMAIN=mecanicoya-a6b5c.firebaseapp.com
NG_APP_FIREBASE_PROJECT_ID=mecanicoya-a6b5c
NG_APP_FIREBASE_STORAGE_BUCKET=mecanicoya-a6b5c.firebasestorage.app
NG_APP_FIREBASE_MESSAGING_SENDER_ID=953573857812
NG_APP_FIREBASE_APP_ID=1:953573857812:web:f317243430da38e839e501
NG_APP_FIREBASE_MEASUREMENT_ID=G-ZRVWX1T5HY
NG_APP_FIREBASE_VAPID_KEY=BCmIchV8ZGAXni86XQC84IXomvcdcUASOxPLtnHDQ1BDxFcD-qIYiXP3MwKGpjJW2rtNisJPqnTOMs6ZmRnjVJY
```

**Nota:** Estas credenciales de Firebase son públicas (frontend) y son diferentes a las del backend.

#### 📝 Configuración de Environment

Para cada variable:
1. Click en "Add New"
2. Nombre: `NG_APP_API_BASE_URL` (por ejemplo)
3. Valor: `https://tu-backend.railway.app/api/v1`
4. Environment: Selecciona **"Production"**
5. Click en "Save"

### 5. Desplegar

1. Click en "Deploy"
2. Vercel construirá y desplegará automáticamente
3. Espera a que termine el despliegue (2-5 minutos)
4. Una vez completado, Vercel te dará una URL pública

### 6. Configurar Dominio Personalizado (Opcional)

1. Ve a **Settings > Domains**
2. Agrega tu dominio personalizado
3. Sigue las instrucciones para configurar DNS

## ✅ Verificar Despliegue

### 1. Verificar que la App Carga

Visita: `https://tu-app.vercel.app`

Deberías ver la página de login de MecánicoYa.

### 2. Verificar Conexión con Backend

1. Intenta hacer login
2. Abre las DevTools (F12) > Network
3. Verifica que las peticiones vayan a tu backend en Railway
4. Deberías ver peticiones a `https://tu-backend.railway.app/api/v1/...`

### 3. Verificar Firebase

1. Abre las DevTools (F12) > Console
2. No deberías ver errores de Firebase
3. Si hay errores, verifica las credenciales de Firebase

## 🔧 Configuración Avanzada

### Configurar CORS en el Backend

Asegúrate de que tu backend en Railway tenga configurado CORS para permitir peticiones desde Vercel:

```env
# En Railway (backend)
CORS_ORIGINS=https://tu-app.vercel.app,https://tu-dominio.com
```

### Configurar Redirects

El archivo `vercel.json` ya está configurado para manejar las rutas de Angular:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Configurar Headers de Seguridad

Puedes agregar headers de seguridad en `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

## 🔄 Actualizaciones Automáticas

Vercel despliega automáticamente cuando:
1. Haces push a la rama principal de GitHub
2. Cambias variables de entorno (requiere redeploy manual)

Para redeploy manual:
1. Ve a Deployments
2. Click en los tres puntos del último deployment
3. Click en "Redeploy"

## 🐛 Troubleshooting

### Error: "Failed to fetch"

**Causa:** El frontend no puede conectarse al backend.

**Solución:**
1. Verifica que `NG_APP_API_BASE_URL` sea correcta
2. Verifica que el backend esté corriendo en Railway
3. Verifica que CORS esté configurado en el backend

### Error: "Firebase: Error (auth/invalid-api-key)"

**Causa:** Credenciales de Firebase incorrectas.

**Solución:**
1. Verifica que todas las variables `NG_APP_FIREBASE_*` sean correctas
2. Verifica en Firebase Console > Project Settings > General

### Error: "404 Not Found" en rutas

**Causa:** Vercel no está redirigiendo correctamente.

**Solución:**
1. Verifica que `vercel.json` exista y tenga la configuración de rewrites
2. Redeploy el proyecto

### Build falla con "Module not found"

**Causa:** Dependencias no instaladas correctamente.

**Solución:**
1. Verifica que `package.json` esté completo
2. Intenta limpiar cache: Settings > General > Clear Cache

## 📊 Monitoreo

### Logs

Ver logs en tiempo real:
1. Ve a tu proyecto en Vercel
2. Click en "Deployments"
3. Selecciona el deployment activo
4. Click en "View Function Logs"

### Analytics

Vercel proporciona analytics automáticos:
- Page views
- Unique visitors
- Top pages
- Performance metrics

Activa en: Settings > Analytics

## 💰 Costos

Vercel ofrece:
- **Plan Hobby:** Gratis (para proyectos personales)
- **Plan Pro:** $20/mes (para equipos)

El plan gratuito incluye:
- 100 GB bandwidth
- Despliegues ilimitados
- HTTPS automático
- Dominio personalizado

## 🔒 Seguridad

### Checklist de Seguridad

- [ ] `NG_APP_API_BASE_URL` apunta al backend correcto (HTTPS)
- [ ] CORS configurado en el backend
- [ ] Variables de entorno configuradas en Vercel (no en código)
- [ ] `.env` y `.env.production` están en `.gitignore`
- [ ] HTTPS habilitado (automático en Vercel)
- [ ] Headers de seguridad configurados

### Variables de Entorno Públicas

**Nota:** Las variables `NG_APP_*` son públicas y se incluyen en el bundle del frontend. NO pongas secretos aquí.

- ✅ API URLs
- ✅ Firebase config (público)
- ❌ API keys secretas
- ❌ Tokens de autenticación

## 📚 Recursos

- [Vercel Docs](https://vercel.com/docs)
- [Angular Deployment](https://angular.dev/tools/cli/deployment)
- [Firebase Web Setup](https://firebase.google.com/docs/web/setup)

## 🆘 Soporte

Si tienes problemas:
1. Revisa los logs en Vercel
2. Verifica las variables de entorno
3. Consulta la documentación de Vercel
4. Revisa el README.md del proyecto

## ✅ Checklist Final

Antes de desplegar:

- [ ] Backend está desplegado en Railway
- [ ] Tengo la URL del backend
- [ ] Configuré todas las variables de entorno en Vercel
- [ ] Actualicé `NG_APP_API_BASE_URL` con la URL real
- [ ] Configuré CORS en el backend con la URL de Vercel
- [ ] El código está en GitHub
- [ ] Probé el build localmente: `npm run build`

¡Listo para producción! 🎉
