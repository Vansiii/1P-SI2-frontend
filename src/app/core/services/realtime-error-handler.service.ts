import { Injectable, inject, DestroyRef, signal } from '@angular/core';
import { WebSocketService, ConnectionStatus } from './websocket.service';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Error types
 */
export type ErrorType = 
  | 'connection_error'
  | 'authentication_error'
  | 'network_error'
  | 'rate_limit_error'
  | 'server_error'
  | 'validation_error'
  | 'unknown_error';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error information interface
 */
export interface ErrorInfo {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  timestamp: string;
  details?: any;
  retryable: boolean;
  retryCount?: number;
}

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
  type: 'reconnect' | 'refresh_token' | 'fallback_polling' | 'manual' | 'none';
  description: string;
  action?: () => void;
}

/**
 * Real-Time Error Handler Service
 * 
 * Centralized error handling for real-time features.
 * Provides error logging, user feedback, and recovery strategies.
 */
@Injectable({
  providedIn: 'root'
})
export class RealtimeErrorHandlerService {
  private readonly webSocketService = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  // Error history
  private readonly errorHistory: ErrorInfo[] = [];
  private readonly maxHistorySize = 50;

  // Current errors signal
  readonly currentErrors = signal<ErrorInfo[]>([]);

  // Connection status signal
  readonly connectionStatus = signal<ConnectionStatus>('disconnected');

  // Is in fallback mode signal
  readonly isInFallbackMode = signal<boolean>(false);

  // Error stream
  private readonly errorSubject = new Subject<ErrorInfo>();
  readonly error$ = this.errorSubject.asObservable();

  // User feedback stream
  private readonly userFeedbackSubject = new Subject<{ message: string; type: 'info' | 'warning' | 'error' | 'success' }>();
  readonly userFeedback$ = this.userFeedbackSubject.asObservable();

  // Recovery action stream
  private readonly recoveryActionSubject = new Subject<RecoveryStrategy>();
  readonly recoveryAction$ = this.recoveryActionSubject.asObservable();

  private destroy$ = new Subject<void>();
  private pollingInterval: any;

  constructor() {
    this.setupConnectionMonitoring();

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  /**
   * Setup connection monitoring
   */
  private setupConnectionMonitoring(): void {
    // Monitor WebSocket connection status
    this.webSocketService.connectionStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.connectionStatus.set(status);
        this.handleConnectionStatusChange(status);
      });
  }

  /**
   * Handle connection status change
   */
  private handleConnectionStatusChange(status: ConnectionStatus): void {
    switch (status) {
      case 'connected':
        this.handleConnectionRestored();
        break;
      case 'error':
        this.handleConnectionError();
        break;
      case 'disconnected':
        this.handleDisconnection();
        break;
      case 'reconnecting':
        this.showUserFeedback('Reconectando...', 'info');
        break;
    }
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(): void {
    const error: ErrorInfo = {
      id: this.generateErrorId(),
      type: 'connection_error',
      severity: 'high',
      message: 'Error de conexión WebSocket',
      timestamp: new Date().toISOString(),
      retryable: true
    };

    this.logError(error);
    this.showUserFeedback('Error de conexión. Intentando reconectar...', 'error');

    // Suggest recovery strategy
    const strategy: RecoveryStrategy = {
      type: 'reconnect',
      description: 'Intentar reconectar automáticamente',
      action: () => this.webSocketService.connect()
    };

    this.recoveryActionSubject.next(strategy);
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(): void {
    const error: ErrorInfo = {
      id: this.generateErrorId(),
      type: 'network_error',
      severity: 'medium',
      message: 'Conexión perdida',
      timestamp: new Date().toISOString(),
      retryable: true
    };

    this.logError(error);
    this.showUserFeedback('Conexión perdida. Reconectando...', 'warning');
  }

  /**
   * Handle connection restored
   */
  private handleConnectionRestored(): void {
    // Clear connection-related errors
    this.clearErrorsByType('connection_error');
    this.clearErrorsByType('network_error');

    // Disable fallback mode if active
    if (this.isInFallbackMode()) {
      this.disableFallbackMode();
    }

    this.showUserFeedback('Conexión restaurada', 'success');
  }

  /**
   * Handle authentication error
   */
  handleAuthenticationError(details?: any): void {
    const error: ErrorInfo = {
      id: this.generateErrorId(),
      type: 'authentication_error',
      severity: 'critical',
      message: 'Error de autenticación',
      timestamp: new Date().toISOString(),
      details,
      retryable: false
    };

    this.logError(error);
    this.showUserFeedback('Error de autenticación. Por favor, inicie sesión nuevamente.', 'error');

    // Suggest manual intervention
    const strategy: RecoveryStrategy = {
      type: 'manual',
      description: 'Requiere inicio de sesión manual'
    };

    this.recoveryActionSubject.next(strategy);
  }

  /**
   * Handle rate limit error
   */
  handleRateLimitError(retryAfter?: number): void {
    const error: ErrorInfo = {
      id: this.generateErrorId(),
      type: 'rate_limit_error',
      severity: 'medium',
      message: 'Límite de tasa excedido',
      timestamp: new Date().toISOString(),
      details: { retryAfter },
      retryable: true
    };

    this.logError(error);

    const retryMessage = retryAfter 
      ? `Límite de tasa excedido. Reintentando en ${retryAfter} segundos.`
      : 'Límite de tasa excedido. Reintentando pronto.';

    this.showUserFeedback(retryMessage, 'warning');
  }

  /**
   * Handle server error
   */
  handleServerError(details?: any): void {
    const error: ErrorInfo = {
      id: this.generateErrorId(),
      type: 'server_error',
      severity: 'high',
      message: 'Error del servidor',
      timestamp: new Date().toISOString(),
      details,
      retryable: true
    };

    this.logError(error);
    this.showUserFeedback('Error del servidor. Reintentando...', 'error');

    // Consider fallback mode after multiple server errors
    const serverErrors = this.errorHistory.filter(e => e.type === 'server_error');
    if (serverErrors.length >= 3) {
      this.enableFallbackMode();
    }
  }

  /**
   * Handle validation error
   */
  handleValidationError(message: string, details?: any): void {
    const error: ErrorInfo = {
      id: this.generateErrorId(),
      type: 'validation_error',
      severity: 'low',
      message,
      timestamp: new Date().toISOString(),
      details,
      retryable: false
    };

    this.logError(error);
    console.warn('⚠️ Validation error:', message, details);
  }

  /**
   * Log error
   */
  private logError(error: ErrorInfo): void {
    // Add to history
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Add to current errors
    this.currentErrors.update(errors => [...errors, error]);

    // Emit error
    this.errorSubject.next(error);

    // Log to console
    console.error('❌ Real-time error:', error);
  }

  /**
   * Clear error by ID
   */
  clearError(errorId: string): void {
    this.currentErrors.update(errors => 
      errors.filter(e => e.id !== errorId)
    );
  }

  /**
   * Clear errors by type
   */
  private clearErrorsByType(type: ErrorType): void {
    this.currentErrors.update(errors => 
      errors.filter(e => e.type !== type)
    );
  }

  /**
   * Clear all errors
   */
  clearAllErrors(): void {
    this.currentErrors.set([]);
  }

  /**
   * Show user feedback
   */
  private showUserFeedback(
    message: string,
    type: 'info' | 'warning' | 'error' | 'success'
  ): void {
    this.userFeedbackSubject.next({ message, type });
  }

  /**
   * Enable fallback polling mode
   */
  private enableFallbackMode(): void {
    if (this.isInFallbackMode()) {
      return;
    }

    console.log('🔄 Enabling fallback polling mode');
    this.isInFallbackMode.set(true);

    this.showUserFeedback(
      'Actualizaciones en tiempo real no disponibles. Usando modo de respaldo.',
      'warning'
    );

    // Start polling (example - would need actual implementation)
    this.startPolling();

    const strategy: RecoveryStrategy = {
      type: 'fallback_polling',
      description: 'Usando modo de respaldo con polling'
    };

    this.recoveryActionSubject.next(strategy);
  }

  /**
   * Disable fallback mode
   */
  private disableFallbackMode(): void {
    if (!this.isInFallbackMode()) {
      return;
    }

    console.log('✅ Disabling fallback polling mode');
    this.isInFallbackMode.set(false);

    this.stopPolling();
  }

  /**
   * Start polling (fallback mechanism)
   */
  private startPolling(): void {
    // Poll every 30 seconds
    this.pollingInterval = setInterval(() => {
      console.log('🔄 Polling for updates (fallback mode)');
      // Implement actual polling logic here
      // This would typically call REST endpoints to get updates
    }, 30000);
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Manual reconnection
   */
  manualReconnect(): void {
    this.showUserFeedback('Intentando reconectar...', 'info');
    this.webSocketService.connect();
  }

  /**
   * Get error history
   */
  getErrorHistory(limit?: number): ErrorInfo[] {
    if (limit) {
      return this.errorHistory.slice(-limit);
    }
    return [...this.errorHistory];
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type: ErrorType): ErrorInfo[] {
    return this.errorHistory.filter(e => e.type === type);
  }

  /**
   * Get error statistics
   */
  getErrorStatistics() {
    const stats: Record<ErrorType, number> = {
      connection_error: 0,
      authentication_error: 0,
      network_error: 0,
      rate_limit_error: 0,
      server_error: 0,
      validation_error: 0,
      unknown_error: 0
    };

    this.errorHistory.forEach(error => {
      stats[error.type]++;
    });

    return {
      total: this.errorHistory.length,
      byType: stats,
      current: this.currentErrors().length
    };
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.stopPolling();

    this.errorSubject.complete();
    this.userFeedbackSubject.complete();
    this.recoveryActionSubject.complete();

    console.log('🧹 RealtimeErrorHandlerService cleaned up');
  }
}
