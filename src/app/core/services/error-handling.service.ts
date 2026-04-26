import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  VALIDATION = 'VALIDATION',
  SERVER = 'SERVER',
  WEBSOCKET = 'WEBSOCKET',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Structured error model
 */
export interface AppError {
  category: ErrorCategory;
  message: string;
  code: string | null;
  details: Record<string, any> | null;
  timestamp: string;
  recoverable: boolean;
}

/**
 * Error handling service for centralized error management
 * 
 * Provides:
 * - HTTP error categorization and handling
 * - User-friendly error messages
 * - Error logging for debugging
 * - Toast notifications integration
 * - Production error tracking
 */
@Injectable({
  providedIn: 'root'
})
export class ErrorHandlingService {

  /**
   * Handle HTTP errors and convert to AppError
   * 
   * Maps HTTP status codes to appropriate error categories
   * and provides user-friendly messages
   */
  public handleHttpError(error: HttpErrorResponse): AppError {
    let category: ErrorCategory;
    let message: string;
    let recoverable: boolean;

    if (error.status === 0) {
      // Network error - no response from server
      category = ErrorCategory.NETWORK;
      message = 'Error de conexión. Verifica tu conexión a internet.';
      recoverable = true;
    } else if (error.status === 401 || error.status === 403) {
      // Authentication/Authorization error
      category = ErrorCategory.AUTH;
      message = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
      recoverable = false;
    } else if (error.status >= 400 && error.status < 500) {
      // Client error (validation, bad request, etc.)
      category = ErrorCategory.VALIDATION;
      message = error.error?.message || 'Error en la solicitud.';
      recoverable = false;
    } else if (error.status >= 500 && error.status < 600) {
      // Server error (5xx range)
      category = ErrorCategory.SERVER;
      message = 'Error del servidor. Intenta nuevamente más tarde.';
      recoverable = true;
    } else {
      // Unknown error
      category = ErrorCategory.UNKNOWN;
      message = 'Ocurrió un error inesperado.';
      recoverable = false;
    }

    return {
      category,
      message,
      code: error.status.toString(),
      details: error.error || null,
      timestamp: new Date().toISOString(),
      recoverable
    };
  }

  /**
   * Log error to console with structured format
   * 
   * In development: logs to console
   * In production: sends to external logging service
   */
  public logError(error: AppError): void {
    console.error('[AppError]', {
      category: error.category,
      message: error.message,
      code: error.code,
      timestamp: error.timestamp,
      recoverable: error.recoverable,
      details: error.details
    });

    // Send to external logging service in production
    // This is called from logError to ensure all errors are tracked
    if (this.isProduction()) {
      this.sendToLoggingService(error);
    }
  }

  /**
   * Show user-friendly error message via toast notification
   * 
   * Placeholder for toast integration - will be implemented
   * when ToastService is available
   */
  public showError(error: AppError): void {
    // TODO: Integrate with ToastService when available
    // this.toastService.error(error.message);
    
    // Temporary fallback: log to console
    console.warn('[ErrorHandlingService] Toast not implemented yet:', error.message);
  }

  /**
   * Send error to external logging service for production monitoring
   * 
   * Placeholder for integration with services like:
   * - Sentry
   * - LogRocket
   * - Application Insights
   * - Custom logging backend
   */
  public sendToLoggingService(error: AppError): void {
    // TODO: Implement integration with external logging service
    // Example for Sentry:
    // Sentry.captureException(error, {
    //   tags: {
    //     category: error.category,
    //     recoverable: error.recoverable
    //   },
    //   extra: {
    //     code: error.code,
    //     details: error.details
    //   }
    // });
    
    console.info('[ErrorHandlingService] Production logging not configured yet');
  }

  /**
   * Check if running in production environment
   */
  private isProduction(): boolean {
    // This will be replaced with actual environment check
    // when environment configuration is available
    return false;
  }
}
