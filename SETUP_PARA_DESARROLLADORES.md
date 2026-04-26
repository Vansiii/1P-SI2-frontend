# 🚀 Setup para Desarrolladores - Frontend

Esta guía te ayudará a configurar el frontend en tu máquina local.

## 📋 Pre-requisitos

- Node.js 18+ y npm 10+
- Git
- Acceso al repositorio de GitHub
- Backend corriendo (local o Railway)

## 🔧 Instalación Paso a Paso

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/tu-repositorio.git
cd 1P-SI2-frontend
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

#### Opción A: Recibir archivo .env del equipo (RECOMENDADO)

El líder del equipo te compartirá un archivo `.env` por un canal seguro.

1. Guarda el archivo `.env` en la raíz de `1P-SI2-frontend/`
2. Verifica que contenga todas las variables necesarias

#### Opción B: Crear .env manualmente

1. Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```

2. Edita `.env` y configura las variables:
   ```env
   # API Configuration
   NG_APP_API_BASE_URL=http://localhost:8000/api/v1
   
   # Firebase (solicita al equipo)
   NG_APP_FIREBASE_API_KEY=...
   NG_APP_FIREBASE_AUTH_DOMAIN=...
   # ... etc
   ```

### 4. Ejecutar el Servidor de Desarrollo

```bash
npm start
```

El servidor estará disponible en: http://localhost:4200

### 5. Verificar que Funciona

1. Abre tu navegador en http://localhost:4200
2. Deberías ver la página de login
3. Intenta hacer login (requiere backend corriendo)

## 📝 Variables de Entorno Necesarias

Tu archivo `.env` debe contener:

```env
# API Configuration
NG_APP_API_BASE_URL=http://localhost:8000/api/v1

# Firebase Cloud Messaging
NG_APP_FIREBASE_API_KEY=...
NG_APP_FIREBASE_AUTH_DOMAIN=...
NG_APP_FIREBASE_PROJECT_ID=...
NG_APP_FIREBASE_STORAGE_BUCKET=...
NG_APP_FIREBASE_MESSAGING_SENDER_ID=...
NG_APP_FIREBASE_APP_ID=...
NG_APP_FIREBASE_MEASUREMENT_ID=...
NG_APP_FIREBASE_VAPID_KEY=...
```

**Nota:** Solicita los valores de Firebase al líder del equipo.

## 🧪 Ejecutar Tests

```bash
npm test
```

## 🏗️ Build de Producción

```bash
npm run build
```

Los archivos compilados estarán en `dist/frontend/browser/`

## 🔧 Scripts Disponibles

```bash
npm start          # Servidor de desarrollo
npm run build      # Build de producción
npm test           # Ejecutar tests
npm run lint       # Linter
npm run lint:fix   # Linter con auto-fix
```

## 🐛 Troubleshooting

### Error: "Cannot find module"

**Solución:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Error: "Failed to fetch" al hacer login

**Solución:**
1. Verifica que el backend esté corriendo
2. Verifica que `NG_APP_API_BASE_URL` en `.env` sea correcta
3. Verifica que CORS esté configurado en el backend

### Error: Firebase

**Solución:**
1. Verifica que todas las variables `NG_APP_FIREBASE_*` estén en `.env`
2. Solicita las credenciales correctas al equipo

### Puerto 4200 en uso

**Solución:**
```bash
# Cambiar puerto
ng serve --port 4201
```

## 🤝 Contribuir

### Workflow de Git

1. Crea una rama para tu feature:
   ```bash
   git checkout -b feature/nombre-feature
   ```

2. Haz tus cambios y commits:
   ```bash
   git add .
   git commit -m "feat: descripción del cambio"
   ```

3. Push a tu rama:
   ```bash
   git push origin feature/nombre-feature
   ```

4. Crea un Pull Request en GitHub

### Convenciones de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - Nueva funcionalidad
- `fix:` - Corrección de bug
- `docs:` - Cambios en documentación
- `style:` - Cambios de formato
- `refactor:` - Refactorización de código
- `test:` - Agregar o modificar tests
- `chore:` - Tareas de mantenimiento

### Estilo de Código

Usamos ESLint y Prettier:

```bash
# Verificar estilo
npm run lint

# Auto-fix
npm run lint:fix
```

## 📚 Documentación Adicional

- [README.md](README.md) - Documentación principal
- [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md) - Despliegue en Vercel
- [Angular Docs](https://angular.dev/)

## 🔐 Archivos Sensibles

Estos archivos NO deben subirse a GitHub:

- ❌ `.env` - Variables de entorno locales
- ❌ `.env.production` - Variables de producción
- ❌ `dist/` - Build artifacts
- ❌ `node_modules/` - Dependencias

## ✅ Checklist de Setup

Verifica que completaste todos los pasos:

- [ ] Cloné el repositorio
- [ ] Instalé las dependencias
- [ ] Recibí el archivo `.env` del equipo
- [ ] El servidor arranca sin errores
- [ ] Puedo acceder a http://localhost:4200
- [ ] La página de login carga correctamente
- [ ] Puedo ejecutar los tests

¡Listo para desarrollar! 🎉
