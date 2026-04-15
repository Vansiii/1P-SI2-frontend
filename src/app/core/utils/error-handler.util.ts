/**
 * Utility function to extract error messages from HTTP responses
 */
export function extractErrorMessage(error: unknown, fallbackMessage: string): string {
  // Handle HttpErrorResponse
  if (error && typeof error === 'object' && 'error' in error) {
    const httpError = error as any;
    
    // Try to extract message from various possible locations
    if (httpError.error?.detail) {
      if (typeof httpError.error.detail === 'string') {
        return httpError.error.detail;
      }
      if (httpError.error.detail.message) {
        return httpError.error.detail.message;
      }
    }
    
    if (httpError.error?.message) {
      return httpError.error.message;
    }
    
    if (httpError.message) {
      return httpError.message;
    }
  }
  
  return fallbackMessage;
}

/**
 * Extract error message with additional metadata (lockout info, retry timing)
 */
export function extractErrorWithMetadata(
  error: unknown,
  fallbackMessage: string
): { message: string; lockoutUntilIso?: string; retryAfterSeconds?: number } {
  if (error && typeof error === 'object' && 'error' in error) {
    const httpError = error as any;
    
    let message = fallbackMessage;
    let lockoutUntilIso: string | undefined;
    let retryAfterSeconds: number | undefined;
    
    // Try to get message from error.error.error.message (backend structure)
    if (httpError.error && typeof httpError.error === 'object') {
      const backendError = httpError.error.error;
      if (backendError && typeof backendError === 'object') {
        const errorCode = typeof backendError.code === 'string' ? backendError.code : undefined;
        const details = backendError.details as Record<string, unknown> | undefined;
        const lockoutUntil = typeof details?.['lockout_until'] === 'string' ? details['lockout_until'] : undefined;
        const retryAfter =
          typeof details?.['retry_after'] === 'number'
            ? details['retry_after']
            : typeof details?.['remaining_seconds'] === 'number'
              ? details['remaining_seconds']
              : undefined;

        if (errorCode === 'ACCOUNT_LOCKED') {
          return {
            message: 'Tu cuenta está bloqueada temporalmente por seguridad.',
            lockoutUntilIso: lockoutUntil,
            retryAfterSeconds: retryAfter,
          };
        }

        if (typeof backendError.message === 'string') {
          message = backendError.message;
          lockoutUntilIso = lockoutUntil;
          retryAfterSeconds = retryAfter;
        }
      }
      
      // Try error.error.message
      if (!message || message === fallbackMessage) {
        if (typeof httpError.error.message === 'string') {
          message = httpError.error.message;
        }
      }
    }
    
    // Try to get from error.error.detail (old structure)
    if ((!message || message === fallbackMessage) && httpError.error && typeof httpError.error.detail !== 'undefined') {
      const detail = httpError.error.detail;
      if (typeof detail === 'string') {
        message = detail;
      } else if (detail && typeof detail === 'object' && 'message' in detail) {
        const detailMessage = (detail as any).message;
        if (typeof detailMessage === 'string') {
          message = detailMessage;
        }
      }
    }
    
    // Try error.message
    if ((!message || message === fallbackMessage) && typeof httpError.message === 'string' && httpError.message !== 'Http failure response for (unknown url): 0 Unknown Error') {
      message = httpError.message;
    }
    
    // Extract lockout metadata if not already extracted
    if (!lockoutUntilIso && httpError.error?.lockout_until) {
      lockoutUntilIso = httpError.error.lockout_until;
    }
    
    if (!retryAfterSeconds && httpError.error?.retry_after_seconds) {
      retryAfterSeconds = httpError.error.retry_after_seconds;
    }
    
    return { message, lockoutUntilIso, retryAfterSeconds };
  }
  
  return { message: fallbackMessage };
}
