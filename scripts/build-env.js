#!/usr/bin/env node

/**
 * Script simple para generar environment.ts
 * - En Vercel: lee de process.env.NG_APP_API_BASE_URL (prioridad)
 * - En local: lee del archivo .env
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

console.log('Generando environment.ts...');

let apiBaseUrl;

// Prioridad 1: Variables de entorno (Vercel)
if (process.env.NG_APP_API_BASE_URL) {
  apiBaseUrl = process.env.NG_APP_API_BASE_URL;
  console.log('Usando configuración de variables de entorno (Vercel)');
} else {
  // Prioridad 2: Archivo .env local
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    apiBaseUrl = envConfig.NG_APP_API_BASE_URL;
    console.log('Usando configuración del archivo .env local');
  }
}

// Fallback por defecto
if (!apiBaseUrl) {
  apiBaseUrl = 'http://localhost:8000/api/v1';
  console.log('Usando configuración por defecto');
}

// Detectar si es producción (Vercel siempre es producción)
const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';

console.log(`API URL: ${apiBaseUrl}`);
console.log(`Production: ${isProduction}`);

// Generar el contenido del archivo environment.ts
const environmentContent = `// Este archivo es generado automáticamente por scripts/build-env.js
// NO EDITAR MANUALMENTE - Los cambios se perderán

import { Environment } from './environment.interface';

export const environment: Environment = {
  production: ${!!isProduction},
  apiBaseUrl: '${apiBaseUrl}',
  apiUrl: '${apiBaseUrl}',
  enableLogging: ${!isProduction},
  enableDebugMode: ${!isProduction},
  appName: 'MecánicoYa',
  appVersion: '1.0.0',
  httpTimeout: ${isProduction ? 10000 : 30000},
};
`;

// Escribir el archivo environment.ts
const environmentPath = path.resolve(__dirname, '..', 'src', 'environments', 'environment.ts');
fs.writeFileSync(environmentPath, environmentContent);

console.log('Archivo environment.ts generado correctamente');