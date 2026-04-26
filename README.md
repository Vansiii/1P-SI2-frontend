# Frontend - MecánicoYa

Aplicación web Angular para la gestión de servicios de asistencia mecánica.

## 🚀 Quick Start

### Desarrollo Local

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Edita .env con tus valores

# Iniciar servidor de desarrollo
npm start
```

La aplicación estará disponible en http://localhost:4200

### Producción (Vercel)

Ver [VERCEL_QUICK_START.md](VERCEL_QUICK_START.md) para despliegue rápido.

## 📋 Pre-requisitos

- Node.js 18+ y npm 10+
- Backend corriendo (local o Railway)
- Credenciales de Firebase (para push notifications)

## 🔧 Instalación

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

Copia el archivo de ejemplo y configura tus valores:

```bash
cp .env.example .env
```

Edita `.env` con tus configuraciones:

```env
# API Configuration
NG_APP_API_BASE_URL=http://localhost:8000/api/v1

# Firebase Configuration
NG_APP_FIREBASE_API_KEY=tu-api-key
NG_APP_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
# ... etc
```

## 🏃 Desarrollo

### Servidor de Desarrollo

```bash
npm start
```

Navega a http://localhost:4200. La aplicación se recargará automáticamente cuando modifiques archivos.

### Servidor con SSL (para testing de PWA)

```bash
npm run start:ssl
```

### Build de Producción

```bash
npm run build
```

Los archivos compilados estarán en `dist/frontend/browser/`

## 🧪 Testing

```bash
# Ejecutar tests unitarios
npm test

# Ejecutar linter
npm run lint

# Auto-fix linter
npm run lint:fix
```

## 📦 Estructura del Proyecto

```
src/
├── app/
│   ├── core/              # Servicios core, guards, interceptors
│   │   ├── guards/        # Route guards
│   │   ├── interceptors/  # HTTP interceptors
│   │   └── services/      # Servicios compartidos
│   ├── features/          # Módulos de funcionalidades
│   │   ├── admin/         # Panel de administración
│   │   ├── auth/          # Autenticación
│   │   ├── client/        # Vista de clientes
│   │   ├── incidents/     # Gestión de incidentes
│   │   ├── technician/    # Vista de técnicos
│   │   └── workshop/      # Vista de talleres
│   ├── shared/            # Componentes y utilidades compartidas
│   ├── app.config.ts      # Configuración de aplicación
│   ├── app.routes.ts      # Definición de rutas
│   └── app.ts             # Componente raíz
├── environments/          # Configuración por entorno
├── main.ts               # Bootstrap de aplicación
└── styles.css            # Estilos globales
```

## 🌐 Despliegue

### Vercel (Recomendado)

1. **Guía Rápida:** [VERCEL_QUICK_START.md](VERCEL_QUICK_START.md)
2. **Guía Completa:** [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md)

**Resumen:**
```bash
# 1. Subir a GitHub
git push origin main

# 2. Importar en Vercel
# 3. Configurar variables de entorno
# 4. Deploy automático
```

### Otras Plataformas

El proyecto puede desplegarse en cualquier plataforma que soporte Angular:
- Netlify
- Firebase Hosting
- AWS Amplify
- GitHub Pages

## 🔐 Variables de Entorno

### Desarrollo Local

Archivo: `.env`

```env
NG_APP_API_BASE_URL=http://localhost:8000/api/v1
NG_APP_FIREBASE_API_KEY=...
# ... etc
```

### Producción (Vercel)

Configurar en: Vercel > Settings > Environment Variables

```env
NG_APP_API_BASE_URL=https://tu-backend.railway.app/api/v1
NG_APP_FIREBASE_API_KEY=...
# ... etc
```

**Nota:** Las variables `NG_APP_*` son públicas y se incluyen en el bundle.

## 🔔 Firebase Push Notifications

El proyecto usa Firebase Cloud Messaging para notificaciones push.

### Configuración

1. Obtén las credenciales de Firebase Console
2. Configura las variables `NG_APP_FIREBASE_*` en `.env`
3. El script `build-env.js` genera automáticamente los archivos necesarios

### Archivos Generados

- `src/environments/environment.ts` - Configuración de environment
- `public/firebase-config.js` - Config para Service Worker

## 📚 Documentación Adicional

- [VERCEL_QUICK_START.md](VERCEL_QUICK_START.md) - Guía rápida de despliegue
- [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md) - Guía completa de Vercel
- [SETUP_PARA_DESARROLLADORES.md](SETUP_PARA_DESARROLLADORES.md) - Setup para nuevos devs
- [Angular Docs](https://angular.dev/) - Documentación oficial de Angular

## 🛠️ Tecnologías

- **Framework:** Angular 21.2
- **Language:** TypeScript 5.9
- **Testing:** Vitest 4.0
- **Build:** Angular CLI con esbuild
- **Styling:** CSS + Tailwind (opcional)
- **Charts:** Chart.js + ng2-charts
- **Maps:** Leaflet
- **Push Notifications:** Firebase Cloud Messaging

## 🤝 Contribuir

### Workflow

1. Crea una rama: `git checkout -b feature/nombre-feature`
2. Haz tus cambios y commits: `git commit -m "feat: descripción"`
3. Push: `git push origin feature/nombre-feature`
4. Crea un Pull Request

### Convenciones

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/)
- **Código:** ESLint + Prettier
- **Componentes:** Standalone components (Angular 21+)

## 🐛 Troubleshooting

### Error: "Cannot find module"
```bash
rm -rf node_modules package-lock.json
npm install
```

### Error: "Failed to fetch"
- Verifica que el backend esté corriendo
- Verifica `NG_APP_API_BASE_URL` en `.env`
- Verifica CORS en el backend

### Error: Firebase
- Verifica todas las variables `NG_APP_FIREBASE_*`
- Verifica credenciales en Firebase Console

## 📞 Soporte

Para más información:
- [Setup para Desarrolladores](SETUP_PARA_DESARROLLADORES.md)
- [Guía de Vercel](docs/VERCEL_DEPLOYMENT.md)
- [Angular CLI](https://angular.dev/tools/cli)

## 📄 Licencia

Este proyecto es parte del sistema MecánicoYa - Proyecto académico.

---

**Versión:** 1.0.0  
**Angular:** 21.2  
**Node:** 18+

