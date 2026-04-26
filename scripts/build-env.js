#!/usr/bin/env node

/**
 * Script para generar environment.ts con configuración de API y Firebase
 * - En Vercel: lee de process.env (prioridad)
 * - En local: lee del archivo .env
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

console.log('Generando environment.ts...');

let config = {};

// Prioridad 1: Variables de entorno (Vercel)
if (process.env.NG_APP_API_BASE_URL) {
  config.apiBaseUrl = process.env.NG_APP_API_BASE_URL;
  config.firebaseApiKey = process.env.NG_APP_FIREBASE_API_KEY;
  config.firebaseAuthDomain = process.env.NG_APP_FIREBASE_AUTH_DOMAIN;
  config.firebaseProjectId = process.env.NG_APP_FIREBASE_PROJECT_ID;
  config.firebaseStorageBucket = process.env.NG_APP_FIREBASE_STORAGE_BUCKET;
  config.firebaseMessagingSenderId = process.env.NG_APP_FIREBASE_MESSAGING_SENDER_ID;
  config.firebaseAppId = process.env.NG_APP_FIREBASE_APP_ID;
  config.firebaseMeasurementId = process.env.NG_APP_FIREBASE_MEASUREMENT_ID;
  config.firebaseVapidKey = process.env.NG_APP_FIREBASE_VAPID_KEY;
  console.log('Usando configuración de variables de entorno (Vercel)');
} else {
  // Prioridad 2: Archivo .env local
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    config.apiBaseUrl = envConfig.NG_APP_API_BASE_URL;
    config.firebaseApiKey = envConfig.NG_APP_FIREBASE_API_KEY;
    config.firebaseAuthDomain = envConfig.NG_APP_FIREBASE_AUTH_DOMAIN;
    config.firebaseProjectId = envConfig.NG_APP_FIREBASE_PROJECT_ID;
    config.firebaseStorageBucket = envConfig.NG_APP_FIREBASE_STORAGE_BUCKET;
    config.firebaseMessagingSenderId = envConfig.NG_APP_FIREBASE_MESSAGING_SENDER_ID;
    config.firebaseAppId = envConfig.NG_APP_FIREBASE_APP_ID;
    config.firebaseMeasurementId = envConfig.NG_APP_FIREBASE_MEASUREMENT_ID;
    config.firebaseVapidKey = envConfig.NG_APP_FIREBASE_VAPID_KEY;
    console.log('Usando configuración del archivo .env local');
  }
}

// Fallback por defecto
if (!config.apiBaseUrl) {
  config.apiBaseUrl = 'http://localhost:8000/api/v1';
  console.log('Usando configuración por defecto para API');
}

// Detectar si es producción (Vercel siempre es producción)
const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';

console.log(`API URL: ${config.apiBaseUrl}`);
console.log(`Firebase Project: ${config.firebaseProjectId || 'No configurado'}`);
console.log(`Production: ${isProduction}`);

// Keep websocket base aligned with API base path (including /api/v1 when present)
const normalizedApiBaseUrl = config.apiBaseUrl.replace(/\/+$/, '');
const wsBaseUrl = normalizedApiBaseUrl.replace(/^http/i, 'ws');

// Generar el contenido del archivo environment.ts
const environmentContent = `// Este archivo es generado automáticamente por scripts/build-env.js
// NO EDITAR MANUALMENTE - Los cambios se perderán

import { Environment } from './environment.interface';

export const environment: Environment = {
  production: ${!!isProduction},
  apiBaseUrl: '${config.apiBaseUrl}',
  apiUrl: '${config.apiBaseUrl}',
  wsUrl: '${wsBaseUrl}',
  enableLogging: ${!isProduction},
  enableDebugMode: ${!isProduction},
  appName: 'MecánicoYa',
  appVersion: '1.0.0',
  httpTimeout: ${isProduction ? 10000 : 30000},
  ${config.firebaseApiKey ? `
  // Firebase Cloud Messaging (Push Notifications)
  firebase: {
    apiKey: '${config.firebaseApiKey}',
    authDomain: '${config.firebaseAuthDomain}',
    projectId: '${config.firebaseProjectId}',
    storageBucket: '${config.firebaseStorageBucket}',
    messagingSenderId: '${config.firebaseMessagingSenderId}',
    appId: '${config.firebaseAppId}'${config.firebaseMeasurementId ? `,
    measurementId: '${config.firebaseMeasurementId}'` : ''}
  },
  
  // VAPID Key para Web Push
  firebaseVapidKey: '${config.firebaseVapidKey}'` : ''}
};
`;

// Escribir el archivo environment.ts
const environmentPath = path.resolve(__dirname, '..', 'src', 'environments', 'environment.ts');
fs.writeFileSync(environmentPath, environmentContent);

console.log('✅ Archivo environment.ts generado correctamente');

// Generar también el archivo firebase-config.js para el Service Worker
if (config.firebaseApiKey) {
  const firebaseConfigContent = `// Este archivo es generado automáticamente por scripts/build-env.js
// NO EDITAR MANUALMENTE - Los cambios se perderán

const firebaseConfig = {
  apiKey: "${config.firebaseApiKey}",
  authDomain: "${config.firebaseAuthDomain}",
  projectId: "${config.firebaseProjectId}",
  storageBucket: "${config.firebaseStorageBucket}",
  messagingSenderId: "${config.firebaseMessagingSenderId}",
  appId: "${config.firebaseAppId}"${config.firebaseMeasurementId ? `,
  measurementId: "${config.firebaseMeasurementId}"` : ''}
};
`;

  const firebaseConfigPath = path.resolve(__dirname, '..', 'public', 'firebase-config.js');
  fs.writeFileSync(firebaseConfigPath, firebaseConfigContent);
  console.log('✅ Archivo firebase-config.js generado correctamente');
}