import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

let isRefreshing = false;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const http = inject(HttpClient);
  const accessToken = authService.getAccessToken();

  console.log(`🌐 HTTP Request: ${request.method} ${request.url}`);

  // Si no hay token, continuar sin autorización
  if (!accessToken) {
    console.log('⚠️ No access token available for request');
    return next(request).pipe(
      catchError((error) => {
        logError(error);
        return throwError(() => error);
      })
    );
  }

  console.log('✅ Adding Authorization header to request');

  // Agregar token a la petición
  const authorizedRequest = request.clone({
    setHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return next(authorizedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      logError(error);

      // Si es 401 y no es la ruta de refresh, intentar refrescar token
      if (error.status === 401 && !request.url.includes('/tokens/refresh') && !isRefreshing) {
        console.log('🔄 Received 401, attempting token refresh...');
        return handleTokenRefresh(request, next, authService, http);
      }

      return throwError(() => error);
    })
  );
};

function handleTokenRefresh(
  request: HttpRequest<any>,
  next: HttpHandlerFn,
  authService: AuthService,
  http: HttpClient
) {
  isRefreshing = true;
  const refreshToken = authService.getRefreshToken();

  if (!refreshToken) {
    isRefreshing = false;
    console.log('🔴 No refresh token available, redirecting to login');
    authService.clearSessionAndRedirect();
    return throwError(() => new Error('No refresh token available'));
  }

  console.log('🔄 Attempting to refresh token...');

  return http.post<any>(`${environment.apiUrl}/tokens/refresh`, {
    refresh_token: refreshToken
  }).pipe(
    switchMap((response) => {
      isRefreshing = false;
      console.log('✅ Token refreshed successfully');

      // Extraer tokens de la respuesta
      const newAccessToken = response.data?.tokens?.access_token || response.data?.access_token || response.access_token;
      const newRefreshToken = response.data?.tokens?.refresh_token || response.data?.refresh_token || response.refresh_token;
      
      if (newAccessToken) {
        // Actualizar tokens en el servicio (esto actualiza signals y localStorage)
        authService.updateTokens(newAccessToken, newRefreshToken || refreshToken);
        
        // Reintentar la petición original con el nuevo token
        const retryRequest = request.clone({
          setHeaders: {
            Authorization: `Bearer ${newAccessToken}`,
          },
        });
        
        return next(retryRequest);
      }

      console.error('❌ No access token in refresh response');
      authService.clearSessionAndRedirect();
      return throwError(() => new Error('No access token in refresh response'));
    }),
    catchError((error) => {
      isRefreshing = false;
      console.log('❌ Token refresh failed, redirecting to login');
      authService.clearSessionAndRedirect();
      return throwError(() => error);
    })
  );
}

function logError(error: any) {
  if (error instanceof HttpErrorResponse) {
    console.log('🔴 HTTP Error Response:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      error: error.error,
      message: error.message,
    });
  } else {
    console.log('🔴 Unknown Error:', error);
  }
}
