import { ErrorHandlingService, ErrorCategory, AppError } from './error-handling.service';

// Mock HttpErrorResponse for testing
class MockHttpErrorResponse {
  constructor(
    public status: number,
    public statusText: string,
    public error?: any,
    public url?: string
  ) {}
}

describe('ErrorHandlingService', () => {
  let service: ErrorHandlingService;

  beforeEach(() => {
    service = new ErrorHandlingService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('handleHttpError', () => {
    it('should handle network error (status 0)', () => {
      const httpError = new MockHttpErrorResponse(0, 'Unknown Error', undefined, 'http://localhost:8000/api/test') as any;

      const appError = service.handleHttpError(httpError);

      expect(appError.category).toBe(ErrorCategory.NETWORK);
      expect(appError.message).toContain('conexión');
      expect(appError.recoverable).toBe(true);
      expect(appError.code).toBe('0');
      expect(appError.timestamp).toBeDefined();
    });

    it('should handle 401 authentication error', () => {
      const httpError = new MockHttpErrorResponse(401, 'Unauthorized', undefined, 'http://localhost:8000/api/test') as any;

      const appError = service.handleHttpError(httpError);

      expect(appError.category).toBe(ErrorCategory.AUTH);
      expect(appError.message).toContain('Sesión expirada');
      expect(appError.recoverable).toBe(false);
      expect(appError.code).toBe('401');
    });

    it('should handle 403 authorization error', () => {
      const httpError = new MockHttpErrorResponse(403, 'Forbidden', undefined, 'http://localhost:8000/api/test') as any;

      const appError = service.handleHttpError(httpError);

      expect(appError.category).toBe(ErrorCategory.AUTH);
      expect(appError.recoverable).toBe(false);
      expect(appError.code).toBe('403');
    });

    it('should handle 400 validation error with custom message', () => {
      const httpError = new MockHttpErrorResponse(400, 'Bad Request', { message: 'Invalid input data' }, 'http://localhost:8000/api/test') as any;

      const appError = service.handleHttpError(httpError);

      expect(appError.category).toBe(ErrorCategory.VALIDATION);
      expect(appError.message).toBe('Invalid input data');
      expect(appError.recoverable).toBe(false);
      expect(appError.code).toBe('400');
      expect(appError.details).toEqual({ message: 'Invalid input data' });
    });

    it('should handle 400 validation error with default message', () => {
      const httpError = new MockHttpErrorResponse(400, 'Bad Request', undefined, 'http://localhost:8000/api/test') as any;

      const appError = service.handleHttpError(httpError);

      expect(appError.category).toBe(ErrorCategory.VALIDATION);
      expect(appError.message).toBe('Error en la solicitud.');
      expect(appError.recoverable).toBe(false);
    });

    it('should handle 404 not found error', () => {
      const httpError = new MockHttpErrorResponse(404, 'Not Found', undefined, 'http://localhost:8000/api/test') as any;

      const appError = service.handleHttpError(httpError);

      expect(appError.category).toBe(ErrorCategory.VALIDATION);
      expect(appError.recoverable).toBe(false);
      expect(appError.code).toBe('404');
    });

    it('should handle 500 server error', () => {
      const httpError = new MockHttpErrorResponse(500, 'Internal Server Error', undefined, 'http://localhost:8000/api/test') as any;

      const appError = service.handleHttpError(httpError);

      expect(appError.category).toBe(ErrorCategory.SERVER);
      expect(appError.message).toContain('servidor');
      expect(appError.recoverable).toBe(true);
      expect(appError.code).toBe('500');
    });

    it('should handle 503 service unavailable error', () => {
      const httpError = new MockHttpErrorResponse(503, 'Service Unavailable', undefined, 'http://localhost:8000/api/test') as any;

      const appError = service.handleHttpError(httpError);

      expect(appError.category).toBe(ErrorCategory.SERVER);
      expect(appError.recoverable).toBe(true);
      expect(appError.code).toBe('503');
    });

    it('should handle unknown error status', () => {
      const httpError = new MockHttpErrorResponse(999, 'Unknown', undefined, 'http://localhost:8000/api/test') as any;

      const appError = service.handleHttpError(httpError);

      expect(appError.category).toBe(ErrorCategory.UNKNOWN);
      expect(appError.message).toContain('inesperado');
      expect(appError.recoverable).toBe(false);
      expect(appError.code).toBe('999');
    });

    it('should include error details when available', () => {
      const errorDetails = {
        field: 'email',
        constraint: 'unique',
        value: 'test@example.com'
      };
      
      const httpError = new MockHttpErrorResponse(400, 'Bad Request', errorDetails, 'http://localhost:8000/api/test') as any;

      const appError = service.handleHttpError(httpError);

      expect(appError.details).toEqual(errorDetails);
    });

    it('should set details to null when no error body', () => {
      const httpError = new MockHttpErrorResponse(500, 'Internal Server Error', undefined, 'http://localhost:8000/api/test') as any;

      const appError = service.handleHttpError(httpError);

      expect(appError.details).toBeNull();
    });

    it('should always include timestamp', () => {
      const httpError = new MockHttpErrorResponse(500, 'Internal Server Error', undefined, 'http://localhost:8000/api/test') as any;

      const appError = service.handleHttpError(httpError);

      expect(appError.timestamp).toBeDefined();
      // Timestamp should be a valid ISO string
      expect(new Date(appError.timestamp).toISOString()).toBe(appError.timestamp);
    });
  });

  describe('logError', () => {
    it('should log error to console', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');
      
      const appError: AppError = {
        category: ErrorCategory.NETWORK,
        message: 'Test error',
        code: '0',
        details: null,
        timestamp: new Date().toISOString(),
        recoverable: true
      };

      service.logError(appError);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[AppError]', {
        category: appError.category,
        message: appError.message,
        code: appError.code,
        timestamp: appError.timestamp,
        recoverable: appError.recoverable,
        details: appError.details
      });
    });

    it('should call sendToLoggingService in production', () => {
      vi.spyOn<any, any>(service, 'isProduction').mockReturnValue(true);
      const sendToLoggingSpy = vi.spyOn(service, 'sendToLoggingService');
      
      const appError: AppError = {
        category: ErrorCategory.SERVER,
        message: 'Server error',
        code: '500',
        details: null,
        timestamp: new Date().toISOString(),
        recoverable: true
      };

      service.logError(appError);

      expect(sendToLoggingSpy).toHaveBeenCalledWith(appError);
    });

    it('should not call sendToLoggingService in development', () => {
      vi.spyOn<any, any>(service, 'isProduction').mockReturnValue(false);
      const sendToLoggingSpy = vi.spyOn(service, 'sendToLoggingService');
      
      const appError: AppError = {
        category: ErrorCategory.SERVER,
        message: 'Server error',
        code: '500',
        details: null,
        timestamp: new Date().toISOString(),
        recoverable: true
      };

      service.logError(appError);

      expect(sendToLoggingSpy).not.toHaveBeenCalled();
    });
  });

  describe('showError', () => {
    it('should log warning when toast not implemented', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      
      const appError: AppError = {
        category: ErrorCategory.VALIDATION,
        message: 'Validation failed',
        code: '400',
        details: null,
        timestamp: new Date().toISOString(),
        recoverable: false
      };

      service.showError(appError);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ErrorHandlingService] Toast not implemented yet:',
        'Validation failed'
      );
    });
  });

  describe('sendToLoggingService', () => {
    it('should log info message when not configured', () => {
      const consoleInfoSpy = vi.spyOn(console, 'info');
      
      const appError: AppError = {
        category: ErrorCategory.UNKNOWN,
        message: 'Unknown error',
        code: null,
        details: null,
        timestamp: new Date().toISOString(),
        recoverable: false
      };

      service.sendToLoggingService(appError);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[ErrorHandlingService] Production logging not configured yet'
      );
    });
  });
});
