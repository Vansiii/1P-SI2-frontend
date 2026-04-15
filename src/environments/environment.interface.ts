/**
 * Interface para la configuración de entorno
 * Proporciona type safety para las propiedades del environment
 */
export interface Environment {
  production: boolean;
  apiBaseUrl: string;
  apiUrl: string;
  enableLogging: boolean;
  enableDebugMode: boolean;
  appName: string;
  appVersion: string;
  httpTimeout: number;
}
