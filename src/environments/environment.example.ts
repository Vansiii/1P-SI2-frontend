// Este archivo es un template de referencia.
// El archivo real environment.ts se genera desde .env ejecutando:
//   node scripts/build-env.js
// O automáticamente con: npm start / npm run build
//
// NO commitees environment.ts. Usa .env para tus valores locales
// y variables de entorno en Vercel para producción.

import { Environment } from './environment.interface';

export const environment: Environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8000/api/v1',
  apiUrl: 'http://localhost:8000/api/v1',
  wsUrl: 'ws://localhost:8000/api/v1',
  enableLogging: true,
  enableDebugMode: true,
  appName: 'MecánicoYa',
  appVersion: '1.0.0',
  httpTimeout: 30000,

  firebase: {
    apiKey: 'your_api_key_here',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project-id',
    storageBucket: 'your-project.firebasestorage.app',
    messagingSenderId: 'your_sender_id',
    appId: 'your_app_id',
    measurementId: 'your_measurement_id'
  },

  firebaseVapidKey: 'your_vapid_key_here'
};
