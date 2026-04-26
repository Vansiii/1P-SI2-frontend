// Este archivo es generado automáticamente por scripts/build-env.js
// NO EDITAR MANUALMENTE - Los cambios se perderán

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
  
  // Firebase Cloud Messaging (Push Notifications)
  firebase: {
    apiKey: 'AIzaSyArXp5QM9rMvyHFeGGlcQXnswACa3kEcQw',
    authDomain: 'mecanicoya-a6b5c.firebaseapp.com',
    projectId: 'mecanicoya-a6b5c',
    storageBucket: 'mecanicoya-a6b5c.firebasestorage.app',
    messagingSenderId: '953573857812',
    appId: '1:953573857812:web:f317243430da38e839e501',
    measurementId: 'G-ZRVWX1T5HY'
  },
  
  // VAPID Key para Web Push
  firebaseVapidKey: 'BCmIchV8ZGAXni86XQC84IXomvcdcUASOxPLtnHDQ1BDxFcD-qIYiXP3MwKGpjJW2rtNisJPqnTOMs6ZmRnjVJY'
};
