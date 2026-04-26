# 🚀 Vercel Quick Start - Guía Rápida

## ⚡ Pasos Rápidos para Desplegar

### 1️⃣ Actualizar Variables de Entorno

Abre `.env.production` y actualiza:

```env
# Cambia esto por la URL real de tu backend en Railway
NG_APP_API_BASE_URL=https://tu-backend-real.railway.app/api/v1
```

### 2️⃣ Subir a GitHub

```bash
git add .
git commit -m "feat: prepare frontend for Vercel deployment"
git push origin main
```

### 3️⃣ Importar en Vercel

1. Ve a [Vercel](https://vercel.com/)
2. Click en "Add New..." > "Project"
3. Importa tu repositorio de GitHub
4. Vercel detectará Angular automáticamente

### 4️⃣ Configurar Variables de Entorno

En Vercel > Settings > Environment Variables, agrega:

**Opción A: Copiar una por una**

```env
NG_APP_API_BASE_URL=https://tu-backend.railway.app/api/v1
NG_APP_FIREBASE_API_KEY=AIzaSyArXp5QM9rMvyHFeGGlcQXnswACa3kEcQw
NG_APP_FIREBASE_AUTH_DOMAIN=mecanicoya-a6b5c.firebaseapp.com
NG_APP_FIREBASE_PROJECT_ID=mecanicoya-a6b5c
NG_APP_FIREBASE_STORAGE_BUCKET=mecanicoya-a6b5c.firebasestorage.app
NG_APP_FIREBASE_MESSAGING_SENDER_ID=953573857812
NG_APP_FIREBASE_APP_ID=1:953573857812:web:f317243430da38e839e501
NG_APP_FIREBASE_MEASUREMENT_ID=G-ZRVWX1T5HY
NG_APP_FIREBASE_VAPID_KEY=BCmIchV8ZGAXni86XQC84IXomvcdcUASOxPLtnHDQ1BDxFcD-qIYiXP3MwKGpjJW2rtNisJPqnTOMs6ZmRnjVJY
```

**Opción B: Importar desde archivo**

Vercel permite importar variables desde un archivo `.env`:
1. Copia el contenido de `.env.production`
2. En Vercel, usa la opción "Paste .env"
3. Pega el contenido

### 5️⃣ Desplegar

Click en "Deploy" y espera 2-5 minutos.

### 6️⃣ Configurar CORS en Backend

En Railway (backend), actualiza:

```env
CORS_ORIGINS=https://tu-app.vercel.app,https://tu-dominio.com
```

### 7️⃣ Verificar

Visita: `https://tu-app.vercel.app`

## 🔍 Troubleshooting Rápido

### Error: "Failed to fetch"
**Solución:** Verifica `NG_APP_API_BASE_URL` y CORS en el backend

### Error: Firebase
**Solución:** Verifica todas las variables `NG_APP_FIREBASE_*`

### Error: 404 en rutas
**Solución:** Verifica que `vercel.json` exista

## 📋 Checklist Final

- [ ] Actualicé `NG_APP_API_BASE_URL` con mi backend real
- [ ] Configuré todas las variables en Vercel
- [ ] Configuré CORS en el backend
- [ ] El deployment fue exitoso
- [ ] La app carga correctamente

## 📚 Documentación Completa

Para más detalles, consulta: [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md)

¡Listo! 🎉
